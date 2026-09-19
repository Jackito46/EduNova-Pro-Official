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
  X,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../supabase';
import { UserProfile, SchoolType } from '../types';
import { toast } from 'sonner';
import { useSchool } from '../contexts/SchoolContext';
import Modal from './Modal';
import { DatePickerPill } from './DatePickerPill';

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

  const [showCreateForm, setShowCreateForm] = useState(true);

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
          icon: <Zap size={12} className="text-amber-500" />,
          classes: 'bg-amber-50 text-amber-800 border-amber-200'
        };
      case 'SPECIAL':
        return {
          label: 'Session Spéciale',
          icon: <Sparkles size={12} className="text-purple-500" />,
          classes: 'bg-purple-50 text-purple-800 border-purple-200'
        };
      case 'REGULAR':
      default:
        return {
          label: 'Session Normale',
          icon: <BookOpen size={12} className="text-indigo-500" />,
          classes: 'bg-indigo-50 text-indigo-800 border-indigo-200'
        };
    }
  };

  // Helper to format academic date range
  const formatAcademicDateRange = (startDate?: string | null, endDate?: string | null) => {
    if (!startDate && !endDate) {
      return {
        startText: 'Date non définie',
        endText: 'Date non définie',
        duration: null,
        hasDates: false
      };
    }

    const formatDate = (dStr: string) => {
      try {
        const dateObj = new Date(dStr.includes('T') ? dStr : `${dStr}T00:00:00`);
        return dateObj.toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        });
      } catch {
        return dStr;
      }
    };

    const startText = startDate ? formatDate(startDate) : 'Non définie';
    const endText = endDate ? formatDate(endDate) : 'Non définie';

    let duration: string | null = null;
    if (startDate && endDate) {
      try {
        const s = new Date(startDate.includes('T') ? startDate : `${startDate}T00:00:00`);
        const e = new Date(endDate.includes('T') ? endDate : `${endDate}T00:00:00`);
        const diffTime = e.getTime() - s.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
        const diffMonths = Math.round(diffDays / 30.4375);
        if (diffMonths >= 12 && diffMonths % 12 === 0) {
          const yrs = diffMonths / 12;
          duration = `${yrs} an${yrs > 1 ? 's' : ''}`;
        } else if (diffMonths > 0) {
          duration = `${diffMonths} mois`;
        } else if (diffDays > 0) {
          duration = `${diffDays} j`;
        }
      } catch {}
    }

    return {
      startText,
      endText,
      duration,
      hasDates: Boolean(startDate || endDate)
    };
  };

  const handleAddYear = async () => {
    let finalLabel = newYearData.label.trim();
    if (!finalLabel) {
      if (!isHigherEd) {
        const startYearStr = newYearData.startDate ? newYearData.startDate.substring(0, 4) : '';
        const endYearStr = newYearData.endDate ? newYearData.endDate.substring(0, 4) : '';
        if (startYearStr && endYearStr && Number(endYearStr) === Number(startYearStr) + 1) {
          finalLabel = `${startYearStr}-${endYearStr}`;
        } else {
          toast.error("Veuillez saisir un libellé au format strict 'AAAA-AAAA' (ex: 2025-2026) ou renseigner des dates de début et de fin cohérentes.");
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

    // Check for label duplicates within the same type
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
          const { error } = await supabase
            .from('academic_years')
            .update({ status: 'ACTIVE', is_active: true })
            .eq('id', yearId)
            .eq('school_id', user.school_id);
          if (error) throw error;
        } else {
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
            const { error: rpcError } = await supabase.rpc('activate_academic_year', {
              p_school_id: user.school_id,
              p_year_id: yearId
            });
            if (rpcError) throw rpcError;
          }
        }
      } else {
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

  const activeSessionsCount = currentYears.filter(y => y.status === 'ACTIVE' || y.is_active).length;
  const currentActiveYear = currentYears.find(y => y.status === 'ACTIVE' || y.is_active);

  return (
    <div id="session-manager-root" className="space-y-3 sm:space-y-3.5 animate-in fade-in duration-300">
      
      {/* 1. COMPACT UNIFIED HEADER & TABS BAR */}
      <div className="bg-white rounded-xl shadow-2xs border border-slate-200/90 overflow-hidden">
        {/* Top Header Row */}
        <div className="p-2.5 sm:p-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 bg-slate-50/70">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100 shadow-2xs">
              <Calendar size={15} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50/80 px-1.5 py-0.2 rounded border border-indigo-200/60">
                  {isHigherEd ? "Moteur Multi-Sessions" : "Cycle Classique"}
                </span>
                <h3 className="text-xs sm:text-sm font-bold tracking-tight text-slate-900">
                  Gestion des {terminology.academicYears}
                </h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {activeSessionsCount} {activeSessionsCount > 1 ? 'Actives' : 'Active'} / {years.length}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                {isHigherEd 
                  ? "Exécution autonome de plusieurs sessions universitaires en parallèle"
                  : `Créez et configurez l'${terminology.academicYear.toLowerCase()} active pour votre école classique`
                }
              </p>
            </div>
          </div>

          {/* Top Actions */}
          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            {isHigherEd ? (
              <button 
                type="button"
                onClick={() => setShowArchivingGuide(true)}
                className="px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer active:scale-95"
              >
                <HelpCircle size={13} className="text-slate-500" />
                <span>Guide d'Archivage</span>
              </button>
            ) : (
              <button 
                type="button"
                onClick={() => setShowPassationGuide(true)}
                className="px-2.5 py-1.5 bg-white border border-indigo-200 hover:bg-indigo-50/70 text-indigo-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer active:scale-95"
                title="Consulter les principes officiels de passation d'année scolaire"
              >
                <ShieldCheck size={13} className="text-indigo-600" />
                <span>Principes de Passation</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowCreateForm(prev => !prev)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer active:scale-95 ${
                showCreateForm
                  ? 'bg-slate-900 text-white hover:bg-black'
                  : 'bg-white border border-slate-200 hover:bg-slate-50 text-slate-800'
              }`}
            >
              <Plus size={13} className={showCreateForm ? 'text-emerald-400 rotate-45 transition-transform' : 'text-emerald-600 transition-transform'} />
              <span>{showCreateForm ? 'Masquer Formulaire' : 'Nouvelle Année'}</span>
            </button>
          </div>
        </div>

        {/* Integrated Navigation Pills & Fast Indicators */}
        <div className="px-2.5 sm:px-3 py-1.5 sm:py-2 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-slate-100">
          <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar">
            <button
              type="button"
              onClick={() => setViewMode('CURRENT')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                viewMode === 'CURRENT'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Calendar size={12} />
              <span>{isHigherEd ? 'Sessions Actives' : 'Années Scolaires Actives'}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                viewMode === 'CURRENT' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
              }`}>
                {currentYears.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('ARCHIVED')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                viewMode === 'ARCHIVED'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Bookmark size={12} />
              <span>Archives</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                viewMode === 'ARCHIVED' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
              }`}>
                {archivedYears.length}
              </span>
            </button>

            {isHigherEd && (
              <div className="flex items-center gap-1 ml-1 pl-1.5 border-l border-slate-200">
                {(['ALL', 'REGULAR', 'INTENSIVE', 'SPECIAL'] as const).map(f => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setActiveFilter(f)}
                    className={`px-2 py-0.5 rounded-md text-[10.5px] font-bold transition-all cursor-pointer shrink-0 ${
                      activeFilter === f
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {f === 'ALL' && 'Tout'}
                    {f === 'REGULAR' && 'Normales'}
                    {f === 'INTENSIVE' && 'Intensives'}
                    {f === 'SPECIAL' && 'Spéciales'}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Micro-metrics & Quick Active Indicators */}
          <div className="flex items-center gap-1.5 self-start sm:self-center shrink-0">
            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200/70">
              {years.length} {years.length > 1 ? 'sessions' : 'session'}
            </span>
            {activeSessionsCount > 0 && (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/70 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {activeSessionsCount} en cours
              </span>
            )}
            {currentActiveYear && (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/70 truncate max-w-[140px]">
                Active: {currentActiveYear.label}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 2. COMPACT INITIALIZATION FORM */}
      <AnimatePresence>
        {showCreateForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
              <div className="p-2.5 sm:p-3 border-b border-slate-100 flex items-center justify-between gap-2 bg-slate-50/70">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-md bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 shrink-0 shadow-2xs">
                    <Plus size={14} />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight">
                      {isHigherEd ? "Initialisation d'une Nouvelle Session Universitaire" : "Initialisation d'une Nouvelle Année Scolaire"}
                    </h4>
                    <p className="text-[11px] text-slate-500 font-medium">
                      {isHigherEd
                        ? "Définissez le libellé, le type et les dates de votre prochaine session académique"
                        : "Définissez le libellé officiel et les dates pour entamer la passation administrative"}
                    </p>
                  </div>
                </div>

                {currentActiveYear && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 border border-emerald-200/80 rounded-md text-emerald-800 text-[10px] font-mono font-bold shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Année Active : {currentActiveYear.label}
                  </span>
                )}
              </div>

              <div className="p-3 sm:p-3.5 space-y-3">
                {/* Higher-Ed Quick Templates */}
                {isHigherEd && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono font-bold uppercase text-slate-700">
                      ⚡ Modèles Universitaires Rapides
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
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
                            className={`p-2 rounded-lg border text-left transition-all flex flex-col justify-between gap-1 cursor-pointer ${
                              isSelected 
                                ? 'bg-slate-900 text-white border-slate-900 shadow-2xs' 
                                : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                            }`}
                          >
                            <span className={`text-[9px] font-mono font-bold uppercase ${isSelected ? 'text-indigo-200' : 'text-slate-500'}`}>
                              {tpl.type === 'INTENSIVE' ? '⚡ Intensif' : tpl.months + ' Mois'}
                            </span>
                            <span className="text-xs font-bold line-clamp-1 leading-snug">
                              {tpl.prefix}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Form fields row */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-end">
                  {/* Libellé */}
                  <div className={`col-span-12 ${isHigherEd ? 'md:col-span-4' : 'md:col-span-4'} space-y-1`}>
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-mono font-bold uppercase text-slate-700">
                        {isHigherEd ? "Libellé de session" : "Libellé de l'année scolaire *"}
                      </label>
                      <span className="text-[9px] font-mono font-semibold text-slate-400">
                        {isHigherEd ? "Optionnel" : "Format AAAA-AAAA"}
                      </span>
                    </div>
                    <input
                      type="text"
                      placeholder={isHigherEd ? "Ex: Session Automne 2026" : "Ex: 2025-2026"}
                      value={newYearData.label}
                      onChange={e => {
                        setNewYearData({ ...newYearData, label: e.target.value });
                        if (selectedPreset) setSelectedPreset('');
                      }}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 placeholder:text-slate-400 placeholder:font-normal outline-none focus:border-slate-800 shadow-2xs"
                    />
                  </div>

                  {/* Session Type (Higher Ed only) */}
                  {isHigherEd && (
                    <div className="col-span-12 md:col-span-3 space-y-1">
                      <label className="text-[10px] font-mono font-bold uppercase text-slate-700">Type de session</label>
                      <select
                        value={newYearData.sessionType}
                        onChange={e => {
                          setNewYearData({ ...newYearData, sessionType: e.target.value as any });
                          if (selectedPreset) setSelectedPreset('');
                        }}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 outline-none focus:border-slate-800 shadow-2xs cursor-pointer"
                      >
                        <option value="REGULAR">Session Normale</option>
                        <option value="INTENSIVE">Session Intensive</option>
                        <option value="SPECIAL">Session Spéciale</option>
                      </select>
                    </div>
                  )}

                  {/* Date Début */}
                  <div className={`col-span-12 ${isHigherEd ? 'md:col-span-2' : 'md:col-span-4'} space-y-1 min-w-0`}>
                    <label className="text-[10px] font-mono font-bold uppercase text-slate-700">
                      Début {isHigherEd ? 'session' : "d'année scolaire"}
                    </label>
                    <DatePickerPill
                      selectedDate={newYearData.startDate}
                      onSelectDate={newDate => {
                        setNewYearData(prev => ({ ...prev, startDate: newDate }));
                        if (selectedPreset) setSelectedPreset('');
                      }}
                      labelPrefix="Du"
                      placeholder="Date d'ouverture"
                      variant="field"
                      size="sm"
                      colorScheme="indigo"
                      showShortcuts={false}
                      showQuickArrows={false}
                      showTodayBadge={true}
                      clearable={true}
                      className="w-full"
                    />
                  </div>

                  {/* Date Fin */}
                  <div className={`col-span-12 ${isHigherEd ? 'md:col-span-3' : 'md:col-span-4'} space-y-1 min-w-0`}>
                    <label className="text-[10px] font-mono font-bold uppercase text-slate-700">
                      Fin {isHigherEd ? 'session' : "d'année scolaire"}
                    </label>
                    <DatePickerPill
                      selectedDate={newYearData.endDate}
                      onSelectDate={newDate => {
                        setNewYearData(prev => ({ ...prev, endDate: newDate }));
                        if (selectedPreset) setSelectedPreset('');
                      }}
                      labelPrefix="Au"
                      placeholder="Date de clôture"
                      variant="field"
                      size="sm"
                      colorScheme="indigo"
                      showShortcuts={false}
                      showQuickArrows={false}
                      showTodayBadge={false}
                      clearable={true}
                      dropdownAlign="right"
                      className="w-full"
                    />
                  </div>
                </div>

                {/* Footer row with notice & primary action button */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100">
                  <p className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5">
                    <ShieldCheck size={13} className="text-indigo-600 shrink-0" />
                    <span>
                      {isHigherEd
                        ? "La session sera créée avec le statut Nouvelle (Vierge) prête pour la préparation."
                        : "La nouvelle année scolaire sera créée avec le statut Nouvelle (Vierge) prête pour la configuration."}
                    </span>
                  </p>

                  <button
                    type="button"
                    onClick={handleAddYear}
                    disabled={actionLoading === 'add_year'}
                    className="px-3.5 py-1.5 bg-slate-900 hover:bg-black text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-2xs active:scale-95 disabled:opacity-40 cursor-pointer shrink-0"
                  >
                    {actionLoading === 'add_year' ? (
                      <Loader2 size={13} className="animate-spin text-emerald-400" />
                    ) : (
                      <Plus size={13} className="text-emerald-400" />
                    )}
                    <span>Créer {isHigherEd ? 'la session' : "l'année scolaire"}</span>
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. SESSIONS INTERACTIVE CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3">
        <AnimatePresence mode="popLayout">
          {filteredYears.length === 0 ? (
            <div className="md:col-span-2 py-8 text-center bg-white border border-dashed border-slate-200 rounded-xl space-y-1.5 shadow-2xs">
              {viewMode === 'ARCHIVED' ? (
                <>
                  <Bookmark size={24} className="mx-auto text-slate-400" />
                  <p className="text-slate-800 text-xs font-bold">Aucune archive disponible</p>
                  <p className="text-slate-500 text-[11px]">Les sessions terminées que vous archivez apparaîtront ici.</p>
                </>
              ) : (
                <>
                  <Calendar size={24} className="mx-auto text-slate-400" />
                  <p className="text-slate-800 text-xs font-bold">Aucune session active ou en préparation</p>
                  <p className="text-slate-500 text-[11px]">Créez une nouvelle session scolaire pour démarrer la gestion.</p>
                </>
              )}
            </div>
          ) : (
            filteredYears.map(year => {
              const typeBadge = getSessionTypeBadge(year.session_type);
              const isActive = year.status === 'ACTIVE' || year.is_active;
              const range = formatAcademicDateRange(year.start_date, year.end_date);
              
              return (
                <motion.div 
                  layout
                  key={year.id} 
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.16 }}
                  className={`bg-white rounded-xl border p-3 sm:p-3.5 space-y-2.5 transition-all relative overflow-hidden ${
                    isActive 
                      ? 'border-indigo-600/90 shadow-2xs ring-2 ring-indigo-500/10' 
                      : year.status === 'FUTURE' 
                      ? 'border-indigo-200/90 shadow-2xs hover:border-indigo-300' 
                      : year.status === 'VIERGE'
                      ? 'border-amber-200/90 shadow-2xs hover:border-amber-300'
                      : 'border-slate-200 shadow-2xs opacity-85'
                  }`}
                >
                  {/* Subtle top indicator bar if active */}
                  {isActive && (
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-blue-500 to-indigo-600" />
                  )}

                  {/* Header: Title + Badges */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 border ${
                        isActive 
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-200/60'
                          : year.status === 'FUTURE'
                          ? 'bg-indigo-50 text-indigo-600 border-indigo-200/60'
                          : year.status === 'VIERGE'
                          ? 'bg-amber-50 text-amber-600 border-amber-200/60'
                          : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}>
                        <Calendar size={14} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight font-mono truncate">
                            {year.label}
                          </h4>
                          {isHigherEd && (
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-mono font-bold border uppercase shrink-0 ${typeBadge.classes}`}>
                              {typeBadge.icon}
                              {typeBadge.label}
                            </span>
                          )}
                        </div>
                        {year.created_at && (
                          <p className="text-[10px] text-slate-400 flex items-center gap-1 font-medium mt-0.5">
                            <Clock size={10} className="shrink-0" />
                            <span>Créée le {new Date(year.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Status Badges */}
                    <div className="shrink-0">
                      {isActive ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-900 text-white shadow-2xs border border-slate-800 uppercase">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Actif
                        </span>
                      ) : year.status === 'FUTURE' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80 uppercase">
                          En Préparation
                        </span>
                      ) : year.status === 'VIERGE' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-50 text-amber-700 border border-amber-200/80 uppercase">
                          Nouvelle
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 text-slate-600 border border-slate-200 uppercase">
                          Archivée
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Academic Dates Range Pill */}
                  <div className="pt-0.5">
                    {range.hasDates ? (
                      <div className="bg-slate-50 border border-slate-200/70 rounded-lg px-2.5 py-1.5 flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-1.5 text-slate-800 font-semibold truncate">
                          <span className="truncate">{range.startText}</span>
                          <ArrowRight size={10} className="text-slate-400 shrink-0" />
                          <span className="truncate">{range.endText}</span>
                        </div>

                        {range.duration && (
                          <span className="px-1.5 py-0.2 rounded bg-white border border-slate-200 text-indigo-700 text-[10px] font-mono font-bold shrink-0">
                            {range.duration}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="bg-slate-50/70 border border-dashed border-slate-200 rounded-lg px-2.5 py-1.5 flex items-center justify-between gap-2 text-xs">
                        <span className="text-slate-500 font-medium text-[11px]">Période officielle non configurée</span>
                        <span className="text-[10px] text-slate-400 italic">Dates à définir</span>
                      </div>
                    )}
                  </div>

                  {/* Actions Footer Bar */}
                  {isActive ? (
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                      <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                        <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                        <span className="truncate">Session active en production</span>
                      </div>
                      <button 
                        type="button"
                        onClick={() => setConfirmState({ year, status: 'PAST' })} 
                        disabled={actionLoading?.startsWith('status_')} 
                        className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-2xs shrink-0"
                        title="Clôturer et archiver l'année"
                      >
                        {actionLoading === 'status_' + year.id ? <Loader2 size={11} className="animate-spin text-slate-700" /> : <Bookmark size={11} />}
                        <span>{isHigherEd ? 'Archiver' : 'Clôturer'}</span>
                      </button>
                    </div>
                  ) : year.status === 'PAST' ? (
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                      <div className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
                        <Bookmark size={12} className="text-slate-400 shrink-0" />
                        <span>Session archivée (Lecture seule)</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button 
                          type="button"
                          onClick={() => setConfirmState({ year, status: 'ACTIVE' })} 
                          disabled={actionLoading?.startsWith('status_')} 
                          className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1 cursor-pointer shadow-2xs"
                        >
                          {actionLoading === 'status_' + year.id && <Loader2 size={11} className="animate-spin" />}
                          <span>Réactiver</span>
                        </button>
                        <button 
                          type="button"
                          onClick={() => setSessionToDelete(year)} 
                          className="p-1 text-rose-600 bg-rose-50/60 hover:bg-rose-100 border border-rose-200 rounded-lg transition-all active:scale-90 flex items-center justify-center cursor-pointer shadow-2xs"
                          title="Supprimer définitivement"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100">
                      <button 
                        type="button"
                        onClick={() => setConfirmState({ year, status: 'ACTIVE' })} 
                        disabled={actionLoading?.startsWith('status_')} 
                        className="px-2.5 py-1 bg-slate-900 hover:bg-black text-white rounded-lg text-xs font-bold transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5 shadow-2xs cursor-pointer"
                      >
                        {actionLoading === 'status_' + year.id ? (
                          <Loader2 size={11} className="animate-spin" />
                        ) : (
                          <Zap size={11} className="text-amber-400" />
                        )}
                        <span>{isHigherEd ? 'Lancer' : "Lancer l'année"}</span>
                      </button>

                      {year.status === 'VIERGE' && (
                        <button 
                          type="button"
                          onClick={() => setConfirmState({ year, status: 'FUTURE' })} 
                          disabled={actionLoading?.startsWith('status_')} 
                          className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 rounded-lg text-xs font-bold transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                        >
                          {actionLoading === 'status_' + year.id && <Loader2 size={11} className="animate-spin" />}
                          <span>En préparation</span>
                        </button>
                      )}

                      <button 
                        type="button"
                        onClick={() => setConfirmState({ year, status: 'PAST' })} 
                        disabled={actionLoading?.startsWith('status_')} 
                        className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                      >
                        {actionLoading === 'status_' + year.id && <Loader2 size={11} className="animate-spin text-slate-700" />}
                        <span>Archiver</span>
                      </button>

                      <button 
                        type="button"
                        onClick={() => setSessionToDelete(year)} 
                        className="p-1 text-rose-600 bg-rose-50/60 hover:bg-rose-100 border border-rose-200 rounded-lg transition-all ml-auto active:scale-90 flex items-center justify-center cursor-pointer shadow-2xs"
                        title="Supprimer définitivement"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>

      {/* MODAL 1: Principes de Passation (Cycle Classique) */}
      <Modal
        isOpen={showPassationGuide}
        onClose={() => setShowPassationGuide(false)}
        title="Principes de Passation d'Année Scolaire"
        hideIcon={true}
        hideTitle={true}
        hideDefaultActions={true}
        hideCloseButton={true}
        containerClassName="max-w-xl sm:max-w-2xl md:max-w-3xl rounded-2xl overflow-hidden shadow-2xl border border-slate-200/90 max-h-[92vh] flex flex-col"
        contentClassName="p-0 flex-1 min-h-0 flex flex-col overflow-hidden"
      >
        <div className="flex flex-col h-full overflow-hidden bg-white">
          {/* Header Banner */}
          <div className="bg-slate-900 px-4 py-3 sm:px-5 sm:py-3.5 border-b border-slate-800 text-white relative shrink-0">
            <button
              onClick={() => setShowPassationGuide(false)}
              className="absolute top-3 right-3 p-1.5 text-white/70 hover:text-white hover:bg-white/10 active:scale-95 rounded-lg transition-all z-20 cursor-pointer"
              title="Fermer le guide"
              aria-label="Fermer"
            >
              <X size={16} />
            </button>

            <div className="relative z-10 space-y-0.5 pr-8">
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-[10px] font-mono font-bold uppercase tracking-wider">
                <ShieldCheck size={12} className="text-indigo-400" />
                <span>Gouvernance Digitale • École Connectée</span>
              </div>
              <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                Principes de Passation d'Année
              </h3>
              <p className="text-slate-300 text-xs font-normal leading-snug max-w-xl">
                4 règles fondamentales pour garantir la continuité académique et sceller les registres scolaires.
              </p>
            </div>
          </div>

          {/* Body Content */}
          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-3.5 sm:p-4 space-y-2.5 bg-slate-50/75">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Card 1 */}
              <div className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-blue-50 text-blue-600 rounded-md flex items-center justify-center shrink-0 border border-blue-100">
                        <CalendarCheck size={13} />
                      </div>
                      <h5 className="text-xs font-bold text-slate-900 tracking-tight">Unicité Active</h5>
                    </div>
                    <span className="text-[9px] font-mono font-bold text-blue-700 uppercase bg-blue-50 px-1.5 py-0.2 rounded border border-blue-100">
                      Règle 01
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed font-normal">
                    <strong className="font-semibold text-slate-800">Une seule session active :</strong> L'activation de la nouvelle session archive automatiquement la précédente en lecture seule pour éviter tout conflit de saisie.
                  </p>
                </div>
                <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-blue-700 font-bold">
                  <span className="flex items-center gap-1"><CheckCircle2 size={11} className="text-blue-500" /> Continuité garantie</span>
                  <span className="text-[9px] font-mono text-slate-500">Session unique</span>
                </div>
              </div>

              {/* Card 2 */}
              <div className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-amber-50 text-amber-600 rounded-md flex items-center justify-center shrink-0 border border-amber-100">
                        <Lock size={13} />
                      </div>
                      <h5 className="text-xs font-bold text-slate-900 tracking-tight">Gel & Scellement</h5>
                    </div>
                    <span className="text-[9px] font-mono font-bold text-amber-700 uppercase bg-amber-50 px-1.5 py-0.2 rounded border border-amber-100">
                      Règle 02
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed font-normal">
                    <strong className="font-semibold text-slate-800">Données immuables :</strong> Notes, relevés, transactions et reçus de l'année écoulée sont verrouillés et restent consultables en archives sécurisées.
                  </p>
                </div>
                <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-amber-700 font-bold">
                  <span className="flex items-center gap-1"><ShieldCheck size={11} className="text-amber-500" /> Archives scellées</span>
                  <span className="text-[9px] font-mono text-slate-500">Audit permanent</span>
                </div>
              </div>

              {/* Card 3 */}
              <div className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-emerald-50 text-emerald-600 rounded-md flex items-center justify-center shrink-0 border border-emerald-100">
                        <GraduationCap size={13} />
                      </div>
                      <h5 className="text-xs font-bold text-slate-900 tracking-tight">Promotions & Niveaux</h5>
                    </div>
                    <span className="text-[9px] font-mono font-bold text-emerald-700 uppercase bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-100">
                      Règle 03
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed font-normal">
                    <strong className="font-semibold text-slate-800">Bascule de niveau :</strong> Les élèves admis sont orientés vers leur classe supérieure via le module des admissions tout en préservant leur historique.
                  </p>
                </div>
                <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-emerald-700 font-bold">
                  <span className="flex items-center gap-1"><TrendingUp size={11} className="text-emerald-500" /> Continuité d'effectif</span>
                  <span className="text-[9px] font-mono text-slate-500">Réinscription fluide</span>
                </div>
              </div>

              {/* Card 4 */}
              <div className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-indigo-50 text-indigo-600 rounded-md flex items-center justify-center shrink-0 border border-indigo-100">
                        <Receipt size={13} />
                      </div>
                      <h5 className="text-xs font-bold text-slate-900 tracking-tight">Tarifs & Scolarité</h5>
                    </div>
                    <span className="text-[9px] font-mono font-bold text-indigo-700 uppercase bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-100">
                      Règle 04
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed font-normal">
                    <strong className="font-semibold text-slate-800">Grille tarifaire :</strong> Configurez les frais d'inscription et échéanciers d'écolage sur la session en préparation avant de démarrer les encaissements.
                  </p>
                </div>
                <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-indigo-700 font-bold">
                  <span className="flex items-center gap-1"><Sparkles size={11} className="text-indigo-500" /> Écolages paramétrés</span>
                  <span className="text-[9px] font-mono text-slate-500">Finances saines</span>
                </div>
              </div>
            </div>

            {/* Tip Callout */}
            <div className="p-2.5 bg-indigo-50/80 border border-indigo-100 rounded-xl flex items-center gap-2 text-indigo-950 shadow-2xs">
              <Lightbulb size={15} className="text-indigo-600 shrink-0" />
              <p className="text-[11px] text-indigo-950 leading-snug font-medium">
                <strong className="font-bold text-indigo-900">Recommandation École Connectée :</strong> Clôturez la saisie des notes et la remise des bulletins avant d'activer officiellement la nouvelle année.
              </p>
            </div>

            {/* Confirmation Button */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowPassationGuide(false)}
                className="w-full py-2 bg-slate-900 hover:bg-black text-white rounded-lg font-bold text-xs transition-all shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
              >
                <CheckCircle2 size={14} className="text-emerald-400" />
                <span>J'ai compris les principes de passation</span>
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* MODAL 2: Archiving Quick Guide (Modal École Supérieure) */}
      <Modal
        isOpen={showArchivingGuide}
        onClose={() => setShowArchivingGuide(false)}
        title="Guide d'Archivage des Sessions"
        hideIcon={true}
        hideTitle={true}
        hideDefaultActions={true}
        hideCloseButton={true}
        containerClassName="max-w-xl sm:max-w-2xl rounded-2xl overflow-hidden shadow-2xl border border-slate-200/90 max-h-[92vh] flex flex-col"
        contentClassName="p-0 flex-1 min-h-0 flex flex-col overflow-hidden"
      >
        <div className="flex flex-col h-full overflow-hidden bg-white">
          <div className="bg-slate-900 px-4 py-3 sm:px-5 sm:py-3.5 border-b border-slate-800 text-white relative shrink-0">
            <button
              onClick={() => setShowArchivingGuide(false)}
              className="absolute top-3 right-3 p-1.5 text-white/70 hover:text-white hover:bg-white/10 active:scale-95 rounded-lg transition-all z-20 cursor-pointer"
              title="Fermer le guide"
              aria-label="Fermer"
            >
              <X size={16} />
            </button>

            <div className="relative z-10 space-y-0.5 pr-8">
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-indigo-300 text-[10px] font-mono font-bold uppercase tracking-wider">
                <Bookmark size={12} className="text-indigo-400" />
                <span>Mode Universitaire & Supérieur</span>
              </div>
              <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                Guide d'Archivage des Sessions
              </h3>
              <p className="text-slate-300 text-xs font-normal leading-snug max-w-xl">
                Fonctionnement autonome des sessions académiques et semestres universitaires.
              </p>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-3.5 sm:p-4 space-y-2.5 bg-slate-50/75">
            <div className="space-y-2">
              <div className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-2xs space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>
                    <h5 className="text-xs font-bold text-indigo-900">1. Clôture Autonome</h5>
                  </div>
                  <span className="text-[9px] font-mono font-bold text-slate-400">Indépendant</span>
                </div>
                <p className="text-xs text-slate-700 font-medium leading-relaxed pl-3">
                  Chaque session possède son propre contrôle <strong className="text-slate-900">"Archiver"</strong>. Vous l'archivez manuellement une fois ses cours et évaluations finalisés.
                </p>
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-2xs space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>
                    <h5 className="text-xs font-bold text-indigo-900">2. Indépendance des Sessions</h5>
                  </div>
                  <span className="text-[9px] font-mono font-bold text-slate-400">Multi-sessions</span>
                </div>
                <p className="text-xs text-slate-700 font-medium leading-relaxed pl-3">
                  Archiver une session d'été ou un semestre n'impacte pas les autres sessions ouvertes qui demeurent actives et opérationnelles.
                </p>
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-2xs space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>
                    <h5 className="text-xs font-bold text-indigo-900">3. Historisation Immuable</h5>
                  </div>
                  <span className="text-[9px] font-mono font-bold text-slate-400">Permanent</span>
                </div>
                <p className="text-xs text-slate-700 font-medium leading-relaxed pl-3">
                  Toutes les notes, procès-verbaux d'examen et règlements demeurent scellés et disponibles pour la génération de relevés officiels.
                </p>
              </div>
            </div>

            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowArchivingGuide(false)}
                className="w-full py-2 bg-slate-900 hover:bg-black text-white rounded-lg font-bold text-xs transition-all shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
              >
                <CheckCircle2 size={14} className="text-emerald-400" />
                <span>J'ai compris le fonctionnement</span>
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* MODAL 3: Confirm State Update (Lancer / Préparer / Archiver) */}
      <Modal 
        isOpen={confirmState !== null} 
        onClose={() => setConfirmState(null)}
        title={isHigherEd ? "Passation de Session" : "Passation d'Année Scolaire"}
        hideIcon={true}
        hideTitle={true}
        hideDefaultActions={true}
        containerClassName="max-w-lg rounded-2xl overflow-hidden shadow-2xl border border-slate-200/90"
        contentClassName="p-0"
      >
        {confirmState && (
          <div className="flex flex-col bg-white">
            <div className="bg-slate-900 px-4 py-3 sm:px-5 sm:py-3.5 text-white relative">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center text-white shrink-0">
                  {confirmState.status === 'ACTIVE' ? <Zap size={16} className="text-amber-300" /> : 
                   confirmState.status === 'PAST' ? <Bookmark size={16} className="text-indigo-300" /> : 
                   <Sparkles size={16} className="text-amber-300" />}
                </div>
                <div className="min-w-0">
                  <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400 block">
                    Gouvernance Digitale
                  </span>
                  <h4 className="text-xs sm:text-sm font-bold text-white tracking-tight truncate">
                    {confirmState.status === 'ACTIVE' 
                      ? (isHigherEd ? 'Lancer la Session Active ?' : "Activer cette Année Scolaire ?") 
                      : confirmState.status === 'PAST' 
                      ? (isHigherEd ? 'Archiver cette Session ?' : "Archiver cette Année Scolaire ?") 
                      : 'Mettre en Préparation ?'}
                  </h4>
                </div>
              </div>
            </div>

            <div className="p-3.5 sm:p-4 space-y-2.5 bg-slate-50/70">
              {/* Target Session Details */}
              <div className="p-3 bg-white border border-slate-200/90 rounded-xl shadow-2xs space-y-2">
                <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                  <div>
                    <span className="text-[9px] font-mono font-bold uppercase text-slate-400 block">
                      {isHigherEd ? "Session Ciblée" : "Année Scolaire Ciblée"}
                    </span>
                    <h5 className="text-xs sm:text-sm font-bold text-slate-900 font-mono">{confirmState.year.label}</h5>
                  </div>
                  {isHigherEd && (
                    <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold border uppercase ${getSessionTypeBadge(confirmState.year.session_type).classes}`}>
                      {getSessionTypeBadge(confirmState.year.session_type).label}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-semibold text-slate-700">
                  {(() => {
                    const confirmRange = formatAcademicDateRange(confirmState.year.start_date, confirmState.year.end_date);
                    return (
                      <>
                        <div className="space-y-0.5">
                          <span className="text-slate-400 text-[9px] font-mono font-bold uppercase block">
                            Date d'ouverture (Début) :
                          </span>
                          <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-slate-50 text-slate-800 rounded-md border border-slate-200 font-bold text-xs shadow-2xs">
                            <Calendar size={11} className="text-indigo-600 shrink-0" />
                            <span>{confirmRange.startText}</span>
                          </div>
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-slate-400 text-[9px] font-mono font-bold uppercase block">
                            Date de clôture (Fin) :
                          </span>
                          <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-slate-50 text-slate-800 rounded-md border border-slate-200 font-bold text-xs shadow-2xs">
                            <Calendar size={11} className="text-indigo-600 shrink-0" />
                            <span>{confirmRange.endText}</span>
                            {confirmRange.duration && (
                              <span className="text-[9px] font-mono font-bold uppercase px-1 py-0.2 bg-white text-indigo-700 rounded border border-indigo-100 ml-1">
                                {confirmRange.duration}
                              </span>
                            )}
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Consequences */}
              <div className="p-2.5 bg-white border border-slate-200/90 rounded-xl space-y-1 shadow-2xs">
                <div className="flex items-center gap-1.5 text-slate-900 font-bold text-xs">
                  <ShieldCheck size={13} className="text-indigo-600" />
                  <span>Conséquences de l'opération :</span>
                </div>

                <p className="text-[11px] text-slate-600 font-normal leading-relaxed">
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

              {/* Actions */}
              <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2 pt-1">
                <button 
                  type="button"
                  onClick={() => setConfirmState(null)}
                  disabled={actionLoading !== null}
                  className="w-full sm:w-auto px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold transition-all border border-slate-200 cursor-pointer"
                >
                  Annuler
                </button>

                <button 
                  type="button"
                  onClick={() => handleUpdateStatus(confirmState.year.id, confirmState.status)}
                  disabled={actionLoading !== null}
                  className="w-full sm:w-auto px-4 py-1.5 rounded-lg text-xs font-bold text-white transition-all active:scale-95 disabled:opacity-50 shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer bg-slate-900 hover:bg-black"
                >
                  {actionLoading !== null ? <Loader2 size={13} className="animate-spin text-emerald-400" /> : <CheckCircle2 size={13} className="text-emerald-400" />}
                  <span>
                    {confirmState.status === 'ACTIVE' ? (isHigherEd ? 'Confirmer et Lancer' : "Confirmer et Activer") : 
                     confirmState.status === 'PAST' ? (isHigherEd ? 'Archiver la Session' : "Archiver l'Année Scolaire") : 'Confirmer la Préparation'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL 4: Delete Confirmation */}
      <Modal 
        isOpen={sessionToDelete !== null} 
        onClose={() => setSessionToDelete(null)}
        title="Suppression Définitive"
        hideIcon={true}
        hideTitle={true}
        hideDefaultActions={true}
        containerClassName="max-w-lg rounded-2xl overflow-hidden shadow-2xl border border-slate-200/90"
        contentClassName="p-0"
      >
        {sessionToDelete && (
          <div className="flex flex-col bg-white">
            <div className="bg-rose-700 px-4 py-3 sm:px-5 sm:py-3.5 text-white relative">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center text-white shrink-0">
                  <Trash2 size={16} className="text-rose-100" />
                </div>
                <div>
                  <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-rose-200 block">
                    Zone Critique
                  </span>
                  <h4 className="text-xs sm:text-sm font-bold text-white tracking-tight">
                    {isHigherEd ? 'Supprimer la Session ?' : "Supprimer l'Année Scolaire ?"}
                  </h4>
                </div>
              </div>
            </div>

            <div className="p-3.5 sm:p-4 space-y-2.5 bg-slate-50/70">
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-800 leading-relaxed">
                  Vous êtes sur le point de supprimer définitivement {isHigherEd ? 'la session' : "l'année scolaire"} <strong className="text-slate-950 font-bold font-mono">{sessionToDelete.label}</strong>.
                </p>

                {(() => {
                  const delRange = formatAcademicDateRange(sessionToDelete.start_date, sessionToDelete.end_date);
                  if (delRange.hasDates) {
                    return (
                      <div className="inline-flex flex-wrap items-center gap-1.5 px-2.5 py-1 bg-white rounded-md border border-slate-200 text-slate-700 text-xs font-semibold shadow-2xs">
                        <Calendar size={11} className="text-rose-500 shrink-0" />
                        <span>{delRange.startText}</span>
                        <ArrowRight size={10} className="text-slate-400 shrink-0" />
                        <span>{delRange.endText}</span>
                        {delRange.duration && (
                          <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.2 bg-slate-100 text-slate-700 rounded border border-slate-200">
                            {delRange.duration}
                          </span>
                        )}
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs font-medium text-rose-950 space-y-1 shadow-2xs">
                <span className="font-bold uppercase tracking-wider text-rose-900 block text-[10px] font-mono">⚠️ Action Irréversible</span>
                <p className="text-[11px] leading-snug">Cette opération supprimera irrévocablement :</p>
                <ul className="list-disc list-inside space-y-0.5 font-semibold text-rose-800 text-[11px]">
                  <li>Toutes les inscriptions enregistrées sur cette session/année</li>
                  <li>Toutes les grilles tarifaires et paiements associés</li>
                  <li>Les bulletins de notes et historiques de présence</li>
                </ul>
              </div>

              <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2 pt-1">
                <button 
                  type="button"
                  onClick={() => setSessionToDelete(null)}
                  disabled={isDeleting}
                  className="w-full sm:w-auto px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold transition-all border border-slate-200 cursor-pointer"
                >
                  Annuler
                </button>

                <button 
                  type="button"
                  onClick={handleDeleteYear}
                  disabled={isDeleting}
                  className="w-full sm:w-auto px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-all active:scale-95 disabled:opacity-50 shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isDeleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  <span>Oui, Supprimer Définitivement</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
}
