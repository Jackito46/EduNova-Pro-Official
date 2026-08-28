import React from 'react';
import { Navigate } from 'react-router-dom';
import { UserProfile, UserRole } from '../types';

interface RoleGuardProps {
  user: UserProfile;
  allowedRoles: UserRole[];
  children: React.ReactNode;
  fallbackPath?: string;
}

export const RoleGuard: React.FC<RoleGuardProps> = ({ 
  user, 
  allowedRoles, 
  children,
  fallbackPath = '/'
}) => {
  if (user.role === UserRole.SUPER_ADMIN || user.is_super_admin) {
    return <>{children}</>;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={fallbackPath} replace />;
  }

  return <>{children}</>;
};
