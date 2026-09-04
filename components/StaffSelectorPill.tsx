import React, { useState, useRef, useEffect } from 'react';
import { User, ChevronDown, Check, Search, X, Users, BookOpen } from 'lucide-react';
import { formatStudentName } from '../utils/formatters';

export interface StaffItem {
  id: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  email?: string;
  role?: string;
  specialty?: string;
  subject_specialty?: string;
  photo_url?: string;
  campus_id?: string;
}

export interface StaffSelectorPillProps {
  staffList: StaffItem[];
  selectedStaffId: string;
  onSelectStaff: (staffId: string) => void;
  allowAll?: boolean;
  allLabel?: string;
  labelPrefix?: string;
  emptyLabel?: string;
  variant?: 'pill' | 'field' | 'compact';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  colorScheme?: 'indigo' | 'slate' | 'emerald' | 'blue' | 'purple' | 'rose';
  dropdownAlign?: 'left' | 'right';
  className?: string;
  disabled?: boolean;
}

export const StaffSelectorPill: React.FC<StaffSelectorPillProps> = ({
  staffList = [],
  selectedStaffId,
  onSelectStaff,
  allowAll = false,
  allLabel = 'Tous les enseignants',
  labelPrefix = '',
  emptyLabel = 'Choisir un enseignant...',
  variant = 'pill',
  size = 'sm',
  colorScheme = 'indigo',
  dropdownAlign,
  className = '',
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [effectiveAlign, setEffectiveAlign] = useState<'left' | 'right'>(dropdownAlign || 'left');
  const containerRef = useRef<HTMLDivElement>(null);

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

  const isAllSelected = selectedStaffId === 'all' || selectedStaffId === 'ALL';
  const selectedStaff = isAllSelected ? null : staffList.find(s => s.id === selectedStaffId);

  const filteredStaff = staffList.filter(s => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const fullName = s.name || `${s.first_name || ''} ${s.last_name || ''}`;
    const spec = s.specialty || s.subject_specialty || '';
    const email = s.email || '';
    return fullName.toLowerCase().includes(q) || spec.toLowerCase().includes(q) || email.toLowerCase().includes(q);
  });

  const colorMap = {
    indigo: {
      activeBorder: 'border-indigo-300 ring-2 ring-indigo-500/20 bg-indigo-50/70',
      badge: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      iconText: 'text-indigo-600',
      highlightBg: 'bg-indigo-50/90 text-indigo-950 border-indigo-200/70',
      checkColor: 'text-indigo-600',
      dotColor: 'bg-indigo-600',
      focusBorder: 'focus:border-indigo-500 focus:ring-indigo-100'
    },
    blue: {
      activeBorder: 'border-blue-300 ring-2 ring-blue-500/20 bg-blue-50/70',
      badge: 'bg-blue-50 text-blue-700 border-blue-200',
      iconText: 'text-blue-600',
      highlightBg: 'bg-blue-50/90 text-blue-950 border-blue-200/70',
      checkColor: 'text-blue-600',
      dotColor: 'bg-blue-600',
      focusBorder: 'focus:border-blue-500 focus:ring-blue-100'
    },
    emerald: {
      activeBorder: 'border-emerald-300 ring-2 ring-emerald-500/20 bg-emerald-50/70',
      badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      iconText: 'text-emerald-600',
      highlightBg: 'bg-emerald-50/90 text-emerald-950 border-emerald-200/70',
      checkColor: 'text-emerald-600',
      dotColor: 'bg-emerald-600',
      focusBorder: 'focus:border-emerald-500 focus:ring-emerald-100'
    },
    purple: {
      activeBorder: 'border-purple-300 ring-2 ring-purple-500/20 bg-purple-50/70',
      badge: 'bg-purple-50 text-purple-700 border-purple-200',
      iconText: 'text-purple-600',
      highlightBg: 'bg-purple-50/90 text-purple-950 border-purple-200/70',
      checkColor: 'text-purple-600',
      dotColor: 'bg-purple-600',
      focusBorder: 'focus:border-purple-500 focus:ring-purple-100'
    },
    rose: {
      activeBorder: 'border-rose-300 ring-2 ring-rose-500/20 bg-rose-50/70',
      badge: 'bg-rose-50 text-rose-700 border-rose-200',
      iconText: 'text-rose-600',
      highlightBg: 'bg-rose-50/90 text-rose-950 border-rose-200/70',
      checkColor: 'text-rose-600',
      dotColor: 'bg-rose-600',
      focusBorder: 'focus:border-rose-500 focus:ring-rose-100'
    },
    slate: {
      activeBorder: 'border-slate-300 ring-2 ring-slate-400/20 bg-slate-100',
      badge: 'bg-slate-100 text-slate-700 border-slate-200',
      iconText: 'text-slate-600',
      highlightBg: 'bg-slate-100 text-slate-900 border-slate-200',
      checkColor: 'text-slate-700',
      dotColor: 'bg-slate-700',
      focusBorder: 'focus:border-slate-500 focus:ring-slate-100'
    }
  };

  const scheme = colorMap[colorScheme] || colorMap.indigo;

  const sizeClasses = {
    xs: 'px-2.5 py-1 text-xs gap-1.5 min-h-[30px]',
    sm: 'px-3 py-1.5 text-xs gap-2 min-h-[36px]',
    md: 'px-3.5 py-2.5 text-xs sm:text-sm gap-2 min-h-[42px]',
    lg: 'px-4 py-3 text-sm gap-2.5 min-h-[46px]'
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

  const getDisplayName = (s: StaffItem) => {
    if (s.name) return s.name;
    return formatStudentName(s.last_name, s.first_name).fullName;
  };

  return (
    <div className={`relative inline-block ${variant === 'field' ? 'w-full' : ''} ${className}`} ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setIsOpen(prev => !prev);
          setSearchQuery('');
        }}
        className={`${getButtonClass()} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className={`flex items-center gap-1 shrink-0 ${scheme.iconText}`}>
            <User size={size === 'xs' ? 12 : size === 'lg' ? 15 : 13} className="stroke-[2.4]" />
            {labelPrefix && (
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-800">
                {labelPrefix}
              </span>
            )}
          </div>

          {isAllSelected ? (
            <span className="font-extrabold text-slate-900 tracking-tight truncate">
              {allLabel}
            </span>
          ) : selectedStaff ? (
            <div className="flex items-center gap-1.5 truncate">
              <span className="font-extrabold text-slate-900 tracking-tight truncate">
                {getDisplayName(selectedStaff)}
              </span>
              {(selectedStaff.specialty || selectedStaff.subject_specialty) && (
                <span className="text-[9px] px-1.5 py-0.2 bg-slate-100 text-slate-700 rounded font-black shrink-0 hidden sm:inline">
                  {selectedStaff.specialty || selectedStaff.subject_specialty}
                </span>
              )}
            </div>
          ) : (
            <span className="font-semibold text-slate-700 tracking-tight truncate">
              {emptyLabel}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-1.5">
          {!isAllSelected && selectedStaff ? (
            <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black border ${scheme.badge}`}>
              Sélection
            </span>
          ) : (
            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-black bg-slate-100 text-slate-800 border border-slate-200">
              {staffList.length}
            </span>
          )}

          <ChevronDown
            size={size === 'xs' ? 12 : 14}
            className={`text-slate-500 transition-transform duration-200 shrink-0 ${isOpen ? `rotate-180 ${scheme.iconText}` : ''}`}
          />
        </div>
      </button>

      {isOpen && (
        <div
          className={`absolute ${effectiveAlign === 'right' ? 'right-0' : 'left-0'} top-full mt-2 w-72 sm:w-80 min-w-full max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl border border-slate-200 p-2 z-[100] animate-in fade-in zoom-in-95 duration-150`}
        >
          {/* Header */}
          <div className="px-2.5 py-1.5 border-b border-slate-100 mb-2 flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
              <Users size={12} className={scheme.iconText} />
              Enseignants
            </span>
            <span className="text-[10px] font-bold text-slate-800">
              {staffList.length} disponible{staffList.length > 1 ? 's' : ''}
            </span>
          </div>

          {/* Search */}
          <div className="relative mb-2">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-700" />
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par nom ou spécialité..."
              className={`w-full pl-8 pr-7 py-1.5 bg-slate-50 hover:bg-slate-100/80 focus:bg-white text-xs font-bold text-slate-950 placeholder:text-slate-600 rounded-xl border border-slate-200 ${scheme.focusBorder} focus:ring-2 outline-none transition-all`}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-900 p-0.5"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <div className="max-h-60 overflow-y-auto space-y-1 custom-scrollbar">
            {allowAll && (
              <button
                type="button"
                onClick={() => {
                  onSelectStaff('all');
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-all duration-150 cursor-pointer ${
                  isAllSelected
                    ? scheme.highlightBg + ' shadow-2xs font-bold'
                    : 'hover:bg-slate-50 text-slate-800 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${isAllSelected ? scheme.dotColor : 'bg-slate-400'}`} />
                  <div className="min-w-0">
                    <span className="text-xs font-black text-slate-950 tracking-tight block truncate">
                      {allLabel}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-700 block">
                      Afficher tous les créneaux ou professeurs
                    </span>
                  </div>
                </div>
                {isAllSelected && (
                  <Check size={13} className={`${scheme.checkColor} stroke-[3]`} />
                )}
              </button>
            )}

            {filteredStaff.length === 0 ? (
              <div className="p-3 text-center text-slate-700 text-xs font-bold">
                Aucun enseignant trouvé
              </div>
            ) : (
              filteredStaff.map((s) => {
                const isSelected = selectedStaffId === s.id;
                const displayName = getDisplayName(s);
                const spec = s.specialty || s.subject_specialty;

                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      onSelectStaff(s.id);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-all duration-150 cursor-pointer ${
                      isSelected
                        ? scheme.highlightBg + ' shadow-2xs font-bold'
                        : 'hover:bg-slate-50 text-slate-800 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${isSelected ? scheme.dotColor : 'bg-slate-400'}`} />
                      <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0 overflow-hidden">
                        {s.photo_url ? (
                          <img src={s.photo_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          displayName.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-black text-slate-900 tracking-tight block truncate">
                          {displayName}
                        </span>
                        {spec && (
                          <span className="text-[10px] font-bold text-slate-700 block truncate flex items-center gap-1">
                            <BookOpen size={10} className="text-slate-500" />
                            {spec}
                          </span>
                        )}
                      </div>
                    </div>

                    {isSelected && (
                      <Check size={13} className={`${scheme.checkColor} stroke-[3] ml-2 shrink-0`} />
                    )}
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
