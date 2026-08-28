import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUpRight, X, Sparkles, MonitorDown, CheckCircle2 } from 'lucide-react';
import { usePwaInstall } from '../hooks/usePwaInstall';

export const AddressBarInstallHint: React.FC = () => {
  const { isInstalled, isStandalone, isInIframe } = usePwaInstall();
  const [dismissed, setDismissed] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if dismissed previously in localStorage/sessionStorage
    const isDismissed = localStorage.getItem('edunova_address_bar_hint_dismissed') === 'true';
    if (isDismissed) {
      setDismissed(true);
      return;
    }

    // Only show on desktop devices when not in standalone mode and not inside iframe
    const isDesktop = !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (!isInstalled && !isStandalone && !isInIframe && isDesktop) {
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [isInstalled, isStandalone, isInIframe]);

  const handleDismiss = (permanent = false) => {
    setIsVisible(false);
    setDismissed(true);
    if (permanent) {
      localStorage.setItem('edunova_address_bar_hint_dismissed', 'true');
    } else {
      sessionStorage.setItem('edunova_address_bar_hint_dismissed', 'true');
    }
  };

  if (dismissed || !isVisible || isInstalled || isStandalone || isInIframe) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        id="edunova-address-bar-install-hint"
        initial={{ opacity: 0, y: -25, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -25, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 450, damping: 28 }}
        className="fixed top-3 right-6 z-50 max-w-sm pointer-events-auto"
      >
        <div className="relative bg-slate-900/95 dark:bg-slate-950/95 text-white p-4 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.4)] border border-blue-500/40 backdrop-blur-xl">
          {/* Flèche indicatrice animée pointant vers le haut à droite (vers la barre d'adresse) */}
          <div className="absolute -top-2 right-8 w-4 h-4 bg-slate-900 dark:bg-slate-950 border-t border-l border-blue-500/40 rotate-45 transform" />

          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/25 border border-blue-400/40 flex items-center justify-center shrink-0 text-blue-400 shadow-inner">
              <MonitorDown size={20} className="animate-bounce" />
            </div>

            <div className="flex-1 pr-1">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/25 text-blue-300 border border-blue-400/30 flex items-center gap-1">
                  <Sparkles size={10} className="text-amber-400" /> 💡 Astuce PC
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-100 leading-snug">
                Cliquez sur l'icône <strong className="text-blue-400 font-bold inline-flex items-center gap-0.5">dans votre barre d'adresse <ArrowUpRight size={13} className="text-blue-400" /></strong> pour installer EduNova Pro sur votre PC.
              </p>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                Profitez d'une fenêtre dédiée plein écran, d'une rapidité décuplée et de l'accès hors-ligne.
              </p>

              {/* Boutons d'action */}
              <div className="mt-3 flex items-center gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => handleDismiss(false)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
                >
                  <CheckCircle2 size={12} /> J'ai compris
                </button>
                <button
                  type="button"
                  onClick={() => handleDismiss(true)}
                  className="text-[10px] text-slate-400 hover:text-slate-200 transition-colors px-1 py-1"
                >
                  Ne plus afficher
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleDismiss(false)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
              title="Fermer cette astuce"
              aria-label="Fermer"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
export default AddressBarInstallHint;
