import { supabase } from '../supabase';
import { PendingAction, PendingActionType, UserProfile, UserRole } from '../types';
import { AuditLogger } from '../utils/auditLogger';
import { isTitulaireAdmin, isAutonomousAccount } from '../utils/autonomousAdminGuard';

export interface CreatePendingActionParams {
  school_id: string;
  campus_id?: string | null;
  action_type: PendingActionType;
  action_title: string;
  description?: string | null;
  target_entity_type: string;
  target_entity_id?: string | null;
  payload: Record<string, any>;
  requester: UserProfile;
}

export class PendingActionsService {
  /**
   * Crée une action critique en attente de double regard (4-Yeux)
   */
  static async createPendingAction(params: CreatePendingActionParams): Promise<{ success: boolean; data?: PendingAction; error?: string }> {
    try {
      if (!params.school_id) {
        return { success: false, error: "Identifiant d'établissement manquant." };
      }

      const isAutonomous = isAutonomousAccount(params.requester);

      const newRecord = {
        school_id: params.school_id,
        campus_id: params.campus_id || params.requester.campus_id || null,
        action_type: params.action_type,
        action_title: params.action_title,
        description: params.description || null,
        target_entity_type: params.target_entity_type,
        target_entity_id: params.target_entity_id || null,
        payload: params.payload,
        status: 'PENDING',
        requester_id: params.requester.id,
        requester_name: params.requester.full_name || 'Utilisateur',
        requester_email: params.requester.email || '',
        requester_role: params.requester.role || '',
        is_autonomous_requester: isAutonomous,
        execution_status: 'IDLE'
      };

      const { data, error } = await supabase
        .from('pending_actions')
        .insert([newRecord])
        .select()
        .single();

      if (error) {
        console.error("Error creating pending action:", error);
        return { success: false, error: error.message };
      }

      await AuditLogger.log({
        school_id: params.school_id,
        user_id: params.requester.id,
        action: 'CREATE',
        entity_type: 'pending_action',
        entity_id: data.id,
        details: {
          action_type: params.action_type,
          action_title: params.action_title,
          is_autonomous: isAutonomous,
          rh_compliance_notice: isAutonomous ? '[COMPTE AUTONOME - SOUMISSION DOUBLE REGARD]' : undefined
        }
      });

      return { success: true, data };
    } catch (err: any) {
      console.error("Unexpected error in createPendingAction:", err);
      return { success: false, error: err.message || "Erreur lors de la création de la demande." };
    }
  }

  /**
   * Récupère la liste des actions en attente pour un établissement
   */
  static async fetchPendingActions(schoolId: string, options?: { status?: string; campusId?: string }): Promise<PendingAction[]> {
    try {
      let query = supabase
        .from('pending_actions')
        .select('*')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false });

      if (options?.status && options.status !== 'ALL') {
        query = query.eq('status', options.status);
      }

      if (options?.campusId && options.campusId !== 'ALL') {
        query = query.or(`campus_id.is.null,campus_id.eq.${options.campusId}`);
      }

      const { data, error } = await query;
      if (error) {
        console.error("Error fetching pending actions:", error);
        return [];
      }

