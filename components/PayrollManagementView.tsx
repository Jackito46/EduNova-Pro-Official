import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useSchool } from '../contexts/SchoolContext';
import { UserProfile, StaffMember, PayrollPeriod, PayrollSlip, SalaryAdvance, UserRole } from '../types';
import { formatStudentName } from '../utils/formatters';
import { FluidLoadingState, SkeletonTable } from './SkeletonLoader';
import { SelectPill, SelectOption } from './SelectPill';
import { Terminology } from '../lib/terminology';
import { PayrollIntegrityAudit } from './PayrollIntegrityAudit';
import { PayrollAuditModal } from './PayrollAuditModal';
import { evaluatePayrollSensitivity } from '../utils/payrollSensitivity';
import { 
  Wallet, Calendar, CheckCircle, Clock, AlertCircle, 
  FileText, User, Plus, Search, DollarSign, Save, X,
  HandCoins, Check, Ban, Info, RefreshCcw, BarChart3, Trash2,
  Download, Building2, ChevronDown, ChevronUp, Award, Sparkles, Filter, Users, CheckCircle2,
  LayoutGrid, Table, ArrowUpDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, CreditCard,
  Zap, Landmark, ShieldCheck, AlertTriangle, UserCheck, UserX, CheckSquare, History, ShieldAlert
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
  onShowAudit?: (slip: PayrollSlip, member: StaffMember) => void;
  campusName?: string;
  terminology?: Terminology;
  duplicateCount?: number;
}

