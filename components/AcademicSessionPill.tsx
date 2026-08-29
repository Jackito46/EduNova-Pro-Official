import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown, Check, Sparkles } from 'lucide-react';

export interface AcademicSessionItem {
  id: string;
  label?: string;
  name?: string;
  status?: string;
  is_active?: boolean;
  session_type?: string;
  start_date?: string;
  end_date?: string;
}

export interface AcademicSessionPillProps {
  academicYears: AcademicSessionItem[];
  selectedYearId: string;
  onSelectYear: (yearId: string) => void;
  allowAll?: boolean;
  allLabel?: string;
  labelPrefix?: string;
  showIcon?: boolean;
  variant?: 'pill' | 'field' | 'compact' | 'minimal';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  dropdownAlign?: 'left' | 'right';
  disabled?: boolean;
  colorScheme?: 'indigo' | 'slate' | 'emerald' | 'blue' | 'purple' | 'rose';
  title?: string;
}

export const AcademicSessionPill: React.FC<AcademicSessionPillProps> = ({
  academicYears = [],
  selectedYearId,
  onSelectYear,
  allowAll = false,
  allLabel = 'Toutes les sessions',
  labelPrefix = 'Session :',
  showIcon = true,
  variant = 'pill',
  size = 'sm',
  className = '',
  dropdownAlign = 'left',
  disabled = false,
  colorScheme = 'indigo',
  title = 'Sélectionner la session académique'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const isAllSelected = selectedYearId === 'all';
  const currentSession = isAllSelected 
    ? null 
    : academicYears.find(y => y.id === selectedYearId) || 
      academicYears.find(y => y.is_active || y.status === 'ACTIVE') || 
      academicYears[0];

  const isAct = currentSession?.is_active || currentSession?.status === 'ACTIVE';
  const isFut = currentSession?.status === 'FUTURE';
  const isArch = !isAct && !isFut && !!currentSession;

  // Color mappings
  const colorMap = {
    indigo: {
      activeBorder: 'border-indigo-300 ring-2 ring-indigo-500/20 bg-indigo-50/70',
      badge: 'bg-indigo-50 text-indigo-700 border-indigo-100',
      iconText: 'text-indigo-600',
      highlightBg: 'bg-indigo-50/90 text-indigo-950 border-indigo-200/70',
      checkColor: 'text-indigo-600'
    },
    blue: {
      activeBorder: 'border-blue-300 ring-2 ring-blue-500/20 bg-blue-50/70',
      badge: 'bg-blue-50 text-blue-700 border-blue-100',
      iconText: 'text-blue-600',
      highlightBg: 'bg-blue-50/90 text-blue-950 border-blue-200/70',
      checkColor: 'text-blue-600'
    },
    emerald: {
      activeBorder: 'border-emerald-300 ring-2 ring-emerald-500/20 bg-emerald-50/70',
      badge: 'bg-emerald-50 text-emerald-700 border-emerald-100',
      iconText: 'text-emerald-600',
      highlightBg: 'bg-emerald-50/90 text-emerald-950 border-emerald-200/70',
      checkColor: 'text-emerald-600'
    },
    slate: {
      activeBorder: 'border-slate-400 ring-2 ring-slate-400/20 bg-slate-100/70',
      badge: 'bg-slate-100 text-slate-700 border-slate-200',
      iconText: 'text-slate-600',
      highlightBg: 'bg-slate-100/90 text-slate-900 border-slate-300/70',
      checkColor: 'text-slate-700'
    },
    purple: {
      activeBorder: 'border-purple-300 ring-2 ring-purple-500/20 bg-purple-50/70',
      badge: 'bg-purple-50 text-purple-700 border-purple-100',
      iconText: 'text-purple-600',
      highlightBg: 'bg-purple-50/90 text-purple-950 border-purple-200/70',
      checkColor: 'text-purple-600'
    },
    rose: {
      activeBorder: 'border-rose-300 ring-2 ring-rose-500/20 bg-rose-50/70',
      badge: 'bg-rose-50 text-rose-700 border-rose-100',
      iconText: 'text-rose-600',
      highlightBg: 'bg-rose-50/90 text-rose-950 border-rose-200/70',
      checkColor: 'text-rose-600'
    }
  };

  const scheme = colorMap[colorScheme] || colorMap.indigo;

  // Size styling
  const sizeClasses = {
    xs: 'px-2 py-0.5 text-[11px] rounded-lg gap-1.5',
    sm: 'px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs rounded-xl gap-2',
    md: 'px-3 sm:px-3.5 py-2 text-xs sm:text-sm rounded-xl gap-2.5',
    lg: 'px-4 py-2.5 text-sm rounded-2xl gap-3'
  }[size];

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
          ? 'text-indigo-600 bg-indigo-50/80 rounded-lg' 
          : 'text-slate-600 hover:text-slate-900 bg-transparent'
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
    <div className={`relative inline-block ${variant === 'field' ? 'w-full' : ''} ${isOpen ? 'z-[60]' : 'z-10'} ${className}`} ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(prev => !prev)}
        className={`${getButtonClass()} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        title={title}
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          {showIcon && (
            <div className={`flex items-center gap-1 shrink-0 ${scheme.iconText}`}>
              <Calendar size={size === 'xs' ? 12 : size === 'lg' ? 15 : 13} className="stroke-[2.4]" />
              {labelPrefix && (
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  {labelPrefix}
                </span>
              )}
            </div>
          )}

          {isAllSelected ? (
            <span className="font-extrabold text-slate-800 tracking-tight truncate">
              {allLabel}
            </span>
          ) : (
            <div className="flex items-center gap-1.5 truncate">
              <span className="font-extrabold text-slate-900 tracking-tight truncate">
                {currentSession?.label || currentSession?.name || 'Session'}
              </span>
              {currentSession?.session_type === 'INTENSIVE' && (
                <span className="text-[9px] px-1 py-0.2 bg-purple-50 text-purple-700 rounded border border-purple-200 font-black shrink-0">
                  Int.
                </span>
              )}
              {currentSession?.session_type === 'SPECIAL' && (
                <span className="text-[9px] px-1 py-0.2 bg-blue-50 text-blue-700 rounded border border-blue-200 font-black shrink-0">
                  Spé.
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-1.5">
          {/* Status Badge */}
          {!isAllSelected && currentSession && (
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-black border leading-none ${
              isAct 
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                : isFut 
                ? 'bg-amber-50 text-amber-700 border-amber-200' 
                : 'bg-slate-100 text-slate-600 border-slate-200'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                isAct ? 'bg-emerald-500' : isFut ? 'bg-amber-500' : 'bg-slate-400'
              }`} />
              <span className="hidden sm:inline">
                {isAct ? 'Active' : isFut ? 'En prép.' : 'Archivée'}
              </span>
            </span>
          )}

          {isAllSelected && (
            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-black bg-slate-100 text-slate-600 border border-slate-200">
              Global
            </span>
          )}

          {(academicYears.length > 1 || allowAll) && (
            <ChevronDown 
              size={size === 'xs' ? 12 : 14} 
              className={`text-slate-400 transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180 text-indigo-600' : ''}`} 
            />
          )}
        </div>
      </button>

      {/* Modern Floating Dropdown Menu */}
      {isOpen && (academicYears.length > 0 || allowAll) && (
        <div 
          className={`absolute ${dropdownAlign === 'right' ? 'right-0' : 'left-0'} top-full mt-2 w-72 sm:w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 p-2 z-[100] animate-in fade-in zoom-in-95 duration-150`}
        >
          {/* Dropdown Header */}
          <div className="px-2.5 py-1.5 border-b border-slate-100 mb-1 flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Calendar size={11} className={scheme.iconText} />
              Sessions Académiques
            </span>
            <span className="text-[10px] font-bold text-slate-400">
              {academicYears.length} session{academicYears.length > 1 ? 's' : ''}
            </span>
          </div>

          <div className="space-y-1 max-h-60 overflow-y-auto custom-scrollbar p-0.5">
            {/* Allow All Option */}
            {allowAll && (
              <button
                type="button"
                onClick={() => {
                  onSelectYear('all');
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-all duration-150 cursor-pointer ${
                  isAllSelected 
                    ? scheme.highlightBg + ' shadow-2xs font-bold' 
                    : 'hover:bg-slate-50 text-slate-700 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${isAllSelected ? 'bg-indigo-600 ring-2 ring-indigo-500/20' : 'bg-slate-300'}`} />
                  <div className="min-w-0">
                    <span className="text-xs font-black text-slate-900 tracking-tight block truncate">
                      {allLabel}
                    </span>
                    <span className="text-[10px] font-medium text-slate-400 block">
                      Afficher les données de toutes les sessions confondues
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                    Toutes
                  </span>
                  {isAllSelected && (
                    <Check size={13} className={`${scheme.checkColor} stroke-[3]`} />
                  )}
                </div>
              </button>
            )}

            {/* Session Items */}
            {academicYears.map((y) => {
              const itemActive = y.is_active || y.status === 'ACTIVE';
              const itemFuture = y.status === 'FUTURE';
              const isSelected = selectedYearId ? y.id === selectedYearId : itemActive;

              return (
                <button
                  key={y.id}
                  type="button"
                  onClick={() => {
                    onSelectYear(y.id);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-all duration-150 cursor-pointer ${
                    isSelected 
                      ? scheme.highlightBg + ' shadow-2xs font-bold' 
                      : 'hover:bg-slate-50 text-slate-700 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${
                      itemActive 
                        ? 'bg-emerald-500 ring-2 ring-emerald-500/20' 
                        : itemFuture 
                        ? 'bg-amber-500 ring-2 ring-amber-500/20' 
                        : 'bg-slate-300'
                    }`} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-black text-slate-900 tracking-tight">
                          {y.label || y.name}
                        </span>
                        {y.session_type === 'INTENSIVE' && (
                          <span className="text-[9px] font-extrabold px-1.5 py-0.2 bg-purple-50 text-purple-700 rounded border border-purple-200">
                            Intensive
                          </span>
                        )}
                        {y.session_type === 'SPECIAL' && (
                          <span className="text-[9px] font-extrabold px-1.5 py-0.2 bg-blue-50 text-blue-700 rounded border border-blue-200">
                            Spéciale
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-medium text-slate-400 block truncate">
                        {itemActive ? 'Session en cours' : itemFuture ? 'Session en préparation' : 'Session clôturée / archivée'}
                        {(y.start_date || y.end_date) && (
                          <span className="ml-1 text-slate-300">
                            • {y.start_date?.substring(0, 4) || ''}-{y.end_date?.substring(0, 4) || ''}
                          </span>
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md border ${
                      itemActive 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                        : itemFuture 
                        ? 'bg-amber-50 text-amber-700 border-amber-200' 
                        : 'bg-slate-100 text-slate-500 border-slate-200'
                    }`}>
                      {itemActive ? 'Active' : itemFuture ? 'En prép.' : 'Archivée'}
                    </span>
                    {isSelected && (
                      <Check size={13} className={`${scheme.checkColor} stroke-[3]`} />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
