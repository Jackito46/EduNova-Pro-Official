import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Calendar, CheckCircle2, XCircle, Clock, FileText, Search, Save, 
  RefreshCw, AlertCircle, ChevronDown, ChevronLeft, ChevronRight, 
  Users, Building2, Printer, X
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase, isValidUuid } from '../supabase';
import { UserProfile, SchoolClass, StudentAttendance } from '../types';
import { formatStudentName } from '../utils/formatters';
import { useSchool } from '../contexts/SchoolContext';
import { ClassSelectorPill } from './ClassSelectorPill';
import { DatePickerPill } from './DatePickerPill';

interface AttendanceViewProps {
  user: UserProfile;
}

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  reference_number?: string;
  matricule?: string;
  gender?: string;
  status?: string;
}

const AttendanceView: React.FC<AttendanceViewProps> = ({ user }) => {
  const { terminology, currentCampusId, setCurrentCampusId, campuses, school, activeAcademicYear } = useSchool();
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [students, setStudents] = useState<Student[]>([]);
  
  // Date state in Local Timezone YYYY-MM-DD
  const [attendanceDate, setAttendanceDate] = useState<string>(() => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().split('T')[0];
  });

  const [attendances, setAttendances] = useState<Record<string, StudentAttendance>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED'>('ALL');
  const [error, setError] = useState<string | null>(null);
  const [activeYearId, setActiveYearId] = useState<string | null>(null);

  // Today string for quick compare
  const todayStr = useMemo(() => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().split('T')[0];
  }, []);

  const isToday = attendanceDate === todayStr;

  // Multi-campus helpers
  const hasMultipleCampuses = (campuses?.length || 0) > 1;
  const currentCampusObj = campuses.find((c) => c.id === currentCampusId);
  const activeCampusName = currentCampusId
    ? (currentCampusObj ? currentCampusObj.name : 'Tous les Campus / Annexes')
    : undefined;

  // Single record auto-save helper
  const saveSingleRecord = async (record: any) => {
    setAutoSaving(true);
    try {
      const toUpsert: any = {
        school_id: user.school_id,
        student_id: record.student_id,
        class_id: record.class_id,
        date: record.date,
        status: record.status || 'PRESENT',
        reason: record.reason || null,
        recorded_by: user.id
      };

      if (activeYearId) {
        toUpsert.academic_year_id = activeYearId;
      }

      if (record.id) {
        toUpsert.id = record.id;
      }

      const { error } = await supabase
        .from('student_attendances')
        .upsert(toUpsert, { onConflict: 'student_id, date' });
      
      if (error) {
        if (error.code === '42703' || error.code === 'PGRST204') {
          const { academic_year_id, ...fallback } = toUpsert;
          const { error: retryError } = await supabase
            .from('student_attendances')
            .upsert(fallback, { onConflict: 'student_id, date' });
          if (retryError) throw retryError;
        } else {
          throw error;
        }
      }
    } catch (err: any) {
      console.error("Auto-save error:", err);
    } finally {
      setTimeout(() => setAutoSaving(false), 800);
    }
  };

  // Fetch school context (academic year & available classes)
  const fetchContext = useCallback(async () => {
    try {
      setError(null);
      // 1. Fetch active academic year
      let yearId: string | null = activeAcademicYear?.id || null;
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

      // 2. Fetch classes linked to school and active enrollments
      let activeClassIds: string[] = [];
      if (yearId) {
        const { data: enrollments } = await supabase
          .from('enrollments')
          .select('class_id')
          .eq('school_id', user.school_id)
          .eq('academic_year_id', yearId);
        
        activeClassIds = Array.from(new Set((enrollments || []).map(e => e.class_id).filter(Boolean)));
      }

      let classesQuery = supabase
        .from('classes')
        .select('*')
        .eq('school_id', user.school_id);
        
      if (activeClassIds.length > 0) {
        classesQuery = classesQuery.in('id', activeClassIds);
      }

      if (currentCampusId && isValidUuid(currentCampusId)) {
        classesQuery = classesQuery.eq('campus_id', currentCampusId);
      }
      
      const { data: fetchedClasses, error: classesError } = await classesQuery.order('name');
      if (classesError) throw classesError;
      
      let filteredClasses = fetchedClasses || [];
      
      // Filter classes for teacher role
      if (user.role === 'TEACHER') {
        const { data: staffData } = await supabase
          .from('staff')
          .select('id')
          .eq('email', user.email)
          .maybeSingle();

        if (staffData) {
          const { data: assignments } = await supabase
            .from('staff_assignments')
            .select('class_name')
            .eq('staff_id', staffData.id);
          
          const assignedClassNames = assignments?.map(a => a.class_name) || [];
          filteredClasses = filteredClasses.filter(c => assignedClassNames.includes(c.name));
        } else {
          filteredClasses = [];
        }
      }

      setClasses(filteredClasses);
      
      // Auto-select first class if current selection is invalid or empty
      if (filteredClasses.length > 0) {
        if (!selectedClassId || !filteredClasses.some(c => c.id === selectedClassId)) {
          setSelectedClassId(filteredClasses[0].id);
        }
      } else {
        setSelectedClassId('');
      }
    } catch (err: any) {
      console.error("Error fetching context:", err);
      setError("Erreur lors du chargement des paramètres de classe.");
    }
  }, [user.school_id, user.role, user.email, selectedClassId, currentCampusId, activeAcademicYear]);

  useEffect(() => {
    fetchContext();
  }, [fetchContext]);

  // Load attendance data for selected class & date
  const loadAttendanceData = useCallback(async () => {
    if (!selectedClassId || !attendanceDate || !activeYearId) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch students for the class based on active ENROLLMENTS
      const { data: enrollmentData, error: enrollError } = await supabase
        .from('enrollments')
        .select('student_id, students(id, first_name, last_name, status, reference_number, gender)')
        .eq('class_id', selectedClassId)
        .eq('academic_year_id', activeYearId);
        
      if (enrollError) throw enrollError;
      
      const stuData = (enrollmentData || [])
        .map(e => {
          const s = Array.isArray(e.students) ? e.students[0] : e.students;
          return s;
        })
        .filter(s => s && s.status === 'Actif')
        .sort((a: any, b: any) => (a.last_name || '').localeCompare(b.last_name || ''));
        
      setStudents(stuData as any as Student[]);

      // 2. Fetch attendance for the selected date
      const { data: attData, error: attError } = await supabase
        .from('student_attendances')
        .select('*')
        .eq('class_id', selectedClassId)
        .eq('date', attendanceDate);

      if (attError) {
        if (attError.code === '42P01') {
          setError("La table 'student_attendances' n'existe pas. Veuillez exécuter le script SQL fourni.");
          setAttendances({});
          setLoading(false);
          return;
        }
        throw attError;
      }

      const attMap: Record<string, StudentAttendance> = {};
      
      // Default: set all active students as PRESENT
      stuData?.forEach(student => {
        attMap[student.id] = {
          student_id: student.id,
          class_id: selectedClassId,
          date: attendanceDate,
          status: 'PRESENT',
          reason: ''
        } as StudentAttendance;
      });

      // Override with actual saved data from database
      let hasExistingRecords = false;
      attData?.forEach(att => {
        if (attMap[att.student_id]) {
          attMap[att.student_id] = att;
          hasExistingRecords = true;
        }
      });
      
      setAttendances(attMap);

      // Auto-save initial default PRESENT state if new date
      if (!hasExistingRecords && stuData && stuData.length > 0) {
        const defaultRecords = stuData.map(student => {
          const r: any = {
            school_id: user.school_id,
            student_id: student.id,
            class_id: selectedClassId,
            date: attendanceDate,
            status: 'PRESENT',
            recorded_by: user.id
          };
          if (activeYearId) r.academic_year_id = activeYearId;
          return r;
        });
        
        supabase.from('student_attendances').upsert(defaultRecords, { onConflict: 'student_id, date' }).then(({error}) => {
           if (error) {
             if (error.code === '42703' || error.code === 'PGRST204') {
               const fallbackRecords = defaultRecords.map(({ academic_year_id, ...rest }: any) => rest);
               supabase.from('student_attendances').upsert(fallbackRecords, { onConflict: 'student_id, date' });
             } else {
               console.error("Auto-init attendance error:", error);
             }
           }
        });
      }

    } catch (err: any) {
      console.error("Error loading attendance:", err);
      setError("Erreur lors du chargement de la liste d'appel.");
    } finally {
      setLoading(false);
    }
  }, [selectedClassId, attendanceDate, activeYearId, user.id, user.school_id]);

  useEffect(() => {
    loadAttendanceData();
  }, [loadAttendanceData]);

  // Handle single status change
  const handleStatusChange = async (studentId: string, status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED') => {
    const existing = attendances[studentId] || {};
    const record = {
      ...existing,
      student_id: studentId,
      class_id: selectedClassId,
      date: attendanceDate,
      status
    };

    setAttendances(prev => ({
      ...prev,
      [studentId]: record as StudentAttendance
    }));

    await saveSingleRecord(record);
  };

  // Handle reason modification
  const handleReasonChange = (studentId: string, reason: string) => {
    setAttendances(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        student_id: studentId,
        class_id: selectedClassId,
        date: attendanceDate,
        reason
      } as StudentAttendance
    }));
  };

  const handleReasonBlur = async (studentId: string) => {
    const att = attendances[studentId];
    if (att) {
      await saveSingleRecord({
        student_id: studentId,
        class_id: selectedClassId,
        date: attendanceDate,
        status: att.status || 'PRESENT',
        reason: att.reason
      });
    }
  };

  // Manual save all
  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const recordsToUpsert = Object.values(attendances).map(att => {
        const r: any = {
          school_id: user.school_id,
          student_id: att.student_id,
          class_id: att.class_id,
          date: att.date,
          status: att.status || 'PRESENT',
          reason: att.reason || null,
          recorded_by: user.id
        };
        if (activeYearId) r.academic_year_id = activeYearId;
        if (att.id) r.id = att.id;
        return r;
      });

      if (recordsToUpsert.length > 0) {
        const { error } = await supabase
          .from('student_attendances')
          .upsert(recordsToUpsert, { onConflict: 'student_id, date' });
        
        if (error) {
          if (error.code === '42703' || error.code === 'PGRST204') {
            const fallbackRecords = recordsToUpsert.map(({ academic_year_id, ...rest }: any) => rest);
            const { error: retryError } = await supabase
              .from('student_attendances')
              .upsert(fallbackRecords, { onConflict: 'student_id, date' });
            if (retryError) throw retryError;
          } else {
            throw error;
          }
        }
      }
      
      await loadAttendanceData();
      toast.success("Présences enregistrées et synchronisées avec succès !");
    } catch (err: any) {
      console.error("Error saving attendance:", err);
      setError("Erreur lors de l'enregistrement : " + err.message);
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  // Bulk status change
  const markAllAs = async (status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED') => {
    const newAttendances = { ...attendances };
    const recordsToUpsert: any[] = [];

    filteredStudents.forEach(student => {
      const record: any = {
        school_id: user.school_id,
        student_id: student.id,
        class_id: selectedClassId,
        date: attendanceDate,
        status
      };
      if (activeYearId) {
        record.academic_year_id = activeYearId;
      }
      newAttendances[student.id] = {
        ...newAttendances[student.id],
        ...record
      } as StudentAttendance;
      recordsToUpsert.push({ ...record, recorded_by: user.id });
    });
    setAttendances(newAttendances);

    if (recordsToUpsert.length > 0) {
      setAutoSaving(true);
      try {
        const { error } = await supabase
          .from('student_attendances')
          .upsert(recordsToUpsert, { onConflict: 'student_id, date' });
        if (error) {
          if (error.code === '42703' || error.code === 'PGRST204') {
            const fallbackRecords = recordsToUpsert.map(({ academic_year_id, ...rest }: any) => rest);
            const { error: retryError } = await supabase
              .from('student_attendances')
              .upsert(fallbackRecords, { onConflict: 'student_id, date' });
            if (retryError) throw retryError;
          } else {
            throw error;
          }
        }
        toast.success(`Statut mis à jour pour ${recordsToUpsert.length} ${terminology.students?.toLowerCase() || 'élèves'}`);
      } catch (err: any) {
        console.error("Auto-save all error:", err);
      } finally {
        setTimeout(() => setAutoSaving(false), 800);
      }
    }
  };

  // Date Shift Helper (+/- 1 day)
  const shiftDate = (days: number) => {
    const current = new Date(attendanceDate + "T12:00:00");
    current.setDate(current.getDate() + days);
    const newDateStr = current.toISOString().split('T')[0];
    setAttendanceDate(newDateStr);
  };

  // Filter students based on search term & status pill
  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const fullName = formatStudentName(s.last_name, s.first_name).fullName.toLowerCase();
      const ref = (s.reference_number || s.matricule || '').toLowerCase();
      const matchesSearch = fullName.includes(searchTerm.toLowerCase()) || ref.includes(searchTerm.toLowerCase());
      
      if (!matchesSearch) return false;
      if (statusFilter === 'ALL') return true;
      
      const st = attendances[s.id]?.status || 'PRESENT';
      return st === statusFilter;
    });
  }, [students, searchTerm, statusFilter, attendances]);

  // Statistics
  const stats = useMemo(() => {
    const present = Object.values(attendances).filter(a => a.status === 'PRESENT').length;
    const absent = Object.values(attendances).filter(a => a.status === 'ABSENT').length;
    const late = Object.values(attendances).filter(a => a.status === 'LATE').length;
    const excused = Object.values(attendances).filter(a => a.status === 'EXCUSED').length;
    const total = students.length;
    const presentRate = total > 0 ? ((present / total) * 100).toFixed(1) : '0';

    return { present, absent, late, excused, total, presentRate };
  }, [attendances, students]);

  const selectedClass = classes.find(c => c.id === selectedClassId);

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-16 px-2 sm:px-4 animate-in fade-in duration-300">
      
      {/* 1. EN-TÊTE HARMONISÉ & MULTI-CAMPUS */}
      <div className="bg-white p-3.5 sm:p-4 rounded-xl shadow-xs border border-slate-200/90 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center shadow-xs border border-slate-800 shrink-0">
            <Calendar size={20} className="text-blue-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight font-serif">
                Feuille de Présence
              </h2>
              {hasMultipleCampuses && activeCampusName && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md text-[11px] font-bold border border-indigo-200">
                  <Building2 size={11} />
                  <span>{activeCampusName}</span>
                </span>
              )}
            </div>
            <p className="text-slate-500 font-medium text-xs mt-0.5">
              {school?.name || 'Établissement'} • Appel quotidien, pointage & assiduité des {terminology.students?.toLowerCase() || 'élèves'}
            </p>
          </div>
        </div>

        {/* Action Controls & Campus Switcher */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
          {/* Campus Switcher (if multi-campus) */}
          {hasMultipleCampuses && (user.role === 'SUPER_ADMIN' || user.role === 'DIRECTOR') && (
            <div className="relative min-w-[170px]">
              <select
                className="w-full bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs font-semibold pl-7 pr-8 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer appearance-none transition-all"
                value={currentCampusId || ''}
                onChange={e => setCurrentCampusId(e.target.value || null)}
              >
                <option value="">Tous les Campus</option>
                {campuses.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <Building2 size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            </div>
          )}

          {/* Auto-Save Indicator */}
          <div className="hidden sm:flex items-center">
            {autoSaving ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-xs font-semibold border border-amber-200 animate-pulse">
                <RefreshCw size={12} className="animate-spin text-amber-600" />
                <span>Sauvegarde...</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-semibold border border-emerald-200">
                <CheckCircle2 size={13} className="text-emerald-600" />
                <span>Auto-save actif</span>
              </span>
            )}
          </div>

          {/* Refresh Button */}
          <button
            onClick={loadAttendanceData}
            title="Actualiser la liste"
            className="p-2 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all border border-slate-200"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>

          {/* Print Button */}
          <button
            onClick={() => window.print()}
            title="Imprimer la feuille de présence"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all border border-slate-200"
          >
            <Printer size={14} />
            <span className="hidden sm:inline">Imprimer</span>
          </button>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={saving || loading || !!error}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold shadow-xs active:scale-95 transition-all disabled:opacity-40"
          >
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
            <span>Enregistrer</span>
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 p-3.5 rounded-xl flex items-start gap-3 print:hidden">
          <AlertCircle className="text-rose-600 shrink-0 mt-0.5" size={18} />
          <div>
            <h3 className="text-rose-900 font-bold text-xs">Notification Système</h3>
            <p className="text-rose-700 text-xs font-medium mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* 2. PARAMÈTRES & TOOLBAR DE CONTRÔLE */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200/90 p-3.5 sm:p-4 space-y-3.5 print:hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
          
          {/* Sélection de Classe */}
          <div className="sm:col-span-1 lg:col-span-4 space-y-1 min-w-0">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 truncate">
              <span>{terminology.class || 'Classe'}</span>
              {classes.length > 0 && (
                <span className="text-[10px] text-slate-400 font-normal">({classes.length} dispo.)</span>
              )}
            </label>
            <ClassSelectorPill
              classes={classes}
              selectedClassId={selectedClassId}
              onSelectClass={(id) => setSelectedClassId(id)}
              allowAll={false}
              emptyLabel={classes.length === 0 ? `Aucune ${terminology.class?.toLowerCase() || 'classe'} disponible` : `Choisir une ${terminology.class?.toLowerCase() || 'classe'}...`}
              variant="field"
              size="sm"
              colorScheme="blue"
              labelPrefix=""
              disabled={classes.length === 0}
              className="w-full"
            />
          </div>

          {/* Sélecteur de Date Intelligent avec Navigation Rapide (Harmonisé DatePickerPill) */}
          <div className="sm:col-span-1 lg:col-span-5 space-y-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 truncate">
                Date de l'Appel
              </label>
              {!isToday && (
                <button
                  type="button"
                  onClick={() => setAttendanceDate(todayStr)}
                  className="text-[10px] font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer shrink-0"
                >
                  Aujourd'hui
                </button>
              )}
            </div>
            <DatePickerPill
              selectedDate={attendanceDate}
              onSelectDate={(newDate) => setAttendanceDate(newDate)}
              variant="field"
              size="sm"
              colorScheme="blue"
              showShortcuts={false}
              showQuickArrows={true}
              showTodayBadge={true}
              className="w-full"
            />
          </div>

          {/* Recherche Instantanée */}
          <div className="sm:col-span-2 lg:col-span-3 space-y-1 min-w-0">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 truncate block">
              Recherche {terminology.student || 'Élève'}
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
              <input
                type="text"
                placeholder={`Nom ou matricule...`}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-8.5 pr-7 py-2 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-lg sm:rounded-xl text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all placeholder:text-slate-400"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Filtres Rapides par Statut */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1 hidden sm:inline">
              Filtrer :
            </span>
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                statusFilter === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Tous ({students.length})
            </button>
            <button
              onClick={() => setStatusFilter('PRESENT')}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                statusFilter === 'PRESENT'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
              }`}
            >
              Présents ({stats.present})
            </button>
            <button
              onClick={() => setStatusFilter('ABSENT')}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                statusFilter === 'ABSENT'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
              }`}
            >
              Absents ({stats.absent})
            </button>
            <button
              onClick={() => setStatusFilter('LATE')}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                statusFilter === 'LATE'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
              }`}
            >
              Retards ({stats.late})
            </button>
            <button
              onClick={() => setStatusFilter('EXCUSED')}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                statusFilter === 'EXCUSED'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
              }`}
            >
              Excusés ({stats.excused})
            </button>
          </div>

          <div className="text-xs text-slate-500 font-semibold">
            {new Date(attendanceDate + "T12:00:00").toLocaleDateString('fr-FR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric'
            })}
          </div>
        </div>
      </div>

      {/* 3. DASHBOARD KPI & STATISTIQUES DE SÉANCE */}
      {!loading && !error && students.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 print:hidden">
          {/* Total */}
          <div className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total {terminology.students || 'Élèves'}</p>
              <p className="text-xl font-extrabold text-slate-900 font-mono mt-0.5">{stats.total}</p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs">
              <Users size={16} />
            </div>
          </div>

          {/* Présents */}
          <div className="bg-white p-3 rounded-xl border border-emerald-200/90 shadow-xs flex items-center justify-between bg-gradient-to-br from-white to-emerald-50/30">
            <div>
              <div className="flex items-center gap-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Présents</p>
                <span className="text-[10px] font-extrabold text-emerald-600 bg-emerald-100/80 px-1 py-0.2 rounded">
                  {stats.presentRate}%
                </span>
              </div>
              <p className="text-xl font-extrabold text-emerald-700 font-mono mt-0.5">{stats.present}</p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
              <CheckCircle2 size={16} />
            </div>
          </div>

          {/* Absents */}
          <div className="bg-white p-3 rounded-xl border border-rose-200/90 shadow-xs flex items-center justify-between bg-gradient-to-br from-white to-rose-50/30">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-rose-700">Absents</p>
              <p className="text-xl font-extrabold text-rose-700 font-mono mt-0.5">{stats.absent}</p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-xs">
              <XCircle size={16} />
            </div>
          </div>

          {/* Retards */}
          <div className="bg-white p-3 rounded-xl border border-amber-200/90 shadow-xs flex items-center justify-between bg-gradient-to-br from-white to-amber-50/30">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">En Retard</p>
              <p className="text-xl font-extrabold text-amber-700 font-mono mt-0.5">{stats.late}</p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xs">
              <Clock size={16} />
            </div>
          </div>

          {/* Excusés */}
          <div className="bg-white p-3 rounded-xl border border-blue-200/90 shadow-xs flex items-center justify-between bg-gradient-to-br from-white to-blue-50/30 col-span-2 sm:col-span-1">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Excusés</p>
              <p className="text-xl font-extrabold text-blue-700 font-mono mt-0.5">{stats.excused}</p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
              <FileText size={16} />
            </div>
          </div>
        </div>
      )}

      {/* 4. TABLEAU D'APPEL INTERACTIF & ULTRA-FLUIDE */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200/90 overflow-hidden">
        
        {/* Barre d'Actions Groupées */}
        <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 print:hidden">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700">
              {selectedClass ? selectedClass.name.toUpperCase() : 'Classe'}
            </span>
            <span className="text-slate-400">•</span>
            <span className="text-xs text-slate-500 font-medium">
              {filteredStudents.length} {terminology.students?.toLowerCase() || 'élèves'} affiché(s)
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1">
              Marquer tous :
            </span>
            <button
              onClick={() => markAllAs('PRESENT')}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200 hover:border-emerald-300 rounded-lg text-xs font-bold transition-all shadow-2xs active:scale-95"
            >
              <CheckCircle2 size={13} className="text-emerald-600" />
              <span>Présents</span>
            </button>
            <button
              onClick={() => markAllAs('ABSENT')}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 hover:border-rose-300 rounded-lg text-xs font-bold transition-all shadow-2xs active:scale-95"
            >
              <XCircle size={13} className="text-rose-600" />
              <span>Absents</span>
            </button>
            <button
              onClick={() => markAllAs('LATE')}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-amber-50 text-amber-700 border border-amber-200 hover:border-amber-300 rounded-lg text-xs font-bold transition-all shadow-2xs active:scale-95"
            >
              <Clock size={13} className="text-amber-600" />
              <span>En retard</span>
            </button>
            <button
              onClick={() => markAllAs('EXCUSED')}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 hover:border-blue-300 rounded-lg text-xs font-bold transition-all shadow-2xs active:scale-95"
            >
              <FileText size={13} className="text-blue-600" />
              <span>Excusés</span>
            </button>
          </div>
        </div>

        {/* Print Header (Only shown during printing) */}
        <div className="hidden print:block p-4 border-b-2 border-slate-900">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-xl font-bold font-serif text-slate-900">{school?.name || "Établissement"}</h1>
              <p className="text-xs font-bold text-slate-600 mt-0.5">
                Feuille de Présence Officielle • {selectedClass?.name} {activeCampusName ? `(${activeCampusName})` : ''}
              </p>
            </div>
            <div className="text-right text-xs">
              <p className="font-bold text-slate-900">Date : {attendanceDate}</p>
              <p className="text-slate-600">Total : {students.length} {terminology.students?.toLowerCase() || 'élèves'}</p>
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white text-[10px] uppercase font-bold tracking-wider">
                <th className="px-3.5 py-3 w-12 text-center border-r border-slate-800">#</th>
                <th className="px-3.5 py-3 border-r border-slate-800 min-w-[220px]">
                  {terminology.student || 'Élève'} (Nom & Prénom)
                </th>
                <th className="px-2 py-3 text-center border-r border-slate-800 min-w-[90px] w-24">Présent</th>
                <th className="px-2 py-3 text-center border-r border-slate-800 min-w-[90px] w-24">Absent</th>
                <th className="px-2 py-3 text-center border-r border-slate-800 min-w-[90px] w-24">Retard</th>
                <th className="px-2 py-3 text-center border-r border-slate-800 min-w-[90px] w-24">Excusé</th>
                <th className="px-3.5 py-3 min-w-[200px]">Motif / Observation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw size={24} className="animate-spin text-blue-600" />
                      <span className="font-semibold text-xs text-slate-600">Chargement de la liste d'appel...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Users size={32} className="text-slate-300" />
                      <p className="font-bold text-slate-600 text-sm">
                        Aucun {terminology.student?.toLowerCase() || 'élève'} trouvé
                      </p>
                      <p className="text-xs text-slate-400 max-w-sm">
                        {searchTerm 
                          ? `Aucun résultat ne correspond à "${searchTerm}".`
                          : `Aucun élève actif n'est inscrit dans cette ${terminology.class?.toLowerCase() || 'classe'} pour l'année académique active.`
                        }
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student, index) => {
                  const status = attendances[student.id]?.status || 'PRESENT';
                  const reason = attendances[student.id]?.reason || '';
                  const formatted = formatStudentName(student.last_name, student.first_name);

                  return (
                    <tr
                      key={student.id}
                      className={`transition-colors ${
                        status === 'ABSENT' 
                          ? 'bg-rose-50/40 hover:bg-rose-50/70' 
                          : status === 'LATE' 
                          ? 'bg-amber-50/40 hover:bg-amber-50/70' 
                          : status === 'EXCUSED' 
                          ? 'bg-blue-50/40 hover:bg-blue-50/70' 
                          : index % 2 === 1 
                          ? 'bg-slate-50/50 hover:bg-blue-50/30' 
                          : 'bg-white hover:bg-blue-50/30'
                      }`}
                    >
                      {/* Numéro */}
                      <td className="px-3.5 py-2.5 text-center font-mono font-bold text-slate-400 text-xs border-r border-slate-100">
                        {index + 1}
                      </td>

                      {/* Nom & Prénom Élève */}
                      <td className="px-3.5 py-2.5 border-r border-slate-100">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                            status === 'PRESENT'
                              ? 'bg-emerald-100 text-emerald-800'
                              : status === 'ABSENT'
                              ? 'bg-rose-100 text-rose-800'
                              : status === 'LATE'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {(student.last_name || student.first_name || '?').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block leading-tight">
                              {formatted.fullName}
                            </span>
                            {(student.reference_number || student.matricule) && (
                              <span className="text-[10px] font-mono text-slate-400">
                                {student.reference_number || student.matricule}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Bouton : Présent */}
                      <td className="px-1.5 py-1.5 border-r border-slate-100 text-center">
                        <button
                          type="button"
                          onClick={() => handleStatusChange(student.id, 'PRESENT')}
                          className={`w-full py-1.5 px-2 rounded-lg font-bold text-[11px] transition-all flex items-center justify-center gap-1 ${
                            status === 'PRESENT'
                              ? 'bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-400/40 ring-offset-1'
                              : 'bg-slate-100 text-slate-400 hover:bg-emerald-50 hover:text-emerald-700'
                          }`}
                        >
                          <CheckCircle2 size={14} className={status === 'PRESENT' ? 'text-white' : ''} />
                          <span className="hidden sm:inline">Présent</span>
                        </button>
                      </td>

                      {/* Bouton : Absent */}
                      <td className="px-1.5 py-1.5 border-r border-slate-100 text-center">
                        <button
                          type="button"
                          onClick={() => handleStatusChange(student.id, 'ABSENT')}
                          className={`w-full py-1.5 px-2 rounded-lg font-bold text-[11px] transition-all flex items-center justify-center gap-1 ${
                            status === 'ABSENT'
                              ? 'bg-rose-600 text-white shadow-xs ring-2 ring-rose-400/40 ring-offset-1'
                              : 'bg-slate-100 text-slate-400 hover:bg-rose-50 hover:text-rose-700'
                          }`}
                        >
                          <XCircle size={14} className={status === 'ABSENT' ? 'text-white' : ''} />
                          <span className="hidden sm:inline">Absent</span>
                        </button>
                      </td>

                      {/* Bouton : Retard */}
                      <td className="px-1.5 py-1.5 border-r border-slate-100 text-center">
                        <button
                          type="button"
                          onClick={() => handleStatusChange(student.id, 'LATE')}
                          className={`w-full py-1.5 px-2 rounded-lg font-bold text-[11px] transition-all flex items-center justify-center gap-1 ${
                            status === 'LATE'
                              ? 'bg-amber-600 text-white shadow-xs ring-2 ring-amber-400/40 ring-offset-1'
                              : 'bg-slate-100 text-slate-400 hover:bg-amber-50 hover:text-amber-700'
                          }`}
                        >
                          <Clock size={14} className={status === 'LATE' ? 'text-white' : ''} />
                          <span className="hidden sm:inline">Retard</span>
                        </button>
                      </td>

                      {/* Bouton : Excusé */}
                      <td className="px-1.5 py-1.5 border-r border-slate-100 text-center">
                        <button
                          type="button"
                          onClick={() => handleStatusChange(student.id, 'EXCUSED')}
                          className={`w-full py-1.5 px-2 rounded-lg font-bold text-[11px] transition-all flex items-center justify-center gap-1 ${
                            status === 'EXCUSED'
                              ? 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-400/40 ring-offset-1'
                              : 'bg-slate-100 text-slate-400 hover:bg-blue-50 hover:text-blue-700'
                          }`}
                        >
                          <FileText size={14} className={status === 'EXCUSED' ? 'text-white' : ''} />
                          <span className="hidden sm:inline">Excusé</span>
                        </button>
                      </td>

                      {/* Champ Motif / Commentaire */}
                      <td className="px-3 py-1.5 min-w-[200px]">
                        <input
                          type="text"
                          placeholder={status !== 'PRESENT' ? "Préciser le motif..." : "Observation..."}
                          value={reason}
                          onChange={(e) => handleReasonChange(student.id, e.target.value)}
                          onBlur={() => handleReasonBlur(student.id)}
                          className={`w-full px-2.5 py-1.5 text-xs font-semibold text-slate-900 placeholder:text-slate-400 rounded-lg border outline-none transition-all ${
                            status !== 'PRESENT' && !reason
                              ? 'bg-amber-50/40 border-amber-300 focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-slate-900 placeholder:text-amber-800/60'
                              : 'bg-white border-slate-200 hover:border-slate-300 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-slate-900 shadow-2xs'
                          }`}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Print Signatures Block */}
        <div className="hidden print:flex justify-between items-end p-6 pt-12 text-xs">
          <div className="text-center w-48">
            <p className="font-bold text-slate-800">L'Enseignant / Surveillant</p>
            <div className="border-b border-slate-400 mt-12"></div>
            <p className="text-[10px] text-slate-500 mt-1">Signature</p>
          </div>
          <div className="text-center w-48">
            <p className="font-bold text-slate-800">La Direction Pédagogique</p>
            <div className="border-b border-slate-400 mt-12"></div>
            <p className="text-[10px] text-slate-500 mt-1">Sceau & Signature</p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default AttendanceView;
