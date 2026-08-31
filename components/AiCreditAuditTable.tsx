import React, { useState, useEffect, useCallback } from 'react';
import { 
  History, 
  RefreshCw, 
  Sparkles, 
  Clock, 
  FileText, 
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
  Plus
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  aiCreditTrackingService, 
  AiCreditAuditAction 
} from '../services/aiCreditTrackingService';

interface AiCreditAuditTableProps {
  schoolId?: string;
  limit?: number;
  showSimulateButton?: boolean;
}

export const AiCreditAuditTable: React.FC<AiCreditAuditTableProps> = ({
  schoolId = 'default-school',
  limit = 10,
  showSimulateButton = true
}) => {
  const [actions, setActions] = useState<AiCreditAuditAction[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const loadAuditLogs = useCallback(() => {
    setLoading(true);
    try {
      const logs = aiCreditTrackingService.getRecentCreditActions(limit, true);
      setActions(logs);
    } catch (e) {
      console.error("Error loading credit audit logs:", e);
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

  // Ajouter une action de test pour valider l'audit en direct
  const handleSimulateAction = (featureName: string, category: 'PEDAGOGY' | 'FINANCE' | 'ADMIN' | 'ASSISTANT' | 'SYSTEM') => {
    const recorded = aiCreditTrackingService.recordAuditAction({
      featureName,
      featureCategory: category,
      creditsUsed: 1,
      tokensConsumed: Math.floor(Math.random() * 250) + 180,
      model: 'Gemini 2.5 Flash',
      latencyMs: Math.floor(Math.random() * 120) + 140,
      status: 'CONSUMED',
      summary: `Action déclenchée manuellement pour audit et vérification des quotas`
    });

    // Mettre à jour les quotas globaux
    aiCreditTrackingService.recordUsage(schoolId, recorded.tokensConsumed, false, false);
    
    toast.success(`Action auditée : "${featureName}" (-1 Crédit)`);
    loadAuditLogs();
  };

  const handleClear = () => {
    aiCreditTrackingService.clearAuditLogs();
    setActions([]);
    toast.info("Journal d'audit des crédits IA réinitialisé.");
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
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Table d'Audit Simplifiée des Crédits IA
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-100 text-purple-800 border border-purple-200">
                10 Dernières Actions
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Traçabilité chronologique des fonctionnalités ayant consommé des crédits API avec nom et horodatage certifié.
            </p>
          </div>
        </div>

        {/* ACTIONS & CONTROLS */}
        <div className="flex flex-wrap items-center gap-2">
          {showSimulateButton && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleSimulateAction("Génération Appréciation Bulletin", "PEDAGOGY")}
                className="px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                title="Simuler un appel de bulletin élève"
              >
                <Plus size={13} />
                <span>+ Bulletin</span>
              </button>
              <button
                onClick={() => handleSimulateAction("Audit & Diagnostic Financier", "FINANCE")}
                className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                title="Simuler un audit financier"
              >
                <Plus size={13} />
                <span>+ Finance</span>
              </button>
            </div>
          )}

          <button
            onClick={loadAuditLogs}
            disabled={loading}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            title="Rafraîchir la table d'audit"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>

          <button
            onClick={handleClear}
            className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl transition-colors cursor-pointer"
            title="Vider les logs d'audit"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs">
        <div className="relative w-full sm:w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher une fonctionnalité..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-purple-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap mr-1 flex items-center gap-1">
            <Filter size={12} />
            Filtre :
          </span>
          {[
            { id: 'ALL', label: 'Tous' },
            { id: 'PEDAGOGY', label: 'Pédagogie' },
            { id: 'FINANCE', label: 'Finances' },
            { id: 'ADMIN', label: 'Admin' },
            { id: 'ASSISTANT', label: 'Assistant' }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilterCategory(f.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                filterCategory === f.id
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* THE AUDIT TABLE */}
      <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-extrabold text-[11px] uppercase tracking-wider">
                <th className="py-2.5 px-3.5 w-12 text-center">#</th>
                <th className="py-2.5 px-3.5">Nom de la Fonctionnalité</th>
                <th className="py-2.5 px-3.5">Horodatage (Timestamp)</th>
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
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black font-mono bg-purple-100 text-purple-800 border border-purple-200">
                        <Zap size={10} className="text-purple-600" />
                        -1 Crédit API
                      </span>
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
                  <td colSpan={7} className="py-8 text-center space-y-2">
                    <p className="text-xs text-slate-500 font-medium">
                      Aucune action consommatrice de crédits enregistrée pour le moment.
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Dès qu'une fonctionnalité IA (bulletin, diagnostic financier, rédaction) est déclenchée, son enregistrement d'audit apparaîtra ici.
                    </p>
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
          <span>Audit conforme au règlement de sécurité et de conformité académique.</span>
        </div>
        <span className="font-mono text-[11px] text-slate-400 mt-1 sm:mt-0">
          Affichage : {filteredActions.length} / {Math.min(limit, actions.length)} action(s)
        </span>
      </div>
    </div>
  );
};
