import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabase';
import { UserProfile } from '../types';
import { 
  CheckCircle2, XCircle, Clock, AlertCircle, 
  FileText, Check, ChevronRight, User, Building2, 
  Calendar, FileCheck2, UserCheck, Search, Filter,
  ShieldCheck, AlertTriangle, Info, MapPin, Phone, UserX,
  ExternalLink, CheckSquare, Square, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { useSchool } from '../contexts/SchoolContext';
import { AuditLogger } from '../utils/auditLogger';
import { 
  getDocumentDefinitionsForSchoolType, 
  normalizeStudentDocuments 
} from '../utils/documentRequirements';
import { DoubleRegardValidationView } from './DoubleRegardValidationView';
import { PendingActionsService } from '../services/pendingActionsService';
import { ShieldAlert } from 'lucide-react';

interface ValidationListProps {
  user: UserProfile;
}

const ValidationList: React.FC<ValidationListProps> = ({ user }) => {
  const { campuses, currentCampusId, school, terminology, activeAcademicYear } = useSchool();
  const [activeMainTab, setActiveMainTab] = useState<'STUDENTS' | 'DOUBLE_REGARD'>('STUDENTS');
  const [pendingActionsCount, setPendingActionsCount] = useState<number>(0);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Campus locking and active filter
  const isCampusLocked = Boolean(user.campus_id);
  const [selectedCampus, setSelectedCampus] = useState<string>(user.campus_id || currentCampusId || 'ALL');

  // Sync selected campus with context
  useEffect(() => {
    if (user.campus_id) {
      setSelectedCampus(user.campus_id);
    } else if (currentCampusId) {
      setSelectedCampus(currentCampusId);
    }
  }, [user.campus_id, currentCampusId]);

  // Modals state
  const [reviewingStudent, setReviewingStudent] = useState<any | null>(null);
  const [rejectingStudent, setRejectingStudent] = useState<any | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Dynamic Document Definitions for this school
  const docDefs = useMemo(() => {
    return getDocumentDefinitionsForSchoolType(school?.school_type, school?.global_settings);
  }, [school?.school_type, school?.global_settings]);

  const initialChecklist = useMemo(() => {
    const list: Record<string, boolean> = {};
    docDefs.forEach(def => {
      list[def.id] = false;
    });
    return list;
  }, [docDefs]);

  const [checklist, setChecklist] = useState<Record<string, boolean>>(initialChecklist);

  useEffect(() => {
    setChecklist(initialChecklist);
  }, [initialChecklist]);

  useEffect(() => {
    if (user?.school_id) {
      fetchPendingStudents();
      loadPendingActionsCount();
    }
  }, [user?.school_id, user?.campus_id, currentCampusId]);

  const loadPendingActionsCount = async () => {
    if (!user?.school_id) return;
    try {
      const count = await PendingActionsService.getPendingCount(user.school_id, user.campus_id || currentCampusId);
      setPendingActionsCount(count);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchPendingStudents = async () => {
    if (!user?.school_id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // 1. Fetch students whose status is pending validation in students table (scoped by school_id)
      const { data: directPending, error: directErr } = await supabase
        .from('students')
        .select(`
          *,
          class:classes(id, name, campus_id, level)
        `)
        .eq('school_id', user.school_id)
        .in('status', ['PENDING_VALIDATION', 'En attente', 'EN_ATTENTE', 'PENDING', 'En Attente', 'En attente validation'])
        .order('created_at', { ascending: false });

      if (directErr) {
        console.warn("Direct query warning:", directErr);
      }

      // 2. Cross-reference enrollments table for any students with enrollment status PENDING_VALIDATION (scoped by school_id)
      const { data: pendingEnrollments } = await supabase
        .from('enrollments')
        .select('student_id, academic_year_id, status, class_id')
        .eq('school_id', user.school_id)
        .in('status', ['PENDING_VALIDATION', 'EN_ATTENTE', 'PENDING']);

      const combinedMap = new Map<string, any>();
      (directPending || []).forEach(st => {
        combinedMap.set(st.id, st);
      });

      if (pendingEnrollments && pendingEnrollments.length > 0) {
        const missingIds = pendingEnrollments
          .map(e => e.student_id)
          .filter(id => id && !combinedMap.has(id));

        if (missingIds.length > 0) {
          const { data: additionalStudents } = await supabase
            .from('students')
            .select(`
              *,
              class:classes(id, name, campus_id, level)
            `)
            .eq('school_id', user.school_id)
            .in('id', missingIds);

          (additionalStudents || []).forEach(st => {
            // Only add if not already marked inactive/deleted
            if (st.status !== 'Inactif' && st.status !== 'REJETE' && st.status !== 'Rejeté') {
              combinedMap.set(st.id, st);
            }
          });
        }
      }

      const finalList = Array.from(combinedMap.values());
      setStudents(finalList);
    } catch (error) {
      console.error('Erreur lors de la récupération des dossiers:', error);
      toast.error('Impossible de charger les dossiers en attente');
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = useMemo(() => {
    return students.filter(student => {
      // Campus filter (strict multi-campus isolation)
      const targetCampus = isCampusLocked ? user.campus_id : selectedCampus;
      if (targetCampus && targetCampus !== 'ALL') {
        const studentCampus = student.campus_id || student.class?.campus_id;
        if (studentCampus && studentCampus !== targetCampus) return false;
        // If student has no campus set and school has multiple campuses, allow only if user belongs to main campus
        if (!studentCampus && isCampusLocked && user.campus_id !== campuses?.[0]?.id) {
          return false;
        }
      }
      
      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const fullName = `${student.first_name || ''} ${student.last_name || ''}`.toLowerCase();
        const matricule = (student.matricule || '').toLowerCase();
        const parentName = (student.parent_name || '').toLowerCase();
        const phone = (student.parent_phone || student.phone || '').toLowerCase();
        
        if (
          !fullName.includes(searchLower) && 
          !matricule.includes(searchLower) &&
          !parentName.includes(searchLower) &&
          !phone.includes(searchLower)
        ) {
          return false;
        }
      }
      
      return true;
    });
  }, [students, selectedCampus, searchTerm, isCampusLocked, user.campus_id, campuses]);

  const kpis = useMemo(() => {
    const total = filteredStudents.length;
    const urgent = filteredStudents.filter(s => {
      const diffDays = Math.floor((new Date().getTime() - new Date(s.created_at).getTime()) / (1000 * 3600 * 24));
      return diffDays >= 3;
    }).length;

    const byCampus = campuses?.reduce((acc: any, c) => {
      acc[c.id] = students.filter(s => (s.campus_id || s.class?.campus_id) === c.id).length;
      return acc;
    }, {});

    return { total, urgent, byCampus };
  }, [filteredStudents, students, campuses]);

  const getDaysWaiting = (dateStr: string) => {
    const diffDays = Math.floor((new Date().getTime() - new Date(dateStr).getTime()) / (1000 * 3600 * 24));
    return diffDays;
  };

  const handleValidate = async (student: any) => {
    if (!Object.values(checklist).every(Boolean)) {
      if (!window.confirm("Certaines pièces justificatives ne sont pas cochées. Voulez-vous tout de même valider ce dossier ?")) {
        return;
      }
    }

    setActionLoading(true);
    try {
      const docDefs = getDocumentDefinitionsForSchoolType(school?.school_type, school?.global_settings);
      const currentDocs = student.submitted_documents ? { ...student.submitted_documents } : {};
      const updatedDocs: Record<string, any> = {};
      
      docDefs.forEach(def => {
        const isChecked = !!checklist[def.id];
        updatedDocs[def.id] = {
          name: def.name,
          status: isChecked ? 'VALIDE' : 'EN_ATTENTE',
          notes: currentDocs[def.id]?.notes || '',
          file_url: currentDocs[def.id]?.file_url || currentDocs[def.id]?.url || null,
          updated_at: new Date().toISOString(),
          updated_by: user.full_name || user.email
        };
      });

      // 1. Mise à jour de la table students avec vérification stricte du tenant (school_id)
      const { error: studentError } = await supabase
        .from('students')
        .update({
          status: 'Actif',
          submitted_documents: updatedDocs
        })
        .eq('id', student.id)
        .eq('school_id', user.school_id);

      if (studentError) throw studentError;

      // 2. Synchronisation et activation de l'inscription (enrollments)
      const { data: existingEnrollment } = await supabase
        .from('enrollments')
        .select('id, status, academic_year_id')
        .eq('school_id', user.school_id)
        .eq('student_id', student.id)
        .maybeSingle();

      if (existingEnrollment) {
        await supabase
          .from('enrollments')
          .update({ status: 'ACTIVE' })
          .eq('id', existingEnrollment.id)
          .eq('school_id', user.school_id);
      } else if (activeAcademicYear?.id) {
        await supabase
          .from('enrollments')
          .insert({
            school_id: user.school_id,
            student_id: student.id,
            academic_year_id: activeAcademicYear.id,
            class_id: student.class_id || student.class?.id || null,
            status: 'ACTIVE'
          });
      }

      AuditLogger.log({
        action: 'UPDATE',
        entity_id: student.id,
        entity_type: 'student',
        details: { 
          name: `${student.first_name} ${student.last_name}`, 
          status: 'Actif', 
          operation: 'VALIDATE_STUDENT',
          school_id: user.school_id,
          campus_id: student.campus_id || student.class?.campus_id || null
        },
        school_id: user.school_id,
        user_id: user.id
      });

      toast.success(`Dossier de ${student.first_name} ${student.last_name} validé avec succès !`);
      setReviewingStudent(null);
      fetchPendingStudents();
    } catch (error) {
      console.error('Erreur lors de la validation:', error);
      toast.error('Erreur lors de la validation du dossier');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectionReason.trim()) {
      toast.error("Veuillez spécifier un motif de rejet.");
      return;
    }

    setActionLoading(true);
    try {
      const dateNow = new Date().toLocaleDateString('fr-FR');
      const rejectionStamp = `[Dossier Rejeté le ${dateNow} par ${user.full_name || user.email}. Motif: ${rejectionReason}]`;
      const updatedNotes = rejectingStudent.notes 
        ? `${rejectingStudent.notes}\n${rejectionStamp}`
        : rejectionStamp;

      // 1. Mise à jour de la table students avec vérification stricte du tenant (school_id)
      const { error: studentError } = await supabase
        .from('students')
        .update({
          status: 'Inactif',
          notes: updatedNotes
        })
        .eq('id', rejectingStudent.id)
        .eq('school_id', user.school_id);

      if (studentError) throw studentError;

      // 2. Mise à jour de l'inscription (enrollment) avec vérification stricte du tenant (school_id)
      await supabase
        .from('enrollments')
        .update({ status: 'REJECTED' })
        .eq('student_id', rejectingStudent.id)
        .eq('school_id', user.school_id);

      AuditLogger.log({
        action: 'UPDATE',
        entity_id: rejectingStudent.id,
        entity_type: 'student',
        details: { 
          name: `${rejectingStudent.first_name} ${rejectingStudent.last_name}`, 
          reason: rejectionReason, 
          operation: 'REJECT_STUDENT',
          school_id: user.school_id,
          campus_id: rejectingStudent.campus_id || rejectingStudent.class?.campus_id || null
        },
        school_id: user.school_id,
        user_id: user.id
      });

      toast.success(`Le dossier de ${rejectingStudent.first_name} ${rejectingStudent.last_name} a été rejeté.`);
      setRejectingStudent(null);
      setReviewingStudent(null);
      setRejectionReason('');
      fetchPendingStudents();
    } catch (error: any) {
      console.error('Erreur lors du rejet:', error);
      toast.error(error?.message || 'Erreur lors du rejet du dossier');
    } finally {
      setActionLoading(false);
    }
  };

  const openReview = (student: any) => {
    setReviewingStudent(student);
    if (student?.submitted_documents) {
      const normalized = normalizeStudentDocuments(student.submitted_documents, school?.school_type, school?.global_settings);
      const newChecklist: Record<string, boolean> = { ...initialChecklist };
      Object.keys(normalized).forEach(key => {
        newChecklist[key] = normalized[key]?.status === 'VALIDE';
      });
      setChecklist(newChecklist);
    } else {
      setChecklist(initialChecklist);
    }
  };

  const toggleAllChecklist = () => {
    const allChecked = Object.values(checklist).every(Boolean);
    const updated: Record<string, boolean> = {};
    docDefs.forEach(d => {
      updated[d.id] = !allChecked;
    });
    setChecklist(updated);
  };

  const getCampusName = (campusId: string) => {
    if (!campuses || !campusId) return "Campus Principal";
    const campus = campuses.find(c => c.id === campusId);
    return campus ? campus.name : "Campus Principal";
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-in fade-in duration-500">
      
      {/* En-tête : Commission d'Admission & Validation */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 rounded-3xl shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shadow-inner shrink-0">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                  Commission d'Admission
                </h1>
                <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                  {school?.school_type === 'UNIVERSITY' ? 'Enseignement Supérieur' : school?.school_type === 'PROFESSIONAL' ? 'Formation Pro / Tech' : 'Scolaire'}
                </span>
              </div>
              <p className="text-indigo-200/80 text-sm font-medium">
                Vérification d'éligibilité, contrôle des pièces requises et validation des dossiers des {terminology.students.toLowerCase()}.
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={fetchPendingStudents}
              disabled={loading}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur-md px-3.5 py-2.5 rounded-2xl border border-white/10 text-xs font-bold text-white transition-all"
              title="Rafraîchir les dossiers"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              <span className="hidden sm:inline">Actualiser</span>
            </button>
            <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10">
              <div className="text-right">
                <p className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider">File d'attente</p>
                <p className="text-2xl font-black text-white leading-none mt-1">
                  {activeMainTab === 'STUDENTS' ? filteredStudents.length : pendingActionsCount}{' '}
                  <span className="text-sm font-medium text-indigo-200">
                    {activeMainTab === 'STUDENTS' ? 'dossiers' : 'actions'}
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sélecteur de Module de Validation : Admissions vs Double Regard */}
      <div className="flex border-b border-slate-200 bg-white rounded-2xl p-1.5 shadow-sm gap-2">
        <button
          onClick={() => setActiveMainTab('STUDENTS')}
          className={`flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2.5 ${
            activeMainTab === 'STUDENTS'
              ? 'bg-indigo-900 text-white shadow-md shadow-indigo-900/20'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <FileCheck2 size={18} />
          <span>Dossiers d'Inscriptions Élèves</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
            activeMainTab === 'STUDENTS' ? 'bg-indigo-800 text-indigo-100' : 'bg-slate-100 text-slate-700'
          }`}>
            {filteredStudents.length}
          </span>
        </button>

        <button
          onClick={() => setActiveMainTab('DOUBLE_REGARD')}
          className={`flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2.5 ${
            activeMainTab === 'DOUBLE_REGARD'
              ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <ShieldAlert size={18} />
          <span>Double Regard • Opérations Critiques (4-Yeux)</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1.5 ${
            activeMainTab === 'DOUBLE_REGARD' 
              ? 'bg-amber-700 text-amber-100' 
              : pendingActionsCount > 0 
                ? 'bg-amber-100 text-amber-800 border border-amber-300' 
                : 'bg-slate-100 text-slate-700'
          }`}>
            {pendingActionsCount > 0 && <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>}
            {pendingActionsCount}
          </span>
        </button>
      </div>

      {activeMainTab === 'DOUBLE_REGARD' ? (
        <DoubleRegardValidationView
          user={user}
          schoolId={user.school_id!}
          selectedCampus={selectedCampus}
          isCampusLocked={isCampusLocked}
          terminology={terminology}
          onCountChange={setPendingActionsCount}
        />
      ) : (
        <>
      {/* KPIs & Filtres */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
            <span className="text-xs font-bold text-slate-700">En cours de traitement : <span className="text-amber-600">{kpis.total}</span></span>
          </div>
          {kpis.urgent > 0 && (
            <div className="flex items-center gap-2 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-200 text-rose-700">
              <AlertTriangle size={14} />
              <span className="text-xs font-bold">{kpis.urgent} dossier(s) en attente depuis +3 jours</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Sélecteur de Campus / Annexe */}
          {campuses && campuses.length > 0 && (
            <div className="relative shrink-0">
              <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              {isCampusLocked ? (
                <div className="pl-9 pr-4 py-2 text-xs font-bold bg-slate-100 border border-slate-200 rounded-xl text-slate-600 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  Campus assigné : {getCampusName(user.campus_id!)}
                </div>
              ) : (
                <select
                  value={selectedCampus}
                  onChange={(e) => setSelectedCampus(e.target.value)}
                  className="pl-9 pr-8 py-2 text-sm font-bold bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none appearance-none cursor-pointer"
                >
                  <option value="ALL">Tous les Campus / Annexes</option>
                  {campuses.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Recherche */}
          <div className="relative flex-1 lg:w-64 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={`Rechercher un ${terminology.student.toLowerCase()}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none placeholder:text-slate-400 transition-all font-medium"
            />
          </div>
        </div>
      </div>

      {/* Liste des Dossiers */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center text-slate-500 space-y-4">
            <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
            <p className="text-sm font-medium animate-pulse">Analyse des registres d'admission...</p>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-500" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-black text-slate-900">File d'attente vide</h3>
              <p className="text-slate-500 text-sm max-w-md mx-auto">
                {searchTerm || selectedCampus !== 'ALL' 
                  ? "Aucun dossier ne correspond à vos critères de recherche actuels."
                  : `Parfait ! Tous les nouveaux dossiers d'inscription ont été traités et validés.`}
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-xs uppercase tracking-wider font-extrabold text-slate-500">
                  <th className="p-4">Candidat ({terminology.student})</th>
                  <th className="p-4">{terminology.class} Demandée</th>
                  <th className="p-4">Date de Dépôt</th>
                  <th className="p-4 text-center">Âge</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map((student) => {
                  const daysWaiting = getDaysWaiting(student.created_at);
                  const isUrgent = daysWaiting >= 3;
                  const studentCampusId = student.campus_id || student.class?.campus_id;
                  
                  return (
                    <tr key={student.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          {student.photo_url ? (
                            <img 
                              src={student.photo_url} 
                              alt="" 
                              className="w-10 h-10 rounded-full object-cover border shadow-sm shrink-0" 
                            />
                          ) : (
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 border shadow-sm ${
                              student.gender === 'F' 
                                ? 'bg-pink-50 text-pink-600 border-pink-200'
                                : 'bg-blue-50 text-blue-600 border-blue-200'
                            }`}>
                              {(student.first_name || '').charAt(0)}{(student.last_name || '').charAt(0)}
                            </div>
                          )}
                          <div>
                            <p className="font-bold text-slate-900 text-sm">
                              {student.first_name} {student.last_name}
                            </p>
                            <p className="text-[11px] text-slate-500 font-medium flex items-center gap-1 mt-0.5">
                              {student.matricule ? (
                                <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{student.matricule}</span>
                              ) : (
                                "Nouveau Candidat"
                              )}
                              {student.parent_phone && (
                                <span className="text-slate-400">• Tél: {student.parent_phone}</span>
                              )}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="space-y-1.5">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-black bg-indigo-50 text-indigo-700 border border-indigo-100">
                            {student.class?.name || `${terminology.class} non assignée`}
                          </span>
                          {campuses && campuses.length > 0 && (
                            <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
                              <MapPin size={12} className="text-slate-400" />
                              {getCampusName(studentCampusId)}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-bold text-slate-700">
                            {new Date(student.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full w-fit ${
                            isUrgent ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'
                          }`}>
                            <Clock size={10} />
                            En attente depuis {daysWaiting === 0 ? "aujourd'hui" : `${daysWaiting} jour(s)`}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <span className="text-sm font-bold text-slate-700">
                          {student.date_of_birth ? (
                            `${Math.floor((new Date().getTime() - new Date(student.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))} ans`
                          ) : (
                            'N/A'
                          )}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => openReview(student)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-slate-50 text-indigo-600 text-xs font-bold rounded-xl border border-slate-200 shadow-sm transition-all group-hover:border-indigo-300 group-hover:shadow-md"
                        >
                          Examiner le dossier
                          <ChevronRight size={14} className="text-slate-400 group-hover:text-indigo-600 transition-colors" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal d'Examen Rapide (Quick Review Modal) */}
      {reviewingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setReviewingStudent(null)} />
          
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header Modal */}
            <div className="flex items-center justify-between p-5 sm:p-6 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-3">
                {reviewingStudent.photo_url ? (
                  <img 
                    src={reviewingStudent.photo_url} 
                    alt="" 
                    className="w-12 h-12 rounded-2xl object-cover border border-indigo-200 shadow-sm shrink-0" 
                  />
                ) : (
                  <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-black text-lg border border-indigo-200">
                    {(reviewingStudent.first_name || '').charAt(0)}{(reviewingStudent.last_name || '').charAt(0)}
                  </div>
                )}
                <div>
                  <h2 className="text-xl font-black text-slate-900">
                    {reviewingStudent.first_name} {reviewingStudent.last_name}
                  </h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                      Dossier #{reviewingStudent.id.substring(0, 8)}
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                      En attente de validation
                    </span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setReviewingStudent(null)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <XCircle size={24} />
              </button>
            </div>

            {/* Body Modal */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                
                {/* Colonne 1 : Informations du Candidat */}
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                      <User size={14} /> Profil de l'{terminology.student}
                    </h3>
                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-3 text-sm">
                      <div className="grid grid-cols-2 gap-2 border-b border-slate-200/60 pb-3">
                        <span className="text-slate-500 font-medium">Date de naissance :</span>
                        <span className="font-bold text-slate-900">
                          {reviewingStudent.date_of_birth ? new Date(reviewingStudent.date_of_birth).toLocaleDateString('fr-FR') : 'Non renseignée'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 border-b border-slate-200/60 pb-3">
                        <span className="text-slate-500 font-medium">Sexe :</span>
                        <span className="font-bold text-slate-900">{reviewingStudent.gender === 'M' ? 'Masculin' : reviewingStudent.gender === 'F' ? 'Féminin' : 'Autre'}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 border-b border-slate-200/60 pb-3">
                        <span className="text-slate-500 font-medium">Lieu de naissance :</span>
                        <span className="font-bold text-slate-900">{reviewingStudent.place_of_birth || '-'}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 pb-1">
                        <span className="text-slate-500 font-medium">Établissement préc. :</span>
                        <span className="font-bold text-slate-900">{reviewingStudent.previous_school || '-'}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                      <Building2 size={14} /> Affectation & Campus
                    </h3>
                    <div className="bg-indigo-50/50 rounded-2xl p-4 border border-indigo-100/50 space-y-3 text-sm">
                      <div className="grid grid-cols-2 gap-2">
                        <span className="text-slate-500 font-medium">{terminology.class} demandée :</span>
                        <span className="font-black text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded w-fit">
                          {reviewingStudent.class?.name || 'Non spécifiée'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <span className="text-slate-500 font-medium">Campus / Annexe :</span>
                        <span className="font-bold text-slate-900 flex items-center gap-1.5">
                          <MapPin size={14} className="text-indigo-400" />
                          {getCampusName(reviewingStudent.campus_id || reviewingStudent.class?.campus_id)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                      <Phone size={14} /> Contacts & Responsables
                    </h3>
                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-3 text-sm">
                      <div className="grid grid-cols-2 gap-2 border-b border-slate-200/60 pb-3">
                        <span className="text-slate-500 font-medium">Responsable :</span>
                        <span className="font-bold text-slate-900">{reviewingStudent.parent_name || '-'}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 border-b border-slate-200/60 pb-3">
                        <span className="text-slate-500 font-medium">Téléphone :</span>
                        <span className="font-bold text-slate-900">{reviewingStudent.parent_phone || reviewingStudent.phone || '-'}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 pb-1">
                        <span className="text-slate-500 font-medium">Email :</span>
                        <span className="font-bold text-slate-900 truncate">{reviewingStudent.parent_email || reviewingStudent.email || '-'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Colonne 2 : Checklist & Contrôle des Pièces */}
                <div className="flex flex-col h-full">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
                      <FileCheck2 size={14} /> Contrôle des Pièces (Checklist)
                    </h3>
                    <button
                      type="button"
                      onClick={toggleAllChecklist}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1.5"
                    >
                      {Object.values(checklist).every(Boolean) ? (
                        <><Square size={13} /> Tout décocher</>
                      ) : (
                        <><CheckSquare size={13} /> Tout cocher</>
                      )}
                    </button>
                  </div>
                  
                  <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4 flex-1">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <p className="text-xs text-slate-500 font-medium">
                        Standard institutionnel :
                      </p>
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                        {school?.school_type === 'UNIVERSITY' ? 'Université' : school?.school_type === 'PROFESSIONAL' ? 'Institut Pro' : 'Scolaire'}
                      </span>
                    </div>
                    
                    <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                      {docDefs.map(def => {
                        const rawDoc = reviewingStudent?.submitted_documents?.[def.id];
                        const fileUrl = rawDoc?.file_url || rawDoc?.url || null;

                        return (
                          <div 
                            key={def.id} 
                            className="p-3 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50/60 transition-all group"
                          >
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5">
                                <input 
                                  type="checkbox" 
                                  checked={!!checklist[def.id]}
                                  onChange={(e) => setChecklist(p => ({ ...p, [def.id]: e.target.checked }))}
                                  className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600/20 cursor-pointer" 
                                />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-bold text-slate-900">{def.name}</span>
                                  {def.required ? (
                                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">Obligatoire</span>
                                  ) : (
                                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-500">Facultatif</span>
                                  )}
                                  {checklist[def.id] && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-0.5">
                                      <Check size={10} /> Validé
                                    </span>
                                  )}
                                </div>
                                {def.description && (
                                  <p className="text-[11px] text-slate-500 mt-0.5">{def.description}</p>
                                )}
                                {fileUrl && (
                                  <a 
                                    href={fileUrl} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 mt-1.5 bg-indigo-50/80 px-2 py-0.5 rounded-md"
                                  >
                                    <FileText size={12} />
                                    Consulter la pièce justificative
                                    <ExternalLink size={10} />
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Modal : Actions */}
            <div className="p-5 sm:p-6 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-4">
              <button
                onClick={() => setRejectingStudent(reviewingStudent)}
                disabled={actionLoading}
                className="w-full sm:w-auto px-6 py-3 bg-white hover:bg-rose-50 text-rose-600 text-sm font-bold rounded-xl border border-rose-200 transition-all flex items-center justify-center gap-2"
              >
                <UserX size={18} />
                Rejeter le dossier
              </button>
              
              <div className="w-full sm:w-auto flex flex-col items-center sm:items-end gap-2">
                <button
                  onClick={() => handleValidate(reviewingStudent)}
                  disabled={actionLoading}
                  className="w-full sm:w-auto px-8 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-70 text-white text-sm font-bold rounded-xl shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-2"
                >
                  <UserCheck size={18} />
                  {actionLoading ? 'Validation en cours...' : 'Valider & Activer le Dossier'}
                </button>
                {!Object.values(checklist).every(Boolean) && (
                  <p className="text-[10px] font-bold text-amber-600 flex items-center gap-1">
                    <AlertCircle size={12} /> Certaines pièces ne sont pas cochées.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Rejet avec Motif */}
      {rejectingStudent && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setRejectingStudent(null)} />
          <div className="relative bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <UserX size={32} />
            </div>
            
            <h3 className="text-xl font-black text-center text-slate-900 mb-2">Rejeter le dossier</h3>
            <p className="text-center text-slate-500 text-sm mb-6">
              Veuillez indiquer le motif du rejet pour <strong>{rejectingStudent.first_name} {rejectingStudent.last_name}</strong>. Cette action sera consignée dans le journal d'audit.
            </p>
            
            <form onSubmit={handleReject} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Motif du rejet <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none"
                >
                  <option value="">Sélectionner un motif...</option>
                  <option value="Dossier incomplet (pièces manquantes)">Dossier incomplet (pièces manquantes)</option>
                  <option value="Capacité d'accueil atteinte (Classe complète)">Capacité d'accueil atteinte (Classe complète)</option>
                  <option value="Âge ou niveau non conforme">Âge ou niveau non conforme</option>
                  <option value="Défaut de paiement des frais de dossier">Défaut de paiement des frais de dossier</option>
                  <option value="Autre (Préciser en note)">Autre</option>
                </select>
              </div>
              
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectingStudent(null)}
                  className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !rejectionReason}
                  className="flex-1 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl transition-colors shadow-md shadow-rose-200"
                >
                  {actionLoading ? 'Rejet...' : 'Confirmer le rejet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </>
      )}

    </div>
  );
};

export default ValidationList;
