import React, { useEffect, useState } from 'react';
import {
  WifiOff,
  ZapOff,
  Zap,
  ArrowRight,
  RotateCw,
  Minimize2,
  Maximize2,
  ShieldCheck,
  Activity,
  CloudUpload,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useAdaptiveLightMode } from '../hooks/useAdaptiveLightMode';
import {
  OfflineSyncSummary,
  flushOfflineSyncQueue,
  subscribeOfflineSyncState,
} from '../services/offlineSyncEngine';
import { Link } from 'react-router-dom';

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

const ConnectivityBanner: React.FC = () => {
  const { isOnline, isSlow, latency, lastChecked, isChecking, refreshStatus } = useOnlineStatus();
  const { isLightMode, manualPref, setManualMode } = useAdaptiveLightMode();
  const [isMinimized, setIsMinimized] = useState(false);
  const [syncSummary, setSyncSummary] = useState<OfflineSyncSummary>(EMPTY_SUMMARY);
  const [manualSyncing, setManualSyncing] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeOfflineSyncState((summary) => {
      setSyncSummary(summary);
    });
    return unsubscribe;
  }, []);

  const hasQueueAlerts =
    syncSummary.pendingCount > 0 || syncSummary.conflictCount > 0 || syncSummary.failedCount > 0;

  // Masquer uniquement si connexion normale, mode standard et aucune opération hors-ligne en attente/conflit
  if (isOnline && !isSlow && !isLightMode && !hasQueueAlerts) {
    return null;
  }

  const isOffline = !isOnline;
  const hasConflictOrError = syncSummary.conflictCount > 0 || syncSummary.failedCount > 0;

  const formattedTime = lastChecked
    ? lastChecked.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '';

  const handleManualSync = async () => {
    if (isOffline || manualSyncing || syncSummary.isFlushing) return;
    setManualSyncing(true);
    try {
      const res = await flushOfflineSyncQueue({ forceManual: true });
      if (res.synced > 0) {
        toast.success(`${res.synced} opération(s) synchronisée(s) vers EduNova Cloud.`);
      } else if (res.conflicts > 0) {
        toast.warning(`${res.conflicts} conflit(s) de notes nécessitent votre arbitrage.`);
      } else if (res.remaining > 0) {
        toast.info(`${res.remaining} opération(s) restent en attente.`);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Erreur lors de la synchronisation hors-ligne.');
    } finally {
      setManualSyncing(false);
    }
  };

  const handleToggleLightMode = () => {
    if (manualPref === 'on') {
      setManualMode('off');
      toast.info('Mode léger désactivé manuellement.');
    } else if (manualPref === 'off') {
      setManualMode('auto');
      toast.info('Mode léger repassé en détection automatique.');
    } else {
      setManualMode(isLightMode ? 'off' : 'on');
      toast.info(isLightMode ? 'Mode standard forcé.' : 'Mode léger activé (économie données & batterie).');
    }
  };

  const badgeCount = syncSummary.pendingCount + syncSummary.conflictCount + syncSummary.failedCount;

  const accentBorder = isOffline
    ? 'border-rose-500/40 shadow-rose-950/25'
    : hasConflictOrError
      ? 'border-amber-500/50 shadow-amber-950/30'
      : isSlow
        ? 'border-amber-500/35 shadow-amber-950/20'
        : syncSummary.pendingCount > 0
          ? 'border-indigo-500/40 shadow-indigo-950/25'
          : 'border-emerald-500/40 shadow-emerald-950/20';

  const topLineGradient = isOffline
    ? 'from-rose-500 via-red-500 to-pink-500'
    : hasConflictOrError || isSlow
      ? 'from-amber-400 via-orange-500 to-yellow-400'
      : syncSummary.pendingCount > 0
        ? 'from-indigo-400 via-blue-500 to-cyan-400'
        : 'from-emerald-400 via-teal-500 to-cyan-400';

  return (
    <div className="fixed bottom-3 right-3 sm:bottom-4 sm:right-4 z-[9999] pointer-events-auto print:hidden w-[calc(100vw-1.5rem)] sm:w-auto sm:max-w-md font-sans transition-all duration-300">
      {isMinimized ? (
        <div
          onClick={() => setIsMinimized(false)}
          className={`group flex items-center justify-between sm:justify-start gap-2.5 px-3 py-1.5 rounded-full cursor-pointer transition-all duration-200 shadow-xl backdrop-blur-xl border bg-slate-900/95 text-slate-100 ${accentBorder}`}
          title="Cliquer pour ouvrir le panneau de connectivité et synchronisation"
        >
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5 items-center justify-center">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  isOffline
                    ? 'bg-rose-400'
                    : hasConflictOrError || isSlow
                      ? 'bg-amber-400'
                      : syncSummary.pendingCount > 0
                        ? 'bg-indigo-400'
                        : 'bg-emerald-400'
                }`}
              />
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  isOffline
                    ? 'bg-rose-500'
                    : hasConflictOrError || isSlow
                      ? 'bg-amber-500'
                      : syncSummary.pendingCount > 0
                        ? 'bg-indigo-500'
                        : 'bg-emerald-500'
                }`}
              />
            </span>

            <div className="flex items-center gap-1.5 text-xs font-semibold tracking-tight">
              {isOffline ? (
                <>
                  <WifiOff size={13} className="text-rose-400" />
                  <span>Hors-ligne</span>
                </>
              ) : isSlow ? (
                <>
                  <ZapOff size={13} className="text-amber-400" />
                  <span>Réseau lent</span>
                  {latency && <span className="text-[10px] text-amber-300/80 font-mono">({latency}ms)</span>}
                </>
              ) : syncSummary.pendingCount > 0 ? (
                <>
                  <CloudUpload size={13} className="text-indigo-400" />
                  <span>Synchro en attente</span>
                </>
              ) : hasConflictOrError ? (
                <>
                  <AlertTriangle size={13} className="text-amber-400" />
                  <span>Conflits notes</span>
                </>
              ) : (
                <>
                  <Zap size={13} className="text-emerald-400" />
                  <span>Mode Léger</span>
                </>
              )}

              {badgeCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold font-mono rounded-full bg-white/15 text-white">
                  {badgeCount}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 pl-1 border-l border-white/10">
            <Maximize2 size={11} className="group-hover:text-white transition-colors" />
          </div>
        </div>
      ) : (
        <div
          className={`relative overflow-hidden rounded-xl bg-slate-900/95 backdrop-blur-xl border text-slate-100 shadow-[0_12px_36px_rgba(0,0,0,0.45)] transition-all duration-200 ${accentBorder}`}
        >
          <div className={`h-0.5 w-full bg-gradient-to-r ${topLineGradient}`} />

          <div className="p-3 sm:p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`relative w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${
                    isOffline
                      ? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                      : hasConflictOrError || isSlow
                        ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                        : syncSummary.pendingCount > 0
                          ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400'
                          : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                  }`}
                >
                  {isOffline ? (
                    <WifiOff size={16} />
                  ) : hasConflictOrError ? (
                    <AlertTriangle size={16} />
                  ) : syncSummary.pendingCount > 0 ? (
                    <CloudUpload size={16} />
                  ) : isSlow ? (
                    <ZapOff size={16} />
                  ) : (
                    <Zap size={16} />
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h4 className="text-xs sm:text-sm font-bold text-white tracking-tight truncate">
                      {isOffline
                        ? 'Mode Local (Hors-ligne)'
                        : hasConflictOrError
                          ? 'Arbitrage Requis'
                          : syncSummary.pendingCount > 0
                            ? 'File Chiffrée en Attente'
                            : isSlow
                              ? 'Connexion Faible'
                              : 'Mode Léger Actif'}
                    </h4>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border tracking-wide uppercase shrink-0 ${
                        isOffline
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                          : hasConflictOrError || isSlow
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : syncSummary.pendingCount > 0
                              ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                              : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      }`}
                    >
                      {isOffline
                        ? 'HORS-LIGNE'
                        : isLightMode
                          ? 'MODE LÉGER'
                          : isSlow
                            ? 'INSTABLE'
                            : 'SYNCHRO'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 font-normal truncate mt-0.5">
                    {hasQueueAlerts
                      ? `${syncSummary.receiptCount} reçu(s) • ${syncSummary.gradesBatchCount} lot(s) de notes${
                          syncSummary.conflictCount > 0 ? ` • ${syncSummary.conflictCount} conflit(s)` : ''
                        }`
                      : isOffline
                        ? 'Saisie de notes & reçus chiffrés localement (AES-256)'
                        : isSlow
                          ? 'Latence élevée • Compression & mode léger recommandés'
                          : 'Animations et requêtes allégées pour économiser la data'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsMinimized(true)}
                className="text-slate-400 hover:text-white p-1 hover:bg-white/10 rounded-md transition-colors shrink-0"
                title="Réduire l'indicateur"
              >
                <Minimize2 size={14} />
              </button>
            </div>

            <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium font-mono">
                <Activity
                  size={11}
                  className={isOffline ? 'text-rose-400/80' : isSlow ? 'text-amber-400/80' : 'text-emerald-400/80'}
                />
                <span>{formattedTime ? `${formattedTime}` : 'Actif'}</span>
                {latency && isSlow && <span className="text-amber-400 font-mono">• {latency}ms</span>}
              </div>

              <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                <button
                  type="button"
                  onClick={handleToggleLightMode}
                  className={`h-7 px-2 rounded-lg transition-all border flex items-center gap-1 text-[11px] font-medium ${
                    isLightMode
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30'
                      : 'bg-slate-800/90 border-slate-700/80 text-slate-300 hover:text-white'
                  }`}
                  title="Basculer le Mode Léger (2G/batterie faible)"
                >
                  <Zap size={11} />
                  <span>{isLightMode ? 'Léger ON' : 'Léger'}</span>
                </button>

                {!isOffline && syncSummary.pendingCount > 0 && (
                  <button
                    type="button"
                    onClick={handleManualSync}
                    disabled={manualSyncing || syncSummary.isFlushing}
                    className="h-7 px-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-[11px] transition-all border border-indigo-400/30 disabled:opacity-50 flex items-center gap-1"
                    title="Synchroniser immédiatement les opérations en attente"
                  >
                    <CloudUpload
                      size={12}
                      className={manualSyncing || syncSummary.isFlushing ? 'animate-pulse' : ''}
                    />
                    <span>{manualSyncing || syncSummary.isFlushing ? 'Envoi...' : 'Synchroniser'}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={refreshStatus}
                  disabled={isChecking}
                  className="h-7 px-2 rounded-lg bg-slate-800/90 hover:bg-slate-700/90 text-slate-300 hover:text-white transition-all border border-slate-700/80 disabled:opacity-50 flex items-center gap-1 text-[11px] font-medium"
                  title="Tester l'état de la connexion réseau"
                >
                  <RotateCw size={12} className={isChecking ? 'animate-spin text-indigo-400' : ''} />
                  <span>{isChecking ? '...' : 'Tester'}</span>
                </button>

                {(isOffline || hasQueueAlerts) && (
                  <Link
                    to="/offline"
                    className={`h-7 px-2.5 rounded-lg text-white font-semibold text-[11px] shadow-sm transition-all flex items-center gap-1 border ${
                      hasConflictOrError
                        ? 'bg-amber-600 hover:bg-amber-500 border-amber-400/30'
                        : 'bg-rose-600 hover:bg-rose-500 border-rose-400/30'
                    }`}
                  >
                    <ShieldCheck size={12} />
                    <span>Coffre</span>
                    <ArrowRight size={11} />
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConnectivityBanner;
