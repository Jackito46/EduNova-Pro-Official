import { supabase, isValidUuid } from '../supabase';
import { UserProfile, UserRole } from '../types';
import { normalizeUserRole } from '../components/RoleGuard';
import { AuditLogger } from '../utils/auditLogger';

export interface CancellationInfo {
  isPending: boolean;
  isCancelled: boolean;
  status: string;
  reason?: string;
  requestedBy?: string;
  requestedByName?: string;
  requestedAt?: string;
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedByName?: string;
  rejectedAt?: string;
}

export interface RequestCancellationParams {
  paymentId: string;
  sourceTable?: 'payments' | 'school_supplies' | 'supply_payments' | string;
  reason: string;
  user: UserProfile;
  studentId?: string;
  paymentRef?: string;
  amount?: number;
  currency?: string;
}

export interface ApproveCancellationParams {
  paymentId: string;
  sourceTable?: 'payments' | 'school_supplies' | 'supply_payments' | string;
  approverUser: UserProfile;
  studentId?: string;
  amount?: number;
  currency?: string;
  paymentMethod?: string;
  refundToWallet?: boolean;
  paymentRef?: string;
  existingReason?: string;
}

export interface RejectCancellationParams {
  paymentId: string;
  sourceTable?: 'payments' | 'school_supplies' | 'supply_payments' | string;
  rejecterUser: UserProfile;
  rejectionReason: string;
  paymentRef?: string;
}

/**
 * Vérifie si l'utilisateur possède les privilèges hiérarchiques
 * pour approuver ou rejeter une demande d'annulation (Super Admin, Direction, Administrateur).
 */
export function canUserApproveCancellation(user: UserProfile | null | undefined): boolean {
  if (!user) return false;
  if (user.is_super_admin) return true;
  const role = normalizeUserRole(user.role);
  return role === UserRole.SUPER_ADMIN || role === UserRole.SCHOOL_ADMIN || role === UserRole.DIRECTOR;
}

/**
 * Analyse et extrait les métadonnées d'annulation d'un paiement ou d'une transaction de fourniture.
 */
export function parseCancellationInfo(item: any): CancellationInfo {
  if (!item) {
    return {
      isPending: false,
      isCancelled: false,
      status: 'VALID'
    };
  }

  const rawStatus = String(item.status || '').trim().toUpperCase();
  const rawCancelStatus = String(item.cancellation_status || item.cancel_status || '').trim().toUpperCase();
  const rawReason = String(item.cancel_reason || item.cancellation_reason || '').trim();

  const isPendingPrefix = rawReason.startsWith('[DEMANDE_ANNULATION]') || rawReason.startsWith('[DEMANDE]');
  const isPending = 
    rawCancelStatus === 'PENDING' ||
    rawStatus === 'ANNULATION_DEMANDEE' ||
    rawStatus === 'ANNULATIONS À VALIDER' ||
    rawStatus === 'ANNULATIONS A VALIDER' ||
    isPendingPrefix;

  const isCancelled = 
    rawStatus === 'ANNULE' ||
    rawStatus === 'ANNULÉ' ||
    rawStatus === 'CANCELLED' ||
    rawCancelStatus === 'APPROVED';

  // Extraction du motif lisible sans préfixe technique
  let cleanReason = rawReason;
  let requestedByName = item.cancel_requested_by_name || '';
  let requestedAt = item.cancel_requested_at || '';

  if (isPendingPrefix) {
    // Ex: "[DEMANDE_ANNULATION] Motif: Erreur de classe (Demandé par: Marie)"
    const motifMatch = rawReason.match(/Motif\s*:\s*([^()]+)/i);
    if (motifMatch && motifMatch[1]) {
      cleanReason = motifMatch[1].trim();
    } else {
      cleanReason = rawReason.replace(/^\[DEMANDE(?:_ANNULATION)?\]\s*/i, '').trim();
    }

    const byMatch = rawReason.match(/Demandé(?:\s*le\s*[^)]+)?\s*par\s*:\s*([^)]+)/i);
    if (byMatch && byMatch[1] && !requestedByName) {
      requestedByName = byMatch[1].trim();
    }
  }

  return {
    isPending,
    isCancelled,
    status: isCancelled ? 'ANNULE' : isPending ? 'PENDING' : 'VALIDE',
    reason: cleanReason || undefined,
    requestedBy: item.cancelled_by || item.cancel_requested_by || undefined,
    requestedByName: requestedByName || undefined,
    requestedAt: requestedAt || item.created_at || undefined,
    approvedBy: item.cancelled_by || undefined,
    approvedByName: item.cancelled_by_name || undefined,
    approvedAt: item.cancelled_at || undefined,
    rejectedBy: item.cancel_rejected_by || undefined,
    rejectedByName: item.cancel_rejected_by_name || undefined,
    rejectedAt: item.cancel_rejected_at || undefined
  };
}

