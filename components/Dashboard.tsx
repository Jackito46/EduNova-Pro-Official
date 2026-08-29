import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, Cell, PieChart, Pie, Legend
} from 'recharts';
import { 
  PenTool,
  BookOpen,
  TrendingUp, 
  Users, 
  CreditCard, 
  Search, 
  User, 
  ChevronRight, 
  Zap, 
  UserPlus, 
  Loader2,
  TrendingDown,
  Sparkles,
  RefreshCcw,
  ShieldCheck,
  School,
  Building2,
  ArrowUpRight,
  Activity,
  Receipt,
  ShoppingCart,
  Calendar,
  Clock,
  GraduationCap,
  Layers,
  Baby,
  Info,
  Coins,
  Wallet,
  BarChart3,
  Settings,
  UserCog,
  ClipboardCheck,
  MessageSquare,
  HandCoins,
  Mail,
  FileSignature,
  FileText,
  ShieldAlert,
  AlertTriangle,
  PackageX,
  PackageCheck,
  Download,
  ChevronDown,
  Check,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { UserProfile, UserRole } from '../types';
import { useSchool } from '../contexts/SchoolContext';
import { supabase, isValidUuid } from '../supabase';
import { geminiService } from '../services/geminiService';
import { RetryableError } from './RetryableError';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { formatStudentName } from '../utils/formatters';
import { SecretaryDashboardView } from './SecretaryDashboardView';
import { ModernDashboardSkeleton } from './SkeletonLoader';
import { AcademicSessionPill } from './AcademicSessionPill';
import Logo from './Logo';
import edunovaLogo from '../src/assets/images/edunova_logo2_exact_authentic_colors_1786352038404.jpg';

const Dashboard: React.FC<{ user: UserProfile }> = ({ user }) => {
  const navigate = useNavigate();
  const { terminology, currentCampusId, campuses, school, activeAcademicYear } = useSchool();
  const isPresencesEnabled = school?.global_settings?.modules?.presences ?? (school?.school_type !== 'UNIVERSITY' && school?.school_type !== 'PROFESSIONAL');
  const isDisciplineEnabled = school?.global_settings?.modules?.discipline ?? (school?.school_type !== 'UNIVERSITY' && school?.school_type !== 'PROFESSIONAL');

  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<string>('');
  
  const roleLabels: Record<string, string> = {
    'super_admin': 'Super Administrateur',
    'admin': 'Administrateur',
    'school_admin': 'Administrateur',
    'teacher': terminology.teacher,
    'student': terminology.student,
    'parent': 'Parent',
    'accountant': terminology.accountant,
    'staff': 'Personnel',
    'director': terminology.director,
    'secretary': terminology.secretary,
    'supervisor': terminology.supervisor,
    'librarian': 'Bibliothécaire'
  };

  const [globalSearch, setGlobalSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  
  const [stats, setStats] = useState({
    expected: 0,
    expectedHTG: 0,
    expectedUSD: 0,
    collected: 0,
    collectedHTG: 0,
    collectedUSD: 0,
    collectedTuition: 0,
    collectedTuitionHTG: 0,
    collectedTuitionUSD: 0,
    collectedSupplies: 0,
    collectedSuppliesHTG: 0,
    collectedSuppliesUSD: 0,
    collectedInscription: 0,
    collectedInscriptionHTG: 0,
    collectedInscriptionUSD: 0,
    collectedScolarite: 0,
    collectedScolariteHTG: 0,
    collectedScolariteUSD: 0,
    collectedDivers: 0,
    collectedDiversHTG: 0,
    collectedDiversUSD: 0,
    payroll: 0,
    expenses: 0,
    preInscriptions: 0,
    pendingValidation: 0,
    totalStudents: 0,
    totalClasses: 0,
    totalStaff: 0,
    todayEnrollments: 0,
    todayPaymentsCount: 0,
    todayTotalAmount: 0,
    todayTotalAmountHTG: 0,
    todayTotalAmountUSD: 0,
    economatPenetration: 0
  });

  const [payrollBreakdown, setPayrollBreakdown] = useState<any[]>([]);
  const [isPayrollModalOpen, setIsPayrollModalOpen] = useState(false);

  const [teacherStats, setTeacherStats] = useState({
    classesCount: 0,
    studentsCount: 0,
    todayHours: 0,
    assignments: [] as any[],
    syllabusSubjects: [] as any[],
    totalEvaluations: 0
  });

  const [studentStats, setStudentStats] = useState({
    className: '',
    attendanceRate: 0,
    averageGrade: 0,
    paymentsStatus: 'À jour' as 'À jour' | 'En retard' | 'Inconnu',
    globalDebt: 0,
    totalPaid: 0,
    totalDue: 0,
    admissionExpected: 0,
    admissionPaid: 0,
    admissionBalance: 0,
    tuitionExpected: 0,
    tuitionPaid: 0,
    tuitionBalance: 0,
    campaignsExpected: 0,
    campaignsPaid: 0,
    campaignsBalance: 0,
    discountAmount: 0,
    hasCampaigns: false,
    wallet_balance_htg: 0,
    wallet_balance_usd: 0
  });

  const [parentStats, setParentStats] = useState({
    childrenCount: 0,
    totalPaid: 0,
    totalDue: 0,
    children: [] as any[]
  });

  const [lowStockItems, setLowStockItems] = useState<any[]>([]);
  const [dismissStockAlert, setDismissStockAlert] = useState(false);

  const [chartData, setChartData] = useState<any[]>([]);
  const [classChartData, setClassChartData] = useState<any[]>([]);
  const [fullClassRevenue, setFullClassRevenue] = useState<any[]>([]);
  const [showRevenueModal, setShowRevenueModal] = useState(false);
  const [chartViewMode, setChartViewMode] = useState<'donut' | 'bar'>('donut');
  const [activePieIndex, setActivePieIndex] = useState<number | null>(null);
  const [revenueSortType, setRevenueSortType] = useState<'amount' | 'name'>('amount');
  const [revenueSearch, setRevenueSearch] = useState('');

  const processedChartData = useMemo(() => {
    let data = [...classChartData];
    
    // Search filter
    if (revenueSearch.trim()) {
      data = data.filter(item => 
        item.name.toLowerCase().includes(revenueSearch.toLowerCase())
      );
    }
    
    // Sorting
    if (revenueSortType === 'name') {
      data.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      data.sort((a, b) => b.montant - a.montant);
    }
    
    return data;
  }, [classChartData, revenueSearch, revenueSortType]);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [studentAiGreeting, setStudentAiGreeting] = useState<string | null>(null);
  const [teacherAiGreeting, setTeacherAiGreeting] = useState<string | null>(null);
  const [directorAiGreeting, setDirectorAiGreeting] = useState<string | null>(null);

  const [directorStats, setDirectorStats] = useState({
    presentStaff: 0,
    absentStaff: 0,
    lateStaff: 0,
    recentPayments: [] as any[]
  });

  const { isOnline } = useOnlineStatus();
  const [error, setError] = useState<string | null>(null);

  const [sidebarMode, setSidebarMode] = useState<'expanded' | 'collapsed' | 'hover'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('sidebarMode') as any) || 'expanded';
    }
    return 'expanded';
  });
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);

  useEffect(() => {
    const handleSidebarChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent && customEvent.detail) {
        setSidebarMode(customEvent.detail);
      }
    };
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
      const currentMode = localStorage.getItem('sidebarMode') as any;
      if (currentMode) setSidebarMode(currentMode);
    };
    window.addEventListener('sidebarModeChanged', handleSidebarChange as any);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('sidebarModeChanged', handleSidebarChange as any);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const isExpandedSidebar = sidebarMode === 'expanded';
  const availableWidth = isExpandedSidebar ? (windowWidth - 300) : (windowWidth - 80);
  const hasLargeSpace = availableWidth >= 1100 || windowWidth < 640;

  const [hideSecurityBanner, setHideSecurityBanner] = useState(() => {
    try {
      return sessionStorage.getItem('edunova_hide_security_banner') === 'true';
    } catch (e) {
      return false;
    }
  });

  const isSensitiveRole = [UserRole.SUPER_ADMIN, UserRole.DIRECTOR, UserRole.ACCOUNTANT, UserRole.SCHOOL_ADMIN].includes(user.role) || user.is_super_admin;
  const showSecurityBanner = false; // isSensitiveRole && !hideSecurityBanner; // Disabled for now until production

  const handleCloseSecurityBanner = () => {
    setHideSecurityBanner(true);
    try {
      sessionStorage.setItem('edunova_hide_security_banner', 'true');
    } catch (e) {}
  };

  const handleSearch = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const { data, error } = await supabase.rpc('search_students_accent_insensitive', {
        p_school_id: user.school_id,
        p_query: query,
        p_limit: 15,
        p_campus_id: user.campus_id || currentCampusId || null
      });

      if (error) throw error;

      const mappedData = data?.map((s: any) => ({
        ...s,
        class: s.class_name ? { name: s.class_name } : null
      }));
      
      setSearchResults(mappedData || []);
    } catch (err) {
      console.error("Erreur moteur recherche:", err);
    } finally {
      setIsSearching(false);
    }
  }, [user.school_id, user.campus_id, currentCampusId]);

  useEffect(() => {
    const timer = setTimeout(() => handleSearch(globalSearch), 300);
    return () => clearTimeout(timer);
  }, [globalSearch, handleSearch]);

  const fetchDashboardStats = useCallback(async () => {
    if (!user.school_id) {
      setLoading(false);
      return;
    }

    const cacheKey = `edunova_dash_cache_${user.school_id}_${selectedYearId || 'default'}_${currentCampusId || 'all'}_${user.role}`;
    let hasLoadedFromCache = false;

    // Check fast cache first to render UI instantly (<50ms)
    try {
      const cachedStr = sessionStorage.getItem(cacheKey);
      if (cachedStr) {
        const parsed = JSON.parse(cachedStr);
        if (parsed && parsed.stats && (Date.now() - (parsed.timestamp || 0) < 180000)) { // 3 min cache
          setStats(parsed.stats);
          if (parsed.directorStats) setDirectorStats(parsed.directorStats);
          if (parsed.chartData) setChartData(parsed.chartData);
          if (parsed.classChartData) setClassChartData(parsed.classChartData);
          setLoading(false);
          hasLoadedFromCache = true;
        }
      }
    } catch (e) {}

    if (!hasLoadedFromCache) {
      setLoading(true);
    }
    setError(null);
    try {
      // Étape 1 : Récupérer l'année active en premier (indispensable pour filtrer le reste)
      const { data: allYears, error: yearsError } = await supabase
        .from('academic_years')
        .select('*')
        .eq('school_id', user.school_id)
        .order('label', { ascending: false });

      if (yearsError) throw yearsError;

      if (allYears) {
        setAcademicYears(allYears);
      }

      const activeYear = allYears?.find(y => y.id === selectedYearId) || 
                         (activeAcademicYear && allYears?.find(y => y.id === activeAcademicYear.id)) ||
                         allYears?.find(y => y.is_active || y.status === 'ACTIVE') || 
                         allYears?.[0];

      if (!activeYear) {
        setLoading(false);
        return;
      }

      if (selectedYearId !== activeYear.id) {
        setSelectedYearId(activeYear.id);
      }

      setSchoolInfo(prev => ({ ...prev, activeYearName: activeYear.label }));

      // Étape 2 : Lancement PARALLÈLE des requêtes de données massives
      let studentsQuery = supabase.from('students').select('*').eq('school_id', user.school_id);
      let paymentsQuery = supabase.from('payments').select('*').eq('school_id', user.school_id).eq('academic_year_id', activeYear.id);
      let staffQuery = supabase.from('staff').select('*').eq('school_id', user.school_id);
      let expensesQuery = supabase.from('expenses').select('*').eq('school_id', user.school_id).eq('academic_year_id', activeYear.id);
      let classesQuery = supabase.from('classes').select('id', { count: 'exact', head: true }).eq('school_id', user.school_id);
      let assignmentsQuery = supabase.from('staff_assignments').select('staff_id, duration_hours, hourly_rate').eq('school_id', user.school_id).eq('academic_year_id', activeYear.id);

      let suppliesQuery = supabase.from('school_supplies').select('*').eq('school_id', user.school_id).eq('academic_year_id', activeYear.id);
      let enrollmentsQuery = supabase.from('enrollments').select('student_id, academic_year_id, class_id').eq('school_id', user.school_id);
      let catalogQuery = supabase.from('supply_catalog').select('*').eq('school_id', user.school_id);
      
      const activeCampusId = user.campus_id || currentCampusId;
      if (activeCampusId && isValidUuid(activeCampusId)) {
        studentsQuery = studentsQuery.eq('campus_id', activeCampusId);
        paymentsQuery = paymentsQuery.eq('campus_id', activeCampusId);
        staffQuery = staffQuery.eq('campus_id', activeCampusId);
        expensesQuery = expensesQuery.eq('campus_id', activeCampusId);
        classesQuery = classesQuery.eq('campus_id', activeCampusId);
        suppliesQuery = suppliesQuery.eq('campus_id', activeCampusId);
        // Note: enrollments table doesn't have campus_id, but fee plans don't either.
        // We will just filter enrollments by checking if the student belongs to the campus later, or assume it's fine since activeStudents is filtered.
      }

      let [studentsRes, plansRes, paymentsRes, suppliesRes, staffRes, expensesRes, classesRes, enrollmentsRes, rateRes, assignmentsRes, catalogRes] = await Promise.all([
        studentsQuery,
        supabase.from('fee_plans').select('*').eq('school_id', user.school_id).eq('academic_year_id', activeYear.id),
        paymentsQuery,
        suppliesQuery,
        staffQuery,
        expensesQuery,
        classesQuery,
        enrollmentsQuery,
        supabase.from('exchange_rates').select('*').eq('school_id', user.school_id).order('effective_date', { ascending: false }).limit(1),
        assignmentsQuery,
        catalogQuery
      ]);

      // Detect low stock or out-of-stock items in supply catalog
      const catalogItems = catalogRes.data || [];
      const criticalLowStock = catalogItems.filter((item: any) => {
        const qty = Number(item.stock_quantity ?? 0);
        const threshold = Number(item.low_stock_threshold ?? 5);
        return qty <= threshold;
      });
      setLowStockItems(criticalLowStock);
      
      let fetchedPayments = paymentsRes.data || [];
      if (paymentsRes.error) {
        console.warn("Moteur de secours pour les paiements du tableau de bord:", paymentsRes.error);
        const fallbackPayments = await supabase.from('payments').select('*').eq('school_id', user.school_id);
        if (fallbackPayments.data) {
          fetchedPayments = fallbackPayments.data.filter(p => !p.academic_year_id || p.academic_year_id === activeYear.id);
        }
      }

      let fetchedPlans = plansRes.data || [];
      if (plansRes.error) {
        console.warn("Moteur de secours pour les plans de frais du tableau de bord:", plansRes.error);
        const fallbackPlans = await supabase.from('fee_plans').select('*').eq('school_id', user.school_id);
        if (fallbackPlans.data) {
          fetchedPlans = fallbackPlans.data.filter(p => !p.academic_year_id || p.academic_year_id === activeYear.id);
        }
      }

      const currentExchangeRate = rateRes.data?.[0]?.rate_usd_to_htg || rateRes.data?.[0]?.rate || 132.50;

      // Group enrollments by student to identify returning students
      const studentEnrollments = new Map<string, string[]>();
      enrollmentsRes.data?.forEach(e => {
        const list = studentEnrollments.get(e.student_id) || [];
        list.push(e.academic_year_id);
        studentEnrollments.set(e.student_id, list);
      });

      let preInscriptionsCount = 0;
      const futureYear = allYears?.find(y => y.status === 'FUTURE');
      if (futureYear && enrollmentsRes.data && studentsRes.data) {
        const campusStudentIds = new Set(studentsRes.data.map(s => s.id));
        const futureEnrollments = enrollmentsRes.data.filter(e => e.academic_year_id === futureYear.id && campusStudentIds.has(e.student_id));
        preInscriptionsCount = futureEnrollments.length;
      }

      // Count students awaiting admission validation
      const pendingValidationCount = (studentsRes.data || []).filter((s: any) => 
        ['PENDING_VALIDATION', 'En attente', 'EN_ATTENTE', 'PENDING', 'En Attente', 'En attente validation'].includes(s.status)
      ).length;

      // Étape 3 : Calculs optimisés (Utilisation de Map pour O(1) lookup)
      const plansMap = new Map();
      fetchedPlans.forEach(p => plansMap.set(p.class_id, p));

      // ONLY include students who have an enrollment for the active year
      const activeYearEnrollments = enrollmentsRes.data?.filter(e => e.academic_year_id === activeYear.id) || [];
      const studentActiveClassMap = new Map();
      activeYearEnrollments.forEach(e => studentActiveClassMap.set(e.student_id, e.class_id));
      
      const activeStudentIds = new Set(activeYearEnrollments.map(e => e.student_id));
      const activeStudents = studentsRes.data?.filter(s => activeStudentIds.has(s.id)) || [];

      let totalExpected = 0;
      let totalExpectedHTG = 0;
      let totalExpectedUSD = 0;
      activeStudents.forEach(s => {
        const studentClassId = studentActiveClassMap.get(s.id) || s.class_id;
        const plan = plansMap.get(studentClassId);
        if (plan) {
          // Check if student is returning (has enrollments in years other than activeYear)
          const enrollments = studentEnrollments.get(s.id) || [];
          const isReturning = enrollments.some(yearId => yearId !== activeYear.id);
          
          const inscriptionHTG = Number(plan.inscription_fee || 0);
          const inscriptionUSD_raw = Number(plan.inscription_fee_usd || 0);
          const inscriptionUSD = inscriptionUSD_raw * currentExchangeRate;
          
          const reenrollmentHTG = Number(plan.reenrollment_fee || 0);
          const reenrollmentUSD_raw = Number(plan.reenrollment_fee_usd || 0);
          const reenrollmentUSD = reenrollmentUSD_raw * currentExchangeRate;
          
          const tuitionHTG = Number(plan.tuition_fee || 0);
          const tuitionUSD_raw = Number(plan.tuition_fee_usd || 0);
          const tuitionUSD = tuitionUSD_raw * currentExchangeRate;

          const applicableFeeHTG = isReturning ? reenrollmentHTG : inscriptionHTG;
          const applicableFeeUSD_raw = isReturning ? reenrollmentUSD_raw : inscriptionUSD_raw;
          const applicableFeeUSD = isReturning ? reenrollmentUSD : inscriptionUSD;
          
          const baseAmount = applicableFeeHTG + applicableFeeUSD + tuitionHTG + tuitionUSD;
          const baseHTG = applicableFeeHTG + tuitionHTG;
          const baseUSD_raw = applicableFeeUSD_raw + tuitionUSD_raw;
          
          const miscHTG = plan.is_misc_mandatory ? Number(plan.misc_fee_htg || 0) : 0;
          const miscUSD_raw = plan.is_misc_mandatory ? Number(plan.misc_fee_usd || 0) : 0;
          const miscUSD = miscUSD_raw * currentExchangeRate;
          const miscAmount = miscHTG + miscUSD;
          
          const expectedGross = baseAmount + miscAmount;
          const expectedGrossHTG = baseHTG + miscHTG;
          const expectedGrossUSD = baseUSD_raw + miscUSD_raw;
          
          const discount = Number(s.discount_amount || 0);
          const discountLabel = (s.discount_label || '').toLowerCase();
          
          let studentReductionsHTG = 0;
          let studentReductionsUSD = 0;

          if (discount > 0) {
            const isCompleteScholarship = Boolean(
              discountLabel && (
                discountLabel.includes('complète') ||
                discountLabel.includes('complete') ||
                discountLabel.includes('sociale') ||
                discountLabel.includes('frais divers')
              )
            );

            const eligibleHTG = isCompleteScholarship ? (tuitionHTG + miscHTG) : tuitionHTG;
            const eligibleUSD_raw = isCompleteScholarship ? (tuitionUSD_raw + miscUSD_raw) : tuitionUSD_raw;

            const matchPct = discountLabel.match(/(\d+)\s*%/);
            let pct: number | null = null;
            if (matchPct) {
              pct = parseFloat(matchPct[1]);
            } else if (discountLabel.includes('excellence') || discountLabel.includes('intégrale') || discountLabel.includes('totale')) {
              pct = 100;
            } else if (discountLabel.includes('demi') || discountLabel.includes('collaborateur')) {
              pct = 50;
            }

            if (pct !== null && pct > 0) {
              const ratio = Math.min(100, Math.max(0, pct)) / 100;
              studentReductionsHTG = eligibleHTG * ratio;
              studentReductionsUSD = eligibleUSD_raw * ratio;
            } else {
              studentReductionsHTG = Math.min(eligibleHTG, discount);
              const overflowHTG = Math.max(0, discount - studentReductionsHTG);
              if (overflowHTG > 0 && currentExchangeRate > 0) {
                studentReductionsUSD = Math.min(eligibleUSD_raw, overflowHTG / currentExchangeRate);
              }
            }
          }

          const studentReductTotalHTG = studentReductionsHTG + (studentReductionsUSD * currentExchangeRate);
          let finalHTG = Math.max(0, expectedGrossHTG - studentReductionsHTG);
          let finalUSD = Math.max(0, expectedGrossUSD - studentReductionsUSD);
          
          totalExpected += Math.max(0, expectedGross - studentReductTotalHTG);
          totalExpectedHTG += finalHTG;
          totalExpectedUSD += finalUSD;
        }
      });

      const validPayments = fetchedPayments.filter(p => 
        p.status !== 'ANNULE' && 
        !p.payment_method?.includes('EN ATTENTE') && 
        !p.payment_method?.includes('REJETÉ') &&
        p.moncash_status !== 'PENDING'
      );

      const validSupplies = suppliesRes.data?.filter(s => 
        s.status !== 'ANNULE' && 
        !s.payment_method?.includes('EN ATTENTE') && 
        !s.payment_method?.includes('REJETÉ')
      ) || [];

      const collectedTuitionHTG = validPayments.filter(p => !p.currency || p.currency === 'HTG').reduce((acc, p) => acc + Number(p.amount || 0), 0);
      const collectedTuitionUSD = validPayments.filter(p => p.currency === 'USD').reduce((acc, p) => acc + Number(p.amount || 0), 0);
      
      // Group valid payments by student_id to run student-level breakdown
      const paymentsByStudent = new Map<string, any[]>();
      validPayments.forEach(p => {
        if (!p.student_id) return;
        const list = paymentsByStudent.get(p.student_id) || [];
        list.push(p);
        paymentsByStudent.set(p.student_id, list);
      });

      let collectedInscription = 0;
      let collectedInscriptionHTG = 0;
      let collectedInscriptionUSD = 0;
      let collectedScolarite = 0;
      let collectedScolariteHTG = 0;
      let collectedScolariteUSD = 0;
      let collectedDivers = 0;
      let collectedDiversHTG = 0;
      let collectedDiversUSD = 0;

      // Map and sum valid payments directly based on their declared natures & types
      validPayments.forEach(p => {
        const pCurrency = p.currency || 'HTG';
        const rawAmt = Number(p.amount || 0);
        let amt = Number(p.amount_htg_equivalent);
        if (!amt || isNaN(amt)) {
          amt = rawAmt;
          if (pCurrency === 'USD') {
            amt = amt * currentExchangeRate;
          }
        }
        
        const isInscription = p.fee_type === 'INSCRIPTION' || 
                              p.nature === 'INSCRIPTION' || 
                              p.nature === 'Inscription' || 
                              p.nature?.toLowerCase().includes("inscription") ||
                              p.nature === "Frais d'inscription";
                              
        const isDivers = p.fee_type === 'DIVERS' || 
                         p.nature === 'DIVERS' || 
                         p.nature === 'Divers' || 
                         p.nature?.toLowerCase().includes("divers") ||
                         p.nature === "Frais Divers" || 
                         p.nature === "Fournitures";

        if (isInscription) {
          collectedInscription += amt;
          if (pCurrency === 'HTG') collectedInscriptionHTG += rawAmt;
          if (pCurrency === 'USD') collectedInscriptionUSD += rawAmt;
        } else if (isDivers) {
          collectedDivers += amt;
          if (pCurrency === 'HTG') collectedDiversHTG += rawAmt;
          if (pCurrency === 'USD') collectedDiversUSD += rawAmt;
        } else {
          collectedScolarite += amt;
          if (pCurrency === 'HTG') collectedScolariteHTG += rawAmt;
          if (pCurrency === 'USD') collectedScolariteUSD += rawAmt;
        }
      });
      
      const collectedSupplies = validSupplies.reduce((acc, s) => {
        let amt = Number(s.amount_htg_equivalent || s.total_amount || 0);
        if (!s.amount_htg_equivalent && s.currency === 'USD') amt *= currentExchangeRate;
        return acc + amt;
      }, 0);
      const collectedSuppliesHTG = validSupplies.filter(s => !s.currency || s.currency === 'HTG').reduce((acc, s) => acc + Number(s.total_amount || 0), 0);
      const collectedSuppliesUSD = validSupplies.filter(s => s.currency === 'USD').reduce((acc, s) => acc + Number(s.total_amount || 0), 0);
      
      const collectedTuition = validPayments.reduce((acc, p) => {
         let amt = Number(p.amount_htg_equivalent);
         if (!amt || isNaN(amt)) {
           amt = Number(p.amount || 0);
           if (p.currency === 'USD') amt *= currentExchangeRate;
         }
         return acc + amt;
      }, 0);

      const totalCollected = collectedTuition + collectedSupplies;
      const collectedHTG = collectedTuitionHTG + collectedSuppliesHTG;
      const collectedUSD = collectedTuitionUSD + collectedSuppliesUSD;
      const totalExpenses = expensesRes.data?.reduce((acc, e) => acc + Number(e.amount_htg_equivalent || e.amount || 0), 0) || 0;
      
      const breakdownDetails: any[] = [];
      const totalPayroll = staffRes.data?.reduce((acc, s) => {
        // Enforce status checking - only active staff members
        if (s.status && s.status !== 'Actif') return acc;

        const isTeacher = s.role?.toLowerCase().includes('prof') || s.role?.toLowerCase().includes('enseignant') || s.role?.toLowerCase().includes('teacher');
        const memberAssignments = assignmentsRes.data?.filter((a: any) => a.staff_id === s.id) || [];
        
        // Dynamic reintegration check: if a teacher has no assignments for this year, they are excluded from the projection
        if (isTeacher && memberAssignments.length === 0) {
          return acc;
        }

        const val = Number(s.amount) || 0;
        const fixedSalary = s.pay_type === 'Fixe' ? val : 0; // Seuls les 'Fixe' ont un salaire de base mensuel
        
        const teachingSalary = memberAssignments.reduce((sum: number, a: any) => {
          const rate = Number(a.hourly_rate) || (s.pay_type === 'Horaire' ? (Number(s.amount) || 0) : 0);
          return sum + (Number(a.duration_hours || 0) * rate * 4);
        }, 0);
        
        const total = fixedSalary + teachingSalary;
        if (total > 0) {
          breakdownDetails.push({
            id: s.id,
            name: `${s.first_name || ''} ${s.last_name || ''}`.trim(),
            role: s.role || 'Personnel',
            pay_type: s.pay_type,
            baseSalary: fixedSalary,
            teachingSalary: teachingSalary,
            assignmentsCount: memberAssignments.length,
            total: total
          });
        }
        
        return acc + fixedSalary + teachingSalary;
      }, 0) || 0;

      setPayrollBreakdown(breakdownDetails);

      const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
      const todayEnrollments = studentsRes.data?.filter(s => s.created_at?.startsWith(todayStr) || new Date(s.created_at).toLocaleDateString('en-CA') === todayStr).length || 0;
      
      const todayPayments = validPayments.filter(p => p.created_at?.startsWith(todayStr) || new Date(p.created_at).toLocaleDateString('en-CA') === todayStr);
      const todaySupplies = validSupplies.filter(s => s.created_at?.startsWith(todayStr) || new Date(s.created_at).toLocaleDateString('en-CA') === todayStr);
      
      const uniqueSupplyTransactionsToday = new Set(todaySupplies.map(s => s.transaction_id || s.id));
      const todayPaymentsCount = todayPayments.length + uniqueSupplyTransactionsToday.size;
      
      const todayTotalAmount = todayPayments.reduce((acc, p) => {
                                 let amt = Number(p.amount_htg_equivalent);
                                 if (!amt || isNaN(amt)) {
                                   amt = Number(p.amount || 0);
                                   if (p.currency === 'USD') amt *= currentExchangeRate;
                                 }
                                 return acc + amt;
                               }, 0) +
                               todaySupplies.reduce((acc, s) => {
                                 let amt = Number(s.amount_htg_equivalent);
                                 if (!amt || isNaN(amt)) {
                                   amt = Number(s.total_amount || 0);
                                   if (s.currency === 'USD') amt *= currentExchangeRate;
                                 }
                                 return acc + amt;
                               }, 0);
      const todayTotalAmountHTG = todayPayments.filter(p => !p.currency || p.currency === 'HTG').reduce((acc, p) => acc + Number(p.amount || 0), 0) +
                                  todaySupplies.filter(s => !s.currency || s.currency === 'HTG').reduce((acc, s) => acc + Number(s.total_amount || 0), 0);
      const todayTotalAmountUSD = todayPayments.filter(p => p.currency === 'USD').reduce((acc, p) => acc + Number(p.amount || 0), 0) +
                                  todaySupplies.filter(s => s.currency === 'USD').reduce((acc, s) => acc + Number(s.total_amount || 0), 0);

      const uniqueBuyers = new Set(validSupplies.map(s => s.student_id).filter(Boolean));
      const economatPenetration = activeStudents.length > 0 ? (uniqueBuyers.size / activeStudents.length) * 100 : 0;

      setStats({
        expected: totalExpected,
        expectedHTG: totalExpectedHTG,
        expectedUSD: totalExpectedUSD,
        collected: totalCollected,
        collectedHTG,
        collectedUSD,
        collectedTuition,
        collectedTuitionHTG,
        collectedTuitionUSD,
        collectedSupplies,
        collectedSuppliesHTG,
        collectedSuppliesUSD,
        collectedInscription,
        collectedInscriptionHTG,
        collectedInscriptionUSD,
        collectedScolarite,
        collectedScolariteHTG,
        collectedScolariteUSD,
        collectedDivers,
        collectedDiversHTG,
        collectedDiversUSD,
        payroll: totalPayroll,
        expenses: totalExpenses,
        preInscriptions: preInscriptionsCount,
        pendingValidation: pendingValidationCount,
        totalStudents: studentsRes.data?.length || 0,
        totalClasses: classesRes.count || 0,
        totalStaff: staffRes.data?.length || 0,
        todayEnrollments,
        todayPaymentsCount,
        todayTotalAmount,
        todayTotalAmountHTG,
        todayTotalAmountUSD,
        economatPenetration
      });

      // Role-specific data fetching
      if (user.role === UserRole.TEACHER) {
        const { data: staffData } = await supabase
          .from('staff')
          .select('id')
          .eq('email', user.email)
          .maybeSingle();

        if (staffData) {
          const { data: assignments } = await supabase
            .from('staff_assignments')
            .select('*')
            .eq('staff_id', staffData.id)
            .eq('school_id', user.school_id);

          const uniqueClasses = Array.from(new Set(assignments?.map(a => a.class_name) || []));
          
          // Fetch student count for these classes
          let totalStudentsForTeacher = 0;
          if (uniqueClasses.length > 0) {
            const { data: classData } = await supabase
              .from('classes')
              .select('id')
              .in('name', uniqueClasses)
              .eq('school_id', user.school_id);
            
            if (classData && classData.length > 0) {
              const { count } = await supabase
                .from('students')
                .select('*', { count: 'exact', head: true })
                .in('class_id', classData.map(c => c.id));
              totalStudentsForTeacher = count || 0;
            }
          }

          let syllabusSubjects: any[] = [];
          let totalEvaluations = 0;
          if (activeYear) {
            const { data: evals } = await supabase
              .from('course_evaluations')
              .select('id, subject_id, class_id, weight_percentage')
              .eq('teacher_id', staffData.id)
              .eq('academic_year_id', activeYear.id);
            
            if (evals && assignments) {
              totalEvaluations = evals.length;
              const subjectsMap = new Map();
              
              assignments.forEach(a => {
                if (a.subject_id && a.class_id) {
                  const key = `${a.subject_id}-${a.class_id}`;
                  if (!subjectsMap.has(key)) {
                     subjectsMap.set(key, {
                       id: key,
                       subjectName: a.subject_name,
                       className: a.class_name,
                       evaluationsCount: 0,
                       totalWeight: 0
                     });
                  }
                }
              });

              evals.forEach(e => {
                if (e.subject_id && e.class_id) {
                  const key = `${e.subject_id}-${e.class_id}`;
                  if (subjectsMap.has(key)) {
                    const subject = subjectsMap.get(key);
                    subject.evaluationsCount += 1;
                    subject.totalWeight += (Number(e.weight_percentage) || 0);
                  }
                }
              });
              
              syllabusSubjects = Array.from(subjectsMap.values());
            }
          }

          const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
          const currentDay = days[new Date().getDay()];
          
          setTeacherStats({
            classesCount: uniqueClasses.length,
            studentsCount: totalStudentsForTeacher,
            todayHours: assignments?.filter(a => a.day_of_week === currentDay).reduce((acc, a) => acc + Number(a.duration_hours), 0) || 0,
            assignments: assignments || [],
            syllabusSubjects,
            totalEvaluations
          });
        }
      } else if (user.role === UserRole.STUDENT) {
        // Try to find student by parent_email or full name
        const firstName = user.full_name?.split(' ')[0] || '';
        const lastName = user.full_name?.split(' ').slice(1).join(' ') || '';
        const filterQuery = (firstName && lastName) 
          ? `parent_email.eq."${user.email}",and(first_name.ilike."${firstName}%",last_name.ilike."%${lastName}%")`
          : `parent_email.eq."${user.email}"`;

        const { data: studentData } = await supabase
          .from('students')
          .select('*, class:classes(id, name)')
          .or(filterQuery)
          .maybeSingle();

        if (studentData) {
          // Fetch grades for average
          const { data: grades } = await supabase
            .from('grades')
            .select('score')
            .eq('student_id', studentData.id)
            .eq('academic_year_id', activeYear.id);
          
          const avg = grades && grades.length > 0 
            ? grades.reduce((acc, g) => acc + Number(g.score), 0) / grades.length 
            : 0;

          // Fetch fee plan for the class
          const { data: planData } = await supabase
            .from('fee_plans')
            .select('*')
            .eq('class_id', studentData.class_id)
            .eq('academic_year_id', activeYear.id)
            .maybeSingle();

          // Fetch assigned ad-hoc campaigns
          const { data: campaignFees } = await supabase
            .from('student_ad_hoc_fees')
            .select(`
              id,
              custom_amount,
              campaign:ad_hoc_campaigns!campaign_id(id, name, amount, currency, status, academic_year_id)
            `)
            .eq('student_id', studentData.id);

          // Filter campaigns belonging to active academic year
          const activeCampaignFees = campaignFees?.filter((f: any) => f.campaign && f.campaign.academic_year_id === activeYear.id) || [];
          const campaignsExpected = activeCampaignFees.reduce((sum: number, fee: any) => {
            const reqAmt = fee.custom_amount !== null && fee.custom_amount !== undefined ? Number(fee.custom_amount) : Number(fee.campaign.amount || 0);
            return sum + reqAmt;
          }, 0);

          // Fetch payments in active academic year
          const { data: activeYearPayments } = await supabase
            .from('payments')
            .select('amount_htg_equivalent, amount, ad_hoc_campaign_id, currency, exchange_rate_applied, fee_type, nature, type, description')
            .eq('student_id', studentData.id)
            .eq('academic_year_id', activeYear.id)
            .neq('status', 'ANNULE')
            .not('payment_method', 'ilike', '%EN ATTENTE%')
            .not('payment_method', 'ilike', '%REJETÉ%');

          const activePayments = activeYearPayments || [];
          
          const isAdmissionPayment = (p: any) => {
            const feeType = (p.fee_type || '').toLowerCase();
            const nature = (p.nature || '').toLowerCase();
            const type = (p.type || '').toLowerCase();
            const desc = (p.description || '').toLowerCase();
            return (
              feeType.includes('inscri') ||
              feeType.includes('admiss') ||
              feeType.includes('reinscri') ||
              feeType.includes('réinscri') ||
              nature.includes('inscri') ||
              nature.includes('admiss') ||
              nature.includes('reinscri') ||
              nature.includes('réinscri') ||
              nature.includes('entree') ||
              nature.includes('entrée') ||
              type.includes('inscri') ||
              type.includes('admiss') ||
              type.includes('reinscri') ||
              type.includes('réinscri') ||
              type.includes('entree') ||
              type.includes('entrée') ||
              desc.includes('inscri') ||
              desc.includes('admiss') ||
              desc.includes('reinscri') ||
              desc.includes('réinscri') ||
              Number(p.amount) === 3375 ||
              Number(p.amount_htg_equivalent) === 3375
            );
          };

          // Separate payments into three distinct categories
          const admissionPayments = activePayments.filter((p: any) => !p.ad_hoc_campaign_id && isAdmissionPayment(p));
          const campaignPayments = activePayments.filter((p: any) => !!p.ad_hoc_campaign_id);
          const tuitionPayments = activePayments.filter((p: any) => !p.ad_hoc_campaign_id && !isAdmissionPayment(p));

          const admissionPaid = admissionPayments.reduce((acc, p) => acc + Number(p.currency === 'USD' ? p.amount * currentExchangeRate : (p.amount_htg_equivalent || p.amount || 0)), 0);
          const campaignsPaid = campaignPayments.reduce((acc, p) => acc + Number(p.currency === 'USD' ? p.amount * currentExchangeRate : (p.amount_htg_equivalent || p.amount || 0)), 0);
          const tuitionPaid = tuitionPayments.reduce((acc, p) => acc + Number(p.currency === 'USD' ? p.amount * currentExchangeRate : (p.amount_htg_equivalent || p.amount || 0)), 0);

          // Determine if returning to calculate registration fee
          const { data: enrollmentsData } = await supabase
            .from('enrollments')
            .select('academic_year_id')
            .eq('student_id', studentData.id);
          const hasPriorEnrollments = enrollmentsData?.some((e: any) => e.academic_year_id !== activeYear.id) || false;
          
          const registrationExpected = hasPriorEnrollments 
            ? Number(planData?.reenrollment_fee || 3375) 
            : Number(planData?.inscription_fee || 3375);

          const admissionExpected = registrationExpected;
          
          // Tuition expected (re-evaluable and default 85000)
          const baseFee = planData?.tuition_fee || 85000;
          const applicableFee = studentData.is_foreign && planData?.foreign_tuition_fee ? planData.foreign_tuition_fee : baseFee;
          
          // Fetch misc fee
          const miscHTG = planData?.is_misc_mandatory ? Number(planData.misc_fee_htg || 0) : 0;
          const miscUSD = planData?.is_misc_mandatory ? Number(planData.misc_fee_usd || 0) : 0;
          const planMiscFee = miscHTG + (miscUSD * currentExchangeRate);

          let remainingDiscount = Number(studentData.discount_amount || 0);

          const unpaidTuitionNeeded = Math.max(0, applicableFee - tuitionPaid);
          const tuitionDiscountApplied = Math.min(unpaidTuitionNeeded, remainingDiscount);
          const tuitionExpected = applicableFee - tuitionDiscountApplied;
          remainingDiscount -= tuitionDiscountApplied;

          const unpaidAdmissionNeeded = Math.max(0, admissionExpected - admissionPaid);
          const admissionDiscountApplied = Math.min(unpaidAdmissionNeeded, remainingDiscount);
          const adjAdmissionExpected = admissionExpected - admissionDiscountApplied;
          remainingDiscount -= admissionDiscountApplied;

          const unpaidMiscNeeded = planMiscFee;
          const miscDiscountApplied = Math.min(unpaidMiscNeeded, remainingDiscount);
          const adjPlanMiscFee = planMiscFee - miscDiscountApplied;
          remainingDiscount -= miscDiscountApplied;

          const unpaidCampaignsNeeded = Math.max(0, campaignsExpected - campaignsPaid);
          const campaignsDiscountApplied = Math.min(unpaidCampaignsNeeded, remainingDiscount);
          const adjCampaignsExpected = campaignsExpected - campaignsDiscountApplied;
          remainingDiscount -= campaignsDiscountApplied;

          // Misc paid isn't strictly separated in Dashboard currently, so we combine tuition and misc
          const admissionBalance = Math.max(adjAdmissionExpected - admissionPaid, 0);
          const tuitionBalance = Math.max((tuitionExpected + adjPlanMiscFee) - tuitionPaid, 0); // tuitionPaid in dashboard includes misc
          const campaignsBalance = Math.max(adjCampaignsExpected - campaignsPaid, 0);

          const totalPaid = admissionPaid + tuitionPaid + campaignsPaid;
          const totalExpected = adjAdmissionExpected + tuitionExpected + adjPlanMiscFee + adjCampaignsExpected;
          const totalBalance = totalExpected - totalPaid;

          const globalDebt = totalBalance;

          setStudentStats({
            className: studentData.class?.name || 'Non assigné',
            attendanceRate: 85,
            averageGrade: Number(avg.toFixed(2)),
            paymentsStatus: globalDebt > 0 ? 'En retard' : 'À jour',
            globalDebt,
            totalPaid,
            totalDue: totalExpected,
            admissionExpected: adjAdmissionExpected,
            admissionPaid,
            admissionBalance,
            tuitionExpected: tuitionExpected + adjPlanMiscFee,
            tuitionPaid,
            tuitionBalance,
            campaignsExpected: adjCampaignsExpected,
            campaignsPaid,
            campaignsBalance,
            discountAmount: Number(studentData.discount_amount || 0),
            hasCampaigns: activeCampaignFees.length > 0,
            wallet_balance_htg: Number(studentData.wallet_balance_htg || 0),
            wallet_balance_usd: Number(studentData.wallet_balance_usd || 0)
          });
        }
      } else if (user.role === UserRole.PARENT) {
        const { data: children } = await supabase
          .from('students')
          .select('*, class:classes(id, name)')
          .eq('parent_email', user.email);

        if (children && children.length > 0) {
          const childrenIds = children.map(c => c.id);
          const { data: allChildrenPayments } = await supabase
            .from('payments')
            .select('student_id, amount_htg_equivalent, amount')
            .in('student_id', childrenIds)
            .eq('academic_year_id', activeYear.id);
          
          let totalPaid = 0;
          let totalDue = 0;

          children.forEach(child => {
            const childPaid = allChildrenPayments?.filter(p => p.student_id === child.id)
              .reduce((acc, p) => acc + Number(p.amount_htg_equivalent || p.amount || 0), 0) || 0;
            
            const plan = plansMap.get(child.class_id);
            if (plan) {
              const enrollments = studentEnrollments.get(child.id) || [];
              const isReturning = enrollments.some(yearId => yearId !== activeYear.id);
              const applicableFee = isReturning ? Number(plan.reenrollment_fee || 0) : Number(plan.inscription_fee || 0);

              const expected = (applicableFee + Number(plan.tuition_fee || 0)) - Number(child.discount_amount || 0);
              totalPaid += childPaid;
              totalDue += Math.max(0, expected - childPaid);
            }
          });

          setParentStats({
            childrenCount: children.length,
            totalPaid,
            totalDue,
            children: children
          });
        }
      }

      // Director/Accountant/Secretary specific data
      if (user.role === UserRole.DIRECTOR || user.role === UserRole.SCHOOL_ADMIN || user.role === UserRole.SUPER_ADMIN || user.is_super_admin || user.role === UserRole.ACCOUNTANT || user.role === UserRole.SECRETARY) {
        const today = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];
        const { data: attendance } = await supabase
          .from('staff_attendances')
          .select('status, staff_id')
          .eq('date', today)
          .eq('school_id', user.school_id);

        // Use already filtered validPayments and students for in-memory join
        // Group supplies by transaction for recent payments to avoid multiple listings for one cart checkout
        const groupedRecentSupplies = new Map<string, any>();
        validSupplies.forEach(s => {
          const txId = s.transaction_id || s.id;
          if (groupedRecentSupplies.has(txId)) {
            const existing = groupedRecentSupplies.get(txId);
            existing.total_amount = Number(existing.total_amount || 0) + Number(s.total_amount || 0);
            existing.amount_htg_equivalent = Number(existing.amount_htg_equivalent || 0) + Number(s.amount_htg_equivalent || s.total_amount || 0);
          } else {
            groupedRecentSupplies.set(txId, { ...s });
          }
        });
        const groupedSuppliesList = Array.from(groupedRecentSupplies.values());

        const recentPayments = [...validPayments, ...groupedSuppliesList]
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 5)
          .map(p => {
            const student = studentsRes.data?.find(s => s.id === p.student_id);
            return {
              ...p,
              amount_to_display: Number(p.amount_htg_equivalent || p.amount || p.total_amount || 0),
              students: student
            };
          });

        let campusAttendance = attendance || [];
        if (currentCampusId && staffRes.data) {
          const activeStaffIds = new Set(staffRes.data.map(s => s.id));
          campusAttendance = campusAttendance.filter(a => activeStaffIds.has(a.staff_id));
        }

        setDirectorStats({
          presentStaff: campusAttendance?.filter(a => a.status === 'Présent').length || 0,
          absentStaff: campusAttendance?.filter(a => a.status === 'Absent').length || 0,
          lateStaff: campusAttendance?.filter(a => a.status === 'Retard').length || 0,
          recentPayments: recentPayments
        });
      }

      // Étape 4 : Préparation des données du graphique (Optimisée)
      const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc'];
      const monthlyData = months.map((m, i) => {
        const pRecu = validPayments.filter(p => new Date(p.created_at || new Date()).getMonth() === i)
          .reduce((acc, curr) => acc + Number(curr.amount_htg_equivalent || curr.amount || 0), 0);
        const sRecu = validSupplies.filter(s => new Date(s.created_at || new Date()).getMonth() === i)
          .reduce((acc, curr) => acc + Number(curr.amount_htg_equivalent || curr.total_amount || 0), 0);
        
        return { name: m, recu: pRecu + sRecu, attendu: totalExpected > 0 ? totalExpected / 10 : 0 };
      });
      setChartData(monthlyData);

      // Étape 5 : Préparation des données par classe
      if (user.role === UserRole.DIRECTOR || user.role === UserRole.SCHOOL_ADMIN || user.role === UserRole.SUPER_ADMIN || user.is_super_admin) {
        const byClass: Record<string, number> = {};
        const classesMapNames = new Map();
        
        // Fetch full classes data to get names
        const { data: fullClassesData } = await supabase
          .from('classes')
          .select('id, name')
          .eq('school_id', user.school_id);
          
        fullClassesData?.forEach(c => classesMapNames.set(c.id, c.name));

        const studentClassMap = new Map();
        // Priority to active enrollment class
        enrollmentsRes.data?.filter(e => e.academic_year_id === activeYear.id).forEach(e => studentClassMap.set(e.student_id, e.class_id));
        // Fallback to student record class
        studentsRes.data?.forEach(s => {
          if (!studentClassMap.has(s.id)) studentClassMap.set(s.id, s.class_id);
        });

        validPayments.forEach(p => {
          const classId = studentClassMap.get(p.student_id);
          if (classId) {
            const className = classesMapNames.get(classId) || 'Inconnu';
            byClass[className] = (byClass[className] || 0) + Number(p.amount_htg_equivalent || p.amount || 0);
          }
        });

        const classDataArray = Object.entries(byClass)
          .map(([name, amount]) => ({ name, montant: amount }))
          .sort((a, b) => b.montant - a.montant);

        setFullClassRevenue(classDataArray);
        setClassChartData(classDataArray.slice(0, 10)); // Top 10 for chart

        // Save to sessionStorage cache for instant loading on subsequent visits
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify({
            stats,
            directorStats,
            chartData: monthlyData,
            classChartData: classDataArray.slice(0, 10),
            timestamp: Date.now()
          }));
        } catch (e) {}
      }

    } catch (err: any) {
      const isNetworkError = 
        err?.code === 'NETWORK_ERROR' || 
        err?.message?.includes('Erreur réseau') || 
        err?.message?.includes('Failed to fetch') ||
        err?.message === 'Failed to fetch';

      if (isNetworkError) {
        console.warn("Dashboard Stats: Avertissement réseau (utilisation du cache si disponible):", err?.message || err);
        // Attempt fallback from sessionStorage cache
        try {
          const cacheKey = `edunova_dash_stats_${user.school_id}_${currentCampusId || 'GLOBAL'}_${selectedYearId || 'ACTIVE'}`;
          const cached = sessionStorage.getItem(cacheKey);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed.stats) setStats(parsed.stats);
            if (parsed.directorStats) setDirectorStats(parsed.directorStats);
            if (parsed.chartData) setChartData(parsed.chartData);
            if (parsed.classChartData) setClassChartData(parsed.classChartData);
          }
        } catch (cacheErr) {}
      } else {
        console.error("Dashboard Stats Error:", err);
        setError(err.message || "Impossible de charger les statistiques.");
      }
    } finally {
      setLoading(false);
    }
  }, [user.school_id, user.role, user.email, user.full_name, currentCampusId, selectedYearId, activeAcademicYear]);

  useEffect(() => {
    fetchDashboardStats();
  }, [fetchDashboardStats]);

  // Real-time synchronization for dashboard statistics
  useEffect(() => {
    if (!user?.school_id) return;

    const channelName = `admin_dashboard_${user.school_id}`;
    const dashboardSub = supabase.channel(channelName)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'payments', 
        filter: `school_id=eq.${user.school_id}` 
      }, () => {
        fetchDashboardStats();
      })
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'expenses', 
        filter: `school_id=eq.${user.school_id}` 
      }, () => {
        fetchDashboardStats();
      })
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'school_supplies', 
        filter: `school_id=eq.${user.school_id}` 
      }, () => {
        fetchDashboardStats();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(dashboardSub);
    };
  }, [user?.school_id, fetchDashboardStats]);

  const [schoolInfo, setSchoolInfo] = useState<{ name: string; logo_url: string | null; director: string; activeYearName?: string }>({
    name: 'Direction Administrative',
    logo_url: null,
    director: '',
    activeYearName: ''
  });

  useEffect(() => {
    const fetchSchoolInfo = async () => {
      if (!user.school_id) return;
      
      // Cache local pour le mode OFFLINE
      const cachedLogo = localStorage.getItem(`school_logo_${user.school_id}`);
      const cachedName = localStorage.getItem(`school_name_${user.school_id}`);
      
      if (cachedLogo || cachedName) {
        setSchoolInfo(prev => ({
          ...prev,
          name: cachedName || prev.name,
          logo_url: cachedLogo
        }));
      }

      try {
        const { data } = await supabase
          .from('schools')
          .select('name, logo_url, director_name')
          .eq('id', user.school_id)
          .maybeSingle();
        if (data) {
          setSchoolInfo(prev => ({
            ...prev,
            name: data.name || 'Direction Administrative',
            logo_url: data.logo_url,
            director: data.director_name || ''
          }));
          // Sync cache
          if (data.logo_url) localStorage.setItem(`school_logo_${user.school_id}`, data.logo_url);
          if (data.name) localStorage.setItem(`school_name_${user.school_id}`, data.name);
        }
      } catch (err) {
        console.error("Dashboard school info error:", err);
      }
    };
    fetchSchoolInfo();
  }, [user.school_id]);

  const generateInsight = async () => {
    setAiInsight("Analyse institutionnelle en cours...");
    // Explicitly structured data for the AI expert
    const contextStats = {
      ...stats,
      todayTotalAmount: stats.todayTotalAmount, // Ensure it's clear
      activeYear: schoolInfo.activeYearName
    };
    const text = await geminiService.analyzeFinancialHealth(contextStats);
    setAiInsight(text);
  };

  const generateStudentGreeting = useCallback(async () => {
    if (user.role !== UserRole.STUDENT) return;
    try {
      const prompt = `En tant qu'assistant EduNova Pro, salue chaleureusement ${terminology.student.toLowerCase()} ${user.full_name}. Donne-lui un court conseil d'étude (1 sentence) basé sur le fait qu'il est en ${terminology.option.toLowerCase()} ${studentStats.className}.`;
      const response = await geminiService.generateText(prompt);
      setStudentAiGreeting(response);
    } catch (err) {
      console.error("AI Greeting Error:", err);
    }
  }, [user.role, user.full_name, studentStats.className]);

  const generateTeacherGreeting = useCallback(async () => {
    if (user.role !== UserRole.TEACHER) return;
    try {
      const prompt = `En tant qu'assistant EduNova Pro, salue chaleureusement ${terminology.teacher.toLowerCase()} ${user.full_name}. Donne-lui un court conseil pédagogique ou un mot d'encouragement (1 sentence) pour sa journée avec ses ${teacherStats.classesCount} ${terminology.options.toLowerCase()}.`;
      const response = await geminiService.generateText(prompt);
      setTeacherAiGreeting(response);
    } catch (err) {
      console.error("AI Greeting Error:", err);
    }
  }, [user.role, user.full_name, teacherStats.classesCount]);

  const generateDirectorGreeting = useCallback(async () => {
    try {
      const prompt = `En tant qu'assistant EduNova Pro, salue chaleureusement le Directeur ${user.full_name}. Donne-lui un court indicateur de performance ou un mot d'encouragement (1 phrase) pour la gestion de son établissement aujourd'hui.`;
      const response = await geminiService.generateText(prompt);
      setDirectorAiGreeting(response);
    } catch (err) {
      console.error("AI Greeting Error:", err);
    }
  }, [user.full_name]);

  // Greetings are disabled as they are no longer rendered on the Dashboard screen
  useEffect(() => {
    // Disabled
  }, []);

  const financeRoles = [UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.DIRECTOR, UserRole.ACCOUNTANT];
  const canViewFinances = financeRoles.includes(user.role);

  if (loading) {
    return (
      <ModernDashboardSkeleton 
        title="Chargement du Tableau de Bord..."
        subtitle={`Synchronisation sécurisée des indicateurs clés, finances, effectifs ${terminology.students.toLowerCase()} et statistiques de l'établissement...`}
      />
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 p-6">
        <RetryableError 
          message={error} 
          onRetry={fetchDashboardStats}
          className="max-w-md w-full"
        />
      </div>
    );
  }


  if (!user.school_id && (user.role === UserRole.SUPER_ADMIN || user.is_super_admin)) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] text-slate-500 space-y-6 animate-in fade-in duration-500">
        <div className="p-6 bg-white rounded-full shadow-sm border border-slate-100">
          <ShieldAlert size={64} className="text-indigo-500" />
        </div>
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Bienvenue, Super Administrateur</h2>
          <p className="text-slate-500 mb-6">
            Vous n'êtes actuellement assigné à aucun établissement spécifique. Le tableau de bord analytique nécessite un établissement pour afficher des données.
          </p>
          <button
            onClick={() => navigate('/super-admin')}
            className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-sm font-medium rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-all active:scale-95"
          >
            <ShieldAlert size={18} className="mr-2" />
            Accéder à la Console Super Administrateur
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12 animate-in fade-in duration-500">
      {/* Security Recommendation Banner */}
      {showSecurityBanner && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 p-2">
            <button 
              onClick={handleCloseSecurityBanner}
              className="p-1.5 text-amber-400 hover:text-amber-600 hover:bg-amber-100 rounded-xl transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center shrink-0 shadow-inner group-hover:scale-110 transition-transform duration-500">
              <ShieldCheck size={32} />
            </div>
            <div className="text-center md:text-left space-y-1">
              <h3 className="text-lg font-black text-amber-900 tracking-tight flex items-center justify-center md:justify-start gap-2">
                Sécurité Recommandée
                <span className="px-2 py-0.5 bg-amber-200 text-amber-700 text-[10px] uppercase font-bold rounded-full">Haute Priorité</span>
              </h3>
              <p className="text-amber-700 font-medium text-sm max-w-xl leading-relaxed">
                En tant qu'utilisateur avec un rôle sensible, nous vous recommandons fortement d'activer l'authentification à double facteur (2FA) pour protéger l'accès à vos données financières et institutionnelles.
              </p>
            </div>
          </div>
          
          <div className="shrink-0 w-full md:w-auto">
            <button 
              onClick={() => navigate('/settings/ecole')}
              className="w-full md:w-auto px-6 py-3 bg-amber-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-amber-600/20 hover:bg-amber-700 hover:shadow-xl transition-all active:scale-95"
            >
              Sécuriser mon compte
            </button>
          </div>

          {/* Decorative elements */}
          <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-amber-200/20 rounded-full blur-2xl pointer-events-none" />
        </motion.div>
      )}

      {/* Revenue Breakdown Modal */}
      {showRevenueModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-300">
      <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-emerald-50/30">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-emerald-100 text-emerald-600 rounded-2xl">
            <TrendingUp size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">Recettes par {terminology.option} (Global)</h3>
            <p className="text-sm text-gray-500">Détail des encaissements effectifs globaux</p>
          </div>
        </div>
        <button 
          onClick={() => setShowRevenueModal(false)}
          className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400 hover:text-gray-600"
        >
          <X size={24} />
        </button>
      </div>
      
      <div className="p-8 max-h-[60vh] overflow-y-auto custom-scrollbar overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[500px]">
          <thead>
            <tr className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">
              <th className="pb-4 px-2">{terminology.option}</th>
              <th className="pb-4 px-2 text-right">Montant Collecté</th>
              <th className="pb-4 px-2 text-right">% du Total</th>
            </tr>
          </thead>
                <tbody className="divide-y divide-gray-50">
                  {fullClassRevenue.map((item, idx) => (
                    <tr key={idx} className="group hover:bg-gray-50/50 transition-colors">
                      <td className="py-4 px-2 font-medium text-gray-700">{item.name}</td>
                      <td className="py-4 px-2 text-right font-bold text-gray-900 font-mono">
                        {item.montant.toLocaleString()} <span className="text-[10px] text-gray-400 font-normal">HTG</span>
                      </td>
                      <td className="py-4 px-2 text-right">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-600">
                          {stats.collected > 0 ? ((item.montant / stats.collected) * 100).toFixed(1) : 0}%
                        </span>
                      </td>
                    </tr>
                  ))}
                  {fullClassRevenue.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-12 text-center text-gray-400 italic">
                        Aucune donnée disponible pour cette session.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            <div className="px-8 py-6 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
              <span className="text-sm font-bold text-gray-900 uppercase tracking-widest">Total Général</span>
              <div className="text-right">
                <span className="text-xl font-black text-emerald-600 font-mono">
                  {stats.collected.toLocaleString()} <span className="text-xs font-normal">HTG{(stats.collectedUSD > 0 || stats.expectedUSD > 0) ? " eq." : ""}</span>
                </span>
                {(stats.collectedUSD > 0 || stats.expectedUSD > 0) && (
                  <p className="text-[10px] text-gray-400 font-bold mt-1 tracking-wider uppercase">
                    Uniquement les versements de type effectif
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header Section */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center gap-4 sm:gap-5">
          <div className="w-14 h-14 sm:w-16 sm:h-16 bg-white rounded-2xl shadow-xs border border-slate-200/80 flex items-center justify-center overflow-hidden shrink-0">
            {schoolInfo.logo_url ? (
              <img src={schoolInfo.logo_url} alt="Logo" className="w-full h-full object-contain p-1.5 sm:p-2" />
            ) : (
              <School size={28} className="text-slate-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-slate-900 break-words flex flex-wrap items-center gap-x-3 gap-y-1.5" title={schoolInfo.name}>
              <span>{schoolInfo.name}</span>
            </h1>
            
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {/* User Identity Pill */}
              <div className="inline-flex items-center gap-2 bg-slate-50 hover:bg-slate-100/80 border border-slate-200/80 px-2.5 py-1 rounded-xl transition-all shadow-2xs">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-xs font-bold text-slate-800 truncate max-w-[130px] sm:max-w-[180px]">
                  {user.full_name}
                </span> 
                <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                  {roleLabels[user.role] || user.role.replace(/_/g, ' ')}
                </span>
              </div>

              {/* Modern Academic Session Dropdown Selector */}
              {academicYears.length > 0 && (
                <AcademicSessionPill
                  academicYears={academicYears}
                  selectedYearId={selectedYearId}
                  onSelectYear={(yearId) => setSelectedYearId(yearId)}
                  size="sm"
                  colorScheme="indigo"
                />
              )}

              {/* Refresh Button */}
              <button 
                onClick={() => fetchDashboardStats()}
                disabled={loading}
                className="p-1.5 text-slate-500 hover:text-indigo-600 bg-white hover:bg-indigo-50/50 border border-slate-200/90 hover:border-indigo-200 shadow-2xs rounded-xl transition-all duration-200 disabled:opacity-50 shrink-0"
                title="Rafraîchir les données du tableau de bord"
              >
                <RefreshCcw size={14} className={`stroke-[2.2] ${loading ? 'animate-spin text-indigo-600' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full lg:w-auto">
          {[UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.DIRECTOR, UserRole.SECRETARY, UserRole.SUPERVISOR, UserRole.ACCOUNTANT].includes(user.role) && (
            <>
              <div className="relative flex-1 lg:max-w-64 group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  {isSearching ? <Loader2 className="h-5 w-5 text-gray-400 animate-spin" /> : <Search className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />}
                </div>
                <input 
                  type="text"
                  placeholder={`Rechercher...`}
                  className="block w-full pl-10 pr-3 py-3 min-h-[44px] text-gray-900 border border-gray-200 rounded-xl leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all sm:text-sm"
                  value={globalSearch}
                  onChange={(e) => {
                    setGlobalSearch(e.target.value);
                    setShowResults(true);
                  }}
                  onFocus={() => setShowResults(true)}
                />
                {showResults && globalSearch.length >= 2 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-50 max-h-[300px] overflow-y-auto custom-scrollbar">
                    {isSearching ? (
                      <div className="p-8 text-center">
                        <RefreshCcw className="animate-spin text-blue-500 mx-auto mb-2" size={24} />
                        <p className="text-sm text-gray-500">Recherche en cours...</p>
                      </div>
                    ) : searchResults.length === 0 ? (
                      <div className="p-8 text-center space-y-2">
                        <p className="text-sm text-gray-500 italic">Aucun {terminology.student.toLowerCase()} trouvé pour "{globalSearch}"</p>
                        <p className="text-[10px] text-gray-400">Vérifiez l'orthographe ou essayez une partie du nom</p>
                      </div>
                    ) : (
                      <div className="py-2">
                        {searchResults.map(s => (
                          <button 
                            key={s.id} 
                            onClick={() => { 
                              setShowResults(false); 
                              if (canViewFinances) {
                                navigate('/economat/suivi', { state: { studentId: s.id, academicYearId: s.academic_year_id } }); 
                              } else {
                                navigate(`/eleves/detail/${s.id}`);
                              }
                            }} 
                            className="w-full flex items-center justify-between px-4 py-3 min-h-[44px] hover:bg-gray-50 transition-colors text-left group"
                          >
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{formatStudentName(s.last_name, s.first_name).fullName}</p>
                                {s.academic_year_label && (
                                  <span className={`inline-flex items-center px-1.5 py-0.5 text-[9px] font-bold rounded-md border ${
                                    s.academic_year_status === 'ACTIVE' 
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                                      : s.academic_year_status === 'FUTURE'
                                      ? 'bg-amber-50 text-amber-700 border-amber-100'
                                      : 'bg-slate-50 text-slate-500 border-slate-200'
                                  }`}>
                                    {s.academic_year_label}
                                    {s.academic_year_type === 'INTENSIVE' ? ' (Intensive)' : s.academic_year_type === 'SPECIAL' ? ' (Spéciale)' : ''}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 mt-0.5">{s.class?.name || 'Non assigné'} <span className="ml-2 font-mono text-[10px] text-gray-400">Matricule: {s.reference_number || s.id?.substring(0, 8) || ''}</span></p>
                            </div>
                            <ChevronRight size={18} className="text-gray-400 group-hover:text-blue-600 transition-colors" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <button 
                onClick={() => navigate('/eleves/ajouter')}
                className="inline-flex items-center justify-center px-4 py-3 min-h-[44px] border border-transparent text-sm font-medium rounded-xl text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-all active:scale-95 whitespace-nowrap lg:w-auto"
              >
                <UserPlus size={18} className="mr-2" />
                {terminology.enrollment}
              </button>
            </>
          )}
        </div>
      </header>

      {/* Stats Grid */}
      {canViewFinances ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-4 xl:gap-5">
          {/* Card 1: Recettes Effectives */}
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 hover:border-slate-200/80 hover:shadow-md transition-all duration-300 flex flex-col relative group">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 sm:p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100/60 shadow-xs shrink-0">
                  <TrendingUp size={19} className="stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800 tracking-tight">Recettes Effectives</h3>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Encaissements réels</p>
                </div>
              </div>
              <button 
                onClick={() => setShowRevenueModal(true)}
                className="p-1.5 sm:p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50/70 rounded-xl transition-all border border-transparent hover:border-indigo-100/80 shrink-0"
                title="Voir détails par classe"
              >
                <Layers size={16} />
              </button>
            </div>

            <div className="mt-auto pt-1">
              <div className="flex items-baseline justify-between gap-1.5 mb-1.5 flex-nowrap min-w-0">
                <p className="text-xl sm:text-2xl 2xl:text-[1.65rem] font-black text-slate-900 tracking-tight leading-none truncate tabular-nums" title={stats.collected.toLocaleString()}>
                  {stats.collected.toLocaleString()}
                </p>
                <span className="text-[10px] sm:text-[11px] font-black text-slate-500 uppercase tracking-wider bg-slate-100/80 px-1.5 py-0.5 rounded-md border border-slate-200/50 shrink-0 whitespace-nowrap">
                  HTG{(stats.collectedUSD > 0 || stats.expectedUSD > 0) ? " eq." : ""}
                </span>
              </div>

              {(stats.collectedUSD > 0 || stats.expectedUSD > 0) && (
                <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-bold text-slate-400 mb-3 flex-wrap">
                  <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-100/50 whitespace-nowrap">
                    {stats.collectedHTG.toLocaleString()} HTG
                  </span>
                  <span className="text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-md border border-blue-100/50 whitespace-nowrap">
                    ${stats.collectedUSD.toLocaleString()} USD
                  </span>
                </div>
              )}

              {/* Visual mini breakdown bar */}
              {stats.collected > 0 && (
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden flex my-2.5 shadow-inner">
                  <div 
                    className="bg-emerald-500 h-full transition-all duration-500" 
                    style={{ width: `${Math.min(100, (stats.collectedInscription / stats.collected) * 100)}%` }} 
                    title="Inscription"
                  />
                  <div 
                    className="bg-indigo-500 h-full transition-all duration-500" 
                    style={{ width: `${Math.min(100, (stats.collectedScolarite / stats.collected) * 100)}%` }} 
                    title="Scolarité"
                  />
                  <div 
                    className="bg-amber-500 h-full transition-all duration-500" 
                    style={{ width: `${Math.min(100, ((stats.collectedDivers + stats.collectedSupplies) / stats.collected) * 100)}%` }} 
                    title="Fournitures & Divers"
                  />
                </div>
              )}

              <div className="flex flex-col gap-1.5 pt-1 border-t border-slate-100/80">
                <div className="flex justify-between items-baseline gap-2 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-500 font-medium whitespace-nowrap shrink-0">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                    <span>Inscription :</span>
                  </div>
                  <div className="text-right flex flex-col items-end min-w-0">
                    <span className="font-bold text-slate-800">{stats.collectedInscription.toLocaleString()} G</span>
                    {(stats.collectedInscriptionUSD > 0 || stats.collectedInscriptionHTG > 0) && (
                       <span className="text-[10px] text-slate-400 font-mono">({stats.collectedInscriptionHTG.toLocaleString()} G | ${stats.collectedInscriptionUSD.toLocaleString()})</span>
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-baseline gap-2 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-500 font-medium whitespace-nowrap shrink-0">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0"></span>
                    <span>Scolarité :</span>
                  </div>
                  <div className="text-right flex flex-col items-end min-w-0">
                    <span className="font-bold text-slate-800">{stats.collectedScolarite.toLocaleString()} G</span>
                    {(stats.collectedScolariteUSD > 0 || stats.collectedScolariteHTG > 0) && (
                       <span className="text-[10px] text-slate-400 font-mono">({stats.collectedScolariteHTG.toLocaleString()} G | ${stats.collectedScolariteUSD.toLocaleString()})</span>
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-baseline gap-2 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-500 font-medium whitespace-nowrap shrink-0">
                    <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
                    <span>Fournitures & Div. :</span>
                  </div>
                  <div className="text-right flex flex-col items-end min-w-0">
                    <span className="font-bold text-slate-800">
                      {(stats.collectedDivers + stats.collectedSupplies).toLocaleString()} G
                    </span>
                    {(stats.collectedDiversUSD > 0 || stats.collectedSuppliesUSD > 0 || stats.collectedDiversHTG > 0 || stats.collectedSuppliesHTG > 0) && (
                       <span className="text-[10px] text-slate-400 font-mono">
                         ({(stats.collectedDiversHTG + stats.collectedSuppliesHTG).toLocaleString()} G | ${(stats.collectedDiversUSD + stats.collectedSuppliesUSD).toLocaleString()})
                       </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Objectif Annuel & Taux de Recouvrement */}
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 hover:border-slate-200/80 hover:shadow-md transition-all duration-300 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 sm:p-2.5 bg-blue-50 text-blue-600 rounded-2xl border border-blue-100/60 shadow-xs shrink-0">
                  <CreditCard size={19} className="stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800 tracking-tight">Objectif Annuel</h3>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Prévisionnel global</p>
                </div>
              </div>
              <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100/60 shrink-0">
                Budget
              </span>
            </div>

            <div className="mt-auto pt-1">
              <div className="flex items-baseline justify-between gap-1.5 mb-1.5 flex-nowrap min-w-0">
                <p className="text-xl sm:text-2xl 2xl:text-[1.65rem] font-black text-slate-900 tracking-tight leading-none truncate tabular-nums" title={stats.expected.toLocaleString()}>
                  {stats.expected.toLocaleString()}
                </p>
                <span className="text-[10px] sm:text-[11px] font-black text-slate-500 uppercase tracking-wider bg-slate-100/80 px-1.5 py-0.5 rounded-md border border-slate-200/50 shrink-0 whitespace-nowrap">
                  HTG{(stats.collectedUSD > 0 || stats.expectedUSD > 0) ? " eq." : ""}
                </span>
              </div>

              {(stats.collectedUSD > 0 || stats.expectedUSD > 0) && (
                <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-bold text-slate-400 mb-3 flex-wrap">
                  <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-100/50 whitespace-nowrap">
                    {stats.expectedHTG.toLocaleString()} HTG
                  </span>
                  <span className="text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-md border border-blue-100/50 whitespace-nowrap">
                    ${stats.expectedUSD.toLocaleString()} USD
                  </span>
                </div>
              )}

              {/* Recovery Progress Gauge */}
              <div className="space-y-2.5 pt-2 border-t border-slate-100/80">
                <div>
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="font-semibold text-slate-600 flex items-center gap-1">
                      <ArrowUpRight size={13} className="text-blue-600" />
                      Taux de Recouvrement
                    </span>
                    <span className="font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md text-[11px] border border-blue-100/50">
                      {stats.expected > 0 ? ((stats.collectedTuition/stats.expected)*100).toFixed(1) : 0}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden shadow-inner">
                    <div 
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-700"
                      style={{ width: `${Math.min(100, stats.expected > 0 ? (stats.collectedTuition/stats.expected)*100 : 0)}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="font-semibold text-slate-600 flex items-center gap-1">
                      <ShoppingCart size={12} className="text-emerald-600" />
                      Pénétration Économat
                    </span>
                    <span className="font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md text-[11px] border border-emerald-100/50">
                      {stats.economatPenetration.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden shadow-inner">
                    <div 
                      className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 transition-all duration-700"
                      style={{ width: `${Math.min(100, stats.economatPenetration)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Charges Mensuelles */}
          <div 
            onClick={() => setIsPayrollModalOpen(true)}
            className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 hover:border-rose-200/80 hover:shadow-md transition-all duration-300 flex flex-col cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 sm:p-2.5 bg-rose-50 text-rose-600 rounded-2xl border border-rose-100/60 shadow-xs group-hover:scale-105 transition-transform shrink-0">
                  <TrendingDown size={19} className="stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800 tracking-tight">Charges</h3>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Masse salariale</p>
                </div>
              </div>
              <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-100/60 shrink-0">
                Mensuel
              </span>
            </div>

            <div className="mt-auto pt-1">
              <div className="flex items-baseline justify-between gap-1.5 mb-1 flex-nowrap min-w-0">
                <p className="text-xl sm:text-2xl 2xl:text-[1.65rem] font-black text-slate-900 tracking-tight leading-none truncate tabular-nums" title={`${stats.payroll.toLocaleString()} HTG`}>
                  {stats.payroll.toLocaleString()}
                </p>
                <span className="text-[10px] sm:text-[11px] font-black text-slate-500 uppercase tracking-wider bg-slate-100/80 px-1.5 py-0.5 rounded-md border border-slate-200/50 shrink-0 whitespace-nowrap">
                  HTG
                </span>
              </div>
              <p className="text-[11px] font-medium text-slate-400 mb-3 truncate" title="Charges mensuelles estimées">Charges mensuelles estimées</p>

              <div className="pt-2.5 border-t border-slate-100/80 flex items-center justify-between gap-1.5">
                <span className="text-[11px] font-bold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-xl border border-rose-100/60 group-hover:bg-rose-100 transition-colors flex items-center gap-1 shrink-0 whitespace-nowrap">
                  Voir détails <ChevronRight size={12} className="group-hover:translate-x-0.5 transition-transform shrink-0" />
                </span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 whitespace-nowrap">Payroll actif</span>
              </div>
            </div>
          </div>

          {/* Payroll Breakdown Modal */}
          {isPayrollModalOpen && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4" onClick={() => setIsPayrollModalOpen(false)}>
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-slate-100"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-4 sm:p-6 border-b border-slate-100 flex items-start sm:items-center justify-between bg-gradient-to-r from-rose-500/5 to-rose-600/0 gap-4 shrink-0">
                  <div className="flex items-center gap-2.5 sm:gap-3">
                    <div className="p-2 sm:p-2.5 bg-rose-50 text-rose-600 rounded-lg sm:rounded-xl shrink-0">
                      <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-black text-slate-800 uppercase tracking-wide leading-tight mb-0.5">Masse Salariale</h3>
                      <p className="text-[10px] sm:text-xs text-slate-500 font-medium leading-snug">Détail des charges pour l'annexe sélectionnée</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsPayrollModalOpen(false)}
                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors shrink-0 -mt-1 sm:mt-0"
                  >
                    <X className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                </div>
                
                <div className="p-4 sm:p-6 flex-1 overflow-y-auto space-y-3 sm:space-y-4">
                  {payrollBreakdown.length > 0 ? (
                    <div className="space-y-3">
                      {payrollBreakdown.map((member, idx) => (
                        <div key={idx} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col gap-2.5">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-bold text-slate-800">{member.name}</p>
                              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">{member.role}</p>
                            </div>
                            <span className="text-sm font-black text-slate-900 whitespace-nowrap">{member.total.toLocaleString()} HTG</span>
                          </div>
                          
                          <div className="border-t border-slate-200/60 pt-2 flex flex-col gap-1 text-[11px] text-slate-500 font-medium">
                            {member.baseSalary > 0 && (
                              <div className="flex justify-between">
                                <span>Salaire de base ({member.pay_type}) :</span>
                                <span className="font-semibold text-slate-700">{member.baseSalary.toLocaleString()} HTG</span>
                              </div>
                            )}
                            {member.teachingSalary > 0 && (
                              <div className="flex justify-between">
                                <span>Cours / Enseignement ({member.assignmentsCount} classe{member.assignmentsCount > 1 ? 's' : ''}) :</span>
                                <span className="font-semibold text-slate-700">{member.teachingSalary.toLocaleString()} HTG</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 sm:py-12 space-y-3">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
                        <Users className="w-5 h-5 sm:w-6 sm:h-6" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-700">Aucun personnel rémunéré</p>
                        <p className="text-[10px] sm:text-xs text-slate-400 mt-1 px-4">Il n'y a pas d'employés actifs avec un salaire fixe ou des heures de cours assignées pour cette annexe.</p>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="p-4 sm:p-6 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
                  <span className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-wider">Total estimé</span>
                  <span className="text-base sm:text-lg font-black text-rose-600">{stats.payroll.toLocaleString()} HTG</span>
                </div>
              </motion.div>
            </div>
          )}

          {/* Card 4: Paiements & Activité du Jour */}
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 hover:border-slate-200/80 hover:shadow-md transition-all duration-300 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 sm:p-2.5 bg-amber-50 text-amber-600 rounded-2xl border border-amber-100/60 shadow-xs shrink-0">
                  <Receipt size={19} className="stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800 tracking-tight">Caisse du Jour</h3>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Reçus émis</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-100 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Direct
              </span>
            </div>

            <div className="mt-auto pt-1">
              <div className="flex items-baseline justify-between gap-1.5 mb-1 flex-nowrap min-w-0">
                <p className="text-xl sm:text-2xl 2xl:text-[1.65rem] font-black text-slate-900 tracking-tight leading-none truncate tabular-nums">
                  {stats.todayPaymentsCount}
                </p>
                <span className="text-xs font-semibold text-slate-400 whitespace-nowrap">transaction{stats.todayPaymentsCount > 1 ? 's' : ''}</span>
              </div>
              <p className="text-[11px] font-medium text-slate-400 mb-3 truncate">Encaissés aujourd'hui</p>

              <div className="pt-2.5 border-t border-slate-100/80 flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Montant :</span>
                  <span className="font-black text-emerald-600 truncate text-right">{stats.todayTotalAmountHTG.toLocaleString()} G</span>
                </div>
                {stats.todayTotalAmountUSD > 0 && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Devise USD :</span>
                    <span className="font-black text-blue-600 truncate text-right">${stats.todayTotalAmountUSD.toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Director/Admin Specific Section */}
          {(user.role === UserRole.DIRECTOR || user.role === UserRole.SCHOOL_ADMIN || user.role === UserRole.SUPER_ADMIN || user.is_super_admin) && (
            <div className="sm:col-span-2 lg:col-span-2 xl:col-span-4 grid grid-cols-1 lg:grid-cols-3 gap-6 mt-2">
              {/* Daily Staff Attendance */}
              <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 flex flex-col justify-between hover:shadow-md transition-shadow">
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                        <ClipboardCheck size={18} />
                      </div>
                      <div>
                        <h3 className="text-base font-black text-slate-900 tracking-tight">Présence Personnel</h3>
                        <p className="text-[11px] font-medium text-slate-400">Pointage des enseignants & employés</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-black uppercase text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">Aujourd'hui</span>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center p-3.5 bg-emerald-50/80 border border-emerald-100/60 rounded-2xl">
                      <p className="text-2xl font-black text-emerald-600">{directorStats.presentStaff}</p>
                      <p className="text-[10px] text-emerald-700 font-black uppercase tracking-wider mt-0.5">Présents</p>
                    </div>
                    <div className="text-center p-3.5 bg-rose-50/80 border border-rose-100/60 rounded-2xl">
                      <p className="text-2xl font-black text-rose-600">{directorStats.absentStaff}</p>
                      <p className="text-[10px] text-rose-700 font-black uppercase tracking-wider mt-0.5">Absents</p>
                    </div>
                    <div className="text-center p-3.5 bg-amber-50/80 border border-amber-100/60 rounded-2xl">
                      <p className="text-2xl font-black text-amber-600">{directorStats.lateStaff}</p>
                      <p className="text-[10px] text-amber-700 font-black uppercase tracking-wider mt-0.5">Retards</p>
                    </div>
                  </div>
                </div>

                <Link to="/personnel/pointage" className="mt-5 flex items-center justify-center w-full py-2.5 text-xs font-black uppercase tracking-wider text-indigo-600 bg-indigo-50/60 hover:bg-indigo-100 rounded-xl transition-all border border-indigo-100">
                  Détails du pointage
                  <ChevronRight size={14} className="ml-1" />
                </Link>
              </div>

              {/* Recent Transactions */}
              <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 flex flex-col justify-between hover:shadow-md transition-shadow">
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                        <Coins size={18} />
                      </div>
                      <div>
                        <h3 className="text-base font-black text-slate-900 tracking-tight">Derniers Paiements</h3>
                        <p className="text-[11px] font-medium text-slate-400">Flux d'encaissement en direct</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    {directorStats.recentPayments.slice(0, 2).map((p, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-50 border border-slate-100/80">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-emerald-100/80 text-emerald-700 font-black text-xs flex items-center justify-center shrink-0">
                            {p.students?.first_name?.[0] || 'E'}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="font-bold text-xs text-slate-800 truncate">{formatStudentName(p.students?.last_name, p.students?.first_name).fullName}</span>
                            <span className="text-[10px] text-slate-400">{new Date(p.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                          </div>
                        </div>
                        <span className="font-black text-xs text-emerald-600 shrink-0 ml-2">+{Number(p.amount_to_display).toLocaleString()} G</span>
                      </div>
                    ))}
                    {directorStats.recentPayments.length === 0 && (
                      <p className="text-center py-6 text-slate-400 text-xs italic">Aucun paiement récent enregistré</p>
                    )}
                  </div>
                </div>

                <Link to="/economat/liste" className="mt-5 flex items-center justify-center w-full py-2.5 text-xs font-black uppercase tracking-wider text-emerald-700 bg-emerald-50/60 hover:bg-emerald-100 rounded-xl transition-all border border-emerald-100">
                  Voir tout l'historique
                  <ChevronRight size={14} className="ml-1" />
                </Link>
              </div>

              {/* Management Shortcuts Bento */}
              <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 flex flex-col justify-between hover:shadow-md transition-shadow">
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                        <Zap size={18} />
                      </div>
                      <div>
                        <h3 className="text-base font-black text-slate-900 tracking-tight">Gestion Stratégique</h3>
                        <p className="text-[11px] font-medium text-slate-400">Navigation rapide aux modules clés</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5">
                    <Link to="/economat" className="flex flex-col items-center justify-center p-3 rounded-2xl bg-slate-50/70 border border-slate-100 hover:border-blue-200 hover:bg-blue-50/40 transition-all group">
                      <div className="p-2 bg-white rounded-xl shadow-xs text-blue-600 mb-1.5 group-hover:scale-110 transition-transform">
                        <Coins size={16} />
                      </div>
                      <span className="text-[11px] font-bold text-slate-700">Économat</span>
                    </Link>
                    <Link to="/eleves" className="flex flex-col items-center justify-center p-3 rounded-2xl bg-slate-50/70 border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/40 transition-all group">
                      <div className="p-2 bg-white rounded-xl shadow-xs text-indigo-600 mb-1.5 group-hover:scale-110 transition-transform">
                        <Users size={16} />
                      </div>
                      <span className="text-[11px] font-bold text-slate-700">{terminology.students}</span>
                    </Link>
                    <Link to="/communication/email" className="flex flex-col items-center justify-center p-3 rounded-2xl bg-slate-50/70 border border-slate-100 hover:border-blue-200 hover:bg-blue-50/40 transition-all group">
                      <div className="p-2 bg-white rounded-xl shadow-xs text-blue-600 mb-1.5 group-hover:scale-110 transition-transform">
                        <Mail size={16} />
                      </div>
                      <span className="text-[11px] font-bold text-slate-700">Contact</span>
                    </Link>
                    <Link to="/notes" className="flex flex-col items-center justify-center p-3 rounded-2xl bg-slate-50/70 border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/40 transition-all group">
                      <div className="p-2 bg-white rounded-xl shadow-xs text-emerald-600 mb-1.5 group-hover:scale-110 transition-transform">
                        <FileSignature size={16} />
                      </div>
                      <span className="text-[11px] font-bold text-slate-700">Notes</span>
                    </Link>
                    <Link to="/bulletins" className="flex flex-col items-center justify-center p-3 rounded-2xl bg-slate-50/70 border border-slate-100 hover:border-amber-200 hover:bg-amber-50/40 transition-all group">
                      <div className="p-2 bg-white rounded-xl shadow-xs text-amber-600 mb-1.5 group-hover:scale-110 transition-transform">
                        <FileText size={16} />
                      </div>
                      <span className="text-[11px] font-bold text-slate-700">Bulletins</span>
                    </Link>
                    <Link to="/discipline" className="flex flex-col items-center justify-center p-3 rounded-2xl bg-slate-50/70 border border-slate-100 hover:border-rose-200 hover:bg-rose-50/40 transition-all group">
                      <div className="p-2 bg-white rounded-xl shadow-xs text-rose-600 mb-1.5 group-hover:scale-110 transition-transform">
                        <ShieldAlert size={16} />
                      </div>
                      <span className="text-[11px] font-bold text-slate-700">Discipline</span>
                    </Link>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-400">
                  <span>Centre de commande</span>
                  <span className="text-slate-600">EduNova OS</span>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : user.role === UserRole.TEACHER ? (
        <div className="space-y-8 animate-in fade-in duration-500">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-100/90 flex flex-col justify-between hover:shadow-md hover:border-blue-100 transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Mes {terminology.options}</span>
                <div className="p-2.5 bg-blue-50 rounded-2xl text-blue-600 shadow-xs border border-blue-100/50">
                  <Layers size={18} />
                </div>
              </div>
              <div>
                <p className="text-3xl lg:text-4xl font-black text-slate-900 tracking-tight">{teacherStats.classesCount}</p>
                <p className="mt-2 text-xs font-semibold text-slate-400">{terminology.options} assignées ce semestre</p>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-100/90 flex flex-col justify-between hover:shadow-md hover:border-emerald-100 transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Heures Aujourd'hui</span>
                <div className="p-2.5 bg-emerald-50 rounded-2xl text-emerald-600 shadow-xs border border-emerald-100/50">
                  <Clock size={18} />
                </div>
              </div>
              <div>
                <p className="text-3xl lg:text-4xl font-black text-slate-900 tracking-tight">{teacherStats.todayHours}h</p>
                <p className="mt-2 text-xs font-semibold text-slate-400">Volume horaire prévu du jour</p>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-100/90 flex flex-col justify-between hover:shadow-md hover:border-amber-100 transition-all duration-300 group cursor-pointer" onClick={() => navigate('/horaire')}>
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Calendrier</span>
                <div className="p-2.5 bg-amber-50 rounded-2xl text-amber-600 shadow-xs border border-amber-100/50 group-hover:scale-105 transition-transform">
                  <Calendar size={18} />
                </div>
              </div>
              <div>
                {(() => {
                  const now = new Date();
                  const currentDay = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'][now.getDay()];
                  const nextClass = teacherStats.assignments
                    .filter(a => a.day_of_week === currentDay)
                    .sort((a, b) => a.start_time.localeCompare(b.start_time))
                    .find(a => {
                      const [h, m] = a.start_time.split(':').map(Number);
                      const start = new Date(); start.setHours(h, m, 0);
                      return start > now;
                    });
                  
                  if (nextClass) {
                    return (
                      <>
                        <p className="text-sm font-black text-slate-900 tracking-tight">Prochain : {nextClass.start_time.substring(0, 5)}</p>
                        <p className="mt-1 text-xs text-amber-600 font-bold">{nextClass.class_name} • {nextClass.subject_name}</p>
                      </>
                    );
                  }
                  return (
                    <>
                      <p className="text-sm font-black text-slate-900 tracking-tight">Planning de Cours</p>
                      <p className="mt-1 text-xs text-slate-400 font-medium">Aucun cours à venir aujourd'hui</p>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-xs border border-slate-100/90 p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-base font-black text-slate-900 tracking-tight">Outils Pédagogiques</h3>
                <p className="text-xs font-medium text-slate-400">Accès directs pour l'évaluation et la gestion de classe</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
              <Link to="/notes" className="p-4 rounded-2xl bg-slate-50/70 border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/40 transition-all flex flex-col items-center justify-center text-center gap-2.5 group shadow-xs">
                <div className="p-3 bg-white rounded-2xl text-indigo-600 group-hover:scale-110 transition-transform shadow-xs">
                  <FileSignature size={22} />
                </div>
                <span className="text-xs font-bold text-slate-800 group-hover:text-indigo-700">Saisie des Notes</span>
              </Link>
              
              {[UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.DIRECTOR, UserRole.SECRETARY, UserRole.SUPERVISOR].includes(user.role) && isPresencesEnabled && (
                  <Link to="/presences" className="p-4 rounded-2xl bg-slate-50/70 border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/40 transition-all flex flex-col items-center justify-center text-center gap-2.5 group shadow-xs">
                  <div className="p-3 bg-white rounded-2xl text-emerald-600 group-hover:scale-110 transition-transform shadow-xs">
                    <ClipboardCheck size={22} />
                  </div>
                  <span className="text-xs font-bold text-slate-800 group-hover:text-emerald-700">Appel & Présences</span>
                </Link>
              )}

              {isDisciplineEnabled && (
                <Link to="/discipline" className="p-4 rounded-2xl bg-slate-50/70 border border-slate-100 hover:border-orange-200 hover:bg-orange-50/40 transition-all flex flex-col items-center justify-center text-center gap-2.5 group shadow-xs">
                  <div className="p-3 bg-white rounded-2xl text-orange-600 group-hover:scale-110 transition-transform shadow-xs">
                    <ShieldAlert size={22} />
                  </div>
                  <span className="text-xs font-bold text-slate-800 group-hover:text-orange-700">Discipline</span>
                </Link>
              )}
              
              <Link to="/enseignant/pointage" className="p-4 rounded-2xl bg-slate-50/70 border border-slate-100 hover:border-purple-200 hover:bg-purple-50/40 transition-all flex flex-col items-center justify-center text-center gap-2.5 group shadow-xs">
                <div className="p-3 bg-white rounded-2xl text-purple-600 group-hover:scale-110 transition-transform shadow-xs">
                  <Clock size={22} />
                </div>
                <span className="text-xs font-bold text-slate-800 group-hover:text-purple-700">Mon Pointage</span>
              </Link>
            </div>
          </div>

          {/* Syllabus Progress Module */}
          <div className="bg-white rounded-3xl shadow-xs border border-slate-100/90 p-6">
            <div className="flex items-center justify-between mb-6">
               <div>
                  <h3 className="text-base font-black text-slate-900 tracking-tight">Progression du Syllabus</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Planifications et objectifs par classe et matière</p>
               </div>
               <Link to="/enseignant/syllabus?tab=overview" className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100 flex items-center gap-1 group transition-all">
                 Gérer <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
               </Link>
            </div>
            
            {teacherStats.syllabusSubjects.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {teacherStats.syllabusSubjects.map((sub) => {
                   const progress = Math.min(100, sub.totalWeight);
                   const isComplete = sub.totalWeight === 100;
                   const isOver = sub.totalWeight > 100;
                   return (
                     <Link to={`/enseignant/syllabus?class=${sub.class_id}&subject=${sub.subject_id}`} key={sub.id} className="p-4 rounded-2xl border border-slate-100 bg-slate-50/60 hover:bg-white hover:border-indigo-200 hover:shadow-sm transition-all block group">
                        <div className="flex items-start justify-between mb-2.5">
                           <div>
                              <span className="text-xs font-black text-slate-900 line-clamp-1 group-hover:text-indigo-600 transition-colors" title={sub.subjectName}>{sub.subjectName}</span>
                              <span className="inline-block mt-1 text-[9px] font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">{sub.className}</span>
                           </div>
                        </div>
                        <div className="mb-2 flex items-end justify-between">
                           <div className="text-[11px] text-slate-400 font-medium">{sub.evaluationsCount} étape{sub.evaluationsCount > 1 ? 's' : ''}</div>
                           <span className={`text-xs font-black ${isComplete ? 'text-emerald-600' : isOver ? 'text-rose-600' : 'text-indigo-600'}`}>
                             {sub.totalWeight}%
                           </span>
                        </div>
                        <div className="w-full bg-slate-200/70 rounded-full h-2 relative overflow-hidden">
                           <div 
                             className={`absolute top-0 left-0 h-full rounded-full transition-all duration-700 ${isComplete ? 'bg-emerald-500' : isOver ? 'bg-rose-500' : 'bg-indigo-600'}`} 
                             style={{ width: `${progress}%` }}
                           />
                        </div>
                     </Link>
                   );
                })}
              </div>
            ) : (
              <div className="py-8 flex flex-col items-center justify-center border border-dashed border-slate-200 rounded-2xl bg-slate-50/40 text-center px-4">
                <BookOpen className="text-slate-300 mb-2" size={28} />
                <p className="text-xs text-slate-500 font-semibold">Aucun syllabus de matière planifié</p>
                <Link to="/enseignant/syllabus" className="mt-3 text-xs font-bold text-indigo-600 bg-indigo-50 px-3.5 py-1.5 rounded-xl hover:bg-indigo-100 transition-colors">
                  Planifier mes évaluations
                </Link>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-3xl shadow-xs border border-slate-100/90 p-6 md:p-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-base md:text-lg font-black text-slate-900 tracking-tight">Mon Programme du Jour</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Vos séances programmées pour aujourd'hui</p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-600 text-[11px] font-black rounded-xl uppercase tracking-wider border border-indigo-100">
                  <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
                  {['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'][new Date().getDay()]}
                </div>
              </div>
              {teacherStats.assignments.length > 0 ? (
                <div className="space-y-3">
                  {teacherStats.assignments
                    .filter(a => a.day_of_week === ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'][new Date().getDay()])
                    .sort((a, b) => a.start_time.localeCompare(b.start_time))
                    .map((a, idx) => {
                      const now = new Date();
                      const [startH, startM] = a.start_time.split(':').map(Number);
                      const [endH, endM] = a.end_time.split(':').map(Number);
                      const startTime = new Date(); startTime.setHours(startH, startM, 0);
                      const endTime = new Date(); endTime.setHours(endH, endM, 0);
                      const isCurrent = now >= startTime && now <= endTime;
                      const isPast = now > endTime;

                      return (
                        <div key={idx} className={`flex items-center p-4 rounded-2xl border transition-all duration-300 ${isCurrent ? 'bg-indigo-50/80 border-indigo-200 ring-2 ring-indigo-500/10 shadow-xs' : isPast ? 'bg-slate-50/40 border-slate-100 opacity-60' : 'bg-white border-slate-100 hover:border-indigo-100 hover:shadow-xs'}`}>
                          <div className="flex flex-col items-center justify-center w-16 py-1.5 bg-white rounded-xl border border-slate-100 shadow-xs">
                            <span className={`text-[11px] font-black ${isCurrent ? 'text-indigo-600' : 'text-slate-500'}`}>{a.start_time.substring(0, 5)}</span>
                            <div className={`w-0.5 h-3 my-0.5 rounded-full ${isCurrent ? 'bg-indigo-500' : 'bg-slate-200'}`} />
                            <span className="text-[10px] font-bold text-slate-400">{a.end_time.substring(0, 5)}</span>
                          </div>
                          <div className="ml-4 flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className={`text-sm font-black tracking-tight truncate ${isCurrent ? 'text-indigo-950' : 'text-slate-900'}`}>{a.subject_name}</p>
                              {isCurrent && (
                                <span className="px-2 py-0.5 bg-indigo-600 text-white text-[8px] font-black rounded-md uppercase tracking-wider animate-pulse shrink-0">En cours</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-1 text-slate-400">
                              <Users size={12} />
                              <p className="text-xs text-slate-600 font-semibold">{a.class_name}</p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1.5 ml-3">
                            <div className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${isCurrent ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>
                              {a.duration_hours}h
                            </div>
                            {isCurrent && (
                              <Link to="/enseignant/pointage" className="text-[10px] font-black text-indigo-600 hover:underline flex items-center gap-0.5">
                                Signer <ChevronRight size={10} />
                              </Link>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  {teacherStats.assignments.filter(a => a.day_of_week === ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'][new Date().getDay()]).length === 0 && (
                    <div className="py-12 text-center">
                      <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-slate-100 text-slate-400">
                        <Calendar size={22} />
                      </div>
                      <p className="text-xs font-bold text-slate-700">Aucun cours prévu pour aujourd'hui.</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Profitez de votre journée !</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-slate-100 text-slate-400">
                    <Activity size={22} />
                  </div>
                  <p className="text-xs font-bold text-slate-500">Aucune affectation trouvée.</p>
                </div>
              )}
            </div>

            <div className="bg-white rounded-3xl shadow-xs border border-slate-100/90 p-6 md:p-8">
              <h3 className="text-base font-black text-slate-900 mb-6">Actions Rapides</h3>
              <div className="space-y-3">
                <Link to="/enseignant/pointage" className="flex items-center p-3.5 rounded-2xl bg-white border border-slate-100 hover:border-blue-200 hover:bg-blue-50/30 transition-all group shadow-xs">
                  <div className="p-2.5 bg-blue-50 rounded-xl text-blue-600 group-hover:scale-105 transition-transform">
                    <PenTool size={18} />
                  </div>
                  <div className="ml-3.5">
                    <p className="text-xs font-bold text-slate-900">Signer ma Séance</p>
                    <p className="text-[10px] text-slate-400">Cahier de texte & Présences</p>
                  </div>
                  <ChevronRight size={16} className="ml-auto text-slate-300 group-hover:text-blue-500 transition-colors" />
                </Link>
                <Link to="/notes" className="flex items-center p-3.5 rounded-2xl bg-white border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/30 transition-all group shadow-xs">
                  <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-600 group-hover:scale-105 transition-transform">
                    <TrendingUp size={18} />
                  </div>
                  <div className="ml-3.5">
                    <p className="text-xs font-bold text-slate-900">Saisie des Notes</p>
                    <p className="text-[10px] text-slate-400">Gérer les évaluations</p>
                  </div>
                  <ChevronRight size={16} className="ml-auto text-slate-300 group-hover:text-emerald-500 transition-colors" />
                </Link>
                <Link to="/horaire" className="flex items-center p-3.5 rounded-2xl bg-white border border-slate-100 hover:border-amber-200 hover:bg-amber-50/30 transition-all group shadow-xs">
                  <div className="p-2.5 bg-amber-50 rounded-xl text-amber-600 group-hover:scale-105 transition-transform">
                    <Calendar size={18} />
                  </div>
                  <div className="ml-3.5">
                    <p className="text-xs font-bold text-slate-900">Mon Horaire</p>
                    <p className="text-[10px] text-slate-400">Planning hebdomadaire</p>
                  </div>
                  <ChevronRight size={16} className="ml-auto text-slate-300 group-hover:text-amber-500 transition-colors" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      ) : user.role === UserRole.STUDENT ? (
        <div className="space-y-8 animate-in fade-in duration-500">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-100/90 flex flex-col justify-between hover:shadow-md hover:border-blue-100 transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Ma {terminology.class}</span>
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-2xl shadow-xs border border-blue-100/50">
                  <GraduationCap size={18} />
                </div>
              </div>
              <div>
                <p className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">{studentStats.className}</p>
                <p className="mt-2 text-xs font-semibold text-slate-400">Année académique active</p>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-100/90 flex flex-col justify-between hover:shadow-md hover:border-emerald-100 transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Ma Moyenne</span>
                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl shadow-xs border border-emerald-100/50">
                  <TrendingUp size={18} />
                </div>
              </div>
              <div>
                <p className="text-3xl lg:text-4xl font-black text-slate-900 tracking-tight">{studentStats.averageGrade || '--'}</p>
                <p className="mt-2 text-xs font-semibold text-slate-400">Dernier relevé périodique</p>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-100/90 flex flex-col justify-between hover:shadow-md hover:border-amber-100 transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Total Versé</span>
                <div className="p-2.5 bg-amber-50 text-amber-600 rounded-2xl shadow-xs border border-amber-100/50">
                  <Receipt size={18} />
                </div>
              </div>
              <div>
                <p className="text-2xl lg:text-3xl font-black text-amber-600 tracking-tight">{studentStats.totalPaid.toLocaleString()} HTG</p>
                <p className={`mt-2 text-xs font-bold flex items-center gap-1.5 ${studentStats.globalDebt <= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                  <span className="h-2 w-2 rounded-full bg-current"></span>
                  {studentStats.globalDebt <= 0 ? 'Compte scolarité en règle' : `Solde restant : ${studentStats.globalDebt.toLocaleString()} HTG`}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-xs border border-slate-100/90 overflow-hidden mt-8">
            <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl shadow-xs border border-indigo-100/50">
                  <Wallet size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 tracking-tight">Mon Portefeuille & Situation Économique</h3>
                  <p className="text-xs text-slate-400 font-medium">Détails précis de mes contributions, scolarités et frais de campagnes</p>
                </div>
              </div>
              <Link
                to="/mon-economat"
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-white hover:bg-indigo-50 border border-slate-200/80 px-4 py-2 rounded-xl transition-all shadow-xs flex items-center gap-1.5 shrink-0 self-start sm:self-auto"
              >
                Gérer mes reçus <ChevronRight size={14} />
              </Link>
            </div>
            
            <div className="p-6 lg:p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Admission / Inscription block */}
                <div className="bg-slate-50/70 rounded-2xl p-5 border border-slate-100 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200/70 pb-2.5">
                    <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-700">Frais d'Admission</h4>
                    <span className="text-[9px] font-black uppercase bg-emerald-100/70 text-emerald-700 px-2 py-0.5 rounded-md">Obligatoire</span>
                  </div>
                  
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500 font-medium">Frais Exigés</span>
                      <span className="font-bold text-slate-800">{studentStats.admissionExpected?.toLocaleString()} HTG</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500 font-medium">Montant Versé</span>
                      <span className="font-bold text-emerald-600">+{studentStats.admissionPaid?.toLocaleString()} HTG</span>
                    </div>
                    <div className="border-t border-slate-200/70 pt-2.5 flex justify-between items-center text-xs">
                      <span className="text-slate-700 font-bold">Reste à payer</span>
                      <span className={`font-black ${studentStats.admissionBalance <= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                        {studentStats.admissionBalance <= 0 ? 'Réglé' : `${studentStats.admissionBalance?.toLocaleString()} HTG`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Tuition Details block */}
                <div className="bg-slate-50/70 rounded-2xl p-5 border border-slate-100 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200/70 pb-2.5">
                    <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-700">Écolage (Scolarité)</h4>
                    <span className="text-[9px] font-black uppercase bg-indigo-100/70 text-indigo-700 px-2 py-0.5 rounded-md">Scolarité</span>
                  </div>
                  
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500 font-medium">Frais Exigés</span>
                      <span className="font-bold text-slate-800">{studentStats.tuitionExpected?.toLocaleString()} HTG</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500 font-medium">Montant Versé</span>
                      <span className="font-bold text-emerald-600">+{studentStats.tuitionPaid?.toLocaleString()} HTG</span>
                    </div>
                    {studentStats.discountAmount > 0 && (
                      <div className="flex justify-between items-center text-[11px] text-emerald-700 bg-emerald-50 p-2 rounded-lg border border-emerald-100">
                        <span className="font-medium">Réduction</span>
                        <span className="font-black">-{studentStats.discountAmount.toLocaleString()} HTG</span>
                      </div>
                    )}
                    <div className="border-t border-slate-200/70 pt-2.5 flex justify-between items-center text-xs">
                      <span className="text-slate-700 font-bold">Reste à payer</span>
                      <span className={`font-black ${studentStats.tuitionBalance <= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                        {studentStats.tuitionBalance <= 0 ? 'Réglé' : `${studentStats.tuitionBalance?.toLocaleString()} HTG`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Campaigns Details block */}
                <div className="bg-slate-50/70 rounded-2xl p-5 border border-slate-100 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200/70 pb-2.5">
                    <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-700">Campagnes & Activités</h4>
                    <span className="text-[9px] font-black uppercase bg-amber-100/70 text-amber-700 px-2 py-0.5 rounded-md">Occasionnel</span>
                  </div>
                  
                  {studentStats.hasCampaigns ? (
                    <div className="space-y-2.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500 font-medium">Frais Exigés</span>
                        <span className="font-bold text-slate-800">{studentStats.campaignsExpected?.toLocaleString()} HTG</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500 font-medium">Montant Versé</span>
                        <span className="font-bold text-emerald-600">+{studentStats.campaignsPaid?.toLocaleString()} HTG</span>
                      </div>
                      <div className="border-t border-slate-200/70 pt-2.5 flex justify-between items-center text-xs">
                        <span className="text-slate-700 font-bold">Reste à payer</span>
                        <span className={`font-black ${studentStats.campaignsBalance <= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                          {studentStats.campaignsBalance <= 0 ? 'Réglé' : `${studentStats.campaignsBalance?.toLocaleString()} HTG`}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center py-5 space-y-1.5">
                      <Layers size={28} className="text-slate-300" />
                      <p className="text-[11px] text-slate-400 font-medium max-w-[200px]">Aucune campagne assignée</p>
                    </div>
                  )}
                </div>

                {/* Wallet block */}
                <div className="bg-slate-50/70 rounded-2xl p-5 border border-slate-100 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200/70 pb-2.5">
                    <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-700">Portefeuille</h4>
                    <span className="text-[9px] font-black uppercase bg-cyan-100/70 text-cyan-700 px-2 py-0.5 rounded-md">Fonds</span>
                  </div>
                  
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500 font-medium">Solde HTG</span>
                      <span className="font-black text-cyan-700">{studentStats.wallet_balance_htg?.toLocaleString()} HTG</span>
                    </div>
                    <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-100">
                      <span className="text-slate-500 font-medium">Solde USD</span>
                      <span className="font-black text-cyan-700">{studentStats.wallet_balance_usd?.toLocaleString()} USD</span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium pt-1">Disponible pour futurs règlements</p>
                  </div>
                </div>
              </div>

              {/* General Summary row */}
              <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-sm relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="space-y-1 text-center md:text-left z-10">
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300">Bilan Financier Global</span>
                  <p className="text-xl font-black">Récapitulatif de toutes les contributions</p>
                  <p className="text-xs text-slate-400 font-medium">Statut global des comptes de l'étudiant</p>
                </div>

                <div className="grid grid-cols-3 gap-3 text-center shrink-0 w-full md:w-auto z-10">
                  <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700/60">
                    <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Dû</span>
                    <span className="text-sm md:text-base font-black">{studentStats.totalDue.toLocaleString()} G</span>
                  </div>
                  <div className="bg-slate-800/80 p-3 rounded-2xl border border-emerald-500/40">
                    <span className="block text-[9px] font-black text-emerald-400 uppercase tracking-widest">Recueilli</span>
                    <span className="text-sm md:text-base font-black text-emerald-400">+{studentStats.totalPaid.toLocaleString()} G</span>
                  </div>
                  <div className={`p-3 rounded-2xl border ${studentStats.globalDebt <= 0 ? 'bg-slate-800/80 border-emerald-500/40' : 'bg-rose-950/40 border-rose-500/40'}`}>
                    <span className="block text-[9px] font-black text-slate-300 uppercase tracking-widest">Reste</span>
                    <span className={`text-sm md:text-base font-black ${studentStats.globalDebt <= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                      {studentStats.globalDebt <= 0 ? 'À jour' : `${studentStats.globalDebt.toLocaleString()} G`}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : user.role === UserRole.PARENT ? (
        <div className="space-y-8 animate-in fade-in duration-500">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-100/90 flex flex-col justify-between hover:shadow-md hover:border-blue-100 transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Mes Enfants</span>
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-2xl shadow-xs border border-blue-100/50">
                  <Baby size={18} />
                </div>
              </div>
              <div>
                <p className="text-3xl lg:text-4xl font-black text-slate-900 tracking-tight">{parentStats.childrenCount}</p>
                <p className="mt-2 text-xs font-semibold text-slate-400">{terminology.students} inscrits</p>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-100/90 flex flex-col justify-between hover:shadow-md hover:border-emerald-100 transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Total Payé</span>
                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl shadow-xs border border-emerald-100/50">
                  <Coins size={18} />
                </div>
              </div>
              <div>
                <p className="text-3xl lg:text-4xl font-black text-slate-900 tracking-tight">{parentStats.totalPaid.toLocaleString()} G</p>
                <p className="mt-2 text-xs font-semibold text-slate-400">Année académique en cours</p>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-100/90 flex flex-col justify-between hover:shadow-md hover:border-rose-100 transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Solde Restant</span>
                <div className="p-2.5 bg-rose-50 text-rose-600 rounded-2xl shadow-xs border border-rose-100/50">
                  <TrendingDown size={18} />
                </div>
              </div>
              <div>
                <p className="text-3xl lg:text-4xl font-black text-rose-600 tracking-tight">{parentStats.totalDue.toLocaleString()} G</p>
                <p className="mt-2 text-xs font-semibold text-slate-400">À régulariser</p>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-100/90 flex flex-col justify-between hover:shadow-md hover:border-amber-100 transition-all duration-300 cursor-pointer" onClick={() => navigate('/economat/factures')}>
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Dernier Reçu</span>
                <div className="p-2.5 bg-amber-50 text-amber-600 rounded-2xl shadow-xs border border-amber-100/50">
                  <Receipt size={18} />
                </div>
              </div>
              <div>
                <p className="text-sm font-black text-slate-900 tracking-tight">Consulter Historique</p>
                <p className="mt-1 text-xs text-indigo-600 font-bold flex items-center gap-1">Voir mes reçus <ChevronRight size={12} /></p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-3xl shadow-xs border border-slate-100/90 p-6 md:p-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-base font-black text-slate-900 tracking-tight">Suivi Scolaire des Enfants</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Progression académique et situation financière par élève</p>
                </div>
              </div>
              <div className="space-y-3">
                {parentStats.children.map((child, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50/60 border border-slate-100 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-10 h-10 bg-indigo-50 text-indigo-700 rounded-xl flex items-center justify-center font-black text-sm border border-indigo-100/60 shadow-xs shrink-0">
                        {child.first_name[0]}{child.last_name[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-black text-slate-900 truncate">{formatStudentName(child.last_name, child.first_name).fullName}</p>
                        <p className="text-xs text-slate-400 font-medium">{child.class?.name || 'Non assigné'}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0 ml-3">
                      <button 
                        onClick={() => navigate('/economat/suivi', { state: { studentId: child.id } })}
                        className="px-3 py-1.5 bg-white border border-slate-200/80 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-xs transition-all"
                      >
                        Paiements
                      </button>
                      <button 
                        onClick={() => navigate(`/eleves/modifier/${child.id}`)}
                        className="px-3 py-1.5 bg-indigo-50 border border-indigo-100 rounded-xl text-xs font-bold text-indigo-700 hover:bg-indigo-100 shadow-xs transition-all"
                      >
                        Détails
                      </button>
                    </div>
                  </div>
                ))}
                {parentStats.children.length === 0 && (
                  <div className="py-12 text-center">
                    <Users className="mx-auto text-slate-300 mb-2" size={28} />
                    <p className="text-xs font-bold text-slate-500">Aucun enfant trouvé associé à votre compte.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-3xl shadow-xs border border-slate-100/90 p-6 md:p-8">
              <h3 className="text-base font-black text-slate-900 mb-6">Espace Parent</h3>
              <div className="space-y-3">
                <Link to="/economat/factures" className="flex items-center p-3.5 rounded-2xl hover:bg-amber-50/40 border border-slate-100 transition-all group shadow-xs">
                  <div className="p-2.5 bg-amber-50 rounded-xl text-amber-600 group-hover:scale-105 transition-transform">
                    <Receipt size={18} />
                  </div>
                  <div className="ml-3">
                    <p className="text-xs font-bold text-slate-900">Mes Factures & Reçus</p>
                    <p className="text-[10px] text-slate-400">Historique des versements</p>
                  </div>
                  <ChevronRight size={16} className="ml-auto text-slate-300 group-hover:text-amber-500 transition-colors" />
                </Link>
                <Link to="/horaire" className="flex items-center p-3.5 rounded-2xl hover:bg-blue-50/40 border border-slate-100 transition-all group shadow-xs">
                  <div className="p-2.5 bg-blue-50 rounded-xl text-blue-600 group-hover:scale-105 transition-transform">
                    <Calendar size={18} />
                  </div>
                  <div className="ml-3">
                    <p className="text-xs font-bold text-slate-900">Horaires des Cours</p>
                    <p className="text-[10px] text-slate-400">Emploi du temps des classes</p>
                  </div>
                  <ChevronRight size={16} className="ml-auto text-slate-300 group-hover:text-blue-500 transition-colors" />
                </Link>
                <Link to="/messages" className="flex items-center p-3.5 rounded-2xl hover:bg-purple-50/40 border border-slate-100 transition-all group shadow-xs">
                  <div className="p-2.5 bg-purple-50 rounded-xl text-purple-600 group-hover:scale-105 transition-transform">
                    <Info size={18} />
                  </div>
                  <div className="ml-3">
                    <p className="text-xs font-bold text-slate-900">Contacter l'École</p>
                    <p className="text-[10px] text-slate-400">Secrétariat & Direction</p>
                  </div>
                  <ChevronRight size={16} className="ml-auto text-slate-300 group-hover:text-purple-500 transition-colors" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      ) : user.role === UserRole.SECRETARY ? (
        <SecretaryDashboardView 
          user={user}
          stats={stats}
          directorStats={directorStats}
          terminology={terminology}
          academicYears={academicYears}
        />
      ) : (
        <div className="space-y-8 animate-in fade-in duration-500">
          <div className={`grid grid-cols-1 md:grid-cols-2 ${academicYears.some(y => y.status === 'FUTURE') ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-5`}>
            {/* Card 1: Total Students */}
            <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-100/90 flex flex-col justify-between hover:shadow-md hover:border-blue-100 transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">{terminology.students} Inscrits</span>
                <div className="p-2.5 bg-blue-50 rounded-2xl text-blue-600 shadow-xs border border-blue-100/50">
                  <Users size={18} />
                </div>
              </div>
              <div>
                <p className="text-3xl lg:text-4xl font-black text-slate-900 tracking-tight">
                  {stats.totalStudents}
                </p>
                <p className="mt-2 text-xs font-semibold text-slate-400">Année active</p>
              </div>
            </div>

            {/* Card 2: Today's Enrollments */}
            <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-100/90 flex flex-col justify-between hover:shadow-md hover:border-emerald-100 transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Inscriptions du Jour</span>
                <div className="p-2.5 bg-emerald-50 rounded-2xl text-emerald-600 shadow-xs border border-emerald-100/50">
                  <UserPlus size={18} />
                </div>
              </div>
              <div>
                <p className="text-3xl lg:text-4xl font-black text-slate-900 tracking-tight">
                  {stats.todayEnrollments}
                </p>
                <p className="mt-2 text-xs font-semibold text-slate-400">Nouveaux dossiers</p>
              </div>
            </div>

            {/* Card 3: Today's Payments */}
            <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-100/90 flex flex-col justify-between hover:shadow-md hover:border-amber-100 transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Paiements du Jour</span>
                <div className="p-2.5 bg-amber-50 rounded-2xl text-amber-600 shadow-xs border border-amber-100/50">
                  <Receipt size={18} />
                </div>
              </div>
              <div>
                <p className="text-3xl lg:text-4xl font-black text-slate-900 tracking-tight">
                  {stats.todayPaymentsCount}
                </p>
                <p className="mt-2 text-xs font-semibold text-slate-400">Reçus émis aujourd'hui</p>
              </div>
            </div>

            {/* Card 4: Pre-inscriptions (Affiché uniquement si une session en préparation/future existe) */}
            {academicYears.some(y => y.status === 'FUTURE') && (
              <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-100/90 flex flex-col justify-between hover:shadow-md hover:border-indigo-100 transition-all duration-300">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Pré-inscriptions</span>
                  <div className="p-2.5 bg-indigo-50 rounded-2xl text-indigo-600 shadow-xs border border-indigo-100/50">
                    <Sparkles size={18} />
                  </div>
                </div>
                <div>
                  <p className="text-3xl lg:text-4xl font-black text-slate-900 tracking-tight">
                    {stats.preInscriptions}
                  </p>
                  <p className="mt-2 text-xs font-semibold text-slate-400">
                    Session {academicYears.find(y => y.status === 'FUTURE')?.label || 'à venir'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Quick Actions & Shortcuts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Quick Actions */}
            <div className="bg-white rounded-3xl shadow-xs border border-slate-100/90 p-6 md:p-8 flex flex-col">
              <h3 className="text-base font-black text-slate-900 mb-6">Actions Rapides</h3>
              <div className="space-y-3">
                {[UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.DIRECTOR, UserRole.SECRETARY].includes(user.role) && (
                <Link to="/eleves/ajouter" className="flex items-center p-3.5 rounded-2xl hover:bg-blue-50/40 border border-slate-100 transition-all group shadow-xs">
                  <div className="p-2.5 bg-blue-50 rounded-xl text-blue-600 group-hover:scale-105 transition-colors shrink-0">
                    <UserPlus size={18} />
                  </div>
                  <div className="ml-3 min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-900 truncate">Créer dossier</p>
                    <p className="text-[10px] text-slate-400 truncate">Nouveau {terminology.student.toLowerCase()}</p>
                  </div>
                  <ChevronRight size={16} className="ml-auto text-slate-300 group-hover:text-blue-500 shrink-0" />
                </Link>
                )}
                
                {[UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.DIRECTOR, UserRole.ACCOUNTANT, UserRole.SECRETARY].includes(user.role) && (
                <Link to="/economat/frais" className="flex items-center p-3.5 rounded-2xl hover:bg-emerald-50/40 border border-slate-100 transition-all group shadow-xs">
                  <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-600 group-hover:scale-105 transition-colors shrink-0">
                    <Receipt size={18} />
                  </div>
                  <div className="ml-3 min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-900 truncate">Nouveau Paiement</p>
                    <p className="text-[10px] text-slate-400 truncate">Encaisser des frais</p>
                  </div>
                  <ChevronRight size={16} className="ml-auto text-slate-300 group-hover:text-emerald-500 shrink-0" />
                </Link>
                )}

                {[UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.DIRECTOR, UserRole.ACCOUNTANT, UserRole.SECRETARY].includes(user.role) && (
                <Link to="/economat/fournitures" className="flex items-center p-3.5 rounded-2xl hover:bg-purple-50/40 border border-slate-100 transition-all group shadow-xs">
                  <div className="p-2.5 bg-purple-50 rounded-xl text-purple-600 group-hover:scale-105 transition-colors shrink-0">
                    <ShoppingCart size={18} />
                  </div>
                  <div className="ml-3 min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-900 truncate">Vente Fournitures</p>
                    <p className="text-[10px] text-slate-400 truncate">Boutique & Articles</p>
                  </div>
                  <ChevronRight size={16} className="ml-auto text-slate-300 group-hover:text-purple-500 shrink-0" />
                </Link>
                )}

                {[UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.DIRECTOR, UserRole.SECRETARY, UserRole.SUPERVISOR].includes(user.role) && isPresencesEnabled && (
                  <Link to="/presences" className="flex items-center p-3.5 rounded-2xl hover:bg-amber-50/40 border border-slate-100 transition-all group shadow-xs">
                    <div className="p-2.5 bg-amber-50 rounded-xl text-amber-600 group-hover:scale-105 transition-colors shrink-0">
                      <ClipboardCheck size={18} />
                    </div>
                    <div className="ml-3 min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-900 truncate">Présences Staff</p>
                      <p className="text-[10px] text-slate-400 truncate">Pointer arrivées</p>
                    </div>
                    <ChevronRight size={16} className="ml-auto text-slate-300 group-hover:text-amber-500 shrink-0" />
                  </Link>
                )}

                {[UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.DIRECTOR].includes(user.role) && (
                <Link to="/communication/email" className="flex items-center p-3.5 rounded-2xl hover:bg-indigo-50/40 border border-slate-100 transition-all group shadow-xs">
                  <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-600 group-hover:scale-105 transition-colors shrink-0">
                    <MessageSquare size={18} />
                  </div>
                  <div className="ml-3 min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-900 truncate">Communication</p>
                    <p className="text-[10px] text-slate-400 truncate">Envoyer message</p>
                  </div>
                  <ChevronRight size={16} className="ml-auto text-slate-300 group-hover:text-indigo-500 shrink-0" />
                </Link>
                )}

                {[UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.DIRECTOR, UserRole.ACCOUNTANT].includes(user.role) && (
                <Link to="/economat/paie" className="flex items-center p-3.5 rounded-2xl hover:bg-rose-50/40 border border-slate-100 transition-all group shadow-xs">
                  <div className="p-2.5 bg-rose-50 rounded-xl text-rose-600 group-hover:scale-105 transition-colors shrink-0">
                    <HandCoins size={18} />
                  </div>
                  <div className="ml-3 min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-900 truncate">Avances Payroll</p>
                    <p className="text-[10px] text-slate-400 truncate">Demandes d'avances</p>
                  </div>
                  <ChevronRight size={16} className="ml-auto text-slate-300 group-hover:text-rose-500 shrink-0" />
                </Link>
                )}
              </div>
            </div>

            {/* Shortcuts */}
            <div className="lg:col-span-2 bg-white rounded-3xl shadow-xs border border-slate-100/90 p-6 md:p-8 flex flex-col">
              <h3 className="text-base font-black text-slate-900 mb-6">Raccourcis Utiles</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.DIRECTOR, UserRole.SECRETARY, UserRole.SUPERVISOR].includes(user.role) && (
                <Link to="/eleves" className="p-4 rounded-2xl border border-slate-100 bg-slate-50/40 hover:bg-white hover:border-blue-200 hover:shadow-xs transition-all flex flex-col items-center justify-center text-center gap-3 group">
                  <div className="p-3 bg-blue-50 rounded-2xl text-blue-600 group-hover:scale-110 transition-transform shadow-xs">
                    <Users size={22} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">{terminology.students}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Registre complet</p>
                  </div>
                </Link>
                )}

                {[UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.DIRECTOR, UserRole.ACCOUNTANT, UserRole.SECRETARY].includes(user.role) && (
                <Link to="/economat/suivi" className="p-4 rounded-2xl border border-slate-100 bg-slate-50/40 hover:bg-white hover:border-indigo-200 hover:shadow-xs transition-all flex flex-col items-center justify-center text-center gap-3 group">
                  <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600 group-hover:scale-110 transition-transform shadow-xs">
                    <Activity size={22} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">Suivi Paiements</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">État des comptes</p>
                  </div>
                </Link>
                )}

                <Link to="/horaire" className="p-4 rounded-2xl border border-slate-100 bg-slate-50/40 hover:bg-white hover:border-amber-200 hover:shadow-xs transition-all flex flex-col items-center justify-center text-center gap-3 group">
                  <div className="p-3 bg-amber-50 rounded-2xl text-amber-600 group-hover:scale-110 transition-transform shadow-xs">
                    <Calendar size={22} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">Horaire</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Emploi du temps</p>
                  </div>
                </Link>

                <Link to="/economat/factures" className="p-4 rounded-2xl border border-slate-100 bg-slate-50/40 hover:bg-white hover:border-rose-200 hover:shadow-xs transition-all flex flex-col items-center justify-center text-center gap-3 group">
                  <div className="p-3 bg-rose-50 rounded-2xl text-rose-600 group-hover:scale-110 transition-transform shadow-xs">
                    <Receipt size={22} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">Factures</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Reçus émis</p>
                  </div>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {canViewFinances && (
        <>
          {(user.role === UserRole.SUPER_ADMIN || user.is_super_admin || user.role === UserRole.SCHOOL_ADMIN || user.role === UserRole.DIRECTOR) ? (
            /* Raccourcis d'Accès Rapide pour Admins & Directeurs */
            <div className="bg-white rounded-3xl shadow-xs border border-slate-100/90 p-6 md:p-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-base font-black text-slate-900 tracking-tight">Raccourcis d'Accès Rapide</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Actions prioritaires pour la gestion de l'établissement</p>
                </div>
                <div className="bg-indigo-50/70 border border-indigo-100/80 rounded-2xl px-4 py-2 flex items-center gap-3 w-full sm:w-auto shadow-xs">
                  <div className="p-1.5 bg-white rounded-xl shadow-xs shrink-0 text-indigo-600">
                    <UserPlus size={16} />
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-wider text-indigo-500">Nouveaux dossiers</p>
                    <p className="text-sm font-black text-indigo-950 leading-none">{stats.todayEnrollments} <span className="text-[10px] font-bold text-indigo-400 lowercase">aujourd'hui</span></p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5">
                <Link to="/eleves/ajouter" className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100/80 hover:bg-white hover:border-indigo-300 hover:shadow-xs transition-all flex flex-col items-center justify-center text-center gap-2.5 group">
                  <div className="p-3 bg-white rounded-2xl text-indigo-600 group-hover:scale-110 transition-transform shadow-xs border border-indigo-50">
                    <UserPlus size={22} />
                  </div>
                  <span className="text-xs font-bold text-slate-900">{terminology.enrollments}</span>
                </Link>
                
                <Link to="/economat/frais" className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100/80 hover:bg-white hover:border-emerald-300 hover:shadow-xs transition-all flex flex-col items-center justify-center text-center gap-2.5 group">
                  <div className="p-3 bg-white rounded-2xl text-emerald-600 group-hover:scale-110 transition-transform shadow-xs border border-emerald-50">
                    <Wallet size={22} />
                  </div>
                  <span className="text-xs font-bold text-slate-900">Paiements</span>
                </Link>

                <Link to="/settings/utilisateurs" className="p-4 rounded-2xl bg-cyan-50/50 border border-cyan-100/80 hover:bg-white hover:border-cyan-300 hover:shadow-xs transition-all flex flex-col items-center justify-center text-center gap-2.5 group">
                  <div className="p-3 bg-white rounded-2xl text-cyan-600 group-hover:scale-110 transition-transform shadow-xs border border-cyan-50">
                    <UserCog size={22} />
                  </div>
                  <span className="text-xs font-bold text-slate-900">Utilisateurs</span>
                </Link>

                <Link to="/classes" className="p-4 rounded-2xl bg-teal-50/50 border border-teal-100/80 hover:bg-white hover:border-teal-300 hover:shadow-xs transition-all flex flex-col items-center justify-center text-center gap-2.5 group">
                  <div className="p-3 bg-white rounded-2xl text-teal-600 group-hover:scale-110 transition-transform shadow-xs border border-teal-50">
                    <Layers size={22} />
                  </div>
                  <span className="text-xs font-bold text-slate-900">{terminology.options}</span>
                </Link>

                <Link to="/horaire" className="p-4 rounded-2xl bg-blue-50/50 border border-blue-100/80 hover:bg-white hover:border-blue-300 hover:shadow-xs transition-all flex flex-col items-center justify-center text-center gap-2.5 group">
                  <div className="p-3 bg-white rounded-2xl text-blue-600 group-hover:scale-110 transition-transform shadow-xs border border-blue-50">
                    <Calendar size={22} />
                  </div>
                  <span className="text-xs font-bold text-slate-900">Horaires</span>
                </Link>

                <Link to="/economat/factures" className="p-4 rounded-2xl bg-purple-50/50 border border-purple-100/80 hover:bg-white hover:border-purple-300 hover:shadow-xs transition-all flex flex-col items-center justify-center text-center gap-2.5 group">
                  <div className="p-3 bg-white rounded-2xl text-purple-600 group-hover:scale-110 transition-transform shadow-xs border border-purple-50">
                    <Receipt size={22} />
                  </div>
                  <span className="text-xs font-bold text-slate-900">Factures</span>
                </Link>

                <Link to="/rapports" className="p-4 rounded-2xl bg-amber-50/50 border border-amber-100/80 hover:bg-white hover:border-amber-300 hover:shadow-xs transition-all flex flex-col items-center justify-center text-center gap-2.5 group">
                  <div className="p-3 bg-white rounded-2xl text-amber-600 group-hover:scale-110 transition-transform shadow-xs border border-amber-50">
                    <BarChart3 size={22} />
                  </div>
                  <span className="text-xs font-bold text-slate-900">Rapports</span>
                </Link>

                <Link to="/personnel" className="p-4 rounded-2xl bg-violet-50/50 border border-violet-100/80 hover:bg-white hover:border-violet-300 hover:shadow-xs transition-all flex flex-col items-center justify-center text-center gap-2.5 group">
                  <div className="p-3 bg-white rounded-2xl text-violet-600 group-hover:scale-110 transition-transform shadow-xs border border-violet-50">
                    <Users size={22} />
                  </div>
                  <span className="text-xs font-bold text-slate-900">Personnel</span>
                </Link>

                <Link to="/settings/audit" className="p-4 rounded-2xl bg-rose-50/50 border border-rose-100/80 hover:bg-white hover:border-rose-300 hover:shadow-xs transition-all flex flex-col items-center justify-center text-center gap-2.5 group">
                  <div className="p-3 bg-white rounded-2xl text-rose-600 group-hover:scale-110 transition-transform shadow-xs border border-rose-50">
                    <ShieldCheck size={22} />
                  </div>
                  <span className="text-xs font-bold text-slate-900">Journal Audit</span>
                </Link>

                {(user.role === UserRole.SUPER_ADMIN || user.is_super_admin) ? (
                  <Link to="/super-admin" className="p-4 rounded-2xl bg-amber-50/50 border border-amber-100/80 hover:bg-white hover:border-amber-300 hover:shadow-xs transition-all flex flex-col items-center justify-center text-center gap-2.5 group">
                    <div className="p-3 bg-white rounded-2xl text-amber-600 group-hover:scale-110 transition-transform shadow-xs border border-amber-50">
                      <School size={22} />
                    </div>
                    <span className="text-xs font-bold text-slate-900">Gestion Écoles</span>
                  </Link>
                ) : (
                  <Link to="/settings/ecole" className="p-4 rounded-2xl bg-slate-50/50 border border-slate-200/70 hover:bg-white hover:border-slate-300 hover:shadow-xs transition-all flex flex-col items-center justify-center text-center gap-2.5 group">
                    <div className="p-3 bg-white rounded-2xl text-slate-600 group-hover:scale-110 transition-transform shadow-xs border border-slate-100">
                      <Settings size={22} />
                    </div>
                    <span className="text-xs font-bold text-slate-900">Paramètres</span>
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Raccourcis Comptables */}
              <div className="bg-white rounded-3xl shadow-xs border border-slate-100/90 p-6 md:p-8">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-base font-black text-slate-900 tracking-tight">Raccourcis Comptables</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Actions prioritaires pour la gestion financière</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
                  <Link to="/economat/frais" className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100/80 hover:bg-white hover:border-emerald-300 hover:shadow-xs transition-all flex flex-col items-center justify-center text-center gap-2.5 group">
                    <div className="p-3 bg-white rounded-2xl text-emerald-600 group-hover:scale-110 transition-transform shadow-xs border border-emerald-50">
                      <Coins size={22} />
                    </div>
                    <span className="text-xs font-bold text-slate-900">Encaisser</span>
                  </Link>
                  <Link to="/economat/liste" className="p-4 rounded-2xl bg-blue-50/50 border border-blue-100/80 hover:bg-white hover:border-blue-300 hover:shadow-xs transition-all flex flex-col items-center justify-center text-center gap-2.5 group">
                    <div className="p-3 bg-white rounded-2xl text-blue-600 group-hover:scale-110 transition-transform shadow-xs border border-blue-50">
                      <Receipt size={22} />
                    </div>
                    <span className="text-xs font-bold text-slate-900">Paiements</span>
                  </Link>
                  <Link to="/economat/depenses" className="p-4 rounded-2xl bg-rose-50/50 border border-rose-100/80 hover:bg-white hover:border-rose-300 hover:shadow-xs transition-all flex flex-col items-center justify-center text-center gap-2.5 group">
                    <div className="p-3 bg-white rounded-2xl text-rose-600 group-hover:scale-110 transition-transform shadow-xs border border-rose-50">
                      <TrendingDown size={22} />
                    </div>
                    <span className="text-xs font-bold text-slate-900">Dépenses</span>
                  </Link>
                  <Link to="/economat/paie" className="p-4 rounded-2xl bg-violet-50/50 border border-violet-100/80 hover:bg-white hover:border-violet-300 hover:shadow-xs transition-all flex flex-col items-center justify-center text-center gap-2.5 group">
                    <div className="p-3 bg-white rounded-2xl text-violet-600 group-hover:scale-110 transition-transform shadow-xs border border-violet-50">
                      <Wallet size={22} />
                    </div>
                    <span className="text-xs font-bold text-slate-900">Salaires</span>
                  </Link>
                  <Link to="/economat/suivi" className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100/80 hover:bg-white hover:border-indigo-300 hover:shadow-xs transition-all flex flex-col items-center justify-center text-center gap-2.5 group">
                    <div className="p-3 bg-white rounded-2xl text-indigo-600 group-hover:scale-110 transition-transform shadow-xs border border-indigo-50">
                      <Activity size={22} />
                    </div>
                    <span className="text-xs font-bold text-slate-900">Suivi</span>
                  </Link>
                  <Link to="/rapports" className="p-4 rounded-2xl bg-amber-50/50 border border-amber-100/80 hover:bg-white hover:border-amber-300 hover:shadow-xs transition-all flex flex-col items-center justify-center text-center gap-2.5 group">
                    <div className="p-3 bg-white rounded-2xl text-amber-600 group-hover:scale-110 transition-transform shadow-xs border border-amber-50">
                      <BarChart3 size={22} />
                    </div>
                    <span className="text-xs font-bold text-slate-900">Rapports</span>
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Derniers Encaissements */}
                <div className="bg-white rounded-3xl shadow-xs border border-slate-100/90 p-6 md:p-8">
                  <h3 className="text-base font-black text-slate-900 tracking-tight mb-6">Derniers Encaissements</h3>
                  <div className="space-y-3">
                    {directorStats.recentPayments.map((p, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50/40 border border-slate-100/80 hover:bg-white hover:border-slate-200 transition-all shadow-xs">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0 border border-emerald-100/50">
                            <ArrowUpRight size={18} />
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-xs text-slate-900 block truncate">{formatStudentName(p.students?.last_name, p.students?.first_name).fullName}</span>
                            <span className="text-[10px] font-medium text-slate-400 block">{new Date(p.created_at).toLocaleDateString()} • {new Date(p.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0 pl-3">
                          <p className="font-black text-xs text-emerald-600">+{Number(p.amount_htg_equivalent || p.amount).toLocaleString()} G</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{p.payment_method}</p>
                        </div>
                      </div>
                    ))}
                    {directorStats.recentPayments.length === 0 && (
                      <p className="text-center py-8 text-slate-400 text-xs italic font-medium">Aucun encaissement récent</p>
                    )}
                  </div>
                  <Link to="/economat/liste" className="mt-6 flex items-center justify-center w-full py-3 text-xs font-black uppercase tracking-wider text-indigo-600 bg-indigo-50/60 hover:bg-indigo-100/60 rounded-2xl transition-all border border-indigo-100">
                    Voir tout l'historique
                    <ChevronRight size={14} className="ml-1" />
                  </Link>
                </div>

                {/* Résumé Financier */}
                <div className="bg-white rounded-3xl shadow-xs border border-slate-100/90 p-6 md:p-8">
                  <h3 className="text-base font-black text-slate-900 tracking-tight mb-6">Résumé Financier Annuel</h3>
                  <div className="space-y-4">
                    <div className="flex flex-col gap-2 p-4 rounded-2xl bg-slate-50/40 border border-slate-100/80">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100/50">
                            <Coins size={18} />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-900">Total Collecté</p>
                            <p className="text-[10px] text-slate-400">Recettes effectives globales</p>
                            <p className="text-[9px] font-medium text-slate-400 mt-0.5">
                              {stats.collectedHTG.toLocaleString()} HTG
                              {(stats.collectedUSD > 0 || stats.expectedUSD > 0) ? ` | ${stats.collectedUSD.toLocaleString()} USD` : ''}
                            </p>
                          </div>
                      </div>
                      <p className="font-black text-sm text-slate-900">{stats.collected.toLocaleString()} <span className="text-[10px] font-normal text-slate-400">HTG{(stats.collectedUSD > 0 || stats.expectedUSD > 0) ? " eq." : ""}</span></p>
                    </div>
                      <div className="flex items-center justify-between pl-13 text-[11px] font-medium text-slate-500">
                         <span>{terminology.tuition}</span>
                         <span className="font-bold text-slate-700">{stats.collectedTuition.toLocaleString()} G</span>
                      </div>
                      <div className="flex items-center justify-between pl-13 text-[11px] font-medium text-slate-500">
                         <span>Fournitures</span>
                         <span className="font-bold text-slate-700">{stats.collectedSupplies.toLocaleString()} G</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-4 rounded-2xl bg-rose-50/30 border border-rose-100/60">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-600 border border-rose-100/50">
                          <TrendingDown size={18} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900">Dépenses Totales</p>
                          <p className="text-[10px] text-slate-400">Charges enregistrées</p>
                        </div>
                      </div>
                      <p className="font-black text-sm text-rose-600">{stats.expenses.toLocaleString()} G</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-slate-900 text-white flex items-center justify-between shadow-xs">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Solde Net d'Exploitation</p>
                        <p className="text-xs font-medium text-slate-300">Recettes - Dépenses</p>
                      </div>
                      <p className={`text-base font-black ${(stats.collected - stats.expenses) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {(stats.collected - stats.expenses).toLocaleString()} G
                      </p>
                    </div>
                  </div>
                  <div className="mt-6 grid grid-cols-2 gap-3">
                    <Link to="/economat/depenses/ajouter" className="flex items-center justify-center gap-2 py-3 bg-slate-900 text-white rounded-2xl text-xs font-bold hover:bg-slate-800 transition-all shadow-xs">
                      <TrendingDown size={14} />
                      Nouvelle Dépense
                    </Link>
                    <Link to="/economat/frais" className="flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white rounded-2xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-xs">
                      <Coins size={14} />
                      Nouvel Encaissement
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}

        {/* Montant par Classe Chart */}
        <div className="mt-6 bg-white rounded-3xl shadow-sm border border-gray-100 p-4 md:p-6 relative overflow-hidden group/chart">
          {/* Decorative background element */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-50/30 rounded-full -mr-48 -mt-48 blur-3xl pointer-events-none transition-transform duration-1000 group-hover/chart:scale-110"></div>
          
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 md:mb-5 gap-3 relative z-10">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-indigo-600 shadow-md shadow-indigo-100/40 border border-indigo-50">
                <BarChart3 size={24} />
              </div>
              <div>
                <h3 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight leading-none">Répartition Financière</h3>
                <p className="text-[11px] text-slate-400 mt-1.5 font-bold uppercase tracking-widest">Analyse des recettes par niveau d'enseignement</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 z-10">
               {/* Segmented Control for view mode */}
               <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200/40 shadow-inner relative">
                  <button
                    onClick={() => setChartViewMode('donut')}
                    className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-300 relative ${chartViewMode === 'donut' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-950'}`}
                  >
                    Vue Donut
                  </button>
                  <button
                    onClick={() => setChartViewMode('bar')}
                    className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-300 relative ${chartViewMode === 'bar' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-950'}`}
                  >
                    Vue Barres
                  </button>
               </div>
               
               <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded-xl border border-emerald-100/50 shadow-sm">
                  <TrendingUp size={14} className="text-emerald-600" />
                  <span className="text-[9px] font-black text-emerald-700 uppercase tracking-widest">Performance Optimale</span>
               </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 relative z-10">
            {/* Left: Donut Chart / Bar Chart & Total Volume */}
            <div className="lg:col-span-5 flex flex-col items-center justify-center relative min-h-[230px]">
               {chartViewMode === 'donut' ? (
                 <div className="h-[230px] w-full relative">
                   <ResponsiveContainer width="100%" height="100%">
                     <PieChart>
                       <Pie
                         data={processedChartData}
                         cx="50%"
                         cy="50%"
                         innerRadius={80}
                         outerRadius={110}
                         paddingAngle={4}
                         dataKey="montant"
                         stroke="#fff"
                         strokeWidth={2}
                         cornerRadius={8}
                         onMouseEnter={(_data, index) => setActivePieIndex(index)}
                         onMouseLeave={() => setActivePieIndex(null)}
                       >
                         {processedChartData.map((_entry, index) => {
                            const colors = ['#4f46e5', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#f43f5e'];
                            const isHovered = activePieIndex === index;
                            const hasActiveHover = activePieIndex !== null;
                            const baseColor = colors[index % colors.length];
                            
                            return (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={baseColor} 
                                opacity={hasActiveHover ? (isHovered ? 1 : 0.45) : 1}
                                stroke={isHovered ? baseColor : '#fff'}
                                strokeWidth={isHovered ? 4 : 2}
                              />
                            );
                         })}
                       </Pie>
                       <Tooltip 
                         contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.1)', padding: '12px 18px', fontWeight: 'bold' }}
                         itemStyle={{ color: '#1e293b', fontWeight: 900 }}
                         formatter={(value: number) => [`${value.toLocaleString()} G`, 'Recettes']}
                       />
                     </PieChart>
                   </ResponsiveContainer>
                   
                   {/* Center text of Donut */}
                   <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-4 text-center">
                     {activePieIndex !== null && processedChartData[activePieIndex] ? (
                       <motion.div 
                         initial={{ opacity: 0, scale: 0.9 }}
                         animate={{ opacity: 1, scale: 1 }}
                         transition={{ duration: 0.2 }}
                         className="flex flex-col items-center justify-center"
                       >
                         <p className="text-[9px] font-black text-indigo-500 uppercase tracking-[0.15em] mb-0.5 truncate max-w-[150px]">
                           {processedChartData[activePieIndex].name}
                         </p>
                         <p className="text-xl font-black text-slate-900 tracking-tighter">
                           {processedChartData[activePieIndex].montant.toLocaleString()} G
                         </p>
                         <span className="text-[9px] font-black text-slate-500 bg-slate-100 border border-slate-200/60 px-2 py-0.5 rounded-full mt-1 shadow-sm">
                           {stats.collected > 0 
                             ? ((processedChartData[activePieIndex].montant / stats.collected) * 100).toFixed(1)
                             : '0.0'}% du total
                         </span>
                       </motion.div>
                     ) : (
                       <div className="flex flex-col items-center justify-center">
                         <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-0.5">Total Recettes</p>
                         <p className="text-2xl font-black text-slate-900 tracking-tighter">
                           {stats.collected.toLocaleString()}
                         </p>
                         <span className="text-xs font-black text-indigo-500 uppercase tracking-widest mt-0.5">HTG</span>
                       </div>
                     )}
                   </div>
                 </div>
               ) : (
                 <div className="h-[230px] w-full py-2 pr-2">
                   <ResponsiveContainer width="100%" height="100%">
                     <BarChart
                       data={processedChartData}
                       layout="vertical"
                       margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
                     >
                       <defs>
                         <linearGradient id="revenueBarGradient" x1="0" y1="0" x2="1" y2="0">
                           <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.85} />
                           <stop offset="100%" stopColor="#a855f7" stopOpacity={1} />
                         </linearGradient>
                       </defs>
                       <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                       <XAxis 
                         type="number" 
                         tickLine={false} 
                         axisLine={false} 
                         tick={{ fill: '#64748b', fontSize: 9, fontWeight: 'bold' }} 
                         tickFormatter={(value) => `${(value / 1000).toFixed(0)}k G`}
                       />
                       <YAxis 
                         dataKey="name" 
                         type="category" 
                         tickLine={false} 
                         axisLine={false} 
                         tick={{ fill: '#334155', fontSize: 10, fontWeight: 'bold' }} 
                         width={80}
                       />
                       <Tooltip
                         cursor={{ fill: '#f1f5f9', opacity: 0.5, radius: 8 }}
                         contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.1)', padding: '12px 20px' }}
                         itemStyle={{ color: '#1e293b', fontWeight: 900 }}
                         formatter={(value: number) => [`${value.toLocaleString()} G`, 'Recettes']}
                       />
                       <Bar 
                         dataKey="montant" 
                         fill="url(#revenueBarGradient)" 
                         radius={[0, 6, 6, 0]}
                         barSize={12}
                         onMouseEnter={(_data, index) => setActivePieIndex(index)}
                         onMouseLeave={() => setActivePieIndex(null)}
                       >
                         {processedChartData.map((_entry, index) => {
                           const isHovered = activePieIndex === index;
                           return (
                             <Cell 
                               key={`bar-cell-${index}`}
                               opacity={activePieIndex !== null ? (isHovered ? 1 : 0.45) : 1}
                             />
                           );
                         })}
                       </Bar>
                     </BarChart>
                   </ResponsiveContainer>
                 </div>
               )}
            </div>

            {/* Right: Detailed List */}
            <div className="lg:col-span-7 flex flex-col justify-center">
              <div className="bg-slate-50/70 p-3 md:p-4 rounded-2xl border border-slate-100/80 shadow-inner">
                
                {/* Search and Sort controls */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 mb-3 bg-white p-2.5 rounded-2xl border border-slate-100 shadow-sm">
                  <div className="relative flex-1 w-full">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                      <Search size={14} />
                    </span>
                    <input
                      type="text"
                      placeholder={`Rechercher un niveau d'enseignement...`}
                      value={revenueSearch}
                      onChange={(e) => setRevenueSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 text-xs font-medium text-slate-700 bg-slate-50/50 hover:bg-slate-50 focus:bg-white border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400"
                    />
                    {revenueSearch && (
                      <button
                        onClick={() => setRevenueSearch('')}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                    <button
                      onClick={() => setRevenueSortType(revenueSortType === 'amount' ? 'name' : 'amount')}
                      className="px-3 py-2 text-xs font-black text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200/50 rounded-xl transition-all flex items-center gap-2 shadow-sm active:scale-95"
                    >
                      <span className="text-[9px] uppercase tracking-wider text-slate-400">Ordre:</span>
                      <span className="text-indigo-600 uppercase tracking-wider">{revenueSortType === 'amount' ? 'Montant' : 'A-Z'}</span>
                    </button>
                  </div>
                </div>

                <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.25em] mb-2 px-1">Classement des {terminology.options}</p>
                <div className="space-y-2 min-h-[140px]">
                   {processedChartData.slice(0, 6).map((item, idx) => {
                      const colors = ['bg-[#4f46e5]', 'bg-[#6366f1]', 'bg-[#8b5cf6]', 'bg-[#a855f7]', 'bg-[#d946ef]', 'bg-[#f43f5e]'];
                      const color = colors[idx % colors.length];
                      const percentage = stats.collected > 0 ? ((item.montant / stats.collected) * 100).toFixed(1) : '0.0';
                      const maxItem = classChartData[0]?.montant || 1;
                      const barWidth = `${(item.montant / maxItem) * 100}%`;
                      const isHovered = activePieIndex === idx;
                      
                      return (
                        <motion.div 
                          key={idx} 
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.05, duration: 0.4 }}
                          onMouseEnter={() => setActivePieIndex(idx)}
                          onMouseLeave={() => setActivePieIndex(null)}
                          className={`flex flex-col gap-1 p-1.5 rounded-xl transition-all duration-300 border cursor-default ${isHovered ? 'bg-white border-indigo-100 shadow-md shadow-indigo-100/30 -translate-y-0.5' : 'border-transparent bg-transparent'}`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-0.5 px-1">
                            <div className="flex items-center gap-2">
                              <div className={`w-3 h-3 rounded-full ${color} shadow-sm border-2 border-white shrink-0`} />
                              <span className="text-xs font-black text-slate-700 truncate max-w-[200px]">{item.name}</span>
                            </div>
                            <div className="flex items-center gap-2 ml-5 sm:ml-0">
                              <span className="text-xs font-black text-slate-900">{item.montant.toLocaleString()} G</span>
                              <span className="text-[9px] font-black text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded-md min-w-[45px] text-center shadow-sm">
                                {percentage}%
                              </span>
                            </div>
                          </div>
                          <div className="w-full h-1.5 bg-slate-200/60 rounded-full overflow-hidden ml-5" style={{ width: 'calc(100% - 20px)' }}>
                            <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: barWidth }}
                                transition={{ delay: 0.1 + (idx * 0.05), duration: 0.8, ease: "easeOut" }}
                                className={`h-full rounded-full ${color} transition-colors`} 
                            />
                          </div>
                        </motion.div>
                      )
                   })}
                   
                   {processedChartData.length === 0 && (
                     <div className="flex flex-col items-center justify-center py-8 text-center text-slate-400">
                       <Info size={24} className="text-slate-300 mb-2" />
                       <p className="text-[11px] font-bold italic">Aucun résultat pour cette recherche</p>
                     </div>
                   )}
                </div>
                
                <button 
                   onClick={() => setShowRevenueModal(true)}
                   className="mt-4 w-full py-3 bg-white border border-slate-200 text-slate-700 rounded-xl text-[11px] font-black uppercase tracking-widest hover:border-indigo-300 hover:text-indigo-600 transition-all flex items-center justify-center gap-2 shadow-sm hover:shadow-md active:scale-95"
                >
                   <Layers size={14} /> Voir toutes les {terminology.options.toLowerCase()}
                </button>
              </div>
            </div>
          </div>
        </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;