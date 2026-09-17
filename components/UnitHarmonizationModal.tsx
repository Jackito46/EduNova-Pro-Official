import React, { useState, useMemo } from 'react';
import { 
  X, 
  Sparkles, 
  Check, 
  RefreshCw, 
  Save, 
  AlertCircle, 
  Search, 
  SlidersHorizontal,
  Layers,
  Tag,
  BookOpen,
  Shirt,
  Package,
  FileText
} from 'lucide-react';
import { toast } from 'sonner';
import { CatalogItem } from '../types';
import { supabase } from '../supabase';
import { AuditLogger } from '../utils/auditLogger';
import { 
  STANDARD_SUPPLY_UNITS, 
  detectItemUnit, 
  formatQuantityWithUnit, 
  extractCleanDiscipline, 
  encodeDisciplineWithUnit, 
  resolveItemUnit 
} from '../utils/supplyUnits';

interface UnitHarmonizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  catalog: CatalogItem[];
  user: any;
  onSuccess: () => void;
}

export const UnitHarmonizationModal: React.FC<UnitHarmonizationModalProps> = ({
  isOpen,
  onClose,
  catalog,
  user,
  onSuccess
}) => {
  if (!isOpen) return null;

  // Local state holding the working unit for each item
  const [itemUnits, setItemUnits] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    catalog.forEach(item => {
      initial[item.id] = resolveItemUnit(item);
    });
    return initial;
  });

  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState('Tous');
  const [isSaving, setIsSaving] = useState(false);

  // Compute how many items differ from their current saved unit
  const modifiedCount = useMemo(() => {
    let count = 0;
    catalog.forEach(item => {
      const currentUnit = resolveItemUnit(item);
      if (itemUnits[item.id] && itemUnits[item.id] !== currentUnit) {
        count++;
      }
    });
    return count;
  }, [catalog, itemUnits]);

  // Distinct units present in current config
  const activeUnitsList = useMemo(() => {
    const set = new Set(Object.values(itemUnits));
    return Array.from(set).filter(Boolean);
  }, [itemUnits]);

  // Filtered items
  const filteredItems = useMemo(() => {
    return catalog.filter(item => {
      if (selectedCat !== 'Tous' && item.category !== selectedCat) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchLabel = (item.label || '').toLowerCase().includes(q);
        const matchCat = (item.category || '').toLowerCase().includes(q);
        const matchUnit = (itemUnits[item.id] || '').toLowerCase().includes(q);
        return matchLabel || matchCat || matchUnit;
      }
      return true;
    });
  }, [catalog, selectedCat, search, itemUnits]);

  // Auto-detect button: sets natural unit for every item in catalog
  const handleAutoDetectAll = () => {
    const nextUnits: Record<string, string> = { ...itemUnits };
    let changed = 0;

    catalog.forEach(item => {
      const suggested = detectItemUnit(item.label, item.category);
      if (suggested && suggested !== nextUnits[item.id]) {
        nextUnits[item.id] = suggested;
        changed++;
      }
    });

    setItemUnits(nextUnits);
    toast.success(`✨ Détection appliquée : ${changed} article(s) mis à jour avec leur unité naturelle (Aunes, Rames, Exemplaires, Boîtes...) !`);
  };

  // Change single item unit
  const handleUnitChange = (itemId: string, newUnit: string) => {
    setItemUnits(prev => ({
      ...prev,
      [itemId]: newUnit
    }));
  };

  // Save all modified units to database
  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      let saved = 0;
      for (const item of catalog) {
        const chosenUnit = itemUnits[item.id] || 'Pièce';
        const currentSavedUnit = resolveItemUnit(item);

        // Update if modified or if we want to ensure persistence
        if (chosenUnit !== currentSavedUnit || !item.unit_measure) {
          const cleanDisc = extractCleanDiscipline(item.discipline_name) || '';
          const encodedDisc = encodeDisciplineWithUnit(cleanDisc, chosenUnit);

          const payloadWithUnit: any = {
            discipline_name: encodedDisc,
            unit_measure: chosenUnit
          };

          const payloadFallback: any = {
            discipline_name: encodedDisc
          };

          const { error: err1 } = await supabase
            .from('supply_catalog')
            .update(payloadWithUnit)
            .eq('id', item.id)
            .eq('school_id', user.school_id);

          if (err1) {
            // Fallback if column unit_measure is absent from cache
            await supabase
              .from('supply_catalog')
              .update(payloadFallback)
              .eq('id', item.id)
              .eq('school_id', user.school_id);
          }
          saved++;
        }
      }

      AuditLogger.log({
        school_id: user.school_id,
        user_id: user.id,
        action: 'UPDATE',
        entity_type: 'settings',
        details: { type: 'batch_unit_harmonization', count: saved }
      });

      toast.success(`✅ Unités enregistrées avec succès pour les articles du catalogue !`);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Erreur sauvegarde unités:", err);
      toast.error("Erreur lors de l'enregistrement : " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const categories = ['Tous', 'Uniforme', 'Manuel', 'Fourniture', 'Papeterie', 'Service'];

  return (
    <div className="fixed inset-0 z-[1000] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 md:p-6 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
        
        {/* HEADER DENSE & PROFESSIONNEL */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center border border-indigo-500/30 shrink-0 shadow-2xs">
              <Layers size={20} className="text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 text-[9px] font-black uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Harmonisation Économat
                </span>
                <span className="text-slate-400 text-xs hidden sm:inline">• Contrôle des conditionnements</span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-white tracking-tight leading-tight mt-0.5">
                Re-vérification des Unités de Mesure
              </h3>
            </div>
          </div>

          <button 
            type="button"
            onClick={onClose} 
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            title="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        {/* SUB-HEADER / ACTIONS D'AIDE */}
        <div className="bg-indigo-950/30 border-b border-indigo-100 p-4 shrink-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <p className="text-xs text-slate-700 font-medium leading-relaxed">
              Assurez-vous que chaque article est exprimé dans sa véritable unité de vente et de gestion de stock : 
              <strong className="text-slate-900 font-bold"> Aunes</strong> (tissus), 
              <strong className="text-slate-900 font-bold"> Rames</strong> (papier), 
              <strong className="text-slate-900 font-bold"> Exemplaires</strong> (manuels), 
              <strong className="text-slate-900 font-bold"> Boîtes</strong> (craies), etc.
            </p>
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Unités détectées :</span>
              {activeUnitsList.map(u => (
                <span key={u} className="px-2 py-0.2 bg-white text-indigo-700 rounded-md text-[10px] font-mono font-bold border border-indigo-200/80 shadow-2xs">
                  {u}
                </span>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={handleAutoDetectAll}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-xs active:scale-95 shrink-0"
            title="Analyser les libellés et appliquer automatiquement l'unité la plus pertinente"
          >
            <Sparkles size={14} className="text-amber-300" />
            <span>Détection Automatique Intelligente</span>
          </button>
        </div>

        {/* TOOLBAR FILTRES */}
        <div className="p-3 border-b border-slate-100 bg-slate-50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0">
          <div className="relative flex-1 sm:max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher un article..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-indigo-600"
            />
          </div>

          <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
            {categories.map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCat(cat)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedCat === cat 
                    ? 'bg-slate-900 text-white shadow-xs font-bold' 
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* TABLE DES ARTICLES & SÉLECTION D'UNITÉ */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100/80 text-[10px] font-black uppercase text-slate-600 border-b border-slate-200">
                  <th className="px-4 py-3">Article / Désignation</th>
                  <th className="px-3 py-3 text-center">Catégorie</th>
                  <th className="px-3 py-3 text-center">Stock Actuel</th>
                  <th className="px-4 py-3">Unité de Conditionnement</th>
                  <th className="px-3 py-3 text-center">Aperçu Rendu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredItems.map(item => {
                  const currentUnit = itemUnits[item.id] || 'Pièce';
                  const suggested = detectItemUnit(item.label, item.category);
                  const isModified = currentUnit !== resolveItemUnit(item);

                  return (
                    <tr key={item.id} className={`hover:bg-slate-50 transition-colors ${isModified ? 'bg-indigo-50/40' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900 text-sm">
                          {item.label}
                        </div>
                        {item.discipline_name && (
                          <div className="text-[10px] text-slate-400 font-medium">
                            {extractCleanDiscipline(item.discipline_name)}
                          </div>
                        )}
                      </td>

                      <td className="px-3 py-3 text-center">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[10px] font-semibold border border-slate-200">
                          {item.category}
                        </span>
                      </td>

                      <td className="px-3 py-3 text-center font-mono font-bold text-slate-800">
                        {item.stock_quantity ?? 0}
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <select
                            value={currentUnit}
                            onChange={e => handleUnitChange(item.id, e.target.value)}
                            className="px-3 py-1.5 bg-white border border-slate-200 focus:border-indigo-600 rounded-xl text-xs font-bold text-slate-900 outline-none transition-all shadow-2xs cursor-pointer"
                          >
                            {STANDARD_SUPPLY_UNITS.map(opt => (
                              <option key={opt.value} value={opt.value}>
                                {opt.value} — {opt.label}
                              </option>
                            ))}
                            {!STANDARD_SUPPLY_UNITS.some(u => u.value === currentUnit) && (
                              <option value={currentUnit}>{currentUnit} (Personnalisé)</option>
                            )}
                          </select>

                          {suggested && suggested !== currentUnit && (
                            <button
                              type="button"
                              onClick={() => handleUnitChange(item.id, suggested)}
                              className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg text-[10px] font-bold border border-amber-200 transition-all flex items-center gap-1 cursor-pointer"
                              title={`Suggérer: ${suggested}`}
                            >
                              <Sparkles size={11} className="text-amber-600" />
                              <span>Mettre en {suggested}</span>
                            </button>
                          )}
                        </div>
                      </td>

                      <td className="px-3 py-3 text-center">
                        <span className="px-2.5 py-1 bg-indigo-50 text-indigo-800 rounded-lg font-bold text-xs border border-indigo-200 font-mono shadow-2xs">
                          {formatQuantityWithUnit(item.stock_quantity ?? 0, currentUnit)}
                        </span>
                      </td>
                    </tr>
                  );
                })}

                {filteredItems.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-slate-400 text-xs font-bold">
                      Aucun article ne correspond à votre recherche.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* FOOTER ACTIONS */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 font-medium">
            <span className="font-bold text-slate-900">{catalog.length}</span> article(s) au catalogue
            {modifiedCount > 0 && (
              <span className="ml-2 font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                • {modifiedCount} modification(s) en attente
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition-all cursor-pointer"
            >
              Annuler
            </button>

            <button
              type="button"
              onClick={handleSaveAll}
              disabled={isSaving}
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95"
            >
              {isSaving ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Enregistrement...</span>
                </>
              ) : (
                <>
                  <Check size={14} className="text-emerald-400" />
                  <span>Enregistrer les Unités ({catalog.length})</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
