import React, { useRef, useState, useEffect, useCallback, ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ScrollableContainerProps {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
  direction?: 'horizontal' | 'vertical' | 'both';
  showClickZones?: boolean;
  scrollStep?: number;
  ariaLabel?: string;
  enableGrab?: boolean;
  autoWheel?: boolean;
  showPaginationDots?: boolean;
  itemCount?: number;
  activeDotIndex?: number;
  onDotClick?: (index: number) => void;
}

export const ScrollableContainer: React.FC<ScrollableContainerProps> = ({
  children,
  className = '',
  innerClassName = '',
  direction = 'horizontal',
  showClickZones = true,
  scrollStep = 320,
  ariaLabel = 'Zone avec défilement à la souris',
  enableGrab = true,
  autoWheel = true,
  showPaginationDots = false,
  itemCount = 0,
  activeDotIndex,
  onDotClick,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [currentDotIndex, setCurrentDotIndex] = useState(0);

  // Mettre à jour l'état de défilement et la position dans la pagination
  const checkScrollState = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    if (direction === 'horizontal' || direction === 'both') {
      const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
      const currentScroll = el.scrollLeft;

      setCanScrollLeft(currentScroll > 4);
      setCanScrollRight(currentScroll < maxScroll - 4 || maxScroll === 0);

      // Calculer l'indice de pagination actif
      if (itemCount > 1) {
        if (maxScroll <= 0) {
          setCurrentDotIndex(0);
        } else {
          const ratio = Math.min(1, Math.max(0, currentScroll / maxScroll));
          const idx = Math.min(itemCount - 1, Math.max(0, Math.round(ratio * (itemCount - 1))));
          setCurrentDotIndex(idx);
        }
      }
    }
  }, [direction, itemCount]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    checkScrollState();
    const timer = setTimeout(checkScrollState, 150);

    el.addEventListener('scroll', checkScrollState, { passive: true });
    window.addEventListener('resize', checkScrollState);

    const resizeObserver = new ResizeObserver(() => {
      checkScrollState();
    });
    resizeObserver.observe(el);

    return () => {
      clearTimeout(timer);
      el.removeEventListener('scroll', checkScrollState);
      window.removeEventListener('resize', checkScrollState);
      resizeObserver.disconnect();
    };
  }, [checkScrollState]);

  // Défilement par pas fluide
  const scrollByAmount = (deltaX: number) => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollBy({ left: deltaX, behavior: 'smooth' });
    setTimeout(checkScrollState, 250);
  };

  // Défilement direct vers un point de pagination spécifique
  const scrollToDot = (index: number) => {
    const el = containerRef.current;
    if (!el || itemCount <= 1) return;

    const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
    const targetScroll = (maxScroll / (itemCount - 1)) * index;

    el.scrollTo({ left: targetScroll, behavior: 'smooth' });
    setCurrentDotIndex(index);
    if (onDotClick) onDotClick(index);
    setTimeout(checkScrollState, 250);
  };

  // Maintien prolongé sur le bouton
  const startContinuousScroll = (deltaX: number) => {
    const el = containerRef.current;
    if (!el) return;

    scrollByAmount(deltaX);

    const interval = setInterval(() => {
      if (!containerRef.current) return;
      containerRef.current.scrollLeft += deltaX > 0 ? 15 : -15;
      checkScrollState();
    }, 20);

    const stop = () => {
      clearInterval(interval);
      window.removeEventListener('mouseup', stop);
      window.removeEventListener('mouseleave', stop);
      checkScrollState();
    };

    window.addEventListener('mouseup', stop);
    window.addEventListener('mouseleave', stop);
  };

  // Redirection de la molette pour défilement horizontal sur PC classique
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!autoWheel || e.shiftKey) return;
    const el = containerRef.current;
    if (!el) return;

    if (direction === 'horizontal' && e.deltaY !== 0) {
      if (el.scrollWidth > el.clientWidth) {
        e.preventDefault();
        el.scrollLeft += e.deltaY * 1.1;
        checkScrollState();
      }
    }
  };

  // Glisser-déplacer à la souris (Grab to scroll)
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!enableGrab || e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, select, textarea, [role="button"], [role="checkbox"]')) {
      return;
    }

    const el = containerRef.current;
    if (!el) return;

    const startX = e.pageX - el.offsetLeft;
    const scrollLeft = el.scrollLeft;
    let dragged = false;

    const onMouseMove = (moveEvt: MouseEvent) => {
      const x = moveEvt.pageX - el.offsetLeft;
      const walkX = x - startX;

      if (!dragged && Math.abs(walkX) > 4) {
        dragged = true;
        setIsDragging(true);
      }

      if (dragged) {
        moveEvt.preventDefault();
        el.scrollLeft = scrollLeft - walkX;
        checkScrollState();
      }
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      setIsDragging(false);

      if (dragged) {
        const preventClick = (clickEvt: MouseEvent) => {
          clickEvt.stopPropagation();
          clickEvt.preventDefault();
          window.removeEventListener('click', preventClick, true);
        };
        window.addEventListener('click', preventClick, true);
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const effectiveActiveDot = activeDotIndex !== undefined ? activeDotIndex : currentDotIndex;

  return (
    <div className={`relative group/scrollable w-full ${className}`}>
      {/* Bouton fléché GAUCHE ◀ */}
      {showClickZones && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            scrollByAmount(-scrollStep);
          }}
          onMouseDown={() => startContinuousScroll(-scrollStep)}
          disabled={!canScrollLeft}
          aria-label="Défiler vers la gauche"
          title="Défiler vers la gauche ◀ (Clic ou maintien)"
          className={`absolute -left-2 sm:-left-3 top-1/2 -translate-y-1/2 z-30 w-9 h-9 rounded-full flex items-center justify-center shadow-lg border transition-all duration-150 cursor-pointer ${
            canScrollLeft
              ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-500 hover:scale-110 active:scale-95'
              : 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed opacity-50'
          }`}
        >
          <ChevronLeft size={20} strokeWidth={3} />
        </button>
      )}

      {/* Bouton fléché DROIT ▶ */}
      {showClickZones && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            scrollByAmount(scrollStep);
          }}
          onMouseDown={() => startContinuousScroll(scrollStep)}
          disabled={!canScrollRight}
          aria-label="Défiler vers la droite"
          title="Défiler vers la droite ▶ (Clic ou maintien)"
          className={`absolute -right-2 sm:-right-3 top-1/2 -translate-y-1/2 z-30 w-9 h-9 rounded-full flex items-center justify-center shadow-lg border transition-all duration-150 cursor-pointer ${
            canScrollRight
              ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-500 hover:scale-110 active:scale-95'
              : 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed opacity-50'
          }`}
        >
          <ChevronRight size={20} strokeWidth={3} />
        </button>
      )}

      {/* Conteneur de défilement horizontal */}
      <div
        ref={containerRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        tabIndex={0}
        role="region"
        aria-label={ariaLabel}
        className={`custom-scrollbar px-3 ${
          direction === 'horizontal' ? 'overflow-x-auto overflow-y-hidden' : ''
        } ${direction === 'vertical' ? 'overflow-y-auto overflow-x-hidden' : ''} ${
          direction === 'both' ? 'overflow-auto' : ''
        } ${isDragging ? 'cursor-grabbing select-none' : 'cursor-grab'} ${innerClassName}`}
      >
        {children}
      </div>

      {/* Indicateur visuel de progression de type 'pagination dots' sous la zone de défilement */}
      {showPaginationDots && itemCount > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 px-3 mt-1 select-none">
          {/* Badge textuel de position */}
          <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
            Position : <strong className="text-slate-800 font-mono">Élément {effectiveActiveDot + 1}</strong> sur {itemCount}
          </span>

          {/* Points de pagination (Pagination Dots) interactifs */}
          <div 
            className="flex items-center gap-1.5 bg-slate-100/90 hover:bg-slate-200/80 px-2.5 py-1.5 rounded-full border border-slate-200 transition-colors"
            role="tablist"
            aria-label="Navigation par points de pagination du carrousel"
          >
            {Array.from({ length: itemCount }).map((_, idx) => {
              const isActive = idx === effectiveActiveDot;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => scrollToDot(idx)}
                  role="tab"
                  aria-selected={isActive}
                  aria-label={`Afficher l'élément ${idx + 1} sur ${itemCount}`}
                  title={`Sauter à la position ${idx + 1} sur ${itemCount}`}
                  className={`transition-all duration-300 cursor-pointer rounded-full flex items-center justify-center ${
                    isActive
                      ? 'w-6 h-2.5 bg-blue-600 shadow-sm ring-2 ring-blue-300'
                      : 'w-2.5 h-2.5 bg-slate-300 hover:bg-slate-400 hover:scale-125'
                  }`}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
