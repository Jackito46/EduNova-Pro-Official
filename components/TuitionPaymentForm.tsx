import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FluidLoadingState, SkeletonTable } from './SkeletonLoader';
import { 
  CreditCard, 
  Save, 
  DollarSign,
  Search,
  CheckCircle2, 
  ArrowRight,
  ShieldCheck,
  Calculator,
  Zap,
  TrendingUp,
  Printer,
  RotateCcw,
  Loader2,
  RefreshCcw,
  ChevronDown,
  AlertCircle,
  ShieldAlert,
  History,
  AlertTriangle,
  PlusCircle,
  CalendarCheck,
  Banknote,
  Tags,
  Sparkles,
  Key,
  Lock,
  Wallet
} from 'lucide-react';
import { toast } from 'sonner';
import { formatStudentName } from '../utils/formatters';
import { supabase } from '../supabase';
import { useSchool } from '../contexts/SchoolContext';
import { AuditLogger } from '../utils/auditLogger';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';
import { UserProfile } from '../types';
import { RetryableError } from './RetryableError';
import { MonCashService } from '../services/moncashService';
import { isRestrictedBankDate, getLocalTodayString } from '../utils/dateUtils';
import { isCashDateLocked } from '../services/cashClosureService';
import { DailyCashClosureModal } from './DailyCashClosureModal';
import { tuitionPaymentSchema } from '../utils/validation';
import { getActiveSchoolPaymentMethods, getPaymentMethodConfig, PaymentMethodConfig } from '../lib/paymentMethods';
import { computeFeeCategoryBalance } from '../utils/financeCalculations';

const getReceiptFeeText = (
  feeType: string,
  selectedStudent: any,
  exchangeRate: number,
  field: 'due' | 'paid' | 'engagement' | 'reste' | 'solde',
  montantReel?: string,
  currency?: string,
  paymentLogic?: any
) => {
  if (!selectedStudent) return '';

  let nativeUSD = 0;
  if (feeType.startsWith('ADHOC_')) {
    const camp = selectedStudent.adHocCampaigns?.find((c: any) => c.id === feeType.replace('ADHOC_', ''));
    if (camp && camp.currency === 'USD') nativeUSD = camp.amount || 0;
  } else if (feeType === 'SCOLARITE') {
    nativeUSD = selectedStudent.scolariteUSD || 0;
  } else if (feeType === 'INSCRIPTION') {
    nativeUSD = selectedStudent.inscriptionUSD || 0;
  } else if (feeType === 'DIVERS') {
    nativeUSD = selectedStudent.miscUSD || 0;
  }

  let valHTG = 0;
  if (field === 'due' || field === 'engagement') {
    valHTG = feeType.startsWith('ADHOC_') ? 
      (selectedStudent.adHocCampaigns?.find((c: any) => c.id === feeType.replace('ADHOC_', ''))?.amount || 0) : 
      ((feeType === 'SCOLARITE' ? selectedStudent.scolariteDue : feeType === 'INSCRIPTION' ? selectedStudent.inscriptionGross : selectedStudent.miscGross) || 0);
  } else if (field === 'paid') {
    valHTG = feeType.startsWith('ADHOC_') ? 
      (selectedStudent.adHocCampaigns?.find((c: any) => c.id === feeType.replace('ADHOC_', ''))?.paid || 0) : 
      ((feeType === 'SCOLARITE' ? selectedStudent.scolaritePaid : feeType === 'INSCRIPTION' ? selectedStudent.inscriptionPaid : selectedStudent.miscPaid) || 0);
  } else if (field === 'reste') {
    const resteTotal = paymentLogic?.resteTotal || 0;
    const paidNowHTG = currency === 'USD' ? parseFloat(montantReel || '0') * exchangeRate : parseFloat(montantReel || '0');
    valHTG = Math.max(0, resteTotal - paidNowHTG);
  } else if (field === 'solde') {
    const paidNowHTG = currency === 'USD' ? parseFloat(montantReel || '0') * exchangeRate : parseFloat(montantReel || '0');
    valHTG = Math.max(0, (selectedStudent.totalDue || 0) - (selectedStudent.paid || 0) - paidNowHTG);
  }

  const baseText = `${Math.round(valHTG).toLocaleString()} G`;
  if (nativeUSD > 0 && field !== 'solde') {
    if (field === 'reste' && paymentLogic?.resteUSD !== undefined) {
      const paidUSD = currency === 'USD' ? parseFloat(montantReel || '0') : (parseFloat(montantReel || '0') / exchangeRate);
      const remUSD = Math.max(0, paymentLogic.resteUSD - paidUSD);
      return `$${remUSD.toFixed(2)} USD (${baseText})`;
    }
    return `${baseText} (≈ $${(valHTG / exchangeRate).toFixed(2)} USD)`;
  }
  return baseText;
};

