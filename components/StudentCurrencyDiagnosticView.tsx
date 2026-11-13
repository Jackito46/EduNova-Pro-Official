import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Activity,
  DollarSign,
  ShieldCheck,
  AlertTriangle,
  Receipt,
  CheckCircle2,
  Printer,
  Copy,
  Check,
  ArrowLeft,
  ArrowRightLeft,
  Search,
  Calculator,
  FileCheck2,
  RefreshCcw,
  Users,
  Eye,
  Info,
  Building2,
  RotateCcw,
  Coins
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase, isValidUuid } from '../supabase';
import { UserProfile } from '../types';
import { useSchool } from '../contexts/SchoolContext';
import { formatStudentName } from '../utils/formatters';
import { computeFeeCategoryBalance } from '../utils/financeCalculations';
import { isPaymentCompleted, isWalletDeposit } from '../src/utils/payment';
import { ResponsiveTableWrapper } from './ResponsiveTableWrapper';

interface StudentCurrencyDiagnosticViewProps {
  user?: UserProfile;
}

interface ReceiptAuditItem {
  id: string;
  studentId: string;
  studentName: string;
  className: string;
  date: string;
  rawDate: string;
  ref: string;
  categoryLabel: string;
  originalCurrency: string;
  originalAmount: number;
  appliedRate: number | null;
  sealedPrimary: number;
  currentRateValuePrimary: number;
  deltaPrimary: number;
  paymentMethod: string;
}

interface StudentDiagnosticRow {
  studentId: string;
  matricule: string;
  fullName: string;
  classId: string;
  className: string;
  isReturning: boolean;
  hasForeignCurrencyFees: boolean;
  plannedPrimaryRaw: number;
  plannedSecondaryUSD: number;
  grossPlannedPrimary: number;
  discountAppliedPrimary: number;
  discountLabel: string;
  additionPrimary: number;
  theoreticalDuePrimary: number;
  sealedEngagementPrimary: number;
  auditDeltaPrimary: number;
  paidPrimaryEquiv: number;
  paidPrimaryDirect: number;
  paidUSDDirect: number;
  remainingPrimaryEquiv: number;
  remainingPrimaryDirect: number;
  remainingUSDDirect: number;
  isFullySettled: boolean;
  auditStatus: 'VARIANCE' | 'SETTLED' | 'OUTSTANDING';
  receipts: ReceiptAuditItem[];
  categories: {
    label: string;
    plannedPrimary: number;
    plannedUSD: number;
    theoreticalPrimary: number;
    sealedEngagementPrimary: number;
    paidPrimaryEquiv: number;
    remainingPrimaryEquiv: number;
    isPaid: boolean;
  }[];
}

type DiagnosticTab = 'registry' | 'student' | 'receipts' | 'rules' | 'simulator';
type AuditFilter = 'ALL' | 'VARIANCE' | 'SETTLED' | 'OUTSTANDING';

const roundMoney = (val: number) => Math.round(Number.isFinite(val) ? val : 0);

const isCampaignPayment = (p: any, activeCampaigns: any[]): boolean => {
  const nat = String(p.nature || p.type || p.fee_type || p.description || '').toLowerCase();
  return Boolean(
    p.ad_hoc_campaign_id ||
      p.campaign_id ||
      String(p.fee_type || '').toUpperCase() === 'AD_HOC' ||
      String(p.fee_type || '').toUpperCase() === 'CAMPAGNE' ||
      String(p.fee_type || '').toUpperCase() === 'CAMPAIGN' ||
      String(p.rubrique || '').toLowerCase().includes('campagne') ||
      nat.includes('campagne') ||
      nat.includes('parascolaire') ||
      p.campaign?.id ||
      activeCampaigns.some((c: any) => {
        const campName = String(c.name || '').toLowerCase();
        return Boolean(
          campName &&
            nat &&
            (nat.includes(campName) || (campName.includes('assurance') && nat.includes('assurance')))
        );
      })
  );
};

const isAdmissionPayment = (p: any): boolean => {
  const feeType = String(p.fee_type || '').toLowerCase();
  const nature = String(p.nature || '').toLowerCase();
  const type = String(p.type || '').toLowerCase();
  const desc = String(p.description || '').toLowerCase();
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
    desc.includes('réinscri')
  );
};

const isMiscPayment = (p: any): boolean => {
  const feeType = String(p.fee_type || '').toLowerCase();
  const nature = String(p.nature || '').toLowerCase();
  const type = String(p.type || '').toLowerCase();
  const desc = String(p.description || '').toLowerCase();
  return (
    feeType.includes('divers') ||
    nature.includes('divers') ||
    type.includes('divers') ||
    desc.includes('divers')
  );
};

