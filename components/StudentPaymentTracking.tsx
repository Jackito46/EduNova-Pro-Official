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
  ArrowRightLeft,
  Layers,
  FileText,
  Check
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
  const rawTotalHTGEquiv = nativeHTG + (nativeUSD * rate);
  const totalHTGEquiv = Math.max(0, rawTotalHTGEquiv - discountHTG);
  const paidUSD = nativeUSD > 0 ? (paidHTGEquiv / rate) : 0;

  let isSettled = false;
  if (nativeUSD > 0 && nativeHTG === 0) {
    const effectiveUSD = Math.max(0, nativeUSD - (discountHTG > 0 ? discountHTG / rate : 0));
    isSettled = paidUSD >= effectiveUSD - 3.00 || 
      paidHTGEquiv >= (totalHTGEquiv - 450.0) || 
      (effectiveUSD > 0 && (paidUSD / effectiveUSD) >= 0.96);
  } else {
    isSettled = paidHTGEquiv >= (totalHTGEquiv - 450.0);
  }

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
  const [activeTooltip, setActiveTooltip] = useState<{
    id: string;
    isMobile: boolean;
    top: number;
    left: number;
    transaction: any;
  } | null>(null);

  const openTooltip = (e: React.MouseEvent<HTMLElement>, transaction: any) => {
    e.stopPropagation();
    const isMobile = window.innerWidth < 640;
    
    if (isMobile) {
      setActiveTooltip({
        id: transaction.id,
        isMobile: true,
        top: 0,
        left: 0,
        transaction,
      });
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const width = 380;
    const estHeight = 440;
    
    // Position horizontale bornée dans l'écran
    let left = rect.right - width;
    if (left < 16) left = 16;
    if (left + width > window.innerWidth - 16) {
      left = Math.max(16, window.innerWidth - width - 16);
    }

    // Position verticale intelligente : choisit l'orientation qui évite tout débordement
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    let top = 16;

    if (spaceBelow >= estHeight + 16) {
      top = rect.bottom + 8;
    } else if (spaceAbove >= estHeight + 16) {
      top = Math.max(16, rect.top - estHeight - 8);
    } else {
      // Si l'espace au-dessus et en-dessous est serré, centrer verticalement avec marge sûre
      top = Math.max(16, Math.floor((window.innerHeight - estHeight) / 2));
    }

    setActiveTooltip({
      id: transaction.id,
      isMobile: false,
      top,
      left,
      transaction,
    });
  };

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

      const tuitionEffectiveHTG = isEnrolled && student.is_foreign && plan?.foreign_tuition_fee 
        ? plan.foreign_tuition_fee 
        : tuitionHTG;

      const tuitionBreakdown = computeFeeCategoryBalance(
        tuitionEffectiveHTG + tuitionAddition,
        tuitionUSD,
        tuitionPayments,
        currentExchangeRate,
        tuitionDiscountApplied
      );

      const campaignsBreakdown = computeFeeCategoryBalance(
        campaignsNativeHTG,
        campaignsNativeUSD,
        campaignPayments,
        currentExchangeRate,
        0
      );

      // Séparation comptable stricte des dettes résiduelles par devise (HTG vs USD)
      const remainingHTG = 
        (admissionBreakdown.isPaid ? 0 : admissionBreakdown.remainingHTG) +
        (tuitionBreakdown.isPaid ? 0 : tuitionBreakdown.remainingHTG) +
        (miscBreakdown.isPaid ? 0 : miscBreakdown.remainingHTG) +
        (campaignsBreakdown.isPaid ? 0 : campaignsBreakdown.remainingHTG);

      const remainingUSD = 
        (admissionBreakdown.isPaid ? 0 : admissionBreakdown.remainingUSD) +
        (tuitionBreakdown.isPaid ? 0 : tuitionBreakdown.remainingUSD) +
        (miscBreakdown.isPaid ? 0 : miscBreakdown.remainingUSD) +
        (campaignsBreakdown.isPaid ? 0 : campaignsBreakdown.remainingUSD);

      const remainingHTGEquiv = remainingHTG + Math.round(remainingUSD * currentExchangeRate);
      const isFullySettled = (remainingHTG <= 0 && remainingUSD <= 0) || (remainingHTGEquiv <= 50);

      // Décomposition précise des montants exigés et payés directement par devise
      const totalDueHTG = admissionHTG + tuitionEffectiveHTG + tuitionAddition + miscHTG + campaignsNativeHTG;
      const totalDueUSD = admissionUSD + tuitionUSD + miscUSD + campaignsNativeUSD;

      let paidDirectHTG = 0;
      let paidDirectUSD = 0;
      validPayments.forEach((p: any) => {
        if (p.currency === 'USD') {
          paidDirectUSD += Number(p.amount || 0);
        } else {
          paidDirectHTG += Number(p.amount || 0);
        }
      });

      const admissionBalance = admissionBreakdown.isPaid ? 0 : admissionBreakdown.remainingHTGEquiv;
      const tuitionBalance = tuitionBreakdown.isPaid ? 0 : tuitionBreakdown.remainingHTGEquiv;
      const campaignsBalance = campaignsBreakdown.isPaid ? 0 : campaignsBreakdown.remainingHTGEquiv;
      const miscBalance = miscBreakdown.isPaid ? 0 : miscBreakdown.remainingHTGEquiv;

      const totalExpected = adjAdmissionExpected + tuitionExpected + adjCampaignsExpected + adjPlanMiscFee;
      const totalBalance = isFullySettled ? 0 : remainingHTGEquiv;

      // Fetch the true global debt across all active and past years (Portefeuille)
      let globalDebt = 0;
      let globalDebtHTG = 0;
      let globalDebtUSD = 0;
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
            .select('amount, currency, amount_htg_equivalent, fee_type, academic_year_id, exchange_rate_applied')
            .eq('school_id', user.school_id)
            .eq('student_id', student.id);

          const { data: allAdHocFees } = await supabase
            .from('student_ad_hoc_fees')
            .select('custom_amount, campaign:ad_hoc_campaigns(id, amount, currency, academic_year_id)')
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
          let calculatedGlobalDebtHTG = 0;
          let calculatedGlobalDebtUSD = 0;

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

              // 2. Tuition Fee & 3. Mandatory Misc Fee
              const enrollTuitionPayments = enrollYearPayments.filter((p: any) => p.fee_type === 'SCOLARITE' || !p.fee_type);
              const enrollMiscPayments = enrollYearPayments.filter((p: any) => p.fee_type === 'DIVERS');

              const planMiscHTG = planForYr.is_misc_mandatory ? Number(planForYr.misc_fee_htg || 0) : 0;
              const planMiscUSD = planForYr.is_misc_mandatory ? Number(planForYr.misc_fee_usd || 0) : 0;
              const yrMiscBreakdown = computeFeeCategoryBalance(
                planMiscHTG,
                planMiscUSD,
                enrollMiscPayments,
                currentExchangeRate
              );

              const totalYearDiscount = Number(enroll.tuition_discount || 0) + Number(student.discount_amount || 0);
              const yrTuitionHTG = (student.is_foreign && planForYr.foreign_tuition_fee ? planForYr.foreign_tuition_fee : Number(planForYr.tuition_fee || 0)) + Number(enroll.tuition_addition || 0);
              const yrTuitionUSD = Number(planForYr.tuition_fee_usd || 0);
              const yrTuitionBreakdown = computeFeeCategoryBalance(
                yrTuitionHTG,
                yrTuitionUSD,
                enrollTuitionPayments,
                currentExchangeRate,
                totalYearDiscount
              );

              const yrCampaignPayments = enrollYearPayments.filter((p: any) => p.fee_type === 'AD_HOC');
              const yrCampHTG = (allAdHocFees || [])
                .filter((fee: any) => fee.campaign && fee.campaign.academic_year_id === yrId && fee.campaign.currency !== 'USD')
                .reduce((sum: number, fee: any) => sum + (fee.custom_amount !== null && fee.custom_amount !== undefined ? Number(fee.custom_amount) : Number(fee.campaign?.amount || 0)), 0);

              const yrCampUSD = (allAdHocFees || [])
                .filter((fee: any) => fee.campaign && fee.campaign.academic_year_id === yrId && fee.campaign.currency === 'USD')
                .reduce((sum: number, fee: any) => sum + (fee.custom_amount !== null && fee.custom_amount !== undefined ? Number(fee.custom_amount) : Number(fee.campaign?.amount || 0)), 0);

              const yrCampaignsBreakdown = computeFeeCategoryBalance(
                yrCampHTG,
                yrCampUSD,
                yrCampaignPayments,
                currentExchangeRate,
                0
              );

              const yrRemHTG = (yrAdmissionBreakdown.isPaid ? 0 : yrAdmissionBreakdown.remainingHTG) +
                (yrTuitionBreakdown.isPaid ? 0 : yrTuitionBreakdown.remainingHTG) +
                (yrMiscBreakdown.isPaid ? 0 : yrMiscBreakdown.remainingHTG) +
                (yrCampaignsBreakdown.isPaid ? 0 : yrCampaignsBreakdown.remainingHTG);

              const yrRemUSD = (yrAdmissionBreakdown.isPaid ? 0 : yrAdmissionBreakdown.remainingUSD) +
                (yrTuitionBreakdown.isPaid ? 0 : yrTuitionBreakdown.remainingUSD) +
                (yrMiscBreakdown.isPaid ? 0 : yrMiscBreakdown.remainingUSD) +
                (yrCampaignsBreakdown.isPaid ? 0 : yrCampaignsBreakdown.remainingUSD);

              calculatedGlobalDebtHTG += yrRemHTG;
              calculatedGlobalDebtUSD += yrRemUSD;
              calculatedGlobalDebt += (yrRemHTG + Math.round(yrRemUSD * currentExchangeRate));
            }
          }

          globalDebt = calculatedGlobalDebt;
          globalDebtHTG = calculatedGlobalDebtHTG;
          globalDebtUSD = calculatedGlobalDebtUSD;
        } catch (err) {
          console.warn("Failed to calculate frontend global debt:", err);
          globalDebt = totalBalance;
          globalDebtHTG = remainingHTG;
          globalDebtUSD = remainingUSD;
        }
      } else {
        // For FUTURE status years, global debt is reset to 0 (Compte Soldé) as requested by the user
        globalDebt = 0;
        globalDebtHTG = 0;
        globalDebtUSD = 0;
      }

      // Ensure global debt is at least the current selected year's balance to remain consistent (unless it's a FUTURE year)
      if (yearStatus !== 'FUTURE') {
        globalDebt = Math.max(globalDebt, remainingHTGEquiv);
        if (remainingHTG > globalDebtHTG) globalDebtHTG = remainingHTG;
        if (remainingUSD > globalDebtUSD) globalDebtUSD = remainingUSD;
      }

      const studentFormatted = formatStudentName(student.last_name, student.first_name);

      setSelectedStudent({
        ...student,
        last_name: studentFormatted.lastName,
        first_name: studentFormatted.firstName,
        fullName: studentFormatted.fullName,
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
        totalDueHTG,
        totalDueUSD,
        totalPaidHTG: paidDirectHTG,
        totalPaidUSD: paidDirectUSD,
        globalDebt,
        globalDebtHTG,
        globalDebtUSD,
        paid: totalPaid,
        remainingHTG,
        remainingUSD,
        remainingHTGEquiv,
        isFullySettled,
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
        admissionBreakdown,
        tuitionBreakdown,
        miscBreakdown,
        campaignsBreakdown,
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

  const balance = selectedStudent 
    ? (selectedStudent.isFullySettled ? 0 : (selectedStudent.remainingHTGEquiv ?? Math.max(0, selectedStudent.totalDue - selectedStudent.paid)))
    : 0;
  const recoveryRate = selectedStudent ? Math.min(100, (selectedStudent.paid / selectedStudent.totalDue) * 100) : 0;

  // Calcul mathématique et ergonomique de la pagination du Relevé de Compte
  // Rythme visuel compact : Page 1 accueille les en-têtes, identités, engagements et jusqu'à 6 versements
  const MAX_PAYMENTS_PAGE_1 = 6;
  const MAX_PAYMENTS_SUBSEQUENT_PAGE = 12;

  const validPayments = useMemo(() => {
    return studentHistory.filter(
      p => p.status !== 'ANNULE' && !p.payment_method?.includes('REJETÉ')
    );
  }, [studentHistory]);

  const relevePages = useMemo(() => {
    if (!selectedStudent) return [];

    if (validPayments.length <= MAX_PAYMENTS_PAGE_1) {
      return [{
        pageNumber: 1,
        totalPages: 1,
        isFirstPage: true,
        isLastPage: true,
        showCommitments: true,
        showFinalBalance: true,
        payments: validPayments,
      }];
    }

    const pages: Array<{
      pageNumber: number;
      isFirstPage: boolean;
      isLastPage: boolean;
      showCommitments: boolean;
      showFinalBalance: boolean;
      payments: any[];
    }> = [];

    // Page 1
    pages.push({
      pageNumber: 1,
      isFirstPage: true,
      isLastPage: false,
      showCommitments: true,
      showFinalBalance: false,
      payments: validPayments.slice(0, MAX_PAYMENTS_PAGE_1),
    });

    let remaining = validPayments.slice(MAX_PAYMENTS_PAGE_1);
    let currentPageNum = 2;

    while (remaining.length > 0) {
      const canFitWithBalance = remaining.length <= 8;
      const chunkSize = canFitWithBalance ? remaining.length : MAX_PAYMENTS_SUBSEQUENT_PAGE;
      const currentChunk = remaining.slice(0, chunkSize);
      remaining = remaining.slice(chunkSize);
      const isLast = remaining.length === 0;

      pages.push({
        pageNumber: currentPageNum,
        isFirstPage: false,
        isLastPage: isLast,
        showCommitments: false,
        showFinalBalance: isLast,
        payments: currentChunk,
      });
      currentPageNum++;
    }

    const total = pages.length;
    return pages.map(p => ({ ...p, totalPages: total }));
  }, [validPayments, selectedStudent]);

  const exportToPDF = async () => {
    if (!selectedStudent) return;
    setIsExporting(true);
    try {
      const pageElements = document.querySelectorAll<HTMLElement>('.releve-page-sheet');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      if (pageElements && pageElements.length > 0) {
        for (let i = 0; i < pageElements.length; i++) {
          const el = pageElements[i];
          if (i > 0) pdf.addPage();

          const originalWidth = el.style.width;
          el.style.width = '800px';

          await new Promise(resolve => setTimeout(resolve, 150));

          const canvas = await html2canvas(el, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            windowWidth: 800,
            imageTimeout: 30000,
            onclone: (clonedDoc) => {
              fixOklchForCanvas(clonedDoc);
            }
          });

          el.style.width = originalWidth;
          const imgData = canvas.toDataURL('image/png');
          pdf.addImage(imgData, 'PNG', 0, 0, 210, 297);
        }
      } else {
        const element = document.getElementById('releve-compte-print');
        if (!element) return;
        const canvas = await html2canvas(element, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          windowWidth: 800,
          onclone: (clonedDoc) => fixOklchForCanvas(clonedDoc)
        });
        const imgData = canvas.toDataURL('image/png');
        pdf.addImage(imgData, 'PNG', 0, 0, 210, 297);
      }

      addSecurityWatermark(pdf, { user, ipAddress });
      const studentName = formatStudentName(selectedStudent.last_name, selectedStudent.first_name).fullName.replace(/\s+/g, '_');
      pdf.save(`Releve_Compte_${studentName}.pdf`);
      toast.success("Relevé de compte exporté en PDF avec succès");
    } catch (error) {
      console.error("Erreur export PDF:", error);
      toast.error("Erreur lors de l'exportation du PDF");
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
                <div className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 ${!selectedStudent.isFullySettled ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                  <span className="h-2 w-2 rounded-full bg-current"></span>
                  {selectedStudent.isFullySettled ? 'Compte Soldé' : (
                    selectedStudent.remainingUSD > 0 && selectedStudent.remainingHTG > 0
                      ? `Solde Débiteur: ${selectedStudent.remainingHTG.toLocaleString()} G + $${selectedStudent.remainingUSD.toFixed(2)} USD`
                      : selectedStudent.remainingUSD > 0
                      ? `Solde Débiteur: $${selectedStudent.remainingUSD.toFixed(2)} USD (≈ ${selectedStudent.remainingHTGEquiv.toLocaleString()} G)`
                      : `Solde Débiteur: ${selectedStudent.remainingHTG.toLocaleString()} G`
                  )}
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

                  // Vérifier si le frais sous-jacent a été expressément planifié en devises (USD)
                  const isTuitionFee = t.fee_type === 'SCOLARITE' || (!t.fee_type && (!t.nature || t.nature === 'SCOLARITE' || t.nature === 'Scolarité'));
                  const isAdmissionFee = t.fee_type === 'INSCRIPTION' || t.nature === 'INSCRIPTION' || t.nature === "Frais d'inscription";
                  const isMiscFee = t.fee_type === 'DIVERS' || t.nature?.toLowerCase().includes('divers');
                  const isTuitionPlannedInUSD = Boolean(isTuitionFee && ((selectedStudent?.scolariteUSD || 0) > 0 || (selectedStudent?.plan?.tuition_fee_usd || 0) > 0));
                  const isAdmissionPlannedInUSD = Boolean(isAdmissionFee && ((selectedStudent?.inscriptionUSD || 0) > 0 || (selectedStudent?.plan?.inscription_fee_usd || 0) > 0));
                  const isMiscPlannedInUSD = Boolean(isMiscFee && (selectedStudent?.miscNativeUSD || 0) > 0);
                  const isCampaignPlannedInUSD = Boolean(t.campaign?.currency === 'USD');
                  const isFeePlannedInUSD = isTuitionPlannedInUSD || isAdmissionPlannedInUSD || isMiscPlannedInUSD || isCampaignPlannedInUSD;

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
                              <span className="text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded inline-block shadow-2xs">
                                ${paidAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} USD
                              </span>
                            ) : (
                              <span className="text-slate-800">
                                {paidAmount.toLocaleString()} HTG
                              </span>
                            )}
                          </div>
                          {isUSD ? (
                            <div className="mt-1 space-y-1">
                              <div className="text-[10px] text-amber-950 font-mono font-bold flex items-center gap-1.5 bg-gradient-to-r from-amber-50 to-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-md w-fit shadow-2xs">
                                <ShieldCheck size={12} className="text-amber-700 shrink-0" />
                                <span>1 USD = {appliedRate} HTG</span>
                              </div>
                              <div className="text-[9px] font-black text-amber-800 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                                <span>Audit certifié : ${paidAmount} × {appliedRate} = {baseHTG.toLocaleString()} G</span>
                              </div>
                            </div>
                          ) : isFeePlannedInUSD ? (
                            <div className="text-[10px] text-blue-800 font-mono mt-1 flex items-center gap-1 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded w-fit">
                              <ArrowRightLeft size={10} className="text-blue-600 shrink-0" />
                              <span>1 USD = {appliedRate} HTG (Barème)</span>
                            </div>
                          ) : (
                            <div className="text-[10px] text-slate-500 font-medium mt-1 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0"></span>
                              <span>N/A (Frais 100% HTG direct)</span>
                            </div>
                          )}
                        </div>

                        <div className="text-right">
                          <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Valeur HTG</div>
                          <div className="flex items-center justify-end gap-1.5 mt-0.5">
                            <span className="text-sm font-black text-slate-900 font-mono">
                              {baseHTG.toLocaleString()} G
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                if (activeTooltip?.id === t.id) {
                                  setActiveTooltip(null);
                                } else {
                                  openTooltip(e, t);
                                }
                              }}
                              className={`p-1 rounded-full transition-colors cursor-pointer ${
                                activeTooltip?.id === t.id 
                                  ? 'text-indigo-600 bg-indigo-100 ring-2 ring-indigo-400' 
                                  : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'
                              }`}
                              aria-label="Consulter le décompte financier détaillé"
                            >
                              <Info size={14} />
                            </button>
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
                    {studentHistory.map((t, idx) => {
                      const isUSD = t.currency === 'USD';
                      const paidAmount = Number(t.amount || 0);
                      const appliedRate = Number(t.exchange_rate_applied || selectedStudent?.exchangeRate || 140);
                      const baseHTG = Number(t.amount_htg_equivalent || (isUSD ? paidAmount * appliedRate : paidAmount));

                      // Vérifier si le frais sous-jacent a été expressément planifié en devises (USD)
                      const isTuitionFee = t.fee_type === 'SCOLARITE' || (!t.fee_type && (!t.nature || t.nature === 'SCOLARITE' || t.nature === 'Scolarité'));
                      const isAdmissionFee = t.fee_type === 'INSCRIPTION' || t.nature === 'INSCRIPTION' || t.nature === "Frais d'inscription";
                      const isMiscFee = t.fee_type === 'DIVERS' || t.nature?.toLowerCase().includes('divers');
                      const isTuitionPlannedInUSD = Boolean(isTuitionFee && ((selectedStudent?.scolariteUSD || 0) > 0 || (selectedStudent?.plan?.tuition_fee_usd || 0) > 0));
                      const isAdmissionPlannedInUSD = Boolean(isAdmissionFee && ((selectedStudent?.inscriptionUSD || 0) > 0 || (selectedStudent?.plan?.inscription_fee_usd || 0) > 0));
                      const isMiscPlannedInUSD = Boolean(isMiscFee && (selectedStudent?.miscNativeUSD || 0) > 0);
                      const isCampaignPlannedInUSD = Boolean(t.campaign?.currency === 'USD');
                      const isFeePlannedInUSD = isTuitionPlannedInUSD || isAdmissionPlannedInUSD || isMiscPlannedInUSD || isCampaignPlannedInUSD;

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
                              <div className="flex flex-col items-end">
                                <span className="text-emerald-900 bg-emerald-50 border border-emerald-300 px-2.5 py-1 rounded-md text-xs whitespace-nowrap inline-flex items-center gap-1 font-mono font-bold shadow-2xs">
                                  <span className="text-emerald-700 font-bold">$</span>
                                  {paidAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} USD
                                </span>
                                <span className="text-[10px] text-amber-800 font-mono font-medium mt-1 flex items-center gap-1 bg-amber-50/90 border border-amber-200 px-1.5 py-0.5 rounded">
                                  <Coins size={10} className="text-amber-600 shrink-0" />
                                  × {appliedRate} G
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-800 text-xs whitespace-nowrap inline-block">
                                {paidAmount.toLocaleString()} HTG
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-center whitespace-nowrap">
                            {isUSD ? (
                              <div className="inline-flex flex-col items-center gap-1 py-0.5">
                                <div 
                                  className="inline-flex items-center gap-1.5 bg-gradient-to-r from-amber-50 via-amber-100/90 to-amber-50 text-amber-950 border border-amber-300 px-2.5 py-1 rounded-lg text-[11px] font-mono font-black whitespace-nowrap shadow-xs hover:border-amber-400 hover:shadow-sm transition-all cursor-help" 
                                  title={`🏛️ AUDIT FINANCIER & CONVERSION LÉGALE :\n• Devise d'encaissement : USD (Devise étrangère)\n• Montant brut encaissé : $${paidAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD\n• Taux de change légal scellé : 1 USD = ${appliedRate} HTG\n• Contrevaleur comptable créditée : ${baseHTG.toLocaleString()} HTG\n• Statut : Taux historique figé et certifié, irréversible pour l'audit financier`}
                                >
                                  <ShieldCheck size={14} className="text-amber-700 shrink-0" />
                                  <span className="text-amber-900 font-bold">1 USD =</span>
                                  <span className="text-amber-950 font-black px-1.5 py-0.2 bg-amber-200/80 rounded border border-amber-300 text-[11.5px]">{appliedRate} HTG</span>
                                </div>
                                <div className="inline-flex items-center gap-1 text-[9px] font-black text-amber-800 bg-amber-100/70 border border-amber-200/80 px-2 py-0.5 rounded-full tracking-tight">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 animate-pulse"></span>
                                  <span>Taux scellé • Audit certifié</span>
                                </div>
                              </div>
                            ) : isFeePlannedInUSD ? (
                              <div className="inline-flex flex-col items-center gap-0.5">
                                <span 
                                  className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-900 border border-blue-200 px-2.5 py-1 rounded-md text-[11px] font-mono font-bold whitespace-nowrap shadow-xs" 
                                  title={`Frais sous-jacent planifié en devises (USD), acquitté en Gourdes au barème : 1 USD = ${appliedRate} HTG`}
                                >
                                  <ArrowRightLeft size={12} className="text-blue-700 shrink-0" />
                                  <span>1 USD = {appliedRate} HTG</span>
                                </span>
                                <span className="text-[9px] font-bold text-blue-700 tracking-tight">
                                  Amortissement barème USD
                                </span>
                              </div>
                            ) : (
                              <div 
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-50 text-slate-600 border border-slate-200 text-[11px] font-medium whitespace-nowrap shadow-2xs"
                                title="Frais planifié en Gourdes et payé directement en Gourdes. Aucune conversion de devises requise."
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0"></span>
                                <span className="font-bold text-slate-700">N/A</span>
                                <span className="text-slate-400 text-[10px]">(Frais 100% HTG)</span>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-right font-semibold font-mono text-gray-900 whitespace-nowrap">
                            <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                              <div className="text-right">
                                <span className="text-sm font-black text-slate-900 whitespace-nowrap">
                                  {baseHTG.toLocaleString()} G
                                </span>
                                {isUSD && (
                                  <div className="text-[10px] text-emerald-800 font-mono font-bold flex items-center justify-end gap-1 mt-0.5" title="Détail du calcul certifié pour l'audit">
                                    <CheckCircle2 size={10} className="text-emerald-600 shrink-0" />
                                    <span>${paidAmount} × {appliedRate}</span>
                                  </div>
                                )}
                              </div>
                              
                              {/* Bouton déclencheur de l'infobulle financière sans coupure */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  if (activeTooltip?.id === t.id) {
                                    setActiveTooltip(null);
                                  } else {
                                    openTooltip(e, t);
                                  }
                                }}
                                className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                                  activeTooltip?.id === t.id
                                    ? 'text-indigo-600 bg-indigo-100 ring-2 ring-indigo-400'
                                    : isUSD
                                    ? 'text-amber-600 hover:text-amber-700 hover:bg-amber-50 ring-1 ring-amber-200'
                                    : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'
                                }`}
                                aria-label="Consulter le décompte financier détaillé et le statut d'acquittement"
                                title="Cliquer pour afficher le décompte des devises et statut d'acquittement"
                              >
                                <Info size={15} />
                              </button>
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
                      const soldeMsg = selectedStudent?.remainingUSD > 0 && selectedStudent?.remainingHTG > 0
                        ? `${selectedStudent.remainingHTG.toLocaleString()} HTG + $${selectedStudent.remainingUSD.toFixed(2)} USD`
                        : selectedStudent?.remainingUSD > 0
                        ? `$${selectedStudent.remainingUSD.toFixed(2)} USD (≈ ${selectedStudent.remainingHTGEquiv.toLocaleString()} HTG)`
                        : `${balance.toLocaleString()} HTG`;
                      const msg = `${schoolDetails?.name || 'École'}: Rappel de paiement pour ${selectedStudent.first_name}. Solde dû: ${soldeMsg}. Merci de régulariser au plus vite.`;
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

      {/* Relevé de Compte Modal - Format Moderne, Fluide, Compact & Multi-Pages (École Connectée) */}
      {printPreview && selectedStudent && (
        <div className="fixed inset-0 z-[1000] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-0 sm:p-3 md:p-6 print:static print:inset-auto print:bg-white print:backdrop-blur-none animate-in fade-in duration-200 overflow-hidden print:overflow-visible print:p-0 print:m-0">
          <div className="w-full h-full max-w-5xl flex flex-col bg-slate-100 sm:rounded-2xl shadow-2xl overflow-hidden border border-slate-200/80 print:max-w-none print:w-full print:h-auto print:block print:shadow-none print:bg-white print:rounded-none">
            
            {/* Header Toolbar Moderne & Compact */}
            <div className="px-3.5 sm:px-6 py-2.5 sm:py-3.5 border-b border-slate-200/90 flex items-center justify-between bg-white shrink-0 shadow-xs z-20">
              <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-indigo-50 to-indigo-100/80 text-indigo-600 flex items-center justify-center border border-indigo-200/60 shadow-xs shrink-0">
                  <Printer size={19} className="stroke-[2.2]" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base md:text-lg font-black text-slate-900 tracking-tight leading-tight truncate">
                    Aperçu du Relevé de Compte
                  </h3>
                  <p className="text-[10px] sm:text-xs text-slate-500 font-medium truncate">
                    Format officiel certifié • {schoolDetails?.name || 'École Connectée'}
                  </p>
                </div>
              </div>

              {/* Navigation de Pagination (si multi-pages) */}
              {relevePages.length > 1 && (
                <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 bg-slate-100/90 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700">
                  <Layers size={13} className="text-indigo-600 shrink-0" />
                  <span>Document {relevePages.length} Pages</span>
                  <span className="text-slate-300">|</span>
                  <div className="flex items-center gap-1">
                    {relevePages.map(page => (
                      <button 
                        key={page.pageNumber} 
                        onClick={() => document.getElementById(`releve-page-${page.pageNumber}`)?.scrollIntoView({ behavior: 'smooth' })} 
                        className="px-2 py-0.5 rounded text-[10px] font-bold bg-white hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 border border-slate-200 transition-all cursor-pointer"
                      >
                        Page {page.pageNumber}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions d'Export et Impression */}
              <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                <button 
                  onClick={exportToPDF}
                  disabled={isExporting}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 active:scale-95 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-sm shadow-emerald-600/20 transition-all cursor-pointer"
                >
                  {isExporting ? <RefreshCcw size={15} className="animate-spin" /> : <FileDown size={15} />}
                  <span className="hidden xs:inline">EXPORTER </span>PDF
                </button>
                <button 
                  onClick={() => window.print()}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-sm shadow-indigo-600/20 transition-all cursor-pointer"
                >
                  <Printer size={15} />
                  <span>IMPRIMER</span>
                </button>
                <button 
                  onClick={() => setPrintPreview(false)}
                  className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                  title="Fermer l'aperçu"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Corps Déroulant avec Rendu Multi-Pages A4 */}
            <div className="flex-1 p-2 sm:p-5 md:p-6 overflow-y-auto bg-slate-200/60 flex flex-col items-center">
              <div id="releve-compte-print" className="w-full flex flex-col items-center gap-5 sm:gap-6">
                {relevePages.map((pageData) => (
                  <React.Fragment key={pageData.pageNumber}>
                    <div
                      id={`releve-page-${pageData.pageNumber}`}
                      className="releve-page-sheet w-full max-w-[800px] min-h-[1050px] bg-white rounded-xl sm:rounded-2xl shadow-xl border border-slate-200/80 p-5 sm:p-7 md:p-8 flex flex-col justify-between relative print:shadow-none print:border-none print:m-0 print:p-0 print:w-full print:min-h-0 print:rounded-none"
                    >
                      {/* Filigrane décoratif d'arrière-plan */}
                      <div className="absolute top-0 right-0 w-48 h-48 bg-slate-50/70 rounded-full -mr-24 -mt-24 pointer-events-none opacity-40"></div>

                      <div className="relative z-10 flex-1 flex flex-col">
                        {/* En-tête : Page 1 = Grand En-tête Officiel ; Page 2+ = Sous-en-tête de suite */}
                        {pageData.isFirstPage ? (
                          <>
                            {/* En-tête Institutionnel & Certification */}
                            <div className="flex justify-between items-start mb-3 pb-3 border-b border-slate-100">
                              <div className="flex gap-3 sm:gap-4 items-center min-w-0">
                                {schoolDetails?.logo_url ? (
                                  <div className="w-14 h-14 sm:w-16 sm:h-16 bg-white rounded-xl shadow-2xs border border-slate-200/80 p-1.5 flex items-center justify-center overflow-hidden shrink-0">
                                    <img 
                                      src={schoolDetails.logo_url} 
                                      alt="Logo" 
                                      className="max-w-full max-h-full object-contain"
                                      referrerPolicy="no-referrer"
                                    />
                                  </div>
                                ) : (
                                  <div className="w-14 h-14 sm:w-16 sm:h-16 bg-indigo-600 rounded-xl flex items-center justify-center text-white text-2xl font-black shadow-xs shrink-0">
                                    {schoolDetails?.name?.substring(0, 1) || 'E'}
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <h1 className="text-base sm:text-lg md:text-xl font-black text-slate-900 uppercase tracking-tight leading-tight mb-1 truncate">
                                    {schoolDetails?.name || 'COLLÈGE DES INNOVATIONS'}
                                  </h1>
                                  <div className="space-y-0.5">
                                    <p className="text-[9px] sm:text-[9.5px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 truncate">
                                      <Target size={10} className="text-slate-400 shrink-0" />
                                      <span>{schoolDetails?.address || 'Port-au-Prince, Haïti'}</span>
                                    </p>
                                    <p className="text-[9px] sm:text-[9.5px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 truncate">
                                      <RefreshCcw size={10} className="text-slate-400 shrink-0" />
                                      <span>{schoolDetails?.phone} {schoolDetails?.email && `| ${schoolDetails.email}`}</span>
                                    </p>
                                  </div>
                                </div>
                              </div>

                              <div className="text-right shrink-0 pl-2">
                                <div className="inline-block px-2.5 py-1 bg-slate-900 text-white rounded-md text-[9px] font-black uppercase tracking-[0.18em] mb-1.5 shadow-xs">
                                  RELEVÉ DE COMPTE
                                </div>
                                <div className="space-y-0.5">
                                  <p className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider">Date d'émission</p>
                                  <p className="text-xs font-black text-slate-900 whitespace-nowrap">
                                    {new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                                  </p>
                                  <p className="text-[9px] font-mono font-bold text-slate-500">
                                    Réf: #ST-{selectedStudent.id.substring(0, 8).toUpperCase()}
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Cartes Informations Élève & Détails Scolaires (Compactes & Ergonomiques) */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-3">
                              {/* Carte Élève */}
                              <div className="p-3 bg-slate-50/90 rounded-xl border border-slate-200/70 relative overflow-hidden flex flex-col justify-between">
                                <div>
                                  <p className="text-[8.5px] font-black text-slate-400 uppercase tracking-[0.15em] mb-1 flex items-center gap-1">
                                    <User size={10} className="text-slate-400" /> Informations {terminology.student}
                                  </p>
                                  <p className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-tight leading-tight truncate">
                                    {selectedStudent.fullName}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 mt-1.5">
                                  <span className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[8.5px] font-black text-slate-500 uppercase tracking-wider">
                                    MATRICULE
                                  </span>
                                  <p className="text-xs font-bold text-slate-700 font-mono">
                                    {selectedStudent.id.substring(0, 8).toUpperCase()}
                                  </p>
                                </div>
                              </div>

                              {/* Carte Détails Scolaires */}
                              <div className="p-3 bg-slate-50/90 rounded-xl border border-slate-200/70 relative overflow-hidden flex flex-col justify-between">
                                <p className="text-[8.5px] font-black text-slate-400 uppercase tracking-[0.15em] mb-1 flex items-center gap-1">
                                  <BadgeCheck size={10} className="text-slate-400" /> Détails {terminology.tuition.includes('Académique') ? 'Académiques' : 'Scolaires'}
                                </p>
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <p className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider">{terminology.option} / Niveau</p>
                                    <p className="text-xs sm:text-sm font-black text-slate-900 truncate">{selectedStudent.classe || 'N/A'}</p>
                                  </div>
                                  <div>
                                    <p className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider">Année {terminology.academicYear.includes('Académique') ? 'Académique' : 'Scolaire'}</p>
                                    <p className="text-xs sm:text-sm font-black text-slate-900 truncate">{selectedStudent.academicYear || 'Session active'}</p>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Tableau 1 : Désignation des Frais & Engagements Financiers */}
                            <div className="mb-3 overflow-hidden rounded-xl border border-slate-200/80 shadow-2xs">
                              <table className="w-full border-collapse text-left">
                                <thead>
                                  <tr className="bg-slate-100/90 text-slate-600">
                                    <th className="py-2 px-3 text-[8.5px] font-black uppercase tracking-[0.15em]">Désignation des Frais</th>
                                    <th className="py-2 px-3 text-right text-[8.5px] font-black uppercase tracking-[0.15em]">Montant Exigé (HTG)</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-xs">
                                  <tr className="hover:bg-slate-50/40">
                                    <td className="py-1.5 px-3 font-semibold text-slate-700">Frais d'Inscription / Réinscription</td>
                                    <td className="py-1.5 px-3 text-right font-mono font-bold text-slate-900">{selectedStudent.inscriptionFee.toLocaleString()} HTG</td>
                                  </tr>
                                  <tr className="hover:bg-slate-50/40">
                                    <td className="py-1.5 px-3 font-semibold text-slate-700">Frais de Scolarité ({terminology.tuition})</td>
                                    <td className="py-1.5 px-3 text-right font-mono font-bold text-slate-900">{selectedStudent.tuitionFee.toLocaleString()} HTG</td>
                                  </tr>
                                  {selectedStudent.miscFee > 0 && (
                                    <tr className="hover:bg-slate-50/40">
                                      <td className="py-1.5 px-3 font-semibold text-slate-700">Frais Divers Obligatoires</td>
                                      <td className="py-1.5 px-3 text-right font-mono font-bold text-slate-900">{selectedStudent.miscFee.toLocaleString()} HTG</td>
                                    </tr>
                                  )}
                                  {selectedStudent.campaignsFee > 0 && (
                                    <tr className="hover:bg-slate-50/40">
                                      <td className="py-1.5 px-3 font-semibold text-slate-700">Frais d'Événements / Campagnes (Ad-Hoc)</td>
                                      <td className="py-1.5 px-3 text-right font-mono font-bold text-slate-900">{selectedStudent.campaignsFee.toLocaleString()} HTG</td>
                                    </tr>
                                  )}
                                  {selectedStudent.tuitionAddition > 0 && (
                                    <tr className="hover:bg-slate-50/40 bg-indigo-50/20">
                                      <td className="py-1.5 px-3 font-semibold text-slate-700">Ajustements (Ajouts)</td>
                                      <td className="py-1.5 px-3 text-right font-mono font-bold text-indigo-600">+{selectedStudent.tuitionAddition.toLocaleString()} HTG</td>
                                    </tr>
                                  )}
                                  {selectedStudent.totalDiscount > 0 && (
                                    <tr className="bg-rose-50/30">
                                      <td className="py-1.5 px-3 font-semibold italic text-rose-700">Réductions / Bourses Accordées</td>
                                      <td className="py-1.5 px-3 text-right font-mono font-bold text-rose-700">-{selectedStudent.totalDiscount.toLocaleString()} HTG</td>
                                    </tr>
                                  )}
                                </tbody>
                                <tfoot>
                                  <tr className="bg-slate-900 text-white">
                                    <td className="py-2 px-3 text-[9.5px] font-black uppercase tracking-[0.15em]">Total Engagement Session</td>
                                    <td className="py-2 px-3 text-right font-mono text-sm sm:text-base font-black tracking-tight">{selectedStudent.totalDue.toLocaleString()} HTG</td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          </>
                        ) : (
                          /* Sous-en-tête de suite pour Page 2+ */
                          <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-200">
                            <div className="flex items-center gap-2.5 min-w-0">
                              {schoolDetails?.logo_url ? (
                                <img src={schoolDetails.logo_url} alt="Logo" className="w-8 h-8 object-contain rounded-md" referrerPolicy="no-referrer" />
                              ) : (
                                <div className="w-8 h-8 rounded-md bg-indigo-600 text-white font-bold flex items-center justify-center text-xs">
                                  {schoolDetails?.name?.substring(0, 1) || 'E'}
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="text-xs font-black text-slate-900 uppercase truncate leading-tight">{schoolDetails?.name}</p>
                                <p className="text-[9.5px] font-semibold text-slate-500 truncate">
                                  Relevé de Compte (Suite) — <strong className="text-slate-800">{selectedStudent.fullName}</strong> ({selectedStudent.id.substring(0, 8).toUpperCase()}) • {selectedStudent.classe}
                                </p>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-[9px] font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                                Page {pageData.pageNumber} sur {pageData.totalPages}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Tableau 2 : Historique des Versements Effectués */}
                        <div className="mb-3">
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-1.5">
                              <History size={13} className="text-emerald-600 shrink-0" />
                              <p className="text-[8.5px] font-black text-slate-500 uppercase tracking-[0.15em]">
                                {pageData.isFirstPage ? 'Historique des Versements Effectués' : 'Versements Effectués (Suite)'}
                              </p>
                            </div>
                            <span className="text-[9px] font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                              {validPayments.length} opération{validPayments.length > 1 ? 's' : ''} au total
                            </span>
                          </div>

                          <div className="overflow-x-auto rounded-xl border border-slate-200/80">
                            <table className="w-full min-w-[580px] border-collapse text-left">
                              <thead>
                                <tr className="bg-slate-50/90 text-slate-500">
                                  <th className="py-2 px-2.5 text-[8px] font-bold uppercase tracking-wider whitespace-nowrap">Date</th>
                                  <th className="py-2 px-2.5 text-[8px] font-bold uppercase tracking-wider whitespace-nowrap">Réf Quittance</th>
                                  <th className="py-2 px-2.5 text-[8px] font-bold uppercase tracking-wider">Nature / Désignation</th>
                                  <th className="py-2 px-2.5 text-center text-[8px] font-bold uppercase tracking-wider whitespace-nowrap">Mode</th>
                                  <th className="py-2 px-2.5 text-center text-[8px] font-bold uppercase tracking-wider whitespace-nowrap">Taux Appliqué</th>
                                  <th className="py-2 px-2.5 text-right text-[8px] font-bold uppercase tracking-wider whitespace-nowrap">Montant Encaissé</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 text-xs">
                                {pageData.payments.map((p) => {
                                  const isUSD = p.currency === 'USD';
                                  const paidAmount = Number(p.amount || 0);
                                  const appliedRate = Number(p.exchange_rate_applied || selectedStudent?.exchangeRate || 140);
                                  const baseHTG = Number(p.amount_htg_equivalent || (isUSD ? paidAmount * appliedRate : paidAmount));
                                  const natureLabel = p.campaign?.name 
                                    ? `Campagne: ${p.campaign.name}` 
                                    : p.ad_hoc_campaign_id 
                                    ? 'Frais de Campagne' 
                                    : (p.fee_type === 'SCOLARITE' || (!p.fee_type && (!p.nature || p.nature === 'SCOLARITE' || p.nature === 'Scolarité'))) 
                                    ? terminology.tuition 
                                    : ((p.fee_type === 'INSCRIPTION' || p.nature === 'INSCRIPTION' || p.nature === "Frais d'inscription") 
                                    ? "Inscription" 
                                    : (p.nature || p.type || p.fee_type || 'Frais Divers'));

                                  return (
                                    <tr key={p.id} className="hover:bg-slate-50/40 transition-colors">
                                      <td className="py-1.5 px-2.5 text-[11px] font-medium text-slate-600 whitespace-nowrap">
                                        {new Date(p.created_at || p.date).toLocaleDateString('fr-FR')}
                                      </td>
                                      <td className="py-1.5 px-2.5 text-[11px] font-mono text-slate-500 font-bold whitespace-nowrap">
                                        RCP-{p.id.substring(0, 8).toUpperCase()}
                                      </td>
                                      <td className="py-1.5 px-2.5 text-[11px] font-bold text-slate-800">
                                        {natureLabel}
                                      </td>
                                      <td className="py-1.5 px-2.5 text-center text-[10px] text-slate-600 whitespace-nowrap">
                                        <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-medium">
                                          {p.payment_method || 'Cash'}
                                        </span>
                                      </td>
                                      <td className="py-1.5 px-2.5 text-center whitespace-nowrap">
                                        {isUSD ? (
                                          <span className="inline-flex items-center gap-1 font-mono font-bold text-[9px] text-amber-950 bg-amber-50 border border-amber-300 px-1.5 py-0.5 rounded">
                                            <ShieldCheck size={10} className="text-amber-700 shrink-0" />
                                            1 USD = {appliedRate} G
                                          </span>
                                        ) : (
                                          <span className="text-[9px] font-medium text-slate-500 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded">
                                            N/A (Frais 100% HTG)
                                          </span>
                                        )}
                                      </td>
                                      <td className="py-1.5 px-2.5 text-right font-mono whitespace-nowrap">
                                        {isUSD ? (
                                          <div>
                                            <span className="font-bold text-slate-900">${paidAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} USD</span>
                                            <div className="text-[9px] text-slate-400 font-mono font-normal">≈ {baseHTG.toLocaleString()} HTG</div>
                                          </div>
                                        ) : (
                                          <span className="font-bold text-slate-900">{baseHTG.toLocaleString()} HTG</span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                                {pageData.payments.length === 0 && (
                                  <tr>
                                    <td colSpan={6} className="py-6 text-center text-xs italic text-slate-400">
                                      Aucun versement enregistré pour cette période.
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>

                          {/* Note de continuation si multi-pages */}
                          {!pageData.isLastPage && (
                            <div className="mt-2 text-right">
                              <span className="inline-flex items-center gap-1 text-[9.5px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                                Suite des opérations sur la page {pageData.pageNumber + 1} ➔
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Bloc Solde Restant Dû & Signature de la Direction (Seulement sur la dernière page) */}
                        {pageData.showFinalBalance && (
                          <div className="mt-auto pt-3 border-t-2 border-slate-900">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 items-end">
                              {/* Carte Solde Restant Dû */}
                              <div className="space-y-1.5">
                                <div className="flex justify-between items-center px-1">
                                  <span className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider">Total Payé à ce jour</span>
                                  <span className="text-xs font-black text-emerald-600">
                                    {selectedStudent.totalPaidUSD > 0 && selectedStudent.totalPaidHTG > 0
                                      ? `${selectedStudent.totalPaidHTG.toLocaleString()} HTG + $${selectedStudent.totalPaidUSD.toFixed(2)} USD`
                                      : selectedStudent.totalPaidUSD > 0
                                      ? `$${selectedStudent.totalPaidUSD.toFixed(2)} USD (≈ ${selectedStudent.paid.toLocaleString()} HTG)`
                                      : `${selectedStudent.paid.toLocaleString()} HTG`}
                                  </span>
                                </div>

                                <div className="p-3 sm:p-3.5 rounded-xl bg-slate-900 text-white relative overflow-hidden shadow-xs">
                                  <div className="absolute top-0 right-0 p-3 opacity-10 pointer-events-none">
                                    <DollarSign size={40} className="text-white" />
                                  </div>
                                  <p className="text-[8px] font-black text-white/50 uppercase tracking-[0.18em] mb-1">
                                    Solde Restant Dû
                                  </p>

                                  {selectedStudent.isFullySettled ? (
                                    <div className="flex items-center gap-2 relative z-10">
                                      <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
                                      <div>
                                        <span className="text-xl font-black font-mono tracking-tight text-emerald-400 leading-none block">
                                          0 HTG
                                        </span>
                                        <span className="text-[9px] font-bold text-emerald-300/80 uppercase tracking-widest">
                                          Compte Entièrement Soldé
                                        </span>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="relative z-10">
                                      {selectedStudent.remainingUSD > 0 && selectedStudent.remainingHTG > 0 ? (
                                        <div>
                                          <div className="flex items-baseline gap-1">
                                            <span className="text-lg font-black font-mono tracking-tight text-white leading-tight">
                                              {selectedStudent.remainingHTG.toLocaleString()} <span className="text-xs text-white/60">HTG</span>
                                            </span>
                                            <span className="text-sm font-black font-mono text-emerald-400">
                                              + ${selectedStudent.remainingUSD.toFixed(2)} <span className="text-[10px] text-emerald-400/70">USD</span>
                                            </span>
                                          </div>
                                          <p className="text-[9px] text-white/60 font-mono mt-0.5">
                                            (Contre-valeur totale estimée: ≈ {selectedStudent.remainingHTGEquiv.toLocaleString()} HTG)
                                          </p>
                                        </div>
                                      ) : selectedStudent.remainingUSD > 0 ? (
                                        <div>
                                          <div className="flex items-baseline gap-1">
                                            <span className="text-xl font-black font-mono tracking-tight text-white leading-tight">
                                              ${selectedStudent.remainingUSD.toFixed(2)}
                                            </span>
                                            <span className="text-xs font-bold text-white/60 uppercase">USD</span>
                                          </div>
                                          <p className="text-[9px] text-white/60 font-mono mt-0.5">
                                            (≈ {selectedStudent.remainingHTGEquiv.toLocaleString()} HTG)
                                          </p>
                                        </div>
                                      ) : (
                                        <div className="flex items-baseline gap-1.5">
                                          <span className="text-xl font-black font-mono tracking-tight text-white leading-tight">
                                            {selectedStudent.remainingHTG.toLocaleString()}
                                          </span>
                                          <span className="text-xs font-bold text-white/60 uppercase">HTG</span>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Signature & Sceau Officiel de l'École */}
                              <div className="flex flex-col justify-end items-end text-right">
                                <p className="text-[8.5px] font-black text-slate-500 uppercase tracking-[0.15em] mb-1">
                                  {terminology.directionSignature || 'Signature & Sceau de la Direction'}
                                </p>
                                <div className="w-48 sm:w-56 h-12 border border-dashed border-slate-300 rounded-lg flex items-center justify-center bg-slate-50/50 mb-1 relative">
                                  <span className="text-[9px] text-slate-400 italic">Emplacement réservé au timbre & sceau</span>
                                </div>
                                <div className="w-48 sm:w-56 border-b-2 border-slate-900 mb-1"></div>
                                <p className="text-xs font-black text-slate-900 uppercase tracking-tight">
                                  {schoolDetails?.director_name || 'La Direction'}
                                </p>
                                <p className="text-[8px] font-bold text-indigo-600 uppercase tracking-wider">
                                  Document Officiel Vérifié • École Connectée
                                </p>
                              </div>
                            </div>

                            {/* Mention légale administrative */}
                            <div className="mt-3 pt-2 border-t border-slate-100 text-center">
                              <p className="text-[7.5px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                                Ce document est généré électroniquement par le système École Connectée et certifie l'état comptable de l'élève à la date indiquée.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Running Footer sur toutes les pages A4 */}
                      <div className="pt-2 mt-2 border-t border-slate-100 flex items-center justify-between text-[8px] font-mono text-slate-400 select-none">
                        <span>Système École Connectée • ID: {selectedStudent.id.substring(0, 8).toUpperCase()}</span>
                        <span className="font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          Page {pageData.pageNumber} sur {pageData.totalPages}
                        </span>
                        <span>Émis le {new Date().toLocaleDateString('fr-FR')}</span>
                      </div>
                    </div>

                    {/* Séparateur visuel de feuilles A4 (Visible uniquement à l'écran) */}
                    {!pageData.isLastPage && (
                      <div className="releve-page-divider flex items-center gap-3 w-full max-w-[800px] text-slate-400 py-1 print:hidden select-none">
                        <div className="flex-1 border-t border-dashed border-slate-300"></div>
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-white/90 px-3 py-1 rounded-full text-slate-600 border border-slate-300 shadow-2xs">
                          Saut de page A4 — Page {pageData.pageNumber + 1} sur {pageData.totalPages}
                        </span>
                        <div className="flex-1 border-t border-dashed border-slate-300"></div>
                      </div>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
          
          <style dangerouslySetInnerHTML={{ __html: `
            @page {
              size: A4 portrait;
              margin: 0;
            }
            @media print {
              body * { visibility: hidden; }
              .print\\:hidden { display: none !important; }
              .releve-page-divider { display: none !important; }
              .fixed.inset-0 { position: static !important; display: block !important; background: white !important; padding: 0 !important; }
              #releve-compte-print, #releve-compte-print * { visibility: visible !important; }
              #releve-compte-print {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
              }
              .releve-page-sheet {
                width: 210mm !important;
                max-width: 210mm !important;
                min-height: 297mm !important;
                padding: 12mm 15mm !important;
                margin: 0 auto !important;
                box-shadow: none !important;
                border: none !important;
                page-break-after: always !important;
                break-after: page !important;
                overflow: visible !important;
              }
              .releve-page-sheet:last-child {
                page-break-after: auto !important;
                break-after: auto !important;
              }
            }
          `}} />
        </div>
      )}

      {/* Infobulle Fixe Haute Précision (Anti-coupure / Immune aux overflows de tableaux) */}
      {activeTooltip && (
        <div 
          className="fixed inset-0 z-[1200] flex items-center justify-center sm:block p-3 sm:p-0 bg-slate-900/30 backdrop-blur-[1px]"
          onClick={() => setActiveTooltip(null)}
        >
          <div 
            className={`bg-slate-950 text-white rounded-2xl shadow-2xl p-5 border border-slate-700 animate-in fade-in zoom-in-95 duration-150 overflow-y-auto max-h-[88vh] text-left whitespace-normal select-text ${
              activeTooltip.isMobile
                ? 'w-full max-w-sm'
                : 'w-[390px] max-w-[calc(100vw-32px)] fixed z-[1201]'
            }`}
            style={!activeTooltip.isMobile ? {
              top: `${activeTooltip.top}px`,
              left: `${activeTooltip.left}px`,
            } : undefined}
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const t = activeTooltip.transaction;
              const isUSD = t.currency === 'USD';
              const paidAmount = Number(t.amount || 0);
              const appliedRate = Number(t.exchange_rate_applied || selectedStudent?.exchangeRate || 140);
              const currentRate = Number(selectedStudent?.exchangeRate || 140);
              const baseHTG = Number(t.amount_htg_equivalent || (isUSD ? paidAmount * appliedRate : paidAmount));
              
              const natureName = t.campaign?.name 
                ? `Campagne: ${t.campaign.name}` 
                : t.ad_hoc_campaign_id 
                ? 'Frais de Campagne' 
                : t.fee_type === 'SCOLARITE' || (!t.fee_type && (!t.nature || t.nature === 'SCOLARITE' || t.nature === 'Scolarité')) 
                ? 'Scolarité (Frais Académiques)' 
                : (t.fee_type === 'INSCRIPTION' || t.nature === 'INSCRIPTION' || t.nature === "Frais d'inscription") 
                ? 'Inscription / Admission' 
                : t.fee_type === 'DIVERS' 
                ? 'Frais Divers Obligatoires' 
                : (t.nature || t.type || t.fee_type || 'Frais Divers');

              // Identify associated fee category breakdown
              const isAdmission = t.fee_type === 'INSCRIPTION' || t.nature === 'INSCRIPTION' || t.nature === "Frais d'inscription";
              const isMisc = t.fee_type === 'DIVERS' || t.nature?.toLowerCase().includes('divers');
              const isCampaign = t.ad_hoc_campaign_id || t.fee_type === 'AD_HOC';
              const isTuitionFee = t.fee_type === 'SCOLARITE' || (!t.fee_type && (!t.nature || t.nature === 'SCOLARITE' || t.nature === 'Scolarité'));

              const isTuitionPlannedInUSD = Boolean(isTuitionFee && ((selectedStudent?.scolariteUSD || 0) > 0 || (selectedStudent?.plan?.tuition_fee_usd || 0) > 0));
              const isMiscPlannedInUSD = Boolean(isMisc && (selectedStudent?.miscNativeUSD || 0) > 0);
              const isCampaignPlannedInUSD = Boolean(t.campaign?.currency === 'USD');
              const isFeePlannedInUSD = isTuitionPlannedInUSD || isMiscPlannedInUSD || isCampaignPlannedInUSD;

              const associatedBreakdown = isCampaign
                ? selectedStudent?.campaignsBreakdown
                : isAdmission
                ? selectedStudent?.admissionBreakdown
                : isMisc
                ? selectedStudent?.miscBreakdown
                : selectedStudent?.tuitionBreakdown;

              const isFeeAcquitted = associatedBreakdown ? associatedBreakdown.isPaid : false;
              const remUSD = associatedBreakdown?.remainingUSD || 0;
              const remHTG = associatedBreakdown?.remainingHTG || 0;
              const remHTGEquiv = associatedBreakdown?.remainingHTGEquiv || 0;

              const rateDiff = currentRate - appliedRate;
              const hasRateVariance = isUSD && Math.abs(rateDiff) > 0.01;

              return (
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                    <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                      <ArrowRightLeft size={14} className="text-amber-400 shrink-0" /> Décompte & Statut d'Acquittement
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-slate-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-800 font-bold">
                        RCP-{t.id.substring(0,8).toUpperCase()}
                      </span>
                      <button 
                        type="button" 
                        onClick={() => setActiveTooltip(null)}
                        className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                        title="Fermer"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Statut d'acquittement immédiat du frais lié */}
                  <div className={`p-2.5 rounded-xl border flex items-start gap-2.5 ${
                    isFeeAcquitted
                      ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
                      : 'bg-amber-950/50 border-amber-500/40 text-amber-200'
                  }`}>
                    {isFeeAcquitted ? (
                      <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                    )}
                    <div className="text-xs leading-relaxed">
                      <div className="font-bold flex items-center gap-1.5">
                        <span>{isFeeAcquitted ? 'Frais Entièrement Acquitté (Soldé)' : 'Frais Non Soldé (Paiement Partiel)'}</span>
                      </div>
                      <p className="text-[11px] text-slate-300 mt-0.5">
                        {isFeeAcquitted ? (
                          'Ce frais est intégralement réglé. Les reliquats d\'écart de conversion en devises sont automatiquement absorbés sans dette résiduelle.'
                        ) : (
                          <>
                            Solde restant dû : <strong className="text-white font-mono">{remUSD > 0 && remHTG > 0 ? `${remHTG.toLocaleString()} HTG + $${remUSD.toFixed(2)} USD` : remUSD > 0 ? `$${remUSD.toFixed(2)} USD (≈ ${remHTGEquiv.toLocaleString()} HTG)` : `${remHTG.toLocaleString()} HTG`}</strong>
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between items-center text-slate-300">
                      <span className="text-slate-400">Rubrique de frais :</span>
                      <span className="font-semibold text-slate-100 text-right">{natureName}</span>
                    </div>

                    <div className="flex justify-between items-center text-slate-300">
                      <span className="text-slate-400">Montant versé :</span>
                      <span className="font-mono font-bold text-emerald-400">
                        {isUSD ? `$${paidAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} USD` : `${paidAmount.toLocaleString()} HTG`}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-slate-300">
                      <span className="text-slate-400">{isUSD ? 'Taux appliqué (historique scellé) :' : 'Taux de conversion :'}</span>
                      <span className="font-mono font-bold text-amber-300">
                        {isUSD ? (
                          `1 USD = ${appliedRate} HTG`
                        ) : isFeePlannedInUSD ? (
                          `1 USD = ${appliedRate} HTG (Barème USD)`
                        ) : (
                          <span className="text-slate-400 font-sans text-xs">Sans objet (Monnaie locale Gourdes)</span>
                        )}
                      </span>
                    </div>

                    {isUSD && (
                      <>
                        <div className="flex justify-between items-center text-slate-300 text-[11px]">
                          <span className="text-slate-400">Taux système actuel :</span>
                          <span className="font-mono text-slate-200">
                            1 USD = {currentRate} HTG
                          </span>
                        </div>

                        {/* Bloc Traçabilité & Audit Financier */}
                        <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-500/30 text-[11px] text-amber-200/90 space-y-1">
                          <div className="flex items-center gap-1.5 font-bold text-amber-300">
                            <ShieldCheck size={14} className="text-amber-400" />
                            <span>Audit Financier : Taux Scellé Garanti</span>
                          </div>
                          <div className="font-mono text-xs text-white">
                            {paidAmount.toFixed(2)} USD × {appliedRate} HTG = <strong className="text-amber-300">{baseHTG.toLocaleString()} HTG</strong>
                          </div>
                          <p className="text-[10px] text-slate-300">
                            Conversion scellée historiquement lors de la transaction pour garantir une transparence totale lors de l'audit financier.
                          </p>
                        </div>
                      </>
                    )}

                    {hasRateVariance && (
                      <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-300 space-y-1">
                        <div className="flex justify-between text-slate-400">
                          <span>Évolution du taux :</span>
                          <span className={`font-mono font-bold ${rateDiff > 0 ? 'text-amber-400' : 'text-cyan-400'}`}>
                            {rateDiff > 0 ? `+${rateDiff.toFixed(2)}` : rateDiff.toFixed(2)} HTG/USD
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 italic">
                          Grâce au journal des taux historiques, le solde dû reste stable et immunisé contre les fluctuations de taux.
                        </p>
                      </div>
                    )}

                    <div className="flex justify-between items-center text-slate-300 pt-1.5 border-t border-slate-800">
                      <span className="text-slate-400 font-bold">Valeur comptabilisée :</span>
                      <span className="font-mono font-black text-white">
                        {isUSD 
                          ? `${baseHTG.toLocaleString()} HTG` 
                          : `${baseHTG.toLocaleString()} HTG`}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-slate-300">
                      <span className="text-slate-400">Mode de paiement :</span>
                      <span className="font-semibold text-slate-200">
                        {t.status === 'ANNULE' ? 'Annulé' : (t.payment_method || 'Cash')}
                      </span>
                    </div>

                    <div className="text-[10px] text-slate-400 pt-2 border-t border-slate-800 flex justify-between items-center">
                      <span>Date de transaction :</span>
                      <span className="font-mono text-slate-300">{new Date(t.created_at).toLocaleString('fr-FR')}</span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentPaymentTracking;