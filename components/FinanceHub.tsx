import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, isValidUuid } from '../supabase';
import { 
  PlusCircle, 
  UserSearch, 
  ShieldCheck, 
  ArrowUpRight, 
  ArrowRight,
  TrendingUp,
  CalendarCheck,
  Target,
  ArrowDownRight,
  RefreshCcw,
  Package,
  Receipt,
  DollarSign,
  CreditCard,
  BookOpen,
  GraduationCap,
  ClipboardList,
  History,
  ShieldAlert,
  BarChart3,
  CheckCircle,
  AlertCircle,
  Rocket,
  SearchCheck,
  Calculator,
  X,
  Sliders
} from 'lucide-react';
import { UserProfile, UserRole } from '../types';
import { useSchool } from '../contexts/SchoolContext';
import { DailyCashClosureModal } from './DailyCashClosureModal';
import { ReevaluationModal, ReevaluatedStudentItem } from './ReevaluationModal';

const FinanceHub: React.FC<{ user: UserProfile }> = ({ user }) => {
  const navigate = useNavigate();
  const { terminology, currentCampusId, school } = useSchool();
  const [isClosureModalOpen, setIsClosureModalOpen] = useState(false);
  const [exchangeRate, setExchangeRate] = useState<number>(132.50);
  
  const [todayCollection, setTodayCollection] = useState(0);
  const [todayCollectionHTG, setTodayCollectionHTG] = useState(0);
  const [todayCollectionUSD, setTodayCollectionUSD] = useState(0);
  const [totalExpected, setTotalExpected] = useState(0);
  const [totalExpectedHTG, setTotalExpectedHTG] = useState(0);
  const [totalExpectedUSD, setTotalExpectedUSD] = useState(0);
  const [totalGrossExpected, setTotalGrossExpected] = useState(0);
  const [totalGrossExpectedHTG, setTotalGrossExpectedHTG] = useState(0);
  const [totalGrossExpectedUSD, setTotalGrossExpectedUSD] = useState(0);
  const [totalReductions, setTotalReductions] = useState(0);
  const [totalReductionsHTG, setTotalReductionsHTG] = useState(0);
  const [totalReductionsUSD, setTotalReductionsUSD] = useState(0);
  const [reevaluatedStudents, setReevaluatedStudents] = useState<ReevaluatedStudentItem[]>([]);
  const [isReevaluationModalOpen, setIsReevaluationModalOpen] = useState(false);
  const [isTargetReevaluated, setIsTargetReevaluated] = useState(true);
  const [totalCollected, setTotalCollected] = useState(0);
  const [totalCollectedHTG, setTotalCollectedHTG] = useState(0);
  const [totalCollectedUSD, setTotalCollectedUSD] = useState(0);
  const [totalCollectedTuition, setTotalCollectedTuition] = useState(0);
  const [totalCollectedTuitionHTG, setTotalCollectedTuitionHTG] = useState(0);
  const [totalCollectedTuitionUSD, setTotalCollectedTuitionUSD] = useState(0);
  const [totalCollectedSupplies, setTotalCollectedSupplies] = useState(0);
  const [totalCollectedSuppliesHTG, setTotalCollectedSuppliesHTG] = useState(0);
  const [totalCollectedSuppliesUSD, setTotalCollectedSuppliesUSD] = useState(0);
  const [totalArrears, setTotalArrears] = useState(0);
  const [collectionRate, setCollectionRate] = useState(0);
  const [todayTransactions, setTodayTransactions] = useState(0);
  const [cashOnHandHTG, setCashOnHandHTG] = useState(0);
  const [cashOnHandUSD, setCashOnHandUSD] = useState(0);
  const [paymentMethodBreakdown, setPaymentMethodBreakdown] = useState<Record<string, number>>({});
  const [criticalDelays, setCriticalDelays] = useState(0);
  const [discountedStudents, setDiscountedStudents] = useState(0);
  const [pendingPayments, setPendingPayments] = useState(0);
  const [economatPenetration, setEconomatPenetration] = useState(0);
  
  // New state for detailed breakdown
  const [txBreakdown, setTxBreakdown] = useState({ academique: 0, inscription: 0, fournitures: 0, autres: 0 });
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [netBalance, setNetBalance] = useState({ 
    income: 0, incomeHTG: 0, incomeUSD: 0, 
    expenses: 0, expensesHTG: 0, expensesUSD: 0, 
    salaries: 0, salariesHTG: 0, salariesUSD: 0, 
    net: 0, netHTG: 0, netUSD: 0 
  });
  
  const [loading, setLoading] = useState(true);

  const fetchFinanceData = useCallback(async () => {
    if (!user?.school_id) return;
    const activeCampusId = user.campus_id || currentCampusId;
    try {
      setLoading(true);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // 1. Fetch Payments
      let paymentsQuery = supabase
        .from('payments')
        .select('*, campaign:ad_hoc_campaigns(id, name)')
        .eq('school_id', user.school_id);
      if (activeCampusId && isValidUuid(activeCampusId)) {
        paymentsQuery = paymentsQuery.eq('campus_id', activeCampusId);
      }
      const { data: payments } = await paymentsQuery;
        
      // 2. Fetch Supplies Sales
      let suppliesQuery = supabase
        .from('school_supplies')
        .select('*, payments:supply_payments(*)')
        .eq('school_id', user.school_id);
      if (activeCampusId && isValidUuid(activeCampusId)) {
        suppliesQuery = suppliesQuery.eq('campus_id', activeCampusId);
      }
      const { data: supplies } = await suppliesQuery;
      
      // 3. Fetch Expenses
      let expensesQuery = supabase
        .from('expenses')
        .select('*')
        .eq('school_id', user.school_id);
      if (activeCampusId && isValidUuid(activeCampusId)) {
        expensesQuery = expensesQuery.eq('campus_id', activeCampusId);
      }
      const { data: expensesData } = await expensesQuery;

      // 4. Fetch Paid Salaries
      let payrollQuery = supabase
        .from('payroll_slips')
        .select('*, staff!inner(id, campus_id)')
        .eq('school_id', user.school_id)
        .eq('status', 'PAID');
      if (activeCampusId && isValidUuid(activeCampusId)) {
        payrollQuery = payrollQuery.eq('staff.campus_id', activeCampusId);
      }
      const { data: salaryData } = await payrollQuery;
        
      let allRecentTx: any[] = [];
      let breakdown = { academique: 0, inscription: 0, fournitures: 0, autres: 0 };
      let todayTotal = 0;
      let todayTotalHTG = 0;
      let todayTotalUSD = 0;
      let todayCount = 0;
      let methodBreakdown: Record<string, number> = {};
      let tuitionTotal = 0;
      let tuitionTotalHTG = 0;
      let tuitionTotalUSD = 0;
      let suppliesTotal = 0;
      let suppliesTotalHTG = 0;
      let suppliesTotalUSD = 0;
      let cashTotalHTG = 0;
      let cashTotalUSD = 0;
        
      if (payments) {
        const validPayments = payments.filter(p => 
          !p.payment_method?.includes('EN ATTENTE') && 
          !p.payment_method?.includes('REJETÉ') &&
          p.status !== 'ANNULE' &&
          p.status !== 'EN_ATTENTE' &&
          p.moncash_status !== 'PENDING'
        );
        
        const todayValidPayments = validPayments.filter(p => {
          const pDate = new Date(p.created_at);
          pDate.setHours(0,0,0,0);
          return pDate.getTime() === today.getTime();
        });

        tuitionTotal = validPayments.reduce((acc, p) => acc + Number(p.amount_htg_equivalent || p.amount || 0), 0);
        tuitionTotalHTG = validPayments.filter(p => !p.currency || p.currency === 'HTG').reduce((acc, p) => acc + Number(p.amount || 0), 0);
        tuitionTotalUSD = validPayments.filter(p => p.currency === 'USD').reduce((acc, p) => acc + Number(p.amount || 0), 0);
        
        cashTotalHTG += todayValidPayments.filter(p => (!p.currency || p.currency === 'HTG') && (p.payment_method === 'Cash' || !p.payment_method)).reduce((acc, p) => acc + Number(p.amount || 0), 0);
        cashTotalUSD += todayValidPayments.filter(p => p.currency === 'USD' && (p.payment_method === 'Cash' || !p.payment_method)).reduce((acc, p) => acc + Number(p.amount || 0), 0);
        
        setTotalCollectedTuition(tuitionTotal);
        setTotalCollectedTuitionHTG(tuitionTotalHTG);
        setTotalCollectedTuitionUSD(tuitionTotalUSD);
        
        todayTotal += todayValidPayments.reduce((acc, p) => acc + Number(p.amount_htg_equivalent || p.amount || 0), 0);
        todayTotalHTG += todayValidPayments.filter(p => !p.currency || p.currency === 'HTG').reduce((acc, p) => acc + Number(p.amount || 0), 0);
        todayTotalUSD += todayValidPayments.filter(p => p.currency === 'USD').reduce((acc, p) => acc + Number(p.amount || 0), 0);
        todayCount += todayValidPayments.length;
        
        // Categorize today's payments
        todayValidPayments.forEach(p => {
          const method = p.payment_method || 'Cash';
          const displayMethod = p.currency === 'USD' ? `${method} ($)` : method;
          const amount = Number(p.amount_htg_equivalent || p.amount || 0);
          methodBreakdown[displayMethod] = (methodBreakdown[displayMethod] || 0) + amount;

          if (p.fee_type === 'SCOLARITE' || (!p.fee_type && (!p.nature || p.nature === 'SCOLARITE'))) breakdown.academique++;
          else if (p.fee_type === 'INSCRIPTION' || p.nature === 'INSCRIPTION' || p.nature === "Frais d'inscription") breakdown.inscription++;
          else breakdown.autres++;

          let paymentTypeStr = 'Frais Divers';
          if (p.campaign?.name) paymentTypeStr = `Campagne : ${p.campaign.name}`;
          else if (p.ad_hoc_campaign_id) paymentTypeStr = 'Frais de Campagne';
          else if (p.fee_type === 'SCOLARITE' || (!p.fee_type && (!p.nature || p.nature === 'SCOLARITE'))) paymentTypeStr = terminology.tuition;
          else if (p.fee_type === 'INSCRIPTION' || p.nature === 'INSCRIPTION' || p.nature === "Frais d'inscription") paymentTypeStr = 'Inscription';
          
          allRecentTx.push({
            id: p.id,
            date: new Date(p.created_at),
            type: paymentTypeStr,
            amount: Number(p.amount_htg_equivalent || p.amount || 0),
            currencyAmount: Number(p.amount || 0),
            currency: p.currency || 'HTG',
            method: p.payment_method || 'Cash',
            icon: GraduationCap,
            color: 'text-indigo-600',
            bg: 'bg-indigo-50'
          });
        });
        
        const pending = payments.filter(p => (p.payment_method?.includes('EN ATTENTE') || p.status === 'EN_ATTENTE' || p.moncash_status === 'PENDING') && p.status !== 'ANNULE').length;
        setPendingPayments(pending);
      }

      if (supplies) {
        const validSupplies = supplies.filter(s => 
          s.status !== 'ANNULE' && 
          !s.payment_method?.includes('EN ATTENTE') &&
          !s.payment_method?.includes('REJETÉ') &&
          s.moncash_status !== 'PENDING'
        );

        suppliesTotal = validSupplies.reduce((sum, s) => {
          const paid = s.payments?.reduce((acc: number, p: any) => acc + Number(p.amount_htg_equivalent || p.amount || 0), 0) || 0;
          return sum + paid;
        }, 0);
        suppliesTotalHTG = validSupplies.reduce((sum, s) => {
          return sum + (s.payments?.filter((p: any) => !p.currency || p.currency === 'HTG').reduce((acc: number, p: any) => acc + Number(p.amount || 0), 0) || 0);
        }, 0);
        suppliesTotalUSD = validSupplies.reduce((sum, s) => {
          return sum + (s.payments?.filter((p: any) => p.currency === 'USD').reduce((acc: number, p: any) => acc + Number(p.amount || 0), 0) || 0);
        }, 0);
        
        setTotalCollectedSupplies(suppliesTotal);
        setTotalCollectedSuppliesHTG(suppliesTotalHTG);
        setTotalCollectedSuppliesUSD(suppliesTotalUSD);

        const todaySupplies = validSupplies.filter(s => {
          const sDate = new Date(s.created_at);
          sDate.setHours(0,0,0,0);
          return sDate.getTime() === today.getTime();
        });

        cashTotalHTG += todaySupplies.reduce((sum, s) => {
          return sum + (s.payments?.filter((p: any) => (!p.currency || p.currency === 'HTG') && (s.payment_method === 'Cash' || !s.payment_method)).reduce((acc: number, p: any) => acc + Number(p.amount || 0), 0) || 0);
        }, 0);
        cashTotalUSD += todaySupplies.reduce((sum, s) => {
          return sum + (s.payments?.filter((p: any) => p.currency === 'USD' && (s.payment_method === 'Cash' || !s.payment_method)).reduce((acc: number, p: any) => acc + Number(p.amount || 0), 0) || 0);
        }, 0);

        todayTotal += todaySupplies.reduce((acc, s) => acc + Number(s.amount_htg_equivalent || s.total_amount || 0), 0);
        todayTotalHTG += todaySupplies.reduce((sum, s) => {
          return sum + (s.payments && s.payments.length > 0 ? s.payments.filter((p: any) => p.payment_date === today.toISOString().split('T')[0] && (!p.currency || p.currency === 'HTG')).reduce((acc: number, p: any) => acc + Number(p.amount || 0), 0) : (!s.currency || s.currency === 'HTG' ? Number(s.total_amount || 0) : 0));
        }, 0);
        todayTotalUSD += todaySupplies.reduce((sum, s) => {
          return sum + (s.payments && s.payments.length > 0 ? s.payments.filter((p: any) => p.payment_date === today.toISOString().split('T')[0] && p.currency === 'USD').reduce((acc: number, p: any) => acc + Number(p.amount || 0), 0) : (s.currency === 'USD' ? Number(s.total_amount || 0) : 0));
        }, 0);
        const uniqueSupplyTransactionsToday = new Set(todaySupplies.map(s => s.transaction_id || s.id));
        todayCount += uniqueSupplyTransactionsToday.size;
        breakdown.fournitures += uniqueSupplyTransactionsToday.size;
        
        todaySupplies.forEach(s => {
          const method = s.payment_method || 'Cash';
          const displayMethod = s.currency === 'USD' ? `${method} ($)` : method;
          const amount = Number(s.amount_htg_equivalent || s.total_amount || 0);
          methodBreakdown[displayMethod] = (methodBreakdown[displayMethod] || 0) + amount;

          allRecentTx.push({
            id: s.id,
            date: new Date(s.created_at),
            type: 'Fournitures',
            amount: Number(s.amount_htg_equivalent || s.total_amount || 0),
            currencyAmount: Number(s.total_amount || 0),
            currency: s.currency || 'HTG',
            method: s.payment_method || 'Cash',
            icon: BookOpen,
            color: 'text-amber-600',
            bg: 'bg-amber-50'
          });
        });
      }
      
      setTodayCollection(todayTotal);
      setTodayCollectionHTG(todayTotalHTG);
      setTodayCollectionUSD(todayTotalUSD);
      setTodayTransactions(todayCount);
      setCashOnHandHTG(cashTotalHTG);
      setCashOnHandUSD(cashTotalUSD);
      setTotalCollected(tuitionTotal + suppliesTotal);
      setTotalCollectedHTG(tuitionTotalHTG + suppliesTotalHTG);
      setTotalCollectedUSD(tuitionTotalUSD + suppliesTotalUSD);
      setPaymentMethodBreakdown(methodBreakdown);
      // Calcul du Bilan Net (Uniquement ce qui est réellement encaissé)
      const tuitionIncome = payments?.filter(p => 
        p.status !== 'ANNULE' && 
        !p.payment_method?.includes('EN ATTENTE') && 
        p.moncash_status !== 'PENDING'
      ).reduce((acc, p) => acc + Number(p.amount_htg_equivalent || p.amount || 0), 0) || 0;
      
      const tuitionIncomeHTG = payments?.filter(p => 
        p.status !== 'ANNULE' && 
        !p.payment_method?.includes('EN ATTENTE') && 
        p.moncash_status !== 'PENDING' &&
        (!p.currency || p.currency === 'HTG')
      ).reduce((acc, p) => acc + Number(p.amount || 0), 0) || 0;

      const tuitionIncomeUSD = payments?.filter(p => 
        p.status !== 'ANNULE' && 
        !p.payment_method?.includes('EN ATTENTE') && 
        p.moncash_status !== 'PENDING' &&
        p.currency === 'USD'
      ).reduce((acc, p) => acc + Number(p.amount || 0), 0) || 0;
      
      const suppliesIncome = supplies?.filter(s => 
        s.status !== 'ANNULE' && 
        !s.payment_method?.includes('EN ATTENTE') && 
        s.moncash_status !== 'PENDING'
      ).reduce((sum, s) => {
        const paid = s.payments?.reduce((acc: number, p: any) => acc + Number(p.amount_htg_equivalent || p.amount || 0), 0) || 0;
        return sum + paid;
      }, 0) || 0;

      const suppliesIncomeHTG = supplies?.filter(s => 
        s.status !== 'ANNULE' && 
        !s.payment_method?.includes('EN ATTENTE') && 
        s.moncash_status !== 'PENDING'
      ).reduce((sum, s) => {
        const paid = s.payments?.filter((p: any) => !p.currency || p.currency === 'HTG').reduce((acc: number, p: any) => acc + Number(p.amount || 0), 0) || 0;
        return sum + paid;
      }, 0) || 0;

      const suppliesIncomeUSD = supplies?.filter(s => 
        s.status !== 'ANNULE' && 
        !s.payment_method?.includes('EN ATTENTE') && 
        s.moncash_status !== 'PENDING'
      ).reduce((sum, s) => {
        const paid = s.payments?.filter((p: any) => p.currency === 'USD').reduce((acc: number, p: any) => acc + Number(p.amount || 0), 0) || 0;
        return sum + paid;
      }, 0) || 0;

      const totalIncome = tuitionIncome + suppliesIncome;
      const totalIncomeHTG = tuitionIncomeHTG + suppliesIncomeHTG;
      const totalIncomeUSD = tuitionIncomeUSD + suppliesIncomeUSD;

      const totalExpenses = expensesData?.reduce((sum, e) => sum + Number(e.amount_htg_equivalent || e.amount || 0), 0) || 0;
      const totalExpensesHTG = expensesData?.filter(e => !e.currency || e.currency === 'HTG').reduce((sum, e) => sum + Number(e.amount || 0), 0) || 0;
      const totalExpensesUSD = expensesData?.filter(e => e.currency === 'USD').reduce((sum, e) => sum + Number(e.amount || 0), 0) || 0;

      const totalSalaries = salaryData?.reduce((sum, s) => sum + (s.net_amount_htg_equivalent || s.net_salary || 0), 0) || 0;
      const totalSalariesHTG = salaryData?.filter(s => !s.currency || s.currency === 'HTG').reduce((sum, s) => sum + (s.net_salary || 0), 0) || 0;
      const totalSalariesUSD = salaryData?.filter(s => s.currency === 'USD').reduce((sum, s) => sum + (s.net_salary || 0), 0) || 0;

      setNetBalance({
        income: totalIncome,
        incomeHTG: totalIncomeHTG,
        incomeUSD: totalIncomeUSD,
        expenses: totalExpenses,
        expensesHTG: totalExpensesHTG,
        expensesUSD: totalExpensesUSD,
        salaries: totalSalaries,
        salariesHTG: totalSalariesHTG,
        salariesUSD: totalSalariesUSD,
        net: totalIncome - totalExpenses - totalSalaries,
        netHTG: totalIncomeHTG - totalExpensesHTG - totalSalariesHTG,
        netUSD: totalIncomeUSD - totalExpensesUSD - totalSalariesUSD
      });

      setTxBreakdown(breakdown);
      
      // Sort recent transactions by date descending and take top 5
      allRecentTx.sort((a, b) => b.date.getTime() - a.date.getTime());
      setRecentTransactions(allRecentTx.slice(0, 5));

      // 3. Fetch Students, Fee Plans, Enrollments & Exchange Rate
      let studentsQuery = supabase.from('students').select('*').eq('school_id', user.school_id);
      if (activeCampusId) {
        studentsQuery = studentsQuery.eq('campus_id', activeCampusId);
      }
      const { data: students } = await studentsQuery;
      const { data: plans } = await supabase.from('fee_plans').select('*').eq('school_id', user.school_id);
      const { data: enrollments } = await supabase.from('enrollments').select('student_id, academic_year_id, class_id').eq('school_id', user.school_id);
      const { data: classesData } = await supabase.from('classes').select('id, name').eq('school_id', user.school_id);
      const { data: rateData } = await supabase.from('exchange_rates').select('*').eq('school_id', user.school_id).order('effective_date', { ascending: false }).limit(1);
      
      const currentExchangeRate = rateData?.[0]?.rate_usd_to_htg || rateData?.[0]?.rate || 132.50;
      setExchangeRate(currentExchangeRate);

      const classesMap = new Map<string, string>();
      classesData?.forEach(c => classesMap.set(c.id, c.name));

      if (students && plans) {
        // Get active year ID for filtering plans and checking enrollment history
        const { data: activeYear } = await supabase
          .from('academic_years')
          .select('id')
          .eq('school_id', user.school_id)
          .or('is_active.eq.true,status.eq.ACTIVE')
          .maybeSingle();

        const plansMap = new Map();
        // Filter plans for the active year specifically to avoid using old fee structures
        const activePlans = plans.filter(p => p.academic_year_id === activeYear?.id);
        const finalPlans = activePlans.length > 0 ? activePlans : plans;
        finalPlans.forEach(p => plansMap.set(p.class_id, p));

        // Group enrollments by student to identify returning students and active class
        const studentEnrollments = new Map<string, string[]>();
        const studentActiveClassMap = new Map<string, string>();
        enrollments?.forEach(e => {
          const list = studentEnrollments.get(e.student_id) || [];
          list.push(e.academic_year_id);
          studentEnrollments.set(e.student_id, list);
          if (e.academic_year_id === activeYear?.id && e.class_id) {
            studentActiveClassMap.set(e.student_id, e.class_id);
          }
        });
        
        let expected = 0;
        let expectedHTG = 0;
        let expectedUSD = 0;
        let grossExpected = 0;
        let grossExpectedHTG = 0;
        let grossExpectedUSD = 0;
        let reductions = 0;
        let reductionsHTG = 0;
        let reductionsUSD = 0;
        let discountedCount = 0;
        let criticalCount = 0;
        let reevaluatedList: any[] = [];
        
        // Filter students to only those registered for the current active year
        const activeStudentIds = new Set(enrollments?.filter(e => e.academic_year_id === activeYear?.id).map(e => e.student_id));
        const activeStudents = students.filter(s => activeStudentIds.has(s.id));

        activeStudents.forEach(s => {
          const activeClassId = studentActiveClassMap.get(s.id) || s.class_id;
          const plan = plansMap.get(activeClassId) || plansMap.get(s.class_id);
          const studentClassName = classesMap.get(activeClassId) || classesMap.get(s.class_id) || classesMap.get(plan?.class_id) || plan?.class_name || 'Non spécifiée';
          
          let studentExpected = 0;
          if (plan) {
            const enrolls = studentEnrollments.get(s.id) || [];
            // A student is returning if they have enrollments in years OTHER than the active year
            const isReturning = enrolls.some(yearId => yearId !== activeYear?.id);
            
            const inscriptionHTG = isReturning ? Number(plan.reenrollment_fee || 0) : Number(plan.inscription_fee || 0);
            const inscriptionUSD_raw = isReturning ? Number(plan.reenrollment_fee_usd || 0) : Number(plan.inscription_fee_usd || 0);
            const inscriptionUSD = inscriptionUSD_raw * currentExchangeRate;
            
            const tuitionHTG = Number(plan.tuition_fee || 0);
            const tuitionUSD_raw = Number(plan.tuition_fee_usd || 0);
            const tuitionUSD = tuitionUSD_raw * currentExchangeRate;
            
            const baseAmount = inscriptionHTG + inscriptionUSD + tuitionHTG + tuitionUSD;
            const baseHTG = inscriptionHTG + tuitionHTG;
            const baseUSD_raw = inscriptionUSD_raw + tuitionUSD_raw;
            
            const miscHTG = plan.is_misc_mandatory ? Number(plan.misc_fee_htg || 0) : 0;
            const miscUSD_raw = plan.is_misc_mandatory ? Number(plan.misc_fee_usd || 0) : 0;
            const miscUSD = miscUSD_raw * currentExchangeRate;
            const miscAmount = miscHTG + miscUSD;
            
            const studentGross = baseAmount + miscAmount;
            const studentGrossHTG = baseHTG + miscHTG;
            const studentGrossUSD_raw = baseUSD_raw + miscUSD_raw;
            
            const studentDiscount = Number(s.discount_amount || 0);
            const discountLabel = (s.discount_label || '').toLowerCase();

            let sReductHTG = 0;
            let sReductUSD = 0;

            if (studentDiscount > 0) {
              const isCompleteScholarship = Boolean(
                discountLabel && (
                  discountLabel.includes('complète') ||
                  discountLabel.includes('complete') ||
                  discountLabel.includes('sociale') ||
                  discountLabel.includes('frais divers')
                )
              );

              // Assiette éligible :
              // - Scolarité Pure (Standard) : Seule la scolarité (tuitionHTG / tuitionUSD_raw) est exonérée
              // - Bourse Complète / Sociale : Scolarité + Frais Divers obligatoires
              // Les frais d'admission / réinscription ne sont jamais couverts par une bourse de scolarité
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
                sReductHTG = eligibleHTG * ratio;
                sReductUSD = eligibleUSD_raw * ratio;
              } else {
                sReductHTG = Math.min(eligibleHTG, studentDiscount);
                const overflowHTG = Math.max(0, studentDiscount - sReductHTG);
                if (overflowHTG > 0 && currentExchangeRate > 0) {
                  sReductUSD = Math.min(eligibleUSD_raw, overflowHTG / currentExchangeRate);
                }
              }

              reevaluatedList.push({
                studentId: s.id,
                matricule: s.matricule || s.reference_number || s.nisu || s.id?.slice(0, 8),
                firstName: s.first_name,
                lastName: s.last_name,
                gender: s.gender,
                regime: s.regime || s.boarding_type || null,
                className: studentClassName,
                discountLabel: s.discount_label || 'Bourse / Réduction',
                discountAmountHTG: studentDiscount,
                tuitionHTG,
                tuitionUSD: tuitionUSD_raw,
                miscHTG,
                miscUSD: miscUSD_raw,
                grossHTG: studentGrossHTG,
                grossUSD: studentGrossUSD_raw,
                reductionHTG: sReductHTG,
                reductionUSD: sReductUSD,
                netHTG: Math.max(0, studentGrossHTG - sReductHTG),
                netUSD: Math.max(0, studentGrossUSD_raw - sReductUSD),
                isCompleteScholarship
              });
            }

            const sReductTotalHTG = sReductHTG + (sReductUSD * currentExchangeRate);
            let finalHTG = Math.max(0, studentGrossHTG - sReductHTG);
            let finalUSD = Math.max(0, studentGrossUSD_raw - sReductUSD);
            studentExpected = Math.max(0, studentGross - sReductTotalHTG);
            
            grossExpected += studentGross;
            grossExpectedHTG += studentGrossHTG;
            grossExpectedUSD += studentGrossUSD_raw;

            reductions += sReductTotalHTG;
            reductionsHTG += sReductHTG;
            reductionsUSD += sReductUSD;

            expected += studentExpected;
            expectedHTG += finalHTG;
            expectedUSD += finalUSD;
          }
          
          if (Number(s.discount_amount || 0) > 0) {
            discountedCount++;
          }
          
          // Critical delays: students who paid 0
          const studentPayments = payments?.filter(p => 
            p.student_id === s.id && 
            !p.payment_method?.includes('EN ATTENTE') && 
            !p.payment_method?.includes('REJETÉ') &&
            p.status !== 'ANNULE'
          ) || [];
          const paid = studentPayments.reduce((acc, p) => acc + Number(p.amount_htg_equivalent || p.amount || 0), 0);
          if (paid === 0 && studentExpected > 0) {
            criticalCount++;
          }
        });
        
        // Calculate Economat Penetration Rate
        // Fetch all non-canceled supplies
        let supplyQuery = supabase
          .from('school_supplies')
          .select('student_id, payment_method, status')
          .eq('school_id', user.school_id)
          .eq('academic_year_id', activeYear?.id || '');
          
        if (activeCampusId) {
          supplyQuery = supplyQuery.eq('campus_id', activeCampusId);
        }
        
        const { data: supplyData } = await supplyQuery;
          
        if (supplyData) {
          const validSupplies = supplyData.filter(s => 
            s.status !== 'ANNULE' && 
            !s.payment_method?.includes('EN ATTENTE') && 
            !s.payment_method?.includes('REJETÉ')
          );
          const uniqueBuyers = new Set(validSupplies.map(s => s.student_id).filter(Boolean));
          setEconomatPenetration(activeStudents.length > 0 ? (uniqueBuyers.size / activeStudents.length) * 100 : 0);
        }

        setTotalExpected(expected);
        setTotalExpectedHTG(expectedHTG);
        setTotalExpectedUSD(expectedUSD);
        setTotalGrossExpected(grossExpected);
        setTotalGrossExpectedHTG(grossExpectedHTG);
        setTotalGrossExpectedUSD(grossExpectedUSD);
        setTotalReductions(reductions);
        setTotalReductionsHTG(reductionsHTG);
        setTotalReductionsUSD(reductionsUSD);
        setReevaluatedStudents(reevaluatedList);
        setTotalArrears(expected - tuitionTotal);
        setCollectionRate(expected > 0 ? (tuitionTotal / expected) * 100 : 0);
        setDiscountedStudents(discountedCount);
        setCriticalDelays(criticalCount);
      }
    } catch (error) {
      console.error("Error fetching finance data:", error);
    } finally {
      setLoading(false);
    }
  }, [user?.school_id, currentCampusId]);

  useEffect(() => {
    fetchFinanceData();

    if (!user?.school_id) return;

    const paymentsSub = supabase.channel('financehub_payments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments', filter: `school_id=eq.${user.school_id}` }, () => {
        fetchFinanceData();
      })
      .subscribe();

    const suppliesSub = supabase.channel('financehub_supplies')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'school_supplies', filter: `school_id=eq.${user.school_id}` }, () => {
        fetchFinanceData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'supply_payments' }, () => {
        fetchFinanceData();
      })
      .subscribe();

    const expensesSub = supabase.channel('financehub_expenses')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses', filter: `school_id=eq.${user.school_id}` }, () => {
        fetchFinanceData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(paymentsSub);
      supabase.removeChannel(suppliesSub);
      supabase.removeChannel(expensesSub);
    };
  }, [fetchFinanceData, user?.school_id]);

  const quickActions = [
    { 
      title: 'Encaisser', 
      desc: `${terminology.tuition}, Inscription, Divers`, 
      icon: PlusCircle, 
      path: '/economat/frais', 
      color: 'bg-emerald-600', 
      shadow: 'shadow-emerald-200',
      allowedRoles: [UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.DIRECTOR, UserRole.ACCOUNTANT, UserRole.SECRETARY]
    },
    { 
      title: 'Dépenses', 
      desc: 'Sorties de caisse & charges', 
      icon: ArrowDownRight, 
      path: '/economat/depenses', 
      color: 'bg-rose-600', 
      shadow: 'shadow-rose-200',
      allowedRoles: [UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.DIRECTOR, UserRole.ACCOUNTANT]
    },
    { 
      title: 'Validations', 
      desc: 'Chèques en attente', 
      icon: CalendarCheck, 
      path: '/economat/liste', 
      color: 'bg-indigo-600', 
      shadow: 'shadow-indigo-200',
      allowedRoles: [UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.DIRECTOR, UserRole.ACCOUNTANT]
    },
    { 
      title: 'Fournitures', 
      desc: 'Vente de manuels & kits', 
      icon: Package, 
      path: '/economat/fournitures', 
      color: 'bg-amber-600', 
      shadow: 'shadow-amber-200',
      allowedRoles: [UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.DIRECTOR, UserRole.ACCOUNTANT, UserRole.SECRETARY]
    },
    { 
      title: 'Campagnes & Événements', 
      desc: 'Excursions, visites, cérémonies', 
      icon: Rocket, 
      path: '/economat/frais-occasionnels', 
      color: 'bg-indigo-600', 
      shadow: 'shadow-indigo-200',
      allowedRoles: [UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.DIRECTOR, UserRole.ACCOUNTANT, UserRole.SECRETARY]
    },
    { 
      title: `Suivi ${terminology.student}`, 
      desc: 'État de solvabilité complet', 
      icon: UserSearch, 
      path: '/economat/suivi', 
      color: 'bg-slate-700', 
      shadow: 'shadow-slate-200',
      allowedRoles: [UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.DIRECTOR, UserRole.ACCOUNTANT, UserRole.SECRETARY]
    },
    { 
      title: 'Audit Facturé vs Encaissé', 
      desc: 'Comparatif & Recouvrement par élève', 
      icon: SearchCheck, 
      path: '/economat/releves?tab=audit_data', 
      color: 'bg-teal-600', 
      shadow: 'shadow-teal-200',
      allowedRoles: [UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.DIRECTOR, UserRole.ACCOUNTANT]
    },
    { 
      title: 'Payroll', 
      desc: 'Paiement du personnel', 
      icon: Target, 
      path: '/economat/paie', 
      color: 'bg-slate-800', 
      shadow: 'shadow-slate-300',
      allowedRoles: [UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.DIRECTOR, UserRole.ACCOUNTANT]
    },
    { 
      title: 'Planification Budgétaire', 
      desc: 'Prévisions vs Réel', 
      icon: BarChart3, 
      path: '/economat/budget', 
      color: 'bg-emerald-600', 
      shadow: 'shadow-emerald-200',
      allowedRoles: [UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.DIRECTOR, UserRole.ACCOUNTANT]
    },
    { 
      title: 'Clôture Caisse', 
      desc: 'Rapport quotidien & Verrouillage', 
      icon: ShieldCheck, 
      isModal: true,
      color: 'bg-slate-900', 
      shadow: 'shadow-slate-300',
      allowedRoles: [UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.DIRECTOR, UserRole.ACCOUNTANT, UserRole.SECRETARY]
    },
    { 
      title: 'Audit Financier', 
      desc: 'Historique des modifs', 
      icon: ShieldAlert, 
      path: '/economat/audit', 
      color: 'bg-rose-900', 
      shadow: 'shadow-rose-200',
      allowedRoles: [UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.DIRECTOR, UserRole.ACCOUNTANT]
    }
  ].filter(action => action.allowedRoles.includes(user.role));

  const canViewSensitiveStats = [UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.DIRECTOR, UserRole.ACCOUNTANT].includes(user.role);

  return (
    <div className="max-w-7xl mx-auto space-y-5 sm:space-y-6 lg:space-y-8 animate-in fade-in duration-500 pb-16">
      
      {/* HEADER HUB TITLE BANNER */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-4 sm:p-5 lg:p-6 rounded-2xl shadow-xl text-white border border-slate-800 relative overflow-hidden">
        {/* Subtle decorative background blur shapes */}
        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-1/3 -top-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 rounded-full text-[11px] font-bold uppercase tracking-wider backdrop-blur-md">
              <ShieldCheck size={13} className="text-indigo-400" />
              Unité de Pilotage Financier
            </div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight">
              Direction de l'Économat
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm font-medium max-w-xl leading-relaxed">
              Plateforme centrale de recouvrement, contrôle de caisse quotidien et audit financier académique.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 shrink-0">
            <button
              onClick={() => setIsReevaluationModalOpen(true)}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-sm hover:shadow-indigo-500/25 flex items-center gap-1.5 active:scale-95"
              title="Recalculer l'objectif net après déduction des bourses et réductions d'écolage"
            >
              <Calculator size={16} className="text-white" />
              <span>Réévaluer l'Objectif</span>
            </button>
            <button
              onClick={() => setIsClosureModalOpen(true)}
              className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs sm:text-sm rounded-xl transition-all shadow-sm hover:shadow-emerald-500/25 flex items-center gap-1.5 active:scale-95"
            >
              <ShieldCheck size={16} className="text-slate-950" />
              <span>Rapport Clôture Caisse</span>
            </button>
            <button
              onClick={() => navigate('/economat/frais')}
              className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white font-bold text-xs sm:text-sm rounded-xl transition-all border border-white/15 flex items-center gap-1.5 active:scale-95 backdrop-blur-sm"
            >
              <PlusCircle size={16} className="text-indigo-300" />
              <span>Encaisser un Frais</span>
            </button>
          </div>
        </div>
      </div>

      {/* FINANCIAL KPI SUMMARY CARDS GRID */}
      {canViewSensitiveStats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Card 1: Scolarité */}
          <div className="bg-white p-4 sm:p-4.5 rounded-xl sm:rounded-2xl border border-slate-100 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                {terminology.tuition}
              </span>
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <Receipt size={16} />
              </div>
            </div>

            <div>
              <div className="flex items-baseline justify-between gap-1.5 flex-nowrap min-w-0" title={totalCollectedTuition.toLocaleString()}>
                {loading ? (
                  <RefreshCcw className="animate-spin text-slate-400" size={20} />
                ) : (
                  <>
                    <span className="text-xl sm:text-2xl xl:text-[1.65rem] font-black text-slate-900 font-mono tracking-tight leading-none truncate">
                      {totalCollectedTuition.toLocaleString()}
                    </span>
                    <span className="text-[10px] sm:text-[11px] font-sans font-bold text-slate-500 tracking-normal shrink-0 whitespace-nowrap bg-slate-100/80 px-1.5 py-0.5 rounded-md border border-slate-200/50">
                      HTG{(totalCollectedTuitionUSD > 0 || totalExpectedUSD > 0) ? " eq." : ""}
                    </span>
                  </>
                )}
              </div>

              {!loading && (totalCollectedTuitionUSD > 0 || totalExpectedUSD > 0) && (
                <div className="flex flex-wrap items-center gap-1.5 mt-2.5 pt-2.5 border-t border-slate-100 text-[10px] sm:text-[11px]">
                  <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 font-bold rounded-md border border-emerald-100 whitespace-nowrap">
                    {totalCollectedTuitionHTG.toLocaleString()} HTG
                  </span>
                  <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 font-bold rounded-md border border-blue-100 whitespace-nowrap">
                    {totalCollectedTuitionUSD.toLocaleString()} USD
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Fournitures */}
          <div className="bg-white p-4 sm:p-4.5 rounded-xl sm:rounded-2xl border border-slate-100 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Fournitures & Ventes
              </span>
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <Package size={16} />
              </div>
            </div>

            <div>
              <div className="flex items-baseline justify-between gap-1.5 flex-nowrap min-w-0" title={totalCollectedSupplies.toLocaleString()}>
                {loading ? (
                  <RefreshCcw className="animate-spin text-slate-400" size={20} />
                ) : (
                  <>
                    <span className="text-xl sm:text-2xl xl:text-[1.65rem] font-black text-slate-900 font-mono tracking-tight leading-none truncate">
                      {totalCollectedSupplies.toLocaleString()}
                    </span>
                    <span className="text-[10px] sm:text-[11px] font-sans font-bold text-slate-500 tracking-normal shrink-0 whitespace-nowrap bg-slate-100/80 px-1.5 py-0.5 rounded-md border border-slate-200/50">
                      HTG{(totalCollectedSuppliesUSD > 0 || totalExpectedUSD > 0) ? " eq." : ""}
                    </span>
                  </>
                )}
              </div>

              {!loading && (totalCollectedSuppliesUSD > 0 || totalExpectedUSD > 0) && (
                <div className="flex flex-wrap items-center gap-1.5 mt-2.5 pt-2.5 border-t border-slate-100 text-[10px] sm:text-[11px]">
                  <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 font-bold rounded-md border border-emerald-100 whitespace-nowrap">
                    {totalCollectedSuppliesHTG.toLocaleString()} HTG
                  </span>
                  <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 font-bold rounded-md border border-blue-100 whitespace-nowrap">
                    {totalCollectedSuppliesUSD.toLocaleString()} USD
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Card 3: Recettes Globales */}
          <div className="bg-slate-900 text-white p-4 sm:p-4.5 rounded-xl sm:rounded-2xl shadow-md border border-slate-800 hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                Recettes Globales
              </span>
              <div className="w-8 h-8 rounded-lg bg-slate-800 text-emerald-400 flex items-center justify-center shrink-0 border border-slate-700">
                <DollarSign size={16} />
              </div>
            </div>

            <div>
              <div className="flex items-baseline justify-between gap-1.5 flex-nowrap min-w-0" title={(totalCollectedTuition + totalCollectedSupplies).toLocaleString()}>
                {loading ? (
                  <RefreshCcw className="animate-spin text-slate-400" size={20} />
                ) : (
                  <>
                    <span className="text-xl sm:text-2xl xl:text-[1.65rem] font-black text-white font-mono tracking-tight leading-none truncate">
                      {(totalCollectedTuition + totalCollectedSupplies).toLocaleString()}
                    </span>
                    <span className="text-[10px] sm:text-[11px] font-sans font-bold text-slate-400 tracking-normal shrink-0 whitespace-nowrap bg-slate-800 px-1.5 py-0.5 rounded-md border border-slate-700">
                      HTG{((totalCollectedTuitionUSD + totalCollectedSuppliesUSD) > 0 || totalExpectedUSD > 0) ? " eq." : ""}
                    </span>
                  </>
                )}
              </div>

              {!loading && ((totalCollectedTuitionUSD + totalCollectedSuppliesUSD) > 0 || totalExpectedUSD > 0) && (
                <div className="flex flex-wrap items-center gap-1.5 mt-2.5 pt-2.5 border-t border-slate-800 text-[10px] sm:text-[11px]">
                  <span className="px-1.5 py-0.5 bg-slate-800 text-emerald-300 font-bold rounded-md border border-slate-700 whitespace-nowrap">
                    {(totalCollectedTuitionHTG + totalCollectedSuppliesHTG).toLocaleString()} HTG
                  </span>
                  <span className="px-1.5 py-0.5 bg-slate-800 text-blue-300 font-bold rounded-md border border-slate-700 whitespace-nowrap">
                    {(totalCollectedTuitionUSD + totalCollectedSuppliesUSD).toLocaleString()} USD
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Card 4: Recettes du Jour */}
          <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 text-white p-4 sm:p-4.5 rounded-xl sm:rounded-2xl shadow-lg shadow-emerald-500/10 border border-emerald-500 hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between space-y-3 relative overflow-hidden">
            <div className="flex items-center justify-between relative z-10">
              <span className="text-[11px] font-bold text-emerald-100 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
                Recettes du Jour
              </span>
              <div className="w-8 h-8 rounded-lg bg-white/10 text-white flex items-center justify-center shrink-0 border border-white/20">
                <TrendingUp size={16} />
              </div>
            </div>

            <div className="relative z-10">
              <div className="flex items-baseline justify-between gap-1.5 flex-nowrap min-w-0" title={todayCollectionHTG.toLocaleString()}>
                {loading ? (
                  <RefreshCcw className="animate-spin text-white" size={20} />
                ) : (
                  <>
                    <span className="text-xl sm:text-2xl xl:text-[1.65rem] font-black text-white font-mono tracking-tight leading-none truncate">
                      {todayCollectionHTG.toLocaleString()}
                    </span>
                    <span className="text-[10px] sm:text-[11px] font-sans font-bold text-emerald-200 tracking-normal shrink-0 whitespace-nowrap bg-white/10 px-1.5 py-0.5 rounded-md border border-white/20">
                      HTG
                    </span>
                  </>
                )}
              </div>

              {!loading && (
                <div className="mt-2.5 pt-2.5 border-t border-white/20 text-[10px] sm:text-[11px] font-bold text-emerald-100">
                  <span className="px-2 py-0.5 bg-white/15 rounded-md border border-white/20 inline-block font-mono whitespace-nowrap truncate max-w-full">
                    + {todayCollectionUSD.toLocaleString()} USD (Encaissement Jour)
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* QUICK ACTION GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {quickActions.map((action, idx) => (
          <button
            key={idx}
            onClick={() => {
              if (action.isModal) {
                setIsClosureModalOpen(true);
              } else if (action.path) {
                navigate(action.path);
              }
            }}
            className="group p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-white border border-gray-100 text-left shadow-xs hover:shadow-md hover:border-slate-200 transition-all active:scale-[0.98] flex items-center gap-3.5"
          >
            <div className={`w-10 h-10 rounded-xl ${action.color} text-white flex items-center justify-center shrink-0 shadow-sm ${action.shadow} group-hover:scale-105 transition-transform`}>
              <action.icon size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-xs sm:text-sm font-bold text-gray-900 mb-0.5 truncate">{action.title}</h3>
              <p className="text-[11px] sm:text-xs font-medium text-gray-500 truncate">{action.desc}</p>
            </div>
            <div className="text-gray-300 group-hover:text-gray-600 transition-colors shrink-0">
              <ArrowUpRight size={16} />
            </div>
          </button>
        ))}
      </div>

      {/* BILAN NET & LIQUIDITÉ RÉELLE */}
      {canViewSensitiveStats && (
        <div className="bg-white p-5 sm:p-6 lg:p-7 rounded-2xl shadow-xs border border-gray-200">
          <div className="flex items-center gap-2 text-indigo-600 font-bold text-[10px] tracking-[0.2em] mb-4 sm:mb-5">
            <TrendingUp size={14} />
            ANALYSE DU FLUX DE TRÉSORERIE (BILAN NET)
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
            <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
              <div className="space-y-1.5 min-w-0">
                <p className="text-[10px] font-bold text-gray-500 tracking-wider">RECETTES TOTALES</p>
                <p className="text-lg sm:text-xl xl:text-2xl font-bold text-emerald-600 font-mono" title={`+${netBalance.income.toLocaleString()} HTG`}>+{netBalance.income.toLocaleString()} <span className="text-xs font-sans">HTG</span></p>
                <div className="h-1 w-full bg-emerald-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 w-full"></div>
                </div>
              </div>
              
              <div className="space-y-1.5 min-w-0">
                <p className="text-[10px] font-bold text-gray-500 tracking-wider">DÉPENSES</p>
                <p className="text-lg sm:text-xl xl:text-2xl font-bold text-rose-600 font-mono" title={`-${netBalance.expenses.toLocaleString()} HTG`}>-{netBalance.expenses.toLocaleString()} <span className="text-xs font-sans">HTG</span></p>
                <div className="h-1 w-full bg-rose-100 rounded-full overflow-hidden">
                  <div className="h-full bg-rose-500 w-full"></div>
                </div>
              </div>
              
              <div className="space-y-1.5 min-w-0">
                <p className="text-[10px] font-bold text-gray-500 tracking-wider">SALAIRES PAYÉS</p>
                <p className="text-lg sm:text-xl xl:text-2xl font-bold text-amber-600 font-mono" title={`-${netBalance.salaries.toLocaleString()} HTG`}>-{netBalance.salaries.toLocaleString()} <span className="text-xs font-sans">HTG</span></p>
                <div className="h-1 w-full bg-amber-100 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 w-full"></div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-4 min-w-0">
              <div className={`p-4 sm:p-5 rounded-2xl border-2 ${netBalance.net >= 0 ? 'bg-emerald-50/80 border-emerald-200' : 'bg-amber-50/80 border-amber-200'} flex flex-col justify-center min-w-0 h-full shadow-2xs`}>
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <p className="text-[10px] font-extrabold text-slate-600 tracking-wider uppercase">LIQUIDITÉ RÉELLE NETTE</p>
                  <span className={`px-2 py-0.5 text-[9px] font-black rounded-md ${netBalance.net >= 0 ? 'bg-emerald-200/60 text-emerald-800' : 'bg-amber-200/70 text-amber-900'}`}>
                    {netBalance.net >= 0 ? 'BÉNÉFICIAIRE' : 'DÉFICIT CASH'}
                  </span>
                </div>
                
                <div className="flex flex-col gap-1">
                   <p className={`text-xl sm:text-2xl font-black font-mono tracking-tighter ${netBalance.netHTG >= 0 ? 'text-emerald-700' : 'text-rose-700'}`} title={`Solde Gourdes: ${netBalance.netHTG.toLocaleString()} HTG`}>
                     {netBalance.netHTG.toLocaleString()} <span className="text-xs font-sans tracking-normal">HTG</span>
                   </p>
                   <p className={`text-sm sm:text-base font-bold font-mono tracking-tighter ${netBalance.netUSD >= 0 ? 'text-emerald-600' : 'text-rose-600'}`} title={`Solde Dollars: $${netBalance.netUSD.toLocaleString()} USD`}>
                     {netBalance.netUSD > 0 ? '+' : ''}{netBalance.netUSD.toLocaleString()} <span className="text-[10px] sm:text-xs font-sans tracking-normal">USD</span>
                   </p>
                </div>

                <div className="mt-2.5 pt-2 border-t border-slate-200/80 flex items-center justify-between text-[10px] font-semibold text-slate-600">
                  <span>Solde Consolidé eq. :</span>
                  <span className={`font-mono font-bold ${netBalance.net >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {netBalance.net > 0 ? '+' : ''}{Math.round(netBalance.net).toLocaleString()} HTG
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DASHBOARD PREVIEW */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        <div className={`bg-white p-5 sm:p-6 lg:p-7 rounded-2xl shadow-xs border border-gray-100 space-y-6 sm:space-y-8 ${canViewSensitiveStats ? 'lg:col-span-8' : 'lg:col-span-12'}`}>
          {canViewSensitiveStats && (
            <>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-xl font-black text-gray-900 flex items-center gap-3">
                  <TrendingUp size={24} className="text-indigo-600" />
                  Recouvrement Institutionnel
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsReevaluationModalOpen(true)}
                    className="flex items-center gap-1.5 text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-xl border border-indigo-200 transition-all active:scale-95 shadow-2xs"
                  >
                    <Calculator size={15} />
                    <span>Réévaluer l'Objectif</span>
                  </button>
                  <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-full border border-emerald-100">Live</span>
                </div>
              </div>

          <div className="grid grid-cols-1 gap-8">
            <div className="space-y-6">
              <div className="flex justify-between items-end gap-2 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[9px] sm:text-[10px] font-bold text-gray-500 tracking-wider uppercase" title={`Objectif ${terminology.tuition}`}>
                      Objectif {terminology.tuition} {isTargetReevaluated ? "(Réévalué)" : "(Brut)"}
                    </p>
                    {isTargetReevaluated && (
                      <span className="text-[9px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">Corrigé par bourses</span>
                    )}
                  </div>
                  <p className="text-lg sm:text-xl md:text-2xl lg:text-xl xl:text-2xl font-black text-gray-900 mt-0.5 sm:mt-1" title={(isTargetReevaluated ? totalExpected : totalGrossExpected).toLocaleString()}>
                    {loading ? <RefreshCcw className="animate-spin inline-block mt-1" size={20} /> : (isTargetReevaluated ? totalExpected : totalGrossExpected).toLocaleString()} <span className="text-[10px] sm:text-xs font-sans text-gray-600">HTG{(totalExpectedUSD > 0 || totalGrossExpectedUSD > 0) ? " eq." : ""}</span>
                  </p>
                  {!loading && (
                    <div className="flex flex-col gap-0.5 mt-1.5">
                      <span className="text-[9px] font-black uppercase tracking-wider text-gray-600">
                        {(isTargetReevaluated ? totalExpectedHTG : totalGrossExpectedHTG).toLocaleString()} HTG
                      </span>
                      <span className="text-[9px] font-black uppercase tracking-wider text-indigo-700 font-mono">
                        {(isTargetReevaluated ? totalExpectedUSD : totalGrossExpectedUSD).toLocaleString()} USD
                      </span>
                      {isTargetReevaluated && totalReductionsUSD > 0 && (
                        <span className="text-[8px] text-amber-600 font-bold">
                          (-{totalReductionsUSD.toLocaleString()} USD déduits des bourses)
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="text-right min-w-0 shrink-0">
                  <p className="text-[9px] sm:text-[10px] font-bold text-indigo-500 tracking-wider uppercase" title="Taux de Pénétration">Taux de Pénétration</p>
                  <p className="text-lg sm:text-xl md:text-2xl lg:text-xl xl:text-2xl font-black text-indigo-700 mt-0.5 sm:mt-1" title={`${collectionRate.toFixed(1)}%`}>{collectionRate.toFixed(1)}%</p>
                  
                  {/* Economat penetration addition */}
                  <div className="flex items-center justify-end gap-1 mt-1">
                    <span className="text-[8px] sm:text-[9px] font-bold text-amber-500 tracking-wider uppercase">Économat:</span>
                    <span className="text-[10px] sm:text-xs font-black text-amber-600">{economatPenetration.toFixed(1)}%</span>
                  </div>
                </div>
              </div>

              <div className="relative pt-2 pb-4">
                <div className="flex justify-between items-start text-[9px] sm:text-[11px] font-bold mb-3 gap-2 flex-wrap">
                  <span className="text-indigo-600 bg-indigo-50 px-2 sm:px-3 py-1 rounded-full border border-indigo-100" title={`Encaissement ${(totalCollectedTuitionUSD > 0 || totalExpectedUSD > 0) ? "eq. " : ""}: ${totalCollectedTuition.toLocaleString()} HTG`}>Encaissement {(totalCollectedTuitionUSD > 0 || totalExpectedUSD > 0) ? "eq. " : ""}: <span className="whitespace-nowrap">{totalCollectedTuition.toLocaleString()} HTG</span></span>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-gray-600 bg-gray-100 px-2 sm:px-3 py-1 rounded-full border border-gray-200" title={`Reste ${(totalCollectedTuitionUSD > 0 || totalExpectedUSD > 0) ? "eq. " : ""}: ${Math.max(0, totalExpected - totalCollectedTuition).toLocaleString()} HTG`}>Reste {(totalCollectedTuitionUSD > 0 || totalExpectedUSD > 0) ? "eq. " : ""}: <span className="whitespace-nowrap">{Math.max(0, totalExpected - totalCollectedTuition).toLocaleString()} HTG</span></span>
                    {!loading && (totalCollectedTuitionUSD > 0 || totalExpectedUSD > 0) && (
                      <div className="flex gap-2 text-gray-600 px-1 opacity-90">
                        <span className="text-[9px] uppercase">{Math.max(0, totalExpectedHTG - totalCollectedTuitionHTG).toLocaleString()} HTG</span>
                        <span className="text-[9px] uppercase">{Math.max(0, totalExpectedUSD - totalCollectedTuitionUSD).toLocaleString()} USD</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="h-4 sm:h-5 bg-gray-100 rounded-full overflow-hidden border border-gray-200 p-0.5">
                  <div 
                    className="h-full bg-indigo-600 rounded-full transition-all duration-1000 relative" 
                    style={{ width: `${totalExpected > 0 ? Math.min(100, (totalCollectedTuition / totalExpected) * 100) : 0}%` }}
                  >
                     <div className="absolute top-0 right-0 bottom-0 left-0 bg-white/20 animate-[pulse_2s_ease-in-out_infinite]"></div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:gap-4 mt-6 sm:mt-8">
                  <div className="bg-emerald-50 rounded-xl p-3 sm:p-4 border border-emerald-100 overflow-hidden min-w-0 flex flex-col justify-center">
                    <div className="flex flex-col 2xl:flex-row 2xl:items-center gap-1 sm:gap-1.5 text-emerald-600 mb-1 sm:mb-2">
                      <CheckCircle size={14} className="shrink-0 hidden 2xl:block" />
                      <p className="text-[8px] sm:text-[9px] font-black uppercase tracking-wider sm:tracking-widest leading-tight sm:leading-none" title={`${terminology.tuition} Récoltée`}>{terminology.tuition} Récoltée</p>
                    </div>
                    <p className="text-sm sm:text-base lg:text-xl xl:text-lg 2xl:text-2xl font-bold text-emerald-700 tracking-tight" title={totalCollectedTuition.toLocaleString()}>{totalCollectedTuition.toLocaleString()} <span className="text-[9px] sm:text-xs font-medium">HTG{(totalCollectedTuitionUSD > 0 || totalExpectedUSD > 0) ? " eq." : ""}</span></p>
                    {!loading && (totalCollectedTuitionUSD > 0 || totalExpectedUSD > 0) && (
                      <div className="flex flex-col gap-0.5 mt-1.5">
                        <span className="text-[9px] font-black uppercase tracking-wider text-emerald-600/70">{totalCollectedTuitionHTG.toLocaleString()} HTG</span>
                        <span className="text-[9px] font-black uppercase tracking-wider text-emerald-600/70">{totalCollectedTuitionUSD.toLocaleString()} USD</span>
                      </div>
                    )}
                  </div>
                  <div className="bg-rose-50 rounded-xl p-3 sm:p-4 border border-rose-100 overflow-hidden min-w-0 flex flex-col justify-center">
                    <div className="flex flex-col 2xl:flex-row 2xl:items-center gap-1 sm:gap-1.5 text-rose-600 mb-1 sm:mb-2">
                       <AlertCircle size={14} className="shrink-0 hidden 2xl:block" />
                       <p className="text-[8px] sm:text-[9px] font-black uppercase tracking-wider sm:tracking-widest leading-tight sm:leading-none" title="Reste à recouvrer">Reste à recouvrer</p>
                    </div>
                    <p className="text-sm sm:text-base lg:text-xl xl:text-lg 2xl:text-2xl font-bold text-rose-700 tracking-tight" title={totalArrears.toLocaleString()}>{totalArrears.toLocaleString()} <span className="text-[9px] sm:text-xs font-medium">HTG</span></p>
                  </div>
              </div>
            </div>
          </div>
          </>
          )}

          {/* RECENT TRANSACTIONS LIST */}
          <div className={canViewSensitiveStats ? "pt-6 border-t border-gray-100" : ""}>
            <div className="flex items-center justify-between mb-6">
              <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <ClipboardList size={16} className="text-gray-500" />
                Dernières Opérations (Aujourd'hui)
              </h4>
              {canViewSensitiveStats && (
                <button onClick={() => navigate('/economat/liste')} className="text-xs font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-700">
                  Tout le registre
                </button>
              )}
            </div>
            
            <div className="space-y-3">
              {loading ? (
                <div className="text-center py-8 text-gray-500">
                  <RefreshCcw className="animate-spin inline-block mb-2" size={24} />
                  <p className="text-sm font-medium">Chargement...</p>
                </div>
              ) : recentTransactions.length > 0 ? (
                recentTransactions.map((tx, i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${tx.bg} ${tx.color}`}>
                        <tx.icon size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{tx.type}</p>
                        <p className="text-xs font-medium text-gray-500">{tx.date.toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})} • {tx.method}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900 font-mono">+{tx.currencyAmount ? tx.currencyAmount.toLocaleString() : tx.amount.toLocaleString()} {tx.currency || 'HTG'}</p>
                      {tx.currency === 'USD' && (
                        <p className="text-[10px] text-gray-500 font-medium">({tx.amount.toLocaleString()} HTG eq.)</p>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  <p className="text-sm font-medium text-gray-500">Aucune transaction aujourd'hui</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {canViewSensitiveStats && (
        <div className="lg:col-span-4 bg-white p-8 rounded-2xl shadow-sm border border-slate-200 space-y-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-full -mr-16 -mt-16 opacity-50"></div>
          
          <div className="flex items-center justify-between relative z-10">
            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-3">
              <Target size={24} className="text-indigo-600" />
              Alertes Solvabilité
            </h3>
            <div className="w-10 h-10 bg-slate-100 text-slate-600 rounded-xl flex items-center justify-center">
              <ClipboardList size={20} />
            </div>
          </div>

          <div className="space-y-4 relative z-10">
            {[
              { label: 'Réévaluations validées', count: `${loading ? '...' : discountedStudents} Dossiers`, color: 'text-amber-600', borderColor: 'border-l-amber-500', path: '/economat/rapport-reductions' },
              { label: 'Paiements en attente', count: `${loading ? '...' : pendingPayments} Sessions`, color: 'text-indigo-600', borderColor: 'border-l-indigo-500', path: '/economat/liste', state: { filterStatus: 'En attente' } },
            ].map((item, i) => (
              <div 
                key={i} 
                onClick={() => navigate(item.path, { state: item.state })}
                className={`flex justify-between items-center p-4 bg-slate-50 border-l-4 ${item.borderColor} rounded-r-xl cursor-pointer hover:bg-slate-100 transition-all group`}
              >
                <p className="text-sm font-semibold text-slate-700">{item.label}</p>
                <div className="flex items-center gap-2">
                  <p className={`text-sm font-bold ${item.color}`}>{item.count}</p>
                  <ArrowUpRight size={14} className="text-slate-300 group-hover:text-slate-600 transition-colors" />
                </div>
              </div>
            ))}
          </div>
          
          <button 
            onClick={() => navigate('/economat/suivi')}
            className="w-full py-4 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 flex items-center justify-center gap-2"
          >
            <ArrowRight size={18} />
            Rapport Complet de Solvabilité
          </button>
        </div>
        )}
      </div>

      {/* MODAL DE RÉÉVALUATION & VENTILATION DE L'OBJECTIF FINANCIER */}
      <ReevaluationModal
        isOpen={isReevaluationModalOpen}
        onClose={() => setIsReevaluationModalOpen(false)}
        reevaluatedStudents={reevaluatedStudents}
        totalGrossExpectedHTG={totalGrossExpectedHTG}
        totalGrossExpectedUSD={totalGrossExpectedUSD}
        totalReductionsHTG={totalReductionsHTG}
        totalReductionsUSD={totalReductionsUSD}
        totalExpectedHTG={totalExpectedHTG}
        totalExpectedUSD={totalExpectedUSD}
        discountedStudents={discountedStudents}
        isTargetReevaluated={isTargetReevaluated}
        onToggleTargetReevaluated={() => setIsTargetReevaluated(!isTargetReevaluated)}
        onConfirmReevaluation={() => setIsTargetReevaluated(true)}
        exchangeRate={exchangeRate}
        school={school}
        user={user}
        terminology={terminology}
      />

      <DailyCashClosureModal
        isOpen={isClosureModalOpen}
        onClose={() => setIsClosureModalOpen(false)}
        user={user}
        onClosureUpdated={fetchFinanceData}
      />
    </div>
  );
};

export default FinanceHub;