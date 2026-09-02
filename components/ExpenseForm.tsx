import React, { useState, useEffect, useCallback } from 'react';
import { 
  Save, 
  Calendar, 
  FileText, 
  DollarSign, 
  Tag, 
  ArrowLeft, 
  BarChart2, 
  Plus, 
  Loader2, 
  CheckCircle2, 
  PlusCircle,
  ChevronDown,
  ShieldCheck,
  AlertCircle,
  Edit3,
  Building2
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../supabase';
import { AuditLogger } from '../utils/auditLogger';
import { UserProfile } from '../types';
import { useSchool } from '../contexts/SchoolContext';
import { expenseSchema } from '../utils/validation';
import { isCashDateLocked } from '../services/cashClosureService';
import { getLocalTodayString } from '../utils/dateUtils';

const ExpenseForm: React.FC<{ user: UserProfile }> = ({ user }) => {
  const { currentCampusId, campuses } = useSchool();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;

  const [categories, setCategories] = useState<any[]>([]);
  const [activeYear, setActiveYear] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showQuickCatModal, setShowQuickCatModal] = useState(false);
  const [newCatLabel, setNewCatLabel] = useState('');
  const [isSavingCat, setIsSavingCat] = useState(false);

  const [formData, setFormData] = useState({
    expense_date: (() => {
      const now = new Date();
      const offset = now.getTimezoneOffset();
      const localNow = new Date(now.getTime() - (offset * 60 * 1000));
      return localNow.toISOString().split('T')[0];
    })(),
    label: '',
    amount: '',
    currency: 'HTG',
    category_id: '',
    description: '',
    academic_year_id: '',
    campus_id: user.campus_id || currentCampusId || (campuses && campuses[0]?.id) || ''
  });

  const [currentExchangeRate, setCurrentExchangeRate] = useState<number>(132.50);

  const loadInitialData = useCallback(async () => {
    if (!user?.school_id) return;
    setLoading(true);
    try {
      // 1. Charger toutes les sessions pour référence
      const { data: yearsData } = await supabase
        .from('academic_years')
        .select('*')
        .eq('school_id', user.school_id);
      
      const currentActiveYear = yearsData?.find(y => y.status === 'ACTIVE') || yearsData?.[0];

      if (currentActiveYear) {
        setActiveYear(currentActiveYear);
        setFormData(prev => ({ ...prev, academic_year_id: currentActiveYear.id }));
      }

      // 2. Charger les catégories
      const { data: catData } = await supabase
        .from('expense_categories')
        .select('*')
        .eq('school_id', user.school_id)
        .order('label');
      setCategories(catData || []);

      // 2b. Charger le taux de change actuel
      const { data: rateData } = await supabase
        .from('exchange_rates')
        .select('rate_usd_to_htg')
        .eq('school_id', user.school_id)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (rateData && rateData.length > 0) {
        setCurrentExchangeRate(rateData[0].rate_usd_to_htg);
      }

      // 3. Charger la dépense si on est en mode édition
      if (isEdit && id) {
        const { data: expData, error: expError } = await supabase
          .from('expenses')
          .select('*')
          .eq('id', id)
          .single();
        
        if (expError) throw expError;
        if (expData) {
          setFormData({
            expense_date: expData.expense_date || '',
            label: expData.label || '',
            amount: expData.amount?.toString() || '',
            currency: expData.currency || 'HTG',
            category_id: expData.category_id || '',
            description: expData.description || '',
            academic_year_id: expData.academic_year_id || '',
            campus_id: expData.campus_id || user.campus_id || currentCampusId || ''
          });

          // Mettre à jour la session affichée pour correspondre à la dépense
          const expenseYear = yearsData?.find(y => y.id === expData.academic_year_id);
          if (expenseYear) {
            setActiveYear(expenseYear);
          }
        }
      }
    } catch (err: any) {
      console.error("Initialization error:", err);
      setError("Impossible de charger les protocoles financiers.");
    } finally {
      setLoading(false);
    }
  }, [id, isEdit, user?.school_id, user?.campus_id, currentCampusId]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeYear) {
      setError("Aucune session active n'a été trouvée. Les dépenses ne peuvent être enregistrées que pour la session en cours.");
      return;
    }
    
    setIsSubmitting(true);
    setError(null);

    const validationResult = expenseSchema.safeParse(formData);
    if (!validationResult.success) {
      setError(validationResult.error.issues[0].message);
      setIsSubmitting(false);
      return;
    }

    // Cash lock check
    const targetExpDate = formData.expense_date || getLocalTodayString();
    const targetCampusId = user.campus_id || formData.campus_id || currentCampusId || null;
    const lockCheck = await isCashDateLocked(user.school_id, targetCampusId, targetExpDate);
    if (lockCheck.isLocked) {
      setError(`🔒 Enregistrement bloqué : La caisse du ${targetExpDate} est déjà clôturée et verrouillée par l'administration.`);
      setIsSubmitting(false);
      return;
    }

    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!user) throw new Error("Session expirée.");

      const { data: profile } = await supabase.from('profiles').select('school_id').eq('id', user.id).single();
      const schoolId = profile?.school_id || authUser.user_metadata?.school_id;
      if (!schoolId) throw new Error("Impossible de déterminer l'établissement.");

      const payload = {
        school_id: schoolId,
        campus_id: targetCampusId,
        category_id: formData.category_id,
        academic_year_id: formData.academic_year_id,
        label: formData.label,
        amount: parseFloat(formData.amount),
        currency: formData.currency,
        exchange_rate_applied: formData.currency === 'USD' ? currentExchangeRate : 1,
        amount_htg_equivalent: formData.currency === 'USD' ? parseFloat(formData.amount) * currentExchangeRate : parseFloat(formData.amount),
        description: formData.description,
        expense_date: formData.expense_date || new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0]
      };

      let dbRes;
      if (isEdit) {
        dbRes = await supabase.from('expenses').update(payload).eq('id', id).select().single();
      } else {
        dbRes = await supabase.from('expenses').insert([payload]).select().single();
      }

      if (dbRes.error) throw dbRes.error;
      
      AuditLogger.log({
        school_id: schoolId,
        user_id: user.id,
        action: isEdit ? 'UPDATE' : 'CREATE',
        entity_type: 'expense',
        entity_id: dbRes.data?.id,
        details: { amount: payload.amount, category_id: payload.category_id, label: payload.label }
      });
      
      setIsSuccess(true);
    } catch (err: any) {
      setError(err.message || "Erreur lors de la synchronisation Cloud.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const startNewEntry = () => {
    setIsSuccess(false);
    setError(null);
    if (isEdit) {
      navigate('/economat/depenses/ajouter');
    } else {
      setFormData(prev => ({
        ...prev,
        expense_date: (() => {
          const now = new Date();
          const offset = now.getTimezoneOffset();
          const localNow = new Date(now.getTime() - (offset * 60 * 1000));
          return localNow.toISOString().split('T')[0];
        })(),
        label: '',
        amount: '',
        currency: 'HTG',
        category_id: '',
        description: ''
      }));
    }
  };

  const handleQuickAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatLabel.trim() || !user?.school_id) return;
    setIsSavingCat(true);
    try {
      const { data, error } = await supabase
        .from('expense_categories')
        .insert([{ school_id: user.school_id, label: newCatLabel.trim(), icon: 'Tag' }])
        .select()
        .single();
      
      if (error) throw error;
      
      setCategories(prev => [...prev, data].sort((a, b) => a.label.localeCompare(b.label)));
      setFormData(prev => ({ ...prev, category_id: data.id }));
      setShowQuickCatModal(false);
      setNewCatLabel('');
    } catch (err: any) {
      setError("Erreur lors de l'ajout de la catégorie: " + err.message);
    } finally {
      setIsSavingCat(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-rose-600" size={40} />
        <p className="text-sm font-medium text-gray-500">Authentification de la session active...</p>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="max-w-2xl mx-auto py-20 animate-in zoom-in duration-500">
        <div className="bg-white p-12 rounded-xl shadow-sm border border-gray-200 text-center space-y-8">
           <div className="w-24 h-24 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mx-auto border border-emerald-100">
             <CheckCircle2 size={48} />
           </div>
           <div className="space-y-2">
             <h2 className="text-3xl font-black text-gray-900 tracking-tight">Opération Scellée</h2>
             <p className="text-slate-500 text-xs font-bold tracking-tight">Affectée à la session : {activeYear?.label || 'Inconnue'}</p>
           </div>
           <div className="flex flex-col sm:flex-row gap-0 pt-6 border-t border-gray-100">
              <button onClick={() => navigate('/economat/depenses')} className="flex-1 py-4 bg-gray-50 text-gray-900 border border-gray-200 font-bold text-xs tracking-tight hover:bg-gray-100 transition-all flex items-center justify-center gap-3">
                <BarChart2 size={16} /> Retour au Registre
              </button>
              <button onClick={startNewEntry} className="flex-1 py-4 bg-gray-900 text-white font-bold text-xs tracking-tight hover:bg-black transition-all flex items-center justify-center gap-3">
                <PlusCircle size={16} /> Autre Charge
              </button>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in slide-in-from-bottom duration-500 pb-12">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80">
        <div className="flex items-center gap-5">
          <div className={`p-3.5 ${isEdit ? 'bg-amber-500' : 'bg-rose-600'} text-white rounded-xl shadow-md shadow-rose-500/20`}>
             {isEdit ? <Edit3 size={24} /> : <Plus size={24} />}
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              {isEdit ? "Correction Charge" : "Saisie de Charge"}
            </h2>
            <div className="flex items-center gap-2 mt-1">
               <span className="text-xs font-bold px-2.5 py-0.5 bg-slate-100 text-slate-600 rounded-lg border border-slate-200/80 tracking-tight">
                 Session Cible : {activeYear?.label || 'Chargement...'}
               </span>
            </div>
          </div>
        </div>
        <button onClick={() => navigate('/economat/depenses')} className="px-4 py-2.5 bg-white text-slate-700 hover:bg-slate-50 rounded-xl font-bold text-xs tracking-tight transition-all flex items-center gap-2 border border-slate-200 shadow-2xs cursor-pointer">
          <ArrowLeft size={16} />
          <span>Annuler</span>
        </button>
      </div>

      {error && (
        <div className="bg-rose-50 border-l-4 border-rose-500 p-5 rounded-xl flex items-center gap-4 text-rose-700 font-bold text-xs  tracking-wider animate-in shake">
          <AlertCircle size={20} /> {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        <div className={`h-1.5 ${isEdit ? 'bg-amber-500' : 'bg-rose-600'} w-full`}></div>
        <div className="p-6 md:p-10 space-y-10">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            <div className="lg:col-span-7 space-y-10">
               <div className="space-y-8">
                 <div className="flex items-center gap-3 border-b border-gray-200 pb-4">
                    <DollarSign size={18} className={isEdit ? 'text-amber-500' : 'text-rose-600'} />
                    <h3 className="font-bold text-slate-900 text-xs tracking-tight">1. Détails Financiers</h3>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                       <label className="text-xs font-bold text-slate-500 tracking-tight ml-1">Date d'opération</label>
                       <div className="relative">
                         <input type="date" required className="w-full px-4 py-3 bg-white text-gray-900 border border-gray-200 rounded-xl text-xs font-bold  tracking-tight focus:bg-gray-50 outline-none transition-all" value={formData.expense_date} onChange={e => setFormData({...formData, expense_date: e.target.value})} />
                         <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                       </div>
                    </div>
                    <div className="space-y-2">
                       <label className="text-xs font-bold text-slate-500 tracking-tight ml-1">Montant & Devise</label>
                       <div className="flex gap-2">
                         <div className="relative flex-1">
                           <input 
                            type="number" 
                            required 
                            step="0.01" 
                            className={`w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-2xl font-semibold outline-none focus:bg-gray-50 transition-all font-mono tracking-tighter ${isEdit ? 'text-amber-600' : 'text-rose-600'}`} 
                            placeholder="0.00" 
                            value={formData.amount} 
                            onChange={e => setFormData({...formData, amount: e.target.value})} 
                           />
                           <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">
                             {formData.currency}
                           </div>
                         </div>
                         <select 
                          className="w-24 px-2 py-3 bg-slate-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 outline-none appearance-none cursor-pointer hover:bg-slate-100 transition-all text-center"
                          value={formData.currency}
                          onChange={e => setFormData({...formData, currency: e.target.value as any})}
                         >
                           <option value="HTG">HTG</option>
                           <option value="USD">USD</option>
                         </select>
                       </div>
                       {formData.currency === 'USD' && formData.amount && (
                         <p className="text-[10px] font-bold text-emerald-600 ml-1 animate-in fade-in slide-in-from-left-2">
                           Équivalent : {(parseFloat(formData.amount) * currentExchangeRate).toLocaleString()} HTG (Taux: {currentExchangeRate})
                         </p>
                       )}
                    </div>
                 </div>
               </div>

               <div className="space-y-8">
                 <div className="flex items-center gap-3 border-b border-gray-200 pb-4">
                    <Tag size={18} className={isEdit ? 'text-amber-500' : 'text-rose-600'} />
                    <h3 className="font-bold text-slate-900 text-xs tracking-tight">2. Justification</h3>
                 </div>
                 <div className="space-y-6">
                   <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 tracking-tight ml-1">Catégorie de Charge</label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <select required className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-900  tracking-tight outline-none appearance-none cursor-pointer focus:bg-gray-50 transition-all" value={formData.category_id} onChange={e => setFormData({...formData, category_id: e.target.value})}>
                            <option value="">-- SÉLECTIONNER CATÉGORIE --</option>
                            {categories.map(cat => (
                              <option key={cat.id} value={cat.id}>{cat.label.toUpperCase()}</option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                        </div>
                        <button 
                          type="button"
                          onClick={() => setShowQuickCatModal(true)}
                          className="p-3 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all"
                          title="Nouvelle catégorie"
                        >
                          <Plus size={18} />
                        </button>
                      </div>
                   </div>
                   {!user.campus_id && campuses && campuses.length > 1 && (
                      <div className="space-y-2">
                         <label className="text-xs font-bold text-slate-500 tracking-tight ml-1 flex items-center gap-1.5">
                           <Building2 size={14} className="text-slate-400" /> Campus / Annexe d'affectation
                         </label>
                         <div className="relative">
                           <select 
                            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-900 tracking-tight outline-none appearance-none cursor-pointer focus:bg-gray-50 transition-all"
                            value={formData.campus_id}
                            onChange={e => setFormData({...formData, campus_id: e.target.value})}
                           >
                             {campuses.map(c => (
                               <option key={c.id} value={c.id}>{c.name.toUpperCase()}</option>
                             ))}
                           </select>
                           <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                         </div>
                      </div>
                   )}
                   <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 tracking-tight ml-1">Désignation de la Charge</label>
                      <input required type="text" placeholder="EX: MAINTENANCE TRANSFORMATEUR" className="w-full px-4 py-3 bg-white text-gray-900 border border-gray-200 rounded-xl text-xs font-bold  tracking-tight outline-none focus:bg-gray-50 transition-all" value={formData.label} onChange={e => setFormData({...formData, label: e.target.value})} />
                   </div>
                 </div>
               </div>
            </div>

            <div className="lg:col-span-5 space-y-8">
               <div className="space-y-2 flex flex-col">
                  <label className="text-xs font-bold text-slate-500 tracking-tight ml-1 flex items-center gap-2">
                    <FileText size={14} /> Audit Note
                  </label>
                  <textarea rows={6} className="w-full px-4 py-4 bg-white text-gray-900 border border-gray-200 rounded-xl text-xs font-bold tracking-tight outline-none focus:bg-gray-50 transition-all resize-none" placeholder="OBSERVATIONS COMPTABLES..." value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
               </div>
               
               <div className="bg-slate-50 p-8 rounded-xl border border-slate-200 space-y-4">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="text-slate-900" size={18} />
                    <h4 className="text-xs font-bold text-slate-900 tracking-tight">Certification Session</h4>
                  </div>
                  <p className="text-xs font-medium text-slate-500 leading-relaxed tracking-tight">
                    Cette charge sera irrémédiablement associée à la session {activeYear?.label || 'en cours...'}.
                  </p>
               </div>
            </div>
          </div>

          <div className="mt-12 pt-10 flex flex-row justify-end items-center gap-4 border-t border-gray-200 relative z-10">
             <button type="button" onClick={() => navigate('/economat/depenses')} className="px-6 py-4 text-xs font-bold text-slate-500 hover:text-slate-900 tracking-tight transition-colors uppercase">
               Annuler l'opération
             </button>
             <button disabled={isSubmitting || loading} type="submit" className={`px-10 py-4 ${isEdit ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-100' : 'bg-rose-600 hover:bg-rose-700 shadow-rose-100'} text-white rounded-xl shadow-lg font-bold text-xs tracking-tight flex items-center justify-center gap-3 active:scale-95 disabled:opacity-30 transition-all`}>
                {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                {isEdit ? "Rectifier la Charge" : "Valider le décaissement"}
             </button>
          </div>
        </div>
      </form>

      {/* QUICK CATEGORY MODAL */}
      {showQuickCatModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="p-8 border-b border-gray-100">
              <h3 className="text-xl font-black text-gray-900 tracking-tight">Nouvelle Catégorie</h3>
              <p className="text-xs font-bold text-gray-400 mt-1 uppercase tracking-widest">Ajout rapide au référentiel</p>
            </div>
            <form onSubmit={handleQuickAddCategory} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Libellé de la catégorie</label>
                <input 
                  type="text" 
                  required 
                  autoFocus
                  placeholder="EX: SALAIRES & HONORAIRES"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-rose-500/20 focus:bg-white transition-all"
                  value={newCatLabel}
                  onChange={e => setNewCatLabel(e.target.value)}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  type="button" 
                  onClick={() => setShowQuickCatModal(false)}
                  className="flex-1 py-3 text-xs font-bold text-gray-500 hover:text-gray-900 transition-colors"
                >
                  ANNULER
                </button>
                <button 
                  type="submit" 
                  disabled={isSavingCat}
                  className="flex-1 py-3 bg-rose-600 text-white rounded-xl font-bold text-xs tracking-tight hover:bg-rose-700 transition-all flex items-center justify-center gap-2"
                >
                  {isSavingCat ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                  ENREGISTRER
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpenseForm;