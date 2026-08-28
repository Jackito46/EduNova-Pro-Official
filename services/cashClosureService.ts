import { supabase, isValidUuid } from '../supabase';
import { getLocalTodayString } from '../utils/dateUtils';

export interface CashClosureBreakdown {
  scolarite_htg: number;
  scolarite_usd: number;
  inscription_htg: number;
  inscription_usd: number;
  fournitures_htg: number;
  fournitures_usd: number;
  autres_htg: number;
  autres_usd: number;
  by_method: Record<string, { htg: number; usd: number; count: number }>;
  by_expense_category?: Record<string, { htg: number; usd: number; count: number }>;
}

export type CashClosureBadgeType = 'ORIGINAL' | 'REOPENED' | 'MODIFIED' | 'PENDING';

export interface CashClosureAuditEntry {
  action: 'VALIDATED' | 'REOPENED' | 'MODIFIED';
  user_id?: string;
  user_name?: string;
  timestamp: string;
  reason?: string;
  notes?: string;
}

export interface CashClosureRecord {
  id?: string;
  school_id: string;
  campus_id?: string | null;
  closure_date: string; // YYYY-MM-DD
  status: 'OPEN' | 'PENDING' | 'VALIDATED';
  
  // Encaissements
  total_collections_htg: number;
  total_collections_usd: number;
  
  // Décaissements
  total_expenses_htg: number;
  total_expenses_usd: number;
  
  // Solde Net
  net_total_htg: number;
  net_total_usd: number;
  
  transaction_count: number;
  breakdown: CashClosureBreakdown;
  
  created_by?: string;
  created_by_name?: string;
  created_at?: string;
  
  validated_by?: string;
  validated_by_name?: string;
  validated_at?: string;
  
  // Traçabilité & Réouverture / Modification
  is_reopened?: boolean;
  is_modified?: boolean;
  reopen_count?: number;
  reopen_reason?: string;
  reopened_by?: string;
  reopened_by_name?: string;
  reopened_at?: string;
  audit_trail?: CashClosureAuditEntry[];
  
  notes?: string;
}

/**
 * Robust date matching helper that handles ISO strings, local timezone dates, and YYYY-MM-DD
 */
export function matchDateString(rawDate: any, targetDateString: string): boolean {
  if (!rawDate || !targetDateString) return false;
  
  const target = targetDateString.trim();

  // 1. Direct string equality or prefix
  if (typeof rawDate === 'string') {
    const trimmed = rawDate.trim();
    if (trimmed === target) return true;
    if (trimmed.startsWith(target)) return true;
    const splitPart = trimmed.split('T')[0];
    if (splitPart === target) return true;
  }
  
  // 2. Parse as Date object to test local calendar day and UTC day
  try {
    const d = new Date(rawDate);
    if (!isNaN(d.getTime())) {
      // Local time YYYY-MM-DD
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      if (`${year}-${month}-${day}` === target) return true;

      // UTC time YYYY-MM-DD
      const uYear = d.getUTCFullYear();
      const uMonth = String(d.getUTCMonth() + 1).padStart(2, '0');
      const uDay = String(d.getUTCDate()).padStart(2, '0');
      if (`${uYear}-${uMonth}-${uDay}` === target) return true;
    }
  } catch (e) {
    // ignore
  }

  return false;
}

/**
 * Determine the visual badge category and metadata for a cash closure record
 */
