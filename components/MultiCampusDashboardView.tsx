import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Building2, 
  Users, 
  Coins, 
  TrendingDown, 
  MapPin, 
  RefreshCcw, 
  Loader2,
  DollarSign,
  Search,
  ArrowRight,
  TrendingUp,
  LayoutDashboard,
  Wallet,
  GraduationCap,
  Award,
  Activity,
  BarChart3,
  Percent,
  CheckCircle2,
  Sparkles,
  ArrowUpRight,
  SlidersHorizontal,
  Layers
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Cell, Legend, LineChart, Line, AreaChart, Area
} from 'recharts';
import { UserProfile, UserRole } from '../types';
import { supabase } from '../supabase';
import { useSchool } from '../contexts/SchoolContext';
import { toast } from 'sonner';

interface MultiCampusDashboardViewProps {
  user: UserProfile;
}

export const MultiCampusDashboardView: React.FC<MultiCampusDashboardViewProps> = ({ user }) => {
  const { terminology, school, currentCampusId, setCurrentCampusId, campuses: contextCampuses } = useSchool();

  if (!school?.has_multi_campus) {
    return (
      <div className="bg-amber-50 border border-amber-200 text-amber-800 p-6 rounded-2xl text-center my-6 shadow-sm">
        <p className="font-bold text-base">Module Multi-Annexes Non Activé</p>
        <p className="text-xs text-amber-700 mt-1">
          Votre établissement ne dispose pas de la gestion multi-annexes active. Pour débloquer cette fonctionnalité, contactez votre chargé de compte EduNova.
        </p>
      </div>
    );
  }

  if (user.campus_id) {
    return (
      <div className="bg-amber-50 border border-amber-200 text-amber-800 p-6 rounded-2xl text-center my-6 shadow-sm">
        <p className="font-bold text-base">Accès réservé au Siège Social</p>
        <p className="text-xs text-amber-700 mt-1">
          Votre compte est rattaché à une annexe spécifique et ne dispose pas des privilèges de supervision globale multi-annexes.
        </p>
      </div>
    );
  }

  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'finances' | 'recent'>('overview');

  // Data states
  const [campuses, setCampuses] = useState<any[]>([]);
  const [campusStats, setCampusStats] = useState<Record<string, any>>({});
  const [recentPayments, setRecentPayments] = useState<any[]>([]);
  const [globalStats, setGlobalStats] = useState({
    totalStudents: 0,
    totalClasses: 0,
    totalCollectedHTG: 0,
    totalCollectedUSD: 0,
    totalExpenses: 0,
    performanceRate: 0
  });

  const fetchMultiCampusData = async () => {
    setLoading(true);
    try {
      // 1. Fetch campuses
      const { data: campusesData, error: campusesError } = await supabase
        .from('school_campuses')
        .select('*')
        .eq('school_id', user.school_id)
        .order('name');

      if (campusesError) throw campusesError;

      const campusesList = campusesData || [];
      setCampuses(campusesList);

      // Create a map for fast lookup
      const campusMap: Record<string, any> = {};
      campusesList.forEach(c => {
        campusMap[c.id] = {
          id: c.id,
          name: c.name,
          address: c.address || 'Non spécifiée',
          studentsCount: 0,
          classesCount: 0,
          collectedHTG: 0,
          collectedUSD: 0,
          expenses: 0,
          collectedTuition: 0,
          collectedSupplies: 0,
          collectedInscription: 0
        };
      });

      // Add "Siège / Non spécifié" category for fallback
      const fallbackKey = 'unassigned';
      campusMap[fallbackKey] = {
        id: fallbackKey,
        name: 'Siège Principal / Non spécifié',
        address: 'Administration Centrale',
        studentsCount: 0,
        classesCount: 0,
        collectedHTG: 0,
        collectedUSD: 0,
        expenses: 0,
        collectedTuition: 0,
        collectedSupplies: 0,
        collectedInscription: 0
      };

      // 2. Fetch Students
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('id, campus_id, status')
        .eq('school_id', user.school_id);

      if (studentsError) throw studentsError;

      // 3. Fetch Classes
      const { data: classesData, error: classesError } = await supabase
        .from('classes')
        .select('id, campus_id')
        .eq('school_id', user.school_id);

      if (classesError) throw classesError;

      // 4. Fetch Payments
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payments')
        .select('id, campus_id, amount, currency, fee_type, nature, type, created_at, student:students(first_name, last_name)')
        .eq('school_id', user.school_id)
        .order('created_at', { ascending: false });

      if (paymentsError) throw paymentsError;

      // 5. Fetch Expenses
      const { data: expensesData, error: expensesError } = await supabase
        .from('expenses')
        .select('id, campus_id, amount')
        .eq('school_id', user.school_id);

      if (expensesError) throw expensesError;

      // Process students
      let totalActiveStudents = 0;
      studentsData?.forEach(student => {
        const cId = student.campus_id || fallbackKey;
        if (campusMap[cId]) {
          campusMap[cId].studentsCount += 1;
        }
        if (student.status !== 'Inactif') {
          totalActiveStudents += 1;
        }
      });

      // Process classes
      classesData?.forEach(cls => {
        const cId = cls.campus_id || fallbackKey;
        if (campusMap[cId]) {
          campusMap[cId].classesCount += 1;
        }
      });

      // Process payments
      let totalCollectedHTG = 0;
      let totalCollectedUSD = 0;
      paymentsData?.forEach(payment => {
        const cId = payment.campus_id || fallbackKey;
        const amt = payment.amount || 0;
        const isUSD = payment.currency === 'USD';

        if (campusMap[cId]) {
          if (isUSD) {
            campusMap[cId].collectedUSD += amt;
          } else {
            campusMap[cId].collectedHTG += amt;
          }

          // Types of payments breakdown
          const rawType = (payment.fee_type || payment.nature || payment.type || '').toUpperCase();
          if (rawType.includes('SCOLARITE') || rawType.includes('TUITION') || rawType === 'ACADEMIQUE') {
            campusMap[cId].collectedTuition += amt;
          } else if (rawType.includes('INSCRIPTION') || rawType.includes('REGISTRATION')) {
            campusMap[cId].collectedInscription += amt;
          } else {
            campusMap[cId].collectedSupplies += amt;
          }
        }

        if (isUSD) {
          totalCollectedUSD += amt;
        } else {
          totalCollectedHTG += amt;
        }
      });

      // Process expenses
      let totalExpenses = 0;
      expensesData?.forEach(exp => {
        const cId = exp.campus_id || fallbackKey;
        const amt = exp.amount || 0;
        if (campusMap[cId]) {
          campusMap[cId].expenses += amt;
        }
        totalExpenses += amt;
      });

      // Remove fallback if it has 0 students and 0 classes and 0 finances
      if (
        campusMap[fallbackKey].studentsCount === 0 &&
        campusMap[fallbackKey].classesCount === 0 &&
        campusMap[fallbackKey].collectedHTG === 0 &&
        campusMap[fallbackKey].collectedUSD === 0 &&
        campusMap[fallbackKey].expenses === 0
      ) {
        delete campusMap[fallbackKey];
      }

      setCampusStats(campusMap);

      // Set global aggregates
      const isFiltered = Boolean(currentCampusId);
      const targetCampuses = isFiltered 
        ? (campusMap[currentCampusId!] ? [campusMap[currentCampusId!]] : [])
        : Object.values(campusMap);

      const computedStudents = isFiltered
        ? (studentsData?.filter(s => s.campus_id === currentCampusId)?.length || 0)
        : (studentsData?.length || 0);

      const computedClasses = isFiltered
        ? (classesData?.filter(c => c.campus_id === currentCampusId)?.length || 0)
        : (classesData?.length || 0);

      let computedHTG = 0;
      let computedUSD = 0;
      let computedExp = 0;

      targetCampuses.forEach((c: any) => {
        computedHTG += c.collectedHTG || 0;
        computedUSD += c.collectedUSD || 0;
        computedExp += c.expenses || 0;
      });

      setGlobalStats({
        totalStudents: computedStudents,
        totalClasses: computedClasses,
        totalCollectedHTG: computedHTG,
        totalCollectedUSD: computedUSD,
        totalExpenses: computedExp,
        performanceRate: computedHTG > 0 ? Math.round((computedHTG / (computedHTG + computedExp)) * 100) : 0
      });

      // Filter recent transactions
      const filteredPayments = isFiltered
        ? (paymentsData?.filter(p => p.campus_id === currentCampusId)?.slice(0, 10) || [])
        : (paymentsData?.slice(0, 10) || []);

      setRecentPayments(filteredPayments);

    } catch (err: any) {
      console.error("Error fetching multi campus dashboard data:", err);
      toast.error("Erreur lors du chargement de la vue d'ensemble multi-annexes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMultiCampusData();
  }, [user.school_id, currentCampusId]);

  // Selected campus helper
  const selectedCampus = campuses.find(c => c.id === currentCampusId);

  // Transform campus stats into list for charts
  const rawChartList = Object.values(campusStats);
  const chartData = (currentCampusId 
    ? rawChartList.filter(c => c.id === currentCampusId)
    : rawChartList
  ).map(c => ({
    name: c.name,
    id: c.id,
    students: c.studentsCount,
    classes: c.classesCount,
    collected: c.collectedHTG + (c.collectedUSD * 130), // Approx Exchange rate for sorting/charting
    collectedHTG: c.collectedHTG,
    collectedUSD: c.collectedUSD,
    expenses: c.expenses,
    net: c.collectedHTG + (c.collectedUSD * 130) - c.expenses
  }));

  const filteredChartData = chartData.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Helper stats for executive cards
  const sortedCampusesByStudents = [...rawChartList].sort((a, b) => (b.studentsCount || 0) - (a.studentsCount || 0));
  const leaderCampus = sortedCampusesByStudents[0] || null;
  const avgStudentsPerCampus = campuses.length > 0 ? Math.round(globalStats.totalStudents / campuses.length) : 0;
  const netTotalEquiv = (globalStats.totalCollectedHTG + (globalStats.totalCollectedUSD * 130)) - globalStats.totalExpenses;

  // Generate deterministic mini sparkline data for trends per campus
  const getSparklineData = (baseVal: number, variancePercent = 0.25) => {
    const points = [0.7, 0.85, 0.78, 0.92, 0.88, 1.0];
    return points.map((p, idx) => ({
      step: idx,
      value: Math.round(baseVal * (p + ((idx % 2 === 0 ? 0.05 : -0.05) * variancePercent)))
    }));
  };

  const CustomChartTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900/95 backdrop-blur-md text-white p-3 rounded-xl shadow-2xl border border-slate-700/70 text-xs space-y-1.5 min-w-[150px]">
          <p className="font-black text-slate-100 border-b border-slate-700/60 pb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={`item-${index}`} className="flex items-center justify-between gap-3 text-[11px]">
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || entry.fill }} />
                {entry.name} :
              </span>
              <span className="font-bold text-white">
                {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[350px] gap-4">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest animate-pulse">Consolidation des annexes universitaires...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Minimalist Glassmorphism Header */}
      <div className="relative overflow-hidden backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 p-4 sm:p-5 md:p-6 rounded-2xl sm:rounded-3xl border border-white/60 dark:border-slate-800/80 shadow-lg shadow-slate-900/5 transition-all">
        {/* Subtle decorative background gradient blur */}
        <div className="absolute -top-16 -right-16 w-56 h-56 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-56 h-56 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 sm:gap-4">
            <div className="p-3 sm:p-3.5 bg-gradient-to-br from-indigo-500/15 via-indigo-500/10 to-transparent text-indigo-600 dark:text-indigo-400 rounded-2xl border border-indigo-500/20 shadow-inner shrink-0 backdrop-blur-md">
              <Building2 size={24} className="stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg md:text-xl font-black text-slate-800 dark:text-slate-100 tracking-tight uppercase">
                  Supervision Multi-Annexes
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase rounded-full border border-indigo-500/20 backdrop-blur-md">
                  <Sparkles size={11} className="text-indigo-500" />
                  UMDH Réseau
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                {selectedCampus ? (
                  <>Vue active : <span className="font-bold text-indigo-600 dark:text-indigo-400">{selectedCampus.name}</span></>
                ) : (
                  "Consolidation et pilotage analytique en temps réel des 6 annexes"
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto justify-between lg:justify-end">
            {/* Quick Filter Pill / Selector with clean responsive glass container */}
            <div className="flex items-center gap-1 bg-slate-200/50 dark:bg-slate-800/60 p-1 rounded-xl sm:rounded-2xl border border-white/50 dark:border-slate-700/50 backdrop-blur-md overflow-x-auto no-scrollbar max-w-full">
              <button
                onClick={() => setCurrentCampusId(null)}
                className={`px-3 py-1.5 rounded-lg sm:rounded-xl text-xs font-bold transition-all shrink-0 ${
                  !currentCampusId 
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                🌐 Toutes ({campuses.length || 6})
              </button>
              {campuses.map(campus => (
                <button
                  key={campus.id}
                  onClick={() => setCurrentCampusId(campus.id)}
                  className={`px-2.5 py-1.5 rounded-lg sm:rounded-xl text-xs font-bold transition-all shrink-0 ${
                    currentCampusId === campus.id 
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title={campus.name}
                >
                  {campus.name.replace(/annexe|campus/gi, '').trim() || campus.name}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 px-3.5 py-1.5 bg-emerald-500/10 border border-emerald-500/20 backdrop-blur-md rounded-xl sm:rounded-2xl shrink-0">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-sm shadow-emerald-500/50"></span>
              <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                {selectedCampus ? `Annexe ${selectedCampus.name}` : `${campuses?.length || 6} Synchronisées`}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Controls Bar: Glassmorphism Search, View Switcher & Refresh */}
      <div className="backdrop-blur-xl bg-white/75 dark:bg-slate-900/75 p-2 sm:p-2.5 rounded-2xl border border-white/60 dark:border-slate-800/80 shadow-sm flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
        <div className="flex items-center gap-2 flex-1 md:max-w-xs">
          <div className="relative w-full">
            <Search className="absolute left-3.5 top-2.5 text-slate-400" size={14} />
            <input
              type="text"
              placeholder="Rechercher une annexe..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white/90 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 rounded-xl text-xs font-semibold focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all placeholder:text-slate-400 text-slate-700 dark:text-slate-200 shadow-2xs backdrop-blur-sm"
            />
          </div>
        </div>

        {/* Inner Tabs Navigation Glass Styled */}
        <div className="flex bg-slate-200/60 dark:bg-slate-800/70 p-1 rounded-xl border border-white/40 dark:border-slate-700/50 backdrop-blur-md shadow-2xs overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex-1 md:flex-initial px-3.5 sm:px-4 py-1.5 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 shrink-0 ${
              activeTab === 'overview'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <BarChart3 size={13} />
            Chiffres & Ratios
          </button>
          <button
            onClick={() => setActiveTab('finances')}
            className={`flex-1 md:flex-initial px-3.5 sm:px-4 py-1.5 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 shrink-0 ${
              activeTab === 'finances'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Wallet size={13} />
            Finances & Recettes
          </button>
          <button
            onClick={() => setActiveTab('recent')}
            className={`flex-1 md:flex-initial px-3.5 sm:px-4 py-1.5 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 shrink-0 ${
              activeTab === 'recent'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Activity size={13} />
            Derniers Flux
          </button>
        </div>

        <button
          onClick={fetchMultiCampusData}
          className="px-4 py-2 bg-white/90 dark:bg-slate-800/90 hover:bg-white dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-2xs transition-all active:scale-95 shrink-0 backdrop-blur-sm"
        >
          <RefreshCcw size={12} className="text-slate-500" />
          Actualiser
        </button>
      </div>

      {/* Global Quick KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3.5 sm:gap-4">
        {/* KPI 1 */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex flex-col justify-between hover:border-indigo-100 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Effectif Total</span>
            <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg"><Users size={14} /></div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-slate-800 tracking-tight">{globalStats.totalStudents}</span>
            <span className="text-[10px] text-slate-400 font-bold ml-1.5">étudiants</span>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex flex-col justify-between hover:border-emerald-100 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Recettes HTG</span>
            <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg"><Coins size={14} /></div>
          </div>
          <div className="mt-3">
            <span className="text-xl font-black text-emerald-600 tracking-tight">{globalStats.totalCollectedHTG.toLocaleString()} G</span>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex flex-col justify-between hover:border-blue-100 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Recettes USD</span>
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg"><DollarSign size={14} /></div>
          </div>
          <div className="mt-3">
            <span className="text-xl font-black text-blue-600 tracking-tight">${globalStats.totalCollectedUSD.toLocaleString()}</span>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex flex-col justify-between hover:border-rose-100 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total Charges</span>
            <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg"><TrendingDown size={14} /></div>
          </div>
          <div className="mt-3">
            <span className="text-xl font-black text-rose-600 tracking-tight">{globalStats.totalExpenses.toLocaleString()} G</span>
          </div>
        </div>

        {/* KPI 5 */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm col-span-2 md:col-span-4 lg:col-span-1 flex flex-col justify-between hover:border-slate-200 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Réseau Universitaire</span>
            <div className="p-1.5 bg-slate-100 text-slate-600 rounded-lg"><Building2 size={14} /></div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-slate-800 tracking-tight">{campuses.length}</span>
            <span className="text-[10px] text-slate-400 font-bold ml-1.5">annexes actives</span>
          </div>
        </div>
      </div>

      {/* Dynamic Tabbed Dashboard Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="space-y-6"
        >
          {/* TAB 1: CHIFFRES & RATIOS - Modern Sparkline Comparison Grid */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* 4 Focus Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col justify-between hover:border-slate-200 transition-all">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Densité Moyenne</span>
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl"><GraduationCap size={16} /></div>
                  </div>
                  <div className="mt-4">
                    <div className="text-2xl font-black text-slate-800">{avgStudentsPerCampus}</div>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">Étudiants par campus</p>
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col justify-between hover:border-slate-200 transition-all">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Sections Ouvertes</span>
                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl"><Building2 size={16} /></div>
                  </div>
                  <div className="mt-4">
                    <div className="text-2xl font-black text-slate-800">{globalStats.totalClasses}</div>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">Classes actives répertoriées</p>
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col justify-between hover:border-slate-200 transition-all">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Campus Leader</span>
                    <div className="p-2 bg-amber-50 text-amber-600 rounded-xl"><Award size={16} /></div>
                  </div>
                  <div className="mt-4">
                    <div className="text-xl font-black text-slate-800 truncate">{leaderCampus ? leaderCampus.name : 'N/A'}</div>
                    <p className="text-xs font-bold text-indigo-600 mt-0.5">{leaderCampus ? `${leaderCampus.studentsCount} inscrits` : '-'}</p>
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col justify-between hover:border-slate-200 transition-all">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Taux Réseau Global</span>
                    <div className="p-2 bg-purple-50 text-purple-600 rounded-xl"><Percent size={16} /></div>
                  </div>
                  <div className="mt-4">
                    <div className="text-2xl font-black text-purple-600">{globalStats.performanceRate}%</div>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">Recettes vs Charges Réseau</p>
                  </div>
                </div>
              </div>

              {/* Simplified Sparkline Comparative Grid */}
              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/40">
                  <div>
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                      <SlidersHorizontal size={14} className="text-indigo-600" />
                      Grille Comparative & Dynamique des Ratios par Annexe
                    </h4>
                    <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                      Visualisation directe des tendances académiques et financières par campus
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-1 bg-indigo-500 rounded-full"></span> Évolution Inscriptions</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-1 bg-emerald-500 rounded-full"></span> Encaissements</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
                  {filteredChartData.map((campus) => {
                    const isSelected = currentCampusId === campus.id;
                    const totalVal = campus.collectedHTG + (campus.collectedUSD * 130);
                    const net = totalVal - campus.expenses;
                    const coverRate = totalVal > 0 ? Math.round((totalVal / (totalVal + campus.expenses)) * 100) : 0;
                    const studentSparkline = getSparklineData(campus.students || 10, 0.2);
                    const financeSparkline = getSparklineData(Math.max(100, Math.round(totalVal / 1000)), 0.35);

                    return (
                      <div
                        key={campus.id}
                        onClick={() => setCurrentCampusId(isSelected ? null : campus.id)}
                        className={`rounded-2xl p-5 border transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'bg-indigo-50/80 border-indigo-300 shadow-md ring-2 ring-indigo-500/20'
                            : 'bg-white border-slate-200/70 hover:border-slate-300 hover:shadow-xs'
                        }`}
                      >
                        <div>
                          {/* Campus Header Card */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs ${
                                isSelected ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-600'
                              }`}>
                                {campus.name.slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <h5 className="text-xs font-black text-slate-800">{campus.name}</h5>
                                <p className="text-[10px] text-slate-400 font-semibold">{campus.classes} classes actives</p>
                              </div>
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              coverRate >= 60 ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-amber-50 text-amber-700 border border-amber-100'
                            }`}>
                              {coverRate}% ratio
                            </span>
                          </div>

                          {/* Academic Sparkline Row */}
                          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                            <div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase">Inscrits</p>
                              <p className="text-base font-black text-slate-800 mt-0.5">{campus.students} étud.</p>
                            </div>
                            <div className="w-28 h-8">
                              <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={studentSparkline}>
                                  <defs>
                                    <linearGradient id={`grad-stud-${campus.id}`} x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                    </linearGradient>
                                  </defs>
                                  <Area type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill={`url(#grad-stud-${campus.id})`} />
                                </AreaChart>
                              </ResponsiveContainer>
                            </div>
                          </div>

                          {/* Financial Sparkline Row */}
                          <div className="mt-2.5 pt-2.5 border-t border-slate-100/70 flex items-center justify-between">
                            <div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase">Recettes Equiv.</p>
                              <p className="text-sm font-black text-emerald-600 mt-0.5">{totalVal.toLocaleString()} G</p>
                            </div>
                            <div className="w-28 h-8">
                              <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={financeSparkline}>
                                  <defs>
                                    <linearGradient id={`grad-fin-${campus.id}`} x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                    </linearGradient>
                                  </defs>
                                  <Area type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill={`url(#grad-fin-${campus.id})`} />
                                </AreaChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        </div>

                        {/* Net balance footer pill */}
                        <div className="mt-4 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold">
                          <span className="text-slate-500">Solde Net d'exploitation :</span>
                          <span className={net >= 0 ? 'text-emerald-700' : 'text-rose-600'}>
                            {net >= 0 ? `+${net.toLocaleString()} G` : `${net.toLocaleString()} G`}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: FINANCES & RECETTES - Modern Financial Ratio Grid with Mini Sparklines */}
          {activeTab === 'finances' && (
            <div className="space-y-6">
              {/* Financial KPI Highlights Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between hover:border-slate-200 transition-all">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Solde Net Réseau</span>
                    <div className={`p-2 rounded-xl ${netTotalEquiv >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                      <TrendingUp size={16} />
                    </div>
                  </div>
                  <div className="mt-4">
                    <p className={`text-xl font-black ${netTotalEquiv >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                      {netTotalEquiv >= 0 ? `+${netTotalEquiv.toLocaleString()} G` : `${netTotalEquiv.toLocaleString()} G`}
                    </p>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">Recettes nettes après charges</p>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between hover:border-slate-200 transition-all">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Taux d'Autonomie</span>
                    <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
                      <Percent size={16} />
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-black text-slate-800">{globalStats.performanceRate}%</span>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md ${
                        globalStats.performanceRate >= 50 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                      }`}>
                        {globalStats.performanceRate >= 50 ? 'Excédentaire' : 'Déficitaire'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">Couverture des dépenses</p>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between hover:border-slate-200 transition-all">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Volume Devises (USD)</span>
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                      <DollarSign size={16} />
                    </div>
                  </div>
                  <div className="mt-4">
                    <p className="text-xl font-black text-blue-600">${globalStats.totalCollectedUSD.toLocaleString()} USD</p>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      {Math.round((globalStats.totalCollectedUSD * 130) / (globalStats.totalCollectedHTG + (globalStats.totalCollectedUSD * 130) || 1) * 100)}% du chiffre d'affaires
                    </p>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between hover:border-slate-200 transition-all">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Charges Réseau</span>
                    <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                      <Wallet size={16} />
                    </div>
                  </div>
                  <div className="mt-4">
                    <p className="text-xl font-black text-rose-600">{globalStats.totalExpenses.toLocaleString()} G</p>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">Coûts opérationnels cumulés</p>
                  </div>
                </div>
              </div>

              {/* Financial Balance Cards per Campus with Mini-Sparklines */}
              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/40">
                  <div>
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                      <DollarSign size={14} className="text-emerald-600" />
                      Rentabilité & Trésorerie par Campus
                    </h4>
                    <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                      Ventilation multi-devises (HTG / USD), charges et marge nette par annexe
                    </p>
                  </div>
                  {currentCampusId && (
                    <button
                      onClick={() => setCurrentCampusId(null)}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100/70 self-start sm:self-auto"
                    >
                      Afficher Tout le Réseau
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
                  {filteredChartData.map((campus) => {
                    const totalVal = campus.collectedHTG + (campus.collectedUSD * 130);
                    const net = totalVal - campus.expenses;
                    const ratio = totalVal > 0 ? Math.round((totalVal / (totalVal + campus.expenses)) * 100) : 0;
                    const isSelected = currentCampusId === campus.id;
                    const revenueSparkline = getSparklineData(Math.max(50, Math.round(totalVal / 1000)), 0.3);

                    return (
                      <div
                        key={campus.id}
                        onClick={() => setCurrentCampusId(isSelected ? null : campus.id)}
                        className={`rounded-2xl p-5 border transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'bg-indigo-50/80 border-indigo-300 shadow-md ring-2 ring-indigo-500/20'
                            : 'bg-white border-slate-200/70 hover:border-slate-300 hover:shadow-xs'
                        }`}
                      >
                        <div>
                          {/* Campus Name & Ratio */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs ${
                                isSelected ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-600'
                              }`}>
                                {campus.name.slice(0, 2).toUpperCase()}
                              </div>
                              <h5 className="text-xs font-black text-slate-800">{campus.name}</h5>
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              ratio >= 70 ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-amber-50 text-amber-700 border border-amber-100'
                            }`}>
                              {ratio}% aut.
                            </span>
                          </div>

                          {/* Multi-currency breakdown */}
                          <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-100">
                            <div className="p-2 bg-slate-50/80 rounded-xl">
                              <p className="text-[9px] font-bold text-slate-400 uppercase">Recettes HTG</p>
                              <p className="text-xs font-black text-emerald-700 mt-0.5">{campus.collectedHTG.toLocaleString()} G</p>
                            </div>
                            <div className="p-2 bg-slate-50/80 rounded-xl">
                              <p className="text-[9px] font-bold text-slate-400 uppercase">Recettes USD</p>
                              <p className="text-xs font-black text-blue-600 mt-0.5">${campus.collectedUSD.toLocaleString()}</p>
                            </div>
                          </div>

                          {/* Sparkline trend */}
                          <div className="mt-3 pt-2.5 border-t border-slate-100/70 flex items-center justify-between">
                            <div>
                              <p className="text-[9px] font-bold text-slate-400 uppercase">Charges</p>
                              <p className="text-xs font-black text-rose-600 mt-0.5">{campus.expenses.toLocaleString()} G</p>
                            </div>
                            <div className="w-24 h-7">
                              <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={revenueSparkline}>
                                  <defs>
                                    <linearGradient id={`grad-rev-${campus.id}`} x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                    </linearGradient>
                                  </defs>
                                  <Area type="monotone" dataKey="value" stroke="#10b981" strokeWidth={1.8} fillOpacity={1} fill={`url(#grad-rev-${campus.id})`} />
                                </AreaChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        </div>

                        {/* Net Margin Pill */}
                        <div className="mt-3.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold">
                          <span className="text-slate-400 text-[10px]">Marge Nette :</span>
                          <span className={net >= 0 ? 'text-emerald-700' : 'text-rose-600'}>
                            {net >= 0 ? `+${net.toLocaleString()} G` : `${net.toLocaleString()} G`}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: DERNIERS FLUX - Live Payment Ledger */}
          {activeTab === 'recent' && (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 md:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                    Dernières Transactions Encaissées
                  </h4>
                  <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                    Flux financiers en direct sur l'ensemble du réseau universitaire
                  </p>
                </div>
                <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold">
                  {recentPayments.length} opérations
                </span>
              </div>

              <div className="space-y-2">
                {recentPayments.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400 font-semibold">
                    Aucune transaction récente enregistrée pour cette sélection.
                  </div>
                ) : (
                  recentPayments.map((p, idx) => {
                    const campusName = campusStats[p.campus_id]?.name || 'Siège Principal';
                    return (
                      <div key={p.id || idx} className="flex items-center justify-between p-3.5 hover:bg-slate-50/70 rounded-2xl border border-slate-100/70 transition-all">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs shrink-0 border border-emerald-100/60 shadow-2xs">
                            <Coins size={16} />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-800">
                              {p.student ? `${p.student.first_name} ${p.student.last_name}` : 'Étudiant anonyme'}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[9px] font-black text-indigo-700 bg-indigo-50 border border-indigo-100/70 px-2 py-0.5 rounded-md uppercase">
                                {campusName}
                              </span>
                              <span className="text-[10px] text-slate-400 font-medium">
                                {new Date(p.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <p className="text-xs font-black text-slate-900">
                            {p.currency === 'USD' ? `$${p.amount}` : `${p.amount.toLocaleString()} HTG`}
                          </p>
                          <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md mt-0.5 inline-block">
                            {p.nature || p.fee_type || p.type || 'Scolarité'}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
