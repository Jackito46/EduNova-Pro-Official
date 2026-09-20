import React from 'react';

interface AppFooterProps {
  className?: string;
}

/**
 * Pied de page global EduNova Pro - Moderne, fluide et épuré.
 * Design ergonomique en capsule flottante avec micro-interactions.
 */
export const AppFooter: React.FC<AppFooterProps> = ({ className = '' }) => {
  const currentYear = new Date().getFullYear();

  return (
    <footer 
      id="app-global-footer"
      className={`w-full mt-6 mb-4 sm:mt-8 sm:mb-6 pt-3 pb-2 select-none print:hidden transition-all duration-300 ${className}`}
    >
      <div className="max-w-7xl mx-auto px-4 flex flex-col items-center justify-center">
        <div className="group inline-flex items-center gap-3 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-2xl bg-white/85 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/70 dark:border-slate-800/80 shadow-[0_2px_10px_-3px_rgba(15,23,42,0.04)] hover:shadow-[0_4px_16px_-4px_rgba(37,99,235,0.08)] hover:border-blue-200 dark:hover:border-blue-900/50 transition-all duration-300">
          {/* Logo EN Squircle avec animation fluide au survol */}
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 flex items-center justify-center text-white font-black text-[11px] sm:text-xs shadow-xs shadow-blue-500/20 shrink-0 tracking-tight transition-transform duration-300 group-hover:scale-105 group-hover:shadow-blue-500/30">
            EN
          </div>

          {/* Typographie & Métadonnées de marque */}
          <div className="text-left flex flex-col justify-center">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-slate-800 dark:text-slate-100 tracking-tight text-xs sm:text-[13px]">
                EduNova Pro<span className="text-blue-600 dark:text-blue-400 text-[9px] sm:text-[10px] font-bold align-super ml-0.5">™</span>
              </span>

              {/* Indicateur de statut connecté fluide et discret */}
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-400 text-[9.5px] font-semibold leading-none tracking-tight">
                <span className="relative flex h-1.5 w-1.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                </span>
                <span className="hidden xs:inline">École Connectée</span>
              </div>
            </div>

            <p className="text-[10px] sm:text-[11px] text-slate-400 dark:text-slate-500 font-medium leading-tight mt-0.5 tracking-normal">
              &copy; {currentYear} EduNova Technologies Inc. <span className="hidden sm:inline">• Tous droits réservés.</span>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default AppFooter;
