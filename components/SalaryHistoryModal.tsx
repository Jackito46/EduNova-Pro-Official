
import React, { useState, useEffect, useMemo } from 'react';
import { 
  History, X, ArrowUpRight, ArrowDownRight, User, Calendar, 
  FileText, Loader2, TrendingUp, TrendingDown, Minus, 
  Search, ShieldCheck, DollarSign, Clock, Filter
} from 'lucide-react';
import { StaffMember, StaffSalaryHistory } from '../types';
import { supabase } from '../supabase';
import { formatStudentName } from '../utils/formatters';
import { useSchool } from '../contexts/SchoolContext';

interface SalaryHistoryModalProps {
  staff: StaffMember;
  isOpen: boolean;
  onClose: () => void;
}

const SalaryHistoryModal: React.FC<SalaryHistoryModalProps> = ({ staff, isOpen, onClose }) => {
  const { terminology } = useSchool();
  const [history, setHistory] = useState<StaffSalaryHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
    }
  }, [isOpen, staff.id]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      let { data, error } = await supabase
        .from('staff_salary_history')
        .select(`
          *,
          creator:profiles(full_name)
        `)
        .eq('staff_id', staff.id)
        .order('created_at', { ascending: false });

      if (error) {
        const { data: rawData, error: rawError } = await supabase
          .from('staff_salary_history')
          .select('*')
          .eq('staff_id', staff.id)
          .order('created_at', { ascending: false });

        if (rawError) throw rawError;
        data = rawData;
      }

      setHistory(data || []);
    } catch (error) {
      console.error('Error fetching salary history:', error);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  // Statistiques calculées sur l'historique
  const stats = useMemo(() => {
    const current = Number(staff.amount) || 0;
    if (history.length === 0) {
      return {
        initialAmount: current,
        totalEvolution: 0,
        evolutionPercent: 0,
        totalAdjustments: 0
      };
    }
    const oldest = history[history.length - 1];
    const initial = Number(oldest.old_amount) || Number(oldest.new_amount) || current;
    const diff = current - initial;
    const percent = initial > 0 ? (diff / initial) * 100 : 0;
    return {
      initialAmount: initial,
      totalEvolution: diff,
      evolutionPercent: percent,
      totalAdjustments: history.length
    };
  }, [history, staff.amount]);

  // Filtrage des enregistrements
  const filteredHistory = useMemo(() => {
    if (!searchQuery.trim()) return history;
    const q = searchQuery.toLowerCase();
    return history.filter(h => 
      (h.change_reason && h.change_reason.toLowerCase().includes(q)) ||
      (h.effective_date && h.effective_date.includes(q)) ||
      (h.creator?.full_name && h.creator.full_name.toLowerCase().includes(q)) ||
      String(h.new_amount).includes(q)
    );
  }, [history, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden border border-slate-200/90 flex flex-col max-h-[90vh] transition-all">
        
        {/* Header Compact & Dense */}
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 border border-indigo-200/60 shadow-2xs">
              <History size={18} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight leading-tight">
                  Historique Salarial
                </h3>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {staff.pay_type || 'Mensuel'}
                </span>
              </div>
              <p className="text-[11px] font-semibold text-slate-500 truncate mt-0.5">
                {formatStudentName(staff.last_name, staff.first_name).fullName}
                {staff.role && <span className="ml-1 text-slate-400">• {staff.role}</span>}
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-700 p-1.5 hover:bg-slate-200/60 rounded-xl transition-colors shrink-0"
            title="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Barre de Métriques & Vue d'ensemble (Style Pilules / Cartes Denses) */}
        <div className="p-3 sm:px-5 sm:py-3 bg-slate-50/60 border-b border-slate-100 shrink-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            
            {/* Salaire Actuel */}
            <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Salaire Actuel</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-sm sm:text-base font-mono font-black text-slate-900">
                  {Number(staff.amount || 0).toLocaleString()}
                </span>
                <span className="text-[10px] font-bold text-slate-500">HTG</span>
              </div>
            </div>

            {/* Salaire Initial */}
            <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Initial Enregistré</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-sm sm:text-base font-mono font-black text-slate-700">
                  {stats.initialAmount.toLocaleString()}
                </span>
                <span className="text-[10px] font-bold text-slate-400">HTG</span>
              </div>
            </div>

            {/* Variation Totale */}
            <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Évolution Totale</span>
              <div className="flex items-center gap-1 mt-0.5">
                <span className={`text-xs sm:text-sm font-mono font-black flex items-center ${
                  stats.totalEvolution > 0 
                    ? 'text-emerald-700' 
                    : stats.totalEvolution < 0 
                    ? 'text-rose-700' 
                    : 'text-slate-600'
                }`}>
                  {stats.totalEvolution > 0 ? '+' : ''}{stats.totalEvolution.toLocaleString()} HTG
                </span>
                {stats.evolutionPercent !== 0 && (
                  <span className={`text-[10px] font-bold px-1 rounded ${
                    stats.totalEvolution > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}>
                    {stats.evolutionPercent > 0 ? '+' : ''}{stats.evolutionPercent.toFixed(1)}%
                  </span>
                )}
              </div>
            </div>

            {/* Révisions */}
            <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Ajustements</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-sm sm:text-base font-mono font-black text-indigo-900">
                  {stats.totalAdjustments}
                </span>
                <span className="text-[10px] font-medium text-slate-500">
                  {stats.totalAdjustments > 1 ? 'mises à jour' : 'mise à jour'}
                </span>
              </div>
            </div>

          </div>

          {/* Recherche si plus de 2 éléments */}
          {history.length > 2 && (
            <div className="mt-2.5 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={13} />
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filtrer par motif, date ou administrateur..."
                className="w-full bg-white text-xs font-semibold pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/10 outline-none text-slate-800 placeholder:text-slate-400"
              />
            </div>
          )}
        </div>

        {/* Liste / Timeline fluide & moderne */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2.5">
              <Loader2 className="animate-spin text-indigo-600" size={28} />
              <p className="text-xs text-slate-500 font-semibold">Chargement de l'historique salarial...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12 px-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-2.5 shadow-2xs">
                <DollarSign size={24} />
              </div>
              <h4 className="text-sm font-bold text-slate-800">Aucun historique d'ajustement</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto font-medium">
                Le salaire actuel de cet employé est de <span className="font-bold text-slate-700">{Number(staff.amount || 0).toLocaleString()} HTG</span>. 
                Les ajustements futurs apparaîtront automatiquement ici avec traçabilité complète.
              </p>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="text-center py-8 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500">
              Aucun ajustement ne correspond à votre recherche "{searchQuery}".
            </div>
          ) : (
            <div className="space-y-3">
              {filteredHistory.map((record, index) => {
                const isIncrease = record.new_amount > record.old_amount;
                const isDecrease = record.new_amount < record.old_amount;
                const diff = record.new_amount - record.old_amount;
                const percent = record.old_amount > 0 ? (diff / record.old_amount) * 100 : 0;

                return (
                  <div 
                    key={record.id} 
                    className="p-3 sm:p-4 rounded-xl border border-slate-200/90 bg-white hover:border-indigo-300 shadow-2xs hover:shadow-xs transition-all space-y-2.5"
                  >
                    {/* Première ligne : Montants + Badges variation + Date */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Indicateur visuel d'augmentation / diminution */}
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          isIncrease 
                            ? 'bg-emerald-100 text-emerald-700' 
                            : isDecrease 
                            ? 'bg-rose-100 text-rose-700' 
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {isIncrease ? <ArrowUpRight size={16} /> : isDecrease ? <ArrowDownRight size={16} /> : <Minus size={14} />}
                        </div>

                        {/* Nouveau montant */}
                        <span className="text-base font-mono font-black text-slate-900">
                          {Number(record.new_amount).toLocaleString()} HTG
                        </span>

                        {/* Ancien montant barré */}
                        <span className="text-xs font-mono font-semibold text-slate-400 line-through">
                          {Number(record.old_amount).toLocaleString()} HTG
                        </span>

                        {/* Badge variation pill */}
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-0.5 border ${
                          isIncrease 
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                            : isDecrease 
                            ? 'bg-rose-50 text-rose-800 border-rose-200' 
                            : 'bg-slate-50 text-slate-700 border-slate-200'
                        }`}>
                          {isIncrease ? `+${diff.toLocaleString()} HTG (+${percent.toFixed(1)}%)` : isDecrease ? `${diff.toLocaleString()} HTG (${percent.toFixed(1)}%)` : 'Inchangé'}
                        </span>
                      </div>

                      {/* Date d'effet & Auteur (Pills compactes) */}
                      <div className="flex items-center gap-1.5 flex-wrap text-[11px] font-semibold text-slate-600">
                        <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/80">
                          <Calendar size={11} className="text-slate-500" />
                          Effet : {record.effective_date ? new Date(record.effective_date).toLocaleDateString() : 'N/A'}
                        </span>
                        {record.creator?.full_name && (
                          <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md border border-indigo-200/70">
                            <User size={11} className="text-indigo-600" />
                            {record.creator.full_name}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Bloc Motif : Haute Lisibilité (Texte sombre soutenu sur fond contrasté) */}
                    <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80 flex items-start gap-2">
                      <FileText size={14} className="text-indigo-600 shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-800 leading-relaxed break-words">
                          {record.change_reason || 'Aucun motif renseigné'}
                        </p>
                      </div>
                    </div>

                    {/* Footer discret de métadonnées */}
                    <div className="flex items-center justify-between text-[10px] font-medium text-slate-600 pt-0.5">
                      <span className="flex items-center gap-1">
                        <ShieldCheck size={11} className="text-slate-600" /> Enregistrement certifié
                      </span>
                      <span className="font-mono">
                        Saisi le {new Date(record.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer simple */}
        <div className="px-4 py-2.5 sm:px-5 border-t border-slate-100 flex items-center justify-between bg-slate-50/60 shrink-0">
          <span className="text-[11px] font-semibold text-slate-500">
            {filteredHistory.length} entrée{filteredHistory.length > 1 ? 's' : ''} au registre
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
          >
            Fermer
          </button>
        </div>

      </div>
    </div>
  );
};

export default SalaryHistoryModal;

