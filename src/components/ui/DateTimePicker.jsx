// src/components/ui/DateTimePicker.jsx
// Custom DateTime Picker — no native browser picker
// Props: value (Date|null), onChange(Date), minDate (Date, default: now)
import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';

const DAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const MONTHS = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6',
                'Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];

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
function CalendarGrid({ viewDate, selected, minDate, onSelect }) {
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
        {DAYS.map(d => (
          <div key={d} className="text-center text-[10px] font-bold text-[#8E8878] py-1">{d}</div>
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
                isPast ? 'text-[#D5C5A8] cursor-not-allowed' : 'cursor-pointer',
                isSelected ? 'bg-[#C9A84C] text-white font-bold shadow-sm hover:bg-[#b8963d]' : '',
                isToday && !isSelected ? 'border border-[#C9A84C] text-[#C9A84C]' : '',
                !isSelected && !isToday && !isPast ? 'text-[#1C1C1E] hover:bg-[#FDF8ED]' : '',
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
function TimePicker({ hour, minute, onChangeHour, onChangeMinute }) {
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
        <p className="text-[10px] font-bold text-[#8E8878] uppercase tracking-wider text-center mb-1.5">Giờ</p>
        <div ref={hourRef} className="flex-1 overflow-y-auto space-y-0.5"
          style={{ maxHeight: 190, scrollbarWidth: 'thin' }}>
          {hours.map(h => (
            <button key={h} onClick={() => onChangeHour(h)}
              className={`w-full py-1.5 rounded-lg text-xs font-medium transition-colors
                ${h === hour ? 'bg-[#C9A84C] text-white font-bold' : 'text-[#5C4E3D] hover:bg-[#F0EBE3]'}`}>
              {pad(h)}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center text-[#C4B9A8] font-bold text-lg select-none">:</div>
      {/* Minutes */}
      <div className="flex-1 flex flex-col">
        <p className="text-[10px] font-bold text-[#8E8878] uppercase tracking-wider text-center mb-1.5">Phút</p>
        <div ref={minRef} className="flex-1 overflow-y-auto space-y-0.5"
          style={{ maxHeight: 190, scrollbarWidth: 'thin' }}>
          {minutes.map(m => (
            <button key={m} onClick={() => onChangeMinute(m)}
              className={`w-full py-1.5 rounded-lg text-xs font-medium transition-colors
                ${m === minute ? 'bg-[#C9A84C] text-white font-bold' : 'text-[#5C4E3D] hover:bg-[#F0EBE3]'}`}>
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
  value,          // Date | null
  onChange,       // (Date) => void
  minDate,        // Date | null — default: now
  placeholder = 'Chọn ngày & giờ',
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('calendar'); // 'calendar' | 'time'
  const [viewDate, setViewDate] = useState(() => {
    const d = value || new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 300 });
  const min = minDate || new Date();

  // Close on outside click
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

  // Calculate dropdown position on open
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

  // Sync viewDate when value changes externally
  useEffect(() => {
    if (value) setViewDate(new Date(value.getFullYear(), value.getMonth(), 1));
  }, [value]);

  const selected = value;
  const h = selected ? selected.getHours() : Math.max(new Date().getHours() + 1, 0);
  const m = selected ? selected.getMinutes() : 0;

  const setTime = (hour, minute) => {
    const base = selected ? new Date(selected) : new Date();
    base.setHours(hour, minute, 0, 0);
    // Block past times on today
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
    // If past, move to next valid time
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

  return (
    <div ref={triggerRef} className="relative">
      {/* Trigger button */}
      <button type="button" onClick={handleOpen}
        className={`w-full flex items-center justify-between rounded-xl border-2 px-4 py-2.5 text-sm transition-all
          ${open ? 'border-[#C9A84C] shadow-sm' : 'border-[#E8DDD0]'} bg-[#FAFAF8]`}>
        <span className={displayValue ? 'text-[#1C1C1E] font-semibold' : 'text-[#C4B9A8]'}>
          {displayValue || placeholder}
        </span>
        <ChevronDown size={15} className={`text-[#8E8878] transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown panel — fixed to escape overflow:hidden */}
      {open && (
        <div
          ref={dropdownRef}
          className="fixed bg-white rounded-2xl shadow-2xl border border-[#F0EBE3] z-[9999] overflow-hidden"
          style={{ top: dropPos.top, left: dropPos.left, width: dropPos.width }}>


          {/* Tab bar */}
          <div className="flex border-b border-[#F0EBE3] bg-[#FAFAF8]">
            {[
              { id: 'calendar', label: selected ? `${pad(selected.getDate())} ${MONTHS[selected.getMonth()]}` : '📅 Chọn ngày' },
              { id: 'time',     label: selected ? `${pad(h)}:${pad(m)}` : '🕐 Chọn giờ' },
            ].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex-1 py-2.5 text-xs font-bold transition-colors
                  ${tab === t.id ? 'text-[#C9A84C] border-b-2 border-[#C9A84C] bg-white' : 'text-[#8E8878] hover:text-[#5C4E3D]'}`}>
                {t.label}
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
                }} className="w-7 h-7 rounded-lg hover:bg-[#F0EBE3] flex items-center justify-center text-[#5C4E3D] transition-colors">
                  <ChevronLeft size={15} />
                </button>
                <span className="text-sm font-bold text-[#1C1C1E]">
                  {MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}
                </span>
                <button onClick={() => {
                  const d = new Date(viewDate);
                  d.setMonth(d.getMonth() + 1);
                  setViewDate(d);
                }} className="w-7 h-7 rounded-lg hover:bg-[#F0EBE3] flex items-center justify-center text-[#5C4E3D] transition-colors">
                  <ChevronRight size={15} />
                </button>
              </div>
              <CalendarGrid viewDate={viewDate} selected={selected} minDate={min} onSelect={handleSelectDay} />
            </div>
          )}

          {/* Time */}
          {tab === 'time' && (
            <div className="px-3 pt-2 pb-1" style={{ height: 240 }}>
              <TimePicker
                hour={h} minute={m}
                onChangeHour={(newH) => setTime(newH, m)}
                onChangeMinute={(newM) => setTime(h, newM)}
              />
            </div>
          )}

          {/* Quick actions + Confirm */}
          <div className="px-3 pb-3 pt-2 border-t border-[#F0EBE3] flex gap-1.5">
            <button onClick={() => quickSet(0)}
              className="flex-1 py-2 rounded-xl border border-[#E8DDD0] text-[#5C4E3D] text-[11px] font-semibold hover:bg-[#F0EBE3] transition-colors">
              ⚡ Ngay
            </button>
            <button onClick={() => quickSet(1)}
              className="flex-1 py-2 rounded-xl border border-[#E8DDD0] text-[#5C4E3D] text-[11px] font-semibold hover:bg-[#F0EBE3] transition-colors">
              +1 giờ
            </button>
            <button onClick={() => quickSet(2)}
              className="flex-1 py-2 rounded-xl border border-[#E8DDD0] text-[#5C4E3D] text-[11px] font-semibold hover:bg-[#F0EBE3] transition-colors">
              +2 giờ
            </button>
            <button onClick={() => setOpen(false)}
              className="flex-1 py-2 rounded-xl bg-[#C9A84C] text-white text-[11px] font-bold hover:bg-[#b8963d] transition-colors">
              Xong ✓
            </button>
          </div>
        </div>
      )}
    </div>
  );
}