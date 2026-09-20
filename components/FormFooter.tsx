import React from 'react';

interface FormFooterProps {
  className?: string;
  variant?: 'floating' | 'minimal' | 'card' | 'dark' | string;
  showSecurityBadge?: boolean;
  securityText?: string;
  year?: number | string;
  brandName?: string;
  tagline?: string;
}

/**
 * Pied de page épuré, sobre et officiel pour les formulaires.
 * Format demandé : © 2026 EduNova Pro Technologies Inc. • Tous droits réservés.
 */
export const FormFooter: React.FC<FormFooterProps> = ({
  className = '',
  year = '2026',
  brandName = 'EduNova Pro Technologies Inc.',
}) => {
  return (
    <footer 
      className={`w-full flex items-center justify-center py-2 text-center select-none ${className}`}
      aria-label="Pied de formulaire"
    >
      <p className="text-[11px] sm:text-xs text-slate-400 dark:text-slate-500 font-medium tracking-normal transition-colors">
        &copy; {year} {brandName} <span className="inline">• Tous droits réservés.</span>
      </p>
    </footer>
  );
};

export default FormFooter;
