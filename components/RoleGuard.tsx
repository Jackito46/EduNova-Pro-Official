import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { UserProfile, UserRole } from '../types';
import { toast } from 'sonner';

interface RoleGuardProps {
  user: UserProfile | null | undefined;
  allowedRoles: (UserRole | string)[];
  children: React.ReactNode;
  fallbackPath?: string;
  errorMessage?: string;
}

/**
 * Normalise un rôle vers sa valeur standard UserRole ou équivalente
 */
export function normalizeUserRole(role: string | UserRole | undefined | null): string {
  if (!role) return '';
  const upper = String(role).trim().toUpperCase();
  if (upper === 'ADMIN') return UserRole.SCHOOL_ADMIN;
  if (upper === 'DIRECTEUR') return UserRole.DIRECTOR;
  if (upper === 'COMPTABLE' || upper === 'CAISSIER') return UserRole.ACCOUNTANT;
  if (upper === 'SECRETAIRE') return UserRole.SECRETARY;
  if (upper === 'ENSEIGNANT' || upper === 'PROFESSEUR') return UserRole.TEACHER;
  if (upper === 'SURVEILLANT') return UserRole.SUPERVISOR;
  if (upper === 'ETUDIANT' || upper === 'ELEVE') return UserRole.STUDENT;
  return upper;
}

/**
 * Vérifie si l'utilisateur possède l'un des rôles autorisés
 */
export function isUserAuthorized(user: UserProfile | null | undefined, allowedRoles: (UserRole | string)[]): boolean {
  if (!user) return false;
  
  // Super administrateur a tous les accès
  const userRoleStr = normalizeUserRole(user.role);
  if (userRoleStr === UserRole.SUPER_ADMIN || user.is_super_admin) {
    return true;
  }

  const normalizedAllowed = allowedRoles.map(r => normalizeUserRole(r));
  return normalizedAllowed.includes(userRoleStr);
}

export const RoleGuard: React.FC<RoleGuardProps> = ({ 
  user, 
  allowedRoles, 
  children,
  fallbackPath = '/',
  errorMessage = "Accès restreint : Vous ne disposez pas des autorisations requises pour cette section."
}) => {
  const location = useLocation();

  if (!user) {
    return <Navigate to="/" replace />;
  }

  const authorized = isUserAuthorized(user, allowedRoles);

  if (!authorized) {
    // Alerte l'utilisateur en cas de tentative d'accès direct non autorisé via l'URL
    if (typeof window !== 'undefined') {
      const warnedKey = `role_denied_${location.pathname}`;
      if (!sessionStorage.getItem(warnedKey)) {
        sessionStorage.setItem(warnedKey, 'true');
        toast.error(errorMessage, { id: 'role-guard-denied', duration: 4000 });
        setTimeout(() => {
          try { sessionStorage.removeItem(warnedKey); } catch (e) {}
        }, 5000);
      }
    }
    return <Navigate to={fallbackPath} replace />;
  }

  return <>{children}</>;
};

export default RoleGuard;
