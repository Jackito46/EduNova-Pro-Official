import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../supabase';
import { useSchool } from '../contexts/SchoolContext';
import { UserProfile, SchoolClass } from '../types';
import { 
  FileText, Download, FileSpreadsheet, Calendar, Users, DollarSign, Filter, Loader2, AlertCircle, RefreshCcw, Trash2,
  Search, Building2, TrendingUp, Wallet, Tag, ShieldCheck, ChevronRight, ChevronLeft, ChevronsLeft, ChevronsRight, X, Layers, CreditCard,
  Sparkles, MapPin, Landmark, Banknote, Smartphone, PieChart, ArrowDownRight, ArrowUpRight, Lock, Eye, EyeOff, AlertTriangle, Coins, MessageSquare
} from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useSecurity } from './SecurityGuard';
import { addSecurityWatermark } from '../utils/pdfWatermark';
import { appendSecuritySheet } from '../utils/excelWatermark';
import * as XLSX from 'xlsx';
import { formatStudentName } from '../utils/formatters';
import { FluidLoadingState, SkeletonTable } from './SkeletonLoader';
import { isCashDateLocked } from '../services/cashClosureService';
import { AuditLogger } from '../utils/auditLogger';
import Modal from './Modal';
import { SelectPill, SelectOption } from './SelectPill';
import { DatePickerPill } from './DatePickerPill';
import { ClassSelectorPill } from './ClassSelectorPill';
import { cleanPhoneForWhatsApp, buildPaymentWhatsAppText } from './PaymentWhatsAppShare';

interface ReportsViewProps {
  user: UserProfile;
}

type ReportTab = 'FINANCE' | 'STUDENTS';
type DateRange = 'TODAY' | 'WEEK' | 'MONTH' | 'YEAR' | 'CUSTOM';

// Fonctions utilitaires robustes pour la gestion des dates locales sans décalage de fuseau horaire (ex: Haïti UTC-5)
const getLocalDayString = (d: Date = new Date()): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const parseLocalDateBound = (dateStr: string, isEnd = false): Date => {
  if (!dateStr) return new Date();
  const parts = dateStr.split('-').map(Number);
  const y = parts[0] || new Date().getFullYear();
  const m = (parts[1] || 1) - 1;
  const d = parts[2] || 1;
  if (isEnd) {
    return new Date(y, m, d, 23, 59, 59, 999);
  }
  return new Date(y, m, d, 0, 0, 0, 0);
};

const formatDisplayDateFR = (dateStr: string): string => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const [y, m, d] = parts.map(Number);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      return new Date(y, m - 1, d).toLocaleDateString('fr-FR');
    }
  }
  return dateStr;
};

const computePresetBounds = (range: DateRange): { start: string; end: string } => {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();

  if (range === 'TODAY') {
    const t = getLocalDayString(now);
    return { start: t, end: t };
  } else if (range === 'WEEK') {
    const dayOfWeek = now.getDay();
    const diff = d - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const monday = new Date(y, m, diff);
    const sunday = new Date(y, m, diff + 6);
    return { start: getLocalDayString(monday), end: getLocalDayString(sunday) };
  } else if (range === 'MONTH') {
    const first = new Date(y, m, 1);
    const last = new Date(y, m + 1, 0);
    return { start: getLocalDayString(first), end: getLocalDayString(last) };
  } else if (range === 'YEAR') {
    const first = new Date(y, 0, 1);
    const last = new Date(y, 11, 31);
    return { start: getLocalDayString(first), end: getLocalDayString(last) };
  }
  return { start: getLocalDayString(now), end: getLocalDayString(now) };
};

