import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase, isValidUuid } from '../supabase';
import { useSchool } from '../contexts/SchoolContext';
import { 
  Search, 
  Printer, 
  FileText, 
  ChevronDown, 
  X, 
  History, 
  User, 
  Layers,
  CheckCircle2,
  Calendar,
  Eye,
  AlertCircle,
  RefreshCcw,
  ShieldCheck,
  SearchCheck,
  Clock,
  TrendingUp,
  TrendingDown,
  DollarSign,
  FileDown,
  Info,
  Building2,
  Globe,
  Download,
  ArrowRight,
  ArrowLeft,
  Filter,
  Sparkles,
  PieChart,
  Wallet,
  ArrowRightLeft
} from 'lucide-react';
import { UserProfile, UserRole } from '../types';
import { toast } from 'sonner';
import { formatStudentName } from '../utils/formatters';
import { PrintPreviewModal } from './PrintPreviewModal';
import { FluidLoadingState, SkeletonTable } from './SkeletonLoader';
import { AcademicSessionPill } from './AcademicSessionPill';
import { ClassSelectorPill } from './ClassSelectorPill';
import { SelectPill, SelectOption } from './SelectPill';
import { DatePickerPill } from './DatePickerPill';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { useSecurity } from './SecurityGuard';
import { addSecurityWatermark } from '../utils/pdfWatermark';
import { fixOklchForCanvas } from '../utils/pdfFix';
import { computeFeeCategoryBalance, getFormattedFeeRowDetails } from '../utils/financeCalculations';

const getFeeRowDetails = (
  nativeHTG: number,
  nativeUSD: number,
  paidHTGEquiv: number,
  exchangeRate: number,
  paymentsList?: any[]
) => {
  if (paymentsList && paymentsList.length > 0) {
    const details = getFormattedFeeRowDetails(nativeHTG, nativeUSD, paymentsList, exchangeRate, 0);
    const rate = exchangeRate || 132.50;
    const rawTotalHTGEquiv = nativeHTG + (nativeUSD * rate);
    return {
      ...details,
      totalHTGEquiv: details.isPaid ? paidHTGEquiv : rawTotalHTGEquiv,
      remainingHTGEquiv: details.isPaid ? 0 : Math.max(0, rawTotalHTGEquiv - paidHTGEquiv)
    };
  }

  const rate = exchangeRate || 132.50;
  const totalHTGEquiv = nativeHTG + (nativeUSD * rate);
  const paidUSD = nativeUSD > 0 ? (paidHTGEquiv / rate) : 0;

  let isSettled = false;
  if (nativeUSD > 0 && nativeHTG === 0) {
    isSettled = paidUSD >= nativeUSD - 0.10 || paidHTGEquiv >= (totalHTGEquiv - 15.0);
  } else {
    isSettled = paidHTGEquiv >= (totalHTGEquiv - 15.0);
  }

  let plannedNative = '';
  let plannedEquiv = '';

  if (nativeUSD > 0 && nativeHTG > 0) {
    plannedNative = `${nativeHTG.toLocaleString()} G + $${nativeUSD.toLocaleString()} USD`;
    plannedEquiv = `≈ ${Math.round(totalHTGEquiv).toLocaleString()} HTG`;
  } else if (nativeUSD > 0) {
    plannedNative = `$${nativeUSD.toLocaleString()} USD`;
    plannedEquiv = `≈ ${Math.round(totalHTGEquiv).toLocaleString()} HTG`;
  } else {
    plannedNative = `${nativeHTG.toLocaleString()} G`;
    plannedEquiv = '';
  }

  const paidNative = `+${Math.round(paidHTGEquiv).toLocaleString()} G`;
  const paidEquiv = (nativeUSD > 0 && paidHTGEquiv > 0) ? `(≈ $${paidUSD.toFixed(2)} USD)` : '';

  const remainingHTGEquiv = isSettled ? 0 : Math.max(0, totalHTGEquiv - paidHTGEquiv);
  const remainingUSDEquiv = isSettled ? 0 : remainingHTGEquiv / rate;
  const isPaid = isSettled || remainingHTGEquiv <= 0;

  let remainingNative = '';
  let remainingEquiv = '';

  if (isPaid) {
    remainingNative = 'Réglé';
    remainingEquiv = '';
  } else if (nativeUSD > 0 && nativeHTG === 0) {
    const formattedUSD = remainingUSDEquiv % 1 === 0 ? `$${remainingUSDEquiv.toLocaleString()} USD` : `$${remainingUSDEquiv.toFixed(2)} USD`;
    remainingNative = formattedUSD;
    remainingEquiv = `≈ ${Math.round(remainingHTGEquiv).toLocaleString()} HTG`;
  } else {
    remainingNative = `${Math.round(remainingHTGEquiv).toLocaleString()} HTG`;
    remainingEquiv = nativeUSD > 0 ? `≈ $${remainingUSDEquiv.toFixed(2)} USD` : '';
  }

  return {
    plannedNative,
    plannedEquiv,
    paidNative,
    paidEquiv,
    remainingNative,
    remainingEquiv,
    isPaid,
    totalHTGEquiv,
    remainingHTGEquiv
  };
};

const isPaymentInDateRange = (p: any, startStr: string, endStr: string) => {
  if (!startStr && !endStr) return true;
  const rawDate = p.created_at || p.payment_date || p.date || p.created_date;
  if (!rawDate) return true;
  let pDate = '';
  if (typeof rawDate === 'string') {
    pDate = rawDate.substring(0, 10);
  } else if (rawDate instanceof Date) {
    pDate = rawDate.toISOString().substring(0, 10);
  }
  if (!pDate) return true;
  if (startStr && pDate < startStr) return false;
  if (endStr && pDate > endStr) return false;
  return true;
};

