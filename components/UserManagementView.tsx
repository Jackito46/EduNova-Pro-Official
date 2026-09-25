import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Users, UserPlus, Shield, Mail, Trash2, 
  ShieldCheck, Crown, UserCog, Loader2, RefreshCcw, AlertCircle, Power, PowerOff, X, Lock,
  Unlock, Eye, EyeOff, User, CheckCircle2, ShieldAlert, Search, Filter, Building2, MapPin,
  Sparkles, KeyRound, Check, Info, Wallet, BookOpen, ClipboardList, FileText, Send, AlertTriangle,
  Clock, Zap, Calendar, History, UserCheck, Timer
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, supabaseUrl, supabaseAnonKey, isValidUuid } from '../supabase';
import { createClient } from '@supabase/supabase-js';
import { AuditLogger } from '../utils/auditLogger';
import { formatFullName, formatStudentName } from '../utils/formatters';
import { UserProfile, UserRole, StaffMember } from '../types';
import { useSchool } from '../contexts/SchoolContext';
import { userSchema } from '../utils/validation';
import { normalizeIdentifier, displayIdentifier } from '../utils/authHelpers';
import { isAutonomousAccount, isAutonomousAdmin, AUTONOMOUS_RESTRICTION_MESSAGE } from '../utils/autonomousAdminGuard';
import { SkeletonTable, FluidLoadingState, SubmittingButtonContent } from './SkeletonLoader';
import { SelectPill, SelectOption } from './SelectPill';
import { DoubleRegardSubmitModal } from './DoubleRegardSubmitModal';
import { ScrollableContainer } from './ScrollableContainer';

const secondarySupabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
    storageKey: 'admin-user-creation-key',
  },
  global: {
    fetch: async (input, init) => {
      try {
        return await fetch(input, init);
      } catch (err: any) {
        return new Response(JSON.stringify({
          message: "Erreur réseau: Impossible de contacter le serveur. Vérifiez votre connexion internet.",
          code: "NETWORK_ERROR"
        }), {
          status: 503,
          statusText: "Service Unavailable",
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
  }
});

// Tooltip helper for contextual guidance
const InfoTooltip = ({ content }: { content: string }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative inline-flex items-center ml-1">
      <button
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow(!show)}
        className="text-slate-400 hover:text-blue-600 transition-colors cursor-pointer p-0.5 rounded-full"
      >
        <Info size={13} />
      </button>
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, y: 5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.95 }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2.5 bg-slate-900 text-white text-[11px] leading-snug rounded-xl shadow-xl z-50 pointer-events-none font-medium border border-slate-700 text-center"
          >
            {content}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Role permissions matrix descriptor
const getRolePermissionsSummary = (role: string, terminology: any) => {
  switch (role) {
    case UserRole.SUPER_ADMIN:
      return [
        { label: 'Supervision Globale Multi-Écoles & Multi-Tenant', allowed: true },
        { label: 'Gestion Intégrale des Utilisateurs & Rôles System', allowed: true },
        { label: 'Restauration Directe des Comptes Suspendus', allowed: true },
        { label: 'Journal d\'Audit & Traçabilité Complète', allowed: true },
        { label: 'Configuration Réseau & Passerelle MonCash', allowed: true }
      ];
    case UserRole.SCHOOL_ADMIN:
      return [
        { label: 'Administration Complète de l\'Établissement', allowed: true },
        { label: 'Gestion des Utilisateurs (Max 2 Admins)', allowed: true },
        { label: 'Configuration des Classes, Matières & Frais', allowed: true },
        { label: 'Supervision Financière & Économat', allowed: true },
        { label: 'Journal d\'Audit de l\'École', allowed: true }
      ];
    case UserRole.DIRECTOR:
      return [
        { label: `Supervision Pédagogique (${terminology.director || 'Direction'})`, allowed: true },
        { label: 'Gestion des Classes & Affectations', allowed: true },
        { label: 'Validation des Bulletins & Saisie des Notes', allowed: true },
        { label: 'Consultation des Rapports Financiers', allowed: true },
        { label: 'Modération des Comptes Collaborateurs', allowed: false }
      ];
    case UserRole.SECRETARY:
      return [
        { label: `Inscriptions & Registre (${terminology.secretary || 'Secrétariat'})`, allowed: true },
        { label: 'Gestion des Fiches Élèves & Contacts', allowed: true },
        { label: 'Impression des Reçus & Cartes Scolaires', allowed: true },
        { label: 'Saisie des Présences Quotidiennes', allowed: true },
        { label: 'Accès aux Paramètres Système', allowed: false }
      ];
    case UserRole.ACCOUNTANT:
      return [
        { label: `Gestion Financière & Caisses (${terminology.accountant || 'Économat'})`, allowed: true },
        { label: 'Encaissement des Frais & Scolarités', allowed: true },
        { label: 'Gestion de la Paie du Personnel', allowed: true },
        { label: 'Édition des Reçus & Bilan Comptable', allowed: true },
        { label: 'Création d\'Utilisateurs Système', allowed: false }
      ];
    case UserRole.TEACHER:
      return [
        { label: `Espace Pédagogique (${terminology.teacher || 'Enseignant'})`, allowed: true },
        { label: 'Saisie des Notes & Évaluations', allowed: true },
        { label: 'Gestion des Présences en Classe', allowed: true },
        { label: 'Consultation de l\'Emploi du Temps', allowed: true },
        { label: 'Accès à l\'Économat ou aux Finances', allowed: false }
      ];
    case UserRole.SUPERVISOR:
      return [
        { label: `Discipline & Présences (${terminology.supervisor || 'Doyen'})`, allowed: true },
        { label: 'Enregistrement des Billets de Retard', allowed: true },
        { label: 'Suivi des Sanctions & Conduite', allowed: true },
        { label: 'Pointage du Personnel & Enseignants', allowed: true },
        { label: 'Modification des Rôles Utilisateurs', allowed: false }
      ];
    default:
      return [
        { label: 'Consultation des Données Autorisées', allowed: true },
        { label: 'Accès aux Fonctionnalités Standard', allowed: true }
      ];
  }
};

export type DurationPresetType = number | '1H' | '2H' | '4H' | '8H' | '12H' | '24H' | 'END_YEAR' | 'CUSTOM' | string;

// Expiration calculation helper for autonomous and temporary accounts
export const calculateExpiryDate = (
  preset: DurationPresetType,
  customDate?: string
): { iso: string; label: string } => {
  if (preset === 'CUSTOM' && customDate) {
    const d = new Date(customDate);
    const hasTime = customDate.includes('T');
    if (!hasTime) {
      d.setHours(23, 59, 59, 999);
    }
    const formattedDate = d.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    const formattedTime = d.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
    const label = hasTime 
      ? `Date butoir (${formattedDate} à ${formattedTime})`
      : `Date butoir (${formattedDate})`;
    return {
      iso: d.toISOString(),
      label
    };
  }

  // Hourly presets (e.g. 1H, 2H, 4H, 8H, 12H, 24H)
  if (typeof preset === 'string' && preset.endsWith('H')) {
    const hours = parseInt(preset.replace('H', ''), 10);
    if (!isNaN(hours) && hours > 0) {
      const d = new Date();
      d.setTime(d.getTime() + hours * 60 * 60 * 1000);
      const timeStr = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      const isToday = d.toDateString() === new Date().toDateString();
      const dateStr = isToday ? "aujourd'hui" : `le ${d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}`;
      return {
        iso: d.toISOString(),
        label: `${hours} heure${hours > 1 ? 's' : ''} (Jusqu'à ${timeStr} ${dateStr})`
      };
    }
  }

  if (preset === 'END_YEAR') {
    const now = new Date();
    const currentYear = now.getFullYear();
    const targetYear = now.getMonth() >= 6 ? currentYear + 1 : currentYear;
    const endOfYear = new Date(targetYear, 5, 30, 23, 59, 59, 999); // 30 Juin
    return {
      iso: endOfYear.toISOString(),
      label: `Fin d'Année Scolaire (30 Juin ${targetYear})`
    };
  }

  const d = new Date();
  const numDays = typeof preset === 'number' ? preset : 30;
  d.setDate(d.getDate() + numDays);
  d.setHours(23, 59, 59, 999);
  let label = `${numDays} jours`;
  if (numDays === 1) label = '24 heures (1 jour)';
  else if (numDays === 7) label = '7 jours (Mission d\'urgence)';
  else if (numDays === 15) label = '15 jours (Remplacement court)';
  else if (numDays === 30) label = '1 mois (30 jours)';
  else if (numDays === 90) label = '3 mois (Trimestre)';
  return {
    iso: d.toISOString(),
    label: `${label} (Jusqu'au ${d.toLocaleDateString('fr-FR')})`
  };
};

export const getUserExpiryInfo = (u: UserProfile) => {
  if (!u.expires_at) {
    return {
      isExpired: false,
      isExpiringSoon: false,
      text: 'Permanent',
      daysLeft: null,
      formattedExpiry: ''
    };
  }
  const now = Date.now();
  const expiry = new Date(u.expires_at).getTime();
  const diffMs = expiry - now;
  const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  
  const expiryDate = new Date(u.expires_at);
  const isToday = expiryDate.toDateString() === new Date().toDateString();
  const formattedTime = expiryDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const formattedDate = expiryDate.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const formattedExpiry = `${formattedDate} à ${formattedTime}`;

  if (diffMs <= 0) {
    return {
      isExpired: true,
      isExpiringSoon: false,
      text: `Expiré (${isToday ? `aujourd'hui à ${formattedTime}` : formattedDate})`,
      daysLeft: 0,
      formattedExpiry
    };
  }

  // Moins de 60 minutes
  if (diffMs < 60 * 60 * 1000) {
    const minsLeft = Math.max(1, Math.round(diffMs / (60 * 1000)));
    return {
      isExpired: false,
      isExpiringSoon: true,
      text: `Expire dans ${minsLeft} min (${formattedTime})`,
      daysLeft: 0,
      formattedExpiry
    };
  }

  // Moins de 24 heures
  if (diffMs < 24 * 60 * 60 * 1000) {
    const hoursLeft = Math.floor(diffMs / (1000 * 60 * 60));
    const minsLeft = Math.round((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const durationText = hoursLeft > 0 
      ? `${hoursLeft}h${minsLeft > 0 ? `${minsLeft}m` : ''}` 
      : `${minsLeft} min`;
    return {
      isExpired: false,
      isExpiringSoon: true,
      text: `Expire dans ${durationText} (${formattedTime})`,
      daysLeft: 0,
      formattedExpiry
    };
  }

  // Moins de 7 jours
  if (daysLeft <= 7) {
    return {
      isExpired: false,
      isExpiringSoon: true,
      text: `Expire dans ${daysLeft}j (${formattedDate})`,
      daysLeft,
      formattedExpiry
    };
  }

  return {
    isExpired: false,
    isExpiringSoon: false,
    text: `Échéance : ${formattedDate}`,
    daysLeft,
    formattedExpiry
  };
};

const UserManagementView: React.FC<{ currentUser: UserProfile }> = ({ currentUser }) => {
  const { terminology, campuses, currentCampusId } = useSchool();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedUserModal, setSelectedUserModal] = useState<UserProfile | null>(null);
  const [activeFicheTab, setActiveFicheTab] = useState<'overview' | 'permissions'>('overview');
  
  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [campusFilter, setCampusFilter] = useState<string>('ALL');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Password Visibility
  const [showPassword, setShowPassword] = useState(false);

  const [resetModal, setResetModal] = useState<{
    isOpen: boolean;
    userId: string;
    fullName: string;
    email: string;
    newPassword: string;
    forceChange: boolean;
    activeTab: 'email' | 'manual';
  }>({ 
    isOpen: false, 
    userId: '', 
    fullName: '', 
    email: '', 
    newPassword: '', 
    forceChange: true, 
    activeTab: 'email' 
  });

  const [editRoleModal, setEditRoleModal] = useState<{
    isOpen: boolean;
    user: UserProfile | null;
    newRole: UserRole;
    newCampusId: string;
  }>({ isOpen: false, user: null, newRole: UserRole.TEACHER, newCampusId: '' });

  const [dialog, setDialog] = useState<{
    isOpen: boolean;
    type: 'alert' | 'confirm';
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'email' | 'warning' | 'danger' | 'success' | 'info';
    onConfirm?: () => void;
  }>({ isOpen: false, type: 'alert', title: '', message: '' });

  const showAlert = (title: string, message: string, variant?: 'success' | 'danger' | 'info') => {
    setDialog({ isOpen: true, type: 'alert', title, message, variant });
  };

  const showConfirm = (
    title: string, 
    message: string, 
    onConfirm: () => void,
    options?: { confirmText?: string; cancelText?: string; variant?: 'email' | 'warning' | 'danger' | 'success' | 'info' }
  ) => {
    setDialog({ 
      isOpen: true, 
      type: 'confirm', 
      title, 
      message, 
      onConfirm,
      confirmText: options?.confirmText,
      cancelText: options?.cancelText,
      variant: options?.variant
    });
  };

  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    role: UserRole.TEACHER,
    password: '',
    confirmPassword: '',
    staff_id: '',
    campus_id: '',
    forcePasswordChange: true,
    accessDurationType: 'PERMANENT' as 'PERMANENT' | 'TEMPORARY',
    durationPreset: 30 as DurationPresetType,
    customExpiryDate: ''
  });

  const [reopenModal, setReopenModal] = useState<{
    isOpen: boolean;
    user: UserProfile | null;
    actionType: 'PROLONG' | 'PERMANENT' | 'LINK_RH';
    durationPreset: DurationPresetType;
    customExpiryDate: string;
    linkStaffId: string;
  }>({
    isOpen: false,
    user: null,
    actionType: 'PROLONG',
    durationPreset: 30,
    customExpiryDate: '',
    linkStaffId: ''
  });

  const [doubleRegardModal, setDoubleRegardModal] = useState<{
    isOpen: boolean;
    title: string;
    actionType: any;
    description: string;
    targetEntityType: string;
    targetEntityId?: string | null;
    payload: Record<string, any>;
  }>({
    isOpen: false,
    title: '',
    actionType: 'DELETE_USER',
    description: '',
    targetEntityType: 'user',
    payload: {}
  });

  const openReopenModal = (user: UserProfile) => {
    setReopenModal({
      isOpen: true,
      user,
      actionType: user.expires_at ? 'PROLONG' : 'PROLONG',
      durationPreset: 30,
      customExpiryDate: '',
      linkStaffId: ''
    });
  };

  const canReactivate = (targetUser: UserProfile) => {
    if (!canManageUser(targetUser)) return false;
    return (
      currentUser.is_super_admin ||
      currentUser.role === UserRole.SUPER_ADMIN ||
      currentUser.role === UserRole.SCHOOL_ADMIN ||
      currentUser.role === UserRole.DIRECTOR
    );
  };

  const fetchUsersAndStaff = useCallback(async () => {
    setLoading(true);
    
    // 1. Charger cache
    let cachedUsers = null;
    try { cachedUsers = window.localStorage.getItem('edunova_users_cache'); } catch (err) {}
    if (cachedUsers) {
      try {
        const parsed = JSON.parse(cachedUsers);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setUsers(parsed);
          setLoading(false);
        }
      } catch (e) { console.error(e); }
    }

    try {
      let staffQuery = supabase.from('staff').select('*').eq('school_id', currentUser.school_id);
      if (currentCampusId && isValidUuid(currentCampusId)) {
        staffQuery = staffQuery.eq('campus_id', currentCampusId);
      }

      const [usersResponse, staffResponse] = await Promise.all([
        supabase.rpc('get_school_profiles'),
        staffQuery
      ]);
      
      if (usersResponse.error) throw usersResponse.error;
      if (staffResponse.error) throw staffResponse.error;
      
      if (usersResponse.data) {
        let usersData = usersResponse.data as UserProfile[];
        if (currentCampusId) {
          // Include users belonging to active campus OR global/headquarters users
          usersData = usersData.filter((u) => 
            u.campus_id === currentCampusId || 
            !u.campus_id || 
            u.is_super_admin || 
            u.role === 'SUPER_ADMIN' || 
            u.role === 'SCHOOL_ADMIN' || 
            u.role === 'DIRECTOR'
          );
        }

        // Proactively suspend any accounts past their expiration date (MultiTenant safe)
        const expiredUsersToSuspend = usersData.filter(u => 
          u.expires_at && 
          new Date(u.expires_at).getTime() <= Date.now() && 
          u.is_active !== false &&
          u.role !== 'SUPER_ADMIN' &&
          !u.is_super_admin
        );
        if (expiredUsersToSuspend.length > 0) {
          const expiredIds = expiredUsersToSuspend.map(u => u.id);
          supabase
            .from('profiles')
            .update({ is_active: false })
            .in('id', expiredIds)
            .eq('school_id', currentUser.school_id)
            .then(() => {
              console.log(`Auto-suspended ${expiredIds.length} expired accounts`);
            });
          usersData = usersData.map(u => expiredIds.includes(u.id) ? { ...u, is_active: false } : u);
        }
        
        const rawStaffList = (staffResponse.data as StaffMember[]) || [];
        const staffByEmail = new Map<string, string>();
        rawStaffList.forEach(s => {
          if (s.email) {
            staffByEmail.set(s.email.toLowerCase().trim(), s.id);
          }
        });

        // Reconcile and enrich profiles with HR registry staff_id
        usersData = usersData.map(u => {
          const emailKey = (u.email || '').toLowerCase().trim();
          const matchedStaffId = u.staff_id || staffByEmail.get(emailKey) || null;
          return {
            ...u,
            staff_id: matchedStaffId,
            is_autonomous: typeof u.is_autonomous === 'boolean' 
              ? u.is_autonomous 
              : (matchedStaffId ? false : !matchedStaffId)
          };
        });

        const sortedData = usersData.sort((a, b) => 
          (a.full_name || '').localeCompare(b.full_name || '')
        );
        setUsers(sortedData);
        try { window.localStorage.setItem('edunova_users_cache', JSON.stringify(sortedData)); } catch (err) {}
      }

      if (staffResponse.data) {
        setStaffList(staffResponse.data as StaffMember[]);
      }

      setIsOffline(false);
    } catch (e) {
      console.error('Erreur fetch:', e);
      setIsOffline(true);
    } finally {
      setLoading(false);
    }
  }, [currentUser.school_id, currentCampusId]);

  useEffect(() => { 
    fetchUsersAndStaff(); 
    const handleStatus = () => setIsOffline(!navigator.onLine);
    window.addEventListener('online', handleStatus);
    window.addEventListener('offline', handleStatus);
    return () => {
      window.removeEventListener('online', handleStatus);
      window.removeEventListener('offline', handleStatus);
    };
  }, [fetchUsersAndStaff]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!navigator.onLine) {
      setErrorMsg("Action impossible hors-ligne.");
      return;
    }
    
    setErrorMsg(null);

    if (formData.password !== formData.confirmPassword) {
      setErrorMsg("Les mots de passe ne correspondent pas.");
      return;
    }

    const normalizedEmail = normalizeIdentifier(formData.email);

    const isAutonomous = !formData.staff_id;
    let calculatedExpiresAt: string | null = null;
    let calculatedDurationLabel: string | null = null;

    if (formData.accessDurationType === 'TEMPORARY') {
      const exp = calculateExpiryDate(formData.durationPreset, formData.customExpiryDate);
      calculatedExpiresAt = exp.iso;
      calculatedDurationLabel = exp.label;
    }

    const validationResult = userSchema.safeParse({
      email: formData.email,
      password: formData.password,
      full_name: formData.full_name,
      role: formData.role,
      campus_id: formData.campus_id,
      linked_staff_id: formData.staff_id,
      is_autonomous: isAutonomous,
      expires_at: calculatedExpiresAt,
      access_duration_label: calculatedDurationLabel
    });
    
    if (!validationResult.success) {
      setErrorMsg(validationResult.error.issues[0].message);
      return;
    }

    // Check for max 2 admins per school
    if (formData.role === UserRole.SCHOOL_ADMIN) {
      if (isAutonomousAccount(currentUser)) {
        setErrorMsg("Opération restreinte : Seul un Administrateur titulaire certifié RH ou Super Admin peut créer un compte Administrateur.");
        return;
      }
      const adminCount = users.filter(u => u.role === UserRole.SCHOOL_ADMIN && u.is_active !== false).length;
      if (adminCount >= 2) {
        setErrorMsg("La limite de 2 administrateurs par école est atteinte. Veuillez choisir un autre rôle ou désactiver un administrateur existant.");
        return;
      }
    }

    setIsSubmitting(true);
    
    try {
      const finalCampusId = currentUser.campus_id || formData.campus_id || currentCampusId || null;
      const { data, error } = await secondarySupabase.auth.signUp({
        email: normalizedEmail,
        password: formData.password,
        options: {
          data: {
            full_name: formData.full_name,
            role: formData.role,
            school_id: currentUser.school_id,
            campus_id: finalCampusId,
          }
        }
      });

      if (error) throw error;

      const newUserId = data.user?.id;

      if (data.user?.identities && data.user.identities.length === 0) {
        throw new Error("Cet email est déjà utilisé.");
      }

      if (newUserId) {
        await supabase
          .from('profiles')
          .update({ 
            force_password_change: formData.forcePasswordChange,
            campus_id: finalCampusId,
            is_autonomous: isAutonomous,
            expires_at: calculatedExpiresAt,
            access_duration_label: calculatedDurationLabel
          })
          .eq('id', newUserId)
          .eq('school_id', currentUser.school_id);

        if (formData.staff_id) {
          await supabase
            .from('staff')
            .update({ email: normalizedEmail })
            .eq('id', formData.staff_id)
            .eq('school_id', currentUser.school_id);
        }

        AuditLogger.log({
          school_id: currentUser.school_id,
          user_id: currentUser.id,
          action: 'CREATE',
          entity_type: 'user',
          entity_id: newUserId,
          details: { 
            email: normalizedEmail, 
            role: formData.role, 
            full_name: formData.full_name, 
            staff_id: formData.staff_id, 
            campus_id: finalCampusId,
            is_autonomous: isAutonomous,
            expires_at: calculatedExpiresAt,
            access_duration_label: calculatedDurationLabel
          }
        });
        
        fetchUsersAndStaff();
        setShowAddModal(false);
        setFormData({ 
          email: '', 
          full_name: '', 
          role: UserRole.TEACHER, 
          password: '', 
          confirmPassword: '', 
          staff_id: '', 
          campus_id: '', 
          forcePasswordChange: true,
          accessDurationType: 'PERMANENT',
          durationPreset: 30,
          customExpiryDate: ''
        });
        showAlert("Succès", `Le compte de ${formData.full_name} a été créé avec succès.`);
      } else {
        setErrorMsg("Erreur lors de la création de l'utilisateur.");
      }
    } catch (error: any) {
      console.error("Erreur détaillée lors de la création :", error);
      setErrorMsg(error?.message || "Erreur lors de la création de l'utilisateur.");
    }
    setIsSubmitting(false);
  };

  const handleSendPasswordResetEmail = async (targetUser: { id: string; full_name?: string; email: string }) => {
    if (!targetUser.email) {
      showAlert("Erreur", "Cet utilisateur ne possède pas d'adresse email valide.");
      return;
    }

    if (!navigator.onLine) {
      showAlert("Erreur", "Action impossible hors-ligne.");
      return;
    }

    const targetEmail = normalizeIdentifier(targetUser.email);
    setIsSubmitting(true);
    try {
      // 1. Automatically reactivate account and clear failed attempts in database
      try {
        await supabase.rpc('reset_failed_login', { p_email: targetEmail });
        await supabase
          .from('profiles')
          .update({ 
            is_active: true, 
            failed_login_attempts: 0, 
            failed_attempts: 0,
            force_password_change: true
          })
          .eq('id', targetUser.id);
      } catch (dbErr) {
        console.warn("Notice during user unlock in DB:", dbErr);
      }

      // 2. Send Supabase Auth recovery email with redirect
      const redirectUrl = typeof window !== 'undefined' 
        ? `${window.location.origin}${window.location.pathname}#/` 
        : undefined;

      const { error } = await supabase.auth.resetPasswordForEmail(targetEmail, {
        redirectTo: redirectUrl,
      });

      if (error) throw error;

      // 3. Log audit event
      await AuditLogger.log({
        school_id: currentUser.school_id,
        user_id: currentUser.id,
        action: 'PASSWORD_RESET_EMAIL_SENT',
        entity_type: 'user',
        entity_id: targetUser.id,
        details: { target_user: targetUser.full_name, email: targetEmail }
      });

      setResetModal(prev => ({ ...prev, isOpen: false }));
      showAlert(
        'Email de récupération envoyé !',
        `Un lien de réinitialisation et de déblocage sécurisé a été transmis à ${targetEmail}.\n\nL'utilisateur pourra cliquer sur ce lien pour débloquer immédiatement son compte et choisir son nouveau mot de passe.`
      );
      fetchUsersAndStaff();
    } catch (err: any) {
      console.error('Erreur envoi email réinitialisation:', err);
      showAlert('Erreur', err.message || "Impossible d'envoyer l'email de réinitialisation.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    const { userId, fullName, newPassword } = resetModal;
    
    const targetUser = users.find(u => u.id === userId);
    if (targetUser && (targetUser.role === UserRole.SCHOOL_ADMIN || targetUser.role === UserRole.DIRECTOR) && isAutonomousAccount(currentUser)) {
      setDoubleRegardModal({
        isOpen: true,
        title: `Réinitialisation de mot de passe : ${fullName}`,
        actionType: 'RESET_USER_PASSWORD',
        description: `Demande de réinitialisation de mot de passe pour l'administrateur ${fullName} (${targetUser.email}).\nEn tant qu'opérateur en mode autonome, cette action requiert la validation formelle d'un Administrateur titulaire certifié RH.`,
        targetEntityType: 'user',
        targetEntityId: userId,
        payload: {
          userId,
          newPassword,
          fullName,
          email: targetUser.email,
          forceChange: resetModal.forceChange
        }
      });
      setResetModal({ ...resetModal, isOpen: false, newPassword: '', forceChange: true });
      return;
    }

    if (!newPassword) return;
    if (newPassword.length < 6) {
      showAlert('Erreur', 'Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.rpc('admin_reset_password', {
        p_user_id: userId,
        p_new_password: newPassword,
        p_force_change: resetModal.forceChange
      });

      if (error) throw error;
      
      await supabase
        .from('profiles')
        .update({ 
          is_active: true,
          failed_login_attempts: 0,
          failed_attempts: 0,
          force_password_change: resetModal.forceChange 
        })
        .eq('id', userId)
        .eq('school_id', currentUser.school_id);

      setResetModal({ ...resetModal, isOpen: false, newPassword: '', forceChange: true });
      showAlert('Succès', `Le mot de passe de ${fullName} a été réinitialisé avec succès.`);
      await AuditLogger.log({
        school_id: currentUser.school_id,
        user_id: currentUser.id,
        action: 'PASSWORD_RESET',
        entity_type: 'user',
        entity_id: userId,
        details: { target_user: fullName, forceChange: resetModal.forceChange }
      });
      fetchUsersAndStaff();
    } catch (err: any) {
      console.error('Erreur réinitialisation:', err);
      showAlert('Erreur', err.message || 'Impossible de réinitialiser le mot de passe.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRestoreAccess = async (targetUser: UserProfile) => {
    if (!navigator.onLine) {
      showAlert("Erreur", "Action impossible hors-ligne.");
      return;
    }

    setIsSubmitting(true);
    try {
      let { data, error } = await supabase.rpc('admin_toggle_user_status', {
        p_user_id: targetUser.id,
        p_new_status: true
      });

      if (error || !data?.success) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ is_active: true })
          .eq('id', targetUser.id)
          .eq('school_id', currentUser.school_id);

        if (updateError) throw updateError;
      }

      await AuditLogger.log({
        school_id: currentUser.school_id,
        user_id: currentUser.id,
        action: 'UNBLOCK_USER',
        entity_type: 'user',
        entity_id: targetUser.id,
        details: { user_name: targetUser.full_name || targetUser.email, restored_by_super_admin: true }
      });

      showAlert("Accès Restauré", `Le compte de ${targetUser.full_name || targetUser.email} a été réactivé instantanément !`);
      
      if (selectedUserModal?.id === targetUser.id) {
        setSelectedUserModal(prev => prev ? { ...prev, is_active: true } : null);
      }
      
      fetchUsersAndStaff();
    } catch (err: any) {
      console.error("Erreur restauration accès:", err);
      showAlert("Erreur", "Impossible de restaurer l'accès : " + (err.message || "Erreur inconnue"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReactivateAndExtend = async () => {
    if (!reopenModal.user) return;
    if (!navigator.onLine) {
      showAlert("Erreur", "Action impossible hors-ligne.");
      return;
    }

    const targetUser = reopenModal.user;
    if (!canReactivate(targetUser)) {
      showAlert("Erreur", "Vous n'avez pas les droits nécessaires pour réactiver ou prolonger ce compte.");
      return;
    }

    setIsSubmitting(true);
    try {
      let newExpiresAt: string | null = null;
      let newDurationLabel: string | null = null;
      let newIsAutonomous = targetUser.is_autonomous ?? !((targetUser as any).linked_staff_id || (targetUser as any).staff_id);

      if (reopenModal.actionType === 'PROLONG') {
        const exp = calculateExpiryDate(reopenModal.durationPreset, reopenModal.customExpiryDate);
        newExpiresAt = exp.iso;
        newDurationLabel = exp.label;
      } else if (reopenModal.actionType === 'PERMANENT') {
        newExpiresAt = null;
        newDurationLabel = 'Permanent (Indéterminé)';
      } else if (reopenModal.actionType === 'LINK_RH') {
        if (!reopenModal.linkStaffId) {
          showAlert("Erreur", "Veuillez sélectionner un collaborateur RH à associer.");
          setIsSubmitting(false);
          return;
        }
        newIsAutonomous = false;
        newExpiresAt = null;
        newDurationLabel = 'Permanent (Titulaire RH)';
        
        // Link staff table with user email
        const { error: staffLinkErr } = await supabase
          .from('staff')
          .update({ email: targetUser.email })
          .eq('id', reopenModal.linkStaffId)
          .eq('school_id', currentUser.school_id);
        if (staffLinkErr) console.warn("Erreur liaison staff:", staffLinkErr);
      }

      // Check admin limit if reactivating a SCHOOL_ADMIN
      if (targetUser.role === UserRole.SCHOOL_ADMIN) {
        const activeAdminCount = users.filter(u => u.role === UserRole.SCHOOL_ADMIN && u.is_active !== false && u.id !== targetUser.id).length;
        if (activeAdminCount >= 2) {
          showAlert("Opération refusée", "La limite de 2 administrateurs actifs par école est déjà atteinte.");
          setIsSubmitting(false);
          return;
        }
      }

      // 1. Update profiles table with MultiTenant isolation
      const profileUpdates: any = {
        is_active: true,
        expires_at: newExpiresAt,
        access_duration_label: newDurationLabel,
        is_autonomous: newIsAutonomous,
        failed_login_attempts: 0,
        failed_attempts: 0
      };

      if (reopenModal.actionType === 'LINK_RH' && reopenModal.linkStaffId) {
        profileUpdates.staff_id = reopenModal.linkStaffId;
        profileUpdates.rh_verified = true;
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update(profileUpdates)
        .eq('id', targetUser.id)
        .eq('school_id', currentUser.school_id);

      if (updateError) throw updateError;

      // 2. Also ensure admin_toggle_user_status RPC synchronization if available
      try {
        await supabase.rpc('admin_toggle_user_status', {
          p_user_id: targetUser.id,
          p_new_status: true
        });
      } catch (rpcErr) {
        console.warn("RPC admin_toggle_user_status optional sync:", rpcErr);
      }

      // 3. Audit log
      await AuditLogger.log({
        school_id: currentUser.school_id,
        user_id: currentUser.id,
        action: 'REACTIVATE_AND_EXTEND',
        entity_type: 'user',
        entity_id: targetUser.id,
        details: {
          user_name: targetUser.full_name || targetUser.email,
          previous_expires_at: targetUser.expires_at,
          new_expires_at: newExpiresAt,
          new_duration_label: newDurationLabel,
          action_type: reopenModal.actionType,
          linked_staff_id: reopenModal.linkStaffId || null,
          restored_by: currentUser.full_name || currentUser.email,
          campus_id: targetUser.campus_id || null
        }
      });

      showAlert(
        "Accès Rétabli", 
        `Le compte de ${targetUser.full_name || targetUser.email} a été réactivé avec succès ! ${newDurationLabel ? `Durée : ${newDurationLabel}` : ''}`,
        'success'
      );

      setReopenModal({
        isOpen: false,
        user: null,
        actionType: 'PROLONG',
        durationPreset: 30,
        customExpiryDate: '',
        linkStaffId: ''
      });

      if (selectedUserModal?.id === targetUser.id) {
        setSelectedUserModal(prev => prev ? { 
          ...prev, 
          is_active: true, 
          expires_at: newExpiresAt, 
          access_duration_label: newDurationLabel,
          is_autonomous: newIsAutonomous
        } : null);
      }

      fetchUsersAndStaff();
    } catch (err: any) {
      console.error("Erreur réactivation / prolongation:", err);
      showAlert("Erreur", "Impossible de réactiver le compte : " + (err.message || "Erreur inconnue"), 'danger');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateUserRoleAndCampus = async () => {
    if (!editRoleModal.user) return;
    const targetUser = editRoleModal.user;
    const { newRole, newCampusId } = editRoleModal;

    if (!canManageUser(targetUser)) {
      showAlert("Erreur", "Vous n'avez pas les droits nécessaires pour modifier cet utilisateur.");
      return;
    }

    if ((newRole === UserRole.SCHOOL_ADMIN || newRole === UserRole.DIRECTOR) && isAutonomousAccount(currentUser)) {
      showAlert("Opération restreinte", "Seul un Administrateur titulaire certifié RH ou Super Admin peut promouvoir un compte au rang d'Administrateur.");
      return;
    }

    if ((targetUser.role === UserRole.SCHOOL_ADMIN || targetUser.role === UserRole.DIRECTOR) && isAutonomousAccount(currentUser)) {
      showAlert("Opération restreinte", "Seul un Administrateur titulaire certifié RH ou Super Admin peut modifier le rôle d'un Administrateur.");
      return;
    }

    if (newRole === UserRole.SCHOOL_ADMIN && targetUser.role !== UserRole.SCHOOL_ADMIN) {
      const activeAdminCount = users.filter(u => u.role === UserRole.SCHOOL_ADMIN && u.is_active !== false).length;
      if (activeAdminCount >= 2) {
        showAlert("Opération refusée", "La limite de 2 administrateurs par école est déjà atteinte.");
        return;
      }
    }

    if (targetUser.role === UserRole.SCHOOL_ADMIN && newRole !== UserRole.SCHOOL_ADMIN) {
      const activeAdminCount = users.filter(u => u.role === UserRole.SCHOOL_ADMIN && u.is_active !== false).length;
      if (activeAdminCount <= 1) {
        showAlert("Opération refusée", "Impossible de modifier le rôle du dernier administrateur actif de l'école.");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          role: newRole,
          campus_id: newCampusId || null
        })
        .eq('id', targetUser.id)
        .eq('school_id', currentUser.school_id);

      if (error) throw error;

      await AuditLogger.log({
        school_id: currentUser.school_id,
        user_id: currentUser.id,
        action: 'UPDATE_ROLE',
        entity_type: 'user',
        entity_id: targetUser.id,
        details: {
          user_name: targetUser.full_name || targetUser.email,
          old_role: targetUser.role,
          new_role: newRole,
          old_campus: targetUser.campus_id,
          new_campus: newCampusId || null
        }
      });

      showAlert("Role Mis à Jour", `Le rôle et les privilèges d'accès de ${targetUser.full_name || targetUser.email} ont été mis à jour avec succès.`);
      setEditRoleModal({ isOpen: false, user: null, newRole: UserRole.TEACHER, newCampusId: '' });
      if (selectedUserModal?.id === targetUser.id) {
        setSelectedUserModal(prev => prev ? { ...prev, role: newRole, campus_id: newCampusId || null } : null);
      }
      fetchUsersAndStaff();
    } catch (err: any) {
      console.error("Erreur modification rôle:", err);
      showAlert("Erreur", "Impossible de mettre à jour le rôle : " + (err.message || "Erreur inconnue"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const canManageUser = (targetUser: UserProfile) => {
    if (targetUser.role === UserRole.SUPER_ADMIN || targetUser.is_super_admin || targetUser.id === currentUser.id) return false;
    
    if (currentUser.campus_id && targetUser.campus_id !== currentUser.campus_id) {
       return false;
    }

    // Sécurisation Pilier A : Un compte autonome sous tutelle ne peut pas gérer ni modifier d'autres Administrateurs
    const isTargetAdmin = targetUser.role === UserRole.SCHOOL_ADMIN || targetUser.role === UserRole.DIRECTOR;
    if (isTargetAdmin && isAutonomousAccount(currentUser)) {
       return false;
    }

    if (targetUser.role === UserRole.SCHOOL_ADMIN) {
       return currentUser.is_super_admin || currentUser.role === UserRole.SUPER_ADMIN || currentUser.role === UserRole.SCHOOL_ADMIN;
    }
    return true;
  };

  const handleToggleStatus = (userId: string, userName: string, currentStatus: boolean) => {
    if (!navigator.onLine) {
      showAlert("Erreur", "Action impossible hors-ligne.");
      return;
    }
    
    const targetUser = users.find(u => u.id === userId);
    if (targetUser && !canManageUser(targetUser)) {
      showAlert("Erreur", "Vous n'avez pas les droits nécessaires.");
      return;
    }

    // If trying to reactivate or if the account has expired, open the dedicated Admin Reactivation & Duration modal
    const isExpired = targetUser?.expires_at ? new Date(targetUser.expires_at).getTime() <= Date.now() : false;
    if ((!currentStatus || isExpired) && targetUser) {
      openReopenModal(targetUser);
      return;
    }

    const actionText = currentStatus ? "désactiver" : "réactiver";
    
    showConfirm(
      "Confirmation",
      `Êtes-vous sûr de vouloir ${actionText} l'accès pour ${userName} ?`,
      async () => {
        if (currentStatus) {
          if (targetUser?.role === UserRole.SCHOOL_ADMIN) {
            const activeAdminCount = users.filter(u => u.role === UserRole.SCHOOL_ADMIN && u.is_active !== false).length;
            if (activeAdminCount <= 1) {
              showAlert("Opération refusée", "Impossible de désactiver le dernier administrateur actif de l'école.");
              return;
            }
          }
        } else {
          if (targetUser?.role === UserRole.SCHOOL_ADMIN) {
            const activeAdminCount = users.filter(u => u.role === UserRole.SCHOOL_ADMIN && u.is_active !== false).length;
            if (activeAdminCount >= 2) {
              showAlert("Opération refusée", "La limite de 2 administrateurs par école est déjà atteinte.");
              return;
            }
          }
        }

        const { data, error } = await supabase.rpc('admin_toggle_user_status', {
          p_user_id: userId,
          p_new_status: !currentStatus
        });

        if (!error && data?.success) {
          AuditLogger.log({
            school_id: currentUser.school_id,
            user_id: currentUser.id,
            action: 'UPDATE',
            entity_type: 'user',
            entity_id: userId,
            details: { user_name: userName, status: !currentStatus ? 'active' : 'inactive' }
          });
          
          fetchUsersAndStaff();
        } else {
          showAlert("Erreur", `Erreur lors de la modification du statut : ` + (error?.message || data?.error || "Erreur inconnue"));
        }
      }
    );
  };

  const handleDeleteUser = (userId: string, userName: string) => {
    if (!navigator.onLine) {
      showAlert("Erreur", "Action impossible hors-ligne.");
      return;
    }
    
    const targetUser = users.find(u => u.id === userId);
    if (targetUser && !canManageUser(targetUser)) {
      showAlert("Erreur", "Vous n'avez pas les droits nécessaires.");
      return;
    }

    if (isAutonomousAccount(currentUser)) {
      setDoubleRegardModal({
        isOpen: true,
        title: `Suppression du compte : ${userName}`,
        actionType: 'DELETE_USER',
        description: `Demande de suppression définitive du compte utilisateur de "${userName}" (${targetUser?.email || ''}, Rôle: ${targetUser?.role || ''}).\nEn tant qu'administrateur en mode autonome (sans dossier RH), le principe du Double Regard s'applique : l'action est enregistrée dans les opérations en attente pour validation par un Titulaire certifié RH.`,
        targetEntityType: 'user',
        targetEntityId: userId,
        payload: {
          userId,
          userName,
          email: targetUser?.email,
          role: targetUser?.role
        }
      });
      return;
    }

    showConfirm(
      "Confirmation de suppression",
      `Êtes-vous sûr de vouloir supprimer l'accès pour ${userName} ?`,
      async () => {
        if (targetUser?.role === UserRole.SCHOOL_ADMIN) {
          const adminCount = users.filter(u => u.role === UserRole.SCHOOL_ADMIN).length;
          if (adminCount <= 1) {
            showAlert("Opération refusée", "Impossible de supprimer le dernier administrateur de l'école.");
            return;
          }
        }

        const { data, error } = await supabase.rpc('admin_delete_user', {
          p_user_id: userId
        });

        if (!error && data?.success) {
          AuditLogger.log({
            school_id: currentUser.school_id,
            user_id: currentUser.id,
            action: 'DELETE',
            entity_type: 'user',
            entity_id: userId,
            details: { user_name: userName }
          });
          
          fetchUsersAndStaff();
        } else {
          showAlert("Erreur", "Erreur lors de la suppression : " + (error?.message || data?.error || "Erreur inconnue"));
        }
      }
    );
  };

  const getRoleDisplayName = (role: string) => {
    switch(role) {
      case UserRole.SUPER_ADMIN: return 'Super Administrateur';
      case UserRole.SCHOOL_ADMIN: return 'Administrateur';
      case UserRole.DIRECTOR: return terminology.director || 'Direction';
      case UserRole.SECRETARY: return terminology.secretary || 'Registraire';
      case UserRole.ACCOUNTANT: return terminology.accountant || 'Économat';
      case UserRole.TEACHER: return terminology.teacher || 'Enseignant';
      case UserRole.SUPERVISOR: return terminology.supervisor || 'Doyen / Discipline';
      case UserRole.LIBRARIAN: return 'Bibliothécaire';
      case UserRole.STUDENT: return terminology.student || 'Étudiant';
      case UserRole.PARENT: return 'Parent';
      default: return role?.replace('_', ' ') || 'Inconnu';
    }
  };

  const getRoleBadgeStyle = (role: string) => {
    switch(role) {
      case UserRole.SUPER_ADMIN:
        return { bg: 'bg-indigo-100 text-indigo-700 border-indigo-200', icon: <Sparkles size={12} className="text-indigo-600" /> };
      case UserRole.SCHOOL_ADMIN:
        return { bg: 'bg-amber-100 text-amber-800 border-amber-200', icon: <Crown size={12} className="text-amber-600" /> };
      case UserRole.DIRECTOR:
        return { bg: 'bg-purple-100 text-purple-800 border-purple-200', icon: <Shield size={12} className="text-purple-600" /> };
      case UserRole.ACCOUNTANT:
        return { bg: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: <Wallet size={12} className="text-emerald-600" /> };
      case UserRole.SECRETARY:
        return { bg: 'bg-cyan-100 text-cyan-800 border-cyan-200', icon: <FileText size={12} className="text-cyan-600" /> };
      case UserRole.TEACHER:
        return { bg: 'bg-blue-100 text-blue-800 border-blue-200', icon: <BookOpen size={12} className="text-blue-600" /> };
      case UserRole.SUPERVISOR:
        return { bg: 'bg-rose-100 text-rose-800 border-rose-200', icon: <ClipboardList size={12} className="text-rose-600" /> };
      default:
        return { bg: 'bg-slate-100 text-slate-700 border-slate-200', icon: <User size={12} className="text-slate-600" /> };
    }
  };

  const getAvailableRoles = () => {
    const roles = [
      { value: UserRole.SCHOOL_ADMIN, label: 'Administrateur (Max 2)', desc: 'Accès complet au système et à l\'économat' },
      { value: UserRole.DIRECTOR, label: terminology.director ? `${terminology.director} / Direction` : 'Direction', desc: 'Supervision pédagogique et bilans' },
      { value: UserRole.SECRETARY, label: terminology.secretary ? `${terminology.secretary} / Registraire` : 'Registraire / Admission', desc: 'Gestion des inscriptions et dossier élèves' },
      { value: UserRole.ACCOUNTANT, label: terminology.accountant ? `${terminology.accountant} / Économat` : 'Comptable / Économat', desc: 'Gestion des encaissements et reçus de caisse' },
      { value: UserRole.TEACHER, label: terminology.teacher ? `${terminology.teacher} / Professeur` : 'Professeur / Enseignant', desc: 'Saisie des notes et appel des présences' },
      { value: UserRole.SUPERVISOR, label: terminology.supervisor ? `${terminology.supervisor} / Doyen` : 'Doyen / Discipline', desc: 'Suivi de la discipline et retards' },
      { value: UserRole.LIBRARIAN, label: 'Bibliothécaire', desc: 'Gestion du fonds documentaire' },
    ];

    const activeAdminCount = users.filter(u => u.role === UserRole.SCHOOL_ADMIN && u.is_active !== false).length;
    let filteredRoles = roles;

    if (currentUser.is_super_admin || currentUser.role === UserRole.SUPER_ADMIN || currentUser.role === UserRole.SCHOOL_ADMIN) {
      filteredRoles = roles;
    } else if (currentUser.role === UserRole.DIRECTOR) {
      filteredRoles = roles.filter(r => r.value !== UserRole.SCHOOL_ADMIN && r.value !== UserRole.DIRECTOR);
    } else {
      filteredRoles = roles.filter(r => r.value === UserRole.TEACHER);
    }

    if (activeAdminCount >= 2 && (currentUser.is_super_admin || currentUser.role === UserRole.SUPER_ADMIN || currentUser.role === UserRole.SCHOOL_ADMIN)) {
      filteredRoles = filteredRoles.filter(r => r.value !== UserRole.SCHOOL_ADMIN);
    }
    
    return filteredRoles;
  };

  const getAvailableStaff = () => {
    return staffList.filter(staff => {
      if (!staff.email) return true;
      return !users.some(u => u.email === staff.email);
    });
  };

  // Filtered Users computation
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      if (currentUser.role === UserRole.DIRECTOR) {
        if (u.role === UserRole.SUPER_ADMIN || u.role === UserRole.SCHOOL_ADMIN || u.is_super_admin) return false;
      }
      if (currentUser.role === UserRole.SCHOOL_ADMIN && !currentUser.is_super_admin) {
        if (u.role === UserRole.SUPER_ADMIN || u.is_super_admin) return false;
      }

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const nameMatch = (u.full_name || '').toLowerCase().includes(query);
        const emailMatch = (u.email || '').toLowerCase().includes(query);
        if (!nameMatch && !emailMatch) return false;
      }

      if (campusFilter !== 'ALL') {
        if (campusFilter === 'SIEGE') {
          if (u.campus_id) return false;
        } else {
          if (u.campus_id !== campusFilter) return false;
        }
      }

      if (roleFilter !== 'ALL') {
        if (u.role !== roleFilter) return false;
      }

      if (statusFilter !== 'ALL') {
        const isUserExpired = u.expires_at ? new Date(u.expires_at).getTime() <= Date.now() : false;
        if (statusFilter === 'ACTIVE') {
          if (u.is_active === false || isUserExpired) return false;
        } else if (statusFilter === 'INACTIVE') {
          if (u.is_active !== false) return false;
        } else if (statusFilter === 'EXPIRED') {
          if (!isUserExpired) return false;
        } else if (statusFilter === 'AUTONOMOUS') {
          if (!u.is_autonomous) return false;
        } else if (statusFilter === 'TEMPORARY') {
          if (!u.expires_at) return false;
        }
      }

      return true;
    });
  }, [users, currentUser, searchQuery, campusFilter, roleFilter, statusFilter]);

  // Statistics
  const stats = useMemo(() => {
    const accessibleUsers = users.filter(u => {
      if (currentUser.role === UserRole.DIRECTOR) {
        if (u.role === UserRole.SUPER_ADMIN || u.role === UserRole.SCHOOL_ADMIN || u.is_super_admin) return false;
      }
      if (currentUser.role === UserRole.SCHOOL_ADMIN && !currentUser.is_super_admin) {
        if (u.role === UserRole.SUPER_ADMIN || u.is_super_admin) return false;
      }
      return true;
    });

    const total = accessibleUsers.length;
    const active = accessibleUsers.filter(u => {
      const isExpired = u.expires_at ? new Date(u.expires_at).getTime() <= Date.now() : false;
      return u.is_active !== false && !isExpired;
    }).length;
    const inactive = total - active;
    const siegeCount = accessibleUsers.filter(u => !u.campus_id).length;
    const annexesCount = accessibleUsers.filter(u => Boolean(u.campus_id)).length;
    const adminCount = users.filter(u => u.role === UserRole.SCHOOL_ADMIN && u.is_active !== false).length;
    const expiredCount = accessibleUsers.filter(u => u.expires_at && new Date(u.expires_at).getTime() <= Date.now()).length;
    const autonomousCount = accessibleUsers.filter(u => u.is_autonomous).length;
    const temporaryCount = accessibleUsers.filter(u => Boolean(u.expires_at)).length;
    return { total, active, inactive, siegeCount, annexesCount, adminCount, expiredCount, autonomousCount, temporaryCount };
  }, [users, currentUser]);

  // Password Strength Calculation
  const passwordStrength = useMemo(() => {
    const pwd = formData.password;
    if (!pwd) return { score: 0, label: '', color: 'bg-slate-200' };
    let score = 0;
    if (pwd.length >= 8) score += 1;
    if (/[A-Z]/.test(pwd)) score += 1;
    if (/[0-9]/.test(pwd)) score += 1;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 1;

    if (score <= 1) return { score: 1, label: 'Faible', color: 'bg-rose-500' };
    if (score === 2) return { score: 2, label: 'Moyen', color: 'bg-amber-500' };
    if (score >= 3) return { score: 3, label: 'Fort', color: 'bg-emerald-500' };
    return { score: 0, label: '', color: 'bg-slate-200' };
  }, [formData.password]);

  // Memoized Options for SelectPill Filters & Modals
  const campusFilterOptions = useMemo<SelectOption[]>(() => {
    const opts: SelectOption[] = [
      { value: 'ALL', label: 'Tous les Campus' },
      { value: 'SIEGE', label: 'Siège Social (Global)', badge: 'Central', icon: Building2 }
    ];
    if (campuses && campuses.length > 0) {
      campuses.forEach(c => {
        opts.push({ value: c.id, label: c.name, badge: 'Annexe', icon: MapPin });
      });
    }
    return opts;
  }, [campuses]);

  const roleFilterOptions = useMemo<SelectOption[]>(() => {
    return [
      { value: 'ALL', label: 'Tous les Rôles' },
      { value: UserRole.SCHOOL_ADMIN, label: 'Administrateur', badge: 'Admin', icon: Crown },
      { value: UserRole.DIRECTOR, label: getRoleDisplayName(UserRole.DIRECTOR), badge: 'Dir', icon: Shield },
      { value: UserRole.SECRETARY, label: getRoleDisplayName(UserRole.SECRETARY), badge: 'Sec', icon: FileText },
      { value: UserRole.ACCOUNTANT, label: getRoleDisplayName(UserRole.ACCOUNTANT), badge: 'Compta', icon: Wallet },
      { value: UserRole.TEACHER, label: getRoleDisplayName(UserRole.TEACHER), badge: 'Pédago', icon: BookOpen },
      { value: UserRole.SUPERVISOR, label: getRoleDisplayName(UserRole.SUPERVISOR), badge: 'Discipline', icon: ClipboardList },
      { value: UserRole.LIBRARIAN, label: 'Bibliothécaire', badge: 'Biblio', icon: BookOpen }
    ];
  }, [terminology]);

  const statusFilterOptions = useMemo<SelectOption[]>(() => {
    return [
      { value: 'ALL', label: 'Tous les Statuts' },
      { value: 'ACTIVE', label: 'Comptes Actifs', badge: 'En service', icon: CheckCircle2 },
      { value: 'AUTONOMOUS', label: 'Mode Autonome direct', badge: 'Autonome', icon: Zap },
      { value: 'TEMPORARY', label: 'Comptes Temporaires', badge: 'À durée', icon: Clock },
      { value: 'EXPIRED', label: 'Accès Expirés', badge: 'Échu', icon: AlertTriangle },
      { value: 'INACTIVE', label: 'Inactifs / Suspendus', badge: 'Verrouillé', icon: PowerOff }
    ];
  }, []);

  const staffSelectOptions = useMemo<SelectOption[]>(() => {
    const opts: SelectOption[] = [
      {
        value: '',
        label: '⚡ Mode autonome direct (Sans liaison RH préalable)',
        badge: 'Autonome',
        description: 'Créer un identifiant sans fiche collaborateur RH'
      }
    ];
    getAvailableStaff().forEach(staff => {
      opts.push({
        value: staff.id,
        label: formatStudentName(staff.last_name, staff.first_name).fullName,
        badge: staff.role || 'RH',
        description: staff.email || undefined,
        icon: User
      });
    });
    return opts;
  }, [staffList, users]);

  const roleSelectOptions = useMemo<SelectOption[]>(() => {
    return getAvailableRoles().map(r => ({
      value: r.value,
      label: r.label,
      description: r.desc,
      icon: Shield
    }));
  }, [users, currentUser, terminology]);

  const campusSelectOptions = useMemo<SelectOption[]>(() => {
    const opts: SelectOption[] = [
      {
        value: '',
        label: '🏛️ Siège Social (Accès transversal à toutes les annexes)',
        badge: 'Global',
        icon: Building2
      }
    ];
    if (campuses && campuses.length > 0) {
      campuses.forEach(c => {
        opts.push({
          value: c.id,
          label: `📍 ${c.name}`,
          badge: 'Annexe',
          icon: MapPin
        });
      });
    }
    return opts;
  }, [campuses]);

  return (
    <div className="space-y-3.5 sm:space-y-4 animate-in fade-in duration-300">
      {/* Top Banner Header */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl shadow-2xs border border-slate-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-11 sm:h-11 bg-blue-50 border border-blue-100 text-blue-600 rounded-xl shadow-2xs flex items-center justify-center shrink-0">
            <UserCog size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Gestion des Accès</h2>
              {(currentUser.is_super_admin || currentUser.role === UserRole.SUPER_ADMIN) && (
                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold uppercase tracking-wider rounded-lg border border-indigo-200 flex items-center gap-1">
                  <Sparkles size={11} /> Super Admin
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <div className={`w-2 h-2 rounded-full ${isOffline ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
              <p className="text-slate-500 font-medium text-xs">
                {isOffline ? 'Mode Cache (Hors-ligne)' : 'Habilitations, périmètres d\'annexe et sécurité des comptes'}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button 
            onClick={fetchUsersAndStaff} 
            className="p-2.5 bg-slate-50 text-slate-500 rounded-xl hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-all active:scale-95 shrink-0 cursor-pointer"
            title="Rafraîchir les utilisateurs"
          >
            <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 sm:px-5 py-2.5 rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 text-xs sm:text-sm tracking-tight active:scale-95 cursor-pointer"
          >
            <UserPlus size={16} /> Nouveau Collaborateur
          </button>
        </div>
      </div>

      {/* Overview Statistics Cards */}
      <div className={`grid grid-cols-2 ${campuses && campuses.length > 0 ? 'lg:grid-cols-4' : 'lg:grid-cols-2'} gap-2.5 sm:gap-3`}>
        <div className="bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200/90 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Comptes</p>
            <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5">{stats.total}</h3>
            <p className="text-[10px] text-slate-500 font-medium mt-0.5">{stats.active} actifs · {stats.inactive} inactifs</p>
          </div>
          <div className="w-9 h-9 sm:w-10 sm:h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
            <Users size={18} />
          </div>
        </div>

        <div className="bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200/90 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Administrateurs</p>
            <h3 className="text-xl sm:text-2xl font-bold text-amber-600 mt-0.5">{stats.adminCount} / 2</h3>
            <p className="text-[10px] text-slate-500 font-medium mt-0.5">Plafond de sécurité</p>
          </div>
          <div className="w-9 h-9 sm:w-10 sm:h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center shrink-0">
            <Crown size={18} />
          </div>
        </div>

        {campuses && campuses.length > 0 && (
          <>
            <div className="bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200/90 shadow-2xs flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Siège Social</p>
                <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5">{stats.siegeCount}</h3>
                <p className="text-[10px] text-slate-500 font-medium mt-0.5">Accès transversal école</p>
              </div>
              <div className="w-9 h-9 sm:w-10 sm:h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center shrink-0">
                <Building2 size={18} />
              </div>
            </div>

            <div className="bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200/90 shadow-2xs flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Annexes & Campus</p>
                <h3 className="text-xl sm:text-2xl font-bold text-emerald-600 mt-0.5">{stats.annexesCount}</h3>
                <p className="text-[10px] text-slate-500 font-medium mt-0.5">Affectations restreintes</p>
              </div>
              <div className="w-9 h-9 sm:w-10 sm:h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0">
                <MapPin size={18} />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Filter and Search Bar with SelectPill */}
      <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col md:flex-row gap-2.5 items-stretch md:items-center justify-between">
        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher nom ou email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-7 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-50 transition-all placeholder:text-slate-400"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Dropdown Filters (Harmonized with SelectPill) */}
        <div className="flex flex-wrap items-center gap-2">
          {campuses && campuses.length > 0 && (
            <SelectPill
              options={campusFilterOptions}
              value={campusFilter}
              onChange={setCampusFilter}
              variant="pill"
              size="sm"
              colorScheme="purple"
              icon={Building2}
            />
          )}

          <SelectPill
            options={roleFilterOptions}
            value={roleFilter}
            onChange={setRoleFilter}
            variant="pill"
            size="sm"
            colorScheme="blue"
            icon={Shield}
          />

          <SelectPill
            options={statusFilterOptions}
            value={statusFilter}
            onChange={setStatusFilter}
            variant="pill"
            size="sm"
            colorScheme="slate"
            icon={Filter}
          />
        </div>
      </div>

      {/* Main Users Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden min-h-[350px]">
        {loading && users.length === 0 ? (
          <div className="py-8">
            <FluidLoadingState message="Chargement de l'annuaire des utilisateurs..." subtext="Récupération sécurisée des profils et autorisations" />
            <SkeletonTable rows={5} />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center px-4">
            <div className="w-16 h-16 bg-slate-50 border border-slate-200 text-slate-400 rounded-3xl flex items-center justify-center mb-4">
              <Users size={32} />
            </div>
            <h4 className="text-base font-bold text-slate-800">Aucun utilisateur trouvé</h4>
            <p className="text-xs text-slate-500 max-w-sm mt-1">
              Aucun résultat ne correspond à vos filtres actuels. Modifiez la recherche ou réinitialisez les filtres.
            </p>
            {(searchQuery || campusFilter !== 'ALL' || roleFilter !== 'ALL' || statusFilter !== 'ALL') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setCampusFilter('ALL');
                  setRoleFilter('ALL');
                  setStatusFilter('ALL');
                }}
                className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Réinitialiser les filtres
              </button>
            )}
          </div>
        ) : (
          <ScrollableContainer direction="horizontal" showClickZones={true} ariaLabel="Tableau des utilisateurs avec défilement fluide et zones de clic ciblées">
            <table className="w-full text-left min-w-[650px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th scope="col" className="px-3.5 sm:px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Collaborateur / Utilisateur</th>
                  <th scope="col" className="px-3 sm:px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Rôle & Privilège</th>
                  {campuses && campuses.length > 0 && (
                    <th scope="col" className="px-3 sm:px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Périmètre / Campus</th>
                  )}
                  <th scope="col" className="px-3 sm:px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Statut</th>
                  <th scope="col" className="px-3.5 sm:px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((u) => {
                  const isSuperAdmin = currentUser.is_super_admin || currentUser.role === UserRole.SUPER_ADMIN;
                  const isInactive = u.is_active === false;
                  const roleStyle = getRoleBadgeStyle(u.role);
                  const expiryInfo = getUserExpiryInfo(u);

                  return (
                    <tr key={u.id} className="group hover:bg-slate-50/70 transition-colors">
                      <td className="px-3.5 sm:px-5 py-2.5 sm:py-3 cursor-pointer" onClick={() => setSelectedUserModal(u)}>
                        <div className="flex items-center gap-2.5 sm:gap-3">
                          <div className="w-8 h-8 sm:w-9 sm:h-9 bg-slate-100 border border-slate-200 rounded-xl flex items-center justify-center font-bold text-slate-700 shrink-0 text-xs sm:text-sm shadow-2xs group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 transition-all">
                            {u.full_name?.charAt(0).toUpperCase() || 'U'}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="font-bold text-slate-900 text-xs sm:text-sm truncate group-hover:text-blue-600 transition-colors">
                                {formatFullName(u.full_name || 'Sans Nom')}
                              </p>
                              {isAutonomousAdmin(u) ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded text-[9px] font-black uppercase tracking-wider shrink-0" title="Admin Provisoire en Mode Autonome (Sous Tutelle RH)">
                                  <ShieldAlert size={10} className="text-amber-700" /> Sous Tutelle RH
                                </span>
                              ) : u.is_autonomous ? (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded text-[9px] font-bold shrink-0">
                                  <Zap size={9} /> Mode Autonome
                                </span>
                              ) : null}
                            </div>
                            <div className="flex items-center gap-2 flex-wrap mt-0.5">
                              <p className="text-[11px] text-slate-500 font-medium truncate flex items-center gap-1">
                                <Mail size={11} className="text-slate-400 shrink-0" />
                                {displayIdentifier(u.email)}
                              </p>
                              {u.expires_at && (
                                <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                                  expiryInfo.isExpired 
                                    ? 'bg-rose-50 text-rose-700 border-rose-200' 
                                    : expiryInfo.isExpiringSoon 
                                    ? 'bg-amber-50 text-amber-700 border-amber-200' 
                                    : 'bg-blue-50 text-blue-700 border-blue-200'
                                }`}>
                                  <Clock size={9} /> {expiryInfo.text}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-3 sm:px-4 py-2.5 sm:py-3 cursor-pointer" onClick={() => setSelectedUserModal(u)}>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold ${roleStyle.bg}`}>
                          {roleStyle.icon}
                          <span>{getRoleDisplayName(u.role)}</span>
                        </span>
                      </td>

                      {campuses && campuses.length > 0 && (
                        <td className="px-3 sm:px-4 py-2.5 sm:py-3 cursor-pointer" onClick={() => setSelectedUserModal(u)}>
                          {!u.campus_id ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-100 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                              <Building2 size={11} />
                              Siège Social
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                              <MapPin size={11} />
                              {campuses?.find(c => c.id === u.campus_id)?.name || 'Campus spécifique'}
                            </span>
                          )}
                        </td>
                      )}

                      <td className="px-3 sm:px-4 py-2.5 sm:py-3 cursor-pointer" onClick={() => setSelectedUserModal(u)}>
                        {expiryInfo.isExpired ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-rose-100 text-rose-800 uppercase tracking-wider border border-rose-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                            Expiré
                          </span>
                        ) : !isInactive ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase tracking-wider border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                            Actif
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-700 uppercase tracking-wider border border-slate-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                            Inactif
                          </span>
                        )}
                      </td>

                      <td className="px-3.5 sm:px-5 py-2.5 sm:py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedUserModal(u)}
                            className="p-1.5 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all hover:scale-105 active:scale-95 cursor-pointer"
                            title="Consulter la Fiche Utilisateur"
                          >
                            <Eye size={14} />
                          </button>

                          {canReactivate(u) && (isInactive || expiryInfo.isExpired) && (
                            <button
                              onClick={() => openReopenModal(u)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-2xs transition-all flex items-center gap-1 active:scale-95 cursor-pointer shrink-0"
                              title="Réactiver / Prolonger l'accès (Admin)"
                            >
                              <Clock size={13} />
                              <span className="hidden sm:inline">Réactiver / Prolonger</span>
                            </button>
                          )}

                          {isSuperAdmin && isInactive && !canReactivate(u) && (
                            <button
                              onClick={() => handleRestoreAccess(u)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-2xs transition-all flex items-center gap-1 active:scale-95 cursor-pointer"
                              title="Restaurer l'accès instantanément"
                            >
                              <Unlock size={13} />
                              <span className="hidden sm:inline">Restaurer</span>
                            </button>
                          )}

                          {canManageUser(u) ? (
                            <>
                              {isAutonomousAccount(u) && (currentUser.is_super_admin || currentUser.role === UserRole.SUPER_ADMIN || !isAutonomousAccount(currentUser)) && (
                                <button 
                                  onClick={() => {
                                    openReopenModal(u);
                                    setReopenModal(prev => ({ ...prev, actionType: 'LINK_RH' }));
                                  }}
                                  className="p-2 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-all hover:scale-105 active:scale-95 cursor-pointer"
                                  title="Régulariser : Lier au Registre RH officiel (Pilier D)"
                                >
                                  <UserCheck size={15} />
                                </button>
                              )}

                              <button 
                                onClick={() => setEditRoleModal({
                                  isOpen: true,
                                  user: u,
                                  newRole: u.role,
                                  newCampusId: u.campus_id || ''
                                })}
                                className="p-2 text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-xl transition-all hover:scale-105 active:scale-95 cursor-pointer"
                                title="Modifier le Rôle & Habilitation"
                              >
                                <UserCog size={15} />
                              </button>

                              <button 
                                onClick={() => handleToggleStatus(u.id, u.full_name, !isInactive)}
                                className={`p-2 rounded-xl transition-all hover:scale-105 active:scale-95 cursor-pointer ${
                                  !isInactive ? 'text-amber-600 bg-amber-50 hover:bg-amber-100' : 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100'
                                }`}
                                title={!isInactive ? "Désactiver le compte" : "Réactiver le compte"}
                              >
                                {!isInactive ? <PowerOff size={15} /> : <Power size={15} />}
                              </button>

                              {(currentUser.is_super_admin || currentUser.role === UserRole.SCHOOL_ADMIN || currentUser.role === UserRole.DIRECTOR) && u.email && (
                                <button 
                                  onClick={() => {
                                    showConfirm(
                                      "Envoyer l'email de réinitialisation",
                                      `Voulez-vous envoyer un lien sécurisé de réinitialisation et de déblocage par email à ${u.full_name || u.email} (${u.email}) ?`,
                                      () => handleSendPasswordResetEmail(u)
                                    );
                                  }}
                                  className="p-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-all hover:scale-105 active:scale-95 cursor-pointer"
                                  title="Envoyer un email de réinitialisation / déblocage"
                                >
                                  <Mail size={15} />
                                </button>
                              )}

                              {(currentUser.is_super_admin || currentUser.role === UserRole.SCHOOL_ADMIN || currentUser.role === UserRole.DIRECTOR) && (
                                <button 
                                  onClick={() => setResetModal({ 
                                    isOpen: true, 
                                    userId: u.id, 
                                    fullName: u.full_name || '', 
                                    email: u.email || '',
                                    newPassword: '', 
                                    forceChange: true,
                                    activeTab: u.email ? 'email' : 'manual'
                                  })}
                                  className="p-2 text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-xl transition-all hover:scale-105 active:scale-95 cursor-pointer"
                                  title="Réinitialiser le mot de passe"
                                >
                                  <KeyRound size={15} />
                                </button>
                              )}

                              <button 
                                onClick={() => handleDeleteUser(u.id, u.full_name)}
                                className="p-2 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition-all hover:scale-105 active:scale-95 cursor-pointer"
                                title="Supprimer le compte"
                              >
                                <Trash2 size={15} />
                              </button>
                            </>
                          ) : (
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2.5 py-1 bg-slate-100 rounded-lg">
                              Protégé
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ScrollableContainer>
        )}
      </div>

      {/* Modernized Add User Modal ("Nouveau Collaborateur") */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in">
            <motion.div 
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ duration: 0.2 }}
              className="bg-white w-full max-w-lg rounded-2xl shadow-xl flex flex-col max-h-[92vh] overflow-hidden border border-slate-200"
            >
              <div className="p-3.5 sm:p-4 bg-slate-900 text-white flex items-center justify-between shrink-0 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-600 border border-blue-500 text-white rounded-xl flex items-center justify-center shrink-0 shadow-xs">
                    <UserPlus size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white tracking-tight">Nouveau Collaborateur</h3>
                    <p className="text-[11px] text-slate-300 font-medium">Créer un identifiant et attribuer des habilitations d'accès</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowAddModal(false)} 
                  className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="overflow-y-auto p-3.5 sm:p-5 custom-scrollbar">
                <form onSubmit={handleCreateUser} className="space-y-3 sm:space-y-3.5">
                  {errorMsg && (
                    <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-start gap-2.5 text-xs font-semibold">
                      <AlertCircle size={16} className="mt-0.5 shrink-0 text-rose-600" />
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  {/* 1. Mode de Création : Autonome direct vs Fiche RH */}
                  <div className="space-y-2 p-2.5 sm:p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                        <User size={12} className="text-blue-600" />
                        Mode de Création
                        <InfoTooltip content="Le Mode Autonome permet de créer rapidement un accès sans fiche RH préalable. Vous pouvez définir une durée de validité pour éviter les comptes fantômes." />
                      </label>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                        formData.staff_id ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {formData.staff_id ? '📋 Titulaire RH' : '⚡ Mode Autonome'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({
                            ...prev,
                            staff_id: '',
                            full_name: prev.staff_id ? '' : prev.full_name
                          }));
                        }}
                        className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border ${
                          !formData.staff_id
                            ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <Zap size={13} />
                        <span>Mode Autonome direct</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const firstStaff = getAvailableStaff()[0];
                          if (firstStaff) {
                            setFormData(prev => ({
                              ...prev,
                              staff_id: firstStaff.id,
                              full_name: formatStudentName(firstStaff.last_name, firstStaff.first_name).fullName,
                              email: firstStaff.email || prev.email
                            }));
                          }
                        }}
                        className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border ${
                          formData.staff_id
                            ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <User size={13} />
                        <span>Lier à une fiche RH</span>
                      </button>
                    </div>

                    {formData.staff_id && (
                      <div className="pt-1">
                        <SelectPill
                          options={staffSelectOptions.filter(o => o.value !== '')}
                          value={formData.staff_id}
                          onChange={(selectedVal) => {
                            const staff = staffList.find(s => s.id === selectedVal);
                            let matchedRole = formData.role;
                            if (staff && staff.role) {
                              const r = staff.role.toLowerCase();
                              if (r.includes('directeur') || r.includes('direction') || r.includes('proviseur') || r.includes('dg')) matchedRole = UserRole.DIRECTOR;
                              else if (r.includes('comptable') || r.includes('économe') || r.includes('économat') || r.includes('caisse') || r.includes('finance')) matchedRole = UserRole.ACCOUNTANT;
                              else if (r.includes('secrétaire') || r.includes('registraire') || r.includes('admission')) matchedRole = UserRole.SECRETARY;
                              else if (r.includes('professeur') || r.includes('enseignant') || r.includes('formateur') || r.includes('maître')) matchedRole = UserRole.TEACHER;
                              else if (r.includes('surveillant') || r.includes('doyen') || r.includes('préfet') || r.includes('discipline')) matchedRole = UserRole.SUPERVISOR;
                              else if (r.includes('biblio')) matchedRole = UserRole.LIBRARIAN;
                              else if (r.includes('admin')) matchedRole = UserRole.SCHOOL_ADMIN;
                            }
                            setFormData({
                              ...formData, 
                              staff_id: selectedVal,
                              full_name: staff ? formatStudentName(staff.last_name, staff.first_name).fullName : '',
                              email: staff?.email || formData.email,
                              role: matchedRole
                            });
                          }}
                          placeholder="Sélectionner le collaborateur RH..."
                          variant="field"
                          size="sm"
                          colorScheme="indigo"
                          searchable={true}
                          icon={User}
                          className="w-full"
                        />
                      </div>
                    )}
                  </div>

                  {/* 2. Nom complet & Rôle */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                    <div className="space-y-1">
                      <label htmlFor="full_name" className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                        Nom Complet <span className="text-rose-500">*</span>
                      </label>
                      <input 
                        id="full_name" 
                        required 
                        type="text" 
                        readOnly={!!formData.staff_id} 
                        className={`w-full px-3 py-2 border rounded-xl text-xs sm:text-sm font-semibold outline-none transition-all shadow-2xs ${
                          !!formData.staff_id ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed' : 'bg-slate-50 text-slate-900 border-slate-200 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-50'
                        }`} 
                        value={formData.full_name} 
                        onChange={e => setFormData({...formData, full_name: e.target.value})} 
                        placeholder="Ex: Jean Dupont" 
                      />
                    </div>

                    <div className="space-y-1">
                      <label htmlFor="role" className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                        Rôle & Habilitation <span className="text-rose-500">*</span>
                      </label>
                      <SelectPill
                        options={roleSelectOptions}
                        value={formData.role}
                        onChange={(val) => setFormData({...formData, role: val as UserRole})}
                        variant="field"
                        size="sm"
                        colorScheme="blue"
                        icon={Shield}
                        className="w-full"
                      />
                    </div>
                  </div>

                  {/* 3. Multi-Campus / Périmètre */}
                  {!currentUser.campus_id && campuses && campuses.length > 0 && (
                    <div className="space-y-1 p-2.5 bg-purple-50/50 border border-purple-100 rounded-xl">
                      <label htmlFor="campus_id" className="text-[11px] font-bold text-purple-900 uppercase tracking-wider flex items-center gap-1">
                        <Building2 size={12} className="text-purple-600" />
                        Périmètre Annexe / Multi-Site
                      </label>
                      <SelectPill
                        options={campusSelectOptions}
                        value={formData.campus_id}
                        onChange={(val) => setFormData({...formData, campus_id: val})}
                        variant="field"
                        size="sm"
                        colorScheme="purple"
                        icon={Building2}
                        className="w-full"
                      />
                    </div>
                  )}

                  {/* 4. Durée de Validité & Cycle de Vie du Compte */}
                  <div className="space-y-2 p-2.5 sm:p-3 bg-slate-50/90 border border-slate-200 rounded-xl">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1">
                        <Clock size={12} className="text-amber-600" />
                        Durée de Validité de l'Accès
                        <InfoTooltip content="À l'échéance, le compte est automatiquement verrouillé pour éviter les comptes fantômes. Seul un Administrateur pourra le réactiver ou le prolonger." />
                      </label>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                        formData.accessDurationType === 'TEMPORARY'
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : 'bg-slate-200 text-slate-700'
                      }`}>
                        {formData.accessDurationType === 'TEMPORARY' ? '⏳ Durée Déterminée' : '♾️ Permanent'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, accessDurationType: 'PERMANENT' })}
                        className={`py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer border ${
                          formData.accessDurationType === 'PERMANENT'
                            ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <span>♾️ Permanent / Indéterminé</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, accessDurationType: 'TEMPORARY' })}
                        className={`py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer border ${
                          formData.accessDurationType === 'TEMPORARY'
                            ? 'bg-amber-500 text-white border-amber-600 shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <Timer size={13} />
                        <span>⏳ Durée Déterminée</span>
                      </button>
                    </div>

                    {formData.accessDurationType === 'TEMPORARY' && (
                      <div className="pt-2 space-y-2.5 border-t border-slate-200/80 mt-1">
                        <div>
                          <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider block mb-1">
                            ⚡ Durée Express (Heures) :
                          </span>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mb-2">
                            {[
                              { value: '1H', label: '⚡ 1 heure (Express)' },
                              { value: '2H', label: '⏱️ 2 heures (Dépannage)' },
                              { value: '4H', label: '⏳ 4 heures (Demi-jour)' },
                              { value: '8H', label: '🏢 8 heures (Journée)' },
                            ].map(opt => (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => setFormData({ ...formData, durationPreset: opt.value as any })}
                                className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold transition-all border text-left cursor-pointer ${
                                  formData.durationPreset === opt.value
                                    ? 'bg-amber-500 text-white border-amber-600 font-bold shadow-2xs'
                                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>

                          <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider block mb-1">
                            📅 Durée Étendue (Jours & Mois) :
                          </span>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                            {[
                              { value: 1, label: '🌓 24 heures (1 jour)' },
                              { value: 7, label: '⚡ 7 jours (Urgence)' },
                              { value: 15, label: '📅 15 jours (Court)' },
                              { value: 30, label: '🗓️ 1 mois (30j)' },
                              { value: 90, label: '🏛️ 3 mois (Trimestre)' },
                              { value: 'END_YEAR', label: '🎓 Fin d\'année (30 Juin)' },
                              { value: 'CUSTOM', label: '📆 Date & Heure au choix' }
                            ].map(opt => (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => setFormData({ ...formData, durationPreset: opt.value as any })}
                                className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold transition-all border text-left cursor-pointer ${
                                  formData.durationPreset === opt.value
                                    ? 'bg-amber-500 text-white border-amber-600 font-bold shadow-2xs'
                                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {formData.durationPreset === 'CUSTOM' && (
                          <div className="pt-1">
                            <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                              Choisir la date et l'heure d'expiration exacte :
                            </label>
                            <input
                              type="datetime-local"
                              min={new Date(Date.now() + 5 * 60 * 1000).toISOString().slice(0, 16)}
                              value={formData.customExpiryDate}
                              onChange={(e) => setFormData({ ...formData, customExpiryDate: e.target.value })}
                              className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-amber-200"
                            />
                            <p className="text-[10px] text-slate-500 mt-0.5">
                              Précisez le jour et l'heure de désactivation automatique à la minute près.
                            </p>
                          </div>
                        )}

                        <div className="p-2 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-[11px] font-medium flex items-start gap-1.5">
                          <Clock size={13} className="mt-0.5 text-amber-700 shrink-0" />
                          <span>
                            Ce compte sera actif jusqu'au : <strong>{calculateExpiryDate(formData.durationPreset, formData.customExpiryDate).label}</strong>. À cette échéance, la connexion sera verrouillée automatiquement.
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 4. Identifiant ou Email */}
                  <div className="space-y-1">
                    <label htmlFor="email" className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                      <Mail size={12} className="text-blue-600" />
                      Identifiant ou Email de Connexion <span className="text-rose-500">*</span>
                    </label>
                    <input 
                      id="email" 
                      required 
                      type="text" 
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-50 transition-all placeholder:text-slate-400 shadow-2xs" 
                      value={formData.email} 
                      onChange={e => setFormData({...formData, email: e.target.value})} 
                      placeholder="ex: eugene.roseline ou r.eugene@ecole.ht" 
                    />
                  </div>

                  {/* 5. Mot de passe */}
                  <div className="space-y-2 p-2.5 sm:p-3 bg-slate-50/80 border border-slate-200/90 rounded-xl">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                        <KeyRound size={12} className="text-blue-600" />
                        Mot de passe d'Accès <span className="text-rose-500">*</span>
                      </label>
                      {passwordStrength.label && (
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 text-white rounded-md ${passwordStrength.color}`}>
                          {passwordStrength.label}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="relative">
                        <input 
                          id="password" 
                          required 
                          minLength={8} 
                          type={showPassword ? "text" : "password"} 
                          placeholder="Min. 8 caractères" 
                          className="w-full pl-3 pr-8 py-2 bg-white text-slate-900 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-50 transition-all shadow-2xs" 
                          value={formData.password} 
                          onChange={e => setFormData({...formData, password: e.target.value})} 
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>

                      <div>
                        <input 
                          id="confirmPassword" 
                          required 
                          minLength={8} 
                          type={showPassword ? "text" : "password"} 
                          placeholder="Confirmer mot de passe" 
                          className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-50 transition-all shadow-2xs" 
                          value={formData.confirmPassword} 
                          onChange={e => setFormData({...formData, confirmPassword: e.target.value})} 
                        />
                      </div>
                    </div>

                    <label className="flex items-center gap-2 pt-0.5 cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={formData.forcePasswordChange}
                        onChange={(e) => setFormData({...formData, forcePasswordChange: e.target.checked})}
                        className="w-3.5 h-3.5 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
                      />
                      <span className="text-[10px] font-semibold text-slate-600">
                        Forcer le renouvellement du mot de passe à la première connexion
                      </span>
                    </label>
                  </div>

                  <div className="pt-1">
                    <button 
                      disabled={isSubmitting} 
                      type="submit" 
                      className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-bold text-xs sm:text-sm shadow-xs transition-all flex items-center justify-center gap-2 active:scale-98 disabled:opacity-75 cursor-pointer"
                    >
                      {isSubmitting ? (
                        <SubmittingButtonContent label="Création du compte en cours..." />
                      ) : (
                        <>
                          <ShieldCheck size={16} />
                          <span>Valider et Créer le Compte</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Password Reset Modal */}
      <AnimatePresence>
        {resetModal.isOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[3000] p-3 sm:p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200"
            >
              <div className="p-3.5 sm:p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-500 text-white rounded-xl flex items-center justify-center shrink-0 shadow-xs">
                    <KeyRound size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Réinitialiser l'Accès</h3>
                    <p className="text-[11px] text-slate-300 font-medium truncate max-w-[200px] sm:max-w-xs">{formatFullName(resetModal.fullName || resetModal.email)}</p>
                  </div>
                </div>
                <button onClick={() => setResetModal({ ...resetModal, isOpen: false })} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer">
                  <X size={18} />
                </button>
              </div>

              {/* Mode Tabs */}
              <div className="flex border-b border-slate-200 bg-slate-50/80 p-1.5 gap-1.5">
                <button
                  type="button"
                  onClick={() => setResetModal({ ...resetModal, activeTab: 'email' })}
                  className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    resetModal.activeTab === 'email'
                      ? 'bg-white text-blue-700 shadow-2xs border border-slate-200/80'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-white/50'
                  }`}
                >
                  <Mail size={13} className={resetModal.activeTab === 'email' ? 'text-blue-600' : ''} />
                  <span>Envoi par Email</span>
                </button>

                <button
                  type="button"
                  onClick={() => setResetModal({ ...resetModal, activeTab: 'manual' })}
                  className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    resetModal.activeTab === 'manual'
                      ? 'bg-white text-amber-700 shadow-2xs border border-slate-200/80'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-white/50'
                  }`}
                >
                  <Lock size={13} className={resetModal.activeTab === 'manual' ? 'text-amber-600' : ''} />
                  <span>Saisie Manuelle</span>
                </button>
              </div>

              <div className="p-3.5 sm:p-4 space-y-3">
                {resetModal.activeTab === 'email' ? (
                  <div className="space-y-3">
                    <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                      <div className="flex items-center gap-2 text-indigo-950 font-bold text-xs mb-1">
                        <ShieldCheck size={16} className="text-indigo-600 shrink-0" />
                        <span>Procédure de déblocage autonome</span>
                      </div>
                      <p className="text-[11px] text-indigo-800/90 leading-relaxed">
                        Un lien de réinitialisation sécurisé Supabase Auth sera immédiatement envoyé à l'adresse de l'utilisateur :
                      </p>
                      <div className="mt-2 px-2.5 py-1.5 bg-white rounded-lg border border-indigo-200 font-mono text-xs font-semibold text-indigo-900 flex items-center justify-between">
                        <span className="truncate">{resetModal.email || 'Aucune adresse email configurée'}</span>
                        <span className="text-[9px] font-bold uppercase text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-md shrink-0 ml-2">Destinataire</span>
                      </div>
                      <p className="text-[10px] text-indigo-600/90 mt-1.5">
                        💡 L'envoi réinitialise le compteur d'échecs et débloque le compte dès validation du nouveau mot de passe.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSendPasswordResetEmail({
                        id: resetModal.userId,
                        full_name: resetModal.fullName,
                        email: resetModal.email
                      })}
                      disabled={isSubmitting || !resetModal.email}
                      className="w-full py-2.5 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-xs hover:shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : (
                        <>
                          <Mail size={15} />
                          <span>Envoyer le lien de récupération par email</span>
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-slate-700">
                      Définir manuellement un mot de passe temporaire pour <span className="text-amber-700 font-bold">{resetModal.fullName}</span>.
                    </p>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Nouveau mot de passe temporaire</label>
                      <input 
                        type="text" 
                        autoFocus
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 outline-none focus:border-amber-500 focus:bg-white transition-all"
                        placeholder="Min. 6 caractères"
                        value={resetModal.newPassword}
                        onChange={e => setResetModal({ ...resetModal, newPassword: e.target.value })}
                      />
                    </div>

                    <label className="flex items-start gap-2.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="w-3.5 h-3.5 rounded text-amber-600 focus:ring-amber-500 border-slate-300 mt-0.5"
                        checked={resetModal.forceChange}
                        onChange={(e) => setResetModal({ ...resetModal, forceChange: e.target.checked })}
                      />
                      <span className="text-[11px] font-medium text-slate-600 leading-relaxed">
                        Exiger le changement obligatoire de ce mot de passe à la prochaine ouverture de session.
                      </span>
                    </label>

                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={handleResetPassword}
                        disabled={isSubmitting || resetModal.newPassword.length < 6}
                        className="w-full py-2.5 px-4 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                      >
                        {isSubmitting ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
                        <span>Appliquer le mot de passe temporaire</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
                <button
                  type="button"
                  onClick={() => setResetModal({ ...resetModal, isOpen: false })}
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-lg transition-all cursor-pointer"
                >
                  Fermer
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Enhanced Fiche Utilisateur Modal */}
      <AnimatePresence>
        {selectedUserModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[3000] p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]"
            >
              <div className="p-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
                <div className="flex items-center gap-4">
                  <div className="w-13 h-13 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black text-xl border border-blue-500 shadow-md">
                    {selectedUserModal.full_name ? selectedUserModal.full_name.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div>
                    <h3 className="text-lg font-black tracking-tight text-white">{formatFullName(selectedUserModal.full_name || 'Utilisateur')}</h3>
                    <p className="text-xs text-slate-300 font-medium">{selectedUserModal.email}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedUserModal(null)} 
                  className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex border-b border-slate-200 bg-slate-50 px-6 shrink-0">
                <button
                  onClick={() => setActiveFicheTab('overview')}
                  className={`py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                    activeFicheTab === 'overview'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Aperçu
                </button>
                <button
                  onClick={() => setActiveFicheTab('permissions')}
                  className={`py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                    activeFicheTab === 'permissions'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Permissions du Rôle
                </button>
              </div>

              <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">
                {activeFicheTab === 'overview' && (
                  <>
                    <div className={`p-4 rounded-2xl border flex items-center justify-between ${
                      selectedUserModal.is_active !== false 
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
                        : 'bg-rose-50 border-rose-200 text-rose-900'
                    }`}>
                      <div className="flex items-center gap-3">
                        {selectedUserModal.is_active !== false ? (
                          <CheckCircle2 size={22} className="text-emerald-600 shrink-0" />
                        ) : (
                          <ShieldAlert size={22} className="text-rose-600 shrink-0 animate-bounce" />
                        )}
                        <div>
                          <p className="text-xs font-black uppercase tracking-wider">
                            {selectedUserModal.is_active !== false ? 'Compte Actif' : 'Compte Suspendu / Inactif'}
                          </p>
                          <p className="text-[11px] font-medium opacity-80 mt-0.5">
                            {selectedUserModal.is_active !== false 
                              ? 'L\'utilisateur possède tous les accès attribués à son rôle.' 
                              : 'L\'accès de cet utilisateur est temporairement verrouillé.'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <UserCog size={14} className="text-blue-600" />
                        Attributions Système
                      </h4>

                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <span className="text-slate-400 font-bold block text-[10px] uppercase">Rôle Officiel</span>
                          <span className="font-black text-slate-900 mt-0.5 block">
                            {getRoleDisplayName(selectedUserModal.role)}
                          </span>
                        </div>

                        {campuses && campuses.length > 0 && (
                          <div>
                            <span className="text-slate-400 font-bold block text-[10px] uppercase">Périmètre / Annexe</span>
                            <span className="font-black text-slate-900 mt-0.5 block">
                              {selectedUserModal.campus_id 
                                ? (campuses?.find(c => c.id === selectedUserModal.campus_id)?.name || 'Campus spécifique') 
                                : '🏛️ Siège Social (Global)'}
                            </span>
                          </div>
                        )}

                        <div>
                          <span className="text-slate-400 font-bold block text-[10px] uppercase">Identifiant UUID</span>
                          <span className="font-mono text-[10px] font-bold text-slate-600 truncate block mt-0.5">
                            {selectedUserModal.id}
                          </span>
                        </div>

                        <div>
                          <span className="text-slate-400 font-bold block text-[10px] uppercase">Mode de Création</span>
                          <span className="font-bold text-slate-700 mt-0.5 block">
                            {selectedUserModal.is_autonomous ? (
                              <span className="inline-flex items-center gap-1 text-amber-700 font-bold">
                                <Zap size={12} className="text-amber-600" /> Mode Autonome direct
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-indigo-700 font-bold">
                                <User size={12} className="text-indigo-600" /> Lié au registre RH
                              </span>
                            )}
                          </span>
                        </div>

                        <div className="col-span-2 p-3 bg-white border border-slate-200 rounded-xl">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500 font-bold text-[10px] uppercase tracking-wider flex items-center gap-1">
                              <Clock size={12} className="text-blue-600" />
                              Validité & Cycle de Vie
                            </span>
                            {selectedUserModal.expires_at ? (
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                getUserExpiryInfo(selectedUserModal).isExpired
                                  ? 'bg-rose-100 text-rose-800'
                                  : getUserExpiryInfo(selectedUserModal).isExpiringSoon
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}>
                                {getUserExpiryInfo(selectedUserModal).text}
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded">
                                ♾️ Accès Permanent
                              </span>
                            )}
                          </div>
                          {selectedUserModal.expires_at && (
                            <p className="text-xs font-semibold text-slate-700 mt-1">
                              Échéance : <strong>{new Date(selectedUserModal.expires_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</strong>
                              {selectedUserModal.access_duration_label && (
                                <span className="text-slate-500 ml-1">({selectedUserModal.access_duration_label})</span>
                              )}
                            </p>
                          )}
                        </div>
                      </div>

                      {canManageUser(selectedUserModal) && (
                        <div className="pt-2 border-t border-slate-200">
                          <button
                            onClick={() => setEditRoleModal({
                              isOpen: true,
                              user: selectedUserModal,
                              newRole: selectedUserModal.role,
                              newCampusId: selectedUserModal.campus_id || ''
                            })}
                            className="w-full py-2.5 px-4 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-98"
                          >
                            <UserCog size={15} />
                            <span>Modifier le Rôle & Habilitations</span>
                          </button>
                        </div>
                      )}

                      {isAutonomousAccount(selectedUserModal) && (currentUser.is_super_admin || currentUser.role === UserRole.SUPER_ADMIN || !isAutonomousAccount(currentUser)) && (
                        <div className="pt-2 border-t border-slate-200">
                          <button
                            type="button"
                            onClick={() => {
                              const target = selectedUserModal;
                              setSelectedUserModal(null);
                              openReopenModal(target);
                              setReopenModal(prev => ({ ...prev, actionType: 'LINK_RH' }));
                            }}
                            className="w-full py-2.5 px-4 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-98"
                          >
                            <UserCheck size={15} />
                            <span>Régulariser : Lier au Registre RH officiel (Pilier D)</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {activeFicheTab === 'permissions' && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <ShieldCheck size={16} className="text-blue-600" />
                      Matrice des Privilèges ({getRoleDisplayName(selectedUserModal.role)})
                    </h4>
                    <div className="space-y-2">
                      {getRolePermissionsSummary(selectedUserModal.role, terminology).map((perm, idx) => (
                        <div 
                          key={idx}
                          className={`p-3 rounded-xl border flex items-center justify-between text-xs font-bold ${
                            perm.allowed 
                              ? 'bg-emerald-50/50 border-emerald-100 text-slate-800' 
                              : 'bg-slate-50 border-slate-200 text-slate-400 line-through'
                          }`}
                        >
                          <span>{perm.label}</span>
                          {perm.allowed ? (
                            <Check size={16} className="text-emerald-600 shrink-0" />
                          ) : (
                            <X size={16} className="text-slate-400 shrink-0" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
                <button
                  onClick={() => setSelectedUserModal(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
                >
                  Fermer
                </button>

                {canManageUser(selectedUserModal) && (
                  <div className="flex flex-wrap items-center gap-2">
                    {selectedUserModal.email && (
                      <button
                        onClick={() => {
                          const target = selectedUserModal;
                          setSelectedUserModal(null);
                          showConfirm(
                            "Envoyer l'email de réinitialisation",
                            `Voulez-vous envoyer un lien sécurisé de réinitialisation et de déblocage par email à ${target.full_name || target.email} (${target.email}) ?`,
                            () => handleSendPasswordResetEmail(target)
                          );
                        }}
                        className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer"
                        title="Envoyer un email de déblocage et de réinitialisation"
                      >
                        <Mail size={14} />
                        <span>Email de déblocage</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        const target = selectedUserModal;
                        setSelectedUserModal(null);
                        setResetModal({
                          isOpen: true,
                          userId: target.id,
                          fullName: target.full_name || '',
                          email: target.email || '',
                          newPassword: '',
                          forceChange: true,
                          activeTab: target.email ? 'email' : 'manual'
                        });
                      }}
                      className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <KeyRound size={14} />
                      <span>Réinitialiser</span>
                    </button>

                    {canReactivate(selectedUserModal) && (
                      <button
                        onClick={() => {
                          const target = selectedUserModal;
                          setSelectedUserModal(null);
                          openReopenModal(target);
                        }}
                        className={`px-3.5 py-2 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 ${
                          selectedUserModal.is_active === false || getUserExpiryInfo(selectedUserModal).isExpired
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200'
                        }`}
                        title="Réactiver le compte ou ajuster sa durée de validité"
                      >
                        <Clock size={14} />
                        <span>
                          {selectedUserModal.is_active === false || getUserExpiryInfo(selectedUserModal).isExpired
                            ? 'Réactiver / Prolonger'
                            : 'Gérer la Durée'}
                        </span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        const currentStat = selectedUserModal.is_active !== false;
                        handleToggleStatus(selectedUserModal.id, selectedUserModal.full_name || '', currentStat);
                      }}
                      className={`px-3.5 py-2 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                        selectedUserModal.is_active !== false 
                          ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200' 
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      }`}
                    >
                      {selectedUserModal.is_active !== false ? <PowerOff size={14} /> : <Power size={14} />}
                      <span>{selectedUserModal.is_active !== false ? 'Désactiver' : 'Réactiver'}</span>
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Role & Campus Modal */}
      <AnimatePresence>
        {editRoleModal.isOpen && editRoleModal.user && (
          <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in">
            <motion.div 
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ duration: 0.2 }}
              className="bg-white w-full max-w-md rounded-2xl shadow-xl flex flex-col max-h-[90vh] overflow-hidden border border-slate-200"
            >
              <div className="p-3.5 sm:p-4 bg-slate-900 text-white flex items-center justify-between shrink-0 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-600 text-white rounded-xl flex items-center justify-center shrink-0 shadow-xs">
                    <UserCog size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white tracking-tight">Modifier Habilitations</h3>
                    <p className="text-[11px] text-slate-300 font-medium truncate max-w-[200px] sm:max-w-xs">{formatFullName(editRoleModal.user.full_name || editRoleModal.user.email)}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setEditRoleModal({ isOpen: false, user: null, newRole: UserRole.TEACHER, newCampusId: '' })} 
                  className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-3.5 sm:p-4 space-y-3 overflow-y-auto custom-scrollbar">
                <div className="space-y-1">
                  <label htmlFor="edit_role" className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                    <Shield size={12} className="text-purple-600" />
                    Rôle Système & Habilitation
                  </label>
                  <SelectPill
                    options={roleSelectOptions}
                    value={editRoleModal.newRole}
                    onChange={(val) => setEditRoleModal({ ...editRoleModal, newRole: val as UserRole })}
                    variant="field"
                    size="sm"
                    colorScheme="purple"
                    icon={Shield}
                    className="w-full"
                  />
                </div>

                <div className="p-2.5 bg-purple-50/70 border border-purple-100 rounded-xl space-y-1">
                  <div className="flex items-center gap-1.5 text-purple-900 text-[11px] font-bold uppercase tracking-wider">
                    <ShieldCheck size={14} className="text-purple-600 shrink-0" />
                    <span>Périmètre & Privilèges Accordés</span>
                  </div>
                  <p className="text-[11px] font-semibold text-slate-700 leading-relaxed">
                    {getAvailableRoles().find(r => r.value === editRoleModal.newRole)?.desc || 'Accès restreint selon le rôle'}
                  </p>
                </div>

                {!currentUser.campus_id && campuses && campuses.length > 0 && (
                  <div className="space-y-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                    <label htmlFor="edit_campus_id" className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                      <Building2 size={12} className="text-purple-600" />
                      Affectation Périmètre / Annexe
                    </label>
                    <SelectPill
                      options={campusSelectOptions}
                      value={editRoleModal.newCampusId}
                      onChange={(val) => setEditRoleModal({ ...editRoleModal, newCampusId: val })}
                      variant="field"
                      size="sm"
                      colorScheme="purple"
                      icon={Building2}
                      className="w-full"
                    />
                  </div>
                )}
              </div>

              <div className="p-3 sm:p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditRoleModal({ isOpen: false, user: null, newRole: UserRole.TEACHER, newCampusId: '' })}
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-lg transition-all cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleUpdateUserRoleAndCampus}
                  className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-lg shadow-2xs transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                  <span>Enregistrer l'habilitation</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reactivate & Extend Access Modal (Admin Only) */}
      <AnimatePresence>
        {reopenModal.isOpen && reopenModal.user && (
          <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in">
            <motion.div 
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ duration: 0.2 }}
              className="bg-white w-full max-w-lg rounded-2xl shadow-xl flex flex-col max-h-[92vh] overflow-hidden border border-slate-200"
            >
              {/* Header */}
              <div className="p-3.5 sm:p-4 bg-slate-900 text-white flex items-center justify-between shrink-0 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-600 border border-emerald-500 text-white rounded-xl flex items-center justify-center shrink-0 shadow-xs">
                    <Clock size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white tracking-tight">Réactiver / Prolonger l'Accès</h3>
                    <p className="text-[11px] text-slate-300 font-medium truncate max-w-[260px] sm:max-w-xs">
                      {formatFullName(reopenModal.user.full_name || reopenModal.user.email)} • {getRoleDisplayName(reopenModal.user.role)}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setReopenModal({ ...reopenModal, isOpen: false, user: null })} 
                  className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div className="p-4 sm:p-5 space-y-3.5 overflow-y-auto custom-scrollbar">
                {/* Status card */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-bold uppercase text-[10px]">Statut Actuel :</span>
                    <span className={`px-2 py-0.5 rounded font-bold text-[10px] uppercase ${
                      reopenModal.user.is_active === false
                        ? 'bg-rose-100 text-rose-800'
                        : getUserExpiryInfo(reopenModal.user).isExpired
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {reopenModal.user.is_active === false ? 'Compte Suspendu' : getUserExpiryInfo(reopenModal.user).isExpired ? 'Accès Expiré' : 'Compte Actif'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Mode de création :</span>
                      <span className="font-semibold text-slate-700">
                        {reopenModal.user.is_autonomous ? '⚡ Mode Autonome' : '📋 Lié au registre RH'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Périmètre / Annexe :</span>
                      <span className="font-semibold text-slate-700">
                        {reopenModal.user.campus_id ? (campuses?.find(c => c.id === reopenModal.user?.campus_id)?.name || 'Annexe') : 'Siège Social'}
                      </span>
                    </div>
                  </div>

                  {reopenModal.user.expires_at && (
                    <div className="pt-1.5 border-t border-slate-200/80 text-[11px] text-slate-600">
                      <span>Dernière échéance enregistrée : </span>
                      <strong>{new Date(reopenModal.user.expires_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
                    </div>
                  )}
                </div>

                {/* Admin authorization reminder */}
                <div className="p-2.5 bg-indigo-50/70 border border-indigo-100 rounded-xl flex items-center gap-2 text-indigo-900 text-xs font-semibold">
                  <ShieldCheck size={16} className="text-indigo-600 shrink-0" />
                  <span>Opération d'Administration : la décision de réactivation et de durée est enregistrée sous votre responsabilité d'administrateur.</span>
                </div>

                {/* Action Choices */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                    Mode de Réactivation & Durée souhaitée :
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setReopenModal({ ...reopenModal, actionType: 'PROLONG' })}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-left flex flex-col gap-1 cursor-pointer ${
                        reopenModal.actionType === 'PROLONG'
                          ? 'bg-amber-500 text-white border-amber-600 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <Timer size={14} />
                        <span>Durée Déterminée</span>
                      </div>
                      <span className={`text-[10px] font-medium ${reopenModal.actionType === 'PROLONG' ? 'text-amber-100' : 'text-slate-500'}`}>
                        Définir une nouvelle échéance
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setReopenModal({ ...reopenModal, actionType: 'PERMANENT' })}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-left flex flex-col gap-1 cursor-pointer ${
                        reopenModal.actionType === 'PERMANENT'
                          ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 size={14} />
                        <span>Accès Permanent</span>
                      </div>
                      <span className={`text-[10px] font-medium ${reopenModal.actionType === 'PERMANENT' ? 'text-slate-300' : 'text-slate-500'}`}>
                        Sans date limite
                      </span>
                    </button>

                    {reopenModal.user.is_autonomous && (
                      <button
                        type="button"
                        onClick={() => setReopenModal({ ...reopenModal, actionType: 'LINK_RH' })}
                        className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-left flex flex-col gap-1 cursor-pointer col-span-2 sm:col-span-1 ${
                          reopenModal.actionType === 'LINK_RH'
                            ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <User size={14} />
                          <span>Lier au Registre RH</span>
                        </div>
                        <span className={`text-[10px] font-medium ${reopenModal.actionType === 'LINK_RH' ? 'text-indigo-200' : 'text-slate-500'}`}>
                          Convertir en titulaire
                        </span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Sub-form based on ActionType */}
                {reopenModal.actionType === 'PROLONG' && (
                  <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2.5">
                    <label className="text-[11px] font-bold text-amber-900 uppercase tracking-wider block">
                      Sélectionnez la période de prolongation :
                    </label>
                    <div>
                      <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider block mb-1">
                        ⚡ Durée Express (Heures) :
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mb-2">
                        {[
                          { value: '1H', label: '⚡ 1 heure (Express)' },
                          { value: '2H', label: '⏱️ 2 heures (Dépannage)' },
                          { value: '4H', label: '⏳ 4 heures (Demi-jour)' },
                          { value: '8H', label: '🏢 8 heures (Journée)' },
                        ].map(opt => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setReopenModal({ ...reopenModal, durationPreset: opt.value as any })}
                            className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold transition-all border text-left cursor-pointer ${
                              reopenModal.durationPreset === opt.value
                                ? 'bg-amber-500 text-white border-amber-600 font-bold shadow-2xs'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>

                      <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider block mb-1">
                        📅 Durée Étendue (Jours & Mois) :
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                        {[
                          { value: 1, label: '🌓 24 heures (1 jour)' },
                          { value: 7, label: '⚡ 7 jours (Urgence)' },
                          { value: 15, label: '📅 15 jours (Court)' },
                          { value: 30, label: '🗓️ 1 mois (30 jours)' },
                          { value: 90, label: '🏛️ 3 mois (Trimestre)' },
                          { value: 'END_YEAR', label: '🎓 Fin d\'année (30 Juin)' },
                          { value: 'CUSTOM', label: '📆 Date & Heure au choix' }
                        ].map(opt => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setReopenModal({ ...reopenModal, durationPreset: opt.value as any })}
                            className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold transition-all border text-left cursor-pointer ${
                              reopenModal.durationPreset === opt.value
                                ? 'bg-amber-500 text-white border-amber-600 font-bold shadow-2xs'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {reopenModal.durationPreset === 'CUSTOM' && (
                      <div className="pt-1">
                        <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                          Date et heure d'expiration exacte :
                        </label>
                        <input
                          type="datetime-local"
                          min={new Date(Date.now() + 5 * 60 * 1000).toISOString().slice(0, 16)}
                          value={reopenModal.customExpiryDate}
                          onChange={(e) => setReopenModal({ ...reopenModal, customExpiryDate: e.target.value })}
                          className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-amber-200"
                        />
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          Précisez le jour et l'heure exacte de verrouillage.
                        </p>
                      </div>
                    )}

                    <div className="p-2 bg-white/90 border border-amber-200 text-amber-950 rounded-lg text-xs font-medium flex items-start gap-2 mt-1">
                      <Clock size={14} className="mt-0.5 text-amber-600 shrink-0" />
                      <span>
                        Nouvelle échéance : <strong>{calculateExpiryDate(reopenModal.durationPreset, reopenModal.customExpiryDate).label}</strong>.
                      </span>
                    </div>
                  </div>
                )}

                {reopenModal.actionType === 'PERMANENT' && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs text-slate-700">
                    <p className="font-semibold text-slate-900 flex items-center gap-1.5">
                      <CheckCircle2 size={15} className="text-emerald-600" />
                      Accès Permanent et Indéterminé
                    </p>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Ce compte sera réactivé sans date limite. Il n'expirera plus automatiquement et restera actif jusqu'à ce qu'un administrateur décide manuellement de le suspendre.
                    </p>
                  </div>
                )}

                {reopenModal.actionType === 'LINK_RH' && (
                  <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2">
                    <label className="text-[11px] font-bold text-indigo-950 uppercase tracking-wider block">
                      Choisir le collaborateur RH correspondant :
                    </label>
                    <SelectPill
                      options={staffSelectOptions.filter(o => o.value !== '')}
                      value={reopenModal.linkStaffId}
                      onChange={(val) => setReopenModal({ ...reopenModal, linkStaffId: val })}
                      placeholder="Sélectionner la fiche RH..."
                      variant="field"
                      size="sm"
                      colorScheme="indigo"
                      searchable={true}
                      icon={User}
                      className="w-full"
                    />
                    <p className="text-[11px] text-indigo-800 leading-relaxed">
                      L'adresse email de ce compte sera synchronisée avec la fiche RH sélectionnée, et le compte basculera en mode Titulaire Permanent.
                    </p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setReopenModal({ ...reopenModal, isOpen: false, user: null })}
                  className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={isSubmitting || (reopenModal.actionType === 'LINK_RH' && !reopenModal.linkStaffId)}
                  onClick={handleReactivateAndExtend}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-98"
                >
                  {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Power size={14} />}
                  <span>Confirmer la Réactivation</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation & Alert Dialog Modal (Encart Moderne & Propre) */}
      <AnimatePresence>
        {dialog.isOpen && (() => {
          const lowerTitle = (dialog.title || '').toLowerCase();
          const lowerMsg = (dialog.message || '').toLowerCase();
          
          let variant: 'email' | 'warning' | 'danger' | 'success' | 'info' = dialog.variant || 'info';
          if (!dialog.variant) {
            if (lowerTitle.includes('email') || lowerTitle.includes('réinitialis') || lowerMsg.includes('email') || lowerMsg.includes('lien sécurisé')) {
              variant = 'email';
            } else if (lowerTitle.includes('suppression') || lowerTitle.includes('supprimer') || lowerMsg.includes('supprimer')) {
              variant = 'danger';
            } else if (lowerTitle.includes('désactiver') || lowerTitle.includes('suspendre') || lowerMsg.includes('désactiver') || lowerMsg.includes('suspendre')) {
              variant = 'warning';
            } else if (lowerTitle.includes('débloquer') || lowerTitle.includes('réactiver') || lowerTitle.includes('succès') || lowerTitle.includes('restauré') || lowerTitle.includes('mis à jour')) {
              variant = 'success';
            } else if (lowerTitle.includes('erreur') || lowerTitle.includes('refusée')) {
              variant = 'danger';
            } else {
              variant = dialog.type === 'confirm' ? 'warning' : 'info';
            }
          }

          // Check if message matches the email reset prompt pattern: e.g. "à Nom (email) ?"
          const emailMatch = dialog.message.match(/à\s+([^()]+)\s*\(([^()]+)\)/i);
          const recipientName = emailMatch ? formatFullName(emailMatch[1].trim()) : '';
          const recipientEmail = emailMatch ? emailMatch[2].trim() : '';

          const config = {
            email: {
              icon: Mail,
              iconBg: 'bg-indigo-600',
              badgeText: 'Authentification & Sécurité',
              badgeClass: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
              btnGradient: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs hover:shadow-sm',
              defaultConfirm: "Envoyer l'email",
              btnIcon: Send
            },
            warning: {
              icon: AlertTriangle,
              iconBg: 'bg-amber-500',
              badgeText: 'Confirmation requise',
              badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
              btnGradient: 'bg-amber-600 hover:bg-amber-700 text-white shadow-xs hover:shadow-sm',
              defaultConfirm: 'Confirmer',
              btnIcon: Check
            },
            danger: {
              icon: AlertCircle,
              iconBg: 'bg-rose-600',
              badgeText: 'Action sensible',
              badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
              btnGradient: 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs hover:shadow-sm',
              defaultConfirm: dialog.type === 'confirm' ? 'Confirmer' : 'Fermer',
              btnIcon: Check
            },
            success: {
              icon: CheckCircle2,
              iconBg: 'bg-emerald-600',
              badgeText: 'Opération validée',
              badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
              btnGradient: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs hover:shadow-sm',
              defaultConfirm: dialog.type === 'confirm' ? 'Confirmer' : 'OK',
              btnIcon: Check
            },
            info: {
              icon: ShieldCheck,
              iconBg: 'bg-blue-600',
              badgeText: 'Information système',
              badgeClass: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
              btnGradient: 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs hover:shadow-sm',
              defaultConfirm: 'OK',
              btnIcon: Check
            }
          }[variant];

          const IconComponent = config.icon;
          const BtnIcon = config.btnIcon;

          return (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[3000] p-3 sm:p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.96, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 12 }}
                transition={{ duration: 0.18 }}
                className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 flex flex-col"
              >
                {/* Header */}
                <div className="p-3.5 sm:p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 ${config.iconBg} text-white rounded-xl flex items-center justify-center shrink-0 shadow-xs`}>
                      <IconComponent size={18} />
                    </div>
                    <div className="min-w-0">
                      <span className={`inline-block text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border mb-0.5 ${config.badgeClass}`}>
                        {config.badgeText}
                      </span>
                      <h3 className="text-sm sm:text-base font-bold text-white tracking-tight truncate">
                        {dialog.title}
                      </h3>
                    </div>
                  </div>
                  <button 
                    onClick={() => setDialog({ ...dialog, isOpen: false })} 
                    className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                    title="Fermer"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Body Content */}
                <div className="p-4 sm:p-5 space-y-3">
                  {variant === 'email' && emailMatch ? (
                    <>
                      <p className="text-xs text-slate-600 font-medium leading-relaxed">
                        Vous êtes sur le point d'envoyer un lien sécurisé de réinitialisation et de déblocage par messagerie :
                      </p>

                      {/* Recipient card */}
                      <div className="p-3 bg-slate-50 border border-slate-200/90 rounded-xl space-y-2">
                        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          <span>Compte Cible</span>
                          <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100 font-semibold lowercase">
                            Lien actif 24h
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-2xs">
                            {recipientName.charAt(0).toUpperCase() || 'U'}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                              {recipientName}
                            </p>
                            <p className="text-[11px] text-slate-600 font-mono truncate flex items-center gap-1.5 mt-0.5">
                              <Mail size={12} className="text-indigo-500 shrink-0" />
                              <span className="font-semibold">{recipientEmail}</span>
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Security highlight */}
                      <div className="p-2.5 bg-indigo-50/70 border border-indigo-100/90 rounded-xl flex items-start gap-2 text-indigo-900">
                        <ShieldCheck size={15} className="text-indigo-600 shrink-0 mt-0.5" />
                        <p className="text-[11px] leading-relaxed">
                          La réception de cet email réinitialisera automatiquement le compteur d'échecs de connexion et permettra à l'utilisateur de redéfinir son mot de passe en toute autonomie.
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs sm:text-sm font-medium text-slate-800 leading-relaxed">
                        {dialog.message}
                      </div>

                      {variant === 'warning' && (
                        <div className="p-2.5 bg-amber-50/80 border border-amber-200/80 rounded-xl flex items-start gap-2 text-[11px] text-amber-900 font-medium">
                          <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                          <span>Cette action modifiera immédiatement le statut d'accès de l'utilisateur.</span>
                        </div>
                      )}

                      {variant === 'danger' && (
                        <div className="p-2.5 bg-rose-50/80 border border-rose-200/80 rounded-xl flex items-start gap-2 text-[11px] text-rose-900 font-medium">
                          <AlertCircle size={14} className="text-rose-600 shrink-0 mt-0.5" />
                          <span>Attention : Cette opération est sensible et restreindra l'accès au portail.</span>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Footer Buttons */}
                <div className="p-3 sm:p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5 shrink-0">
                  {dialog.type === 'confirm' && (
                    <button
                      type="button"
                      onClick={() => setDialog({ ...dialog, isOpen: false })}
                      className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 rounded-xl border border-slate-200 transition-all cursor-pointer"
                    >
                      {dialog.cancelText || 'Annuler'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setDialog({ ...dialog, isOpen: false });
                      if (dialog.onConfirm) dialog.onConfirm();
                    }}
                    className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer active:scale-98 ${config.btnGradient}`}
                  >
                    <BtnIcon size={14} />
                    <span>{dialog.confirmText || config.defaultConfirm}</span>
                  </button>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* Modal Double Regard pour opérations critiques */}
      <DoubleRegardSubmitModal
        isOpen={doubleRegardModal.isOpen}
        onClose={() => setDoubleRegardModal(prev => ({ ...prev, isOpen: false }))}
        user={currentUser}
        title={doubleRegardModal.title}
        actionType={doubleRegardModal.actionType}
        description={doubleRegardModal.description}
        targetEntityType={doubleRegardModal.targetEntityType}
        targetEntityId={doubleRegardModal.targetEntityId}
        payload={doubleRegardModal.payload}
        campusId={currentUser.campus_id}
        onSuccess={() => {
          fetchUsersAndStaff();
        }}
      />
    </div>
  );
};

export default UserManagementView;
