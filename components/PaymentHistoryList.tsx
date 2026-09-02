
import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  Download, 
  Printer, 
  History,
  Calendar, 
  CreditCard, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  ChevronDown, 
  MoreVertical,
  FileSpreadsheet,
  DollarSign,
  Wallet,
  RefreshCcw,
  X,
  Check,
  Loader2,
  AlertTriangle,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck
} from 'lucide-react';
import { supabase } from '../supabase';
import { useSchool } from '../contexts/SchoolContext';
import Modal from './Modal';
import { FluidLoadingState, SkeletonTable } from './SkeletonLoader';
import { UserProfile, UserRole } from '../types';
import { AuditLogger } from '../utils/auditLogger';
import { toast } from 'sonner';
import { formatStudentName } from '../utils/formatters';
import { isCashDateLocked } from '../services/cashClosureService';
import { getLocalTodayString } from '../utils/dateUtils';
import { SelectPill, SelectOption } from './SelectPill';
import { DatePickerPill } from './DatePickerPill';
import { AcademicSessionPill } from './AcademicSessionPill';
import { ClassSelectorPill } from './ClassSelectorPill';
import { Layers } from 'lucide-react';

import { useLocation } from 'react-router-dom';

const STATUSES = ['Tous', 'Validé', 'En attente', 'Annulé'];

