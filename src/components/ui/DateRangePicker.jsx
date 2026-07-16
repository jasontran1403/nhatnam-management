// src/components/ui/DateRangePicker.jsx
import { useLang } from '../../context/LangContext';
import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { DateRange } from 'react-date-range';
import { vi } from 'date-fns/locale';
import {
  startOfDay, endOfDay,
  startOfWeek, endOfWeek,
  startOfMonth, endOfMonth,
  startOfYear, endOfYear,
  format,
} from 'date-fns';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

// ── Panel neo theo trigger, render qua portal ────────────────────────────────
// Đưa panel (lịch / chọn tháng) ra thẳng document.body bằng position:fixed nên
// KHÔNG bị `overflow-hidden` của modal cắt nữa. Toạ độ tính từ getBoundingClientRect
// của trigger, tự bám theo khi cuộn (kể cả cuộn trong modal) / đổi kích thước, và
// tự lật LÊN TRÊN khi khoảng trống bên dưới không đủ.
function AnchoredPortal({ anchorRef, open, align = 'left', panelRef, children }) {
  const [style, setStyle] = useState(null);

  const update = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const GAP = 8;
    const EST_H = 430; // ước lượng chiều cao panel (lịch khá cao)
    const spaceBelow = window.innerHeight - r.bottom;
    const openUp = spaceBelow < EST_H && r.top > spaceBelow;

    const next = { position: 'fixed', zIndex: 70 };
    if (align === 'right') next.right = Math.max(8, window.innerWidth - r.right);
    else next.left = Math.max(8, r.left);
    if (openUp) next.bottom = window.innerHeight - r.top + GAP;
    else next.top = r.bottom + GAP;

    setStyle(next);
  }, [anchorRef, align]);

  useLayoutEffect(() => {
    if (!open) return;
    update();
    const onScroll = () => update();
    const onResize = () => update();
    window.addEventListener('scroll', onScroll, true); // capture=true để bắt scroll của container trong modal
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open, update]);

  if (!open || !style) return null;
  return createPortal(
    <div ref={panelRef} style={style}>{children}</div>,
    document.body
  );
}

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

// ── Month helpers (nút "Tháng" — chọn 1 tháng quá khứ cố định) ────────────────
/** Range của 1 tháng cụ thể: [1/M .. cuối M]. month: 1-12. */
export function monthRange(year, month) {
  const d = new Date(year, month - 1, 1);
  return { from: startOfMonth(d).getTime(), to: endOfMonth(d).getTime() };
}

/** Range của THÁNG TRƯỚC (mặc định cho nút "Tháng" và cho dashboard khi load). */
export function previousMonthRange() {
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return {
    range: monthRange(prev.getFullYear(), prev.getMonth() + 1),
    year: prev.getFullYear(),
    month: prev.getMonth() + 1,
  };
}

function getPresets(t) {
  return [
    { key: 'today', label: t('common', 'today') },
    { key: 'week', label: t('common', 'this_week') },
    { key: 'month', label: t('common', 'this_month') },
    { key: 'year', label: t('common', 'this_year') },
    { key: 'fixedmonth', label: t('common', 'pick_month') || 'Tháng' },
    { key: 'custom', label: t('common', 'date_range') },
  ];
}

