
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  BookOpen, Calendar, Clock, Plus, Trash2, ArrowLeft, Save, 
  AlertCircle, CheckCircle2, TrendingUp, Edit2,
  Loader2, Layers, X, ShieldCheck, ChevronDown, RefreshCw,
  AlertTriangle, ArrowRight, Filter, CheckSquare, Square,
  Building2, Sparkles, Copy, ArrowRightLeft, Database, Info
} from 'lucide-react';
import { supabase, isValidUuid } from '../supabase';
import { StaffMember, StaffAssignment, UserProfile } from '../types';
import { AuditLogger } from '../utils/auditLogger';
import { formatStudentName } from '../utils/formatters';
import { useSchool } from '../contexts/SchoolContext';
import { 
  findSubjectInList, 
  findClassInList, 
  matchClasses, 
  matchSubjects 
} from '../utils/subjectMatching';
import { toast } from 'sonner';
import Modal from './Modal';

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const DAYS_SHORT: Record<string, string> = {
  'Lundi': 'Lun',
  'Mardi': 'Mar',
  'Mercredi': 'Mer',
  'Jeudi': 'Jeu',
  'Vendredi': 'Ven',
  'Samedi': 'Sam'
};

const QUICK_TIME_SLOTS = [
  { label: '08h - 10h', start: '08:00', end: '10:00' },
  { label: '10h - 12h', start: '10:00', end: '12:00' },
  { label: '13h - 15h', start: '13:00', end: '15:00' },
  { label: '15h - 17h', start: '15:00', end: '17:00' },
  { label: '08h - 12h (4h)', start: '08:00', end: '12:00' },
  { label: '13h - 17h (4h)', start: '13:00', end: '17:00' },
];

/**
 * Fonction de validation du service d'importation :
 * Vérifie l'appartenance à la 'school_id' du tenant courant pour chaque enregistrement de cours.
 */
export const validateCourseSchoolTenant = (
  courseRecord: { school_id?: string | null; [key: string]: any },
  expectedSchoolId?: string | null
): { isValid: boolean; reason?: string } => {
  if (!expectedSchoolId) {
    return {
      isValid: false,
      reason: "Identifiant d'établissement (school_id) du tenant courant non défini."
    };
  }
  if (courseRecord.school_id && String(courseRecord.school_id) !== String(expectedSchoolId)) {
    return {
      isValid: false,
      reason: `Violation multi-tenant : Le cours appartient à un autre établissement (${courseRecord.school_id}).`
    };
  }
  return { isValid: true };
};

interface StaffAssignmentViewProps {
  user: UserProfile;
}