const PaymentHistoryList: React.FC<{ user: UserProfile }> = ({ user }) => {
  const { terminology, currentCampusId, activeAcademicYear } = useSchool();
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [methodFilter, setMethodFilter] = useState('Tous');
  const [statusFilter, setStatusFilter] = useState(location.state?.filterStatus || 'Tous');
  const [dateFilter, setDateFilter] = useState(location.state?.filterStatus ? 'Toutes les dates' : "Aujourd'hui");
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>(activeAcademicYear?.id || 'all');
  const [classes, setClasses] = useState<any[]>([]);
  const [academicYears, setAcademicYears] = useState<any[]>([]);

  const todayStr = useMemo(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [customDate, setCustomDate] = useState<string>(todayStr);

  const handleSetDatePreset = (preset: 'today' | 'this_week' | 'this_month' | 'this_quarter' | 'this_year' | 'clear') => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const d = now.getDate();

    if (preset === 'today') {
      setStartDate(todayStr);
      setEndDate(todayStr);
      setDateFilter("Aujourd'hui");
    } else if (preset === 'this_week') {
      const dayOfWeek = now.getDay();
      const diff = d - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      const firstDay = new Date(y, m, diff);
      const startStr = `${firstDay.getFullYear()}-${String(firstDay.getMonth() + 1).padStart(2, '0')}-${String(firstDay.getDate()).padStart(2, '0')}`;
      setStartDate(startStr);
      setEndDate(todayStr);
      setDateFilter('Cette semaine');
    } else if (preset === 'this_month') {
      const startStr = `${y}-${String(m + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(y, m + 1, 0).getDate();
      const endStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      setStartDate(startStr);
      setEndDate(endStr);
      setDateFilter('Ce mois');
    } else if (preset === 'this_quarter') {
      const qStartMonth = Math.floor(m / 3) * 3;
      const startStr = `${y}-${String(qStartMonth + 1).padStart(2, '0')}-01`;
      const lastDayOfQ = new Date(y, qStartMonth + 3, 0).getDate();
      const endStr = `${y}-${String(qStartMonth + 3).padStart(2, '0')}-${String(lastDayOfQ).padStart(2, '0')}`;
      setStartDate(startStr);
      setEndDate(endStr);
      setDateFilter('Toutes les dates');
    } else if (preset === 'this_year') {
      const startStr = `${y}-01-01`;
      const endStr = `${y}-12-31`;
      setStartDate(startStr);
      setEndDate(endStr);
      setDateFilter('Toutes les dates');
    } else if (preset === 'clear') {
      setStartDate('');
      setEndDate('');
      setDateFilter('Toutes les dates');
    }
  };

  const dateFilterOptions: SelectOption[] = useMemo(() => [
    { value: "Aujourd'hui", label: "Aujourd'hui", description: "Transactions du jour" },
    { value: 'Cette semaine', label: 'Cette semaine', description: "Depuis début de semaine" },
    { value: 'Ce mois', label: 'Ce mois', description: "Mois civil en cours" },
    { value: 'Date précise', label: 'Date précise', description: "Sélectionner au calendrier" },
    { value: 'Toutes les dates', label: 'Toutes les dates', description: "Historique complet" },
  ], []);

  const methodFilterOptions: SelectOption[] = useMemo(() => [
    { value: 'Tous', label: 'Toutes les méthodes', description: 'Tous modes de paiement' },
    { value: 'Dépôt Bancaire', label: 'Dépôt Bancaire', badge: 'Banque' },
    { value: 'Cash', label: 'Cash / Espèces', badge: 'Caisse' },
    { value: 'MonCash', label: 'MonCash', badge: 'Mobile' },
    { value: 'Chèque', label: 'Chèque', badge: 'Banque' },
  ], []);

  useEffect(() => {
    if (location.state?.filterStatus) {
      setStatusFilter(location.state.filterStatus);
      setDateFilter('Toutes les dates');
    }
  }, [location.state]);

  
  const [payments, setPayments] = useState<any[]>([]);
  const [exchangeRate, setExchangeRate] = useState<number>(132.5);
  const [loading, setLoading] = useState(true);
  const [confirmingPayment, setConfirmingPayment] = useState<{id: string, method: string, source: string, dateObj?: Date} | null>(null);
  const [rejectingPayment, setRejectingPayment] = useState<{id: string, method: string, source: string, dateObj?: Date} | null>(null);
  const [cancellingTransaction, setCancellingTransaction] = useState<{id: string, ref: string, source: string, originalMethod?: string, amount?: number, currency?: string, studentId?: string, dateObj?: Date} | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [refundToWallet, setRefundToWallet] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const [validatorEmail, setValidatorEmail] = useState('');
  const [validatorPassword, setValidatorPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const openCancelModal = (transaction: { id: string; ref: string; source: string; originalMethod?: string; amount?: number; currency?: string; studentId?: string; dateObj?: Date; }) => {
    const isCapable = user.role === UserRole.SUPER_ADMIN || user.role === UserRole.SCHOOL_ADMIN || user.role === UserRole.DIRECTOR || user.is_super_admin;
    setValidatorEmail(isCapable ? user.email : '');
    setValidatorPassword('');
    setShowPassword(false);
    setCancelReason('');
    setRefundToWallet(transaction.originalMethod === "Portefeuille");
    setCancellingTransaction(transaction);
  };

  const fetchPayments = async () => {
    if (!user?.school_id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      let paymentsQuery = supabase
        .from('payments')
        .select('*, campaign:ad_hoc_campaigns(id, name)')
        .eq('school_id', user.school_id);
        
      if (currentCampusId) {
        paymentsQuery = paymentsQuery.eq('campus_id', currentCampusId);
      }
      
      const { data: paymentsData, error: paymentsError } = await paymentsQuery.order('created_at', { ascending: false });

      if (paymentsError) {
        console.error("Erreur Supabase paiements:", paymentsError);
        throw paymentsError;
      }
      
      let suppliesQuery = supabase
        .from('school_supplies')
        .select('*')
        .eq('school_id', user.school_id);
        
      if (currentCampusId) {
        suppliesQuery = suppliesQuery.eq('campus_id', currentCampusId);
      }
      
      const { data: suppliesData, error: suppliesError } = await suppliesQuery.order('created_at', { ascending: false });
        
      if (suppliesError) {
        console.error("Erreur Supabase supplies:", suppliesError);
      }
      
      let studentsQuery = supabase
        .from('students')
        .select('id, first_name, last_name, class_id')
        .eq('school_id', user.school_id);
        
      if (currentCampusId) {
        studentsQuery = studentsQuery.eq('campus_id', currentCampusId);
      }
      
      const { data: studentsData, error: studentsError } = await studentsQuery;
        
      if (studentsError) {
        console.error("Erreur Supabase students:", studentsError);
      }
      
      let classesQuery = supabase
        .from('classes')
        .select('id, name')
        .eq('school_id', user.school_id);
        
      if (currentCampusId) {
        classesQuery = classesQuery.eq('campus_id', currentCampusId);
      }
      
      const { data: classesData, error: classesError } = await classesQuery;
        
      if (classesError) {
        console.error("Erreur Supabase classes:", classesError);
      }
      setClasses(classesData || []);

      const { data: yearsData, error: yearsError } = await supabase
        .from('academic_years')
        .select('*')
        .eq('school_id', user.school_id)
        .order('start_date', { ascending: false });

      if (yearsError) {
        console.error("Erreur Supabase academic_years:", yearsError);
      }
      setAcademicYears(yearsData || []);
      
      // Create maps for quick lookup
      const classesMap = new Map();
      (classesData || []).forEach(c => classesMap.set(c.id, c.name));
      
      const studentsMap = new Map();
      (studentsData || []).forEach(s => {
        studentsMap.set(s.id, {
          name: formatStudentName(s.last_name, s.first_name).fullName || 'Inconnu',
          className: classesMap.get(s.class_id) || 'N/A',
          classId: s.class_id
        });
      });
      
      // 3. Fetch exchange rate
      const { data: rateData } = await supabase
        .from('exchange_rates')
        .select('*')
        .eq('school_id', user.school_id)
        .order('effective_date', { ascending: false })
        .limit(1);
        
      const currentRate = rateData?.[0]?.rate_usd_to_htg || rateData?.[0]?.rate || 132.50;
      setExchangeRate(currentRate);

      // Transform data for the view
      let allTransactions: any[] = [];
      
      (paymentsData || []).forEach(p => {
        const isPending = p.payment_method?.includes('EN ATTENTE') || p.status === 'EN_ATTENTE' || p.moncash_status === 'PENDING';
        const baseMethod = p.payment_method?.replace(' (EN ATTENTE)', '')?.replace(' (REJETÉ)', '') || (p.moncash_status === 'PENDING' ? 'MonCash' : 'Cash');
        
        let status = 'Validé';
        if (p.status === 'ANNULE') {
          status = 'Annulé';
        } else if (isPending) {
          status = 'En attente';
        }
        
        const studentInfo = studentsMap.get(p.student_id) || { name: 'Inconnu', className: 'N/A' };
        
        let tempAmountHtg = p.amount_htg_equivalent;
        if (!tempAmountHtg || isNaN(tempAmountHtg)) {
           tempAmountHtg = Number(p.amount || 0);
           if (p.currency === 'USD') tempAmountHtg *= currentRate;
        }

        allTransactions.push({
          id: p.id,
          source: 'payments',
          ref: `RCP-${p.id.substring(0, 8).toUpperCase()}`,
          studentName: studentInfo.name,
          studentId: p.student_id,
          classId: studentInfo.classId || p.class_id,
          academic_year_id: p.academic_year_id,
          className: studentInfo.className,
          nature: p.campaign?.name 
            ? `Campagne: ${p.campaign.name}` 
            : p.ad_hoc_campaign_id 
            ? 'Frais de Campagne' 
            : (p.fee_type === 'SCOLARITE' || (!p.fee_type && (!p.nature || p.nature === 'SCOLARITE'))) 
            ? 'Frais Académiques' 
            : ((p.fee_type === 'INSCRIPTION' || p.nature === 'INSCRIPTION' || p.nature === "Frais d'inscription") 
            ? 'Inscription' 
            : (p.nature || p.type || p.fee_type || 'Frais Divers')),
          amount: p.amount,
          amount_htg_equivalent: tempAmountHtg,
          currency: p.currency,
          method: baseMethod,
          dateObj: new Date(p.created_at),
          date: new Date(p.created_at).toLocaleDateString('fr-FR'),
          status: status,
          cancelReason: p.cancel_reason,
          originalMethod: p.payment_method
        });
      });
      
      const groupedHistorySupplies = new Map<string, any>();

      (suppliesData || []).forEach(s => {
        const txId = s.transaction_id || s.id;
        
        if (groupedHistorySupplies.has(txId)) {
          const existing = groupedHistorySupplies.get(txId);
          existing.total_amount = Number(existing.total_amount || 0) + Number(s.total_amount || 0);
          existing.amount_htg_equivalent = Number(existing.amount_htg_equivalent || 0) + Number(s.amount_htg_equivalent || s.total_amount || 0);
        } else {
          groupedHistorySupplies.set(txId, { ...s });
        }
      });

      Array.from(groupedHistorySupplies.values()).forEach(s => {
        const isPending = s.payment_method?.includes('EN ATTENTE') || s.status === 'EN_ATTENTE' || s.moncash_status === 'PENDING';
        const baseMethod = s.payment_method?.replace(' (EN ATTENTE)', '')?.replace(' (REJETÉ)', '') || (s.moncash_status === 'PENDING' ? 'MonCash' : 'Cash');
        
        let status = 'Validé';
        if (s.status === 'ANNULE') {
          status = 'Annulé';
        } else if (isPending) {
          status = 'En attente';
        }
        
        const studentInfo = studentsMap.get(s.student_id) || { name: 'Inconnu', className: 'N/A' };
        
        let tempAmountHtg = s.amount_htg_equivalent;
        if (!tempAmountHtg || isNaN(tempAmountHtg)) {
           tempAmountHtg = Number(s.total_amount || 0);
           if (s.currency === 'USD') tempAmountHtg *= currentRate;
        }

        allTransactions.push({
          source: 'school_supplies',
          ref: `FOU-${(s.transaction_id || s.id).substring(0, 8).toUpperCase()}`,
          studentName: studentInfo.name,
          id: s.transaction_id || s.id,
          studentId: s.student_id,
          classId: studentInfo.classId || s.class_id,
          academic_year_id: s.academic_year_id,
          className: studentInfo.className,
          nature: 'Fournitures',
          amount: s.total_amount,
          amount_htg_equivalent: tempAmountHtg,
          currency: s.currency || 'HTG',
          method: baseMethod,
          dateObj: new Date(s.created_at),
          date: new Date(s.created_at).toLocaleDateString('fr-FR'),
          status: status,
          cancelReason: s.cancel_reason,
          originalMethod: s.payment_method
        });
      });
      
      // Sort all transactions by date descending
      allTransactions.sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime());
      
      setPayments(allTransactions);
    } catch (error) {
      console.error("Erreur chargement paiements:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const handleValidatePayment = async () => {
    if (!confirmingPayment) return;
    
    // Lock check
    const txDate = confirmingPayment.dateObj ? confirmingPayment.dateObj.toISOString().split('T')[0] : getLocalTodayString();
    const lockCheck = await isCashDateLocked(user.school_id, currentCampusId || user.campus_id || null, txDate);
    if (lockCheck.isLocked) {
      toast.error(`🔒 Validation impossible : La caisse du ${txDate} est déjà clôturée et verrouillée.`);
      return;
    }

    setIsProcessing(true);
    
    try {
      const isMonCash = confirmingPayment.method.includes('MonCash');
      const validStatus = confirmingPayment.source === 'school_supplies' ? 'PAID' : 'VALIDE';
      
      const { error } = await supabase
        .from(confirmingPayment.source)
        .update({ 
          payment_method: confirmingPayment.method,
          status: validStatus,
          ...(isMonCash ? { moncash_status: 'SUCCESSFUL' } : {})
        })
        .eq('id', confirmingPayment.id);
        
      if (error) throw error;
      
      toast.success("Paiement validé avec succès");
      
      // Refresh list
      fetchPayments();
      setConfirmingPayment(null);
    } catch (error: any) {
      console.error("Erreur validation paiement:", error);
      toast.error("Erreur lors de la validation");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRejectPayment = async () => {
    if (!rejectingPayment) return;

    // Lock check
    const txDate = rejectingPayment.dateObj ? rejectingPayment.dateObj.toISOString().split('T')[0] : getLocalTodayString();
    const lockCheck = await isCashDateLocked(user.school_id, currentCampusId || user.campus_id || null, txDate);
    if (lockCheck.isLocked) {
      toast.error(`🔒 Rejet impossible : La caisse du ${txDate} est déjà clôturée et verrouillée.`);
      return;
    }

    setIsProcessing(true);
    
    try {
      const isMonCash = rejectingPayment.method.includes('MonCash');
      const cancelStatus = 'ANNULE';
      
      const { error } = await supabase
        .from(rejectingPayment.source)
        .update({ 
          status: cancelStatus,
          cancelled_at: new Date().toISOString(),
          cancelled_by: user.id,
          cancel_reason: 'Rejet de validation',
          ...(isMonCash ? { moncash_status: 'FAILED' } : {})
        })
        .eq('id', rejectingPayment.id);
        
      if (error) throw error;
      
      toast.success("Paiement rejeté");
      
      // Log audit
      await AuditLogger.log({
        school_id: user.school_id || '',
        user_id: user.id,
        action: 'UPDATE',
        entity_type: 'payment',
        entity_id: rejectingPayment.id,
        details: {
          reason: 'Rejet de validation',
          source: rejectingPayment.source
        }
      });

      // Refresh list
      fetchPayments();
      setRejectingPayment(null);
    } catch (error: any) {
      console.error("Erreur rejet paiement:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelTransaction = async () => {
    if (!cancellingTransaction || !cancelReason.trim()) return;
    if (!validatorEmail.trim() || !validatorPassword.trim()) {
      toast.error("Veuillez saisir l'adresse email et le mot de passe de validation.");
      return;
    }

    // Lock check
    const txDate = cancellingTransaction.dateObj ? cancellingTransaction.dateObj.toISOString().split('T')[0] : getLocalTodayString();
    const lockCheck = await isCashDateLocked(user.school_id, currentCampusId || user.campus_id || null, txDate);
    if (lockCheck.isLocked) {
      toast.error(`🔒 Annulation impossible : La caisse du ${txDate} est déjà clôturée et verrouillée.`);
      return;
    }

    setIsProcessing(true);
    
    try {
      // 1. Double-validation request via backend
      const checkRes = await fetch('/api/verify-admin-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: validatorEmail,
          password: validatorPassword,
          school_id: user.school_id
        })
      });
      
      const checkData = await checkRes.json();
      if (!checkRes.ok || !checkData.success) {
        throw new Error(checkData.error || "La validation par mot de passe a échoué.");
      }

      const authorizer = checkData.profile;

      // 2. Perform cancellation
      const { error } = await supabase
        .from(cancellingTransaction.source)
        .update({ 
          status: 'ANNULE',
          cancelled_at: new Date().toISOString(),
          cancelled_by: user.id,
          cancel_reason: cancelReason
        })
        .eq('id', cancellingTransaction.id);
        
      if (error) throw error;
      
            // Auto-refund Wallet if the payment was made with Portefeuille OR if user opted to refund to wallet
      if ((cancellingTransaction.originalMethod === 'Portefeuille' || refundToWallet) && cancellingTransaction.studentId && cancellingTransaction.amount) {
        const { data: studentData, error: studentError } = await supabase
          .from('students')
          .select('wallet_balance_htg, wallet_balance_usd')
          .eq('id', cancellingTransaction.studentId)
          .single();
          
        if (!studentError && studentData) {
          const updateField = cancellingTransaction.currency === 'USD' ? 'wallet_balance_usd' : 'wallet_balance_htg';
          const currentBalance = Number(cancellingTransaction.currency === 'USD' ? (studentData.wallet_balance_usd || 0) : (studentData.wallet_balance_htg || 0));
          const newBalance = currentBalance + Number(cancellingTransaction.amount);
          
          await supabase.from('students').update({ [updateField]: newBalance }).eq('id', cancellingTransaction.studentId);
        }
      }

      // Log audit

      await AuditLogger.log({
        school_id: user.school_id || '',
        user_id: user.id,
        action: 'PAYMENT_CANCELLED',
        entity_type: 'payment',
        entity_id: cancellingTransaction.id,
        details: {
          reason: cancelReason,
          ref: cancellingTransaction.ref,
          source: cancellingTransaction.source,
          authorized_by_email: authorizer.email,
          authorized_by_name: authorizer.full_name,
          authorized_by_id: authorizer.id,
          authorized_by_role: authorizer.role
        }
      });

      toast.success("Transaction annulée avec succès");
      
      // Refresh list
      fetchPayments();
      setCancellingTransaction(null);
      setCancelReason('');
      setRefundToWallet(false);
      setValidatorEmail('');
      setValidatorPassword('');
    } catch (error: any) {
      console.error("Erreur annulation transaction:", error);
      toast.error(error.message || "Erreur lors de l'annulation");
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
      const s = searchTerm.toLowerCase();
      const matchesSearch = 
        !s ||
        p.studentName?.toLowerCase().includes(s) || 
        p.ref?.toLowerCase().includes(s) || 
        p.className?.toLowerCase().includes(s);
        
      const matchesMethod = methodFilter === 'Tous' || p.method === methodFilter;
      const matchesStatus = statusFilter === 'Tous' || p.status === statusFilter;
      
      const matchesClass = selectedClass === 'all' || p.classId === selectedClass;
      const matchesYear = selectedYear === 'all' || !p.academic_year_id || p.academic_year_id === selectedYear;

      let matchesDate = true;
      const pDate = p.dateObj ? new Date(p.dateObj) : null;
      if (pDate) {
        const pYear = pDate.getFullYear();
        const pMonth = String(pDate.getMonth() + 1).padStart(2, '0');
        const pDay = String(pDate.getDate()).padStart(2, '0');
        const paymentDateStr = `${pYear}-${pMonth}-${pDay}`;

        if (startDate || endDate) {
          if (startDate && paymentDateStr < startDate) matchesDate = false;
          if (endDate && paymentDateStr > endDate) matchesDate = false;
        } else if (dateFilter === "Aujourd'hui") {
          matchesDate = paymentDateStr === todayStr;
        } else if (dateFilter === 'Cette semaine') {
          const today = new Date();
          const dayOfWeek = today.getDay();
          const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
          const firstDay = new Date(today);
          firstDay.setDate(diff);
          const firstDayStr = `${firstDay.getFullYear()}-${String(firstDay.getMonth() + 1).padStart(2, '0')}-${String(firstDay.getDate()).padStart(2, '0')}`;
          matchesDate = paymentDateStr >= firstDayStr && paymentDateStr <= todayStr;
        } else if (dateFilter === 'Ce mois') {
          const today = new Date();
          const y = today.getFullYear();
          const m = String(today.getMonth() + 1).padStart(2, '0');
          matchesDate = paymentDateStr.startsWith(`${y}-${m}`);
        } else if (dateFilter === 'Date précise' && customDate) {
          matchesDate = paymentDateStr === customDate;
        }
      }

      return matchesSearch && matchesMethod && matchesStatus && matchesClass && matchesYear && matchesDate;
    });
  }, [payments, searchTerm, methodFilter, statusFilter, selectedClass, selectedYear, dateFilter, customDate, startDate, endDate, todayStr]);

  const totalCollected = filteredPayments
    .filter(p => p.status === 'Validé')
    .reduce((acc, curr) => acc + Number(curr.amount_htg_equivalent || curr.amount || 0), 0);

  const totalCollectedHTG = filteredPayments
    .filter(p => p.status === 'Validé' && (!p.currency || p.currency === 'HTG'))
    .reduce((acc, curr) => acc + Number(curr.amount || 0), 0);

  const totalCollectedUSD = filteredPayments
    .filter(p => p.status === 'Validé' && p.currency === 'USD')
    .reduce((acc, curr) => acc + Number(curr.amount || 0), 0);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, methodFilter, statusFilter, dateFilter]);

  const totalPages = Math.ceil(filteredPayments.length / itemsPerPage);
  const paginatedPayments = filteredPayments.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'Validé': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'En attente': return 'bg-amber-50 text-amber-700 border-amber-100';
      case 'Annulé': return 'bg-rose-50 text-rose-700 border-rose-100';
      default: return 'bg-gray-50 text-gray-700 border-gray-100';
    }
  };

  const getMethodIcon = (method: string) => {
    switch (method) {
      case 'Cash': return <Wallet size={14} />;
      case 'MonCash': return <CreditCard size={14} />;
      default: return <DollarSign size={14} />;
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-700 pb-20">
      
      {/* PANNEAU DE CONTRÔLE CENTRALISÉ (ENTÊTE, RECHERCHE & FILTRES UNIFIÉS) */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden print:hidden">
        {/* Entête sombre avec KPI */}
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-indigo-300 font-bold text-xs uppercase tracking-wider">
              <History size={16} className="text-indigo-400" />
              <span>Module Comptabilité</span>
              <span className="text-slate-600">•</span>
              <span className="bg-indigo-500/20 text-indigo-200 text-[10px] px-2.5 py-0.5 rounded-full border border-indigo-400/30 font-black">
                {currentCampusId ? "Annexe Active" : "Tous les Campus"}
              </span>
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight">Registre & Validations</h2>
            <p className="text-slate-300 text-xs">Journal centralisé des recettes et suivi des transactions académiques.</p>
          </div>

          <div className="flex items-center gap-4 bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/10 self-start md:self-auto">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-lg border border-emerald-500/30">
              <Wallet size={22} />
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black uppercase text-slate-300 tracking-wider">Total Encaissé (Validé)</p>
              <p className="text-xl font-black text-emerald-400 font-mono tracking-tight">
                {totalCollected.toLocaleString()} <span className="text-xs text-emerald-300 font-normal">HTG{totalCollectedUSD > 0 ? " eq." : ""}</span>
              </p>
              {totalCollectedUSD > 0 && (
                <p className="text-[10px] font-bold text-slate-300 mt-0.5">
                  {totalCollectedHTG.toLocaleString()} HTG | {totalCollectedUSD.toLocaleString()} USD
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Barre de Recherche & Filtres rapides */}
        <div className="p-5 bg-slate-50/70 space-y-4">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
            
            {/* Barre de Recherche fluide */}
            <div className="flex-1 relative group min-w-0">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-600 transition-colors">
                <Search size={18} />
              </div>
              <input 
                type="text" 
                placeholder={`Rechercher par ID (ex: RCP-), nom de l'${terminology.student.toLowerCase()} ou ${terminology.option.toLowerCase()}...`}
                className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-200/90 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 transition-all shadow-2xs"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-md transition-colors"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            {/* Chips Filtres par Statut */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 custom-scrollbar shrink-0">
              {STATUSES.map(s => {
                const isActive = statusFilter === s;
                let activeColor = 'bg-slate-900 text-white border-slate-900 shadow-2xs';
                if (s === 'Validé') activeColor = 'bg-emerald-600 text-white border-emerald-600 shadow-2xs';
                if (s === 'En attente') activeColor = 'bg-amber-500 text-white border-amber-500 shadow-2xs';
                if (s === 'Annulé') activeColor = 'bg-rose-600 text-white border-rose-600 shadow-2xs';

                return (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`px-3.5 py-2 text-xs font-bold rounded-xl border transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                      isActive 
                        ? activeColor
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span>{s === 'Tous' ? 'Tous les Statuts' : s}</span>
                  </button>
                );
              })}
            </div>

          </div>

          {/* LIGNE 2 : Sélecteurs Session Scolaire, Classe & Méthode */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-3 border-t border-slate-200/60">
            {/* 1. Session */}
            <div className="space-y-1.5 min-w-0">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1 flex items-center gap-1.5 truncate">
                <Calendar size={13} className="text-indigo-600 shrink-0" />
                Session {terminology.academicYear.includes('Académique') ? 'Académique' : 'Scolaire'}
              </label>
              <AcademicSessionPill
                academicYears={academicYears}
                selectedYearId={selectedYear}
                onSelectYear={(yearId) => setSelectedYear(yearId)}
                allowAll={true}
                allLabel="Toutes les sessions"
                variant="field"
                size="sm"
                colorScheme="indigo"
                className="w-full"
              />
            </div>

            {/* 2. Filtre Classe */}
            <div className="space-y-1.5 min-w-0">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1 flex items-center gap-1.5 truncate">
                <Layers size={13} className="text-indigo-600 shrink-0" />
                Filtre {terminology.option}
              </label>
              <ClassSelectorPill
                classes={classes}
                selectedClassId={selectedClass}
                onSelectClass={(classId) => setSelectedClass(classId)}
                allowAll={true}
                allLabel={`Toutes les ${terminology.classes.toLowerCase()}`}
                variant="field"
                size="sm"
                colorScheme="indigo"
                className="w-full"
                title={`Filtrer par ${terminology.class.toLowerCase()}`}
              />
            </div>

            {/* 3. Filtre Méthode */}
            <div className="space-y-1.5 min-w-0 sm:col-span-2 lg:col-span-1">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1 flex items-center gap-1.5 truncate">
                <CreditCard size={13} className="text-indigo-600 shrink-0" />
                Mode de Paiement
              </label>
              <SelectPill
                options={methodFilterOptions}
                value={methodFilter}
                onChange={(val) => setMethodFilter(val)}
                variant="field"
                size="sm"
                colorScheme="indigo"
                icon={CreditCard}
                className="w-full"
              />
            </div>
          </div>

          {/* LIGNE 3 : SECTEUR DE PLAGE DE DATES DÉDIÉ AVEC RACCOURCIS RAPIDES (Harmonisé) */}
          <div className="pt-3.5 border-t border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar size={13} className="text-indigo-600" /> Plage de Dates des Transactions
              </label>
              <div className="flex items-center gap-2">
                {(startDate || endDate || selectedClass !== 'all' || (selectedYear !== 'all' && selectedYear !== activeAcademicYear?.id) || methodFilter !== 'Tous' || statusFilter !== 'Tous' || searchTerm) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm('');
                      setMethodFilter('Tous');
                      setStatusFilter('Tous');
                      setSelectedClass('all');
                      setSelectedYear(activeAcademicYear?.id || 'all');
                      handleSetDatePreset('clear');
                    }}
                    className="text-[11px] font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer transition-colors px-2 py-0.5 rounded-lg hover:bg-rose-50"
                  >
                    <RefreshCcw size={11} /> Réinitialiser les filtres
                  </button>
                )}
                {(startDate || endDate) && (
                  <button
                    type="button"
                    onClick={() => handleSetDatePreset('clear')}
                    className="text-[11px] font-bold text-slate-600 hover:text-slate-800 flex items-center gap-1 cursor-pointer transition-colors px-2 py-0.5 rounded-lg hover:bg-slate-100"
                  >
                    <X size={12} /> Effacer dates
                  </button>
                )}
              </div>
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

            {/* Sous-ruban Raccourcis Rapides ergonomique & Actions */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2.5 border-t border-slate-200/60">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider mr-1 flex items-center gap-1 shrink-0">
                  <Clock size={12} className="text-indigo-600" /> Raccourcis :
                </span>
                <button
                  type="button"
                  onClick={() => handleSetDatePreset('today')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all border shadow-2xs cursor-pointer active:scale-95 ${
                    startDate === todayStr && endDate === todayStr
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 border-slate-200 hover:border-indigo-300'
                  }`}
                >
                  Aujourd'hui
                </button>
                <button
                  type="button"
                  onClick={() => handleSetDatePreset('this_week')}
                  className="px-3 py-1.5 text-xs font-bold rounded-xl bg-white hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 transition-all border border-slate-200 hover:border-indigo-300 shadow-2xs cursor-pointer active:scale-95"
                >
                  Cette semaine
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

              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                <button 
                  onClick={fetchPayments}
                  disabled={loading}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
                  title="Actualiser la liste"
                >
                  <RefreshCcw size={13} className={loading ? 'animate-spin' : ''} />
                  <span>Actualiser</span>
                </button>
                <button 
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
                  title="Imprimer le registre"
                >
                  <Printer size={14} />
                  <span>Imprimer</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. REGISTRE TABLEAU */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden print:shadow-sm print:border-none">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between print:hidden">
           <div className="flex items-center gap-3">
             <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
               <FileSpreadsheet size={20} />
             </div>
             <h3 className="font-bold text-slate-900 text-sm tracking-tight">Journal des recettes détaillées</h3>
           </div>
        </div>

        {loading ? (
          <div className="py-8">
            <FluidLoadingState 
              message="Chargement de l'historique des factures & paiements..." 
              subtext="Récupération sécurisée des reçus, pièces comptables et reçus de paiement..." 
            />
            <SkeletonTable rows={5} />
          </div>
        ) : filteredPayments.length === 0 ? (
          <div className="px-6 py-16 text-center space-y-4">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto text-gray-400">
              <Search size={32} />
            </div>
            <div>
              <p className="text-gray-500 font-medium text-sm">Aucun résultat trouvé pour "{searchTerm}"</p>
              <button onClick={() => {setSearchTerm(''); setMethodFilter('Tous'); setStatusFilter('Tous');}} className="text-blue-600 text-sm font-medium hover:underline mt-2 transition-all cursor-pointer">Réinitialiser les filtres</button>
            </div>
          </div>
        ) : (
          <>
            {/* VUE MOBILE & TABLETTE (CARTE RESPONSIVE SANS DÉBORDEMENT) */}
            <div className="block lg:hidden divide-y divide-slate-100 print:hidden">
              {paginatedPayments.map((p) => (
                <div key={`mobile-${p.source}-${p.id}`} className="p-4 space-y-3 hover:bg-slate-50/60 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                          {p.ref}
                        </span>
                        <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${getStatusStyle(p.status)}`}>
                          {p.status === 'Validé' && <CheckCircle2 size={11} />}
                          {p.status === 'En attente' && <Clock size={11} />}
                          {p.status === 'Annulé' && <XCircle size={11} />}
                          {p.status}
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-1 font-medium">
                        <Calendar size={12} className="text-slate-400" />
                        {p.date}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-base font-black text-slate-900 font-mono">
                        {Number(p.amount).toLocaleString()} <span className="text-xs font-bold text-slate-500 font-sans">{p.currency === 'USD' ? 'USD' : 'HTG'}</span>
                      </p>
                      {p.currency === 'USD' && (
                        <p className="text-[10px] text-slate-500 font-medium font-mono">
                          ≈ {Number(p.amount_htg_equivalent || p.amount).toLocaleString()} HTG
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-2.5 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">{terminology.student} :</span>
                      <span className="font-bold text-slate-900">{p.studentName}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">{terminology.option} :</span>
                      <span className="text-slate-700 font-semibold">{p.className}</span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                      <span className="text-slate-500 font-medium">Motif :</span>
                      <span className="font-bold text-indigo-700">{p.nature}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">Mode :</span>
                      <span className="flex items-center gap-1 text-slate-700 font-medium">
                        {getMethodIcon(p.method)}
                        {p.method}
                      </span>
                    </div>
                    {p.status === 'Annulé' && p.cancelReason && (
                      <div className="pt-1 border-t border-rose-100 text-rose-600 text-[10px] italic">
                        Motif d'annulation : {p.cancelReason}
                      </div>
                    )}
                  </div>

                  {/* Actions mobile */}
                  <div className="flex items-center justify-end gap-2 pt-1">
                    {p.status === 'En attente' && (user.role === UserRole.SCHOOL_ADMIN || user.role === UserRole.DIRECTOR || user.role === UserRole.ACCOUNTANT || user.is_super_admin) ? (
                      <div className="flex items-center gap-2 w-full">
                        <button 
                          onClick={() => setConfirmingPayment({ id: p.id, method: p.method, source: p.source, dateObj: p.dateObj })}
                          className="flex-1 py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                        >
                          <Check size={14} /> Valider
                        </button>
                        <button 
                          onClick={() => setRejectingPayment({ id: p.id, method: p.method, source: p.source, dateObj: p.dateObj })}
                          className="px-3 py-2 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-xl text-xs font-bold transition-all border border-rose-200 cursor-pointer"
                          title="Rejeter"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : p.status === 'Validé' && (user.role === UserRole.SCHOOL_ADMIN || user.role === UserRole.DIRECTOR || user.role === UserRole.ACCOUNTANT || user.role === UserRole.SECRETARY || user.is_super_admin) ? (
                      <button 
                        onClick={() => openCancelModal({ id: p.id, ref: p.ref, source: p.source, originalMethod: p.originalMethod, amount: p.amount, currency: p.currency, studentId: p.studentId, dateObj: p.dateObj })}
                        className="w-full py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border border-rose-200 cursor-pointer"
                      >
                        <AlertTriangle size={13} /> Annuler le versement
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>

            {/* VUE TABLEAU DESKTOP & IMPRESSION */}
            <div className="hidden lg:block overflow-x-auto print:block print:overflow-visible custom-scrollbar">
              <table className="w-full text-left min-w-[1000px]">
                <thead>
                  <tr className="bg-slate-900 text-white text-xs font-bold uppercase tracking-wider border-b border-slate-800">
                    <th className="px-6 py-4">ID & Date</th>
                    <th className="px-6 py-4">{terminology.student} & {terminology.option}</th>
                    <th className="px-6 py-4">Libellé</th>
                    <th className="px-6 py-4">Méthode</th>
                    <th className="px-6 py-4 text-right">Montant</th>
                    <th className="px-6 py-4 text-center">Statut</th>
                    <th className="px-6 py-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedPayments.map((p) => (
                  <tr key={`${p.source}-${p.id}`} className="group hover:bg-blue-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-gray-900">{p.ref}</p>
                      <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-1">
                        <Calendar size={14} />
                        {p.date}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900 text-sm">{p.studentName}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{p.className}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-700">{p.nature}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <span className="p-1.5 bg-gray-100 rounded-md text-gray-500">{getMethodIcon(p.method)}</span>
                        {p.method}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="text-base font-bold text-gray-900 font-mono">
                        {Number(p.amount).toLocaleString()} <span className="text-xs text-gray-500 font-sans">{p.currency === 'USD' ? 'USD' : 'HTG'}</span>
                      </p>
                      {p.currency === 'USD' && (
                        <p className="text-[10px] text-gray-400 font-medium">({Number(p.amount_htg_equivalent || p.amount).toLocaleString()} HTG eq.)</p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${getStatusStyle(p.status)}`}>
                        {p.status === 'Validé' && <CheckCircle2 size={14} />}
                        {p.status === 'En attente' && <Clock size={14} />}
                        {p.status === 'Annulé' && <XCircle size={10} />}
                        {p.status}
                      </div>
                      {p.status === 'Annulé' && p.cancelReason && (
                        <p className="text-[10px] text-rose-500 mt-1 italic max-w-[120px] mx-auto truncate" title={p.cancelReason}>
                          {p.cancelReason}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {p.status === 'En attente' && (user.role === UserRole.SCHOOL_ADMIN || user.role === UserRole.DIRECTOR || user.role === UserRole.ACCOUNTANT || user.is_super_admin) ? (
                        <div className="flex items-center justify-center gap-2">
                          <button 
                            onClick={() => setConfirmingPayment({ id: p.id, method: p.method, source: p.source, dateObj: p.dateObj })}
                            className="px-3 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 border border-emerald-200 hover:border-emerald-600 cursor-pointer"
                            title="Valider"
                          >
                            <Check size={14} /> Valider
                          </button>
                          <button 
                            onClick={() => setRejectingPayment({ id: p.id, method: p.method, source: p.source, dateObj: p.dateObj })}
                            className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-md transition-colors border border-rose-200 hover:border-rose-600 cursor-pointer"
                            title="Rejeter"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ) : p.status === 'Validé' && (user.role === UserRole.SCHOOL_ADMIN || user.role === UserRole.DIRECTOR || user.role === UserRole.ACCOUNTANT || user.role === UserRole.SECRETARY || user.is_super_admin) ? (
                        <button 
                          onClick={() => openCancelModal({ id: p.id, ref: p.ref, source: p.source, originalMethod: p.originalMethod, amount: p.amount, currency: p.currency, studentId: p.studentId, dateObj: p.dateObj })}
                          className="px-3 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 border border-rose-200 hover:border-rose-600 cursor-pointer"
                          title="Annuler la transaction (Superviseur sur place)"
                        >
                          <AlertTriangle size={14} /> Annuler
                        </button>
                      ) : (
                        <div className="flex items-center justify-center">
                          <span className="p-2 text-gray-300">
                            <MoreVertical size={18} />
                          </span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
        )}
        
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
            <p className="text-sm text-gray-500 font-medium">
              Affichage de <span className="font-bold text-gray-900">{(currentPage - 1) * itemsPerPage + 1}</span> à <span className="font-bold text-gray-900">{Math.min(currentPage * itemsPerPage, filteredPayments.length)}</span> sur <span className="font-bold text-gray-900">{filteredPayments.length}</span> résultats
            </p>
            <div className="flex gap-1">
              {Array.from({ length: totalPages }).map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentPage(idx + 1)}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                    currentPage === idx + 1
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-100'
                  }`}
                >
                  {idx + 1}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* MODAL DE VALIDATION */}
      <Modal
        isOpen={!!confirmingPayment}
        onClose={() => !isProcessing && setConfirmingPayment(null)}
        title="Validation de Paiement"
        hideDefaultActions
      >
        <div className="space-y-6">
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3 text-amber-800">
            <Clock className="shrink-0 mt-0.5" size={20} />
            <div className="text-sm">
              <p className="font-bold mb-1">Confirmation de réception des fonds</p>
              <p className="opacity-90">
                Vous êtes sur le point de valider ce paiement par {confirmingPayment?.method}. 
                Assurez-vous que les fonds sont bien disponibles sur le compte bancaire de l'université.
              </p>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={() => setConfirmingPayment(null)}
              disabled={isProcessing}
              className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium text-sm hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              onClick={handleValidatePayment}
              disabled={isProcessing}
              className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-medium text-sm hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Validation...
                </>
              ) : (
                <>
                  <CheckCircle2 size={18} />
                  Confirmer
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* MODAL DE REJET */}
      <Modal
        isOpen={!!rejectingPayment}
        onClose={() => !isProcessing && setRejectingPayment(null)}
        title="Rejet de Paiement"
        hideDefaultActions
      >
        <div className="space-y-6">
          <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl flex items-start gap-3 text-rose-800">
            <XCircle className="shrink-0 mt-0.5" size={20} />
            <div className="text-sm">
              <p className="font-bold mb-1">Annulation de la transaction</p>
              <p className="opacity-90">
                Vous êtes sur le point de rejeter ce paiement par {rejectingPayment?.method}. 
                Cette action marquera la transaction comme annulée et le montant restera dû par le / la {terminology.student.toLowerCase()}.
              </p>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={() => setRejectingPayment(null)}
              disabled={isProcessing}
              className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium text-sm hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              onClick={handleRejectPayment}
              disabled={isProcessing}
              className="flex-1 px-4 py-2.5 bg-rose-600 text-white rounded-xl font-medium text-sm hover:bg-rose-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Rejet...
                </>
              ) : (
                <>
                  <XCircle size={18} />
                  Rejeter
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* MODAL D'ANNULATION (MANAGER UNIQUEMENT) */}
      <Modal
        isOpen={!!cancellingTransaction}
        onClose={() => !isProcessing && setCancellingTransaction(null)}
        title="Annulation de Transaction (Sécurisée)"
        hideDefaultActions
      >
        <div className="space-y-6">
          <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl flex items-start gap-3 text-rose-800">
            <AlertTriangle className="shrink-0 mt-0.5 text-rose-600" size={20} />
            <div className="text-sm">
              <p className="font-bold mb-1 text-rose-900">Action hautement sensible : {cancellingTransaction?.ref}</p>
              <p className="opacity-90">
                L'annulation d'une transaction validée nécessite une justification obligatoire et une double validation par mot de passe administrateur pour éviter toute fraude interne.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">Motif de l'annulation</label>
            <textarea 
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 transition-all min-h-[80px]"
              placeholder="Ex: Erreur de saisie du montant, doublon, chèque sans provision..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              disabled={isProcessing}
            />
          </div>

          {cancellingTransaction?.originalMethod !== 'Portefeuille' && (
            <label className="flex items-center gap-3 p-4 border border-gray-200 rounded-xl bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors">
              <input
                type="checkbox"
                className="w-5 h-5 text-rose-600 rounded focus:ring-rose-500 border-gray-300"
                checked={refundToWallet}
                onChange={(e) => setRefundToWallet(e.target.checked)}
                disabled={isProcessing}
              />
              <div className="flex flex-col">
                <span className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <Wallet size={16} className="text-blue-600" />
                  Rembourser sous forme de crédit Portefeuille
                </span>
                <span className="text-xs text-gray-500">
                  Forcer l'argent à aller dans le Wallet de l'étudiant plutôt que de simplement annuler la transaction.
                </span>
              </div>
            </label>
          )}

          {cancellingTransaction?.originalMethod === 'Portefeuille' && (
            <div className="flex items-start gap-3 p-4 border border-blue-200 rounded-xl bg-blue-50">
              <Wallet size={18} className="text-blue-600 mt-0.5 shrink-0" />
              <div className="flex flex-col">
                <span className="text-sm font-bold text-blue-900">
                  Remboursement automatique vers le Portefeuille
                </span>
                <span className="text-xs text-blue-700/80">
                  Comme ce paiement a été effectué via le Portefeuille de l'étudiant, le montant sera automatiquement re-crédité.
                </span>
              </div>
            </div>
          )}

          <div className="border-t border-slate-100 pt-5 space-y-4">

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <Lock size={16} className="text-rose-600 animate-pulse" />
                <span>Autorisation Superviseur / Administrateur</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-full font-bold">
                Sans déconnexion
              </span>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 leading-relaxed">
              {user.role === UserRole.SUPER_ADMIN || user.role === UserRole.SCHOOL_ADMIN || user.role === UserRole.DIRECTOR || user.is_super_admin ? (
                <span>Confirmez vos identifiants administrateur pour authentifier et signer cette annulation de transaction.</span>
              ) : (
                <span>
                  <strong className="text-slate-900">Guichetier connecté :</strong> {user.full_name || user.email}<br/>
                  L'administrateur ou directeur présent à vos côtés saisit son email et mot de passe ci-dessous pour valider immédiatement l'annulation, <strong className="text-slate-900">sans fermer votre session</strong>.
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Email du validateur autorisé (Admin / Directeur)</label>
                <input 
                  type="email"
                  className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 transition-all font-mono"
                  placeholder="admin@edunova.pro"
                  value={validatorEmail}
                  onChange={(e) => setValidatorEmail(e.target.value)}
                  disabled={isProcessing}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Mot de passe du validateur</label>
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"}
                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 transition-all font-mono pr-10"
                    placeholder="••••••••"
                    value={validatorPassword}
                    onChange={(e) => setValidatorPassword(e.target.value)}
                    disabled={isProcessing}
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

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => { setCancellingTransaction(null); setCancelReason('');
    setRefundToWallet(false); setValidatorEmail(''); setValidatorPassword(''); }}
              disabled={isProcessing}
              className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium text-sm hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              Fermer
            </button>
            <button
              onClick={handleCancelTransaction}
              disabled={isProcessing || !cancelReason.trim() || !validatorEmail.trim() || !validatorPassword.trim()}
              className="flex-1 px-4 py-2.5 bg-rose-600 text-white rounded-xl font-medium text-sm hover:bg-rose-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm shadow-rose-200"
            >
              {isProcessing ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Validation...
                </>
              ) : (
                <>
                  <ShieldCheck size={18} />
                  Valider & Annuler
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

      <style>{`
        @media print {
          body {
            background: white;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:shadow-sm {
            box-shadow: none !important;
          }
          .print\\:border-none {
            border: none !important;
          }
          .print\\:overflow-visible {
            overflow: visible !important;
          }
          /* Hide actions column when printing */
          th:last-child, td:last-child {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default PaymentHistoryList;

