import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  AlertTriangle, 
  AlertOctagon, 
  Sparkles, 
  X, 
  Activity, 
  ShieldAlert, 
  RefreshCw, 
  Database, 
  Zap,
  Check,
  ChevronRight,
  Bell,
  Volume2,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { aiCreditTrackingService, AiQuotaSummary } from '../services/aiCreditTrackingService';
import { UserProfile, UserRole } from '../types';

interface AiQuotaAlertBannerProps {
  user: UserProfile;
}

export const AiQuotaAlertBanner: React.FC<AiQuotaAlertBannerProps> = ({ user }) => {
  const navigate = useNavigate();
  const [quota, setQuota] = useState<AiQuotaSummary | null>(null);
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const toastTriggeredRef = useRef<{ eighty: boolean; ninetyFive: boolean }>({ eighty: false, ninetyFive: false });

  // Vérifier strictement si l'utilisateur est Super Administrateur
  const roleStr = String(user?.role || '');
  const isSuperAdmin = Boolean(
    user?.is_super_admin || 
    roleStr === 'SUPER_ADMIN' || 
    user?.role === UserRole.SUPER_ADMIN
  );

  // Joue un signal sonore discret (Web Audio API synthétique) pour avertir l'administrateur
  const playAlertSound = useCallback((type: 'warning' | 'critical') => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'critical') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.25);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      } else {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.2); // G5
        gain.gain.setValueAtTime(0.06, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
        osc.start();
        osc.stop(ctx.currentTime + 0.28);
      }
    } catch (e) {
      // Non bloquant si l'audio n'est pas autorisé par l'utilisateur
    }
  }, []);

  // Déclenche une notification système navigateur (si la permission est accordée)
  const sendSystemNotification = useCallback((title: string, body: string) => {
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, {
          body,
          icon: '/favicon.ico',
          badge: '/favicon.ico'
        });
      }
    } catch (e) {
      // Silencieux si indisponible en iframe
    }
  }, []);

  const triggerProactiveNotification = useCallback((data: AiQuotaSummary) => {
    if (data.usagePercent >= 95) {
      if (!toastTriggeredRef.current.ninetyFive) {
        toastTriggeredRef.current.ninetyFive = true;
        playAlertSound('critical');
        sendSystemNotification(
          '🚨 Alerte Critique Quota IA (95%)',
          `Le quota IA a atteint ${data.usagePercent}% (${data.requestsUsed}/${data.requestsLimit} req). Le plafond est presque saturé.`
        );
        toast.error(`🚨 ALERTE CRITIQUE : Quota IA saturé à ${data.usagePercent}% (${data.requestsUsed}/${data.requestsLimit} req)`, {
          description: "Le plafond quotidien de requêtes gratuites Google AI Studio (1 500 RPD) est presque atteint. Activez le mode cache pour éviter tout blocage.",
          duration: 9000,
          action: {
            label: "Console Santé & Quotas",
            onClick: () => navigate('/super-admin/system-health')
          }
        });
      }
    } else if (data.usagePercent >= 80) {
      if (!toastTriggeredRef.current.eighty) {
        toastTriggeredRef.current.eighty = true;
        playAlertSound('warning');
        sendSystemNotification(
          '⚠️ Seuil d’alerte Quota IA (80%)',
          `Le quota IA a atteint ${data.usagePercent}% (${data.requestsUsed}/${data.requestsLimit} req). Mode économique recommandé.`
        );
        toast.warning(`⚠️ ATTENTION : Quota IA à ${data.usagePercent}% (${data.requestsUsed}/${data.requestsLimit} req)`, {
          description: "Le palier de vigilance de 80% est franchi. Les requêtes récurrentes continuent d'être accélérées par le cache mémoire.",
          duration: 7000,
          action: {
            label: "Voir Diagnostic",
            onClick: () => navigate('/super-admin/system-health')
          }
        });
      }
    } else {
      // Réinitialiser les déclencheurs si le niveau repasse sous 80% (ex: reset ou nouveau jour)
      toastTriggeredRef.current.eighty = false;
      toastTriggeredRef.current.ninetyFive = false;
    }
  }, [navigate, playAlertSound, sendSystemNotification]);

  const checkQuota = useCallback(async () => {
    if (!isSuperAdmin) return;
    try {
      const data = await aiCreditTrackingService.getQuotaUsage(user.school_id || 'default-school');
      setQuota(data);
      triggerProactiveNotification(data);
    } catch (e) {
      // Ignorer silencieusement
    }
  }, [user.school_id, isSuperAdmin, triggerProactiveNotification]);

  useEffect(() => {
    checkQuota();

    // Demander poliment la permission de notification si Super Admin
    if (isSuperAdmin && 'Notification' in window && Notification.permission === 'default') {
      try {
        Notification.requestPermission().catch(() => {});
      } catch (e) {}
    }

    // Écouter les mises à jour émises par le service après chaque appel IA
    const handleQuotaUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<AiQuotaSummary>;
      if (customEvent.detail) {
        setQuota(customEvent.detail);
        triggerProactiveNotification(customEvent.detail);
      } else {
        checkQuota();
      }
    };

    window.addEventListener('edunova-ai-quota-updated', handleQuotaUpdated);

    // Polling toutes les 25 secondes
    const interval = setInterval(checkQuota, 25000);

    return () => {
      window.removeEventListener('edunova-ai-quota-updated', handleQuotaUpdated);
      clearInterval(interval);
    };
  }, [checkQuota, triggerProactiveNotification, isSuperAdmin]);

  // Si l'utilisateur n'a pas les droits Super Administrateur ou pas de données
  if (!isSuperAdmin || !quota) {
    return null;
  }

  // Ne rien afficher dans la bannière si le quota est inférieur à 80%
  const isCritical = quota.usagePercent >= 95;
  const isWarning = quota.usagePercent >= 80 && quota.usagePercent < 95;

  if (!isCritical && !isWarning) {
    return null;
  }

  // Vérifier si cette alerte a été masquée pour la session en cours
  const currentAlertId = `${quota.periodDate}_${isCritical ? '95' : '80'}`;
  if (dismissedKey === currentAlertId) {
    return null;
  }

  const handleDismiss = () => {
    setDismissedKey(currentAlertId);
    toast.info("Alerte de quota masquée pour cette session.");
  };

  const handleQuickSimulate = async (percent: number) => {
    setIsSimulating(true);
    try {
      // Réinitialiser les verrous de toast pour déclencher la notification immédiate du test
      if (percent >= 95) toastTriggeredRef.current.ninetyFive = false;
      if (percent >= 80) toastTriggeredRef.current.eighty = false;

      const updated = await aiCreditTrackingService.simulateQuotaLevel(user.school_id || 'default-school', percent);
      setQuota(updated);
      triggerProactiveNotification(updated);
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        id="ai-quota-alert-banner"
        initial={{ opacity: 0, y: -15, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -15, scale: 0.98 }}
        transition={{ duration: 0.3 }}
        className={`mb-6 rounded-2xl border p-4 sm:p-5 shadow-md relative overflow-hidden transition-all ${
          isCritical
            ? 'bg-gradient-to-r from-rose-950 via-rose-900 to-red-950 text-white border-rose-600 shadow-rose-950/30'
            : 'bg-gradient-to-r from-amber-950 via-amber-900 to-orange-950 text-white border-amber-500 shadow-amber-950/30'
        }`}
      >
        {/* Subtle background glow effect */}
        <div className={`absolute -right-10 -bottom-10 w-56 h-56 rounded-full blur-3xl opacity-25 pointer-events-none ${
          isCritical ? 'bg-rose-500' : 'bg-amber-400'
        }`} />

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          {/* LEFT: ICON + MESSAGE */}
          <div className="flex items-start gap-3.5 max-w-3xl">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${
              isCritical 
                ? 'bg-rose-500/30 text-rose-200 border border-rose-400/40 animate-pulse' 
                : 'bg-amber-500/30 text-amber-200 border border-amber-400/40'
            }`}>
              {isCritical ? <AlertOctagon size={24} /> : <AlertTriangle size={24} />}
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase font-mono border ${
                  isCritical 
                    ? 'bg-rose-500 text-white border-rose-300 shadow-xs shadow-rose-900' 
                    : 'bg-amber-400 text-amber-950 border-amber-300 shadow-xs shadow-amber-950'
                }`}>
                  {isCritical ? '🚨 ALERTE CRITIQUE 95%' : '⚠️ SEUIL DE PRÉVENTION 80%'}
                </span>

                <span className="text-xs font-bold text-white/95">
                  {isCritical ? 'Plafond IA Bientôt Atteint' : 'Consommation Élevée du Quota IA'}
                </span>

                <span className="text-[11px] font-mono text-white/90 bg-black/40 px-2.5 py-0.5 rounded-md border border-white/10">
                  {quota.requestsUsed.toLocaleString('fr-FR')} / {quota.requestsLimit.toLocaleString('fr-FR')} req ({quota.usagePercent}%)
                </span>
              </div>

              <p className="text-xs text-white/90 leading-relaxed">
                {isCritical ? (
                  <>
                    <strong>Avertissement Super Administrateur :</strong> Vous avez atteint <strong>{quota.usagePercent}%</strong> de vos requêtes quotidiennes (reste <strong>{quota.requestsRemaining} requêtes</strong>). Pour maintenir une continuité de service totale, privilégiez le cache local ou préparez le basculement d'environnement si nécessaire.
                  </>
                ) : (
                  <>
                    <strong>Notification Super Admin :</strong> Le palier d'alerte de <strong>80%</strong> est franchi aujourd'hui. Vos requêtes fréquentes sont allégées grâce au moteur de cache local (<strong>{quota.savedPercent}% d'économie globale</strong>).
                  </>
                )}
              </p>
            </div>
          </div>

          {/* RIGHT: ACTION BUTTONS & DISMISS */}
          <div className="flex items-center gap-2.5 self-end md:self-center shrink-0">
            <button
              onClick={() => navigate('/super-admin/system-health')}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-98 ${
                isCritical
                  ? 'bg-white text-rose-950 hover:bg-rose-50 hover:shadow-md'
                  : 'bg-white text-amber-950 hover:bg-amber-50 hover:shadow-md'
              }`}
            >
              <Activity size={15} />
              <span>Console Santé & Quotas</span>
              <ChevronRight size={14} />
            </button>

            <button
              onClick={handleDismiss}
              className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
              title="Masquer l'alerte pour cette session"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* PROGRESS BAR STRIP & SIMULATION TOOLBAR */}
        <div className="mt-3.5 pt-3 border-t border-white/15 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-[11px] text-white/80 font-mono">
          <div className="flex items-center gap-3">
            <span>Solde restant : <strong className="text-white">{quota.requestsRemaining.toLocaleString('fr-FR')} req</strong></span>
            <span>•</span>
            <span>Cache local : <strong className="text-emerald-300">{quota.cacheHits} req interceptées (0 coût)</strong></span>
          </div>

          {/* Quick simulation controls for testing notifications */}
          <div className="flex items-center gap-1.5 text-[10px]">
            <span className="text-white/60">Tester les alertes :</span>
            <button
              onClick={() => handleQuickSimulate(80)}
              disabled={isSimulating}
              className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-amber-200 border border-amber-400/30 transition-colors cursor-pointer disabled:opacity-50 font-bold"
              title="Simuler 80% du quota pour tester l'alerte d'avertissement"
            >
              Simuler 80%
            </button>
            <button
              onClick={() => handleQuickSimulate(95)}
              disabled={isSimulating}
              className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-rose-200 border border-rose-400/30 transition-colors cursor-pointer disabled:opacity-50 font-bold"
              title="Simuler 95% du quota pour tester l'alerte critique"
            >
              Simuler 95%
            </button>
            <button
              onClick={() => handleQuickSimulate(12)}
              disabled={isSimulating}
              className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-emerald-200 border border-emerald-400/30 transition-colors cursor-pointer disabled:opacity-50"
              title="Réinitialiser le quota au niveau normal"
            >
              Normal (12%)
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

