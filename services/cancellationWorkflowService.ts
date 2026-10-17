import { supabase } from '../supabase';
import { UserProfile, UserRole } from '../types';
import { AuditLogger } from '../utils/auditLogger';

export type CancellationStatus = 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';

export interface CancellationMetadata {
  status: CancellationStatus;
  requested_by?: string;
  requested_at?: string;
  requested_by_name?: string;
  reason?: string;
  approved_by?: string;
  approved_at?: string;
  approved_by_name?: string;
  rejected_by?: string;
  rejected_at?: string;
  rejection_reason?: string;
}

/**
 * Détermine si l'utilisateur a les prérogatives pour valider ou rejeter une annulation
 * (Rôles requis : Admin, School Admin, Super Admin, Direction, Directeur)
 */
export function canUserApproveCancellation(user: UserProfile | null | undefined): boolean {
  if (!user) return false;
  if (user.is_super_admin) return true;
  
  const role = String(user.role || '').toUpperCase().trim();
  const allowedRoles = [
    'SUPER_ADMIN',
    'SCHOOL_ADMIN',
    'ADMIN',
    'DIRECTOR',
    'DIRECTEUR',
    'DIRECTION',
    'PRINCIPAL',
    UserRole.SUPER_ADMIN,
    UserRole.SCHOOL_ADMIN,
    UserRole.DIRECTOR
  ];

  return allowedRoles.some(r => String(r).toUpperCase().trim() === role);
}

/**
 * Analyse le statut d'annulation d'un paiement de façon rétrocompatible et résiliente
 */
export function parseCancellationInfo(payment: any): {
  isPending: boolean;
  isCancelled: boolean;
  isRejected: boolean;
  reason: string;
  requestedBy: string;
  requestedByName: string;
  requestedAt: string;
  approvedByName?: string;
  rejectedByName?: string;
  rejectionReason?: string;
} {
  if (!payment) {
    return {
      isPending: false,
      isCancelled: false,
      isRejected: false,
      reason: '',
      requestedBy: '',
      requestedByName: '',
      requestedAt: ''
    };
  }

  // 1. Colonne explicite cancellation_status
  const explicitStatus = String(payment.cancellation_status || '').toUpperCase();
  const rawStatus = String(payment.status || '').toUpperCase();

  // 2. Vérification dans cancel_reason ou notes si sérialisé en JSON
  let parsedJson: any = null;
  const rawReason = String(payment.cancel_reason || payment.cancellation_reason || '');
  if (rawReason.startsWith('PENDING_APPROVAL:')) {
    try {
      parsedJson = JSON.parse(rawReason.replace('PENDING_APPROVAL:', ''));
    } catch {}
  } else if (rawReason.startsWith('REJECTED:')) {
    try {
      parsedJson = JSON.parse(rawReason.replace('REJECTED:', ''));
    } catch {}
  } else if (rawReason.startsWith('{') && rawReason.endsWith('}')) {
    try {
      parsedJson = JSON.parse(rawReason);
    } catch {}
  }

  const isPending = 
    explicitStatus === 'PENDING' || 
    rawStatus === 'ANNULATION_DEMANDEE' || 
    rawStatus === 'PENDING_CANCELLATION' ||
    Boolean(parsedJson?.is_pending);

  const isCancelled = rawStatus === 'ANNULE' || rawStatus === 'CANCELLED' || explicitStatus === 'APPROVED';
  const isRejected = explicitStatus === 'REJECTED' || Boolean(parsedJson?.is_rejected) || rawReason.startsWith('REJECTED:');

  const reason = payment.cancellation_reason || parsedJson?.reason || payment.cancel_reason || '';
  const requestedBy = payment.cancellation_requested_by || parsedJson?.requested_by || '';
  const requestedByName = payment.cancellation_requested_by_name || parsedJson?.requested_by_name || '';
  const requestedAt = payment.cancellation_requested_at || parsedJson?.requested_at || payment.cancelled_at || '';
  const approvedByName = payment.cancellation_approved_by_name || parsedJson?.approved_by_name;
  const rejectedByName = payment.cancellation_rejected_by_name || parsedJson?.rejected_by_name;
  const rejectionReason = payment.cancellation_rejection_reason || parsedJson?.rejection_reason;

  return {
    isPending,
    isCancelled,
    isRejected,
    reason,
    requestedBy,
    requestedByName,
    requestedAt,
    approvedByName,
    rejectedByName,
    rejectionReason
  };
}

/**
 * Étape 1 : Un agent initie une demande d'annulation
 * Vérifie d'abord l'existence de la transaction dans le système.
 * Le solde de l'élève reste INTACT tant que la Direction/Admin n'a pas validé.
 */
