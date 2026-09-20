import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Monitor, ShieldAlert, ArrowLeft, RefreshCw, Smartphone, CheckCircle2, Lock, Sparkles, Laptop } from 'lucide-react';
import { UserProfile, UserRole } from '../types';
import { normalizeUserRole } from './RoleGuard';

interface DesktopDeviceGuardProps {
  user: UserProfile | null | undefined;
  children: React.ReactNode;
  moduleTitle?: string;
  description?: string;
  minWidth?: number;
}

/**
 * Hook to detect whether the user is on a Desktop workstation (PC/Mac/Laptop)
 * with a standard desktop viewport (>= 1024px by default).
 */
export function useIsDesktopWorkstation(minWidth: number = 1024): {
  isDesktop: boolean;
  screenWidth: number;
} {
  const [screenWidth, setScreenWidth] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth;
    }
    return 1200;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      setScreenWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize, { passive: true });
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return {
    isDesktop: screenWidth >= minWidth,
    screenWidth
  };
}

/**
 * DesktopDeviceGuard
 * 
 * Enforces security policy requiring an official desktop workstation (PC/Mac)
 * for sensitive administrative operations (bulletins, grades deliberation, finances),
 * while granting a full development bypass to the SUPER_ADMIN on any device.
 */
export const DesktopDeviceGuard: React.FC<DesktopDeviceGuardProps> = ({
  user,
  children,
  moduleTitle = "Opérations Administratives & Officielles",
  description,
  minWidth = 1024,
}) => {
  const navigate = useNavigate();
  const { isDesktop, screenWidth } = useIsDesktopWorkstation(minWidth);
  const [bypassWarningDismissed, setBypassWarningDismissed] = useState(false);

  // Executive Roles with Total Derogation (Dev & Production):
  // Super Admin, School Admin (Admin d'école), and School Director (Directeur)
  const roleStr = normalizeUserRole(user?.role);
  const isSuperAdmin = roleStr === UserRole.SUPER_ADMIN || user?.is_super_admin === true;
  const isSchoolAdmin = roleStr === UserRole.SCHOOL_ADMIN;
  const isDirector = roleStr === UserRole.DIRECTOR;

  const hasExecutiveDerogation = isSuperAdmin || isSchoolAdmin || isDirector;

  // Executive bypass: always allowed on mobile/tablet for Super Admin, School Admin & Director
  if (hasExecutiveDerogation) {
    const roleLabel = isSuperAdmin 
      ? 'Super Administrateur' 
      : isSchoolAdmin 
        ? "Administration d'École" 
        : 'Direction Pédagogique';

    return (
      <div className="w-full">
        {!isDesktop && !bypassWarningDismissed && (
          <div className="mb-4 mx-2 sm:mx-4 p-3 bg-indigo-900/90 backdrop-blur-xs border border-indigo-700/80 rounded-2xl flex items-center justify-between gap-3 text-white text-xs shadow-lg animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <span className="p-1.5 rounded-xl bg-gradient-to-tr from-amber-400 to-amber-500 text-slate-950 font-black shrink-0 shadow-xs">
                <Sparkles size={14} />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-black uppercase tracking-wider text-[10px] text-amber-300">
                    Dérogation Direction & Administration Active
                  </span>
                  <span className="px-1.5 py-0.2 rounded-md bg-indigo-800 text-indigo-200 text-[9px] font-bold">
                    {roleLabel}
                  </span>
                </div>
                <p className="font-medium text-slate-200 text-[11.5px] mt-0.5 leading-snug">
                  Accès mobile autorisé pour la gouvernance (Super Admin, Admins & Directeurs). Pour les autres rôles opérationnels, un poste PC reste exigé.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setBypassWarningDismissed(true)}
              className="px-2.5 py-1 text-[11px] font-bold text-slate-300 hover:text-white hover:bg-white/10 rounded-xl shrink-0 transition-colors"
            >
              Masquer
            </button>
          </div>
        )}
        {children}
      </div>
    );
  }

  // If user is on a Desktop PC/Mac, render normally
  if (isDesktop) {
    return <>{children}</>;
  }

  // Otherwise, user is on Mobile/Tablet and is NOT Super Admin:
  // Show Institutional Workstation Security Shield
  return (
    <div className="min-h-[82vh] flex items-center justify-center p-3 sm:p-6 animate-in fade-in zoom-in-95 duration-200">
      <div className="max-w-xl w-full bg-white rounded-3xl border border-slate-200/90 shadow-2xl p-6 sm:p-8 text-center relative overflow-hidden">
        {/* Background glow watermark */}
        <div className="absolute -top-24 -right-24 w-60 h-60 bg-blue-50 rounded-full blur-3xl pointer-events-none opacity-60"></div>
        <div className="absolute -bottom-24 -left-24 w-60 h-60 bg-indigo-50 rounded-full blur-3xl pointer-events-none opacity-60"></div>

        {/* Device Security Icon */}
        <div className="relative mx-auto mb-6 flex items-center justify-center">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-tr from-slate-900 via-indigo-950 to-blue-900 text-white flex items-center justify-center shadow-xl shadow-indigo-950/20 border-2 border-white">
            <Monitor size={40} className="text-blue-300 animate-pulse" />
          </div>
          <span className="absolute -bottom-1 -right-1 p-2 rounded-2xl bg-amber-500 text-white shadow-md border-2 border-white">
            <Lock size={16} />
          </span>
        </div>

        {/* Security Badges */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200/80 text-blue-800 text-[11px] font-black uppercase tracking-wider mb-3">
          <ShieldAlert size={12} className="text-blue-600" />
          <span>Sécurité & Conformité des Données Scolaires</span>
        </div>

        {/* Title */}
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-snug">
          Poste de Travail (PC) Requis
        </h2>
        <p className="text-xs sm:text-sm font-semibold text-indigo-600 mt-1">
          {moduleTitle}
        </p>

        {/* Explanatory notice */}
        <div className="mt-4 p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-left text-xs sm:text-[13px] text-slate-600 leading-relaxed space-y-2">
          <p>
            {description || (
              <>
                Pour garantir l’intégrité des calculs, la conformité des documents officiels et la sécurité des opérations administratives critiques, ce module nécessite un <strong>ordinateur de bureau ou PC portable</strong>.
              </>
            )}
          </p>
          <div className="pt-2 border-t border-slate-200/70 grid grid-cols-1 gap-2 text-[11.5px]">
            <div className="flex items-start gap-2 text-slate-700">
              <Laptop size={14} className="text-indigo-600 shrink-0 mt-0.5" />
              <span><strong>Sur PC :</strong> Édition & clôture des bulletins, délibération des notes, opérations de caisse & bilans officiels.</span>
            </div>
            <div className="flex items-start gap-2 text-slate-500">
              <Smartphone size={14} className="text-slate-400 shrink-0 mt-0.5" />
              <span><strong>Sur Mobile :</strong> Consultation des présences, alertes, notifications et suivi quotidien.</span>
            </div>
          </div>
        </div>

        {/* Screen size tip */}
        <div className="mt-4 px-3 py-2 rounded-xl bg-amber-50/70 border border-amber-200 text-[11px] text-amber-800 font-medium flex items-center justify-center gap-2">
          <span>Écran actuel : <strong>{screenWidth}px</strong></span>
          <span>•</span>
          <span>Résolution requise : <strong>≥ {minWidth}px</strong> (Desktop)</span>
        </div>

        {/* Actions */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all"
          >
            <ArrowLeft size={14} />
            <span>Tableau de Bord</span>
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold text-xs flex items-center justify-center gap-2 shadow-2xs transition-all"
          >
            <RefreshCw size={14} />
            <span>Actualiser l'affichage</span>
          </button>
        </div>

        {/* Connected account metadata */}
        <p className="mt-5 text-[10.5px] text-slate-400 font-medium">
          Compte connecté : <span className="text-slate-600 font-bold">{user?.full_name || user?.email}</span> ({user?.role || 'Utilisateur'})
        </p>
      </div>
    </div>
  );
};

export default DesktopDeviceGuard;
