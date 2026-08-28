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
  | 'LOGIN_FAILED';

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
  | 'enrollment';

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

      // Add browser context to details
      const enrichedDetails = {
        ...payload.details,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
        url: window.location.pathname,
        ...(payload.entity_id && !hasValidEntityId ? { entity_string_id: payload.entity_id } : {})
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
