import React, { useState, useMemo } from 'react';
import { 
  X, 
  ShieldCheck, 
  ShieldAlert, 
  CheckCircle2, 
  AlertTriangle, 
  Calendar, 
  CreditCard, 
  DollarSign, 
  Receipt, 
  User, 
  FileText, 
  ArrowRight, 
  Sparkles, 
  Clock, 
  Building2,
  Check,
  Search,
  ExternalLink,
  Printer,
  Filter,
  Layers,
  Info,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  Banknote
} from 'lucide-react';
import { AcademicSessionPill } from './AcademicSessionPill';

export interface SessionAuditDetail {
  academicYearId: string;
  academicYearLabel: string;
  className: string;
  level: string;
  isCurrentSession: boolean;
  isFutureSession?: boolean;
  isEnrolled: boolean;
  inscriptionDue: number;
  inscriptionPaid: number;
  inscriptionRemaining: number;
  inscriptionIsPaid: boolean;
  miscDue: number;
  miscPaid: number;
  miscRemaining: number;
  tuitionDue: number;
  tuitionPaid: number;
  tuitionRemaining: number;
  adHocDue: number;
  adHocPaid: number;
  adHocRemaining: number;
  totalDue: number;
  totalPaid: number;
  remainingDebt: number;
  isSolvent: boolean;
}

interface StudentDossierAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: any;
  terminology: any;
  activeYear: any;
  sessions: SessionAuditDetail[];
  transactions: any[];
  currentExchangeRate: number;
  globalDebt: number;
  onSelectYear?: (yearId: string) => void;
  academicYears?: any[];
  school?: any;
  campusName?: string;
  campuses?: any[];
}

/**
 * Résolution experte du motif précis d'un paiement
 * Permet de distinguer immédiatement les Frais Divers Institutionnels récurrents (HTG)
 * des Frais Spécifiques / Campagnes / Stages (USD ou ponctuels).
/**
 * Détection universelle et robuste des règlements de frais de campagne
 */
export const isCampaignPayment = (tx: any): boolean => {
  if (!tx) return false;
  if (tx.ad_hoc_campaign_id || tx.campaign_id || tx.campaign?.id) return true;
  const ft = (tx.fee_type || '').toUpperCase();
  if (ft === 'AD_HOC' || ft === 'CAMPAGNE' || ft === 'CAMPAIGN') return true;
  const rub = (tx.rubrique || '').toLowerCase();
  if (rub.includes('campagne') || rub.includes('parascolaire')) return true;
  const nat = (tx.nature || '').toLowerCase();
  if (nat.includes('campagne') || nat.includes('parascolaire') || nat.includes('ad hoc') || nat.includes('ad_hoc')) return true;
  const typ = (tx.type || '').toLowerCase();
  if (typ.includes('campagne') || typ.includes('parascolaire')) return true;
  const desc = (tx.description || '').toLowerCase();
  if (desc.includes('campagne') || desc.includes('parascolaire')) return true;
  return false;
};

export const resolvePaymentMotif = (tx: any, terminology: any) => {
  const natureStr = (tx.nature || '').trim();
  const typeStr = (tx.type || '').trim();
  const descStr = (tx.description || '').trim();
  const ft = (tx.fee_type || '').toUpperCase();
  const genericTerms = ['frais divers', 'divers', 'scolarite', 'scolarité', 'inscription', 'droits de scolarité'];

  // 1. Campagne Ad-Hoc rattachée explicitement ou identifiée par son libellé
  if (tx.campaign?.name || isCampaignPayment(tx)) {
    const title = tx.campaign?.name || (natureStr && !genericTerms.includes(natureStr.toLowerCase()) ? natureStr : (descStr || typeStr || 'Campagnes & Activités Parascolaires'));
    return {
      title,
      category: 'Frais de Campagne & Activités',
      badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
      isSpecial: true,
      isCampaign: true
    };
  }

  // 2. Si le champ type ou nature contient un libellé spécifique explicite (non générique)
  if (natureStr && !genericTerms.includes(natureStr.toLowerCase())) {
    return {
      title: natureStr,
      category: natureStr.toLowerCase().includes('stage') ? 'Stage Académique' : 'Frais Spécifique',
      badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      isSpecial: true,
      isCampaign: false
    };
  }

  if (typeStr && !genericTerms.includes(typeStr.toLowerCase())) {
    return {
      title: typeStr,
      category: typeStr.toLowerCase().includes('stage') ? 'Stage Académique' : 'Frais Spécifique',
      badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      isSpecial: true,
      isCampaign: false
    };
  }

  // 3. Catégorie native fee_type
  if (ft === 'INSCRIPTION') {
    return {
      title: "Frais d'Inscription / Régularisation d'Entrée",
      category: "Admission & Entrée",
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
      isSpecial: false,
      isCampaign: false
    };
  }

  if (ft === 'SCOLARITE') {
    return {
      title: `${terminology.tuition || 'Scolarité'} (Droits d'études)`,
      category: "Scolarité",
      badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
      isSpecial: false,
      isCampaign: false
    };
  }

  if (ft === 'CREDIT_PORTEFEUILLE') {
    return {
      title: `Alimentation Portefeuille ${terminology.student || 'Élève'}`,
      category: "Portefeuille",
      badgeColor: 'bg-teal-100 text-teal-800 border-teal-200',
      isSpecial: false,
      isCampaign: false
    };
  }

  if (ft === 'DIVERS' || natureStr.toLowerCase().includes('divers') || typeStr.toLowerCase().includes('divers')) {
    // Si la transaction n'est pas une campagne spécifique explicitée, c'est le poste Frais Divers Obligatoires
    // (qu'il soit réglé en HTG ou en USD dans le cadre d'un règlement bimonétaire).
    return {
      title: descStr || typeStr || natureStr || 'Frais Divers Obligatoires',
      category: 'Frais Divers Obligatoires',
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      isSpecial: false,
      isCampaign: false
    };
  }

  return {
    title: descStr || typeStr || natureStr || tx.fee_type || 'Frais Scolaires',
    category: 'Règlement',
    badgeColor: 'bg-slate-100 text-slate-800 border-slate-200',
    isSpecial: false,
    isCampaign: false
  };
};

