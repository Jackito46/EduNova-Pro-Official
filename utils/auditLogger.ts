import { supabase, isNetworkOrTimeoutError } from '../supabase';

export type AuditAction = 
  | 'LOGIN' 
  | 'LOGOUT' 
  | 'CREATE' 
  | 'UPDATE' 
  | 'DELETE' 
  | 'EXPORT' 
  | 'IMPORT'
  | 'PAYMENT_PROCESSED'
  | 'PAYMENT_CANCELLED'
  | 'PAYMENT_CANCELLATION_REQUESTED'
  | 'PAYMENT_CANCELLATION_APPROVED'
  | 'PAYMENT_CANCELLATION_REJECTED'
  | 'EXPENSE_APPROVED'
  | 'EXPENSE_REJECTED'
  | 'RESET_PASSWORD'
  | 'PASSWORD_RESET'
  | 'PASSWORD_RESET_EMAIL_SENT'
  | 'UPDATE_GLOBAL_CONFIG'
  | 'FIRE_STAFF'
  | 'ANONYMIZE_STUDENTS'
  | 'ANONYMIZE_STAFF'
  | 'ANONYMIZE_PARENTS'
  | 'ANONYMIZE_ALL'
  | 'SALARY_UPDATE'
  | 'SEED_DATA'
  | 'REVOKE_ACCESS'
  | 'UPDATE_USER'
  | 'UPDATE_ROLE'
  | 'UNBLOCK_USER'
  | 'REACTIVATE_AND_EXTEND'
  | 'LOGIN_FAILED'
  | 'LINK_RH_RECORD'
  | 'PAYROLL_UPDATE'
  | 'PAYROLL_CREATE'
  | 'PAYROLL_DELETE'
  | 'PAYROLL_PAYMENT'
  | 'PAYROLL_SENSITIVE_UPDATE'
  | 'OFFLINE_RECEIPT_SYNCED';

export type EntityType = 
  | 'auth' 
  | 'student' 
  | 'class' 
  | 'staff' 
  | 'payment' 
  | 'expense' 
  | 'supply' 
  | 'settings'
  | 'user'
  | 'school'
  | 'subject'
  | 'system'
  | 'class_subject'
  | 'grade'
  | 'attendance'
  | 'course_signature'
  | 'payment_gateway'
  | 'exchange_rate'
  | 'fee_plan'
  | 'enrollment'
  | 'payroll_slip'
  | 'payroll_period'
  | 'pending_action';

export interface AuditLogPayload {
  school_id: string | null;
  user_id: string;
  action: AuditAction;
  entity_type: EntityType;
  entity_id?: string;
  details?: Record<string, any>;
}

const PENDING_AUDIT_LOGS_KEY = 'edunova_pending_audit_logs';
const MAX_PENDING_AUDIT_LOGS = 50;
let isFlushingAuditLogs = false;
let onlineListenerAttached = false;

const readPendingAuditLogs = (): any[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(PENDING_AUDIT_LOGS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writePendingAuditLogs = (entries: any[]): void => {
  if (typeof window === 'undefined') return;
  try {
    if (entries.length === 0) {
      window.localStorage.removeItem(PENDING_AUDIT_LOGS_KEY);
    } else {
      window.localStorage.setItem(
        PENDING_AUDIT_LOGS_KEY,
        JSON.stringify(entries.slice(-MAX_PENDING_AUDIT_LOGS))
      );
    }
  } catch {}
};

const enqueuePendingAuditLog = (entry: any): void => {
  const existing = readPendingAuditLogs();
  existing.push(entry);
  writePendingAuditLogs(existing);
};

export const AuditLogger = {
  /**
   * Flushes any audit logs deferred during transient network outages.
   */
  async flushPending(): Promise<void> {
    if (isFlushingAuditLogs) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    const pending = readPendingAuditLogs();
    if (pending.length === 0) return;

    isFlushingAuditLogs = true;
    try {
      const { error } = await supabase
        .from('audit_logs')
        .insert(pending);
      if (!error) {
        writePendingAuditLogs([]);
      }
    } catch {
      // Keep queued for next reconnect
    } finally {
      isFlushingAuditLogs = false;
    }
  },

  /**
   * Logs an action to the audit_logs table.
   * Fails silently and queues on transient network drops to prevent blocking or error overlays.
   */
  async log(payload: AuditLogPayload): Promise<void> {
    if (typeof window !== 'undefined' && !onlineListenerAttached) {
      onlineListenerAttached = true;
      window.addEventListener('online', () => {
        void AuditLogger.flushPending();
      });
    }

    const isUuid = (val: any): boolean => {
      if (typeof val !== 'string') return false;
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
    };

    const hasValidEntityId = payload.entity_id && isUuid(payload.entity_id);

    // Traçabilité et imputation juridique : identifier si l'opérateur est un compte en mode autonome (sans dossier RH)
    let isAutonomousAccount = false;
    try {
      const cachedUserStr = typeof window !== 'undefined' ? window.localStorage.getItem('edunova_user_profile') : null;
      if (cachedUserStr) {
        const cached = JSON.parse(cachedUserStr);
        if (cached && (cached.is_autonomous || (!cached.staff_id && cached.role !== 'SUPER_ADMIN' && !cached.is_super_admin))) {
          isAutonomousAccount = true;
        }
      }
    } catch {}

    // Add browser context to details
    const enrichedDetails = {
      ...payload.details,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      timestamp: new Date().toISOString(),
      url: typeof window !== 'undefined' ? window.location.pathname : '/',
      ...(payload.entity_id && !hasValidEntityId ? { entity_string_id: payload.entity_id } : {}),
      ...(isAutonomousAccount ? {
        rh_compliance_notice: '[COMPTE AUTONOME - SANS DOSSIER RH]',
        is_autonomous_operator: true
      } : {})
    };

    const insertData: any = {
      school_id: isUuid(payload.school_id) ? payload.school_id : null,
      user_id: isUuid(payload.user_id) ? payload.user_id : null,
      action: payload.action,
      entity_type: payload.entity_type,
      details: enrichedDetails
    };

    if (payload.entity_id && hasValidEntityId) {
      insertData.entity_id = payload.entity_id;
    }

    // If offline, defer immediately without triggering a doomed network request
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      enqueuePendingAuditLog(insertData);
      console.warn('Audit log différé (mode hors-ligne):', payload.action);
      return;
    }

    try {
      const { error } = await supabase
        .from('audit_logs')
        .insert([insertData]);

      if (error) {
        if (isNetworkOrTimeoutError(error)) {
          enqueuePendingAuditLog(insertData);
          console.warn('Audit log différé (réseau instable / délai dépassé):', error?.message || payload.action);
        } else {
          console.warn('Audit log non enregistré:', error?.message || error);
        }
        try {
          if (typeof window !== 'undefined') {
            window.localStorage.setItem('last_audit_error', JSON.stringify(error));
          }
        } catch {}
      } else {
        try {
          if (typeof window !== 'undefined') {
            window.localStorage.removeItem('last_audit_error');
          }
        } catch {}
        void AuditLogger.flushPending();
      }
    } catch (err: any) {
      if (isNetworkOrTimeoutError(err)) {
        enqueuePendingAuditLog(insertData);
        console.warn('Audit log différé (exception réseau):', err?.message || payload.action);
      } else {
        console.warn('Erreur AuditLogger:', err?.message || err);
      }
      try {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('last_audit_error', JSON.stringify({ message: err?.message || String(err) }));
        }
      } catch {}
    }
  }
};