/**
 * Soumet une demande d'annulation de transaction par un agent de caisse ou comptable.
 * Le solde financier de l'élève reste INTACT jusqu'à validation par la Direction.
 */
export async function requestPaymentCancellation(
  params: RequestCancellationParams
): Promise<{ success: boolean; message: string; data?: any }> {
  try {
    const { paymentId, sourceTable = 'payments', reason, user, studentId, paymentRef, amount, currency } = params;

    if (!paymentId) {
      throw new Error("Identifiant de transaction manquant.");
    }
    if (!reason || !reason.trim()) {
      throw new Error("Veuillez indiquer un motif d'annulation.");
    }

    const formattedReason = `[DEMANDE_ANNULATION] Motif: ${reason.trim()} (Demandé le ${new Date().toLocaleDateString('fr-FR')} par ${user.full_name || user.email || 'Agent'})`;
    const targetTable = sourceTable === 'school_supplies' ? 'school_supplies' : sourceTable === 'supply_payments' ? 'supply_payments' : 'payments';

    // Tentative 1 : Mise à jour avec colonnes de workflow complètes
    const updatePayloadWithWorkflow: any = {
      cancel_reason: formattedReason,
      cancellation_status: 'PENDING',
      cancel_requested_by: isValidUuid(user.id) ? user.id : null,
      cancel_requested_at: new Date().toISOString()
    };

    let { error } = await supabase
      .from(targetTable)
      .update(updatePayloadWithWorkflow)
      .eq('id', paymentId);

    // Fallback 1 : Si la colonne cancellation_status n'existe pas en schéma, on enregistre dans cancel_reason
    if (error && (error.code === '42703' || error.message?.includes('column'))) {
      const fallbackPayload: any = {
        cancel_reason: formattedReason
      };
      const fallbackRes = await supabase
        .from(targetTable)
        .update(fallbackPayload)
        .eq('id', paymentId);
      error = fallbackRes.error;
    }

    if (error) {
      console.error(`Erreur soumission demande annulation (${targetTable}):`, error);
      throw new Error(error.message || "Échec de l'enregistrement de la demande.");
    }

    // Journalisation d'audit
    AuditLogger.log({
      school_id: user.school_id,
      user_id: user.id,
      action: 'PAYMENT_CANCELLATION_REQUESTED',
      entity_type: targetTable === 'school_supplies' || targetTable === 'supply_payments' ? 'supply' : 'payment',
      entity_id: paymentId,
      details: {
        payment_ref: paymentRef,
        student_id: studentId,
        reason: reason.trim(),
        amount,
        currency,
        requested_by_name: user.full_name || user.email
      }
    }).catch(() => {});

    return {
      success: true,
      message: "Demande d'annulation transmise avec succès à la Direction. Le solde restera inchangé jusqu'à validation."
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Erreur lors de la soumission de la demande d'annulation."
    };
  }
}

/**
 * Approuve définitivement l'annulation d'un paiement par un utilisateur de niveau Direction / Admin.
 * Met à jour le statut en 'ANNULE' et recrédite éventuellement le portefeuille élève.
 */
