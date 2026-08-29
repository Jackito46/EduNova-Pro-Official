import React, { useState, useEffect } from 'react';
import { 
  Target, PieChart, TrendingUp, AlertTriangle, 
  Plus, Save, Trash2, Edit3, Calendar,
  DollarSign, CheckCircle2, Loader2, Info,
  ArrowRight, BarChart3
} from 'lucide-react';
import { supabase, isValidUuid } from '../supabase';
import { UserProfile } from '../types';
import { toast } from 'sonner';
import { useSchool } from '../contexts/SchoolContext';
import { AcademicSessionPill } from './AcademicSessionPill';

interface Budget {
  id: string;
  academic_year_id: string;
  category: string;
  planned_amount: number;
  actual_amount: number;
  created_at: string;
}

const BudgetPlanningView: React.FC<{ user: UserProfile }> = ({ user }) => {
  const { currentCampusId } = useSchool();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [selectedYearId, setSelectedYearId] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    id: '',
    category: '',
    planned_amount: ''
  });

  const [categories, setCategories] = useState<any[]>([]);

  const fetchContext = async () => {
    try {
      const { data: ayData } = await supabase
        .from('academic_years')
        .select('*')
        .eq('school_id', user.school_id)
        .order('label', { ascending: false });
      
      if (ayData) {
        setAcademicYears(ayData);
        const active = ayData.find(y => y.is_active || y.status === 'ACTIVE') || ayData[0];
        setSelectedYearId(active?.id || '');
      }

      const { data: catData } = await supabase
        .from('expense_categories')
        .select('*')
        .eq('school_id', user.school_id)
        .order('label');

      if (catData) {
        setCategories(catData);
      }
    } catch (err) {
      console.error("fetchContext error:", err);
    }
  };

  const fetchBudgets = async () => {
    if (!selectedYearId) return;
    setLoading(true);
    try {
      // 1. Fetch planned budgets
      let budgetQuery = supabase
        .from('budgets')
        .select('*')
        .eq('school_id', user.school_id)
        .eq('academic_year_id', selectedYearId);

      const activeCampusId = user.campus_id || currentCampusId;
      if (activeCampusId && isValidUuid(activeCampusId)) {
        budgetQuery = budgetQuery.eq('campus_id', activeCampusId);
      } else {
        budgetQuery = budgetQuery.is('campus_id', null);
      }

      const { data: budgetData, error: budgetError } = await budgetQuery;

      if (budgetError) throw budgetError;

      // 2. Fetch actual expenses for this year
      let expenseQuery = supabase
        .from('expenses')
        .select('amount, category_legacy, category_ref:expense_categories(label)')
        .eq('school_id', user.school_id)
        .eq('academic_year_id', selectedYearId);

      if (activeCampusId && isValidUuid(activeCampusId)) {
        expenseQuery = expenseQuery.eq('campus_id', activeCampusId);
      }

      const { data: expenseData } = await expenseQuery;

      // 3. Aggregate actuals
      const actualsMap: Record<string, number> = {};
      expenseData?.forEach(exp => {
        
        const catName = (Array.isArray(exp.category_ref) ? exp.category_ref[0]?.label : (exp.category_ref as any)?.label) || exp.category_legacy || 'Autre';
        actualsMap[catName] = (actualsMap[catName] || 0) + exp.amount;
      });

      const enrichedBudgets = budgetData?.map(b => ({
        ...b,
        actual_amount: actualsMap[b.category] || 0
      })) || [];

      setBudgets(enrichedBudgets);
    } catch (err: any) {
      console.error("Budget fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContext();
  }, []);

  useEffect(() => {
    fetchBudgets();
  }, [selectedYearId, currentCampusId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        school_id: user.school_id,
        academic_year_id: selectedYearId,
        campus_id: user.campus_id || currentCampusId || null,
        category: formData.category,
        planned_amount: parseFloat(formData.planned_amount)
      };

      if (formData.id) {
        await supabase.from('budgets').update(payload).eq('id', formData.id).eq('school_id', user.school_id);
        toast.success("Budget mis à jour");
      } else {
        await supabase.from('budgets').insert([payload]);
        toast.success("Budget créé");
      }
      setShowModal(false);
      fetchBudgets();
    } catch (err: any) {
      toast.error("Erreur: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalPlanned = budgets.reduce((acc, b) => acc + b.planned_amount, 0);
  const totalActual = budgets.reduce((acc, b) => acc + b.actual_amount, 0);
  const globalProgress = totalPlanned > 0 ? (totalActual / totalPlanned) * 100 : 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-indigo-600 text-white rounded-3xl flex items-center justify-center shadow-xl shadow-indigo-600/20 rotate-3">
            <Target size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter">Planification Budgétaire</h1>
            <p className="text-slate-500 font-medium">Définissez vos objectifs et suivez vos dépenses réelles.</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <AcademicSessionPill
            academicYears={academicYears}
            selectedYearId={selectedYearId}
            onSelectYear={(yearId) => setSelectedYearId(yearId)}
            size="md"
            colorScheme="indigo"
          />
          <button 
            onClick={() => {
              setFormData({ id: '', category: '', planned_amount: '' });
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all active:scale-95 cursor-pointer"
          >
            <Plus size={18} /> Nouveau Budget
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-2">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Prévu</p>
          <p className="text-3xl font-black text-slate-900 tracking-tighter">{totalPlanned.toLocaleString()} G</p>
          <div className="flex items-center gap-2 text-indigo-600 text-xs font-bold">
            <PieChart size={14} /> Allocation Annuelle
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-2">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Dépenses Réelles</p>
          <p className="text-3xl font-black text-slate-900 tracking-tighter">{totalActual.toLocaleString()} G</p>
          <div className="flex items-center gap-2 text-amber-600 text-xs font-bold">
            <TrendingUp size={14} /> Consommation Actuelle
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Utilisation</p>
            <span className={`text-xs font-black ${globalProgress > 90 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {globalProgress.toFixed(1)}%
            </span>
          </div>
          <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-1000 ${globalProgress > 90 ? 'bg-rose-500' : 'bg-emerald-500'}`}
              style={{ width: `${Math.min(globalProgress, 100)}%` }}
            />
          </div>
          <p className="text-[10px] font-bold text-slate-400">Basé sur les dépenses enregistrées</p>
        </div>
      </div>

      {/* Budget List */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 size={20} className="text-indigo-600" />
            Comparatif Prévisions vs Réel
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Catégorie</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Prévu</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Réel</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Écart</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Progression</th>
                <th className="px-8 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-8 py-12 text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto" />
                  </td>
                </tr>
              ) : budgets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-8 py-12 text-center text-slate-400 font-bold text-sm">
                    Aucun budget défini pour cette année.
                  </td>
                </tr>
              ) : (
                budgets.map((b) => {
                  const diff = b.planned_amount - b.actual_amount;
                  const progress = (b.actual_amount / b.planned_amount) * 100;
                  return (
                    <tr key={b.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-8 py-5">
                        <p className="text-sm font-bold text-slate-900">{b.category}</p>
                      </td>
                      <td className="px-8 py-5">
                        <p className="text-sm font-black text-slate-900 font-mono">{b.planned_amount.toLocaleString()} G</p>
                      </td>
                      <td className="px-8 py-5">
                        <p className="text-sm font-black text-slate-900 font-mono">{b.actual_amount.toLocaleString()} G</p>
                      </td>
                      <td className="px-8 py-5">
                        <p className={`text-xs font-black font-mono ${diff < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {diff > 0 ? '+' : ''}{diff.toLocaleString()} G
                        </p>
                      </td>
                      <td className="px-8 py-5 min-w-[200px]">
                        <div className="space-y-2">
                          <div className="flex justify-between text-[10px] font-black">
                            <span className={progress > 100 ? 'text-rose-600' : 'text-slate-400'}>{progress.toFixed(0)}%</span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className={`h-full transition-all duration-500 ${progress > 100 ? 'bg-rose-500' : progress > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                              style={{ width: `${Math.min(progress, 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button 
                            onClick={() => {
                              setFormData({ id: b.id, category: b.category, planned_amount: b.planned_amount.toString() });
                              setShowModal(true);
                            }}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                          >
                            <Edit3 size={16} />
                          </button>
                          <button 
                            onClick={async () => {
                              if (window.confirm("Supprimer ce budget ?")) {
                                await supabase.from('budgets').delete().eq('id', b.id).eq('school_id', user.school_id);
                                fetchBudgets();
                              }
                            }}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Budget */}
      {showModal && (
        <div className="fixed inset-0 z-[1000] bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
                  <Target size={20} />
                </div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">{formData.id ? 'Modifier Budget' : 'Nouveau Budget'}</h3>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
                <Plus size={24} className="rotate-45" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Catégorie de Dépense</label>
                <select 
                  required
                  className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold text-slate-900 outline-none focus:border-indigo-600 transition-all uppercase text-xs"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                >
                  <option value="">Sélectionner une catégorie...</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.label}>{c.label?.toUpperCase()}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Montant Prévisionnel (G)</label>
                <div className="relative">
                  <DollarSign className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                  <input 
                    required
                    type="number"
                    placeholder="0.00"
                    className="w-full pl-12 pr-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-lg font-black text-slate-900 outline-none focus:border-indigo-600 transition-all font-mono"
                    value={formData.planned_amount}
                    onChange={(e) => setFormData({ ...formData, planned_amount: e.target.value })}
                  />
                </div>
              </div>

              <button 
                disabled={isSubmitting}
                type="submit"
                className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 transition-all active:scale-95 flex items-center justify-center gap-3"
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                Enregistrer le Budget
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BudgetPlanningView;
