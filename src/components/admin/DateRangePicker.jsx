// src/components/admin/DateRangePicker.jsx
import { useState, useRef, useEffect } from 'react';
import { DateRange } from 'react-date-range';
import { vi } from 'date-fns/locale';
import {
  startOfDay, endOfDay,
  startOfWeek, endOfWeek,
  startOfMonth, endOfMonth,
  startOfYear, endOfYear,
  format,
} from 'date-fns';
import { CalendarDays, ChevronDown } from 'lucide-react';

// ── Preset helpers ────────────────────────────────────────────────────────────
export function presetToRange(key) {
  const now = new Date();
  switch (key) {
    case 'today':
      return { from: startOfDay(now).getTime(), to: endOfDay(now).getTime() };
    case 'week':
      return {
        from: startOfWeek(now, { weekStartsOn: 1 }).getTime(),
        to:   endOfWeek(now,   { weekStartsOn: 1 }).getTime(),
      };
    case 'month':
      return { from: startOfMonth(now).getTime(), to: endOfMonth(now).getTime() };
    case 'year':
      return { from: startOfYear(now).getTime(), to: endOfYear(now).getTime() };
    default:
      return { from: startOfDay(now).getTime(), to: endOfDay(now).getTime() };
  }
}

const PRESETS = [
  { key: 'today',  label: 'Hôm nay'   },
  { key: 'week',   label: 'Tuần này'  },
  { key: 'month',  label: 'Tháng này' },
  { key: 'year',   label: 'Năm này'   },
  { key: 'custom', label: 'Tuỳ chọn' },
];

// ── Component ─────────────────────────────────────────────────────────────────
export default function DateRangePicker({ preset, onPreset, onRangeChange }) {
  const [open,      setOpen]      = useState(false);
  const [selection, setSelection] = useState({
    startDate: new Date(),
    endDate:   new Date(),
    key:       'selection',
  });
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handlePreset = (key) => {
    onPreset(key);
    if (key !== 'custom') {
      setOpen(false);
      onRangeChange(presetToRange(key));
    } else {
      setOpen(prev => !prev); // toggle calendar
    }
  };

  const handleSelect = ({ selection: sel }) => {
    setSelection(sel);
  };

  const handleApply = () => {
    const from = startOfDay(selection.startDate).getTime();
    const to   = endOfDay(selection.endDate).getTime();
    onRangeChange({ from, to });
    setOpen(false);
  };

  const customLabel = preset === 'custom'
    ? `${format(selection.startDate, 'dd/MM/yy')} → ${format(selection.endDate, 'dd/MM/yy')}`
    : 'Tuỳ chọn';

  return (
    <div className="flex items-center gap-1.5 flex-wrap" ref={ref}>
      {/* Preset buttons */}
      {PRESETS.map(p => (
        <button
          key={p.key}
          onClick={() => handlePreset(p.key)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold
            transition-all border whitespace-nowrap
            ${preset === p.key
              ? 'bg-[#C9A84C] text-white border-[#C9A84C] shadow-sm'
              : 'bg-white text-[#8E8878] border-[#E8DDD0] hover:border-[#C9A84C] hover:text-[#C9A84C]'}`}
        >
          {p.key === 'custom' && <CalendarDays size={12} />}
          {p.key === 'custom' ? customLabel : p.label}
          {p.key === 'custom' && (
            <ChevronDown size={11} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
          )}
        </button>
      ))}

      {/* Calendar dropdown — 1 tháng, layout gọn */}
      {open && (
        <div
          className="absolute top-full left-0 mt-2 z-50 bg-white rounded-2xl shadow-2xl
            border border-[#E8DDD0] overflow-hidden"
          style={{ filter: 'drop-shadow(0 8px 32px rgba(0,0,0,0.12))' }}
        >
          <DateRange
            ranges={[selection]}
            onChange={handleSelect}
            locale={vi}
            months={1}
            direction="vertical"
            showMonthAndYearPickers
            showDateDisplay={false}
            rangeColors={['#C9A84C']}
            color="#C9A84C"
            weekStartsOn={1}
            // Ẩn preview line khi hover để gọn hơn
            moveRangeOnFirstSelection={false}
          />

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#F0EBE3] bg-[#FAF7F2]">
            <p className="text-xs text-[#8E8878]">
              {format(selection.startDate, 'dd/MM/yyyy')}
              {' '}<span className="text-[#C9A84C]">→</span>{' '}
              {format(selection.endDate, 'dd/MM/yyyy')}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setOpen(false)}
                className="px-3 py-1.5 text-xs text-[#8E8878] rounded-xl border border-[#E8DDD0]
                  hover:bg-[#F0EBE3] transition-colors">
                Huỷ
              </button>
              <button
                onClick={handleApply}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-[#C9A84C] rounded-xl
                  hover:bg-[#B8943C] transition-colors">
                Áp dụng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}