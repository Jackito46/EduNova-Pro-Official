import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  ShieldAlert, Gavel, Plus, Search, Filter, Calendar, 
  User, AlertTriangle, CheckCircle2, XCircle, Clock, 
  ChevronRight, Info, MoreVertical, Trash2, Edit2,
  FileText, Download, Loader2, X, ShieldCheck, Building2,
  GraduationCap, Sparkles, Printer, FileSpreadsheet, Eye,
  RefreshCw, Check, AlertCircle, ArrowUpRight, Scale,
  BookOpen, School as SchoolIcon, Layers, UserCheck, Shield
} from 'lucide-react';
import { supabase, isValidUuid } from '../supabase';
import { UserProfile, AcademicYear } from '../types';
import { useSchool } from '../contexts/SchoolContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import Modal from './Modal';
import { formatStudentName, getDefiniteArticle } from '../utils/formatters';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { AcademicSessionPill } from './AcademicSessionPill';

interface DisciplinaryRecord {
  id: string;
  student_id: string;
  academic_year_id: string;
  school_id: string;
  incident_date: string;
  incident_type: 'CONDUITE' | 'RETARD' | 'ABSENCE_NON_JUSTIFIEE' | 'TRAVAIL_NON_FAIT' | 'FRAUDE' | 'VIOLENCE' | 'AUTRE';
  description: string;
  sanction_type: string;
  sanction_duration: number;
  status: 'SIGNALÉ' | 'EN_COURS' | 'CLOS' | 'ANNULÉ';
  recorded_by: string;
  created_at: string;
  student?: {
    first_name: string;
    last_name: string;
    class_id: string;
    code?: string;
    matricule?: string;
    photo_url?: string;
  };
}

interface SanctionType {
  id: string;
  name: string;
  description: string;
}

interface StudentOption {
  id: string;
  name: string;
  lastName: string;
  firstName: string;
  class_id: string;
  class_name: string;
  campus_id?: string | null;
  campus_name?: string | null;
  code?: string;
  photo_url?: string;
  priorIncidentsCount?: number;
}

