import { supabase } from '../supabase';

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
  | 'APPROVE';

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
  | 'pending_action'
  | 'salary_advance';

export interface AuditLogPayload {
  school_id: string | null;
  user_id: string;
  action: AuditAction;
  entity_type: EntityType;
  entity_id?: string;
  details?: Record<string, any>;
}

export const AuditLogger = {
  /**
   * Logs an action to the audit_logs table.
   * Fails silently to prevent blocking the main operation.
   */
  async log(payload: AuditLogPayload): Promise<void> {
    try {
      const isUuid = (val: any): boolean => {
        if (typeof val !== 'string') return false;
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
      };

      const hasValidEntityId = payload.entity_id && isUuid(payload.entity_id);

      // Traçabilité et imputation juridique : identifier si l'opérateur est un compte en mode autonome (sans dossier RH)
      let isAutonomousAccount = false;
      try {
        const cachedUserStr = window.localStorage.getItem('edunova_user_profile');
        if (cachedUserStr) {
          const cached = JSON.parse(cachedUserStr);
          if (cached && (cached.is_autonomous || (!cached.staff_id && cached.role !== 'SUPER_ADMIN' && !cached.is_super_admin))) {
            isAutonomousAccount = true;
          }
        }
      } catch (e) {}

      // Add browser context to details
      const enrichedDetails = {
        ...payload.details,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
        url: window.location.pathname,
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

      const { error } = await supabase
        .from('audit_logs')
        .insert([insertData]);

      if (error) {
        console.error('Failed to write audit log:', error);
        try {
          window.localStorage.setItem('last_audit_error', JSON.stringify(error));
        } catch (e) {}
      } else {
        try {
          window.localStorage.removeItem('last_audit_error');
        } catch (e) {}
      }
    } catch (err: any) {
      console.error('Error in AuditLogger:', err);
      try {
        window.localStorage.setItem('last_audit_error', JSON.stringify({ message: err.message || String(err) }));
      } catch (e) {}
    }
  }
};
