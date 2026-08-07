// src/components/ui/DateTimePicker.jsx
// Custom DateTime Picker — no native browser picker
// Props: value (Date|null), onChange(Date), minDate (Date, default: now)
import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { useLang } from '../../context/LangContext';

// Vietnamese day abbreviations kept as-is (locale-specific short labels)
const DAYS_VI = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const DAYS_EN = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth() === b.getMonth() &&
         a.getDate() === b.getDate();
}
function isBeforeDay(a, b) {
  const aa = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const bb = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return aa < bb;
}
function pad(n) { return String(n).padStart(2, '0'); }

// ─── Calendar Grid ────────────────────────────────────────────────────────────
function CalendarGrid({ viewDate, selected, minDate, onSelect, days }) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  return (
    <div>
      <div className="grid grid-cols-7 mb-1">
        {days.map(d => (
          <div key={d} className="text-center text-[10px] font-bold text-muted py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((date, idx) => {
          if (!date) return <div key={idx} />;
          const isToday = isSameDay(date, today);
          const isSelected = selected && isSameDay(date, selected);
          const isPast = minDate && isBeforeDay(date, minDate);
          return (
            <button key={idx} onClick={() => !isPast && onSelect(date)} disabled={isPast}
              className={[
                'h-8 w-8 mx-auto rounded-lg text-xs font-medium transition-all',
                isPast ? 'text-faint cursor-not-allowed' : 'cursor-pointer',
                isSelected ? 'bg-gold text-white font-bold shadow-sm hover:bg-gold-strong' : '',
                isToday && !isSelected ? 'border border-gold text-gold' : '',
                !isSelected && !isToday && !isPast ? 'text-ink hover:bg-gold-tint' : '',
              ].join(' ')}>
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Time Scroll Picker ────────────────────────────────────────────────────────
function TimePicker({ hour, minute, onChangeHour, onChangeMinute, labelHour, labelMinute }) {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: 60 }, (_, i) => i);
  const hourRef = useRef(null);
  const minRef = useRef(null);

  useEffect(() => {
    setTimeout(() => {
      const el = hourRef.current?.children[hour];
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 50);
  }, [hour]);

  useEffect(() => {
    setTimeout(() => {
      const el = minRef.current?.children[minute];
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 50);
  }, [minute]);

  return (
    <div className="flex gap-2 h-full">
      {/* Hours */}
      <div className="flex-1 flex flex-col">
        <p className="text-[10px] font-bold text-muted uppercase tracking-wider text-center mb-1.5">{labelHour}</p>
        <div ref={hourRef} className="flex-1 overflow-y-auto space-y-0.5"
          style={{ maxHeight: 190, scrollbarWidth: 'thin' }}>
          {hours.map(h => (
            <button key={h} onClick={() => onChangeHour(h)}
              className={`w-full py-1.5 rounded-lg text-xs font-medium transition-colors
                ${h === hour ? 'bg-gold text-white font-bold' : 'text-ink-2 hover:bg-surface-2'}`}>
              {pad(h)}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center text-faint font-bold text-lg select-none">:</div>
      {/* Minutes */}
      <div className="flex-1 flex flex-col">
        <p className="text-[10px] font-bold text-muted uppercase tracking-wider text-center mb-1.5">{labelMinute}</p>
        <div ref={minRef} className="flex-1 overflow-y-auto space-y-0.5"
          style={{ maxHeight: 190, scrollbarWidth: 'thin' }}>
          {minutes.map(m => (
            <button key={m} onClick={() => onChangeMinute(m)}
              className={`w-full py-1.5 rounded-lg text-xs font-medium transition-colors
                ${m === minute ? 'bg-gold text-white font-bold' : 'text-ink-2 hover:bg-surface-2'}`}>
              {pad(m)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export default function DateTimePicker({
  value,
  onChange,
  minDate,
  placeholder,
}) {
  const { t, lang } = useLang();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('calendar');
  const [viewDate, setViewDate] = useState(() => {
    const d = value || new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 300 });
  const min = minDate || new Date();

  const defaultPlaceholder = placeholder || t('common', 'choose_date');
  const days = lang === 'vi' ? DAYS_VI : DAYS_EN;

  // Month labels from lang file
  const MONTH_KEYS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  const monthLabel = (idx) => t('months', MONTH_KEYS[idx]);

  useEffect(() => {
    const handle = (e) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const handleOpen = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const dropHeight = 380;
      const top = spaceBelow >= dropHeight
        ? rect.bottom + 6
        : rect.top - dropHeight - 6;
      setDropPos({ top, left: rect.left, width: Math.max(rect.width, 300) });
    }
    setOpen(v => !v);
    setTab('calendar');
  };

  useEffect(() => {
    if (value) setViewDate(new Date(value.getFullYear(), value.getMonth(), 1));
  }, [value]);

  const selected = value;
  const h = selected ? selected.getHours() : Math.max(new Date().getHours() + 1, 0);
  const m = selected ? selected.getMinutes() : 0;

  const setTime = (hour, minute) => {
    const base = selected ? new Date(selected) : new Date();
    base.setHours(hour, minute, 0, 0);
    if (base <= min) {
      const safe = new Date(min);
      safe.setMinutes(safe.getMinutes() + 1, 0, 0);
      onChange(safe);
      return;
    }
    onChange(base);
  };

  const handleSelectDay = (date) => {
    const next = new Date(date);
    next.setHours(h, m, 0, 0);
    if (next <= min) {
      const safe = new Date(min);
      safe.setDate(date.getDate());
      safe.setMonth(date.getMonth());
      safe.setFullYear(date.getFullYear());
      safe.setMinutes(safe.getMinutes() + 1, 0, 0);
      onChange(safe);
    } else {
      onChange(next);
    }
    setTab('time');
  };

  const quickSet = (offsetHours) => {
    const d = new Date();
    d.setHours(d.getHours() + offsetHours, 0, 0, 0);
    onChange(d);
    setViewDate(new Date(d.getFullYear(), d.getMonth(), 1));
    setOpen(false);
  };

  const displayValue = selected
    ? `${pad(selected.getDate())}/${pad(selected.getMonth()+1)}/${selected.getFullYear()}  ${pad(selected.getHours())}:${pad(selected.getMinutes())}`
    : '';

  const tabCalendarLabel = selected
    ? `${pad(selected.getDate())} ${monthLabel(selected.getMonth())}`
    : t('common', 'choose_date_icon');
  const tabTimeLabel = selected
    ? `${pad(h)}:${pad(m)}`
    : t('common', 'choose_time_icon');

  return (
    <div ref={triggerRef} className="relative">
      <button type="button" onClick={handleOpen}
        className={`w-full flex items-center justify-between rounded-xl border-2 px-4 py-2.5 text-sm transition-all
          ${open ? 'border-gold shadow-sm' : 'border-line'} bg-surface`}>
        <span className={displayValue ? 'text-ink font-semibold' : 'text-faint'}>
          {displayValue || defaultPlaceholder}
        </span>
        <ChevronDown size={15} className={`text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          ref={dropdownRef}
          className="fixed bg-surface rounded-2xl shadow-2xl border border-line-soft z-[9999] overflow-hidden"
          // style={{ top: dropPos.top, left: dropPos.left, width: dropPos.width }}>
          style={{ bottom: 0, left: dropPos.left, width: dropPos.width }}>

          {/* Tab bar */}
          <div className="flex border-b border-line-soft bg-surface">
            {[
              { id: 'calendar', label: tabCalendarLabel },
              { id: 'time',     label: tabTimeLabel },
            ].map(tb => (
              <button key={tb.id} onClick={() => setTab(tb.id)}
                className={`flex-1 py-2.5 text-xs font-bold transition-colors
                  ${tab === tb.id ? 'text-gold border-b-2 border-gold bg-surface' : 'text-muted hover:text-ink-2'}`}>
                {tb.label}
              </button>
            ))}
          </div>

          {/* Calendar */}
          {tab === 'calendar' && (
            <div className="p-3">
              <div className="flex items-center justify-between mb-3">
                <button onClick={() => {
                  const d = new Date(viewDate);
                  d.setMonth(d.getMonth() - 1);
                  setViewDate(d);
                }} className="w-7 h-7 rounded-lg hover:bg-surface-2 flex items-center justify-center text-ink-2 transition-colors">
                  <ChevronLeft size={15} />
                </button>
                <span className="text-sm font-bold text-ink">
                  {monthLabel(viewDate.getMonth())} {viewDate.getFullYear()}
                </span>
                <button onClick={() => {
                  const d = new Date(viewDate);
                  d.setMonth(d.getMonth() + 1);
                  setViewDate(d);
                }} className="w-7 h-7 rounded-lg hover:bg-surface-2 flex items-center justify-center text-ink-2 transition-colors">
                  <ChevronRight size={15} />
                </button>
              </div>
              <CalendarGrid viewDate={viewDate} selected={selected} minDate={min} onSelect={handleSelectDay} days={days} />
            </div>
          )}

          {/* Time */}
          {tab === 'time' && (
            <div className="px-3 pt-2 pb-1" style={{ height: 240 }}>
              <TimePicker
                hour={h} minute={m}
                onChangeHour={(newH) => setTime(newH, m)}
                onChangeMinute={(newM) => setTime(h, newM)}
                labelHour={t('common', 'hour')}
                labelMinute={t('common', 'minute')}
              />
            </div>
          )}

          {/* Quick actions + Confirm */}
          <div className="px-3 pb-3 pt-2 border-t border-line-soft flex gap-1.5">
            <button onClick={() => quickSet(0)}
              className="flex-1 py-2 rounded-xl border border-line text-ink-2 text-[11px] font-semibold hover:bg-surface-2 transition-colors">
              {t('common', 'now_icon')}
            </button>
            <button onClick={() => quickSet(1)}
              className="flex-1 py-2 rounded-xl border border-line text-ink-2 text-[11px] font-semibold hover:bg-surface-2 transition-colors">
              +1h
            </button>
            <button onClick={() => quickSet(2)}
              className="flex-1 py-2 rounded-xl border border-line text-ink-2 text-[11px] font-semibold hover:bg-surface-2 transition-colors">
              +2h
            </button>
            <button onClick={() => setOpen(false)}
              className="flex-1 py-2 rounded-xl bg-gold text-white text-[11px] font-bold hover:bg-gold-strong transition-colors">
              {t('common', 'done')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