      return data as PendingAction[];
    } catch (err) {
      console.error("Error in fetchPendingActions:", err);
      return [];
    }
  }

  /**
   * Compte les actions en statut PENDING pour l'établissement
   */
  static async getPendingCount(schoolId: string, campusId?: string): Promise<number> {
    try {
      let query = supabase
        .from('pending_actions')
        .select('id', { count: 'exact', head: true })
        .eq('school_id', schoolId)
        .eq('status', 'PENDING');

      if (campusId && campusId !== 'ALL') {
        query = query.or(`campus_id.is.null,campus_id.eq.${campusId}`);
      }

      const { count, error } = await query;
      if (error) return 0;
      return count || 0;
    } catch (err) {
      return 0;
    }
  }

  /**
   * Valide et exécute l'action critique (Réservé aux Administrateurs titulaires certifiés RH)
   */
  static async approveAndExecuteAction(
    action: PendingAction, 
    reviewer: UserProfile, 
    notes?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Vérification formelle du quorum / lien RH
      if (!isTitulaireAdmin(reviewer)) {
        return { 
          success: false, 
          error: "Action refusée : Seul un Administrateur certifié RH (titulaire du poste avec contrat officiel) peut co-valider et libérer cette opération critique." 
        };
      }

      // Empêcher l'auto-approbation si le demandeur est la même personne (sauf Super Admin)
      if (action.requester_id === reviewer.id && !reviewer.is_super_admin && reviewer.role !== UserRole.SUPER_ADMIN) {
        return {
          success: false,
          error: "Principe des 4-Yeux : Vous ne pouvez pas valider vous-même une action critique dont vous êtes le demandeur."
        };
      }

      // 1. Exécution de l'action selon son type
      const executionResult = await this.executePayload(action, reviewer);
      if (!executionResult.success) {
        // Enregistrer l'échec d'exécution
        await supabase
          .from('pending_actions')
          .update({
            execution_status: 'FAILED',
            execution_error: executionResult.error,
            updated_at: new Date().toISOString()
          })
          .eq('id', action.id);

        return { 
          success: false, 
          error: `Échec lors de l'exécution technique : ${executionResult.error}` 
        };
      }

      // 2. Mise à jour du statut de l'action
      const { error: updateErr } = await supabase
        .from('pending_actions')
        .update({
          status: 'APPROVED',
          reviewed_by: reviewer.id,
          reviewer_name: reviewer.full_name,
          reviewed_at: new Date().toISOString(),
          review_notes: notes || null,
          execution_status: 'SUCCESS',
          execution_error: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', action.id);

      if (updateErr) {
        console.error("Error updating approved action:", updateErr);
      }

      // 3. Journal d'audit certifié
      await AuditLogger.log({
        school_id: action.school_id,
        user_id: reviewer.id,
        action: 'UPDATE',
        entity_type: 'pending_action',
        entity_id: action.id,
        details: {
          action: 'DOUBLE_REGARD_APPROVED',
          action_type: action.action_type,
          action_title: action.action_title,
          requester_id: action.requester_id,
          requester_name: action.requester_name,
          co_validated_by: reviewer.full_name,
          reviewer_rh_certified: true,
          notes: notes || null
        }
      });

      return { success: true };
    } catch (err: any) {
      console.error("Error approving action:", err);
      return { success: false, error: err.message || "Erreur lors de la validation." };
    }
  }

  /**
   * Rejette l'action critique avec un motif obligatoire
   */
  static async rejectAction(
    action: PendingAction, 
    reviewer: UserProfile, 
    rejectionReason: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!isTitulaireAdmin(reviewer)) {
        return { 
          success: false, 
          error: "Seul un Administrateur certifié RH (titulaire) peut statuer sur cette demande." 
        };
      }

      if (!rejectionReason || !rejectionReason.trim()) {
        return { success: false, error: "Un motif de rejet explicite est obligatoire." };
      }

      const { error } = await supabase
        .from('pending_actions')
        .update({
          status: 'REJECTED',
          reviewed_by: reviewer.id,
          reviewer_name: reviewer.full_name,
          reviewed_at: new Date().toISOString(),
          rejection_reason: rejectionReason.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', action.id);

      if (error) {
        return { success: false, error: error.message };
      }

      await AuditLogger.log({
        school_id: action.school_id,
        user_id: reviewer.id,
        action: 'UPDATE',
        entity_type: 'pending_action',
        entity_id: action.id,
        details: {
          action: 'DOUBLE_REGARD_REJECTED',
          action_type: action.action_type,
          action_title: action.action_title,
          requester_id: action.requester_id,
          rejection_reason: rejectionReason.trim()
        }
      });

      return { success: true };
    } catch (err: any) {
      console.error("Error rejecting action:", err);
      return { success: false, error: err.message || "Erreur lors du rejet." };
    }
  }

  /**
   * Exécute concrètement l'action dans le système Supabase
   */
  private static async executePayload(action: PendingAction, reviewer: UserProfile): Promise<{ success: boolean; error?: string }> {
    const { action_type, payload } = action;

    try {
      switch (action_type) {
        case 'DELETE_USER': {
          const userId = payload.userId || action.target_entity_id;
          if (!userId) return { success: false, error: "Identifiant utilisateur introuvable." };

          const { data, error } = await supabase.rpc('admin_delete_user', { p_user_id: userId });
          if (error) return { success: false, error: error.message };
          if (data && !data.success) return { success: false, error: data.error || "Impossible de supprimer l'utilisateur." };

          await AuditLogger.log({
            school_id: action.school_id,
            user_id: reviewer.id,
            action: 'DELETE',
            entity_type: 'user',
            entity_id: userId,
            details: { 
              deleted_via: 'DOUBLE_REGARD_EXECUTION',
              requested_by: action.requester_name,
              validated_by: reviewer.full_name
            }
          });
          return { success: true };
        }

        case 'UPDATE_PAYROLL': {
          const slipId = payload.slipId || action.target_entity_id;
          if (!slipId) return { success: false, error: "Identifiant de la fiche de paie introuvable." };

          const updates = payload.updates || {};
          const { error } = await supabase
            .from('payroll_slips')
            .update(updates)
            .eq('id', slipId);

          if (error) return { success: false, error: error.message };

          await AuditLogger.log({
            school_id: action.school_id,
            user_id: reviewer.id,
            action: 'UPDATE',
            entity_type: 'payroll_slip',
            entity_id: slipId,
            details: {
              updated_via: 'DOUBLE_REGARD_EXECUTION',
              requested_by: action.requester_name,
              validated_by: reviewer.full_name,
              updates
            }
          });
          return { success: true };
        }

        case 'DELETE_PAYROLL_SLIP': {
          const slipId = payload.slipId || action.target_entity_id;
          if (!slipId) return { success: false, error: "Identifiant de fiche introuvable." };

          const { error } = await supabase
            .from('payroll_slips')
            .delete()
            .eq('id', slipId);

          if (error) return { success: false, error: error.message };

          await AuditLogger.log({
            school_id: action.school_id,
            user_id: reviewer.id,
            action: 'DELETE',
            entity_type: 'payroll_slip',
            entity_id: slipId,
            details: {
              deleted_via: 'DOUBLE_REGARD_EXECUTION',
              requested_by: action.requester_name,
              validated_by: reviewer.full_name
            }
          });
          return { success: true };
        }

        case 'DELETE_PAYROLL_PERIOD': {
          const periodId = payload.periodId || action.target_entity_id;
          if (!periodId) return { success: false, error: "Identifiant de période introuvable." };

          // 1. Supprimer les fiches
          await supabase.from('payroll_slips').delete().eq('period_id', periodId);

          // 2. Supprimer la période
          const { error } = await supabase.from('payroll_periods').delete().eq('id', periodId);
          if (error) return { success: false, error: error.message };

          await AuditLogger.log({
            school_id: action.school_id,
            user_id: reviewer.id,
            action: 'DELETE',
            entity_type: 'payroll_period',
            entity_id: periodId,
            details: {
              deleted_via: 'DOUBLE_REGARD_EXECUTION',
              requested_by: action.requester_name,
              validated_by: reviewer.full_name
            }
          });
          return { success: true };
        }

        case 'APPROVE_ADVANCE': {
          const advanceId = payload.advanceId || action.target_entity_id;
          if (!advanceId) return { success: false, error: "Identifiant de l'avance introuvable." };

          const { error } = await supabase
            .from('salary_advances')
            .update({
              status: 'APPROVED',
              approved_by: reviewer.id,
              approved_at: new Date().toISOString()
            })
            .eq('id', advanceId);

          if (error) return { success: false, error: error.message };

          await AuditLogger.log({
            school_id: action.school_id,
            user_id: reviewer.id,
            action: 'APPROVE',
            entity_type: 'salary_advance',
            entity_id: advanceId,
            details: {
              approved_via: 'DOUBLE_REGARD_EXECUTION',
              requested_by: action.requester_name,
              validated_by: reviewer.full_name
            }
          });
          return { success: true };
        }

        case 'PROCESS_PAYROLL_PAYMENT': {
          const slipId = payload.slipId || action.target_entity_id;
          if (!slipId) return { success: false, error: "Identifiant de fiche introuvable." };

          const { error } = await supabase
            .from('payroll_slips')
            .update({
              status: 'PAID',
              payment_method: payload.payment_method || 'Virement',
              notes: payload.notes || 'Règlement validé sous Double Regard',
              paid_at: new Date().toISOString()
            })
            .eq('id', slipId);

          if (error) return { success: false, error: error.message };
          return { success: true };
        }

        case 'UPDATE_SALARY': {
          const staffId = payload.staffId || action.target_entity_id;
          const amount = payload.amount;
          if (!staffId || !amount) return { success: false, error: "Données de salaire incomplètes." };

          const { error } = await supabase
            .from('staff')
            .update({ amount })
            .eq('id', staffId);

          if (error) return { success: false, error: error.message };

          await AuditLogger.log({
            school_id: action.school_id,
            user_id: reviewer.id,
            action: 'UPDATE',
            entity_type: 'staff',
            entity_id: staffId,
            details: {
              new_amount: amount,
              reason: payload.reason || 'Double Regard validation',
              effective_date: payload.effectiveDate || new Date().toISOString(),
              requested_by: action.requester_name,
              validated_by: reviewer.full_name
            }
          });
          return { success: true };
        }

        case 'RESET_USER_PASSWORD': {
          const userId = payload.userId || action.target_entity_id;
          const newPassword = payload.newPassword;
          if (!userId || !newPassword) return { success: false, error: "Données de réinitialisation incomplètes." };

          const { data, error } = await supabase.rpc('admin_reset_password', {
            p_user_id: userId,
            p_new_password: newPassword,
            p_force_change: true
          });

          if (error) return { success: false, error: error.message };
          return { success: true };
        }

        case 'CHANGE_USER_ROLE': {
          const userId = payload.userId || action.target_entity_id;
          const newRole = payload.newRole;
          if (!userId || !newRole) return { success: false, error: "Données de rôle incomplètes." };

          const { error } = await supabase
            .from('profiles')
            .update({ role: newRole })
            .eq('id', userId);

          if (error) return { success: false, error: error.message };
          return { success: true };
        }

        case 'UPDATE_MONCASH': {
          const moncashConfig = payload.moncashConfig;
          if (!moncashConfig) return { success: false, error: "Configuration MonCash manquante." };

          const recordPayload = {
            ...moncashConfig,
            school_id: action.school_id,
            gateway_name: 'moncash'
          };

          let err;
          if (moncashConfig.id) {
            const { error: uErr } = await supabase
              .from('payment_gateways')
              .update(recordPayload)
              .eq('id', moncashConfig.id)
              .eq('school_id', action.school_id);
            err = uErr;
          } else {
            const { error: iErr } = await supabase
              .from('payment_gateways')
              .insert([recordPayload]);
            err = iErr;
          }

          if (err) return { success: false, error: err.message };
          return { success: true };
        }

        default:
          return { success: false, error: `Type d'action non géré: ${action_type}` };
      }
    } catch (err: any) {
      return { success: false, error: err.message || "Erreur inattendue lors de l'exécution." };
    }
  }
}
