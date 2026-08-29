import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  DollarSign, 
  Printer, 
  User, 
  Receipt,
  History,
  ChevronRight,
  Target,
  ChevronDown,
  CalendarDays,
  BadgeCheck,
  FileSearch,
  ShieldCheck,
  Coins,
  Loader2,
  X,
  RefreshCcw,
  Info,
  FileDown,
  MessageSquare,
  Send,
  TrendingUp,
  RotateCcw,
  Sparkles,
  Wallet,
  Trash2,
  ArrowRightLeft
} from 'lucide-react';
import { toast } from 'sonner';
import { formatStudentName } from '../utils/formatters';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { useSecurity } from './SecurityGuard';
import { addSecurityWatermark } from '../utils/pdfWatermark';
import { fixOklchForCanvas } from '../utils/pdfFix';
import { supabase } from '../supabase';
import { useSchool } from '../contexts/SchoolContext';
import { UserProfile } from '../types';
import { computeFeeCategoryBalance, getFormattedFeeRowDetails } from '../utils/financeCalculations';
import { AcademicSessionPill } from './AcademicSessionPill';

const getFeeRowDetails = (
  nativeHTG: number,
  nativeUSD: number,
  paidHTGEquiv: number,
  exchangeRate: number,
  discountHTG: number = 0,
  paymentsList?: any[]
) => {
  if (paymentsList && paymentsList.length > 0) {
    return getFormattedFeeRowDetails(nativeHTG, nativeUSD, paymentsList, exchangeRate, discountHTG);
  }

  const rate = exchangeRate || 135;
  let isSettled = false;
  let paidUSD = paidHTGEquiv / rate;

  if (nativeUSD > 0 && nativeHTG === 0) {
    const impliedRate = paidHTGEquiv / nativeUSD;
    if (impliedRate >= 50 && (impliedRate <= 300 || paidHTGEquiv >= (nativeUSD * rate - 100))) {
      if (paidUSD >= nativeUSD - 0.05 || impliedRate >= 100) {
        isSettled = true;
        paidUSD = nativeUSD;
      }
    }
  }

  const rawTotalHTGEquiv = nativeHTG + (nativeUSD * rate);
  const totalHTGEquiv = Math.max(0, rawTotalHTGEquiv - discountHTG);

  let plannedNative = '';
  let plannedEquiv = '';

  if (discountHTG > 0) {
    plannedNative = `${Math.round(totalHTGEquiv).toLocaleString()} G`;
    plannedEquiv = `(Base: ${Math.round(rawTotalHTGEquiv).toLocaleString()} G - Remise: ${discountHTG.toLocaleString()} G)`;
  } else if (nativeUSD > 0 && nativeHTG > 0) {
    plannedNative = `${nativeHTG.toLocaleString()} G + $${nativeUSD.toLocaleString()} USD`;
    plannedEquiv = `≈ ${Math.round(totalHTGEquiv).toLocaleString()} HTG`;
  } else if (nativeUSD > 0) {
    plannedNative = `$${nativeUSD.toLocaleString()} USD`;
    plannedEquiv = `≈ ${Math.round(totalHTGEquiv).toLocaleString()} HTG`;
  } else {
    plannedNative = `${nativeHTG.toLocaleString()} G`;
    plannedEquiv = ''; // Pas de conversion USD pour les frais planifiés en Gourdes
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
    isPaid
  };
};