const StaffAssignmentView: React.FC<StaffAssignmentViewProps> = ({ user }) => {
  const { id: staffId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { terminology, currentCampusId } = useSchool();
  
  const [staff, setStaff] = useState<StaffMember | null>(null);
  const [assignments, setAssignments] = useState<StaffAssignment[]>([]);
  const [allClasses, setAllClasses] = useState<any[]>([]);
  const [availableClasses, setAvailableClasses] = useState<any[]>([]);
  const [availableSubjects, setAvailableSubjects] = useState<any[]>([]);
  const [classSubjects, setClassSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeYearId, setActiveYearId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [formError, setFormError] = useState<{title: string, message: string} | null>(null);
  
  // Multi-Tenant & Academic Years / Session State
  const [allAcademicYears, setAllAcademicYears] = useState<any[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<string | null>(null);

  const [hasPreviousCourses, setHasPreviousCourses] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [sourceYearId, setSourceYearId] = useState<string>('');
  const [sourceAssignments, setSourceAssignments] = useState<any[]>([]);
  const [selectedImportIds, setSelectedImportIds] = useState<string[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importAnalysis, setImportAnalysis] = useState<Array<{
    source: any;
    targetClassId: string | null;
    status: 'ready' | 'duplicate' | 'time_conflict' | 'class_missing' | 'invalid_tenant';
    statusMessage: string;
  }>>([]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [newAssignment, setNewAssignment] = useState({
    subject_id: '',
    class_id: '',
    day: 'Lundi',
    start: '08:00',
    end: '10:00',
    hourly_rate: ''
  });

  const initModule = useCallback(async () => {
    if (!staffId || !user?.school_id) return;
    setLoading(true);
    try {
      // 1. Charger toutes les années académiques/sessions pour cet établissement (Multi-Tenant)
      const { data: yearsData, error: yearsErr } = await supabase
        .from('academic_years')
        .select('*')
        .eq('school_id', user.school_id)
        .order('start_date', { ascending: false });

      if (yearsErr) throw yearsErr;

      const yearsList = yearsData || [];
      setAllAcademicYears(yearsList);

      // Déterminer l'année cible par défaut
      let targetYearId = selectedYearId;
      if (!targetYearId || !yearsList.some(y => y.id === targetYearId)) {
        const activeYearObj = yearsList.find(y => y.status === 'ACTIVE' || y.is_active === true);
        const prepYearObj = yearsList.find(y => y.status === 'FUTURE' || y.status === 'PREPARATION');
        targetYearId = activeYearObj?.id || prepYearObj?.id || yearsList[0]?.id || null;
        setSelectedYearId(targetYearId);
      }
      setActiveYearId(targetYearId);

      // 2. Charger les assignations du professeur pour l'année cible
      let assignmentsRes;
      try {
        let finalQuery = supabase
          .from('staff_assignments')
          .select('*')
          .eq('staff_id', staffId)
          .eq('school_id', user.school_id);

        if (targetYearId) {
          const targetYearObj = yearsList.find(y => y.id === targetYearId);
          const isTargetActive = targetYearObj?.is_active || targetYearObj?.status === 'ACTIVE';
          if (isTargetActive) {
            finalQuery = finalQuery.or(`academic_year_id.eq.${targetYearId},academic_year_id.is.null`);
          } else {
            finalQuery = finalQuery.eq('academic_year_id', targetYearId);
          }
        }

        const { data, error } = await finalQuery;
        
        if (error && error.code === '42703') {
          console.warn("Colonne academic_year_id absente dans staff_assignments, fallback...");
          const fallback = await supabase
            .from('staff_assignments')
            .select('*')
            .eq('staff_id', staffId)
            .eq('school_id', user.school_id);
          assignmentsRes = fallback;
        } else {
          assignmentsRes = { data, error };
        }
      } catch (e) {
        assignmentsRes = await supabase
          .from('staff_assignments')
          .select('*')
          .eq('staff_id', staffId)
          .eq('school_id', user.school_id);
      }

      // 2b. Vérifier si l'enseignant possède un historique de cours attribués dans d'autres années
      let hasPrev = false;
      try {
        const { data: historyAssignments } = await supabase
          .from('staff_assignments')
          .select('academic_year_id')
          .eq('staff_id', staffId)
          .eq('school_id', user.school_id);

        if (historyAssignments && historyAssignments.length > 0) {
          hasPrev = historyAssignments.some(a => 
            a.academic_year_id ? a.academic_year_id !== targetYearId : false
          );
          if (!hasPrev && historyAssignments.length > 0) {
            const targetYearObj = yearsList.find(y => y.id === targetYearId);
            if (targetYearObj && (targetYearObj.status === 'PREPARATION' || targetYearObj.status === 'FUTURE')) {
              hasPrev = true;
            }
          }
        }
      } catch (eHistory) {
        console.warn("Erreur de vérification de l'historique des cours du personnel:", eHistory);
      }
      setHasPreviousCourses(hasPrev);

      // 3. Charger inscriptions et classes
      let enrollsQuery = supabase
        .from('enrollments')
        .select('class_id, class:classes(campus_id)')
        .eq('school_id', user.school_id);

      if (targetYearId) {
        enrollsQuery = enrollsQuery.eq('academic_year_id', targetYearId);
      }

      let classesQuery = supabase.from('classes').select('id, name, campus_id').eq('school_id', user.school_id);
      let subjectsQuery = supabase.from('subjects').select('id, name').eq('school_id', user.school_id);

      if (currentCampusId && isValidUuid(currentCampusId)) {
        classesQuery = classesQuery.eq('campus_id', currentCampusId);
      }

      const [staffRes, classesRes, subjectsRes, classSubjectsRes, enrollsRes] = await Promise.all([
        supabase.from('staff').select('*').eq('id', staffId).single(),
        classesQuery,
        subjectsQuery,
        supabase.from('class_subjects').select('class_id, subject_id, subject:subjects(id, name)'),
        enrollsQuery
      ]);

      if (staffRes.error) throw staffRes.error;
      
      if (staffRes.data) {
        if (currentCampusId && staffRes.data.campus_id && staffRes.data.campus_id !== currentCampusId) {
          toast.error("Vous n'avez pas l'autorisation de gérer l'assignation de ce personnel.");
          navigate('/personnel');
          return;
        }
        setStaff(staffRes.data);
        setNewAssignment(prev => ({ ...prev, hourly_rate: staffRes.data.amount?.toString() || '' }));
      }

      if (assignmentsRes.data) setAssignments(assignmentsRes.data);

      const classesData = classesRes.data || [];
      setAllClasses(classesData);

      // Calculer les inscriptions par classe pour l'année cible
      const enrolledCounts: { [key: string]: number } = {};
      if (enrollsRes.data) {
        enrollsRes.data.forEach(e => {
          if (e.class_id) {
            enrolledCounts[e.class_id] = (enrolledCounts[e.class_id] || 0) + 1;
          }
        });
      }

      const targetYearObj = yearsList.find(y => y.id === targetYearId);
      const isPrepOrFuture = targetYearObj && (targetYearObj.status === 'FUTURE' || targetYearObj.status === 'PREPARATION');

      const enrolledKeys = Object.keys(enrolledCounts);
      // En mode préparation d'année ou si aucune inscription n'est encore enregistrée, on autorise toutes les classes
      const filteredClasses = classesData
        .filter(c => isPrepOrFuture || enrolledKeys.length === 0 || enrolledKeys.includes(c.id))
        .map(c => ({
          ...c,
          enrollment_count: enrolledCounts[c.id] || 0
        }));

      setAvailableClasses(filteredClasses);
      setAvailableSubjects(subjectsRes.data || []);
      setClassSubjects(classSubjectsRes.data || []);

    } catch (e: any) {
      console.error("Erreur d'initialisation:", e.message);
    } finally {
      setLoading(false);
    }
  }, [staffId, selectedYearId, user?.school_id, currentCampusId, navigate]);

  useEffect(() => { initModule(); }, [initModule]);

  // Changer l'année académique de travail
  const handleYearSwitch = (newYearId: string) => {
    if (newYearId === selectedYearId) return;
    if (hasUnsavedChanges) {
      const confirmSwitch = window.confirm("Vous avez des modifications non enregistrées sur l'année actuelle. Voulez-vous changer d'année sans sauvegarder ?");
      if (!confirmSwitch) return;
    }
    setSelectedYearId(newYearId);
    setActiveYearId(newYearId);
    setHasUnsavedChanges(false);
    setEditingId(null);
  };

  // Analyse préalable pour l'importation de cours
  const analyzeSourceAssignments = useCallback(async (srcYearId: string, currentTargetYearId?: string) => {
    if (!srcYearId || !staffId) return;
    setImportLoading(true);
    try {
      const activeTargetId = currentTargetYearId || selectedYearId;

      // 1. Récupérer toutes les assignations du professeur depuis Supabase
      const { data, error } = await supabase
        .from('staff_assignments')
        .select('*')
        .eq('staff_id', staffId);

      if (error) throw error;

      const allAssignments = data || [];

      // Si des assignations existent en mémoire locale React (ex: ajoutées mais non encore sauvegardées),
      // les fusionner dans allAssignments pour ne perdre aucun cours
      if (assignments.length > 0) {
        const dbIds = new Set(allAssignments.map(a => String(a.id)));
        assignments.forEach(a => {
          if (!dbIds.has(String(a.id))) {
            allAssignments.push({
              id: a.id,
              staff_id: a.staff_id || staffId,
              school_id: user?.school_id,
              subject_id: a.subject_id,
              class_id: a.class_id,
              subject_name: a.subject_name,
              class_name: a.class_name,
              day_of_week: a.day_of_week,
              start_time: a.start_time,
              end_time: a.end_time,
              duration_hours: a.duration_hours,
              hourly_rate: a.hourly_rate,
              academic_year_id: activeTargetId
            });
          }
        });
      }

      const srcYearObj = allAcademicYears.find(y => y.id === srcYearId);
      const isSrcActive = srcYearObj ? (srcYearObj.is_active || srcYearObj.status === 'ACTIVE') : true;

      // 2. Filtrer les cours pour l'année source demandée
      const items = allAssignments.filter(src => {
        if (src.academic_year_id === srcYearId) return true;
        if (!src.academic_year_id && isSrcActive) return true;
        return false;
      });

      // 3. Récupérer les cours de l'année CIBLE pour vérifier les doublons et chevauchements
      const targetYearObj = allAcademicYears.find(y => y.id === activeTargetId);
      const isTargetActive = targetYearObj ? (targetYearObj.is_active || targetYearObj.status === 'ACTIVE') : false;

      const targetExistingAssignments = allAssignments.filter(a => {
        if (a.academic_year_id === activeTargetId) return true;
        if (!a.academic_year_id && isTargetActive) return true;
        return false;
      });

      if (activeTargetId === selectedYearId) {
        assignments.forEach(a => {
          if (!targetExistingAssignments.some(t => String(t.id) === String(a.id))) {
            targetExistingAssignments.push(a as any);
          }
        });
      }

      const checkTimeOverlap = (s1: string, e1: string, s2: string, e2: string) => {
        const start1 = s1.substring(0, 5);
        const end1 = e1.substring(0, 5);
        const start2 = s2.substring(0, 5);
        const end2 = e2.substring(0, 5);
        return (start1 < end2 && start2 < end1);
      };

      const analysisList = items.map(src => {
        // 0. Vérification d'appartenance au school_id du tenant courant
        const tenantCheck = validateCourseSchoolTenant(src, user?.school_id);

        // Trouver la classe équivalente dans l'année cible
        const matchingClass = allClasses.find(c => 
          String(c.id) === String(src.class_id) || 
          c.name.trim().toLowerCase() === src.class_name.trim().toLowerCase()
        );

        // Vérifier si le cours existe déjà à l'identique dans l'année CIBLE
        const isDuplicate = targetExistingAssignments.some(a => 
          a.day_of_week === src.day_of_week &&
          a.start_time.substring(0, 5) === src.start_time.substring(0, 5) &&
          (a.class_name === src.class_name || (matchingClass && String(a.class_id) === String(matchingClass.id))) &&
          (a.subject_name === src.subject_name || String(a.subject_id) === String(src.subject_id))
        );

        // Vérifier s'il y a un conflit d'horaire pour cet enseignant dans l'année CIBLE
        const hasTimeOverlap = targetExistingAssignments.some(a => 
          a.day_of_week === src.day_of_week &&
          checkTimeOverlap(src.start_time, src.end_time, a.start_time, a.end_time)
        );

        let status: 'ready' | 'duplicate' | 'time_conflict' | 'class_missing' | 'invalid_tenant' = 'ready';
        let statusMessage = 'Prêt à être importé';

        if (!tenantCheck.isValid) {
          status = 'invalid_tenant';
          statusMessage = tenantCheck.reason || 'Cours appartenant à un autre établissement';
        } else if (isDuplicate) {
          status = 'duplicate';
          statusMessage = 'Déjà présent dans l\'année cible';
        } else if (hasTimeOverlap) {
          status = 'time_conflict';
          statusMessage = `Conflit d'horaire pour l'enseignant le ${src.day_of_week} (${src.start_time.substring(0, 5)}-${src.end_time.substring(0, 5)})`;
        } else if (!matchingClass) {
          status = 'class_missing';
          statusMessage = `Classe "${src.class_name}" non configurée dans l'année cible`;
        }

        return {
          source: src,
          targetClassId: matchingClass?.id || null,
          status,
          statusMessage
        };
      });

      setSourceAssignments(items);
      setImportAnalysis(analysisList);

      // Pré-sélectionner uniquement les cours prêts (sans doublons ni violations tenant)
      const readyIds = analysisList.filter(a => a.status === 'ready').map(a => a.source.id);
      setSelectedImportIds(readyIds);

    } catch (err: any) {
      console.error("Erreur d'analyse des cours de l'année précédente:", err);
      toast.error("Erreur d'analyse des cours de l'année précédente: " + (err.message || err));
    } finally {
      setImportLoading(false);
    }
  }, [staffId, allClasses, assignments, allAcademicYears, user?.school_id, selectedYearId]);

  const openImportModal = async () => {
    const otherYears = allAcademicYears.filter(y => y.id !== selectedYearId);
    if (otherYears.length === 0) {
      toast.info("Aucune autre année académique n'a été trouvée pour cet établissement.");
      return;
    }

    const activeYearObj = allAcademicYears.find(y => y.is_active || y.status === 'ACTIVE');

    // Récupérer la liste des années qui contiennent déjà des cours pour ce prof
    let yearsWithCourses: string[] = [];
    if (assignments.length > 0 && selectedYearId) {
      yearsWithCourses.push(selectedYearId);
    }
    try {
      const { data } = await supabase
        .from('staff_assignments')
        .select('academic_year_id')
        .eq('staff_id', staffId!);
      if (data) {
        data.forEach(d => {
          if (d.academic_year_id) yearsWithCourses.push(d.academic_year_id);
          else if (activeYearObj?.id) yearsWithCourses.push(activeYearObj.id);
        });
      }
    } catch (e) {
      console.warn("Erreur de détection des années avec cours:", e);
    }
    yearsWithCourses = Array.from(new Set(yearsWithCourses));

    const prepYearObj = allAcademicYears.find(y => y.status === 'PREPARATION' || y.status === 'FUTURE');

    let defaultTargetId = selectedYearId;
    let defaultSourceId = '';

    // Détection Intelligente :
    // Si la vue actuelle (ex: 2025-2026) A des cours et qu'une année en préparation (ex: 2026-2027) existe sans cours:
    // Définir 2026-2027 comme Cible et 2025-2026 comme Source.
    if (prepYearObj && prepYearObj.id !== selectedYearId && yearsWithCourses.includes(selectedYearId) && !yearsWithCourses.includes(prepYearObj.id)) {
      defaultTargetId = prepYearObj.id;
      defaultSourceId = selectedYearId;
    } else {
      // Si l'année cible est l'année sélectionnée, choisir la meilleure année source qui contient des cours
      const candidateSource = allAcademicYears.find(y => y.id !== defaultTargetId && yearsWithCourses.includes(y.id));
      if (candidateSource) {
        defaultSourceId = candidateSource.id;
      } else {
        const fallbackSource = allAcademicYears.find(y => y.id !== defaultTargetId && (y.is_active || y.status === 'ACTIVE' || y.status === 'PASSED')) || otherYears[0];
        defaultSourceId = fallbackSource.id;
      }
    }

    if (defaultTargetId !== selectedYearId) {
      setSelectedYearId(defaultTargetId);
      setActiveYearId(defaultTargetId);
    }
    setSourceYearId(defaultSourceId);
    setIsImportModalOpen(true);
    analyzeSourceAssignments(defaultSourceId, defaultTargetId);
  };

  const handleExecuteImport = () => {
    const itemsToImport = importAnalysis.filter(item => selectedImportIds.includes(item.source.id));
    if (itemsToImport.length === 0) {
      toast.error("Veuillez sélectionner au moins un cours à importer.");
      return;
    }

    // Validation stricte du tenant school_id pour chaque enregistrement avant de valider l'importation
    for (const item of itemsToImport) {
      const validation = validateCourseSchoolTenant(item.source, user?.school_id);
      if (!validation.isValid) {
        toast.error(`Validation d'importation refusée : ${validation.reason}`);
        return;
      }
    }

    let addedCount = 0;
    const newAssignmentsToAdd: StaffAssignment[] = [];

    itemsToImport.forEach(item => {
      const src = item.source;
      const targetCls = allClasses.find(c => String(c.id) === String(item.targetClassId) || c.name === src.class_name);

      newAssignmentsToAdd.push({
        id: `temp-imp-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        staff_id: staffId!,
        subject_id: src.subject_id,
        class_id: targetCls?.id || src.class_id || null,
        subject_name: src.subject_name,
        class_name: targetCls?.name || src.class_name,
        day_of_week: src.day_of_week,
        start_time: src.start_time,
        end_time: src.end_time,
        duration_hours: src.duration_hours,
        hourly_rate: src.hourly_rate || (staff?.pay_type === 'Horaire' ? (staff?.amount || 0) : 0)
      });
      addedCount++;
    });

    setAssignments(prev => [...prev, ...newAssignmentsToAdd]);
    setHasUnsavedChanges(true);
    setIsImportModalOpen(false);

    const targetYearObj = allAcademicYears.find(y => y.id === selectedYearId);
    toast.success(`${addedCount} cours importé(s) pour l'année ${targetYearObj?.label || ''}. N'oubliez pas de cliquer sur "Finaliser les Affectations".`);
  };

  const startEdit = useCallback((a: StaffAssignment) => {
    setEditingId(a.id);
    const cls = allClasses.find(c => c.name === a.class_name);
    setNewAssignment({
      subject_id: a.subject_id,
      class_id: cls?.id || '',
      day: a.day_of_week,
      start: a.start_time.substring(0, 5),
      end: a.end_time.substring(0, 5),
      hourly_rate: a.hourly_rate?.toString() || staff?.amount?.toString() || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [allClasses, staff]);

  const cancelEdit = () => {
    setEditingId(null);
    setNewAssignment({ subject_id: '', class_id: '', day: 'Lundi', start: '08:00', end: '10:00', hourly_rate: staff?.amount?.toString() || '' });
    setFormError(null);
  };

  const cloneAssignment = useCallback((a: StaffAssignment) => {
    setEditingId(null);
    const cls = allClasses.find(c => c.name === a.class_name);
    setNewAssignment({
      subject_id: a.subject_id,
      class_id: cls?.id || a.class_id || '',
      day: a.day_of_week,
      start: a.start_time.substring(0, 5),
      end: a.end_time.substring(0, 5),
      hourly_rate: a.hourly_rate?.toString() || staff?.amount?.toString() || ''
    });
    toast.info("Paramètres dupliqués dans le formulaire ! Choisissez le jour ou l'horaire et cliquez sur 'Ajouter au planning'.");
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [allClasses, staff]);

  // Durée calculée en temps réel pour l'aperçu du formulaire
  const currentSlotDuration = useMemo(() => {
    if (!newAssignment.start || !newAssignment.end) return null;
    const start = new Date(`2000-01-01T${newAssignment.start}`);
    const end = new Date(`2000-01-01T${newAssignment.end}`);
    const diffMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
    if (diffMinutes <= 0) return { valid: false, text: "Invalide (Fin <= Début)", hours: 0 };
    const h = Math.floor(diffMinutes / 60);
    const m = diffMinutes % 60;
    const hoursNum = diffMinutes / 60;
    return {
      valid: true,
      text: m > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${h}h00`,
      hours: hoursNum
    };
  }, [newAssignment.start, newAssignment.end]);

  const { affiliatedSubjects, otherSubjects } = useMemo(() => {
    if (!newAssignment.class_id) {
      return { affiliatedSubjects: [], otherSubjects: availableSubjects };
    }
    
    const targetCls = findClassInList(newAssignment.class_id, allClasses);
    const targetClassName = targetCls?.name || '';
    const affiliatedIds = new Set<string>();

    // 1. Filtrer les matières associées à cette classe dans class_subjects
    classSubjects.forEach(cs => {
      if (cs.class_id === newAssignment.class_id || matchClasses(cs.class_id, targetClassName || newAssignment.class_id, allClasses)) {
        const found = findSubjectInList(cs.subject_id, availableSubjects) || (cs.subject as any);
        if (found?.id) affiliatedIds.add(found.id);
        else if (cs.subject_id) affiliatedIds.add(cs.subject_id);
      }
    });
      
    // 2. Ajouter les matières déjà attribuées pour cette classe dans les assignations existantes
    assignments.forEach(a => {
      if (a.class_id === newAssignment.class_id || matchClasses(a.class_name || a.class_id, targetClassName || newAssignment.class_id, allClasses)) {
        const found = findSubjectInList(a.subject_id || a.subject_name, availableSubjects);
        if (found) affiliatedIds.add(found.id);
        else if (a.subject_id) affiliatedIds.add(a.subject_id);
      }
    });

    // 3. Ajouter la matière de spécialité de l'enseignant
    if ((staff as any)?.subject) {
      const found = findSubjectInList(String((staff as any).subject), availableSubjects);
      if (found) affiliatedIds.add(found.id);
    }

    const affiliated = availableSubjects.filter(s => affiliatedIds.has(s.id));
    const others = availableSubjects.filter(s => !affiliatedIds.has(s.id));
    
    return {
      affiliatedSubjects: affiliated,
      otherSubjects: others
    };
  }, [newAssignment.class_id, classSubjects, availableSubjects, assignments, allClasses, staff]);

  // Backward compatibility alias
  const filteredSubjects = affiliatedSubjects.length > 0 ? affiliatedSubjects : availableSubjects;

  const removeAssignment = useCallback((aid: string) => {
    setAssignments(prev => prev.filter(a => String(a.id) !== String(aid)));
    setHasUnsavedChanges(true);
    setSaveStatus('idle');
    if (editingId === aid) cancelEdit();
  }, [editingId]);

  const handleProcessAssignment = async () => {
    setFormError(null);
    if (!newAssignment.subject_id || !newAssignment.class_id) {
      setFormError({
        title: "Champs manquants",
        message: `Veuillez choisir un(e) ${terminology.class.toLowerCase()} et un(e) ${terminology.subject.toLowerCase()}.`
      });
      return;
    }
    
    const start = new Date(`2000-01-01T${newAssignment.start}`);
    const end = new Date(`2000-01-01T${newAssignment.end}`);
    const diffMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
    const diffHours = diffMinutes / 60;

    if (diffMinutes <= 0) {
      setFormError({
        title: "Erreur de saisie",
        message: `L'heure de fin (${newAssignment.end}) doit être strictement après l'heure de début (${newAssignment.start}).`
      });
      return;
    }

    if (diffMinutes < 15) {
      setFormError({
        title: "Durée trop courte",
        message: `Un cours doit durer au minimum 15 minutes. Vous avez saisi ${diffMinutes} minutes.`
      });
      return;
    }

    const sub = availableSubjects.find(s => String(s.id) === String(newAssignment.subject_id));
    const cls = allClasses.find(c => String(c.id) === String(newAssignment.class_id));

    // Fonction utilitaire pour vérifier le chevauchement strict
    // Si start1 == end2 ou start2 == end1, ce n'est PAS un chevauchement (les cours peuvent s'enchaîner)
    const checkOverlap = (start1: string, end1: string, start2: string, end2: string) => {
      return (start1 < end2 && start2 < end1);
    };

    // 1. Vérifier les conflits pour ce professeur (il ne peut pas être à deux endroits en même temps)
    const teacherOverlap = assignments.find(a => 
      a.day_of_week === newAssignment.day && 
      String(a.id) !== String(editingId) &&
      checkOverlap(newAssignment.start, newAssignment.end, a.start_time.substring(0, 5), a.end_time.substring(0, 5))
    );

    if (teacherOverlap) {
      const tStart = teacherOverlap.start_time.substring(0, 5);
      const tEnd = teacherOverlap.end_time.substring(0, 5);
      setFormError({
        title: "Conflit d'horaire pour ce professeur !",
        message: `Il/Elle enseigne déjà en ${teacherOverlap.class_name} le ${teacherOverlap.day_of_week} de ${tStart} à ${tEnd}.\n\n💡 Règle : Un professeur ne peut pas être à deux endroits en même temps.\n✅ Solution : Vous pouvez commencer ce nouveau cours exactement à ${tEnd}, ou laisser une pause (ex: 10-15 min) et commencer après.`
      });
      return;
    }

    // 2. Vérifier les conflits pour la classe dans la liste LOCALE (pas encore en base)
    const localClassOverlap = assignments.find(a => {
      if (a.day_of_week !== newAssignment.day || String(a.id) === String(editingId)) return false;
      
      const isOverlapping = checkOverlap(newAssignment.start, newAssignment.end, a.start_time.substring(0, 5), a.end_time.substring(0, 5));
      if (!isOverlapping) return false;

      if (a.class_id && newAssignment.class_id) {
        return String(a.class_id) === String(newAssignment.class_id);
      }
      return a.class_name === cls?.name;
    });

    if (localClassOverlap) {
      setFormError({
        title: `Conflit local pour la classe ${cls?.name} !`,
        message: `Vous avez déjà ajouté un cours de ${localClassOverlap.subject_name} pour cette classe le ${localClassOverlap.day_of_week} de ${localClassOverlap.start_time.substring(0, 5)} à ${localClassOverlap.end_time.substring(0, 5)} dans cette session.\n\n💡 Règle : Une classe ne peut avoir qu'un seul cours à la fois.`
      });
      return;
    }

    // 3. Vérifier les conflits pour la classe en BASE DE DONNÉES (avec d'autres professeurs)
    setIsSaving(true);
    try {
      // Pour respecter le multi-annexe / multi-campus, on filtre par school_id et jour,
      // puis on filtre de manière précise en mémoire par class_id ou class_name + campus_id.
      let query = supabase
        .from('staff_assignments')
        .select('*, staff!inner(first_name, last_name, school_id, campus_id)')
        .eq('school_id', user.school_id)
        .eq('day_of_week', newAssignment.day);
      
      if (activeYearId) {
        query = query.eq('academic_year_id', activeYearId);
      }

      let { data: classAssignments, error } = await query;
      
      // Fallback if academic_year_id column is missing
      if (error && (error.code === '42703' || error.message?.includes('academic_year_id')) && activeYearId) {
        const fallbackQuery = supabase
          .from('staff_assignments')
          .select('*, staff!inner(first_name, last_name, school_id, campus_id)')
          .eq('school_id', user.school_id)
          .eq('day_of_week', newAssignment.day);
        const fallback = await fallbackQuery;
        classAssignments = fallback.data;
        error = fallback.error;
      }

      if (error) throw error;

      if (classAssignments) {
        const classOverlap = classAssignments.find(a => {
          if (String(a.staff_id) === String(staffId)) return false; // Exclure le prof actuel (déjà vérifié ou c'est une modification)
          
          const isOverlapping = checkOverlap(newAssignment.start, newAssignment.end, a.start_time.substring(0, 5), a.end_time.substring(0, 5));
          if (!isOverlapping) return false;

          // Si les horaires se chevauchent, vérifier si c'est la même classe (multi-annexe / multi-campus)
          if (a.class_id && newAssignment.class_id) {
            return String(a.class_id) === String(newAssignment.class_id);
          }

          // Fallback par nom de classe + campus si l'id n'est pas renseigné
          if (a.class_name === cls?.name) {
            // Si le campus de l'enseignant est différent du campus de notre classe, ce n'est pas un conflit
            if (a.staff?.campus_id && cls?.campus_id && a.staff.campus_id !== cls.campus_id) {
              return false;
            }
            return true;
          }

          return false;
        });

        if (classOverlap) {
          const cStart = classOverlap.start_time.substring(0, 5);
          const cEnd = classOverlap.end_time.substring(0, 5);
          const profName = classOverlap.staff ? formatStudentName(classOverlap.staff.last_name, classOverlap.staff.first_name).fullName : 'un autre professeur';
          setFormError({
            title: `Conflit d'horaire pour la classe ${cls?.name} !`,
            message: `Cette classe a déjà un cours de ${classOverlap.subject_name} avec ${profName} le ${classOverlap.day_of_week} de ${cStart} à ${cEnd}.\n\n💡 Règle : Une classe ne peut avoir qu'un seul cours à la fois.\n✅ Solution : Veuillez choisir une heure de début à partir de ${cEnd}.`
          });
          setIsSaving(false);
          return;
        }
      }
    } catch (err) {
      console.error("Erreur lors de la vérification des conflits:", err);
    }
    setIsSaving(false);

    const updatedData: StaffAssignment = {
      id: editingId || `temp-${Date.now()}`,
      staff_id: staffId!,
      subject_id: newAssignment.subject_id,
      class_id: newAssignment.class_id,
      subject_name: sub?.name || 'Matière inconnue',
      class_name: cls?.name || 'Classe inconnue',
      day_of_week: newAssignment.day,
      start_time: newAssignment.start,
      end_time: newAssignment.end,
      duration_hours: parseFloat(diffHours.toFixed(2)),
      hourly_rate: parseFloat(newAssignment.hourly_rate) || 0
    };

    if (editingId) {
      setAssignments(prev => prev.map(a => String(a.id) === String(editingId) ? updatedData : a));
      setEditingId(null);
    } else {
      setAssignments(prev => [...prev, updatedData]);
    }

    setNewAssignment({ subject_id: '', class_id: '', day: 'Lundi', start: '08:00', end: '10:00', hourly_rate: staff?.amount?.toString() || '' });
    setHasUnsavedChanges(true);
    setSaveStatus('idle');
  };

  const handleSaveAll = async () => {
    if (!staffId) return;
    setIsSaving(true);
    setSaveStatus('idle');

    try {
      const targetYearId = selectedYearId || activeYearId;
      const targetYearObj = allAcademicYears.find(y => y.id === targetYearId);
      const isTargetActive = targetYearObj?.is_active || targetYearObj?.status === 'ACTIVE';

      // 0. Pre-validation locale des chevauchements d'horaires pour cet enseignant
      const checkOverlap = (s1: string, e1: string, s2: string, e2: string) => {
        const start1 = s1.substring(0, 5);
        const end1 = e1.substring(0, 5);
        const start2 = s2.substring(0, 5);
        const end2 = e2.substring(0, 5);
        return (start1 < end2 && start2 < end1);
      };

      for (let i = 0; i < assignments.length; i++) {
        for (let j = i + 1; j < assignments.length; j++) {
          const a1 = assignments[i];
          const a2 = assignments[j];
          if (a1.day_of_week === a2.day_of_week && checkOverlap(a1.start_time, a1.end_time, a2.start_time, a2.end_time)) {
            const s1 = a1.start_time.substring(0, 5);
            const e1 = a1.end_time.substring(0, 5);
            const s2 = a2.start_time.substring(0, 5);
            const e2 = a2.end_time.substring(0, 5);
            setFormError({
              title: "Conflit d'horaire pour l'enseignant !",
              message: `Cet enseignant a deux cours programmés sur des créneaux qui se chevauchent le ${a1.day_of_week} :\n• ${a1.subject_name} (${a1.class_name}) de ${s1} à ${e1}\n• ${a2.subject_name} (${a2.class_name}) de ${s2} à ${e2}\n\n💡 Solution : Supprimez ou modifiez l'un des deux cours en conflit avant de finaliser.`
            });
            setIsSaving(false);
            return;
          }
        }
      }

      // 1. Nettoyage
      let delError;
      if (targetYearId) {
        let delQuery = supabase
          .from('staff_assignments')
          .delete()
          .eq('staff_id', staffId)
          .eq('school_id', user.school_id);

        if (isTargetActive) {
          delQuery = delQuery.or(`academic_year_id.eq.${targetYearId},academic_year_id.is.null`);
        } else {
          delQuery = delQuery.eq('academic_year_id', targetYearId);
        }

        const { error: errDel } = await delQuery;
        delError = errDel;
      } else {
        const { error: errAll } = await supabase
          .from('staff_assignments')
          .delete()
          .eq('staff_id', staffId)
          .eq('school_id', user.school_id);
        delError = errAll;
      }

      if (delError && delError.code !== '42703' && !delError.message?.includes('academic_year_id')) throw delError;

      // 2. Insertion avec formatage strict
      if (assignments.length > 0) {
        const dataToInsert = assignments.map(a => {
          const resolvedClassId = a.class_id || allClasses.find(c => c.name === a.class_name)?.id;
          const item: any = {
            staff_id: staffId,
            school_id: user.school_id,
            subject_id: a.subject_id || null,
            class_id: resolvedClassId || null,
            subject_name: a.subject_name,
            class_name: a.class_name,
            day_of_week: a.day_of_week,
            start_time: a.start_time.length === 5 ? `${a.start_time}:00` : a.start_time,
            end_time: a.end_time.length === 5 ? `${a.end_time}:00` : a.end_time,
            duration_hours: a.duration_hours,
            hourly_rate: a.hourly_rate || 0
          };
          
          if (targetYearId) {
            item.academic_year_id = targetYearId;
          }
          
          return item;
        });
        
        const { error: insError } = await supabase
          .from('staff_assignments')
          .insert(dataToInsert);
        
        if (insError) {
          // If insert failed because of missing column, retry without it
          if (insError.code === '42703' || insError.message?.includes('academic_year_id')) {
            const fallbackData = dataToInsert.map(({ academic_year_id, ...rest }) => rest);
            const { error: retryError } = await supabase
              .from('staff_assignments')
              .insert(fallbackData);
            if (retryError) throw retryError;
          } else {
            throw insError;
          }
        }

        // Auto-link newly assigned subjects to class_subjects if not already linked
        try {
          const linksToCreate: { school_id: string; class_id: string; subject_id: string }[] = [];
          for (const item of dataToInsert) {
            if (item.class_id && item.subject_id) {
              const alreadyExists = classSubjects.some(cs => 
                (cs.class_id === item.class_id || matchClasses(cs.class_id, item.class_name, allClasses)) &&
                (cs.subject_id === item.subject_id || matchSubjects(cs.subject_id, item.subject_id, availableSubjects))
              );
              const alreadyInBatch = linksToCreate.some(l => l.class_id === item.class_id && l.subject_id === item.subject_id);
              if (!alreadyExists && !alreadyInBatch) {
                linksToCreate.push({
                  school_id: user.school_id,
                  class_id: item.class_id,
                  subject_id: item.subject_id
                });
              }
            }
          }
          if (linksToCreate.length > 0) {
            await supabase.from('class_subjects').insert(linksToCreate);
          }
        } catch (linkErr) {
          console.warn('Auto-link class_subjects in assignments:', linkErr);
        }
      }

      AuditLogger.log({
        school_id: user.school_id,
        user_id: user.id,
        action: 'UPDATE',
        entity_type: 'staff',
        entity_id: staffId,
        details: { type: 'assignments', count: assignments.length }
      });

      setSaveStatus('success');
      setHasUnsavedChanges(false);
      
      // Feedback et redirection
      setTimeout(() => {
        navigate('/personnel');
      }, 1500);

    } catch (err: any) {
      const serializedError = err.message || err.details || JSON.stringify(err);
      console.error("Échec de la finalisation:", serializedError);
      setSaveStatus('error');
      
      // Gestion spécifique des erreurs
      if (err.code === '42501' || err.message?.includes('row-level security')) {
        setFormError({
          title: "Accès Refusé (Sécurité RLS)",
          message: "Le système de sécurité de la base de données a bloqué l'enregistrement.\n\nCeci est dû à une politique de sécurité stricte sur la table des assignations. Veuillez demander à l'administrateur d'exécuter le script de correction SQL 'fix_staff_assignments_rls.sql' dans Supabase."
        });
      } else if (serializedError.toLowerCase().includes('déjà un cours') || serializedError.toLowerCase().includes('créneau') || serializedError.toLowerCase().includes('overlap') || serializedError.toLowerCase().includes('conflict')) {
        setFormError({
          title: "Conflit d'horaire dans l'emploi du temps !",
          message: "Cet enseignant a déjà un cours prévu sur ce même créneau horaire.\n\n💡 Solution : Vérifiez la liste de vos cours attribués ci-dessous et supprimez le cours en double ou modifiez son horaire avant de cliquer à nouveau sur 'Finaliser les Affectations'."
        });
      } else {
        setFormError({
          title: "Erreur de sauvegarde",
          message: `Impossible d'enregistrer les modifications. ${serializedError}`
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const weeklyHours = useMemo(() => assignments.reduce((acc, curr) => acc + curr.duration_hours, 0), [assignments]);
  const projectedMonthlyIncome = useMemo(() => {
    if (!staff) return 0;
    const fixedSalary = staff.pay_type === 'Fixe' ? (staff.amount || 0) : 0;
    const assignmentsSalary = assignments.reduce((acc, a) => {
      const rate = a.hourly_rate || (staff.pay_type === 'Horaire' ? (staff.amount || 0) : 0);
      return acc + ((a.duration_hours || 0) * rate * 4);
    }, 0);
    
    if (assignments.length > 0) {
      return fixedSalary + assignmentsSalary;
    }
    return staff.pay_type === 'Horaire' ? (weeklyHours * 4 * (staff.amount || 0)) : (staff.amount || 0);
  }, [staff, assignments, weeklyHours]);

  // Condition d'affichage intelligente du bouton d'importation
  const canShowImportButton = useMemo(() => {
    if (!selectedYearId || !allAcademicYears.length) return false;
    const targetYearObj = allAcademicYears.find(y => y.id === selectedYearId);
    
    // 1. Année cible en préparation ou active
    const isTargetValid = targetYearObj ? (
      targetYearObj.status === 'PREPARATION' || 
      targetYearObj.status === 'FUTURE' || 
      targetYearObj.status === 'ACTIVE' || 
      targetYearObj.is_active === true
    ) : false;

    // 2. Aucun cours réattribué sur cette année cible pour ce prof
    const hasNoTargetAssignments = assignments.length === 0;

    // 3. Prof non-nouveau avec historique de cours précédents
    return Boolean(isTargetValid && hasNoTargetAssignments && hasPreviousCourses);
  }, [selectedYearId, allAcademicYears, assignments.length, hasPreviousCourses]);

  const handleImportPrevious = async () => {
    if (!activeYearId) {
      toast.error("Aucune année académique active n'a été trouvée.");
      return;
    }
    
    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from('staff_assignments')
        .select('*')
        .eq('staff_id', staffId)
        .neq('academic_year_id', activeYearId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!data || data.length === 0) {
        toast.info("Aucune attribution trouvée pour les années précédentes.");
        return;
      }

      const latestYearId = data[0].academic_year_id;
      const previousAssignments = data.filter(a => a.academic_year_id === latestYearId);

      const newAssignmentsToAdd = previousAssignments.map(a => ({
        ...a,
        id: crypto.randomUUID(),
        academic_year_id: activeYearId,
        created_at: new Date().toISOString()
      }));

      setAssignments(prev => {
        const merged = [...prev];
        let addedCount = 0;
        newAssignmentsToAdd.forEach(newA => {
          const exists = merged.some(m => m.class_id === newA.class_id && m.subject_id === newA.subject_id && m.day_of_week === newA.day_of_week && m.start_time === newA.start_time);
          if (!exists) {
            merged.push(newA);
            addedCount++;
          }
        });
        
        if (addedCount > 0) {
          toast.success(`${addedCount} cours importés avec succès. N'oubliez pas d'enregistrer.`);
          setHasUnsavedChanges(true);
        } else {
          toast.info("Tous les cours précédents sont déjà présents.");
        }
        return merged;
      });
    } catch (err: any) {
      console.error(err);
      toast.error("Erreur lors de l'importation: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return <div className="flex h-screen items-center justify-center flex-col gap-4">
      <Loader2 className="animate-spin text-indigo-600" size={64} />
      <p className="text-[10px] font-semibold text-gray-400  tracking-tight animate-pulse">Chargement RH...</p>
    </div>;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 pb-24">
      
      {/* En-tête Compact & Standard International */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Profil Enseignant & Navigation */}
        <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
          <button 
            onClick={() => navigate('/personnel')} 
            className="p-2 sm:p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-xl border border-slate-200 shadow-2xs active:scale-95 transition-all shrink-0"
            title="Retour à la liste du personnel"
          >
            <ArrowLeft size={18} />
          </button>
          
          <div className="w-11 h-11 sm:w-12 sm:h-12 bg-indigo-600 text-white rounded-xl flex items-center justify-center font-bold text-lg shadow-sm shrink-0">
            {staff?.last_name?.charAt(0) || 'E'}
          </div>
          
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight truncate">
                {staff ? formatStudentName(staff.last_name, staff.first_name).fullName : 'Chargement...'}
              </h2>
              <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-md border border-indigo-100 shrink-0">
                {staff?.role || 'Enseignant'}
              </span>
              {hasUnsavedChanges && (
                <span className="bg-amber-50 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-md border border-amber-200 flex items-center gap-1 animate-pulse shrink-0">
                  <AlertTriangle size={10} /> Modifs non enregistrées
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 flex-wrap">
              {staff?.id && (
                <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5">
                  <span className="text-[9px] font-bold uppercase text-slate-400">ID :</span>
                  <span className="font-mono text-slate-700 font-semibold text-[10px]" title={staff.id}>
                    {staff.id.length > 14 ? `${staff.id.substring(0, 8)}...${staff.id.substring(staff.id.length - 4)}` : staff.id}
                  </span>
                  <button 
                    type="button" 
                    onClick={() => {
                      navigator.clipboard.writeText(staff.id);
                      toast.success("ID copié !");
                    }}
                    className="text-slate-400 hover:text-indigo-600 p-0.5 rounded transition-colors cursor-pointer"
                    title="Copier l'ID complet"
                  >
                    <Copy size={10} />
                  </button>
                </div>
              )}

              {currentCampusId && (
                <span className="bg-slate-100 text-slate-600 text-[10px] font-medium px-2 py-0.5 rounded border border-slate-200 flex items-center gap-1">
                  <Building2 size={10} className="text-amber-500" /> Annexe Active
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Contrôles Côté Droit : KPI Rémunération + Sélecteur d'Année */}
        <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap lg:flex-nowrap shrink-0">
          {/* KPI Compact : Salaire & Volume */}
          <div className="bg-slate-900 text-white px-3.5 py-2 rounded-xl flex items-center gap-3.5 border border-slate-800 shadow-xs">
            <div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Salaire Est. / Mois</p>
              <p className="text-sm font-black font-mono text-emerald-400 leading-tight">
                {projectedMonthlyIncome.toLocaleString()} <span className="text-[10px] text-slate-400 font-normal uppercase">HTG</span>
              </p>
            </div>
            <div className="h-6 w-px bg-slate-700/80" />
            <div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Volume</p>
              <p className="text-xs font-bold text-slate-200 flex items-center gap-1 leading-tight">
                <Clock size={11} className="text-indigo-400" /> {weeklyHours}h/sem
              </p>
            </div>
          </div>

          {/* Sélecteur d'Année Académique */}
          <div className="relative min-w-[200px] sm:min-w-[220px]">
            <label htmlFor="target_year_select" className="sr-only">Année Cible</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
              <select
                id="target_year_select"
                value={selectedYearId || ''}
                onChange={(e) => handleYearSwitch(e.target.value)}
                className="w-full bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs font-bold pl-8 pr-8 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer appearance-none transition-colors"
              >
                {allAcademicYears.map(y => {
                  const isAct = y.status === 'ACTIVE' || y.is_active === true;
                  const isPrep = y.status === 'FUTURE' || y.status === 'PREPARATION';
                  const statusBadge = isAct ? '🟢 En cours' : isPrep ? '🟡 Préparation' : '⚪ Clôturée';
                  return (
                    <option key={y.id} value={y.id}>
                      {y.label} ({statusBadge})
                    </option>
                  );
                })}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
            </div>
          </div>
        </div>
      </div>

      {/* Banner d'information en Mode Préparation d'Année */}
      {selectedYearId && (() => {
        const selObj = allAcademicYears.find(y => y.id === selectedYearId);
        if (!selObj) return null;
        const isPrep = selObj.status === 'FUTURE' || selObj.status === 'PREPARATION';
        if (isPrep) {
          return (
            <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-amber-900 flex items-center gap-2.5 text-xs font-medium animate-in fade-in">
              <Sparkles className="text-amber-600 shrink-0" size={16} />
              <div className="flex-1">
                <span className="font-bold text-amber-900">Mode Préparation d'Année ({selObj.label}) : </span>
                <span>Emploi du temps et grille de cours configurés à l'avance pour cette année.</span>
              </div>
            </div>
          );
        }
        return null;
      })()}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Formulaire d'assignation moderne et fluide */}
        <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-8 self-start">
           <div className={`p-6 rounded-3xl shadow-xl border-2 transition-all space-y-5 max-h-[calc(100vh-140px)] overflow-y-auto custom-scrollbar ${editingId ? 'bg-indigo-50/70 border-indigo-300 ring-4 ring-indigo-500/10' : 'bg-white border-slate-100 shadow-slate-200/50'}`}>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-2xl shadow-sm ${editingId ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-600 border border-indigo-100'}`}>
                    {editingId ? <RefreshCw size={20} className="animate-spin-slow" /> : <Plus size={20} />}
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 tracking-tight">
                      {editingId ? 'Modifier l\'assignation' : 'Assigner un nouveau cours'}
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium">
                      {editingId ? 'Ajustez les paramètres et validez la mise à jour' : 'Remplissez les détails du cours et créneau'}
                    </p>
                  </div>
                </div>
                {editingId && (
                  <button 
                    onClick={cancelEdit} 
                    className="px-2.5 py-1 text-xs font-bold text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all flex items-center gap-1 border border-slate-200"
                    title="Annuler la modification"
                  >
                    <X size={14} /> Annuler
                  </button>
                )}
              </div>

              <div className="space-y-4">
                {/* 1. Sélection de la Classe / Promotion */}
                <div className="space-y-1.5">
                   <div className="flex items-center justify-between">
                     <label htmlFor="class_id" className="text-xs font-bold text-slate-700 tracking-tight flex items-center gap-1.5">
                       <Layers size={14} className="text-indigo-600" />
                       {terminology.class} <span className="text-rose-500 font-bold">*</span>
                     </label>
                     {availableClasses.length > 0 && (
                       <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                         {availableClasses.length} éligible{availableClasses.length > 1 ? 's' : ''}
                       </span>
                     )}
                   </div>
                   <div className="relative">
                     <select 
                      id="class_id"
                      className="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-white focus:bg-white text-slate-900 border-2 border-slate-200 focus:border-indigo-600 rounded-xl text-xs font-semibold outline-none focus:ring-4 focus:ring-indigo-500/10 appearance-none transition-all cursor-pointer" 
                      value={newAssignment.class_id} 
                      onChange={e => {setNewAssignment({...newAssignment, class_id: e.target.value}); setFormError(null);}}
                     >
                       <option value="">-- Choisir un(e) {terminology.class.toLowerCase()} --</option>
                       {availableClasses.map(c => (
                         <option key={c.id} value={c.id}>
                           {c.name} ({c.enrollment_count} inscrit{c.enrollment_count > 1 ? 's' : ''})
                         </option>
                       ))}
                     </select>
                     <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                   </div>
                   {availableClasses.length === 0 && (
                     <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-xs flex items-start gap-2 animate-in fade-in">
                       <AlertCircle size={16} className="shrink-0 mt-0.5 text-amber-600" />
                       <div>
                         <span className="font-bold">Aucune classe éligible :</span> Aucun élève n'est encore inscrit pour cette session.
                       </div>
                     </div>
                   )}
                </div>

                {/* 2. Sélection de la Matière */}
                <div className="space-y-1.5">
                   <div className="flex items-center justify-between">
                     <label htmlFor="subject_id" className="text-xs font-bold text-slate-700 tracking-tight flex items-center gap-1.5">
                       <BookOpen size={14} className="text-indigo-600" />
                       Matière / Cours <span className="text-rose-500 font-bold">*</span>
                     </label>
                     {newAssignment.class_id && affiliatedSubjects.length > 0 && (
                       <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                         {affiliatedSubjects.length} au programme
                       </span>
                     )}
                   </div>
                   <div className="relative">
                     <select 
                      id="subject_id"
                      className="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-white focus:bg-white text-slate-900 border-2 border-slate-200 focus:border-indigo-600 rounded-xl text-xs font-semibold outline-none focus:ring-4 focus:ring-indigo-500/10 appearance-none transition-all disabled:opacity-50 disabled:bg-slate-100 cursor-pointer" 
                      value={newAssignment.subject_id} 
                      onChange={e => {setNewAssignment({...newAssignment, subject_id: e.target.value}); setFormError(null);}}
                      disabled={!newAssignment.class_id}
                     >
                       <option value="">
                         {!newAssignment.class_id 
                           ? `-- Sélectionnez d'abord un(e) ${terminology.class.toLowerCase()} --` 
                           : "-- Choisir une matière --"}
                       </option>
                       {affiliatedSubjects.length > 0 ? (
                         <>
                           <optgroup label={`✨ Matières associées à la classe (${affiliatedSubjects.length})`}>
                             {affiliatedSubjects.map(s => <option key={s.id} value={s.id}>{s.name} {s.code ? `(${s.code})` : ''}</option>)}
                           </optgroup>
                           {otherSubjects.length > 0 && (
                             <optgroup label={`📚 Autres matières de l'école (${otherSubjects.length})`}>
                               {otherSubjects.map(s => <option key={s.id} value={s.id}>{s.name} {s.code ? `(${s.code})` : ''}</option>)}
                             </optgroup>
                           )}
                         </>
                       ) : (
                         availableSubjects.map(s => <option key={s.id} value={s.id}>{s.name} {s.code ? `(${s.code})` : ''}</option>)
                       )}
                     </select>
                     <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                   </div>
                </div>

                {/* 3. Sélecteur de Jour avec Boutons Pills Tactiles */}
                <div className="space-y-1.5">
                   <div className="flex items-center justify-between">
                     <label className="text-xs font-bold text-slate-700 tracking-tight flex items-center gap-1.5">
                       <Calendar size={14} className="text-indigo-600" />
                       Jour de cours <span className="text-rose-500 font-bold">*</span>
                     </label>
                     <span className="text-[11px] font-bold text-indigo-700">{newAssignment.day}</span>
                   </div>
                   
                   {/* Boutons de sélection rapide du jour */}
                   <div className="grid grid-cols-6 gap-1.5">
                     {DAYS.map(d => {
                       const isSelected = newAssignment.day === d;
                       return (
                         <button
                           key={d}
                           type="button"
                           onClick={() => {
                             setNewAssignment({ ...newAssignment, day: d });
                             setFormError(null);
                           }}
                           className={`py-2 text-center text-xs font-bold rounded-xl transition-all border ${
                             isSelected 
                               ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20 scale-[1.02]' 
                               : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                           }`}
                           title={d}
                         >
                           {DAYS_SHORT[d] || d.slice(0, 3)}
                         </button>
                       );
                     })}
                   </div>
                </div>

                {/* 4. Horaires & Durée Dynamique */}
                <div className="space-y-2 bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/80">
                   <div className="flex items-center justify-between">
                     <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                       <Clock size={14} className="text-indigo-600" />
                       Horaires du cours
                     </span>
                     {currentSlotDuration && (
                       <span className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-lg border flex items-center gap-1 ${
                         currentSlotDuration.valid 
                           ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                           : 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse'
                       }`}>
                         ⚡ {currentSlotDuration.text}
                       </span>
                     )}
                   </div>

                   {/* Créneaux rapides populaires */}
                   <div className="flex flex-wrap gap-1.5 pb-1">
                     {QUICK_TIME_SLOTS.map(slot => (
                       <button
                         key={slot.label}
                         type="button"
                         onClick={() => {
                           setNewAssignment({
                             ...newAssignment,
                             start: slot.start,
                             end: slot.end
                           });
                           setFormError(null);
                         }}
                         className={`px-2 py-1 text-[10px] font-bold rounded-lg border transition-all ${
                           newAssignment.start === slot.start && newAssignment.end === slot.end
                             ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                             : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-indigo-600'
                         }`}
                       >
                         {slot.label}
                       </button>
                     ))}
                   </div>

                   <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                         <label htmlFor="start" className="text-[11px] font-bold text-slate-600">Début</label>
                         <input 
                           id="start" 
                           type="time" 
                           className="w-full px-3 py-2 bg-white text-slate-900 border-2 border-slate-200 focus:border-indigo-600 rounded-xl text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-mono" 
                           value={newAssignment.start} 
                           onChange={e => {setNewAssignment({...newAssignment, start: e.target.value}); setFormError(null);}} 
                         />
                      </div>
                      <div className="space-y-1">
                         <label htmlFor="end" className="text-[11px] font-bold text-slate-600">Fin</label>
                         <input 
                           id="end" 
                           type="time" 
                           className="w-full px-3 py-2 bg-white text-slate-900 border-2 border-slate-200 focus:border-indigo-600 rounded-xl text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-mono" 
                           value={newAssignment.end} 
                           onChange={e => {setNewAssignment({...newAssignment, end: e.target.value}); setFormError(null);}} 
                         />
                      </div>
                   </div>
                </div>

                {/* 5. Taux horaire & Rémunération */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="hourly_rate" className="text-xs font-bold text-emerald-800 tracking-tight flex items-center gap-1.5">
                      <TrendingUp size={14} className="text-emerald-600" />
                      Taux Horaire Spécifique (HTG/h)
                    </label>
                    {staff?.pay_type === 'Horaire' && staff?.amount && Number(staff.amount) > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setNewAssignment({ ...newAssignment, hourly_rate: String(staff.amount) });
                          setFormError(null);
                        }}
                        className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 underline"
                      >
                        Utiliser taux base ({staff.amount} HTG)
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input 
                      id="hourly_rate" 
                      type="number" 
                      step="0.01" 
                      className="w-full px-3.5 py-2.5 bg-emerald-50/60 border-2 border-emerald-200 rounded-xl text-xs font-black text-emerald-950 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/10 transition-all font-mono" 
                      value={newAssignment.hourly_rate} 
                      onChange={e => {setNewAssignment({...newAssignment, hourly_rate: e.target.value}); setFormError(null);}} 
                      placeholder={staff?.pay_type === 'Horaire' ? (staff?.amount?.toString() || "0.00") : "0.00"}
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-700/60 pointer-events-none">
                      HTG/h
                    </span>
                  </div>
                  <p className="text-[10px] text-emerald-700/80 font-medium px-1">
                    {staff?.pay_type === 'Horaire' 
                      ? `💡 Laissez vide ou à 0 pour utiliser le taux par défaut du contrat (${staff?.amount || 0} HTG/h).`
                      : `💡 Laissez à 0 si inclus dans le salaire fixe (${staff?.amount || 0} HTG). Sinon, indiquez le taux additionnel.`}
                  </p>
                </div>

                {/* Erreurs de validation visuelles */}
                {formError && (
                  <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3.5 flex items-start gap-2.5 animate-in fade-in slide-in-from-top-2">
                    <AlertTriangle className="text-rose-500 shrink-0 mt-0.5" size={16} />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-rose-900 mb-0.5">{formError.title}</h4>
                      <p className="text-[11px] text-rose-700 whitespace-pre-line leading-relaxed">
                        {formError.message}
                      </p>
                    </div>
                  </div>
                )}

                {/* Bouton d'action principal */}
                <button 
                  onClick={handleProcessAssignment} 
                  type="button"
                  className={`w-full py-3 rounded-2xl font-black text-xs tracking-tight transition-all flex items-center justify-center gap-2 active:scale-95 shadow-md ${
                    editingId 
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-600/20' 
                      : 'bg-slate-900 text-white hover:bg-slate-800 shadow-slate-900/20'
                  }`}
                >
                   {editingId ? <RefreshCw size={16} /> : <Plus size={16} />}
                   {editingId ? 'Valider la modification du créneau' : 'Ajouter au planning de cours'}
                </button>
              </div>
           </div>
        </div>

        {/* Tableau du Registre de Programme */}
        <div className="lg:col-span-7 space-y-6">
           <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden min-h-[500px] flex flex-col">
              <div className="px-6 py-5 bg-slate-50/80 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                 <div className="flex items-center gap-3">
                   <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
                    <Calendar size={18} />
                   </div>
                   <div>
                     <h3 className="font-bold text-slate-900 tracking-tight text-sm">Registre des Cours Attribués</h3>
                     <p className="text-[11px] text-slate-500">{assignments.length} affectation{assignments.length > 1 ? 's' : ''} active{assignments.length > 1 ? 's' : ''}</p>
                   </div>
                 </div>
                 <div className="flex items-center gap-3">
                   {canShowImportButton && (
                     <button
                       onClick={openImportModal}
                       disabled={isSaving}
                       className="px-3.5 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold text-xs rounded-xl hover:bg-indigo-100 transition-colors flex items-center gap-1.5 shadow-xs active:scale-95 transition-all"
                     >
                       <RefreshCw size={13} className={isSaving ? "animate-spin" : ""} />
                       Importer année préc.
                     </button>
                   )}
                   <div className="bg-slate-900 px-3.5 py-1.5 rounded-xl text-white font-black text-[10px] tracking-wider uppercase shadow-md shadow-slate-900/10 flex items-center gap-1.5">
                      <Clock size={12} className="text-indigo-400" />
                      {weeklyHours} H / SEMAINE
                   </div>
                 </div>
              </div>

              <div className="flex-1 overflow-x-auto custom-scrollbar">
                 <table className="w-full text-left min-w-[580px]">
                   <thead>
                     <tr className="bg-slate-900 text-white text-[10px] font-bold uppercase tracking-wider border-b border-slate-800">
                       <th scope="col" className="px-5 py-3">Planning</th>
                       <th scope="col" className="px-5 py-3">Cours & Classe</th>
                       <th scope="col" className="px-4 py-3 text-center">Volume</th>
                       <th scope="col" className="px-4 py-3 text-center">Taux/h</th>
                       <th scope="col" className="px-5 py-3 text-center">Actions</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                     {assignments.map((a) => {
                       const isBeingEdited = editingId === String(a.id);
                       return (
                         <tr 
                           key={String(a.id)} 
                           className={`group transition-colors duration-200 ${isBeingEdited ? 'bg-indigo-50/70 font-semibold' : 'hover:bg-slate-50/70'}`}
                         >
                           <td className="px-5 py-3.5">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 mb-0.5">
                                {a.day_of_week}
                              </span>
                              <div className="flex items-center gap-1 text-xs text-slate-500 font-medium font-mono mt-0.5">
                                <Clock size={12} className="text-slate-400" /> {a.start_time} - {a.end_time}
                              </div>
                           </td>
                           <td className="px-5 py-3.5">
                              <p className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                                {a.subject_name}
                              </p>
                              <span className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                                <Layers size={12} className="text-slate-400"/> {a.class_name}
                              </span>
                           </td>
                           <td className="px-4 py-3.5 text-center">
                             <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-black bg-slate-100 text-slate-700 font-mono">
                               {a.duration_hours}h
                             </span>
                           </td>
                           <td className="px-4 py-3.5 text-center">
                             <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-black border font-mono ${
                               a.hourly_rate > 0 || staff?.pay_type === 'Horaire' 
                                 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                 : 'bg-slate-50 text-slate-400 border-slate-200'
                             }`}>
                               {a.hourly_rate || (staff?.pay_type === 'Horaire' ? staff?.amount : 0) || 0} <span className="ml-1 text-[9px] opacity-70">HTG</span>
                             </span>
                           </td>
                           <td className="px-5 py-3.5">
                              <div className="flex items-center justify-center gap-1.5">
                                 <button 
                                  onClick={() => startEdit(a)} 
                                  className={`p-1.5 rounded-lg transition-colors active:scale-95 ${
                                    isBeingEdited 
                                      ? 'bg-indigo-600 text-white shadow-xs' 
                                      : 'text-amber-700 bg-amber-50 hover:bg-amber-500 hover:text-white border border-amber-200/60'
                                  }`}
                                  title="Modifier cette ligne"
                                  aria-label={`Modifier l'assignation pour ${a.subject_name}`}
                                 >
                                    <Edit2 size={15} />
                                 </button>
                                 <button 
                                  onClick={() => cloneAssignment(a)} 
                                  className="p-1.5 text-indigo-600 bg-indigo-50 hover:bg-indigo-600 hover:text-white rounded-lg transition-colors active:scale-95 border border-indigo-200/60"
                                  title="Dupliquer dans le formulaire"
                                  aria-label={`Dupliquer l'assignation pour ${a.subject_name}`}
                                 >
                                    <Copy size={15} />
                                 </button>
                                 <button 
                                  onClick={() => removeAssignment(String(a.id))} 
                                  type="button"
                                  className="p-1.5 text-rose-600 bg-rose-50 hover:bg-rose-600 hover:text-white rounded-lg transition-colors active:scale-95 border border-rose-200/60"
                                  title="Supprimer cette ligne"
                                  aria-label={`Supprimer l'assignation pour ${a.subject_name}`}
                                 >
                                    <Trash2 size={15} />
                                 </button>
                              </div>
                           </td>
                         </tr>
                       );
                     })}
                     {assignments.length === 0 && (
                       <tr>
                         <td colSpan={5} className="px-10 py-24 text-center text-slate-400 font-semibold text-xs leading-relaxed">
                           <BookOpen size={40} className="mx-auto mb-3 text-slate-300" />
                           <p className="font-bold text-slate-600 mb-1">Aucune affectation enregistrée</p>
                           <p className="text-[11px] text-slate-400">Utilisez le formulaire ci-contre pour ajouter les cours de cet enseignant.</p>
                         </td>
                       </tr>
                     )}
                   </tbody>
                 </table>
              </div>

              <div className="px-6 py-5 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                 <div className="flex items-center gap-2">
                   {saveStatus === 'success' && (
                     <div className="text-emerald-700 font-black text-xs uppercase tracking-wider bg-emerald-50 px-3.5 py-1.5 rounded-xl border border-emerald-200 flex items-center gap-1.5">
                       <CheckCircle2 size={14} /> Synchronisé avec succès
                     </div>
                   )}
                   {saveStatus === 'error' && (
                     <div className="text-rose-600 font-black text-xs uppercase tracking-wider bg-rose-50 px-3.5 py-1.5 rounded-xl border border-rose-200 flex items-center gap-1.5">
                       <AlertTriangle size={14} /> Échec de synchronisation
                     </div>
                   )}
                 </div>

                 <button 
                  disabled={isSaving || (!hasUnsavedChanges && assignments.length > 0 && saveStatus !== 'error')} 
                  onClick={handleSaveAll} 
                  type="button"
                  className={`w-full sm:w-auto px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 active:scale-95 shadow-md ${
                    hasUnsavedChanges 
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-600/20 animate-pulse' 
                      : 'bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 disabled:pointer-events-none'
                  }`}
                 >
                    {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    {isSaving ? 'Enregistrement en cours...' : hasUnsavedChanges ? 'Finaliser les Affectations (*)' : 'Affectations Enregistrées'}
                 </button>
              </div>
           </div>
        </div>
      </div>

      {/* Modal d'Importation Intelligente des Cours */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title={
          <div className="flex items-center gap-3 text-slate-900">
            <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl">
              <Copy size={22} />
            </div>
            <div className="text-left">
              <h3 className="text-lg font-black tracking-tight">Importation des Cours</h3>
              <p className="text-xs font-medium text-slate-500">
                Copie vérifiée d'une session/année vers l'année en préparation
              </p>
            </div>
          </div>
        }
        hideDefaultActions
        containerClassName="rounded-[2.5rem] max-w-2xl"
        contentClassName="p-8"
      >
        <div className="space-y-6 text-left">
          {/* Cartes d'Information Cible & Source */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Année Cible (Destination) */}
            <div className="p-4 bg-indigo-50/60 rounded-2xl border border-indigo-100">
              <label htmlFor="modal_target_year" className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block mb-1">
                🎯 Année Cible (Destination)
              </label>
              <select
                id="modal_target_year"
                value={selectedYearId}
                onChange={(e) => {
                  const newTargetId = e.target.value;
                  setSelectedYearId(newTargetId);
                  setActiveYearId(newTargetId);
                  const otherOpts = allAcademicYears.filter(y => y.id !== newTargetId);
                  let newSrcId = otherOpts.find(y => y.id === sourceYearId)?.id || otherOpts[0]?.id;
                  if (newSrcId) {
                    setSourceYearId(newSrcId);
                    analyzeSourceAssignments(newSrcId, newTargetId);
                  }
                }}
                className="w-full bg-white text-slate-900 text-xs font-bold px-3 py-2 rounded-xl border border-indigo-200 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                {allAcademicYears.map(y => {
                  const isAct = y.is_active || y.status === 'ACTIVE';
                  const isPrep = y.status === 'FUTURE' || y.status === 'PREPARATION';
                  const statusLabel = isAct ? 'Active' : isPrep ? 'En préparation' : 'Passée';
                  return (
                    <option key={y.id} value={y.id}>
                      {y.label} ({statusLabel})
                    </option>
                  );
                })}
              </select>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[10px] bg-indigo-100 text-indigo-700 font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                  <ShieldCheck size={10} /> Multi-Tenant Sécurisé
                </span>
              </div>
            </div>

            {/* Sélecteur d'Année Source */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <label htmlFor="modal_source_year" className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                📚 Année Source (Origine)
              </label>
              <select
                id="modal_source_year"
                value={sourceYearId}
                onChange={(e) => {
                  setSourceYearId(e.target.value);
                  analyzeSourceAssignments(e.target.value, selectedYearId);
                }}
                className="w-full bg-white text-slate-900 text-xs font-bold px-3 py-2 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                {allAcademicYears
                  .filter(y => y.id !== selectedYearId)
                  .map(y => {
                    const isAct = y.is_active || y.status === 'ACTIVE';
                    const isPrep = y.status === 'FUTURE' || y.status === 'PREPARATION';
                    const statusLabel = isAct ? 'Active' : isPrep ? 'En préparation' : 'Passée';
                    return (
                      <option key={y.id} value={y.id}>
                        {y.label} ({statusLabel})
                      </option>
                    );
                  })}
              </select>
            </div>
          </div>

          {/* Analyse & Pré-Vérification */}
          {importLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <Loader2 size={32} className="animate-spin text-indigo-600" />
              <p className="text-xs font-bold text-slate-500">Vérification des cours et détection des doublons...</p>
            </div>
          ) : importAnalysis.length === 0 ? (
            <div className="p-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-4 text-center">
              <div className="flex justify-center text-slate-400">
                <Info size={32} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-700">
                  Aucun cours trouvé pour ce professeur dans l'année source <span className="font-mono text-indigo-600 font-black">{allAcademicYears.find(y => y.id === sourceYearId)?.label}</span>.
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Vérifiez que le professeur avait des cours attribués dans cette année, ou inversez la source et la destination ci-dessous.
                </p>
              </div>

              {/* Bouton d'inversion intelligente */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    const newTargetId = sourceYearId;
                    const newSrcId = selectedYearId;
                    setSelectedYearId(newTargetId);
                    setActiveYearId(newTargetId);
                    setSourceYearId(newSrcId);
                    analyzeSourceAssignments(newSrcId, newTargetId);
                  }}
                  className="mx-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ArrowRightLeft size={14} />
                  Inverser : Définir {allAcademicYears.find(y => y.id === sourceYearId)?.label} comme Cible et {allAcademicYears.find(y => y.id === selectedYearId)?.label} comme Source
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-600">
                  Cours détectés dans l'année source : <span className="font-mono">{importAnalysis.length}</span>
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const readyIds = importAnalysis.filter(a => a.status === 'ready').map(a => a.source.id);
                      setSelectedImportIds(readyIds);
                    }}
                    className="text-[11px] text-indigo-600 font-bold hover:underline"
                  >
                    Sélectionner prêts
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => setSelectedImportIds([])}
                    className="text-[11px] text-slate-500 font-bold hover:underline"
                  >
                    Tout désélectionner
                  </button>
                </div>
              </div>

              {/* Liste interactive des cours */}
              <div className="max-h-60 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {importAnalysis.map((item) => {
                  const src = item.source;
                  const isChecked = selectedImportIds.includes(src.id);
                  const isReady = item.status === 'ready';

                  return (
                    <div
                      key={src.id}
                      onClick={() => {
                        if (!isReady) return;
                        setSelectedImportIds(prev => 
                          prev.includes(src.id) ? prev.filter(id => id !== src.id) : [...prev, src.id]
                        );
                      }}
                      className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                        !isReady 
                          ? 'bg-slate-50/70 border-slate-200 opacity-60 cursor-not-allowed'
                          : isChecked
                            ? 'bg-indigo-50/80 border-indigo-200 shadow-sm cursor-pointer'
                            : 'bg-white border-slate-200 hover:border-slate-300 cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={!isReady}
                          onChange={() => {}}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                        <div>
                          <p className="text-xs font-bold text-slate-900">{src.subject_name}</p>
                          <p className="text-[11px] text-slate-500 font-medium">
                            {src.class_name} • {src.day_of_week} ({src.start_time.substring(0,5)} - {src.end_time.substring(0,5)})
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        {item.status === 'ready' && (
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-full border border-emerald-200">
                            🟢 Importable
                          </span>
                        )}
                        {item.status === 'invalid_tenant' && (
                          <span className="text-[10px] bg-red-100 text-red-800 font-bold px-2.5 py-1 rounded-full border border-red-200" title={item.statusMessage}>
                            ⛔ Autre Établissement
                          </span>
                        )}
                        {item.status === 'duplicate' && (
                          <span className="text-[10px] bg-slate-200 text-slate-700 font-bold px-2.5 py-1 rounded-full">
                            ⚪ Déjà attribué
                          </span>
                        )}
                        {item.status === 'time_conflict' && (
                          <span className="text-[10px] bg-rose-100 text-rose-800 font-bold px-2.5 py-1 rounded-full border border-rose-200" title={item.statusMessage}>
                            ⚠️ Conflit d'horaire
                          </span>
                        )}
                        {item.status === 'class_missing' && (
                          <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2.5 py-1 rounded-full border border-amber-200">
                            ⚠️ Classe absente
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Boutons d'Action */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsImportModalOpen(false)}
              className="px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all"
            >
              Annuler
            </button>
            <button
              type="button"
              disabled={selectedImportIds.length === 0 || importLoading}
              onClick={handleExecuteImport}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-40 flex items-center gap-2 active:scale-95"
            >
              <Copy size={14} />
              Lancer l'importation ({selectedImportIds.length} cours)
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
};

export default StaffAssignmentView;