export function getCashClosureBadgeInfo(closure: Partial<CashClosureRecord> | null | undefined): {
  type: CashClosureBadgeType;
  label: string;
  sublabel: string;
  colorClass: string;
  borderClass: string;
  bgClass: string;
  textClass: string;
  dotClass: string;
  iconType: 'shield-check' | 'rotate-ccw' | 'file-edit' | 'clock';
} {
  if (!closure) {
    return {
      type: 'PENDING',
      label: 'En Cours',
      sublabel: 'Non clôturée',
      colorClass: 'text-slate-600',
      borderClass: 'border-slate-300 dark:border-slate-700',
      bgClass: 'bg-slate-100 dark:bg-slate-800',
      textClass: 'text-slate-700 dark:text-slate-300',
      dotClass: 'bg-slate-400',
      iconType: 'clock'
    };
  }

  // Check notes and flags for past reopening history
  const hasReopenHistory = 
    Boolean(closure.is_reopened) || 
    (Number(closure.reopen_count) > 0) || 
    Boolean(closure.reopen_reason) ||
    Boolean(closure.notes?.toLowerCase().includes('réouverture') || 
            closure.notes?.toLowerCase().includes('reouverture') || 
            closure.notes?.toLowerCase().includes('déverrouill') ||
            closure.notes?.toLowerCase().includes('deverrouill'));

  // 1. If currently OPEN / PENDING
  if (closure.status !== 'VALIDATED') {
    if (hasReopenHistory) {
      return {
        type: 'REOPENED',
        label: 'Caisse Réouverte',
        sublabel: closure.reopen_reason ? `Motif: ${closure.reopen_reason.slice(0, 45)}...` : 'Réouverte pour rectifications',
        colorClass: 'text-amber-700 dark:text-amber-300',
        borderClass: 'border-amber-300 dark:border-amber-700/60',
        bgClass: 'bg-amber-50 dark:bg-amber-950/60',
        textClass: 'text-amber-800 dark:text-amber-300',
        dotClass: 'bg-amber-500 animate-pulse',
        iconType: 'rotate-ccw'
      };
    }
    return {
      type: 'PENDING',
      label: 'En Attente de Clôture',
      sublabel: 'Journée en cours de saisie',
      colorClass: 'text-slate-600 dark:text-slate-400',
      borderClass: 'border-slate-300 dark:border-slate-700',
      bgClass: 'bg-slate-100 dark:bg-slate-800',
      textClass: 'text-slate-700 dark:text-slate-300',
      dotClass: 'bg-slate-400',
      iconType: 'clock'
    };
  }

  // 2. If VALIDATED / CLOSED
  if (closure.is_modified || hasReopenHistory) {
    return {
      type: 'MODIFIED',
      label: 'Clôture Modifiée',
      sublabel: 'Re-validée après réouverture et corrections',
      colorClass: 'text-purple-700 dark:text-purple-300',
      borderClass: 'border-purple-300 dark:border-purple-700/60',
      bgClass: 'bg-purple-50 dark:bg-purple-950/60',
      textClass: 'text-purple-800 dark:text-purple-300',
      dotClass: 'bg-purple-500',
      iconType: 'file-edit'
    };
  }

  // 3. Pure Original Closure
  return {
    type: 'ORIGINAL',
    label: 'Clôture Originale',
    sublabel: 'Certifiée initiale sans réouverture',
    colorClass: 'text-emerald-700 dark:text-emerald-300',
    borderClass: 'border-emerald-300 dark:border-emerald-700/60',
    bgClass: 'bg-emerald-50 dark:bg-emerald-950/60',
    textClass: 'text-emerald-800 dark:text-emerald-300',
    dotClass: 'bg-emerald-500',
    iconType: 'shield-check'
  };
}

const LOCAL_STORAGE_KEY = 'edunova_cash_closures';

/**
 * Helper to construct storage key for campus/school
 */
const getStorageKey = (schoolId: string) => `${LOCAL_STORAGE_KEY}_${schoolId}`;

/**
 * Fetch raw daily transaction totals & breakdown for a specific date (YYYY-MM-DD)
 */
