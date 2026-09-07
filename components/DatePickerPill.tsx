import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
  Calendar, ChevronLeft, ChevronRight, ChevronDown, 
  ChevronsLeft, ChevronsRight,
  RotateCcw, Sparkles, Check, Clock, X,
  Keyboard, History, AlertCircle
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
  minYear?: number;
  maxYear?: number;
  isBirthDate?: boolean;
  showShortcuts?: boolean;
  showQuickArrows?: boolean;
  showTodayBadge?: boolean;
  title?: string;
  placeholder?: string;
  clearable?: boolean;
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
  minYear,
  maxYear,
  isBirthDate = false,
  showShortcuts = true,
  showQuickArrows = false,
  showTodayBadge = true,
  title = 'Sélectionner une date',
  placeholder,
  clearable = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const manualInputRef = useRef<HTMLInputElement>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);
  const [isMobile, setIsMobile] = useState<boolean>(() => 
    typeof window !== 'undefined' ? window.innerWidth < 640 : false
  );

  // Detect mobile view dynamically
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Format today string YYYY-MM-DD
  const todayStr = useMemo(() => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().split('T')[0];
  }, []);

  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const minAvailableYear = minYear ?? 1930;
  const maxAvailableYear = maxYear ?? (isBirthDate ? currentYear : currentYear + 10);

  // Parse current selected date
  const parsedDate = useMemo(() => {
    try {
      if (!selectedDate) return null;
      const d = parseISO(selectedDate);
      return isValid(d) ? d : null;
    } catch {
      return null;
    }
  }, [selectedDate]);

  // View state for the calendar (Month / Year being browsed)
  const [viewYear, setViewYear] = useState<number>(() => {
    if (parsedDate) return parsedDate.getFullYear();
    if (isBirthDate) return 1995; // Default adult birth decade if empty
    return currentYear;
  });
  const [viewMonth, setViewMonth] = useState<number>(() => {
    if (parsedDate) return parsedDate.getMonth();
    return isBirthDate ? 0 : new Date().getMonth();
  });
  const [showMonthYearPicker, setShowMonthYearPicker] = useState(false);

  // Selected decade for fast decade switcher
  const [selectedDecade, setSelectedDecade] = useState<number>(() => 
    Math.floor(viewYear / 10) * 10
  );

  // Direct manual entry text state (DD/MM/YYYY)
  const [manualText, setManualText] = useState<string>(() => {
    if (!selectedDate) return '';
    const parts = selectedDate.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return '';
  });
  const [manualError, setManualError] = useState<string | null>(null);

  // Sync calendar view month & manual text when selectedDate changes
  useEffect(() => {
    if (selectedDate) {
      const d = parseISO(selectedDate);
      if (isValid(d)) {
        const y = d.getFullYear();
        setViewYear(y);
        setViewMonth(d.getMonth());
        setSelectedDecade(Math.floor(y / 10) * 10);
      }
      const parts = selectedDate.split('-');
      if (parts.length === 3) {
        setManualText(`${parts[2]}/${parts[1]}/${parts[0]}`);
        setManualError(null);
      }
    } else {
      setManualText('');
      setManualError(null);
      if (isBirthDate) {
        setViewYear(1995);
        setViewMonth(0);
        setSelectedDecade(1990);
      }
    }
  }, [selectedDate, isBirthDate]);

  // Synchronize decade when viewYear changes
  useEffect(() => {
    setSelectedDecade(Math.floor(viewYear / 10) * 10);
  }, [viewYear]);

  const scheme = COLOR_SCHEMES[colorScheme] || COLOR_SCHEMES.blue;
  const isToday = selectedDate === todayStr;

  // Calculate intelligent viewport-bounded coordinates for tablet & desktop
  const updatePosition = useCallback(() => {
    if (!containerRef.current || typeof window === 'undefined') return;
    const rect = containerRef.current.getBoundingClientRect();
    const popoverWidth = 360;
    const popoverHeight = 470;

    // Check vertical space (open upwards if close to bottom)
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUpwards = spaceBelow < popoverHeight && spaceAbove > spaceBelow;

    const top = openUpwards
      ? Math.max(10, rect.top - popoverHeight - 6)
      : Math.min(window.innerHeight - popoverHeight - 10, rect.bottom + 6);

    // Check horizontal alignment and clamp inside viewport
    let left = rect.left;
    if (dropdownAlign === 'right') {
      left = rect.right - popoverWidth;
    }

    if (left + popoverWidth > window.innerWidth - 12) {
      left = window.innerWidth - popoverWidth - 12;
    }
    if (left < 12) {
      left = 12;
    }

    setPopoverPos({ top, left });
  }, [dropdownAlign]);

  // Re-anchor on open, scroll, or resize
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

  // Close when clicked outside or pressed Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        containerRef.current && !containerRef.current.contains(target) &&
        popoverRef.current && !popoverRef.current.contains(target)
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
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
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
      setViewYear(y => Math.max(minAvailableYear, y - 1));
    } else {
      setViewMonth(m => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(y => Math.min(maxAvailableYear, y + 1));
    } else {
      setViewMonth(m => m + 1);
    }
  };

  // Build calendar matrix (Monday-first ISO format)
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
    const lastDayOfMonth = new Date(viewYear, viewMonth + 1, 0);

    // Get day of week: 0 is Sunday, 1 is Monday, ... 6 is Saturday
    let startDayOfWeek = firstDayOfMonth.getDay();
    // Convert to Monday = 0, ..., Sunday = 6
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

    // Next month filler days to complete grid (up to 35 or 42)
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

  // Formatted date representations
  const fullFormattedDisplay = useMemo(() => {
    try {
      if (!selectedDate) return placeholder || 'Sélectionner une date';
      const d = parseISO(selectedDate);
      if (!isValid(d)) return selectedDate;
      return format(d, 'EEEE d MMMM yyyy', { locale: fr });
    } catch {
      return selectedDate;
    }
  }, [selectedDate, placeholder]);

  const standardFormattedDisplay = useMemo(() => {
    try {
      if (!selectedDate) return placeholder || 'Sélectionner une date';
      const d = parseISO(selectedDate);
      if (!isValid(d)) return selectedDate;
      return format(d, 'EEE d MMM yyyy', { locale: fr });
    } catch {
      return selectedDate;
    }
  }, [selectedDate, placeholder]);

  const shortFormattedDisplay = useMemo(() => {
    try {
      if (!selectedDate) return placeholder || 'Date';
      const d = parseISO(selectedDate);
      if (!isValid(d)) return selectedDate;
      return format(d, 'd MMM yyyy', { locale: fr });
    } catch {
      return selectedDate;
    }
  }, [selectedDate, placeholder]);

  // Detected age if birthdate
  const detectedAge = useMemo(() => {
    if (!selectedDate || !isBirthDate) return null;
    try {
      const birth = parseISO(selectedDate);
      if (!isValid(birth)) return null;
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
        age--;
      }
      return age;
    } catch {
      return null;
    }
  }, [selectedDate, isBirthDate]);

  // Direct manual date input handler (auto-formats as DD/MM/YYYY)
  const handleManualInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    let formatted = digits;
    if (digits.length > 4) {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
    } else if (digits.length > 2) {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}`;
    }
    setManualText(formatted);

    if (digits.length === 8) {
      const day = parseInt(digits.slice(0, 2), 10);
      const month = parseInt(digits.slice(2, 4), 10);
      const year = parseInt(digits.slice(4, 8), 10);

      if (month < 1 || month > 12) {
        setManualError('Mois invalide (01 à 12)');
        return;
      }
      const daysInMonth = new Date(year, month, 0).getDate();
      if (day < 1 || day > daysInMonth) {
        setManualError(`Jour invalide pour ce mois (01 à ${daysInMonth})`);
        return;
      }
      if (year < minAvailableYear || year > maxAvailableYear) {
        setManualError(`Année hors limites (${minAvailableYear}-${maxAvailableYear})`);
        return;
      }

      const iso = `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      if (minDate && iso < minDate) {
        setManualError('Date antérieure au minimum');
        return;
      }
      if (maxDate && iso > maxDate) {
        setManualError('Date postérieure au maximum');
        return;
      }

      // Valid!
      setManualError(null);
      onSelectDate(iso);
      setViewYear(year);
      setViewMonth(month - 1);
    } else {
      setManualError(null);
    }
  };

  const handleManualKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedDate && !manualError) {
        setIsOpen(false);
      }
    }
  };

  // Quick preset actions for standard dates
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

  // Decade list from minAvailableYear to maxAvailableYear
  const availableDecades = useMemo(() => {
    const minDec = Math.floor(minAvailableYear / 10) * 10;
    const maxDec = Math.floor(maxAvailableYear / 10) * 10;
    const list: number[] = [];
    for (let d = maxDec; d >= minDec; d -= 10) {
      list.push(d);
    }
    return list;
  }, [minAvailableYear, maxAvailableYear]);

  // Years in the selected decade
  const yearsForDecade = useMemo(() => {
    const list: number[] = [];
    for (let y = selectedDecade; y <= selectedDecade + 9; y++) {
      if (y >= minAvailableYear && y <= maxAvailableYear) {
        list.push(y);
      }
    }
    return list;
  }, [selectedDecade, minAvailableYear, maxAvailableYear]);

  // Full descending list of years for the direct <select> dropdown
  const allYearsList = useMemo(() => {
    const list: number[] = [];
    for (let y = maxAvailableYear; y >= minAvailableYear; y--) {
      list.push(y);
    }
    return list;
  }, [minAvailableYear, maxAvailableYear]);

  // Unified popover content renderer for 100% DRY responsive desktop & mobile
  const renderCalendarPopoverContent = () => (
    <div className="space-y-2.5">
      {/* 1. Header Bar with Title & Close */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="p-1 rounded-lg bg-blue-50 text-blue-700">
            <Calendar size={13} className="stroke-[2.5]" />
          </div>
          <span className="text-xs font-black text-slate-800 uppercase tracking-wider truncate">
            {title || (isBirthDate ? 'Date de Naissance' : labelPrefix || 'Sélectionner une date')}
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            setIsOpen(false);
            setShowMonthYearPicker(false);
          }}
          className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
          title="Fermer"
        >
          <X size={15} />
        </button>
      </div>

      {/* 2. Direct Manual Typing Bar (Saisie directe avec formatage auto JJ/MM/AAAA) */}
      <div>
        <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition-all ${
          manualError 
            ? 'bg-rose-50/80 border-rose-300 ring-2 ring-rose-200'
            : selectedDate && !manualError
              ? 'bg-slate-50 border-slate-200 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100'
              : 'bg-slate-50 border-slate-200 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100'
        }`}>
          <Keyboard size={13} className="text-slate-400 shrink-0" />
          <input
            ref={manualInputRef}
            type="text"
            value={manualText}
            onChange={handleManualInputChange}
            onKeyDown={handleManualKeyDown}
            placeholder="Saisie : JJ/MM/AAAA (ex: 12/01/1988)"
            className="w-full bg-transparent text-xs font-mono font-bold text-slate-900 placeholder:text-slate-400 outline-none"
          />
          {manualText && (
            <button
              type="button"
              onClick={() => {
                setManualText('');
                setManualError(null);
                if (clearable) onSelectDate('');
              }}
              className="p-0.5 text-slate-400 hover:text-slate-600 rounded-full"
              title="Effacer"
            >
              <X size={12} />
            </button>
          )}
          {selectedDate && !manualError && (
            <span className="flex items-center gap-0.5 text-[9.5px] font-black text-emerald-700 shrink-0 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
              <Check size={11} className="stroke-[3]" /> OK
            </span>
          )}
        </div>
        {manualError && (
          <div className="text-[10px] font-bold text-rose-600 mt-1 px-1 flex items-center gap-1">
            <AlertCircle size={10} /> {manualError}
          </div>
        )}
      </div>

      {/* 3. Shortcuts Bar */}
      {showShortcuts && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar border-b border-slate-100">
          {isBirthDate ? (
            <>
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 shrink-0 flex items-center gap-0.5">
                <History size={10} /> Décennies :
              </span>
              {[1970, 1980, 1990, 2000].map(dec => (
                <button
                  key={dec}
                  type="button"
                  onClick={() => {
                    setSelectedDecade(dec);
                    setViewYear(dec);
                    setShowMonthYearPicker(true);
                  }}
                  className={`px-2 py-0.5 text-[10px] font-black rounded-lg transition-all whitespace-nowrap ${
                    selectedDecade === dec
                      ? scheme.shortcutActive
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                  }`}
                >
                  Années {dec.toString().slice(2)}
                </button>
              ))}
              {[25, 30, 35, 40, 50].map(age => {
                const y = currentYear - age;
                return (
                  <button
                    key={age}
                    type="button"
                    onClick={() => {
                      setViewYear(y);
                      setSelectedDecade(Math.floor(y / 10) * 10);
                      setShowMonthYearPicker(true);
                    }}
                    className="px-2 py-0.5 text-[10px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg whitespace-nowrap transition-all"
                    title={`Né(e) vers ${y}`}
                  >
                    ~{age} ans ({y})
                  </button>
                );
              })}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setQuickDate('today')}
                className={`px-2.5 py-1 text-[11px] font-black rounded-lg transition-all whitespace-nowrap ${
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
                className="px-2 py-1 text-[11px] font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all whitespace-nowrap border border-slate-200"
              >
                Hier
              </button>
              <button
                type="button"
                onClick={() => setQuickDate('monday')}
                className="px-2 py-1 text-[11px] font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all whitespace-nowrap border border-slate-200"
              >
                Lundi
              </button>
              <button
                type="button"
                onClick={() => setQuickDate('friday')}
                className="px-2 py-1 text-[11px] font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all whitespace-nowrap border border-slate-200"
              >
                Vendredi
              </button>
            </>
          )}
        </div>
      )}

      {/* 4. Month & Year Navigation Header with Year & Month jump buttons */}
      <div className="flex items-center justify-between px-0.5">
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => setViewYear(y => Math.max(minAvailableYear, y - 1))}
            className="p-1 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-lg transition-all"
            title="Année précédente (-1 an)"
          >
            <ChevronsLeft size={16} />
          </button>
          <button
            type="button"
            onClick={prevMonth}
            className="p-1 hover:bg-slate-100 text-slate-700 hover:text-slate-900 rounded-xl transition-all"
            title="Mois précédent"
          >
            <ChevronLeft size={16} className="stroke-[2.5]" />
          </button>
        </div>

        {/* Center Pill Button to Toggle Fast Month / Year / Decade View */}
        <button
          type="button"
          onClick={() => setShowMonthYearPicker(!showMonthYearPicker)}
          className="px-3 py-1 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200 rounded-xl text-xs font-black text-slate-900 flex items-center gap-1.5 transition-all shadow-2xs group"
          title="Changer de mois, d'année ou de décennie"
        >
          <span className="capitalize">{FRENCH_MONTHS[viewMonth]}</span>
          <span className="text-blue-700 font-extrabold">{viewYear}</span>
          <ChevronDown 
            size={13} 
            className={`text-slate-400 group-hover:text-slate-700 transition-transform ${showMonthYearPicker ? 'rotate-180 text-blue-600' : ''}`} 
          />
        </button>

        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={nextMonth}
            className="p-1 hover:bg-slate-100 text-slate-700 hover:text-slate-900 rounded-xl transition-all"
            title="Mois suivant"
          >
            <ChevronRight size={16} className="stroke-[2.5]" />
          </button>
          <button
            type="button"
            onClick={() => setViewYear(y => Math.min(maxAvailableYear, y + 1))}
            className="p-1 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-lg transition-all"
            title="Année suivante (+1 an)"
          >
            <ChevronsRight size={16} />
          </button>
        </div>
      </div>

      {/* 5. Fast Month / Year & Decade Grid View OR Standard Day Grid */}
      {showMonthYearPicker ? (
        <div className="py-1 space-y-2.5 animate-in fade-in zoom-in-95 duration-100">
          {/* Year Section with Direct Dropdown & Decades */}
          <div className="bg-slate-50/90 p-2.5 rounded-2xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 flex items-center gap-1">
                <Calendar size={11} className="text-blue-600" /> Année ({viewYear})
              </span>
              
              {/* Direct Year Dropdown with all years 1930 -> 2035 */}
              <div className="flex items-center gap-1">
                <label htmlFor="year-select-dropdown" className="text-[10px] font-bold text-slate-500">
                  Choisir l'année :
                </label>
                <select
                  id="year-select-dropdown"
                  value={viewYear}
                  onChange={(e) => {
                    const y = Number(e.target.value);
                    setViewYear(y);
                    setSelectedDecade(Math.floor(y / 10) * 10);
                  }}
                  className="text-xs font-bold text-slate-900 bg-white border border-slate-300 rounded-lg px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-2xs cursor-pointer"
                >
                  {allYearsList.map(y => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Decade Quick Selector */}
            <div>
              <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Décennies
              </div>
              <div className="flex items-center gap-1 overflow-x-auto pb-1 custom-scrollbar">
                {availableDecades.map(dec => (
                  <button
                    key={dec}
                    type="button"
                    onClick={() => setSelectedDecade(dec)}
                    className={`px-2 py-0.5 text-[10px] font-bold rounded-lg shrink-0 transition-all ${
                      selectedDecade === dec
                        ? `${scheme.selectedBg} font-black shadow-xs`
                        : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    {dec}s
                  </button>
                ))}
              </div>
            </div>

            {/* 10 Year Buttons in Selected Decade */}
            <div>
              <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
                <span>Années {selectedDecade} – {selectedDecade + 9}</span>
                <span className="text-[9px] font-normal text-slate-400">Cliquez pour choisir</span>
              </div>
              <div className="grid grid-cols-5 gap-1">
                {yearsForDecade.map(y => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => {
                      setViewYear(y);
                    }}
                    className={`py-1 rounded-lg text-xs font-bold text-center transition-all ${
                      viewYear === y
                        ? `${scheme.selectedBg} font-black shadow-xs scale-102`
                        : 'bg-white hover:bg-slate-100 text-slate-800 border border-slate-200'
                    }`}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Month Selector Grid */}
          <div className="bg-slate-50/90 p-2.5 rounded-2xl border border-slate-200">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-600 mb-1.5 flex items-center justify-between">
              <span>Mois</span>
              <span className="text-[10px] font-bold text-blue-700">{FRENCH_MONTHS[viewMonth]} {viewYear}</span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {FRENCH_MONTHS.map((mName, idx) => (
                <button
                  key={mName}
                  type="button"
                  onClick={() => {
                    setViewMonth(idx);
                    setShowMonthYearPicker(false);
                  }}
                  className={`py-1.5 px-1 rounded-xl text-xs font-bold text-center transition-all ${
                    viewMonth === idx 
                      ? `${scheme.selectedBg} font-black shadow-xs` 
                      : 'bg-white hover:bg-slate-100 text-slate-800 border border-slate-200'
                  }`}
                >
                  {mName.substring(0, 4)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end pt-0.5">
            <button
              type="button"
              onClick={() => setShowMonthYearPicker(false)}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 px-3 py-1 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-1"
            >
              <span>Afficher les jours</span>
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Day of week headers */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {WEEKDAY_NAMES.map((wd, idx) => (
              <div 
                key={wd} 
                className={`text-[10px] font-black uppercase tracking-wider py-1 ${
                  idx >= 5 ? 'text-rose-500/80' : 'text-slate-600'
                }`}
              >
                {wd}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1">
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
                    h-8.5 sm:h-9 w-full rounded-xl flex flex-col items-center justify-center relative text-xs transition-all
                    ${d.isSelected 
                      ? `${scheme.selectedBg} font-black shadow-md shadow-blue-500/20 scale-105 z-10` 
                      : d.isToday
                        ? 'bg-emerald-50 text-emerald-900 font-black border-2 border-emerald-500 hover:bg-emerald-100'
                        : d.isCurrentMonth
                          ? d.isWeekend
                            ? 'text-slate-700 hover:bg-slate-100 font-bold'
                            : 'text-slate-900 hover:bg-slate-100 font-bold'
                          : 'text-slate-300 hover:bg-slate-50 font-medium'
                    }
                    ${d.isDisabled ? 'opacity-25 cursor-not-allowed' : 'cursor-pointer active:scale-95'}
                  `}
                >
                  <span>{d.dayNumber}</span>
                  {d.isToday && !d.isSelected && (
                    <span className="w-1 h-1 bg-emerald-600 rounded-full absolute bottom-1" />
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* 6. Footer Bar with Date Summary & Confirm */}
      <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[11px] font-bold text-slate-700 truncate max-w-[190px]">
            {shortFormattedDisplay}
          </span>
          {detectedAge !== null && (
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold shrink-0 ${
              detectedAge >= 18 
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}>
              {detectedAge} ans
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {!isBirthDate && !isToday && (
            <button
              type="button"
              onClick={() => setQuickDate('today')}
              className="text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
            >
              <RotateCcw size={11} className="stroke-[2.5]" />
              <span>Aujourd'hui</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              setShowMonthYearPicker(false);
            }}
            className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div 
      ref={containerRef} 
      className={`relative inline-block w-full min-w-0 text-left font-sans ${className}`}
      title={title}
    >
      {/* TRIGGER BAR */}
      <div className="flex items-center gap-1 sm:gap-1.5 w-full min-w-0">
        {/* Quick Shift Previous Day Button */}
        {showQuickArrows && (
          <button
            type="button"
            onClick={(e) => handleShiftDay(-1, e)}
            disabled={disabled}
            title="Jour précédent"
            className="p-1.5 sm:p-2 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-700 hover:text-slate-900 rounded-lg sm:rounded-xl border border-slate-200 hover:border-slate-300 transition-all shrink-0 active:scale-95 disabled:opacity-50 flex items-center justify-center"
          >
            <ChevronLeft size={15} className="stroke-[2.5]" />
          </button>
        )}

        {/* Main Pill / Field Trigger */}
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={`
            w-full min-w-0 flex-1 flex items-center justify-between gap-1.5 sm:gap-2 text-left transition-all outline-none select-none overflow-hidden
            ${variant === 'field' 
              ? 'px-2.5 sm:px-3.5 py-1.5 sm:py-2 bg-slate-50 hover:bg-slate-100/90 focus:bg-white text-xs font-bold text-slate-900 rounded-lg sm:rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300' 
              : 'px-3 py-1.5 sm:py-2 bg-white hover:bg-slate-50 text-xs font-bold text-slate-800 rounded-full border border-slate-200 shadow-xs hover:border-slate-300'
            }
            ${isOpen ? `ring-2 ${scheme.activeRing} bg-white border-transparent` : ''}
            ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-100' : 'cursor-pointer'}
          `}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
            <div className={`p-1 sm:p-1.5 rounded-lg ${isToday && !isBirthDate ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200/80 text-slate-700'} shrink-0`}>
              <Calendar size={14} className="stroke-[2.2]" />
            </div>

            <div className="min-w-0 flex-1 overflow-hidden">
              {labelPrefix && (
                <div className="text-[9.5px] sm:text-[10px] font-black uppercase tracking-wider text-slate-500 leading-tight truncate">
                  {labelPrefix}
                </div>
              )}
              <div className="flex items-center gap-1.5 min-w-0">
                {/* Full date format on 2xl, standard on sm/md/lg, concise on mobile */}
                <span className="truncate text-xs font-bold sm:font-black text-slate-900 capitalize hidden 2xl:inline">
                  {fullFormattedDisplay}
                </span>
                <span className="truncate text-xs font-bold sm:font-black text-slate-900 capitalize hidden sm:inline 2xl:hidden">
                  {standardFormattedDisplay}
                </span>
                <span className="truncate text-xs font-bold sm:font-black text-slate-900 capitalize sm:hidden">
                  {shortFormattedDisplay}
                </span>
                {showTodayBadge && isToday && !isBirthDate && (
                  <span className="shrink-0 px-1.5 py-0.5 text-[9px] sm:text-[9.5px] font-black bg-emerald-100 text-emerald-800 rounded border border-emerald-200/80 hidden xl:inline-flex">
                    Aujourd'hui
                  </span>
                )}
                {isBirthDate && detectedAge !== null && (
                  <span className={`shrink-0 px-1.5 py-0.2 text-[9px] font-black rounded border hidden sm:inline-flex ${
                    detectedAge >= 18 
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    {detectedAge} ans
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center shrink-0 text-slate-500 pl-0.5 gap-1">
            {clearable && selectedDate && !disabled && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectDate('');
                  setManualText('');
                }}
                title="Effacer la date"
                className="p-0.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X size={12} className="stroke-[2.5]" />
              </span>
            )}
            <ChevronDown 
              size={14} 
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
            className="p-1.5 sm:p-2 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-700 hover:text-slate-900 rounded-lg sm:rounded-xl border border-slate-200 hover:border-slate-300 transition-all shrink-0 active:scale-95 disabled:opacity-50 flex items-center justify-center"
          >
            <ChevronRight size={15} className="stroke-[2.5]" />
          </button>
        )}
      </div>

      {/* FLOATING CALENDAR DROPDOWN (PORTALED DIRECTLY TO BODY FOR 100% UNBLOCKABLE RESPONSIVE BEHAVIOR) */}
      {isOpen && typeof document !== 'undefined' && createPortal(
        isMobile ? (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div 
              ref={popoverRef}
              className="w-full max-w-[360px] bg-white rounded-3xl shadow-2xl border border-slate-200 p-4 relative animate-in zoom-in-95 duration-150 select-none max-h-[92vh] overflow-y-auto"
            >
              {renderCalendarPopoverContent()}
            </div>
          </div>
        ) : (
          <div 
            ref={popoverRef}
            style={{
              position: 'fixed',
              top: popoverPos?.top ?? 60,
              left: popoverPos?.left ?? 20,
              zIndex: 99999,
              width: '360px',
              maxWidth: 'calc(100vw - 24px)'
            }}
            className="bg-white rounded-3xl shadow-2xl border border-slate-200 p-3.5 sm:p-4 animate-in fade-in zoom-in-95 duration-150 select-none max-h-[92vh] overflow-y-auto"
          >
            {renderCalendarPopoverContent()}
          </div>
        ),
        document.body
      )}
    </div>
  );
};
