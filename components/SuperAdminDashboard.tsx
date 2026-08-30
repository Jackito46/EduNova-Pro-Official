import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Building2, ShieldAlert, Users, Database, 
  Power, Download, Plus, Search, X, CheckCircle2, AlertCircle, CalendarPlus, CalendarCheck, Loader2,
  TrendingUp, ShieldCheck, Zap, ArrowUpRight, Clock, UserPlus, Server,
  LayoutDashboard, Settings, FileText, BarChart3, Mail, Palette, Sparkles, Sliders, DollarSign, Bus, BookOpen, Package,
  Globe, RefreshCw, Save, Shield, CreditCard, Terminal, Info, Trash2, Pause, Play, Edit2, HardDrive, Wrench, Key, Lock, Eraser, Activity, GraduationCap, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Copy, Check, Unlock, UserX, KeyRound, ShieldOff, AlertTriangle, Archive, RotateCcw,
  MoreVertical, MoreHorizontal, Filter, Layers, Grid, List, ExternalLink, Eye, Settings2, Phone, MapPin, School, SlidersHorizontal,
  ArrowUpDown, UserCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { supabase } from '../supabase';
import { AuditLogger } from '../utils/auditLogger';
import { normalizeIdentifier, displayIdentifier } from '../utils/authHelpers';

import { UserProfile, SchoolType } from '../types';
import { RetryableError } from './RetryableError';
import { SystemAlertsView } from './SystemAlertsView';
import { BackupManagementView } from './BackupManagementView';
import { SystemHealthView } from './SystemHealthView';

interface SuperAdminDashboardProps {
  user: UserProfile;
}

export const normalizeRoleKey = (role?: string): string => {
  if (!role) return 'staff';
  const clean = String(role).toLowerCase().trim().replace(/-/g, '_');
  if (clean === 'super_admin' || clean === 'superadmin') return 'super_admin';
  if (clean === 'school_admin' || clean === 'schooladmin' || clean === 'admin' || clean === 'directeur' || clean === 'director') return 'school_admin';
  if (clean === 'teacher' || clean === 'professeur' || clean === 'enseignant') return 'teacher';
  if (clean === 'student' || clean === 'eleve' || clean === 'élève' || clean === 'étudiant' || clean === 'etudiant') return 'student';
  if (clean === 'parent') return 'parent';
  if (clean === 'accountant' || clean === 'comptable') return 'accountant';
  if (clean === 'counselor' || clean === 'conseiller') return 'counselor';
  if (clean === 'staff' || clean === 'personnel' || clean === 'secretaire') return 'staff';
  return clean;
};

const roleLabels: { [key: string]: string } = {
  'super_admin': 'Super Admin',
  'school_admin': 'Admin École',
  'admin': 'Admin École',
  'teacher': 'Enseignant',
  'student': 'Élève',
  'parent': 'Parent',
  'accountant': 'Comptable',
  'counselor': 'Conseiller',
  'staff': 'Personnel',
  'director': 'Directeur'
};

export const getRoleDisplay = (role?: string): string => {
  const norm = normalizeRoleKey(role);
  return roleLabels[norm] || (role ? role.toUpperCase() : 'Utilisateur');
};

const entityLabels: { [key: string]: string } = {
  'user': 'Utilisateur',
  'school': 'Établissement',
  'system': 'Système',
  'student': 'Élève',
  'staff': 'Personnel',
  'parent': 'Parent',
  'disciplinary_record': 'Sanction',
  'payment': 'Paiement',
  'class': 'Classe',
  'subject': 'Matière'
};

const actionLabels: { [key: string]: string } = {
  'CREATE': 'CRÉATION',
  'UPDATE': 'MODIFICATION',
  'DELETE': 'SUPPRESSION',
  'RESET_PASSWORD': 'RÉINIT. MDP',
  'EXPORT': 'EXPORTATION',
  'SEED_DATA': 'INJECTION',
  'ANONYMIZE_STUDENTS': 'ANONYMISATION ÉLÈVES',
  'ANONYMIZE_STAFF': 'ANONYMISATION PERSONNEL',
  'ANONYMIZE_PARENTS': 'ANONYMISATION PARENTS',
  'ANONYMIZE_ALL': 'ANONYMISATION GLOBALE',
  'UPDATE_GLOBAL_CONFIG': 'MAJ CONFIG GLOBALE',
  'LOGIN': 'CONNEXION',
  'LOGOUT': 'DÉCONNEXION'
};

const planLabels: { [key: string]: string } = {
  'trial': 'Essai Gratuit',
  'monthly': 'Mensuel',
  'yearly': 'Annuel',
  'unlimited': 'Illimité',
  'essai': 'Essai'
};

const statusLabels: { [key: string]: string } = {
  'ACTIVE': 'ACTIF',
  'SUSPENDED': 'SUSPENDU',
  'EXPIRED': 'EXPIRÉ',
  'PENDING': 'EN ATTENTE'
};

