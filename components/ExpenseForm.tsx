import React, { useState, useEffect, useCallback } from 'react';
import { 
  Save, 
  FileText, 
  DollarSign, 
  Tag, 
  ArrowLeft, 
  BarChart2, 
  Plus, 
  Loader2, 
  CheckCircle2, 
  PlusCircle,
  ShieldCheck,
  AlertCircle,
  Edit3,
  Building2,
  X
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../supabase';
import { AuditLogger } from '../utils/auditLogger';
import { UserProfile } from '../types';
import { useSchool } from '../contexts/SchoolContext';
import { expenseSchema } from '../utils/validation';
import { isCashDateLocked } from '../services/cashClosureService';
import { getLocalTodayString } from '../utils/dateUtils';
import { DatePickerPill } from './DatePickerPill';
import { SelectPill } from './SelectPill';

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
        exchange_rate_applied: currentExchangeRate || 140,
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
        <p className="text-sm font-bold text-slate-800">Authentification de la session active...</p>
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
             <p className="text-slate-700 text-xs font-bold tracking-tight">Affectée à la session : <span className="text-slate-900 font-extrabold">{activeYear?.label || 'Inconnue'}</span></p>
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
    <div className="max-w-4xl mx-auto space-y-4 animate-in slide-in-from-bottom duration-500 pb-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200/80">
        <div className="flex items-center gap-3.5">
          <div className={`p-2.5 ${isEdit ? 'bg-amber-500' : 'bg-rose-600'} text-white rounded-xl shadow-md shadow-rose-500/20`}>
             {isEdit ? <Edit3 size={20} /> : <Plus size={20} />}
          </div>
            <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
               {isEdit ? "Correction de Charge" : "Saisie de Nouvelle Charge"}
            </h2>
            <div className="flex items-center gap-2 mt-0.5">
               <span className="text-[11px] font-bold px-2 py-0.5 bg-slate-100 text-slate-900 rounded-lg border border-slate-300 tracking-tight">
                 Session Cible : {activeYear?.label || 'Chargement...'}
               </span>
            </div>
          </div>
        </div>
        <button onClick={() => navigate('/economat/depenses')} className="w-full sm:w-auto px-3.5 py-2 bg-white text-slate-900 hover:bg-slate-100 rounded-xl font-bold text-xs tracking-tight transition-all flex items-center justify-center gap-1.5 border border-slate-300 shadow-2xs cursor-pointer">
          <ArrowLeft size={15} />
          <span>Retour aux Dépenses</span>
        </button>
      </div>

      {error && (
        <div className="bg-rose-50 border-l-4 border-rose-500 p-3.5 rounded-xl flex items-center gap-3 text-rose-800 font-bold text-xs tracking-wider animate-in shake">
          <AlertCircle size={18} /> {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-visible relative">
        <div className={`h-1.5 ${isEdit ? 'bg-amber-500' : 'bg-rose-600'} w-full rounded-t-2xl`}></div>
        <div className="p-5 sm:p-6 space-y-6">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-7 space-y-5">
               {/* 1. DÉTAILS FINANCIERS */}
               <div className="space-y-3.5">
                 <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                    <DollarSign size={16} className={isEdit ? 'text-amber-500' : 'text-rose-600'} />
                    <h3 className="font-bold text-slate-900 text-xs tracking-tight">1. Détails Financiers</h3>
                 </div>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="space-y-1.5">
                       <div className="flex items-center justify-between">
                         <label className="text-xs font-bold text-slate-900 tracking-tight ml-0.5">Date d'opération</label>
                         {formData.expense_date !== getLocalTodayString() && (
                           <button
                             type="button"
                             onClick={() => setFormData(p => ({ ...p, expense_date: getLocalTodayString() }))}
                             className="text-[11px] font-bold text-rose-700 hover:text-rose-900 hover:underline cursor-pointer"
                           >
                             Aujourd'hui
                           </button>
                         )}
                       </div>
                       <DatePickerPill
                         selectedDate={formData.expense_date}
                         onSelectDate={(newDate) => setFormData(p => ({ ...p, expense_date: newDate }))}
                         variant="field"
                         size="sm"
                         colorScheme={isEdit ? 'amber' : 'rose'}
                         showShortcuts={false}
                         showQuickArrows={true}
                         showTodayBadge={true}
                         className="w-full"
                       />
                    </div>
                    <div className="space-y-1.5">
                       <label className="text-xs font-bold text-slate-900 tracking-tight ml-0.5">Montant & Devise</label>
                       <div className="flex gap-2 items-center">
                         <div className="relative flex-1">
                           <input 
                            type="number" 
                            required 
                            step="0.01" 
                            className={`w-full pl-3 pr-12 py-2 bg-white focus:bg-white border border-slate-300 focus:border-rose-500 rounded-xl text-xl font-black outline-none transition-all font-mono tracking-tight shadow-2xs ${isEdit ? 'text-amber-800' : 'text-rose-800'}`} 
                            placeholder="0.00" 
                            value={formData.amount} 
                            onChange={e => setFormData({...formData, amount: e.target.value})} 
                           />
                           <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 font-black text-xs pointer-events-none">
                             {formData.currency}
                           </div>
                         </div>
                         <div className="w-24 shrink-0">
                           <SelectPill
                             options={[
                               { value: 'HTG', label: 'HTG' },
                               { value: 'USD', label: 'USD' }
                             ]}
                             value={formData.currency}
                             onChange={(val) => setFormData(p => ({ ...p, currency: val }))}
                             variant="field"
                             size="sm"
                             colorScheme={isEdit ? 'amber' : 'rose'}
                             dropdownAlign="right"
                             className="w-full"
                           />
                         </div>
                       </div>
                       {formData.currency === 'USD' && formData.amount && (
                         <p className="text-xs font-bold text-emerald-800 ml-0.5 animate-in fade-in slide-in-from-left-2">
                           Équivalent : {(parseFloat(formData.amount) * currentExchangeRate).toLocaleString()} HTG (Taux: {currentExchangeRate})
                         </p>
                       )}
                    </div>
                 </div>
               </div>

               {/* 2. JUSTIFICATION */}
               <div className="space-y-3.5">
                 <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                    <Tag size={16} className={isEdit ? 'text-amber-500' : 'text-rose-600'} />
                    <h3 className="font-bold text-slate-900 text-xs tracking-tight">2. Justification & Imputation</h3>
                 </div>
                 <div className="space-y-3">
                   <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-900 tracking-tight ml-0.5">Catégorie de Charge</label>
                      <div className="flex gap-2 items-center">
                        <div className="flex-1 min-w-0">
                          <SelectPill
                            options={categories.map(cat => ({ 
                              value: cat.id, 
                              label: cat.label.toUpperCase()
                            }))}
                            value={formData.category_id}
                            onChange={(val) => setFormData(p => ({ ...p, category_id: val }))}
                            placeholder="-- SÉLECTIONNER CATÉGORIE --"
                            icon={Tag}
                            variant="field"
                            size="sm"
                            colorScheme={isEdit ? 'amber' : 'rose'}
                            searchable={categories.length > 5}
                            className="w-full"
                          />
                        </div>
                        <button 
                          type="button" 
                          onClick={() => setShowQuickCatModal(true)}
                          className="p-2 sm:p-2.5 bg-white text-slate-900 hover:text-black hover:bg-slate-100 border border-slate-300 rounded-xl transition-all shadow-2xs cursor-pointer shrink-0 flex items-center justify-center min-h-[36px]"
                          title="Ajouter une nouvelle catégorie"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                   </div>
                   {!user.campus_id && campuses && campuses.length > 1 && (
                      <div className="space-y-1.5">
                         <label className="text-xs font-bold text-slate-900 tracking-tight ml-0.5 flex items-center gap-1.5">
                           <Building2 size={13} className="text-slate-600" /> Campus / Annexe d'affectation
                         </label>
                         <SelectPill
                           options={campuses.map(c => ({
                             value: c.id,
                             label: c.name.toUpperCase()
                           }))}
                           value={formData.campus_id}
                           onChange={(val) => setFormData(p => ({ ...p, campus_id: val }))}
                           placeholder="Sélectionner un campus..."
                           icon={Building2}
                           variant="field"
                           size="sm"
                           colorScheme={isEdit ? 'amber' : 'rose'}
                           className="w-full"
                         />
                      </div>
                   )}
                   <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-900 tracking-tight ml-0.5">Désignation de la Charge</label>
                      <input 
                        required 
                        type="text" 
                        placeholder="Ex: MAINTENANCE GÉNÉRATRICE, ACHAT FOURNITURES..." 
                        className="w-full px-3 py-2.5 bg-white hover:bg-slate-50 focus:bg-white text-slate-950 placeholder:text-slate-600 border border-slate-300 focus:border-rose-500 rounded-xl text-xs sm:text-sm font-bold tracking-tight outline-none transition-all shadow-2xs" 
                        value={formData.label} 
                        onChange={e => setFormData({...formData, label: e.target.value})} 
                      />
                   </div>
                 </div>
               </div>
            </div>

            <div className="lg:col-span-5 space-y-4">
               <div className="space-y-1.5 flex flex-col">
                  <label className="text-xs font-bold text-slate-900 tracking-tight ml-0.5 flex items-center gap-1.5">
                    <FileText size={13} className="text-slate-600" /> Note d'Audit & Justificatif
                  </label>
                  <textarea 
                    rows={4} 
                    className="w-full p-3 bg-white focus:bg-white text-slate-950 placeholder:text-slate-600 border border-slate-300 focus:border-rose-500 rounded-xl text-xs sm:text-sm font-bold tracking-tight outline-none transition-all resize-none shadow-2xs leading-relaxed" 
                    placeholder="Observations comptables, numéro de reçu ou pièces justificatives..." 
                    value={formData.description} 
                    onChange={e => setFormData({...formData, description: e.target.value})} 
                  />
                  <span className="text-xs text-slate-800 font-bold ml-0.5">Facultatif mais recommandé pour l'audit financier.</span>
               </div>
               
               <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="text-slate-950" size={16} />
                    <h4 className="text-xs font-black text-slate-950 tracking-tight">Certification de Session</h4>
                  </div>
                  <p className="text-xs font-semibold text-slate-800 leading-relaxed tracking-tight">
                    Cette charge sera enregistrée et imputée au grand livre comptable de la session <span className="font-black text-slate-950">{activeYear?.label || 'en cours...'}</span>.
                  </p>
               </div>
            </div>
          </div>

          <div className="mt-6 pt-4 flex flex-col-reverse sm:flex-row justify-end items-stretch sm:items-center gap-3 border-t border-slate-100 relative z-10">
             <button 
               type="button" 
               onClick={() => navigate('/economat/depenses')} 
               className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-slate-900 font-black hover:text-black border border-slate-300 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer text-center"
             >
               Annuler
             </button>
             <button 
               disabled={isSubmitting || loading} 
               type="submit" 
               className={`w-full sm:w-auto px-6 py-2.5 ${isEdit ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/20' : 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/20'} text-white rounded-xl shadow-md font-bold text-xs tracking-tight flex items-center justify-center gap-2 active:scale-95 disabled:opacity-40 transition-all cursor-pointer`}
             >
                {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                <span>{isEdit ? "Mettre à jour la Charge" : "Valider le Décaissement"}</span>
             </button>
          </div>
        </div>
      </form>

      {/* QUICK CATEGORY MODAL */}
      {showQuickCatModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-950 tracking-tight">Nouvelle Catégorie</h3>
                <p className="text-xs font-bold text-slate-900 mt-0.5">Ajout rapide au référentiel</p>
              </div>
              <button
                onClick={() => setShowQuickCatModal(false)}
                className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleQuickAddCategory} className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-900 tracking-tight ml-0.5">Libellé de la catégorie</label>
                <input 
                  type="text" 
                  required 
                  autoFocus
                  placeholder="EX: SALAIRES & HONORAIRES"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-950 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
                  value={newCatLabel}
                  onChange={e => setNewCatLabel(e.target.value)}
                />
              </div>
              <div className="flex gap-2.5 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowQuickCatModal(false)}
                  className="flex-1 py-2.5 text-xs font-bold text-slate-800 hover:text-slate-950 border border-slate-300 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button 
                  type="submit" 
                  disabled={isSavingCat}
                  className="flex-1 py-2.5 bg-rose-600 text-white rounded-xl font-bold text-xs tracking-tight hover:bg-rose-700 transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isSavingCat ? <Loader2 className="animate-spin" size={15} /> : <Save size={15} />}
                  <span>Enregistrer</span>
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