import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, LucideIcon, Search, X } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  badge?: string;
  description?: string;
  icon?: LucideIcon;
  color?: string;
}

export interface SelectPillProps {
  options: (string | SelectOption)[];
  value: string;
  onChange: (value: string) => void;
  labelPrefix?: string;
  placeholder?: string;
  icon?: LucideIcon;
  variant?: 'pill' | 'field' | 'compact';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  colorScheme?: 'indigo' | 'slate' | 'emerald' | 'blue' | 'purple' | 'rose' | 'amber';
  dropdownAlign?: 'left' | 'right';
  className?: string;
  disabled?: boolean;
  searchable?: boolean;
  portal?: boolean;
}

export const SelectPill: React.FC<SelectPillProps> = ({
  options = [],
  value,
  onChange,
  labelPrefix = '',
  placeholder = 'Sélectionner...',
  icon: IconComponent,
  variant = 'pill',
  size = 'sm',
  colorScheme = 'indigo',
  dropdownAlign,
  className = '',
  disabled = false,
  searchable = false,
  portal = true
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [effectiveAlign, setEffectiveAlign] = useState<'left' | 'right'>(dropdownAlign || 'left');
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const [popoverCoords, setPopoverCoords] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    width: number;
    maxHeight: number;
    openUpward: boolean;
  } | null>(null);

  const updatePosition = useCallback(() => {
    if (!containerRef.current || typeof window === 'undefined') return;
    const rect = containerRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Minimum width matches button, or at least 240px
    const minWidth = variant === 'field' ? Math.max(rect.width, 240) : Math.max(rect.width, 240);
    const popoverWidth = Math.min(minWidth, Math.max(viewportWidth - 24, 200));

    // Vertical space calculation (open upward if less than 230px below and more room above)
    const spaceBelow = viewportHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    const preferUpward = spaceBelow < 230 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(140, Math.min(280, preferUpward ? spaceAbove - 12 : spaceBelow - 12));

    // Horizontal alignment calculation
    let left = rect.left;
    if (dropdownAlign === 'right' || effectiveAlign === 'right') {
      left = rect.right - popoverWidth;
    }

    // Clamp inside viewport
    if (left + popoverWidth > viewportWidth - 12) {
      left = viewportWidth - popoverWidth - 12;
    }
    if (left < 12) {
      left = 12;
    }

    if (preferUpward) {
      setPopoverCoords({
        bottom: viewportHeight - rect.top + 6,
        left,
        width: popoverWidth,
        maxHeight,
        openUpward: true
      });
    } else {
      setPopoverCoords({
        top: rect.bottom + 6,
        left,
        width: popoverWidth,
        maxHeight,
        openUpward: false
      });
    }
  }, [dropdownAlign, effectiveAlign, variant]);

  useEffect(() => {
    if (dropdownAlign) {
      setEffectiveAlign(dropdownAlign);
    } else if (containerRef.current && typeof window !== 'undefined') {
      const rect = containerRef.current.getBoundingClientRect();
      const popoverWidth = 280;
      if (rect.left + popoverWidth > window.innerWidth && rect.right >= popoverWidth) {
        setEffectiveAlign('right');
      } else {
        setEffectiveAlign('left');
      }
    }
  }, [dropdownAlign, isOpen]);

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      const handleScrollOrResize = () => updatePosition();
      window.addEventListener('scroll', handleScrollOrResize, true);
      window.addEventListener('resize', handleScrollOrResize);
      return () => {
        window.removeEventListener('scroll', handleScrollOrResize, true);
        window.removeEventListener('resize', handleScrollOrResize);
      };
    }
  }, [isOpen, updatePosition]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        containerRef.current && !containerRef.current.contains(target) &&
        popoverRef.current && !popoverRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Normalized options
  const normalizedOptions: SelectOption[] = options.map(opt => {
    if (typeof opt === 'string') {
      return { value: opt, label: opt };
    }
    return opt;
  });

  const selectedOption = normalizedOptions.find(o => o.value === value) || (value ? { value, label: value } : null);

  const filteredOptions = searchable && search
    ? normalizedOptions.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : normalizedOptions;

  const colorMap = {
    indigo: {
      activeBorder: 'border-indigo-300 ring-2 ring-indigo-500/20 bg-indigo-50/70',
      badge: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      iconText: 'text-indigo-600',
      highlightBg: 'bg-indigo-50/90 text-indigo-950 border-indigo-200/70',
      checkColor: 'text-indigo-600',
      dotColor: 'bg-indigo-600'
    },
    blue: {
      activeBorder: 'border-blue-300 ring-2 ring-blue-500/20 bg-blue-50/70',
      badge: 'bg-blue-50 text-blue-700 border-blue-200',
      iconText: 'text-blue-600',
      highlightBg: 'bg-blue-50/90 text-blue-950 border-blue-200/70',
      checkColor: 'text-blue-600',
      dotColor: 'bg-blue-600'
    },
    rose: {
      activeBorder: 'border-rose-300 ring-2 ring-rose-500/20 bg-rose-50/70',
      badge: 'bg-rose-50 text-rose-700 border-rose-200',
      iconText: 'text-rose-600',
      highlightBg: 'bg-rose-50/90 text-rose-950 border-rose-200/70',
      checkColor: 'text-rose-600',
      dotColor: 'bg-rose-600'
    },
    emerald: {
      activeBorder: 'border-emerald-300 ring-2 ring-emerald-500/20 bg-emerald-50/70',
      badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      iconText: 'text-emerald-600',
      highlightBg: 'bg-emerald-50/90 text-emerald-950 border-emerald-200/70',
      checkColor: 'text-emerald-600',
      dotColor: 'bg-emerald-600'
    },
    purple: {
      activeBorder: 'border-purple-300 ring-2 ring-purple-500/20 bg-purple-50/70',
      badge: 'bg-purple-50 text-purple-700 border-purple-200',
      iconText: 'text-purple-600',
      highlightBg: 'bg-purple-50/90 text-purple-950 border-purple-200/70',
      checkColor: 'text-purple-600',
      dotColor: 'bg-purple-600'
    },
    amber: {
      activeBorder: 'border-amber-300 ring-2 ring-amber-500/20 bg-amber-50/70',
      badge: 'bg-amber-50 text-amber-700 border-amber-200',
      iconText: 'text-amber-600',
      highlightBg: 'bg-amber-50/90 text-amber-950 border-amber-200/70',
      checkColor: 'text-amber-600',
      dotColor: 'bg-amber-600'
    },
    slate: {
      activeBorder: 'border-slate-300 ring-2 ring-slate-400/20 bg-slate-100',
      badge: 'bg-slate-100 text-slate-700 border-slate-200',
      iconText: 'text-slate-600',
      highlightBg: 'bg-slate-100 text-slate-900 border-slate-200',
      checkColor: 'text-slate-700',
      dotColor: 'bg-slate-700'
    }
  };

  const scheme = colorMap[colorScheme] || colorMap.indigo;

  const sizeClasses = {
    xs: 'px-2 py-1 text-xs gap-1.5 min-h-[28px]',
    sm: 'px-2.5 py-1.5 text-xs gap-1.5 min-h-[34px]',
    md: 'px-3 py-2 text-xs sm:text-sm gap-2 min-h-[38px]',
    lg: 'px-3.5 py-2.5 text-sm gap-2.5 min-h-[44px]'
  }[size];

  const getButtonClass = () => {
    if (variant === 'field') {
      return `w-full flex items-center justify-between bg-white hover:bg-slate-50/80 border rounded-xl font-bold text-slate-900 shadow-2xs transition-all duration-150 ${sizeClasses} ${
        isOpen ? scheme.activeBorder : 'border-slate-200 hover:border-slate-300'
      }`;
    }
    if (variant === 'compact') {
      return `inline-flex items-center justify-between bg-white hover:bg-slate-50 border rounded-lg font-bold text-slate-800 text-xs shadow-2xs transition-all ${sizeClasses} ${
        isOpen ? scheme.activeBorder : 'border-slate-200 hover:border-slate-300'
      }`;
    }
    // Pill variant
    return `inline-flex items-center justify-between bg-white hover:bg-slate-50/90 border rounded-full font-bold text-slate-900 shadow-2xs hover:shadow-xs transition-all duration-150 ${sizeClasses} ${
      isOpen ? scheme.activeBorder : 'border-slate-200/90 hover:border-slate-300'
    }`;
  };

  const popoverContent = (
    <div
      ref={popoverRef}
      style={portal && popoverCoords ? {
        position: 'fixed',
        ...(popoverCoords.openUpward ? { bottom: popoverCoords.bottom } : { top: popoverCoords.top }),
        left: popoverCoords.left,
        width: popoverCoords.width,
        zIndex: 99999
      } : undefined}
      className={`${portal ? '' : `absolute ${effectiveAlign === 'right' ? 'right-0' : 'left-0'} top-full mt-1.5 w-64 sm:w-72 min-w-full max-w-[calc(100vw-1.5rem)] z-[200]`} bg-white rounded-2xl shadow-2xl border border-slate-200/90 p-1.5 animate-in fade-in zoom-in-95 duration-150 select-none`}
    >
      {searchable && (
        <div className="p-1 mb-1 border-b border-slate-100">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher une option..."
              autoFocus
              className="w-full pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 placeholder:text-slate-400 outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      )}

      <div
        style={portal && popoverCoords ? { maxHeight: popoverCoords.maxHeight } : undefined}
        className="max-h-60 overflow-y-auto space-y-0.5 custom-scrollbar p-0.5"
      >
        {filteredOptions.length === 0 ? (
          <div className="py-4 px-3 text-center text-slate-500 text-xs font-semibold">
            Aucune option correspondante
          </div>
        ) : (
          filteredOptions.map((opt) => {
            const isSelected = value === opt.value;
            const OptIcon = opt.icon;

            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-all duration-150 cursor-pointer ${
                  isSelected
                    ? scheme.highlightBg + ' shadow-2xs font-bold'
                    : 'hover:bg-slate-50 text-slate-800 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${isSelected ? scheme.dotColor : 'bg-slate-300'}`} />
                  {OptIcon && <OptIcon size={14} className={scheme.iconText} />}
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-slate-900 tracking-tight block truncate">
                      {opt.label}
                    </span>
                    {opt.description && (
                      <span className="text-[10px] font-medium text-slate-500 block truncate">
                        {opt.description}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0 ml-2">
                  {opt.badge && (
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                      {opt.badge}
                    </span>
                  )}
                  {isSelected && (
                    <Check size={13} className={`${scheme.checkColor} stroke-[3]`} />
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <div className={`relative inline-block ${variant === 'field' ? 'w-full' : ''} ${className}`} ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setSearch('');
            setIsOpen(prev => !prev);
          }
        }}
        className={`${getButtonClass()} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {IconComponent && (
            <IconComponent size={size === 'xs' ? 12 : size === 'lg' ? 15 : 13} className={`shrink-0 ${scheme.iconText}`} />
          )}
          {labelPrefix && (
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 shrink-0">
              {labelPrefix}
            </span>
          )}
          <span className="font-extrabold text-slate-900 tracking-tight truncate text-left">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-1.5">
          {selectedOption?.badge && (
            <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black border ${scheme.badge}`}>
              {selectedOption.badge}
            </span>
          )}
          <ChevronDown
            size={size === 'xs' ? 12 : 14}
            className={`text-slate-400 transition-transform duration-200 shrink-0 ${isOpen ? `rotate-180 ${scheme.iconText}` : ''}`}
          />
        </div>
      </button>

      {isOpen && (
        portal && typeof document !== 'undefined'
          ? createPortal(popoverContent, document.body)
          : popoverContent
      )}
    </div>
  );
};