const StudentPaymentTracking: React.FC<{ user: UserProfile }> = ({ user }) => {
  const { ipAddress } = useSecurity();
  const navigate = useNavigate();
  const { terminology, currentCampusId } = useSchool();
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedYearId, setSelectedYearId] = useState('');
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [studentHistory, setStudentHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const fetchYears = async () => {
      if (!user?.school_id) return;
      const { data, error } = await supabase
        .from('academic_years')
        .select('*')
        .eq('school_id', user.school_id)
        .order('label', { ascending: false });
      if (error) console.error("Erreur chargement années académiques:", error);
      if (data) {
        setAcademicYears(data);
        const active = data.find(y => y.is_active || y.status === 'ACTIVE') || data[0];
        setSelectedYearId(active?.id || '');
      }
    };
    fetchYears();
  }, [user?.school_id]);

  // Sécurité Multi-Tenant & Multi-Campus : réinitialiser l'élève sélectionné si on change de Campus
  useEffect(() => {
    if (selectedStudent && currentCampusId && selectedStudent.campus_id !== currentCampusId) {
      setSelectedStudent(null);
    }
  }, [currentCampusId, selectedStudent]);

  useEffect(() => {
    const search = async () => {
      if (searchTerm.length < 2 || !user?.school_id) {
        setSearchResults([]);
        return;
      }
      setIsSearching(true);
      const { data, error } = await supabase.rpc('search_students_accent_insensitive', {
        p_school_id: user.school_id,
        p_query: searchTerm,
        p_limit: 15,
        p_campus_id: user.campus_id || currentCampusId || null
      });

      if (error) {
        console.error("Search error:", error);
        setIsSearching(false);
        return;
      }

      let searchResults = data || [];
      if (currentCampusId) {
        searchResults = searchResults.filter(s => s.campus_id === currentCampusId);
      }
      const mappedData = searchResults.map((s: any) => {
        const formatted = formatStudentName(s.last_name, s.first_name);
        return {
          ...s,
          last_name: formatted.lastName,
          first_name: formatted.firstName,
          fullName: formatted.fullName,
          class: s.class_name ? { name: s.class_name } : null
        };
      });

      setSearchResults(mappedData || []);
      setIsSearching(false);
    };
    const timer = setTimeout(search, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, user?.school_id, user?.campus_id, currentCampusId]);

  const [schoolDetails, setSchoolDetails] = useState<any>(null);
  const [printPreview, setPrintPreview] = useState<boolean>(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderType, setReminderType] = useState<'sms' | 'email'>('sms');
  const [reminderMessage, setReminderMessage] = useState('');
  const [isSendingReminder, setIsSendingReminder] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const fetchSchool = async () => {
      if (!user?.school_id) return;
      const { data } = await supabase.from('schools').select('*').eq('id', user.school_id).single();
      if (data) setSchoolDetails(data);
    };
    fetchSchool();
  }, [user?.school_id]);

  const loadDetails = useCallback(async (student: any, targetYearIdParam?: string) => {
    const targetYear = targetYearIdParam || selectedYearId;
    if (!targetYear) return;
    setLoading(true);
    try {
      // 1. Essayer de trouver la classe et les inscriptions pour l'année cible et les autres années
      let enrollment = null;
      let otherEnrollments: any[] = [];
      try {
        const { data: allEnrollmentsData } = await supabase
          .from('enrollments')
          .select('class_id, academic_year_id, tuition_discount, tuition_addition, class:classes(id, name), academic_year:academic_years(id, label, status)')
          .eq('school_id', user.school_id)
          .eq('student_id', student.id);
        
        if (allEnrollmentsData && allEnrollmentsData.length > 0) {
          const foundInTarget = allEnrollmentsData.find((e: any) => e.academic_year_id === targetYear);
          if (foundInTarget) {
            enrollment = foundInTarget;
            otherEnrollments = allEnrollmentsData.filter((e: any) => e.academic_year_id !== targetYear);
          } else {
            enrollment = null;
            otherEnrollments = allEnrollmentsData;
          }
        }
      } catch (e) {
        console.error("Erreur chargement enrollment:", e);
      }

      const isEnrolled = !!enrollment;
      const effectiveClassId = isEnrolled ? (enrollment?.class_id || student.class_id) : null;
      const effectiveClassName = isEnrolled 
        ? (enrollment?.class?.name || student.class?.name || 'Registre Académique') 
        : 'Non inscrit';

      // Fetch exchange rate
      const { data: rateRes } = await supabase
        .from('exchange_rates')
        .select('*')
        .eq('school_id', user.school_id)
        .order('effective_date', { ascending: false })
        .limit(1);
      
      const currentExchangeRate = rateRes?.[0]?.rate_usd_to_htg || rateRes?.[0]?.rate || 132.50;

      let plan = null;
      if (effectiveClassId) {
        const { data: planData, error: planError } = await supabase
          .from('fee_plans')
          .select('*')
          .eq('school_id', user.school_id)
          .eq('class_id', effectiveClassId)
          .eq('academic_year_id', targetYear)
          .maybeSingle();
        
        if (planError) {
          console.error("Erreur chargement fee_plans:", planError);
        }
        plan = planData;
      }

      const { data: allStudentPayments, error: paymentsError } = await supabase
        .from('payments')
        .select('*, campaign:ad_hoc_campaigns(id, name)')
        .eq('school_id', user.school_id)
        .eq('student_id', student.id)
        .order('created_at', { ascending: false });
      
      if (paymentsError) {
        console.error("Erreur chargement payments:", paymentsError);
      }

      // Vérifier si l'étudiant a des inscriptions antérieures (Réinscription)
      const { data: prevEnrollments } = await supabase
        .from('enrollments')
        .select('id, academic_year_id')
        .eq('school_id', user.school_id)
        .eq('student_id', student.id)
        .neq('academic_year_id', targetYear)
        .limit(5);
      
      const hasPreviousEnrollment = (prevEnrollments?.length || 0) > 0;

      // Filtrer les paiements pour cette session académique
      const payments = allStudentPayments?.filter((p: any) => {
        if (p.academic_year_id === targetYear) return true;
        if (!p.academic_year_id) {
          return !hasPreviousEnrollment;
        }
        const isEnrolledInPaymentYear = prevEnrollments?.some((e: any) => e.academic_year_id === p.academic_year_id);
        if (!isEnrolledInPaymentYear && isEnrolled) {
          return true;
        }
        return false;
      }) || [];

      // Fetch student's assigned ad-hoc campaigns
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

      const activeCampaigns = isEnrolled ? campaignData
        .map((fee: any) => {
          if (!fee.campaign) return null;
          return {
            ...fee.campaign,
            custom_amount: fee.custom_amount,
            adjustment_reason: fee.adjustment_reason,
            fee_id: fee.id
          };
        })
        .filter((c: any) => c !== null && c.academic_year_id === targetYear) : [];

      const campaignsExpected = activeCampaigns.reduce((sum, camp) => {
        const required = camp.custom_amount !== null && camp.custom_amount !== undefined ? Number(camp.custom_amount) : Number(camp.amount);
        return sum + required;
      }, 0);

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
          desc.includes('réinscri') ||
          Number(p.amount) === 3375 ||
          Number(p.amount_htg_equivalent) === 3375
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
        !p.payment_method?.includes('EN ATTENTE') && 
        !p.payment_method?.includes('REJETÉ') &&
        p.status !== 'ANNULE'
      ) || [];

      const admissionPayments = validPayments.filter(p => !isCampaignPayment(p) && isAdmissionPayment(p));
      const campaignPayments = validPayments.filter(p => isCampaignPayment(p));
      const miscPayments = validPayments.filter(p => !isCampaignPayment(p) && !isAdmissionPayment(p) && isMiscPayment(p));
      const tuitionPayments = validPayments.filter(p => !isCampaignPayment(p) && !isAdmissionPayment(p) && !isMiscPayment(p));

      const admissionPaid = admissionPayments.reduce((sum, p) => sum + Number(p.currency === 'USD' ? p.amount * currentExchangeRate : (p.amount_htg_equivalent || p.amount || 0)), 0);
      const campaignsPaid = campaignPayments.reduce((sum, p) => sum + Number(p.currency === 'USD' ? p.amount * currentExchangeRate : (p.amount_htg_equivalent || p.amount || 0)), 0);
      const rawMiscPaid = miscPayments.reduce((sum, p) => sum + Number(p.currency === 'USD' ? p.amount * currentExchangeRate : (p.amount_htg_equivalent || p.amount || 0)), 0);
      const rawTuitionPaid = tuitionPayments.reduce((sum, p) => sum + Number(p.currency === 'USD' ? p.amount * currentExchangeRate : (p.amount_htg_equivalent || p.amount || 0)), 0);
      
      const admissionHTG = isEnrolled && plan 
        ? (hasPreviousEnrollment 
            ? Number(plan.reenrollment_fee || 0) 
            : Number(plan.inscription_fee || 0))
        : 0;

      const admissionUSD = isEnrolled && plan 
        ? (hasPreviousEnrollment 
            ? Number(plan.reenrollment_fee_usd || 0) 
            : Number(plan.inscription_fee_usd || 0))
        : 0;

      const admissionBreakdown = computeFeeCategoryBalance(
        admissionHTG,
        admissionUSD,
        admissionPayments,
        currentExchangeRate
      );
      const admissionExpected = admissionBreakdown.isPaid ? admissionPaid : admissionBreakdown.effectiveDueHTG;

      const tuitionHTG = isEnrolled && plan ? Number(plan.tuition_fee || 0) : 0;
      const tuitionUSD = isEnrolled && plan ? Number(plan.tuition_fee_usd || 0) : 0;
      const tuitionFee = tuitionHTG + (tuitionUSD * currentExchangeRate);

      const miscHTG = isEnrolled && plan && plan.is_misc_mandatory ? Number(plan.misc_fee_htg || 0) : 0;
      const miscUSD = isEnrolled && plan && plan.is_misc_mandatory ? Number(plan.misc_fee_usd || 0) : 0;
      
      const miscBreakdown = computeFeeCategoryBalance(
        miscHTG,
        miscUSD,
        miscPayments,
        currentExchangeRate
      );
      const planMiscFee = miscBreakdown.isPaid ? rawMiscPaid : miscBreakdown.effectiveDueHTG;

      const neededMisc = Math.max(0, planMiscFee - rawMiscPaid);
      const miscCoverFromTuition = (plan?.is_misc_mandatory && neededMisc > 0)
        ? Math.min(neededMisc, Math.max(0, rawTuitionPaid - tuitionFee))
        : 0;
      const miscPaid = rawMiscPaid + miscCoverFromTuition;
      const tuitionPaid = rawTuitionPaid - miscCoverFromTuition;
      const totalPaid = admissionPaid + tuitionPaid + campaignsPaid + miscPaid;

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
      
      const tuitionAddition = isEnrolled ? Number(enrollment?.tuition_addition || 0) : 0;
      const tuitionDiscount = isEnrolled ? Number(enrollment?.tuition_discount || 0) : 0;
      const studentDiscount = isEnrolled ? Number(student.discount_amount || 0) : 0;
      const totalDiscount = tuitionDiscount + studentDiscount;

      const baseFee = tuitionFee;
      const applicableFee = isEnrolled && student.is_foreign && plan?.foreign_tuition_fee ? plan.foreign_tuition_fee : baseFee;
      
      const rawTuitionExpected = isEnrolled ? applicableFee + tuitionAddition : 0;
      
      // Distinction entre Option Standard (Scolarité Pure) et Option Complète / Sociale (Scolarité + Frais Divers)
      const isCompleteScholarship = Boolean(
        student.discount_label && (
          student.discount_label.toLowerCase().includes('complète') ||
          student.discount_label.toLowerCase().includes('sociale') ||
          student.discount_label.toLowerCase().includes('frais divers')
        )
      );

      let tuitionDiscountApplied = 0;
      let miscDiscountApplied = 0;

      if (isCompleteScholarship) {
        tuitionDiscountApplied = Math.min(rawTuitionExpected, totalDiscount);
        const remainingDiscount = Math.max(0, totalDiscount - tuitionDiscountApplied);
        miscDiscountApplied = Math.min(planMiscFee, remainingDiscount);
      } else {
        tuitionDiscountApplied = Math.min(rawTuitionExpected, totalDiscount);
        miscDiscountApplied = 0;
      }

      const tuitionExpected = Math.max(0, rawTuitionExpected - tuitionDiscountApplied);
      const adjPlanMiscFee = Math.max(0, planMiscFee - miscDiscountApplied);
      const adjAdmissionExpected = admissionExpected;
      const adjCampaignsExpected = campaignsExpected;

      const admissionBalance = Math.max(0, adjAdmissionExpected - admissionPaid);
      const tuitionBalance = Math.max(0, tuitionExpected - tuitionPaid);
      const campaignsBalance = Math.max(0, adjCampaignsExpected - campaignsPaid);
      const miscBalance = Math.max(0, adjPlanMiscFee - miscPaid);

      const totalExpected = adjAdmissionExpected + tuitionExpected + adjCampaignsExpected + adjPlanMiscFee;
      const totalBalance = Math.max(0, totalExpected - totalPaid);

      // Fetch the true global debt across all active and past years (Portefeuille)
      let globalDebt = 0;
      const yearStatus = academicYears.find(y => y.id === targetYear)?.status;

      if (yearStatus !== 'FUTURE') {
        try {
          // Calculate true global debt in the frontend for absolute multi-tenant safety and accuracy
          const { data: allEnrollments } = await supabase
            .from('enrollments')
            .select('academic_year_id, class_id, tuition_discount, tuition_addition, academic_year:academic_years(id, status, label)')
            .eq('school_id', user.school_id)
            .eq('student_id', student.id);

          const { data: allPayments } = await supabase
            .from('payments')
            .select('amount, currency, amount_htg_equivalent, fee_type, academic_year_id')
            .eq('school_id', user.school_id)
            .eq('student_id', student.id);

          const { data: allAdHocFees } = await supabase
            .from('student_ad_hoc_fees')
            .select('custom_amount, campaign:ad_hoc_campaigns(id, amount, academic_year_id)')
            .eq('school_id', user.school_id)
            .eq('student_id', student.id);

          const enrolls = allEnrollments || [];
          const classIds = enrolls.map((e: any) => e.class_id).filter(Boolean);
          const yearIds = enrolls.map((e: any) => e.academic_year_id).filter(Boolean);

          let allFeePlans: any[] = [];
          if (classIds.length > 0 && yearIds.length > 0) {
            const { data: plans } = await supabase
              .from('fee_plans')
              .select('*')
              .eq('school_id', user.school_id)
              .in('class_id', classIds)
              .in('academic_year_id', yearIds);
            allFeePlans = plans || [];
          }

          let calculatedGlobalDebt = 0;

          for (const enroll of enrolls) {
            const enrollYearStatus = Array.isArray(enroll.academic_year) 
              ? (enroll.academic_year as any)[0]?.status 
              : (enroll.academic_year as any)?.status;
            // Only include PAST and ACTIVE years in global debt (exclude FUTURE / PLANIFICATION years)
            if (enrollYearStatus === 'PAST' || enrollYearStatus === 'ACTIVE') {
              const yrId = enroll.academic_year_id;
              const clsId = enroll.class_id;

              // Find fee plan
              const planForYr = allFeePlans.find((p: any) => p.class_id === clsId && p.academic_year_id === yrId);
              if (!planForYr) continue;

              // 1. Admission / Inscription Fee
              const enrollYearPayments = (allPayments || []).filter((p: any) => p.academic_year_id === yrId);
              const enrollAdmissionPayments = enrollYearPayments.filter((p: any) => p.fee_type === 'INSCRIPTION');
              const admissionPaid = enrollAdmissionPayments
                .reduce((sum, p) => sum + Number(p.currency === 'USD' ? p.amount * currentExchangeRate : (p.amount_htg_equivalent || p.amount || 0)), 0);

              // Check if student had previous enrollments before this year
              const { data: prevEn } = await supabase
                .from('enrollments')
                .select('id')
                .eq('school_id', user.school_id)
                .eq('student_id', student.id)
                .neq('academic_year_id', yrId)
                .limit(1);
              const isReenrollment = (prevEn?.length || 0) > 0;

              const planAdmHTG = isReenrollment ? Number(planForYr.reenrollment_fee || 0) : Number(planForYr.inscription_fee || 0);
              const planAdmUSD = isReenrollment ? Number(planForYr.reenrollment_fee_usd || 0) : Number(planForYr.inscription_fee_usd || 0);
              const yrAdmissionBreakdown = computeFeeCategoryBalance(
                planAdmHTG,
                planAdmUSD,
                enrollAdmissionPayments,
                currentExchangeRate
              );
              const admissionExpected = yrAdmissionBreakdown.isPaid ? admissionPaid : yrAdmissionBreakdown.effectiveDueHTG;

              const admissionBalance = Math.max(0, admissionExpected - admissionPaid);

              // 2. Tuition Fee & 3. Mandatory Misc Fee
              const enrollTuitionPayments = enrollYearPayments.filter((p: any) => p.fee_type === 'SCOLARITE' || !p.fee_type);
              const enrollMiscPayments = enrollYearPayments.filter((p: any) => p.fee_type === 'DIVERS');

              const rawTuitionPaid = enrollTuitionPayments
                .reduce((sum, p) => sum + Number(p.currency === 'USD' ? p.amount * currentExchangeRate : (p.amount_htg_equivalent || p.amount || 0)), 0);

              const rawMiscPaid = enrollMiscPayments
                .reduce((sum, p) => sum + Number(p.currency === 'USD' ? p.amount * currentExchangeRate : (p.amount_htg_equivalent || p.amount || 0)), 0);

              const planMiscHTG = planForYr.is_misc_mandatory ? Number(planForYr.misc_fee_htg || 0) : 0;
              const planMiscUSD = planForYr.is_misc_mandatory ? Number(planForYr.misc_fee_usd || 0) : 0;
              const yrMiscBreakdown = computeFeeCategoryBalance(
                planMiscHTG,
                planMiscUSD,
                enrollMiscPayments,
                currentExchangeRate
              );
              const planMiscFee = yrMiscBreakdown.isPaid ? rawMiscPaid : yrMiscBreakdown.effectiveDueHTG;

              const neededMisc = Math.max(0, planMiscFee - rawMiscPaid);
              const miscCoverFromTuition = Math.min(neededMisc, rawTuitionPaid);
              const miscPaid = rawMiscPaid + miscCoverFromTuition;
              const tuitionPaid = rawTuitionPaid - miscCoverFromTuition;

              const baseFee = Number(planForYr.tuition_fee || 0) + Number(planForYr.tuition_fee_usd || 0) * currentExchangeRate;
              const rawTuitionExpected = (student.is_foreign && planForYr.foreign_tuition_fee ? planForYr.foreign_tuition_fee : baseFee) + Number(enroll.tuition_addition || 0);
              
              const campaignsPaid = enrollYearPayments
                .filter((p: any) => p.fee_type === 'AD_HOC')
                .reduce((sum, p) => sum + Number(p.currency === 'USD' ? p.amount * currentExchangeRate : (p.amount_htg_equivalent || p.amount || 0)), 0);

              const campaignsExpected = (allAdHocFees || [])
                .filter((fee: any) => fee.campaign && fee.campaign.academic_year_id === yrId)
                .reduce((sum: number, fee: any) => {
                  const required = fee.custom_amount !== null && fee.custom_amount !== undefined ? Number(fee.custom_amount) : Number(fee.campaign.amount);
                  const rate = fee.campaign?.currency === 'USD' ? currentExchangeRate : 1;
                  return sum + (required * rate);
                }, 0);

              // Méthode B : Bourse ciblée strictement sur la scolarité
              const totalYearDiscount = Number(enroll.tuition_discount || 0) + Number(student.discount_amount || 0);
              const tuitionDiscountApplied = Math.min(rawTuitionExpected, totalYearDiscount);
              const tuitionExpected = Math.max(0, rawTuitionExpected - tuitionDiscountApplied);

              const tuitionBalance = Math.max(0, tuitionExpected - tuitionPaid);
              const admissionBalanceWithDiscount = Math.max(0, admissionExpected - admissionPaid);
              const miscBalance = Math.max(0, planMiscFee - miscPaid);
              const campaignsBalance = Math.max(0, campaignsExpected - campaignsPaid);

              const yearBalance = admissionBalanceWithDiscount + tuitionBalance + miscBalance + campaignsBalance;
              calculatedGlobalDebt += yearBalance;
            }
          }

          globalDebt = calculatedGlobalDebt;
        } catch (err) {
          console.warn("Failed to calculate frontend global debt:", err);
          globalDebt = totalBalance;
        }
      } else {
        // For FUTURE status years, global debt is reset to 0 (Compte Soldé) as requested by the user
        globalDebt = 0;
      }

      // Ensure global debt is at least the current selected year's balance to remain consistent (unless it's a FUTURE year)
      if (yearStatus !== 'FUTURE') {
        globalDebt = Math.max(globalDebt, totalBalance);
      }

      setSelectedStudent({
        ...student,
        isNotEnrolledInTargetYear: !isEnrolled,
        isEnrolled,
        otherEnrollments,
        inscriptionFee: adjAdmissionExpected,
        tuitionFee: tuitionExpected,
        rawTuitionExpected,
        tuitionDiscountApplied,
        miscFee: adjPlanMiscFee,
        campaignsFee: adjCampaignsExpected,
        admissionNativeHTG: admissionHTG,
        admissionNativeUSD: admissionUSD,
        tuitionNativeHTG: tuitionHTG,
        tuitionNativeUSD: tuitionUSD,
        miscNativeHTG: miscHTG,
        miscNativeUSD: miscUSD,
        campaignsNativeHTG,
        campaignsNativeUSD,
        exchangeRate: currentExchangeRate,
        tuitionAddition,
        tuitionDiscount,
        studentDiscount,
        totalDiscount,
        totalDue: totalExpected,
        globalDebt,
        paid: totalPaid,
        scolaritePaid: tuitionPaid,
        inscriptionPaid: admissionPaid,
        miscPaid: miscPaid,
        miscBalance: miscBalance,
        campaignsPaid: campaignsPaid,
        campaignsBalance: campaignsBalance,
        admissionExpected: adjAdmissionExpected,
        admissionPaid,
        admissionBalance,
        tuitionExpected,
        tuitionPaid,
        tuitionBalance,
        admissionPayments,
        tuitionPayments,
        miscPayments,
        campaignPayments,
        hasCampaigns: activeCampaigns.length > 0,
        classe: effectiveClassName,
        academicYear: academicYears.find(y => y.id === targetYear)?.label || enrollment?.academic_year?.label || 'Session en cours',
        academicYearId: targetYear,
        plan: plan
      });
      setStudentHistory(payments || []);
    } finally {
      setLoading(false);
    }
  }, [selectedYearId, academicYears, user.school_id]);

  const handleSelectStudent = useCallback(async (student: any) => {
    setSearchTerm('');
    try {
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('academic_year_id, class:classes(id, name), academic_year:academic_years(id, label, status)')
        .eq('school_id', user.school_id)
        .eq('student_id', student.id);

      let targetYear = selectedYearId;
      if (enrollments && enrollments.length > 0) {
        const isEnrolledInCurrent = enrollments.some((e: any) => e.academic_year_id === selectedYearId);
        if (!isEnrolledInCurrent) {
          // If not enrolled in the current selected year, auto-switch to their enrolled year (priority to FUTURE/ACTIVE session)
          const preferred = enrollments.find((e: any) => e.academic_year?.status === 'FUTURE' || e.academic_year?.status === 'ACTIVE') || enrollments[0];
          if (preferred?.academic_year_id) {
            targetYear = preferred.academic_year_id;
            setSelectedYearId(preferred.academic_year_id);
          }
        }
      }
      loadDetails(student, targetYear);
    } catch (e) {
      loadDetails(student, selectedYearId);
    }
  }, [selectedYearId, user.school_id, loadDetails]);

  useEffect(() => {
    if (location.state?.studentId) {
      const initialYear = location.state?.academicYearId || selectedYearId;
      if (location.state?.academicYearId && location.state.academicYearId !== selectedYearId) {
        setSelectedYearId(location.state.academicYearId);
      }
      const fetchStudent = async () => {
        const { data } = await supabase
          .from('students')
          .select('*, class:classes(name)')
          .eq('id', location.state.studentId)
          .eq('school_id', user.school_id)
          .single();
        if (data) {
          if (!location.state?.academicYearId) {
            handleSelectStudent(data);
          } else {
            loadDetails(data, initialYear);
          }
        }
      };
      fetchStudent();
    }
  }, [location.state, handleSelectStudent, loadDetails, selectedYearId, user.school_id]);

  // Trigger details reload when the selected academic year changes for the current student
  useEffect(() => {
    if (selectedStudent && selectedYearId && selectedStudent.academicYearId !== selectedYearId) {
      loadDetails(selectedStudent, selectedYearId);
    }
  }, [selectedYearId, selectedStudent?.id, loadDetails]);

  const canCancelPayment = user?.is_super_admin || ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ADMIN', 'ACCOUNTANT', 'DIRECTOR', 'COMPTABLE', 'DIRECTEUR'].includes(user?.role || '');

  const handleCancelPayment = async (paymentId: string) => {
    if (!window.confirm("Êtes-vous sûr de vouloir annuler ce versement ? L'opération sera marquée comme ANNULÉE et le solde de l'élève sera automatiquement recalculé.")) return;
    try {
      const { error } = await supabase
        .from('payments')
        .update({
          status: 'ANNULE',
          cancelled_at: new Date().toISOString(),
          cancelled_by: user.id,
          cancel_reason: 'Annulation de versement en double'
        })
        .eq('id', paymentId);

      if (error) throw error;

      toast.success("Le versement a été annulé avec succès.");
      if (selectedStudent) {
        loadDetails(selectedStudent);
      }
    } catch (err: any) {
      toast.error("Erreur lors de l'annulation du versement : " + (err.message || err.toString()));
    }
  };

  // Real-time synchronization for selected student details and balances
  useEffect(() => {
    if (!user?.school_id || !selectedStudent?.id) return;

    const channelName = `student_tracking_${selectedStudent.id}`;
    const trackingSub = supabase.channel(channelName)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'payments', 
        filter: `student_id=eq.${selectedStudent.id}` 
      }, () => {
        loadDetails(selectedStudent);
      })
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'student_ad_hoc_fees', 
        filter: `student_id=eq.${selectedStudent.id}` 
      }, () => {
        loadDetails(selectedStudent);
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'enrollments',
        filter: `student_id=eq.${selectedStudent.id}`
      }, () => {
        loadDetails(selectedStudent);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(trackingSub);
    };
  }, [user?.school_id, selectedStudent?.id, loadDetails]);

  const balance = selectedStudent ? Math.max(0, selectedStudent.totalDue - selectedStudent.paid) : 0;
  const recoveryRate = selectedStudent ? Math.min(100, (selectedStudent.paid / selectedStudent.totalDue) * 100) : 0;

  const exportToPDF = async () => {
    if (!selectedStudent) return;
    setIsExporting(true);
    try {
      const element = document.getElementById('releve-compte-print');
      if (!element) return;

      // Set a fixed width for consistent A4 aspect ratio (approx 800px)
      const originalWidth = element.style.width;
      element.style.width = '800px';

      // Wait a bit for layout to settle
      await new Promise(resolve => setTimeout(resolve, 300));

      const canvas = await html2canvas(element, {
        scale: 2, // Scale 2 is usually enough and more stable
        useCORS: true,
        logging: true,
        backgroundColor: '#ffffff',
        windowWidth: 800,
        imageTimeout: 30000,
        onclone: (clonedDoc) => {
          fixOklchForCanvas(clonedDoc);
        }
      });

      // Restore original width
      element.style.width = originalWidth;

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      // Calculate dimensions to fit A4 with 10mm margins
      const margin = 10;
      const contentWidth = pdfWidth - (2 * margin);
      const imgProps = pdf.getImageProperties(imgData);
      const contentHeight = (imgProps.height * contentWidth) / imgProps.width;

      let heightLeft = contentHeight;
      let position = margin;

      // Add the first page
      pdf.addImage(imgData, 'PNG', margin, position, contentWidth, contentHeight);
      heightLeft -= (pdfHeight - (2 * margin));

      // Add subsequent pages if needed
      while (heightLeft > 0) {
        pdf.addPage();
        position = heightLeft - contentHeight + margin;
        pdf.addImage(imgData, 'PNG', margin, position, contentWidth, contentHeight);
        heightLeft -= (pdfHeight - (2 * margin));
      }

      addSecurityWatermark(pdf, { user, ipAddress });
      pdf.save(`Releve_Compte_${formatStudentName(selectedStudent.last_name, selectedStudent.first_name).fullName.replace(/\s+/g, '_')}.pdf`);
    } catch (error) {
      console.error("Erreur export PDF:", error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700 pb-24">
      <div className="p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col lg:flex-row items-center gap-6 bg-white">
        <div className="flex-shrink-0 space-y-1 text-center lg:text-left">
          <div className="flex items-center justify-center lg:justify-start gap-2 font-semibold text-xs text-blue-600">
            <FileSearch size={16} /> AUDIT ANALYTIQUE {terminology.student.toUpperCase()}
          </div>
          <h2 className="text-2xl font-semibold text-gray-900">Suivi du Dossier</h2>
        </div>

        <div className="flex-1 w-full flex flex-col md:flex-row items-center gap-4 relative">
          <div className="min-w-[240px] w-full md:w-auto">
            <AcademicSessionPill
              academicYears={academicYears}
              selectedYearId={selectedYearId}
              onSelectYear={(yearId) => setSelectedYearId(yearId)}
              variant="field"
              size="md"
              colorScheme="blue"
            />
          </div>

          {!selectedStudent ? (
            <div className="flex-1 relative group font-sans">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600 transition-colors" size={20} />
              <input 
                type="text" 
                placeholder={`Rechercher un ${terminology.student.toLowerCase()} par nom, matricule ou ${terminology.option.toLowerCase()}...`}
                className="w-full pl-12 pr-4 py-3 bg-white text-gray-900 border border-gray-300 rounded-lg text-sm font-medium outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-sans"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm.length >= 2 && (
                <div className="absolute top-full left-0 right-0 z-[100] mt-2 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden max-h-[300px] overflow-y-auto animate-in zoom-in-95 custom-scrollbar font-sans">
                  {isSearching ? (
                    <div className="p-8 text-center font-sans">
                      <RefreshCcw className="animate-spin text-blue-500 mx-auto mb-2" size={24} />
                      <p className="text-sm text-gray-500 font-sans">Recherche en cours...</p>
                    </div>
                  ) : searchResults.length > 0 ? (
                    searchResults.map(s => (
                      <button key={s.id} onClick={() => handleSelectStudent(s)} className="w-full px-4 py-3 hover:bg-gray-50 flex items-center justify-between border-b border-gray-100 last:border-0 group font-sans text-left">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center font-semibold text-lg">{(s.last_name || '?').charAt(0).toUpperCase()}</div>
                          <div className="text-left">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-bold text-gray-900 text-sm group-hover:text-blue-600 transition-colors font-sans">{s.fullName}</p>
                              {s.academic_year_label && (
                                <span className={`inline-flex items-center px-1.5 py-0.5 text-[9px] font-bold rounded-md border ${
                                  s.academic_year_status === 'ACTIVE' 
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                                    : s.academic_year_status === 'FUTURE'
                                    ? 'bg-amber-50 text-amber-700 border-amber-100'
                                    : 'bg-slate-50 text-slate-500 border-slate-200'
                                }`}>
                                  {s.academic_year_label}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 font-sans">{s.class?.name || s.class_name || 'Registre Général'} <span className="ml-2 font-mono text-[10px] text-gray-400">Matricule: {s.reference_number || s.id?.substring(0, 8) || ''}</span></p>
                          </div>
                        </div>
                        <ChevronRight className="text-gray-400 group-hover:text-blue-500 transition-colors font-sans" size={18} />
                      </button>
                    ))
                  ) : (
                    <div className="p-8 text-center space-y-2 font-sans">
                      <p className="text-sm text-gray-500 italic font-sans font-sans">Aucun {terminology.student.toLowerCase()} trouvé pour "{searchTerm}"</p>
                      <p className="text-[10px] text-gray-400 font-sans">Vérifiez l'orthographe ou essayez une partie du nom</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200/60 animate-in fade-in duration-300 font-sans">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-bold text-xl border border-blue-100">
                  {(selectedStudent.last_name || '?').charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-base font-bold text-slate-950">{formatStudentName(selectedStudent.last_name, selectedStudent.first_name).fullName}</h4>
                    {selectedStudent.isNotEnrolledInTargetYear ? (
                      <span className="text-amber-800 bg-amber-100/80 border border-amber-200 px-2 py-0.5 rounded-md text-[10px] font-bold">
                        Non inscrit ({selectedStudent.academicYear})
                      </span>
                    ) : (
                      <span className="text-emerald-800 bg-emerald-100/80 border border-emerald-200 px-2 py-0.5 rounded-md text-[10px] font-bold">
                        Inscrit ({selectedStudent.academicYear})
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                    <ShieldCheck size={14} className="text-emerald-500" /> ID: {selectedStudent.id.substring(0,8)} • {selectedStudent.classe || 'Registre Académique'}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedStudent(null)} 
                className="text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-3 py-2 rounded-lg border border-rose-200/40 flex items-center gap-1.5 transition-all self-end sm:self-center"
              >
                <RotateCcw size={14} /> Annuler
              </button>
            </div>
          )}
        </div>
      </div>

      {!selectedStudent ? (
        <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-20 text-center space-y-4">
          <FileSearch size={48} className="text-gray-400 mx-auto" />
          <p className="text-lg font-medium text-gray-500">Sélectionner un dossier {terminology.student.toLowerCase()} pour l'audit</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-6">
            {/* Banner: Inscription Détectée dans une Autre Session */}
            {selectedStudent.isNotEnrolledInTargetYear && selectedStudent.otherEnrollments && selectedStudent.otherEnrollments.length > 0 && (
              <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-2 border-amber-300/80 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-in fade-in">
                <div className="flex items-start gap-3.5">
                  <div className="p-2.5 bg-amber-100 text-amber-700 rounded-xl shrink-0 mt-0.5">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-amber-950 flex items-center gap-2">
                      Inscription Détectée dans une Autre Session
                      <span className="text-[10px] bg-amber-200 text-amber-900 font-bold px-2 py-0.5 rounded-full uppercase">
                        {selectedStudent.otherEnrollments[0].academic_year?.label}
                      </span>
                    </h4>
                    <p className="text-xs text-amber-900/80 mt-1 leading-relaxed">
                      Ce(tte) {terminology.student.toLowerCase()} est enregistré(e) pour l'année académique <strong>{selectedStudent.otherEnrollments[0].academic_year?.label}</strong> ({selectedStudent.otherEnrollments[0].class?.name || 'Classe'}). Actuellement, vous visualisez la session <strong>{academicYears.find(y => y.id === selectedYearId)?.label}</strong>.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const targetId = selectedStudent.otherEnrollments[0].academic_year_id;
                    setSelectedYearId(targetId);
                    loadDetails(selectedStudent, targetId);
                  }}
                  className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white text-xs font-black rounded-xl transition-all shadow-md shadow-amber-600/20 shrink-0 self-end sm:self-center flex items-center gap-2 cursor-pointer"
                >
                  <Sparkles size={15} />
                  Basculer sur {selectedStudent.otherEnrollments[0].academic_year?.label}
                </button>
              </div>
            )}

            {/* Portefeuille / Balance Globale Banner */}
            <div className="bg-white border-2 border-slate-200 rounded-2xl overflow-hidden shadow-sm space-y-6 p-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                    <Wallet size={22} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">Portefeuille de l'{terminology.student}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Situation économique globale (Session courante & Campagnes)</p>
                  </div>
                </div>
                <div className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 ${selectedStudent.globalDebt > 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                  <span className="h-2 w-2 rounded-full bg-current"></span>
                  {selectedStudent.globalDebt > 0 ? `Solde Débiteur Global: ${selectedStudent.globalDebt.toLocaleString()} G` : 'Compte Soldé'}
                </div>
              </div>

              {/* Detailed Portefeuille breakdown */}
              {(() => {
                const showCamp = Boolean(
                  selectedStudent.hasCampaigns || 
                  (selectedStudent.campaignsPaid || 0) > 0 || 
                  (selectedStudent.campaignsFee || 0) > 0 || 
                  (selectedStudent.campaignsNativeHTG || 0) > 0 || 
                  (selectedStudent.campaignsNativeUSD || 0) > 0 ||
                  (selectedStudent.campaignPayments && selectedStudent.campaignPayments.length > 0)
                );
                const showMisc = Boolean(
                  (selectedStudent.miscFee || 0) > 0 || 
                  (selectedStudent.miscPaid || 0) > 0 || 
                  (selectedStudent.miscNativeHTG || 0) > 0 || 
                  (selectedStudent.miscNativeUSD || 0) > 0 ||
                  (selectedStudent.miscPayments && selectedStudent.miscPayments.length > 0)
                );
                let colsClass = 'md:grid-cols-2';
                if (showCamp && showMisc) {
                  colsClass = 'md:grid-cols-4';
                } else if (showCamp || showMisc) {
                  colsClass = 'md:grid-cols-3';
                }
                return (
                  <div className={`grid grid-cols-1 ${colsClass} gap-5`}>
                    {/* 1. Admission / Inscription */}
                    {(() => {
                      const details = getFeeRowDetails(
                        selectedStudent.admissionNativeHTG || 0,
                        selectedStudent.admissionNativeUSD || 0,
                        selectedStudent.admissionPaid || 0,
                        selectedStudent.exchangeRate || 135,
                        0,
                        selectedStudent.admissionPayments
                      );
                      return (
                        <div className="bg-slate-50/60 rounded-xl p-5 border border-slate-100 space-y-4">
                          <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                            <span className="text-xs font-bold uppercase text-slate-600 tracking-wider">Admission / Inscription</span>
                            <span className="text-[10px] bg-slate-200/60 text-slate-600 px-1.5 py-0.5 rounded font-black">FIXE</span>
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between items-start text-xs text-slate-500 font-medium">
                              <span>Frais Exigés :</span>
                              <div className="text-right">
                                <span className="font-semibold text-slate-800 block">{details.plannedNative}</span>
                                <span className="text-[10px] text-slate-400 font-mono block">{details.plannedEquiv}</span>
                              </div>
                            </div>
                            <div className="flex justify-between items-start text-xs text-slate-500 font-medium">
                              <span>Montant Versé :</span>
                              <div className="text-right">
                                <span className="font-bold text-emerald-600 block">{details.paidNative}</span>
                                {details.paidEquiv && <span className="text-[10px] text-emerald-500 font-mono block">{details.paidEquiv}</span>}
                              </div>
                            </div>
                            <div className="border-t border-slate-200/50 pt-2 flex justify-between items-start text-xs">
                              <span className="font-bold text-slate-600">Reste à payer :</span>
                              <div className="text-right">
                                <span className={`font-black ${details.isPaid ? 'text-emerald-600' : 'text-rose-500'} block`}>
                                  {details.remainingNative}
                                </span>
                                {!details.isPaid && (
                                  <span className="text-[10px] font-semibold text-rose-400 font-mono block">{details.remainingEquiv}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* 2. Écolage / Scolarité */}
                    {(() => {
                      const discountToDisplay = selectedStudent.tuitionDiscountApplied !== undefined 
                        ? selectedStudent.tuitionDiscountApplied 
                        : Math.min(
                            (selectedStudent.tuitionNativeHTG || 0) + ((selectedStudent.tuitionNativeUSD || 0) * (selectedStudent.exchangeRate || 135)) + Number(selectedStudent.tuitionAddition || 0),
                            selectedStudent.totalDiscount || 0
                          );
                      const details = getFeeRowDetails(
                        selectedStudent.tuitionNativeHTG || 0,
                        selectedStudent.tuitionNativeUSD || 0,
                        selectedStudent.tuitionPaid || 0,
                        selectedStudent.exchangeRate || 135,
                        discountToDisplay,
                        selectedStudent.tuitionPayments
                      );
                      return (
                        <div className="bg-slate-50/60 rounded-xl p-5 border border-slate-100 space-y-4">
                          <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                            <span className="text-xs font-bold uppercase text-slate-600 tracking-wider">Frais {terminology.tuition}</span>
                            <span className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-black">CONTRAT</span>
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between items-start text-xs text-slate-500 font-medium">
                              <span>Frais Ajustés :</span>
                              <div className="text-right">
                                <span className="font-semibold text-slate-800 block">{details.plannedNative}</span>
                                <span className="text-[10px] text-slate-400 font-mono block">{details.plannedEquiv}</span>
                              </div>
                            </div>
                            <div className="flex justify-between items-start text-xs text-slate-500 font-medium">
                              <span>Montant Versé :</span>
                              <div className="text-right">
                                <span className="font-bold text-emerald-600 block">{details.paidNative}</span>
                                {details.paidEquiv && <span className="text-[10px] text-emerald-500 font-mono block">{details.paidEquiv}</span>}
                              </div>
                            </div>
                            <div className="border-t border-slate-200/50 pt-2 flex justify-between items-start text-xs">
                              <span className="font-bold text-slate-600">Reste à payer :</span>
                              <div className="text-right">
                                <span className={`font-black ${details.isPaid ? 'text-emerald-600' : 'text-rose-500'} block`}>
                                  {details.remainingNative}
                                </span>
                                {!details.isPaid && (
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
                        selectedStudent.campaignsNativeHTG || 0,
                        selectedStudent.campaignsNativeUSD || 0,
                        selectedStudent.campaignsPaid || 0,
                        selectedStudent.exchangeRate || 135,
                        0,
                        selectedStudent.campaignPayments
                      );
                      return (
                        <div className="bg-slate-50/60 rounded-xl p-5 border border-slate-100 space-y-4">
                          <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                            <span className="text-xs font-bold uppercase text-slate-600 tracking-wider">Campagnes & Activités</span>
                            <span className="text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded font-black">SPÉCIAL</span>
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between items-start text-xs text-slate-500 font-medium">
                              <span>Frais Exigés :</span>
                              <div className="text-right">
                                <span className="font-semibold text-slate-800 block">{details.plannedNative}</span>
                                <span className="text-[10px] text-slate-400 font-mono block">{details.plannedEquiv}</span>
                              </div>
                            </div>
                            <div className="flex justify-between items-start text-xs text-slate-500 font-medium">
                              <span>Montant Versé :</span>
                              <div className="text-right">
                                <span className="font-bold text-emerald-600 block">{details.paidNative}</span>
                                {details.paidEquiv && <span className="text-[10px] text-emerald-500 font-mono block">{details.paidEquiv}</span>}
                              </div>
                            </div>
                            <div className="border-t border-slate-200/50 pt-2 flex justify-between items-start text-xs">
                              <span className="font-bold text-slate-600">Reste à payer :</span>
                              <div className="text-right">
                                <span className={`font-black ${details.isPaid ? 'text-emerald-600' : 'text-rose-500'} block`}>
                                  {details.remainingNative}
                                </span>
                                {!details.isPaid && (
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
                        selectedStudent.miscNativeHTG || 0,
                        selectedStudent.miscNativeUSD || 0,
                        selectedStudent.miscPaid || 0,
                        selectedStudent.exchangeRate || 135,
                        0,
                        selectedStudent.miscPayments
                      );
                      return (
                        <div className="bg-slate-50/60 rounded-xl p-5 border border-slate-100 space-y-4">
                          <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                            <span className="text-xs font-bold uppercase text-slate-600 tracking-wider">Frais Divers Obligatoires</span>
                            <span className="text-[10px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded font-black">ANNUEL</span>
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between items-start text-xs text-slate-500 font-medium">
                              <span>Frais Planifiés :</span>
                              <div className="text-right">
                                <span className="font-semibold text-slate-800 block">{details.plannedNative}</span>
                                <span className="text-[10px] text-slate-400 font-mono block">{details.plannedEquiv}</span>
                              </div>
                            </div>
                            <div className="flex justify-between items-start text-xs text-slate-500 font-medium">
                              <span>Montant Versé :</span>
                              <div className="text-right">
                                <span className="font-bold text-emerald-600 block">{details.paidNative}</span>
                                {details.paidEquiv && <span className="text-[10px] text-emerald-500 font-mono block">{details.paidEquiv}</span>}
                              </div>
                            </div>
                            <div className="border-t border-slate-200/50 pt-2 flex justify-between items-start text-xs">
                              <span className="font-bold text-slate-600">Reste à payer :</span>
                              <div className="text-right">
                                <span className={`font-black ${details.isPaid ? 'text-emerald-600' : 'text-rose-500'} block`}>
                                  {details.remainingNative}
                                </span>
                                {!details.isPaid && (
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

              {/* Bilan financier global banner */}
              <div className="bg-indigo-900 text-white rounded-xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-0.5 text-center sm:text-left">
                  <span className="text-[10px] font-black uppercase text-indigo-200 tracking-wider">Bilan Financier Global</span>
                  <p className="text-sm font-semibold text-indigo-100">Total Recueilli pour l'{terminology.student.toLowerCase()}</p>
                </div>
                <div className="grid grid-cols-3 gap-4 text-center w-full sm:w-auto">
                  <div className="bg-indigo-950/40 px-3 py-1.5 rounded-lg border border-indigo-700/50">
                    <span className="block text-[9px] font-bold text-indigo-300 uppercase tracking-widest">Total Dû</span>
                    <span className="text-xs font-bold font-mono">{(selectedStudent.totalDue || 0).toLocaleString()} G</span>
                  </div>
                  <div className="bg-indigo-950/40 px-3 py-1.5 rounded-lg border border-emerald-500/50">
                    <span className="block text-[9px] font-bold text-emerald-300 uppercase tracking-widest">Recueilli</span>
                    <span className="text-xs font-bold font-mono text-emerald-300">+{((selectedStudent.paid || 0)).toLocaleString()} G</span>
                  </div>
                  <div className={`px-3 py-1.5 rounded-lg border ${(selectedStudent.totalDue - selectedStudent.paid) <= 0 ? 'bg-indigo-950/40 border-emerald-500/50' : 'bg-rose-950/40 border-rose-500/50'}`}>
                    <span className="block text-[9px] font-bold text-slate-300 uppercase tracking-widest">Reste</span>
                    <span className={`text-xs font-bold font-mono ${(selectedStudent.totalDue - selectedStudent.paid) <= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                      {(selectedStudent.totalDue - selectedStudent.paid) <= 0 ? 'À Jour' : `${Math.max(0, selectedStudent.totalDue - selectedStudent.paid).toLocaleString()} G`}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Échéancier de Versements ({terminology.tuition}) */}
            {selectedStudent?.plan?.payment_structure && selectedStudent.plan.payment_structure.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                      <TrendingUp size={20} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 text-sm">Échéancier {terminology.tuition}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">Statut des versements programmés</p>
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {(() => {
                      let acc = 0;
                      const tuitionPaid = selectedStudent.scolaritePaid || 0;
                      
                      return selectedStudent.plan.payment_structure.map((step: any, i: number) => {
                        acc += step.amount;
                        const isPaid = (tuitionPaid + 10) >= acc;
                        const isNext = !isPaid && (tuitionPaid + 10) >= (acc - step.amount);
                        
                        return (
                          <div key={i} className={`p-4 rounded-xl border-2 transition-all ${isPaid ? 'bg-emerald-50 border-emerald-100 opacity-60' : isNext ? 'bg-white border-indigo-500 ring-4 ring-indigo-50 shadow-md relative overflow-hidden' : 'bg-white border-gray-100'}`}>
                            {isNext && (
                              <div className="bg-indigo-600 text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-b-md mb-2 inline-block">
                                📍 Étape Courante Détectée
                              </div>
                            )}
                            <div className="flex justify-between items-start mb-2">
                              <span className={`text-[10px] font-black uppercase tracking-widest ${isPaid ? 'text-emerald-700' : isNext ? 'text-indigo-600' : 'text-gray-400'}`}>
                                {step.label}
                              </span>
                              {isPaid ? (
                                <CheckCircle2 size={16} className="text-emerald-600" />
                              ) : isNext ? (
                                <Sparkles size={16} className="text-indigo-500 animate-pulse" />
                              ) : (
                                <div className="w-1.5 h-1.5 rounded-full bg-gray-200 mt-1.5"></div>
                              )}
                            </div>
                            <p className={`text-lg font-black font-mono ${isPaid ? 'text-emerald-800' : 'text-gray-900'}`}>{step.amount.toLocaleString()} G</p>
                            {step.due_date && <p className="text-[10px] font-bold text-gray-400 mt-1 italic">Échéance: {new Date(step.due_date).toLocaleDateString()}</p>}
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 text-blue-600 rounded-lg shrink-0"><Receipt size={20} /></div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm">Journal des Versements</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Certification Officielle {schoolDetails?.name ? `${schoolDetails.name} Finance` : 'Finance'}</p>
                  </div>
                </div>
                {studentHistory.length > 0 && (
                  <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg border border-slate-200 whitespace-nowrap">
                    {studentHistory.length} versement{studentHistory.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {/* Version Mobile / Petite Tablette (Vue Cartes Adaptées) */}
              <div className="block md:hidden divide-y divide-gray-100">
                {studentHistory.map((t) => {
                  const isUSD = t.currency === 'USD';
                  const paidAmount = Number(t.amount || 0);
                  const appliedRate = Number(t.exchange_rate_applied || selectedStudent?.exchangeRate || 140);
                  const baseHTG = Number(t.amount_htg_equivalent || (isUSD ? paidAmount * appliedRate : paidAmount));

                  return (
                    <div key={t.id} className="p-4 space-y-2.5 hover:bg-slate-50/60 transition-colors">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-bold text-gray-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 whitespace-nowrap">
                          RCP-{t.id.substring(0, 8).toUpperCase()}
                        </span>
                        <span className="text-xs font-medium text-gray-500 whitespace-nowrap">
                          {new Date(t.created_at).toLocaleDateString('fr-FR')}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium text-gray-700 bg-gray-100 px-2.5 py-0.5 rounded-md whitespace-nowrap">
                          {t.campaign?.name ? `Campagne: ${t.campaign.name}` : t.ad_hoc_campaign_id ? 'Frais de Campagne' : (t.fee_type === 'SCOLARITE' || (!t.fee_type && (!t.nature || t.nature === 'SCOLARITE' || t.nature === 'Scolarité'))) ? 'Frais Académiques' : ((t.fee_type === 'INSCRIPTION' || t.nature === 'INSCRIPTION' || t.nature === "Frais d'inscription") ? 'Inscription' : (t.nature || t.type || t.fee_type || 'Frais Divers'))}
                        </span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-md whitespace-nowrap ${
                          t.status === 'ANNULE' ? 'bg-rose-100 text-rose-700 border border-rose-200' :
                          t.payment_method?.includes('EN ATTENTE') ? 'bg-amber-50 text-amber-700 border border-amber-200' : 
                          t.payment_method?.includes('REJETÉ') ? 'bg-rose-50 text-rose-700 border border-rose-200' : 
                          'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          {t.status === 'ANNULE' ? 'Annulé' : (t.payment_method || 'Cash')}
                        </span>
                      </div>

                      <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/70 flex items-center justify-between gap-2">
                        <div>
                          <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Montant Payé</div>
                          <div className="font-mono font-bold text-xs mt-0.5">
                            {isUSD ? (
                              <span className="text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded inline-block">
                                ${paidAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} USD
                              </span>
                            ) : (
                              <span className="text-slate-800">
                                {paidAmount.toLocaleString()} HTG
                              </span>
                            )}
                          </div>
                          {isUSD && (
                            <div className="text-[10px] text-amber-800 font-mono mt-1 flex items-center gap-1 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded w-fit">
                              <ArrowRightLeft size={10} className="text-amber-600" />
                              1 USD = {appliedRate} HTG
                            </div>
                          )}
                        </div>

                        <div className="text-right">
                          <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Valeur HTG</div>
                          <div className="text-sm font-black text-slate-900 font-mono mt-0.5">
                            {baseHTG.toLocaleString()} G
                          </div>
                          {t.status !== 'ANNULE' && canCancelPayment && (
                            <button
                              type="button"
                              onClick={() => handleCancelPayment(t.id)}
                              className="mt-1 px-2 py-0.5 text-[11px] font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded transition-colors inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                              title="Annuler ce versement"
                            >
                              <Trash2 size={11} />
                              <span>Annuler</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {studentHistory.length === 0 && (
                  <div className="p-8 text-center text-gray-500 text-sm">
                    Aucune opération financière répertoriée.
                  </div>
                )}
              </div>

              {/* Version Grand Écran / Tablette (Tableau optimisé anti-wrapping) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full min-w-[780px] text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-gray-600 text-xs font-bold border-b border-gray-200 uppercase tracking-wider">
                      <th className="px-4 py-3.5 whitespace-nowrap">Référence</th>
                      <th className="px-4 py-3.5 whitespace-nowrap">Date</th>
                      <th className="px-4 py-3.5 whitespace-nowrap">Nature</th>
                      <th className="px-4 py-3.5 whitespace-nowrap">Méthode</th>
                      <th className="px-4 py-3.5 text-right whitespace-nowrap">Montant Payé</th>
                      <th className="px-4 py-3.5 text-center whitespace-nowrap">Taux Appliqué</th>
                      <th className="px-4 py-3.5 text-right whitespace-nowrap">Valeur de Base (HTG)</th>
                      <th className="px-4 py-3.5 text-center whitespace-nowrap">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {studentHistory.map((t) => {
                      const isUSD = t.currency === 'USD';
                      const paidAmount = Number(t.amount || 0);
                      const appliedRate = Number(t.exchange_rate_applied || selectedStudent?.exchangeRate || 140);
                      const baseHTG = Number(t.amount_htg_equivalent || (isUSD ? paidAmount * appliedRate : paidAmount));

                      return (
                        <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <span className="font-mono text-xs font-bold text-gray-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 whitespace-nowrap inline-block">
                              RCP-{t.id.substring(0,8).toUpperCase()}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-xs text-gray-600 whitespace-nowrap">
                            {new Date(t.created_at).toLocaleDateString('fr-FR')}
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <span className="text-xs font-medium text-gray-700 bg-gray-100 px-2.5 py-1 rounded-md whitespace-nowrap inline-block">
                              {t.campaign?.name ? `Campagne: ${t.campaign.name}` : t.ad_hoc_campaign_id ? 'Frais de Campagne' : (t.fee_type === 'SCOLARITE' || (!t.fee_type && (!t.nature || t.nature === 'SCOLARITE' || t.nature === 'Scolarité'))) ? 'Frais Académiques' : ((t.fee_type === 'INSCRIPTION' || t.nature === 'INSCRIPTION' || t.nature === "Frais d'inscription") ? 'Inscription' : (t.nature || t.type || t.fee_type || 'Frais Divers'))}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <span className={`text-xs font-medium px-2.5 py-1 rounded-md whitespace-nowrap inline-block ${
                              t.status === 'ANNULE' ? 'bg-rose-100 text-rose-700 border border-rose-200' :
                              t.payment_method?.includes('EN ATTENTE') ? 'bg-amber-50 text-amber-700 border border-amber-200' : 
                              t.payment_method?.includes('REJETÉ') ? 'bg-rose-50 text-rose-700 border border-rose-200' : 
                              'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}>
                              {t.status === 'ANNULE' ? 'Annulé' : (t.payment_method || 'Cash')}
                            </span>
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
                              <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded text-[11px] font-mono font-bold whitespace-nowrap" title={`Taux historique appliqué : 1 USD = ${appliedRate} HTG`}>
                                <ArrowRightLeft size={11} className="text-amber-600 shrink-0" />
                                <span>1 USD = {appliedRate} HTG</span>
                              </span>
                            ) : (
                              <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded whitespace-nowrap inline-block">
                                1:1 (HTG)
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-right font-semibold font-mono text-gray-900 whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                              <span className="text-sm font-black text-slate-900 whitespace-nowrap">
                                {baseHTG.toLocaleString()} G
                              </span>
                              
                              {/* Infobulle détaillée sur la transaction */}
                              <div className="relative group inline-block">
                                <button
                                  type="button"
                                  className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors cursor-pointer"
                                  title="Consulter le décompte financier détaillé"
                                >
                                  <Info size={14} />
                                </button>
                                
                                <div className="absolute right-0 bottom-full mb-2 hidden group-hover:block z-50 w-72 bg-slate-900 text-white rounded-xl shadow-2xl p-3 border border-slate-700 pointer-events-none animate-in fade-in zoom-in-95 duration-150 whitespace-normal">
                                  <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1">
                                      <ArrowRightLeft size={11} /> Décompte Transaction
                                    </span>
                                    <span className="text-[9px] font-mono text-slate-400">
                                      RCP-{t.id.substring(0,8).toUpperCase()}
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
                                      <span className="text-[11px] text-slate-400 font-bold">Valeur convertie :</span>
                                      <span className="font-mono font-black text-white">
                                        {baseHTG.toLocaleString()} HTG
                                      </span>
                                    </div>
                                    <div className="text-[9px] text-slate-400 pt-1 border-t border-slate-800 flex justify-between">
                                      <span>Date :</span>
                                      <span>{new Date(t.created_at).toLocaleString('fr-FR')}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-center whitespace-nowrap">
                            {t.status !== 'ANNULE' && canCancelPayment && (
                              <button
                                type="button"
                                onClick={() => handleCancelPayment(t.id)}
                                className="px-2.5 py-1 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                                title="Annuler ce versement en double"
                              >
                                <Trash2 size={13} />
                                <span>Annuler</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {studentHistory.length === 0 && <tr><td colSpan={8} className="px-6 py-16 text-center text-gray-500 text-sm">Aucune opération financière répertoriée.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-100 text-blue-700 rounded-lg flex items-center justify-center font-semibold text-xl">{selectedStudent.last_name.charAt(0).toUpperCase()}</div>
                <div><h4 className="text-lg font-semibold text-gray-900">{selectedStudent.fullName}</h4><p className="text-xs text-gray-500 mt-0.5">Profil Financier {terminology.student}</p></div>
              </div>
              <div className="space-y-3 pt-2">
                <button 
                  onClick={() => navigate('/economat/frais', { state: { studentId: selectedStudent.id, academicYearId: selectedYearId } })} 
                  className="w-full py-2.5 bg-slate-900 hover:bg-emerald-600 text-white font-medium rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 text-sm cursor-pointer"
                >
                  <DollarSign size={16} /> Encaisser au Guichet
                </button>
                {balance > 0 && (
                  <button 
                    onClick={() => {
                      const msg = `${schoolDetails?.name || 'École'}: Rappel de paiement pour ${selectedStudent.first_name}. Solde dû: ${balance.toLocaleString()} HTG. Merci de régulariser au plus vite.`;
                      setReminderMessage(msg);
                      setShowReminderModal(true);
                    }}
                    className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 text-sm cursor-pointer"
                  >
                    <MessageSquare size={16} /> Relancer (SMS/Email)
                  </button>
                )}
                <button 
                  onClick={() => setPrintPreview(true)}
                  className="w-full py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 text-sm cursor-pointer"
                >
                  <Printer size={16} /> Relevé de Compte
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Relance Automatisée */}
      {showReminderModal && selectedStudent && (
        <div className="fixed inset-0 z-[1100] bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
                  <MessageSquare size={20} />
                </div>
                <h3 className="font-bold text-gray-900">Relance de Paiement</h3>
              </div>
              <button onClick={() => setShowReminderModal(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="flex bg-gray-100 p-1 rounded-xl">
                <button 
                  onClick={() => setReminderType('sms')}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${reminderType === 'sms' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}
                >
                  SMS
                </button>
                <button 
                  onClick={() => setReminderType('email')}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${reminderType === 'email' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}
                >
                  Email
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 tracking-widest uppercase">Message de relance</label>
                <textarea 
                  value={reminderMessage}
                  onChange={(e) => setReminderMessage(e.target.value)}
                  className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none min-h-[120px] resize-none"
                />
                <p className="text-[10px] text-gray-400 italic">
                  Destinataire: {reminderType === 'sms' ? selectedStudent.parent_phone || 'Non renseigné' : selectedStudent.parent_email || 'Non renseigné'}
                </p>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setShowReminderModal(false)}
                  className="flex-1 py-3 border border-gray-200 text-gray-600 font-bold text-xs rounded-xl hover:bg-gray-50 transition-all"
                >
                  Annuler
                </button>
                <button 
                  disabled={isSendingReminder || (reminderType === 'sms' ? !selectedStudent.parent_phone : !selectedStudent.parent_email)}
                  onClick={async () => {
                    setIsSendingReminder(true);
                    try {
                      // Log the communication
                      const { data: logData, error: logError } = await supabase
                        .from('communication_logs')
                        .insert({
                          school_id: user.school_id,
                          sender_id: user.id,
                          type: reminderType,
                          recipient_type: 'individual',
                          recipient_count: 1,
                          content: reminderMessage,
                          status: 'sent'
                        })
                        .select('id')
                        .single();

                      if (logError) throw logError;

                      await supabase.from('communication_recipients').insert({
                        log_id: logData.id,
                        recipient_id: selectedStudent.id,
                        recipient_name: selectedStudent.parent_name || formatStudentName(selectedStudent.last_name, selectedStudent.first_name).fullName,
                        recipient_contact: reminderType === 'sms' ? selectedStudent.parent_phone : selectedStudent.parent_email,
                        status: 'sent'
                      });

                      toast.success(`Relance envoyée par ${reminderType.toUpperCase()}`);
                      setShowReminderModal(false);
                    } catch (err: any) {
                      toast.error("Erreur d'envoi: " + err.message);
                    } finally {
                      setIsSendingReminder(false);
                    }
                  }}
                  className="flex-1 py-3 bg-blue-600 text-white font-bold text-xs rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSendingReminder ? <RefreshCcw size={16} className="animate-spin" /> : <Send size={16} />}
                  Envoyer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Relevé de Compte Modal */}
      {printPreview && selectedStudent && (
        <div className="fixed inset-0 z-[1000] bg-slate-950/95 backdrop-blur-2xl flex items-center justify-center p-0 md:p-4 print:hidden animate-in fade-in duration-300 overflow-y-auto">
          <div className="w-full max-w-4xl bg-white shadow-2xl rounded-none md:rounded-[2rem] overflow-hidden flex flex-col my-auto border border-white/10">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 shadow-inner">
                  <Printer size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">Aperçu du Relevé de Compte</h3>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">Format standard professionnel {schoolDetails?.name || 'École'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={exportToPDF}
                  disabled={isExporting}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-xl text-sm font-black flex items-center gap-2 shadow-lg shadow-emerald-200 transition-all active:scale-95"
                >
                  {isExporting ? <RefreshCcw size={18} className="animate-spin" /> : <FileDown size={18} />}
                  EXPORTER PDF
                </button>
                <button 
                  onClick={() => window.print()}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-black flex items-center gap-2 shadow-lg shadow-blue-200 transition-all active:scale-95"
                >
                  <Printer size={18} /> IMPRIMER
                </button>
                <button 
                  onClick={() => setPrintPreview(false)}
                  className="w-10 h-10 flex items-center justify-center hover:bg-slate-100 rounded-xl text-slate-400 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            <div className="flex-1 p-8 md:p-12 overflow-y-auto bg-slate-50/50">
              <div id="releve-compte-print" className="max-w-3xl mx-auto shadow-2xl print:shadow-none print:m-0 print:w-full p-10 border-0 rounded-[2rem] bg-white relative overflow-hidden">
                {/* Watermark/Decoration */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-slate-50 rounded-full -mr-32 -mt-32 pointer-events-none opacity-50"></div>
                
                {/* Header */}
                <div className="relative flex justify-between items-start mb-12">
                  <div className="flex gap-6 items-center">
                    {schoolDetails?.logo_url ? (
                      <div className="w-24 h-24 bg-white rounded-2xl shadow-sm border border-slate-100 p-2 flex items-center justify-center overflow-hidden">
                        <img 
                          src={schoolDetails.logo_url} 
                          alt="Logo" 
                          className="max-w-full max-h-full object-contain"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    ) : (
                      <div className="w-24 h-24 bg-indigo-600 rounded-2xl flex items-center justify-center text-white text-3xl font-black shadow-lg">
                        {schoolDetails?.name?.substring(0, 1) || 'E'}
                      </div>
                    )}
                    <div>
                      <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none mb-2">{schoolDetails?.name}</h1>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                          <Target size={10} className="text-slate-300" /> {schoolDetails?.address}
                        </p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                          <RefreshCcw size={10} className="text-slate-300" /> {schoolDetails?.phone} {schoolDetails?.email && `| ${schoolDetails.email}`}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="inline-block px-4 py-1.5 bg-slate-900 text-white rounded-lg text-[10px] font-black uppercase tracking-[0.2em] mb-4 shadow-lg shadow-slate-200">
                      RELEVÉ DE COMPTE
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date d'émission</p>
                      <p className="text-sm font-black text-slate-900">{new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                    </div>
                  </div>
                </div>

                {/* Student Info Card */}
                <div className="grid grid-cols-2 gap-8 mb-10">
                  <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                      <User size={64} />
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Informations {terminology.student}</p>
                    <div className="relative z-10">
                      <p className="text-2xl font-black text-slate-900 uppercase tracking-tight leading-tight">{selectedStudent.fullName}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-black text-slate-500 uppercase tracking-widest">MATRICULE</span>
                        <p className="text-xs font-bold text-slate-600 font-mono">{selectedStudent.id.substring(0, 8).toUpperCase()}</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                      <BadgeCheck size={64} />
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Détails {terminology.tuition.includes('Académique') ? 'Académiques' : 'Scolaires'}</p>
                    <div className="grid grid-cols-2 gap-4 relative z-10">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{terminology.option} / Niveau</p>
                        <p className="text-base font-black text-slate-900">{selectedStudent.classe}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Année {terminology.academicYear.includes('Académique') ? 'Académique' : 'Scolaire'}</p>
                        <p className="text-base font-black text-slate-900">{selectedStudent.academicYear}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Financial Summary Table */}
                <div className="mb-10 overflow-hidden rounded-2xl border border-slate-100 shadow-sm">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="py-4 px-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">Désignation des Frais</th>
                        <th className="py-4 px-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">Montant (HTG)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      <tr>
                        <td className="py-4 px-6 text-sm font-bold text-slate-700">Frais d'Inscription / Réinscription</td>
                        <td className="py-4 px-6 text-right font-mono font-black text-slate-900">{selectedStudent.inscriptionFee.toLocaleString()}</td>
                      </tr>
                      <tr>
                        <td className="py-4 px-6 text-sm font-bold text-slate-700">{terminology.tuition}</td>
                        <td className="py-4 px-6 text-right font-mono font-black text-slate-900">{selectedStudent.tuitionFee.toLocaleString()}</td>
                      </tr>
                      {selectedStudent.miscFee > 0 && (
                        <tr>
                          <td className="py-4 px-6 text-sm font-bold text-slate-700">Frais Divers Obligatoires</td>
                          <td className="py-4 px-6 text-right font-mono font-black text-slate-900">{selectedStudent.miscFee.toLocaleString()}</td>
                        </tr>
                      )}
                      {selectedStudent.campaignsFee > 0 && (
                        <tr>
                          <td className="py-4 px-6 text-sm font-bold text-slate-700">Frais d'Événements / Campagnes (Ad-Hoc)</td>
                          <td className="py-4 px-6 text-right font-mono font-black text-slate-900">{selectedStudent.campaignsFee.toLocaleString()}</td>
                        </tr>
                      )}
                      {selectedStudent.tuitionAddition > 0 && (
                        <tr>
                          <td className="py-4 px-6 text-sm font-bold text-slate-700">Ajustements (Ajouts)</td>
                          <td className="py-4 px-6 text-right font-mono font-black text-indigo-600">+{selectedStudent.tuitionAddition.toLocaleString()}</td>
                        </tr>
                      )}
                      {selectedStudent.totalDiscount > 0 && (
                        <tr className="bg-rose-50/30">
                          <td className="py-4 px-6 text-sm font-bold italic text-rose-600">Réductions / Bourses Accordées</td>
                          <td className="py-4 px-6 text-right font-mono font-black text-rose-600">-{selectedStudent.totalDiscount.toLocaleString()}</td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-900 text-white">
                        <td className="py-5 px-6 text-xs font-black uppercase tracking-[0.2em]">Total Engagement Session</td>
                        <td className="py-5 px-6 text-right font-mono text-2xl font-black tracking-tighter">{selectedStudent.totalDue.toLocaleString()}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Payments History */}
                <div className="mb-10">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600">
                      <History size={16} />
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Historique des Versements Effectués</p>
                  </div>
                  <div className="rounded-2xl border border-slate-100 overflow-hidden">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-slate-50/50">
                          <th className="py-3 px-6 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date</th>
                          <th className="py-3 px-6 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Référence</th>
                          <th className="py-3 px-6 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nature</th>
                          <th className="py-3 px-6 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Montant</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {studentHistory.filter(p => p.status !== 'ANNULE' && !p.payment_method?.includes('REJETÉ')).map((p) => (
                          <tr key={p.id} className="hover:bg-slate-50/30 transition-colors">
                            <td className="py-3 px-6 text-xs font-bold text-slate-600">{new Date(p.created_at).toLocaleDateString()}</td>
                            <td className="py-3 px-6 text-xs font-mono text-slate-400">RCP-{p.id.substring(0,8).toUpperCase()}</td>
                            <td className="py-3 px-6 text-xs font-bold text-slate-700">{p.campaign?.name ? `Campagne: ${p.campaign.name}` : p.ad_hoc_campaign_id ? 'Frais de Campagne' : (p.fee_type === 'SCOLARITE' || (!p.fee_type && (!p.nature || p.nature === 'SCOLARITE' || p.nature === 'Scolarité'))) ? 'Frais Académiques' : ((p.fee_type === 'INSCRIPTION' || p.nature === 'INSCRIPTION' || p.nature === "Frais d'inscription") ? 'Inscription' : (p.nature || p.type || p.fee_type || 'Frais Divers'))}</td>
                            <td className="py-3 px-6 text-right font-mono font-black text-slate-900">{(p.amount_htg_equivalent || p.amount).toLocaleString()}</td>
                          </tr>
                        ))}
                        {studentHistory.length === 0 && (
                          <tr>
                            <td colSpan={4} className="py-10 text-center text-xs italic text-slate-400">Aucun versement enregistré pour cette période.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Final Balance Card */}
                <div className="grid grid-cols-2 gap-10 pt-10 border-t-2 border-slate-900">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center px-4">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Payé à ce jour</p>
                      <p className="text-base font-black text-emerald-600">{selectedStudent.paid.toLocaleString()} HTG</p>
                    </div>
                    <div className="p-6 rounded-3xl bg-slate-900 shadow-xl shadow-slate-200 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                        <DollarSign size={48} className="text-white" />
                      </div>
                      <p className="text-[10px] font-black text-white/50 uppercase tracking-[0.2em] mb-2">Solde Restant Dû</p>
                      <div className="flex items-baseline gap-2 relative z-10">
                        <p className={`text-3xl font-black font-mono tracking-tighter ${selectedStudent.totalDue - selectedStudent.paid > 0 ? 'text-white' : 'text-emerald-400'}`}>
                          {Math.max(0, selectedStudent.totalDue - selectedStudent.paid).toLocaleString()}
                        </p>
                        <span className="text-xs font-bold text-white/40 uppercase tracking-widest">HTG</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col justify-end items-end text-right pr-6">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-16">Signature & Sceau de la Direction</p>
                    <div className="w-56 border-b-2 border-slate-900 mb-2"></div>
                    <p className="text-xs font-black text-slate-900 uppercase tracking-tighter">{schoolDetails?.director_name || 'La Direction'}</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">EduNova Pro Verified Document</p>
                  </div>
                </div>

                {/* Footer Note */}
                <div className="mt-12 pt-6 border-t border-slate-100 text-center">
                  <p className="text-[8px] font-bold text-slate-300 uppercase tracking-[0.3em]">Ce document est généré électroniquement et ne nécessite pas de signature manuscrite pour être valide dans le cadre administratif interne.</p>
                </div>
              </div>
            </div>
          </div>
          
          <style dangerouslySetInnerHTML={{ __html: `
            @media print {
              body * { visibility: hidden; }
              .print\\:hidden { display: none !important; }
              .print\\:shadow-none { box-shadow: none !important; }
              .print\\:m-0 { margin: 0 !important; }
              .print\\:w-full { width: 100% !important; }
              .print\\:border-0 { border: 0 !important; }
              .fixed.inset-0 { position: static !important; display: block !important; background: white !important; padding: 0 !important; }
              .max-w-4xl { max-width: none !important; width: 100% !important; margin: 0 !important; }
              .bg-white.shadow-2xl { box-shadow: none !important; }
              .p-8.md\\:p-12 { padding: 0 !important; }
              #releve-compte-print { visibility: visible !important; position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; margin: 0 !important; padding: 20mm !important; border: none !important; box-shadow: none !important; }
              #releve-compte-print * { visibility: visible !important; }
            }
          `}} />
        </div>
      )}
    </div>
  );
};

export default StudentPaymentTracking;