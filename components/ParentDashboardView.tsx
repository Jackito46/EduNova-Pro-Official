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
    <div id="parent-dashboard-container" className="space-y-8 animate-in fade-in duration-500">
      {/* HEADER BANNER / CONTEXT */}
      <div id="parent-dashboard-header" className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 p-6 md:p-8 text-white shadow-xl border border-indigo-900/40">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                {isAdvancedSchool ? "Portail Étudiant Personnel" : "Portail Famille • Compte Unique"}
              </span>
              {activeAcademicYear && (
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-white/10 text-slate-200 border border-white/15">
                  Année : {activeAcademicYear.name || activeAcademicYear.label || 'En cours'}
                </span>
              )}
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
              {isAdvancedSchool ? `Bonjour, ${user.full_name}` : `Espace Parents • ${user.full_name}`}
            </h1>
            <p className="text-slate-300 text-xs md:text-sm font-medium max-w-2xl leading-relaxed">
              {isAdvancedSchool
                ? "Consultez l'état de vos versements académiques, vos reçus certifiés, votre emploi du temps et le solde de votre portefeuille."
                : "Suivi centralisé et sécurisé pour l'ensemble de vos enfants scolarisés dans l'établissement. Tous vos reçus, versements et portefeuilles réunis en un seul compte."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {latestPayment && (
              <button
                id="btn-view-latest-receipt-header"
                onClick={() => setSelectedPaymentForReceipt(latestPayment)}
                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-2xl text-xs font-black shadow-lg shadow-amber-500/20 transition-all flex items-center gap-2 active:scale-95 cursor-pointer"
                title="Consulter et imprimer le dernier reçu délivré"
              >
                <Receipt size={16} className="text-slate-950 stroke-[2.5]" />
                <span>Dernier Reçu #{latestPayment.receipt_number || 'Récents'}</span>
              </button>
            )}
            <button
              id="btn-contact-school-header"
              onClick={() => setShowContactModal(true)}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-2xl text-xs font-bold transition-all border border-white/15 backdrop-blur-sm flex items-center gap-2 active:scale-95 cursor-pointer"
            >
              <Phone size={15} className="text-indigo-300" />
              <span>Contacter l'École</span>
            </button>
          </div>
        </div>
        
        {/* Subtle decorative background glow */}
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* KPI METRIC CARDS */}
      <div id="parent-kpi-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Children count or Student status */}
        <div id="parent-kpi-children" className="bg-white rounded-3xl p-6 shadow-xs border border-slate-100/90 flex flex-col justify-between hover:shadow-md hover:border-blue-100 transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">
              {isAdvancedSchool ? "Mon Dossier" : "Mes Enfants"}
            </span>
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-2xl shadow-xs border border-blue-100/50">
              {isAdvancedSchool ? <GraduationCap size={18} /> : <Baby size={18} />}
            </div>
          </div>
          <div>
            <p className="text-3xl lg:text-4xl font-black text-slate-900 tracking-tight">
              {isAdvancedSchool ? (parentStats.childrenCount > 0 ? "Actif" : "Non assigné") : parentStats.childrenCount}
            </p>
            <p className="mt-2 text-xs font-semibold text-slate-400">
              {isAdvancedSchool 
                ? (parentStats.children?.[0]?.class?.name ? `Classe: ${parentStats.children[0].class.name}` : "Dossier académique")
                : `${parentStats.childrenCount} ${terminology.students.toLowerCase()} sous ce compte`}
            </p>
          </div>
        </div>

        {/* Card 2: Total Paid */}
        <div id="parent-kpi-paid" className="bg-white rounded-3xl p-6 shadow-xs border border-slate-100/90 flex flex-col justify-between hover:shadow-md hover:border-emerald-100 transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Total Versé</span>
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl shadow-xs border border-emerald-100/50">
              <Coins size={18} />
            </div>
          </div>
          <div>
            <p className="text-3xl lg:text-4xl font-black text-emerald-600 tracking-tight">
              {parentStats.totalPaid.toLocaleString()} G
            </p>
            <p className="mt-2 text-xs font-semibold text-slate-400">
              {parentStats.payments?.length || 0} versement{(parentStats.payments?.length || 0) > 1 ? 's' : ''} enregistré{((parentStats.payments?.length || 0) > 1 ? 's' : '')}
            </p>
          </div>
        </div>

        {/* Card 3: Remaining Balance */}
        <div id="parent-kpi-due" className="bg-white rounded-3xl p-6 shadow-xs border border-slate-100/90 flex flex-col justify-between hover:shadow-md hover:border-rose-100 transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Solde Restant</span>
            <div className={`p-2.5 rounded-2xl shadow-xs border ${parentStats.totalDue > 0 ? 'bg-rose-50 text-rose-600 border-rose-100/50' : 'bg-emerald-50 text-emerald-600 border-emerald-100/50'}`}>
              <TrendingDown size={18} />
            </div>
          </div>
          <div>
            <p className={`text-3xl lg:text-4xl font-black tracking-tight ${parentStats.totalDue > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {parentStats.totalDue.toLocaleString()} G
            </p>
            <p className="mt-2 text-xs font-semibold text-slate-400">
              {parentStats.totalDue > 0 ? "À régulariser auprès de l'école" : "Situation financière à jour"}
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
          className="bg-white rounded-3xl p-6 shadow-xs border border-slate-100/90 flex flex-col justify-between hover:shadow-md hover:border-amber-200 transition-all duration-300 cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">
              {latestPayment ? "Dernier Reçu" : "Historique"}
            </span>
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-2xl shadow-xs border border-amber-100/50 group-hover:scale-110 transition-transform">
              <Receipt size={18} />
            </div>
          </div>
          <div>
            {latestPayment ? (
              <>
                <p className="text-xl lg:text-2xl font-black text-slate-900 tracking-tight truncate">
                  #{latestPayment.receipt_number || 'Reçu'}
                </p>
                <p className="mt-1 text-xs font-bold text-amber-700">
                  {Number(latestPayment.amount_htg_equivalent || latestPayment.amount || 0).toLocaleString()} {latestPayment.currency || 'HTG'}
                </p>
                <p className="mt-1 text-[11px] text-indigo-600 font-bold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                  Imprimer ce reçu <ChevronRight size={12} />
                </p>
              </>
            ) : (
              <>
                <p className="text-lg font-black text-slate-900 tracking-tight">Aucun versement</p>
                <p className="mt-2 text-xs text-slate-400">Les reçus s'afficheront ici</p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 1: SUIVI SCOLAIRE / PARCOURS ACADEMIQUE & ACTIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Children list with quick actions */}
        <div id="section-children-overview" className="lg:col-span-2 bg-white rounded-3xl shadow-xs border border-slate-100/90 p-6 md:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div>
              <h3 className="text-base md:text-lg font-black text-slate-900 tracking-tight">
                {isAdvancedSchool ? "Mon Parcours Académique & Dossier" : "Suivi Scolaire des Enfants"}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {isAdvancedSchool
                  ? "Détail de votre scolarité, solde portefeuille et versements d'inscription"
                  : "Progression académique, portefeuille électronique et situation financière par enfant"}
              </p>
            </div>
            {parentStats.children.length > 0 && (
              <span className="px-3 py-1 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 self-start sm:self-auto border border-slate-200/60">
                {parentStats.children.length} {isAdvancedSchool ? "dossier" : terminology.students.toLowerCase()}
              </span>
            )}
          </div>

          <div className="space-y-3.5">
            {parentStats.children.map((child, idx) => (
              <div 
                key={child.id || idx} 
                id={`child-card-${child.id || idx}`}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 rounded-2xl bg-slate-50/70 border border-slate-100/90 hover:bg-slate-50 transition-all duration-200 gap-4"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-indigo-700 text-white rounded-2xl flex items-center justify-center font-black text-base shadow-sm shrink-0">
                    {child.first_name?.[0] || 'E'}{child.last_name?.[0] || 'N'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm md:text-base font-black text-slate-900 truncate">
                      {formatStudentName(child.last_name, child.first_name).fullName}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span className="text-xs text-slate-500 font-semibold bg-white px-2.5 py-0.5 rounded-lg border border-slate-200/70">
                        {child.class?.name || 'Classe non assignée'}
                      </span>
                      {child.reference_number && (
                        <span className="text-[11px] text-slate-400 font-mono">
                          Matr: {child.reference_number}
                        </span>
                      )}
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200/60 flex items-center gap-1">
                        👛 {(child.wallet_balance_htg || 0).toLocaleString()} HTG
                      </span>
                    </div>
                  </div>
                </div>

                {/* Individual Action Buttons */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {/* Top-up MonCash */}
                  <button
                    type="button"
                    id={`btn-topup-${child.id}`}
                    onClick={() => onTopUpStudentWallet(child)}
                    className="px-3.5 py-2 bg-red-600 hover:bg-red-700 active:scale-[0.98] text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                    title="Recharger le portefeuille de l'élève par MonCash"
                  >
                    <Smartphone size={14} />
                    <span>Recharger MonCash</span>
                  </button>

                  {/* Relevé financier de l'enfant */}
                  <button 
                    type="button"
                    id={`btn-statement-${child.id}`}
                    onClick={() => setSelectedChildForStatement(child)}
                    className="px-3.5 py-2 bg-white border border-slate-200 hover:border-indigo-300 hover:text-indigo-600 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                    title="Voir l'état des frais et versements de cet élève"
                  >
                    <FileText size={14} className="text-indigo-600" />
                    <span>Relevé & Versements</span>
                  </button>

                  {/* Fiche scolaire / Détails */}
                  <button 
                    type="button"
                    id={`btn-detail-${child.id}`}
                    onClick={() => setSelectedChildForDetail(child)}
                    className="px-3 py-2 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 rounded-xl text-xs font-bold text-indigo-700 shadow-xs transition-all flex items-center gap-1 cursor-pointer"
                    title="Détails du profil et cursus"
                  >
                    <span>Fiche</span>
                  </button>
                </div>
              </div>
            ))}

            {parentStats.children.length === 0 && (
              <div className="py-12 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                <Users className="mx-auto text-slate-300 mb-2" size={32} />
                <p className="text-sm font-bold text-slate-700">
                  {isAdvancedSchool
                    ? "Aucun dossier étudiant actif trouvé pour votre compte."
                    : "Aucun enfant trouvé associé à votre adresse email ou compte."}
                </p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  Si vos enfants sont déjà inscrits à l'école, veuillez contacter le secrétariat pour lier votre compte parent à leur fiche élève.
                </p>
                <button
                  onClick={() => setShowContactModal(true)}
                  className="mt-4 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-all cursor-pointer"
                >
                  Contacter le secrétariat
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Quick Access & School Services */}
        <div id="section-quick-services" className="bg-white rounded-3xl shadow-xs border border-slate-100/90 p-6 md:p-8 flex flex-col justify-between">
          <div>
            <h3 className="text-base md:text-lg font-black text-slate-900 tracking-tight mb-2">
              {isAdvancedSchool ? "Services Étudiant" : "Espace Famille"}
            </h3>
            <p className="text-xs text-slate-400 mb-6">
              Raccourcis et outils pour vos démarches au quotidien
            </p>

            <div className="space-y-3">
              {/* Receipts quick modal */}
              <button
                type="button"
                id="btn-quick-receipts"
                onClick={() => {
                  const el = document.getElementById('section-payments-history');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className="w-full flex items-center p-3.5 rounded-2xl hover:bg-amber-50/60 border border-slate-100 hover:border-amber-200 transition-all group shadow-xs text-left cursor-pointer bg-slate-50/40"
              >
                <div className="p-2.5 bg-amber-100/80 text-amber-700 rounded-xl group-hover:scale-105 transition-transform">
                  <Receipt size={18} />
                </div>
                <div className="ml-3 min-w-0">
                  <p className="text-xs font-bold text-slate-900">Mes Factures & Reçus</p>
                  <p className="text-[11px] text-slate-400">Consulter et réimprimer les versements</p>
                </div>
                <ChevronRight size={16} className="ml-auto text-slate-300 group-hover:text-amber-500 transition-colors shrink-0" />
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
                className="w-full flex items-center p-3.5 rounded-2xl hover:bg-blue-50/60 border border-slate-100 hover:border-blue-200 transition-all group shadow-xs text-left cursor-pointer bg-slate-50/40"
              >
                <div className="p-2.5 bg-blue-100/80 text-blue-700 rounded-xl group-hover:scale-105 transition-transform">
                  <Calendar size={18} />
                </div>
                <div className="ml-3 min-w-0">
                  <p className="text-xs font-bold text-slate-900">Horaires des Cours</p>
                  <p className="text-[11px] text-slate-400">Emploi du temps des classes</p>
                </div>
                <ChevronRight size={16} className="ml-auto text-slate-300 group-hover:text-blue-500 transition-colors shrink-0" />
              </button>

              {/* Contact School modal */}
              <button
                type="button"
                id="btn-quick-contact"
                onClick={() => setShowContactModal(true)}
                className="w-full flex items-center p-3.5 rounded-2xl hover:bg-purple-50/60 border border-slate-100 hover:border-purple-200 transition-all group shadow-xs text-left cursor-pointer bg-slate-50/40"
              >
                <div className="p-2.5 bg-purple-100/80 text-purple-700 rounded-xl group-hover:scale-105 transition-transform">
                  <MessageCircle size={18} />
                </div>
                <div className="ml-3 min-w-0">
                  <p className="text-xs font-bold text-slate-900">Contacter l'École</p>
                  <p className="text-[11px] text-slate-400">Secrétariat, Économat & Direction</p>
                </div>
                <ChevronRight size={16} className="ml-auto text-slate-300 group-hover:text-purple-500 transition-colors shrink-0" />
              </button>
            </div>
          </div>

          {/* Assistance card */}
          <div className="mt-6 p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100">
            <div className="flex items-start gap-3">
              <ShieldCheck className="text-indigo-600 shrink-0 mt-0.5" size={18} />
              <div className="text-xs text-indigo-950">
                <p className="font-bold">Paiement Mobile Sécurisé</p>
                <p className="text-indigo-800/80 mt-0.5 text-[11px] leading-relaxed">
                  Rechargez le portefeuille de vos enfants par MonCash instantanément avec validation automatique.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: HISTORIQUE ET JOURNAL DES VERSEMENTS DÉJÀ EFFECTUÉS */}
      <div id="section-payments-history" className="bg-white rounded-3xl shadow-xs border border-slate-100/90 p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100">
                <Receipt size={18} />
              </div>
              <h3 className="text-base md:text-lg font-black text-slate-900 tracking-tight">
                Versements Effectués & Historique des Reçus
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Tous les règlements enregistrés par l'établissement avec réimpression certifiée des reçus officiels.
            </p>
          </div>

          {/* Search & Child filter pills */}
          <div className="flex flex-wrap items-center gap-2.5">
            {parentStats.children.length > 1 && (
              <select
                id="select-filter-child-payments"
                value={selectedChildFilter}
                onChange={(e) => setSelectedChildFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="all">Tous les enfants ({parentStats.children.length})</option>
                {parentStats.children.map((c) => (
                  <option key={c.id} value={c.id}>
                    {formatStudentName(c.last_name, c.first_name).fullName}
                  </option>
                ))}
              </select>
            )}

            <div className="relative min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                type="text"
                id="input-search-payments"
                placeholder="Rechercher un reçu, élève..."
                value={paymentSearch}
                onChange={(e) => setPaymentSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {paymentSearch && (
                <button 
                  onClick={() => setPaymentSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Payments list / table */}
        {filteredPayments.length > 0 ? (
          <div className="overflow-x-auto rounded-2xl border border-slate-100">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50/80 text-[11px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">N° Reçu</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">{isAdvancedSchool ? "Étudiant" : "Élève"}</th>
                  <th className="py-3 px-4">Type de Paiement</th>
                  <th className="py-3 px-4">Mode</th>
                  <th className="py-3 px-4 text-right">Montant</th>
                  <th className="py-3 px-4 text-center">Statut</th>
                  <th className="py-3 px-4 text-center">Action</th>
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
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 text-indigo-700 bg-indigo-50/80 px-2 py-0.5 rounded-md border border-indigo-100">
                          #{p.receipt_number || 'SANS-NO'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-600 whitespace-nowrap">
                        {formattedDate}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-800 whitespace-nowrap">
                        {studentObj 
                          ? formatStudentName(studentObj.last_name, studentObj.first_name).fullName 
                          : 'Élève'}
                        {studentObj?.class?.name && (
                          <span className="block text-[10px] font-normal text-slate-400">
                            {studentObj.class.name}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-700">
                        {p.fee_type || p.nature || p.type || p.description || 'Scolarité'}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                          isMonCash 
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : isNatcash
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}>
                          {p.payment_method || 'Espèces'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-black text-slate-900 whitespace-nowrap">
                        {Number(p.amount_htg_equivalent || p.amount || 0).toLocaleString()} {p.currency || 'HTG'}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 size={10} />
                          Validé
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedPaymentForReceipt(p)}
                          className="px-2.5 py-1 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-indigo-700 rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center gap-1 mx-auto cursor-pointer"
                          title="Imprimer / Visualiser le reçu certifié"
                        >
                          <Printer size={13} />
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
          <div className="py-12 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
            <Receipt className="mx-auto text-slate-300 mb-2" size={32} />
            <p className="text-sm font-bold text-slate-700">Aucun versement trouvé</p>
            <p className="text-xs text-slate-400 mt-1">
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
                className="mt-3 px-3 py-1.5 bg-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-300 transition-all cursor-pointer"
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
                    <span>{Number(p.amount_htg_equivalent || p.amount || 0).toLocaleString()} {p.currency || 'HTG'}</span>
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
                  <span>{Number(p.amount_htg_equivalent || p.amount || 0).toLocaleString()} {p.currency || 'HTG'}</span>
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
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-100 max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center font-black text-lg border border-indigo-100">
                  <FileText size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    Relevé Financier & Versements
                  </h3>
                  <p className="text-xs text-slate-500 font-semibold mt-0.5">
                    {formatStudentName(selectedChildForStatement.last_name, selectedChildForStatement.first_name).fullName} • {selectedChildForStatement.class?.name || 'Classe non assignée'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedChildForStatement(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content: Summary & Payments of this child */}
            <div className="overflow-y-auto py-6 space-y-6 flex-1 pr-1">
              {/* Financial summary pills */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-100">
                  <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Total Versé</p>
                  <p className="text-lg font-black text-emerald-800 mt-1">
                    {(parentStats.payments?.filter(p => p.student_id === selectedChildForStatement.id)
                      .reduce((acc, p) => acc + Number(p.amount_htg_equivalent || p.amount || 0), 0) || 0).toLocaleString()} G
                  </p>
                </div>
                <div className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-100">
                  <p className="text-[10px] font-black uppercase tracking-wider text-indigo-700">Portefeuille</p>
                  <p className="text-lg font-black text-indigo-800 mt-1">
                    {(selectedChildForStatement.wallet_balance_htg || 0).toLocaleString()} HTG
                  </p>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 col-span-2 sm:col-span-1">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-600">Nb de Reçus</p>
                  <p className="text-lg font-black text-slate-800 mt-1">
                    {parentStats.payments?.filter(p => p.student_id === selectedChildForStatement.id).length || 0}
                  </p>
                </div>
              </div>

              {/* Transactions list of this child */}
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">
                  Historique des Règlements de cet Élève
                </h4>
                {(() => {
                  const childPayments = parentStats.payments?.filter(p => p.student_id === selectedChildForStatement.id) || [];
                  if (childPayments.length === 0) {
                    return (
                      <div className="p-6 text-center bg-slate-50 rounded-2xl border border-slate-100">
                        <Receipt className="mx-auto text-slate-300 mb-2" size={24} />
                        <p className="text-xs font-bold text-slate-600">Aucun versement enregistré pour cet élève.</p>
                      </div>
                    );
                  }
                  return (
                    <div className="space-y-2">
                      {childPayments.map(p => (
                        <div key={p.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50/80 border border-slate-100 hover:bg-slate-50 transition-colors">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono font-bold text-indigo-700">#{p.receipt_number || 'SANS-NO'}</span>
                              <span className="text-xs font-bold text-slate-800">{p.fee_type || 'Scolarité'}</span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              {p.payment_date ? new Date(p.payment_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : '-'} • {p.payment_method || 'Espèces'}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-black text-slate-900">
                              {Number(p.amount_htg_equivalent || p.amount || 0).toLocaleString()} {p.currency || 'HTG'}
                            </span>
                            <button
                              onClick={() => {
                                setSelectedPaymentForReceipt(p);
                              }}
                              className="p-1.5 bg-white hover:bg-indigo-50 border border-slate-200 text-indigo-700 rounded-lg transition-colors cursor-pointer"
                              title="Imprimer ce reçu"
                            >
                              <Printer size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  onTopUpStudentWallet(selectedChildForStatement);
                  setSelectedChildForStatement(null);
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Smartphone size={14} />
                <span>Recharger MonCash</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedChildForStatement(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
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
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-indigo-700 text-white rounded-2xl flex items-center justify-center font-black text-lg shadow-sm">
                  {selectedChildForDetail.first_name?.[0] || 'E'}{selectedChildForDetail.last_name?.[0] || 'N'}
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    Fiche {isAdvancedSchool ? "Étudiant" : "Scolaire"}
                  </h3>
                  <p className="text-xs text-slate-500 font-semibold mt-0.5">
                    {formatStudentName(selectedChildForDetail.last_name, selectedChildForDetail.first_name).fullName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedChildForDetail(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="py-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  <p className="text-[10px] font-black uppercase text-slate-400">Classe / Niveau</p>
                  <p className="text-xs font-bold text-slate-900 mt-1">
                    {selectedChildForDetail.class?.name || 'Non assigné'}
                  </p>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  <p className="text-[10px] font-black uppercase text-slate-400">Matricule</p>
                  <p className="text-xs font-mono font-bold text-slate-900 mt-1">
                    {selectedChildForDetail.reference_number || 'Non renseigné'}
                  </p>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  <p className="text-[10px] font-black uppercase text-slate-400">Statut</p>
                  <p className="text-xs font-bold text-emerald-600 mt-1">
                    {selectedChildForDetail.status || 'Actif'}
                  </p>
                </div>
                <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-100">
                  <p className="text-[10px] font-black uppercase text-emerald-700">Portefeuille Électronique</p>
                  <p className="text-xs font-bold text-emerald-900 mt-1">
                    {(selectedChildForDetail.wallet_balance_htg || 0).toLocaleString()} HTG
                  </p>
                </div>
              </div>

              {selectedChildForDetail.date_of_birth && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex justify-between">
                  <span className="text-slate-500">Date de naissance :</span>
                  <span className="font-bold text-slate-800">
                    {new Date(selectedChildForDetail.date_of_birth).toLocaleDateString('fr-FR')}
                  </span>
                </div>
              )}

              {selectedChildForDetail.parent_phone && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex justify-between">
                  <span className="text-slate-500">Téléphone de contact :</span>
                  <span className="font-bold text-slate-800">{selectedChildForDetail.parent_phone}</span>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedChildForStatement(selectedChildForDetail);
                  setSelectedChildForDetail(null);
                }}
                className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Voir Versements
              </button>
              <button
                type="button"
                onClick={() => setSelectedChildForDetail(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
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
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl border border-blue-100">
                  <Calendar size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Emploi du Temps</h3>
                  <p className="text-xs text-slate-500 font-semibold mt-0.5">
                    Consultez les créneaux de cours des classes
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="py-6 space-y-4">
              {parentStats.children.length > 0 ? (
                <div className="space-y-3">
                  <p className="text-xs text-slate-500">Sélectionnez l'élève pour voir sa classe :</p>
                  {parentStats.children.map(c => (
                    <div key={c.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
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
                  <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-100 text-xs text-blue-900 space-y-1">
                    <p className="font-bold flex items-center gap-1.5">
                      <Clock size={14} className="text-blue-600" />
                      Horaires académiques standards
                    </p>
                    <p className="text-[11px] text-blue-800 leading-relaxed">
                      Les cours ont lieu du lundi au vendredi de 8h00 à 14h00. Pour toute dispense ou demande de changement de groupe, veuillez contacter la direction pédagogique.
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400 text-center py-6">Aucune classe assignée pour le moment.</p>
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setShowScheduleModal(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
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
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl border border-purple-100">
                  <Phone size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Contacter l'École</h3>
                  <p className="text-xs text-slate-500 font-semibold mt-0.5">
                    {school?.name || "Services Administratifs"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowContactModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="py-5 space-y-3.5 text-xs">
              {/* Phone */}
              {school?.phone ? (
                <a 
                  href={`tel:${school.phone}`}
                  className="flex items-center p-3.5 rounded-2xl bg-slate-50 hover:bg-indigo-50 border border-slate-200/80 transition-colors group"
                >
                  <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-xl mr-3">
                    <Phone size={16} />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">Appel Téléphonique</p>
                    <p className="text-[11px] text-slate-500">{school.phone}</p>
                  </div>
                  <ExternalLink size={14} className="ml-auto text-slate-400 group-hover:text-indigo-600" />
                </a>
              ) : (
                <div className="flex items-center p-3 rounded-2xl bg-slate-50 border border-slate-200/80 text-slate-500">
                  <Phone size={16} className="mr-3 text-slate-400" />
                  <span>Téléphone : +509 3840-0000 (Standard)</span>
                </div>
              )}

              {/* WhatsApp direct */}
              {school?.phone && (
                <a 
                  href={`https://wa.me/${school.phone.replace(/[^0-9]/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center p-3.5 rounded-2xl bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200/80 transition-colors group text-emerald-950"
                >
                  <div className="p-2.5 bg-emerald-200 text-emerald-800 rounded-xl mr-3">
                    <MessageCircle size={16} />
                  </div>
                  <div>
                    <p className="font-bold">WhatsApp Secrétariat</p>
                    <p className="text-[11px] text-emerald-700">Discussion directe instantanée</p>
                  </div>
                  <ExternalLink size={14} className="ml-auto text-emerald-600" />
                </a>
              )}

              {/* Email */}
              {school?.email ? (
                <a 
                  href={`mailto:${school.email}`}
                  className="flex items-center p-3.5 rounded-2xl bg-slate-50 hover:bg-blue-50 border border-slate-200/80 transition-colors group"
                >
                  <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl mr-3">
                    <Mail size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900">Courrier Électronique</p>
                    <p className="text-[11px] text-slate-500 truncate">{school.email}</p>
                  </div>
                  <ExternalLink size={14} className="ml-auto text-slate-400 group-hover:text-blue-600 shrink-0" />
                </a>
              ) : (
                <div className="flex items-center p-3 rounded-2xl bg-slate-50 border border-slate-200/80 text-slate-500">
                  <Mail size={16} className="mr-3 text-slate-400" />
                  <span>Email : contact@edunova.ht</span>
                </div>
              )}

              {/* Address */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start gap-3 text-slate-700">
                <MapPin size={18} className="text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-slate-900">Adresse & Campus</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {school?.address || "Port-au-Prince, Haïti"}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Horaires de réception : Lundi - Vendredi, 7h30 - 15h30
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setShowContactModal(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
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
