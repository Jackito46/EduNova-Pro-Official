import React from 'react';
import { Navigate } from 'react-router-dom';
import { UserProfile } from '../types';

interface SuperAdminRouteProps {
  user: UserProfile | null;
  children: React.ReactNode;
}

export const SuperAdminRoute: React.FC<SuperAdminRouteProps> = ({ user, children }) => {
  if (!user) return <Navigate to="/login" replace />;
  if (!user.is_super_admin) return <Navigate to="/" replace />; // Redirect to home if not super admin
  
  return <>{children}</>;
};
