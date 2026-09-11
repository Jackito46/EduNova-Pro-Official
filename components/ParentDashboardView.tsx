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
  Download
} from 'lucide-react';
import { UserProfile, SchoolType } from '../types';
import { formatStudentName } from '../utils/formatters';
import { PrintPreviewModal } from './PrintPreviewModal';

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

  // Modals state
  const [selectedPaymentForReceipt, setSelectedPaymentForReceipt] = useState<any | null>(null);
  const [selectedChildForStatement, setSelectedChildForStatement] = useState<any | null>(null);
  const [selectedChildForDetail, setSelectedChildForDetail] = useState<any | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedChildForSchedule, setSelectedChildForSchedule] = useState<any | null>(null);
  const [showContactModal, setShowContactModal] = useState(false);

  // Filtered payments
  const filteredPayments = useMemo(() => {
    let list = parentStats.payments || [];
    if (selectedChildFilter !== 'all') {
      list = list.filter(p => p.student_id === selectedChildFilter);
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
        return receiptNo.includes(q) || studentName.includes(q) || feeType.includes(q) || method.includes(q);
      });
    }
    return list;
  }, [parentStats.payments, selectedChildFilter, paymentSearch]);

  // Latest payment
  const latestPayment = useMemo(() => {
    if (parentStats.payments && parentStats.payments.length > 0) {
      return parentStats.payments[0];
    }
    return null;
  }, [parentStats.payments]);

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

      {/* KPI METRIC CARDS */}
      <div id="parent-kpi-grid" className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5 lg:gap-4">
        {/* Card 1: Children count or Student status */}
        <div id="parent-kpi-children" className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 md:p-5 shadow-2xs border border-slate-100/90 flex flex-col justify-between hover:shadow-md hover:border-blue-100 transition-all duration-300">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-slate-400">
              {isAdvancedSchool ? "Mon Dossier" : "Mes Enfants"}
            </span>
            <div className="p-1.5 sm:p-2 bg-blue-50 text-blue-600 rounded-xl sm:rounded-2xl shadow-2xs border border-blue-100/50">
              {isAdvancedSchool ? <GraduationCap size={16} /> : <Baby size={16} />}
            </div>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {isAdvancedSchool ? (parentStats.childrenCount > 0 ? "Actif" : "Non assigné") : parentStats.childrenCount}
            </p>
            <p className="mt-1 text-[11px] sm:text-xs font-semibold text-slate-500 truncate">
              {parentStats.children?.length === 1
                ? `${formatStudentName(parentStats.children[0].last_name, parentStats.children[0].first_name).fullName}${parentStats.children[0].class?.name ? ` (${parentStats.children[0].class.name})` : ''}`
                : (isAdvancedSchool 
                    ? (parentStats.children?.[0]?.class?.name ? `Classe: ${parentStats.children[0].class.name}` : "Dossier académique")
                    : `${parentStats.childrenCount} ${terminology.students.toLowerCase()}`)}
            </p>
          </div>
        </div>

        {/* Card 2: Total Paid */}
        <div id="parent-kpi-paid" className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 md:p-5 shadow-2xs border border-slate-100/90 flex flex-col justify-between hover:shadow-md hover:border-emerald-100 transition-all duration-300">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-slate-400">Total Versé</span>
            <div className="p-1.5 sm:p-2 bg-emerald-50 text-emerald-600 rounded-xl sm:rounded-2xl shadow-2xs border border-emerald-100/50">
              <Coins size={16} />
            </div>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-black text-emerald-600 tracking-tight">
              {parentStats.totalPaid.toLocaleString()} G
            </p>
            <p className="mt-1 text-[11px] sm:text-xs font-semibold text-slate-400 truncate">
              {parentStats.payments?.length || 0} versement{(parentStats.payments?.length || 0) > 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Card 3: Remaining Balance */}
        <div id="parent-kpi-due" className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 md:p-5 shadow-2xs border border-slate-100/90 flex flex-col justify-between hover:shadow-md hover:border-rose-100 transition-all duration-300">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-slate-400">Solde Restant</span>
            <div className={`p-1.5 sm:p-2 rounded-xl sm:rounded-2xl shadow-2xs border ${parentStats.totalDue > 0 ? 'bg-rose-50 text-rose-600 border-rose-100/50' : 'bg-emerald-50 text-emerald-600 border-emerald-100/50'}`}>
              <TrendingDown size={16} />
            </div>
          </div>
          <div>
            <p className={`text-2xl sm:text-3xl font-black tracking-tight ${parentStats.totalDue > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {parentStats.totalDue.toLocaleString()} G
            </p>
            <p className="mt-1 text-[11px] sm:text-xs font-semibold text-slate-400 truncate">
              {parentStats.totalDue > 0 ? "À régulariser" : "À jour"}
            </p>
          </div>
        </div>

        {/* Card 4: Latest Receipt & History shortcut */}
        <div 
          id="parent-kpi-receipt"
          onClick={() => {
            if (latestPayment) {
              setSelectedPaymentForReceipt(latestPayment);
            } else {
              const el = document.getElementById('section-payments-history');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }
          }}
          className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 md:p-5 shadow-2xs border border-slate-100/90 flex flex-col justify-between hover:shadow-md hover:border-amber-200 transition-all duration-300 cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-slate-400">
              {latestPayment ? "Dernier Reçu" : "Historique"}
            </span>
            <div className="p-1.5 sm:p-2 bg-amber-50 text-amber-600 rounded-xl sm:rounded-2xl shadow-2xs border border-amber-100/50 group-hover:scale-110 transition-transform">
              <Receipt size={16} />
            </div>
          </div>
          <div>
            {latestPayment ? (
              <>
                <p className="text-lg sm:text-xl font-black text-slate-900 tracking-tight truncate">
                  #{latestPayment.receipt_number || 'Reçu'}
                </p>
                <p className="mt-0.5 text-[11px] sm:text-xs font-bold text-amber-700 truncate">
                  {latestPayment.currency === 'USD' ? (
                    <span>
                      ${Number(latestPayment.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} USD
                      <span className="text-[10px] text-amber-600 font-semibold ml-1">
                        (≈ {Number(latestPayment.amount_htg_equivalent || (Number(latestPayment.amount || 0) * (latestPayment.exchange_rate_applied || 140))).toLocaleString()} HTG)
                      </span>
                    </span>
                  ) : (
                    <span>{Number(latestPayment.amount_htg_equivalent || latestPayment.amount || 0).toLocaleString()} HTG</span>
                  )}
                </p>
                <p className="mt-0.5 text-[10px] sm:text-[11px] text-indigo-600 font-bold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                  Imprimer <ChevronRight size={11} />
                </p>
              </>
            ) : (
              <>
                <p className="text-base sm:text-lg font-black text-slate-900 tracking-tight">Aucun versement</p>
                <p className="mt-1 text-[11px] text-slate-400">Reçus ici</p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 1: SUIVI SCOLAIRE / PARCOURS ACADEMIQUE & ACTIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5 sm:gap-4 lg:gap-5">
        {/* Left 2 Cols: Children list with quick actions */}
        <div id="section-children-overview" className="lg:col-span-2 bg-white rounded-2xl sm:rounded-3xl shadow-2xs border border-slate-100/90 p-4 sm:p-5 md:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-4 sm:mb-5">
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                {isAdvancedSchool ? "Mon Parcours Académique & Dossier" : "Suivi Scolaire des Enfants"}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {isAdvancedSchool
                  ? "Détail de votre scolarité, solde portefeuille et versements d'inscription"
                  : "Progression académique, portefeuille électronique et situation financière par enfant"}
              </p>
            </div>
            {parentStats.children.length > 0 && (
              <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-slate-100 text-slate-700 self-start sm:self-auto border border-slate-200/60">
                {parentStats.children.length} {isAdvancedSchool ? "dossier" : terminology.students.toLowerCase()}
              </span>
            )}
          </div>

          <div className="space-y-2.5 sm:space-y-3">
            {parentStats.children.map((child, idx) => (
              <div 
                key={child.id || idx} 
                id={`child-card-${child.id || idx}`}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-50/70 border border-slate-100/90 hover:bg-slate-50 transition-all duration-200 gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 sm:w-11 sm:h-11 bg-gradient-to-br from-indigo-500 to-indigo-700 text-white rounded-xl sm:rounded-2xl flex items-center justify-center font-black text-sm sm:text-base shadow-2xs shrink-0">
                    {child.first_name?.[0] || 'E'}{child.last_name?.[0] || 'N'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-900 truncate">
                      {formatStudentName(child.last_name, child.first_name).fullName}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                      <span className="text-[11px] sm:text-xs text-slate-500 font-semibold bg-white px-2 py-0.5 rounded-md border border-slate-200/70">
                        {child.class?.name || 'Classe non assignée'}
                      </span>
                      {child.reference_number && (
                        <span className="text-[10px] sm:text-[11px] text-slate-400 font-mono">
                          Matr: {child.reference_number}
                        </span>
                      )}
                      <span className="text-[11px] sm:text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60 flex items-center gap-1">
                        👛 {(child.wallet_balance_htg || 0).toLocaleString()} HTG
                      </span>
                    </div>
                  </div>
                </div>

                {/* Individual Action Buttons */}
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 shrink-0">
                  {/* Top-up MonCash */}
                  <button
                    type="button"
                    id={`btn-topup-${child.id}`}
                    onClick={() => onTopUpStudentWallet(child)}
                    className="px-2.5 sm:px-3 py-1.5 bg-red-600 hover:bg-red-700 active:scale-[0.98] text-white rounded-lg sm:rounded-xl text-xs font-bold shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                    title="Recharger le portefeuille de l'élève par MonCash"
                  >
                    <Smartphone size={13} />
                    <span>MonCash</span>
                  </button>

                  {/* Relevé financier de l'enfant */}
                  <button 
                    type="button"
                    id={`btn-statement-${child.id}`}
                    onClick={() => setSelectedChildForStatement(child)}
                    className="px-2.5 sm:px-3 py-1.5 bg-white border border-slate-200 hover:border-indigo-300 hover:text-indigo-600 rounded-lg sm:rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                    title="Voir l'état des frais et versements de cet élève"
                  >
                    <FileText size={13} className="text-indigo-600" />
                    <span>Relevé</span>
                  </button>

                  {/* Fiche scolaire / Détails */}
                  <button 
                    type="button"
                    id={`btn-detail-${child.id}`}
                    onClick={() => setSelectedChildForDetail(child)}
                    className="px-2.5 sm:px-3 py-1.5 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 rounded-lg sm:rounded-xl text-xs font-bold text-indigo-700 shadow-2xs transition-all flex items-center gap-1 cursor-pointer"
                    title="Détails du profil et cursus"
                  >
                    <span>Fiche</span>
                  </button>
                </div>
              </div>
            ))}

            {parentStats.children.length === 0 && (
              <div className="py-8 text-center bg-slate-50/50 rounded-xl sm:rounded-2xl border border-dashed border-slate-200">
                <Users className="mx-auto text-slate-300 mb-1.5" size={28} />
                <p className="text-xs sm:text-sm font-bold text-slate-700">
                  {isAdvancedSchool
                    ? "Aucun dossier étudiant actif trouvé pour votre compte."
                    : "Aucun enfant trouvé associé à votre adresse email ou compte."}
                </p>
                <p className="text-[11px] sm:text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  Si vos enfants sont déjà inscrits à l'école, veuillez contacter le secrétariat pour lier votre compte parent à leur fiche élève.
                </p>
                <button
                  onClick={() => setShowContactModal(true)}
                  className="mt-3 px-3.5 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg sm:rounded-xl hover:bg-indigo-700 transition-all cursor-pointer"
                >
                  Contacter le secrétariat
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Quick Access & School Services */}
        <div id="section-quick-services" className="bg-white rounded-2xl sm:rounded-3xl shadow-2xs border border-slate-100/90 p-4 sm:p-5 md:p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight mb-1">
              {isAdvancedSchool ? "Services Étudiant" : "Espace Famille"}
            </h3>
            <p className="text-xs text-slate-400 mb-3 sm:mb-4">
              Services et accès rapide pour vos démarches au quotidien
            </p>

            <div className="space-y-2 sm:space-y-2.5">
              {/* Receipts quick modal */}
              <button
                type="button"
                id="btn-quick-receipts"
                onClick={() => {
                  const el = document.getElementById('section-payments-history');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className="w-full flex items-center p-2.5 sm:p-3 rounded-xl sm:rounded-2xl hover:bg-amber-50/60 border border-slate-100 hover:border-amber-200 transition-all group shadow-2xs text-left cursor-pointer bg-slate-50/40"
              >
                <div className="p-2 bg-amber-100/80 text-amber-700 rounded-lg sm:rounded-xl group-hover:scale-105 transition-transform shrink-0">
                  <Receipt size={16} />
                </div>
                <div className="ml-2.5 min-w-0">
                  <p className="text-xs font-bold text-slate-900">Mes Factures & Reçus</p>
                  <p className="text-[11px] text-slate-400 truncate">Consulter et réimprimer les versements</p>
                </div>
                <ChevronRight size={15} className="ml-auto text-slate-300 group-hover:text-amber-500 transition-colors shrink-0" />
              </button>

              {/* Class Schedule modal */}
              <button
                type="button"
                id="btn-quick-schedule"
                onClick={() => {
                  if (parentStats.children.length > 0) {
                    setSelectedChildForSchedule(parentStats.children[0]);
                  }
                  setShowScheduleModal(true);
                }}
                className="w-full flex items-center p-2.5 sm:p-3 rounded-xl sm:rounded-2xl hover:bg-blue-50/60 border border-slate-100 hover:border-blue-200 transition-all group shadow-2xs text-left cursor-pointer bg-slate-50/40"
              >
                <div className="p-2 bg-blue-100/80 text-blue-700 rounded-lg sm:rounded-xl group-hover:scale-105 transition-transform shrink-0">
                  <Calendar size={16} />
                </div>
                <div className="ml-2.5 min-w-0">
                  <p className="text-xs font-bold text-slate-900">Horaires des Cours</p>
                  <p className="text-[11px] text-slate-400 truncate">Emploi du temps des classes</p>
                </div>
                <ChevronRight size={15} className="ml-auto text-slate-300 group-hover:text-blue-500 transition-colors shrink-0" />
              </button>

              {/* Contact School modal */}
              <button
                type="button"
                id="btn-quick-contact"
                onClick={() => setShowContactModal(true)}
                className="w-full flex items-center p-2.5 sm:p-3 rounded-xl sm:rounded-2xl hover:bg-purple-50/60 border border-slate-100 hover:border-purple-200 transition-all group shadow-2xs text-left cursor-pointer bg-slate-50/40"
              >
                <div className="p-2 bg-purple-100/80 text-purple-700 rounded-lg sm:rounded-xl group-hover:scale-105 transition-transform shrink-0">
                  <MessageCircle size={16} />
                </div>
                <div className="ml-2.5 min-w-0">
                  <p className="text-xs font-bold text-slate-900">Contacter l'École</p>
                  <p className="text-[11px] text-slate-400 truncate">Secrétariat, Économat & Direction</p>
                </div>
                <ChevronRight size={15} className="ml-auto text-slate-300 group-hover:text-purple-500 transition-colors shrink-0" />
              </button>
            </div>
          </div>

          {/* Assistance card */}
          <div className="mt-3.5 sm:mt-4 p-3 sm:p-3.5 rounded-xl sm:rounded-2xl bg-indigo-50/60 border border-indigo-100">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="text-indigo-600 shrink-0 mt-0.5" size={16} />
              <div className="text-xs text-indigo-950">
                <p className="font-bold">Paiement Mobile Sécurisé</p>
                <p className="text-indigo-800/80 mt-0.5 text-[11px] leading-relaxed">
                  Rechargez le portefeuille par MonCash avec validation instantanée.
                </p>
              </div>
            </div>
          </div>
        </div>
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

          {/* Search & Child filter pills */}
          <div className="flex flex-wrap items-center gap-2">
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
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Mode</th>
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
                        {p.fee_type || p.nature || p.type || p.description || 'Scolarité'}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                          isMonCash 
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : isNatcash
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}>
                          {p.payment_method || 'Espèces'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-black text-slate-900 whitespace-nowrap text-[11px] sm:text-xs">
                        {p.currency === 'USD' ? (
                          <div>
                            <span className="font-bold text-emerald-700 font-mono">
                              ${Number(p.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} USD
                            </span>
                            <div className="text-[10px] text-slate-500 font-medium font-mono">
                              ≈ {Number(p.amount_htg_equivalent || (Number(p.amount || 0) * (p.exchange_rate_applied || 140))).toLocaleString()} HTG
                            </div>
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
                  <h2 className="font-black text-sm uppercase tracking-tight text-black">
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
                    <span>DÉSIGNATION</span>
                    <span>MONTANT</span>
                  </div>
                  <div className="flex justify-between text-[11px] font-semibold py-1">
                    <span>{p.fee_type || p.nature || p.type || p.description || 'Paiement scolarité'}</span>
                    <span>
                      {p.currency === 'USD'
                        ? `$${Number(p.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} USD (${Number(p.amount_htg_equivalent || (Number(p.amount || 0) * (p.exchange_rate_applied || 140))).toLocaleString()} HTG)`
                        : `${Number(p.amount_htg_equivalent || p.amount || 0).toLocaleString()} HTG`}
                    </span>
                  </div>
                  {p.description && p.description !== p.fee_type && (
                    <p className="text-[10px] text-gray-500 italic mt-0.5">
                      Note : {p.description}
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
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <div className="p-3 rounded-xl sm:rounded-2xl bg-emerald-50 border border-emerald-100">
                  <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Total Versé</p>
                  <p className="text-base sm:text-lg font-black text-emerald-800 mt-0.5">
                    {(parentStats.payments?.filter(p => p.student_id === selectedChildForStatement.id)
                      .reduce((acc, p) => acc + Number(p.amount_htg_equivalent || p.amount || 0), 0) || 0).toLocaleString()} G
                  </p>
                </div>
                <div className="p-3 rounded-xl sm:rounded-2xl bg-indigo-50 border border-indigo-100">
                  <p className="text-[10px] font-black uppercase tracking-wider text-indigo-700">Portefeuille</p>
                  <p className="text-base sm:text-lg font-black text-indigo-800 mt-0.5">
                    {(selectedChildForStatement.wallet_balance_htg || 0).toLocaleString()} HTG
                  </p>
                </div>
                <div className="p-3 rounded-xl sm:rounded-2xl bg-slate-50 border border-slate-200 col-span-2 sm:col-span-1">
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
              <button
                type="button"
                onClick={() => setSelectedChildForStatement(null)}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg sm:rounded-xl text-xs font-bold transition-all cursor-pointer"
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
                <div className="p-2.5 rounded-xl sm:rounded-2xl bg-emerald-50 border border-emerald-100">
                  <p className="text-[10px] font-black uppercase text-emerald-700">Portefeuille Électronique</p>
                  <p className="text-xs font-bold text-emerald-900 mt-0.5">
                    {(selectedChildForDetail.wallet_balance_htg || 0).toLocaleString()} HTG
                  </p>
                </div>
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
                  <p className="text-xs text-slate-500 font-semibold mt-0.5">
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
