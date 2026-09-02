import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Calendar, ChevronLeft, ChevronRight, ChevronDown, 
  RotateCcw, Sparkles, Check, Clock, X
} from 'lucide-react';
import { format, parseISO, isValid, addDays, subDays, startOfWeek, endOfWeek, isSameDay } from 'date-fns';
import { fr } from 'date-fns/locale';

export interface DatePickerPillProps {
  selectedDate: string; // Format YYYY-MM-DD
  onSelectDate: (dateStr: string) => void;
  labelPrefix?: string;
  variant?: 'pill' | 'field' | 'compact' | 'header';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  colorScheme?: 'blue' | 'indigo' | 'emerald' | 'slate' | 'purple' | 'amber' | 'rose';
  className?: string;
  dropdownAlign?: 'left' | 'right';
  disabled?: boolean;
  minDate?: string;
  maxDate?: string;
  showShortcuts?: boolean;
  showQuickArrows?: boolean;
  showTodayBadge?: boolean;
  title?: string;
}

const COLOR_SCHEMES = {
  rose: {
    border: 'border-rose-200 hover:border-rose-300',
    focusBorder: 'focus:border-rose-500 focus:ring-rose-500/20',
    selectedBg: 'bg-rose-600 text-white',
    badge: 'bg-rose-100 text-rose-700',
    todayBadge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    activeRing: 'ring-rose-500',
    iconText: 'text-rose-600',
    shortcutActive: 'bg-rose-600 text-white shadow-xs',
    shortcutInactive: 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
  },
  blue: {
    border: 'border-blue-200 hover:border-blue-300',
    focusBorder: 'focus:border-blue-500 focus:ring-blue-500/20',
    selectedBg: 'bg-blue-600 text-white',
    badge: 'bg-blue-100 text-blue-700',
    todayBadge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    activeRing: 'ring-blue-500',
    iconText: 'text-blue-600',
    shortcutActive: 'bg-blue-600 text-white shadow-xs',
    shortcutInactive: 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
  },
  indigo: {
    border: 'border-indigo-200 hover:border-indigo-300',
    focusBorder: 'focus:border-indigo-500 focus:ring-indigo-500/20',
    selectedBg: 'bg-indigo-600 text-white',
    badge: 'bg-indigo-100 text-indigo-700',
    todayBadge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    activeRing: 'ring-indigo-500',
    iconText: 'text-indigo-600',
    shortcutActive: 'bg-indigo-600 text-white shadow-xs',
    shortcutInactive: 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
  },
  emerald: {
    border: 'border-emerald-200 hover:border-emerald-300',
    focusBorder: 'focus:border-emerald-500 focus:ring-emerald-500/20',
    selectedBg: 'bg-emerald-600 text-white',
    badge: 'bg-emerald-100 text-emerald-700',
    todayBadge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    activeRing: 'ring-emerald-500',
    iconText: 'text-emerald-600',
    shortcutActive: 'bg-emerald-600 text-white shadow-xs',
    shortcutInactive: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
  },
  slate: {
    border: 'border-slate-300 hover:border-slate-400',
    focusBorder: 'focus:border-slate-600 focus:ring-slate-500/20',
    selectedBg: 'bg-slate-900 text-white',
    badge: 'bg-slate-200 text-slate-800',
    todayBadge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    activeRing: 'ring-slate-700',
    iconText: 'text-slate-700',
    shortcutActive: 'bg-slate-900 text-white shadow-xs',
    shortcutInactive: 'bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-300'
  },
  purple: {
    border: 'border-purple-200 hover:border-purple-300',
    focusBorder: 'focus:border-purple-500 focus:ring-purple-500/20',
    selectedBg: 'bg-purple-600 text-white',
    badge: 'bg-purple-100 text-purple-700',
    todayBadge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    activeRing: 'ring-purple-500',
    iconText: 'text-purple-600',
    shortcutActive: 'bg-purple-600 text-white shadow-xs',
    shortcutInactive: 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200'
  },
  amber: {
    border: 'border-amber-200 hover:border-amber-300',
    focusBorder: 'focus:border-amber-500 focus:ring-amber-500/20',
    selectedBg: 'bg-amber-600 text-white',
    badge: 'bg-amber-100 text-amber-700',
    todayBadge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    activeRing: 'ring-amber-500',
    iconText: 'text-amber-600',
    shortcutActive: 'bg-amber-600 text-white shadow-xs',
    shortcutInactive: 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
  }
};

const FRENCH_MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

const WEEKDAY_NAMES = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