export async function requestPaymentCancellation({
  paymentId,
  sourceTable = 'payments',
  reason,
  user,
  studentId,
  paymentRef,
  amount,
  currency = 'HTG'
}: {
  paymentId: string;
  sourceTable?: 'payments' | 'supply_payments' | 'school_supplies';
  reason: string;
  user: UserProfile;
  studentId?: string;
  paymentRef?: string;
  amount?: number;
  currency?: string;
}): Promise<{ success: boolean; message: string; error?: string }> {
  if (!paymentId) {
    return { success: false, message: 'ID de transaction introuvable' };
  }
  if (!reason || !reason.trim()) {
    return { success: false, message: "Le motif d'annulation est obligatoire." };
  }

  // Vérification rigoureuse de l'existence de la transaction dans la base
  try {
    const { data: existingPayment, error: checkError } = await supabase
      .from(sourceTable)
      .select('id, status, amount, student_id, cancellation_status')
      .eq('id', paymentId)
      .maybeSingle();

    if (checkError || !existingPayment) {
      return { 
        success: false, 
        message: "Impossible de créer la demande : la transaction spécifiée n'existe pas dans le système." 
      };
    }

    if (existingPayment.status === 'ANNULE' && existingPayment.cancellation_status === 'APPROVED') {
      return {
        success: false,
        message: "Cette transaction est déjà définitivement annulée."
      };
    }
  } catch (err: any) {
    console.warn("Vérification existence transaction:", err);
  }

  const now = new Date().toISOString();
  const agentName = user.full_name || user.email || 'Agent de caisse';

  const cancellationPayload = {
    is_pending: true,
    reason: reason.trim(),
    requested_by: user.id,
    requested_by_name: agentName,
    requested_at: now,
    student_id: studentId,
    amount,
    currency,
    ref: paymentRef
  };

  const serializedReason = `PENDING_APPROVAL:${JSON.stringify(cancellationPayload)}`;

  try {
    // Tentative de mise à jour avec les colonnes étendues
    let updatePayload: any = {
      cancellation_status: 'PENDING',
      cancellation_requested_by: user.id,
      cancellation_requested_at: now,
      cancellation_requested_by_name: agentName,
      cancellation_reason: reason.trim(),
      cancel_reason: serializedReason
    };

    const { error: primaryError } = await supabase
      .from(sourceTable)
      .update(updatePayload)
      .eq('id', paymentId);

    if (primaryError) {
      // Si une colonne spécifique n'existe pas encore dans le schéma SQL,
      // on enregistre de manière résiliente dans cancel_reason
      const fallbackPayload = {
        cancel_reason: serializedReason
      };
      const { error: fallbackError } = await supabase
        .from(sourceTable)
        .update(fallbackPayload)
        .eq('id', paymentId);

      if (fallbackError) {
        throw new Error(fallbackError.message || primaryError.message);
      }
    }

    // Journal d'audit pour traçabilité de la demande
    await AuditLogger.log({
      school_id: user.school_id || '',
      user_id: user.id,
      action: 'PAYMENT_CANCELLATION_REQUESTED',
      entity_type: 'payment',
      entity_id: paymentId,
      details: {
        reason: reason.trim(),
        agent_name: agentName,
        payment_ref: paymentRef,
        amount,
        currency,
        source_table: sourceTable,
        note: "Demande d'annulation saisie par un agent - En attente d'approbation Direction"
      }
    });

    return {
      success: true,
      message: "Demande d'annulation transmise à la Direction. Le solde de l'élève reste inchangé jusqu'à validation."
    };
  } catch (err: any) {
    return {
      success: false,
      message: "Erreur lors de la soumission de la demande d'annulation",
      error: err.message || String(err)
    };
  }
}

/**
 * Étape 2 : Un utilisateur de niveau 'Admin' ou 'Direction' valide l'annulation
 * C'est à ce moment précis que le statut passe à 'ANNULE' et que le solde est mis à jour !
 * Vérifie d'abord l'existence de la transaction dans le système.
 */