const DisciplinaryView: React.FC<{ user: UserProfile }> = ({ user }) => {
  const { school, terminology, campuses, currentCampusId, setCurrentCampusId, activeAcademicYear } = useSchool();
  
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<DisciplinaryRecord[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<string | null>(null);
  const [sanctionTypes, setSanctionTypes] = useState<SanctionType[]>([]);
  
  // View mode
  const [viewMode, setViewMode] = useState<'CARDS' | 'TABLE'>('CARDS');

  // Multi-campus & Filtering
  const hasMultiCampus = Boolean(school?.has_multi_campus && campuses && campuses.length > 1);
  const [selectedCampusFilter, setSelectedCampusFilter] = useState<string>(user.campus_id || currentCampusId || 'ALL');
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [classFilter, setClassFilter] = useState('ALL');
  const [sanctionFilter, setSanctionFilter] = useState('ALL');

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  
  const [selectedRecord, setSelectedRecord] = useState<DisciplinaryRecord | null>(null);
  const [recordToDelete, setRecordToDelete] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Config Modal States
  const [editingSanctionType, setEditingSanctionType] = useState<SanctionType | null>(null);
  const [sanctionTypeFormData, setSanctionTypeFormData] = useState({ name: '', description: '' });

  // Add / Edit Form State
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [showStudentSuggestions, setShowStudentSuggestions] = useState(false);
  const [selectedStudentForAdd, setSelectedStudentForAdd] = useState<StudentOption | null>(null);
  const [selectedClassForAdd, setSelectedClassForAdd] = useState('ALL');
  
  const [formData, setFormData] = useState({
    student_id: '',
    incident_date: new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0],
    incident_type: 'CONDUITE' as DisciplinaryRecord['incident_type'],
    description: '',
    sanction_type: 'AUCUNE',
    sanction_duration: 0,
    status: 'SIGNALÉ' as DisciplinaryRecord['status']
  });

  const isUniversity = school?.school_type === 'UNIVERSITY';
  const isProfessional = school?.school_type === 'PROFESSIONAL';
  const isAdmin = user.role === 'SCHOOL_ADMIN' || user.role === 'DIRECTOR' || user.role === 'SUPER_ADMIN' || user.role === 'SUPERVISOR';

  // Smart incident templates based on institution type
  const incidentTemplates = useMemo(() => {
    if (isUniversity || isProfessional) {
      return [
        { title: 'Plagiat / Fraude examen', type: 'FRAUDE', description: `Tentative de tricherie ou utilisation frauduleuse de documents/IA non autorisés lors de l'évaluation.` },
        { title: 'Absentéisme non justifié', type: 'ABSENCE_NON_JUSTIFIEE', description: `Absences répétées et non justifiées aux séances de Travaux Pratiques / Dirigés obligatoires.` },
        { title: 'Perturbation de cours/amphi', type: 'CONDUITE', description: `Perturbation de la séance académique et refus d'obtempérer aux consignes de l'enseignant.` },
        { title: 'Manquement déontologique', type: 'CONDUITE', description: `Comportement irrespectueux envers les pairs ou le personnel administratif / professoral.` },
        { title: 'Dégradation matérielle', type: 'VIOLENCE', description: `Dégradation ou manipulation non autorisée du matériel de laboratoire ou des équipements de l'établissement.` }
      ];
    }
    return [
      { title: 'Retard répétitif', type: 'RETARD', description: `${getDefiniteArticle(terminology.student, true)} ${terminology.student.toLowerCase()} arrive systématiquement en retard aux premiers cours sans justificatif valable.` },
      { title: 'Bavardages & perturbation', type: 'CONDUITE', description: `Perturbation répétée du cours par des bavardages et refus d'écouter malgré les rappels à l'ordre.` },
      { title: 'Absence injustifiée', type: 'ABSENCE_NON_JUSTIFIEE', description: `Absence constatée lors de l'appel sans justificatif des parents ni billet d'entrée.` },
      { title: 'Devoir non rendu', type: 'TRAVAIL_NON_FAIT', description: `${getDefiniteArticle(terminology.student, true)} ${terminology.student.toLowerCase()} n'a pas remis le travail assigné dans les délais prescrits.` },
      { title: 'Insolence & indiscipline', type: 'CONDUITE', description: `Manque de respect flagrant ou propos déplacés envers un membre de la communauté éducative.` },
      { title: 'Violences verbales/physiques', type: 'VIOLENCE', description: `Altercation ou comportement agressif envers un camarade nécessitant une intervention immédiate.` }
    ];
  }, [isUniversity, isProfessional, terminology.student]);

  // Load active academic year and all years
  const fetchAcademicYears = useCallback(async () => {
    if (!user?.school_id) return;
    try {
      const { data, error } = await supabase
        .from('academic_years')
        .select('*')
        .eq('school_id', user.school_id)
        .order('is_active', { ascending: false })
        .order('start_date', { ascending: false });

      if (error) throw error;
      if (data && data.length > 0) {
        setAcademicYears(data);
        if (!selectedYearId) {
          const active = data.find(y => y.is_active) || data[0];
          setSelectedYearId(active.id);
        }
      }
    } catch (err) {
      console.warn("DisciplinaryView: Academic years fetch warning:", err);
    }
  }, [user.school_id, selectedYearId]);

  // Fetch all disciplinary records, classes and students
  const fetchRecords = useCallback(async () => {
    if (!user?.school_id) {
      console.warn("DisciplinaryView: No school_id provided");
      return;
    }

    setLoading(true);
    try {
      // 1. Determine active year ID
      let yearId = selectedYearId;
      if (!yearId) {
        const { data: years } = await supabase
          .from('academic_years')
          .select('id, is_active')
          .eq('school_id', user.school_id)
          .order('is_active', { ascending: false })
          .limit(1);
        yearId = years?.[0]?.id || null;
        if (yearId) setSelectedYearId(yearId);
      }

      if (!yearId) {
        console.warn("DisciplinaryView: No active academic session found");
        setLoading(false);
        return;
      }

      // 2. Fetch Disciplinary Records for this session
      const { data: recordsData, error: recordsError } = await supabase
        .from('disciplinary_records')
        .select(`
          *,
          student:students(
            id,
            first_name, 
            last_name,
            class_id
          )
        `)
        .eq('school_id', user.school_id)
        .eq('academic_year_id', yearId)
        .order('incident_date', { ascending: false });

      if (recordsError) {
        console.error("DisciplinaryView: Records fetch error:", recordsError);
        throw new Error(`Erreur incidents: ${recordsError.message}`);
      }
      
      const loadedRecords: DisciplinaryRecord[] = recordsData || [];
      setRecords(loadedRecords);

      // 3. Fetch Classes for this school
      let classesQuery = supabase
        .from('classes')
        .select('id, name, campus_id, level')
        .eq('school_id', user.school_id)
        .order('name');

      const effectiveCampusId = user.campus_id || (selectedCampusFilter === 'ALL' ? null : selectedCampusFilter);
      if (effectiveCampusId && isValidUuid(effectiveCampusId)) {
        classesQuery = classesQuery.eq('campus_id', effectiveCampusId);
      }

      const { data: fetchedClasses, error: classesError } = await classesQuery;
      if (classesError) {
        console.error("DisciplinaryView: Classes fetch error:", classesError);
      }
      const classesList = fetchedClasses || [];
      setClasses(classesList);

      const classMap = new Map();
      classesList.forEach(c => classMap.set(c.id, { name: c.name, campus_id: c.campus_id }));

      const campusMap = new Map();
      (campuses || []).forEach(cp => campusMap.set(cp.id, cp.name));

      // Count prior incidents per student in this session
      const studentIncidentCounts: Record<string, number> = {};
      loadedRecords.forEach(r => {
        studentIncidentCounts[r.student_id] = (studentIncidentCounts[r.student_id] || 0) + 1;
      });

      // 4. Fetch Enrolled Students for this academic year + Students fallback
      let enrollQuery = supabase
        .from('enrollments')
        .select('id, student_id, class_id, academic_year_id, status');
      
      if (user.school_id) {
        enrollQuery = enrollQuery.or(`school_id.eq.${user.school_id},school_id.is.null`);
      }
      if (yearId) {
        enrollQuery = enrollQuery.eq('academic_year_id', yearId);
      }

      const { data: enrollData } = await enrollQuery;

      // Query all students for this school
      let stQuery = supabase
        .from('students')
        .select('id, first_name, last_name, class_id, status')
        .order('last_name', { ascending: true });

      if (user.school_id) {
        stQuery = stQuery.or(`school_id.eq.${user.school_id},school_id.is.null`);
      }

      const { data: allStudentsData } = await stQuery;
      const allStudents = allStudentsData || [];

      // Create enrollment map by student_id
      const enrollmentByStudent = new Map<string, { class_id: string; status?: string }>();
      (enrollData || []).forEach((e: any) => {
        if (e.student_id) {
          enrollmentByStudent.set(e.student_id, { class_id: e.class_id, status: e.status });
        }
      });

      const mappedStudents: StudentOption[] = [];
      const seenStudentIds = new Set<string>();

      allStudents.forEach((stu: any) => {
        // Skip deleted/archived students
        const stuStatus = stu.status || '';
        if (stuStatus === 'Archivé' || stuStatus === 'Supprimé' || stuStatus === 'ARCHIVED' || stuStatus === 'DELETED') {
          return;
        }

        const enrollment = enrollmentByStudent.get(stu.id);
        const resolvedClassId = enrollment?.class_id || stu.class_id;
        
        // If year is filtered and enrollments exist, prefer students enrolled in the year or belonging to school classes
        if (seenStudentIds.has(stu.id)) return;
        seenStudentIds.add(stu.id);

        const classInfo = classMap.get(resolvedClassId);
        const formatted = formatStudentName(stu.last_name, stu.first_name);

        mappedStudents.push({
          id: stu.id,
          name: formatted.fullName,
          lastName: formatted.lastName,
          firstName: formatted.firstName,
          class_id: resolvedClassId || '',
          class_name: classInfo?.name || (resolvedClassId ? 'Classe' : 'Classe non assignée'),
          campus_id: classInfo?.campus_id || null,
          campus_name: (classInfo?.campus_id ? campusMap.get(classInfo.campus_id) : null) || 'Principal',
          code: '',
          priorIncidentsCount: studentIncidentCounts[stu.id] || 0
        });
      });

      setStudents(mappedStudents.sort((a, b) => a.name.localeCompare(b.name)));

      // 5. Fetch Sanction Types
      const { data: sanctionTypesData, error: sanctionTypesError } = await supabase
        .from('disciplinary_sanction_types')
        .select('*')
        .eq('school_id', user.school_id)
        .order('name');

      if (sanctionTypesError) {
        console.error("DisciplinaryView: Sanction types fetch error:", sanctionTypesError);
      }
      setSanctionTypes(sanctionTypesData || []);

    } catch (err: any) {
      console.error("DisciplinaryView: Global fetch error:", err);
      toast.error(err.message || "Erreur lors du chargement des dossiers disciplinaires.");
    } finally {
      setLoading(false);
    }
  }, [user.school_id, user.campus_id, selectedYearId, selectedCampusFilter, campuses]);

  useEffect(() => {
    fetchAcademicYears();
  }, [fetchAcademicYears]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Filter student list in Add / Edit Modal
  const studentsForModal = useMemo(() => {
    let list = students;
    if (selectedClassForAdd !== 'ALL') {
      list = list.filter(s => s.class_id === selectedClassForAdd);
    }
    
    if (studentSearchTerm.trim()) {
      const searchLower = studentSearchTerm.toLowerCase();
      list = list.filter(s => 
        s.name.toLowerCase().includes(searchLower) ||
        (s.code && s.code.toLowerCase().includes(searchLower)) ||
        s.class_name.toLowerCase().includes(searchLower)
      );
    }
    
    return list;
  }, [students, selectedClassForAdd, studentSearchTerm]);

  // Master Filtered Records
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const studentFullName = formatStudentName(r.student?.last_name || '', r.student?.first_name || '').fullName.toLowerCase();
      const searchLower = searchTerm.toLowerCase();
      
      const matchesSearch = 
        !searchTerm ||
        studentFullName.includes(searchLower) ||
        (r.student?.last_name && r.student.last_name.toLowerCase().includes(searchLower)) ||
        (r.student?.first_name && r.student.first_name.toLowerCase().includes(searchLower)) ||
        (r.student?.code && r.student.code.toLowerCase().includes(searchLower)) ||
        (r.description && r.description.toLowerCase().includes(searchLower)) ||
        (r.sanction_type && r.sanction_type.toLowerCase().includes(searchLower));
      
      const matchesType = typeFilter === 'ALL' || r.incident_type === typeFilter;
      const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
      
      const classMatchObj = classes.find(c => c.id === r.student?.class_id);
      const matchesClass = classFilter === 'ALL' || classMatchObj?.name === classFilter;
      
      const effectiveCampus = user.campus_id || (selectedCampusFilter === 'ALL' ? null : selectedCampusFilter);
      if (effectiveCampus && classMatchObj?.campus_id && classMatchObj.campus_id !== effectiveCampus) {
        return false;
      }

      const matchesSanction = 
        sanctionFilter === 'ALL' ? true :
        sanctionFilter === 'WITH_SANCTION' ? r.sanction_type !== 'AUCUNE' :
        sanctionFilter === 'NO_SANCTION' ? r.sanction_type === 'AUCUNE' :
        r.sanction_type === sanctionFilter;
      
      return matchesSearch && matchesType && matchesStatus && matchesClass && matchesSanction;
    });
  }, [records, searchTerm, typeFilter, statusFilter, classFilter, sanctionFilter, user.campus_id, selectedCampusFilter, classes]);

  // Statistics calculation
  const stats = useMemo(() => {
    const total = records.length;
    const pendingOrInProgress = records.filter(r => r.status === 'SIGNALÉ' || r.status === 'EN_COURS').length;
    const closed = records.filter(r => r.status === 'CLOS').length;
    const withSanctions = records.filter(r => r.sanction_type && r.sanction_type !== 'AUCUNE').length;
    const severeCount = records.filter(r => 
      r.sanction_type?.includes('EXCLUSION') || 
      r.sanction_type?.includes('BLAME') || 
      r.incident_type === 'FRAUDE' || 
      r.incident_type === 'VIOLENCE'
    ).length;

    const resolutionRate = total > 0 ? Math.round((closed / total) * 100) : 100;

    return {
      total,
      pendingOrInProgress,
      closed,
      withSanctions,
      severeCount,
      resolutionRate
    };
  }, [records]);

  // Create Disciplinary Record
  const handleAddRecord = async () => {
    if (!formData.student_id || !formData.description.trim()) {
      toast.error("Veuillez identifier l'apprenant et saisir la description des faits.");
      return;
    }

    if (!selectedYearId) {
      toast.error("Aucune session académique sélectionnée. Impossible d'enregistrer.");
      return;
    }

    setSaving(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();

      const recordToInsert = {
        student_id: formData.student_id,
        incident_date: formData.incident_date,
        incident_type: formData.incident_type,
        description: formData.description.trim(),
        sanction_type: formData.sanction_type,
        sanction_duration: formData.sanction_duration,
        status: formData.status,
        school_id: user.school_id,
        academic_year_id: selectedYearId,
        recorded_by: authUser?.id || user.id
      };

      const { error } = await supabase
        .from('disciplinary_records')
        .insert([recordToInsert]);

      if (error) throw error;
      
      toast.success("Incident enregistré au registre disciplinaire.");
      setIsAddModalOpen(false);
      setFormData({
        student_id: '',
        incident_date: new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0],
        incident_type: 'CONDUITE',
        description: '',
        sanction_type: 'AUCUNE',
        sanction_duration: 0,
        status: 'SIGNALÉ'
      });
      setSelectedStudentForAdd(null);
      setStudentSearchTerm('');
      fetchRecords();
    } catch (err: any) {
      console.error("DisciplinaryView: Error adding record:", err);
      toast.error(`Erreur lors de l'enregistrement: ${err.message || 'Erreur inconnue'}`);
    } finally {
      setSaving(false);
    }
  };

  // Update Record
  const handleUpdateRecord = async () => {
    if (!selectedRecord) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('disciplinary_records')
        .update({
          incident_type: formData.incident_type,
          description: formData.description.trim(),
          sanction_type: formData.sanction_type,
          sanction_duration: formData.sanction_duration,
          status: formData.status,
          incident_date: formData.incident_date
        })
        .eq('id', selectedRecord.id)
        .eq('school_id', user.school_id);

      if (error) throw error;
      
      toast.success("Dossier disciplinaire mis à jour.");
      setIsEditModalOpen(false);
      setSelectedRecord(null);
      fetchRecords();
    } catch (err: any) {
      console.error("DisciplinaryView: Error updating record:", err);
      toast.error(`Erreur lors de la mise à jour: ${err.message || 'Erreur inconnue'}`);
    } finally {
      setSaving(false);
    }
  };

  // Quick Status Update
  const handleQuickStatusChange = async (recordId: string, newStatus: DisciplinaryRecord['status']) => {
    try {
      const { error } = await supabase
        .from('disciplinary_records')
        .update({ status: newStatus })
        .eq('id', recordId)
        .eq('school_id', user.school_id);

      if (error) throw error;
      
      setRecords(prev => prev.map(r => r.id === recordId ? { ...r, status: newStatus } : r));
      toast.success(`Statut mis à jour : ${newStatus}`);
    } catch (err: any) {
      toast.error("Erreur lors de la mise à jour du statut.");
    }
  };

  // Delete Record
  const handleDeleteRecord = async () => {
    if (!recordToDelete) return;

    try {
      const { error } = await supabase
        .from('disciplinary_records')
        .delete()
        .eq('id', recordToDelete)
        .eq('school_id', user.school_id);

      if (error) throw error;
      toast.success("Enregistrement retiré du registre.");
      setIsDeleteModalOpen(false);
      setRecordToDelete(null);
      fetchRecords();
    } catch (err: any) {
      console.error("Error deleting record:", err);
      toast.error("Erreur lors de la suppression.");
    }
  };

  // Sanction Types Management
  const handleSaveSanctionType = async () => {
    if (!sanctionTypeFormData.name.trim()) {
      toast.error("Le libellé de la sanction est requis.");
      return;
    }

    setSaving(true);
    try {
      if (editingSanctionType) {
        const { error } = await supabase
          .from('disciplinary_sanction_types')
          .update({
            name: sanctionTypeFormData.name.trim(),
            description: sanctionTypeFormData.description.trim()
          })
          .eq('id', editingSanctionType.id)
          .eq('school_id', user.school_id);
        if (error) throw error;
        toast.success("Type de sanction modifié.");
      } else {
        const { error } = await supabase
          .from('disciplinary_sanction_types')
          .insert([{ 
            name: sanctionTypeFormData.name.trim(), 
            description: sanctionTypeFormData.description.trim(),
            school_id: user.school_id 
          }]);
        if (error) throw error;
        toast.success("Type de sanction ajouté au catalogue.");
      }
      setSanctionTypeFormData({ name: '', description: '' });
      setEditingSanctionType(null);
      
      const { data } = await supabase
        .from('disciplinary_sanction_types')
        .select('*')
        .eq('school_id', user.school_id)
        .order('name');
      setSanctionTypes(data || []);
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'enregistrement de la sanction.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSanctionType = async (id: string) => {
    if (!window.confirm("Êtes-vous certain de vouloir supprimer cette sanction du catalogue ?")) return;
    try {
      const { error } = await supabase
        .from('disciplinary_sanction_types')
        .delete()
        .eq('id', id)
        .eq('school_id', user.school_id);
      if (error) throw error;
      setSanctionTypes(prev => prev.filter(t => t.id !== id));
      toast.success("Type de sanction retiré.");
    } catch (err: any) {
      toast.error("Impossible de supprimer car ce type est déjà utilisé par des dossiers.");
    }
  };

  // Export PDF Report of Disciplinary Register
  const handleExportPDF = () => {
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const currentYearLabel = academicYears.find(y => y.id === selectedYearId)?.label || 'Session en cours';
      const campusLabel = selectedCampusFilter !== 'ALL' ? (campuses.find(c => c.id === selectedCampusFilter)?.name || 'Campus spécifique') : 'Tous les campus';

      // Header Brand
      doc.setFillColor(225, 29, 72); // Rose-600
      doc.rect(0, 0, 297, 16, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text((school?.name || 'EDUNOVA PRO').toUpperCase(), 14, 11);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(`REGISTRE DISCIPLINAIRE & SUIVI DES SANCTIONS - ${currentYearLabel.toUpperCase()}`, 283, 11, { align: 'right' });

      // Meta Information
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(`Rapport Disciplinaire Institutionnel`, 14, 28);
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(`Établissement: ${school?.name || 'N/A'}  •  Session: ${currentYearLabel}  •  Périmètre: ${campusLabel}  •  Généré le: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: fr })}`, 14, 34);

      // KPI Summary in PDF
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(14, 38, 269, 14, 2, 2, 'F');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.text(`TOTAL INCIDENTS: ${stats.total}`, 20, 46);
      doc.text(`EN COURS: ${stats.pendingOrInProgress}`, 85, 46);
      doc.text(`SANCTIONS PRONONCÉES: ${stats.withSanctions}`, 145, 46);
      doc.text(`DOSSIERS CLOS: ${stats.closed} (${stats.resolutionRate}%)`, 215, 46);

      // Table Data
      const tableData = filteredRecords.map((r, index) => {
        const student = formatStudentName(r.student?.last_name || '', r.student?.first_name || '').fullName;
        const className = classes.find(c => c.id === r.student?.class_id)?.name || 'N/A';
        const dateStr = format(new Date(r.incident_date), 'dd/MM/yyyy');
        const durationStr = r.sanction_duration > 0 ? ` (${r.sanction_duration}j)` : '';
        const sanctionStr = r.sanction_type !== 'AUCUNE' ? `${r.sanction_type}${durationStr}` : 'Aucune';

        return [
          (index + 1).toString(),
          dateStr,
          student,
          className,
          r.incident_type,
          r.description,
          sanctionStr,
          r.status
        ];
      });

      autoTable(doc, {
        head: [['#', 'Date', terminology.student, terminology.class, 'Type Incident', 'Faits & Description', 'Sanction', 'Statut']],
        body: tableData,
        startY: 56,
        theme: 'striped',
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 8.5
        },
        bodyStyles: {
          fontSize: 8,
          textColor: [30, 41, 59]
        },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          1: { cellWidth: 22 },
          2: { cellWidth: 42, fontStyle: 'bold' },
          3: { cellWidth: 26 },
          4: { cellWidth: 26 },
          5: { cellWidth: 85 },
          6: { cellWidth: 36, fontStyle: 'bold' },
          7: { cellWidth: 22, halign: 'center' }
        },
        margin: { left: 14, right: 14 },
        didDrawPage: (data) => {
          doc.setFontSize(8);
          doc.setTextColor(148, 163, 184);
          doc.text(
            `EduNova Pro • Page ${data.pageNumber} / ${doc.internal.pages.length - 1} • Document d'administration scolaire confidentiel`,
            14,
            202
          );
        }
      });

      doc.save(`Registre_Disciplinaire_${school?.name ? school.name.replace(/\s+/g, '_') : 'EduNova'}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      toast.success("Registre disciplinaire PDF exporté avec succès.");
    } catch (err: any) {
      console.error("PDF Export error:", err);
      toast.error("Erreur lors de l'export PDF.");
    }
  };

  // Export Excel Report
  const handleExportExcel = () => {
    try {
      const dataToExport = filteredRecords.map((r, i) => {
        const student = formatStudentName(r.student?.last_name || '', r.student?.first_name || '').fullName;
        const className = classes.find(c => c.id === r.student?.class_id)?.name || 'N/A';
        return {
          '#': i + 1,
          'Date de l\'incident': format(new Date(r.incident_date), 'dd/MM/yyyy'),
          [`Nom de l'${terminology.student}`]: student,
          'Matricule/Code': r.student?.code || '',
          [terminology.class]: className,
          'Type d\'incident': r.incident_type,
          'Description des faits': r.description,
          'Type de Sanction': r.sanction_type,
          'Durée (Jours/Heures)': r.sanction_duration,
          'Statut du dossier': r.status,
          'Date d\'enregistrement': r.created_at ? format(new Date(r.created_at), 'dd/MM/yyyy HH:mm') : ''
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Suivi Disciplinaire");
      XLSX.writeFile(workbook, `Suivi_Disciplinaire_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
      toast.success("Exportation Excel réalisée avec succès.");
    } catch (err: any) {
      toast.error("Erreur lors de l'exportation Excel.");
    }
  };

  // Badge helpers
  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'CONDUITE': 
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50 text-purple-700 border border-purple-200/60 rounded-lg text-[10px] font-black uppercase tracking-wider">Conduite</span>;
      case 'RETARD': 
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200/60 rounded-lg text-[10px] font-black uppercase tracking-wider">Retard</span>;
      case 'ABSENCE_NON_JUSTIFIEE': 
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200/60 rounded-lg text-[10px] font-black uppercase tracking-wider">Absence</span>;
      case 'TRAVAIL_NON_FAIT': 
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200/60 rounded-lg text-[10px] font-black uppercase tracking-wider">Travail</span>;
      case 'FRAUDE': 
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-100 text-red-800 border border-red-300 rounded-lg text-[10px] font-black uppercase tracking-wider">Fraude</span>;
      case 'VIOLENCE': 
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-600 text-white rounded-lg text-[10px] font-black uppercase tracking-wider">Gravité</span>;
      default: 
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[10px] font-black uppercase tracking-wider">Autre</span>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SIGNALÉ': 
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-black"><Clock size={12} /> Signalé</span>;
      case 'EN_COURS': 
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-xs font-black"><Info size={12} /> En cours</span>;
      case 'CLOS': 
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-black"><CheckCircle2 size={12} /> Résolu & Clos</span>;
      case 'ANNULÉ': 
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-500 border border-slate-200 rounded-full text-xs font-black"><XCircle size={12} /> Annulé</span>;
      default: return null;
    }
  };

  const activeSessionLabel = academicYears.find(y => y.id === selectedYearId)?.label || activeAcademicYear?.label || 'Session en cours';

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-24">
      
      {/* 1. Header with MultiTenant, Campus and Academic Session Context */}
      <div className="bg-white p-4 sm:p-6 lg:p-7 rounded-3xl shadow-sm border border-slate-100/80 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-rose-500/10 via-amber-500/5 to-transparent rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-center gap-3.5 sm:gap-4">
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-rose-600 to-rose-700 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-rose-200 shrink-0">
              <Gavel size={26} className="rotate-[-10deg]" />
            </div>
            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">
                  {isUniversity ? 'Discipline & Déontologie' : isProfessional ? 'Discipline & Climat Académique' : 'Discipline & Climat Scolaire'}
                </h1>
                <span className="px-2.5 py-0.5 bg-rose-50 text-rose-700 border border-rose-100 rounded-full text-[10px] sm:text-[11px] font-black uppercase tracking-wider">
                  {isUniversity ? 'Supérieur' : isProfessional ? 'Formation Pro' : 'Scolaire'}
                </span>
              </div>
              
              <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 text-[11px] sm:text-xs font-semibold text-slate-500">
                <span className="inline-flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-100 text-slate-700">
                  <Building2 size={13} className="text-rose-600 shrink-0" />
                  <span className="font-bold text-slate-900 truncate max-w-[150px] sm:max-w-[220px]">{school?.name || 'Établissement'}</span>
                </span>

                <span className="inline-flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-100 text-slate-700">
                  <Calendar size={13} className="text-blue-600 shrink-0" />
                  <span className="text-slate-400">Session :</span>
                  <strong className="text-slate-900">{activeSessionLabel}</strong>
                </span>

                {hasMultiCampus && (
                  <span className="inline-flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-100 text-emerald-800">
                    <Layers size={13} className="text-emerald-600 shrink-0" />
                    <span className="text-emerald-600/80">Annexe :</span>
                    <strong className="text-emerald-950">
                      {selectedCampusFilter === 'ALL' ? 'Tous les campus' : (campuses.find(c => c.id === selectedCampusFilter)?.name || 'Campus')}
                    </strong>
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2.5 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
            {/* Session switcher */}
            {academicYears.length > 0 && (
              <AcademicSessionPill
                academicYears={academicYears}
                selectedYearId={selectedYearId || ''}
                onSelectYear={(yearId) => setSelectedYearId(yearId)}
                size="sm"
                colorScheme="rose"
              />
            )}

            {isAdmin && (
              <button 
                onClick={() => {
                  setFormData({
                    student_id: '',
                    incident_date: new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0],
                    incident_type: 'CONDUITE',
                    description: '',
                    sanction_type: 'AUCUNE',
                    sanction_duration: 0,
                    status: 'SIGNALÉ'
                  });
                  setSelectedStudentForAdd(null);
                  setStudentSearchTerm('');
                  setSelectedClassForAdd('ALL');
                  setIsAddModalOpen(true);
                }}
                className="flex-1 sm:flex-initial px-4 sm:px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-slate-200 active:scale-95 transition-all cursor-pointer"
              >
                <Plus size={16} />
                <span>Signaler un incident</span>
              </button>
            )}

            <button
              onClick={handleExportPDF}
              className="p-2.5 sm:px-3.5 sm:py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl transition-all shadow-xs flex items-center gap-1.5 text-xs font-bold"
              title="Exporter le registre en PDF"
            >
              <Download size={15} />
              <span className="hidden sm:inline">PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Interactive KPI Stats Dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div 
          onClick={() => { setStatusFilter('ALL'); setTypeFilter('ALL'); }}
          className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Total Incidents</span>
            <div className="w-10 h-10 bg-slate-50 text-slate-700 group-hover:bg-slate-900 group-hover:text-white rounded-2xl flex items-center justify-center transition-all">
              <ShieldAlert size={20} />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900">{stats.total}</span>
            <span className="text-xs font-bold text-slate-400">enregistrés</span>
          </div>
          <div className="mt-3 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div className="bg-slate-900 h-full w-full rounded-full" />
          </div>
        </div>

        <div 
          onClick={() => setStatusFilter('EN_COURS')}
          className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-amber-500 uppercase tracking-wider">Dossiers en cours</span>
            <div className="w-10 h-10 bg-amber-50 text-amber-600 group-hover:bg-amber-500 group-hover:text-white rounded-2xl flex items-center justify-center transition-all">
              <Clock size={20} />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-black text-amber-600">{stats.pendingOrInProgress}</span>
            <span className="text-xs font-bold text-slate-400">en instruction</span>
          </div>
          <div className="mt-3 w-full bg-amber-100 h-1.5 rounded-full overflow-hidden">
            <div 
              className="bg-amber-500 h-full rounded-full transition-all duration-500" 
              style={{ width: `${stats.total > 0 ? (stats.pendingOrInProgress / stats.total) * 100 : 0}%` }}
            />
          </div>
        </div>

        <div 
          onClick={() => setSanctionFilter('WITH_SANCTION')}
          className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-rose-500 uppercase tracking-wider">Sanctions Prononcées</span>
            <div className="w-10 h-10 bg-rose-50 text-rose-600 group-hover:bg-rose-600 group-hover:text-white rounded-2xl flex items-center justify-center transition-all">
              <Gavel size={20} />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-black text-rose-600">{stats.withSanctions}</span>
            <span className="text-xs font-bold text-slate-400">décisions fermes</span>
          </div>
          <div className="mt-3 w-full bg-rose-100 h-1.5 rounded-full overflow-hidden">
            <div 
              className="bg-rose-600 h-full rounded-full transition-all duration-500" 
              style={{ width: `${stats.total > 0 ? (stats.withSanctions / stats.total) * 100 : 0}%` }}
            />
          </div>
        </div>

        <div 
          onClick={() => setStatusFilter('CLOS')}
          className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-emerald-500 uppercase tracking-wider">Dossiers Résolus / Clos</span>
            <div className="w-10 h-10 bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white rounded-2xl flex items-center justify-center transition-all">
              <CheckCircle2 size={20} />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-black text-emerald-600">{stats.closed}</span>
            <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
              {stats.resolutionRate}% résolus
            </span>
          </div>
          <div className="mt-3 w-full bg-emerald-100 h-1.5 rounded-full overflow-hidden">
            <div 
              className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
              style={{ width: `${stats.resolutionRate}%` }}
            />
          </div>
        </div>
      </div>

      {/* 3. Main Filter & Control Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl shadow-sm border border-slate-100 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          
          {/* Live Search */}
          <div className="flex-1 min-w-[240px] relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text"
              placeholder={`Rechercher un ${terminology.student.toLowerCase()}, matricule, motif...`}
              className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs sm:text-sm font-semibold focus:bg-white focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 outline-none transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Campus Filter (if multi-campus) */}
          {hasMultiCampus && (
            <select 
              aria-label="Filtrer par campus ou annexe"
              className="px-3.5 py-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs font-bold text-slate-700 focus:bg-white focus:border-rose-500 outline-none transition-all cursor-pointer"
              value={selectedCampusFilter}
              onChange={(e) => setSelectedCampusFilter(e.target.value)}
            >
              <option value="ALL">Tous les campus / annexes</option>
              {campuses.map(cp => (
                <option key={cp.id} value={cp.id}>{cp.name}</option>
              ))}
            </select>
          )}

          {/* Class / Promotion Filter */}
          <select 
            aria-label="Filtrer par classe ou formation"
            className="px-3.5 py-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs font-bold text-slate-700 focus:bg-white focus:border-rose-500 outline-none transition-all cursor-pointer"
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
          >
            <option value="ALL">
              {isUniversity ? 'Toutes les filières / promotions' :
               isProfessional ? 'Toutes les formations' :
               'Toutes les classes'}
            </option>
            {classes.map(c => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>

          {/* Incident Type Filter */}
          <select 
            aria-label="Filtrer par type d'incident"
            className="px-3.5 py-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs font-bold text-slate-700 focus:bg-white focus:border-rose-500 outline-none transition-all cursor-pointer"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="ALL">Tous les types d'incidents</option>
            <option value="CONDUITE">Conduite / Déontologie</option>
            <option value="RETARD">Retard</option>
            <option value="ABSENCE_NON_JUSTIFIEE">Absence non justifiée</option>
            <option value="TRAVAIL_NON_FAIT">Travail non fait</option>
            <option value="FRAUDE">Fraude académique / Plagiat</option>
            <option value="VIOLENCE">Gravité / Violence</option>
            <option value="AUTRE">Autre incident</option>
          </select>

          {/* Status Filter */}
          <select 
            aria-label="Filtrer par statut du dossier"
            className="px-3.5 py-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs font-bold text-slate-700 focus:bg-white focus:border-rose-500 outline-none transition-all cursor-pointer"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">Tous les statuts</option>
            <option value="SIGNALÉ">Signalé</option>
            <option value="EN_COURS">En cours d'instruction</option>
            <option value="CLOS">Clos / Résolu</option>
            <option value="ANNULÉ">Annulé</option>
          </select>

          {/* View Switcher & Action Tools */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200">
              <button
                onClick={() => setViewMode('CARDS')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                  viewMode === 'CARDS' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Fiches
              </button>
              <button
                onClick={() => setViewMode('TABLE')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                  viewMode === 'TABLE' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Registre
              </button>
            </div>

            <button
              onClick={handleExportExcel}
              className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-2xl text-slate-700 transition-all"
              title="Exporter vers Excel (.xlsx)"
            >
              <FileSpreadsheet size={16} />
            </button>

            <button
              onClick={() => setIsRulesModalOpen(true)}
              className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-2xl transition-all"
              title="Consulter le Règlement Intérieur & Charte"
            >
              <BookOpen size={16} />
            </button>

            {isAdmin && (
              <button
                onClick={() => setIsConfigModalOpen(true)}
                className="p-3 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-2xl transition-all"
                title="Configurer les types de sanctions"
              >
                <ShieldCheck size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Active Filters Summary Pills */}
        {(typeFilter !== 'ALL' || statusFilter !== 'ALL' || classFilter !== 'ALL' || sanctionFilter !== 'ALL' || searchTerm) && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs font-bold">
            <span className="text-slate-400">Filtres actifs :</span>
            {searchTerm && (
              <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg flex items-center gap-1.5">
                Recherche: "{searchTerm}"
                <X size={12} className="cursor-pointer" onClick={() => setSearchTerm('')} />
              </span>
            )}
            {classFilter !== 'ALL' && (
              <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg flex items-center gap-1.5">
                Classe: {classFilter}
                <X size={12} className="cursor-pointer" onClick={() => setClassFilter('ALL')} />
              </span>
            )}
            {typeFilter !== 'ALL' && (
              <span className="px-2.5 py-1 bg-purple-50 text-purple-700 rounded-lg flex items-center gap-1.5">
                Type: {typeFilter}
                <X size={12} className="cursor-pointer" onClick={() => setTypeFilter('ALL')} />
              </span>
            )}
            {statusFilter !== 'ALL' && (
              <span className="px-2.5 py-1 bg-amber-50 text-amber-700 rounded-lg flex items-center gap-1.5">
                Statut: {statusFilter}
                <X size={12} className="cursor-pointer" onClick={() => setStatusFilter('ALL')} />
              </span>
            )}
            {sanctionFilter !== 'ALL' && (
              <span className="px-2.5 py-1 bg-rose-50 text-rose-700 rounded-lg flex items-center gap-1.5">
                Sanction: {sanctionFilter === 'WITH_SANCTION' ? 'Avec sanction' : sanctionFilter}
                <X size={12} className="cursor-pointer" onClick={() => setSanctionFilter('ALL')} />
              </span>
            )}
            <button 
              onClick={() => {
                setSearchTerm('');
                setClassFilter('ALL');
                setTypeFilter('ALL');
                setStatusFilter('ALL');
                setSanctionFilter('ALL');
              }}
              className="text-rose-600 hover:text-rose-700 underline text-[11px] ml-2"
            >
              Réinitialiser tout
            </button>
          </div>
        )}
      </div>

      {/* 4. Content Area: Cards View or Tabular Registry View */}
      {loading ? (
        <div className="bg-white rounded-3xl p-20 border border-slate-100 flex flex-col items-center justify-center gap-4 text-center">
          <Loader2 size={40} className="animate-spin text-rose-600" />
          <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Chargement des dossiers disciplinaires...</p>
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="bg-white rounded-3xl p-20 border border-slate-100 text-center space-y-4 shadow-sm">
          <div className="w-20 h-20 bg-slate-50 text-slate-300 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
            <ShieldCheck size={40} className="text-emerald-500" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-800">Aucun incident répertorié</h3>
            <p className="text-sm text-slate-500 font-medium max-w-md mx-auto mt-1">
              Tous les dossiers sont en règle pour les filtres sélectionnés ou aucun incident n'a été signalé.
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={() => {
                setFormData({
                  student_id: '',
                  incident_date: new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0],
                  incident_type: 'CONDUITE',
                  description: '',
                  sanction_type: 'AUCUNE',
                  sanction_duration: 0,
                  status: 'SIGNALÉ'
                });
                setSelectedStudentForAdd(null);
                setStudentSearchTerm('');
                setIsAddModalOpen(true);
              }}
              className="mt-4 px-6 py-3 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-2xl text-xs font-black transition-all inline-flex items-center gap-2 border border-rose-100"
            >
              <Plus size={16} />
              Signaler un premier incident
            </button>
          )}
        </div>
      ) : viewMode === 'CARDS' ? (
        
        /* Bento Cards View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRecords.map((record) => {
            const studentFormatted = formatStudentName(record.student?.last_name || '', record.student?.first_name || '');
            const classObj = classes.find(c => c.id === record.student?.class_id);
            const campusName = classObj?.campus_id ? campuses.find(cp => cp.id === classObj.campus_id)?.name : null;

            return (
              <div 
                key={record.id}
                className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm hover:shadow-md hover:border-rose-100 transition-all flex flex-col justify-between space-y-5 group relative"
              >
                <div className="space-y-4">
                  {/* Card Header: Student Avatar, Name, Badges */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3.5">
                      <div className="w-12 h-12 bg-slate-100 text-slate-600 rounded-2xl flex items-center justify-center font-black text-sm uppercase shadow-inner overflow-hidden shrink-0">
                        {record.student?.photo_url ? (
                          <img src={record.student.photo_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span>{studentFormatted.lastName.substring(0, 1)}{studentFormatted.firstName.substring(0, 1)}</span>
                        )}
                      </div>
                      <div>
                        <h3 className="font-black text-slate-900 text-sm sm:text-base leading-snug group-hover:text-rose-700 transition-colors">
                          {studentFormatted.fullName}
                        </h3>
                        <div className="flex flex-wrap items-center gap-2 mt-0.5">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-black uppercase">
                            {classObj?.name || 'Classe N/A'}
                          </span>
                          {campusName && (
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[10px] font-bold">
                              {campusName}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {getStatusBadge(record.status)}
                    </div>
                  </div>

                  {/* Incident Type and Date */}
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500 pt-2 border-t border-slate-50">
                    <div className="flex items-center gap-1.5">
                      <Calendar size={13} className="text-slate-400" />
                      <span>{format(new Date(record.incident_date), 'dd MMMM yyyy', { locale: fr })}</span>
                    </div>
                    {getTypeBadge(record.incident_type)}
                  </div>

                  {/* Incident Description */}
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium bg-slate-50/70 p-3.5 rounded-2xl border border-slate-100 line-clamp-3">
                    {record.description}
                  </p>

                  {/* Sanction Decision Section */}
                  {record.sanction_type !== 'AUCUNE' ? (
                    <div className="p-3 bg-rose-50/60 border border-rose-100 rounded-2xl flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Gavel size={15} className="text-rose-600 shrink-0" />
                        <div>
                          <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest">Sanction Appliquée</p>
                          <p className="text-xs font-black text-rose-700">{record.sanction_type}</p>
                        </div>
                      </div>
                      {record.sanction_duration > 0 && (
                        <span className="px-2.5 py-1 bg-white text-rose-700 border border-rose-200 rounded-xl text-xs font-black shadow-xs">
                          {record.sanction_duration} j
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="p-2.5 bg-slate-50 rounded-2xl flex items-center gap-2 text-slate-400 text-xs font-semibold">
                      <Shield size={14} />
                      <span>Aucune sanction formelle prononcée</span>
                    </div>
                  )}
                </div>

                {/* Card Footer Actions */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    {/* Quick status transition dropdown */}
                    {isAdmin && (
                      <select 
                        aria-label="Modifier le statut du dossier"
                        value={record.status}
                        onChange={(e) => handleQuickStatusChange(record.id, e.target.value as any)}
                        className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-[11px] font-bold border border-slate-200 outline-none cursor-pointer"
                      >
                        <option value="SIGNALÉ">Signalé</option>
                        <option value="EN_COURS">En cours</option>
                        <option value="CLOS">Clos</option>
                        <option value="ANNULÉ">Annulé</option>
                      </select>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* View Document / PV Modal button */}
                    <button
                      onClick={() => {
                        setSelectedRecord(record);
                        setIsDocModalOpen(true);
                      }}
                      className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                      title="Générer l'avis officiel / PV de sanction"
                    >
                      <Printer size={15} />
                      <span className="hidden sm:inline">Avis</span>
                    </button>

                    {/* Edit button */}
                    {isAdmin && (
                      <button
                        onClick={() => {
                          setSelectedRecord(record);
                          const studentObj = students.find(s => s.id === record.student_id);
                          if (studentObj) setSelectedStudentForAdd(studentObj);
                          setFormData({
                            student_id: record.student_id,
                            incident_date: record.incident_date,
                            incident_type: record.incident_type,
                            description: record.description,
                            sanction_type: record.sanction_type,
                            sanction_duration: record.sanction_duration,
                            status: record.status
                          });
                          setIsEditModalOpen(true);
                        }}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                        title="Modifier ce dossier"
                      >
                        <Edit2 size={15} />
                      </button>
                    )}

                    {/* Delete button */}
                    {isAdmin && (
                      <button
                        onClick={() => {
                          setRecordToDelete(record.id);
                          setIsDeleteModalOpen(true);
                        }}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                        title="Supprimer du registre"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (

        /* Tabular Registry View */
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white text-[11px] font-black uppercase tracking-wider">
                  <th className="py-4 px-5">Date</th>
                  <th className="py-4 px-5">{terminology.student}</th>
                  <th className="py-4 px-5">{terminology.class}</th>
                  <th className="py-4 px-5">Type d'incident</th>
                  <th className="py-4 px-5">Faits & Description</th>
                  <th className="py-4 px-5">Sanction</th>
                  <th className="py-4 px-5 text-center">Statut</th>
                  <th className="py-4 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                {filteredRecords.map((record) => {
                  const studentFormatted = formatStudentName(record.student?.last_name || '', record.student?.first_name || '');
                  const classObj = classes.find(c => c.id === record.student?.class_id);

                  return (
                    <tr key={record.id} className="hover:bg-slate-50/70 transition-colors group">
                      <td className="py-4 px-5 whitespace-nowrap text-slate-500 font-bold">
                        {format(new Date(record.incident_date), 'dd/MM/yyyy')}
                      </td>
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-black text-[11px] shrink-0">
                            {studentFormatted.lastName.substring(0, 1)}
                          </div>
                          <div>
                            <span className="font-black text-slate-900 block">{studentFormatted.fullName}</span>
                            {record.student?.code && (
                              <span className="text-[10px] text-slate-400">ID: {record.student.code}</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-5 whitespace-nowrap">
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-800 rounded-lg text-[10px] font-black">
                          {classObj?.name || 'N/A'}
                        </span>
                      </td>
                      <td className="py-4 px-5 whitespace-nowrap">
                        {getTypeBadge(record.incident_type)}
                      </td>
                      <td className="py-4 px-5 max-w-xs truncate text-slate-600">
                        {record.description}
                      </td>
                      <td className="py-4 px-5 whitespace-nowrap">
                        {record.sanction_type !== 'AUCUNE' ? (
                          <span className="px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-100 rounded-lg text-[11px] font-black">
                            {record.sanction_type} {record.sanction_duration > 0 ? `(${record.sanction_duration}j)` : ''}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Aucune</span>
                        )}
                      </td>
                      <td className="py-4 px-5 text-center whitespace-nowrap">
                        {getStatusBadge(record.status)}
                      </td>
                      <td className="py-4 px-5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedRecord(record);
                              setIsDocModalOpen(true);
                            }}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all"
                            title="Générer l'avis officiel de sanction"
                          >
                            <Printer size={14} />
                          </button>
                          {isAdmin && (
                            <>
                              <button
                                onClick={() => {
                                  setSelectedRecord(record);
                                  const studentObj = students.find(s => s.id === record.student_id);
                                  if (studentObj) setSelectedStudentForAdd(studentObj);
                                  setFormData({
                                    student_id: record.student_id,
                                    incident_date: record.incident_date,
                                    incident_type: record.incident_type,
                                    description: record.description,
                                    sanction_type: record.sanction_type,
                                    sanction_duration: record.sanction_duration,
                                    status: record.status
                                  });
                                  setIsEditModalOpen(true);
                                }}
                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                title="Modifier"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={() => {
                                  setRecordToDelete(record.id);
                                  setIsDeleteModalOpen(true);
                                }}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                title="Supprimer"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. Modal: Add / Edit Disciplinary Record */}
      <Modal
        isOpen={isAddModalOpen || isEditModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setIsEditModalOpen(false);
          setSelectedRecord(null);
          setSelectedStudentForAdd(null);
          setStudentSearchTerm('');
          setShowStudentSuggestions(false);
          setSelectedClassForAdd('ALL');
        }}
        title={
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner ${isEditModalOpen ? 'bg-blue-100 text-blue-600' : 'bg-rose-100 text-rose-600'}`}>
              {isEditModalOpen ? <Edit2 size={24} /> : <ShieldAlert size={24} />}
            </div>
            <div className="text-left">
              <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight leading-none">
                {isEditModalOpen ? "Modifier le Dossier Disciplinaire" : "Signaler un Nouvel Incident"}
              </h2>
              <p className="text-[10px] md:text-xs text-slate-500 font-bold uppercase tracking-[0.2em] mt-1.5">
                {isEditModalOpen ? "Mise à jour des faits et de la décision" : `Procédure de signalement • ${activeSessionLabel}`}
              </p>
            </div>
          </div>
        }
        onConfirm={isEditModalOpen ? handleUpdateRecord : handleAddRecord}
        confirmLabel={isEditModalOpen ? "Enregistrer les modifications" : "Enregistrer au registre"}
        isLoading={saving}
        hideIcon={true}
        containerClassName="rounded-3xl max-w-3xl w-[95vw] md:w-full"
      >
        <div className="space-y-6 py-3">
          
          {/* Step 1: Student Selection */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 bg-slate-900 text-white rounded-lg flex items-center justify-center text-xs font-black">1</div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                  Identification de {getDefiniteArticle(terminology.student)} {terminology.student}
                </h3>
              </div>
              {selectedStudentForAdd && (
                <span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-black tracking-widest border border-emerald-200">
                  APPRENANT IDENTIFIÉ
                </span>
              )}
            </div>

            {!isEditModalOpen && !selectedStudentForAdd && (
              <div className="bg-slate-50/80 p-4 sm:p-5 rounded-2xl border border-slate-200/80 space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1 block">
                      1. Choisir la {terminology.class.toLowerCase()} *
                    </label>
                    <select
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10 transition-all cursor-pointer"
                      value={selectedClassForAdd}
                      onChange={(e) => {
                        setSelectedClassForAdd(e.target.value);
                      }}
                    >
                      <option value="ALL">Toutes les classes ({students.length} {terminology.students.toLowerCase()})</option>
                      {classes.map(c => {
                        const count = students.filter(s => s.class_id === c.id).length;
                        return (
                          <option key={c.id} value={c.id}>
                            {c.name} ({count} {terminology.students.toLowerCase()})
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1 block">
                      2. Filtrer par nom ou matricule
                    </label>
                    <div className="relative">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                      <input
                        type="text"
                        placeholder={`Rechercher parmi les apprenants...`}
                        value={studentSearchTerm}
                        onChange={(e) => setStudentSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10 transition-all"
                      />
                      {studentSearchTerm && (
                        <button
                          type="button"
                          onClick={() => setStudentSearchTerm('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Instant Student Grid List */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 px-0.5">
                    <span>
                      {selectedClassForAdd === 'ALL' 
                        ? `Sélectionnez un ${terminology.student.toLowerCase()} (${studentsForModal.length} disponibles) :` 
                        : `Apprenants de la classe (${studentsForModal.length} trouvés) :`}
                    </span>
                    {selectedClassForAdd !== 'ALL' && (
                      <span className="text-rose-600 font-extrabold">
                        {classes.find(c => c.id === selectedClassForAdd)?.name}
                      </span>
                    )}
                  </div>

                  {studentsForModal.length === 0 ? (
                    <div className="p-6 bg-white rounded-xl border border-dashed border-slate-200 text-center space-y-1">
                      <User className="mx-auto text-slate-300" size={24} />
                      <p className="text-xs font-black text-slate-700">Aucun {terminology.student.toLowerCase()} trouvé</p>
                      <p className="text-[11px] text-slate-400">
                        {selectedClassForAdd !== 'ALL' 
                          ? "Cette classe ne contient aucun apprenant inscrit dans cette session." 
                          : "Essayez de modifier vos critères de recherche."}
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                      {studentsForModal.slice(0, 40).map(s => {
                        const isSelected = formData.student_id === s.id;
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              setSelectedStudentForAdd(s);
                              setFormData(prev => ({ ...prev, student_id: s.id }));
                              setStudentSearchTerm('');
                            }}
                            className={`p-3 bg-white hover:bg-rose-50/70 border rounded-xl text-left flex items-center justify-between gap-2.5 transition-all group active:scale-[0.99] ${
                              isSelected ? 'border-rose-500 bg-rose-50/40 ring-2 ring-rose-500/20' : 'border-slate-200/80 hover:border-rose-200 shadow-2xs'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-black text-xs shrink-0 group-hover:bg-rose-600 group-hover:text-white transition-colors overflow-hidden">
                                {s.photo_url ? (
                                  <img src={s.photo_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <span>{s.lastName.substring(0, 1)}{s.firstName.substring(0, 1)}</span>
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-black text-slate-900 group-hover:text-rose-700 truncate leading-tight">
                                  {s.name}
                                </p>
                                <p className="text-[10px] text-slate-400 font-bold truncate">
                                  {s.class_name} {s.code ? `• Mat: ${s.code}` : ''}
                                </p>
                              </div>
                            </div>
                            
                            <div className="shrink-0">
                              {s.priorIncidentsCount && s.priorIncidentsCount > 0 ? (
                                <span className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded text-[9px] font-black">
                                  {s.priorIncidentsCount} inc.
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[9px] font-bold">
                                  Vierge
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
            )}

            {/* Selected Student Banner */}
            {selectedStudentForAdd && (
              <div className="p-4 sm:p-5 bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl flex items-center justify-between gap-4 shadow-lg shadow-slate-200">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-white font-black text-lg border border-white/20">
                    {selectedStudentForAdd.lastName.substring(0, 1)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-rose-300 uppercase tracking-widest">
                        {terminology.student}
                      </span>
                      {selectedStudentForAdd.priorIncidentsCount && selectedStudentForAdd.priorIncidentsCount > 0 ? (
                        <span className="px-2 py-0.2 bg-rose-500/30 text-rose-200 border border-rose-400/30 rounded text-[9px] font-bold">
                          Récidive : {selectedStudentForAdd.priorIncidentsCount} antécédent(s)
                        </span>
                      ) : null}
                    </div>
                    <h4 className="text-base sm:text-lg font-black tracking-tight">{selectedStudentForAdd.name}</h4>
                    <p className="text-xs text-slate-300 font-medium">{selectedStudentForAdd.class_name} {selectedStudentForAdd.campus_name ? `• ${selectedStudentForAdd.campus_name}` : ''}</p>
                  </div>
                </div>

                {!isEditModalOpen && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedStudentForAdd(null);
                      setFormData(prev => ({ ...prev, student_id: '' }));
                      setStudentSearchTerm('');
                    }}
                    className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                  >
                    <X size={16} />
                    <span className="hidden sm:inline">Changer</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Step 2: Facts and Incident Details */}
          <div className="space-y-4 pt-3 border-t border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-slate-900 text-white rounded-lg flex items-center justify-center text-xs font-black">2</div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Circonstances & Faits</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1 block">
                  Date des faits *
                </label>
                <input
                  type="date"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:bg-white focus:border-rose-500"
                  value={formData.incident_date}
                  max={new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0]}
                  onChange={(e) => setFormData({ ...formData, incident_date: e.target.value })}
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1 block">
                  Qualification de l'incident *
                </label>
                <select
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:bg-white focus:border-rose-500"
                  value={formData.incident_type}
                  onChange={(e) => setFormData({ ...formData, incident_type: e.target.value as any })}
                >
                  <option value="CONDUITE">Comportement / Déontologie</option>
                  <option value="RETARD">Retard systématique</option>
                  <option value="ABSENCE_NON_JUSTIFIEE">Absence non justifiée</option>
                  <option value="TRAVAIL_NON_FAIT">Travail non rendu</option>
                  <option value="FRAUDE">Fraude académique / Plagiat</option>
                  <option value="VIOLENCE">Violence / Incident grave</option>
                  <option value="AUTRE">Autre manquement</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1 block">
                Description détaillée des faits *
              </label>
              <textarea
                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-800 outline-none focus:bg-white focus:border-rose-500 min-h-[100px] resize-none"
                placeholder="Rapportez les faits avec précision (heure, lieu, témoins, propos ou attitude observée)..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />

              {/* Quick Template Chips */}
              {!isEditModalOpen && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  <span className="text-[10px] font-bold text-slate-400 mr-1 self-center">Modèles :</span>
                  {incidentTemplates.map((tpl, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setFormData({
                        ...formData,
                        incident_type: tpl.type as any,
                        description: tpl.description
                      })}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 rounded-lg text-[10px] font-bold transition-all border border-slate-200/60"
                    >
                      {tpl.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Step 3: Decision and Sanction */}
          <div className="space-y-4 pt-3 border-t border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-slate-900 text-white rounded-lg flex items-center justify-center text-xs font-black">3</div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Sanction & Statut du dossier</h3>
            </div>

            <div className="bg-rose-50/40 p-4 sm:p-5 rounded-2xl border border-rose-100 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-rose-600 uppercase tracking-wider mb-1 block">
                    Type de Sanction
                  </label>
                  <select
                    className="w-full px-4 py-3 bg-white border border-rose-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-rose-500"
                    value={formData.sanction_type}
                    onChange={(e) => setFormData({ ...formData, sanction_type: e.target.value })}
                  >
                    <option value="AUCUNE">Aucune sanction (Rappel à l'ordre)</option>
                    <option value="AVERTISSEMENT">Avertissement écrit</option>
                    <option value="BLAME">Blâme officiel</option>
                    <option value="RETENUE">Heures de retenue</option>
                    <option value="EXCLUSION_TEMPORAIRE">Exclusion temporaire</option>
                    <option value="EXCLUSION_DEFINITIVE">Exclusion définitive</option>
                    {sanctionTypes
                      .filter(t => !['AUCUNE', 'AVERTISSEMENT', 'BLAME', 'RETENUE', 'EXCLUSION_TEMPORAIRE', 'EXCLUSION_DEFINITIVE'].includes(t.name))
                      .map(t => (
                        <option key={t.id} value={t.name}>{t.name}</option>
                      ))
                    }
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black text-rose-600 uppercase tracking-wider mb-1 block">
                    Durée / Volume (Jours ou Heures)
                  </label>
                  <input
                    type="number"
                    min="0"
                    className="w-full px-4 py-3 bg-white border border-rose-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-rose-500"
                    value={formData.sanction_duration}
                    onChange={(e) => setFormData({ ...formData, sanction_duration: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider mb-2 block">
                  État d'instruction du dossier
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'SIGNALÉ', label: 'Signalé', icon: Clock, color: 'bg-amber-500 text-white' },
                    { id: 'EN_COURS', label: 'En cours', icon: Info, color: 'bg-blue-500 text-white' },
                    { id: 'CLOS', label: 'Clos & Résolu', icon: CheckCircle2, color: 'bg-emerald-500 text-white' },
                    { id: 'ANNULÉ', label: 'Annulé', icon: XCircle, color: 'bg-slate-500 text-white' }
                  ].map((st) => {
                    const Icon = st.icon;
                    const isSelected = formData.status === st.id;
                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => setFormData({ ...formData, status: st.id as any })}
                        className={`p-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                          isSelected ? `${st.color} shadow-md` : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <Icon size={14} />
                        <span>{st.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

        </div>
      </Modal>

      {/* 6. Modal: Official Sanction Notice / PV Document Preview */}
      <Modal
        isOpen={isDocModalOpen}
        onClose={() => {
          setIsDocModalOpen(false);
          setSelectedRecord(null);
        }}
        title={
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-900 text-white rounded-2xl flex items-center justify-center">
              <Printer size={20} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900">Avis Officiel & Procès-Verbal</h2>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Document administratif imprimable</p>
            </div>
          </div>
        }
        hideIcon
        hideDefaultActions
        containerClassName="max-w-3xl rounded-3xl"
      >
        {selectedRecord && (
          <div className="space-y-6 py-4">
            {/* Printable Paper Surface */}
            <div id="printable-sanction-doc" className="bg-white p-8 border border-slate-200 rounded-2xl shadow-inner space-y-6 text-slate-900 font-sans">
              
              {/* Official Header */}
              <div className="border-b-2 border-slate-900 pb-4 flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-black uppercase tracking-tight text-slate-900">{school?.name || 'ÉTABLISSEMENT ACADÉMIQUE'}</h2>
                  <p className="text-xs text-slate-500 font-bold">{school?.address || 'Direction des Études et de la Discipline'}</p>
                  <p className="text-[11px] text-slate-400">Tél: {school?.phone || 'N/A'} • Email: {school?.email || 'N/A'}</p>
                </div>
                <div className="text-right">
                  <span className="px-3 py-1 bg-slate-900 text-white rounded text-[10px] font-black uppercase tracking-widest">
                    SESSION {activeSessionLabel}
                  </span>
                  <p className="text-xs text-slate-400 mt-2">Réf: DSP-{selectedRecord.id.substring(0, 8).toUpperCase()}</p>
                </div>
              </div>

              {/* Document Main Heading */}
              <div className="text-center py-2">
                <h3 className="text-lg font-black uppercase tracking-wider text-rose-700 underline underline-offset-4">
                  {selectedRecord.sanction_type !== 'AUCUNE' ? 'AVIS OFFICIEL DE SANCTION DISCIPLINAIRE' : 'NOTIFICATION DE RAPPEL À L\'ORDRE'}
                </h3>
                <p className="text-xs font-semibold text-slate-500 mt-1">Conformément aux statuts et au règlement intérieur de l'établissement</p>
              </div>

              {/* Student Metadata Box */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 font-bold block uppercase text-[10px]">{terminology.student} concerné(e) :</span>
                  <strong className="text-sm font-black text-slate-900">
                    {formatStudentName(selectedRecord.student?.last_name || '', selectedRecord.student?.first_name || '').fullName}
                  </strong>
                  {selectedRecord.student?.code && (
                    <p className="text-slate-500 font-bold mt-0.5">Matricule : {selectedRecord.student.code}</p>
                  )}
                </div>
                <div>
                  <span className="text-slate-400 font-bold block uppercase text-[10px]">Affectation & Date :</span>
                  <p className="font-black text-slate-900">
                    {terminology.class} : {classes.find(c => c.id === selectedRecord.student?.class_id)?.name || 'N/A'}
                  </p>
                  <p className="text-slate-500 font-semibold mt-0.5">
                    Date des faits : {format(new Date(selectedRecord.incident_date), 'dd MMMM yyyy', { locale: fr })}
                  </p>
                </div>
              </div>

              {/* Facts Report */}
              <div className="space-y-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">1. Exposé des Faits & Qualification :</h4>
                <div className="p-4 bg-slate-50/60 border border-slate-200 rounded-xl text-xs leading-relaxed text-slate-700 italic">
                  "{selectedRecord.description}"
                </div>
                <p className="text-[11px] font-bold text-slate-500">
                  Catégorie d'infraction : <span className="text-slate-900 font-black">{selectedRecord.incident_type}</span>
                </p>
              </div>

              {/* Decision / Sanction */}
              <div className="space-y-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">2. Décision & Sanction Applicable :</h4>
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-black uppercase text-rose-500">Mesure prononcée :</span>
                    <p className="text-sm font-black text-rose-800">{selectedRecord.sanction_type}</p>
                  </div>
                  {selectedRecord.sanction_duration > 0 && (
                    <span className="px-3 py-1 bg-white border border-rose-300 rounded-lg text-xs font-black text-rose-700">
                      Durée : {selectedRecord.sanction_duration} jour(s)
                    </span>
                  )}
                </div>
              </div>

              {/* Signature Blocks */}
              <div className="pt-6 grid grid-cols-2 gap-8 text-center text-xs font-bold border-t border-slate-200">
                <div className="space-y-12">
                  <p className="text-slate-500 uppercase tracking-wider text-[10px]">Pour l'Administration / Discipline</p>
                  <p className="text-slate-400 italic font-normal">[Signature & Cachet]</p>
                </div>
                <div className="space-y-12">
                  <p className="text-slate-500 uppercase tracking-wider text-[10px]">L'{terminology.student} / Parents ou Tuteur</p>
                  <p className="text-slate-400 italic font-normal">[Émargement pour notification]</p>
                </div>
              </div>

            </div>

            {/* Document Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                onClick={() => setIsDocModalOpen(false)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
              >
                Fermer
              </button>
              <button
                onClick={() => {
                  window.print();
                }}
                className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl flex items-center gap-2 shadow-lg shadow-rose-200"
              >
                <Printer size={16} />
                Imprimer l'Avis
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* 7. Modal: Sanction Types Catalog Management */}
      <Modal
        isOpen={isConfigModalOpen}
        onClose={() => {
          setIsConfigModalOpen(false);
          setEditingSanctionType(null);
          setSanctionTypeFormData({ name: '', description: '' });
        }}
        title={
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center shadow-inner">
              <ShieldCheck size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Catalogue des Sanctions</h2>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Configuration des sanctions applicables</p>
            </div>
          </div>
        }
        hideIcon
        hideDefaultActions
        containerClassName="max-w-2xl rounded-3xl"
      >
        <div className="space-y-6 py-4">
          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider">
              {editingSanctionType ? 'Modifier la sanction' : 'Ajouter un nouveau type de sanction'}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input 
                type="text"
                placeholder="Nom (ex: Travail d'intérêt général)"
                className="px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:border-rose-500 outline-none shadow-sm"
                value={sanctionTypeFormData.name}
                onChange={(e) => setSanctionTypeFormData({ ...sanctionTypeFormData, name: e.target.value })}
              />
              <input 
                type="text"
                placeholder="Description / Conditions"
                className="px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:border-rose-500 outline-none shadow-sm"
                value={sanctionTypeFormData.description}
                onChange={(e) => setSanctionTypeFormData({ ...sanctionTypeFormData, description: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              {editingSanctionType && (
                <button 
                  onClick={() => {
                    setEditingSanctionType(null);
                    setSanctionTypeFormData({ name: '', description: '' });
                  }}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700"
                >
                  Annuler
                </button>
              )}
              <button 
                onClick={handleSaveSanctionType}
                disabled={saving || !sanctionTypeFormData.name.trim()}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black uppercase tracking-wider disabled:opacity-50 flex items-center gap-2 shadow-md shadow-rose-200"
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                {editingSanctionType ? 'Mettre à jour' : 'Enregistrer'}
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider">Sanctions existantes</h3>
            <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
              {sanctionTypes.map(type => (
                <div key={type.id} className="flex items-center justify-between p-3.5 bg-white border border-slate-200 rounded-2xl hover:border-rose-200 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-slate-100 text-slate-700 rounded-xl flex items-center justify-center font-black text-[11px]">
                      {type.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-900">{type.name}</h4>
                      <p className="text-[11px] text-slate-500 font-medium">{type.description || 'Sans description'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => {
                        setEditingSanctionType(type);
                        setSanctionTypeFormData({ name: type.name, description: type.description });
                      }}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button 
                      onClick={() => handleDeleteSanctionType(type.id)}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
              {sanctionTypes.length === 0 && (
                <p className="text-center py-8 text-slate-400 font-bold text-xs">Aucune sanction personnalisée configurée.</p>
              )}
            </div>
          </div>

          <div className="flex justify-end pt-3 border-t border-slate-100">
            <button 
              onClick={() => setIsConfigModalOpen(false)}
              className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-slate-800"
            >
              Fermer
            </button>
          </div>
        </div>
      </Modal>

      {/* 8. Modal: Code of Conduct / Regulations */}
      <Modal
        isOpen={isRulesModalOpen}
        onClose={() => setIsRulesModalOpen(false)}
        title={
          <div className="flex flex-col items-center gap-2">
            <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center">
              <Scale size={28} />
            </div>
            <h3 className="text-xl font-black text-slate-900">
              {isUniversity ? 'Charte de Déontologie & Règlement Universitaire' : 'Règlement Intérieur & Charte de Vie'}
            </h3>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{school?.name || 'Établissement'}</p>
          </div>
        }
        containerClassName="max-w-4xl rounded-3xl"
        hideIcon
        hideDefaultActions
      >
        <div className="space-y-6 py-4 text-slate-700">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center gap-2 text-rose-600 font-black text-sm uppercase">
                <Clock size={16} />
                <span>1. Assiduité & Ponctualité</span>
              </div>
              <p className="text-xs leading-relaxed font-medium text-slate-600">
                La présence à tous les cours, travaux pratiques et évaluations est obligatoire. Tout retard ou absence doit être immédiatement justifié auprès de la direction ou du décanat sous 48 heures.
              </p>
            </div>

            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center gap-2 text-rose-600 font-black text-sm uppercase">
                <UserCheck size={16} />
                <span>2. Déontologie & Respect</span>
              </div>
              <p className="text-xs leading-relaxed font-medium text-slate-600">
                Le respect mutuel entre {terminology.students.toLowerCase()}, personnel enseignant et administratif est absolu. Toute forme de harcèlement, d'incivilité ou d'insolence fait l'objet de sanctions disciplinaires immédiates.
              </p>
            </div>

            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center gap-2 text-rose-600 font-black text-sm uppercase">
                <GraduationCap size={16} />
                <span>3. Intégrité Académique</span>
              </div>
              <p className="text-xs leading-relaxed font-medium text-slate-600">
                La fraude aux examens, le plagiat ou la falsification de résultats entraînent la comparution devant le conseil de discipline avec annulation de l'évaluation et sanction conservatoire.
              </p>
            </div>

            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center gap-2 text-rose-600 font-black text-sm uppercase">
                <Building2 size={16} />
                <span>4. Protection des Locaux</span>
              </div>
              <p className="text-xs leading-relaxed font-medium text-slate-600">
                Le matériel pédagogique, les laboratoires et les infrastructures doivent être préservés. Toute dégradation volontaire engage la responsabilité financière et disciplinaire de son auteur.
              </p>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button
              onClick={() => setIsRulesModalOpen(false)}
              className="px-6 py-2.5 bg-slate-900 text-white font-black text-xs rounded-xl hover:bg-slate-800"
            >
              Compris & Fermer
            </button>
          </div>
        </div>
      </Modal>

      {/* 9. Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setRecordToDelete(null);
        }}
        title="Confirmer la suppression"
        type="danger"
        onConfirm={handleDeleteRecord}
        confirmLabel="Supprimer du registre"
        cancelLabel="Annuler"
        isLoading={saving}
      >
        <p className="text-slate-600 font-medium text-sm">
          Êtes-vous certain de vouloir retirer cet enregistrement du registre disciplinaire ? Cette action est irréversible.
        </p>
      </Modal>

    </div>
  );
};

export default DisciplinaryView;