const StaffPayrollCard: React.FC<StaffPayrollRowProps> = ({ member, slip, memberAdvances, onSave, onDelete, onShowAudit, campusName, terminology, duplicateCount }) => {
  const isPaid = slip?.status === 'PAID';
  const totalAdvanceAmount = (memberAdvances || []).filter(a => 
    !slip || !slip.created_at || new Date(a.approved_at || a.requested_at).getTime() <= new Date(slip.created_at).getTime()
  ).reduce((sum, a) => sum + a.amount, 0);

  const getInitialDeduction = () => {
    if (slip) return slip.deductions;
    const computedBase = member.calculated_base_salary ?? member.amount ?? 0;
    return Math.min(totalAdvanceAmount, computedBase);
  };

  const [base, setBase] = useState(slip?.base_salary ?? member.calculated_base_salary ?? member.amount ?? 0);
  const [bonus, setBonus] = useState(slip?.bonuses ?? 0);
  const [deduction, setDeduction] = useState(getInitialDeduction());
  const net = base + bonus - deduction;

  useEffect(() => {
    setBase(slip?.base_salary ?? member.calculated_base_salary ?? member.amount ?? 0);
    setBonus(slip?.bonuses ?? 0);
    setDeduction(getInitialDeduction());
  }, [slip, member.calculated_base_salary, member.amount, totalAdvanceAmount]);

  const isDisabled = isPaid || slip?.period?.status === 'VALIDATED' || slip?.period?.status === 'CLOSED';

  const roleLabel = (member.role?.toLowerCase().includes('prof') || member.role?.toLowerCase().includes('enseignant'))
    ? (terminology?.teacher || member.role)
    : member.role;

  return (
    <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="font-bold text-slate-900 text-sm">{formatStudentName(member.last_name, member.first_name).fullName}</h4>
          <div className="flex flex-wrap items-center gap-1.5 mt-1">
            <span className="px-2 py-0.5 bg-slate-100 text-slate-900 text-xs font-bold rounded-lg border border-slate-200">
              {roleLabel}
            </span>
            {campusName && (
              <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-lg border border-indigo-200 flex items-center gap-1">
                <Building2 className="w-3 h-3 text-indigo-500" />
                <span>{campusName}</span>
              </span>
            )}
            {duplicateCount && duplicateCount > 1 && (
              <span className="px-2 py-0.5 bg-rose-50 text-rose-700 text-xs font-black rounded-lg border border-rose-200 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-rose-600" />
                <span>Doublon ({duplicateCount} fiches)</span>
              </span>
            )}
            <span className="text-xs font-bold text-slate-800">{member.pay_type}</span>
            {member.phone && <span className="text-xs font-semibold text-slate-700">• {member.phone}</span>}
          </div>
        </div>
        <div>
          {isPaid ? (
            <span className="inline-flex items-center gap-1 text-emerald-800 text-xs font-black bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
              <CheckCircle className="w-3.5 h-3.5" /> Payé
            </span>
          ) : slip?.period?.status === 'VALIDATED' || slip?.period?.status === 'CLOSED' ? (
            <span className="inline-flex items-center gap-1 text-slate-900 text-xs font-black bg-slate-100 border border-slate-300 px-2.5 py-1 rounded-full">
              <Check className="w-3.5 h-3.5" /> Validé
            </span>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 bg-slate-50/80 p-3 rounded-xl border border-slate-200/80">
        <div>
          <label className="block text-[11px] font-black text-slate-950 uppercase tracking-tight mb-1">
            Salaire Base (HTG)
          </label>
          <div className="relative flex items-center">
            <input 
              type="number" 
              value={base}
              onChange={(e) => setBase(Number(e.target.value))}
              disabled={isDisabled}
              style={{ color: '#020617', WebkitTextFillColor: '#020617' }}
              className="w-full pr-9 pl-2.5 py-1.5 border border-slate-300 rounded-lg text-right font-black text-slate-950 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100 disabled:!text-slate-950 disabled:opacity-100 shadow-2xs text-xs sm:text-sm"
            />
            <span className="absolute right-2 text-[10px] font-black text-slate-900 pointer-events-none">HTG</span>
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-black text-emerald-900 uppercase tracking-tight mb-1">
            Primes (HTG)
          </label>
          <div className="relative flex items-center">
            <input 
              type="number" 
              value={bonus}
              onChange={(e) => setBonus(Number(e.target.value))}
              disabled={isDisabled}
              style={{ color: '#065f46', WebkitTextFillColor: '#065f46' }}
              className="w-full pr-9 pl-2.5 py-1.5 border border-slate-300 rounded-lg text-right font-black text-emerald-800 bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-slate-100 disabled:!text-emerald-800 disabled:opacity-100 shadow-2xs text-xs sm:text-sm"
            />
            <span className="absolute right-2 text-[10px] font-black text-emerald-800 pointer-events-none">HTG</span>
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-black text-rose-900 uppercase tracking-tight mb-1">
            Déductions (HTG)
          </label>
          <div className="relative flex items-center">
            <input 
              type="number" 
              value={deduction}
              onChange={(e) => setDeduction(Number(e.target.value))}
              disabled={isDisabled || totalAdvanceAmount > 0}
              style={{ color: '#9f1239', WebkitTextFillColor: '#9f1239' }}
              className="w-full pr-9 pl-2.5 py-1.5 border border-slate-300 rounded-lg text-right font-black text-rose-800 bg-white focus:ring-2 focus:ring-rose-500 focus:border-rose-500 disabled:bg-slate-100 disabled:!text-rose-800 disabled:opacity-100 disabled:cursor-not-allowed shadow-2xs text-xs sm:text-sm"
            />
            <span className="absolute right-2 text-[10px] font-black text-rose-800 pointer-events-none">HTG</span>
          </div>
          {totalAdvanceAmount > 0 && !isPaid && slip?.period?.status === 'DRAFT' && (
            <span className="block text-[10px] font-bold px-1.5 py-0.5 mt-1 rounded border bg-amber-50 text-amber-900 border-amber-200">
              Inclut avances: {totalAdvanceAmount.toLocaleString()} HTG
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-slate-100">
        <div>
          <span className="text-[11px] font-black text-slate-800 uppercase tracking-wider block">Net à Payer</span>
          <span className="text-base font-black text-slate-950 tabular-nums">
            {net.toLocaleString()} <span className="text-xs font-black text-slate-900">HTG</span>
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {slip && onShowAudit && (
            <button
              type="button"
              onClick={() => onShowAudit(slip, member)}
              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl border border-slate-200 hover:border-indigo-200 transition-colors cursor-pointer shadow-2xs"
              title="Historique des modifications de cette fiche"
            >
              <History className="w-4 h-4" />
            </button>
          )}

          {!isDisabled && (
            <div className="flex items-center gap-2">
              {slip && onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(slip)}
                  className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg border border-rose-200 transition-colors"
                  title="Supprimer la fiche"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => onSave(member.id, base, bonus, deduction)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{slip ? 'Mettre à jour' : 'Enregistrer'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const StaffPayrollRow: React.FC<StaffPayrollRowProps> = ({ member, slip, memberAdvances, onSave, onDelete, onShowAudit, campusName, terminology, duplicateCount }) => {
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

  const roleLabel = (member.role?.toLowerCase().includes('prof') || member.role?.toLowerCase().includes('enseignant'))
    ? (terminology?.teacher || member.role)
    : member.role;

  return (
    <tr className="hover:bg-slate-50 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-900">{formatStudentName(member.last_name, member.first_name).fullName}</span>
          {duplicateCount && duplicateCount > 1 && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200 inline-flex items-center gap-1">
              <AlertTriangle className="w-2.5 h-2.5 text-rose-600" />
              Doublon ({duplicateCount})
            </span>
          )}
        </div>
        <div className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 flex-wrap">
          {campusName && (
            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200/80 flex items-center gap-1">
              <Building2 className="w-2.5 h-2.5 text-indigo-500" />
              <span>{campusName}</span>
            </span>
          )}
          {member.phone && <span>{member.phone}</span>}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="font-bold text-slate-900">{roleLabel}</div>
        <div className="text-xs font-bold text-slate-700">{member.pay_type}</div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5 justify-end">
          <input 
            type="number" 
            value={base}
            onChange={(e) => setBase(Number(e.target.value))}
            disabled={isPaid || slip?.period?.status === 'VALIDATED' || slip?.period?.status === 'CLOSED'}
            style={{ color: '#020617', WebkitTextFillColor: '#020617' }}
            className="w-24 sm:w-28 px-2.5 py-1.5 border border-slate-300 rounded-lg text-right font-black text-slate-950 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100 disabled:!text-slate-950 disabled:opacity-100 shadow-2xs text-xs sm:text-sm transition-all"
          />
          <span className="text-[11px] font-black text-slate-950 shrink-0">HTG</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5 justify-end">
          <input 
            type="number" 
            value={bonus}
            onChange={(e) => setBonus(Number(e.target.value))}
            disabled={isPaid || slip?.period?.status === 'VALIDATED' || slip?.period?.status === 'CLOSED'}
            style={{ color: '#065f46', WebkitTextFillColor: '#065f46' }}
            className="w-24 sm:w-28 px-2.5 py-1.5 border border-slate-300 rounded-lg text-right font-black text-emerald-800 bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-slate-100 disabled:!text-emerald-800 disabled:opacity-100 shadow-2xs text-xs sm:text-sm transition-all"
          />
          <span className="text-[11px] font-black text-emerald-800 shrink-0">HTG</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 justify-end">
            <input 
              type="number" 
              value={deduction}
              onChange={(e) => setDeduction(Number(e.target.value))}
              disabled={isPaid || slip?.period?.status === 'VALIDATED' || slip?.period?.status === 'CLOSED' || totalAdvanceAmount > 0}
              style={{ color: '#9f1239', WebkitTextFillColor: '#9f1239' }}
              className="w-24 sm:w-28 px-2.5 py-1.5 border border-slate-300 rounded-lg text-right font-black text-rose-800 bg-white focus:ring-2 focus:ring-rose-500 focus:border-rose-500 disabled:bg-slate-100 disabled:!text-rose-800 disabled:opacity-100 disabled:cursor-not-allowed shadow-2xs text-xs sm:text-sm transition-all"
            />
            <span className="text-[11px] font-black text-rose-800 shrink-0">HTG</span>
          </div>
          {totalAdvanceAmount > 0 && !isPaid && slip?.period?.status === 'DRAFT' && (
            <div className="flex flex-col gap-1 mt-1">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border bg-amber-50 text-amber-900 border-amber-200">
                Inclut {memberAdvances?.length === 1 ? 'avance' : 'avances'}: {totalAdvanceAmount.toLocaleString()}
              </span>
            </div>
          )}
        </div>
      </td>
      <td className="px-4 py-3 font-extrabold text-slate-950 text-right tabular-nums text-xs sm:text-sm">
        {net.toLocaleString()} <span className="text-[11px] font-black text-slate-900">HTG</span>
      </td>
      <td className="px-4 py-3 text-right">
        {isPaid ? (
          <div className="flex items-center justify-end gap-1.5">
            {slip && onShowAudit && (
              <button
                type="button"
                onClick={() => onShowAudit(slip, member)}
                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-indigo-100"
                title="Historique des modifications de cette fiche"
              >
                <History className="w-4 h-4" />
              </button>
            )}
            <span className="inline-flex items-center gap-1 text-emerald-800 text-xs font-bold bg-emerald-50 px-2 py-1 rounded-full border border-emerald-200">
              <CheckCircle className="w-3 h-3" /> Payé
            </span>
          </div>
        ) : slip?.period?.status === 'VALIDATED' || slip?.period?.status === 'CLOSED' ? (
          <div className="flex items-center justify-end gap-1.5">
            {slip && onShowAudit && (
              <button
                type="button"
                onClick={() => onShowAudit(slip, member)}
                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-indigo-100"
                title="Historique des modifications de cette fiche"
              >
                <History className="w-4 h-4" />
              </button>
            )}
            <span className="inline-flex items-center gap-1 text-slate-800 text-xs font-bold bg-slate-100 px-2 py-1 rounded-full border border-slate-300">
              <Check className="w-3 h-3" /> Validé
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-1.5">
            {slip && onShowAudit && (
              <button
                type="button"
                onClick={() => onShowAudit(slip, member)}
                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-indigo-100"
                title="Historique des modifications de cette fiche"
              >
                <History className="w-4 h-4" />
              </button>
            )}
            {slip && onDelete && (
              <button
                type="button"
                onClick={() => onDelete(slip)}
                className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                title="Supprimer la fiche"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => onSave(member.id, base, bonus, deduction)}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white hover:bg-blue-700 rounded-lg text-sm font-bold transition-colors cursor-pointer shadow-2xs"
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
  const { school, currentCampusId, setCurrentCampusId, campuses, terminology } = useSchool();
  const hasMultipleCampuses = Boolean((school?.has_multi_campus || (campuses && campuses.length > 1)) && campuses && campuses.length > 0);

  // RBAC : Identification des privilèges
  const isSuperUser = Boolean(
    user.is_super_admin || 
    user.role === UserRole.SUPER_ADMIN || 
    (user.role as any) === 'SUPER_ADMIN'
  );

  // Un administrateur d'annexe est rattaché à une annexe spécifique ET n'a pas les droits super-utilisateur
  const isAnnexeAdmin = Boolean(user.campus_id && !isSuperUser);

  const [selectedCampusFilter, setSelectedCampusFilter] = useState<string>(() => {
    if (isAnnexeAdmin && user.campus_id) return user.campus_id;
    if (currentCampusId && currentCampusId !== 'GLOBAL') return currentCampusId;
    return user.campus_id || 'ALL';
  });

  const effectiveCampusId = isAnnexeAdmin && user.campus_id 
    ? user.campus_id 
    : (!selectedCampusFilter || selectedCampusFilter === 'ALL' || selectedCampusFilter === 'all' || selectedCampusFilter === 'GLOBAL' ? null : selectedCampusFilter);

  const [newPeriodCampusId, setNewPeriodCampusId] = useState<string>(() => {
    if (isAnnexeAdmin && user.campus_id) return user.campus_id;
    return 'ALL';
  });

  const getCampusName = (campusId?: string | null, staffMember?: StaffMember | null) => {
    const cId = campusId || staffMember?.campus_id;
    if (!cId) return 'Toutes les Annexes (Réseau)';
    const found = campuses?.find(c => c.id === cId);
    return found ? found.name : 'Annexe';
  };

  const isSlipInCampus = (s: PayrollSlip, campusId: string | null) => {
    if (!campusId) return true;
    return s.campus_id === campusId || (!s.campus_id && s.staff?.campus_id === campusId);
  };

  const [activeTab, setActiveTab] = useState<'periods' | 'preparation' | 'arrears' | 'history' | 'advances' | 'reports' | 'audit'>('periods');
  const [loading, setLoading] = useState(true);

  // États pour le modal d'audit ciblé ou global
  const [showPayrollAuditModal, setShowPayrollAuditModal] = useState<boolean>(false);
  const [auditTargetSlip, setAuditTargetSlip] = useState<PayrollSlip | null>(null);
  const [auditTargetStaff, setAuditTargetStaff] = useState<StaffMember | null>(null);

  const handleOpenAuditForSlip = (slip: PayrollSlip, staffMember?: StaffMember | null) => {
    setAuditTargetSlip(slip);
    setAuditTargetStaff(staffMember || staff.find(s => s.id === slip.staff_id) || (slip.staff as StaffMember) || null);
    setShowPayrollAuditModal(true);
  };

  const handleOpenGlobalAudit = () => {
    setAuditTargetSlip(null);
    setAuditTargetStaff(null);
    setShowPayrollAuditModal(true);
  };

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [allSchoolStaff, setAllSchoolStaff] = useState<StaffMember[]>([]);
  const [preparationStatusFilter, setPreparationStatusFilter] = useState<'ALL' | 'PREPARED' | 'MISSING' | 'DUPLICATE'>('ALL');
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [slips, setSlips] = useState<PayrollSlip[]>([]);
  const [advances, setAdvances] = useState<SalaryAdvance[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedPeriodId, setExpandedPeriodId] = useState<string | null>(null);
  const [periodSearchTerm, setPeriodSearchTerm] = useState<string>('');
  const [toast, setToast] = useState<{message: string, type: 'success'|'error'} | null>(null);

  // Alertes sensibles récentes et écoute des notifications temps réel
  const [recentSensitiveAlerts, setRecentSensitiveAlerts] = useState<any[]>([]);
  const [isAlertsBannerDismissed, setIsAlertsBannerDismissed] = useState<boolean>(false);

  const fetchRecentSensitiveAlerts = async () => {
    if (!user.school_id) return;
    try {
      const { data } = await supabase
        .from('audit_logs')
        .select(`
          id,
          action,
          entity_type,
          entity_id,
          details,
          created_at,
          profiles:user_id(full_name, email, role)
        `)
        .eq('school_id', user.school_id)
        .order('created_at', { ascending: false })
        .limit(100);

      const sensitiveLogs = (data || []).filter((log: any) => {
        const d = log.details || {};
        const isPayroll = d.type?.includes('payroll') || log.entity_type === 'payroll_slip' || log.action?.includes('PAYROLL');
        if (!isPayroll) return false;

        // RBAC : Pour un administrateur d'annexe, filtrer les alertes d'autres annexes
        if (isAnnexeAdmin && user.campus_id) {
          const logCampusId = d.campus_id || log.campus_id;
          if (logCampusId && logCampusId !== user.campus_id) {
            return false;
          }
        }

        return d.is_sensitive === true || log.action === 'PAYROLL_SENSITIVE_UPDATE' || (log.action === 'PAYROLL_DELETE' && d.is_sensitive);
      });
      setRecentSensitiveAlerts(sensitiveLogs);
    } catch (e) {
      console.warn("Erreur chargement alertes sensibles:", e);
    }
  };

  useEffect(() => {
    fetchRecentSensitiveAlerts();

    const handleAlertReceived = () => {
      fetchRecentSensitiveAlerts();
    };

    const handleOpenTargetAudit = (e: any) => {
      const detail = e.detail || {};
      // RBAC : Si l'alerte cible une autre annexe et l'utilisateur est admin d'annexe, ignorer l'ouverture
      if (isAnnexeAdmin && user.campus_id && detail.campusId && detail.campusId !== user.campus_id) {
        return;
      }
      const targetSlip = slips.find(s => s.id === detail.slipId) || null;
      const targetMember = staff.find(s => s.id === detail.staffId) || targetSlip?.staff || null;
      if (targetSlip) {
        handleOpenAuditForSlip(targetSlip, targetMember as StaffMember);
      } else {
        setAuditTargetSlip(null);
        setAuditTargetStaff(targetMember as StaffMember);
        setShowPayrollAuditModal(true);
      }
    };

    window.addEventListener('edunova-sensitive-payroll-alert', handleAlertReceived);
    window.addEventListener('open-target-payroll-audit', handleOpenTargetAudit);

    return () => {
      window.removeEventListener('edunova-sensitive-payroll-alert', handleAlertReceived);
      window.removeEventListener('open-target-payroll-audit', handleOpenTargetAudit);
    };
  }, [user.school_id, slips, staff]);

  // États modernes pour la section Arriérés & Paiements (Vue Tableau & Cartes)
  const [arrearsViewMode, setArrearsViewMode] = useState<'cards' | 'table'>('table');
  const [arrearsRoleFilter, setArrearsRoleFilter] = useState<string>('ALL');
  const [arrearsPeriodFilter, setArrearsPeriodFilter] = useState<string>('ALL');
  const [arrearsSortBy, setArrearsSortBy] = useState<'amount-desc' | 'amount-asc' | 'name-asc'>('amount-desc');
  const [arrearsCurrentPage, setArrearsCurrentPage] = useState<number>(1);
  const [arrearsItemsPerPage, setArrearsItemsPerPage] = useState<number>(10);

  // États modernes pour la section Historique des Paiements
  const [historyCurrentPage, setHistoryCurrentPage] = useState<number>(1);
  const [historyItemsPerPage, setHistoryItemsPerPage] = useState<number>(10);
  const [historyPeriodFilter, setHistoryPeriodFilter] = useState<string>('ALL');
  const [historyMethodFilter, setHistoryMethodFilter] = useState<string>('ALL');
  const [historySortBy, setHistorySortBy] = useState<'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc' | 'name-asc'>('date-desc');

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
  const [globalSettings, setGlobalSettings] = useState<any>(null);


  // Advances state
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [advanceStaffId, setAdvanceStaffId] = useState('');
  const [advanceAmount, setAdvanceAmount] = useState(0);
  const [advanceReason, setAdvanceReason] = useState('');

  const [periodToDelete, setPeriodToDelete] = useState<PayrollPeriod | null>(null);
  const [slipToDelete, setSlipToDelete] = useState<PayrollSlip | null>(null);
  const [expertAdvanceData, setExpertAdvanceData] = useState<{
    staff: StaffMember;
    slip?: PayrollSlip;
    advances: SalaryAdvance[];
  } | null>(null);

  const canValidate = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'DIRECTOR', 'ACCOUNTANT'].includes(user.role);

  // Options harmonisées pour les sélecteurs de style 'pillule'
  const payrollPaymentMethodOptions: SelectOption[] = React.useMemo(() => [
    { value: 'Espèces', label: 'Cash / Espèces', icon: CreditCard },
    { value: 'Virement', label: 'Dépôt Bancaire / Virement', icon: Building2 },
    { value: 'MonCash', label: 'MonCash (Digicel)', icon: Zap },
    { value: 'Chèque', label: 'Chèque Bancaire', icon: Landmark },
  ], []);

  const bankOptions: SelectOption[] = React.useMemo(() => {
    if (globalSettings?.banks && Array.isArray(globalSettings.banks) && globalSettings.banks.length > 0) {
      return globalSettings.banks.map((b: string) => ({
        value: b,
        label: b,
        icon: Building2
      }));
    }
    return [
      { value: 'Unibank', label: 'Unibank', icon: Building2 },
      { value: 'Sogebank', label: 'Sogebank', icon: Building2 },
      { value: 'BNC', label: 'BNC', icon: Building2 },
      { value: 'BUH', label: 'BUH', icon: Building2 },
      { value: 'Capital Bank', label: 'Capital Bank', icon: Building2 }
    ];
  }, [globalSettings?.banks]);

  const monthOptions: SelectOption[] = React.useMemo(() => 
    MONTHS.map((m, i) => ({
      value: String(i + 1),
      label: m,
      icon: Calendar
    })),
  []);

  const advanceStaffOptions: SelectOption[] = React.useMemo(() => 
    staff.map(s => ({
      value: s.id,
      label: `${formatStudentName(s.last_name, s.first_name).fullName} (${s.role})`,
      icon: User
    })),
  [staff]);

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
    if (isAnnexeAdmin && user.campus_id) {
      setSelectedCampusFilter(user.campus_id);
    } else if (!isAnnexeAdmin && currentCampusId && currentCampusId !== 'GLOBAL' && selectedCampusFilter === 'ALL') {
      setSelectedCampusFilter(currentCampusId);
    }
  }, [user.campus_id, isAnnexeAdmin, currentCampusId]);

  useEffect(() => {
    // Clear the selected period when switching campuses to avoid displaying a period from another campus
    setSelectedPeriodId('');
    fetchData();
    setSearchTerm('');
    setArrearsCurrentPage(1);
    setHistoryCurrentPage(1);
  }, [user.school_id, effectiveCampusId]);

  useEffect(() => {
    if (selectedPeriodId) {
      fetchData();
    }
  }, [selectedPeriodId]);

  const fetchData = async () => {
    if (!user.school_id) return;
    setLoading(true);
    try {
      const { data: schoolData } = await supabase.from('schools').select('global_settings').eq('id', user.school_id).single();
      if (schoolData) setGlobalSettings(schoolData.global_settings);

      // 1. Fetch Staff (All active staff for whole school or restricted to annexe if annexe admin)
      let staffQuery = supabase
        .from('staff')
        .select('*')
        .eq('school_id', user.school_id)
        .eq('status', 'Actif')
        .order('last_name');

      if (isAnnexeAdmin && user.campus_id) {
        staffQuery = staffQuery.eq('campus_id', user.campus_id);
      }

      const { data: allStaffData, error: staffError } = await staffQuery;
      if (staffError) throw staffError;

      // Fetch active academic year
      const { data: years } = await supabase.from('academic_years').select('id, status, is_active').eq('school_id', user.school_id);
      const activeYear = years?.find(y => y.is_active || y.status === 'ACTIVE') || years?.[0];

      // Fetch assignments to calculate teaching hours across all school staff
      let assignmentsQuery = supabase
        .from('staff_assignments')
        .select('staff_id, duration_hours, hourly_rate')
        .eq('school_id', user.school_id);
      
      if (activeYear) {
        assignmentsQuery = assignmentsQuery.eq('academic_year_id', activeYear.id);
      }
      const { data: assignmentsData } = await assignmentsQuery;

      const allStaffWithCalculatedSalary = (allStaffData || [])
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

      setAllSchoolStaff(isAnnexeAdmin && user.campus_id
        ? allStaffWithCalculatedSalary.filter(s => s.campus_id === user.campus_id)
        : allStaffWithCalculatedSalary
      );

      const activeCampusId = effectiveCampusId;
      const staffForCurrentView = activeCampusId 
        ? allStaffWithCalculatedSalary.filter(s => s.campus_id === activeCampusId)
        : allStaffWithCalculatedSalary;

      setStaff(staffForCurrentView);

      // 2. Fetch Periods
      let periodsQuery = supabase
        .from('payroll_periods')
        .select('*')
        .eq('school_id', user.school_id);
      
      if (isAnnexeAdmin && user.campus_id) {
        periodsQuery = periodsQuery.or(`campus_id.eq.${user.campus_id},campus_id.is.null`);
      } else if (activeCampusId) {
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
      
      if (isAnnexeAdmin && user.campus_id) {
        slipsQuery = slipsQuery.or(`campus_id.eq.${user.campus_id},campus_id.is.null`);
      } else if (activeCampusId) {
        slipsQuery = slipsQuery.or(`campus_id.is.null,campus_id.eq.${activeCampusId}`);
      }

      const { data: slipsData, error: slipsError } = await slipsQuery;
      if (slipsError) throw slipsError;
      
      let slipsResult = slipsData || [];
      if (isAnnexeAdmin && user.campus_id) {
        slipsResult = slipsResult.filter(s => s.campus_id === user.campus_id || (!s.campus_id && (!s.staff || s.staff.campus_id === user.campus_id)));
      } else if (activeCampusId) {
        slipsResult = slipsResult.filter(s => s.campus_id === activeCampusId || (!s.campus_id && (!s.staff || s.staff.campus_id === activeCampusId)));
      }
      setSlips(slipsResult);

      // 4. Fetch Advances
      let advancesQuery = supabase
        .from('salary_advances')
        .select(`
          *,
          staff:staff(*),
          approved_by_user:profiles!salary_advances_approved_by_fkey(*),
          deduction_period:payroll_periods(*)
        `)
        .eq('school_id', user.school_id)
        .order('created_at', { ascending: false });
      
      if (isAnnexeAdmin && user.campus_id) {
        advancesQuery = advancesQuery.or(`campus_id.eq.${user.campus_id},campus_id.is.null`);
      }

      const { data: advancesData, error: advancesError } = await advancesQuery;
      if (advancesError && advancesError.code !== '42P01') throw advancesError;
      
      let advancesFiltered = advancesData || [];
      if (isAnnexeAdmin && user.campus_id) {
        advancesFiltered = advancesFiltered.filter(adv => adv.campus_id === user.campus_id || (!adv.campus_id && (!adv.staff || adv.staff.campus_id === user.campus_id)));
      } else if (activeCampusId) {
        advancesFiltered = advancesFiltered.filter(adv => !adv.staff || adv.staff.campus_id === activeCampusId || adv.campus_id === activeCampusId);
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
      const targetCampus = isAnnexeAdmin && user.campus_id 
        ? user.campus_id 
        : (newPeriodCampusId !== 'ALL' ? newPeriodCampusId : (user.campus_id || null));

      const { data, error } = await supabase
        .from('payroll_periods')
        .insert([{
          school_id: user.school_id,
          campus_id: targetCampus,
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
        setShowPeriodModal(false);
        setModalSuccess(false);
        setActiveTab('preparation');
      }, 1500);

      import('../utils/auditLogger').then(({ AuditLogger }) => {
        AuditLogger.log({
          school_id: user.school_id,
          user_id: user.id,
          action: 'CREATE',
          entity_type: 'staff',
          entity_id: data.id,
          details: { 
            type: 'payroll_period',
            period: `${MONTHS[newPeriodMonth - 1]} ${newPeriodYear}`,
            campus_id: targetCampus,
            campus_name: getCampusName(targetCampus)
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
      const targetPeriod = periods.find(p => p.id === periodId);

      // RBAC : Vérifier si l'admin d'annexe a le droit d'altérer cette période
      if (isAnnexeAdmin && user.campus_id && targetPeriod?.campus_id && targetPeriod.campus_id !== user.campus_id) {
        showToast("Accès refusé : Cette période appartient à une autre annexe.", 'error');
        return;
      }

      const { error } = await supabase
        .from('payroll_periods')
        .update({ status })
        .eq('id', periodId);

      if (error) throw error;
      setPeriods(periods.map(p => p.id === periodId ? { ...p, status } : p));
      showToast(`Période marquée comme ${status === 'VALIDATED' ? 'validée' : status === 'CLOSED' ? 'clôturée' : 'brouillon'}.`);

      // Audit log
      import('../utils/auditLogger').then(({ AuditLogger }) => {
        AuditLogger.log({
          school_id: user.school_id,
          user_id: user.id,
          action: 'UPDATE',
          entity_type: 'payroll_period',
          entity_id: periodId,
          details: { 
            type: 'payroll_period',
            action_type: 'PERIOD_STATUS_UPDATED',
            status: status,
            period_id: periodId,
            period_name: targetPeriod ? getPeriodName(targetPeriod) : 'Période',
            admin_name: user.full_name,
            admin_email: user.email,
            admin_role: user.role,
            summary: `Statut de la période ${targetPeriod ? getPeriodName(targetPeriod) : ''} changé en "${status}" par ${user.full_name} (${user.role})`
          }
        });
      });
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
      
      if (effectiveCampusId && activeStaffIds.length > 0) {
        advancesResetQuery = advancesResetQuery.in('staff_id', activeStaffIds);
      }
      const { error: resetError } = await advancesResetQuery;
      if (resetError) throw resetError;

      // 2. Delete slips for the current campus only (or all if no campus selected)
      let slipsDeleteQuery = supabase
        .from('payroll_slips')
        .delete()
        .eq('period_id', periodId);
      
      const targetCampusIdForDelete = isAnnexeAdmin ? user.campus_id : effectiveCampusId;
      if (targetCampusIdForDelete) {
        slipsDeleteQuery = slipsDeleteQuery.eq('campus_id', targetCampusIdForDelete);
      }
      const { error: slipsDeleteError } = await slipsDeleteQuery;
      if (slipsDeleteError) throw slipsDeleteError;

      // 3. Delete period record itself if not shared, or if no campus selected
      let shouldDeletePeriodRecord = true;
      const activeCampusIdForDelete = isAnnexeAdmin ? user.campus_id : effectiveCampusId;
      if (activeCampusIdForDelete && !periodToDelete.campus_id) {
        // If a campus is selected but the period is centralized (has no campus_id), do not delete the period itself
        shouldDeletePeriodRecord = false;
      }

      // RBAC check: an annexe admin cannot delete a period belonging to another annexe
      if (isAnnexeAdmin && user.campus_id && periodToDelete.campus_id && periodToDelete.campus_id !== user.campus_id) {
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

      const deletedSlips = slips.filter(s => s.period_id === periodId && (!effectiveCampusId || s.campus_id === effectiveCampusId || s.staff?.campus_id === effectiveCampusId));
      const deletedSlipIds = deletedSlips.map(s => s.id);

      // 4. Update local state
      setSlips(slips.filter(s => !deletedSlipIds.includes(s.id)));
      setAdvances(advances.map(a => (a.deduction_period_id === periodId && (!effectiveCampusId || activeStaffIds.includes(a.staff_id))) ? { ...a, status: 'PAID', deduction_period_id: null } : a));
      
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
            slips_count: deletedSlips.length,
            campus_id: effectiveCampusId || null,
            campus_name: getCampusName(effectiveCampusId)
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

    // RBAC : Vérifier si l'administrateur d'annexe a les droits sur cette fiche
    if (isAnnexeAdmin && user.campus_id) {
      const slipCampus = slipToDelete.campus_id || slipToDelete.staff?.campus_id;
      if (slipCampus && slipCampus !== user.campus_id) {
        showToast("Accès refusé : Vous ne pouvez pas supprimer une fiche d'une autre annexe.", 'error');
        return;
      }
    }

    setLoading(true);
    try {
      const sensitivity = evaluatePayrollSensitivity({
        isDeletion: true,
        deletedSlip: slipToDelete
      });

      const { error } = await supabase
        .from('payroll_slips')
        .delete()
        .eq('id', slipToDelete.id);

      if (error) throw error;

      setSlips(slips.filter(s => s.id !== slipToDelete.id));
      showToast(
        sensitivity.isSensitive 
          ? "Fiche supprimée — Alerte transmise aux administrateurs." 
          : "Fiche de paie supprimée."
      );
      setSlipToDelete(null);

      // Log the action with full audit & sensitivity context
      import('../utils/auditLogger').then(({ AuditLogger }) => {
        AuditLogger.log({
          school_id: user.school_id,
          user_id: user.id,
          action: 'PAYROLL_DELETE',
          entity_type: 'payroll_slip',
          entity_id: slipToDelete.id,
          details: { 
            type: 'payroll_slip',
            action_type: 'PAYROLL_SLIP_DELETED',
            is_sensitive: true,
            severity: sensitivity.severity,
            sensitivity_reasons: sensitivity.reasons,
            summary: sensitivity.summary,
            slip_id: slipToDelete.id,
            staff_id: slipToDelete.staff_id,
            staff_name: `${slipToDelete.staff?.first_name} ${slipToDelete.staff?.last_name}`,
            staff_role: slipToDelete.staff?.role || '',
            previous_values: {
              base_salary: slipToDelete.base_salary,
              bonuses: slipToDelete.bonuses || 0,
              deductions: slipToDelete.deductions || 0,
              net_salary: slipToDelete.net_salary,
              status: slipToDelete.status
            },
            diff: sensitivity.diff,
            admin_name: user.full_name || 'Administrateur',
            admin_email: user.email,
            admin_role: user.role,
            campus_id: slipToDelete.campus_id || slipToDelete.staff?.campus_id || null,
            campus_name: getCampusName(slipToDelete.campus_id || slipToDelete.staff?.campus_id, slipToDelete.staff),
            period_name: slipToDelete.period ? `${MONTHS[slipToDelete.period.month - 1]} ${slipToDelete.period.year}` : 'Inconnue'
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
    const staffMember = staff.find(s => s.id === staffId);
    const targetCampusId = isAnnexeAdmin ? user.campus_id : (staffMember?.campus_id || user.campus_id || effectiveCampusId || null);

    // RBAC : Contrôle d'accès sur l'annexe
    if (isAnnexeAdmin && user.campus_id) {
      const slipCampus = existingSlip?.campus_id || staffMember?.campus_id;
      if (slipCampus && slipCampus !== user.campus_id) {
        showToast("Accès refusé : Cette fiche de paie appartient à une autre annexe.", 'error');
        return;
      }
    }

    // Évaluation en amont de la sensibilité de la modification
    const sensitivity = evaluatePayrollSensitivity({
      existingSlip,
      newValues: {
        base_salary: base,
        bonuses: bonus,
        deductions: deduction,
        net_salary: net
      },
      staffName: staffMember ? `${staffMember.first_name} ${staffMember.last_name}` : undefined
    });

    try {
      if (existingSlip) {
        const { data, error } = await supabase
          .from('payroll_slips')
          .update({
            base_salary: base,
            bonuses: bonus,
            deductions: deduction,
            net_salary: net,
            campus_id: existingSlip.campus_id || targetCampusId
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
            action: sensitivity.isSensitive ? 'PAYROLL_SENSITIVE_UPDATE' : 'PAYROLL_UPDATE',
            entity_type: 'payroll_slip',
            entity_id: existingSlip.id,
            details: { 
              type: 'payroll_slip',
              action_type: sensitivity.isSensitive ? 'PAYROLL_SENSITIVE_UPDATE' : 'PAYROLL_SLIP_UPDATED',
              slip_id: existingSlip.id,
              staff_id: staffId,
              is_sensitive: sensitivity.isSensitive,
              severity: sensitivity.severity,
              sensitivity_reasons: sensitivity.reasons,
              summary: sensitivity.summary,
              previous_values: {
                base_salary: existingSlip.base_salary,
                bonuses: existingSlip.bonuses || 0,
                deductions: existingSlip.deductions || 0,
                net_salary: existingSlip.net_salary
              },
              new_values: {
                base_salary: base,
                bonuses: bonus,
                deductions: deduction,
                net_salary: net
              },
              diff: sensitivity.diff,
              admin_name: user.full_name || 'Administrateur',
              admin_email: user.email,
              admin_role: user.role,
              net_salary: net,
              staff_name: `${data.staff?.first_name} ${data.staff?.last_name}`,
              staff_role: data.staff?.role || '',
              campus_id: data.campus_id || targetCampusId,
              campus_name: getCampusName(data.campus_id || targetCampusId, data.staff),
              period: data.period ? `${MONTHS[data.period.month - 1]} ${data.period.year}` : 'Inconnue',
              period_name: data.period ? `${MONTHS[data.period.month - 1]} ${data.period.year}` : 'Inconnue'
            }
          });
        });

        if (sensitivity.isSensitive) {
          showToast("Modification sensible enregistrée — Alerte transmise en temps réel aux administrateurs.");
        } else {
          showToast("Fiche de paie enregistrée avec succès !");
        }
      } else {
        const { data, error } = await supabase
          .from('payroll_slips')
          .insert([{
            school_id: user.school_id,
            campus_id: targetCampusId,
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
            action: sensitivity.isSensitive ? 'PAYROLL_SENSITIVE_UPDATE' : 'PAYROLL_CREATE',
            entity_type: 'payroll_slip',
            entity_id: data.id,
            details: { 
              type: 'payroll_slip',
              action_type: 'PAYROLL_SLIP_CREATED',
              slip_id: data.id,
              staff_id: staffId,
              is_sensitive: sensitivity.isSensitive,
              severity: sensitivity.severity,
              sensitivity_reasons: sensitivity.reasons,
              summary: sensitivity.summary,
              new_values: {
                base_salary: base,
                bonuses: bonus,
                deductions: deduction,
                net_salary: net
              },
              admin_name: user.full_name || 'Administrateur',
              admin_email: user.email,
              admin_role: user.role,
              net_salary: net,
              staff_name: `${data.staff?.first_name} ${data.staff?.last_name}`,
              staff_role: data.staff?.role || '',
              campus_id: targetCampusId,
              campus_name: getCampusName(targetCampusId, data.staff),
              period: data.period ? `${MONTHS[data.period.month - 1]} ${data.period.year}` : 'Inconnue',
              period_name: data.period ? `${MONTHS[data.period.month - 1]} ${data.period.year}` : 'Inconnue'
            }
          });
        });

        if (sensitivity.isSensitive) {
          showToast("Fiche créée — Alerte transmise en temps réel aux administrateurs.");
        } else {
          showToast("Fiche de paie enregistrée avec succès !");
        }
      }
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
          campus_id: member.campus_id || user.campus_id || effectiveCampusId || null,
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

  const handlePrepareCampus = async (targetCampusId: string | null, targetCampusName: string) => {
    if (!selectedPeriodId) return;

    // RBAC : Un administrateur d'annexe ne peut pas préparer la paie d'une autre annexe
    if (isAnnexeAdmin && user.campus_id && targetCampusId && targetCampusId !== user.campus_id) {
      showToast("Accès restreint : Vous n'avez pas les droits pour préparer la paie d'une autre annexe.", 'error');
      return;
    }

    setLoading(true);
    try {
      const targetStaff = (allSchoolStaff.length > 0 ? allSchoolStaff : staff).filter(member => {
        const isInCampus = targetCampusId ? member.campus_id === targetCampusId : true;
        const alreadyHasSlip = slips.some(s => s.period_id === selectedPeriodId && s.staff_id === member.id);
        return isInCampus && !alreadyHasSlip;
      });

      if (targetStaff.length === 0) {
        showToast(`Tous les employés de ${targetCampusName} ont déjà une fiche pour cette période.`);
        setLoading(false);
        return;
      }

      const newSlips = targetStaff.map(member => {
        const memberAdvances = advances.filter(a => 
          a.staff_id === member.id && 
          (a.status === 'PAID' || a.status === 'APPROVED') &&
          (!a.deduction_period_id || a.deduction_period_id === selectedPeriodId)
        );
        const base = member.calculated_base_salary ?? member.amount ?? 0;
        const requestedTotalDeduction = memberAdvances.reduce((sum, a) => sum + a.amount, 0);
        const totalDeductionAllowed = Math.min(requestedTotalDeduction, base);

        return {
          school_id: user.school_id,
          campus_id: member.campus_id || targetCampusId || null,
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

      setSlips(prev => [...prev, ...(data || [])]);
      showToast(`${data?.length || 0} fiches de paie générées pour ${targetCampusName} !`);

      import('../utils/auditLogger').then(({ AuditLogger }) => {
        AuditLogger.log({
          school_id: user.school_id,
          user_id: user.id,
          action: 'CREATE',
          entity_type: 'staff',
          details: { 
            type: 'payroll_batch_campus',
            campus_id: targetCampusId,
            campus_name: targetCampusName,
            count: data?.length || 0
          }
        });
      });
    } catch (error: any) {
      console.error("Error preparing slips for campus:", error);
      showToast("Erreur lors de la préparation des fiches de l'annexe.", 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePurgeDuplicate = async (slipToPurge: PayrollSlip, staffName: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('payroll_slips')
        .delete()
        .eq('id', slipToPurge.id);

      if (error) throw error;

      setSlips(prev => prev.filter(s => s.id !== slipToPurge.id));
      showToast(`Doublon de fiche pour ${staffName} supprimé avec succès.`);

      import('../utils/auditLogger').then(({ AuditLogger }) => {
        AuditLogger.log({
          school_id: user.school_id,
          user_id: user.id,
          action: 'DELETE',
          entity_type: 'staff',
          entity_id: slipToPurge.staff_id,
          details: { 
            type: 'payroll_slip_duplicate_purge',
            slip_id: slipToPurge.id,
            staff_name: staffName,
            campus_id: slipToPurge.campus_id || null
          }
        });
      });
    } catch (error: any) {
      console.error("Error purging duplicate slip:", error);
      showToast("Erreur lors de la suppression du doublon.", 'error');
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
          campus_id: adv.campus_id || adv.staff?.campus_id || null,
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
          campus_id: updatedSlip.campus_id || updatedSlip.staff?.campus_id || null,
          campus_name: getCampusName(updatedSlip.campus_id || updatedSlip.staff?.campus_id, updatedSlip.staff),
          type: 'payroll'
        }
      });
    });

    return updatedSlip;
  };

  const handlePayAllSlips = async (periodId: string) => {
    try {
      setLoading(true);
      let periodSlips = slips.filter(s => s.period_id === periodId && s.status === 'UNPAID');
      
      // RBAC : Filtrer par annexe pour les administrateurs d'annexe
      if (isAnnexeAdmin && user.campus_id) {
        periodSlips = periodSlips.filter(s => isSlipInCampus(s, user.campus_id));
      }

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

    // RBAC : Contrôle d'accès sur l'annexe
    if (isAnnexeAdmin && user.campus_id) {
      const slipCampus = selectedSlip.campus_id || selectedSlip.staff?.campus_id;
      if (slipCampus && slipCampus !== user.campus_id) {
        showToast("Accès refusé : Cette fiche appartient à une autre annexe.", 'error');
        return;
      }
    }

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
      const targetStaffMember = staff.find(s => s.id === advanceStaffId);
      const advanceCampusId = isAnnexeAdmin ? user.campus_id : (targetStaffMember?.campus_id || null);

      const { data, error } = await supabase
        .from('salary_advances')
        .insert([{
          school_id: user.school_id,
          campus_id: advanceCampusId,
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
      const targetAdvance = advances.find(a => a.id === advanceId);
      if (isAnnexeAdmin && user.campus_id) {
        const advCampus = targetAdvance?.campus_id || targetAdvance?.staff?.campus_id;
        if (advCampus && advCampus !== user.campus_id) {
          showToast("Accès refusé : Cette avance appartient à une autre annexe.", 'error');
          return;
        }
      }

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
      const targetAdvance = advances.find(a => a.id === advanceId);
      if (isAnnexeAdmin && user.campus_id) {
        const advCampus = targetAdvance?.campus_id || targetAdvance?.staff?.campus_id;
        if (advCampus && advCampus !== user.campus_id) {
          showToast("Accès refusé : Cette avance appartient à une autre annexe.", 'error');
          return;
        }
      }

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

    if (isAnnexeAdmin && user.campus_id) {
      const advCampus = selectedAdvance.campus_id || selectedAdvance.staff?.campus_id;
      if (advCampus && advCampus !== user.campus_id) {
        showToast("Accès refusé : Cette avance appartient à une autre annexe.", 'error');
        return;
      }
    }

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
          const periodSlips = slips.filter(s => s.period_id === period.id && isSlipInCampus(s, effectiveCampusId));
          const totalToPay = periodSlips.reduce((sum, s) => sum + s.net_salary, 0);
          const totalPaid = periodSlips.filter(s => s.status === 'PAID').reduce((sum, s) => sum + s.net_salary, 0);
          const progress = totalToPay > 0 ? (totalPaid / totalToPay) * 100 : 0;

          return (
            <div key={period.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-800">{getPeriodName(period)}</h3>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      period.status === 'DRAFT' ? 'bg-slate-100 text-slate-800' :
                      period.status === 'VALIDATED' ? 'bg-blue-100 text-blue-800' :
                      'bg-emerald-100 text-emerald-800'
                    }`}>
                      {period.status}
                    </span>
                    {hasMultipleCampuses && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                        <Building2 className="w-3 h-3" />
                        {getCampusName(period.campus_id)}
                      </span>
                    )}
                  </div>
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
    const periodSlips = slips.filter(s => s.period_id === selectedPeriodId);
    const slipCountByStaff: Record<string, number> = {};
    periodSlips.forEach(s => {
      slipCountByStaff[s.staff_id] = (slipCountByStaff[s.staff_id] || 0) + 1;
    });
    const duplicateStaffIds = new Set(
      Object.keys(slipCountByStaff).filter(id => slipCountByStaff[id] > 1)
    );

    const filteredStaff = staff.filter(s => {
      const matchesSearch = s.first_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        s.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.role && s.role.toLowerCase().includes(searchTerm.toLowerCase()));
      if (!matchesSearch) return false;

      const memberSlipCount = slipCountByStaff[s.id] || 0;
      if (preparationStatusFilter === 'PREPARED') return memberSlipCount > 0;
      if (preparationStatusFilter === 'MISSING') return memberSlipCount === 0;
      if (preparationStatusFilter === 'DUPLICATE') return memberSlipCount > 1;
      return true;
    });

    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200/80">
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              Préparation : {currentPeriod ? getPeriodName(currentPeriod) : ''}
            </h2>
            <p className="text-xs sm:text-sm font-semibold text-slate-600 mt-0.5">Générez les fiches de paie pour chaque employé.</p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
            <div className="relative w-full sm:w-64 md:w-72 lg:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-700 pointer-events-none" />
              <input
                type="text"
                placeholder="Rechercher un employé..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-8 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-bold text-slate-950 placeholder:text-slate-600 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none shadow-2xs transition-all"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-900 rounded-md transition-colors cursor-pointer"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <button
              onClick={handlePrepareAll}
              disabled={loading || !currentPeriod || currentPeriod.status === 'VALIDATED' || currentPeriod.status === 'CLOSED'}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-bold text-xs sm:text-sm transition-all shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer shrink-0"
            >
              <Save className="w-4 h-4" />
              <span>{currentPeriod?.status === 'VALIDATED' || currentPeriod?.status === 'CLOSED' ? 'Période Verrouillée' : 'Préparer Tout'}</span>
            </button>
          </div>
        </div>

        {/* Section d'Audit d'Intégrité des Données & Couverture des Annexes */}
        {currentPeriod && (
          <PayrollIntegrityAudit
            currentPeriod={currentPeriod}
            periodName={getPeriodName(currentPeriod)}
            allSchoolStaff={allSchoolStaff.length > 0 ? allSchoolStaff : staff}
            campuses={campuses || []}
            hasMultipleCampuses={hasMultipleCampuses}
            slips={slips}
            advances={advances}
            terminology={terminology}
            loading={loading}
            restrictedCampusId={isAnnexeAdmin ? user.campus_id : null}
            isSuperUser={isSuperUser}
            onPrepareCampus={handlePrepareCampus}
            onPurgeDuplicate={handlePurgeDuplicate}
            onFilterMissingStaff={() => setPreparationStatusFilter('MISSING')}
            onFilterDuplicates={() => setPreparationStatusFilter('DUPLICATE')}
          />
        )}

        {currentPeriod?.status === 'VALIDATED' && (
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex items-center gap-3 text-blue-900">
            <Info className="w-5 h-5 shrink-0 text-blue-600" />
            <p className="text-sm font-bold">Cette période est <strong>validée</strong>. Les fiches ne peuvent plus être modifiées.</p>
          </div>
        )}

        {/* Barre de filtrage par état de préparation */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => setPreparationStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                preparationStatusFilter === 'ALL'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tous ({staff.length})
            </button>
            <button
              type="button"
              onClick={() => setPreparationStatusFilter('PREPARED')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                preparationStatusFilter === 'PREPARED'
                  ? 'bg-white text-emerald-800 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Avec Fiche ({staff.filter(s => (slipCountByStaff[s.id] || 0) > 0).length})
            </button>
            <button
              type="button"
              onClick={() => setPreparationStatusFilter('MISSING')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                preparationStatusFilter === 'MISSING'
                  ? 'bg-white text-amber-800 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sans Fiche ({staff.filter(s => (slipCountByStaff[s.id] || 0) === 0).length})
            </button>
            {duplicateStaffIds.size > 0 && (
              <button
                type="button"
                onClick={() => setPreparationStatusFilter('DUPLICATE')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  preparationStatusFilter === 'DUPLICATE'
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : 'text-rose-700 bg-rose-50 hover:bg-rose-100'
                }`}
              >
                <AlertTriangle className="w-3 h-3" />
                <span>Doublons ({duplicateStaffIds.size})</span>
              </button>
            )}
          </div>

          <div className="text-xs font-bold text-slate-500">
            Affichage : {filteredStaff.length} / {staff.length} employé(s)
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[760px]">
              <thead className="bg-slate-100 text-slate-900 font-extrabold border-b border-slate-200 uppercase text-xs tracking-wider">
                <tr>
                  <th className="px-4 py-3.5 text-slate-950 font-black">Employé</th>
                  <th className="px-4 py-3.5 text-slate-950 font-black">Rôle / Type</th>
                  <th className="px-4 py-3.5 text-slate-950 font-black text-right">Salaire Base (HTG)</th>
                  <th className="px-4 py-3.5 text-emerald-900 font-black text-right">Primes (HTG)</th>
                  <th className="px-4 py-3.5 text-rose-900 font-black text-right">Déductions (HTG)</th>
                  <th className="px-4 py-3.5 text-slate-950 font-black text-right">Net à Payer (HTG)</th>
                  <th className="px-4 py-3.5 text-right text-slate-950 font-black">Action</th>
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
                    <td colSpan={7} className="py-8 text-center text-slate-900 font-bold italic">
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
                      campusName={hasMultipleCampuses ? getCampusName(member.campus_id, member) : undefined}
                      terminology={terminology}
                      duplicateCount={slipCountByStaff[member.id] || 0}
                      onSave={handleSaveSlip} 
                      onDelete={setSlipToDelete}
                      onShowAudit={handleOpenAuditForSlip}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile & Tablet Card View */}
          <div className="md:hidden divide-y divide-slate-100 p-3 sm:p-4 space-y-3 bg-slate-50/50">
            {loading ? (
              <div className="py-8">
                <FluidLoadingState 
                  message="Chargement de la gestion de paie & salaires..." 
                  subtext="Calcul des émoluments, retenues, cotisations et bulletins de paie..." 
                />
                <SkeletonTable rows={4} />
              </div>
            ) : filteredStaff.length === 0 ? (
              <div className="py-8 text-center text-slate-900 font-bold italic bg-white p-6 rounded-2xl border border-slate-200">
                Aucun employé ne correspond aux critères.
              </div>
            ) : filteredStaff.map(member => {
              const slip = slips.find(s => s.period_id === selectedPeriodId && s.staff_id === member.id);
              const memberAdvances = advances.filter(a => 
                a.staff_id === member.id && 
                (a.status === 'APPROVED' || a.status === 'PAID') &&
                (!a.deduction_period_id || a.deduction_period_id === selectedPeriodId)
              );
              const eligibleAdvances = memberAdvances.filter(a => 
                !slip || !slip.created_at || new Date(a.approved_at || a.requested_at).getTime() <= new Date(slip.created_at).getTime()
              );
              return (
                <StaffPayrollCard 
                  key={member.id} 
                  member={member} 
                  slip={slip} 
                  memberAdvances={eligibleAdvances}
                  campusName={hasMultipleCampuses ? getCampusName(member.campus_id, member) : undefined}
                  terminology={terminology}
                  duplicateCount={slipCountByStaff[member.id] || 0}
                  onSave={handleSaveSlip} 
                  onDelete={setSlipToDelete}
                  onShowAudit={handleOpenAuditForSlip}
                />
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderArrearsTab = () => {
    // Group unpaid slips by employee
    const unpaidSlips = slips.filter(s => s.status === 'UNPAID' && isSlipInCampus(s, effectiveCampusId));
    
    // Global metrics across all unpaid slips
    const totalArrearsGlobal = unpaidSlips.reduce((sum, s) => sum + s.net_salary, 0);
    const totalDeductionsGlobal = unpaidSlips.reduce((sum, s) => sum + (s.deductions || 0), 0);
    const totalSlipsCount = unpaidSlips.length;

    // Distinct periods in unpaid slips for filtering
    const distinctPeriods = Array.from(new Set(unpaidSlips.map(s => s.period_id))).map(periodId => {
      const pObj = periods.find(p => p.id === periodId) || unpaidSlips.find(s => s.period_id === periodId)?.period;
      return {
        id: periodId,
        label: pObj ? getPeriodName(pObj) : 'Période inconnue'
      };
    });

    // Distinct roles in unpaid slips for filtering
    const distinctRoles = Array.from(new Set(unpaidSlips.map(s => s.staff?.role).filter(Boolean))) as string[];

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

    let arrearsList = Object.values(arrearsByStaff);

    // Apply filters
    if (searchTerm) {
      const q = searchTerm.toLowerCase().trim();
      arrearsList = arrearsList.filter(arrear => 
        arrear.staff?.first_name.toLowerCase().includes(q) ||
        arrear.staff?.last_name.toLowerCase().includes(q) ||
        arrear.staff?.role?.toLowerCase().includes(q) ||
        arrear.slips.some(s => s.period && getPeriodName(s.period).toLowerCase().includes(q))
      );
    }

    if (arrearsRoleFilter !== 'ALL') {
      arrearsList = arrearsList.filter(arrear => arrear.staff?.role === arrearsRoleFilter);
    }

    if (arrearsPeriodFilter !== 'ALL') {
      arrearsList = arrearsList.filter(arrear => arrear.slips.some(s => s.period_id === arrearsPeriodFilter));
    }

    // Sort
    arrearsList.sort((a, b) => {
      if (arrearsSortBy === 'amount-desc') return b.totalOwed - a.totalOwed;
      if (arrearsSortBy === 'amount-asc') return a.totalOwed - b.totalOwed;
      if (arrearsSortBy === 'name-asc') {
        const nameA = `${a.staff?.last_name || ''} ${a.staff?.first_name || ''}`;
        const nameB = `${b.staff?.last_name || ''} ${b.staff?.first_name || ''}`;
        return nameA.localeCompare(nameB);
      }
      return 0;
    });

    const filteredTotalOwed = arrearsList.reduce((sum, a) => sum + a.totalOwed, 0);
    const totalStaffCount = Object.keys(arrearsByStaff).length;

    // Pagination calculations
    const totalPages = Math.max(1, Math.ceil(arrearsList.length / arrearsItemsPerPage));
    const safeCurrentPage = Math.min(arrearsCurrentPage, totalPages);
    const startIndex = (safeCurrentPage - 1) * arrearsItemsPerPage;
    const paginatedList = arrearsList.slice(startIndex, startIndex + arrearsItemsPerPage);

    return (
      <div className="space-y-3.5 sm:space-y-4 animate-in fade-in duration-300">
        {/* KPI DASHBOARD CARDS - SYNTHÈSE COMPACTE & ÉPURÉE */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          {/* Total Arriérés */}
          <div className="bg-white p-3 sm:p-3.5 rounded-xl sm:rounded-2xl border border-rose-100 shadow-2xs flex items-center justify-between hover:border-rose-200 transition-all">
            <div>
              <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total des Arriérés Dûs</p>
              <h4 className="text-lg sm:text-xl font-black text-rose-600 mt-0.5 tabular-nums">
                {totalArrearsGlobal.toLocaleString()} <span className="text-xs font-bold text-rose-500">HTG</span>
              </h4>
              <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium mt-0.5">
                Sur {totalSlipsCount} bulletin{totalSlipsCount > 1 ? 's' : ''} impayé{totalSlipsCount > 1 ? 's' : ''}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100/80 flex items-center justify-center text-rose-600 shrink-0">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>

          {/* Personnel Concerné */}
          <div className="bg-white p-3 sm:p-3.5 rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between hover:border-indigo-200 transition-all">
            <div>
              <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider">Personnel Concerné</p>
              <h4 className="text-lg sm:text-xl font-black text-slate-900 mt-0.5 tabular-nums">
                {totalStaffCount} <span className="text-xs font-bold text-slate-500">employé{totalStaffCount > 1 ? 's' : ''}</span>
              </h4>
              <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium mt-0.5">En attente de versement</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100/80 flex items-center justify-center text-indigo-600 shrink-0">
              <Users className="w-5 h-5" />
            </div>
          </div>

          {/* Mois / Périodes en attente */}
          <div className="bg-white p-3 sm:p-3.5 rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between hover:border-amber-200 transition-all">
            <div>
              <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider">Périodes Non Réglées</p>
              <h4 className="text-lg sm:text-xl font-black text-amber-600 mt-0.5 tabular-nums">
                {distinctPeriods.length} <span className="text-xs font-bold text-amber-600">période{distinctPeriods.length > 1 ? 's' : ''}</span>
              </h4>
              <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium mt-0.5 truncate max-w-[140px] sm:max-w-[180px]">
                {distinctPeriods.map(p => p.label).slice(0, 2).join(', ')}{distinctPeriods.length > 2 ? '...' : ''}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100/80 flex items-center justify-center text-amber-600 shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
          </div>

          {/* Déductions / Avances récupérées - OPTIMISÉ POUR L'EXPERT PAIE */}
          <div className="bg-white p-3 sm:p-3.5 rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between hover:border-emerald-200 transition-all">
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider">Déductions Retenues</p>
                <span className="text-[9px] font-black text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded-md border border-emerald-200">Expert</span>
              </div>
              <h4 className="text-lg sm:text-xl font-black text-emerald-600 mt-0.5 tabular-nums">
                {totalDeductionsGlobal.toLocaleString()} <span className="text-xs font-bold text-emerald-500">HTG</span>
              </h4>
              <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium mt-0.5">Avances & prêts décomptés</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100/80 flex items-center justify-center text-emerald-600 shrink-0">
              <HandCoins className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* BARRE D'OUTILS MODERNE ADAPTATIVE SUR UNE SEULE LIGNE & ULTRA-RESPONSIVE */}
        <div className="bg-white p-2 sm:p-2.5 rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-2 sm:gap-2.5">
          {/* Groupe Filtres & Recherche : s'adapte sur une seule ligne fluide sans décrochage intempestif */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0 overflow-x-auto no-scrollbar py-0.5">
            {/* Recherche Pill avec largeur contrôlée et flexible */}
            <div className="relative w-full sm:w-44 md:w-48 lg:w-56 xl:w-64 shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Rechercher nom, rôle..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setArrearsCurrentPage(1);
                }}
                className="w-full pl-8 pr-7 py-1.5 sm:py-2 bg-slate-50 hover:bg-slate-100/60 focus:bg-white border border-slate-200 rounded-full text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all shadow-2xs"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setArrearsCurrentPage(1);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-700 rounded-full transition-colors cursor-pointer"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Filtre par Poste / Rôle avec SelectPill */}
            {distinctRoles.length > 0 && (
              <div className="shrink-0">
                <SelectPill
                  options={[
                    { value: 'ALL', label: `Tous les rôles (${distinctRoles.length})`, icon: Users },
                    ...distinctRoles.map(role => ({ value: role, label: role, icon: Award }))
                  ]}
                  value={arrearsRoleFilter}
                  onChange={(val) => {
                    setArrearsRoleFilter(val);
                    setArrearsCurrentPage(1);
                  }}
                  variant="pill"
                  size="sm"
                  colorScheme="slate"
                  icon={Users}
                  searchable={distinctRoles.length > 6}
                  portal={true}
                />
              </div>
            )}

            {/* Filtre par Période avec SelectPill */}
            {distinctPeriods.length > 1 && (
              <div className="shrink-0">
                <SelectPill
                  options={[
                    { value: 'ALL', label: `Toutes périodes (${distinctPeriods.length})`, icon: Calendar },
                    ...distinctPeriods.map(period => ({ value: period.id, label: period.label, icon: Calendar }))
                  ]}
                  value={arrearsPeriodFilter}
                  onChange={(val) => {
                    setArrearsPeriodFilter(val);
                    setArrearsCurrentPage(1);
                  }}
                  variant="pill"
                  size="sm"
                  colorScheme="slate"
                  icon={Calendar}
                  portal={true}
                />
              </div>
            )}

            {/* Tri avec SelectPill compact */}
            <div className="shrink-0">
              <SelectPill
                options={[
                  { value: 'amount-desc', label: 'Montant dû (Max)', icon: ArrowUpDown },
                  { value: 'amount-asc', label: 'Montant dû (Min)', icon: ArrowUpDown },
                  { value: 'name-asc', label: "Nom (A-Z)", icon: ArrowUpDown },
                ]}
                value={arrearsSortBy}
                onChange={(val) => setArrearsSortBy(val as any)}
                variant="pill"
                size="sm"
                colorScheme="slate"
                icon={ArrowUpDown}
                portal={true}
              />
            </div>
          </div>

          {/* COMMUTATEUR DE VUE & TOTAL SÉLECTIONNÉ */}
          <div className="flex items-center justify-between md:justify-end gap-2 shrink-0 pt-1.5 md:pt-0 border-t md:border-t-0 border-slate-100">
            {filteredTotalOwed > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-rose-50/80 border border-rose-200/80 rounded-full text-xs font-bold text-rose-700 whitespace-nowrap shrink-0">
                <span className="text-slate-400 font-medium hidden xl:inline">Total sélection :</span>
                <span className="text-slate-400 font-medium xl:hidden">Total :</span>
                <strong className="text-rose-600 tabular-nums">{filteredTotalOwed.toLocaleString()} HTG</strong>
              </div>
            )}

            <div className="flex items-center p-0.5 bg-slate-100/90 border border-slate-200 rounded-full shrink-0">
              <button
                type="button"
                onClick={() => setArrearsViewMode('table')}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  arrearsViewMode === 'table'
                    ? 'bg-white text-indigo-600 shadow-2xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Afficher sous forme de tableau"
              >
                <Table size={13} />
                <span>Tableau</span>
              </button>

              <button
                type="button"
                onClick={() => setArrearsViewMode('cards')}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  arrearsViewMode === 'cards'
                    ? 'bg-white text-indigo-600 shadow-2xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Afficher sous forme de cartes"
              >
                <LayoutGrid size={13} />
                <span>Cartes</span>
              </button>
            </div>
          </div>
        </div>

        {/* CONTENU PRINCIPAL SELON LA VUE SÉLECTIONNÉE */}
        {paginatedList.length === 0 ? (
          /* État vide soigné */
          <div className="text-center py-16 px-4 bg-white rounded-2xl shadow-2xs border border-slate-200/80">
            <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-3.5 border border-emerald-100/80">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">
              {unpaidSlips.length === 0 ? 'Aucun arriéré de salaire' : 'Aucun résultat correspondant'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mt-1">
              {unpaidSlips.length === 0 
                ? 'Tous les salaires préparés ont été intégralement payés pour cet établissement.'
                : 'Aucun employé avec des arriérés ne correspond aux critères de recherche ou de filtre sélectionnés.'}
            </p>
            {(searchTerm || arrearsRoleFilter !== 'ALL' || arrearsPeriodFilter !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setArrearsRoleFilter('ALL');
                  setArrearsPeriodFilter('ALL');
                }}
                className="mt-4 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl transition-all cursor-pointer inline-flex items-center gap-2"
              >
                <RefreshCcw size={13} />
                Réinitialiser les filtres
              </button>
            )}
          </div>
        ) : arrearsViewMode === 'table' ? (
          /* 1. VUE TABLEAU MODERNE & ÉPURÉE */
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xs border border-slate-200/80 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/90 border-b border-slate-200/80 text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-2.5 px-3 sm:px-4">Employé</th>
                    <th className="py-2.5 px-3 sm:px-4">Périodes Impayées</th>
                    <th className="py-2.5 px-3 sm:px-4">
                      <div className="flex items-center gap-1">
                        <span>Déductions & Avances</span>
                        <span className="text-[9px] font-black text-emerald-700 bg-emerald-100/90 px-1 rounded">Expert</span>
                      </div>
                    </th>
                    <th className="py-2.5 px-3 sm:px-4 text-right">Total Net Dû</th>
                    <th className="py-2.5 px-3 sm:px-4 text-center">Action de Paiement</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedList.map((arrear) => {
                    const initials = `${arrear.staff?.first_name?.charAt(0) || ''}${arrear.staff?.last_name?.charAt(0) || ''}`;
                    const formattedName = formatStudentName(arrear.staff?.last_name, arrear.staff?.first_name).fullName;
                    
                    // Calcul des avances totales déduites pour cet employé
                    const totalDeductionsForStaff = arrear.slips.reduce((sum, s) => sum + (s.deductions || 0), 0);

                    return (
                      <tr key={arrear.staff?.id} className="hover:bg-slate-50/70 transition-colors group">
                        {/* Employé */}
                        <td className="py-2.5 px-3 sm:px-4 whitespace-nowrap align-middle">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 font-black text-xs flex items-center justify-center shrink-0">
                              {initials}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 text-xs sm:text-sm group-hover:text-indigo-600 transition-colors">
                                {formattedName}
                              </div>
                              <div className="text-[10px] sm:text-[11px] text-slate-500 font-medium">
                                {arrear.staff?.role || 'Personnel'}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Périodes Impayées */}
                        <td className="py-2.5 px-3 sm:px-4 align-middle">
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {arrear.slips.map((slip) => (
                              <span
                                key={slip.id}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200/80 shadow-2xs"
                              >
                                <Calendar size={10} className="text-amber-600 shrink-0" />
                                <span>{slip.period ? getPeriodName(slip.period) : 'Période'}</span>
                                <span className="font-bold text-amber-950">({slip.net_salary.toLocaleString()} G)</span>
                              </span>
                            ))}
                            {arrear.slips.length > 1 && (
                              <span className="text-[10px] font-bold text-slate-500 self-center">
                                ({arrear.slips.length} mois)
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Déductions & Avances - EXPERT PAIE INTERACTIF */}
                        <td className="py-2.5 px-3 sm:px-4 whitespace-nowrap align-middle">
                          {totalDeductionsForStaff > 0 ? (
                            <button
                              type="button"
                              onClick={() => {
                                setExpertAdvanceData({
                                  staff: arrear.staff,
                                  slip: arrear.slips[0],
                                  advances: advances.filter(a => a.staff_id === arrear.staff.id)
                                });
                              }}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-black bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/90 shadow-2xs transition-all cursor-pointer group/adv"
                              title="Audit Expert Paie : Voir détail de l'avance déduite pour cet employé"
                            >
                              <HandCoins size={11} className="text-emerald-600" />
                              <span>- {totalDeductionsForStaff.toLocaleString()} HTG</span>
                              <Sparkles size={10} className="text-amber-500 group-hover/adv:scale-125 transition-transform" />
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400 font-medium italic">Aucune déduction</span>
                          )}
                        </td>

                        {/* Total Net Dû */}
                        <td className="py-2.5 px-3 sm:px-4 text-right whitespace-nowrap align-middle">
                          <div className="font-black text-xs sm:text-sm text-rose-600 tabular-nums">
                            {arrear.totalOwed.toLocaleString()} <span className="text-[10px] font-bold text-rose-500">HTG</span>
                          </div>
                          {totalDeductionsForStaff > 0 ? (
                            <div className="text-[9px] sm:text-[10px] font-medium text-slate-400">
                              Brut : {(arrear.totalOwed + totalDeductionsForStaff).toLocaleString()} G
                            </div>
                          ) : (
                            <div className="text-[9px] sm:text-[10px] font-medium text-slate-400">
                              {arrear.slips.length === 1 ? '1 versement' : `${arrear.slips.length} versements`}
                            </div>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-2.5 px-3 sm:px-4 text-center whitespace-nowrap align-middle">
                          {canValidate ? (
                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                              {arrear.slips.map((slip) => (
                                <div key={slip.id} className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedSlip(slip);
                                      setShowPaymentModal(true);
                                    }}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-lg shadow-2xs hover:shadow transition-all cursor-pointer"
                                    title={`Payer ${slip.period ? getPeriodName(slip.period) : 'la période'}`}
                                  >
                                    <DollarSign size={12} />
                                    <span>Payer {slip.period ? MONTHS[slip.period.month - 1]?.slice(0, 4) : ''}</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenAuditForSlip(slip, arrear.staff)}
                                    className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-indigo-100"
                                    title="Historique d'audit des modifications de cette fiche"
                                  >
                                    <History size={13} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-1">
                              <span className="text-xs text-slate-400 italic">Lecture seule</span>
                              {arrear.slips[0] && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenAuditForSlip(arrear.slips[0], arrear.staff)}
                                  className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                                  title="Historique d'audit des modifications"
                                >
                                  <History size={13} />
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* 2. VUE CARTES / LISTE MODERNE & ÉPURÉE */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-3.5">
            {paginatedList.map((arrear) => {
              const initials = `${arrear.staff?.first_name?.charAt(0) || ''}${arrear.staff?.last_name?.charAt(0) || ''}`;
              const formattedName = formatStudentName(arrear.staff?.last_name, arrear.staff?.first_name).fullName;
              const totalDeductionsForStaff = arrear.slips.reduce((sum, s) => sum + (s.deductions || 0), 0);

              return (
                <div 
                  key={arrear.staff?.id} 
                  className="bg-white rounded-xl sm:rounded-2xl shadow-2xs border border-slate-200/80 hover:border-slate-300 hover:shadow-xs transition-all overflow-hidden flex flex-col justify-between"
                >
                  {/* Carte Header */}
                  <div className="p-3 sm:p-3.5 bg-gradient-to-b from-slate-50/80 to-white border-b border-slate-100 flex items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-xl flex items-center justify-center font-black text-xs shrink-0 shadow-2xs">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-slate-900 text-xs sm:text-sm truncate">
                          {formattedName}
                        </h4>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="inline-block text-[10px] font-semibold text-slate-600 bg-slate-100/90 px-1.5 py-0.2 rounded">
                            {arrear.staff?.role || 'Personnel'}
                          </span>
                          {totalDeductionsForStaff > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setExpertAdvanceData({
                                  staff: arrear.staff,
                                  slip: arrear.slips[0],
                                  advances: advances.filter(a => a.staff_id === arrear.staff.id)
                                });
                              }}
                              className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer"
                              title="Audit Avance Déduite (Expert Paie)"
                            >
                              <HandCoins size={10} className="text-emerald-600" />
                              <span>-{totalDeductionsForStaff.toLocaleString()} G</span>
                              <Sparkles size={9} className="text-amber-500" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Total Net Dû</p>
                      <p className="text-sm sm:text-base font-black text-rose-600 tabular-nums">
                        {arrear.totalOwed.toLocaleString()} <span className="text-[10px] font-bold text-rose-500">HTG</span>
                      </p>
                      {totalDeductionsForStaff > 0 && (
                        <p className="text-[9px] font-semibold text-slate-400">
                          Brut : {(arrear.totalOwed + totalDeductionsForStaff).toLocaleString()} G
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Carte Corps : Liste des mois impayés */}
                  <div className="p-3 sm:p-3.5 space-y-2 flex-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      <span>Mois impayés</span>
                      <span>{arrear.slips.length} bulletin{arrear.slips.length > 1 ? 's' : ''}</span>
                    </div>

                    <div className="space-y-1.5">
                      {arrear.slips.map((slip) => {
                        const memberAdvances = advances.filter(a => 
                          a.staff_id === slip.staff_id && 
                          (a.status === 'APPROVED' || a.status === 'PAID')
                        );
                        const currentAdvances = memberAdvances.filter(a => 
                          !slip.created_at || new Date(a.approved_at || a.requested_at).getTime() <= new Date(slip.created_at).getTime()
                        );
                        const futureAdvances = memberAdvances.filter(a => 
                          slip.created_at && new Date(a.approved_at || a.requested_at).getTime() > new Date(slip.created_at).getTime()
                        );

                        const totalCurrentAdvanceAmount = currentAdvances.reduce((sum, a) => sum + a.amount, 0);
                        const totalFutureAdvanceAmount = futureAdvances.reduce((sum, a) => sum + a.amount, 0);
                        const hasDiscrepancy = slip.deductions !== totalCurrentAdvanceAmount;

                        return (
                          <div 
                            key={slip.id} 
                            className={`p-2.5 rounded-xl border transition-all ${
                              hasDiscrepancy 
                                ? 'bg-rose-50/70 border-rose-200' 
                                : 'bg-slate-50/80 hover:bg-white border-slate-200/70 hover:border-indigo-200 shadow-2xs'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <Calendar size={12} className="text-slate-400" />
                                  <span className="font-bold text-slate-800 text-xs">
                                    {slip.period ? getPeriodName(slip.period) : 'Période inconnue'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[11px] font-semibold text-slate-600">
                                    Net : <strong className="text-slate-900">{slip.net_salary.toLocaleString()} HTG</strong>
                                  </span>
                                  {slip.deductions > 0 && (
                                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1 rounded border border-emerald-200">
                                      -{slip.deductions.toLocaleString()} G
                                    </span>
                                  )}
                                  {hasDiscrepancy && (
                                    <span className="text-[10px] font-bold text-rose-600 flex items-center gap-0.5 animate-pulse">
                                      <AlertCircle size={9} /> Écart avance
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleOpenAuditForSlip(slip, arrear.staff)}
                                  className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-indigo-100"
                                  title="Historique des modifications de cette fiche"
                                >
                                  <History size={13} />
                                </button>
                                {canValidate && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedSlip(slip);
                                      setShowPaymentModal(true);
                                    }}
                                    className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-lg text-xs font-bold transition-all shadow-2xs hover:shadow cursor-pointer"
                                  >
                                    <DollarSign size={12} />
                                    <span>Payer</span>
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Informations sur les avances */}
                            {(totalCurrentAdvanceAmount > 0 || totalFutureAdvanceAmount > 0) && (
                              <div className="mt-1.5 pt-1.5 border-t border-slate-200/60 flex flex-wrap gap-1.5">
                                {totalCurrentAdvanceAmount > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setExpertAdvanceData({
                                        staff: arrear.staff,
                                        slip: slip,
                                        advances: memberAdvances
                                      });
                                    }}
                                    className="text-[10px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-md border border-amber-200 flex items-center gap-1 cursor-pointer"
                                    title="Voir détail de l'avance"
                                  >
                                    <HandCoins size={10} className="text-amber-600" />
                                    <span>Avance déduite : {totalCurrentAdvanceAmount.toLocaleString()} HTG</span>
                                  </button>
                                )}
                                {totalFutureAdvanceAmount > 0 && (
                                  <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-md border border-blue-200">
                                    Report : {totalFutureAdvanceAmount.toLocaleString()} HTG
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
              );
            })}
          </div>
        )}

        {/* BARRE DE PAGINATION MODERNE (COMMUNE AUX 2 VUES) */}
        {arrearsList.length > 0 && (
          <div className="px-3.5 sm:px-5 py-2.5 bg-white rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs">
            <div className="flex flex-wrap items-center justify-between sm:justify-start gap-2.5 w-full sm:w-auto text-slate-600 font-medium">
              <span>
                Affichage de <strong className="text-slate-900">{arrearsList.length === 0 ? 0 : (safeCurrentPage - 1) * arrearsItemsPerPage + 1}</strong> à <strong className="text-slate-900">{Math.min(safeCurrentPage * arrearsItemsPerPage, arrearsList.length)}</strong> sur <strong className="text-slate-900">{arrearsList.length}</strong> employé{arrearsList.length > 1 ? 's' : ''}
              </span>

              {/* Sélecteur de pagination avec SelectPill */}
              <div className="flex items-center gap-1.5 pl-2 sm:border-l sm:border-slate-200">
                <span className="text-slate-500 text-[11px]">Afficher :</span>
                <SelectPill
                  options={[
                    { value: '6', label: '6 / page' },
                    { value: '10', label: '10 / page' },
                    { value: '15', label: '15 / page' },
                    { value: '25', label: '25 / page' },
                    { value: '50', label: '50 / page' },
                  ]}
                  value={arrearsItemsPerPage.toString()}
                  onChange={(val) => {
                    setArrearsItemsPerPage(Number(val));
                    setArrearsCurrentPage(1);
                  }}
                  variant="pill"
                  size="xs"
                  colorScheme="slate"
                  portal={true}
                />
              </div>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                {/* Première page */}
                <button
                  type="button"
                  onClick={() => setArrearsCurrentPage(1)}
                  disabled={safeCurrentPage === 1}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer shadow-2xs"
                  title="Première page"
                >
                  <ChevronsLeft size={15} />
                </button>

                {/* Page précédente */}
                <button
                  type="button"
                  onClick={() => setArrearsCurrentPage(p => Math.max(1, p - 1))}
                  disabled={safeCurrentPage === 1}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer shadow-2xs"
                  title="Page précédente"
                >
                  <ChevronLeft size={15} />
                </button>

                {/* Numéros de page avec fenêtre dynamique */}
                <div className="flex items-center gap-1 mx-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(page => {
                      if (totalPages <= 7) return true;
                      if (page === 1 || page === totalPages) return true;
                      return Math.abs(page - safeCurrentPage) <= 1;
                    })
                    .reduce<(number | string)[]>((acc, page, index, arr) => {
                      if (index > 0 && (page as number) - (arr[index - 1] as number) > 1) {
                        acc.push('...');
                      }
                      acc.push(page);
                      return acc;
                    }, [])
                    .map((item, idx) => {
                      if (typeof item === 'string') {
                        return (
                          <span key={`ellipsis-${idx}`} className="px-1 text-xs font-bold text-slate-400">
                            ...
                          </span>
                        );
                      }
                      return (
                        <button
                          key={item}
                          type="button"
                          onClick={() => setArrearsCurrentPage(item as number)}
                          className={`min-w-[28px] h-7 px-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            safeCurrentPage === item
                              ? 'bg-indigo-600 text-white shadow-2xs font-black'
                              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 shadow-2xs'
                          }`}
                        >
                          {item}
                        </button>
                      );
                    })}
                </div>

                {/* Page suivante */}
                <button
                  type="button"
                  onClick={() => setArrearsCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={safeCurrentPage === totalPages}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer shadow-2xs"
                  title="Page suivante"
                >
                  <ChevronRight size={15} />
                </button>

                {/* Dernière page */}
                <button
                  type="button"
                  onClick={() => setArrearsCurrentPage(totalPages)}
                  disabled={safeCurrentPage === totalPages}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer shadow-2xs"
                  title="Dernière page"
                >
                  <ChevronsRight size={15} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderHistoryTab = () => {
    // All paid slips in current campus
    const allPaidSlips = slips.filter(s => s.status === 'PAID' && isSlipInCampus(s, effectiveCampusId));
    
    // Global KPI metrics
    const totalPaidGlobal = allPaidSlips.reduce((sum, s) => sum + s.net_salary, 0);
    const totalPaidCount = allPaidSlips.length;
    const averagePayment = totalPaidCount > 0 ? Math.round(totalPaidGlobal / totalPaidCount) : 0;

    // Distinct periods for filter dropdown
    const distinctPeriods = Array.from(new Set(allPaidSlips.map(s => s.period_id))).map(periodId => {
      const pObj = periods.find(p => p.id === periodId) || allPaidSlips.find(s => s.period_id === periodId)?.period;
      return {
        id: periodId,
        label: pObj ? getPeriodName(pObj) : 'Période inconnue'
      };
    });

    // Distinct payment methods for filter dropdown
    const distinctMethods = Array.from(new Set(allPaidSlips.map(s => s.payment_method).filter(Boolean))) as string[];

    // Filtering
    let paidSlips = [...allPaidSlips];

    if (searchTerm) {
      const q = searchTerm.toLowerCase().trim();
      paidSlips = paidSlips.filter(slip => 
        slip.staff?.first_name?.toLowerCase().includes(q) ||
        slip.staff?.last_name?.toLowerCase().includes(q) ||
        slip.staff?.role?.toLowerCase().includes(q) ||
        slip.payment_method?.toLowerCase().includes(q) ||
        slip.notes?.toLowerCase().includes(q) ||
        slip.paid_by_user?.full_name?.toLowerCase().includes(q) ||
        (slip.period && getPeriodName(slip.period).toLowerCase().includes(q))
      );
    }

    if (historyPeriodFilter !== 'ALL') {
      paidSlips = paidSlips.filter(slip => slip.period_id === historyPeriodFilter);
    }

    if (historyMethodFilter !== 'ALL') {
      paidSlips = paidSlips.filter(slip => slip.payment_method === historyMethodFilter);
    }

    // Sorting
    paidSlips.sort((a, b) => {
      if (historySortBy === 'date-desc') {
        return new Date(b.payment_date || 0).getTime() - new Date(a.payment_date || 0).getTime();
      }
      if (historySortBy === 'date-asc') {
        return new Date(a.payment_date || 0).getTime() - new Date(b.payment_date || 0).getTime();
      }
      if (historySortBy === 'amount-desc') {
        return b.net_salary - a.net_salary;
      }
      if (historySortBy === 'amount-asc') {
        return a.net_salary - b.net_salary;
      }
      if (historySortBy === 'name-asc') {
        const nameA = `${a.staff?.last_name || ''} ${a.staff?.first_name || ''}`;
        const nameB = `${b.staff?.last_name || ''} ${b.staff?.first_name || ''}`;
        return nameA.localeCompare(nameB);
      }
      return 0;
    });

    const filteredTotalPaid = paidSlips.reduce((sum, s) => sum + s.net_salary, 0);

    // Pagination calculations
    const totalPages = Math.max(1, Math.ceil(paidSlips.length / historyItemsPerPage));
    const safeCurrentPage = Math.min(historyCurrentPage, totalPages);
    const startIndex = (safeCurrentPage - 1) * historyItemsPerPage;
    const paginatedSlips = paidSlips.slice(startIndex, startIndex + historyItemsPerPage);

    return (
      <div className="space-y-3.5 sm:space-y-4 animate-in fade-in duration-300">
        {/* KPI DASHBOARD CARDS - SYNTHÈSE DES DÉCAISSEMENTS COMPACTE */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          {/* Total Décaissé */}
          <div className="bg-white p-3 sm:p-3.5 rounded-xl sm:rounded-2xl border border-emerald-100 shadow-2xs flex items-center justify-between hover:border-emerald-200 transition-all">
            <div>
              <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Décaissé (Paies)</p>
              <h4 className="text-lg sm:text-xl font-black text-emerald-600 mt-0.5 tabular-nums">
                {totalPaidGlobal.toLocaleString()} <span className="text-xs font-bold text-emerald-500">HTG</span>
              </h4>
              <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium mt-0.5">
                Sur {totalPaidCount} versement{totalPaidCount > 1 ? 's' : ''} enregistré{totalPaidCount > 1 ? 's' : ''}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100/80 flex items-center justify-center text-emerald-600 shrink-0">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>

          {/* Nombre de Versements */}
          <div className="bg-white p-3 sm:p-3.5 rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between hover:border-indigo-200 transition-all">
            <div>
              <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider">Versements Effectués</p>
              <h4 className="text-lg sm:text-xl font-black text-slate-900 mt-0.5 tabular-nums">
                {totalPaidCount} <span className="text-xs font-bold text-slate-500">bulletin{totalPaidCount > 1 ? 's' : ''}</span>
              </h4>
              <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium mt-0.5">Salaires réglés et archivés</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100/80 flex items-center justify-center text-indigo-600 shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          {/* Moyenne par versement */}
          <div className="bg-white p-3 sm:p-3.5 rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between hover:border-blue-200 transition-all">
            <div>
              <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider">Moyenne par Versement</p>
              <h4 className="text-lg sm:text-xl font-black text-blue-600 mt-0.5 tabular-nums">
                {averagePayment.toLocaleString()} <span className="text-xs font-bold text-blue-500">HTG</span>
              </h4>
              <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium mt-0.5">Salaire net moyen versé</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100/80 flex items-center justify-center text-blue-600 shrink-0">
              <BarChart3 className="w-5 h-5" />
            </div>
          </div>

          {/* Périodes couvertes */}
          <div className="bg-white p-3 sm:p-3.5 rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between hover:border-amber-200 transition-all">
            <div>
              <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider">Périodes Couvertes</p>
              <h4 className="text-lg sm:text-xl font-black text-amber-600 mt-0.5 tabular-nums">
                {distinctPeriods.length} <span className="text-xs font-bold text-amber-600">période{distinctPeriods.length > 1 ? 's' : ''}</span>
              </h4>
              <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium mt-0.5 truncate max-w-[140px] sm:max-w-[180px]">
                {distinctPeriods.map(p => p.label).slice(0, 2).join(', ')}{distinctPeriods.length > 2 ? '...' : ''}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100/80 flex items-center justify-center text-amber-600 shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* BARRE D'OUTILS MODERNE ADAPTATIVE SUR UNE SEULE LIGNE & ULTRA-RESPONSIVE */}
        <div className="bg-white p-2 sm:p-2.5 rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-2 sm:gap-2.5">
          {/* Groupe Filtres & Recherche : s'adapte sur une seule ligne fluide sans décrochage intempestif */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0 overflow-x-auto no-scrollbar py-0.5">
            {/* Recherche Pill avec largeur contrôlée et flexible */}
            <div className="relative w-full sm:w-44 md:w-48 lg:w-56 xl:w-64 shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Rechercher employé, rôle, mode..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setHistoryCurrentPage(1);
                }}
                className="w-full pl-8 pr-7 py-1.5 sm:py-2 bg-slate-50 hover:bg-slate-100/60 focus:bg-white border border-slate-200 rounded-full text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all shadow-2xs"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setHistoryCurrentPage(1);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-700 rounded-full transition-colors cursor-pointer"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Filtre par Période avec SelectPill */}
            {distinctPeriods.length > 0 && (
              <div className="shrink-0">
                <SelectPill
                  options={[
                    { value: 'ALL', label: `Toutes périodes (${distinctPeriods.length})`, icon: Calendar },
                    ...distinctPeriods.map(p => ({ value: p.id, label: p.label, icon: Calendar }))
                  ]}
                  value={historyPeriodFilter}
                  onChange={(val) => {
                    setHistoryPeriodFilter(val);
                    setHistoryCurrentPage(1);
                  }}
                  variant="pill"
                  size="sm"
                  colorScheme="slate"
                  icon={Calendar}
                  portal={true}
                />
              </div>
            )}

            {/* Filtre par Méthode de paiement avec SelectPill */}
            {distinctMethods.length > 0 && (
              <div className="shrink-0">
                <SelectPill
                  options={[
                    { value: 'ALL', label: `Tous les modes (${distinctMethods.length})`, icon: CreditCard },
                    ...distinctMethods.map(m => ({ value: m, label: m, icon: CreditCard }))
                  ]}
                  value={historyMethodFilter}
                  onChange={(val) => {
                    setHistoryMethodFilter(val);
                    setHistoryCurrentPage(1);
                  }}
                  variant="pill"
                  size="sm"
                  colorScheme="slate"
                  icon={CreditCard}
                  portal={true}
                />
              </div>
            )}

            {/* Tri avec SelectPill compact */}
            <div className="shrink-0">
              <SelectPill
                options={[
                  { value: 'date-desc', label: 'Date (Plus récent)', icon: ArrowUpDown },
                  { value: 'date-asc', label: 'Date (Plus ancien)', icon: ArrowUpDown },
                  { value: 'amount-desc', label: 'Montant (Plus élevé)', icon: ArrowUpDown },
                  { value: 'amount-asc', label: 'Montant (Plus faible)', icon: ArrowUpDown },
                  { value: 'name-asc', label: "Nom (A-Z)", icon: ArrowUpDown },
                ]}
                value={historySortBy}
                onChange={(val) => setHistorySortBy(val as any)}
                variant="pill"
                size="sm"
                colorScheme="slate"
                icon={ArrowUpDown}
                portal={true}
              />
            </div>
          </div>

          {/* Indicateur de total sélectionné & reset & bouton Audit */}
          <div className="flex items-center justify-between md:justify-end gap-2 shrink-0 pt-1.5 md:pt-0 border-t md:border-t-0 border-slate-100">
            {filteredTotalPaid > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50/80 border border-emerald-200/80 rounded-full text-xs font-bold text-emerald-800 whitespace-nowrap shrink-0">
                <span className="text-slate-400 font-medium hidden xl:inline">Total payé :</span>
                <span className="text-slate-400 font-medium xl:hidden">Total :</span>
                <strong className="text-emerald-700 tabular-nums">{filteredTotalPaid.toLocaleString()} HTG</strong>
              </div>
            )}

            <button
              type="button"
              onClick={handleOpenGlobalAudit}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/90 rounded-full text-xs font-bold transition-all shadow-2xs cursor-pointer whitespace-nowrap"
              title="Consulter l'historique complet d'audit et traçabilité des fiches de paie"
            >
              <History size={13} className="text-indigo-600" />
              <span>Traçabilité & Audit</span>
            </button>

            {(searchTerm || historyPeriodFilter !== 'ALL' || historyMethodFilter !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setHistoryPeriodFilter('ALL');
                  setHistoryMethodFilter('ALL');
                  setHistoryCurrentPage(1);
                }}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-full transition-all cursor-pointer inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap"
                title="Réinitialiser tous les filtres"
              >
                <RefreshCcw size={11} />
                <span className="hidden sm:inline">Effacer</span>
              </button>
            )}
          </div>
        </div>

        {/* TABLEAU DES PAIEMENTS COMPACT & ÉPURÉ */}
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xs border border-slate-200/80 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/90 border-b border-slate-200/80 text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-2.5 px-3 sm:px-4">Date & Heure</th>
                  <th className="py-2.5 px-3 sm:px-4">Employé</th>
                  <th className="py-2.5 px-3 sm:px-4">Période</th>
                  <th className="py-2.5 px-3 sm:px-4 text-right">Montant Net Payé</th>
                  <th className="py-2.5 px-3 sm:px-4">Mode de Règlement</th>
                  <th className="py-2.5 px-3 sm:px-4 text-center">Traité par</th>
                  <th className="py-2.5 px-3 sm:px-4 text-center">Audit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedSlips.map((slip) => {
                  const initials = `${slip.staff?.first_name?.charAt(0) || ''}${slip.staff?.last_name?.charAt(0) || ''}`;
                  const formattedName = formatStudentName(slip.staff?.last_name, slip.staff?.first_name).fullName;

                  // Méthode badge color
                  const methodStr = slip.payment_method || 'Espèces';
                  let methodBadgeClass = 'bg-slate-100 text-slate-700 border-slate-200';
                  if (methodStr.toLowerCase().includes('espèce')) {
                    methodBadgeClass = 'bg-emerald-50 text-emerald-800 border-emerald-200';
                  } else if (methodStr.toLowerCase().includes('chèque')) {
                    methodBadgeClass = 'bg-indigo-50 text-indigo-800 border-indigo-200';
                  } else if (methodStr.toLowerCase().includes('moncash')) {
                    methodBadgeClass = 'bg-rose-50 text-rose-800 border-rose-200';
                  } else if (methodStr.toLowerCase().includes('virement') || methodStr.toLowerCase().includes('transfert')) {
                    methodBadgeClass = 'bg-blue-50 text-blue-800 border-blue-200';
                  }

                  return (
                    <tr key={slip.id} className="hover:bg-slate-50/70 transition-colors group">
                      {/* Date & Heure */}
                      <td className="py-2.5 px-3 sm:px-4 whitespace-nowrap align-middle">
                        <div className="font-bold text-slate-800 flex items-center gap-1.5">
                          <Calendar size={12} className="text-slate-400" />
                          <span>{slip.payment_date ? new Date(slip.payment_date).toLocaleDateString('fr-FR') : '-'}</span>
                        </div>
                        {slip.payment_date && (
                          <div className="text-[10px] text-slate-400 font-medium pl-4.5">
                            {new Date(slip.payment_date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                      </td>

                      {/* Employé */}
                      <td className="py-2.5 px-3 sm:px-4 whitespace-nowrap align-middle">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 font-black text-xs flex items-center justify-center shrink-0">
                            {initials}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                              {formattedName}
                            </div>
                            <div className="text-[10px] sm:text-[11px] text-slate-500 font-medium">
                              {slip.staff?.role || 'Personnel'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Période */}
                      <td className="py-2.5 px-3 sm:px-4 whitespace-nowrap align-middle">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200/80 shadow-2xs">
                          <Calendar size={11} className="text-amber-600 shrink-0" />
                          <span>{slip.period ? getPeriodName(slip.period) : 'Période'}</span>
                        </span>
                      </td>

                      {/* Montant Net Payé */}
                      <td className="py-2.5 px-3 sm:px-4 text-right whitespace-nowrap align-middle">
                        <div className="font-black text-xs sm:text-sm text-emerald-600 tabular-nums">
                          {slip.net_salary.toLocaleString()} <span className="text-[10px] font-bold text-emerald-500">HTG</span>
                        </div>
                        {slip.deductions > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              if (slip.staff) {
                                setExpertAdvanceData({
                                  staff: slip.staff,
                                  slip: slip,
                                  advances: advances.filter(a => a.staff_id === slip.staff?.id)
                                });
                              }
                            }}
                            className="text-[9px] sm:text-[10px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-1.5 py-0.2 rounded border border-emerald-200 inline-flex items-center gap-1 cursor-pointer transition-colors"
                            title="Audit de l'avance déduite pour cette paie"
                          >
                            <HandCoins size={9} />
                            <span>Déduction : -{slip.deductions.toLocaleString()} G</span>
                            <Sparkles size={8} className="text-amber-500" />
                          </button>
                        )}
                      </td>

                      {/* Mode de Règlement & Référence */}
                      <td className="py-2.5 px-3 sm:px-4 align-middle">
                        <div className="flex flex-col gap-0.5">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.2 rounded-md text-[10px] sm:text-[11px] font-bold border w-fit shadow-2xs ${methodBadgeClass}`}>
                            <CreditCard size={10} />
                            <span>{methodStr}</span>
                          </span>
                          {slip.notes && (
                            <span className="text-[10px] text-slate-500 font-medium max-w-xs truncate" title={slip.notes}>
                              {slip.notes}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Traité par */}
                      <td className="py-2.5 px-3 sm:px-4 text-center whitespace-nowrap align-middle">
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-700 bg-indigo-50/80 border border-indigo-100 px-2 py-0.5 rounded-lg shadow-2xs">
                          <User size={11} className="text-indigo-500" />
                          <span>{slip.paid_by_user?.full_name || slip.paid_by || 'Système'}</span>
                        </span>
                      </td>

                      {/* Audit */}
                      <td className="py-2.5 px-3 sm:px-4 text-center whitespace-nowrap align-middle">
                        <button
                          type="button"
                          onClick={() => handleOpenAuditForSlip(slip, slip.staff)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-indigo-100 shadow-2xs"
                          title="Historique des modifications de cette fiche"
                        >
                          <History size={14} className="inline" />
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {paginatedSlips.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-10 px-4 text-center">
                      <div className="w-10 h-10 bg-slate-100 text-slate-400 rounded-xl flex items-center justify-center mx-auto mb-2">
                        <Clock className="w-5 h-5" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-800">
                        {allPaidSlips.length === 0 ? 'Aucun historique de paiement' : 'Aucun versement correspondant'}
                      </h4>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto mt-0.5">
                        {allPaidSlips.length === 0
                          ? 'Les paiements validés apparaîtront automatiquement dans ce journal d’historique.'
                          : 'Modifiez vos filtres ou termes de recherche pour afficher les enregistrements.'}
                      </p>
                      {(searchTerm || historyPeriodFilter !== 'ALL' || historyMethodFilter !== 'ALL') && (
                        <button
                          type="button"
                          onClick={() => {
                            setSearchTerm('');
                            setHistoryPeriodFilter('ALL');
                            setHistoryMethodFilter('ALL');
                            setHistoryCurrentPage(1);
                          }}
                          className="mt-2.5 px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-full transition-all cursor-pointer inline-flex items-center gap-1"
                        >
                          <RefreshCcw size={11} />
                          Réinitialiser les filtres
                        </button>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* BARRE DE PAGINATION MODERNE COMPACTE AVEC SELECTPILL */}
          {paidSlips.length > 0 && (
            <div className="px-3.5 sm:px-5 py-2.5 bg-white border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs">
              <div className="flex flex-wrap items-center justify-between sm:justify-start gap-2.5 w-full sm:w-auto text-slate-600 font-medium">
                <span>
                  Affichage de <strong className="text-slate-900">{paidSlips.length === 0 ? 0 : (safeCurrentPage - 1) * historyItemsPerPage + 1}</strong> à <strong className="text-slate-900">{Math.min(safeCurrentPage * historyItemsPerPage, paidSlips.length)}</strong> sur <strong className="text-slate-900">{paidSlips.length}</strong> versement{paidSlips.length > 1 ? 's' : ''}
                </span>

                {/* Sélecteur de pagination avec SelectPill */}
                <div className="flex items-center gap-1.5 pl-2 sm:border-l sm:border-slate-200">
                  <span className="text-slate-500 text-[11px]">Afficher :</span>
                  <SelectPill
                    options={[
                      { value: '10', label: '10 / page' },
                      { value: '15', label: '15 / page' },
                      { value: '25', label: '25 / page' },
                      { value: '50', label: '50 / page' },
                      { value: '100', label: '100 / page' },
                    ]}
                    value={historyItemsPerPage.toString()}
                    onChange={(val) => {
                      setHistoryItemsPerPage(Number(val));
                      setHistoryCurrentPage(1);
                    }}
                    variant="pill"
                    size="xs"
                    colorScheme="slate"
                    portal={true}
                  />
                </div>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  {/* Première page */}
                  <button
                    type="button"
                    onClick={() => setHistoryCurrentPage(1)}
                    disabled={safeCurrentPage === 1}
                    className="p-1 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer shadow-2xs"
                    title="Première page"
                  >
                    <ChevronsLeft size={14} />
                  </button>

                  {/* Page précédente */}
                  <button
                    type="button"
                    onClick={() => setHistoryCurrentPage(p => Math.max(1, p - 1))}
                    disabled={safeCurrentPage === 1}
                    className="p-1 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer shadow-2xs"
                    title="Page précédente"
                  >
                    <ChevronLeft size={14} />
                  </button>

                  {/* Numéros de page avec fenêtre dynamique */}
                  <div className="flex items-center gap-1 mx-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(page => {
                        if (totalPages <= 7) return true;
                        if (page === 1 || page === totalPages) return true;
                        return Math.abs(page - safeCurrentPage) <= 1;
                      })
                      .reduce<(number | string)[]>((acc, page, index, arr) => {
                        if (index > 0 && (page as number) - (arr[index - 1] as number) > 1) {
                          acc.push('...');
                        }
                        acc.push(page);
                        return acc;
                      }, [])
                      .map((item, idx) => {
                        if (typeof item === 'string') {
                          return (
                            <span key={`ellipsis-${idx}`} className="px-1 text-xs font-bold text-slate-400">
                              ...
                            </span>
                          );
                        }
                        return (
                          <button
                            key={item}
                            type="button"
                            onClick={() => setHistoryCurrentPage(item as number)}
                            className={`min-w-[26px] h-6 px-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              safeCurrentPage === item
                                ? 'bg-indigo-600 text-white shadow-2xs font-black'
                                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 shadow-2xs'
                            }`}
                          >
                            {item}
                          </button>
                        );
                      })}
                  </div>

                  {/* Page suivante */}
                  <button
                    type="button"
                    onClick={() => setHistoryCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={safeCurrentPage === totalPages}
                    className="p-1 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer shadow-2xs"
                    title="Page suivante"
                  >
                    <ChevronRight size={14} />
                  </button>

                  {/* Dernière page */}
                  <button
                    type="button"
                    onClick={() => setHistoryCurrentPage(totalPages)}
                    disabled={safeCurrentPage === totalPages}
                    className="p-1 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer shadow-2xs"
                    title="Dernière page"
                  >
                    <ChevronsRight size={14} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderAdvancesTab = () => {
    const filteredAdvances = advances.filter(a => {
      const matchSearch = a.staff?.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.staff?.last_name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCampus = !effectiveCampusId || a.staff?.campus_id === effectiveCampusId || a.campus_id === effectiveCampusId;
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
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 pointer-events-none" />
            <input
              type="text"
              placeholder="Rechercher un employé..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-8 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-bold text-slate-950 placeholder:text-slate-600 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition-all shadow-2xs"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 rounded-md transition-colors cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
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
      const periodSlips = slips.filter(s => s.period_id === p.id && isSlipInCampus(s, effectiveCampusId));
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

    const activeCampus = effectiveCampusId ? campuses?.find(c => c.id === effectiveCampusId) : null;

    const getStaffCampusName = (member?: StaffMember | null, campusId?: string | null) => {
      const cId = campusId || member?.campus_id;
      if (!cId) return activeCampus ? activeCampus.name : 'Toutes les Annexes (Réseau)';
      const found = campuses?.find(c => c.id === cId);
      return found ? found.name : 'Annexe';
    };

    // All bonus recipients across all periods for quick auditing
    const allBonusRecipients = slips
      .filter(s => (s.bonuses || 0) > 0 && isSlipInCampus(s, effectiveCampusId))
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

      slips.filter(s => isSlipInCampus(s, effectiveCampusId)).forEach(s => {
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
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600" />
                                    <input
                                      type="text"
                                      placeholder="Filtrer par nom ou rôle..."
                                      value={periodSearchTerm}
                                      onChange={(e) => setPeriodSearchTerm(e.target.value)}
                                      className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-950 placeholder:text-slate-500 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
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
                                              <td className="px-4 py-3 text-right font-mono font-black text-slate-950">
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
    <div className="space-y-4 sm:space-y-5 relative">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-4 right-4 z-[100] flex items-center gap-2 px-3.5 py-2.5 rounded-xl shadow-lg text-white text-xs sm:text-sm font-medium animate-in slide-in-from-bottom-5 ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
          {toast.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span className="font-medium">{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 hover:opacity-80 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Gestion Payroll</h1>
            {hasMultipleCampuses && (
              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                <Building2 className="w-3 h-3 text-indigo-600" />
                Multi-Annexes
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">Préparez les salaires, gérez les arriérés et suivez les paiements.</p>
        </div>

        {/* Multi-Tenant / Campus Selector Header avec RBAC */}
        {hasMultipleCampuses && (
          <div className="flex items-center gap-2 w-full sm:w-auto self-stretch sm:self-auto justify-between sm:justify-end">
            {isAnnexeAdmin ? (
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-950 rounded-xl text-xs font-bold shadow-2xs">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <Building2 className="w-3.5 h-3.5 text-indigo-700 shrink-0" />
                <span>Accès restreint à l'annexe :</span>
                <span className="px-2 py-0.5 rounded-md bg-white border border-indigo-200 text-indigo-900 font-extrabold">
                  {getCampusName(user.campus_id)}
                </span>
                <span className="text-[10px] text-indigo-700/80 font-normal hidden lg:inline">
                  (Contrôle RBAC Annexe)
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap sm:flex-nowrap">
                {isSuperUser && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-black bg-purple-50 text-purple-700 border border-purple-200 shadow-2xs shrink-0">
                    <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                    <span>Super-Utilisateur</span>
                  </span>
                )}
                <span className="text-xs font-bold text-slate-600 whitespace-nowrap flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="hidden md:inline">Filtrer par</span> Annexe :
                </span>
                <div className="min-w-[170px] sm:min-w-[210px]">
                  <SelectPill
                    options={[
                      { value: 'ALL', label: '🌍 Toutes les Annexes (Réseau)' },
                      ...(campuses || []).map(c => ({ value: c.id, label: `📍 ${c.name}` }))
                    ]}
                    value={selectedCampusFilter}
                    onChange={(val) => {
                      setSelectedCampusFilter(val);
                      setCurrentCampusId(val !== 'ALL' ? val : null);
                    }}
                    variant="pill"
                    size="sm"
                    colorScheme="indigo"
                    portal={true}
                    className="w-full"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* BANNIÈRE D'ALERTE EN TEMPS RÉEL - MODIFICATIONS SENSIBLES */}
      {recentSensitiveAlerts.length > 0 && !isAlertsBannerDismissed && (
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-50/70 to-rose-500/10 border border-amber-200/90 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs animate-in fade-in duration-200">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-xs sm:text-sm font-black text-amber-950">
                  {recentSensitiveAlerts.length} modification{recentSensitiveAlerts.length > 1 ? 's sensibles récentes' : ' sensible récente'} détectée{recentSensitiveAlerts.length > 1 ? 's' : ''}
                </h4>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-200/80 text-amber-900 border border-amber-300">
                  Alerte Direction
                </span>
              </div>
              <p className="text-xs text-amber-900/80 mt-0.5">
                Dernière alerte : {recentSensitiveAlerts[0]?.details?.summary || recentSensitiveAlerts[0]?.details?.staff_name || 'Ajustement de salaire'}
                {recentSensitiveAlerts[0]?.profiles?.full_name ? ` par ${recentSensitiveAlerts[0].profiles.full_name}` : ''}.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            <button
              type="button"
              onClick={() => {
                setActiveTab('audit');
              }}
              className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <History className="w-3.5 h-3.5" />
              <span>Consulter le journal</span>
            </button>
            <button
              type="button"
              onClick={() => setIsAlertsBannerDismissed(true)}
              className="p-1.5 text-amber-700/70 hover:text-amber-900 rounded-lg hover:bg-amber-100/60 transition-all cursor-pointer"
              title="Fermer cette notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div className="flex overflow-x-auto border-b border-slate-200 hide-scrollbar -mb-px">
        <button
          onClick={() => { setActiveTab('periods'); setSearchTerm(''); }}
          className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 font-bold text-xs sm:text-sm whitespace-nowrap border-b-2 transition-colors cursor-pointer ${
            activeTab === 'periods' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Périodes</span>
        </button>
        <button
          onClick={() => { setActiveTab('preparation'); setSearchTerm(''); }}
          className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 font-bold text-xs sm:text-sm whitespace-nowrap border-b-2 transition-colors cursor-pointer ${
            activeTab === 'preparation' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Préparation</span>
        </button>
        <button
          onClick={() => { setActiveTab('arrears'); setSearchTerm(''); }}
          className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 font-bold text-xs sm:text-sm whitespace-nowrap border-b-2 transition-colors cursor-pointer ${
            activeTab === 'arrears' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          <AlertCircle className="w-4 h-4" />
          <span>Arriérés & Paiements</span>
          {slips.filter(s => s.status === 'UNPAID' && isSlipInCampus(s, effectiveCampusId)).length > 0 && (
            <span className="ml-1 text-[10px] font-black px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
              {slips.filter(s => s.status === 'UNPAID' && isSlipInCampus(s, effectiveCampusId)).length}
            </span>
          )}
        </button>
        <button
          onClick={() => { setActiveTab('advances'); setSearchTerm(''); }}
          className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 font-bold text-xs sm:text-sm whitespace-nowrap border-b-2 transition-colors cursor-pointer ${
            activeTab === 'advances' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          <HandCoins className="w-4 h-4" />
          <span>Avances</span>
        </button>
        <button
          onClick={() => { setActiveTab('history'); setSearchTerm(''); setHistoryCurrentPage(1); }}
          className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 font-bold text-xs sm:text-sm whitespace-nowrap border-b-2 transition-colors cursor-pointer ${
            activeTab === 'history' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Historique</span>
          {slips.filter(s => s.status === 'PAID' && isSlipInCampus(s, effectiveCampusId)).length > 0 && (
            <span className="ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              {slips.filter(s => s.status === 'PAID' && isSlipInCampus(s, effectiveCampusId)).length}
            </span>
          )}
        </button>
        <button
          onClick={() => { setActiveTab('reports'); setSearchTerm(''); }}
          className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 font-bold text-xs sm:text-sm whitespace-nowrap border-b-2 transition-colors cursor-pointer ${
            activeTab === 'reports' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Rapports</span>
        </button>
        <button
          onClick={() => { setActiveTab('audit'); setSearchTerm(''); }}
          className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 font-bold text-xs sm:text-sm whitespace-nowrap border-b-2 transition-colors cursor-pointer ${
            activeTab === 'audit' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Journal d'audit</span>
          {recentSensitiveAlerts.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white flex items-center gap-1 animate-pulse">
              <ShieldAlert className="w-2.5 h-2.5" />
              <span>{recentSensitiveAlerts.length}</span>
            </span>
          )}
        </button>
      </div>

      <div className="mt-3 sm:mt-4">
        {activeTab === 'periods' && renderPeriodsTab()}
        {activeTab === 'preparation' && renderPreparationTab()}
        {activeTab === 'arrears' && renderArrearsTab()}
        {activeTab === 'advances' && renderAdvancesTab()}
        {activeTab === 'history' && renderHistoryTab()}
        {activeTab === 'reports' && renderReportsTab()}
        {activeTab === 'audit' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <PayrollAuditModal
              embedded={true}
              schoolId={user.school_id}
              currentUser={user}
              allPeriods={periods}
            />
          </div>
        )}
      </div>

      {/* Modal Nouvelle Période Harmonisé & Compact */}
      {showPeriodModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-200/90 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center px-4 py-3 sm:px-5 sm:py-3.5 border-b border-slate-100 bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-2xs shrink-0">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-sm sm:text-base text-slate-900 tracking-tight leading-tight">
                    Nouvelle Période de Paie
                  </h3>
                  <p className="text-[10px] sm:text-[11px] font-semibold text-slate-500">
                    Ouvrir un nouveau cycle mensuel
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => { setShowPeriodModal(false); setModalError(null); setModalSuccess(false); }} 
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            {modalSuccess ? (
              <div className="p-6 sm:p-8 text-center space-y-3.5 animate-in zoom-in-95 duration-300">
                <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-2 shadow-2xs">
                  <CheckCircle className="w-8 h-8" />
                </div>
                <h4 className="text-lg font-black text-slate-900">Période Créée !</h4>
                <p className="text-xs sm:text-sm text-slate-500">La période de paie a été configurée avec succès. Vous allez être redirigé vers la préparation.</p>
                <button
                  onClick={() => { setShowPeriodModal(false); setModalSuccess(false); setActiveTab('preparation'); }}
                  className="w-full py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-xs sm:text-sm hover:bg-emerald-700 transition-all shadow-xs active:scale-98 cursor-pointer"
                >
                  Continuer
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreatePeriod} className="p-3.5 sm:p-4.5 space-y-3 sm:space-y-3.5">
                {modalError && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200/80 rounded-xl flex items-start gap-2 text-rose-600 animate-in fade-in slide-in-from-top-1">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <p className="text-xs font-semibold">{modalError}</p>
                  </div>
                )}
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                  <div className="space-y-1 sm:space-y-1.5 min-w-0">
                    <label className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-700 block truncate">
                      Mois
                    </label>
                    <SelectPill
                      options={monthOptions}
                      value={String(newPeriodMonth)}
                      onChange={(val) => setNewPeriodMonth(Number(val))}
                      icon={Calendar}
                      variant="field"
                      size="sm"
                      colorScheme="blue"
                      placeholder="Mois..."
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-1 sm:space-y-1.5 min-w-0">
                    <label className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-700 block truncate">
                      Année
                    </label>
                    <input
                      type="number"
                      value={newPeriodYear}
                      onChange={(e) => setNewPeriodYear(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl text-xs sm:text-sm font-bold text-slate-900 bg-white outline-none transition-all shadow-2xs"
                      required
                      min="2020"
                      max="2050"
                      disabled={modalLoading}
                    />
                  </div>
                </div>

                {hasMultipleCampuses && (
                  <div className="space-y-1 sm:space-y-1.5 min-w-0 pt-1">
                    <label className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-700 block truncate">
                      Annexe / Campus concerné
                    </label>
                    {isAnnexeAdmin ? (
                      <div className="flex items-center gap-2 p-2.5 bg-indigo-50/80 border border-indigo-200/80 rounded-xl text-xs text-indigo-950 font-bold">
                        <Building2 className="w-4 h-4 text-indigo-600 shrink-0" />
                        <span>{getCampusName(user.campus_id)}</span>
                        <span className="text-[10px] text-indigo-700 ml-auto font-medium">Verrouillé à votre annexe (RBAC)</span>
                      </div>
                    ) : (
                      <SelectPill
                        options={[
                          { value: 'ALL', label: '🌍 Toutes les Annexes (Réseau complet)' },
                          ...(campuses || []).map(c => ({ value: c.id, label: `📍 ${c.name}` }))
                        ]}
                        value={newPeriodCampusId}
                        onChange={(val) => setNewPeriodCampusId(val)}
                        icon={Building2}
                        variant="field"
                        size="sm"
                        colorScheme="indigo"
                        className="w-full"
                      />
                    )}
                  </div>
                )}
                <div className="pt-2.5 sm:pt-3 border-t border-slate-100 flex items-center justify-end gap-2 sm:gap-2.5">
                  <button
                    type="button"
                    onClick={() => { setShowPeriodModal(false); setModalError(null); }}
                    className="px-3.5 py-2 text-xs sm:text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                    disabled={modalLoading}
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={modalLoading}
                    className="px-4 py-2 sm:py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white rounded-xl font-bold text-xs sm:text-sm transition-all shadow-xs hover:shadow flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  >
                    {modalLoading ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                    <span>Créer la période</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal Paiement Harmonisé & Compact Responsive */}
      {showPaymentModal && selectedSlip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-200/90 overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header Compact */}
            <div className="flex justify-between items-center px-4 py-3 sm:px-5 sm:py-3.5 border-b border-emerald-100 bg-gradient-to-r from-emerald-50 via-teal-50/50 to-white">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-2xs shrink-0">
                  <DollarSign className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-sm sm:text-base text-emerald-950 tracking-tight leading-tight">
                    Enregistrer un Paiement
                  </h3>
                  <p className="text-[10px] sm:text-[11px] font-semibold text-emerald-700/80">
                    Règlement du salaire individuel
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleProcessPayment} className="p-3.5 sm:p-4.5 space-y-3 sm:space-y-3.5">
              {/* Carte Employé Compacte */}
              <div className="bg-slate-50/90 p-3 sm:p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider">Employé Bénéficiaire</span>
                  {selectedSlip.staff?.role && (
                    <span className="text-[10px] font-bold text-slate-600 bg-slate-200/70 px-2 py-0.5 rounded-md">
                      {selectedSlip.staff.role}
                    </span>
                  )}
                </div>
                <p className="font-black text-sm sm:text-base text-slate-900 mt-0.5 truncate">
                  {formatStudentName(selectedSlip.staff?.last_name, selectedSlip.staff?.first_name).fullName}
                </p>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200/70">
                  <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                    <Calendar size={13} className="text-blue-600 shrink-0" />
                    <span>Période : {selectedSlip.period ? getPeriodName(selectedSlip.period) : 'N/A'}</span>
                  </span>
                  <span className="font-black text-sm sm:text-base text-emerald-600 tabular-nums">
                    {selectedSlip.net_salary.toLocaleString()} <span className="text-xs font-bold text-emerald-500">HTG</span>
                  </span>
                </div>
              </div>

              {/* Avertissements & Alertes Déductions */}
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
                      <div className="bg-rose-50 border border-rose-200/80 p-2.5 sm:p-3 rounded-xl flex items-start gap-2.5 animate-in fade-in slide-in-from-top-2 duration-300">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-rose-800">Attention : Écart de déduction</p>
                          <p className="text-[10px] sm:text-[11px] text-rose-700 mt-0.5 leading-snug">
                            Cette fiche déduit {selectedSlip.deductions.toLocaleString()} HTG, mais l'employé a {totalCurrentAdvanceAmount.toLocaleString()} HTG d'avances approuvées avant préparation.
                          </p>
                          <p className="text-[10px] font-bold text-rose-900 mt-1.5 uppercase tracking-wider">
                            Synchronisez la déduction dans l'onglet "Préparation" si nécessaire.
                          </p>
                        </div>
                      </div>
                    )}
                    
                    {totalFutureAdvanceAmount > 0 && (
                      <div className="bg-blue-50 border border-blue-200/80 p-2.5 sm:p-3 rounded-xl flex items-start gap-2.5">
                        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-blue-800">Avance reportée</p>
                          <p className="text-[10px] sm:text-[11px] text-blue-700 mt-0.5 leading-snug">
                            Avance de {totalFutureAdvanceAmount.toLocaleString()} HTG approuvée après la paie (déduite au cycle suivant).
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Méthode de paiement harmonisée avec SelectPill */}
              <div className="space-y-1 sm:space-y-1.5">
                <label className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-700 block">
                  Méthode de paiement
                </label>
                <SelectPill
                  options={payrollPaymentMethodOptions}
                  value={paymentMethod}
                  onChange={(val) => {
                    setPaymentMethod(val);
                    if (val !== 'Chèque') {
                      setPaymentBank('');
                      setPaymentRefNumber('');
                      setPaymentRefError(null);
                    }
                  }}
                  icon={CreditCard}
                  variant="field"
                  size="md"
                  colorScheme="blue"
                  placeholder="Sélectionner le mode..."
                  className="w-full"
                />
              </div>

              {/* Champs conditionnels Chèque Bancaire */}
              {paymentMethod === 'Chèque' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 pt-0.5">
                  <div className="space-y-1 sm:space-y-1.5 min-w-0">
                    <label className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-700 block truncate" title="Banque émettrice">
                      Banque émettrice
                    </label>
                    <SelectPill
                      options={bankOptions}
                      value={paymentBank}
                      onChange={(val) => {
                        setPaymentBank(val);
                        if (paymentRefNumber) verifyPayrollReference(paymentRefNumber, false, val);
                      }}
                      icon={Building2}
                      variant="field"
                      size="sm"
                      colorScheme="blue"
                      placeholder="Choisir banque..."
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-1 sm:space-y-1.5 min-w-0">
                    <label className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-700 block truncate" title="Numéro du chèque">
                      Numéro du chèque
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={paymentRefNumber}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPaymentRefNumber(val);
                          verifyPayrollReference(val, false, paymentBank);
                        }}
                        className={`w-full px-3 py-2 border ${paymentRefError ? 'border-rose-500 focus:ring-rose-500' : 'border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'} rounded-xl text-xs sm:text-sm font-bold text-slate-900 bg-white outline-none transition-all shadow-2xs`}
                        required
                        placeholder="Ex: 004589"
                      />
                      {isCheckingPaymentRef && <RefreshCcw className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400 w-3.5 h-3.5" />}
                    </div>
                    {paymentRefError && <p className="text-[10px] font-semibold text-rose-600 mt-0.5">{paymentRefError}</p>}
                  </div>
                </div>
              )}

              {/* Notes / Référence additionnelle */}
              {paymentMethod !== 'Chèque' && (
                <div className="space-y-1 sm:space-y-1.5">
                  <label className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-700 block">
                    {paymentMethod === 'MonCash' ? 'Référence Transaction MonCash (Optionnel)' : 'Notes / Référence (Optionnel)'}
                  </label>
                  <textarea
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl text-xs sm:text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 bg-white shadow-2xs"
                    rows={2}
                    placeholder={paymentMethod === 'MonCash' ? 'Ex: Ref #MC-984210' : 'Informations ou observation sur le règlement...'}
                  />
                </div>
              )}

              {/* Actions de validation compactes */}
              <div className="pt-2.5 sm:pt-3 border-t border-slate-100 flex items-center justify-end gap-2 sm:gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-3.5 py-2 text-xs sm:text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={loading || (paymentMethod === 'Chèque' && (!!paymentRefError || !paymentRefNumber || !paymentBank))}
                  className="px-4 py-2 sm:py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl font-bold text-xs sm:text-sm transition-all shadow-xs hover:shadow flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Confirmer le paiement</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Demande d'Avance Harmonisé & Compact Responsive */}
      {showAdvanceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-200/90 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center px-4 py-3 sm:px-5 sm:py-3.5 border-b border-slate-100 bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-2xs shrink-0">
                  <HandCoins className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-sm sm:text-base text-slate-900 tracking-tight leading-tight">
                    Nouvelle Demande d'Avance
                  </h3>
                  <p className="text-[10px] sm:text-[11px] font-semibold text-slate-500">
                    Acompte ou prêt sur salaire
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setShowAdvanceModal(false)} 
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleRequestAdvance} className="p-3.5 sm:p-4.5 space-y-3 sm:space-y-3.5">
              <div className="space-y-1 sm:space-y-1.5">
                <label className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-700 block">
                  Employé
                </label>
                <SelectPill
                  options={advanceStaffOptions}
                  value={advanceStaffId}
                  onChange={setAdvanceStaffId}
                  icon={User}
                  variant="field"
                  size="md"
                  colorScheme="blue"
                  placeholder="Sélectionner un employé..."
                  searchable={true}
                  className="w-full"
                />
                {advanceStaffId && (() => {
                  const activeAdvances = advances.filter(a => a.staff_id === advanceStaffId && ['PENDING', 'APPROVED', 'PAID'].includes(a.status));
                  if (activeAdvances.length > 0) {
                    const totalRemaining = activeAdvances.reduce((acc, a) => acc + a.amount, 0);
                    return (
                      <div className="mt-2 p-2.5 bg-amber-50 border border-amber-200/80 rounded-xl flex gap-2.5 text-amber-900">
                        <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-amber-950 leading-tight">Avance(s) existante(s)</p>
                          <p className="text-[10px] sm:text-[11px] font-medium text-amber-800 mt-0.5 leading-snug">
                            {activeAdvances.length} avance(s) en cours, reste total à payer : <strong>{totalRemaining.toLocaleString('fr-HT', { style: 'currency', currency: 'HTG' })}</strong>.
                          </p>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              <div className="space-y-1 sm:space-y-1.5">
                <label className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-700 block">
                  Montant (HTG)
                </label>
                <input
                  type="number"
                  value={advanceAmount || ''}
                  onChange={(e) => setAdvanceAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl text-xs sm:text-sm font-bold text-slate-900 bg-white outline-none transition-all shadow-2xs"
                  required
                  min="1"
                  placeholder="Ex: 5000"
                />
              </div>

              <div className="space-y-1 sm:space-y-1.5">
                <label className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-700 block">
                  Raison / Motif
                </label>
                <textarea
                  value={advanceReason}
                  onChange={(e) => setAdvanceReason(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl text-xs sm:text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 bg-white shadow-2xs"
                  rows={2}
                  placeholder="Ex: Urgence médicale, avance exceptionnelle..."
                  required
                />
              </div>

              <div className="pt-2.5 sm:pt-3 border-t border-slate-100 flex items-center justify-end gap-2 sm:gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAdvanceModal(false)}
                  className="px-3.5 py-2 text-xs sm:text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={!advanceStaffId || advanceAmount <= 0}
                  className="px-4 py-2 sm:py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white rounded-xl font-bold text-xs sm:text-sm transition-all shadow-xs hover:shadow flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <HandCoins className="w-4 h-4" />
                  <span>Enregistrer la demande</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Paiement Avance Harmonisé & Compact Responsive */}
      {showAdvancePaymentModal && selectedAdvance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-200/90 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center px-4 py-3 sm:px-5 sm:py-3.5 border-b border-blue-100 bg-gradient-to-r from-blue-50 via-indigo-50/50 to-white">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-2xs shrink-0">
                  <DollarSign className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-sm sm:text-base text-blue-950 tracking-tight leading-tight">
                    Payer l'Avance de Fonds
                  </h3>
                  <p className="text-[10px] sm:text-[11px] font-semibold text-blue-700/80">
                    Décaissement direct de trésorerie
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setShowAdvancePaymentModal(false)} 
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleProcessAdvancePayment} className="p-3.5 sm:p-4.5 space-y-3 sm:space-y-3.5">
              <div className="bg-slate-50/90 p-3 sm:p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider">Employé Bénéficiaire</span>
                  {selectedAdvance.staff?.role && (
                    <span className="text-[10px] font-bold text-slate-600 bg-slate-200/70 px-2 py-0.5 rounded-md">
                      {selectedAdvance.staff.role}
                    </span>
                  )}
                </div>
                <p className="font-black text-sm sm:text-base text-slate-900 mt-0.5 truncate">
                  {formatStudentName(selectedAdvance.staff?.last_name, selectedAdvance.staff?.first_name).fullName}
                </p>
                <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-200/70">
                  <span className="text-xs font-bold text-slate-600">Montant décaissé :</span>
                  <span className="font-black text-sm sm:text-base text-blue-600 tabular-nums">
                    {selectedAdvance.amount.toLocaleString()} <span className="text-xs font-bold text-blue-500">HTG</span>
                  </span>
                </div>
              </div>

              <div className="space-y-1 sm:space-y-1.5">
                <label className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-700 block">
                  Méthode de paiement
                </label>
                <SelectPill
                  options={payrollPaymentMethodOptions}
                  value={advancePaymentMethod}
                  onChange={(val) => {
                    setAdvancePaymentMethod(val);
                    if (val !== 'Chèque') {
                      setAdvancePaymentBank('');
                      setAdvancePaymentRefNumber('');
                      setAdvancePaymentRefError(null);
                    }
                  }}
                  icon={CreditCard}
                  variant="field"
                  size="md"
                  colorScheme="blue"
                  placeholder="Sélectionner le mode..."
                  className="w-full"
                />
              </div>

              {advancePaymentMethod === 'Chèque' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 pt-0.5">
                  <div className="space-y-1 sm:space-y-1.5 min-w-0">
                    <label className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-700 block truncate" title="Banque émettrice">
                      Banque émettrice
                    </label>
                    <SelectPill
                      options={bankOptions}
                      value={advancePaymentBank}
                      onChange={(val) => {
                        setAdvancePaymentBank(val);
                        if (advancePaymentRefNumber) verifyPayrollReference(advancePaymentRefNumber, true, val);
                      }}
                      icon={Building2}
                      variant="field"
                      size="sm"
                      colorScheme="blue"
                      placeholder="Choisir banque..."
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-1 sm:space-y-1.5 min-w-0">
                    <label className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-700 block truncate" title="Numéro du chèque">
                      Numéro du chèque
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={advancePaymentRefNumber}
                        onChange={(e) => {
                          const val = e.target.value;
                          setAdvancePaymentRefNumber(val);
                          verifyPayrollReference(val, true, advancePaymentBank);
                        }}
                        className={`w-full px-3 py-2 border ${advancePaymentRefError ? 'border-rose-500 focus:ring-rose-500' : 'border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'} rounded-xl text-xs sm:text-sm font-bold text-slate-900 bg-white outline-none transition-all shadow-2xs`}
                        required
                        placeholder="Ex: 004589"
                      />
                      {isCheckingAdvanceRef && <RefreshCcw className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400 w-3.5 h-3.5" />}
                    </div>
                    {advancePaymentRefError && <p className="text-[10px] font-semibold text-rose-600 mt-0.5">{advancePaymentRefError}</p>}
                  </div>
                </div>
              )}

              {advancePaymentMethod !== 'Chèque' && (
                <div className="space-y-1 sm:space-y-1.5">
                  <label className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-700 block">
                    {advancePaymentMethod === 'MonCash' ? 'ID Transaction MonCash' : 'Notes / Référence (Optionnel)'}
                  </label>
                  <textarea
                    value={advancePaymentNotes}
                    onChange={(e) => setAdvancePaymentNotes(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl text-xs sm:text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 bg-white shadow-2xs"
                    rows={2}
                    placeholder="Informations complémentaires..."
                    required={advancePaymentMethod === 'MonCash'}
                  />
                </div>
              )}

              <div className="pt-2.5 sm:pt-3 border-t border-slate-100 flex items-center justify-end gap-2 sm:gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAdvancePaymentModal(false)}
                  className="px-3.5 py-2 text-xs sm:text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={advancePaymentMethod === 'Chèque' && (!!advancePaymentRefError || !advancePaymentRefNumber || !advancePaymentBank)}
                  className="px-4 py-2 sm:py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white rounded-xl font-bold text-xs sm:text-sm transition-all shadow-xs hover:shadow flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Confirmer le paiement</span>
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

      {/* Modal Expert Paie - Audit Avances & Prêts */}
      {expertAdvanceData && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-amber-400">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-base sm:text-lg tracking-tight text-white">
                      Expert Paie — Audit des Avances & Prêts
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-300/30">
                      Audit Salarié
                    </span>
                  </div>
                  <p className="text-xs text-indigo-200 mt-0.5">
                    Consultation des retenues, avances accordées et historique des déductions
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setExpertAdvanceData(null)}
                className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content body */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
              {/* Profil Salarié Card */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-indigo-100 text-indigo-700 font-black text-sm flex items-center justify-center shrink-0 border border-indigo-200">
                    {expertAdvanceData.staff.first_name?.charAt(0)}{expertAdvanceData.staff.last_name?.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-black text-sm sm:text-base text-slate-900">
                      {formatStudentName(expertAdvanceData.staff.last_name, expertAdvanceData.staff.first_name).fullName}
                    </h4>
                    <p className="text-xs font-semibold text-slate-500">
                      Poste : <strong className="text-indigo-600">{expertAdvanceData.staff.role || 'Personnel'}</strong>
                    </p>
                  </div>
                </div>

                {/* Synthèse du bulletin associé */}
                {expertAdvanceData.slip && (
                  <div className="flex items-center gap-3 text-right bg-white px-3 py-2 rounded-xl border border-slate-200/70 shadow-2xs self-stretch sm:self-auto justify-between sm:justify-end">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bulletin actuel</p>
                      <p className="text-xs font-bold text-slate-700">
                        Brut: {expertAdvanceData.slip.base_salary.toLocaleString()} G
                      </p>
                    </div>
                    <div className="border-l border-slate-200 pl-3">
                      <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Avance retenue</p>
                      <p className="text-xs sm:text-sm font-black text-amber-700 tabular-nums">
                        -{expertAdvanceData.slip.deductions.toLocaleString()} HTG
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* KPIs Avances de l'employé */}
              {(() => {
                const advList = expertAdvanceData.advances || [];
                const totalGranted = advList
                  .filter(a => ['APPROVED', 'PAID', 'DEDUCTED'].includes(a.status))
                  .reduce((sum, a) => sum + a.amount, 0);
                const totalPending = advList
                  .filter(a => a.status === 'PENDING')
                  .reduce((sum, a) => sum + a.amount, 0);
                const totalPaidOut = advList
                  .filter(a => ['PAID', 'APPROVED'].includes(a.status))
                  .reduce((sum, a) => sum + a.amount, 0);

                return (
                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-2.5 sm:p-3 text-center">
                      <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">Avances / Prêts Validés</p>
                      <p className="text-sm sm:text-base font-black text-blue-800 mt-0.5 tabular-nums">
                        {totalGranted.toLocaleString()} <span className="text-[10px]">HTG</span>
                      </p>
                      <p className="text-[10px] text-blue-600 font-medium mt-0.5">{advList.filter(a => ['APPROVED', 'PAID', 'DEDUCTED'].includes(a.status)).length} demande(s)</p>
                    </div>

                    <div className="bg-amber-50/60 border border-amber-100 rounded-xl p-2.5 sm:p-3 text-center">
                      <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">En cours / Restant</p>
                      <p className="text-sm sm:text-base font-black text-amber-800 mt-0.5 tabular-nums">
                        {totalPaidOut.toLocaleString()} <span className="text-[10px]">HTG</span>
                      </p>
                      <p className="text-[10px] text-amber-600 font-medium mt-0.5">À déduire sur salaires</p>
                    </div>

                    <div className="bg-purple-50/60 border border-purple-100 rounded-xl p-2.5 sm:p-3 text-center">
                      <p className="text-[10px] font-bold text-purple-700 uppercase tracking-wider">En Attente Validation</p>
                      <p className="text-sm sm:text-base font-black text-purple-800 mt-0.5 tabular-nums">
                        {totalPending.toLocaleString()} <span className="text-[10px]">HTG</span>
                      </p>
                      <p className="text-[10px] text-purple-600 font-medium mt-0.5">{advList.filter(a => a.status === 'PENDING').length} en attente</p>
                    </div>
                  </div>
                );
              })()}

              {/* Tableau détaillé des avances */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <HandCoins size={14} className="text-indigo-600" />
                    Historique des avances & prêts accordés
                  </h5>
                  <span className="text-[11px] font-medium text-slate-500">
                    {(expertAdvanceData.advances || []).length} enregistrement(s)
                  </span>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                          <th className="py-2 px-3">Date Demande</th>
                          <th className="py-2 px-3">Motif</th>
                          <th className="py-2 px-3 text-right">Montant</th>
                          <th className="py-2 px-3 text-center">Statut</th>
                          <th className="py-2 px-3">Règlement / Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(expertAdvanceData.advances || []).map((adv) => {
                          let statusBadge = (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              <Clock size={10} /> En attente
                            </span>
                          );
                          if (adv.status === 'APPROVED') {
                            statusBadge = (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                <Check size={10} /> Approuvée
                              </span>
                            );
                          } else if (adv.status === 'PAID') {
                            statusBadge = (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle size={10} /> Payée
                              </span>
                            );
                          } else if (adv.status === 'DEDUCTED') {
                            statusBadge = (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                <CheckCircle2 size={10} /> Déduite
                              </span>
                            );
                          } else if (adv.status === 'REJECTED') {
                            statusBadge = (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                <Ban size={10} /> Rejetée
                              </span>
                            );
                          }

                          return (
                            <tr key={adv.id} className="hover:bg-slate-50/70 transition-colors">
                              <td className="py-2 px-3 whitespace-nowrap text-slate-700 font-semibold">
                                {adv.requested_at ? new Date(adv.requested_at).toLocaleDateString('fr-FR') : '-'}
                              </td>
                              <td className="py-2 px-3 text-slate-800 font-medium max-w-[180px] truncate" title={adv.reason}>
                                {adv.reason || 'Avance sur salaire'}
                              </td>
                              <td className="py-2 px-3 text-right font-black text-slate-900 tabular-nums">
                                {adv.amount.toLocaleString()} <span className="text-[10px] font-semibold text-slate-400">HTG</span>
                              </td>
                              <td className="py-2 px-3 text-center whitespace-nowrap">
                                {statusBadge}
                              </td>
                              <td className="py-2 px-3 text-slate-500 text-[11px] whitespace-nowrap">
                                {adv.payment_method ? (
                                  <span className="inline-flex items-center gap-1 text-slate-600 font-semibold">
                                    <CreditCard size={11} className="text-slate-400" />
                                    {adv.payment_method}
                                  </span>
                                ) : (
                                  <span>{adv.notes || '-'}</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}

                        {(!expertAdvanceData.advances || expertAdvanceData.advances.length === 0) && (
                          <tr>
                            <td colSpan={5} className="py-6 text-center text-slate-400 text-xs">
                              Aucune avance enregistrée pour cet employé.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setAdvanceStaffId(expertAdvanceData.staff.id);
                  setAdvanceAmount(0);
                  setAdvanceReason('');
                  setShowAdvanceModal(true);
                }}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <Plus size={14} />
                <span>Nouvelle avance pour ce salarié</span>
              </button>

              <button
                type="button"
                onClick={() => setExpertAdvanceData(null)}
                className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal d'audit ciblé (Fiche spécifique ou employé ciblé) */}
      {showPayrollAuditModal && (
        <PayrollAuditModal
          isOpen={showPayrollAuditModal}
          onClose={() => {
            setShowPayrollAuditModal(false);
            setAuditTargetSlip(null);
            setAuditTargetStaff(null);
          }}
          schoolId={user.school_id}
          currentUser={user}
          slip={auditTargetSlip}
          staffMember={auditTargetStaff}
          period={periods.find(p => p.id === auditTargetSlip?.period_id) || auditTargetSlip?.period || null}
          allPeriods={periods}
        />
      )}
    </div>
  );
};

export default PayrollManagementView;
