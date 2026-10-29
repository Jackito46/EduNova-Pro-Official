import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Baby, 
  Coins, 
  TrendingDown, 
  Receipt, 
  ChevronRight, 
  Users, 
  Smartphone, 
  Calendar, 
  Info, 
  Printer, 
  Search, 
  FileText, 
  CheckCircle2, 
  Clock, 
  X, 
  Phone, 
  Mail, 
  MapPin, 
  MessageCircle, 
  ExternalLink, 
  ShieldCheck, 
  Sparkles,
  Layers,
  GraduationCap,
  Wallet,
  AlertCircle,
  Download,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../supabase';
import { UserProfile, SchoolType } from '../types';
import { formatStudentName } from '../utils/formatters';
import { PrintPreviewModal } from './PrintPreviewModal';
import { isWalletPaymentActive, isMonCashPaymentActive } from '../lib/paymentMethods';

interface ParentDashboardViewProps {
  user: UserProfile;
  school: any;
  terminology: any;
  parentStats: {
    childrenCount: number;
    totalPaid: number;
    totalDue: number;
    children: any[];
    payments: any[];
  };
  activeAcademicYear?: any;
  onTopUpStudentWallet: (child: any) => void;
  onRefresh?: () => void;
}

export const ParentDashboardView: React.FC<ParentDashboardViewProps> = ({
  user,
  school,
  terminology,
  parentStats,
  activeAcademicYear,
  onTopUpStudentWallet,
  onRefresh
}) => {
  // Check if school is an advanced institution (University, Higher/Professional School)
  const isAdvancedSchool = 
    school?.school_type === SchoolType.UNIVERSITY || 
    school?.school_type === SchoolType.PROFESSIONAL ||
    school?.school_type === 'UNIVERSITY' || 
    school?.school_type === 'PROFESSIONAL';

  // Filters and search for payments
  const [paymentSearch, setPaymentSearch] = useState('');
  const [selectedChildFilter, setSelectedChildFilter] = useState<string>('all');
  const [selectedFeeTypeFilter, setSelectedFeeTypeFilter] = useState<'all' | 'tuition' | 'wallet'>('all');

  // Simulation test state
  const [isSimulatingTranzak, setIsSimulatingTranzak] = useState<string | null>(null);
  const [simulationSuccessCard, setSimulationSuccessCard] = useState<any | null>(null);

  // Modals state
  const [selectedPaymentForReceipt, setSelectedPaymentForReceipt] = useState<any | null>(null);
  const [selectedChildForStatement, setSelectedChildForStatement] = useState<any | null>(null);
  const [selectedChildForDetail, setSelectedChildForDetail] = useState<any | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedChildForSchedule, setSelectedChildForSchedule] = useState<any | null>(null);
  const [showContactModal, setShowContactModal] = useState(false);

  // Exécution du test de simulation de dépôt via l'API Tranzak (SAGACETECH)
  const handleSimulateTranzakTest = async (child: any, testAmount: number = 100) => {
    if (!child) return;
    setIsSimulatingTranzak(child.id);
    try {
      const token = (await supabase.auth.getSession()).data?.session?.access_token;
      const res = await fetch('/api/tranzak/simulate-deposit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          schoolId: school?.id || child.school_id,
          studentId: child.id,
          studentName: `${child.first_name || ''} ${child.last_name || ''}`.trim(),
          referenceNumber: child.reference_number || '',
          amount: testAmount,
          operator: 'moncash',
          customerName: `${child.first_name || ''} ${child.last_name || ''}`.trim(),
          customerPhone: child.parent_phone || (user as any).phone || (user as any).phone_number || '50937000000'
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSimulationSuccessCard({
          childName: formatStudentName(child.last_name, child.first_name).fullName,
          amount: data.amount,
          reference: data.reference,
          receiptNumber: data.receipt_number,
          oldBalance: data.old_balance,
          newBalance: data.new_balance,
          timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        });
        toast.success(`Dépôt test Tranzak de ${data.amount} HTG validé sur le compte école et crédité sur le portefeuille de ${child.first_name} !`);
        if (onRefresh) {
          onRefresh();
        }
      } else {
        throw new Error(data.error || "Erreur lors de la simulation");
      }
    } catch (err: any) {
      toast.error(err.message || "Échec de la simulation Tranzak");
    } finally {
      setIsSimulatingTranzak(null);
    }
  };

  // Filtered payments
  const filteredPayments = useMemo(() => {
    let list = parentStats.payments || [];
    if (selectedChildFilter !== 'all') {
      list = list.filter(p => p.student_id === selectedChildFilter);
    }
    if (selectedFeeTypeFilter === 'wallet') {
      list = list.filter(p => 
        p.fee_type === 'CREDIT_PORTEFEUILLE' || 
        p.fee_type === 'RECHARGE_PORTEFEUILLE' || 
        (p.notes || '').toLowerCase().includes('portefeuille') ||
        (p.description || '').toLowerCase().includes('portefeuille')
      );
    } else if (selectedFeeTypeFilter === 'tuition') {
      list = list.filter(p => 
        p.fee_type !== 'CREDIT_PORTEFEUILLE' && 
        p.fee_type !== 'RECHARGE_PORTEFEUILLE' &&
        !(p.notes || '').toLowerCase().includes('portefeuille')
      );
    }
    if (paymentSearch.trim()) {
      const q = paymentSearch.toLowerCase().trim();
      list = list.filter(p => {
        const receiptNo = (p.receipt_number || '').toLowerCase();
        const studentName = p.student 
          ? `${p.student.first_name} ${p.student.last_name}`.toLowerCase() 
          : '';
        const feeType = (p.fee_type || p.nature || p.type || p.description || '').toLowerCase();
        const method = (p.payment_method || '').toLowerCase();
        const refNo = (p.reference_number || p.moncash_order_id || '').toLowerCase();
        return receiptNo.includes(q) || studentName.includes(q) || feeType.includes(q) || method.includes(q) || refNo.includes(q);
      });
    }
    return list;
  }, [parentStats.payments, selectedChildFilter, selectedFeeTypeFilter, paymentSearch]);

  // Latest payment
  const latestPayment = useMemo(() => {
    if (parentStats.payments && parentStats.payments.length > 0) {
      return parentStats.payments[0];
    }
    return null;
  }, [parentStats.payments]);

  // Cumul des soldes portefeuilles de tous les enfants
  const totalWalletHTG = useMemo(() => {
    return (parentStats.children || []).reduce((acc, c) => acc + (Number(c.wallet_balance_htg) || 0), 0);
  }, [parentStats.children]);

  // Enfant ayant le solde dû le plus urgent
  const childWithDue = useMemo(() => {
    return (parentStats.children || []).find(c => Number(c.dueAmount || 0) > 0) || parentStats.children?.[0];
  }, [parentStats.children]);

  // Execute print for receipt
  const executePrintReceipt = () => {
    window.print();
  };

  return (
    <div id="parent-dashboard-container" className="space-y-4 sm:space-y-5 lg:space-y-6 animate-in fade-in duration-300">
      {/* HEADER BANNER / CONTEXT */}
      <div id="parent-dashboard-header" className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 p-4 sm:p-5 text-white shadow-lg border border-indigo-900/40">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                {isAdvancedSchool ? "Portail Étudiant" : "Espace Famille"}
              </span>
              {activeAcademicYear && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-slate-200 border border-white/15">
                  {activeAcademicYear.name || activeAcademicYear.label || 'Année en cours'}
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              {isAdvancedSchool ? `Bonjour, ${user.full_name}` : `Espace Parents • ${user.full_name}`}
            </h1>
          </div>

          {/* Affichage direct du/des nom(s) de l'élève / des élèves */}
          {parentStats.children && parentStats.children.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-1 md:pt-0">
              <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-300 shrink-0">
                <GraduationCap size={15} className="text-indigo-400" />
                <span>{isAdvancedSchool ? "Étudiant :" : (parentStats.children.length > 1 ? "Élèves :" : "Élève :")}</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {parentStats.children.map((child) => {
                  const { fullName } = formatStudentName(child.last_name, child.first_name);
                  return (
                    <button
                      key={child.id}
                      type="button"
                      onClick={() => setSelectedChildForDetail(child)}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-bold text-white transition-all active:scale-95 cursor-pointer group"
                      title="Cliquer pour voir la fiche de l'élève"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 group-hover:scale-125 transition-transform" />
                      <span>{fullName}</span>
                      {child.class?.name && (
                        <span className="text-[10px] font-semibold text-indigo-300 bg-indigo-950/60 px-1.5 py-0.5 rounded-md border border-indigo-400/20">
                          {child.class.name}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        
        {/* Subtle decorative background glow */}
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* ========================================================================= */}
      {/* 1. BANDEAU DES ACTIONS PRIORITAIRES (QUICK ACTIONS HUB)                  */}
      {/* ========================================================================= */}
      <div id="parent-quick-actions-hub" className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 md:p-5 shadow-2xs border border-slate-200/80">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></div>
            <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-800">
              Actions Prioritaires &amp; Démarches Rapides
            </h2>
          </div>
          <span className="text-[11px] font-bold text-slate-400">
            {parentStats.children.length} {parentStats.children.length > 1 ? 'élèves rattachés' : 'élève rattaché'}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-2.5">
          {/* Action 1 : Renflouer le portefeuille */}
          <button
            type="button"
            onClick={() => {
              if (parentStats.children.length > 0) {
                onTopUpStudentWallet(parentStats.children[0]);
              }
            }}
            className="group flex flex-col items-center justify-center p-3 rounded-xl sm:rounded-2xl bg-gradient-to-br from-red-50 to-rose-50/60 hover:from-red-100/80 hover:to-rose-100/80 border border-red-200/70 transition-all text-center cursor-pointer shadow-2xs active:scale-95"
            title="Recharger le portefeuille de l'élève en ligne via MonCash / NatCash / Tranzak"
          >
            <div className="w-9 h-9 rounded-xl bg-red-600 text-white flex items-center justify-center shadow-xs group-hover:scale-110 transition-transform mb-1.5">
              <Smartphone size={18} />
            </div>
            <span className="text-xs font-black text-slate-900 leading-tight">Renflouer Portefeuille</span>
            <span className="text-[10px] font-bold text-red-600 mt-0.5">MonCash / Tranzak</span>
          </button>

          {/* Action 2 : Régulariser la scolarité */}
          <button
            type="button"
            onClick={() => {
              if (childWithDue) {
                setSelectedChildForStatement(childWithDue);
              }
            }}
            className="group flex flex-col items-center justify-center p-3 rounded-xl sm:rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-50/60 hover:from-indigo-100/80 hover:to-blue-100/80 border border-indigo-200/70 transition-all text-center cursor-pointer shadow-2xs active:scale-95"
            title="Consulter l'échéancier et régulariser la scolarité"
          >
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs group-hover:scale-110 transition-transform mb-1.5">
              <Coins size={18} />
            </div>
            <span className="text-xs font-black text-slate-900 leading-tight">Payer Scolarité</span>
            <span className="text-[10px] font-bold text-indigo-600 mt-0.5">
              {parentStats.totalDue > 0 ? `${parentStats.totalDue.toLocaleString()} G dû` : 'À jour'}
            </span>
          </button>

          {/* Action 3 : Relevé de compte */}
          <button
            type="button"
            onClick={() => {
              if (parentStats.children.length > 0) {
                setSelectedChildForStatement(parentStats.children[0]);
              }
            }}
            className="group flex flex-col items-center justify-center p-3 rounded-xl sm:rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50/60 hover:from-emerald-100/80 hover:to-teal-100/80 border border-emerald-200/70 transition-all text-center cursor-pointer shadow-2xs active:scale-95"
            title="Consulter le relevé financier officiel avec ventilation détaillée"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs group-hover:scale-110 transition-transform mb-1.5">
              <FileText size={18} />
            </div>
            <span className="text-xs font-black text-slate-900 leading-tight">Relevé de Compte</span>
            <span className="text-[10px] font-bold text-emerald-700 mt-0.5">Bilan Financier</span>
          </button>

          {/* Action 4 : Dernier reçu certifié */}
          <button
            type="button"
            onClick={() => {
              if (latestPayment) {
                setSelectedPaymentForReceipt(latestPayment);
              } else {
                const el = document.getElementById('section-payments-history');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }
            }}
            className="group flex flex-col items-center justify-center p-3 rounded-xl sm:rounded-2xl bg-gradient-to-br from-amber-50 to-yellow-50/60 hover:from-amber-100/80 hover:to-yellow-100/80 border border-amber-200/70 transition-all text-center cursor-pointer shadow-2xs active:scale-95"
            title="Visualiser et réimprimer le dernier reçu officiel scellé"
          >
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs group-hover:scale-110 transition-transform mb-1.5">
              <Receipt size={18} />
            </div>
            <span className="text-xs font-black text-slate-900 leading-tight">Dernier Reçu</span>
            <span className="text-[10px] font-bold text-amber-700 mt-0.5">
              {latestPayment ? `#${latestPayment.receipt_number || 'Reçu'}` : 'Historique'}
            </span>
          </button>

          {/* Action 5 : Horaires & Emploi du temps */}
          <button
            type="button"
            onClick={() => {
              if (parentStats.children.length > 0) {
                setSelectedChildForSchedule(parentStats.children[0]);
              }
              setShowScheduleModal(true);
            }}
            className="group flex flex-col items-center justify-center p-3 rounded-xl sm:rounded-2xl bg-gradient-to-br from-purple-50 to-violet-50/60 hover:from-purple-100/80 hover:to-violet-100/80 border border-purple-200/70 transition-all text-center cursor-pointer shadow-2xs active:scale-95"
            title="Consulter le planning et les horaires de cours de la classe"
          >
            <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs group-hover:scale-110 transition-transform mb-1.5">
              <Calendar size={18} />
            </div>
            <span className="text-xs font-black text-slate-900 leading-tight">Emploi du Temps</span>
            <span className="text-[10px] font-bold text-purple-700 mt-0.5">Planning Hebdo</span>
          </button>

          {/* Action 6 : Contacter l'école */}
          <button
            type="button"
            onClick={() => setShowContactModal(true)}
            className="group flex flex-col items-center justify-center p-3 rounded-xl sm:rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 hover:from-slate-100 hover:to-slate-200 border border-slate-200/80 transition-all text-center cursor-pointer shadow-2xs active:scale-95"
            title="Contacter la direction, le secrétariat ou l'économat"
          >
            <div className="w-9 h-9 rounded-xl bg-slate-800 text-white flex items-center justify-center shadow-xs group-hover:scale-110 transition-transform mb-1.5">
              <MessageCircle size={18} />
            </div>
            <span className="text-xs font-black text-slate-900 leading-tight">Contacter l'École</span>
            <span className="text-[10px] font-bold text-slate-600 mt-0.5">Assistance &amp; Bureau</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. KPI METRIC CARDS SYNTHÉTIQUES                                          */}
      {/* ========================================================================= */}
      <div id="parent-kpi-grid" className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        {/* Card 1: Children count */}
        <div id="parent-kpi-children" className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 border border-slate-200/80 shadow-2xs flex flex-col justify-between hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-400">
              {isAdvancedSchool ? "Mon Dossier" : "Mes Enfants"}
            </span>
            <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center border border-blue-100">
              {isAdvancedSchool ? <GraduationCap size={15} /> : <Baby size={15} />}
            </div>
          </div>
          <div>
            <p className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight font-mono">
              {isAdvancedSchool ? (parentStats.childrenCount > 0 ? "Actif" : "Non assigné") : parentStats.childrenCount}
            </p>
            <p className="mt-0.5 text-[11px] font-semibold text-slate-500 truncate">
              {parentStats.children?.length === 1
                ? `${formatStudentName(parentStats.children[0].last_name, parentStats.children[0].first_name).fullName}`
                : `${parentStats.childrenCount} ${terminology.students.toLowerCase()}`}
            </p>
          </div>
        </div>

        {/* Card 2: Total Paid */}
        <div id="parent-kpi-paid" className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 border border-slate-200/80 shadow-2xs flex flex-col justify-between hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-400">Total Versé</span>
            <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center border border-emerald-100">
              <Coins size={15} />
            </div>
          </div>
          <div>
            <p className="text-xl sm:text-2xl font-black text-emerald-600 tracking-tight font-mono">
              {parentStats.totalPaid.toLocaleString()} G
            </p>
            <p className="mt-0.5 text-[11px] font-semibold text-slate-400 truncate">
              {parentStats.payments?.length || 0} versement{(parentStats.payments?.length || 0) > 1 ? 's certifiés' : ' certifié'}
            </p>
          </div>
        </div>

        {/* Card 3: Remaining Balance */}
        <div id="parent-kpi-due" className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 border border-slate-200/80 shadow-2xs flex flex-col justify-between hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-400">Solde Scolarité</span>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${parentStats.totalDue > 0 ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
              <TrendingDown size={15} />
            </div>
          </div>
          <div>
            <p className={`text-xl sm:text-2xl font-black tracking-tight font-mono ${parentStats.totalDue > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {parentStats.totalDue.toLocaleString()} G
            </p>
            <p className="mt-0.5 text-[11px] font-bold truncate">
              {parentStats.totalDue > 0 ? (
                <span className="text-rose-600">À régulariser</span>
              ) : (
                <span className="text-emerald-600">✓ 100% à jour</span>
              )}
            </p>
          </div>
        </div>

        {/* Card 4: Total Wallet across all children */}
        <div id="parent-kpi-wallet" className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 border border-slate-200/80 shadow-2xs flex flex-col justify-between hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-400">Portefeuilles Famille</span>
            <div className="w-8 h-8 bg-cyan-50 text-cyan-600 rounded-xl flex items-center justify-center border border-cyan-100">
              <Wallet size={15} />
            </div>
          </div>
          <div>
            <p className="text-xl sm:text-2xl font-black text-cyan-700 tracking-tight font-mono">
              {totalWalletHTG.toLocaleString()} G
            </p>
            <p className="mt-0.5 text-[11px] font-semibold text-slate-500 truncate">
              Solde disponible (Cantine &amp; fournitures)
            </p>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* NOTIFICATION DE SUCCÈS SIMULATION TRANZAK DIRECT (si active)              */}
      {/* ========================================================================= */}
      {simulationSuccessCard && (
        <div className="bg-emerald-500/15 border-2 border-emerald-400/50 rounded-2xl p-4 text-emerald-950 space-y-2.5 animate-in zoom-in-95 duration-200 bg-white">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-emerald-200">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black">
                <CheckCircle2 size={18} />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 block">
                  Validation Immédiate • Compte École &amp; Portefeuille
                </span>
                <h4 className="text-sm font-black text-slate-900">
                  Dépôt Test Tranzak Validé (+{simulationSuccessCard.amount} HTG)
                </h4>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                {simulationSuccessCard.timestamp}
              </span>
              <button
                type="button"
                onClick={() => setSimulationSuccessCard(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              <span className="text-[10px] text-slate-400 block font-semibold">Bénéficiaire</span>
              <span className="font-bold text-slate-900 truncate block">{simulationSuccessCard.childName}</span>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              <span className="text-[10px] text-slate-400 block font-semibold">Réf. Tranzak</span>
              <span className="font-mono font-bold text-amber-700 text-[11px] truncate block">{simulationSuccessCard.reference}</span>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              <span className="text-[10px] text-slate-400 block font-semibold">Reçu Officiel</span>
              <span className="font-mono font-bold text-emerald-700 truncate block">#{simulationSuccessCard.receiptNumber}</span>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              <span className="text-[10px] text-slate-400 block font-semibold">Nouveau Solde</span>
              <span className="font-black text-emerald-700 text-sm font-mono truncate block">{simulationSuccessCard.newBalance.toLocaleString()} HTG</span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. CENTRE DE CONTRÔLE UNIFIÉ DES ENFANTS (CARTES ACTIONNABLES)           */}
      {/* ========================================================================= */}
      <div id="section-children-control-center" className="space-y-3 sm:space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-100">
              <Baby size={16} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                {isAdvancedSchool ? "Mon Centre de Contrôle Académique" : "Centre de Contrôle de Mes Enfants"}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Vue complète : scolarité, solde portefeuille, relevé et recharge pour chaque élève
              </p>
            </div>
          </div>
        </div>

        {parentStats.children.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-2xl sm:rounded-3xl border border-dashed border-slate-200">
            <Users className="mx-auto text-slate-300 mb-2" size={32} />
            <h4 className="text-sm font-bold text-slate-700">Aucun élève rattaché pour le moment</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Contactez le secrétariat pour associer votre adresse email à la fiche de votre enfant.
            </p>
            <button
              onClick={() => setShowContactModal(true)}
              className="mt-3 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-all cursor-pointer shadow-xs"
            >
              Contacter le secrétariat
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 sm:gap-4">
            {parentStats.children.map((child) => {
              const { fullName } = formatStudentName(child.last_name, child.first_name);
              const isSimulating = isSimulatingTranzak === child.id;
              const due = Number(child.dueAmount || 0);
              const paid = Number(child.paidAmount || 0);
              const expected = Number(child.expectedAmount || 0);
              const progressPct = expected > 0 ? Math.min(100, Math.round((paid / expected) * 100)) : 100;
              const walletBal = Number(child.wallet_balance_htg || 0);

              return (
                <div
                  key={child.id}
                  className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between space-y-3.5 group"
                >
                  {/* Identité de l'élève */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-blue-700 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-xs">
                        {child.first_name?.[0] || 'E'}{child.last_name?.[0] || 'N'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="text-sm sm:text-base font-black text-slate-900 truncate">
                            {fullName}
                          </h4>
                          <span className="text-[10px] font-bold px-2 py-0.2 bg-emerald-50 text-emerald-700 rounded-md border border-emerald-200">
                            Inscrit
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 font-semibold mt-0.5 truncate">
                          {child.class?.name || 'Classe non assignée'}
                          {child.reference_number && (
                            <span className="text-slate-400 font-mono font-normal ml-1.5">
                              • Matr: {child.reference_number}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0">
                      <button
                        type="button"
                        onClick={() => setSelectedChildForDetail(child)}
                        className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold text-xs rounded-xl border border-slate-200 transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                        title="Voir la fiche détaillée"
                      >
                        <span>Fiche</span>
                        <ChevronRight size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Volet Financier Double : Scolarité & Portefeuille */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Colonne 1 : Scolarité */}
                    <div className="p-3 rounded-2xl bg-slate-50/80 border border-slate-200/70 flex flex-col justify-between">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                          Scolarité
                        </span>
                        <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-md ${
                          due <= 0 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : 'bg-rose-100 text-rose-800'
                        }`}>
                          {due <= 0 ? '✓ Soldé' : `Reste ${due.toLocaleString()} G`}
                        </span>
                      </div>
                      
                      <div className="space-y-1">
                        <div className="flex items-baseline justify-between text-xs">
                          <span className="text-slate-500 font-medium">Déjà réglé :</span>
                          <span className="font-bold text-slate-900 font-mono">{paid.toLocaleString()} G</span>
                        </div>
                        {expected > 0 && (
                          <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-500 ${due <= 0 ? 'bg-emerald-500' : 'bg-indigo-600'}`} 
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Colonne 2 : Portefeuille Numérique */}
                    <div className="p-3 rounded-2xl bg-gradient-to-br from-emerald-50/90 to-teal-50/60 border border-emerald-200/80 flex flex-col justify-between">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1">
                          <Wallet size={13} className="text-emerald-700" />
                          <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wider">
                            Portefeuille
                          </span>
                        </div>
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded-md">
                          Cantine &amp; Ravitaillement
                        </span>
                      </div>

                      <div className="flex items-baseline justify-between">
                        <span className="text-xs text-slate-500 font-medium">Solde actuel :</span>
                        <span className="text-base font-black text-emerald-700 font-mono">
                          {walletBal.toLocaleString()} <span className="text-xs font-bold text-emerald-800">HTG</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Principales Directes de l'Enfant */}
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {/* Action 1 : Renflouer Portefeuille MonCash (Priorité Absolue) */}
                      <button
                        type="button"
                        onClick={() => onTopUpStudentWallet(child)}
                        className="py-2.5 px-3 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                        title="Recharger le portefeuille de l'élève en ligne via MonCash / Tranzak"
                      >
                        <Smartphone size={14} />
                        <span>Renflouer Portefeuille</span>
                      </button>

                      {/* Action 2 : Relevé de Compte & Dettes */}
                      <button
                        type="button"
                        onClick={() => setSelectedChildForStatement(child)}
                        className="py-2.5 px-3 bg-white hover:bg-slate-50 border border-slate-200 hover:border-indigo-300 text-slate-700 hover:text-indigo-700 font-bold text-xs rounded-xl shadow-2xs transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                        title="Consulter le relevé financier des versements de cet élève"
                      >
                        <FileText size={14} className="text-indigo-600" />
                        <span>Relevé des Frais</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Action 3 : Emploi du temps */}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedChildForSchedule(child);
                          setShowScheduleModal(true);
                        }}
                        className="flex-1 py-1.5 px-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                        title="Horaires de cours de sa classe"
                      >
                        <Calendar size={13} className="text-purple-600" />
                        <span>Horaires</span>
                      </button>

                      {/* Action 4 : Simulation Dépôt Test Tranzak (+100 HTG) */}
                      <button
                        type="button"
                        onClick={() => handleSimulateTranzakTest(child, 100)}
                        disabled={isSimulating}
                        className="flex-1 py-1.5 px-2.5 bg-amber-50/70 hover:bg-amber-100/80 text-amber-900 border border-amber-200/80 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-95 disabled:opacity-50"
                        title="Test express de dépôt via l'API Tranzak SAGETECK (+100 HTG) pour vérifier la bonne réception"
                      >
                        {isSimulating ? (
                          <>
                            <Loader2 size={13} className="animate-spin text-amber-600" />
                            <span>Validation...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles size={13} className="text-amber-600" />
                            <span>Tester Dépôt (+100 G)</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 2: HISTORIQUE ET JOURNAL DES VERSEMENTS DÉJÀ EFFECTUÉS */}
      <div id="section-payments-history" className="bg-white rounded-2xl sm:rounded-3xl shadow-2xs border border-slate-100/90 p-4 sm:p-5 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 sm:mb-5">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-100">
                <Receipt size={16} />
              </div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                Versements Effectués & Historique des Reçus
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Tous les règlements enregistrés par l'établissement avec réimpression certifiée des reçus officiels.
            </p>
          </div>

          {/* Search & filters controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Onglets Filtres Nature Paiement */}
            <div className="flex flex-wrap items-center gap-1 p-0.5 bg-slate-100 rounded-xl border border-slate-200/80">
              <button
                type="button"
                onClick={() => setSelectedFeeTypeFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedFeeTypeFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tous ({parentStats.payments?.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setSelectedFeeTypeFilter('tuition')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedFeeTypeFilter === 'tuition'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Scolarité
              </button>
              <button
                type="button"
                onClick={() => setSelectedFeeTypeFilter('wallet')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  selectedFeeTypeFilter === 'wallet'
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Wallet size={12} className="text-emerald-600" />
                <span>Dépôts Portefeuille</span>
                {(() => {
                  const count = (parentStats.payments || []).filter(p => 
                    p.fee_type === 'CREDIT_PORTEFEUILLE' || 
                    p.fee_type === 'RECHARGE_PORTEFEUILLE' || 
                    (p.notes || '').toLowerCase().includes('portefeuille')
                  ).length;
                  return count > 0 ? (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black bg-emerald-100 text-emerald-800">
                      {count}
                    </span>
                  ) : null;
                })()}
              </button>
            </div>

            {parentStats.children.length > 1 && (
              <select
                id="select-filter-child-payments"
                value={selectedChildFilter}
                onChange={(e) => setSelectedChildFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg sm:rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="all">Tous les enfants ({parentStats.children.length})</option>
                {parentStats.children.map((c) => (
                  <option key={c.id} value={c.id}>
                    {formatStudentName(c.last_name, c.first_name).fullName}
                  </option>
                ))}
              </select>
            )}

            <div className="relative min-w-[200px] flex-1 sm:flex-initial">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
              <input
                type="text"
                id="input-search-payments"
                placeholder="Rechercher reçu, élève..."
                value={paymentSearch}
                onChange={(e) => setPaymentSearch(e.target.value)}
                className="w-full pl-8 pr-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg sm:rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {paymentSearch && (
                <button 
                  onClick={() => setPaymentSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Payments list / table */}
        {filteredPayments.length > 0 ? (
          <div className="overflow-x-auto rounded-xl sm:rounded-2xl border border-slate-100">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50/80 text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100">
                <tr>
                  <th className="py-2.5 px-3">N° Reçu</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">{isAdvancedSchool ? "Étudiant" : "Élève"}</th>
                  <th className="py-2.5 px-3">Nature / Objet</th>
                  <th className="py-2.5 px-3">Mode &amp; Réf</th>
                  <th className="py-2.5 px-3 text-right">Montant</th>
                  <th className="py-2.5 px-3 text-center">Statut</th>
                  <th className="py-2.5 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPayments.map((p) => {
                  const paymentDate = p.payment_date || p.created_at;
                  const formattedDate = paymentDate ? new Date(paymentDate).toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                  }) : '-';
                  const studentObj = p.student || parentStats.children.find(c => c.id === p.student_id);
                  const isMonCash = (p.payment_method || '').toLowerCase().includes('moncash');
                  const isNatcash = (p.payment_method || '').toLowerCase().includes('natcash');
                  const isTranzak = (p.payment_method || '').toLowerCase().includes('tranzak') || (p.reference_number || '').startsWith('TZK-');
                  const isWalletDeposit = p.fee_type === 'CREDIT_PORTEFEUILLE' || 
                    p.fee_type === 'RECHARGE_PORTEFEUILLE' || 
                    (p.notes || '').toLowerCase().includes('portefeuille');

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 text-indigo-700 bg-indigo-50/80 px-1.5 py-0.5 rounded text-[11px] border border-indigo-100">
                          #{p.receipt_number || 'SANS-NO'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-600 whitespace-nowrap text-[11px] sm:text-xs">
                        {formattedDate}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-800 whitespace-nowrap">
                        {studentObj 
                          ? formatStudentName(studentObj.last_name, studentObj.first_name).fullName 
                          : 'Élève'}
                        {studentObj?.class?.name && (
                          <span className="block text-[10px] font-normal text-slate-400">
                            {studentObj.class.name}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-700 text-[11px] sm:text-xs">
                        {isWalletDeposit ? (
                          <div className="flex flex-col items-start gap-0.5">
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              <Wallet size={11} className="text-emerald-600 shrink-0" />
                              Dépôt Portefeuille
                            </span>
                            <span className="text-[9.5px] text-slate-400">Cantine & Fournitures</span>
                          </div>
                        ) : (
                          <span className="font-medium text-slate-800">
                            {p.fee_type || p.nature || p.type || p.description || 'Scolarité'}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="flex flex-col items-start gap-0.5">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                            isTranzak
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : isMonCash 
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : isNatcash
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}>
                            {p.payment_method || 'Espèces'}
                          </span>
                          {(p.reference_number || p.moncash_order_id) && (
                            <span className="text-[9.5px] font-mono text-slate-400 truncate max-w-[120px]" title={p.reference_number || p.moncash_order_id}>
                              Réf: {p.reference_number || p.moncash_order_id}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-black text-slate-900 whitespace-nowrap text-[11px] sm:text-xs">
                        {p.currency === 'USD' ? (
                          <div className="flex flex-col items-end">
                            <span className="font-bold text-emerald-700 font-mono">
                              ${Number(p.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} USD
                            </span>
                            <div className="text-[10px] text-slate-500 font-medium font-mono">
                              ≈ {Number(p.amount_htg_equivalent || (Number(p.amount || 0) * (p.exchange_rate_applied || 140))).toLocaleString()} HTG
                            </div>
                            {p.exchange_rate_applied && (
                              <div className="mt-0.5 inline-flex items-center gap-1 text-[9.5px] font-mono font-bold text-amber-900 bg-amber-50 border border-amber-300 px-1.5 py-0.2 rounded" title={`Taux scellé à l'encaissement : 1 USD = ${p.exchange_rate_applied} HTG`}>
                                <ShieldCheck size={10} className="text-amber-700 shrink-0" />
                                <span>1 USD = {p.exchange_rate_applied} HTG</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="font-bold text-slate-900 font-mono">
                            {Number(p.amount_htg_equivalent || p.amount || 0).toLocaleString()} HTG
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 size={10} />
                          Validé
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedPaymentForReceipt(p)}
                          className="px-2 py-0.5 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-indigo-700 rounded-md text-[11px] font-bold transition-all shadow-2xs flex items-center gap-1 mx-auto cursor-pointer"
                          title="Imprimer / Visualiser le reçu certifié"
                        >
                          <Printer size={12} />
                          <span>Reçu</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center bg-slate-50/50 rounded-xl sm:rounded-2xl border border-dashed border-slate-200">
            <Receipt className="mx-auto text-slate-300 mb-1.5" size={28} />
            <p className="text-xs sm:text-sm font-bold text-slate-700">Aucun versement trouvé</p>
            <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
              {paymentSearch || selectedChildFilter !== 'all'
                ? "Aucun résultat ne correspond à vos filtres de recherche."
                : "Les paiements de scolarité et inscriptions apparaîtront ici dès leur validation par l'école."}
            </p>
            {(paymentSearch || selectedChildFilter !== 'all') && (
              <button
                onClick={() => {
                  setPaymentSearch('');
                  setSelectedChildFilter('all');
                }}
                className="mt-2.5 px-3 py-1 bg-slate-200 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-300 transition-all cursor-pointer"
              >
                Réinitialiser les filtres
              </button>
            )}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1 : IMPRESSION DE REÇU OFFICIEL                                     */}
      {/* ========================================================================= */}
      {selectedPaymentForReceipt && (
        <PrintPreviewModal
          isOpen={!!selectedPaymentForReceipt}
          onClose={() => setSelectedPaymentForReceipt(null)}
          title={`Reçu de Versement #${selectedPaymentForReceipt.receipt_number || 'N/A'}`}
          subtitle="Document officiel de paiement • EduNova Pro"
          onPrint={executePrintReceipt}
        >
          {(() => {
            const p = selectedPaymentForReceipt;
            const studentObj = p.student || parentStats.children.find(c => c.id === p.student_id);
            const dateStr = p.payment_date || p.created_at;
            const formattedDate = dateStr ? new Date(dateStr).toLocaleDateString('fr-FR', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            }) : new Date().toLocaleDateString('fr-FR');

            return (
              <div id="parent-official-receipt-print" className="bg-white p-6 sm:p-8 max-w-[80mm] sm:max-w-[100mm] mx-auto shadow-xl rounded-2xl border border-slate-200 text-black font-sans leading-tight print:shadow-none print:border-none print:m-0 print:p-2 print:max-w-none print:w-[80mm]">
                {/* Header établissement */}
                <div className="text-center border-b-2 border-black pb-3 mb-3">
                  <h2 className="font-black text-xs sm:text-sm uppercase tracking-tight text-black break-words leading-tight">
                    {school?.name || "ÉTABLISSEMENT SCOLAIRE"}
                  </h2>
                  <p className="text-[10px] text-gray-700 mt-0.5">
                    {school?.address || "Port-au-Prince, Haïti"}
                  </p>
                  {school?.phone && (
                    <p className="text-[10px] text-gray-700">Tél: {school.phone}</p>
                  )}
                  <div className="mt-2 inline-block border border-black px-2 py-0.5 text-[9px] font-black uppercase tracking-widest bg-gray-100">
                    REÇU OFFICIEL DE CAISSE
                  </div>
                </div>

                {/* Métadonnées du reçu */}
                <div className="space-y-1.5 text-[11px] border-b border-dashed border-gray-400 pb-3 mb-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">N° Reçu :</span>
                    <span className="font-black font-mono">#{p.receipt_number || 'SANS-NO'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Date & Heure :</span>
                    <span className="font-bold">{formattedDate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Session :</span>
                    <span className="font-bold">{activeAcademicYear?.name || activeAcademicYear?.label || 'En cours'}</span>
                  </div>
                  {p.payment_method && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Mode Règlement :</span>
                      <span className="font-black uppercase">{p.payment_method}</span>
                    </div>
                  )}
                </div>

                {/* Élève concerné */}
                <div className="bg-gray-50 border border-gray-200 p-2.5 rounded-lg mb-3 text-[11px] space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-600 font-semibold">{isAdvancedSchool ? "Étudiant :" : "Élève :"}</span>
                    <span className="font-black text-black">
                      {studentObj ? formatStudentName(studentObj.last_name, studentObj.first_name).fullName : 'Élève'}
                    </span>
                  </div>
                  {studentObj?.class?.name && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Classe :</span>
                      <span className="font-bold">{studentObj.class.name}</span>
                    </div>
                  )}
                  {studentObj?.reference_number && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Matricule :</span>
                      <span className="font-mono font-bold">{studentObj.reference_number}</span>
                    </div>
                  )}
                </div>

                {/* Détail du versement */}
                <div className="border-b border-black pb-3 mb-3">
                  <div className="flex justify-between font-black text-xs pb-1 border-b border-gray-300 mb-1.5">
                    <span>TYPE DE FRAIS / DÉSIGNATION</span>
                    <span>MONTANT</span>
                  </div>
                  <div className="flex justify-between text-[11px] font-semibold py-1">
                    <span className="font-bold text-black uppercase">{p.fee_type || p.nature || p.type || p.description || 'Paiement scolarité'}</span>
                    <span className="text-right">
                      {p.currency === 'USD' ? (
                        <>
                          <span className="font-bold">${Number(p.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} USD ({Number(p.amount_htg_equivalent || (Number(p.amount || 0) * (p.exchange_rate_applied || 140))).toLocaleString()} HTG)</span>
                          <span className="block text-[9px] text-gray-700 font-mono font-bold">Taux de conversion : 1 USD = {p.exchange_rate_applied || 140} HTG</span>
                        </>
                      ) : (p.currency === 'USD' || p.original_currency === 'USD' || (p as any).fee_currency === 'USD') && p.exchange_rate_applied ? (
                        <>
                          <span className="font-bold">{Number(p.amount_htg_equivalent || p.amount || 0).toLocaleString()} HTG</span>
                          <span className="block text-[9px] text-gray-700 font-mono font-bold">Taux de conversion : 1 USD = {p.exchange_rate_applied} HTG (≈ ${(Number(p.amount_htg_equivalent || p.amount || 0) / Number(p.exchange_rate_applied)).toFixed(2)} USD)</span>
                        </>
                      ) : (
                        <span className="font-bold">{Number(p.amount_htg_equivalent || p.amount || 0).toLocaleString()} HTG</span>
                      )}
                    </span>
                  </div>
                  {p.description && p.description !== p.fee_type && (
                    <p className="text-[10px] text-gray-600 italic mt-0.5">
                      Détails : {p.description}
                    </p>
                  )}
                </div>

                {/* Total */}
                <div className="flex justify-between items-center text-sm font-black border-b-2 border-black pb-2 mb-3">
                  <span>TOTAL REÇU :</span>
                  <span>
                    {p.currency === 'USD'
                      ? `$${Number(p.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} USD (${Number(p.amount_htg_equivalent || (Number(p.amount || 0) * (p.exchange_rate_applied || 140))).toLocaleString()} HTG)`
                      : `${Number(p.amount_htg_equivalent || p.amount || 0).toLocaleString()} HTG`}
                  </span>
                </div>

                {/* Pied de page certifié */}
                <div className="text-center text-[9px] text-gray-600 space-y-1 pt-1">
                  <p className="font-bold uppercase tracking-wider text-black">Certification Électronique EduNova Pro</p>
                  <p className="text-[8px] font-mono opacity-80">Réf: {p.id?.slice(0, 16) || 'SEC-CERT-OK'}</p>
                  <p className="italic">Conservez ce reçu comme preuve de paiement légale.</p>
                </div>
              </div>
            );
          })()}
        </PrintPreviewModal>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2 : RELEVÉ DE PAIEMENTS & SITUATION DE L'ÉLÈVE                       */}
      {/* ========================================================================= */}
      {selectedChildForStatement && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl sm:rounded-3xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl border border-slate-100 max-h-[85vh] sm:max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className="w-10 h-10 sm:w-11 sm:h-11 bg-indigo-50 text-indigo-600 rounded-xl sm:rounded-2xl flex items-center justify-center font-black text-base sm:text-lg border border-indigo-100 shrink-0">
                  <FileText size={20} />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900">
                    Relevé Financier & Versements
                  </h3>
                  <p className="text-xs text-slate-500 font-semibold mt-0.5">
                    {formatStudentName(selectedChildForStatement.last_name, selectedChildForStatement.first_name).fullName} • {selectedChildForStatement.class?.name || 'Classe non assignée'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedChildForStatement(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg sm:rounded-xl transition-colors cursor-pointer"
              >
                <X size={17} />
              </button>
            </div>

            {/* Content: Summary & Payments of this child */}
            <div className="overflow-y-auto py-4 space-y-4 flex-1 pr-1">
              {/* Financial summary pills */}
              <div className={`grid gap-2.5 ${isWalletPaymentActive(school) ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2'}`}>
                <div className="p-3 rounded-xl sm:rounded-2xl bg-emerald-50 border border-emerald-100">
                  <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Total Versé</p>
                  <p className="text-base sm:text-lg font-black text-emerald-800 mt-0.5">
                    {(parentStats.payments?.filter(p => p.student_id === selectedChildForStatement.id)
                      .reduce((acc, p) => acc + Number(p.amount_htg_equivalent || p.amount || 0), 0) || 0).toLocaleString()} G
                  </p>
                </div>
                {isWalletPaymentActive(school) && (
                  <div className="p-3 rounded-xl sm:rounded-2xl bg-indigo-50 border border-indigo-100">
                    <p className="text-[10px] font-black uppercase tracking-wider text-indigo-700">Portefeuille</p>
                    <p className="text-base sm:text-lg font-black text-indigo-800 mt-0.5">
                      {(selectedChildForStatement.wallet_balance_htg || 0).toLocaleString()} HTG
                    </p>
                  </div>
                )}
                <div className={`p-3 rounded-xl sm:rounded-2xl bg-slate-50 border border-slate-200 ${isWalletPaymentActive(school) ? 'col-span-2 sm:col-span-1' : ''}`}>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-600">Nb de Reçus</p>
                  <p className="text-base sm:text-lg font-black text-slate-800 mt-0.5">
                    {parentStats.payments?.filter(p => p.student_id === selectedChildForStatement.id).length || 0}
                  </p>
                </div>
              </div>

              {/* Transactions list of this child */}
              <div>
                <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
                  Historique des Règlements de cet Élève
                </h4>
                {(() => {
                  const childPayments = parentStats.payments?.filter(p => p.student_id === selectedChildForStatement.id) || [];
                  if (childPayments.length === 0) {
                    return (
                      <div className="p-5 text-center bg-slate-50 rounded-xl border border-slate-100">
                        <Receipt className="mx-auto text-slate-300 mb-1.5" size={22} />
                        <p className="text-xs font-bold text-slate-600">Aucun versement enregistré pour cet élève.</p>
                      </div>
                    );
                  }
                  return (
                    <div className="space-y-1.5">
                      {childPayments.map(p => (
                        <div key={p.id} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/80 border border-slate-100 hover:bg-slate-50 transition-colors">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-mono font-bold text-indigo-700">#{p.receipt_number || 'SANS-NO'}</span>
                              <span className="text-xs font-bold text-slate-800">{p.fee_type || 'Scolarité'}</span>
                            </div>
                            <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">
                              {p.payment_date ? new Date(p.payment_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : '-'} • {p.payment_method || 'Espèces'}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-right">
                              {p.currency === 'USD' ? (
                                <div>
                                  <span className="text-xs sm:text-sm font-black text-emerald-700 font-mono">
                                    ${Number(p.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} USD
                                  </span>
                                  <div className="text-[10px] text-slate-400 font-medium font-mono">
                                    ≈ {Number(p.amount_htg_equivalent || (Number(p.amount || 0) * (p.exchange_rate_applied || 140))).toLocaleString()} HTG
                                  </div>
                                </div>
                              ) : (
                                <span className="text-xs sm:text-sm font-black text-slate-900 font-mono">
                                  {Number(p.amount_htg_equivalent || p.amount || 0).toLocaleString()} HTG
                                </span>
                              )}
                            </div>
                            <button
                              onClick={() => {
                                setSelectedPaymentForReceipt(p);
                              }}
                              className="p-1 bg-white hover:bg-indigo-50 border border-slate-200 text-indigo-700 rounded-md transition-colors cursor-pointer"
                              title="Imprimer ce reçu"
                            >
                              <Printer size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              {isWalletPaymentActive(school) && isMonCashPaymentActive(school) && (
                <button
                  type="button"
                  onClick={() => {
                    onTopUpStudentWallet(selectedChildForStatement);
                    setSelectedChildForStatement(null);
                  }}
                  className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg sm:rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Smartphone size={13} />
                  <span>Recharger MonCash</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedChildForStatement(null)}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg sm:rounded-xl text-xs font-bold transition-all cursor-pointer ml-auto"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3 : FICHE SCOLAIRE DE L'ÉLÈVE                                      */}
      {/* ========================================================================= */}
      {selectedChildForDetail && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl sm:rounded-3xl max-w-lg w-full p-4 sm:p-6 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className="w-10 h-10 sm:w-11 sm:h-11 bg-gradient-to-br from-indigo-500 to-indigo-700 text-white rounded-xl sm:rounded-2xl flex items-center justify-center font-black text-base sm:text-lg shadow-2xs shrink-0">
                  {selectedChildForDetail.first_name?.[0] || 'E'}{selectedChildForDetail.last_name?.[0] || 'N'}
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900">
                    Fiche {isAdvancedSchool ? "Étudiant" : "Scolaire"}
                  </h3>
                  <p className="text-xs text-slate-500 font-semibold mt-0.5">
                    {formatStudentName(selectedChildForDetail.last_name, selectedChildForDetail.first_name).fullName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedChildForDetail(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg sm:rounded-xl transition-colors cursor-pointer"
              >
                <X size={17} />
              </button>
            </div>

            <div className="py-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-2.5 rounded-xl sm:rounded-2xl bg-slate-50 border border-slate-100">
                  <p className="text-[10px] font-black uppercase text-slate-400">Classe / Niveau</p>
                  <p className="text-xs font-bold text-slate-900 mt-0.5">
                    {selectedChildForDetail.class?.name || 'Non assigné'}
                  </p>
                </div>
                <div className="p-2.5 rounded-xl sm:rounded-2xl bg-slate-50 border border-slate-100">
                  <p className="text-[10px] font-black uppercase text-slate-400">Matricule</p>
                  <p className="text-xs font-mono font-bold text-slate-900 mt-0.5">
                    {selectedChildForDetail.reference_number || 'Non renseigné'}
                  </p>
                </div>
                <div className="p-2.5 rounded-xl sm:rounded-2xl bg-slate-50 border border-slate-100">
                  <p className="text-[10px] font-black uppercase text-slate-400">Statut</p>
                  <p className="text-xs font-bold text-emerald-600 mt-0.5">
                    {selectedChildForDetail.status || 'Actif'}
                  </p>
                </div>
                {isWalletPaymentActive(school) && (
                  <div className="p-2.5 rounded-xl sm:rounded-2xl bg-emerald-50 border border-emerald-100">
                    <p className="text-[10px] font-black uppercase text-emerald-700">Portefeuille Électronique</p>
                    <p className="text-xs font-bold text-emerald-900 mt-0.5">
                      {(selectedChildForDetail.wallet_balance_htg || 0).toLocaleString()} HTG
                    </p>
                  </div>
                )}
              </div>

              {selectedChildForDetail.date_of_birth && (
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex justify-between">
                  <span className="text-slate-500">Date de naissance :</span>
                  <span className="font-bold text-slate-800">
                    {new Date(selectedChildForDetail.date_of_birth).toLocaleDateString('fr-FR')}
                  </span>
                </div>
              )}

              {selectedChildForDetail.parent_phone && (
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex justify-between">
                  <span className="text-slate-500">Téléphone :</span>
                  <span className="font-bold text-slate-800">{selectedChildForDetail.parent_phone}</span>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedChildForStatement(selectedChildForDetail);
                  setSelectedChildForDetail(null);
                }}
                className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg sm:rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Voir Versements
              </button>
              <button
                type="button"
                onClick={() => setSelectedChildForDetail(null)}
                className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg sm:rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4 : HORAIRES DES COURS                                              */}
      {/* ========================================================================= */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl sm:rounded-3xl max-w-lg w-full p-4 sm:p-6 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl sm:rounded-2xl border border-blue-100 shrink-0">
                  <Calendar size={20} />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900">Emploi du Temps</h3>
                  <p className="text-xs text-slate-500 font-semibold mt-0.5">
                    Consultez les créneaux de cours des classes
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg sm:rounded-xl transition-colors cursor-pointer"
              >
                <X size={17} />
              </button>
            </div>

            <div className="py-4 space-y-3">
              {parentStats.children.length > 0 ? (
                <div className="space-y-2.5">
                  <p className="text-xs text-slate-500">Sélectionnez l'élève pour voir sa classe :</p>
                  {parentStats.children.map(c => (
                    <div key={c.id} className="p-3 rounded-xl sm:rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-slate-900">
                          {formatStudentName(c.last_name, c.first_name).fullName}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Classe : <strong className="text-indigo-600">{c.class?.name || 'Non assignée'}</strong>
                        </p>
                      </div>
                      <span className="text-[11px] font-bold text-slate-600 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                        8h00 - 14h00
                      </span>
                    </div>
                  ))}
                  <div className="p-3 rounded-xl sm:rounded-2xl bg-blue-50/60 border border-blue-100 text-xs text-blue-900 space-y-1">
                    <p className="font-bold flex items-center gap-1.5">
                      <Clock size={13} className="text-blue-600" />
                      Horaires académiques standards
                    </p>
                    <p className="text-[11px] text-blue-800 leading-relaxed">
                      Les cours ont lieu du lundi au vendredi de 8h00 à 14h00. Pour toute dispense ou demande de changement de groupe, contactez la direction.
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400 text-center py-5">Aucune classe assignée pour le moment.</p>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setShowScheduleModal(false)}
                className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg sm:rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Compris
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5 : CONTACTER L'ÉTABLISSEMENT                                       */}
      {/* ========================================================================= */}
      {showContactModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl sm:rounded-3xl max-w-md w-full p-4 sm:p-6 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl sm:rounded-2xl border border-purple-100 shrink-0">
                  <Phone size={20} />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900">Contacter l'École</h3>
                  <p className="text-xs text-slate-500 font-semibold mt-0.5 break-words">
                    {school?.name || "Services Administratifs"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowContactModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg sm:rounded-xl transition-colors cursor-pointer"
              >
                <X size={17} />
              </button>
            </div>

            <div className="py-4 space-y-2.5 text-xs">
              {/* Phone */}
              {school?.phone ? (
                <a 
                  href={`tel:${school.phone}`}
                  className="flex items-center p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-slate-50 hover:bg-indigo-50 border border-slate-200/80 transition-colors group"
                >
                  <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg sm:rounded-xl mr-2.5 shrink-0">
                    <Phone size={15} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900">Appel Téléphonique</p>
                    <p className="text-[11px] text-slate-500 truncate">{school.phone}</p>
                  </div>
                  <ExternalLink size={13} className="ml-auto text-slate-400 group-hover:text-indigo-600 shrink-0" />
                </a>
              ) : (
                <div className="flex items-center p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-slate-50 border border-slate-200/80 text-slate-500">
                  <Phone size={15} className="mr-2.5 text-slate-400 shrink-0" />
                  <span>Standard : +509 3840-0000</span>
                </div>
              )}

              {/* WhatsApp direct */}
              {school?.phone && (
                <a 
                  href={`https://wa.me/${school.phone.replace(/[^0-9]/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200/80 transition-colors group text-emerald-950"
                >
                  <div className="p-2 bg-emerald-200 text-emerald-800 rounded-lg sm:rounded-xl mr-2.5 shrink-0">
                    <MessageCircle size={15} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold">WhatsApp Secrétariat</p>
                    <p className="text-[11px] text-emerald-700 truncate">Discussion directe instantanée</p>
                  </div>
                  <ExternalLink size={13} className="ml-auto text-emerald-600 shrink-0" />
                </a>
              )}

              {/* Email */}
              {school?.email ? (
                <a 
                  href={`mailto:${school.email}`}
                  className="flex items-center p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-slate-50 hover:bg-blue-50 border border-slate-200/80 transition-colors group"
                >
                  <div className="p-2 bg-blue-100 text-blue-700 rounded-lg sm:rounded-xl mr-2.5 shrink-0">
                    <Mail size={15} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900">Courrier Électronique</p>
                    <p className="text-[11px] text-slate-500 truncate">{school.email}</p>
                  </div>
                  <ExternalLink size={13} className="ml-auto text-slate-400 group-hover:text-blue-600 shrink-0" />
                </a>
              ) : (
                <div className="flex items-center p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-slate-50 border border-slate-200/80 text-slate-500">
                  <Mail size={15} className="mr-2.5 text-slate-400 shrink-0" />
                  <span>Email : contact@edunova.ht</span>
                </div>
              )}

              {/* Address */}
              <div className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start gap-2.5 text-slate-700">
                <MapPin size={16} className="text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-slate-900">Adresse & Campus</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {school?.address || "Port-au-Prince, Haïti"}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Horaires : Lundi - Vendredi, 7h30 - 15h30
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setShowContactModal(false)}
                className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg sm:rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ParentDashboardView;