// ── Month/Year picker dropdown (nút "Tháng") ─────────────────────────────────
// Lưu ý: bỏ hết class định vị (absolute/top/left/right) — vị trí do AnchoredPortal lo.
function MonthYearDropdown({ value, onSelect, onCancel, t }) {
  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth() + 1; // 1-12
  const [displayYear, setDisplayYear] = useState(value?.year || curYear);

  // Chỉ cho chọn tháng QUÁ KHỨ (trước tháng hiện tại). Tháng hiện tại & tương lai bị khoá.
  // const isPast = (y, m) => (y < curYear) || (y === curYear && m < curMonth);
  const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <div
      className="bg-white rounded-2xl shadow-2xl border border-[#E8DDD0] overflow-hidden w-[300px]"
      style={{ filter: 'drop-shadow(0 8px 32px rgba(0,0,0,0.12))' }}
    >
      {/* Year navigator */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#F0EBE3]">
        <button
          onClick={() => setDisplayYear(y => y - 1)}
          className="w-8 h-8 rounded-lg border border-[#E8DDD0] flex items-center justify-center
            text-[#8E8878] hover:border-[#C9A84C] hover:text-[#C9A84C] transition-colors">
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-bold text-[#1C1C1E]">Năm {displayYear}</span>
        <button
          onClick={() => setDisplayYear(y => Math.min(curYear, y + 1))}
          disabled={displayYear >= curYear}
          className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors
            ${displayYear >= curYear
              ? 'border-[#F0EBE3] text-[#D8CFC2] cursor-not-allowed'
              : 'border-[#E8DDD0] text-[#8E8878] hover:border-[#C9A84C] hover:text-[#C9A84C]'}`}>
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Month grid */}
      <div className="grid grid-cols-3 gap-2 p-3">
        {MONTHS.map(m => {
          // const enabled = isPast(displayYear, m);
          const enabled = true;
          const selected = value?.year === displayYear && value?.month === m;
          return (
            <button
              key={m}
              disabled={!enabled}
              onClick={() => enabled && onSelect(displayYear, m)}
              className={`py-2 rounded-xl text-xs font-semibold transition-all border
                ${selected
                  ? 'bg-[#C9A84C] text-white border-[#C9A84C] shadow-sm'
                  : enabled
                    ? 'bg-white text-[#5C5C5C] border-[#E8DDD0] hover:border-[#C9A84C] hover:text-[#C9A84C]'
                    : 'bg-[#FAF7F2] text-[#D8CFC2] border-transparent cursor-not-allowed'}`}>
              Tháng {m}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-end px-4 py-2.5 border-t border-[#F0EBE3] bg-[#FAF7F2]">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-xs text-[#8E8878] rounded-xl border border-[#E8DDD0]
            hover:bg-[#F0EBE3] transition-colors">
          {t('common', 'cancel')}
        </button>
      </div>
    </div>
  );
}

// ── Calendar dropdown ─────────────────────────────────────────────────────────
// Lưu ý: bỏ hết class định vị (absolute/top/left/right) — vị trí do AnchoredPortal lo.
function CalendarDropdown({ selection, onSelect, onApply, onCancel, t }) {
  return (
    <div
      className="bg-white rounded-2xl shadow-2xl border border-[#E8DDD0] overflow-hidden"
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
  const [monthOpen, setMonthOpen] = useState(false);
  const [monthSel, setMonthSel] = useState(() => {
    const p = previousMonthRange();
    return { year: p.year, month: p.month };
  });
  const [selection, setSelection] = useState({
    startDate: new Date(),
    endDate: new Date(),
    key: 'selection',
  });
  const ref = useRef(null);       // wrapper (chứa các nút preset) — dùng làm anchor
  const panelRef = useRef(null);  // panel render ở portal (calendar/month)

  // Đóng khi click ra ngoài: panel nằm ở portal nên phải kiểm tra cả ref lẫn panelRef.
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && ref.current.contains(e.target)) return;
      if (panelRef.current && panelRef.current.contains(e.target)) return;
      setOpen(false);
      setMonthOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handlePreset = (key) => {
    if (key === 'custom') {
      onPreset(key);
      setMonthOpen(false);
      setOpen(prev => !prev);
    } else if (key === 'fixedmonth') {
      onPreset(key);
      setOpen(false);
      setMonthOpen(prev => !prev);
    } else {
      onPreset(key);
      setOpen(false);
      setMonthOpen(false);
      onRangeChange(presetToRange(key));
    }
  };

  const handleMonthSelect = (year, month) => {
    setMonthSel({ year, month });
    onPreset('fixedmonth');
    onRangeChange(monthRange(year, month));
    setMonthOpen(false);
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

  const monthLabel = preset === 'fixedmonth'
    ? `Tháng ${monthSel.month}/${monthSel.year}`
    : (t('common', 'pick_month') || 'Tháng');

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
          {(p.key === 'custom' || p.key === 'fixedmonth') && <CalendarDays size={12} />}
          {p.key === 'custom' ? customLabel : p.key === 'fixedmonth' ? monthLabel : p.label}
          {(p.key === 'custom' || p.key === 'fixedmonth') && (
            <ChevronDown size={11} className={`transition-transform
              ${(p.key === 'custom' && open) || (p.key === 'fixedmonth' && monthOpen) ? 'rotate-180' : ''}`} />
          )}
        </button>
      ))}

      <AnchoredPortal anchorRef={ref} open={open} align="left" panelRef={panelRef}>
        <CalendarDropdown
          selection={selection}
          onSelect={({ selection: sel }) => setSelection(sel)}
          onApply={handleApply}
          onCancel={() => setOpen(false)}
          t={t}
        />
      </AnchoredPortal>

      <AnchoredPortal anchorRef={ref} open={monthOpen} align="left" panelRef={panelRef}>
        <MonthYearDropdown
          value={monthSel}
          onSelect={handleMonthSelect}
          onCancel={() => setMonthOpen(false)}
          t={t}
        />
      </AnchoredPortal>
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
  const ref = useRef(null);       // wrapper (nút mở) — dùng làm anchor
  const panelRef = useRef(null);  // panel lịch render ở portal

  useEffect(() => {
    setSelection({
      startDate: from ? new Date(from) : new Date(),
      endDate: to ? new Date(to) : new Date(),
      key: 'selection',
    });
  }, [from, to]);

  // Đóng khi click ra ngoài: lịch nằm ở portal nên phải kiểm tra cả ref lẫn panelRef.
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && ref.current.contains(e.target)) return;
      if (panelRef.current && panelRef.current.contains(e.target)) return;
      setOpen(false);
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

      <AnchoredPortal anchorRef={ref} open={open} align={align} panelRef={panelRef}>
        <CalendarDropdown
          selection={selection}
          onSelect={({ selection: sel }) => setSelection(sel)}
          onApply={handleApply}
          onCancel={() => setOpen(false)}
          t={t}
        />
      </AnchoredPortal>
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