export async function approvePaymentCancellation(
  params: ApproveCancellationParams
): Promise<{ success: boolean; message: string; data?: any }> {
  try {
    const { 
      paymentId, 
      sourceTable = 'payments', 
      approverUser, 
      studentId, 
      amount = 0, 
      currency = 'HTG', 
      refundToWallet = false, 
      paymentRef, 
      existingReason 
    } = params;

    if (!paymentId) {
      throw new Error("Identifiant de transaction manquant.");
    }

    const targetTable = sourceTable === 'school_supplies' ? 'school_supplies' : sourceTable === 'supply_payments' ? 'supply_payments' : 'payments';

    const cleanReason = existingReason
      ? existingReason.replace(/^\[DEMANDE(?:_ANNULATION)?\]\s*/i, '').trim()
      : "Annulation approuvée par la Direction";

    const updatePayload: any = {
      status: 'ANNULE',
      cancelled_at: new Date().toISOString(),
      cancelled_by: isValidUuid(approverUser.id) ? approverUser.id : null,
      cancel_reason: cleanReason,
      cancellation_status: 'APPROVED'
    };

    let { error } = await supabase
      .from(targetTable)
      .update(updatePayload)
      .eq('id', paymentId);

    // Fallback si cancellation_status n'existe pas dans la table
    if (error && (error.code === '42703' || error.message?.includes('column'))) {
      delete updatePayload.cancellation_status;
      const fallbackRes = await supabase
        .from(targetTable)
        .update(updatePayload)
        .eq('id', paymentId);
      error = fallbackRes.error;
    }

    if (error) {
      console.error(`Erreur approbation annulation (${targetTable}):`, error);
      throw new Error(error.message || "Échec de la validation de l'annulation.");
    }

    // Remboursement optionnel vers le portefeuille de l'élève
    if (refundToWallet && studentId && isValidUuid(studentId) && amount > 0) {
      try {
        const { data: studentData, error: sErr } = await supabase
          .from('students')
          .select('wallet_balance_htg, wallet_balance_usd')
          .eq('id', studentId)
          .single();

        if (!sErr && studentData) {
          const isUSD = String(currency).toUpperCase() === 'USD';
          const updateWallet: any = {};
          if (isUSD) {
            updateWallet.wallet_balance_usd = Number(studentData.wallet_balance_usd || 0) + Number(amount);
          } else {
            updateWallet.wallet_balance_htg = Number(studentData.wallet_balance_htg || 0) + Number(amount);
          }

          await supabase
            .from('students')
            .update(updateWallet)
            .eq('id', studentId);
        }
      } catch (walletErr) {
        console.warn("Avertissement recrédit portefeuille suite à annulation:", walletErr);
      }
    }

    // Journalisation d'audit
    AuditLogger.log({
      school_id: approverUser.school_id,
      user_id: approverUser.id,
      action: 'PAYMENT_CANCELLATION_APPROVED',
      entity_type: targetTable === 'school_supplies' || targetTable === 'supply_payments' ? 'supply' : 'payment',
      entity_id: paymentId,
      details: {
        payment_ref: paymentRef,
        student_id: studentId,
        amount,
        currency,
        refundToWallet,
        reason: cleanReason,
        approved_by_name: approverUser.full_name || approverUser.email
      }
    }).catch(() => {});

    return {
      success: true,
      message: refundToWallet
        ? `Transaction annulée avec succès. Montant de ${amount} ${currency} recrédité sur le portefeuille de l'élève.`
        : "Annulation définitivement validée par la Direction. Le solde financier a été mis à jour."
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Erreur lors de la validation de l'annulation."
    };
  }
}

/**
 * Rejette une demande d'annulation. La transaction reste valide.
 */
export async function rejectPaymentCancellation(
  params: RejectCancellationParams
): Promise<{ success: boolean; message: string; data?: any }> {
  try {
    const { paymentId, sourceTable = 'payments', rejecterUser, rejectionReason, paymentRef } = params;

    if (!paymentId) {
      throw new Error("Identifiant de transaction manquant.");
    }

    const targetTable = sourceTable === 'school_supplies' ? 'school_supplies' : sourceTable === 'supply_payments' ? 'supply_payments' : 'payments';

    const cleanRejection = rejectionReason && rejectionReason.trim()
      ? `[REJET_ANNULATION] ${rejectionReason.trim()} (Direction: ${rejecterUser.full_name || rejecterUser.email})`
      : `[REJET_ANNULATION] Demande rejetée par la Direction (${rejecterUser.full_name || rejecterUser.email})`;

    const updatePayload: any = {
      status: 'VALIDE',
      cancellation_status: 'REJECTED',
      cancel_reason: cleanRejection,
      cancel_rejected_by: isValidUuid(rejecterUser.id) ? rejecterUser.id : null,
      cancel_rejected_at: new Date().toISOString()
    };

    let { error } = await supabase
      .from(targetTable)
      .update(updatePayload)
      .eq('id', paymentId);

    // Fallback si cancellation_status ou colonnes complémentaires n'existent pas
    if (error && (error.code === '42703' || error.message?.includes('column'))) {
      const fallbackPayload: any = {
        status: 'VALIDE',
        cancel_reason: cleanRejection
      };
      const fallbackRes = await supabase
        .from(targetTable)
        .update(fallbackPayload)
        .eq('id', paymentId);
      error = fallbackRes.error;
    }

    if (error) {
      console.error(`Erreur rejet annulation (${targetTable}):`, error);
      throw new Error(error.message || "Échec du rejet de l'annulation.");
    }

    // Journalisation d'audit
    AuditLogger.log({
      school_id: rejecterUser.school_id,
      user_id: rejecterUser.id,
      action: 'PAYMENT_CANCELLATION_REJECTED',
      entity_type: targetTable === 'school_supplies' || targetTable === 'supply_payments' ? 'supply' : 'payment',
      entity_id: paymentId,
      details: {
        payment_ref: paymentRef,
        rejection_reason: rejectionReason,
        rejected_by_name: rejecterUser.full_name || rejecterUser.email
      }
    }).catch(() => {});

    return {
      success: true,
      message: "Demande d'annulation rejetée. La transaction reste active et validée."
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Erreur lors du rejet de la demande d'annulation."
    };
  }
}
