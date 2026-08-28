import React from 'react';
import { ShieldCheck, Sparkles, Lock } from 'lucide-react';

interface FormFooterProps {
  className?: string;
  variant?: 'floating' | 'minimal' | 'card' | 'dark';
  showSecurityBadge?: boolean;
  securityText?: string;
  year?: number | string;
  brandName?: string;
  tagline?: string;
}

/**
 * Composant de pied de formulaire ultra-moderne, compact et épuré.
 * Offre une signature visuelle élégante sans surcharger la mise en page.
 */
export const FormFooter: React.FC<FormFooterProps> = ({
  className = '',
  variant = 'floating',
  showSecurityBadge = false,
  securityText = 'Système Sécurisé',
  year = '2026',
  brandName = 'EDUNOVA TECHNOLOGIES',
  tagline = 'GESTION ACADÉMIQUE INTÉGRÉE'
}) => {
  if (variant === 'dark') {
    return (
      <footer className={`flex flex-col items-center justify-center gap-1.5 pt-3 pb-1 text-center select-none ${className}`}>
        <div className="inline-flex items-center flex-wrap justify-center gap-2 px-3 py-1 rounded-full bg-slate-900/70 backdrop-blur-md border border-slate-800/80 shadow-sm">
          {showSecurityBadge && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-400/20 text-blue-300 text-[9.5px] font-medium">
              <Lock size={10} className="text-blue-400" />
              {securityText}
            </span>
          )}

          <div className="flex items-center gap-1.5 text-[9.5px] sm:text-[10px]">
            <span className="font-semibold text-slate-300">
              &copy; {year} {brandName}
            </span>
            <span className="w-1 h-1 rounded-full bg-slate-600" />
            <span className="text-slate-400">
              {tagline}
            </span>
          </div>
        </div>
      </footer>
    );
  }

  if (variant === 'minimal') {
    return (
      <footer className={`flex flex-col items-center justify-center gap-1 pt-2.5 pb-1 text-center select-none ${className}`}>
        <div className="flex items-center gap-1.5 flex-wrap justify-center text-[10px] text-slate-400">
          <span className="font-semibold text-slate-600">
            &copy; {year} {brandName}
          </span>
          <span className="w-1 h-1 rounded-full bg-slate-300" />
          <span className="text-slate-400 font-normal">
            {tagline}
          </span>
        </div>
        {showSecurityBadge && (
          <div className="inline-flex items-center gap-1 text-[9.5px] font-medium text-slate-400">
            <Lock size={10} className="text-emerald-500" />
            <span>{securityText}</span>
          </div>
        )}
      </footer>
    );
  }

  // Modern ultra-sleek floating micro-pill
  return (
    <footer className={`w-full flex flex-col items-center justify-center pt-3 pb-1 text-center select-none ${className}`}>
      <div className="group inline-flex items-center justify-center gap-2 sm:gap-2.5 px-3 sm:px-3.5 py-1 sm:py-1.2 rounded-full bg-white/75 backdrop-blur-md border border-slate-200/70 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.04)] hover:border-slate-300 hover:bg-white/90 transition-all duration-200">
        
        {/* Security indicator */}
        <div className="flex items-center gap-1 text-[9.5px] font-semibold text-slate-500">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60"></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
          </span>
          <span className="tracking-wide">SSL 256-BIT</span>
        </div>

        <span className="w-px h-2.5 bg-slate-200" />

        {/* Brand & Tagline */}
        <div className="flex items-center gap-1.5 text-[10px] sm:text-[10.5px] leading-tight">
          <span className="font-semibold text-slate-700 tracking-tight">
            &copy; {year} {brandName}
          </span>
          <span className="w-0.5 h-0.5 rounded-full bg-slate-300 hidden sm:inline-block" />
          <span className="text-slate-400 font-normal tracking-normal hidden sm:inline-block">
            {tagline}
          </span>
        </div>
      </div>
    </footer>
  );
};

export default FormFooter;
