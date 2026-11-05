import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MoveHorizontal, Check, Maximize2, Minimize2, ChevronLeft, ChevronRight } from 'lucide-react';

interface ResponsiveTableWrapperProps {
  children: React.ReactNode;
  minWidth?: string; // e.g. "min-w-[700px]"
  maxHeight?: string; // e.g. "max-h-[460px]"
  defaultScrollHeight?: boolean;
  className?: string;
  hideVerticalToggle?: boolean;
  theme?: 'dark' | 'slate' | 'blue';
}

export const ResponsiveTableWrapper: React.FC<ResponsiveTableWrapperProps> = ({
  children,
  minWidth = "min-w-[650px]",
  maxHeight = "max-h-[460px]",
  defaultScrollHeight = false,
  className = "",
  hideVerticalToggle = false,
  theme = 'slate'
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isScrollable, setIsScrollable] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isScrollHeightMode, setIsScrollHeightMode] = useState(defaultScrollHeight);

  const checkScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const hasOverflow = el.scrollWidth > el.clientWidth + 6;
    setIsScrollable(hasOverflow);
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  }, []);

  useEffect(() => {
    checkScroll();
    const handleResize = () => checkScroll();
    window.addEventListener('resize', handleResize);

    const el = containerRef.current;
    let observer: ResizeObserver | null = null;
    if (el && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => checkScroll());
      observer.observe(el);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (observer) observer.disconnect();
    };
  }, [checkScroll]);

  const scrollTable = (direction: 'left' | 'right') => {
    const el = containerRef.current;
    if (!el) return;
    const delta = direction === 'left' ? -320 : 320;
    el.scrollBy({ left: delta, behavior: 'smooth' });
  };

  // Theming classes
  const themeHeaderClass = theme === 'dark' 
    ? 'bg-slate-900 text-slate-300 border-b border-slate-800'
    : theme === 'blue'
    ? 'bg-slate-900 text-slate-300 border-b border-slate-800'
    : 'bg-slate-900 text-slate-300 border-b border-slate-800';

  return (
    <div className={`overflow-hidden rounded-xl border border-slate-200 bg-white ${className}`}>
      {/* BARRE D'ASCENSEUR & NAVIGATION ERGONOMIQUE (ADAPTATIVE POUR ÉCRANS 13"-14" POUCES AVEC SIDEBAR) */}
      <div className={`px-3 sm:px-4 py-2 ${themeHeaderClass} flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 text-xs print:hidden select-none`}>
        <div className="flex items-center justify-between sm:justify-start gap-2 flex-wrap">
          {isScrollable ? (
            <>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-500/20 text-indigo-300 font-bold text-[10.5px] sm:text-[11px] border border-indigo-500/30 whitespace-nowrap animate-in fade-in duration-200">
                <MoveHorizontal size={13} className="text-indigo-400 shrink-0" />
                <span>Ascenseur horizontal actif ↔</span>
              </span>
              <span className="text-slate-400 text-[10.5px] sm:hidden">
                (Glissez pour naviguer)
              </span>
              <span className="text-slate-400 text-[11px] hidden sm:inline">
                (Colonnes étendues : défilez avec l'ascenseur ou les flèches sans devoir réduire la barre latérale)
              </span>
            </>
          ) : (
            <>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/15 text-emerald-300 font-bold text-[10.5px] sm:text-[11px] border border-emerald-500/25 whitespace-nowrap animate-in fade-in duration-200">
                <Check size={13} className="text-emerald-400 shrink-0" />
                <span>Vue intégrale (Grand écran)</span>
              </span>
              <span className="text-slate-400 text-[10.5px] sm:text-[11px] hidden sm:inline">
                (Toutes les colonnes sont directement visibles sans défilement horizontal)
              </span>
            </>
          )}
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2">
          {/* Bascule mode hauteur déroulante avec ascenseur vertical */}
          {!hideVerticalToggle && (
            <button
              type="button"
              onClick={() => setIsScrollHeightMode(!isScrollHeightMode)}
              className={`inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg font-bold text-[10.5px] sm:text-[11px] transition-all cursor-pointer border flex-1 sm:flex-none whitespace-nowrap ${
                isScrollHeightMode
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-xs'
                  : 'bg-white/10 hover:bg-white/20 text-slate-200 border-white/10'
              }`}
              title={isScrollHeightMode ? "Revenir à la hauteur normale" : "Activer la vue déroulante avec ascenseur vertical"}
            >
              {isScrollHeightMode ? <Minimize2 size={12} className="shrink-0" /> : <Maximize2 size={12} className="shrink-0" />}
              <span>{isScrollHeightMode ? 'Ascenseur vertical actif' : 'Mode Déroulant'}</span>
            </button>
          )}

          {/* Boutons de défilement horizontal rapide ◄ ► (affichés UNIQUEMENT si l'écran a besoin de défiler) */}
          {isScrollable && (
            <div className="flex items-center gap-0.5 sm:gap-1 bg-white/10 p-0.5 rounded-lg border border-white/10 shrink-0 animate-in fade-in duration-200">
              <button
                type="button"
                onClick={() => scrollTable('left')}
                disabled={!canScrollLeft}
                className="p-1 rounded text-slate-300 hover:text-white hover:bg-white/20 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                title="Défiler le tableau vers la gauche"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-[10px] font-mono px-0.5 sm:px-1 text-slate-400 font-bold select-none">◄ ►</span>
              <button
                type="button"
                onClick={() => scrollTable('right')}
                disabled={!canScrollRight}
                className="p-1 rounded text-slate-300 hover:text-white hover:bg-white/20 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                title="Défiler le tableau vers la droite"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Conteneur avec ascenseur fluide et défilement horizontal/vertical */}
      <div
        ref={containerRef}
        onScroll={checkScroll}
        className={`overflow-x-auto custom-scrollbar ${isScrollHeightMode ? `${maxHeight} overflow-y-auto` : ''}`}
      >
        <div className={minWidth}>
          {children}
        </div>
      </div>
    </div>
  );
};

export default ResponsiveTableWrapper;
