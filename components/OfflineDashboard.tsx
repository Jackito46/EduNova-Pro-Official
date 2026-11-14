import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  WifiOff,
  Wifi,
  FileEdit,
  RefreshCw,
  AlertTriangle,
  Database,
  Trash2,
  ArrowRight,
  Lock,
  Unlock,
  KeyRound,
  CloudUpload,
  CheckCircle2,
  Download,
  Upload,
  Zap,
  HardDrive,
  ShieldCheck,
  Receipt,
  BookOpen,
} from 'lucide-react';
import { toast } from 'sonner';
import { UserProfile } from '../types';
import { Link } from 'react-router-dom';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useAdaptiveLightMode } from '../hooks/useAdaptiveLightMode';
import {
  ensureOfflineVaultUnlocked,
  ensureStorageQuotaHealth,
  hasOfflineVaultPin,
  isOfflineVaultUnlocked,
  lockOfflineVault,
  setOfflineVaultPin,
  StorageQuotaHealth,
  unlockOfflineVaultWithPin,
} from '../services/offlineEncryptedStore';
import {
  clearSyncedOfflineHistory,
  exportPendingOperationsBundle,
  flushOfflineSyncQueue,
  getOfflineSyncSummary,
  importPortableOperationsBundle,
  listOfflineQueueEnvelopes,
  OfflineSyncSummary,
  resolveGradesConflict,
  subscribeOfflineSyncState,
  SyncQueueEnvelope,
} from '../services/offlineSyncEngine';

interface OfflineDashboardProps {
  user: UserProfile;
}

interface DraftItem {
  key: string;
  type: string;
  id: string;
  timestamp: number;
}

const EMPTY_SUMMARY: OfflineSyncSummary = {
  pendingCount: 0,
  receiptCount: 0,
  gradesBatchCount: 0,
  conflictCount: 0,
  failedCount: 0,
  syncedCount: 0,
  isFlushing: false,
  lastSyncedAtMs: null,
};

