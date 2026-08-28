import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  RotateCcw, 
  BarChart2, 
  Edit2, 
  Trash2, 
  Calendar,
  FileText,
  Wallet,
  TrendingDown,
  ArrowRight,
  Loader2,
  RefreshCw,
  Tag,
  AlertCircle,
  Database,
  FileSpreadsheet,
  Filter,
  ChevronDown,
  Save,
  Building2,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { Link, useNavigate } from 'react-router-dom';
import { supabase, isValidUuid } from '../supabase';
import Modal from './Modal';
import { FluidLoadingState, SkeletonTable } from './SkeletonLoader';
import { AuditLogger } from '../utils/auditLogger';

import { UserProfile } from '../types';
import { isCashDateLocked } from '../services/cashClosureService';
import { getLocalTodayString } from '../utils/dateUtils';
import { useSchool } from '../contexts/SchoolContext';

const MONTHS = [
  { id: 'all', label: 'Toute l\'année' },
  { id: '0', label: 'Janvier' },
  { id: '1', label: 'Février' },
  { id: '2', label: 'Mars' },
  { id: '3', label: 'Avril' },
  { id: '4', label: 'Mai' },
  { id: '5', label: 'Juin' },
  { id: '6', label: 'Juillet' },
  { id: '7', label: 'Août' },
  { id: '8', label: 'Septembre' },
  { id: '9', label: 'Octobre' },
  { id: '10', label: 'Novembre' },
  { id: '11', label: 'Décembre' }
];

const ExpensesView: React.FC<{ user: UserProfile }> = ({ user }) => {
  const { school, currentCampusId, campuses } = useSchool();
  const hasMultipleCampuses = Array.isArray(campuses) && campuses.length > 1;
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'list' | 'categories'>('list');
  
  // Filtres
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedYearId, setSelectedYearId] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [selectedCampusFilterId, setSelectedCampusFilterId] = useState<string>(
    user.campus_id || currentCampusId || 'all'
  );
  
  const [dbError, setDbError] = useState<string | null>(null);

  // États pour la suppression
  const [deleteCandidate, setDeleteCandidate] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // États pour la gestion des catégories
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any | null>(null);
  const [categoryForm, setCategoryForm] = useState({ label: '', icon: 'Tag' });
  const [isSavingCategory, setIsSavingCategory] = useState(false);

  const getCampusName = useCallback((campusId?: string | null) => {
    if (!campusId) return 'Campus Principal';
    const found = campuses?.find(c => c.id === campusId);
    return found ? found.name : 'Campus Principal';
  }, [campuses]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setDbError(null);
    try {
      // 1. Charger les sessions académiques
      const { data: yearsData, error: yearsError } = await supabase
        .from('academic_years')
        .select('*')
        .eq('school_id', user.school_id)
        .order('label', { ascending: false });
      
      if (yearsError) console.error("Erreur chargement années académiques:", yearsError);

      if (yearsData) {
        const filtered = yearsData.filter(y => y.status === 'ACTIVE' || y.status === 'PAST' || y.is_active || y.status === undefined);
        const finalYears = filtered.length > 0 ? filtered : yearsData;
        setAcademicYears(finalYears);
        if (selectedYearId === 'all') {
            const active = finalYears.find(y => y.is_active || y.status === 'ACTIVE');
            if (active) setSelectedYearId(active.id);
        }
      }

      // 2. Charger les catégories
      const { data: catData } = await supabase
        .from('expense_categories')
        .select('*')
        .eq('school_id', user.school_id)
        .order('label');
      setCategories(catData || []);

      // 3. Charger les dépenses (Filtrage Multi-Tenant & Campus)
      let expensesQuery = supabase
        .from('expenses')
        .select(`
          *,
          category_ref:expense_categories(label, icon)
        `)
        .eq('school_id', user.school_id);

      const activeCampusId = user.campus_id || (selectedCampusFilterId !== 'all' ? selectedCampusFilterId : null);
      if (activeCampusId && isValidUuid(activeCampusId)) {
        expensesQuery = expensesQuery.eq('campus_id', activeCampusId);
      }
        
      const { data, error } = await expensesQuery;
      
      if (error) throw error;
      
      if (data) {
        const sortedData = [...data].sort((a, b) => {
          const dateA = a.expense_date || a.created_at || '';
          const dateB = b.expense_date || b.created_at || '';
          return dateB.localeCompare(dateA);
        });
        setExpenses(sortedData);
      }
    } catch (err: any) {
      console.error("Critical Registry Error:", err);
      setDbError("Accès au registre des charges interrompu.");
    } finally {
      setLoading(false);
    }
  }, [selectedYearId, user.school_id, user.campus_id, selectedCampusFilterId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // LOGIQUE DE FILTRAGE STRUCTURELLE
  const filteredExpenses = useMemo(() => {
    return expenses.filter(exp => {
      // Filtre Recherche
      const matchesSearch = (exp.label || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (exp.category_ref?.label || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      // Filtre Mois
      let matchesMonth = true;
      if (selectedMonth !== 'all' && exp.expense_date) {
        const monthPart = exp.expense_date.split('-')[1];
        const monthIndex = (parseInt(monthPart, 10) - 1).toString();
        matchesMonth = monthIndex === selectedMonth;
      }
      
      // Filtre Session
      const matchesYear = selectedYearId === 'all' || exp.academic_year_id === selectedYearId;

      // Filtre Campus / Annexe
      const matchesCampus = user.campus_id
        ? (exp.campus_id === user.campus_id || !exp.campus_id)
        : (selectedCampusFilterId === 'all' || exp.campus_id === selectedCampusFilterId || (!exp.campus_id && selectedCampusFilterId === campuses?.[0]?.id));

      return matchesSearch && matchesMonth && matchesYear && matchesCampus;
    });
  }, [expenses, searchTerm, selectedMonth, selectedYearId, selectedCampusFilterId, user.campus_id, campuses]);

  const totalAmountHTG = useMemo(() => {
    return filteredExpenses.reduce((sum, exp) => sum + Number(exp.amount_htg_equivalent || exp.amount), 0);
  }, [filteredExpenses]);

  const totalAmountUSD = useMemo(() => {
    return filteredExpenses
      .filter(exp => exp.currency === 'USD')
      .reduce((sum, exp) => sum + Number(exp.amount), 0);
  }, [filteredExpenses]);

  const handleDelete = async () => {
    if (!deleteCandidate) return;

    // Lock check
    const expDate = deleteCandidate.expense_date ? deleteCandidate.expense_date.split('T')[0] : getLocalTodayString();
    const lockCheck = await isCashDateLocked(user.school_id, user.campus_id || deleteCandidate.campus_id || null, expDate);
    if (lockCheck.isLocked) {
      toast.error(`🔒 Suppression impossible : La caisse du ${expDate} est déjà clôturée et verrouillée par l'administration.`);
      return;
    }

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', deleteCandidate.id);
      
      if (error) throw error;
      
      AuditLogger.log({
        school_id: user.school_id,
        user_id: user.id,
        action: 'DELETE',
        entity_type: 'expense',
        entity_id: deleteCandidate.id,
        details: { amount: deleteCandidate.amount, label: deleteCandidate.label }
      });

      setExpenses(prev => prev.filter(e => e.id !== deleteCandidate.id));
      setDeleteCandidate(null);
      toast.success("Dépense supprimée avec succès.");
    } catch (err: any) {
      toast.error("Erreur Cloud: " + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExport = () => {
    if (filteredExpenses.length === 0) return;

    const headers = hasMultipleCampuses 
      ? ["Date", "Libelle", "Categorie", "Campus/Annexe", "Montant", "Devise", "Equiv. HTG", "Observation"]
      : ["Date", "Libelle", "Categorie", "Montant", "Devise", "Equiv. HTG", "Observation"];

    const rows = filteredExpenses.map(e => {
      const row = [
        e.expense_date || 'N/A',
        e.label.replace(/,/g, ' '),
        (e.category_ref?.label || 'Divers').replace(/,/g, ' ')
      ];
      if (hasMultipleCampuses) {
        row.push(getCampusName(e.campus_id).replace(/,/g, ' '));
      }
      row.push(
        e.amount,
        e.currency || 'HTG',
        e.amount_htg_equivalent || e.amount,
        (e.description || '').replace(/,/g, ' ').replace(/\n/g, ' ')
      );
      return row;
    });

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers.join(";"), ...rows.map(e => e.join(";"))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    const sessionLabel = academicYears.find(y => y.id === selectedYearId)?.label || 'Globale';
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Audit_Charges_${school?.name || 'etablissement'}_${sessionLabel}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    AuditLogger.log({
      school_id: user.school_id,
      user_id: user.id,
      action: 'EXPORT',
      entity_type: 'expense',
      details: { format: 'CSV', count: filteredExpenses.length, session: sessionLabel }
    });
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingCategory(true);
    try {
      if (editingCategory) {
        const { error } = await supabase
          .from('expense_categories')
          .update({ label: categoryForm.label, icon: categoryForm.icon })
          .eq('id', editingCategory.id);
        if (error) throw error;
        toast.success("Catégorie mise à jour");
      } else {
        const { error } = await supabase
          .from('expense_categories')
          .insert([{ 
            school_id: user.school_id, 
            label: categoryForm.label, 
            icon: categoryForm.icon 
          }]);
        if (error) throw error;
        toast.success("Catégorie ajoutée");
      }
      setShowCategoryModal(false);
      setEditingCategory(null);
      setCategoryForm({ label: '', icon: 'Tag' });
      fetchData();
    } catch (err: any) {
      toast.error("Erreur: " + err.message);
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleDeleteCategory = async (catId: string) => {
    if (!confirm("Voulez-vous vraiment supprimer cette catégorie ? Les dépenses associées resteront mais n'auront plus de catégorie.")) return;
    try {
      const { error } = await supabase
        .from('expense_categories')
        .delete()
        .eq('id', catId);
      if (error) throw error;
      toast.success("Catégorie supprimée");
      fetchData();
    } catch (err: any) {
      toast.error("Erreur: " + err.message);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-700 max-w-7xl mx-auto pb-20 px-4 md:px-0">
      
      {/* HEADER ANALYTIQUE UNIFIÉ */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-2xl shadow-sm border border-slate-800 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-rose-400 font-bold text-xs uppercase tracking-wider">
            <TrendingDown size={16} className="text-rose-400" />
            <span>Registre des Décaissés</span>
            <span className="text-slate-600">•</span>
            <span className="bg-rose-500/20 text-rose-200 text-[10px] px-2.5 py-0.5 rounded-full border border-rose-400/30 font-black">
              Audit & Contrôle
            </span>
          </div>
          <h2 className="text-3xl font-black text-white tracking-tight">Audit des Dépenses</h2>
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 text-white font-bold text-xs rounded-xl border border-white/10 backdrop-blur-md">
              <Building2 className="w-3.5 h-3.5 text-indigo-300" />
              {school?.name || 'Établissement'}
            </span>
            {hasMultipleCampuses && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 text-slate-200 font-bold text-xs rounded-xl border border-white/10 backdrop-blur-md">
                {user.campus_id 
                  ? getCampusName(user.campus_id)
                  : selectedCampusFilterId === 'all'
                    ? 'Tous les Campus'
                    : getCampusName(selectedCampusFilterId)}
              </span>
            )}
            <span className="text-slate-300 text-xs font-semibold">
              Session {academicYears.find(y => y.id === selectedYearId)?.label || 'Active'}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <div className="bg-white/10 backdrop-blur-md border border-white/10 p-4 rounded-xl text-right flex-1 lg:flex-none min-w-[180px]">
            <p className="text-[10px] font-black uppercase text-slate-300 tracking-wider mb-1">Total Décaissements (HTG)</p>
            <p className="text-2xl font-black text-rose-400 tracking-tight font-mono">
              -{totalAmountHTG.toLocaleString()} <span className="text-xs font-sans font-bold text-rose-300">HTG</span>
            </p>
          </div>
          {totalAmountUSD > 0 && (
            <div className="bg-white/10 backdrop-blur-md border border-white/10 p-4 rounded-xl text-right flex-1 lg:flex-none min-w-[180px] animate-in slide-in-from-right duration-500">
              <p className="text-[10px] font-black uppercase text-slate-300 tracking-wider mb-1">Total Décaissements (USD)</p>
              <p className="text-2xl font-black text-blue-400 tracking-tight font-mono">
                -{totalAmountUSD.toLocaleString()} <span className="text-xs font-sans font-bold text-blue-300">USD</span>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* TABS DE NAVIGATION */}
      <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200/80 w-fit">
        <button
          onClick={() => setActiveTab('list')}
          className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'list' 
              ? 'bg-white text-rose-600 shadow-2xs' 
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Wallet size={15} />
          <span>Journal des Dépenses</span>
        </button>
        <button
          onClick={() => setActiveTab('categories')}
          className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'categories' 
              ? 'bg-white text-rose-600 shadow-2xs' 
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Tag size={15} />
          <span>Référentiel des Charges</span>
        </button>
      </div>

      {activeTab === 'list' ? (
        <>
          {/* PANNEAU DE RECHERCHE, FILTRES & ACTIONS */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 space-y-4">
            {/* Ligne Supérieure: Recherche + Actions Rapides */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
              {/* Barre de Recherche */}
              <div className="flex-1 relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-rose-600 transition-colors">
                  <Search size={18} />
                </div>
                <input 
                  type="text" 
                  placeholder="Chercher par libellé ou catégorie..." 
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 outline-none focus:border-rose-500 focus:bg-white focus:ring-2 focus:ring-rose-500/15 transition-all shadow-2xs"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button 
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-md transition-colors"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>

              {/* Boutons d'Action */}
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleExport}
                  disabled={filteredExpenses.length === 0}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-2 transition-all disabled:opacity-40 shadow-2xs cursor-pointer"
                >
                  <FileSpreadsheet size={16} className="text-emerald-600" />
                  <span>Grand Livre CSV</span>
                </button>
                <Link 
                  to="/economat/depenses/ajouter"
                  className="px-5 py-2.5 bg-rose-600 text-white font-bold text-xs rounded-xl hover:bg-rose-500 flex items-center gap-2 transition-all shadow-md shadow-rose-500/20 active:scale-95"
                >
                  <Plus size={16} />
                  <span>Nouvelle Charge</span>
                </Link>
              </div>
            </div>

            {/* Ligne Inférieure: Selects Filtres */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
              <div className="flex flex-wrap items-center gap-3">
                {/* Filtre Session */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">Session:</span>
                  <div className="relative">
                    <select 
                      className="pl-3 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none appearance-none cursor-pointer focus:border-rose-500 shadow-2xs"
                      value={selectedYearId}
                      onChange={(e) => setSelectedYearId(e.target.value)}
                    >
                      <option value="all">Toutes les Sessions</option>
                      {academicYears.map(y => (
                        <option key={y.id} value={y.id}>{y.label} {y.is_active ? '(ACTIVE)' : ''}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                  </div>
                </div>

                {/* Filtre Mois */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">Mois:</span>
                  <div className="relative">
                    <select 
                      className="pl-3 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none appearance-none cursor-pointer focus:border-rose-500 shadow-2xs"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                    >
                      {MONTHS.map(m => (
                        <option key={m.id} value={m.id}>{m.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                  </div>
                </div>

                {/* Filtre Campus */}
                {!user.campus_id && hasMultipleCampuses && (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">Campus:</span>
                    <div className="relative">
                      <select 
                        className="pl-3 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none appearance-none cursor-pointer focus:border-rose-500 shadow-2xs"
                        value={selectedCampusFilterId}
                        onChange={(e) => setSelectedCampusFilterId(e.target.value)}
                      >
                        <option value="all">Tous les Campus</option>
                        {campuses.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                    </div>
                  </div>
                )}
              </div>

              {/* Bouton Rafraîchir */}
              <button 
                onClick={fetchData} 
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                title="Actualiser les données"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                <span>Actualiser</span>
              </button>
            </div>
          </div>

          {/* TABLEAU DES DÉPENSES */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden min-h-[450px]">
            {loading ? (
              <div className="py-8">
                <FluidLoadingState 
                  message="Chargement du journal des dépenses & charges..." 
                  subtext="Récupération sécurisée du grand livre des décaissements et justificatifs..." 
                />
                <SkeletonTable rows={5} />
              </div>
            ) : (
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left min-w-[800px]">
                  <thead>
                    <tr className="bg-slate-900 text-white text-xs font-bold uppercase tracking-wider border-b border-slate-800">
                      <th scope="col" className="px-6 py-4">Date d'opération</th>
                      <th scope="col" className="px-6 py-4">Détails de la Charge</th>
                      {hasMultipleCampuses && <th scope="col" className="px-6 py-4">Campus / Annexe</th>}
                      <th scope="col" className="px-6 py-4 text-right">Montant</th>
                      <th scope="col" className="px-6 py-4">Note d'Audit</th>
                      <th scope="col" className="px-6 py-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredExpenses.map((expense) => (
                      <tr key={expense.id} className="group hover:bg-slate-50/80 transition-colors duration-150">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2.5 text-xs font-bold text-slate-800">
                            <Calendar size={14} className="text-slate-400" />
                            <span>
                              {expense.expense_date ? (
                                (() => {
                                  const [y, m, d] = expense.expense_date.split('-');
                                  return `${d}/${m}/${y}`;
                                })()
                              ) : 'N/A'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-xs font-bold text-slate-900">{expense.label}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-tight bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/60">
                              {expense.category_ref?.label || 'Dépense Diverse'}
                            </span>
                          </div>
                        </td>
                        {hasMultipleCampuses && (
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold border border-slate-200/80">
                              <Building2 className="w-3 h-3 text-slate-500" />
                              {getCampusName(expense.campus_id)}
                            </span>
                          </td>
                        )}
                        <td className="px-6 py-4 text-right">
                           <p className="text-sm font-black text-rose-600 font-mono tracking-tight">
                             -{Number(expense.amount).toLocaleString()} <span className="text-[10px] font-sans font-bold">{expense.currency || 'HTG'}</span>
                           </p>
                           {expense.currency === 'USD' && (
                             <p className="text-[10px] font-bold text-slate-400 italic">
                               ({Number(expense.amount_htg_equivalent).toLocaleString()} HTG)
                             </p>
                           )}
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-xs text-slate-500 max-w-[200px] truncate" title={expense.description || ''}>{expense.description || "Aucune note"}</p>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-1">
                            <button 
                              onClick={() => navigate(`/economat/depenses/modifier/${expense.id}`)}
                              className="p-2 text-amber-600 hover:bg-amber-50 rounded-xl transition-colors cursor-pointer"
                              title="Modifier"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button 
                              onClick={() => setDeleteCandidate(expense)}
                              className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                              title="Supprimer"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredExpenses.length === 0 && (
                      <tr>
                        <td colSpan={hasMultipleCampuses ? 6 : 5} className="py-24 text-center">
                           <AlertCircle size={36} className="mx-auto text-slate-300 mb-3" />
                           <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Aucune dépense enregistrée pour ces critères</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80">
            <div>
              <h3 className="text-base font-black text-slate-900 tracking-tight">Référentiel des Catégories</h3>
              <p className="text-xs text-slate-500">Gestion des types et classifications de charges académiques.</p>
            </div>
            <button 
              onClick={() => {
                setEditingCategory(null);
                setCategoryForm({ label: '', icon: 'Tag' });
                setShowCategoryModal(true);
              }}
              className="px-4 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-xs tracking-tight flex items-center gap-2 hover:bg-black transition-all cursor-pointer shadow-2xs"
            >
              <Plus size={16} />
              <span>Ajouter une Catégorie</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map(cat => (
              <div key={cat.id} className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between group hover:border-rose-300 transition-all">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 bg-slate-100 text-slate-500 rounded-xl flex items-center justify-center group-hover:bg-rose-50 group-hover:text-rose-600 transition-all">
                    <Tag size={18} />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs">{cat.label}</h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">ID: {cat.id.substring(0,8)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-all">
                  <button 
                    onClick={() => {
                      setEditingCategory(cat);
                      setCategoryForm({ label: cat.label, icon: cat.icon || 'Tag' });
                      setShowCategoryModal(true);
                    }}
                    className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg cursor-pointer"
                  >
                    <Edit2 size={15} />
                  </button>
                  <button 
                    onClick={() => handleDeleteCategory(cat.id)}
                    className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL CATEGORIE */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="p-8 border-b border-gray-100">
              <h3 className="text-xl font-black text-gray-900 tracking-tight">
                {editingCategory ? "Modifier la Catégorie" : "Nouvelle Catégorie"}
              </h3>
              <p className="text-xs font-bold text-gray-400 mt-1 uppercase tracking-widest">Paramétrage du référentiel</p>
            </div>
            <form onSubmit={handleSaveCategory} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Libellé de la catégorie</label>
                <input 
                  type="text" 
                  required 
                  placeholder="EX: SALAIRES & HONORAIRES"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-rose-500/20 focus:bg-white transition-all"
                  value={categoryForm.label}
                  onChange={e => setCategoryForm({...categoryForm, label: e.target.value})}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  type="button" 
                  onClick={() => setShowCategoryModal(false)}
                  className="flex-1 py-3 text-xs font-bold text-gray-500 hover:text-gray-900 transition-colors"
                >
                  ANNULER
                </button>
                <button 
                  type="submit" 
                  disabled={isSavingCategory}
                  className="flex-1 py-3 bg-rose-600 text-white rounded-xl font-bold text-xs tracking-tight hover:bg-rose-700 transition-all flex items-center justify-center gap-2"
                >
                  {isSavingCategory ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                  {editingCategory ? "METTRE À JOUR" : "ENREGISTRER"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Modal 
        isOpen={!!deleteCandidate}
        onClose={() => setDeleteCandidate(null)}
        onConfirm={handleDelete}
        isLoading={isDeleting}
        type="danger"
        title="Confirmation de Radiation"
        message={`Confirmez-vous la suppression de ce décaissé de ${Number(deleteCandidate?.amount).toLocaleString()} ${deleteCandidate?.currency || 'HTG'} ?`}
        confirmLabel="Confirmer"
      />
    </div>
  );
};

export default ExpensesView;