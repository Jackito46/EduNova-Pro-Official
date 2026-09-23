import { UserProfile, UserRole } from '../types';

/**
 * Message d'alerte et de blocage officiel pour les opérations sensibles
 */
export const AUTONOMOUS_RESTRICTION_MESSAGE = 
  "Cette opération requiert un compte Administrateur certifié RH ou la validation d'un titulaire.";

/**
 * Étiquette d'audit renforcé pour les comptes autonomes
 */
export const AUTONOMOUS_AUDIT_TAG = '[COMPTE AUTONOME - SANS DOSSIER RH]';

/**
 * Vérifie si un utilisateur opère en Mode Autonome (sans dossier RH officiel)
 * Note: Un Super Admin n'est jamais considéré comme autonome ou restreint.
 */
export function isAutonomousAccount(user?: UserProfile | null): boolean {
  if (!user) return false;
  if (user.is_super_admin || user.role === UserRole.SUPER_ADMIN || (user.role as any) === 'SUPER_ADMIN') {
    return false;
  }
  // Les élèves et parents ont leurs propres profils
  if (user.role === UserRole.STUDENT || user.role === UserRole.PARENT) {
    return false;
  }
  
  // Si le statut is_autonomous est explicitement défini (true/false)
  if (typeof user.is_autonomous === 'boolean') {
    return user.is_autonomous;
  }

  // Fallback de sécurité : un compte sans lien RH (staff_id) est considéré autonome
  return !user.staff_id;
}

/**
 * Vérifie si l'utilisateur est un Administrateur sous tutelle (Administrateur en mode autonome)
 */
export function isAutonomousAdmin(user?: UserProfile | null): boolean {
  if (!user) return false;
  if (user.is_super_admin || user.role === UserRole.SUPER_ADMIN || (user.role as any) === 'SUPER_ADMIN') {
    return false;
  }
  
  const isAdminRole = user.role === UserRole.SCHOOL_ADMIN || user.role === UserRole.DIRECTOR;
  return isAdminRole && isAutonomousAccount(user);
}

/**
 * Vérifie si l'utilisateur est un Administrateur titulaire certifié RH
 */
export function isTitulaireAdmin(user?: UserProfile | null): boolean {
  if (!user) return false;
  if (user.is_super_admin || user.role === UserRole.SUPER_ADMIN || (user.role as any) === 'SUPER_ADMIN') {
    return true;
  }
  const isAdminRole = user.role === UserRole.SCHOOL_ADMIN || user.role === UserRole.DIRECTOR;
  return isAdminRole && Boolean(user.staff_id) && !user.is_autonomous;
}

export type SensitiveOperation = 
  | 'MANAGE_ADMINS'          // Supprimer, suspendre ou modifier d'autres admins
  | 'CREATE_ADMIN'           // Créer ou promouvoir un compte en admin
  | 'RESET_ADMIN_PASSWORD'   // Réinitialiser le mot de passe d'un admin
  | 'PAYROLL_MANAGEMENT'     // Valider paie, débourser salaires, approuver avances
  | 'SALARY_GRID_UPDATE'     // Modifier les salaires de base ou historiques
  | 'BANKING_CONFIG'         // Modifier coordonnées bancaires, clés MonCash, passerelles
  | 'DATA_PURGE';            // Purge de données, suppression de sauvegardes

/**
 * Évalue si l'utilisateur a l'habilitation nécessaire pour exécuter une opération sensible
 */
export function checkSensitiveOperation(
  user: UserProfile | null | undefined, 
  operation: SensitiveOperation,
  targetUser?: UserProfile | null
): { allowed: boolean; message: string } {
  if (!user) {
    return { allowed: false, message: "Utilisateur non authentifié." };
  }

  // Super Admin a tous les droits
  if (user.is_super_admin || user.role === UserRole.SUPER_ADMIN || (user.role as any) === 'SUPER_ADMIN') {
    return { allowed: true, message: "" };
  }

  // Si l'utilisateur est un compte autonome
  if (isAutonomousAccount(user)) {
    switch (operation) {
      case 'MANAGE_ADMINS':
        if (targetUser && (targetUser.role === UserRole.SCHOOL_ADMIN || targetUser.role === UserRole.DIRECTOR)) {
          return {
            allowed: false,
            message: "Action refusée : Seul un Administrateur titulaire certifié RH peut modifier ou supprimer un autre Administrateur."
          };
        }
        return {
          allowed: false,
          message: AUTONOMOUS_RESTRICTION_MESSAGE
        };

      case 'CREATE_ADMIN':
        return {
          allowed: false,
          message: "Action refusée : La création ou promotion d'un Administrateur requiert un compte certifié RH ou la validation d'un titulaire."
        };

      case 'RESET_ADMIN_PASSWORD':
        if (targetUser && (targetUser.role === UserRole.SCHOOL_ADMIN || targetUser.role === UserRole.DIRECTOR)) {
          return {
            allowed: false,
            message: "Action refusée : Réinitialisation du mot de passe d'un Administrateur interdite depuis un compte autonome sous tutelle."
          };
        }
        break;

      case 'PAYROLL_MANAGEMENT':
      case 'SALARY_GRID_UPDATE':
        return {
          allowed: false,
          message: "Action financière sensible verrouillée : La modification des salaires et la validation de paie (Payroll) exigent une fiche RH active."
        };

      case 'BANKING_CONFIG':
        return {
          allowed: false,
          message: "Sécurité Trésorerie : La modification des coordonnées bancaires et des passerelles MonCash est réservée aux titulaires certifiés de l'école."
        };

      case 'DATA_PURGE':
        return {
          allowed: false,
          message: "Intégrité des données : La purge de données ou suppression de sauvegardes est strictement interdite aux comptes autonomes."
        };
    }
  }

  return { allowed: true, message: "" };
}