export const OfflineDashboard: React.FC<OfflineDashboardProps> = ({ user }) => {
  const { isOnline, isSlow, latency } = useOnlineStatus();
  const { profile, isLightMode, manualPref, setManualMode } = useAdaptiveLightMode();

  const [drafts, setDrafts] = useState<DraftItem[]>([]);
  const [cacheItems, setCacheItems] = useState<{ name: string; count: number; size: string }[]>([]);

  const [summary, setSummary] = useState<OfflineSyncSummary>(EMPTY_SUMMARY);
  const [envelopes, setEnvelopes] = useState<SyncQueueEnvelope[]>([]);
  const [quotaHealth, setQuotaHealth] = useState<StorageQuotaHealth | null>(null);
  const [vaultUnlocked, setVaultUnlocked] = useState<boolean>(isOfflineVaultUnlocked());
  const [hasPin, setHasPin] = useState<boolean>(false);

  const [isSyncing, setIsSyncing] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  // PIN management inline UI
  const [showPinForm, setShowPinForm] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [unlockPinInput, setUnlockPinInput] = useState('');

  // Portable .edunova-sync export/import
  const [exportPassphrase, setExportPassphrase] = useState('');
  const [importPassphrase, setImportPassphrase] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const formatBytes = (bytes: number, decimals = 2) => {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  };

  const refreshAll = useCallback(async () => {
    try {
      const [sum, list, quota, pinSet] = await Promise.all([
        getOfflineSyncSummary(user.school_id),
        listOfflineQueueEnvelopes(user.school_id),
        ensureStorageQuotaHealth(),
        hasOfflineVaultPin(user.id),
      ]);
      setSummary(sum);
      setEnvelopes(list);
      setQuotaHealth(quota);
      setHasPin(pinSet);
      setVaultUnlocked(isOfflineVaultUnlocked());
    } catch (err) {
      console.error('Erreur actualisation tableau hors-ligne:', err);
    }
  }, [user.id, user.school_id]);

  useEffect(() => {
    void ensureOfflineVaultUnlocked(user.id, user.school_id).then(() => refreshAll());
    const unsub = subscribeOfflineSyncState(() => {
      void refreshAll();
    }, user.school_id);
    return unsub;
  }, [user.id, user.school_id, refreshAll]);

  useEffect(() => {
    const currentDrafts: DraftItem[] = [];
    const currentCaches: { name: string; count: number; size: string }[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      try {
        if (key.startsWith('draft_student_')) {
          const parts = key.split('_');
          const id = parts[2];
          currentDrafts.push({
            key,
            type: 'Inscription Élève',
            id: id === 'new' ? 'Nouvelle' : id,
            timestamp: Date.now(),
          });
        }
        if (key === 'edunova_users_cache') {
          const data = JSON.parse(localStorage.getItem(key) || '[]');
          const size = new Blob([localStorage.getItem(key) || '']).size;
          currentCaches.push({ name: 'Utilisateurs', count: data.length, size: formatBytes(size) });
        }
        if (key === 'edunova_staff_cache') {
          const data = JSON.parse(localStorage.getItem(key) || '[]');
          const size = new Blob([localStorage.getItem(key) || '']).size;
          currentCaches.push({ name: 'Personnel', count: data.length, size: formatBytes(size) });
        }
        if (key.includes('school_logo_')) {
          const size = new Blob([localStorage.getItem(key) || '']).size;
          currentCaches.push({ name: 'Logo École', count: 1, size: formatBytes(size) });
        }
      } catch (e) {
        console.error('Erreur lors de la lecture du cache', e);
      }
    }

    setDrafts(currentDrafts);
    setCacheItems(currentCaches);
  }, []);

  const removeDraft = (key: string) => {
    localStorage.removeItem(key);
    setDrafts((prev) => prev.filter((d) => d.key !== key));
  };

  const handleManualSync = async () => {
    if (!isOnline) {
      toast.warning('Aucune connexion Internet détectée pour le moment.');
      return;
    }
    if (!vaultUnlocked) {
      toast.error('Déverrouillez d’abord votre coffre avec votre code PIN.');
      return;
    }
    setIsSyncing(true);
    try {
      const res = await flushOfflineSyncQueue({ schoolId: user.school_id, forceManual: true });
      await refreshAll();
      if (res.synced > 0) {
        toast.success(`${res.synced} opération(s) synchronisée(s) vers EduNova Cloud.`);
      } else if (res.conflicts > 0) {
        toast.warning(`${res.conflicts} conflit(s) détecté(s) : choisissez quelle version conserver.`);
      } else if (res.remaining === 0) {
        toast.info('Aucune opération en attente.');
      } else {
        toast.warning(`${res.remaining} opération(s) toujours en attente (vérifiez les erreurs ci-dessous).`);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Erreur lors de la synchronisation.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleResolveConflict = async (envelopeId: string, decision: 'KEEP_LOCAL' | 'KEEP_SERVER') => {
    if (decision === 'KEEP_LOCAL' && !isOnline) {
      toast.error('Une connexion Internet est requise pour pousser la correction vers le serveur.');
      return;
    }
    setResolvingId(envelopeId);
    try {
      await resolveGradesConflict(envelopeId, decision);
      await refreshAll();
      toast.success(
        decision === 'KEEP_LOCAL'
          ? 'Conflit résolu : votre saisie locale a été appliquée sur le serveur.'
          : 'Conflit résolu : la version serveur a été conservée.'
      );
    } catch (err: any) {
      toast.error(err?.message || 'Impossible de résoudre le conflit.');
    } finally {
      setResolvingId(null);
    }
  };

  const handleClearSynced = async () => {
    const count = await clearSyncedOfflineHistory(user.school_id);
    await refreshAll();
    if (count > 0) {
      toast.success(`${count} opération(s) déjà synchronisée(s) nettoyée(s) du stockage local.`);
    }
  };

  const handleSetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await setOfflineVaultPin(pinInput, user.id, user.school_id);
      setPinInput('');
      setShowPinForm(false);
      await refreshAll();
      toast.success('Code PIN hors-ligne activé pour protéger le coffre AES-256.');
    } catch (err: any) {
      toast.error(err?.message || 'PIN invalide.');
    }
  };

  const handleUnlockWithPin = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await unlockOfflineVaultWithPin(unlockPinInput, user.id, user.school_id);
    if (!ok) {
      toast.error('Code PIN incorrect.');
      return;
    }
    setUnlockPinInput('');
    await refreshAll();
    toast.success('Coffre local déverrouillé.');
    if (isOnline) {
      void flushOfflineSyncQueue({ schoolId: user.school_id, forceManual: true }).then(() => refreshAll());
    }
  };

  const handleLockVault = () => {
    lockOfflineVault();
    setVaultUnlocked(false);
    toast.info('Coffre hors-ligne verrouillé en mémoire.');
  };

  const handleExportBundle = async () => {
    setIsExporting(true);
    try {
      const bundle = await exportPendingOperationsBundle(user.school_id, exportPassphrase);
      const blob = new Blob([bundle.content], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = bundle.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExportPassphrase('');
      toast.success(`${bundle.count} opération(s) exportée(s) dans ${bundle.filename}.`);
    } catch (err: any) {
      toast.error(err?.message || 'Erreur lors de l’exportation.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportBundle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (importPassphrase.trim().length < 6) {
      toast.error('Saisissez d’abord la phrase secrète (6+ caractères) avant de sélectionner le fichier.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsImporting(true);
    try {
      const content = await file.text();
      const count = await importPortableOperationsBundle(content, importPassphrase, user.id, user.school_id);
      setImportPassphrase('');
      await refreshAll();
      toast.success(`${count} opération(s) importée(s) dans la file locale.`);
      if (isOnline) {
        const res = await flushOfflineSyncQueue({ schoolId: user.school_id, forceManual: true });
        await refreshAll();
        if (res.synced > 0) {
          toast.success(`${res.synced} opération(s) importée(s) envoyée(s) vers EduNova Cloud.`);
        }
      }
    } catch (err: any) {
      toast.error(err?.message || 'Fichier ou phrase secrète invalide.');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-5 pb-10">
      {/* En-tête Statut Réseau, Coffre AES-256 & Quota */}
      <div className="bg-slate-900 rounded-2xl p-4 sm:p-6 text-white relative overflow-hidden shadow-xl border border-slate-800">
        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
          {isOnline ? <Wifi size={120} /> : <WifiOff size={120} />}
        </div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                  !isOnline
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                    : isSlow
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                }`}
              >
                {!isOnline ? <WifiOff size={12} /> : <Wifi size={12} />}
                {!isOnline ? 'Mode Hors-ligne Actif' : isSlow ? `Connexion Faible (${latency || '?'}ms)` : 'Connecté au Cloud'}
              </span>

              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                  vaultUnlocked
                    ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                }`}
              >
                {vaultUnlocked ? <Unlock size={12} /> : <Lock size={12} />}
                {vaultUnlocked ? 'Coffre AES-256 Déverrouillé' : 'Coffre Verrouillé'}
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              Centre Hors-ligne &amp; Synchronisation Chiffrée
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm max-w-2xl leading-relaxed">
              Vos reçus de caisse et saisies de notes restent opérationnels sans électricité ni Internet grâce au coffre
              IndexedDB chiffré (AES-256-GCM) et au chaînage cryptographique SHA-256.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleManualSync}
              disabled={!isOnline || isSyncing || summary.isFlushing || !vaultUnlocked}
              className="h-9 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-45 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-indigo-950/40 transition-colors"
            >
              <CloudUpload size={15} className={isSyncing || summary.isFlushing ? 'animate-pulse' : ''} />
              <span>{isSyncing || summary.isFlushing ? 'Synchronisation...' : 'Synchroniser maintenant'}</span>
            </button>

            {summary.syncedCount > 0 && (
              <button
                type="button"
                onClick={handleClearSynced}
                className="h-9 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 flex items-center gap-1.5"
              >
                <Trash2 size={14} />
                <span>Purger ({summary.syncedCount})</span>
              </button>
            )}
          </div>
        </div>

        {/* Barre KPI & Quota */}
        <div className="relative z-10 mt-5 pt-4 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50">
            <div className="text-[11px] text-slate-400">En attente</div>
            <div className="text-lg font-bold font-mono text-white mt-0.5">{summary.pendingCount}</div>
            <div className="text-[10px] text-slate-400">
              {summary.receiptCount} reçu(s) • {summary.gradesBatchCount} lot(s)
            </div>
          </div>

          <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50">
            <div className="text-[11px] text-slate-400">Conflits Notes</div>
            <div className={`text-lg font-bold font-mono mt-0.5 ${summary.conflictCount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {summary.conflictCount}
            </div>
            <div className="text-[10px] text-slate-400">Arbitrage manuel</div>
          </div>

          <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50">
            <div className="text-[11px] text-slate-400">Synchronisés</div>
            <div className="text-lg font-bold font-mono text-emerald-400 mt-0.5">{summary.syncedCount}</div>
            <div className="text-[10px] text-slate-400">
              {summary.lastSyncedAtMs
                ? `Dernier : ${new Date(summary.lastSyncedAtMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                : 'Prêt pour replay'}
            </div>
          </div>

          <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Stockage Navigateur</span>
              <HardDrive size={12} />
            </div>
            <div className="text-sm font-bold font-mono text-white mt-1">
              {quotaHealth ? `${quotaHealth.usedMb} / ${quotaHealth.quotaMb} Mo` : 'Calcul...'}
            </div>
            <div className="text-[10px] text-slate-400">
              Persistance : {quotaHealth?.persisted ? 'Garantie (Android/PC)' : 'Standard'}
            </div>
          </div>
        </div>
      </div>

      {/* Contrôles Mode Léger & Sécurité PIN du Coffre */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Mode Léger Adaptatif */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 sm:p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <Zap size={16} />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-800">Mode Léger (Zone 2G / Batterie faible)</h2>
                <p className="text-[11px] text-slate-500">
                  Profil actuel : <span className="font-mono font-semibold uppercase text-slate-700">{profile}</span>{' '}
                  {isLightMode ? '• Animations et effets lourds désactivés' : '• Affichage complet'}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'auto' as const, label: 'Automatique', sub: 'Détecte 2G/Save-Data' },
              { id: 'on' as const, label: 'Mode Léger ON', sub: 'Économie maximale' },
              { id: 'off' as const, label: 'Standard', sub: 'Interface complète' },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setManualMode(opt.id)}
                className={`p-2.5 rounded-lg border text-left transition-colors ${
                  manualPref === opt.id
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-900'
                    : 'bg-slate-50/70 border-slate-200 text-slate-700 hover:border-slate-300'
                }`}
              >
                <div className="text-xs font-bold">{opt.label}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">{opt.sub}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Sécurité PIN du Coffre Local */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 sm:p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <KeyRound size={16} />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-800">Protection du Coffre (Poste Partagé)</h2>
                <p className="text-[11px] text-slate-500">
                  {hasPin
                    ? 'Code PIN configuré • Clé AES-256 effacée de la RAM au verrouillage.'
                    : 'Déverrouillage automatique par appareil (PIN optionnel recommandé sur PC partagé).'}
                </p>
              </div>
            </div>
          </div>

          {!vaultUnlocked ? (
            <form onSubmit={handleUnlockWithPin} className="flex items-center gap-2">
              <input
                type="password"
                value={unlockPinInput}
                onChange={(e) => setUnlockPinInput(e.target.value)}
                placeholder="Saisissez votre code PIN (4-12 car.)"
                className="flex-1 h-9 px-3 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                className="h-9 px-3.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5"
              >
                <Unlock size={13} />
                <span>Déverrouiller</span>
              </button>
            </form>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {!showPinForm ? (
                <>
                  <button
                    type="button"
                    onClick={() => setShowPinForm(true)}
                    className="h-8 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold flex items-center gap-1.5"
                  >
                    <KeyRound size={13} />
                    <span>{hasPin ? 'Changer mon code PIN' : 'Protéger par code PIN'}</span>
                  </button>
                  {hasPin && (
                    <button
                      type="button"
                      onClick={handleLockVault}
                      className="h-8 px-3 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-semibold flex items-center gap-1.5"
                    >
                      <Lock size={13} />
                      <span>Verrouiller maintenant</span>
                    </button>
                  )}
                </>
              ) : (
                <form onSubmit={handleSetPin} className="w-full flex items-center gap-2">
                  <input
                    type="password"
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value)}
                    placeholder="Nouveau PIN (4 à 12 caractères)"
                    className="flex-1 h-8 px-3 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="submit"
                    className="h-8 px-3 rounded-lg bg-indigo-600 text-white text-xs font-semibold"
                  >
                    Valider
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPinForm(false);
                      setPinInput('');
                    }}
                    className="h-8 px-2.5 rounded-lg bg-slate-100 text-slate-600 text-xs"
                  >
                    Annuler
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>

      {/* File d'Attente Chiffrée & Arbitrage de Conflits */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 sm:p-5 shadow-xs space-y-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <ShieldCheck size={16} />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-800">
                File d&apos;Attente Chiffrée (Reçus &amp; Notes)
              </h2>
              <p className="text-[11px] text-slate-500">
                Chaque opération est chiffrée (AES-256-GCM) et rejouée dans l&apos;ordre FIFO avec contrôle d&apos;idempotence.
              </p>
            </div>
          </div>
          <span className="bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full text-xs font-bold font-mono">
            {envelopes.length}
          </span>
        </div>

        {envelopes.length === 0 ? (
          <div className="text-center py-7 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
            <CheckCircle2 size={24} className="text-emerald-500 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-700">Toutes les opérations hors-ligne sont synchronisées.</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Lors d&apos;une coupure Internet, vos reçus et notes apparaîtront ici automatiquement.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {envelopes.map((item) => {
              const isReceipt = item.entityType === 'RECEIPT';
              const statusBadge =
                item.status === 'SYNCED'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : item.status === 'CONFLICT'
                    ? 'bg-amber-50 text-amber-800 border-amber-300'
                    : item.status === 'FAILED_PERMANENT'
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : item.status === 'SYNCING'
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : 'bg-slate-100 text-slate-700 border-slate-200';

              return (
                <div
                  key={item.id}
                  className="p-3 sm:p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-2.5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          isReceipt ? 'bg-teal-50 text-teal-600' : 'bg-blue-50 text-blue-600'
                        }`}
                      >
                        {isReceipt ? <Receipt size={15} /> : <BookOpen size={15} />}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs sm:text-sm font-bold text-slate-800 truncate">{item.label}</div>
                        <div className="text-[11px] text-slate-500 font-mono flex flex-wrap items-center gap-2 mt-0.5">
                          <span>{new Date(item.createdAtMs).toLocaleString('fr-FR')}</span>
                          <span>•</span>
                          <span>Tentatives : {item.attempts}</span>
                        </div>
                      </div>
                    </div>

                    <span className={`self-start sm:self-center text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusBadge}`}>
                      {item.status === 'SYNCED'
                        ? 'SYNCHRONISÉ'
                        : item.status === 'CONFLICT'
                          ? 'CONFLIT À ARBITRER'
                          : item.status === 'FAILED_PERMANENT'
                            ? 'ERREUR CRITIQUE'
                            : item.status === 'SYNCING'
                              ? 'ENVOI EN COURS'
                              : 'EN ATTENTE'}
                    </span>
                  </div>

                  {item.lastError && (
                    <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                      {item.lastError}
                    </div>
                  )}

                  {item.status === 'CONFLICT' && item.conflictDetails && item.conflictDetails.length > 0 && (
                    <div className="bg-white border border-amber-200 rounded-lg p-3 space-y-2.5">
                      <div className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                        <AlertTriangle size={14} className="text-amber-600" />
                        <span>Divergence détectée entre votre saisie locale et le cloud :</span>
                      </div>

                      <div className="space-y-1.5 max-h-44 overflow-y-auto">
                        {item.conflictDetails.map((c, idx) => (
                          <div
                            key={`${c.gradeId}-${idx}`}
                            className="flex flex-wrap items-center justify-between gap-2 text-xs bg-slate-50 px-2.5 py-1.5 rounded-md border border-slate-200"
                          >
                            <span className="font-semibold text-slate-700">
                              {c.studentName || 'Élève'} — {c.subjectName || 'Matière'}
                            </span>
                            <div className="font-mono text-[11px] flex items-center gap-2">
                              <span className="text-indigo-700 font-bold">Local : {c.localScore}</span>
                              <span className="text-slate-400">vs</span>
                              <span className="text-emerald-700 font-bold">Serveur : {c.serverScore}</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button
                          type="button"
                          disabled={resolvingId === item.id}
                          onClick={() => handleResolveConflict(item.id, 'KEEP_LOCAL')}
                          className="h-8 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold disabled:opacity-50"
                        >
                          Garder ma saisie locale
                        </button>
                        <button
                          type="button"
                          disabled={resolvingId === item.id}
                          onClick={() => handleResolveConflict(item.id, 'KEEP_SERVER')}
                          className="h-8 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold border border-slate-300 disabled:opacity-50"
                        >
                          Garder la version serveur
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Portage d'Urgence (.edunova-sync) pour zones isolées / panne électrique prolongée */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <RefreshCw size={16} />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-800">
              Portage d&apos;Urgence (.edunova-sync — Clé USB / WhatsApp)
            </h2>
            <p className="text-[11px] text-slate-500">
              En cas de coupure internet prolongée sur un site rural, exportez la file chiffrée sur clé USB et importez-la depuis un poste connecté.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2.5">
            <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Download size={14} className="text-indigo-600" />
              <span>Exporter la file en attente</span>
            </div>
            <input
              type="password"
              value={exportPassphrase}
              onChange={(e) => setExportPassphrase(e.target.value)}
              placeholder="Phrase secrète de transfert (6+ caractères)"
              className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="button"
              onClick={handleExportBundle}
              disabled={isExporting || (summary.pendingCount === 0 && summary.conflictCount === 0)}
              className="h-9 w-full rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-45 text-white text-xs font-semibold flex items-center justify-center gap-1.5"
            >
              <Download size={13} />
              <span>{isExporting ? 'Chiffrement...' : 'Télécharger .edunova-sync'}</span>
            </button>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2.5">
            <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Upload size={14} className="text-emerald-600" />
              <span>Importer depuis un autre appareil</span>
            </div>
            <input
              type="password"
              value={importPassphrase}
              onChange={(e) => setImportPassphrase(e.target.value)}
              placeholder="Phrase secrète utilisée lors de l’export"
              className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept=".edunova-sync,.json"
              onChange={handleImportBundle}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="h-9 w-full rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-45 text-white text-xs font-semibold flex items-center justify-center gap-1.5"
            >
              <Upload size={13} />
              <span>{isImporting ? 'Importation...' : 'Choisir un fichier .edunova-sync'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Brouillons & Données en Cache (Héritage LocalStorage préservé) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                <FileEdit size={16} />
              </div>
              <h2 className="text-sm sm:text-base font-bold text-slate-800">Brouillons Sauvegardés</h2>
            </div>
            <span className="bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full text-xs font-bold font-mono">
              {drafts.length}
            </span>
          </div>

          <div className="space-y-2">
            {drafts.length > 0 ? (
              drafts.map((draft, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:border-slate-300 transition-colors bg-slate-50/60"
                >
                  <div className="min-w-0 pr-2">
                    <h3 className="font-semibold text-slate-800 text-xs sm:text-sm truncate">{draft.type}</h3>
                    <p className="text-[11px] text-slate-500 font-mono mt-0.5 truncate">
                      ID: {draft.id} • Sauvegarde active
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => removeDraft(draft.key)}
                      className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-md transition-colors"
                      title="Supprimer ce brouillon"
                    >
                      <Trash2 size={14} />
                    </button>
                    {draft.id === 'Nouvelle' ? (
                      <Link
                        to="/eleves/ajouter"
                        className="h-7 px-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-1 text-[11px] font-semibold shadow-xs"
                      >
                        <span>Reprendre</span> <ArrowRight size={12} />
                      </Link>
                    ) : (
                      <Link
                        to={`/eleves/modifier/${draft.id}`}
                        className="h-7 px-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-1 text-[11px] font-semibold shadow-xs"
                      >
                        <span>Reprendre</span> <ArrowRight size={12} />
                      </Link>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-6">
                <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-2 text-slate-300">
                  <FileEdit size={18} />
                </div>
                <p className="text-slate-500 text-xs font-medium">Aucun brouillon en attente.</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                <Database size={16} />
              </div>
              <h2 className="text-sm sm:text-base font-bold text-slate-800">Données en Cache</h2>
            </div>
            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-[11px] font-medium">
              Dernière session
            </span>
          </div>

          <div className="space-y-2">
            {cacheItems.length > 0 ? (
              cacheItems.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50/60">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Database size={14} className="text-slate-400 shrink-0" />
                    <div className="min-w-0">
                      <h3 className="font-semibold text-slate-700 text-xs sm:text-sm truncate">{item.name}</h3>
                      <p className="text-[11px] text-slate-500 font-mono">{item.count} enregistrement(s)</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono text-slate-500 bg-white px-2 py-0.5 border border-slate-200 rounded-md shrink-0">
                    {item.size}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center py-6">
                <AlertTriangle size={20} className="text-amber-400 mx-auto mb-2" />
                <p className="text-slate-500 text-xs font-medium">Le cache local est actuellement vide.</p>
              </div>
            )}
          </div>

          <div className="mt-3.5 bg-blue-50/60 border border-blue-100 p-2.5 rounded-lg flex items-center gap-2.5">
            <RefreshCw size={14} className="text-blue-500 shrink-0" />
            <p className="text-[11px] text-blue-700 leading-snug font-medium">
              Synchronisation automatique vers EduNova Cloud dès le rétablissement de la connexion.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OfflineDashboard;
