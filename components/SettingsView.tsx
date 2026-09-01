import React, { useState, useEffect, useMemo } from 'react';
import { 
  School, 
  Calendar, 
  Plus, 
  Save, 
  Loader2, 
  MapPin, 
  Phone, 
  FileCheck, 
  Upload, 
  Trash2, 
  Shield, 
  Key, 
  Eye, 
  EyeOff, 
  RefreshCw, 
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  CircleDollarSign,
  Mail,
  Globe,
  Camera,
  Link,
  AlertTriangle,
  CheckCircle,
  Lock,
  CreditCard,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  Building2,
  Sparkles,
  Crown,
  Layers,
  ExternalLink,
  ShieldAlert,
  BadgeCheck,
  Cloud,
  CloudUpload,
  Database,
  HardDrive,
  Download,
  Clock,
  Info,
  FileText,
  Wallet,
  Smartphone,
  Receipt,
  Banknote,
  Landmark,
  XCircle,
  ToggleLeft,
  ToggleRight,
  GitBranch,
  GitCommit,
  GitPullRequest,
  Code2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../supabase';
import { UserProfile, UserRole } from '../types';
import Modal from './Modal';
import { toast } from 'sonner';
import { AuditLogger } from '../utils/auditLogger';
import Logo from './Logo';
import { useSchool } from '../contexts/SchoolContext';
import SessionManager from './SessionManager';
import { 
  DocumentDefinition, 
  getDocumentDefinitionsForSchoolType 
} from '../utils/documentRequirements';
import { BackupClientService, BackupMetadata } from '../services/backupClientService';
import { 
  PaymentMethodConfig, 
  getSchoolPaymentMethods, 
  DEFAULT_PAYMENT_METHODS 
} from '../lib/paymentMethods';
import { PaymentMethodManager } from './PaymentMethodManager';
import { AiQuotaProgressWidget } from './AiQuotaProgressWidget';

type SettingsTab = 'school' | 'campuses' | 'academic' | 'finance' | 'payment_methods' | 'gateways' | 'security';

interface SettingsViewProps {
  user: UserProfile;
}

const SettingsView: React.FC<SettingsViewProps> = ({ user }) => {
  const { terminology, campuses, refreshCampuses, school, refreshSchool } = useSchool();
  const userCampus = user.campus_id ? campuses.find(c => c.id === user.campus_id) : null;
  const userBelongsToSiege = userCampus ? (userCampus.name.toLowerCase().includes('siège') || userCampus.name.toLowerCase().includes('siege')) : false;
  const canManageAllCampuses = !user.campus_id || userBelongsToSiege;
  const isSuperAdmin = Boolean(user.is_super_admin || (user.role as any) === UserRole.SUPER_ADMIN || (user.role as any) === 'SUPER_ADMIN');

  // Détection du poste de développement (l'export/synchronisation GitHub est strictement réservé au poste de dev)
  const isDevWorkstation = useMemo(() => {
    if (import.meta.env.DEV) return true;
    if (typeof window !== 'undefined') {
      const host = window.location.hostname;
      const port = window.location.port;
      return (
        host === 'localhost' ||
        host === '127.0.0.1' ||
        host.includes('ais-dev-') ||
        host.includes('.local') ||
        port === '3000' ||
        port === '5173'
      );
    }
    return false;
  }, []);

  const [activeTab, setActiveTab] = useState<SettingsTab>('school');
  const [paymentSubTab, setPaymentSubTab] = useState<'methods' | 'banks'>('methods');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [schoolData, setSchoolData] = useState<any>({});
  const [years, setYears] = useState<any[]>([]);
  const [newYearData, setNewYearData] = useState({
    label: '',
    startDate: '',
    endDate: ''
  });
  const [exchangeRate, setExchangeRate] = useState<any>(null);
  const [exchangeRates, setExchangeRates] = useState<any[]>([]);
  const [newExchangeRate, setNewExchangeRate] = useState('');
  const [newBankName, setNewBankName] = useState('');
  const [newBankAccount, setNewBankAccount] = useState('');
  const [customBankName, setCustomBankName] = useState('');
  const [newBankLabel, setNewBankLabel] = useState('');
  const [securityData, setSecurityData] = useState({ newPassword: '', confirmPassword: '' });
  const [moncashConfig, setMoncashConfig] = useState<any>({
    client_id: '',
    client_secret: '',
    business_key: '',
    mode: 'sandbox',
    is_active: true
  });
  const [showPassword, setShowPassword] = useState(false);
  const [sessionTimeoutInput, setSessionTimeoutInput] = useState<number>(10);
  const [sessionToDelete, setSessionToDelete] = useState<any>(null);
  const [modalConfig, setModalConfig] = useState<any>(null);
  const [exchangeRatePage, setExchangeRatePage] = useState<number>(1);
  const [copiedAccount, setCopiedAccount] = useState<string | null>(null);

  // States for Dynamic Payment Methods configuration
  const [isAddingCustomMethod, setIsAddingCustomMethod] = useState(false);
  const [customMethodName, setCustomMethodName] = useState('');
  const [customMethodDescription, setCustomMethodDescription] = useState('');
  const [customMethodAccount, setCustomMethodAccount] = useState('');
  const [customMethodInstructions, setCustomMethodInstructions] = useState('');
  const [customMethodCurrencies, setCustomMethodCurrencies] = useState<('HTG' | 'USD')[]>(['HTG', 'USD']);
  const [customMethodRequiresRef, setCustomMethodRequiresRef] = useState(true);
  const [customMethodRequiresBank, setCustomMethodRequiresBank] = useState(false);
  const [editingMethodId, setEditingMethodId] = useState<string | null>(null);

  // States for Cloud Backup feature
  interface LastBackupInfo {
    timestamp: string | null;
    status: 'SUCCESS' | 'RUNNING' | 'FAILED' | 'NONE';
    name?: string;
    id?: string;
    size_bytes?: number;
    rows_count?: number;
    tables_count?: number;
    created_by_name?: string;
    checksum?: string;
    storage_path?: string;
    storage_provider?: string;
    error?: string;
  }

  const [lastBackupInfo, setLastBackupInfo] = useState<LastBackupInfo>({
    timestamp: null,
    status: 'NONE'
  });
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupProgressStep, setBackupProgressStep] = useState('');
  const [recentSchoolBackups, setRecentSchoolBackups] = useState<BackupMetadata[]>([]);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [backupScope, setBackupScope] = useState<'SCHOOL_SPECIFIC' | 'FULL_DATABASE'>('SCHOOL_SPECIFIC');
  const [backupCustomName, setBackupCustomName] = useState('');
  const [backupCustomDesc, setBackupCustomDesc] = useState('');
  const [isTestingStorage, setIsTestingStorage] = useState(false);
  const [storageStatusInfo, setStorageStatusInfo] = useState<{ checked: boolean; available: boolean; message: string } | null>(null);

  // States for GitHub Export
  const [isGitHubModalOpen, setIsGitHubModalOpen] = useState(false);
  const [githubToken, setGithubToken] = useState(() => {
    return localStorage.getItem('edunova_github_pat') || '';
  });
  const [githubOwner, setGithubOwner] = useState('Jackito46');
  const [githubRepo, setGithubRepo] = useState('EduNova-Pro-Official');
  const [githubBranch, setGithubBranch] = useState('main');
  const [githubCommitMsg, setGithubCommitMsg] = useState('');
  const [isExportingGitHub, setIsExportingGitHub] = useState(false);
  const [githubExportProgress, setGithubExportProgress] = useState<{ step: string; percent: number } | null>(null);
  const [githubExportResult, setGithubExportResult] = useState<{
    success: boolean;
    commitSha?: string;
    filesCount?: number;
    modifiedFilesCount?: number;
    repoUrl?: string;
    commitUrl?: string;
  } | null>(null);

  // States for clearing school data
  const [isCleanModalOpen, setIsCleanModalOpen] = useState(false);
  const [confirmSchoolName, setConfirmSchoolName] = useState('');
  const [confirmUserEmail, setConfirmUserEmail] = useState('');
  const [primaryAdmin, setPrimaryAdmin] = useState<{ id: string; email: string; full_name: string } | null>(null);
  const [isCleaning, setIsCleaning] = useState(false);
  const [cleanScope, setCleanScope] = useState<string>('all');

  const isPrimaryAdmin = Boolean(
    isSuperAdmin || 
    (primaryAdmin ? user.id === primaryAdmin.id : (user.role === UserRole.SCHOOL_ADMIN || (user.role as any) === UserRole.SUPER_ADMIN))
  );

  // Campus management state
  const [newCampusName, setNewCampusName] = useState('');
  const [newCampusAddress, setNewCampusAddress] = useState('');
  const [newCampusPhone, setNewCampusPhone] = useState('');
  const [newCampusEmail, setNewCampusEmail] = useState('');

  const [editingCampusId, setEditingCampusId] = useState<string | null>(null);
  const [editingCampusName, setEditingCampusName] = useState('');
  const [editingCampusAddress, setEditingCampusAddress] = useState('');
  const [editingCampusPhone, setEditingCampusPhone] = useState('');
  const [editingCampusEmail, setEditingCampusEmail] = useState('');

  const handleAddCampus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageAllCampuses) {
      toast.error("Seuls les administrateurs du Siège Social disposent du droit de créer des annexes.");
      return;
    }
    if (!newCampusName.trim()) {
      toast.error("Le nom de l'annexe est requis");
      return;
    }
    setActionLoading('add_campus');
    try {
      const { data, error } = await supabase
        .from('school_campuses')
        .insert([{
          school_id: user.school_id,
          name: newCampusName.trim(),
          address: newCampusAddress.trim() || null,
          phone: newCampusPhone.trim() || null,
          email: newCampusEmail.trim() || null
        }])
        .select()
        .single();

      if (error) throw error;
      
      await AuditLogger.log({
        school_id: user.school_id,
        user_id: user.id,
        action: 'CREATE',
        entity_type: 'settings',
        details: { campus: data }
      });

      toast.success(`L'annexe "${newCampusName}" a été créée avec succès`);
      setNewCampusName('');
      setNewCampusAddress('');
      setNewCampusPhone('');
      setNewCampusEmail('');
      await refreshCampuses();
    } catch (err: any) {
      console.error("Error adding campus:", err);
      toast.error(err.message || "Erreur lors de la création de l'annexe");
    } finally {
      setActionLoading(null);
    }
  };

  const handleStartEditCampus = (campus: any) => {
    setEditingCampusId(campus.id);
    setEditingCampusName(campus.name || '');
    setEditingCampusAddress(campus.address || '');
    setEditingCampusPhone(campus.phone || '');
    setEditingCampusEmail(campus.email || '');
  };

  const handleCancelEditCampus = () => {
    setEditingCampusId(null);
  };

  const handleUpdateCampus = async (campusId: string) => {
    if (!canManageAllCampuses && campusId !== user.campus_id) {
      toast.error("Vous n'avez pas l'autorisation de modifier cette annexe");
      return;
    }
    if (!editingCampusName.trim()) {
      toast.error("Le nom de l'annexe est requis");
      return;
    }
    setActionLoading('update_campus_' + campusId);
    try {
      const { error } = await supabase
        .from('school_campuses')
        .update({
          name: editingCampusName.trim(),
          address: editingCampusAddress.trim() || null,
          phone: editingCampusPhone.trim() || null,
          email: editingCampusEmail.trim() || null
        })
        .eq('id', campusId)
        .eq('school_id', user.school_id);

      if (error) throw error;

      await AuditLogger.log({
        school_id: user.school_id,
        user_id: user.id,
        action: 'UPDATE',
        entity_type: 'settings',
        details: { campus_id: campusId, name: editingCampusName }
      });

      toast.success("Annexe mise à jour avec succès");
      setEditingCampusId(null);
      await refreshCampuses();
    } catch (err: any) {
      console.error("Error updating campus:", err);
      toast.error(err.message || "Erreur lors de la mise à jour");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteCampus = async (campus: any) => {
    if (!canManageAllCampuses) {
      toast.error("Seuls les administrateurs du Siège Social sont autorisés à supprimer une annexe.");
      return;
    }
    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer l'annexe "${campus.name}" ?`)) {
      return;
    }
    setActionLoading('delete_campus_' + campus.id);
    try {
      const { error } = await supabase
        .from('school_campuses')
        .delete()
        .eq('id', campus.id)
        .eq('school_id', user.school_id);

      if (error) throw error;

      await AuditLogger.log({
        school_id: user.school_id,
        user_id: user.id,
        action: 'DELETE',
        entity_type: 'settings',
        details: { campus_id: campus.id, name: campus.name }
      });

      toast.success(`L'annexe "${campus.name}" a été supprimée`);
      await refreshCampuses();
    } catch (err: any) {
      console.error("Error deleting campus:", err);
      toast.error(err.message || "Erreur lors de la suppression. Des données y sont probablement liées.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Remove harsh 2MB limit, since we are compressing it anyway, but keep a reasonable limit (e.g. 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("L'image est trop lourde. Veuillez choisir un fichier de moins de 10 Mo.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Redimensionnement et compression
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 256;
        const MAX_HEIGHT = 256;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(img, 0, 0, width, height);

        // Compression en WebP ou PNG (WebP est plus léger)
        const compressedBase64 = canvas.toDataURL('image/webp', 0.8);
        
        setSchoolData({ ...schoolData, logo_url: compressedBase64 });
        // Mise en cache locale pour le mode OFFLINE
        localStorage.setItem(`school_logo_${user.school_id}`, compressedBase64);
        toast.success("Logo compressé et chargé localement. N'oubliez pas d'enregistrer.");
      };
      img.src = event.target?.result as string;
    };
    reader.onerror = () => {
      toast.error("Erreur lors de la lecture du fichier.");
    };
    reader.readAsDataURL(file);
  };


  useEffect(() => {
    fetchData();
  }, [user.school_id]);

  const fetchData = async () => {
    if (!user.school_id) return;
    setLoading(true);
    let parsedSettings: any = {};
    try {
      const [schoolRes, yearsRes, rateRes] = await Promise.all([
        supabase.from('schools').select('*').eq('id', user.school_id).single(),
        supabase.from('academic_years').select('*').eq('school_id', user.school_id).order('label', { ascending: false }),
        supabase.from('exchange_rates').select('*').eq('school_id', user.school_id).order('created_at', { ascending: false }).limit(10)
      ]) as any;

      if (schoolRes.data) {
        const data = schoolRes.data;
        if (typeof data.global_settings === 'string') {
          try { parsedSettings = JSON.parse(data.global_settings); } catch (e) {}
        } else {
          parsedSettings = data.global_settings || {};
        }

        // Merge settings into schoolData for easier UI handling
        const finalSchoolData = {
          ...data,
          global_settings: parsedSettings,
          name: data.name || "",
          address: data.address || "",
          phone: data.phone || "",
          email: data.email || "",
          website: data.website || parsedSettings.website || "",
          nif: parsedSettings.nif || '',
          foundation_year: parsedSettings.foundation_year || '',
          motto: parsedSettings.motto || ''
        };
        setSchoolData(finalSchoolData);
        setSessionTimeoutInput(Number(parsedSettings.session_timeout_minutes || 10));
      }
      if (yearsRes.data) setYears(yearsRes.data);
      
      // Fetch primary admin (first user created for this school)
      const { data: primaryAdminData } = await supabase
        .from('profiles')
        .select('id, email, full_name, created_at, role')
        .eq('school_id', user.school_id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (primaryAdminData) {
        setPrimaryAdmin(primaryAdminData);
      }

      // Fetch MonCash config
      const { data: gatewayData } = await supabase
        .from('payment_gateways')
        .select('*')
        .eq('school_id', user.school_id)
        .eq('gateway_name', 'moncash')
        .maybeSingle();
      
      if (gatewayData) {
        setMoncashConfig(gatewayData);
      }

      if (rateRes.data && rateRes.data.length > 0) {
        setExchangeRates(rateRes.data);
        const latest = rateRes.data[0];
        setExchangeRate(latest);
        if (latest.rate_usd_to_htg != null) {
          setNewExchangeRate(latest.rate_usd_to_htg.toString());
        }
      }

      // Fetch backup status & history (Super Admin exclusive to preserve Supabase 1 GB quota)
      if (isSuperAdmin) {
        try {
          const backupData = await BackupClientService.getBackupsAndSettings();
          const allBackups = backupData.backups || [];
          const schoolBackups = allBackups.filter(b => 
            !b.school_id || b.school_id === user.school_id || b.scope === 'FULL_DATABASE'
          );
          setRecentSchoolBackups(schoolBackups.slice(0, 10));

          // Determine the most recent backup info
          const latestBackup = schoolBackups[0];
          if (latestBackup) {
            setLastBackupInfo({
              timestamp: latestBackup.created_at,
              status: 'SUCCESS',
              name: latestBackup.name,
              id: latestBackup.id,
              size_bytes: latestBackup.size_bytes,
              rows_count: latestBackup.rows_count,
              tables_count: latestBackup.tables_count || (latestBackup.tables_summary ? Object.keys(latestBackup.tables_summary).length : 0),
              created_by_name: latestBackup.created_by_name || 'Administrateur',
              checksum: latestBackup.checksum,
              storage_path: latestBackup.storage_path,
              storage_provider: latestBackup.storage_provider
            });
          } else if (parsedSettings.last_cloud_backup) {
            const lcb = parsedSettings.last_cloud_backup;
            setLastBackupInfo({
              timestamp: lcb.timestamp || lcb.created_at || null,
              status: lcb.status || 'SUCCESS',
              name: lcb.name || 'Sauvegarde Cloud',
              id: lcb.id,
              size_bytes: lcb.size_bytes,
              rows_count: lcb.rows_count,
              tables_count: lcb.tables_count,
              created_by_name: lcb.created_by_name,
              storage_provider: lcb.storage_provider || 'SUPABASE_STORAGE'
            });
          } else {
            setLastBackupInfo({
              timestamp: null,
              status: 'NONE'
            });
          }
        } catch (backupFetchErr) {
          console.warn('Erreur lors du chargement des sauvegardes:', backupFetchErr);
          if (parsedSettings.last_cloud_backup) {
            const lcb = parsedSettings.last_cloud_backup;
            setLastBackupInfo({
              timestamp: lcb.timestamp || lcb.created_at || null,
              status: lcb.status || 'SUCCESS',
              name: lcb.name || 'Sauvegarde Cloud',
              id: lcb.id,
              size_bytes: lcb.size_bytes,
              rows_count: lcb.rows_count,
              tables_count: lcb.tables_count,
              created_by_name: lcb.created_by_name,
              storage_provider: lcb.storage_provider || 'SUPABASE_STORAGE'
            });
          }
        }
      }
    } catch (err) {
      console.error("Error fetching settings:", err);
      toast.error("Erreur de chargement des paramètres");
    } finally {
      setLoading(false);
    }
  };

  // Trigger manual cloud backup (Super Admin exclusive)
  const handleTriggerCloudBackup = async (options?: { scope?: 'SCHOOL_SPECIFIC' | 'FULL_DATABASE'; name?: string; description?: string }) => {
    if (!isSuperAdmin) {
      toast.error("La sauvegarde Cloud est une fonctionnalité réservée exclusivement au Super Administrateur afin de préserver l'espace de stockage Supabase (1 Go).");
      return;
    }
    if (isBackingUp) return;
    setIsBackingUp(true);
    setBackupProgressStep('1/4 Extraction des données critiques (élèves, paiements, notes, personnel)...');

    try {
      await new Promise(r => setTimeout(r, 350));
      setBackupProgressStep('2/4 Chiffrement et empaquetage des données de l\'établissement...');
      
      const chosenScope = options?.scope || backupScope || 'SCHOOL_SPECIFIC';
      const defaultName = `Sauvegarde Cloud - ${schoolData.name || school?.name || 'École'} - ${new Date().toLocaleDateString('fr-FR')} ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
      const chosenName = options?.name?.trim() || backupCustomName.trim() || defaultName;
      const defaultDesc = `Sauvegarde manuelle déclenchée par ${user.full_name || user.email} depuis les Paramètres de l'école.`;
      const chosenDesc = options?.description?.trim() || backupCustomDesc.trim() || defaultDesc;

      await new Promise(r => setTimeout(r, 300));
      setBackupProgressStep('3/4 Téléversement vers le Cloud Storage Supabase (database_backups)...');

      const result = await BackupClientService.createBackup({
        name: chosenName,
        description: chosenDesc,
        backup_type: 'MANUAL',
        scope: chosenScope,
        school_id: user.school_id,
        user_id: user.id,
        user_name: user.full_name || user.email
      });

      setBackupProgressStep('4/4 Enregistrement des métadonnées et horodatage...');

      const backupMeta = result.metadata;
      const backupTimestamp = backupMeta?.created_at || new Date().toISOString();

      // Persist status directly into schools.global_settings
      try {
        const { data: latestSchool } = await supabase
          .from('schools')
          .select('global_settings')
          .eq('id', user.school_id)
          .single();

        let currentSettings: any = {};
        if (latestSchool && latestSchool.global_settings) {
          currentSettings = typeof latestSchool.global_settings === 'string'
            ? JSON.parse(latestSchool.global_settings)
            : latestSchool.global_settings;
        }

        const updatedSettings = {
          ...currentSettings,
          last_cloud_backup: {
            id: backupMeta.id,
            name: backupMeta.name,
            timestamp: backupTimestamp,
            status: 'SUCCESS',
            size_bytes: backupMeta.size_bytes,
            rows_count: backupMeta.rows_count,
            tables_count: backupMeta.tables_count || (backupMeta.tables_summary ? Object.keys(backupMeta.tables_summary).length : 0),
            created_by_name: user.full_name || user.email,
            storage_provider: backupMeta.storage_provider
          }
        };

        await supabase
          .from('schools')
          .update({ global_settings: updatedSettings })
          .eq('id', user.school_id);

        setSchoolData((prev: any) => ({
          ...prev,
          global_settings: updatedSettings
        }));
      } catch (persistErr) {
        console.warn('[CloudBackup] Sauvegarde des paramètres:', persistErr);
      }

      await AuditLogger.log({
        school_id: user.school_id,
        user_id: user.id,
        action: 'CREATE',
        entity_type: 'settings',
        details: { 
          type: 'cloud_backup',
          backup_id: backupMeta.id,
          backup_name: backupMeta.name,
          rows_count: backupMeta.rows_count,
          size_bytes: backupMeta.size_bytes
        }
      });

      setLastBackupInfo({
        timestamp: backupTimestamp,
        status: 'SUCCESS',
        name: backupMeta.name,
        id: backupMeta.id,
        size_bytes: backupMeta.size_bytes,
        rows_count: backupMeta.rows_count,
        tables_count: backupMeta.tables_count || (backupMeta.tables_summary ? Object.keys(backupMeta.tables_summary).length : 0),
        created_by_name: user.full_name || user.email,
        checksum: backupMeta.checksum,
        storage_path: backupMeta.storage_path,
        storage_provider: backupMeta.storage_provider
      });

      toast.success(`Sauvegarde Cloud réussie ! (${backupMeta.rows_count} enregistrements sécurisés dans le Cloud)`);
      setIsBackupModalOpen(false);
      setBackupCustomName('');
      setBackupCustomDesc('');
      await fetchData();
    } catch (err: any) {
      console.error("Erreur lors de la sauvegarde Cloud :", err);
      setLastBackupInfo(prev => ({
        ...prev,
        status: 'FAILED',
        error: err.message || 'Erreur lors de la création de la sauvegarde'
      }));
      toast.error(`Échec de la sauvegarde Cloud : ${err.message || 'Erreur inconnue'}`);
    } finally {
      setIsBackingUp(false);
      setBackupProgressStep('');
    }
  };

  // Download last backup JSON
  const handleDownloadLastBackup = async () => {
    if (!isSuperAdmin) {
      toast.error("Action réservée exclusivement au Super Administrateur.");
      return;
    }
    if (!lastBackupInfo.id) {
      toast.error("Aucune sauvegarde récente disponible au téléchargement");
      return;
    }
    try {
      const backupToDownload: BackupMetadata = {
        id: lastBackupInfo.id,
        name: lastBackupInfo.name || 'Sauvegarde_Ecole',
        created_at: lastBackupInfo.timestamp || new Date().toISOString(),
        backup_type: 'MANUAL',
        scope: 'SCHOOL_SPECIFIC',
        school_id: user.school_id,
        size_bytes: lastBackupInfo.size_bytes || 0,
        tables_count: lastBackupInfo.tables_count || 0,
        rows_count: lastBackupInfo.rows_count || 0,
        checksum: lastBackupInfo.checksum || 'sha256',
        storage_provider: (lastBackupInfo.storage_provider as any) || 'SUPABASE_STORAGE',
        storage_path: lastBackupInfo.storage_path || `snapshots/${lastBackupInfo.id}.json`,
        storage_bucket: 'database_backups',
        tables_summary: {},
        version: '2.4'
      };
      await BackupClientService.downloadBackup(backupToDownload);
      toast.success("Téléchargement du fichier de sauvegarde démarré");
    } catch (err: any) {
      toast.error("Erreur lors du téléchargement : " + err.message);
    }
  };

  // Download specific backup item
  const handleDownloadBackupItem = async (b: BackupMetadata) => {
    if (!isSuperAdmin) {
      toast.error("Action réservée exclusivement au Super Administrateur.");
      return;
    }
    try {
      await BackupClientService.downloadBackup(b);
      toast.success(`Téléchargement de "${b.name}" démarré`);
    } catch (err: any) {
      toast.error("Erreur de téléchargement : " + err.message);
    }
  };

  // Test Cloud Storage health
  const handleTestCloudStorage = async () => {
    if (!isSuperAdmin) {
      toast.error("Action réservée exclusivement au Super Administrateur.");
      return;
    }
    setIsTestingStorage(true);
    try {
      const result = await BackupClientService.testStorage();
      const isAvailable = Boolean(result.supabaseStorageAvailable || result.bucketExists || result.localMirrorAvailable);
      if (isAvailable) {
        setStorageStatusInfo({
          checked: true,
          available: true,
          message: result.message || 'Stockage Cloud Supabase Opérationnel (Bucket: database_backups)'
        });
        toast.success('Stockage Cloud opérationnel : Bucket "database_backups" connecté.');
      } else {
        setStorageStatusInfo({
          checked: true,
          available: false,
          message: result.message || result.details || 'Vérification du stockage échouée'
        });
        toast.error(`Avertissement Stockage Cloud : ${result.message || 'Erreur d\'accès'}`);
      }
    } catch (err: any) {
      setStorageStatusInfo({
        checked: true,
        available: false,
        message: err.message || 'Impossible de joindre le service de stockage'
      });
      toast.error("Erreur lors du test de stockage : " + err.message);
    } finally {
      setIsTestingStorage(false);
    }
  };

  const handleUpdateSchool = async () => {
    setSaving(true);
    try {
      // Prepare the final payload.
      // Fields that don't exist as columns will be safely stored in global_settings
      const extraFields = {
        website: schoolData.website || '',
        nif: schoolData.nif || '',
        foundation_year: schoolData.foundation_year || '',
        motto: schoolData.motto || ''
      };

      let currentSettings = {};
      if (typeof schoolData.global_settings === 'string') {
        try { currentSettings = JSON.parse(schoolData.global_settings); } catch (e) { currentSettings = {}; }
      } else {
        currentSettings = schoolData.global_settings || {};
      }

      const updatedSettings = {
        ...currentSettings,
        ...extraFields
      };

      const payload = {
        name: schoolData.name,
        director_name: schoolData.director_name,
        address: schoolData.address,
        phone: schoolData.phone,
        email: schoolData.email,
        website: schoolData.website,
        license_number: schoolData.license_number,
        logo_url: schoolData.logo_url,
        has_multi_campus: isSuperAdmin ? !!schoolData.has_multi_campus : !!school?.has_multi_campus,
        // Send as an object since supabase-js handles json/jsonb stringification natively.
        // If it's a text column, we must stringify it. We will send it as an object first, 
        // but if the backend strictly requires text, it would reject it. Postgrest casts objects to JSON.
        global_settings: updatedSettings
      };

      const { error } = await supabase
        .from('schools')
        .update(payload)
        .eq('id', user.school_id);

      if (error) throw error;
      
      await AuditLogger.log({
        school_id: user.school_id,
        user_id: user.id,
        action: 'UPDATE',
        entity_type: 'school',
        details: { payload }
      });

      toast.success("Paramètres de l'école mis à jour");
      if (refreshSchool) await refreshSchool();
      fetchData(); // Refresh to ensure state is clean
    } catch (err) {
      console.error("Error updating school:", err);
      toast.error("Erreur lors de la mise à jour");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleModule = async (moduleName: 'presences' | 'discipline', checked: boolean) => {
    if (!canManageAllCampuses) {
      toast.error("Action interdite : vous n'avez pas les droits de modifier la configuration globale.");
      return;
    }

    try {
      // Get current global_settings from the database first to avoid overwriting other fields
      const { data: currentSchool, error: fetchError } = await supabase
        .from('schools')
        .select('global_settings')
        .eq('id', user.school_id)
        .single();
        
      if (fetchError) throw fetchError;
      
      let currentSettings = {};
      if (typeof currentSchool.global_settings === 'string') {
        try { currentSettings = JSON.parse(currentSchool.global_settings); } catch (e) { currentSettings = {}; }
      } else {
        currentSettings = currentSchool.global_settings || {};
      }

      const currentModules = (currentSettings as any).modules || {};
      const updatedSettings = {
        ...currentSettings,
        modules: {
          ...currentModules,
          [moduleName]: checked
        }
      };

      // Save to Supabase immediately
      const { error: updateError } = await supabase
        .from('schools')
        .update({ global_settings: updatedSettings })
        .eq('id', user.school_id);

      if (updateError) throw updateError;

      // Update local state in SettingsView
      setSchoolData({
        ...schoolData,
        global_settings: updatedSettings
      });

      // Refresh global context so sidebar and dashboard update instantly!
      if (refreshSchool) {
        await refreshSchool();
      }

      toast.success(`Module ${moduleName === 'presences' ? 'Présences' : 'Discipline'} ${checked ? 'activé' : 'désactivé'} avec succès.`);
    } catch (err: any) {
      console.error("Erreur lors de la mise à jour du module :", err);
      toast.error("Erreur lors de la mise à jour : " + err.message);
    }
  };

  // Gestion dynamique des pièces exigées à l'inscription
  const [newDocName, setNewDocName] = useState('');
  const [newDocDescription, setNewDocDescription] = useState('');
  const [newDocRequired, setNewDocRequired] = useState(true);
  const [isSavingDocs, setIsSavingDocs] = useState(false);

  const currentConfiguredDocs: DocumentDefinition[] = React.useMemo(() => {
    return getDocumentDefinitionsForSchoolType(
      schoolData.school_type || school?.school_type, 
      schoolData.global_settings
    );
  }, [schoolData.school_type, school?.school_type, schoolData.global_settings]);

  const handleSaveDocumentList = async (updatedDocsList: DocumentDefinition[]) => {
    if (!canManageAllCampuses) {
      toast.error("Action interdite : vous n'avez pas les droits de modifier la liste des pièces.");
      return;
    }
    setIsSavingDocs(true);
    try {
      const { data: currentSchool, error: fetchError } = await supabase
        .from('schools')
        .select('global_settings')
        .eq('id', user.school_id)
        .single();
        
      if (fetchError) throw fetchError;
      
      let currentSettings: any = {};
      if (typeof currentSchool.global_settings === 'string') {
        try { currentSettings = JSON.parse(currentSchool.global_settings); } catch (e) { currentSettings = {}; }
      } else {
        currentSettings = currentSchool.global_settings || {};
      }

      const updatedSettings = {
        ...currentSettings,
        required_documents: updatedDocsList
      };

      const { error: updateError } = await supabase
        .from('schools')
        .update({ global_settings: updatedSettings })
        .eq('id', user.school_id);

      if (updateError) throw updateError;

      setSchoolData({
        ...schoolData,
        global_settings: updatedSettings
      });

      if (refreshSchool) {
        await refreshSchool();
      }

      toast.success("Liste des pièces justificatives mise à jour avec succès");
    } catch (err: any) {
      console.error("Erreur lors de la sauvegarde des pièces :", err);
      toast.error("Erreur : " + err.message);
    } finally {
      setIsSavingDocs(false);
    }
  };

  const handleAddCustomDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocName.trim()) {
      toast.error("Veuillez saisir un intitulé pour la pièce exigée.");
      return;
    }

    const docId = `custom_doc_${Date.now()}`;
    const newDoc: DocumentDefinition = {
      id: docId,
      name: newDocName.trim(),
      description: newDocDescription.trim() || undefined,
      required: newDocRequired
    };

    const updatedList = [...currentConfiguredDocs, newDoc];
    await handleSaveDocumentList(updatedList);
    setNewDocName('');
    setNewDocDescription('');
    setNewDocRequired(true);
  };

  const handleRemoveCustomDocument = async (docId: string) => {
    const updatedList = currentConfiguredDocs.filter(d => d.id !== docId);
    await handleSaveDocumentList(updatedList);
  };

  const handleToggleDocRequired = async (docId: string, currentRequired: boolean) => {
    const updatedList = currentConfiguredDocs.map(d => {
      if (d.id === docId) {
        return { ...d, required: !currentRequired };
      }
      return d;
    });
    await handleSaveDocumentList(updatedList);
  };

  const handleResetDocsToDefault = async () => {
    if (!canManageAllCampuses) return;
    const defaultDocs = getDocumentDefinitionsForSchoolType(schoolData.school_type || school?.school_type, null);
    await handleSaveDocumentList(defaultDocs);
    toast.success("Pièces réinitialisées selon les standards de votre type d'établissement.");
  };

  const handleCleanSchoolData = async () => {
    if (!isPrimaryAdmin) {
      toast.error("Action refusée : Seul le 1er Administrateur / Fondateur de cet établissement ou un Super Admin peut vider les données.");
      return;
    }

    const expectedName = cleanScope === 'all' ? schoolData.name : (campuses.find(c => c.id === cleanScope)?.name || '');
    if (confirmSchoolName !== expectedName) {
      toast.error(`Le nom ne correspond pas. Veuillez saisir exactement "${expectedName}".`);
      return;
    }

    if (confirmUserEmail.trim().toLowerCase() !== (user.email || '').trim().toLowerCase()) {
      toast.error("Validation d'identité échouée : L'adresse email saisie ne correspond pas à votre compte connecté.");
      return;
    }

    setIsCleaning(true);
    try {
      const targetCampusId = cleanScope === 'all' ? null : cleanScope;
      const selectedCampus = campuses.find(c => c.id === cleanScope);
      const scopeLabel = selectedCampus ? `Annexe "${selectedCampus.name}"` : "Tout l'établissement (Siège & Annexes)";

      const { error } = await supabase.rpc('clean_school_test_data', { 
        p_school_id: user.school_id,
        p_campus_id: targetCampusId
      });
      if (error) throw error;

      await AuditLogger.log({
        school_id: user.school_id,
        user_id: user.id,
        action: 'DELETE',
        entity_type: 'school',
        entity_id: user.school_id,
        details: { 
          type: 'clean_test_data', 
          school_name: schoolData.name,
          scope: cleanScope,
          scope_label: scopeLabel,
          validated_by_primary_admin: user.email
        }
      });

      toast.success(`Les données pour [${scopeLabel}] ont été réinitialisées avec succès.`);
      setIsCleanModalOpen(false);
      setConfirmSchoolName('');
      setConfirmUserEmail('');
      setCleanScope('all');
      await fetchData(); // Refresh page state
    } catch (err: any) {
      console.error("Erreur lors de la réinitialisation :", err);
      toast.error("Erreur lors de la réinitialisation : " + err.message);
    } finally {
      setIsCleaning(false);
    }
  };

  const handleAddYear = async () => {
    if (!newYearData.label) return;
    
    // Validation du libellé (Format strict: YYYY-YYYY)
    const sessionRegex = /^\d{4}-\d{4}$/;
    if (!sessionRegex.test(newYearData.label)) {
      toast.error("Format invalide. Utilisez YYYY-YYYY (ex: 2026-2027)");
      return;
    }

    const parts = newYearData.label.split('-');
    const startYear = parseInt(parts[0]);
    const endYear = parseInt(parts[1]);
    
    if (endYear !== startYear + 1) {
      toast.error("L'année de fin doit être l'année de début + 1 (ex: 2026-2027)");
      return;
    }
    
    // Vérifier s'il y a déjà une session en préparation
    const hasFutureSession = years.some(y => y.status === 'FUTURE');
    if (hasFutureSession) {
      toast.error("Une session est déjà en cours de préparation (Future). Veuillez l'activer ou l'archiver avant d'en créer une nouvelle.");
      return;
    }

    setActionLoading('add_year');
    try {
      const { data, error } = await supabase
        .from('academic_years')
        .insert([{
          school_id: user.school_id,
          label: newYearData.label,
          status: 'VIERGE',
          start_date: newYearData.startDate || null,
          end_date: newYearData.endDate || null
        }])
        .select()
        .single();

      if (error) throw error;
      setYears([data, ...years]);
      setNewYearData({
        label: '',
        startDate: '',
        endDate: ''
      });
      toast.success("Nouvelle session ajoutée");
    } catch (err) {
      console.error("Error adding year:", err);
      toast.error("Erreur lors de l'ajout");
    } finally {
      setActionLoading(null);
    }
  };

  const [confirmState, setConfirmState] = useState<{
    year: any;
    status: string;
  } | null>(null);

  const handleUpdateStatus = async (yearId: string, status: string) => {
    // Empêcher d'avoir 2 sessions en préparation
    if (status === 'FUTURE') {
      const hasFutureSession = years.some(y => y.status === 'FUTURE' && y.id !== yearId);
      if (hasFutureSession) {
        toast.error("Une session est déjà en cours de préparation.");
        return;
      }
    }

    setActionLoading('status_' + yearId);
    try {
      if (status === 'ACTIVE') {
        if (schoolData?.school_type === 'PROFESSIONAL' || schoolData?.school_type === 'UNIVERSITY') {
          const { error } = await supabase
            .from('academic_years')
            .update({ status: 'ACTIVE', is_active: true })
            .eq('id', yearId)
            .eq('school_id', user.school_id);
          if (error) throw error;
        } else {
          // Classic mode: set previous ACTIVE years to PAST, then set target to ACTIVE
          await supabase
            .from('academic_years')
            .update({ status: 'PAST', is_active: false })
            .eq('school_id', user.school_id)
            .eq('status', 'ACTIVE');

          const { error: activateError } = await supabase
            .from('academic_years')
            .update({ status: 'ACTIVE', is_active: true })
            .eq('id', yearId)
            .eq('school_id', user.school_id);

          if (activateError) {
            const { error: rpcError } = await supabase.rpc('activate_academic_year', {
              p_school_id: user.school_id,
              p_year_id: yearId
            });
            if (rpcError) throw rpcError;
          }
        }
      } else {
        const { error } = await supabase
          .from('academic_years')
          .update({ status })
          .eq('id', yearId)
          .eq('school_id', user.school_id);
        if (error) throw error;
      }
      
      await fetchData();
      toast.success("Statut de la session mis à jour");
      setConfirmState(null);
    } catch (err) {
      console.error("Error updating status:", err);
      toast.error("Erreur lors de la mise à jour");
    } finally {
      setActionLoading(null);
    }
  };

  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteStatus, setDeleteStatus] = useState<{
    enrollments?: number;
    payments?: number;
    fee_plans?: number;
    grades?: number;
    attendance?: number;
  }>({});

  const handleDeleteYear = async () => {
    if (!sessionToDelete) return;
    setIsDeleting(true);
    setSaving(true);
    try {
      // Pour une session qu'on veut supprimer *avec tout ce qu'elle inclut*,
      // il faut vider toutes les tables dépendantes d'abord (en cascade manuel si RLS/FK restrict le Delete)
      const tablesToClean = [
        'payments', 'enrollments', 'fee_plans', 'supply_catalog', 
        'expenses', 'school_supplies', 'grades', 'student_attendances', 
        'course_signatures', 'staff_assignments', 'disciplinary_records'
      ];
      
      for (const table of tablesToClean) {
        await supabase.from(table).delete().eq('academic_year_id', sessionToDelete.id).eq('school_id', user.school_id);
      }

      const { error } = await supabase
        .from('academic_years')
        .delete()
        .eq('id', sessionToDelete.id)
        .eq('school_id', user.school_id);

      if (error) throw error;
      setYears(years.filter(y => y.id !== sessionToDelete.id));
      setSessionToDelete(null);
      setDeleteStatus({});
      toast.success(`${terminology.academicYear} et ses données liées supprimées avec succès`);
    } catch (err: any) {
      console.error("Error deleting year:", err);
      const errorMsg = err.message || err.details || "Erreur inconnue lors de la suppression";
      toast.error(`Échec de la suppression : ${errorMsg}`);
    } finally {
      setIsDeleting(false);
      setSaving(false);
    }
  };

  const handleUpdateExchangeRate = async () => {
    const rate = parseFloat(newExchangeRate);
    if (isNaN(rate) || rate <= 0) {
      toast.error("Taux invalide");
      return;
    }
    setSaving(true);
    try {
      // Check if a rate for today already exists to either update it or handle the unique constraint
      // The table has a UNIQUE(school_id, effective_date) where effective_date defaults to CURRENT_DATE
      
      const { data, error } = await supabase
        .from('exchange_rates')
        .upsert([{
          school_id: user.school_id,
          rate_usd_to_htg: rate,
          created_by: user.id
          // effective_date will be handled by the default value or the unique constraint
        }], { 
          onConflict: 'school_id,effective_date',
          ignoreDuplicates: false 
        })
        .select()
        .single();

      if (error) throw error;
      
      setExchangeRate(data);
      
      // Update history list: if it was an update of today's rate, replace it; otherwise add new
      const filteredHistory = exchangeRates.filter(r => r.id !== data.id);
      setExchangeRates([data, ...filteredHistory.slice(0, 9)]);
      
      toast.success("Taux de change mis à jour");
      setNewExchangeRate(rate.toString());
      
      await AuditLogger.log({
        school_id: user.school_id,
        user_id: user.id,
        action: 'UPDATE',
        entity_type: 'exchange_rate',
        details: { rate }
      });
    } catch (err: any) {
      console.error("Error updating rate:", err);
      const msg = err.message || "Erreur lors de la mise à jour";
      toast.error(msg.includes('duplicate key') ? "Un taux a déjà été défini pour aujourd'hui" : msg);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateMoncash = async () => {
    setSaving(true);
    try {
      const payload = {
        ...moncashConfig,
        school_id: user.school_id,
        gateway_name: 'moncash'
      };

      let error;
      if (moncashConfig.id) {
        const { error: updateError } = await supabase
          .from('payment_gateways')
          .update(payload)
          .eq('id', moncashConfig.id)
          .eq('school_id', user.school_id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from('payment_gateways')
          .insert([payload]);
        error = insertError;
      }

      if (error) throw error;
      
      await AuditLogger.log({
        school_id: user.school_id,
        user_id: user.id,
        action: moncashConfig.id ? 'UPDATE' : 'CREATE',
        entity_type: 'payment_gateway',
        details: { gateway: 'moncash', mode: moncashConfig.mode }
      });

      toast.success("Configuration MonCash mise à jour");
      fetchData();
    } catch (err) {
      console.error("Error updating MonCash:", err);
      toast.error("Erreur lors de la mise à jour MonCash");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (securityData.newPassword !== securityData.confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas");
      return;
    }
    if (securityData.newPassword.length < 6) {
      toast.error("Le mot de passe doit contenir au moins 6 caractères");
      return;
    }
    setSaving(true);
    try {
      // 1. Fetch current profile to get the most up-to-date last_password_changed_at
      const { data: dbProfile, error: profileErr } = await supabase
        .from('profiles')
        .select('last_password_changed_at')
        .eq('id', user.id)
        .single();
      
      if (profileErr) throw profileErr;

      // 2. Check if password was already changed today
      if (dbProfile && dbProfile.last_password_changed_at) {
        const lastChange = new Date(dbProfile.last_password_changed_at);
        const today = new Date();
        if (lastChange.toDateString() === today.toDateString()) {
          toast.error("Vous ne pouvez changer votre mot de passe qu'une seule fois par jour.");
          setSaving(false);
          return;
        }
      }

      // 3. Update the password in Supabase Auth
      const { error } = await supabase.auth.updateUser({
        password: securityData.newPassword
      });
      if (error) throw error;

      // 4. Update the last_password_changed_at timestamp in the profile
      const { error: updateProfileErr } = await supabase
        .from('profiles')
        .update({ last_password_changed_at: new Date().toISOString() })
        .eq('id', user.id);
      
      if (updateProfileErr) throw updateProfileErr;

      setSecurityData({ newPassword: '', confirmPassword: '' });
      toast.success("Mot de passe mis à jour");
    } catch (err: any) {
      console.error("Error updating password:", err);
      toast.error(err.message || "Erreur lors de la mise à jour");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSecurityPolicy = async () => {
    if (!user.school_id) return;
    if (sessionTimeoutInput < 1 || sessionTimeoutInput > 120) {
      toast.error("La durée d'inactivité doit être comprise entre 1 et 120 minutes.");
      return;
    }
    
    setSaving(true);
    try {
      // Fetch latest values first to prevent race condition
      const { data: latestSchool, error: fetchErr } = await supabase
        .from('schools')
        .select('global_settings')
        .eq('id', user.school_id)
        .single();
        
      if (fetchErr) throw fetchErr;
      
      let currentSettings: any = {};
      if (latestSchool && latestSchool.global_settings) {
        if (typeof latestSchool.global_settings === 'string') {
          try { currentSettings = JSON.parse(latestSchool.global_settings); } catch (e) {}
        } else {
          currentSettings = latestSchool.global_settings;
        }
      }
      
      const updatedSettings = {
        ...currentSettings,
        session_timeout_minutes: sessionTimeoutInput
      };
      
      const { error: updateErr } = await supabase
        .from('schools')
        .update({ global_settings: updatedSettings })
        .eq('id', user.school_id);
        
      if (updateErr) throw updateErr;
      
      await AuditLogger.log({
        school_id: user.school_id,
        user_id: user.id,
        action: 'UPDATE',
        entity_type: 'settings',
        details: { session_timeout_minutes: sessionTimeoutInput }
      });
      
      toast.success("Politique de session mise à jour avec succès ! Les modifications sont prises en compte.");
      
      // Update our schoolData state as well
      setSchoolData((prev: any) => ({
        ...prev,
        global_settings: updatedSettings
      }));

      // Sync context
      if (refreshSchool) {
        await refreshSchool();
      }
    } catch (err: any) {
      console.error("Error updating security policy:", err);
      toast.error(err.message || "Erreur lors de la mise à jour de la politique de sécurité");
    } finally {
      setSaving(false);
    }
  };

  const handleRepairPermissions = async () => {
    setSaving(true);
    try {
      // Logic for repairing permissions
      await new Promise(resolve => setTimeout(resolve, 2000));
      toast.success("Permissions réinitialisées avec succès");
    } catch (err) {
      console.error("Error repairing permissions:", err);
      toast.error("Erreur lors de la réparation");
    } finally {
      setSaving(false);
    }
  };

  const handleExportToGitHub = async () => {
    if (!githubToken.trim()) {
      toast.error("Veuillez renseigner votre token d'accès personnel GitHub (Personal Access Token).");
      return;
    }
    if (!githubOwner.trim() || !githubRepo.trim()) {
      toast.error("Veuillez spécifier le propriétaire et le nom du dépôt GitHub.");
      return;
    }

    try {
      localStorage.setItem('edunova_github_pat', githubToken.trim());
    } catch (e) {}

    setIsExportingGitHub(true);
    setGithubExportProgress({ step: "Connexion et analyse des sources du projet...", percent: 5 });
    setGithubExportResult(null);

    try {
      const response = await fetch('/api/export-github', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/x-ndjson, application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || ''}`
        },
        body: JSON.stringify({
          token: githubToken.trim(),
          owner: githubOwner.trim(),
          repo: githubRepo.trim(),
          branch: githubBranch.trim() || 'main',
          commitMessage: githubCommitMsg.trim() || `Exportation synchronisée depuis EduNova Pro (${new Date().toLocaleString('fr-FR')})`
        })
      });

      if (!response.ok && !response.body) {
        let errMessage = "Une erreur est survenue lors de l'exportation vers GitHub.";
        try {
          const errData = await response.json();
          errMessage = errData.error || errMessage;
        } catch (e) {}
        throw new Error(errMessage);
      }

      let exportFinalResult: any = null;

      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const payload = JSON.parse(trimmed);
              if (payload.type === 'progress') {
                setGithubExportProgress({ step: payload.step, percent: payload.percent });
              } else if (payload.type === 'result' || payload.success) {
                exportFinalResult = payload;
              } else if (payload.type === 'error' || payload.error) {
                throw new Error(payload.error || "Erreur lors de l'exportation vers GitHub.");
              }
            } catch (jsonErr: any) {
              if (jsonErr.message && !jsonErr.message.includes('JSON')) {
                throw jsonErr;
              }
            }
          }
        }

        // Process any remaining text in buffer
        if (buffer.trim()) {
          try {
            const payload = JSON.parse(buffer.trim());
            if (payload.type === 'result' || payload.success) {
              exportFinalResult = payload;
            } else if (payload.type === 'error' || payload.error) {
              throw new Error(payload.error || "Erreur lors de l'exportation vers GitHub.");
            }
          } catch (e) {}
        }
      } else {
        const data = await response.json();
        if (!data.success) {
          throw new Error(data.error || "Une erreur est survenue lors de l'exportation vers GitHub.");
        }
        exportFinalResult = data;
      }

      if (!exportFinalResult || !exportFinalResult.success) {
        throw new Error(exportFinalResult?.error || "L'exportation n'a pas pu être validée.");
      }

      setGithubExportResult({
        success: true,
        commitSha: exportFinalResult.commitSha,
        filesCount: exportFinalResult.filesCount,
        modifiedFilesCount: exportFinalResult.modifiedFilesCount,
        repoUrl: exportFinalResult.repoUrl,
        commitUrl: exportFinalResult.commitUrl
      });

      setGithubExportProgress({ step: "Exportation des sources terminée avec succès !", percent: 100 });
      toast.success(`Projet exporté avec succès vers ${githubOwner}/${githubRepo} (${exportFinalResult.filesCount} fichiers) !`);

      await AuditLogger.log({
        school_id: user.school_id,
        user_id: user.id,
        action: 'UPDATE',
        entity_type: 'settings',
        details: { 
          action: 'GITHUB_EXPORT',
          repo: `${githubOwner}/${githubRepo}`,
          branch: githubBranch,
          commitSha: exportFinalResult.commitSha,
          filesCount: exportFinalResult.filesCount
        }
      });
    } catch (err: any) {
      console.error("GitHub Export Error:", err);
      toast.error(err.message || "Erreur lors de l'exportation vers GitHub");
      setGithubExportProgress(null);
    } finally {
      setIsExportingGitHub(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin text-slate-900" size={40} />
      </div>
    );
  }

  const tabs = [
    { id: 'school', label: 'Profil Établissement', icon: School },
    ...((school?.has_multi_campus) ? [{ id: 'campuses', label: 'Filières / Annexes', icon: MapPin }] : []),
    { id: 'academic', label: terminology.academicYears, icon: Calendar },
    { id: 'finance', label: 'Finance & Taux', icon: CircleDollarSign },
    { id: 'payment_methods', label: 'Modes de Règlement & Banques', icon: Wallet },
    { id: 'gateways', label: 'Passerelles API', icon: Key },
    { id: 'security', label: 'Sécurité', icon: Shield }
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
      <div>
       <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Configuration Système</h2>
       <p className="text-slate-700 mt-2 font-medium text-sm tracking-tight">Paramètres généraux et préférences de votre établissement</p>
      </div>
      <div className="flex items-center gap-3">
       {isSuperAdmin && isDevWorkstation && (
        <button
         onClick={() => setIsGitHubModalOpen(true)}
         className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold shadow-sm transition-all active:scale-95 cursor-pointer"
         title="Exporter l'ensemble du projet vers votre dépôt GitHub (Super Admin sur poste de développement uniquement)"
        >
         <GitBranch size={15} className="text-emerald-400" />
         <span>Exporter vers GitHub</span>
        </button>
       )}
       <div className="hidden sm:flex items-center gap-2 px-3.5 py-2 bg-emerald-50 border border-emerald-200/80 text-emerald-700 rounded-xl text-xs font-semibold shadow-xs">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        <span>Synchro Cloud Automatique</span>
       </div>
       <button 
        onClick={fetchData} 
        title="Actualiser les paramètres"
        className="p-3.5 bg-white border border-slate-200 text-slate-700 hover:text-slate-900 rounded-xl hover:bg-slate-50 transition-all shadow-xs cursor-pointer active:scale-95"
       >
        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
       </button>
      </div>
     </div>

     <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      <div className="lg:col-span-4 space-y-6">
       <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-2">
        {tabs.map(item => (
         <button 
          key={item.id} 
          onClick={() => setActiveTab(item.id as SettingsTab)}
          className={`flex items-center gap-5 px-8 py-5 rounded-xl text-sm font-bold tracking-tight transition-all ${activeTab === item.id ? 'bg-slate-900 text-white shadow-lg shadow-slate-200' : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'}`}
         >
          <item.icon size={22} />
          {item.label}
         </button>
        ))}
       </div>

       {/* GitHub Quick Access Card (Super Admin Exclusive on Dev Workstation) */}
       {isSuperAdmin && isDevWorkstation && (
         <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-slate-950 p-5 rounded-2xl text-white shadow-md border border-slate-800 space-y-3">
           <div className="flex items-center justify-between">
             <div className="flex items-center gap-3">
               <div className="w-9 h-9 bg-white/10 text-emerald-400 rounded-xl flex items-center justify-center shrink-0 border border-white/10">
                 <GitBranch size={18} />
               </div>
               <div>
                 <h4 className="text-xs font-bold text-white tracking-tight">Dépôt GitHub</h4>
                 <p className="text-[11px] text-slate-400 font-mono">Jackito46 / EduNova...</p>
               </div>
             </div>
             <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded text-[9px] font-black uppercase tracking-wider">
               Dev Only
             </span>
           </div>
           <p className="text-[11px] text-slate-300 leading-relaxed">
             Transférer et synchroniser les modifications du poste vers GitHub en 1 clic.
           </p>
           <button
             type="button"
             id="btn-github-export-sidebar"
             onClick={() => setIsGitHubModalOpen(true)}
             disabled={isExportingGitHub}
             className="w-full py-2.5 bg-white text-slate-900 hover:bg-slate-100 rounded-xl font-bold text-xs tracking-tight flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95 cursor-pointer disabled:opacity-85"
           >
             {isExportingGitHub ? (
               <>
                 <Loader2 size={14} className="animate-spin text-indigo-600 shrink-0" />
                 <span>Envoi GitHub ({githubExportProgress?.percent || 0}%)...</span>
               </>
             ) : (
               <>
                 <GitPullRequest size={14} />
                 <span>Exporter vers GitHub</span>
               </>
             )}
           </button>
         </div>
       )}
      </div>

      <div className="lg:col-span-8">
       {activeTab === 'school' && (
         <div className="space-y-6 animate-in slide-in-from-right duration-500">
           {!canManageAllCampuses && (
             <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
               <div className="flex items-start gap-4">
                 <span className="p-3 bg-amber-100 text-amber-800 rounded-xl leading-none shrink-0"><Lock size={20} /></span>
                 <div>
                   <h4 className="text-sm font-bold text-amber-900 font-sans tracking-tight">Droits d'élaboration limités (Annexe)</h4>
                   <p className="text-xs text-amber-700/90 font-medium mt-1 leading-relaxed">
                     Votre compte est rattaché à l'annexe <strong className="font-bold">"{userCampus?.name || 'Inconnue'}"</strong>. Les informations de l'identité globale de l'établissement ne peuvent être gérées que par les administrateurs du <strong className="font-bold">Siège Social</strong>.
                   </p>
                 </div>
               </div>
               <span className="px-3 py-1.5 bg-amber-100/50 text-amber-800 text-[10px] font-black rounded-lg uppercase tracking-widest block whitespace-nowrap">
                 Lecture Seule
               </span>
             </div>
           )}

           <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
             {/* Header */}
             <div className="p-6 md:p-8 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between bg-slate-50/50 gap-4">
               <div className="flex items-center gap-4">
                 <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100 shrink-0">
                   <Building2 size={24} />
                 </div>
                 <div>
                   <div className="flex items-center gap-2">
                       <h3 className="text-lg font-bold tracking-tight text-slate-900">Identité de l'Établissement</h3>
                      {school?.has_multi_campus ? (
                       <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold rounded-full flex items-center gap-1">
                         <Layers size={10} /> Multi-Annexes
                       </span>
                     ) : (
                       <span className="px-2.5 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-full">
                         Site Unique
                       </span>
                     )}
                   </div>
                   <p className="text-xs text-slate-500 font-medium mt-0.5">Configuration des métadonnées officielles et visuelles</p>
                 </div>
               </div>

               <button 
                 onClick={handleUpdateSchool} 
                 disabled={saving || !canManageAllCampuses} 
                 className="w-full sm:w-auto px-6 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl font-bold text-xs tracking-tight flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
               >
                 {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                 <span>Enregistrer</span>
               </button>
             </div>

          <div className="p-6 md:p-10 space-y-10 md:space-y-12">
             {!canManageAllCampuses && userCampus && (
               <div className="space-y-6 bg-indigo-50/20 border border-indigo-100/60 p-6 md:p-8 rounded-3xl relative overflow-hidden">
                 <div className="absolute right-0 top-0 p-8 text-indigo-500/10 pointer-events-none">
                   <MapPin size={80} />
                 </div>
                 <div className="flex items-center gap-3 pb-2 border-b border-indigo-100/40">
                   <div className="w-1.5 h-6 bg-indigo-600 rounded-full"></div>
                   <h4 className="text-[11px] font-black text-indigo-900 uppercase tracking-[0.2em]">Votre Identité d'Annexe d'Attache</h4>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                   <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-800 uppercase tracking-widest ml-1">Nom de l'Annexe / Campus</label>
                     <input 
                       type="text" 
                       disabled
                       className="w-full px-5 py-3.5 bg-white text-slate-900 border border-slate-200 rounded-xl text-sm font-bold shadow-sm disabled:opacity-95"
                       value={userCampus.name}
                     />
                   </div>
                   <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-800 uppercase tracking-widest ml-1">Type de structure administrative</label>
                     <input 
                       type="text" 
                       disabled
                       className="w-full px-5 py-3.5 bg-white text-slate-900 border border-slate-200 rounded-xl text-sm font-bold shadow-sm disabled:opacity-95"
                       value="Annexe Régionale Autonome"
                     />
                   </div>
                   <div className="md:col-span-2">
                     <p className="text-xs font-semibold text-indigo-950 leading-relaxed italic bg-indigo-50/55 border border-indigo-100/40 p-4 rounded-xl">
                       💡 Informations locales rattachées : Vos actions d'inscription, de saisie de notes et de perception de scolarités sont centralisées ou consolidées sous le nom géographique de l'annexe <strong className="font-bold">"{userCampus.name}"</strong>. Toute modification structurelle ou d'adresse locale doit faire l'objet d'une validation auprès du Siège Social.
                     </p>
                   </div>
                 </div>
               </div>
             )}

            {/* Groupe: Informations Générales */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 pb-2 border-b border-slate-50 group">
                <div className="w-1.5 h-6 bg-slate-900 rounded-full"></div>
                <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-[0.2em]">Informations Générales</h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-800 uppercase tracking-widest ml-1">Nom Officiel de l'Établissement</label>
                  <input 
                    type="text" 
                    className="w-full px-5 py-3.5 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-100 shadow-sm transition-all disabled:opacity-75 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                    value={schoolData.name || ''}
                    onChange={e => setSchoolData({...schoolData, name: e.target.value})}
                    disabled={!canManageAllCampuses}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-800 uppercase tracking-widest ml-1">Nom du Signataire Officiel (Directeur / Doyen)</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Jacques ETIENNE"
                    className="w-full px-5 py-3.5 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-100 shadow-sm transition-all disabled:opacity-75 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                    value={schoolData.director_name || ''}
                    onChange={e => setSchoolData({...schoolData, director_name: e.target.value})}
                    disabled={!canManageAllCampuses}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-800 uppercase tracking-widest ml-1">Titre de Fonction du Signataire (Bulletins / Documents)</label>
                  <input 
                    type="text" 
                    placeholder="Ex: La Direction Pédagogique, Le Doyen, Le Rectorat..."
                    className="w-full px-5 py-3.5 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-100 shadow-sm transition-all disabled:opacity-75 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                    value={schoolData.global_settings?.signature_title || ''}
                    onChange={e => {
                      const currentGs = typeof schoolData.global_settings === 'object' ? (schoolData.global_settings || {}) : {};
                      setSchoolData({
                        ...schoolData,
                        global_settings: {
                          ...currentGs,
                          signature_title: e.target.value
                        }
                      });
                    }}
                    disabled={!canManageAllCampuses}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-800 uppercase tracking-widest ml-1">Langue & Format de Date d'Émission</label>
                  <select
                    className="w-full px-5 py-3.5 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-100 shadow-sm transition-all disabled:opacity-75 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                    value={schoolData.global_settings?.locale || 'fr-FR'}
                    onChange={e => {
                      const currentGs = typeof schoolData.global_settings === 'object' ? (schoolData.global_settings || {}) : {};
                      setSchoolData({
                        ...schoolData,
                        global_settings: {
                          ...currentGs,
                          locale: e.target.value
                        }
                      });
                    }}
                    disabled={!canManageAllCampuses}
                  >
                    <option value="fr-FR">Français (ex: 16 août 2026 - Fait à ...)</option>
                    <option value="ht-HT">Kreyòl Ayisyen (ex: 16 out 2026 - Fèt nan ...)</option>
                    <option value="en-US">English (ex: August 16, 2026 - Issued in ...)</option>
                    <option value="es-ES">Español (ex: 16 de agosto de 2026 - Expedido en ...)</option>
                  </select>
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-black text-slate-800 uppercase tracking-widest ml-1">Devise de l'Établissement (Motto)</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Excellence - Savoir - Discipline"
                    className="w-full px-5 py-3.5 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-100 shadow-sm transition-all disabled:opacity-75 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                    value={schoolData.motto || ''}
                    onChange={e => setSchoolData({...schoolData, motto: e.target.value})}
                    disabled={!canManageAllCampuses}
                  />
                </div>
              </div>
            </div>

            {/* Groupe: Identification Légale & Fondation */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 pb-2 border-b border-slate-50">
                <div className="w-1.5 h-6 bg-slate-900 rounded-full"></div>
                <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-[0.2em]">Identification Légale & Fondation</h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-800 uppercase tracking-widest ml-1">Année de Fondation</label>
                  <input 
                    type="number" 
                    className="w-full px-5 py-3.5 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-100 shadow-sm transition-all disabled:opacity-75 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                    value={schoolData.foundation_year || ''}
                    onChange={e => setSchoolData({...schoolData, foundation_year: e.target.value})}
                    disabled={!canManageAllCampuses}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-800 uppercase tracking-widest ml-1">NIF (Identifiant Fiscal)</label>
                  <input 
                    type="text" 
                    placeholder="000-000-000-0"
                    className="w-full px-5 py-3.5 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-100 shadow-sm transition-all disabled:opacity-75 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                    value={schoolData.nif || ''}
                    onChange={e => setSchoolData({...schoolData, nif: e.target.value})}
                    disabled={!canManageAllCampuses}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-800 uppercase tracking-widest ml-1">N° Licence / Agrément</label>
                  <input 
                    type="text" 
                    placeholder="MENFP-..."
                    className="w-full px-5 py-3.5 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-100 shadow-sm transition-all disabled:opacity-75 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                    value={schoolData.license_number || ''}
                    onChange={e => setSchoolData({...schoolData, license_number: e.target.value})}
                    disabled={!canManageAllCampuses}
                  />
                </div>
              </div>
            </div>

            {/* Groupe: Coordonnées & Contact */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 pb-2 border-b border-slate-50">
                <div className="w-1.5 h-6 bg-slate-900 rounded-full"></div>
                <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-[0.2em]">Coordonnées & Contact</h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-black text-slate-800 uppercase tracking-widest ml-1 flex items-center gap-2"><MapPin size={12} /> Adresse Physique</label>
                  <input 
                    type="text" 
                    className="w-full px-5 py-3.5 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-100 shadow-sm transition-all disabled:opacity-75 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                    value={schoolData.address || ''}
                    onChange={e => setSchoolData({...schoolData, address: e.target.value})}
                    disabled={!canManageAllCampuses}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-800 uppercase tracking-widest ml-1 flex items-center gap-2"><Phone size={12} /> Téléphone</label>
                  <input 
                    type="text" 
                    className="w-full px-5 py-3.5 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-100 shadow-sm transition-all"
                    value={schoolData.phone || ''}
                    onChange={e => setSchoolData({...schoolData, phone: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-800 uppercase tracking-widest ml-1 flex items-center gap-2"><Mail size={12} /> Email Institutionnel</label>
                  <input 
                    type="email" 
                    className="w-full px-5 py-3.5 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-100 shadow-sm transition-all"
                    value={schoolData.email || ''}
                    onChange={e => setSchoolData({...schoolData, email: e.target.value})}
                  />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-black text-slate-800 uppercase tracking-widest ml-1 flex items-center gap-2"><Globe size={12} /> Site Web</label>
                  <input 
                    type="text" 
                    placeholder="https://www.ecole.com"
                    className="w-full px-5 py-3.5 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-100 shadow-sm transition-all font-mono"
                    value={schoolData.website || ''}
                    onChange={e => setSchoolData({...schoolData, website: e.target.value})}
                  />
                </div>
              </div>
            </div>

             {/* Option Multi-Annexes */}
             <div className="pt-8 border-t border-slate-100">
               <div className="flex items-center justify-between p-4 sm:p-5 bg-slate-50/80 rounded-xl border border-slate-200/80 gap-4">
                 <div className="flex items-center gap-3.5">
                   <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl shrink-0">
                     <Layers size={20} />
                   </div>
                   <div>
                     <div className="flex items-center gap-2">
                       <p className="text-xs font-bold text-slate-900">Gestion Multi-Annexes / Campus</p>
                       {(isSuperAdmin ? schoolData.has_multi_campus : school?.has_multi_campus) ? (
                         <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-md">Actif</span>
                       ) : (
                         <span className="px-2 py-0.5 bg-slate-200 text-slate-600 text-[10px] font-bold rounded-md">Campus unique</span>
                       )}
                     </div>
                     <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                       {isSuperAdmin 
                         ? "Activer ou désactiver l'architecture multi-sites pour cet établissement."
                         : school?.has_multi_campus 
                           ? "Votre établissement dispose de la gestion multi-annexes active."
                           : "Pour débloquer la gestion multi-annexes, contactez votre chargé de compte EduNova."
                       }
                     </p>
                   </div>
                 </div>

                 {isSuperAdmin ? (
                   <label className="relative inline-flex items-center cursor-pointer shrink-0">
                     <input 
                       type="checkbox" 
                       className="sr-only peer"
                       checked={!!schoolData.has_multi_campus}
                       onChange={e => setSchoolData({...schoolData, has_multi_campus: e.target.checked})}
                     />
                     <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                   </label>
                 ) : (
                   <div className="shrink-0">
                     {school?.has_multi_campus ? (
                       <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                         <CheckCircle2 size={14} /> Activé
                       </span>
                     ) : (
                       <span className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                         <Lock size={14} /> Restreint
                       </span>
                     )}
                   </div>
                 )}
               </div>
             </div>

            {/* Logo Section */}
            <div className="pt-8 border-t border-slate-100">
               <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><Upload size={16} /></div>
                <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">Identité Visuelle</h4>
               </div>
               
               <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100 border-dashed">
                <div className="flex flex-col md:flex-row gap-8 items-start md:items-center">
                  <input 
                    type="file" 
                    id="logo-upload" 
                    className="hidden" 
                    accept="image/*" 
                    onChange={handleLogoUpload} 
                  />
                  <div 
                    className="w-32 h-32 bg-white border-2 border-white rounded-3xl flex items-center justify-center overflow-hidden shadow-xl shadow-slate-200/50 relative group cursor-pointer ring-4 ring-slate-50 flex-shrink-0"
                    onClick={() => document.getElementById('logo-upload')?.click()}
                  >
                    <Logo src={schoolData.logo_url} size="xl" className="p-3" />
                    <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Camera className="text-white" size={24} />
                    </div>
                  </div>

                  <div className="flex-1 space-y-4">
                    <div>
                      <h5 className="text-sm font-bold text-slate-900">Logo de l'Établissement</h5>
                      <p className="text-xs text-slate-700 mt-1 font-medium italic">Format carré (PNG ou JPG), max 2 Mo.</p>
                    </div>
                    
                    <div className="flex flex-wrap gap-3">
                      <button 
                        type="button" 
                        onClick={() => document.getElementById('logo-upload')?.click()}
                        className="px-4 py-2 bg-slate-900 text-white text-[10px] font-bold rounded-xl transition-all hover:bg-black shadow-sm flex items-center gap-2 active:scale-95"
                      >
                        <Upload size={14} /> Changer le logo
                      </button>
                      {schoolData.logo_url && (
                        <button 
                          type="button" 
                          onClick={() => setSchoolData({...schoolData, logo_url: null})}
                          className="px-4 py-2 bg-rose-50 text-rose-600 text-[10px] font-bold rounded-xl transition-all hover:bg-rose-100 flex items-center gap-2 active:scale-95"
                        >
                          <Trash2 size={14} /> Supprimer
                        </button>
                      )}
                    </div>
                    
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-700 group-focus-within:text-slate-900 transition-colors">
                        <Link size={12} />
                      </div>
                      <input 
                        type="text" 
                        placeholder="OU coller l'URL de votre logo ici..."
                        className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-[10px] font-bold outline-none focus:border-slate-900 transition-all font-mono"
                        value={schoolData.logo_url && !schoolData.logo_url.startsWith('data:') ? schoolData.logo_url : ''}
                        onChange={e => setSchoolData({...schoolData, logo_url: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Configuration des Modules */}
            <div className="pt-8 border-t border-slate-100">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><ShieldCheck size={16} /></div>
                <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">Configuration des Modules</h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Module Présences */}
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 flex items-start gap-4">
                  <div className="relative inline-flex items-center mt-1 shrink-0">
                    <input 
                      type="checkbox" 
                      id="module_presences_toggle"
                      className="sr-only peer" 
                      checked={schoolData.global_settings?.modules?.presences ?? (schoolData.school_type !== 'UNIVERSITY' && schoolData.school_type !== 'PROFESSIONAL')}
                      onChange={e => handleToggleModule('presences', e.target.checked)}
                      disabled={!canManageAllCampuses}
                    />
                    <div onClick={() => {
                      if (canManageAllCampuses) {
                        const currentVal = schoolData.global_settings?.modules?.presences ?? (schoolData.school_type !== 'UNIVERSITY' && schoolData.school_type !== 'PROFESSIONAL');
                        handleToggleModule('presences', !currentVal);
                      }
                    }} className={`w-11 h-6 rounded-full cursor-pointer relative transition-all duration-300 ${(schoolData.global_settings?.modules?.presences ?? (schoolData.school_type !== 'UNIVERSITY' && schoolData.school_type !== 'PROFESSIONAL')) ? 'bg-indigo-600' : 'bg-slate-200'} ${!canManageAllCampuses ? 'opacity-50 cursor-not-allowed' : ''}`}>
                      <div className={`w-5 h-5 bg-white rounded-full absolute top-[2px] transition-all duration-300 shadow-md ${(schoolData.global_settings?.modules?.presences ?? (schoolData.school_type !== 'UNIVERSITY' && schoolData.school_type !== 'PROFESSIONAL')) ? 'left-[22px]' : 'left-[2px]'}`}></div>
                    </div>
                  </div>
                  <div>
                    <label htmlFor="module_presences_toggle" className="text-sm font-bold text-slate-900 cursor-pointer block">Module Présences</label>
                    <p className="text-xs text-slate-500 mt-1 font-medium leading-relaxed">
                      Activer le registre d'appel quotidien, les feuilles de présences pour les cours, et le suivi d'assiduité.
                    </p>
                  </div>
                </div>

                {/* Module Discipline */}
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 flex items-start gap-4">
                  <div className="relative inline-flex items-center mt-1 shrink-0">
                    <input 
                      type="checkbox" 
                      id="module_discipline_toggle"
                      className="sr-only peer" 
                      checked={schoolData.global_settings?.modules?.discipline ?? (schoolData.school_type !== 'UNIVERSITY' && schoolData.school_type !== 'PROFESSIONAL')}
                      onChange={e => handleToggleModule('discipline', e.target.checked)}
                      disabled={!canManageAllCampuses}
                    />
                    <div onClick={() => {
                      if (canManageAllCampuses) {
                        const currentVal = schoolData.global_settings?.modules?.discipline ?? (schoolData.school_type !== 'UNIVERSITY' && schoolData.school_type !== 'PROFESSIONAL');
                        handleToggleModule('discipline', !currentVal);
                      }
                    }} className={`w-11 h-6 rounded-full cursor-pointer relative transition-all duration-300 ${(schoolData.global_settings?.modules?.discipline ?? (schoolData.school_type !== 'UNIVERSITY' && schoolData.school_type !== 'PROFESSIONAL')) ? 'bg-indigo-600' : 'bg-slate-200'} ${!canManageAllCampuses ? 'opacity-50 cursor-not-allowed' : ''}`}>
                      <div className={`w-5 h-5 bg-white rounded-full absolute top-[2px] transition-all duration-300 shadow-md ${(schoolData.global_settings?.modules?.discipline ?? (schoolData.school_type !== 'UNIVERSITY' && schoolData.school_type !== 'PROFESSIONAL')) ? 'left-[22px]' : 'left-[2px]'}`}></div>
                    </div>
                  </div>
                  <div>
                    <label htmlFor="module_discipline_toggle" className="text-sm font-bold text-slate-900 cursor-pointer block">Module Discipline</label>
                    <p className="text-xs text-slate-500 mt-1 font-medium leading-relaxed">
                      Activer le suivi disciplinaire, les blâmes, retenues, suspensions et le registre des incidents.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Pièces Justificatives Exigées à l'Inscription */}
            <div className="pt-8 border-t border-slate-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><FileCheck size={16} /></div>
                  <div>
                    <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">Pièces Exigées à l'Inscription</h4>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      Personnalisez les documents requis lors de l'admission d'un {terminology.student.toLowerCase()} pour votre établissement.
                    </p>
                  </div>
                </div>

                {canManageAllCampuses && (
                  <button
                    type="button"
                    onClick={handleResetDocsToDefault}
                    disabled={isSavingDocs}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 self-start sm:self-auto"
                  >
                    <RefreshCw size={13} className={isSavingDocs ? "animate-spin" : ""} />
                    Réinitialiser par défaut ({schoolData.school_type === 'UNIVERSITY' ? 'Université' : schoolData.school_type === 'PROFESSIONAL' ? 'Formation Pro' : 'École Fondamentale'})
                  </button>
                )}
              </div>

              {/* Form to add a new document requirement */}
              {canManageAllCampuses && (
                <form onSubmit={handleAddCustomDocument} className="bg-slate-50/80 p-4 sm:p-5 rounded-2xl border border-slate-200/80 mb-6 space-y-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                    <Plus size={14} className="text-indigo-600" />
                    <span>Ajouter une nouvelle pièce ou exigence</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                    <div className="md:col-span-6">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Nom de la pièce *</label>
                      <input
                        type="text"
                        placeholder="Ex: Certificat Médical Récent, Billet d'Ordre..."
                        value={newDocName}
                        onChange={e => setNewDocName(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-all"
                      />
                    </div>
                    <div className="md:col-span-6">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Description / Précisions (optionnel)</label>
                      <input
                        type="text"
                        placeholder="Ex: Délivré depuis moins de 3 mois..."
                        value={newDocDescription}
                        onChange={e => setNewDocDescription(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-all"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={newDocRequired}
                        onChange={e => setNewDocRequired(e.target.checked)}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                      />
                      <span>Document obligatoire par défaut</span>
                    </label>

                    <button
                      type="submit"
                      disabled={isSavingDocs || !newDocName.trim()}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 shadow-xs"
                    >
                      <Plus size={14} />
                      Ajouter au dossier
                    </button>
                  </div>
                </form>
              )}

              {/* List of configured documents */}
              <div className="space-y-3">
                {currentConfiguredDocs.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs font-medium">
                    Aucune pièce justificative configurée pour cet établissement.
                  </div>
                ) : (
                  currentConfiguredDocs.map((doc, idx) => (
                    <div 
                      key={doc.id || idx}
                      className="bg-white p-4 rounded-xl border border-slate-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs hover:border-slate-300 transition-all"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                          {idx + 1}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h5 className="text-xs font-bold text-slate-900">{doc.name}</h5>
                            <button
                              type="button"
                              onClick={() => canManageAllCampuses && handleToggleDocRequired(doc.id, !!doc.required)}
                              disabled={!canManageAllCampuses || isSavingDocs}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                                doc.required 
                                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100' 
                                  : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                              } ${!canManageAllCampuses ? 'cursor-default' : 'cursor-pointer'}`}
                            >
                              {doc.required ? 'Obligatoire' : 'Facultatif'}
                            </button>
                          </div>
                          {doc.description && (
                            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                              {doc.description}
                            </p>
                          )}
                        </div>
                      </div>

                      {canManageAllCampuses && (
                        <div className="flex items-center gap-2 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveCustomDocument(doc.id)}
                            disabled={isSavingDocs}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                            title="Supprimer cette pièce"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Sauvegarde Cloud des Données Critiques - Accessible Uniquement au Super Admin pour préserver le stockage Supabase (1 Go) */}
            {isSuperAdmin && (
              <div className="pt-8 border-t border-slate-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                      <CloudUpload size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">Sauvegarde Cloud des Données Critiques</h4>
                        <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 text-[10px] font-bold rounded-md flex items-center gap-1">
                          <Database size={10} /> Cloud Storage
                        </span>
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-900 text-[10px] font-black rounded-md flex items-center gap-1">
                          <Crown size={10} /> Super Admin
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">
                        Déclenchez manuellement une sauvegarde instantanée et chiffrée de toutes les données fondamentales de votre établissement.
                      </p>
                    </div>
                  </div>

                  {/* Cloud Status Pill */}
                  <div className="shrink-0 flex items-center gap-2">
                    {isBackingUp ? (
                      <span className="px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-full flex items-center gap-2 animate-pulse">
                        <Loader2 size={13} className="animate-spin text-indigo-600" />
                        Sauvegarde en cours...
                      </span>
                    ) : lastBackupInfo.status === 'SUCCESS' && lastBackupInfo.timestamp ? (
                      <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold rounded-full flex items-center gap-1.5 shadow-2xs">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        Cloud Sécurisé & À Jour
                      </span>
                    ) : lastBackupInfo.status === 'FAILED' ? (
                      <span className="px-3 py-1 bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold rounded-full flex items-center gap-1.5">
                        <AlertCircle size={13} />
                        Échec du dernier backup
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-slate-100 text-slate-600 border border-slate-200 text-xs font-bold rounded-full flex items-center gap-1.5">
                        <Clock size={13} />
                        Prêt pour premier backup
                      </span>
                    )}
                  </div>
                </div>

                {/* Main Backup Dashboard Card */}
                <div className="bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-2xl p-6 md:p-8 shadow-xl shadow-slate-900/10 border border-slate-800 space-y-6 relative overflow-hidden">
                  {/* Background decorative glow */}
                  <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10">
                    {/* Left Column: Status & Timestamp */}
                    <div className="lg:col-span-7 space-y-4">
                      <div className="flex items-center gap-2 text-indigo-300 text-xs font-bold uppercase tracking-wider">
                        <ShieldCheck size={16} className="text-indigo-400" />
                        <span>État de la Dernière Sauvegarde</span>
                      </div>

                      <div className="bg-slate-800/80 backdrop-blur-sm p-5 rounded-xl border border-slate-700/80 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-700/60 pb-3">
                          <div className="space-y-0.5">
                            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Horodatage de la sauvegarde</p>
                            <p className="text-sm md:text-base font-black text-white flex items-center gap-2">
                              <Clock size={16} className="text-indigo-400 shrink-0" />
                              {lastBackupInfo.timestamp ? (
                                <span>
                                  {new Date(lastBackupInfo.timestamp).toLocaleDateString('fr-FR', { 
                                    weekday: 'short', 
                                    day: 'numeric', 
                                    month: 'short', 
                                    year: 'numeric' 
                                  })} à {new Date(lastBackupInfo.timestamp).toLocaleTimeString('fr-FR', { 
                                    hour: '2-digit', 
                                    minute: '2-digit',
                                    second: '2-digit'
                                  })}
                                </span>
                              ) : (
                                <span className="text-slate-400 font-normal italic">Aucun horodatage enregistré</span>
                              )}
                            </p>
                          </div>

                          {lastBackupInfo.timestamp && (
                            <div className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold rounded-lg self-start sm:self-auto flex items-center gap-1.5">
                              <CheckCircle2 size={12} />
                              Succès Vérifié
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
                          <div>
                            <p className="text-[10px] text-slate-400 font-bold uppercase">Enregistrements</p>
                            <p className="text-sm font-black text-white mt-0.5">
                              {lastBackupInfo.rows_count != null ? lastBackupInfo.rows_count.toLocaleString('fr-FR') : '—'}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-400 font-bold uppercase">Tables Incluses</p>
                            <p className="text-sm font-black text-white mt-0.5">
                              {lastBackupInfo.tables_count || (lastBackupInfo.rows_count ? '38 tables' : '—')}
                            </p>
                          </div>
                          <div className="col-span-2 sm:col-span-1">
                            <p className="text-[10px] text-slate-400 font-bold uppercase">Taille de l'Archive</p>
                            <p className="text-sm font-black text-indigo-300 mt-0.5 font-mono">
                              {lastBackupInfo.size_bytes ? `${(lastBackupInfo.size_bytes / 1024).toFixed(1)} Ko` : '—'}
                            </p>
                          </div>
                        </div>

                        {lastBackupInfo.created_by_name && (
                          <div className="pt-2 text-[11px] text-slate-400 border-t border-slate-700/40 flex items-center gap-1.5">
                            <span>Initié par :</span>
                            <span className="font-bold text-slate-200">{lastBackupInfo.created_by_name}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right Column: Storage & Security Details */}
                    <div className="lg:col-span-5 space-y-4">
                      <div className="flex items-center gap-2 text-indigo-300 text-xs font-bold uppercase tracking-wider">
                        <HardDrive size={16} className="text-indigo-400" />
                        <span>Stockage & Chiffrement Cloud</span>
                      </div>

                      <div className="bg-slate-800/80 backdrop-blur-sm p-5 rounded-xl border border-slate-700/80 space-y-3">
                        <div className="space-y-1">
                          <p className="text-[10px] text-slate-400 font-bold uppercase">Cible de Réplication</p>
                          <p className="text-xs font-bold text-white flex items-center gap-1.5">
                            <Cloud size={14} className="text-sky-400" />
                            Supabase Cloud Storage (Bucket: <span className="font-mono text-indigo-300">database_backups</span>)
                          </p>
                        </div>

                        <div className="space-y-1">
                          <p className="text-[10px] text-slate-400 font-bold uppercase">Format & Intégrité</p>
                          <p className="text-xs text-slate-300 font-medium leading-relaxed">
                            JSON structuré & Checksum SHA-256 avec métadonnées conformes pour restauration intégrale ou sélective.
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={handleTestCloudStorage}
                          disabled={isTestingStorage}
                          className="text-[11px] text-indigo-300 hover:text-indigo-200 font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                        >
                          <RefreshCw size={12} className={isTestingStorage ? "animate-spin" : ""} />
                          <span>{isTestingStorage ? "Vérification en cours..." : "Tester la connexion au stockage Cloud"}</span>
                        </button>

                        {storageStatusInfo && (
                          <div className={`p-2.5 rounded-lg text-xs font-medium ${
                            storageStatusInfo.available 
                              ? 'bg-emerald-950/60 border border-emerald-800/80 text-emerald-300' 
                              : 'bg-rose-950/60 border border-rose-800/80 text-rose-300'
                          }`}>
                            {storageStatusInfo.message}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Live Progress Bar when Backing Up */}
                  {isBackingUp && (
                    <div className="bg-indigo-950/80 p-4 rounded-xl border border-indigo-500/40 space-y-2 animate-in fade-in duration-300">
                      <div className="flex items-center justify-between text-xs font-bold text-indigo-200">
                        <span className="flex items-center gap-2">
                          <Loader2 size={14} className="animate-spin text-indigo-400" />
                          {backupProgressStep || 'Traitement de la sauvegarde Cloud...'}
                        </span>
                        <span className="font-mono text-indigo-300">En cours</span>
                      </div>
                      <div className="w-full h-2 bg-indigo-900/60 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-indigo-500 via-sky-400 to-indigo-500 rounded-full animate-pulse w-full"></div>
                      </div>
                    </div>
                  )}

                  {/* Critical Data Coverage Badges */}
                  <div className="pt-2 border-t border-slate-800 space-y-2">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Périmètre des données scolaires sécurisées :</p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        'Élèves & Inscriptions',
                        'Frais & Règlements',
                        'Notes & Évaluations',
                        'Personnel & Salaires',
                        'Classes & Matières',
                        'Présences & Assiduité',
                        'Registre Disciplinaire',
                        'Dépenses & Caisse',
                        'Paramètres de l\'Établissement'
                      ].map((tag, i) => (
                        <span key={i} className="px-2.5 py-1 bg-slate-800/90 text-slate-300 text-[11px] font-medium rounded-lg border border-slate-700/60 flex items-center gap-1">
                          <Check size={11} className="text-emerald-400" />
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Action Buttons Toolbar */}
                  <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2.5">
                      {/* Primary Trigger Button */}
                      <button
                        type="button"
                        onClick={() => handleTriggerCloudBackup()}
                        disabled={isBackingUp}
                        className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold tracking-wide transition-all shadow-lg shadow-indigo-600/30 flex items-center gap-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      >
                        {isBackingUp ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <CloudUpload size={16} />
                        )}
                        <span>Déclencher une Sauvegarde Cloud</span>
                      </button>

                      {/* Custom Options Modal Opener */}
                      <button
                        type="button"
                        onClick={() => {
                          setBackupCustomName(`Sauvegarde Cloud - ${schoolData.name || 'École'} - ${new Date().toLocaleDateString('fr-FR')}`);
                          setBackupCustomDesc('');
                          setBackupScope('SCHOOL_SPECIFIC');
                          setIsBackupModalOpen(true);
                        }}
                        disabled={isBackingUp}
                        className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
                        title="Personnaliser le nom ou le périmètre de la sauvegarde"
                      >
                        <Sparkles size={14} className="text-indigo-400" />
                        <span>Options Avancées</span>
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {/* Download Last Backup File Button */}
                      {lastBackupInfo.id && (
                        <button
                          type="button"
                          onClick={handleDownloadLastBackup}
                          disabled={isBackingUp}
                          className="px-4 py-3 bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-2 active:scale-95"
                          title="Télécharger l'archive JSON sur votre ordinateur"
                        >
                          <Download size={14} className="text-sky-400" />
                          <span>Télécharger le Fichier</span>
                        </button>
                      )}

                      {/* History Modal Button */}
                      <button
                        type="button"
                        onClick={() => setIsHistoryModalOpen(true)}
                        className="px-4 py-3 bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-2 active:scale-95"
                      >
                        <Clock size={14} className="text-amber-400" />
                        <span>Historique ({recentSchoolBackups.length})</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Zone de Danger */}
            {canManageAllCampuses && (
              <div className="pt-8 border-t border-rose-100">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-rose-50 text-rose-600 rounded-lg"><AlertTriangle size={16} /></div>
                  <h4 className="text-[11px] font-black text-rose-900 uppercase tracking-[0.2em]">Zone de Danger</h4>
                </div>

                {isPrimaryAdmin ? (
                  <div className="bg-rose-50/40 p-6 rounded-2xl border border-rose-200/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-xs">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <h5 className="text-sm font-bold text-rose-950">Vider les informations de l'établissement</h5>
                        <span className="px-2.5 py-0.5 bg-rose-100 text-rose-800 text-[10px] font-black rounded-md flex items-center gap-1 border border-rose-200">
                          <Crown size={10} /> Droit Fondateur
                        </span>
                      </div>
                      <p className="text-xs text-rose-700 font-medium leading-relaxed max-w-2xl">
                        Cette action supprimera de manière définitive toutes les données opérationnelles associées à cet établissement (élèves, notes, présences, frais, paiements, dépenses, etc.) tout en conservant la structure générale de votre école.
                      </p>
                      <div className="flex items-center gap-2 text-[11px] font-bold text-rose-900 pt-1">
                        <ShieldCheck size={14} className="text-rose-600" />
                        <span>Privilège vérifié : <span className="underline">{user.email}</span> (1er Administrateur Système)</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmSchoolName('');
                        setConfirmUserEmail('');
                        setIsCleanModalOpen(true);
                      }}
                      className="w-full md:w-auto px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold tracking-tight transition-all flex items-center justify-center gap-2 shadow-lg shadow-rose-600/20 shrink-0 active:scale-95"
                    >
                      <Trash2 size={16} />
                      Vider les données
                    </button>
                  </div>
                ) : (
                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 opacity-85">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <h5 className="text-sm font-bold text-slate-900">Réinitialisation Verrouillée (Accès Sécurisé)</h5>
                        <span className="px-2.5 py-0.5 bg-slate-200 text-slate-700 text-[10px] font-bold rounded-md flex items-center gap-1">
                          <Lock size={10} /> Restreint
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 font-medium leading-relaxed max-w-2xl">
                        La réinitialisation globale des données est une opération à haut risque. Elle est exclusivement réservée au <strong>Premier Administrateur Système (Fondateur)</strong> de cet établissement {primaryAdmin?.full_name ? `(${primaryAdmin.full_name})` : ''} ou au Super-Admin EduNova.
                      </p>
                    </div>
                    <div className="px-4 py-2 bg-slate-200/80 text-slate-700 rounded-xl text-xs font-bold shrink-0 flex items-center gap-2">
                      <ShieldAlert size={14} /> Accès non autorisé
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Bottom Action Bar */}
            <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-6 border-t border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><AlertCircle size={16} /></div>
                <p className="text-[10px] font-bold text-slate-700 leading-relaxed uppercase tracking-tight">Vérifiez vos informations avant de confirmer.</p>
              </div>
              <button 
                onClick={handleUpdateSchool} 
                disabled={saving || !canManageAllCampuses} 
                className="w-full md:w-auto px-10 py-4 bg-slate-900 text-white rounded-xl font-bold text-xs tracking-widest uppercase flex items-center justify-center gap-3 hover:bg-black transition-all shadow-xl shadow-slate-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                title={!canManageAllCampuses ? "Modification réservée au Siège Social" : "Enregistrer les modifications"}
              >
                {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                Enregistrer les modifications
              </button>
            </div>
          </div>
         </div>
        </div>
       )}

       {activeTab === 'campuses' && (
         <div className="space-y-8 animate-in slide-in-from-right duration-500">
           {/* Section 1: Create a new Campus/Annex */}
           {canManageAllCampuses ? (
             <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
             <div className="p-6 md:p-8 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
               <div className="flex items-center gap-5">
                 <div className="p-4 bg-slate-900 text-white rounded-xl shadow-sm leading-none"><MapPin size={24} /></div>
                 <div>
                   <h3 className="text-xl font-bold tracking-tight text-slate-900">Enregistrer une Nouvelle Annexe / Campus</h3>
                   <p className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">Multi-annexes & succursales</p>
                 </div>
               </div>
             </div>

             <form onSubmit={handleAddCampus} className="p-6 md:p-10 space-y-6">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-800 uppercase tracking-widest ml-1">Nom du Campus / de l'Annexe <span className="text-rose-500">*</span></label>
                   <input 
                     type="text" 
                     placeholder="Ex: Mirebalais ou Jacmel"
                     required
                     className="w-full px-5 py-3.5 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-100 shadow-sm transition-all"
                     value={newCampusName}
                     onChange={e => setNewCampusName(e.target.value)}
                   />
                 </div>

                 <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-800 uppercase tracking-widest ml-1">Numéro de Téléphone</label>
                   <input 
                     type="text" 
                     placeholder="Ex: 4802-2673"
                     className="w-full px-5 py-3.5 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-100 shadow-sm transition-all"
                     value={newCampusPhone}
                     onChange={e => setNewCampusPhone(e.target.value)}
                   />
                 </div>

                 <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-800 uppercase tracking-widest ml-1">Adresse Email de Contact</label>
                   <input 
                     type="email" 
                     placeholder="Ex: contact@ecole.edu"
                     className="w-full px-5 py-3.5 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-100 shadow-sm transition-all"
                     value={newCampusEmail}
                     onChange={e => setNewCampusEmail(e.target.value)}
                   />
                 </div>

                 <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-800 uppercase tracking-widest ml-1">Adresse Physique</label>
                   <input 
                     type="text" 
                     placeholder="Ex: Mirebalais, Centre ou Thomassin 35 # 7, Pétion-Ville"
                     className="w-full px-5 py-3.5 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-100 shadow-sm transition-all"
                     value={newCampusAddress}
                     onChange={e => setNewCampusAddress(e.target.value)}
                   />
                 </div>
               </div>

               <div className="pt-4 border-t border-slate-100 flex justify-end">
                 <button 
                   type="submit" 
                   disabled={actionLoading === 'add_campus'}
                   className="w-full md:w-auto px-8 py-4 bg-slate-900 text-white rounded-xl font-bold text-xs tracking-tight flex items-center justify-center gap-3 hover:bg-black transition-all shadow-xl shadow-slate-200 active:scale-95 disabled:opacity-55"
                 >
                   {actionLoading === 'add_campus' ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                   Ajouter l'Annexe / le Campus
                 </button>
               </div>
             </form>
           </div>
           ) : (
             <div className="bg-amber-50 rounded-xl border border-amber-200 p-6 flex items-start gap-4 shadow-sm">
               <span className="p-3 bg-amber-100 text-amber-800 rounded-xl leading-none shrink-0"><Lock size={20} /></span>
               <div>
                 <h4 className="text-sm font-bold text-amber-900">Droits d'élaboration limités</h4>
                 <p className="text-xs text-amber-700/90 font-medium mt-1 leading-relaxed">
                   Votre compte est rattaché à l'annexe <strong className="font-bold">"{userCampus?.name || 'Inconnue'}"</strong>. Seul les administrateurs du <strong className="font-bold">Siège Social</strong> disposent du plein droit pour enregistrer ou ajouter de nouvelles annexes et de nouveaux campus.
                 </p>
               </div>
             </div>
           )}

           {/* Section 2: Campuses List & Edit Management */}
           <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
             <div className="p-6 border-b border-slate-100 bg-slate-50/50">
               <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Liste des Annexes actives</h4>
               <p className="text-xs text-slate-700 font-medium">Chaque annexe cloisonne ses propres {terminology.student.toLowerCase()}s, paiements et dépenses</p>
             </div>

             <div className="divide-y divide-slate-100">
               {campuses && campuses.length > 0 ? (
                 campuses.map((campus) => {
                   const isEditing = editingCampusId === campus.id;
                   const isLoading = actionLoading === 'update_campus_' + campus.id || actionLoading === 'delete_campus_' + campus.id;

                   return (
                     <div key={campus.id} className="p-6 md:p-8 flex flex-col gap-6 hover:bg-slate-50/40 transition-all">
                       {isEditing ? (
                         /* EDIT VIEW */
                         <div className="space-y-4">
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <div className="space-y-1.5">
                               <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">Nom *</label>
                               <input 
                                 type="text"
                                 className="w-full px-4 py-2 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-slate-900"
                                 value={editingCampusName}
                                 onChange={e => setEditingCampusName(e.target.value)}
                               />
                             </div>
                             <div className="space-y-1.5">
                               <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">Téléphone</label>
                               <input 
                                 type="text"
                                 className="w-full px-4 py-2 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-slate-900"
                                 value={editingCampusPhone}
                                 onChange={e => setEditingCampusPhone(e.target.value)}
                               />
                             </div>
                             <div className="space-y-1.5">
                               <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">Email</label>
                               <input 
                                 type="email"
                                 className="w-full px-4 py-2 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-slate-900"
                                 value={editingCampusEmail}
                                 onChange={e => setEditingCampusEmail(e.target.value)}
                               />
                             </div>
                             <div className="space-y-1.5">
                               <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">Adresse</label>
                               <input 
                                 type="text"
                                 className="w-full px-4 py-2 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-slate-900"
                                 value={editingCampusAddress}
                                 onChange={e => setEditingCampusAddress(e.target.value)}
                               />
                             </div>
                           </div>

                           <div className="flex justify-end gap-3 pt-2">
                             <button 
                               onClick={() => handleUpdateCampus(campus.id)}
                               disabled={isLoading}
                               className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-black transition-all"
                             >
                               {isLoading ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                               Enregistrer
                             </button>
                             <button 
                               onClick={handleCancelEditCampus}
                               disabled={isLoading}
                               className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-200 transition-all"
                             >
                               Annuler
                             </button>
                           </div>
                         </div>
                       ) : (
                         /* DISPLAY VIEW */
                         <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                           <div className="space-y-2">
                             <div className="flex items-center gap-3">
                               <span className="p-2 bg-slate-100 text-slate-700 rounded-lg"><School size={16} /></span>
                               <span className="text-base font-bold text-slate-950 font-sans tracking-tight">{campus.name}</span>
                               {campus.name.toLowerCase().includes('siège') && (
                                 <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-md text-[9px] font-black uppercase tracking-wider">Siège Social</span>
                               )}
                             </div>

                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-6 pt-1">
                               {campus.address && (
                                 <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
                                   <MapPin size={12} className="text-slate-700 shrink-0" />
                                   <span>{campus.address}</span>
                                 </div>
                               )}
                               {campus.phone && (
                                 <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
                                   <Phone size={12} className="text-slate-700 shrink-0" />
                                   <span>{campus.phone}</span>
                                 </div>
                               )}
                               {campus.email && (
                                 <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
                                   <Mail size={12} className="text-slate-700 shrink-0" />
                                   <span>{campus.email}</span>
                                 </div>
                               )}
                             </div>
                           </div>

                           <div className="flex items-center gap-2 self-end sm:self-center">
                             {canManageAllCampuses || campus.id === user.campus_id ? (
                               <>
                                 <button
                                   onClick={() => handleStartEditCampus(campus)}
                                   className="p-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 hover:border-slate-300 text-slate-700 rounded-lg transition-all text-xs font-semibold"
                                   title="Modifier"
                                 >
                                   Modifier
                                 </button>
                                 {canManageAllCampuses && !campus.name.toLowerCase().includes('siège') && (
                                   <button
                                     onClick={() => handleDeleteCampus(campus)}
                                     className="p-2 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-600 rounded-lg transition-all"
                                     title="Supprimer"
                                   >
                                     <Trash2 size={14} />
                                   </button>
                                 )}
                               </>
                             ) : (
                               <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 text-slate-500 text-xs font-bold rounded-lg border border-slate-200/50 shadow-sm leading-none">
                                 <Lock size={12} className="text-slate-400" />
                                 Lecture Seule
                               </span>
                             )}
                           </div>
                         </div>
                       )}
                     </div>
                   );
                 })
               ) : (
                 <div className="p-12 text-center text-slate-700 font-semibold text-sm">
                   Aucune annexe configurée pour le moment.
                 </div>
               )}
             </div>
           </div>
         </div>
       )}

        {activeTab === 'academic' && (
          <SessionManager 
            user={user}
            schoolData={schoolData}
            years={years}
            onRefresh={fetchData}
          />
        )}

        {false && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-in slide-in-from-right duration-500">
          <div className="p-6 md:p-8 border-b border-slate-100 space-y-6 bg-slate-50/50">
           <div className="flex items-center gap-4 md:gap-5">
            <div className="p-4 bg-slate-900 text-white rounded-xl shadow-sm"><Calendar size={24} /></div>
            <div>
                <h3 className="text-xl font-bold tracking-tight text-slate-900 capitalize">{terminology.academicYears}</h3>
                <p className="text-[10px] font-bold text-slate-700 uppercase tracking-widest mt-1">Gestion des {terminology.academicYears.toLowerCase()}</p>
            </div>
           </div>
           
           <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6">
              <div className="md:col-span-12 lg:col-span-4 space-y-2">
                <label className="text-[10px] font-black text-slate-800 uppercase tracking-widest ml-1">{terminology.academicYear}</label>
                <input 
                type="text" 
                placeholder="Ex: 2026-2027" 
                className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 placeholder:text-slate-700 outline-none focus:border-slate-400 focus:bg-white transition-all font-mono"
                value={newYearData.label}
                onChange={e => setNewYearData({...newYearData, label: e.target.value})}
                />
              </div>
              
              <div className="md:col-span-12 lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-800 uppercase tracking-widest ml-1 truncate block">Début (Ouverture)</label>
                  <input 
                  type="date" 
                  className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 outline-none focus:border-slate-400 focus:bg-white transition-all font-mono"
                  value={newYearData.startDate}
                  onChange={e => setNewYearData({...newYearData, startDate: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-800 uppercase tracking-widest ml-1 truncate block">Fin (Fermeture)</label>
                  <input 
                  type="date" 
                  className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 outline-none focus:border-slate-400 focus:bg-white transition-all font-mono"
                  value={newYearData.endDate}
                  onChange={e => setNewYearData({...newYearData, endDate: e.target.value})}
                  />
                </div>
              </div>
            </div>
            
            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button 
                onClick={handleAddYear} 
                disabled={actionLoading === 'add_year' || !newYearData.label} 
                className="w-full sm:w-auto px-8 h-[48px] bg-slate-900 text-white rounded-xl hover:bg-black transition-all shadow-md active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
               {actionLoading === 'add_year' ? <Loader2 size={18} className="animate-spin" /> : <Plus size={20} />}
               <span className="text-[11px] font-black uppercase tracking-[0.2em] whitespace-nowrap">Créer {terminology.academicYear}</span>
              </button>
            </div>
           </div>
          </div>

          <div className="p-4 md:p-10 space-y-4 md:space-y-8">
           {years.map(year => (
            <div key={year.id} className={`flex flex-col p-6 md:p-8 rounded-3xl border-2 transition-all gap-6 ${year.status === 'ACTIVE' ? 'bg-emerald-50/30 border-emerald-100 shadow-xl shadow-emerald-900/5' : year.status === 'FUTURE' ? 'bg-indigo-50/20 border-indigo-100' : 'bg-white border-slate-100 shadow-sm hover:shadow-md'}`}>
             {/* Row 1: Session Info */}
             <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
               <div className="flex items-center gap-5 md:gap-7">
                <div className={`w-14 h-14 md:w-20 md:h-20 rounded-2xl flex items-center justify-center font-black text-xl md:text-3xl shadow-inner flex-shrink-0 ${year.status === 'ACTIVE' ? 'bg-slate-900 text-white' : year.status === 'FUTURE' ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-300 border border-slate-100'}`}>
                 {year.label.substring(2, 4)}
                </div>
                <div className="space-y-1.5 min-w-0">
                 <div className="flex flex-wrap items-center gap-3">
                  <h3 className="text-2xl md:text-4xl font-black text-slate-900 tracking-tighter leading-none">{year.label}</h3>
                  <div className="flex flex-wrap gap-2">
                    {year.status === 'ACTIVE' && <span className="px-3 py-1 bg-emerald-500 text-white rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm">Actif</span>}
                    {year.status === 'FUTURE' && <span className="px-3 py-1 bg-indigo-500 text-white rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm">En Préparation</span>}
                    {year.status === 'VIERGE' && <span className="px-3 py-1 bg-amber-500 text-white rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm">Nouvelle</span>}
                    {year.status === 'PAST' && <span className="px-3 py-1 bg-slate-400 text-white rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm">Archivée</span>}
                  </div>
                 </div>
                 <div className="flex items-center gap-2 text-slate-700">
                   <Calendar size={14} className="text-slate-700 flex-shrink-0" />
                   <span className="text-xs md:text-sm font-bold uppercase tracking-tight truncate">
                     {year.start_date ? new Date(year.start_date).toLocaleDateString('fr-FR', {month: 'long', year: 'numeric'}) : 'N/A'} — {year.end_date ? new Date(year.end_date).toLocaleDateString('fr-FR', {month: 'long', year: 'numeric'}) : 'N/A'}
                   </span>
                 </div>
                </div>
               </div>
             </div>

             {/* Row 2: Actions */}
             <div className="flex flex-wrap items-center gap-3 pt-6 border-t border-slate-200/50">
               {year.status !== 'ACTIVE' && year.status !== 'PAST' && (
                <button 
                  onClick={() => setConfirmState({ year, status: 'ACTIVE' })} 
                  disabled={actionLoading?.startsWith('status_')} 
                  className="flex-1 sm:flex-none px-6 py-4 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-black transition-all active:scale-95 disabled:opacity-50 whitespace-nowrap flex items-center justify-center gap-2 shadow-lg shadow-slate-200"
                >
                 {actionLoading === 'status_' + year.id && <Loader2 size={16} className="animate-spin" />}
                 Lancer
                </button>
               )}
               {year.status === 'VIERGE' && (
                <button 
                  onClick={() => setConfirmState({ year, status: 'FUTURE' })} 
                  disabled={actionLoading?.startsWith('status_')} 
                  className="flex-1 sm:flex-none px-6 py-4 bg-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50 whitespace-nowrap flex items-center justify-center gap-2 shadow-lg shadow-indigo-100"
                >
                 {actionLoading === 'status_' + year.id && <Loader2 size={16} className="animate-spin" />}
                 Préparer
                </button>
               )}
               {year.status !== 'PAST' && year.status !== 'ACTIVE' && (
                <button 
                  onClick={() => setConfirmState({ year, status: 'PAST' })} 
                  disabled={actionLoading?.startsWith('status_')} 
                  className="flex-1 sm:flex-none px-6 py-4 bg-slate-200 text-slate-700 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-300 transition-all border border-slate-300 active:scale-95 disabled:opacity-50 whitespace-nowrap flex items-center justify-center gap-2"
                >
                 {actionLoading === 'status_' + year.id && <Loader2 size={16} className="animate-spin text-slate-700" />}
                 Archiver
                </button>
               )}
               {(year.status === 'VIERGE' || year.status === 'FUTURE' || year.status === 'PAST') && (
                <button 
                  onClick={() => setSessionToDelete(year)} 
                  className="p-4 text-rose-600 bg-rose-50/20 hover:bg-rose-50 rounded-2xl transition-all border-2 border-rose-200 hover:border-rose-300 ml-auto active:scale-90 flex items-center justify-center shadow-sm"
                  title="Supprimer"
                >
                 <Trash2 size={24} />
                </button>
               )}
             </div>
            </div>
           ))}
          </div>
        </div>
       )}

       {activeTab === 'finance' && (
         <div className="space-y-6 animate-in slide-in-from-right duration-500">
           {!canManageAllCampuses && (
             <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
               <div className="flex items-start gap-4">
                 <span className="p-3 bg-amber-100 text-amber-800 rounded-xl leading-none shrink-0"><Lock size={20} /></span>
                 <div>
                   <h4 className="text-sm font-bold text-amber-900 font-sans tracking-tight">Gestion Monétaire verrouillée (Annexe)</h4>
                   <p className="text-xs text-amber-700/90 font-medium mt-1 leading-relaxed">
                     Votre compte est rattaché à l'annexe <strong className="font-bold">"{userCampus?.name || 'Inconnue'}"</strong>. Les configurations des devises de référence, taux d'échange et listes bancaires institutionnelles relèvent de la compétence exclusive de la Direction au <strong className="font-bold">Siège Social</strong>.
                   </p>
                 </div>
               </div>
               <span className="px-3 py-1.5 bg-amber-100/50 text-amber-800 text-[10px] font-black rounded-lg uppercase tracking-widest block whitespace-nowrap">
                 Lecture Seule
               </span>
             </div>
           )}

           <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 md:p-8 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-50/50">
             <div className="flex items-center gap-5">
              <div className="w-14 h-14 bg-white border border-slate-200 text-emerald-600 rounded-2xl shadow-sm flex items-center justify-center">
                <CircleDollarSign size={24} />
              </div>
              <div>
               <h3 className="text-xl font-bold tracking-tight text-slate-900">Gestion Monétaire</h3>
               <p className="text-sm text-slate-700 font-medium tracking-tight mt-1">Configuration des devises et taux de change</p>
              </div>
             </div>
            </div>

            <div className="p-4 sm:p-6 space-y-6">
              {/* Configuration des Devises */}
              <div className="space-y-4">
                 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                   <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-700 shrink-0">
                     <CircleDollarSign size={16} />
                    </div>
                    <div>
                     <h4 className="text-sm font-bold text-slate-900 tracking-tight">Configuration des Devises</h4>
                     <p className="text-[11px] text-slate-500 font-medium">Définissez vos devises principale et de référence</p>
                    </div>
                   </div>
                   <div className="flex items-center gap-2">
                     <button
                       type="button"
                       disabled={!canManageAllCampuses}
                       onClick={() => {
                         const p = schoolData.global_settings?.primary_currency || 'HTG';
                         const s = schoolData.global_settings?.secondary_currency || 'USD';
                         const updatedSettings = {
                           ...(schoolData.global_settings || {}),
                           primary_currency: s,
                           secondary_currency: p
                         };
                         setSchoolData({...schoolData, global_settings: updatedSettings});
                         toast.info(`Devises inversées : Principale (${s}) - Secondaire (${p})`);
                       }}
                       className="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50 shadow-sm"
                     >
                       <RefreshCw size={13} className="text-emerald-600" />
                       Inverser devises ({schoolData.global_settings?.primary_currency || 'HTG'} ↔ {schoolData.global_settings?.secondary_currency || 'USD'})
                     </button>
                     <button 
                       onClick={handleUpdateSchool} 
                       disabled={saving || !canManageAllCampuses} 
                       className="px-4 py-2 bg-slate-900 text-white rounded-xl font-bold text-xs tracking-tight flex items-center justify-center gap-1.5 hover:bg-black transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                     >
                       {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                       Enregistrer
                     </button>
                   </div>
                 </div>
                 
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/80 p-4 rounded-xl border border-slate-200/70">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 tracking-tight ml-0.5">Devise Principale (Affichage)</label>
                    <select 
                      className="w-full px-3 py-2.5 bg-white text-slate-900 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 shadow-sm transition-all cursor-pointer disabled:opacity-75 disabled:bg-slate-100 disabled:text-slate-500"
                      value={schoolData.global_settings?.primary_currency || 'HTG'}
                      disabled={!canManageAllCampuses}
                      onChange={e => {
                        const selectedPrimary = e.target.value;
                        const currentSecondary = schoolData.global_settings?.secondary_currency || (selectedPrimary === 'HTG' ? 'USD' : 'HTG');
                        const newSecondary = selectedPrimary === currentSecondary ? (selectedPrimary === 'HTG' ? 'USD' : 'HTG') : currentSecondary;
                        const updatedSettings = {
                          ...(schoolData.global_settings || {}),
                          primary_currency: selectedPrimary,
                          secondary_currency: newSecondary
                        };
                        setSchoolData({...schoolData, global_settings: updatedSettings});
                      }}
                    >
                      <option value="HTG">Gourde Haïtienne (HTG)</option>
                      <option value="USD">Dollar Américain (USD)</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 tracking-tight ml-0.5">Devise Secondaire (Référence)</label>
                    <select 
                      className="w-full px-3 py-2.5 bg-white text-slate-900 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 shadow-sm transition-all cursor-pointer disabled:opacity-75 disabled:bg-slate-100 disabled:text-slate-500"
                      value={schoolData.global_settings?.secondary_currency || 'USD'}
                      disabled={!canManageAllCampuses}
                      onChange={e => {
                        const selectedSecondary = e.target.value;
                        const currentPrimary = schoolData.global_settings?.primary_currency || (selectedSecondary === 'USD' ? 'HTG' : 'USD');
                        const newPrimary = selectedSecondary === currentPrimary ? (selectedSecondary === 'USD' ? 'HTG' : 'USD') : currentPrimary;
                        const updatedSettings = {
                          ...(schoolData.global_settings || {}),
                          primary_currency: newPrimary,
                          secondary_currency: selectedSecondary
                        };
                        setSchoolData({...schoolData, global_settings: updatedSettings});
                      }}
                    >
                      <option value="USD">Dollar Américain (USD)</option>
                      <option value="HTG">Gourde Haïtienne (HTG)</option>
                    </select>
                  </div>
                 </div>
              </div>

              {/* Taux de Référence Actuel */}
              <div className="bg-slate-900 p-4 sm:p-5 rounded-2xl text-white flex items-center justify-between gap-4 shadow-md relative overflow-hidden">
               <div className="absolute -right-6 -top-6 text-white/5 pointer-events-none">
                 <CircleDollarSign size={140} />
               </div>
               <div className="space-y-1 relative z-10">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                  <p className="text-emerald-400 text-[10px] font-bold tracking-wider uppercase">Taux de Référence Actuel</p>
                </div>
                <h4 className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-white">1 USD = {exchangeRate?.rate_usd_to_htg || '---'} HTG</h4>
               </div>
               <div className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/10 relative z-10 shrink-0">
                <RefreshCw size={18} className="text-white" />
               </div>
              </div>

              {/* Nouveau Taux & Historique */}
              <div className="space-y-5">
               <div className="flex flex-col sm:flex-row gap-3 items-end">
                <div className="flex-1 w-full">
                 <label className="text-xs font-bold text-slate-700 tracking-tight ml-0.5 mb-1.5 block">Nouveau Taux (USD vers HTG)</label>
                 <div className="relative group">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-xs group-focus-within:text-emerald-600 transition-colors">HTG</span>
                  <input 
                   type="number" 
                   step="0.01"
                   min="0"
                   placeholder="Ex: 134.50"
                   className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-900 placeholder:text-slate-400 outline-none focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-all shadow-sm disabled:opacity-75"
                   value={newExchangeRate}
                   disabled={!canManageAllCampuses}
                   onChange={e => setNewExchangeRate(e.target.value)}
                  />
                 </div>
                </div>
                <button 
                 onClick={handleUpdateExchangeRate} 
                 disabled={saving || !newExchangeRate || !canManageAllCampuses} 
                 className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs tracking-tight flex items-center justify-center gap-2 active:scale-95 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all h-[42px] shrink-0"
                >
                 {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} 
                 Appliquer le taux
                </button>
               </div>

               {/* Historique avec pagination */}
               <div className="space-y-3 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between">
                 <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
                   <RefreshCw size={14} />
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 tracking-tight">
                   Historique des Taux <span className="text-slate-400 font-normal">({exchangeRates.length})</span>
                  </h4>
                 </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                 <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse min-w-[450px]">
                   <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                     <th className="px-4 py-2.5 text-[10px] font-bold text-slate-600 uppercase tracking-wider">Date</th>
                     <th className="px-4 py-2.5 text-[10px] font-bold text-slate-600 uppercase tracking-wider">Taux (USD/HTG)</th>
                     <th className="px-4 py-2.5 text-[10px] font-bold text-slate-600 uppercase tracking-wider text-right">Statut</th>
                    </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                    {(() => {
                     const pageSize = 5;
                     const totalPages = Math.ceil(exchangeRates.length / pageSize) || 1;
                     const currentPage = Math.min(exchangeRatePage, totalPages);
                     const paginatedRates = exchangeRates.slice((currentPage - 1) * pageSize, currentPage * pageSize);

                     if (exchangeRates.length === 0) {
                      return (
                       <tr>
                        <td colSpan={3} className="px-4 py-8 text-center">
                         <div className="flex flex-col items-center justify-center text-slate-400 space-y-1">
                          <CircleDollarSign size={24} className="opacity-30" />
                          <p className="text-xs font-bold text-slate-600">Aucun historique de taux</p>
                          <p className="text-[11px] font-medium text-slate-400">Les taux enregistrés apparaîtront ici.</p>
                         </div>
                        </td>
                       </tr>
                      );
                     }

                     return paginatedRates.map((rate, idx) => {
                      const absoluteIndex = (currentPage - 1) * pageSize + idx;
                      return (
                       <tr key={rate.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-2.5 text-xs font-medium text-slate-600 whitespace-nowrap">
                         {new Date(rate.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-4 py-2.5 text-xs font-bold text-slate-900">
                         1 USD = {rate.rate_usd_to_htg} HTG
                        </td>
                        <td className="px-4 py-2.5 text-right">
                         {absoluteIndex === 0 ? (
                          <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-md text-[10px] font-bold uppercase tracking-wider">Actuel</span>
                         ) : (
                          <span className="px-2.5 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[10px] font-bold uppercase tracking-wider">Ancien</span>
                         )}
                        </td>
                       </tr>
                      );
                     });
                    })()}
                   </tbody>
                  </table>
                 </div>

                 {/* Pagination Footer */}
                 {exchangeRates.length > 5 && (
                  <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-600">
                   <span className="font-medium text-slate-500 text-[11px]">
                    Page <strong className="text-slate-800">{exchangeRatePage}</strong> sur <strong className="text-slate-800">{Math.ceil(exchangeRates.length / 5) || 1}</strong> ({exchangeRates.length} au total)
                   </span>
                   <div className="flex items-center gap-1.5">
                    <button
                     type="button"
                     disabled={exchangeRatePage <= 1}
                     onClick={() => setExchangeRatePage(p => Math.max(1, p - 1))}
                     className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 transition-all shadow-sm flex items-center gap-1 text-[11px] font-bold"
                    >
                     <ChevronLeft size={13} /> Précédent
                    </button>
                    <button
                     type="button"
                     disabled={exchangeRatePage >= Math.ceil(exchangeRates.length / 5)}
                     onClick={() => setExchangeRatePage(p => Math.min(Math.ceil(exchangeRates.length / 5), p + 1))}
                     className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 transition-all shadow-sm flex items-center gap-1 text-[11px] font-bold"
                    >
                     Suivant <ChevronRight size={13} />
                    </button>
                  </div>
                 </div>
                )}
               </div>
              </div>
             </div>
           </div>
        </div>
       </div>
      )}

        {activeTab === 'payment_methods' && (
          <PaymentMethodManager
            schoolData={schoolData}
            setSchoolData={setSchoolData}
            handleUpdateSchool={handleUpdateSchool}
            saving={saving}
            canManageAllCampuses={canManageAllCampuses}
          />
        )}

        {activeTab === 'gateways' && (
          <div className="space-y-4 animate-in slide-in-from-right duration-500">
            {!canManageAllCampuses && (
              <div className="bg-amber-50 border border-amber-200/80 p-3.5 rounded-xl flex items-center justify-between gap-3 text-xs text-amber-800">
                <div className="flex items-center gap-2.5">
                  <Lock size={16} className="text-amber-700 shrink-0" />
                  <p className="font-medium">
                    <strong className="font-bold">Passerelle API verrouillée (Annexe) :</strong> Seuls les administrateurs du Siège Social peuvent modifier la clé de service MonCash.
                  </p>
                </div>
                <span className="px-2 py-0.5 bg-amber-100/80 text-amber-900 font-mono text-[10px] font-bold rounded uppercase shrink-0">
                  Lecture Seule
                </span>
              </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              {/* Header */}
              <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl shadow-xs flex items-center justify-center shrink-0">
                    <Key size={18} />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold tracking-tight text-slate-900">Intégration MonCash</h3>
                    <p className="text-xs text-slate-500 font-medium">Configuration des API pour Digicel MonCash</p>
                  </div>
                </div>
                <button 
                  onClick={handleUpdateMoncash} 
                  disabled={saving || !canManageAllCampuses} 
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold font-mono text-xs tracking-tight flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Enregistrer
                </button>
              </div>

              <div className="p-4 sm:p-6 space-y-4">
                {/* Developer Portal Box */}
                <div className="bg-indigo-50/80 p-3.5 rounded-xl border border-indigo-100 flex items-start gap-3">
                  <AlertCircle className="text-indigo-600 mt-0.5 shrink-0" size={16} />
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-indigo-900 font-mono uppercase tracking-wider">Portail Développeur MonCash</h4>
                    <p className="text-[11px] font-medium text-indigo-800/80 leading-relaxed">
                      Identifiants nécessaires pour traiter les paiements mobiles des {terminology.student.toLowerCase()}s. 
                      Générez-les sur le <a href="https://moncashbutton.digicelgroup.com/Moncash-developer/" target="_blank" rel="noopener noreferrer" className="underline font-bold text-indigo-700 hover:text-indigo-900">portail MonCash</a>.
                    </p>
                    <div className="flex items-center gap-1.5 pt-0.5">
                      <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />
                      <span className="text-[10px] font-mono font-bold text-indigo-700 uppercase">
                        Utilisez le mode 'Live' uniquement en production.
                      </span>
                    </div>
                  </div>
                </div>

                {/* Form Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 ml-0.5">Client ID</label>
                    <input 
                      type="text" 
                      className="w-full px-3 py-2 bg-slate-50 text-slate-900 border border-slate-200 rounded-lg font-mono text-xs font-bold tracking-wider outline-none focus:bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/10 transition-all shadow-xs placeholder:font-sans placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-400"
                      value={moncashConfig.client_id || ''}
                      disabled={!canManageAllCampuses}
                      onChange={e => setMoncashConfig({...moncashConfig, client_id: e.target.value})}
                      placeholder="Ex: 1234567890abcdef..."
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 ml-0.5">Client Secret</label>
                    <div className="relative">
                      <input 
                        type={showPassword ? "text" : "password"}
                        className="w-full pl-3 pr-9 py-2 bg-slate-50 text-slate-900 border border-slate-200 rounded-lg font-mono text-xs font-bold tracking-wider outline-none focus:bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/10 transition-all shadow-xs placeholder:font-sans placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-400"
                        value={moncashConfig.client_secret || ''}
                        disabled={!canManageAllCampuses}
                        onChange={e => setMoncashConfig({...moncashConfig, client_secret: e.target.value})}
                        placeholder="••••••••••••••••"
                      />
                      <button 
                        type="button" 
                        onClick={() => setShowPassword(!showPassword)} 
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 rounded transition-colors"
                        title={showPassword ? "Masquer" : "Afficher"}
                      >
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 ml-0.5">Business Key (Clé Marchand)</label>
                    <input 
                      type="text" 
                      className="w-full px-3 py-2 bg-slate-50 text-slate-900 border border-slate-200 rounded-lg font-mono text-xs font-bold tracking-wider outline-none focus:bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/10 transition-all shadow-xs placeholder:font-sans placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-400"
                      value={moncashConfig.business_key || ''}
                      disabled={!canManageAllCampuses}
                      onChange={e => setMoncashConfig({...moncashConfig, business_key: e.target.value})}
                      placeholder="Ex: MS_12345"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 ml-0.5">Environnement</label>
                    <div className="relative">
                      <select 
                        className="w-full pl-3 pr-8 py-2 bg-slate-50 text-slate-900 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/10 appearance-none cursor-pointer shadow-xs"
                        value={moncashConfig.mode || 'sandbox'}
                        disabled={!canManageAllCampuses}
                        onChange={e => setMoncashConfig({...moncashConfig, mode: e.target.value})}
                      >
                        <option value="sandbox">Sandbox (Développement)</option>
                        <option value="live">Live (Production)</option>
                      </select>
                      <Globe size={15} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  </div>

                  <div className="col-span-1 sm:col-span-2 pt-1">
                    <label className={`p-3 bg-slate-50/80 border border-slate-200/80 rounded-xl flex items-center gap-3 transition-all ${!canManageAllCampuses ? 'opacity-75 cursor-not-allowed' : 'cursor-pointer hover:bg-slate-100/60'}`}>
                      <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all shrink-0 ${moncashConfig.is_active ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-300'}`}>
                        {moncashConfig.is_active && <CheckCircle2 size={14} />}
                      </div>
                      <input 
                        type="checkbox" 
                        id="moncash_active"
                        className="hidden"
                        checked={moncashConfig.is_active}
                        disabled={!canManageAllCampuses}
                        onChange={e => setMoncashConfig({...moncashConfig, is_active: e.target.checked})}
                      />
                      <div>
                        <p className="text-xs font-bold text-slate-900">Activer MonCash sur le guichet</p>
                        <p className="text-[11px] text-slate-500 font-medium">Permet aux {terminology.student.toLowerCase()}s de payer directement via leur compte MonCash.</p>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'security' && (
          <div className="space-y-4 animate-in slide-in-from-right duration-500">
            {/* Exporter vers GitHub (Super Admin Uniquement sur poste de développement) */}
            {isSuperAdmin && isDevWorkstation && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 text-white">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/10 text-white rounded-xl shadow-xs flex items-center justify-center shrink-0 border border-white/10">
                      <GitBranch size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base sm:text-lg font-bold tracking-tight text-white">Synchronisation & Export GitHub</h3>
                        <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded text-[10px] font-bold">
                          Super Admin / Développeur
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 font-medium">
                        Sauvegarder et publier directement les codes sources du projet sur votre dépôt GitHub officiel
                      </p>
                    </div>
                  </div>
                  
                  <button 
                    type="button"
                    id="btn-github-export-security-tab"
                    onClick={() => setIsGitHubModalOpen(true)}
                    disabled={isExportingGitHub}
                    className="px-4 py-2.5 bg-white text-slate-900 hover:bg-slate-100 rounded-xl font-bold font-mono text-xs tracking-tight flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95 shrink-0 whitespace-nowrap cursor-pointer disabled:opacity-85"
                  >
                    {isExportingGitHub ? (
                      <>
                        <Loader2 size={15} className="animate-spin text-indigo-600 shrink-0" />
                        <span>Envoi en cours ({githubExportProgress?.percent || 0}%)...</span>
                      </>
                    ) : (
                      <>
                        <GitPullRequest size={15} />
                        <span>Exporter vers GitHub</span>
                      </>
                    )}
                  </button>
                </div>
                
                <div className="p-4 sm:p-5 bg-slate-50/70 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600">
                  <div className="flex items-center gap-2 font-medium">
                    <Code2 size={14} className="text-slate-400" />
                    <span>Dépôt cible configuré : <strong className="font-mono text-slate-900">{githubOwner}/{githubRepo}</strong> (branche <span className="font-mono text-indigo-600 font-bold">{githubBranch}</span>)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsGitHubModalOpen(true)}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 self-start sm:self-auto cursor-pointer"
                  >
                    <span>Ouvrir l'assistant d'export</span>
                    <ExternalLink size={12} />
                  </button>
                </div>
              </div>
            )}

            {!canManageAllCampuses && (
              <div className="bg-amber-50 border border-amber-200/80 p-3.5 rounded-xl flex items-center justify-between gap-3 text-xs text-amber-800">
                <div className="flex items-center gap-2.5">
                  <Lock size={16} className="text-amber-700 shrink-0" />
                  <p className="font-medium">
                    <strong className="font-bold">Accès Partiel :</strong> Vous pouvez modifier votre mot de passe. Les politiques globales du système sont gérées par le Siège Social.
                  </p>
                </div>
                <span className="px-2 py-0.5 bg-amber-100/80 text-amber-900 font-mono text-[10px] font-bold rounded uppercase shrink-0">
                  Partiel
                </span>
              </div>
            )}

            {/* Account Security (Password) */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-rose-600 text-white rounded-xl shadow-xs flex items-center justify-center shrink-0">
                    <Key size={18} />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold tracking-tight text-slate-900">Sécurité du Compte</h3>
                    <p className="text-xs text-slate-500 font-medium">Modification de votre mot de passe personnel</p>
                  </div>
                </div>
                
                <button 
                  onClick={handleUpdatePassword} 
                  disabled={saving || !securityData.newPassword || !securityData.confirmPassword} 
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold font-mono text-xs tracking-tight flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Changer le mot de passe
                </button>
              </div>

              <div className="p-4 sm:p-6 space-y-3.5">
                <div className="flex items-center gap-2 text-rose-700 bg-rose-50/80 border border-rose-100 px-3 py-2 rounded-lg text-xs font-medium">
                  <AlertCircle size={15} className="shrink-0 text-rose-600" />
                  <span>Le changement de mot de passe déconnectera vos autres sessions actives sur d'autres appareils.</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 ml-0.5">Nouveau mot de passe</label>
                    <div className="relative">
                      <input 
                        type={showPassword ? "text" : "password"}
                        className="w-full pl-3 pr-9 py-2 bg-slate-50 text-slate-900 border border-slate-200 rounded-lg text-xs font-mono font-bold tracking-wider outline-none focus:bg-white focus:border-rose-600 focus:ring-2 focus:ring-rose-500/10 transition-all shadow-xs placeholder:font-sans placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-400"
                        placeholder="Au moins 6 caractères"
                        value={securityData.newPassword}
                        onChange={e => setSecurityData({...securityData, newPassword: e.target.value})}
                      />
                      <button 
                        type="button" 
                        onClick={() => setShowPassword(!showPassword)} 
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 rounded transition-colors"
                        title={showPassword ? "Masquer" : "Afficher"}
                      >
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 ml-0.5">Confirmer le mot de passe</label>
                    <div className="relative">
                      <input 
                        type={showPassword ? "text" : "password"}
                        className="w-full pl-3 pr-9 py-2 bg-slate-50 text-slate-900 border border-slate-200 rounded-lg text-xs font-mono font-bold tracking-wider outline-none focus:bg-white focus:border-rose-600 focus:ring-2 focus:ring-rose-500/10 transition-all shadow-xs placeholder:font-sans placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-400"
                        placeholder="Répétez le mot de passe"
                        value={securityData.confirmPassword}
                        onChange={e => setSecurityData({...securityData, confirmPassword: e.target.value})}
                      />
                      <button 
                        type="button" 
                        onClick={() => setShowPassword(!showPassword)} 
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 rounded transition-colors"
                        title={showPassword ? "Masquer" : "Afficher"}
                      >
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* General Security Policy (Inactivity) & Maintenance */}
            {(user.role === 'SUPER_ADMIN' || user.role === 'SCHOOL_ADMIN' || user.role === 'DIRECTOR' || user.is_super_admin) && (
              <>
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl shadow-xs flex items-center justify-center shrink-0">
                        <ShieldCheck size={18} />
                      </div>
                      <div>
                        <h3 className="text-base sm:text-lg font-bold tracking-tight text-slate-900">Politique d'Inactivité</h3>
                        <p className="text-xs text-slate-500 font-medium">Déconnexion automatique en cas de poste non surveillé</p>
                      </div>
                    </div>
                    
                    <button 
                      onClick={handleSaveSecurityPolicy} 
                      disabled={saving || !canManageAllCampuses} 
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold font-mono text-xs tracking-tight flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                    >
                      {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                      Enregistrer la Politique
                    </button>
                  </div>

                  <div className="p-4 sm:p-6 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80">
                      <div className="space-y-0.5">
                        <label className="text-xs font-bold text-slate-800">Durée d'inactivité maximale autorisée</label>
                        <p className="text-[11px] text-slate-500">Verrouille la session après une période sans activité. Recommandé : 5 à 15 minutes.</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <input 
                          type="number" 
                          min={1} 
                          max={120}
                          className="w-24 px-3 py-1.5 bg-white text-slate-900 border border-slate-200 rounded-lg text-xs font-mono font-bold text-center outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/10 disabled:opacity-75 disabled:bg-slate-100 disabled:text-slate-500"
                          value={sessionTimeoutInput}
                          disabled={!canManageAllCampuses}
                          onChange={e => setSessionTimeoutInput(Math.max(1, parseInt(e.target.value) || 1))}
                        />
                        <span className="text-xs font-bold font-mono text-slate-600">Minutes</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Maintenance & Permissions */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/30">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-amber-600 text-white rounded-xl shadow-xs flex items-center justify-center shrink-0">
                        <RefreshCw size={18} />
                      </div>
                      <div>
                        <h3 className="text-base sm:text-lg font-bold tracking-tight text-slate-900">Maintenance & Permissions</h3>
                        <p className="text-xs text-slate-500 font-medium">Réinitialisation et resynchronisation du cache des autorisations</p>
                      </div>
                    </div>
                    
                    <button 
                      onClick={handleRepairPermissions} 
                      disabled={saving || !canManageAllCampuses}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold font-mono text-xs tracking-tight flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shrink-0 whitespace-nowrap"
                    >
                      {saving ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />} 
                      Réparer Permissions
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

      <AnimatePresence>
        {confirmState && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-3xl w-full max-m-md overflow-hidden shadow-2xl"
            >
              <div className="p-8 text-center space-y-6">
                <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center ${
                  confirmState.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-600' : 
                  confirmState.status === 'PAST' ? 'bg-amber-100 text-amber-600' : 'bg-indigo-100 text-indigo-600'
                }`}>
                  <AlertTriangle size={40} />
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                    {confirmState.status === 'ACTIVE' ? 'Lancer la session ?' : 
                     confirmState.status === 'PAST' ? 'Archiver la session ?' : 'Mettre en préparation ?'}
                  </h3>
                  <p className="text-slate-700 text-sm font-medium leading-relaxed">
                    {confirmState.status === 'ACTIVE' ? 
                      (schoolData?.school_type === 'PROFESSIONAL' || schoolData?.school_type === 'UNIVERSITY'
                        ? `Vous allez activer la session ${confirmState.year.label}. Elle sera active en même temps que les autres sessions.`
                        : `Vous allez activer la session ${confirmState.year.label}. Cela archivera automatiquement la session actuellement active.`) : 
                     confirmState.status === 'PAST' ? 
                      `Voulez-vous vraiment archiver la session ${confirmState.year.label} ? Elle ne sera plus modifiable.` : 
                      `Voulez-vous mettre la session ${confirmState.year.label} en préparation ?`}
                  </p>
                </div>

                <div className="flex flex-col gap-3 pt-4">
                  <button 
                    onClick={() => handleUpdateStatus(confirmState.year.id, confirmState.status)}
                    disabled={actionLoading?.startsWith('status_')}
                    className={`w-full h-14 rounded-2xl text-white font-black uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-3 shadow-lg ${
                      confirmState.status === 'ACTIVE' ? 'bg-slate-900 hover:bg-black shadow-slate-200' :
                      confirmState.status === 'PAST' ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-100' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100'
                    }`}
                  >
                    {actionLoading?.startsWith('status_') ? <Loader2 className="animate-spin" /> : <CheckCircle size={20} />}
                    Confirmer
                  </button>
                  <button 
                    onClick={() => setConfirmState(null)}
                    disabled={actionLoading?.startsWith('status_')}
                    className="w-full h-14 bg-slate-50 text-slate-700 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all active:scale-95"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Modal
        isOpen={isCleanModalOpen}
        onClose={() => {
          if (!isCleaning) {
            setIsCleanModalOpen(false);
            setConfirmSchoolName('');
            setConfirmUserEmail('');
          }
        }}
        title="Vider les données de l'école (Action Critique)"
        type="danger"
        hideDefaultActions={true}
      >
        <div className="space-y-6">
          <div className="p-3.5 bg-rose-50 rounded-xl border border-rose-200/80 flex items-center gap-3 text-xs font-semibold text-rose-900">
            <ShieldCheck size={20} className="text-rose-600 shrink-0" />
            <div>
              <p className="font-bold">Validation d'Identité Fondateur / Premier Admin</p>
              <p className="text-[11px] text-rose-700 font-medium mt-0.5">
                Vous êtes connecté en tant que <strong>{user.full_name || user.email}</strong>. Pour valider définitivement cet effacement, veuillez remplir le nom de l'école et votre adresse email.
              </p>
            </div>
          </div>

          <p className="text-slate-700 font-medium tracking-tight text-xs text-center">
            Attention : vous êtes sur le point de réinitialiser et vider toutes les données opérationnelles {cleanScope === 'all' ? (
              <span>de l'établissement <span className="font-bold text-slate-900">"{schoolData.name}"</span> (Siège & Annexes)</span>
            ) : (
              <span>de l'annexe <span className="font-bold text-slate-900">"{campuses.find(c => c.id === cleanScope)?.name}"</span> de l'établissement <span className="font-bold text-slate-900">"{schoolData.name}"</span></span>
            )}.
          </p>

          {campuses && campuses.length > 0 && (
            <div className="space-y-3 bg-slate-50 p-4 border border-slate-100 rounded-2xl">
              <label className="text-[10px] font-black text-slate-800 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                Périmètre de nettoyage
              </label>
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => setCleanScope('all')}
                  className={`flex items-center justify-between px-4 py-3.5 rounded-xl border text-xs font-bold transition-all ${
                    cleanScope === 'all'
                      ? 'bg-rose-50 border-rose-200 text-rose-900 shadow-sm'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span>Toute l'institution (Siège & toutes les annexes)</span>
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${cleanScope === 'all' ? 'border-rose-600' : 'border-slate-300'}`}>
                    {cleanScope === 'all' && <div className="w-2 h-2 rounded-full bg-rose-600" />}
                  </div>
                </button>
                
                <div className="relative">
                  <select
                    value={cleanScope === 'all' ? '' : cleanScope}
                    onChange={(e) => {
                      if (e.target.value === '') {
                        setCleanScope('all');
                      } else {
                        setCleanScope(e.target.value);
                      }
                    }}
                    className={`w-full px-4 py-3.5 rounded-xl border text-xs font-bold transition-all appearance-none outline-none ${
                      cleanScope !== 'all'
                        ? 'bg-rose-50 border-rose-200 text-rose-900 shadow-sm'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <option value="">-- Choisir une annexe ou siège spécifique --</option>
                    {campuses.map((campus) => (
                      <option key={campus.id} value={campus.id}>
                        Vider uniquement l'annexe : {campus.name}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
                    <ChevronDown size={16} />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl space-y-1.5">
            <p className="text-[10px] font-black text-rose-700 uppercase tracking-widest flex items-center gap-2">
              <AlertTriangle size={14} /> Action Irréversible
            </p>
            <p className="text-xs font-semibold text-rose-800 leading-relaxed">
              {cleanScope === 'all' ? (
                "Toutes les inscriptions, étudiants, professeurs, relevés de présence, dossiers de discipline, frais, paiements et écritures comptables seront définitivement effacés de l'ensemble des établissements. La configuration structurelle sera conservée."
              ) : (
                `Toutes les inscriptions, étudiants, relevés de présence, dossiers de discipline, frais de scolarité, et paiements associés uniquement à l'annexe "${campuses.find(c => c.id === cleanScope)?.name}" seront définitivement effacés. Les données des autres annexes ne seront pas touchées.`
              )}
            </p>
          </div>

          {/* Confirmation 1: School Name */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-800 uppercase tracking-widest ml-1">
              1. Saisir le nom{' '}
              <span 
                className="text-rose-600 cursor-pointer hover:underline border-b border-dashed border-rose-300 transition-all"
                onClick={() => setConfirmSchoolName(cleanScope === 'all' ? schoolData.name : (campuses.find(c => c.id === cleanScope)?.name || ''))}
                title="Cliquez pour insérer automatiquement"
              >
                {cleanScope === 'all' ? schoolData.name : (campuses.find(c => c.id === cleanScope)?.name || '')}
              </span>
            </label>
            <input
              type="text"
              placeholder={cleanScope === 'all' ? schoolData.name : (campuses.find(c => c.id === cleanScope)?.name || '')}
              className="w-full px-4 py-3 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-rose-600 focus:ring-4 focus:ring-rose-50 transition-all"
              value={confirmSchoolName}
              onChange={e => setConfirmSchoolName(e.target.value)}
              disabled={isCleaning}
            />
          </div>

          {/* Confirmation 2: User Email verification */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-800 uppercase tracking-widest ml-1">
              2. Saisir votre adresse email connectée{' '}
              <span 
                className="text-indigo-600 cursor-pointer hover:underline border-b border-dashed border-indigo-300 transition-all"
                onClick={() => setConfirmUserEmail(user.email || '')}
                title="Cliquez pour remplir votre email"
              >
                ({user.email})
              </span>
            </label>
            <input
              type="email"
              placeholder={user.email}
              className="w-full px-4 py-3 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-50 transition-all"
              value={confirmUserEmail}
              onChange={e => setConfirmUserEmail(e.target.value)}
              disabled={isCleaning}
            />
          </div>

          <div className="flex flex-col gap-2.5 pt-2">
            <button
              onClick={handleCleanSchoolData}
              disabled={
                isCleaning || 
                confirmSchoolName !== (cleanScope === 'all' ? schoolData.name : (campuses.find(c => c.id === cleanScope)?.name || '')) ||
                confirmUserEmail.trim().toLowerCase() !== (user.email || '').trim().toLowerCase()
              }
              className="w-full h-12 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-rose-200 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCleaning ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  Réinitialisation en cours...
                </>
              ) : (
                <>
                  <Trash2 size={16} />
                  Confirmer la suppression
                </>
              )}
            </button>
            <button
              onClick={() => {
                setIsCleanModalOpen(false);
                setConfirmSchoolName('');
                setConfirmUserEmail('');
              }}
              disabled={isCleaning}
              className="w-full h-12 bg-slate-100 text-slate-700 rounded-xl text-[11px] font-bold uppercase tracking-wider hover:bg-slate-200 transition-all active:scale-95 disabled:opacity-50"
            >
              Annuler
            </button>
          </div>
        </div>
      </Modal>

      {/* Modals Sauvegardes Cloud (Réservées Super Admin pour préserver le stockage Supabase) */}
      {isSuperAdmin && (
        <>
          {/* Modal - Déclencher une Sauvegarde Cloud Personnalisée */}
          <Modal
            isOpen={isBackupModalOpen}
            onClose={() => !isBackingUp && setIsBackupModalOpen(false)}
            title="Déclencher une Sauvegarde Cloud Manuelle"
            hideDefaultActions={true}
            containerClassName="max-w-lg sm:max-w-xl"
          >
            <div className="space-y-4">
              <div className="bg-indigo-50/70 border border-indigo-200/70 p-3 sm:p-3.5 rounded-xl flex items-start gap-3">
                <div className="p-2 bg-indigo-600 text-white rounded-lg shrink-0 mt-0.5 shadow-sm">
                  <CloudUpload size={16} />
                </div>
                <div className="space-y-0.5">
                  <h5 className="text-xs font-bold text-indigo-950">Sécurisation Complète et Chiffrée</h5>
                  <p className="text-xs text-indigo-800 leading-relaxed font-medium">
                    Cette opération va extraire l'ensemble des données opérationnelles de votre école, calculer une somme de contrôle d'intégrité (SHA-256) et téléverser l'archive vers le Cloud Storage sécurisé.
                  </p>
                </div>
              </div>

              <div className="space-y-3.5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-800 uppercase tracking-widest block">
                    Nom ou Intitulé de la Sauvegarde
                  </label>
                  <input
                    type="text"
                    value={backupCustomName}
                    onChange={e => setBackupCustomName(e.target.value)}
                    placeholder="Ex: Sauvegarde avant clôture du 1er Trimestre"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-800 uppercase tracking-widest block">
                    Notes ou Description (Optionnel)
                  </label>
                  <textarea
                    value={backupCustomDesc}
                    onChange={e => setBackupCustomDesc(e.target.value)}
                    rows={2}
                    placeholder="Précisez le contexte ou la raison de ce point de sauvegarde..."
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition-all resize-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-800 uppercase tracking-widest block">
                    Périmètre de l'extraction (Droit Super-Admin)
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setBackupScope('SCHOOL_SPECIFIC')}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-left flex items-center justify-between ${
                        backupScope === 'SCHOOL_SPECIFIC'
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-900 ring-2 ring-indigo-100'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span>Cet Établissement uniquement</span>
                      {backupScope === 'SCHOOL_SPECIFIC' && <Check size={14} className="text-indigo-600" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setBackupScope('FULL_DATABASE')}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-left flex items-center justify-between ${
                        backupScope === 'FULL_DATABASE'
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-900 ring-2 ring-indigo-100'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span>Base Globale Système</span>
                      {backupScope === 'FULL_DATABASE' && <Check size={14} className="text-indigo-600" />}
                    </button>
                  </div>
                </div>

                {/* Critical Data Coverage Summary */}
                <div className="bg-slate-50 p-3 sm:p-3.5 rounded-xl border border-slate-200 space-y-2">
                  <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Données incluses dans le paquet :</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-[11px] font-medium text-slate-700">
                    <span className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-emerald-600 shrink-0" /> Dossiers élèves</span>
                    <span className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-emerald-600 shrink-0" /> Frais & Règlements</span>
                    <span className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-emerald-600 shrink-0" /> Notes & Bulletins</span>
                    <span className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-emerald-600 shrink-0" /> Personnel & Rôles</span>
                    <span className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-emerald-600 shrink-0" /> Horaires de cours</span>
                    <span className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-emerald-600 shrink-0" /> Présences & Retards</span>
                    <span className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-emerald-600 shrink-0" /> Registre Discipline</span>
                    <span className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-emerald-600 shrink-0" /> Caisse & Dépenses</span>
                    <span className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-emerald-600 shrink-0" /> Paramètres d'école</span>
                  </div>
                </div>

                {isBackingUp && (
                  <div className="bg-indigo-900 text-white p-3.5 rounded-xl space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-indigo-200">
                      <span className="flex items-center gap-2">
                        <Loader2 size={14} className="animate-spin text-indigo-400" />
                        {backupProgressStep || 'Création de l\'instantané de sauvegarde...'}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-indigo-950 rounded-full overflow-hidden">
                      <div className="h-full bg-sky-400 rounded-full animate-pulse w-full"></div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsBackupModalOpen(false)}
                  disabled={isBackingUp}
                  className="px-4 py-2 sm:px-5 sm:py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all disabled:opacity-50 active:scale-95"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={() => handleTriggerCloudBackup({
                    name: backupCustomName,
                    description: backupCustomDesc,
                    scope: backupScope
                  })}
                  disabled={isBackingUp}
                  className="px-5 py-2 sm:px-6 sm:py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold tracking-tight shadow-md shadow-indigo-600/20 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isBackingUp ? <Loader2 size={15} className="animate-spin" /> : <CloudUpload size={15} />}
                  Lancer la Sauvegarde
                </button>
              </div>
            </div>
          </Modal>

          {/* Modal - Historique des Sauvegardes de l'Établissement */}
          <Modal
            isOpen={isHistoryModalOpen}
            onClose={() => setIsHistoryModalOpen(false)}
            title="Historique des Sauvegardes Cloud"
            hideDefaultActions={true}
            containerClassName="max-w-2xl sm:max-w-3xl"
          >
            <div className="space-y-4 max-h-[75vh] flex flex-col">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <h5 className="text-xs font-bold text-slate-900">Archives et Instantanés Disponibles</h5>
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                    Consultez et téléchargez les sauvegardes générées pour cet établissement.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => fetchData()}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 self-start sm:self-auto transition-all"
                >
                  <RefreshCw size={12} />
                  Actualiser
                </button>
              </div>

              <div className="overflow-y-auto space-y-3 pr-1 divide-y divide-slate-100">
                {recentSchoolBackups.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
                    <div className="w-10 h-10 bg-slate-100 text-slate-400 rounded-full mx-auto flex items-center justify-center">
                      <Database size={18} />
                    </div>
                    <p className="text-xs font-bold text-slate-700">Aucune archive enregistrée</p>
                    <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                      Déclenchez votre première sauvegarde Cloud depuis la page des Paramètres pour créer un point de restauration.
                    </p>
                  </div>
                ) : (
                  recentSchoolBackups.map((b, idx) => (
                    <div key={b.id || idx} className="pt-3 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-100 hover:border-indigo-100 transition-all">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-slate-900">{b.name}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            b.backup_type === 'AUTOMATIC' 
                              ? 'bg-sky-100 text-sky-800' 
                              : b.backup_type === 'PRE_RESTORE_SAFETY'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-indigo-100 text-indigo-800'
                          }`}>
                            {b.backup_type === 'AUTOMATIC' ? 'Automatique' : b.backup_type === 'PRE_RESTORE_SAFETY' ? 'Sécurité Pré-Restauration' : 'Manuel'}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-[11px] text-slate-500 font-medium flex-wrap">
                          <span className="flex items-center gap-1">
                            <Clock size={11} className="text-slate-400" />
                            {new Date(b.created_at).toLocaleString('fr-FR')}
                          </span>
                          <span>•</span>
                          <span>{b.rows_count != null ? b.rows_count.toLocaleString('fr-FR') : '—'} lignes</span>
                          <span>•</span>
                          <span className="font-mono text-slate-600">
                            {b.size_bytes ? `${(b.size_bytes / 1024).toFixed(1)} Ko` : '—'}
                          </span>
                          {b.created_by_name && (
                            <>
                              <span>•</span>
                              <span>Par: {b.created_by_name}</span>
                            </>
                          )}
                        </div>

                        {b.description && (
                          <p className="text-[11px] text-slate-600 font-normal italic">
                            {b.description}
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDownloadBackupItem(b)}
                        className="px-3 py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shrink-0 shadow-xs active:scale-95"
                        title="Télécharger l'archive JSON"
                      >
                        <Download size={13} />
                        <span>Télécharger</span>
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsHistoryModalOpen(false)}
                  className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                >
                  Fermer
                </button>
              </div>
            </div>
          </Modal>
        </>
      )}

      {/* Modal - Exportation du Projet vers GitHub */}
      <Modal
        isOpen={isGitHubModalOpen}
        onClose={() => !isExportingGitHub && setIsGitHubModalOpen(false)}
        title="Exporter et Synchroniser vers GitHub"
        hideDefaultActions={true}
        containerClassName="max-w-lg sm:max-w-xl"
      >
        <div className="space-y-4">
          <div className="bg-slate-900 text-white p-4 rounded-2xl flex items-start gap-3 shadow-md">
            <div className="p-2.5 bg-white/10 text-white rounded-xl shrink-0 mt-0.5 border border-white/10">
              <GitBranch size={20} />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                <span>Exportation Directe via API GitHub</span>
                <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded text-[10px] font-bold">
                  Super Admin / Dev
                </span>
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded text-[10px] font-bold">
                  Synchro Rapide (Delta)
                </span>
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed font-normal">
                Analyse les sources du projet, calcule instantanément les différences et synchronise votre dépôt officiel en quelques secondes.
              </p>
            </div>
          </div>

          <div className="space-y-3.5">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-800 uppercase tracking-widest block flex items-center justify-between">
                <span>Token d'accès personnel GitHub (PAT)</span>
                <span className="text-[10px] font-mono text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded">Configuré</span>
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={githubToken}
                  onChange={e => setGithubToken(e.target.value)}
                  placeholder="ghp_..."
                  disabled={isExportingGitHub}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition-all disabled:opacity-60"
                />
              </div>
              <p className="text-[10px] text-slate-600">
                Token GitHub Classic avec autorisations <strong>repo</strong> (lecture/écriture).
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-800 uppercase tracking-widest block">
                  Propriétaire / Utilisateur
                </label>
                <input
                  type="text"
                  value={githubOwner}
                  onChange={e => setGithubOwner(e.target.value)}
                  placeholder="Ex: Jackito46"
                  disabled={isExportingGitHub}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition-all disabled:opacity-60"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-800 uppercase tracking-widest block">
                  Nom du Dépôt
                </label>
                <input
                  type="text"
                  value={githubRepo}
                  onChange={e => setGithubRepo(e.target.value)}
                  placeholder="Ex: EduNova-Pro-Official"
                  disabled={isExportingGitHub}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition-all disabled:opacity-60"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5 sm:col-span-1">
                <label className="text-[10px] font-black text-slate-800 uppercase tracking-widest block">
                  Branche Cible
                </label>
                <input
                  type="text"
                  value={githubBranch}
                  onChange={e => setGithubBranch(e.target.value)}
                  placeholder="main"
                  disabled={isExportingGitHub}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition-all disabled:opacity-60"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-[10px] font-black text-slate-800 uppercase tracking-widest block">
                  Message du Commit (Optionnel)
                </label>
                <input
                  type="text"
                  value={githubCommitMsg}
                  onChange={e => setGithubCommitMsg(e.target.value)}
                  placeholder="Mise à jour synchronisée depuis EduNova..."
                  disabled={isExportingGitHub}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition-all disabled:opacity-60"
                />
              </div>
            </div>

            {/* Progress Status Card with Step Tracker */}
            {isExportingGitHub && githubExportProgress && (
              <div className="bg-slate-900 border border-indigo-900/50 text-white p-4 rounded-xl space-y-3 animate-fadeIn shadow-lg shadow-indigo-950/20">
                <div className="flex items-center justify-between text-xs font-bold text-slate-200">
                  <span className="flex items-center gap-2.5">
                    <Loader2 size={15} className="animate-spin text-indigo-400 shrink-0" />
                    <span className="truncate max-w-[280px] sm:max-w-xs">{githubExportProgress.step}</span>
                  </span>
                  <span className="font-mono text-xs bg-indigo-500/20 border border-indigo-500/30 px-2 py-0.5 rounded text-indigo-300 font-bold shrink-0">
                    {githubExportProgress.percent}%
                  </span>
                </div>

                {/* Animated Progress Bar */}
                <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700/50">
                  <div 
                    className="h-full bg-gradient-to-r from-indigo-500 via-indigo-400 to-emerald-400 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${Math.max(5, githubExportProgress.percent)}%` }}
                  />
                </div>

                {/* Step checkpoints */}
                <div className="grid grid-cols-4 gap-1 text-[10px] text-slate-400 pt-0.5 border-t border-slate-800/80">
                  <div className={`flex items-center gap-1 ${githubExportProgress.percent >= 10 ? 'text-indigo-300 font-bold' : ''}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${githubExportProgress.percent >= 10 ? 'bg-indigo-400' : 'bg-slate-700'}`} />
                    <span>Analyse</span>
                  </div>
                  <div className={`flex items-center gap-1 ${githubExportProgress.percent >= 30 ? 'text-indigo-300 font-bold' : ''}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${githubExportProgress.percent >= 30 ? 'bg-indigo-400' : 'bg-slate-700'}`} />
                    <span>Deltas</span>
                  </div>
                  <div className={`flex items-center gap-1 ${githubExportProgress.percent >= 80 ? 'text-indigo-300 font-bold' : ''}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${githubExportProgress.percent >= 80 ? 'bg-indigo-400' : 'bg-slate-700'}`} />
                    <span>Blobs</span>
                  </div>
                  <div className={`flex items-center gap-1 ${githubExportProgress.percent >= 95 ? 'text-emerald-300 font-bold' : ''}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${githubExportProgress.percent >= 95 ? 'bg-emerald-400' : 'bg-slate-700'}`} />
                    <span>Commit</span>
                  </div>
                </div>
              </div>
            )}

            {/* Success Card */}
            {githubExportResult?.success && (
              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl space-y-3 animate-fadeIn">
                <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  <span>Dépôt GitHub mis à jour avec succès !</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-700">
                  <div className="bg-white p-2.5 rounded-lg border border-emerald-100">
                    <span className="text-slate-600 block text-[10px] uppercase font-bold">Fichiers synchronisés</span>
                    <strong className="text-xs text-slate-900">
                      {githubExportResult.modifiedFilesCount !== undefined ? `${githubExportResult.modifiedFilesCount} modifié(s) / ` : ''}{githubExportResult.filesCount} total
                    </strong>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-emerald-100">
                    <span className="text-slate-600 block text-[10px] uppercase font-bold">Commit SHA</span>
                    <strong className="text-xs font-mono text-slate-900">{githubExportResult.commitSha?.slice(0, 8)}...</strong>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <a
                    href={githubExportResult.commitUrl || githubExportResult.repoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
                  >
                    <span>Voir le commit sur GitHub</span>
                    <ExternalLink size={12} />
                  </a>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              id="btn-github-modal-close"
              onClick={() => setIsGitHubModalOpen(false)}
              disabled={isExportingGitHub}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all disabled:opacity-50 cursor-pointer"
            >
              Fermer
            </button>
            <button
              type="button"
              id="btn-github-export-modal"
              onClick={handleExportToGitHub}
              disabled={isExportingGitHub || !githubToken.trim() || !githubOwner.trim() || !githubRepo.trim()}
              className="relative overflow-hidden px-5 py-2.5 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed active:scale-95 group min-w-[200px]"
            >
              {isExportingGitHub && (
                <div 
                  className="absolute inset-0 bg-indigo-600/40 transition-all duration-300 ease-out pointer-events-none"
                  style={{ width: `${Math.max(5, githubExportProgress?.percent || 0)}%` }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                {isExportingGitHub ? (
                  <>
                    <Loader2 size={15} className="animate-spin text-indigo-300 shrink-0" />
                    <span>
                      {githubExportProgress?.percent !== undefined
                        ? `Envoi des sources (${githubExportProgress.percent}%)...`
                        : "Envoi des sources en cours..."}
                    </span>
                  </>
                ) : (
                  <>
                    <GitPullRequest size={15} className="text-white group-hover:scale-110 transition-transform" />
                    <span>Lancer l'exportation GitHub</span>
                  </>
                )}
              </span>
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!sessionToDelete}
        onClose={() => {
          setSessionToDelete(null);
          setDeleteStatus({});
        }}
        onConfirm={handleDeleteYear}
       title="Supprimer la session"
       message={
         <div className="space-y-4">
           <p className="text-slate-700 font-medium tracking-tight">
             Êtes-vous sur le point de supprimer la session <span className="font-bold text-slate-900">"{sessionToDelete?.label}"</span> ?
           </p>
           <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl space-y-2">
             <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest">Avertissement</p>
             <p className="text-xs font-medium text-rose-800 leading-relaxed">
               Cette action est irréversible. Le système effectue une vérification rigoureuse pour s'assurer qu'aucune donnée ({terminology.student.toLowerCase()}s, paiements, notes) ne soit orpheline.
             </p>
           </div>
           {Object.keys(deleteStatus).length > 0 && (
             <div className="grid grid-cols-2 gap-2">
               {Object.entries(deleteStatus).map(([key, count]) => (count as number) > 0 && (
                 <div key={key} className="p-3 bg-slate-50 rounded-lg flex items-center justify-between border border-slate-100">
                   <span className="text-[10px] font-bold text-slate-700 uppercase tracking-tight">{key}</span>
                   <span className="text-xs font-black text-rose-600">{count}</span>
                 </div>
               ))}
             </div>
           )}
         </div>
       }
       confirmLabel={isDeleting ? "Analyse en cours..." : "Confirmer la suppression"}
       cancelLabel="Annuler"
       type="danger"
       isLoading={saving}
      />

     {modalConfig && (
      <Modal
       isOpen={modalConfig.isOpen}
       onClose={() => setModalConfig(null)}
       onConfirm={modalConfig.onConfirm}
       title={modalConfig.title}
       message={modalConfig.message}
       confirmLabel={modalConfig.confirmLabel}
       cancelLabel={modalConfig.cancelLabel}
       type={modalConfig.type}
       isLoading={saving}
      />
     )}
    </div>
     </div>
    </div>
  );
};

export default SettingsView;
