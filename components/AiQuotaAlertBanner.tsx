import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  AlertTriangle, 
  AlertOctagon, 
  Sparkles, 
  X, 
  ArrowRight, 
  Activity, 
  ShieldAlert, 
  RefreshCw, 
  Database, 
  Zap,
  Check,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { aiCreditTrackingService, AiQuotaSummary } from '../services/aiCreditTrackingService';
import { UserProfile } from '../types';

interface AiQuotaAlertBannerProps {
  user: UserProfile;
}

export const AiQuotaAlertBanner: React.FC<AiQuotaAlertBannerProps> = ({ user }) => {
  const navigate = useNavigate();
  const [quota, setQuota] = useState<AiQuotaSummary | null>(null);
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const toastTriggeredRef = useRef<{ eighty: boolean; ninetyFive: boolean }>({ eighty: false, ninetyFive: false });

  const isSuperAdmin = user.is_super_admin || user.role === 'SUPER_ADMIN' || user.role === 'SCHOOL_ADMIN' || user.role === 'DIRECTOR';

  const checkQuota = useCallback(async () => {
    try {
      const data = await aiCreditTrackingService.getQuotaUsage(user.school_id || 'default-school');
      setQuota(data);

      // Déclencher un toast proactif si le seuil est franchi (une fois par niveau)
      if (data.usagePercent >= 95 && !toastTriggeredRef.current.ninetyFive) {
        toastTriggeredRef.current.ninetyFive = true;
        toast.error(`🚨 Quota IA Critique (95%) : ${data.requestsUsed}/${data.requestsLimit} requêtes utilisées.`, {
          description: "Le plafond de requêtes Google AI Studio est presque atteint. Optimisez vos requêtes ou vérifiez le cache.",
          duration: 8000,
          action: {
            label: "Détails Quota",
            onClick: () => navigate('/super-admin/system-health')
          }
        });
      } else if (data.usagePercent >= 80 && data.usagePercent < 95 && !toastTriggeredRef.current.eighty) {
        toastTriggeredRef.current.eighty = true;
        toast.warning(`⚠️ Seuil Quota IA (80%) : ${data.requestsUsed}/${data.requestsLimit} requêtes utilisées.`, {
          description: "Le palier d'alerte de 80% est atteint. La mise en cache locale protège vos crédits.",
          duration: 6000,
          action: {
            label: "Voir Santé IA",
            onClick: () => navigate('/super-admin/system-health')
          }
        });
      }
    } catch (e) {
      // Ignorer silencieusement
    }
  }, [user.school_id, navigate]);

  useEffect(() => {
    // Vérification initiale
    checkQuota();

    // Écouter les mises à jour en temps réel émises par le service de tracking
    const handleQuotaUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<AiQuotaSummary>;
      if (customEvent.detail) {
        setQuota(customEvent.detail);
      } else {
        checkQuota();
      }
    };

    window.addEventListener('edunova-ai-quota-updated', handleQuotaUpdated);

    // Polling toutes les 30 secondes
    const interval = setInterval(checkQuota, 30000);

    return () => {
      window.removeEventListener('edunova-ai-quota-updated', handleQuotaUpdated);
      clearInterval(interval);
    };
  }, [checkQuota]);

  // Si l'utilisateur n'a pas les droits d'administration ou pas de données
  if (!isSuperAdmin || !quota) {
    return null;
  }

  // Ne rien afficher si le quota est inférieur à 80%
  const isCritical = quota.usagePercent >= 95;
  const isWarning = quota.usagePercent >= 80 && quota.usagePercent < 95;

  if (!isCritical && !isWarning) {
    return null;
  }

  // Vérifier si cette alerte a été masquée pour la session
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
      const updated = await aiCreditTrackingService.simulateQuotaLevel(user.school_id || 'default-school', percent);
      setQuota(updated);
      toast.success(`Simulation appliquée : Quota IA réglé à ${percent}% (${updated.requestsUsed}/${updated.requestsLimit} req)`);
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
            ? 'bg-gradient-to-r from-rose-900 via-rose-800 to-red-900 text-white border-rose-600 shadow-rose-950/20'
            : 'bg-gradient-to-r from-amber-900 via-amber-800 to-orange-900 text-white border-amber-500 shadow-amber-950/20'
        }`}
      >
        {/* Subtle background glow */}
        <div className={`absolute -right-10 -bottom-10 w-48 h-48 rounded-full blur-3xl opacity-20 pointer-events-none ${
          isCritical ? 'bg-rose-400' : 'bg-amber-400'
        }`} />

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          {/* LEFT: ICON + MESSAGE */}
          <div className="flex items-start gap-3.5 max-w-3xl">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
              isCritical 
                ? 'bg-rose-500/30 text-rose-200 border border-rose-400/40 animate-pulse' 
                : 'bg-amber-500/30 text-amber-200 border border-amber-400/40'
            }`}>
              {isCritical ? <AlertOctagon size={22} /> : <AlertTriangle size={22} />}
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase font-mono border ${
                  isCritical 
                    ? 'bg-rose-500 text-white border-rose-300' 
                    : 'bg-amber-400 text-amber-950 border-amber-300'
                }`}>
                  {isCritical ? '🚨 ALERTE CRITIQUE 95%' : '⚠️ SEUIL DE PRÉVENTION 80%'}
                </span>

                <span className="text-xs font-bold text-white/90">
                  {isCritical ? 'Plafond IA Bientôt Saturé' : 'Consommation Élevée des Quotas IA'}
                </span>

                <span className="text-[11px] font-mono text-white/80 bg-black/30 px-2 py-0.5 rounded-md">
                  {quota.requestsUsed.toLocaleString('fr-FR')} / {quota.requestsLimit.toLocaleString('fr-FR')} req ({quota.usagePercent}%)
                </span>
              </div>

              <p className="text-xs text-white/90 leading-relaxed">
                {isCritical ? (
                  <>
                    <strong>Attention Super Administrateur :</strong> Vous avez consommé <strong>{quota.usagePercent}%</strong> de vos requêtes quotidiennes gratuites (<strong>{quota.requestsRemaining} requêtes restantes</strong>). Pour éviter toute interruption de service, activez la mise en cache ou inspectez les modules IA.
                  </>
                ) : (
                  <>
                    <strong>Notification Super Admin :</strong> Le palier de <strong>80%</strong> d'utilisation de l'IA a été atteint aujourd'hui. Vos réponses récurrentes sont protégées par le cache local (<strong>{quota.savedPercent}% d'économie</strong>).
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
                  ? 'bg-white text-rose-900 hover:bg-rose-50 hover:shadow-md'
                  : 'bg-white text-amber-950 hover:bg-amber-50 hover:shadow-md'
              }`}
            >
              <Activity size={14} />
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

        {/* PROGRESS BAR STRIP AT BOTTOM OF BANNER */}
        <div className="mt-3 pt-3 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-white/80 font-mono">
          <div className="flex items-center gap-3">
            <span>Solde restant : <strong className="text-white">{quota.requestsRemaining.toLocaleString('fr-FR')} req</strong></span>
            <span>•</span>
            <span>Cache local : <strong className="text-emerald-300">{quota.cacheHits} requêtes interceptées (0 crédit)</strong></span>
          </div>

          {/* Quick simulation pills in dev for Super Admin testing */}
          <div className="flex items-center gap-1.5 text-[10px]">
            <span className="text-white/60">Test Dev :</span>
            <button
              onClick={() => handleQuickSimulate(80)}
              disabled={isSimulating}
              className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-amber-200 transition-colors cursor-pointer disabled:opacity-50"
            >
              80%
            </button>
            <button
              onClick={() => handleQuickSimulate(95)}
              disabled={isSimulating}
              className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-rose-200 transition-colors cursor-pointer disabled:opacity-50"
            >
              95%
            </button>
            <button
              onClick={() => handleQuickSimulate(15)}
              disabled={isSimulating}
              className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-emerald-200 transition-colors cursor-pointer disabled:opacity-50"
            >
              Reset 15%
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
