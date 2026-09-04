import React, { useState, useRef, useEffect } from 'react';
import { GraduationCap, ChevronDown, Check, Search, X, Layers, BookOpen } from 'lucide-react';

export interface ClassSelectorItem {
  id: string;
  name: string;
  cycle?: string;
  level?: string;
  section?: string;
  code?: string;
  students_count?: number;
}

export interface ClassSelectorPillProps {
  classes: ClassSelectorItem[];
  selectedClassId: string;
  onSelectClass: (classId: string) => void;
  activeCycle?: string;
  labelPrefix?: string;
  allLabel?: string;
  allowAll?: boolean;
  emptyLabel?: string;
  variant?: 'pill' | 'field' | 'compact' | 'minimal';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  colorScheme?: 'blue' | 'indigo' | 'emerald' | 'slate' | 'purple' | 'amber' | 'rose';
  className?: string;
  dropdownAlign?: 'left' | 'right';
  disabled?: boolean;
  showIcon?: boolean;
  title?: string;
}

export const ClassSelectorPill: React.FC<ClassSelectorPillProps> = ({
  classes = [],
  selectedClassId,
  onSelectClass,
  activeCycle = 'ALL',
  labelPrefix = '',
  allLabel,
  allowAll = true,
  emptyLabel = 'Sélectionner une classe',
  variant = 'pill',
  size = 'sm',
  colorScheme = 'blue',
  className = '',
  dropdownAlign,
  disabled = false,
  showIcon = true,
  title = 'Filtrer par classe'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [effectiveAlign, setEffectiveAlign] = useState<'left' | 'right'>(dropdownAlign || 'left');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (dropdownAlign) {
      setEffectiveAlign(dropdownAlign);
    } else if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.right + 200 > window.innerWidth) {
        setEffectiveAlign('right');
      } else {
        setEffectiveAlign('left');
      }
    }
  }, [dropdownAlign, isOpen]);

  // Close when clicked outside or pressed Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
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
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const isAllSelected = allowAll && (!selectedClassId || selectedClassId.toLowerCase() === 'all');
  const selectedClass = (!selectedClassId || selectedClassId.toLowerCase() === 'all') ? null : classes.find(c => c.id === selectedClassId);

  const defaultAllLabel = allLabel || (activeCycle && activeCycle !== 'ALL' ? `Toutes (${activeCycle})` : 'Toutes (Total)');

  // Color mappings
  const colorMap = {
    blue: {
      activeBorder: 'border-blue-400 ring-2 ring-blue-500/20 bg-blue-50/70',
      badge: 'bg-blue-50 text-blue-700 border-blue-200',
      iconText: 'text-blue-600',
      highlightBg: 'bg-blue-50/90 text-blue-950 border-blue-200/80',
      checkColor: 'text-blue-600',
      dotColor: 'bg-blue-600 ring-2 ring-blue-500/20',
      focusBorder: 'focus:border-blue-500 focus:ring-blue-100'
    },
    indigo: {
      activeBorder: 'border-indigo-400 ring-2 ring-indigo-500/20 bg-indigo-50/70',
      badge: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      iconText: 'text-indigo-600',
      highlightBg: 'bg-indigo-50/90 text-indigo-950 border-indigo-200/80',
      checkColor: 'text-indigo-600',
      dotColor: 'bg-indigo-600 ring-2 ring-indigo-500/20',
      focusBorder: 'focus:border-indigo-500 focus:ring-indigo-100'
    },
    rose: {
      activeBorder: 'border-rose-400 ring-2 ring-rose-500/20 bg-rose-50/70',
      badge: 'bg-rose-50 text-rose-700 border-rose-200',
      iconText: 'text-rose-600',
      highlightBg: 'bg-rose-50/90 text-rose-950 border-rose-200/80',
      checkColor: 'text-rose-600',
      dotColor: 'bg-rose-600 ring-2 ring-rose-500/20',
      focusBorder: 'focus:border-rose-500 focus:ring-rose-100'
    },
    emerald: {
      activeBorder: 'border-emerald-400 ring-2 ring-emerald-500/20 bg-emerald-50/70',
      badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      iconText: 'text-emerald-600',
      highlightBg: 'bg-emerald-50/90 text-emerald-950 border-emerald-200/80',
      checkColor: 'text-emerald-600',
      dotColor: 'bg-emerald-600 ring-2 ring-emerald-500/20',
      focusBorder: 'focus:border-emerald-500 focus:ring-emerald-100'
    },
    slate: {
      activeBorder: 'border-slate-400 ring-2 ring-slate-400/20 bg-slate-100/70',
      badge: 'bg-slate-100 text-slate-700 border-slate-200',
      iconText: 'text-slate-600',
      highlightBg: 'bg-slate-100/90 text-slate-900 border-slate-300/70',
      checkColor: 'text-slate-700',
      dotColor: 'bg-slate-700 ring-2 ring-slate-400/20',
      focusBorder: 'focus:border-slate-500 focus:ring-slate-100'
    },
    purple: {
      activeBorder: 'border-purple-400 ring-2 ring-purple-500/20 bg-purple-50/70',
      badge: 'bg-purple-50 text-purple-700 border-purple-200',
      iconText: 'text-purple-600',
      highlightBg: 'bg-purple-50/90 text-purple-950 border-purple-200/80',
      checkColor: 'text-purple-600',
      dotColor: 'bg-purple-600 ring-2 ring-purple-500/20',
      focusBorder: 'focus:border-purple-500 focus:ring-purple-100'
    },
    amber: {
      activeBorder: 'border-amber-400 ring-2 ring-amber-500/20 bg-amber-50/70',
      badge: 'bg-amber-50 text-amber-700 border-amber-200',
      iconText: 'text-amber-600',
      highlightBg: 'bg-amber-50/90 text-amber-950 border-amber-200/80',
      checkColor: 'text-amber-600',
      dotColor: 'bg-amber-600 ring-2 ring-amber-500/20',
      focusBorder: 'focus:border-amber-500 focus:ring-amber-100'
    }
  };

  const scheme = colorMap[colorScheme] || colorMap.blue;

  // Size styling
  const sizeClasses = {
    xs: 'px-2 py-0.5 text-[11px] rounded-lg gap-1.5',
    sm: 'px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs rounded-xl gap-2',
    md: 'px-3 sm:px-3.5 py-2 text-xs sm:text-sm rounded-xl gap-2.5',
    lg: 'px-4 py-2.5 text-sm rounded-2xl gap-3'
  }[size];

  // Filtered classes by search
  const filteredClasses = classes.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.cycle && c.cycle.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (c.level && c.level.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Variant base style
  const getButtonClass = () => {
    if (variant === 'field') {
      return `w-full flex items-center justify-between px-3.5 py-2.5 bg-white hover:bg-slate-50 border rounded-xl text-left transition-all duration-200 shadow-2xs ${
        isOpen 
          ? scheme.activeBorder 
          : 'border-slate-200 hover:border-slate-300 text-slate-800'
      }`;
    }

    if (variant === 'minimal') {
      return `inline-flex items-center text-xs font-bold transition-all duration-200 ${sizeClasses} ${
        isOpen 
          ? `${scheme.iconText} bg-slate-100/90 rounded-lg` 
          : 'text-slate-700 hover:text-slate-900 bg-transparent'
      }`;
    }

    // Default 'pill' or 'compact'
    return `inline-flex items-center justify-between border transition-all duration-200 shadow-2xs font-bold text-left ${sizeClasses} ${
      isOpen
        ? scheme.activeBorder
        : 'bg-white hover:bg-slate-50/90 border-slate-200/90 hover:border-slate-300 text-slate-800'
    }`;
  };

  return (
    <div 
      className={`relative inline-block ${variant === 'field' ? 'w-full' : ''} ${isOpen ? 'z-[60]' : 'z-10'} ${className}`} 
      ref={containerRef}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setIsOpen(prev => !prev);
          setSearchQuery('');
        }}
        className={`${getButtonClass()} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        title={title}
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          {showIcon && (
            <div className={`flex items-center gap-1 shrink-0 ${scheme.iconText}`}>
              <GraduationCap size={size === 'xs' ? 12 : size === 'lg' ? 15 : 13} className="stroke-[2.4]" />
              {labelPrefix && (
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  {labelPrefix}
                </span>
              )}
            </div>
          )}

          {isAllSelected ? (
            <span className="font-extrabold text-slate-800 tracking-tight truncate">
              {defaultAllLabel}
            </span>
          ) : selectedClass ? (
            <div className="flex items-center gap-1.5 truncate">
              <span className="font-extrabold text-slate-900 tracking-tight truncate">
                {selectedClass.name}
              </span>
              {selectedClass.cycle && (
                <span className="text-[9px] px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded font-black shrink-0 hidden sm:inline">
                  {selectedClass.cycle}
                </span>
              )}
            </div>
          ) : (
            <span className="font-semibold text-slate-500 tracking-tight truncate">
              {emptyLabel}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-1.5">
          {/* Active indicator or count */}
          {!isAllSelected && selectedClass ? (
            <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black border ${scheme.badge}`}>
              Sélection
            </span>
          ) : (
            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-black bg-slate-100 text-slate-700 border border-slate-200">
              {classes.length}
            </span>
          )}

          <ChevronDown 
            size={size === 'xs' ? 12 : 14} 
            className={`text-slate-400 transition-transform duration-200 shrink-0 ${isOpen ? `rotate-180 ${scheme.iconText}` : ''}`} 
          />
        </div>
      </button>

      {/* Modern Floating Dropdown Menu */}
      {isOpen && (
        <div 
          className={`absolute ${effectiveAlign === 'right' ? 'right-0' : 'left-0'} top-full mt-2 w-72 sm:w-80 min-w-full max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl border border-slate-200 p-2 z-[100] animate-in fade-in zoom-in-95 duration-150`}
        >
          {/* Dropdown Header */}
          <div className="px-2.5 py-1.5 border-b border-slate-100 mb-2 flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <GraduationCap size={12} className={scheme.iconText} />
              {labelPrefix ? labelPrefix.replace(':', '').trim() : 'Classes'}
            </span>
            <span className="text-[10px] font-bold text-slate-600">
              {classes.length} disponible{classes.length > 1 ? 's' : ''}
            </span>
          </div>

          {/* Search Input for fast filtering when there are multiple classes */}
          {classes.length > 4 && (
            <div className="relative mb-2 px-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={13} />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher une classe..."
                className={`w-full pl-8 pr-7 py-1.5 bg-slate-50 hover:bg-slate-100/80 focus:bg-white text-xs font-bold text-slate-900 placeholder:text-slate-500 rounded-xl border border-slate-200 ${scheme.focusBorder} focus:ring-2 outline-none transition-all`}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 rounded-full"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          )}

          <div className="space-y-1 max-h-60 overflow-y-auto custom-scrollbar p-0.5">
            {/* Allow All Option */}
            {allowAll && (
              <button
                type="button"
                onClick={() => {
                  onSelectClass('all');
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-all duration-150 cursor-pointer ${
                  isAllSelected 
                    ? scheme.highlightBg + ' shadow-2xs font-bold' 
                    : 'hover:bg-slate-50 text-slate-700 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${isAllSelected ? scheme.dotColor : 'bg-slate-300'}`} />
                  <div className="min-w-0">
                    <span className="text-xs font-black text-slate-900 tracking-tight block truncate">
                      {defaultAllLabel}
                    </span>
                    <span className="text-[10px] font-medium text-slate-500 block">
                      Afficher tous les effectifs de cette sélection
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                    Global
                  </span>
                  {isAllSelected && (
                    <Check size={13} className={`${scheme.checkColor} stroke-[3]`} />
                  )}
                </div>
              </button>
            )}

            {/* Class Items */}
            {filteredClasses.length === 0 ? (
              <div className="p-3 text-center text-slate-500 text-xs font-medium">
                Aucune classe trouvée
              </div>
            ) : (
              filteredClasses.map((c) => {
                const isSelected = selectedClassId === c.id;

                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      onSelectClass(c.id);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-all duration-150 cursor-pointer ${
                      isSelected 
                        ? scheme.highlightBg + ' shadow-2xs font-bold' 
                        : 'hover:bg-slate-50 text-slate-700 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${isSelected ? scheme.dotColor : 'bg-slate-300'}`} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-black text-slate-900 tracking-tight">
                            {c.name}
                          </span>
                          {c.code && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded">
                              {c.code}
                            </span>
                          )}
                        </div>
                        {(c.cycle || c.level || c.section) && (
                          <span className="text-[10px] font-semibold text-slate-500 block truncate">
                            {[c.cycle, c.level, c.section].filter(Boolean).join(' • ')}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      {c.students_count !== undefined && (
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                          {c.students_count} él.
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
      )}
    </div>
  );
};
