import React from 'react';
import { useSchool } from '../contexts/SchoolContext';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  UserPlus, Receipt, Sparkles, AlertCircle, ShoppingCart, 
  Clock, FileText, ClipboardCheck, Users, FileCheck, ClipboardList, ChevronRight, PenTool, Printer, Check
} from 'lucide-react';

interface SecretaryDashboardProps {
  user: any;
  stats: any;
  directorStats: any;
  terminology: any;
  academicYears?: any[];
}

export const SecretaryDashboardView: React.FC<SecretaryDashboardProps> = ({ 
  user, stats, directorStats, terminology, academicYears = [] 
}) => {
  const navigate = useNavigate();
  const { school } = useSchool();
  const isPresencesEnabled = school?.global_settings?.modules?.presences ?? (school?.school_type !== 'UNIVERSITY' && school?.school_type !== 'PROFESSIONAL');
  const hasFutureSession = academicYears.some((y: any) => y.status === 'FUTURE');
  const futureYearObj = academicYears.find((y: any) => y.status === 'FUTURE');
  const activeYearObj = academicYears.find((y: any) => y.status === 'ACTIVE' || y.is_active);

  // Stagger animation container
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 100 } }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        {/* Card 1: Pré-inscriptions (si session future) OU Total Inscrits (si session unique active) */}
        {hasFutureSession ? (
          <motion.div 
            whileHover={{ y: -3 }} 
            onClick={() => navigate('/eleves', { state: { academicYearId: futureYearObj?.id } })}
            className="bg-white rounded-3xl p-6 shadow-xs border border-slate-100/90 flex flex-col justify-between transition-all duration-300 hover:shadow-md hover:border-indigo-200 cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest group-hover:text-indigo-600 transition-colors">
                Pré-inscriptions ({futureYearObj?.label || 'À venir'})
              </span>
              <div className="p-2.5 bg-indigo-50 rounded-2xl text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-xs border border-indigo-100/50">
                <Sparkles size={18} />
              </div>
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl lg:text-4xl font-black text-slate-900 tracking-tight">
                  {stats.preInscriptions}
                </p>
                <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
                  {stats.preInscriptions > 1 ? 'pré-inscrits' : 'pré-inscrit'}
                </span>
              </div>
              <div className="mt-3 text-xs font-semibold text-slate-500 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                  Session {futureYearObj?.label || 'à venir'}
                </span>
                <span className="text-indigo-600 font-bold flex items-center gap-0.5 group-hover:translate-x-1 transition-transform text-[11px]">
                  Voir registre <ChevronRight size={13} />
                </span>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            whileHover={{ y: -3 }} 
            onClick={() => navigate('/eleves')}
            className="bg-white rounded-3xl p-6 shadow-xs border border-slate-100/90 flex flex-col justify-between transition-all duration-300 hover:shadow-md hover:border-indigo-100 cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest group-hover:text-indigo-600 transition-colors">
                {terminology.students || 'Élèves'} Inscrits
              </span>
              <div className="p-2.5 bg-indigo-50 rounded-2xl text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-xs border border-indigo-100/50">
                <Users size={18} />
              </div>
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl lg:text-4xl font-black text-slate-900 tracking-tight">
                  {stats.totalStudents}
                </p>
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                  actifs
                </span>
              </div>
              <p className="mt-3 text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                Année académique en cours
              </p>
            </div>
          </motion.div>
        )}

        {/* Card 2: Today's Enrollments */}
        <motion.div 
          whileHover={{ y: -3 }} 
          className="bg-white rounded-3xl p-6 shadow-xs border border-slate-100/90 flex flex-col justify-between transition-all duration-300 hover:shadow-md hover:border-blue-100"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
              Inscriptions du Jour
            </span>
            <div className="p-2.5 bg-blue-50 rounded-2xl text-blue-600 shadow-xs border border-blue-100/50">
              <UserPlus size={18} />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl lg:text-4xl font-black text-slate-900 tracking-tight">
                {stats.todayEnrollments}
              </p>
              <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                aujourd'hui
              </span>
            </div>
            <p className="mt-3 text-xs font-semibold text-slate-400">
              Nouveaux dossiers enregistrés
            </p>
          </div>
        </motion.div>

        {/* Card 3: Cash Receipts issued today (Clickable) */}
        <motion.div 
          whileHover={{ y: -3 }} 
          onClick={() => navigate('/economat/factures')}
          className="bg-white rounded-3xl p-6 shadow-xs border border-slate-100/90 flex flex-col justify-between transition-all duration-300 hover:shadow-md hover:border-emerald-100 cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest group-hover:text-indigo-600 transition-colors">
              Reçus Émis (Caisse)
            </span>
            <div className="p-2.5 bg-emerald-50 rounded-2xl text-emerald-600 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors shadow-xs border border-emerald-100/50">
              <Receipt size={18} />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl lg:text-4xl font-black text-slate-900 tracking-tight">
                {stats.todayPaymentsCount}
              </p>
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                transactions
              </span>
            </div>
            <div className="mt-3 text-xs font-semibold text-slate-400 flex items-center justify-between">
              <span>Encaissements du jour</span>
              <span className="text-indigo-600 font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                Historique <ChevronRight size={14} />
              </span>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Actions Rapides Focus Bento Grid */}
        <div className="lg:col-span-8 flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                <Sparkles className="text-indigo-500" size={18} />
                Bureau Administratif & Services
              </h3>
              <p className="text-xs font-medium text-slate-400">Guichet unique des opérations et de la scolarité</p>
            </div>
          </div>

          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5"
          >
             {/* 1. Nouvelle Inscription (Blue) */}
             <motion.button 
                variants={itemVariants}
                onClick={() => navigate('/eleves/ajouter')} 
                className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white hover:bg-blue-50/50 text-slate-800 hover:text-blue-700 transition-all duration-200 group border border-slate-100/90 hover:border-blue-200 shadow-xs hover:shadow-sm"
             >
                <div className="w-12 h-12 bg-blue-50/80 rounded-2xl text-blue-600 flex items-center justify-center mb-3 group-hover:scale-105 group-hover:bg-blue-100/80 transition-all shadow-xs">
                   <UserPlus size={22} />
                </div>
                <span className="font-bold text-xs text-center">Nouvelle Inscription</span>
             </motion.button>

             {/* 2. Validation de Dossiers (Purple) */}
             <motion.button 
                variants={itemVariants}
                onClick={() => navigate('/eleves/validation')} 
                className="relative flex flex-col items-center justify-center p-4 rounded-2xl bg-white hover:bg-purple-50/50 text-slate-800 hover:text-purple-700 transition-all duration-200 group border border-slate-100/90 hover:border-purple-200 shadow-xs hover:shadow-sm"
             >
                {stats.pendingValidation > 0 ? (
                  <span className="absolute top-2 right-2 px-2 py-0.5 bg-amber-500 text-white font-black text-[10px] rounded-full shadow-xs animate-pulse">
                    {stats.pendingValidation}
                  </span>
                ) : (
                  <span className="absolute top-2 right-2 px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 font-bold text-[9px] rounded-full flex items-center gap-0.5">
                    <Check size={9} /> À jour
                  </span>
                )}
                <div className="w-12 h-12 bg-purple-50/80 rounded-2xl text-purple-600 flex items-center justify-center mb-3 group-hover:scale-105 group-hover:bg-purple-100/80 transition-all shadow-xs">
                   <FileCheck size={22} />
                </div>
                <span className="font-bold text-xs text-center">Validation Dossiers</span>
             </motion.button>

             {/* 3. Registre Étudiants (Indigo) */}
             <motion.button 
                variants={itemVariants}
                onClick={() => navigate('/eleves')} 
                className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white hover:bg-indigo-50/50 text-slate-800 hover:text-indigo-700 transition-all duration-200 group border border-slate-100/90 hover:border-indigo-200 shadow-xs hover:shadow-sm"
             >
                <div className="w-12 h-12 bg-indigo-50/80 rounded-2xl text-indigo-600 flex items-center justify-center mb-3 group-hover:scale-105 group-hover:bg-indigo-100/80 transition-all shadow-xs">
                   <Users size={22} />
                </div>
                <span className="font-bold text-xs text-center">Registre {terminology.students || 'Élèves'}</span>
             </motion.button>

             {/* 4. Paiement Scolarité (Emerald) */}
             <motion.button 
                variants={itemVariants}
                onClick={() => navigate('/economat/frais')} 
                className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white hover:bg-emerald-50/50 text-slate-800 hover:text-emerald-700 transition-all duration-200 group border border-slate-100/90 hover:border-emerald-200 shadow-xs hover:shadow-sm"
             >
                <div className="w-12 h-12 bg-emerald-50/80 rounded-2xl text-emerald-600 flex items-center justify-center mb-3 group-hover:scale-105 group-hover:bg-emerald-100/80 transition-all shadow-xs">
                   <Receipt size={22} />
                </div>
                <span className="font-bold text-xs text-center">Paiement Scolarité</span>
             </motion.button>

             {/* 5. Réimpression Reçus (Rose) */}
             <motion.button 
                variants={itemVariants}
                onClick={() => navigate('/economat/factures')} 
                className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white hover:bg-rose-50/50 text-slate-800 hover:text-rose-700 transition-all duration-200 group border border-slate-100/90 hover:border-rose-200 shadow-xs hover:shadow-sm"
             >
                <div className="w-12 h-12 bg-rose-50/80 rounded-2xl text-rose-600 flex items-center justify-center mb-3 group-hover:scale-105 group-hover:bg-rose-100/80 transition-all shadow-xs">
                   <Printer size={22} />
                </div>
                <span className="font-bold text-xs text-center">Réimpression Reçus</span>
             </motion.button>

             {/* 6. Vendre Fourniture (Amber) */}
             <motion.button 
                variants={itemVariants}
                onClick={() => navigate('/economat/fournitures')} 
                className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white hover:bg-amber-50/50 text-slate-800 hover:text-amber-700 transition-all duration-200 group border border-slate-100/90 hover:border-amber-200 shadow-xs hover:shadow-sm"
             >
                <div className="w-12 h-12 bg-amber-50/80 rounded-2xl text-amber-600 flex items-center justify-center mb-3 group-hover:scale-105 group-hover:bg-amber-100/80 transition-all shadow-xs">
                   <ShoppingCart size={22} />
                </div>
                <span className="font-bold text-xs text-center">Vendre Fourniture</span>
             </motion.button>

             {/* 7. Signatures des Cours (Teal) */}
             <motion.button 
                variants={itemVariants}
                onClick={() => navigate('/enseignant/pointage')} 
                className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white hover:bg-teal-50/50 text-slate-800 hover:text-teal-700 transition-all duration-200 group border border-slate-100/90 hover:border-teal-200 shadow-xs hover:shadow-sm"
             >
                <div className="w-12 h-12 bg-teal-50/80 rounded-2xl text-teal-600 flex items-center justify-center mb-3 group-hover:scale-105 group-hover:bg-teal-100/80 transition-all shadow-xs">
                   <PenTool size={22} />
                </div>
                <span className="font-bold text-xs text-center">Signatures Cours</span>
             </motion.button>
          </motion.div>
        </div>

        {/* Sidebar Mini-feed */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-100/90 h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-slate-50 text-slate-600 rounded-xl border border-slate-100">
                    <Clock size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 tracking-tight">Dernières Transactions</h3>
                    <p className="text-[10px] font-medium text-slate-400">Flux d'encaissement en direct</p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
                 {directorStats.recentPayments && directorStats.recentPayments.length > 0 ? (
                   directorStats.recentPayments.map((p: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50/60 border border-slate-100/80 hover:bg-slate-50 transition-colors">
                         <div className="flex items-center gap-3 min-w-0">
                           <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shrink-0 border border-slate-200/60 shadow-xs text-slate-600">
                              {p.student_id ? <Receipt size={15} /> : <ShoppingCart size={15} />}
                           </div>
                           <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-900 truncate">
                                 {p.students?.last_name} {p.students?.first_name}
                              </p>
                              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{p.payment_method || 'Caisse'}</p>
                           </div>
                         </div>
                         <div className="text-right shrink-0 ml-3">
                            <p className="text-xs font-black text-emerald-600">+{Number(p.amount_to_display).toLocaleString()} G</p>
                            <p className="text-[9px] font-bold text-slate-400">
                              {new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                         </div>
                      </div>
                   ))
                 ) : (
                   <div className="flex flex-col items-center justify-center py-12 text-center space-y-2">
                     <AlertCircle size={28} className="text-slate-300" />
                     <p className="text-xs font-bold text-slate-400">Aucune activité récente</p>
                   </div>
                 )}
              </div>
            </div>
            
            <button 
              onClick={() => navigate('/economat/factures')} 
              className="w-full py-2.5 mt-5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all border border-slate-200/60 flex items-center justify-center gap-1.5"
            >
              Historique complet
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
