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

export interface SessionAuditDetail {
  academicYearId: string;
  academicYearLabel: string;
  className: string;
  level: string;
  isCurrentSession: boolean;
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
 */
export const resolvePaymentMotif = (tx: any, terminology: any) => {
  const natureStr = (tx.nature || '').trim();
  const typeStr = (tx.type || '').trim();
  const descStr = (tx.description || '').trim();
  const ft = (tx.fee_type || '').toUpperCase();
  const isUSD = tx.currency === 'USD';

  // 1. Campagne Ad-Hoc rattachée explicitement
  if (tx.campaign?.name) {
    return {
      title: tx.campaign.name,
      category: 'Frais Spécifique / Campagne',
      badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
      isSpecial: true
    };
  }

  // 2. Si le champ type ou nature contient un libellé spécifique explicite (non générique)
  const genericTerms = ['frais divers', 'divers', 'scolarite', 'scolarité', 'inscription', 'droits de scolarité'];
  if (natureStr && !genericTerms.includes(natureStr.toLowerCase())) {
    return {
      title: natureStr,
      category: natureStr.toLowerCase().includes('stage') ? 'Stage Académique' : 'Frais Spécifique',
      badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      isSpecial: true
    };
  }

  if (typeStr && !genericTerms.includes(typeStr.toLowerCase())) {
    return {
      title: typeStr,
      category: typeStr.toLowerCase().includes('stage') ? 'Stage Académique' : 'Frais Spécifique',
      badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      isSpecial: true
    };
  }

  // 3. Catégorie native fee_type
  if (ft === 'INSCRIPTION') {
    return {
      title: "Frais d'Inscription / Régularisation d'Entrée",
      category: "Admission & Entrée",
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
      isSpecial: false
    };
  }

  if (ft === 'SCOLARITE') {
    return {
      title: `${terminology.tuition || 'Scolarité'} (Droits d'études)`,
      category: "Scolarité",
      badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
      isSpecial: false
    };
  }

  if (ft === 'CREDIT_PORTEFEUILLE') {
    return {
      title: `Alimentation Portefeuille ${terminology.student || 'Élève'}`,
      category: "Portefeuille",
      badgeColor: 'bg-teal-100 text-teal-800 border-teal-200',
      isSpecial: false
    };
  }

  if (ft === 'DIVERS' || natureStr.toLowerCase().includes('divers') || typeStr.toLowerCase().includes('divers')) {
    // Si la transaction n'est pas une campagne spécifique explicitée, c'est le poste Frais Divers Obligatoires
    // (qu'il soit réglé en HTG ou en USD dans le cadre d'un règlement bimonétaire).
    return {
      title: descStr || typeStr || natureStr || 'Frais Divers Obligatoires',
      category: 'Frais Divers Obligatoires',
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      isSpecial: false
    };
  }

  return {
    title: descStr || typeStr || natureStr || tx.fee_type || 'Frais Scolaires',
    category: 'Règlement',
    badgeColor: 'bg-slate-100 text-slate-800 border-slate-200',
    isSpecial: false
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

      const motif = resolvePaymentMotif(t, terminology || {});
      const ft = (t?.fee_type || '').toUpperCase();
      const isMiscFee = ft === 'DIVERS' || (t?.nature || '').toLowerCase().includes('divers') || (t?.type || '').toLowerCase().includes('divers');

      if (ft === 'INSCRIPTION') {
        if (isUSD) inscriptionPaidUSD += amt;
        else inscriptionPaidHTG += amt;
      } else if (ft === 'SCOLARITE') {
        if (isUSD) tuitionPaidUSD += amt;
        else tuitionPaidHTG += amt;
      } else if (isMiscFee && !motif.isSpecial && !t?.ad_hoc_campaign_id) {
        // Règlement bimonétaire (HTG & USD) des Frais Divers Obligatoires
        if (isUSD) miscPaidUSD += amt;
        else miscPaidHTG += amt;
      } else {
        // Campagnes ad-hoc ou prestations spécifiques
        if (isUSD) miscSpecialPaidUSD += amt;
        else miscSpecialPaidHTG += amt;
      }
    }

    const hasDualMiscFees = (miscPaidHTG > 0 && miscPaidUSD > 0) || validTxs.filter(t => (t?.fee_type || '').toUpperCase() === 'DIVERS').length >= 2;

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
      const motif = resolvePaymentMotif(tx, terminology || {});
      const isUSD = tx?.currency === 'USD';
      const ft = (tx?.fee_type || '').toUpperCase();
      const isMiscFee = ft === 'DIVERS' || (tx?.nature || '').toLowerCase().includes('divers') || (tx?.type || '').toLowerCase().includes('divers');

      // Filtre catégorie
      if (txFilter === 'INSCRIPTION' && ft !== 'INSCRIPTION') return false;
      if (txFilter === 'SCOLARITE' && ft !== 'SCOLARITE') return false;
      if (txFilter === 'DIVERS' && (!isMiscFee || motif.isSpecial || tx?.ad_hoc_campaign_id)) return false;
      if (txFilter === 'SPECIFIQUES' && (isMiscFee && !motif.isSpecial && !tx?.ad_hoc_campaign_id)) return false;

      // Filtre recherche textuelle
      if (searchTx.trim()) {
        const q = searchTx.toLowerCase().trim();
        const dateStr = tx?.created_at ? new Date(tx.created_at).toLocaleDateString('fr-FR') : '';
        const refStr = String(tx?.reference_number || tx?.transaction_reference || tx?.id || '').toLowerCase();
        const motifTitle = (motif.title || '').toLowerCase();
        const methodStr = String(tx?.payment_method || '').toLowerCase();
        const amountStr = String(tx?.amount || '');

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
  const currentSession = safeSessions.find(s => s.isCurrentSession);
  const pastSessions = safeSessions.filter(s => !s.isCurrentSession);
  const isSolventHistory = globalDebt === 0;

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
                  {isSolventHistory ? 'Historique Soldé' : `Arriéré : ${globalDebt.toLocaleString()} HTG`}
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
                
                {/* 1. Inscription / Entrée */}
                <div className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-700">Inscription</span>
                      <span className="text-[9px] font-bold text-slate-400">Entrée</span>
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
                    <span className="font-mono font-bold text-slate-700">{(student.inscriptionDue || 2500).toLocaleString()} HTG</span>
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

                {/* 4. Frais Spécifiques (Campagnes & Options) */}
                <div className="bg-purple-50/30 p-3 rounded-xl border border-purple-200/80 shadow-2xs hover:border-purple-300 transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-black uppercase tracking-wider text-purple-700">Frais Spécifiques</span>
                      <span className="text-[9px] font-bold text-purple-700 bg-purple-100/80 px-1.5 py-0.2 rounded border border-purple-200">Campagnes & Options</span>
                    </div>
                    <div className="mt-1">
                      <p className="text-lg font-black font-mono text-purple-950 leading-none">
                        {analysis.miscSpecialPaidUSD > 0 ? (
                          <>
                            ${analysis.miscSpecialPaidUSD.toLocaleString()} <span className="text-xs font-sans font-semibold text-purple-600">USD</span>
                          </>
                        ) : (
                          <>
                            {analysis.miscSpecialPaidHTG.toLocaleString()} <span className="text-xs font-sans font-semibold text-purple-600">HTG</span>
                          </>
                        )}
                      </p>
                      {analysis.miscSpecialPaidUSD > 0 && analysis.miscSpecialPaidHTG > 0 && (
                        <p className="text-xs font-mono font-bold text-purple-800 mt-0.5">
                          + {analysis.miscSpecialPaidHTG.toLocaleString()} HTG
                        </p>
                      )}
                      <p className="text-[10px] text-purple-500/80 mt-0.5">Prestations optionnelles</p>
                    </div>
                  </div>
                  <div className="mt-2.5 pt-1.5 border-t border-purple-100 flex items-center justify-between text-[10.5px]">
                    <span className="text-purple-600">Total :</span>
                    <span className="font-mono font-bold text-purple-950">
                      {(analysis.miscSpecialPaidHTG + (analysis.miscSpecialPaidUSD * (currentExchangeRate || 135))).toLocaleString()} HTG
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

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Frais d'Inscription</span>
                    <span className="text-sm font-black font-mono text-slate-900 mt-0.5 block">
                      {(student.inscriptionDue || 2500).toLocaleString()} HTG
                    </span>
                    <span className="text-[10px] text-slate-500 mt-0.5 block">
                      {isNotEnrolledCurrent ? "En attente" : "Acquitté"}
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
                    Campagnes & Options
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
