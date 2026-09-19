import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  TrendingUp, 
  X, 
  Search, 
  ArrowUpDown, 
  Download, 
  Copy, 
  Check, 
  Layers, 
  Award, 
  Sparkles,
  School,
  FileSpreadsheet
} from 'lucide-react';
import { toast } from 'sonner';

export interface ClassRevenueItem {
  name: string;
  montant: number;
}

interface ClassRevenueModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: ClassRevenueItem[];
  totalCollected: number;
  hasUSD?: boolean;
  schoolName?: string;
  terminology?: {
    option?: string;
    options?: string;
    student?: string;
    students?: string;
    tuition?: string;
    [key: string]: any;
  };
}

export const ClassRevenueModal: React.FC<ClassRevenueModalProps> = ({
  isOpen,
  onClose,
  data = [],
  totalCollected = 0,
  hasUSD = false,
  schoolName,
  terminology = {}
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc' | 'alpha'>('desc');
  const [copied, setCopied] = useState(false);

  // Label dynamiques respectant la terminologie d'École Connectée
  const optionLabel = terminology.option || 'Classe';
  const optionsLabel = terminology.options || 'Classes';

  // Fermeture par touche Echap
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Réinitialiser la recherche à l'ouverture
  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setSortOrder('desc');
    }
  }, [isOpen]);

  // Données filtrées et triées
  const processedData = useMemo(() => {
    let result = data.filter(item => 
      item.name.toLowerCase().includes(searchTerm.trim().toLowerCase())
    );

    if (sortOrder === 'desc') {
      result.sort((a, b) => b.montant - a.montant);
    } else if (sortOrder === 'asc') {
      result.sort((a, b) => a.montant - b.montant);
    } else if (sortOrder === 'alpha') {
      result.sort((a, b) => a.name.localeCompare(b.name, 'fr', { numeric: true }));
    }

    return result;
  }, [data, searchTerm, sortOrder]);

  // Métriques de synthèse compactes
  const metrics = useMemo(() => {
    const totalCount = data.length;
    const contributingCount = data.filter(d => d.montant > 0).length;
    const average = contributingCount > 0 ? Math.round(totalCollected / contributingCount) : 0;
    const topItem = [...data].sort((a, b) => b.montant - a.montant)[0];
    const topPercentage = (totalCollected > 0 && topItem) 
      ? ((topItem.montant / totalCollected) * 100).toFixed(1) 
      : '0.0';
    const maxMontant = data.length > 0 ? Math.max(...data.map(d => d.montant), 1) : 1;

    return {
      totalCount,
      contributingCount,
      average,
      topItem,
      topPercentage,
      maxMontant
    };
  }, [data, totalCollected]);

  // Export CSV
  const handleExportCSV = () => {
    if (data.length === 0) {
      toast.error("Aucune donnée à exporter.");
      return;
    }

    const headers = [`"${optionLabel}"`, '"Montant Collecté (HTG)"', '"% du Total"'];
    const rows = processedData.map(item => {
      const pct = totalCollected > 0 ? ((item.montant / totalCollected) * 100).toFixed(1) : '0.0';
      return [`"${item.name}"`, item.montant, `"${pct}%"`].join(',');
    });

    const csvContent = [
      `"Recettes par ${optionLabel} - ${schoolName || 'École Connectée'}"`,
      `"Total Général: ${totalCollected.toLocaleString()} HTG eq."`,
      `"Date: ${new Date().toLocaleDateString('fr-FR')}"`,
      '',
      headers.join(','),
      ...rows
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `recettes_par_${optionLabel.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success("Fichier CSV exporté avec succès.");
  };

  // Copier le résumé texte
  const handleCopySummary = () => {
    if (data.length === 0) return;

    const lines = [
      `📊 Recettes par ${optionLabel} (Global) - ${schoolName || 'École Connectée'}`,
      `Total Général: ${totalCollected.toLocaleString()} HTG${hasUSD ? ' eq.' : ''}`,
      `Date: ${new Date().toLocaleDateString('fr-FR')}`,
      '----------------------------------------',
      ...processedData.map((item, idx) => {
        const pct = totalCollected > 0 ? ((item.montant / totalCollected) * 100).toFixed(1) : '0';
        return `${idx + 1}. ${item.name} : ${item.montant.toLocaleString()} HTG (${pct}%)`;
      })
    ];

    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    toast.success("Bilan copié dans le presse-papier !");
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-2.5 sm:p-4 md:p-6 bg-slate-900/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200/80 w-full max-w-2xl max-h-[92vh] sm:max-h-[88vh] flex flex-col overflow-hidden text-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            {/* EN-TÊTE COMPACT ET MODERNE */}
            <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 bg-gradient-to-r from-emerald-50/50 via-teal-50/25 to-transparent flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 sm:w-11 sm:h-11 bg-emerald-100/80 text-emerald-700 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 shadow-xs border border-emerald-200/60">
                  <TrendingUp size={22} className="stroke-[2.2]" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight truncate leading-tight">
                      Recettes par {optionLabel} <span className="text-emerald-700 text-sm sm:text-base font-bold">(Global)</span>
                    </h3>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/70 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      École Connectée
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 truncate mt-0.5">
                    Détail consolidé des encaissements effectifs • {data.length} {optionsLabel.toLowerCase()}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={handleExportCSV}
                  title="Exporter au format CSV"
                  className="p-2 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50/80 rounded-xl transition-colors hidden sm:inline-flex items-center justify-center"
                >
                  <FileSpreadsheet size={18} />
                </button>
                <button
                  onClick={handleCopySummary}
                  title="Copier le résumé dans le presse-papier"
                  className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50/80 rounded-xl transition-colors hidden sm:inline-flex items-center justify-center"
                >
                  {copied ? <Check size={18} className="text-emerald-600" /> : <Copy size={18} />}
                </button>
                <button 
                  onClick={onClose}
                  className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                  title="Fermer (Échap)"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* BANDEAU SYNTHÉTIQUE COMPACT (KPIs RAPIDES) */}
            <div className="px-4 sm:px-6 py-2.5 bg-slate-50/70 border-b border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs shrink-0">
              <div className="bg-white/80 p-2 rounded-xl border border-slate-200/60 shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">Total Collecté</span>
                <span className="text-xs sm:text-sm font-black text-emerald-700 font-mono block truncate">
                  {totalCollected.toLocaleString()} <span className="text-[10px] font-normal text-slate-400">HTG</span>
                </span>
              </div>
              <div className="bg-white/80 p-2 rounded-xl border border-slate-200/60 shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">{optionsLabel} Actives</span>
                <span className="text-xs sm:text-sm font-black text-slate-800 font-mono block truncate">
                  {metrics.contributingCount} <span className="text-[10px] font-normal text-slate-400">/ {metrics.totalCount}</span>
                </span>
              </div>
              <div className="bg-white/80 p-2 rounded-xl border border-slate-200/60 shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">Moyenne / {optionLabel}</span>
                <span className="text-xs sm:text-sm font-black text-indigo-600 font-mono block truncate">
                  {metrics.average.toLocaleString()} <span className="text-[10px] font-normal text-slate-400">HTG</span>
                </span>
              </div>
              <div className="bg-white/80 p-2 rounded-xl border border-slate-200/60 shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">Leader Collecte</span>
                <span className="text-xs sm:text-sm font-black text-slate-900 truncate block" title={metrics.topItem?.name}>
                  {metrics.topItem ? metrics.topItem.name : '—'} <span className="text-[10px] text-emerald-600 font-bold font-mono">({metrics.topPercentage}%)</span>
                </span>
              </div>
            </div>

            {/* BARRE D'OUTILS COMPACTE : RECHERCHE & TRI */}
            <div className="px-4 sm:px-6 py-2.5 bg-white border-b border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 shrink-0">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={`Rechercher une ${optionLabel.toLowerCase()}...`}
                  className="w-full pl-9 pr-8 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 justify-between sm:justify-end text-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">Tri:</span>
                <button
                  onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : sortOrder === 'asc' ? 'alpha' : 'desc')}
                  className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl border border-slate-200/80 font-bold text-[11px] transition-all flex items-center gap-1.5 shadow-2xs shrink-0"
                  title="Changer l'ordre de tri"
                >
                  <ArrowUpDown size={12} className="text-slate-400" />
                  <span>
                    {sortOrder === 'desc' && 'Montant (Décroissant)'}
                    {sortOrder === 'asc' && 'Montant (Croissant)'}
                    {sortOrder === 'alpha' && 'Nom (A-Z)'}
                  </span>
                </button>

                <span className="text-[11px] font-bold text-slate-500 bg-slate-100/80 px-2 py-1 rounded-lg">
                  {processedData.length} {processedData.length > 1 ? optionsLabel.toLowerCase() : optionLabel.toLowerCase()}
                </span>
              </div>
            </div>

            {/* CORPS DE TABLE DENSE, ERGONOMIQUE ET RESPONSIVE */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-3 sm:px-6 py-2.5 space-y-1.5 min-h-[180px]">
              {processedData.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <Layers size={32} className="mx-auto text-slate-300 stroke-[1.5]" />
                  <p className="text-sm font-semibold">Aucune {optionLabel.toLowerCase()} trouvée</p>
                  <p className="text-xs text-slate-400">Modifiez votre recherche ou réinitialisez le filtre.</p>
                </div>
              ) : (
                <>
                  {/* EN-TÊTE DE COLONNES (Visible sur écran moyen et large) */}
                  <div className="hidden sm:grid sm:grid-cols-12 text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 py-1.5 border-b border-slate-100">
                    <div className="col-span-1 text-center">Rang</div>
                    <div className="col-span-4">{optionLabel}</div>
                    <div className="col-span-3 text-center">Poids relatif</div>
                    <div className="col-span-2 text-right">Montant</div>
                    <div className="col-span-2 text-right">% Total</div>
                  </div>

                  {/* LIGNES OPTIMISÉES DENSES */}
                  <div className="space-y-1 sm:space-y-1">
                    {processedData.map((item, idx) => {
                      const percentage = totalCollected > 0 
                        ? ((item.montant / totalCollected) * 100).toFixed(1) 
                        : '0.0';
                      const relativeWidth = metrics.maxMontant > 0 
                        ? Math.min(100, Math.max(2, (item.montant / metrics.maxMontant) * 100))
                        : 0;

                      // Badge de rang prestigieux pour le top 3
                      const isTop1 = idx === 0 && sortOrder === 'desc';
                      const isTop2 = idx === 1 && sortOrder === 'desc';
                      const isTop3 = idx === 2 && sortOrder === 'desc';

                      return (
                        <div
                          key={item.name}
                          className="group bg-slate-50/40 hover:bg-emerald-50/40 border border-slate-100/80 hover:border-emerald-200/60 rounded-xl px-2.5 sm:px-3 py-2 transition-all flex flex-col sm:grid sm:grid-cols-12 sm:items-center gap-1.5 sm:gap-2"
                        >
                          {/* VUE DESKTOP & TABLETTE */}
                          <div className="sm:col-span-1 hidden sm:flex items-center justify-center">
                            {isTop1 ? (
                              <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black flex items-center justify-center border border-amber-300 shadow-2xs">
                                1
                              </span>
                            ) : isTop2 ? (
                              <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-800 text-[10px] font-black flex items-center justify-center border border-slate-300">
                                2
                              </span>
                            ) : isTop3 ? (
                              <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-800 text-[10px] font-black flex items-center justify-center border border-orange-200">
                                3
                              </span>
                            ) : (
                              <span className="text-[11px] font-bold text-slate-400 font-mono">
                                #{idx + 1}
                              </span>
                            )}
                          </div>

                          <div className="sm:col-span-4 flex items-center justify-between sm:justify-start gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="sm:hidden text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                                #{idx + 1}
                              </span>
                              <span className="font-bold text-slate-800 text-xs sm:text-sm truncate" title={item.name}>
                                {item.name}
                              </span>
                            </div>

                            {/* Montant mobile affiché en ligne */}
                            <div className="sm:hidden text-right">
                              <span className="font-black text-slate-900 text-xs font-mono">
                                {item.montant.toLocaleString()} <span className="text-[9px] text-slate-400 font-normal">HTG</span>
                              </span>
                            </div>
                          </div>

                          {/* BARRE DE PROGRESSION VISUELLE FLUIDE */}
                          <div className="sm:col-span-3 w-full">
                            <div className="w-full bg-slate-200/70 h-1.5 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  isTop1 ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : 'bg-emerald-500'
                                }`}
                                style={{ width: `${relativeWidth}%` }}
                              />
                            </div>
                          </div>

                          <div className="sm:col-span-2 hidden sm:block text-right font-black text-slate-900 text-xs font-mono">
                            {item.montant.toLocaleString()} <span className="text-[10px] text-slate-400 font-normal">HTG</span>
                          </div>

                          <div className="sm:col-span-2 flex items-center justify-between sm:justify-end gap-1.5">
                            <span className="sm:hidden text-[10px] text-slate-400 font-medium">Part de la classe :</span>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-bold font-mono border ${
                              Number(percentage) >= 10 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60'
                                : 'bg-blue-50 text-blue-700 border-blue-200/60'
                            }`}>
                              {percentage}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* PIED DE PAGE COMPACT & CONSOLIDÉ */}
            <div className="px-4 sm:px-6 py-3 bg-slate-50/90 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0">
              <div>
                <span className="text-[11px] font-black text-slate-800 uppercase tracking-widest block">
                  Total Général Encaissé
                </span>
                <p className="text-[10px] text-slate-400 font-medium">
                  Versements effectifs validés • Système de gestion École Connectée
                </p>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-3">
                <div className="text-right">
                  <div className="text-base sm:text-lg font-black text-emerald-600 font-mono tracking-tight leading-none">
                    {totalCollected.toLocaleString()} <span className="text-xs font-bold text-slate-500">HTG{hasUSD ? ' eq.' : ''}</span>
                  </div>
                  {hasUSD && (
                    <span className="text-[9px] text-slate-400 font-semibold block uppercase tracking-wider">
                      Équivalence HTG
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer shrink-0"
                >
                  Fermer
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
