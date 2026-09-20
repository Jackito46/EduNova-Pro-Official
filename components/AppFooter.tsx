import React from 'react';

interface AppFooterProps {
  className?: string;
}

/**
 * Pied de page global d'application - Moderne, épuré et discret.
 * Conforme à la directive : © 2026 EduNova Pro Technologies Inc. • Tous droits réservés.
 */
export const AppFooter: React.FC<AppFooterProps> = ({ className = '' }) => {
  const currentYear = new Date().getFullYear();

  return (
    <footer 
      id="app-global-footer"
      className={`w-full mt-6 mb-4 sm:mt-8 sm:mb-6 py-3 select-none print:hidden transition-all duration-300 ${className}`}
      aria-label="Pied de page"
    >
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-center text-center">
        <p className="text-[11px] sm:text-xs text-slate-400 dark:text-slate-500 font-medium tracking-normal">
          &copy; {currentYear} EduNova Pro Technologies Inc. <span className="inline">• Tous droits réservés.</span>
        </p>
      </div>
    </footer>
  );
};

export default AppFooter;