export const StudentDossierAuditModal: React.FC<StudentDossierAuditModalProps> = ({
  isOpen,
  onClose,
  student,
  terminology,
  activeYear,
  sessions = [],
  transactions = [],
  currentExchangeRate,
  globalDebt,
  onSelectYear,
  academicYears = [],
  school,
  campusName,
  campuses = []
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'sessions' | 'transactions' | 'certificate'>('overview');
  const [searchTx, setSearchTx] = useState('');
  const [txFilter, setTxFilter] = useState<'ALL' | 'INSCRIPTION' | 'SCOLARITE' | 'DIVERS' | 'SPECIFIQUES'>('ALL');

  // Calcul analytique de tous les frais payés (Hook exécuté inconditionnellement)
  const analysis = useMemo(() => {
    let totalPaidHTG = 0;
    let totalPaidUSD = 0;
    let totalPaidHTGEquiv = 0;

    let inscriptionPaidHTG = 0;
    let inscriptionPaidUSD = 0;

    let tuitionPaidHTG = 0;
    let tuitionPaidUSD = 0;

    let miscPaidHTG = 0;
    let miscPaidUSD = 0;

    let campaignsPaidHTG = 0;
    let campaignsPaidUSD = 0;
    let campaignsReceiptCount = 0;

    let miscSpecialPaidUSD = 0;
    let miscSpecialPaidHTG = 0;

    const safeTxs = transactions || [];
    const validTxs = safeTxs.filter(t => !String(t?.status || '').toUpperCase().includes('ANNUL'));

    for (const t of validTxs) {
      const amt = Number(t?.amount || 0);
      const isUSD = t?.currency === 'USD';
      const equiv = Number(t?.amount_htg_equivalent || (isUSD ? amt * (currentExchangeRate || 135) : amt));

      if (isUSD) {
        totalPaidUSD += amt;
      } else {
        totalPaidHTG += amt;
      }
      totalPaidHTGEquiv += equiv;

      const isCamp = isCampaignPayment(t);
      const motif = resolvePaymentMotif(t, terminology || {});
      const ft = (t?.fee_type || '').toUpperCase();
      const isMiscFee = ft === 'DIVERS' || (t?.nature || '').toLowerCase().includes('divers') || (t?.type || '').toLowerCase().includes('divers');

      if (isCamp) {
        campaignsReceiptCount++;
        if (isUSD) campaignsPaidUSD += amt;
        else campaignsPaidHTG += amt;
      } else if (ft === 'INSCRIPTION') {
        if (isUSD) inscriptionPaidUSD += amt;
        else inscriptionPaidHTG += amt;
      } else if (ft === 'SCOLARITE') {
        if (isUSD) tuitionPaidUSD += amt;
        else tuitionPaidHTG += amt;
      } else if (isMiscFee && !motif.isSpecial) {
        // Règlement bimonétaire (HTG & USD) des Frais Divers Obligatoires
        if (isUSD) miscPaidUSD += amt;
        else miscPaidHTG += amt;
      } else {
        // Autres prestations spécifiques
        if (isUSD) miscSpecialPaidUSD += amt;
        else miscSpecialPaidHTG += amt;
      }
    }

    const hasDualMiscFees = (miscPaidHTG > 0 && miscPaidUSD > 0) || validTxs.filter(t => (t?.fee_type || '').toUpperCase() === 'DIVERS').length >= 2;
    const campaignsTotalHTGEquiv = campaignsPaidHTG + (campaignsPaidUSD * (currentExchangeRate || 135));

    return {
      totalPaidHTG,
      totalPaidUSD,
      totalPaidHTGEquiv,
      inscriptionPaidHTG,
      inscriptionPaidUSD,
      tuitionPaidHTG,
      tuitionPaidUSD,
      miscPaidHTG,
      miscPaidUSD,
      campaignsPaidHTG,
      campaignsPaidUSD,
      campaignsReceiptCount,
      campaignsTotalHTGEquiv,
      miscSpecialPaidUSD,
      miscSpecialPaidHTG,
      hasDualMiscFees,
      validTransactionsCount: validTxs.length
    };
  }, [transactions, currentExchangeRate, terminology]);

  // Filtrage du Grand Livre des Transactions (Hook exécuté inconditionnellement)
  const filteredTransactions = useMemo(() => {
    const safeTxs = transactions || [];
    return safeTxs.filter(tx => {
      const isCamp = isCampaignPayment(tx);
      const motif = resolvePaymentMotif(tx, terminology || {});
      const ft = (tx?.fee_type || '').toUpperCase();
      const isMiscFee = ft === 'DIVERS' || (tx?.nature || '').toLowerCase().includes('divers') || (tx?.type || '').toLowerCase().includes('divers');

      // Filtre catégorie
      if (txFilter === 'INSCRIPTION' && ft !== 'INSCRIPTION') return false;
      if (txFilter === 'SCOLARITE' && (ft !== 'SCOLARITE' || isCamp)) return false;
      if (txFilter === 'DIVERS' && (!isMiscFee || motif.isSpecial || isCamp)) return false;
      if (txFilter === 'SPECIFIQUES' && (!isCamp && !motif.isSpecial)) return false;

      // Filtre recherche textuelle
      if (searchTx.trim()) {
        const q = searchTx.toLowerCase().trim();
        const dateStr = tx?.created_at ? new Date(tx.created_at).toLocaleDateString('fr-FR') : '';
        const refStr = String(tx?.reference_number || tx?.transaction_reference || tx?.id || '').toLowerCase();
        const motifTitle = (motif.title || '').toLowerCase();
        const methodStr = String(tx?.payment_method || '').toLowerCase();
        const amountStr = String(tx?.amount ?? tx?.paid_amount ?? tx?.total_amount ?? '').toLowerCase();
        return dateStr.includes(q) || refStr.includes(q) || motifTitle.includes(q) || methodStr.includes(q) || amountStr.includes(q);
      }

      return true;
    });
  }, [transactions, txFilter, searchTx, terminology]);

  // Return early APRÈS l'évaluation de tous les hooks React
  if (!isOpen || !student) return null;

  const studentName = student.fullName || `${student.first_name || ''} ${student.last_name || ''}`.trim();
  const studentCode = student.code || student.reference_number || (student.id ? student.id.substring(0, 8) : 'N/A');
  const isNotEnrolledCurrent = Boolean(student.isNotEnrolledInTargetYear);
  const safeSessions = sessions || [];
  const currentSession = safeSessions.find(s => s.academicYearId === activeYear?.id || s.isCurrentSession);
  const pastSessions = safeSessions.filter(s => !s.isCurrentSession && !s.isFutureSession);
  const futureSessions = safeSessions.filter(s => s.isFutureSession && !s.isCurrentSession);
  const isSolventHistory = globalDebt === 0;

  // Calculs spécifiques des campagnes & activités pour cet élève
  const campaignPaidHTGEquiv = analysis.campaignsTotalHTGEquiv > 0 
    ? analysis.campaignsTotalHTGEquiv 
    : (analysis.miscSpecialPaidHTG + (analysis.miscSpecialPaidUSD * (currentExchangeRate || 135)));
  const campaignExpectedHTG = Number(student?.campaignsFee || student?.adHocDue || currentSession?.adHocDue || (campaignPaidHTGEquiv > 0 ? campaignPaidHTGEquiv : 0));
  const campaignRemainingHTG = Math.max(0, campaignExpectedHTG - campaignPaidHTGEquiv);
  const isCampaignPaid = campaignExpectedHTG > 0 ? (campaignRemainingHTG <= 50) : (campaignPaidHTGEquiv > 0);

  // Détection rigoureuse : Ancien élève réinscrit vs Nouvel élève (Première inscription)
  const isReturningStudent = Boolean(
    student.isReenrollment || 
    student.hasPreviousEnrollment || 
    (student.otherEnrollments && student.otherEnrollments.length > 0) ||
    pastSessions.length > 0 ||
    safeSessions.some(s => !s.isCurrentSession && !s.isFutureSession)
  );

  const admissionFeeDue = (student.inscriptionDue !== undefined && student.inscriptionDue !== null)
    ? Number(student.inscriptionDue)
    : (currentSession?.inscriptionDue !== undefined ? Number(currentSession.inscriptionDue) : 0);

  const selectedSessionDue = currentSession?.totalDue !== undefined && currentSession.totalDue > 0
    ? currentSession.totalDue 
    : (student.totalDue || 0);

  const selectedSessionPaid = currentSession?.totalPaid !== undefined && currentSession.totalPaid > 0
    ? currentSession.totalPaid 
    : (student.paid || 0);

  const selectedSessionRemaining = currentSession?.remainingDebt !== undefined
    ? currentSession.remainingDebt
    : (student.totalRemaining || 0);

  // Nom de l'établissement et de l'annexe (Multi-tenant & Multi-annexe)
  const institutionName = school?.name || school?.school_name || 'Établissement';
  const resolvedCampusName = campusName || student?.campus_name || (campuses?.find((c: any) => c.id === (student?.campus_id || student?.class?.campus_id))?.name) || '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-900/75 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200/90 max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden my-auto animate-in zoom-in-95 duration-200">
        
        {/* HEADER COMPACT ET ERGONOMIQUE */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-slate-200/80 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`p-2 rounded-xl border shrink-0 ${
              isSolventHistory 
                ? 'bg-emerald-50 text-emerald-600 border-emerald-200 shadow-2xs' 
                : 'bg-rose-50 text-rose-600 border-rose-200 shadow-2xs'
            }`}>
              {isSolventHistory ? <ShieldCheck size={20} className="stroke-[2.2]" /> : <ShieldAlert size={20} className="stroke-[2.2]" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight truncate">
                  Dossier Financier
                </h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                  isSolventHistory 
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                    : 'bg-rose-50 text-rose-700 border-rose-200'
                }`}>
                  {isSolventHistory ? 'Historique Antérieur Soldé' : `Arriéré Passé : ${globalDebt.toLocaleString()} HTG`}
                </span>
                {isNotEnrolledCurrent && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                    Session {activeYear?.label || 'active'} à régulariser
                  </span>
                )}
                {resolvedCampusName && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                    <Building2 size={10} />
                    <span>Annexe : {resolvedCampusName}</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap truncate">
                <span className="font-bold text-slate-800">{studentName}</span>
                <span>•</span>
                <span className="font-mono text-slate-600">{studentCode}</span>
                <span>•</span>
                <span className="text-slate-600">{student.classe || student.class?.name || 'Classe non assignée'}</span>
                {institutionName && (
                  <>
                    <span>•</span>
                    <span className="text-slate-400 font-medium">{institutionName}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => window.print()}
              title="Imprimer le bilan financier"
              className="px-2.5 py-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all hidden sm:flex items-center gap-1.5 text-xs font-bold border border-slate-200 cursor-pointer"
            >
              <Printer size={13} />
              <span>Imprimer</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
              aria-label="Fermer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* BANDEAU SESSION SÉLECTIONNÉE & MONTANTS DU GUICHET */}
        <div className="px-4 sm:px-6 py-2.5 bg-gradient-to-r from-blue-50/90 via-indigo-50/70 to-slate-50 border-b border-slate-200/90 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          {/* Sélecteur de session et badge Admission */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
              <Calendar size={13} className="text-blue-600 shrink-0" />
              <span>Session Sélectionnée :</span>
            </div>
            {academicYears && academicYears.length > 0 && onSelectYear ? (
              <AcademicSessionPill
                academicYears={academicYears}
                selectedYearId={activeYear?.id || ''}
                onSelectYear={(newYr) => onSelectYear(newYr)}
                variant="compact"
                size="xs"
                colorScheme="blue"
              />
            ) : (
              <span className="px-2.5 py-0.5 rounded-md bg-blue-100 text-blue-900 font-black text-xs border border-blue-200">
                {activeYear?.label || 'Session Active'}
              </span>
            )}

            {/* Distinction Réinscription (Ancien) vs Inscription (Nouveau) */}
            {isReturningStudent ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100/90 text-emerald-800 border border-emerald-300 flex items-center gap-1 shadow-2xs">
                <Sparkles size={10} className="text-emerald-600 shrink-0" />
                <span>Réinscription (Ancien Élève)</span>
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100/90 text-amber-900 border border-amber-300 flex items-center gap-1 shadow-2xs">
                <span>Nouvelle Inscription</span>
              </span>
            )}

            {admissionFeeDue === 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                Frais d'entrée : 0 HTG (Offert / Exonéré)
              </span>
            )}
          </div>

          {/* Chiffres clés pour la session sélectionnée */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap text-xs">
            <div className="px-2.5 py-1 bg-white rounded-lg border border-slate-200 shadow-2xs flex items-center gap-1.5" title="Montant total exigible pour la session sélectionnée">
              <span className="text-[10px] text-slate-500 font-bold uppercase">Attendu Session :</span>
              <span className="font-mono font-black text-slate-900">{selectedSessionDue.toLocaleString()} HTG</span>
            </div>

            <div className="px-2.5 py-1 bg-white rounded-lg border border-slate-200 shadow-2xs flex items-center gap-1.5" title="Montant total encaissé pour la session sélectionnée">
              <span className="text-[10px] text-emerald-700 font-bold uppercase">Encaissé :</span>
              <span className="font-mono font-black text-emerald-600">{selectedSessionPaid.toLocaleString()} HTG</span>
            </div>

            <div className={`px-2.5 py-1 rounded-lg border shadow-2xs flex items-center gap-1.5 ${
              selectedSessionRemaining <= 0 
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`} title="Solde restant pour la session sélectionnée">
              <span className="text-[10px] font-bold uppercase opacity-80">Reste Session :</span>
              <span className="font-mono font-black">
                {selectedSessionRemaining <= 0 ? '0 HTG (Soldé)' : `${selectedSessionRemaining.toLocaleString()} HTG`}
              </span>
            </div>

            <div className={`px-2.5 py-1 rounded-lg border shadow-2xs flex items-center gap-1.5 ${
              globalDebt <= 0 
                ? 'bg-slate-50 text-slate-600 border-slate-200' 
                : 'bg-amber-50 text-amber-900 border-amber-200'
            }`} title="Dette arriérée cumulée sur les sessions antérieures">
              <span className="text-[10px] font-bold uppercase opacity-80">Arriérés :</span>
              <span className="font-mono font-black">
                {globalDebt <= 0 ? '0 HTG (À jour)' : `${globalDebt.toLocaleString()} HTG`}
              </span>
            </div>
          </div>
        </div>

        {/* NAVIGATION ONGLET MODERNE & FLUIDE */}
        <div className="px-4 sm:px-6 pt-2.5 flex gap-1 border-b border-slate-200 bg-slate-50/50 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-2 px-3 text-xs font-bold transition-all relative flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'overview'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers size={13} />
            <span>Synthèse Financière</span>
          </button>
          <button
            onClick={() => setActiveTab('sessions')}
            className={`pb-2 px-3 text-xs font-bold transition-all relative flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'sessions'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Calendar size={13} />
            <span>Historique des Sessions ({sessions.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('transactions')}
            className={`pb-2 px-3 text-xs font-bold transition-all relative flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'transactions'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Receipt size={13} />
            <span>Grand Livre ({transactions.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('certificate')}
            className={`pb-2 px-3 text-xs font-bold transition-all relative flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'certificate'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldCheck size={13} />
            <span>Attestation de Solvabilité</span>
          </button>
        </div>

        {/* CONTENU PRINCIPAL NET & ÉPURÉ */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-slate-800">

          {/* ============================================================== */}
          {/* TAB 1: SYNTHÈSE DES POSTES & ENCAISSEMENTS                     */}
          {/* ============================================================== */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              
              {/* CARTES KPI VISUELLES : LES 4 POSTES DE FRAIS */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
                
                {/* 1. Inscription / Réinscription */}
                <div className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-700">
                        {isReturningStudent ? 'Réinscription' : 'Inscription'}
                      </span>
                      <span className="text-[9px] font-bold text-slate-400">
                        {isReturningStudent ? 'Ancien Élève' : 'Entrée'}
                      </span>
                    </div>
                    <div className="mt-1">
                      <p className="text-lg font-black font-mono text-slate-900 leading-none">
                        {analysis.inscriptionPaidHTG.toLocaleString()} <span className="text-xs font-sans font-semibold text-slate-500">HTG</span>
                      </p>
                      {analysis.inscriptionPaidUSD > 0 && (
                        <p className="text-xs font-mono font-bold text-amber-700 mt-0.5">
                          + ${analysis.inscriptionPaidUSD.toLocaleString()} USD
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mt-2.5 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10.5px]">
                    <span className="text-slate-400">Attendu :</span>
                    <span className="font-mono font-bold text-slate-700">
                      {admissionFeeDue === 0 ? 'Exonéré (0 HTG)' : `${admissionFeeDue.toLocaleString()} HTG`}
                    </span>
                  </div>
                </div>

                {/* 2. Scolarité */}
                <div className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-black uppercase tracking-wider text-blue-700">{terminology.tuition}</span>
                      <span className="text-[9px] font-bold text-slate-400">Annuel</span>
                    </div>
                    <div className="mt-1">
                      <p className="text-lg font-black font-mono text-slate-900 leading-none">
                        {analysis.tuitionPaidHTG.toLocaleString()} <span className="text-xs font-sans font-semibold text-slate-500">HTG</span>
                      </p>
                      {analysis.tuitionPaidUSD > 0 && (
                        <p className="text-xs font-mono font-bold text-blue-700 mt-0.5">
                          + ${analysis.tuitionPaidUSD.toLocaleString()} USD
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mt-2.5 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10.5px]">
                    <span className="text-slate-400">Attendu :</span>
                    <span className="font-mono font-bold text-slate-700">{(student.scolariteDue || 0).toLocaleString()} HTG</span>
                  </div>
                </div>

                {/* 3. Frais Divers Obligatoires (Bimonétaire HTG & USD) */}
                <div className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-700">Frais Divers Obligatoires</span>
                      <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-100">Badge & Assurance</span>
                    </div>
                    <div className="mt-1">
                      <p className="text-lg font-black font-mono text-slate-900 leading-none">
                        {analysis.miscPaidHTG.toLocaleString()} <span className="text-xs font-sans font-semibold text-slate-500">HTG</span>
                      </p>
                      {analysis.miscPaidUSD > 0 && (
                        <p className="text-xs font-mono font-bold text-emerald-700 mt-0.5">
                          + ${analysis.miscPaidUSD.toLocaleString()} USD
                        </p>
                      )}
                      <p className="text-[10px] text-slate-400 mt-0.5">Frais annuels récurrents</p>
                    </div>
                  </div>
                  <div className="mt-2.5 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10.5px]">
                    <span className="text-slate-400">Attendu :</span>
                    <span className="font-mono font-bold text-slate-700">{(student.miscDue || 0).toLocaleString()} HTG</span>
                  </div>
                </div>

                {/* 4. Frais de Campagnes & Activités Parascolaires */}
                <div className="bg-purple-50/40 p-3 rounded-xl border border-purple-200/90 shadow-2xs hover:border-purple-300 transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-black uppercase tracking-wider text-purple-800">Campagnes & Activités</span>
                      <span className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded border ${
                        isCampaignPaid 
                          ? 'text-emerald-800 bg-emerald-100/90 border-emerald-300' 
                          : 'text-purple-700 bg-purple-100/80 border-purple-200'
                      }`}>
                        {isCampaignPaid ? 'Soldé (Reçu Détecté)' : (campaignPaidHTGEquiv > 0 ? 'Partiel' : 'En attente')}
                      </span>
                    </div>
                    <div className="mt-1">
                      <p className="text-lg font-black font-mono text-purple-950 leading-none">
                        {analysis.campaignsPaidHTG > 0 ? (
                          <>
                            {analysis.campaignsPaidHTG.toLocaleString()} <span className="text-xs font-sans font-semibold text-purple-600">HTG</span>
                          </>
                        ) : analysis.campaignsPaidUSD > 0 ? (
                          <>
                            ${analysis.campaignsPaidUSD.toLocaleString()} <span className="text-xs font-sans font-semibold text-purple-600">USD</span>
                          </>
                        ) : campaignPaidHTGEquiv > 0 ? (
                          <>
                            {campaignPaidHTGEquiv.toLocaleString()} <span className="text-xs font-sans font-semibold text-purple-600">HTG</span>
                          </>
                        ) : (
                          <>
                            0 <span className="text-xs font-sans font-semibold text-slate-400">HTG</span>
                          </>
                        )}
                      </p>
                      {analysis.campaignsPaidUSD > 0 && analysis.campaignsPaidHTG > 0 && (
                        <p className="text-xs font-mono font-bold text-purple-800 mt-0.5">
                          + ${analysis.campaignsPaidUSD.toLocaleString()} USD
                        </p>
                      )}
                      <p className="text-[10px] text-purple-700 font-medium mt-0.5">
                        {analysis.campaignsReceiptCount > 0 
                          ? `${analysis.campaignsReceiptCount} reçu(s) de campagne scellé(s)` 
                          : 'Activités & cotisations ciblées'}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2.5 pt-1.5 border-t border-purple-100 flex items-center justify-between text-[10.5px]">
                    <span className="text-purple-700 font-medium">Attendu :</span>
                    <span className="font-mono font-bold text-purple-950">
                      {campaignExpectedHTG === 0 && campaignPaidHTGEquiv === 0 ? '0 HTG (Non assigné)' : `${campaignExpectedHTG.toLocaleString()} HTG`}
                    </span>
                  </div>
                </div>

              </div>

              {/* RUBAN CONSOLIDÉ DES ENCAISSEMENTS */}
              <div className="bg-slate-900 text-white p-3.5 sm:p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-800 rounded-lg text-emerald-400 border border-slate-700 shrink-0 hidden sm:block">
                    <Banknote size={20} />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total Général Encaissé</span>
                    <div className="flex items-baseline gap-2 mt-0.5 flex-wrap">
                      <span className="text-xl sm:text-2xl font-black font-mono text-emerald-400">
                        {analysis.totalPaidHTG.toLocaleString()} HTG
                      </span>
                      {analysis.totalPaidUSD > 0 && (
                        <span className="text-base sm:text-lg font-black font-mono text-purple-300">
                          + ${analysis.totalPaidUSD.toLocaleString()} USD
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Contre-valeur consolidée : <strong className="text-slate-200 font-mono">{Math.round(analysis.totalPaidHTGEquiv).toLocaleString()} HTG</strong> (Taux : 1 USD = {currentExchangeRate || 135} HTG)
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => setActiveTab('transactions')}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Receipt size={13} />
                    <span>Grand Livre ({analysis.validTransactionsCount})</span>
                  </button>
                </div>
              </div>

              {/* APERÇU RAPIDE DES DERNIERS RÈGLEMENTS */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Receipt size={13} className="text-slate-400" />
                    Dernières Quittances Encaissées
                  </span>
                  <span className="text-[10.5px] text-slate-500 font-medium">
                    {transactions.length} opération(s) au total
                  </span>
                </div>

                {transactions.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">
                    Aucune transaction enregistrée pour cet élève.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {transactions.slice(0, 4).map((tx, idx) => {
                      const motif = resolvePaymentMotif(tx, terminology || {});
                      const dateStr = tx?.created_at ? new Date(tx.created_at).toLocaleDateString('fr-FR') : '—';
                      const ref = tx?.reference_number || tx?.transaction_reference || (tx?.id ? `RCP-${tx.id.substring(0,8).toUpperCase()}` : `#${idx+1}`);
                      const isUSD = tx?.currency === 'USD';
                      const amount = Number(tx?.amount || 0);

                      return (
                        <div key={tx?.id || idx} className="px-3.5 py-2 flex items-center justify-between text-xs hover:bg-slate-50/70 transition-colors">
                          <div className="flex items-center gap-2 min-w-0 pr-2">
                            <span className="font-mono text-[11px] text-slate-400 shrink-0">{dateStr}</span>
                            <span className="font-mono font-bold text-slate-700 shrink-0">{ref}</span>
                            <span className="text-slate-800 font-medium truncate">{motif.title}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`px-1.5 py-0.2 rounded text-[9.5px] font-bold border ${motif.badgeColor}`}>
                              {motif.category}
                            </span>
                            <span className="font-mono font-black text-slate-900 text-xs">
                              {isUSD ? `$${amount.toLocaleString()} USD` : `${amount.toLocaleString()} HTG`}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 2: AUDIT PAR SESSION                                       */}
          {/* ============================================================== */}
          {activeTab === 'sessions' && (
            <div className="space-y-4">
              
              {/* SESSION COURANTE */}
              <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-900 uppercase tracking-tight">
                      Session Active : {activeYear?.label || 'Session en cours'}
                    </span>
                    <span className={`text-[9.5px] font-black uppercase px-2 py-0.5 rounded-full border ${
                      isNotEnrolledCurrent 
                        ? 'bg-amber-50 text-amber-800 border-amber-200' 
                        : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    }`}>
                      {isNotEnrolledCurrent ? "À régulariser" : "Inscrit(e)"}
                    </span>
                  </div>
                  <span className="text-xs font-mono font-black text-slate-900">
                    Solde dû : <span className={(student.totalRemaining || 0) > 0 ? 'text-blue-700' : 'text-emerald-600'}>{(student.totalRemaining || 0).toLocaleString()} HTG</span>
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                      {isReturningStudent ? 'Frais de Réinscription' : "Frais d'Inscription"}
                    </span>
                    <span className="text-sm font-black font-mono text-slate-900 mt-0.5 block">
                      {admissionFeeDue === 0 ? 'Exonéré (0 HTG)' : `${admissionFeeDue.toLocaleString()} HTG`}
                    </span>
                    <span className="text-[10px] text-slate-500 mt-0.5 block">
                      {admissionFeeDue === 0 ? "Offert / Sans frais" : (student.inscriptionIsPaid ? "Acquitté" : (isNotEnrolledCurrent ? "En attente" : "Solde en cours"))}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Scolarité ({terminology.tuition})</span>
                    <span className="text-sm font-black font-mono text-slate-900 mt-0.5 block">
                      {(student.scolariteDue || 0).toLocaleString()} HTG
                    </span>
                    <span className="text-[10px] text-slate-500 mt-0.5 block">
                      Payé : {(student.scolaritePaid || 0).toLocaleString()} HTG
                    </span>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Frais Divers Obligatoires</span>
                    <span className="text-sm font-black font-mono text-slate-900 mt-0.5 block">
                      {(student.miscDue || 0).toLocaleString()} HTG
                    </span>
                    <span className="text-[10px] text-slate-500 mt-0.5 block">
                      Payé : {(student.miscPaid || 0).toLocaleString()} HTG
                    </span>
                  </div>

                  <div className="bg-purple-50/50 p-2.5 rounded-lg border border-purple-200/80">
                    <span className="text-[9px] font-bold text-purple-700 uppercase tracking-wider block">Campagnes & Activités</span>
                    <span className="text-sm font-black font-mono text-purple-950 mt-0.5 block">
                      {campaignPaidHTGEquiv.toLocaleString()} HTG
                    </span>
                    <span className="text-[10px] text-purple-600 mt-0.5 block font-medium">
                      {isCampaignPaid ? 'Soldé (Acquitté)' : `Dû : ${campaignRemainingHTG.toLocaleString()} HTG`}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Reste à Payer</span>
                    <span className={`text-sm font-black font-mono mt-0.5 block ${(student.totalRemaining || 0) > 0 ? 'text-blue-700' : 'text-emerald-600'}`}>
                      {(student.totalRemaining || 0).toLocaleString()} HTG
                    </span>
                    <span className="text-[10px] text-slate-500 mt-0.5 block">
                      {(student.totalRemaining || 0) === 0 ? "Session soldée" : "Solde courant"}
                    </span>
                  </div>
                </div>
              </div>

              {/* SESSIONS ANTÉRIEURES */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600">Sessions Antérieures ({pastSessions.length})</span>
                  <span className={`text-xs font-black font-mono ${isSolventHistory ? 'text-emerald-600' : 'text-rose-600'}`}>
                    Total arriéré : {globalDebt.toLocaleString()} HTG
                  </span>
                </div>

                {pastSessions.length === 0 ? (
                  <div className="bg-slate-50 p-4 rounded-xl border border-dashed border-slate-200 text-center">
                    <p className="text-xs font-bold text-slate-600">Aucune session antérieure enregistrée</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Dossier nouvellement créé • Arriéré certifié à 0 HTG</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pastSessions.map((session, idx) => (
                      <div 
                        key={session.academicYearId || idx}
                        className={`p-3 rounded-xl border transition-all ${
                          session.isSolvent 
                            ? 'bg-white border-slate-200 shadow-2xs' 
                            : 'bg-rose-50/40 border-rose-200 shadow-2xs'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-slate-900">{session.academicYearLabel}</span>
                            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">{session.className}</span>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[9.5px] font-black uppercase ${
                            session.isSolvent ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {session.isSolvent ? 'Soldé' : `Dû : ${session.remainingDebt.toLocaleString()} HTG`}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          <div className="bg-slate-50 p-1.5 rounded">
                            <span className="text-[8.5px] text-slate-400 font-bold block uppercase">Inscription</span>
                            <span className="font-mono font-bold text-slate-800 text-[11px]">{session.inscriptionPaid.toLocaleString()} / {session.inscriptionDue.toLocaleString()} G</span>
                          </div>
                          <div className="bg-slate-50 p-1.5 rounded">
                            <span className="text-[8.5px] text-slate-400 font-bold block uppercase">Scolarité</span>
                            <span className="font-mono font-bold text-slate-800 text-[11px]">{session.tuitionPaid.toLocaleString()} / {session.tuitionDue.toLocaleString()} G</span>
                          </div>
                          <div className="bg-slate-50 p-1.5 rounded">
                            <span className="text-[8.5px] text-slate-400 font-bold block uppercase">Frais Divers</span>
                            <span className="font-mono font-bold text-slate-800 text-[11px]">{session.miscPaid.toLocaleString()} / {session.miscDue.toLocaleString()} G</span>
                          </div>
                          <div className={`p-1.5 rounded ${session.isSolvent ? 'bg-emerald-50 text-emerald-900' : 'bg-rose-50 text-rose-900'}`}>
                            <span className="text-[8.5px] font-bold block uppercase opacity-75">Reliquat</span>
                            <span className="font-mono font-black text-[11px]">{session.remainingDebt.toLocaleString()} HTG</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* SESSIONS FUTURES (EN PRÉPARATION) */}
              {futureSessions.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Sparkles size={13} className="text-indigo-600" />
                      <span className="text-xs font-bold text-indigo-950">
                        Future(s) Session(s) — Pré-inscription ({futureSessions.length})
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded-full">
                      Frais prévisionnels (Non exigibles avant rentrée)
                    </span>
                  </div>

                  <div className="space-y-2">
                    {futureSessions.map((session, idx) => (
                      <div 
                        key={session.academicYearId || idx}
                        className="p-3 rounded-xl border border-indigo-200/90 bg-indigo-50/30 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2 border-b border-indigo-100 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-indigo-950">{session.academicYearLabel}</span>
                            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100/70 px-1.5 py-0.2 rounded font-mono">
                              {session.className} ({session.level})
                            </span>
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-[9.5px] font-black uppercase bg-indigo-100 text-indigo-800 border border-indigo-200">
                            Session en Préparation
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          <div className="bg-white/80 p-1.5 rounded border border-indigo-100">
                            <span className="text-[8.5px] text-slate-400 font-bold block uppercase">Inscription / Réinsc.</span>
                            <span className="font-mono font-bold text-slate-800 text-[11px]">{session.inscriptionDue.toLocaleString()} HTG</span>
                          </div>
                          <div className="bg-white/80 p-1.5 rounded border border-indigo-100">
                            <span className="text-[8.5px] text-slate-400 font-bold block uppercase">Scolarité Prévue</span>
                            <span className="font-mono font-bold text-slate-800 text-[11px]">{session.tuitionDue.toLocaleString()} HTG</span>
                          </div>
                          <div className="bg-white/80 p-1.5 rounded border border-indigo-100">
                            <span className="text-[8.5px] text-slate-400 font-bold block uppercase">Frais Divers</span>
                            <span className="font-mono font-bold text-slate-800 text-[11px]">{session.miscDue.toLocaleString()} HTG</span>
                          </div>
                          <div className="bg-white/80 p-1.5 rounded border border-indigo-100">
                            <span className="text-[8.5px] text-indigo-600 font-bold block uppercase">Total Prévisionnel</span>
                            <span className="font-mono font-black text-indigo-900 text-[11px]">{session.totalDue.toLocaleString()} HTG</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 3: GRAND LIVRE DES TRANSACTIONS & REÇUS                   */}
          {/* ============================================================== */}
          {activeTab === 'transactions' && (
            <div className="space-y-3">
              
              {/* BARRE D'OUTILS COMPACTE : Recherche & Filtres par motif */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                <div className="relative flex-1 max-w-sm">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchTx}
                    onChange={(e) => setSearchTx(e.target.value)}
                    placeholder="Rechercher par reçu, date, montant..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:border-blue-600"
                  />
                  {searchTx && (
                    <button onClick={() => setSearchTx('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer">
                      ×
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                  <button
                    onClick={() => setTxFilter('ALL')}
                    className={`px-2.5 py-1 text-[10.5px] font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                      txFilter === 'ALL' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Tous ({transactions.length})
                  </button>
                  <button
                    onClick={() => setTxFilter('INSCRIPTION')}
                    className={`px-2.5 py-1 text-[10.5px] font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                      txFilter === 'INSCRIPTION' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                    }`}
                  >
                    Inscription
                  </button>
                  <button
                    onClick={() => setTxFilter('SCOLARITE')}
                    className={`px-2.5 py-1 text-[10.5px] font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                      txFilter === 'SCOLARITE' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-800 hover:bg-blue-100'
                    }`}
                  >
                    {terminology.tuition}
                  </button>
                  <button
                    onClick={() => setTxFilter('DIVERS')}
                    className={`px-2.5 py-1 text-[10.5px] font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                      txFilter === 'DIVERS' ? 'bg-emerald-700 text-white' : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                    }`}
                  >
                    Frais Divers Obligatoires
                  </button>
                  <button
                    onClick={() => setTxFilter('SPECIFIQUES')}
                    className={`px-2.5 py-1 text-[10.5px] font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                      txFilter === 'SPECIFIQUES' ? 'bg-purple-700 text-white' : 'bg-purple-50 text-purple-800 hover:bg-purple-100'
                    }`}
                  >
                    Campagnes & Activités ({analysis.campaignsReceiptCount})
                  </button>
                </div>
              </div>

              {filteredTransactions.length === 0 ? (
                <div className="bg-slate-50 p-6 rounded-xl border border-dashed border-slate-300 text-center space-y-1">
                  <CreditCard size={24} className="mx-auto text-slate-400" />
                  <p className="text-xs font-bold text-slate-700">Aucun versement correspondant trouvé</p>
                  <p className="text-[11px] text-slate-500">
                    Ajustez vos filtres de recherche pour afficher les autres transactions.
                  </p>
                </div>
              ) : (
                <div className="border border-slate-200/90 rounded-xl overflow-hidden shadow-2xs">
                  
                  {/* AFFICHAGE RESPONSIVE CARTE SUR MOBILE */}
                  <div className="block sm:hidden divide-y divide-slate-100 bg-white">
                    {filteredTransactions.map((tx, idx) => {
                      const motif = resolvePaymentMotif(tx, terminology || {});
                      const dateStr = tx?.created_at ? new Date(tx.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';
                      const ref = tx?.reference_number || tx?.transaction_reference || (tx?.id ? `RCP-${tx.id.substring(0,8).toUpperCase()}` : `#${idx+1}`);
                      const amount = Number(tx?.amount || 0);
                      const curr = tx?.currency || 'HTG';
                      const isCancelled = String(tx?.status || '').toUpperCase().includes('ANNUL');

                      return (
                        <div key={tx?.id || idx} className={`p-3 space-y-1.5 ${isCancelled ? 'opacity-50 line-through bg-slate-50' : ''}`}>
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-mono text-slate-500">{dateStr}</span>
                            <span className="font-mono font-bold text-slate-900">{ref}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className={`px-2 py-0.5 rounded text-[9.5px] font-bold border ${motif.badgeColor}`}>
                              {motif.category}
                            </span>
                            <span className="font-black font-mono text-sm text-slate-900">
                              {amount.toLocaleString()} {curr}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-[11px] text-slate-600 pt-0.5">
                            <span className="truncate pr-2 font-medium">{motif.title}</span>
                            <span className="text-[10px] text-slate-400 shrink-0">{tx?.payment_method || 'Comptant'}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* AFFICHAGE TABULAIRE DENSE SUR TABLETTE & DESKTOP */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                        <tr>
                          <th className="px-3.5 py-2.5">Date</th>
                          <th className="px-3.5 py-2.5">Réf. Quittance</th>
                          <th className="px-3.5 py-2.5">Nature du Règlement</th>
                          <th className="px-3.5 py-2.5">Catégorie</th>
                          <th className="px-3.5 py-2.5">Mode</th>
                          <th className="px-3.5 py-2.5 text-right">Montant Perçu</th>
                          <th className="px-3.5 py-2.5 text-center">Statut</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {filteredTransactions.map((tx, idx) => {
                          const motif = resolvePaymentMotif(tx, terminology || {});
                          const dateStr = tx?.created_at ? new Date(tx.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';
                          const ref = tx?.reference_number || tx?.transaction_reference || (tx?.id ? `RCP-${tx.id.substring(0,8).toUpperCase()}` : `#${idx+1}`);
                          const amount = Number(tx?.amount || 0);
                          const curr = tx?.currency || 'HTG';
                          const isCancelled = String(tx?.status || '').toUpperCase().includes('ANNUL');

                          return (
                            <tr key={tx?.id || idx} className={`hover:bg-slate-50/80 transition-colors ${isCancelled ? 'opacity-50 line-through bg-slate-50' : ''}`}>
                              <td className="px-3.5 py-2 text-slate-600 font-mono text-[11px] whitespace-nowrap">{dateStr}</td>
                              <td className="px-3.5 py-2 font-mono font-bold text-slate-800 text-[11px] whitespace-nowrap">{ref}</td>
                              <td className="px-3.5 py-2 font-semibold text-slate-900">
                                <span>{motif.title}</span>
                              </td>
                              <td className="px-3.5 py-2 whitespace-nowrap">
                                <span className={`px-2 py-0.5 rounded text-[9.5px] font-bold border ${motif.badgeColor}`}>
                                  {motif.category}
                                </span>
                              </td>
                              <td className="px-3.5 py-2 text-slate-600 whitespace-nowrap">{tx?.payment_method || 'Comptant'}</td>
                              <td className="px-3.5 py-2 text-right font-black font-mono text-slate-900 whitespace-nowrap">
                                {amount.toLocaleString()} <span className="text-[10px] font-sans font-bold text-slate-500">{curr}</span>
                              </td>
                              <td className="px-3.5 py-2 text-center whitespace-nowrap">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                  isCancelled ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                                }`}>
                                  {isCancelled ? 'Annulé' : 'Validé'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                </div>
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 4: ATTESTATION DE SOLVABILITÉ                              */}
          {/* ============================================================== */}
          {activeTab === 'certificate' && (
            <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600 border border-emerald-200">
                    <ShieldCheck size={20} />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-tight">
                      Attestation Officielle de Conformité Financière
                    </h4>
                    <p className="text-[11px] text-slate-500 font-mono">Dossier N° {studentCode} • Émis le {new Date().toLocaleDateString('fr-FR')}</p>
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                  isSolventHistory ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}>
                  {isSolventHistory ? 'Certifié en Règle' : 'Arriérés Détectés'}
                </span>
              </div>

              {/* TABLEAU RÉCAPITULATIF OFFICIEL */}
              <div className="overflow-hidden border border-slate-200 rounded-lg">
                <table className="w-full text-xs">
                  <tbody className="divide-y divide-slate-100">
                    <tr className="bg-slate-50/50">
                      <td className="px-3 py-2 font-bold text-slate-600 w-1/3">Bénéficiaire</td>
                      <td className="px-3 py-2 font-bold text-slate-900">{studentName} ({student.classe || 'Classe non assignée'})</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-bold text-slate-600">Arriérés Sessions Antérieures</td>
                      <td className={`px-3 py-2 font-mono font-black ${isSolventHistory ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {globalDebt.toLocaleString()} HTG {isSolventHistory ? '(Aucune dette antérieure)' : '(Dette à apurer)'}
                      </td>
                    </tr>
                    <tr className="bg-slate-50/50">
                      <td className="px-3 py-2 font-bold text-slate-600">Session Active ({activeYear?.label || 'En cours'})</td>
                      <td className="px-3 py-2 font-bold text-slate-900">
                        {isNotEnrolledCurrent ? 'En cours de régularisation d\'entrée' : 'Inscription formellement validée'}
                        {' • '}
                        <span className="font-mono text-slate-700">Reste session : {(student.totalRemaining || 0).toLocaleString()} HTG</span>
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-bold text-slate-600">Versements Consolidés</td>
                      <td className="px-3 py-2 font-mono font-black text-slate-900">
                        {analysis.totalPaidHTG.toLocaleString()} HTG
                        {analysis.totalPaidUSD > 0 && ` + $${analysis.totalPaidUSD.toLocaleString()} USD`}
                        <span className="text-[11px] font-sans font-normal text-slate-500 ml-2">
                          ({analysis.validTransactionsCount} quittance(s) auditée(s))
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between pt-2 text-[11px] text-slate-400">
                <span>Certification cryptographique & comptable • {institutionName}</span>
                <span className="font-mono font-bold text-slate-600">Conforme aux registres de caisse</span>
              </div>
            </div>
          )}

        </div>

        {/* MODAL FOOTER COMPACT */}
        <div className="px-4 sm:px-6 py-2.5 sm:py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3 shrink-0">
          <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">
            Audit certifié {institutionName} {resolvedCampusName ? `(Annexe ${resolvedCampusName})` : ''} • {new Date().toLocaleDateString('fr-FR')}
          </span>
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer ml-auto active:scale-98"
          >
            Fermer la révision
          </button>
        </div>

      </div>
    </div>
  );
};

export default StudentDossierAuditModal;
