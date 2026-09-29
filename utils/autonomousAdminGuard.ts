import { UserProfile, UserRole } from '../types';

/**
 * Message d'avertissement standard affiché lorsqu'une action sensible
 * est bloquée pour un utilisateur opérant en mode autonome (sans dossier RH).
 */
export const AUTONOMOUS_RESTRICTION_MESSAGE = 
  "Action verrouillée : Cette opération sensible est restreinte pour les comptes en mode autonome (sans dossier RH officiel). Elle exige une certification RH ou une validation par Double Regard.";

/**
 * Détermine si le compte utilisateur est en "Mode Autonome" (non rattaché à un dossier RH certifié).
 * 
 * Règle de gouvernance & imputabilité légale :
 * - Les Super Administrateurs ne sont JAMAIS soumis au mode autonome.
 * - Si le flag `is_autonomous` est explicitement défini à true, le compte est autonome.
 * - Si le compte ne possède pas de `staff_id` (aucun dossier collaborateur RH lié),
 *   et qu'il n'est pas explicitement certifié RH (`rh_verified`), il est considéré autonome.
 */
export function isAutonomousAccount(user?: Partial<UserProfile> | null): boolean {
  if (!user) return false;

  // Un super administrateur possède l'autorité suprême et n'est jamais restreint
  if (user.is_super_admin || user.role === UserRole.SUPER_ADMIN) {
    return false;
  }

  // Flag explicite
  if (user.is_autonomous === true) {
    return true;
  }

  if (user.is_autonomous === false) {
    return false;
  }

  // Si rh_verified est expressément validé avec un dossier RH
  if (user.rh_verified === true && (user.staff_id || (user as any).linked_staff_id)) {
    return false;
  }

  // Vérification de repli : absence de dossier collaborateur RH officiel
  const hasStaffLink = Boolean(user.staff_id || (user as any).linked_staff_id);
  return !hasStaffLink;
}

/**
 * Vérifie si l'utilisateur a l'autorisation d'exécuter une opération sensible,
 * et lève une erreur explicite sinon.
 */
export function assertNonAutonomous(user?: Partial<UserProfile> | null, customMessage?: string): void {
  if (isAutonomousAccount(user)) {
    throw new Error(customMessage || AUTONOMOUS_RESTRICTION_MESSAGE);
  }
}

/**
 * Retourne le statut et les restrictions applicables à l'utilisateur.
 */
export function getAutonomousAccountStatus(user?: Partial<UserProfile> | null) {
  const isAutonomous = isAutonomousAccount(user);
  return {
    isAutonomous,
    canManageAdministrators: !isAutonomous,
    canManagePayroll: !isAutonomous,
    canManagePaymentGateways: !isAutonomous,
    canDeleteBackups: !isAutonomous,
    restrictionMessage: isAutonomous ? AUTONOMOUS_RESTRICTION_MESSAGE : null
  };
}
