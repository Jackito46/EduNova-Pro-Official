import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  PenTool, CheckCircle2, Clock, Calendar, BookOpen, 
  AlertCircle, Loader2, Save, History, Search, Filter,
  ChevronRight, Info, ShieldCheck, Users, RefreshCw, Check, Sparkles, X, ChevronLeft,
  Building2, GraduationCap, Briefcase, FileText, CheckCheck, CalendarDays, Eye,
  Printer, ArrowRight, UserCheck, CheckSquare, Square
} from 'lucide-react';
import { supabase } from '../supabase';
import { UserProfile, SchoolType } from '../types';
import { toast } from 'sonner';
import { AuditLogger } from '../utils/auditLogger';
import { formatStudentName } from '../utils/formatters';
import { useSchool } from '../contexts/SchoolContext';

interface CourseSignature {
  id?: string;
  class_id: string;
  subject_id: string;
  staff_id: string;
  date: string;
  start_time: string;
  end_time: string;
  topic_covered: string;
  homework?: string;
  signature_status: 'SIGNED' | 'VALIDATED' | 'REJECTED';
  class_name?: string;
  subject_name?: string;
  duration_hours?: number;
  students_present_count?: number;
  signed_at?: string;
  campus_id?: string;
  staff?: {
    first_name: string;
    last_name: string;
    campus_id?: string;
  };
}

