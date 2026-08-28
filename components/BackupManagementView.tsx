import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Database, HardDrive, RefreshCw, Plus, Download, Upload, Trash2, RotateCcw,
  CheckCircle2, AlertCircle, Clock, ShieldCheck, ShieldAlert, Sparkles, Filter,
  Search, Eye, Settings, FileText, Server, Lock, AlertTriangle, ArrowUpRight,
  Calendar, Layers, Check, X, Info, ChevronRight, Zap, Save, Cloud, CloudUpload,
  Copy, ExternalLink, HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { BackupClientService, BackupMetadata, BackupSettings, RestoreResult } from '../services/backupClientService';
import { supabase } from '../supabase';
import { UserProfile } from '../types';

interface BackupManagementViewProps {
  user: UserProfile;
  schools?: any[];
}

export const BackupManagementView: React.FC<BackupManagementViewProps> = ({ user, schools = [] }) => {
  const [backups, setBackups] = useState<BackupMetadata[]>([]);
  const [settings, setSettings] = useState<BackupSettings>({
    is_auto_backup_enabled: true,
    frequency: 'DAILY',
    scheduled_time: '02:00',
    scheduled_day: 0,
    retention_count: 30,
    storage_provider: 'SUPABASE_STORAGE',
    storage_bucket: 'database_backups',
    notify_on_success: false,
    notify_on_failure: true,
    notification_email: 'support@edunova.pro'
  });

  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'AUTOMATIC' | 'MANUAL' | 'PRE_RESTORE_SAFETY'>('ALL');

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isInspectModalOpen, setIsInspectModalOpen] = useState(false);
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isStorageHelpOpen, setIsStorageHelpOpen] = useState(false);
  const [isSyncingStorage, setIsSyncingStorage] = useState(false);
  const [isExecutingSql, setIsExecutingSql] = useState(false);

  // Active item selections
  const [selectedBackup, setSelectedBackup] = useState<BackupMetadata | null>(null);

  // Form states for manual backup creation
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    scope: 'FULL_DATABASE' as 'FULL_DATABASE' | 'SCHOOL_SPECIFIC',
    school_id: ''
  });
  const [isCreating, setIsCreating] = useState(false);

  // Form state for settings
  const [settingsForm, setSettingsForm] = useState<BackupSettings>(settings);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Form state for restoration
  const [restoreMode, setRestoreMode] = useState<'FULL' | 'SELECTIVE'>('FULL');
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [createSafetySnapshot, setCreateSafetySnapshot] = useState(true);
  const [confirmKeyword, setConfirmKeyword] = useState('');
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState<string | null>(null);
  const [restoreReport, setRestoreReport] = useState<RestoreResult | null>(null);

  // Upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Storage Test state
  const [isTestingStorage, setIsTestingStorage] = useState(false);
  const [storageTestResult, setStorageTestResult] = useState<any>(null);

  // Load data
  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await BackupClientService.getBackupsAndSettings();
      // Enforce unique IDs on client side as well
      const uniqueList: BackupMetadata[] = [];
      const seenIds = new Set<string>();
      for (const b of (data.backups || [])) {
        if (b && b.id && !seenIds.has(b.id)) {
          seenIds.add(b.id);
          uniqueList.push(b);
        }
      }
      setBackups(uniqueList);
      if (data.settings) {
        setSettings(data.settings);
        setSettingsForm(data.settings);
      }
    } catch (err: any) {
      toast.error(`Erreur: ${err.message || 'Impossible de charger les sauvegardes'}`);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filtered backups
  const filteredBackups = useMemo(() => {
    return backups.filter(b => {
      const matchesSearch =
        (b.name && b.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (b.description && b.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (b.id && b.id.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (b.school_name && b.school_name.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesType =
        filterType === 'ALL' || b.backup_type === filterType;

      return matchesSearch && matchesType;
    });
  }, [backups, searchTerm, filterType]);

  // Key metrics with Free Tier storage tracking
  const stats = useMemo(() => {
    const totalBackups = backups.length;
    const autoBackups = backups.filter(b => b.backup_type === 'AUTOMATIC').length;
    const manualBackups = backups.filter(b => b.backup_type === 'MANUAL').length;
    const safetyBackups = backups.filter(b => b.backup_type === 'PRE_RESTORE_SAFETY').length;
    const totalSize = backups.reduce((acc, b) => acc + (b.size_bytes || 0), 0);
    const lastBackup = backups[0] || null;
    const totalSizeMbNum = totalSize / (1024 * 1024);
    const freePlanQuotaMb = 1000; // 1 GB free Supabase Storage Quota
    const quotaPercentage = Math.min(100, (totalSizeMbNum / freePlanQuotaMb) * 100).toFixed(1);

    return {
      totalBackups,
      autoBackups,
      manualBackups,
      safetyBackups,
      totalSizeMb: totalSizeMbNum.toFixed(2),
      freePlanQuotaMb,
      quotaPercentage,
      lastBackupDate: lastBackup ? new Date(lastBackup.created_at).toLocaleString('fr-FR') : 'Aucune',
      lastBackupName: lastBackup?.name || 'Aucune sauvegarde effectuée'
    };
  }, [backups]);

  // Handle manual backup creation
  const handleCreateBackup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      const result = await BackupClientService.createBackup({
        name: createForm.name.trim() || undefined,
        description: createForm.description.trim() || undefined,
        backup_type: 'MANUAL',
        scope: createForm.scope,
        school_id: createForm.scope === 'SCHOOL_SPECIFIC' && createForm.school_id ? createForm.school_id : null,
        user_id: user.id,
        user_name: user.full_name || user.email
      });

      toast.success(`Point de sauvegarde "${result.metadata.name}" créé avec succès !`);
      setIsCreateModalOpen(false);
      setCreateForm({ name: '', description: '', scope: 'FULL_DATABASE', school_id: '' });
      await fetchData(true);
    } catch (err: any) {
      toast.error(`Échec: ${err.message || 'Impossible de créer la sauvegarde'}`);
    } finally {
      setIsCreating(false);
    }
  };

  // Handle settings update
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      const result = await BackupClientService.saveSettings(settingsForm);
      setSettings(result.settings);
      toast.success('Paramètres de sauvegarde automatique enregistrés avec succès !');
      setIsSettingsModalOpen(false);
    } catch (err: any) {
      toast.error(`Erreur: ${err.message || 'Impossible d\'enregistrer les paramètres'}`);
    } finally {
      setIsSavingSettings(false);
    }
  };

  const [isDeleting, setIsDeleting] = useState(false);

  // Handle backup deletion with instant in-place list update
  const handleDeleteBackup = async () => {
    if (!selectedBackup) return;
    const targetId = selectedBackup.id;
    const targetName = selectedBackup.name;

    // Optimistically update list in-place so there is zero latency or screen jump
    setBackups(prev => prev.filter(b => b.id !== targetId));
    setIsDeleteModalOpen(false);
    setSelectedBackup(null);
    setIsDeleting(true);

    try {
      await BackupClientService.deleteBackup(targetId);
      toast.success(`Sauvegarde "${targetName}" supprimée.`);
      // Silent refresh from server to ensure perfect consistency
      await fetchData(true);
    } catch (err: any) {
      toast.error(`Erreur: ${err.message || 'Impossible de supprimer la sauvegarde'}`);
      await fetchData(true);
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      toast.error('Format de fichier invalide. Veuillez importer un fichier .json');
      return;
    }

    setIsUploading(true);
    const toastId = toast.loading("Validation et importation de l'instantané de sauvegarde...");

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const content = event.target?.result as string;
          // Validate JSON structure
          const parsed = JSON.parse(content);
          if (!parsed.tables && !parsed.schools) {
            throw new Error('Structure du fichier de sauvegarde invalide (tables manquantes).');
          }

          const result = await BackupClientService.uploadBackupFile(content, file.name, user.full_name || user.email);
          toast.success(`Sauvegarde importée avec succès : ${result.metadata.name}`, { id: toastId });
          fetchData();
        } catch (err: any) {
          toast.error(`Erreur lors de la lecture du fichier : ${err.message}`, { id: toastId });
        } finally {
          setIsUploading(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      };
      reader.readAsText(file);
    } catch (err: any) {
      toast.error(`Erreur d'importation: ${err.message}`, { id: toastId });
      setIsUploading(false);
    }
  };

  // Handle storage test
  const handleTestStorage = async () => {
    setIsTestingStorage(true);
    try {
      const res = await BackupClientService.testStorage();
      setStorageTestResult(res);
      if (res.supabaseStorageAvailable || res.localMirrorAvailable) {
        toast.success(res.message);
      } else {
        toast.warning(res.message);
      }
    } catch (err: any) {
      toast.error(`Erreur de test stockage: ${err.message}`);
    } finally {
      setIsTestingStorage(false);
    }
  };

  // Handle sync to Supabase Storage
  const handleSyncToSupabaseStorage = async () => {
    setIsSyncingStorage(true);
    const toastId = toast.loading('Synchronisation des sauvegardes vers Supabase Storage...');
    try {
      const res = await BackupClientService.syncAllBackupsToSupabaseStorage();
      if (res.synced > 0) {
        toast.success(`${res.synced} sauvegarde(s) synchronisée(s) avec succès dans Supabase Storage (bucket '${settings.storage_bucket}') !`, { id: toastId });
      } else if (res.failed > 0) {
        toast.error(`Échec : ${res.details.join(', ')}`, { id: toastId });
      } else {
        toast.info('Toutes les sauvegardes sont déjà synchronisées dans Supabase Storage.', { id: toastId });
      }
      await fetchData(true);
    } catch (err: any) {
      toast.error(`Erreur : ${err.message || 'Impossible de synchroniser'}`, { id: toastId });
    } finally {
      setIsSyncingStorage(false);
    }
  };

  const STORAGE_RLS_SQL = `-- 1. Créer le bucket de sauvegarde
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('database_backups', 'database_backups', false, 104857600, ARRAY['application/json', 'application/gzip'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 104857600;

-- 2. Activer les autorisations Storage RLS
CREATE POLICY "Allow authenticated users access to database_backups"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'database_backups')
WITH CHECK (bucket_id = 'database_backups');

CREATE POLICY "Allow service_role full access to database_backups"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'database_backups')
WITH CHECK (bucket_id = 'database_backups');`;

  const handleCopyStorageSql = () => {
    navigator.clipboard.writeText(STORAGE_RLS_SQL);
    toast.success('Script SQL copié dans le presse-papiers !');
  };

  const handleExecuteStorageSql = async () => {
    setIsExecutingSql(true);
    const toastId = toast.loading('Configuration du bucket et des droits Supabase Storage...');
    try {
      const { error } = await supabase.rpc('exec_ddl', { ddl_query: STORAGE_RLS_SQL });
      if (error) throw error;
      toast.success('Bucket et politiques Supabase Storage configurés avec succès !', { id: toastId });
      await handleTestStorage();
    } catch (err: any) {
      toast.error(`Exécution directe non disponible (${err.message}). Veuillez coller le script dans l'onglet SQL Editor de Supabase.`, { id: toastId, duration: 6000 });
    } finally {
      setIsExecutingSql(false);
    }
  };

  // Handle restoration execution
  const handleExecuteRestore = async () => {
    if (!selectedBackup) return;
    if (confirmKeyword !== 'RESTAURER') {
      toast.error('Veuillez taper RESTAURER en majuscules pour confirmer.');
      return;
    }

    setIsRestoring(true);
    setRestoreProgress('Initialisation de la séquence de restauration sécurisée...');
    setRestoreReport(null);

    try {
      setRestoreProgress('Création du point de sécurité pré-restauration...');
      const result = await BackupClientService.restoreBackup({
        backup_id: selectedBackup.id,
        selected_tables: restoreMode === 'SELECTIVE' && selectedTables.length > 0 ? selectedTables : undefined,
        create_safety_snapshot: createSafetySnapshot,
        user_id: user.id,
        user_name: user.full_name || user.email
      });

      setRestoreReport(result);
      if (result.success) {
        toast.success(`Restauration terminée avec succès ! (${result.restored_rows_count} lignes restaurées)`);
      } else {
        toast.warning(`Restauration terminée avec quelques avertissements.`);
      }
      fetchData();
    } catch (err: any) {
      toast.error(`Échec critique de restauration : ${err.message}`);
      setRestoreReport({
        success: false,
        restored_tables: [],
        restored_rows_count: 0,
        errors: [{ table: 'SYSTEM', message: err.message }],
        duration_ms: 0
      });
    } finally {
      setIsRestoring(false);
      setRestoreProgress(null);
    }
  };

  // Grouped table categories for selective restore
  const tableCategories = [
    {
      category: 'Structure & Établissements',
      tables: ['schools', 'school_campuses', 'academic_years', 'classes', 'subjects', 'class_subjects']
    },
    {
      category: 'Élèves & Inscriptions',
      tables: ['students', 'enrollments', 'student_subjects', 'student_attendances', 'disciplinary_records']
    },
    {
      category: 'Évaluations & Pédagogie',
      tables: ['grades', 'course_evaluations', 'course_signatures', 'class_schedules']
    },
    {
      category: 'Finances & Comptabilité',
      tables: ['fee_plans', 'payments', 'student_ad_hoc_fees', 'ad_hoc_campaigns', 'expense_categories', 'expenses', 'budgets', 'exchange_rates', 'daily_cash_closures']
    },
    {
      category: 'Ressources Humaines & Paie',
      tables: ['staff', 'staff_roles', 'staff_assignments', 'staff_attendances', 'payroll_periods', 'payroll_slips', 'salary_advances', 'staff_salary_history']
    },
    {
      category: 'Paramètres & Configuration',
      tables: ['global_settings', 'communication_settings', 'communication_logs', 'profiles']
    }
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Modern Compact Header & Controls */}
      <div className="bg-slate-900 rounded-2xl p-5 md:p-6 text-white shadow-md border border-slate-800 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-11 h-11 bg-indigo-500/20 border border-indigo-400/30 rounded-xl flex items-center justify-center text-indigo-400 shrink-0 shadow-sm">
              <Database size={22} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide ${
                  settings.is_auto_backup_enabled
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${settings.is_auto_backup_enabled ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                  {settings.is_auto_backup_enabled
                    ? settings.frequency === 'WEEKLY'
                      ? `Auto: Chaque ${['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'][settings.scheduled_day ?? 0]} à ${settings.scheduled_time || '02:00'}`
                      : `Auto: ${settings.frequency} à ${settings.scheduled_time || '02:00'}`
                    : 'Auto Pause'}
                </span>
                <span className="text-[10px] font-semibold text-slate-400 border border-slate-700/60 px-2 py-0.5 rounded-full">
                  Bucket: {settings.storage_bucket}
                </span>
              </div>
              <h2 className="text-lg md:text-xl font-black tracking-tight text-white">Sauvegardes & Restauration</h2>
              <p className="text-xs text-slate-300 font-normal">Instantanés de la base de données, miroir sécurisé et restauration.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center gap-2 active:scale-95"
            >
              <Plus size={15} />
              <span>Créer une Sauvegarde</span>
            </button>

            <button
              onClick={handleSyncToSupabaseStorage}
              disabled={isSyncingStorage}
              className="px-3 py-2.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 font-bold text-xs rounded-xl transition-all border border-emerald-500/30 flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
              title="Pousser les sauvegardes locales vers le bucket Supabase Storage"
            >
              <CloudUpload size={15} className={isSyncingStorage ? 'animate-bounce text-emerald-400' : 'text-emerald-400'} />
              <span className="hidden sm:inline">{isSyncingStorage ? 'Synchronisation...' : 'Sync vers Supabase'}</span>
            </button>

            <button
              onClick={() => setIsStorageHelpOpen(true)}
              className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs rounded-xl transition-all border border-slate-700 flex items-center gap-1.5 active:scale-95"
              title="Guide de configuration et script SQL pour Supabase Storage"
            >
              <HelpCircle size={15} />
              <span className="hidden sm:inline">Guide Storage</span>
            </button>

            <button
              onClick={() => setIsSettingsModalOpen(true)}
              className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl transition-all border border-slate-700 flex items-center gap-1.5 active:scale-95"
              title="Configurer l'automatisation et le stockage"
            >
              <Settings size={15} className="text-indigo-400" />
              <span className="hidden sm:inline">Paramètres</span>
            </button>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".json"
              className="hidden"
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl transition-all border border-slate-700 flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
              title="Importer un fichier snapshot (.json)"
            >
              <Upload size={15} className="text-emerald-400" />
              <span className="hidden sm:inline">{isUploading ? 'Import...' : 'Importer'}</span>
            </button>

            <button
              onClick={() => fetchData()}
              disabled={loading}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-all active:scale-95"
              title="Actualiser la liste"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Live Metrics Grid - Sleek & Responsive */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 pt-3 border-t border-slate-800">
          <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/50 flex flex-col justify-between">
            <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Instantanés</div>
            <div className="text-sm md:text-base font-extrabold text-white mt-1 flex items-center gap-1.5">
              <Database size={15} className="text-indigo-400" />
              <span>{stats.totalBackups}</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-1 font-mono">
              {stats.autoBackups} auto · {stats.manualBackups} manuels · {stats.safetyBackups} sécurité
            </div>
          </div>

          <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/50 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Espace & Quota Free</span>
              <span className="text-[9px] font-semibold text-emerald-400 bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-800/60">
                {stats.quotaPercentage}% / 1 Go
              </span>
            </div>
            <div className="text-sm md:text-base font-extrabold text-emerald-400 mt-1 flex items-center gap-1.5">
              <HardDrive size={15} />
              <span>{stats.totalSizeMb} Mo</span>
              <span className="text-[10px] font-normal text-slate-400">/ 1000 Mo</span>
            </div>
            <div className="mt-1 space-y-1">
              <div className="w-full bg-slate-700/60 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-emerald-400 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(1, Math.min(100, parseFloat(stats.quotaPercentage)))}%` }}
                />
              </div>
              <div className="text-[9px] text-slate-400 font-mono flex items-center justify-between">
                <span>Rétention : {settings.retention_count} max</span>
                <span>Quota Supabase OK</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/50 flex flex-col justify-between">
            <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Dernier Succès</div>
            <div className="text-xs md:text-sm font-extrabold text-indigo-300 mt-1 flex items-center gap-1.5 truncate" title={stats.lastBackupName}>
              <Clock size={14} className="shrink-0" />
              <span className="truncate">{stats.lastBackupDate}</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-1 font-mono truncate">{stats.lastBackupName}</div>
          </div>

          <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/50 flex flex-col justify-between">
            <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Liaison Stockage</div>
            <div className="text-xs md:text-sm font-extrabold text-emerald-300 mt-1 flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-1.5 truncate">
                <ShieldCheck size={15} className="shrink-0" />
                <span className="truncate">{settings.storage_bucket}</span>
              </div>
              <button
                onClick={() => setIsStorageHelpOpen(true)}
                className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded font-bold hover:bg-amber-500/30"
              >
                Aide
              </button>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <button
                onClick={handleTestStorage}
                disabled={isTestingStorage}
                className="text-[10px] text-amber-300 hover:text-amber-200 inline-flex items-center gap-1 font-semibold transition-colors disabled:opacity-50"
              >
                <Zap size={10} className={isTestingStorage ? 'animate-spin' : ''} />
                <span>{isTestingStorage ? 'Test...' : 'Tester'}</span>
              </button>
              <span className="text-slate-600 text-xs">·</span>
              <button
                onClick={handleSyncToSupabaseStorage}
                disabled={isSyncingStorage}
                className="text-[10px] text-emerald-300 hover:text-emerald-200 inline-flex items-center gap-1 font-semibold transition-colors disabled:opacity-50"
              >
                <CloudUpload size={10} className={isSyncingStorage ? 'animate-bounce' : ''} />
                <span>{isSyncingStorage ? 'Syncing...' : 'Sync Cloud'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-6 space-y-5">
        {/* Filters and Search Bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Rechercher par nom, identifiant ou établissement..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-xl">
            {[
              { id: 'ALL', label: 'Toutes', count: backups.length },
              { id: 'AUTOMATIC', label: 'Automatiques', count: stats.autoBackups },
              { id: 'MANUAL', label: 'Manuelles', count: stats.manualBackups },
              { id: 'PRE_RESTORE_SAFETY', label: 'Sécurité', count: stats.safetyBackups }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFilterType(f.id as any)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  filterType === f.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>{f.label}</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200/70 font-bold">
                  {f.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Backups Table */}
        {loading ? (
          <div className="py-16 text-center space-y-3">
            <RefreshCw size={24} className="animate-spin mx-auto text-indigo-600" />
            <p className="text-xs font-bold text-slate-500">Chargement des instantanés...</p>
          </div>
        ) : filteredBackups.length === 0 ? (
          <div className="py-12 text-center space-y-3 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mx-auto">
              <Database size={24} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Aucun point de sauvegarde</h3>
              <p className="text-xs text-slate-500 mt-0.5 max-w-sm mx-auto">
                {searchTerm || filterType !== 'ALL'
                  ? 'Aucun instantané ne correspond aux critères.'
                  : 'Générez un premier point de restauration pour protéger la base de données.'}
              </p>
            </div>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm inline-flex items-center gap-1.5"
            >
              <Plus size={14} />
              <span>Créer une Sauvegarde</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs min-w-[760px]">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Point de Sauvegarde</th>
                  <th className="px-4 py-3">Type & Périmètre</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Données</th>
                  <th className="px-4 py-3">Taille</th>
                  <th className="px-4 py-3">Stockage</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredBackups.map((backup, idx) => {
                  const isAuto = backup.backup_type === 'AUTOMATIC';
                  const isSafety = backup.backup_type === 'PRE_RESTORE_SAFETY';
                  const formattedSize = (backup.size_bytes / 1024).toFixed(1) + ' Ko';

                  return (
                    <tr key={`${backup.id || 'bkp'}-${idx}`} className="hover:bg-slate-50/70 transition-colors group">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            isSafety ? 'bg-amber-100 text-amber-700' : isAuto ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            <Database size={16} />
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 text-xs">
                              {backup.name}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              ID: {backup.id}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5 items-start">
                          <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider ${
                            isSafety
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : isAuto
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}>
                            {isSafety ? 'Sécurité' : isAuto ? 'Auto' : 'Manuel'}
                          </span>
                          <span className="text-[10px] text-slate-500 font-medium truncate max-w-[150px]">
                            {backup.scope === 'SCHOOL_SPECIFIC'
                              ? `${backup.school_name || 'Établissement'}`
                              : 'Multi-Tenant (Global)'}
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="text-slate-800 font-semibold text-[11px]">
                          {new Date(backup.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {new Date(backup.created_at).toLocaleTimeString('fr-FR')}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="text-slate-900 font-bold">
                          {backup.rows_count.toLocaleString('fr-FR')} <span className="font-normal text-slate-500 text-[10px]">lignes</span>
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {backup.tables_count} tables
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="font-mono font-bold text-slate-800">{formattedSize}</div>
                        <div className="text-[9px] text-slate-400 font-mono truncate max-w-[100px]" title={backup.checksum}>
                          SHA: {backup.checksum?.slice(0, 8)}...
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          <Server size={10} className="text-indigo-500" />
                          {backup.storage_provider === 'SUPABASE_STORAGE' ? 'Supabase' : 'Local'}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Restore Button */}
                          <button
                            onClick={() => {
                              setSelectedBackup(backup);
                              setRestoreMode('FULL');
                              setSelectedTables([]);
                              setConfirmKeyword('');
                              setRestoreReport(null);
                              setIsRestoreModalOpen(true);
                            }}
                            className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] rounded-lg transition-all shadow-xs flex items-center gap-1 active:scale-95"
                            title="Restaurer la base de données"
                          >
                            <RotateCcw size={12} />
                            <span>Restaurer</span>
                          </button>

                          {/* Inspect Button */}
                          <button
                            onClick={() => {
                              setSelectedBackup(backup);
                              setIsInspectModalOpen(true);
                            }}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all"
                            title="Inspecter le contenu"
                          >
                            <Eye size={14} />
                          </button>

                          {/* Download Button */}
                          <button
                            onClick={() => BackupClientService.downloadBackup(backup)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all inline-flex items-center justify-center cursor-pointer"
                            title="Télécharger (.json)"
                          >
                            <Download size={14} />
                          </button>

                          {/* Delete Button */}
                          <button
                            onClick={() => {
                              setSelectedBackup(backup);
                              setIsDeleteModalOpen(true);
                            }}
                            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-all"
                            title="Supprimer cette sauvegarde"
                          >
                            <Trash2 size={14} />
                          </button>
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

      {/* MODAL 1: Create Manual Backup */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl max-w-lg w-full p-6 md:p-8 shadow-2xl border border-slate-200 space-y-6"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                    <Database size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900">Nouvelle Sauvegarde Immédiate</h3>
                    <p className="text-xs text-slate-500 font-medium">Générer un instantané de la base de données.</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsCreateModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateBackup} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Nom de l'Instantané (Optionnel)</label>
                  <input
                    type="text"
                    placeholder={`Ex: Sauvegarde Avant Clôture Annuelle (${new Date().toLocaleDateString('fr-FR')})`}
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Description ou Contexte</label>
                  <textarea
                    rows={2}
                    placeholder="Précisez la raison de cette sauvegarde..."
                    value={createForm.description}
                    onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Périmètre de la Sauvegarde</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setCreateForm({ ...createForm, scope: 'FULL_DATABASE', school_id: '' })}
                      className={`p-3 rounded-xl border text-xs font-bold text-left transition-all ${
                        createForm.scope === 'FULL_DATABASE'
                          ? 'border-indigo-600 bg-indigo-50/60 text-indigo-900 shadow-sm'
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <div className="font-extrabold">Plateforme Complète</div>
                      <div className="text-[10px] text-slate-500 font-normal mt-0.5">Toutes les 43 tables et tous les établissements</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCreateForm({ ...createForm, scope: 'SCHOOL_SPECIFIC' })}
                      className={`p-3 rounded-xl border text-xs font-bold text-left transition-all ${
                        createForm.scope === 'SCHOOL_SPECIFIC'
                          ? 'border-indigo-600 bg-indigo-50/60 text-indigo-900 shadow-sm'
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <div className="font-extrabold">Établissement Spécifique</div>
                      <div className="text-[10px] text-slate-500 font-normal mt-0.5">Isoler les données d'un seul tenant</div>
                    </button>
                  </div>
                </div>

                {createForm.scope === 'SCHOOL_SPECIFIC' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Sélectionner l'Établissement</label>
                    <select
                      value={createForm.school_id}
                      onChange={(e) => setCreateForm({ ...createForm, school_id: e.target.value })}
                      required
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                    >
                      <option value="">-- Choisir un établissement --</option>
                      {schools.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.status || 'ACTIVE'})</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center gap-2 disabled:opacity-50"
                  >
                    {isCreating ? <RefreshCw size={14} className="animate-spin" /> : <Database size={14} />}
                    <span>{isCreating ? 'Génération du Snapshot...' : 'Lancer la Sauvegarde'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: Settings & Automation */}
      <AnimatePresence>
        {isSettingsModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl max-w-xl w-full p-6 md:p-8 shadow-2xl border border-slate-200 space-y-6 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                    <Settings size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900">Automatisation & Stockage Externe</h3>
                    <p className="text-xs text-slate-500 font-medium">Planification des sauvegardes de base de données.</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsSettingsModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveSettings} className="space-y-5">
                {/* Auto Backup Toggle */}
                <div className="p-4 bg-indigo-50/60 rounded-2xl border border-indigo-100 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-black text-indigo-950">Service de Sauvegarde Automatique</div>
                    <div className="text-[11px] text-indigo-700/80 font-medium mt-0.5">
                      Déclenchement programmé en arrière-plan sans interruption.
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settingsForm.is_auto_backup_enabled}
                      onChange={(e) => setSettingsForm({ ...settingsForm, is_auto_backup_enabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                {/* Frequency & Scheduled Timing */}
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                        <RotateCcw size={13} className="text-indigo-600" />
                        <span>Fréquence d'Exécution</span>
                      </label>
                      <select
                        value={settingsForm.frequency}
                        onChange={(e) => setSettingsForm({ ...settingsForm, frequency: e.target.value as any })}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-colors"
                      >
                        <option value="HOURLY">Toutes les Heures</option>
                        <option value="EVERY_6H">Toutes les 6 Heures</option>
                        <option value="EVERY_12H">Toutes les 12 Heures</option>
                        <option value="DAILY">Quotidien (Une fois par jour)</option>
                        <option value="WEEKLY">Hebdomadaire (Une fois par semaine)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                        <Clock size={13} className="text-indigo-600" />
                        <span>Heure Prévue (Format 24H)</span>
                      </label>
                      <input
                        type="time"
                        value={settingsForm.scheduled_time}
                        onChange={(e) => setSettingsForm({ ...settingsForm, scheduled_time: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-colors"
                      />
                    </div>
                  </div>

                  {/* Day of Week Selector (Visible when WEEKLY is selected) */}
                  {settingsForm.frequency === 'WEEKLY' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="p-4 bg-indigo-50/70 border border-indigo-200/80 rounded-2xl space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-black text-indigo-950">
                          <Calendar size={14} className="text-indigo-600" />
                          <span>Jour Exact de la Sauvegarde Hebdomadaire</span>
                        </div>
                        <span className="text-[11px] font-extrabold text-indigo-600 bg-white px-2.5 py-0.5 rounded-full border border-indigo-200 shadow-xs">
                          {['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'][settingsForm.scheduled_day ?? 0]}
                        </span>
                      </div>

                      {/* Interactive Days Pills */}
                      <div className="grid grid-cols-7 gap-1.5">
                        {[
                          { day: 1, short: 'Lun', full: 'Lundi' },
                          { day: 2, short: 'Mar', full: 'Mardi' },
                          { day: 3, short: 'Mer', full: 'Mercredi' },
                          { day: 4, short: 'Jeu', full: 'Jeudi' },
                          { day: 5, short: 'Ven', full: 'Vendredi' },
                          { day: 6, short: 'Sam', full: 'Samedi' },
                          { day: 0, short: 'Dim', full: 'Dimanche' }
                        ].map((d) => {
                          const isSelected = (settingsForm.scheduled_day ?? 0) === d.day;
                          return (
                            <button
                              key={d.day}
                              type="button"
                              onClick={() => setSettingsForm({ ...settingsForm, scheduled_day: d.day })}
                              className={`py-2 px-1 text-center rounded-xl text-xs font-black transition-all flex flex-col items-center justify-center gap-0.5 border ${
                                isSelected
                                  ? 'bg-indigo-600 text-white border-indigo-700 shadow-md scale-102 ring-2 ring-indigo-300'
                                  : 'bg-white text-slate-700 border-indigo-100 hover:bg-indigo-100/60 hover:text-indigo-900'
                              }`}
                            >
                              <span className="text-[11px] leading-none">{d.short}</span>
                              {isSelected && <span className="w-1 h-1 bg-white rounded-full mt-0.5"></span>}
                            </button>
                          );
                        })}
                      </div>

                      {/* Live Next Run Preview Banner */}
                      <div className="flex items-center gap-2 text-[11px] font-semibold text-indigo-900/90 bg-white/90 p-2.5 rounded-xl border border-indigo-100/80">
                        <Sparkles size={13} className="text-amber-500 shrink-0" />
                        <span>
                          Prochaine exécution : <strong>Chaque {['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'][settingsForm.scheduled_day ?? 0]} à {settingsForm.scheduled_time || '02:00'}</strong> (automatisé en arrière-plan).
                        </span>
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Retention & Bucket */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                      <Layers size={13} className="text-indigo-600" />
                      <span>Politique de Rétention (Max)</span>
                    </label>
                    <select
                      value={settingsForm.retention_count}
                      onChange={(e) => setSettingsForm({ ...settingsForm, retention_count: parseInt(e.target.value, 10) })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-colors"
                    >
                      <option value={10}>Conserver les 10 dernières</option>
                      <option value={20}>Conserver les 20 dernières</option>
                      <option value={30}>Conserver les 30 dernières (Recommandé)</option>
                      <option value={60}>Conserver les 60 dernières</option>
                      <option value={90}>Conserver les 90 dernières</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                      <HardDrive size={13} className="text-indigo-600" />
                      <span>Bucket Supabase Storage</span>
                    </label>
                    <input
                      type="text"
                      value={settingsForm.storage_bucket}
                      onChange={(e) => setSettingsForm({ ...settingsForm, storage_bucket: e.target.value })}
                      placeholder="database_backups"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white font-mono transition-colors"
                    />
                  </div>
                </div>

                {/* Notification settings */}
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <div className="text-xs font-extrabold text-slate-900">Alertes & Notifications par Email</div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Email du Super Admin Destinataire</label>
                    <input
                      type="email"
                      value={settingsForm.notification_email || ''}
                      onChange={(e) => setSettingsForm({ ...settingsForm, notification_email: e.target.value })}
                      placeholder="admin@edunova.pro"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settingsForm.notify_on_failure}
                        onChange={(e) => setSettingsForm({ ...settingsForm, notify_on_failure: e.target.checked })}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-xs font-semibold text-slate-700">Alerter immédiatement par email en cas d'échec de sauvegarde</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settingsForm.notify_on_success}
                        onChange={(e) => setSettingsForm({ ...settingsForm, notify_on_success: e.target.checked })}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-xs font-semibold text-slate-700">Recevoir une confirmation par email lors de chaque sauvegarde automatique réussie</span>
                    </label>
                  </div>
                </div>

                <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsSettingsModalOpen(false)}
                    className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingSettings}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center gap-2 disabled:opacity-50"
                  >
                    {isSavingSettings ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                    <span>{isSavingSettings ? 'Enregistrement...' : 'Enregistrer Paramètres'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 3: Inspect Backup Details */}
      <AnimatePresence>
        {isInspectModalOpen && selectedBackup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl max-w-2xl w-full p-6 md:p-8 shadow-2xl border border-slate-200 space-y-6 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                    <Eye size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900">{selectedBackup.name}</h3>
                    <p className="text-xs text-slate-500 font-medium">Instantané du {new Date(selectedBackup.created_at).toLocaleString('fr-FR')}</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsInspectModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Metadata strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div>
                  <div className="text-[10px] font-extrabold uppercase text-slate-400">Total Enregistrements</div>
                  <div className="text-sm font-black text-slate-900 mt-0.5">{selectedBackup.rows_count.toLocaleString('fr-FR')}</div>
                </div>
                <div>
                  <div className="text-[10px] font-extrabold uppercase text-slate-400">Tables PostgreSQL</div>
                  <div className="text-sm font-black text-indigo-600 mt-0.5">{selectedBackup.tables_count}</div>
                </div>
                <div>
                  <div className="text-[10px] font-extrabold uppercase text-slate-400">Poids Fichier</div>
                  <div className="text-sm font-black text-slate-900 mt-0.5">{(selectedBackup.size_bytes / 1024).toFixed(1)} Ko</div>
                </div>
                <div>
                  <div className="text-[10px] font-extrabold uppercase text-slate-400">Auteur / Source</div>
                  <div className="text-xs font-bold text-slate-700 mt-0.5 truncate">{selectedBackup.created_by_name || 'Système'}</div>
                </div>
              </div>

              {/* Checksum & Storage Path */}
              <div className="p-3 bg-slate-900 text-slate-300 rounded-xl text-[11px] font-mono space-y-1">
                <div><strong>SHA-256 :</strong> {selectedBackup.checksum}</div>
                <div><strong>Emplacement :</strong> {selectedBackup.storage_path}</div>
              </div>

              {/* Tables Breakdown Grid */}
              <div className="space-y-3">
                <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">Répartition des Enregistrements par Table</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-60 overflow-y-auto p-1">
                  {Object.entries(selectedBackup.tables_summary || {}).map(([table, count]) => (
                    <div key={table} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                      <span className="font-mono font-medium text-slate-700 truncate">{table}</span>
                      <span className="font-extrabold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md text-[10px]">
                        {count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => BackupClientService.downloadBackup(selectedBackup)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer transition-all"
                >
                  <Download size={14} />
                  <span>Télécharger Snapshot (.json)</span>
                </button>
                <button
                  onClick={() => {
                    setIsInspectModalOpen(false);
                    setIsRestoreModalOpen(true);
                  }}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center gap-2"
                >
                  <RotateCcw size={14} />
                  <span>Restaurer ce Point</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 4: Restoration Wizard */}
      <AnimatePresence>
        {isRestoreModalOpen && selectedBackup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl max-w-xl w-full p-6 md:p-8 shadow-2xl border border-slate-200 space-y-6 max-h-[92vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center">
                    <RotateCcw size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900">Assistant de Restauration Base de Données</h3>
                    <p className="text-xs text-slate-500 font-medium">Restauration à partir de l'instantané {selectedBackup.name}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (!isRestoring) setIsRestoreModalOpen(false);
                  }}
                  disabled={isRestoring}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 disabled:opacity-50"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Safety Warning */}
              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 flex items-start gap-3">
                <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900 space-y-1">
                  <div className="font-extrabold">Opération Critique de Restauration</div>
                  <div className="leading-relaxed">
                    Cette action va synchroniser et restaurer l'état des tables sélectionnées à la date du <strong>{new Date(selectedBackup.created_at).toLocaleString('fr-FR')}</strong>.
                    Un point de sauvegarde de sécurité sera automatiquement créé avant l'application pour vous permettre d'annuler si nécessaire.
                  </div>
                </div>
              </div>

              {/* Mode Selector: Full vs Selective */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">Mode de Restauration</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRestoreMode('FULL')}
                    className={`p-3 rounded-xl border text-xs font-bold text-left transition-all ${
                      restoreMode === 'FULL'
                        ? 'border-indigo-600 bg-indigo-50/60 text-indigo-900 shadow-sm'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <div className="font-extrabold">Restauration Intégrale</div>
                    <div className="text-[10px] text-slate-500 font-normal mt-0.5">Toutes les tables et relations</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRestoreMode('SELECTIVE')}
                    className={`p-3 rounded-xl border text-xs font-bold text-left transition-all ${
                      restoreMode === 'SELECTIVE'
                        ? 'border-indigo-600 bg-indigo-50/60 text-indigo-900 shadow-sm'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <div className="font-extrabold">Restauration Sélective</div>
                    <div className="text-[10px] text-slate-500 font-normal mt-0.5">Choisir les modules ou tables</div>
                  </button>
                </div>
              </div>

              {/* Selective Tables Checkboxes */}
              {restoreMode === 'SELECTIVE' && (
                <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-200 max-h-56 overflow-y-auto">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                    <span>Sélectionner les tables à restaurer :</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedTables.length === Object.keys(selectedBackup.tables_summary || {}).length) {
                          setSelectedTables([]);
                        } else {
                          setSelectedTables(Object.keys(selectedBackup.tables_summary || {}));
                        }
                      }}
                      className="text-indigo-600 hover:underline text-[11px]"
                    >
                      {selectedTables.length === Object.keys(selectedBackup.tables_summary || {}).length ? 'Tout désélectionner' : 'Tout sélectionner'}
                    </button>
                  </div>

                  <div className="space-y-4">
                    {tableCategories.map(cat => (
                      <div key={cat.category} className="space-y-1.5">
                        <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">{cat.category}</div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {cat.tables.map(table => {
                            const count = selectedBackup.tables_summary?.[table] || 0;
                            const isChecked = selectedTables.includes(table);
                            return (
                              <label key={table} className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer ${
                                isChecked ? 'bg-indigo-50/80 border-indigo-300 text-indigo-950 font-bold' : 'bg-white border-slate-200 text-slate-700'
                              }`}>
                                <div className="flex items-center gap-2 truncate">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedTables([...selectedTables, table]);
                                      } else {
                                        setSelectedTables(selectedTables.filter(t => t !== table));
                                      }
                                    }}
                                    className="rounded text-indigo-600 focus:ring-indigo-500"
                                  />
                                  <span className="font-mono truncate">{table}</span>
                                </div>
                                <span className="text-[10px] text-slate-400 font-mono">({count})</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pre-Restore Safety Snapshot Checkbox */}
              <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={16} className="text-indigo-600" />
                  <span className="text-xs font-bold text-indigo-950">Créer un point de sécurité automatique avant restauration</span>
                </div>
                <input
                  type="checkbox"
                  checked={createSafetySnapshot}
                  onChange={(e) => setCreateSafetySnapshot(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
              </div>

              {/* Confirmation Keyword */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Pour valider l'opération, tapez <span className="font-mono text-rose-600 font-black">RESTAURER</span> ci-dessous :
                </label>
                <input
                  type="text"
                  placeholder="Tapez RESTAURER"
                  value={confirmKeyword}
                  onChange={(e) => setConfirmKeyword(e.target.value)}
                  disabled={isRestoring}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white uppercase"
                />
              </div>

              {/* In-Progress status */}
              {isRestoring && (
                <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-2 text-xs">
                  <div className="flex items-center gap-2 font-bold text-indigo-300">
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Restauration en cours d'exécution...</span>
                  </div>
                  <div className="text-[11px] text-slate-300 font-mono">{restoreProgress}</div>
                </div>
              )}

              {/* Post-Restore Report */}
              {restoreReport && (
                <div className={`p-4 rounded-2xl border text-xs space-y-2 ${
                  restoreReport.success ? 'bg-emerald-50 border-emerald-200 text-emerald-950' : 'bg-rose-50 border-rose-200 text-rose-950'
                }`}>
                  <div className="font-black flex items-center gap-2">
                    {restoreReport.success ? <CheckCircle2 size={16} className="text-emerald-600" /> : <AlertCircle size={16} className="text-rose-600" />}
                    <span>{restoreReport.success ? 'Restauration terminée avec succès !' : 'Échec de restauration'}</span>
                  </div>
                  <div className="text-[11px] space-y-0.5">
                    <div>Lignes restaurées : <strong>{restoreReport.restored_rows_count}</strong></div>
                    <div>Tables traitées : <strong>{restoreReport.restored_tables.length}</strong></div>
                    {restoreReport.safety_snapshot_id && (
                      <div>Snapshot de sécurité : <span className="font-mono">{restoreReport.safety_snapshot_id}</span></div>
                    )}
                  </div>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsRestoreModalOpen(false)}
                  disabled={isRestoring}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl disabled:opacity-50"
                >
                  Fermer
                </button>

                <button
                  type="button"
                  onClick={handleExecuteRestore}
                  disabled={isRestoring || confirmKeyword !== 'RESTAURER'}
                  className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center gap-2 disabled:opacity-40"
                >
                  {isRestoring ? <RefreshCw size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                  <span>{isRestoring ? 'Restauration en cours...' : 'Exécuter la Restauration'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 5: Delete Confirmation */}
      <AnimatePresence>
        {isDeleteModalOpen && selectedBackup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5"
            >
              <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center">
                <Trash2 size={24} />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Supprimer cette sauvegarde ?</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Voulez-vous définitivement supprimer l'instantané <strong>{selectedBackup.name}</strong> ? Cette action efface les fichiers locaux et distants.
                </p>
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleDeleteBackup}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50 active:scale-95"
                >
                  {isDeleting ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      <span>Suppression...</span>
                    </>
                  ) : (
                    <span>Confirmer la Suppression</span>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 6: Storage Help & RLS Fix Guide */}
      <AnimatePresence>
        {isStorageHelpOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center shrink-0">
                    <CloudUpload size={24} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">Guide & Réparation Supabase Storage</h3>
                    <p className="text-xs text-slate-500">
                      Résolution du stockage vide & autorisation du bucket <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-600 font-bold">database_backups</code>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsStorageHelpOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4 text-xs text-slate-700">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                  <h4 className="font-extrabold text-slate-900 flex items-center gap-1.5 text-xs">
                    <Info size={14} className="text-indigo-600" />
                    Pourquoi le bucket Supabase était-il vide ?
                  </h4>
                  <p className="leading-relaxed text-slate-600">
                    1. <strong>Double persistance :</strong> Les instantanés sont enregistrés dans le registre de base de données (<code className="font-mono bg-slate-200/60 px-1 rounded">global_settings</code>) et dans le cache local.
                  </p>
                  <p className="leading-relaxed text-slate-600">
                    2. <strong>Sécurité RLS Supabase :</strong> Par défaut, Supabase bloque les écritures anonymes ou non configurées dans la table <code className="font-mono bg-slate-200/60 px-1 rounded">storage.objects</code>. Il faut donc créer le bucket et autoriser les rôles <code className="font-mono bg-slate-200/60 px-1 rounded">authenticated</code> et <code className="font-mono bg-slate-200/60 px-1 rounded">service_role</code>.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-slate-900">Script SQL d'activation du Bucket & RLS :</span>
                    <button
                      type="button"
                      onClick={handleCopyStorageSql}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-all flex items-center gap-1 text-[11px]"
                    >
                      <Copy size={12} />
                      <span>Copier le Script SQL</span>
                    </button>
                  </div>
                  <pre className="p-3 bg-slate-900 text-slate-100 rounded-xl font-mono text-[11px] overflow-x-auto leading-relaxed border border-slate-800">
                    {STORAGE_RLS_SQL}
                  </pre>
                  <p className="text-[11px] text-slate-500">
                    💡 Pour appliquer : Allez sur votre <strong>Supabase Dashboard &gt; SQL Editor</strong>, collez ce script et cliquez sur <strong>RUN</strong>.
                  </p>
                </div>

                <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl space-y-2">
                  <div className="font-extrabold text-emerald-900 flex items-center gap-1.5">
                    <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                    <span>Synchronisation immédiate des fichiers</span>
                  </div>
                  <p className="text-emerald-800 text-[11px] leading-relaxed">
                    Une fois le script SQL exécuté, cliquez sur le bouton ci-dessous pour téléverser immédiatement tous vos instantanés existants dans Supabase Storage.
                  </p>
                  <div className="pt-1 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSyncToSupabaseStorage}
                      disabled={isSyncingStorage}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all shadow-sm flex items-center gap-2 text-xs disabled:opacity-50"
                    >
                      <CloudUpload size={14} className={isSyncingStorage ? 'animate-bounce' : ''} />
                      <span>{isSyncingStorage ? 'Synchronisation en cours...' : 'Synchroniser tout maintenant'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleTestStorage}
                      disabled={isTestingStorage}
                      className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all text-xs flex items-center gap-1.5"
                    >
                      <Zap size={13} className={isTestingStorage ? 'animate-spin' : ''} />
                      <span>Tester l'accès Storage</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsStorageHelpOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl"
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
