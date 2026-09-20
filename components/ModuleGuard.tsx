import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSchool } from '../contexts/SchoolContext';
import { Lock, ArrowLeft, ShieldAlert } from 'lucide-react';
import { UserProfile, UserRole } from '../types';

interface ModuleGuardProps {
  moduleId: string;
  moduleName: string;
  user?: UserProfile | null;
  children: React.ReactNode;
}

export const ModuleGuard: React.FC<ModuleGuardProps> = ({ 
  moduleId, 
  moduleName, 
  user,
  children 
}) => {
  const { isModuleEnabled, loading } = useSchool();
  const navigate = useNavigate();

  // Super admin can always inspect even if toggled off
  const isSuperUser = Boolean(
    user?.is_super_admin || 
    user?.role === UserRole.SUPER_ADMIN || 
    (user?.role as any) === 'SUPER_ADMIN'
  );

  if (loading) {
    return <>{children}</>;
  }

  const isEnabled = isModuleEnabled(moduleId);

  if (!isEnabled && !isSuperUser) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center p-4 sm:p-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200/90 shadow-xl p-8 sm:p-10 text-center space-y-6">
          <div className="w-18 h-18 bg-amber-50 text-amber-600 rounded-3xl flex items-center justify-center mx-auto border border-amber-200/80 shadow-xs">
            <Lock size={32} />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-200">
              <ShieldAlert size={12} />
              <span>Module Désactivé</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {moduleName}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 font-medium leading-relaxed">
              Cette fonctionnalité a été désactivée par le Super Administrateur dans la configuration des modules ERP. L'accès à ce volet est actuellement suspendu.
            </p>
          </div>

          <div className="pt-2">
            <button 
              type="button"
              onClick={() => navigate('/')}
              className="w-full py-3.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-bold transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
            >
              <ArrowLeft size={16} />
              <span>Retour au Tableau de Bord</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
