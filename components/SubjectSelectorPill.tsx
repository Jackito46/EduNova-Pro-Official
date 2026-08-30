import React, { useState, useRef, useEffect } from 'react';
import { Layers, ChevronDown, Check, Search, X, BookOpen } from 'lucide-react';

export interface SubjectSelectorItem {
  id: string;
  name: string;
  code?: string;
  coefficient?: number;
  maxScore?: number;
}

export interface SubjectSelectorPillProps {
  subjects: SubjectSelectorItem[];
  selectedSubjectId: string;
  onSelectSubject: (subjectId: string) => void;
  labelPrefix?: string;
  allLabel?: string;
  variant?: 'pill' | 'field' | 'compact' | 'minimal';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  colorScheme?: 'blue' | 'indigo' | 'emerald' | 'slate' | 'purple' | 'amber';
  className?: string;
  dropdownAlign?: 'left' | 'right';
  disabled?: boolean;
  showIcon?: boolean;
  title?: string;
}

export const SubjectSelectorPill: React.FC<SubjectSelectorPillProps> = ({
  subjects = [],
  selectedSubjectId,
  onSelectSubject,
  labelPrefix = 'Matière :',
  allLabel,
  variant = 'pill',
  size = 'sm',
  colorScheme = 'blue',
  className = '',
  dropdownAlign = 'left',
  disabled = false,
  showIcon = true,
  title = 'Filtrer par matière'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  const isAllSelected = !selectedSubjectId || selectedSubjectId === 'ALL' || selectedSubjectId === 'all';
  const selectedSubject = isAllSelected ? null : subjects.find(s => s.id === selectedSubjectId);

  const defaultAllLabel = allLabel || `Toutes les matières (${subjects.length})`;

  // Color mappings
  const colorMap = {
    blue: {
      activeBorder: 'border-blue-300 ring-2 ring-blue-500/20 bg-blue-50/70',
      badge: 'bg-blue-50 text-blue-700 border-blue-100',
      iconText: 'text-blue-600',
      highlightBg: 'bg-blue-50/90 text-blue-950 border-blue-200/70',
      checkColor: 'text-blue-600'
    },
    indigo: {
      activeBorder: 'border-indigo-300 ring-2 ring-indigo-500/20 bg-indigo-50/70',
      badge: 'bg-indigo-50 text-indigo-700 border-indigo-100',
      iconText: 'text-indigo-600',
      highlightBg: 'bg-indigo-50/90 text-indigo-950 border-indigo-200/70',
      checkColor: 'text-indigo-600'
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
    amber: {
      activeBorder: 'border-amber-300 ring-2 ring-amber-500/20 bg-amber-50/70',
      badge: 'bg-amber-50 text-amber-700 border-amber-100',
      iconText: 'text-amber-600',
      highlightBg: 'bg-amber-50/90 text-amber-950 border-amber-200/70',
      checkColor: 'text-amber-600'
    }
  };

  const scheme = colorMap[colorScheme] || colorMap.blue;

  const sizeClasses = {
    xs: 'px-2 py-0.5 text-[11px] rounded-lg gap-1.5',
    sm: 'px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs rounded-xl gap-2',
    md: 'px-3 sm:px-3.5 py-2 text-xs sm:text-sm rounded-xl gap-2.5',
    lg: 'px-4 py-2.5 text-sm rounded-2xl gap-3'
  }[size];

  const filteredSubjects = subjects.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.code && s.code.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const getButtonClass = () => {
    if (variant === 'field') {
      return `w-full flex items-center justify-between px-3.5 py-2 bg-white hover:bg-slate-50 border rounded-xl text-left transition-all duration-200 shadow-2xs ${
        isOpen 
          ? scheme.activeBorder 
          : 'border-slate-200 hover:border-slate-300 text-slate-800'
      }`;
    }

    if (variant === 'minimal') {
      return `inline-flex items-center text-xs font-bold transition-all duration-200 ${sizeClasses} ${
        isOpen 
          ? 'text-blue-600 bg-blue-50/80 rounded-lg' 
          : 'text-slate-600 hover:text-slate-900 bg-transparent'
      }`;
    }

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
              <Layers size={size === 'xs' ? 12 : size === 'lg' ? 15 : 13} className="stroke-[2.4]" />
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
          ) : selectedSubject ? (
            <div className="flex items-center gap-1.5 truncate">
              <span className="font-extrabold text-slate-900 tracking-tight truncate">
                {selectedSubject.name}
              </span>
              {selectedSubject.coefficient !== undefined && (
                <span className="text-[9px] px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded font-black shrink-0 hidden sm:inline">
                  Coef {selectedSubject.coefficient}
                </span>
              )}
            </div>
          ) : (
            <span className="font-semibold text-slate-500 tracking-tight truncate">
              Sélectionner une matière
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-1.5">
          {!isAllSelected && selectedSubject ? (
            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-black bg-blue-50 text-blue-700 border border-blue-200">
              {selectedSubject.maxScore ? `/${selectedSubject.maxScore}` : 'Choix'}
            </span>
          ) : (
            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-black bg-slate-100 text-slate-600 border border-slate-200">
              {subjects.length}
            </span>
          )}

          <ChevronDown 
            size={size === 'xs' ? 12 : 14} 
            className={`text-slate-400 transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180 text-blue-600' : ''}`} 
          />
        </div>
      </button>

      {/* Modern Floating Dropdown Menu */}
      {isOpen && (
        <div 
          className={`absolute ${dropdownAlign === 'right' ? 'right-0' : 'left-0'} top-full mt-2 w-72 sm:w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 p-2 z-[100] animate-in fade-in zoom-in-95 duration-150`}
        >
          {/* Dropdown Header */}
          <div className="px-2.5 py-1.5 border-b border-slate-100 mb-2 flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Layers size={12} className={scheme.iconText} />
              {labelPrefix ? labelPrefix.replace(':', '').trim() : 'Matières'}
            </span>
            <span className="text-[10px] font-bold text-slate-400">
              {subjects.length} matière{subjects.length > 1 ? 's' : ''}
            </span>
          </div>

          {/* Search Input */}
          {subjects.length > 4 && (
            <div className="relative mb-2 px-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher une matière..."
                className="w-full pl-8 pr-7 py-1.5 bg-slate-50 hover:bg-slate-100/80 focus:bg-white text-xs font-semibold text-slate-800 placeholder:text-slate-400 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
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
            <button
              type="button"
              onClick={() => {
                onSelectSubject('ALL');
                setIsOpen(false);
              }}
              className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-all duration-150 cursor-pointer ${
                isAllSelected 
                  ? scheme.highlightBg + ' shadow-2xs font-bold' 
                  : 'hover:bg-slate-50 text-slate-700 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`w-2 h-2 rounded-full shrink-0 ${isAllSelected ? 'bg-blue-600 ring-2 ring-blue-500/20' : 'bg-slate-300'}`} />
                <div className="min-w-0">
                  <span className="text-xs font-black text-slate-900 tracking-tight block truncate">
                    {defaultAllLabel}
                  </span>
                  <span className="text-[10px] font-medium text-slate-400 block">
                    Afficher toutes les colonnes de notation
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                  Vue Grille
                </span>
                {isAllSelected && (
                  <Check size={13} className={`${scheme.checkColor} stroke-[3]`} />
                )}
              </div>
            </button>

            {/* Subject Items */}
            {filteredSubjects.length === 0 ? (
              <div className="p-3 text-center text-slate-400 text-xs font-medium">
                Aucune matière trouvée
              </div>
            ) : (
              filteredSubjects.map((s) => {
                const isSelected = selectedSubjectId === s.id;

                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      onSelectSubject(s.id);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-all duration-150 cursor-pointer ${
                      isSelected 
                        ? scheme.highlightBg + ' shadow-2xs font-bold' 
                        : 'hover:bg-slate-50 text-slate-700 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${isSelected ? 'bg-blue-600 ring-2 ring-blue-500/20' : 'bg-slate-300'}`} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-black text-slate-900 tracking-tight">
                            {s.name}
                          </span>
                          {s.code && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded">
                              {s.code}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-medium text-slate-400">
                          {s.coefficient !== undefined && <span>Coef : {s.coefficient}</span>}
                          {s.maxScore !== undefined && <span>• Sur {s.maxScore} pts</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
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
