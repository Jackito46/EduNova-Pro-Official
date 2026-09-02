import React, { useState } from 'react';
import { 
  Calendar, 
  Plus, 
  Trash2, 
  Loader2, 
  AlertTriangle, 
  Info, 
  CheckCircle, 
  Clock, 
  Sparkles, 
  BookOpen, 
  Zap, 
  AlertCircle,
  HelpCircle,
  TrendingUp,
  Bookmark,
  ShieldCheck,
  Lock,
  GraduationCap,
  Receipt,
  CalendarCheck,
  ArrowRight,
  CheckCircle2,
  Lightbulb,
  Layers,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../supabase';
import { UserProfile, SchoolType } from '../types';
import { toast } from 'sonner';
import { useSchool } from '../contexts/SchoolContext';
import Modal from './Modal';

interface SessionManagerProps {
  user: UserProfile;
  schoolData: any;
  years: any[];
  onRefresh: () => Promise<void>;
}

export default function SessionManager({ user, schoolData, years, onRefresh }: SessionManagerProps) {
  const { terminology } = useSchool();
  const isHigherEd = schoolData?.school_type === 'UNIVERSITY' || schoolData?.school_type === 'PROFESSIONAL';

  const [newYearData, setNewYearData] = useState({
    label: '',
    startDate: '',
    endDate: '',
    sessionType: 'REGULAR' as 'REGULAR' | 'INTENSIVE' | 'SPECIAL'
  });

  const applyTemplate = (months: number, labelPrefix: string, type: 'REGULAR' | 'INTENSIVE' | 'SPECIAL') => {
    const start = new Date();
    
    // Set custom academic start months based on university vs classic school types
    if (months === 10 || months === 12 || months === 5) {
      if (isHigherEd) {
        start.setMonth(9); // October for Universities
      } else {
        start.setMonth(8); // September for Classic schools
      }
      start.setDate(1);
    } else if (months === 3) {
      start.setMonth(6); // July (Summer Term)
      start.setDate(1);
    }
    
    const end = new Date(start);
    end.setMonth(start.getMonth() + months);
    // adjust end date to be 1 day less for neatness (e.g. Sept 1 to June 30)
    end.setDate(end.getDate() - 1);

    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];
    
    let yearLabel = '';
    const startYear = start.getFullYear();
    const endYear = end.getFullYear();
    
    if (months === 12 || months === 10) {
      yearLabel = `${labelPrefix} ${startYear}-${endYear}`;
    } else {
      yearLabel = `${labelPrefix} ${startYear}`;
    }

    setNewYearData({
      label: yearLabel,
      startDate: startStr,
      endDate: endStr,
      sessionType: type
    });
    
    toast.info(`Modèle "${labelPrefix}" appliqué.`);
  };

  const [selectedPreset, setSelectedPreset] = useState<string>('');

  const templates = isHigherEd ? [
    { id: '10m', label: '🎓 Session Académique Classique (10 mois) - Oct à Juil', months: 10, prefix: 'Session Académique', type: 'REGULAR' as const },
    { id: '5m', label: '📅 Semestre Universitaire (5 mois)', months: 5, prefix: 'Semestre', type: 'REGULAR' as const },
    { id: '3m', label: '⚡ Trimestre Intensif d\'Été (3 mois)', months: 3, prefix: 'Session d\'Été', type: 'INTENSIVE' as const },
    { id: '12m', label: '🏫 Année Universitaire Complète (12 mois)', months: 12, prefix: 'Année Académique', type: 'REGULAR' as const },
  ] : [
    { id: '10m', label: '🏫 Année Scolaire Standard (10 mois) - Sept à Juin', months: 10, prefix: 'Année Scolaire', type: 'REGULAR' as const },
    { id: '5m', label: '📅 Semestre de Cours (5 mois)', months: 5, prefix: 'Semestre', type: 'REGULAR' as const },
    { id: '3m', label: '⚡ Trimestre d\'Été Spécial (3 mois)', months: 3, prefix: 'Session Spéciale', type: 'INTENSIVE' as const },
    { id: '12m', label: '🏫 Année Scolaire Complète (12 mois)', months: 12, prefix: 'Année Scolaire', type: 'REGULAR' as const },
  ];

  const [activeFilter, setActiveFilter] = useState<'ALL' | 'REGULAR' | 'INTENSIVE' | 'SPECIAL'>('ALL');
  const [viewMode, setViewMode] = useState<'CURRENT' | 'ARCHIVED'>('CURRENT');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [sessionToDelete, setSessionToDelete] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showArchivingGuide, setShowArchivingGuide] = useState(false);
  const [showPassationGuide, setShowPassationGuide] = useState(false);

  const [confirmState, setConfirmState] = useState<{
    year: any;
    status: string;
  } | null>(null);

  // Helper to map type to friendly badge and icon
  const getSessionTypeBadge = (type: string) => {
    switch (type) {
      case 'INTENSIVE':
        return {
          label: 'Session Intensive',
          icon: <Zap size={13} className="text-amber-500" />,
          classes: 'bg-amber-50 text-amber-800 border-amber-200'
        };
      case 'SPECIAL':
        return {
          label: 'Session Spéciale',
          icon: <Sparkles size={13} className="text-purple-500" />,
          classes: 'bg-purple-50 text-purple-800 border-purple-200'
        };
      case 'REGULAR':
      default:
        return {
          label: 'Session Normale',
          icon: <BookOpen size={13} className="text-indigo-500" />,
          classes: 'bg-indigo-50 text-indigo-800 border-indigo-200'
        };
    }
  };

  const handleAddYear = async () => {
    let finalLabel = newYearData.label.trim();
    if (!finalLabel) {
      if (!isHigherEd) {
        // If empty in classic mode, try to generate YYYY-YYYY format from dates
        const startYearStr = newYearData.startDate ? newYearData.startDate.substring(0, 4) : '';
        const endYearStr = newYearData.endDate ? newYearData.endDate.substring(0, 4) : '';
        if (startYearStr && endYearStr && Number(endYearStr) === Number(startYearStr) + 1) {
          finalLabel = `${startYearStr}-${endYearStr}`;
        } else {
          toast.error("Veuillez saisir un libellé au format strict 'AAAA-AAAA' (ex: 2025-2026) ou renseigner des dates de début et de fin de l'année scolaire cohérentes.");
          return;
        }
      } else {
        const typeLabel = getSessionTypeBadge(newYearData.sessionType).label;
        const startYearStr = newYearData.startDate ? newYearData.startDate.substring(0, 4) : '';
        const endYearStr = newYearData.endDate ? newYearData.endDate.substring(0, 4) : '';
        const yearSuffix = startYearStr && endYearStr && startYearStr !== endYearStr 
          ? `${startYearStr}-${endYearStr}` 
          : startYearStr || `${new Date().getFullYear()}`;
        finalLabel = `${typeLabel} ${yearSuffix}`;
      }
    }

    // Classic schools constraints
    if (!isHigherEd) {
      const formatRegex = /^(\d{4})-(\d{4})$/;
      const match = finalLabel.match(formatRegex);
      if (!match) {
        toast.error("Le libellé de l'année scolaire doit être au format strict 'AAAA-AAAA' (ex: 2025-2026).");
        return;
      }

      const yearStart = parseInt(match[1], 10);
      const yearEnd = parseInt(match[2], 10);
      if (yearEnd !== yearStart + 1) {
        toast.error(`Année scolaire non valide. L'année de fin (${yearEnd}) doit être supérieure d'un an à l'année de début (${yearStart}). Exemple : ${yearStart}-${yearStart + 1}`);
        return;
      }

      const hasFutureSession = years.some(y => y.status === 'FUTURE');
      if (hasFutureSession) {
        toast.error("Une session est déjà en cours de préparation (Future). Veuillez l'activer ou l'archiver avant d'en créer une nouvelle.");
        return;
      }
    }

    // Check for label duplicates within the same type to be safe
    const isDuplicate = years.some(
      y => y.label.toLowerCase() === finalLabel.toLowerCase() && 
      (y.session_type || 'REGULAR') === newYearData.sessionType
    );
    if (isDuplicate) {
      toast.error(`Une session de type "${getSessionTypeBadge(newYearData.sessionType).label}" avec le libellé "${finalLabel}" existe déjà.`);
      return;
    }

    setActionLoading('add_year');
    try {
      const { data, error } = await supabase
        .from('academic_years')
        .insert([{
          school_id: user.school_id,
          label: finalLabel,
          status: 'VIERGE',
          start_date: newYearData.startDate || null,
          end_date: newYearData.endDate || null,
          session_type: newYearData.sessionType,
          is_active: false
        }])
        .select()
        .single();

      if (error) throw error;
      
      setNewYearData({
        label: '',
        startDate: '',
        endDate: '',
        sessionType: 'REGULAR'
      });
      
      await onRefresh();
      toast.success("Nouvelle session académique ajoutée avec succès");
    } catch (err: any) {
      console.error("Error adding year:", err);
      toast.error(err.message || "Erreur lors de l'ajout de la session");
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateStatus = async (yearId: string, status: string) => {
    // Prevent multiple future sessions for classic mode
    if (!isHigherEd && status === 'FUTURE') {
      const hasFutureSession = years.some(y => y.status === 'FUTURE' && y.id !== yearId);
      if (hasFutureSession) {
        toast.error("Une session est déjà en cours de préparation.");
        return;
      }
    }

    setActionLoading('status_' + yearId);
    try {
      if (status === 'ACTIVE') {
        if (isHigherEd) {
          // Parallel model: directly activate without archiving other running sessions
          const { error } = await supabase
            .from('academic_years')
            .update({ status: 'ACTIVE', is_active: true })
            .eq('id', yearId)
            .eq('school_id', user.school_id);
          if (error) throw error;
        } else {
          // Classic mode: deactivate other active years first, then activate target year
          await supabase
            .from('academic_years')
            .update({ status: 'PAST', is_active: false })
            .eq('school_id', user.school_id)
            .eq('status', 'ACTIVE');

          const { error: activateError } = await supabase
            .from('academic_years')
            .update({ status: 'ACTIVE', is_active: true })
            .eq('id', yearId)
            .eq('school_id', user.school_id);

          if (activateError) {
            // Fallback to RPC if needed
            const { error: rpcError } = await supabase.rpc('activate_academic_year', {
              p_school_id: user.school_id,
              p_year_id: yearId
            });
            if (rpcError) throw rpcError;
          }
        }
      } else {
        // Archiving (PAST) or placing in preparation (FUTURE/VIERGE)
        const isActiveState = status === 'ACTIVE';
        const { error } = await supabase
          .from('academic_years')
          .update({ status, is_active: isActiveState })
          .eq('id', yearId)
          .eq('school_id', user.school_id);
        if (error) throw error;
      }
      
      await onRefresh();
      toast.success("Statut de la session mis à jour avec succès");
      setConfirmState(null);
    } catch (err: any) {
      console.error("Error updating status:", err);
      toast.error(err.message || "Erreur lors de la mise à jour");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteYear = async () => {
    if (!sessionToDelete) return;
    setIsDeleting(true);
    try {
      // Clear dependent tables first to avoid foreign key restrict errors (cascading cleanup)
      const tablesToClean = [
        'payments', 'enrollments', 'fee_plans', 'supply_catalog', 
        'expenses', 'school_supplies', 'grades', 'student_attendances', 
        'course_signatures', 'staff_assignments', 'disciplinary_records'
      ];
      
      for (const table of tablesToClean) {
        await supabase.from(table).delete().eq('academic_year_id', sessionToDelete.id).eq('school_id', user.school_id);
      }

      const { error } = await supabase
        .from('academic_years')
        .delete()
        .eq('id', sessionToDelete.id)
        .eq('school_id', user.school_id);

      if (error) throw error;
      
      setSessionToDelete(null);
      await onRefresh();
      toast.success("La session et toutes ses données associées ont été supprimées");
    } catch (err: any) {
      console.error("Error deleting year:", err);
      toast.error(err.message || "Erreur lors de la suppression de la session");
    } finally {
      setIsDeleting(false);
    }
  };

  // Filter and group sessions
  const filteredYears = years.filter(y => {
    const type = y.session_type || 'REGULAR';
    const typeMatch = activeFilter === 'ALL' || type === activeFilter;
    const statusMatch = viewMode === 'ARCHIVED' ? y.status === 'PAST' : y.status !== 'PAST';
    return typeMatch && statusMatch;
  });

  const archivedYears = years.filter(y => y.status === 'PAST');
  const currentYears = years.filter(y => y.status !== 'PAST');

  // Calculate quick metrics (based on current or all?)
  // Let's make total sessions count reflect the current view mode
  const totalSessionsCount = currentYears.length;
  const activeSessionsCount = currentYears.filter(y => y.status === 'ACTIVE' || y.is_active).length;
  const intensiveCount = currentYears.filter(y => y.session_type === 'INTENSIVE').length;
  const specialCount = currentYears.filter(y => y.session_type === 'SPECIAL').length;

  return (
    <div id="session-manager-root" className="space-y-4 sm:space-y-5">
      
      {/* 1. Header & Context Infotip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5 text-indigo-600 font-mono text-[10px] uppercase tracking-wider font-extrabold">
            <Sparkles size={13} className="text-indigo-500" />
            <span>{isHigherEd ? "Moteur Multi-Sessions Parallèles" : "Cycle Classique"}</span>
          </div>
          <h2 className="text-lg sm:text-xl font-black tracking-tight text-slate-900">
            Gestion des {terminology.academicYears}
          </h2>
          <p className="text-slate-500 text-xs font-medium max-w-xl leading-relaxed">
            {isHigherEd 
              ? "Exécution autonome de plusieurs sessions universitaires en parallèle."
              : `Créez et configurez l'${terminology.academicYear.toLowerCase()} active pour votre école classique.`
            }
          </p>
        </div>
        
        {isHigherEd ? (
          <button 
            onClick={() => setShowArchivingGuide(true)}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 transition-all active:scale-95 flex items-center gap-1.5 whitespace-nowrap self-start sm:self-center cursor-pointer shadow-2xs"
          >
            <HelpCircle size={14} className="text-slate-500" />
            <span>Comment Archiver ?</span>
          </button>
        ) : (
          <button 
            onClick={() => setShowPassationGuide(true)}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 transition-all active:scale-95 flex items-center gap-1.5 whitespace-nowrap self-start sm:self-center cursor-pointer shadow-2xs"
          >
            <HelpCircle size={14} className="text-indigo-600" />
            <span>Principes de Passation ?</span>
          </button>
        )}
      </div>

      {/* Modale Guide de Passation (École Classique) */}
      <Modal
        isOpen={showPassationGuide}
        onClose={() => setShowPassationGuide(false)}
        title="Principes de Passation d'Année Scolaire"
        hideIcon={true}
        hideTitle={true}
        hideDefaultActions={true}
        hideCloseButton={true}
        containerClassName="max-w-xl sm:max-w-2xl md:max-w-3xl rounded-3xl overflow-hidden shadow-2xl border border-slate-100 max-h-[90vh] flex flex-col"
        contentClassName="p-0 flex-1 min-h-0 flex flex-col overflow-hidden"
      >
        <div className="flex flex-col h-full overflow-hidden bg-white">
          {/* Header Banner - Fixed */}
          <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 p-5 sm:p-6 md:p-7 text-white relative shrink-0">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-500/15 rounded-full blur-2xl pointer-events-none" />
            
            {/* Dedicated High-Contrast Close Button */}
            <button
              onClick={() => setShowPassationGuide(false)}
              className="absolute top-4 right-4 sm:top-5 sm:right-5 p-2 text-white/75 hover:text-white hover:bg-white/10 active:scale-95 rounded-xl transition-all z-20 cursor-pointer"
              title="Fermer le guide"
              aria-label="Fermer"
            >
              <X size={20} />
            </button>

            <div className="relative z-10 space-y-2 pr-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/25 border border-indigo-400/30 text-indigo-200 text-[10px] sm:text-[11px] font-extrabold uppercase tracking-widest">
                <ShieldCheck size={14} className="text-indigo-400" />
                <span>Guide de Gouvernance Académique</span>
              </div>
              <h3 className="text-lg sm:text-2xl font-black text-white tracking-tight leading-tight">
                Principes de Passation d'Année
              </h3>
              <p className="text-slate-300 text-xs sm:text-sm font-normal leading-relaxed max-w-xl">
                4 règles essentielles pour garantir la sécurité et la continuité des données lors du changement d'année scolaire.
              </p>
            </div>
          </div>

          {/* Body Content - Scrollable on Tablets, Mobiles & Laptops */}
          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4 sm:p-6 md:p-7 space-y-4 sm:space-y-5 bg-slate-50/70">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              
              {/* Card 1 */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs hover:border-indigo-300 transition-all space-y-2 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="p-2 sm:p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                      <CalendarCheck size={18} className="sm:w-5 sm:h-5" />
                    </div>
                    <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                      Règle 01
                    </span>
                  </div>
                  <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 tracking-tight">Unicité Active</h4>
                  <p className="text-[11px] sm:text-xs text-slate-600 leading-relaxed font-normal">
                    Une seule année scolaire est active à la fois. L'ouverture de la nouvelle session archive automatiquement la précédente.
                  </p>
                </div>
              </div>

              {/* Card 2 */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs hover:border-indigo-300 transition-all space-y-2 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="p-2 sm:p-2.5 bg-amber-50 text-amber-600 rounded-xl">
                      <Lock size={18} className="sm:w-5 sm:h-5" />
                    </div>
                    <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100">
                      Règle 02
                    </span>
                  </div>
                  <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 tracking-tight">Gel Historique</h4>
                  <p className="text-[11px] sm:text-xs text-slate-600 leading-relaxed font-normal">
                    Toutes les notes, paiements et reçus de l'année précédente sont scellés et archivés en consultation sécurisée.
                  </p>
                </div>
              </div>

              {/* Card 3 */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs hover:border-indigo-300 transition-all space-y-2 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="p-2 sm:p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                      <GraduationCap size={18} className="sm:w-5 sm:h-5" />
                    </div>
                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                      Règle 03
                    </span>
                  </div>
                  <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 tracking-tight">Promotions & Réinscriptions</h4>
                  <p className="text-[11px] sm:text-xs text-slate-600 leading-relaxed font-normal">
                    Les élèves admis sont automatiquement orientés vers leurs classes d'accueil supérieures via le module dédié.
                  </p>
                </div>
              </div>

              {/* Card 4 */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs hover:border-indigo-300 transition-all space-y-2 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="p-2 sm:p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                      <Receipt size={18} className="sm:w-5 sm:h-5" />
                    </div>
                    <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                      Règle 04
                    </span>
                  </div>
                  <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 tracking-tight">Tarification & Inscription</h4>
                  <p className="text-[11px] sm:text-xs text-slate-600 leading-relaxed font-normal">
                    Configurez la grille tarifaire (frais d'inscription, écolages) de la nouvelle année avant la réinscription globale.
                  </p>
                </div>
              </div>

            </div>

            {/* Tip Callout */}
            <div className="p-3.5 sm:p-4 bg-indigo-50/80 border border-indigo-100 rounded-2xl flex items-start gap-3">
              <Lightbulb size={18} className="text-indigo-600 shrink-0 mt-0.5" />
              <p className="text-xs text-indigo-950 leading-relaxed font-medium">
                <strong className="font-extrabold text-indigo-900">Recommandation EduNova :</strong> Clôturez la saisie des notes et la remise des bulletins scolaires avant d'activer officiellement la nouvelle année.
              </p>
            </div>

            {/* Confirmation Button */}
            <div className="pt-2 pb-1">
              <button
                onClick={() => setShowPassationGuide(false)}
                className="w-full py-3.5 sm:py-4 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white rounded-2xl font-bold text-xs sm:text-sm tracking-tight transition-all shadow-md shadow-indigo-200 flex items-center justify-center gap-2 cursor-pointer"
              >
                <CheckCircle2 size={18} />
                <span>J'ai compris les principes</span>
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* 1.1 Archiving Quick Guide (Modal) */}
      <Modal
        isOpen={showArchivingGuide}
        onClose={() => setShowArchivingGuide(false)}
        title="Guide d'Archivage"
        hideIcon={true}
        hideTitle={true}
        hideDefaultActions={true}
        hideCloseButton={true}
        containerClassName="max-w-xl sm:max-w-2xl md:max-w-3xl rounded-3xl overflow-hidden shadow-2xl border border-slate-100 max-h-[90vh] flex flex-col"
        contentClassName="p-0 flex-1 min-h-0 flex flex-col overflow-hidden"
      >
        <div className="flex flex-col h-full overflow-hidden bg-white">
          {/* Header Banner - Fixed */}
          <div className="bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-5 sm:p-6 md:p-7 text-white relative shrink-0">
            {/* Dedicated High-Contrast Close Button */}
            <button
              onClick={() => setShowArchivingGuide(false)}
              className="absolute top-4 right-4 sm:top-5 sm:right-5 p-2 text-white/75 hover:text-white hover:bg-white/10 active:scale-95 rounded-xl transition-all z-20 cursor-pointer"
              title="Fermer le guide"
              aria-label="Fermer"
            >
              <X size={20} />
            </button>

            <div className="relative z-10 space-y-2 pr-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-indigo-300 text-[10px] sm:text-[11px] font-extrabold uppercase tracking-widest">
                <Bookmark size={14} className="text-indigo-400" />
                <span>Mode Universitaire & Supérieur</span>
              </div>
              <h3 className="text-lg sm:text-2xl font-black text-white tracking-tight leading-tight">
                Guide d'Archivage des Sessions
              </h3>
              <p className="text-slate-300 text-xs sm:text-sm font-normal leading-relaxed max-w-xl">
                Fonctionnement autonome des sessions académiques et trimestres universitaires.
              </p>
            </div>
          </div>

          {/* Body Content - Scrollable */}
          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4 sm:p-6 md:p-7 space-y-4 bg-slate-50/70">
            <div className="space-y-3">
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                  <h4 className="text-xs font-black uppercase tracking-wider text-indigo-600">1. Clôture Autonome</h4>
                </div>
                <p className="text-xs text-slate-700 font-medium leading-relaxed pl-4">
                  Chaque session possède son propre contrôle <span className="font-bold text-slate-900">"Archiver"</span>. Vous l'archivez manuellement une fois ses cours et évaluations finalisés.
                </p>
              </div>

              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                  <h4 className="text-xs font-black uppercase tracking-wider text-indigo-600">2. Indépendance des Sessions</h4>
                </div>
                <p className="text-xs text-slate-700 font-medium leading-relaxed pl-4">
                  Archiver une session d'été ou un semestre n'impacte pas les autres sessions ouvertes qui demeurent actives et opérationnelles.
                </p>
              </div>

              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                  <h4 className="text-xs font-black uppercase tracking-wider text-indigo-600">3. Historisation Immuable</h4>
                </div>
                <p className="text-xs text-slate-700 font-medium leading-relaxed pl-4">
                  Toutes les notes, procès-verbaux d'examen et règlements demeurent scellés et disponibles pour la génération de relevés de notes officiels.
                </p>
              </div>
            </div>

            {/* Confirmation Button */}
            <div className="pt-2 pb-1">
              <button
                onClick={() => setShowArchivingGuide(false)}
                className="w-full py-3.5 sm:py-4 bg-slate-900 hover:bg-black active:scale-[0.99] text-white rounded-2xl font-bold text-xs sm:text-sm tracking-tight transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <CheckCircle2 size={18} />
                <span>J'ai compris le fonctionnement</span>
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* 2. Metrics Grid */}
      <div className={`grid grid-cols-1 ${isHigherEd ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2'} gap-3 sm:gap-3.5`}>
        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Total {terminology.academicYears}</p>
            <p className="text-2xl font-black text-slate-900">{totalSessionsCount}</p>
          </div>
          <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 text-slate-700">
            <Calendar size={18} />
          </div>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{terminology.academicYears} Actives</p>
            <p className="text-2xl font-black text-emerald-600 flex items-center gap-1.5">
              {activeSessionsCount}
              {activeSessionsCount > 0 && (
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              )}
            </p>
          </div>
          <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-100">
            <TrendingUp size={18} />
          </div>
        </div>

        {isHigherEd && (
          <>
            <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Sessions Intensives</p>
                <p className="text-2xl font-black text-amber-600">{intensiveCount}</p>
              </div>
              <div className="p-2.5 bg-amber-50 text-amber-700 rounded-lg border border-amber-100">
                <Zap size={18} />
              </div>
            </div>

            <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Sessions Spéciales</p>
                <p className="text-2xl font-black text-purple-600">{specialCount}</p>
              </div>
              <div className="p-2.5 bg-purple-50 text-purple-700 rounded-lg border border-purple-100">
                <Sparkles size={18} />
              </div>
            </div>
          </>
        )}
      </div>

      {/* 3. New Session Creation Block */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100 shadow-2xs">
              <Plus size={16} />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold tracking-tight text-slate-900">
                {isHigherEd ? "Ajouter une Nouvelle Session Universitaire" : "Initialisation d'une Nouvelle Année Scolaire"}
              </h3>
              <p className="text-[11px] text-slate-500 font-normal">
                {isHigherEd 
                  ? "Configurez les dates et le type pour votre prochaine session académique."
                  : "Définissez le libellé et les dates officielles pour entamer la passation administrative."}
              </p>
            </div>
          </div>

          {/* Current Active Badge for context */}
          {currentYears.find(y => y.status === 'ACTIVE' || y.is_active) && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200/80 rounded-lg text-emerald-800 text-[11px] font-semibold self-start sm:self-auto">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>{isHigherEd ? 'Session Active' : 'Année Active'} : <strong className="font-bold">{currentYears.find(y => y.status === 'ACTIVE' || y.is_active)?.label}</strong></span>
            </div>
          )}
        </div>

        {/* Higher-Ed Only: Templates Quick Select Pills */}
        {isHigherEd && (
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-0.5 block">
              ⚡ Modèles Universitaires & Durées Rapides
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {templates.map(tpl => {
                const isSelected = selectedPreset === tpl.id;
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        setSelectedPreset('');
                      } else {
                        setSelectedPreset(tpl.id);
                        applyTemplate(tpl.months, tpl.prefix, tpl.type);
                      }
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between gap-1 cursor-pointer ${
                      isSelected 
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs' 
                        : 'bg-slate-50 hover:bg-slate-100/80 border-slate-200 text-slate-800'
                    }`}
                  >
                    <span className={`text-[9px] font-black uppercase tracking-wider ${isSelected ? 'text-indigo-100' : 'text-slate-500'}`}>
                      {tpl.type === 'INTENSIVE' ? '⚡ Intensif' : tpl.months + ' Mois'}
                    </span>
                    <span className="text-xs font-bold line-clamp-1 leading-tight">
                      {tpl.prefix}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Inputs Form */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-0.5">
          {/* Libellé */}
          <div className={`col-span-12 ${isHigherEd ? 'md:col-span-4' : 'md:col-span-4'} space-y-1`}>
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black text-slate-700 uppercase tracking-wider ml-0.5">
                {isHigherEd ? "Libellé de la session" : "Libellé de l'année scolaire *"}
              </label>
              {isHigherEd && (
                <span className="text-[9px] text-indigo-600 font-extrabold uppercase tracking-wider mr-0.5 bg-indigo-50 px-1 py-0.5 rounded">
                  Optionnel
                </span>
              )}
            </div>
            <input 
              type="text" 
              placeholder={isHigherEd ? "Ex: Session Automne 2026" : "Ex: 2025-2026"} 
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all font-sans"
              value={newYearData.label}
              onChange={e => {
                setNewYearData({...newYearData, label: e.target.value});
                if (selectedPreset) setSelectedPreset('');
              }}
            />
            <p className="text-[10px] text-slate-400 font-medium ml-0.5">
              {isHigherEd ? "Sera généré d'après les dates si laissé vide" : "Format obligatoire : AAAA-AAAA (ex: 2025-2026)"}
            </p>
          </div>

          {/* Type of Session (Higher Ed Only) */}
          {isHigherEd && (
            <div className="col-span-12 md:col-span-4 space-y-1">
              <label className="text-[10px] font-black text-slate-700 uppercase tracking-wider ml-0.5">Type de session</label>
              <select
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all"
                value={newYearData.sessionType}
                onChange={e => {
                  setNewYearData({...newYearData, sessionType: e.target.value as any});
                  if (selectedPreset) setSelectedPreset('');
                }}
              >
                <option value="REGULAR">📝 Session Normale / Semestre</option>
                <option value="INTENSIVE">⚡ Session Intensive / Accélérée</option>
                <option value="SPECIAL">✨ Session Spéciale / Thématique</option>
              </select>
            </div>
          )}

          {/* Dates */}
          <div className={`col-span-12 ${isHigherEd ? 'md:col-span-2' : 'md:col-span-4'} space-y-1`}>
            <label className="text-[10px] font-black text-slate-700 uppercase tracking-wider ml-0.5 block">
              Début {isHigherEd ? 'session' : "d'année scolaire"}
            </label>
            <input 
              type="date" 
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all font-mono"
              value={newYearData.startDate}
              onChange={e => {
                setNewYearData({...newYearData, startDate: e.target.value});
                if (selectedPreset) setSelectedPreset('');
              }}
            />
          </div>

          <div className={`col-span-12 ${isHigherEd ? 'md:col-span-2' : 'md:col-span-4'} space-y-1`}>
            <label className="text-[10px] font-black text-slate-700 uppercase tracking-wider ml-0.5 block">
              Fin {isHigherEd ? 'session' : "d'année scolaire"}
            </label>
            <input 
              type="date" 
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all font-mono"
              value={newYearData.endDate}
              onChange={e => {
                setNewYearData({...newYearData, endDate: e.target.value});
                if (selectedPreset) setSelectedPreset('');
              }}
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-2.5 border-t border-slate-100">
          <p className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5">
            <Info size={13} className="text-indigo-500 shrink-0" />
            <span>
              {isHigherEd 
                ? "La nouvelle session sera créée avec le statut Nouvelle (Vierge) prête pour la préparation."
                : "La nouvelle année scolaire sera créée avec le statut Nouvelle (Vierge) prête pour la configuration."}
            </span>
          </p>

          <button 
            onClick={handleAddYear} 
            disabled={actionLoading === 'add_year'} 
            className="w-full sm:w-auto px-5 h-[38px] bg-slate-900 hover:bg-black text-white rounded-xl transition-all shadow-2xs active:scale-95 flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {actionLoading === 'add_year' ? <Loader2 size={14} className="animate-spin" /> : <Plus size={15} />}
            <span className="text-xs font-bold whitespace-nowrap">
              Créer {isHigherEd ? 'la session' : "l'année scolaire"}
            </span>
          </button>
        </div>
      </div>

      {/* 4. Filter & View Mode Tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        {/* View Mode Toggle */}
        <div className="flex items-center bg-slate-100 p-0.5 rounded-xl w-full sm:w-auto">
          <button 
            onClick={() => setViewMode('CURRENT')} 
            className={`flex-1 sm:flex-none px-4 py-2 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${viewMode === 'CURRENT' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            <Calendar size={13} className={viewMode === 'CURRENT' ? 'text-indigo-600' : 'text-slate-500'} />
            {isHigherEd ? 'Sessions Actives' : 'Années Scolaires Actives'} ({currentYears.length})
          </button>
          <button 
            onClick={() => setViewMode('ARCHIVED')} 
            className={`flex-1 sm:flex-none px-4 py-2 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${viewMode === 'ARCHIVED' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            <Bookmark size={13} className={viewMode === 'ARCHIVED' ? 'text-slate-700' : 'text-slate-500'} />
            Archives ({archivedYears.length})
          </button>
        </div>

        {/* Type Filter */}
        {isHigherEd && (
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-50 p-0.5 rounded-xl border border-slate-100">
            <button 
              onClick={() => setActiveFilter('ALL')} 
              className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${activeFilter === 'ALL' ? 'bg-white text-slate-950 shadow-2xs border border-slate-200/50' : 'text-slate-600 hover:bg-slate-200/50'}`}
            >
              Tout
            </button>
            <button 
              onClick={() => setActiveFilter('REGULAR')} 
              className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center gap-1 cursor-pointer ${activeFilter === 'REGULAR' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-200/50'}`}
            >
              <BookOpen size={11} />
              Normales
            </button>
            <button 
              onClick={() => setActiveFilter('INTENSIVE')} 
              className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center gap-1 cursor-pointer ${activeFilter === 'INTENSIVE' ? 'bg-amber-500 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-200/50'}`}
            >
              <Zap size={11} />
              Intensives
            </button>
            <button 
              onClick={() => setActiveFilter('SPECIAL')} 
              className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center gap-1 cursor-pointer ${activeFilter === 'SPECIAL' ? 'bg-purple-600 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-200/50'}`}
            >
              <Sparkles size={11} />
              Spéciales
            </button>
          </div>
        )}
      </div>

      {/* 5. Sessions Interactive Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
        <AnimatePresence mode="popLayout">
          {filteredYears.length === 0 ? (
            <div className="md:col-span-2 py-12 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl space-y-2">
              {viewMode === 'ARCHIVED' ? (
                <>
                  <Bookmark size={32} className="mx-auto text-slate-300" />
                  <p className="text-slate-700 font-bold text-sm">Aucune archive disponible.</p>
                  <p className="text-slate-500 text-xs">Les sessions terminées que vous archivez apparaîtront ici.</p>
                </>
              ) : (
                <>
                  <Calendar size={32} className="mx-auto text-slate-300" />
                  <p className="text-slate-700 font-bold text-sm">Aucune session active ou en préparation trouvée.</p>
                  <p className="text-slate-500 text-xs">Créez une nouvelle session pour démarrer.</p>
                </>
              )}
            </div>
          ) : (
            filteredYears.map(year => {
              const typeBadge = getSessionTypeBadge(year.session_type);
              const isActive = year.status === 'ACTIVE' || year.is_active;
              
              return (
                <motion.div 
                  layout
                  key={year.id} 
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.25 }}
                  className={`flex flex-col p-4 sm:p-5 rounded-2xl border transition-all gap-3.5 ${isActive ? 'bg-slate-900/[0.02] border-indigo-500/80 shadow-md shadow-indigo-950/5 ring-1 ring-indigo-500/20' : year.status === 'FUTURE' ? 'bg-indigo-50/20 border-indigo-200/80' : 'bg-white border-slate-200/80 shadow-2xs hover:shadow-xs'}`}
                >
                  {/* Top Line: Badge, Libellé, Status */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      {isHigherEd && (
                        <div className="flex items-center gap-1.5">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border flex items-center gap-1 ${typeBadge.classes}`}>
                            {typeBadge.icon}
                            {typeBadge.label}
                          </span>
                        </div>
                      )}
                      
                      <h3 className="text-lg font-black text-slate-900 tracking-tight leading-snug">
                        {year.label}
                      </h3>
                      
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <Calendar size={12} className="text-slate-500" />
                        <span className="text-[11px] font-bold uppercase tracking-tight">
                          {year.start_date ? new Date(year.start_date).toLocaleDateString('fr-FR', {month: 'long', year: 'numeric'}) : 'N/A'} — {year.end_date ? new Date(year.end_date).toLocaleDateString('fr-FR', {month: 'long', year: 'numeric'}) : 'N/A'}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      {year.status === 'ACTIVE' && (
                        <span className="px-2.5 py-0.5 bg-slate-900 text-white rounded-lg text-[9px] font-black uppercase tracking-wider shadow-2xs flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse"></span>
                          Actif
                        </span>
                      )}
                      {year.status === 'FUTURE' && (
                        <span className="px-2 py-0.5 bg-indigo-500 text-white rounded-md text-[9px] font-black uppercase tracking-wider shadow-2xs">
                          En Préparation
                        </span>
                      )}
                      {year.status === 'VIERGE' && (
                        <span className="px-2 py-0.5 bg-amber-500 text-white rounded-md text-[9px] font-black uppercase tracking-wider shadow-2xs">
                          Nouvelle
                        </span>
                      )}
                      {year.status === 'PAST' && (
                        <span className="px-2 py-0.5 bg-slate-400 text-white rounded-md text-[9px] font-black uppercase tracking-wider shadow-2xs">
                          Archivée
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100">
                    {/* Launch button */}
                    {year.status !== 'ACTIVE' && year.status !== 'PAST' && (
                      <button 
                        onClick={() => setConfirmState({ year, status: 'ACTIVE' })} 
                        disabled={actionLoading?.startsWith('status_')} 
                        className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-black transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5 shadow-2xs cursor-pointer"
                      >
                        {actionLoading === 'status_' + year.id && <Loader2 size={11} className="animate-spin" />}
                        {isHigherEd ? 'Lancer la session' : "Lancer l'année scolaire"}
                      </button>
                    )}

                    {/* Set to preparation button */}
                    {year.status === 'VIERGE' && (
                      <button 
                        onClick={() => setConfirmState({ year, status: 'FUTURE' })} 
                        disabled={actionLoading?.startsWith('status_')} 
                        className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5 shadow-2xs cursor-pointer"
                      >
                        {actionLoading === 'status_' + year.id && <Loader2 size={11} className="animate-spin" />}
                        Mettre en préparation
                      </button>
                    )}

                    {/* Archive button */}
                    {year.status !== 'PAST' && year.status !== 'ACTIVE' && (
                      <button 
                        onClick={() => setConfirmState({ year, status: 'PAST' })} 
                        disabled={actionLoading?.startsWith('status_')} 
                        className="px-3 py-1.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-slate-200 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                      >
                        {actionLoading === 'status_' + year.id && <Loader2 size={11} className="animate-spin text-slate-700" />}
                        {isHigherEd ? 'Archiver la session' : "Archiver l'année"}
                      </button>
                    )}
                    
                    {/* Archive active directly (expert mode for parallel sessions) */}
                    {isActive && isHigherEd && (
                      <button 
                        onClick={() => setConfirmState({ year, status: 'PAST' })} 
                        disabled={actionLoading?.startsWith('status_')} 
                        className="px-3 py-1.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-slate-200 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                      >
                        {actionLoading === 'status_' + year.id && <Loader2 size={11} className="animate-spin text-slate-700" />}
                        Terminer / Archiver
                      </button>
                    )}

                    {/* Delete button */}
                    {(year.status === 'VIERGE' || year.status === 'FUTURE' || year.status === 'PAST') && (
                      <button 
                        onClick={() => setSessionToDelete(year)} 
                        className="p-1.5 text-rose-600 bg-rose-50/50 hover:bg-rose-50 border border-rose-200 hover:border-rose-300 rounded-lg transition-all ml-auto active:scale-90 flex items-center justify-center cursor-pointer"
                        title="Supprimer définitivement"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>

      {/* MODAL 1: Confirm state update (Lancer / Préparer / Archiver) */}
      <Modal 
        isOpen={confirmState !== null} 
        onClose={() => setConfirmState(null)}
        title={isHigherEd ? "Passation de Session" : "Passation d'Année Scolaire"}
        hideIcon={true}
        hideTitle={true}
        hideDefaultActions={true}
        containerClassName="max-w-xl rounded-3xl overflow-hidden shadow-2xl border border-slate-100"
        contentClassName="p-0"
      >
        {confirmState && (
          <div className="flex flex-col bg-white">
            {/* Modal Header Banner */}
            <div className={`p-6 sm:p-8 text-white relative overflow-hidden ${
              confirmState.status === 'ACTIVE'
                ? 'bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900'
                : confirmState.status === 'PAST'
                ? 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900'
                : 'bg-gradient-to-br from-indigo-900 via-blue-950 to-slate-900'
            }`}>
              <div className="relative z-10 flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shrink-0 shadow-inner">
                  {confirmState.status === 'ACTIVE' ? <CheckCircle2 size={32} className="text-indigo-300" /> : 
                   confirmState.status === 'PAST' ? <Bookmark size={30} className="text-indigo-300" /> : 
                   <Sparkles size={30} className="text-amber-300" />}
                </div>
                <div>
                  <span className="inline-block px-2.5 py-0.5 rounded-full bg-white/15 border border-white/20 text-[10px] font-black uppercase tracking-widest text-white/90 mb-1">
                    Passation Académique
                  </span>
                  <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-tight">
                    {confirmState.status === 'ACTIVE' 
                      ? (isHigherEd ? 'Lancer la Session Active ?' : "Activer cette Année Scolaire ?") 
                      : confirmState.status === 'PAST' 
                      ? (isHigherEd ? 'Archiver cette Session ?' : "Archiver cette Année Scolaire ?") 
                      : 'Mettre en Préparation ?'}
                  </h3>
                </div>
              </div>
            </div>

            {/* Modal Content Body */}
            <div className="p-6 sm:p-8 space-y-6 bg-slate-50/50">
              {/* Target Session Detail Card */}
              <div className="p-5 bg-white border border-slate-200/90 rounded-2xl shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                      {isHigherEd ? "Session Sélectionnée" : "Année Scolaire Sélectionnée"}
                    </span>
                    <h4 className="text-lg font-black text-slate-900">{confirmState.year.label}</h4>
                  </div>
                  {isHigherEd && (
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${getSessionTypeBadge(confirmState.year.session_type).classes}`}>
                      {getSessionTypeBadge(confirmState.year.session_type).label}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-semibold text-slate-700">
                  <div>
                    <span className="text-slate-700 text-[10px] uppercase font-bold block">Début :</span>
                    <span className="font-extrabold text-slate-900">
                      {confirmState.year.start_date ? new Date(confirmState.year.start_date).toLocaleDateString('fr-FR', {day: 'numeric', month: 'long', year: 'numeric'}) : 'Non spécifié'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-700 text-[10px] uppercase font-bold block">Fin :</span>
                    <span className="font-extrabold text-slate-900">
                      {confirmState.year.end_date ? new Date(confirmState.year.end_date).toLocaleDateString('fr-FR', {day: 'numeric', month: 'long', year: 'numeric'}) : 'Non spécifiée'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Impact / Explanation box */}
              <div className="p-4 bg-white border border-slate-200/80 rounded-2xl space-y-2.5">
                <div className="flex items-center gap-2 text-slate-900 font-extrabold text-xs">
                  <ShieldCheck size={16} className="text-indigo-600" />
                  <span>Conséquences de l'action :</span>
                </div>

                <p className="text-xs text-slate-600 font-normal leading-relaxed">
                  {confirmState.status === 'ACTIVE' ? (
                    isHigherEd 
                      ? `La session "${confirmState.year.label}" sera activée immédiatement. Elle s'exécutera en parallèle avec vos autres sessions ouvertes sans affecter leurs données.`
                      : `L'année "${confirmState.year.label}" deviendra la nouvelle année scolaire active officielle. L'ancienne année scolaire sera automatiquement archivée et sécurisée.`
                  ) : confirmState.status === 'PAST' ? (
                    isHigherEd
                      ? `La session "${confirmState.year.label}" sera déplacée vers les archives en mode lecture seule. Toutes ses notes, reçus et effectifs seront scellés pour consultation historique.`
                      : `L'année scolaire "${confirmState.year.label}" sera déplacée vers les archives. Toutes ses notes, reçus et effectifs seront scellés en consultation historique.`
                  ) : (
                    isHigherEd
                      ? `La session "${confirmState.year.label}" sera placée en statut de préparation afin que vous puissiez y configurer les cours, classes et tarifs à l'avance.`
                      : `L'année scolaire "${confirmState.year.label}" sera placée en statut de préparation afin de configurer les classes, enseignants et tarifs à l'avance.`
                  )}
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                <button 
                  onClick={() => handleUpdateStatus(confirmState.year.id, confirmState.status)}
                  disabled={actionLoading !== null}
                  className={`w-full py-4 rounded-2xl text-xs font-black uppercase tracking-widest text-white transition-all active:scale-[0.98] disabled:opacity-50 shadow-lg flex items-center justify-center gap-2 cursor-pointer ${
                    confirmState.status === 'ACTIVE' 
                      ? 'bg-slate-900 hover:bg-black shadow-slate-950/20' 
                      : confirmState.status === 'PAST' 
                      ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-950/20' 
                      : 'bg-slate-900 hover:bg-black shadow-slate-950/20'
                  }`}
                >
                  {actionLoading !== null ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                  <span>
                    {confirmState.status === 'ACTIVE' ? (isHigherEd ? 'Confirmer et Lancer la Session' : "Confirmer et Activer l'Année") : 
                     confirmState.status === 'PAST' ? (isHigherEd ? 'Oui, Archiver la Session' : "Oui, Archiver l'Année Scolaire") : 'Confirmer la Préparation'}
                  </span>
                </button>
                
                <button 
                  onClick={() => setConfirmState(null)}
                  disabled={actionLoading !== null}
                  className="w-full sm:w-auto px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold transition-all border border-slate-200/80 cursor-pointer"
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL 2: Delete confirmation */}
      <Modal 
        isOpen={sessionToDelete !== null} 
        onClose={() => setSessionToDelete(null)}
        title="Suppression Définitive"
        hideIcon={true}
        hideTitle={true}
        hideDefaultActions={true}
        containerClassName="max-w-xl rounded-3xl overflow-hidden shadow-2xl border border-slate-100"
        contentClassName="p-0"
      >
        {sessionToDelete && (
          <div className="flex flex-col bg-white">
            {/* Header Banner */}
            <div className="bg-gradient-to-br from-rose-600 via-rose-700 to-slate-900 p-6 sm:p-8 text-white relative overflow-hidden">
              <div className="relative z-10 flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shrink-0 shadow-inner">
                  <Trash2 size={30} className="text-rose-200" />
                </div>
                <div>
                  <span className="inline-block px-2.5 py-0.5 rounded-full bg-white/15 border border-white/20 text-[10px] font-black uppercase tracking-widest text-white/90 mb-1">
                    Zone Danger
                  </span>
                  <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-tight">
                    {isHigherEd ? 'Supprimer la Session ?' : "Supprimer l'Année Scolaire ?"}
                  </h3>
                </div>
              </div>
            </div>

            {/* Content Body */}
            <div className="p-6 sm:p-8 space-y-5 bg-slate-50/50">
              <p className="text-sm font-semibold text-slate-800 leading-relaxed">
                Vous êtes sur le point de supprimer définitivement {isHigherEd ? 'la session' : "l'année scolaire"} <strong className="text-slate-950 font-black">{sessionToDelete.label}</strong>.
              </p>

              <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-medium text-rose-950 space-y-2">
                <span className="font-extrabold uppercase tracking-wide text-rose-900 block">⚠️ ATTENTION : ACTION IRRÉVERSIBLE</span>
                <p>Cette opération supprimera irrévocablement :</p>
                <ul className="list-disc list-inside space-y-1 font-bold text-rose-800">
                  <li>Toutes les inscriptions enregistrées sur cette session/année</li>
                  <li>Toutes les grilles tarifaires et paiements associés</li>
                  <li>Les bulletins de notes et historiques de présence</li>
                </ul>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                <button 
                  onClick={handleDeleteYear}
                  disabled={isDeleting}
                  className="w-full py-4 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all active:scale-[0.98] disabled:opacity-50 shadow-lg shadow-rose-200 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isDeleting ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                  <span>Oui, Supprimer Définitivement</span>
                </button>
                
                <button 
                  onClick={() => setSessionToDelete(null)}
                  disabled={isDeleting}
                  className="w-full sm:w-auto px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold transition-all border border-slate-200/80 cursor-pointer"
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
}
