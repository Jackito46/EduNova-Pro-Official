import React from 'react';

interface AppFooterProps {
  className?: string;
}

export const AppFooter: React.FC<AppFooterProps> = ({ className = '' }) => {
  const currentYear = new Date().getFullYear();

  return (
    <footer 
      id="app-global-footer"
      className={`mt-10 pt-5 pb-6 border-t border-slate-200/60 select-none print:hidden transition-all duration-200 ${className}`}
    >
      <div className="flex items-center justify-center">
        <div className="inline-flex items-center gap-3 px-3 py-1">
          {/* Logo EN Gradient Squircle */}
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-indigo-700 flex items-center justify-center text-white font-black text-xs shadow-xs shrink-0 tracking-tight">
            EN
          </div>

          {/* Typography & Badge */}
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-slate-900 tracking-tight text-xs sm:text-sm">
                EduNova Pro<span className="text-blue-600 text-[10px] sm:text-xs font-bold align-super ml-0.5">™</span>
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 text-[10px] font-black uppercase tracking-wider leading-none">
                ENTERPRISE V2.6
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium leading-tight mt-0.5">
              &copy; {currentYear} EduNova Technologies Inc. • Tous droits réservés.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default AppFooter;
