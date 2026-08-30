import React from 'react';
import { Navigate } from 'react-router-dom';
import { UserProfile, UserRole } from '../types';

interface SuperAdminRouteProps {
  user: UserProfile | null;
  children: React.ReactNode;
}

export const SuperAdminRoute: React.FC<SuperAdminRouteProps> = ({ user, children }) => {
  if (!user) return <Navigate to="/login" replace />;
  const isSuperAdmin = Boolean(user.is_super_admin || (user.role as any) === 'SUPER_ADMIN' || (user.role as any) === UserRole.SUPER_ADMIN);
  if (!isSuperAdmin) return <Navigate to="/" replace />; // Redirect to home if not super admin
  
  return <>{children}</>;
};
