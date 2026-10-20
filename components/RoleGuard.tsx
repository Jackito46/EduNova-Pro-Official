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
  const clean = String(role)
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[\s\-_]+/g, '_');

  if (clean.includes('SUPER_ADMIN') || clean.includes('SUPERADMIN')) return UserRole.SUPER_ADMIN;
  if (clean.includes('PARENT') || clean.includes('TUTEUR') || clean.includes('RESPONSABLE')) return UserRole.PARENT;
  if (clean.includes('ADMIN') || clean.includes('GESTIONNAIRE')) return UserRole.SCHOOL_ADMIN;
  if (clean.includes('DIRECT') || clean === 'DIR' || clean.includes('RECTEUR') || clean.includes('PROVISEUR') || clean.includes('PRINCIPAL')) return UserRole.DIRECTOR;
  if (clean.includes('COMPT') || clean.includes('CAISS') || clean.includes('ECONOM') || clean.includes('FINANC') || clean.includes('TRESOR')) return UserRole.ACCOUNTANT;
  if (clean.includes('SECRET') || clean.includes('REGISTRAR') || clean.includes('ADMISSION')) return UserRole.SECRETARY;
  if (clean.includes('ENSEIGN') || clean.includes('PROF') || clean.includes('TEACH') || clean.includes('FORMATEUR')) return UserRole.TEACHER;
  if (clean.includes('SURVEILL') || clean.includes('DISCIPLIN') || clean.includes('CENSEUR') || clean.includes('PREFET') || clean.includes('DOYEN')) return UserRole.SUPERVISOR;
  if (clean.includes('BIBLIO') || clean.includes('LIBRAR')) return UserRole.LIBRARIAN;
  if (clean.includes('ETUDI') || clean.includes('ELEV') || clean.includes('STUDENT')) return UserRole.STUDENT;

  return clean;
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