const TuitionPaymentForm: React.FC<{ user: UserProfile }> = ({ user }) => {
  const { terminology, currentCampusId, campuses, school } = useSchool();
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [studentSearch, setStudentSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [montantReel, setMontantReel] = useState<string>('');
  const [isLocked, setIsLocked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [transactionRef, setTransactionRef] = useState('');
  const [apiError, setApiError] = useState<string | null>(null);
  
  const [activeYear, setActiveYear] = useState<any>(null);
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [targetYearId, setTargetYearId] = useState<string>('');
  const [globalDebt, setGlobalDebt] = useState<number>(0);
  const [loadingDebt, setLoadingDebt] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [schoolDetails, setSchoolDetails] = useState<any>(null);
  const [cashierName, setCashierName] = useState<string>('');

  // Nouveaux états pour le multi-devises et types de frais
  const [currency, setCurrency] = useState<'HTG' | 'USD'>('HTG');
  const [feeType, setFeeType] = useState<string>('SCOLARITE');
  const [paymentMethod, setPaymentMethod] = useState<string>('Dépôt Bancaire');
  const [bankName, setBankName] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [depositDate, setDepositDate] = useState(getLocalTodayString());
  const [currentExchangeRate, setCurrentExchangeRate] = useState<number>(132.50);
  const [refError, setRefError] = useState<string | null>(null);
  const [isCheckingRef, setIsCheckingRef] = useState(false);

  // Méthodes de paiement dynamiques configurées par l'administration
  const activePaymentMethods = useMemo(() => {
    return getActiveSchoolPaymentMethods(schoolDetails || school);
  }, [schoolDetails, school]);

  const currentMethodConfig = useMemo(() => {
    return getPaymentMethodConfig(paymentMethod, schoolDetails || school);
  }, [paymentMethod, schoolDetails, school]);

  // Synchroniser la méthode par défaut si celle sélectionnée est désactivée
  useEffect(() => {
    if (activePaymentMethods.length > 0 && !activePaymentMethods.some(m => m.code === paymentMethod)) {
      setPaymentMethod(activePaymentMethods[0].code);
    }
  }, [activePaymentMethods, paymentMethod]);

  // Double-validation pour transactions sensibles du portefeuille (Wallet)
  const [showSuperiorAuthModal, setShowSuperiorAuthModal] = useState(false);
  const [superiorEmail, setSuperiorEmail] = useState('');
  const [superiorPassword, setSuperiorPassword] = useState('');
  const [isValidatingSuperior, setIsValidatingSuperior] = useState(false);
  const [superiorAuthError, setSuperiorAuthError] = useState<string | null>(null);
  const [authorizedSuperiorName, setAuthorizedSuperiorName] = useState<string | null>(null);
  const [isClosureModalOpen, setIsClosureModalOpen] = useState(false);

  const isSuperior = user?.is_super_admin || ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'DIRECTOR'].includes(user?.role);

  const hasUnsavedChanges = (!!selectedStudent || !!montantReel || !!referenceNumber) && !showReceipt;
  useUnsavedChanges(hasUnsavedChanges);

  // Vérification de la référence en temps réel
  const verifyReference = async (ref: string, currentBank: string = '') => {
    const requiresRef = currentMethodConfig?.requires_reference ?? (paymentMethod === 'Chèque' || paymentMethod === 'Dépôt Bancaire' || paymentMethod === 'MonCash');
    if (!ref || !user?.school_id || !requiresRef) {
      setRefError(null);
      return;
    }
    setIsCheckingRef(true);
    try {
      let paymentsQuery = supabase
        .from('payments')
        .select('id')
        .eq('school_id', user.school_id)
        .eq('reference_number', ref);

      const requiresBank = currentMethodConfig?.requires_bank ?? (paymentMethod === 'Chèque' || paymentMethod === 'Dépôt Bancaire');
      if (requiresBank && currentBank) {
        paymentsQuery = paymentsQuery.eq('bank_name', currentBank);
      }

      const { data, error } = await paymentsQuery.limit(1);
      
      if (error) {
        console.error("verifyReference error (payments):", error);
      }

      if (data && data.length > 0) {
        setRefError(`Ce numéro de ${paymentMethod === 'Chèque' ? 'chèque' : paymentMethod === 'MonCash' ? 'transaction' : 'bordereau / référence'} existe déjà pour cette banque.`);
      } else {
        let supplyQuery = supabase
          .from('school_supplies')
          .select('id')
          .eq('school_id', user.school_id)
          .eq('reference_number', ref);
          
        if (requiresBank && currentBank) {
          supplyQuery = supplyQuery.eq('bank_name', currentBank);
        }

        const { data: supplyData, error: supplyError } = await supplyQuery.limit(1);
          
        if (supplyError) {
          console.error("verifyReference error (supplies):", supplyError);
        }

        if (supplyData && supplyData.length > 0) {
          setRefError(`Ce numéro de ${paymentMethod === 'Chèque' ? 'chèque' : paymentMethod === 'MonCash' ? 'transaction' : 'bordereau / référence'} existe déjà (Boutique) pour cette banque.`);
        } else {
          setRefError(null);
        }
      }
    } catch (e: any) {
      console.error("verifyReference error:", e);
      // alert if column not found
      if(e?.message) toast.error("Verif Error: " + e.message);
    } finally {
      setIsCheckingRef(false);
    }
  };

  // Handle fee type change to enforce currency rules
  const handleFeeTypeChange = (newFeeType: string) => {
    setFeeType(newFeeType);
    
    // Automatically set currency based on the fee type's native plan currency
    if (selectedStudent) {
      let planCur: 'HTG' | 'USD' = 'HTG';
      if (newFeeType.startsWith('ADHOC_')) {
        const campaignId = newFeeType.replace('ADHOC_', '');
        const campaign = selectedStudent.adHocCampaigns?.find((c: any) => c.id === campaignId);
        planCur = campaign?.currency === 'USD' ? 'USD' : 'HTG';
      } else if (newFeeType === 'INSCRIPTION') {
        planCur = ((selectedStudent.inscriptionUSD || 0) > 0 && (selectedStudent.inscriptionNativeHTG || 0) === 0) ? 'USD' : 'HTG';
      } else if (newFeeType === 'DIVERS') {
        planCur = ((selectedStudent.miscUSD || 0) > 0 && (selectedStudent.miscNativeHTG || 0) === 0) ? 'USD' : 'HTG';
      } else if (newFeeType === 'SCOLARITE') {
        planCur = ((selectedStudent.scolariteUSD || 0) > 0 && Number(selectedStudent.plan?.tuition_fee || 0) === 0) ? 'USD' : 'HTG';
      }
      
      if (paymentMethod === 'MonCash') {
        setCurrency('HTG');
      } else {
        setCurrency(planCur);
      }
    }
  };

  // Set initial currency when student or fee type changes based on plan rules
  useEffect(() => {
    if (selectedStudent) {
      let planCur: 'HTG' | 'USD' = 'HTG';
      if (feeType.startsWith('ADHOC_')) {
        const campaignId = feeType.replace('ADHOC_', '');
        const campaign = selectedStudent.adHocCampaigns?.find((c: any) => c.id === campaignId);
        planCur = campaign?.currency === 'USD' ? 'USD' : 'HTG';
      } else if (feeType === 'INSCRIPTION') {
        planCur = ((selectedStudent.inscriptionUSD || 0) > 0 && (selectedStudent.inscriptionNativeHTG || 0) === 0) ? 'USD' : 'HTG';
      } else if (feeType === 'DIVERS') {
        planCur = ((selectedStudent.miscUSD || 0) > 0 && (selectedStudent.miscNativeHTG || 0) === 0) ? 'USD' : 'HTG';
      } else if (feeType === 'SCOLARITE') {
        planCur = ((selectedStudent.scolariteUSD || 0) > 0 && Number(selectedStudent.plan?.tuition_fee || 0) === 0) ? 'USD' : 'HTG';
      }
      
      if (paymentMethod === 'MonCash') {
        setCurrency('HTG');
      } else {
        setCurrency(planCur);
      }
    }
  }, [selectedStudent?.id, feeType]); // Trigger on student load or explicit feeType change from auto-select

  // Handle payment method change to enforce currency rules
  const handlePaymentMethodChange = (newMethod: string) => {
    setPaymentMethod(newMethod);
    setBankName('');
    setReferenceNumber('');
    setDepositDate(getLocalTodayString());
    const cfg = getPaymentMethodConfig(newMethod, schoolDetails || school);
    if (cfg?.supported_currencies && cfg.supported_currencies.length === 1) {
      setCurrency(cfg.supported_currencies[0]);
    } else if (newMethod === 'MonCash') {
      setCurrency('HTG'); // MonCash is HTG only
    }
  };

  const getActiveFeeTypeCurrency = (): 'HTG' | 'USD' => {
    if (!selectedStudent) return 'HTG';
    if (feeType.startsWith('ADHOC_')) {
      const campaignId = feeType.replace('ADHOC_', '');
      const campaign = selectedStudent.adHocCampaigns?.find((c: any) => c.id === campaignId);
      return campaign?.currency === 'USD' ? 'USD' : 'HTG';
    } else if (feeType === 'INSCRIPTION') {
      return (selectedStudent.inscriptionUSD > 0) ? 'USD' : 'HTG';
    } else if (feeType === 'DIVERS') {
      return (selectedStudent.miscUSD > 0) ? 'USD' : 'HTG';
    } else {
      return (selectedStudent.scolariteUSD > 0) ? 'USD' : 'HTG';
    }
  };

  // 1. CHARGEMENT DU CONTEXTE UTILISATEUR & SESSION
  useEffect(() => {
    const fetchContext = async () => {
      try {
        setLoading(true);
        if (!user?.school_id) {
          setLoading(false);
          return;
        }

        setCashierName(user.full_name || '');

        const { data: schoolData } = await supabase.from('schools').select('name, address, phone, logo_url, global_settings').eq('id', user.school_id).single();
        if (schoolData) setSchoolDetails(schoolData);

        // Fetch exchange rate
        try {
          const { data: rateData, error: rateError } = await supabase
            .from('exchange_rates')
            .select('*')
            .eq('school_id', user.school_id);
          
          if (rateError) {
            console.error("Erreur chargement taux de change:", rateError);
          } else if (rateData && rateData.length > 0) {
            rateData.sort((a, b) => {
              const dateA = new Date(a.effective_date || a.created_at || 0).getTime();
              const dateB = new Date(b.effective_date || b.created_at || 0).getTime();
              return dateB - dateA;
            });
            setCurrentExchangeRate(rateData[0].rate_usd_to_htg || rateData[0].rate || 132.50);
          }
        } catch (e) {
          console.error("Exception taux de change:", e);
        }

        const { data: years, error: yearsError } = await supabase
          .from('academic_years')
          .select('*')
          .eq('school_id', user.school_id)
          .order('label', { ascending: false });
        
        if (yearsError) console.error("Erreur chargement années académiques:", yearsError);

        if (years) {
          const filtered = years.filter(y => y.status === 'ACTIVE' || y.status === 'FUTURE' || y.is_active);
          const finalYears = filtered.length > 0 ? filtered : years;
          setAcademicYears(finalYears);
          const active = finalYears.find(y => y.status === 'ACTIVE' || y.is_active) || finalYears[0];
          setActiveYear(active);
          
          const requestedYearId = location.state?.academicYearId;
          if (requestedYearId && finalYears.some(y => y.id === requestedYearId)) {
            setTargetYearId(requestedYearId);
          } else if (active) {
            setTargetYearId(active.id);
          }
        }
      } catch (err) {
        console.error("Context load error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchContext();
  }, [user]);

  // 2. MOTEUR DE RECHERCHE ÉTUDIANTS
  useEffect(() => {
    const search = async () => {
      if (studentSearch.length < 2 || !user?.school_id) {
        setSearchResults([]);
        return;
      }
      setIsSearching(true);
      try {
        const { data, error } = await supabase.rpc('search_students_accent_insensitive', {
          p_school_id: user.school_id,
          p_query: studentSearch,
          p_limit: 15,
          p_campus_id: user.campus_id || currentCampusId || null
        });

        if (error) {
          console.error("Search error:", error);
          return;
        }

        // Map RPC results to match expected structure if necessary
        let mappedData = data?.map((s: any) => {
          const formatted = formatStudentName(s.last_name, s.first_name);
          return {
            ...s,
            last_name: formatted.lastName,
            first_name: formatted.firstName,
            fullName: formatted.fullName,
            class: s.class_name ? { name: s.class_name } : null
          };
        });

        if (currentCampusId) { mappedData = (mappedData || []).filter((s: any) => s.campus_id === currentCampusId); } setSearchResults(mappedData || []);
      } finally {
        setIsSearching(false);
      }
    };
    const timer = setTimeout(search, 300);
    return () => clearTimeout(timer);
  }, [studentSearch, user?.school_id, currentCampusId]);

  // 3. AUDIT GLOBAL DES DETTES (Verrouillage Administratif)
  const auditGlobalSolvency = useCallback(async (studentId: string, excludeYearId?: string) => {
    setLoadingDebt(true);
    try {
      const { data: realDebt, error } = await supabase.rpc('get_student_global_debt', { 
        p_student_id: studentId,
        p_exclude_year_id: excludeYearId,
        p_school_id: user?.school_id
      });
      if (error) throw error;
      setGlobalDebt(Number(realDebt || 0));
    } catch (err) {
      console.error("Erreur Audit Solvabilité:", err);
    } finally {
      setLoadingDebt(false);
    }
  }, [user?.school_id]);

  const loadStudentDetails = useCallback(async (studentId: string, yearId: string) => {
    if (!yearId) return;
    setLoadingDebt(true);
    try {
      const { data } = await supabase
        .from('students')
        .select('*, class:classes(id, name, level, campus_id)')
        .eq('school_id', user.school_id)
        .eq('id', studentId)
        .single();
      
      if (data) {
        const formatted = formatStudentName(data.last_name, data.first_name);
        // 1. Essayer de trouver la classe via enrollments pour l'année cible et vérifier les autres inscriptions de l'élève
        let enrollment = null;
        let otherEnrollments: any[] = [];
        let allEnrollments: any[] = [];
        try {
          const { data: allEnrollmentsData } = await supabase
            .from('enrollments')
            .select('class_id, academic_year_id, tuition_discount, tuition_addition, class:classes(id, name, level, campus_id), academic_year:academic_years(id, label, status)')
            .eq('school_id', user.school_id)
            .eq('student_id', studentId);
          
          if (allEnrollmentsData && allEnrollmentsData.length > 0) {
            allEnrollments = allEnrollmentsData;
            enrollment = allEnrollmentsData.find((e: any) => e.academic_year_id === yearId) || null;
            otherEnrollments = allEnrollmentsData.filter((e: any) => e.academic_year_id !== yearId);
          }
        } catch (e) {
          console.error("Erreur chargement enrollment:", e);
        }

        const effectiveClassId = enrollment?.class_id || data.class_id;
        const effectiveClassName = enrollment?.class?.name || data.class?.name || `Registre ${terminology.academicYear.includes('Académique') ? 'Académique' : 'Scolaire'}`;
        const effectiveClassLevel = enrollment?.class?.level || data?.class?.level || 'N/A';
        const effectiveCampusId = enrollment?.class?.campus_id || data.campus_id || data?.class?.campus_id || null;

        let campusName = '';
        if (effectiveCampusId) {
          try {
            const { data: campusData } = await supabase
              .from('school_campuses')
              .select('name')
              .eq('id', effectiveCampusId)
              .maybeSingle();
            if (campusData) campusName = campusData.name;
          } catch(e) {}
        }

        console.log("DEBUG Guichet - studentId:", studentId);
        console.log("DEBUG Guichet - yearId:", yearId);
        console.log("DEBUG Guichet - effectiveClassId:", effectiveClassId);

        let plan = null;
        if (effectiveClassId) {
          try {
            const { data: planData, error: planError } = await supabase
              .from('fee_plans')
              .select('*')
              .eq('school_id', user.school_id)
              .eq('class_id', effectiveClassId)
              .eq('academic_year_id', yearId)
              .maybeSingle();
            
            if (planError && planError.code === '42703') {
              const fallback = await supabase.from('fee_plans')
                .select('*')
                .eq('school_id', user.school_id)
                .eq('class_id', effectiveClassId)
                .maybeSingle();
              plan = fallback.data;
            } else {
              plan = planData;
            }
          } catch (e) {
            const fallback = await supabase.from('fee_plans')
              .select('*')
              .eq('school_id', user.school_id)
              .eq('class_id', effectiveClassId)
              .maybeSingle();
            plan = fallback.data;
          }
        }

        let allStudentPayments: any[] = [];
        try {
          const { data: pData, error: pErr } = await supabase.from('payments')
            .select('*, campaign:ad_hoc_campaigns(id, name)')
            .eq('school_id', user.school_id)
            .eq('student_id', data.id);
          
          if (pData) {
            allStudentPayments = pData;
          }
          if (pErr) {
            console.error("Erreur pErr payments:", pErr);
          }
        } catch (e) {
          console.error("Erreur chargement paiements:", e);
        }

        const isCampaignPayment = (p: any) => !!p.ad_hoc_campaign_id;
        const isAdmissionPayment = (p: any) => {
          const feeTypeStr = (p.fee_type || '').toLowerCase();
          const natureStr = (p.nature || '').toLowerCase();
          const typeStr = (p.type || '').toLowerCase();
          const descStr = (p.description || '').toLowerCase();
          return (
            feeTypeStr.includes('inscri') ||
            feeTypeStr.includes('admiss') ||
            feeTypeStr.includes('reinscri') ||
            feeTypeStr.includes('réinscri') ||
            natureStr.includes('inscri') ||
            natureStr.includes('admiss') ||
            natureStr.includes('reinscri') ||
            natureStr.includes('réinscri') ||
            natureStr.includes('entree') ||
            natureStr.includes('entrée') ||
            typeStr.includes('inscri') ||
            typeStr.includes('admiss') ||
            typeStr.includes('reinscri') ||
            typeStr.includes('réinscri') ||
            typeStr.includes('entree') ||
            typeStr.includes('entrée') ||
            descStr.includes('inscri') ||
            descStr.includes('admiss') ||
            descStr.includes('reinscri') ||
            descStr.includes('réinscri') ||
            Number(p.amount) === 3375 ||
            Number(p.amount_htg_equivalent) === 3375
          );
        };
        const isMiscPayment = (p: any) => {
          const feeTypeStr = (p.fee_type || '').toLowerCase();
          const natureStr = (p.nature || '').toLowerCase();
          const typeStr = (p.type || '').toLowerCase();
          const descStr = (p.description || '').toLowerCase();
          return (
            feeTypeStr.includes('divers') ||
            natureStr.includes('divers') ||
            typeStr.includes('divers') ||
            descStr.includes('divers')
          );
        };

        // Filtrer les paiements pour cette session académique:
        // 1) Si le paiement est explicitement rattaché à yearId: OK
        // 2) Si le paiement est un paiement d'admission/inscription et n'est pas lié à une autre inscription concurrente: OK
        // 3) Si le paiement n'a pas d'academic_year_id et est attribuable à la session ciblée: OK
        const currentPayments = allStudentPayments.filter((p: any) => {
          if (p.academic_year_id === yearId) return true;
          
          if (isAdmissionPayment(p)) {
            if (!p.academic_year_id) return otherEnrollments.length === 0 || !!enrollment;
            const isEnrolledInOther = otherEnrollments.some(e => e.academic_year_id === p.academic_year_id);
            if (!isEnrolledInOther && enrollment) return true;
          }

          if (!p.academic_year_id) {
            return otherEnrollments.length === 0 || !otherEnrollments.some(e => e.academic_year_id === p.academic_year_id);
          }
          
          const isEnrolledInOther = otherEnrollments.some(e => e.academic_year_id === p.academic_year_id);
          if (!isEnrolledInOther && enrollment) {
            return true;
          }
          return false;
        });
        
        const validPayments = currentPayments?.filter((p: any) => 
          !p.payment_method?.includes('EN ATTENTE') && 
          !p.payment_method?.includes('REJETÉ') &&
          p.status !== 'ANNULE'
        ) || [];

        const admissionPayments = validPayments.filter(p => !isCampaignPayment(p) && isAdmissionPayment(p));
        const campaignPayments = validPayments.filter(p => isCampaignPayment(p));
        const miscPayments = validPayments.filter(p => !isCampaignPayment(p) && !isAdmissionPayment(p) && isMiscPayment(p));
        const tuitionPayments = validPayments.filter(p => !isCampaignPayment(p) && !isAdmissionPayment(p) && !isMiscPayment(p));

        // Vérifier si l'étudiant a des inscriptions antérieures (Réinscription)
        const { data: prevEnrollments } = await supabase
          .from('enrollments')
          .select('academic_year_id')
          .eq('school_id', user.school_id)
          .eq('student_id', studentId)
          .neq('academic_year_id', yearId)
          .limit(1);
        
        const hasPreviousEnrollment = (prevEnrollments?.length || 0) > 0;
        
        const baseDueHTG = plan ? Number(plan.tuition_fee || 0) : 0;
        const baseDueUSD = plan ? Number(plan.tuition_fee_usd || 0) * currentExchangeRate : 0;
        const baseDue = baseDueHTG + baseDueUSD;

        const miscHTG = plan && plan.is_misc_mandatory ? Number(plan.misc_fee_htg || 0) : 0;
        const miscUSD_val = plan && plan.is_misc_mandatory ? Number(plan.misc_fee_usd || 0) : 0;
        
        // Logique de frais d'entrée (Inscription vs Réinscription)
        const inscriptionHTG_val = plan 
          ? (hasPreviousEnrollment ? Number(plan.reenrollment_fee || 0) : Number(plan.inscription_fee || 0))
          : 0;
        const inscriptionUSD_val = plan 
          ? (hasPreviousEnrollment ? Number(plan.reenrollment_fee_usd || 0) : Number(plan.inscription_fee_usd || 0))
          : 0;

        // Calculs multi-devises rigoureux avec respect des règlements antérieurs
        const admissionBreakdown = computeFeeCategoryBalance(
          inscriptionHTG_val,
          inscriptionUSD_val,
          admissionPayments,
          currentExchangeRate
        );

        const miscBreakdown = computeFeeCategoryBalance(
          miscHTG,
          miscUSD_val,
          miscPayments,
          currentExchangeRate
        );

        const grossInscriptionPaid = admissionBreakdown.paidHTGEquiv;
        const grossMiscPaid = miscBreakdown.paidHTGEquiv;
        const grossTuitionPaid = tuitionPayments.reduce((acc, p) => acc + Number(p.amount_htg_equivalent || (p.currency === 'USD' ? p.amount * (p.exchange_rate_applied || currentExchangeRate) : p.amount) || 0), 0);
        const grossCampaignsPaid = campaignPayments.reduce((acc, p) => acc + Number(p.amount_htg_equivalent || (p.currency === 'USD' ? p.amount * (p.exchange_rate_applied || currentExchangeRate) : p.amount) || 0), 0);
        
        const currentPaid = grossInscriptionPaid + grossMiscPaid + grossTuitionPaid + grossCampaignsPaid;

        const inscriptionDue = admissionBreakdown.isPaid 
          ? grossInscriptionPaid 
          : admissionBreakdown.effectiveDueHTG;
        const miscDue = miscBreakdown.isPaid 
          ? grossMiscPaid 
          : miscBreakdown.effectiveDueHTG;
          
        const studentDiscount = Number(data.discount_amount || 0);
        const tuitionDiscount = Number(enrollment?.tuition_discount || 0);
        const tuitionAddition = Number(enrollment?.tuition_addition || 0);
        const totalDiscount = studentDiscount + tuitionDiscount;
        
        const scolariteBase = baseDue + tuitionAddition;
        
        // Distinction entre Option Standard (Scolarité Pure) et Option Complète / Sociale (Scolarité + Frais Divers)
        const isCompleteScholarship = Boolean(
          data.discount_label && (
            data.discount_label.toLowerCase().includes('complète') ||
            data.discount_label.toLowerCase().includes('sociale') ||
            data.discount_label.toLowerCase().includes('frais divers')
          )
        );

        let tuitionDiscountApplied = 0;
        let miscDiscountApplied = 0;

        if (isCompleteScholarship) {
          // Bourse Complète : exonère la scolarité en priorité, puis les frais divers obligatoires s'il reste une portion
          tuitionDiscountApplied = Math.min(scolariteBase, totalDiscount);
          const remainingDiscount = Math.max(0, totalDiscount - tuitionDiscountApplied);
          miscDiscountApplied = Math.min(miscDue, remainingDiscount);
        } else {
          // Option Standard : Bourse ciblée strictement sur les frais de scolarité
          tuitionDiscountApplied = Math.min(scolariteBase, totalDiscount);
          miscDiscountApplied = 0;
        }

        const scolariteDue = Math.max(0, scolariteBase - tuitionDiscountApplied);
        const effectiveMiscDue = Math.max(0, miscDue - miscDiscountApplied);
        const effectiveInscriptionDue = inscriptionDue;
        const remainingDiscountAfterCore = 0;
        
        const inscriptionPaid = grossInscriptionPaid;
        const neededMisc = Math.max(0, effectiveMiscDue - grossMiscPaid);
        const miscCoverFromTuition = (plan?.is_misc_mandatory && neededMisc > 0)
          ? Math.min(neededMisc, Math.max(0, grossTuitionPaid - scolariteDue))
          : 0;
        const miscPaid = grossMiscPaid + miscCoverFromTuition;
        const scolaritePaid = grossTuitionPaid - miscCoverFromTuition;
        

        let allCampaigns: any[] = [];
        try {
          const { data: campaignsData } = await supabase
            .from('ad_hoc_campaigns')
            .select('id, name, amount, currency, campus_id, class_id')
            .eq('school_id', user.school_id)
            .eq('academic_year_id', yearId);
          allCampaigns = campaignsData || [];
        } catch(e) {}

        let explicitCampaignCustomAmounts = new Map<string, number | null>();
        try {
          const { data: assignmentsData } = await supabase
            .from('student_ad_hoc_fees')
            .select('campaign_id, custom_amount')
            .eq('school_id', user.school_id)
            .eq('student_id', studentId);
          if (assignmentsData) {
            assignmentsData.forEach(a => {
              explicitCampaignCustomAmounts.set(a.campaign_id, a.custom_amount);
            });
          }
        } catch(e) {}

        let currentRemDiscount = remainingDiscountAfterCore;
        const campaignsList = allCampaigns.map(c => {
          const isExplicit = explicitCampaignCustomAmounts.has(c.id);
          
          // L'affectation doit être explicite (enregistrée dans student_ad_hoc_fees)
          // Le ciblage par campus ou classe sert d'aide à la sélection lors de la planification
          if (!isExplicit) {
            return null;
          }
          
          const customAmount = explicitCampaignCustomAmounts.get(c.id);
          let expectedAmount = (customAmount !== null && customAmount !== undefined) ? Number(customAmount) : Number(c.amount || 0);
          
          let expectedAmountHTG = c.currency === 'USD' ? expectedAmount * currentExchangeRate : expectedAmount;
          
          const campaignDiscountApplied = Math.min(expectedAmountHTG, currentRemDiscount);
          expectedAmountHTG -= campaignDiscountApplied;
          currentRemDiscount -= campaignDiscountApplied;
          
          expectedAmount = c.currency === 'USD' ? expectedAmountHTG / currentExchangeRate : expectedAmountHTG;

          const paidForThis = validPayments
            .filter((p: any) => p.ad_hoc_campaign_id === c.id)
            .reduce((acc: number, p: any) => {
              const paymentCurrency = p.currency || 'HTG';
              const rate = p.exchange_rate_applied || currentExchangeRate || 150;
              if (c.currency === 'USD') {
                if (paymentCurrency === 'USD') {
                  return acc + Number(p.amount || 0);
                } else {
                  return acc + (Number(p.amount || 0) / rate);
                }
              } else {
                // campaign currency is HTG
                if (paymentCurrency === 'HTG') {
                  return acc + Number(p.amount || 0);
                } else {
                  return acc + Number(p.amount_htg_equivalent || (p.amount * rate) || 0);
                }
              }
            }, 0);
          return {
            ...c,
            amount: expectedAmount, // override standard amount with student-specific custom amount/reduction
            custom_amount: customAmount,
            original_amount: Number(c.amount || 0),
            paid: paidForThis,
            remaining: Math.max(0, expectedAmount - paidForThis)
          };
        }).filter(c => c && c.id);

        const campaignsTotalDue = campaignsList.reduce((acc, c) => {
          let cAmountHTG = c.currency === 'USD' ? (c.amount || 0) * currentExchangeRate : (c.amount || 0);
          return acc + cAmountHTG;
        }, 0);

        const calculatedTotalDue = scolariteDue + effectiveInscriptionDue + effectiveMiscDue + campaignsTotalDue;
        const totalDue = Math.max(currentPaid, calculatedTotalDue);

        // Auto-sélection du type de frais en fonction des priorités (Règles strictes)
        let autoFeeType = 'SCOLARITE';
        let autoCurrency: 'HTG' | 'USD' = 'HTG';

        if (effectiveInscriptionDue > inscriptionPaid) {
          autoFeeType = 'INSCRIPTION';
          autoCurrency = (inscriptionUSD_val > 0 && inscriptionHTG_val === 0) ? 'USD' : 'HTG';
        } else if (effectiveMiscDue > miscPaid && plan?.is_misc_mandatory) {
          autoFeeType = 'DIVERS';
          autoCurrency = (miscUSD_val > 0 && miscHTG === 0) ? 'USD' : 'HTG';
        } else {
          autoFeeType = 'SCOLARITE';
          const tuitionUSD = Number(plan?.tuition_fee_usd || 0);
          const tuitionHTG = Number(plan?.tuition_fee || 0);
          autoCurrency = (tuitionUSD > 0 && tuitionHTG === 0) ? 'USD' : 'HTG';
        }

        setFeeType(autoFeeType);
        if (paymentMethod !== 'MonCash') {
          setCurrency(autoCurrency);
        }

        setSelectedStudent({
          ...data,
          last_name: formatted.lastName,
          first_name: formatted.firstName,
          fullName: formatted.fullName,
          totalDue,
          totalRemaining: Math.max(0, totalDue - currentPaid),
          paid: currentPaid,
          inscriptionDue: effectiveInscriptionDue,
          inscriptionGross: inscriptionDue,
          inscriptionPaid: inscriptionPaid,
          inscriptionUSD: inscriptionUSD_val,
          inscriptionNativeHTG: inscriptionHTG_val,
          inscriptionNativeUSD: inscriptionUSD_val,
          inscriptionRemainingUSD: admissionBreakdown.remainingUSD,
          inscriptionRemainingHTG: admissionBreakdown.remainingHTG,
          inscriptionPaidUSD: admissionBreakdown.paidUSDVal,
          inscriptionPaidHTG: admissionBreakdown.paidHTGEquiv,
          miscDue: effectiveMiscDue,
          miscGross: miscDue,
          miscPaid: miscPaid,
          miscUSD: miscUSD_val,
          miscNativeHTG: miscHTG,
          miscNativeUSD: miscUSD_val,
          miscRemainingUSD: miscBreakdown.remainingUSD,
          miscRemainingHTG: miscBreakdown.remainingHTG,
          miscPaidUSD: miscBreakdown.paidUSDVal,
          miscPaidHTG: miscBreakdown.paidHTGEquiv,
          scolariteDue: scolariteDue,
          scolariteGross: baseDue,
          scolaritePaid: scolaritePaid,
          scolariteRemaining: Math.max(0, scolariteDue - scolaritePaid),
          scolariteUSD: plan ? Number(plan.tuition_fee_usd || 0) : 0,
          classe: effectiveClassName,
          campus_id: effectiveCampusId,
          campus_name: campusName,
          level: effectiveClassLevel,
          hasPlan: !!plan,
          plan: plan,
          adHocCampaigns: campaignsList,
          isNotEnrolledInTargetYear: !enrollment,
          otherEnrollments: otherEnrollments
        });
        setIsLocked(true);
        auditGlobalSolvency(data.id, yearId);
      }
    } catch (err) {
      console.error("Load details error:", err);
    } finally {
      setLoadingDebt(false);
    }
  }, [auditGlobalSolvency, currentExchangeRate]);

  useEffect(() => {
    if (location.state?.studentId) {
      const initialYear = location.state?.academicYearId || targetYearId;
      if (location.state?.academicYearId && location.state.academicYearId !== targetYearId) {
        setTargetYearId(location.state.academicYearId);
      }
      if (initialYear) {
        loadStudentDetails(location.state.studentId, initialYear);
      }
    }
  }, [location.state, loadStudentDetails]);

  // Recharger les détails si l'année cible change et qu'un étudiant est déjà sélectionné
  useEffect(() => {
    if (selectedStudent && targetYearId && isLocked) {
      loadStudentDetails(selectedStudent.id, targetYearId);
    }
  }, [targetYearId, selectedStudent?.id]);

  // Real-time synchronization for selected student details and balances on the administrative form
  useEffect(() => {
    if (!user?.school_id || !selectedStudent?.id || !targetYearId) return;

    const channelName = `admin_tuition_${selectedStudent.id}`;
    const tuitionSub = supabase.channel(channelName)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'payments', 
        filter: `student_id=eq.${selectedStudent.id}` 
      }, () => {
        loadStudentDetails(selectedStudent.id, targetYearId);
      })
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'student_ad_hoc_fees', 
        filter: `student_id=eq.${selectedStudent.id}` 
      }, () => {
        loadStudentDetails(selectedStudent.id, targetYearId);
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'enrollments',
        filter: `student_id=eq.${selectedStudent.id}`
      }, () => {
        loadStudentDetails(selectedStudent.id, targetYearId);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(tuitionSub);
    };
  }, [user?.school_id, selectedStudent?.id, targetYearId, loadStudentDetails]);

  const handleSelect = async (student: any) => {
    setStudentSearch('');
    try {
      // Vérifier si l'élève est inscrit dans une session spécifique (ex: session future 2026-2027)
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('academic_year_id, academic_year:academic_years(id, label, status)')
        .eq('school_id', user.school_id)
        .eq('student_id', student.id);

      let targetYear = targetYearId;
      if (enrollments && enrollments.length > 0) {
        const isEnrolledInCurrent = enrollments.some((e: any) => e.academic_year_id === targetYearId);
        if (!isEnrolledInCurrent) {
          // Basculer automatiquement vers l'année d'inscription de l'élève (priorité FUTURE ou ACTIVE)
          const preferred = enrollments.find((e: any) => e.academic_year?.status === 'FUTURE' || e.academic_year?.status === 'ACTIVE') || enrollments[0];
          if (preferred?.academic_year_id) {
            targetYear = preferred.academic_year_id;
            setTargetYearId(preferred.academic_year_id);
          }
        }
      }
      loadStudentDetails(student.id, targetYear);
    } catch (e) {
      loadStudentDetails(student.id, targetYearId);
    }
  };

  const hasUSDFees = useMemo(() => {
    if (!selectedStudent || !selectedStudent.plan) return false;
    const hasPlanUSD = (
      Number(selectedStudent.plan.tuition_fee_usd || 0) > 0 ||
      Number(selectedStudent.plan.inscription_fee_usd || 0) > 0 ||
      Number(selectedStudent.plan.reenrollment_fee_usd || 0) > 0 ||
      (selectedStudent.plan.is_misc_mandatory && Number(selectedStudent.plan.misc_fee_usd || 0) > 0)
    );
    const hasAdHocUSD = selectedStudent.adHocCampaigns?.some((c: any) => c.currency === 'USD');
    return hasPlanUSD || hasAdHocUSD;
  }, [selectedStudent]);

  const paymentLogic = useMemo(() => {
    if (!selectedStudent) return null;
    
    const isUSD = currency === 'USD';
    const rate = currentExchangeRate || 1;

    if (feeType === 'CREDIT_PORTEFEUILLE') {
      return { resteTotal: Infinity, suggestion: 0, isWalletCredit: true };
    }

    if (feeType === 'INSCRIPTION') {
      const isUSDPlan = (selectedStudent.inscriptionUSD || 0) > 0 && (selectedStudent.inscriptionNativeHTG || 0) === 0;
      const remUSD = selectedStudent.inscriptionRemainingUSD !== undefined
        ? selectedStudent.inscriptionRemainingUSD
        : (selectedStudent.inscriptionUSD ? Math.max(0, selectedStudent.inscriptionUSD - (selectedStudent.inscriptionPaidUSD || 0)) : 0);
      const remHTG = selectedStudent.inscriptionRemainingHTG !== undefined
        ? selectedStudent.inscriptionRemainingHTG
        : Math.max(0, selectedStudent.inscriptionDue - selectedStudent.inscriptionPaid);
      
      const suggestion = isUSD 
        ? (isUSDPlan ? remUSD : (Math.round((remHTG / rate) * 100) / 100))
        : remHTG;

      return { 
        resteTotal: remHTG, 
        resteUSD: remUSD,
        isUSDPlan,
        suggestion 
      };
    }

    if (feeType === 'DIVERS') {
      const isUSDPlan = (selectedStudent.miscUSD || 0) > 0 && (selectedStudent.miscNativeHTG || 0) === 0;
      const remUSD = selectedStudent.miscRemainingUSD !== undefined
        ? selectedStudent.miscRemainingUSD
        : (selectedStudent.miscUSD ? Math.max(0, selectedStudent.miscUSD - (selectedStudent.miscPaidUSD || 0)) : 0);
      const remHTG = selectedStudent.miscRemainingHTG !== undefined
        ? selectedStudent.miscRemainingHTG
        : Math.max(0, selectedStudent.miscDue - selectedStudent.miscPaid);
      
      const suggestion = isUSD 
        ? (isUSDPlan ? remUSD : (Math.round((remHTG / rate) * 100) / 100))
        : remHTG;

      return { 
        resteTotal: remHTG, 
        resteUSD: remUSD,
        isUSDPlan,
        suggestion 
      };
    }
    
    if (feeType.startsWith('ADHOC_')) {
      const campaignId = feeType.replace('ADHOC_', '');
      const campaign = selectedStudent.adHocCampaigns?.find((c: any) => c.id === campaignId);
      if (campaign) {
        const isUSDPlan = campaign.currency === 'USD';
        const resteAdHoc = campaign.remaining;
        const resteAdHocHTG = isUSDPlan ? (resteAdHoc * rate) : resteAdHoc;
        const resteAdHocUSD = isUSDPlan ? resteAdHoc : (resteAdHoc / rate);
        
        let suggestion = resteAdHoc;
        if (isUSDPlan && !isUSD) {
           suggestion = Math.round(resteAdHoc * rate);
        } else if (!isUSDPlan && isUSD) {
           suggestion = (Math.round((resteAdHoc / rate) * 100) / 100);
        }
        
        return { 
          resteTotal: resteAdHocHTG, 
          resteUSD: resteAdHocUSD,
          isUSDPlan,
          suggestion, 
          isAdHoc: true, 
          campaign 
        };
      }
    }

    // SCOLARITE
    const isUSDPlan = (selectedStudent.scolariteUSD || 0) > 0 && Number(selectedStudent.plan?.tuition_fee || 0) === 0;
    const resteScolariteHTG = Math.max(0, selectedStudent.scolariteDue - selectedStudent.scolaritePaid);
    let suggestionHTG = resteScolariteHTG;

    const structure = selectedStudent.plan?.payment_structure;
    let currentStepLabel = "";
    let currentStepIndex = -1;
    let totalSteps = 0;
    let stepDueDate: string | null = null;
    let stepTargetAmount = 0;
    let isFullyPaid = resteScolariteHTG <= 0;

    if (structure && structure.length > 0) {
      totalSteps = structure.length;
      let accumulated = 0;
      const paid = selectedStudent.scolaritePaid || 0;
      
      const foundIdx = structure.findIndex((step: any) => {
        accumulated += Number(step.amount || 0);
        return (accumulated - 5) > paid; // Margin for rounding
      });

      if (foundIdx !== -1) {
        currentStepIndex = foundIdx + 1;
        const activeStep = structure[foundIdx];
        currentStepLabel = activeStep.label || `Étape ${currentStepIndex}`;
        stepDueDate = activeStep.due_date || null;
        stepTargetAmount = Number(activeStep.amount || 0);
        
        // Exact remaining amount needed for this specific stage
        suggestionHTG = Math.min(resteScolariteHTG, accumulated - paid);
      } else if (isFullyPaid) {
        currentStepLabel = "Scolarité Réglée en Totalité";
        currentStepIndex = totalSteps;
        suggestionHTG = 0;
      }
    } else {
      currentStepLabel = "Versement Unique / Solde";
      suggestionHTG = resteScolariteHTG;
    }

    const suggestion = isUSD ? (Math.round((suggestionHTG / rate) * 100) / 100) : suggestionHTG;
    return { 
      resteTotal: resteScolariteHTG, 
      resteUSD: Math.round((resteScolariteHTG / rate) * 100) / 100,
      isUSDPlan,
      suggestion, 
      structure,
      currentStepLabel,
      currentStepIndex,
      totalSteps,
      stepDueDate,
      stepTargetAmount,
      isFullyPaid
    };
  }, [selectedStudent, feeType, currency, currentExchangeRate]);

  // Auto-populate recommended payment amount when student, feeType or currency changes
  useEffect(() => {
    if (selectedStudent && paymentLogic && paymentLogic.suggestion !== undefined) {
      if (paymentLogic.suggestion > 0) {
        setMontantReel(paymentLogic.suggestion.toString());
      } else {
        setMontantReel('');
      }
    }
  }, [selectedStudent?.id, feeType, currency, paymentLogic?.suggestion]);

  // FONCTION DE REMISE À ZÉRO TOTALE
  const resetAllFields = () => {
    setStudentSearch('');
    setSearchResults([]);
    setSelectedStudent(null);
    setMontantReel('');
    setIsLocked(false);
    setIsSubmitting(false);
    setShowReceipt(false);
    setTransactionRef('');
    setGlobalDebt(0);
    setCurrency('HTG');
    setFeeType('SCOLARITE');
    setPaymentMethod('Cash');
  };

  // Soumission de la double-validation par un supérieur
  const handleSuperiorValidationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!superiorEmail || !superiorPassword) {
      setSuperiorAuthError("Veuillez saisir l'email et le mot de passe de validation.");
      return;
    }

    setIsValidatingSuperior(true);
    setSuperiorAuthError(null);

    try {
      const response = await fetch('/api/verify-admin-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: superiorEmail,
          password: superiorPassword,
          school_id: user.school_id
        })
      });

      const resData = await response.json();
      if (!response.ok || !resData.success) {
        throw new Error(resData.error || "La validation par mot de passe a échoué.");
      }

      const superiorProfile = resData.profile;
      toast.success(`Transaction approuvée par ${superiorProfile.full_name}`);
      
      setAuthorizedSuperiorName(superiorProfile.full_name);
      setShowSuperiorAuthModal(false);
      
      // Relancer la soumission avec le nom du supérieur
      handleValidation(undefined, superiorProfile.full_name);
    } catch (err: any) {
      console.error("Superior validation failed:", err);
      setSuperiorAuthError(err.message || "Identifiants de validation incorrects ou privilèges insuffisants.");
    } finally {
      setIsValidatingSuperior(false);
    }
  };

      // 4. VALIDATION ET SCELLAGE DE LA TRANSACTION (SÉCURISÉ CONTRE ERREUR 23514)
    const handleValidation = async (e?: React.FormEvent, superiorOverrideName?: string) => {
      if (e) e.preventDefault();
      
      if (!activeYear || !user?.school_id) {
        toast.error("Session administrative invalide ou école non reconnue.");
        return;
      }
  
      if (isSubmitting || !selectedStudent || refError) return;

      const activeSuperiorName = authorizedSuperiorName || superiorOverrideName;
      const requiresSuperiorApproval = !isSuperior && (feeType === 'CREDIT_PORTEFEUILLE' || paymentMethod === 'Portefeuille' || paymentMethod === 'Chèque');

      if (requiresSuperiorApproval && !activeSuperiorName) {
        setSuperiorEmail('');
        setSuperiorPassword('');
        setSuperiorAuthError(null);
        setShowSuperiorAuthModal(true);
        return;
      }
  
      if (paymentMethod === 'Dépôt Bancaire' && depositDate) {
        const restriction = isRestrictedBankDate(depositDate);
        if (restriction.restricted) {
          toast.error(`Opération bloquée : ${restriction.reason}.`);
          setIsSubmitting(false);
          return;
        }
      }

      setIsSubmitting(true);
      try {
        const amount = parseFloat(montantReel);
        const validationResult = tuitionPaymentSchema.safeParse({
          amount: amount,
          currency: currency,
          paymentMethod: paymentMethod,
          date: depositDate || getLocalTodayString(),
          reference: referenceNumber
        });

        if (!validationResult.success) {
          throw new Error(validationResult.error.issues[0].message);
        }

        // Vérification de verrouillage de la caisse pour la date concernée
        const targetPaymentDate = (paymentMethod === 'Dépôt Bancaire' && depositDate) ? depositDate : getLocalTodayString();
        const lockCheck = await isCashDateLocked(user.school_id, selectedStudent.campus_id || currentCampusId, targetPaymentDate);
        if (lockCheck.isLocked) {
          toast.error(`🔒 Encaissement bloqué : La caisse du ${targetPaymentDate} est déjà clôturée et verrouillée par l'administration.`);
          setIsSubmitting(false);
          return;
        }
        
        // Validation: Ne pas autoriser un paiement supérieur ou égal lorsque la dette restante est déjà nulle
        if (paymentLogic && feeType !== 'CREDIT_PORTEFEUILLE') {
          if (paymentLogic.resteTotal <= 0 && (!paymentLogic.resteUSD || paymentLogic.resteUSD <= 0)) {
            toast.error(`Ce frais a déjà été entièrement réglé. Aucun versement supplémentaire n'est requis.`);
            setIsSubmitting(false);
            return;
          }

          if (currency === 'USD' && paymentLogic.isUSDPlan) {
            const maxUSD = (paymentLogic.resteUSD !== undefined ? paymentLogic.resteUSD : paymentLogic.resteTotal / currentExchangeRate);
            if (amount > maxUSD + 0.1) {
              toast.error(`Le montant saisi (${amount} USD) dépasse la balance restante due de ce frais ($${maxUSD.toFixed(2)} USD).`);
              setIsSubmitting(false);
              return;
            }
          } else {
            const amountHTG = currency === 'USD' ? Math.round((amount * currentExchangeRate) * 100) / 100 : amount;
            // Tolérance de 15 HTG pour les erreurs d'arrondi de devises
            if (amountHTG > paymentLogic.resteTotal + 15) {
              const maxAllowed = currency === 'USD' ? (paymentLogic.resteTotal / currentExchangeRate).toFixed(2) : paymentLogic.resteTotal.toFixed(2);
              toast.error(`Le montant saisi (${amount} ${currency}) dépasse la balance restante due de ce frais (${maxAllowed} ${currency}).`);
              setIsSubmitting(false);
              return;
            }
          }
        }

        if (paymentMethod === 'Portefeuille') {
          const walletBalance = currency === 'USD' ? (selectedStudent.wallet_balance_usd || 0) : (selectedStudent.wallet_balance_htg || 0);
          if (walletBalance < amount) {
            toast.error(`Le solde du portefeuille de l'${terminology.student?.toLowerCase() || 'étudiant'} (${walletBalance.toLocaleString()} ${currency}) est insuffisant pour effectuer ce paiement de ${amount.toLocaleString()} ${currency}.`);
            setIsSubmitting(false);
            return;
          }
        }
  
        if ((paymentMethod === 'Chèque' || paymentMethod === 'Dépôt Bancaire' || paymentMethod === 'MonCash') && referenceNumber) {
          let payQuery = supabase
            .from('payments')
            .select('id')
            .eq('school_id', user.school_id)
            .eq('reference_number', referenceNumber);

          if ((paymentMethod === 'Chèque' || paymentMethod === 'Dépôt Bancaire') && bankName) {
            payQuery = payQuery.eq('bank_name', bankName);
          }

          const { data: existingPayment, error: checkError } = await payQuery.limit(1);
          
          if (checkError) {
             console.warn("Erreur vérification référence:", checkError);
          } else if (existingPayment && existingPayment.length > 0) {
             toast.error(`Ce numéro de ${paymentMethod === 'Chèque' ? 'chèque' : paymentMethod === 'MonCash' ? 'transaction' : 'bordereau'} a déjà été utilisé dans le système pour cette banque.`);
             setIsSubmitting(false);
             return;
          }

          let supQuery = supabase
            .from('school_supplies')
            .select('id')
            .eq('school_id', user.school_id)
            .eq('reference_number', referenceNumber);

          if ((paymentMethod === 'Chèque' || paymentMethod === 'Dépôt Bancaire') && bankName) {
            supQuery = supQuery.eq('bank_name', bankName);
          }

          const { data: existingSupplies, error: checkSuppliesError } = await supQuery.limit(1);

          if (checkSuppliesError) {
             console.warn("Erreur vérification référence boutique:", checkSuppliesError);
          } else if (existingSupplies && existingSupplies.length > 0) {
             toast.error(`Ce numéro de ${paymentMethod === 'Chèque' ? 'chèque' : paymentMethod === 'MonCash' ? 'transaction' : 'bordereau'} a déjà été utilisé dans la boutique pour cette banque.`);
             setIsSubmitting(false);
             return;
          }
        }

        const isPending = paymentMethod === 'Chèque' || paymentMethod === 'MonCash';
        const finalPaymentMethod = paymentMethod; // On garde la valeur pure
        const moncashOrderId = paymentMethod === 'MonCash' ? `TC-${Date.now()}` : null;
  
        const isAdHoc = feeType.startsWith('ADHOC_');
        const adHocCampaignId = isAdHoc ? feeType.replace('ADHOC_', '') : null;
        const adHocCampaign = isAdHoc ? selectedStudent.adHocCampaigns?.find((c: any) => c.id === adHocCampaignId) : null;
        
        const mappedType = isAdHoc 
          ? (adHocCampaign ? `Stage / Frais: ${adHocCampaign.name}` : 'Frais Ad Hoc')
          : feeType === 'SCOLARITE' ? terminology.tuition : feeType === 'INSCRIPTION' ? 'Inscription' : 'Frais Divers';

        const paymentPayload: any = {
          school_id: user.school_id,
          campus_id: selectedStudent.campus_id || currentCampusId || null,
          student_id: selectedStudent.id,
          amount: amount,
          type: mappedType,
          nature: mappedType,
          fee_type: isAdHoc ? 'DIVERS' : feeType,
          ad_hoc_campaign_id: adHocCampaignId,
          currency: currency,
          payment_method: finalPaymentMethod,
          bank_name: (paymentMethod === 'Chèque' || paymentMethod === 'Dépôt Bancaire') ? bankName : null,
          reference_number: (paymentMethod === 'Chèque' || paymentMethod === 'Dépôt Bancaire' || paymentMethod === 'MonCash') ? referenceNumber : null,
          deposit_date: paymentMethod === 'Dépôt Bancaire' ? depositDate : null,
          status: isPending ? 'EN_ATTENTE' : 'VALIDE',
          amount_htg_equivalent: currency === 'USD' ? Math.round((amount * currentExchangeRate) * 100) / 100 : amount,
          exchange_rate_applied: currency === 'USD' ? currentExchangeRate : 1,
          moncash_order_id: moncashOrderId,
          moncash_status: paymentMethod === 'MonCash' ? 'PENDING' : null
        };

      if (targetYearId) {
        paymentPayload.academic_year_id = targetYearId;
      }

      console.log("Tentative de scellage transaction...", paymentPayload);

      let paymentRecord: any = null;
      const { data: initialData, error: initialError } = await supabase.from('payments').insert([paymentPayload]).select();

      if (!initialError && initialData && initialData.length > 0) {
        paymentRecord = initialData[0];
      } else if (initialError) {
        console.warn("Désynchronisation détectée sur l'insertion principale. Tentative de fallback...", initialError);

        // Fallback 1: On garde les colonnes usuelles et on supprime les colonnes récentes optionnelles qui peuvent différer
        const fallback1Payload = { ...paymentPayload };
        delete fallback1Payload.ad_hoc_campaign_id;
        delete fallback1Payload.moncash_order_id;
        delete fallback1Payload.moncash_status;
        delete fallback1Payload.amount_htg_equivalent;
        delete fallback1Payload.exchange_rate_applied;

        const { data: fallback1Data, error: fallback1Error } = await supabase.from('payments').insert([fallback1Payload]).select();

        if (!fallback1Error && fallback1Data && fallback1Data.length > 0) {
          paymentRecord = fallback1Data[0];
        } else {
          console.warn("Fallback 1 a échoué. Tentative avec payload minimaliste...", fallback1Error);

          // Fallback 2: Payload minimal universel qui existe dans toutes les versions de la table
          const minimalPayload: any = {
            school_id: user.school_id,
            student_id: selectedStudent.id,
            amount: amount,
            currency: currency,
            payment_method: finalPaymentMethod,
          };
          if (paymentPayload.academic_year_id) minimalPayload.academic_year_id = paymentPayload.academic_year_id;

          const { data: minData, error: minError } = await supabase.from('payments').insert([minimalPayload]).select();

          if (!minError && minData && minData.length > 0) {
            paymentRecord = minData[0];
          } else if (minError) {
            console.error("Erreur critique d'insertion paiement:", minError);
            throw minError;
          } else {
            // Génération d'un id de secours si la table refuse la sélection mais a accepté l'insertion
            paymentRecord = { id: crypto.randomUUID(), ...minimalPayload };
          }
        }
      }

      if (paymentRecord) {
        const data = paymentRecord;
        if (paymentMethod === 'Portefeuille') {
          const updateField = currency === 'USD' ? 'wallet_balance_usd' : 'wallet_balance_htg';
          const walletBalance = currency === 'USD' ? (selectedStudent.wallet_balance_usd || 0) : (selectedStudent.wallet_balance_htg || 0);
          const newBalance = walletBalance - amount;
          await supabase.from('students').update({ [updateField]: newBalance }).eq('id', selectedStudent.id);
        } else if (feeType === 'CREDIT_PORTEFEUILLE') {
          const updateField = currency === 'USD' ? 'wallet_balance_usd' : 'wallet_balance_htg';
          const walletBalance = currency === 'USD' ? (selectedStudent.wallet_balance_usd || 0) : (selectedStudent.wallet_balance_htg || 0);
          const newBalance = walletBalance + amount;
          await supabase.from('students').update({ [updateField]: newBalance }).eq('id', selectedStudent.id);
        }

        // AUTO-ENROLLMENT LOGIC: Si l'étudiant n'était pas inscrit, on l'inscrit automatiquement
        if (selectedStudent.isNotEnrolledInTargetYear) {
          try {
            const enrollPayload: any = {
              school_id: user.school_id,
              student_id: selectedStudent.id,
              class_id: selectedStudent.class_id || selectedStudent.class?.id,
              enrollment_date: new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0],
              status: 'ACTIVE'
            };
            if (targetYearId) enrollPayload.academic_year_id = targetYearId;

            const { error: enrollErr } = await supabase.from('enrollments').insert(enrollPayload);
            
            if (enrollErr && enrollErr.code === '42703') {
              const { academic_year_id, ...fallback } = enrollPayload;
              await supabase.from('enrollments').insert(fallback);
            }
            console.log(`${terminology.student} auto-inscrit avec succès suite au paiement.`);
          } catch (enrollErr) {
            console.error("Erreur lors de l'auto-inscription:", enrollErr);
          }
        }

        setTransactionRef(`RCP-${data.id.substring(0, 8).toUpperCase()}`);
        
        // SYNC STATUS LOGIC: Update student and enrollment status based on results
        try {
          const { data: newDebt } = await supabase.rpc('get_student_global_debt', { p_student_id: selectedStudent.id });
          const debtValue = Number(newDebt || 0);

          // We only auto-promote students who are currently En Attente, Actif or Reliquat
          // We don't touch Inactif or Radié students automatically
          const statusesToSync = ['Actif', 'Reliquat', 'En attente', 'En Attente', 'WAITING_PAYMENT'];
          
          if (statusesToSync.includes(selectedStudent.status) || !selectedStudent.status) {
            let nextStatus = debtValue > 5 ? 'Reliquat' : 'Actif';
            await supabase.from('students').update({ status: nextStatus }).eq('id', selectedStudent.id);
            
            // If the student is now fully cleared (Actif), enforce enrollment activation
            if (nextStatus === 'Actif') {
              await supabase.from('enrollments')
                .update({ status: 'ACTIVE' })
                .eq('student_id', selectedStudent.id)
                .eq('academic_year_id', targetYearId);
              console.log("Dossier d'inscription activé car l'élève est à jour.");
            }
            
            console.log(`Statut étudiant synchronisé: ${nextStatus} (Dette: ${debtValue})`);
          }
        } catch (syncErr) {
          console.error("Erreur de synchronisation des statuts:", syncErr);
        }
        
        // Si MonCash, on redirige vers l'interface de paiement
        if (paymentMethod === 'MonCash' && moncashOrderId) {
          try {
            const redirectUrl = await MonCashService.initiatePayment(user.school_id, {
              amount: amount,
              orderId: moncashOrderId,
              description: `Paiement ${feeType} - ${selectedStudent.fullName}`
            });
            
            if (redirectUrl) {
              toast.info("Redirection vers MonCash...");
              setTimeout(() => {
                window.open(redirectUrl, '_blank');
                setShowReceipt(true);
              }, 1500);
            }
          } catch (err: any) {
            console.error("MonCash Initiation Error:", err);
            toast.error("Erreur MonCash: " + err.message);
          }
        } else {
          setShowReceipt(true);
        }
        
        AuditLogger.log({
          school_id: user.school_id,
          user_id: (await supabase.auth.getUser()).data.user?.id || '',
          action: 'PAYMENT_PROCESSED',
          entity_type: 'payment',
          entity_id: data.id,
          details: { student_id: selectedStudent.id, amount, currency, feeType, paymentMethod, approved_by_superior: activeSuperiorName || null }
        });
        setAuthorizedSuperiorName(null);
      }
    } catch (err: any) {
      console.error("Critique Scellage:", err);
      setApiError("ÉCHEC DE SCELLAGE : " + (err.message || "Erreur Cloud."));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (showReceipt) {
    return (
      <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-300 pb-16">
        {/* BANDEAU CONFIRMATION ERGONOMIQUE ET COMPACT */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-emerald-100/80 flex flex-col sm:flex-row items-center justify-between gap-4 print:hidden transition-all">
          <div className="flex items-center gap-3.5 text-left w-full sm:w-auto">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 ring-1 ring-emerald-500/20 shadow-sm">
              <CheckCircle2 size={22} className="text-emerald-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-gray-900 tracking-tight">Transaction Scellée</h2>
                <span className="bg-emerald-50 text-emerald-700 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-emerald-200/60">
                  Certifié
                </span>
              </div>
              <p className="text-xs text-gray-500 font-medium">Le règlement a été certifié avec succès par l'Administration.</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0 justify-end">
            <button
              type="button"
              onClick={() => window.print()}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-slate-900 text-white rounded-xl font-semibold text-xs shadow-sm hover:bg-slate-800 transition-all flex items-center justify-center gap-2 active:scale-95"
            >
              <Printer size={15} />
              Imprimer Reçu
            </button>
            <button
              type="button"
              onClick={resetAllFields}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-semibold text-xs shadow-sm hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 active:scale-95"
            >
              <PlusCircle size={15} />
              Nouvel Encaissement
            </button>
          </div>
        </div>

        {/* REÇU DE CAISSE TICKET 80MM (OPTIMISÉ IMPRIMANTE THERMIQUE EPSON) */}
        <div id="thermal-receipt" className="bg-white p-4 sm:p-6 w-[80mm] max-w-[80mm] mx-auto shadow-2xl rounded-xl border border-gray-200 text-black font-sans leading-tight flex flex-col print:shadow-none print:border-none print:m-0 print:p-2 print:w-[80mm]">
          {/* HEADER SCOLAIRE */}
          <div className="w-full text-center border-b-2 border-black pb-2 mb-3">
            {schoolDetails?.logo_url && (
              <img src={schoolDetails.logo_url} alt="Logo" className="h-12 mx-auto mb-1 object-contain" referrerPolicy="no-referrer" />
            )}
            <h1 className="text-[13px] font-black uppercase leading-tight">{schoolDetails?.name || 'ÉTABLISSEMENT UNIVERSITAIRE'}</h1>
            <div className="text-[9px] font-bold opacity-90 italic mt-0.5 space-y-0.5">
              {schoolDetails?.address && <p>{schoolDetails.address}</p>}
              {schoolDetails?.phone && <p>Téls: {schoolDetails.phone}</p>}
            </div>
          </div>

          {/* TITRE DU DOCUMENT */}
          <div className="w-full text-center mb-3 py-1.5 bg-gray-100 rounded border border-gray-200 print:bg-gray-100">
            <h2 className="text-[12px] font-black tracking-widest uppercase">REÇU DE CAISSE</h2>
            <p className="text-[9px] font-bold opacity-80 mt-0.5">#{transactionRef}</p>
          </div>

          {/* GRID DETAILED INFORMATION (2 COLONNES COMPACTES) */}
          <div className="w-full grid grid-cols-2 gap-2 text-[9px] mb-3 border-b border-black pb-2">
            <div className="space-y-1">
              <div>
                <p className="text-[7px] uppercase font-black text-gray-500">Date & Heure</p>
                <p className="font-bold leading-none">{new Date().toLocaleDateString('fr-FR')} {new Date().toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})}</p>
              </div>
              <div>
                <p className="text-[7px] uppercase font-black text-gray-500">Caissier</p>
                <p className="font-bold leading-none">{cashierName || 'Comptabilité'}</p>
              </div>
            </div>
            <div className="space-y-1 text-right border-l border-gray-200 pl-2">
              <div>
                <p className="text-[7px] uppercase font-black text-gray-500">Élève</p>
                <p className="font-black text-[10px] leading-tight">{selectedStudent.fullName}</p>
                <p className="text-[8px] font-bold text-gray-600 italic">{selectedStudent.classe || 'Non assignée'}</p>
              </div>
            </div>
          </div>

          {/* MOTIF & MODE DE PAIEMENT */}
          <div className="w-full text-[9px] mb-3 space-y-1 border-b border-dashed border-gray-400 pb-2">
            <div className="flex justify-between items-center py-0.5">
              <span className="font-bold uppercase text-gray-600">Motif:</span>
              <span className="font-black text-[10px]">
                {feeType.startsWith('ADHOC_') 
                  ? selectedStudent.adHocCampaigns?.find((c: any) => c.id === feeType.replace('ADHOC_', ''))?.name
                  : feeType === 'INSCRIPTION' 
                  ? (selectedStudent.inscriptionDue === (selectedStudent.plan?.reenrollment_fee || 0) ? 'Réinscription' : 'Inscription') 
                  : feeType === 'SCOLARITE' ? terminology.tuition : 'Frais Divers'}
              </span>
            </div>
            <div className="flex justify-between items-center py-0.5">
              <span className="font-bold uppercase text-gray-600">Mode:</span>
              <span className="font-black text-[10px]">{paymentMethod}</span>
            </div>
          </div>

          {/* DÉTAILS FINANCIERS & SITUATION */}
          <div className="w-full space-y-1 text-[9px] mb-3 bg-gray-50 p-2 rounded border border-gray-200 print:bg-white print:border-black">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-gray-600">Total Dû (Engagement):</span>
              <span className="font-bold">{getReceiptFeeText(feeType, selectedStudent, currentExchangeRate, 'due')}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-semibold text-gray-600">Déjà Versé:</span>
              <span className="font-bold">{getReceiptFeeText(feeType, selectedStudent, currentExchangeRate, 'paid')}</span>
            </div>
          </div>

          {/* NET PERÇU (BOX DE MISE EN VALEUR CLAIR MONOCHROME) */}
          <div className="w-full border-2 border-black rounded-lg p-2 mb-3 text-center bg-gray-50 text-black">
            <p className="text-[8px] font-black uppercase tracking-wider text-gray-700">Net Perçu (Montant Payé)</p>
            <p className="text-[16px] font-black tracking-tight leading-none mt-1 text-black">
              {parseFloat(montantReel).toLocaleString()} <span className="text-[11px] font-bold">{currency}</span>
            </p>
            {currency === 'USD' && (
              <p className="text-[9px] font-bold mt-1 pt-1 border-t border-black/20">
                Équivalent: {((Math.round((parseFloat(montantReel) * currentExchangeRate) * 100)) / 100).toLocaleString()} HTG
              </p>
            )}
          </div>

          {/* ENGAGEMENT ET RESTE */}
          <div className="w-full space-y-1 text-[9px] mb-4 border-b border-black pb-2">
            {feeType === 'CREDIT_PORTEFEUILLE' ? (
              <div className="flex justify-between items-center font-bold">
                <span>Nouveau Solde Est.:</span>
                <span>{(((currency === 'USD' ? (selectedStudent?.wallet_balance_usd || 0) : (selectedStudent?.wallet_balance_htg || 0)) + parseFloat(montantReel || '0'))).toLocaleString()} {currency}</span>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center font-bold">
                  <span>Reste sur Motif:</span>
                  <span className="text-[10px] font-black">{getReceiptFeeText(feeType, selectedStudent, currentExchangeRate, 'reste', montantReel, currency, paymentLogic)}</span>
                </div>
                <div className="flex justify-between items-center text-[8px] text-gray-600 italic">
                  <span>Solde Global (Session):</span>
                  <span className="font-bold">{getReceiptFeeText(feeType, selectedStudent, currentExchangeRate, 'solde', montantReel, currency)}</span>
                </div>
              </>
            )}
          </div>

          {/* SIGNATURE & MENTION LÉGALE */}
          <div className="w-full text-center space-y-3 mt-2">
            <div className="w-3/4 mx-auto space-y-1 pt-2">
              <div className="h-7 border-b border-black"></div>
              <p className="text-[7px] font-black uppercase tracking-widest">Sign. Caissier: {cashierName || 'Direction'}</p>
            </div>

            <p className="text-[8px] font-bold italic pt-2 border-t border-black text-center">
              Veuillez conserver ce reçu précieusement pour toute réclamation.
            </p>
          </div>

          {/* BUFFER MARGE DE COUPE (AUTO-CUTTER EPSON PRINTER) */}
          <div className="w-full pt-3 mt-2 border-t border-dashed border-gray-400 text-center">
            <p className="text-[7px] font-black uppercase tracking-[0.25em] opacity-60 text-gray-500 print:text-black">- - - MARGE DE COUPE EPSON - - -</p>
            <div className="h-6 print:h-12"></div>
          </div>
        </div>

        <style>{`
          @media print {
            body * { visibility: hidden !important; background: white !important; color: black !important; margin: 0 !important; padding: 0 !important; }
            .print\\:hidden { display: none !important; }
            #thermal-receipt { 
              visibility: visible !important;
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 80mm !important;
              max-width: 80mm !important;
              margin: 0 !important;
              padding: 4mm !important;
              display: flex !important;
              flex-direction: column !important;
              box-shadow: none !important;
              border: none !important;
              font-family: 'Courier New', Courier, monospace, sans-serif !important;
              color: black !important;
              background: white !important;
              page-break-after: always !important;
              break-after: page !important;
            }
            #thermal-receipt * { 
              visibility: visible !important; 
              color: black !important;
              border-color: black !important;
            }
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            @page { size: 80mm auto; margin: 0; }
          }
        `}</style>
      </div>
    );
  }

  const isInscriptionForced = selectedStudent && ((selectedStudent.inscriptionDue || 0) > (selectedStudent.inscriptionPaid || 0) + 1);
  const isMiscForced = selectedStudent && !isInscriptionForced && selectedStudent.plan?.is_misc_mandatory && ((selectedStudent.miscDue || 0) > (selectedStudent.miscPaid || 0) + 1);
  const isFeeTypeLocked = isInscriptionForced || isMiscForced;

  if (apiError && !selectedStudent) {
    return (
      <div className="flex h-[60vh] items-center justify-center p-6">
        <RetryableError 
          message={apiError} 
          onRetry={() => window.location.reload()}
          className="max-w-md w-full"
        />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Header Institutionnel Moderne */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 bg-white p-6 sm:p-7 rounded-3xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-gradient-to-br from-blue-50 to-indigo-50 text-blue-600 rounded-2xl border border-blue-100 shadow-2xs">
            <CreditCard size={26} className="stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Guichet de Régularisation</h2>
              <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/70 text-[10px] font-black uppercase tracking-wider">
                Caisse & Perception
              </span>
            </div>
            <p className="text-slate-500 text-sm mt-0.5">Encaissement des droits scolaires, régularisation tarifaire et audit de scolarité</p>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <button
            type="button"
            onClick={() => setIsClosureModalOpen(true)}
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 border border-slate-700 active:scale-95 cursor-pointer"
          >
            <ShieldCheck size={16} className="text-emerald-400" />
            <span>Clôture de Caisse</span>
          </button>
          {isLocked && (
            <div className="bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-xl flex items-center gap-2">
              <ShieldCheck size={16} className="text-emerald-600" />
              <span className="text-emerald-700 font-bold text-xs tracking-tight">Dossier Certifié</span>
            </div>
          )}
        </div>
      </div>

      {apiError && (
        <div className="bg-rose-50 border border-rose-200 p-6 rounded-2xl flex items-start gap-4 animate-in slide-in-from-top-4">
          <ShieldAlert className="text-rose-600 mt-0.5 flex-shrink-0" size={24} />
          <div className="flex-1">
            <p className="text-rose-800 font-bold text-sm">Erreur de Transaction</p>
            <p className="text-rose-700 text-sm mt-1">{apiError}</p>
            <button onClick={() => setApiError(null)} className="text-rose-600 text-xs font-bold tracking-tight mt-3 hover:underline">Ignorer</button>
          </div>
        </div>
      )}

      {globalDebt > 0 && (
        <div className="bg-gradient-to-r from-rose-50 via-white to-rose-50/50 border border-rose-200 p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
          <div className="flex items-center gap-4">
             <div className="p-3 bg-rose-100 text-rose-600 rounded-xl border border-rose-200"><ShieldAlert size={24} /></div>
             <div>
               <div className="flex items-center gap-2">
                 <h3 className="text-base font-black text-rose-950">Dette Globale Détectée</h3>
                 <span className="px-2 py-0.5 bg-rose-200 text-rose-800 text-[10px] font-black uppercase tracking-wider rounded-md">Audit Antérieur</span>
               </div>
               <p className="text-xs text-rose-700 mt-1">L'{terminology.student.toLowerCase()} présente un reliquat total non apuré sur son historique académique.</p>
             </div>
          </div>
          <div className="bg-white px-6 py-3.5 rounded-2xl border border-rose-200 text-center md:text-right shadow-xs">
             <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Arriéré Total Cumulé</p>
             <p className="text-2xl font-black text-rose-700 font-mono tracking-tight">{globalDebt.toLocaleString()} HTG</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 sm:p-7 space-y-6">
            {loading ? (
              <div className="py-12">
                <FluidLoadingState 
                  message="Initialisation du module finance..." 
                  subtext="Synchronisation des dettes et tarifs..." 
                />
                <SkeletonTable rows={4} />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                    {isLocked ? <ShieldCheck className="text-emerald-500" size={18} /> : <Search className="text-slate-400" size={18} />}
                    Ciblage du Dossier {terminology.student}
                  </h3>
                  {isLocked && (
                    <button 
                      onClick={resetAllFields} 
                      className="text-xs font-bold text-slate-500 hover:text-rose-600 bg-slate-50 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <RotateCcw size={13} /> Changer d'étudiant
                    </button>
                  )}
                </div>

                {!selectedStudent ? (
              <div className="relative">
                <input 
                  type="text" 
                  placeholder={`Rechercher un ${terminology.student.toLowerCase()} par nom ou matricule...`} 
                  className="w-full px-5 py-4 bg-slate-50 text-slate-900 border border-slate-200 rounded-2xl text-sm outline-none focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-slate-400" 
                  value={studentSearch} 
                  onChange={(e) => setStudentSearch(e.target.value)} 
                />
                {studentSearch.length >= 2 && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden max-h-[300px] overflow-y-auto animate-in fade-in slide-in-from-top-2 custom-scrollbar">
                    {isSearching ? (
                      <div className="p-8 text-center">
                        <RefreshCcw className="animate-spin text-blue-500 mx-auto mb-2" size={24} />
                        <p className="text-sm text-slate-500">Recherche en cours...</p>
                      </div>
                    ) : searchResults.length > 0 ? (
                      searchResults.map(s => (
                        <button key={s.id} onClick={() => handleSelect(s)} className="w-full flex justify-between items-center px-6 py-4 hover:bg-blue-50/70 border-b border-slate-100 last:border-0 group transition-colors cursor-pointer text-left">
                          <div>
                            <p className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors text-sm">{s.fullName}</p>
                            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                              <span>{s.class?.name || s.class_name || 'Aucune classe'}</span>
                              <span className="font-mono text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">Matricule: {s.reference_number || s.id?.substring(0, 8) || ''}</span>
                            </p>
                          </div>
                          <ArrowRight size={16} className="text-slate-300 group-hover:text-blue-600 transition-colors" />
                        </button>
                      ))
                    ) : (
                      <div className="px-6 py-8 text-center space-y-2">
                        <p className="text-sm text-slate-500 italic">Aucun {terminology.student.toLowerCase()} trouvé pour "{studentSearch}"</p>
                        <p className="text-[10px] text-slate-400">Vérifiez l'orthographe ou essayez une partie du nom</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-2xl p-6 text-slate-900 shadow-xs relative overflow-hidden bg-slate-50/60 border border-slate-200 animate-in fade-in duration-300">
                <div className="relative z-10 flex items-center gap-5">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-2xl flex items-center justify-center font-black text-2xl shadow-sm ring-4 ring-blue-50 shrink-0">
                      {(selectedStudent.last_name || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-lg sm:text-xl font-black text-slate-900 truncate">{selectedStudent.fullName || ''}</h4>
                        <span className="px-2 py-0.5 bg-emerald-100/80 text-emerald-800 text-[10px] font-black rounded-md uppercase tracking-wider flex items-center gap-1 border border-emerald-200">
                          <CheckCircle2 size={11} /> Identifié
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">ID: {selectedStudent.id.substring(0,8)}</span>
                        <span>•</span>
                        <span className="font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">{selectedStudent.classe}</span>
                      </p>
                      <div className="flex gap-2 mt-2.5 flex-wrap">
                        {campuses && campuses.length > 1 && selectedStudent.campus_name && (
                          <span className="px-2.5 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-black uppercase tracking-wider rounded-lg">📍 Annexe: {selectedStudent.campus_name}</span>
                        )}
                        {selectedStudent.level && selectedStudent.level !== 'N/A' && (
                          <span className="px-2.5 py-0.5 bg-amber-50 border border-amber-100 text-amber-700 text-[10px] font-black uppercase tracking-wider rounded-lg">🎓 Niveau: {selectedStudent.level}</span>
                        )}
                      </div>
                      {selectedStudent.isNotEnrolledInTargetYear && (
                        <div className="mt-3 bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
                          <div className="flex items-start gap-3">
                            <AlertTriangle size={17} className="shrink-0 mt-0.5 text-amber-600" />
                            <div className="flex flex-col">
                              <span className="text-xs font-bold uppercase tracking-wider text-amber-900">
                                {selectedStudent.otherEnrollments?.length > 0 ? 'Inscription Détectée dans une Autre Session' : "Régularisation d'Inscription"}
                              </span>
                              <span className="text-xs mt-0.5 text-amber-800">
                                {selectedStudent.otherEnrollments?.length > 0 ? (
                                  <>Cet(te) {terminology.student.toLowerCase()} est formellement inscrit(e) pour la session <strong className="text-amber-950 font-bold">{selectedStudent.otherEnrollments[0].academic_year?.label || 'Autre Session'}</strong>.</>
                                ) : (
                                  <>Ce(tte) {terminology.student.toLowerCase()} n'a pas d'inscription formelle pour cette session. L'encaissement est débloqué pour régulariser ses frais d'inscription.</>
                                )}
                              </span>
                            </div>
                          </div>
                          {selectedStudent.otherEnrollments?.length > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                const newYr = selectedStudent.otherEnrollments[0].academic_year_id;
                                setTargetYearId(newYr);
                                if (selectedStudent) {
                                  loadStudentDetails(selectedStudent.id, newYr);
                                }
                              }}
                              className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs shrink-0 self-end sm:self-center cursor-pointer flex items-center gap-1.5"
                            >
                              <Sparkles size={13} />
                              Basculer sur {selectedStudent.otherEnrollments[0].academic_year?.label}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                </div>
              </div>
            )}
            </>
          )}
        </div>

          {selectedStudent && !selectedStudent.hasPlan && (
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl animate-in fade-in mb-6 flex items-start gap-3">
              <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={18} />
              <div>
                <p className="text-amber-900 text-xs font-bold uppercase tracking-wider">Plan tarifaire introuvable</p>
                <p className="text-amber-800 text-xs mt-1">Aucun plan tarifaire n'a été configuré pour l'option de ce(tte) {terminology.student.toLowerCase()} ({selectedStudent.classe}) pour la session sélectionnée. Veuillez configurer les tarifs dans l'administration.</p>
              </div>
            </div>
          )}

          {selectedStudent && (() => {
            const isAdHoc = feeType.startsWith('ADHOC_');
            const adHocCampaignId = isAdHoc ? feeType.replace('ADHOC_', '') : null;
            const adHocCampaign = isAdHoc ? selectedStudent.adHocCampaigns?.find((c: any) => c.id === adHocCampaignId) : null;
            
            const gross = isAdHoc ? (adHocCampaign?.amount || 0) : feeType === 'INSCRIPTION' ? selectedStudent.inscriptionGross : feeType === 'DIVERS' ? selectedStudent.miscGross : selectedStudent.scolariteGross;
            const net = isAdHoc ? (adHocCampaign?.amount || 0) : feeType === 'INSCRIPTION' ? selectedStudent.inscriptionDue : feeType === 'DIVERS' ? selectedStudent.miscDue : selectedStudent.scolariteDue;
            const feeDiscount = (gross || 0) - (net || 0);

            return (
            <div className="flex flex-col gap-6 animate-in fade-in duration-500">
              {/* Échéancier Section */}
              {feeType === 'SCOLARITE' && paymentLogic?.structure && paymentLogic.structure.length > 0 && (
                <div className="bg-indigo-50/40 border border-indigo-100 rounded-3xl p-5 md:p-6 mb-2">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp size={16} className="text-indigo-600" />
                    <h5 className="text-xs font-black uppercase tracking-widest text-indigo-950">Échéancier de Paiement Réglementaire</h5>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {(() => {
                      let acc = 0;
                      const totalPaid = selectedStudent.scolaritePaid;
                      return paymentLogic.structure.map((step: any, i: number) => {
                        acc += step.amount;
                        const isPaid = (totalPaid + 5) >= acc;
                        const isNext = !isPaid && (totalPaid + 5) >= (acc - step.amount);
                        
                        return (
                          <div key={i} className={`p-3.5 rounded-2xl border flex flex-col justify-between transition-all ${isPaid ? 'bg-emerald-100/50 border-emerald-200 opacity-70' : isNext ? 'bg-white border-indigo-400 shadow-md ring-2 ring-indigo-500/10' : 'bg-white border-slate-200'}`}>
                            <div className="flex justify-between items-start">
                              <span className={`text-[9px] font-black uppercase tracking-tight ${isPaid ? 'text-emerald-700' : isNext ? 'text-indigo-600' : 'text-slate-400'}`}>
                                {step.label}
                              </span>
                              {isPaid && <CheckCircle2 size={12} className="text-emerald-600" />}
                              {isNext && <Sparkles size={12} className="text-indigo-500 animate-pulse" />}
                            </div>
                            <div className="mt-2">
                              <p className={`text-sm font-black font-mono ${isPaid ? 'text-emerald-800' : 'text-slate-900'}`}>{step.amount.toLocaleString()} G</p>
                              {step.due_date && <p className="text-[8px] font-bold text-slate-400 mt-0.5 italic">Avant le {new Date(step.due_date).toLocaleDateString()}</p>}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-xs border border-slate-200 relative overflow-hidden flex flex-col justify-between min-h-[140px]">
                   {feeDiscount > 0 && (
                   <div className="absolute top-0 right-0 bg-amber-100 text-amber-900 border-b border-l border-amber-200 px-2.5 py-0.5 rounded-bl-lg text-[9px] font-bold">
                     {selectedStudent.discount_label || 'Réévaluation'} : -{feeDiscount.toLocaleString()} G
                   </div>
                 )}
                 <div>
                   <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                     {feeType === 'CREDIT_PORTEFEUILLE'
                       ? 'Solde Actuel du Portefeuille'
                       : (isAdHoc && adHocCampaign
                         ? `Balance Campagne : ${adHocCampaign.name}`
                         : feeType === 'INSCRIPTION'
                           ? 'Balance Inscription'
                           : feeType === 'DIVERS'
                             ? 'Balance Frais Divers'
                             : `Balance ${terminology.tuition}`)}
                   </p>
                   <h5 className="text-2xl sm:text-3xl font-black text-slate-900 font-mono tracking-tight mt-1">
                     {feeType === 'CREDIT_PORTEFEUILLE'
                       ? `${(currency === 'USD' ? selectedStudent?.wallet_balance_usd : selectedStudent?.wallet_balance_htg)?.toLocaleString() ?? '0'} ${currency}`
                       : paymentLogic?.isUSDPlan
                         ? `$${(paymentLogic?.resteUSD ?? 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} USD`
                         : `${paymentLogic?.resteTotal?.toLocaleString() ?? '0'} HTG`}
                   </h5>
                   {paymentLogic?.isUSDPlan && feeType !== 'CREDIT_PORTEFEUILLE' && (
                     <p className="text-[11px] font-mono font-bold text-slate-500 mt-0.5">
                       ≈ {paymentLogic?.resteTotal?.toLocaleString() ?? '0'} HTG
                     </p>
                   )}
                   
                   {/* Détail de la remise spécifique au type de frais */}
                   {feeDiscount > 0 && (
                     <p className="text-[10px] font-bold text-amber-600 mt-1 flex items-center gap-1">
                       <Sparkles size={10} /> Réévaluation : -{feeDiscount.toLocaleString()} G
                     </p>
                   )}
                 </div>
                 
                 {feeType === 'SCOLARITE' && selectedStudent && (
                   <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                     <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">
                       Bilan Session :
                     </span>
                     <span className={`text-xs font-black font-mono ${selectedStudent.totalRemaining > 0 ? 'text-blue-700' : 'text-emerald-600'}`}>
                       {selectedStudent.totalRemaining.toLocaleString()} HTG
                     </span>
                   </div>
                 )}

                 {globalDebt > 0 && selectedStudent && feeType !== 'CREDIT_PORTEFEUILLE' && (
                   <div className="mt-3 pt-1.5 border-t border-slate-100 flex items-center justify-between bg-rose-50/50 -mx-4 sm:-mx-5 px-4 sm:px-5 py-1">
                     <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">
                       Total + Arriérés :
                     </span>
                     <span className="text-xs font-black font-mono text-rose-700">
                       {(selectedStudent.totalRemaining + globalDebt).toLocaleString()} HTG
                     </span>
                   </div>
                 )}

                 {selectedStudent && (
                   <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                     <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                       <Wallet size={12} className="text-emerald-600" /> Portefeuille :
                     </span>
                     <div className="flex items-center gap-2 font-mono font-bold text-[11px] text-slate-700">
                       <span className="bg-slate-100 px-1.5 py-0.5 rounded">{(selectedStudent.wallet_balance_htg || 0).toLocaleString()} G</span>
                       <span className="bg-slate-100 px-1.5 py-0.5 rounded">{(selectedStudent.wallet_balance_usd || 0).toLocaleString()} $</span>
                     </div>
                   </div>
                 )}
              </div>
              {feeType === 'CREDIT_PORTEFEUILLE' ? (
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50/60 p-4 sm:p-5 rounded-2xl shadow-xs border border-blue-200 text-left flex flex-col justify-between min-h-[140px]">
                  <p className="text-[11px] font-black uppercase tracking-wider text-blue-700 flex items-center gap-1.5">
                    Mode Portefeuille <Sparkles size={13} />
                  </p>
                  <p className="text-xs text-blue-900/80 leading-relaxed font-medium">
                    Alimentation des fonds en réserve pour régler ultérieurement les frais scolaires via le mode <strong>Portefeuille</strong>.
                  </p>
                </div>
              ) : (
                <button 
                  type="button" 
                  onClick={() => setMontantReel(paymentLogic?.suggestion?.toString() || '')} 
                  className="bg-gradient-to-br from-emerald-50/90 to-teal-50/40 p-4 sm:p-5 rounded-2xl shadow-xs border border-emerald-200 text-left group hover:border-emerald-400 hover:bg-emerald-100/50 transition-all cursor-pointer flex flex-col justify-between min-h-[140px]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                      Versement Suggéré <Zap size={13} className="text-emerald-600" />
                    </p>
                    <span className="text-[9px] font-bold text-emerald-700 bg-emerald-200/70 group-hover:bg-emerald-300/80 px-2 py-0.5 rounded-full transition-colors">
                      Appliquer
                    </span>
                  </div>
                  <div className="mt-2 sm:mt-auto">
                    <h5 className="text-2xl sm:text-3xl font-black text-emerald-950 font-mono tracking-tight">
                      {paymentLogic?.suggestion?.toLocaleString(undefined, { maximumFractionDigits: 2 }) ?? '0'} 
                      <span className="text-xs font-bold text-emerald-700 ml-1.5">{currency}</span>
                    </h5>
                  </div>
                </button>
              )}
            </div>
            </div>
            );
          })()}
          
          {/* Module de Règle de Conformité Financière : Frais d'inscription */}
          {isInscriptionForced && (
            <div className="bg-rose-50/90 border border-rose-200/90 p-4 rounded-2xl shadow-xs animate-in fade-in slide-in-from-top-2 mb-6">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 border border-rose-200">
                    <Lock size={16} className="stroke-[2.5]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded bg-rose-600 text-white text-[9px] font-black uppercase tracking-wider">
                        Priorité
                      </span>
                      <span className="text-xs font-bold text-rose-950">
                        Frais d’inscription non soldés
                      </span>
                      <span className="text-xs font-mono font-black text-rose-700 bg-rose-100 px-2 py-0.5 rounded border border-rose-200">
                        {(() => {
                          const isUSDMode = currency === 'USD' || (selectedStudent.inscriptionUSD > 0 && (selectedStudent.inscriptionNativeHTG || 0) === 0);
                          const remUSD = selectedStudent.inscriptionRemainingUSD !== undefined
                            ? selectedStudent.inscriptionRemainingUSD
                            : (selectedStudent.inscriptionUSD ? Math.max(0, selectedStudent.inscriptionUSD - (selectedStudent.inscriptionPaidUSD || 0)) : 0);
                          const remHTG = Math.max(0, (selectedStudent.inscriptionDue || 0) - (selectedStudent.inscriptionPaid || 0));

                          if (isUSDMode && remUSD > 0) {
                            return `Reste : $${remUSD.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} USD (${remHTG.toLocaleString()} HTG)`;
                          }
                          return `Reste : ${remHTG.toLocaleString()} HTG${remUSD > 0 ? ` (≈ $${remUSD.toLocaleString()} USD)` : ''}`;
                        })()}
                      </span>
                    </div>
                    <p className="text-xs text-rose-900/80 mt-1">
                      Le solde d'inscription doit être intégralement réglé avant toute imputation sur la scolarité.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleFeeTypeChange('INSCRIPTION')}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-900 hover:text-white bg-white hover:bg-rose-600 border border-rose-300 px-3 py-1.5 rounded-xl transition-all shadow-2xs active:scale-95 cursor-pointer ml-auto"
                >
                  <span>Régulariser</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>
          )}

          {/* Module de Règle de Conformité Financière : Frais divers obligatoires */}
          {isMiscForced && (
            <div className="bg-amber-50/90 border border-amber-200/90 p-4 rounded-2xl shadow-xs animate-in fade-in slide-in-from-top-2 mb-6">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 border border-amber-200">
                    <Lock size={16} className="stroke-[2.5]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded bg-amber-600 text-white text-[9px] font-black uppercase tracking-wider">
                        Priorité
                      </span>
                      <span className="text-xs font-bold text-amber-950">
                        Frais divers obligatoires non soldés
                      </span>
                      <span className="text-xs font-mono font-black text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-200">
                        {(() => {
                          const isUSDMode = currency === 'USD' || (selectedStudent.miscUSD > 0 && (selectedStudent.miscNativeHTG || 0) === 0);
                          const remUSD = selectedStudent.miscRemainingUSD !== undefined
                            ? selectedStudent.miscRemainingUSD
                            : (selectedStudent.miscUSD ? Math.max(0, selectedStudent.miscUSD - (selectedStudent.miscPaidUSD || 0)) : 0);
                          const remHTG = Math.max(0, (selectedStudent.miscDue || 0) - (selectedStudent.miscPaid || 0));

                          if (isUSDMode && remUSD > 0) {
                            return `Reste : $${remUSD.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} USD (${remHTG.toLocaleString()} HTG)`;
                          }
                          return `Reste : ${remHTG.toLocaleString()} HTG${remUSD > 0 ? ` (≈ $${remUSD.toLocaleString()} USD)` : ''}`;
                        })()}
                      </span>
                    </div>
                    <p className="text-xs text-amber-900/80 mt-1">
                      Le règlement des frais divers est requis avant tout encaissement sur la scolarité générale.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleFeeTypeChange('DIVERS')}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-900 hover:text-white bg-white hover:bg-amber-600 border border-amber-300 px-3 py-1.5 rounded-xl transition-all shadow-2xs active:scale-95 cursor-pointer ml-auto"
                >
                  <span>Régulariser</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Volet Latéral Formulaire d'Encaissement */}
        <div className="lg:col-span-5">
          <form onSubmit={handleValidation} className="bg-white rounded-3xl shadow-[0_2px_24px_-8px_rgba(0,0,0,0.08)] border border-slate-200 p-6 sm:p-8 h-full flex flex-col justify-between gap-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500" />
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 sm:p-3 bg-blue-50 text-blue-600 rounded-2xl border border-blue-100 shadow-2xs"><Calculator size={22} className="stroke-[2.5]" /></div>
                <div>
                  <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Caisse & Règlement</h3>
                  <p className="text-xs text-slate-500">Enregistrement et ventilation des recettes</p>
                </div>
              </div>
              
              <div className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">Session de Destination</label>
                  <div className="relative">
                    <CalendarCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <select 
                      className="w-full pl-11 pr-10 py-3 rounded-2xl text-sm outline-none border border-slate-200 bg-slate-50/70 text-slate-900 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 appearance-none cursor-pointer transition-all font-medium"
                      value={targetYearId}
                      onChange={(e) => {
                        const newYr = e.target.value;
                        setTargetYearId(newYr);
                        if (selectedStudent) {
                          loadStudentDetails(selectedStudent.id, newYr);
                        }
                      }}
                    >
                      {academicYears.map(y => (
                        <option key={y.id} value={y.id}>
                          {y.label} {y.status === 'ACTIVE' ? '(ACTIVE)' : y.status === 'FUTURE' ? '(PRÉPARATION)' : ''}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                  </div>
                </div>

                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-700">Type de Frais</label>
                      <div className="relative">
                        <Tags className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                          <select 
                            className="w-full pl-11 pr-10 py-3 rounded-2xl text-sm outline-none border border-slate-200 bg-slate-50/70 text-slate-900 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 appearance-none cursor-pointer transition-all disabled:opacity-70 disabled:cursor-not-allowed font-medium"
                            value={feeType}
                            onChange={(e) => handleFeeTypeChange(e.target.value as any)}
                            disabled={isFeeTypeLocked}
                          >
                            <option value="INSCRIPTION">
                              {selectedStudent && selectedStudent.inscriptionDue === (selectedStudent.plan?.reenrollment_fee || 0) && selectedStudent.inscriptionDue > 0 
                                ? 'Réinscription' 
                                : 'Inscription'}
                            </option>
                            <option value="SCOLARITE">{terminology.tuition}</option>
                            <option value="DIVERS">Frais Divers</option>
                            <option value="CREDIT_PORTEFEUILLE">Alimenter Portefeuille</option>
                            {selectedStudent?.adHocCampaigns?.map((c: any) => (
                               <option key={c.id} value={`ADHOC_${c.id}`}>Campagne: {c.name}</option>
                            ))}
                          </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                      </div>
                    </div>

                  <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4`}>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-700">Méthode de Paiement</label>
                      <div className="relative">
                        <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <select 
                          className="w-full pl-11 pr-10 py-3 rounded-2xl text-sm outline-none border border-slate-200 bg-slate-50/70 text-slate-900 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 appearance-none cursor-pointer transition-all font-medium"
                          value={paymentMethod}
                          onChange={(e) => handlePaymentMethodChange(e.target.value)}
                        >
                          {activePaymentMethods.map(m => (
                            <option key={m.code} value={m.code}>{m.name}</option>
                          ))}
                          {feeType !== 'CREDIT_PORTEFEUILLE' && ((currency === 'USD' ? selectedStudent?.wallet_balance_usd : selectedStudent?.wallet_balance_htg) || 0) > 0 && (
                            <option value="Portefeuille">Portefeuille (Solde: {currency === 'USD' ? (selectedStudent?.wallet_balance_usd || 0) : (selectedStudent?.wallet_balance_htg || 0)} {currency})</option>
                          )}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-700">Devise d'Encaissement</label>
                      <div className="relative">
                        <Banknote className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <select 
                          className={`w-full pl-11 pr-10 py-3 rounded-2xl text-sm outline-none border border-slate-200 bg-slate-50/70 text-slate-900 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 appearance-none transition-all font-medium ${
                            (currentMethodConfig?.supported_currencies && currentMethodConfig.supported_currencies.length === 1) || paymentMethod === 'MonCash' ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'
                          }`}
                          value={currency}
                          onChange={(e) => {
                            setCurrency(e.target.value as any);
                            if (montantReel) setMontantReel('');
                          }}
                          disabled={(currentMethodConfig?.supported_currencies && currentMethodConfig.supported_currencies.length === 1) || paymentMethod === 'MonCash'}
                        >
                          {currentMethodConfig?.supported_currencies ? (
                            currentMethodConfig.supported_currencies.map(cur => (
                              <option key={cur} value={cur}>{cur === 'HTG' ? 'Gourdes (HTG)' : 'Dollars (USD)'}</option>
                            ))
                          ) : (
                            <>
                              <option value="HTG">Gourdes (HTG)</option>
                              {paymentMethod !== 'MonCash' && (
                                <option value="USD">Dollars (USD)</option>
                              )}
                            </>
                          )}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                      </div>
                    </div>
                  </div>

                  {/* Instructions ou compte pour la méthode active */}
                  {(currentMethodConfig?.account_info || currentMethodConfig?.instructions) && (
                    <div className="p-3.5 bg-blue-50/60 border border-blue-200/60 rounded-2xl text-xs text-blue-900 space-y-1">
                      {currentMethodConfig.account_info && (
                        <p className="font-bold flex items-center gap-1.5">
                          <span>Compte / Destinataire :</span>
                          <span className="font-mono bg-white px-2 py-0.5 rounded border border-blue-200 text-blue-950 font-black">{currentMethodConfig.account_info}</span>
                        </p>
                      )}
                      {currentMethodConfig.instructions && (
                        <p className="text-slate-600 leading-relaxed">{currentMethodConfig.instructions}</p>
                      )}
                    </div>
                  )}
                  
                  {!isSuperior && (feeType === 'CREDIT_PORTEFEUILLE' || paymentMethod === 'Portefeuille' || paymentMethod === 'Chèque') && (
                    <div className="mt-4 p-4 bg-amber-50/70 border border-amber-200/70 rounded-2xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                      <ShieldAlert className="text-amber-600 mt-0.5 shrink-0 animate-pulse" size={18} />
                      <div>
                        <h6 className="text-xs font-bold text-amber-800 uppercase tracking-tight">Approbation d'un supérieur requise</h6>
                        <p className="text-[11px] text-amber-700 mt-1 leading-relaxed font-medium">
                          Cette transaction ({feeType === 'CREDIT_PORTEFEUILLE' ? 'Alimentation Portefeuille' : paymentMethod === 'Portefeuille' ? 'Paiement par Portefeuille' : 'Paiement par Chèque'}) est hautement sécurisée. Une double-validation par un supérieur (Directeur ou Administrateur) sera requise lors de l'enregistrement.
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {/* Additional fields for methods requiring bank or reference */}
                  {Boolean(currentMethodConfig?.requires_reference || currentMethodConfig?.requires_bank || paymentMethod === 'Chèque' || paymentMethod === 'Dépôt Bancaire' || paymentMethod === 'MonCash') && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in zoom-in-95 duration-200">
                      {Boolean(currentMethodConfig?.requires_bank || paymentMethod === 'Chèque' || paymentMethod === 'Dépôt Bancaire') && (
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold uppercase tracking-wider text-slate-700">Nom de la Banque</label>
                          <div className="relative">
                            <select 
                              required 
                              className="w-full pl-4 pr-10 py-3 border border-slate-200 bg-slate-50/70 focus:bg-white text-slate-900 rounded-2xl text-sm outline-none transition-all focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 appearance-none font-medium" 
                              value={bankName} 
                              onChange={(e) => {
                                const newBank = e.target.value;
                                setBankName(newBank);
                                if (referenceNumber) verifyReference(referenceNumber, newBank);
                              }} 
                            >
                              <option value="" disabled>Sélectionner une banque</option>
                              {(schoolDetails?.global_settings?.banks && schoolDetails?.global_settings?.banks?.length > 0) ? (
                                schoolDetails.global_settings.banks.map((b: string) => (
                                  <option key={b} value={b}>{b}</option>
                                ))
                              ) : (
                                <option value="" disabled>Aucune banque configurée (Voir Paramètres)</option>
                              )}
                            </select>
                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                          </div>
                        </div>
                      )}
                      
                      {Boolean(currentMethodConfig?.requires_reference || paymentMethod === 'MonCash' || paymentMethod === 'Chèque' || paymentMethod === 'Dépôt Bancaire') && (
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                            {paymentMethod === 'MonCash' ? 'ID Transaction' : paymentMethod === 'Chèque' ? 'Numéro du chèque' : 'Numéro du bordereau / transaction / référence'}
                          </label>
                          <div className="relative">
                            <input 
                              type="text" 
                              required 
                              className={`w-full px-4 py-3 border ${refError ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20' : 'border-slate-200 focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10'} bg-slate-50/70 focus:bg-white text-slate-900 rounded-2xl text-sm outline-none transition-all font-medium`} 
                              placeholder="..."
                              value={referenceNumber} 
                              onChange={(e) => {
                                const val = e.target.value.toUpperCase();
                                setReferenceNumber(val);
                                verifyReference(val, bankName);
                              }} 
                            />
                            {isCheckingRef && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400" size={16} />}
                          </div>
                          {refError && <p className="text-xs text-rose-600 font-medium">{refError}</p>}
                        </div>
                      )}

                      {(paymentMethod === 'Dépôt Bancaire' || currentMethodConfig?.requires_bank) && (
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold uppercase tracking-wider text-slate-700">Date du dépôt</label>
                          <input 
                            type="date" 
                            required 
                            max={getLocalTodayString()}
                            className="w-full px-4 py-3 border border-slate-200 bg-slate-50/70 focus:bg-white text-slate-900 rounded-2xl text-sm outline-none transition-all focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 font-medium" 
                            value={depositDate} 
                            onChange={(e) => {
                              const restriction = isRestrictedBankDate(e.target.value);
                              if (restriction.restricted) {
                                toast.error(`Opération impossible : ${restriction.reason}.`);
                                return;
                              }
                              setDepositDate(e.target.value);
                            }} 
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {(paymentMethod === 'Chèque' || paymentMethod === 'MonCash') && (
                    <div className="bg-amber-50/80 p-4 rounded-2xl border border-amber-200 flex items-start gap-3 animate-in fade-in duration-300">
                      <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={16} />
                      <p className="text-xs text-amber-900">
                        <span className="font-bold block mb-1">Validation Requise</span>
                        Ce paiement par {paymentMethod} sera enregistré avec le statut <span className="font-bold">EN ATTENTE</span>. Un reçu provisoire sera émis. La transaction devra être confirmée ultérieurement par l'administration après vérification des fonds.
                      </p>
                    </div>
                  )}
                </div>

                {/* Detected Active Payment Stage Banner */}
                {selectedStudent && feeType === 'SCOLARITE' && paymentLogic?.currentStepLabel && (
                  <div className="bg-emerald-50/90 border border-emerald-200/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-300 shadow-2xs">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                        <Sparkles size={20} className="animate-pulse" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800">
                            📍 Étape Détectée :
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-black tracking-wide">
                            {paymentLogic.currentStepLabel}
                          </span>
                          {paymentLogic.totalSteps > 0 && paymentLogic.currentStepIndex > 0 && (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                              Tranche {paymentLogic.currentStepIndex} / {paymentLogic.totalSteps}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-emerald-900 font-semibold mt-1">
                          Montant attendu : <strong className="font-extrabold text-emerald-950 font-mono">{paymentLogic.suggestion?.toLocaleString()} {currency}</strong>
                          {paymentLogic.stepDueDate && (
                            <span className="text-emerald-700/80 text-[10px] ml-2 italic">
                              • Échéance: {new Date(paymentLogic.stepDueDate).toLocaleDateString()}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    {montantReel !== paymentLogic.suggestion?.toString() && paymentLogic.suggestion > 0 && (
                      <button
                        type="button"
                        onClick={() => setMontantReel(paymentLogic.suggestion.toString())}
                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all active:scale-95 shrink-0 shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Sparkles size={14} /> Appliquer {paymentLogic.suggestion.toLocaleString()} {currency}
                      </button>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex justify-between items-end">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700">Montant à Encaisser ({currency})</label>
                    {paymentLogic?.suggestion > 0 && (
                      <button 
                        type="button" 
                        onClick={() => setMontantReel(paymentLogic.suggestion.toString())}
                        className="text-[10px] font-bold text-blue-600 hover:text-blue-800 transition-colors uppercase tracking-widest bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-lg cursor-pointer"
                      >
                        Suggérer : {paymentLogic.suggestion.toLocaleString()} {currency}
                      </button>
                    )}
                  </div>
                  <div className="relative group">
                    <input 
                      type="number" 
                      required 
                      className="w-full px-5 py-4 border border-slate-200 bg-slate-50/70 focus:bg-white text-slate-900 rounded-2xl text-2xl font-black font-mono outline-none transition-all focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 disabled:opacity-50 disabled:bg-slate-50" 
                      placeholder="0.00" 
                      value={montantReel} 
                      onChange={(e) => setMontantReel(e.target.value)} 
                      disabled={!selectedStudent || isSubmitting} 
                    />
                    {currency === 'USD' ? <DollarSign className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400" size={24} /> : <div className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 font-black text-xl">G</div>}
                  </div>
                  {globalDebt > 0 && (
                    <p className="text-[10px] text-rose-600 font-semibold mt-1">
                      Note : L'{terminology.student.toLowerCase()} a également une dette historique de {globalDebt.toLocaleString()} HTG.
                    </p>
                  )}
                  {montantReel && getActiveFeeTypeCurrency() === 'USD' && (
                    <div className="flex justify-between items-center text-xs font-bold text-slate-500 mt-1">
                      <span></span>
                      {currency === 'USD' ? (
                        <span>Équivalent : {((Math.round(parseFloat(montantReel) * currentExchangeRate * 100)) / 100).toLocaleString()} HTG</span>
                      ) : (
                        <span>Équivalent : {((Math.round((parseFloat(montantReel) / (currentExchangeRate || 1)) * 100)) / 100).toLocaleString()} USD</span>
                      )}
                    </div>
                  )}
                </div>
                
                {globalDebt > 0 && (
                  <div className="bg-rose-50/80 p-4 rounded-2xl border border-rose-200 flex items-start gap-3">
                    <AlertTriangle className="text-rose-600 mt-0.5 shrink-0" size={16} />
                    <p className="text-xs text-rose-900">
                      <strong className="font-bold">Avertissement Arriérés :</strong> L'{terminology.student.toLowerCase()} a une dette globale de {globalDebt.toLocaleString()} HTG. Assurez-vous d'imputer le paiement à la bonne session.
                    </p>
                  </div>
                )}
                
                {!loadingDebt && selectedStudent && !globalDebt && Boolean(selectedStudent?.otherEnrollments && selectedStudent.otherEnrollments.length > 0) && (
                  <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200/70 flex items-start gap-3">
                    <CheckCircle2 className="text-emerald-600 mt-0.5 shrink-0" size={16} />
                    <p className="text-xs text-emerald-900 font-medium leading-relaxed">
                      <strong className="font-bold">Solvabilité Certifiée :</strong> L'{terminology.student.toLowerCase()} est en règle pour l'ensemble des sessions antérieures ({selectedStudent.otherEnrollments.length} session(s) précédente(s)). Le versement sera imputé à la session active.
                    </p>
                  </div>
                )}

                {loadingDebt && (
                  <div className="flex items-center gap-2.5 px-4 py-3 bg-slate-50 rounded-2xl border border-slate-200">
                    <Loader2 size={16} className="animate-spin text-blue-600" />
                    <span className="text-xs font-medium text-slate-500">Audit de solvabilité historique en cours...</span>
                  </div>
                )}
              </div>
            </div>
            <button 
              type="submit" 
              disabled={!selectedStudent || !montantReel || isSubmitting || !activeYear || !!refError} 
              className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-2xl shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2.5 mt-8 cursor-pointer active:scale-98"
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="animate-spin" size={20} />
                  <span>Traitement de l'encaissement...</span>
                </div>
              ) : (
                <>
                  <Save size={19} /> 
                  <span>{selectedStudent?.isNotEnrolledInTargetYear ? "Régulariser l'Inscription" : "Enregistrer l'Encaissement"}</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {showSuperiorAuthModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 max-w-md w-full p-6 space-y-6 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600 shrink-0">
                <ShieldAlert size={24} />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-gray-900">Approbation du Supérieur Requise</h3>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Cette transaction ({feeType === 'CREDIT_PORTEFEUILLE' ? 'Alimentation Portefeuille' : paymentMethod === 'Portefeuille' ? 'Paiement par Portefeuille' : 'Paiement par Chèque'}) est hautement sensible et nécessite la validation d'un supérieur (Directeur ou Administrateur) à l'écran.
                </p>
              </div>
            </div>

            {superiorAuthError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-800 text-xs font-semibold">
                <AlertCircle size={16} className="text-rose-600 shrink-0" />
                <span>{superiorAuthError}</span>
              </div>
            )}

            <form onSubmit={handleSuperiorValidationSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Email du Supérieur</label>
                <input
                  type="email"
                  required
                  disabled={isValidatingSuperior}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  placeholder="superieur@ecole.com"
                  value={superiorEmail}
                  onChange={(e) => setSuperiorEmail(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Mot de Passe</label>
                <input
                  type="password"
                  required
                  disabled={isValidatingSuperior}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  placeholder="••••••••"
                  value={superiorPassword}
                  onChange={(e) => setSuperiorPassword(e.target.value)}
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  disabled={isValidatingSuperior}
                  onClick={() => setShowSuperiorAuthModal(false)}
                  className="flex-1 py-3 border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-xl transition-all"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isValidatingSuperior}
                  className="flex-1 py-3 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-xl shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2"
                >
                  {isValidatingSuperior ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Validation...</span>
                    </>
                  ) : (
                    <>
                      <Key size={16} />
                      <span>Approuver</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <DailyCashClosureModal
        isOpen={isClosureModalOpen}
        onClose={() => setIsClosureModalOpen(false)}
        user={user}
      />
    </div>
  );
};

export default TuitionPaymentForm;