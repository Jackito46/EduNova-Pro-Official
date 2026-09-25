import React, { useState, useEffect, useMemo } from 'react';
import { 
  Target, PieChart, TrendingUp, AlertTriangle, 
  Plus, Save, Trash2, Edit3, Calendar,
  DollarSign, CheckCircle2, Loader2, Info,
  ArrowRight, BarChart3, Search, X, Filter,
  ArrowUpDown, Building, Building2, Users, Zap, BookOpen,
  Wrench, ShieldAlert, Sparkles, RefreshCw, Check,
  Layers, Wallet
} from 'lucide-react';
import { supabase, isValidUuid } from '../supabase';
import { UserProfile } from '../types';
import { toast } from 'sonner';
import { useSchool } from '../contexts/SchoolContext';
import { AcademicSessionPill } from './AcademicSessionPill';
import { SelectPill, SelectOption } from './SelectPill';

interface Budget {
  id: string;
  academic_year_id: string;
  category: string;
  campus_id?: string | null;
  planned_amount: number;
  actual_amount: number;
  created_at: string;
}

// Catégories types pour la gouvernance budgétaire standard
const STANDARD_BUDGET_CATEGORIES = [
  { label: 'Salaires & Primes Enseignants', icon: Users, badge: 'Personnel', defaultPlanned: 500000 },
  { label: 'Pédagogie, Examens & Laboratoires', icon: BookOpen, badge: 'Académique', defaultPlanned: 150000 },
  { label: 'Connectivité Internet & Numérique', icon: Zap, badge: 'Numérique', defaultPlanned: 60000 },
  { label: 'Électricité, Eau & Fluides', icon: Zap, badge: 'Énergie', defaultPlanned: 75000 },
  { label: 'Maintenance, Hygiène & Bâtiments', icon: Wrench, badge: 'Infrastructures', defaultPlanned: 80000 },
  { label: 'Fournitures Bureau & Imprimés', icon: Building, badge: 'Administration', defaultPlanned: 45000 },
  { label: 'Activités Culturelles & Sportives', icon: Sparkles, badge: 'Vie Scolaire', defaultPlanned: 35000 },
  { label: 'Imprévus & Réserve de Sécurité', icon: ShieldAlert, badge: 'Réserve', defaultPlanned: 50000 }
];

// Paliers de dotation rapide (style pilule harmonisé)
const QUICK_AMOUNT_PRESETS = [25000, 50000, 100000, 250000, 500000, 1000000];