const ReportsView: React.FC<ReportsViewProps> = ({ user }) => {
  const { ipAddress } = useSecurity();
  const { school, campuses, terminology, currentCampusId, setCurrentCampusId } = useSchool();
  const [activeTab, setActiveTab] = useState<ReportTab>('FINANCE');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Multi-campus & Multi-tenant state
  const hasMultiCampus = Boolean(school?.has_multi_campus && campuses && campuses.length > 1);
  const [selectedCampusFilter, setSelectedCampusFilter] = useState<string>(user.campus_id || currentCampusId || 'ALL');

  // Effective campus ID used for DB filtering
  const effectiveCampusId = user.campus_id ? user.campus_id : (!selectedCampusFilter || selectedCampusFilter.toUpperCase() === 'ALL' ? null : selectedCampusFilter);

  // Options mémoïsées pour les menus déroulants harmonisés (SelectPill)
  const campusOptions: SelectOption[] = useMemo(() => {
    return [
      { value: 'ALL', label: 'Toutes les Annexes (Siège)', badge: 'Siège' },
      ...(campuses || []).map(c => ({
        value: c.id,
        label: c.name,
        badge: 'Annexe'
      }))
    ];
  }, [campuses]);

  // Finance State
  const todayStr = useMemo(() => getLocalDayString(), []);
  const [dateRange, setDateRange] = useState<DateRange>('TODAY');
  const [startDate, setStartDate] = useState<string>(() => getLocalDayString());
  const [endDate, setEndDate] = useState<string>(() => getLocalDayString());
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>('ALL');
  const [feeTypeFilter, setFeeTypeFilter] = useState<string>('ALL');
  const [currencyFilter, setCurrencyFilter] = useState<string>('ALL');
  const [payments, setPayments] = useState<any[]>([]);
  const [financeCurrentPage, setFinanceCurrentPage] = useState<number>(1);
  const [financeItemsPerPage, setFinanceItemsPerPage] = useState<number>(25);
  const [financeStats, setFinanceStats] = useState({ 
    totalHTG: 0, 
    totalUSD: 0,
    totalEquivHTG: 0,
    totalReductions: 0,
    byType: {} as Record<string, {htg: number, usd: number, equiv_htg: number, count: number}>, 
    byClass: {} as Record<string, {htg: number, usd: number, equiv_htg: number, count: number}>,
    byMethod: {} as Record<string, {htg: number, usd: number, equiv_htg: number, count: number}>,
    byCampus: {} as Record<string, {htg: number, usd: number, equiv_htg: number, count: number}>
  });

  // Options pour les filtres harmonisés (SelectPill)
  const currencyFilterOptions: SelectOption[] = useMemo(() => {
    return [
      { value: 'ALL', label: 'Toutes les devises (HTG & USD)' },
      { value: 'HTG', label: 'Devise Locale (HTG uniquement)', badge: 'Gourdes' },
      { value: 'USD', label: 'Devise Étrangère (USD uniquement)', badge: 'Dollars' },
    ];
  }, []);

  const paymentMethodOptions: SelectOption[] = useMemo(() => {
    return [
      { value: 'ALL', label: 'Tous les modes de règlement' },
      { value: 'Cash', label: 'Cash / Espèces', badge: 'Espèces' },
      { value: 'Dépôt', label: 'Dépôt Bancaire / Virement', badge: 'Banque' },
      { value: 'Chèque', label: 'Chèque Bancaire', badge: 'Chèque' },
      { value: 'MonCash', label: 'MonCash', badge: 'Mobile' },
      { value: 'Natcash', label: 'Natcash', badge: 'Mobile' },
      { value: 'Carte', label: 'Carte Bancaire / TPE', badge: 'Carte' },
      { value: 'Portefeuille', label: 'Portefeuille Élève', badge: 'Avoir' },
    ];
  }, []);

  const feeTypeFilterOptions: SelectOption[] = useMemo(() => {
    const types = new Set<string>();
    payments.forEach(p => {
      if (p.type) types.add(p.type);
    });
    return [
      { value: 'ALL', label: 'Tous les types de frais' },
      ...Array.from(types).sort().map(t => ({
        value: t,
        label: t
      }))
    ];
  }, [payments]);

  // Students State
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [students, setStudents] = useState<any[]>([]);
  const [studentSearchTerm, setStudentSearchTerm] = useState<string>('');
  const [studentCurrentPage, setStudentCurrentPage] = useState<number>(1);
  const [studentItemsPerPage, setStudentItemsPerPage] = useState<number>(25);
  const [studentGenderFilter, setStudentGenderFilter] = useState<'ALL' | 'M' | 'F'>('ALL');

  // Cancellation Modal & Supervisor Pass State
  const [cancellingPayment, setCancellingPayment] = useState<any | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [validatorEmail, setValidatorEmail] = useState<string>('');
  const [validatorPassword, setValidatorPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isCancelling, setIsCancelling] = useState<boolean>(false);

  // Keep campus state in sync if global context updates
  useEffect(() => {
    if (user.campus_id) {
      setSelectedCampusFilter(user.campus_id);
    } else if (currentCampusId && selectedCampusFilter === 'ALL') {
      setSelectedCampusFilter(currentCampusId);
    }
  }, [user.campus_id, currentCampusId]);

  // Fetch Classes
  useEffect(() => {
    const fetchClasses = async () => {
      let clsQuery = supabase.from('classes').select('*').eq('school_id', user.school_id).order('name');
      if (effectiveCampusId) {
        clsQuery = clsQuery.eq('campus_id', effectiveCampusId);
      }
      const { data } = await clsQuery;
      if (data) setClasses(data);
    };
    fetchClasses();
  }, [user.school_id, effectiveCampusId]);

  // Fetch Finance Data
  const fetchFinanceData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Conversion stricte des bornes YYYY-MM-DD en heures locales exactes (00:00:00.000 et 23:59:59.999)
      const startLocal = parseLocalDateBound(startDate, false);
      const endLocal = parseLocalDateBound(endDate, true);

      // Conversion en ISO UTC pour Supabase sans décalage indésirable
      const startUTCStr = startLocal.toISOString();
      const endUTCStr = endLocal.toISOString();

      let paymentsQuery = supabase
        .from('payments')
        .select('*, campaign:ad_hoc_campaigns(id, name)')
        .eq('school_id', user.school_id)
        .gte('created_at', startUTCStr)
        .lte('created_at', endUTCStr);
        
      if (effectiveCampusId) {
        paymentsQuery = paymentsQuery.eq('campus_id', effectiveCampusId);
      }
      
      const { data: paymentsData, error: paymentsError } = await paymentsQuery.order('created_at', { ascending: false });

      if (paymentsError) throw paymentsError;

      let suppliesQuery = supabase
        .from('school_supplies')
        .select('*')
        .eq('school_id', user.school_id)
        .gte('created_at', startUTCStr)
        .lte('created_at', endUTCStr);

      if (effectiveCampusId) {
        suppliesQuery = suppliesQuery.eq('campus_id', effectiveCampusId);
      }
        
      const { data: suppliesData, error: suppliesError } = await suppliesQuery.order('created_at', { ascending: false });

      if (suppliesError) throw suppliesError;

      let studentsQuery = supabase
        .from('students')
        .select('id, first_name, last_name, class_id, campus_id, discount_amount')
        .eq('school_id', user.school_id);
      
      if (effectiveCampusId) {
        studentsQuery = studentsQuery.eq('campus_id', effectiveCampusId);
      }

      const { data: studentsData, error: studentsError } = await studentsQuery;

      if (studentsError) throw studentsError;

      let totalReductions = 0;
      studentsData?.forEach(s => {
        totalReductions += Number(s.discount_amount || 0);
      });

      let classesQuery = supabase
        .from('classes')
        .select('id, name')
        .eq('school_id', user.school_id);
        
      if (effectiveCampusId) {
        classesQuery = classesQuery.eq('campus_id', effectiveCampusId);
      }

      const { data: classesData, error: classesError } = await classesQuery;

      if (classesError) throw classesError;

      const classesMap = new Map();
      classesData?.forEach(c => {
        classesMap.set(c.id, c.name);
      });

      const campusesMap = new Map();
      campuses?.forEach(c => {
        campusesMap.set(c.id, c.name);
      });

      const studentsMap = new Map();
      studentsData?.forEach(s => {
        studentsMap.set(s.id, {
          ...s,
          className: s.class_id ? classesMap.get(s.class_id) || `${terminology.option} Inconnue` : 'Non assigné'
        });
      });

      let allTransactions: any[] = [];

      (paymentsData || []).forEach(p => {
        if (p.status === 'ANNULE' || p.moncash_status === 'PENDING' || (p.payment_method && (p.payment_method.includes('EN ATTENTE') || p.payment_method.includes('REJETÉ')))) return;
        
        // Filtrage strict par date locale pour garantir zéro fuite hors de l'intervalle sélectionné
        const pDateStr = getLocalDayString(new Date(p.created_at));
        if (pDateStr < startDate || pDateStr > endDate) return;

        let resolvedType = p.type || terminology.tuition;
        if (p.campaign?.name) {
          resolvedType = `Campagne: ${p.campaign.name}`;
        } else if (p.ad_hoc_campaign_id) {
          resolvedType = 'Frais de Campagne';
        } else if (p.fee_type === 'INSCRIPTION' || p.nature === 'INSCRIPTION' || p.nature === 'Inscription' || p.nature === "Frais d'inscription" || p.type?.toLowerCase().includes('inscription')) {
          resolvedType = 'Inscription';
        } else if (p.fee_type === 'SCOLARITE' || p.nature === 'Scolarité' || p.nature === 'Scolarite' || p.type?.toLowerCase().includes('scolarite') || p.type?.toLowerCase().includes('académique')) {
          resolvedType = terminology.tuition;
        } else if (p.fee_type === 'DIVERS' || p.type === 'Frais Divers' || p.nature === 'Frais Divers') {
          resolvedType = 'Frais Divers';
        }

        const campusName = p.campus_id ? (campusesMap.get(p.campus_id) || 'Annexe Dédiée') : 'Siège / Principal';

        const isUSD = p.currency === 'USD';
        const rawAmount = Number(p.amount || 0);
        const rawOriginal = Number(p.original_amount || p.amount || 0);
        const rawEquiv = Number(p.amount_htg_equivalent || 0);

        let originalAmount = rawOriginal;
        let equivHTG = rawEquiv;
        let appliedRate = p.exchange_rate_applied ? Number(p.exchange_rate_applied) : null;

        if (isUSD) {
          if (rawEquiv > 0) {
            equivHTG = rawEquiv;
            originalAmount = rawOriginal > 0 ? rawOriginal : (rawAmount > 0 && rawAmount !== rawEquiv ? rawAmount : (appliedRate ? Math.round(rawEquiv / appliedRate) : rawAmount));
          } else if (rawAmount > 0 && appliedRate) {
            equivHTG = Math.round(rawAmount * appliedRate);
            originalAmount = rawAmount;
          } else if (rawAmount > 0) {
            appliedRate = 145;
            equivHTG = Math.round(rawAmount * appliedRate);
            originalAmount = rawAmount;
          }
          if (!appliedRate && originalAmount > 0 && equivHTG > 0) {
            appliedRate = Math.round(equivHTG / originalAmount);
          }
        } else {
          equivHTG = rawAmount > 0 ? rawAmount : rawOriginal;
          originalAmount = equivHTG;
        }

        allTransactions.push({
          id: p.id,
          created_at: p.created_at,
          amount: equivHTG, // Montant équivalent consolidé en HTG
          original_amount: originalAmount, // Montant réel encaissé en devise originale
          currency: p.currency || 'HTG',
          is_foreign_currency: isUSD,
          exchange_rate_applied: appliedRate,
          type: resolvedType,
          method: p.payment_method || 'Cash',
          campus_id: p.campus_id,
          campus_name: campusName,
          students: studentsMap.get(p.student_id) || null
        });
      });

      const groupedSupplies = new Map<string, any>();

      (suppliesData || []).forEach(s => {
        if (s.status === 'ANNULE' || (s.payment_method && (s.payment_method.includes('EN ATTENTE') || s.payment_method.includes('REJETÉ')))) return;
        
        // Filtrage strict par date locale pour les fournitures
        const sDateStr = getLocalDayString(new Date(s.created_at));
        if (sDateStr < startDate || sDateStr > endDate) return;

        const txId = s.transaction_id || s.id;
        const campusName = s.campus_id ? (campusesMap.get(s.campus_id) || 'Annexe Dédiée') : 'Siège / Principal';
        const isUSD = s.currency === 'USD';
        const sRawAmount = Number(s.total_amount || 0);
        const sEquiv = Number(s.amount_htg_equivalent || (isUSD ? sRawAmount * 145 : sRawAmount));

        if (groupedSupplies.has(txId)) {
          const existing = groupedSupplies.get(txId);
          existing.amount += sEquiv;
          existing.original_amount += sRawAmount;
        } else {
          groupedSupplies.set(txId, {
            id: txId,
            created_at: s.created_at,
            amount: sEquiv,
            original_amount: sRawAmount,
            currency: s.currency || 'HTG',
            is_foreign_currency: isUSD,
            exchange_rate_applied: isUSD ? 145 : null,
            type: 'Fournitures',
            method: s.payment_method || 'Cash',
            campus_id: s.campus_id,
            campus_name: campusName,
            students: studentsMap.get(s.student_id) || null
          });
        }
      });
      
      allTransactions.push(...Array.from(groupedSupplies.values()));

      allTransactions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setPayments(allTransactions);

      // Calculate stats
      let totalHTG = 0;
      let totalUSD = 0;
      let totalEquivHTG = 0;
      const byType: Record<string, {htg: number, usd: number, equiv_htg: number, count: number}> = {};
      const byClass: Record<string, {htg: number, usd: number, equiv_htg: number, count: number}> = {};
      const byMethod: Record<string, {htg: number, usd: number, equiv_htg: number, count: number}> = {};
      const byCampus: Record<string, {htg: number, usd: number, equiv_htg: number, count: number}> = {};
      
      allTransactions.forEach(p => {
        const isUSD = p.currency === 'USD';
        if (isUSD) {
          totalUSD += Number(p.original_amount || 0);
        } else {
          totalHTG += Number(p.original_amount || 0);
        }
        totalEquivHTG += Number(p.amount || 0);
        
        if (!byType[p.type]) byType[p.type] = { htg: 0, usd: 0, equiv_htg: 0, count: 0 };
        byType[p.type].count += 1;
        byType[p.type].equiv_htg += Number(p.amount || 0);
        isUSD ? byType[p.type].usd += Number(p.original_amount || 0) : byType[p.type].htg += Number(p.original_amount || 0);
        
        if (!byMethod[p.method]) byMethod[p.method] = { htg: 0, usd: 0, equiv_htg: 0, count: 0 };
        byMethod[p.method].count += 1;
        byMethod[p.method].equiv_htg += Number(p.amount || 0);
        isUSD ? byMethod[p.method].usd += Number(p.original_amount || 0) : byMethod[p.method].htg += Number(p.original_amount || 0);
        
        const className = p.students?.className || 'Non assigné';
        if (!byClass[className]) byClass[className] = { htg: 0, usd: 0, equiv_htg: 0, count: 0 };
        byClass[className].count += 1;
        byClass[className].equiv_htg += Number(p.amount || 0);
        isUSD ? byClass[className].usd += Number(p.original_amount || 0) : byClass[className].htg += Number(p.original_amount || 0);

        const campusName = p.campus_name || 'Siège / Principal';
        if (!byCampus[campusName]) byCampus[campusName] = { htg: 0, usd: 0, equiv_htg: 0, count: 0 };
        byCampus[campusName].count += 1;
        byCampus[campusName].equiv_htg += Number(p.amount || 0);
        isUSD ? byCampus[campusName].usd += Number(p.original_amount || 0) : byCampus[campusName].htg += Number(p.original_amount || 0);
      });

      setFinanceStats({ totalHTG, totalUSD, totalEquivHTG, totalReductions, byType, byClass, byMethod, byCampus });

    } catch (err: any) {
      console.error("Error fetching finance data:", err);
      setError("Erreur lors du chargement du bilan financier : " + (err.message || err.toString()));
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, user.school_id, effectiveCampusId, terminology]);

  const handleShareReceiptWhatsApp = (p: any) => {
    const studentFullName = p.students
      ? `${p.students.first_name || ''} ${p.students.last_name || ''}`.trim()
      : 'Élève';
    const targetPhone = p.students?.parent_phone || p.students?.phone || '';
    const cleaned = cleanPhoneForWhatsApp(targetPhone);
    const msg = buildPaymentWhatsAppText({
      schoolName: school?.name || 'Établissement Scolaire',
      studentName: studentFullName,
      studentClass: p.students?.className,
      parentName: p.students?.parent_name,
      amount: p.original_amount || p.amount,
      currency: p.currency || 'HTG',
      feeTypeLabel: p.type || 'Frais de scolarité',
      transactionRef: p.id ? String(p.id).substring(0, 8).toUpperCase() : 'REC',
      paymentMethod: p.method
    });
    const waUrl = cleaned
      ? `https://wa.me/${cleaned}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
    toast.success("WhatsApp ouvert avec le reçu officiel pré-rempli !");
  };

  const canCancelTransaction = user?.is_super_admin || ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ADMIN', 'ACCOUNTANT', 'DIRECTOR', 'COMPTABLE', 'DIRECTEUR', 'SECRETARY', 'SECRETAIRE'].includes(user?.role || '');

  const openCancelModal = async (payment: any) => {
    // Find transaction date in local time
    const txDate = payment?.created_at ? getLocalDayString(new Date(payment.created_at)) : startDate;
    const txCampusId = payment?.campus_id || effectiveCampusId || null;

    // Check if cash date is closed & locked
    const lockCheck = await isCashDateLocked(user.school_id, txCampusId, txDate);
    if (lockCheck.isLocked) {
      toast.error(`🔒 Opération bloquée : La caisse de la journée du ${txDate} est déjà clôturée et verrouillée. Veuillez déverrouiller la caisse avec un compte administrateur avant toute modification.`);
      return;
    }

    const isCapable = user.role === 'SUPER_ADMIN' || user.role === 'SCHOOL_ADMIN' || user.role === 'DIRECTOR' || user.is_super_admin;
    setValidatorEmail(isCapable ? user.email || '' : '');
    setValidatorPassword('');
    setShowPassword(false);
    setCancelReason('');
    setCancellingPayment(payment);
  };

  const handleConfirmCancelTransaction = async () => {
    if (!cancellingPayment) return;
    if (!cancelReason.trim()) {
      toast.error("Veuillez indiquer le motif de l'annulation.");
      return;
    }
    if (!validatorEmail.trim() || !validatorPassword.trim()) {
      toast.error("Veuillez saisir l'adresse email et le mot de passe de l'administrateur autorisant.");
      return;
    }

    // Lock check before actual update
    const txDate = cancellingPayment.created_at ? getLocalDayString(new Date(cancellingPayment.created_at)) : startDate;
    const txCampusId = cancellingPayment.campus_id || effectiveCampusId || null;
    const lockCheck = await isCashDateLocked(user.school_id, txCampusId, txDate);
    if (lockCheck.isLocked) {
      toast.error(`🔒 Opération bloquée : La caisse du ${txDate} est verrouillée.`);
      return;
    }

    setIsCancelling(true);
    try {
      // 1. Verify supervisor credentials via backend
      const checkRes = await fetch('/api/verify-admin-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: validatorEmail,
          password: validatorPassword,
          school_id: user.school_id
        })
      });

      const checkData = await checkRes.json();
      if (!checkRes.ok || !checkData.success) {
        throw new Error(checkData.error || "La validation par mot de passe administrateur a échoué.");
      }

      const authorizer = checkData.profile;

      // 2. Determine target table
      const tableName = cancellingPayment.source || 'payments';

      const { error: cancelErr } = await supabase
        .from(tableName)
        .update({
          status: 'ANNULE',
          cancelled_at: new Date().toISOString(),
          cancelled_by: user.id,
          cancel_reason: `${cancelReason} (Autorisé sur place par ${authorizer.full_name || authorizer.email} [${authorizer.role}])`
        })
        .eq('id', cancellingPayment.id);

      if (cancelErr) throw cancelErr;

      // 3. Log audit
      await AuditLogger.log({
        school_id: user.school_id || '',
        user_id: user.id,
        action: 'PAYMENT_CANCELLED',
        entity_type: 'payment',
        entity_id: cancellingPayment.id,
        details: {
          reason: cancelReason,
          receipt_number: cancellingPayment.receipt_number || cancellingPayment.ref,
          amount: cancellingPayment.amount,
          currency: cancellingPayment.currency,
          source: tableName,
          cancelled_by_user_name: user.full_name,
          cancelled_by_user_role: user.role,
          authorized_by_email: authorizer.email,
          authorized_by_name: authorizer.full_name,
          authorized_by_id: authorizer.id,
          authorized_by_role: authorizer.role
        }
      });

      toast.success(`Transaction annulée avec succès (Autorisée par ${authorizer.full_name || authorizer.email}).`);
      setCancellingPayment(null);
      fetchFinanceData();
    } catch (err: any) {
      console.error("Erreur annulation transaction:", err);
      toast.error(err.message || "Erreur lors de l'annulation de la transaction.");
    } finally {
      setIsCancelling(false);
    }
  };

  // Fetch Students Data
  const fetchStudentsData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('students')
        .select(`
          *,
          classes (name),
          school_campuses (name)
        `)
        .eq('school_id', user.school_id)
        .order('last_name');

      if (effectiveCampusId) {
        query = query.eq('campus_id', effectiveCampusId);
      }

      const isAllClasses = !selectedClassId || selectedClassId.toLowerCase() === 'all';
      if (!isAllClasses) {
        query = query.eq('class_id', selectedClassId);
      }

      const { data, error } = await query;
      if (error) throw error;

      setStudents(data || []);
    } catch (err: any) {
      console.error("Error fetching students data:", err);
      setError(`Erreur lors du chargement de la liste des ${terminology.student.toLowerCase()}s.`);
    } finally {
      setLoading(false);
    }
  }, [selectedClassId, user.school_id, effectiveCampusId, terminology]);

  useEffect(() => {
    if (activeTab === 'FINANCE') {
      fetchFinanceData();
    } else {
      fetchStudentsData();
    }
  }, [activeTab, dateRange, startDate, endDate, selectedClassId, effectiveCampusId]);

  // Client-side search and filtering for Payments
  const filteredPayments = useMemo(() => {
    let list = payments;
    if (paymentMethodFilter !== 'ALL') {
      const pTerm = paymentMethodFilter.toLowerCase();
      list = list.filter(p => (p.method || '').toLowerCase().includes(pTerm));
    }
    if (feeTypeFilter !== 'ALL') {
      const fTerm = feeTypeFilter.toLowerCase();
      list = list.filter(p => (p.type || '').toLowerCase().includes(fTerm));
    }
    if (currencyFilter !== 'ALL') {
      list = list.filter(p => (p.currency || 'HTG') === currencyFilter);
    }
    if (!searchTerm.trim()) return list;
    const term = searchTerm.toLowerCase().trim();
    return list.filter(p => {
      const studentName = p.students ? `${p.students.first_name} ${p.students.last_name}`.toLowerCase() : '';
      const className = p.students?.className ? p.students.className.toLowerCase() : '';
      const feeType = (p.type || '').toLowerCase();
      const method = (p.method || '').toLowerCase();
      const currency = (p.currency || '').toLowerCase();
      const amountStr = p.amount ? p.amount.toString() : '';
      const origAmountStr = p.original_amount ? p.original_amount.toString() : '';
      const campusName = (p.campus_name || '').toLowerCase();

      return studentName.includes(term) ||
             className.includes(term) ||
             feeType.includes(term) ||
             method.includes(term) ||
             currency.includes(term) ||
             amountStr.includes(term) ||
             origAmountStr.includes(term) ||
             campusName.includes(term);
    });
  }, [payments, searchTerm, paymentMethodFilter, feeTypeFilter, currencyFilter]);

  const financeTotalPages = Math.max(1, Math.ceil(filteredPayments.length / financeItemsPerPage));

  // Reset or adjust page when out of bounds
  useEffect(() => {
    if (financeCurrentPage > financeTotalPages) {
      setFinanceCurrentPage(financeTotalPages);
    }
  }, [financeTotalPages, financeCurrentPage]);

  // Reset to page 1 when dataset or filters change
  useEffect(() => {
    setFinanceCurrentPage(1);
  }, [paymentMethodFilter, feeTypeFilter, currencyFilter, startDate, endDate, selectedCampusFilter, payments.length]);

  const paginatedPayments = useMemo(() => {
    const start = (financeCurrentPage - 1) * financeItemsPerPage;
    return filteredPayments.slice(start, start + financeItemsPerPage);
  }, [filteredPayments, financeCurrentPage, financeItemsPerPage]);

  const financePageSubtotals = useMemo(() => {
    let localHTG = 0;
    let foreignUSD = 0;
    let totalEquivHTG = 0;
    let countUSD = 0;
    let countHTG = 0;
    paginatedPayments.forEach(p => {
      if (p.currency === 'USD') {
        foreignUSD += Number(p.original_amount || 0);
        countUSD++;
      } else {
        localHTG += Number(p.original_amount || p.amount || 0);
        countHTG++;
      }
      totalEquivHTG += Number(p.amount || 0);
    });
    return { localHTG, foreignUSD, totalEquivHTG, countUSD, countHTG };
  }, [paginatedPayments]);

  const financeFilteredTotals = useMemo(() => {
    let localHTG = 0;
    let foreignUSD = 0;
    let totalEquivHTG = 0;
    let countUSD = 0;
    let countHTG = 0;
    filteredPayments.forEach(p => {
      if (p.currency === 'USD') {
        foreignUSD += Number(p.original_amount || 0);
        countUSD++;
      } else {
        localHTG += Number(p.original_amount || p.amount || 0);
        countHTG++;
      }
      totalEquivHTG += Number(p.amount || 0);
    });
    return { localHTG, foreignUSD, totalEquivHTG, countUSD, countHTG };
  }, [filteredPayments]);

  const financePaginationPages = useMemo(() => {
    const total = financeTotalPages;
    const current = financeCurrentPage;
    if (total <= 5) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    const pages: (number | string)[] = [];
    pages.push(1);
    
    if (current > 3) {
      pages.push('ellipsis-start');
    }

    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (current < total - 2) {
      pages.push('ellipsis-end');
    }
    
    pages.push(total);
    return pages;
  }, [financeTotalPages, financeCurrentPage]);

  // Client-side search and filtering for Students
  const filteredStudents = useMemo(() => {
    let list = students;
    if (studentGenderFilter !== 'ALL') {
      list = list.filter(s => {
        const g = (s.gender || '').toUpperCase();
        return g.startsWith(studentGenderFilter);
      });
    }
    if (!studentSearchTerm.trim()) return list;
    const term = studentSearchTerm.toLowerCase().trim();
    return list.filter(s => {
      const fullName = `${s.first_name || ''} ${s.last_name || ''} ${s.first_name || ''}`.toLowerCase();
      const matricule = (s.matricule || s.id || '').toLowerCase();
      const className = (s.classes?.name || '').toLowerCase();
      const campusName = (s.school_campuses?.name || '').toLowerCase();
      const parentName = (s.parent_name || '').toLowerCase();
      const parentPhone = (s.parent_phone || '').toLowerCase();
      return fullName.includes(term) ||
             matricule.includes(term) ||
             className.includes(term) ||
             campusName.includes(term) ||
             parentName.includes(term) ||
             parentPhone.includes(term);
    });
  }, [students, studentSearchTerm, studentGenderFilter]);

  const studentTotalPages = Math.max(1, Math.ceil(filteredStudents.length / studentItemsPerPage));

  // Reset page when out of bounds or on filter updates
  useEffect(() => {
    if (studentCurrentPage > studentTotalPages) {
      setStudentCurrentPage(studentTotalPages);
    }
  }, [studentTotalPages, studentCurrentPage]);

  const paginatedStudents = useMemo(() => {
    const start = (studentCurrentPage - 1) * studentItemsPerPage;
    return filteredStudents.slice(start, start + studentItemsPerPage);
  }, [filteredStudents, studentCurrentPage, studentItemsPerPage]);

  const studentStats = useMemo(() => {
    const total = students.length;
    const filteredTotal = filteredStudents.length;
    let boys = 0;
    let girls = 0;
    filteredStudents.forEach(s => {
      const g = (s.gender || '').toUpperCase();
      if (g.startsWith('M')) boys++;
      else if (g.startsWith('F')) girls++;
    });
    return { total, filteredTotal, boys, girls };
  }, [students.length, filteredStudents]);

  // Helper for scope label in exports
  const getScopeLabel = () => {
    if (user.campus_id) {
      const userCamp = campuses.find(c => c.id === user.campus_id);
      return `Annexe / Campus : ${userCamp?.name || 'Dédié'}`;
    }
    if (selectedCampusFilter !== 'ALL') {
      const selCamp = campuses.find(c => c.id === selectedCampusFilter);
      return `Annexe / Campus : ${selCamp?.name || 'Dédié'}`;
    }
    return hasMultiCampus ? 'Toutes les Annexes (Vue Globale Siège)' : 'Établissement Principal';
  };

  // --- EXPORT FUNCTIONS ---

  const exportFinancePDF = () => {
    if (loading) {
      toast.error("Veuillez patienter pendant la synchronisation des données...");
      return;
    }
    if (filteredPayments.length === 0) {
      toast.error("Aucune transaction à exporter pour cette période.");
      return;
    }
    const doc = new jsPDF();
    
    // Header styling
    doc.setFontSize(18);
    doc.text(school?.name || 'Bilan Financier', 14, 18);
    doc.setFontSize(14);
    doc.text('Rapport du Bilan Financier', 14, 26);
    
    doc.setFontSize(10);
    doc.text(`Portée : ${getScopeLabel()}`, 14, 33);
    doc.text(`Période : Du ${formatDisplayDateFR(startDate)} au ${formatDisplayDateFR(endDate)}`, 14, 39);
    doc.text(`Total Recettes HTG : ${(financeStats.totalHTG || 0).toLocaleString('fr-FR')} HTG | Total USD : ${(financeStats.totalUSD || 0).toLocaleString('fr-FR')} USD`, 14, 45);

    // Summary Table by Type
    const summaryData = Object.entries(financeStats.byType || {}).map(([type, amounts]) => [
      type,
      amounts.count,
      amounts.htg > 0 || amounts.usd === 0 ? `${amounts.htg.toLocaleString('fr-FR')} HTG` : '-',
      amounts.usd > 0 ? `${amounts.usd.toLocaleString('fr-FR')} USD` : '-'
    ]);

    autoTable(doc, {
      startY: 52,
      head: [['Type de Frais', 'Nb Trans.', 'Montant (HTG)', 'Montant (USD)']],
      body: summaryData,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] } // Indigo-600
    });

    // Summary Table by Class
    const classSummaryData = Object.entries(financeStats.byClass || {})
      .sort((a, b) => (b[1].htg + b[1].usd) - (a[1].htg + a[1].usd))
      .map(([className, amounts]) => [
        className,
        amounts.count,
        amounts.htg > 0 || amounts.usd === 0 ? `${amounts.htg.toLocaleString('fr-FR')} HTG` : '-',
        amounts.usd > 0 ? `${amounts.usd.toLocaleString('fr-FR')} USD` : '-'
      ]);

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 8,
      head: [[terminology.option, 'Nb Trans.', 'Montant (HTG)', 'Montant (USD)']],
      body: classSummaryData,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42] } // Slate-900
    });

    // Details Table
    const detailsData = filteredPayments.map(p => [
      p.created_at ? new Date(p.created_at).toLocaleDateString('fr-FR') : '-',
      p.students ? formatStudentName(p.students.last_name, p.students.first_name).fullName : 'N/A',
      p.students?.className || 'Non assigné',
      hasMultiCampus ? (p.campus_name || '-') : '-',
      p.type || 'Autre',
      p.method || 'Cash',
      p.currency !== 'HTG' 
        ? `${(p.original_amount || 0).toLocaleString('fr-FR')} ${p.currency || 'USD'} (${(p.amount || 0).toLocaleString('fr-FR')} HTG)`
        : `${(p.amount || 0).toLocaleString('fr-FR')} HTG`
    ]);

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 10,
      head: [['Date', terminology.student, terminology.option, 'Annexe', 'Type', 'Mode', 'Montant']],
      body: detailsData,
      theme: 'striped',
      headStyles: { fillColor: [15, 23, 42] },
      styles: { fontSize: 8 }
    });

    addSecurityWatermark(doc, { user, ipAddress });
    doc.save(`Bilan_Financier_${startDate}_${endDate}.pdf`);
  };

  const exportFinanceExcel = () => {
    if (loading) {
      toast.error("Veuillez patienter pendant la synchronisation des données...");
      return;
    }
    if (filteredPayments.length === 0) {
      toast.error("Aucune transaction à exporter pour cette période.");
      return;
    }
    const wsData = filteredPayments.map(p => ({
      'Date': p.created_at ? new Date(p.created_at).toLocaleDateString('fr-FR') : '-',
      'Heure': p.created_at ? new Date(p.created_at).toLocaleTimeString('fr-FR') : '-',
      [terminology.student]: p.students ? formatStudentName(p.students.last_name, p.students.first_name).fullName : 'N/A',
      [terminology.option]: p.students?.className || 'Non assigné',
      'Annexe / Campus': p.campus_name || 'Siège',
      'Type de Frais': p.type || 'Autre',
      'Mode de Paiement': p.method || 'Cash',
      'Montant Original': p.original_amount ?? p.amount ?? 0,
      'Devise': p.currency || 'HTG',
      'Montant Equiv. (HTG)': p.amount ?? 0
    }));

    const ws = XLSX.utils.json_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Recettes");
    appendSecuritySheet(wb, { user, ipAddress });
    XLSX.writeFile(wb, `Bilan_Financier_${startDate}_${endDate}.xlsx`);
  };

  const exportStudentsPDF = () => {
    if (loading) {
      toast.error("Veuillez patienter pendant le chargement des effectifs...");
      return;
    }
    if (filteredStudents.length === 0) {
      toast.error(`Aucun ${terminology.student.toLowerCase()} trouvé pour cette sélection.`);
      return;
    }
    const doc = new jsPDF();
    const isAllClasses = !selectedClassId || selectedClassId.toLowerCase() === 'all';
    const className = isAllClasses ? 'Toutes les classes' : classes.find(c => c.id === selectedClassId)?.name || '';
    const listToExport = filteredStudents;
    
    doc.setFontSize(18);
    doc.text(school?.name || 'Administration Scolaire', 14, 18);
    doc.setFontSize(14);
    doc.text(`Liste des ${terminology.students}`, 14, 26);
    
    doc.setFontSize(10);
    doc.text(`Portée : ${getScopeLabel()}`, 14, 33);
    doc.text(`${terminology.option} : ${className}`, 14, 39);
    doc.text(`Effectif total : ${listToExport.length} ${terminology.student.toLowerCase()}s`, 14, 45);

    const tableData = listToExport.map((s, index) => [
      index + 1,
      s.last_name || '',
      s.first_name || '',
      s.classes?.name || '-',
      hasMultiCampus ? (s.school_campuses?.name || 'Siège') : '-',
      s.gender?.charAt(0) || '-',
      s.parent_phone || '-'
    ]);

    autoTable(doc, {
      startY: 50,
      head: [['N°', 'Nom', 'Prénom', terminology.option, 'Annexe', 'Sexe', 'Téléphone']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42] },
      styles: { fontSize: 8.5 }
    });

    addSecurityWatermark(doc, { user, ipAddress });
    doc.save(`Liste_Etudiants_${className.replace(/\s+/g, '_')}.pdf`);
  };

  const exportStudentsExcel = () => {
    if (loading) {
      toast.error("Veuillez patienter pendant le chargement des effectifs...");
      return;
    }
    if (filteredStudents.length === 0) {
      toast.error(`Aucun ${terminology.student.toLowerCase()} trouvé pour cette sélection.`);
      return;
    }
    const isAllClasses = !selectedClassId || selectedClassId.toLowerCase() === 'all';
    const className = isAllClasses ? 'Toutes_les_classes' : classes.find(c => c.id === selectedClassId)?.name || '';
    const listToExport = filteredStudents;
    
    const wsData = listToExport.map((s, index) => ({
      'N°': index + 1,
      [terminology.option]: s.classes?.name || '-',
      'Annexe / Campus': s.school_campuses?.name || 'Siège',
      'Nom': s.last_name || '',
      'Prénom': s.first_name || '',
      'Sexe': s.gender || '-',
      'Date de Naissance': s.dob ? new Date(s.dob).toLocaleDateString('fr-FR') : '-',
      'Parent/Tuteur': s.parent_name || '-',
      'Téléphone': s.parent_phone || '-',
      'Statut': s.status || 'Actif'
    }));

    const ws = XLSX.utils.json_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, terminology.students);
    appendSecuritySheet(wb, { user, ipAddress });
    XLSX.writeFile(wb, `Liste_Etudiants_${className.replace(/\s+/g, '_')}.xlsx`);
  };

  // Payment method icon helper
  const getMethodBadge = (method: string) => {
    const m = (method || '').toUpperCase();
    if (m.includes('CASH') || m.includes('ESPECES') || m.includes('COMPTANT')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-800 text-[11px] font-extrabold rounded-lg border border-emerald-100">
          <Banknote size={12} className="text-emerald-600" /> Cash
        </span>
      );
    }
    if (m.includes('MONCASH') || m.includes('MOBILE') || m.includes('NATCASH')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 text-rose-800 text-[11px] font-extrabold rounded-lg border border-rose-100">
          <Smartphone size={12} className="text-rose-600" /> MonCash / Mobile
        </span>
      );
    }
    if (m.includes('VIREMENT') || m.includes('BANQUE') || m.includes('TRANSFERT')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-800 text-[11px] font-extrabold rounded-lg border border-blue-100">
          <Landmark size={12} className="text-blue-600" /> Virement
        </span>
      );
    }
    if (m.includes('CHEQUE') || m.includes('CHÈQUE')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50 text-purple-800 text-[11px] font-extrabold rounded-lg border border-purple-100">
          <CreditCard size={12} className="text-purple-600" /> Chèque
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-700 text-[11px] font-extrabold rounded-lg border border-slate-200">
        <DollarSign size={12} className="text-slate-500" /> {method}
      </span>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-7xl mx-auto pb-24 px-4 md:px-0">
      
      {/* MODERN GLASS HEADER */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 md:p-8 rounded-3xl shadow-xl border border-indigo-900/40 relative overflow-hidden">
        {/* Subtle background glows */}
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30 shrink-0">
              <FileText size={28} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="px-2.5 py-0.5 bg-indigo-500/20 text-indigo-200 text-[10px] font-black uppercase tracking-wider rounded-md border border-indigo-500/30 break-words max-w-full">
                  {school?.name || 'EduNova Pro'}
                </span>
                {hasMultiCampus && (
                  <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase tracking-wider rounded-md border border-emerald-500/30">
                    {effectiveCampusId ? `📍 ${campuses.find(c => c.id === effectiveCampusId)?.name}` : '🌐 Toutes les Annexes'}
                  </span>
                )}
              </div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight">
                {activeTab === 'FINANCE' ? 'Bilan Financier' : `Rapport des ${terminology.students}`}
              </h1>
              <p className="text-slate-300 text-xs font-medium mt-1">
                {activeTab === 'FINANCE' 
                  ? `Recettes enregistrées du ${formatDisplayDateFR(startDate)} au ${formatDisplayDateFR(endDate)}` 
                  : `Registre dynamique : ${(!selectedClassId || selectedClassId.toLowerCase() === 'all') ? 'Toutes les classes' : (classes.find(c => c.id === selectedClassId)?.name || 'Classe')}`}
              </p>
            </div>
          </div>
          
          {/* TAB SWITCHER */}
          <div className="flex bg-slate-800/80 p-1.5 rounded-2xl border border-slate-700/60 shadow-inner w-full md:w-auto">
            <button
              onClick={() => setActiveTab('FINANCE')}
              className={`flex-1 md:flex-none px-6 py-3 rounded-xl text-xs font-extrabold tracking-wide transition-all flex items-center justify-center gap-2.5 cursor-pointer ${
                activeTab === 'FINANCE' 
                  ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-md' 
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <DollarSign size={16} />
              <span>Finances</span>
              {payments.length > 0 && (
                <span className={`px-2 py-0.5 text-[10px] rounded-full font-black ${activeTab === 'FINANCE' ? 'bg-indigo-900/60 text-indigo-100' : 'bg-slate-700 text-slate-300'}`}>
                  {payments.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('STUDENTS')}
              className={`flex-1 md:flex-none px-6 py-3 rounded-xl text-xs font-extrabold tracking-wide transition-all flex items-center justify-center gap-2.5 cursor-pointer ${
                activeTab === 'STUDENTS' 
                  ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-md' 
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Users size={16} />
              <span>{terminology.students}</span>
              {students.length > 0 && (
                <span className={`px-2 py-0.5 text-[10px] rounded-full font-black ${activeTab === 'STUDENTS' ? 'bg-indigo-900/60 text-indigo-100' : 'bg-slate-700 text-slate-300'}`}>
                  {students.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border-l-4 border-rose-500 p-5 rounded-2xl flex items-start gap-3 shadow-xs">
          <AlertCircle className="text-rose-500 shrink-0 mt-0.5" size={20} />
          <div>
            <h3 className="text-rose-900 font-extrabold text-sm">Attention</h3>
            <p className="text-rose-700 text-xs mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* FINANCE TAB CONTENT */}
      {activeTab === 'FINANCE' && (
        <div className="space-y-6">
          
          {/* TOOLBAR DE CONTRÔLE & FILTRES BILAN FINANCIER (HARMONISÉ ET RESPONSIVE TOUS ÉCRANS) */}
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200/90 p-3.5 sm:p-4 md:p-5 space-y-3.5 print:hidden">
            
            {/* LIGNE 1 : SÉLECTION DE PÉRIODE & PLAGE DE DATES (3 COLONNES DÉDIÉES POUR PROTÉGER LES CHAMPS SUR 14 POUCES ET MOBILE) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 items-end">
              
              {/* Sélecteur de Période Prédéfinie (Pill) */}
              <div className="sm:col-span-2 md:col-span-1 space-y-1.5 min-w-0">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 truncate">
                  <Calendar size={13} className="text-blue-600 shrink-0" />
                  <span>Période d'Analyse</span>
                </label>
                <SelectPill
                  options={[
                    { value: 'TODAY', label: "Aujourd'hui", badge: 'Jour' },
                    { value: 'WEEK', label: 'Cette Semaine', badge: 'Hebdo' },
                    { value: 'MONTH', label: 'Ce Mois-ci', badge: 'Mensuel' },
                    { value: 'YEAR', label: 'Cette Année', badge: 'Annuel' },
                    { value: 'CUSTOM', label: 'Plage Personnalisée...', badge: 'Libre' },
                  ]}
                  value={dateRange}
                  onChange={(val) => {
                    const range = val as DateRange;
                    setDateRange(range);
                    if (range !== 'CUSTOM') {
                      const bounds = computePresetBounds(range);
                      setStartDate(bounds.start);
                      setEndDate(bounds.end);
                    }
                  }}
                  variant="field"
                  size="sm"
                  colorScheme="blue"
                  portal={true}
                  className="w-full"
                />
              </div>

              {/* Sélecteur Date Début (Harmonisé DatePickerPill) */}
              <div className="sm:col-span-1 md:col-span-1 space-y-1.5 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 truncate">
                    Date de Début
                  </label>
                  {startDate === todayStr ? (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200/80 shrink-0">
                      Aujourd'hui
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setDateRange('CUSTOM');
                        setStartDate(todayStr);
                        if (endDate && todayStr > endDate) setEndDate(todayStr);
                      }}
                      className="text-[10px] font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer shrink-0"
                    >
                      Aujourd'hui
                    </button>
                  )}
                </div>
                <DatePickerPill
                  selectedDate={startDate}
                  onSelectDate={(newDate) => {
                    setDateRange('CUSTOM');
                    setStartDate(newDate);
                    if (endDate && newDate > endDate) {
                      setEndDate(newDate);
                    }
                  }}
                  variant="field"
                  size="sm"
                  colorScheme="blue"
                  showShortcuts={false}
                  showQuickArrows={true}
                  showTodayBadge={false}
                  className="w-full"
                />
              </div>

              {/* Sélecteur Date Fin (Harmonisé DatePickerPill) */}
              <div className="sm:col-span-1 md:col-span-1 space-y-1.5 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 truncate">
                    Date de Fin
                  </label>
                  {endDate === todayStr ? (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200/80 shrink-0">
                      Aujourd'hui
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setDateRange('CUSTOM');
                        setEndDate(todayStr);
                        if (startDate && todayStr < startDate) setStartDate(todayStr);
                      }}
                      className="text-[10px] font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer shrink-0"
                    >
                      Aujourd'hui
                    </button>
                  )}
                </div>
                <DatePickerPill
                  selectedDate={endDate}
                  onSelectDate={(newDate) => {
                    setDateRange('CUSTOM');
                    setEndDate(newDate);
                    if (startDate && newDate < startDate) {
                      setStartDate(newDate);
                    }
                  }}
                  variant="field"
                  size="sm"
                  colorScheme="blue"
                  showShortcuts={false}
                  showQuickArrows={true}
                  showTodayBadge={false}
                  className="w-full"
                />
              </div>

            </div>

            {/* LIGNE 2 : FILTRES SPÉCIFIQUES & BOUTON D'ACTION ACTUALISER */}
            <div className={`pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 ${hasMultiCampus && !user.campus_id ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-3.5 items-end`}>
              
              {/* Filtre Mode de Règlement (Pill) */}
              <div className="space-y-1.5 min-w-0">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 truncate">
                  <CreditCard size={13} className="text-emerald-600 shrink-0" />
                  <span>Mode de Règlement</span>
                </label>
                <SelectPill
                  options={paymentMethodOptions}
                  value={paymentMethodFilter}
                  onChange={(val) => setPaymentMethodFilter(val)}
                  variant="field"
                  size="sm"
                  colorScheme="emerald"
                  portal={true}
                  className="w-full"
                />
              </div>

              {/* Filtre Type de Frais (Pill) */}
              <div className="space-y-1.5 min-w-0">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 truncate">
                  <Tag size={13} className="text-purple-600 shrink-0" />
                  <span>Type de Frais</span>
                </label>
                <SelectPill
                  options={feeTypeFilterOptions}
                  value={feeTypeFilter}
                  onChange={(val) => setFeeTypeFilter(val)}
                  variant="field"
                  size="sm"
                  colorScheme="purple"
                  portal={true}
                  className="w-full"
                />
              </div>

              {/* Filtre Devise de Transaction (Pill) */}
              <div className="space-y-1.5 min-w-0">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 truncate">
                  <Coins size={13} className="text-teal-600 shrink-0" />
                  <span>Devise de Règlement</span>
                </label>
                <SelectPill
                  options={currencyFilterOptions}
                  value={currencyFilter}
                  onChange={(val) => setCurrencyFilter(val)}
                  variant="field"
                  size="sm"
                  colorScheme="emerald"
                  portal={true}
                  className="w-full"
                />
              </div>

              {/* Multi-Campus / Annexe Filter (If multi-campus school) */}
              {hasMultiCampus && !user.campus_id && (
                <div className="space-y-1.5 min-w-0">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 truncate">
                    <Building2 size={13} className="text-blue-600 shrink-0" />
                    <span>Annexe / Campus</span>
                  </label>
                  <SelectPill
                    options={campusOptions}
                    value={selectedCampusFilter}
                    onChange={(val) => setSelectedCampusFilter(val)}
                    variant="field"
                    size="sm"
                    colorScheme="blue"
                    icon={Building2}
                    labelPrefix=""
                    portal={true}
                    className="w-full"
                  />
                </div>
              )}

              {/* Bouton Actualiser le Bilan (Intégré avec ergonomie fluide) */}
              <div className={`space-y-1.5 min-w-0 ${!hasMultiCampus || user.campus_id ? 'sm:col-span-2 md:col-span-3 lg:col-span-1' : 'sm:col-span-2 md:col-span-2 lg:col-span-1'}`}>
                <div className="flex items-center justify-between gap-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 truncate">
                    <RefreshCcw size={12} className={`text-indigo-600 shrink-0 ${loading ? 'animate-spin' : ''}`} />
                    <span>Synchronisation</span>
                  </label>
                  <span className="text-[10px] text-slate-400 font-medium hidden sm:inline truncate">
                    {loading ? 'Calcul...' : 'Temps réel'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => fetchFinanceData()}
                  disabled={loading}
                  className="w-full h-[36px] bg-slate-900 hover:bg-indigo-600 active:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-xs hover:shadow-md flex items-center justify-center gap-2 active:scale-98 cursor-pointer disabled:opacity-50 group"
                  title="Recalculer et actualiser les données financières"
                >
                  <RefreshCcw size={14} className={`group-hover:rotate-180 transition-transform duration-500 shrink-0 ${loading ? 'animate-spin' : ''}`} />
                  <span className="truncate">{loading ? 'Calcul en cours...' : 'Actualiser le Bilan'}</span>
                </button>
              </div>

            </div>
          </div>

          {/* KEY METRICS CARDS GRID */}
          {!loading && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              
              {/* Gross Revenue Card */}
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between relative overflow-hidden group">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 to-teal-500" />
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-black text-slate-600 uppercase tracking-wider">Recettes Encaissées</span>
                    <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                      <TrendingUp size={20} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {financeStats.totalUSD > 0 ? (
                      <>
                        <p className="text-2xl font-black text-slate-900 font-mono tracking-tight">
                          {financeStats.totalEquivHTG.toLocaleString('fr-FR')} <span className="text-xs font-black text-emerald-600">HTG (Consolidé)</span>
                        </p>
                        <div className="flex items-center gap-2 flex-wrap pt-0.5">
                          <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[11px] font-bold font-mono border border-emerald-200/60">
                            {financeStats.totalHTG.toLocaleString('fr-FR')} HTG
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 text-[11px] font-bold font-mono border border-teal-200/60">
                            {financeStats.totalUSD.toLocaleString('fr-FR')} USD
                          </span>
                        </div>
                      </>
                    ) : (
                      <p className="text-3xl font-black text-slate-900 font-mono tracking-tight">
                        {financeStats.totalHTG.toLocaleString('fr-FR')} <span className="text-xs font-black text-emerald-600">HTG</span>
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-500">
                  <span className="flex items-center gap-1.5 text-emerald-600">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    {payments.length} transactions
                  </span>
                  <span className="text-[11px] text-slate-400">Total brut encaissé</span>
                </div>
              </div>

              {/* Reductions / Discounts Card */}
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between relative overflow-hidden group">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 to-orange-500" />
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-black text-slate-600 uppercase tracking-wider">Réévaluations & Bourses</span>
                    <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                      <Tag size={20} />
                    </div>
                  </div>
                  <p className="text-3xl font-black text-amber-700 font-mono tracking-tight">
                    -{financeStats.totalReductions.toLocaleString('fr-FR')} <span className="text-xs font-black text-amber-600">HTG</span>
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-500">
                  <span className="text-amber-700 font-semibold">Bourses & Allègements accordés</span>
                  <span className="text-[11px] text-slate-400">Déductions</span>
                </div>
              </div>

              {/* Net Revenue / Scope Card */}
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between relative overflow-hidden group">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-purple-500" />
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-black text-slate-600 uppercase tracking-wider">Recettes Nettes (Consolidées)</span>
                    <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                      <Wallet size={20} />
                    </div>
                  </div>
                  <p className="text-3xl font-black text-indigo-950 font-mono tracking-tight">
                    {Math.max(0, (financeStats.totalEquivHTG || financeStats.totalHTG) - financeStats.totalReductions).toLocaleString('fr-FR')} <span className="text-xs font-black text-indigo-600">HTG</span>
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-500">
                  <span className="text-indigo-600 flex items-center gap-1 font-extrabold">
                    <ShieldCheck size={14} /> Solde Effectif Net
                  </span>
                  <span className="text-[11px] text-slate-400">Après allègements</span>
                </div>
              </div>

            </div>
          )}

          {/* DETAILED STATS BREAKDOWN GRIDS */}
          {!loading && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              
              {/* Par Type de Frais */}
              <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-sm text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <PieChart size={16} className="text-indigo-600" /> Par Type de Frais
                  </h3>
                  <span className="text-xs font-bold text-slate-600">
                    {Object.keys(financeStats.byType).length} catégories
                  </span>
                </div>
                <div className="space-y-3">
                  {Object.entries(financeStats.byType).map(([type, amounts]) => {
                    const equivTotal = financeStats.totalEquivHTG || financeStats.totalHTG;
                    const percent = equivTotal > 0 ? Math.round(((amounts.equiv_htg || amounts.htg) / equivTotal) * 100) : 0;
                    return (
                      <div key={type} className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-100 hover:border-indigo-200 transition-all">
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="font-extrabold text-slate-800 text-xs">{type}</span>
                          <div className="text-right font-mono">
                            {amounts.usd > 0 && amounts.htg === 0 ? (
                              <>
                                <span className="font-black text-teal-700 text-xs">{amounts.usd.toLocaleString('fr-FR')} USD</span>
                                <span className="text-[10px] text-slate-500 font-bold block">(Eq. {amounts.equiv_htg?.toLocaleString('fr-FR')} HTG)</span>
                              </>
                            ) : amounts.usd > 0 ? (
                              <>
                                <span className="font-black text-slate-900 text-xs">{amounts.htg.toLocaleString('fr-FR')} HTG</span>
                                <span className="text-[10px] text-teal-700 font-bold block">+{amounts.usd.toLocaleString('fr-FR')} USD (Eq. {amounts.equiv_htg?.toLocaleString('fr-FR')} HTG)</span>
                              </>
                            ) : (
                              <span className="font-black text-indigo-700 text-xs">{amounts.htg.toLocaleString('fr-FR')} HTG</span>
                            )}
                          </div>
                        </div>
                        <div className="w-full bg-slate-200/60 rounded-full h-1.5 overflow-hidden">
                          <div className="bg-indigo-600 h-1.5 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, Math.max(5, percent))}%` }} />
                        </div>
                        <div className="flex justify-between items-center mt-1 text-[10px] font-bold text-slate-600">
                          <span>{amounts.count} transaction(s)</span>
                          <span>{percent}% de la valeur consolidée</span>
                        </div>
                      </div>
                    );
                  })}
                  {Object.keys(financeStats.byType).length === 0 && (
                    <p className="text-center text-xs text-slate-600 italic py-6">Aucune transaction enregistrée pour cette période.</p>
                  )}
                </div>
              </div>

              {/* Par Mode de Paiement */}
              <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-sm text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <CreditCard size={16} className="text-emerald-600" /> Par Mode de Paiement
                  </h3>
                  <span className="text-xs font-bold text-slate-600">
                    {Object.keys(financeStats.byMethod).length} modes
                  </span>
                </div>
                <div className="space-y-3">
                  {Object.entries(financeStats.byMethod).map(([method, amounts]) => {
                    return (
                      <div key={method} className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-100 flex items-center justify-between">
                        <div>
                          {getMethodBadge(method)}
                          <p className="text-[10px] font-bold text-slate-600 mt-1">{amounts.count} paiement(s)</p>
                        </div>
                        <div className="text-right font-mono">
                          {amounts.usd > 0 && amounts.htg === 0 ? (
                            <>
                              <p className="font-black text-teal-700 text-sm">{amounts.usd.toLocaleString('fr-FR')} USD</p>
                              <p className="text-[10px] text-slate-500 font-bold">Eq. {amounts.equiv_htg?.toLocaleString('fr-FR')} HTG</p>
                            </>
                          ) : amounts.usd > 0 ? (
                            <>
                              <p className="font-black text-slate-900 text-sm">{amounts.htg.toLocaleString('fr-FR')} HTG</p>
                              <p className="text-xs font-bold text-teal-700">+{amounts.usd.toLocaleString('fr-FR')} USD</p>
                            </>
                          ) : (
                            <p className="font-black text-slate-900 text-sm">{amounts.htg.toLocaleString('fr-FR')} HTG</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {Object.keys(financeStats.byMethod).length === 0 && (
                    <p className="text-center text-xs text-slate-600 italic py-6">Aucun paiement trouvé pour cette période.</p>
                  )}
                </div>
              </div>

              {/* Par Annexe / Campus (If multi-campus) */}
              {hasMultiCampus && (
                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4 lg:col-span-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-black text-sm text-slate-900 uppercase tracking-wider flex items-center gap-2">
                      <Building2 size={16} className="text-indigo-600" /> Répartition par Annexe / Campus
                    </h3>
                    <span className="text-xs font-bold text-slate-600">
                      {Object.keys(financeStats.byCampus).length} site(s)
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {Object.entries(financeStats.byCampus).map(([campusName, amounts]) => (
                      <div key={campusName} className="p-4 bg-gradient-to-br from-slate-50 to-indigo-50/30 rounded-2xl border border-slate-100/80">
                        <div className="flex items-center gap-1.5 mb-2">
                          <MapPin size={14} className="text-indigo-600 shrink-0" />
                          <span className="font-black text-slate-800 text-xs line-clamp-1">{campusName}</span>
                        </div>
                        <p className="font-black text-lg text-slate-900 font-mono">
                          {amounts.htg.toLocaleString('fr-FR')} <span className="text-xs font-bold text-indigo-600">HTG</span>
                        </p>
                        {amounts.usd > 0 && (
                          <p className="text-xs font-bold text-teal-600 font-mono">
                            + {amounts.usd.toLocaleString('fr-FR')} USD
                          </p>
                        )}
                        <p className="text-[10px] font-bold text-slate-600 mt-2">{amounts.count} transaction(s)</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}

          {/* TRANSACTION DETAILS TABLE */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
            
            {/* TABLE CONTROLS & EXPORTS */}
            <div className="p-4 sm:p-6 bg-slate-50/60 border-b border-slate-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
              
              {/* Search Bar */}
              <div className="relative flex-1 max-w-md">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Rechercher par élève, frais, mode de paiement, annexe..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setFinanceCurrentPage(1);
                  }}
                  className="w-full pl-10 pr-9 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm('');
                      setFinanceCurrentPage(1);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-200/60 transition-colors cursor-pointer"
                    title="Effacer la recherche"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Right Action Buttons & Pagination Indicator */}
              <div className="flex items-center gap-2 shrink-0 flex-wrap justify-between sm:justify-end">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500">
                    {filteredPayments.length} transaction(s)
                  </span>

                  {financeTotalPages > 1 && (
                    <span className="px-2.5 py-0.5 bg-indigo-100/80 text-indigo-900 text-[11px] font-black rounded-lg border border-indigo-200/60 inline-flex">
                      Page {financeCurrentPage} / {financeTotalPages}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <button 
                    onClick={() => fetchFinanceData()}
                    className="p-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-all cursor-pointer disabled:opacity-50"
                    disabled={loading}
                    title="Rafraîchir les données"
                  >
                    <RefreshCcw size={15} className={loading ? 'animate-spin' : ''} />
                  </button>

                  <button 
                    onClick={exportFinancePDF}
                    disabled={loading || filteredPayments.length === 0}
                    title="Exporter l'intégralité des transactions filtrées au format PDF"
                    className="px-3.5 sm:px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-black tracking-wide transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40 border border-rose-200/60"
                  >
                    <Download size={14} /> PDF
                  </button>

                  <button 
                    onClick={exportFinanceExcel}
                    disabled={loading || filteredPayments.length === 0}
                    title="Exporter l'intégralité des transactions filtrées au format Excel"
                    className="px-3.5 sm:px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-black tracking-wide transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40 border border-emerald-200/60"
                  >
                    <FileSpreadsheet size={14} /> Excel
                  </button>
                </div>
              </div>
            </div>

            {/* TABLE BODY */}
            {loading ? (
              <div className="py-8">
                <FluidLoadingState 
                  message="Chargement du bilan financier & rapports analytiques..." 
                  subtext="Compilation des flux de trésorerie, ventilations par rubrique et arrêtés comptables..." 
                />
                <SkeletonTable rows={5} />
              </div>
            ) : filteredPayments.length === 0 ? (
              <div className="py-16 px-4 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mx-auto text-indigo-500 shadow-2xs">
                  <Search size={22} />
                </div>
                <div className="space-y-1 max-w-md mx-auto">
                  <p className="text-slate-800 font-black text-sm">
                    {payments.length === 0 
                      ? "Aucun encaissement pour cette période"
                      : "Aucune transaction ne correspond à vos filtres"}
                  </p>
                  <p className="text-slate-500 text-xs font-medium">
                    {payments.length === 0
                      ? "Aucun paiement n'a été enregistré entre les dates sélectionnées."
                      : `Aucun résultat pour la recherche « ${searchTerm} » ou les critères sélectionnés.`}
                  </p>
                </div>
                {(searchTerm || paymentMethodFilter !== 'ALL' || feeTypeFilter !== 'ALL') && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm('');
                      setPaymentMethodFilter('ALL');
                      setFeeTypeFilter('ALL');
                      setFinanceCurrentPage(1);
                    }}
                    className="px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl text-xs font-black transition-all cursor-pointer border border-indigo-200 inline-flex items-center gap-1.5"
                  >
                    <RefreshCcw size={12} />
                    <span>Réinitialiser les filtres</span>
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* VUE MOBILE : CARTES RESPONSIVES (< 768px) */}
                <div className="md:hidden divide-y divide-slate-100">
                  {paginatedPayments.map((p, index) => {
                    const globalIndex = (financeCurrentPage - 1) * financeItemsPerPage + index + 1;
                    return (
                      <div key={p.id} className="p-4 hover:bg-indigo-50/30 transition-colors space-y-3">
                        {/* Ligne Supérieure : N°, Date & Heure, Montant */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-500 font-black text-[10px] flex items-center justify-center shrink-0 border border-slate-200/60">
                              #{globalIndex}
                            </span>
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200/70 text-slate-700 text-[11px] font-bold">
                              <Calendar size={11} className="text-blue-600 shrink-0" />
                              <span>{new Date(p.created_at).toLocaleDateString('fr-FR')}</span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {new Date(p.created_at).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})}
                              </span>
                            </div>
                          </div>
                          
                          {/* Montant */}
                          <div className="text-right shrink-0">
                            {p.currency === 'USD' || p.is_foreign_currency ? (
                              <div className="space-y-0.5">
                                <div className="flex items-center justify-end gap-1">
                                  <span className="px-1.5 py-0.5 rounded bg-teal-100/70 text-teal-900 text-[9.5px] font-black border border-teal-300/60">
                                    USD
                                  </span>
                                  <span className="text-xs font-black text-teal-900 font-mono">
                                    {p.original_amount?.toLocaleString('fr-FR')} USD
                                  </span>
                                </div>
                                <span className="text-[10px] text-slate-500 block font-mono font-bold">
                                  Eq: {p.amount?.toLocaleString('fr-FR')} HTG {p.exchange_rate_applied ? `(@${p.exchange_rate_applied})` : ''}
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-1">
                                <span className="px-1.5 py-0.5 rounded bg-emerald-100/70 text-emerald-900 text-[9.5px] font-black border border-emerald-300/60">
                                  HTG
                                </span>
                                <span className="text-xs font-black text-emerald-900 font-mono">
                                  {p.amount?.toLocaleString('fr-FR')} HTG
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Élève & Classe */}
                        <div className="flex items-center justify-between gap-2">
                          {p.students ? (
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-7 h-7 rounded-lg bg-indigo-100/80 text-indigo-800 font-black text-[10px] flex items-center justify-center shrink-0 border border-indigo-200/50">
                                {p.students.first_name?.charAt(0)}{p.students.last_name?.charAt(0)}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-black text-slate-900 truncate">
                                  {formatStudentName(p.students.last_name, p.students.first_name).fullName}
                                </p>
                                {p.students.className && (
                                  <p className="text-[10.5px] font-semibold text-slate-500 truncate">
                                    {p.students.className}
                                  </p>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic font-semibold">
                              Divers / Vente directe
                            </span>
                          )}

                          {/* Actions rapides mobile (WhatsApp 100% gratuit & Annulation si superviseur) */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleShareReceiptWhatsApp(p)}
                              className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[10.5px] rounded-lg border border-emerald-200 transition-all inline-flex items-center gap-1 cursor-pointer"
                              title="Partager le reçu sur WhatsApp (100% Gratuit)"
                            >
                              <MessageSquare size={11} className="text-emerald-600" />
                              <span>WhatsApp</span>
                            </button>
                            {canCancelTransaction && (
                              <button
                                type="button"
                                onClick={() => openCancelModal(p)}
                                className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-[10.5px] rounded-lg border border-rose-200/60 transition-all inline-flex items-center gap-1 cursor-pointer"
                                title="Annuler cette transaction"
                              >
                                <Trash2 size={11} />
                                <span>Annuler</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Badges : Type de frais, Mode de règlement, Annexe */}
                        <div className="flex items-center gap-1.5 flex-wrap pt-0.5 text-[10px]">
                          <span className="inline-flex items-center px-2 py-0.5 bg-indigo-50 text-indigo-700 font-black uppercase tracking-wider rounded-lg border border-indigo-100">
                            {p.type || 'Autre'}
                          </span>
                          {getMethodBadge(p.method)}
                          {hasMultiCampus && p.campus_name && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 font-bold rounded-lg border border-slate-200/60">
                              📍 {p.campus_name}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Synthèse comptable en bas des cartes (Mobile) */}
                  <div className="p-4 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl mx-3 my-3 shadow-md border border-indigo-900/50 space-y-3">
                    {/* Sous-total page */}
                    <div className="flex items-start justify-between text-xs pb-2.5 border-b border-indigo-800/40">
                      <span className="text-indigo-200 font-bold">Sous-total page {financeCurrentPage} :</span>
                      <div className="text-right font-mono">
                        {financePageSubtotals.foreignUSD > 0 && financePageSubtotals.localHTG === 0 ? (
                          <>
                            <span className="text-teal-300 font-black">{financePageSubtotals.foreignUSD.toLocaleString('fr-FR')} USD</span>
                            <span className="block text-[10px] text-indigo-200">Eq: {financePageSubtotals.totalEquivHTG.toLocaleString('fr-FR')} HTG</span>
                          </>
                        ) : financePageSubtotals.foreignUSD > 0 ? (
                          <>
                            <span className="text-emerald-300 font-black">{financePageSubtotals.totalEquivHTG.toLocaleString('fr-FR')} HTG (Eq)</span>
                            <span className="block text-[10px] text-teal-200 font-bold">
                              {financePageSubtotals.localHTG.toLocaleString('fr-FR')} HTG + {financePageSubtotals.foreignUSD.toLocaleString('fr-FR')} USD
                            </span>
                          </>
                        ) : (
                          <span className="text-emerald-400 font-black">{financePageSubtotals.localHTG.toLocaleString('fr-FR')} HTG</span>
                        )}
                      </div>
                    </div>
                    {/* Total période filtrée */}
                    <div className="flex items-start justify-between text-xs pt-0.5">
                      <div>
                        <span className="text-indigo-100 font-extrabold uppercase tracking-wide text-[11px] block">
                          Total Sélection ({filteredPayments.length} tx) :
                        </span>
                        <span className="text-[10px] text-indigo-300 font-medium">Valeur consolidée nette</span>
                      </div>
                      <div className="text-right font-mono">
                        {financeFilteredTotals.foreignUSD > 0 && financeFilteredTotals.localHTG === 0 ? (
                          <>
                            <span className="text-teal-300 font-black text-sm">{financeFilteredTotals.foreignUSD.toLocaleString('fr-FR')} USD</span>
                            <span className="block text-[10.5px] text-emerald-300 font-extrabold">
                              Eq: {financeFilteredTotals.totalEquivHTG.toLocaleString('fr-FR')} HTG
                            </span>
                          </>
                        ) : financeFilteredTotals.foreignUSD > 0 ? (
                          <>
                            <span className="text-emerald-300 font-black text-sm">{financeFilteredTotals.totalEquivHTG.toLocaleString('fr-FR')} HTG</span>
                            <span className="block text-[10.5px] text-teal-200 font-bold">
                              {financeFilteredTotals.localHTG.toLocaleString('fr-FR')} HTG + {financeFilteredTotals.foreignUSD.toLocaleString('fr-FR')} USD
                            </span>
                          </>
                        ) : (
                          <span className="text-emerald-300 font-black text-sm">{financeFilteredTotals.localHTG.toLocaleString('fr-FR')} HTG</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* VUE TABLETTE & DESKTOP : TABLEAU COMPLET (>= 768px) */}
                <div className="hidden md:block overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                  <table className="w-full text-left border-collapse min-w-[900px]">
                    <thead>
                      <tr className="bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-950 text-indigo-100 text-[11px] font-black uppercase tracking-wider border-b border-indigo-900/60 shadow-xs select-none">
                        <th className="px-3.5 py-3.5 text-center min-w-[50px] w-12">
                          <span className="text-indigo-200">N°</span>
                        </th>
                        <th className="px-4 py-3.5 min-w-[130px]">
                          <span className="text-indigo-200 flex items-center gap-1.5">
                            <Calendar size={13} className="text-indigo-400" /> Date & Heure
                          </span>
                        </th>
                        <th className="px-4 py-3.5 min-w-[210px]">
                          <span className="text-indigo-200 flex items-center gap-1.5">
                            <Users size={13} className="text-indigo-400" /> {terminology.student}
                          </span>
                        </th>
                        <th className="px-4 py-3.5 min-w-[110px]">
                          <span className="text-indigo-200 flex items-center gap-1.5">
                            <Layers size={13} className="text-indigo-400" /> {terminology.option}
                          </span>
                        </th>
                        {hasMultiCampus && (
                          <th className="px-4 py-3.5 min-w-[140px]">
                            <span className="text-indigo-200 flex items-center gap-1.5">
                              <Building2 size={13} className="text-indigo-400" /> Annexe / Campus
                            </span>
                          </th>
                        )}
                        <th className="px-4 py-3.5 min-w-[150px]">
                          <span className="text-indigo-200 flex items-center gap-1.5">
                            <Tag size={13} className="text-indigo-400" /> Type de Frais
                          </span>
                        </th>
                        <th className="px-4 py-3.5 min-w-[120px]">
                          <span className="text-indigo-200 flex items-center gap-1.5">
                            <CreditCard size={13} className="text-indigo-400" /> Mode
                          </span>
                        </th>
                        <th className="px-4 py-3.5 text-right min-w-[130px]">
                          <span className="text-indigo-200 flex items-center justify-end gap-1.5">
                            <DollarSign size={13} className="text-indigo-400" /> Montant
                          </span>
                        </th>
                        <th className="px-4 py-3.5 text-center min-w-[100px]">
                          <span className="text-indigo-200">Action</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginatedPayments.map((p, index) => {
                        const globalIndex = (financeCurrentPage - 1) * financeItemsPerPage + index + 1;
                        return (
                          <tr key={p.id} className="hover:bg-indigo-50/40 transition-colors group">
                            
                            {/* N° Index */}
                            <td className="px-3.5 py-3.5 text-center text-xs font-bold text-slate-400">
                              {globalIndex}
                            </td>

                            {/* Date & Heure (Harmonisé Pillule DateTime) */}
                            <td className="px-4 py-3.5 whitespace-nowrap text-xs">
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200/80 text-slate-700 font-bold">
                                <Calendar size={12} className="text-blue-600 shrink-0" />
                                <span>{new Date(p.created_at).toLocaleDateString('fr-FR')}</span>
                                <span className="text-[10.5px] text-slate-400 font-medium font-mono">
                                  {new Date(p.created_at).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})}
                                </span>
                              </div>
                            </td>

                            {/* Student - Full Name NEVER Truncated */}
                            <td className="px-4 py-3.5 whitespace-nowrap text-xs font-extrabold text-slate-900">
                              {p.students ? (
                                <div className="flex items-center gap-2.5">
                                  <div className="w-7 h-7 rounded-lg bg-indigo-100/80 text-indigo-800 font-black text-[10px] flex items-center justify-center shrink-0 border border-indigo-200/50">
                                    {p.students.first_name?.charAt(0)}{p.students.last_name?.charAt(0)}
                                  </div>
                                  <span className="whitespace-nowrap font-black text-slate-900 text-xs">
                                    {formatStudentName(p.students.last_name, p.students.first_name).fullName}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-slate-400 italic font-semibold">Divers / Vente directe</span>
                              )}
                            </td>

                            {/* Class */}
                            <td className="px-4 py-3.5 whitespace-nowrap text-xs font-bold text-slate-600">
                              {p.students?.className ? (
                                <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-[11px] font-extrabold border border-slate-200/50">
                                  {p.students.className}
                                </span>
                              ) : (
                                <span className="text-slate-400 italic">Non assigné</span>
                              )}
                            </td>

                            {/* Campus (if multi-campus) */}
                            {hasMultiCampus && (
                              <td className="px-4 py-3.5 whitespace-nowrap text-xs">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-700 font-extrabold text-[10px] rounded-lg border border-slate-200/60">
                                  📍 {p.campus_name}
                                </span>
                              </td>
                            )}

                            {/* Fee Type */}
                            <td className="px-4 py-3.5 whitespace-nowrap">
                              <span className="inline-flex items-center px-2.5 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase tracking-wider rounded-lg border border-indigo-100">
                                {p.type || 'Autre'}
                              </span>
                            </td>

                            {/* Payment Method */}
                            <td className="px-4 py-3.5 whitespace-nowrap">
                              {getMethodBadge(p.method)}
                            </td>

                            {/* Amount */}
                            <td className="px-4 py-3.5 whitespace-nowrap text-right">
                              {p.currency === 'USD' || p.is_foreign_currency ? (
                                <div className="space-y-0.5">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <span className="px-1.5 py-0.5 rounded bg-teal-100/80 text-teal-900 text-[10px] font-black border border-teal-300/70">
                                      USD
                                    </span>
                                    <span className="text-xs font-black text-teal-900 font-mono">
                                      {p.original_amount?.toLocaleString('fr-FR')} USD
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-slate-500 font-bold block font-mono">
                                    Eq: {p.amount?.toLocaleString('fr-FR')} HTG {p.exchange_rate_applied ? `(@${p.exchange_rate_applied})` : ''}
                                  </span>
                                </div>
                              ) : (
                                <div className="flex items-center justify-end gap-1.5">
                                  <span className="px-1.5 py-0.5 rounded bg-emerald-100/80 text-emerald-900 text-[10px] font-black border border-emerald-300/70">
                                    HTG
                                  </span>
                                  <span className="text-xs font-black text-emerald-900 font-mono">
                                    {p.amount?.toLocaleString('fr-FR')} HTG
                                  </span>
                                </div>
                              )}
                            </td>

                            {/* Action */}
                            <td className="px-4 py-3.5 whitespace-nowrap text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleShareReceiptWhatsApp(p)}
                                  className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[11px] rounded-lg border border-emerald-200 transition-all inline-flex items-center gap-1 cursor-pointer"
                                  title="Partager le reçu sur WhatsApp (100% Gratuit)"
                                >
                                  <MessageSquare size={12} className="text-emerald-600" />
                                  <span>WhatsApp</span>
                                </button>
                                {canCancelTransaction && (
                                  <button
                                    type="button"
                                    onClick={() => openCancelModal(p)}
                                    className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-[11px] rounded-lg border border-rose-200/60 transition-all inline-flex items-center gap-1 cursor-pointer"
                                    title="Annuler cette transaction (Superviseur sur place)"
                                  >
                                    <Trash2 size={12} />
                                    <span>Annuler</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>

                    {/* PIED DE TABLEAU COMPTABLE (Desktop & Tablette) */}
                    <tfoot>
                      {/* Ligne 1 : Sous-total de la page affichée */}
                      <tr className="bg-slate-100/90 border-t-2 border-slate-200 text-slate-700 font-extrabold text-xs">
                        <td colSpan={hasMultiCampus ? 7 : 6} className="px-4 py-3 text-right">
                          <span className="text-[11px] uppercase tracking-wider text-slate-500 font-black">
                            Sous-total Page {financeCurrentPage} ({paginatedPayments.length} transaction{paginatedPayments.length > 1 ? 's' : ''}) :
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap font-mono font-black text-xs">
                          {financePageSubtotals.foreignUSD > 0 && financePageSubtotals.localHTG === 0 ? (
                            <>
                              <span className="text-teal-800 text-xs font-black">{financePageSubtotals.foreignUSD.toLocaleString('fr-FR')} USD</span>
                              <span className="block text-[10.5px] text-slate-500 font-bold">
                                Eq: {financePageSubtotals.totalEquivHTG.toLocaleString('fr-FR')} HTG
                              </span>
                            </>
                          ) : financePageSubtotals.foreignUSD > 0 ? (
                            <>
                              <span className="text-emerald-800 text-xs font-black">{financePageSubtotals.totalEquivHTG.toLocaleString('fr-FR')} HTG (Eq)</span>
                              <span className="block text-[10.5px] text-teal-800 font-bold">
                                {financePageSubtotals.localHTG.toLocaleString('fr-FR')} HTG + {financePageSubtotals.foreignUSD.toLocaleString('fr-FR')} USD
                              </span>
                            </>
                          ) : (
                            <span className="text-emerald-800 text-xs font-black">{financePageSubtotals.localHTG.toLocaleString('fr-FR')} HTG</span>
                          )}
                        </td>
                        <td className="px-4 py-3"></td>
                      </tr>

                      {/* Ligne 2 : Total de la sélection filtrée */}
                      <tr className="bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-950 text-white font-extrabold text-xs border-t border-indigo-900/60">
                        <td colSpan={hasMultiCampus ? 7 : 6} className="px-4 py-3.5 text-right">
                          <span className="text-[11px] uppercase tracking-wider text-indigo-300 font-black">
                            Total Période Sélectionnée ({filteredPayments.length} transaction{filteredPayments.length > 1 ? 's' : ''}) :
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right whitespace-nowrap font-mono font-black text-xs text-white">
                          {financeFilteredTotals.foreignUSD > 0 && financeFilteredTotals.localHTG === 0 ? (
                            <>
                              <span className="text-teal-300 text-sm font-black">{financeFilteredTotals.foreignUSD.toLocaleString('fr-FR')} USD</span>
                              <span className="block text-[11px] text-emerald-300 font-extrabold">
                                Total Équivalent : {financeFilteredTotals.totalEquivHTG.toLocaleString('fr-FR')} HTG
                              </span>
                            </>
                          ) : financeFilteredTotals.foreignUSD > 0 ? (
                            <>
                              <span className="text-emerald-300 text-sm font-black">{financeFilteredTotals.totalEquivHTG.toLocaleString('fr-FR')} HTG</span>
                              <span className="block text-[11px] text-teal-200 font-bold">
                                Dont : {financeFilteredTotals.localHTG.toLocaleString('fr-FR')} HTG + {financeFilteredTotals.foreignUSD.toLocaleString('fr-FR')} USD
                              </span>
                            </>
                          ) : (
                            <span className="text-emerald-300 text-sm font-black">{financeFilteredTotals.localHTG.toLocaleString('fr-FR')} HTG</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* BARRE DE PIED DE PAGE & PAGINATION HAUTEMENT ADAPTATIVE */}
                <div className="p-4 sm:p-5 bg-slate-50/80 border-t border-slate-200/80 flex flex-col gap-3.5">
                  
                  {/* Ligne 1 : Résumé & Sélecteur Par page (Zéro encombrement, Zéro écrasement) */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-bold text-slate-600">
                    
                    {/* Compteur de transactions */}
                    <div className="text-center sm:text-left">
                      Affichage de <span className="font-extrabold text-slate-900">{(financeCurrentPage - 1) * financeItemsPerPage + 1}</span> à{' '}
                      <span className="font-extrabold text-slate-900">
                        {Math.min(financeCurrentPage * financeItemsPerPage, filteredPayments.length)}
                      </span>{' '}
                      sur <span className="font-extrabold text-slate-900">{filteredPayments.length}</span> transaction(s)
                      {searchTerm && filteredPayments.length !== payments.length && (
                        <span className="text-slate-400 font-medium ml-1">
                          (filtrées sur {payments.length})
                        </span>
                      )}
                    </div>

                    {/* Sélecteur Par page (Parfaitement aligné, sans wrap vertical) */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-slate-500 font-semibold text-xs whitespace-nowrap">Par page :</span>
                      <SelectPill
                        options={[
                          { value: '10', label: '10 / page' },
                          { value: '25', label: '25 / page' },
                          { value: '50', label: '50 / page' },
                          { value: '100', label: '100 / page' },
                          { value: '200', label: '200 / page' }
                        ]}
                        value={financeItemsPerPage.toString()}
                        onChange={(val) => {
                          setFinanceItemsPerPage(Number(val));
                          setFinanceCurrentPage(1);
                        }}
                        variant="field"
                        size="xs"
                        colorScheme="slate"
                        portal={true}
                        className="w-28 shrink-0"
                      />
                    </div>
                  </div>

                  {/* Ligne 2 : Navigation de pagination (Mobile & Desktop adaptés) */}
                  {financeTotalPages > 1 && (
                    <div className="pt-2.5 border-t border-slate-200/60 flex flex-col sm:flex-row items-center justify-between gap-3">
                      
                      {/* Badge page pour grand écran & tablette */}
                      <div className="hidden sm:inline-flex items-center gap-1.5 text-xs font-bold text-slate-500">
                        <span>Page</span>
                        <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-200/80 rounded-md font-black text-indigo-700 font-mono">
                          {financeCurrentPage}
                        </span>
                        <span>sur</span>
                        <span className="font-extrabold text-slate-700 font-mono">{financeTotalPages}</span>
                      </div>

                      {/* Contrôles Desktop & Tablette (>= 640px) */}
                      <div className="hidden sm:flex items-center gap-1 justify-center flex-wrap">
                        {/* Première page */}
                        <button
                          onClick={() => setFinanceCurrentPage(1)}
                          disabled={financeCurrentPage === 1}
                          className="p-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:text-indigo-600 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-slate-600 transition-all shadow-2xs cursor-pointer"
                          title="Première page"
                          aria-label="Première page"
                        >
                          <ChevronsLeft size={15} />
                        </button>

                        {/* Page précédente */}
                        <button
                          onClick={() => setFinanceCurrentPage(prev => Math.max(1, prev - 1))}
                          disabled={financeCurrentPage === 1}
                          className="p-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:text-indigo-600 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-slate-600 transition-all shadow-2xs cursor-pointer"
                          title="Page précédente"
                          aria-label="Page précédente"
                        >
                          <ChevronLeft size={15} />
                        </button>

                        {/* Numéros de page ultra-compacts (max 5) */}
                        <div className="flex items-center gap-1">
                          {financePaginationPages.map((page, idx) => {
                            if (typeof page === 'string') {
                              return (
                                <span key={`ellipsis-${idx}`} className="px-1.5 py-1 text-slate-400 text-xs font-black select-none">
                                  •••
                                </span>
                              );
                            }

                            const isActive = page === financeCurrentPage;
                            return (
                              <button
                                key={page}
                                onClick={() => setFinanceCurrentPage(page)}
                                className={`min-w-[32px] h-[32px] px-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                                  isActive
                                    ? 'bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white shadow-sm shadow-indigo-500/20 scale-105'
                                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200/80 shadow-2xs'
                                }`}
                              >
                                {page}
                              </button>
                            );
                          })}
                        </div>

                        {/* Page suivante */}
                        <button
                          onClick={() => setFinanceCurrentPage(prev => Math.min(financeTotalPages, prev + 1))}
                          disabled={financeCurrentPage === financeTotalPages}
                          className="p-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:text-indigo-600 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-slate-600 transition-all shadow-2xs cursor-pointer"
                          title="Page suivante"
                          aria-label="Page suivante"
                        >
                          <ChevronRight size={15} />
                        </button>

                        {/* Dernière page */}
                        <button
                          onClick={() => setFinanceCurrentPage(financeTotalPages)}
                          disabled={financeCurrentPage === financeTotalPages}
                          className="p-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:text-indigo-600 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-slate-600 transition-all shadow-2xs cursor-pointer"
                          title="Dernière page"
                          aria-label="Dernière page"
                        >
                          <ChevronsRight size={15} />
                        </button>

                        {/* Saisie rapide si > 5 pages */}
                        {financeTotalPages > 5 && (
                          <div className="flex items-center gap-1.5 pl-2 ml-1 border-l border-slate-200 text-xs font-bold text-slate-500">
                            <span className="text-[11px]">Aller à :</span>
                            <input
                              type="number"
                              min={1}
                              max={financeTotalPages}
                              value={financeCurrentPage}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                if (val >= 1 && val <= financeTotalPages) {
                                  setFinanceCurrentPage(val);
                                }
                              }}
                              className="w-12 py-1 px-1 bg-white border border-slate-200 rounded-lg text-center text-xs font-black text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              title="Saisir un numéro de page"
                            />
                          </div>
                        )}
                      </div>

                      {/* Contrôles Mobile (< 640px) */}
                      <div className="sm:hidden w-full flex items-center justify-between gap-1.5">
                        <button
                          type="button"
                          onClick={() => setFinanceCurrentPage(1)}
                          disabled={financeCurrentPage === 1}
                          className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 disabled:opacity-30 flex items-center justify-center shadow-2xs cursor-pointer"
                          title="Première page"
                        >
                          <ChevronsLeft size={16} />
                        </button>

                        <button
                          type="button"
                          onClick={() => setFinanceCurrentPage(prev => Math.max(1, prev - 1))}
                          disabled={financeCurrentPage === 1}
                          className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-700 disabled:opacity-30 flex items-center gap-1 shadow-2xs cursor-pointer"
                        >
                          <ChevronLeft size={16} />
                          <span className="hidden xs:inline">Préc.</span>
                        </button>

                        <div className="px-3 py-2 flex items-center justify-center bg-indigo-50/90 border border-indigo-200/90 rounded-xl text-xs font-black text-indigo-900 shrink-0 font-mono">
                          {financeCurrentPage} / {financeTotalPages}
                        </div>

                        <button
                          type="button"
                          onClick={() => setFinanceCurrentPage(prev => Math.min(financeTotalPages, prev + 1))}
                          disabled={financeCurrentPage === financeTotalPages}
                          className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-700 disabled:opacity-30 flex items-center gap-1 shadow-2xs cursor-pointer"
                        >
                          <span className="hidden xs:inline">Suiv.</span>
                          <ChevronRight size={16} />
                        </button>

                        <button
                          type="button"
                          onClick={() => setFinanceCurrentPage(financeTotalPages)}
                          disabled={financeCurrentPage === financeTotalPages}
                          className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 disabled:opacity-30 flex items-center justify-center shadow-2xs cursor-pointer"
                          title="Dernière page"
                        >
                          <ChevronsRight size={16} />
                        </button>
                      </div>

                    </div>
                  )}

                </div>
              </>
            )}
          </div>

        </div>
      )}

      {/* STUDENTS TAB CONTENT */}
      {activeTab === 'STUDENTS' && (
        <div className="space-y-6">
          
          {/* FILTERS & SEARCH TOOLBAR */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-100 shadow-sm flex flex-col gap-4">
            
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
              {/* Quick Search */}
              <div className="relative flex-1 min-w-[240px] max-w-md">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input 
                  type="text"
                  value={studentSearchTerm}
                  onChange={(e) => {
                    setStudentSearchTerm(e.target.value);
                    setStudentCurrentPage(1);
                  }}
                  placeholder={`Rechercher un ${terminology.student.toLowerCase()} (nom, matricule, parent, tél)...`}
                  className="w-full pl-10 pr-9 py-2.5 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
                {studentSearchTerm && (
                  <button
                    onClick={() => {
                      setStudentSearchTerm('');
                      setStudentCurrentPage(1);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-200/60 transition-colors cursor-pointer"
                    title="Effacer la recherche"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Selectors & Quick Filters */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Class selector */}
                <div className="min-w-[190px] flex-1 sm:flex-initial">
                  <ClassSelectorPill
                    classes={classes}
                    selectedClassId={selectedClassId}
                    onSelectClass={(id) => {
                      setSelectedClassId(id);
                      setStudentCurrentPage(1);
                    }}
                    allowAll={true}
                    allLabel="Toutes les classes"
                    labelPrefix=""
                    variant="field"
                    size="sm"
                    colorScheme="indigo"
                    className="w-full"
                  />
                </div>

                {/* Multi-Campus selector for Students tab if global user */}
                {hasMultiCampus && !user.campus_id && (
                  <div className="min-w-[180px] flex-1 sm:flex-initial">
                    <SelectPill
                      options={campusOptions}
                      value={selectedCampusFilter}
                      onChange={(val) => {
                        setSelectedCampusFilter(val);
                        setStudentCurrentPage(1);
                      }}
                      variant="field"
                      size="sm"
                      colorScheme="indigo"
                      icon={Building2}
                      labelPrefix="Annexe :"
                      className="w-full sm:min-w-[190px]"
                    />
                  </div>
                )}

                {/* Gender quick filter */}
                <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200/60 text-xs font-bold shrink-0">
                  <button
                    onClick={() => {
                      setStudentGenderFilter('ALL');
                      setStudentCurrentPage(1);
                    }}
                    className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                      studentGenderFilter === 'ALL'
                        ? 'bg-white text-indigo-900 shadow-2xs font-black'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Tous
                  </button>
                  <button
                    onClick={() => {
                      setStudentGenderFilter('M');
                      setStudentCurrentPage(1);
                    }}
                    className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                      studentGenderFilter === 'M'
                        ? 'bg-blue-600 text-white shadow-2xs font-black'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Garçons
                  </button>
                  <button
                    onClick={() => {
                      setStudentGenderFilter('F');
                      setStudentCurrentPage(1);
                    }}
                    className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                      studentGenderFilter === 'F'
                        ? 'bg-rose-600 text-white shadow-2xs font-black'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Filles
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* STUDENTS DATA TABLE */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-5 sm:p-6 bg-slate-50/60 border-b border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                    Registre des {terminology.students}
                    {selectedClassId && selectedClassId.toLowerCase() !== 'all' && (
                      <span className="text-indigo-600 ml-1.5">
                        - {classes.find(c => c.id === selectedClassId)?.name}
                      </span>
                    )}
                  </h2>
                  <span className="px-2.5 py-0.5 bg-indigo-100/80 text-indigo-900 text-[11px] font-black rounded-lg border border-indigo-200/60">
                    {filteredStudents.length} {terminology.student.toLowerCase()}{filteredStudents.length > 1 ? 's' : ''}
                  </span>
                  {studentTotalPages > 1 && (
                    <span className="px-2.5 py-0.5 bg-slate-200/70 text-slate-700 text-[11px] font-extrabold rounded-lg">
                      Page {studentCurrentPage} / {studentTotalPages}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500 font-bold flex-wrap">
                  <span>Total base : <strong className="text-slate-800">{students.length}</strong></span>
                  <span>•</span>
                  <span className="text-blue-700 font-bold">Garçons : {studentStats.boys}</span>
                  <span>•</span>
                  <span className="text-rose-700 font-bold">Filles : {studentStats.girls}</span>
                </div>
              </div>
              
              <div className="flex items-center gap-2 flex-wrap">
                <button 
                  onClick={() => fetchStudentsData()}
                  className="p-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-all cursor-pointer disabled:opacity-50"
                  disabled={loading}
                  title="Rafraîchir"
                >
                  <RefreshCcw size={15} className={loading ? 'animate-spin' : ''} />
                </button>
                <button 
                  onClick={exportStudentsPDF}
                  disabled={loading || filteredStudents.length === 0}
                  className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-black tracking-wide transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40 border border-rose-200/60"
                >
                  <Download size={14} /> PDF
                </button>
                <button 
                  onClick={exportStudentsExcel}
                  disabled={loading || filteredStudents.length === 0}
                  className="px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-black tracking-wide transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40 border border-emerald-200/60"
                >
                  <FileSpreadsheet size={14} /> Excel
                </button>
              </div>
            </div>

            {loading ? (
              <div className="py-8">
                <FluidLoadingState 
                  message={`Chargement du rapport académique des ${terminology.students.toLowerCase()}...`} 
                  subtext="Consolidation des effectifs, statistiques de présence et dossiers d'élèves..." 
                />
                <SkeletonTable rows={5} />
              </div>
            ) : (
            <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
              <table className="w-full text-left border-collapse min-w-[850px]">
                <thead>
                  <tr className="bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-950 text-indigo-100 text-[11px] font-black uppercase tracking-wider border-b border-indigo-900/60 shadow-xs select-none">
                    <th className="px-4 py-3.5 text-center min-w-[60px]">
                      <span className="text-indigo-200">N°</span>
                    </th>
                    <th className="px-4 py-3.5 min-w-[220px]">
                      <span className="text-indigo-200 flex items-center gap-1.5">
                        <Users size={13} className="text-indigo-400" /> Identité Élève / Étudiant
                      </span>
                    </th>
                    <th className="px-4 py-3.5 min-w-[120px]">
                      <span className="text-indigo-200 flex items-center gap-1.5">
                        <Layers size={13} className="text-indigo-400" /> Classe
                      </span>
                    </th>
                    {hasMultiCampus && (
                      <th className="px-4 py-3.5 min-w-[140px]">
                        <span className="text-indigo-200 flex items-center gap-1.5">
                          <Building2 size={13} className="text-indigo-400" /> Annexe / Campus
                        </span>
                      </th>
                    )}
                    <th className="px-4 py-3.5 text-center min-w-[80px]">
                      <span className="text-indigo-200">Sexe</span>
                    </th>
                    <th className="px-4 py-3.5 min-w-[130px]">
                      <span className="text-indigo-200 flex items-center gap-1.5">
                        <Calendar size={13} className="text-indigo-400" /> Date Naissance
                      </span>
                    </th>
                    <th className="px-4 py-3.5 min-w-[180px]">
                      <span className="text-indigo-200">Parent / Contact</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={hasMultiCampus ? 7 : 6} className="py-16 text-center text-slate-500 font-bold text-xs italic">
                        {students.length === 0 ? (
                          `Aucun ${terminology.student.toLowerCase()} trouvé pour les critères sélectionnés.`
                        ) : (
                          <div className="space-y-3">
                            <p>Aucun résultat ne correspond à votre recherche « {studentSearchTerm} ».</p>
                            <button
                              onClick={() => {
                                setStudentSearchTerm('');
                                setStudentGenderFilter('ALL');
                                setStudentCurrentPage(1);
                              }}
                              className="px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl text-xs font-black transition-all cursor-pointer border border-indigo-200"
                            >
                              Réinitialiser la recherche
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ) : (
                    paginatedStudents.map((s, index) => {
                      const globalIndex = (studentCurrentPage - 1) * studentItemsPerPage + index + 1;
                      return (
                        <tr key={s.id} className="hover:bg-indigo-50/40 transition-colors">
                          <td className="px-4 py-3.5 text-center text-xs font-bold text-slate-400">
                            {globalIndex}
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-xs font-extrabold text-slate-900">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-lg bg-indigo-100/80 text-indigo-800 font-black text-[10px] flex items-center justify-center shrink-0 border border-indigo-200/50">
                                {s.first_name?.charAt(0)}{s.last_name?.charAt(0)}
                              </div>
                              <div>
                                <span className="whitespace-nowrap font-black text-slate-900 text-xs block">
                                  {formatStudentName(s.last_name, s.first_name).fullName}
                                </span>
                                {s.matricule && (
                                  <span className="text-[10px] font-mono text-slate-400 font-normal">
                                    Matr: {s.matricule}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-xs font-bold text-slate-700">
                            <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-[11px] font-extrabold border border-slate-200/50">
                              {s.classes?.name || 'N/A'}
                            </span>
                          </td>
                          {hasMultiCampus && (
                            <td className="px-4 py-3.5 whitespace-nowrap text-xs font-bold text-slate-700">
                              <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 rounded-lg text-[10px] font-black uppercase tracking-wider">
                                📍 {s.school_campuses?.name || 'Siège'}
                              </span>
                            </td>
                          )}
                          <td className="px-4 py-3.5 text-center text-xs font-extrabold text-slate-600">
                            {s.gender ? (
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                                s.gender.toUpperCase().startsWith('M') 
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200/60' 
                                  : 'bg-rose-50 text-rose-700 border border-rose-200/60'
                              }`}>
                                {s.gender.charAt(0).toUpperCase()}
                              </span>
                            ) : '-'}
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-xs font-bold text-slate-600">
                            {s.dob ? new Date(s.dob).toLocaleDateString('fr-FR') : '-'}
                          </td>
                          <td className="px-4 py-3.5 text-xs">
                            <div className="font-extrabold text-slate-800 whitespace-nowrap">{s.parent_name || '-'}</div>
                            <div className="text-[11px] text-slate-500 font-mono mt-0.5 whitespace-nowrap">{s.parent_phone || '-'}</div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            )}

            {/* MODERN & FLUID PAGINATION CONTROLS */}
            {!loading && filteredStudents.length > 0 && (
              <div className="p-4 sm:p-5 bg-slate-50/70 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4">
                
                {/* Left: Info & items per page */}
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs font-bold text-slate-600">
                  <div>
                    Affichage de <span className="font-extrabold text-slate-900">{(studentCurrentPage - 1) * studentItemsPerPage + 1}</span> à{' '}
                    <span className="font-extrabold text-slate-900">
                      {Math.min(studentCurrentPage * studentItemsPerPage, filteredStudents.length)}
                    </span>{' '}
                    sur <span className="font-extrabold text-slate-900">{filteredStudents.length}</span> {terminology.student.toLowerCase()}s
                    {studentSearchTerm && filteredStudents.length !== students.length && (
                      <span className="text-slate-400 font-medium ml-1">
                        (filtrés sur {students.length})
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pl-2 sm:border-l sm:border-slate-200">
                    <span className="text-slate-500 font-semibold">Par page :</span>
                    <SelectPill
                      options={[
                        { value: '10', label: '10 / page' },
                        { value: '25', label: '25 / page' },
                        { value: '50', label: '50 / page' },
                        { value: '100', label: '100 / page' }
                      ]}
                      value={studentItemsPerPage.toString()}
                      onChange={(val) => {
                        setStudentItemsPerPage(Number(val));
                        setStudentCurrentPage(1);
                      }}
                      variant="field"
                      size="xs"
                      colorScheme="slate"
                      portal={true}
                      className="w-28 shrink-0"
                    />
                  </div>
                </div>

                {/* Right: Page Navigation buttons */}
                <div className="flex items-center gap-1.5 flex-wrap justify-center">
                  {/* First page */}
                  <button
                    onClick={() => setStudentCurrentPage(1)}
                    disabled={studentCurrentPage === 1}
                    className="p-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:text-indigo-600 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-slate-600 transition-all shadow-2xs cursor-pointer"
                    title="Première page"
                    aria-label="Première page"
                  >
                    <ChevronsLeft size={15} />
                  </button>

                  {/* Previous page */}
                  <button
                    onClick={() => setStudentCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={studentCurrentPage === 1}
                    className="p-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:text-indigo-600 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-slate-600 transition-all shadow-2xs cursor-pointer"
                    title="Page précédente"
                    aria-label="Page précédente"
                  >
                    <ChevronLeft size={15} />
                  </button>

                  {/* Page numbers with smart ellipsis */}
                  <div className="flex items-center gap-1">
                    {(() => {
                      const pages: (number | string)[] = [];
                      const total = studentTotalPages;
                      const current = studentCurrentPage;

                      if (total <= 7) {
                        for (let i = 1; i <= total; i++) pages.push(i);
                      } else {
                        pages.push(1);
                        if (current > 3) {
                          pages.push('ellipsis-start');
                        }

                        const start = Math.max(2, current - 1);
                        const end = Math.min(total - 1, current + 1);

                        for (let i = start; i <= end; i++) {
                          pages.push(i);
                        }

                        if (current < total - 2) {
                          pages.push('ellipsis-end');
                        }
                        pages.push(total);
                      }

                      return pages.map((page, idx) => {
                        if (typeof page === 'string') {
                          return (
                            <span key={`ellipsis-${idx}`} className="px-1.5 py-1 text-slate-400 text-xs font-black">
                              •••
                            </span>
                          );
                        }

                        const isActive = page === current;
                        return (
                          <button
                            key={page}
                            onClick={() => setStudentCurrentPage(page)}
                            className={`min-w-[34px] h-[34px] px-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                              isActive
                                ? 'bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white shadow-md shadow-indigo-500/20 scale-105'
                                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200/80 shadow-2xs'
                            }`}
                          >
                            {page}
                          </button>
                        );
                      });
                    })()}
                  </div>

                  {/* Next page */}
                  <button
                    onClick={() => setStudentCurrentPage(prev => Math.min(studentTotalPages, prev + 1))}
                    disabled={studentCurrentPage === studentTotalPages}
                    className="p-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:text-indigo-600 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-slate-600 transition-all shadow-2xs cursor-pointer"
                    title="Page suivante"
                    aria-label="Page suivante"
                  >
                    <ChevronRight size={15} />
                  </button>

                  {/* Last page */}
                  <button
                    onClick={() => setStudentCurrentPage(studentTotalPages)}
                    disabled={studentCurrentPage === studentTotalPages}
                    className="p-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:text-indigo-600 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-slate-600 transition-all shadow-2xs cursor-pointer"
                    title="Dernière page"
                    aria-label="Dernière page"
                  >
                    <ChevronsRight size={15} />
                  </button>

                  {/* Quick jump if more than 5 pages */}
                  {studentTotalPages > 5 && (
                    <div className="flex items-center gap-1.5 pl-2 ml-1 border-l border-slate-200 text-xs font-bold text-slate-500">
                      <span>Aller à :</span>
                      <input
                        type="number"
                        min={1}
                        max={studentTotalPages}
                        value={studentCurrentPage}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          if (val >= 1 && val <= studentTotalPages) {
                            setStudentCurrentPage(val);
                          }
                        }}
                        className="w-12 py-1 px-1.5 bg-white border border-slate-200 rounded-lg text-center text-xs font-black text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>

        </div>
      )}

      {/* MODAL ANNULATION DE TRANSACTION & PASS SUPERVISEUR */}
      <Modal
        isOpen={!!cancellingPayment}
        onClose={() => {
          if (!isCancelling) {
            setCancellingPayment(null);
            setCancelReason('');
            setValidatorEmail('');
            setValidatorPassword('');
          }
        }}
        title={
          <div className="flex items-center gap-2 text-rose-600">
            <AlertTriangle size={22} />
            <span className="font-black text-lg">Annulation de Transaction</span>
          </div>
        }
        hideDefaultActions={true}
        type="danger"
        containerClassName="max-w-lg rounded-3xl"
        contentClassName="p-6 space-y-4"
      >
        <div className="space-y-4">
          <div className="p-4 bg-rose-50/70 border border-rose-200/80 rounded-2xl space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-rose-800 font-bold uppercase tracking-wider">Reçu / Référence :</span>
              <span className="font-mono font-black text-rose-950">{cancellingPayment?.receipt_number || cancellingPayment?.id?.slice(0, 8)}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-rose-800 font-bold uppercase tracking-wider">Montant :</span>
              <span className="font-mono font-black text-rose-950 text-sm">
                {cancellingPayment?.currency !== 'HTG' ? (
                  `${Number(cancellingPayment?.original_amount || cancellingPayment?.amount).toLocaleString()} ${cancellingPayment?.currency} (Eq: ${Number(cancellingPayment?.amount).toLocaleString()} HTG)`
                ) : (
                  `${Number(cancellingPayment?.amount).toLocaleString()} HTG`
                )}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-rose-800 font-bold uppercase tracking-wider">{terminology.student} :</span>
              <span className="font-bold text-rose-950 truncate max-w-[200px]">
                {cancellingPayment?.students?.name || cancellingPayment?.student_name || 'Vente directe'}
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">
              Motif de l'annulation <span className="text-rose-500">*</span>
            </label>
            <input 
              type="text"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 transition-all"
              placeholder="Ex: Erreur de montant, doublon, chèque sans provision..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              disabled={isCancelling}
            />
          </div>

          <div className="border-t border-slate-100 pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <Lock size={16} className="text-rose-600 animate-pulse" />
                <span>Autorisation Superviseur / Admin</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-full font-bold">
                Sans déconnexion
              </span>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 leading-relaxed">
              {user.role === 'SUPER_ADMIN' || user.role === 'SCHOOL_ADMIN' || user.role === 'DIRECTOR' || user.is_super_admin ? (
                <span>Confirmez vos identifiants administrateur pour authentifier et signer cette annulation de transaction.</span>
              ) : (
                <span>
                  <strong className="text-slate-900">Opérateur connecté :</strong> {user.full_name || user.email}<br/>
                  L'administrateur ou directeur présent à vos côtés saisit son email et mot de passe ci-dessous pour valider immédiatement l'annulation, <strong className="text-slate-900">sans fermer votre session</strong>.
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Email du validateur autorisé</label>
                <input 
                  type="email"
                  className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 transition-all font-mono"
                  placeholder="admin@edunova.pro"
                  value={validatorEmail}
                  onChange={(e) => setValidatorEmail(e.target.value)}
                  disabled={isCancelling}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Mot de passe du validateur</label>
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"}
                    className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 transition-all font-mono pr-10"
                    placeholder="••••••••"
                    value={validatorPassword}
                    onChange={(e) => setValidatorPassword(e.target.value)}
                    disabled={isCancelling}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-3">
            <button
              onClick={() => {
                setCancellingPayment(null);
                setCancelReason('');
                setValidatorEmail('');
                setValidatorPassword('');
              }}
              disabled={isCancelling}
              className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold text-xs hover:bg-gray-200 transition-colors disabled:opacity-50 cursor-pointer"
            >
              Fermer
            </button>
            <button
              onClick={handleConfirmCancelTransaction}
              disabled={isCancelling || !cancelReason.trim() || !validatorEmail.trim() || !validatorPassword.trim()}
              className="flex-1 px-4 py-2.5 bg-rose-600 text-white rounded-xl font-bold text-xs hover:bg-rose-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm shadow-rose-200 cursor-pointer"
            >
              {isCancelling ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Validation...
                </>
              ) : (
                <>
                  <ShieldCheck size={16} />
                  Valider & Annuler
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
};

export default ReportsView;