export async function computeDailyTransactions(
  schoolId: string, 
  campusId: string | null | undefined, 
  dateString: string
) {
  let collectionsHTG = 0;
  let collectionsUSD = 0;

  let scolariteHTG = 0, scolariteUSD = 0;
  let inscriptionHTG = 0, inscriptionUSD = 0;
  let fournituresHTG = 0, fournituresUSD = 0;
  let autresHTG = 0, autresUSD = 0;

  const byMethod: Record<string, { htg: number; usd: number; count: number }> = {};
  const transactions: any[] = [];

  // Helper to add to byMethod
  const trackMethod = (method: string, currency: string, amount: number) => {
    const normMethod = method || 'Espèces / Cash';
    if (!byMethod[normMethod]) {
      byMethod[normMethod] = { htg: 0, usd: 0, count: 0 };
    }
    byMethod[normMethod].count += 1;
    if (currency === 'USD') {
      byMethod[normMethod].usd += amount;
    } else {
      byMethod[normMethod].htg += amount;
    }
  };

  // Helper student map cache
  const studentMap: Record<string, { full_name: string; code?: string; campus_id?: string }> = {};

  // 1. Fetch Students to resolve student names reliably without join failures
  try {
    const { data: studentsData } = await supabase
      .from('students')
      .select('id, first_name, last_name, code, campus_id')
      .eq('school_id', schoolId);

    if (studentsData) {
      studentsData.forEach((s: any) => {
        studentMap[s.id] = {
          full_name: `${s.first_name || ''} ${s.last_name || ''}`.trim() || 'Élève',
          code: s.code,
          campus_id: s.campus_id
        };
      });
    }
  } catch (err) {
    console.warn("Erreur chargement élèves pour clôture:", err);
  }

  // 2. Fetch Payments for this date
  try {
    const { data: paymentsData, error: pErr } = await supabase
      .from('payments')
      .select('*')
      .eq('school_id', schoolId);

    if (pErr) {
      console.warn("Erreur récupération paiements:", pErr);
    }

    if (paymentsData && paymentsData.length > 0) {
      // Filter by date and campus
      const datePayments = paymentsData.filter((p: any) => {
        // Exclude cancelled / rejected
        if (p.status === 'ANNULE' || p.status === 'REJETE' || p.moncash_status === 'REJECTED') return false;
        if (p.payment_method?.includes('REJETÉ') || p.payment_method?.includes('ANNULÉ')) return false;
        
        // Date check matching any date column
        const isMatched = 
          matchDateString(p.payment_date, dateString) ||
          matchDateString(p.deposit_date, dateString) ||
          matchDateString(p.created_at, dateString) ||
          matchDateString(p.date, dateString) ||
          matchDateString(p.transaction_date, dateString);

        if (!isMatched) return false;

        // Campus check
        if (campusId && isValidUuid(campusId)) {
          const studentInfo = p.student_id ? studentMap[p.student_id] : null;
          const matchPaymentCampus = p.campus_id === campusId;
          const matchStudentCampus = studentInfo && studentInfo.campus_id === campusId;
          if (!matchPaymentCampus && !matchStudentCampus && (p.campus_id || studentInfo?.campus_id)) return false;
        }

        return true;
      });

      datePayments.forEach((p: any) => {
        const amt = Number(p.amount_htg_equivalent || p.amount) || 0;
        const rawAmt = Number(p.amount) || amt;
        const isUSD = p.currency === 'USD';
        const method = p.payment_method || 'Cash';
        const feeType = (p.fee_type || p.nature || p.type || '').toUpperCase();

        if (isUSD) {
          collectionsUSD += rawAmt;
        } else {
          collectionsHTG += amt;
        }

        if (feeType.includes('SCOLAR') || feeType.includes('TUITION')) {
          if (isUSD) scolariteUSD += rawAmt; else scolariteHTG += amt;
        } else if (feeType.includes('INSCRIP') || feeType.includes('REGISTR')) {
          if (isUSD) inscriptionUSD += rawAmt; else inscriptionHTG += amt;
        } else if (feeType.includes('FOURNITUR') || feeType.includes('SUPPL')) {
          if (isUSD) fournituresUSD += rawAmt; else fournituresHTG += amt;
        } else {
          if (isUSD) autresUSD += rawAmt; else autresHTG += amt;
        }

        trackMethod(method, p.currency || 'HTG', rawAmt);

        const studentInfo = p.student_id ? studentMap[p.student_id] : null;
        const studentName = studentInfo ? studentInfo.full_name : (p.student_name || 'Élève');

        let displayNature = p.nature || p.type || p.fee_type || 'Frais scolaire';
        if (p.fee_type === 'SCOLARITE' || displayNature === 'SCOLARITE') displayNature = 'Scolarité';
        else if (p.fee_type === 'INSCRIPTION' || displayNature === 'INSCRIPTION') displayNature = 'Inscription';

        transactions.push({
          id: p.id,
          type: 'ENCAISSEMENT',
          nature: displayNature,
          student_name: studentName,
          amount: rawAmt,
          currency: p.currency || 'HTG',
          payment_method: method,
          reference: p.reference_number || p.moncash_order_id || p.id.slice(0, 8),
          time: p.created_at ? new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--',
          created_at: p.created_at || p.payment_date
        });
      });
    }
  } catch (err) {
    console.warn("Erreur calcul encaissements pour clôture:", err);
  }

  // 3. Fetch Supply Payments & POS Sales
  try {
    const { data: supplyData } = await supabase
      .from('supply_payments')
      .select('*')
      .eq('school_id', schoolId);

    if (supplyData && supplyData.length > 0) {
      const dateSupplies = supplyData.filter((s: any) => {
        const isMatched = 
          matchDateString(s.payment_date, dateString) ||
          matchDateString(s.created_at, dateString) ||
          matchDateString(s.date, dateString);

        if (!isMatched) return false;

        if (campusId && isValidUuid(campusId)) {
          if (s.campus_id && s.campus_id !== campusId) return false;
        }

        return true;
      });

      dateSupplies.forEach((s: any) => {
        // Prevent double counting if already present in payments table
        if (transactions.some(t => t.id === s.id || (s.payment_id && t.id === s.payment_id))) {
          return;
        }

        const amt = Number(s.amount_paid || s.amount) || 0;
        const isUSD = s.currency === 'USD';
        const method = s.payment_method || 'Cash';

        if (isUSD) {
          collectionsUSD += amt;
          fournituresUSD += amt;
        } else {
          collectionsHTG += amt;
          fournituresHTG += amt;
        }

        trackMethod(method, s.currency || 'HTG', amt);

        transactions.push({
          id: s.id,
          type: 'FOURNITURE',
          nature: s.item_name ? `Économat: ${s.item_name}` : 'Vente Fourniture',
          student_name: s.student_name || 'Vente Économat',
          amount: amt,
          currency: s.currency || 'HTG',
          payment_method: method,
          reference: s.id.slice(0, 8),
          time: s.created_at ? new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--',
          created_at: s.created_at || s.payment_date
        });
      });
    }
  } catch (err) {
    console.warn("Erreur calcul fournitures pour clôture:", err);
  }

  // 4. Fetch Expenses (Décaissements)
  let expensesHTG = 0;
  let expensesUSD = 0;
  const byExpenseCategory: Record<string, { htg: number; usd: number; count: number }> = {};
  const categoryMap: Record<string, string> = {};

  try {
    const { data: catData } = await supabase
      .from('expense_categories')
      .select('id, label')
      .eq('school_id', schoolId);
    if (catData) {
      catData.forEach((c: any) => { categoryMap[c.id] = c.label; });
    }
  } catch (e) {
    // ignore
  }

  try {
    const { data: expensesData, error: expErr } = await supabase
      .from('expenses')
      .select('*')
      .eq('school_id', schoolId);

    if (expErr) {
      console.warn("Erreur récupération dépenses:", expErr);
    }

    if (expensesData && expensesData.length > 0) {
      const dateExpenses = expensesData.filter((e: any) => {
        if (e.status === 'REJETE' || e.status === 'ANNULE') return false;

        const isMatched = 
          matchDateString(e.expense_date, dateString) ||
          matchDateString(e.created_at, dateString) ||
          matchDateString(e.date, dateString) ||
          matchDateString(e.payment_date, dateString);

        if (!isMatched) return false;

        if (campusId && isValidUuid(campusId)) {
          if (e.campus_id && e.campus_id !== campusId) return false;
        }

        return true;
      });

      dateExpenses.forEach((e: any) => {
        const amt = Number(e.amount) || 0;
        const isUSD = e.currency === 'USD';
        const catLabel = (e.category_id && categoryMap[e.category_id]) || e.category || 'Charges Générales';

        if (isUSD) expensesUSD += amt; else expensesHTG += amt;

        if (!byExpenseCategory[catLabel]) {
          byExpenseCategory[catLabel] = { htg: 0, usd: 0, count: 0 };
        }
        byExpenseCategory[catLabel].count += 1;
        if (isUSD) byExpenseCategory[catLabel].usd += amt; else byExpenseCategory[catLabel].htg += amt;

        transactions.push({
          id: e.id,
          type: 'DECAISSEMENT',
          nature: `Dépense: ${e.title || catLabel}`,
          student_name: e.beneficiary || 'Bénéficiaire',
          amount: amt,
          currency: e.currency || 'HTG',
          payment_method: e.payment_method || 'Cash',
          reference: e.voucher_number || e.id.slice(0, 8),
          time: e.created_at ? new Date(e.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--',
          created_at: e.created_at || e.expense_date
        });
      });
    }
  } catch (err) {
    console.warn("Erreur calcul dépenses pour clôture:", err);
  }

  // 5. Fetch Paid Payroll Slips on this date
  try {
    const { data: salaryData } = await supabase
      .from('payroll_slips')
      .select('*')
      .eq('school_id', schoolId)
      .eq('status', 'PAID');

    if (salaryData && salaryData.length > 0) {
      const dateSalaries = salaryData.filter((slip: any) => {
        const isMatched = 
          matchDateString(slip.payment_date, dateString) ||
          matchDateString(slip.paid_at, dateString) ||
          matchDateString(slip.created_at, dateString);

        if (!isMatched) return false;

        if (campusId && isValidUuid(campusId)) {
          if (slip.campus_id && slip.campus_id !== campusId) return false;
        }

        return true;
      });

      dateSalaries.forEach((slip: any) => {
        const amt = Number(slip.net_salary || slip.amount) || 0;
        const isUSD = slip.currency === 'USD';
        const method = slip.payment_method || 'Cash';
        const catLabel = 'Salaires & Rémunérations';

        if (isUSD) expensesUSD += amt; else expensesHTG += amt;

        if (!byExpenseCategory[catLabel]) {
          byExpenseCategory[catLabel] = { htg: 0, usd: 0, count: 0 };
        }
        byExpenseCategory[catLabel].count += 1;
        if (isUSD) byExpenseCategory[catLabel].usd += amt; else byExpenseCategory[catLabel].htg += amt;

        transactions.push({
          id: slip.id,
          type: 'DECAISSEMENT',
          nature: `Salaire: ${slip.employee_name || 'Personnel'}`,
          student_name: slip.employee_name || 'Enseignant / Staff',
          amount: amt,
          currency: slip.currency || 'HTG',
          payment_method: method,
          reference: slip.id.slice(0, 8),
          time: slip.created_at ? new Date(slip.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--',
          created_at: slip.payment_date || slip.created_at
        });
      });
    }
  } catch (err) {
    console.warn("Erreur calcul salaires pour clôture:", err);
  }

  // Sort all transactions chronologically (or by created_at descending)
  transactions.sort((a, b) => {
    const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return timeB - timeA;
  });

  const breakdown: CashClosureBreakdown = {
    scolarite_htg: scolariteHTG,
    scolarite_usd: scolariteUSD,
    inscription_htg: inscriptionHTG,
    inscription_usd: inscriptionUSD,
    fournitures_htg: fournituresHTG,
    fournitures_usd: fournituresUSD,
    autres_htg: autresHTG,
    autres_usd: autresUSD,
    by_method: byMethod,
    by_expense_category: byExpenseCategory
  };

  return {
    total_collections_htg: collectionsHTG,
    total_collections_usd: collectionsUSD,
    total_expenses_htg: expensesHTG,
    total_expenses_usd: expensesUSD,
    net_total_htg: collectionsHTG - expensesHTG,
    net_total_usd: collectionsUSD - expensesUSD,
    transaction_count: transactions.length,
    breakdown,
    transactions
  };
}

/**
 * Get or compute closure report for a date
 */
export async function getCashClosureReport(
  schoolId: string, 
  campusId: string | null | undefined, 
  dateString: string
): Promise<CashClosureRecord> {
  const resourceKey = `CASH_CLOSURE_${campusId || 'ALL'}_${dateString}`;
  let existingReport: CashClosureRecord | null = null;

  // 1. Try fetching from Supabase resource_locks table
  try {
    const { data } = await supabase
      .from('resource_locks')
      .select('*')
      .eq('school_id', schoolId)
      .eq('resource_type', 'CASH_CLOSURE')
      .eq('resource_id', resourceKey)
      .maybeSingle();

    if (data && data.user_name) {
      try {
        const parsed: CashClosureRecord = JSON.parse(data.user_name);
        if (parsed && parsed.closure_date) {
          existingReport = parsed;
        }
      } catch (e) {
        console.warn("Erreur parse closure json:", e);
      }
    }
  } catch (err) {
    console.warn("Impossible de charger les clôtures depuis Supabase, fallback local...", err);
  }

  // 2. Try localStorage fallback if not found in Supabase
  if (!existingReport) {
    try {
      const localData = localStorage.getItem(getStorageKey(schoolId));
      if (localData) {
        const allClosures: Record<string, CashClosureRecord> = JSON.parse(localData);
        if (allClosures[resourceKey]) {
          existingReport = allClosures[resourceKey];
        }
      }
    } catch (e) {
      console.warn("Erreur lecture local closures:", e);
    }
  }

  // If a VALIDATED closure exists and is NOT reopened, return it locked
  if (existingReport && existingReport.status === 'VALIDATED' && !existingReport.is_reopened) {
    return existingReport;
  }

  // 3. Otherwise (status OPEN, PENDING, or REOPENED), compute live real-time metrics
  const computed = await computeDailyTransactions(schoolId, campusId, dateString);

  return {
    school_id: schoolId,
    campus_id: campusId,
    closure_date: dateString,
    status: existingReport?.status === 'VALIDATED' && !existingReport.is_reopened ? 'VALIDATED' : 'OPEN',
    total_collections_htg: computed.total_collections_htg,
    total_collections_usd: computed.total_collections_usd,
    total_expenses_htg: computed.total_expenses_htg,
    total_expenses_usd: computed.total_expenses_usd,
    net_total_htg: computed.net_total_htg,
    net_total_usd: computed.net_total_usd,
    transaction_count: computed.transaction_count,
    breakdown: computed.breakdown,
    
    // Preserve reopening notes & audit history if re-opened
    is_reopened: existingReport?.is_reopened || false,
    is_modified: existingReport?.is_modified || false,
    reopen_count: existingReport?.reopen_count || 0,
    reopen_reason: existingReport?.reopen_reason,
    reopened_by: existingReport?.reopened_by,
    reopened_by_name: existingReport?.reopened_by_name,
    reopened_at: existingReport?.reopened_at,
    audit_trail: existingReport?.audit_trail || [],
    notes: existingReport?.notes || ''
  };
}

/**
 * Save or validate closure
 */
export async function saveOrValidateCashClosure(closure: CashClosureRecord): Promise<{ success: boolean; error?: string }> {
  const resourceKey = `CASH_CLOSURE_${closure.campus_id || 'ALL'}_${closure.closure_date}`;
  const serialized = JSON.stringify(closure);

  // 1. LocalStorage update
  try {
    const key = getStorageKey(closure.school_id);
    const existingStr = localStorage.getItem(key);
    const existing: Record<string, CashClosureRecord> = existingStr ? JSON.parse(existingStr) : {};
    existing[resourceKey] = closure;
    localStorage.setItem(key, JSON.stringify(existing));
  } catch (e) {
    console.warn("Erreur sauvegarde local storage closure:", e);
  }

  // 2. Supabase resource_locks save/upsert
  try {
    // Delete old lock entry
    await supabase
      .from('resource_locks')
      .delete()
      .eq('school_id', closure.school_id)
      .eq('resource_type', 'CASH_CLOSURE')
      .eq('resource_id', resourceKey);

    // Persist closure record in resource_locks for persistence and audit tracking
    if (closure.status === 'VALIDATED' || closure.is_reopened || (closure.reopen_count && closure.reopen_count > 0)) {
      const { error } = await supabase
        .from('resource_locks')
        .insert({
          school_id: closure.school_id,
          resource_type: 'CASH_CLOSURE',
          resource_id: resourceKey,
          user_name: serialized,
          expires_at: '2099-12-31T23:59:59Z'
        });

      if (error) {
        console.warn("Erreur insertion resource_lock pour clôture:", error);
      }
    }
    return { success: true };
  } catch (err: any) {
    console.error("Exception enregistrement clôture de caisse:", err);
    return { success: true }; // Local fallbacked
  }
}

/**
 * Check if a date is locked/closed for cash operations
 */
export async function isCashDateLocked(
  schoolId: string, 
  campusId: string | null | undefined, 
  dateString: string
): Promise<{ isLocked: boolean; closure?: CashClosureRecord; reason?: string }> {
  if (!schoolId || !dateString) return { isLocked: false };

  // 1. Check specific campus lock if campusId provided
  if (campusId) {
    const campusReport = await getCashClosureReport(schoolId, campusId, dateString);
    if (campusReport && campusReport.status === 'VALIDATED') {
      return {
        isLocked: true,
        closure: campusReport,
        reason: `La caisse de l'annexe pour la journée du ${campusReport.closure_date} a été clôturée et verrouillée par l'administration (${campusReport.validated_by_name || 'Admin'}).`
      };
    }
  }

  // 2. Check global/consolidated lock (ALL)
  const globalReport = await getCashClosureReport(schoolId, null, dateString);
  if (globalReport && globalReport.status === 'VALIDATED') {
    return {
      isLocked: true,
      closure: globalReport,
      reason: `La caisse générale pour la journée du ${globalReport.closure_date} a été clôturée et verrouillée par l'administration (${globalReport.validated_by_name || 'Admin'}).`
    };
  }

  return { isLocked: false };
}

/**
 * Fetch all historical closures for a school/campus
 */
export async function fetchClosureHistory(
  schoolId: string, 
  campusId?: string | null
): Promise<CashClosureRecord[]> {
  const closures: CashClosureRecord[] = [];

  // 1. Fetch from Supabase
  try {
    let q = supabase
      .from('resource_locks')
      .select('*')
      .eq('school_id', schoolId)
      .eq('resource_type', 'CASH_CLOSURE');

    const { data } = await q;

    if (data) {
      data.forEach((row: any) => {
        if (row.user_name) {
          try {
            const parsed: CashClosureRecord = JSON.parse(row.user_name);
            if (parsed && parsed.closure_date) {
              if (!campusId || parsed.campus_id === campusId || row.resource_id.includes(`_${campusId}_`)) {
                closures.push(parsed);
              }
            }
          } catch (e) {
            // ignore
          }
        }
      });
    }
  } catch (e) {
    console.warn("Erreur fetch closure history from Supabase:", e);
  }

  // 2. Fetch from LocalStorage
  try {
    const localStr = localStorage.getItem(getStorageKey(schoolId));
    if (localStr) {
      const localDict: Record<string, CashClosureRecord> = JSON.parse(localStr);
      Object.values(localDict).forEach((rec) => {
        if (!closures.some(c => c.closure_date === rec.closure_date && c.campus_id === rec.campus_id)) {
          if (!campusId || rec.campus_id === campusId) {
            closures.push(rec);
          }
        }
      });
    }
  } catch (e) {
    console.warn("Erreur fetch closure history local:", e);
  }

  // Sort descending by closure_date
  return closures.sort((a, b) => b.closure_date.localeCompare(a.closure_date));
}
