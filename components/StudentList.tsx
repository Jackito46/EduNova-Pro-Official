import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Search, Edit2, Trash2, Sparkles, User, Users, 
  Search as SearchIcon, Printer, ChevronLeft, ChevronRight,
  X, Loader2, RefreshCw, AlertCircle, UserPlus, GraduationCap,
  Layers, CheckCircle2, Eye, Ban, Info, FileCheck, FileCheck2,
  Clock, XCircle, FileWarning, Filter
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../supabase';
import { geminiService } from '../services/geminiService';
import { UserProfile, SchoolLevel, UserRole } from '../types';
import { useSchool } from '../contexts/SchoolContext';
import Modal from './Modal';
import { AuditLogger } from '../utils/auditLogger';
import { formatStudentName } from '../utils/formatters';
import { RetryableError } from './RetryableError';
import { getStudentAgeStatus } from '../utils/academicPath';
import { ModernRegistrySkeleton, SkeletonTable, FluidLoadingState } from './SkeletonLoader';
import StudentDocumentStatusModal from './StudentDocumentStatusModal';
import { AcademicSessionPill } from './AcademicSessionPill';
import { 
  getDocumentDefinitionsForSchoolType, 
  normalizeStudentDocuments, 
  calculateDocumentsCompleteness 
} from '../utils/documentRequirements';