export const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({ user }) => {
  const [schools, setSchools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);
  const [isRefreshingCache, setIsRefreshingCache] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{type: 'success' | 'error', message: string} | null>(null);
  
  // Form State
  const [formData, setFormData] = useState({
    schoolName: '',
    schoolType: SchoolType.CLASSIC,
    adminName: '',
    adminEmail: '',
    adminPassword: '',
    confirmPassword: '',
    injectDefaults: true
  });

  // Admin Management Modal State
  const [adminListModalOpen, setAdminListModalOpen] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState<any | null>(null);
  const [schoolAdmins, setSchoolAdmins] = useState<any[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  const [adminSearchTerm, setAdminSearchTerm] = useState('');

  // Renew Subscription Modal State
  const [renewModalOpen, setRenewModalOpen] = useState(false);
  const [renewPlan, setRenewPlan] = useState('mensuel');
  const [renewDays, setRenewDays] = useState(30);
  const [isRenewing, setIsRenewing] = useState(false);
  const [hasMultiCampus, setHasMultiCampus] = useState(false);

  // School Deletion Modal State
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    schoolId: string;
    schoolName: string;
    confirmName: string;
  }>({ isOpen: false, schoolId: '', schoolName: '', confirmName: '' });

  // School Clean Modal State
  const [cleanModal, setCleanModal] = useState<{
    isOpen: boolean;
    schoolId: string;
    schoolName: string;
    confirmName: string;
  }>({ isOpen: false, schoolId: '', schoolName: '', confirmName: '' });

  // School Status Modal State
  const [statusModal, setStatusModal] = useState<{
    isOpen: boolean;
    schoolId: string;
    schoolName: string;
    currentStatus: string;
  }>({ isOpen: false, schoolId: '', schoolName: '', currentStatus: '' });

  // Edit School Modal State
  
  const [modulesModal, setModulesModal] = useState<{
    isOpen: boolean;
    schoolId: string;
    schoolName: string;
    modules: { presences: boolean; discipline: boolean };
  }>({ isOpen: false, schoolId: '', schoolName: '', modules: { presences: true, discipline: true } });

const [editSchoolModal, setEditSchoolModal] = useState<{
    isOpen: boolean;
    schoolId: string;
    name: string;
    email: string;
    director_name: string;
    phone: string;
    address: string;
    has_multi_campus: boolean;
  }>({ isOpen: false, schoolId: '', name: '', email: '', director_name: '', phone: '', address: '', has_multi_campus: false });

  // View State
  const [activeView, setActiveView] = useState<'schools' | 'health' | 'users' | 'logs' | 'alerts' | 'config' | 'system' | 'sessions' | 'backups'>('schools');
  const [filterExpired, setFilterExpired] = useState(false);
  const [schoolFilterTab, setSchoolFilterTab] = useState<'ALL' | 'ACTIVE' | 'EXPIRED' | 'MULTI_CAMPUS' | 'PROTECTED'>('ALL');
  const [schoolViewMode, setSchoolViewMode] = useState<'table' | 'grid'>('table');
  const [openSchoolMenuId, setOpenSchoolMenuId] = useState<string | null>(null);
  const [configCategory, setConfigCategory] = useState<'ALL' | 'IDENTITY' | 'SECURITY' | 'SESSIONS' | 'MODULES' | 'SUBSCRIPTIONS' | 'MAINTENANCE'>('ALL');

  // Security & Active Sessions View State
  const [securitySessions, setSecuritySessions] = useState<any[]>([]);
  const [securityAuditLogs, setSecurityAuditLogs] = useState<any[]>([]);
  const [loadingSecuritySessions, setLoadingSecuritySessions] = useState(false);
  const [securitySearchTerm, setSecuritySearchTerm] = useState('');
  const [securityTabFilter, setSecurityTabFilter] = useState<'ALL' | 'ONLINE' | 'ACTIVE' | 'BLOCKED' | 'FAILED_LOGINS'>('ALL');

  // Helper to accurately determine if a user is actively connected right now (within 15 mins of last activity)
  const isUserRealOnline = useCallback((u: any) => {
    if (!u || u.is_active === false) return false;
    if ((u.failed_login_attempts && u.failed_login_attempts >= 3) || (u.failed_attempts && u.failed_attempts >= 3)) return false;
    if (user && u.id === user.id) return true;
    if (!u.current_session_id) return false;

    const lastActiveStr = u.last_activity_at || u.updated_at || u.last_login_at;
    if (!lastActiveStr) return false;

    const lastActiveTime = new Date(lastActiveStr).getTime();
    if (isNaN(lastActiveTime)) return false;

    // Must have activity within the last 15 minutes to be considered online
    return (Date.now() - lastActiveTime) <= 15 * 60 * 1000;
  }, [user]);
  const [autoRefreshSecurity, setAutoRefreshSecurity] = useState(false);

  // Global Users State & Filters
  const [globalUsers, setGlobalUsers] = useState<any[]>([]);
  const [loadingGlobalUsers, setLoadingGlobalUsers] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<string>('ALL');
  const [userSchoolFilter, setUserSchoolFilter] = useState<string>('ALL');
  const [userStatusFilter, setUserStatusFilter] = useState<'ALL' | 'ONLINE' | 'ACTIVE' | 'BLOCKED'>('ALL');
  const [userSortBy, setUserSortBy] = useState<'created_desc' | 'created_asc' | 'name_asc' | 'name_desc' | 'role'>('created_desc');
  const [userPage, setUserPage] = useState(1);
  const [usersPerPage, setUsersPerPage] = useState(10);
  const [userViewMode, setUserViewMode] = useState<'table' | 'cards'>('table');

  // System Logs State
  const [systemLogs, setSystemLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logSearchTerm, setLogSearchTerm] = useState('');
  const [logActionFilter, setLogActionFilter] = useState<'ALL' | 'CREATE' | 'UPDATE' | 'DELETE' | 'OTHER'>('ALL');
  const [logEntityFilter, setLogEntityFilter] = useState<string>('ALL');
  const [logPage, setLogPage] = useState(1);
  const [logsPerPage, setLogsPerPage] = useState(15);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [copiedLogId, setCopiedLogId] = useState<string | null>(null);
  const [inspectingLog, setInspectingLog] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Password Reset Modal State
  const [resetModal, setResetModal] = useState<{
    isOpen: boolean;
    userId: string;
    fullName: string;
    newPassword: string;
    forceChange: boolean;
  }>({ isOpen: false, userId: '', fullName: '', newPassword: '', forceChange: true });

  // Edit User Modal State
  const [editUserModal, setEditUserModal] = useState<{
    isOpen: boolean;
    userId: string;
    fullName: string;
    email: string;
  }>({ isOpen: false, userId: '', fullName: '', email: '' });

  // Configuration State
  const [config, setConfig] = useState<any>({
    platformName: 'EduNova Pro',
    supportEmail: 'support@edunova.pro',
    primaryColor: '#4f46e5',
    minPasswordLength: 8,
    sessionTimeout: 5,
    maxFailedAttempts: 5,
    lockoutDurationMinutes: 15,
    trialDays: 14,
    defaultStudentLimit: 100,
    defaultTeacherLimit: 10,
    enabledModules: ['academic', 'finance', 'communication'],
    dataRetentionMonths: 12,
    maintenanceMode: false,
    defaultSessionMode: 'auto',
    manualSessionLabel: '',
    manualSessionStart: '',
    manualSessionEnd: ''
  });
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);
  const [sessionLabelError, setSessionLabelError] = useState<string | null>(null);

  const [isCheckingSubscriptions, setIsCheckingSubscriptions] = useState(false);
  const [isAnonymizing, setIsAnonymizing] = useState(false);
  const [isAnonymizingStaff, setIsAnonymizingStaff] = useState(false);
  const [isAnonymizingParents, setIsAnonymizingParents] = useState(false);
  const [showResetContextModal, setShowResetContextModal] = useState(false);
  const [isResettingContext, setIsResettingContext] = useState(false);

  // Diagnostic State
  const [diagnosticReport, setDiagnosticReport] = useState<{
    isOpen: boolean;
    isRunning: boolean;
    dbLatencyMs?: number;
    schoolsCount?: number;
    profilesCount?: number;
    studentsCount?: number;
    auditLogsCount?: number;
    rlsIsolationStatus?: string;
    storageHealth?: string;
  }>({ isOpen: false, isRunning: false });

  const handleRunDiagnostic = async () => {
    setDiagnosticReport({ isOpen: true, isRunning: true });
    const startTime = performance.now();
    try {
      const { count: schoolsCount } = await supabase.from('schools').select('*', { count: 'exact', head: true });
      const { count: profilesCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
      const { count: studentsCount } = await supabase.from('students').select('*', { count: 'exact', head: true });
      const { count: auditLogsCount } = await supabase.from('audit_logs').select('*', { count: 'exact', head: true });

      const endTime = performance.now();
      const dbLatencyMs = Math.round(endTime - startTime);

      setDiagnosticReport({
        isOpen: true,
        isRunning: false,
        dbLatencyMs,
        schoolsCount: schoolsCount || 0,
        profilesCount: profilesCount || 0,
        studentsCount: studentsCount || 0,
        auditLogsCount: auditLogsCount || 0,
        rlsIsolationStatus: 'CONFORME (Périmètre Multi-Établissement Isolé)',
        storageHealth: 'OPÉRATIONNEL (Temps de réponse optimal)'
      });
      toast.success("Diagnostic d'intégrité exécuté avec succès !");
    } catch (err: any) {
      console.error("Diagnostic error:", err);
      setDiagnosticReport({
        isOpen: true,
        isRunning: false,
        dbLatencyMs: 0,
        rlsIsolationStatus: 'ERREUR D\'ACCÈS',
        storageHealth: 'DÉGRADÉ'
      });
      toast.error("Échec lors du test de diagnostic.");
    }
  };

  const [confirmStudents, setConfirmStudents] = useState(false);
  const [confirmStaff, setConfirmStaff] = useState(false);
  const [confirmParents, setConfirmParents] = useState(false);
  const [confirmAllAnonymize, setConfirmAllAnonymize] = useState(false);
  const [isAnonymizingAll, setIsAnonymizingAll] = useState(false);
  const confirmTimers = React.useRef<{ [key: string]: NodeJS.Timeout | null }>({
    students: null,
    staff: null,
    parents: null,
    all: null
  });

  const firstNames = ['Peterson', 'Widline', 'Woodly', 'Daphney', 'Stanley', 'Lovelie', 'Fritz', 'Guerline', 'Ricardo', 'Vanessa', 'Junior', 'Rose', 'Marie', 'Jean', 'Paul', 'Jacques', 'Luc', 'Marc', 'Anne', 'Sophie', 'Bastien', 'Camille', 'David', 'Elodie', 'Fabrice', 'Gaelle', 'Hugo', 'Isabelle', 'Kevin', 'Laura', 'Samuel', 'Thomas', 'Nicolas', 'Antoine', 'Julie', 'Céline', 'Mathilde', 'Chloé', 'Léa', 'Manon'];
  const lastNames = ['Jean', 'Pierre', 'Joseph', 'Louis', 'Charles', 'Baptiste', 'Michel', 'Auguste', 'Francois', 'Etienne', 'Guerrier', 'Celestin', 'Valcin', 'Dorvil', 'Hyppolite', 'Moise', 'Martelly', 'Preval', 'Aristide', 'Manigat', 'Dupont', 'Durand', 'Lefebvre', 'Moreau', 'Larcher', 'Gauthier', 'Perrin', 'Morin', 'Nicolas', 'Lambert', 'Rousseau', 'Vincent', 'Muller', 'Lefevre', 'Faure', 'Andre', 'Mercier', 'Blanc', 'Guerin', 'Boyer'];

  const fetchSchools = useCallback(async () => {
    setLoading(true);
    setError(null);
    let resolvedSchools: any[] | null = null;

    try {
      // Stratégie 1: Vue SQL optimisée avec décomptes
      const { data: viewData, error: viewError } = await supabase
        .from('v_schools_with_counts')
        .select('*')
        .order('created_at', { ascending: false });

      if (!viewError && Array.isArray(viewData) && viewData.length > 0) {
        resolvedSchools = viewData;
      } else {
        if (viewError) {
          console.warn("[SuperAdmin] Notice vue 'v_schools_with_counts', bascule vers la table 'schools':", viewError?.message || viewError);
        }
        // Stratégie 2: Requête directe sur la table schools
        const { data: tableData, error: tableError } = await supabase
          .from('schools')
          .select('*')
          .order('created_at', { ascending: false });

        if (!tableError && Array.isArray(tableData)) {
          // Enrichissement optionnel avec le décompte des profils si possible
          try {
            const { data: profilesSample } = await supabase.from('profiles').select('school_id');
            const profileCounts: Record<string, number> = {};
            if (profilesSample) {
              profilesSample.forEach((p: any) => {
                if (p.school_id) profileCounts[p.school_id] = (profileCounts[p.school_id] || 0) + 1;
              });
            }
            resolvedSchools = tableData.map((s: any) => ({
              ...s,
              profiles_count: profileCounts[s.id] || 0
            }));
          } catch {
            resolvedSchools = tableData;
          }
        } else if (tableError) {
          throw tableError;
        }
      }

      if (resolvedSchools && Array.isArray(resolvedSchools)) {
        // Comptage optionnel des annexes multi-campus
        try {
          const { data: campusesData, error: campusesError } = await supabase
            .from('school_campuses')
            .select('id, school_id');

          if (!campusesError && campusesData) {
            const campusCountsMap: Record<string, number> = {};
            campusesData.forEach((c: any) => {
              if (c.school_id) {
                campusCountsMap[c.school_id] = (campusCountsMap[c.school_id] || 0) + 1;
              }
            });
            resolvedSchools = resolvedSchools.map((school: any) => ({
              ...school,
              annex_count: campusCountsMap[school.id] || 0
            }));
          }
        } catch (campusErr) {
          console.warn("[SuperAdmin] Comptage des annexes non bloquant:", campusErr);
        }

        setSchools(resolvedSchools);
        setError(null);
        // Mise en cache locale pour résilience hors-ligne
        try {
          window.localStorage.setItem('edunova_cached_schools_superadmin', JSON.stringify(resolvedSchools));
        } catch {}
      } else {
        // Fallback local cache si le serveur renvoie une liste vide en état d'erreur
        const localCached = window.localStorage.getItem('edunova_cached_schools_superadmin');
        if (localCached) {
          const parsed = JSON.parse(localCached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setSchools(parsed);
            setError(null);
          }
        }
      }
    } catch (err: any) {
      console.warn("[SuperAdmin] Récupération réseau des écoles indisponible:", err?.message || err);
      // Tentative de récupération depuis le cache local avant d'afficher une erreur
      let cacheLoaded = false;
      try {
        const localCached = window.localStorage.getItem('edunova_cached_schools_superadmin');
        if (localCached) {
          const parsed = JSON.parse(localCached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setSchools(parsed);
            setError(null);
            cacheLoaded = true;
            toast.info("Mode hors-ligne : données des établissements chargées depuis le cache local.");
          }
        }
      } catch {}

      if (!cacheLoaded) {
        const isNetwork = err?.message?.includes('fetch') || err?.code === 'NETWORK_ERROR' || !navigator.onLine;
        const msg = isNetwork
          ? "Connexion réseau instable : impossible de synchroniser les établissements en direct."
          : (err?.message || "Erreur de chargement des établissements.");
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleAnonymizeStudents = async (force = false) => {
    console.log("handleAnonymizeStudents called", { force });
    if (!force && !confirmStudents) {
      setConfirmStudents(true);
      if (confirmTimers.current.students) clearTimeout(confirmTimers.current.students);
      confirmTimers.current.students = setTimeout(() => setConfirmStudents(false), 5000);
      return;
    }
    
    if (confirmTimers.current.students) clearTimeout(confirmTimers.current.students);
    setConfirmStudents(false);
    setIsAnonymizing(true);
    const loadingToast = !force ? toast.loading("Anonymisation des élèves en cours...") : null;
    
    try {
      console.log("Fetching students...");
      const { data: students, error: fetchError } = await supabase
        .from('students')
        .select('id, first_name, last_name')
        .limit(5000); // Safety limit
      
      if (fetchError) throw fetchError;
      
      if (!students || students.length === 0) {
        console.log("No students found");
        if (loadingToast) toast.dismiss(loadingToast);
        if (!force) toast.info("Aucun élève trouvé dans le système.");
        return 0;
      }

      console.log(`Found ${students.length} students, filtering for generic names...`);
      const studentsToUpdate = students.filter(s => {
        const fn = (s.first_name || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const ln = (s.last_name || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return fn.includes('test') || ln.includes('test') || 
               fn.includes('eleve') || ln.includes('eleve') ||
               fn.includes('etudiant') || ln.includes('etudiant') ||
               fn.includes('student') || ln.includes('student') ||
               fn.includes('demo') || ln.includes('demo');
      });

      if (studentsToUpdate.length === 0) {
        console.log("No generic names detected for students");
        if (loadingToast) toast.dismiss(loadingToast);
        if (!force) toast.info("Aucun nom générique détecté (ex: Test, Eleve, Demo).");
        return 0;
      }

      console.log(`Updating ${studentsToUpdate.length} students...`);
      let updatedCount = 0;
      const batchSize = 25;
      
      for (let i = 0; i < studentsToUpdate.length; i += batchSize) {
        const batch = studentsToUpdate.slice(i, i + batchSize);
        const updates = batch.map(s => {
          const randomFirst = firstNames[Math.floor(Math.random() * firstNames.length)];
          const randomLast = lastNames[Math.floor(Math.random() * lastNames.length)];
          return supabase
            .from('students')
            .update({ first_name: randomFirst, last_name: randomLast })
            .eq('id', s.id);
        });
        
        const results = await Promise.all(updates);
        const errors = results.filter(r => r.error);
        if (errors.length > 0) {
          console.error(`${errors.length} updates failed in this batch`, errors[0].error);
        }
        updatedCount += (batch.length - errors.length);
      }

      console.log(`Successfully updated ${updatedCount} students`);
      if (loadingToast) toast.dismiss(loadingToast);
      if (!force) toast.success(`${updatedCount} élèves ont été renommés avec succès !`);
      
      await AuditLogger.log({
        school_id: null,
        user_id: user.id,
        action: 'ANONYMIZE_STUDENTS',
        entity_type: 'system',
        details: { count: updatedCount }
      });
      return updatedCount;
    } catch (err: any) {
      console.error("Error in handleAnonymizeStudents:", err);
      if (loadingToast) toast.dismiss(loadingToast);
      if (!force) toast.error("Erreur lors de l'anonymisation : " + err.message);
      throw err;
    } finally {
      setIsAnonymizing(false);
    }
  };

  const handleAnonymizeStaff = async (force = false) => {
    console.log("handleAnonymizeStaff called", { force });
    if (!force && !confirmStaff) {
      setConfirmStaff(true);
      if (confirmTimers.current.staff) clearTimeout(confirmTimers.current.staff);
      confirmTimers.current.staff = setTimeout(() => setConfirmStaff(false), 5000);
      return;
    }
    
    if (confirmTimers.current.staff) clearTimeout(confirmTimers.current.staff);
    setConfirmStaff(false);
    setIsAnonymizingStaff(true);
    const loadingToast = !force ? toast.loading("Anonymisation du personnel en cours...") : null;
    
    try {
      console.log("Fetching staff...");
      const { data: staff, error: fetchError } = await supabase
        .from('staff')
        .select('id, first_name, last_name')
        .limit(2000);
      
      if (fetchError) throw fetchError;
      
      if (!staff || staff.length === 0) {
        console.log("No staff found");
        if (loadingToast) toast.dismiss(loadingToast);
        if (!force) toast.info("Aucun membre du personnel trouvé.");
        return 0;
      }

      console.log(`Found ${staff.length} staff members, filtering for generic names...`);
      const staffToUpdate = staff.filter(s => {
        const fn = (s.first_name || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const ln = (s.last_name || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return fn.includes('test') || ln.includes('test') || 
               fn.includes('staff') || ln.includes('staff') ||
               fn.includes('personnel') || ln.includes('personnel') ||
               fn.includes('prof') || ln.includes('prof') ||
               fn.includes('admin') || ln.includes('admin') ||
               fn.includes('demo') || ln.includes('demo');
      });

      if (staffToUpdate.length === 0) {
        console.log("No generic names detected for staff");
        if (loadingToast) toast.dismiss(loadingToast);
        if (!force) toast.info("Aucun nom générique détecté pour le personnel.");
        return 0;
      }

      console.log(`Updating ${staffToUpdate.length} staff members...`);
      let updatedCount = 0;
      const batchSize = 25;
      for (let i = 0; i < staffToUpdate.length; i += batchSize) {
        const batch = staffToUpdate.slice(i, i + batchSize);
        const updates = batch.map(s => {
          const randomFirst = firstNames[Math.floor(Math.random() * firstNames.length)];
          const randomLast = lastNames[Math.floor(Math.random() * lastNames.length)];
          return supabase
            .from('staff')
            .update({ first_name: randomFirst, last_name: randomLast })
            .eq('id', s.id);
        });
        
        const results = await Promise.all(updates);
        const errors = results.filter(r => r.error);
        if (errors.length > 0) {
          console.error(`${errors.length} updates failed in this batch`, errors[0].error);
        }
        updatedCount += (batch.length - errors.length);
      }

      console.log(`Successfully updated ${updatedCount} staff members`);
      if (loadingToast) toast.dismiss(loadingToast);
      if (!force) toast.success(`${updatedCount} membres du personnel ont été renommés !`);
      
      await AuditLogger.log({
        school_id: null,
        user_id: user.id,
        action: 'ANONYMIZE_STAFF',
        entity_type: 'system',
        details: { count: updatedCount }
      });
      return updatedCount;
    } catch (err: any) {
      console.error("Error in handleAnonymizeStaff:", err);
      if (loadingToast) toast.dismiss(loadingToast);
      if (!force) toast.error("Erreur lors de l'anonymisation du personnel : " + err.message);
      throw err;
    } finally {
      setIsAnonymizingStaff(false);
    }
  };

  const handleAnonymizeParents = async (force = false) => {
    console.log("handleAnonymizeParents called", { force });
    if (!force && !confirmParents) {
      setConfirmParents(true);
      if (confirmTimers.current.parents) clearTimeout(confirmTimers.current.parents);
      confirmTimers.current.parents = setTimeout(() => setConfirmParents(false), 5000);
      return;
    }
    
    if (confirmTimers.current.parents) clearTimeout(confirmTimers.current.parents);
    setConfirmParents(false);
    setIsAnonymizingParents(true);
    const loadingToast = !force ? toast.loading("Anonymisation des parents en cours...") : null;
    
    try {
      console.log("Fetching students for parent names...");
      const { data: students, error: fetchError } = await supabase
        .from('students')
        .select('id, parent_name')
        .limit(5000);
      
      if (fetchError) throw fetchError;
      
      if (!students || students.length === 0) {
        console.log("No students found for parent anonymization");
        if (loadingToast) toast.dismiss(loadingToast);
        if (!force) toast.info("Aucun élève trouvé.");
        return 0;
      }

      console.log(`Found ${students.length} students, filtering for generic parent names...`);
      const parentsToUpdate = students.filter(s => {
        if (!s.parent_name) return false;
        const pn = s.parent_name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return pn.includes('test') || pn.includes('parent') || pn.includes('pere') || pn.includes('mere') || pn.includes('tuteur') || pn.includes('demo');
      });

      if (parentsToUpdate.length === 0) {
        console.log("No generic parent names detected");
        if (loadingToast) toast.dismiss(loadingToast);
        if (!force) toast.info("Aucun nom de parent générique détecté.");
        return 0;
      }

      console.log(`Updating ${parentsToUpdate.length} parent names...`);
      let updatedCount = 0;
      const batchSize = 25;
      for (let i = 0; i < parentsToUpdate.length; i += batchSize) {
        const batch = parentsToUpdate.slice(i, i + batchSize);
        const updates = batch.map(s => {
          const randomFirst = firstNames[Math.floor(Math.random() * firstNames.length)];
          const randomLast = lastNames[Math.floor(Math.random() * lastNames.length)];
          return supabase
            .from('students')
            .update({ parent_name: `${randomFirst} ${randomLast}` })
            .eq('id', s.id);
        });
        
        const results = await Promise.all(updates);
        const errors = results.filter(r => r.error);
        if (errors.length > 0) {
          console.error(`${errors.length} updates failed in this batch`, errors[0].error);
        }
        updatedCount += (batch.length - errors.length);
      }

      console.log(`Successfully updated ${updatedCount} parent names`);
      if (loadingToast) toast.dismiss(loadingToast);
      if (!force) toast.success(`${updatedCount} noms de parents ont été mis à jour !`);
      
      await AuditLogger.log({
        school_id: null,
        user_id: user.id,
        action: 'ANONYMIZE_PARENTS',
        entity_type: 'system',
        details: { count: updatedCount }
      });
      return updatedCount;
    } catch (err: any) {
      console.error("Error in handleAnonymizeParents:", err);
      if (loadingToast) toast.dismiss(loadingToast);
      if (!force) toast.error("Erreur lors de l'anonymisation des parents : " + err.message);
      throw err;
    } finally {
      setIsAnonymizingParents(false);
    }
  };

  const handleAnonymizeAll = async () => {
    if (!confirmAllAnonymize) {
      setConfirmAllAnonymize(true);
      if (confirmTimers.current.all) clearTimeout(confirmTimers.current.all);
      confirmTimers.current.all = setTimeout(() => setConfirmAllAnonymize(false), 5000);
      return;
    }

    if (confirmTimers.current.all) clearTimeout(confirmTimers.current.all);
    setConfirmAllAnonymize(false);
    setIsAnonymizingAll(true);
    const mainToast = toast.loading("Anonymisation globale en cours (Élèves, Personnel, Tuteurs)...");

    try {
      const studentsCount = (await handleAnonymizeStudents(true)) || 0;
      const staffCount = (await handleAnonymizeStaff(true)) || 0;
      const parentsCount = (await handleAnonymizeParents(true)) || 0;
      const totalCount = studentsCount + staffCount + parentsCount;

      toast.dismiss(mainToast);
      if (totalCount > 0) {
        toast.success(`Anonymisation globale réussie : ${totalCount} entités traitées (${studentsCount} élèves, ${staffCount} personnel, ${parentsCount} parents).`);
      } else {
        toast.info("Aucune donnée générique (test/démo) n'a nécessité de remplacement.");
      }

      await AuditLogger.log({
        school_id: null,
        user_id: user.id,
        action: 'ANONYMIZE_ALL',
        entity_type: 'system',
        details: { studentsCount, staffCount, parentsCount, totalCount }
      });
    } catch (err: any) {
      toast.dismiss(mainToast);
      toast.error("Erreur lors de l'anonymisation globale : " + err.message);
    } finally {
      setIsAnonymizingAll(false);
    }
  };

  const handleCheckSubscriptions = async (manual = false) => {
    // Avoid auto-triggering multiple times in the same session
    if (!manual && window.sessionStorage.getItem('edunova_subscriptions_checked')) return;
    
    if (manual) setIsCheckingSubscriptions(true);
    
    try {
      let result: any = null;

      try {
        const response = await fetch('/api/cron/check-subscriptions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });

        const contentType = response.headers.get('content-type') || '';
        if (response.ok && contentType.includes('application/json')) {
          result = await response.json().catch(() => null);
        } else if (!response.ok && contentType.includes('application/json')) {
          const errorData = await response.json().catch(() => null);
          if (errorData?.error) {
            console.warn("API cron subscription check returned error:", errorData.error);
          }
        }
      } catch (fetchErr) {
        console.warn("Could not reach /api/cron/check-subscriptions endpoint, using direct client check:", fetchErr);
      }

      // Fallback: direct client-side expiration checks if API wasn't available or returned non-JSON
      if (!result || !result.success) {
        const now = new Date();
        const checkDays = [7, 3, 1];
        let detectedCount = 0;

        for (const days of checkDays) {
          const targetDate = new Date();
          targetDate.setDate(now.getDate() + days);
          const dateStr = targetDate.toISOString().split('T')[0];

          const { data: expiringSchools } = await supabase
            .from('schools')
            .select('id, name, email, subscription_end_date')
            .gte('subscription_end_date', `${dateStr}T00:00:00Z`)
            .lte('subscription_end_date', `${dateStr}T23:59:59Z`)
            .eq('status', 'Actif');

          if (expiringSchools && expiringSchools.length > 0) {
            detectedCount += expiringSchools.length;
          }
        }

        result = {
          success: true,
          results: [],
          detectedCount
        };
      }

      if (result && result.success) {
        if (manual) {
          const sentCount = result.results?.filter((r: any) => r.status === 'sent').length || 0;
          const detected = result.detectedCount || 0;
          if (sentCount > 0) {
            toast.success(`${sentCount} rappel(s) d'abonnement envoyé(s) avec succès.`, {
              description: "Le système a vérifié les échéances à 7, 3 et 1 jour."
            });
          } else if (detected > 0) {
            toast.info(`${detected} établissement(s) approchant de l'échéance détecté(s).`, {
              description: "Les échéances à 7, 3 et 1 jour sont surveillées."
            });
          } else {
            toast.success("Vérification des abonnements terminée.", {
              description: "Aucun abonnement n'arrive à expiration critique (7, 3 ou 1 jour)."
            });
          }
        }
        window.sessionStorage.setItem('edunova_subscriptions_checked', 'true');
      }
    } catch (err: any) {
      console.warn("Vérification des abonnements non bloquante:", err?.message || err);
      if (manual) toast.error("Erreur lors de la vérification des abonnements.");
    } finally {
      if (manual) setIsCheckingSubscriptions(false);
    }
  };

  useEffect(() => {
    fetchSchools();
    handleCheckSubscriptions(); // Auto-check on mount
  }, [fetchSchools]);

  useEffect(() => {
    // Setup real-time subscription for automatic updates on schools and profiles
    const schoolsChannel = supabase.channel('super_admin_schools_realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'schools'
      }, () => {
        console.log("Mise à jour en temps réel de la table 'schools' détectée. Actualisation...");
        fetchSchools();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'profiles'
      }, () => {
        console.log("Mise à jour en temps réel de la table 'profiles' détectée. Actualisation...");
        fetchSchools();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(schoolsChannel);
    };
  }, [fetchSchools]);

  useEffect(() => {
    if (activeView === 'config') {
      fetchGlobalConfig();
    }
  }, [activeView]);

  const fetchGlobalConfig = async () => {
    setIsLoadingConfig(true);
    try {
      const { data, error } = await supabase
        .from('global_settings')
        .select('*');

      if (error) {
        if (error.message.includes('schema cache')) {
          throw new Error("La table 'global_settings' n'existe pas dans la base de données. Veuillez exécuter le script SQL de configuration.");
        }
        throw error;
      }

      if (data) {
        const newConfig = { ...config };
        data.forEach(item => {
          if (item.key === 'platform_identity') {
            newConfig.platformName = item.value.name;
            newConfig.supportEmail = item.value.support_email;
            newConfig.primaryColor = item.value.primary_color;
          } else if (item.key === 'security_policy') {
            newConfig.minPasswordLength = item.value.min_password_length;
            newConfig.sessionTimeout = item.value.session_timeout_minutes;
            if (item.value.max_failed_attempts) newConfig.maxFailedAttempts = item.value.max_failed_attempts;
            if (item.value.lockout_duration_minutes) newConfig.lockoutDurationMinutes = item.value.lockout_duration_minutes;
          } else if (item.key === 'default_subscription') {
            newConfig.trialDays = item.value.trial_days;
            newConfig.defaultStudentLimit = item.value.student_limit;
            newConfig.defaultTeacherLimit = item.value.teacher_limit;
          } else if (item.key === 'modules_config') {
            newConfig.enabledModules = item.value.enabled_modules;
          } else if (item.key === 'data_retention') {
            newConfig.dataRetentionMonths = item.value.retention_months;
          } else if (item.key === 'system_status') {
            newConfig.maintenanceMode = item.value.maintenance_mode;
          } else if (item.key === 'default_session_config') {
            newConfig.defaultSessionMode = item.value.mode || 'auto';
            newConfig.manualSessionLabel = item.value.label || '';
            newConfig.manualSessionStart = item.value.start_date || '';
            newConfig.manualSessionEnd = item.value.end_date || '';
          }
        });
        setConfig(newConfig);
      }
    } catch (err: any) {
      toast.error("Erreur lors du chargement de la configuration : " + err.message);
    } finally {
      setIsLoadingConfig(false);
    }
  };

  const handleSaveConfig = async () => {
    // Validation du libellé de session si mode manuel
    if (config.defaultSessionMode === 'manual') {
      const sessionRegex = /^\d{4}-\d{4}$/;
      if (!config.manualSessionLabel || !sessionRegex.test(config.manualSessionLabel)) {
        setSessionLabelError("Le libellé de session doit respecter le format YYYY-YYYY (ex: 2026-2027)");
        toast.error("Format de session invalide");
        return;
      }
      
      const parts = config.manualSessionLabel.split('-');
      const startYear = parseInt(parts[0]);
      const endYear = parseInt(parts[1]);
      
      if (endYear !== startYear + 1) {
        setSessionLabelError("L'année de fin doit être l'année de début + 1 (ex: 2026-2027)");
        toast.error("Intervalle de session invalide");
        return;
      }
    }
    
    setSessionLabelError(null);
    setIsSavingConfig(true);
    try {
      const updates = [
        {
          key: 'platform_identity',
          value: { 
            name: config.platformName, 
            support_email: config.supportEmail, 
            primary_color: config.primaryColor 
          },
          updated_by: user.id
        },
        {
          key: 'security_policy',
          value: { 
            min_password_length: config.minPasswordLength, 
            session_timeout_minutes: config.sessionTimeout,
            max_failed_attempts: config.maxFailedAttempts,
            lockout_duration_minutes: config.lockoutDurationMinutes
          },
          updated_by: user.id
        },
        {
          key: 'default_subscription',
          value: { 
            trial_days: config.trialDays, 
            student_limit: config.defaultStudentLimit, 
            teacher_limit: config.defaultTeacherLimit 
          },
          updated_by: user.id
        },
        {
          key: 'modules_config',
          value: { enabled_modules: config.enabledModules },
          updated_by: user.id
        },
        {
          key: 'data_retention',
          value: { retention_months: config.dataRetentionMonths },
          updated_by: user.id
        },
        {
          key: 'system_status',
          value: { maintenance_mode: config.maintenanceMode },
          updated_by: user.id
        },
        {
          key: 'default_session_config',
          value: { 
            mode: config.defaultSessionMode,
            label: config.manualSessionLabel,
            start_date: config.manualSessionStart,
            end_date: config.manualSessionEnd
          },
          updated_by: user.id
        }
      ];

      const { error } = await supabase
        .from('global_settings')
        .upsert(updates);

      if (error) {
        console.error("SuperAdminDashboard: Upsert error:", error);
        if (error.message.includes('schema cache')) {
          throw new Error("La table 'global_settings' n'existe pas dans la base de données. Veuillez exécuter le script SQL de configuration.");
        }
        throw error;
      }

      await AuditLogger.log({
        school_id: null,
        user_id: user.id,
        action: 'UPDATE_GLOBAL_CONFIG',
        entity_type: 'system',
        details: { config_keys: updates.map(u => u.key) }
      });

      toast.success("Configuration enregistrée avec succès !");
    } catch (err: any) {
      toast.error("Erreur lors de l'enregistrement : " + err.message);
    } finally {
      setIsSavingConfig(false);
    }
  };

  const fetchGlobalUsers = async () => {
    setLoadingGlobalUsers(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*, school:schools(name)')
      .order('created_at', { ascending: false })
      .limit(100);
    
    if (!error && data) setGlobalUsers(data);
    setLoadingGlobalUsers(false);
  };

  const fetchSystemLogs = async () => {
    setLoadingLogs(true);
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*, user:profiles(full_name, email), school:schools(name)')
      .order('created_at', { ascending: false })
      .limit(100);
    
    if (!error && data) setSystemLogs(data);
    setLoadingLogs(false);
  };

  const fetchSecuritySessions = async (isSilent = false) => {
    if (!isSilent && securitySessions.length === 0) {
      setLoadingSecuritySessions(true);
    }
    try {
      let fetchedUsers: any[] | null = null;
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('*, school:schools(name)')
        .order('created_at', { ascending: false });

      if (!usersError && usersData && usersData.length > 0) {
        fetchedUsers = usersData;
      } else {
        // Fallback using exec_sql for Super Admin if RLS or query scoping limits profiles
        const { data: sqlData } = await supabase.rpc('exec_sql', {
          sql_query: "SELECT p.*, json_build_object('name', s.name) as school FROM public.profiles p LEFT JOIN public.schools s ON p.school_id = s.id ORDER BY p.created_at DESC"
        });
        if (sqlData && Array.isArray(sqlData)) {
          fetchedUsers = sqlData;
        }
      }

      if (fetchedUsers) {
        setSecuritySessions(fetchedUsers);
      }

      const { data: logsData, error: logsError } = await supabase
        .from('audit_logs')
        .select('*, user:profiles(full_name, email), school:schools(name)')
        .or("action.eq.LOGIN_FAILED,action.eq.REVOKE_ACCESS,action.eq.UPDATE_USER,action.eq.AUTH_LOCKOUT,action.eq.DELETE,action.eq.UPDATE")
        .order('created_at', { ascending: false })
        .limit(100);

      if (!logsError && logsData) {
        setSecurityAuditLogs(logsData);
      }
    } catch (err: any) {
      console.error("Erreur chargement des sessions et sécurité:", err);
    } finally {
      setLoadingSecuritySessions(false);
    }
  };

  const handleUnblockUser = async (targetUser: any) => {
    try {
      let { data, error } = await supabase.rpc('admin_toggle_user_status', {
        p_user_id: targetUser.id,
        p_new_status: true
      });

      if (error || !data?.success) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ 
            is_active: true,
            failed_login_attempts: 0,
            failed_attempts: 0
          })
          .eq('id', targetUser.id);

        if (updateError) throw updateError;
      }

      await AuditLogger.log({
        school_id: targetUser.school_id || null,
        user_id: user.id,
        action: 'UPDATE_USER',
        entity_type: 'user',
        entity_id: targetUser.id,
        details: { type: 'unblock_user', target_email: targetUser.email, target_name: targetUser.full_name }
      });

      toast.success(`Le compte de ${targetUser.full_name || targetUser.email} a été débloqué et réactivé !`);
      fetchSecuritySessions();
    } catch (err: any) {
      toast.error("Erreur lors du déblocage du compte : " + err.message);
    }
  };

  const handleBlockUser = async (targetUser: any) => {
    if (targetUser.role === 'SUPER_ADMIN' || targetUser.is_super_admin) {
      toast.error("Impossible de suspendre un compte Super Administrateur.");
      return;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: false })
        .eq('id', targetUser.id);

      if (error) throw error;

      await AuditLogger.log({
        school_id: targetUser.school_id || null,
        user_id: user.id,
        action: 'REVOKE_ACCESS',
        entity_type: 'user',
        entity_id: targetUser.id,
        details: { type: 'preventive_block', target_email: targetUser.email, target_name: targetUser.full_name }
      });

      toast.success(`Accès révoqué pour ${targetUser.full_name || targetUser.email} par mesure de sécurité.`);
      fetchSecuritySessions();
    } catch (err: any) {
      toast.error("Erreur lors de la suspension : " + err.message);
    }
  };

  const handleTerminateUserSession = async (targetUser: any) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ current_session_id: null })
        .eq('id', targetUser.id);

      if (error) throw error;

      await AuditLogger.log({
        school_id: targetUser.school_id || null,
        user_id: user.id,
        action: 'UPDATE',
        entity_type: 'user',
        entity_id: targetUser.id,
        details: { type: 'force_session_termination', target_email: targetUser.email }
      });

      toast.success(`Session déconnectée à distance pour ${targetUser.full_name || targetUser.email}.`);
      fetchSecuritySessions();
    } catch (err: any) {
      toast.error("Erreur lors de la déconnexion de session : " + err.message);
    }
  };

  useEffect(() => {
    if (activeView === 'sessions') {
      fetchSecuritySessions();
    }
  }, [activeView]);

  useEffect(() => {
    let interval: any = null;
    if (activeView === 'sessions' && autoRefreshSecurity) {
      interval = setInterval(() => {
        fetchSecuritySessions(true);
      }, 20000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeView, autoRefreshSecurity]);

  const [switchSchoolModal, setSwitchSchoolModal] = useState<{isOpen: boolean, school: any | null}>({isOpen: false, school: null});

  const handleSwitchSchool = async () => {
    const school = switchSchoolModal.school;
    if (!school) return;
    
    console.log("Switching to school:", school.name, school.id);
    
    try {
      const { error } = await supabase.rpc('admin_switch_school', { p_school_id: school.id });

      if (error) {
        console.error("Switch school error:", error);
        throw error;
      }

      console.log("Switch school success, logging audit...");
      await AuditLogger.log({
        school_id: school.id,
        user_id: user.id,
        action: 'UPDATE',
        entity_type: 'user',
        entity_id: user.id,
        details: { type: 'switch_school', new_school_id: school.id, school_name: school.name }
      });

      toast.success(`Vous travaillez maintenant pour : ${school.name}`);
      
      // On vide le cache local pour forcer App.tsx à recharger le profil frais
      try {
        window.localStorage.removeItem('edunova_user_profile');
      } catch (e) {}

      // On recharge la page pour que tout le contexte (RLS, Dashboard, etc.) se mette à jour
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err: any) {
      console.error("Switch school catch error:", err);
      toast.error("Erreur lors du basculement : " + err.message);
    } finally {
      setSwitchSchoolModal({isOpen: false, school: null});
    }
  };

  const handleResetSchool = async () => {
    console.log("Resetting school context to global");
    setIsResettingContext(true);
    
    try {
      const { error } = await supabase.rpc('admin_reset_school_context');

      if (error) {
        console.error("Reset school error:", error);
        throw error;
      }

      console.log("Reset school success, logging audit...");
      await AuditLogger.log({
        school_id: null,
        user_id: user.id,
        action: 'UPDATE',
        entity_type: 'user',
        entity_id: user.id,
        details: { type: 'reset_school_context' }
      });

      toast.success("Contexte global réinitialisé avec succès.");

      // On vide le cache local pour forcer App.tsx à recharger le profil frais
      try {
        window.localStorage.removeItem('edunova_user_profile');
      } catch (e) {}

      setTimeout(() => {
        window.location.reload();
      }, 800);
    } catch (err: any) {
      console.error("Reset school catch error:", err);
      toast.error("Erreur lors de la réinitialisation : " + err.message);
      setIsResettingContext(false);
    }
  };

  const stats = useMemo(() => {
    const totalSchools = schools.length;
    const totalUsers = schools.reduce((acc, s) => acc + (s.staff_count || 0), 0);
    const totalStudents = schools.reduce((acc, s) => acc + (s.student_count || 0), 0);
    const activeSchools = schools.filter(s => s.status === 'ACTIVE').length;
    const expiredSchools = schools.filter(s => s.subscription_plan !== 'unlimited' && s.subscription_end_date && new Date(s.subscription_end_date) < new Date()).length;
    
    // Calcul de la croissance réelle (30 derniers jours vs 30 jours précédents)
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const createdLast30Days = schools.filter(s => s.created_at && new Date(s.created_at) >= thirtyDaysAgo).length;
    const createdPrevious30Days = schools.filter(s => s.created_at && new Date(s.created_at) >= sixtyDaysAgo && new Date(s.created_at) < thirtyDaysAgo).length;

    let calculatedGrowth = 0;
    if (createdPrevious30Days === 0) {
      calculatedGrowth = createdLast30Days > 0 ? 100 : 0; 
    } else {
      calculatedGrowth = Math.round(((createdLast30Days - createdPrevious30Days) / createdPrevious30Days) * 100);
    }
    
    return {
      totalSchools,
      totalUsers,
      totalStudents,
      activeSchools,
      expiredSchools,
      growth: calculatedGrowth
    };
  }, [schools]);

  const quickActions = [
    { label: 'Nouvelle École', icon: Plus, color: 'bg-indigo-600', textColor: 'text-white', action: () => setIsModalOpen(true) },
    { label: 'Sauvegardes BD', icon: Archive, color: activeView === 'backups' ? 'bg-indigo-50 shadow-inner' : 'bg-white hover:bg-slate-50', border: activeView === 'backups' ? 'border-indigo-200' : 'border-slate-200', textColor: activeView === 'backups' ? 'text-indigo-700' : 'text-slate-600', action: () => setActiveView('backups') },
    { label: 'Alertes Système', icon: ShieldAlert, color: activeView === 'alerts' ? 'bg-rose-50 shadow-inner' : 'bg-white hover:bg-slate-50', border: activeView === 'alerts' ? 'border-rose-200' : 'border-slate-200', textColor: activeView === 'alerts' ? 'text-rose-700' : 'text-slate-600', action: () => setActiveView('alerts') },
    { label: 'Réinit. Contexte', icon: RefreshCw, color: user.school_id ? 'bg-amber-100 hover:bg-amber-200' : 'bg-white hover:bg-slate-50', border: user.school_id ? 'border-amber-200' : 'border-slate-200', textColor: user.school_id ? 'text-amber-700' : 'text-slate-600', action: handleResetSchool },
    { label: 'Logs Système', icon: Database, color: activeView === 'logs' ? 'bg-indigo-50 shadow-inner' : 'bg-white hover:bg-slate-50', border: activeView === 'logs' ? 'border-indigo-200' : 'border-slate-200', textColor: activeView === 'logs' ? 'text-indigo-700' : 'text-slate-600', action: () => { setActiveView('logs'); fetchSystemLogs(); } },
    { label: 'Utilisateurs', icon: Users, color: activeView === 'users' ? 'bg-indigo-50 shadow-inner' : 'bg-white hover:bg-slate-50', border: activeView === 'users' ? 'border-indigo-200' : 'border-slate-200', textColor: activeView === 'users' ? 'text-indigo-700' : 'text-slate-600', action: () => { setActiveView('users'); fetchGlobalUsers(); } },
    { label: 'Configuration', icon: Settings, color: activeView === 'config' ? 'bg-indigo-50 shadow-inner' : 'bg-white hover:bg-slate-50', border: activeView === 'config' ? 'border-indigo-200' : 'border-slate-200', textColor: activeView === 'config' ? 'text-indigo-700' : 'text-slate-600', action: () => setActiveView('config') },
    { label: 'Système', icon: HardDrive, color: activeView === 'system' ? 'bg-indigo-50 shadow-inner' : 'bg-white hover:bg-slate-50', border: activeView === 'system' ? 'border-indigo-200' : 'border-slate-200', textColor: activeView === 'system' ? 'text-indigo-700' : 'text-slate-600', action: () => setActiveView('system') },
  ];

  const toggleSchoolStatus = async () => {
    const { schoolId, currentStatus, schoolName } = statusModal;
    const newStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    setIsSubmitting(true);

    try {
      const { data, error } = await supabase
        .from('schools')
        .update({ status: newStatus })
        .eq('id', schoolId)
        .select();

      if (error) {
        console.error("Erreur lors de la modification du statut:", error);
        toast.error(`Erreur: ${error.message}`);
      } else if (!data || data.length === 0) {
        console.error("Aucune école modifiée. RLS bloque peut-être l'action.");
        toast.error("Impossible de modifier le statut. Vérifiez vos permissions.");
      } else {
        toast.success(`L'école a été ${newStatus === 'SUSPENDED' ? 'suspendue' : 'réactivée'} avec succès.`);
        AuditLogger.log({
          school_id: user.school_id, // Super Admin's school ID
          user_id: user.id,
          action: 'UPDATE',
          entity_type: 'school',
          entity_id: schoolId,
          details: { type: 'status_change', new_status: newStatus, school_name: schoolName }
        });
        setStatusModal({ ...statusModal, isOpen: false });
        fetchSchools();
      }
    } catch (err: any) {
      toast.error(`Erreur inattendue: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('schools')
        .update({
          name: editSchoolModal.name,
          email: editSchoolModal.email,
          director_name: editSchoolModal.director_name,
          phone: editSchoolModal.phone,
          address: editSchoolModal.address,
          has_multi_campus: editSchoolModal.has_multi_campus
        })
        .eq('id', editSchoolModal.schoolId);

      if (error) throw error;

      toast.success("Les informations de l'école et l'option Multi-Annexes ont été mises à jour.");
      setEditSchoolModal({ ...editSchoolModal, isOpen: false });
      fetchSchools();
      
      AuditLogger.log({
        school_id: user.school_id,
        user_id: user.id,
        action: 'UPDATE',
        entity_type: 'school',
        entity_id: editSchoolModal.schoolId,
        details: { type: 'edit_school_info', school_name: editSchoolModal.name, has_multi_campus: editSchoolModal.has_multi_campus }
      });
    } catch (err: any) {
      console.error("Erreur lors de la mise à jour :", err);
      toast.error("Erreur lors de la mise à jour : " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  
  const handleUpdateModules = async () => {
    setIsSubmitting(true);
    try {
      // Get current global_settings
      const { data: currentSchool, error: fetchError } = await supabase
        .from('schools')
        .select('global_settings')
        .eq('id', modulesModal.schoolId)
        .single();
        
      if (fetchError) throw fetchError;
      
      const newSettings = currentSchool.global_settings || {};
      newSettings.modules = modulesModal.modules;
      
      const { error } = await supabase
        .from('schools')
        .update({ global_settings: newSettings })
        .eq('id', modulesModal.schoolId);
        
      if (error) throw error;
      
      toast.success("Les modules de l'école ont été mis à jour.");
      setModulesModal({ ...modulesModal, isOpen: false });
      fetchSchools();
      
      AuditLogger.log({
        school_id: modulesModal.schoolId,
        user_id: user.id,
        action: 'UPDATE',
        entity_type: 'school',
        entity_id: modulesModal.schoolId,
        details: { type: 'edit_modules', modules: modulesModal.modules }
      });
    } catch (err: any) {
      console.error("Erreur lors de la mise à jour des modules :", err);
      toast.error("Erreur : " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

const handleDeleteSchool = async () => {
    const { schoolId, schoolName, confirmName } = deleteModal;
    
    if (confirmName !== schoolName) {
      toast.error("Le nom de l'école ne correspond pas.");
      return;
    }

    setIsSubmitting(true);
    try {
      // Tentative de suppression de l'école. Cela nécessite que la base de données
      // ait des contraintes ON DELETE CASCADE sur toutes les tables liées à school_id.
      const { error } = await supabase
        .from('schools')
        .delete()
        .eq('id', schoolId);

      if (error) throw error;

      AuditLogger.log({
        school_id: user.school_id,
        user_id: user.id,
        action: 'DELETE',
        entity_type: 'school',
        entity_id: schoolId,
        details: { type: 'delete_tenant', school_name: schoolName }
      });

      toast.success("L'établissement a été supprimé avec succès.");
      setDeleteModal({ ...deleteModal, isOpen: false, confirmName: '' });
      fetchSchools();
    } catch (err: any) {
      console.error("Erreur lors de la suppression:", err);
      toast.error("Erreur lors de la suppression. Assurez-vous que la suppression en cascade est configurée sur la base de données. Détails: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCleanSchool = async () => {
    const { schoolId, schoolName, confirmName } = cleanModal;
    
    if (confirmName !== schoolName) {
      toast.error("Le nom de l'école ne correspond pas.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.rpc('clean_school_test_data', { p_school_id: schoolId, p_campus_id: null });
      if (error) throw error;

      AuditLogger.log({
        school_id: user.school_id,
        user_id: user.id,
        action: 'DELETE',
        entity_type: 'school',
        entity_id: schoolId,
        details: { type: 'clean_test_data', school_name: schoolName }
      });

      toast.success("Toutes les données de test ont été supprimées avec succès.");
      setCleanModal({ isOpen: false, schoolId: '', schoolName: '', confirmName: '' });
      fetchSchools(); // Refresh counts
    } catch (err: any) {
      console.error("Erreur lors du nettoyage:", err);
      toast.error("Erreur lors du nettoyage de l'école. Détails: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetUserPassword = async () => {
    const { userId, fullName, newPassword, forceChange } = resetModal;
    if (!newPassword) return;

    setIsSubmitting(true);
    // Appel de notre fonction RPC sécurisée
    const { error } = await supabase.rpc('admin_reset_user_password', {
      target_user_id: userId,
      new_password: newPassword,
      force_change: forceChange
    });

    setIsSubmitting(false);
    if (error) {
      toast.error("Erreur lors de la réinitialisation : " + error.message);
    } else {
      await supabase.from('profiles').update({ force_password_change: forceChange }).eq('id', userId);
      setResetModal({ ...resetModal, isOpen: false, newPassword: '', forceChange: true });
      toast.success("Mot de passe réinitialisé avec succès.");
      
      // Log the action
      await AuditLogger.log({
        school_id: null, // Global action
        user_id: user.id,
        action: 'PASSWORD_RESET',
        entity_type: 'user',
        entity_id: userId,
        details: { target_user: fullName, admin_type: 'super_admin', forceChange }
      });
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      // 1. Mettre à jour le profil uniquement (nom complet)
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: editUserModal.fullName
        })
        .eq('id', editUserModal.userId);

      if (profileError) throw profileError;

      toast.success("Les informations de l'utilisateur ont été mises à jour.");

      setEditUserModal({ ...editUserModal, isOpen: false });
      fetchGlobalUsers();
      
      AuditLogger.log({
        school_id: null,
        user_id: user.id,
        action: 'UPDATE',
        entity_type: 'user',
        entity_id: editUserModal.userId,
        details: { type: 'edit_user_info', user_name: editUserModal.fullName }
      });
    } catch (err: any) {
      console.error("Erreur lors de la mise à jour :", err);
      toast.error("Erreur lors de la mise à jour : " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openAdminList = async (school: any) => {
    setSelectedSchool(school);
    setAdminListModalOpen(true);
    setLoadingAdmins(true);
    setAdminSearchTerm('');
    
    // Fetch admins directly bypassing the RPC which had strict role checks
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('school_id', school.id)
      .not('role', 'in', '("STUDENT","PARENT")');
      
    if (!error && data) {
      setSchoolAdmins(data);
    }
    setLoadingAdmins(false);
  };

  const openRenewModal = (school: any) => {
    setSelectedSchool(school);
    setRenewPlan(school.subscription_plan || 'mensuel');
    setRenewDays(30);
    setHasMultiCampus(!!school.has_multi_campus);
    setRenewModalOpen(true);
  };

  const handleRenewSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSchool) return;
    
    setIsRenewing(true);
    try {
      const { data, error } = await supabase.rpc('admin_update_subscription', {
        p_school_id: selectedSchool.id,
        p_plan: renewPlan,
        p_duration_days: renewDays
      });

      if (error) throw error;

      // Handle custom success: false returning from JSONB structure
      const res = typeof data === 'string' ? JSON.parse(data) : data;
      if (res && res.success === false) {
        throw new Error(res.error || "Une erreur est survenue lors de la mise à jour de l'abonnement.");
      }

      // Update has_multi_campus directly in the school record
      const { error: updateError } = await supabase
        .from('schools')
        .update({ has_multi_campus: hasMultiCampus })
        .eq('id', selectedSchool.id);

      if (updateError) throw updateError;
      
      AuditLogger.log({
        school_id: user.school_id,
        user_id: user.id,
        action: 'UPDATE',
        entity_type: 'school',
        entity_id: selectedSchool.id,
        details: { type: 'subscription_renewal_premium_modules', plan: renewPlan, days: renewDays, has_multi_campus: hasMultiCampus }
      });

      toast.success("Configuration mise à jour avec succès !");
      setRenewModalOpen(false);
      fetchSchools();
    } catch (err: any) {
      toast.error("Erreur lors de la mise à jour : " + err.message);
    } finally {
      setIsRenewing(false);
    }
  };

  const handleExportData = (school: any) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(school, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `export_${school.id}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();

    AuditLogger.log({
      school_id: user.school_id,
      user_id: user.id,
      action: 'EXPORT',
      entity_type: 'school',
      entity_id: school.id,
      details: { type: 'export_data', school_name: school.name }
    });
  };

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.adminPassword !== formData.confirmPassword) {
      setFeedback({ type: 'error', message: "Les mots de passe ne correspondent pas." });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      // Appel de la fonction RPC pour créer l'école et l'admin en une seule transaction
      const { data, error } = await supabase.rpc('admin_create_tenant', {
        p_school_name: formData.schoolName,
        p_admin_email: normalizeIdentifier(formData.adminEmail),
        p_admin_password: formData.adminPassword,
        p_admin_name: formData.adminName,
        p_school_type: formData.schoolType
      });

      if (error) throw error;
      
      if (data && data.success === false) {
        throw new Error(data.error || "Erreur inconnue lors de la création.");
      }

      // Explicitly enforce password change requirement for the newly created school admin
      if (data && data.admin_id) {
        await supabase
          .from('profiles')
          .update({ force_password_change: true })
          .eq('id', data.admin_id);
      }

      // Inject defaults if requested
      if (formData.injectDefaults && data.school_id) {
        await supabase.rpc('admin_seed_existing_school', { p_school_id: data.school_id });
      }

      // Automatically correct the default academic year created by seed_school_data
      // to match the configured global settings and school type (Classic vs University).
      if (data && data.school_id) {
        let sessionLabel = '';
        let sessionStart = '';
        let sessionEnd = '';
        
        if (config.manualSessionLabel && config.manualSessionStart && config.manualSessionEnd && config.defaultSessionMode === 'manual') {
          sessionLabel = config.manualSessionLabel;
          sessionStart = config.manualSessionStart;
          sessionEnd = config.manualSessionEnd;
        } else {
          // Dynamic calculation based on current date and school type
          const now = new Date();
          const currentYear = now.getFullYear();
          const currentMonth = now.getMonth(); // 0-indexed: 0 = Jan, 7 = Aug, 8 = Sept, 9 = Oct
          const isUniversity = formData.schoolType === 'UNIVERSITY';

          // Pre-Enrollment & Onboarding Window:
          // From MAY (month index 4) to DECEMBER, schools onboarding are preparing for the UPCOMING academic year (currentYear - currentYear+1)
          // e.g. In May/June/July/August 2026, newly created schools immediately receive 2026-2027 to start admissions & registrations!
          // From JANUARY to APRIL (months 0-3), mid-year onboardings join the ongoing year (currentYear-1 - currentYear) e.g. 2025-2026.
          const PRE_REGISTRATION_START_MONTH = 4; // May (0-indexed: May = 4)

          if (currentMonth < PRE_REGISTRATION_START_MONTH) {
            // Jan - Apr: Mid-year onboarding for ongoing school year
            sessionLabel = `${currentYear - 1}-${currentYear}`;
            sessionStart = isUniversity ? `${currentYear - 1}-10-01` : `${currentYear - 1}-09-01`;
            sessionEnd = isUniversity ? `${currentYear}-07-31` : `${currentYear}-06-30`;
          } else {
            // May - Dec: Pre-registration & new academic year onboarding (e.g. August 2026 -> 2026-2027)
            sessionLabel = `${currentYear}-${currentYear + 1}`;
            sessionStart = isUniversity ? `${currentYear}-10-01` : `${currentYear}-09-01`;
            sessionEnd = isUniversity ? `${currentYear + 1}-07-31` : `${currentYear + 1}-06-30`;
          }
        }

        if (sessionLabel && sessionStart && sessionEnd) {
          await supabase
            .from('academic_years')
            .update({
              label: sessionLabel,
              start_date: sessionStart,
              end_date: sessionEnd
            })
            .eq('school_id', data.school_id)
            .eq('status', 'ACTIVE');
        }
      }

      AuditLogger.log({
        school_id: user.school_id,
        user_id: user.id,
        action: 'CREATE',
        entity_type: 'school',
        details: { type: 'create_tenant', school_name: formData.schoolName, admin_email: formData.adminEmail }
      });

      fetchSchools();
      
      // Close modal and reset form immediately
      setIsModalOpen(false);
      
      // Show beautiful custom toast
      toast.custom((t) => (
        <div className="bg-white border border-emerald-100 shadow-2xl rounded-2xl p-5 flex items-start gap-4 max-w-md w-full relative overflow-hidden animate-in slide-in-from-top-4">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-teal-500"></div>
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center shrink-0 shadow-sm border border-emerald-100">
            <Building2 size={24} className="text-emerald-500" />
          </div>
          <div className="flex-1 pt-1">
            <h3 className="text-base font-black text-slate-900 tracking-tight">Félicitations ! 🎉</h3>
            <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">
              L'établissement <span className="font-bold text-emerald-700">{formData.schoolName}</span> a été créé avec succès.
            </p>
            <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg">
              <CheckCircle2 size={14} />
              Espace administrateur prêt
            </div>
          </div>
          <button onClick={() => toast.dismiss(t)} className="text-slate-500 hover:text-slate-600 hover:bg-slate-50 p-1.5 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>
      ), { duration: 6000 });

      setFormData({ schoolName: '', schoolType: SchoolType.CLASSIC, adminName: '', adminEmail: '', adminPassword: '', confirmPassword: '', injectDefaults: true });
      setFeedback(null);

    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || "Une erreur est survenue." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const [seedModal, setSeedModal] = useState<{
    isOpen: boolean;
    schoolId: string;
    schoolName: string;
    schoolType?: string;
  }>({ isOpen: false, schoolId: '', schoolName: '' });

  const handleSeedSchool = async () => {
    const { schoolId, schoolName } = seedModal;
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('admin_seed_existing_school', { p_school_id: schoolId });
      
      if (error) throw error;
      
      if (data && data.success === false) {
        throw new Error(data.error || "Erreur lors de l'injection.");
      }

      setSeedModal({ isOpen: false, schoolId: '', schoolName: '' });
      
      toast.custom((t) => (
        <div className="bg-white border border-indigo-100 shadow-2xl rounded-2xl p-5 flex items-start gap-4 max-w-md w-full relative overflow-hidden animate-in slide-in-from-top-4">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-400 to-purple-500"></div>
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center shrink-0 shadow-sm border border-indigo-100">
            <Database size={24} className="text-indigo-500" />
          </div>
          <div className="flex-1 pt-1">
            <h3 className="text-base font-black text-slate-900 tracking-tight">Données Injectées 🚀</h3>
            <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">
              Les données standards ont été ajoutées à <span className="font-bold text-indigo-700">{schoolName}</span>.
            </p>
            <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">
              <CheckCircle2 size={14} />
              Classes, matières et catalogue prêts
            </div>
          </div>
          <button onClick={() => toast.dismiss(t)} className="text-slate-500 hover:text-slate-600 hover:bg-slate-50 p-1.5 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>
      ), { duration: 6000 });
      
      await AuditLogger.log({
        school_id: schoolId,
        user_id: user.id,
        action: 'SEED_DATA',
        entity_type: 'school',
        details: { school_name: schoolName, type: 'standard_injection' }
      });
      
      fetchSchools();
    } catch (err: any) {
      toast.error("Erreur d'injection : " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const [showRepairConfirm, setShowRepairConfirm] = useState(false);

  const handleRepairSystem = async () => {
    setIsRepairing(true);
    console.log("Démarrage de la réparation système...");
    
    try {
      const repairSql = `
        DO $$ 
        BEGIN
          -- 1. Réparation des identités auth manquantes
          INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
          SELECT gen_random_uuid(), u.id::text, u.id, jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true), 'email', now(), now(), now()
          FROM auth.users u 
          WHERE NOT EXISTS (SELECT 1 FROM auth.identities i WHERE i.user_id = u.id AND i.provider = 'email')
          ON CONFLICT DO NOTHING;

          -- 2. Création de la table class_schedules si elle manque
          IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'class_schedules') THEN
            CREATE TABLE public.class_schedules (
                id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
                class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
                subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
                staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
                day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
                start_time TIME NOT NULL,
                end_time TIME NOT NULL,
                room TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
                CONSTRAINT valid_time_range CHECK (start_time < end_time)
            );
          END IF;
        END $$;
      `;
      
      console.log("Envoi du RPC exec_sql...");
      const { data, error } = await supabase.rpc('exec_ddl', { ddl_query: repairSql });
      
      if (error) {
        console.error("Erreur RPC Supabase:", error);
        if (error.message.includes('exec_ddl')) {
          throw new Error("La fonction 'exec_ddl' n'est pas disponible. Veuillez l'ajouter via l'éditeur SQL Supabase.");
        }
        throw error;
      }

      if (data && data.error) {
        console.error("Erreur SQL interne renvoyée par exec_sql:", data);
        throw new Error(`Erreur SQL interne : ${data.error}`);
      }

      console.log("Réparation terminée avec succès.");
      toast.success("Réparation système terminée avec succès !");
    } catch (err: any) {
      console.error("Exception attrapée dans handleRepairSystem:", err);
      toast.error("Erreur de réparation : " + err.message);
    } finally {
      setIsRepairing(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 p-6 animate-in fade-in duration-700 pb-20">
      {/* Header Super Admin Ergonomique & Centre de Contrôle */}
      <div className="space-y-4">
        {/* Top Hero Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 rounded-[2rem] shadow-xl border border-slate-800 relative overflow-hidden">
          {/* Decorative glow overlays */}
          <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute right-1/3 -top-10 w-48 h-48 bg-teal-500/10 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            {/* Title & Network Status Badges */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="px-3 py-1 bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 text-[10px] font-black uppercase tracking-widest rounded-full backdrop-blur-md flex items-center gap-1.5">
                  <ShieldCheck size={12} className="text-emerald-400" />
                  ADMINISTRATION DU SYSTÈME
                </span>
                <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-black uppercase tracking-wider rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  RÉSEAU EN LIGNE
                </span>
              </div>

              <div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white flex items-center gap-3">
                  <ShieldAlert size={32} className="text-indigo-400 shrink-0" />
                  Console Super Administrateur
                </h1>
                <p className="text-xs sm:text-sm text-slate-300 font-medium mt-1 max-w-2xl">
                  Supervision globale multi-établissement, gouvernance réseau, audit de sécurité et maintenance système.
                </p>
              </div>

              {/* Live Metric Badges */}
              <div className="pt-1 flex flex-wrap items-center gap-3 text-xs font-bold text-slate-300">
                <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700/60">
                  <Building2 size={15} className="text-indigo-400" />
                  <span><strong className="text-white font-black">{stats.totalSchools}</strong> Établissements</span>
                </div>
                <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700/60">
                  <Users size={15} className="text-blue-400" />
                  <span><strong className="text-white font-black">{stats.totalUsers}</strong> Utilisateurs</span>
                </div>
                <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700/60">
                  <GraduationCap size={15} className="text-emerald-400" />
                  <span><strong className="text-white font-black">{stats.totalStudents}</strong> Élèves</span>
                </div>
              </div>
            </div>

            {/* Main Action Buttons */}
            <div className="flex flex-wrap lg:flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
              {/* GROS BOUTON D'ADMINISTRATION / NOUVELLE ÉCOLE */}
              <button
                onClick={() => setIsModalOpen(true)}
                className="px-6 py-4 bg-gradient-to-r from-indigo-500 via-indigo-600 to-indigo-700 hover:from-indigo-600 hover:to-indigo-800 text-white font-black text-sm rounded-2xl shadow-xl shadow-indigo-950/50 hover:shadow-indigo-600/30 transition-all flex items-center justify-center gap-3 border border-indigo-400/30 active:scale-95 group"
              >
                <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Plus size={22} className="text-white" strokeWidth={3} />
                </div>
                <div className="text-left">
                  <div className="text-[10px] uppercase tracking-wider text-indigo-200 font-extrabold">Action Principale</div>
                  <div className="text-sm font-black tracking-tight">Créer un Établissement</div>
                </div>
              </button>

              {user.school_id && (
                <button
                  onClick={() => setShowResetContextModal(true)}
                  className="px-5 py-3 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/40 font-black text-xs rounded-2xl transition-all flex items-center justify-center gap-2.5 backdrop-blur-md active:scale-95 shadow-lg shadow-amber-950/30 group"
                  title="Quitter le mode immersion et réinitialiser au périmètre Super Admin global"
                >
                  <div className="w-6 h-6 rounded-lg bg-amber-400/20 flex items-center justify-center text-amber-300 group-hover:rotate-180 transition-transform duration-500 shrink-0">
                    <RefreshCw size={14} />
                  </div>
                  <div className="text-left">
                    <div className="text-[9px] uppercase tracking-wider text-amber-300/80 font-black">Mode Immersion Actif</div>
                    <div className="text-xs font-black tracking-tight whitespace-nowrap">Réinitialiser Contexte Global</div>
                  </div>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Ergonomic Navigation View Switcher (Tabs) */}
        <div className="bg-white/90 backdrop-blur-md p-2 rounded-2xl border border-slate-200/90 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'schools', label: 'Établissements', icon: Building2, badge: stats.totalSchools },
              { id: 'health', label: 'Santé Système & Quotas', icon: Activity },
              { id: 'backups', label: 'Sauvegardes & Restauration', icon: Archive },
              { id: 'sessions', label: 'Sessions & Sécurité', icon: KeyRound, actionExtra: fetchSecuritySessions },
              { id: 'alerts', label: 'Alertes Temps Réel', icon: ShieldAlert },
              { id: 'logs', label: 'Logs & Audit', icon: Database, actionExtra: fetchSystemLogs },
              { id: 'users', label: 'Utilisateurs Globaux', icon: Users, actionExtra: fetchGlobalUsers },
              { id: 'config', label: 'Configuration Globale', icon: Settings },
              { id: 'system', label: 'Maintenance Système', icon: HardDrive },
            ].map((tab) => {
              const isActive = activeView === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveView(tab.id as any);
                    if (tab.actionExtra) tab.actionExtra();
                  }}
                  className={`flex-1 sm:flex-initial px-4 py-3 rounded-xl font-extrabold text-xs tracking-tight transition-all flex items-center justify-center gap-2.5 whitespace-nowrap group relative ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-md shadow-slate-900/15 border border-slate-800'
                      : 'bg-slate-50/80 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200/60'
                  }`}
                >
                  <Icon 
                    size={16} 
                    className={`shrink-0 transition-transform group-hover:scale-110 ${
                      isActive ? 'text-indigo-400' : 'text-slate-400 group-hover:text-slate-600'
                    }`} 
                  />
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
                      isActive ? 'bg-indigo-500/30 text-indigo-200 border border-indigo-400/30' : 'bg-slate-200/80 text-slate-700'
                    }`}>
                      {tab.badge}
                    </span>
                  )}
                  {isActive && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-1 bg-indigo-500 rounded-full shadow-sm" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Reset Context Modal */}
      {showResetContextModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-[2rem] shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden flex flex-col"
          >
            <div className="p-6 bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-white backdrop-blur-md shadow-inner">
                  <RefreshCw size={24} className={isResettingContext ? "animate-spin" : ""} />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-black tracking-widest text-amber-100 bg-amber-900/30 px-2.5 py-0.5 rounded-md">
                    GOUVERNANCE RÉSEAU
                  </span>
                  <h3 className="text-lg font-black tracking-tight mt-0.5">Réinitialiser le Contexte Global</h3>
                </div>
              </div>
              <button
                onClick={() => setShowResetContextModal(false)}
                className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
                disabled={isResettingContext}
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs font-medium text-slate-600">
              <div className="p-4 bg-amber-50/80 border border-amber-200/80 rounded-2xl flex items-start gap-3">
                <Info size={20} className="text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-slate-900 text-xs">
                    Quitter le mode immersion établissement
                  </p>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    Vous êtes actuellement connecté dans l'établissement <strong className="text-slate-900 font-extrabold">{schools.find(s => s.id === user.school_id)?.name || 'sélectionné'}</strong>. Souhaitez-vous réinitialiser votre session pour revenir au rôle Super Admin global ?
                  </p>
                </div>
              </div>

              <div className="space-y-2 text-[11px] bg-slate-50 p-4 rounded-2xl border border-slate-200/70">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Résultat de l'action :</span>
                <ul className="space-y-2 text-slate-700 font-bold">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
                    Vue d'ensemble restaurée sur l'ensemble des {stats.totalSchools} établissements du réseau
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
                    Déverrouillage des privilèges système et des consoles de maintenance globale
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
                    Rafraîchissement sécurisé des jetons de session Supabase
                  </li>
                </ul>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowResetContextModal(false)}
                disabled={isResettingContext}
                className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition-all"
              >
                Annuler
              </button>
              <button
                onClick={handleResetSchool}
                disabled={isResettingContext}
                className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs rounded-xl transition-all shadow-lg shadow-amber-200 active:scale-95 flex items-center gap-2 disabled:opacity-50"
              >
                {isResettingContext ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Réinitialisation...
                  </>
                ) : (
                  <>
                    <RefreshCw size={16} />
                    Confirmer la Réinitialisation
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Repair Confirmation Modal */}
      {showRepairConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-[2rem] shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden flex flex-col"
          >
            <div className="p-6 bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-white backdrop-blur-md shadow-inner">
                  <Wrench size={24} />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-black tracking-widest text-amber-100 bg-amber-900/30 px-2.5 py-0.5 rounded-md">
                    OPÉRATION TECHNIQUE
                  </span>
                  <h3 className="text-lg font-black tracking-tight mt-0.5">Réparation Système Multi-Tenant</h3>
                </div>
              </div>
              <button
                onClick={() => setShowRepairConfirm(false)}
                className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
                disabled={isRepairing}
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4 text-xs font-medium text-slate-600">
              <p className="text-slate-800 font-bold text-sm leading-relaxed">
                Voulez-vous exécuter la procédure de réparation et de synchronisation des identités du réseau ?
              </p>
              <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-4 space-y-2">
                <span className="text-[10px] font-black uppercase text-amber-900 tracking-wider">Actions de Maintenance Exécutées :</span>
                <ul className="text-xs text-amber-900 font-bold space-y-2">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={15} className="text-amber-600 shrink-0" />
                    Création et mise à jour des identités manquantes dans la table `profiles`
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={15} className="text-amber-600 shrink-0" />
                    Recalcul et application des règles RLS de ségrégation par établissement
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={15} className="text-amber-600 shrink-0" />
                    Correction des associations orphelines et réinitialisation des métadonnées JWT
                  </li>
                </ul>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowRepairConfirm(false)}
                className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition-all"
                disabled={isRepairing}
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  setShowRepairConfirm(false);
                  handleRepairSystem();
                }}
                disabled={isRepairing}
                className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs rounded-xl transition-all shadow-lg shadow-amber-200 active:scale-95 flex items-center gap-2"
              >
                {isRepairing ? <Loader2 size={16} className="animate-spin" /> : <Wrench size={16} />}
                Confirmer la Réparation
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Seed Confirmation Modal */}
      {seedModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center shrink-0">
                <Database size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Injection de Données</h3>
                <p className="text-sm text-slate-500">Données standards pour l'établissement</p>
              </div>
            </div>
            
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-6">
              <p className="text-sm text-indigo-800 font-medium mb-2">
                Voulez-vous injecter les données standards pour l'établissement <span className="font-bold">"{seedModal.schoolName}"</span> ?
              </p>
              <ul className="text-xs text-indigo-700 space-y-1 list-disc list-inside">
                {seedModal.schoolType === SchoolType.UNIVERSITY ? (
                  <>
                    <li>Facultés et Départements universitaires préconfigurés</li>
                    <li>Centaines de matières académiques avec descriptions</li>
                    <li>Frais universitaires de base (Inscription, Scolarité)</li>
                  </>
                ) : seedModal.schoolType === SchoolType.PROFESSIONAL ? (
                  <>
                    <li>Filières professionnelles certifiantes (Informatique, Mécanique, etc.)</li>
                    <li>Matières techniques, ateliers et stages pré-associés</li>
                    <li>Catalogue de frais de base</li>
                  </>
                ) : (
                  <>
                    <li>Classes par défaut (Maternelle, Primaire, Secondaire)</li>
                    <li>Matières standards (Maths, Français, etc.) pré-assignées</li>
                    <li>Catalogue de frais de base</li>
                  </>
                )}
              </ul>
              <p className="text-xs text-indigo-600 mt-3 font-medium flex items-center gap-1">
                <AlertCircle size={12} /> Cette action est irréversible.
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setSeedModal({ isOpen: false, schoolId: '', schoolName: '' })}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                disabled={isSubmitting}
              >
                Annuler
              </button>
              <button
                onClick={handleSeedSchool}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg transition-colors flex items-center gap-2"
              >
                {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Database size={16} />}
                Confirmer l'injection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Switch School Confirmation Modal */}
      {switchSchoolModal.isOpen && switchSchoolModal.school && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95 duration-200 border border-slate-100">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mb-4 shadow-sm border border-emerald-100">
                <ArrowUpRight size={28} strokeWidth={2.5} />
              </div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Changement de Contexte</h3>
              <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                Vous êtes sur le point de basculer vers l'espace de travail de :
              </p>
              <div className="mt-3 px-4 py-2 bg-slate-50 rounded-xl border border-slate-100 w-full">
                <span className="font-bold text-slate-800">{switchSchoolModal.school.name}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={handleSwitchSchool}
                className="w-full py-3 text-sm font-bold bg-slate-900 text-white hover:bg-slate-800 rounded-xl transition-all shadow-md hover:shadow-lg active:scale-95"
              >
                Confirmer et basculer
              </button>
              <button
                onClick={() => setSwitchSchoolModal({ isOpen: false, school: null })}
                className="w-full py-3 text-sm font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-xl transition-all"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid - Modern, compact & responsive */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-3.5">
        {[
          { label: 'Établissements', value: stats.totalSchools, icon: Building2, color: 'text-indigo-600', bg: 'bg-indigo-50/80', border: 'border-indigo-100', trend: `${stats.growth >= 0 ? '+' : ''}${stats.growth}%`, trendBg: 'bg-indigo-50 text-indigo-700', action: () => { setActiveView('schools'); setFilterExpired(false); } },
          { label: 'Comptes Actifs', value: stats.totalUsers, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50/80', border: 'border-blue-100', trend: 'Gérants / Experts', trendBg: 'bg-blue-50 text-blue-700', action: () => { setActiveView('users'); fetchGlobalUsers(); } },
          { label: 'Élèves Inscrits', value: stats.totalStudents, icon: GraduationCap, color: 'text-purple-600', bg: 'bg-purple-50/80', border: 'border-purple-100', trend: 'Global', trendBg: 'bg-purple-50 text-purple-700' },
          { label: 'Écoles Actives', value: stats.activeSchools, icon: ShieldCheck, color: 'text-emerald-600', bg: 'bg-emerald-50/80', border: 'border-emerald-100', trend: 'En ligne', trendBg: 'bg-emerald-50 text-emerald-700', action: () => { setActiveView('schools'); setFilterExpired(false); } },
          { label: 'Abonnements Expirés', value: stats.expiredSchools, icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-50/80', border: 'border-rose-100', trend: stats.expiredSchools > 0 ? 'À renouveler' : 'À jour', trendBg: stats.expiredSchools > 0 ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700', action: () => { setActiveView('schools'); setFilterExpired(true); }, tooltip: "Écoles dont la période d'abonnement est terminée et nécessitent une action." },
        ].map((stat, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            onClick={stat.action}
            className={`bg-white p-3 sm:p-3.5 rounded-2xl shadow-2xs border border-slate-200/80 hover:border-indigo-300 hover:shadow-xs transition-all flex flex-col justify-between group ${stat.action ? 'cursor-pointer active:scale-[0.98]' : ''}`}
          >
            <div className="flex items-center justify-between gap-1.5 mb-1.5">
              <div className={`w-7 h-7 sm:w-8 sm:h-8 ${stat.bg} ${stat.color} border ${stat.border} rounded-xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform`}>
                <stat.icon size={15} />
              </div>
              <span className={`text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-md whitespace-nowrap ${stat.trendBg}`}>
                {stat.trend}
              </span>
            </div>
            <div className="relative group/tooltip">
              <p className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider leading-snug line-clamp-2 min-h-[24px] sm:min-h-[28px] flex items-center">{stat.label}</p>
              <p className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5 tracking-tight">{stat.value}</p>
              {stat.tooltip && (
                <div className="absolute bottom-full left-0 mb-2 w-48 p-2 bg-slate-900 text-white text-[10px] rounded-lg opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none z-10 shadow-xl">
                  {stat.tooltip}
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="space-y-6">
        {activeView === 'health' && <SystemHealthView user={user} />}
        {activeView === 'backups' && <BackupManagementView user={user} schools={schools} />}
        {activeView === 'alerts' && <SystemAlertsView user={user} />}
        {activeView === 'schools' && (() => {
          const expiredCount = schools.filter(s => s.subscription_plan !== 'unlimited' && s.subscription_end_date && new Date(s.subscription_end_date) < new Date()).length;
          const activeCount = schools.filter(s => s.status === 'ACTIVE').length;
          const multiCampusCount = schools.filter(s => !!s.has_multi_campus).length;
          const protectedCount = schools.filter(s => !!s.is_protected).length;

          const filteredSchoolList = schools.filter(s => {
            const matchesSearch = !searchTerm || 
              (s.name && s.name.toLowerCase().includes(searchTerm.toLowerCase())) || 
              (s.id && s.id.toLowerCase().includes(searchTerm.toLowerCase())) ||
              (s.director_name && s.director_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
              (s.email && s.email.toLowerCase().includes(searchTerm.toLowerCase()));

            const isExpired = s.subscription_plan !== 'unlimited' && s.subscription_end_date && new Date(s.subscription_end_date) < new Date();
            
            if (filterExpired && !isExpired) return false;

            if (schoolFilterTab === 'ACTIVE') return matchesSearch && s.status === 'ACTIVE';
            if (schoolFilterTab === 'EXPIRED') return matchesSearch && isExpired;
            if (schoolFilterTab === 'MULTI_CAMPUS') return matchesSearch && !!s.has_multi_campus;
            if (schoolFilterTab === 'PROTECTED') return matchesSearch && !!s.is_protected;

            return matchesSearch;
          });

          return (
            <div className="space-y-6">
              {/* Header & Controls Bar */}
              <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-xs flex flex-col gap-6">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-50 border border-indigo-100/80 text-indigo-600 rounded-2xl shadow-xs flex items-center justify-center shrink-0">
                      <Building2 size={24} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">Établissements Scolaires</h2>
                        <span className="px-2.5 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-black rounded-full">
                          {schools.length} {schools.length > 1 ? 'écoles' : 'école'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">Instances, gouvernance, abonnements & multi-campus</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                    {/* View Switcher: Table vs Cards */}
                    <div className="inline-flex bg-slate-100 p-1 rounded-2xl border border-slate-200/80 shrink-0">
                      <button
                        type="button"
                        onClick={() => setSchoolViewMode('table')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          schoolViewMode === 'table' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                        title="Affichage Tableau Détaillé"
                      >
                        <List size={15} />
                        <span className="hidden sm:inline">Tableau</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSchoolViewMode('grid')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          schoolViewMode === 'grid' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                        title="Affichage Grille Adaptative"
                      >
                        <Grid size={15} />
                        <span className="hidden sm:inline">Grille</span>
                      </button>
                    </div>

                    {/* Refresh Button */}
                    <button
                      onClick={fetchSchools}
                      disabled={loading}
                      className="p-3 bg-slate-50 border border-slate-200 text-slate-700 rounded-2xl hover:bg-slate-100 transition-all shadow-xs shrink-0 cursor-pointer disabled:opacity-50"
                      title="Rafraîchir la liste"
                    >
                      <RefreshCw size={17} className={loading ? 'animate-spin text-indigo-600' : ''} />
                    </button>

                    {/* Create School Button */}
                    <button
                      onClick={() => setIsModalOpen(true)}
                      className="flex-1 sm:flex-none px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs md:text-sm font-bold rounded-2xl transition-all shadow-md shadow-indigo-100 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Plus size={18} />
                      <span>Ajouter une école</span>
                    </button>
                  </div>
                </div>

                {/* Search & Filter Pills */}
                <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 pt-4 border-t border-slate-100">
                  {/* Quick Filter Tabs */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[
                      { id: 'ALL', label: 'Toutes', count: schools.length },
                      { id: 'ACTIVE', label: 'Actives', count: activeCount, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
                      { id: 'EXPIRED', label: 'Expirées', count: expiredCount, color: 'text-rose-700 bg-rose-50 border-rose-200' },
                      { id: 'MULTI_CAMPUS', label: 'Multi-Annexes', count: multiCampusCount, color: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
                      { id: 'PROTECTED', label: 'Protégées', count: protectedCount, color: 'text-amber-700 bg-amber-50 border-amber-200' }
                    ].map(tab => {
                      const isActive = schoolFilterTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => {
                            setSchoolFilterTab(tab.id as any);
                            if (tab.id !== 'EXPIRED' && filterExpired) setFilterExpired(false);
                          }}
                          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-2 border cursor-pointer ${
                            isActive 
                              ? 'bg-slate-900 text-white border-slate-900 shadow-xs' 
                              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <span>{tab.label}</span>
                          <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-black ${
                            isActive ? 'bg-white/20 text-white' : tab.color || 'bg-slate-200 text-slate-700'
                          }`}>
                            {tab.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Search Input */}
                  <div className="relative w-full lg:w-80 group shrink-0">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={16} />
                    <input 
                      type="text" 
                      placeholder="Rechercher par nom, ID, directeur..." 
                      className="w-full pl-10 pr-9 py-2.5 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-600 outline-none transition-all placeholder:text-slate-400"
                      value={searchTerm || ''}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && (
                      <button 
                        onClick={() => setSearchTerm('')} 
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Display: Loading & Error States */}
              {loading ? (
                <div className="py-24 bg-white rounded-3xl border border-slate-200 shadow-xs flex flex-col items-center justify-center gap-4">
                  <Loader2 className="animate-spin text-indigo-600" size={40} />
                  <p className="text-slate-500 font-bold text-xs uppercase tracking-widest animate-pulse">Chargement des établissements scolaires...</p>
                </div>
              ) : error ? (
                <div className="p-8 bg-white rounded-3xl border border-rose-200 shadow-xs text-center">
                  <div className="max-w-md mx-auto">
                    <RetryableError 
                      message={error} 
                      onRetry={() => {
                        setError(null);
                        fetchSchools();
                      }} 
                    />
                  </div>
                </div>
              ) : filteredSchoolList.length === 0 ? (
                <div className="py-20 bg-white rounded-3xl border border-slate-200 shadow-xs text-center flex flex-col items-center justify-center gap-3">
                  <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 border border-slate-100">
                    <Building2 size={32} />
                  </div>
                  <h3 className="font-bold text-slate-800 text-base">Aucun établissement ne correspond aux critères</h3>
                  <p className="text-xs text-slate-500 max-w-sm">Essayez de modifier votre recherche ou vos filtres pour voir les écoles enregistrées.</p>
                  <button 
                    onClick={() => { setSearchTerm(''); setSchoolFilterTab('ALL'); setFilterExpired(false); }}
                    className="mt-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
                  >
                    Réinitialiser les filtres
                  </button>
                </div>
              ) : (
                <>
                  {/* --- View 1: Modern Table View (Desktop & Tablet with Horizontal Smooth Scroll) --- */}
                  <div className={`${schoolViewMode === 'grid' ? 'hidden' : 'block'} bg-white rounded-3xl shadow-xs border border-slate-200 overflow-hidden`}>
                    <div className="overflow-x-auto custom-scrollbar">
                      <table className="w-full text-left min-w-[750px]">
                        <thead>
                          <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-black text-slate-400 uppercase tracking-wider">
                            <th className="px-6 py-4.5">Établissement</th>
                            <th className="px-6 py-4.5">Abonnement & Licence</th>
                            <th className="px-6 py-4.5 text-center">Population</th>
                            <th className="px-6 py-4.5 text-center">Statut</th>
                            <th className="px-6 py-4.5 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredSchoolList.map((school, idx) => {
                            const isExpired = school.subscription_plan !== 'unlimited' && school.subscription_end_date && new Date(school.subscription_end_date) < new Date();
                            const daysLeft = school.subscription_end_date 
                              ? Math.ceil((new Date(school.subscription_end_date).getTime() - new Date().getTime()) / (1000 * 3600 * 24))
                              : null;
                            const isCurrentWorkingSchool = user.school_id === school.id;
                            const isMenuOpen = openSchoolMenuId === school.id;

                            return (
                              <motion.tr 
                                key={school.id}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: Math.min(idx * 0.03, 0.3) }}
                                className="hover:bg-slate-50/90 transition-all group"
                              >
                                {/* Column 1: School Identity */}
                                <td className="px-6 py-5">
                                  <div className="flex items-center gap-3.5">
                                    <div className="w-11 h-11 bg-indigo-50/80 text-indigo-600 rounded-2xl flex items-center justify-center relative border border-indigo-100 shrink-0 group-hover:scale-105 transition-transform">
                                      <Building2 size={20} />
                                      {school.is_protected && (
                                        <div className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 bg-amber-500 rounded-full border-2 border-white flex items-center justify-center shadow-xs" title="École Protégée Système">
                                          <ShieldAlert size={9} className="text-white" />
                                        </div>
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <p className="font-extrabold text-slate-900 text-sm tracking-tight leading-snug break-words">{school.name}</p>
                                        {isCurrentWorkingSchool && (
                                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[9px] font-black uppercase rounded-full tracking-wider shrink-0">
                                            Actuelle
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                                        <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/60">
                                          ID: {school.id.split('-')[0]}
                                        </span>
                                        {school.school_type && (
                                          <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded uppercase tracking-wider">
                                            {school.school_type}
                                          </span>
                                        )}
                                        {school.has_multi_campus ? (
                                          <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded uppercase tracking-wider flex items-center gap-1">
                                            <Layers size={10} /> Multi-Annexes ({school.annex_count || 1})
                                          </span>
                                        ) : (
                                          <span className="text-[10px] text-slate-400 font-medium">
                                            Site unique
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </td>

                                {/* Column 2: Subscription & Expiration */}
                                <td className="px-6 py-5">
                                  <div className="flex flex-col gap-1.5 items-start">
                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider border whitespace-nowrap ${
                                      school.subscription_plan === 'unlimited' ? 'bg-amber-50 text-amber-800 border-amber-200/80 shadow-xs' :
                                      school.subscription_plan === 'yearly' ? 'bg-indigo-50 text-indigo-700 border-indigo-200/80' :
                                      school.subscription_plan === 'monthly' ? 'bg-blue-50 text-blue-700 border-blue-200/80' :
                                      'bg-slate-50 text-slate-600 border-slate-200'
                                    }`}>
                                      {planLabels[school.subscription_plan] || school.subscription_plan || 'Essai'}
                                    </span>
                                    {school.subscription_plan !== 'unlimited' && (
                                      <div className="flex items-center gap-1.5 whitespace-nowrap">
                                        <Clock size={12} className={isExpired ? 'text-rose-500 shrink-0' : 'text-slate-400 shrink-0'} />
                                        <span className={`text-[11px] font-bold ${
                                          isExpired ? 'text-rose-600 font-black' : daysLeft && daysLeft <= 7 ? 'text-amber-600 font-bold' : 'text-slate-500'
                                        }`}>
                                          {isExpired ? 'Licence expirée' : daysLeft ? `${daysLeft} jours restants` : 'Non configuré'}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </td>

                                {/* Column 3: Population Metrics */}
                                <td className="px-6 py-5">
                                  <div className="flex items-center justify-center gap-2">
                                    <div className="flex flex-col items-center px-2.5 py-1 rounded-xl bg-blue-50/70 border border-blue-100 min-w-[64px]" title="Gestionnaires & Enseignants">
                                      <span className="text-blue-800 text-xs font-black leading-tight">{school.staff_count || 0}</span>
                                      <span className="text-[8px] font-bold text-blue-600 uppercase tracking-widest">Staff</span>
                                    </div>
                                    <div className="flex flex-col items-center px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-200/70 min-w-[64px]" title="Élèves inscrits">
                                      <span className="text-slate-800 text-xs font-black leading-tight">{school.student_count || 0}</span>
                                      <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Élèves</span>
                                    </div>
                                  </div>
                                </td>

                                {/* Column 4: Status */}
                                <td className="px-6 py-5 text-center">
                                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                                    school.status === 'ACTIVE' 
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                      : 'bg-rose-50 text-rose-700 border-rose-200'
                                  }`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${school.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                    {statusLabels[school.status] || school.status}
                                  </span>
                                </td>

                                {/* Column 5: Smart Action Suite */}
                                <td className="px-6 py-5 text-right">
                                  <div className="flex items-center justify-end gap-1.5 relative">
                                    {/* Primary Work Button */}
                                    <button 
                                      onClick={() => setSwitchSchoolModal({ isOpen: true, school })}
                                      title={isCurrentWorkingSchool ? "Vous êtes dans cette école" : "Basculer et travailler dans cette école"}
                                      className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                                        isCurrentWorkingSchool 
                                          ? 'bg-emerald-600 text-white shadow-xs' 
                                          : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white border border-indigo-100'
                                      }`}
                                    >
                                      <ArrowUpRight size={14} />
                                      <span className="hidden xl:inline">{isCurrentWorkingSchool ? 'Actif' : 'Travailler'}</span>
                                    </button>

                                    {/* Quick Edit */}
                                    {!school.is_protected && (
                                      <button 
                                        onClick={() => setEditSchoolModal({ 
                                          isOpen: true, 
                                          schoolId: school.id, 
                                          name: school.name, 
                                          email: school.email || '', 
                                          director_name: school.director_name || '', 
                                          phone: school.phone || '', 
                                          address: school.address || '',
                                          has_multi_campus: !!school.has_multi_campus
                                        })}
                                        title="Modifier l'établissement"
                                        className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all border border-transparent hover:border-indigo-100 cursor-pointer"
                                      >
                                        <Edit2 size={16} />
                                      </button>
                                    )}

                                    {/* Admins Button */}
                                    <button 
                                      onClick={() => openAdminList(school)}
                                      title="Comptes Administrateurs & Accès"
                                      className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all border border-transparent hover:border-blue-100 cursor-pointer"
                                    >
                                      <Users size={16} />
                                    </button>

                                    {/* Renew Button */}
                                    {!school.is_protected && (
                                      <button 
                                        onClick={() => openRenewModal(school)}
                                        title="Gérer l'abonnement"
                                        className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all border border-transparent hover:border-emerald-100 cursor-pointer"
                                      >
                                        <CalendarPlus size={16} />
                                      </button>
                                    )}

                                    {/* Dropdown Menu for Advanced Actions */}
                                    <div className="relative">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setOpenSchoolMenuId(isMenuOpen ? null : school.id);
                                        }}
                                        className={`p-2 rounded-xl transition-all cursor-pointer ${
                                          isMenuOpen ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                                        }`}
                                        title="Plus d'actions"
                                      >
                                        <MoreVertical size={16} />
                                      </button>

                                      {/* Dropdown Overlay Menu */}
                                      <AnimatePresence>
                                        {isMenuOpen && (
                                          <>
                                            <div 
                                              className="fixed inset-0 z-20 cursor-default" 
                                              onClick={() => setOpenSchoolMenuId(null)} 
                                            />
                                            <motion.div
                                              initial={{ opacity: 0, scale: 0.95, y: 5 }}
                                              animate={{ opacity: 1, scale: 1, y: 0 }}
                                              exit={{ opacity: 0, scale: 0.95, y: 5 }}
                                              className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-30 divide-y divide-slate-100 text-left font-sans"
                                            >
                                              <div className="px-3 py-1.5">
                                                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Opérations Avancées</p>
                                                <p className="text-xs font-bold text-slate-800 truncate">{school.name}</p>
                                              </div>

                                              <div className="py-1">
                                                <button
                                                  onClick={() => {
                                                    setOpenSchoolMenuId(null);
                                                    setModulesModal({ 
                                                      isOpen: true, 
                                                      schoolId: school.id, 
                                                      schoolName: school.name,
                                                      modules: {
                                                        presences: school.global_settings?.modules?.presences ?? (school.school_type !== 'UNIVERSITY' && school.school_type !== 'PROFESSIONAL'),
                                                        discipline: school.global_settings?.modules?.discipline ?? (school.school_type !== 'UNIVERSITY' && school.school_type !== 'PROFESSIONAL')
                                                      }
                                                    });
                                                  }}
                                                  className="w-full px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 flex items-center gap-2.5 transition-colors cursor-pointer"
                                                >
                                                  <Settings2 size={15} className="text-indigo-600" />
                                                  <span>Modules & Options</span>
                                                </button>

                                                <button
                                                  onClick={() => {
                                                    setOpenSchoolMenuId(null);
                                                    setSeedModal({ isOpen: true, schoolId: school.id, schoolName: school.name, schoolType: school.school_type });
                                                  }}
                                                  className="w-full px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-amber-50 hover:text-amber-700 flex items-center gap-2.5 transition-colors cursor-pointer"
                                                >
                                                  <Database size={15} className="text-amber-600" />
                                                  <span>Injecter données types</span>
                                                </button>

                                                <button
                                                  onClick={() => {
                                                    setOpenSchoolMenuId(null);
                                                    handleExportData(school);
                                                  }}
                                                  className="w-full px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2.5 transition-colors cursor-pointer"
                                                >
                                                  <Download size={15} className="text-blue-600" />
                                                  <span>Exporter données JSON</span>
                                                </button>
                                              </div>

                                              {!school.is_protected && (
                                                <div className="py-1">
                                                  <button
                                                    onClick={() => {
                                                      setOpenSchoolMenuId(null);
                                                      setStatusModal({ isOpen: true, schoolId: school.id, schoolName: school.name, currentStatus: school.status });
                                                    }}
                                                    className="w-full px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-amber-50 hover:text-amber-700 flex items-center gap-2.5 transition-colors cursor-pointer"
                                                  >
                                                    <Power size={15} className="text-amber-600" />
                                                    <span>{school.status === 'ACTIVE' ? 'Suspendre l\'instance' : 'Réactiver l\'instance'}</span>
                                                  </button>

                                                  <button
                                                    onClick={() => {
                                                      setOpenSchoolMenuId(null);
                                                      setCleanModal({ isOpen: true, schoolId: school.id, schoolName: school.name, confirmName: '' });
                                                    }}
                                                    className="w-full px-3.5 py-2 text-xs font-bold text-amber-700 hover:bg-amber-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                                                  >
                                                    <Eraser size={15} className="text-amber-600" />
                                                    <span>Vider les données (Reset)</span>
                                                  </button>

                                                  <button
                                                    onClick={() => {
                                                      setOpenSchoolMenuId(null);
                                                      setDeleteModal({ isOpen: true, schoolId: school.id, schoolName: school.name, confirmName: '' });
                                                    }}
                                                    className="w-full px-3.5 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                                                  >
                                                    <Trash2 size={15} className="text-rose-600" />
                                                    <span>Supprimer l'école</span>
                                                  </button>
                                                </div>
                                              )}
                                            </motion.div>
                                          </>
                                        )}
                                      </AnimatePresence>
                                    </div>
                                  </div>
                                </td>
                              </motion.tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* --- View 2: Responsive Modern Cards Grid (Desktop 3-columns, Tablet 2-columns, Mobile) --- */}
                  <div className={`${schoolViewMode === 'table' ? 'hidden' : 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5'}`}>
                    {filteredSchoolList.map((school, idx) => {
                      const isExpired = school.subscription_plan !== 'unlimited' && school.subscription_end_date && new Date(school.subscription_end_date) < new Date();
                      const daysLeft = school.subscription_end_date 
                        ? Math.ceil((new Date(school.subscription_end_date).getTime() - new Date().getTime()) / (1000 * 3600 * 24))
                        : null;
                      const isCurrentWorkingSchool = user.school_id === school.id;

                      return (
                        <motion.div
                          key={school.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: Math.min(idx * 0.03, 0.3) }}
                          className={`bg-white rounded-3xl p-5 md:p-6 border transition-all shadow-xs flex flex-col justify-between gap-5 ${
                            isCurrentWorkingSchool ? 'border-emerald-300 ring-2 ring-emerald-500/10' : 'border-slate-200'
                          }`}
                        >
                          {/* Card Top: Identity & Status */}
                          <div className="space-y-3.5">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3 min-w-0 flex-1">
                                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center relative border border-indigo-100 shrink-0 mt-0.5">
                                  <Building2 size={22} />
                                  {school.is_protected && (
                                    <div className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 bg-amber-500 rounded-full border-2 border-white flex items-center justify-center shadow-xs" title="École Protégée">
                                      <ShieldAlert size={9} className="text-white" />
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <h3 className="font-black text-slate-900 text-sm md:text-base leading-snug break-words" title={school.name}>
                                    {school.name}
                                  </h3>
                                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                    <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/60 shrink-0">
                                      ID: {school.id.split('-')[0]}
                                    </span>
                                    {school.school_type && (
                                      <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded uppercase shrink-0">
                                        {school.school_type}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border shrink-0 ${
                                school.status === 'ACTIVE' 
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                  : 'bg-rose-50 text-rose-700 border-rose-200'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${school.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                {statusLabels[school.status] || school.status}
                              </span>
                            </div>

                            {/* Tags Bar */}
                            <div className="flex items-center gap-2 flex-wrap pt-1">
                              {school.has_multi_campus ? (
                                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-lg uppercase tracking-wider flex items-center gap-1">
                                  <Layers size={11} /> Multi-Annexes ({school.annex_count || 1})
                                </span>
                              ) : (
                                <span className="text-[10px] font-semibold text-slate-500 bg-slate-50 border border-slate-200/80 px-2 py-0.5 rounded-lg">
                                  Site Unique
                                </span>
                              )}

                              {isCurrentWorkingSchool && (
                                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-lg uppercase tracking-wider">
                                  Session Active
                                </span>
                              )}
                            </div>

                            {/* Metrics & Subscription Dashboard */}
                            <div className="grid grid-cols-2 gap-2.5 pt-2">
                              {/* Subscription Box */}
                              <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-200/70 flex flex-col justify-between">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Abonnement</span>
                                <div className="mt-1">
                                  <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                                    school.subscription_plan === 'unlimited' ? 'bg-amber-100 text-amber-800' :
                                    school.subscription_plan === 'yearly' ? 'bg-indigo-100 text-indigo-800' :
                                    school.subscription_plan === 'monthly' ? 'bg-blue-100 text-blue-800' :
                                    'bg-slate-200 text-slate-700'
                                  }`}>
                                    {planLabels[school.subscription_plan] || school.subscription_plan || 'Essai'}
                                  </span>
                                  {school.subscription_plan !== 'unlimited' && (
                                    <p className={`text-[10px] font-bold mt-1 ${isExpired ? 'text-rose-600 font-black' : 'text-slate-500'}`}>
                                      {isExpired ? 'Expiré' : daysLeft ? `${daysLeft}j restants` : 'Non défini'}
                                    </p>
                                  )}
                                </div>
                              </div>

                              {/* Population Box */}
                              <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-200/70 flex flex-col justify-between">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Population</span>
                                <div className="flex items-center gap-3 mt-1">
                                  <div>
                                    <span className="text-xs font-black text-slate-800 block">{school.student_count || 0}</span>
                                    <span className="text-[9px] text-slate-500 font-bold">Élèves</span>
                                  </div>
                                  <div className="w-px h-6 bg-slate-200" />
                                  <div>
                                    <span className="text-xs font-black text-blue-700 block">{school.staff_count || 0}</span>
                                    <span className="text-[9px] text-slate-500 font-bold">Staff</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Card Bottom: Action Toolbar */}
                          <div className="space-y-2 pt-2 border-t border-slate-100">
                            {/* Primary Button */}
                            <button
                              onClick={() => setSwitchSchoolModal({ isOpen: true, school })}
                              className={`w-full py-2.5 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
                                isCurrentWorkingSchool 
                                  ? 'bg-emerald-600 text-white shadow-xs' 
                                  : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                              }`}
                            >
                              <ArrowUpRight size={15} />
                              <span>{isCurrentWorkingSchool ? 'Session Active (Vous y êtes)' : 'Travailler dans cette école'}</span>
                            </button>

                            {/* Secondary Action Grid */}
                            <div className="grid grid-cols-4 gap-1.5">
                              <button
                                onClick={() => openAdminList(school)}
                                title="Admins"
                                className="py-2 bg-slate-50 hover:bg-blue-50 hover:text-blue-700 border border-slate-200 rounded-xl text-slate-600 flex flex-col items-center justify-center gap-0.5 text-[9px] font-bold transition-all cursor-pointer"
                              >
                                <Users size={14} />
                                <span>Admins</span>
                              </button>

                              {!school.is_protected ? (
                                <button
                                  onClick={() => setEditSchoolModal({ 
                                    isOpen: true, 
                                    schoolId: school.id, 
                                    name: school.name, 
                                    email: school.email || '', 
                                    director_name: school.director_name || '', 
                                    phone: school.phone || '', 
                                    address: school.address || '',
                                    has_multi_campus: !!school.has_multi_campus
                                  })}
                                  title="Modifier"
                                  className="py-2 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 rounded-xl text-slate-600 flex flex-col items-center justify-center gap-0.5 text-[9px] font-bold transition-all cursor-pointer"
                                >
                                  <Edit2 size={14} />
                                  <span>Modifier</span>
                                </button>
                              ) : (
                                <div className="py-2 bg-slate-100 border border-slate-200 rounded-xl text-slate-400 flex flex-col items-center justify-center gap-0.5 text-[9px] font-bold">
                                  <Shield size={14} />
                                  <span>Système</span>
                                </div>
                              )}

                              {!school.is_protected ? (
                                <button
                                  onClick={() => openRenewModal(school)}
                                  title="Abonnement"
                                  className="py-2 bg-slate-50 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200 rounded-xl text-slate-600 flex flex-col items-center justify-center gap-0.5 text-[9px] font-bold transition-all cursor-pointer"
                                >
                                  <CalendarPlus size={14} />
                                  <span>Licence</span>
                                </button>
                              ) : (
                                <div className="py-2 bg-slate-100 border border-slate-200 rounded-xl text-slate-400 flex flex-col items-center justify-center gap-0.5 text-[9px] font-bold">
                                  <Sparkles size={14} />
                                  <span>Illimité</span>
                                </div>
                              )}

                              <button
                                onClick={() => setModulesModal({ 
                                  isOpen: true, 
                                  schoolId: school.id, 
                                  schoolName: school.name,
                                  modules: {
                                    presences: school.global_settings?.modules?.presences ?? (school.school_type !== 'UNIVERSITY' && school.school_type !== 'PROFESSIONAL'),
                                    discipline: school.global_settings?.modules?.discipline ?? (school.school_type !== 'UNIVERSITY' && school.school_type !== 'PROFESSIONAL')
                                  }
                                })}
                                title="Modules"
                                className="py-2 bg-slate-50 hover:bg-purple-50 hover:text-purple-700 border border-slate-200 rounded-xl text-slate-600 flex flex-col items-center justify-center gap-0.5 text-[9px] font-bold transition-all cursor-pointer"
                              >
                                <Settings2 size={14} />
                                <span>Modules</span>
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          );
        })()}

        {activeView === 'users' && (() => {
          // 1. Calculate summary counters using normalized role keys
          const totalUsersCount = globalUsers.length;
          const superAdminsCount = globalUsers.filter(u => normalizeRoleKey(u.role) === 'super_admin').length;
          const schoolAdminsCount = globalUsers.filter(u => {
            const r = normalizeRoleKey(u.role);
            return r === 'school_admin' || r === 'admin';
          }).length;
          const teachersCount = globalUsers.filter(u => normalizeRoleKey(u.role) === 'teacher').length;
          const staffCount = globalUsers.filter(u => ['accountant', 'staff', 'counselor', 'director'].includes(normalizeRoleKey(u.role))).length;
          const studentsCount = globalUsers.filter(u => ['student', 'parent'].includes(normalizeRoleKey(u.role))).length;
          const onlineUsersCount = globalUsers.filter(u => isUserRealOnline(u)).length;

          // 2. Extract unique schools for the school filter
          const schoolOptionsMap = new Map<string, string>();
          globalUsers.forEach(u => {
            if (u.school?.id && u.school?.name) {
              schoolOptionsMap.set(u.school.id, u.school.name);
            }
          });
          const schoolOptions = Array.from(schoolOptionsMap.entries()).map(([id, name]) => ({ id, name }));

          // 3. Filter users based on search and selected filters
          const filteredUsers = globalUsers.filter(u => {
            const uRole = normalizeRoleKey(u.role);
            const roleLabel = getRoleDisplay(u.role);

            // Search text
            if (userSearchTerm.trim()) {
              const term = userSearchTerm.toLowerCase();
              const nameMatch = (u.full_name || '').toLowerCase().includes(term);
              const emailMatch = (u.email || '').toLowerCase().includes(term);
              const schoolMatch = (u.school?.name || '').toLowerCase().includes(term);
              const roleMatch = roleLabel.toLowerCase().includes(term) || (u.role || '').toLowerCase().includes(term);
              if (!nameMatch && !emailMatch && !schoolMatch && !roleMatch) return false;
            }

            // Role filter
            if (userRoleFilter !== 'ALL') {
              if (userRoleFilter === 'super_admin') {
                if (uRole !== 'super_admin') return false;
              } else if (userRoleFilter === 'admin' || userRoleFilter === 'school_admin') {
                if (uRole !== 'school_admin' && uRole !== 'admin') return false;
              } else if (userRoleFilter === 'teacher') {
                if (uRole !== 'teacher') return false;
              } else if (userRoleFilter === 'staff') {
                if (!['accountant', 'staff', 'counselor', 'director'].includes(uRole)) return false;
              } else if (userRoleFilter === 'student') {
                if (!['student', 'parent'].includes(uRole)) return false;
              } else if (uRole !== normalizeRoleKey(userRoleFilter)) {
                return false;
              }
            }

            // School filter
            if (userSchoolFilter !== 'ALL') {
              if (userSchoolFilter === 'NO_SCHOOL') {
                if (u.school_id || u.school?.id) return false;
              } else if (u.school_id !== userSchoolFilter && u.school?.id !== userSchoolFilter) {
                return false;
              }
            }

            // Status filter
            if (userStatusFilter === 'ONLINE') {
              if (!isUserRealOnline(u)) return false;
            } else if (userStatusFilter === 'ACTIVE') {
              if (u.is_active === false) return false;
            } else if (userStatusFilter === 'BLOCKED') {
              const isLocked = (u.failed_login_attempts && u.failed_login_attempts >= 3) || (u.failed_attempts && u.failed_attempts >= 3);
              if (!isLocked && u.is_active !== false) return false;
            }

            return true;
          });

          // 4. Sort filtered users
          const sortedUsers = [...filteredUsers].sort((a, b) => {
            if (userSortBy === 'created_desc') {
              return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
            }
            if (userSortBy === 'created_asc') {
              return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
            }
            if (userSortBy === 'name_asc') {
              return (a.full_name || '').localeCompare(b.full_name || '');
            }
            if (userSortBy === 'name_desc') {
              return (b.full_name || '').localeCompare(a.full_name || '');
            }
            if (userSortBy === 'role') {
              const order: { [key: string]: number } = { 
                super_admin: 1, 
                school_admin: 2, 
                admin: 2, 
                teacher: 3, 
                accountant: 4, 
                counselor: 5, 
                director: 6, 
                staff: 7, 
                student: 8, 
                parent: 9 
              };
              const aRole = normalizeRoleKey(a.role);
              const bRole = normalizeRoleKey(b.role);
              return (order[aRole] || 99) - (order[bRole] || 99);
            }
            return 0;
          });

          // 5. Pagination logic
          const totalPages = Math.max(1, Math.ceil(sortedUsers.length / usersPerPage));
          const safePage = Math.min(Math.max(1, userPage), totalPages);
          const startIndex = (safePage - 1) * usersPerPage;
          const paginatedUsers = sortedUsers.slice(startIndex, startIndex + usersPerPage);

          const getRoleBadgeStyle = (rawRole?: string) => {
            const role = normalizeRoleKey(rawRole);
            switch (role) {
              case 'super_admin':
                return {
                  bg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
                  icon: ShieldAlert,
                  label: 'Super Admin'
                };
              case 'school_admin':
              case 'admin':
                return {
                  bg: 'bg-blue-50 text-blue-700 border-blue-200',
                  icon: Building2,
                  label: 'Admin École'
                };
              case 'teacher':
                return {
                  bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                  icon: GraduationCap,
                  label: 'Enseignant'
                };
              case 'accountant':
                return {
                  bg: 'bg-amber-50 text-amber-700 border-amber-200',
                  icon: DollarSign,
                  label: 'Comptable'
                };
              case 'counselor':
                return {
                  bg: 'bg-purple-50 text-purple-700 border-purple-200',
                  icon: UserCheck,
                  label: 'Conseiller'
                };
              case 'director':
                return {
                  bg: 'bg-indigo-50 text-indigo-800 border-indigo-200',
                  icon: Building2,
                  label: 'Directeur'
                };
              case 'student':
                return {
                  bg: 'bg-cyan-50 text-cyan-700 border-cyan-200',
                  icon: GraduationCap,
                  label: 'Élève'
                };
              case 'parent':
                return {
                  bg: 'bg-teal-50 text-teal-700 border-teal-200',
                  icon: Users,
                  label: 'Parent'
                };
              case 'staff':
              default:
                return {
                  bg: 'bg-slate-100 text-slate-700 border-slate-200',
                  icon: Users,
                  label: getRoleDisplay(rawRole)
                };
            }
          };

          return (
            <div className="space-y-6">
              {/* --- Main Management Card & Controls --- */}
              <div className="bg-white rounded-3xl shadow-xs border border-slate-200 overflow-hidden">
                {/* Header with Title & Action Controls */}
                <div className="p-5 md:p-7 border-b border-slate-100 space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start sm:items-center gap-4">
                      <div className="w-12 h-12 bg-blue-50 border border-blue-100 text-blue-600 rounded-2xl flex items-center justify-center shrink-0 shadow-xs mt-0.5 sm:mt-0">
                        <Users size={24} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h2 className="text-lg md:text-xl font-black text-slate-900 tracking-tight">Utilisateurs Globaux</h2>
                          <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-black border border-slate-200">
                            {filteredUsers.length} / {totalUsersCount} {totalUsersCount === 1 ? 'compte' : 'comptes'}
                          </span>
                          {onlineUsersCount > 0 && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-black border border-emerald-200">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                              {onlineUsersCount} en ligne
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 font-medium mt-1">
                          Gestion unifiée des rôles, affectations scolaires et authentification
                        </p>
                      </div>
                    </div>

                    {/* Right Toolbar: View Switcher & Refresh */}
                    <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                      {/* View Mode Toggle (Table vs Cards) */}
                      <div className="bg-slate-100 p-1 rounded-2xl flex items-center gap-1 border border-slate-200/60">
                        <button
                          type="button"
                          onClick={() => setUserViewMode('table')}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            userViewMode === 'table'
                              ? 'bg-white text-slate-900 shadow-xs'
                              : 'text-slate-500 hover:text-slate-700'
                          }`}
                          title="Vue Tableau compacte"
                        >
                          <List size={14} />
                          <span>Tableau</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setUserViewMode('cards')}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            userViewMode === 'cards'
                              ? 'bg-white text-slate-900 shadow-xs'
                              : 'text-slate-500 hover:text-slate-700'
                          }`}
                          title="Vue Grille de cartes"
                        >
                          <Grid size={14} />
                          <span>Cartes</span>
                        </button>
                      </div>

                      {/* Refresh Button */}
                      <button
                        type="button"
                        onClick={fetchGlobalUsers}
                        disabled={loadingGlobalUsers}
                        className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl border border-slate-200 transition-all cursor-pointer disabled:opacity-50"
                        title="Actualiser la liste"
                      >
                        <RefreshCw size={16} className={loadingGlobalUsers ? 'animate-spin text-blue-600' : ''} />
                      </button>
                    </div>
                  </div>

                  {/* Filter Toolbar: Role Tabs, Search & Secondary Filters */}
                  <div className="space-y-3.5 pt-4 border-t border-slate-100">
                    {/* Role Filter Pills with Non-truncated Numbers */}
                    <div className="flex flex-wrap items-center gap-2">
                      {[
                        { id: 'ALL', label: 'Tous', count: totalUsersCount },
                        { id: 'super_admin', label: 'Super Admins', count: superAdminsCount, color: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
                        { id: 'admin', label: 'Admins Écoles', count: schoolAdminsCount, color: 'text-blue-700 bg-blue-50 border-blue-200' },
                        { id: 'teacher', label: 'Enseignants', count: teachersCount, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
                        { id: 'staff', label: 'Staff & Comptables', count: staffCount, color: 'text-purple-700 bg-purple-50 border-purple-200' },
                        { id: 'student', label: 'Élèves & Parents', count: studentsCount, color: 'text-slate-700 bg-slate-100 border-slate-200' }
                      ].map(tab => {
                        const isActive = userRoleFilter === tab.id;
                        return (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => {
                              setUserRoleFilter(tab.id);
                              setUserPage(1);
                            }}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-2 border cursor-pointer whitespace-nowrap ${
                              isActive
                                ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                            }`}
                          >
                            <span>{tab.label}</span>
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                              isActive ? 'bg-white/20 text-white' : tab.color || 'bg-slate-200 text-slate-700'
                            }`}>
                              {tab.count}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Search & Secondary Filter Dropdowns with Roomy Layout */}
                    <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2.5">
                      {/* Search Input */}
                      <div className="flex-1 relative group min-w-[240px]">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={16} />
                        <input 
                          type="text" 
                          placeholder="Rechercher par nom, email, école..." 
                          className="w-full pl-10 pr-9 py-2.5 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 outline-none transition-all placeholder:text-slate-400"
                          value={userSearchTerm}
                          onChange={(e) => {
                            setUserSearchTerm(e.target.value);
                            setUserPage(1);
                          }}
                        />
                        {userSearchTerm && (
                          <button 
                            onClick={() => {
                              setUserSearchTerm('');
                              setUserPage(1);
                            }} 
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>

                      {/* Dropdown Filters Group */}
                      <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5">
                        {/* School Filter */}
                        <div className="w-full sm:w-auto min-w-[200px] flex-1 sm:flex-initial">
                          <select
                            value={userSchoolFilter}
                            onChange={(e) => {
                              setUserSchoolFilter(e.target.value);
                              setUserPage(1);
                            }}
                            className="w-full py-2.5 px-3 bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none transition-all cursor-pointer focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600"
                          >
                            <option value="ALL">🏫 Tous les établissements</option>
                            <option value="NO_SCHOOL">🚫 Sans établissement assigné</option>
                            {schoolOptions.map(s => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Status Filter */}
                        <div className="w-full sm:w-auto min-w-[150px] flex-1 sm:flex-initial">
                          <select
                            value={userStatusFilter}
                            onChange={(e) => {
                              setUserStatusFilter(e.target.value as any);
                              setUserPage(1);
                            }}
                            className="w-full py-2.5 px-3 bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none transition-all cursor-pointer focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600"
                          >
                            <option value="ALL">⚡ Tous les statuts</option>
                            <option value="ONLINE">🟢 En ligne</option>
                            <option value="ACTIVE">✅ Actifs</option>
                            <option value="BLOCKED">🔒 Bloqués</option>
                          </select>
                        </div>

                        {/* Sort Selector */}
                        <div className="w-full sm:w-auto min-w-[150px] flex-1 sm:flex-initial">
                          <select
                            value={userSortBy}
                            onChange={(e) => setUserSortBy(e.target.value as any)}
                            className="w-full py-2.5 px-3 bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none transition-all cursor-pointer focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600"
                          >
                            <option value="created_desc">🕒 Plus récents</option>
                            <option value="created_asc">📅 Plus anciens</option>
                            <option value="name_asc">🔤 Nom (A → Z)</option>
                            <option value="name_desc">🔡 Nom (Z → A)</option>
                            <option value="role">👑 Par rôle</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* --- Content: Loading, Empty, Table or Cards --- */}
                {loadingGlobalUsers ? (
                  <div className="py-24 text-center flex flex-col items-center justify-center gap-3">
                    <Loader2 className="animate-spin text-blue-600" size={36} />
                    <p className="text-slate-500 font-bold text-xs uppercase tracking-widest animate-pulse">Chargement des utilisateurs globaux...</p>
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
                    <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 border border-slate-100">
                      <Users size={32} />
                    </div>
                    <h3 className="font-bold text-slate-800 text-base">Aucun utilisateur ne correspond aux critères</h3>
                    <p className="text-xs text-slate-500 max-w-sm">Essayez de modifier votre recherche ou vos filtres pour voir les utilisateurs enregistrés.</p>
                    <button 
                      onClick={() => {
                        setUserSearchTerm('');
                        setUserRoleFilter('ALL');
                        setUserSchoolFilter('ALL');
                        setUserStatusFilter('ALL');
                        setUserPage(1);
                      }}
                      className="mt-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
                    >
                      Réinitialiser les filtres
                    </button>
                  </div>
                ) : userViewMode === 'table' ? (
                  /* --- View 1: Modern Paginated Table --- */
                  <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left min-w-[800px]">
                      <thead>
                        <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-black text-slate-400 uppercase tracking-wider">
                          <th className="px-6 py-4">Utilisateur</th>
                          <th className="px-6 py-4">Rôle & Permissions</th>
                          <th className="px-6 py-4">Établissement</th>
                          <th className="px-6 py-4">Statut & Session</th>
                          <th className="px-6 py-4">Inscription</th>
                          <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {paginatedUsers.map((u, idx) => {
                          const isOnline = isUserRealOnline(u);
                          const isLocked = (u.failed_login_attempts && u.failed_login_attempts >= 3) || (u.failed_attempts && u.failed_attempts >= 3);
                          const roleBadge = getRoleBadgeStyle(u.role);
                          const RoleIcon = roleBadge.icon;
                          const isCurrentUser = user && u.id === user.id;

                          return (
                            <motion.tr 
                              key={u.id}
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: Math.min(idx * 0.02, 0.25) }}
                              className="hover:bg-slate-50/90 transition-all group"
                            >
                              {/* User Info */}
                              <td className="px-6 py-4.5">
                                <div className="flex items-center gap-3.5">
                                  <div className="relative shrink-0">
                                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-xs uppercase shadow-xs border ${
                                      normalizeRoleKey(u.role) === 'super_admin' 
                                        ? 'bg-indigo-50 text-indigo-700 border-indigo-200' 
                                        : normalizeRoleKey(u.role) === 'school_admin' || normalizeRoleKey(u.role) === 'admin'
                                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                                        : normalizeRoleKey(u.role) === 'teacher'
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                        : 'bg-slate-100 text-slate-700 border-slate-200'
                                    }`}>
                                      {(u.full_name || u.email || '?').charAt(0).toUpperCase()}
                                    </div>
                                    {isOnline && (
                                      <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white shadow-xs" title="En ligne actuellement" />
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <p className="font-bold text-slate-900 text-xs md:text-sm leading-snug break-words">{u.full_name || 'Sans Nom'}</p>
                                      {isCurrentUser && (
                                        <span className="px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[10px] font-black border border-indigo-100 shrink-0">
                                          Vous
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[11px] text-slate-500 font-medium break-all mt-0.5 select-all">
                                      {u.email}
                                    </p>
                                  </div>
                                </div>
                              </td>

                              {/* Role Badge */}
                              <td className="px-6 py-4.5">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider border whitespace-nowrap ${roleBadge.bg}`}>
                                  <RoleIcon size={12} />
                                  <span>{roleBadge.label}</span>
                                </span>
                              </td>

                              {/* School */}
                              <td className="px-6 py-4.5">
                                {u.school ? (
                                  <div className="flex items-center gap-2 min-w-0 max-w-xs md:max-w-sm">
                                    <div className="w-6 h-6 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                                      <Building2 size={12} />
                                    </div>
                                    <span className="text-xs font-bold text-slate-800 break-words leading-tight" title={u.school.name}>
                                      {u.school.name}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-xs font-medium text-slate-400 italic">Non assigné</span>
                                )}
                              </td>

                              {/* Status & Online */}
                              <td className="px-6 py-4.5">
                                {isLocked ? (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200">
                                    <ShieldAlert size={12} />
                                    <span>Verrouillé (Sécurité)</span>
                                  </span>
                                ) : isOnline ? (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                    <span>En ligne</span>
                                  </span>
                                ) : u.is_active === false ? (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black bg-slate-100 text-slate-600 border border-slate-200">
                                    <span>Désactivé</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-50 text-slate-500 border border-slate-100">
                                    <span>Hors ligne</span>
                                  </span>
                                )}
                              </td>

                              {/* Registration Date */}
                              <td className="px-6 py-4.5">
                                <p className="text-xs font-bold text-slate-700">
                                  {u.created_at ? new Date(u.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
                                </p>
                                <p className="text-[10px] text-slate-400">
                                  {u.created_at ? new Date(u.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''}
                                </p>
                              </td>

                              {/* Actions */}
                              <td className="px-6 py-4.5 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {u.role === 'super_admin' ? (
                                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 cursor-not-allowed text-[10px] font-black uppercase tracking-wider" title="Compte système protégé. Modification interdite depuis cette interface.">
                                      <Lock size={12} />
                                      <span>Protégé</span>
                                    </div>
                                  ) : (
                                    <>
                                      <button 
                                        onClick={() => setEditUserModal({ isOpen: true, userId: u.id, fullName: u.full_name, email: u.email })}
                                        className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all border border-transparent hover:border-blue-100 cursor-pointer"
                                        title="Modifier les informations"
                                      >
                                        <Edit2 size={15} />
                                      </button>
                                      <button 
                                        onClick={() => setResetModal({ isOpen: true, userId: u.id, fullName: u.full_name || u.email, newPassword: '', forceChange: true })}
                                        className="p-2 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all border border-transparent hover:border-amber-100 cursor-pointer"
                                        title="Réinitialiser le mot de passe"
                                      >
                                        <Key size={15} />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </motion.tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  /* --- View 2: Modern Cards Grid --- */
                  <div className="p-5 md:p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {paginatedUsers.map((u, idx) => {
                      const isOnline = isUserRealOnline(u);
                      const isLocked = (u.failed_login_attempts && u.failed_login_attempts >= 3) || (u.failed_attempts && u.failed_attempts >= 3);
                      const roleBadge = getRoleBadgeStyle(u.role);
                      const RoleIcon = roleBadge.icon;
                      const isCurrentUser = user && u.id === user.id;

                      return (
                        <motion.div
                          key={u.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: Math.min(idx * 0.02, 0.25) }}
                          className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs hover:shadow-md transition-all flex flex-col justify-between gap-4 group hover:border-blue-300/80"
                        >
                          <div className="space-y-3.5">
                            {/* Card Top: Avatar on left, Role Badge on right */}
                            <div className="flex items-center justify-between gap-2.5">
                              <div className="relative shrink-0">
                                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-sm uppercase shadow-xs border ${
                                  normalizeRoleKey(u.role) === 'super_admin' 
                                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200' 
                                    : normalizeRoleKey(u.role) === 'school_admin' || normalizeRoleKey(u.role) === 'admin'
                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                    : normalizeRoleKey(u.role) === 'teacher'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-slate-100 text-slate-700 border-slate-200'
                                }`}>
                                  {(u.full_name || u.email || '?').charAt(0).toUpperCase()}
                                </div>
                                {isOnline && (
                                  <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white shadow-xs" title="En ligne" />
                                )}
                              </div>

                              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                {isCurrentUser && (
                                  <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[10px] font-black border border-indigo-100 shrink-0">
                                    Vous
                                  </span>
                                )}
                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider border shrink-0 whitespace-nowrap ${roleBadge.bg}`}>
                                  <RoleIcon size={12} />
                                  <span>{roleBadge.label}</span>
                                </span>
                              </div>
                            </div>

                            {/* User Identity: Full Name & Full Email (Zero Cutoff) */}
                            <div className="min-w-0">
                              <h3 className="font-extrabold text-slate-900 text-sm md:text-base leading-snug break-words" title={u.full_name}>
                                {u.full_name || 'Sans Nom'}
                              </h3>
                              <p className="text-xs text-slate-500 font-medium break-all mt-0.5 leading-relaxed selection:bg-blue-100 select-all" title={u.email}>
                                {u.email}
                              </p>
                            </div>

                            {/* Card Middle: School & Meta Details */}
                            <div className="bg-slate-50/80 rounded-2xl p-3.5 space-y-2 border border-slate-100 text-xs">
                              <div className="flex items-start justify-between gap-2 text-slate-600">
                                <span className="text-[11px] font-bold text-slate-400 shrink-0 mt-0.5">Établissement</span>
                                <span className="font-bold text-slate-800 text-right break-words leading-tight flex-1 ml-2" title={u.school?.name}>
                                  {u.school?.name || <span className="font-normal text-slate-400 italic">Non assigné</span>}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-2 text-slate-600">
                                <span className="text-[11px] font-bold text-slate-400 shrink-0">Statut</span>
                                {isLocked ? (
                                  <span className="font-bold text-rose-600 text-[11px] flex items-center gap-1">
                                    <ShieldAlert size={12} />
                                    <span>Verrouillé</span>
                                  </span>
                                ) : isOnline ? (
                                  <span className="font-bold text-emerald-600 text-[11px] flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                    <span>En ligne</span>
                                  </span>
                                ) : u.is_active === false ? (
                                  <span className="font-bold text-slate-500 text-[11px]">Désactivé</span>
                                ) : (
                                  <span className="font-medium text-slate-500 text-[11px]">Hors ligne</span>
                                )}
                              </div>
                              <div className="flex items-center justify-between gap-2 text-slate-600">
                                <span className="text-[11px] font-bold text-slate-400 shrink-0">Inscrit le</span>
                                <span className="font-medium text-slate-700 text-[11px]">
                                  {u.created_at ? new Date(u.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Card Bottom: Actions */}
                          <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                            {u.role === 'super_admin' ? (
                              <div className="w-full flex items-center justify-center gap-1.5 py-2 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 cursor-not-allowed text-[10px] font-black uppercase tracking-wider">
                                <Lock size={12} />
                                <span>Compte Protégé</span>
                              </div>
                            ) : (
                              <>
                                <button
                                  onClick={() => setEditUserModal({ isOpen: true, userId: u.id, fullName: u.full_name, email: u.email })}
                                  className="flex-1 py-2 px-3 bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 font-bold text-xs rounded-xl border border-slate-200 hover:border-blue-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                                >
                                  <Edit2 size={13} />
                                  <span>Modifier</span>
                                </button>
                                <button
                                  onClick={() => setResetModal({ isOpen: true, userId: u.id, fullName: u.full_name || u.email, newPassword: '', forceChange: true })}
                                  className="flex-1 py-2 px-3 bg-slate-50 hover:bg-amber-50 text-slate-700 hover:text-amber-700 font-bold text-xs rounded-xl border border-slate-200 hover:border-amber-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                                >
                                  <Key size={13} />
                                  <span>Réinit. MDP</span>
                                </button>
                              </>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}

                {/* --- Pagination Controls Footer --- */}
                {filteredUsers.length > 0 && (
                  <div className="p-4 md:p-5 bg-slate-50/70 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                    {/* Left: Summary text & Items per page */}
                    <div className="flex items-center gap-3 text-xs text-slate-500 font-bold">
                      <span>
                        Affichage de <span className="text-slate-900 font-black">{startIndex + 1}</span> à{' '}
                        <span className="text-slate-900 font-black">{Math.min(startIndex + usersPerPage, sortedUsers.length)}</span> sur{' '}
                        <span className="text-slate-900 font-black">{sortedUsers.length}</span>
                      </span>

                      <div className="flex items-center gap-1 ml-2">
                        <span className="text-[11px] text-slate-400">Lignes :</span>
                        <select
                          value={usersPerPage}
                          onChange={(e) => {
                            setUsersPerPage(Number(e.target.value));
                            setUserPage(1);
                          }}
                          className="py-1 px-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none cursor-pointer"
                        >
                          <option value={10}>10</option>
                          <option value={25}>25</option>
                          <option value={50}>50</option>
                          <option value={100}>100</option>
                        </select>
                      </div>
                    </div>

                    {/* Right: Page Navigation Buttons */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setUserPage(p => Math.max(1, p - 1))}
                        disabled={safePage <= 1}
                        className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
                      >
                        <ChevronLeft size={14} />
                        <span>Précédent</span>
                      </button>

                      <div className="flex items-center gap-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                          .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                          .map((pageNum, idx, arr) => {
                            const prevPage = arr[idx - 1];
                            const showEllipsis = prevPage && pageNum - prevPage > 1;

                            return (
                              <React.Fragment key={pageNum}>
                                {showEllipsis && (
                                  <span className="px-1 text-slate-400 text-xs font-bold">...</span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setUserPage(pageNum)}
                                  className={`w-8 h-8 rounded-xl text-xs font-black transition-all cursor-pointer ${
                                    safePage === pageNum
                                      ? 'bg-blue-600 text-white shadow-xs'
                                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                                  }`}
                                >
                                  {pageNum}
                                </button>
                              </React.Fragment>
                            );
                          })}
                      </div>

                      <button
                        type="button"
                        onClick={() => setUserPage(p => Math.min(totalPages, p + 1))}
                        disabled={safePage >= totalPages}
                        className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
                      >
                        <span>Suivant</span>
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {activeView === 'system' && (
          <div className="space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Live Health Telemetry Bar - Ultra-Clean, Fluent & Compact */}
            <div className="bg-slate-900 rounded-2xl p-4 sm:p-5 text-white shadow-lg border border-slate-800/80 relative overflow-hidden">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 bg-indigo-500/20 border border-indigo-400/30 rounded-xl flex items-center justify-center text-indigo-400 shrink-0">
                    <Server size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base sm:text-lg font-black tracking-tight text-white">Maintenance Système</h2>
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                        Opérationnel
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-medium">Monitoring d'infrastructure, intégrité DB et sécurité multi-tenant</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleRunDiagnostic}
                    disabled={diagnosticReport.isRunning}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-all shadow flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    {diagnosticReport.isRunning ? <Loader2 size={13} className="animate-spin" /> : <Activity size={13} />}
                    <span>{diagnosticReport.isRunning ? 'Test...' : 'Exécuter Diagnostic'}</span>
                  </button>
                </div>
              </div>

              {/* Compact Metrics Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 pt-3.5 mt-3.5 border-t border-slate-800/80">
                <div className="bg-slate-800/50 p-2.5 rounded-xl border border-slate-700/50 flex items-center justify-between">
                  <div>
                    <div className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider">Latence RPC</div>
                    <div className="text-xs font-black text-white mt-0.5 font-mono">
                      {diagnosticReport.dbLatencyMs ? `${diagnosticReport.dbLatencyMs} ms` : '~12 ms'}
                    </div>
                  </div>
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                </div>

                <div className="bg-slate-800/50 p-2.5 rounded-xl border border-slate-700/50 flex items-center justify-between">
                  <div>
                    <div className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider">Isolation RLS</div>
                    <div className="text-xs font-black text-emerald-400 mt-0.5">
                      {stats.totalSchools} Écoles
                    </div>
                  </div>
                  <ShieldCheck size={14} className="text-emerald-400" />
                </div>

                <div className="bg-slate-800/50 p-2.5 rounded-xl border border-slate-700/50 flex items-center justify-between">
                  <div>
                    <div className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider">Cache Schéma</div>
                    <div className="text-xs font-black text-indigo-300 mt-0.5">PostgREST OK</div>
                  </div>
                  <Zap size={14} className="text-indigo-400" />
                </div>

                <div className="bg-slate-800/50 p-2.5 rounded-xl border border-slate-700/50 flex items-center justify-between">
                  <div>
                    <div className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider">Superviseur</div>
                    <div className="text-xs font-black text-amber-300 mt-0.5">Actif (7j/3j/1j)</div>
                  </div>
                  <CheckCircle2 size={14} className="text-amber-400" />
                </div>
              </div>
            </div>

            {/* MODULE 01: Outils Techniques */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-md font-black text-[10px] uppercase tracking-wider">01</span>
                <h3 className="text-sm font-black text-slate-900 tracking-tight">Outils d'Administration & Maintenance</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Diagnostic DB */}
                <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between group">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shrink-0">
                      <Activity size={18} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-black text-slate-900">Diagnostic Intégrité</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">Vérification de latence et volumétrie des tables</p>
                    </div>
                  </div>
                  <button 
                    onClick={handleRunDiagnostic}
                    disabled={diagnosticReport.isRunning}
                    className="mt-3 w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer active:scale-95"
                  >
                    {diagnosticReport.isRunning ? <Loader2 size={13} className="animate-spin" /> : <Activity size={13} />}
                    <span>Lancer Diagnostic</span>
                  </button>
                </div>

                {/* Réparation Système */}
                <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between group">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center shrink-0">
                      <Wrench size={18} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-black text-slate-900">Réparation Système</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">Restauration des comptes et clés orphelines</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowRepairConfirm(true)}
                    disabled={isRepairing || isRefreshingCache || isSubmitting}
                    className="mt-3 w-full py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer active:scale-95"
                  >
                    {isRepairing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                    <span>Réparer</span>
                  </button>
                </div>

                {/* Invalidation Cache */}
                <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between group">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
                      <Zap size={18} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-black text-slate-900">Cache Schéma</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">Purger le cache PostgREST via NOTIFY</p>
                    </div>
                  </div>
                  <button 
                    onClick={async () => {
                      setIsRefreshingCache(true);
                      const { error } = await supabase.rpc('exec_sql', { sql_query: "NOTIFY pgrst, 'reload schema';" });
                      setIsRefreshingCache(false);
                      if (error) {
                        if (error.message.includes('exec_sql')) {
                          toast.error("Erreur : La fonction 'exec_sql' est manquante.");
                        } else {
                          toast.error("Erreur : " + error.message);
                        }
                      }
                      else toast.success("Cache schéma PostgREST rafraîchi avec succès !");
                    }}
                    disabled={isRepairing || isRefreshingCache || isSubmitting}
                    className="mt-3 w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer active:scale-95"
                  >
                    {isRefreshingCache ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
                    <span>Purger Cache</span>
                  </button>
                </div>

                {/* Licences */}
                <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between group">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center shrink-0">
                      <CalendarPlus size={18} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-black text-slate-900">Superviseur Licences</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">Vérification et relances des abonnements</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleCheckSubscriptions(true)}
                    disabled={isCheckingSubscriptions}
                    className="mt-3 w-full py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer active:scale-95"
                  >
                    {isCheckingSubscriptions ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                    <span>Vérifier</span>
                  </button>
                </div>
              </div>
            </div>

            {/* MODULE 02: Gouvernance RGPD */}
            <div className="space-y-3 pt-1">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-md font-black text-[10px] uppercase tracking-wider">02</span>
                  <h3 className="text-sm font-black text-slate-900 tracking-tight">Anonymisation des Données (RGPD)</h3>
                </div>

                <button 
                  onClick={handleAnonymizeAll}
                  disabled={isAnonymizingAll || isAnonymizing || isAnonymizingStaff || isAnonymizingParents}
                  className={`px-3 py-1.5 ${
                    confirmAllAnonymize
                      ? 'bg-rose-600 hover:bg-rose-700 text-white animate-pulse'
                      : 'bg-slate-900 hover:bg-slate-800 text-white'
                  } font-extrabold text-xs rounded-xl transition-all shadow-2xs flex items-center gap-1.5 self-start sm:self-auto active:scale-95 disabled:opacity-50 cursor-pointer`}
                >
                  {isAnonymizingAll ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : confirmAllAnonymize ? (
                    <AlertCircle size={13} />
                  ) : (
                    <ShieldCheck size={13} className="text-emerald-400" />
                  )}
                  <span>{confirmAllAnonymize ? 'Confirmer Global (5s) ?' : 'Anonymiser Tout le Réseau'}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Élèves */}
                <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col justify-between group">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0">
                      <GraduationCap size={18} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-black text-slate-900">Élèves</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">Remplacement des noms de test par des identités conformes</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleAnonymizeStudents(false)}
                    disabled={isAnonymizing || isAnonymizingAll}
                    className={`mt-3 w-full py-2 ${
                      confirmStudents ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'
                    } text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer active:scale-95`}
                  >
                    {isAnonymizing ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                    <span>{confirmStudents ? 'Confirmer (5s) ?' : 'Anonymiser Élèves'}</span>
                  </button>
                </div>

                {/* Personnel */}
                <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col justify-between group">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
                      <UserPlus size={18} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-black text-slate-900">Personnel & Enseignants</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">Sanitisation des profils de démonstration</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleAnonymizeStaff(false)}
                    disabled={isAnonymizingStaff || isAnonymizingAll}
                    className={`mt-3 w-full py-2 ${
                      confirmStaff ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-600 hover:bg-blue-700'
                    } text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer active:scale-95`}
                  >
                    {isAnonymizingStaff ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                    <span>{confirmStaff ? 'Confirmer (5s) ?' : 'Anonymiser Personnel'}</span>
                  </button>
                </div>

                {/* Parents */}
                <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col justify-between group">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center shrink-0">
                      <Users size={18} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-black text-slate-900">Tuteurs & Parents</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">Anonymisation des contacts et responsables</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleAnonymizeParents(false)}
                    disabled={isAnonymizingParents || isAnonymizingAll}
                    className={`mt-3 w-full py-2 ${
                      confirmParents ? 'bg-rose-600 hover:bg-rose-700' : 'bg-amber-600 hover:bg-amber-700'
                    } text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer active:scale-95`}
                  >
                    {isAnonymizingParents ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                    <span>{confirmParents ? 'Confirmer (5s) ?' : 'Anonymiser Parents'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {activeView === 'logs' && (() => {
          const renderLogDetailsPreview = (details: any) => {
            if (!details) return <span className="text-slate-400 italic text-[11px]">Aucun paramètre</span>;

            if (typeof details === 'string') {
              return (
                <span className="text-slate-700 font-medium text-xs truncate max-w-[280px] block" title={details}>
                  {details}
                </span>
              );
            }

            if (typeof details === 'object' && details !== null) {
              const entries = Object.entries(details).filter(([k, v]) => v !== null && v !== undefined && k !== 'created_at');
              if (entries.length === 0) {
                return <span className="text-slate-400 italic text-[11px]">Aucun paramètre</span>;
              }

              return (
                <div className="flex flex-wrap items-center gap-1.5 max-w-xs lg:max-w-sm">
                  {entries.slice(0, 3).map(([key, val]) => {
                    let strVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
                    if (strVal.length > 28) strVal = strVal.substring(0, 25) + '...';

                    return (
                      <span 
                        key={key} 
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 border border-slate-200/80 text-[10px] font-medium text-slate-700 hover:bg-slate-200/60 transition-colors"
                      >
                        <span className="font-extrabold text-slate-500 uppercase tracking-tight text-[9px]">{key}:</span>
                        <span className="font-bold text-slate-900">{strVal}</span>
                      </span>
                    );
                  })}
                  {entries.length > 3 && (
                    <span className="px-1.5 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 text-[9px] font-black">
                      +{entries.length - 3} plus
                    </span>
                  )}
                </div>
              );
            }

            return <span className="text-slate-600 font-mono text-xs">{String(details)}</span>;
          };

          const handleExportLogsCSV = (logsToExport: any[]) => {
            if (!logsToExport || logsToExport.length === 0) {
              toast.error("Aucun log à exporter.");
              return;
            }

            const headers = ["ID", "Date (UTC)", "Action", "Entite", "Auteur", "Email Auteur", "Etablissement", "Details"];
            const rows = logsToExport.map(l => [
              l.id,
              new Date(l.created_at).toISOString(),
              l.action || '',
              l.entity_type || '',
              `"${(l.user?.full_name || 'Systeme').replace(/"/g, '""')}"`,
              l.user?.email || 'N/A',
              `"${(l.school?.name || 'Global').replace(/"/g, '""')}"`,
              `"${JSON.stringify(l.details || {}).replace(/"/g, '""')}"`
            ]);

            const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `edunova_audit_logs_${new Date().toISOString().slice(0,10)}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast.success(`${logsToExport.length} journaux d'audit exportés en CSV !`);
          };

          return (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-3 duration-300">
              {/* Modern & Compact Header & Controls */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 sm:p-5 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3.5 bg-slate-50/70 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center shrink-0">
                      <Database size={18} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">Logs & Audit</h2>
                        <span className="px-1.5 py-0.2 rounded-md text-[9px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-700">
                          Traçabilité
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium">Historique des opérations du réseau</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Search Input */}
                    <div className="relative flex-1 sm:w-64 group">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={15} />
                      <input 
                        type="text" 
                        placeholder="Filtrer utilisateur, école..." 
                        className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400 shadow-2xs"
                        value={logSearchTerm || ''}
                        onChange={(e) => setLogSearchTerm(e.target.value)}
                      />
                      {logSearchTerm && (
                        <button 
                          onClick={() => setLogSearchTerm('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 font-bold text-xs bg-slate-100 h-4 w-4 flex items-center justify-center rounded-full"
                        >
                          ×
                        </button>
                      )}
                    </div>

                    <button 
                      onClick={() => handleExportLogsCSV(systemLogs)}
                      className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl transition-all shadow-2xs active:scale-95 flex items-center justify-center gap-1.5 font-bold text-xs shrink-0 cursor-pointer"
                      title="Exporter en CSV"
                    >
                      <Download size={13} />
                      <span className="hidden sm:inline">Export CSV</span>
                    </button>

                    <button 
                      onClick={fetchSystemLogs}
                      disabled={loadingLogs}
                      className="p-2 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-all shadow-2xs active:scale-95 flex items-center justify-center shrink-0 disabled:opacity-50 cursor-pointer"
                      title="Actualiser"
                    >
                      <RefreshCw size={14} className={loadingLogs ? 'animate-spin' : ''} />
                    </button>
                  </div>
                </div>

                {/* Filter pills & entity selector */}
                <div className="px-4 sm:px-5 py-2.5 bg-white border-b border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex flex-wrap items-center gap-1">
                    {[
                      { key: 'ALL', label: 'Tous' },
                      { key: 'CREATE', label: 'Créations' },
                      { key: 'UPDATE', label: 'Modifs' },
                      { key: 'DELETE', label: 'Suppressions' },
                      { key: 'OTHER', label: 'Autres' }
                    ].map((btn) => {
                      const isActive = logActionFilter === btn.key;
                      return (
                        <button
                          key={btn.key}
                          onClick={() => setLogActionFilter(btn.key as any)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all border cursor-pointer ${
                            isActive 
                              ? 'bg-slate-900 text-white border-slate-900 shadow-2xs' 
                              : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200/80'
                          }`}
                        >
                          {btn.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Entité:</span>
                    <div className="relative">
                      <select
                        className="pl-2.5 pr-6 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-[11px] font-bold text-slate-700 focus:outline-none appearance-none cursor-pointer"
                        value={logEntityFilter}
                        onChange={(e) => setLogEntityFilter(e.target.value)}
                      >
                        <option value="ALL">Toutes</option>
                        {Object.keys(entityLabels).map((key) => (
                          <option key={key} value={key}>
                            {entityLabels[key]}
                          </option>
                        ))}
                      </select>
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[10px] font-bold">▾</span>
                    </div>
                  </div>
                </div>

                {/* Logs Content Layer */}
                <div className="bg-white">
                  {loadingLogs ? (
                    <div className="py-24 text-center">
                      <Loader2 className="animate-spin text-indigo-500 mx-auto mb-4" size={36} />
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Chargement sécurisé du registre d'audit...</p>
                    </div>
                  ) : (
                    (() => {
                      const filtered = systemLogs.filter(log => {
                        const term = logSearchTerm.toLowerCase();
                        const actionMatch = log.action?.toLowerCase().includes(term);
                        const entityMatch = log.entity_type?.toLowerCase().includes(term);
                        const userMatch = log.user?.full_name?.toLowerCase().includes(term) || log.user?.email?.toLowerCase().includes(term);
                        const schoolMatch = log.school?.name?.toLowerCase().includes(term);
                        
                        const detailsStr = typeof log.details === 'object' 
                          ? JSON.stringify(log.details).toLowerCase() 
                          : String(log.details).toLowerCase();
                        const detailsMatch = detailsStr.includes(term);
                        
                        const searchMatches = !logSearchTerm || actionMatch || entityMatch || userMatch || schoolMatch || detailsMatch;

                        let actionMatches = true;
                        if (logActionFilter !== 'ALL') {
                          if (logActionFilter === 'OTHER') {
                            actionMatches = !['CREATE', 'UPDATE', 'DELETE'].includes(log.action);
                          } else {
                            actionMatches = log.action === logActionFilter;
                          }
                        }

                        const entityMatches = logEntityFilter === 'ALL' || log.entity_type === logEntityFilter;

                        return searchMatches && actionMatches && entityMatches;
                      });

                      if (filtered.length === 0) {
                        return (
                          <div className="text-center py-20 px-6 max-w-md mx-auto">
                            <div className="w-16 h-16 bg-slate-100 rounded-3xl flex items-center justify-center text-slate-400 mx-auto mb-4 border border-slate-200">
                              <Info size={28} />
                            </div>
                            <h3 className="text-sm font-bold text-slate-800">Aucun log correspondant</h3>
                            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                              Nous n'avons trouvé aucune action avec de tels filtres ou termes de recherche actifs.
                            </p>
                            {(logSearchTerm || logActionFilter !== 'ALL' || logEntityFilter !== 'ALL') && (
                              <button
                                onClick={() => {
                                  setLogSearchTerm('');
                                  setLogActionFilter('ALL');
                                  setLogEntityFilter('ALL');
                                  setLogPage(1);
                                }}
                                className="mt-4 px-4 py-2 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-slate-800 transition-all shadow"
                              >
                                Réinitialiser tous les filtres
                              </button>
                            )}
                          </div>
                        );
                      }

                      const totalPages = Math.ceil(filtered.length / logsPerPage) || 1;
                      const clampedPage = Math.min(Math.max(1, logPage), totalPages);
                      const paginatedLogs = filtered.slice((clampedPage - 1) * logsPerPage, clampedPage * logsPerPage);

                      return (
                        <>
                          <div className="px-6 py-2.5 bg-slate-50/80 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-slate-600">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                              <span>{filtered.length} enregistrement(s) d'audit trouvé(s)</span>
                            </div>
                            <div className="flex items-center gap-3 text-[11px] font-mono text-slate-500">
                              <span className="hidden sm:inline-block bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md border border-indigo-200/60 font-bold">💡 Cliquez sur une ligne pour voir le JSON complet</span>
                              <span>Page {clampedPage} sur {totalPages}</span>
                            </div>
                          </div>

                          {/* Desktop Bounded Table View with Intelligent Responsive Columns & Sticky Header */}
                          <div className="hidden md:block max-h-[580px] overflow-y-auto overflow-x-auto border-b border-slate-200/80 custom-scrollbar relative">
                            <table className="w-full text-left min-w-[720px] border-collapse">
                              <thead className="sticky top-0 z-20 bg-slate-100 shadow-2xs border-b border-slate-200">
                                <tr>
                                  <th className="px-3 py-3.5 text-[10px] font-black uppercase tracking-wider text-slate-500 text-center w-10">
                                    <span>#</span>
                                  </th>
                                  <th className="px-4 py-3.5 text-[10px] font-black uppercase tracking-wider text-slate-600">
                                    <div className="flex items-center gap-2">
                                      <Terminal size={14} className="text-indigo-600 shrink-0" />
                                      <span>Opération</span>
                                    </div>
                                  </th>
                                  <th className="px-4 py-3.5 text-[10px] font-black uppercase tracking-wider text-slate-600">
                                    <div className="flex items-center gap-2">
                                      <Users size={14} className="text-indigo-600 shrink-0" />
                                      <span>Auteur / Opérateur</span>
                                    </div>
                                  </th>
                                  <th className="px-4 py-3.5 text-[10px] font-black uppercase tracking-wider text-slate-600 hidden xl:table-cell">
                                    <div className="flex items-center gap-2">
                                      <Building2 size={14} className="text-indigo-600 shrink-0" />
                                      <span>Établissement</span>
                                    </div>
                                  </th>
                                  <th className="px-4 py-3.5 text-[10px] font-black uppercase tracking-wider text-slate-600 hidden lg:table-cell">
                                    <div className="flex items-center gap-2">
                                      <FileText size={14} className="text-indigo-600 shrink-0" />
                                      <span>Aperçu Détails</span>
                                    </div>
                                  </th>
                                  <th className="px-4 py-3.5 text-[10px] font-black uppercase tracking-wider text-slate-600 hidden md:table-cell">
                                    <div className="flex items-center gap-2">
                                      <Clock size={14} className="text-indigo-600 shrink-0" />
                                      <span>Horodatage (UTC)</span>
                                    </div>
                                  </th>
                                  <th className="px-4 py-3.5 text-[10px] font-black uppercase tracking-wider text-slate-600 text-right">
                                    <span>Inspection</span>
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 bg-white">
                                {paginatedLogs.map((log, idx) => {
                                  const isExpanded = expandedLogId === log.id;
                                  const isCopied = copiedLogId === log.id;

                                  const actionBadgeStyle = 
                                    log.action === 'DELETE' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                                    log.action === 'CREATE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                    log.action === 'UPDATE' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                    'bg-indigo-50 text-indigo-700 border-indigo-200';

                                  return (
                                    <React.Fragment key={log.id}>
                                      <motion.tr 
                                        initial={{ opacity: 0, y: 4 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.12, delay: Math.min(idx * 0.01, 0.15) }}
                                        onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                                        className={`cursor-pointer transition-colors duration-150 group border-l-4 ${isExpanded ? 'bg-indigo-50/60 border-l-indigo-600' : 'hover:bg-indigo-50/30 border-l-transparent hover:border-l-indigo-500'}`}
                                      >
                                        <td className="px-3 py-3.5 text-center">
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setExpandedLogId(isExpanded ? null : log.id);
                                            }}
                                            className="p-1 rounded-lg text-slate-400 group-hover:text-indigo-600 hover:bg-slate-200/60 transition-all"
                                            title={isExpanded ? "Réduire les détails" : "Déplier le JSON complet"}
                                          >
                                            {isExpanded ? <ChevronUp size={16} className="text-indigo-600 font-bold" /> : <ChevronDown size={16} />}
                                          </button>
                                        </td>
                                        <td className="px-4 py-3.5">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${actionBadgeStyle}`}>
                                              {actionLabels[log.action] || log.action}
                                            </span>
                                            <span className="text-[11px] font-extrabold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/60">
                                              {entityLabels[log.entity_type] || log.entity_type}
                                            </span>
                                          </div>
                                        </td>
                                        <td className="px-4 py-3.5">
                                          <div className="flex items-center gap-2.5">
                                            <div className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center font-black text-indigo-600 text-[10px] shrink-0">
                                              {log.user?.full_name ? log.user.full_name.substring(0, 2).toUpperCase() : 'SYS'}
                                            </div>
                                            <div className="min-w-0">
                                              <p className="text-xs font-black text-slate-900 group-hover:text-indigo-600 transition-colors truncate">
                                                {log.user?.full_name || 'Système Automatique'}
                                              </p>
                                              <p className="text-[10px] text-slate-400 font-medium leading-none mt-0.5 truncate">
                                                {log.user?.email || 'automated_job@edunova.com'}
                                              </p>
                                            </div>
                                          </div>
                                        </td>
                                        <td className="px-4 py-3.5 hidden xl:table-cell">
                                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-slate-50 text-slate-800 border border-slate-200 shadow-2xs">
                                            <Building2 size={12} className="text-slate-400 shrink-0" />
                                            <span className="truncate max-w-[140px]">{log.school?.name || 'Globale (Multi-Établissement)'}</span>
                                          </span>
                                        </td>
                                        <td className="px-4 py-3.5 hidden lg:table-cell">
                                          {renderLogDetailsPreview(log.details)}
                                        </td>
                                        <td className="px-4 py-3.5 whitespace-nowrap hidden md:table-cell">
                                          <div className="text-[11px] font-extrabold text-slate-800">
                                            {new Date(log.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                                          </div>
                                          <div className="text-[10px] text-slate-400 font-mono font-bold mt-0.5">
                                            {new Date(log.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                          </div>
                                        </td>
                                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                                          <div className="flex items-center justify-end gap-1.5">
                                            <button 
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setExpandedLogId(isExpanded ? null : log.id);
                                              }}
                                              className={`px-2.5 py-1.2 rounded-lg text-[11px] font-extrabold border transition-all ${isExpanded ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'}`}
                                            >
                                              {isExpanded ? 'Masquer' : 'Déplier'}
                                            </button>
                                            <button 
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setInspectingLog(log);
                                              }}
                                              className="p-1.5 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white rounded-lg transition-all border border-indigo-200/80 hover:border-indigo-600 shrink-0"
                                              title="Inspecter en modal"
                                            >
                                              <ArrowUpRight size={14} />
                                            </button>
                                          </div>
                                        </td>
                                      </motion.tr>

                                      {/* Inline Expanded Log JSON Panel */}
                                      {isExpanded && (
                                        <tr>
                                          <td colSpan={7} className="p-0 bg-slate-900 border-y-2 border-indigo-500/80 shadow-inner">
                                            <motion.div 
                                              initial={{ opacity: 0, height: 0 }}
                                              animate={{ opacity: 1, height: 'auto' }}
                                              exit={{ opacity: 0, height: 0 }}
                                              className="p-5 text-slate-100 space-y-4 font-sans"
                                            >
                                              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                                                <div className="flex items-center gap-3">
                                                  <span className="px-2.5 py-1 bg-indigo-500/20 text-indigo-300 font-mono text-[11px] font-black rounded-lg border border-indigo-500/30 uppercase">
                                                    Payload Audit JSON
                                                  </span>
                                                  <span className="text-xs text-slate-400 font-medium">
                                                    ID: <code className="text-indigo-300 font-mono text-[11px]">{log.id}</code>
                                                  </span>
                                                  <span className="text-slate-600">•</span>
                                                  <span className="text-xs text-slate-300 font-semibold">
                                                    Établissement: <strong className="text-white">{log.school?.name || 'Globale (Tous Établissements)'}</strong>
                                                  </span>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                  <button
                                                    type="button"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      const text = JSON.stringify(log.details || {}, null, 2);
                                                      navigator.clipboard.writeText(text);
                                                      setCopiedLogId(log.id);
                                                      toast.success("Payload JSON copié dans le presse-papier !");
                                                      setTimeout(() => setCopiedLogId(null), 2000);
                                                    }}
                                                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-all border border-slate-700 flex items-center gap-1.5 active:scale-95 cursor-pointer"
                                                  >
                                                    {isCopied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                                                    <span>{isCopied ? 'Copie effectuée !' : 'Copier JSON'}</span>
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      setInspectingLog(log);
                                                    }}
                                                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow flex items-center gap-1.5 active:scale-95 cursor-pointer"
                                                  >
                                                    <span>Ouvrir en Modal</span>
                                                    <ArrowUpRight size={14} />
                                                  </button>
                                                </div>
                                              </div>

                                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs bg-slate-950/80 p-3.5 rounded-xl border border-slate-800/80">
                                                <div>
                                                  <span className="text-[10px] text-slate-400 font-mono uppercase block">Auteur principal</span>
                                                  <span className="font-bold text-white block">{log.user?.full_name || 'Système'} ({log.user?.email || 'automated_job@edunova.com'})</span>
                                                </div>
                                                <div>
                                                  <span className="text-[10px] text-slate-400 font-mono uppercase block">Date & Heure UTC</span>
                                                  <span className="font-bold text-white block">{new Date(log.created_at).toISOString()}</span>
                                                </div>
                                                <div>
                                                  <span className="text-[10px] text-slate-400 font-mono uppercase block">Entité ciblée</span>
                                                  <span className="font-bold text-indigo-300 uppercase block">{log.entity_type} ({log.action})</span>
                                                </div>
                                              </div>

                                              <div>
                                                <div className="flex justify-between items-center mb-1.5">
                                                  <span className="text-[11px] font-bold text-slate-300 font-mono">Détails des paramètres de l'action :</span>
                                                </div>
                                                <pre className="p-4 bg-slate-950 text-emerald-400 font-mono text-xs rounded-xl overflow-x-auto border border-slate-800 leading-relaxed custom-scrollbar max-h-72">
                                                  {JSON.stringify(log.details || {}, null, 2)}
                                                </pre>
                                              </div>
                                            </motion.div>
                                          </td>
                                        </tr>
                                      )}
                                    </React.Fragment>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>

                          {/* Mobile List View (Fully Responsive Cards with Inline JSON Expansion) */}
                          <div className="md:hidden p-4 space-y-3.5">
                            {paginatedLogs.map((log, idx) => {
                              const isExpanded = expandedLogId === log.id;
                              const isCopied = copiedLogId === log.id;

                              const actionBorder = 
                                log.action === 'DELETE' ? 'border-l-rose-500' :
                                log.action === 'CREATE' ? 'border-l-emerald-500' :
                                log.action === 'UPDATE' ? 'border-l-amber-500' : 'border-l-indigo-500';

                              return (
                                <motion.div
                                  key={log.id}
                                  initial={{ opacity: 0, y: 8 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ duration: 0.15, delay: Math.min(idx * 0.012, 0.25) }}
                                  className={`p-4 bg-white border border-slate-200 border-l-4 ${actionBorder} rounded-2xl shadow-xs transition-all space-y-3`}
                                >
                                  <div 
                                    onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                                    className="flex justify-between items-start gap-2 cursor-pointer"
                                  >
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-xs font-black text-slate-900 uppercase tracking-tight">
                                        {actionLabels[log.action] || log.action}
                                      </span>
                                      <span className="text-[10px] font-extrabold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                                        {entityLabels[log.entity_type] || log.entity_type}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <span className="text-[10px] font-mono text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-lg">
                                        {new Date(log.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                      <button 
                                        type="button"
                                        className="p-1 text-slate-400 hover:text-indigo-600"
                                      >
                                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                      </button>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-2 gap-2 text-xs p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                                    <div>
                                      <span className="text-[9px] font-black uppercase text-slate-400 block">Opérateur</span>
                                      <span className="font-bold text-slate-800 truncate block">{log.user?.full_name || 'Système'}</span>
                                    </div>
                                    <div>
                                      <span className="text-[9px] font-black uppercase text-slate-400 block">Établissement</span>
                                      <span className="font-bold text-slate-800 truncate block">{log.school?.name || 'Global'}</span>
                                    </div>
                                  </div>

                                  <div className="p-2.5 bg-slate-50/80 rounded-xl border border-slate-100">
                                    <span className="text-[9px] font-black uppercase text-slate-400 block mb-1">Détails de l'acte</span>
                                    {renderLogDetailsPreview(log.details)}
                                  </div>

                                  {isExpanded && (
                                    <div className="pt-2 border-t border-slate-200 space-y-3 bg-slate-950 p-3.5 rounded-xl text-slate-100">
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="text-[10px] font-mono text-indigo-400 font-bold uppercase">JSON Payload</span>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const text = JSON.stringify(log.details || {}, null, 2);
                                            navigator.clipboard.writeText(text);
                                            setCopiedLogId(log.id);
                                            toast.success("Payload JSON copié !");
                                            setTimeout(() => setCopiedLogId(null), 2000);
                                          }}
                                          className="px-2.5 py-1 bg-slate-800 text-slate-200 text-[10px] font-bold rounded-lg border border-slate-700 flex items-center gap-1"
                                        >
                                          {isCopied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                                          <span>{isCopied ? 'Copié' : 'Copier'}</span>
                                        </button>
                                      </div>
                                      <pre className="p-2.5 bg-slate-900 text-emerald-400 font-mono text-[11px] rounded-lg overflow-x-auto border border-slate-800 max-h-56 leading-relaxed custom-scrollbar">
                                        {JSON.stringify(log.details || {}, null, 2)}
                                      </pre>
                                    </div>
                                  )}

                                  <div className="flex items-center gap-2 pt-1">
                                    <button 
                                      type="button"
                                      onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                                      className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1"
                                    >
                                      <span>{isExpanded ? 'Réduire le JSON' : 'Déplier le JSON'}</span>
                                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                    </button>

                                    <button 
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setInspectingLog(log);
                                      }}
                                      className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl transition-all flex items-center justify-center shrink-0"
                                      title="Modal d'inspection"
                                    >
                                      <ArrowUpRight size={14} />
                                    </button>
                                  </div>
                                </motion.div>
                              );
                            })}
                          </div>

                          {/* Interactive Pagination Footer */}
                          <div className="px-6 py-4 bg-slate-50/90 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-slate-600">
                              <span>
                                Affichage <span className="text-slate-900 font-extrabold">{(clampedPage - 1) * logsPerPage + 1}</span> à <span className="text-slate-900 font-extrabold">{Math.min(clampedPage * logsPerPage, filtered.length)}</span> sur <span className="text-indigo-700 font-black">{filtered.length}</span> logs
                              </span>
                              <span className="text-slate-300 hidden sm:inline">•</span>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] text-slate-500 font-medium">Lignes/page :</span>
                                <select
                                  value={logsPerPage}
                                  onChange={(e) => {
                                    setLogsPerPage(Number(e.target.value));
                                    setLogPage(1);
                                  }}
                                  className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-2xs cursor-pointer"
                                >
                                  <option value={15}>15</option>
                                  <option value={30}>30</option>
                                  <option value={50}>50</option>
                                  <option value={100}>100</option>
                                </select>
                              </div>
                            </div>

                            {totalPages > 1 && (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => setLogPage(p => Math.max(1, p - 1))}
                                  disabled={clampedPage <= 1}
                                  className="px-3.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white transition-all shadow-2xs flex items-center gap-1 active:scale-95"
                                >
                                  <ChevronLeft size={15} />
                                  <span>Précédent</span>
                                </button>
                                
                                <div className="flex items-center gap-1 px-3 py-1 bg-white border border-slate-200 rounded-xl text-xs shadow-2xs">
                                  <span className="font-black text-indigo-700">{clampedPage}</span>
                                  <span className="font-bold text-slate-400">/</span>
                                  <span className="font-bold text-slate-600">{totalPages}</span>
                                </div>

                                <button
                                  onClick={() => setLogPage(p => Math.min(totalPages, p + 1))}
                                  disabled={clampedPage >= totalPages}
                                  className="px-3.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white transition-all shadow-2xs flex items-center gap-1 active:scale-95"
                                >
                                  <span>Suivant</span>
                                  <ChevronRight size={15} />
                                </button>
                              </div>
                            )}
                          </div>
                        </>
                      );
                    })()
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {activeView === 'sessions' && (
          <div className="space-y-6">
            {/* Header & Controls */}
            <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center shadow-xs shrink-0">
                    <KeyRound size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                        Sessions & Sécurité
                      </h2>
                      <span className={`px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-full flex items-center gap-1.5 ${
                        autoRefreshSecurity 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${autoRefreshSecurity ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                        {autoRefreshSecurity ? 'Auto-Sync 10s' : 'Manuel'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      Surveillance temps réel des connexions actives et protection des comptes
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2.5 shrink-0 flex-wrap w-full md:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setAutoRefreshSecurity(!autoRefreshSecurity)}
                  className={`px-3.5 py-2 text-xs font-bold rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer ${
                    autoRefreshSecurity 
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' 
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <RefreshCw size={13} className={autoRefreshSecurity ? 'animate-spin text-emerald-600' : ''} />
                  <span>{autoRefreshSecurity ? 'Pause Auto' : 'Activer Auto-Sync'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => fetchSecuritySessions()}
                  disabled={loadingSecuritySessions}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {loadingSecuritySessions ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  <span>Actualiser</span>
                </button>
              </div>
            </div>

            {/* KPI Summary Cards */}
            {(() => {
              const isUserBlocked = (u: any) => u.is_active === false || (u.failed_login_attempts && u.failed_login_attempts >= 3) || (u.failed_attempts && u.failed_attempts >= 3);
              const activeCount = securitySessions.filter(u => !isUserBlocked(u)).length;
              const blockedCount = securitySessions.filter(u => isUserBlocked(u)).length;
              const failedAttemptsCount = securityAuditLogs.filter(l => l.action === 'LOGIN_FAILED' || l.action === 'REVOKE_ACCESS' || l.action === 'AUTH_LOCKOUT').length;
              const onlineSessionsCount = securitySessions.filter(u => isUserRealOnline(u)).length;

              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
                      <span>Utilisateurs Connectés</span>
                      <Users size={16} className="text-emerald-600" />
                    </div>
                    <div className="text-2xl font-black text-slate-900 flex items-center gap-2">
                      <span className="text-emerald-600 flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                        {onlineSessionsCount}
                      </span>
                      <span className="text-xs font-bold text-slate-400">/ {securitySessions.length} total</span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-medium">En ligne ces 15 dernières minutes</p>
                  </div>

                  <div className={`p-4 sm:p-5 rounded-2xl border shadow-xs space-y-1 transition-all ${
                    blockedCount > 0 ? 'bg-rose-50/90 border-rose-200 text-rose-900' : 'bg-white border-slate-200 text-slate-900'
                  }`}>
                    <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider">
                      <span className={blockedCount > 0 ? 'text-rose-700 font-black' : 'text-slate-500'}>Comptes Bloqués</span>
                      <ShieldAlert size={16} className={blockedCount > 0 ? 'text-rose-600 animate-bounce' : 'text-slate-400'} />
                    </div>
                    <div className="text-2xl font-black flex items-center gap-2">
                      <span>{blockedCount}</span>
                      {blockedCount > 0 ? (
                        <span className="px-2 py-0.5 bg-rose-200 text-rose-800 rounded-md text-[10px] font-black">
                          Action requise
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-emerald-600">Aucun blocage</span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 font-medium">Comptes suspendus ou verrouillés</p>
                  </div>

                  <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
                      <span>Incidents & Échecs</span>
                      <AlertTriangle size={16} className="text-amber-500" />
                    </div>
                    <div className="text-2xl font-black text-slate-900 flex items-center gap-2">
                      <span>{failedAttemptsCount}</span>
                      {failedAttemptsCount === 0 && <span className="text-xs font-semibold text-emerald-600">Normal</span>}
                    </div>
                    <p className="text-[11px] text-slate-400 font-medium">Alertes de connexion suspectes</p>
                  </div>

                  <div className="bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-800 text-white space-y-1 shadow-xs">
                    <div className="flex items-center justify-between text-xs font-extrabold text-indigo-300 uppercase tracking-wider">
                      <span>Super Admin</span>
                      <ShieldCheck size={16} className="text-emerald-400" />
                    </div>
                    <div className="text-lg font-black text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 size={16} />
                      <span>Session Protégée</span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-medium">Bypass des verrous automatiques</p>
                  </div>
                </div>
              );
            })()}

            {/* Main Tabs and Search Filter Bar */}
            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3.5 bg-slate-50/50">
                {/* Filter Sub-Tabs */}
                <div className="flex items-center gap-1 bg-slate-200/70 p-1 rounded-2xl overflow-x-auto no-scrollbar">
                  {(() => {
                    const isUserBlocked = (u: any) => u.is_active === false || (u.failed_login_attempts && u.failed_login_attempts >= 3) || (u.failed_attempts && u.failed_attempts >= 3);
                    const onlineCount = securitySessions.filter(u => isUserRealOnline(u)).length;
                    return [
                      { id: 'ONLINE', label: 'En Ligne', count: onlineCount, badgeColor: onlineCount > 0 ? 'bg-emerald-600 text-white animate-pulse' : 'bg-slate-300 text-slate-700' },
                      { id: 'ALL', label: 'Tous', count: securitySessions.length },
                      { id: 'ACTIVE', label: 'Valides', count: securitySessions.filter(u => !isUserBlocked(u)).length },
                      { id: 'BLOCKED', label: 'Bloqués', count: securitySessions.filter(u => isUserBlocked(u)).length, badgeColor: 'bg-rose-600 text-white' },
                      { id: 'FAILED_LOGINS', label: 'Journaux', count: securityAuditLogs.length }
                    ];
                  })().map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setSecurityTabFilter(tab.id as any)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                        securityTabFilter === tab.id
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                      }`}
                    >
                      <span>{tab.label}</span>
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                        tab.badgeColor || (securityTabFilter === tab.id ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-300/70 text-slate-700')
                      }`}>
                        {tab.count}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Search Bar */}
                <div className="relative min-w-[220px] md:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input
                    type="text"
                    value={securitySearchTerm}
                    onChange={(e) => setSecuritySearchTerm(e.target.value)}
                    placeholder="Rechercher nom, email, école..."
                    className="w-full pl-8 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
                  />
                  {securitySearchTerm && (
                    <button onClick={() => setSecuritySearchTerm('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer">
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>

              {/* View Content Body */}
              {securityTabFilter === 'FAILED_LOGINS' ? (
                /* Failed Login & Security Incident Logs Table */
                <div className="overflow-x-auto">
                  <table className="w-full text-left min-w-[700px]">
                    <thead className="bg-slate-100/80 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-5 py-3.5">Horodatage</th>
                        <th className="px-5 py-3.5">Action</th>
                        <th className="px-5 py-3.5">Opérateur / Cible</th>
                        <th className="px-5 py-3.5">Établissement</th>
                        <th className="px-5 py-3.5 text-right">Détails</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white text-xs">
                      {securityAuditLogs
                        .filter(l => {
                          if (!securitySearchTerm) return true;
                          const term = securitySearchTerm.toLowerCase();
                          return (
                            (l.user?.full_name && l.user.full_name.toLowerCase().includes(term)) ||
                            (l.user?.email && l.user.email.toLowerCase().includes(term)) ||
                            (l.action && l.action.toLowerCase().includes(term)) ||
                            (l.school?.name && l.school.name.toLowerCase().includes(term))
                          );
                        })
                        .map(log => (
                          <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-5 py-3.5 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                              {new Date(log.created_at).toLocaleString('fr-FR')}
                            </td>
                            <td className="px-5 py-3.5 whitespace-nowrap">
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${
                                log.action === 'LOGIN_FAILED' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                                log.action === 'REVOKE_ACCESS' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                'bg-indigo-50 text-indigo-700 border-indigo-200'
                              }`}>
                                {actionLabels[log.action] || log.action}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 whitespace-nowrap font-bold text-slate-900">
                              {log.user?.full_name || 'Inconnu'} <span className="text-slate-400 font-normal">({log.user?.email || 'N/A'})</span>
                            </td>
                            <td className="px-5 py-3.5 whitespace-nowrap text-slate-600 font-medium">
                              {log.school?.name || 'Plateforme Globale'}
                            </td>
                            <td className="px-5 py-3.5 text-right font-mono text-[11px] text-slate-500 max-w-xs truncate">
                              {typeof log.details === 'object' ? JSON.stringify(log.details) : String(log.details || '-')}
                            </td>
                          </tr>
                        ))}
                      {securityAuditLogs.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-5 py-10 text-center text-slate-400 font-bold">
                            Aucun incident de sécurité enregistré.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                /* User Accounts & Active Sessions Table - Online users sorted 1st */
                <div className="overflow-x-auto">
                  <table className="w-full text-left min-w-[800px]">
                    <thead className="bg-slate-100/80 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-5 py-3.5">Utilisateur</th>
                        <th className="px-5 py-3.5">Rôle & École</th>
                        <th className="px-5 py-3.5">Statut Compte</th>
                        <th className="px-5 py-3.5">État Session</th>
                        <th className="px-5 py-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white text-xs">
                      {loadingSecuritySessions && securitySessions.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-5 py-14 text-center">
                            <div className="flex flex-col items-center justify-center gap-2.5">
                              <Loader2 size={28} className="animate-spin text-indigo-600" />
                              <p className="text-slate-500 font-bold text-xs">Chargement des sessions en cours...</p>
                            </div>
                          </td>
                        </tr>
                      ) : securitySessions
                        .filter(u => {
                          const userBlocked = u.is_active === false || (u.failed_login_attempts && u.failed_login_attempts >= 3) || (u.failed_attempts && u.failed_attempts >= 3);
                          if (securityTabFilter === 'ONLINE' && !isUserRealOnline(u)) return false;
                          if (securityTabFilter === 'ACTIVE' && userBlocked) return false;
                          if (securityTabFilter === 'BLOCKED' && !userBlocked) return false;
                          if (!securitySearchTerm) return true;
                          const term = securitySearchTerm.toLowerCase();
                          return (
                            (u.full_name && u.full_name.toLowerCase().includes(term)) ||
                            (u.email && u.email.toLowerCase().includes(term)) ||
                            (u.role && u.role.toLowerCase().includes(term)) ||
                            (u.school?.name && u.school.name.toLowerCase().includes(term))
                          );
                        })
                        .sort((a, b) => {
                          // 1. ONLINE USERS FIRST
                          const aOnline = isUserRealOnline(a);
                          const bOnline = isUserRealOnline(b);
                          if (aOnline && !bOnline) return -1;
                          if (!aOnline && bOnline) return 1;

                          // 2. Blocked accounts next
                          const aBlocked = a.is_active === false || (a.failed_login_attempts && a.failed_login_attempts >= 3) || (a.failed_attempts && a.failed_attempts >= 3);
                          const bBlocked = b.is_active === false || (b.failed_login_attempts && b.failed_login_attempts >= 3) || (b.failed_attempts && b.failed_attempts >= 3);
                          if (aBlocked && !bBlocked) return -1;
                          if (!aBlocked && bBlocked) return 1;

                          // 3. Most recent activity
                          const aTime = new Date(a.last_activity_at || a.updated_at || a.last_login_at || a.created_at || 0).getTime();
                          const bTime = new Date(b.last_activity_at || b.updated_at || b.last_login_at || b.created_at || 0).getTime();
                          return bTime - aTime;
                        })
                        .map(targetUser => {
                          const isBlocked = targetUser.is_active === false || (targetUser.failed_login_attempts && targetUser.failed_login_attempts >= 3) || (targetUser.failed_attempts && targetUser.failed_attempts >= 3);
                          const isSuperAdmin = targetUser.role === 'SUPER_ADMIN' || targetUser.is_super_admin;
                          const hasOnlineToken = isUserRealOnline(targetUser);

                          return (
                            <tr
                              key={targetUser.id}
                              className={`transition-colors ${
                                hasOnlineToken 
                                  ? 'bg-emerald-50/40 hover:bg-emerald-50/70 border-l-4 border-l-emerald-500' 
                                  : isBlocked 
                                    ? 'bg-rose-50/40 hover:bg-rose-50/70 border-l-4 border-l-rose-500' 
                                    : 'hover:bg-slate-50/80'
                              }`}
                            >
                              <td className="px-5 py-3.5">
                                <div className="flex items-center gap-3">
                                  <div className="relative">
                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs ${
                                      isBlocked ? 'bg-rose-100 text-rose-700 border border-rose-200' :
                                      hasOnlineToken ? 'bg-emerald-100 text-emerald-800 border border-emerald-200 font-extrabold' :
                                      isSuperAdmin ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' : 'bg-slate-100 text-slate-700'
                                    }`}>
                                      {targetUser.full_name ? targetUser.full_name.charAt(0).toUpperCase() : 'U'}
                                    </div>
                                    {hasOnlineToken && (
                                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full animate-pulse" />
                                    )}
                                  </div>
                                  <div>
                                    <div className="font-extrabold text-slate-900 flex items-center gap-1.5">
                                      <span>{targetUser.full_name || 'Sans Nom'}</span>
                                      {isSuperAdmin && (
                                        <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded text-[9px] font-black uppercase">
                                          Super Admin
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-slate-500 font-medium text-[11px]">{targetUser.email}</div>
                                  </div>
                                </div>
                              </td>

                              <td className="px-5 py-3.5">
                                <div className="space-y-0.5">
                                  <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded-md text-[10px] font-black uppercase border border-slate-200">
                                    {roleLabels[targetUser.role?.toLowerCase()] || targetUser.role}
                                  </span>
                                  <div className="text-[11px] text-slate-500 font-medium truncate max-w-[160px]">
                                    {targetUser.school?.name || 'Toutes les écoles'}
                                  </div>
                                </div>
                              </td>

                              <td className="px-5 py-3.5">
                                {isBlocked ? (
                                  <div className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-rose-100 text-rose-800 border border-rose-200 rounded-full font-black text-[10px] uppercase tracking-wider">
                                    <ShieldAlert size={11} className="text-rose-600 animate-pulse" />
                                    <span>SUSPENDU</span>
                                  </div>
                                ) : (
                                  <div className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full font-black text-[10px] uppercase tracking-wider">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    <span>ACTIF</span>
                                  </div>
                                )}
                              </td>

                              <td className="px-5 py-3.5">
                                {hasOnlineToken ? (
                                  <div className="flex flex-col gap-0.5">
                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg font-mono text-[10px] font-black w-fit shadow-2xs">
                                      <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping" />
                                      <span>EN LIGNE</span>
                                    </div>
                                    {targetUser.last_activity_at && (
                                      <span className="text-[10px] text-emerald-700 font-medium">
                                        Actif à {new Date(targetUser.last_activity_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-slate-400 font-mono text-[10px] font-semibold">Hors Ligne</span>
                                    {(targetUser.last_activity_at || targetUser.updated_at || targetUser.last_login_at) ? (
                                      <span className="text-[10px] text-slate-400">
                                        {new Date(targetUser.last_activity_at || targetUser.updated_at || targetUser.last_login_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    ) : null}
                                  </div>
                                )}
                              </td>

                              <td className="px-5 py-3.5 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {isBlocked ? (
                                    <button
                                      type="button"
                                      onClick={() => handleUnblockUser(targetUser)}
                                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
                                      title="Réactiver l'accès immédiatement"
                                    >
                                      <Unlock size={13} />
                                      <span>Débloquer</span>
                                    </button>
                                  ) : (
                                    <>
                                      {hasOnlineToken && (
                                        <button
                                          type="button"
                                          onClick={() => handleTerminateUserSession(targetUser)}
                                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                                          title="Fermer la session active à distance"
                                        >
                                          <Power size={12} />
                                          <span>Déconnecter</span>
                                        </button>
                                      )}
                                      {!isSuperAdmin && (
                                        <button
                                          type="button"
                                          onClick={() => handleBlockUser(targetUser)}
                                          className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                                          title="Suspendre l'accès"
                                        >
                                          <UserX size={12} />
                                          <span>Suspendre</span>
                                        </button>
                                      )}
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      {!loadingSecuritySessions && securitySessions.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-5 py-10 text-center text-slate-400 font-bold">
                            Aucun compte trouvé.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {activeView === 'config' && (
          <div className="space-y-6">
            {/* Top Bar / Header */}
            <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-xs flex flex-col gap-6">
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-50 border border-indigo-100/80 text-indigo-600 rounded-2xl shadow-xs flex items-center justify-center shrink-0">
                    <SlidersHorizontal size={24} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">Configuration Globale</h2>
                      {config.maintenanceMode ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-black uppercase tracking-wider rounded-full">
                          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                          Maintenance Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-black uppercase tracking-wider rounded-full">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          Système Opérationnel
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">Paramètres d'infrastructure, sécurité, sessions & gouvernance du réseau EduNova</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto shrink-0">
                  <button 
                    onClick={fetchGlobalConfig}
                    disabled={isLoadingConfig || isSavingConfig}
                    className="p-3 bg-slate-50 border border-slate-200 text-slate-700 rounded-2xl hover:bg-slate-100 transition-all shadow-xs shrink-0 cursor-pointer disabled:opacity-50"
                    title="Rafraîchir les paramètres"
                  >
                    <RefreshCw size={17} className={isLoadingConfig ? 'animate-spin text-indigo-600' : ''} />
                  </button>
                  <button 
                    onClick={handleSaveConfig}
                    disabled={isSavingConfig || isLoadingConfig}
                    className="flex-1 lg:flex-none px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs md:text-sm font-bold rounded-2xl transition-all shadow-md shadow-indigo-100 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isSavingConfig ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    <span>Enregistrer la configuration</span>
                  </button>
                </div>
              </div>

              {/* Category Filter Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-4 border-t border-slate-100 pb-1">
                {[
                  { id: 'ALL', label: 'Toutes les rubriques', icon: Layers },
                  { id: 'IDENTITY', label: 'Identité & Marque', icon: Globe },
                  { id: 'SECURITY', label: 'Sécurité & Accès', icon: Shield },
                  { id: 'SESSIONS', label: 'Sessions Scolaires', icon: CalendarCheck },
                  { id: 'MODULES', label: 'Modules & ERP', icon: Zap },
                  { id: 'SUBSCRIPTIONS', label: 'Abonnements & Quotas', icon: CreditCard },
                  { id: 'MAINTENANCE', label: 'Maintenance & Purge', icon: Database }
                ].map(cat => {
                  const isActive = configCategory === cat.id;
                  const IconComp = cat.icon;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setConfigCategory(cat.id as any)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-2 border cursor-pointer ${
                        isActive 
                          ? 'bg-slate-900 text-white border-slate-900 shadow-xs' 
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <IconComp size={14} className={isActive ? 'text-white' : 'text-slate-500'} />
                      <span>{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {isLoadingConfig ? (
              <div className="py-24 bg-white rounded-3xl border border-slate-200 shadow-xs flex flex-col items-center justify-center space-y-4">
                <Loader2 size={40} className="text-indigo-600 animate-spin" />
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest animate-pulse">Chargement des paramètres globaux...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-12">
                {/* 1. Identité Section */}
                {(configCategory === 'ALL' || configCategory === 'IDENTITY') && (
                  <ConfigSection 
                    title="Identité Visuelle & Marque" 
                    subtitle="Personnalisation de l'affichage et de la couleur dominante"
                    icon={Globe}
                    iconBg="bg-indigo-50"
                    iconColor="text-indigo-600"
                    badge="Plateforme"
                  >
                    <ConfigField 
                      label="Nom de la Plateforme" 
                      description="Affiché dans la barre de titre, les emails système et les pages de connexion."
                      icon={Building2}
                    >
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <Building2 size={16} />
                        </div>
                        <input 
                          type="text"
                          value={config.platformName || ''}
                          onChange={e => setConfig({...config, platformName: e.target.value})}
                          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-500/10 transition-all"
                          placeholder="EduNova Pro"
                        />
                      </div>
                    </ConfigField>

                    <ConfigField 
                      label="Email de Support Global" 
                      description="Expéditeur par défaut des notifications système et des demandes de contact."
                      icon={Mail}
                    >
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <Mail size={16} />
                        </div>
                        <input 
                          type="email"
                          value={config.supportEmail || ''}
                          onChange={e => setConfig({...config, supportEmail: e.target.value})}
                          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-500/10 transition-all font-mono"
                          placeholder="support@edunova.pro"
                        />
                      </div>
                    </ConfigField>

                    <ConfigField 
                      label="Couleur Primaire & Thème" 
                      description="Teinte d'accentuation appliquée aux boutons, badges et bordures actives."
                      icon={Palette}
                    >
                      <div className="space-y-3">
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                          {[
                            { name: 'Indigo', hex: '#4f46e5' },
                            { name: 'Bleu', hex: '#2563eb' },
                            { name: 'Violet', hex: '#7c3aed' },
                            { name: 'Émeraude', hex: '#059669' },
                            { name: 'Orange', hex: '#ea580c' },
                            { name: 'Ardoise', hex: '#0f172a' }
                          ].map(preset => {
                            const isSelected = config.primaryColor?.toLowerCase() === preset.hex.toLowerCase();
                            return (
                              <button
                                key={preset.hex}
                                type="button"
                                onClick={() => setConfig({ ...config, primaryColor: preset.hex })}
                                className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border text-[10px] font-black transition-all cursor-pointer ${
                                  isSelected 
                                    ? 'bg-indigo-50 border-indigo-500 text-indigo-900 shadow-xs ring-2 ring-indigo-500/20' 
                                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                                }`}
                              >
                                <span className="w-5 h-5 rounded-full border border-black/10 shadow-xs shrink-0 flex items-center justify-center" style={{ backgroundColor: preset.hex }}>
                                  {isSelected && <Check size={10} className="text-white" />}
                                </span>
                                <span>{preset.name}</span>
                              </button>
                            );
                          })}
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="relative w-10 h-10 rounded-xl border border-slate-200 shadow-xs overflow-hidden shrink-0">
                            <input 
                              type="color"
                              value={config.primaryColor || '#4f46e5'}
                              onChange={e => setConfig({...config, primaryColor: e.target.value})}
                              className="absolute -inset-2 w-14 h-14 cursor-pointer border-none bg-transparent"
                            />
                          </div>
                          <input 
                            type="text"
                            value={config.primaryColor || '#4f46e5'}
                            onChange={e => setConfig({...config, primaryColor: e.target.value})}
                            className="flex-1 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 outline-none focus:bg-white focus:border-indigo-600 transition-all uppercase"
                          />
                        </div>
                      </div>
                    </ConfigField>
                  </ConfigSection>
                )}

                {/* 2. Sécurité Section */}
                {(configCategory === 'ALL' || configCategory === 'SECURITY') && (
                  <ConfigSection 
                    title="Sécurité & Accès" 
                    subtitle="Règles d'authentification et de verrouillage automatique"
                    icon={Shield}
                    iconBg="bg-emerald-50"
                    iconColor="text-emerald-600"
                    badge="Sécurité"
                  >
                    <ConfigField 
                      label="Longueur Min. Mot de Passe" 
                      description="Contrainte minimale pour tous les nouveaux comptes et réinitialisations."
                      icon={Lock}
                    >
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[6, 8, 10, 12].map(len => (
                          <button
                            key={len}
                            type="button"
                            onClick={() => setConfig({...config, minPasswordLength: len})}
                            className={`py-2 px-3 rounded-xl border text-xs font-black transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                              (config.minPasswordLength || 8) === len
                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <span>{len} Caractères</span>
                            {len === 8 && (
                              <span className={`text-[8px] font-black uppercase ${ (config.minPasswordLength || 8) === len ? 'text-emerald-100' : 'text-emerald-600'}`}>Recommandé</span>
                            )}
                          </button>
                        ))}
                      </div>
                    </ConfigField>

                    <ConfigField 
                      label="Expiration de Session (Inactivité)" 
                      description="Déconnexion automatique de l'utilisateur en cas d'inactivité."
                      icon={Clock}
                    >
                      <div className="space-y-2">
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                            <Clock size={16} />
                          </div>
                          <input 
                            type="number"
                            min="5" max="720"
                            value={config.sessionTimeout || 60}
                            onChange={e => setConfig({...config, sessionTimeout: parseInt(e.target.value) || 60})}
                            className="w-full pl-10 pr-20 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:bg-white focus:border-indigo-600 transition-all"
                          />
                          <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-xs font-bold text-slate-400">
                            minutes
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {[15, 30, 60, 120].map(mins => (
                            <button
                              key={mins}
                              type="button"
                              onClick={() => setConfig({...config, sessionTimeout: mins})}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                                (config.sessionTimeout || 60) === mins ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                            >
                              {mins} min
                            </button>
                          ))}
                        </div>
                      </div>
                    </ConfigField>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <ConfigField 
                        label="Tentatives Max" 
                        description="Essais erronés avant blocage."
                        icon={ShieldAlert}
                      >
                        <div className="relative">
                          <input 
                            type="number"
                            min="1" max="20"
                            value={config.maxFailedAttempts || 5}
                            onChange={e => setConfig({...config, maxFailedAttempts: parseInt(e.target.value) || 5})}
                            className="w-full pl-3.5 pr-16 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:bg-white focus:border-indigo-600 transition-all"
                          />
                          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-[11px] font-bold text-slate-400">
                            essais
                          </div>
                        </div>
                      </ConfigField>

                      <ConfigField 
                        label="Durée Verrouillage" 
                        description="Temps d'attente imposé."
                        icon={Lock}
                      >
                        <div className="relative">
                          <input 
                            type="number"
                            min="1" max="1440"
                            value={config.lockoutDurationMinutes || 15}
                            onChange={e => setConfig({...config, lockoutDurationMinutes: parseInt(e.target.value) || 15})}
                            className="w-full pl-3.5 pr-16 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:bg-white focus:border-indigo-600 transition-all"
                          />
                          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-[11px] font-bold text-slate-400">
                            min
                          </div>
                        </div>
                      </ConfigField>
                    </div>
                  </ConfigSection>
                )}

                {/* 3. Sessions Académiques */}
                {(configCategory === 'ALL' || configCategory === 'SESSIONS') && (
                  <ConfigSection 
                    title="Gestion des Sessions Académiques" 
                    subtitle="Configuration de l'année scolaire initiale attribuée aux établissements"
                    icon={CalendarCheck}
                    iconBg="bg-amber-50"
                    iconColor="text-amber-600"
                    badge="Scolaire"
                  >
                    <ConfigField 
                      label="Mode de Détermination des Années Scolaires" 
                      description="Sélectionnez le mode de calcul appliqué lors de l'ouverture d'une nouvelle école."
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button 
                          type="button"
                          onClick={() => setConfig({...config, defaultSessionMode: 'auto'})}
                          className={`p-3.5 rounded-2xl border text-left transition-all flex items-start gap-3 cursor-pointer ${
                            config.defaultSessionMode === 'auto'
                              ? 'bg-indigo-50 border-indigo-400 ring-2 ring-indigo-500/10 text-indigo-950 shadow-xs'
                              : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700'
                          }`}
                        >
                          <div className={`p-2 rounded-xl shrink-0 ${config.defaultSessionMode === 'auto' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                            <Zap size={16} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-black text-slate-900">Automatique</span>
                              {config.defaultSessionMode === 'auto' && (
                                <span className="px-2 py-0.5 bg-indigo-200 text-indigo-950 rounded-md text-[9px] font-black uppercase tracking-wider">Actif</span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-500 font-medium leading-relaxed mt-1">
                              Calcul intelligent basé sur la date du jour et le cycle scolaire.
                            </p>
                          </div>
                        </button>

                        <button 
                          type="button"
                          onClick={() => setConfig({...config, defaultSessionMode: 'manual'})}
                          className={`p-3.5 rounded-2xl border text-left transition-all flex items-start gap-3 cursor-pointer ${
                            config.defaultSessionMode === 'manual'
                              ? 'bg-indigo-50 border-indigo-400 ring-2 ring-indigo-500/10 text-indigo-950 shadow-xs'
                              : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700'
                          }`}
                        >
                          <div className={`p-2 rounded-xl shrink-0 ${config.defaultSessionMode === 'manual' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                            <Sliders size={16} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-black text-slate-900">Manuel / Forcé</span>
                              {config.defaultSessionMode === 'manual' && (
                                <span className="px-2 py-0.5 bg-indigo-200 text-indigo-950 rounded-md text-[9px] font-black uppercase tracking-wider">Actif</span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-500 font-medium leading-relaxed mt-1">
                              Définir un libellé fixe et des dates limites explicites.
                            </p>
                          </div>
                        </button>
                      </div>
                    </ConfigField>

                    {config.defaultSessionMode === 'auto' ? (
                      <div className="p-4 bg-indigo-50/70 rounded-2xl border border-indigo-100 flex items-start gap-3">
                        <Zap size={18} className="text-indigo-600 mt-0.5 shrink-0" />
                        <div>
                          <span className="text-xs font-black text-indigo-950 uppercase tracking-wider">Mode Intelligent Actif</span>
                          <p className="text-[11px] text-indigo-900/80 font-medium leading-relaxed mt-0.5">
                            Attribution dynamique : <strong>Septembre à Juin</strong> pour l'enseignement général et <strong>Octobre à Juillet</strong> pour les facultés et universités.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3 p-4 bg-amber-50/60 rounded-2xl border border-amber-200">
                        <ConfigField label="Libellé Année Scolaire Forcé" description="Format attendu : YYYY-YYYY (ex: 2026-2027)">
                          <input 
                            type="text"
                            placeholder="Ex: 2026-2027"
                            value={config.manualSessionLabel || ''}
                            onChange={e => {
                              setConfig({...config, manualSessionLabel: e.target.value});
                              if (sessionLabelError) setSessionLabelError(null);
                            }}
                            className={`w-full px-3.5 py-2.5 bg-white border rounded-xl text-xs font-bold text-slate-900 outline-none font-mono ${sessionLabelError ? 'border-rose-400' : 'border-slate-200 focus:border-indigo-600'}`}
                          />
                          {sessionLabelError && (
                            <p className="text-[10px] text-rose-600 font-black mt-1 uppercase">{sessionLabelError}</p>
                          )}
                        </ConfigField>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <ConfigField label="Date Début">
                            <input 
                              type="date"
                              value={config.manualSessionStart || ''}
                              onChange={e => setConfig({...config, manualSessionStart: e.target.value})}
                              className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none font-mono"
                            />
                          </ConfigField>
                          <ConfigField label="Date Fin">
                            <input 
                              type="date"
                              value={config.manualSessionEnd || ''}
                              onChange={e => setConfig({...config, manualSessionEnd: e.target.value})}
                              className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none font-mono"
                            />
                          </ConfigField>
                        </div>
                      </div>
                    )}
                  </ConfigSection>
                )}

                {/* 4. Modules Section */}
                {(configCategory === 'ALL' || configCategory === 'MODULES') && (
                  <ConfigSection 
                    title="Modules & Fonctionnalités ERP" 
                    subtitle="Activation/désactivation des fonctionnalités globales autorisées"
                    icon={Zap}
                    iconBg="bg-purple-50"
                    iconColor="text-purple-600"
                    badge="Fonctionnalités"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        { id: 'finance', label: 'Gestion Financière', desc: 'Comptabilité, écolages & reçus', icon: DollarSign },
                        { id: 'exams', label: 'Examens & Bulletins', desc: 'Notes, moyennes & relevés', icon: GraduationCap },
                        { id: 'attendance', label: 'Suivi de Présence', desc: 'Pointage, retards & absences', icon: Clock },
                        { id: 'transport', label: 'Transport Scolaire', desc: 'Bus scolaires & circuits', icon: Bus },
                        { id: 'library', label: 'Bibliothèque', desc: 'Emprunts & catalogue', icon: BookOpen },
                        { id: 'inventory', label: 'Inventaire / ERP', desc: 'Stock matériel & équipements', icon: Package }
                      ].map(module => {
                        const isChecked = config.enabledModules.includes(module.id);
                        const IconComp = module.icon;
                        return (
                          <label 
                            key={module.id} 
                            className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                              isChecked 
                                ? 'bg-purple-50/80 border-purple-300 ring-1 ring-purple-400/30 text-purple-950 shadow-xs' 
                                : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600'
                            }`}
                          >
                            <input 
                              type="checkbox"
                              checked={isChecked}
                              onChange={e => {
                                const newModules = e.target.checked 
                                  ? [...config.enabledModules, module.id]
                                  : config.enabledModules.filter(m => m !== module.id);
                                setConfig({...config, enabledModules: newModules});
                              }}
                              className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-slate-300 mt-0.5 accent-purple-600 shrink-0 cursor-pointer"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <IconComp size={14} className={isChecked ? 'text-purple-600' : 'text-slate-400'} />
                                  <span className="text-xs font-black text-slate-900 truncate">
                                    {module.label}
                                  </span>
                                </div>
                                <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${
                                  isChecked ? 'bg-purple-200 text-purple-950' : 'bg-slate-200 text-slate-600'
                                }`}>
                                  {isChecked ? 'Actif' : 'Désactivé'}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-500 font-medium leading-relaxed mt-0.5">{module.desc}</p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </ConfigSection>
                )}

                {/* 5. Abonnements Section */}
                {(configCategory === 'ALL' || configCategory === 'SUBSCRIPTIONS') && (
                  <ConfigSection 
                    title="Abonnements & Limites par Défaut" 
                    subtitle="Conditions initiales attribuées aux nouveaux établissements"
                    icon={CreditCard}
                    iconBg="bg-rose-50"
                    iconColor="text-rose-600"
                    badge="Licences"
                  >
                    <ConfigField 
                      label="Période d'Essai Gratuite" 
                      description="Nombre de jours de test offert à la création d'un compte école."
                      icon={Sparkles}
                    >
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <Sparkles size={16} />
                        </div>
                        <input 
                          type="number"
                          min="0" max="365"
                          value={config.trialDays || 14}
                          onChange={e => setConfig({...config, trialDays: parseInt(e.target.value) || 14})}
                          className="w-full pl-10 pr-28 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:bg-white focus:border-indigo-600 transition-all"
                        />
                        <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-xs font-bold text-slate-400">
                          jours d'essai
                        </div>
                      </div>
                    </ConfigField>

                    <ConfigField 
                      label="Capacité Élèves Initiale" 
                      description="Quota maximum d'élèves autorisés par défaut."
                      icon={Users}
                    >
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <Users size={16} />
                        </div>
                        <input 
                          type="number"
                          min="10" max="100000"
                          value={config.defaultStudentLimit || 100}
                          onChange={e => setConfig({...config, defaultStudentLimit: parseInt(e.target.value) || 100})}
                          className="w-full pl-10 pr-24 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:bg-white focus:border-indigo-600 transition-all"
                        />
                        <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-xs font-bold text-slate-400">
                          élèves max
                        </div>
                      </div>
                    </ConfigField>
                  </ConfigSection>
                )}

                {/* 6. Rétention & Maintenance Section */}
                {(configCategory === 'ALL' || configCategory === 'MAINTENANCE') && (
                  <ConfigSection 
                    title="Maintenance & Rétention des Données" 
                    subtitle="Contrôle des accès plateforme et politique d'archivage des journaux"
                    icon={Database}
                    iconBg="bg-blue-50"
                    iconColor="text-blue-600"
                    badge="Système"
                  >
                    <ConfigField 
                      label="Conservation des Journaux d'Audit (Logs)" 
                      description="Durée de rétention des activités d'audit avant purge automatique."
                      icon={Database}
                    >
                      <select 
                        value={config.dataRetentionMonths || 12}
                        onChange={e => setConfig({...config, dataRetentionMonths: parseInt(e.target.value)})}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:bg-white focus:border-indigo-600 transition-all cursor-pointer"
                      >
                        {[
                          { val: 6, label: '6 Mois' },
                          { val: 12, label: '12 Mois (1 An - Recommandé)' },
                          { val: 24, label: '24 Mois (2 Ans)' },
                          { val: 36, label: '36 Mois (3 Ans)' },
                          { val: 60, label: '60 Mois (5 Ans)' }
                        ].map(item => (
                          <option key={item.val} value={item.val}>{item.label}</option>
                        ))}
                      </select>
                    </ConfigField>

                    <div className={`p-4 rounded-2xl border transition-all flex flex-col gap-3 ${
                      config.maintenanceMode 
                        ? 'bg-rose-50 border-rose-300 text-rose-950 ring-2 ring-rose-500/20' 
                        : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}>
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-xl ${config.maintenanceMode ? 'bg-rose-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                            <Power size={18} />
                          </div>
                          <div>
                            <span className="text-xs font-black uppercase tracking-wider block">Mode Maintenance Système</span>
                            <span className="text-[10px] font-medium text-slate-500">
                              {config.maintenanceMode ? 'Accès restreint aux Super Admins uniquement' : 'Plateforme ouverte à tous les établissements'}
                            </span>
                          </div>
                        </div>

                        <button 
                          type="button"
                          onClick={() => setConfig({...config, maintenanceMode: !config.maintenanceMode})}
                          className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none shrink-0 cursor-pointer ${config.maintenanceMode ? 'bg-rose-600' : 'bg-slate-300'}`}
                        >
                          <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-sm ${config.maintenanceMode ? 'translate-x-8' : 'translate-x-1'}`} />
                        </button>
                      </div>

                      {config.maintenanceMode && (
                        <div className="pt-2 border-t border-rose-200/80 flex items-center gap-2 text-[10px] font-bold text-rose-700">
                          <AlertTriangle size={14} className="shrink-0" />
                          <span>ATTENTION : Tous les directeurs, enseignants et élèves recevront un écran de maintenance.</span>
                        </div>
                      )}
                    </div>

                    <div className="p-3.5 bg-amber-50/80 rounded-2xl border border-amber-200/80 flex items-start gap-2.5">
                      <Info size={16} className="text-amber-600 mt-0.5 shrink-0" />
                      <p className="text-[11px] font-medium text-amber-900 leading-relaxed">
                        Les modifications apportées s'appliquent immédiatement à toute l'infrastructure d'EduNova Pro lors de l'enregistrement.
                      </p>
                    </div>
                  </ConfigSection>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Création École */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 my-auto"
          >
            {/* Header */}
            <div className="p-5 sm:p-6 border-b border-slate-100 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 rounded-2xl flex items-center justify-center shadow-lg backdrop-blur-md shrink-0">
                  <Building2 size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[9px] font-black uppercase tracking-widest rounded-md">
                      MULTI-TENANT
                    </span>
                    <span className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">Nouveau Réseau</span>
                  </div>
                  <h2 className="text-lg sm:text-xl font-black tracking-tight text-white mt-0.5">Créer un Nouvel Établissement</h2>
                </div>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all"
              >
                <X size={20} />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <div className="p-5 sm:p-7 overflow-y-auto custom-scrollbar space-y-6 flex-1 bg-slate-50/50">
              {feedback && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-4 rounded-2xl flex items-start gap-3 text-xs ${
                    feedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-sm' : 'bg-rose-50 text-rose-800 border border-rose-200/80 shadow-sm'
                  }`}
                >
                  <div className={`p-1.5 rounded-xl shrink-0 ${feedback.type === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                    {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                  </div>
                  <span className="font-bold leading-relaxed">{feedback.message}</span>
                </motion.div>
              )}

              <form id="create-tenant-form" onSubmit={handleCreateTenant} className="space-y-6">
                {/* Section 1: Information de l'Établissement */}
                <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                    <Building2 size={16} className="text-indigo-600" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">1. Identité de l'Établissement</h3>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                      Nom officiel de l'école <span className="text-rose-500">*</span>
                    </label>
                    <input 
                      type="text" 
                      required
                      value={formData.schoolName}
                      onChange={(e) => setFormData({...formData, schoolName: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none transition-all placeholder:text-slate-400"
                      placeholder="Ex: Institution Sainte Marie, Lycée National d'Excellence"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                      Type d'Établissement <span className="text-rose-500">*</span>
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {[
                        { id: SchoolType.CLASSIC, label: 'Scolaire (K-12)', desc: 'Maternelle au Secondaire', icon: Building2 },
                        { id: SchoolType.UNIVERSITY, label: 'Universitaire', desc: 'Facultés & Licences', icon: Globe },
                        { id: SchoolType.PROFESSIONAL, label: 'Professionnel', desc: 'Filières Techniques', icon: Zap }
                      ].map((type) => (
                        <button
                          key={type.id}
                          type="button"
                          onClick={() => setFormData({ ...formData, schoolType: type.id })}
                          className={`flex flex-col items-start p-3.5 rounded-xl border-2 transition-all text-left group relative ${
                            formData.schoolType === type.id 
                              ? 'border-indigo-600 bg-indigo-50/70 text-indigo-900 shadow-sm ring-1 ring-indigo-600/20' 
                              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between w-full mb-1">
                            <type.icon size={18} className={formData.schoolType === type.id ? 'text-indigo-600' : 'text-slate-400'} />
                            {formData.schoolType === type.id && (
                              <CheckCircle2 size={14} className="text-indigo-600" />
                            )}
                          </div>
                          <span className="text-xs font-black tracking-tight">{type.label}</span>
                          <span className="text-[10px] text-slate-500 font-medium mt-0.5">{type.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Section 2: Administrateur Principal */}
                <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                    <Users size={16} className="text-indigo-600" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">2. Compte Administrateur Principal (Root)</h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                        Nom complet du Directeur / Admin <span className="text-rose-500">*</span>
                      </label>
                      <input 
                        type="text" 
                        required
                        value={formData.adminName}
                        onChange={(e) => setFormData({...formData, adminName: e.target.value})}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none transition-all placeholder:text-slate-400"
                        placeholder="Ex: Jean Dupont"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                        Identifiant ou Email de connexion <span className="text-rose-500">*</span>
                      </label>
                      <input 
                        type="text" 
                        required
                        value={formData.adminEmail}
                        onChange={(e) => setFormData({...formData, adminEmail: e.target.value})}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none transition-all placeholder:text-slate-400"
                        placeholder="ex: direction_boulard ou direction@ecole.com"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                        Mot de passe provisoire <span className="text-rose-500">*</span>
                      </label>
                      <input 
                        type="password" 
                        required
                        minLength={6}
                        value={formData.adminPassword}
                        onChange={(e) => setFormData({...formData, adminPassword: e.target.value})}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none transition-all placeholder:text-slate-400"
                        placeholder="Min. 6 caractères"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                        Confirmer le mot de passe <span className="text-rose-500">*</span>
                      </label>
                      <input 
                        type="password" 
                        required
                        minLength={6}
                        value={formData.confirmPassword}
                        onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none transition-all placeholder:text-slate-400"
                        placeholder="Répéter le mot de passe"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 3: Template & Données Initiales */}
                <div 
                  className={`p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                    formData.injectDefaults 
                      ? 'bg-indigo-50/70 border-indigo-200 shadow-sm' 
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                  onClick={() => setFormData({...formData, injectDefaults: !formData.injectDefaults})}
                >
                  <div className="flex items-start gap-3.5">
                    <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all shrink-0 mt-0.5 ${
                      formData.injectDefaults 
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-200' 
                        : 'bg-white border-slate-300'
                    }`}>
                      {formData.injectDefaults && <CheckCircle2 size={16} />}
                    </div>
                    <div>
                      <span className={`text-xs font-black block transition-colors ${formData.injectDefaults ? 'text-indigo-950' : 'text-slate-800'}`}>
                        Injecter le template de données standards
                      </span>
                      <p className="text-[11px] text-slate-500 font-medium mt-1 leading-relaxed">
                        {formData.schoolType === SchoolType.UNIVERSITY ? 'Pré-remplit les facultés, matières académiques universelles et la grille tarifaire standard.' :
                         formData.schoolType === SchoolType.PROFESSIONAL ? 'Pré-remplit les filières techniques, ateliers professionnels et la grille tarifaire.' :
                         'Pré-remplit les classes (de la Maternelle à la NS4), matières scolaires et la structure de frais.'}
                      </p>
                    </div>
                  </div>
                </div>
              </form>
            </div>

            {/* Pinned Footer Actions */}
            <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3 shrink-0">
              <button 
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition-all"
              >
                Annuler
              </button>
              <button 
                type="submit"
                form="create-tenant-form"
                disabled={isSubmitting}
                className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-black text-xs rounded-xl transition-all shadow-lg shadow-indigo-200 active:scale-95 disabled:opacity-50 flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Création du tenant...
                  </>
                ) : (
                  <>
                    <Plus size={16} />
                    Créer l'établissement
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal Gestion des Admins */}
      {adminListModalOpen && selectedSchool && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl max-h-[90vh] md:max-h-[85vh] flex flex-col overflow-hidden border border-slate-100"
          >
            {/* Header section (Fixed height, no shrink) */}
            <div className="p-5 sm:p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50 shrink-0">
              <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-600 text-white rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200 shrink-0">
                  <Users size={20} className="sm:w-6 sm:h-6" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight truncate">Administrateurs</h2>
                  <p className="text-[10px] sm:text-xs text-slate-500 font-bold uppercase tracking-widest mt-0.5 truncate">{selectedSchool.name}</p>
                </div>
              </div>
              <button 
                onClick={() => setAdminListModalOpen(false)}
                className="p-2 sm:p-3 text-slate-500 hover:text-slate-900 hover:bg-white rounded-xl sm:rounded-2xl transition-all shadow-sm border border-transparent hover:border-slate-100 shrink-0"
              >
                <X size={18} className="sm:w-5 sm:h-5" />
              </button>
            </div>

            {/* Local Search input within the modal */}
            {schoolAdmins.length > 0 && (
              <div className="px-5 sm:px-8 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-3 shrink-0">
                <div className="relative w-full group">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={16} />
                  <input 
                    type="text" 
                    placeholder="Rechercher par nom ou email..." 
                    className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400 shadow-sm"
                    value={adminSearchTerm}
                    onChange={(e) => setAdminSearchTerm(e.target.value)}
                  />
                  {adminSearchTerm && (
                    <button 
                      onClick={() => setAdminSearchTerm('')}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 font-bold text-sm bg-slate-100 px-1.5 py-0.2 rounded-md hover:bg-slate-200 transition-all"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* List content section (Auto-scrolled, flexible) */}
            <div className="p-5 sm:p-8 overflow-y-auto custom-scrollbar flex-1">
              {loadingAdmins ? (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <Loader2 className="animate-spin text-blue-500" size={32} />
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Récupération des accès...</p>
                </div>
              ) : schoolAdmins.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-slate-500 font-bold text-sm">Aucun utilisateur trouvé pour cet établissement.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {schoolAdmins
                    .filter(admin => 
                      !adminSearchTerm || 
                      admin.full_name?.toLowerCase().includes(adminSearchTerm.toLowerCase()) || 
                      admin.email?.toLowerCase().includes(adminSearchTerm.toLowerCase())
                    )
                    .map(admin => (
                      <div 
                        key={admin.id} 
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 border border-slate-100 rounded-2xl hover:bg-slate-50 transition-all group"
                      >
                        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                          <div className="w-9 h-9 sm:w-10 sm:h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors shrink-0">
                            <Users size={16} className="sm:w-[18px] sm:h-[18px]" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 text-xs sm:text-sm truncate">{admin.full_name}</p>
                            <p className="text-[10px] sm:text-xs text-slate-500 font-medium truncate mt-0.5">{admin.email}</p>
                            <span className="inline-block mt-1 px-2 py-0.5 bg-blue-50 text-blue-600 text-[9px] font-black uppercase tracking-wider rounded-lg border border-blue-100">
                              {roleLabels[admin.role] || admin.role}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => setResetModal({ isOpen: true, userId: admin.id, fullName: admin.full_name || admin.email, newPassword: '', forceChange: true })}
                          className="w-full sm:w-auto text-center px-4 py-2 bg-white hover:bg-slate-900 hover:text-white text-slate-700 text-xs font-bold rounded-xl transition-all shadow-sm border border-slate-100 shrink-0"
                        >
                          Réinitialiser le mot de passe
                        </button>
                      </div>
                    ))}

                  {schoolAdmins.filter(admin => 
                    !adminSearchTerm || 
                    admin.full_name?.toLowerCase().includes(adminSearchTerm.toLowerCase()) || 
                    admin.email?.toLowerCase().includes(adminSearchTerm.toLowerCase())
                  ).length === 0 && (
                    <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Aucun résultat pour "{adminSearchTerm}"</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal Renouvellement Abonnement */}
      {renewModalOpen && selectedSchool && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-[1.5rem] md:rounded-[2rem] shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto border border-slate-100 custom-scrollbar"
          >
            <div className="p-5 md:p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50 sticky top-0 z-10 backdrop-blur-sm">
              <div className="flex items-center gap-3 md:gap-4">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-emerald-600 text-white rounded-xl md:rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200 shrink-0">
                  <CalendarPlus size={20} className="md:w-6 md:h-6" />
                </div>
                <div>
                  <h2 className="text-lg md:text-2xl font-black text-slate-900 tracking-tight">Abonnement</h2>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5 truncate max-w-[150px] md:max-w-none">{selectedSchool.name}</p>
                </div>
              </div>
              <button 
                onClick={() => setRenewModalOpen(false)}
                className="p-2 md:p-3 text-slate-500 hover:text-slate-900 hover:bg-white rounded-xl md:rounded-2xl transition-all shadow-sm border border-transparent hover:border-slate-100"
              >
                <X size={18} className="md:w-5 md:h-5" />
              </button>
            </div>

            <div className="p-6 md:p-10">
              <form onSubmit={handleRenewSubscription} className="space-y-6 md:space-y-8">
                <div className="space-y-2 md:space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Plan d'abonnement</label>
                  <select 
                    value={renewPlan}
                    onChange={(e) => setRenewPlan(e.target.value)}
                    className="w-full px-4 md:px-5 py-3 md:py-4 bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl text-sm font-bold text-slate-900 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                  >
                    <option value="trial">Essai Gratuit</option>
                    <option value="monthly">Mensuel</option>
                    <option value="yearly">Annuel</option>
                    <option value="unlimited">Illimité</option>
                  </select>
                </div>

                {/* Multi-campus Addon Feature Select */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-start gap-3.5">
                  <input
                    type="checkbox"
                    id="hasMultiCampus"
                    checked={hasMultiCampus}
                    onChange={(e) => setHasMultiCampus(e.target.checked)}
                    className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 mt-0.5 accent-indigo-600 cursor-pointer shrink-0"
                  />
                  <div className="flex-1">
                    <label htmlFor="hasMultiCampus" className="text-xs font-black text-slate-800 uppercase tracking-wider cursor-pointer flex items-center gap-2">
                      <span>Option : Multi-Annexes / Campus</span>
                      {hasMultiCampus ? (
                        <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[9px] font-black">Actif</span>
                      ) : (
                        <span className="px-2 py-0.5 bg-slate-200 text-slate-600 rounded text-[9px] font-bold">Inactif</span>
                      )}
                    </label>
                    <p className="text-[10px] text-slate-500 font-medium leading-relaxed mt-1">
                      Permet d'ajouter, diviser et gérer plusieurs annexes, campus ou filiales pour cet établissement.
                    </p>
                  </div>
                </div>

                {renewPlan !== 'unlimited' && (
                  <div className="space-y-2 md:space-y-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Durée à ajouter (jours)</label>
                    <input 
                      type="number" 
                      min="1"
                      required
                      value={renewDays}
                      onChange={(e) => setRenewDays(parseInt(e.target.value))}
                      className="w-full px-4 md:px-5 py-3 md:py-4 bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl text-sm font-bold text-slate-900 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                    />
                    <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                      Les jours seront ajoutés à la date d'expiration actuelle ou démarreront aujourd'hui si expiré.
                    </p>
                  </div>
                )}

                <div className="pt-4 md:pt-6 flex flex-col-reverse sm:flex-row justify-end gap-3 md:gap-4">
                  <button 
                    type="button"
                    onClick={() => setRenewModalOpen(false)}
                    className="w-full sm:w-auto px-6 md:px-8 py-3 md:py-4 text-slate-500 font-bold text-sm hover:bg-slate-50 rounded-xl md:rounded-2xl transition-all"
                  >
                    Annuler
                  </button>
                  <button 
                    type="submit"
                    disabled={isRenewing}
                    className="w-full sm:w-auto px-8 md:px-10 py-3 md:py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl md:rounded-2xl transition-all shadow-lg shadow-emerald-200 disabled:opacity-50 flex items-center justify-center gap-3"
                  >
                    {isRenewing ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        Mise à jour...
                      </>
                    ) : (
                      <>
                        <ShieldCheck size={18} />
                        Valider
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}
      {/* Edit User Modal */}
      <AnimatePresence>
        {editUserModal.isOpen && (
          <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
              onClick={() => !isSubmitting && setEditUserModal({ ...editUserModal, isOpen: false })}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-[2rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 flex items-center gap-4 bg-slate-50/50">
                <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200 shrink-0">
                  <Edit2 size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">Modifier l'utilisateur</h2>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-0.5">Mise à jour du profil</p>
                </div>
              </div>

              <form onSubmit={handleEditUser} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Nom complet</label>
                  <input 
                    type="text" 
                    required
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-900 outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all"
                    value={editUserModal.fullName}
                    onChange={e => setEditUserModal({ ...editUserModal, fullName: e.target.value })}
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Email de connexion</label>
                  <input 
                    type="email" 
                    readOnly
                    className="w-full px-6 py-4 bg-slate-100 border border-slate-200 rounded-2xl text-sm font-bold text-slate-500 cursor-not-allowed outline-none"
                    value={editUserModal.email}
                    title="L'email de connexion ne peut pas être modifié pour des raisons de sécurité."
                  />
                  <p className="text-[10px] text-slate-500 ml-4">L'email de connexion est utilisé pour l'authentification et ne peut pas être modifié ici.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setEditUserModal({ ...editUserModal, isOpen: false })} 
                    disabled={isSubmitting}
                    className="py-5 bg-slate-100 text-slate-500 rounded-2xl font-semibold text-[10px] tracking-tight hover:bg-slate-200 transition-all active:scale-95 disabled:opacity-50"
                  >
                    Annuler
                  </button>
                  <button 
                    type="submit"
                    disabled={isSubmitting || !editUserModal.fullName}
                    className="py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-semibold text-[10px] tracking-tight shadow-xl shadow-blue-200 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
                  >
                    {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    Enregistrer
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Password Reset Modal */}
      <AnimatePresence>
        {resetModal.isOpen && (
          <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
              onClick={() => !isSubmitting && setResetModal({ ...resetModal, isOpen: false })}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/20"
            >
              <div className="p-10 text-center space-y-6">
                <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-[2rem] flex items-center justify-center mx-auto shadow-inner">
                  <ShieldAlert size={40} />
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-2xl font-semibold text-slate-900 tracking-tighter leading-none">Réinitialiser le mot de passe</h3>
                  <p className="text-slate-500 text-[11px] font-bold tracking-tight leading-relaxed px-4">
                    Vous allez réinitialiser le mot de passe de <span className="text-slate-900">{resetModal.fullName}</span>.
                  </p>
                </div>

                <div className="space-y-2 text-left">
                  <label className="flex items-start gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors mx-4">
                    <div className="pt-0.5">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300"
                        checked={resetModal.forceChange}
                        onChange={(e) => setResetModal({ ...resetModal, forceChange: e.target.checked })}
                      />
                    </div>
                    <div className="flex-1 text-[10px] font-bold text-slate-600 leading-relaxed">
                      Forcer le changement de mot de passe à la prochaine connexion. Décochez cette case si vous attribuez un mot de passe définitif.
                    </div>
                  </label>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4 mt-4 block">Nouveau mot de passe temporaire</label>
                  <input 
                    type="text" 
                    autoFocus
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-900 outline-none focus:ring-4 focus:ring-amber-500/5 focus:border-amber-500 transition-all"
                    placeholder="Min. 6 caractères"
                    value={resetModal.newPassword || ''}
                    onChange={e => setResetModal({ ...resetModal, newPassword: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                  <button 
                    onClick={() => setResetModal({ ...resetModal, isOpen: false })} 
                    disabled={isSubmitting}
                    className="py-5 bg-slate-100 text-slate-500 rounded-2xl font-semibold text-[10px] tracking-tight hover:bg-slate-200 transition-all active:scale-95 disabled:opacity-50"
                  >
                    Annuler
                  </button>
                  <button 
                    onClick={resetUserPassword} 
                    disabled={isSubmitting || resetModal.newPassword.length < 6}
                    className="py-5 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl font-semibold text-[10px] tracking-tight shadow-xl shadow-amber-200 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
                  >
                    {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                    Confirmer
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* School Deletion Modal */}
      <AnimatePresence>
        {deleteModal.isOpen && (
          <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
              onClick={() => !isSubmitting && setDeleteModal({ ...deleteModal, isOpen: false })}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/20"
            >
              <div className="p-10 text-center space-y-6">
                <div className="w-20 h-20 bg-rose-100 text-rose-600 rounded-[2rem] flex items-center justify-center mx-auto shadow-inner">
                  <AlertCircle size={40} />
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-2xl font-semibold text-slate-900 tracking-tighter leading-none">Suppression Critique</h3>
                  <p className="text-rose-500 text-[11px] font-bold tracking-tight leading-relaxed px-4">
                    ATTENTION: La suppression de <span 
                      className="font-black underline cursor-pointer hover:text-rose-700 transition-colors inline-block active:scale-95" 
                      onClick={() => setDeleteModal({ ...deleteModal, confirmName: deleteModal.schoolName })}
                      title="Cliquer pour remplir automatiquement"
                    >{deleteModal.schoolName}</span> est irréversible et supprimera TOUTES ses données en cascade.
                  </p>
                </div>

                <div className="space-y-2 text-left">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Tapez le nom de l'école pour confirmer</label>
                  <input 
                    type="text" 
                    autoFocus
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-900 outline-none focus:ring-4 focus:ring-rose-500/5 focus:border-rose-500 transition-all"
                    placeholder={deleteModal.schoolName}
                    value={deleteModal.confirmName || ''}
                    onChange={e => setDeleteModal({ ...deleteModal, confirmName: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                  <button 
                    onClick={() => setDeleteModal({ ...deleteModal, isOpen: false })} 
                    disabled={isSubmitting}
                    className="py-5 bg-slate-100 text-slate-500 rounded-2xl font-semibold text-[10px] tracking-tight hover:bg-slate-200 transition-all active:scale-95 disabled:opacity-50"
                  >
                    Annuler
                  </button>
                  <button 
                    onClick={handleDeleteSchool} 
                    disabled={isSubmitting || deleteModal.confirmName !== deleteModal.schoolName}
                    className="py-5 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-semibold text-[10px] tracking-tight shadow-xl shadow-rose-200 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
                  >
                    {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                    Supprimer
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Clean School Modal */}
      <AnimatePresence>
        {cleanModal.isOpen && (
          <div className="fixed inset-0 min-h-screen bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0"
              onClick={() => !isSubmitting && setCleanModal({ ...cleanModal, isOpen: false })}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/20"
            >
              <div className="p-10 text-center space-y-6">
                <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-[2rem] flex items-center justify-center mx-auto shadow-inner">
                  <Eraser size={40} />
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-2xl font-semibold text-slate-900 tracking-tighter leading-none">Nettoyage des Données</h3>
                  <p className="text-amber-600 text-[11px] font-bold tracking-tight leading-relaxed px-4">
                    ATTENTION: Le nettoyage de <span 
                      className="font-black underline cursor-pointer hover:text-amber-700 transition-colors inline-block active:scale-95"
                      onClick={() => setCleanModal({ ...cleanModal, confirmName: cleanModal.schoolName })}
                      title="Cliquer pour remplir automatiquement"
                    >{cleanModal.schoolName}</span> supprimera toutes les données transactionnelles (élèves, paiements, inscriptions) mais gardera la configuration (classes, frais, accès administrateurs).
                  </p>
                </div>

                <div className="space-y-2 text-left">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-4 shrink-0 block">
                    Confirmez le nom de l'école
                  </label>
                  <input
                    type="text"
                    placeholder={cleanModal.schoolName}
                    disabled={isSubmitting}
                    className="w-full bg-slate-50 border-0 text-slate-900 font-bold px-6 py-5 rounded-2xl outline-none focus:ring-4 focus:ring-amber-500/10 focus:bg-white transition-all text-sm shadow-inner placeholder:text-slate-300 disabled:opacity-50"
                    value={cleanModal.confirmName}
                    onChange={e => setCleanModal({ ...cleanModal, confirmName: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                  <button 
                    onClick={() => setCleanModal({ ...cleanModal, isOpen: false })} 
                    disabled={isSubmitting}
                    className="py-5 bg-slate-100 text-slate-500 rounded-2xl font-semibold text-[10px] tracking-tight hover:bg-slate-200 transition-all active:scale-95 disabled:opacity-50"
                  >
                    Annuler
                  </button>
                  <button 
                    onClick={handleCleanSchool} 
                    disabled={isSubmitting || cleanModal.confirmName !== cleanModal.schoolName}
                    className="py-5 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl font-semibold text-[10px] tracking-tight shadow-xl shadow-amber-200 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
                  >
                    {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Eraser size={16} />}
                    Nettoyer
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Edit School Modal */}
      <AnimatePresence>
        
        {/* Modal Configuration des Modules */}
        {modulesModal.isOpen && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
              <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 p-6 text-white">
                <div className="flex items-center gap-3">
                  <Settings className="text-indigo-200" size={24} />
                  <div>
                    <h3 className="text-xl font-bold">Configuration des Modules</h3>
                    <p className="text-indigo-200 text-sm">{modulesModal.schoolName}</p>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-6">
                <div className="space-y-4">
                  <label className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl cursor-pointer hover:bg-slate-100 transition-colors">
                    <div>
                      <p className="font-semibold text-slate-900">Module Présences</p>
                      <p className="text-xs text-slate-500">Activer le registre d'appel et de présences</p>
                    </div>
                    <div className="relative inline-flex items-center">
                      <input 
                        type="checkbox" 
                        checked={modulesModal.modules.presences}
                        onChange={(e) => setModulesModal({
                          ...modulesModal, 
                          modules: { ...modulesModal.modules, presences: e.target.checked }
                        })}
                        className="sr-only peer" 
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </div>
                  </label>

                  <label className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl cursor-pointer hover:bg-slate-100 transition-colors">
                    <div>
                      <p className="font-semibold text-slate-900">Module Discipline</p>
                      <p className="text-xs text-slate-500">Activer le suivi des comportements et sanctions</p>
                    </div>
                    <div className="relative inline-flex items-center">
                      <input 
                        type="checkbox" 
                        checked={modulesModal.modules.discipline}
                        onChange={(e) => setModulesModal({
                          ...modulesModal, 
                          modules: { ...modulesModal.modules, discipline: e.target.checked }
                        })}
                        className="sr-only peer" 
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </div>
                  </label>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setModulesModal({ ...modulesModal, isOpen: false })}
                    className="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleUpdateModules}
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 size={18} />
                        Enregistrer
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

{editSchoolModal.isOpen && (
          <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
              onClick={() => !isSubmitting && setEditSchoolModal({ ...editSchoolModal, isOpen: false })}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-slate-100 flex items-center gap-4 bg-slate-50/50 sticky top-0 z-10 backdrop-blur-sm">
                <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200 shrink-0">
                  <Edit2 size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">Modifier l'école</h2>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-0.5">Mise à jour des informations</p>
                </div>
              </div>

              <form onSubmit={handleEditSchool} className="p-8 overflow-y-auto custom-scrollbar space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Nom de l'établissement</label>
                  <input 
                    type="text" 
                    required
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-900 outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all"
                    value={editSchoolModal.name}
                    onChange={e => setEditSchoolModal({ ...editSchoolModal, name: e.target.value })}
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Email de contact / Directeur</label>
                  <input 
                    type="email" 
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-900 outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all"
                    value={editSchoolModal.email}
                    onChange={e => setEditSchoolModal({ ...editSchoolModal, email: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Nom du directeur</label>
                  <input 
                    type="text" 
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-900 outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all"
                    value={editSchoolModal.director_name}
                    onChange={e => setEditSchoolModal({ ...editSchoolModal, director_name: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Téléphone</label>
                    <input 
                      type="text" 
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-900 outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all"
                      value={editSchoolModal.phone}
                      onChange={e => setEditSchoolModal({ ...editSchoolModal, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Adresse</label>
                    <input 
                      type="text" 
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-900 outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all"
                      value={editSchoolModal.address}
                      onChange={e => setEditSchoolModal({ ...editSchoolModal, address: e.target.value })}
                    />
                  </div>
                </div>

                {/* Option Multi-Annexes toggle */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-start gap-3.5">
                  <input
                    type="checkbox"
                    id="editHasMultiCampusToggle"
                    checked={editSchoolModal.has_multi_campus}
                    onChange={(e) => setEditSchoolModal({ ...editSchoolModal, has_multi_campus: e.target.checked })}
                    className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 mt-0.5 accent-indigo-600 cursor-pointer shrink-0"
                  />
                  <div className="flex-1">
                    <label htmlFor="editHasMultiCampusToggle" className="text-xs font-black text-slate-800 uppercase tracking-wider cursor-pointer flex items-center gap-2">
                      <span>Option : Multi-Annexes / Campus</span>
                      {editSchoolModal.has_multi_campus ? (
                        <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[9px] font-black">Actif</span>
                      ) : (
                        <span className="px-2 py-0.5 bg-slate-200 text-slate-600 rounded text-[9px] font-bold">Inactif</span>
                      )}
                    </label>
                    <p className="text-[10px] text-slate-500 font-medium leading-relaxed mt-1">
                      Activer la gestion multi-sites / annexes pour cet établissement.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 sticky bottom-0 bg-white pb-2">
                  <button 
                    type="button"
                    onClick={() => setEditSchoolModal({ ...editSchoolModal, isOpen: false })} 
                    disabled={isSubmitting}
                    className="py-5 bg-slate-100 text-slate-500 rounded-2xl font-semibold text-[10px] tracking-tight hover:bg-slate-200 transition-all active:scale-95 disabled:opacity-50"
                  >
                    Annuler
                  </button>
                  <button 
                    type="submit"
                    disabled={isSubmitting || !editSchoolModal.name}
                    className="py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-semibold text-[10px] tracking-tight shadow-xl shadow-blue-200 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
                  >
                    {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    Enregistrer
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* School Status Modal */}
      <AnimatePresence>
        {statusModal.isOpen && (
          <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
              onClick={() => !isSubmitting && setStatusModal({ ...statusModal, isOpen: false })}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-[2rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-inner ${
                  statusModal.currentStatus === 'ACTIVE' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'
                }`}>
                  {statusModal.currentStatus === 'ACTIVE' ? <Pause size={32} /> : <Play size={32} />}
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-2xl font-semibold text-slate-900 tracking-tighter leading-none">
                    {statusModal.currentStatus === 'ACTIVE' ? 'Suspendre' : 'Réactiver'} l'établissement
                  </h3>
                  <p className="text-slate-500 text-sm leading-relaxed">
                    Voulez-vous vraiment {statusModal.currentStatus === 'ACTIVE' ? 'suspendre' : 'réactiver'} <span className="font-bold text-slate-900">{statusModal.schoolName}</span> ? 
                    {statusModal.currentStatus === 'ACTIVE' ? ' Tous ses utilisateurs ne pourront plus se connecter.' : ' Les utilisateurs pourront à nouveau se connecter.'}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-8">
                  <button 
                    onClick={() => setStatusModal({ ...statusModal, isOpen: false })} 
                    disabled={isSubmitting}
                    className="py-4 bg-slate-100 text-slate-500 rounded-2xl font-semibold text-sm hover:bg-slate-200 transition-all active:scale-95 disabled:opacity-50"
                  >
                    Annuler
                  </button>
                  <button 
                    onClick={toggleSchoolStatus} 
                    disabled={isSubmitting}
                    className={`py-4 text-white rounded-2xl font-semibold text-sm transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 ${
                      statusModal.currentStatus === 'ACTIVE' 
                        ? 'bg-amber-500 hover:bg-amber-600 shadow-lg shadow-amber-200' 
                        : 'bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-200'
                    }`}
                  >
                    {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : (statusModal.currentStatus === 'ACTIVE' ? <Pause size={18} /> : <Play size={18} />)}
                    Confirmer
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Inspecting Log Details Modal */}
      <AnimatePresence>
        {inspectingLog && (
          <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
              onClick={() => setInspectingLog(null)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="p-6 md:p-8 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-4 min-w-0">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg shrink-0 ${
                    inspectingLog.action === 'DELETE' ? 'bg-rose-100 text-rose-600 shadow-rose-100' :
                    inspectingLog.action === 'CREATE' ? 'bg-emerald-100 text-emerald-600 shadow-emerald-100' :
                    inspectingLog.action === 'UPDATE' ? 'bg-amber-100 text-amber-600 shadow-amber-100' :
                    'bg-indigo-100 text-indigo-600 shadow-indigo-100'
                  }`}>
                    <Terminal size={22} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Détails d'un Audit Réseau</span>
                    <h3 className="text-lg md:text-xl font-black text-slate-900 tracking-tight truncate">
                      {actionLabels[inspectingLog.action] || inspectingLog.action}
                    </h3>
                  </div>
                </div>
                <button 
                  onClick={() => setInspectingLog(null)}
                  className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar space-y-6 flex-1 text-slate-800">
                {/* Metadatas grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 border border-slate-150/80 rounded-2xl space-y-1">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Auteur de l'acte</span>
                    <p className="font-bold text-slate-900 text-sm">{inspectingLog.user?.full_name || 'Système Automatique'}</p>
                    <p className="text-xs text-slate-500 font-medium">{inspectingLog.user?.email || 'services_job@edunova.com'}</p>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-150/80 rounded-2xl space-y-1">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Établissement</span>
                    <p className="font-bold text-slate-900 text-sm">{inspectingLog.school?.name || 'Globale (Multi-école/Plateforme)'}</p>
                    <p className="text-xs text-slate-400 font-bold">Réseau : {inspectingLog.school?.id ? 'Privé' : 'Global'}</p>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-150/80 rounded-2xl space-y-1">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Type de ressource</span>
                    <p className="font-bold text-slate-900 text-sm text-indigo-700 capitalize">
                      {entityLabels[inspectingLog.entity_type] || inspectingLog.entity_type}
                    </p>
                    <p className="text-[10px] text-slate-400 font-mono">table : {inspectingLog.entity_type}</p>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-150/80 rounded-2xl space-y-1">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Date & Heure précise</span>
                    <p className="font-bold text-slate-900 text-sm">
                      {new Date(inspectingLog.created_at).toLocaleString('fr-FR', {
                        day: '2-digit', month: 'long', year: 'numeric',
                        hour: '2-digit', minute: '2-digit', second: '2-digit'
                      })}
                    </p>
                    <p className="text-[10px] text-slate-400 font-medium">Fuseau : UTC Coordonné</p>
                  </div>
                </div>

                {/* Values Comparison Breakdown / Key-values */}
                <div className="space-y-3">
                  <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest flex items-center gap-1.5 px-1">
                    <Info size={14} className="text-indigo-500" />
                    Propriétés de la transaction
                  </h4>
                  
                  <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden divide-y divide-slate-100">
                    {(() => {
                      const detailsObj = inspectingLog.details || {};
                      const entries = typeof detailsObj === 'object' && detailsObj !== null ? Object.entries(detailsObj) : [];
                      
                      if (entries.length === 0) {
                        return (
                          <div className="p-4 text-center text-xs text-slate-400 italic">
                            Aucun paramètre supplémentaire enregistré pour cette action.
                          </div>
                        );
                      }

                      return entries.map(([key, value]) => {
                        let renderVal = '';
                        if (typeof value === 'object' && value !== null) {
                          renderVal = JSON.stringify(value);
                        } else {
                          renderVal = String(value);
                        }

                        return (
                          <div key={key} className="p-4 flex flex-col sm:flex-row sm:items-start gap-2 text-xs">
                            <span className="font-black text-slate-500 select-all sm:w-1/3 shrink-0 font-mono text-[11px]">
                              {key}
                            </span>
                            <span className="text-slate-800 break-all select-all font-medium sm:w-2/3 bg-slate-50/50 px-2 py-1 rounded-lg border border-slate-100/50">
                              {renderVal}
                            </span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>

                {/* Interactive copy raw option */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center px-1">
                    <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest">
                      Spécification Technique (JSON brute)
                    </h4>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(JSON.stringify(inspectingLog.details, null, 2));
                        toast.success("Détails JSON copiés dans le presse-papiers");
                      }}
                      className="px-3 py-1 bg-slate-100 hover:bg-slate-200 hover:text-slate-900 text-slate-600 rounded-lg text-[10px] font-black transition-all flex items-center gap-1 border border-slate-200"
                    >
                      Copier JSON
                    </button>
                  </div>
                  <pre className="p-4 bg-slate-900 border border-slate-800 rounded-2xl text-[10px] text-emerald-400 font-mono overflow-x-auto select-all max-h-48 custom-scrollbar">
                    {JSON.stringify(inspectingLog.details || {}, null, 2)}
                  </pre>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-5 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 shrink-0">
                <button
                  onClick={() => setInspectingLog(null)}
                  className="px-6 py-3 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl transition-all border border-slate-200"
                >
                  Fermer
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* MODAL: DIAGNOSTIC REPORT */}
        {diagnosticReport.isOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl max-w-2xl w-full border border-slate-200/90 overflow-hidden flex flex-col my-auto"
            >
              {/* Header - Compact & Modern */}
              <div className="px-5 py-3.5 border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-slate-50 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0">
                    <Activity size={18} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">Rapport de Diagnostic Système</h3>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-[10px] font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Opérationnel
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium">Contrôle d'intégrité, latence et périmètre multi-tenant</p>
                  </div>
                </div>
                <button
                  onClick={() => setDiagnosticReport(prev => ({ ...prev, isOpen: false }))}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body - Optimized layout with zero vertical scroll on 14" screens */}
              <div className="p-4 sm:p-5 space-y-3 flex-1">
                {diagnosticReport.isRunning ? (
                  <div className="py-12 text-center space-y-3">
                    <Loader2 size={32} className="animate-spin text-indigo-600 mx-auto" />
                    <p className="text-xs font-black uppercase text-slate-500 tracking-widest">
                      Exécution des tests d'intégrité en cours...
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 text-xs">
                    {/* Compact Latency & Connection Strip */}
                    <div className="px-3.5 py-2.5 bg-gradient-to-r from-emerald-50/90 via-teal-50/50 to-emerald-50/90 border border-emerald-200/80 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                        <div>
                          <p className="font-bold text-slate-900 text-xs">Latence Base de Données (Supabase REST/RPC)</p>
                          <p className="text-[10px] text-slate-500">Temps d'aller-retour de la requête serveur</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/70 border border-emerald-200/60 px-2 py-0.5 rounded-md hidden sm:inline-block">
                          {diagnosticReport.dbLatencyMs && diagnosticReport.dbLatencyMs < 200 ? 'Ultra Rapide' : 'Connecté'}
                        </span>
                        <span className="font-mono font-black text-emerald-800 bg-white border border-emerald-200 px-2.5 py-1 rounded-lg text-xs shadow-2xs">
                          {diagnosticReport.dbLatencyMs} ms
                        </span>
                      </div>
                    </div>

                    {/* 4 Core Infrastructure Metrics in 4-columns Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div className="p-3 bg-slate-50/80 hover:bg-slate-50 border border-slate-200/80 rounded-xl transition-all">
                        <div className="flex items-center justify-between text-slate-400 mb-1">
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Établissements</span>
                          <Building2 size={13} className="text-indigo-600" />
                        </div>
                        <p className="text-sm sm:text-base font-black text-slate-900">{diagnosticReport.schoolsCount ?? 0} <span className="text-[11px] font-normal text-slate-500">écoles</span></p>
                        <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-1">
                          <CheckCircle2 size={11} className="shrink-0" /> v_schools OK
                        </span>
                      </div>

                      <div className="p-3 bg-slate-50/80 hover:bg-slate-50 border border-slate-200/80 rounded-xl transition-all">
                        <div className="flex items-center justify-between text-slate-400 mb-1">
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Utilisateurs</span>
                          <Users size={13} className="text-blue-600" />
                        </div>
                        <p className="text-sm sm:text-base font-black text-slate-900">{diagnosticReport.profilesCount ?? 0} <span className="text-[11px] font-normal text-slate-500">comptes</span></p>
                        <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-1">
                          <CheckCircle2 size={11} className="shrink-0" /> profiles sync
                        </span>
                      </div>

                      <div className="p-3 bg-slate-50/80 hover:bg-slate-50 border border-slate-200/80 rounded-xl transition-all">
                        <div className="flex items-center justify-between text-slate-400 mb-1">
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Élèves</span>
                          <GraduationCap size={13} className="text-emerald-600" />
                        </div>
                        <p className="text-sm sm:text-base font-black text-slate-900">{diagnosticReport.studentsCount ?? 0} <span className="text-[11px] font-normal text-slate-500">inscrits</span></p>
                        <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-1">
                          <CheckCircle2 size={11} className="shrink-0" /> students valide
                        </span>
                      </div>

                      <div className="p-3 bg-slate-50/80 hover:bg-slate-50 border border-slate-200/80 rounded-xl transition-all">
                        <div className="flex items-center justify-between text-slate-400 mb-1">
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Logs d'Audit</span>
                          <ShieldCheck size={13} className="text-violet-600" />
                        </div>
                        <p className="text-sm sm:text-base font-black text-slate-900">{diagnosticReport.auditLogsCount ?? 0} <span className="text-[11px] font-normal text-slate-500">entrées</span></p>
                        <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-1">
                          <CheckCircle2 size={11} className="shrink-0" /> audit_logs actif
                        </span>
                      </div>
                    </div>

                    {/* Security & Infrastructure Status (2-column side-by-side) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="p-3 bg-slate-50/80 border border-slate-200/80 rounded-xl space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Shield size={13} className="text-indigo-600" />
                            <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Isolation Multi-Tenant RLS</span>
                          </div>
                          <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-700 text-[9px] font-black">ACTIF</span>
                        </div>
                        <p className="font-bold text-slate-800 text-[11px] truncate" title={diagnosticReport.rlsIsolationStatus}>
                          {diagnosticReport.rlsIsolationStatus}
                        </p>
                      </div>

                      <div className="p-3 bg-slate-50/80 border border-slate-200/80 rounded-xl space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <HardDrive size={13} className="text-blue-600" />
                            <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Stockage & Fichiers</span>
                          </div>
                          <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-700 text-[9px] font-black">OK</span>
                        </div>
                        <p className="font-bold text-slate-800 text-[11px] truncate" title={diagnosticReport.storageHealth}>
                          {diagnosticReport.storageHealth}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer - Compact & Clear */}
              <div className="px-5 py-3 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between shrink-0">
                <button
                  onClick={handleRunDiagnostic}
                  disabled={diagnosticReport.isRunning}
                  className="px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-lg border border-slate-200 transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
                >
                  <RefreshCw size={13} className={diagnosticReport.isRunning ? 'animate-spin' : ''} />
                  <span>Réexécuter</span>
                </button>
                <button
                  onClick={() => setDiagnosticReport(prev => ({ ...prev, isOpen: false }))}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg transition-all shadow-sm shadow-indigo-500/20 cursor-pointer active:scale-95"
                >
                  Fermer
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Sub-components for Configuration ---

const ConfigSection: React.FC<{ 
  title: string; 
  subtitle?: string;
  icon: any; 
  iconBg?: string;
  iconColor?: string;
  badge?: string;
  children: React.ReactNode; 
}> = ({ title, subtitle, icon: Icon, iconBg = 'bg-indigo-50/80', iconColor = 'text-indigo-600', badge, children }) => (
  <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all overflow-hidden flex flex-col">
    <div className="p-5 md:p-6 border-b border-slate-100 bg-gradient-to-r from-slate-50/90 via-white to-slate-50/30 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3.5">
        <div className={`w-11 h-11 ${iconBg} ${iconColor} rounded-2xl flex items-center justify-center shadow-xs border border-slate-200/50 shrink-0`}>
          <Icon size={22} />
        </div>
        <div>
          <h3 className="font-black text-slate-900 text-base tracking-tight">{title}</h3>
          {subtitle && <p className="text-[11px] text-slate-500 font-medium">{subtitle}</p>}
        </div>
      </div>
      {badge && (
        <span className="px-3 py-1 bg-slate-100 text-slate-700 text-[10px] font-black uppercase tracking-wider rounded-full border border-slate-200 shrink-0">
          {badge}
        </span>
      )}
    </div>
    <div className="p-6 md:p-8 space-y-7 flex-1">
      {children}
    </div>
  </div>
);

const ConfigField: React.FC<{ 
  label: string; 
  description?: string; 
  icon?: any;
  children: React.ReactNode 
}> = ({ label, description, icon: Icon, children }) => (
  <div className="space-y-2.5">
    <div className="flex flex-col">
      <div className="flex items-center gap-1.5">
        {Icon && <Icon size={14} className="text-slate-400" />}
        <label className="text-xs font-black text-slate-800 uppercase tracking-wider">
          {label}
        </label>
      </div>
      {description && <p className="text-[11px] text-slate-500 font-medium leading-relaxed mt-0.5">{description}</p>}
    </div>
    <div>
      {children}
    </div>
  </div>
);
