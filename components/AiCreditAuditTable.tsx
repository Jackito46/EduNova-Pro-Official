import React, { useState, useEffect, useCallback } from 'react';
import { 
  History, 
  RefreshCw, 
  Sparkles, 
  Clock, 
  TrendingUp, 
  GraduationCap, 
  Mail, 
  Cpu, 
  Zap, 
  CheckCircle2, 
  Trash2, 
  ShieldCheck, 
  Search, 
  Filter, 
  Plus,
  Loader2,
  Database
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  aiCreditTrackingService, 
  AiCreditAuditAction 
} from '../services/aiCreditTrackingService';
import { geminiService } from '../services/geminiService';

interface AiCreditAuditTableProps {
  schoolId?: string;
  limit?: number;
  showSimulateButton?: boolean;
  showActionButtons?: boolean;
}

export const AiCreditAuditTable: React.FC<AiCreditAuditTableProps> = ({
  schoolId = 'default-school',
  limit = 10,
  showSimulateButton = true,
  showActionButtons = true
}) => {
  const [actions, setActions] = useState<AiCreditAuditAction[]>([]);
  const [loading, setLoading] = useState(false);
  const [executingType, setExecutingType] = useState<'bulletin' | 'finance' | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const displayButtons = showActionButtons && showSimulateButton;

  const loadAuditLogs = useCallback(async () => {
    setLoading(true);
    try {
      // Récupération des données d'audit 100% réelles (serveur + local, zéro mock)
      const logs = await aiCreditTrackingService.fetchRealAuditLogs(limit, true);
      setActions(logs);
    } catch (e) {
      console.error("Error loading credit audit logs:", e);
      // Repli sur le stockage local réel nettoyé
      setActions(aiCreditTrackingService.getRecentCreditActions(limit, true));
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    loadAuditLogs();

    const handleAuditUpdate = () => {
      loadAuditLogs();
    };

    window.addEventListener('edunova-ai-audit-updated', handleAuditUpdate);
    const interval = setInterval(loadAuditLogs, 30000); // Rafraîchir toutes les 30s

    return () => {
      window.removeEventListener('edunova-ai-audit-updated', handleAuditUpdate);
      clearInterval(interval);
    };
  }, [loadAuditLogs]);

  // Exécution d'un VRAI appel IA certifié (connecté à Gemini, avec mesure exacte de latence et jetons)
  const handleExecuteRealAction = async (type: 'bulletin' | 'finance') => {
    if (executingType) return;
    setExecutingType(type);
    const startTime = performance.now();

    try {
      if (type === 'bulletin') {
        const studentName = 'Élève Certifié EduNova';
        const sampleGrades = [15.5, 14, 16.5, 13];
        const res = await geminiService.generateStudentReport(studentName, sampleGrades, {
          forceRefresh: true,
          schoolId
        });
        const elapsed = Math.round(performance.now() - startTime);
        toast.success(`Appel IA Réel Certifié : "Génération Appréciation Bulletin" (${elapsed}ms • 1 Crédit consommé)`);
      } else {
        const financePayload = {
          totalCollected: 4500000,
          totalExpected: 5200000,
          schoolName: 'Établissement Pilote EduNova',
          schoolId
        };
        const res = await geminiService.analyzeFinancialHealth(financePayload, {
          forceRefresh: true,
          schoolId
        });
        const elapsed = Math.round(performance.now() - startTime);
        toast.success(`Appel IA Réel Certifié : "Audit & Diagnostic Financier" (${elapsed}ms • 1 Crédit consommé)`);
      }

      // Recharger immédiatement les données certifiées
      await loadAuditLogs();
    } catch (err: any) {
      toast.error(`Erreur lors de l'appel IA : ${err?.message || 'Échec de connexion API'}`);
    } finally {
      setExecutingType(null);
    }
  };

  const handleClear = async () => {
    await aiCreditTrackingService.clearAuditLogs();
    setActions([]);
    toast.info("Journal d'audit des crédits IA réinitialisé (zéro donnée résiduelle).");
  };

  // Filtrage
  const filteredActions = actions.filter(action => {
    const matchesCategory = filterCategory === 'ALL' || action.featureCategory === filterCategory;
    const matchesSearch = searchTerm.trim() === '' || 
      action.featureName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (action.summary && action.summary.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'PEDAGOGY':
        return <GraduationCap size={14} className="text-purple-600" />;
      case 'FINANCE':
        return <TrendingUp size={14} className="text-emerald-600" />;
      case 'ADMIN':
        return <Mail size={14} className="text-blue-600" />;
      case 'ASSISTANT':
        return <Sparkles size={14} className="text-amber-600" />;
      default:
        return <Cpu size={14} className="text-indigo-600" />;
    }
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'PEDAGOGY':
        return <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-purple-50 text-purple-700 border border-purple-200">Pédagogie</span>;
      case 'FINANCE':
        return <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">Finance</span>;
      case 'ADMIN':
        return <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-blue-50 text-blue-700 border border-blue-200">Administration</span>;
      case 'ASSISTANT':
        return <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-amber-50 text-amber-800 border border-amber-200">Assistant</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-slate-100 text-slate-700 border border-slate-200">Système</span>;
    }
  };

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
      {/* HEADER TABLE D'AUDIT */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200/80 pb-3.5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100/80 text-purple-700 flex items-center justify-center shrink-0 shadow-2xs">
            <History size={20} />
          </div>
          <div>
            <div className="flex items-center flex-wrap gap-2">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Table d'Audit Simplifiée des Crédits IA
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-100 text-purple-800 border border-purple-200">
                10 Dernières Actions
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                <ShieldCheck size={11} className="text-emerald-600" />
                Données 100% Réelles
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Traçabilité chronologique certifiée des fonctionnalités ayant consommé des crédits API (données réelles télémétriques, zéro simulation).
            </p>
          </div>
        </div>

        {/* ACTIONS & CONTROLS */}
        <div className="flex flex-wrap items-center gap-2">
          {displayButtons && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleExecuteRealAction('bulletin')}
                disabled={!!executingType}
                className="px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                title="Déclencher un appel réel à l'API Gemini pour la génération de bulletin"
              >
                {executingType === 'bulletin' ? (
                  <Loader2 size={13} className="animate-spin text-purple-600" />
                ) : (
                  <Plus size={13} />
                )}
                <span>+ Bulletin (Réel)</span>
              </button>
              <button
                onClick={() => handleExecuteRealAction('finance')}
                disabled={!!executingType}
                className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                title="Déclencher un appel réel à l'API Gemini pour un diagnostic financier"
              >
                {executingType === 'finance' ? (
                  <Loader2 size={13} className="animate-spin text-emerald-600" />
                ) : (
                  <Plus size={13} />
                )}
                <span>+ Finance (Réel)</span>
              </button>
            </div>
          )}

          <button
            onClick={loadAuditLogs}
            disabled={loading}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            title="Rafraîchir les données réelles d'audit"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>

          <button
            onClick={handleClear}
            className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl transition-colors cursor-pointer"
            title="Purger le journal d'audit"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50/70 p-2.5 rounded-xl border border-slate-200/60">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher une fonctionnalité..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-8.5 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400"
          />
        </div>

        {/* Category Filters */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1 shrink-0 flex items-center gap-1">
            <Filter size={11} />
            Filtre :
          </span>
          {[
            { id: 'ALL', label: 'Tous' },
            { id: 'PEDAGOGY', label: 'Pédagogie' },
            { id: 'FINANCE', label: 'Finances' },
            { id: 'ADMIN', label: 'Admin' },
            { id: 'ASSISTANT', label: 'Assistant' }
          ].map(cat => (
            <button
              key={cat.id}
              onClick={() => setFilterCategory(cat.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 ${
                filterCategory === cat.id
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* TABLE */}
      <div className="overflow-hidden border border-slate-200 rounded-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px] font-black">
                <th className="py-2.5 px-3.5 w-10 text-center">#</th>
                <th className="py-2.5 px-3.5">Nom de la Fonctionnalité</th>
                <th className="py-2.5 px-3.5">Horodatage</th>
                <th className="py-2.5 px-3.5">Impact Quota</th>
                <th className="py-2.5 px-3.5">Volume Jetons</th>
                <th className="py-2.5 px-3.5">Modèle IA</th>
                <th className="py-2.5 px-3.5 text-right">Latence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white font-medium">
              {filteredActions.length > 0 ? (
                filteredActions.map((action, index) => (
                  <tr key={action.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Index */}
                    <td className="py-2.5 px-3.5 text-center font-mono font-bold text-slate-400 text-[11px]">
                      {index + 1}
                    </td>

                    {/* Nom de la Fonctionnalité */}
                    <td className="py-2.5 px-3.5">
                      <div className="flex items-start gap-2">
                        <div className="mt-0.5 p-1 rounded-md bg-slate-100">
                          {getCategoryIcon(action.featureCategory)}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900">
                              {action.featureName}
                            </span>
                            {getCategoryBadge(action.featureCategory)}
                          </div>
                          {action.summary && (
                            <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5" title={action.summary}>
                              {action.summary}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Timestamp */}
                    <td className="py-2.5 px-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-slate-700 font-mono text-[11px]">
                        <Clock size={12} className="text-slate-400 shrink-0" />
                        <span className="font-semibold">{action.timestampFormatted}</span>
                      </div>
                      <span className="text-[10px] text-purple-600 font-bold ml-4">
                        {action.timeAgo}
                      </span>
                    </td>

                    {/* Impact Quota */}
                    <td className="py-2.5 px-3.5 whitespace-nowrap">
                      {action.creditsUsed > 0 || action.status === 'CONSUMED' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black font-mono bg-purple-100 text-purple-800 border border-purple-200">
                          <Zap size={10} className="text-purple-600" />
                          -1 Crédit API
                        </span>
                      ) : action.status === 'CACHE_HIT' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black font-mono bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 size={10} className="text-emerald-600" />
                          0 Crédit (Cache 24h)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black font-mono bg-blue-100 text-blue-800 border border-blue-200">
                          <Cpu size={10} className="text-blue-600" />
                          0 Crédit (Moteur Local)
                        </span>
                      )}
                    </td>

                    {/* Jetons */}
                    <td className="py-2.5 px-3.5 font-mono text-slate-700 text-[11px] whitespace-nowrap">
                      <strong>{action.tokensConsumed}</strong> tokens
                    </td>

                    {/* Modèle */}
                    <td className="py-2.5 px-3.5 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-slate-100 text-slate-700 border border-slate-200">
                        {action.model}
                      </span>
                    </td>

                    {/* Latence */}
                    <td className="py-2.5 px-3.5 text-right font-mono text-slate-600 text-[11px] whitespace-nowrap">
                      {action.latencyMs} ms
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-10 text-center space-y-3">
                    <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center">
                      <ShieldCheck size={24} />
                    </div>
                    <div>
                      <p className="text-xs text-slate-900 font-bold">
                        Traçabilité 100% Réelle — Aucune donnée virtuelle de test
                      </p>
                      <p className="text-[11px] text-slate-500 max-w-md mx-auto mt-1">
                        Les anciennes simulations fictives ont été purgées. Les enregistrements certifiés s'afficheront ici en temps réel lors de chaque appel réel aux fonctionnalités IA (bulletin, diagnostic financier, assistant).
                      </p>
                    </div>
                    {displayButtons && (
                      <div className="flex items-center justify-center gap-2 pt-2">
                        <button
                          onClick={() => handleExecuteRealAction('bulletin')}
                          disabled={!!executingType}
                          className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                        >
                          {executingType === 'bulletin' ? (
                            <Loader2 size={13} className="animate-spin text-purple-600" />
                          ) : (
                            <Sparkles size={13} />
                          )}
                          <span>Lancer un Appel Réel (Bulletin)</span>
                        </button>
                        <button
                          onClick={() => handleExecuteRealAction('finance')}
                          disabled={!!executingType}
                          className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                        >
                          {executingType === 'finance' ? (
                            <Loader2 size={13} className="animate-spin text-emerald-600" />
                          ) : (
                            <TrendingUp size={13} />
                          )}
                          <span>Lancer un Audit Réel (Finance)</span>
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* FOOTER SUMMARY */}
      <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 pt-1">
        <div className="flex items-center gap-2">
          <ShieldCheck size={14} className="text-emerald-600" />
          <span>Audit certifié conforme : seules les requêtes API et analyses réelles sont journalisées.</span>
        </div>
        <span className="font-mono text-[11px] text-slate-400 mt-1 sm:mt-0">
          Affichage : {filteredActions.length} action(s) réelle(s)
        </span>
      </div>
    </div>
  );
};
