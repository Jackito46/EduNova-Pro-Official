import React, { useState, useEffect } from 'react';
import { Download, X, Sparkles, Smartphone, Monitor } from 'lucide-react';
import { usePwaInstall } from '../hooks/usePwaInstall';
import Logo from './Logo';

export const PwaInstallBanner: React.FC = () => {
  const { 
    isInstalled, 
    installPwa, 
    platformName, 
    isMobile, 
    canPromptDirectly,
    isInIframe,
    openStandaloneTab
  } = usePwaInstall();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isInstalled) {
      setIsVisible(false);
      return;
    }

    try {
      const dismissed = sessionStorage.getItem('edunova_pwa_banner_dismissed');
      if (dismissed === 'true') {
        setIsVisible(false);
        return;
      }
    } catch (e) {
      // ignore
    }

    // Delay banner appearance slightly so page loads gracefully first
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 1200);

    return () => clearTimeout(timer);
  }, [isInstalled]);

  const handleDismiss = () => {
    setIsVisible(false);
    try {
      sessionStorage.setItem('edunova_pwa_banner_dismissed', 'true');
    } catch (e) {}
  };

  if (!isVisible || isInstalled) return null;

  return (
    <div 
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-[380px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200/90 dark:border-slate-800 p-4 z-50 animate-in slide-in-from-bottom-5 duration-300"
      role="region"
      aria-label="Installation de l'application"
    >
      <button 
        type="button"
        onClick={handleDismiss}
        className="absolute top-2.5 right-2.5 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
        aria-label="Fermer la suggestion d'installation"
      >
        <X size={15} />
      </button>
      
      <div className="flex gap-3.5 items-start">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-indigo-800 p-0.5 shadow-md shadow-blue-500/20 shrink-0 mt-0.5 flex items-center justify-center overflow-hidden">
          <Logo size="sm" className="w-full h-full rounded-[10px]" />
        </div>
        
        <div className="flex-1 pr-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h3 className="font-bold text-slate-900 dark:text-white text-xs tracking-tight">
              Installer EduNova Pro
            </h3>
            <span className="flex items-center gap-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-1.5 py-0.2 rounded-md">
              <Sparkles size={10} /> App
            </span>
          </div>
          
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug font-medium">
            Accès 100% hors-ligne, alertes en temps réel et fluidité maximale sur {platformName}.
          </p>

          <div className="flex items-center gap-2 mt-3">
            <button 
              type="button"
              onClick={() => {
                installPwa();
              }}
              className="flex-1 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-bold text-xs py-2 px-3 rounded-xl transition-all shadow-sm shadow-blue-500/20 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Download size={14} className="stroke-[2.5]" />
              {canPromptDirectly ? 'Installer' : 'Comment installer'}
            </button>
            <button 
              type="button"
              onClick={handleDismiss}
              className="px-2.5 py-2 text-[11px] font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Plus tard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
