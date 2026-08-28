import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Calendar, Clock, CheckCircle2, XCircle, AlertCircle, Search, 
  FileText, UserCheck, Lock, ChevronLeft, ChevronRight, CheckCheck,
  Users, PieChart, Filter, RefreshCw, Printer, CalendarDays, Grid,
  Info, Sparkles, ShieldCheck, User, PenTool, ChevronDown, BookOpen,
  Building2, GraduationCap, Briefcase
} from 'lucide-react';
import { supabase } from '../supabase';
import { StaffMember, StaffAssignment, StaffAttendance, UserProfile, SchoolType } from '../types';
import { AuditLogger } from '../utils/auditLogger';
import { formatStudentName } from '../utils/formatters';
import { useSchool } from '../contexts/SchoolContext';

interface StaffAttendanceViewProps {
  user: UserProfile;
}

const WEEKDAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const MONTH_NAMES_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

const StaffAttendanceView: React.FC<StaffAttendanceViewProps> = ({ user }) => {
  const { currentCampusId, campuses, setCurrentCampusId, school } = useSchool();
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [assignments, setAssignments] = useState<StaffAssignment[]>([]);
  const [attendances, setAttendances] = useState<StaffAttendance[]>([]);
  const [academicYearId, setAcademicYearId] = useState<string | null>(null);
  
  // Tabs State
  const [activeTab, setActiveTab] = useState<'assignments' | 'calendar' | 'weekly' | 'general' | 'reports'>('assignments');
  
  // Monthly Calendar & Weekly Schedule State
  const [calendarMonth, setCalendarMonth] = useState<string>(
    new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().substring(0, 7)
  );
  const [selectedStaffFilter, setSelectedStaffFilter] = useState<string>('ALL');
  const [monthlyAttendances, setMonthlyAttendances] = useState<StaffAttendance[]>([]);
  const [allSchoolAssignments, setAllSchoolAssignments] = useState<StaffAssignment[]>([]);
  const [loadingMonthly, setLoadingMonthly] = useState<boolean>(false);

  const [selectedDate, setSelectedDate] = useState<string>(
    new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0]
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Présent' | 'Retard' | 'Absent' | 'PENDING'>('ALL');
  const [toast, setToast] = useState<{message: string, type: 'success'|'error'} | null>(null);
  const [bulkSigning, setBulkSigning] = useState(false);
  const [selectedAssignmentIds, setSelectedAssignmentIds] = useState<string[]>([]);
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [showBulkActionMenu, setShowBulkActionMenu] = useState(false);

  const todayStr = useMemo(() => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().split('T')[0];
  }, []);

  const isToday = selectedDate === todayStr;

  const isAdminOrSupervisor = useMemo(() => {
    const role = (user?.role || '').toUpperCase();
    return ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'DIRECTOR', 'ADMINISTRATOR', 'SUPERVISOR'].includes(role);
  }, [user?.role]);

  // Helper to check if a signature is allowed based on time & user permissions
  const canSign = (dateStr: string, startTimeStr: string) => {
    if (isAdminOrSupervisor) return true; // Admins and supervisors can manage attendances freely
    if (dateStr > todayStr) return false; // Future date
    if (dateStr < todayStr) return true;  // Past date

    // Same day: check if current time is past or near the start time
    const now = new Date();
    const currentHours = now.getHours().toString().padStart(2, '0');
    const currentMinutes = now.getMinutes().toString().padStart(2, '0');
    const currentTimeStr = `${currentHours}:${currentMinutes}`;
    
    return currentTimeStr >= startTimeStr;
  };

  const showToast = (message: string, type: 'success'|'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Fetch data for the selected day
  useEffect(() => {
    fetchData();
  }, [user?.school_id, selectedDate, currentCampusId]);

  // Fetch monthly attendances & all assignments for calendar/weekly views
  const fetchMonthlyData = useCallback(async () => {
    if (!user?.school_id) return;
    setLoadingMonthly(true);
    try {
      // 1. Fetch all assignments for school to build calendar & weekly mappings
      let assignmentsQuery = supabase
        .from('staff_assignments')
        .select('*, staff(*)')
        .eq('school_id', user.school_id);

      if (currentCampusId) {
        assignmentsQuery = assignmentsQuery.eq('staff.campus_id', currentCampusId);
      }

      const { data: assignmentsData } = await assignmentsQuery;
      setAllSchoolAssignments(assignmentsData || []);

      // 2. Fetch monthly attendances
      const [yearStr, monthStr] = calendarMonth.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);
      const startDate = `${calendarMonth}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${calendarMonth}-${lastDay.toString().padStart(2, '0')}`;

      let attQuery = supabase
        .from('staff_attendances')
        .select('*')
        .eq('school_id', user.school_id)
        .gte('date', startDate)
        .lte('date', endDate);

      const { data: attData } = await attQuery;
      setMonthlyAttendances(attData || []);
    } catch (err) {
      console.error("Error loading monthly data:", err);
    } finally {
      setLoadingMonthly(false);
    }
  }, [user?.school_id, currentCampusId, calendarMonth]);

  useEffect(() => {
    if (activeTab === 'calendar' || activeTab === 'weekly') {
      fetchMonthlyData();
    }
  }, [activeTab, calendarMonth, fetchMonthlyData]);

  const fetchData = async () => {
    if (!user?.school_id) return;
    setLoading(true);
    
    try {
      // 0. Fetch active academic year
      const { data: years } = await supabase
        .from('academic_years')
        .select('id')
        .eq('school_id', user.school_id)
        .eq('is_active', true)
        .limit(1);
      
      const activeYearId = years && years.length > 0 ? years[0].id : null;
      setAcademicYearId(activeYearId);

      // 1. Fetch staff - ONLY those with assignments or active
      let staffListRes;
      try {
        let query = supabase
          .from('staff')
          .select(`
            *,
            staff_assignments!inner(id, academic_year_id)
          `)
          .eq('school_id', user.school_id)
          .eq('status', 'Actif');
          
        if (currentCampusId) {
          query = query.eq('campus_id', currentCampusId);
        }
        
        query = query.order('last_name');
        
        const { data, error } = await (activeYearId ? query.eq('staff_assignments.academic_year_id', activeYearId) : query);
        
        if (error && error.code === '42703') {
          let fallbackQuery = supabase
            .from('staff')
            .select(`
              *,
              staff_assignments!inner(id)
            `)
            .eq('school_id', user.school_id)
            .eq('status', 'Actif');
            
          if (currentCampusId) {
            fallbackQuery = fallbackQuery.eq('campus_id', currentCampusId);
          }
          
          staffListRes = await fallbackQuery.order('last_name');
        } else {
          staffListRes = { data, error };
        }
      } catch (e) {
        let catchQuery = supabase
          .from('staff')
          .select(`
            *,
            staff_assignments!inner(id)
          `)
          .eq('school_id', user.school_id)
          .eq('status', 'Actif');
          
        if (currentCampusId) {
          catchQuery = catchQuery.eq('campus_id', currentCampusId);
        }
        
        staffListRes = await catchQuery.order('last_name');
      }
        
      if (staffListRes.error) throw staffListRes.error;
      
      // Deduplicate staff
      const uniqueStaff = Array.from(new Map(staffListRes.data?.map((s: any) => [s.id, s])).values()) as StaffMember[];
      setStaff(uniqueStaff || []);

      // 2. Determine day of week for selected date
      const [year, month, day] = selectedDate.split('-');
      const dateObj = new Date(Number(year), Number(month) - 1, Number(day));
      const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
      const dayOfWeek = days[dateObj.getDay()];

      // 3. Fetch assignments for this day
      let assignmentsRes;
      try {
        let query = supabase
          .from('staff_assignments')
          .select('*, staff!inner(*)')
          .eq('school_id', user.school_id)
          .eq('day_of_week', dayOfWeek);
        
        if (currentCampusId) {
          query = query.eq('staff.campus_id', currentCampusId);
        }
        
        const { data, error } = await (activeYearId ? query.eq('academic_year_id', activeYearId) : query);
        
        if (error && error.code === '42703') {
          let fallbackQuery = supabase
            .from('staff_assignments')
            .select('*, staff!inner(*)')
            .eq('school_id', user.school_id)
            .eq('day_of_week', dayOfWeek);
            
          if (currentCampusId) {
            fallbackQuery = fallbackQuery.eq('staff.campus_id', currentCampusId);
          }
          assignmentsRes = await fallbackQuery;
        } else {
          assignmentsRes = { data, error };
        }
      } catch (e) {
        let catchQuery = supabase
          .from('staff_assignments')
          .select('*, staff!inner(*)')
          .eq('school_id', user.school_id)
          .eq('day_of_week', dayOfWeek);
          
        if (currentCampusId) {
          catchQuery = catchQuery.eq('staff.campus_id', currentCampusId);
        }
        assignmentsRes = await catchQuery;
      }
        
      if (assignmentsRes.error) throw assignmentsRes.error;
      setAssignments(assignmentsRes.data || []);

      // 4. Fetch existing attendances for this date
      const { data: attendancesData, error: attendancesError } = await supabase
        .from('staff_attendances')
        .select('*')
        .eq('school_id', user.school_id)
        .eq('date', selectedDate);
        
      if (attendancesError && attendancesError.code !== '42P01') {
        throw attendancesError;
      }
      setAttendances(attendancesData || []);
      
    } catch (error: any) {
      console.error('Error fetching data:', error);
      if (error.code !== '42P01') {
        showToast("Erreur lors du chargement des données.", 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSign = async (staffId: string, status: 'Présent' | 'Absent' | 'Retard' | 'Remplacé', assignment?: StaffAssignment) => {
    if (!user?.school_id) return;
    
    try {
      const existingRecord = assignment 
        ? attendances.find(a => a.assignment_id === assignment.id)
        : attendances.find(a => a.staff_id === staffId && !a.assignment_id);
      
      const payload: any = {
        school_id: user.school_id,
        staff_id: staffId,
        assignment_id: assignment?.id || null,
        date: selectedDate,
        start_time: assignment?.start_time || '08:00',
        end_time: assignment?.end_time || '16:00',
        duration_hours: assignment?.duration_hours || 8,
        status,
        validated_by: user.id
      };

      if (existingRecord) {
        const { error } = await supabase
          .from('staff_attendances')
          .update(payload)
          .eq('id', existingRecord.id)
          .eq('school_id', user.school_id);

        if (error) throw error;

        AuditLogger.log({
          school_id: user.school_id,
          user_id: user.id,
          action: 'UPDATE',
          entity_type: 'staff',
          entity_id: assignment?.staff_id || staffId,
          details: { type: 'attendance', status, date: selectedDate, class_name: assignment?.class_name || 'Général', subject: assignment?.subject_name || 'Général' }
        });
      } else {
        const { error } = await supabase
          .from('staff_attendances')
          .insert([payload]);
        
        if (error) throw error;

        AuditLogger.log({
          school_id: user.school_id,
          user_id: user.id,
          action: 'CREATE',
          entity_type: 'staff',
          entity_id: staffId,
          details: { type: 'attendance', status, date: selectedDate, class_name: assignment?.class_name || 'Général', subject: assignment?.subject_name || 'Général' }
        });
      }

      // Optimistic update locally
      setAttendances(prev => {
        const filtered = prev.filter(a => assignment ? a.assignment_id !== assignment.id : !(a.staff_id === staffId && !a.assignment_id));
        return [...filtered, { ...payload, id: existingRecord?.id || `temp-${Date.now()}` }];
      });

      showToast(`Pointage enregistré : ${status}`);
    } catch (error: any) {
      console.error('Error signing:', error);
      if (error.code === '42P01') {
        showToast("La table staff_attendances n'existe pas encore.", 'error');
      } else {
        showToast("Erreur lors de l'enregistrement.", 'error');
      }
    }
  };

  // Month shift helper
  const shiftCalendarMonth = (deltaMonths: number) => {
    const [y, m] = calendarMonth.split('-').map(Number);
    const date = new Date(y, m - 1 + deltaMonths, 1);
    const newY = date.getFullYear();
    const newM = (date.getMonth() + 1).toString().padStart(2, '0');
    setCalendarMonth(`${newY}-${newM}`);
  };

  // Monthly calendar grid computation
  const calendarGridData = useMemo(() => {
    const [yearStr, monthStr] = calendarMonth.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    
    // First day of month
    const firstDay = new Date(year, month - 1, 1);
    let dayOfWeek = firstDay.getDay(); 
    let offset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    const totalDays = new Date(year, month, 0).getDate();
    const cells: any[] = [];

    // Padding cells
    for (let i = 0; i < offset; i++) {
      cells.push({ isPadding: true, key: `pad-start-${i}` });
    }

    // Days 1..N
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${calendarMonth}-${d.toString().padStart(2, '0')}`;
      const cellDateObj = new Date(year, month - 1, d);
      const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
      const dayName = days[cellDateObj.getDay()];

      // Assignments scheduled for this day of week
      const dayAssignments = allSchoolAssignments.filter(a => {
        if (a.day_of_week !== dayName) return false;
        if (selectedStaffFilter !== 'ALL' && a.staff_id !== selectedStaffFilter) return false;
        return true;
      });

      // Attendances recorded on this date
      const dayAttendances = monthlyAttendances.filter(att => {
        if (att.date !== dateStr) return false;
        if (selectedStaffFilter !== 'ALL' && att.staff_id !== selectedStaffFilter) return false;
        return true;
      });

      let presents = 0;
      let lates = 0;
      let absents = 0;
      dayAttendances.forEach(att => {
        if (att.status === 'Présent') presents++;
        else if (att.status === 'Retard') lates++;
        else if (att.status === 'Absent') absents++;
      });

      cells.push({
        isPadding: false,
        dayNum: d,
        dateStr,
        dayName,
        dayAssignments,
        dayAttendances,
        presents,
        lates,
        absents,
        key: dateStr
      });
    }

    while (cells.length % 7 !== 0) {
      cells.push({ isPadding: true, key: `pad-end-${cells.length}` });
    }

    return cells;
  }, [calendarMonth, allSchoolAssignments, monthlyAttendances, selectedStaffFilter]);

  // Robust Bulk Signing for Course Assignments
  const handleBulkSignAssignments = async (
    status: 'Présent' | 'Absent' | 'Retard' | 'Remplacé' = 'Présent',
    targetAssignmentIds?: string[]
  ) => {
    if (!user?.school_id) return;

    // Filter target assignments (either explicitly selected or all filtered/available)
    const candidates = targetAssignmentIds && targetAssignmentIds.length > 0
      ? assignments.filter(a => targetAssignmentIds.includes(a.id))
      : filteredAssignments.length > 0 ? filteredAssignments : assignments;

    if (candidates.length === 0) {
      showToast("Aucun cours à traiter.", "error");
      return;
    }

    setBulkSigning(true);
    setShowBulkActionMenu(false);

    try {
      const toUpdate: { id: string; payload: any }[] = [];
      const toInsert: any[] = [];
      let skippedCount = 0;

      for (const assignment of candidates) {
        // Skip if non-admin and time is in future
        if (!canSign(selectedDate, assignment.start_time)) {
          skippedCount++;
          continue;
        }

        const existing = attendances.find(a => a.assignment_id === assignment.id);
        const payload: any = {
          school_id: user.school_id,
          staff_id: assignment.staff_id,
          assignment_id: assignment.id,
          date: selectedDate,
          start_time: assignment.start_time || '08:00',
          end_time: assignment.end_time || '10:00',
          duration_hours: assignment.duration_hours || 2,
          status,
          validated_by: user.id
        };

        if (existing) {
          if (existing.status !== status) {
            toUpdate.push({ id: existing.id, payload });
          } else {
            skippedCount++;
          }
        } else {
          toInsert.push(payload);
        }
      }

      const totalToProcess = toUpdate.length + toInsert.length;
      if (totalToProcess === 0) {
        if (skippedCount > 0) {
          showToast(`Tous les cours autorisés ont déjà le statut "${status}".`);
        } else {
          showToast("Aucun cours éligible à marquer.");
        }
        setBulkSigning(false);
        return;
      }

      let successCount = 0;

      // 1. Process updates
      if (toUpdate.length > 0) {
        for (const item of toUpdate) {
          try {
            const { error } = await supabase
              .from('staff_attendances')
              .update(item.payload)
              .eq('id', item.id)
              .eq('school_id', user.school_id);
            if (!error) successCount++;
          } catch (e) {
            console.warn("Update single attendance error:", e);
          }
        }
      }

      // 2. Process inserts
      if (toInsert.length > 0) {
        try {
          const { data, error } = await supabase
            .from('staff_attendances')
            .insert(toInsert)
            .select('id, assignment_id');

          if (!error) {
            successCount += toInsert.length;
          } else {
            // Fallback to item-by-item insert if batch encounters constraint issue
            for (const item of toInsert) {
              try {
                const { error: singleErr } = await supabase
                  .from('staff_attendances')
                  .insert([item]);
                if (!singleErr) successCount++;
              } catch (e) {
                console.warn("Single insert attendance fallback error:", e);
              }
            }
          }
        } catch (batchErr) {
          console.warn("Batch insert exception, fallback to single inserts:", batchErr);
          for (const item of toInsert) {
            try {
              const { error: singleErr } = await supabase
                .from('staff_attendances')
                .insert([item]);
              if (!singleErr) successCount++;
            } catch (e) {
              console.warn("Single insert fallback error:", e);
            }
          }
        }
      }

      // Audit Log
      AuditLogger.log({
        school_id: user.school_id,
        user_id: user.id,
        action: 'CREATE',
        entity_type: 'staff',
        entity_id: user.id,
        details: { 
          type: 'bulk_attendance', 
          count: successCount, 
          status, 
          date: selectedDate 
        }
      });

      // Optimistic local state refresh
      showToast(`${successCount} cours marqué(s) "${status}" avec succès !`);
      setSelectedAssignmentIds([]);
      await fetchData();
    } catch (err: any) {
      console.error("Bulk mark attendance error:", err);
      showToast("Erreur lors de la validation groupée.", "error");
    } finally {
      setBulkSigning(false);
    }
  };

  // Robust Bulk Signing for General Staff
  const handleBulkSignGeneral = async (
    status: 'Présent' | 'Absent' | 'Retard' = 'Présent',
    targetStaffIds?: string[]
  ) => {
    if (!user?.school_id || staff.length === 0) return;

    const candidates = targetStaffIds && targetStaffIds.length > 0
      ? staff.filter(s => targetStaffIds.includes(s.id))
      : staff;

    if (candidates.length === 0) {
      showToast("Aucun membre du personnel à pointer.", "error");
      return;
    }

    setBulkSigning(true);

    try {
      const toUpdate: { id: string; payload: any }[] = [];
      const toInsert: any[] = [];
      let skippedCount = 0;

      for (const s of candidates) {
        const existing = attendances.find(a => a.staff_id === s.id && !a.assignment_id);
        const payload: any = {
          school_id: user.school_id,
          staff_id: s.id,
          assignment_id: null,
          date: selectedDate,
          start_time: '08:00',
          end_time: '16:00',
          duration_hours: 8,
          status,
          validated_by: user.id
        };

        if (existing) {
          if (existing.status !== status) {
            toUpdate.push({ id: existing.id, payload });
          } else {
            skippedCount++;
          }
        } else {
          toInsert.push(payload);
        }
      }

      const totalToProcess = toUpdate.length + toInsert.length;
      if (totalToProcess === 0) {
        showToast(`Tous les collaborateurs ont déjà le statut "${status}".`);
        setBulkSigning(false);
        return;
      }

      let successCount = 0;

      // Updates
      if (toUpdate.length > 0) {
        for (const item of toUpdate) {
          try {
            const { error } = await supabase
              .from('staff_attendances')
              .update(item.payload)
              .eq('id', item.id)
              .eq('school_id', user.school_id);
            if (!error) successCount++;
          } catch (e) {
            console.warn("Update general attendance error:", e);
          }
        }
      }

      // Inserts
      if (toInsert.length > 0) {
        try {
          const { error } = await supabase
            .from('staff_attendances')
            .insert(toInsert);
          if (!error) {
            successCount += toInsert.length;
          } else {
            for (const item of toInsert) {
              try {
                const { error: sErr } = await supabase
                  .from('staff_attendances')
                  .insert([item]);
                if (!sErr) successCount++;
              } catch (e) {
                console.warn("Fallback single insert general attendance:", e);
              }
            }
          }
        } catch (batchErr) {
          for (const item of toInsert) {
            try {
              const { error: sErr } = await supabase
                .from('staff_attendances')
                .insert([item]);
              if (!sErr) successCount++;
            } catch (e) {
              console.warn("Fallback single insert general attendance:", e);
            }
          }
        }
      }

      AuditLogger.log({
        school_id: user.school_id,
        user_id: user.id,
        action: 'CREATE',
        entity_type: 'staff',
        entity_id: user.id,
        details: { type: 'bulk_general_attendance', count: successCount, status, date: selectedDate }
      });

      showToast(`${successCount} membre(s) du personnel marqué(s) "${status}" avec succès !`);
      setSelectedStaffIds([]);
      await fetchData();
    } catch (err: any) {
      console.error("Bulk general sign error:", err);
      showToast("Erreur lors du pointage groupé.", "error");
    } finally {
      setBulkSigning(false);
    }
  };

  const handleBulkMarkPresent = () => handleBulkSignAssignments('Présent');

  // School Category Adaptations
  const isUniversity = (school?.school_type as any) === SchoolType.UNIVERSITY || (school?.school_type as any) === 'UNIVERSITY';
  const isProfessional = (school?.school_type as any) === SchoolType.PROFESSIONAL || (school?.school_type as any) === 'PROFESSIONAL';

  const schoolCategoryBadge = useMemo(() => {
    if (isUniversity) {
      return {
        label: 'Enseignement Supérieur / Universitaire',
        icon: GraduationCap,
        color: 'bg-indigo-500/20 text-indigo-200 border-indigo-400/30',
      };
    }
    if (isProfessional) {
      return {
        label: 'Formation Professionnelle & Technique',
        icon: Briefcase,
        color: 'bg-amber-500/20 text-amber-200 border-amber-400/30',
      };
    }
    return {
      label: 'Enseignement Général & Secondaire',
      icon: BookOpen,
      color: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30',
    };
  }, [isUniversity, isProfessional]);

  // Date Navigation Helpers
  const shiftDate = (days: number) => {
    const current = new Date(selectedDate + 'T00:00:00');
    current.setDate(current.getDate() + days);
    setSelectedDate(current.toISOString().split('T')[0]);
  };

  const selectedDateObj = useMemo(() => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    return new Date(y, m - 1, d);
  }, [selectedDate]);

  const dayOfWeekName = useMemo(() => {
    const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    return days[selectedDateObj.getDay()];
  }, [selectedDateObj]);

  const terms = useMemo(() => {
    if (isUniversity) {
      return {
        teacherCol: 'Professeur / Intervenant',
        classCol: 'Séance & Promotion / Salle',
        sessionSingular: 'Séance',
        sessionPlural: 'Séances',
        headerSubtitle: 'Contrôle des présences et émargements des professeurs, vacataires, intervenants et personnel universitaire.',
        emptyTitle: 'Aucune séance programmée',
        emptyDesc: `Aucun cours magistral, TD, TP ou séminaire n'est inscrit à l'emploi du temps pour ce ${dayOfWeekName.toLowerCase()} ${selectedDateObj.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}. Vous pouvez enregistrer les émargements du personnel via le Pointage Général ou naviguer dans le planning.`,
      };
    }
    if (isProfessional) {
      return {
        teacherCol: 'Formateur / Intervenant',
        classCol: 'Module & Filière / Atelier',
        sessionSingular: 'Module',
        sessionPlural: 'Modules',
        headerSubtitle: 'Contrôle des présences et émargements des formateurs, tuteurs d\'atelier et personnel du centre.',
        emptyTitle: 'Aucun module programmé',
        emptyDesc: `Aucune session ou atelier pratique n'est inscrit au planning pour ce ${dayOfWeekName.toLowerCase()} ${selectedDateObj.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}. Vous pouvez pointer les formateurs et équipes via le Pointage Général.`,
      };
    }
    return {
      teacherCol: 'Enseignant',
      classCol: 'Cours & Classe',
      sessionSingular: 'Cours',
      sessionPlural: 'Cours',
      headerSubtitle: 'Contrôle quotidien des présences, émargements des professeurs et personnel administratif.',
      emptyTitle: 'Aucun cours programmé',
      emptyDesc: `Aucun cours n'est inscrit à l'emploi du temps pour ce ${dayOfWeekName.toLowerCase()} ${selectedDateObj.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}. Vous pouvez enregistrer les présences via le Pointage Général.`,
    };
  }, [isUniversity, isProfessional, dayOfWeekName, selectedDateObj]);

  const activeWeekdays = useMemo(() => {
    const hasSundayCourses = assignments.some(a => a.day_of_week === 'Dimanche');
    if (isUniversity || isProfessional || hasSundayCourses) {
      return ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
    }
    return ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  }, [isUniversity, isProfessional, assignments]);

  const getCampusName = useCallback((campusId?: string | null) => {
    if (!campusId || !campuses || campuses.length === 0) return null;
    const c = campuses.find(item => item.id === campusId);
    return c ? c.name : null;
  }, [campuses]);

  // Filtered Assignments
  const filteredAssignments = useMemo(() => {
    let list = assignments.filter(a => {
      if (!searchTerm) return true;
      const searchLower = searchTerm.toLowerCase();
      const staffName = a.staff ? formatStudentName(a.staff.last_name, a.staff.first_name).fullName.toLowerCase() : '';
      return staffName.includes(searchLower) || 
             a.subject_name.toLowerCase().includes(searchLower) ||
             a.class_name.toLowerCase().includes(searchLower);
    });

    if (statusFilter !== 'ALL') {
      list = list.filter(a => {
        const att = attendances.find(att => att.assignment_id === a.id);
        if (statusFilter === 'PENDING') return !att;
        return att?.status === statusFilter;
      });
    }

    return list.sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [assignments, searchTerm, statusFilter, attendances]);

  // Statistics calculation
  const stats = useMemo(() => {
    const totalCourses = assignments.length;
    let present = 0;
    let late = 0;
    let absent = 0;
    let pending = 0;

    assignments.forEach(a => {
      const att = attendances.find(item => item.assignment_id === a.id);
      if (!att) pending++;
      else if (att.status === 'Présent') present++;
      else if (att.status === 'Retard') late++;
      else if (att.status === 'Absent') absent++;
    });

    const rate = totalCourses > 0 ? Math.round(((present + late) / totalCourses) * 100) : 0;

    return { totalCourses, present, late, absent, pending, rate };
  }, [assignments, attendances]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 px-5 py-3 rounded-2xl text-white shadow-2xl transition-all z-50 flex items-center gap-3 font-semibold text-sm ${
          toast.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          {toast.message}
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex items-center justify-between gap-3 flex-wrap md:flex-nowrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shrink-0">
              <UserCheck className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-xl font-black tracking-tight text-white">
                  Pointage & Présences Staff
                </h1>

                {/* School Category / Institutional Type Badge */}
                <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-xl border text-[11px] font-bold ${schoolCategoryBadge.color}`}>
                  <schoolCategoryBadge.icon size={13} className="shrink-0" />
                  <span>{schoolCategoryBadge.label}</span>
                </div>

                {/* Multi-Campus / Annexe Badge or Switcher */}
                {campuses && campuses.length > 0 && (
                  <div className="inline-flex items-center gap-1.5 bg-white/10 backdrop-blur-md px-2.5 py-1 rounded-xl border border-white/15 text-[11px] text-indigo-200">
                    <Building2 size={13} className="text-indigo-300 shrink-0" />
                    {user.campus_id ? (
                      <span className="font-bold text-white">
                        {campuses.find(c => c.id === user.campus_id)?.name || 'Annexe assignée'}
                      </span>
                    ) : (
                      <select
                        value={currentCampusId || 'GLOBAL'}
                        onChange={(e) => setCurrentCampusId(e.target.value === 'GLOBAL' ? null : e.target.value)}
                        className="bg-transparent text-white font-bold outline-none cursor-pointer pr-1"
                      >
                        <option value="GLOBAL" className="text-slate-900 bg-white font-semibold">Tous les Campus (Global)</option>
                        {campuses.map(c => (
                          <option key={c.id} value={c.id} className="text-slate-900 bg-white font-semibold">
                            {c.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
              </div>
              <p className="text-slate-300 text-[11px] sm:text-xs mt-0.5 font-medium">
                {terms.headerSubtitle}
              </p>
            </div>
          </div>
        </div>

        {/* Date Selector Quick Bar */}
        <div className="relative z-10 flex items-center gap-1.5 bg-white/10 backdrop-blur-md p-1.5 rounded-2xl border border-white/15 self-start md:self-auto shrink-0">
          <button
            type="button"
            onClick={() => shiftDate(-1)}
            className="p-1.5 sm:p-2 hover:bg-white/15 rounded-xl transition-all text-white/80 hover:text-white"
            title="Jour précédent"
          >
            <ChevronLeft size={16} />
          </button>

          <div className="flex items-center gap-1.5 px-2 sm:px-3 py-1">
            <Calendar size={15} className="text-indigo-300 shrink-0" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-white font-bold text-xs outline-none cursor-pointer text-center"
            />
          </div>

          <button
            type="button"
            onClick={() => shiftDate(1)}
            className="p-1.5 sm:p-2 hover:bg-white/15 rounded-xl transition-all text-white/80 hover:text-white"
            title="Jour suivant"
          >
            <ChevronRight size={16} />
          </button>

          {!isToday && (
            <button
              type="button"
              onClick={() => setSelectedDate(todayStr)}
              className="px-2.5 sm:px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
            >
              Aujourd'hui
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards - Compact and Balanced for 14-inch Displays */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
        <div className="bg-white p-3 sm:p-3.5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between hover:border-slate-300 transition-colors">
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider truncate">Séances du Jour</p>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl sm:text-2xl font-black text-slate-900">{stats.totalCourses}</span>
              <span className="text-[10px] font-bold text-slate-400">cours</span>
            </div>
          </div>
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
            <Calendar size={17} />
          </div>
        </div>

        <div className="bg-white p-3 sm:p-3.5 rounded-2xl border border-emerald-100 shadow-xs flex items-center justify-between hover:border-emerald-200 transition-colors">
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold text-emerald-600 uppercase tracking-wider truncate">Présents</p>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl sm:text-2xl font-black text-emerald-700">{stats.present}</span>
              <span className="text-[10px] font-bold text-emerald-600/70">émargés</span>
            </div>
          </div>
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
            <CheckCircle2 size={17} />
          </div>
        </div>

        <div className="bg-white p-3 sm:p-3.5 rounded-2xl border border-amber-100 shadow-xs flex items-center justify-between hover:border-amber-200 transition-colors">
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold text-amber-600 uppercase tracking-wider truncate">Retards</p>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl sm:text-2xl font-black text-amber-700">{stats.late}</span>
              <span className="text-[10px] font-bold text-amber-600/70">signalés</span>
            </div>
          </div>
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center shrink-0">
            <Clock size={17} />
          </div>
        </div>

        <div className="bg-white p-3 sm:p-3.5 rounded-2xl border border-rose-100 shadow-xs flex items-center justify-between hover:border-rose-200 transition-colors">
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold text-rose-600 uppercase tracking-wider truncate">Absents</p>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl sm:text-2xl font-black text-rose-700">{stats.absent}</span>
              <span className="text-[10px] font-bold text-rose-600/70">non justifiés</span>
            </div>
          </div>
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center shrink-0">
            <XCircle size={17} />
          </div>
        </div>

        <div className="bg-white p-3 sm:p-3.5 rounded-2xl border border-indigo-100 shadow-xs flex items-center justify-between col-span-2 sm:col-span-1 hover:border-indigo-200 transition-colors">
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold text-indigo-600 uppercase tracking-wider truncate">Taux Assiduité</p>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl sm:text-2xl font-black text-indigo-700">{stats.rate}%</span>
              <span className="text-[10px] font-bold text-indigo-600/70">global</span>
            </div>
          </div>
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center shrink-0">
            <PieChart size={17} />
          </div>
        </div>
      </div>

      {/* Tabs & Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-2 rounded-2xl border border-slate-200 shadow-xs overflow-x-auto">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl shrink-0 overflow-x-auto">
          <button
            onClick={() => setActiveTab('assignments')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === 'assignments' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock size={14} />
            Par Cours / Journée
          </button>

          <button
            onClick={() => setActiveTab('calendar')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === 'calendar' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CalendarDays size={14} />
            Calendrier Mensuel
          </button>

          <button
            onClick={() => setActiveTab('weekly')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === 'weekly' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Grid size={14} />
            Planning Semaine
          </button>

          <button
            onClick={() => setActiveTab('general')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === 'general' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users size={14} />
            Pointage Général
          </button>

          <button
            onClick={() => setActiveTab('reports')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === 'reports' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText size={14} />
            Rapports & Synthèse
          </button>
        </div>

        {activeTab === 'assignments' && (
          <div className="relative flex items-center gap-2 shrink-0">
            <div className="inline-flex rounded-xl shadow-xs">
              <button
                onClick={() => handleBulkSignAssignments('Présent')}
                disabled={bulkSigning || assignments.length === 0}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-l-xl text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed border-r border-emerald-500/50"
                title="Valider la présence pour tous les cours de la journée"
              >
                {bulkSigning ? <RefreshCw size={13} className="animate-spin" /> : <CheckCheck size={14} />}
                <span>Tout Marquer Présent</span>
              </button>
              <button
                type="button"
                onClick={() => setShowBulkActionMenu(prev => !prev)}
                disabled={bulkSigning || assignments.length === 0}
                className="px-2 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-r-xl text-xs font-bold transition-all disabled:opacity-50"
                title="Options de pointage groupé"
              >
                <ChevronDown size={14} />
              </button>
            </div>

            {showBulkActionMenu && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider px-2 py-1">
                  Pointage Groupé (Tous les cours)
                </p>
                <button
                  type="button"
                  onClick={() => handleBulkSignAssignments('Présent')}
                  className="w-full text-left px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50 rounded-xl flex items-center gap-2 transition-colors"
                >
                  <CheckCircle2 size={14} className="text-emerald-600" />
                  Tous Marquer Présents
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkSignAssignments('Retard')}
                  className="w-full text-left px-3 py-2 text-xs font-bold text-amber-700 hover:bg-amber-50 rounded-xl flex items-center gap-2 transition-colors"
                >
                  <Clock size={14} className="text-amber-600" />
                  Tous Marquer en Retard
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkSignAssignments('Absent')}
                  className="w-full text-left px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 rounded-xl flex items-center gap-2 transition-colors"
                >
                  <XCircle size={14} className="text-rose-600" />
                  Tous Marquer Absents
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'general' && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => handleBulkSignGeneral('Présent')}
              disabled={bulkSigning || staff.length === 0}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Valider la présence pour tout le personnel"
            >
              {bulkSigning ? <RefreshCw size={13} className="animate-spin" /> : <CheckCheck size={14} />}
              <span>Tout Marquer Présent (Staff)</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Content Card */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Search & Toolbar Header */}
        <div className="p-4 sm:p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row gap-3 justify-between items-stretch md:items-center">
          {activeTab === 'calendar' ? (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 w-full">
              {/* Month Navigation */}
              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-2xl border border-slate-200 shadow-sm">
                <button
                  onClick={() => shiftCalendarMonth(-1)}
                  className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-600 transition-all"
                  title="Mois précédent"
                >
                  <ChevronLeft size={18} />
                </button>
                <div className="flex items-center gap-2 font-black text-sm text-slate-900 min-w-[140px] justify-center">
                  <Calendar size={16} className="text-indigo-600" />
                  <span>
                    {MONTH_NAMES_FR[parseInt(calendarMonth.split('-')[1], 10) - 1]} {calendarMonth.split('-')[0]}
                  </span>
                </div>
                <button
                  onClick={() => shiftCalendarMonth(1)}
                  className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-600 transition-all"
                  title="Mois suivant"
                >
                  <ChevronRight size={18} />
                </button>
              </div>

              {/* Staff Selector Filter */}
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-500 flex items-center gap-1 shrink-0">
                  <Filter size={14} className="text-indigo-600" /> Intervenant :
                </span>
                <select
                  value={selectedStaffFilter}
                  onChange={(e) => setSelectedStaffFilter(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
                >
                  <option value="ALL">-- Tous les collaborateurs --</option>
                  {staff.map(s => (
                    <option key={s.id} value={s.id}>
                      {formatStudentName(s.last_name, s.first_name).fullName} ({s.role})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : activeTab === 'weekly' ? (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 w-full">
              <div className="flex items-center gap-2">
                <Grid size={18} className="text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Planning Hebdomadaire des Cours & Co-Enseignants
                </h3>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-500 flex items-center gap-1 shrink-0">
                  <Filter size={14} className="text-indigo-600" /> Filtrer par Prof :
                </span>
                <select
                  value={selectedStaffFilter}
                  onChange={(e) => setSelectedStaffFilter(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
                >
                  <option value="ALL">-- Tous les enseignants --</option>
                  {staff.map(s => (
                    <option key={s.id} value={s.id}>
                      {formatStudentName(s.last_name, s.first_name).fullName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <>
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder={activeTab === 'assignments' ? "Filtrer par enseignant, cours, classe..." : "Rechercher par nom de membre du staff..."}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-xs font-medium text-slate-900 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                />
                {searchTerm && (
                  <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold">
                    ✕
                  </button>
                )}
              </div>

              {activeTab === 'assignments' && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1 flex items-center gap-1">
                    <Filter size={12} /> Statut:
                  </span>
                  {[
                    { label: 'Tous', value: 'ALL' },
                    { label: 'Présents', value: 'Présent' },
                    { label: 'Retards', value: 'Retard' },
                    { label: 'Absents', value: 'Absent' },
                    { label: 'En attente', value: 'PENDING' }
                  ].map(f => (
                    <button
                      key={f.value}
                      onClick={() => setStatusFilter(f.value as any)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                        statusFilter === f.value 
                          ? 'bg-slate-900 text-white shadow-sm' 
                          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* View Content */}
        <div className="p-0">
          {loading ? (
            <div className="flex flex-col justify-center items-center h-64 gap-3">
              <RefreshCw className="animate-spin text-indigo-600 w-8 h-8" />
              <p className="text-xs font-bold text-slate-400">Chargement du registre de pointage...</p>
            </div>
          ) : activeTab === 'calendar' ? (
            /* VISUAL MONTHLY CALENDAR VIEW */
            <div className="p-6 space-y-5">
              {/* Legend & Stats Banner */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-indigo-50/60 p-4 rounded-2xl border border-indigo-100">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-indigo-600" />
                  <span className="text-xs font-bold text-indigo-900">
                    Calendrier de Présence - {MONTH_NAMES_FR[parseInt(calendarMonth.split('-')[1], 10) - 1]} {calendarMonth.split('-')[0]}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs font-bold flex-wrap">
                  <span className="flex items-center gap-1.5 text-emerald-700 bg-emerald-100/80 px-2.5 py-1 rounded-lg">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" /> Présent
                  </span>
                  <span className="flex items-center gap-1.5 text-amber-700 bg-amber-100/80 px-2.5 py-1 rounded-lg">
                    <span className="w-2 h-2 rounded-full bg-amber-500" /> Retard
                  </span>
                  <span className="flex items-center gap-1.5 text-rose-700 bg-rose-100/80 px-2.5 py-1 rounded-lg">
                    <span className="w-2 h-2 rounded-full bg-rose-500" /> Absent
                  </span>
                  <span className="flex items-center gap-1.5 text-slate-600 bg-slate-200/80 px-2.5 py-1 rounded-lg">
                    <span className="w-2 h-2 rounded-full bg-slate-400" /> Pas de cours
                  </span>
                </div>
              </div>

              {loadingMonthly ? (
                <div className="py-20 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs">
                  <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
                  Chargement du calendrier mensuel...
                </div>
              ) : (
                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                  {/* Days of week Header */}
                  <div className="grid grid-cols-7 bg-slate-900 text-white text-center py-2.5 text-xs font-extrabold uppercase tracking-wider">
                    <div>Lun</div>
                    <div>Mar</div>
                    <div>Mer</div>
                    <div>Jeu</div>
                    <div>Ven</div>
                    <div>Sam</div>
                    <div>Dim</div>
                  </div>

                  {/* Days Cells Grid */}
                  <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 bg-slate-50/30">
                    {calendarGridData.map((cell) => {
                      if (cell.isPadding) {
                        return <div key={cell.key} className="min-h-[100px] bg-slate-50/50" />;
                      }

                      const isCurrentDay = cell.dateStr === todayStr;
                      const hasCourses = cell.dayAssignments.length > 0;

                      return (
                        <div
                          key={cell.key}
                          onClick={() => {
                            setSelectedDate(cell.dateStr);
                            setActiveTab('assignments');
                            showToast(`Pointage pour le ${cell.dateStr}`);
                          }}
                          className={`min-h-[110px] p-2 flex flex-col justify-between transition-all cursor-pointer group hover:bg-indigo-50/30 ${
                            isCurrentDay ? 'bg-indigo-50/80 ring-2 ring-indigo-500 ring-inset' : 'bg-white'
                          }`}
                        >
                          {/* Top row: Day number */}
                          <div className="flex items-center justify-between">
                            <span className={`text-xs font-black rounded-lg w-6 h-6 flex items-center justify-center ${
                              isCurrentDay ? 'bg-indigo-600 text-white' : 'text-slate-800'
                            }`}>
                              {cell.dayNum}
                            </span>

                            {hasCourses && (
                              <span className="text-[10px] font-bold text-slate-400">
                                {cell.dayAssignments.length} c.
                              </span>
                            )}
                          </div>

                          {/* Content status badges */}
                          <div className="my-1 space-y-1">
                            {!hasCourses ? (
                              <span className="text-[10px] font-medium text-slate-300 block text-center py-2">
                                —
                              </span>
                            ) : selectedStaffFilter !== 'ALL' ? (
                              /* Specific teacher view */
                              <div className="space-y-1">
                                {cell.dayAssignments.slice(0, 2).map((a: any) => {
                                  const att = cell.dayAttendances.find((item: any) => item.assignment_id === a.id);
                                  return (
                                    <div
                                      key={a.id}
                                      className={`p-1 rounded-md text-[10px] font-bold truncate flex items-center justify-between ${
                                        att?.status === 'Présent' ? 'bg-emerald-100 text-emerald-800' :
                                        att?.status === 'Retard' ? 'bg-amber-100 text-amber-800' :
                                        att?.status === 'Absent' ? 'bg-rose-100 text-rose-800' :
                                        'bg-slate-100 text-slate-600'
                                      }`}
                                    >
                                      <span className="truncate">{a.class_name} ({a.start_time.substring(0, 5)})</span>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              /* All staff view */
                              <div className="flex flex-col gap-1">
                                {cell.presents > 0 && (
                                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-1.5 py-0.5 rounded text-center">
                                    {cell.presents} Présent(s)
                                  </span>
                                )}
                                {cell.lates > 0 && (
                                  <span className="bg-amber-100 text-amber-800 text-[10px] font-extrabold px-1.5 py-0.5 rounded text-center">
                                    {cell.lates} Retard(s)
                                  </span>
                                )}
                                {cell.absents > 0 && (
                                  <span className="bg-rose-100 text-rose-800 text-[10px] font-extrabold px-1.5 py-0.5 rounded text-center">
                                    {cell.absents} Absent(s)
                                  </span>
                                )}
                                {cell.presents === 0 && cell.lates === 0 && cell.absents === 0 && (
                                  <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1 py-0.5 rounded text-center">
                                    Non émargé
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Bottom Hover hint */}
                          <div className="text-[9px] font-bold text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity text-right">
                            Gérer le pointage →
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : activeTab === 'weekly' ? (
            /* WEEKLY TIMETABLE & MULTI-TEACHER VIEW */
            <div className="p-6 space-y-5">
              {/* Weekly Timetable Columns */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeWeekdays.map((dayName) => {
                  const dayAssignments = allSchoolAssignments.filter(a => {
                    if (a.day_of_week !== dayName) return false;
                    if (selectedStaffFilter !== 'ALL' && a.staff_id !== selectedStaffFilter) return false;
                    return true;
                  });

                  return (
                    <div key={dayName} className="bg-slate-50/70 rounded-2xl border border-slate-200 p-4 space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                        <h4 className="font-black text-slate-900 text-sm flex items-center gap-2">
                          <Calendar size={14} className="text-indigo-600" /> {dayName}
                        </h4>
                        <span className="text-[10px] font-extrabold bg-indigo-100 text-indigo-800 px-2.5 py-0.5 rounded-full">
                          {dayAssignments.length} {dayAssignments.length <= 1 ? terms.sessionSingular.toLowerCase() : terms.sessionPlural.toLowerCase()}
                        </span>
                      </div>

                      {dayAssignments.length === 0 ? (
                        <div className="py-8 text-center text-slate-400 text-xs italic">
                          Aucun {terms.sessionSingular.toLowerCase()} programmé
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          {dayAssignments.map((a: any) => {
                            // Find co-teachers for the same class and subject on the same day/time
                            const coTeachers = allSchoolAssignments.filter(other => 
                              other.id !== a.id &&
                              other.class_id === a.class_id &&
                              other.subject_id === a.subject_id &&
                              other.day_of_week === dayName &&
                              other.start_time === a.start_time
                            );

                            const staffName = a.staff 
                              ? formatStudentName(a.staff.last_name, a.staff.first_name).fullName
                              : 'Enseignant non spécifié';

                            return (
                              <div
                                key={a.id}
                                className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm space-y-1.5 hover:border-indigo-300 transition-all"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md">
                                    {a.start_time.substring(0, 5)} - {a.end_time.substring(0, 5)}
                                  </span>
                                  <span className="text-[10px] font-black text-indigo-600 uppercase">
                                    {a.class_name}
                                  </span>
                                </div>

                                <h5 className="font-bold text-slate-900 text-xs">
                                  {a.subject_name}
                                </h5>

                                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                                  <User size={13} className="text-indigo-500" />
                                  <span>{staffName}</span>
                                </div>

                                {/* Co-teachers badge */}
                                {coTeachers.length > 0 && (
                                  <div className="pt-1.5 border-t border-slate-100 flex items-center gap-1 text-[10px] text-amber-800 font-bold bg-amber-50 p-1.5 rounded-lg border border-amber-200/60">
                                    <Users size={12} className="text-amber-600 shrink-0" />
                                    <span>
                                      Co-intervenant(s) : {coTeachers.map(c => formatStudentName(c.staff?.last_name, c.staff?.first_name).fullName).join(', ')}
                                    </span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : activeTab === 'assignments' ? (
            filteredAssignments.length === 0 ? (
              <div className="text-center py-12 sm:py-16 px-4 max-w-xl mx-auto">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 bg-indigo-50 text-indigo-600 border border-indigo-200/70 shadow-xs">
                  <CalendarDays className="w-7 h-7" />
                </div>

                {/* Institutional Type Tag */}
                <div className="mb-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                    <schoolCategoryBadge.icon size={11} className="text-indigo-500" />
                    {schoolCategoryBadge.label}
                  </span>
                </div>

                <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                  {searchTerm || statusFilter !== 'ALL' 
                    ? "Aucun résultat trouvé" 
                    : `${terms.emptyTitle} (${dayOfWeekName})`}
                </h3>

                <p className="text-slate-500 text-xs mt-1.5 leading-relaxed">
                  {searchTerm || statusFilter !== 'ALL'
                    ? "Aucune séance ou personnel ne correspond à vos critères de recherche actuels."
                    : terms.emptyDesc}
                </p>

                {/* Quick Ergonomic Actions */}
                <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => shiftDate(-1)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition-all flex items-center gap-1.5 active:scale-95 shadow-xs"
                    title="Jour précédent"
                  >
                    <ChevronLeft size={13} />
                    <span>Jour précédent</span>
                  </button>

                  {selectedDate !== todayStr && (
                    <button
                      type="button"
                      onClick={() => setSelectedDate(todayStr)}
                      className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl border border-indigo-200 transition-all flex items-center gap-1.5 active:scale-95 shadow-xs"
                    >
                      <Sparkles size={13} />
                      <span>Aujourd'hui</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => shiftDate(1)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition-all flex items-center gap-1.5 active:scale-95 shadow-xs"
                    title="Jour suivant"
                  >
                    <span>Jour suivant</span>
                    <ChevronRight size={13} />
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('general')}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 active:scale-95 shadow-xs"
                  >
                    <Users size={13} />
                    <span>Pointage Général (Staff)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('weekly')}
                    className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition-all flex items-center gap-1.5 active:scale-95 shadow-xs"
                  >
                    <Grid size={13} />
                    <span>Planning Semaine</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('calendar')}
                    className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition-all flex items-center gap-1.5 active:scale-95 shadow-xs"
                  >
                    <Calendar size={13} />
                    <span>Calendrier Mensuel</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                {/* Batch Selection Action Bar for Assignments */}
                {selectedAssignmentIds.length > 0 && (
                  <div className="bg-indigo-900 text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs font-bold animate-in fade-in duration-150">
                    <div className="flex items-center gap-2">
                      <span className="bg-indigo-700 px-2 py-0.5 rounded-md text-[11px]">
                        {selectedAssignmentIds.length} sélectionné(s)
                      </span>
                      <span className="text-indigo-200 text-xs hidden sm:inline">
                        Appliquer une action groupée aux cours sélectionnés :
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleBulkSignAssignments('Présent', selectedAssignmentIds)}
                        disabled={bulkSigning}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-all flex items-center gap-1 active:scale-95 shadow-xs"
                      >
                        <CheckCircle2 size={13} />
                        <span>Marquer Présents ({selectedAssignmentIds.length})</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleBulkSignAssignments('Retard', selectedAssignmentIds)}
                        disabled={bulkSigning}
                        className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-all flex items-center gap-1 active:scale-95 shadow-xs"
                      >
                        <Clock size={13} />
                        <span>Marquer en Retard</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleBulkSignAssignments('Absent', selectedAssignmentIds)}
                        disabled={bulkSigning}
                        className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition-all flex items-center gap-1 active:scale-95 shadow-xs"
                      >
                        <XCircle size={13} />
                        <span>Marquer Absents</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedAssignmentIds([])}
                        className="px-2 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all"
                        title="Désélectionner tout"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                )}

                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="bg-slate-900 text-white border-b border-slate-800">
                      <th className="py-3 px-3 sm:px-4 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={filteredAssignments.length > 0 && selectedAssignmentIds.length === filteredAssignments.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedAssignmentIds(filteredAssignments.map(a => a.id));
                            } else {
                              setSelectedAssignmentIds([]);
                            }
                          }}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-500"
                          title="Sélectionner tous les cours"
                        />
                      </th>
                      <th className="py-3 px-4 sm:px-6 text-[10px] font-extrabold uppercase tracking-wider">Horaires & Durée</th>
                      <th className="py-3 px-4 sm:px-6 text-[10px] font-extrabold uppercase tracking-wider">{terms.teacherCol}</th>
                      <th className="py-3 px-4 sm:px-6 text-[10px] font-extrabold uppercase tracking-wider">{terms.classCol}</th>
                      <th className="py-3 px-4 sm:px-6 text-[10px] font-extrabold uppercase tracking-wider">Statut Pointage</th>
                      <th className="py-3 px-4 sm:px-6 text-[10px] font-extrabold uppercase tracking-wider text-right">Actions Rapides</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredAssignments.map((assignment) => {
                      const attendance = attendances.find(a => a.assignment_id === assignment.id);
                      const isAllowedToSign = canSign(selectedDate, assignment.start_time);
                      const isSelected = selectedAssignmentIds.includes(assignment.id);
                      const staffName = assignment.staff 
                        ? formatStudentName(assignment.staff.last_name, assignment.staff.first_name).fullName 
                        : 'Enseignant Inconnu';
                      const campusName = getCampusName(assignment.staff?.campus_id);
                      
                      return (
                        <tr 
                          key={assignment.id} 
                          className={`transition-colors group ${
                            isSelected ? 'bg-indigo-50/70 hover:bg-indigo-50' : 'hover:bg-slate-50/80'
                          }`}
                        >
                          <td className="py-3.5 px-3 sm:px-4 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedAssignmentIds(prev => [...prev, assignment.id]);
                                } else {
                                  setSelectedAssignmentIds(prev => prev.filter(id => id !== assignment.id));
                                }
                              }}
                              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-500"
                            />
                          </td>

                          <td className="py-3.5 px-4 sm:px-6">
                            <div className="flex items-center gap-1.5 text-slate-900 font-bold text-xs sm:text-sm">
                              <Clock className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                              {assignment.start_time.substring(0, 5)} - {assignment.end_time.substring(0, 5)}
                            </div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5 inline-block bg-slate-100 px-2 py-0.5 rounded-md">
                              {assignment.duration_hours} heure(s)
                            </span>
                          </td>

                          <td className="py-3.5 px-4 sm:px-6">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 font-black text-xs flex items-center justify-center shrink-0">
                                {assignment.staff?.first_name?.charAt(0)}{assignment.staff?.last_name?.charAt(0)}
                              </div>
                              <div className="min-w-0">
                                <div className="font-bold text-slate-900 text-xs sm:text-sm group-hover:text-indigo-600 transition-colors truncate">
                                  {staffName}
                                </div>
                                <div className="flex items-center gap-1.5 flex-wrap text-[10px] font-medium text-slate-400">
                                  <span>ID: {assignment.staff_id.slice(0, 8)}</span>
                                  {campusName && (
                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 bg-indigo-50 text-indigo-700 font-bold rounded-md border border-indigo-100">
                                      📍 {campusName}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 sm:px-6">
                            <div className="font-bold text-slate-900 text-xs sm:text-sm">{assignment.class_name}</div>
                            <div className="text-xs text-indigo-600 font-semibold mt-0.5">{assignment.subject_name}</div>
                          </td>

                          <td className="py-3.5 px-4 sm:px-6">
                            {attendance ? (
                              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold border ${
                                attendance.status === 'Présent' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                attendance.status === 'Absent' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                                attendance.status === 'Retard' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                'bg-purple-50 text-purple-700 border-purple-200'
                              }`}>
                                {attendance.status === 'Présent' && <CheckCircle2 size={13} />}
                                {attendance.status === 'Absent' && <XCircle size={13} />}
                                {attendance.status === 'Retard' && <Clock size={13} />}
                                {attendance.status}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-slate-100 text-slate-500 border border-slate-200">
                                <AlertCircle size={13} /> Non émargé
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 sm:px-6 text-right">
                            {!isAllowedToSign ? (
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-400 rounded-xl text-xs font-bold border border-slate-200 cursor-not-allowed" title="Ce cours est à venir. Le pointage sera déverrouillé à l'heure du cours.">
                                <Lock size={13} />
                                <span>Pas encore commencé</span>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleSign(assignment.staff_id, 'Présent', assignment)}
                                  className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                                    attendance?.status === 'Présent' 
                                      ? 'bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-600' 
                                      : 'bg-slate-100 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 border border-slate-200'
                                  }`}
                                  title="Valider la présence"
                                >
                                  <CheckCircle2 size={13} /> Présent
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleSign(assignment.staff_id, 'Retard', assignment)}
                                  className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                                    attendance?.status === 'Retard' 
                                      ? 'bg-amber-600 text-white shadow-xs ring-2 ring-amber-600' 
                                      : 'bg-slate-100 hover:bg-amber-50 text-slate-600 hover:text-amber-700 border border-slate-200'
                                  }`}
                                  title="Marquer en Retard"
                                >
                                  <Clock size={13} /> Retard
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleSign(assignment.staff_id, 'Absent', assignment)}
                                  className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                                    attendance?.status === 'Absent' 
                                      ? 'bg-rose-600 text-white shadow-xs ring-2 ring-rose-600' 
                                      : 'bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200'
                                  }`}
                                  title="Marquer Absent"
                                >
                                  <XCircle size={13} /> Absent
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          ) : activeTab === 'general' ? (
            <div className="overflow-x-auto">
              {/* Batch Selection Action Bar for General Staff */}
              {selectedStaffIds.length > 0 && (
                <div className="bg-indigo-900 text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs font-bold animate-in fade-in duration-150">
                  <div className="flex items-center gap-2">
                    <span className="bg-indigo-700 px-2 py-0.5 rounded-md text-[11px]">
                      {selectedStaffIds.length} sélectionné(s)
                    </span>
                    <span className="text-indigo-200 text-xs hidden sm:inline">
                      Appliquer une action groupée au personnel sélectionné :
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleBulkSignGeneral('Présent', selectedStaffIds)}
                      disabled={bulkSigning}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-all flex items-center gap-1 active:scale-95 shadow-xs"
                    >
                      <CheckCircle2 size={13} />
                      <span>Marquer Présents ({selectedStaffIds.length})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleBulkSignGeneral('Retard', selectedStaffIds)}
                      disabled={bulkSigning}
                      className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-all flex items-center gap-1 active:scale-95 shadow-xs"
                    >
                      <Clock size={13} />
                      <span>Marquer en Retard</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleBulkSignGeneral('Absent', selectedStaffIds)}
                      disabled={bulkSigning}
                      className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition-all flex items-center gap-1 active:scale-95 shadow-xs"
                    >
                      <XCircle size={13} />
                      <span>Marquer Absents</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedStaffIds([])}
                      className="px-2 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all"
                      title="Désélectionner tout"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}

              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-slate-900 text-white border-b border-slate-800">
                    <th className="py-3 px-3 sm:px-4 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={staff.length > 0 && selectedStaffIds.length === staff.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedStaffIds(staff.map(s => s.id));
                          } else {
                            setSelectedStaffIds([]);
                          }
                        }}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-500"
                        title="Sélectionner tout le personnel"
                      />
                    </th>
                    <th className="py-3 px-4 sm:px-6 text-[10px] font-extrabold uppercase tracking-wider">Nom & Prénom</th>
                    <th className="py-3 px-4 sm:px-6 text-[10px] font-extrabold uppercase tracking-wider">Fonction / Poste</th>
                    <th className="py-3 px-4 sm:px-6 text-[10px] font-extrabold uppercase tracking-wider">Statut Général</th>
                    <th className="py-3 px-4 sm:px-6 text-[10px] font-extrabold uppercase tracking-wider text-right">Pointage Quotidien</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {staff.filter(s => {
                    if (!searchTerm) return true;
                    const searchLower = searchTerm.toLowerCase();
                    return `${s.first_name} ${s.last_name}`.toLowerCase().includes(searchLower) ||
                           s.role.toLowerCase().includes(searchLower);
                  }).map((s) => {
                    const attendance = attendances.find(a => a.staff_id === s.id && !a.assignment_id);
                    const campusName = getCampusName(s.campus_id);
                    const isSelected = selectedStaffIds.includes(s.id);
                    
                    return (
                      <tr 
                        key={s.id} 
                        className={`transition-colors ${
                          isSelected ? 'bg-indigo-50/70 hover:bg-indigo-50' : 'hover:bg-slate-50/80'
                        }`}
                      >
                        <td className="py-3.5 px-3 sm:px-4 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedStaffIds(prev => [...prev, s.id]);
                              } else {
                                setSelectedStaffIds(prev => prev.filter(id => id !== s.id));
                              }
                            }}
                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-500"
                          />
                        </td>
                        <td className="py-3.5 px-4 sm:px-6">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-xs border border-slate-800 shrink-0">
                              {s.first_name.charAt(0)}{s.last_name.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">{formatStudentName(s.last_name, s.first_name).fullName}</p>
                              <div className="flex items-center gap-1.5 flex-wrap text-[10px] font-medium text-slate-400">
                                <span>ID: {s.id.slice(0, 8)}</span>
                                {campusName && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 bg-indigo-50 text-indigo-700 font-bold rounded-md border border-indigo-100">
                                    📍 {campusName}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 sm:px-6">
                          <span className="inline-block px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-bold text-xs">
                            {s.role}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 sm:px-6">
                          {attendance ? (
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold border ${
                              attendance.status === 'Présent' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                              attendance.status === 'Absent' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                              attendance.status === 'Retard' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                              'bg-indigo-50 text-indigo-700 border-indigo-200'
                            }`}>
                              {attendance.status}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-slate-100 text-slate-400 border border-slate-200">
                              Non renseigné
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 sm:px-6 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleSign(s.id, 'Présent')}
                              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                                attendance?.status === 'Présent' 
                                  ? 'bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-600' 
                                  : 'bg-slate-100 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 border border-slate-200'
                              }`}
                            >
                              <CheckCircle2 size={13} /> Présent
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSign(s.id, 'Retard')}
                              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                                attendance?.status === 'Retard' 
                                  ? 'bg-amber-600 text-white shadow-xs ring-2 ring-amber-600' 
                                  : 'bg-slate-100 hover:bg-amber-50 text-slate-600 hover:text-amber-700 border border-slate-200'
                              }`}
                            >
                              <Clock size={13} /> Retard
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSign(s.id, 'Absent')}
                              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                                attendance?.status === 'Absent' 
                                  ? 'bg-rose-600 text-white shadow-xs ring-2 ring-rose-600' 
                                  : 'bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200'
                              }`}
                            >
                              <XCircle size={13} /> Absent
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            /* Interactive Reports & Summary Tab */
            <div className="p-6 space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Rapport de Présence du {new Date(selectedDate + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Synthèse globale des émargements pour l'administration.</p>
                </div>
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2"
                >
                  <Printer size={16} /> Imprimer le Registre
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-5 bg-gradient-to-br from-indigo-50 to-indigo-100/50 rounded-2xl border border-indigo-100">
                  <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider mb-2">Synthèse Enseignants</h4>
                  <p className="text-2xl font-black text-indigo-950">{stats.present} / {stats.totalCourses}</p>
                  <p className="text-xs text-indigo-700 font-medium mt-1">Cours émargés sur la journée</p>
                </div>

                <div className="p-5 bg-gradient-to-br from-emerald-50 to-emerald-100/50 rounded-2xl border border-emerald-100">
                  <h4 className="text-xs font-bold text-emerald-900 uppercase tracking-wider mb-2">Taux Global d'Assiduité</h4>
                  <p className="text-2xl font-black text-emerald-950">{stats.rate}%</p>
                  <p className="text-xs text-emerald-700 font-medium mt-1">Niveau d'assiduité du personnel</p>
                </div>

                <div className="p-5 bg-gradient-to-br from-rose-50 to-rose-100/50 rounded-2xl border border-rose-100">
                  <h4 className="text-xs font-bold text-rose-900 uppercase tracking-wider mb-2">Absences Signalées</h4>
                  <p className="text-2xl font-black text-rose-950">{stats.absent}</p>
                  <p className="text-xs text-rose-700 font-medium mt-1">Absence(s) enregistrée(s) aujourd'hui</p>
                </div>
              </div>

              {/* Detail List for Print & Export */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <div className="p-4 bg-slate-900 text-white font-bold text-xs flex justify-between items-center">
                  <span>REGISTRE OFFICIEL DE POINTAGE - {selectedDate}</span>
                  <span className="text-[10px] text-slate-300 font-normal">Généré le {new Date().toLocaleDateString('fr-FR')}</span>
                </div>
                <div className="p-4">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                        <th className="py-2 px-3">Heure</th>
                        <th className="py-2 px-3">Personnel / Enseignant</th>
                        <th className="py-2 px-3">Cours / Affectation</th>
                        <th className="py-2 px-3">Statut</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {assignments.map(a => {
                        const att = attendances.find(item => item.assignment_id === a.id);
                        return (
                          <tr key={a.id} className="text-slate-800">
                            <td className="py-2.5 px-3 font-semibold">{a.start_time.substring(0, 5)} - {a.end_time.substring(0, 5)}</td>
                            <td className="py-2.5 px-3 font-bold">{a.staff ? formatStudentName(a.staff.last_name, a.staff.first_name).fullName : 'Inconnu'}</td>
                            <td className="py-2.5 px-3">{a.class_name} ({a.subject_name})</td>
                            <td className="py-2.5 px-3 font-bold">
                              {att?.status || 'Non émargé'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StaffAttendanceView;