export async function approvePaymentCancellation({
  paymentId,
  sourceTable = 'payments',
  approverUser,
  studentId,
  amount,
  currency = 'HTG',
  paymentMethod,
  refundToWallet = false,
  paymentRef,
  existingReason
}: {
  paymentId: string;
  sourceTable?: 'payments' | 'supply_payments' | 'school_supplies';
  approverUser: UserProfile;
  studentId?: string;
  amount?: number;
  currency?: string;
  paymentMethod?: string;
  refundToWallet?: boolean;
  paymentRef?: string;
  existingReason?: string;
}): Promise<{ success: boolean; message: string; error?: string }> {
  if (!canUserApproveCancellation(approverUser)) {
    return {
      success: false,
      message: "Action non autorisée : Seul un utilisateur de niveau 'Admin' ou 'Direction' peut valider cette annulation."
    };
  }

  if (!paymentId) {
    return { success: false, message: "Identifiant de la transaction introuvable." };
  }

  // 1. Vérification préalable de l'existence de la transaction dans le système
  let fetchedPayment: any = null;
  try {
    const { data, error: fetchErr } = await supabase
      .from(sourceTable)
      .select('*')
      .eq('id', paymentId)
      .maybeSingle();

    if (fetchErr || !data) {
      return {
        success: false,
        message: "Impossible de valider : la transaction à annuler n'existe pas ou a été supprimée."
      };
    }
    fetchedPayment = data;
  } catch (err: any) {
    return {
      success: false,
      message: "Erreur lors de la vérification de l'existence de la transaction : " + (err.message || String(err))
    };
  }

  if (fetchedPayment.status === 'ANNULE' && fetchedPayment.cancellation_status === 'APPROVED') {
    return {
      success: false,
      message: "Cette transaction a déjà été définitivement validée comme annulée."
    };
  }

  // Résolution automatique des métadonnées si omises par l'appelant
  const effStudentId = studentId || fetchedPayment.student_id;
  const effAmount = amount ?? Number(fetchedPayment.amount || 0);
  const effCurrency = currency || fetchedPayment.currency || 'HTG';
  const effPaymentMethod = paymentMethod || fetchedPayment.payment_method || '';
  const effRef = paymentRef || fetchedPayment.ref || fetchedPayment.receipt_number || '';
  const effFeeType = fetchedPayment.fee_type || '';

  const now = new Date().toISOString();
  const approverName = approverUser.full_name || approverUser.email || 'Direction / Administration';
  const effectiveReason = existingReason || fetchedPayment.cancellation_reason || 'Annulation certifiée conforme par la Direction';

  try {
    // 2. Mise à jour du versement : statut passe définitivement à 'ANNULE'
    let updatePayload: any = {
      status: 'ANNULE',
      cancelled_at: now,
      cancelled_by: approverUser.id,
      cancel_reason: effectiveReason,
      cancellation_status: 'APPROVED',
      cancellation_approved_by: approverUser.id,
      cancellation_approved_at: now,
      cancellation_approved_by_name: approverName
    };

    const { error: primaryError } = await supabase
      .from(sourceTable)
      .update(updatePayload)
      .eq('id', paymentId);

    if (primaryError) {
      // Repli sur colonnes de base
      const fallbackPayload = {
        status: 'ANNULE',
        cancelled_at: now,
        cancelled_by: approverUser.id,
        cancel_reason: effectiveReason
      };
      const { error: fallbackError } = await supabase
        .from(sourceTable)
        .update(fallbackPayload)
        .eq('id', paymentId);

      if (fallbackError) {
        throw new Error(fallbackError.message || primaryError.message);
      }
    }

    // 3. Mise à jour effective du solde / portefeuille si applicable
    if (effStudentId && effAmount > 0) {
      const isWalletReload = effFeeType === 'CREDIT_PORTEFEUILLE' || effPaymentMethod === 'CREDIT_PORTEFEUILLE';
      const isPaidViaWallet = effPaymentMethod === 'Portefeuille' || effPaymentMethod?.toLowerCase().includes('portefeuille');
      const shouldRefundToWallet = refundToWallet || isPaidViaWallet;

      if (isWalletReload || shouldRefundToWallet) {
        const { data: studentData, error: studentError } = await supabase
          .from('students')
          .select('wallet_balance_htg, wallet_balance_usd')
          .eq('id', effStudentId)
          .single();

        if (!studentError && studentData) {
          const updateField = effCurrency === 'USD' ? 'wallet_balance_usd' : 'wallet_balance_htg';
          const currentBalance = Number(
            effCurrency === 'USD' 
              ? (studentData.wallet_balance_usd || 0) 
              : (studentData.wallet_balance_htg || 0)
          );

          // Si c'était une recharge annulée, on retire le montant du wallet
          // Si c'était un paiement effectué par wallet ou remboursé au wallet, on recrédite
          const newBalance = isWalletReload 
            ? Math.max(0, currentBalance - effAmount)
            : (currentBalance + effAmount);

          await supabase
            .from('students')
            .update({ 
              [updateField]: newBalance,
              updated_at: now
            })
            .eq('id', effStudentId);
        }
      }
    }

    // 4. Journal d'audit officiel
    await AuditLogger.log({
      school_id: approverUser.school_id || '',
      user_id: approverUser.id,
      action: 'PAYMENT_CANCELLATION_APPROVED',
      entity_type: 'payment',
      entity_id: paymentId,
      details: {
        reason: effectiveReason,
        approver_name: approverName,
        payment_ref: effRef,
        amount: effAmount,
        currency: effCurrency,
        refunded_to_wallet: refundToWallet || effPaymentMethod === 'Portefeuille',
        source_table: sourceTable,
        note: "Deuxième validation approuvée par Direction/Admin. Statut passé à ANNULÉ et solde mis à jour."
      }
    });

    return {
      success: true,
      message: "Annulation validée avec succès par la Direction. Le solde de l'élève a été actualisé."
    };
  } catch (err: any) {
    return {
      success: false,
      message: "Erreur lors de la validation de l'annulation",
      error: err.message || String(err)
    };
  }
}

