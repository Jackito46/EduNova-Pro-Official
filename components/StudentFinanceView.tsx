import React, { useState, useEffect, useCallback } from 'react';
import { UserProfile } from '../types';
import { useStudent } from '../hooks/useStudent';
import { supabase } from '../supabase';
import { useSchool } from '../contexts/SchoolContext';
import { 
  Receipt, 
  AlertCircle, 
  FileText, 
  Target, 
  Sparkles, 
  Layers, 
  Calendar, 
  Info, 
  ArrowRightLeft,
  HelpCircle,
  Clock,
  CheckCircle2,
  Wallet,
  ShieldCheck,
  Coins,
  Smartphone,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { computeFeeCategoryBalance, getFormattedFeeRowDetails } from '../utils/financeCalculations';
import { StudentWalletTopUpModal } from './StudentWalletTopUpModal';
import { isPaymentCompleted } from '../src/utils/payment';
import { sendPaymentConfirmationSms } from '../services/paymentSmsService';

interface StudentFinanceViewProps {
  user: UserProfile;
}

export const StudentFinanceView: React.FC<StudentFinanceViewProps> = ({ user }) => {
  const { school } = useSchool();
  const isMultiCurrency = Boolean(school?.global_settings?.multi_currency_enabled);
  const { studentData, activeYear, loading: studentLoading } = useStudent(user);
  const [payments, setPayments] = useState<any[]>([]);
  const [feePlan, setFeePlan] = useState<any>(null);
  const [adHocCampaigns, setAdHocCampaigns] = useState<any[]>([]);
  const [exchangeRate, setExchangeRate] = useState<number>(135.0);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<'all' | 'tuition' | 'misc' | 'campaigns'>('all');
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [showWalletTopUpModal, setShowWalletTopUpModal] = useState<boolean>(false);

  useEffect(() => {
    if (studentData?.wallet_balance_htg !== undefined) {
      setWalletBalance(studentData.wallet_balance_htg || 0);
    }
  }, [studentData]);

  // Détection automatique du retour de redirection Digicel MonCash / Natcom NatCash (ex: /#/mon-economat?payment=success&ref=TRZ-...)
  useEffect(() => {
    const handleUrlPaymentReturn = async () => {
      const hash = window.location.hash || '';
      const search = window.location.search || '';
      const fullUrl = hash + search;

      if (fullUrl.includes('payment=success')) {
        const queryPart = hash.includes('?') ? hash.split('?')[1] : search.replace(/^\?/, '');
        const params = new URLSearchParams(queryPart);
        const ref = params.get('ref') || params.get('order_id') || params.get('transaction_id');
        const amount = Number(params.get('amount')) || 100;
        const rawOperator = (params.get('operator') || 'moncash').toLowerCase();
        const operatorLabel = rawOperator.includes('natcash') ? 'Natcom NatCash' : 'Digicel MonCash';

        if (ref) {
          toast.loading(`Confirmation de votre dépôt Tranzak (${operatorLabel}) en cours...`, { id: 'trz-confirm' });
          try {
            const res = await fetch(`/api/tranzak/verify-payment/${encodeURIComponent(ref)}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                school_id: school?.id || studentData?.school_id || user.school_id,
                student_id: studentData?.id,
                amount: amount
              })
            });
            await res.json().catch(() => ({}));

            let finalBal = walletBalance + amount;
            if (studentData?.id) {
              const { data: st } = await supabase
                .from('students')
                .select('wallet_balance_htg')
                .eq('id', studentData.id)
                .maybeSingle();
              if (st?.wallet_balance_htg !== undefined) {
                finalBal = st.wallet_balance_htg;
                setWalletBalance(st.wallet_balance_htg);
              }
              const { data: pList } = await supabase
                .from('payments')
                .select('*, campaign:ad_hoc_campaigns(id, name, currency, amount)')
                .eq('student_id', studentData.id)
                .order('created_at', { ascending: false });
              if (pList) setPayments(pList);

              // Envoi automatique du SMS de confirmation au parent
              if (studentData.parent_phone) {
                sendPaymentConfirmationSms({
                  schoolId: school?.id || studentData.school_id || user.school_id,
                  studentId: studentData.id,
                  studentName: `${studentData.first_name} ${studentData.last_name}`,
                  studentClass: studentData.class_name,
                  parentName: studentData.parent_name || 'Parent',
                  parentPhone: studentData.parent_phone,
                  amount: amount,
                  currency: 'HTG',
                  feeTypeLabel: `Recharge Portefeuille (${operatorLabel})`,
                  transactionRef: ref,
                  schoolName: school?.name || 'Collège des Innovations',
                  remainingAmount: 0,
                  paymentMethod: `Tranzak ${operatorLabel}`
                }).catch(console.warn);
              }
            }

            toast.success(`Dépôt Tranzak ${operatorLabel} validé ! +${amount.toLocaleString()} HTG crédités au portefeuille de ${studentData?.first_name || 'l\'élève'}.`, { id: 'trz-confirm' });
          } catch (e) {
            toast.dismiss('trz-confirm');
          } finally {
            window.history.replaceState({}, document.title, window.location.pathname + '#/mon-economat');
          }
        }
      }
    };

    handleUrlPaymentReturn();
  }, [studentData?.id, studentData?.first_name, studentData?.last_name, studentData?.parent_phone, studentData?.parent_name, studentData?.class_name, school?.id, school?.name, user.school_id, walletBalance]);

  useEffect(() => {
    const fetchFinances = async () => {
      if (!studentData?.id || !activeYear) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        // Exécution en parallèle haute performance de toutes les requêtes financières de l'élève
        const [
          { data: rateRes },
          { data: planData },
          { data: paymentsData, error: paymentsErr },
          { data: campaignData, error: campaignErr }
        ] = await Promise.all([
          supabase
            .from('exchange_rates')
            .select('*')
            .eq('school_id', user.school_id)
            .order('effective_date', { ascending: false })
            .limit(1),
          supabase
            .from('fee_plans')
            .select('*')
            .eq('class_id', studentData.class_id)
            .eq('academic_year_id', activeYear.id)
            .maybeSingle(),
          supabase
            .from('payments')
            .select('*, campaign:ad_hoc_campaigns(id, name, currency, amount)')
            .eq('student_id', studentData.id)
            .order('created_at', { ascending: false }),
          supabase
            .from('student_ad_hoc_fees')
            .select(`
              id,
              custom_amount,
              adjustment_reason,
              campaign:ad_hoc_campaigns!campaign_id(id, name, amount, currency, status, due_date, type, academic_year_id)
            `)
            .eq('student_id', studentData.id)
        ]);

        const currentRate = Number(rateRes?.[0]?.rate_usd_to_htg || rateRes?.[0]?.rate || 135.0);
        setExchangeRate(currentRate);
        setFeePlan(planData);

        if (paymentsErr) {
          console.error("Erreur chargement payments dans StudentFinanceView:", paymentsErr);
        }

        const validSessionPayments = (paymentsData || []).filter((p: any) => {
          if (!activeYear?.id) return true;
          return !p.academic_year_id || p.academic_year_id === activeYear.id;
        });

        setPayments(validSessionPayments);

        if (campaignErr) {
          console.error("Error fetching student campaigns: ", campaignErr);
        } else if (campaignData) {
          const studentCamps = campaignData
            .map((fee: any) => {
              if (!fee.campaign) return null;
              return {
                ...fee.campaign,
                custom_amount: fee.custom_amount,
                adjustment_reason: fee.adjustment_reason,
                fee_id: fee.id
              };
            })
            .filter((c: any) => c !== null && (!c.academic_year_id || c.academic_year_id === activeYear.id));
          
          setAdHocCampaigns(studentCamps);
        }

        // Rafraîchir le solde du portefeuille élève en direct depuis la base
        const { data: latestStudent } = await supabase
          .from('students')
          .select('wallet_balance_htg')
          .eq('id', studentData.id)
          .maybeSingle();

        if (latestStudent && latestStudent.wallet_balance_htg !== undefined) {
          setWalletBalance(latestStudent.wallet_balance_htg || 0);
        }

      } catch (err) {
        console.error("Error fetching finances: ", err);
      } finally {
        setLoading(false);
      }
    };
    fetchFinances();
  }, [studentData, activeYear, user.school_id]);


  if (studentLoading || loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin text-blue-600 rounded-full border-2 border-slate-200 border-t-blue-600 w-8 h-8"></div>
      </div>
    );
  }

  if (!studentData) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl shadow-sm border border-slate-100 mt-8">
        <AlertCircle className="mx-auto h-12 w-12 text-slate-400 mb-3" />
        <h2 className="text-xl font-bold text-slate-700">Dossier introuvable</h2>
      </div>
    );
  }

  const validPayments = payments.filter(isPaymentCompleted);

  // Classification des versements
  const isAdmissionPayment = (p: any) => {
    const feeType = (p.fee_type || '').toLowerCase();
    const nature = (p.nature || '').toLowerCase();
    const desc = (p.description || '').toLowerCase();
    return (
      feeType.includes('inscri') ||
      feeType.includes('admiss') ||
      nature.includes('inscri') ||
      nature.includes('admiss') ||
      nature.includes('entrée') ||
      nature.includes('entree') ||
      desc.includes('inscri') ||
      desc.includes('admiss')
    );
  };

  const isMiscPayment = (p: any) => {
    const feeType = (p.fee_type || '').toLowerCase();
    const nature = (p.nature || '').toLowerCase();
    const desc = (p.description || '').toLowerCase();
    return (
      feeType.includes('divers') ||
      feeType.includes('misc') ||
      nature.includes('divers') ||
      nature.includes('misc') ||
      desc.includes('frais divers') ||
      desc.includes('misc')
    );
  };

  const isCampPmt = (p: any) => Boolean(
    p.ad_hoc_campaign_id || 
    p.fee_type === 'AD_HOC' || 
    p.campaign?.id || 
    adHocCampaigns.some((c: any) => {
      const campName = (c.name || '').toLowerCase();
      const nat = (p.nature || p.label || p.type || '').toLowerCase();
      return (campName && nat && (nat.includes(campName) || (campName.includes('assurance') && nat.includes('assurance'))));
    })
  );

  const admissionPayments = validPayments.filter(p => !isCampPmt(p) && isAdmissionPayment(p));
  const miscPayments = validPayments.filter(p => !isCampPmt(p) && !isAdmissionPayment(p) && isMiscPayment(p));
  const campaignPayments = validPayments.filter(p => isCampPmt(p));
  const tuitionPayments = validPayments.filter(p => !isCampPmt(p) && !isAdmissionPayment(p) && !isMiscPayment(p));

  // Frais prévus
  const admissionNativeHTG = Number(feePlan?.inscription_fee || 0);
  const admissionNativeUSD = Number(feePlan?.inscription_fee_usd || 0);

  const baseTuitionFee = Number(feePlan?.tuition_fee || 85000);
  const tuitionNativeUSD = Number(feePlan?.tuition_fee_usd || 0);
  const tuitionNativeHTG = studentData.is_foreign && feePlan?.foreign_tuition_fee 
    ? Number(feePlan.foreign_tuition_fee) 
    : baseTuitionFee;

  const hasMiscFee = feePlan?.is_misc_mandatory || Number(feePlan?.misc_fee_usd || 0) > 0 || Number(feePlan?.misc_fee_htg || 0) > 0;
  const miscNativeHTG = Number(feePlan?.misc_fee_htg || 0);
  const miscNativeUSD = Number(feePlan?.misc_fee_usd || 0);

  // Remises
  const totalDiscount = Number(studentData.discount_amount || 0);

  // Calculs via le moteur financier unifié multi-devises
  const admissionDetails = getFormattedFeeRowDetails(admissionNativeHTG, admissionNativeUSD, admissionPayments, exchangeRate, 0);
  const tuitionDetails = getFormattedFeeRowDetails(tuitionNativeHTG, tuitionNativeUSD, tuitionPayments, exchangeRate, totalDiscount);
  const miscDetails = getFormattedFeeRowDetails(miscNativeHTG, miscNativeUSD, miscPayments, exchangeRate, 0);

  // Campagnes ad-hoc
  const campaignBreakdowns = adHocCampaigns.map(camp => {
    const campPayments = payments.filter((p: any) => {
      if (!isPaymentCompleted(p)) return false;
      if (p.ad_hoc_campaign_id === camp.id) return true;
      if (p.campaign?.id === camp.id) return true;
      const campName = (camp.name || '').toLowerCase();
      const nat = (p.nature || p.label || p.type || '').toLowerCase();
      if (campName && nat && (nat.includes(campName) || (campName.includes('assurance') && nat.includes('assurance')))) return true;
      return false;
    });
    const rawAmount = camp.custom_amount !== null && camp.custom_amount !== undefined ? Number(camp.custom_amount) : Number(camp.amount);
    const isUSD = camp.currency === 'USD';
    const campHTG = isUSD ? 0 : rawAmount;
    const campUSD = isUSD ? rawAmount : 0;
    const details = getFormattedFeeRowDetails(campHTG, campUSD, campPayments, exchangeRate, 0);
    return {
      camp,
      details,
      payments: campPayments,
      isCustomized: camp.custom_amount !== null && camp.custom_amount !== undefined
    };
  });

  // Calcul des totaux
  const campaignsExpectedHTG = campaignBreakdowns.reduce((acc, c) => acc + c.details.effectiveDueHTG, 0);
  const campaignsPaidHTG = campaignBreakdowns.reduce((acc, c) => acc + c.details.paidHTGEquiv, 0);
  const campaignsRemainingHTG = campaignBreakdowns.reduce((acc, c) => acc + c.details.remainingHTG, 0);

  const grandTotalExpected = admissionDetails.effectiveDueHTG + 
    tuitionDetails.effectiveDueHTG + 
    (hasMiscFee ? miscDetails.effectiveDueHTG : 0) + 
    campaignsExpectedHTG;

  const grandTotalPaid = admissionDetails.paidHTGEquiv + 
    tuitionDetails.paidHTGEquiv + 
    (hasMiscFee ? miscDetails.paidHTGEquiv : 0) + 
    campaignsPaidHTG;

  const grandTotalBalance = admissionDetails.remainingHTG + 
    tuitionDetails.remainingHTG + 
    (hasMiscFee ? miscDetails.remainingHTG : 0) + 
    campaignsRemainingHTG;

  const campaignsRemainingUSD = campaignBreakdowns.reduce((acc, c) => acc + (c.details.isPaid ? 0 : c.details.remainingUSD), 0);
  const grandTotalRemainingUSD = (admissionDetails.isPaid ? 0 : admissionDetails.remainingUSD) +
    (tuitionDetails.isPaid ? 0 : tuitionDetails.remainingUSD) +
    (hasMiscFee && !miscDetails.isPaid ? miscDetails.remainingUSD : 0) +
    campaignsRemainingUSD;

  const grandTotalRemainingHTG = (admissionDetails.isPaid ? 0 : admissionDetails.remainingHTG) +
    (tuitionDetails.isPaid ? 0 : tuitionDetails.remainingHTG) +
    (hasMiscFee && !miscDetails.isPaid ? miscDetails.remainingHTG : 0) +
    campaignsRemainingHTG;

  // Filtrage selon onglet
  const displayedExpected = activeSection === 'all' 
    ? grandTotalExpected 
    : activeSection === 'tuition' 
    ? (tuitionDetails.effectiveDueHTG + admissionDetails.effectiveDueHTG) 
    : activeSection === 'misc'
    ? miscDetails.effectiveDueHTG
    : campaignsExpectedHTG;

  const displayedPaid = activeSection === 'all' 
    ? grandTotalPaid 
    : activeSection === 'tuition' 
    ? (tuitionDetails.paidHTGEquiv + admissionDetails.paidHTGEquiv) 
    : activeSection === 'misc'
    ? miscDetails.paidHTGEquiv
    : campaignsPaidHTG;

  const displayedBalance = activeSection === 'all' 
    ? grandTotalBalance 
    : activeSection === 'tuition' 
    ? (tuitionDetails.remainingHTG + admissionDetails.remainingHTG) 
    : activeSection === 'misc'
    ? miscDetails.remainingHTG
    : campaignsRemainingHTG;

  const displayedRemainingUSD = activeSection === 'all'
    ? grandTotalRemainingUSD
    : activeSection === 'tuition'
    ? ((tuitionDetails.isPaid ? 0 : tuitionDetails.remainingUSD) + (admissionDetails.isPaid ? 0 : admissionDetails.remainingUSD))
    : activeSection === 'misc'
    ? (miscDetails.isPaid ? 0 : miscDetails.remainingUSD)
    : campaignsRemainingUSD;

  const displayedRemainingHTG = activeSection === 'all'
    ? grandTotalRemainingHTG
    : activeSection === 'tuition'
    ? ((tuitionDetails.isPaid ? 0 : tuitionDetails.remainingHTG) + (admissionDetails.isPaid ? 0 : admissionDetails.remainingHTG))
    : activeSection === 'misc'
    ? (miscDetails.isPaid ? 0 : miscDetails.remainingHTG)
    : campaignsRemainingHTG;

  const displayedPayments = payments.filter(p => {
    if (activeSection === 'tuition') return !p.ad_hoc_campaign_id && !isMiscPayment(p);
    if (activeSection === 'misc') return !p.ad_hoc_campaign_id && isMiscPayment(p);
    if (activeSection === 'campaigns') return !!p.ad_hoc_campaign_id;
    return true;
  });

  return (
    <div className="max-w-5xl mx-auto space-y-3.5 sm:space-y-4 pb-8 animate-in fade-in duration-200">
      {/* Header Compact */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 pb-1 border-b border-slate-200/60">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200 shrink-0">
            <Receipt size={17} />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">Mon Économat</h1>
            <p className="text-[11px] font-medium text-slate-500 flex items-center gap-1.5 flex-wrap">
              <span>Année académique : <strong className="text-slate-800">{activeYear?.label || '--'}</strong></span>
              {isMultiCurrency && (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="text-indigo-700 font-mono font-bold bg-indigo-50 px-1.5 py-0.2 rounded text-[10.5px] border border-indigo-100">
                    Taux du jour : 1 USD = {exchangeRate} HTG
                  </span>
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Bannière Portefeuille Numérique de l'Élève & Renflouement en Ligne */}
      <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 border border-emerald-200/90 rounded-2xl p-3 sm:p-3.5 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
            <Wallet size={20} />
          </div>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wider">
                Portefeuille Numérique
              </span>
              <span className="text-[10px] bg-emerald-100/90 text-emerald-800 font-bold px-1.5 py-0.2 rounded-md">
                Solde Disponible
              </span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono flex items-baseline gap-1">
              {(walletBalance || 0).toLocaleString()} <span className="text-xs font-bold text-slate-500">HTG</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          <button
            type="button"
            onClick={() => setShowWalletTopUpModal(true)}
            className="flex-1 sm:flex-none px-4 py-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
            title="Recharger le portefeuille de l'élève en ligne via MonCash / Natcash / Tranzak"
          >
            <Smartphone size={14} />
            <span>Renflouer mon Portefeuille</span>
          </button>
        </div>
      </div>

      {/* Tabs Selector Compact */}
      <div className="flex bg-slate-100/90 p-0.5 rounded-xl max-w-md shadow-2xs border border-slate-200/80 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveSection('all')}
          className={`flex-1 py-1.5 px-2.5 rounded-lg font-bold text-xs transition-all whitespace-nowrap cursor-pointer ${
            activeSection === 'all'
              ? 'bg-white text-slate-950 shadow-xs border border-slate-200/60'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Vue d'ensemble
        </button>
        <button
          type="button"
          onClick={() => setActiveSection('tuition')}
          className={`flex-1 py-1.5 px-2.5 rounded-lg font-bold text-xs transition-all whitespace-nowrap cursor-pointer ${
            activeSection === 'tuition'
              ? 'bg-white text-slate-950 shadow-xs border border-slate-200/60'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Scolarité
        </button>
        {hasMiscFee && (
          <button
            type="button"
            onClick={() => setActiveSection('misc')}
            className={`flex-1 py-1.5 px-2.5 rounded-lg font-bold text-xs transition-all whitespace-nowrap cursor-pointer ${
              activeSection === 'misc'
                ? 'bg-white text-slate-950 shadow-xs border border-slate-200/60'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Frais Divers
          </button>
        )}
        {(adHocCampaigns.length > 0 || campaignPayments.length > 0) && (
          <button
            type="button"
            onClick={() => setActiveSection('campaigns')}
            className={`flex-1 py-1.5 px-2.5 rounded-lg font-bold text-xs transition-all whitespace-nowrap relative cursor-pointer ${
              activeSection === 'campaigns'
                ? 'bg-white text-slate-950 shadow-xs border border-slate-200/60'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Campagnes
            {adHocCampaigns.length > 0 && (
              <span className="ml-1 bg-blue-600 text-white font-black text-[9px] px-1.5 py-0.2 rounded-full">
                {adHocCampaigns.length}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Financial Overview Cards Compact */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 animate-in fade-in duration-200">
        <div className="bg-white rounded-2xl p-3 sm:p-3.5 border border-slate-200/80 shadow-2xs flex flex-col items-center justify-center text-center">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
            {activeSection === 'all' ? 'Obligation Totale' : activeSection === 'tuition' ? 'Scolarité & Admission' : activeSection === 'misc' ? 'Frais Divers' : 'Frais de Campagnes'}
          </span>
          <span className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
            {Math.round(displayedExpected).toLocaleString()} <span className="text-xs font-sans text-slate-500">HTG</span>
          </span>
          {activeSection === 'tuition' && totalDiscount > 0 && (
            <span className="text-[9.5px] text-emerald-700 font-bold mt-1 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-100">
              Réduction de {totalDiscount.toLocaleString()} HTG incluse
            </span>
          )}
        </div>

        <div className="bg-white rounded-2xl p-3 sm:p-3.5 border border-slate-200/80 shadow-2xs flex flex-col items-center justify-center text-center border-b-2 sm:border-b-4 border-b-emerald-500 relative overflow-hidden">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Déjà Versé</span>
          <span className="text-xl sm:text-2xl font-black text-emerald-600 font-mono">
            {Math.round(displayedPaid).toLocaleString()} <span className="text-xs font-sans text-emerald-500">HTG</span>
          </span>
        </div>

        <div className={`bg-white rounded-2xl p-3 sm:p-3.5 border border-slate-200/80 shadow-2xs flex flex-col items-center justify-center text-center border-b-2 sm:border-b-4 ${displayedBalance <= 0 ? 'border-b-blue-500' : 'border-b-rose-500'}`}>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Solde Restant</span>
          {displayedBalance <= 0 ? (
            <span className="text-xl sm:text-2xl font-black font-mono text-blue-600">Réglé (À Jour)</span>
          ) : displayedRemainingUSD > 0 && displayedRemainingHTG > 0 ? (
            <div className="space-y-0.5">
              <span className="text-base sm:text-lg font-black font-mono text-rose-600 block">
                {Math.round(displayedRemainingHTG).toLocaleString()} HTG + ${displayedRemainingUSD.toFixed(2)} USD
              </span>
              <span className="text-[10px] text-slate-400 font-mono block">
                (≈ {Math.round(displayedBalance).toLocaleString()} HTG)
              </span>
            </div>
          ) : displayedRemainingUSD > 0 ? (
            <div className="space-y-0.5">
              <span className="text-xl sm:text-2xl font-black font-mono text-rose-600 block">
                ${displayedRemainingUSD.toFixed(2)} USD
              </span>
              <span className="text-[10px] text-slate-400 font-mono block">
                (≈ {Math.round(displayedBalance).toLocaleString()} HTG)
              </span>
            </div>
          ) : (
            <span className="text-xl sm:text-2xl font-black font-mono text-rose-600">
              {Math.round(displayedBalance).toLocaleString()} HTG
            </span>
          )}
        </div>
      </div>

      {/* Detailed Fee Cards */}
      {(activeSection === 'all' || activeSection === 'tuition' || activeSection === 'misc') && (
        <div className="space-y-2.5 sm:space-y-3">
          <div className="flex items-center gap-2">
            <FileText size={15} className="text-indigo-600" />
            <h2 className="text-xs sm:text-sm font-black text-slate-900">Grille Tarifaire des Frais Scolaires</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Admission Fee Card */}
            {(activeSection === 'all' || activeSection === 'tuition') && (
              <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200/90 p-3.5 sm:p-4 shadow-2xs flex flex-col justify-between hover:border-slate-300 transition-colors">
                <div>
                  <div className="border-b border-slate-100 pb-2 flex items-center justify-between mb-2">
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-tight">Admission / Inscription</h3>
                    <span className="text-[9.5px] font-bold uppercase text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-100">
                      Fixe
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-start text-xs">
                      <span className="text-slate-400">Montant Requis</span>
                      <div className="text-right font-mono">
                        <span className="font-bold text-slate-800 block">{admissionDetails.plannedNative}</span>
                        {admissionDetails.plannedEquiv && <span className="text-[9.5px] text-slate-400 block">{admissionDetails.plannedEquiv}</span>}
                      </div>
                    </div>
                    <div className="flex justify-between items-start text-xs">
                      <span className="text-slate-400">Montant Versé</span>
                      <div className="text-right font-mono">
                        <span className="font-bold text-emerald-600 block">{admissionDetails.paidNative}</span>
                        {admissionDetails.paidEquiv && <span className="text-[9.5px] text-emerald-500 block">{admissionDetails.paidEquiv}</span>}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-2 mt-2 flex justify-between items-center text-xs font-bold font-mono">
                  <span className="text-slate-600 font-sans text-[11px]">Reste à payer</span>
                  <div className="text-right">
                    <span className={admissionDetails.isPaid ? 'text-emerald-600' : 'text-rose-600'}>
                      {admissionDetails.remainingNative}
                    </span>
                    {!admissionDetails.isPaid && admissionDetails.remainingEquiv && (
                      <span className="text-[9.5px] text-rose-400 block">{admissionDetails.remainingEquiv}</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Tuition Fee Card */}
            {(activeSection === 'all' || activeSection === 'tuition') && (
              <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200/90 p-3.5 sm:p-4 shadow-2xs flex flex-col justify-between hover:border-slate-300 transition-colors">
                <div>
                  <div className="border-b border-slate-100 pb-2 flex items-center justify-between mb-2">
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-tight">Scolarité (Écolage)</h3>
                    <span className="text-[9.5px] font-bold uppercase text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-100">
                      Académique
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-start text-xs">
                      <span className="text-slate-400">Montant Exigé</span>
                      <div className="text-right font-mono">
                        <span className="font-bold text-slate-800 block">{tuitionDetails.plannedNative}</span>
                        {tuitionDetails.plannedEquiv && <span className="text-[9.5px] text-slate-400 block">{tuitionDetails.plannedEquiv}</span>}
                      </div>
                    </div>
                    <div className="flex justify-between items-start text-xs">
                      <span className="text-slate-400">Montant Versé</span>
                      <div className="text-right font-mono">
                        <span className="font-bold text-emerald-600 block">{tuitionDetails.paidNative}</span>
                        {tuitionDetails.paidEquiv && <span className="text-[9.5px] text-emerald-500 block">{tuitionDetails.paidEquiv}</span>}
                      </div>
                    </div>
                    {totalDiscount > 0 && (
                      <div className="flex justify-between items-center text-[10.5px] text-emerald-700 bg-emerald-50 p-1.5 rounded-lg border border-emerald-100">
                        <span>Réduction accordée</span>
                        <span className="font-bold">-{totalDiscount.toLocaleString()} HTG</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-2 mt-2 flex justify-between items-center text-xs font-bold font-mono">
                  <span className="text-slate-600 font-sans text-[11px]">Reste à payer</span>
                  <div className="text-right">
                    <span className={tuitionDetails.isPaid ? 'text-emerald-600' : 'text-rose-600'}>
                      {tuitionDetails.remainingNative}
                    </span>
                    {!tuitionDetails.isPaid && tuitionDetails.remainingEquiv && (
                      <span className="text-[9.5px] text-rose-400 block">{tuitionDetails.remainingEquiv}</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Misc Fee Card (Frais Divers) */}
            {hasMiscFee && (activeSection === 'all' || activeSection === 'misc') && (
              <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200/90 p-3.5 sm:p-4 shadow-2xs flex flex-col justify-between hover:border-slate-300 transition-colors">
                <div>
                  <div className="border-b border-slate-100 pb-2 flex items-center justify-between mb-2">
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-tight">Frais Divers Obligatoires</h3>
                    <span className="text-[9.5px] font-bold uppercase text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-100">
                      Multi-Devises
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-start text-xs">
                      <span className="text-slate-400">Montant Requis</span>
                      <div className="text-right font-mono">
                        <span className="font-bold text-slate-800 block">{miscDetails.plannedNative}</span>
                        {miscDetails.plannedEquiv && <span className="text-[9.5px] text-slate-400 block">{miscDetails.plannedEquiv}</span>}
                      </div>
                    </div>
                    <div className="flex justify-between items-start text-xs">
                      <span className="text-slate-400">Montant Versé</span>
                      <div className="text-right font-mono">
                        <span className="font-bold text-emerald-600 block">{miscDetails.paidNative}</span>
                        {miscDetails.paidEquiv && <span className="text-[9.5px] text-emerald-500 block">{miscDetails.paidEquiv}</span>}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-2 mt-2 flex justify-between items-center text-xs font-bold font-mono">
                  <span className="text-slate-600 font-sans text-[11px]">Reste à payer</span>
                  <div className="text-right">
                    <span className={miscDetails.isPaid ? 'text-emerald-600' : 'text-rose-600'}>
                      {miscDetails.remainingNative}
                    </span>
                    {!miscDetails.isPaid && miscDetails.remainingEquiv && (
                      <span className="text-[9.5px] text-rose-400 block">{miscDetails.remainingEquiv}</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Ad-hoc Campaigns Section */}
      {(activeSection === 'all' || activeSection === 'campaigns') && campaignBreakdowns.length > 0 && (
        <div className="space-y-2.5 sm:space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles size={15} className="text-blue-600" />
            <h2 className="text-xs sm:text-sm font-black text-slate-900">Campagnes &amp; Activités Spéciales</h2>
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            {campaignBreakdowns.map(({ camp, details, isCustomized }) => (
              <div key={camp.id} className="bg-white rounded-xl sm:rounded-2xl border border-slate-200/90 p-3 sm:p-3.5 shadow-2xs flex flex-col md:flex-row justify-between items-start md:items-center gap-3 hover:border-slate-300 transition-colors">
                <div className="space-y-1 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[9.5px] font-black uppercase text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-100">
                      {camp.type || 'Frais Spéciaux'}
                    </span>
                    {isCustomized && (
                      <span className="text-[9.5px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-100 flex items-center gap-1">
                        <Sparkles size={9} />
                        Tarif Personnalisé
                      </span>
                    )}
                  </div>
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900">{camp.name}</h3>
                  {isCustomized && camp.adjustment_reason && (
                    <p className="text-[11px] text-slate-500 bg-slate-50 p-1.5 rounded-lg border border-slate-100 flex items-start gap-1 max-w-xl">
                      <Info size={11} className="text-slate-400 shrink-0 mt-0.5" />
                      <span><strong>Ajustement :</strong> {camp.adjustment_reason}</span>
                    </p>
                  )}
                  {camp.due_date && (
                    <p className="text-[10px] text-slate-400 flex items-center gap-1">
                      <Calendar size={11} />
                      Échéance : {new Date(camp.due_date).toLocaleDateString('fr-FR')}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 shrink-0 w-full md:w-auto justify-between md:justify-end items-center font-mono">
                  <div className="text-center px-2.5 py-1 bg-slate-50 rounded-xl border border-slate-100 min-w-[85px]">
                    <span className="block text-[8.5px] font-black text-slate-400 uppercase font-sans">Exigé</span>
                    <span className="text-xs font-bold text-slate-800 block">{details.plannedNative}</span>
                    {details.plannedEquiv && <span className="text-[8.5px] text-slate-400 block">{details.plannedEquiv}</span>}
                  </div>
                  <div className="text-center px-2.5 py-1 bg-emerald-50 rounded-xl border border-emerald-100 min-w-[85px]">
                    <span className="block text-[8.5px] font-black text-emerald-600 uppercase font-sans">Payé</span>
                    <span className="text-xs font-bold text-emerald-600 block">{details.paidNative}</span>
                    {details.paidEquiv && <span className="text-[8.5px] text-emerald-500 block">{details.paidEquiv}</span>}
                  </div>
                  <div className={`text-center px-2.5 py-1 rounded-xl border min-w-[85px] ${details.isPaid ? 'bg-blue-50 border-blue-100' : 'bg-rose-50 border-rose-100'}`}>
                    <span className="block text-[8.5px] font-black uppercase font-sans text-slate-400">Solde</span>
                    <span className={`text-xs font-bold block ${details.isPaid ? 'text-blue-600' : 'text-rose-600'}`}>
                      {details.remainingNative}
                    </span>
                    {!details.isPaid && details.remainingEquiv && (
                      <span className="text-[8.5px] text-rose-400 block">{details.remainingEquiv}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payments History Table Compact */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="p-3 sm:p-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div>
            <h2 className="text-xs sm:text-sm font-black text-slate-900">Historique des Paiements &amp; Versements</h2>
            <p className="text-[10.5px] text-slate-400 mt-0.5">
              Journal certifié avec détail du montant payé, taux de change et contrevaleur
            </p>
          </div>
          <span className="text-[10.5px] font-bold text-slate-600 bg-white px-2 py-0.5 rounded-md border border-slate-200">
            {displayedPayments.length} versement{displayedPayments.length > 1 ? 's' : ''}
          </span>
        </div>
        
        {displayedPayments.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs italic">
            Aucun versement enregistré pour cette catégorie de frais.
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-slate-50 text-slate-600 text-xs font-bold border-b border-slate-200 uppercase tracking-wider">
                  <th className="py-3.5 px-4 whitespace-nowrap">Date & Reçu #</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Libellé / Nature</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Méthode</th>
                  <th className="py-3.5 px-4 text-right whitespace-nowrap">Montant Payé</th>
                  <th className="py-3.5 px-4 text-center whitespace-nowrap">Taux Appliqué</th>
                  <th className="py-3.5 px-4 text-right whitespace-nowrap">Valeur Base (HTG)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {displayedPayments.map(payment => {
                  let displayNature = payment.nature || payment.type || payment.fee_type || 'Frais Divers';
                  if (payment.campaign?.name) {
                    displayNature = `Campagne: ${payment.campaign.name}`;
                  } else if (payment.ad_hoc_campaign_id) {
                    displayNature = 'Frais de Campagne';
                  } else if (payment.fee_type === 'SCOLARITE' || (!payment.fee_type && (!payment.nature || payment.nature === 'SCOLARITE' || payment.nature === 'Scolarité'))) {
                    displayNature = 'Frais Scolarité (Écolage)';
                  } else if (payment.fee_type === 'INSCRIPTION' || payment.nature === 'INSCRIPTION' || payment.nature === "Frais d'inscription") {
                    displayNature = "Frais d'inscription";
                  } else if (isMiscPayment(payment)) {
                    displayNature = "Frais Divers Obligatoires";
                  }

                  const isUSD = payment.currency === 'USD';
                  const rawAmount = Number(payment.amount || 0);
                  const appliedRate = Number(payment.exchange_rate_applied || (isUSD && payment.amount_htg_equivalent ? (payment.amount_htg_equivalent / rawAmount) : exchangeRate));
                  const baseHTG = Number(payment.amount_htg_equivalent || (isUSD ? rawAmount * appliedRate : rawAmount));

                  const isCamp = isCampPmt(payment);
                  const isTuitionFee = !isCamp && (payment.fee_type === 'SCOLARITE' || (!payment.fee_type && (!payment.nature || payment.nature === 'SCOLARITE' || payment.nature === 'Scolarité')));
                  const isAdmissionFee = !isCamp && (payment.fee_type === 'INSCRIPTION' || payment.nature === 'INSCRIPTION' || payment.nature === "Frais d'inscription");
                  const isMiscFee = !isCamp && isMiscPayment(payment);
                  const matchedCampaign = isCamp ? campaignBreakdowns.find(c => 
                    c.camp.id === payment.ad_hoc_campaign_id || 
                    c.camp.id === payment.campaign?.id ||
                    (c.camp.name && (payment.nature || payment.type || '').toLowerCase().includes(c.camp.name.toLowerCase())) ||
                    (c.camp.name && c.camp.name.toLowerCase().includes('assurance') && (payment.nature || payment.type || '').toLowerCase().includes('assurance'))
                  ) : null;
                  const isCampaignPlannedInUSD = Boolean(matchedCampaign && matchedCampaign.camp.currency === 'USD');
                  const isFeePlannedInUSD = Boolean(
                    (isTuitionFee && tuitionNativeUSD > 0) ||
                    (isAdmissionFee && admissionNativeUSD > 0) ||
                    (isMiscFee && miscNativeUSD > 0) ||
                    isCampaignPlannedInUSD
                  );

                  return (
                    <tr key={payment.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-900">{new Date(payment.date || payment.created_at).toLocaleDateString('fr-FR')}</div>
                        <div className="text-[10px] font-mono text-slate-400">RCP-{(payment.receipt_number || payment.id).substring(0, 8).toUpperCase()}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800">{displayNature}</div>
                        {payment.description && (
                          <div className="text-[11px] text-slate-500 italic mt-0.5">{payment.description}</div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200">
                          {payment.status === 'ANNULE' ? 'Annulé' : (payment.payment_method || payment.method || 'Cash')}
                          {payment.reference_number && payment.status !== 'ANNULE' && (
                            <span className="text-[10px] text-slate-500 ml-1 font-mono">
                              #{payment.reference_number}
                            </span>
                          )}
                        </span>
                        {payment.status === 'ANNULE' && (
                          <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-200">
                            Annulé
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-bold whitespace-nowrap">
                        {isUSD ? (
                          <div className="flex flex-col items-end">
                            <span className="text-emerald-900 bg-emerald-50 border border-emerald-300 px-2.5 py-1 rounded-md text-xs inline-flex items-center gap-1 font-mono font-bold shadow-2xs">
                              <span className="text-emerald-700 font-bold">$</span>
                              {rawAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} USD
                            </span>
                            <span className="text-[10px] text-amber-800 font-mono font-medium mt-1 flex items-center gap-1 bg-amber-50/90 border border-amber-200 px-1.5 py-0.5 rounded">
                              <Coins size={10} className="text-amber-600 shrink-0" />
                              × {appliedRate} G
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-900 text-xs inline-block">
                            {rawAmount.toLocaleString()} HTG
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {isUSD ? (
                          <div className="inline-flex flex-col items-center gap-1 py-0.5">
                            <div 
                              className="inline-flex items-center gap-1.5 bg-gradient-to-r from-amber-50 via-amber-100/90 to-amber-50 text-amber-950 border border-amber-300 px-2.5 py-1 rounded-lg text-[11px] font-mono font-black whitespace-nowrap shadow-xs hover:border-amber-400 hover:shadow-sm transition-all cursor-help"
                              title={`🏛️ AUDIT FINANCIER & CONVERSION LÉGALE :\n• Devise d'encaissement : USD (Devise étrangère)\n• Montant brut encaissé : $${rawAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD\n• Taux de change légal scellé : 1 USD = ${appliedRate} HTG\n• Contrevaleur comptable créditée : ${baseHTG.toLocaleString()} HTG\n• Statut : Taux historique figé et certifié, irréversible pour l'audit financier`}
                            >
                              <ShieldCheck size={14} className="text-amber-700 shrink-0" />
                              <span className="text-amber-900 font-bold">1 USD =</span>
                              <span className="text-amber-950 font-black px-1.5 py-0.2 bg-amber-200/80 rounded border border-amber-300 text-[11.5px]">{appliedRate} HTG</span>
                            </div>
                            <div className="inline-flex items-center gap-1 text-[9px] font-black text-amber-800 bg-amber-100/70 border border-amber-200/80 px-2 py-0.5 rounded-full tracking-tight">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 animate-pulse"></span>
                              <span>Taux scellé • Audit certifié</span>
                            </div>
                          </div>
                        ) : isFeePlannedInUSD ? (
                          <div className="inline-flex flex-col items-center gap-0.5">
                            <span 
                              className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-900 border border-blue-200 px-2.5 py-1 rounded-md text-[11px] font-mono font-bold whitespace-nowrap shadow-xs"
                              title={`Frais sous-jacent planifié en devises (USD), acquitté en Gourdes au barème : 1 USD = ${appliedRate} HTG`}
                            >
                              <ArrowRightLeft size={12} className="text-blue-700 shrink-0" />
                              <span>1 USD = {appliedRate} HTG</span>
                            </span>
                            <span className="text-[9px] font-bold text-blue-700 tracking-tight">
                              Amortissement barème USD
                            </span>
                          </div>
                        ) : (
                          <div 
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-900 border border-emerald-200 text-[11px] font-bold whitespace-nowrap shadow-2xs"
                            title="Frais planifié en Gourdes et payé directement en Gourdes. Aucune conversion de devises requise."
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                            <span className="font-mono">Paiement Direct HTG</span>
                            <span className="text-emerald-700 text-[10px] font-semibold">(Sans conversion)</span>
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right font-black font-mono whitespace-nowrap">
                        <div className="flex flex-col items-end">
                          {payment.status === 'ANNULE' ? (
                            <span className="text-slate-400 line-through">{Math.round(baseHTG).toLocaleString()} HTG</span>
                          ) : (
                            <span className="text-slate-900">{Math.round(baseHTG).toLocaleString()} HTG</span>
                          )}
                          {isUSD && payment.status !== 'ANNULE' && (
                            <div className="text-[10px] text-emerald-800 font-mono font-bold flex items-center justify-end gap-1 mt-0.5" title="Détail du calcul certifié pour l'audit">
                              <CheckCircle2 size={10} className="text-emerald-600 shrink-0" />
                              <span>${rawAmount} × {appliedRate}</span>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Renflouement Express du Portefeuille Élève */}
      {showWalletTopUpModal && studentData && (
        <StudentWalletTopUpModal
          isOpen={showWalletTopUpModal}
          onClose={() => setShowWalletTopUpModal(false)}
          student={{
            id: studentData.id,
            first_name: studentData.first_name,
            last_name: studentData.last_name,
            reference_number: studentData.reference_number,
            class_name: studentData.class?.name,
            wallet_balance_htg: walletBalance,
            parent_name: studentData.parent_name,
            parent_phone: studentData.parent_phone,
            school_id: studentData.school_id || school?.id || user.school_id
          }}
          schoolName={school?.name}
          schoolId={studentData.school_id || school?.id || user.school_id}
          onSuccess={(newBalance, paymentRecord) => {
            setWalletBalance(newBalance);
            if (paymentRecord) {
              setPayments(prev => [paymentRecord, ...prev]);
            }
            toast.success(`Portefeuille renfloué avec succès ! Nouveau solde : ${newBalance.toLocaleString()} HTG`);
          }}
        />
      )}
    </div>
  );
};
export default StudentFinanceView;