const StudentList: React.FC<{ user: UserProfile }> = ({ user }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { terminology, school, currentCampusId, campuses } = useSchool();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCycle, setActiveCycle] = useState<string>('ALL');
  const [selectedClassId, setSelectedClassId] = useState('all');
  const [students, setStudents] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [aiReport, setAiReport] = useState<{id: string, text: string} | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  const [deleteCandidate, setDeleteCandidate] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [quickViewStudent, setQuickViewStudent] = useState<any | null>(null);
  const [quickViewIndex, setQuickViewIndex] = useState(-1);

  const [closeCandidate, setCloseCandidate] = useState<any | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closeReason, setCloseReason] = useState('');

  // Document state and filters
  const [docFilter, setDocFilter] = useState<'ALL' | 'COMPLETE' | 'INCOMPLETE' | 'REJECTED'>('ALL');
  const [docModalStudent, setDocModalStudent] = useState<any | null>(null);
  const [showDocModal, setShowDocModal] = useState(false);

  const fetchInitialData = useCallback(async () => {
    if (!user?.school_id) return;
    setLoading(true);
    setError(null);
    try {
      let ayQuery = supabase.from('academic_years').select('*');
      if (user?.school_id) {
        ayQuery = ayQuery.or(`school_id.eq.${user.school_id},school_id.is.null`);
      }
      const { data: years } = await ayQuery.order('label', { ascending: false });

      let finalYears = years || [];
      if (finalYears.length === 0) {
        finalYears = [
          { id: 'ay-2025-2026', label: '2025-2026', status: 'ACTIVE', is_active: true },
          { id: 'ay-2024-2025', label: '2024-2025', status: 'PAST', is_active: false },
        ];
      }

      const filtered = finalYears.filter(y => y.status === 'ACTIVE' || y.status === 'FUTURE' || y.is_active);
      const activeYears = filtered.length > 0 ? filtered : finalYears;
      setAcademicYears(activeYears);
      
      const locationState = location.state as { academicYearId?: string; filterYearId?: string } | null;
      const incomingYearId = locationState?.academicYearId || locationState?.filterYearId;
      const targetYear = incomingYearId 
        ? activeYears.find(y => y.id === incomingYearId) || activeYears.find(y => y.status === 'ACTIVE' || y.is_active) || activeYears[0]
        : activeYears.find(y => y.status === 'ACTIVE' || y.is_active) || activeYears[0];

      if (targetYear) setSelectedYearId(targetYear.id);

      let classQuery = supabase.from('classes').select('*');
      if (user?.school_id) {
        classQuery = classQuery.or(`school_id.eq.${user.school_id},school_id.is.null`);
      }
        
      if (currentCampusId) {
        classQuery = classQuery.eq('campus_id', currentCampusId);
      }
      
      const { data: classData } = await classQuery.order('name');
      if (classData) setClasses(classData);
    } catch (err: any) {
      console.warn("Notice loading initial student list filters:", err);
    } finally {
      setLoading(false);
    }
  }, [user.school_id, currentCampusId]);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      let studentIdsForYear: string[] | null = null;
      const isYearFiltered = selectedYearId && selectedYearId !== 'all';

      if (isYearFiltered) {
        let enrollQuery = supabase
          .from('enrollments')
          .select('student_id, academic_year_id, status, class_id')
          .eq('academic_year_id', selectedYearId);

        if (user?.school_id) {
          enrollQuery = enrollQuery.or(`school_id.eq.${user.school_id},school_id.is.null`);
        }

        const { data: enrollData } = await enrollQuery;
        if (enrollData && enrollData.length > 0) {
          studentIdsForYear = enrollData.map((e: any) => e.student_id).filter(Boolean);
        } else {
          // No students are enrolled in this academic year yet
          studentIdsForYear = [];
        }
      }

      // If a specific session is selected and there are 0 enrollments for it, display empty list immediately
      if (isYearFiltered && studentIdsForYear && studentIdsForYear.length === 0) {
        setStudents([]);
        setLoading(false);
        return;
      }

      let stQuery = supabase
        .from('students')
        .select('*, class:classes(id, name, level)')
        .order('last_name');

      if (user?.school_id) {
        stQuery = stQuery.or(`school_id.eq.${user.school_id},school_id.is.null`);
      }

      if (currentCampusId) {
        stQuery = stQuery.eq('campus_id', currentCampusId);
      }

      if (studentIdsForYear && studentIdsForYear.length > 0) {
        stQuery = stQuery.in('id', studentIdsForYear);
      }

      let { data: studentsData, error: studentError } = await stQuery;

      if (studentError || !studentsData) {
        if (isYearFiltered && studentIdsForYear && studentIdsForYear.length === 0) {
          studentsData = [];
        } else {
          const { data: fallbackStudents } = await supabase
            .from('students')
            .select('*, class:classes(id, name, level)')
            .order('last_name');
          studentsData = fallbackStudents || [];
        }
      }

      if (studentsData && studentsData.length > 0) {
        let enrollQuery = supabase.from('enrollments').select('student_id, academic_year_id, status, class_id');
        if (user?.school_id) {
          enrollQuery = enrollQuery.or(`school_id.eq.${user.school_id},school_id.is.null`);
        }
        const { data: allEnrollments } = await enrollQuery;

        const enrollmentMap = new Map<string, string[]>();
        const statusMap = new Map<string, string>();
        allEnrollments?.forEach(e => {
          const list = enrollmentMap.get(e.student_id) || [];
          list.push(e.academic_year_id);
          enrollmentMap.set(e.student_id, list);
          if (isYearFiltered && e.academic_year_id === selectedYearId) {
            statusMap.set(e.student_id, e.status);
          }
        });

        // Check if selected session is in preparation (FUTURE)
        const currentSelectedYear = academicYears.find(y => y.id === selectedYearId);
        const isFutureSession = currentSelectedYear?.status === 'FUTURE';

        const enrichedStudents = studentsData.map(s => {
          const history = enrollmentMap.get(s.id) || [];
          
          // An enrolled student is returning ("Réinscrit") if they were already enrolled in another session
          const isReturning = isYearFiltered
            ? history.length > 1 && history.includes(selectedYearId)
            : history.length > 1;
          
          let age = null;
          let ageStatus = 'NORMAL';
          if (s.dob) {
            const birthDate = new Date(s.dob);
            const refDate = new Date(new Date().getFullYear(), 8, 1);
            age = refDate.getFullYear() - birthDate.getFullYear();
            const m = refDate.getMonth() - birthDate.getMonth();
            if (m < 0 || (m === 0 && refDate.getDate() < birthDate.getDate())) {
              age--;
            }
            if (s.class) {
              ageStatus = getStudentAgeStatus(age, s.class.name, s.class.level);
            }
          }

          const targetStatus = statusMap.get(s.id) || s.status || 'ACTIVE';

          const normalizedDocs = normalizeStudentDocuments(s.submitted_documents, school?.school_type, school?.global_settings);
          const completeness = calculateDocumentsCompleteness(normalizedDocs, school?.school_type, school?.global_settings);

          let displayEnrollmentType = isReturning ? 'Réinscrit' : 'Inscrit';
          if (isFutureSession) {
            displayEnrollmentType = isReturning ? 'Réinscrit (Pré-ins)' : 'Pré-inscrit';
          }

          return {
            ...s,
            age,
            ageStatus,
            enrollmentType: displayEnrollmentType,
            enrollmentStatus: targetStatus,
            normalizedDocs,
            completeness
          };
        });

        setStudents(enrichedStudents);
      } else {
        setStudents([]);
      }
    } catch (err: any) {
      console.warn("Notice fetching students:", err);
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, [user?.school_id, selectedYearId, currentCampusId, academicYears, school?.school_type, school?.global_settings]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  useEffect(() => {
    const locationState = location.state as { academicYearId?: string; filterYearId?: string } | null;
    const incomingYearId = locationState?.academicYearId || locationState?.filterYearId;
    if (incomingYearId && incomingYearId !== selectedYearId) {
      setSelectedYearId(incomingYearId);
    }
  }, [location.state, selectedYearId]);

  const handleDelete = async () => {
    if (!deleteCandidate) return;
    const isAuthorized = user.role === UserRole.SUPER_ADMIN || user.role === UserRole.SCHOOL_ADMIN || user.role === UserRole.DIRECTOR;
    if (!isAuthorized) {
      toast.error("Vous n'avez pas l'autorisation d'effectuer cette suppression.");
      return;
    }
    setIsDeleting(true);
    try {
      const { error: delError } = await supabase
        .from('students')
        .delete()
        .eq('id', deleteCandidate.id);
      
      if (delError) throw delError;

      AuditLogger.log({
        school_id: user.school_id,
        user_id: user.id,
        action: 'DELETE',
        entity_type: 'student',
        entity_id: deleteCandidate.id,
        details: { name: formatStudentName(deleteCandidate.last_name, deleteCandidate.first_name).fullName, class_id: deleteCandidate.class_id }
      });

      setStudents(prev => prev.filter(s => s.id !== deleteCandidate.id));
      setDeleteCandidate(null);
      toast.success(`${terminology.student} supprimé avec succès.`);
    } catch (err: any) {
      toast.error("Erreur de suppression : " + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCloseDossier = async () => {
    if (!closeCandidate) return;
    const isAuthorized = user.role === UserRole.SUPER_ADMIN || user.role === UserRole.SCHOOL_ADMIN || user.role === UserRole.DIRECTOR;
    if (!isAuthorized) {
      toast.error("Vous n'avez pas l'autorisation de fermer ce dossier.");
      return;
    }
    setIsClosing(true);
    try {
      const { error: updateError } = await supabase
        .from('students')
        .update({ 
          status: 'Inactif',
          notes: (closeCandidate.notes || '') + `\n[Dossier Clos le ${new Date().toLocaleDateString()} par ${user.full_name}. Raison: ${closeReason}]`
        })
        .eq('id', closeCandidate.id);
      
      if (updateError) throw updateError;

      AuditLogger.log({
        school_id: user.school_id,
        user_id: user.id,
        action: 'UPDATE',
        entity_type: 'student',
        entity_id: closeCandidate.id,
        details: { type: 'close_dossier', reason: closeReason }
      });

      setStudents(prev => prev.map(s => s.id === closeCandidate.id ? { ...s, status: 'Inactif' } : s));
      toast.success("Dossier clos avec succès.");
      setShowCloseModal(false);
      setCloseCandidate(null);
      setCloseReason('');
    } catch (err: any) {
      toast.error("Erreur lors de la fermeture du dossier : " + err.message);
    } finally {
      setIsClosing(false);
    }
  };

  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const matchesSearch = `${formatStudentName(s.last_name, s.first_name).fullName} ${s.id}`.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCycle = activeCycle === 'ALL' || s.class?.level === activeCycle;
      const matchesClass = selectedClassId === 'all' || s.class_id === selectedClassId;
      
      let matchesDoc = true;
      if (docFilter === 'COMPLETE') {
        matchesDoc = !!s.completeness?.isComplete;
      } else if (docFilter === 'INCOMPLETE') {
        matchesDoc = !s.completeness?.isComplete && !s.completeness?.hasRejection;
      } else if (docFilter === 'REJECTED') {
        matchesDoc = !!s.completeness?.hasRejection;
      }

      return matchesSearch && matchesCycle && matchesClass && matchesDoc;
    });
  }, [searchTerm, activeCycle, selectedClassId, docFilter, students]);

  const classesForCycle = useMemo(() => {
    let baseClasses = classes;
    if (activeCycle !== 'ALL') {
      baseClasses = classes.filter(c => c.level === activeCycle);
    }
    
    // Filtering to show only disciplines that have students enrolled in them
    const classIdsWithStudents = new Set(students.map(s => s.class_id));
    return baseClasses.filter(c => classIdsWithStudents.has(c.id));
  }, [activeCycle, classes, students]);

  const stats = useMemo(() => {
    const total = students.length;
    const boys = students.filter(s => s.gender === 'Masculin').length;
    const girls = students.filter(s => s.gender === 'Féminin').length;
    const completeDocs = students.filter(s => s.completeness?.isComplete).length;
    const incompleteDocs = students.filter(s => !s.completeness?.isComplete && !s.completeness?.hasRejection).length;
    const rejectedDocs = students.filter(s => s.completeness?.hasRejection).length;
    return { total, boys, girls, completeDocs, incompleteDocs, rejectedDocs };
  }, [students]);

  const currentStudents = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredStudents.slice(start, start + itemsPerPage);
  }, [filteredStudents, currentPage]);

  const handleNextQuickView = () => {
    if (quickViewIndex < filteredStudents.length - 1) {
      const nextIndex = quickViewIndex + 1;
      setQuickViewIndex(nextIndex);
      setQuickViewStudent(filteredStudents[nextIndex]);
    }
  };

  const handlePrevQuickView = () => {
    if (quickViewIndex > 0) {
      const prevIndex = quickViewIndex - 1;
      setQuickViewIndex(prevIndex);
      setQuickViewStudent(filteredStudents[prevIndex]);
    }
  };

  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage) || 1;

  if (error) {
    return (
      <div className="p-8">
        <RetryableError 
          message={error} 
          onRetry={() => {
            fetchInitialData();
            fetchStudents();
          }} 
        />
      </div>
    );
  }

  if (error && students.length === 0) {
    return (
      <div className="flex h-[60vh] items-center justify-center p-6">
        <RetryableError 
          message={error} 
          onRetry={() => { fetchInitialData(); fetchStudents(); }}
          className="max-w-md w-full"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-24 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-xs border border-slate-100/90">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-xs shrink-0">
            <Users size={24} />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">Registre des {terminology.students}</h2>
            <div className="flex items-center gap-2 sm:gap-2.5 mt-1.5 flex-wrap">
              <button 
                type="button"
                onClick={() => { setDocFilter('ALL'); setCurrentPage(1); }}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  docFilter === 'ALL' ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Users size={13} /> {stats.total} Total
              </button>

              {/* Le bouton Dossiers Incomplets ne s'affiche UNIQUEMENT s'il y a des dossiers nécessitant une régularisation */}
              {stats.incompleteDocs > 0 && (
                <button 
                  type="button"
                  onClick={() => { setDocFilter(docFilter === 'INCOMPLETE' ? 'ALL' : 'INCOMPLETE'); setCurrentPage(1); }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    docFilter === 'INCOMPLETE' ? 'bg-amber-500 text-white shadow-xs' : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200/80'
                  }`}
                  title={`Filtrer uniquement les ${terminology.students.toLowerCase()} avec pièces justificatives manquantes`}
                >
                  <Clock size={13} /> {stats.incompleteDocs} Dossiers Incomplets
                </button>
              )}

              {stats.rejectedDocs > 0 && (
                <button 
                  type="button"
                  onClick={() => { setDocFilter(docFilter === 'REJECTED' ? 'ALL' : 'REJECTED'); setCurrentPage(1); }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    docFilter === 'REJECTED' ? 'bg-rose-600 text-white shadow-xs' : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200/80'
                  }`}
                  title="Filtrer les dossiers ayant des pièces rejetées"
                >
                  <XCircle size={13} /> {stats.rejectedDocs} Rejetée(s)
                </button>
              )}
            </div>
          </div>
        </div>
        {(user.role === UserRole.SUPER_ADMIN || user.role === UserRole.SCHOOL_ADMIN || user.role === UserRole.DIRECTOR || user.role === UserRole.SECRETARY) && (
          <button 
            onClick={() => navigate('/eleves/ajouter')} 
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2.5 rounded-2xl shadow-xs transition-all flex items-center gap-2 text-xs shrink-0 self-stretch sm:self-auto justify-center cursor-pointer"
          >
            <UserPlus size={16} /> {terminology.enrollment} Administrative
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-xl flex items-center gap-3">
          <AlertCircle size={24} className="text-red-500" />
          <div>
            <h3 className="font-semibold">Erreur de communication avec la base de données</h3>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-3xl shadow-xs border border-slate-100/90 overflow-hidden">
        {/* Onglets Cycles / Formations */}
        <div className="flex border-b border-slate-100 overflow-x-auto custom-scrollbar bg-slate-50/40">
          {(school?.school_type === 'UNIVERSITY' ? [
            { id: 'ALL', label: 'Toutes les disciplines', icon: Layers },
            { id: 'DIPLOME', label: 'Diplôme', icon: GraduationCap },
            { id: 'LICENCE', label: 'Licence', icon: GraduationCap },
            { id: 'MASTER', label: 'Master', icon: GraduationCap }
          ] : school?.school_type === 'PROFESSIONAL' ? [
            { id: 'ALL', label: 'Toutes les formations', icon: Layers },
            { id: 'CERTIFICAT', label: 'Certificat', icon: GraduationCap },
            { id: 'DIPLOME', label: 'Diplôme', icon: GraduationCap }
          ] : [
            { id: 'ALL', label: `Toutes les ${terminology.class.toLowerCase()}s`, icon: Layers },
            { id: 'MATERNELLE', label: 'Maternelle', icon: GraduationCap },
            { id: 'FONDAMENTALE', label: 'Fondamentale', icon: GraduationCap },
            { id: 'SECONDAIRE', label: 'Secondaire', icon: GraduationCap }
          ]).map(cycle => (
            <button 
              key={cycle.id}
              onClick={() => { setActiveCycle(cycle.id); setSelectedClassId('all'); setCurrentPage(1); }}
              className={`flex items-center gap-2 px-5 py-3.5 text-xs font-bold transition-all border-b-2 whitespace-nowrap cursor-pointer ${
                activeCycle === cycle.id 
                  ? 'border-blue-600 text-blue-600 bg-white shadow-2xs' 
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/60'
              }`}
            >
              <cycle.icon size={15} />
              {cycle.label}
            </button>
          ))}
        </div>

        {/* Barre de Recherche & Outils Principaux (Adaptative pour 14 pouces, PC, Tablettes & Mobiles) */}
        <div className="p-4 sm:p-5 space-y-3.5 bg-white">
          {/* Rangée 1 : Recherche spacieuse + Bouton Pré-inscriptions + Rafraîchissement */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex-1 min-w-[240px] relative">
              <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
              <input 
                type="text" 
                placeholder={`Rechercher un ${terminology.student.toLowerCase()} par nom, prénom ou matricule...`} 
                className="w-full pl-10 pr-10 py-2.5 bg-slate-50/60 hover:bg-slate-50 focus:bg-white border border-slate-200/80 rounded-2xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all shadow-2xs"
                value={searchTerm}
                onChange={(e) => {setSearchTerm(e.target.value); setCurrentPage(1);}}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => { setSearchTerm(''); setCurrentPage(1); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200/60 transition-colors"
                  title="Effacer la recherche"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2.5 shrink-0 flex-wrap sm:flex-nowrap">
              {academicYears.some(y => y.status === 'FUTURE') && (
                <button 
                  onClick={() => {
                    const future = academicYears.find(y => y.status === 'FUTURE');
                    const active = academicYears.find(y => y.status === 'ACTIVE' || y.is_active);
                    if (selectedYearId === future?.id) {
                      if (active) setSelectedYearId(active.id);
                      else setSelectedYearId('all');
                    } else if (future) {
                      setSelectedYearId(future.id);
                    }
                    setCurrentPage(1);
                  }}
                  className={`px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap shadow-2xs cursor-pointer ${
                    academicYears.find(y => y.id === selectedYearId)?.status === 'FUTURE'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 ring-2 ring-indigo-300'
                      : 'bg-indigo-50/80 border border-indigo-200/70 text-indigo-700 hover:bg-indigo-100/80'
                  }`}
                  title="Filtrer ou basculer sur les dossiers de pré-inscriptions"
                >
                  <Sparkles size={14} className={academicYears.find(y => y.id === selectedYearId)?.status === 'FUTURE' ? 'text-amber-300 animate-pulse' : 'text-indigo-600'} />
                  <span>Pré-inscriptions ({academicYears.find(y => y.status === 'FUTURE')?.label})</span>
                </button>
              )}

              <button 
                onClick={fetchInitialData} 
                className="p-2.5 bg-slate-50 hover:bg-blue-50 text-slate-500 hover:text-blue-600 rounded-2xl transition-colors border border-slate-200/80 shrink-0 shadow-2xs cursor-pointer" 
                title="Rafraîchir les données"
              >
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* Rangée 2 : Filtres Session & Classe / Option + Compteur et Réinitialisation */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Sélecteur de Session Interactif et Fluide */}
              <AcademicSessionPill 
                academicYears={academicYears}
                selectedYearId={selectedYearId}
                onSelectYear={(yearId) => {
                  setSelectedYearId(yearId);
                  setCurrentPage(1);
                }}
                allowAll={true}
                allLabel="Toutes les sessions"
                size="sm"
                colorScheme="indigo"
                dropdownAlign="left"
              />

              {/* Sélecteur de Classe / Option */}
              <div className="flex items-center gap-2 bg-slate-50/70 hover:bg-slate-50 border border-slate-200/80 rounded-2xl px-3 py-1.5 shadow-2xs">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 whitespace-nowrap">{terminology.option} :</span>
                <select 
                  className="bg-transparent text-slate-800 text-xs font-bold focus:outline-none cursor-pointer pr-1 max-w-[200px] truncate"
                  value={selectedClassId}
                  onChange={(e) => {setSelectedClassId(e.target.value); setCurrentPage(1);}}
                >
                  <option value="all">Toutes ({activeCycle === 'ALL' ? 'Total' : activeCycle})</option>
                  {classesForCycle.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {/* Bouton Réinitialiser si un filtre est actif */}
              {(searchTerm || selectedClassId !== 'all' || docFilter !== 'ALL' || activeCycle !== 'ALL' || (academicYears.find(y => y.status === 'ACTIVE') && selectedYearId !== academicYears.find(y => y.status === 'ACTIVE')?.id)) && (
                <button 
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setActiveCycle('ALL');
                    setSelectedClassId('all');
                    setDocFilter('ALL');
                    const active = academicYears.find(y => y.status === 'ACTIVE' || y.is_active);
                    if (active) setSelectedYearId(active.id);
                    setCurrentPage(1);
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-2xl border border-rose-200/70 transition-all cursor-pointer shadow-2xs"
                  title="Réinitialiser tous les filtres"
                >
                  <X size={12} />
                  <span>Réinitialiser</span>
                </button>
              )}
            </div>

            {/* Compteur d'affichage */}
            <div className="text-[11px] font-bold text-slate-400 ml-auto">
              <span className="text-slate-700">{filteredStudents.length}</span> sur {students.length} {terminology.students.toLowerCase()}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-xs border border-slate-100/90 overflow-hidden min-h-[500px]">
        {loading && students.length === 0 ? (
          <div className="py-8">
            <FluidLoadingState 
              message={`Chargement du Registre des ${terminology.students}...`} 
              subtext="Récupération fluide des dossiers académiques et inscriptions..." 
            />
            <SkeletonTable rows={6} />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left min-w-[750px]">
            <thead>
              <tr className="bg-slate-900 text-white text-xs font-black uppercase tracking-wider border-b border-slate-800">
                <th scope="col" className="px-6 py-4">NOM & PRÉNOM</th>
                <th scope="col" className="px-6 py-4">Type</th>
                <th scope="col" className="px-6 py-4">{terminology.option} & Niveau</th>
                <th scope="col" className="px-6 py-4">Solvabilité</th>
                <th scope="col" className="px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8">
                    <SkeletonTable rows={5} />
                  </td>
                </tr>
              ) : currentStudents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-24 text-center space-y-4">
                    <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto text-slate-400 border border-slate-100">
                      <Search size={30} />
                    </div>
                    <div>
                      <p className="text-slate-600 font-bold text-sm">
                        {searchTerm 
                          ? `Aucun ${terminology.student.toLowerCase()} trouvé pour "${searchTerm}"`
                          : docFilter === 'INCOMPLETE'
                          ? `Aucun ${terminology.student.toLowerCase()} avec pièces manquantes trouvé`
                          : docFilter === 'REJECTED'
                          ? `Aucun dossier avec pièces rejetées trouvé`
                          : academicYears.find(y => y.id === selectedYearId)?.status === 'FUTURE'
                          ? `Aucun ${terminology.student.toLowerCase()} pré-inscrit pour cette session en préparation.`
                          : `Aucun ${terminology.student.toLowerCase()} inscrit pour la session sélectionnée.`}
                      </p>
                      <div className="flex flex-wrap items-center justify-center gap-3 mt-3">
                        <button 
                          onClick={() => {setSearchTerm(''); setActiveCycle('ALL'); setSelectedClassId('all'); setDocFilter('ALL'); setSelectedYearId('all');}} 
                          className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl border border-indigo-200/60 transition-all cursor-pointer shadow-2xs"
                        >
                          Afficher toutes les sessions
                        </button>
                        {(searchTerm || selectedClassId !== 'all' || docFilter !== 'ALL' || activeCycle !== 'ALL') && (
                          <button 
                            onClick={() => {setSearchTerm(''); setActiveCycle('ALL'); setSelectedClassId('all'); setDocFilter('ALL');}} 
                            className="text-slate-500 hover:text-slate-700 text-xs font-bold hover:underline transition-all cursor-pointer"
                          >
                            Réinitialiser les filtres
                          </button>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : currentStudents.map((student) => (
                <tr key={student.id} className="group hover:bg-slate-50/70 transition-colors duration-200">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3.5">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-xs shrink-0 shadow-2xs ${student.gender === 'Masculin' ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'bg-rose-50 text-rose-700 border border-rose-100'}`}>
                        {student.last_name?.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <button 
                          onClick={() => navigate(`/eleves/detail/${student.id}`)}
                          className="font-bold text-slate-900 text-sm truncate block hover:text-blue-600 transition-colors text-left cursor-pointer"
                        >
                          {formatStudentName(student.last_name, student.first_name).fullName}
                        </button>
                        <span className="text-[11px] font-medium text-slate-400 mt-0.5 block">Matricule: {student.reference_number || student.id.substring(0, 8)}</span>
                        
                        {/* Mention affichée uniquement en cas de rejet d'une pièce ou lorsque le filtre Dossiers Incomplets est activé */}
                        {student.completeness?.hasRejection ? (
                          <button
                            type="button"
                            onClick={() => {
                              setDocModalStudent(student);
                              setShowDocModal(true);
                            }}
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-200/80 hover:bg-rose-100 transition-colors mt-1 cursor-pointer"
                            title="Pièce justificative rejetée. Cliquez pour voir et corriger."
                          >
                            <XCircle size={11} className="text-rose-600" />
                            <span>{student.completeness.rejectedCount} pièce(s) rejetée(s)</span>
                          </button>
                        ) : (docFilter === 'INCOMPLETE' && !student.completeness?.isComplete) ? (
                          <button
                            type="button"
                            onClick={() => {
                              setDocModalStudent(student);
                              setShowDocModal(true);
                            }}
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200/80 hover:bg-amber-100 transition-colors mt-1 cursor-pointer"
                            title="Dossier incomplet. Cliquez pour mettre à jour les pièces."
                          >
                            <Clock size={11} className="text-amber-600" />
                            <span>Dossier incomplet ({student.completeness?.validatedCount || 0}/{student.completeness?.total || 0})</span>
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-xl text-[10px] font-bold tracking-wider border ${
                        student.enrollmentType === 'Pré-inscrit'
                          ? 'bg-sky-50 text-sky-700 border-sky-200'
                          : student.enrollmentType === 'Inscrit' 
                          ? 'bg-blue-50 text-blue-700 border-blue-200' 
                          : student.enrollmentType === 'Réinscrit (Pré-ins)'
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                          : 'bg-purple-50 text-purple-700 border-purple-200'
                      }`}>
                        {student.enrollmentType}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">{student.class?.name || 'Non assigné'}</span>
                        {terminology.student !== 'Élève' && student.ageStatus === 'LATE' && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[9px] font-bold uppercase tracking-tight" title={`${terminology.student} en retard pour son âge`}>Retardataire</span>
                        )}
                        {terminology.student !== 'Élève' && student.ageStatus === 'CRITICAL' && (
                          <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 text-[9px] font-bold uppercase tracking-tight" title="Âge critique pour cette option">Hors Plage</span>
                        )}
                      </div>
                      <p className="text-[11px] font-medium text-slate-400">{student.class?.level} {terminology.student !== 'Élève' && student.age !== null && `• ${student.age} ans`}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {(student.status === 'Actif' || student.status === 'ACTIF') ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        À jour
                      </span>
                    ) : (student.status === 'PENDING_VALIDATION' || student.status === 'En attente' || student.status === 'EN_ATTENTE' || student.enrollmentStatus === 'PENDING_VALIDATION') ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        Attente Validation
                      </span>
                    ) : student.enrollmentStatus === 'WAITING_PAYMENT' ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        Attente Paiement
                      </span>
                    ) : (
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-bold border ${
                        student.status === 'Reliquat' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        student.status === 'Rejeté' || student.status === 'REJETE' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                        'bg-slate-50 text-slate-700 border-slate-200'
                      }`}>
                        {student.status}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-1.5">
                      <button 
                        onClick={() => {
                          const index = filteredStudents.findIndex(s => s.id === student.id);
                          setQuickViewIndex(index);
                          setQuickViewStudent(student);
                        }}
                        className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors cursor-pointer"
                        title="Aperçu rapide"
                      >
                        <Search size={16} />
                      </button>
                      <button 
                        onClick={() => navigate(`/eleves/detail/${student.id}`)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-colors cursor-pointer"
                        title="Consulter le dossier"
                        aria-label={`Consulter ${formatStudentName(student.last_name, student.first_name).fullName}`}
                      >
                        <Eye size={16} />
                      </button>
                      {(user.role === UserRole.SUPER_ADMIN || user.role === UserRole.SCHOOL_ADMIN || user.role === UserRole.DIRECTOR) && (
                        <>
                          <button 
                            onClick={() => {
                              setCloseCandidate(student);
                              setShowCloseModal(true);
                            }}
                            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                            title="Fermer le dossier"
                          >
                            <Ban size={16} />
                          </button>
                          <button 
                            onClick={() => setDeleteCandidate(student)}
                            className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                            title="Supprimer"
                            aria-label={`Supprimer ${formatStudentName(student.last_name, student.first_name).fullName}`}
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-4 bg-slate-50/60 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-xs font-bold text-slate-400">Page <span className="text-slate-700">{currentPage}</span> sur <span className="text-slate-700">{totalPages}</span></p>
          <div className="flex items-center gap-2">
            <button disabled={currentPage === 1} onClick={() => setCurrentPage(prev => prev - 1)} className="p-2 bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-slate-900 disabled:opacity-40 transition-colors shadow-2xs cursor-pointer">
              <ChevronLeft size={16} />
            </button>
            <div className="flex items-center gap-1">
              {[...Array(Math.min(totalPages, 5))].map((_, i) => {
                let pageNum = i + 1;
                if (totalPages > 5 && currentPage > 3) {
                  pageNum = currentPage - 2 + i;
                  if (pageNum > totalPages) pageNum = totalPages - (4 - i);
                }
                
                return (
                  <button 
                    key={i} 
                    onClick={() => setCurrentPage(pageNum)} 
                    className={`w-8 h-8 rounded-xl text-xs font-bold transition-all cursor-pointer ${currentPage === pageNum ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-200/60 bg-transparent'}`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <button disabled={currentPage === totalPages || totalPages === 0} onClick={() => setCurrentPage(prev => prev + 1)} className="p-2 bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-slate-900 disabled:opacity-40 transition-colors shadow-2xs cursor-pointer">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
          </>
        )}
      </div>

      <Modal 
        isOpen={!!deleteCandidate}
        onClose={() => setDeleteCandidate(null)}
        onConfirm={handleDelete}
        isLoading={isDeleting}
        type="danger"
        title="Radiation Administrative"
        message={`Confirmez-vous la radiation définitive de ${formatStudentName(deleteCandidate?.last_name, deleteCandidate?.first_name).fullName} du ${terminology.register} ?`}
        confirmLabel="Confirmer Radiation"
      />

      <Modal
        isOpen={showCloseModal}
        onClose={() => {
          setShowCloseModal(false);
          setCloseCandidate(null);
        }}
        onConfirm={handleCloseDossier}
        isLoading={isClosing}
        type="danger"
        title="Fermeture de Dossier"
        confirmLabel="Confirmer la Fermeture"
        cancelLabel="Annuler"
      >
        <div className="space-y-4">
          <div className="p-4 bg-rose-50 rounded-xl border border-rose-200 flex items-start gap-3">
            <AlertCircle className="text-rose-600 shrink-0" size={20} />
            <p className="text-sm text-rose-800 font-medium leading-relaxed">
              Vous êtes sur le point de clore le dossier de <strong>{formatStudentName(closeCandidate?.last_name, closeCandidate?.first_name).fullName}</strong>. 
              L'{terminology.student.toLowerCase()} passera au statut <strong>Inactif</strong>.
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">Motif de la fermeture</label>
            <textarea 
              required
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-rose-500 focus:ring-0 transition-all min-h-[100px]"
              placeholder="Ex: Transfert, Abandon, Fin de cursus..."
              value={closeReason}
              onChange={(e) => setCloseReason(e.target.value)}
            />
          </div>
        </div>
      </Modal>

      {/* Quick View Modal */}
      <Modal
        isOpen={!!quickViewStudent}
        onClose={() => {
          setQuickViewStudent(null);
          setQuickViewIndex(-1);
        }}
        containerClassName="max-w-4xl rounded-[2rem]"
        title={`Aperçu Rapide de l'${terminology.student}`}
        hideDefaultActions
      >
        {quickViewStudent && (
          <div className="space-y-6">
            <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 border-2 border-white shadow-sm">
                  <User size={32} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 leading-none">
                    {formatStudentName(quickViewStudent.last_name, quickViewStudent.first_name).fullName}
                  </h3>
                  <p className="text-xs font-bold text-slate-500 mt-1 uppercase tracking-widest">
                    ID: {quickViewStudent.id} • {quickViewStudent.class?.name || 'Non assigné'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  disabled={quickViewIndex <= 0}
                  onClick={handlePrevQuickView}
                  className="p-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:text-indigo-600 disabled:opacity-30 transition-all shadow-sm"
                >
                  <ChevronLeft size={20} />
                </button>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                  {quickViewIndex + 1} / {filteredStudents.length}
                </span>
                <button 
                  disabled={quickViewIndex >= filteredStudents.length - 1}
                  onClick={handleNextQuickView}
                  className="p-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:text-indigo-600 disabled:opacity-30 transition-all shadow-sm"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm space-y-3">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Info size={12} className="text-indigo-500" /> Informations Personnelles
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[9px] font-bold text-slate-400 uppercase">Genre</p>
                      <p className="text-xs font-bold text-slate-700">{quickViewStudent.gender}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-slate-400 uppercase">Date de Naissance</p>
                      <p className="text-xs font-bold text-slate-700">{quickViewStudent.dob ? new Date(quickViewStudent.dob).toLocaleDateString('fr-FR') : 'Non renseignée'}</p>
                    </div>
                    {terminology.student !== 'Élève' && (
                      <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase">Âge estimé</p>
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-indigo-600">{quickViewStudent.age !== null ? `${quickViewStudent.age} ans` : 'N/A'}</p>
                          {quickViewStudent.ageStatus === 'LATE' && (
                            <span className="px-1 py-0.5 rounded bg-amber-100 text-amber-700 text-[8px] font-bold uppercase">Retardataire</span>
                          )}
                          {quickViewStudent.ageStatus === 'CRITICAL' && (
                            <span className="px-1 py-0.5 rounded bg-rose-100 text-rose-700 text-[8px] font-bold uppercase">Hors Plage</span>
                          )}
                        </div>
                      </div>
                    )}
                    <div>
                      <p className="text-[9px] font-bold text-slate-400 uppercase">Lieu de Naissance</p>
                      <p className="text-xs font-bold text-slate-700">{quickViewStudent.birth_place || 'Non renseigné'}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-slate-400 uppercase">Nationalité</p>
                      <p className="text-xs font-bold text-slate-700">{quickViewStudent.nationality || 'Haïtienne'}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm space-y-3">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Users size={12} className="text-emerald-500" /> Responsables Légaux
                  </h4>
                  <div className="space-y-2">
                    {quickViewStudent.father_name && (
                      <div className="flex justify-between items-center py-1 border-b border-slate-50">
                        <span className="text-[10px] font-bold text-slate-500">Père</span>
                        <span className="text-xs font-bold text-slate-700">{quickViewStudent.father_name}</span>
                      </div>
                    )}
                    {quickViewStudent.mother_name && (
                      <div className="flex justify-between items-center py-1 border-b border-slate-50">
                        <span className="text-[10px] font-bold text-slate-500">Mère</span>
                        <span className="text-xs font-bold text-slate-700">{quickViewStudent.mother_name}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center py-1">
                      <span className="text-[10px] font-bold text-slate-500">Téléphone</span>
                      <span className="text-xs font-bold text-indigo-600">{quickViewStudent.emergency_phone || 'Non renseigné'}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-slate-900 p-4 rounded-xl shadow-lg space-y-3 text-white">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <GraduationCap size={12} className="text-blue-400" /> Statut {terminology.academicYear.includes('Académique') ? 'Académique' : 'Scolaire'}
                  </h4>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-300">{terminology.option} Actuelle</span>
                    <span className="text-sm font-black text-white">{quickViewStudent.class?.name || 'Non assigné'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-300">Niveau</span>
                    <span className="text-xs font-bold text-blue-400 uppercase tracking-widest">{quickViewStudent.class?.level}</span>
                  </div>
                  <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-300">Statut Dossier</span>
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-tighter ${
                      quickViewStudent.status === 'Actif' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                    }`}>
                      {quickViewStudent.status}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-4 w-full">
                  <button 
                    onClick={() => {
                      setQuickViewStudent(null);
                      navigate(`/eleves/detail/${quickViewStudent.id}`);
                    }}
                    className="flex-grow py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-indigo-500/10 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
                  >
                    <Eye size={14} /> Voir Dossier Complet
                  </button>
                  
                  {(user.role === UserRole.SUPER_ADMIN || user.role === UserRole.SCHOOL_ADMIN || user.role === UserRole.DIRECTOR) && quickViewStudent.status !== 'Inactif' && (
                    <button 
                      onClick={() => {
                        setQuickViewStudent(null);
                        setCloseCandidate(quickViewStudent);
                        setShowCloseModal(true);
                      }}
                      className="px-4 py-3 bg-rose-50 text-rose-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-100 transition-all border border-rose-200 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
                      title="Archiver administrativement ce dossier"
                    >
                      <Ban size={14} /> Clore Dossier
                    </button>
                  )}

                  <button 
                    type="button"
                    onClick={() => {
                      setQuickViewStudent(null);
                      setQuickViewIndex(-1);
                    }}
                    className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all border border-slate-200 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
                  >
                    <X size={14} /> Fermer l'Aperçu
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Document Status Update Modal */}
      {docModalStudent && (
        <StudentDocumentStatusModal
          isOpen={showDocModal}
          onClose={() => {
            setShowDocModal(false);
            setDocModalStudent(null);
          }}
          student={docModalStudent}
          schoolType={school?.school_type}
          currentUser={user}
          onSuccess={(updatedDocs, updatedStatus) => {
            setStudents(prev => prev.map(s => {
              if (s.id === docModalStudent.id) {
                const normalizedDocs = normalizeStudentDocuments(updatedDocs, school?.school_type, school?.global_settings);
                const completeness = calculateDocumentsCompleteness(normalizedDocs, school?.school_type, school?.global_settings);
                return {
                  ...s,
                  submitted_documents: updatedDocs,
                  ...(updatedStatus ? { status: updatedStatus } : {}),
                  normalizedDocs,
                  completeness
                };
              }
              return s;
            }));
            setShowDocModal(false);
            setDocModalStudent(null);
          }}
        />
      )}
    </div>
  );
};

export default StudentList;