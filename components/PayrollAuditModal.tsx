import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabase';
import { UserProfile, PayrollSlip, StaffMember, PayrollPeriod } from '../types';
import { formatStudentName } from '../utils/formatters';
import { 
  History, X, User, Calendar, Clock, ShieldCheck, 
  ArrowRight, Search, Filter, Download, RefreshCw, 
  CheckCircle2, AlertCircle, ArrowUpRight, ArrowDownRight, 
  FileText, CreditCard, Building2, Eye, Sparkles, Check
} from 'lucide-react';

export interface PayrollAuditLogRecord {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: {
    type?: string;
    action_type?: string;
    slip_id?: string;
    staff_id?: string;
    staff_name?: string;
    staff_role?: string;
    period_id?: string;
    period_name?: string;
    period?: string;
    campus_id?: string | null;
    campus_name?: string | null;
    admin_name?: string;
    admin_email?: string;
    admin_role?: string;
    summary?: string;
    amount?: number;
    payment_method?: string;
    notes?: string;
    previous_values?: {
      base_salary?: number;
      bonuses?: number;
      deductions?: number;
      net_salary?: number;
    } | null;
    new_values?: {
      base_salary?: number;
      bonuses?: number;
      deductions?: number;
      net_salary?: number;
    } | null;
    diff?: {
      base_salary?: number;
      bonuses?: number;
      deductions?: number;
      net_salary?: number;
    } | null;
    changes_summary?: string[];
    [key: string]: any;
  };
  created_at: string;
  profiles: {
    full_name: string;
    email: string;
    role: string;
    campus_id: string | null;
  } | null;
}

interface PayrollAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  schoolId: string;
  currentUser: UserProfile;
  slip?: PayrollSlip | null;
  staffMember?: StaffMember | null;
  period?: PayrollPeriod | null;
  allPeriods?: PayrollPeriod[];
}