const CourseSignatureView: React.FC<{ user: UserProfile }> = ({ user }) => {
  const { school, campuses, currentCampusId } = useSchool();
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [myAssignments, setMyAssignments] = useState<any[]>([]);
  const [mySignatures, setMySignatures] = useState<CourseSignature[]>([]);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [currentStaffProfile, setCurrentStaffProfile] = useState<any | null>(null);
  const [activeYearId, setActiveYearId] = useState<string | null>(null);
  const [selectedCampusFilter, setSelectedCampusFilter] = useState<string>(currentCampusId || 'ALL');
  
  // Form state for new signature
  const [selectedAssignment, setSelectedAssignment] = useState<any | null>(null);
  const [topic, setTopic] = useState('');
  const [homework, setHomework] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [presentCount, setPresentCount] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0]
  );
  const [targetStaffId, setTargetStaffId] = useState<string>('');
  const [allStaff, setAllStaff] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<Record<string, boolean>>({});
  const [showAttendance, setShowAttendance] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [totalEnrolled, setTotalEnrolled] = useState<number>(0);
  const [officialAttendanceSource, setOfficialAttendanceSource] = useState<'SHEET'|'ENROLLMENT'|'NONE'>('NONE');
  
  // History & Filters
  const [historyFilter, setHistoryFilter] = useState<'ALL' | 'SIGNED' | 'VALIDATED' | 'REJECTED'>('ALL');
  const [historySearch, setHistorySearch] = useState('');
  const [selectedSignatureDetails, setSelectedSignatureDetails] = useState<CourseSignature | null>(null);

  const isAdmin = user.role === 'SCHOOL_ADMIN' || user.role === 'DIRECTOR' || user.role === 'SUPER_ADMIN' || user.role === 'SECRETARY';

  // Institutional Category Detection (Multi-Tenant)
  const isUniversity = (school?.school_type as any) === SchoolType.UNIVERSITY || (school?.school_type as any) === 'UNIVERSITY';
  const isProfessional = (school?.school_type as any) === SchoolType.PROFESSIONAL || (school?.school_type as any) === 'PROFESSIONAL';

  const schoolCategoryBadge = useMemo(() => {
    if (isUniversity) {
      return {
        label: 'Enseignement Supérieur / Universitaire',
        icon: GraduationCap,
        color: 'bg-indigo-500/20 text-indigo-200 border-indigo-400/30',
        teacherRole: 'Professeur / Intervenant',
        sessionTerm: 'Séance',
        sessionsTerm: 'Séances',
        classTerm: 'Promotion / Filière',
        moduleTerm: 'Cours Magistral / TD / TP'
      };
    }
    if (isProfessional) {
      return {
        label: 'Formation Professionnelle & Technique',
        icon: Briefcase,
        color: 'bg-amber-500/20 text-amber-200 border-amber-400/30',
        teacherRole: 'Formateur / Tuteur',
        sessionTerm: 'Module',
        sessionsTerm: 'Modules',
        classTerm: 'Filière / Atelier',
        moduleTerm: 'Session Pratique'
      };
    }
    return {
      label: 'Enseignement Général & Secondaire',
      icon: BookOpen,
      color: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30',
      teacherRole: 'Enseignant',
      sessionTerm: 'Cours',
      sessionsTerm: 'Cours',
      classTerm: 'Classe',
      moduleTerm: 'Matière'
    };
  }, [isUniversity, isProfessional]);

  const terms = useMemo(() => {
    if (isUniversity) {
      return {
        title: 'Cahier de Textes & Émargement Universitaire',
        subtitle: 'Validation numérique des heures dispensées, émargement des professeurs et vacataires, suivi des CM/TD/TP et avancement des programmes.',
        formTitle: 'Feuille d\'Émargement & Cahier de Textes',
        formDesc: 'Renseignez le contenu pédagogique de la séance, les compétences abordées et validez l\'émargement.',
        topicLabel: 'Contenu Pédagogique du Cours / Thèmes & TD Abordés',
        topicPlaceholder: 'Ex: Chapitre 4 : Algèbre linéaire et diagonalisation des matrices, résolution des exercices 1 à 6...',
        homeworkLabel: 'Travaux Dirigés / Lectures & Devoirs (Prochaine séance)',
        homeworkPlaceholder: 'Ex: Préparer le cas pratique N°2 et finaliser le rapport de TP avant le prochain cours...',
        ctaSign: 'Signer & Valider la Séance',
        emptyDay: 'Aucune séance programmée',
        emptyDayDesc: 'Aucune séance magistrale ou TD n\'est inscrite à l\'emploi du temps pour cette journée.',
      };
    }
    if (isProfessional) {
      return {
        title: 'Journal de Bord & Émargement Professionnel',
        subtitle: 'Validation des heures de formation, suivi des modules pratiques en atelier, émargement des formateurs et contrôle d\'assiduité.',
        formTitle: 'Fiche d\'Émargement de Module',
        formDesc: 'Consignez les modules techniques réalisés, les ateliers pratiques et validez votre intervention.',
        topicLabel: 'Contenu du Module & Compétences Pratiques Traitées',
        topicPlaceholder: 'Ex: Module 3 : Câblage des armoires électriques, mise en conformité et tests sous tension...',
        homeworkLabel: 'Tâches Pratiques / Fiches Techniques à Rendre',
        homeworkPlaceholder: 'Ex: Compléter le schéma unifilaire et réviser la norme NFC 15-100...',
        ctaSign: 'Signer & Valider le Module',
        emptyDay: 'Aucun module programmé',
        emptyDayDesc: 'Aucune session ou atelier pratique n\'est inscrit au planning pour cette journée.',
      };
    }
    return {
      title: 'Cahier de Textes & Émargement',
      subtitle: 'Signature des cours dispensés, validation des heures effectuées, suivi du programme scolaire et contrôle des présences.',
      formTitle: 'Formulaire d\'Émargement de Cours',
      formDesc: 'Renseignez le contenu pédagogique et validez l\'émargement de votre cours.',
      topicLabel: 'Contenu Dispensé / Titre du Chapitre',
      topicPlaceholder: 'Ex: Chapitre 3 - Équations du second degré, exercices d\'application N°4 et N°5...',
      homeworkLabel: 'Devoirs & Travail à Faire (Pour le prochain cours)',
      homeworkPlaceholder: 'Ex: Exercices 12 et 14 page 86 du manuel...',
      ctaSign: 'Signer & Enregistrer le Cours',
      emptyDay: 'Aucun cours programmé',
      emptyDayDesc: 'Aucun cours n\'est inscrit à l\'emploi du temps pour cette journée.',
    };
  }, [isUniversity, isProfessional]);

  const todayStr = useMemo(() => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().split('T')[0];
  }, []);

  const isToday = selectedDate === todayStr;

  const selectedDateObj = useMemo(() => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    return new Date(y, m - 1, d);
  }, [selectedDate]);

  const selectedDayName = useMemo(() => {
    const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    return days[selectedDateObj.getDay()];
  }, [selectedDateObj]);

  const formattedSelectedDate = useMemo(() => {
    return selectedDateObj.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }, [selectedDateObj]);

  const shiftDate = (days: number) => {
    const current = new Date(selectedDate + 'T00:00:00');
    current.setDate(current.getDate() + days);
    setSelectedDate(current.toISOString().split('T')[0]);
  };

  const getCampusName = useCallback((campusId?: string | null) => {
    if (!campusId || !campuses || campuses.length === 0) return null;
    const found = campuses.find(c => c.id === campusId);
    return found ? found.name : null;
  }, [campuses]);

  // Main Data Fetcher
  const fetchTeacherContext = useCallback(async () => {
    setLoading(true);
    try {
      const activeCampusId = selectedCampusFilter !== 'ALL' ? selectedCampusFilter : (user.campus_id || currentCampusId);
      
      let activeClassIds: string[] = [];
      if (activeCampusId && activeCampusId !== 'ALL') {
        const { data: campusClasses } = await supabase
          .from('classes')
          .select('id')
          .eq('school_id', user.school_id)
          .eq('campus_id', activeCampusId);
        activeClassIds = (campusClasses || []).map(c => c.id);
      }

      // 0. Get active academic year
      const { data: years } = await supabase
        .from('academic_years')
        .select('id')
        .eq('school_id', user.school_id)
        .or('status.eq.ACTIVE,is_active.eq.true')
        .limit(1);
        
      if (years && years.length > 0) {
        setActiveYearId(years[0].id);
      }

      // 1. Get staff ID (for current user)
      const { data: staffData } = await supabase
        .from('staff')
        .select('id, first_name, last_name, email, role, campus_id')
        .eq('email', user.email)
        .maybeSingle();
      
      if (staffData) {
        setStaffId(staffData.id);
        setCurrentStaffProfile(staffData);
      }

      // 2. If admin, fetch all active staff
      if (isAdmin) {
        let staffListRes;
        try {
          const query = supabase
            .from('staff')
            .select(`
              id, 
              first_name, 
              last_name,
              role,
              campus_id,
              staff_assignments!inner(id, academic_year_id)
            `)
            .eq('school_id', user.school_id)
            .eq('status', 'Actif');
          
          if (activeCampusId && activeCampusId !== 'ALL') {
            query.eq('campus_id', activeCampusId);
          }

          const yearId = years && years.length > 0 ? years[0].id : null;
          let finalQuery = query;
          if (yearId) {
            finalQuery = finalQuery.or(`academic_year_id.eq.${yearId},academic_year_id.is.null`, { foreignTable: 'staff_assignments' });
          } else {
            finalQuery = finalQuery.is('staff_assignments.academic_year_id', null);
          }
          const { data, error } = await finalQuery;
          
          if (error && (error.code === '42703' || error.message?.includes('academic_year_id'))) {
            staffListRes = await supabase
              .from('staff')
              .select(`
                id, 
                first_name, 
                last_name,
                role,
                campus_id,
                staff_assignments!inner(id)
              `)
              .eq('school_id', user.school_id)
              .eq('status', 'Actif');
          } else {
            staffListRes = { data, error };
          }
        } catch (e) {
          staffListRes = await supabase
            .from('staff')
            .select(`
              id, 
              first_name, 
              last_name,
              role,
              campus_id,
              staff_assignments!inner(id)
            `)
            .eq('school_id', user.school_id)
            .eq('status', 'Actif');
        }
        
        const uniqueStaff = Array.from(new Map(staffListRes.data?.map((s: any) => [s.id, s])).values());
        setAllStaff(uniqueStaff || []);
      }

      // 3. Get assignments (Schedule)
      const effectiveStaffId = isAdmin && targetStaffId ? targetStaffId : staffData?.id;
      
      if (effectiveStaffId) {
        let assignmentsRes;
        try {
          const query = supabase.from('staff_assignments')
            .select('*')
            .eq('staff_id', effectiveStaffId);
          
          const yearId = years && years.length > 0 ? years[0].id : null;
          let finalQuery = query;
          if (yearId) {
            finalQuery = finalQuery.or(`academic_year_id.eq.${yearId},academic_year_id.is.null`);
          } else {
            finalQuery = finalQuery.is('academic_year_id', null);
          }
          
          if (user.school_id) {
            finalQuery = finalQuery.or(`school_id.eq.${user.school_id},school_id.is.null`);
          } else {
            finalQuery = finalQuery.is('school_id', null);
          }

          const { data, error } = await finalQuery;
          
          if (error && (error.code === '42703' || error.message?.includes('academic_year_id'))) {
            assignmentsRes = await supabase.from('staff_assignments')
              .select('*')
              .eq('staff_id', effectiveStaffId)
              .eq('school_id', user.school_id);
          } else {
            assignmentsRes = { data, error };
          }
        } catch (e) {
          assignmentsRes = await supabase.from('staff_assignments')
            .select('*')
            .eq('staff_id', effectiveStaffId)
            .eq('school_id', user.school_id);
        }
        
        if (assignmentsRes.error) throw assignmentsRes.error;
        let finalAssignments = assignmentsRes.data || [];
        if (activeCampusId && activeCampusId !== 'ALL' && activeClassIds.length > 0) {
          finalAssignments = finalAssignments.filter((a: any) => activeClassIds.includes(a.class_id));
        }
        setMyAssignments(finalAssignments);

        // 4. Get recent signatures
        let signaturesRes;
        try {
          const query = supabase.from('course_signatures')
            .select(`
              *,
              class:classes(name, campus_id),
              subject:subjects(name),
              staff:staff(first_name, last_name, campus_id)
            `)
            .eq('staff_id', effectiveStaffId);
            
          if (user.school_id) {
            query.eq('school_id', user.school_id);
          }

          signaturesRes = await query.order('date', { ascending: false }).limit(30);
        } catch (e) {
          signaturesRes = await supabase.from('course_signatures')
            .select('*')
            .eq('staff_id', effectiveStaffId)
            .order('date', { ascending: false }).limit(30);
        }
        
        if (signaturesRes.data) {
          const formatted = signaturesRes.data.map((s: any) => {
            let dur = 0;
            if (s.start_time && s.end_time) {
              const [sh, sm] = s.start_time.split(':').map(Number);
              const [eh, em] = s.end_time.split(':').map(Number);
              dur = Math.max(0, ((eh * 60 + em) - (sh * 60 + sm)) / 60);
            }
            return {
              ...s,
              duration_hours: s.duration_hours || Number(dur.toFixed(2)),
              students_present_count: s.students_present_count ?? s.present_students_count ?? null,
              class_name: s.class?.name || s.class_name,
              subject_name: s.subject?.name || s.subject_name,
              campus_id: s.class?.campus_id || s.staff?.campus_id
            };
          });
          setMySignatures(formatted);
        }
      }
    } catch (err: any) {
      console.error("Error loading teacher context:", err);
      toast.error("Erreur lors du chargement des données d'émargement");
    } finally {
      setLoading(false);
    }
  }, [user.school_id, user.email, user.campus_id, currentCampusId, selectedCampusFilter, isAdmin, targetStaffId]);

  useEffect(() => {
    fetchTeacherContext();
  }, [fetchTeacherContext]);

  // Load students for attendance when assignment changes
  useEffect(() => {
    if (!selectedAssignment?.class_id) {
      setStudents([]);
      setAttendance({});
      setShowAttendance(false);
      setTotalEnrolled(0);
      setOfficialAttendanceSource('NONE');
      return;
    }

    const loadClassStudents = async () => {
      try {
        const { data: studentsData } = await supabase
          .from('students')
          .select('id, first_name, last_name, gender, campus_id')
          .eq('class_id', selectedAssignment.class_id)
          .eq('school_id', user.school_id)
          .eq('status', 'ACTIF')
          .order('last_name');

        const studentList = studentsData || [];
        setStudents(studentList);
        setTotalEnrolled(studentList.length);

        // Check if official attendance sheet exists for this class & date
        const { data: sheetData } = await supabase
          .from('attendance_sheets')
          .select('id')
          .eq('class_id', selectedAssignment.class_id)
          .eq('date', selectedDate)
          .maybeSingle();

        if (sheetData) {
          const { data: records } = await supabase
            .from('attendance_records')
            .select('student_id, is_present')
            .eq('sheet_id', sheetData.id);

          if (records && records.length > 0) {
            const map: Record<string, boolean> = {};
            let presentCounter = 0;
            studentList.forEach(s => {
              const rec = records.find(r => r.student_id === s.id);
              const isPresent = rec ? rec.is_present : true;
              map[s.id] = isPresent;
              if (isPresent) presentCounter++;
            });
            setAttendance(map);
            setPresentCount(presentCounter.toString());
            setOfficialAttendanceSource('SHEET');
            return;
          }
        }

        // Default: mark all present
        const defaultMap: Record<string, boolean> = {};
        studentList.forEach(s => defaultMap[s.id] = true);
        setAttendance(defaultMap);
        setPresentCount(studentList.length.toString());
        setOfficialAttendanceSource(studentList.length > 0 ? 'ENROLLMENT' : 'NONE');

      } catch (e) {
        console.error("Error loading students for attendance:", e);
      }
    };

    loadClassStudents();
  }, [selectedAssignment, selectedDate, user.school_id]);

  const handleSelectAssignment = (assignment: any) => {
    setSelectedAssignment(assignment);
    setStartTime(assignment.start_time.substring(0, 5));
    setEndTime(assignment.end_time.substring(0, 5));
    setTopic('');
    setHomework('');
  };

  const toggleStudentAttendance = (studentId: string) => {
    setAttendance(prev => {
      const next = { ...prev, [studentId]: !prev[studentId] };
      const newPresentCount = Object.values(next).filter(Boolean).length;
      setPresentCount(newPresentCount.toString());
      return next;
    });
  };

  const setAllStudentsAttendance = (isPresent: boolean) => {
    const next: Record<string, boolean> = {};
    students.forEach(s => {
      next[s.id] = isPresent;
    });
    setAttendance(next);
    setPresentCount(isPresent ? students.length.toString() : '0');
  };

  const handleSubmitSignature = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssignment) {
      toast.error("Veuillez sélectionner une séance à émarger");
      return;
    }

    if (!topic.trim()) {
      toast.error("Veuillez indiquer le contenu pédagogique dispensé");
      return;
    }

    const effectiveStaff = isAdmin && targetStaffId ? targetStaffId : staffId;
    if (!effectiveStaff) {
      toast.error("Compte enseignant non identifié.");
      return;
    }

    setSigning(true);
    try {
      // 1. Calculate duration in hours
      const [sh, sm] = startTime.split(':').map(Number);
      const [eh, em] = endTime.split(':').map(Number);
      const durationHours = Math.max(0.5, ((eh * 60 + em) - (sh * 60 + sm)) / 60);

      const payload: any = {
        school_id: user.school_id,
        staff_id: effectiveStaff,
        class_id: selectedAssignment.class_id,
        subject_id: selectedAssignment.subject_id,
        date: selectedDate,
        start_time: startTime,
        end_time: endTime,
        topic_covered: topic.trim() + (homework.trim() ? `\n[Devoirs / Tâches]: ${homework.trim()}` : ''),
        signature_status: 'SIGNED'
      };

      if (presentCount) {
        payload.present_students_count = parseInt(presentCount);
      }
      if (activeYearId) {
        payload.academic_year_id = activeYearId;
      }

      const { data, error } = await supabase
        .from('course_signatures')
        .insert([payload])
        .select()
        .single();

      if (error) throw error;

      AuditLogger.log({
        school_id: user.school_id,
        user_id: user.id,
        action: 'CREATE',
        entity_type: 'course_signature',
        entity_id: data.id,
        details: { 
          class_id: selectedAssignment.class_id, 
          subject: selectedAssignment.subject_name,
          topic,
          date: selectedDate
        }
      });

      toast.success("Émargement numérique certifié et enregistré avec succès !");
      setSelectedAssignment(null);
      setTopic('');
      setHomework('');
      await fetchTeacherContext();

    } catch (err: any) {
      console.error("Signature error:", err);
      toast.error(err.message || "Erreur lors de l'enregistrement de l'émargement");
    } finally {
      setSigning(false);
    }
  };

  // KPI Calculations
  const kpis = useMemo(() => {
    const totalSessions = mySignatures.length;
    const validatedSessions = mySignatures.filter(s => s.signature_status === 'VALIDATED').length;
    const totalHours = mySignatures.reduce((acc, s) => acc + (Number(s.duration_hours) || 0), 0);
    const avgAttendancePercent = totalSessions > 0
      ? Math.round((validatedSessions / totalSessions) * 100)
      : 100;
    
    return {
      totalSessions,
      validatedSessions,
      totalHours: totalHours.toFixed(1),
      avgAttendancePercent
    };
  }, [mySignatures]);

  // Assignments corresponding to selected day
  const todayAssignments = useMemo(() => {
    return myAssignments.filter(a => a.day_of_week === selectedDayName);
  }, [myAssignments, selectedDayName]);

  // Filtered Signatures History
  const filteredHistory = useMemo(() => {
    return mySignatures.filter(s => {
      if (historyFilter !== 'ALL' && s.signature_status !== historyFilter) return false;
      if (historySearch) {
        const search = historySearch.toLowerCase();
        return (s.class_name || '').toLowerCase().includes(search) ||
               (s.subject_name || '').toLowerCase().includes(search) ||
               (s.topic_covered || '').toLowerCase().includes(search);
      }
      return true;
    });
  }, [mySignatures, historyFilter, historySearch]);

  const filteredStudents = useMemo(() => {
    if (!studentSearch) return students;
    const sLow = studentSearch.toLowerCase();
    return students.filter(st => 
      `${st.first_name} ${st.last_name}`.toLowerCase().includes(sLow)
    );
  }, [students, studentSearch]);

  const selectedStaffName = useMemo(() => {
    if (isAdmin && targetStaffId) {
      const found = allStaff.find(s => s.id === targetStaffId);
      if (found) return formatStudentName(found.last_name, found.first_name).fullName;
    }
    if (currentStaffProfile) {
      return formatStudentName(currentStaffProfile.last_name, currentStaffProfile.first_name).fullName;
    }
    return (user as any).fullName || user.full_name || user.email;
  }, [isAdmin, targetStaffId, allStaff, currentStaffProfile, user]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      
      {/* Header Banner - International & Modern Multi-Tenant */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 sm:p-6 rounded-3xl shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Title & Institutional Scope */}
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shadow-inner shrink-0 mt-0.5 sm:mt-0">
              <PenTool className="w-6 h-6" />
            </div>
            
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                  {terms.title}
                </h1>
                
                {/* Institutional Category Badge */}
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[11px] font-extrabold ${schoolCategoryBadge.color}`}>
                  <schoolCategoryBadge.icon size={13} className="shrink-0" />
                  <span>{schoolCategoryBadge.label}</span>
                </span>
              </div>
              
              <p className="text-slate-300 text-xs font-normal leading-relaxed max-w-3xl">
                {terms.subtitle}
              </p>
            </div>
          </div>

          {/* Multi-Campus / Annexe Selector & Teacher Switcher (Admins) */}
          <div className="flex items-center gap-2.5 flex-wrap self-start lg:self-center">
            
            {/* Campus Switcher */}
            {campuses && campuses.length > 0 && (
              <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-white/15 text-xs text-indigo-200">
                <Building2 size={14} className="text-indigo-400 shrink-0" />
                <select
                  aria-label="Filtrer par Campus ou Annexe"
                  value={selectedCampusFilter}
                  onChange={(e) => setSelectedCampusFilter(e.target.value)}
                  className="bg-transparent text-white font-bold outline-none cursor-pointer pr-1 text-xs"
                >
                  <option value="ALL" className="text-slate-900">Tous les Campus / Annexes</option>
                  {campuses.map(c => (
                    <option key={c.id} value={c.id} className="text-slate-900">
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Admin Target Teacher Switcher */}
            {isAdmin && (
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-white/15 text-xs text-white">
                <ShieldCheck size={15} className="text-amber-400 shrink-0" />
                <select
                  aria-label="Sélectionner l'enseignant pour émargement"
                  value={targetStaffId}
                  onChange={(e) => setTargetStaffId(e.target.value)}
                  className="bg-transparent text-white font-bold outline-none cursor-pointer max-w-[200px] truncate text-xs"
                >
                  <option value="" className="text-slate-900">-- Mes cours personnels --</option>
                  {allStaff.map(s => {
                    const campus = getCampusName(s.campus_id);
                    return (
                      <option key={s.id} value={s.id} className="text-slate-900">
                        {formatStudentName(s.last_name, s.first_name).fullName} {campus ? `(${campus})` : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Selected Teacher Profile Context Pill */}
        <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between gap-3 text-xs flex-wrap">
          <div className="flex items-center gap-2 text-slate-300">
            <div className="w-6 h-6 rounded-full bg-indigo-500/30 border border-indigo-400/40 flex items-center justify-center font-black text-[10px] text-white">
              {selectedStaffName.charAt(0)}
            </div>
            <span className="font-medium">
              Titulaire actif : <strong className="text-white font-bold">{selectedStaffName}</strong>
            </span>
            <span className="bg-indigo-500/20 text-indigo-300 text-[10px] font-bold px-2 py-0.5 rounded-md border border-indigo-400/20">
              {schoolCategoryBadge.teacherRole}
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <Clock size={13} className="text-indigo-400" />
            <span>Signature Numérique Certifiée SHA-256</span>
          </div>
        </div>
      </div>

      {/* Modern KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold shrink-0 border border-indigo-100">
            <CheckSquare size={18} />
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">{terms.title.includes('Universitaire') ? 'Séances Signées' : 'Cours Émargés'}</p>
            <p className="text-lg font-black text-slate-900 mt-0.5">{kpis.totalSessions}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shrink-0 border border-emerald-100">
            <Clock size={18} />
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Volume Horaire</p>
            <p className="text-lg font-black text-slate-900 mt-0.5">{kpis.totalHours} <span className="text-xs font-bold text-slate-500">heures</span></p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold shrink-0 border border-amber-100">
            <ShieldCheck size={18} />
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Validation Admin</p>
            <p className="text-lg font-black text-slate-900 mt-0.5">{kpis.validatedSessions} <span className="text-xs font-bold text-slate-400">/ {kpis.totalSessions}</span></p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold shrink-0 border border-purple-100">
            <Users size={18} />
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Taux de Validation</p>
            <p className="text-lg font-black text-slate-900 mt-0.5">{kpis.avgAttendancePercent}%</p>
          </div>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Schedule & Assignment Selection */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-4 sm:p-5 space-y-4">
            
            {/* Ergonomic Date Navigator */}
            <div className="space-y-2.5 pb-3 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-indigo-600" />
                  <h3 className="font-bold text-slate-900 text-xs sm:text-sm">Date de la Séance</h3>
                </div>
                
                {/* Shift buttons */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => shiftDate(-1)}
                    className="p-1 hover:bg-white hover:shadow-xs rounded-lg text-slate-600 transition-all"
                    title="Jour précédent"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedDate(todayStr)}
                    className={`px-2 py-0.5 text-[10px] font-bold rounded-lg transition-all ${
                      isToday ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-white'
                    }`}
                  >
                    Aujourd'hui
                  </button>
                  <button
                    type="button"
                    onClick={() => shiftDate(1)}
                    className="p-1 hover:bg-white hover:shadow-xs rounded-lg text-slate-600 transition-all"
                    title="Jour suivant"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>

              {/* Date Input with formatted preview */}
              <div className="flex items-center justify-between gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-200">
                <span className="text-xs font-extrabold text-slate-800 capitalize pl-1">
                  {formattedSelectedDate}
                </span>
                <input
                  aria-label="Sélectionner une date précise"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-2.5 py-1 text-xs font-bold bg-white border border-slate-200 rounded-xl text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>

            {/* Timetable Subhead */}
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider">
                Planning du {selectedDayName}
              </span>
              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
                {todayAssignments.length} {todayAssignments.length <= 1 ? schoolCategoryBadge.sessionTerm.toLowerCase() : schoolCategoryBadge.sessionsTerm.toLowerCase()}
              </span>
            </div>

            {/* List of Sessions for Selected Date */}
            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                Chargement des créneaux de cours...
              </div>
            ) : todayAssignments.length === 0 ? (
              <div className="py-10 text-center bg-slate-50/70 rounded-2xl border border-dashed border-slate-200 px-4 space-y-2">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-500 flex items-center justify-center mx-auto border border-indigo-100">
                  <CalendarDays className="w-5 h-5" />
                </div>
                <p className="text-xs font-extrabold text-slate-800">{terms.emptyDay}</p>
                <p className="text-[11px] text-slate-500 max-w-xs mx-auto leading-relaxed">
                  {terms.emptyDayDesc}
                </p>
                <div className="pt-2 flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedDate(todayStr)}
                    className="px-3 py-1 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 shadow-xs"
                  >
                    Revenir à Aujourd'hui
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                {todayAssignments.map((assignment) => {
                  const isSelected = selectedAssignment?.id === assignment.id;
                  const alreadySigned = mySignatures.some(
                    s => s.class_id === assignment.class_id && 
                         s.subject_id === assignment.subject_id && 
                         s.date === selectedDate
                  );

                  return (
                    <button
                      key={assignment.id}
                      type="button"
                      onClick={() => handleSelectAssignment(assignment)}
                      className={`w-full text-left p-3.5 sm:p-4 rounded-2xl border transition-all relative group flex items-start justify-between ${
                        isSelected 
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-600/20 ring-2 ring-indigo-600' 
                          : alreadySigned
                          ? 'bg-emerald-50/70 border-emerald-200 hover:border-emerald-300 text-slate-900'
                          : 'bg-white border-slate-200 hover:border-indigo-300 text-slate-900 hover:shadow-sm'
                      }`}
                    >
                      <div className="space-y-1.5 min-w-0 pr-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                            isSelected 
                              ? 'bg-indigo-500/40 text-white' 
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            {assignment.start_time.substring(0, 5)} - {assignment.end_time.substring(0, 5)}
                          </span>

                          <span className={`text-[10px] font-extrabold uppercase tracking-wider ${
                            isSelected ? 'text-indigo-200' : 'text-indigo-600'
                          }`}>
                            {assignment.class_name}
                          </span>
                        </div>

                        <h4 className={`font-black text-sm truncate ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                          {assignment.subject_name}
                        </h4>

                        <div className={`flex items-center gap-2 text-[11px] ${isSelected ? 'text-indigo-200' : 'text-slate-500'}`}>
                          <span>{assignment.duration_hours}h dispensée(s)</span>
                          {assignment.room && <span>• Salle {assignment.room}</span>}
                        </div>
                      </div>

                      <div className="shrink-0 pt-0.5">
                        {alreadySigned ? (
                          <span className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-1 rounded-xl border ${
                            isSelected 
                              ? 'bg-white text-emerald-700 border-white' 
                              : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                          }`}>
                            <CheckCircle2 size={12} /> Émargé
                          </span>
                        ) : (
                          <span className={`p-1.5 rounded-xl transition-all ${
                            isSelected ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-400 group-hover:text-indigo-600'
                          }`}>
                            <ChevronRight size={16} />
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Signature Form & Details */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold shrink-0 border border-indigo-100">
                  <PenTool size={18} />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm">{terms.formTitle}</h3>
                  <p className="text-xs text-slate-500">{terms.formDesc}</p>
                </div>
              </div>
            </div>

            {selectedAssignment ? (
              <form onSubmit={handleSubmitSignature} className="p-5 sm:p-6 space-y-5">
                
                {/* Selected Course Recap Card */}
                <div className="p-4 bg-indigo-50/80 rounded-2xl border border-indigo-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-extrabold uppercase text-indigo-700 bg-indigo-100/70 px-2 py-0.5 rounded-md">
                        {selectedAssignment.class_name}
                      </span>
                      <span className="text-[10px] font-bold text-slate-500">
                        {formattedSelectedDate}
                      </span>
                    </div>
                    <h4 className="font-black text-slate-900 text-base">{selectedAssignment.subject_name}</h4>
                    <p className="text-xs text-slate-600 flex items-center gap-1.5 pt-0.5">
                      <Clock size={13} className="text-indigo-500 shrink-0" /> 
                      <span>Horaires : {startTime} à {endTime} ({selectedAssignment.duration_hours}h)</span>
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedAssignment(null)}
                    className="text-xs font-bold text-slate-600 hover:text-slate-900 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-xs hover:bg-slate-50 transition-all"
                  >
                    Changer de cours
                  </button>
                </div>

                {/* Topic Covered Field */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                    {terms.topicLabel} <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder={terms.topicPlaceholder}
                    className="w-full p-3.5 text-xs font-medium text-slate-900 bg-slate-50/60 border border-slate-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400 leading-relaxed"
                  />
                </div>

                {/* Homework / Next Session Field */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span>{terms.homeworkLabel}</span>
                    <span className="text-[10px] font-normal text-slate-400 lowercase">optionnel</span>
                  </label>
                  <input
                    type="text"
                    value={homework}
                    onChange={(e) => setHomework(e.target.value)}
                    placeholder={terms.homeworkPlaceholder}
                    className="w-full p-3 text-xs font-medium text-slate-900 bg-slate-50/60 border border-slate-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400"
                  />
                </div>

                {/* Student Attendance Summary Bar & Interactive Rollcall */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h5 className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                        <Users size={15} className="text-indigo-600" /> Contrôle des Présences {isUniversity ? 'Étudiants' : isProfessional ? 'Stagiaires' : 'Élèves'}
                      </h5>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {officialAttendanceSource === 'SHEET' ? 'Synchronisé avec le registre officiel des absences.' : 'Effectif de la promotion / classe.'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <span className="text-xs font-black text-indigo-700 bg-indigo-100 px-3 py-1 rounded-xl border border-indigo-200/60">
                        {presentCount || 0} / {totalEnrolled} présents
                      </span>
                      {students.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setShowAttendance(!showAttendance)}
                          className="px-3 py-1 text-xs font-bold bg-white text-indigo-600 hover:bg-indigo-50 border border-slate-200 rounded-xl transition-all shadow-xs"
                        >
                          {showAttendance ? 'Masquer' : 'Ajuster l\'appel'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Optional Student Rollcall Grid */}
                  {showAttendance && students.length > 0 && (
                    <div className="pt-3 border-t border-slate-200 space-y-2.5">
                      {/* Search & Fast actions */}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="relative flex-1 min-w-[160px]">
                          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Chercher un nom..."
                            value={studentSearch}
                            onChange={(e) => setStudentSearch(e.target.value)}
                            className="w-full pl-8 pr-3 py-1 text-xs bg-white border border-slate-200 rounded-xl outline-none"
                          />
                        </div>

                        <div className="flex items-center gap-1 text-xs">
                          <button
                            type="button"
                            onClick={() => setAllStudentsAttendance(true)}
                            className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-lg text-[11px] border border-emerald-200"
                          >
                            Tous Présents
                          </button>
                          <button
                            type="button"
                            onClick={() => setAllStudentsAttendance(false)}
                            className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-lg text-[11px] border border-rose-200"
                          >
                            Tous Absents
                          </button>
                        </div>
                      </div>

                      <div className="max-h-56 overflow-y-auto pr-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {filteredStudents.map((st) => {
                          const isPresent = !!attendance[st.id];
                          return (
                            <button
                              key={st.id}
                              type="button"
                              onClick={() => toggleStudentAttendance(st.id)}
                              className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-all active:scale-98 ${
                                isPresent 
                                  ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950' 
                                  : 'bg-rose-50/80 border-rose-200 text-rose-950'
                              }`}
                            >
                              <span className="text-xs font-bold truncate pr-1">
                                {formatStudentName(st.last_name, st.first_name).fullName}
                              </span>
                              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md shrink-0 ${
                                isPresent ? 'bg-emerald-200 text-emerald-800' : 'bg-rose-200 text-rose-800'
                              }`}>
                                {isPresent ? 'Présent' : 'Absent'}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Digital Certification Stamp Notice */}
                <div className="p-3 bg-indigo-50/50 rounded-2xl border border-indigo-100 flex items-center gap-2.5 text-slate-600 text-xs">
                  <ShieldCheck size={16} className="text-indigo-600 shrink-0" />
                  <span className="leading-snug">
                    En validant, vous certifiez sur l'honneur l'exactitude des horaires et du contenu dispensé au nom de <strong>{selectedStaffName}</strong>.
                  </span>
                </div>

                {/* Submit Actions */}
                <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setSelectedAssignment(null)}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={signing}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/20 flex items-center gap-2 disabled:opacity-50"
                  >
                    {signing ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    {terms.ctaSign}
                  </button>
                </div>
              </form>
            ) : (
              <div className="py-16 sm:py-20 text-center px-6 space-y-3">
                <div className="w-16 h-16 bg-indigo-50 text-indigo-500 rounded-2xl flex items-center justify-center mx-auto border border-indigo-100 shadow-xs">
                  <PenTool className="w-8 h-8" />
                </div>
                <h3 className="text-base font-extrabold text-slate-900">Sélectionnez une séance pour commencer</h3>
                <p className="text-slate-500 text-xs max-w-sm mx-auto leading-relaxed">
                  Cliquez sur l'un de vos cours dans le planning de gauche pour renseigner le contenu pédagogique et valider l'émargement.
                </p>
              </div>
            )}
          </div>

          {/* History & Signatures Log */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-600" />
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm">Historique des Émargements Récents</h3>
                  <p className="text-[11px] text-slate-500">Traçabilité complète des cours signés et validés.</p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Filter Pills */}
                <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs">
                  <button
                    type="button"
                    onClick={() => setHistoryFilter('ALL')}
                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all ${
                      historyFilter === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    Tous ({mySignatures.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setHistoryFilter('VALIDATED')}
                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all ${
                      historyFilter === 'VALIDATED' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    Validés
                  </button>
                  <button
                    type="button"
                    onClick={() => setHistoryFilter('SIGNED')}
                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all ${
                      historyFilter === 'SIGNED' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    En Attente
                  </button>
                </div>

                <div className="relative min-w-[140px]">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Filtrer..."
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            <div className="p-0">
              {filteredHistory.length === 0 ? (
                <div className="p-10 text-center text-slate-400 text-xs">
                  Aucun émargement ne correspond à vos filtres actuels.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredHistory.map((sig) => {
                    const campusName = getCampusName(sig.campus_id);
                    return (
                      <div key={sig.id} className="p-4 hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1 min-w-0 pr-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-black text-indigo-700 uppercase tracking-wider bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                              {sig.class_name}
                            </span>
                            <span className="text-xs font-bold text-slate-900">
                              {sig.subject_name}
                            </span>
                            <span className="text-[10px] font-medium text-slate-400">
                              • {new Date(sig.date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                            </span>
                            {campusName && (
                              <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded-md">
                                📍 {campusName}
                              </span>
                            )}
                          </div>
                          
                          <p className="text-xs text-slate-700 font-medium line-clamp-1">
                            {sig.topic_covered}
                          </p>

                          <div className="flex items-center gap-2 text-[10px] text-slate-400 pt-0.5">
                            <span>Horaires : {sig.start_time?.substring(0, 5)} - {sig.end_time?.substring(0, 5)} ({sig.duration_hours}h)</span>
                            {sig.students_present_count !== null && (
                              <span>• {sig.students_present_count} présents</span>
                            )}
                          </div>
                        </div>

                        <div className="shrink-0 flex items-center gap-2 self-start sm:self-auto">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-xl border ${
                            sig.signature_status === 'VALIDATED' 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                              : sig.signature_status === 'REJECTED'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            {sig.signature_status === 'VALIDATED' ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                            {sig.signature_status === 'VALIDATED' ? 'Validé par l\'Admin' : 'En Attente de Validation'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default CourseSignatureView;