const AccountStatementView: React.FC<{ user: UserProfile }> = ({ user }) => {
  const { ipAddress } = useSecurity();
  const { terminology, currentCampusId, campuses } = useSchool();
  const calculationSeqRef = useRef(0);
  const [schoolDetails, setSchoolDetails] = useState<any>(null);
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedClass, setSelectedClass] = useState('all');
  const [balanceFilter, setBalanceFilter] = useState<'ALL' | 'DEBTORS' | 'PAID'>('ALL');
  
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  
  // Detection du paramètre d'URL pour ouvrir directement l'audit de données ou un onglet spécifique
  const [activeView, setActiveView] = useState<'balances' | 'generator' | 'audit_data'>(() => {
    if (tabParam === 'audit_data') return 'audit_data';
    if (tabParam === 'generator') return 'generator';
    return 'balances';
  });

  useEffect(() => {
    if (tabParam === 'audit_data') {
      setActiveView('audit_data');
    } else if (tabParam === 'generator') {
      setActiveView('generator');
    } else if (tabParam === 'balances') {
      setActiveView('balances');
    }
  }, [tabParam]);
  
  // Diagnostics de Débogage
  const [auditDiagnosticInfo, setAuditDiagnosticInfo] = useState<{
    totalPaymentsFetched: number;
    totalValidPayments: number;
    totalStudentsProcessed: number;
    matchedPaymentsCount: number;
    unmatchedPaymentsCount: number;
    schoolId: string;
    campusFilterApplied: string;
    exchangeRateApplied: number;
    totalHTGCollected: number;
    totalHTGExpected: number;
    calculatedRate: string;
  }>({
    totalPaymentsFetched: 0,
    totalValidPayments: 0,
    totalStudentsProcessed: 0,
    matchedPaymentsCount: 0,
    unmatchedPaymentsCount: 0,
    schoolId: '',
    campusFilterApplied: '',
    exchangeRateApplied: 132.50,
    totalHTGCollected: 0,
    totalHTGExpected: 0,
    calculatedRate: '0.0'
  });
  
  // States du Filtre par Période (Date Début / Date Fin)
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const handleSetDatePreset = (preset: 'today' | 'this_month' | 'this_quarter' | 'this_year' | 'clear') => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    if (preset === 'today') {
      const todayStr = `${year}-${month}-${day}`;
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'this_month') {
      const firstDay = `${year}-${month}-01`;
      const lastDayObj = new Date(year, now.getMonth() + 1, 0);
      const lastDay = `${year}-${month}-${String(lastDayObj.getDate()).padStart(2, '0')}`;
      setStartDate(firstDay);
      setEndDate(lastDay);
    } else if (preset === 'this_quarter') {
      const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
      const firstMonthStr = String(quarterMonth + 1).padStart(2, '0');
      const firstDay = `${year}-${firstMonthStr}-01`;
      const lastMonth = quarterMonth + 3;
      const lastDayObj = new Date(year, lastMonth, 0);
      const lastDayStr = `${year}-${String(lastMonth).padStart(2, '0')}-${String(lastDayObj.getDate()).padStart(2, '0')}`;
      setStartDate(firstDay);
      setEndDate(lastDayStr);
    } else if (preset === 'this_year') {
      setStartDate(`${year}-01-01`);
      setEndDate(`${year}-12-31`);
    } else if (preset === 'clear') {
      setStartDate('');
      setEndDate('');
    }
  };
  
  // States du Générateur
  const [genYear, setGenYear] = useState('');
  const [genClass, setGenClass] = useState('');
  const [selectedGenStudent, setSelectedGenStudent] = useState<any | null>(null);
  const [studentHistory, setStudentHistory] = useState<any[]>([]);
  const [isExporting, setIsExporting] = useState(false);

  const filteredStudentHistory = useMemo(() => {
    return studentHistory.filter(p => isPaymentInDateRange(p, startDate, endDate));
  }, [studentHistory, startDate, endDate]);

  const [printPreview, setPrintPreview] = useState<any | null>(null);

  const [enrolledClassIds, setEnrolledClassIds] = useState<Set<string>>(new Set());
  const [enrolledClassIdsForGen, setEnrolledClassIdsForGen] = useState<Set<string>>(new Set());
  const [enrollmentsForGen, setEnrollmentsForGen] = useState<any[]>([]);

  // Nom dynamique du campus adapté pour les établissements à campus unique (ex: Collège des Innovations)
  const isSingleCampus = useMemo(() => {
    return !campuses || campuses.length <= 1;
  }, [campuses]);

  const activeCampusName = useMemo(() => {
    if (!campuses || campuses.length <= 1) return "";
    if (!currentCampusId || currentCampusId === 'GLOBAL') return "Tous les campus (Vue globale)";
    const found = campuses.find(c => c.id === currentCampusId);
    return found ? `Annexe : ${found.name}` : "Tous les campus (Vue globale)";
  }, [currentCampusId, campuses]);

  useEffect(() => {
    const fetchContext = async () => {
      if (!user?.school_id) return;
      try {
        setLoading(true);

        let classesQuery = supabase.from('classes').select('*').eq('school_id', user.school_id);
        if (currentCampusId && isValidUuid(currentCampusId) && campuses && campuses.length > 1) {
          classesQuery = classesQuery.eq('campus_id', currentCampusId);
        }

        let studentsQuery = supabase.from('students').select('id, first_name, last_name, class_id, discount_amount, discount_label, campus_id').eq('school_id', user.school_id);
        if (currentCampusId && isValidUuid(currentCampusId) && campuses && campuses.length > 1) {
          studentsQuery = studentsQuery.eq('campus_id', currentCampusId);
        }

        const [
          { data: schoolData },
          { data: yearsData },
          { data: classesData },
          { data: studentsData }
        ] = await Promise.all([
          supabase.from('schools').select('*').eq('id', user.school_id).single(),
          supabase.from('academic_years').select('*').eq('school_id', user.school_id).order('label', { ascending: false }),
          classesQuery.order('name'),
          studentsQuery
        ]);

        if (schoolData) setSchoolDetails(schoolData);

        if (yearsData) {
          setAcademicYears(yearsData);
          const active = yearsData.find(y => y.status === 'ACTIVE') || yearsData[0];
          if (active) {
            setSelectedYear(active.id);
            setGenYear(active.id);
          }
        }

        if (classesData) {
          setClasses(classesData);
          if (classesData.length > 0) setGenClass(classesData[0].id);
        }

        if (studentsData) setStudents(studentsData);

      } catch (e) {
        console.error("Erreur chargement contexte", e);
      } finally {
        setLoading(false);
      }
    };
    fetchContext();
  }, [user?.school_id, currentCampusId, campuses?.length]);

  // Calcul des soldes pour la vue "balances"
  const [studentBalances, setStudentBalances] = useState<any[]>([]);
  const [isCalculatingBalances, setIsCalculatingBalances] = useState(false);

  const calculateBalances = useCallback(async () => {
    if (!selectedYear || !user?.school_id) return;
    const currentSeq = ++calculationSeqRef.current;
    setIsCalculatingBalances(true);
    try {
        console.log(`🚀 [AUDIT DÉBOGAGE RECOUVRMENT] Début analyse -- École: ${user.school_id}, Année: ${selectedYear}, Campus: ${currentCampusId || 'GLOBAL'}`);

        // Exécution en parallèle de toutes les requêtes de calcul de solde
        const [
          { data: enrollments },
          { data: allPrevEnrollments },
          { data: plans },
          rawPaymentsRes,
          { data: adHocFees },
          { data: rateRes }
        ] = await Promise.all([
          supabase
            .from('enrollments')
            .select('student_id, class_id, tuition_discount, tuition_addition')
            .eq('school_id', user.school_id)
            .eq('academic_year_id', selectedYear),
          supabase
            .from('enrollments')
            .select('student_id')
            .eq('school_id', user.school_id)
            .neq('academic_year_id', selectedYear),
          supabase
            .from('fee_plans')
            .select('*')
            .eq('school_id', user.school_id)
            .eq('academic_year_id', selectedYear),
          supabase
            .from('payments')
            .select('*')
            .eq('school_id', user.school_id),
          supabase
            .from('student_ad_hoc_fees')
            .select(`
              student_id,
              custom_amount,
              campaign:ad_hoc_campaigns!campaign_id(id, name, amount, currency, status, due_date, type, academic_year_id)
            `)
            .eq('school_id', user.school_id),
          supabase
            .from('exchange_rates')
            .select('rate_usd_to_htg')
            .eq('school_id', user.school_id)
            .order('effective_date', { ascending: false })
            .limit(1)
        ]);

        if (currentSeq !== calculationSeqRef.current) return;

        const enrolledIds = new Set(enrollments?.map(e => e.class_id).filter(Boolean) || []);
        setEnrolledClassIds(enrolledIds);

        const reenrollSet = new Set(allPrevEnrollments?.map(e => e.student_id) || []);

        let payments = rawPaymentsRes.data || [];
        if (rawPaymentsRes.error) {
          console.warn("⚠️ Erreur lors de la récupération des paiements, nouvelle tentative...", rawPaymentsRes.error);
          const retryRes = await supabase.from('payments').select('*').eq('school_id', user.school_id);
          if (retryRes.data) {
            payments = retryRes.data;
          }
        }

        if (currentSeq !== calculationSeqRef.current) return;

        console.log(`🔍 [AUDIT DÉBOGAGE RECOUVRMENT] ${payments.length} paiement(s) chargés au total depuis Supabase pour l'école.`);

        const adHocMap: { [studentId: string]: number } = {};
        adHocFees?.forEach((fee: any) => {
          if (fee.campaign && fee.campaign.academic_year_id === selectedYear) {
            const amount = fee.custom_amount !== null && fee.custom_amount !== undefined ? Number(fee.custom_amount) : Number(fee.campaign.amount || 0);
            adHocMap[fee.student_id] = (adHocMap[fee.student_id] || 0) + amount;
          }
        });

        const exchangeRate = rateRes?.[0]?.rate_usd_to_htg || 132.50;

        const studentIdSet = new Set(students.map(s => String(s.id).trim().toLowerCase()));
        let matchedPaymentsCount = 0;
        let unmatchedPaymentsCount = 0;

        payments.forEach(p => {
          if (p.student_id && studentIdSet.has(String(p.student_id).trim().toLowerCase())) {
            matchedPaymentsCount++;
          } else {
            unmatchedPaymentsCount++;
          }
        });

        const balances = students.map(student => {
          const enrollment = enrollments?.find(e => e.student_id === student.id);
          if (!enrollment && selectedClass !== 'all') return null;
          
          const classId = enrollment?.class_id || student.class_id;
          if (selectedClass !== 'all' && classId !== selectedClass) return null;

          const plan = plans?.find(p => p.class_id === classId);
          const isReenroll = reenrollSet.has(student.id);
          
          // Calcul du dû
          const inscriptionHTG = plan ? (isReenroll ? Number(plan.reenrollment_fee || 0) : Number(plan.inscription_fee || 0)) : 0;
          const inscriptionUSD = plan ? (isReenroll ? Number(plan.reenrollment_fee_usd || 0) : Number(plan.inscription_fee_usd || 0)) : 0;
          
          const tuitionFee = plan ? (Number(plan.tuition_fee || 0) + Number(plan.tuition_fee_usd || 0) * exchangeRate) : 0;
          const miscHTG = plan && plan.is_misc_mandatory ? Number(plan.misc_fee_htg || 0) : 0;
          const miscUSD = plan && plan.is_misc_mandatory ? Number(plan.misc_fee_usd || 0) : 0;
          const campaignsExpected = adHocMap[student.id] || 0;
          
          const tuitionAddition = Number(enrollment?.tuition_addition || 0);
          const tuitionDiscount = Number(enrollment?.tuition_discount || 0);
          const studentDiscount = Number(student.discount_amount || 0);

          // Matching des paiements pour cet élève (avec nettoyage des chaînes ID)
          const studentIdClean = String(student.id).trim().toLowerCase();
          const studentPayments = payments.filter(p => {
            if (!p.student_id) return false;
            const pStudentIdClean = String(p.student_id).trim().toLowerCase();
            if (pStudentIdClean !== studentIdClean) return false;

            // Filtre d'année académique souple
            if (p.academic_year_id && p.academic_year_id !== selectedYear) return false;

            // Exclusion des paiements annulés ou rejetés
            const pStatus = String(p.status || '').toUpperCase();
            if (pStatus.includes('ANNUL') || pStatus.includes('REJET') || pStatus.includes('CANCEL')) return false;

            const pMethod = String(p.payment_method || '').toUpperCase();
            if (pMethod.includes('REJETÉ') || pMethod.includes('REJETE') || pMethod.includes('EN ATTENTE')) return false;

            // Plage de dates
            return isPaymentInDateRange(p, startDate, endDate);
          });

          // Helper de catégorisation pour calculer le dû réel sans effet de change sur les frais soldés
          const isCampaignPayment = (p: any) => !!p.ad_hoc_campaign_id;
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
              desc.includes('réinscri')
            );
          };
          const isMiscPayment = (p: any) => {
            const feeType = (p.fee_type || '').toLowerCase();
            const nature = (p.nature || '').toLowerCase();
            const type = (p.type || '').toLowerCase();
            const desc = (p.description || '').toLowerCase();
            return (
              feeType.includes('divers') ||
              nature.includes('divers') ||
              type.includes('divers') ||
              desc.includes('divers')
            );
          };

          const admPayments = studentPayments.filter(p => !isCampaignPayment(p) && isAdmissionPayment(p));
          const miscPayments = studentPayments.filter(p => !isCampaignPayment(p) && !isAdmissionPayment(p) && isMiscPayment(p));

          const admBreakdown = computeFeeCategoryBalance(inscriptionHTG, inscriptionUSD, admPayments, exchangeRate);
          const effectiveAdmissionDue = admBreakdown.isPaid ? admBreakdown.paidHTGEquiv : admBreakdown.effectiveDueHTG;

          const miscBreakdown = computeFeeCategoryBalance(miscHTG, miscUSD, miscPayments, exchangeRate);
          const effectiveMiscDue = miscBreakdown.isPaid ? miscBreakdown.paidHTGEquiv : miscBreakdown.effectiveDueHTG;

          const originalDue = effectiveAdmissionDue + tuitionFee + effectiveMiscDue + tuitionAddition + campaignsExpected;

          // Calcul du montant payé
          const paid = studentPayments.reduce((acc, p) => {
            let amt = Number(p.amount_htg_equivalent);
            if (!amt || isNaN(amt)) {
              amt = Number(p.amount || 0);
              const curr = String(p.currency || 'HTG').toUpperCase();
              if (curr === 'USD') {
                amt = amt * exchangeRate;
              }
            }
            return acc + amt;
          }, 0);

          const totalDiscount = tuitionDiscount + studentDiscount;
          const totalDue = Math.max(paid, originalDue - totalDiscount);

          return {
            ...student,
            classId,
            className: classes.find(c => c.id === classId)?.name || 'N/A',
            fullName: formatStudentName(student.last_name, student.first_name).fullName,
            originalDue,
            totalDiscount,
            totalDue,
            paid,
            paymentCount: studentPayments.length,
            balance: Math.max(0, totalDue - paid)
          };
        }).filter(Boolean);

        if (currentSeq !== calculationSeqRef.current) return;

        setStudentBalances(balances);

        const sumPaid = balances.reduce((s, b) => s + b.paid, 0);
        const sumDue = balances.reduce((s, b) => s + b.totalDue, 0);
        const rateCalc = sumDue > 0 ? ((sumPaid / sumDue) * 100).toFixed(1) : '100';

        setAuditDiagnosticInfo({
          totalPaymentsFetched: payments.length,
          totalValidPayments: payments.filter(p => !String(p.status || '').toUpperCase().includes('ANNUL')).length,
          totalStudentsProcessed: balances.length,
          matchedPaymentsCount: matchedPaymentsCount,
          unmatchedPaymentsCount: unmatchedPaymentsCount,
          schoolId: user.school_id,
          campusFilterApplied: currentCampusId || 'Vue Globale',
          exchangeRateApplied: exchangeRate,
          totalHTGCollected: sumPaid,
          totalHTGExpected: sumDue,
          calculatedRate: rateCalc
        });

        console.log(`✅ [AUDIT DÉBOGAGE TERMINÉ] Élèves: ${balances.length}, Paiements: ${payments.length} (${matchedPaymentsCount} associés), Total Encaissé: ${sumPaid.toLocaleString()} HTG, Total Dû: ${sumDue.toLocaleString()} HTG, Taux Recouvrement: ${rateCalc}%`);

    } catch (e) {
      console.error("❌ Erreur lors du calcul des soldes:", e);
    } finally {
      if (currentSeq === calculationSeqRef.current) {
        setIsCalculatingBalances(false);
      }
    }
  }, [selectedYear, selectedClass, students, user?.school_id, classes, startDate, endDate, currentCampusId]);

  useEffect(() => {
    if (activeView === 'balances' || activeView === 'audit_data') {
      calculateBalances();
    }
  }, [activeView, calculateBalances]);

  // Re-calculer l'audit individuel quand la plage de dates change
  useEffect(() => {
    if (selectedGenStudent && activeView === 'generator') {
      loadStudentAudit(selectedGenStudent);
    }
  }, [startDate, endDate]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedClass, balanceFilter]);

  const filteredBalances = useMemo(() => {
    return studentBalances.filter(b => {
      const name = formatStudentName(b.last_name, b.first_name).fullName.toLowerCase();
      const matchesSearch = name.includes(searchTerm.toLowerCase()) || b.id.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;

      if (balanceFilter === 'DEBTORS') return b.balance > 0;
      if (balanceFilter === 'PAID') return b.balance === 0;

      return true;
    });
  }, [studentBalances, searchTerm, balanceFilter]);

  // Statisiques des soldes
  const totalDueSum = useMemo(() => filteredBalances.reduce((acc, c) => acc + c.totalDue, 0), [filteredBalances]);
  const totalPaidSum = useMemo(() => filteredBalances.reduce((acc, c) => acc + c.paid, 0), [filteredBalances]);
  const totalBalanceSum = useMemo(() => filteredBalances.reduce((acc, c) => acc + c.balance, 0), [filteredBalances]);
  const recoveryRate = useMemo(() => totalDueSum > 0 ? ((totalPaidSum / totalDueSum) * 100).toFixed(1) : '100', [totalDueSum, totalPaidSum]);
  const debtorsCount = useMemo(() => filteredBalances.filter(b => b.balance > 0).length, [filteredBalances]);
  const paidCount = useMemo(() => filteredBalances.filter(b => b.balance === 0).length, [filteredBalances]);

  const totalPages = Math.ceil(filteredBalances.length / itemsPerPage);
  const paginatedBalances = filteredBalances.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  useEffect(() => {
    const fetchGenEnrollments = async () => {
      if (!genYear || !user.school_id) return;
      try {
        const { data: enrollments } = await supabase
          .from('enrollments')
          .select('student_id, class_id')
          .eq('school_id', user.school_id)
          .eq('academic_year_id', genYear);
        setEnrollmentsForGen(enrollments || []);
        
        const enrolledIds = new Set(enrollments?.map(e => e.class_id).filter(Boolean) || []);
        setEnrolledClassIdsForGen(enrolledIds);
      } catch (e) {
        console.error("Erreur chargement enrollments pour gen", e);
      }
    };
    fetchGenEnrollments();
  }, [genYear, user.school_id]);

  const classesWithEnrollmentsForBalances = useMemo(() => {
    const filtered = classes.filter(c => enrolledClassIds.has(c.id));
    return filtered.length > 0 ? filtered : classes;
  }, [classes, enrolledClassIds]);

  const classesWithEnrollmentsForGen = useMemo(() => {
    const filtered = classes.filter(c => enrolledClassIdsForGen.has(c.id));
    return filtered.length > 0 ? filtered : classes;
  }, [classes, enrolledClassIdsForGen]);

  useEffect(() => {
    if (classesWithEnrollmentsForGen.length > 0) {
      const exists = classesWithEnrollmentsForGen.some(c => c.id === genClass);
      if (!exists) {
        setGenClass(classesWithEnrollmentsForGen[0].id);
      }
    }
  }, [classesWithEnrollmentsForGen, genClass]);

  // Logique Générateur
  const availableStudentsForGen = useMemo(() => {
    return students
      .filter(s => {
        const enrollment = enrollmentsForGen.find(e => e.student_id === s.id);
        const activeClassId = enrollment ? enrollment.class_id : s.class_id;
        return activeClassId === genClass;
      })
      .map(s => {
        const formatted = formatStudentName(s.last_name, s.first_name);
        return {
          ...s,
          name: formatted.fullName
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [students, enrollmentsForGen, genClass]);

  const genStudentOptions: SelectOption[] = useMemo(() => {
    return availableStudentsForGen.map(s => ({
      value: s.id,
      label: s.name,
      badge: s.id.substring(0, 6).toUpperCase(),
      description: `ID: ${s.id.substring(0, 8)}`
    }));
  }, [availableStudentsForGen]);

  // Index de l'élève actuellement sélectionné dans le générateur
  const currentGenStudentIndex = useMemo(() => {
    if (!selectedGenStudent) return -1;
    return availableStudentsForGen.findIndex(s => s.id === selectedGenStudent.id);
  }, [selectedGenStudent, availableStudentsForGen]);

  const loadStudentAudit = async (student: any) => {
    if (!genYear) return;
    setLoading(true);
    try {
      const { data: enrollment } = await supabase
        .from('enrollments')
        .select('*, class:classes(id, name)')
        .eq('school_id', user.school_id)
        .eq('student_id', student.id)
        .eq('academic_year_id', genYear)
        .maybeSingle();

      const { data: plan } = await supabase
        .from('fee_plans')
        .select('*')
        .eq('school_id', user.school_id)
        .eq('class_id', enrollment?.class_id || student.class_id)
        .eq('academic_year_id', genYear)
        .maybeSingle();

      const { data: rawPayments } = await supabase
        .from('payments')
        .select('*, campaign:ad_hoc_campaigns(id, name)')
        .eq('school_id', user.school_id)
        .eq('student_id', student.id)
        .order('created_at', { ascending: false });

      const payments = rawPayments?.filter(p => !p.academic_year_id || p.academic_year_id === genYear) || [];

      const { data: rateRes } = await supabase
        .from('exchange_rates')
        .select('rate_usd_to_htg')
        .eq('school_id', user.school_id)
        .order('effective_date', { ascending: false })
        .limit(1);
      const exchangeRate = rateRes?.[0]?.rate_usd_to_htg || 132.50;

      let campaignData: any[] = [];
      try {
        const { data } = await supabase
          .from('student_ad_hoc_fees')
          .select(`
            id,
            custom_amount,
            adjustment_reason,
            campaign:ad_hoc_campaigns!campaign_id(id, name, amount, currency, status, due_date, type, academic_year_id)
          `)
          .eq('school_id', user.school_id)
          .eq('student_id', student.id);
        campaignData = data || [];
      } catch (err) {
        console.error("Erreur chargement student_ad_hoc_fees:", err);
      }

      const activeCampaigns = campaignData
        .map((fee: any) => {
          if (!fee.campaign) return null;
          return {
            ...fee.campaign,
            custom_amount: fee.custom_amount,
            adjustment_reason: fee.adjustment_reason,
            fee_id: fee.id
          };
        })
        .filter((c: any) => c !== null && c.academic_year_id === genYear);

      const campaignsExpected = activeCampaigns.reduce((sum, camp) => {
        const required = camp.custom_amount !== null && camp.custom_amount !== undefined ? Number(camp.custom_amount) : Number(camp.amount);
        return sum + required;
      }, 0);

      const { data: prevEnrollments } = await supabase
        .from('enrollments')
        .select('id')
        .eq('school_id', user.school_id)
        .eq('student_id', student.id)
        .neq('academic_year_id', genYear)
        .limit(1);
      const isReenroll = prevEnrollments && prevEnrollments.length > 0;

      const inscriptionHTG = plan ? (isReenroll ? Number(plan.reenrollment_fee || 0) : Number(plan.inscription_fee || 0)) : 0;
      const inscriptionUSD = plan ? (isReenroll ? Number(plan.reenrollment_fee_usd || 0) : Number(plan.inscription_fee_usd || 0)) : 0;
      
      const tuitionHTG = plan ? Number(plan.tuition_fee || 0) : 0;
      const tuitionUSD = plan ? Number(plan.tuition_fee_usd || 0) : 0;

      const miscHTG = plan && plan.is_misc_mandatory ? Number(plan.misc_fee_htg || 0) : 0;
      const miscUSD = plan && plan.is_misc_mandatory ? Number(plan.misc_fee_usd || 0) : 0;

      let campaignsNativeHTG = 0;
      let campaignsNativeUSD = 0;
      activeCampaigns.forEach((camp) => {
        const required = camp.custom_amount !== null && camp.custom_amount !== undefined ? Number(camp.custom_amount) : Number(camp.amount || 0);
        if (camp.currency === 'USD') {
          campaignsNativeUSD += required;
        } else {
          campaignsNativeHTG += required;
        }
      });
      
      const tuitionAddition = Number(enrollment?.tuition_addition || 0);
      const tuitionDiscount = Number(enrollment?.tuition_discount || 0);
      const studentDiscount = Number(student.discount_amount || 0);
      const totalDiscount = tuitionDiscount + studentDiscount;

      // Categorize payments accurately by nature/type
      const isCampaignPayment = (p: any) => !!p.ad_hoc_campaign_id;
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
          desc.includes('réinscri')
        );
      };
      const isMiscPayment = (p: any) => {
        const feeType = (p.fee_type || '').toLowerCase();
        const nature = (p.nature || '').toLowerCase();
        const type = (p.type || '').toLowerCase();
        const desc = (p.description || '').toLowerCase();
        return (
          feeType.includes('divers') ||
          nature.includes('divers') ||
          type.includes('divers') ||
          desc.includes('divers')
        );
      };

      const validPayments = payments?.filter(p => 
        p.status !== 'ANNULE' && 
        !p.payment_method?.includes('REJETÉ') &&
        !p.payment_method?.includes('EN ATTENTE') &&
        isPaymentInDateRange(p, startDate, endDate)
      ) || [];

      const admissionPayments = validPayments.filter(p => !isCampaignPayment(p) && isAdmissionPayment(p));
      const campaignPayments = validPayments.filter(p => isCampaignPayment(p));
      const miscPayments = validPayments.filter(p => !isCampaignPayment(p) && !isAdmissionPayment(p) && isMiscPayment(p));
      const tuitionPayments = validPayments.filter(p => !isCampaignPayment(p) && !isAdmissionPayment(p) && !isMiscPayment(p));

      const admissionBreakdown = computeFeeCategoryBalance(
        inscriptionHTG,
        inscriptionUSD,
        admissionPayments,
        exchangeRate
      );
      const admissionExpected = admissionBreakdown.isPaid ? admissionBreakdown.paidHTGEquiv : admissionBreakdown.effectiveDueHTG;
      const admissionPaid = admissionPayments.reduce((sum, p) => sum + Number(p.currency === 'USD' ? p.amount * exchangeRate : (p.amount_htg_equivalent || p.amount || 0)), 0);

      const miscBreakdown = computeFeeCategoryBalance(
        miscHTG,
        miscUSD,
        miscPayments,
        exchangeRate
      );
      const rawMiscPaid = miscPayments.reduce((sum, p) => sum + Number(p.currency === 'USD' ? p.amount * exchangeRate : (p.amount_htg_equivalent || p.amount || 0)), 0);
      const planMiscFee = miscBreakdown.isPaid ? rawMiscPaid : miscBreakdown.effectiveDueHTG;

      const tuitionFee = tuitionHTG + (tuitionUSD * exchangeRate);
      const campaignsPaid = campaignPayments.reduce((sum, p) => sum + Number(p.currency === 'USD' ? p.amount * exchangeRate : (p.amount_htg_equivalent || p.amount || 0)), 0);
      const rawTuitionPaid = tuitionPayments.reduce((sum, p) => sum + Number(p.currency === 'USD' ? p.amount * exchangeRate : (p.amount_htg_equivalent || p.amount || 0)), 0);

      const neededMisc = Math.max(0, planMiscFee - rawMiscPaid);
      const miscCoverFromTuition = Math.min(neededMisc, rawTuitionPaid);
      const miscPaid = rawMiscPaid + miscCoverFromTuition;
      const tuitionPaid = rawTuitionPaid - miscCoverFromTuition;

      const originalDue = admissionExpected + tuitionFee + planMiscFee + tuitionAddition + campaignsExpected;
      const paid = validPayments.reduce((acc, p) => acc + Number(p.amount_htg_equivalent || p.amount || 0), 0);

      const totalDue = Math.max(paid, originalDue - totalDiscount);

      setSelectedGenStudent({
        ...student,
        inscriptionFee: admissionExpected,
        tuitionFee,
        miscFee: planMiscFee,
        campaignsFee: campaignsExpected,
        admissionNativeHTG: inscriptionHTG,
        admissionNativeUSD: inscriptionUSD,
        admissionExpected,
        admissionPaid,
        tuitionNativeHTG: tuitionHTG,
        tuitionNativeUSD: tuitionUSD,
        tuitionExpected: tuitionFee,
        tuitionPaid,
        miscNativeHTG: miscHTG,
        miscNativeUSD: miscUSD,
        miscPaid,
        campaignsNativeHTG,
        campaignsNativeUSD,
        campaignsPaid,
        admissionPayments,
        tuitionPayments,
        miscPayments,
        campaignPayments,
        hasCampaigns: activeCampaigns.length > 0,
        exchangeRate,
        tuitionAddition,
        tuitionDiscount,
        studentDiscount,
        totalDiscount,
        totalDue,
        paid,
        balance: Math.max(0, totalDue - paid),
        className: enrollment?.class?.name || classes.find(c => c.id === student.class_id)?.name || 'N/A',
        academicYear: academicYears.find(y => y.id === genYear)?.label
      });
      setStudentHistory(payments || []);
    } catch (e) {
      console.error("Erreur audit élève", e);
    } finally {
      setLoading(false);
    }
  };

  const navigateAuditStudent = (direction: 'prev' | 'next') => {
    if (currentGenStudentIndex === -1 || availableStudentsForGen.length === 0) return;
    let nextIdx = direction === 'next' ? currentGenStudentIndex + 1 : currentGenStudentIndex - 1;
    if (nextIdx < 0) nextIdx = availableStudentsForGen.length - 1;
    if (nextIdx >= availableStudentsForGen.length) nextIdx = 0;
    const nextStudent = availableStudentsForGen[nextIdx];
    if (nextStudent) {
      loadStudentAudit(nextStudent);
    }
  };

  const exportBalancesToCSV = () => {
    if (filteredBalances.length === 0) {
      toast.error("Aucune donnée à exporter");
      return;
    }
    const headers = ['Matricule', 'Nom Complet', 'Classe / Option', 'Total Dû (HTG)', 'Total Payé (HTG)', 'Solde Dû (HTG)', 'Statut Compte'];
    const rows = filteredBalances.map(b => [
      `"${b.id.substring(0, 8)}"`,
      `"${b.fullName}"`,
      `"${b.className}"`,
      b.totalDue,
      b.paid,
      b.balance,
      b.balance === 0 ? 'À JOUR (SOLDÉ)' : 'DÉBITEUR'
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Releve_Soldes_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Registre des soldes exporté en CSV');
  };

  const exportToPDF = async () => {
    if (!selectedGenStudent) return;
    setIsExporting(true);
    try {
      const element = document.getElementById('releve-compte-print');
      if (!element) return;
      await new Promise(resolve => setTimeout(resolve, 300));

      const canvas = await html2canvas(element, { 
        scale: 2, 
        useCORS: true,
        logging: false,
        imageTimeout: 30000,
        onclone: (clonedDoc) => {
          fixOklchForCanvas(clonedDoc);
        }
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      addSecurityWatermark(pdf, { user, ipAddress });
      pdf.save(`Releve_${formatStudentName(selectedGenStudent.last_name, selectedGenStudent.first_name).fullName.replace(/\s+/g, '_')}.pdf`);
      toast.success("PDF du Relevé de compte téléchargé avec succès");
    } catch (error) {
      console.error("Erreur export PDF:", error);
      toast.error("Erreur lors de l'export PDF");
    } finally {
      setIsExporting(false);
    }
  };

  if (loading && !isCalculatingBalances) {
    return (
      <div className="bg-white rounded-3xl p-8 border border-slate-200/80 shadow-sm my-6">
        <FluidLoadingState 
          message="Chargement des relevés de comptes & audits financiers..." 
          subtext="Analyse approfondie des comptes d'élèves, échéanciers et versements en cours..." 
        />
        <SkeletonTable rows={5} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 pb-20 print:p-0">
      
      {/* NAVIGATION & HEADER MULTI-CAMPUS */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 print:hidden bg-white p-5 sm:p-6 rounded-3xl shadow-xs border border-slate-200/80">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-indigo-600 font-extrabold text-[10px] uppercase tracking-[0.2em]">
            <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
            <span>ÉCONOMAT • AUDIT FINANCIER</span>
            {!isSingleCampus && activeCampusName && (
              <>
                <span className="text-slate-300">•</span>
                <span className="bg-indigo-50 text-indigo-800 px-2.5 py-0.5 rounded-full border border-indigo-100 font-extrabold flex items-center gap-1.5 shadow-2xs">
                  <Globe size={11} className="text-indigo-600" />
                  {activeCampusName}
                </span>
              </>
            )}
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight">
            Relevé de Compte & Audit Financier
          </h2>
        </div>

        <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 w-full lg:w-auto shrink-0 flex-wrap sm:flex-nowrap gap-1">
          <button 
            onClick={() => setActiveView('balances')}
            className={`flex-1 lg:flex-none px-4 sm:px-5 py-2.5 rounded-xl text-xs font-bold tracking-tight transition-all flex items-center justify-center gap-2 cursor-pointer ${activeView === 'balances' ? 'bg-white text-indigo-700 shadow-xs ring-1 ring-slate-200/80 font-black' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'}`}
          >
            <History size={16} />
            Registre des Soldes
          </button>
          <button 
            onClick={() => setActiveView('audit_data')}
            className={`flex-1 lg:flex-none px-4 sm:px-5 py-2.5 rounded-xl text-xs font-bold tracking-tight transition-all flex items-center justify-center gap-2 cursor-pointer ${activeView === 'audit_data' ? 'bg-white text-indigo-700 shadow-xs ring-1 ring-slate-200/80 font-black' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'}`}
          >
            <SearchCheck size={16} />
            Facturé vs Encaissé
          </button>
          <button 
            onClick={() => { setActiveView('generator'); setSelectedGenStudent(null); }}
            className={`flex-1 lg:flex-none px-4 sm:px-5 py-2.5 rounded-xl text-xs font-bold tracking-tight transition-all flex items-center justify-center gap-2 cursor-pointer ${activeView === 'generator' ? 'bg-white text-indigo-700 shadow-xs ring-1 ring-slate-200/80 font-black' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'}`}
          >
            <FileText size={16} />
            Audit Individuel
          </button>
        </div>
      </div>

      {activeView === 'balances' ? (
        <>
          {/* CARDS DE SYNTÈSE FINANCIÈRE */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-2 relative overflow-hidden group">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[10px] font-black uppercase tracking-wider">Engagement Total</span>
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Wallet size={18} />
                </div>
              </div>
              <p className="text-2xl font-black text-slate-900 tracking-tight">
                {totalDueSum.toLocaleString()} <span className="text-xs font-bold text-slate-400">HTG</span>
              </p>
              <p className="text-[10px] font-semibold text-slate-400">Sur la sélection courante</p>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-2 relative overflow-hidden group">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[10px] font-black uppercase tracking-wider">Total Recouvré</span>
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <CheckCircle2 size={18} />
                </div>
              </div>
              <p className="text-2xl font-black text-emerald-600 tracking-tight">
                {totalPaidSum.toLocaleString()} <span className="text-xs font-bold text-slate-400">HTG</span>
              </p>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, Number(recoveryRate))}%` }} />
                </div>
                <span className="text-[10px] font-extrabold text-emerald-700">{recoveryRate}%</span>
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-2 relative overflow-hidden group">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[10px] font-black uppercase tracking-wider">Solde Restant Dû</span>
                <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                  <TrendingDown size={18} />
                </div>
              </div>
              <p className="text-2xl font-black text-rose-600 tracking-tight">
                {totalBalanceSum.toLocaleString()} <span className="text-xs font-bold text-slate-400">HTG</span>
              </p>
              <p className="text-[10px] font-bold text-rose-500">{debtorsCount} étudiant(s) débiteur(s)</p>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-2 relative overflow-hidden group">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[10px] font-black uppercase tracking-wider">Comptes à Jour</span>
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <ShieldCheck size={18} />
                </div>
              </div>
              <p className="text-2xl font-black text-slate-900 tracking-tight">
                {paidCount} <span className="text-xs font-bold text-slate-400">/ {filteredBalances.length}</span>
              </p>
              <p className="text-[10px] font-bold text-emerald-600">Dossiers entièrement soldés</p>
            </div>
          </div>

          {/* BARRE DE FILTRES AVANCÉS */}
          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200/80 space-y-4 print:hidden">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider ml-1 flex items-center gap-1.5">
                  <Calendar size={12} className="text-indigo-600" /> {terminology.academicYear}
                </label>
                <AcademicSessionPill
                  academicYears={academicYears}
                  selectedYearId={selectedYear}
                  onSelectYear={(yearId) => setSelectedYear(yearId)}
                  variant="field"
                  size="md"
                  colorScheme="indigo"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider ml-1 flex items-center gap-1.5">
                  <Layers size={12} className="text-indigo-600" /> Classe / Option
                </label>
                <ClassSelectorPill
                  classes={classesWithEnrollmentsForBalances}
                  selectedClassId={selectedClass}
                  onSelectClass={(id) => setSelectedClass(id)}
                  variant="field"
                  size="md"
                  colorScheme="indigo"
                  allowAll={true}
                  allLabel={`Toutes les classes (${classesWithEnrollmentsForBalances.length})`}
                  labelPrefix="Classe :"
                  className="w-full"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider ml-1 flex items-center gap-1.5">
                  <Search size={12} className="text-indigo-600" /> Recherche {terminology.student}
                </label>
                <div className="relative group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={16} />
                  <input 
                    type="text" 
                    placeholder="Filtrer par nom ou matricule..."
                    className="w-full pl-11 pr-8 py-3 bg-white text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-xl text-xs font-bold outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition-all shadow-2xs"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  {searchTerm && (
                    <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-xs font-bold p-1">
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* SECTEUR DE PLAGE DE DATES (DÉBUT / FIN) */}
            <div className="pt-3.5 border-t border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar size={13} className="text-indigo-600" /> Plage de Dates des Transactions
                </label>
                {(startDate || endDate) && (
                  <button
                    type="button"
                    onClick={() => handleSetDatePreset('clear')}
                    className="text-[11px] font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer transition-colors px-2 py-0.5 rounded-lg hover:bg-rose-50"
                  >
                    <X size={12} /> Effacer la période
                  </button>
                )}
              </div>

              {/* Grille 2 colonnes spacieuse pour les dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-1.5 min-w-0">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                    Du (Date Début)
                  </span>
                  <DatePickerPill
                    selectedDate={startDate}
                    onSelectDate={(d) => setStartDate(d)}
                    variant="field"
                    size="md"
                    colorScheme="indigo"
                    showQuickArrows={false}
                    className="w-full"
                  />
                </div>

                <div className="space-y-1.5 min-w-0">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                    Au (Date Fin)
                  </span>
                  <DatePickerPill
                    selectedDate={endDate}
                    onSelectDate={(d) => setEndDate(d)}
                    variant="field"
                    size="md"
                    colorScheme="indigo"
                    showQuickArrows={false}
                    className="w-full"
                  />
                </div>
              </div>

              {/* Sous-ruban Raccourcis Rapides ergonomique */}
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap pt-2.5 border-t border-slate-200/60">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider mr-1 flex items-center gap-1 shrink-0">
                  <Clock size={12} className="text-indigo-600" /> Raccourcis :
                </span>
                <button
                  type="button"
                  onClick={() => handleSetDatePreset('today')}
                  className="px-3 py-1.5 text-xs font-bold rounded-xl bg-white hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 transition-all border border-slate-200 hover:border-indigo-300 shadow-2xs cursor-pointer active:scale-95"
                >
                  Aujourd'hui
                </button>
                <button
                  type="button"
                  onClick={() => handleSetDatePreset('this_month')}
                  className="px-3 py-1.5 text-xs font-bold rounded-xl bg-white hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 transition-all border border-slate-200 hover:border-indigo-300 shadow-2xs cursor-pointer active:scale-95"
                >
                  Ce mois
                </button>
                <button
                  type="button"
                  onClick={() => handleSetDatePreset('this_quarter')}
                  className="px-3 py-1.5 text-xs font-bold rounded-xl bg-white hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 transition-all border border-slate-200 hover:border-indigo-300 shadow-2xs cursor-pointer active:scale-95"
                >
                  Ce trimestre
                </button>
                <button
                  type="button"
                  onClick={() => handleSetDatePreset('this_year')}
                  className="px-3 py-1.5 text-xs font-bold rounded-xl bg-white hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 transition-all border border-slate-200 hover:border-indigo-300 shadow-2xs cursor-pointer active:scale-95"
                >
                  Cette année
                </button>
              </div>
            </div>

            {/* Sub-toolbar: Quick Filter Pills & Export Buttons */}
            <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider mr-1 flex items-center gap-1">
                  <Filter size={12} /> Statut :
                </span>
                <button
                  onClick={() => setBalanceFilter('ALL')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                    balanceFilter === 'ALL'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Tous ({studentBalances.length})
                </button>
                <button
                  onClick={() => setBalanceFilter('DEBTORS')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                    balanceFilter === 'DEBTORS'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  Débiteurs ({studentBalances.filter(b => b.balance > 0).length})
                </button>
                <button
                  onClick={() => setBalanceFilter('PAID')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                    balanceFilter === 'PAID'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  À Jour ({studentBalances.filter(b => b.balance === 0).length})
                </button>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={exportBalancesToCSV}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 active:scale-95"
                >
                  <Download size={14} />
                  Excel / CSV
                </button>
                <button 
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs transition-all shadow-md shadow-indigo-500/20 flex items-center gap-1.5 active:scale-95"
                >
                  <Printer size={14} />
                  Imprimer Registre
                </button>
              </div>
            </div>
          </div>

          {/* TABLEAU DES SOLDES */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
            <div className="px-8 py-5 bg-slate-900 text-white flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/10 rounded-xl border border-white/10">
                  <TrendingUp size={18} className="text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold tracking-tight">Registre des Soldes d'Élèves</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {filteredBalances.length} étudiant(s) affiché(s) sur {studentBalances.length} au total
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Solde Total Filtré</span>
                <span className="text-lg font-black text-rose-400">{totalBalanceSum.toLocaleString()} HTG</span>
              </div>
            </div>
            
            <div className="overflow-x-auto print:overflow-visible custom-scrollbar">
              {isCalculatingBalances ? (
                <div className="p-20 text-center space-y-3">
                  <RefreshCcw className="animate-spin text-indigo-600 mx-auto" size={36} />
                  <p className="text-slate-500 font-bold text-xs uppercase tracking-widest">Calcul rigoureux des soldes en cours...</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse min-w-[880px]">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                      <th className="px-6 py-4 whitespace-nowrap">{terminology.student}</th>
                      <th className="px-4 py-4 whitespace-nowrap min-w-[120px] sm:min-w-[140px] md:min-w-[170px]">
                        <div className="flex items-center gap-1.5">
                          <Layers size={13} className="text-indigo-600 shrink-0" />
                          <span>{terminology.option}</span>
                        </div>
                      </th>
                      <th className="px-6 py-4 text-center whitespace-nowrap">Progression</th>
                      <th className="px-6 py-4 text-right whitespace-nowrap">Dû Total</th>
                      <th className="px-6 py-4 text-right whitespace-nowrap">Total Payé</th>
                      <th className="px-6 py-4 text-right whitespace-nowrap">Solde Dû</th>
                      <th className="px-6 py-4 text-center whitespace-nowrap">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedBalances.map((b) => {
                      const paidPct = b.totalDue > 0 ? Math.min(100, Math.round((b.paid / b.totalDue) * 100)) : 100;

                      return (
                        <tr key={b.id} className="group hover:bg-indigo-50/20 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 font-black text-xs shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                {b.last_name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-slate-900 text-xs sm:text-sm truncate">{b.fullName}</p>
                                <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-tight flex items-center gap-1.5 mt-0.5">
                                  <span className="font-mono text-slate-400 font-bold">ID: {b.id.substring(0,6)}</span>
                                  <span className="lg:hidden inline-flex items-center gap-0.5 text-[9px] bg-indigo-50 border border-indigo-100/80 text-indigo-700 px-1.5 py-0.5 rounded-md font-bold truncate max-w-[110px]" title={b.className}>
                                    <Layers size={9} className="shrink-0" />
                                    <span className="truncate">{b.className}</span>
                                  </span>
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <span 
                              title={b.className}
                              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 bg-slate-100/90 hover:bg-indigo-50 border border-slate-200/90 hover:border-indigo-200 text-slate-800 hover:text-indigo-900 rounded-lg sm:rounded-xl font-bold text-[10px] sm:text-[11px] md:text-xs max-w-[120px] sm:max-w-[160px] md:max-w-none truncate transition-colors shadow-2xs"
                            >
                              <Layers size={12} className="text-indigo-600 shrink-0 hidden xs:inline" />
                              <span className="truncate">{b.className}</span>
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex flex-col items-center gap-1 min-w-[100px]">
                              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full rounded-full ${paidPct === 100 ? 'bg-emerald-500' : paidPct > 50 ? 'bg-indigo-500' : 'bg-rose-500'}`}
                                  style={{ width: `${paidPct}%` }}
                                />
                              </div>
                              <span className="text-[10px] font-bold text-slate-500">{paidPct}% payé</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right font-bold text-slate-700 text-xs sm:text-sm whitespace-nowrap">
                            {b.totalDue.toLocaleString()} G
                          </td>
                          <td className="px-6 py-4 text-right font-bold text-emerald-600 text-xs sm:text-sm whitespace-nowrap">
                            {b.paid.toLocaleString()} G
                          </td>
                          <td className="px-6 py-4 text-right whitespace-nowrap">
                            <span className={`inline-block px-3 py-1 rounded-xl font-black text-xs ${
                              b.balance > 0 
                                ? 'bg-rose-50 text-rose-600 border border-rose-200/60' 
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                            }`}>
                              {b.balance > 0 ? `${b.balance.toLocaleString()} G` : 'SOLDE'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center whitespace-nowrap">
                            <button 
                              onClick={() => {
                                setActiveView('generator');
                                setGenClass(b.classId);
                                loadStudentAudit(b);
                              }}
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl text-xs shadow-xs hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all active:scale-95 whitespace-nowrap"
                            >
                              <Eye size={14} />
                              Audit Détaillé
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredBalances.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-16 text-center text-slate-400 italic font-medium">
                          Aucun(e) {terminology.student.toLowerCase()} correspondant aux critères de filtre.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="px-8 py-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50 print:hidden">
                <p className="text-xs text-slate-500 font-medium">
                  Affichage de <span className="font-bold text-slate-900">{(currentPage - 1) * itemsPerPage + 1}</span> à <span className="font-bold text-slate-900">{Math.min(currentPage * itemsPerPage, filteredBalances.length)}</span> sur <span className="font-bold text-slate-900">{filteredBalances.length}</span> résultats
                </p>
                <div className="flex gap-1 overflow-x-auto max-w-full pb-1 sm:pb-0">
                  {Array.from({ length: totalPages }).map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentPage(idx + 1)}
                      className={`w-8 h-8 flex items-center justify-center rounded-xl text-xs font-bold transition-all ${
                        currentPage === idx + 1
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {idx + 1}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      ) : activeView === 'audit_data' ? (
        /* VUE AUDIT DES DONNÉES FACTURÉ VS ENCAISSÉ */
        <div className="space-y-6 animate-in fade-in duration-300">
          
          {/* BANDEAU DIAGNOSTIC & LOGS DE DÉBOGAGE */}
          <div className="bg-white rounded-[2rem] p-6 shadow-xs border border-indigo-100 space-y-4 bg-gradient-to-br from-white via-indigo-50/20 to-white">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-200/80 shadow-2xs">
                  <SearchCheck size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-base tracking-tight text-slate-900">Diagnostic & Comparatif Facturé vs Encaissé</h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Synchronisé
                    </span>
                  </div>
                  <p className="text-slate-600 text-xs font-medium mt-0.5">
                    Analyse en temps réel de la cohérence des encaissements enregistrés vs engagements théoriques des élèves.
                  </p>
                </div>
              </div>
              
              <button
                onClick={() => {
                  toast.info("Ré-analyse du recouvrement et des paiements...");
                  calculateBalances();
                }}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm shadow-indigo-200 cursor-pointer active:scale-95"
              >
                <RefreshCcw size={14} className={isCalculatingBalances ? "animate-spin" : ""} />
                Ré-analyser & Rafraîchir les logs
              </button>
            </div>

            {/* METRIQUES DE SYNCHRONISATION AUDIT */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100 text-xs">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1 shadow-2xs">
                <span className="text-[10px] text-slate-600 uppercase font-bold tracking-wider block">Reçus Enregistrés</span>
                <p className="text-indigo-900 font-black text-sm">{auditDiagnosticInfo.totalPaymentsFetched} reçus recensés</p>
              </div>
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1 shadow-2xs">
                <span className="text-[10px] text-slate-600 uppercase font-bold tracking-wider block">Paiements Imputés</span>
                <p className="text-emerald-800 font-black text-sm">{auditDiagnosticInfo.matchedPaymentsCount} validés</p>
              </div>
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1 shadow-2xs">
                <span className="text-[10px] text-slate-600 uppercase font-bold tracking-wider block">Taux de Référence</span>
                <p className="text-amber-800 font-black text-sm">1 USD = {auditDiagnosticInfo.exchangeRateApplied} HTG</p>
              </div>
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1 shadow-2xs">
                <span className="text-[10px] text-slate-600 uppercase font-bold tracking-wider block">Comptes Audités</span>
                <p className="text-cyan-900 font-black text-sm">{auditDiagnosticInfo.totalStudentsProcessed} élèves</p>
              </div>
            </div>
          </div>

          {/* CARDS DE SYNTHÈSE AUDIT */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-xs space-y-2">
              <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Total Facturé Net</span>
              <p className="text-2xl font-black text-slate-900 tracking-tight">{totalDueSum.toLocaleString()} <span className="text-xs text-slate-500 font-bold">HTG</span></p>
              <p className="text-[10px] text-slate-600 font-semibold">Bordereaux + Frais divers - Réductions</p>
            </div>
            
            <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-xs space-y-2">
              <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Total Encaissé Effectif</span>
              <p className="text-2xl font-black text-emerald-700 tracking-tight">{totalPaidSum.toLocaleString()} <span className="text-xs text-slate-500 font-bold">HTG</span></p>
              <p className="text-[10px] text-emerald-700 font-bold">Versé sur les comptes d'élèves</p>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-xs space-y-2">
              <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Écart Restant à Recouvrer</span>
              <p className="text-2xl font-black text-rose-700 tracking-tight">{totalBalanceSum.toLocaleString()} <span className="text-xs text-slate-500 font-bold">HTG</span></p>
              <p className="text-[10px] text-rose-600 font-bold">{debtorsCount} étudiant(s) en retard</p>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-xs space-y-2">
              <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Taux de Recouvrement Réel</span>
              <p className="text-2xl font-black text-indigo-700 tracking-tight">{recoveryRate}%</p>
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200">
                <div className="bg-indigo-600 h-full rounded-full transition-all" style={{ width: `${Math.min(100, Number(recoveryRate))}%` }} />
              </div>
            </div>
          </div>

          {/* BARRE DE RECHERCHE ET FILTRES (CLASSE & PLAGE DE DATES) */}
          <div className="bg-white p-6 rounded-[2rem] border border-slate-200/90 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="relative flex-1 min-w-[260px] group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={16} />
                <input
                  type="text"
                  placeholder="Rechercher par nom, prénom ou matricule d'élève..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-11 pr-4 py-2.5 bg-white text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-xl text-xs font-bold outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition-all shadow-2xs"
                />
              </div>

              <div className="w-full sm:w-auto min-w-[200px]">
                <ClassSelectorPill
                  classes={classes}
                  selectedClassId={selectedClass}
                  onSelectClass={(id) => setSelectedClass(id)}
                  variant="field"
                  size="md"
                  colorScheme="indigo"
                  allowAll={true}
                  allLabel="Toutes les classes"
                  labelPrefix="Classe :"
                  className="w-full sm:w-auto"
                />
              </div>
            </div>

            {/* SECTEUR DE PLAGE DE DATES DANS FACTURÉ VS ENCAISSÉ */}
            <div className="pt-3.5 border-t border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar size={13} className="text-indigo-600" /> Plage de Dates des Transactions
                </label>
                {(startDate || endDate) && (
                  <button
                    type="button"
                    onClick={() => handleSetDatePreset('clear')}
                    className="text-[11px] font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer transition-colors px-2 py-0.5 rounded-lg hover:bg-rose-50"
                  >
                    <X size={12} /> Effacer la période
                  </button>
                )}
              </div>

              {/* Grille 2 colonnes spacieuse pour les dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-1.5 min-w-0">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                    Du (Date Début)
                  </span>
                  <DatePickerPill 
                    selectedDate={startDate}
                    onSelectDate={(d) => setStartDate(d)}
                    variant="field"
                    size="md"
                    colorScheme="indigo"
                    showQuickArrows={false}
                    className="w-full"
                  />
                </div>

                <div className="space-y-1.5 min-w-0">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                    Au (Date Fin)
                  </span>
                  <DatePickerPill 
                    selectedDate={endDate}
                    onSelectDate={(d) => setEndDate(d)}
                    variant="field"
                    size="md"
                    colorScheme="indigo"
                    showQuickArrows={false}
                    className="w-full"
                  />
                </div>
              </div>

              {/* Sous-ruban Raccourcis Rapides ergonomique */}
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap pt-2.5 border-t border-slate-200/60">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider mr-1 flex items-center gap-1 shrink-0">
                  <Clock size={12} className="text-indigo-600" /> Raccourcis :
                </span>
                <button
                  type="button"
                  onClick={() => handleSetDatePreset('today')}
                  className="px-3 py-1.5 text-xs font-bold rounded-xl bg-white hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 transition-all border border-slate-200 hover:border-indigo-300 shadow-2xs cursor-pointer active:scale-95"
                >
                  Aujourd'hui
                </button>
                <button
                  type="button"
                  onClick={() => handleSetDatePreset('this_month')}
                  className="px-3 py-1.5 text-xs font-bold rounded-xl bg-white hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 transition-all border border-slate-200 hover:border-indigo-300 shadow-2xs cursor-pointer active:scale-95"
                >
                  Ce mois
                </button>
                <button
                  type="button"
                  onClick={() => handleSetDatePreset('this_quarter')}
                  className="px-3 py-1.5 text-xs font-bold rounded-xl bg-white hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 transition-all border border-slate-200 hover:border-indigo-300 shadow-2xs cursor-pointer active:scale-95"
                >
                  Ce trimestre
                </button>
                <button
                  type="button"
                  onClick={() => handleSetDatePreset('this_year')}
                  className="px-3 py-1.5 text-xs font-bold rounded-xl bg-white hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 transition-all border border-slate-200 hover:border-indigo-300 shadow-2xs cursor-pointer active:scale-95"
                >
                  Cette année
                </button>
              </div>
            </div>
          </div>

          {/* TABLEAU COMPARATIF DÉTAILLÉ PAR ÉLÈVE */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/90 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <div>
                <h4 className="font-black text-slate-900 text-sm tracking-tight">Tableau d'Audit : Facturé vs Encaissé par Élève</h4>
                <p className="text-slate-600 text-xs font-medium mt-0.5">Vérification de chaque compte d'élève avec statut des reçus et du solde dues.</p>
              </div>
              <span className="text-xs font-black text-indigo-800 bg-indigo-50 border border-indigo-200 px-3.5 py-1.5 rounded-full shadow-2xs">
                {filteredBalances.length} élève(s)
              </span>
            </div>

            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left text-xs border-collapse min-w-[1080px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-100/80 text-slate-700 font-black uppercase text-[10px] tracking-wider">
                    <th className="p-4 pl-6 whitespace-nowrap">Élève / Matricule</th>
                    <th className="p-4 whitespace-nowrap min-w-[120px] sm:min-w-[140px] md:min-w-[170px]">
                      <div className="flex items-center gap-1.5">
                        <Layers size={13} className="text-indigo-600 shrink-0" />
                        <span>{terminology.option || 'Classe'}</span>
                      </div>
                    </th>
                    <th className="p-4 text-right whitespace-nowrap">Total Facturé (HTG)</th>
                    <th className="p-4 text-right whitespace-nowrap">Réductions (HTG)</th>
                    <th className="p-4 text-right whitespace-nowrap">Net Dû (HTG)</th>
                    <th className="p-4 text-right whitespace-nowrap">Total Encaissé (HTG)</th>
                    <th className="p-4 text-right whitespace-nowrap">Solde Dû (HTG)</th>
                    <th className="p-4 text-center whitespace-nowrap">Taux (%)</th>
                    <th className="p-4 text-center whitespace-nowrap">Statut</th>
                    <th className="p-4 text-right pr-6 whitespace-nowrap">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredBalances.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-slate-500 font-semibold">
                        Aucun élève ne correspond aux critères de recherche.
                      </td>
                    </tr>
                  ) : (
                    paginatedBalances.map((b) => {
                      const studentRate = b.totalDue > 0 ? Math.min(100, (b.paid / b.totalDue) * 100) : 100;
                      const isFullyPaid = b.balance <= 0;
                      const isPartial = b.paid > 0 && b.balance > 0;
                      
                      return (
                        <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-4 pl-6 whitespace-nowrap">
                            <div className="font-bold text-slate-900 text-xs sm:text-sm">{b.fullName}</div>
                            <div className="text-[10px] text-slate-500 font-mono font-bold flex items-center gap-1.5 mt-0.5">
                              <span>ID: {b.id.substring(0, 8)}</span>
                              <span className="lg:hidden inline-flex items-center gap-0.5 text-[9px] bg-indigo-50 border border-indigo-100/80 text-indigo-700 px-1.5 py-0.5 rounded-md font-bold truncate max-w-[110px]" title={b.className}>
                                <Layers size={9} className="shrink-0" />
                                <span className="truncate">{b.className}</span>
                              </span>
                            </div>
                          </td>
                          <td className="p-4 whitespace-nowrap">
                            <span 
                              title={b.className}
                              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 bg-slate-100/90 hover:bg-indigo-50 border border-slate-200/90 hover:border-indigo-200 font-bold text-slate-800 hover:text-indigo-900 rounded-lg sm:rounded-xl text-[10px] sm:text-[11px] md:text-xs max-w-[120px] sm:max-w-[160px] md:max-w-none truncate transition-colors shadow-2xs"
                            >
                              <Layers size={12} className="text-indigo-600 shrink-0 hidden xs:inline" />
                              <span className="truncate">{b.className}</span>
                            </span>
                          </td>
                          <td className="p-4 text-right font-bold text-slate-700 whitespace-nowrap">
                            {(b.originalDue || 0).toLocaleString()} G
                          </td>
                          <td className="p-4 text-right font-bold text-rose-600 whitespace-nowrap">
                            {b.totalDiscount > 0 ? `-${b.totalDiscount.toLocaleString()} G` : '-'}
                          </td>
                          <td className="p-4 text-right font-black text-slate-900 whitespace-nowrap">
                            {b.totalDue.toLocaleString()} G
                          </td>
                          <td className="p-4 text-right font-black text-emerald-700 whitespace-nowrap">
                            {b.paid.toLocaleString()} G
                            <div className="text-[9px] text-slate-500 font-semibold">{b.paymentCount || 0} versement(s)</div>
                          </td>
                          <td className="p-4 text-right font-black text-rose-700 whitespace-nowrap">
                            {b.balance.toLocaleString()} G
                          </td>
                          <td className="p-4 text-center whitespace-nowrap">
                            <span className={`font-mono text-[11px] font-black ${isFullyPaid ? 'text-emerald-700' : isPartial ? 'text-amber-700' : 'text-rose-700'}`}>
                              {studentRate.toFixed(0)}%
                            </span>
                          </td>
                          <td className="p-4 text-center whitespace-nowrap">
                            {isFullyPaid ? (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-300 whitespace-nowrap">
                                Réglé
                              </span>
                            ) : isPartial ? (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-amber-100 text-amber-800 border border-amber-300 whitespace-nowrap">
                                Partiel
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-rose-100 text-rose-800 border border-rose-300 whitespace-nowrap">
                                Impayé
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-right pr-6 whitespace-nowrap">
                            <button
                              onClick={() => {
                                setActiveView('generator');
                                loadStudentAudit(b);
                              }}
                              className="px-3.5 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-600 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ml-auto cursor-pointer shadow-2xs active:scale-95 whitespace-nowrap"
                            >
                              <FileText size={13} />
                              Audit Élève
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* PAGINATION */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/80">
                <span className="text-xs text-slate-700 font-bold">Page {currentPage} sur {totalPages}</span>
                <div className="flex gap-1.5">
                  {Array.from({ length: totalPages }).map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentPage(idx + 1)}
                      className={`w-7 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer ${currentPage === idx + 1 ? 'bg-indigo-600 text-white shadow-2xs' : 'bg-white text-slate-800 border border-slate-300 hover:bg-slate-100'}`}
                    >
                      {idx + 1}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* GÉNÉRATEUR D'AUDIT INDIVIDUEL */
        <div className="max-w-6xl mx-auto animate-in slide-in-from-bottom-6 duration-500 print:hidden space-y-6">
          
          {/* BARRE DE SÉLECTION D'ÉLÈVE */}
          <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200/80 p-6 sm:p-8 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider ml-1 flex items-center gap-1.5">
                  <Calendar size={12} className="text-indigo-600" /> 1. {terminology.academicYear}
                </label>
                <AcademicSessionPill
                  academicYears={academicYears}
                  selectedYearId={genYear}
                  onSelectYear={(yearId) => setGenYear(yearId)}
                  variant="field"
                  size="md"
                  colorScheme="indigo"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider ml-1 flex items-center gap-1.5">
                  <Layers size={12} className="text-indigo-600" /> 2. {terminology.class}
                </label>
                <ClassSelectorPill
                  classes={classesWithEnrollmentsForGen}
                  selectedClassId={genClass}
                  onSelectClass={(id) => { setGenClass(id); setSelectedGenStudent(null); }}
                  variant="field"
                  size="md"
                  colorScheme="indigo"
                  allowAll={false}
                  labelPrefix="Classe :"
                  className="w-full"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider ml-1 flex items-center gap-1.5">
                  <User size={12} className="text-indigo-600" /> 3. Choisir l'élève ({availableStudentsForGen.length})
                </label>
                <SelectPill
                  options={genStudentOptions}
                  value={selectedGenStudent?.id || ''}
                  onChange={(id) => {
                    const student = availableStudentsForGen.find(s => s.id === id);
                    if (student) loadStudentAudit(student);
                  }}
                  variant="field"
                  size="md"
                  colorScheme="indigo"
                  searchable={true}
                  placeholder="-- Choisir un étudiant / élève --"
                  icon={User}
                  className="w-full"
                />
              </div>
            </div>

            {/* SECTEUR DE PLAGE DE DATES DANS L'AUDIT INDIVIDUEL */}
            <div className="pt-3.5 border-t border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar size={13} className="text-indigo-600" /> Filtrer l'Audit par Période de Transactions
                </label>
                {(startDate || endDate) && (
                  <button
                    type="button"
                    onClick={() => handleSetDatePreset('clear')}
                    className="text-[11px] font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer transition-colors px-2 py-0.5 rounded-lg hover:bg-rose-50"
                  >
                    <X size={12} /> Réinitialiser Période
                  </button>
                )}
              </div>

              {/* Grille 2 colonnes spacieuse pour les dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-1.5 min-w-0">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                    Du (Date Début)
                  </span>
                  <DatePickerPill
                    selectedDate={startDate}
                    onSelectDate={(d) => setStartDate(d)}
                    variant="field"
                    size="md"
                    colorScheme="indigo"
                    showQuickArrows={false}
                    className="w-full"
                  />
                </div>

                <div className="space-y-1.5 min-w-0">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                    Au (Date Fin)
                  </span>
                  <DatePickerPill
                    selectedDate={endDate}
                    onSelectDate={(d) => setEndDate(d)}
                    variant="field"
                    size="md"
                    colorScheme="indigo"
                    showQuickArrows={false}
                    className="w-full"
                  />
                </div>
              </div>

              {/* Sous-ruban Raccourcis Rapides ergonomique */}
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap pt-2.5 border-t border-slate-200/60">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider mr-1 flex items-center gap-1 shrink-0">
                  <Clock size={12} className="text-indigo-600" /> Raccourcis :
                </span>
                <button
                  type="button"
                  onClick={() => handleSetDatePreset('today')}
                  className="px-3 py-1.5 text-xs font-bold rounded-xl bg-white hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 transition-all border border-slate-200 hover:border-indigo-300 shadow-2xs cursor-pointer active:scale-95"
                >
                  Aujourd'hui
                </button>
                <button
                  type="button"
                  onClick={() => handleSetDatePreset('this_month')}
                  className="px-3 py-1.5 text-xs font-bold rounded-xl bg-white hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 transition-all border border-slate-200 hover:border-indigo-300 shadow-2xs cursor-pointer active:scale-95"
                >
                  Ce mois
                </button>
                <button
                  type="button"
                  onClick={() => handleSetDatePreset('this_quarter')}
                  className="px-3 py-1.5 text-xs font-bold rounded-xl bg-white hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 transition-all border border-slate-200 hover:border-indigo-300 shadow-2xs cursor-pointer active:scale-95"
                >
                  Ce trimestre
                </button>
                <button
                  type="button"
                  onClick={() => handleSetDatePreset('this_year')}
                  className="px-3 py-1.5 text-xs font-bold rounded-xl bg-white hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 transition-all border border-slate-200 hover:border-indigo-300 shadow-2xs cursor-pointer active:scale-95"
                >
                  Cette année
                </button>
              </div>
            </div>

            {/* Quick Navigation Controls for Class Students */}
            {selectedGenStudent && availableStudentsForGen.length > 1 && (
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-500">
                  Élève <span className="font-bold text-slate-900">{currentGenStudentIndex + 1}</span> sur <span className="font-bold text-slate-900">{availableStudentsForGen.length}</span> dans cette classe
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => navigateAuditStudent('prev')}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs flex items-center gap-1 transition-all"
                  >
                    <ArrowLeft size={14} /> Élève Précédent
                  </button>
                  <button
                    onClick={() => navigateAuditStudent('next')}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs flex items-center gap-1 transition-all"
                  >
                    Élève Suivant <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* AUDIT DÉTAILLÉ DE L'ÉLÈVE */}
          {selectedGenStudent ? (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
              
              {/* Entête Fiche Élève */}
              <div className="bg-white p-6 rounded-[2rem] border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center font-black text-xl shadow-md shadow-indigo-500/20">
                    {selectedGenStudent.last_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">
                      {formatStudentName(selectedGenStudent.last_name, selectedGenStudent.first_name).fullName}
                    </h3>
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-500 mt-1">
                      <span className="bg-slate-100 px-2.5 py-0.5 rounded-lg border border-slate-200 text-slate-700">
                        Classe : {selectedGenStudent.className}
                      </span>
                      <span>•</span>
                      <span className="font-mono text-slate-400">ID: {selectedGenStudent.id}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto">
                  <button 
                    onClick={exportToPDF}
                    disabled={isExporting}
                    className="flex-1 md:flex-none px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold text-xs tracking-tight transition-all shadow-md shadow-emerald-500/20 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                  >
                    {isExporting ? <RefreshCcw size={16} className="animate-spin" /> : <FileDown size={16} />}
                    Télécharger PDF
                  </button>
                  <button 
                    onClick={() => setPrintPreview(selectedGenStudent)}
                    className="flex-1 md:flex-none px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold text-xs tracking-tight transition-all shadow-md shadow-indigo-500/20 flex items-center justify-center gap-2 active:scale-95"
                  >
                    <Printer size={16} />
                    Imprimer Relevé
                  </button>
                </div>
              </div>

              {/* Portefeuille Détaillé & Multi-Devises */}
              <div className="bg-white border border-slate-200/80 rounded-[2.5rem] shadow-xs p-6 sm:p-8 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                      <Wallet size={22} />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-lg tracking-tight">Portefeuille Détaillé & Multi-Devises</h4>
                      <p className="text-xs font-medium text-slate-500">Répartition analytique des frais exigés, versements et solde par catégorie</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedGenStudent.exchangeRate && (
                      <span className="text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 px-3 py-1.5 rounded-xl border border-slate-200">
                        Taux : 1 USD = {selectedGenStudent.exchangeRate} HTG
                      </span>
                    )}
                    <div className={`px-3.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 ${selectedGenStudent.balance > 0 ? 'bg-rose-50 text-rose-600 border border-rose-200/60' : 'bg-emerald-50 text-emerald-600 border border-emerald-200/60'}`}>
                      <span className="h-2 w-2 rounded-full bg-current animate-pulse" />
                      {selectedGenStudent.balance > 0 ? `Solde Dû: ${selectedGenStudent.balance.toLocaleString()} HTG` : 'Dossier Soldé'}
                    </div>
                  </div>
                </div>

                {/* Grid cards per fee category */}
                {(() => {
                  const showCamp = Boolean(
                    selectedGenStudent.hasCampaigns || 
                    (selectedGenStudent.campaignsPaid || 0) > 0 || 
                    (selectedGenStudent.campaignsFee || 0) > 0 || 
                    (selectedGenStudent.campaignsNativeHTG || 0) > 0 || 
                    (selectedGenStudent.campaignsNativeUSD || 0) > 0 ||
                    (selectedGenStudent.campaignPayments && selectedGenStudent.campaignPayments.length > 0)
                  );
                  const showMisc = Boolean(
                    (selectedGenStudent.miscFee || 0) > 0 || 
                    (selectedGenStudent.miscPaid || 0) > 0 || 
                    (selectedGenStudent.miscNativeHTG || 0) > 0 || 
                    (selectedGenStudent.miscNativeUSD || 0) > 0 ||
                    (selectedGenStudent.miscPayments && selectedGenStudent.miscPayments.length > 0)
                  );
                  let colsClass = 'md:grid-cols-2';
                  if (showCamp && showMisc) colsClass = 'md:grid-cols-4';
                  else if (showCamp || showMisc) colsClass = 'md:grid-cols-3';

                  return (
                    <div className={`grid grid-cols-1 ${colsClass} gap-4`}>
                      {/* 1. Admission / Inscription */}
                      {(() => {
                        const details = getFeeRowDetails(
                          selectedGenStudent.admissionNativeHTG || 0,
                          selectedGenStudent.admissionNativeUSD || 0,
                          selectedGenStudent.admissionPaid || 0,
                          selectedGenStudent.exchangeRate || 132.50,
                          selectedGenStudent.admissionPayments
                        );
                        return (
                          <div className="bg-slate-50/70 rounded-2xl p-5 border border-slate-200/70 space-y-3">
                            <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                              <span className="text-xs font-black uppercase text-slate-700 tracking-wider">Admission / Inscription</span>
                              <span className="text-[10px] bg-slate-200/80 text-slate-700 px-2 py-0.5 rounded-lg font-black">FIXE</span>
                            </div>
                            <div className="space-y-2 text-xs">
                              <div className="flex justify-between items-start text-slate-500 font-medium">
                                <span>Frais Exigés :</span>
                                <div className="text-right">
                                  <span className="font-extrabold text-slate-900 block">{details.plannedNative}</span>
                                  {details.plannedEquiv && <span className="text-[10px] text-slate-400 font-mono block">{details.plannedEquiv}</span>}
                                </div>
                              </div>
                              <div className="flex justify-between items-start text-slate-500 font-medium">
                                <span>Montant Versé :</span>
                                <div className="text-right">
                                  <span className="font-extrabold text-emerald-600 block">{details.paidNative}</span>
                                  {details.paidEquiv && <span className="text-[10px] text-emerald-500 font-mono block">{details.paidEquiv}</span>}
                                </div>
                              </div>
                              <div className="border-t border-slate-200/60 pt-2 flex justify-between items-start">
                                <span className="font-bold text-slate-700">Reste à payer :</span>
                                <div className="text-right">
                                  <span className={`font-black ${details.isPaid ? 'text-emerald-600' : 'text-rose-600'} block`}>
                                    {details.remainingNative}
                                  </span>
                                  {!details.isPaid && details.remainingEquiv && (
                                    <span className="text-[10px] font-semibold text-rose-400 font-mono block">{details.remainingEquiv}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* 2. Scolarité (Tuition) */}
                      {(() => {
                        const details = getFeeRowDetails(
                          selectedGenStudent.tuitionNativeHTG || 0,
                          selectedGenStudent.tuitionNativeUSD || 0,
                          selectedGenStudent.tuitionPaid || 0,
                          selectedGenStudent.exchangeRate || 132.50,
                          selectedGenStudent.tuitionPayments
                        );
                        return (
                          <div className="bg-slate-50/70 rounded-2xl p-5 border border-slate-200/70 space-y-3">
                            <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                              <span className="text-xs font-black uppercase text-slate-700 tracking-wider">Frais {terminology.tuition}</span>
                              <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-lg font-black">CONTRAT</span>
                            </div>
                            <div className="space-y-2 text-xs">
                              <div className="flex justify-between items-start text-slate-500 font-medium">
                                <span>Frais Ajustés :</span>
                                <div className="text-right">
                                  <span className="font-extrabold text-slate-900 block">{details.plannedNative}</span>
                                  {details.plannedEquiv && <span className="text-[10px] text-slate-400 font-mono block">{details.plannedEquiv}</span>}
                                </div>
                              </div>
                              <div className="flex justify-between items-start text-slate-500 font-medium">
                                <span>Montant Versé :</span>
                                <div className="text-right">
                                  <span className="font-extrabold text-emerald-600 block">{details.paidNative}</span>
                                  {details.paidEquiv && <span className="text-[10px] text-emerald-500 font-mono block">{details.paidEquiv}</span>}
                                </div>
                              </div>
                              <div className="border-t border-slate-200/60 pt-2 flex justify-between items-start">
                                <span className="font-bold text-slate-700">Reste à payer :</span>
                                <div className="text-right">
                                  <span className={`font-black ${details.isPaid ? 'text-emerald-600' : 'text-rose-600'} block`}>
                                    {details.remainingNative}
                                  </span>
                                  {!details.isPaid && details.remainingEquiv && (
                                    <span className="text-[10px] font-semibold text-rose-400 font-mono block">{details.remainingEquiv}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* 3. Campagnes Ad-hoc */}
                      {showCamp && (() => {
                        const details = getFeeRowDetails(
                          selectedGenStudent.campaignsNativeHTG || 0,
                          selectedGenStudent.campaignsNativeUSD || 0,
                          selectedGenStudent.campaignsPaid || 0,
                          selectedGenStudent.exchangeRate || 132.50,
                          selectedGenStudent.campaignPayments
                        );
                        return (
                          <div className="bg-slate-50/70 rounded-2xl p-5 border border-slate-200/70 space-y-3">
                            <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                              <span className="text-xs font-black uppercase text-slate-700 tracking-wider">Campagnes & Activités</span>
                              <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-lg font-black">SPÉCIAL</span>
                            </div>
                            <div className="space-y-2 text-xs">
                              <div className="flex justify-between items-start text-slate-500 font-medium">
                                <span>Frais Exigés :</span>
                                <div className="text-right">
                                  <span className="font-extrabold text-slate-900 block">{details.plannedNative}</span>
                                  {details.plannedEquiv && <span className="text-[10px] text-slate-400 font-mono block">{details.plannedEquiv}</span>}
                                </div>
                              </div>
                              <div className="flex justify-between items-start text-slate-500 font-medium">
                                <span>Montant Versé :</span>
                                <div className="text-right">
                                  <span className="font-extrabold text-emerald-600 block">{details.paidNative}</span>
                                  {details.paidEquiv && <span className="text-[10px] text-emerald-500 font-mono block">{details.paidEquiv}</span>}
                                </div>
                              </div>
                              <div className="border-t border-slate-200/60 pt-2 flex justify-between items-start">
                                <span className="font-bold text-slate-700">Reste à payer :</span>
                                <div className="text-right">
                                  <span className={`font-black ${details.isPaid ? 'text-emerald-600' : 'text-rose-600'} block`}>
                                    {details.remainingNative}
                                  </span>
                                  {!details.isPaid && details.remainingEquiv && (
                                    <span className="text-[10px] font-semibold text-rose-400 font-mono block">{details.remainingEquiv}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* 4. Frais Divers Obligatoires */}
                      {showMisc && (() => {
                        const details = getFeeRowDetails(
                          selectedGenStudent.miscNativeHTG || 0,
                          selectedGenStudent.miscNativeUSD || 0,
                          selectedGenStudent.miscPaid || 0,
                          selectedGenStudent.exchangeRate || 132.50,
                          selectedGenStudent.miscPayments
                        );
                        return (
                          <div className="bg-slate-50/70 rounded-2xl p-5 border border-slate-200/70 space-y-3">
                            <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                              <span className="text-xs font-black uppercase text-slate-700 tracking-wider">Frais Divers Obligatoires</span>
                              <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-lg font-black">ANNUEL</span>
                            </div>
                            <div className="space-y-2 text-xs">
                              <div className="flex justify-between items-start text-slate-500 font-medium">
                                <span>Frais Planifiés :</span>
                                <div className="text-right">
                                  <span className="font-extrabold text-slate-900 block">{details.plannedNative}</span>
                                  {details.plannedEquiv && <span className="text-[10px] text-slate-400 font-mono block">{details.plannedEquiv}</span>}
                                </div>
                              </div>
                              <div className="flex justify-between items-start text-slate-500 font-medium">
                                <span>Montant Versé :</span>
                                <div className="text-right">
                                  <span className="font-extrabold text-emerald-600 block">{details.paidNative}</span>
                                  {details.paidEquiv && <span className="text-[10px] text-emerald-500 font-mono block">{details.paidEquiv}</span>}
                                </div>
                              </div>
                              <div className="border-t border-slate-200/60 pt-2 flex justify-between items-start">
                                <span className="font-bold text-slate-700">Reste à payer :</span>
                                <div className="text-right">
                                  <span className={`font-black ${details.isPaid ? 'text-emerald-600' : 'text-rose-600'} block`}>
                                    {details.remainingNative}
                                  </span>
                                  {!details.isPaid && details.remainingEquiv && (
                                    <span className="text-[10px] font-semibold text-rose-400 font-mono block">{details.remainingEquiv}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })()}
              </div>

              {/* Résumé Financier KPIs */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-slate-900 p-6 rounded-[2rem] text-white shadow-sm border-b-4 border-b-indigo-500 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Engagement Total Dû</p>
                    <TrendingUp size={18} className="text-indigo-400" />
                  </div>
                  <h3 className="text-3xl font-black tracking-tight">{selectedGenStudent.totalDue.toLocaleString()} <span className="text-sm font-medium">HTG</span></h3>
                  <p className="text-[10px] text-slate-400 font-medium">Scolarité + Inscription + Ad-hoc - Bourses</p>
                </div>

                <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200/80 border-b-4 border-b-emerald-500 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Encaissé</p>
                    <CheckCircle2 size={18} className="text-emerald-500" />
                  </div>
                  <h3 className="text-3xl font-black text-slate-900 tracking-tight">{selectedGenStudent.paid.toLocaleString()} <span className="text-sm font-medium">HTG</span></h3>
                  <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-tight">
                    Recouvrement : {selectedGenStudent.totalDue > 0 ? ((selectedGenStudent.paid / selectedGenStudent.totalDue) * 100).toFixed(1) : 100}%
                  </p>
                </div>

                <div className={`p-6 rounded-[2rem] shadow-sm border border-slate-200/80 border-b-4 space-y-3 ${selectedGenStudent.balance > 0 ? 'border-b-rose-500 bg-rose-50/20' : 'border-b-emerald-500 bg-emerald-50/20'}`}>
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Solde Restant</p>
                    <AlertCircle size={18} className={selectedGenStudent.balance > 0 ? 'text-rose-500' : 'text-emerald-500'} />
                  </div>
                  <h3 className={`text-3xl font-black tracking-tight ${selectedGenStudent.balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {selectedGenStudent.balance.toLocaleString()} <span className="text-sm font-medium">HTG</span>
                  </h3>
                  <p className={`text-[10px] font-bold uppercase tracking-tight ${selectedGenStudent.balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {selectedGenStudent.balance > 0 ? 'Compte Débiteur' : 'Dossier Entièrement Soldé'}
                  </p>
                </div>
              </div>

              {/* Historique des Versements */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-slate-100 text-slate-700 rounded-xl flex items-center justify-center">
                       <Clock size={18} />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-slate-900 tracking-tight">Historique des Versements & Transactions</h4>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <span>{filteredStudentHistory.length} transaction(s) affichée(s) sur {studentHistory.length}</span>
                        {(startDate || endDate) && (
                          <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md border border-indigo-200 text-[9px] font-black">
                            Période : {startDate ? `Du ${startDate}` : ''} {endDate ? `Au ${endDate}` : ''}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[780px] text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                        <th className="px-4 py-3.5 whitespace-nowrap">Date</th>
                        <th className="px-4 py-3.5 whitespace-nowrap">Référence</th>
                        <th className="px-4 py-3.5 whitespace-nowrap">Nature du Paiement</th>
                        <th className="px-4 py-3.5 whitespace-nowrap">Mode</th>
                        <th className="px-4 py-3.5 text-right whitespace-nowrap">Montant Payé</th>
                        <th className="px-4 py-3.5 text-center whitespace-nowrap">Taux Appliqué</th>
                        <th className="px-4 py-3.5 text-right whitespace-nowrap">Valeur de Base (HTG)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredStudentHistory.map((p) => {
                        const isUSD = p.currency === 'USD';
                        const paidAmount = Number(p.amount || 0);
                        const appliedRate = Number(p.exchange_rate_applied || schoolDetails?.exchange_rate || 140);
                        const baseHTG = Number(p.amount_htg_equivalent || (isUSD ? paidAmount * appliedRate : paidAmount));

                        return (
                          <tr key={p.id} className="group hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3.5 whitespace-nowrap">
                              <div className="flex items-center gap-2 whitespace-nowrap">
                                <Calendar size={14} className="text-slate-400 shrink-0" />
                                <span className="font-bold text-slate-900 text-xs">{new Date(p.created_at).toLocaleDateString('fr-FR')}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3.5 whitespace-nowrap">
                              <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg font-mono text-[10px] font-bold border border-slate-200 whitespace-nowrap inline-block">
                                RCP-{p.id.substring(0,8).toUpperCase()}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 whitespace-nowrap">
                              <span className="text-[10px] font-extrabold text-slate-700 uppercase tracking-tight bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200/50 whitespace-nowrap inline-block">
                                {p.campaign?.name 
                                  ? `Campagne: ${p.campaign.name}` 
                                  : p.ad_hoc_campaign_id 
                                  ? 'Frais de Campagne' 
                                  : (p.fee_type === 'SCOLARITE' || (!p.fee_type && (!p.nature || p.nature === 'SCOLARITE' || p.nature === 'Scolarité'))) 
                                  ? 'Scolarité' 
                                  : ((p.fee_type === 'INSCRIPTION' || p.nature === 'INSCRIPTION' || p.nature === "Frais d'inscription") 
                                  ? 'Inscription' 
                                  : (p.nature || p.type || p.fee_type || 'Frais Divers'))}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 whitespace-nowrap">
                              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tight whitespace-nowrap inline-block">{p.payment_method || 'Comptant'}</span>
                            </td>
                            <td className="px-4 py-3.5 text-right font-mono font-bold whitespace-nowrap">
                              {isUSD ? (
                                <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-xs whitespace-nowrap inline-block">
                                  ${paidAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} USD
                                </span>
                              ) : (
                                <span className="text-slate-800 text-xs whitespace-nowrap inline-block">
                                  {paidAmount.toLocaleString()} HTG
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3.5 text-center whitespace-nowrap">
                              {isUSD ? (
                                <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded text-[10px] font-mono font-bold whitespace-nowrap" title={`Taux appliqué : 1 USD = ${appliedRate} HTG`}>
                                  <ArrowRightLeft size={10} className="text-amber-600 shrink-0" />
                                  <span>1 USD = {appliedRate} HTG</span>
                                </span>
                              ) : (
                                <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded whitespace-nowrap inline-block">
                                  1:1 (HTG)
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3.5 text-right font-semibold font-mono text-slate-900 whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                                <span className="text-xs sm:text-sm font-black text-slate-900 whitespace-nowrap">
                                  {baseHTG.toLocaleString()} G
                                </span>

                                {/* Infobulle détaillée */}
                                <div className="relative group inline-block">
                                  <button
                                    type="button"
                                    className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors cursor-pointer"
                                    title="Détail du versement multi-devise"
                                  >
                                    <Info size={13} />
                                  </button>
                                  
                                  <div className="absolute right-0 bottom-full mb-2 hidden group-hover:block z-50 w-72 bg-slate-900 text-white rounded-xl shadow-2xl p-3 border border-slate-700 pointer-events-none animate-in fade-in zoom-in-95 duration-150">
                                    <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2">
                                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1">
                                        <ArrowRightLeft size={11} /> Décompte Financier
                                      </span>
                                      <span className="text-[9px] font-mono text-slate-400">
                                        RCP-{p.id.substring(0,8).toUpperCase()}
                                      </span>
                                    </div>
                                    <div className="space-y-1.5 text-xs text-left">
                                      <div className="flex justify-between items-center text-slate-300">
                                        <span className="text-[11px] text-slate-400">Montant payé :</span>
                                        <span className="font-mono font-bold text-emerald-400">
                                          {isUSD ? `$${paidAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} USD` : `${paidAmount.toLocaleString()} HTG`}
                                        </span>
                                      </div>
                                      <div className="flex justify-between items-center text-slate-300">
                                        <span className="text-[11px] text-slate-400">Taux appliqué :</span>
                                        <span className="font-mono font-bold text-amber-300">
                                          {isUSD ? `1 USD = ${appliedRate} HTG` : `1:1 (Monnaie de base)`}
                                        </span>
                                      </div>
                                      <div className="flex justify-between items-center text-slate-300 pt-1 border-t border-slate-800">
                                        <span className="text-[11px] text-slate-400 font-bold">Valeur en monnaie de base :</span>
                                        <span className="font-mono font-black text-white">
                                          {baseHTG.toLocaleString()} HTG
                                        </span>
                                      </div>
                                      <div className="text-[9px] text-slate-400 pt-1 border-t border-slate-800 flex justify-between">
                                        <span>Date :</span>
                                        <span>{new Date(p.created_at).toLocaleString('fr-FR')}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {studentHistory.length === 0 && (
                        <tr>
                          <td colSpan={7} className="p-16 text-center text-slate-400 italic font-medium">Aucun versement enregistré pour cet étudiant.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50/60 p-16 rounded-[3rem] border-2 border-dashed border-slate-200 text-center space-y-4 max-w-2xl mx-auto">
              <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto shadow-xs border border-slate-200 text-indigo-600">
                <SearchCheck size={32} />
              </div>
              <div className="space-y-1">
                <p className="text-slate-900 font-black text-lg tracking-tight">Audit Financier Individuel</p>
                <p className="text-slate-500 font-medium text-xs leading-relaxed max-w-md mx-auto">
                  Sélectionnez une année académique, une classe et un(e) {terminology.student.toLowerCase()} pour consulter son état financier certifié et générer son relevé officiel.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL RELEVÉ OFFICIEL POUR IMPRESSION */}
      <PrintPreviewModal
        isOpen={!!printPreview}
        onClose={() => setPrintPreview(null)}
        title="Relevé de Compte Officiel"
        subtitle="Audit Certifié • EduNova Pro"
        onPrint={() => window.print()}
      >
        {printPreview && (
          <div id="releve-compte-print" className="max-w-3xl mx-auto shadow-2xl print:shadow-none print:m-0 print:w-full p-10 border-0 rounded-[2rem] bg-white relative overflow-hidden text-left">
                {/* Decoration background */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-slate-50 rounded-full -mr-32 -mt-32 pointer-events-none opacity-50" />
                
                {/* Header */}
                <div className="relative flex justify-between items-start mb-10">
                  <div className="flex gap-5 items-center">
                    {schoolDetails?.logo_url ? (
                      <div className="w-20 h-20 bg-white rounded-2xl shadow-sm border border-slate-100 p-2 flex items-center justify-center overflow-hidden">
                        <img 
                          src={schoolDetails.logo_url} 
                          alt="Logo" 
                          className="max-w-full max-h-full object-contain"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    ) : (
                      <div className="w-20 h-20 bg-white rounded-2xl shadow-sm border border-slate-100 p-2 flex items-center justify-center overflow-hidden">
                        <img 
                          src="/logo.png" 
                          alt="Logo" 
                          className="max-w-full max-h-full object-contain"
                        />
                      </div>
                    )}
                    <div>
                      <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight leading-none mb-2">{schoolDetails?.name}</h1>
                      <div className="space-y-0.5">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                          <FileText size={10} className="text-slate-300" /> {schoolDetails?.address}
                        </p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                          <RefreshCcw size={10} className="text-slate-300" /> {schoolDetails?.phone} {schoolDetails?.email && `| ${schoolDetails.email}`}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="inline-block px-3.5 py-1.5 bg-slate-900 text-white rounded-lg text-[10px] font-black uppercase tracking-[0.2em] mb-2 shadow-md shadow-slate-200">
                      RELEVÉ DE COMPTE
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Date d'émission</p>
                      <p className="text-xs font-black text-slate-900">{new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                      {(startDate || endDate) && (
                        <p className="text-[9px] font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded mt-1 inline-block">
                          Période : {startDate ? `Du ${startDate}` : ''} {endDate ? `Au ${endDate}` : ''}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Student Info Card */}
                <div className="grid grid-cols-2 gap-6 mb-8">
                  <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 relative overflow-hidden">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Informations {terminology.student}</p>
                    <div className="relative z-10 space-y-1">
                      <p className="text-xl font-black text-slate-900 uppercase tracking-tight leading-tight">
                        {formatStudentName(printPreview.last_name, printPreview.first_name).fullName}
                      </p>
                      <div className="flex items-center gap-2 pt-1">
                        <span className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[9px] font-black text-slate-500 uppercase tracking-widest">MATRICULE</span>
                        <p className="text-xs font-bold text-slate-700 font-mono">{printPreview.id.substring(0, 8).toUpperCase()}</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 relative overflow-hidden">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Détails Académiques</p>
                    <div className="grid grid-cols-2 gap-3 relative z-10">
                      <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">{terminology.class}</p>
                        <p className="text-sm font-black text-slate-900">{printPreview.className}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">{terminology.academicYear}</p>
                        <p className="text-sm font-black text-slate-900">{printPreview.academicYear}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Financial Summary Table */}
                <div className="mb-8 overflow-hidden rounded-2xl border border-slate-200 shadow-xs">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-slate-900 text-white">
                        <th className="py-3 px-4 text-left text-[9px] font-black uppercase tracking-[0.15em]">Désignation des Frais</th>
                        <th className="py-3 px-4 text-center text-[9px] font-black uppercase tracking-[0.15em]">Montant Exigé</th>
                        <th className="py-3 px-4 text-right text-[9px] font-black uppercase tracking-[0.15em]">Encaissé</th>
                        <th className="py-3 px-4 text-right text-[9px] font-black uppercase tracking-[0.15em]">Reste à Payer</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {/* 1. Admission / Inscription */}
                      {(() => {
                        const details = getFeeRowDetails(
                          printPreview.admissionNativeHTG || 0,
                          printPreview.admissionNativeUSD || 0,
                          printPreview.admissionPaid || 0,
                          printPreview.exchangeRate || 132.50
                        );
                        return (
                          <tr>
                            <td className="py-3 px-4 font-bold text-slate-800">
                              Frais d'Inscription / Réinscription
                            </td>
                            <td className="py-3 px-4 text-center font-mono">
                              <span className="font-bold text-slate-900 block">{details.plannedNative}</span>
                              {details.plannedEquiv && <span className="text-[9px] text-slate-400 block">{details.plannedEquiv}</span>}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">
                              {details.paidNative}
                            </td>
                            <td className="py-3 px-4 text-right font-mono">
                              <span className={`font-black ${details.isPaid ? 'text-emerald-600' : 'text-rose-600'} block`}>
                                {details.remainingNative}
                              </span>
                              {!details.isPaid && details.remainingEquiv && (
                                <span className="text-[9px] text-slate-400 block">{details.remainingEquiv}</span>
                              )}
                            </td>
                          </tr>
                        );
                      })()}

                      {/* 2. Scolarité (Tuition) */}
                      {(() => {
                        const details = getFeeRowDetails(
                          printPreview.tuitionNativeHTG || 0,
                          printPreview.tuitionNativeUSD || 0,
                          printPreview.tuitionPaid || 0,
                          printPreview.exchangeRate || 132.50
                        );
                        return (
                          <tr>
                            <td className="py-3 px-4 font-bold text-slate-800">
                              Frais de Scolarité ({terminology.tuition})
                            </td>
                            <td className="py-3 px-4 text-center font-mono">
                              <span className="font-bold text-slate-900 block">{details.plannedNative}</span>
                              {details.plannedEquiv && <span className="text-[9px] text-slate-400 block">{details.plannedEquiv}</span>}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">
                              {details.paidNative}
                            </td>
                            <td className="py-3 px-4 text-right font-mono">
                              <span className={`font-black ${details.isPaid ? 'text-emerald-600' : 'text-rose-600'} block`}>
                                {details.remainingNative}
                              </span>
                              {!details.isPaid && details.remainingEquiv && (
                                <span className="text-[9px] text-slate-400 block">{details.remainingEquiv}</span>
                              )}
                            </td>
                          </tr>
                        );
                      })()}

                      {/* 3. Frais Divers Obligatoires */}
                      {(printPreview.miscFee > 0 || printPreview.miscPaid > 0) && (() => {
                        const details = getFeeRowDetails(
                          printPreview.miscNativeHTG || 0,
                          printPreview.miscNativeUSD || 0,
                          printPreview.miscPaid || 0,
                          printPreview.exchangeRate || 132.50
                        );
                        return (
                          <tr>
                            <td className="py-3 px-4 font-bold text-slate-800">
                              Frais Divers Obligatoires
                            </td>
                            <td className="py-3 px-4 text-center font-mono">
                              <span className="font-bold text-slate-900 block">{details.plannedNative}</span>
                              {details.plannedEquiv && <span className="text-[9px] text-slate-400 block">{details.plannedEquiv}</span>}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">
                              {details.paidNative}
                            </td>
                            <td className="py-3 px-4 text-right font-mono">
                              <span className={`font-black ${details.isPaid ? 'text-emerald-600' : 'text-rose-600'} block`}>
                                {details.remainingNative}
                              </span>
                              {!details.isPaid && details.remainingEquiv && (
                                <span className="text-[9px] text-slate-400 block">{details.remainingEquiv}</span>
                              )}
                            </td>
                          </tr>
                        );
                      })()}

                      {/* 4. Campagnes Ad-hoc */}
                      {(printPreview.campaignsFee > 0 || printPreview.campaignsPaid > 0) && (() => {
                        const details = getFeeRowDetails(
                          printPreview.campaignsNativeHTG || 0,
                          printPreview.campaignsNativeUSD || 0,
                          printPreview.campaignsPaid || 0,
                          printPreview.exchangeRate || 132.50
                        );
                        return (
                          <tr>
                            <td className="py-3 px-4 font-bold text-slate-800">
                              Frais d'Événements & Campagnes Spéciales
                            </td>
                            <td className="py-3 px-4 text-center font-mono">
                              <span className="font-bold text-slate-900 block">{details.plannedNative}</span>
                              {details.plannedEquiv && <span className="text-[9px] text-slate-400 block">{details.plannedEquiv}</span>}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">
                              {details.paidNative}
                            </td>
                            <td className="py-3 px-4 text-right font-mono">
                              <span className={`font-black ${details.isPaid ? 'text-emerald-600' : 'text-rose-600'} block`}>
                                {details.remainingNative}
                              </span>
                              {!details.isPaid && details.remainingEquiv && (
                                <span className="text-[9px] text-slate-400 block">{details.remainingEquiv}</span>
                              )}
                            </td>
                          </tr>
                        );
                      })()}

                      {/* 5. Adjustments & Bourses */}
                      {printPreview.tuitionAddition > 0 && (
                        <tr>
                          <td className="py-3 px-4 font-bold text-slate-800">Ajustements Complémentaires</td>
                          <td className="py-3 px-4 text-center font-mono font-bold text-indigo-600">+{printPreview.tuitionAddition.toLocaleString()} HTG</td>
                          <td className="py-3 px-4 text-right font-mono text-slate-400">-</td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-indigo-600">+{printPreview.tuitionAddition.toLocaleString()} HTG</td>
                        </tr>
                      )}
                      {printPreview.totalDiscount > 0 && (
                        <tr className="bg-rose-50/40">
                          <td className="py-3 px-4 font-bold italic text-rose-700">Réductions & Bourses Accordées</td>
                          <td className="py-3 px-4 text-center font-mono font-bold text-rose-700">-{printPreview.totalDiscount.toLocaleString()} HTG</td>
                          <td className="py-3 px-4 text-right font-mono text-slate-400">-</td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-rose-700">-{printPreview.totalDiscount.toLocaleString()} HTG</td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-900 text-white">
                        <td colSpan={2} className="py-3.5 px-4 text-xs font-black uppercase tracking-[0.15em]">Bilan Financier Global Session</td>
                        <td className="py-3.5 px-4 text-right font-mono text-xs font-bold text-emerald-400">
                          +{printPreview.paid.toLocaleString()} G
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-sm font-black tracking-tight text-white">
                          {(printPreview.totalDue - printPreview.paid).toLocaleString()} HTG
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Payments History */}
                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-4">
                    <History size={14} className="text-emerald-600" />
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Historique des Versements Effectués</p>
                  </div>
                  <div className="rounded-2xl border border-slate-100 overflow-x-auto text-xs">
                    <table className="w-full min-w-[620px] border-collapse">
                      <thead>
                        <tr className="bg-slate-50/50">
                          <th className="py-2.5 px-3 text-left text-[9px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Date</th>
                          <th className="py-2.5 px-3 text-left text-[9px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Référence</th>
                          <th className="py-2.5 px-3 text-left text-[9px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Nature</th>
                          <th className="py-2.5 px-3 text-right text-[9px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Montant Payé</th>
                          <th className="py-2.5 px-3 text-center text-[9px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Taux Appliqué</th>
                          <th className="py-2.5 px-3 text-right text-[9px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Total (HTG)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {studentHistory.filter(p => p.status !== 'ANNULE' && !p.payment_method?.includes('REJETÉ') && isPaymentInDateRange(p, startDate, endDate)).map((p) => {
                          const isUSD = p.currency === 'USD';
                          const paidAmount = Number(p.amount || 0);
                          const appliedRate = Number(p.exchange_rate_applied || schoolDetails?.exchange_rate || 140);
                          const baseHTG = Number(p.amount_htg_equivalent || (isUSD ? paidAmount * appliedRate : paidAmount));

                          return (
                            <tr key={p.id} className="hover:bg-slate-50/30 transition-colors">
                              <td className="py-2 px-3 font-bold text-slate-600 whitespace-nowrap">{new Date(p.created_at).toLocaleDateString()}</td>
                              <td className="py-2 px-3 font-mono text-slate-500 whitespace-nowrap">RCP-{p.id.substring(0,8).toUpperCase()}</td>
                              <td className="py-2 px-3 font-bold text-slate-700 whitespace-nowrap">
                                {p.campaign?.name 
                                  ? `Campagne: ${p.campaign.name}` 
                                  : p.ad_hoc_campaign_id 
                                  ? 'Frais de Campagne' 
                                  : (p.fee_type === 'SCOLARITE' || (!p.fee_type && (!p.nature || p.nature === 'SCOLARITE' || p.nature === 'Scolarité'))) 
                                  ? 'Scolarité' 
                                  : ((p.fee_type === 'INSCRIPTION' || p.nature === 'INSCRIPTION' || p.nature === "Frais d'inscription") 
                                  ? 'Inscription' 
                                  : (p.nature || p.type || p.fee_type || 'Frais Divers'))}
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-slate-800 whitespace-nowrap">
                                {isUSD ? `$${paidAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} USD` : `${paidAmount.toLocaleString()} HTG`}
                              </td>
                              <td className="py-2 px-3 text-center font-mono text-[10px] text-slate-600 whitespace-nowrap">
                                {isUSD ? `1 USD = ${appliedRate} HTG` : '1:1 (HTG)'}
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-black text-slate-900 whitespace-nowrap">
                                {baseHTG.toLocaleString()} HTG
                              </td>
                            </tr>
                          );
                        })}
                        {studentHistory.length === 0 && (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-xs italic text-slate-400">Aucun versement enregistré pour cette période.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Final Balance Card & Signature */}
                <div className="grid grid-cols-2 gap-8 pt-8 border-t-2 border-slate-900">
                  <div className="space-y-4">
                    <div className="p-5 rounded-2xl bg-slate-900 shadow-md shadow-slate-200 text-white">
                      <p className="text-[9px] font-black text-white/50 uppercase tracking-[0.2em] mb-1">Solde Restant Dû</p>
                      <div className="flex items-baseline gap-2">
                        <p className={`text-2xl font-black font-mono tracking-tighter ${printPreview.totalDue - printPreview.paid > 0 ? 'text-white' : 'text-emerald-400'}`}>
                          {(printPreview.totalDue - printPreview.paid).toLocaleString()}
                        </p>
                        <span className="text-xs font-bold text-white/40 uppercase tracking-widest">HTG</span>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                        <Info size={12} className="text-indigo-500" /> Notes
                      </p>
                      <ul className="text-[9px] text-slate-500 space-y-0.5 list-disc pl-3 font-medium">
                        <li>Veuillez conserver ce relevé pour vos archives personnelles.</li>
                        <li>En cas de contestation, contactez le service comptabilité sous 48h.</li>
                      </ul>
                    </div>
                  </div>

                  <div className="flex flex-col justify-end items-end text-right pr-4">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-12">Signature & Sceau de la Direction</p>
                    <div className="w-48 border-b-2 border-slate-900 mb-1" />
                    <p className="text-xs font-black text-slate-900 uppercase tracking-tighter">{schoolDetails?.director_name || 'La Direction'}</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Document Vérifié par Système Audit</p>
                  </div>
                </div>

                <div className="mt-8 pt-4 border-t border-slate-100 text-center">
                  <p className="text-[8px] font-bold text-slate-300 uppercase tracking-[0.3em]">
                    Ce document est généré électroniquement par EduNova Pro et est valide sans signature manuscrite.
                  </p>
                </div>
              </div>
        )}
      </PrintPreviewModal>

      {/* STYLES D'IMPRESSION */}
      <style>{`
        @media print {
          @page { size: a4; margin: 0; }
          body * { visibility: hidden; }
          .print\\:hidden { display: none !important; }
          .print\\:shadow-none { box-shadow: none !important; }
          .print\\:m-0 { margin: 0 !important; }
          .print\\:w-full { width: 100% !important; }
          .print\\:border-0 { border: 0 !important; }
          
          #releve-compte-print, #releve-compte-print * {
            visibility: visible !important;
          }
          #releve-compte-print {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 15mm !important;
            border: none !important;
            box-shadow: none !important;
            background: white !important;
          }
          
          .bg-slate-900 { background-color: #0f172a !important; color: white !important; }
          .text-white { color: white !important; }
          .bg-slate-50 { background-color: #f8fafc !important; }
          .border-slate-100 { border-color: #f1f5f9 !important; }
        }
      `}</style>
    </div>
  );
};

export default AccountStatementView;
