import React, { useState } from 'react';
import { 
  X, 
  Package, 
  Plus, 
  Minus, 
  AlertTriangle, 
  Save, 
  RefreshCw, 
  CheckCircle2, 
  ClipboardCheck, 
  TrendingUp, 
  TrendingDown, 
  Sparkles,
  DollarSign
} from 'lucide-react';
import { CatalogItem } from '../types';

interface InventoryAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: CatalogItem | null;
  onSaveAdjustment: (data: {
    itemId: string;
    adjustmentType: 'set' | 'add' | 'subtract';
    quantity: number;
    newStock: number;
    reason: string;
    createExpense: boolean;
    costPerUnit?: number;
  }) => Promise<void>;
  isSubmitting: boolean;
}

export const InventoryAdjustmentModal: React.FC<InventoryAdjustmentModalProps> = ({
  isOpen,
  onClose,
  item,
  onSaveAdjustment,
  isSubmitting
}) => {
  if (!isOpen || !item) return null;

  const currentStock = item.stock_quantity ?? 0;
  const [adjustmentMode, setAdjustmentMode] = useState<'set' | 'add' | 'subtract'>('set');
  const [inputValue, setInputValue] = useState<string>(currentStock.toString());
  const [reason, setReason] = useState<string>('Comptage physique & inventaire');
  const [customReason, setCustomReason] = useState<string>('');
  const [createExpense, setCreateExpense] = useState<boolean>(false);
  const [unitCost, setUnitCost] = useState<string>('');

  const REASONS = [
    'Comptage physique & inventaire',
    'Casse, avarie ou détérioration',
    'Perte ou écart de magasin',
    'Donation ou dotation gratuite reçue',
    'Stock initial non répertorié',
    'Autre motif personnalisé'
  ];

  const parsedInput = parseFloat(inputValue) || 0;

  let calculatedNewStock = currentStock;
  if (adjustmentMode === 'set') {
    calculatedNewStock = parsedInput;
  } else if (adjustmentMode === 'add') {
    calculatedNewStock = currentStock + parsedInput;
  } else if (adjustmentMode === 'subtract') {
    calculatedNewStock = Math.max(0, currentStock - parsedInput);
  }

  const stockDifference = calculatedNewStock - currentStock;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (calculatedNewStock < 0) return;

    const finalReason = reason === 'Autre motif personnalisé' 
      ? (customReason.trim() || 'Ajustement manuel de stock') 
      : reason;

    await onSaveAdjustment({
      itemId: item.id,
      adjustmentType: adjustmentMode,
      quantity: Math.abs(stockDifference),
      newStock: calculatedNewStock,
      reason: finalReason,
      createExpense: createExpense && stockDifference > 0,
      costPerUnit: createExpense && parseFloat(unitCost) > 0 ? parseFloat(unitCost) : undefined
    });
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 md:p-6 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]">
        
        {/* HEADER */}
        <div className="p-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-500/20 text-indigo-300 rounded-xl flex items-center justify-center border border-indigo-500/30">
              <ClipboardCheck size={20} />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white tracking-tight leading-none">
                Ajustement Manuel de Stock
              </h3>
              <p className="text-[11px] text-slate-300 mt-1 truncate max-w-xs font-medium">
                {item.label}
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* FORM */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5">
          
          {/* ARTICLE RECAP */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                Catégorie & Discipline
              </span>
              <div className="text-xs font-bold text-slate-800 flex items-center gap-2">
                <span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded-md text-[10px]">
                  {item.category}
                </span>
                {item.discipline_name && (
                  <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md text-[10px] border border-indigo-100">
                    {item.discipline_name}
                  </span>
                )}
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                Stock Actuel
              </span>
              <div className="text-lg font-black font-mono text-slate-900">
                {currentStock} {item.unit_measure ? `/${item.unit_measure}` : 'unités'}
              </div>
            </div>
          </div>

          {/* MODE SELECTOR */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
              Type d'opération
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => { setAdjustmentMode('set'); setInputValue(currentStock.toString()); }}
                className={`py-2.5 px-3 rounded-xl text-xs font-extrabold transition-all flex flex-col items-center gap-1 border ${
                  adjustmentMode === 'set' 
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' 
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <ClipboardCheck size={16} />
                <span>Fixer Total</span>
              </button>

              <button
                type="button"
                onClick={() => { setAdjustmentMode('add'); setInputValue('1'); }}
                className={`py-2.5 px-3 rounded-xl text-xs font-extrabold transition-all flex flex-col items-center gap-1 border ${
                  adjustmentMode === 'add' 
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' 
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Plus size={16} />
                <span>Ajouter (+)</span>
              </button>

              <button
                type="button"
                onClick={() => { setAdjustmentMode('subtract'); setInputValue('1'); }}
                className={`py-2.5 px-3 rounded-xl text-xs font-extrabold transition-all flex flex-col items-center gap-1 border ${
                  adjustmentMode === 'subtract' 
                    ? 'bg-rose-600 text-white border-rose-600 shadow-sm' 
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Minus size={16} />
                <span>Retirer (-)</span>
              </button>
            </div>
          </div>

          {/* QUANTITY INPUT */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
              {adjustmentMode === 'set' ? 'Nouveau Stock Total Réel' : adjustmentMode === 'add' ? 'Quantité à ajouter' : 'Quantité à déduire'}
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="1"
                required
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl text-lg font-black font-mono text-slate-900 outline-none focus:border-indigo-600 transition-all"
                placeholder="0"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                {item.unit_measure || 'Unités'}
              </span>
            </div>
          </div>

          {/* SIMULATION RESULT BOX */}
          <div className="bg-slate-900 text-white p-4 rounded-xl flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold uppercase text-slate-400">
                Résultat Prévisionnel
              </span>
              <div className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <span>{currentStock}</span>
                <span>➔</span>
                <span className="font-black text-emerald-400 font-mono text-base">{calculatedNewStock}</span>
                <span>{item.unit_measure || 'unités'}</span>
              </div>
            </div>

            <div className={`px-3 py-1 rounded-lg text-xs font-black font-mono flex items-center gap-1 ${
              stockDifference > 0 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
              stockDifference < 0 ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
              'bg-slate-800 text-slate-400'
            }`}>
              {stockDifference > 0 && <TrendingUp size={14} />}
              {stockDifference < 0 && <TrendingDown size={14} />}
              <span>{stockDifference > 0 ? `+${stockDifference}` : stockDifference}</span>
            </div>
          </div>

          {/* MOTIF DE L'AJUSTEMENT */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
              Motif & Justification d'Inventaire
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-600"
            >
              {REASONS.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>

            {reason === 'Autre motif personnalisé' && (
              <input
                type="text"
                placeholder="Préciser le motif..."
                required
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-none focus:border-indigo-600"
              />
            )}
          </div>

          {/* ACTIONS */}
          <div className="pt-3 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 border border-slate-200 text-slate-600 font-bold text-xs rounded-xl hover:bg-slate-50 transition-all"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting || stockDifference === 0}
              className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting ? <RefreshCw size={15} className="animate-spin" /> : <Save size={15} />}
              <span>Valider l'Ajustement</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