/**
 * Rejet d'une demande d'annulation par un utilisateur de niveau Admin ou Direction
 * Vérifie l'existence de la transaction dans le système.
 */
export async function rejectPaymentCancellation({
  paymentId,
  sourceTable = 'payments',
  rejecterUser,
  rejectionReason,
  paymentRef
}: {
  paymentId: string;
  sourceTable?: 'payments' | 'supply_payments' | 'school_supplies';
  rejecterUser: UserProfile;
  rejectionReason: string;
  paymentRef?: string;
}): Promise<{ success: boolean; message: string; error?: string }> {
  if (!canUserApproveCancellation(rejecterUser)) {
    return {
      success: false,
      message: "Action non autorisée : Seul un utilisateur de niveau 'Admin' ou 'Direction' peut rejeter une annulation."
    };
  }

  if (!paymentId) {
    return { success: false, message: "Identifiant de la transaction introuvable." };
  }

  // Vérification préalable de l'existence de la transaction dans la base
  try {
    const { data: existingPayment, error: fetchErr } = await supabase
      .from(sourceTable)
      .select('id, status, ref')
      .eq('id', paymentId)
      .maybeSingle();

    if (fetchErr || !existingPayment) {
      return {
        success: false,
        message: "Impossible de rejeter : la transaction spécifiée n'existe pas dans le système."
      };
    }
  } catch (err: any) {
    return {
      success: false,
      message: "Erreur lors de la vérification de la transaction : " + (err.message || String(err))
    };
  }

  const now = new Date().toISOString();
  const rejecterName = rejecterUser.full_name || rejecterUser.email || 'Direction';

  try {
    const serializedInfo = `REJECTED:{"rejected_by":"${rejecterUser.id}","rejected_by_name":"${rejecterName}","rejected_at":"${now}","rejection_reason":"${rejectionReason || 'Non justifié'}"}`;

    let updatePayload: any = {
      status: 'VALIDE',
      cancellation_status: 'REJECTED',
      cancellation_rejected_by: rejecterUser.id,
      cancellation_rejected_at: now,
      cancellation_rejection_reason: rejectionReason || 'Rejeté par la Direction',
      cancel_reason: serializedInfo
    };

    const { error: primaryError } = await supabase
      .from(sourceTable)
      .update(updatePayload)
      .eq('id', paymentId);

    if (primaryError) {
      const fallbackPayload = {
        status: 'VALIDE',
        cancel_reason: serializedInfo
      };
      await supabase.from(sourceTable).update(fallbackPayload).eq('id', paymentId);
    }

    await AuditLogger.log({
      school_id: rejecterUser.school_id || '',
      user_id: rejecterUser.id,
      action: 'PAYMENT_CANCELLATION_REJECTED',
      entity_type: 'payment',
      entity_id: paymentId,
      details: {
        rejection_reason: rejectionReason,
        rejecter_name: rejecterName,
        payment_ref: paymentRef,
        source_table: sourceTable,
        note: "Demande d'annulation rejetée par la Direction. Le paiement demeure valide."
      }
    });

    return {
      success: true,
      message: "Demande d'annulation rejetée. Le versement reste valide et inchangé."
    };
  } catch (err: any) {
    return {
      success: false,
      message: "Erreur lors du rejet de la demande",
      error: err.message || String(err)
    };
  }
}

/**
 * Récupère le nombre de demandes d'annulation en attente pour l'établissement
 */
export async function getPendingCancellationsCount(schoolId?: string): Promise<number> {
  try {
    let query = supabase
      .from('payments')
      .select('id, cancellation_status, status, cancel_reason');

    if (schoolId) {
      query = query.eq('school_id', schoolId);
    }

    const { data, error } = await query;
    if (error || !data) return 0;

    return data.filter((p: any) => parseCancellationInfo(p).isPending).length;
  } catch {
    return 0;
  }
}
