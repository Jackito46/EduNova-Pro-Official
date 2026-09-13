import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  CreditCard, ShieldCheck, CheckCircle2, AlertCircle, Clock, 
  RefreshCw, ArrowRight, TrendingUp, Receipt, Award, ChevronRight
} from 'lucide-react';
import { supabase } from '../supabase';
import { useSchool } from '../contexts/SchoolContext';
import { computeFeeCategoryBalance } from '../utils/financeCalculations';

export interface StudentSolvencySummaryProps {
  studentId: string;
  schoolId: string;
  classId?: string;
  studentName?: string;
  academicYearId?: string;
  className?: string;
  onPaymentSuccess?: () => void;
}

export interface SolvencyData {
  totalExpected: number;
  totalDiscount: number;
  netDue: number;
  totalPaid: number;
  remainingBalance: number;
  coveragePercentage: number;
  solvencyStatus: 'SOLVED' | 'PARTIAL' | 'UNPAID';
  paymentsCount: number;
  lastPaymentDate: string | null;
  lastPaymentAmount: number | null;
  academicYearLabel: string;
  exchangeRate: number;
}

export const StudentSolvencySummary: React.FC<StudentSolvencySummaryProps> = ({
  studentId,
  schoolId,
  classId,
  studentName,
  academicYearId,
  className = '',
}) => {
  const navigate = useNavigate();
  const { terminology } = useSchool();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [resolvedYearId, setResolvedYearId] = useState<string | undefined>(academicYearId);
  const [data, setData] = useState<SolvencyData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const calculateSolvency = useCallback(async (isSilent = false) => {
    if (!studentId || !schoolId) return;

    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      // 1. Déterminer l'année académique active si non fournie
      let targetYearId = academicYearId;
      let targetYearLabel = 'Session en cours';

      if (!targetYearId) {
        const { data: activeYear } = await supabase
          .from('academic_years')
          .select('id, label, status, is_active')
          .eq('school_id', schoolId)
          .or('status.eq.ACTIVE,is_active.eq.true')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (activeYear) {
          targetYearId = activeYear.id;
          targetYearLabel = activeYear.label;
        }
      } else {
        const { data: yData } = await supabase
          .from('academic_years')
          .select('label')
          .eq('id', targetYearId)
          .maybeSingle();
        if (yData?.label) targetYearLabel = yData.label;
      }
      setResolvedYearId(targetYearId);

      // 2. Récupérer le taux de change en vigueur
      let exchangeRate = 135;
      try {
        const { data: rateRes } = await supabase
          .from('exchange_rates')
          .select('rate_usd_to_htg')
          .eq('school_id', schoolId)
          .order('effective_date', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (rateRes?.rate_usd_to_htg) {
          exchangeRate = Number(rateRes.rate_usd_to_htg);
        }
      } catch (e) {
        console.warn("Taux de change non récupéré, utilisation du taux par défaut 135", e);
      }

      // 3. Charger l'élève, ses inscriptions et sa classe effective
      const [
        studentRes,
        enrollmentRes,
        allEnrollmentsRes,
        adHocRes
      ] = await Promise.all([
        supabase
          .from('students')
          .select('id, discount_amount, discount_type, class_id')
          .eq('id', studentId)
          .eq('school_id', schoolId)
          .single(),
        targetYearId
          ? supabase
              .from('enrollments')
              .select('class_id, academic_year_id, tuition_discount, tuition_addition')
              .eq('student_id', studentId)
              .eq('academic_year_id', targetYearId)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        supabase
          .from('enrollments')
          .select('academic_year_id')
          .eq('student_id', studentId),
        supabase
          .from('student_ad_hoc_fees')
          .select(`
            custom_amount,
            campaign:ad_hoc_campaigns!campaign_id(id, amount, currency, academic_year_id, status)
          `)
          .eq('student_id', studentId)
          .eq('school_id', schoolId)
      ]);

      const studentRecord = studentRes.data;
      const enrollmentRecord = enrollmentRes.data;
      const previousEnrollments = allEnrollmentsRes.data || [];
      const isReenrolled = previousEnrollments.length > 1;

      const effectiveClassId = enrollmentRecord?.class_id || classId || studentRecord?.class_id;

      // 4. Charger le plan tarifaire (fee_plans)
      let plan: any = null;
      if (effectiveClassId) {
        let planQuery = supabase
          .from('fee_plans')
          .select('*')
          .eq('school_id', schoolId)
          .eq('class_id', effectiveClassId);

        if (targetYearId) {
          planQuery = planQuery.eq('academic_year_id', targetYearId);
        }

        const { data: planData } = await planQuery.maybeSingle();
        plan = planData;

        // Fallback sans filtre d'année si plan non trouvé
        if (!plan) {
          const { data: fallbackPlan } = await supabase
            .from('fee_plans')
            .select('*')
            .eq('school_id', schoolId)
            .eq('class_id', effectiveClassId)
            .limit(1)
            .maybeSingle();
          plan = fallbackPlan;
        }
      }

      // 5. Charger tous les paiements réels de l'élève depuis la table payments
      let payQuery = supabase
        .from('payments')
        .select('*')
        .eq('student_id', studentId)
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false });

      const { data: paymentsData, error: payError } = await payQuery;
      if (payError) throw payError;

      // Filtrer les paiements valides (non annulés, non rejetés)
      const validPayments = (paymentsData || []).filter((p: any) => {
        const status = String(p.status || '').toUpperCase();
        if (status.includes('ANNUL') || status.includes('REJET') || status.includes('CANCEL')) return false;
        const method = String(p.payment_method || '').toUpperCase();
        if (method.includes('REJETÉ') || method.includes('REJETE') || method.includes('EN ATTENTE')) return false;
        return true;
      });

      // 6. Identifier le dernier versement
      let lastPaymentDate: string | null = null;
      let lastPaymentAmount: number | null = null;
      if (validPayments.length > 0) {
        const firstP = validPayments[0];
        lastPaymentDate = firstP.payment_date || firstP.date || firstP.created_at || null;
        lastPaymentAmount = Number(firstP.amount_htg_equivalent) || Number(firstP.amount) || 0;
      }

      // 7. Ventilation des paiements par catégorie (identique à TuitionPaymentForm & StudentPaymentTracking)
      const isAdmissionPayment = (p: any) => {
        const feeTypeStr = (p.fee_type || '').toLowerCase();
        const natureStr = (p.nature || '').toLowerCase();
        const typeStr = (p.type || '').toLowerCase();
        const descStr = (p.description || '').toLowerCase();
        return (
          feeTypeStr.includes('inscri') ||
          feeTypeStr.includes('admiss') ||
          feeTypeStr.includes('reinscri') ||
          feeTypeStr.includes('réinscri') ||
          natureStr.includes('inscri') ||
          natureStr.includes('admiss') ||
          natureStr.includes('reinscri') ||
          natureStr.includes('réinscri') ||
          natureStr.includes('entree') ||
          natureStr.includes('entrée') ||
          typeStr.includes('inscri') ||
          typeStr.includes('admiss') ||
          typeStr.includes('reinscri') ||
          typeStr.includes('réinscri') ||
          descStr.includes('inscri') ||
          descStr.includes('admiss') ||
          descStr.includes('reinscri') ||
          descStr.includes('réinscri')
        );
      };

      const isMiscPayment = (p: any) => {
        const feeTypeStr = (p.fee_type || '').toLowerCase();
        const natureStr = (p.nature || '').toLowerCase();
        const typeStr = (p.type || '').toLowerCase();
        const descStr = (p.description || '').toLowerCase();
        return (
          feeTypeStr.includes('divers') ||
          natureStr.includes('divers') ||
          typeStr.includes('divers') ||
          descStr.includes('divers') ||
          feeTypeStr.includes('misc')
        );
      };

      const isCampaignPayment = (p: any) => !!p.ad_hoc_campaign_id;

      const admissionPayments = validPayments.filter(p => !isCampaignPayment(p) && isAdmissionPayment(p));
      const miscPayments = validPayments.filter(p => !isCampaignPayment(p) && !isAdmissionPayment(p) && isMiscPayment(p));
      const tuitionPayments = validPayments.filter(p => !isCampaignPayment(p) && !isAdmissionPayment(p) && !isMiscPayment(p));

      // 8. Déductions & ajouts
      const tuitionDiscount = Number(enrollmentRecord?.tuition_discount || 0);
      const studentDirectDiscount = Number(studentRecord?.discount_amount || 0);
      const totalDiscount = tuitionDiscount + studentDirectDiscount;
      const tuitionAddition = Number(enrollmentRecord?.tuition_addition || 0);

      // 9. Calcul précis par catégorie via le moteur universel (computeFeeCategoryBalance)
      // Empêche toute résurgence de fausses dettes quand le taux de change a augmenté ultérieurement
      const admHTG = plan ? (isReenrolled ? Number(plan.reenrollment_fee || 0) : Number(plan.inscription_fee || 0)) : 0;
      const admUSD = plan ? (isReenrolled ? Number(plan.reenrollment_fee_usd || 0) : Number(plan.inscription_fee_usd || 0)) : 0;
      const admissionBalance = computeFeeCategoryBalance(admHTG, admUSD, admissionPayments, exchangeRate);

      const mHTG = (plan && plan.is_misc_mandatory) ? Number(plan.misc_fee_htg || 0) : 0;
      const mUSD = (plan && plan.is_misc_mandatory) ? Number(plan.misc_fee_usd || 0) : 0;
      const miscBalance = computeFeeCategoryBalance(mHTG, mUSD, miscPayments, exchangeRate);

      const tHTG = plan ? (Number(plan.tuition_fee || 0) + tuitionAddition) : tuitionAddition;
      const tUSD = plan ? Number(plan.tuition_fee_usd || 0) : 0;
      const tuitionBalance = computeFeeCategoryBalance(tHTG, tUSD, tuitionPayments, exchangeRate, totalDiscount);

      // Campagnes ad-hoc applicables
      let adHocTotalExpected = 0;
      let adHocPaid = 0;
      let adHocRemaining = 0;

      (adHocRes.data || []).forEach((fee: any) => {
        if (!targetYearId || fee.campaign?.academic_year_id === targetYearId) {
          const cAmt = fee.custom_amount !== null && fee.custom_amount !== undefined
            ? Number(fee.custom_amount)
            : Number(fee.campaign?.amount || 0);
          const cCurr = String(fee.campaign?.currency || 'HTG').toUpperCase();
          const plannedHTG = cCurr === 'USD' ? 0 : cAmt;
          const plannedUSD = cCurr === 'USD' ? cAmt : 0;

          const campPayments = validPayments.filter(p => p.ad_hoc_campaign_id === fee.campaign?.id);
          const campBal = computeFeeCategoryBalance(plannedHTG, plannedUSD, campPayments, exchangeRate);

          adHocTotalExpected += campBal.effectiveDueHTG;
          adHocPaid += campBal.paidHTGEquiv;
          adHocRemaining += campBal.remainingHTGEquiv;
        }
      });

      // 10. Synthèse consolidée multi-catégories
      const totalExpected = admissionBalance.effectiveDueHTG + miscBalance.effectiveDueHTG + tuitionBalance.effectiveDueHTG + adHocTotalExpected;
      const totalPaid = admissionBalance.paidHTGEquiv + miscBalance.paidHTGEquiv + tuitionBalance.paidHTGEquiv + adHocPaid;
      const netDue = totalExpected;
      const remainingBalance = admissionBalance.remainingHTGEquiv + miscBalance.remainingHTGEquiv + tuitionBalance.remainingHTGEquiv + adHocRemaining;

      const coveragePercentage = netDue > 0 
        ? Math.min(100, Math.round((totalPaid / netDue) * 100)) 
        : (totalPaid > 0 ? 100 : 100);

      let solvencyStatus: 'SOLVED' | 'PARTIAL' | 'UNPAID' = 'UNPAID';
      if (remainingBalance === 0 && (totalPaid > 0 || netDue === 0)) {
        solvencyStatus = 'SOLVED';
      } else if (totalPaid > 0 && remainingBalance > 0) {
        solvencyStatus = 'PARTIAL';
      } else {
        solvencyStatus = 'UNPAID';
      }

      setData({
        totalExpected,
        totalDiscount,
        netDue,
        totalPaid,
        remainingBalance,
        coveragePercentage,
        solvencyStatus,
        paymentsCount: validPayments.length,
        lastPaymentDate,
        lastPaymentAmount,
        academicYearLabel: targetYearLabel,
        exchangeRate
      });
    } catch (err: any) {
      console.error("Erreur calcul solvabilité en temps réel:", err);
      setError("Impossible d'auditer la solvabilité financière en temps réel.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [studentId, schoolId, classId, academicYearId]);

  useEffect(() => {
    calculateSolvency();
  }, [calculateSolvency]);

  if (loading) {
    return (
      <div className={`bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs space-y-4 animate-pulse ${className}`}>
        <div className="flex justify-between items-center">
          <div className="h-4 w-32 bg-slate-200 rounded" />
          <div className="h-5 w-20 bg-slate-200 rounded-full" />
        </div>
        <div className="h-10 w-44 bg-slate-200 rounded" />
        <div className="h-2 w-full bg-slate-100 rounded-full" />
        <div className="grid grid-cols-2 gap-2 pt-2">
          <div className="h-8 bg-slate-100 rounded" />
          <div className="h-8 bg-slate-100 rounded" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={`bg-white rounded-2xl p-4 border border-rose-200 bg-rose-50/30 text-xs text-rose-700 space-y-2 ${className}`}>
        <div className="flex items-center gap-2 font-bold">
          <AlertCircle size={15} className="text-rose-600" />
          <span>Audit de solvabilité indisponible</span>
        </div>
        <p className="text-[11px] text-slate-600">{error || "Erreur de connexion comptable."}</p>
        <button
          onClick={() => calculateSolvency()}
          className="text-indigo-600 font-bold hover:underline inline-flex items-center gap-1 text-[11px]"
        >
          <RefreshCw size={11} /> Réessayer
        </button>
      </div>
    );
  }

  const isSolved = data.solvencyStatus === 'SOLVED';
  const isPartial = data.solvencyStatus === 'PARTIAL';

  return (
    <div className={`bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden transition-all duration-200 ${className}`}>
      {/* Header avec statut certifié */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold shrink-0 border ${
            isSolved 
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80' 
              : isPartial 
              ? 'bg-amber-50 text-amber-700 border-amber-200/80' 
              : 'bg-rose-50 text-rose-700 border-rose-200/80'
          }`}>
            <CreditCard size={18} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="font-bold text-slate-900 text-sm tracking-tight leading-none">
                Solvabilité Financière
              </h3>
              <button
                onClick={() => calculateSolvency(true)}
                disabled={refreshing}
                title="Recalculer en temps réel"
                className="text-slate-400 hover:text-indigo-600 p-0.5 rounded transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw size={12} className={refreshing ? 'animate-spin text-indigo-600' : ''} />
              </button>
            </div>
            <p className="text-[10px] text-slate-400 font-medium mt-1">
              Audit comptable certifié • {data.academicYearLabel}
            </p>
          </div>
        </div>

        {/* Badge officiel de Solvabilité */}
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-extrabold tracking-wide uppercase border shrink-0 ${
          isSolved
            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
            : isPartial
            ? 'bg-amber-50 text-amber-900 border-amber-300'
            : 'bg-rose-50 text-rose-800 border-rose-300'
        }`}>
          {isSolved ? (
            <>
              <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />
              <span>À jour (100%)</span>
            </>
          ) : isPartial ? (
            <>
              <Clock size={12} className="text-amber-600 shrink-0" />
              <span>Reliquat ({data.coveragePercentage}%)</span>
            </>
          ) : (
            <>
              <AlertCircle size={12} className="text-rose-600 shrink-0" />
              <span>Attente Paiement</span>
            </>
          )}
        </span>
      </div>

      {/* Metric principale : Reste à Payer */}
      <div className="p-4 sm:p-5 space-y-4">
        <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/70">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">
              Reste à Payer (Solde Dû)
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              {data.paymentsCount} versement(s)
            </span>
          </div>

          <div className="flex items-baseline gap-2">
            <span className={`text-2xl sm:text-3xl font-black font-mono tracking-tight ${
              isSolved ? 'text-emerald-600' : 'text-slate-900'
            }`}>
              {data.remainingBalance.toLocaleString()}
            </span>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">HTG</span>
            {isSolved && (
              <span className="ml-auto text-[10px] font-extrabold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md border border-emerald-200 uppercase">
                Compte Soldé
              </span>
            )}
          </div>

          {/* Jauge de couverture financière */}
          <div className="mt-3 space-y-1.5">
            <div className="flex justify-between items-center text-[10px] font-semibold text-slate-600">
              <span>Recouvrement : {data.coveragePercentage}%</span>
              <span className="font-mono text-slate-500">
                {data.totalPaid.toLocaleString()} / {data.netDue.toLocaleString()} HTG
              </span>
            </div>
            <div className="w-full h-2 bg-slate-200/80 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 rounded-full ${
                  isSolved ? 'bg-emerald-500' : isPartial ? 'bg-indigo-600' : 'bg-rose-500'
                }`}
                style={{ width: `${Math.min(100, Math.max(data.coveragePercentage, isSolved ? 100 : 0))}%` }}
              />
            </div>
          </div>
        </div>

        {/* Détails ventilés compacts */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
            <p className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">Total Net Exigé</p>
            <p className="font-mono font-bold text-slate-800 text-sm mt-0.5">
              {data.netDue.toLocaleString()} <span className="text-[10px] font-normal text-slate-500">HTG</span>
            </p>
            {data.totalDiscount > 0 && (
              <p className="text-[9px] text-emerald-600 font-semibold mt-0.5 flex items-center gap-1">
                <Award size={10} /> Bourse: -{data.totalDiscount.toLocaleString()} G
              </p>
            )}
          </div>

          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
            <p className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">Total Encaissé</p>
            <p className="font-mono font-bold text-emerald-700 text-sm mt-0.5">
              +{data.totalPaid.toLocaleString()} <span className="text-[10px] font-normal text-emerald-600">HTG</span>
            </p>
            {data.lastPaymentDate && (
              <p className="text-[9px] text-slate-400 truncate mt-0.5">
                Dernier: {new Date(data.lastPaymentDate).toLocaleDateString('fr-FR')}
              </p>
            )}
          </div>
        </div>

        {/* Liens d'action rapide */}
        <div className="pt-2 flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={() => navigate(`/economat/frais?studentId=${studentId}`, { state: { studentId, academicYearId: resolvedYearId || academicYearId } })}
            className="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Receipt size={13} />
            <span>Nouveau Versement</span>
          </button>

          <button
            type="button"
            onClick={() => navigate(`/economat/releves?studentId=${studentId}`, { state: { studentId, academicYearId: resolvedYearId || academicYearId } })}
            className="py-2 px-3 bg-slate-100 hover:bg-slate-200 active:scale-[0.98] text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer border border-slate-200/60"
            title="Consulter le relevé de compte certifié"
          >
            <span>Relevé</span>
            <ChevronRight size={13} className="text-slate-400" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default StudentSolvencySummary;