export const DatePickerPill: React.FC<DatePickerPillProps> = ({
  selectedDate,
  onSelectDate,
  labelPrefix,
  variant = 'field',
  size = 'sm',
  colorScheme = 'blue',
  className = '',
  dropdownAlign,
  disabled = false,
  minDate,
  maxDate,
  showShortcuts = true,
  showQuickArrows = true,
  showTodayBadge = true,
  title = 'Sélectionner une date'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [effectiveAlign, setEffectiveAlign] = useState<'left' | 'right'>(dropdownAlign || 'left');

  // Format today string YYYY-MM-DD
  const todayStr = useMemo(() => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().split('T')[0];
  }, []);

  // Parse current selected date
  const parsedDate = useMemo(() => {
    try {
      if (!selectedDate) return new Date();
      const d = parseISO(selectedDate);
      return isValid(d) ? d : new Date();
    } catch {
      return new Date();
    }
  }, [selectedDate]);

  // View state for the calendar (Month / Year being browsed)
  const [viewYear, setViewYear] = useState<number>(() => parsedDate.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(() => parsedDate.getMonth());
  const [showMonthYearPicker, setShowMonthYearPicker] = useState(false);

  // Sync calendar view month when selectedDate changes
  useEffect(() => {
    if (parsedDate && isValid(parsedDate)) {
      setViewYear(parsedDate.getFullYear());
      setViewMonth(parsedDate.getMonth());
    }
  }, [selectedDate, parsedDate]);

  const scheme = COLOR_SCHEMES[colorScheme] || COLOR_SCHEMES.blue;
  const isToday = selectedDate === todayStr;

  // Handle alignment detection dynamically on resize / open
  useEffect(() => {
    if (dropdownAlign) {
      setEffectiveAlign(dropdownAlign);
    } else if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceOnRight = window.innerWidth - rect.left;
      if (spaceOnRight < 340 && rect.right >= 340) {
        setEffectiveAlign('right');
      } else {
        setEffectiveAlign('left');
      }
    }
  }, [dropdownAlign, isOpen]);

  // Close when clicked outside or pressed Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (
        containerRef.current && 
        !containerRef.current.contains(event.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setShowMonthYearPicker(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        setShowMonthYearPicker(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Quick shift handler (+/- days)
  const handleShiftDay = (days: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const current = parseISO(selectedDate || todayStr);
      const newD = addDays(current, days);
      const newStr = format(newD, 'yyyy-MM-dd');
      onSelectDate(newStr);
    } catch (err) {
      console.error("Shift date error:", err);
    }
  };

  // Calendar month navigation
  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(y => y - 1);
    } else {
      setViewMonth(m => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(y => y + 1);
    } else {
      setViewMonth(m => m + 1);
    }
  };

  // Build calendar matrix (Monday-first ISO format)
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
    const lastDayOfMonth = new Date(viewYear, viewMonth + 1, 0);

    let startDayOfWeek = firstDayOfMonth.getDay(); // 0 (Sun) to 6 (Sat)
    let mondayStartIndex = (startDayOfWeek + 6) % 7;

    const days: Array<{
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      isSelected: boolean;
      isWeekend: boolean;
      isDisabled: boolean;
    }> = [];

    // Previous month filler days
    const prevMonthLastDate = new Date(viewYear, viewMonth, 0).getDate();
    for (let i = mondayStartIndex - 1; i >= 0; i--) {
      const dayNum = prevMonthLastDate - i;
      const d = new Date(viewYear, viewMonth - 1, dayNum);
      const dStr = format(d, 'yyyy-MM-dd');
      const dayOfWeek = d.getDay();
      days.push({
        dateStr: dStr,
        dayNumber: dayNum,
        isCurrentMonth: false,
        isToday: dStr === todayStr,
        isSelected: dStr === selectedDate,
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
        isDisabled: (minDate && dStr < minDate) || (maxDate && dStr > maxDate) || false
      });
    }

    // Current month days
    const totalDaysInMonth = lastDayOfMonth.getDate();
    for (let dayNum = 1; dayNum <= totalDaysInMonth; dayNum++) {
      const d = new Date(viewYear, viewMonth, dayNum);
      const dStr = format(d, 'yyyy-MM-dd');
      const dayOfWeek = d.getDay();
      days.push({
        dateStr: dStr,
        dayNumber: dayNum,
        isCurrentMonth: true,
        isToday: dStr === todayStr,
        isSelected: dStr === selectedDate,
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
        isDisabled: (minDate && dStr < minDate) || (maxDate && dStr > maxDate) || false
      });
    }

    // Next month filler days to complete grid
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(viewYear, viewMonth + 1, i);
      const dStr = format(d, 'yyyy-MM-dd');
      const dayOfWeek = d.getDay();
      days.push({
        dateStr: dStr,
        dayNumber: i,
        isCurrentMonth: false,
        isToday: dStr === todayStr,
        isSelected: dStr === selectedDate,
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
        isDisabled: (minDate && dStr < minDate) || (maxDate && dStr > maxDate) || false
      });
    }

    return days;
  }, [viewYear, viewMonth, selectedDate, todayStr, minDate, maxDate]);

  // Formatted date representations (responsive full vs short)
  const formattedDisplay = useMemo(() => {
    try {
      if (!selectedDate) return 'Sélectionner une date';
      const d = parseISO(selectedDate);
      if (!isValid(d)) return selectedDate;
      return format(d, 'EEEE d MMMM yyyy', { locale: fr });
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  const mediumFormattedDisplay = useMemo(() => {
    try {
      if (!selectedDate) return 'Sélectionner une date';
      const d = parseISO(selectedDate);
      if (!isValid(d)) return selectedDate;
      return format(d, 'EEE d MMM yyyy', { locale: fr });
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  const shortFormattedDisplay = useMemo(() => {
    try {
      if (!selectedDate) return 'Date';
      const d = parseISO(selectedDate);
      if (!isValid(d)) return selectedDate;
      return format(d, 'd MMM yyyy', { locale: fr });
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  // Quick preset actions
  const setQuickDate = (type: 'today' | 'yesterday' | 'tomorrow' | 'monday' | 'friday') => {
    const now = new Date();
    let target = now;
    if (type === 'today') {
      target = now;
    } else if (type === 'yesterday') {
      target = subDays(now, 1);
    } else if (type === 'tomorrow') {
      target = addDays(now, 1);
    } else if (type === 'monday') {
      target = startOfWeek(now, { weekStartsOn: 1 });
    } else if (type === 'friday') {
      target = addDays(startOfWeek(now, { weekStartsOn: 1 }), 4);
    }
    const dStr = format(target, 'yyyy-MM-dd');
    onSelectDate(dStr);
    setViewYear(target.getFullYear());
    setViewMonth(target.getMonth());
    setIsOpen(false);
  };

  // Year options for fast switcher (10 years back, 5 years ahead)
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const list: number[] = [];
    for (let y = currentYear - 7; y <= currentYear + 5; y++) {
      list.push(y);
    }
    return list;
  }, []);

  const renderDropdownContent = () => (
    <div className="space-y-3">
      {/* Mobile Top Header (Mobile Only) */}
      <div className="flex sm:hidden items-center justify-between pb-2 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Calendar size={16} className={scheme.iconText} />
          <span className="text-xs font-black text-slate-900">Sélectionner une date</span>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="p-1.5 hover:bg-slate-100 text-slate-500 rounded-lg cursor-pointer"
        >
          <X size={16} />
        </button>
      </div>

      {/* Quick Presets Bar */}
      {showShortcuts && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 border-b border-slate-100 custom-scrollbar -mx-1 px-1">
          <button
            type="button"
            onClick={() => setQuickDate('today')}
            className={`min-h-[34px] px-3 py-1 text-xs font-black rounded-xl transition-all whitespace-nowrap cursor-pointer shrink-0 active:scale-95 ${
              isToday 
                ? scheme.shortcutActive
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
            }`}
          >
            Aujourd'hui
          </button>
          <button
            type="button"
            onClick={() => setQuickDate('yesterday')}
            className="min-h-[34px] px-3 py-1 text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all whitespace-nowrap border border-slate-200 cursor-pointer shrink-0 active:scale-95"
          >
            Hier
          </button>
          <button
            type="button"
            onClick={() => setQuickDate('monday')}
            className="min-h-[34px] px-3 py-1 text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all whitespace-nowrap border border-slate-200 cursor-pointer shrink-0 active:scale-95"
          >
            Lundi
          </button>
          <button
            type="button"
            onClick={() => setQuickDate('friday')}
            className="min-h-[34px] px-3 py-1 text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all whitespace-nowrap border border-slate-200 cursor-pointer shrink-0 active:scale-95"
          >
            Vendredi
          </button>
        </div>
      )}

      {/* Month & Year Navigation Header */}
      <div className="flex items-center justify-between px-0.5">
        <button
          type="button"
          onClick={prevMonth}
          className="min-h-[38px] min-w-[38px] p-2 hover:bg-slate-100 text-slate-700 hover:text-slate-900 rounded-xl transition-all active:scale-95 flex items-center justify-center cursor-pointer"
          title="Mois précédent"
        >
          <ChevronLeft size={18} className="stroke-[2.5]" />
        </button>

        <button
          type="button"
          onClick={() => setShowMonthYearPicker(!showMonthYearPicker)}
          className="min-h-[38px] px-3 py-1.5 hover:bg-slate-100 rounded-xl text-xs sm:text-sm font-black text-slate-900 flex items-center gap-1.5 transition-all group cursor-pointer"
        >
          <span>{FRENCH_MONTHS[viewMonth]} {viewYear}</span>
          <ChevronDown size={14} className={`text-slate-500 group-hover:text-slate-800 transition-transform ${showMonthYearPicker ? 'rotate-180' : ''}`} />
        </button>

        <button
          type="button"
          onClick={nextMonth}
          className="min-h-[38px] min-w-[38px] p-2 hover:bg-slate-100 text-slate-700 hover:text-slate-900 rounded-xl transition-all active:scale-95 flex items-center justify-center cursor-pointer"
          title="Mois suivant"
        >
          <ChevronRight size={18} className="stroke-[2.5]" />
        </button>
      </div>

      {/* Fast Month / Year Selector Grid */}
      {showMonthYearPicker ? (
        <div className="py-2 space-y-3 animate-in fade-in zoom-in-95 duration-100">
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 px-1">
            Choisir le mois & l'année
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {FRENCH_MONTHS.map((mName, idx) => (
              <button
                key={mName}
                type="button"
                onClick={() => {
                  setViewMonth(idx);
                  setShowMonthYearPicker(false);
                }}
                className={`min-h-[36px] py-2 px-1 rounded-xl text-xs font-bold text-center transition-all cursor-pointer active:scale-95 ${
                  viewMonth === idx 
                    ? `${scheme.selectedBg} font-black shadow-xs` 
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-100'
                }`}
              >
                {mName.substring(0, 4)}
              </button>
            ))}
          </div>

          {/* Year Chips */}
          <div className="pt-2 border-t border-slate-100">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 px-1 mb-1.5">
              Année
            </div>
            <div className="flex items-center gap-1 overflow-x-auto pb-1 custom-scrollbar">
              {yearOptions.map(y => (
                <button
                  key={y}
                  type="button"
                  onClick={() => {
                    setViewYear(y);
                    setShowMonthYearPicker(false);
                  }}
                  className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-bold shrink-0 transition-all cursor-pointer active:scale-95 ${
                    viewYear === y
                      ? `${scheme.selectedBg} font-black shadow-xs`
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Day of week headers */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {WEEKDAY_NAMES.map((wd, idx) => (
              <div 
                key={wd} 
                className={`text-[10px] sm:text-[11px] font-black uppercase tracking-wider py-1 ${
                  idx >= 5 ? 'text-rose-500/80' : 'text-slate-600'
                }`}
              >
                {wd}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {calendarDays.map((d, index) => {
              return (
                <button
                  key={`${d.dateStr}-${index}`}
                  type="button"
                  disabled={d.isDisabled}
                  onClick={() => {
                    if (!d.isDisabled) {
                      onSelectDate(d.dateStr);
                      setIsOpen(false);
                    }
                  }}
                  className={`
                    min-h-[38px] sm:min-h-[36px] w-full rounded-xl flex flex-col items-center justify-center relative text-xs sm:text-[13px] transition-all
                    ${d.isSelected 
                      ? `${scheme.selectedBg} font-black shadow-md scale-105 z-10` 
                      : d.isToday
                        ? 'bg-emerald-50 text-emerald-900 font-black border-2 border-emerald-500 hover:bg-emerald-100'
                        : d.isCurrentMonth
                          ? d.isWeekend
                            ? 'text-slate-700 hover:bg-slate-100 font-bold'
                            : 'text-slate-900 hover:bg-slate-100 font-bold'
                          : 'text-slate-300 hover:bg-slate-50 font-medium'
                    }
                    ${d.isDisabled ? 'opacity-25 cursor-not-allowed' : 'cursor-pointer active:scale-90'}
                  `}
                >
                  <span>{d.dayNumber}</span>
                  {d.isToday && !d.isSelected && (
                    <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full absolute bottom-1" />
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Footer Bar */}
      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
        <span className="text-[11px] font-bold text-slate-600 truncate max-w-[200px] capitalize">
          {formattedDisplay}
        </span>

        {!isToday && (
          <button
            type="button"
            onClick={() => setQuickDate('today')}
            className="text-[11px] font-black text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw size={12} className="stroke-[2.5]" />
            <span>Aujourd'hui</span>
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div 
      ref={containerRef} 
      className={`relative inline-block w-full text-left font-sans ${className}`}
      title={title}
    >
      {/* TRIGGER BAR */}
      <div className="flex items-center gap-1 sm:gap-1.5 w-full">
        {/* Quick Shift Previous Day Button */}
        {showQuickArrows && (
          <button
            type="button"
            onClick={(e) => handleShiftDay(-1, e)}
            disabled={disabled}
            title="Jour précédent"
            className="min-h-[42px] min-w-[42px] sm:min-h-0 sm:min-w-0 p-2 sm:p-2.5 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-700 hover:text-slate-900 rounded-xl border border-slate-200 hover:border-slate-300 transition-all shrink-0 active:scale-95 disabled:opacity-50 flex items-center justify-center cursor-pointer"
          >
            <ChevronLeft size={16} className="stroke-[2.5]" />
          </button>
        )}

        {/* Main Pill / Field Trigger */}
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={`
            w-full min-h-[42px] flex items-center justify-between gap-2 sm:gap-2.5 text-left transition-all outline-none select-none
            ${variant === 'field' 
              ? 'px-3 sm:px-3.5 py-2 sm:py-2.5 bg-slate-50 hover:bg-slate-100/90 focus:bg-white text-xs font-bold text-slate-900 rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300' 
              : 'px-3 sm:px-3.5 py-2 bg-white hover:bg-slate-50 text-xs font-bold text-slate-800 rounded-full border border-slate-200 shadow-xs hover:border-slate-300'
            }
            ${isOpen ? `ring-2 ${scheme.activeRing} bg-white border-transparent` : ''}
            ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-100' : 'cursor-pointer'}
          `}
        >
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
            <div className={`p-1.5 rounded-lg ${isToday ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200/80 text-slate-700'} shrink-0`}>
              <Calendar size={15} className="stroke-[2.2]" />
            </div>

            <div className="min-w-0 flex-1">
              {labelPrefix && (
                <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 leading-tight">
                  {labelPrefix}
                </div>
              )}
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap sm:flex-nowrap">
                {/* Desktop & Tablet Full Name */}
                <span className="hidden sm:inline truncate text-xs font-black text-slate-900 capitalize">
                  {formattedDisplay}
                </span>
                {/* Mobile Medium/Short Display */}
                <span className="inline sm:hidden truncate text-xs font-black text-slate-900 capitalize">
                  {mediumFormattedDisplay}
                </span>

                {showTodayBadge && isToday && (
                  <span className="shrink-0 px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-black bg-emerald-100 text-emerald-800 rounded-md border border-emerald-200/80">
                    Aujourd'hui
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0 text-slate-500">
            <ChevronDown 
              size={15} 
              className={`transition-transform duration-200 stroke-[2.5] ${isOpen ? 'rotate-180 text-blue-600' : ''}`} 
            />
          </div>
        </button>

        {/* Quick Shift Next Day Button */}
        {showQuickArrows && (
          <button
            type="button"
            onClick={(e) => handleShiftDay(1, e)}
            disabled={disabled}
            title="Jour suivant"
            className="min-h-[42px] min-w-[42px] sm:min-h-0 sm:min-w-0 p-2 sm:p-2.5 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-700 hover:text-slate-900 rounded-xl border border-slate-200 hover:border-slate-300 transition-all shrink-0 active:scale-95 disabled:opacity-50 flex items-center justify-center cursor-pointer"
          >
            <ChevronRight size={16} className="stroke-[2.5]" />
          </button>
        )}
      </div>

      {/* POPUP / DROPDOWN CONTAINER */}
      {isOpen && (
        <>
          {/* Mobile Overlay Backdrop */}
          <div 
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs z-[99] sm:hidden animate-in fade-in duration-150"
            onClick={() => {
              setIsOpen(false);
              setShowMonthYearPicker(false);
            }}
          />

          {/* Desktop & Tablet Floating Popover */}
          <div 
            ref={dropdownRef}
            className={`
              /* Mobile: Centered Bottom Sheet / Card Modal */
              fixed left-3 right-3 bottom-4 max-h-[85vh] overflow-y-auto sm:overflow-visible sm:max-h-none sm:left-auto sm:right-auto sm:bottom-auto
              /* Tablet / Desktop: Anchor Floating Popover */
              sm:absolute ${effectiveAlign === 'right' ? 'sm:right-0' : 'sm:left-0'} sm:top-full sm:mt-2
              w-auto sm:w-[340px] max-w-full sm:max-w-[calc(100vw-2rem)] bg-white rounded-3xl shadow-2xl border border-slate-200
              p-4 z-[100] animate-in fade-in zoom-in-95 duration-150 select-none
            `}
          >
            {renderDropdownContent()}
          </div>
        </>
      )}
    </div>
  );
};

