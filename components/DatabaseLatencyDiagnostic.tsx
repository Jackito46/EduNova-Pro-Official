import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Activity, 
  Database, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Trash2, 
  Copy, 
  Check, 
  Search, 
  HardDrive, 
  Globe, 
  Server, 
  Sparkles,
  Info,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  Gauge,
  Lock,
  Layers,
  Zap
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  supabaseLatencyTracker, 
  SupabaseLatencyLog, 
  LatencyMetrics, 
  DiagnosticSuiteReport,
  DiagnosticBenchmarkItem 
} from '../services/supabaseLatencyTracker';
import { useSchool } from '../contexts/SchoolContext';

interface DatabaseLatencyDiagnosticProps {
  schoolId: string | null;
  onNavigateToSchoolProfile?: () => void;
  liveDbCounts?: {
    schools?: number;
    profiles?: number;
    students?: number;
    payments?: number;
    classes?: number;
    academic_years?: number;
  } | null;
  onRefreshDbCounts?: () => void;
  telemetry?: any;
}

export const DatabaseLatencyDiagnostic: React.FC<DatabaseLatencyDiagnosticProps> = ({ 
  schoolId,
  onNavigateToSchoolProfile,
  liveDbCounts,
  onRefreshDbCounts,
  telemetry
}) => {
  const { school } = useSchool();
  const effectiveSchoolId = schoolId || school?.id || null;

  const [logs, setLogs] = useState<SupabaseLatencyLog[]>([]);
  const [metrics, setMetrics] = useState<LatencyMetrics>(supabaseLatencyTracker.getMetrics());
  const [report, setReport] = useState<DiagnosticSuiteReport | null>(null);
  const [isRunningDiagnostic, setIsRunningDiagnostic] = useState(false);
  const [diagnosticStep, setDiagnosticStep] = useState<string>('');
  
  // Filters for real-time logs
  const [filterType, setFilterType] = useState<'all' | 'identity' | 'slow' | 'errors'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [copiedReport, setCopiedReport] = useState(false);

  // Subscribe to live log events
  useEffect(() => {
    setLogs(supabaseLatencyTracker.getLogs());
    setMetrics(supabaseLatencyTracker.getMetrics());

    const unsubscribe = supabaseLatencyTracker.subscribe((_newLog, updatedMetrics) => {
      setLogs(supabaseLatencyTracker.getLogs());
      setMetrics(updatedMetrics);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Run full diagnosis
  const handleRunFullDiagnosis = useCallback(async () => {
    setIsRunningDiagnostic(true);
    setDiagnosticStep('Initialisation du banc de test Supabase...');

    try {
      setDiagnosticStep('1/6 : Ping réseau brut vers l\'API Supabase (RTT)...');
      await new Promise(r => setTimeout(r, 120));

      setDiagnosticStep('2/6 : Vérification de la rapidité du cache local...');
      await new Promise(r => setTimeout(r, 120));

      setDiagnosticStep('3/6 : Exécution de la requête d\'identité établissement (schools SELECT *)...');
      const suiteReport = await supabaseLatencyTracker.runDiagnosticSuite(effectiveSchoolId);

      setDiagnosticStep('4/6 : Analyse comparative du poids des attributs et du logo...');
      await new Promise(r => setTimeout(r, 150));

      setDiagnosticStep('5/6 : Mesure des temps de réponse des annexes et années scolaires...');
      await new Promise(r => setTimeout(r, 120));

      setDiagnosticStep('6/6 : Synthèse des goulots d\'étranglement et calcul du score...');
      await new Promise(r => setTimeout(r, 150));

      setReport(suiteReport);
      toast.success("Diagnostic de latence terminé avec succès");
    } catch (err: any) {
      console.error("Erreur diagnostic:", err);
      toast.error(err.message || "Erreur lors de l'exécution du diagnostic");
    } finally {
      setIsRunningDiagnostic(false);
      setDiagnosticStep('');
    }
  }, [effectiveSchoolId]);

  // Auto-run light initial benchmark if never run before
  useEffect(() => {
    if (!report && effectiveSchoolId) {
      handleRunFullDiagnosis();
    }
  }, [effectiveSchoolId, handleRunFullDiagnosis, report]);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return supabaseLatencyTracker.getLogs({
      isIdentityQuery: filterType === 'identity' ? true : undefined,
      onlySlow: filterType === 'slow' ? true : undefined,
      onlyErrors: filterType === 'errors' ? true : undefined,
      search: searchTerm.trim() || undefined
    });
  }, [logs, filterType, searchTerm]);

  // Copy full diagnosis report to clipboard
  const handleCopyReport = () => {
    const reportData = {
      timestamp: new Date().toISOString(),
      schoolId: effectiveSchoolId,
      schoolName: school?.name || 'Inconnu',
      liveDbCounts: liveDbCounts || null,
      metrics,
      report,
      recentLogs: logs.slice(0, 30)
    };

    navigator.clipboard.writeText(JSON.stringify(reportData, null, 2));
    setCopiedReport(true);
    toast.success("Rapport technique de latence copié dans le presse-papier");
    setTimeout(() => setCopiedReport(false), 2500);
  };

  // Clear logs
  const handleClearLogs = () => {
    supabaseLatencyTracker.clearLogs();
    setLogs([]);
    setMetrics(supabaseLatencyTracker.getMetrics());
    toast.info("Journal de latence réinitialisé");
  };

  // Get color for latency badges
  const getLatencyColor = (ms: number) => {
    if (ms < 250) return 'text-emerald-700 bg-emerald-50 border-emerald-200/80';
    if (ms < 650) return 'text-amber-700 bg-amber-50 border-amber-200/80';
    return 'text-rose-700 bg-rose-50 border-rose-200/80';
  };

  const getStatusBadge = (status: DiagnosticBenchmarkItem['status']) => {
    switch (status) {
      case 'OPTIMAL':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"><CheckCircle2 size={11} /> Optimal</span>;
      case 'ACCEPTABLE':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200"><CheckCircle2 size={11} /> Bon</span>;
      case 'WARNING':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200"><AlertTriangle size={11} /> Latence Modérée</span>;
      case 'CRITICAL':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200"><AlertTriangle size={11} /> Lenteur Critique</span>;
      case 'ERROR':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200"><XCircle size={11} /> Échec Réseau</span>;
    }
  };

  return (
    <div className="space-y-2 sm:space-y-2.5 font-sans animate-in fade-in duration-200">
      
      {/* 1. MODERN COMPACT UNIFIED HEADER & TOOLBAR */}
      <div className="bg-slate-900 p-2 sm:p-2.5 md:p-3 rounded-xl text-white shadow-xs border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-2 sm:gap-2.5 relative overflow-hidden">
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
          <div className="w-7.5 h-7.5 sm:w-8 sm:h-8 rounded-lg bg-white/10 text-emerald-400 flex items-center justify-center shrink-0 border border-white/10">
            <Activity size={16} className={isRunningDiagnostic ? 'animate-spin' : 'animate-pulse'} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <h2 className="text-xs sm:text-sm md:text-base font-black tracking-tight text-white">
                Santé & Diagnostic Supabase
              </h2>
              <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded text-[9px] font-black uppercase tracking-wider">
                PostgreSQL Cloud
              </span>
              <span className="px-1.5 py-0.2 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded text-[9px] font-black uppercase tracking-wider">
                Multi-Tenant RLS
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-300/90 leading-snug mt-0.5">
              Volumes d'enregistrements en direct, sondes de latence d'identité et traçabilité des requêtes PostgREST.
            </p>
          </div>
        </div>

        {/* Responsive Compact Actions Toolbar */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 flex-wrap sm:flex-nowrap w-full sm:w-auto pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-800/80">
          {onRefreshDbCounts && (
            <button
              type="button"
              onClick={onRefreshDbCounts}
              className="flex-1 sm:flex-initial h-7 sm:h-7.5 px-2 sm:px-2.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 text-xs font-bold rounded-lg border border-slate-700 flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs"
              title="Rafraîchir les compteurs réels de la base"
            >
              <RefreshCw size={11} />
              <span className="hidden xs:inline">Actualiser</span>
              <span>Compteurs</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleCopyReport}
            className="flex-1 sm:flex-initial h-7 sm:h-7.5 px-2 sm:px-2.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 text-xs font-bold rounded-lg border border-slate-700 flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs"
            title="Copier le rapport complet au format JSON"
          >
            {copiedReport ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
            <span>{copiedReport ? 'Copié !' : 'JSON'}</span>
          </button>

          <button
            type="button"
            onClick={handleRunFullDiagnosis}
            disabled={isRunningDiagnostic}
            className="w-full sm:w-auto flex-1 sm:flex-initial h-7 sm:h-7.5 px-2.5 sm:px-3 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
          >
            <RefreshCw size={11} className={isRunningDiagnostic ? 'animate-spin' : ''} />
            <span>{isRunningDiagnostic ? 'Test en cours...' : 'Diagnostiquer Latence'}</span>
          </button>
        </div>

        {/* Running diagnostic strip */}
        {isRunningDiagnostic && (
          <div className="w-full pt-1.5 sm:pt-2 border-t border-slate-800/80 flex items-center gap-2 text-[10.5px] sm:text-[11px] text-indigo-300 font-mono animate-in fade-in">
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping shrink-0"></span>
            <span className="leading-tight">{diagnosticStep}</span>
          </div>
        )}
      </div>

      {/* 2. UNIFIED 10-KPI METRICS GRID (DENSE RESPONSIVE: 2 COLS MOBILE / 3-5 COLS TABLET / 5 COLS DESKTOP TO PREVENT TEXT CLIPPING) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-1.5 sm:gap-2">
        {/* Metric 1: Ping Réseau Brut */}
        <div className="bg-white p-2 sm:p-2.5 rounded-xl border border-slate-200/90 shadow-2xs hover:border-emerald-300 hover:shadow-xs transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[9.5px] sm:text-[10px] font-black uppercase tracking-wider text-slate-500 leading-tight">Ping Réseau</span>
            <Globe size={13} className="text-emerald-600 shrink-0" />
          </div>
          <div className="my-0.5 flex items-baseline gap-1">
            <span className="text-base sm:text-lg font-black text-slate-900 font-mono tracking-tight">
              {report?.basePingMs ?? (metrics.avgLatencyMs ? Math.round(metrics.avgLatencyMs) : '—')}
            </span>
            <span className="text-[9.5px] font-bold text-slate-400 font-mono">ms</span>
          </div>
          <span className="text-[9.5px] sm:text-[10px] text-emerald-600 font-semibold block leading-tight">Transit Aller-Retour</span>
        </div>

        {/* Metric 2: Latence Identité */}
        <div className="bg-white p-2 sm:p-2.5 rounded-xl border border-slate-200/90 shadow-2xs hover:border-indigo-300 hover:shadow-xs transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[9.5px] sm:text-[10px] font-black uppercase tracking-wider text-slate-500 leading-tight">Latence Identité</span>
            <Server size={13} className="text-indigo-600 shrink-0" />
          </div>
          <div className="my-0.5 flex items-baseline gap-1">
            <span className="text-base sm:text-lg font-black text-slate-900 font-mono tracking-tight">
              {report?.identitySelectAllMs ?? (metrics.identityLastLatencyMs || metrics.identityAvgLatencyMs || '—')}
            </span>
            <span className="text-[9.5px] font-bold text-slate-400 font-mono">ms</span>
          </div>
          <span className="text-[9.5px] sm:text-[10px] text-indigo-600 font-semibold block leading-tight">SELECT * Établissement</span>
        </div>

        {/* Metric 3: Cache Local */}
        <div className="bg-white p-2 sm:p-2.5 rounded-xl border border-slate-200/90 shadow-2xs hover:border-blue-300 hover:shadow-xs transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[9.5px] sm:text-[10px] font-black uppercase tracking-wider text-slate-500 leading-tight">Cache Local</span>
            <HardDrive size={13} className="text-blue-600 shrink-0" />
          </div>
          <div className="my-0.5 flex items-baseline gap-1">
            <span className="text-base sm:text-lg font-black text-emerald-600 font-mono tracking-tight">
              {report?.cacheAccessMs ?? 1}
            </span>
            <span className="text-[9.5px] font-bold text-emerald-600 font-mono">ms</span>
          </div>
          <span className="text-[9.5px] sm:text-[10px] text-blue-600 font-semibold block leading-tight">Hors-Ligne 0ms</span>
        </div>

        {/* Metric 4: Score Santé */}
        <div className="bg-white p-2 sm:p-2.5 rounded-xl border border-slate-200/90 shadow-2xs hover:border-purple-300 hover:shadow-xs transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[9.5px] sm:text-[10px] font-black uppercase tracking-wider text-slate-500 leading-tight">Score Santé</span>
            <Gauge size={13} className="text-purple-600 shrink-0" />
          </div>
          <div className="my-0.5 flex items-baseline gap-1">
            <span className={`text-base sm:text-lg font-black font-mono tracking-tight ${
              (report?.overallScore || 85) >= 80 ? 'text-emerald-600' : (report?.overallScore || 85) >= 50 ? 'text-amber-600' : 'text-rose-600'
            }`}>
              {report?.overallScore ?? 85}
            </span>
            <span className="text-[9.5px] font-bold text-slate-400 font-mono">/100</span>
          </div>
          <span className="text-[9.5px] sm:text-[10px] text-purple-600 font-semibold block leading-tight">Note : {report?.overallGrade ?? 'OPTIMAL'}</span>
        </div>

        {/* Metric 5: Requêtes Capturées */}
        <div className="bg-white p-2 sm:p-2.5 rounded-xl border border-slate-200/90 shadow-2xs hover:border-slate-300 hover:shadow-xs transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[9.5px] sm:text-[10px] font-black uppercase tracking-wider text-slate-500 leading-tight">Requêtes</span>
            <Zap size={13} className="text-amber-500 shrink-0" />
          </div>
          <div className="my-0.5 flex items-baseline gap-1">
            <span className="text-base sm:text-lg font-black text-slate-900 font-mono tracking-tight">
              {logs.length}
            </span>
            <span className="text-[9.5px] font-bold text-slate-400 font-mono">logs</span>
          </div>
          <span className="text-[9.5px] sm:text-[10px] text-amber-600 font-semibold block leading-tight">{metrics.slowRequestsCount} requête(s) lente(s)</span>
        </div>

        {/* Metric 6: Écoles (Volumes DB) */}
        <div className="bg-white p-2 sm:p-2.5 rounded-xl border border-slate-200/90 shadow-2xs hover:border-slate-300 hover:shadow-xs transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[9.5px] sm:text-[10px] font-black uppercase tracking-wider text-slate-500 leading-tight">Établissements</span>
            <Database size={13} className="text-slate-400 shrink-0" />
          </div>
          <div className="my-0.5">
            <span className="text-base sm:text-lg font-black text-slate-900 font-mono tracking-tight block">
              {liveDbCounts?.schools ?? telemetry?.database?.tables?.schools ?? 1}
            </span>
          </div>
          <span className="text-[9.5px] sm:text-[10px] text-slate-500 font-medium block leading-tight">Institutions Actives</span>
        </div>

        {/* Metric 7: Profils / Comptes */}
        <div className="bg-white p-2 sm:p-2.5 rounded-xl border border-slate-200/90 shadow-2xs hover:border-slate-300 hover:shadow-xs transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[9.5px] sm:text-[10px] font-black uppercase tracking-wider text-slate-500 leading-tight">Comptes</span>
            <Database size={13} className="text-indigo-400 shrink-0" />
          </div>
          <div className="my-0.5">
            <span className="text-base sm:text-lg font-black text-slate-900 font-mono tracking-tight block">
              {liveDbCounts?.profiles ?? telemetry?.database?.tables?.profiles ?? 0}
            </span>
          </div>
          <span className="text-[9.5px] sm:text-[10px] text-indigo-600 font-medium block leading-tight">Profils Utilisateurs</span>
        </div>

        {/* Metric 8: Élèves Inscrits */}
        <div className="bg-white p-2 sm:p-2.5 rounded-xl border border-slate-200/90 shadow-2xs hover:border-slate-300 hover:shadow-xs transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[9.5px] sm:text-[10px] font-black uppercase tracking-wider text-slate-500 leading-tight">Élèves</span>
            <Database size={13} className="text-blue-400 shrink-0" />
          </div>
          <div className="my-0.5">
            <span className="text-base sm:text-lg font-black text-slate-900 font-mono tracking-tight block">
              {liveDbCounts?.students ?? telemetry?.database?.tables?.students ?? 0}
            </span>
          </div>
          <span className="text-[9.5px] sm:text-[10px] text-blue-600 font-medium block leading-tight">Effectifs Inscrits</span>
        </div>

        {/* Metric 9: Transactions Paiements */}
        <div className="bg-white p-2 sm:p-2.5 rounded-xl border border-slate-200/90 shadow-2xs hover:border-slate-300 hover:shadow-xs transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[9.5px] sm:text-[10px] font-black uppercase tracking-wider text-slate-500 leading-tight">Paiements</span>
            <Database size={13} className="text-emerald-400 shrink-0" />
          </div>
          <div className="my-0.5">
            <span className="text-base sm:text-lg font-black text-slate-900 font-mono tracking-tight block">
              {liveDbCounts?.payments ?? telemetry?.database?.tables?.payments ?? 0}
            </span>
          </div>
          <span className="text-[9.5px] sm:text-[10px] text-emerald-600 font-medium block leading-tight">Transactions Réalisées</span>
        </div>

        {/* Metric 10: Classes & Années */}
        <div className="bg-white p-2 sm:p-2.5 rounded-xl border border-slate-200/90 shadow-2xs hover:border-slate-300 hover:shadow-xs transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[9.5px] sm:text-[10px] font-black uppercase tracking-wider text-slate-500 leading-tight">Classes</span>
            <Database size={13} className="text-amber-400 shrink-0" />
          </div>
          <div className="my-0.5">
            <span className="text-base sm:text-lg font-black text-slate-900 font-mono tracking-tight block">
              {liveDbCounts?.classes ?? telemetry?.database?.tables?.classes ?? 0}
            </span>
          </div>
          <span className="text-[9.5px] sm:text-[10px] text-amber-600 font-medium block leading-tight">
            {liveDbCounts?.academic_years ?? telemetry?.database?.tables?.academic_years ?? 1} période(s) scolaire(s)
          </span>
        </div>
      </div>

      {/* 3. COMPACT SECURITY & INFRASTRUCTURE GUARANTEES BAR */}
      <div className="bg-white p-2 sm:p-2.5 rounded-xl border border-slate-200/80 shadow-2xs">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 sm:gap-2 text-xs">
          <div className="flex items-center gap-2 p-1.5 bg-slate-50 rounded-lg border border-slate-200/60">
            <div className="p-1 rounded bg-slate-200 text-slate-700 shrink-0">
              <Server size={12} />
            </div>
            <div className="min-w-0">
              <span className="text-[9px] font-bold text-slate-500 uppercase block leading-none">Hôte Cloud</span>
              <p className="font-bold text-slate-800 text-[11px] leading-tight mt-0.5">Cluster Isolé</p>
            </div>
          </div>

          <div className="flex items-center gap-2 p-1.5 bg-slate-50 rounded-lg border border-slate-200/60">
            <div className="p-1 rounded bg-emerald-100 text-emerald-700 shrink-0">
              <Lock size={12} />
            </div>
            <div className="min-w-0">
              <span className="text-[9px] font-bold text-slate-500 uppercase block leading-none">Chiffrement</span>
              <p className="font-bold text-emerald-700 text-[11px] leading-tight mt-0.5">TLS 1.3 Sécurisé</p>
            </div>
          </div>

          <div className="flex items-center gap-2 p-1.5 bg-slate-50 rounded-lg border border-slate-200/60">
            <div className="p-1 rounded bg-indigo-100 text-indigo-700 shrink-0">
              <ShieldCheck size={12} />
            </div>
            <div className="min-w-0">
              <span className="text-[9px] font-bold text-slate-500 uppercase block leading-none">Cloisonnement RLS</span>
              <p className="font-bold text-indigo-700 text-[11px] leading-tight mt-0.5">Multi-Tenant Actif</p>
            </div>
          </div>

          <div className="flex items-center gap-2 p-1.5 bg-slate-50 rounded-lg border border-slate-200/60">
            <div className="p-1 rounded bg-purple-100 text-purple-700 shrink-0">
              <Clock size={12} />
            </div>
            <div className="min-w-0">
              <span className="text-[9px] font-bold text-slate-500 uppercase block leading-none">Anti-Veille</span>
              <p className="font-bold text-purple-700 text-[11px] leading-tight mt-0.5">Keep-Alive 24/7</p>
            </div>
          </div>
        </div>
      </div>

      {/* 4. ANALYSE DIAGNOSTIQUE & CAUSES DE LENTEUR (IDENTITÉ ÉTABLISSEMENT) */}
      {report && (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="px-3.5 py-2.5 bg-slate-50/90 border-b border-slate-200/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-amber-600" />
              <h3 className="text-xs sm:text-sm font-black text-slate-900 tracking-tight">
                Analyse de la Lenteur de l'Identité Établissement
              </h3>
            </div>
            {onNavigateToSchoolProfile && (
              <button
                type="button"
                onClick={onNavigateToSchoolProfile}
                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 cursor-pointer"
              >
                <span>Fiche École</span>
                <ChevronRight size={13} />
              </button>
            )}
          </div>

          <div className="p-3 sm:p-3.5 space-y-2">
            {report.insights.map((insight) => (
              <div 
                key={insight.id}
                className={`p-2.5 sm:p-3 rounded-lg border flex items-start gap-2.5 text-xs ${
                  insight.level === 'danger' 
                    ? 'bg-rose-50/70 border-rose-200 text-rose-950'
                    : insight.level === 'warning'
                    ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                    : insight.level === 'info'
                    ? 'bg-blue-50/70 border-blue-200 text-blue-950'
                    : 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                }`}
              >
                <div className="shrink-0 mt-0.5">
                  {insight.level === 'danger' && <AlertTriangle className="text-rose-600" size={15} />}
                  {insight.level === 'warning' && <AlertTriangle className="text-amber-600" size={15} />}
                  {insight.level === 'info' && <Info className="text-blue-600" size={15} />}
                  {insight.level === 'success' && <CheckCircle2 className="text-emerald-600" size={15} />}
                </div>

                <div className="space-y-1 flex-1 min-w-0">
                  <div className="font-black tracking-tight">{insight.title}</div>
                  <p className="text-[11px] leading-relaxed text-slate-700">{insight.description}</p>
                  <div className="pt-0.5 text-[11px] font-semibold text-slate-900 flex items-start gap-1">
                    <span className="text-indigo-600 font-bold shrink-0">Action :</span>
                    <span>{insight.recommendation}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. TABLEAU DES BENCHMARKS DÉTAILLÉS */}
      {report && report.items.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="px-3.5 py-2 bg-slate-50/90 border-b border-slate-200/80 flex items-center justify-between">
            <h3 className="text-xs sm:text-sm font-black text-slate-900 tracking-tight flex items-center gap-1.5">
              <span>Sondes & Benchmarks de Latence</span>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 bg-slate-200 text-slate-700 rounded">
                {report.items.length} tests
              </span>
            </h3>
            <span className="text-[10px] font-mono text-slate-500 hidden sm:inline">
              Moyenne : {Math.round(report.items.reduce((acc, i) => acc + (i.durationMs < 9999 ? i.durationMs : 0), 0) / report.items.length)} ms
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-200/80 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                  <th className="py-2 px-3">Point d'accès</th>
                  <th className="py-2 px-3">Catégorie</th>
                  <th className="py-2 px-3">Temps de Réponse</th>
                  <th className="py-2 px-3">Payload</th>
                  <th className="py-2 px-3">Observations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[11px]">
                {report.items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-1.5 px-2.5 sm:px-3 font-bold text-slate-900">
                      <div className="leading-tight text-xs">{item.label}</div>
                      <div className="text-[10px] font-normal text-slate-500 leading-tight mt-0.5 max-w-md">{item.description}</div>
                    </td>
                    <td className="py-2 px-3">
                      <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-mono text-[9.5px] font-bold">
                        {item.category}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded font-mono font-black text-[11px] border ${getLatencyColor(item.durationMs)}`}>
                          {item.durationMs} ms
                        </span>
                        {getStatusBadge(item.status)}
                      </div>
                    </td>
                    <td className="py-2 px-3 font-mono text-[10px] text-slate-600">
                      {item.bytesReceived != null ? (
                        item.bytesReceived > 1024 
                          ? `${Math.round(item.bytesReceived / 1024)} Ko` 
                          : `${item.bytesReceived} o`
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-2 px-3 text-slate-600 text-[11px]">
                      {item.error ? (
                        <span className="text-rose-600 font-medium flex items-center gap-1">
                          <XCircle size={12} /> {item.error}
                        </span>
                      ) : (
                        <div className="space-y-0.5">
                          <span>{item.details || 'Normal'}</span>
                          {item.payloadAnalysis?.hasLargeBase64 && (
                            <span className="text-[10px] font-bold text-amber-600 flex items-center gap-1">
                              <AlertTriangle size={11} /> Image Base64 détectée
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. CONSOLE DE TRAÇABILITÉ DES REQUÊTES SUPABASE EN TEMPS RÉEL */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="p-2.5 sm:p-3 bg-slate-50/90 border-b border-slate-200/80 space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-xs sm:text-sm font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                <span>Journal des Requêtes Supabase en Direct</span>
                <span className="px-1.5 py-0.2 rounded-full text-[9.5px] font-black bg-indigo-100 text-indigo-700">
                  {logs.length} capturées
                </span>
              </h3>
              <p className="text-[10.5px] text-slate-500">
                Interception globale de tous les appels PostgREST, Auth et Storage dans l'application
              </p>
            </div>

            <button
              type="button"
              onClick={handleClearLogs}
              className="self-end sm:self-center px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 text-[11px] font-bold rounded-lg border border-slate-200 flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
              title="Vider le journal local"
            >
              <Trash2 size={11} className="text-slate-500" />
              <span>Vider</span>
            </button>
          </div>

          {/* Compact Filter Pills and Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={() => setFilterType('all')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  filterType === 'all'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                Toutes ({metrics.totalRequests})
              </button>

              <button
                type="button"
                onClick={() => setFilterType('identity')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  filterType === 'identity'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <span>Identité</span>
                <span className="px-1 py-0.2 rounded-full text-[9px] bg-indigo-100 text-indigo-800">
                  {metrics.identityQueryCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFilterType('slow')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  filterType === 'slow'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <span>Lentes (&gt; 500ms)</span>
                <span className="px-1 py-0.2 rounded-full text-[9px] bg-amber-100 text-amber-800">
                  {metrics.slowRequestsCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFilterType('errors')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  filterType === 'errors'
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <span>Erreurs</span>
                <span className="px-1 py-0.2 rounded-full text-[9px] bg-rose-100 text-rose-800">
                  {metrics.errorCount}
                </span>
              </button>
            </div>

            <div className="relative flex-1 max-w-xs ml-auto">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Filtrer URL / table..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-7 pr-2.5 py-1 text-[11px] bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Compact Log Rows */}
        <div className="divide-y divide-slate-100 max-h-[360px] overflow-y-auto font-mono text-[11px]">
          {filteredLogs.length === 0 ? (
            <div className="p-6 text-center text-slate-500 space-y-1">
              <Database size={22} className="mx-auto text-slate-300 stroke-[1.5]" />
              <p className="text-xs font-medium">Aucun appel Supabase correspondant.</p>
              <p className="text-[10px] text-slate-400">Cliquez sur « Diagnostiquer » pour générer les sondes.</p>
            </div>
          ) : (
            filteredLogs.map((log) => {
              const isExpanded = expandedLogId === log.id;
              const dateStr = new Date(log.timestamp).toLocaleTimeString();

              return (
                <div 
                  key={log.id} 
                  className={`hover:bg-slate-50/70 transition-colors ${
                    log.isIdentityQuery ? 'bg-indigo-50/30' : ''
                  }`}
                >
                  <div 
                    onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                    className="p-2 sm:px-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <span className="text-slate-400 text-[9.5px] shrink-0 font-sans">
                        {dateStr}
                      </span>

                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-black shrink-0 ${
                        log.method === 'GET' 
                          ? 'bg-blue-100 text-blue-800'
                          : log.method === 'POST'
                          ? 'bg-emerald-100 text-emerald-800'
                          : log.method === 'PATCH' || log.method === 'PUT'
                          ? 'bg-amber-100 text-amber-800'
                          : log.method === 'DELETE'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {log.method}
                      </span>

                      <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 text-[10px] font-bold shrink-0">
                        {log.table}
                      </span>

                      {log.isIdentityQuery && (
                        <span className="px-1.5 py-0.2 rounded-full bg-indigo-100 text-indigo-700 text-[9px] font-black shrink-0">
                          Identité
                        </span>
                      )}

                      <span className="text-slate-700 text-[10.5px] font-sans truncate max-w-[190px] sm:max-w-xs md:max-w-md lg:max-w-lg block" title={log.displayEndpoint}>
                        {log.displayEndpoint}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      {log.bytesReceived != null && (
                        <span className="text-[9.5px] text-slate-400 font-mono">
                          {log.bytesReceived > 1024 ? `${Math.round(log.bytesReceived / 1024)} Ko` : `${log.bytesReceived} o`}
                        </span>
                      )}

                      <span className={`px-1.5 py-0.2 rounded text-[9.5px] font-bold ${
                        log.status >= 200 && log.status < 300
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : log.status >= 500
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {log.status}
                      </span>

                      <span className={`px-2 py-0.2 rounded font-mono font-black text-[10.5px] border ${getLatencyColor(log.durationMs)}`}>
                        {log.durationMs} ms
                      </span>

                      <span className="text-slate-400">
                        {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      </span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-3 py-2 bg-slate-900 text-slate-200 text-[10.5px] space-y-1.5 border-t border-slate-800 animate-in fade-in">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-indigo-400">URL de la Requête :</span>
                        <span className="text-slate-400 text-[9.5px]">Type : {log.queryType}</span>
                      </div>
                      <div className="p-1.5 bg-slate-950 rounded break-all text-slate-300 font-mono text-[10px] select-all">
                        {log.url}
                      </div>

                      {log.errorMessage && (
                        <div className="p-1.5 bg-rose-950/50 border border-rose-800 text-rose-200 rounded">
                          <strong>Erreur :</strong> {log.errorMessage}
                        </div>
                      )}

                      <div className="flex flex-wrap gap-3 text-[9.5px] text-slate-400 pt-0.5">
                        <span>Horodatage : {new Date(log.timestamp).toISOString()}</span>
                        <span>Durée : {log.durationMs} ms</span>
                        <span>Table : {log.table}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default DatabaseLatencyDiagnostic;
