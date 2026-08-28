import React, { useState, useEffect } from 'react';
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
  Wallet
} from 'lucide-react';
import { computeFeeCategoryBalance, getFormattedFeeRowDetails } from '../utils/financeCalculations';

interface StudentFinanceViewProps {
  user: UserProfile;
}

export const StudentFinanceView: React.FC<StudentFinanceViewProps> = ({ user }) => {
  const { school } = useSchool();
  const { studentData, activeYear, loading: studentLoading } = useStudent(user);
  const [payments, setPayments] = useState<any[]>([]);
  const [feePlan, setFeePlan] = useState<any>(null);
  const [adHocCampaigns, setAdHocCampaigns] = useState<any[]>([]);
  const [exchangeRate, setExchangeRate] = useState<number>(135.0);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<'all' | 'tuition' | 'misc' | 'campaigns'>('all');

  useEffect(() => {
    const fetchFinances = async () => {
      if (!studentData?.id || !activeYear) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        // Fetch current exchange rate
        const { data: rateRes } = await supabase
          .from('exchange_rates')
          .select('*')
          .eq('school_id', user.school_id)
          .order('effective_date', { ascending: false })
          .limit(1);
        const currentRate = Number(rateRes?.[0]?.rate_usd_to_htg || rateRes?.[0]?.rate || 135.0);
        setExchangeRate(currentRate);

        // Fetch fee plan for the class
        const { data: planData } = await supabase
          .from('fee_plans')
          .select('*')
          .eq('class_id', studentData.class_id)
          .eq('academic_year_id', activeYear.id)
          .maybeSingle();
        
        setFeePlan(planData);

        // Fetch payments made by student
        const { data: paymentsData } = await supabase
          .from('payments')
          .select('*, campaign:ad_hoc_campaigns(id, name)')
          .eq('student_id', studentData.id)
          .eq('academic_year_id', activeYear.id)
          .order('date', { ascending: false });

        setPayments(paymentsData || []);

        // Fetch student's assigned ad-hoc campaigns
        const { data: campaignData, error: campaignErr } = await supabase
          .from('student_ad_hoc_fees')
          .select(`
            id,
            custom_amount,
            adjustment_reason,
            campaign:ad_hoc_campaigns!campaign_id(id, name, amount, currency, status, due_date, type, academic_year_id)
          `)
          .eq('student_id', studentData.id);

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
            .filter((c: any) => c !== null && c.academic_year_id === activeYear.id);
          
          setAdHocCampaigns(studentCamps);
        }

      } catch (err) {
        console.error("Error fetching finances: ", err);
      } finally {
        setLoading(false);
      }
    };
    fetchFinances();
  }, [studentData, activeYear]);

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

  const validPayments = payments.filter(p => p.status !== 'ANNULE');

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

  const admissionPayments = validPayments.filter(p => !p.ad_hoc_campaign_id && isAdmissionPayment(p));
  const miscPayments = validPayments.filter(p => !p.ad_hoc_campaign_id && !isAdmissionPayment(p) && isMiscPayment(p));
  const campaignPayments = validPayments.filter(p => !!p.ad_hoc_campaign_id);
  const tuitionPayments = validPayments.filter(p => !p.ad_hoc_campaign_id && !isAdmissionPayment(p) && !isMiscPayment(p));

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
    const campPayments = payments.filter((p: any) => p.ad_hoc_campaign_id === camp.id && p.status !== 'ANNULE');
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

  const displayedPayments = payments.filter(p => {
    if (activeSection === 'tuition') return !p.ad_hoc_campaign_id && !isMiscPayment(p);
    if (activeSection === 'misc') return !p.ad_hoc_campaign_id && isMiscPayment(p);
    if (activeSection === 'campaigns') return !!p.ad_hoc_campaign_id;
    return true;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-100 text-amber-700 rounded-2xl shadow-sm">
            <Receipt size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Mon Économat</h1>
            <p className="text-xs font-medium text-slate-500 flex items-center gap-1.5 mt-0.5">
              <span>Situation financière pour l'année académique <strong className="text-slate-800">{activeYear?.label || '--'}</strong></span>
              <span className="text-slate-300">•</span>
              <span className="text-indigo-600 font-mono font-bold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                Taux du jour : 1 USD = {exchangeRate} HTG
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Tabs Selector */}
      <div className="flex bg-slate-100/80 p-1 rounded-2xl max-w-lg shadow-inner border border-slate-200/80 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveSection('all')}
          className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs transition-all whitespace-nowrap cursor-pointer ${
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
          className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs transition-all whitespace-nowrap cursor-pointer ${
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
            className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs transition-all whitespace-nowrap cursor-pointer ${
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
            className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs transition-all whitespace-nowrap relative cursor-pointer ${
              activeSection === 'campaigns'
                ? 'bg-white text-slate-950 shadow-xs border border-slate-200/60'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Campagnes
            {adHocCampaigns.length > 0 && (
              <span className="ml-1.5 bg-blue-600 text-white font-black text-[9px] px-1.5 py-0.2 rounded-full">
                {adHocCampaigns.length}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Financial Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-in fade-in duration-300">
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col items-center justify-center text-center">
          <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-1.5">
            {activeSection === 'all' ? 'Obligation Totale' : activeSection === 'tuition' ? 'Scolarité & Admission' : activeSection === 'misc' ? 'Frais Divers' : 'Frais de Campagnes'}
          </span>
          <span className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">
            {Math.round(displayedExpected).toLocaleString()} <span className="text-xs font-sans text-slate-500">HTG</span>
          </span>
          {activeSection === 'tuition' && totalDiscount > 0 && (
            <span className="text-[10px] text-emerald-700 font-bold mt-1.5 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
              Réduction de {totalDiscount.toLocaleString()} HTG incluse
            </span>
          )}
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col items-center justify-center text-center border-b-4 border-b-emerald-500 relative overflow-hidden">
          <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Déjà Versé</span>
          <span className="text-2xl sm:text-3xl font-black text-emerald-600 font-mono">
            {Math.round(displayedPaid).toLocaleString()} <span className="text-xs font-sans text-emerald-500">HTG</span>
          </span>
        </div>

        <div className={`bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col items-center justify-center text-center border-b-4 ${displayedBalance <= 0 ? 'border-b-blue-500' : 'border-b-rose-500'}`}>
          <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Solde Restant</span>
          <span className={`text-2xl sm:text-3xl font-black font-mono ${displayedBalance <= 0 ? 'text-blue-600' : 'text-rose-600'}`}>
            {displayedBalance <= 0 ? 'Réglé (À Jour)' : `${Math.round(displayedBalance).toLocaleString()} HTG`}
          </span>
        </div>
      </div>

      {/* Detailed Fee Cards */}
      {(activeSection === 'all' || activeSection === 'tuition' || activeSection === 'misc') && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-indigo-600" />
            <h2 className="text-base font-bold text-slate-900">Grille Tarifaire des Frais Scolaires</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Admission Fee Card */}
            {(activeSection === 'all' || activeSection === 'tuition') && (
              <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-colors">
                <div>
                  <div className="border-b border-slate-100 pb-3 flex items-center justify-between mb-3.5">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-tight">Admission / Inscription</h3>
                    <span className="text-[10px] font-bold uppercase text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                      Fixe
                    </span>
                  </div>
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-start text-xs">
                      <span className="text-slate-500">Montant Requis</span>
                      <div className="text-right font-mono">
                        <span className="font-bold text-slate-800 block">{admissionDetails.plannedNative}</span>
                        {admissionDetails.plannedEquiv && <span className="text-[10px] text-slate-400 block">{admissionDetails.plannedEquiv}</span>}
                      </div>
                    </div>
                    <div className="flex justify-between items-start text-xs">
                      <span className="text-slate-500">Montant Versé</span>
                      <div className="text-right font-mono">
                        <span className="font-bold text-emerald-600 block">{admissionDetails.paidNative}</span>
                        {admissionDetails.paidEquiv && <span className="text-[10px] text-emerald-500 block">{admissionDetails.paidEquiv}</span>}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-3 mt-3 flex justify-between items-center text-xs font-bold font-mono">
                  <span className="text-slate-600 font-sans">Reste à payer</span>
                  <div className="text-right">
                    <span className={admissionDetails.isPaid ? 'text-emerald-600' : 'text-rose-600'}>
                      {admissionDetails.remainingNative}
                    </span>
                    {!admissionDetails.isPaid && admissionDetails.remainingEquiv && (
                      <span className="text-[10px] text-rose-400 block">{admissionDetails.remainingEquiv}</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Tuition Fee Card */}
            {(activeSection === 'all' || activeSection === 'tuition') && (
              <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-colors">
                <div>
                  <div className="border-b border-slate-100 pb-3 flex items-center justify-between mb-3.5">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-tight">Scolarité (Écolage)</h3>
                    <span className="text-[10px] font-bold uppercase text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                      Académique
                    </span>
                  </div>
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-start text-xs">
                      <span className="text-slate-500">Montant Exigé</span>
                      <div className="text-right font-mono">
                        <span className="font-bold text-slate-800 block">{tuitionDetails.plannedNative}</span>
                        {tuitionDetails.plannedEquiv && <span className="text-[10px] text-slate-400 block">{tuitionDetails.plannedEquiv}</span>}
                      </div>
                    </div>
                    <div className="flex justify-between items-start text-xs">
                      <span className="text-slate-500">Montant Versé</span>
                      <div className="text-right font-mono">
                        <span className="font-bold text-emerald-600 block">{tuitionDetails.paidNative}</span>
                        {tuitionDetails.paidEquiv && <span className="text-[10px] text-emerald-500 block">{tuitionDetails.paidEquiv}</span>}
                      </div>
                    </div>
                    {totalDiscount > 0 && (
                      <div className="flex justify-between items-center text-[11px] text-emerald-700 bg-emerald-50 p-2 rounded-lg border border-emerald-100">
                        <span>Réduction accordée</span>
                        <span className="font-bold">-{totalDiscount.toLocaleString()} HTG</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-3 mt-3 flex justify-between items-center text-xs font-bold font-mono">
                  <span className="text-slate-600 font-sans">Reste à payer</span>
                  <div className="text-right">
                    <span className={tuitionDetails.isPaid ? 'text-emerald-600' : 'text-rose-600'}>
                      {tuitionDetails.remainingNative}
                    </span>
                    {!tuitionDetails.isPaid && tuitionDetails.remainingEquiv && (
                      <span className="text-[10px] text-rose-400 block">{tuitionDetails.remainingEquiv}</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Misc Fee Card (Frais Divers) */}
            {hasMiscFee && (activeSection === 'all' || activeSection === 'misc') && (
              <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-colors">
                <div>
                  <div className="border-b border-slate-100 pb-3 flex items-center justify-between mb-3.5">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-tight">Frais Divers (Généraux)</h3>
                    <span className="text-[10px] font-bold uppercase text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                      Multi-Devises
                    </span>
                  </div>
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-start text-xs">
                      <span className="text-slate-500">Montant Requis</span>
                      <div className="text-right font-mono">
                        <span className="font-bold text-slate-800 block">{miscDetails.plannedNative}</span>
                        {miscDetails.plannedEquiv && <span className="text-[10px] text-slate-400 block">{miscDetails.plannedEquiv}</span>}
                      </div>
                    </div>
                    <div className="flex justify-between items-start text-xs">
                      <span className="text-slate-500">Montant Versé</span>
                      <div className="text-right font-mono">
                        <span className="font-bold text-emerald-600 block">{miscDetails.paidNative}</span>
                        {miscDetails.paidEquiv && <span className="text-[10px] text-emerald-500 block">{miscDetails.paidEquiv}</span>}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-3 mt-3 flex justify-between items-center text-xs font-bold font-mono">
                  <span className="text-slate-600 font-sans">Reste à payer</span>
                  <div className="text-right">
                    <span className={miscDetails.isPaid ? 'text-emerald-600' : 'text-rose-600'}>
                      {miscDetails.remainingNative}
                    </span>
                    {!miscDetails.isPaid && miscDetails.remainingEquiv && (
                      <span className="text-[10px] text-rose-400 block">{miscDetails.remainingEquiv}</span>
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
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-blue-600" />
            <h2 className="text-base font-bold text-slate-900">Campagnes & Activités Spéciales</h2>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {campaignBreakdowns.map(({ camp, details, isCustomized }) => (
              <div key={camp.id} className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:border-slate-300 transition-colors">
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-black uppercase text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                      {camp.type || 'Frais Spéciaux'}
                    </span>
                    {isCustomized && (
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-100 flex items-center gap-1">
                        <Sparkles size={10} />
                        Tarif Personnalisé
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">{camp.name}</h3>
                  {isCustomized && camp.adjustment_reason && (
                    <p className="text-xs text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100 flex items-start gap-1.5 max-w-xl">
                      <Info size={13} className="text-slate-400 shrink-0 mt-0.5" />
                      <span><strong>Ajustement :</strong> {camp.adjustment_reason}</span>
                    </p>
                  )}
                  {camp.due_date && (
                    <p className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Calendar size={12} />
                      Date d'échéance : {new Date(camp.due_date).toLocaleDateString('fr-FR')}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2.5 shrink-0 w-full md:w-auto justify-between md:justify-end items-center font-mono">
                  <div className="text-center px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-100 min-w-[90px]">
                    <span className="block text-[9px] font-black text-slate-400 uppercase font-sans">Exigé</span>
                    <span className="text-xs font-bold text-slate-800 block">{details.plannedNative}</span>
                    {details.plannedEquiv && <span className="text-[9px] text-slate-400 block">{details.plannedEquiv}</span>}
                  </div>
                  <div className="text-center px-3 py-1.5 bg-emerald-50 rounded-xl border border-emerald-100 min-w-[90px]">
                    <span className="block text-[9px] font-black text-emerald-600 uppercase font-sans">Payé</span>
                    <span className="text-xs font-bold text-emerald-600 block">{details.paidNative}</span>
                    {details.paidEquiv && <span className="text-[9px] text-emerald-500 block">{details.paidEquiv}</span>}
                  </div>
                  <div className={`text-center px-3 py-1.5 rounded-xl border min-w-[90px] ${details.isPaid ? 'bg-blue-50 border-blue-100' : 'bg-rose-50 border-rose-100'}`}>
                    <span className="block text-[9px] font-black uppercase font-sans text-slate-400">Solde</span>
                    <span className={`text-xs font-bold block ${details.isPaid ? 'text-blue-600' : 'text-rose-600'}`}>
                      {details.remainingNative}
                    </span>
                    {!details.isPaid && details.remainingEquiv && (
                      <span className="text-[9px] text-rose-400 block">{details.remainingEquiv}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payments History Table with Detailed Multi-Currency Columns & Tooltips */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-base font-bold text-slate-900">Historique des Paiements & Versements</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Journal certifié avec détail du montant payé, taux de change historique et contrevaleur
            </p>
          </div>
          <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
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
                    displayNature = "Frais Divers (Généraux)";
                  }

                  const isUSD = payment.currency === 'USD';
                  const rawAmount = Number(payment.amount || 0);
                  const appliedRate = Number(payment.exchange_rate_applied || (isUSD && payment.amount_htg_equivalent ? (payment.amount_htg_equivalent / rawAmount) : exchangeRate));
                  const baseHTG = Number(payment.amount_htg_equivalent || (isUSD ? rawAmount * appliedRate : rawAmount));

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
                          <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-xs inline-block">
                            ${rawAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} USD
                          </span>
                        ) : (
                          <span className="text-slate-900 text-xs inline-block">
                            {rawAmount.toLocaleString()} HTG
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {isUSD ? (
                          <span 
                            className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded text-[11px] font-mono font-bold whitespace-nowrap"
                            title={`Taux de change fixé lors de cette transaction : 1 USD = ${appliedRate} HTG`}
                          >
                            <ArrowRightLeft size={11} className="text-amber-600 shrink-0" />
                            1$ = {appliedRate} G
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs font-mono">—</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right font-black font-mono whitespace-nowrap">
                        {payment.status === 'ANNULE' ? (
                          <span className="text-slate-400 line-through">{Math.round(baseHTG).toLocaleString()} HTG</span>
                        ) : (
                          <span className="text-slate-900">{Math.round(baseHTG).toLocaleString()} HTG</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
export default StudentFinanceView;
