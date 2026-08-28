import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useSchool } from '../contexts/SchoolContext';
import { UserProfile, StaffMember, PayrollPeriod, PayrollSlip, SalaryAdvance } from '../types';
import { formatStudentName } from '../utils/formatters';
import { FluidLoadingState, SkeletonTable } from './SkeletonLoader';
import { 
  Wallet, Calendar, CheckCircle, Clock, AlertCircle, 
  FileText, User, Plus, Search, DollarSign, Save, X,
  HandCoins, Check, Ban, Info, RefreshCcw, BarChart3, Trash2,
  Download, Building2, ChevronDown, ChevronUp, Award, Sparkles, Filter, Users, CheckCircle2
} from 'lucide-react';

interface PayrollManagementViewProps {
  user: UserProfile;
}

const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

interface StaffPayrollRowProps {
  member: StaffMember;
  slip?: PayrollSlip;
  memberAdvances?: SalaryAdvance[];
  onSave: (staffId: string, base: number, bonus: number, deduction: number) => void;
  onDelete?: (slip: PayrollSlip) => void;
}

const StaffPayrollRow: React.FC<StaffPayrollRowProps> = ({ member, slip, memberAdvances, onSave, onDelete }) => {
  const isPaid = slip?.status === 'PAID';
  
  const totalAdvanceAmount = (memberAdvances || []).filter(a => 
    !slip || !slip.created_at || new Date(a.approved_at || a.requested_at).getTime() <= new Date(slip.created_at).getTime()
  ).reduce((sum, a) => sum + a.amount, 0);

  const getInitialDeduction = () => {
    if (slip) return slip.deductions;
    const computedBase = member.calculated_base_salary ?? member.amount ?? 0;
    return Math.min(totalAdvanceAmount, computedBase);
  };

  // Local state for editing
  const [base, setBase] = useState(slip?.base_salary ?? member.calculated_base_salary ?? member.amount ?? 0);
  const [bonus, setBonus] = useState(slip?.bonuses ?? 0);
  const [deduction, setDeduction] = useState(getInitialDeduction());
  const net = base + bonus - deduction;

  // Sync state when slip changes
  useEffect(() => {
    setBase(slip?.base_salary ?? member.calculated_base_salary ?? member.amount ?? 0);
    setBonus(slip?.bonuses ?? 0);
    setDeduction(getInitialDeduction());
  }, [slip, member.calculated_base_salary, member.amount, totalAdvanceAmount]);

  return (
    <tr className="hover:bg-slate-50 transition-colors">
      <td className="px-4 py-3">
        <div className="font-medium text-slate-900">{formatStudentName(member.last_name, member.first_name).fullName}</div>
        <div className="text-xs text-slate-500">{member.phone}</div>
      </td>
      <td className="px-4 py-3">
        <div className="text-slate-700">{member.role}</div>
        <div className="text-xs text-slate-500">{member.pay_type}</div>
      </td>
      <td className="px-4 py-3">
        <input 
          type="number" 
          value={base}
          onChange={(e) => setBase(Number(e.target.value))}
          disabled={isPaid || slip?.period?.status === 'VALIDATED' || slip?.period?.status === 'CLOSED'}
          className="w-24 px-2 py-1 border border-slate-200 rounded text-right disabled:bg-slate-100"
        />
      </td>
      <td className="px-4 py-3">
        <input 
          type="number" 
          value={bonus}
          onChange={(e) => setBonus(Number(e.target.value))}
          disabled={isPaid || slip?.period?.status === 'VALIDATED' || slip?.period?.status === 'CLOSED'}
          className="w-24 px-2 py-1 border border-slate-200 rounded text-right text-emerald-600 disabled:bg-slate-100"
        />
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1">
          <input 
            type="number" 
            value={deduction}
            onChange={(e) => setDeduction(Number(e.target.value))}
            disabled={isPaid || slip?.period?.status === 'VALIDATED' || slip?.period?.status === 'CLOSED' || totalAdvanceAmount > 0}
            className="w-24 px-2 py-1 border border-slate-200 rounded text-right text-red-600 disabled:bg-slate-100 disabled:cursor-not-allowed"
          />
          {totalAdvanceAmount > 0 && !isPaid && slip?.period?.status === 'DRAFT' && (
            <div className="flex flex-col gap-1 mt-1">
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border bg-amber-50 text-amber-600 border-amber-100`}>
                Inclut {memberAdvances?.length === 1 ? 'avance' : 'avances'}: {totalAdvanceAmount.toLocaleString()}
              </span>
            </div>
          )}
        </div>
      </td>
      <td className="px-4 py-3 font-bold text-slate-800 text-right">
        {net.toLocaleString()}
      </td>
      <td className="px-4 py-3 text-right">
        {isPaid ? (
          <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-medium bg-emerald-50 px-2 py-1 rounded-full">
            <CheckCircle className="w-3 h-3" /> Payé
          </span>
        ) : slip?.period?.status === 'VALIDATED' || slip?.period?.status === 'CLOSED' ? (
          <span className="inline-flex items-center gap-1 text-slate-500 text-xs font-medium bg-slate-50 px-2 py-1 rounded-full">
            <Check className="w-3 h-3" /> Validé
          </span>
        ) : (
          <div className="flex items-center justify-end gap-2">
            {slip && onDelete && (
              <button
                onClick={() => onDelete(slip)}
                className="p-1.5 text-rose-500 hover:bg-rose-50 rounded transition-colors"
                title="Supprimer la fiche"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => onSave(member.id, base, bonus, deduction)}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-sm font-medium transition-colors"
            >
              <Save className="w-4 h-4" />
              {slip ? 'Mettre à jour' : 'Enregistrer'}
            </button>
          </div>
        )}
      </td>
    </tr>
  );
};

const PayrollManagementView: React.FC<PayrollManagementViewProps> = ({ user }) => {
  const { school, currentCampusId, campuses } = useSchool();
  const [activeTab, setActiveTab] = useState<'periods' | 'preparation' | 'arrears' | 'history' | 'advances' | 'reports'>('periods');
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [slips, setSlips] = useState<PayrollSlip[]>([]);
  const [advances, setAdvances] = useState<SalaryAdvance[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedPeriodId, setExpandedPeriodId] = useState<string | null>(null);
  const [periodSearchTerm, setPeriodSearchTerm] = useState<string>('');
  const [toast, setToast] = useState<{message: string, type: 'success'|'error'} | null>(null);

  // Modal specific states
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSuccess, setModalSuccess] = useState(false);

  const showToast = (message: string, type: 'success'|'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Modals state
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [newPeriodMonth, setNewPeriodMonth] = useState(new Date().getMonth() + 1);
  const [newPeriodYear, setNewPeriodYear] = useState(new Date().getFullYear());

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedSlip, setSelectedSlip] = useState<PayrollSlip | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('Espèces');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentBank, setPaymentBank] = useState('');
  const [paymentRefNumber, setPaymentRefNumber] = useState('');
  const [paymentRefError, setPaymentRefError] = useState<string | null>(null);
  const [isCheckingPaymentRef, setIsCheckingPaymentRef] = useState(false);

  const [showAdvancePaymentModal, setShowAdvancePaymentModal] = useState(false);
  const [selectedAdvance, setSelectedAdvance] = useState<SalaryAdvance | null>(null);
  const [advancePaymentMethod, setAdvancePaymentMethod] = useState('Espèces');
  const [advancePaymentNotes, setAdvancePaymentNotes] = useState('');
  const [advancePaymentBank, setAdvancePaymentBank] = useState('');
  const [advancePaymentRefNumber, setAdvancePaymentRefNumber] = useState('');
  const [advancePaymentRefError, setAdvancePaymentRefError] = useState<string | null>(null);
  const [isCheckingAdvanceRef, setIsCheckingAdvanceRef] = useState(false);


  // Advances state
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [advanceStaffId, setAdvanceStaffId] = useState('');
  const [advanceAmount, setAdvanceAmount] = useState(0);
  const [advanceReason, setAdvanceReason] = useState('');

  const [periodToDelete, setPeriodToDelete] = useState<PayrollPeriod | null>(null);
  const [slipToDelete, setSlipToDelete] = useState<PayrollSlip | null>(null);

  const canValidate = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'DIRECTOR', 'ACCOUNTANT'].includes(user.role);

  const verifyPayrollReference = async (ref: string, isAdvance: boolean = false, currentBank: string = '') => {
    if (!ref || !user?.school_id || ((!isAdvance && paymentMethod !== 'Chèque') || (isAdvance && advancePaymentMethod !== 'Chèque'))) {
      isAdvance ? setAdvancePaymentRefError(null) : setPaymentRefError(null);
      return;
    }
    isAdvance ? setIsCheckingAdvanceRef(true) : setIsCheckingPaymentRef(true);
    
    try {
      const searchPattern = `%${ref}%`;
      // Check payroll slips
      const { data: slipsData } = await supabase
        .from('payroll_slips')
        .select('id, notes')
        .eq('school_id', user.school_id)
        .eq('payment_method', 'Chèque')
        .ilike('notes', searchPattern)
        .limit(1);

      // Check salary advances
      const { data: advanceData } = await supabase
        .from('salary_advances')
        .select('id, notes')
        .eq('school_id', user.school_id)
        .eq('payment_method', 'Chèque')
        .ilike('notes', searchPattern)
        .limit(1);

      // Simple case-insensitive verification
      const isDuplicateSlip = slipsData && slipsData.some(s => s.notes?.toUpperCase().includes(ref.toUpperCase()) && (!currentBank || s.notes?.toUpperCase().includes(currentBank.toUpperCase())));
      const isDuplicateAdvance = advanceData && advanceData.some(s => s.notes?.toUpperCase().includes(ref.toUpperCase()) && (!currentBank || s.notes?.toUpperCase().includes(currentBank.toUpperCase())));

      if (isDuplicateSlip || isDuplicateAdvance) {
        const msg = `Ce numéro de chèque existe déjà ${isDuplicateSlip ? 'pour un paiement de paie' : 'pour une avance'} avec cette banque.`;
        isAdvance ? setAdvancePaymentRefError(msg) : setPaymentRefError(msg);
      } else {
        isAdvance ? setAdvancePaymentRefError(null) : setPaymentRefError(null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      isAdvance ? setIsCheckingAdvanceRef(false) : setIsCheckingPaymentRef(false);
    }
  };


  useEffect(() => {
    // Clear the selected period when switching campuses to avoid displaying a period from another campus
    setSelectedPeriodId('');
    fetchData();
    setSearchTerm('');
  }, [user.school_id, currentCampusId]);

  useEffect(() => {
    if (selectedPeriodId) {
      fetchData();
    }
  }, [selectedPeriodId]);

  const [globalSettings, setGlobalSettings] = useState<any>(null);

  const fetchData = async () => {
    if (!user.school_id) return;
    setLoading(true);
    try {
      const { data: schoolData } = await supabase.from('schools').select('global_settings').eq('id', user.school_id).single();
      if (schoolData) setGlobalSettings(schoolData.global_settings);

      // 1. Fetch Staff
      let staffQuery = supabase
        .from('staff')
        .select('*')
        .eq('school_id', user.school_id)
        .eq('status', 'Actif');
      const activeCampusId = user.campus_id || currentCampusId;
      if (activeCampusId) {
        staffQuery = staffQuery.eq('campus_id', activeCampusId);
      }
      const { data: staffData, error: staffError } = await staffQuery.order('last_name');
      if (staffError) throw staffError;

      // Fetch active academic year
      const { data: years } = await supabase.from('academic_years').select('id, status, is_active').eq('school_id', user.school_id);
      const activeYear = years?.find(y => y.is_active || y.status === 'ACTIVE') || years?.[0];

      // Fetch assignments to calculate teaching hours
      let assignmentsQuery = supabase
        .from('staff_assignments')
        .select('staff_id, duration_hours, hourly_rate, staff!inner(school_id, campus_id)')
        .eq('school_id', user.school_id);
      
      if (activeYear) {
        assignmentsQuery = assignmentsQuery.eq('academic_year_id', activeYear.id);
      }

      if (currentCampusId) {
        assignmentsQuery = assignmentsQuery.eq('staff.campus_id', currentCampusId);
      }
      const { data: assignmentsData } = await assignmentsQuery;

      const staffWithCalculatedSalary = (staffData || [])
        .filter(member => {
          const isTeacher = member.role?.toLowerCase().includes('prof') || member.role?.toLowerCase().includes('enseignant') || member.role?.toLowerCase().includes('teacher');
          const memberAssignments = assignmentsData?.filter(a => a.staff_id === member.id) || [];
          if (isTeacher && memberAssignments.length === 0) {
            return false;
          }
          return true;
        })
        .map(member => {
          const memberAssignments = assignmentsData?.filter(a => a.staff_id === member.id) || [];
          const teachingSalary = memberAssignments.reduce((sum, a) => {
            const rate = a.hourly_rate || (member.pay_type === 'Horaire' ? (member.amount || 0) : 0);
            return sum + (a.duration_hours * rate * 4);
          }, 0);
          const fixedSalary = member.pay_type === 'Fixe' ? (member.amount || 0) : 0;
          const calculated_base_salary = fixedSalary + teachingSalary;
          return { ...member, calculated_base_salary };
        });
      setStaff(staffWithCalculatedSalary);

      // 2. Fetch Periods
      let periodsQuery = supabase
        .from('payroll_periods')
        .select('*')
        .eq('school_id', user.school_id);
      
      if (activeCampusId) {
        periodsQuery = periodsQuery.or(`campus_id.is.null,campus_id.eq.${activeCampusId}`);
      }
      
      const { data: periodsData, error: periodsError } = await periodsQuery
        .order('year', { ascending: false })
        .order('month', { ascending: false });
      
      // If table doesn't exist yet, it will throw an error. We catch it gracefully.
      if (periodsError) {
        if (periodsError.code === '42P01') {
          console.warn("Payroll tables not created yet.");
          setPeriods([]);
          setSlips([]);
          setLoading(false);
          return;
        }
        throw periodsError;
      }
      setPeriods(periodsData || []);
      
      // Automatically select the most recent period if none is selected or if the selected one is not valid for this campus
      if (periodsData && periodsData.length > 0) {
        if (!selectedPeriodId || !periodsData.some(p => p.id === selectedPeriodId)) {
          setSelectedPeriodId(periodsData[0].id);
        }
      } else {
        setSelectedPeriodId('');
      }

      // 3. Fetch Slips
      let slipsQuery = supabase
        .from('payroll_slips')
        .select(`
          *,
          staff:staff(*),
          period:payroll_periods(*),
          paid_by_user:profiles!payroll_slips_paid_by_fkey(*)
        `)
        .in('period_id', (periodsData || []).map(p => p.id));
      
      if (activeCampusId) {
        slipsQuery = slipsQuery.or(`campus_id.is.null,campus_id.eq.${activeCampusId}`);
      }

      const { data: slipsData, error: slipsError } = await slipsQuery;
      if (slipsError) throw slipsError;
      setSlips(slipsData || []);

      // 4. Fetch Advances
      const { data: advancesData, error: advancesError } = await supabase
        .from('salary_advances')
        .select(`
          *,
          staff:staff(*),
          approved_by_user:profiles!salary_advances_approved_by_fkey(*),
          deduction_period:payroll_periods(*)
        `)
        .eq('school_id', user.school_id)
        .order('created_at', { ascending: false });
      
      if (advancesError && advancesError.code !== '42P01') throw advancesError;
      
      let advancesFiltered = advancesData || [];
      if (activeCampusId) {
        advancesFiltered = advancesFiltered.filter(adv => !adv.staff || adv.staff.campus_id === activeCampusId);
      }
      setAdvances(advancesFiltered);

    } catch (error) {
      console.error("Error fetching payroll data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user.school_id) return;
    
    setModalLoading(true);
    setModalError(null);
    try {
      const { data, error } = await supabase
        .from('payroll_periods')
        .insert([{
          school_id: user.school_id,
          campus_id: user.campus_id || currentCampusId || null,
          month: newPeriodMonth,
          year: newPeriodYear,
          status: 'DRAFT'
        }])
        .select()
        .single();

      if (error) throw error;
      
      setPeriods([data, ...periods]);
      setSelectedPeriodId(data.id);
      setModalSuccess(true);
      
      // We don't close immediately to let the user see the success
      setTimeout(() => {
        if (modalSuccess) {
          setShowPeriodModal(false);
          setModalSuccess(false);
          setActiveTab('preparation');
        }
      }, 2000);

      import('../utils/auditLogger').then(({ AuditLogger }) => {
        AuditLogger.log({
          school_id: user.school_id,
          user_id: user.id,
          action: 'CREATE',
          entity_type: 'staff',
          entity_id: data.id,
          details: { 
            type: 'payroll_period',
            period: `${MONTHS[newPeriodMonth - 1]} ${newPeriodYear}`
          }
        });
      });
    } catch (error: any) {
      console.error("Error creating period:", error);
      if (error.code === '23505') {
        setModalError("Une période de paie existe déjà pour ce mois et cette année.");
      } else {
        setModalError(error.message || "Erreur lors de la création de la période.");
      }
    } finally {
      setModalLoading(false);
    }
  };

  const handleUpdatePeriodStatus = async (periodId: string, status: 'DRAFT' | 'VALIDATED' | 'CLOSED') => {
    try {
      const { error } = await supabase
        .from('payroll_periods')
        .update({ status })
        .eq('id', periodId);

      if (error) throw error;
      setPeriods(periods.map(p => p.id === periodId ? { ...p, status } : p));
      showToast(`Période marquée comme ${status === 'VALIDATED' ? 'validée' : status === 'CLOSED' ? 'clôturée' : 'brouillon'}.`);
    } catch (error: any) {
      console.error("Error updating period status:", error);
      showToast("Erreur lors de la mise à jour du statut.", 'error');
    }
  };

  const handleDeletePeriod = async () => {
    if (!periodToDelete) return;
    const periodId = periodToDelete.id;
    
    setLoading(true);
    try {
      // 1. Reset advances linked to this period for current campus staff
      const activeStaffIds = staff.map(s => s.id);
      let advancesResetQuery = supabase
        .from('salary_advances')
        .update({ 
          status: 'PAID', 
          deduction_period_id: null 
        })
        .eq('deduction_period_id', periodId);
      
      if (currentCampusId && activeStaffIds.length > 0) {
        advancesResetQuery = advancesResetQuery.in('staff_id', activeStaffIds);
      }
      const { error: resetError } = await advancesResetQuery;
      if (resetError) throw resetError;

      // 2. Delete slips for the current campus only (or all if no campus selected)
      let slipsDeleteQuery = supabase
        .from('payroll_slips')
        .delete()
        .eq('period_id', periodId);
      
      const targetCampusIdForDelete = user.campus_id || currentCampusId;
      if (targetCampusIdForDelete) {
        slipsDeleteQuery = slipsDeleteQuery.eq('campus_id', targetCampusIdForDelete);
      }
      const { error: slipsDeleteError } = await slipsDeleteQuery;
      if (slipsDeleteError) throw slipsDeleteError;

      // 3. Delete period record itself if not shared, or if no campus selected
      let shouldDeletePeriodRecord = true;
      const activeCampusIdForDelete = user.campus_id || currentCampusId;
      if (activeCampusIdForDelete && !periodToDelete.campus_id) {
        // If a campus is selected but the period is centralized (has no campus_id), do not delete the period itself
        shouldDeletePeriodRecord = false;
      }

      if (shouldDeletePeriodRecord) {
        const { error: periodDeleteError } = await supabase
          .from('payroll_periods')
          .delete()
          .eq('id', periodId);

        if (periodDeleteError) throw periodDeleteError;
        setPeriods(periods.filter(p => p.id !== periodId));
        if (selectedPeriodId === periodId) {
          setSelectedPeriodId(null);
        }
      }

      const deletedSlips = slips.filter(s => s.period_id === periodId && (!currentCampusId || s.staff?.campus_id === currentCampusId));
      const deletedSlipIds = deletedSlips.map(s => s.id);

      // 4. Update local state
      setSlips(slips.filter(s => !deletedSlipIds.includes(s.id)));
      setAdvances(advances.map(a => (a.deduction_period_id === periodId && (!currentCampusId || activeStaffIds.includes(a.staff_id))) ? { ...a, status: 'PAID', deduction_period_id: null } : a));
      
      showToast(shouldDeletePeriodRecord ? "Période et toutes ses traces supprimées avec succès." : "Fiches de paie pour cette période supprimées avec succès.");
      setPeriodToDelete(null);

      // Log the action
      import('../utils/auditLogger').then(({ AuditLogger }) => {
        AuditLogger.log({
          school_id: user.school_id,
          user_id: user.id,
          action: 'DELETE',
          entity_type: 'staff',
          entity_id: periodId,
          details: { 
            type: 'payroll_period',
            period: getPeriodName(periodToDelete),
            slips_count: deletedSlips.length
          }
        });
      });

    } catch (error: any) {
      console.error("Error deleting period:", error);
      showToast("Erreur lors de la suppression de la période.", 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSlip = async () => {
    if (!slipToDelete) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('payroll_slips')
        .delete()
        .eq('id', slipToDelete.id);

      if (error) throw error;

      setSlips(slips.filter(s => s.id !== slipToDelete.id));
      showToast("Fiche de paie supprimée.");
      setSlipToDelete(null);

      // Log the action
      import('../utils/auditLogger').then(({ AuditLogger }) => {
        AuditLogger.log({
          school_id: user.school_id,
          user_id: user.id,
          action: 'DELETE',
          entity_type: 'staff',
          entity_id: slipToDelete.staff_id,
          details: { 
            type: 'payroll_slip',
            staff_name: `${slipToDelete.staff?.first_name} ${slipToDelete.staff?.last_name}`
          }
        });
      });
    } catch (error: any) {
      console.error("Error deleting slip:", error);
      showToast("Erreur lors de la suppression de la fiche.", 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSlip = async (staffId: string, base: number, bonus: number, deduction: number) => {
    if (!selectedPeriodId) return;
    
    const net = base + bonus - deduction;
    const existingSlip = slips.find(s => s.period_id === selectedPeriodId && s.staff_id === staffId);

    try {
      if (existingSlip) {
        const { data, error } = await supabase
          .from('payroll_slips')
          .update({
            base_salary: base,
            bonuses: bonus,
            deductions: deduction,
            net_salary: net
          })
          .eq('id', existingSlip.id)
          .select('*, staff:staff(*), period:payroll_periods(*)')
          .single();
        if (error) throw error;
        setSlips(slips.map(s => s.id === existingSlip.id ? data : s));
        
        import('../utils/auditLogger').then(({ AuditLogger }) => {
          AuditLogger.log({
            school_id: user.school_id,
            user_id: user.id,
            action: 'UPDATE',
            entity_type: 'staff',
            entity_id: staffId,
            details: { 
              type: 'payroll_slip',
              net_salary: net,
              staff_name: `${data.staff?.first_name} ${data.staff?.last_name}`,
              period: data.period ? `${MONTHS[data.period.month - 1]} ${data.period.year}` : 'Inconnue'
            }
          });
        });
      } else {
        const { data, error } = await supabase
          .from('payroll_slips')
          .insert([{
            school_id: user.school_id,
            campus_id: user.campus_id || currentCampusId || null,
            period_id: selectedPeriodId,
            staff_id: staffId,
            base_salary: base,
            bonuses: bonus,
            deductions: deduction,
            net_salary: net,
            status: 'UNPAID'
          }])
          .select('*, staff:staff(*), period:payroll_periods(*)')
          .single();
        if (error) throw error;
        setSlips([...slips, data]);

        import('../utils/auditLogger').then(({ AuditLogger }) => {
          AuditLogger.log({
            school_id: user.school_id,
            user_id: user.id,
            action: 'CREATE',
            entity_type: 'staff',
            entity_id: staffId,
            details: { 
              type: 'payroll_slip',
              net_salary: net,
              staff_name: `${data.staff?.first_name} ${data.staff?.last_name}`,
              period: data.period ? `${MONTHS[data.period.month - 1]} ${data.period.year}` : 'Inconnue'
            }
          });
        });
      }
      showToast("Fiche de paie enregistrée avec succès !");
    } catch (error: any) {
      console.error("Error saving slip:", error);
      showToast("Erreur lors de l'enregistrement de la fiche de paie.", 'error');
    }
  };

  const handlePrepareAll = async () => {
    if (!selectedPeriodId) return;
    
    setLoading(true);
    try {
      // Use ALL staff for preparation, not just filtered ones, to avoid missing employees
      const staffToPrepare = staff.filter(member => 
        !slips.some(s => s.period_id === selectedPeriodId && s.staff_id === member.id)
      );

      if (staffToPrepare.length === 0) {
        showToast("Tous les employés ont déjà une fiche de paie pour cette période.");
        setLoading(false);
        return;
      }

      const newSlips = staffToPrepare.map(member => {
        const memberAdvances = advances.filter(a => 
          a.staff_id === member.id && 
          (a.status === 'PAID' || a.status === 'APPROVED') &&
          (!a.deduction_period_id || a.deduction_period_id === selectedPeriodId)
        );
        const base = member.calculated_base_salary ?? member.amount ?? 0;
        const requestedTotalDeduction = memberAdvances.reduce((sum, a) => sum + a.amount, 0);
        
        // Capping automatic deduction
        const totalDeductionAllowed = Math.min(requestedTotalDeduction, base);

        return {
          school_id: user.school_id,
          campus_id: user.campus_id || currentCampusId || null,
          period_id: selectedPeriodId,
          staff_id: member.id,
          base_salary: base,
          bonuses: 0,
          deductions: totalDeductionAllowed,
          net_salary: base - totalDeductionAllowed,
          status: 'UNPAID'
        };
      });

      const { data, error } = await supabase
        .from('payroll_slips')
        .insert(newSlips)
        .select('*, staff:staff(*), period:payroll_periods(*)');

      if (error) throw error;
      
      setSlips([...slips, ...(data || [])]);
      showToast(`${data?.length || 0} fiches de paie générées avec succès !`);

      import('../utils/auditLogger').then(({ AuditLogger }) => {
        AuditLogger.log({
          school_id: user.school_id,
          user_id: user.id,
          action: 'CREATE',
          entity_type: 'staff',
          details: { 
            type: 'payroll_batch',
            count: data?.length || 0,
            period: data && data.length > 0 && data[0].period ? `${MONTHS[data[0].period.month - 1]} ${data[0].period.year}` : 'Inconnue'
          }
        });
      });
    } catch (error: any) {
      console.error("Error preparing all slips:", error);
      showToast("Erreur lors de la génération des fiches de paie.", 'error');
    } finally {
      setLoading(false);
    }
  };

  const processSingleSlipPayment = async (slip: PayrollSlip, method: string, notes: string) => {
    // We update the slip
    const { data: updatedSlip, error: slipError } = await supabase
      .from('payroll_slips')
      .update({
        status: 'PAID',
        payment_date: new Date().toISOString(),
        payment_method: method,
        notes: notes,
        paid_by: user.id
      })
      .eq('id', slip.id)
      .select('*, staff:staff(*), period:payroll_periods(*)')
      .single();

    if (slipError) throw slipError;

    // Update advances in DB
    const { data: dbAdvances } = await supabase
      .from('salary_advances')
      .select('*, staff:staff(*)')
      .eq('school_id', user.school_id)
      .eq('staff_id', slip.staff_id)
      .in('status', ['PAID', 'APPROVED']);

    // Handle partial advance deduction logic
    const staffAdvancesToDeduct = (dbAdvances || []).filter(a => 
      (!a.deduction_period_id || a.deduction_period_id === slip.period_id) &&
      (!slip.created_at || new Date(a.approved_at || a.requested_at).getTime() <= new Date(slip.created_at).getTime())
    );

    let remainingDeductionToApply = slip.deductions || 0;
    const sortedAdvances = staffAdvancesToDeduct.sort((a, b) => new Date(a.approved_at || a.requested_at).getTime() - new Date(b.approved_at || b.requested_at).getTime());
    
    // We will perform updates in the DB, and let fetchData at the end of batch handle React state, OR use functional update.
    for (const adv of sortedAdvances) {
      if (remainingDeductionToApply >= adv.amount) {
        // Full deduction
        await supabase.from('salary_advances').update({ 
          status: 'DEDUCTED', 
          deduction_period_id: slip.period_id 
        }).eq('id', adv.id);
        
        remainingDeductionToApply -= adv.amount;
      } else if (remainingDeductionToApply > 0) {
        // Partial deduction: split the advance
        await supabase.from('salary_advances').update({ 
          amount: remainingDeductionToApply,
          status: 'DEDUCTED', 
          deduction_period_id: slip.period_id 
        }).eq('id', adv.id);
        
        const remainingAdvanceAmount = adv.amount - remainingDeductionToApply;
        const { data: newAdv } = await supabase.from('salary_advances').insert([{
          school_id: adv.school_id,
          staff_id: adv.staff_id,
          amount: remainingAdvanceAmount,
          reason: adv.reason + " (Solde restant)",
          status: adv.status, // Keep it PAID or APPROVED
          requested_at: adv.requested_at,
          approved_at: adv.approved_at,
          paid_at: adv.paid_at,
          approved_by: adv.approved_by,
          payment_method: adv.payment_method
        }]).select('*, staff:staff(*)').single();

        remainingDeductionToApply = 0;
      }
    }

    // Log the action
    import('../utils/auditLogger').then(({ AuditLogger }) => {
      AuditLogger.log({
        school_id: user.school_id,
        user_id: user.id,
        action: 'PAYMENT_PROCESSED',
        entity_type: 'staff',
        entity_id: updatedSlip.staff_id,
        details: { 
          amount: updatedSlip.net_salary, 
          currency: 'HTG', 
          staff_name: formatStudentName(updatedSlip.staff?.last_name, updatedSlip.staff?.first_name).fullName,
          period: updatedSlip.period ? `${MONTHS[updatedSlip.period.month - 1]} ${updatedSlip.period.year}` : 'Inconnue',
          type: 'payroll'
        }
      });
    });

    return updatedSlip;
  };

  const handlePayAllSlips = async (periodId: string) => {
    try {
      setLoading(true);
      const periodSlips = slips.filter(s => s.period_id === periodId && s.status === 'UNPAID');
      
      if (periodSlips.length === 0) {
        showToast("Aucune fiche de paie en attente pour cette période.");
        return;
      }

      let updatedList = [...slips];
      
      for (const slip of periodSlips) {
        const updatedSlip = await processSingleSlipPayment(slip, 'Virement', 'Paiement groupé automatique');
        updatedList = updatedList.map(s => s.id === updatedSlip.id ? updatedSlip : s);
      }
      
      setSlips(updatedList);
      showToast(`${periodSlips.length} salaires payés avec succès !`);
      
      await handleUpdatePeriodStatus(periodId, 'CLOSED');
      fetchData();
    } catch (error: any) {
      console.error("Error paying all slips:", error);
      showToast("Erreur lors du paiement groupé.", 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleProcessPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlip) return;
    if (paymentMethod === 'Chèque' && paymentRefError) {
      showToast(paymentRefError, 'error');
      return;
    }

    try {
      let finalNotes = paymentNotes;
      if (paymentMethod === 'Chèque') {
        finalNotes = `Chèque N°${paymentRefNumber} - ${paymentBank}`;
      }

      const updatedSlip = await processSingleSlipPayment(selectedSlip, paymentMethod, finalNotes);
      
      const updatedSlips = slips.map(s => s.id === selectedSlip.id ? updatedSlip : s);
      setSlips(updatedSlips);
      setShowPaymentModal(false);
      setSelectedSlip(null);
      setPaymentNotes('');
      setPaymentBank('');
      setPaymentRefNumber('');
      setPaymentRefError(null);
      showToast("Paiement enregistré avec succès !");

      // AUTOMATIC CLOSURE CHECK
      const currentPeriodSlips = updatedSlips.filter(s => s.period_id === selectedPeriodId);
      const allPaid = currentPeriodSlips.length > 0 && currentPeriodSlips.every(s => s.status === 'PAID');
      
      const currentPeriod = periods.find(p => p.id === selectedPeriodId);
      if (allPaid && currentPeriod && currentPeriod.status !== 'CLOSED') {
        await handleUpdatePeriodStatus(selectedPeriodId, 'CLOSED');
      }
      fetchData();
    } catch (error: any) {
      console.error("Error processing payment:", error);
      showToast("Erreur lors du paiement.", 'error');
    }
  };

  const handleRequestAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!advanceStaffId || advanceAmount <= 0) return;

    try {
      const { data, error } = await supabase
        .from('salary_advances')
        .insert([{
          school_id: user.school_id,
          staff_id: advanceStaffId,
          amount: advanceAmount,
          reason: advanceReason,
          status: 'PENDING',
          requested_at: new Date().toISOString()
        }])
        .select('*, staff:staff(*)')
        .single();

      if (error) throw error;

      setAdvances([data, ...advances]);
      setShowAdvanceModal(false);
      setAdvanceStaffId('');
      setAdvanceAmount(0);
      setAdvanceReason('');
      showToast("Demande d'avance enregistrée !");
    } catch (error: any) {
      console.error("Error requesting advance:", error);
      showToast("Erreur lors de la demande d'avance.", 'error');
    }
  };

  const handleApproveAdvance = async (advanceId: string) => {
    try {
      const { data, error } = await supabase
        .from('salary_advances')
        .update({
          status: 'APPROVED',
          approved_by: user.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', advanceId)
        .select('*, staff:staff(*), approved_by_user:profiles!salary_advances_approved_by_fkey(*)')
        .single();

      if (error) throw error;

      setAdvances(advances.map(a => a.id === advanceId ? data : a));
      showToast("Avance approuvée !");
    } catch (error: any) {
      console.error("Error approving advance:", error);
      showToast("Erreur lors de l'approbation.", 'error');
    }
  };

  const handleRejectAdvance = async (advanceId: string) => {
    try {
      const { error } = await supabase
        .from('salary_advances')
        .update({
          status: 'REJECTED'
        })
        .eq('id', advanceId);

      if (error) throw error;

      setAdvances(advances.map(a => a.id === advanceId ? { ...a, status: 'REJECTED' } : a));
      showToast("Avance rejetée.");
    } catch (error: any) {
      console.error("Error rejecting advance:", error);
      showToast("Erreur lors du rejet.", 'error');
    }
  };

  const handleProcessAdvancePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdvance) return;
    if (advancePaymentMethod === 'Chèque' && advancePaymentRefError) {
      showToast(advancePaymentRefError, 'error');
      return;
    }

    try {
      let finalNotes = advancePaymentNotes;
      if (advancePaymentMethod === 'Chèque') {
        finalNotes = `Chèque N°${advancePaymentRefNumber} - ${advancePaymentBank}`;
      }

      const { data, error } = await supabase
        .from('salary_advances')
        .update({
          status: 'PAID',
          paid_at: new Date().toISOString(),
          payment_method: advancePaymentMethod,
          notes: finalNotes
        })
        .eq('id', selectedAdvance.id)
        .select(`
          *,
          staff:staff(*),
          approved_by_user:profiles!salary_advances_approved_by_fkey(*),
          deduction_period:payroll_periods(*)
        `)
        .single();

      if (error) throw error;

      setAdvances(advances.map(a => a.id === selectedAdvance.id ? data : a));
      setShowAdvancePaymentModal(false);
      setSelectedAdvance(null);
      setAdvancePaymentNotes('');
      setAdvancePaymentBank('');
      setAdvancePaymentRefNumber('');
      setAdvancePaymentRefError(null);
      showToast("Paiement de l'avance enregistré !");

      // Log the action
      import('../utils/auditLogger').then(({ AuditLogger }) => {
        AuditLogger.log({
          school_id: user.school_id,
          user_id: user.id,
          action: 'PAYMENT_PROCESSED',
          entity_type: 'staff',
          entity_id: data.staff_id,
          details: { 
            amount: data.amount, 
            currency: 'HTG', 
            staff_name: formatStudentName(data.staff?.last_name, data.staff?.first_name).fullName,
            type: 'salary_advance',
            method: advancePaymentMethod
          }
        });
      });
    } catch (error: any) {
      console.error("Error processing advance payment:", error);
      showToast("Erreur lors du paiement de l'avance.", 'error');
    }
  };

  const getPeriodName = (period: PayrollPeriod) => {
    return `${MONTHS[period.month - 1]} ${period.year}`;
  };

  const renderPeriodsTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-800">Périodes de Paie</h2>
        <button
          onClick={() => setShowPeriodModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nouvelle Période
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {periods.map(period => {
          const periodSlips = slips.filter(s => s.period_id === period.id && (!currentCampusId || s.staff?.campus_id === currentCampusId));
          const totalToPay = periodSlips.reduce((sum, s) => sum + s.net_salary, 0);
          const totalPaid = periodSlips.filter(s => s.status === 'PAID').reduce((sum, s) => sum + s.net_salary, 0);
          const progress = totalToPay > 0 ? (totalPaid / totalToPay) * 100 : 0;

          return (
            <div key={period.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-800">{getPeriodName(period)}</h3>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-2 ${
                    period.status === 'DRAFT' ? 'bg-slate-100 text-slate-800' :
                    period.status === 'VALIDATED' ? 'bg-blue-100 text-blue-800' :
                    'bg-emerald-100 text-emerald-800'
                  }`}>
                    {period.status}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => {
                      setSelectedPeriodId(period.id);
                      setActiveTab('preparation');
                    }}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100"
                    title="Préparer la paie"
                  >
                    <FileText className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => setPeriodToDelete(period)}
                    className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors border border-transparent hover:border-rose-100"
                    title="Supprimer la période"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Employés préparés:</span>
                  <span className="font-medium">
                    {periodSlips.length} / {Math.max(periodSlips.length, staff.length)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Total à payer:</span>
                  <span className="font-bold text-slate-800">{totalToPay.toLocaleString()} HTG</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Total payé:</span>
                  <span className="font-bold text-emerald-600">{totalPaid.toLocaleString()} HTG</span>
                </div>
                
                <div className="w-full bg-slate-100 rounded-full h-2.5 mt-2">
                  <div className="bg-emerald-500 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
                </div>

                <div className="pt-4 flex gap-2">
                  {period.status === 'DRAFT' && periodSlips.length > 0 && canValidate && (
                    <button
                      onClick={() => handleUpdatePeriodStatus(period.id, 'VALIDATED')}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-bold transition-all border border-blue-100"
                    >
                      <Check className="w-3.5 h-3.5" /> Valider la période
                    </button>
                  )}
                  {period.status === 'VALIDATED' && progress < 100 && canValidate && (
                    <button
                      onClick={() => handlePayAllSlips(period.id)}
                      disabled={loading}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                      title="Paiement groupé de toutes les fiches en attente"
                    >
                      <DollarSign className="w-3.5 h-3.5" /> {loading ? 'Paiement...' : 'Payer tout en bloc'}
                    </button>
                  )}
                  {period.status === 'VALIDATED' && progress === 100 && canValidate && (
                    <button
                      onClick={() => handleUpdatePeriodStatus(period.id, 'CLOSED')}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg text-xs font-bold transition-all border border-emerald-100"
                    >
                      <CheckCircle className="w-3.5 h-3.5" /> Clôturer
                    </button>
                  )}
                  {period.status === 'VALIDATED' && canValidate && (
                    <button
                      onClick={() => handleUpdatePeriodStatus(period.id, 'DRAFT')}
                      className="px-3 py-2 bg-slate-50 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-bold transition-all border border-slate-100"
                      title="Déverrouiller"
                    >
                      <RefreshCcw className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {periods.length === 0 && (
          <div className="col-span-full text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-300">
            <Calendar className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <p className="text-slate-500">Aucune période de paie n'a été créée.</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderPreparationTab = () => {
    if (!selectedPeriodId) {
      return (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-slate-200">
          <p className="text-slate-500">Veuillez sélectionner ou créer une période de paie d'abord.</p>
        </div>
      );
    }

    const currentPeriod = periods.find(p => p.id === selectedPeriodId);
    const filteredStaff = staff.filter(s => 
      s.first_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      s.last_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <div>
            <h2 className="text-xl font-bold text-slate-800">
              Préparation: {currentPeriod ? getPeriodName(currentPeriod) : ''}
            </h2>
            <p className="text-sm text-slate-500">Générez les fiches de paie pour chaque employé.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Rechercher un employé..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <button
              onClick={handlePrepareAll}
              disabled={loading || !currentPeriod || currentPeriod.status === 'VALIDATED' || currentPeriod.status === 'CLOSED'}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {currentPeriod?.status === 'VALIDATED' || currentPeriod?.status === 'CLOSED' ? 'Période Verrouillée' : 'Préparer Tout'}
            </button>
          </div>
        </div>

        {currentPeriod?.status === 'VALIDATED' && (
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex items-center gap-3 text-blue-700">
            <Info className="w-5 h-5 shrink-0" />
            <p className="text-sm font-medium">Cette période est <strong>validée</strong>. Les fiches ne peuvent plus être modifiées.</p>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Employé</th>
                  <th className="px-4 py-3">Rôle / Type</th>
                  <th className="px-4 py-3">Salaire Base (HTG)</th>
                  <th className="px-4 py-3">Primes (HTG)</th>
                  <th className="px-4 py-3">Déductions (HTG)</th>
                  <th className="px-4 py-3">Net à Payer (HTG)</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-8">
                      <FluidLoadingState 
                        message="Chargement de la gestion de paie & salaires..." 
                        subtext="Calcul des émoluments, retenues, cotisations et bulletins de paie..." 
                      />
                      <SkeletonTable rows={6} />
                    </td>
                  </tr>
                ) : filteredStaff.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500 font-medium italic">
                      Aucun employé ne correspond aux critères.
                    </td>
                  </tr>
                ) : filteredStaff.map(member => {
                  const slip = slips.find(s => s.period_id === selectedPeriodId && s.staff_id === member.id);
                  const memberAdvances = advances.filter(a => 
                    a.staff_id === member.id && 
                    (a.status === 'APPROVED' || a.status === 'PAID') &&
                    (!a.deduction_period_id || a.deduction_period_id === selectedPeriodId)
                  );
                  // Filter out advances approved AFTER the slip was created (if slip exists)
                  const eligibleAdvances = memberAdvances.filter(a => 
                    !slip || !slip.created_at || new Date(a.approved_at || a.requested_at).getTime() <= new Date(slip.created_at).getTime()
                  );
                  return (
                    <StaffPayrollRow 
                      key={member.id} 
                      member={member} 
                      slip={slip} 
                      memberAdvances={eligibleAdvances}
                      onSave={handleSaveSlip} 
                      onDelete={setSlipToDelete}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderArrearsTab = () => {
    // Group unpaid slips by employee
    const unpaidSlips = slips.filter(s => s.status === 'UNPAID' && (!currentCampusId || s.staff?.campus_id === currentCampusId));
    const arrearsByStaff = unpaidSlips.reduce((acc, slip) => {
      if (!acc[slip.staff_id]) {
        acc[slip.staff_id] = {
          staff: slip.staff,
          totalOwed: 0,
          slips: []
        };
      }
      acc[slip.staff_id].totalOwed += slip.net_salary;
      acc[slip.staff_id].slips.push(slip);
      return acc;
    }, {} as Record<string, { staff: StaffMember | undefined, totalOwed: number, slips: PayrollSlip[] }>);

    let arrearsList = Object.values(arrearsByStaff).sort((a, b) => b.totalOwed - a.totalOwed);

    if (searchTerm) {
      arrearsList = arrearsList.filter(arrear => 
        arrear.staff?.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        arrear.staff?.last_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    const totalArrearsAmount = arrearsList.reduce((sum, a) => sum + a.totalOwed, 0);

    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold border border-amber-100/80 shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-slate-800 text-base">Arriérés de Salaire</h3>
                <span className="text-xs font-semibold bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full">
                  {arrearsList.length} employé{arrearsList.length > 1 ? 's' : ''}
                </span>
                {totalArrearsAmount > 0 && (
                  <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-100">
                    Total Dû : {totalArrearsAmount.toLocaleString()} HTG
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">Salaires impayés sur les périodes préparées</p>
            </div>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher un employé..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:bg-white transition-all"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {arrearsList.map((arrear) => (
            <div key={arrear.staff?.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold">
                    {arrear.staff?.first_name.charAt(0)}{arrear.staff?.last_name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">{formatStudentName(arrear.staff?.last_name, arrear.staff?.first_name).fullName}</h3>
                    <p className="text-xs text-slate-500">{arrear.staff?.role}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500  tracking-wider font-semibold mb-1">Total Dû</p>
                  <p className="text-lg font-semibold text-red-600">{arrear.totalOwed.toLocaleString()} HTG</p>
                </div>
              </div>
              <div className="p-4">
                <h4 className="text-xs font-semibold text-slate-400  tracking-wider mb-3">Mois impayés</h4>
                <div className="space-y-3">
                  {arrear.slips.map(slip => {
                    const memberAdvances = advances.filter(a => 
                      a.staff_id === slip.staff_id && 
                      (a.status === 'APPROVED' || a.status === 'PAID')
                    );
                    // Advances approved BEFORE the slip was created (should be in this slip)
                    const currentAdvances = memberAdvances.filter(a => 
                      !slip.created_at || new Date(a.approved_at || a.requested_at).getTime() <= new Date(slip.created_at).getTime()
                    );
                    // Advances approved AFTER the slip was created (deferred to next month)
                    const futureAdvances = memberAdvances.filter(a => 
                      slip.created_at && new Date(a.approved_at || a.requested_at).getTime() > new Date(slip.created_at).getTime()
                    );

                    const totalCurrentAdvanceAmount = currentAdvances.reduce((sum, a) => sum + a.amount, 0);
                    const totalFutureAdvanceAmount = futureAdvances.reduce((sum, a) => sum + a.amount, 0);
                    const hasDiscrepancy = slip.deductions !== totalCurrentAdvanceAmount;

                    return (
                      <div key={slip.id} className={`flex flex-col p-3 rounded-lg border transition-all ${hasDiscrepancy ? 'bg-rose-50 border-rose-200 shadow-sm' : 'bg-slate-50 border-slate-100'}`}>
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-medium text-slate-800">
                              {slip.period ? getPeriodName(slip.period) : 'Période inconnue'}
                            </p>
                            <div className="flex items-center gap-2">
                              <p className="text-xs text-slate-500">Net: {slip.net_salary.toLocaleString()} HTG</p>
                              {hasDiscrepancy && (
                                <span className="text-[10px] font-bold text-rose-600 flex items-center gap-1 animate-pulse">
                                  <AlertCircle size={10} /> Écart d'avance détecté
                                </span>
                              )}
                            </div>
                          </div>
                          {canValidate && (
                            <button
                              onClick={() => {
                                setSelectedSlip(slip);
                                setShowPaymentModal(true);
                              }}
                              className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg text-sm font-medium transition-colors"
                            >
                              <DollarSign className="w-4 h-4" />
                              Payer
                            </button>
                          )}
                        </div>
                        
                        {/* Show Advance info if any exist */}
                        {(totalCurrentAdvanceAmount > 0 || totalFutureAdvanceAmount > 0) && (
                          <div className="mt-2 pt-2 border-t border-slate-200/50 flex flex-wrap gap-2">
                            {totalCurrentAdvanceAmount > 0 && (
                              <span className="text-[9px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200">
                                Déduction incluse: {totalCurrentAdvanceAmount.toLocaleString()} HTG
                              </span>
                            )}
                            {totalFutureAdvanceAmount > 0 && (
                              <span className="text-[9px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200">
                                Avance reportée: {totalFutureAdvanceAmount.toLocaleString()} HTG (Prochaine paie)
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
          {arrearsList.length === 0 && (
            <div className="col-span-full text-center py-12 bg-white rounded-xl shadow-sm border border-slate-200">
              <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-slate-800">Aucun arriéré</h3>
              <p className="text-slate-500">Tous les salaires préparés ont été payés.</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderHistoryTab = () => {
    let paidSlips = slips.filter(s => s.status === 'PAID' && (!currentCampusId || s.staff?.campus_id === currentCampusId)).sort((a, b) => 
      new Date(b.payment_date || 0).getTime() - new Date(a.payment_date || 0).getTime()
    );

    if (searchTerm) {
      paidSlips = paidSlips.filter(slip => 
        slip.staff?.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        slip.staff?.last_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-lg font-bold text-slate-800">Historique des Paiements</h2>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher un employé..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Date de Paiement</th>
                <th className="px-4 py-3">Employé</th>
                <th className="px-4 py-3">Période</th>
                <th className="px-4 py-3">Montant Payé</th>
                <th className="px-4 py-3">Méthode</th>
                <th className="px-4 py-3">Traité par</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paidSlips.map(slip => (
                <tr key={slip.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">
                      {slip.payment_date ? new Date(slip.payment_date).toLocaleDateString('fr-FR') : '-'}
                    </div>
                    <div className="text-xs text-slate-500">
                      {slip.payment_date ? new Date(slip.payment_date).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'}) : ''}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{formatStudentName(slip.staff?.last_name, slip.staff?.first_name).fullName}</div>
                    <div className="text-xs text-slate-500">{slip.staff?.role}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {slip.period ? getPeriodName(slip.period) : '-'}
                  </td>
                  <td className="px-4 py-3 font-bold text-emerald-600">
                    {slip.net_salary.toLocaleString()} HTG
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-700">
                      {slip.payment_method}
                    </div>
                    {slip.notes && (
                      <div className="text-[10px] text-slate-500 italic max-w-[150px] truncate" title={slip.notes}>
                        {slip.notes}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                     <span className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full w-fit">
                        <User size={12} /> {slip.paid_by_user?.full_name || slip.paid_by || 'Système'}
                     </span>
                  </td>
                </tr>
              ))}
              {paidSlips.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    Aucun historique de paiement disponible.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderAdvancesTab = () => {
    const filteredAdvances = advances.filter(a => {
      const matchSearch = a.staff?.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.staff?.last_name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCampus = !currentCampusId || a.staff?.campus_id === currentCampusId;
      return matchSearch && matchCampus;
    });

    const pendingCount = filteredAdvances.filter(a => a.status === 'PENDING').length;
    const approvedCount = filteredAdvances.filter(a => a.status === 'APPROVED').length;
    const totalAdvancesAmount = filteredAdvances
      .filter(a => a.status === 'APPROVED' || a.status === 'PAID' || a.status === 'DEDUCTED')
      .reduce((sum, a) => sum + a.amount, 0);

    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        {/* Streamlined Stats Header */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">En Attente</p>
              <p className="text-xl font-black text-amber-600 mt-0.5">{pendingCount} demande{pendingCount > 1 ? 's' : ''}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold border border-amber-100">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Approuvées & à Payer</p>
              <p className="text-xl font-black text-blue-600 mt-0.5">{approvedCount} avance{approvedCount > 1 ? 's' : ''}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold border border-blue-100">
              <HandCoins className="w-5 h-5" />
            </div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Accordé</p>
              <p className="text-xl font-black text-indigo-600 mt-0.5">{totalAdvancesAmount.toLocaleString()} HTG</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold border border-indigo-100">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="relative flex-1 w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher un employé..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all"
            />
          </div>
          <button
            onClick={() => setShowAdvanceModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-xs active:scale-95 whitespace-nowrap w-full sm:w-auto justify-center text-sm"
          >
            <Plus className="w-4 h-4" />
            Nouvelle Demande
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3.5">Date Demande</th>
                  <th className="px-4 py-3.5">Employé</th>
                  <th className="px-4 py-3.5">Montant</th>
                  <th className="px-4 py-3.5">Raison / Motif</th>
                  <th className="px-4 py-3.5">Statut</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAdvances.map(advance => (
                  <tr key={advance.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-4 text-slate-500">
                      {new Date(advance.requested_at).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-semibold text-slate-900">{formatStudentName(advance.staff?.last_name, advance.staff?.first_name).fullName}</div>
                      <div className="text-xs text-slate-500">{advance.staff?.role}</div>
                    </td>
                    <td className="px-4 py-4 font-bold text-slate-800">
                      {advance.amount.toLocaleString()} HTG
                    </td>
                    <td className="px-4 py-4 text-slate-600 max-w-xs truncate">
                      {advance.reason}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col gap-1">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold w-fit ${
                          advance.status === 'PENDING' ? 'bg-amber-100 text-amber-800' :
                          advance.status === 'APPROVED' ? 'bg-blue-100 text-blue-800' :
                          advance.status === 'PAID' ? 'bg-indigo-100 text-indigo-800' :
                          advance.status === 'DEDUCTED' ? 'bg-emerald-100 text-emerald-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {advance.status === 'PENDING' ? 'En attente' :
                           advance.status === 'APPROVED' ? 'Approuvé' :
                           advance.status === 'PAID' ? 'Payé (à déduire)' :
                           advance.status === 'DEDUCTED' ? 'Déduit' : 'Rejeté'}
                        </span>
                        {advance.approved_by_user && advance.status !== 'PENDING' && (
                          <div className="text-[10px] text-slate-500 font-medium whitespace-nowrap">
                            par {advance.approved_by_user.full_name}
                          </div>
                        )}
                        {(advance.status === 'PAID' || advance.status === 'DEDUCTED') && advance.payment_method && (
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            <span className="font-medium">{advance.payment_method}</span>
                            {advance.notes && <span className="block italic truncate max-w-[120px]" title={advance.notes}> - {advance.notes}</span>}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      {advance.status === 'PENDING' && canValidate && (
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleApproveAdvance(advance.id)}
                            className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors border border-emerald-100"
                            title="Approuver"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleRejectAdvance(advance.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-red-100"
                            title="Rejeter"
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                      {advance.status === 'APPROVED' && canValidate && (
                        <button
                          onClick={() => {
                            setSelectedAdvance(advance);
                            setShowAdvancePaymentModal(true);
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-bold transition-colors ml-auto border border-blue-100"
                        >
                          <DollarSign className="w-3 h-3" />
                          Payer l'avance
                        </button>
                      )}
                      {advance.status === 'PAID' && (
                        <span className="text-xs text-indigo-600 font-medium italic bg-indigo-50 px-2 py-1 rounded border border-indigo-100">
                          Prêt à être déduit
                        </span>
                      )}
                      {advance.status === 'DEDUCTED' && (
                        <span className="text-xs text-emerald-600 font-medium bg-emerald-50 px-2 py-1 rounded border border-emerald-100">
                          Déduit le {advance.deduction_period ? getPeriodName(advance.deduction_period) : ''}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden divide-y divide-slate-100">
            {filteredAdvances.map(advance => (
              <div key={advance.id} className="p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-bold text-slate-900">{formatStudentName(advance.staff?.last_name, advance.staff?.first_name).fullName}</div>
                    <div className="text-xs text-slate-500">{advance.staff?.role} • {new Date(advance.requested_at).toLocaleDateString('fr-FR')}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      advance.status === 'PENDING' ? 'bg-amber-100 text-amber-800' :
                      advance.status === 'APPROVED' ? 'bg-blue-100 text-blue-800' :
                      advance.status === 'PAID' ? 'bg-indigo-100 text-indigo-800' :
                      advance.status === 'DEDUCTED' ? 'bg-emerald-100 text-emerald-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {advance.status === 'PENDING' ? 'En attente' :
                       advance.status === 'APPROVED' ? 'Approuvé' :
                       advance.status === 'PAID' ? 'Payé' :
                       advance.status === 'DEDUCTED' ? 'Déduit' : 'Rejeté'}
                    </span>
                    {advance.approved_by_user && advance.status !== 'PENDING' && (
                      <div className="text-[10px] text-slate-500 font-medium text-right">
                        par {advance.approved_by_user.full_name}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg">
                  <span className="text-xs text-slate-500">Montant :</span>
                  <span className="font-bold text-slate-800">{advance.amount.toLocaleString()} HTG</span>
                </div>

                <div className="text-xs text-slate-600 italic">
                  <span className="font-medium text-slate-500 not-italic">Motif :</span> {advance.reason}
                </div>

                <div className="pt-2">
                  {advance.status === 'PENDING' && canValidate && (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleApproveAdvance(advance.id)}
                        className="flex items-center justify-center gap-2 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold transition-colors"
                      >
                        <Check className="w-3 h-3" /> Approuver
                      </button>
                      <button
                        onClick={() => handleRejectAdvance(advance.id)}
                        className="flex items-center justify-center gap-2 py-2 bg-red-600 text-white rounded-lg text-xs font-bold transition-colors"
                      >
                        <Ban className="w-3 h-3" /> Rejeter
                      </button>
                    </div>
                  )}
                  {advance.status === 'APPROVED' && canValidate && (
                    <button
                      onClick={() => {
                        setSelectedAdvance(advance);
                        setShowAdvancePaymentModal(true);
                      }}
                      className="w-full flex items-center justify-center gap-2 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold transition-colors"
                    >
                      <DollarSign className="w-3 h-3" /> Payer l'avance
                    </button>
                  )}
                  {advance.status === 'PAID' && (
                    <div className="text-center py-1 bg-indigo-50 text-indigo-700 rounded text-[10px] font-bold border border-indigo-100">
                      PRÊT POUR DÉDUCTION SALAIRE
                    </div>
                  )}
                  {advance.status === 'DEDUCTED' && (
                    <div className="text-center py-1 bg-emerald-50 text-emerald-700 rounded text-[10px] font-bold border border-emerald-100">
                      DÉDUIT : {advance.deduction_period ? getPeriodName(advance.deduction_period) : ''}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {filteredAdvances.length === 0 && (
            <div className="px-4 py-12 text-center text-slate-500">
              <div className="flex flex-col items-center gap-2">
                <HandCoins className="w-8 h-8 text-slate-300" />
                <p>Aucune demande d'avance trouvée.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderReportsTab = () => {
    // Group slips by period
    const periodSummary = periods.map(p => {
      const periodSlips = slips.filter(s => s.period_id === p.id);
      const totalNet = periodSlips.reduce((sum, s) => sum + (s.net_salary || 0), 0);
      const totalBase = periodSlips.reduce((sum, s) => sum + (s.base_salary || 0), 0);
      const totalBonuses = periodSlips.reduce((sum, s) => sum + (s.bonuses || 0), 0);
      const totalDeductions = periodSlips.reduce((sum, s) => sum + (s.deductions || 0), 0);
      const bonusSlips = periodSlips.filter(s => (s.bonuses || 0) > 0);

      return {
        ...p,
        totalNet,
        totalBase,
        totalBonuses,
        totalDeductions,
        count: periodSlips.length,
        periodSlips,
        bonusSlips
      };
    });

    const activeCampus = campuses?.find(c => c.id === currentCampusId);

    const getStaffCampusName = (member?: StaffMember | null, campusId?: string | null) => {
      const cId = campusId || member?.campus_id;
      if (!cId) return activeCampus ? activeCampus.name : 'Campus Principal';
      const found = campuses?.find(c => c.id === cId);
      return found ? found.name : 'Campus Principal';
    };

    // All bonus recipients across all periods for quick auditing
    const allBonusRecipients = slips
      .filter(s => (s.bonuses || 0) > 0)
      .map(s => {
        const member = s.staff || staff.find(m => m.id === s.staff_id);
        const period = periods.find(p => p.id === s.period_id);
        return {
          slip: s,
          member,
          period,
          campusName: getStaffCampusName(member, s.campus_id)
        };
      });

    const handleExportCSV = () => {
      const headers = ["Période", "Nom Employé", "Fonction", "Campus/Annexe", "Statut Période", "Salaire Base (HTG)", "Prime (HTG)", "Déductions (HTG)", "Total Net Versé (HTG)", "Mode Paiement"];
      const rows: string[][] = [];

      slips.forEach(s => {
        const member = s.staff || staff.find(m => m.id === s.staff_id);
        const period = periods.find(p => p.id === s.period_id);
        const fullName = member ? formatStudentName(member.last_name, member.first_name).fullName : 'Inconnu';
        const campusName = getStaffCampusName(member, s.campus_id);
        const periodName = period ? `${MONTHS[period.month - 1]} ${period.year}` : 'Inconnue';

        rows.push([
          `"${periodName}"`,
          `"${fullName}"`,
          `"${member?.role || 'Staff'}"`,
          `"${campusName}"`,
          `"${s.status || 'PAID'}"`,
          (s.base_salary || 0).toString(),
          (s.bonuses || 0).toString(),
          (s.deductions || 0).toString(),
          (s.net_salary || 0).toString(),
          `"${s.payment_method || 'N/A'}"`
        ]);
      });

      const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
        + [headers.join(";"), ...rows.map(e => e.join(";"))].join("\n");

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `rapport_paie_detaille_${school?.name || 'etablissement'}_${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        {/* Multi-Tenant Scope Banner */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold border border-indigo-100/80 shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-800 text-base">{school?.name || 'Rapports de Paie'}</h3>
                {campuses && campuses.length > 1 && (
                  <span className="text-[11px] font-semibold bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full border border-indigo-100">
                    {activeCampus ? activeCampus.name : 'Tous les Campus'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium">Analyse consolidée des charges salariales et primes multi-tenant</p>
            </div>
          </div>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-all shadow-xs active:scale-95"
          >
            <Download className="w-4 h-4" />
            Exporter Rapport Détaillé (CSV)
          </button>
        </div>

        {/* Global Summary Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200/80">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Payé (Cumul)</p>
            <p className="text-2xl font-black text-slate-900">{periodSummary.reduce((acc, p) => acc + p.totalNet, 0).toLocaleString()} HTG</p>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200/80">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Moyenne Mensuelle</p>
            <p className="text-2xl font-black text-slate-900">
              {periodSummary.length > 0 ? Math.round(periodSummary.reduce((acc, p) => acc + p.totalNet, 0) / periodSummary.length).toLocaleString() : 0} HTG
            </p>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200/80 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Primes Versées</p>
              <Award className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-2xl font-black text-emerald-600">
              +{periodSummary.reduce((acc, p) => acc + p.totalBonuses, 0).toLocaleString()} HTG
            </p>
            <p className="text-[10px] text-emerald-700 font-semibold mt-0.5">
              {allBonusRecipients.length} attribution{allBonusRecipients.length > 1 ? 's' : ''} au total
            </p>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200/80">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Périodes Traitées</p>
            <p className="text-2xl font-black text-indigo-600">{periods.length}</p>
          </div>
        </div>

        {/* Audit rapide des Primes Accordées */}
        {allBonusRecipients.length > 0 && (
          <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-2xl p-4 sm:p-5 shadow-xs">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-emerald-900 text-sm">Audit Détaillé des Primes Accordées</h4>
                <p className="text-xs text-emerald-700">Liste directe des employés ayant bénéficié d'une prime</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {allBonusRecipients.map(({ slip, member, period, campusName }, idx) => {
                const name = member ? formatStudentName(member.last_name, member.first_name).fullName : 'Staff';
                return (
                  <div key={idx} className="bg-white p-3.5 rounded-xl border border-emerald-100 shadow-2xs flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900 text-xs">{name}</div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                        <span className="font-semibold text-slate-700">{member?.role || 'Staff'}</span>
                        <span>•</span>
                        <span className="text-indigo-600 font-medium">{campusName}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1 font-medium">
                        Période : {period ? `${MONTHS[period.month - 1]} ${period.year}` : 'N/A'}
                      </div>
                    </div>

                    <div className="text-right shrink-0 ml-2">
                      <span className="inline-flex items-center gap-1 text-xs font-black text-emerald-700 bg-emerald-100/90 px-2.5 py-1 rounded-lg border border-emerald-200">
                        +{(slip.bonuses || 0).toLocaleString()} HTG
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Main Monthly Recap Table */}
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Récapitulatif Mensuel des Dépenses Payroll</h3>
              <p className="text-xs text-slate-500">Cliquez sur une période pour afficher le détail nominatif et les primes attribuées</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                  <th className="px-6 py-4">Période</th>
                  <th className="px-6 py-4">Employés Payés</th>
                  <th className="px-6 py-4 text-right">Salaires de Base</th>
                  <th className="px-6 py-4 text-right">Primes (Bonus)</th>
                  <th className="px-6 py-4 text-right">Déductions</th>
                  <th className="px-6 py-4 text-right">Total Net Versé</th>
                  <th className="px-6 py-4 text-center">Détail Nominatif</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {periodSummary.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-400 text-xs font-bold">
                      Aucune donnée de paie disponible pour le moment.
                    </td>
                  </tr>
                ) : (
                  periodSummary.map((p) => {
                    const isExpanded = expandedPeriodId === p.id;
                    const bonusSlips = p.bonusSlips || [];

                    return (
                      <React.Fragment key={p.id}>
                        <tr 
                          onClick={() => setExpandedPeriodId(isExpanded ? null : p.id)}
                          className={`cursor-pointer transition-colors ${isExpanded ? 'bg-indigo-50/40' : 'hover:bg-slate-50/80'}`}
                        >
                          <td className="px-6 py-4">
                            <div className="font-bold text-slate-900 text-sm">{MONTHS[p.month - 1]} {p.year}</div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase">{p.status}</div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-[11px] font-black border border-blue-100 shadow-2xs">
                              <Users className="w-3 h-3" />
                              {p.count} Staff
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right font-mono text-xs font-bold text-slate-700">
                            {p.totalBase.toLocaleString()} HTG
                          </td>
                          <td className="px-6 py-4 text-right font-mono text-xs font-bold">
                            {p.totalBonuses > 0 ? (
                              <div>
                                <span className="text-emerald-600 font-black">+{p.totalBonuses.toLocaleString()} HTG</span>
                                <div className="mt-0.5">
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
                                    <Award className="w-2.5 h-2.5" />
                                    {bonusSlips.length} emp.
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-400 font-normal">0 HTG</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right font-mono text-xs font-bold text-rose-600">
                            {p.totalDeductions > 0 ? `-${p.totalDeductions.toLocaleString()} HTG` : <span className="text-slate-400 font-normal">0 HTG</span>}
                          </td>
                          <td className="px-6 py-4 text-right font-mono text-sm font-black text-slate-900">
                            {p.totalNet.toLocaleString()} HTG
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedPeriodId(isExpanded ? null : p.id);
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all"
                            >
                              {isExpanded ? (
                                <>Fermer <ChevronUp className="w-3.5 h-3.5" /></>
                              ) : (
                                <>Voir Liste <ChevronDown className="w-3.5 h-3.5" /></>
                              )}
                            </button>
                          </td>
                        </tr>

                        {/* Expanded Nominative Breakdown Row */}
                        {isExpanded && (
                          <tr className="bg-slate-50/90">
                            <td colSpan={7} className="p-4 sm:p-6 border-t border-b border-indigo-100">
                              <div className="space-y-4">
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                  <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold shadow-2xs">
                                      <FileText className="w-4 h-4" />
                                    </div>
                                    <div>
                                      <h4 className="font-bold text-slate-900 text-sm">
                                        Détail Nominatif des Paiements & Primes — {MONTHS[p.month - 1]} {p.year}
                                      </h4>
                                      <p className="text-xs text-slate-500 font-medium">
                                        Rôle, campus, salaire de base, prime individuelle et net versé
                                      </p>
                                    </div>
                                  </div>

                                  <div className="relative w-full sm:w-64">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                    <input
                                      type="text"
                                      placeholder="Filtrer par nom ou rôle..."
                                      value={periodSearchTerm}
                                      onChange={(e) => setPeriodSearchTerm(e.target.value)}
                                      className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    />
                                  </div>
                                </div>

                                <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-xs">
                                  <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-100/80 text-[10px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-200/80">
                                      <tr>
                                        <th className="px-4 py-3">Employé</th>
                                        <th className="px-4 py-3">Fonction / Rôle</th>
                                        <th className="px-4 py-3">Campus / Annexe</th>
                                        <th className="px-4 py-3 text-right">Salaire Base</th>
                                        <th className="px-4 py-3 text-right">Prime (Bonus)</th>
                                        <th className="px-4 py-3 text-right">Déduction</th>
                                        <th className="px-4 py-3 text-right">Total Net</th>
                                        <th className="px-4 py-3 text-center">Mode Paiement</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {p.periodSlips
                                        .filter(s => {
                                          if (!periodSearchTerm) return true;
                                          const member = s.staff || staff.find(m => m.id === s.staff_id);
                                          const name = member ? `${member.first_name} ${member.last_name}` : '';
                                          const role = member?.role || '';
                                          return name.toLowerCase().includes(periodSearchTerm.toLowerCase()) ||
                                                 role.toLowerCase().includes(periodSearchTerm.toLowerCase());
                                        })
                                        .map(s => {
                                          const member = s.staff || staff.find(m => m.id === s.staff_id);
                                          const fullName = member ? formatStudentName(member.last_name, member.first_name).fullName : 'Employé Inconnu';
                                          const campusName = getStaffCampusName(member, s.campus_id);
                                          const hasBonus = (s.bonuses || 0) > 0;
                                          const hasDeduction = (s.deductions || 0) > 0;

                                          return (
                                            <tr key={s.id} className={hasBonus ? 'bg-emerald-50/40 hover:bg-emerald-50/70 transition-colors' : 'hover:bg-slate-50'}>
                                              <td className="px-4 py-3">
                                                <div className="flex items-center gap-1.5">
                                                  <span className="font-bold text-slate-900">{fullName}</span>
                                                  {hasBonus && (
                                                    <span className="inline-flex items-center gap-0.5 text-[9px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
                                                      <Award className="w-2.5 h-2.5" /> PRIME
                                                    </span>
                                                  )}
                                                </div>
                                                {member?.phone && (
                                                  <div className="text-[10px] text-slate-400 font-medium mt-0.5">{member.phone}</div>
                                                )}
                                              </td>
                                              <td className="px-4 py-3 font-medium text-slate-700">
                                                {member?.role || 'Personnel'}
                                              </td>
                                              <td className="px-4 py-3">
                                                <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full text-[10px] font-semibold border border-slate-200">
                                                  {campusName}
                                                </span>
                                              </td>
                                              <td className="px-4 py-3 text-right font-mono font-bold text-slate-700">
                                                {(s.base_salary || 0).toLocaleString()} HTG
                                              </td>
                                              <td className="px-4 py-3 text-right font-mono font-bold">
                                                {hasBonus ? (
                                                  <span className="text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-lg font-black border border-emerald-200 shadow-2xs">
                                                    +{(s.bonuses || 0).toLocaleString()} HTG
                                                  </span>
                                                ) : (
                                                  <span className="text-slate-400 font-normal">0 HTG</span>
                                                )}
                                              </td>
                                              <td className="px-4 py-3 text-right font-mono font-bold">
                                                {hasDeduction ? (
                                                  <span className="text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg font-black border border-rose-100">
                                                    -{(s.deductions || 0).toLocaleString()} HTG
                                                  </span>
                                                ) : (
                                                  <span className="text-slate-400 font-normal">0 HTG</span>
                                                )}
                                              </td>
                                              <td className="px-4 py-3 text-right font-mono font-black text-slate-900 text-sm">
                                                {(s.net_salary || 0).toLocaleString()} HTG
                                              </td>
                                              <td className="px-4 py-3 text-center">
                                                <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-bold">
                                                  {s.payment_method || 'Espèces'}
                                                </span>
                                              </td>
                                            </tr>
                                          );
                                        })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 relative">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-4 right-4 z-[100] flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-white animate-in slide-in-from-bottom-5 ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
          {toast.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span className="font-medium">{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 hover:opacity-80">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Gestion Payroll</h1>
          <p className="text-slate-500">Préparez les salaires, gérez les arriérés et suivez les paiements.</p>
        </div>
      </div>

      <div className="flex overflow-x-auto border-b border-slate-200 hide-scrollbar">
        <button
          onClick={() => { setActiveTab('periods'); setSearchTerm(''); }}
          className={`flex items-center gap-2 px-4 py-3 font-medium text-sm whitespace-nowrap border-b-2 transition-colors ${
            activeTab === 'periods' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          <Calendar className="w-4 h-4" />
          Périodes
        </button>
        <button
          onClick={() => { setActiveTab('preparation'); setSearchTerm(''); }}
          className={`flex items-center gap-2 px-4 py-3 font-medium text-sm whitespace-nowrap border-b-2 transition-colors ${
            activeTab === 'preparation' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          <FileText className="w-4 h-4" />
          Préparation
        </button>
        <button
          onClick={() => { setActiveTab('arrears'); setSearchTerm(''); }}
          className={`flex items-center gap-2 px-4 py-3 font-medium text-sm whitespace-nowrap border-b-2 transition-colors ${
            activeTab === 'arrears' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          <AlertCircle className="w-4 h-4" />
          Arriérés & Paiements
        </button>
        <button
          onClick={() => { setActiveTab('advances'); setSearchTerm(''); }}
          className={`flex items-center gap-2 px-4 py-3 font-medium text-sm whitespace-nowrap border-b-2 transition-colors ${
            activeTab === 'advances' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          <HandCoins className="w-4 h-4" />
          Avances
        </button>
        <button
          onClick={() => { setActiveTab('history'); setSearchTerm(''); }}
          className={`flex items-center gap-2 px-4 py-3 font-medium text-sm whitespace-nowrap border-b-2 transition-colors ${
            activeTab === 'history' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          <Clock className="w-4 h-4" />
          Historique
        </button>
        <button
          onClick={() => { setActiveTab('reports'); setSearchTerm(''); }}
          className={`flex items-center gap-2 px-4 py-3 font-medium text-sm whitespace-nowrap border-b-2 transition-colors ${
            activeTab === 'reports' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Rapports
        </button>
      </div>

      <div className="mt-6">
        {activeTab === 'periods' && renderPeriodsTab()}
        {activeTab === 'preparation' && renderPreparationTab()}
        {activeTab === 'arrears' && renderArrearsTab()}
        {activeTab === 'advances' && renderAdvancesTab()}
        {activeTab === 'history' && renderHistoryTab()}
        {activeTab === 'reports' && renderReportsTab()}
      </div>

      {/* Modal Nouvelle Période */}
      {showPeriodModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-slate-100">
              <h3 className="font-bold text-lg text-slate-800">Nouvelle Période de Paie</h3>
              <button 
                onClick={() => { setShowPeriodModal(false); setModalError(null); setModalSuccess(false); }} 
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {modalSuccess ? (
              <div className="p-8 text-center space-y-4 animate-in zoom-in-95 duration-300">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-10 h-10" />
                </div>
                <h4 className="text-xl font-bold text-slate-900">Période Créée !</h4>
                <p className="text-slate-500">La période de paie a été configurée avec succès. Vous allez être redirigé vers la préparation.</p>
                <button
                  onClick={() => { setShowPeriodModal(false); setModalSuccess(false); setActiveTab('preparation'); }}
                  className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-md active:scale-95"
                >
                  Continuer
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreatePeriod} className="p-4 space-y-4">
                {modalError && (
                  <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg flex items-start gap-2 text-rose-600 animate-in fade-in slide-in-from-top-1">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <p className="text-xs font-medium">{modalError}</p>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Mois</label>
                    <select
                      value={newPeriodMonth}
                      onChange={(e) => setNewPeriodMonth(Number(e.target.value))}
                      className="w-full p-2 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500"
                      required
                      disabled={modalLoading}
                    >
                      {MONTHS.map((m, i) => (
                        <option key={i} value={i + 1}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Année</label>
                    <input
                      type="number"
                      value={newPeriodYear}
                      onChange={(e) => setNewPeriodYear(Number(e.target.value))}
                      className="w-full p-2 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500"
                      required
                      min="2020"
                      max="2050"
                      disabled={modalLoading}
                    />
                  </div>
                </div>
                <div className="pt-4 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => { setShowPeriodModal(false); setModalError(null); }}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    disabled={modalLoading}
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={modalLoading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                  >
                    {modalLoading ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                    Créer la période
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal Paiement */}
      {showPaymentModal && selectedSlip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-emerald-50">
              <h3 className="font-bold text-lg text-emerald-800 flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Enregistrer un Paiement
              </h3>
              <button onClick={() => setShowPaymentModal(false)} className="text-emerald-600 hover:text-emerald-800">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleProcessPayment} className="p-4 space-y-4">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <p className="text-sm text-slate-500">Employé</p>
                <p className="font-bold text-slate-800">{formatStudentName(selectedSlip.staff?.last_name, selectedSlip.staff?.first_name).fullName}</p>
                <div className="flex justify-between mt-2 pt-2 border-t border-slate-200">
                  <span className="text-sm text-slate-500">Période: {selectedSlip.period ? getPeriodName(selectedSlip.period) : ''}</span>
                  <span className="font-bold text-red-600">{selectedSlip.net_salary.toLocaleString()} HTG</span>
                </div>
              </div>

              {/* Discrepancy Warning and Advance Info in Modal */}
              {(() => {
                const memberAdvances = advances.filter(a => 
                  a.staff_id === selectedSlip.staff_id && 
                  (a.status === 'APPROVED' || a.status === 'PAID')
                );
                
                const currentAdvances = memberAdvances.filter(a => 
                  !selectedSlip.created_at || new Date(a.approved_at || a.requested_at).getTime() <= new Date(selectedSlip.created_at).getTime()
                );
                const futureAdvances = memberAdvances.filter(a => 
                  selectedSlip.created_at && new Date(a.approved_at || a.requested_at).getTime() > new Date(selectedSlip.created_at).getTime()
                );

                const totalCurrentAdvanceAmount = currentAdvances.reduce((sum, a) => sum + a.amount, 0);
                const totalFutureAdvanceAmount = futureAdvances.reduce((sum, a) => sum + a.amount, 0);
                const hasDiscrepancy = selectedSlip.deductions !== totalCurrentAdvanceAmount;
                
                return (
                  <div className="space-y-2">
                    {hasDiscrepancy && (
                      <div className="bg-rose-50 border border-rose-200 p-3 rounded-lg flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                        <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-rose-800">Attention : Écart de déduction</p>
                          <p className="text-[10px] text-rose-700 mt-1">
                            Cette fiche déduit {selectedSlip.deductions.toLocaleString()} HTG, mais l'employé a {totalCurrentAdvanceAmount.toLocaleString()} HTG d'avances approuvées avant préparation.
                          </p>
                          <p className="text-[10px] font-bold text-rose-900 mt-2 uppercase tracking-wider">
                            Synchronisez la déduction dans l'onglet "Préparation" si nécessaire.
                          </p>
                        </div>
                      </div>
                    )}
                    
                    {totalFutureAdvanceAmount > 0 && (
                      <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg flex items-start gap-3">
                        <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-blue-800">Avance reportée</p>
                          <p className="text-[10px] text-blue-700 mt-1">
                            L'employé a une avance de {totalFutureAdvanceAmount.toLocaleString()} HTG approuvée APRÈS la préparation de cette paie. Elle sera déduite automatiquement le mois prochain.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Méthode de paiement</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-emerald-500"
                  required
                >
                  <option value="Espèces">Espèces</option>
                  <option value="Chèque">Chèque</option>
                  <option value="MonCash">MonCash</option>
                </select>
              </div>

              {paymentMethod === 'Chèque' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Banque émettrice</label>
                    <select
                      value={paymentBank}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPaymentBank(val);
                        if (paymentRefNumber) verifyPayrollReference(paymentRefNumber, false, val);
                      }}
                      className="w-full p-2 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-emerald-500"
                      required
                    >
                      <option value="">-- Sélectionner --</option>
                      {(globalSettings?.banks && globalSettings?.banks?.length > 0) ? (
                        globalSettings.banks.map((b: string) => (
                          <option key={b} value={b}>{b}</option>
                        ))
                      ) : (
                        <option value="" disabled>Aucune banque configurée (Voir Paramètres)</option>
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Numéro du chèque</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={paymentRefNumber}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPaymentRefNumber(val);
                          verifyPayrollReference(val, false, paymentBank);
                        }}
                        className={`w-full p-2 border ${paymentRefError ? 'border-rose-500 focus:ring-rose-500' : 'border-slate-300 focus:ring-emerald-500'} rounded-lg text-slate-900 focus:ring-2`}
                        required
                        placeholder="Ex: 123456"
                      />
                      {isCheckingPaymentRef && <RefreshCcw className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400 w-4 h-4" />}
                    </div>
                    {paymentRefError && <p className="text-xs text-rose-600 mt-1">{paymentRefError}</p>}
                  </div>
                </div>
              )}

              {paymentMethod !== 'Chèque' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Notes (Optionnel)</label>
                  <textarea
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-emerald-500"
                    rows={3}
                    placeholder="Informations supplémentaires..."
                  />
                </div>
              )}

              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  Confirmer le paiement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Demande d'Avance */}
      {showAdvanceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-slate-100">
              <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                <HandCoins className="w-5 h-5 text-blue-600" />
                Nouvelle Demande d'Avance
              </h3>
              <button onClick={() => setShowAdvanceModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleRequestAdvance} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Employé</label>
                <select
                  value={advanceStaffId}
                  onChange={(e) => setAdvanceStaffId(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Sélectionner un employé</option>
                  {staff.map(s => (
                    <option key={s.id} value={s.id}>{formatStudentName(s.last_name, s.first_name).fullName} ({s.role})</option>
                  ))}
                </select>
                {advanceStaffId && (() => {
                  const activeAdvances = advances.filter(a => a.staff_id === advanceStaffId && ['PENDING', 'APPROVED', 'PAID'].includes(a.status));
                  if (activeAdvances.length > 0) {
                    const totalRemaining = activeAdvances.reduce((acc, a) => acc + a.amount, 0);
                    return (
                      <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg flex gap-3 text-amber-800">
                        <AlertCircle className="w-5 h-5 shrink-0 text-amber-500" />
                        <div>
                          <p className="text-sm font-bold text-amber-900 leading-tight">Avance(s) en cours existante(s)</p>
                          <p className="text-xs font-medium mt-0.5">Cet employé a déjà {activeAdvances.length} avance(s) en cours, pour un reste totalisé à payer de <strong>{totalRemaining.toLocaleString('fr-HT', { style: 'currency', currency: 'HTG' })}</strong>.</p>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Montant (HTG)</label>
                <input
                  type="number"
                  value={advanceAmount}
                  onChange={(e) => setAdvanceAmount(Number(e.target.value))}
                  className="w-full p-2 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500"
                  required
                  min="1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Raison / Motif</label>
                <textarea
                  value={advanceReason}
                  onChange={(e) => setAdvanceReason(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Ex: Urgence médicale, frais scolaires..."
                  required
                />
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAdvanceModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Enregistrer la demande
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Paiement Avance */}
      {showAdvancePaymentModal && selectedAdvance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-blue-50">
              <h3 className="font-bold text-lg text-blue-800 flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Payer l'Avance de Fonds
              </h3>
              <button onClick={() => setShowAdvancePaymentModal(false)} className="text-blue-600 hover:text-blue-800">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleProcessAdvancePayment} className="p-4 space-y-4">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <p className="text-sm text-slate-500">Employé</p>
                <p className="font-bold text-slate-800">{formatStudentName(selectedAdvance.staff?.last_name, selectedAdvance.staff?.first_name).fullName}</p>
                <div className="flex justify-between mt-2 pt-2 border-t border-slate-200">
                  <span className="text-sm text-slate-500">Montant de l'avance:</span>
                  <span className="font-bold text-blue-600">{selectedAdvance.amount.toLocaleString()} HTG</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Méthode de paiement</label>
                <select
                  value={advancePaymentMethod}
                  onChange={(e) => setAdvancePaymentMethod(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="Espèces">Espèces</option>
                  <option value="Chèque">Chèque</option>
                  <option value="MonCash">MonCash</option>
                </select>
              </div>

              {advancePaymentMethod === 'Chèque' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Banque émettrice</label>
                    <select
                      value={advancePaymentBank}
                      onChange={(e) => {
                        const val = e.target.value;
                        setAdvancePaymentBank(val);
                        if (advancePaymentRefNumber) verifyPayrollReference(advancePaymentRefNumber, true, val);
                      }}
                      className="w-full p-2 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">-- Sélectionner --</option>
                      {(globalSettings?.banks && globalSettings?.banks?.length > 0) ? (
                        globalSettings.banks.map((b: string) => (
                          <option key={b} value={b}>{b}</option>
                        ))
                      ) : (
                        <option value="" disabled>Aucune banque configurée (Voir Paramètres)</option>
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Numéro du chèque</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={advancePaymentRefNumber}
                        onChange={(e) => {
                          const val = e.target.value;
                          setAdvancePaymentRefNumber(val);
                          verifyPayrollReference(val, true, advancePaymentBank);
                        }}
                        className={`w-full p-2 border ${advancePaymentRefError ? 'border-rose-500 focus:ring-rose-500' : 'border-slate-300 focus:ring-blue-500'} rounded-lg text-slate-900 focus:ring-2`}
                        required
                        placeholder="Ex: 123456"
                      />
                      {isCheckingAdvanceRef && <RefreshCcw className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400 w-4 h-4" />}
                    </div>
                    {advancePaymentRefError && <p className="text-xs text-rose-600 mt-1">{advancePaymentRefError}</p>}
                  </div>
                </div>
              )}

              {advancePaymentMethod !== 'Chèque' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {advancePaymentMethod === 'MonCash' ? 'ID Transaction MonCash' : 'Notes (Optionnel)'}
                  </label>
                  <textarea
                    value={advancePaymentNotes}
                    onChange={(e) => setAdvancePaymentNotes(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    placeholder="Informations complémentaires..."
                    required={advancePaymentMethod === 'MonCash'}
                  />
                </div>
              )}

              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAdvancePaymentModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  Confirmer le paiement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Confirmation Modal Period Delete */}
      {periodToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Supprimer la période ?</h3>
              <p className="text-slate-500 mb-6">
                Êtes-vous sûr de vouloir supprimer la période <span className="font-bold text-slate-800">{getPeriodName(periodToDelete)}</span> ? 
                Toutes les fiches de paie seront supprimées. Cette action est irréversible.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setPeriodToDelete(null)}
                  className="flex-1 px-4 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
                  disabled={loading}
                >
                  Annuler
                </button>
                <button
                  onClick={handleDeletePeriod}
                  className="flex-1 px-4 py-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 shadow-md transition-all flex items-center justify-center gap-2"
                  disabled={loading}
                >
                  {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Supprimer"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal Slip Delete */}
      {slipToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Ban className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Supprimer la fiche ?</h3>
              <p className="text-slate-500 mb-6">
                Voulez-vous supprimer la fiche de paie de <span className="font-bold text-slate-800">{slipToDelete.staff?.first_name} {slipToDelete.staff?.last_name}</span> pour cette période ?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setSlipToDelete(null)}
                  className="flex-1 px-4 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
                  disabled={loading}
                >
                  Annuler
                </button>
                <button
                  onClick={handleDeleteSlip}
                  className="flex-1 px-4 py-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 shadow-md transition-all flex items-center justify-center gap-2"
                  disabled={loading}
                >
                  {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Supprimer"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PayrollManagementView;