const BudgetPlanningView: React.FC<{ user: UserProfile }> = ({ user }) => {
  const { currentCampusId, campuses } = useSchool();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [selectedYearId, setSelectedYearId] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingTemplate, setIsGeneratingTemplate] = useState(false);

  // Filtres et recherche
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'HEALTHY' | 'WARNING' | 'EXCEEDED'>('ALL');
  const [sortBy, setSortBy] = useState<'DEFAULT' | 'PROGRESS_DESC' | 'PROGRESS_ASC' | 'PLANNED_DESC' | 'NAME'>('DEFAULT');

  // Formulaire de dotation budgétaire
  const [formData, setFormData] = useState({
    id: '',
    category: '',
    campus_id: '',
    planned_amount: ''
  });
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [customCategoryInput, setCustomCategoryInput] = useState('');

  const [categories, setCategories] = useState<any[]>([]);

  // Détection multi-campus
  const hasMultipleCampuses = (campuses?.length || 0) > 1;

  // Nom du campus actif
  const activeCampusName = useMemo(() => {
    const campusId = user.campus_id || currentCampusId;
    if (!campusId || !isValidUuid(campusId)) return 'Campus Principal';
    const found = campuses?.find(c => c.id === campusId);
    return found?.name || 'Campus Rattaché';
  }, [user.campus_id, currentCampusId, campuses]);

  // Libellé de l'année académique active
  const selectedYearLabel = useMemo(() => {
    const found = academicYears.find(y => y.id === selectedYearId);
    return found?.label || found?.name || 'Session en cours';
  }, [academicYears, selectedYearId]);

  // Options du sélecteur pilule pour les catégories de dépenses (Harmonisé Feuille de Présence)
  const categoryOptions = useMemo((): SelectOption[] => {
    const options: SelectOption[] = [];

    // 1. Catégories standards
    STANDARD_BUDGET_CATEGORIES.forEach(cat => {
      options.push({
        value: cat.label,
        label: cat.label,
        badge: cat.badge,
        description: `Dotation suggérée : ${(cat.defaultPlanned / 1000)}k G`,
        icon: cat.icon
      });
    });

    // 2. Catégories existantes de la base de données
    categories.forEach(cat => {
      if (!options.some(o => o.value.toLowerCase() === cat.label.toLowerCase())) {
        options.push({
          value: cat.label,
          label: cat.label,
          badge: 'Comptabilité',
          icon: Building
        });
      }
    });

    // 3. Option personnalisée
    options.push({
      value: '__CUSTOM__',
      label: '+ Saisir un centre de coûts sur mesure...',
      badge: 'Personnalisé',
      description: 'Définir un intitulé spécifique',
      icon: Plus
    });

    return options;
  }, [categories]);

  // Options du sélecteur pilule pour les campus (si multi-campus)
  const campusOptions = useMemo((): SelectOption[] => {
    const list: SelectOption[] = [
      { value: 'GLOBAL', label: 'Global (Tous les campus)', badge: 'Général', icon: Building2 }
    ];
    campuses?.forEach(c => {
      list.push({
        value: c.id,
        label: c.name,
        badge: 'Campus',
        icon: Building
      });
    });
    return list;
  }, [campuses]);

  const fetchContext = async () => {
    try {
      const { data: ayData } = await supabase
        .from('academic_years')
        .select('*')
        .eq('school_id', user.school_id)
        .order('label', { ascending: false });
      
      if (ayData && ayData.length > 0) {
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
      // 1. Charger les budgets alloués
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

      // 2. Charger les décaissements effectifs pour cette session
      let expenseQuery = supabase
        .from('expenses')
        .select('amount, amount_htg_equivalent, category_legacy, category_ref:expense_categories(label)')
        .eq('school_id', user.school_id)
        .eq('academic_year_id', selectedYearId);

      if (activeCampusId && isValidUuid(activeCampusId)) {
        expenseQuery = expenseQuery.eq('campus_id', activeCampusId);
      }

      const { data: expenseData } = await expenseQuery;

      // 3. Agréger les réalisations réelles (en équivalent HTG certifié)
      const actualsMap: Record<string, number> = {};
      expenseData?.forEach((exp: any) => {
        const catName = (Array.isArray(exp.category_ref) ? exp.category_ref[0]?.label : (exp.category_ref as any)?.label) || exp.category_legacy || 'Autre';
        const amt = Number(exp.amount_htg_equivalent) || Number(exp.amount) || 0;
        actualsMap[catName] = (actualsMap[catName] || 0) + amt;
      });

      const enrichedBudgets = budgetData?.map((b: any) => ({
        ...b,
        actual_amount: actualsMap[b.category] || 0
      })) || [];

      setBudgets(enrichedBudgets);
    } catch (err: any) {
      console.error("Budget fetch error:", err);
      toast.error("Erreur lors de la synchronisation budgétaire.");
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

  // Ouverture du formulaire pour un nouveau budget
  const handleOpenNewModal = () => {
    setFormData({
      id: '',
      category: STANDARD_BUDGET_CATEGORIES[0].label,
      campus_id: user.campus_id || currentCampusId || 'ALL',
      planned_amount: ''
    });
    setIsCustomCategory(false);
    setCustomCategoryInput('');
    setShowModal(true);
  };

  // Ouverture du formulaire pour ajuster un budget existant
  const handleOpenEditModal = (b: Budget) => {
    const isStandard = categoryOptions.some(o => o.value === b.category && o.value !== '__CUSTOM__');
    setFormData({
      id: b.id,
      category: isStandard ? b.category : '__CUSTOM__',
      campus_id: b.campus_id || 'ALL',
      planned_amount: b.planned_amount.toString()
    });
    if (!isStandard) {
      setIsCustomCategory(true);
      setCustomCategoryInput(b.category);
    } else {
      setIsCustomCategory(false);
      setCustomCategoryInput('');
    }
    setShowModal(true);
  };

  // Enregistrement ou mise à jour d'une ligne budgétaire
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const plannedNum = parseFloat(formData.planned_amount);
    if (isNaN(plannedNum) || plannedNum <= 0) {
      toast.error("Veuillez saisir un montant prévisionnel valide supérieur à zéro.");
      return;
    }

    const finalCategory = isCustomCategory 
      ? customCategoryInput.trim() 
      : formData.category.trim();

    if (!finalCategory || finalCategory === '__CUSTOM__') {
      toast.error("Veuillez sélectionner ou renseigner un centre de coûts.");
      return;
    }

    setIsSubmitting(true);
    try {
      const selectedCampus = formData.campus_id === 'ALL' || !formData.campus_id 
        ? null 
        : formData.campus_id;

      const payload = {
        school_id: user.school_id,
        academic_year_id: selectedYearId,
        campus_id: user.campus_id || selectedCampus,
        category: finalCategory,
        planned_amount: plannedNum
      };

      if (formData.id) {
        const { error } = await supabase
          .from('budgets')
          .update(payload)
          .eq('id', formData.id)
          .eq('school_id', user.school_id);

        if (error) throw error;
        toast.success("Dotation budgétaire ajustée");
      } else {
        const { error } = await supabase
          .from('budgets')
          .insert([payload]);

        if (error) throw error;
        toast.success("Nouvelle dotation budgétaire enregistrée");
      }

      setShowModal(false);
      setFormData({ id: '', category: '', campus_id: '', planned_amount: '' });
      fetchBudgets();
    } catch (err: any) {
      toast.error("Erreur d'enregistrement : " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Suppression sécurisée
  const handleDelete = async (b: Budget) => {
    if (!window.confirm(`Confirmez-vous la suppression de la dotation budgétaire "${b.category}" ?`)) {
      return;
    }
    try {
      const { error } = await supabase
        .from('budgets')
        .delete()
        .eq('id', b.id)
        .eq('school_id', user.school_id);

      if (error) throw error;
      toast.success(`Ligne budgétaire "${b.category}" supprimée`);
      fetchBudgets();
    } catch (err: any) {
      toast.error("Erreur lors de la suppression : " + err.message);
    }
  };

  // Génération rapide du cadre budgétaire type standard
  const handleGenerateStandardTemplate = async () => {
    if (!selectedYearId) {
      toast.error("Veuillez sélectionner une session académique active.");
      return;
    }

    const existingNames = new Set(budgets.map(b => b.category.toLowerCase().trim()));
    const toInsert = STANDARD_BUDGET_CATEGORIES
      .filter(cat => !existingNames.has(cat.label.toLowerCase().trim()))
      .map(cat => ({
        school_id: user.school_id,
        academic_year_id: selectedYearId,
        campus_id: user.campus_id || currentCampusId || null,
        category: cat.label,
        planned_amount: cat.defaultPlanned
      }));

    if (toInsert.length === 0) {
      toast.info("Tous les postes du cadre standard sont déjà configurés.");
      return;
    }

    if (!window.confirm(`Générer automatiquement ${toInsert.length} ligne(s) budgétaire(s) du cadre standard ?`)) {
      return;
    }

    setIsGeneratingTemplate(true);
    try {
      const { error } = await supabase.from('budgets').insert(toInsert);
      if (error) throw error;
      toast.success(`${toInsert.length} postes budgétaires initialisés`);
      fetchBudgets();
    } catch (err: any) {
      toast.error("Erreur lors de l'initialisation : " + err.message);
    } finally {
      setIsGeneratingTemplate(false);
    }
  };

  // Calculs synthétiques globaux
  const totalPlanned = budgets.reduce((acc, b) => acc + Number(b.planned_amount || 0), 0);
  const totalActual = budgets.reduce((acc, b) => acc + Number(b.actual_amount || 0), 0);
  const globalProgress = totalPlanned > 0 ? (totalActual / totalPlanned) * 100 : 0;
  const netRemaining = totalPlanned - totalActual;

  // Filtrage et Tri dynamique
  const filteredBudgets = useMemo(() => {
    let list = [...budgets];

    // Recherche
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      list = list.filter(b => b.category.toLowerCase().includes(term));
    }

    // Filtre de statut de consommation
    if (filterStatus === 'HEALTHY') {
      list = list.filter(b => (b.actual_amount / (b.planned_amount || 1)) * 100 < 80);
    } else if (filterStatus === 'WARNING') {
      list = list.filter(b => {
        const ratio = (b.actual_amount / (b.planned_amount || 1)) * 100;
        return ratio >= 80 && ratio <= 100;
      });
    } else if (filterStatus === 'EXCEEDED') {
      list = list.filter(b => (b.actual_amount / (b.planned_amount || 1)) * 100 > 100);
    }

    // Tri
    if (sortBy === 'PROGRESS_DESC') {
      list.sort((a, b) => (b.actual_amount / (b.planned_amount || 1)) - (a.actual_amount / (a.planned_amount || 1)));
    } else if (sortBy === 'PROGRESS_ASC') {
      list.sort((a, b) => (a.actual_amount / (a.planned_amount || 1)) - (b.actual_amount / (b.planned_amount || 1)));
    } else if (sortBy === 'PLANNED_DESC') {
      list.sort((a, b) => b.planned_amount - a.planned_amount);
    } else if (sortBy === 'NAME') {
      list.sort((a, b) => a.category.localeCompare(b.category));
    }

    return list;
  }, [budgets, searchTerm, filterStatus, sortBy]);

  // Options pour les sélecteurs pilules de filtres
  const STATUS_OPTIONS: SelectOption[] = [
    { value: 'ALL', label: 'Tous les statuts' },
    { value: 'HEALTHY', label: 'Sous contrôle (< 80%)' },
    { value: 'WARNING', label: 'Seuil d\'alerte (80-100%)' },
    { value: 'EXCEEDED', label: 'En dépassement (> 100%)' }
  ];

  const SORT_OPTIONS: SelectOption[] = [
    { value: 'DEFAULT', label: 'Tri par défaut' },
    { value: 'PROGRESS_DESC', label: 'Taux consommation ↓' },
    { value: 'PROGRESS_ASC', label: 'Taux consommation ↑' },
    { value: 'PLANNED_DESC', label: 'Dotation allouée ↓' },
    { value: 'NAME', label: 'Ordre alphabétique' }
  ];

  // Calcul d'impact budgétaire en direct dans le formulaire
  const effectiveLiveCategory = isCustomCategory ? customCategoryInput : formData.category;
  const liveFormPlanned = parseFloat(formData.planned_amount) || 0;
  const editingBudget = budgets.find(b => b.id === formData.id);
  const simulatedTotalPlanned = totalPlanned - (editingBudget?.planned_amount || 0) + liveFormPlanned;
  const livePercentageOfBudget = simulatedTotalPlanned > 0 ? (liveFormPlanned / simulatedTotalPlanned) * 100 : 0;
  const currentCategoryActual = budgets.find(b => b.category.toLowerCase() === effectiveLiveCategory.toLowerCase())?.actual_amount || 0;

  return (
    <div className="space-y-2.5 sm:space-y-3 animate-in fade-in duration-200">
      {/* 1. Header Compact et Harmonisé */}
      <div className="bg-white p-2.5 sm:p-3 rounded-xl sm:rounded-2xl shadow-xs border border-slate-200/90 flex flex-col md:flex-row items-start md:items-center justify-between gap-2.5 relative">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-slate-900 text-white rounded-xl shadow-xs shrink-0">
            <Target size={18} className="text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">Planification Budgétaire</h1>
            </div>
            <p className="text-slate-500 text-[11px] font-medium leading-none mt-0.5">
              Arbitrage des dotations, cadrage des centres de coûts et maîtrise des décaissements en temps réel.
            </p>
          </div>
        </div>

        {/* Contrôles d'en-tête (Pillules & Actions) */}
        <div className="flex items-center gap-2 w-full lg:w-auto justify-between lg:justify-end flex-wrap sm:flex-nowrap shrink-0">
          <div className="min-w-[210px] sm:min-w-[235px] shrink-0">
            <AcademicSessionPill
              academicYears={academicYears}
              selectedYearId={selectedYearId}
              onSelectYear={(yearId) => setSelectedYearId(yearId)}
              size="sm"
              variant="field"
              colorScheme="indigo"
              dropdownAlign="right"
            />
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button 
              type="button"
              onClick={fetchBudgets}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all border border-slate-200 shadow-2xs active:scale-95 cursor-pointer shrink-0"
              title="Actualiser les calculs budgétaires"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>

            <button 
              type="button"
              onClick={handleOpenNewModal}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs tracking-wider uppercase shadow-xs transition-all active:scale-95 cursor-pointer shrink-0 whitespace-nowrap"
            >
              <Plus size={14} /> <span>Nouveau Budget</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Indicateurs Clés Compacts & Denses (Rythme visuel optimisé) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-2.5">
        {/* Carte 1 : Dotation Globale */}
        <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200/90 shadow-2xs space-y-0.5">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Dotation Globale Prévue</span>
            <div className="p-1 bg-indigo-50 text-indigo-600 rounded-md">
              <PieChart size={12} />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <p className="text-lg sm:text-xl font-black text-slate-900 font-mono tracking-tight">
              {totalPlanned.toLocaleString()} <span className="text-[11px] font-semibold text-slate-400">G</span>
            </p>
            <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
              {budgets.length} poste{budgets.length > 1 ? 's' : ''}
            </span>
          </div>
          <p className="text-[9px] text-slate-400 font-medium truncate">
            Budget alloué pour la session {selectedYearLabel}
          </p>
        </div>

        {/* Carte 2 : Décaissements Réels */}
        <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200/90 shadow-2xs space-y-0.5">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Décaissements Réels</span>
            <div className="p-1 bg-amber-50 text-amber-600 rounded-md">
              <TrendingUp size={12} />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <p className="text-lg sm:text-xl font-black text-slate-900 font-mono tracking-tight">
              {totalActual.toLocaleString()} <span className="text-[11px] font-semibold text-slate-400">G</span>
            </p>
            <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
              {globalProgress.toFixed(1)}% engagé
            </span>
          </div>
          <p className="text-[9px] text-slate-400 font-medium truncate">
            Total des dépenses certifiées enregistrées
          </p>
        </div>

        {/* Carte 3 : Reliquat & Taux d'Exécution */}
        <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200/90 shadow-2xs space-y-1 sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Reliquat Disponible</span>
            <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
              globalProgress > 100 
                ? 'bg-rose-100 text-rose-700' 
                : globalProgress > 80 
                ? 'bg-amber-100 text-amber-700' 
                : 'bg-emerald-100 text-emerald-700'
            }`}>
              {globalProgress > 100 ? 'Dépassement' : globalProgress > 80 ? 'Vigilance' : 'Sain'}
            </span>
          </div>

          <div className="flex items-baseline justify-between">
            <p className={`text-lg sm:text-xl font-black font-mono tracking-tight ${
              netRemaining < 0 ? 'text-rose-600' : 'text-emerald-700'
            }`}>
              {netRemaining >= 0 ? '+' : ''}{netRemaining.toLocaleString()} <span className="text-[11px] font-semibold">G</span>
            </p>
            <span className="text-[11px] font-black text-slate-700">
              {globalProgress.toFixed(1)}%
            </span>
          </div>

          {/* Micro Progress Bar */}
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-700 rounded-full ${
                globalProgress > 100 
                  ? 'bg-rose-500' 
                  : globalProgress > 80 
                  ? 'bg-amber-500' 
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(globalProgress, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* 3. Barre de Filtres & Recherche Compacte (Style Pilule) */}
      <div className="bg-white p-2 sm:p-2.5 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
        {/* Recherche instantanée */}
        <div className="relative flex-1 min-w-[180px] group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 pointer-events-none transition-colors" size={13} />
          <input 
            type="text"
            placeholder="Rechercher centre de coûts ou dotation..."
            className="w-full pl-8 pr-7 py-1.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-2xs"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button 
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Sélecteurs Pilules Statut & Tri */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="w-full sm:w-44">
            <SelectPill
              options={STATUS_OPTIONS}
              value={filterStatus}
              onChange={(val) => setFilterStatus(val as any)}
              icon={Filter}
              variant="field"
              size="sm"
              colorScheme="indigo"
              className="w-full"
            />
          </div>

          <div className="w-full sm:w-40">
            <SelectPill
              options={SORT_OPTIONS}
              value={sortBy}
              onChange={(val) => setSortBy(val as any)}
              icon={ArrowUpDown}
              variant="field"
              size="sm"
              colorScheme="slate"
              className="w-full"
            />
          </div>

          {budgets.length === 0 && (
            <button
              type="button"
              onClick={handleGenerateStandardTemplate}
              disabled={isGeneratingTemplate}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs shrink-0"
              title="Pré-remplir les rubriques types"
            >
              <Sparkles size={12} />
              <span>Cadre Standard</span>
            </button>
          )}
        </div>
      </div>

      {/* 4. Liste / Tableau Comparatif Prévisions vs Réel (Densité & Responsive) */}
      <div className="bg-white rounded-xl sm:rounded-2xl shadow-xs border border-slate-200/90 overflow-hidden">
        {/* Table visible sur Desktop / Tablette */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[650px]">
            <thead>
              <tr className="bg-slate-900 text-slate-100 border-b border-slate-800">
                <th className="px-3 py-2 text-[10px] font-black text-slate-200 uppercase tracking-wider">Centre de Coûts / Ligne</th>
                <th className="px-3 py-2 text-[10px] font-black text-slate-200 uppercase tracking-wider text-right w-32">Dotation Prévue</th>
                <th className="px-3 py-2 text-[10px] font-black text-slate-200 uppercase tracking-wider text-right w-32">Dépenses Réelles</th>
                <th className="px-3 py-2 text-[10px] font-black text-slate-200 uppercase tracking-wider text-right w-32">Reliquat Net</th>
                <th className="px-3 py-2 text-[10px] font-black text-slate-200 uppercase tracking-wider w-40">Taux d'Exécution</th>
                <th className="px-3 py-2 text-[10px] font-black text-slate-200 uppercase tracking-wider text-center w-16">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center">
                    <Loader2 className="w-5 h-5 animate-spin text-indigo-600 mx-auto" />
                    <p className="text-slate-600 text-xs font-bold mt-1.5">Calcul des engagements budgétaires...</p>
                  </td>
                </tr>
              ) : filteredBudgets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center">
                    <div className="max-w-md mx-auto space-y-2">
                      <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mx-auto">
                        <Target size={20} />
                      </div>
                      <p className="text-slate-700 text-xs font-bold">
                        {searchTerm ? "Aucun poste budgétaire ne correspond à votre recherche." : "Aucune dotation budgétaire configurée pour cette session."}
                      </p>
                      <div className="pt-1 flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={handleOpenNewModal}
                          className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-all cursor-pointer shadow-xs"
                        >
                          + Ajouter une dotation
                        </button>
                        <button
                          type="button"
                          onClick={handleGenerateStandardTemplate}
                          disabled={isGeneratingTemplate}
                          className="px-3 py-1.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold hover:bg-slate-200 transition-all cursor-pointer flex items-center gap-1"
                        >
                          <Sparkles size={12} className="text-indigo-600" />
                          <span>Initialiser le cadre type</span>
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredBudgets.map((b) => {
                  const diff = b.planned_amount - b.actual_amount;
                  const progress = b.planned_amount > 0 ? (b.actual_amount / b.planned_amount) * 100 : 0;
                  const isOver = progress > 100;
                  const isWarning = progress >= 80 && progress <= 100;

                  return (
                    <tr key={b.id} className="hover:bg-slate-50/80 transition-colors group">
                      {/* Ligne / Centre de Coûts */}
                      <td className="px-3 py-2 align-middle">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-md bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs shrink-0 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                            <Building size={13} />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 truncate">{b.category}</p>
                            <p className="text-[10px] text-slate-400 font-medium leading-none">Centre de coûts</p>
                          </div>
                        </div>
                      </td>

                      {/* Montant Prévu */}
                      <td className="px-3 py-2 text-right whitespace-nowrap align-middle">
                        <p className="font-black text-slate-900 font-mono">
                          {b.planned_amount.toLocaleString()} G
                        </p>
                      </td>

                      {/* Montant Réel */}
                      <td className="px-3 py-2 text-right whitespace-nowrap align-middle">
                        <p className="font-black text-slate-700 font-mono">
                          {b.actual_amount.toLocaleString()} G
                        </p>
                      </td>

                      {/* Reliquat / Écart */}
                      <td className="px-3 py-2 text-right whitespace-nowrap align-middle">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                          diff < 0 ? 'text-rose-700 bg-rose-50 border border-rose-200' : 'text-emerald-700 bg-emerald-50 border border-emerald-200'
                        }`}>
                          {diff > 0 ? '+' : ''}{diff.toLocaleString()} G
                        </span>
                      </td>

                      {/* Taux & Jauge de Consommation */}
                      <td className="px-3 py-2 align-middle">
                        <div className="space-y-1">
                          <div className="flex justify-between items-center text-[10px] font-black">
                            <span className={isOver ? 'text-rose-600 font-extrabold' : isWarning ? 'text-amber-600' : 'text-slate-600'}>
                              {progress.toFixed(1)}%
                            </span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase">
                              {isOver ? 'Dépassement' : isWarning ? 'Alerte' : 'Sain'}
                            </span>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className={`h-full transition-all duration-500 rounded-full ${
                                isOver ? 'bg-rose-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500'
                              }`}
                              style={{ width: `${Math.min(progress, 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-3 py-2 text-center whitespace-nowrap align-middle">
                        <div className="flex items-center justify-center gap-1">
                          <button 
                            type="button"
                            onClick={() => handleOpenEditModal(b)}
                            className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-all cursor-pointer"
                            title="Modifier cette dotation"
                          >
                            <Edit3 size={13} />
                          </button>
                          <button 
                            type="button"
                            onClick={() => handleDelete(b)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-all cursor-pointer"
                            title="Supprimer cette dotation"
                          >
                            <Trash2 size={13} />
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

        {/* Vue Mobile Compacte (< 640px) */}
        <div className="sm:hidden divide-y divide-slate-100">
          {loading ? (
            <div className="p-4 text-center">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-600 mx-auto" />
              <p className="text-slate-600 text-xs font-bold mt-1.5">Calcul des engagements...</p>
            </div>
          ) : filteredBudgets.length === 0 ? (
            <div className="p-4 text-center space-y-1.5">
              <Target size={20} className="text-slate-300 mx-auto" />
              <p className="text-slate-700 text-xs font-bold">Aucune dotation budgétaire trouvée.</p>
            </div>
          ) : (
            filteredBudgets.map((b) => {
              const diff = b.planned_amount - b.actual_amount;
              const progress = b.planned_amount > 0 ? (b.actual_amount / b.planned_amount) * 100 : 0;
              const isOver = progress > 100;
              const isWarning = progress >= 80 && progress <= 100;

              return (
                <div key={b.id} className="p-2.5 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-slate-900">{b.category}</p>
                      <span className={`inline-block text-[9px] font-black uppercase px-1.5 py-0.5 rounded mt-0.5 ${
                        isOver ? 'bg-rose-100 text-rose-700' : isWarning ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {isOver ? 'Dépassement' : isWarning ? 'Vigilance' : 'Sain'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button 
                        type="button"
                        onClick={() => handleOpenEditModal(b)}
                        className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                      >
                        <Edit3 size={13} />
                      </button>
                      <button 
                        type="button"
                        onClick={() => handleDelete(b)}
                        className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Chiffres comparatifs */}
                  <div className="grid grid-cols-3 gap-1 bg-slate-50 p-1.5 rounded-lg text-center">
                    <div>
                      <p className="text-[8px] text-slate-400 font-bold uppercase">Prévu</p>
                      <p className="text-[11px] font-black text-slate-900 font-mono">{b.planned_amount.toLocaleString()} G</p>
                    </div>
                    <div>
                      <p className="text-[8px] text-slate-400 font-bold uppercase">Réel</p>
                      <p className="text-[11px] font-black text-slate-700 font-mono">{b.actual_amount.toLocaleString()} G</p>
                    </div>
                    <div>
                      <p className="text-[8px] text-slate-400 font-bold uppercase">Reliquat</p>
                      <p className={`text-[11px] font-black font-mono ${diff < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {diff > 0 ? '+' : ''}{diff.toLocaleString()} G
                      </p>
                    </div>
                  </div>

                  {/* Jauge mobile */}
                  <div className="space-y-0.5">
                    <div className="flex justify-between text-[9px] font-bold text-slate-500">
                      <span>Exécution : {progress.toFixed(1)}%</span>
                      <span>{b.actual_amount.toLocaleString()} / {b.planned_amount.toLocaleString()} G</span>
                    </div>
                    <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${isOver ? 'bg-rose-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500'}`}
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 5. Modal / Formulaire « Nouveau Budget » Harmonisé Style Pilule (Feuille de Présence) */}
      {showModal && (
        <div className="fixed inset-0 z-[1000] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
            {/* Header Modal Compact */}
            <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/90">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-indigo-600 text-white rounded-lg flex items-center justify-center shadow-xs">
                  <Target size={14} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 tracking-tight">
                    {formData.id ? 'Ajuster la Dotation Budgétaire' : 'Nouveau Budget • Dotation'}
                  </h3>
                  <p className="text-[10px] text-slate-500 font-medium">
                    Session : <span className="font-bold text-slate-700">{selectedYearLabel}</span> • {activeCampusName}
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Corps du Formulaire Dense & Ergonomique */}
            <form onSubmit={handleSave} className="p-3.5 sm:p-4 space-y-2.5 overflow-y-auto">
              {/* Champ 1 : Liste déroulante Style Pilule (Harmonisé Feuille de Présence) */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                    <span>Centre de Coûts / Rubrique</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomCategory(!isCustomCategory);
                      if (!isCustomCategory) {
                        setCustomCategoryInput('');
                      } else {
                        setFormData(prev => ({ ...prev, category: STANDARD_BUDGET_CATEGORIES[0].label }));
                      }
                    }}
                    className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                  >
                    {isCustomCategory ? "Choisir dans la liste pilule" : "Saisie manuelle sur mesure"}
                  </button>
                </div>

                {!isCustomCategory ? (
                  /* Sélecteur Pilule Catégorie (Exactement comme dans Feuille de Présence) */
                  <SelectPill
                    options={categoryOptions}
                    value={formData.category}
                    onChange={(val) => {
                      if (val === '__CUSTOM__') {
                        setIsCustomCategory(true);
                        setCustomCategoryInput('');
                      } else {
                        setFormData(prev => ({ ...prev, category: val }));
                      }
                    }}
                    icon={Building}
                    variant="field"
                    size="sm"
                    colorScheme="indigo"
                    searchable={true}
                    placeholder="Sélectionner une rubrique..."
                    className="w-full"
                  />
                ) : (
                  /* Saisie Manuelle Directe avec bouton de retour rapide */
                  <div className="relative flex items-center">
                    <input 
                      autoFocus
                      required
                      type="text"
                      placeholder="Ex: Laboratoire de Sciences, Transport Scolaire..."
                      className="w-full pl-3 pr-8 py-1.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-2xs"
                      value={customCategoryInput}
                      onChange={(e) => setCustomCategoryInput(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setIsCustomCategory(false)}
                      className="absolute right-2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                      title="Revenir à la liste déroulante pilule"
                    >
                      <X size={13} />
                    </button>
                  </div>
                )}

                {/* Suggestions directes rapides en pilules sous la liste */}
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {STANDARD_BUDGET_CATEGORIES.slice(0, 4).map((cat, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setIsCustomCategory(false);
                        setFormData(prev => ({ ...prev, category: cat.label }));
                      }}
                      className={`px-2 py-0.5 rounded-full text-[9px] font-bold transition-all cursor-pointer ${
                        !isCustomCategory && formData.category === cat.label
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200'
                      }`}
                    >
                      {cat.label.split('&')[0].trim()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Champ 2 : Campus de rattachement (si multi-campus) en Style Pilule */}
              {hasMultipleCampuses && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block">
                    Campus de Rattachement
                  </label>
                  <SelectPill
                    options={campusOptions}
                    value={formData.campus_id || 'ALL'}
                    onChange={(val) => setFormData(prev => ({ ...prev, campus_id: val }))}
                    icon={Building2}
                    variant="field"
                    size="sm"
                    colorScheme="slate"
                    className="w-full"
                  />
                </div>
              )}

              {/* Champ 3 : Montant Prévisionnel avec Paliers en Pilules */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                    Montant Alloué (Gourdes HTG) <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[9px] text-slate-400 font-medium">Dotation prévisionnelle</span>
                </div>

                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs font-mono">
                    HTG
                  </div>
                  <input 
                    required
                    type="number"
                    min="1"
                    step="any"
                    placeholder="0.00"
                    className="w-full pl-12 pr-4 py-1.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-xl text-sm font-black text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all font-mono shadow-2xs"
                    value={formData.planned_amount}
                    onChange={(e) => setFormData({ ...formData, planned_amount: e.target.value })}
                  />
                </div>

                {/* Paliers rapides en style pilules interactives harmonisées (Feuille de Présence) */}
                <div className="flex items-center gap-1 flex-wrap pt-0.5">
                  <span className="text-[9px] font-bold text-slate-400 shrink-0">Paliers :</span>
                  {QUICK_AMOUNT_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, planned_amount: preset.toString() }))}
                      className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold transition-all cursor-pointer ${
                        formData.planned_amount === preset.toString()
                          ? 'bg-indigo-600 text-white border border-indigo-600 shadow-2xs'
                          : 'bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 border border-slate-200'
                      }`}
                    >
                      {preset >= 1000000 ? `${preset / 1000000}M` : preset >= 1000 ? `${preset / 1000}k` : preset} G
                    </button>
                  ))}
                </div>
              </div>

              {/* Simulation en direct de l'impact budgétaire */}
              {liveFormPlanned > 0 && (
                <div className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1 text-xs">
                  <div className="flex items-center justify-between text-[10px] font-bold">
                    <span className="text-slate-600 flex items-center gap-1">
                      <PieChart size={12} className="text-indigo-600" /> Poids dans le budget total :
                    </span>
                    <span className="font-mono font-black text-indigo-700">
                      {livePercentageOfBudget.toFixed(1)}% de l'enveloppe
                    </span>
                  </div>

                  {currentCategoryActual > 0 && (
                    <div className="pt-1 border-t border-slate-200/60 flex items-center justify-between text-[10px]">
                      <span className="text-slate-500">Dépenses réelles déjà enregistrées :</span>
                      <span className="font-mono font-bold text-slate-800">
                        {currentCategoryActual.toLocaleString()} G
                      </span>
                    </div>
                  )}

                  {currentCategoryActual > liveFormPlanned && (
                    <div className="p-1.5 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-1.5 text-rose-700 text-[10px] font-medium">
                      <AlertTriangle size={12} className="shrink-0" />
                      <span>Attention : Les dépenses réelles ({currentCategoryActual.toLocaleString()} G) dépassent cette dotation.</span>
                    </div>
                  )}
                </div>
              )}

              {/* Actions du Modal Compactes */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                <button 
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  Annuler
                </button>
                <button 
                  disabled={isSubmitting}
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider shadow-xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" size={13} /> : <Save size={13} />}
                  <span>{formData.id ? 'Ajuster la Dotation' : 'Enregistrer'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BudgetPlanningView;
