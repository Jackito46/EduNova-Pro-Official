import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Users, UserPlus, Shield, Mail, Trash2, 
  ShieldCheck, Crown, UserCog, Loader2, RefreshCcw, AlertCircle, Power, PowerOff, X, Lock,
  Unlock, Eye, EyeOff, User, CheckCircle2, ShieldAlert, Search, Filter, Building2, MapPin,
  Sparkles, KeyRound, Check, Info, Wallet, BookOpen, ClipboardList, FileText
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
import { SkeletonTable, FluidLoadingState, SubmittingButtonContent } from './SkeletonLoader';
import { SelectPill } from './SelectPill';

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
    onConfirm?: () => void;
  }>({ isOpen: false, type: 'alert', title: '', message: '' });

  const showAlert = (title: string, message: string) => {
    setDialog({ isOpen: true, type: 'alert', title, message });
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setDialog({ isOpen: true, type: 'confirm', title, message, onConfirm });
  };

  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    role: UserRole.TEACHER,
    password: '',
    confirmPassword: '',
    staff_id: '',
    campus_id: '',
    forcePasswordChange: true
  });

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

    const validationResult = userSchema.safeParse({
      email: formData.email,
      password: formData.password,
      full_name: formData.full_name,
      role: formData.role,
      campus_id: formData.campus_id,
      linked_staff_id: formData.staff_id
    });
    
    if (!validationResult.success) {
      setErrorMsg(validationResult.error.issues[0].message);
      return;
    }

    // Check for max 2 admins per school
    if (formData.role === UserRole.SCHOOL_ADMIN) {
      const adminCount = users.filter(u => u.role === UserRole.SCHOOL_ADMIN && u.is_active !== false).length;
      if (adminCount >= 2) {
        setErrorMsg("La limite de 2 administrateurs par école est atteinte. Veuillez choisir un autre rôle ou désactiver un administrateur existant.");
        return;
      }
    } else {
      if (!formData.staff_id) {
        setErrorMsg("Veuillez sélectionner un membre du personnel pour ce rôle.");
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
            campus_id: finalCampusId
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
          details: { email: normalizedEmail, role: formData.role, full_name: formData.full_name, staff_id: formData.staff_id, campus_id: finalCampusId }
        });
        
        fetchUsersAndStaff();
        setShowAddModal(false);
        setFormData({ email: '', full_name: '', role: UserRole.TEACHER, password: '', confirmPassword: '', staff_id: '', campus_id: '', forcePasswordChange: true });
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

  const handleUpdateUserRoleAndCampus = async () => {
    if (!editRoleModal.user) return;
    const targetUser = editRoleModal.user;
    const { newRole, newCampusId } = editRoleModal;

    if (!canManageUser(targetUser)) {
      showAlert("Erreur", "Vous n'avez pas les droits nécessaires pour modifier cet utilisateur.");
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
        if (statusFilter === 'ACTIVE' && u.is_active === false) return false;
        if (statusFilter === 'INACTIVE' && u.is_active !== false) return false;
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
    const active = accessibleUsers.filter(u => u.is_active !== false).length;
    const inactive = total - active;
    const siegeCount = accessibleUsers.filter(u => !u.campus_id).length;
    const annexesCount = accessibleUsers.filter(u => Boolean(u.campus_id)).length;
    const adminCount = users.filter(u => u.role === UserRole.SCHOOL_ADMIN && u.is_active !== false).length;
    return { total, active, inactive, siegeCount, annexesCount, adminCount };
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

  return (
    <div className="space-y-3 sm:space-y-3.5 max-w-7xl mx-auto pb-10 px-2 sm:px-4 animate-in fade-in duration-300">
      {/* Top Banner Header */}
      <div className="bg-white p-3.5 sm:p-4 rounded-xl shadow-xs border border-slate-200/90 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-11 sm:h-11 bg-blue-50 border border-blue-100 text-blue-600 rounded-xl shadow-xs flex items-center justify-center shrink-0">
            <UserCog size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight font-serif">Gestion des Accès</h2>
              {(currentUser.is_super_admin || currentUser.role === UserRole.SUPER_ADMIN) && (
                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-black uppercase tracking-wider rounded-md border border-indigo-200 flex items-center gap-1">
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
        <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
          <button 
            onClick={fetchUsersAndStaff} 
            className="p-2 sm:p-2.5 bg-slate-50 text-slate-600 rounded-xl hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-all active:scale-95 shrink-0"
            title="Rafraîchir les utilisateurs"
          >
            <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex-1 md:flex-none bg-blue-600 text-white font-bold px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl shadow-xs hover:bg-blue-700 transition-all flex items-center justify-center gap-2 text-xs sm:text-sm tracking-tight active:scale-95 cursor-pointer"
          >
            <UserPlus size={16} /> Nouveau Collaborateur
          </button>
        </div>
      </div>

      {/* Overview Statistics Cards */}
      <div className={`grid grid-cols-2 ${campuses && campuses.length > 0 ? 'lg:grid-cols-4' : 'lg:grid-cols-2'} gap-2.5 sm:gap-3`}>
        <div className="bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total Comptes</p>
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">{stats.total}</h3>
            <p className="text-[10px] text-slate-500 font-medium mt-0.5">{stats.active} actifs · {stats.inactive} inactifs</p>
          </div>
          <div className="w-9 h-9 sm:w-10 sm:h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
            <Users size={18} />
          </div>
        </div>

        <div className="bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Administrateurs</p>
            <h3 className="text-xl sm:text-2xl font-black text-amber-600 mt-0.5">{stats.adminCount} / 2</h3>
            <p className="text-[10px] text-slate-500 font-medium mt-0.5">Limite officielle de sécurité</p>
          </div>
          <div className="w-9 h-9 sm:w-10 sm:h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center shrink-0">
            <Crown size={18} />
          </div>
        </div>

        {campuses && campuses.length > 0 && (
          <>
            <div className="bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200/90 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Siège Social</p>
                <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">{stats.siegeCount}</h3>
                <p className="text-[10px] text-slate-500 font-medium mt-0.5">Accès transversal école</p>
              </div>
              <div className="w-9 h-9 sm:w-10 sm:h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center shrink-0">
                <Building2 size={18} />
              </div>
            </div>

            <div className="bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200/90 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Annexes & Campus</p>
                <h3 className="text-xl sm:text-2xl font-black text-emerald-600 mt-0.5">{stats.annexesCount}</h3>
                <p className="text-[10px] text-slate-500 font-medium mt-0.5">Affectations restreintes</p>
              </div>
              <div className="w-9 h-9 sm:w-10 sm:h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0">
                <MapPin size={18} />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200/90 shadow-xs flex flex-col md:flex-row gap-2.5 items-stretch md:items-center justify-between">
        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Rechercher nom ou email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8.5 pr-7 py-1.5 sm:py-2 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-lg sm:rounded-xl text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all placeholder:text-slate-400"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Dropdown Filters (Harmonized Pill Style) */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {campuses && campuses.length > 0 && (
            <SelectPill
              options={[
                { value: 'ALL', label: 'Tous les Campus' },
                { value: 'SIEGE', label: '🏛️ Siège Social (Global)' },
                ...campuses.map(c => ({ value: c.id, label: `📍 ${c.name}` }))
              ]}
              value={campusFilter}
              onChange={setCampusFilter}
              variant="pill"
              size="xs"
              colorScheme="purple"
              portal={true}
            />
          )}

          <SelectPill
            options={[
              { value: 'ALL', label: 'Tous les Rôles' },
              { value: UserRole.SCHOOL_ADMIN, label: 'Administrateur' },
              { value: UserRole.DIRECTOR, label: getRoleDisplayName(UserRole.DIRECTOR) },
              { value: UserRole.SECRETARY, label: getRoleDisplayName(UserRole.SECRETARY) },
              { value: UserRole.ACCOUNTANT, label: getRoleDisplayName(UserRole.ACCOUNTANT) },
              { value: UserRole.TEACHER, label: getRoleDisplayName(UserRole.TEACHER) },
              { value: UserRole.SUPERVISOR, label: getRoleDisplayName(UserRole.SUPERVISOR) },
            ]}
            value={roleFilter}
            onChange={setRoleFilter}
            variant="pill"
            size="xs"
            colorScheme="blue"
            portal={true}
          />

          <SelectPill
            options={[
              { value: 'ALL', label: 'Tous Statuts' },
              { value: 'ACTIVE', label: 'Actifs' },
              { value: 'INACTIVE', label: 'Inactifs / Suspendus' },
            ]}
            value={statusFilter}
            onChange={setStatusFilter}
            variant="pill"
            size="xs"
            colorScheme="slate"
            portal={true}
          />
        </div>
      </div>

      {/* Main Users Table */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200/90 overflow-hidden min-h-[350px]">
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
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left min-w-[650px]">
              <thead>
                <tr className="bg-slate-50/90 border-b border-slate-200">
                  <th scope="col" className="px-4 py-2.5 sm:py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Collaborateur / Utilisateur</th>
                  <th scope="col" className="px-4 py-2.5 sm:py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Rôle & Privilège</th>
                  {campuses && campuses.length > 0 && (
                    <th scope="col" className="px-4 py-2.5 sm:py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Périmètre / Campus</th>
                  )}
                  <th scope="col" className="px-4 py-2.5 sm:py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Statut</th>
                  <th scope="col" className="px-4 py-2.5 sm:py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((u) => {
                  const isSuperAdmin = currentUser.is_super_admin || currentUser.role === UserRole.SUPER_ADMIN;
                  const isInactive = u.is_active === false;
                  const roleStyle = getRoleBadgeStyle(u.role);

                  return (
                    <tr key={u.id} className="group hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-2.5 sm:py-3 cursor-pointer" onClick={() => setSelectedUserModal(u)}>
                        <div className="flex items-center gap-2.5 sm:gap-3">
                          <div className="w-8 h-8 sm:w-9 sm:h-9 bg-slate-100 border border-slate-200 rounded-xl flex items-center justify-center font-black text-slate-700 shrink-0 text-xs sm:text-sm shadow-2xs group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 transition-all">
                            {u.full_name?.charAt(0).toUpperCase() || 'U'}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 text-xs sm:text-sm truncate group-hover:text-blue-600 transition-colors">
                              {formatFullName(u.full_name || 'Sans Nom')}
                            </p>
                            <p className="text-[11px] text-slate-500 font-medium truncate flex items-center gap-1 mt-0.5">
                              <Mail size={11} className="text-slate-400 shrink-0" />
                              {displayIdentifier(u.email)}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-2.5 sm:py-3 cursor-pointer" onClick={() => setSelectedUserModal(u)}>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold ${roleStyle.bg}`}>
                          {roleStyle.icon}
                          <span>{getRoleDisplayName(u.role)}</span>
                        </span>
                      </td>

                      {campuses && campuses.length > 0 && (
                        <td className="px-4 py-2.5 sm:py-3 cursor-pointer" onClick={() => setSelectedUserModal(u)}>
                          {!u.campus_id ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-100 rounded-md text-[10px] font-bold uppercase tracking-wider">
                              <Building2 size={11} />
                              Siège Social
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-md text-[10px] font-bold uppercase tracking-wider">
                              <MapPin size={11} />
                              {campuses?.find(c => c.id === u.campus_id)?.name || 'Campus spécifique'}
                            </span>
                          )}
                        </td>
                      )}

                      <td className="px-4 py-2.5 sm:py-3 cursor-pointer" onClick={() => setSelectedUserModal(u)}>
                        {!isInactive ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase tracking-wider border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                            Actif
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-800 uppercase tracking-wider border border-rose-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                            Inactif
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-2.5 sm:py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedUserModal(u)}
                            className="p-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all hover:scale-105 active:scale-95 cursor-pointer"
                            title="Consulter la Fiche Utilisateur"
                          >
                            <Eye size={15} />
                          </button>

                          {isSuperAdmin && isInactive && (
                            <button
                              onClick={() => handleRestoreAccess(u)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
                              title="Restaurer l'accès instantanément"
                            >
                              <Unlock size={13} />
                              <span className="hidden sm:inline">Restaurer</span>
                            </button>
                          )}

                          {canManageUser(u) ? (
                            <>
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
          </div>
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
              className="bg-white w-full max-w-lg rounded-2xl shadow-xl flex flex-col max-h-[90vh] sm:max-h-[86vh] overflow-hidden border border-slate-200"
            >
              <div className="p-3.5 sm:p-4 bg-slate-900 text-white flex items-center justify-between shrink-0 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 bg-blue-600 border border-blue-500 text-white rounded-xl flex items-center justify-center shrink-0 shadow-xs">
                    <UserPlus size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white tracking-tight">Nouveau Collaborateur</h3>
                    <p className="text-[11px] text-slate-400 font-medium">Créer un identifiant et attribuer des droits d'accès</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowAddModal(false)} 
                  className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="overflow-y-auto p-3.5 sm:p-4.5 custom-scrollbar space-y-3 sm:space-y-3.5">
                <form onSubmit={handleCreateUser} className="space-y-3 sm:space-y-3.5">
                  {errorMsg && (
                    <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-start gap-2.5 text-xs font-bold">
                      <AlertCircle size={16} className="mt-0.5 shrink-0 text-rose-600" />
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <User size={13} className="text-blue-600" />
                      <span>1. Liaison RH / Personnel</span>
                      <InfoTooltip content="Sélectionner un membre inscrit au registre du personnel auto-remplit son nom et son email." />
                    </label>
                    <SelectPill
                      options={[
                        { value: '', label: 'Compte autonome (sans liaison RH)', badge: 'Autonome', description: 'Créer un compte sans associer de fiche du personnel' },
                        ...getAvailableStaff().map(staff => ({
                          value: staff.id,
                          label: formatStudentName(staff.last_name, staff.first_name).fullName,
                          badge: staff.role || 'Personnel',
                          description: staff.email || staff.phone || undefined
                        }))
                      ]}
                      value={formData.staff_id}
                      onChange={(val) => {
                        const staff = staffList.find(s => s.id === val);
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
                          staff_id: val,
                          full_name: staff ? formatStudentName(staff.last_name, staff.first_name).fullName : '',
                          email: staff?.email || formData.email,
                          role: matchedRole
                        });
                      }}
                      variant="field"
                      size="sm"
                      colorScheme="blue"
                      searchable={true}
                      portal={true}
                      placeholder="Sélectionner un collaborateur RH..."
                      className="w-full"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
                    <div className="space-y-1">
                      <label htmlFor="full_name" className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        Nom Complet
                      </label>
                      <input 
                        id="full_name" 
                        required 
                        type="text" 
                        readOnly={!!formData.staff_id} 
                        className={`w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold outline-none transition-all ${
                          !!formData.staff_id ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-slate-50 text-slate-900 focus:bg-white focus:border-blue-600'
                        }`} 
                        value={formData.full_name} 
                        onChange={e => setFormData({...formData, full_name: e.target.value})} 
                        placeholder="Ex: Jean Dupont" 
                      />
                    </div>

                    <div className="space-y-1">
                      <label htmlFor="role" className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <Shield size={13} className="text-blue-600" />
                        <span>Rôle & Habilitation</span>
                        <InfoTooltip content="Définit les modules et les actions autorisés sur la plateforme." />
                      </label>
                      <SelectPill
                        options={getAvailableRoles().map(role => ({
                          value: role.value,
                          label: role.label,
                          description: role.desc,
                          badge: role.value === UserRole.SCHOOL_ADMIN ? 'Admin' : undefined
                        }))}
                        value={formData.role}
                        onChange={(val) => setFormData({...formData, role: val as UserRole})}
                        variant="field"
                        size="sm"
                        colorScheme="blue"
                        portal={true}
                        className="w-full"
                      />
                    </div>
                  </div>

                  <div className="p-2.5 bg-blue-50/70 border border-blue-100 rounded-xl text-[11px] text-blue-900 flex items-start gap-2">
                    <ShieldCheck size={14} className="text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-extrabold block">Périmètre d'action ({formData.role}) :</span>
                      <span className="text-slate-600 font-medium">
                        {getAvailableRoles().find(r => r.value === formData.role)?.desc || 'Accès selon le rôle sélectionné'}
                      </span>
                    </div>
                  </div>

                  {!currentUser.campus_id && campuses && campuses.length > 0 && (
                    <div className="space-y-1 p-2.5 sm:p-3 bg-purple-50/50 border border-purple-100 rounded-xl">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-purple-900 flex items-center gap-1.5">
                        <Building2 size={13} className="text-purple-600" />
                        <span>Périmètre Annexe / Multi-Campus</span>
                        <InfoTooltip content="L'accès au Siège Social autorise la vue sur toutes les annexes. Un campus spécifique restreint l'utilisateur à son annexe." />
                      </label>
                      <SelectPill
                        options={[
                          { value: '', label: '🏛️ Siège Social (Accès transversal)', description: 'Accès transversal à toutes les annexes de l\'établissement' },
                          ...campuses.map(campus => ({
                            value: campus.id,
                            label: `📍 ${campus.name}`,
                            description: campus.address || undefined
                          }))
                        ]}
                        value={formData.campus_id}
                        onChange={(val) => setFormData({...formData, campus_id: val})}
                        variant="field"
                        size="sm"
                        colorScheme="purple"
                        portal={true}
                        className="w-full"
                      />
                    </div>
                  )}

                  <div className="space-y-1">
                    <label htmlFor="email" className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <User size={13} className="text-blue-600" />
                      <span>Identifiant ou Email de Connexion</span>
                    </label>
                    <input 
                      id="email" 
                      required 
                      type="text" 
                      className="w-full px-3 py-2 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-blue-600 transition-all placeholder:text-slate-400" 
                      value={formData.email} 
                      onChange={e => setFormData({...formData, email: e.target.value})} 
                      placeholder="ex: eugene.roseline ou r.eugene@ecole.ht" 
                    />
                  </div>

                  <div className="space-y-2.5 p-3 bg-slate-50 border border-slate-200/90 rounded-xl">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <KeyRound size={13} className="text-blue-600" />
                        <span>Mot de passe d'Accès</span>
                      </label>
                      {passwordStrength.label && (
                        <span className={`text-[9px] font-black px-1.5 py-0.5 text-white rounded-sm ${passwordStrength.color}`}>
                          {passwordStrength.label}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="relative">
                        <input 
                          id="password" 
                          required 
                          minLength={8} 
                          type={showPassword ? "text" : "password"} 
                          placeholder="Min. 8 caractères" 
                          className="w-full pl-3 pr-8 py-2 bg-white text-slate-900 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-blue-600 transition-all" 
                          value={formData.password} 
                          onChange={e => setFormData({...formData, password: e.target.value})} 
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
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
                          className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-blue-600 transition-all" 
                          value={formData.confirmPassword} 
                          onChange={e => setFormData({...formData, confirmPassword: e.target.value})} 
                        />
                      </div>
                    </div>

                    <label className="flex items-center gap-2 pt-0.5 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={formData.forcePasswordChange}
                        onChange={(e) => setFormData({...formData, forcePasswordChange: e.target.checked})}
                        className="w-3.5 h-3.5 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
                      />
                      <span className="text-[11px] font-semibold text-slate-600">
                        Forcer le renouvellement à la première connexion
                      </span>
                    </label>
                  </div>

                  <div className="pt-1">
                    <button 
                      disabled={isSubmitting} 
                      type="submit" 
                      className="w-full py-2.5 sm:py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs sm:text-sm tracking-tight shadow-xs transition-all flex items-center justify-center gap-2 active:scale-98 disabled:opacity-75 cursor-pointer"
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
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[3000] p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200"
            >
              <div className="p-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 bg-amber-500 text-white rounded-2xl flex items-center justify-center shrink-0 shadow-md">
                    <KeyRound size={22} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">Réinitialiser l'Accès & Mot de passe</h3>
                    <p className="text-xs text-slate-300 font-medium">Pour {formatFullName(resetModal.fullName || resetModal.email)}</p>
                  </div>
                </div>
                <button onClick={() => setResetModal({ ...resetModal, isOpen: false })} className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition-colors">
                  <X size={20} />
                </button>
              </div>

              {/* Mode Tabs */}
              <div className="flex border-b border-slate-200 bg-slate-50/80 p-2 gap-2">
                <button
                  type="button"
                  onClick={() => setResetModal({ ...resetModal, activeTab: 'email' })}
                  className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    resetModal.activeTab === 'email'
                      ? 'bg-white text-blue-700 shadow-sm border border-slate-200/80 font-black'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-white/50'
                  }`}
                >
                  <Mail size={15} className={resetModal.activeTab === 'email' ? 'text-blue-600' : ''} />
                  <span>1. Envoi par Email (Recommandé)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setResetModal({ ...resetModal, activeTab: 'manual' })}
                  className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    resetModal.activeTab === 'manual'
                      ? 'bg-white text-amber-700 shadow-sm border border-slate-200/80 font-black'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-white/50'
                  }`}
                >
                  <Lock size={15} className={resetModal.activeTab === 'manual' ? 'text-amber-600' : ''} />
                  <span>2. Saisie Manuelle</span>
                </button>
              </div>

              <div className="p-6 space-y-5">
                {resetModal.activeTab === 'email' ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl">
                      <div className="flex items-center gap-2.5 text-indigo-950 font-bold text-xs mb-1.5">
                        <ShieldCheck size={18} className="text-indigo-600 shrink-0" />
                        <span>Procédure de déblocage autonome</span>
                      </div>
                      <p className="text-xs text-indigo-800/90 leading-relaxed">
                        Un lien de réinitialisation sécurisé Supabase Auth sera immédiatement envoyé à l'adresse de l'utilisateur :
                      </p>
                      <div className="mt-2.5 px-3 py-2 bg-white rounded-xl border border-indigo-200 font-mono text-xs font-bold text-indigo-900 flex items-center justify-between">
                        <span>{resetModal.email || 'Aucune adresse email configurée'}</span>
                        <span className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">Destinataire</span>
                      </div>
                      <p className="text-[11px] text-indigo-600/90 mt-2">
                        💡 L'envoi de ce lien réinitialise le compteur d'échecs et débloque le compte dès que l'utilisateur valide son nouveau mot de passe.
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
                      className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <>
                          <Mail size={16} />
                          <span>Envoyer le lien de récupération par email</span>
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-xs font-bold text-slate-700">
                      Définir manuellement un mot de passe temporaire pour <span className="text-amber-700 font-black">{resetModal.fullName}</span>.
                    </p>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Nouveau mot de passe temporaire</label>
                      <input 
                        type="text" 
                        autoFocus
                        className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-amber-500 transition-all"
                        placeholder="Min. 6 caractères"
                        value={resetModal.newPassword}
                        onChange={e => setResetModal({ ...resetModal, newPassword: e.target.value })}
                      />
                    </div>

                    <label className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300 mt-0.5"
                        checked={resetModal.forceChange}
                        onChange={(e) => setResetModal({ ...resetModal, forceChange: e.target.checked })}
                      />
                      <span className="text-[11px] font-semibold text-slate-600 leading-relaxed">
                        Exiger le changement obligatoire de ce mot de passe à la prochaine ouverture de session.
                      </span>
                    </label>

                    <div className="pt-2 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={handleResetPassword}
                        disabled={isSubmitting || resetModal.newPassword.length < 6}
                        className="w-full py-3.5 px-5 text-xs font-black text-white bg-amber-600 hover:bg-amber-700 rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                      >
                        {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                        <span>Appliquer le mot de passe temporaire</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
                <button
                  type="button"
                  onClick={() => setResetModal({ ...resetModal, isOpen: false })}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
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
                          <span className="text-slate-400 font-bold block text-[10px] uppercase">Lien Personnel RH</span>
                          <span className="font-bold text-slate-700 mt-0.5 block">
                            {(selectedUserModal as any).linked_staff_id || (selectedUserModal as any).staff_id ? 'Lié au registre RH' : 'Compte autonome'}
                          </span>
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
              className="bg-white w-full max-w-md rounded-2xl shadow-xl flex flex-col max-h-[88vh] overflow-hidden border border-slate-200"
            >
              <div className="p-3.5 sm:p-4 bg-slate-900 text-white flex items-center justify-between shrink-0 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 bg-purple-600 text-white rounded-xl flex items-center justify-center shrink-0 shadow-xs">
                    <UserCog size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white tracking-tight">Modifier Rôle & Habilitations</h3>
                    <p className="text-[11px] text-slate-400 font-medium truncate max-w-[220px] sm:max-w-xs">{formatFullName(editRoleModal.user.full_name || editRoleModal.user.email)}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setEditRoleModal({ isOpen: false, user: null, newRole: UserRole.TEACHER, newCampusId: '' })} 
                  className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-3.5 sm:p-4 space-y-3 sm:space-y-3.5 overflow-y-auto custom-scrollbar">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Shield size={13} className="text-purple-600" />
                    <span>Rôle Système & Habilitation</span>
                  </label>
                  <SelectPill
                    options={getAvailableRoles().map(role => ({
                      value: role.value,
                      label: role.label,
                      description: role.desc,
                      badge: role.value === UserRole.SCHOOL_ADMIN ? 'Admin' : undefined
                    }))}
                    value={editRoleModal.newRole}
                    onChange={(val) => setEditRoleModal({ ...editRoleModal, newRole: val as UserRole })}
                    variant="field"
                    size="sm"
                    colorScheme="purple"
                    portal={true}
                    className="w-full"
                  />
                </div>

                <div className="p-2.5 bg-purple-50/70 border border-purple-100 rounded-xl space-y-1">
                  <div className="flex items-center gap-1.5 text-purple-900 text-[11px] font-black uppercase tracking-wider">
                    <ShieldCheck size={14} className="text-purple-600 shrink-0" />
                    <span>Périmètre & Privilèges Accordés</span>
                  </div>
                  <p className="text-xs font-semibold text-slate-700 leading-snug">
                    {getAvailableRoles().find(r => r.value === editRoleModal.newRole)?.desc || 'Accès restreint selon le rôle'}
                  </p>
                </div>

                {!currentUser.campus_id && campuses && campuses.length > 0 && (
                  <div className="space-y-1 p-2.5 sm:p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Building2 size={13} className="text-purple-600" />
                      <span>Affectation Périmètre / Annexe</span>
                    </label>
                    <SelectPill
                      options={[
                        { value: '', label: '🏛️ Siège Social (Accès transversal)', description: 'Accès transversal à toutes les annexes' },
                        ...campuses.map(campus => ({
                          value: campus.id,
                          label: `📍 ${campus.name}`,
                          description: campus.address || undefined
                        }))
                      ]}
                      value={editRoleModal.newCampusId}
                      onChange={(val) => setEditRoleModal({ ...editRoleModal, newCampusId: val })}
                      variant="field"
                      size="sm"
                      colorScheme="purple"
                      portal={true}
                      className="w-full"
                    />
                  </div>
                )}
              </div>

              <div className="p-3 sm:p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditRoleModal({ isOpen: false, user: null, newRole: UserRole.TEACHER, newCampusId: '' })}
                  className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleUpdateUserRoleAndCampus}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                  <span>Enregistrer l'habilitation</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation & Alert Dialog Modal */}
      {dialog.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[3000] p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 border border-slate-200">
            <div className={`p-6 ${dialog.type === 'confirm' ? 'bg-amber-500' : 'bg-blue-600'} text-white`}>
              <div className="flex items-center gap-3">
                {dialog.type === 'confirm' ? (
                  <AlertCircle size={24} />
                ) : (
                  <ShieldCheck size={24} />
                )}
                <h3 className="text-base font-black">{dialog.title}</h3>
              </div>
            </div>
            <div className="p-6">
              <p className="text-xs font-bold text-slate-700 leading-relaxed">{dialog.message}</p>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
              {dialog.type === 'confirm' && (
                <button
                  onClick={() => setDialog({ ...dialog, isOpen: false })}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
                >
                  Annuler
                </button>
              )}
              <button
                onClick={() => {
                  setDialog({ ...dialog, isOpen: false });
                  if (dialog.onConfirm) dialog.onConfirm();
                }}
                className={`px-5 py-2 text-xs font-black text-white rounded-xl shadow-md transition-all cursor-pointer ${
                  dialog.type === 'confirm' 
                    ? 'bg-amber-600 hover:bg-amber-700' 
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {dialog.type === 'confirm' ? 'Confirmer' : 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagementView;
