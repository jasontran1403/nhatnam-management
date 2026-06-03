// src/components/ui/DateRangePicker.jsx
import { useLang } from '../../context/LangContext';
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
        to: endOfWeek(now, { weekStartsOn: 1 }).getTime(),
      };
    case 'month':
      return { from: startOfMonth(now).getTime(), to: endOfMonth(now).getTime() };
    case 'year':
      return { from: startOfYear(now).getTime(), to: endOfYear(now).getTime() };
    default:
      return { from: startOfDay(now).getTime(), to: endOfDay(now).getTime() };
  }
}

function getPresets(t) {
  return [
    { key: 'today', label: t('common', 'today') },
    { key: 'week', label: t('common', 'this_week') },
    { key: 'month', label: t('common', 'this_month') },
    { key: 'year', label: t('common', 'this_year') },
    { key: 'custom', label: t('common', 'date_range') },
  ];
}

// ── Calendar dropdown ─────────────────────────────────────────────────────────
function CalendarDropdown({ selection, onSelect, onApply, onCancel, t, align = 'left' }) {
  return (
    <div
      className={`absolute top-full mt-2 z-50 bg-white rounded-2xl shadow-2xl
        border border-[#E8DDD0] overflow-hidden
        ${align === 'right' ? 'right-0' : 'left-0'}`}
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
            {t('common', 'cancel')}
          </button>
          <button
            onClick={onApply}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-[#C9A84C] rounded-xl
              hover:bg-[#B8943C] transition-colors">
            {t('common', 'confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── FULL PRESET MODE ──────────────────────────────────────────────────────────
function FullPresetPicker({ preset, onPreset, onRangeChange }) {
  const { t } = useLang();
  const PRESETS = getPresets(t);

  const [open, setOpen] = useState(false);
  const [selection, setSelection] = useState({
    startDate: new Date(),
    endDate: new Date(),
    key: 'selection',
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
    const to = endOfDay(selection.endDate).getTime();
    onRangeChange({ from, to });
    setOpen(false);
  };

  const customLabel = preset === 'custom'
    ? `${format(selection.startDate, 'dd/MM/yy')} → ${format(selection.endDate, 'dd/MM/yy')}`
    : t('common', 'optional');

  return (
    <div className="flex items-center gap-1.5 flex-wrap relative" ref={ref}>
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
          t={t}
        />
      )}
    </div>
  );
}

// ── SIMPLE MODE ───────────────────────────────────────────────────────────────
function SimplePicker({ from, to, onChange, placeholder, align = 'left' }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [selection, setSelection] = useState(() => ({
    startDate: from ? new Date(from) : new Date(),
    endDate: to ? new Date(to) : new Date(),
    key: 'selection',
  }));
  const ref = useRef(null);

  useEffect(() => {
    setSelection({
      startDate: from ? new Date(from) : new Date(),
      endDate: to ? new Date(to) : new Date(),
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
    : (placeholder || t('common', 'date_range'));

  const handleApply = () => {
    const f = startOfDay(selection.startDate).getTime();
    const to2 = endOfDay(selection.endDate).getTime();
    onChange({ from: f, to: to2 });
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
        className={`flex items-center gap-1.5 px-3 h-[38px] rounded-xl text-xs font-semibold
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
          t={t}
          align={align}
        />
      )}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function DateRangePicker(props) {
  if ('onChange' in props || 'from' in props || 'to' in props) {
    return (
      <SimplePicker
        from={props.from}
        to={props.to}
        onChange={props.onChange}
        placeholder={props.placeholder}
        align={props.align || 'left'}
      />
    );
  }
  return (
    <FullPresetPicker
      preset={props.preset}
      onPreset={props.onPreset}
      onRangeChange={props.onRangeChange}
    />
  );
}