export const StudentCurrencyDiagnosticView: React.FC<StudentCurrencyDiagnosticViewProps> = ({ user }) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { school, terminology, currentCampusId, campuses, activeAcademicYear } = useSchool();

  const isMultiCurrencyEnabled = Boolean(school?.global_settings?.multi_currency_enabled);
  const primaryCurrency = school?.global_settings?.primary_currency || 'HTG';
  const secondaryCurrency = school?.global_settings?.secondary_currency || 'USD';

  const queryStudentId = searchParams.get('student_id') || '';

  const [activeTab, setActiveTab] = useState<DiagnosticTab>(queryStudentId ? 'student' : 'registry');
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Raw DB State
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<string>('');
  const [classesData, setClassesData] = useState<any[]>([]);
  const [studentsData, setStudentsData] = useState<any[]>([]);
  const [enrollmentsData, setEnrollmentsData] = useState<any[]>([]);
  const [feePlansData, setFeePlansData] = useState<any[]>([]);
  const [paymentsData, setPaymentsData] = useState<any[]>([]);
  const [adHocFeesData, setAdHocFeesData] = useState<any[]>([]);
  const [schoolConfiguredRate, setSchoolConfiguredRate] = useState<number>(
    Number(school?.exchange_rate || 135)
  );
  const [exchangeRate, setExchangeRate] = useState<number>(
    Number(school?.exchange_rate || 135)
  );
  const hasInitializedRateRef = useRef<boolean>(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [classFilter, setClassFilter] = useState<string>('ALL');
  const [auditFilter, setAuditFilter] = useState<AuditFilter>('ALL');
  const [selectedStudentId, setSelectedStudentId] = useState<string>(queryStudentId);

  // Interactive Économat Simulator State
  const [simBasePrimary, setSimBasePrimary] = useState<number>(65000);
  const [simDiscountPrimary, setSimDiscountPrimary] = useState<number>(0);
  const [simPaidPrimary, setSimPaidPrimary] = useState<number>(65000);
  const [simUsdTarget, setSimUsdTarget] = useState<number>(200);
  const [simUsdPaid1, setSimUsdPaid1] = useState<number>(80);
  const [simUsdRate1, setSimUsdRate1] = useState<number>(135);

  const activeCampusId = user?.campus_id || currentCampusId || null;
  const activeCampusName = useMemo(() => {
    if (!activeCampusId) return campuses.length > 1 ? 'Tous les campus' : null;
    return campuses.find((c) => c.id === activeCampusId)?.name || 'Campus actif';
  }, [activeCampusId, campuses]);

  const loadDiagnosticData = useCallback(
    async (silent = false) => {
      if (!user?.school_id) {
        setLoading(false);
        return;
      }
      if (!silent) setLoading(true);
      else setRefreshing(true);

      try {
        let studentsQuery = supabase
          .from('students')
          .select(
            'id, reference_number, first_name, last_name, status, class_id, campus_id, discount_amount, discount_label, is_foreign'
          )
          .eq('school_id', user.school_id);
        if (activeCampusId && isValidUuid(activeCampusId)) {
          studentsQuery = studentsQuery.eq('campus_id', activeCampusId);
        }

        let paymentsQuery = supabase
          .from('payments')
          .select(
            'id, student_id, amount, amount_htg_equivalent, amount_usd_equivalent, currency, exchange_rate_applied, payment_method, status, moncash_status, fee_type, nature, description, receipt_number, reference_number, transaction_reference, ad_hoc_campaign_id, academic_year_id, campus_id, created_at, payment_date, campaign:ad_hoc_campaigns(id, name, currency, amount)'
          )
          .eq('school_id', user.school_id)
          .order('created_at', { ascending: false });
        if (activeCampusId && isValidUuid(activeCampusId)) {
          paymentsQuery = paymentsQuery.eq('campus_id', activeCampusId);
        }

        let classesQuery = supabase
          .from('classes')
          .select('id, name, campus_id')
          .eq('school_id', user.school_id)
          .order('name', { ascending: true });
        if (activeCampusId && isValidUuid(activeCampusId)) {
          classesQuery = classesQuery.or(`campus_id.eq.${activeCampusId},campus_id.is.null`);
        }

        const [
          yearsRes,
          classesRes,
          studentsRes,
          enrollmentsRes,
          plansRes,
          paymentsRes,
          adHocRes,
          rateRes
        ] = await Promise.all([
          supabase
            .from('academic_years')
            .select('id, label, status, is_active, created_at')
            .eq('school_id', user.school_id)
            .order('created_at', { ascending: false }),
          classesQuery,
          studentsQuery,
          supabase
            .from('enrollments')
            .select('student_id, academic_year_id, class_id, tuition_discount, tuition_addition')
            .eq('school_id', user.school_id),
          supabase.from('fee_plans').select('*').eq('school_id', user.school_id),
          paymentsQuery,
          supabase
            .from('student_ad_hoc_fees')
            .select(
              'id, student_id, custom_amount, adjustment_reason, campaign:ad_hoc_campaigns!campaign_id(id, name, amount, currency, academic_year_id)'
            )
            .eq('school_id', user.school_id),
          supabase
            .from('exchange_rates')
            .select('*')
            .eq('school_id', user.school_id)
            .order('effective_date', { ascending: false })
            .limit(1)
        ]);

        const years = yearsRes.data || [];
        setAcademicYears(years);
        setSelectedYearId((prev) => {
          if (prev && years.some((y: any) => y.id === prev)) return prev;
          if (activeAcademicYear?.id && years.some((y: any) => y.id === activeAcademicYear.id)) {
            return activeAcademicYear.id;
          }
          const active = years.find((y: any) => y.is_active || y.status === 'ACTIVE') || years[0];
          return active?.id || '';
        });

        setClassesData(classesRes.data || []);
        setStudentsData(studentsRes.data || []);
        setEnrollmentsData(enrollmentsRes.data || []);
        setFeePlansData(plansRes.data || []);
        setPaymentsData(paymentsRes.data || []);
        setAdHocFeesData(adHocRes.data || []);

        const latestRate = Number(
          rateRes.data?.[0]?.rate_usd_to_htg ||
            rateRes.data?.[0]?.rate ||
            school?.exchange_rate ||
            135
        );
        if (latestRate > 0) {
          setSchoolConfiguredRate(latestRate);
          if (!hasInitializedRateRef.current) {
            setExchangeRate(latestRate);
            setSimUsdRate1(Math.max(50, Math.round(latestRate - 5)));
            hasInitializedRateRef.current = true;
          }
        }
      } catch (err) {
        console.error('Erreur chargement Diagnostic Barème & Devises:', err);
        toast.error('Impossible de charger les données financières de l’établissement.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user?.school_id, activeCampusId, activeAcademicYear?.id, school?.exchange_rate]
  );

  useEffect(() => {
    loadDiagnosticData(false);
  }, [loadDiagnosticData]);

  // Synchronize URL student_id if navigated directly
  useEffect(() => {
    if (queryStudentId) {
      setSelectedStudentId(queryStudentId);
      setActiveTab('student');
    }
  }, [queryStudentId]);

  const effectiveYear = useMemo(() => {
    return (
      academicYears.find((y) => y.id === selectedYearId) ||
      activeAcademicYear ||
      academicYears.find((y) => y.is_active || y.status === 'ACTIVE') ||
      academicYears[0] ||
      null
    );
  }, [academicYears, selectedYearId, activeAcademicYear]);

  const targetYearId = effectiveYear?.id || '';

  // Active Fee Plans & Foreign Currency Detection across real data
  const activePlansForYear = useMemo(() => {
    const yearPlans = targetYearId
      ? feePlansData.filter((p) => !p.academic_year_id || p.academic_year_id === targetYearId)
      : feePlansData;
    return yearPlans.length > 0 ? yearPlans : feePlansData;
  }, [feePlansData, targetYearId]);

  const validSchoolPayments = useMemo(() => {
    return paymentsData.filter((p) => isPaymentCompleted(p) && !isWalletDeposit(p));
  }, [paymentsData]);

  const hasForeignCurrencyData = useMemo(() => {
    const planHasUsd = activePlansForYear.some(
      (p) =>
        Number(p.inscription_fee_usd || 0) > 0 ||
        Number(p.reenrollment_fee_usd || 0) > 0 ||
        Number(p.tuition_fee_usd || 0) > 0 ||
        (p.is_misc_mandatory && Number(p.misc_fee_usd || 0) > 0)
    );
    const campaignHasUsd = adHocFeesData.some((f) => {
      const c = Array.isArray(f.campaign) ? f.campaign[0] : f.campaign;
      if (!c) return false;
      if (targetYearId && c.academic_year_id && c.academic_year_id !== targetYearId) return false;
      const amt = f.custom_amount !== null && f.custom_amount !== undefined ? Number(f.custom_amount) : Number(c.amount || 0);
      return c.currency === 'USD' && amt > 0;
    });
    const paymentHasUsd = validSchoolPayments.some((p) => {
      if (targetYearId && p.academic_year_id && p.academic_year_id !== targetYearId) return false;
      return p.currency === 'USD';
    });
    return planHasUsd || campaignHasUsd || paymentHasUsd;
  }, [activePlansForYear, adHocFeesData, validSchoolPayments, targetYearId]);

  const activeRate = isMultiCurrencyEnabled
    ? exchangeRate > 0
      ? exchangeRate
      : schoolConfiguredRate || 135
    : 1;

  // Dynamic rate presets around the school's real configured rate (only shown in multi-currency)
  const ratePresets = useMemo(() => {
    const base = Math.round(schoolConfiguredRate || 135);
    const raw = [Math.max(50, base - 5), base, base + 5];
    return Array.from(new Set(raw));
  }, [schoolConfiguredRate]);

  // Compute consolidated school-wide rows for EVERY student in the selected year
  const studentRows = useMemo<StudentDiagnosticRow[]>(() => {
    if (!studentsData.length) return [];

    const classesMap = new Map<string, string>();
    classesData.forEach((c) => classesMap.set(c.id, c.name));

    const plansMap = new Map<string, any>();
    activePlansForYear.forEach((p) => plansMap.set(p.class_id, p));

    // Index enrollments by student
    const enrollmentsByStudent = new Map<string, any[]>();
    enrollmentsData.forEach((e) => {
      const list = enrollmentsByStudent.get(e.student_id) || [];
      list.push(e);
      enrollmentsByStudent.set(e.student_id, list);
    });

    // Index payments by student
    const paymentsByStudent = new Map<string, any[]>();
    validSchoolPayments.forEach((p) => {
      if (!p.student_id) return;
      const list = paymentsByStudent.get(p.student_id) || [];
      list.push(p);
      paymentsByStudent.set(p.student_id, list);
    });

    // Index ad-hoc campaigns by student
    const adHocByStudent = new Map<string, any[]>();
    adHocFeesData.forEach((fee) => {
      const camp = Array.isArray(fee.campaign) ? fee.campaign[0] : fee.campaign;
      if (!camp) return;
      if (targetYearId && camp.academic_year_id && camp.academic_year_id !== targetYearId) return;
      const list = adHocByStudent.get(fee.student_id) || [];
      list.push({
        ...camp,
        custom_amount: fee.custom_amount,
        adjustment_reason: fee.adjustment_reason
      });
      adHocByStudent.set(fee.student_id, list);
    });

    // Determine active cohort for targetYearId (matching FinanceHub logic)
    const enrolledInTargetIds = new Set(
      enrollmentsData
        .filter((e) => !targetYearId || e.academic_year_id === targetYearId)
        .map((e) => e.student_id)
    );

    const cohortStudents =
      enrolledInTargetIds.size > 0
        ? studentsData.filter((s) => enrolledInTargetIds.has(s.id))
        : studentsData.filter(
            (s) => s.status === 'Actif' || s.status === 'ACTIVE' || !s.status
          );

    const rows: StudentDiagnosticRow[] = cohortStudents.map((student) => {
      const stuEnrollments = enrollmentsByStudent.get(student.id) || [];
      const currentEnrollment = targetYearId
        ? stuEnrollments.find((e) => e.academic_year_id === targetYearId) || null
        : stuEnrollments[0] || null;
      const otherEnrollments = targetYearId
        ? stuEnrollments.filter((e) => e.academic_year_id !== targetYearId)
        : [];

      const hasPreviousEnrollment = otherEnrollments.length > 0;
      const effectiveClassId = currentEnrollment?.class_id || student.class_id || '';
      const plan = plansMap.get(effectiveClassId) || plansMap.get(student.class_id) || null;
      const className =
        classesMap.get(effectiveClassId) ||
        classesMap.get(student.class_id) ||
        plan?.class_name ||
        'Non classé';

      const formatted = formatStudentName(student.last_name, student.first_name);
      const studentActiveCampaigns = adHocByStudent.get(student.id) || [];

      // Filter student's valid payments for this academic year
      const allStuPayments = paymentsByStudent.get(student.id) || [];
      const yearPayments = allStuPayments.filter((p) => {
        if (!targetYearId) return true;
        if (p.academic_year_id === targetYearId) return true;
        if (!p.academic_year_id) return !hasPreviousEnrollment;
        const enrolledInPayYear = otherEnrollments.some(
          (e) => e.academic_year_id === p.academic_year_id
        );
        return !enrolledInPayYear && Boolean(currentEnrollment);
      });

      const admissionPayments = yearPayments.filter(
        (p) => !isCampaignPayment(p, studentActiveCampaigns) && isAdmissionPayment(p)
      );
      const campaignPayments = yearPayments.filter((p) =>
        isCampaignPayment(p, studentActiveCampaigns)
      );
      const miscPayments = yearPayments.filter(
        (p) =>
          !isCampaignPayment(p, studentActiveCampaigns) &&
          !isAdmissionPayment(p) &&
          isMiscPayment(p)
      );
      const tuitionPayments = yearPayments.filter(
        (p) =>
          !isCampaignPayment(p, studentActiveCampaigns) &&
          !isAdmissionPayment(p) &&
          !isMiscPayment(p)
      );

      // Planned fees per category (in mono-currency mode, ignore any stale USD fee columns)
      const admPrimary = plan
        ? hasPreviousEnrollment
          ? Number(plan.reenrollment_fee || 0)
          : Number(plan.inscription_fee || 0)
        : 0;
      const admUSD =
        isMultiCurrencyEnabled && plan
          ? hasPreviousEnrollment
            ? Number(plan.reenrollment_fee_usd || 0)
            : Number(plan.inscription_fee_usd || 0)
          : 0;

      const rawPlanTuitionPrimary = plan
        ? student.is_foreign && plan.foreign_tuition_fee
          ? Number(plan.foreign_tuition_fee)
          : Number(plan.tuition_fee || 0)
        : 0;
      const tuitionAddition = Number(currentEnrollment?.tuition_addition || 0);
      const tuitionPrimary = rawPlanTuitionPrimary + tuitionAddition;
      const tuitionUSD = isMultiCurrencyEnabled && plan ? Number(plan.tuition_fee_usd || 0) : 0;

      const miscPrimary =
        plan && plan.is_misc_mandatory ? Number(plan.misc_fee_htg || 0) : 0;
      const miscUSD =
        isMultiCurrencyEnabled && plan && plan.is_misc_mandatory
          ? Number(plan.misc_fee_usd || 0)
          : 0;

      let campPrimary = 0;
      let campUSD = 0;
      studentActiveCampaigns.forEach((c) => {
        const req =
          c.custom_amount !== null && c.custom_amount !== undefined
            ? Number(c.custom_amount)
            : Number(c.amount || 0);
        if (isMultiCurrencyEnabled && c.currency === 'USD') campUSD += req;
        else campPrimary += req;
      });

      // Discounts / Scholarships
      const totalDiscountRaw =
        Number(currentEnrollment?.tuition_discount || 0) +
        Number(student.discount_amount || 0);
      const discountLabel = student.discount_label || (totalDiscountRaw > 0 ? 'Bourse / Réduction' : '');
      const labelLower = discountLabel.toLowerCase();
      const isCompleteScholarship = Boolean(
        discountLabel &&
          (labelLower.includes('complète') ||
            labelLower.includes('complete') ||
            labelLower.includes('sociale') ||
            labelLower.includes('frais divers') ||
            labelLower.includes('intégrale'))
      );

      const tuitionTheoreticalGross = tuitionPrimary + tuitionUSD * activeRate;
      const miscTheoreticalGross = miscPrimary + miscUSD * activeRate;

      let tuitionDiscountApplied = Math.min(tuitionTheoreticalGross, totalDiscountRaw);
      let miscDiscountApplied = 0;
      if (isCompleteScholarship && totalDiscountRaw > tuitionDiscountApplied) {
        miscDiscountApplied = Math.min(
          miscTheoreticalGross,
          totalDiscountRaw - tuitionDiscountApplied
        );
      }

      const admBreakdown = computeFeeCategoryBalance(
        admPrimary,
        admUSD,
        admissionPayments,
        activeRate,
        0
      );
      const tuitionBreakdown = computeFeeCategoryBalance(
        tuitionPrimary,
        tuitionUSD,
        tuitionPayments,
        activeRate,
        tuitionDiscountApplied
      );
      const miscBreakdown = computeFeeCategoryBalance(
        miscPrimary,
        miscUSD,
        miscPayments,
        activeRate,
        miscDiscountApplied
      );
      const campBreakdown = computeFeeCategoryBalance(
        campPrimary,
        campUSD,
        campaignPayments,
        activeRate,
        0
      );

      const plannedPrimaryRaw = admPrimary + rawPlanTuitionPrimary + miscPrimary + campPrimary;
      const plannedSecondaryUSD = admUSD + tuitionUSD + miscUSD + campUSD;
      const grossPlannedPrimary = roundMoney(
        plannedPrimaryRaw + plannedSecondaryUSD * activeRate
      );

      const admTheoretical = roundMoney(admPrimary + admUSD * activeRate);
      const tuitionTheoretical = roundMoney(
        Math.max(0, tuitionTheoreticalGross - tuitionDiscountApplied)
      );
      const miscTheoretical = roundMoney(
        Math.max(0, miscTheoreticalGross - miscDiscountApplied)
      );
      const campTheoretical = roundMoney(campPrimary + campUSD * activeRate);

      const theoreticalDuePrimary =
        admTheoretical + tuitionTheoretical + miscTheoretical + campTheoretical;

      const sealedEngagementPrimary = roundMoney(
        admBreakdown.effectiveDueHTG +
          tuitionBreakdown.effectiveDueHTG +
          miscBreakdown.effectiveDueHTG +
          campBreakdown.effectiveDueHTG
      );

      const paidPrimaryEquiv = roundMoney(
        admBreakdown.paidHTGEquiv +
          tuitionBreakdown.paidHTGEquiv +
          miscBreakdown.paidHTGEquiv +
          campBreakdown.paidHTGEquiv
      );

      const paidPrimaryDirect = roundMoney(
        admBreakdown.paidHTGDirect +
          tuitionBreakdown.paidHTGDirect +
          miscBreakdown.paidHTGDirect +
          campBreakdown.paidHTGDirect
      );

      const paidUSDDirect =
        Math.round(
          (admBreakdown.paidUSDDirect +
            tuitionBreakdown.paidUSDDirect +
            miscBreakdown.paidUSDDirect +
            campBreakdown.paidUSDDirect) *
            100
        ) / 100;

      const remainingPrimaryDirect =
        (admBreakdown.isPaid ? 0 : admBreakdown.remainingHTG) +
        (tuitionBreakdown.isPaid ? 0 : tuitionBreakdown.remainingHTG) +
        (miscBreakdown.isPaid ? 0 : miscBreakdown.remainingHTG) +
        (campBreakdown.isPaid ? 0 : campBreakdown.remainingHTG);

      const remainingUSDDirect =
        Math.round(
          ((admBreakdown.isPaid ? 0 : admBreakdown.remainingUSD) +
            (tuitionBreakdown.isPaid ? 0 : tuitionBreakdown.remainingUSD) +
            (miscBreakdown.isPaid ? 0 : miscBreakdown.remainingUSD) +
            (campBreakdown.isPaid ? 0 : campBreakdown.remainingUSD)) *
            100
        ) / 100;

      const remainingPrimaryEquiv = roundMoney(
        (admBreakdown.isPaid ? 0 : admBreakdown.remainingHTGEquiv) +
          (tuitionBreakdown.isPaid ? 0 : tuitionBreakdown.remainingHTGEquiv) +
          (miscBreakdown.isPaid ? 0 : miscBreakdown.remainingHTGEquiv) +
          (campBreakdown.isPaid ? 0 : campBreakdown.remainingHTGEquiv)
      );

      const isFullySettled =
        (remainingPrimaryDirect <= 0 && remainingUSDDirect <= 0) ||
        remainingPrimaryEquiv <= 50;

      // In Multi-Currency: Variance = Theoretical at current rate vs Sealed Engagement
      // In Mono-Currency: Variance = Gross Official Class Plan vs Net Sealed Engagement (captures discounts, additions, rounding)
      const auditDeltaPrimary = isMultiCurrencyEnabled
        ? theoreticalDuePrimary - sealedEngagementPrimary
        : grossPlannedPrimary - sealedEngagementPrimary;

      const hasVariance = Math.abs(auditDeltaPrimary) > 0;
      const auditStatus: StudentDiagnosticRow['auditStatus'] = hasVariance
        ? 'VARIANCE'
        : isFullySettled
        ? 'SETTLED'
        : 'OUTSTANDING';

      // Build student receipt audit trail
      const receipts: ReceiptAuditItem[] = yearPayments.map((p) => {
        const isUsd = isMultiCurrencyEnabled && p.currency === 'USD';
        const rawAmt = Number(p.amount || 0);
        const sealedPrimary = roundMoney(
          Number(p.amount_htg_equivalent || 0) ||
            (isUsd ? rawAmt * Number(p.exchange_rate_applied || activeRate) : rawAmt)
        );
        const appliedRate = isUsd
          ? Number(p.exchange_rate_applied || (rawAmt > 0 ? sealedPrimary / rawAmt : activeRate))
          : p.exchange_rate_applied && isMultiCurrencyEnabled
          ? Number(p.exchange_rate_applied)
          : null;

        const currentRateValuePrimary = isUsd
          ? roundMoney(rawAmt * activeRate)
          : sealedPrimary;
        const deltaPrimary = isUsd ? currentRateValuePrimary - sealedPrimary : 0;

        let categoryLabel = terminology.tuition;
        if (isCampaignPayment(p, studentActiveCampaigns)) {
          categoryLabel = p.campaign?.name ? `Campagne : ${p.campaign.name}` : 'Campagne';
        } else if (isAdmissionPayment(p)) {
          categoryLabel = hasPreviousEnrollment ? 'Réinscription' : 'Inscription';
        } else if (isMiscPayment(p)) {
          categoryLabel = 'Frais Divers';
        }

        const dt = p.payment_date || p.created_at;
        return {
          id: p.id,
          studentId: student.id,
          studentName: formatted.fullName,
          className,
          date: dt ? new Date(dt).toLocaleDateString('fr-FR') : '—',
          rawDate: dt || '',
          ref: p.receipt_number || p.reference_number || p.transaction_reference || p.id.slice(0, 8).toUpperCase(),
          categoryLabel,
          originalCurrency: isMultiCurrencyEnabled && p.currency === 'USD' ? 'USD' : primaryCurrency,
          originalAmount: rawAmt,
          appliedRate: appliedRate ? Math.round(appliedRate * 100) / 100 : null,
          sealedPrimary,
          currentRateValuePrimary,
          deltaPrimary,
          paymentMethod: p.payment_method || 'Cash'
        };
      });

      const categories = [
        {
          label: hasPreviousEnrollment ? 'Réinscription' : 'Inscription / Admission',
          plannedPrimary: admPrimary,
          plannedUSD: admUSD,
          theoreticalPrimary: admTheoretical,
          sealedEngagementPrimary: roundMoney(admBreakdown.effectiveDueHTG),
          paidPrimaryEquiv: roundMoney(admBreakdown.paidHTGEquiv),
          remainingPrimaryEquiv: admBreakdown.isPaid ? 0 : roundMoney(admBreakdown.remainingHTGEquiv),
          isPaid: admBreakdown.isPaid
        },
        {
          label: terminology.tuition,
          plannedPrimary: tuitionPrimary,
          plannedUSD: tuitionUSD,
          theoreticalPrimary: tuitionTheoretical,
          sealedEngagementPrimary: roundMoney(tuitionBreakdown.effectiveDueHTG),
          paidPrimaryEquiv: roundMoney(tuitionBreakdown.paidHTGEquiv),
          remainingPrimaryEquiv: tuitionBreakdown.isPaid ? 0 : roundMoney(tuitionBreakdown.remainingHTGEquiv),
          isPaid: tuitionBreakdown.isPaid
        },
        {
          label: 'Frais Divers Obligatoires',
          plannedPrimary: miscPrimary,
          plannedUSD: miscUSD,
          theoreticalPrimary: miscTheoretical,
          sealedEngagementPrimary: roundMoney(miscBreakdown.effectiveDueHTG),
          paidPrimaryEquiv: roundMoney(miscBreakdown.paidHTGEquiv),
          remainingPrimaryEquiv: miscBreakdown.isPaid ? 0 : roundMoney(miscBreakdown.remainingHTGEquiv),
          isPaid: miscBreakdown.isPaid
        },
        {
          label: 'Campagnes & Activités',
          plannedPrimary: campPrimary,
          plannedUSD: campUSD,
          theoreticalPrimary: campTheoretical,
          sealedEngagementPrimary: roundMoney(campBreakdown.effectiveDueHTG),
          paidPrimaryEquiv: roundMoney(campBreakdown.paidHTGEquiv),
          remainingPrimaryEquiv: campBreakdown.isPaid ? 0 : roundMoney(campBreakdown.remainingHTGEquiv),
          isPaid: campBreakdown.isPaid
        }
      ].filter(
        (c) =>
          c.plannedPrimary > 0 ||
          c.plannedUSD > 0 ||
          c.sealedEngagementPrimary > 0 ||
          c.paidPrimaryEquiv > 0
      );

      return {
        studentId: student.id,
        matricule: student.reference_number || student.id.slice(0, 8).toUpperCase(),
        fullName: formatted.fullName,
        classId: effectiveClassId,
        className,
        isReturning: hasPreviousEnrollment,
        hasForeignCurrencyFees:
          plannedSecondaryUSD > 0 || yearPayments.some((p) => p.currency === 'USD'),
        plannedPrimaryRaw,
        plannedSecondaryUSD,
        grossPlannedPrimary,
        discountAppliedPrimary: roundMoney(tuitionDiscountApplied + miscDiscountApplied),
        discountLabel,
        additionPrimary: roundMoney(tuitionAddition),
        theoreticalDuePrimary,
        sealedEngagementPrimary,
        auditDeltaPrimary,
        paidPrimaryEquiv,
        paidPrimaryDirect,
        paidUSDDirect,
        remainingPrimaryEquiv,
        remainingPrimaryDirect,
        remainingUSDDirect,
        isFullySettled,
        auditStatus,
        receipts,
        categories
      };
    });

    // Sort: students with audit variances first, then alphabetically
    rows.sort((a, b) => {
      const varDiff = Math.abs(b.auditDeltaPrimary) - Math.abs(a.auditDeltaPrimary);
      if (varDiff !== 0) return varDiff;
      return a.fullName.localeCompare(b.fullName, 'fr');
    });

    return rows;
  }, [
    studentsData,
    classesData,
    activePlansForYear,
    enrollmentsData,
    validSchoolPayments,
    adHocFeesData,
    targetYearId,
    isMultiCurrencyEnabled,
    activeRate,
    primaryCurrency,
    terminology.tuition
  ]);

  // Filtered rows for admin registry table & consolidated KPIs
  const filteredRows = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return studentRows.filter((row) => {
      if (classFilter !== 'ALL' && row.classId !== classFilter) return false;
      if (auditFilter === 'VARIANCE' && Math.abs(row.auditDeltaPrimary) === 0) return false;
      if (auditFilter === 'SETTLED' && !row.isFullySettled) return false;
      if (auditFilter === 'OUTSTANDING' && row.isFullySettled) return false;
      if (q) {
        const hay = `${row.fullName} ${row.matricule} ${row.className}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [studentRows, searchTerm, classFilter, auditFilter]);

  // Consolidated School-Wide KPIs (calculated on filtered cohort)
  const totals = useMemo(() => {
    return filteredRows.reduce(
      (acc, r) => {
        acc.theoreticalPrimary += isMultiCurrencyEnabled
          ? r.theoreticalDuePrimary
          : r.grossPlannedPrimary;
        acc.netTheoreticalPrimary += r.theoreticalDuePrimary;
        acc.sealedEngagementPrimary += r.sealedEngagementPrimary;
        acc.variancePrimary += r.auditDeltaPrimary;
        acc.paidPrimary += r.paidPrimaryEquiv;
        acc.remainingPrimary += r.remainingPrimaryEquiv;
        acc.plannedUSD += r.plannedSecondaryUSD;
        acc.paidUSD += r.paidUSDDirect;
        if (Math.abs(r.auditDeltaPrimary) > 0) acc.varianceCount += 1;
        if (r.isFullySettled) acc.settledCount += 1;
        return acc;
      },
      {
        theoreticalPrimary: 0,
        netTheoreticalPrimary: 0,
        sealedEngagementPrimary: 0,
        variancePrimary: 0,
        paidPrimary: 0,
        remainingPrimary: 0,
        plannedUSD: 0,
        paidUSD: 0,
        varianceCount: 0,
        settledCount: 0
      }
    );
  }, [filteredRows, isMultiCurrencyEnabled]);

  // Selected student for drill-down (never falls back to dummy data)
  const selectedStudent = useMemo<StudentDiagnosticRow | null>(() => {
    if (!studentRows.length) return null;
    if (selectedStudentId) {
      const found = studentRows.find(
        (r) => r.studentId.toLowerCase() === selectedStudentId.toLowerCase()
      );
      if (found) return found;
    }
    return filteredRows[0] || studentRows[0] || null;
  }, [studentRows, filteredRows, selectedStudentId]);

  const handleSelectStudentDrilldown = (studentId: string) => {
    setSelectedStudentId(studentId);
    setActiveTab('student');
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('student_id', studentId);
      return next;
    });
  };

  // Consolidated Receipts for Journal Tab (either selected student or entire filtered cohort)
  const [receiptScope, setReceiptScope] = useState<'SCHOOL' | 'STUDENT'>('SCHOOL');
  const displayedReceipts = useMemo(() => {
    if (receiptScope === 'STUDENT' && selectedStudent) {
      return selectedStudent.receipts;
    }
    const all: ReceiptAuditItem[] = [];
    filteredRows.forEach((r) => all.push(...r.receipts));
    all.sort((a, b) => new Date(b.rawDate).getTime() - new Date(a.rawDate).getTime());
    return all;
  }, [receiptScope, selectedStudent, filteredRows]);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success('Copié dans le presse-papier');
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const simFxDelta = roundMoney(simUsdPaid1 * (activeRate - simUsdRate1));
  const simFxTheoretical = roundMoney(simUsdTarget * activeRate);
  const simFxRemainingUsd = Math.max(0, simUsdTarget - simUsdPaid1);
  const simMonoNet = Math.max(0, simBasePrimary - simDiscountPrimary);
  const simMonoRemaining = Math.max(0, simMonoNet - simPaidPrimary);

  const formatSignedMoney = (val: number) => {
    if (val === 0) return `0 ${primaryCurrency}`;
    const prefix = val > 0 ? '+' : '';
    return `${prefix}${val.toLocaleString('fr-FR')} ${primaryCurrency}`;
  };

  return (
    <div className="max-w-7xl mx-auto space-y-3 sm:space-y-4 pb-12 animate-in fade-in duration-200">
      {/* 1. TOP BAR ADMINISTRATION */}
      <div className="bg-white rounded-2xl p-2.5 sm:p-3 border border-slate-200 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => navigate('/economat')}
            className="p-1.5 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-lg transition-colors cursor-pointer shrink-0"
            title="Retour à la Direction Économat"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="h-5 w-px bg-slate-200 shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
                {isMultiCurrencyEnabled ? `Multi-Devises (${primaryCurrency} ↔ ${secondaryCurrency})` : `Mono-Devise (${primaryCurrency})`}
              </span>
              {activeCampusName && (
                <span className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
                  <Building2 size={12} className="text-slate-400" />
                  {activeCampusName}
                </span>
              )}
              <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1 tabular-nums">
                <Users size={12} className="text-slate-400" />
                {studentRows.length} élève(s) audité(s)
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap justify-end shrink-0">
          {academicYears.length > 0 && (
            <select
              value={targetYearId}
              onChange={(e) => setSelectedYearId(e.target.value)}
              className="text-xs font-bold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl px-2.5 py-1.5 cursor-pointer outline-none focus:ring-2 focus:ring-indigo-500/20"
              aria-label="Année académique"
            >
              {academicYears.map((y) => (
                <option key={y.id} value={y.id}>
                  Session {y.label} {y.is_active || y.status === 'ACTIVE' ? '(Active)' : ''}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={() => loadDiagnosticData(true)}
            disabled={loading || refreshing}
            className="p-1.5 text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl cursor-pointer disabled:opacity-50"
            title="Actualiser les données en direct"
          >
            <RefreshCcw size={14} className={refreshing ? 'animate-spin text-indigo-600' : ''} />
          </button>

          <button
            type="button"
            onClick={() => handleCopy(window.location.href, 'link')}
            className="p-1.5 text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl cursor-pointer"
            title="Copier le lien du diagnostic"
          >
            {copiedKey === 'link' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Printer size={13} />
            <span className="hidden sm:inline">Imprimer</span>
          </button>
        </div>
      </div>

      {/* 2. BANDEAU DIRECTION ÉCONOMAT (STYLE OVERLAY SOBRE ET CONSOLIDÉ) */}
      <div className="bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 text-white rounded-2xl p-3.5 sm:p-4 border border-indigo-900/60 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-mono font-bold bg-white/10 text-slate-200 border border-white/15 px-2 py-0.5 rounded-md">
              {school?.name || 'Administration Économat'}
            </span>
            <span className="text-[10px] font-mono font-bold bg-amber-400/20 text-amber-300 border border-amber-300/30 px-2 py-0.5 rounded-md">
              Session {effectiveYear?.label || 'Active'}
            </span>
          </div>
          <h1 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-2">
            <Activity size={18} className="text-indigo-300 shrink-0" />
            <span>Diagnostic Barème & Devises</span>
          </h1>
          <p className="text-slate-300 text-[11px] leading-snug max-w-2xl">
            {isMultiCurrencyEnabled
              ? `Audit consolidé de l'établissement : compare les barèmes théoriques au taux du jour (${activeRate} ${primaryCurrency}/${secondaryCurrency}) aux engagements réellement scellés sur les reçus officiels.`
              : `Audit consolidé en devise principale (${primaryCurrency}) : compare le barème officiel des classes aux engagements nets après bourses, réévaluations et reçus scellés.`}
          </p>
        </div>

        {/* CONTRÔLE TAUX (MULTI-DEVISE) OU BADGE MONO-DEVISE */}
        {isMultiCurrencyEnabled ? (
          <div className="bg-white/10 rounded-xl p-2 sm:p-2.5 border border-white/15 flex flex-wrap items-center gap-2 shrink-0 self-start md:self-center">
            <span className="text-[11px] font-bold text-slate-300 whitespace-nowrap">
              Taux Référence :
            </span>
            <div className="flex items-center gap-1">
              {ratePresets.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setExchangeRate(t)}
                  className={`px-2 py-1 rounded-lg text-xs font-mono font-bold tabular-nums transition-colors cursor-pointer ${
                    Math.round(exchangeRate) === t
                      ? 'bg-amber-400 text-slate-950'
                      : 'bg-white/5 hover:bg-white/15 text-slate-300'
                  }`}
                >
                  {t} G
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 pl-1.5 border-l border-white/15">
              <input
                type="number"
                value={exchangeRate}
                onChange={(e) => setExchangeRate(Number(e.target.value) || schoolConfiguredRate || 135)}
                className="w-16 bg-black/30 border border-white/20 rounded-md px-1.5 py-0.5 text-xs font-mono font-bold tabular-nums text-amber-300 text-center"
                min={50}
                max={500}
                step="0.5"
                aria-label="Taux de change de référence"
              />
              <span className="text-[10px] text-slate-400 font-mono">{primaryCurrency}</span>
              {exchangeRate !== schoolConfiguredRate && (
                <button
                  type="button"
                  onClick={() => setExchangeRate(schoolConfiguredRate)}
                  className="p-1 text-slate-300 hover:text-white rounded hover:bg-white/10 cursor-pointer"
                  title={`Réinitialiser au taux officiel de l'école (${schoolConfiguredRate} ${primaryCurrency})`}
                >
                  <RotateCcw size={12} />
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white/10 rounded-xl px-3 py-2 border border-white/15 flex items-center gap-2.5 shrink-0 self-start md:self-center">
            <Coins size={16} className="text-emerald-300 shrink-0" />
            <div>
              <span className="text-[10px] uppercase tracking-wider text-slate-300 block font-bold">
                Devise Principale Active
              </span>
              <span className="text-xs font-mono font-black text-white">
                {primaryCurrency} uniquement (Sans USD)
              </span>
            </div>
          </div>
        )}
      </div>

      {/* AVERTISSEMENT ADAPTATIF MONO-DEVISE OU MULTI-DEVISE SANS OPÉRATIONS USD */}
      {!loading && !isMultiCurrencyEnabled && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 flex items-start gap-2.5 text-xs text-slate-700">
          <Info size={16} className="text-indigo-600 shrink-0 mt-0.5" />
          <p className="leading-snug">
            <strong>Adaptation Mono-Devise ({primaryCurrency}) :</strong> Cet établissement n’utilise pas de devise étrangère dans ses paramètres. Les conversions USD et écarts de change sont automatiquement masqués ; le module contrôle ici l’alignement entre le <strong>Barème Officiel</strong>, les <strong>Réductions / Bourses</strong> et l’<strong>Engagement Net Scellé</strong>.
          </p>
        </div>
      )}

      {!loading && isMultiCurrencyEnabled && !hasForeignCurrencyData && (
        <div className="bg-amber-50/70 border border-amber-200 rounded-xl px-3.5 py-2.5 flex items-start gap-2.5 text-xs text-amber-900">
          <Info size={16} className="text-amber-700 shrink-0 mt-0.5" />
          <p className="leading-snug">
            <strong>Aucun barème ni encaissement en {secondaryCurrency} détecté sur cette session :</strong> Le mode multi-devises est activé dans vos paramètres, mais tous les frais et paiements enregistrés pour l’année <strong>{effectiveYear?.label || 'active'}</strong> sont exclusivement libellés en <strong>{primaryCurrency}</strong>. L’onglet <em>Simulateur Économat</em> reste disponible pour vos projections.
          </p>
        </div>
      )}

      {/* 3. BARRE D'ONGLETS */}
      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto custom-scrollbar">
        {[
          { id: 'registry' as DiagnosticTab, label: 'Registre École', icon: Users },
          { id: 'student' as DiagnosticTab, label: 'Comparatif & Dossier Élève', icon: ArrowRightLeft },
          { id: 'receipts' as DiagnosticTab, label: 'Reçus Scellés (Audit)', icon: Receipt },
          { id: 'rules' as DiagnosticTab, label: 'Arbitrage & Règles', icon: FileCheck2 },
          { id: 'simulator' as DiagnosticTab, label: 'Simulateur Économat', icon: Calculator }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-white text-indigo-700 border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Icon size={14} className={isActive ? 'text-indigo-600' : 'text-slate-500'} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 4. 4 KPIS CONSOLIDÉS POUR TOUTE L'ADMINISTRATION */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          {[0, 1, 2, 3].map((idx) => (
            <div key={idx} className="bg-white rounded-xl p-3.5 border border-slate-200 animate-pulse space-y-2">
              <div className="h-3 w-28 bg-slate-200 rounded" />
              <div className="h-7 w-36 bg-slate-200 rounded" />
              <div className="h-2.5 w-24 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          <div className="p-3 rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                {isMultiCurrencyEnabled ? '1. Barème Théorique École' : '1. Barème Officiel Planifié'}
              </span>
              {isMultiCurrencyEnabled ? (
                <DollarSign size={14} className="text-blue-600" />
              ) : (
                <Coins size={14} className="text-blue-600" />
              )}
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-black font-mono tabular-nums text-slate-900">
                {totals.theoreticalPrimary.toLocaleString('fr-FR')}
              </span>
              <span className="text-[11px] font-bold text-slate-500">{primaryCurrency}</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5 truncate tabular-nums">
              {isMultiCurrencyEnabled && totals.plannedUSD > 0
                ? `Inclut $${totals.plannedUSD.toLocaleString('fr-FR')} ${secondaryCurrency} @ ${activeRate} G (${filteredRows.length} élèves)`
                : `Sur ${filteredRows.length} dossier(s) filtré(s)`}
            </p>
          </div>

          <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/40">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-emerald-800 tracking-wider">
                2. Engagement Réel Scellé
              </span>
              <ShieldCheck size={14} className="text-emerald-600" />
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-black font-mono tabular-nums text-emerald-950">
                {totals.sealedEngagementPrimary.toLocaleString('fr-FR')}
              </span>
              <span className="text-[11px] font-bold text-emerald-700">{primaryCurrency}</span>
            </div>
            <p className="text-[10px] text-emerald-800/80 mt-0.5 truncate">
              {isMultiCurrencyEnabled
                ? 'Base certifiée sur reçus scellés'
                : 'Engagement net après remises & reçus'}
            </p>
          </div>

          <div
            className={`p-3 rounded-xl border ${
              totals.varianceCount > 0
                ? 'bg-amber-50/60 border-amber-300'
                : 'bg-white border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`text-[10px] font-black uppercase tracking-wider ${
                  totals.varianceCount > 0 ? 'text-amber-800' : 'text-slate-500'
                }`}
              >
                {isMultiCurrencyEnabled ? '3. Écart de Change Net' : '3. Écart / Ajustements'}
              </span>
              <AlertTriangle
                size={14}
                className={totals.varianceCount > 0 ? 'text-amber-700' : 'text-slate-400'}
              />
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span
                className={`text-xl sm:text-2xl font-black font-mono tabular-nums ${
                  totals.varianceCount > 0 ? 'text-amber-900' : 'text-slate-900'
                }`}
              >
                {totals.variancePrimary > 0 ? `+${totals.variancePrimary.toLocaleString('fr-FR')}` : totals.variancePrimary.toLocaleString('fr-FR')}
              </span>
              <span
                className={`text-[11px] font-bold ${
                  totals.varianceCount > 0 ? 'text-amber-700' : 'text-slate-500'
                }`}
              >
                {primaryCurrency}
              </span>
            </div>
            <p className="text-[10px] text-slate-600 mt-0.5 truncate tabular-nums">
              {totals.varianceCount} dossier(s) avec écart détecté
            </p>
          </div>

          <div className="p-3 rounded-xl border border-indigo-200 bg-indigo-50/40">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-indigo-800 tracking-wider">
                4. Reste Dû Consolidé
              </span>
              <CheckCircle2 size={14} className="text-indigo-600" />
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-black font-mono tabular-nums text-indigo-950">
                {totals.remainingPrimary.toLocaleString('fr-FR')}
              </span>
              <span className="text-[11px] font-bold text-indigo-700">{primaryCurrency}</span>
            </div>
            <p className="text-[10px] text-slate-600 mt-0.5 truncate tabular-nums">
              Encaissé : {totals.paidPrimary.toLocaleString('fr-FR')} {primaryCurrency} • {totals.settledCount}/{filteredRows.length} soldés
            </p>
          </div>
        </div>
      )}

      {/* =====================================================================
          ONGLET 1 : REGISTRE CONSOLIDÉ MULTI-ÉLÈVES (ADMINISTRATION)
         ===================================================================== */}
      {activeTab === 'registry' && (
        <div className="space-y-3">
          {/* Barre de filtres */}
          <div className="bg-white rounded-2xl p-3 border border-slate-200 flex flex-col md:flex-row items-stretch md:items-center gap-2.5">
            <div className="relative flex-1 min-w-[200px]">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Rechercher un élève par nom, prénom ou matricule..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-slate-700 cursor-pointer outline-none"
                aria-label="Filtrer par classe"
              >
                <option value="ALL">Toutes les classes ({classesData.length})</option>
                {classesData.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              <select
                value={auditFilter}
                onChange={(e) => setAuditFilter(e.target.value as AuditFilter)}
                className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-slate-700 cursor-pointer outline-none"
                aria-label="Filtrer par statut d'audit"
              >
                <option value="ALL">Tous les dossiers ({studentRows.length})</option>
                <option value="VARIANCE">
                  {isMultiCurrencyEnabled ? 'Avec écart de change' : 'Avec remise / ajustement'}
                </option>
                <option value="SETTLED">Comptes 100% soldés</option>
                <option value="OUTSTANDING">Reste dû en cours</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-500">
              Chargement des dossiers financiers de l’établissement...
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-2">
              <p className="text-sm font-bold text-slate-800">
                Aucun dossier trouvé pour ces critères
              </p>
              <p className="text-xs text-slate-500">
                {studentRows.length === 0
                  ? `Aucun élève inscrit ou actif n’a été trouvé pour la session ${effectiveYear?.label || 'sélectionnée'}.`
                  : 'Modifiez votre recherche ou vos filtres de classe/statut pour afficher les dossiers.'}
              </p>
              {(searchTerm || classFilter !== 'ALL' || auditFilter !== 'ALL') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setClassFilter('ALL');
                    setAuditFilter('ALL');
                  }}
                  className="mt-2 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold cursor-pointer"
                >
                  Réinitialiser les filtres
                </button>
              )}
            </div>
          ) : (
            <ResponsiveTableWrapper minWidth="min-w-[920px]" defaultScrollHeight={true} maxHeight="max-h-[520px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">Élève & Matricule</th>
                    <th className="py-2.5 px-3">Classe</th>
                    {isMultiCurrencyEnabled && (
                      <th className="py-2.5 px-3 text-right">Part {secondaryCurrency}</th>
                    )}
                    <th className="py-2.5 px-3 text-right">
                      {isMultiCurrencyEnabled ? `Théorique (${primaryCurrency})` : `Barème Planifié`}
                    </th>
                    <th className="py-2.5 px-3 text-right">Engagement Scellé</th>
                    <th className="py-2.5 px-3 text-right">Écart</th>
                    <th className="py-2.5 px-3 text-right">Encaissé</th>
                    <th className="py-2.5 px-3 text-right">Reste Dû</th>
                    <th className="py-2.5 px-3 text-center">Statut & Audit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredRows.map((row) => {
                    const isSelected = selectedStudent?.studentId === row.studentId;
                    const theoreticalColValue = isMultiCurrencyEnabled
                      ? row.theoreticalDuePrimary
                      : row.grossPlannedPrimary;
                    return (
                      <tr
                        key={row.studentId}
                        onClick={() => handleSelectStudentDrilldown(row.studentId)}
                        className={`transition-colors cursor-pointer ${
                          isSelected ? 'bg-indigo-50/50' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-900">{row.fullName}</div>
                          <div className="text-[10px] font-mono text-slate-500">{row.matricule}</div>
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-700 whitespace-nowrap">
                          {row.className}
                        </td>
                        {isMultiCurrencyEnabled && (
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                            {row.plannedSecondaryUSD > 0 ? `$${row.plannedSecondaryUSD.toLocaleString('fr-FR')}` : '—'}
                          </td>
                        )}
                        <td className="py-2.5 px-3 text-right font-mono font-semibold tabular-nums text-slate-800 whitespace-nowrap">
                          {theoreticalColValue.toLocaleString('fr-FR')} {primaryCurrency}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold tabular-nums text-emerald-800 whitespace-nowrap">
                          {row.sealedEngagementPrimary.toLocaleString('fr-FR')} {primaryCurrency}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-mono font-bold tabular-nums whitespace-nowrap ${
                            row.auditDeltaPrimary > 0
                              ? 'text-amber-700'
                              : row.auditDeltaPrimary < 0
                              ? 'text-blue-700'
                              : 'text-slate-400'
                          }`}
                        >
                          {formatSignedMoney(row.auditDeltaPrimary)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                          {row.paidPrimaryEquiv.toLocaleString('fr-FR')} {primaryCurrency}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-mono font-bold tabular-nums whitespace-nowrap ${
                            row.isFullySettled ? 'text-emerald-700' : 'text-rose-600'
                          }`}
                        >
                          {row.isFullySettled
                            ? '0'
                            : `${row.remainingPrimaryEquiv.toLocaleString('fr-FR')} ${primaryCurrency}`}
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectStudentDrilldown(row.studentId);
                            }}
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                              row.auditStatus === 'VARIANCE'
                                ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                                : row.auditStatus === 'SETTLED'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            <Eye size={12} />
                            <span>
                              {row.auditStatus === 'VARIANCE'
                                ? isMultiCurrencyEnabled
                                  ? 'Écart Change'
                                  : 'Ajusté'
                                : row.auditStatus === 'SETTLED'
                                ? 'Soldé'
                                : 'En cours'}
                            </span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </ResponsiveTableWrapper>
          )}
        </div>
      )}

      {/* =====================================================================
          ONGLET 2 : DRILL-DOWN COMPARATIF 1:1 SUR UN DOSSIER RÉEL
         ===================================================================== */}
      {activeTab === 'student' && (
        <div className="space-y-3">
          {!selectedStudent ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-500">
              Aucun dossier élève disponible pour cette session académique.
            </div>
          ) : (
            <>
              {/* Sélecteur de dossier élève réel */}
              <div className="bg-white rounded-2xl p-3 border border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                <div className="min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Dossier Sélectionné
                  </span>
                  <div className="text-sm font-black text-slate-900 truncate">
                    {selectedStudent.fullName}{' '}
                    <span className="font-semibold text-slate-500">
                      ({selectedStudent.className})
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={selectedStudent.studentId}
                    onChange={(e) => handleSelectStudentDrilldown(e.target.value)}
                    className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-slate-700 cursor-pointer max-w-xs"
                    aria-label="Choisir un élève à auditer"
                  >
                    {studentRows.map((r) => (
                      <option key={r.studentId} value={r.studentId}>
                        {r.fullName} ({r.className})
                        {Math.abs(r.auditDeltaPrimary) > 0
                          ? ` • ${formatSignedMoney(r.auditDeltaPrimary)}`
                          : ''}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => setActiveTab('registry')}
                    className="px-2.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Voir toute l’école
                  </button>
                </div>
              </div>

              {/* Comparatif 2 Colonnes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
                        {isMultiCurrencyEnabled ? <DollarSign size={16} /> : <Coins size={16} />}
                      </div>
                      <div>
                        <h3 className="text-xs sm:text-sm font-black text-slate-900">
                          {isMultiCurrencyEnabled
                            ? `1. Barème Théorique (@ ${activeRate} ${primaryCurrency})`
                            : `1. Barème Officiel Planifié (${primaryCurrency})`}
                        </h3>
                        <p className="text-[10px] text-slate-500">
                          {isMultiCurrencyEnabled
                            ? 'Conversion du barème au taux de référence affiché'
                            : 'Assiette brute prévue par le barème de la classe'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    {selectedStudent.categories.length === 0 ? (
                      <p className="text-slate-500 py-2">Aucun frais planifié sur cette classe.</p>
                    ) : (
                      selectedStudent.categories.map((cat, idx) => (
                        <div
                          key={idx}
                          className="flex justify-between items-center py-1 border-b border-slate-100"
                        >
                          <span className="text-slate-600 font-medium">{cat.label} :</span>
                          <span className="font-mono font-bold tabular-nums text-slate-900">
                            {isMultiCurrencyEnabled && cat.plannedUSD > 0
                              ? `$${cat.plannedUSD.toLocaleString('fr-FR')} ${secondaryCurrency} → ${cat.theoreticalPrimary.toLocaleString('fr-FR')} ${primaryCurrency}`
                              : `${cat.theoreticalPrimary.toLocaleString('fr-FR')} ${primaryCurrency}`}
                          </span>
                        </div>
                      ))
                    )}
                    {selectedStudent.discountAppliedPrimary > 0 && (
                      <div className="flex justify-between items-center py-1 text-indigo-700 text-[11px]">
                        <span>• {selectedStudent.discountLabel || 'Bourse / Remise'} :</span>
                        <span className="font-mono font-bold tabular-nums">
                          -{selectedStudent.discountAppliedPrimary.toLocaleString('fr-FR')} {primaryCurrency}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="p-3 bg-slate-900 text-white rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-300 block">
                        {isMultiCurrencyEnabled ? 'Total Théorique Net' : 'Total Barème Brut'}
                      </span>
                      <span className="text-xl font-black font-mono tabular-nums">
                        {(isMultiCurrencyEnabled
                          ? selectedStudent.theoreticalDuePrimary
                          : selectedStudent.grossPlannedPrimary
                        ).toLocaleString('fr-FR')}{' '}
                        {primaryCurrency}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-300">
                      {selectedStudent.isReturning ? 'Réinscription' : 'Nouvel élève'}
                    </span>
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-emerald-200 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
                        <ShieldCheck size={16} />
                      </div>
                      <div>
                        <h3 className="text-xs sm:text-sm font-black text-slate-900">
                          2. Engagement Réel Scellé
                        </h3>
                        <p className="text-[10px] text-slate-500">
                          Montants certifiés sur reçus officiels & reliquat exigible
                        </p>
                      </div>
                    </div>
                    <span className="font-mono text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200">
                      {selectedStudent.receipts.length} reçu(s)
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    {selectedStudent.categories.map((cat, idx) => (
                      <div
                        key={idx}
                        className="flex justify-between items-center py-1 border-b border-slate-100"
                      >
                        <span className="text-slate-600 font-medium">{cat.label} :</span>
                        <div className="text-right font-mono tabular-nums">
                          <span className="font-bold text-emerald-800">
                            {cat.sealedEngagementPrimary.toLocaleString('fr-FR')} {primaryCurrency}
                          </span>
                          <span className="block text-[10px] text-slate-500">
                            Payé : {cat.paidPrimaryEquiv.toLocaleString('fr-FR')} • Reste :{' '}
                            {cat.isPaid ? 'Réglé' : `${cat.remainingPrimaryEquiv.toLocaleString('fr-FR')} ${primaryCurrency}`}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="p-3 bg-emerald-700 text-white rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-emerald-100 block">
                        Engagement Total Scellé
                      </span>
                      <span className="text-xl font-black font-mono tabular-nums">
                        {selectedStudent.sealedEngagementPrimary.toLocaleString('fr-FR')} {primaryCurrency}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-emerald-100 block">
                        Écart Audit
                      </span>
                      <span className="text-sm font-black font-mono tabular-nums">
                        {formatSignedMoney(selectedStudent.auditDeltaPrimary)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Reçus réels de l'élève */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Receipt size={15} className="text-indigo-600" />
                    <h3 className="text-xs sm:text-sm font-black text-slate-900">
                      Reçus Certifiés de {selectedStudent.fullName}
                    </h3>
                  </div>
                  <span className="text-[11px] font-mono font-bold text-slate-700 tabular-nums">
                    Encaissé : {selectedStudent.paidPrimaryEquiv.toLocaleString('fr-FR')} {primaryCurrency}
                  </span>
                </div>
                {selectedStudent.receipts.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">
                    Aucun paiement validé enregistré pour cet élève sur la session sélectionnée.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50/70 text-slate-500 text-[10px] uppercase font-bold tracking-wider border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-3">Date</th>
                          <th className="py-2 px-3">Reçu #</th>
                          <th className="py-2 px-3">Rubrique & Mode</th>
                          <th className="py-2 px-3 text-right">Montant Encaissé</th>
                          {isMultiCurrencyEnabled && <th className="py-2 px-3 text-right">Taux Scellé</th>}
                          <th className="py-2 px-3 text-right">Valeur Scellée</th>
                          {isMultiCurrencyEnabled && (
                            <>
                              <th className="py-2 px-3 text-right">Valeur @ {activeRate} G</th>
                              <th className="py-2 px-3 text-right">Écart</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedStudent.receipts.map((rec) => (
                          <tr key={rec.id} className="hover:bg-slate-50">
                            <td className="py-2 px-3 text-slate-700 whitespace-nowrap">{rec.date}</td>
                            <td className="py-2 px-3">
                              <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px] border border-indigo-200/70">
                                {rec.ref}
                              </span>
                            </td>
                            <td className="py-2 px-3">
                              <span className="font-semibold text-slate-900">{rec.categoryLabel}</span>
                              <span className="text-[10px] text-slate-500 block">{rec.paymentMethod}</span>
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold tabular-nums text-slate-800 whitespace-nowrap">
                              {rec.originalCurrency === 'USD'
                                ? `$${rec.originalAmount.toLocaleString('fr-FR')} USD`
                                : `${rec.originalAmount.toLocaleString('fr-FR')} ${primaryCurrency}`}
                            </td>
                            {isMultiCurrencyEnabled && (
                              <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-600 whitespace-nowrap">
                                {rec.appliedRate ? `${rec.appliedRate} ${primaryCurrency}` : '—'}
                              </td>
                            )}
                            <td className="py-2 px-3 text-right font-mono font-bold tabular-nums text-slate-900 whitespace-nowrap">
                              {rec.sealedPrimary.toLocaleString('fr-FR')} {primaryCurrency}
                            </td>
                            {isMultiCurrencyEnabled && (
                              <>
                                <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-600 whitespace-nowrap">
                                  {rec.currentRateValuePrimary.toLocaleString('fr-FR')} {primaryCurrency}
                                </td>
                                <td
                                  className={`py-2 px-3 text-right font-mono font-bold tabular-nums whitespace-nowrap ${
                                    rec.deltaPrimary > 0
                                      ? 'text-amber-700'
                                      : rec.deltaPrimary < 0
                                      ? 'text-blue-700'
                                      : 'text-emerald-700'
                                  }`}
                                >
                                  {formatSignedMoney(rec.deltaPrimary)}
                                </td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* =====================================================================
          ONGLET 3 : JOURNAL DES REÇUS SCELLÉS (CONSOLIDÉ OU PAR ÉLÈVE)
         ===================================================================== */}
      {activeTab === 'receipts' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="p-3 sm:p-3.5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Receipt size={16} className="text-indigo-600" />
              <h3 className="text-xs sm:text-sm font-black text-slate-900">
                Journal des Reçus Numérotés & Valeurs Scellées
              </h3>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="inline-flex bg-white border border-slate-200 rounded-lg p-0.5 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setReceiptScope('SCHOOL')}
                  className={`px-2.5 py-1 rounded-md cursor-pointer ${
                    receiptScope === 'SCHOOL' ? 'bg-slate-900 text-white' : 'text-slate-600'
                  }`}
                >
                  Toute l’école ({filteredRows.reduce((s, r) => s + r.receipts.length, 0)})
                </button>
                <button
                  type="button"
                  onClick={() => setReceiptScope('STUDENT')}
                  disabled={!selectedStudent}
                  className={`px-2.5 py-1 rounded-md cursor-pointer disabled:opacity-40 ${
                    receiptScope === 'STUDENT' ? 'bg-slate-900 text-white' : 'text-slate-600'
                  }`}
                >
                  Élève sélectionné
                </button>
              </div>
            </div>
          </div>

          {displayedReceipts.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              Aucun reçu validé enregistré pour cette sélection.
            </div>
          ) : (
            <ResponsiveTableWrapper minWidth="min-w-[820px]" defaultScrollHeight={true} maxHeight="max-h-[480px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 z-10 bg-slate-50 text-slate-500 text-[10px] uppercase font-bold tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3">Date</th>
                    <th className="py-2 px-3">Élève</th>
                    <th className="py-2 px-3">Reçu #</th>
                    <th className="py-2 px-3">Rubrique</th>
                    <th className="py-2 px-3 text-right">Encaissé</th>
                    {isMultiCurrencyEnabled && <th className="py-2 px-3 text-right">Taux</th>}
                    <th className="py-2 px-3 text-right">Valeur Scellée</th>
                    {isMultiCurrencyEnabled && (
                      <>
                        <th className="py-2 px-3 text-right">Valeur @ {activeRate} G</th>
                        <th className="py-2 px-3 text-right">Écart</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {displayedReceipts.slice(0, 250).map((rec) => (
                    <tr
                      key={rec.id}
                      onClick={() => handleSelectStudentDrilldown(rec.studentId)}
                      className="hover:bg-slate-50 cursor-pointer"
                    >
                      <td className="py-2 px-3 text-slate-700 whitespace-nowrap">{rec.date}</td>
                      <td className="py-2 px-3">
                        <span className="font-bold text-slate-900">{rec.studentName}</span>
                        <span className="text-[10px] text-slate-500 block">{rec.className}</span>
                      </td>
                      <td className="py-2 px-3">
                        <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px] border border-indigo-200/70">
                          {rec.ref}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-medium text-slate-800">{rec.categoryLabel}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold tabular-nums text-slate-800 whitespace-nowrap">
                        {rec.originalCurrency === 'USD'
                          ? `$${rec.originalAmount.toLocaleString('fr-FR')} USD`
                          : `${rec.originalAmount.toLocaleString('fr-FR')} ${primaryCurrency}`}
                      </td>
                      {isMultiCurrencyEnabled && (
                        <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-600 whitespace-nowrap">
                          {rec.appliedRate ? `${rec.appliedRate} ${primaryCurrency}` : '—'}
                        </td>
                      )}
                      <td className="py-2 px-3 text-right font-mono font-bold tabular-nums text-slate-900 whitespace-nowrap">
                        {rec.sealedPrimary.toLocaleString('fr-FR')} {primaryCurrency}
                      </td>
                      {isMultiCurrencyEnabled && (
                        <>
                          <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-600 whitespace-nowrap">
                            {rec.currentRateValuePrimary.toLocaleString('fr-FR')} {primaryCurrency}
                          </td>
                          <td
                            className={`py-2 px-3 text-right font-mono font-bold tabular-nums whitespace-nowrap ${
                              rec.deltaPrimary > 0
                                ? 'text-amber-700'
                                : rec.deltaPrimary < 0
                                ? 'text-blue-700'
                                : 'text-slate-400'
                            }`}
                          >
                            {formatSignedMoney(rec.deltaPrimary)}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </ResponsiveTableWrapper>
          )}
        </div>
      )}

      {/* =====================================================================
          ONGLET 4 : RÈGLES D'ARBITRAGE COMPTABLE (ADAPTÉ MONO / MULTI)
         ===================================================================== */}
      {activeTab === 'rules' && (
        <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 space-y-3 border border-slate-800">
          <div>
            <h3 className="text-sm font-black text-white">
              {isMultiCurrencyEnabled
                ? 'Règle d’Arbitrage Comptable Multi-Devises & Valeur Libératoire'
                : `Règle d’Arbitrage Comptable Mono-Devise (${primaryCurrency})`}
            </h3>
            <p className="text-[11px] text-slate-400">
              Référentiel officiel de l’Économat pour le contrôle des dossiers élèves et la clôture de session
            </p>
          </div>

          {isMultiCurrencyEnabled ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="bg-white/5 p-3.5 rounded-xl border border-white/10 space-y-1">
                <span className="text-[10px] uppercase font-bold text-indigo-300 block">
                  1. Origine des Écarts de Change
                </span>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  Lorsqu’un barème est fixé en {secondaryCurrency} et réglé par tranches à des dates différentes, le taux historique scellé sur un acompte diffère du taux courant. Recalculer rétroactivement toute l’année au taux du jour crée une dette fantôme artificielle.
                </p>
              </div>

              <div className="bg-white/5 p-3.5 rounded-xl border border-white/10 space-y-1">
                <span className="text-[10px] uppercase font-bold text-emerald-300 block">
                  2. Primauté du Reçu Scellé
                </span>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  <strong>Chaque reçu officiel scelle définitivement la contre-valeur encaissée.</strong> Dès que la quotité en devises ou en {primaryCurrency} est acquittée selon les tolérances comptables de l’établissement, la rubrique est définitivement éteinte.
                </p>
              </div>

              <div className="bg-white/5 p-3.5 rounded-xl border border-white/10 space-y-1">
                <span className="text-[10px] uppercase font-bold text-amber-300 block">
                  3. Audit de Clôture & Quitus
                </span>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  Utilisez le Registre École pour isoler instantanément les écarts d’amortissement de change à l’échelle de l’établissement avant la remise des bulletins, examens d’État ou clôtures annuelles.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="bg-white/5 p-3.5 rounded-xl border border-white/10 space-y-1">
                <span className="text-[10px] uppercase font-bold text-indigo-300 block">
                  1. Devise Unique Sans Risque de Change
                </span>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  L’établissement opère uniquement en <strong>{primaryCurrency}</strong>. Aucun taux de change ne s’applique aux barèmes ni aux reçus, garantissant une lecture directe des soldes par les familles et la caisse.
                </p>
              </div>

              <div className="bg-white/5 p-3.5 rounded-xl border border-white/10 space-y-1">
                <span className="text-[10px] uppercase font-bold text-emerald-300 block">
                  2. Contrôle Barème vs Engagement Net
                </span>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  Les écarts affichés dans le registre reflètent exclusivement les <strong>bourses accordées</strong>, les <strong>réévaluations de scolarité</strong>, les majorations individuelles et les tolérances d’arrondi sur reçus scellés.
                </p>
              </div>

              <div className="bg-white/5 p-3.5 rounded-xl border border-white/10 space-y-1">
                <span className="text-[10px] uppercase font-bold text-amber-300 block">
                  3. Audit de Clôture & Quitus
                </span>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  Vérifiez dans le Registre École que chaque différence entre le barème officiel de la classe et l’engagement net de l’élève correspond bien à une dérogation ou bourse validée par la Direction.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          ONGLET 5 : SIMULATEUR INTERACTIF ÉCONOMAT (ADAPTÉ MONO / MULTI)
         ===================================================================== */}
      {activeTab === 'simulator' && (
        <div className="bg-white rounded-2xl p-4 border border-slate-200 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Calculator size={16} className="text-indigo-600" />
              <h3 className="text-xs sm:text-sm font-black text-slate-900">
                {isMultiCurrencyEnabled
                  ? `Simulateur Économat : Impact de Change (${secondaryCurrency} ↔ ${primaryCurrency})`
                  : `Simulateur Économat : Barème & Bourse (${primaryCurrency})`}
              </h3>
            </div>
            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
              Projection sans écriture comptable
            </span>
          </div>

          {isMultiCurrencyEnabled ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">
                    Barème Fixé ({secondaryCurrency})
                  </label>
                  <input
                    type="number"
                    value={simUsdTarget}
                    onChange={(e) => setSimUsdTarget(Number(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 font-mono font-bold tabular-nums text-slate-900"
                    min={0}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">
                    Acompte Payé ({secondaryCurrency})
                  </label>
                  <input
                    type="number"
                    value={simUsdPaid1}
                    onChange={(e) => setSimUsdPaid1(Number(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 font-mono font-bold tabular-nums text-slate-900"
                    min={0}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">
                    Taux Scellé Acompte ({primaryCurrency})
                  </label>
                  <input
                    type="number"
                    value={simUsdRate1}
                    onChange={(e) => setSimUsdRate1(Number(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 font-mono font-bold tabular-nums text-slate-900"
                    min={1}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">
                    Taux du Jour ({primaryCurrency})
                  </label>
                  <input
                    type="number"
                    value={exchangeRate}
                    onChange={(e) => setExchangeRate(Number(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 font-mono font-bold tabular-nums text-slate-900"
                    min={1}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">
                    Barème au taux du jour
                  </span>
                  <span className="text-base font-black font-mono tabular-nums text-slate-900">
                    {simFxTheoretical.toLocaleString('fr-FR')} {primaryCurrency}
                  </span>
                </div>
                <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200">
                  <span className="text-[10px] uppercase font-bold text-amber-800 block">
                    Écart d’amortissement sur acompte
                  </span>
                  <span className="text-base font-black font-mono tabular-nums text-amber-900">
                    {formatSignedMoney(simFxDelta)}
                  </span>
                </div>
                <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-200">
                  <span className="text-[10px] uppercase font-bold text-emerald-800 block">
                    Reliquat net exigible
                  </span>
                  <span className="text-base font-black font-mono tabular-nums text-emerald-900">
                    ${simFxRemainingUsd.toLocaleString('fr-FR')} {secondaryCurrency} (≈{' '}
                    {roundMoney(simFxRemainingUsd * activeRate).toLocaleString('fr-FR')} {primaryCurrency})
                  </span>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">
                    Barème Planifié ({primaryCurrency})
                  </label>
                  <input
                    type="number"
                    value={simBasePrimary}
                    onChange={(e) => setSimBasePrimary(Number(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 font-mono font-bold tabular-nums text-slate-900"
                    min={0}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">
                    Bourse / Remise ({primaryCurrency})
                  </label>
                  <input
                    type="number"
                    value={simDiscountPrimary}
                    onChange={(e) => setSimDiscountPrimary(Number(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 font-mono font-bold tabular-nums text-slate-900"
                    min={0}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">
                    Déjà Encaissé ({primaryCurrency})
                  </label>
                  <input
                    type="number"
                    value={simPaidPrimary}
                    onChange={(e) => setSimPaidPrimary(Number(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 font-mono font-bold tabular-nums text-slate-900"
                    min={0}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">
                    Engagement Net Élève
                  </span>
                  <span className="text-base font-black font-mono tabular-nums text-slate-900">
                    {simMonoNet.toLocaleString('fr-FR')} {primaryCurrency}
                  </span>
                </div>
                <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-200">
                  <span className="text-[10px] uppercase font-bold text-indigo-800 block">
                    Écart vs Barème Officiel
                  </span>
                  <span className="text-base font-black font-mono tabular-nums text-indigo-900">
                    {formatSignedMoney(simBasePrimary - simMonoNet)}
                  </span>
                </div>
                <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-200">
                  <span className="text-[10px] uppercase font-bold text-emerald-800 block">
                    Solde Restant Dû
                  </span>
                  <span className="text-base font-black font-mono tabular-nums text-emerald-900">
                    {simMonoRemaining.toLocaleString('fr-FR')} {primaryCurrency}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default StudentCurrencyDiagnosticView;