export const PayrollAuditModal: React.FC<PayrollAuditModalProps> = ({
  isOpen,
  onClose,
  schoolId,
  currentUser,
  slip,
  staffMember,
  period,
  allPeriods = []
}) => {
  const [logs, setLogs] = useState<PayrollAuditLogRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedAdminFilter, setSelectedAdminFilter] = useState<string>('ALL');
  const [selectedActionFilter, setSelectedActionFilter] = useState<string>('ALL');
  const [selectedPeriodFilter, setSelectedPeriodFilter] = useState<string>('ALL');
  const [viewScope, setViewScope] = useState<'SLIP' | 'GLOBAL'>(slip ? 'SLIP' : 'GLOBAL');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Sync initial scope if slip is provided
  useEffect(() => {
    if (slip) {
      setViewScope('SLIP');
    } else {
      setViewScope('GLOBAL');
    }
  }, [slip?.id]);

  useEffect(() => {
    if (isOpen) {
      fetchAuditLogs();
    }
  }, [isOpen, schoolId]);

  const fetchAuditLogs = async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      // Query audit logs joined with admin profile
      const { data, error } = await supabase
        .from('audit_logs')
        .select(`
          id,
          action,
          entity_type,
          entity_id,
          details,
          created_at,
          profiles:user_id(full_name, email, role, campus_id)
        `)
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false })
        .limit(400);

      if (error) throw error;

      // Filter to only records related to payroll
      const payrollLogs: PayrollAuditLogRecord[] = (data || []).filter((log: any) => {
        const d = log.details || {};
        const isPayrollType = d.type?.includes('payroll') || 
          log.entity_type === 'payroll_slip' || 
          log.entity_type === 'payroll_period' ||
          (log.action === 'PAYMENT_PROCESSED' && (d.type === 'payroll' || d.type === 'payroll_slip')) ||
          (log.action === 'UPDATE' && d.type === 'payroll_slip') ||
          (log.action === 'CREATE' && d.type === 'payroll_slip') ||
          (log.action === 'DELETE' && d.type?.includes('payroll')) ||
          log.action?.includes('PAYROLL');
        return isPayrollType;
      });

      setLogs(payrollLogs);
    } catch (err) {
      console.error('Erreur lors du chargement des logs d\'audit payroll:', err);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  // Distinct admins for filter dropdown
  const distinctAdmins = useMemo(() => {
    const adminMap = new Map<string, { id: string; name: string; role: string }>();
    logs.forEach(l => {
      const name = l.profiles?.full_name || l.details?.admin_name || 'Admin';
      const role = l.profiles?.role || l.details?.admin_role || '';
      if (!adminMap.has(name)) {
        adminMap.set(name, { id: name, name, role });
      }
    });
    return Array.from(adminMap.values());
  }, [logs]);

  // Target staff ID if focused on a single slip
  const targetStaffId = slip?.staff_id || staffMember?.id;
  const targetSlipId = slip?.id;

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const d = log.details || {};

      // Scope filtering
      if (viewScope === 'SLIP') {
        const matchesStaff = targetStaffId && (
          log.entity_id === targetStaffId || 
          d.staff_id === targetStaffId ||
          (targetSlipId && d.slip_id === targetSlipId)
        );
        if (!matchesStaff) return false;
      }

      // Search query (Staff name, admin name, notes)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const staffName = (d.staff_name || '').toLowerCase();
        const adminName = (log.profiles?.full_name || d.admin_name || '').toLowerCase();
        const summary = (d.summary || '').toLowerCase();
        const notes = (d.notes || '').toLowerCase();
        if (!staffName.includes(q) && !adminName.includes(q) && !summary.includes(q) && !notes.includes(q)) {
          return false;
        }
      }

      // Admin filter
      if (selectedAdminFilter !== 'ALL') {
        const adminName = log.profiles?.full_name || d.admin_name || '';
        if (adminName !== selectedAdminFilter) return false;
      }

      // Action filter
      if (selectedActionFilter !== 'ALL') {
        if (selectedActionFilter === 'UPDATE' && log.action !== 'UPDATE' && log.action !== 'PAYROLL_UPDATE') return false;
        if (selectedActionFilter === 'CREATE' && log.action !== 'CREATE' && log.action !== 'PAYROLL_CREATE') return false;
        if (selectedActionFilter === 'PAYMENT' && log.action !== 'PAYMENT_PROCESSED' && log.action !== 'PAYROLL_PAYMENT') return false;
        if (selectedActionFilter === 'DELETE' && log.action !== 'DELETE' && log.action !== 'PAYROLL_DELETE') return false;
      }

      // Period filter
      if (selectedPeriodFilter !== 'ALL') {
        const pId = d.period_id;
        const pName = d.period_name || d.period || '';
        if (pId !== selectedPeriodFilter && !pName.toLowerCase().includes(selectedPeriodFilter.toLowerCase())) {
          return false;
        }
      }

      return true;
    });
  }, [logs, viewScope, targetStaffId, targetSlipId, searchQuery, selectedAdminFilter, selectedActionFilter, selectedPeriodFilter]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportCSV = () => {
    if (filteredLogs.length === 0) return;

    const headers = [
      'Date & Heure',
      'Administrateur',
      'Rôle Admin',
      'Action',
      'Employé',
      'Période',
      'Salaire Base (Avant)',
      'Salaire Base (Après)',
      'Primes (Avant)',
      'Primes (Après)',
      'Déductions (Avant)',
      'Déductions (Après)',
      'Net Payé / Dû',
      'Mode Paiement',
      'Résumé'
    ];

    const rows = filteredLogs.map(l => {
      const d = l.details || {};
      const dateStr = new Date(l.created_at).toLocaleString('fr-FR');
      const adminName = l.profiles?.full_name || d.admin_name || 'Admin';
      const adminRole = l.profiles?.role || d.admin_role || '';
      const employee = d.staff_name || '';
      const periodName = d.period_name || d.period || '';
      const prev = d.previous_values || {};
      const next = d.new_values || {};

      return [
        `"${dateStr}"`,
        `"${adminName.replace(/"/g, '""')}"`,
        `"${adminRole}"`,
        `"${l.action}"`,
        `"${employee.replace(/"/g, '""')}"`,
        `"${periodName.replace(/"/g, '""')}"`,
        prev.base_salary ?? '',
        next.base_salary ?? '',
        prev.bonuses ?? '',
        next.bonuses ?? '',
        prev.deductions ?? '',
        next.deductions ?? '',
        next.net_salary ?? d.amount ?? '',
        `"${d.payment_method || ''}"`,
        `"${(d.summary || '').replace(/"/g, '""')}"`
      ].join(';');
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `audit-payroll-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getActionBadge = (log: PayrollAuditLogRecord) => {
    const { action, details } = log;
    if (action === 'PAYMENT_PROCESSED' || action === 'PAYROLL_PAYMENT' || details?.action_type === 'SLIP_PAID') {
      return {
        label: 'Paiement effectué',
        bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        icon: CheckCircle2,
        color: 'text-emerald-600'
      };
    }
    if (action === 'CREATE' || action === 'PAYROLL_CREATE' || details?.action_type === 'SLIP_CREATED') {
      return {
        label: 'Création de la fiche',
        bg: 'bg-indigo-50 text-indigo-800 border-indigo-200',
        icon: Sparkles,
        color: 'text-indigo-600'
      };
    }
    if (action === 'DELETE' || action === 'PAYROLL_DELETE') {
      return {
        label: details?.type === 'payroll_slip_duplicate_purge' ? 'Purge de doublon' : 'Suppression fiche',
        bg: 'bg-rose-50 text-rose-800 border-rose-200',
        icon: AlertCircle,
        color: 'text-rose-600'
      };
    }
    return {
      label: 'Modification de salaire',
      bg: 'bg-blue-50 text-blue-800 border-blue-200',
      icon: History,
      color: 'text-blue-600'
    };
  };

  const formatExactDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return isoStr;
    }
  };

  const formatRelativeTime = (isoStr: string) => {
    try {
      const now = new Date();
      const past = new Date(isoStr);
      const diffMs = now.getTime() - past.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return 'À l\'instant';
      if (diffMins < 60) return `Il y a ${diffMins} min`;
      if (diffHours < 24) return `Il y a ${diffHours}h`;
      if (diffDays === 1) return 'Hier';
      if (diffDays < 7) return `Il y a ${diffDays} jours`;
      return past.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    } catch {
      return '';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200/80 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER MODAL */}
        <div className="px-5 sm:px-6 py-4 sm:py-5 border-b border-slate-100 bg-slate-50/70 flex items-start sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 shadow-2xs">
              <History className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                  Traçabilité & Historique d'Audit Payroll
                </h3>
                {viewScope === 'SLIP' && targetStaffId && (
                  <span className="px-2.5 py-0.5 bg-indigo-100/80 text-indigo-800 text-xs font-black rounded-full border border-indigo-200/60">
                    Fiche ciblée
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">
                {viewScope === 'SLIP' && staffMember ? (
                  <span>Historique des modifications pour <strong className="text-slate-800">{formatStudentName(staffMember.last_name, staffMember.first_name).fullName}</strong></span>
                ) : (
                  <span>Registre complet des modifications et versements de paie par les administrateurs</span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {targetStaffId && (
              <div className="flex items-center bg-white border border-slate-200 p-0.5 rounded-xl shadow-2xs">
                <button
                  type="button"
                  onClick={() => setViewScope('SLIP')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    viewScope === 'SLIP' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Cette fiche
                </button>
                <button
                  type="button"
                  onClick={() => setViewScope('GLOBAL')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    viewScope === 'GLOBAL' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Toutes ({logs.length})
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={fetchAuditLogs}
              disabled={loading}
              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-slate-200"
              title="Rafraîchir"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* SUMMARY CARD IN TARGETED SLIP MODE */}
        {viewScope === 'SLIP' && staffMember && (
          <div className="px-5 sm:px-6 py-3 bg-gradient-to-r from-indigo-50/50 via-slate-50 to-white border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-black text-xs">
                {staffMember.first_name?.[0]}{staffMember.last_name?.[0]}
              </div>
              <div>
                <span className="text-xs font-black text-slate-900 block leading-tight">
                  {formatStudentName(staffMember.last_name, staffMember.first_name).fullName}
                </span>
                <span className="text-[11px] text-slate-500 font-semibold">
                  {staffMember.role} • {staffMember.pay_type}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs">
              {slip && (
                <div className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg shadow-2xs">
                  <span className="text-slate-400 font-medium mr-1.5">Net actuel :</span>
                  <strong className="text-slate-900 font-black">{slip.net_salary?.toLocaleString()} HTG</strong>
                </div>
              )}
              <div className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg shadow-2xs">
                <span className="text-slate-400 font-medium mr-1.5">Traces trouvées :</span>
                <strong className="text-indigo-600 font-black">{filteredLogs.length}</strong>
              </div>
            </div>
          </div>
        )}

        {/* TOOLBAR FILTRES (RESPONSIVE SUR UNE SEULE LIGNE FLUIDE) */}
        <div className="px-5 sm:px-6 py-2.5 bg-white border-b border-slate-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0 overflow-x-auto no-scrollbar py-0.5">
            {/* Recherche */}
            <div className="relative w-full sm:w-48 md:w-56 lg:w-64 shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Rechercher admin, employé..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 bg-slate-50 hover:bg-slate-100/60 focus:bg-white border border-slate-200 rounded-full text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all shadow-2xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-700 rounded-full"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Filtre par Administrateur */}
            {distinctAdmins.length > 1 && (
              <div className="shrink-0">
                <select
                  value={selectedAdminFilter}
                  onChange={(e) => setSelectedAdminFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-full text-xs font-bold text-slate-700 outline-none cursor-pointer"
                >
                  <option value="ALL">Tous les admins ({distinctAdmins.length})</option>
                  {distinctAdmins.map(admin => (
                    <option key={admin.id} value={admin.name}>{admin.name} ({admin.role || 'Admin'})</option>
                  ))}
                </select>
              </div>
            )}

            {/* Filtre par Action */}
            <div className="shrink-0">
              <select
                value={selectedActionFilter}
                onChange={(e) => setSelectedActionFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-full text-xs font-bold text-slate-700 outline-none cursor-pointer"
              >
                <option value="ALL">Toutes les actions</option>
                <option value="UPDATE">Modifications de salaire</option>
                <option value="PAYMENT">Versements / Paiements</option>
                <option value="CREATE">Créations de fiche</option>
                <option value="DELETE">Suppressions & Purges</option>
              </select>
            </div>
          </div>

          {/* Action Export CSV */}
          <div className="flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={filteredLogs.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-full text-xs font-bold transition-all shadow-2xs cursor-pointer disabled:opacity-50"
              title="Exporter les traces au format CSV"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Exporter CSV</span>
            </button>
          </div>
        </div>

        {/* CORPS DE LA TIMELINE D'AUDIT */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {loading ? (
            <div className="py-20 text-center">
              <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-xs font-bold text-slate-500">Chargement des traces d'audit sécurisées...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="py-16 text-center bg-slate-50/60 rounded-2xl border border-dashed border-slate-200 p-6">
              <ShieldCheck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <h4 className="text-sm font-bold text-slate-800">Aucune trace d'audit trouvée</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                {searchQuery || selectedAdminFilter !== 'ALL' || selectedActionFilter !== 'ALL'
                  ? "Aucune modification ne correspond aux critères de filtre sélectionnés."
                  : "Chaque enregistrement, réajustement salarial et paiement de fiche de paie sera automatiquement journalisé ici avec l'identité de l'administrateur."}
              </p>
            </div>
          ) : (
            <div className="relative pl-4 sm:pl-6 space-y-4 before:absolute before:left-2 sm:before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              {filteredLogs.map((log) => {
                const badge = getActionBadge(log);
                const BadgeIcon = badge.icon;
                const d = log.details || {};
                const adminName = log.profiles?.full_name || d.admin_name || 'Administrateur';
                const adminRole = log.profiles?.role || d.admin_role || 'Rôle non spécifié';
                const adminEmail = log.profiles?.email || d.admin_email || '';
                const staffName = d.staff_name || 'Collaborateur';
                const periodLabel = d.period_name || d.period || '';
                const prev = d.previous_values;
                const next = d.new_values;

                const hasDiff = prev && next;

                return (
                  <div key={log.id} className="relative group">
                    {/* POINT SUR LA LIGNE TEMPORELLE */}
                    <div className={`absolute -left-4 sm:-left-6 top-3.5 w-4 h-4 rounded-full bg-white border-2 border-slate-300 group-hover:border-indigo-600 transition-colors flex items-center justify-center`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${badge.color.replace('text-', 'bg-')}`} />
                    </div>

                    {/* CARTE D'AUDIT COMPLÈTE */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs hover:border-indigo-200 transition-all p-4 space-y-3">
                      {/* LIGNE 1 : ADMIN, ACTION & HORODATAGE */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                        {/* IDENTITÉ DE L'ADMINISTRATEUR */}
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-800 font-black text-xs flex items-center justify-center border border-slate-200 shrink-0">
                            {adminName.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-black text-slate-900 tracking-tight">
                                {adminName}
                              </span>
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-bold rounded-md border border-slate-200">
                                {adminRole}
                              </span>
                            </div>
                            {adminEmail && (
                              <span className="text-[11px] text-slate-600 font-semibold block leading-tight">
                                {adminEmail}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* HORODATAGE & BADGE D'ACTION */}
                        <div className="flex items-center gap-2 self-start sm:self-center flex-wrap">
                          <span className={`px-2.5 py-0.5 text-xs font-black rounded-full border inline-flex items-center gap-1.5 ${badge.bg}`}>
                            <BadgeIcon className="w-3.5 h-3.5" />
                            <span>{badge.label}</span>
                          </span>

                          <div className="flex items-center gap-1 text-[11px] font-bold text-slate-600 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-200" title={formatExactDate(log.created_at)}>
                            <Clock className="w-3 h-3 text-slate-500" />
                            <span>{formatRelativeTime(log.created_at)}</span>
                          </div>
                        </div>
                      </div>

                      {/* LIGNE 2 : CONTEXTE DE L'EMPLOYÉ ET PÉRIODE */}
                      <div className="flex items-center justify-between text-xs text-slate-600 flex-wrap gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900">
                            Employé : <strong className="text-indigo-950 font-black">{staffName}</strong>
                          </span>
                          {d.staff_role && (
                            <span className="text-slate-600 font-semibold">({d.staff_role})</span>
                          )}
                          {periodLabel && (
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-800 text-[11px] font-bold rounded border border-slate-200 flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-slate-600" />
                              <span>{periodLabel}</span>
                            </span>
                          )}
                          {d.campus_name && (
                            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[11px] font-bold rounded border border-indigo-200 flex items-center gap-1">
                              <Building2 className="w-3 h-3 text-indigo-500" />
                              <span>{d.campus_name}</span>
                            </span>
                          )}
                        </div>

                        <div className="text-[11px] text-slate-600 font-bold">
                          {formatExactDate(log.created_at)}
                        </div>
                      </div>

                      {/* LIGNE 3 : COMPARATIF CHIFFRÉ AVANT / APRÈS (DIFF) */}
                      {hasDiff ? (
                        <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200/80 space-y-2">
                          <div className="text-[11px] font-black text-slate-700 uppercase tracking-tight flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-indigo-500" />
                            <span>Détail des modifications de montants :</span>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {/* Salaire Base */}
                            <div className="bg-white p-2 rounded-lg border border-slate-200">
                              <span className="text-[10px] font-bold text-slate-600 block">Salaire Base</span>
                              <div className="flex items-center gap-1 mt-0.5 text-xs font-black">
                                <span className="text-slate-600 line-through">{(prev?.base_salary ?? 0).toLocaleString()}</span>
                                <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                                <span className="text-slate-900">{(next?.base_salary ?? 0).toLocaleString()}</span>
                              </div>
                            </div>

                            {/* Primes */}
                            <div className="bg-white p-2 rounded-lg border border-slate-200">
                              <span className="text-[10px] font-bold text-emerald-800 block">Primes</span>
                              <div className="flex items-center gap-1 mt-0.5 text-xs font-black">
                                <span className="text-slate-600 line-through">{(prev?.bonuses ?? 0).toLocaleString()}</span>
                                <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                                <span className="text-emerald-700">{(next?.bonuses ?? 0).toLocaleString()}</span>
                              </div>
                            </div>

                            {/* Déductions */}
                            <div className="bg-white p-2 rounded-lg border border-slate-200">
                              <span className="text-[10px] font-bold text-rose-800 block">Déductions</span>
                              <div className="flex items-center gap-1 mt-0.5 text-xs font-black">
                                <span className="text-slate-600 line-through">{(prev?.deductions ?? 0).toLocaleString()}</span>
                                <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                                <span className="text-rose-700">{(next?.deductions ?? 0).toLocaleString()}</span>
                              </div>
                            </div>

                            {/* Net à Payer */}
                            <div className="bg-indigo-50/50 p-2 rounded-lg border border-indigo-100">
                              <span className="text-[10px] font-black text-indigo-900 block">Net à Payer</span>
                              <div className="flex items-center gap-1 mt-0.5 text-xs font-black">
                                <span className="text-slate-600 line-through">{(prev?.net_salary ?? 0).toLocaleString()}</span>
                                <ArrowRight className="w-3 h-3 text-indigo-400 shrink-0" />
                                <span className="text-indigo-900">{(next?.net_salary ?? 0).toLocaleString()} HTG</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : d.amount ? (
                        <div className="bg-emerald-50/60 rounded-xl p-2.5 border border-emerald-100 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <CreditCard className="w-4 h-4 text-emerald-600" />
                            <span className="font-semibold text-emerald-900">
                              Montant versé : <strong className="font-black text-emerald-900">{d.amount.toLocaleString()} HTG</strong>
                              {d.payment_method && <span className="ml-1 text-slate-600">via {d.payment_method}</span>}
                            </span>
                          </div>
                          {d.notes && (
                            <span className="text-[11px] text-slate-600 italic">« {d.notes} »</span>
                          )}
                        </div>
                      ) : d.summary ? (
                        <div className="text-xs font-semibold text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-100">
                          {d.summary}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* PIED DE MODAL */}
        <div className="px-5 sm:px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Journal certifié conforme et inviolable</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs active:scale-95"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
