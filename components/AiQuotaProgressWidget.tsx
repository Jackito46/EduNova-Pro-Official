import React, { useState, useEffect, useCallback } from 'react';
import { 
  Sparkles, 
  RefreshCw, 
  Database, 
  ShieldCheck, 
  Zap, 
  HardDrive, 
  Activity, 
  CheckCircle2, 
  AlertTriangle, 
  Copy, 
  Check, 
  Layers, 
  Cpu, 
  Info,
  Clock,
  ArrowUpRight
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { aiCreditTrackingService, AiQuotaSummary } from '../services/aiCreditTrackingService';

interface AiQuotaProgressWidgetProps {
  schoolId?: string;
  variant?: 'compact' | 'full';
  onNavigateToFull?: () => void;
}

export const AiQuotaProgressWidget: React.FC<AiQuotaProgressWidgetProps> = ({
  schoolId = 'default-school',
  variant = 'full',
  onNavigateToFull
}) => {
  const [loading, setLoading] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [quota, setQuota] = useState<AiQuotaSummary | null>(null);

  const fetchQuota = useCallback(async (showToast = false) => {
    setLoading(true);
    try {
      const data = await aiCreditTrackingService.getQuotaUsage(schoolId);
      setQuota(data);
      if (showToast) {
        toast.success(`Quotas synchronisés (${data.requestsRemaining.toLocaleString('fr-FR')} requêtes restantes)`);
      }
    } catch (e) {
      console.error("Error fetching AI quota:", e);
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    fetchQuota();
    // Rafraîchissement automatique toutes les 60 secondes
    const interval = setInterval(() => fetchQuota(), 60000);
    return () => clearInterval(interval);
  }, [fetchQuota]);

  const handleCopySql = () => {
    const sql = aiCreditTrackingService.getSupabaseTableSql();
    navigator.clipboard.writeText(sql);
    setCopiedSql(true);
    toast.success("Script SQL de la table 'ai_credits_usage' copié !");
    setTimeout(() => setCopiedSql(false), 2500);
  };

  if (!quota) {
    return (
      <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-center gap-3">
        <RefreshCw size={18} className="animate-spin text-purple-600" />
        <span className="text-xs font-bold text-slate-600">Chargement des quotas d'IA Supabase...</span>
      </div>
    );
  }

  // Calculs pour la jauge circulaire SVG
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  // Stroke offset : 0 = 0% plein, circumference = 100% plein
  const strokeDashoffset = circumference - (quota.usagePercent / 100) * circumference;

  // Détermination de la couleur selon le niveau de consommation
  const getStatusColor = (percent: number) => {
    if (percent >= 90) return { bg: 'bg-rose-500', text: 'text-rose-600', ring: '#f43f5e', border: 'border-rose-200', lightBg: 'bg-rose-50' };
    if (percent >= 75) return { bg: 'bg-amber-500', text: 'text-amber-600', ring: '#f59e0b', border: 'border-amber-200', lightBg: 'bg-amber-50' };
    return { bg: 'bg-emerald-500', text: 'text-emerald-600', ring: '#10b981', border: 'border-emerald-200', lightBg: 'bg-emerald-50' };
  };

  const statusTheme = getStatusColor(quota.usagePercent);

  // -------------------------------------------------------------
  // VARIANT COMPACT (Pour affichage rapide sur la page de paramètres)
  // -------------------------------------------------------------
  if (variant === 'compact') {
    return (
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs hover:border-purple-300 transition-all">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100">
              <Sparkles size={18} />
            </div>
            <div>
              <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                Quotas d'Intelligence Artificielle
              </h4>
              <p className="text-[11px] text-slate-500 font-medium">
                Suivi Supabase • {quota.tierName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black font-mono uppercase ${statusTheme.lightBg} ${statusTheme.text} border ${statusTheme.border}`}>
              {quota.requestsRemaining.toLocaleString('fr-FR')} / {quota.requestsLimit.toLocaleString('fr-FR')} dispo
            </span>
            {onNavigateToFull && (
              <button
                onClick={onNavigateToFull}
                className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors cursor-pointer"
                title="Voir les détails complets"
              >
                <ArrowUpRight size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Barre de progression linéaire */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-[11px] font-mono">
            <span className="text-slate-600">
              Consommé : <strong className="text-slate-900">{quota.requestsUsed} req ({quota.usagePercent}%)</strong>
            </span>
            <span className="text-emerald-600 font-bold">
              Restant : {quota.requestsRemaining} req
            </span>
          </div>

          <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200/80 flex gap-0.5">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(2, quota.usagePercent)}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className={`h-full rounded-full ${statusTheme.bg}`}
            />
          </div>
        </div>

        <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
          <div className="flex items-center gap-1.5">
            <Database size={11} className="text-emerald-600" />
            <span>Table Supabase : <strong className="text-slate-700 font-mono">ai_credits_usage</strong></span>
          </div>
          <span className="font-mono">{quota.savedPercent}% requêtes épargnées</span>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VARIANT FULL (Vue Détaillée & Jauges Circulaires pour l'onglet Quotas IA)
  // -------------------------------------------------------------
  return (
    <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xs">
      {/* HEADER WITH SYNC BADGE & REFRESH */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-purple-500/20">
            <Sparkles size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                Consommation & Plafonds d'Intelligence Artificielle
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200 font-mono">
                Supabase Synced
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Supervision télémétrique continue et contrôle des plafonds de requêtes ({quota.tierName})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => fetchQuota(true)}
            disabled={loading}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 active:scale-98 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 min-h-[38px]"
            title="Rafraîchir les métriques"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin text-purple-600' : ''} />
            <span>Synchroniser</span>
          </button>

          <button
            onClick={handleCopySql}
            className="px-3.5 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200/80 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer min-h-[38px]"
            title="Copier le script SQL de la table Supabase"
          >
            {copiedSql ? <Check size={14} className="text-emerald-600" /> : <Copy size={13} />}
            <span>{copiedSql ? 'SQL Copié !' : 'Script Supabase'}</span>
          </button>
        </div>
      </div>

      {/* MAIN VISUAL SECTION: CIRCULAR GAUGE + PROGRESS METRICS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* CIRCULAR GAUGE (4 COLS) */}
        <div className="lg:col-span-4 flex flex-col items-center justify-center p-6 bg-slate-50/80 border border-slate-200/80 rounded-2xl relative overflow-hidden text-center">
          <div className="relative w-36 h-36 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              {/* Background circle track */}
              <circle
                cx="50"
                cy="50"
                r={radius}
                className="text-slate-200 stroke-current"
                strokeWidth="8"
                fill="transparent"
              />
              {/* Animated Progress Circle */}
              <circle
                cx="50"
                cy="50"
                r={radius}
                stroke={statusTheme.ring}
                strokeWidth="8"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
                style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
              />
            </svg>

            {/* Inner Content */}
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-2xl font-black text-slate-900 font-mono tracking-tight">
                {quota.usagePercent}%
              </span>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Consommé
              </span>
            </div>
          </div>

          <div className="mt-4 space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold font-mono bg-white border border-slate-200 text-slate-800 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>{quota.requestsRemaining.toLocaleString('fr-FR')} requêtes restantes</span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium">
              Plafond quotidien : {quota.requestsLimit.toLocaleString('fr-FR')} req/jour
            </p>
          </div>
        </div>

        {/* LINEAR BARS & DETAILED RATIOS (8 COLS) */}
        <div className="lg:col-span-8 space-y-5">
          {/* BAR 1: REQUÊTES QUOTIDIENNES (RPD) */}
          <div className="space-y-2 bg-slate-50/60 p-4 rounded-xl border border-slate-200/70">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Activity size={15} className="text-purple-600" />
                <span className="font-bold text-slate-900">Requêtes Quotidiennes (RPD)</span>
              </div>
              <div className="font-mono text-slate-700">
                <strong>{quota.requestsUsed.toLocaleString('fr-FR')}</strong> / {quota.requestsLimit.toLocaleString('fr-FR')} req
                <span className="text-slate-400 ml-1">({quota.usagePercent}%)</span>
              </div>
            </div>

            <div className="h-3 w-full bg-slate-200/80 rounded-full overflow-hidden p-0.5">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(2, quota.usagePercent)}%` }}
                transition={{ duration: 0.9, ease: "easeOut" }}
                className={`h-full rounded-full ${statusTheme.bg}`}
              />
            </div>

            <div className="flex justify-between text-[11px] text-slate-500 font-mono">
              <span>0 req</span>
              <span className="text-emerald-700 font-bold">Plafond gratuit : 1 500 req/jour</span>
              <span>1 500 req</span>
            </div>
          </div>

          {/* BAR 2: JETONS ESTIMÉS (TPM) */}
          <div className="space-y-2 bg-slate-50/60 p-4 rounded-xl border border-slate-200/70">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Cpu size={15} className="text-indigo-600" />
                <span className="font-bold text-slate-900">Volume de Jetons IA (Tokens TPM)</span>
              </div>
              <div className="font-mono text-slate-700">
                <strong>{quota.tokensUsed.toLocaleString('fr-FR')}</strong> / {(quota.tokensLimit / 1000).toLocaleString('fr-FR')}k jetons
                <span className="text-slate-400 ml-1">({quota.tokensPercent}%)</span>
              </div>
            </div>

            <div className="h-3 w-full bg-slate-200/80 rounded-full overflow-hidden p-0.5">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(1, quota.tokensPercent)}%` }}
                transition={{ duration: 0.9, ease: "easeOut" }}
                className="h-full rounded-full bg-indigo-600"
              />
            </div>

            <div className="flex justify-between text-[11px] text-slate-500 font-mono">
              <span>0 token</span>
              <span className="text-indigo-700 font-bold">Capacité 1 000 000 tokens/min</span>
              <span>1M tokens</span>
            </div>
          </div>

          {/* BAR 3: TAUX D'ÉCONOMIE PAR LE CACHE (ZERO-QUOTA) */}
          <div className="space-y-2 bg-emerald-50/60 p-4 rounded-xl border border-emerald-200/70">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Zap size={15} className="text-emerald-700" />
                <span className="font-bold text-emerald-950">Taux d'Économie & Optimisation (Cache LocalStorage)</span>
              </div>
              <div className="font-mono text-emerald-800 font-bold">
                {quota.savedPercent}% des requêtes protégées (0 crédit)
              </div>
            </div>

            <div className="h-3 w-full bg-emerald-200/80 rounded-full overflow-hidden p-0.5">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(5, quota.savedPercent)}%` }}
                transition={{ duration: 0.9, ease: "easeOut" }}
                className="h-full rounded-full bg-emerald-600"
              />
            </div>

            <div className="flex justify-between text-[11px] text-emerald-700 font-mono">
              <span>{quota.cacheHits} requêtes en cache</span>
              <span>{quota.localFallbacks} secours locaux</span>
              <span className="font-bold">Zéro Surcoût</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4 SUMMARY STAT CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Plafond Quotidien</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-xl font-black text-slate-900 font-mono">{quota.requestsLimit.toLocaleString('fr-FR')}</span>
            <span className="text-[11px] text-slate-500 font-medium">req/j</span>
          </div>
          <span className="text-[10px] text-slate-400 block mt-0.5">Google AI Studio</span>
        </div>

        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Consommé Aujourd'hui</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-xl font-black text-purple-700 font-mono">{quota.requestsUsed.toLocaleString('fr-FR')}</span>
            <span className="text-[11px] text-purple-600 font-medium">requêtes</span>
          </div>
          <span className="text-[10px] text-purple-500 block mt-0.5">{quota.usagePercent}% du quota</span>
        </div>

        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Solde Restant</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-xl font-black text-emerald-700 font-mono">{quota.requestsRemaining.toLocaleString('fr-FR')}</span>
            <span className="text-[11px] text-emerald-600 font-medium">disponibles</span>
          </div>
          <span className="text-[10px] text-emerald-600 block mt-0.5 font-bold">100% Opérationnel</span>
        </div>

        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Synchro Supabase</span>
          <div className="flex items-center gap-1.5 mt-1.5">
            <Database size={16} className={quota.isSyncedWithSupabase ? 'text-emerald-600' : 'text-indigo-600'} />
            <span className="text-xs font-black text-slate-900 font-mono">
              {quota.isSyncedWithSupabase ? 'Direct DB' : 'Moteur Local'}
            </span>
          </div>
          <span className="text-[10px] text-slate-400 block mt-0.5">Dernière : {quota.lastSyncTime}</span>
        </div>
      </div>

      {/* SUPABASE TABLE STRUCTURE ACCORDION / NOTE */}
      <div className="bg-slate-900 text-slate-200 rounded-2xl p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Database size={16} className="text-purple-400" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Structure de la Table Supabase : <code className="text-purple-300 font-mono">public.ai_credits_usage</code>
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <Clock size={12} />
            <span>Période : <strong className="text-white font-mono">{quota.periodDate}</strong></span>
          </div>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          Cette table enregistre en temps réel pour chaque établissement scolaire le nombre de requêtes IA consommées, le plafond alloué, les jetons utilisés et le volume de requêtes interceptées par la mise en cache locale.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] font-mono pt-1">
          <div className="p-2 bg-slate-800/80 rounded-lg border border-slate-700">
            <span className="text-slate-400 block text-[10px]">COLONNE</span>
            <span className="text-purple-300 font-bold">requests_used / limit</span>
          </div>
          <div className="p-2 bg-slate-800/80 rounded-lg border border-slate-700">
            <span className="text-slate-400 block text-[10px]">COLONNE</span>
            <span className="text-indigo-300 font-bold">tokens_used / limit</span>
          </div>
          <div className="p-2 bg-slate-800/80 rounded-lg border border-slate-700">
            <span className="text-slate-400 block text-[10px]">COLONNE</span>
            <span className="text-emerald-300 font-bold">cache_hits (0-Crédit)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
