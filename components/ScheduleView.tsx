import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Calendar, Clock, Download, Plus, X, AlertCircle, CheckCircle, Trash2, 
  Users, BookOpen, Banknote, GraduationCap, Building2, MapPin, Printer,
  Layers, ChevronRight, Sparkles, Filter, Check
} from 'lucide-react';
import { supabase } from '../supabase';
import { SchoolClass, Subject, StaffMember, StaffAssignment, UserProfile, SchoolCampus } from '../types';
import { AuditLogger } from '../utils/auditLogger';
import { formatStudentName } from '../utils/formatters';
import { useSchool } from '../contexts/SchoolContext';
import { PrintPreviewModal } from './PrintPreviewModal';
import { SchedulePrintDocument } from './SchedulePrintDocument';
import { 
  findSubjectInList, 
  findClassInList, 
  matchClasses, 
  matchSubjects, 
  normalizeSubjectName 
} from '../utils/subjectMatching';

interface ScheduleViewProps {
  user: UserProfile;
}

const ScheduleView: React.FC<ScheduleViewProps> = ({ user }) => {
  const { terminology, currentCampusId, campuses, school, activeAcademicYear } = useSchool();
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classSubjects, setClassSubjects] = useState<any[]>([]);
  const [allAssignments, setAllAssignments] = useState<any[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [assignedStaffIds, setAssignedStaffIds] = useState<Set<string>>(new Set());
  const [schedules, setSchedules] = useState<StaffAssignment[]>([]);
  const [activeYearId, setActiveYearId] = useState<string | null>(null);
  const [selectedCampusFilter, setSelectedCampusFilter] = useState<string>(currentCampusId || 'ALL');
  
  const [viewMode, setViewMode] = useState<'class' | 'staff'>('class');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  
  // Modal state for Add/Edit course
  const [showModal, setShowModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<StaffAssignment | null>(null);
  const [formData, setFormData] = useState({
    subject_id: '',
    class_id: '',
    staff_id: '',
    day_of_week: 'Lundi',
    start_time: '08:00',
    end_time: '09:00',
    hourly_rate: ''
  });

  // Modal Print/PDF preview state
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  const [toast, setToast] = useState<{message: string, type: 'success'|'error'} | null>(null);

  // Sync selectedCampusFilter with context currentCampusId when it changes
  useEffect(() => {
    if (currentCampusId) {
      setSelectedCampusFilter(currentCampusId);
    }
  }, [currentCampusId]);

  // Determine user restriction on campus
  const isMultiCampusActive = Boolean(school?.has_multi_campus && campuses && campuses.length > 1);

  // Filter classes according to selected campus filter
  const visibleClasses = useMemo(() => {
    if (!isMultiCampusActive || selectedCampusFilter === 'ALL') {
      return classes;
    }
    return classes.filter(c => c.campus_id === selectedCampusFilter);
  }, [classes, selectedCampusFilter, isMultiCampusActive]);

  // Filter staff based on assigned schedules
  const filteredStaff = useMemo(() => {
    return staff.filter(s => assignedStaffIds.has(s.id));
  }, [staff, assignedStaffIds]);

  const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
  const currentDayIndex = (new Date().getDay() + 6) % 7; // Sunday=6, Monday=0
  const currentDayName = days[currentDayIndex];
  const currentHour = new Date().getHours();

  // Generate time slots from 07:00 to 18:00
  const timeSlots = Array.from({ length: 12 }, (_, i) => {
    const hour = i + 7;
    return `${hour.toString().padStart(2, '0')}:00`;
  });

  const showToast = (message: string, type: 'success'|'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    const init = async () => {
      await fetchInitialData();
      
      // If teacher, automatically select their own staff record
      if (user.role === 'TEACHER') {
        const { data: staffData } = await supabase
          .from('staff')
          .select('id')
          .eq('email', user.email)
          .maybeSingle();
        
        if (staffData) {
          setSelectedStaffId(staffData.id);
          setViewMode('staff');
        }
      }
    };
    init();
  }, [user?.school_id, user?.role, user?.email, currentCampusId, selectedCampusFilter]);

  useEffect(() => {
    fetchSchedules();
  }, [selectedClassId, selectedStaffId, viewMode, classes, visibleClasses]);

  // Adjust selected class when visibleClasses changes
  useEffect(() => {
    if (visibleClasses.length > 0) {
      if (!selectedClassId || !visibleClasses.some(c => c.id === selectedClassId)) {
        setSelectedClassId(visibleClasses[0].id);
      }
    } else {
      setSelectedClassId('');
    }
  }, [visibleClasses]);

  // Update hourly rate when staff changes
  useEffect(() => {
    if (formData.staff_id) {
      const selectedStaff = staff.find(s => s.id === formData.staff_id);
      if (selectedStaff && !editingSchedule) {
        setFormData(prev => ({ ...prev, hourly_rate: selectedStaff.amount?.toString() || '' }));
      }
    }
  }, [formData.staff_id, staff, editingSchedule]);

  // Compute class-affiliated and teacher-assigned subjects vs all subjects
  const { affiliatedSubjects, otherSubjects, allSelectableSubjects } = useMemo(() => {
    if (!formData.class_id && !editingSchedule) {
      return { 
        affiliatedSubjects: subjects, 
        otherSubjects: [], 
        allSelectableSubjects: subjects 
      };
    }

    const targetCls = findClassInList(formData.class_id, classes);
    const targetClassName = targetCls?.name || (editingSchedule?.class_name ?? '');
    
    // 1. Gather all class IDs belonging to this class in this school (e.g. multi-campus / annexes / variants)
    const matchingClassIds = new Set<string>();
    if (formData.class_id) matchingClassIds.add(formData.class_id);
    if (targetCls?.id) matchingClassIds.add(targetCls.id);
    classes.forEach(c => {
      if (matchClasses(c, targetClassName || formData.class_id, classes)) {
        matchingClassIds.add(c.id);
      }
    });

    // 2. Identify all subject IDs from class_subjects
    const affiliatedSubjectIds = new Set<string>();
    classSubjects.forEach(cs => {
      if (matchingClassIds.has(cs.class_id) || matchClasses(cs.class_id, targetClassName || formData.class_id, classes)) {
        const found = findSubjectInList(cs.subject_id, subjects);
        if (found) affiliatedSubjectIds.add(found.id);
        else if (cs.subject_id) affiliatedSubjectIds.add(cs.subject_id);
      }
    });

    // 3. Identify all subject IDs or names from staff_assignments (curriculum & existing schedules & assignments table)
    allAssignments.forEach(sa => {
      const isClassMatch = (sa.class_id && matchingClassIds.has(sa.class_id)) || 
                           matchClasses(sa.class_id || sa.class_name, targetClassName || formData.class_id, classes);
      if (isClassMatch) {
        const found = findSubjectInList(sa.subject_id || sa.subject_name, subjects);
        if (found) affiliatedSubjectIds.add(found.id);
        else if (sa.subject_id) affiliatedSubjectIds.add(sa.subject_id);
      }
    });

    // 4. If an enseignant is selected in the form, only include subjects assigned to this staff FOR THIS CLASS
    if (formData.staff_id) {
      allAssignments
        .filter(sa => sa.staff_id === formData.staff_id && ((sa.class_id && matchingClassIds.has(sa.class_id)) || matchClasses(sa.class_id || sa.class_name, targetClassName || formData.class_id, classes)))
        .forEach(sa => {
          const found = findSubjectInList(sa.subject_id || sa.subject_name, subjects);
          if (found) affiliatedSubjectIds.add(found.id);
          else if (sa.subject_id) affiliatedSubjectIds.add(sa.subject_id);
        });
    }

    // 5. If editing a schedule, ensure the current schedule's subject is in affiliatedSubjectIds
    if (editingSchedule) {
      const found = findSubjectInList(editingSchedule.subject_id || editingSchedule.subject_name, subjects);
      if (found) affiliatedSubjectIds.add(found.id);
      else if (editingSchedule.subject_id) affiliatedSubjectIds.add(editingSchedule.subject_id);
    }

    const affiliated = subjects.filter(s => affiliatedSubjectIds.has(s.id));
    const others = subjects.filter(s => !affiliatedSubjectIds.has(s.id));

    return {
      affiliatedSubjects: affiliated,
      otherSubjects: others,
      allSelectableSubjects: affiliated.length > 0 ? [...affiliated, ...others] : subjects
    };
  }, [formData.class_id, formData.staff_id, editingSchedule, classes, classSubjects, allAssignments, subjects, staff]);

  // Ensure formData.subject_id is valid when class or subjects change
  useEffect(() => {
    if (!formData.class_id) return;
    if (editingSchedule) return; // Do not auto-reset when in edit mode

    // If user has not picked a subject yet, or if current subject is invalid
    const isCurrentValid = subjects.some(s => s.id === formData.subject_id);
    if (!formData.subject_id || !isCurrentValid) {
      if (affiliatedSubjects.length > 0) {
        setFormData(prev => ({ ...prev, subject_id: affiliatedSubjects[0].id }));
      } else if (subjects.length > 0) {
        setFormData(prev => ({ ...prev, subject_id: subjects[0].id }));
      }
    }
  }, [formData.class_id, affiliatedSubjects, subjects, editingSchedule]);

  // Reset selected staff if filtered out
  useEffect(() => {
    if (viewMode === 'staff' && selectedStaffId) {
      const isStillAvailable = filteredStaff.some(s => s.id === selectedStaffId);
      if (!isStillAvailable && filteredStaff.length > 0) {
        setSelectedStaffId(filteredStaff[0].id);
      }
    }
  }, [filteredStaff, viewMode, selectedStaffId]);

  const fetchInitialData = async () => {
    if (!user?.school_id) return;
    setLoading(true);
    try {
      // 1. Fetch active academic year
      let yearId = activeAcademicYear?.id || null;
      if (!yearId) {
        const { data: years } = await supabase
          .from('academic_years')
          .select('id')
          .eq('school_id', user.school_id)
          .or('status.eq.ACTIVE,is_active.eq.true')
          .limit(1);
          
        if (years && years.length > 0) {
          yearId = years[0].id;
        }
      }
      setActiveYearId(yearId);

      // 2. Fetch all classes for the school
      let classesQuery = supabase.from('classes').select('*').eq('school_id', user.school_id);
      
      // If user is tied to a specific campus
      if (user.campus_id) {
        classesQuery = classesQuery.eq('campus_id', user.campus_id);
      }

      const [classesRes, subjectsRes, staffRes, classSubjectsRes, staffWithAssignmentsRes, allAssignmentsRes] = await Promise.all([
        classesQuery.order('name'),
        supabase.from('subjects').select('*').eq('school_id', user.school_id).order('name'),
        supabase.from('staff').select('*').eq('school_id', user.school_id).eq('status', 'Actif').order('last_name'),
        supabase.from('class_subjects').select('id, class_id, subject_id, school_id').or(`school_id.eq.${user.school_id},school_id.is.null`),
        supabase.from('staff').select('id, staff_assignments!inner(id)').eq('school_id', user.school_id).eq('status', 'Actif'),
        supabase.from('staff_assignments').select('id, class_id, class_name, subject_id, subject_name, staff_id, school_id').eq('school_id', user.school_id)
      ]);

      if (classesRes.error) throw classesRes.error;
      if (subjectsRes.error) throw subjectsRes.error;
      if (staffRes.error) throw staffRes.error;
      if (classSubjectsRes.error) throw classSubjectsRes.error;

      const loadedClasses = classesRes.data || [];
      setClasses(loadedClasses);
      setSubjects(subjectsRes.data || []);
      setStaff(staffRes.data || []);
      setClassSubjects(classSubjectsRes.data || []);
      setAllAssignments(allAssignmentsRes.data || []);

      const assignedIds = new Set<string>((staffWithAssignmentsRes.data || []).map(s => s.id));
      setAssignedStaffIds(assignedIds);
      
      const initialFilteredStaff = (staffRes.data || []).filter(s => assignedIds.has(s.id));

      if (loadedClasses.length > 0 && !selectedClassId) {
        setSelectedClassId(loadedClasses[0].id);
      }
      if (initialFilteredStaff.length > 0 && !selectedStaffId) {
        setSelectedStaffId(initialFilteredStaff[0].id);
      } else if (staffRes.data && staffRes.data.length > 0 && !selectedStaffId) {
        setSelectedStaffId(staffRes.data[0].id);
      }
    } catch (error) {
      console.error('Error fetching initial data:', error);
      showToast("Erreur lors du chargement des données.", 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchSchedules = async () => {
    if (!user?.school_id) return;
    
    try {
      let query = supabase
        .from('staff_assignments')
        .select(`
          *,
          staff!inner(*)
        `)
        .eq('school_id', user.school_id);

      if (viewMode === 'class' && selectedClassId) {
        const cls = findClassInList(selectedClassId, classes) || classes.find(c => c.id === selectedClassId);
        if (cls) {
          query = query.or(`class_id.eq.${cls.id},class_name.eq."${cls.name}"`);
        } else {
          setSchedules([]);
          return;
        }
      } else if (viewMode === 'staff' && selectedStaffId) {
        query = query.eq('staff_id', selectedStaffId);
      } else {
        setSchedules([]);
        return;
      }

      if (activeYearId) {
        query = query.or(`academic_year_id.eq.${activeYearId},academic_year_id.is.null`);
      }

      let { data, error } = await query;

      // Fallback if column missing or complex query fails
      if (error) {
        const fallbackQuery = supabase
          .from('staff_assignments')
          .select(`
            *,
            staff!inner(*)
          `)
          .eq('school_id', user.school_id);
        
        const cls = findClassInList(selectedClassId, classes) || classes.find(c => c.id === selectedClassId);
        let finalFallbackQuery = fallbackQuery;
        if (viewMode === 'class' && cls) {
          finalFallbackQuery = fallbackQuery.eq('class_name', cls.name);
        } else if (viewMode === 'staff' && selectedStaffId) {
          finalFallbackQuery = fallbackQuery.eq('staff_id', selectedStaffId);
        }
        
        const fallback = await finalFallbackQuery;
        data = fallback.data;
        error = fallback.error;
      }

      if (error) throw error;
      
      // Client-side verification to ensure no schedule for this class is left out (e.g. name variations 9e / 9ème)
      let finalSchedules = data || [];
      if (viewMode === 'class' && selectedClassId) {
        const targetCls = findClassInList(selectedClassId, classes);
        if (targetCls) {
          finalSchedules = finalSchedules.filter(s => 
            s.class_id === targetCls.id || 
            matchClasses(s.class_name || s.class_id, targetCls, classes)
          );
        }
      }

      setSchedules(finalSchedules);
    } catch (error) {
      console.error('Error fetching schedules:', error);
    }
  };

  const handleOpenModal = (dayName?: string, timeSlot?: string) => {
    setEditingSchedule(null);
    const initialStaffId = viewMode === 'staff' ? selectedStaffId : '';
    const initialStaff = staff.find(s => s.id === initialStaffId);
    const defaultClassId = viewMode === 'class' ? (selectedClassId || (visibleClasses[0]?.id || '')) : (visibleClasses[0]?.id || '');
    
    // Find initial subject for this default class
    let defaultSubjectId = '';
    
    // 1. If staff is chosen, check their assignments in this class
    if (initialStaffId) {
      const staffClassAssign = allAssignments.find(sa => 
        sa.staff_id === initialStaffId && 
        (sa.class_id === defaultClassId || matchClasses(sa.class_name || sa.class_id, defaultClassId, classes))
      );
      if (staffClassAssign) {
        const found = findSubjectInList(staffClassAssign.subject_id || staffClassAssign.subject_name, subjects);
        if (found) defaultSubjectId = found.id;
      }
      if (!defaultSubjectId && (initialStaff as any)?.subject) {
        const found = findSubjectInList(String((initialStaff as any).subject), subjects);
        if (found) defaultSubjectId = found.id;
      }
    }
    
    // 2. Otherwise find from class_subjects or class assignments
    if (!defaultSubjectId && defaultClassId) {
      const clsMatches = classSubjects.filter(cs => matchClasses(cs.class_id, defaultClassId, classes));
      if (clsMatches.length > 0) {
        const found = findSubjectInList(clsMatches[0].subject_id, subjects);
        if (found) defaultSubjectId = found.id;
      }
      if (!defaultSubjectId) {
        const assignMatches = allAssignments.filter(sa => matchClasses(sa.class_id || sa.class_name, defaultClassId, classes));
        if (assignMatches.length > 0) {
          const found = findSubjectInList(assignMatches[0].subject_id || assignMatches[0].subject_name, subjects);
          if (found) defaultSubjectId = found.id;
        }
      }
    }

    if (!defaultSubjectId && subjects.length > 0) {
      defaultSubjectId = subjects[0].id;
    }
    
    setFormData({
      subject_id: defaultSubjectId,
      class_id: defaultClassId,
      staff_id: initialStaffId,
      day_of_week: dayName || 'Lundi',
      start_time: timeSlot || '08:00',
      end_time: timeSlot ? `${(parseInt(timeSlot.split(':')[0]) + 1).toString().padStart(2, '0')}:00` : '09:00',
      hourly_rate: initialStaff?.amount?.toString() || ''
    });
    setShowModal(true);
  };

  const handleEditSchedule = (schedule: StaffAssignment) => {
    setEditingSchedule(schedule);
    const cls = findClassInList(schedule.class_id || schedule.class_name, classes);
    const subj = findSubjectInList(schedule.subject_id || schedule.subject_name, subjects);
    
    setFormData({
      subject_id: subj?.id || schedule.subject_id || '',
      class_id: cls?.id || (schedule.class_id || ''),
      staff_id: schedule.staff_id || '',
      day_of_week: schedule.day_of_week,
      start_time: schedule.start_time.substring(0, 5),
      end_time: schedule.end_time.substring(0, 5),
      hourly_rate: schedule.hourly_rate?.toString() || ''
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.school_id) return;

    if (!formData.class_id || !formData.subject_id || !formData.staff_id) {
      showToast("Veuillez remplir tous les champs obligatoires.", 'error');
      return;
    }

    const start = new Date(`2000-01-01T${formData.start_time}`);
    const end = new Date(`2000-01-01T${formData.end_time}`);
    const diffMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
    const diffHours = diffMinutes / 60;

    if (diffMinutes <= 0) {
      showToast("L'heure de fin doit être après l'heure de début.", 'error');
      return;
    }

    const selectedSubject = subjects.find(s => s.id === formData.subject_id);
    const selectedClass = classes.find(c => c.id === formData.class_id);
    const selectedStaff = staff.find(s => s.id === formData.staff_id);

    // Fonction utilitaire pour vérifier le chevauchement strict
    const checkOverlap = (start1: string, end1: string, start2: string, end2: string) => {
      return (start1 < end2 && start2 < end1);
    };

    try {
      // 1. Conflit enseignant
      let tQuery = supabase
        .from('staff_assignments')
        .select('*')
        .eq('staff_id', formData.staff_id)
        .eq('day_of_week', formData.day_of_week);
      
      if (activeYearId) {
        tQuery = tQuery.eq('academic_year_id', activeYearId);
      }

      let { data: teacherAssignments, error: tError } = await tQuery;

      if (tError && (tError.code === '42703' || tError.message?.includes('academic_year_id')) && activeYearId) {
        const fallback = await supabase
          .from('staff_assignments')
          .select('*')
          .eq('staff_id', formData.staff_id)
          .eq('day_of_week', formData.day_of_week);
        teacherAssignments = fallback.data;
        tError = fallback.error;
      }

      if (tError) throw tError;

      if (teacherAssignments) {
        const teacherOverlap = teacherAssignments.find(a => 
          String(a.id) !== String(editingSchedule?.id) &&
          checkOverlap(formData.start_time, formData.end_time, a.start_time.substring(0, 5), a.end_time.substring(0, 5))
        );

        if (teacherOverlap) {
          const tStart = teacherOverlap.start_time.substring(0, 5);
          const tEnd = teacherOverlap.end_time.substring(0, 5);
          showToast(`Conflit : L'enseignant a déjà un cours en ${teacherOverlap.class_name} de ${tStart} à ${tEnd}.`, 'error');
          return;
        }
      }

      // 2. Conflit classe
      let cQuery = supabase
        .from('staff_assignments')
        .select('*, staff!inner(first_name, last_name, school_id)')
        .eq('school_id', user.school_id)
        .eq('class_name', selectedClass?.name)
        .eq('day_of_week', formData.day_of_week);

      if (activeYearId) {
        cQuery = cQuery.eq('academic_year_id', activeYearId);
      }

      let { data: classAssignments, error: cError } = await cQuery;

      if (cError && (cError.code === '42703' || cError.message?.includes('academic_year_id')) && activeYearId) {
        const fallback = await supabase
          .from('staff_assignments')
          .select('*, staff!inner(first_name, last_name, school_id)')
          .eq('school_id', user.school_id)
          .eq('class_name', selectedClass?.name)
          .eq('day_of_week', formData.day_of_week);
        classAssignments = fallback.data;
        cError = fallback.error;
      }

      if (cError) throw cError;

      if (classAssignments) {
        const classOverlap = classAssignments.find(a => 
          String(a.id) !== String(editingSchedule?.id) &&
          checkOverlap(formData.start_time, formData.end_time, a.start_time.substring(0, 5), a.end_time.substring(0, 5))
        );

        if (classOverlap) {
          const cStart = classOverlap.start_time.substring(0, 5);
          const cEnd = classOverlap.end_time.substring(0, 5);
          const profName = classOverlap.staff ? formatStudentName(classOverlap.staff.last_name, classOverlap.staff.first_name).fullName : 'un autre professeur';
          showToast(`Conflit : Cet(te) ${terminology.class?.toLowerCase() || 'classe'} a déjà un cours de ${classOverlap.subject_name} avec ${profName} de ${cStart} à ${cEnd}.`, 'error');
          return;
        }
      }

      const payload = {
        staff_id: formData.staff_id,
        school_id: user.school_id,
        class_id: formData.class_id,
        class_name: selectedClass?.name || '',
        subject_id: formData.subject_id,
        subject_name: selectedSubject?.name || '',
        day_of_week: formData.day_of_week,
        start_time: formData.start_time,
        end_time: formData.end_time,
        duration_hours: parseFloat(diffHours.toFixed(2)),
        hourly_rate: parseFloat(formData.hourly_rate) || 0,
        academic_year_id: activeYearId
      };

      if (editingSchedule) {
        const { error } = await supabase
          .from('staff_assignments')
          .update(payload)
          .eq('id', editingSchedule.id);
        
        if (error) {
          if (error.code === '42703' || error.message?.includes('academic_year_id')) {
            const { academic_year_id, ...fallbackPayload } = payload;
            const { error: retryError } = await supabase
              .from('staff_assignments')
              .update(fallbackPayload)
              .eq('id', editingSchedule.id);
            if (retryError) throw retryError;
          } else {
            throw error;
          }
        }

        AuditLogger.log({
          school_id: user.school_id,
          user_id: user.id,
          action: 'UPDATE',
          entity_type: 'class',
          entity_id: editingSchedule.id,
          details: { type: 'schedule', class_name: payload.class_name, subject: payload.subject_name, day: payload.day_of_week }
        });

        showToast("Cours mis à jour avec succès !");
      } else {
        const { data, error } = await supabase
          .from('staff_assignments')
          .insert([payload])
          .select()
          .single();
        
        if (error) {
          if (error.code === '42703' || error.message?.includes('academic_year_id')) {
            const { academic_year_id, ...fallbackPayload } = payload;
            const { data: retryData, error: retryError } = await supabase
              .from('staff_assignments')
              .insert([fallbackPayload])
              .select()
              .single();
            if (retryError) throw retryError;
            
            AuditLogger.log({
              school_id: user.school_id,
              user_id: user.id,
              action: 'CREATE',
              entity_type: 'class',
              entity_id: retryData?.id,
              details: { type: 'schedule', class_name: payload.class_name, subject: payload.subject_name, day: payload.day_of_week }
            });
          } else {
            throw error;
          }
        } else {
          AuditLogger.log({
            school_id: user.school_id,
            user_id: user.id,
            action: 'CREATE',
            entity_type: 'class',
            entity_id: data?.id,
            details: { type: 'schedule', class_name: payload.class_name, subject: payload.subject_name, day: payload.day_of_week }
          });
        }

        showToast("Cours ajouté avec succès !");
      }

      // Auto-affiliation: If the chosen subject is not yet officially linked to this class in class_subjects, link it automatically
      try {
        if (formData.class_id && formData.subject_id) {
          const isAlreadyAffiliated = classSubjects.some(cs => 
            (cs.class_id === formData.class_id || matchClasses(cs.class_id, selectedClass?.name, classes)) &&
            (cs.subject_id === formData.subject_id || matchSubjects(cs.subject_id, formData.subject_id, subjects))
          );
          if (!isAlreadyAffiliated) {
            await supabase.from('class_subjects').insert({
              school_id: user.school_id,
              class_id: formData.class_id,
              subject_id: formData.subject_id
            });
          }
        }
      } catch (affErr) {
        console.warn('Auto-link subject to class notice:', affErr);
      }

      setShowModal(false);
      fetchInitialData();
      fetchSchedules();
    } catch (error: any) {
      console.error('Error saving schedule:', error);
      showToast(error.message || "Erreur lors de l'enregistrement.", 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Voulez-vous vraiment supprimer ce cours ?")) return;
    try {
      const { error } = await supabase
        .from('staff_assignments')
        .delete()
        .eq('id', id);
      if (error) throw error;

      AuditLogger.log({
        school_id: user.school_id,
        user_id: user.id,
        action: 'DELETE',
        entity_type: 'class',
        entity_id: id,
        details: { type: 'schedule' }
      });

      showToast("Cours supprimé avec succès !");
      fetchInitialData();
      fetchSchedules();
      setShowModal(false);
    } catch (error) {
      console.error('Error deleting schedule:', error);
      showToast("Erreur lors de la suppression.", 'error');
    }
  };

  // Modern Subject Color Palette
  const getSubjectColor = (subjectName: string) => {
    const palettes = [
      {
        card: 'bg-indigo-50/80 text-indigo-900 border-indigo-200/80 hover:border-indigo-400',
        badge: 'bg-indigo-600 text-white',
        bar: 'bg-indigo-500'
      },
      {
        card: 'bg-emerald-50/80 text-emerald-900 border-emerald-200/80 hover:border-emerald-400',
        badge: 'bg-emerald-600 text-white',
        bar: 'bg-emerald-500'
      },
      {
        card: 'bg-violet-50/80 text-violet-900 border-violet-200/80 hover:border-violet-400',
        badge: 'bg-violet-600 text-white',
        bar: 'bg-violet-500'
      },
      {
        card: 'bg-amber-50/80 text-amber-900 border-amber-200/80 hover:border-amber-400',
        badge: 'bg-amber-600 text-white',
        bar: 'bg-amber-500'
      },
      {
        card: 'bg-rose-50/80 text-rose-900 border-rose-200/80 hover:border-rose-400',
        badge: 'bg-rose-600 text-white',
        bar: 'bg-rose-500'
      },
      {
        card: 'bg-sky-50/80 text-sky-900 border-sky-200/80 hover:border-sky-400',
        badge: 'bg-sky-600 text-white',
        bar: 'bg-sky-500'
      },
      {
        card: 'bg-teal-50/80 text-teal-900 border-teal-200/80 hover:border-teal-400',
        badge: 'bg-teal-600 text-white',
        bar: 'bg-teal-500'
      }
    ];
    let hash = 0;
    for (let i = 0; i < subjectName.length; i++) {
      hash = subjectName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % palettes.length;
    return palettes[index];
  };

  // Selected entities for display & print
  const currentSelectedClass = visibleClasses.find(c => c.id === selectedClassId) || classes.find(c => c.id === selectedClassId);
  const currentSelectedStaff = staff.find(s => s.id === selectedStaffId);
  const currentCampusObj = campuses?.find(c => c.id === (currentSelectedClass?.campus_id || selectedCampusFilter));

  const totalAssignedHours = schedules.reduce((acc, s) => acc + (s.duration_hours || 1), 0);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <div className="w-10 h-10 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
        <p className="text-sm font-bold text-slate-500">Chargement de l'emploi du temps...</p>
      </div>
    );
  }

  return (
    <div className="space-y-3.5 relative pb-6">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-2xl text-white backdrop-blur-md animate-in slide-in-from-bottom-5 duration-200 ${toast.type === 'success' ? 'bg-emerald-600/95 border border-emerald-400/30' : 'bg-rose-600/95 border border-rose-400/30'}`}>
          {toast.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span className="font-bold text-xs tracking-tight">{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 hover:opacity-75 transition-opacity">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* HEADER PRINCIPAL AVEC DESIGN INTERNATIONAL */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-200 shrink-0">
              <Calendar size={17} className="stroke-[2.2]" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">Emploi du Temps</h1>
              <p className="text-[11px] font-semibold text-slate-500">
                Planification pédagogique & gestion des créneaux horaires
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Badge Année Académique Active */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600">
            <Sparkles size={13} className="text-indigo-600" />
            <span>Session : {activeAcademicYear?.label || 'Année active'}</span>
          </div>

          {/* Bouton Aperçu & Export / Impression */}
          <button
            onClick={() => setShowPrintModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-2xs hover:scale-[1.01] active:scale-98"
          >
            <Printer size={14} className="text-slate-500" />
            <span>Aperçu & Impression</span>
          </button>

          {/* Bouton Ajouter un cours */}
          {user.role !== 'TEACHER' && (
            <button 
              onClick={() => handleOpenModal()}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-md shadow-indigo-200 hover:shadow-lg transition-all hover:scale-[1.02] active:scale-98"
            >
              <Plus size={15} className="stroke-[2.5]" />
              <span>Nouveau créneau</span>
            </button>
          )}
        </div>
      </header>

      {/* FILTRES MODERNES : MULTI-TENANT ANNEXES, VUES & ENTITÉS */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-3 sm:p-3.5 space-y-2.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          
          {/* SÉLECTEUR DE MODE : PAR CLASSE / PAR ENSEIGNANT */}
          {user.role !== 'TEACHER' ? (
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex p-1 bg-slate-100/80 rounded-xl border border-slate-200/60">
                <button
                  onClick={() => setViewMode('class')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                    viewMode === 'class' 
                      ? 'bg-white text-indigo-700 shadow-xs' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <BookOpen size={14} />
                  <span>Par {terminology.class || 'Classe'}</span>
                </button>
                <button
                  onClick={() => setViewMode('staff')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                    viewMode === 'staff' 
                      ? 'bg-white text-indigo-700 shadow-xs' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Users size={14} />
                  <span>Par Enseignant</span>
                </button>
              </div>

              {/* Multi-Tenant Annexe Filter (Visible if School has multiple campuses) */}
              {isMultiCampusActive && !user.campus_id && (
                <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Building2 size={12} className="text-indigo-500" />
                    <span>Annexe :</span>
                  </label>
                  <select
                    value={selectedCampusFilter}
                    onChange={(e) => setSelectedCampusFilter(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold px-2.5 py-1.5 text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all min-w-[150px]"
                  >
                    <option value="ALL">🌐 Toutes les annexes</option>
                    {campuses.map(campus => (
                      <option key={campus.id} value={campus.id}>
                        📍 {campus.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 font-black shrink-0">
                <Users size={16} />
              </div>
              <div>
                <span className="text-xs font-black text-slate-800">Mon Emploi du Temps Personnel</span>
                <p className="text-[10px] text-slate-400 font-medium leading-none mt-0.5">Créneaux horaires hebdomadaires attribués</p>
              </div>
            </div>
          )}

          {/* SÉLECTEUR DE LA CLASSE OU DU PROFESSEUR */}
          {user.role !== 'TEACHER' && (
            <div className="flex items-center gap-2">
              {viewMode === 'class' ? (
                <div className="flex items-center gap-1.5 w-full sm:w-auto">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider shrink-0">
                    {terminology.class || 'Classe'} :
                  </label>
                  <select 
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    className="bg-white border border-slate-200 rounded-xl text-xs font-black px-3 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-2xs transition-all text-slate-900 min-w-[180px]"
                  >
                    {visibleClasses.length === 0 ? (
                      <option value="">Aucune classe disponible</option>
                    ) : (
                      visibleClasses.map(c => {
                        const campusName = campuses?.find(cmp => cmp.id === c.campus_id)?.name;
                        return (
                          <option key={c.id} value={c.id} className="text-slate-900">
                            {c.name} {campusName && !user.campus_id ? `(${campusName})` : ''}
                          </option>
                        );
                      })
                    )}
                  </select>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 w-full sm:w-auto">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider shrink-0">
                    Enseignant :
                  </label>
                  <select 
                    value={selectedStaffId}
                    onChange={(e) => setSelectedStaffId(e.target.value)}
                    className="bg-white border border-slate-200 rounded-xl text-xs font-black px-3 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-2xs transition-all text-slate-900 min-w-[200px]"
                  >
                    {filteredStaff.length === 0 ? (
                      <option value="">Aucun enseignant assigné</option>
                    ) : (
                      filteredStaff.map(s => (
                        <option key={s.id} value={s.id} className="text-slate-900">
                          {formatStudentName(s.last_name, s.first_name).fullName}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              )}
            </div>
          )}
        </div>

        {/* BANDEAU DE STATISTIQUES RAPIDES SUR LA SÉLECTION */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100">
          <div className="bg-slate-50/70 p-2 rounded-xl border border-slate-100 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
              <BookOpen size={13} />
            </div>
            <div className="min-w-0">
              <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 truncate">Cours total</span>
              <span className="text-xs font-black text-slate-900">{schedules.length} créneaux</span>
            </div>
          </div>

          <div className="bg-slate-50/70 p-2 rounded-xl border border-slate-100 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs shrink-0">
              <Clock size={13} />
            </div>
            <div className="min-w-0">
              <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 truncate">Volume horaire</span>
              <span className="text-xs font-black text-slate-900">{totalAssignedHours}h / semaine</span>
            </div>
          </div>

          <div className="bg-slate-50/70 p-2 rounded-xl border border-slate-100 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center font-bold text-xs shrink-0">
              <Users size={13} />
            </div>
            <div className="min-w-0">
              <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 truncate">
                {viewMode === 'class' ? 'Professeurs' : 'Classes couvertes'}
              </span>
              <span className="text-xs font-black text-slate-900">
                {viewMode === 'class' 
                  ? new Set(schedules.map(s => s.staff_id)).size 
                  : new Set(schedules.map(s => s.class_name)).size}
              </span>
            </div>
          </div>

          <div className="bg-slate-50/70 p-2 rounded-xl border border-slate-100 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xs shrink-0">
              <Calendar size={13} />
            </div>
            <div className="min-w-0">
              <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 truncate">Aujourd'hui</span>
              <span className="text-xs font-black text-indigo-600">{currentDayName}</span>
            </div>
          </div>
        </div>
      </div>

      {/* GRILLE DU PLANNING HEBDOMADAIRE MODERNE */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[940px]">
            {/* Header Row des jours de la semaine */}
            <div className="grid grid-cols-8 border-b border-slate-200">
              <div className="p-2.5 border-r border-slate-200 bg-slate-900 flex items-center justify-center text-white font-black text-xs">
                <Clock size={15} className="text-slate-300" />
              </div>
              {days.map((day) => {
                const isToday = day === currentDayName;
                return (
                  <div 
                    key={day} 
                    className={`p-2 text-center border-r border-slate-200 last:border-0 transition-colors ${
                      isToday 
                        ? 'bg-indigo-600 text-white font-black' 
                        : 'bg-slate-800 text-white/90 font-extrabold'
                    }`}
                  >
                    <span className="block text-[11px] uppercase tracking-wider">{day}</span>
                    {isToday && (
                      <span className="inline-block text-[8px] px-1 py-0.2 bg-white/20 rounded font-bold mt-0.5 tracking-tight">
                        Aujourd'hui
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Rangées de créneaux horaires */}
            {timeSlots.map((time, tIdx) => {
              const hourPrefix = time.substring(0, 2);
              const isCurrentHour = parseInt(hourPrefix) === currentHour;
              
              return (
                <div 
                  key={tIdx} 
                  className={`grid grid-cols-8 min-h-[78px] border-b border-slate-100 last:border-0 ${
                    isCurrentHour ? 'bg-indigo-50/15' : ''
                  }`}
                >
                  {/* Colonne de l'heure */}
                  <div className={`p-2 border-r border-slate-200 flex flex-col items-center justify-center text-[10px] font-black tracking-tight border-l-4 ${
                    isCurrentHour 
                      ? 'border-l-indigo-600 text-indigo-700 bg-indigo-50/50' 
                      : 'border-l-transparent text-slate-500 bg-slate-50/60'
                  }`}>
                    <span>{time}</span>
                    <span className="text-[9px] font-semibold text-slate-400">
                      {(parseInt(hourPrefix) + 1).toString().padStart(2, '0')}:00
                    </span>
                  </div>

                  {/* Cellules des jours */}
                  {days.map((day) => {
                    const daySchedules = schedules.filter(s => 
                      s.day_of_week === day && 
                      s.start_time.startsWith(hourPrefix)
                    );
                    const isToday = day === currentDayName;

                    return (
                      <div 
                        key={day} 
                        className={`p-1 border-r border-slate-100 last:border-0 relative group transition-all flex flex-col justify-center ${
                          isToday ? 'bg-indigo-50/5' : 'hover:bg-slate-50/60'
                        }`}
                        onClick={() => user.role !== 'TEACHER' && daySchedules.length === 0 && handleOpenModal(day, time)}
                      >
                        {daySchedules.map(schedule => {
                          const theme = getSubjectColor(schedule.subject_name);
                          return (
                            <div 
                              key={schedule.id}
                              onClick={(e) => { 
                                if (user.role === 'TEACHER') return;
                                e.stopPropagation(); 
                                handleEditSchedule(schedule); 
                              }}
                              className={`w-full rounded-lg p-1.5 border ${theme.card} shadow-2xs ${
                                user.role !== 'TEACHER' ? 'cursor-pointer hover:shadow-md hover:scale-[1.01] active:scale-98' : 'cursor-default'
                              } transition-all my-0.5 first:mt-0 last:mb-0 relative overflow-hidden group/card`}
                            >
                              <div className={`absolute top-0 left-0 bottom-0 w-1 ${theme.bar}`} />
                              
                              <div className="pl-1">
                                <div className="flex justify-between items-start gap-1 mb-0.5">
                                  <p className="text-[11px] font-black leading-snug uppercase tracking-tight line-clamp-1">
                                    {schedule.subject_name}
                                  </p>
                                </div>

                                <div className="flex items-center gap-1 mb-1 text-[10px] font-bold opacity-85 truncate">
                                  {viewMode === 'class' ? <Users size={11} className="shrink-0" /> : <GraduationCap size={11} className="shrink-0" />}
                                  <span className="truncate">
                                    {viewMode === 'class' 
                                      ? (schedule.staff ? formatStudentName(schedule.staff.last_name, schedule.staff.first_name).fullName : 'Non assigné')
                                      : schedule.class_name
                                    }
                                  </span>
                                </div>

                                <div className="flex items-center justify-between pt-0.5 border-t border-current/10 text-[9px] font-bold opacity-75">
                                  <span className="flex items-center gap-1">
                                    <Clock size={9} />
                                    {schedule.start_time.substring(0, 5)} - {schedule.end_time.substring(0, 5)}
                                  </span>
                                  <span>{schedule.duration_hours}h</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}

                        {/* Bouton rapide d'ajout au survol de la case vide */}
                        {user.role !== 'TEACHER' && daySchedules.length === 0 && (
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                            <div className="w-6 h-6 bg-indigo-50 hover:bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 border border-indigo-200 shadow-2xs transition-transform hover:scale-110">
                              <Plus size={13} className="stroke-[2.5]" />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* MODALE D'AJOUT / MODIFICATION DE COURS */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200 border border-slate-100">
            {/* Modal Header */}
            <div className="flex justify-between items-center px-5 py-3.5 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  {editingSchedule ? <Clock size={16} /> : <Plus size={16} />}
                </div>
                <div>
                  <h2 className="text-sm font-black text-slate-900 leading-tight">
                    {editingSchedule ? 'Modifier le créneau' : 'Nouveau cours à l\'emploi du temps'}
                  </h2>
                  <p className="text-[11px] text-slate-400 font-medium leading-none mt-0.5">Configuration pédagogique et horaire</p>
                </div>
              </div>
              <button 
                onClick={() => setShowModal(false)} 
                className="w-7 h-7 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-3.5 overflow-y-auto custom-scrollbar">
              {/* Section 1: Informations de la classe & Matière */}
              <div className="space-y-2.5">
                <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-1">
                  <BookOpen size={13} className="text-indigo-600" />
                  <span>Attribution Pédagogique</span>
                </h3>
                
                <div className="space-y-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      {terminology.class || 'Classe'} cible <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <select
                        required
                        value={formData.class_id}
                        onChange={(e) => {
                          const newClassId = e.target.value;
                          // Find affiliated subjects for new class
                          const newAffiliated = subjects.filter(s => {
                            const inClassSubj = classSubjects.some(cs => 
                              (cs.class_id === newClassId || matchClasses(cs.class_id, newClassId, classes)) && 
                              matchSubjects(s, cs.subject_id, subjects)
                            );
                            const inAssignments = allAssignments.some(sa => 
                              (sa.class_id === newClassId || matchClasses(sa.class_id || sa.class_name, newClassId, classes)) && 
                              matchSubjects(s, sa.subject_id || sa.subject_name, subjects)
                            );
                            return inClassSubj || inAssignments;
                          });

                          let nextSubjectId = formData.subject_id;
                          if (newAffiliated.length > 0 && !newAffiliated.some(s => s.id === formData.subject_id)) {
                            nextSubjectId = newAffiliated[0].id;
                          }

                          setFormData(prev => ({ 
                            ...prev, 
                            class_id: newClassId,
                            subject_id: nextSubjectId
                          }));
                        }}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                      >
                        <option value="">Sélectionner une classe...</option>
                        {visibleClasses.map(c => {
                          const campusName = campuses?.find(cmp => cmp.id === c.campus_id)?.name;
                          return (
                            <option key={c.id} value={c.id}>
                              {c.name} {campusName && !user.campus_id ? `— ${campusName}` : ''}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[11px] font-bold text-slate-700">
                          Matière <span className="text-rose-500">*</span>
                        </label>
                        {affiliatedSubjects.length > 0 ? (
                          <span className="text-[10px] font-bold text-indigo-600">
                            ({affiliatedSubjects.length} au programme)
                          </span>
                        ) : subjects.length > 0 ? (
                          <span className="text-[10px] font-medium text-slate-500">
                            ({subjects.length} disponible{subjects.length > 1 ? 's' : ''})
                          </span>
                        ) : null}
                      </div>
                      <select
                        required
                        value={formData.subject_id}
                        onChange={(e) => {
                          const newSubjId = e.target.value;
                          // If there's an assigned teacher for this subject in the class, auto-suggest them
                          let nextStaffId = formData.staff_id;
                          if (formData.class_id && newSubjId) {
                            const assignMatch = allAssignments.find(sa => 
                              (sa.class_id === formData.class_id || matchClasses(sa.class_id || sa.class_name, formData.class_id, classes)) &&
                              matchSubjects(newSubjId, sa.subject_id || sa.subject_name, subjects) &&
                              sa.staff_id
                            );
                            if (assignMatch && !formData.staff_id) {
                              nextStaffId = assignMatch.staff_id;
                            }
                          }
                          setFormData(prev => ({ 
                            ...prev, 
                            subject_id: newSubjId,
                            staff_id: nextStaffId
                          }));
                        }}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                      >
                        <option value="">Sélectionner une matière...</option>
                        {affiliatedSubjects.length > 0 ? (
                          <>
                            <optgroup label={`Matières au programme / Tableau (${affiliatedSubjects.length})`}>
                              {affiliatedSubjects.map(s => (
                                <option key={s.id} value={s.id}>{s.name} {s.code ? `(${s.code})` : ''}</option>
                              ))}
                            </optgroup>
                            {otherSubjects.length > 0 && (
                              <optgroup label={`Autres matières de l'établissement (${otherSubjects.length})`}>
                                {otherSubjects.map(s => (
                                  <option key={s.id} value={s.id}>{s.name} {s.code ? `(${s.code})` : ''}</option>
                                ))}
                              </optgroup>
                            )}
                          </>
                        ) : (
                          subjects.map(s => (
                            <option key={s.id} value={s.id}>{s.name} {s.code ? `(${s.code})` : ''}</option>
                          ))
                        )}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Enseignant <span className="text-rose-500">*</span>
                      </label>
                      <select
                        required
                        value={formData.staff_id}
                        onChange={(e) => {
                          const newStaffId = e.target.value;
                          let nextSubjectId = formData.subject_id;
                          
                          // If teacher has an assigned subject for this class, auto-select it
                          if (newStaffId && formData.class_id) {
                            const staffAssign = allAssignments.find(sa => 
                              sa.staff_id === newStaffId && 
                              (sa.class_id === formData.class_id || matchClasses(sa.class_id || sa.class_name, formData.class_id, classes))
                            );
                            if (staffAssign) {
                              const found = findSubjectInList(staffAssign.subject_id || staffAssign.subject_name, subjects);
                              if (found) nextSubjectId = found.id;
                            }
                          }
                          
                          // If not found in assignments, check teacher's profile subject
                          if (newStaffId && (!nextSubjectId || !affiliatedSubjects.some(s => s.id === nextSubjectId))) {
                            const staffObj = staff.find(s => s.id === newStaffId);
                            if (staffObj && (staffObj as any).subject) {
                              const found = findSubjectInList(String((staffObj as any).subject), subjects);
                              if (found) nextSubjectId = found.id;
                            }
                          }

                          setFormData(prev => ({ 
                            ...prev, 
                            staff_id: newStaffId,
                            subject_id: nextSubjectId
                          }));
                        }}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                      >
                        <option value="">Sélectionner un enseignant...</option>
                        {staff.map(s => (
                          <option key={s.id} value={s.id}>
                            {formatStudentName(s.last_name, s.first_name).fullName}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 2: Horaires et Rémunération */}
              <div className="space-y-2.5">
                <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-1">
                  <Clock size={13} className="text-emerald-600" />
                  <span>Créneau & Tarification</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Jour de la semaine</label>
                    <select
                      required
                      value={formData.day_of_week}
                      onChange={(e) => setFormData({...formData, day_of_week: e.target.value})}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                    >
                      {days.map(day => (
                        <option key={day} value={day}>{day}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Taux horaire (GNF)</label>
                    <input
                      type="number"
                      value={formData.hourly_rate}
                      onChange={(e) => setFormData({...formData, hourly_rate: e.target.value})}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Heure de début</label>
                    <input
                      type="time"
                      required
                      value={formData.start_time}
                      onChange={(e) => setFormData({...formData, start_time: e.target.value})}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Heure de fin</label>
                    <input
                      type="time"
                      required
                      value={formData.end_time}
                      onChange={(e) => setFormData({...formData, end_time: e.target.value})}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                {editingSchedule ? (
                  <button
                    type="button"
                    onClick={() => handleDelete(editingSchedule.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-rose-600 font-bold text-xs hover:bg-rose-50 rounded-xl transition-colors"
                  >
                    <Trash2 size={14} />
                    <span>Supprimer</span>
                  </button>
                ) : <div />}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-3.5 py-1.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-md shadow-indigo-200 hover:shadow-lg transition-all"
                  >
                    {editingSchedule ? 'Enregistrer' : 'Ajouter le cours'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODALE D'APERÇU AVANT IMPRESSION / EXPORT PDF HAUTE FIDÉLITÉ */}
      <PrintPreviewModal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        title={`Emploi du Temps — ${viewMode === 'class' ? (currentSelectedClass?.name || 'Classe') : (currentSelectedStaff ? formatStudentName(currentSelectedStaff.last_name, currentSelectedStaff.first_name).fullName : 'Enseignant')}`}
        subtitle={`Session ${activeAcademicYear?.label || ''} • ${currentCampusObj?.name || 'Établissement Principal'}`}
        onPrint={() => window.print()}
        isExporting={isExportingPDF}
      >
        <SchedulePrintDocument
          school={school}
          campusName={currentCampusObj?.name}
          yearLabel={activeAcademicYear?.label}
          viewMode={viewMode}
          selectedClass={currentSelectedClass}
          selectedStaff={currentSelectedStaff}
          schedules={schedules}
          days={days}
          timeSlots={timeSlots}
        />
      </PrintPreviewModal>
    </div>
  );
};

export default ScheduleView;
