// src/components/ui/DateRangePicker.jsx
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

// ── Calendar dropdown dùng chung ──────────────────────────────────────────────
function CalendarDropdown({ selection, onSelect, onApply, onCancel }) {
  return (
    <div
      className="absolute top-full left-0 mt-2 z-50 bg-white rounded-2xl shadow-2xl
        border border-[#E8DDD0] overflow-hidden"
      style={{ filter: 'drop-shadow(0 8px 32px rgba(0,0,0,0.12))' }}
    >
      <DateRange
        ranges={[selection]}
        onChange={onSelect}
        locale={vi}
        months={1}
        direction="vertical"
        showMonthAndYearPickers
        showDateDisplay={false}
        rangeColors={['#C9A84C']}
        color="#C9A84C"
        weekStartsOn={1}
        moveRangeOnFirstSelection={false}
      />
      <div className="flex items-center justify-between px-4 py-3 border-t border-[#F0EBE3] bg-[#FAF7F2]">
        <p className="text-xs text-[#8E8878]">
          {format(selection.startDate, 'dd/MM/yyyy')}
          {' '}<span className="text-[#C9A84C]">→</span>{' '}
          {format(selection.endDate, 'dd/MM/yyyy')}
        </p>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs text-[#8E8878] rounded-xl border border-[#E8DDD0]
              hover:bg-[#F0EBE3] transition-colors">
            Huỷ
          </button>
          <button
            onClick={onApply}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-[#C9A84C] rounded-xl
              hover:bg-[#B8943C] transition-colors">
            Áp dụng
          </button>
        </div>
      </div>
    </div>
  );
}

// ── FULL PRESET MODE (Dashboard, SaleKpi, OwnerProduction…) ──────────────────
// Props: preset, onPreset, onRangeChange
function FullPresetPicker({ preset, onPreset, onRangeChange }) {
  const [open, setOpen] = useState(false);
  const [selection, setSelection] = useState({
    startDate: new Date(),
    endDate:   new Date(),
    key:       'selection',
  });
  const ref = useRef(null);

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
      setOpen(prev => !prev);
    }
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

      {open && (
        <CalendarDropdown
          selection={selection}
          onSelect={({ selection: sel }) => setSelection(sel)}
          onApply={handleApply}
          onCancel={() => setOpen(false)}
        />
      )}
    </div>
  );
}

// ── SIMPLE MODE (Orders, Expense/Income Voucher…) ─────────────────────────────
// Props: from (timestamp|null), to (timestamp|null), onChange({from,to}), placeholder
function SimplePicker({ from, to, onChange, placeholder }) {
  const [open, setOpen] = useState(false);
  const [selection, setSelection] = useState(() => {
    const start = from ? new Date(from) : new Date();
    const end   = to   ? new Date(to)   : new Date();
    return { startDate: start, endDate: end, key: 'selection' };
  });
  const ref = useRef(null);

  // Sync nếu from/to thay đổi từ bên ngoài
  useEffect(() => {
    setSelection({
      startDate: from ? new Date(from) : new Date(),
      endDate:   to   ? new Date(to)   : new Date(),
      key: 'selection',
    });
  }, [from, to]);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const hasRange = from && to;

  const label = hasRange
    ? `${format(new Date(from), 'dd/MM/yy')} → ${format(new Date(to), 'dd/MM/yy')}`
    : (placeholder || 'Khoảng ngày');

  const handleApply = () => {
    const f = startOfDay(selection.startDate).getTime();
    const t = endOfDay(selection.endDate).getTime();
    onChange({ from: f, to: t });
    setOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange({ from: null, to: null });
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(prev => !prev)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold
          transition-all border whitespace-nowrap
          ${hasRange
            ? 'bg-[#C9A84C] text-white border-[#C9A84C] shadow-sm'
            : 'bg-white text-[#8E8878] border-[#E8DDD0] hover:border-[#C9A84C] hover:text-[#C9A84C]'}`}
      >
        <CalendarDays size={12} />
        {label}
        {hasRange
          ? (
            <span
              onClick={handleClear}
              className="ml-0.5 w-3.5 h-3.5 rounded-full bg-white/30 text-white flex items-center justify-center
                hover:bg-white/50 transition-colors text-[10px] font-bold leading-none cursor-pointer"
            >
              ×
            </span>
          )
          : <ChevronDown size={11} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        }
      </button>

      {open && (
        <CalendarDropdown
          selection={selection}
          onSelect={({ selection: sel }) => setSelection(sel)}
          onApply={handleApply}
          onCancel={() => setOpen(false)}
        />
      )}
    </div>
  );
}

// ── Main export: auto-detect mode ─────────────────────────────────────────────
export default function DateRangePicker(props) {
  // Simple mode: truyền from/to/onChange
  if ('onChange' in props || 'from' in props || 'to' in props) {
    return (
      <SimplePicker
        from={props.from}
        to={props.to}
        onChange={props.onChange}
        placeholder={props.placeholder}
      />
    );
  }
  // Full preset mode: truyền preset/onPreset/onRangeChange
  return (
    <FullPresetPicker
      preset={props.preset}
      onPreset={props.onPreset}
      onRangeChange={props.onRangeChange}
    />
  );
}
