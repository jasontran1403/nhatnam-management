// src/components/ui/MonthRangePicker.jsx
//
// Chọn KHOẢNG THÁNG (từ tháng A đến tháng B) dạng calendar, hỗ trợ nhiều năm.
// Click lần 1 = chọn tháng bắt đầu, click lần 2 = chọn tháng kết thúc.
// Click thêm lần nữa = reset, bắt đầu chọn lại.
//
// Props:
//   value     — { from: "YYYY-MM", to: "YYYY-MM" }  hoặc null
//   onChange   — (range) => void   với range = { from: "YYYY-MM", to: "YYYY-MM" }
//   placeholder — text hiển thị khi chưa chọn
//   minYear   — năm nhỏ nhất cho phép (default: 2024)
//
import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

const ML = ['Th 1','Th 2','Th 3','Th 4','Th 5','Th 6','Th 7','Th 8','Th 9','Th 10','Th 11','Th 12'];

const toKey = (y, m) => `${y}-${String(m).padStart(2, '0')}`;
const parseKey = (k) => k ? k.split('-').map(Number) : null; // [year, month1-12]

export default function MonthRangePicker({
  value, onChange,
  placeholder = 'Chọn khoảng tháng',
  minYear = 2024,
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const panelRef = useRef(null);

  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth() + 1; // 1-indexed

  // from/to đã chọn
  const from = value?.from ? parseKey(value.from) : null; // [y,m]
  const to   = value?.to   ? parseKey(value.to)   : null;

  const [viewYear, setViewYear] = useState(to ? to[0] : curYear);
  // Picking state: null = chưa bắt đầu, [y,m] = đang chọn điểm thứ 2
  const [picking, setPicking] = useState(null);
  const [hover, setHover] = useState(null); // [y,m] đang hover (preview range)

  useEffect(() => {
    if (to) setViewYear(to[0]);
    else if (from) setViewYear(from[0]);
  }, [value]);

  const calcPos = useCallback(() => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const panelW = 300;
    let left = r.left + window.scrollX;
    // Nếu tràn phải viewport thì dịch sang trái
    if (left + panelW > window.innerWidth - 8) left = window.innerWidth - panelW - 8;
    if (left < 4) left = 4;
    setPos({ top: r.bottom + window.scrollY + 4, left });
  }, []);

  const handleOpen = () => { calcPos(); setOpen(p => !p); setPicking(null); setHover(null); };

  // Click ngoài đóng
  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (btnRef.current?.contains(e.target)) return;
      if (panelRef.current?.contains(e.target)) return;
      setOpen(false);
      setPicking(null);
      setHover(null);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  // So sánh [y,m]
  const cmp = (a, b) => {
    if (!a || !b) return 0;
    return a[0] !== b[0] ? a[0] - b[0] : a[1] - b[1];
  };
  const eq = (a, b) => a && b && a[0] === b[0] && a[1] === b[1];
  const between = (x, a, b) => {
    if (!a || !b || !x) return false;
    const lo = cmp(a, b) <= 0 ? a : b;
    const hi = cmp(a, b) <= 0 ? b : a;
    return cmp(x, lo) >= 0 && cmp(x, hi) <= 0;
  };

  const handlePick = (m1) => {
    const ym = [viewYear, m1];
    if (!picking) {
      // Lần click 1: đặt điểm bắt đầu
      setPicking(ym);
      setHover(null);
    } else {
      // Lần click 2: hoàn tất range
      let a = picking, b = ym;
      if (cmp(a, b) > 0) [a, b] = [b, a];
      onChange({ from: toKey(a[0], a[1]), to: toKey(b[0], b[1]) });
      setPicking(null);
      setHover(null);
      setOpen(false);
    }
  };

  const handleHover = (m1) => {
    if (picking) setHover([viewYear, m1]);
  };

  // Presets
  const setThisMonth = () => {
    const k = toKey(curYear, curMonth);
    onChange({ from: k, to: k });
    setViewYear(curYear);
    setPicking(null);
    setOpen(false);
  };
  const setThisQuarter = () => {
    const q = Math.floor((curMonth - 1) / 3);
    const startM = q * 3 + 1;
    onChange({ from: toKey(curYear, startM), to: toKey(curYear, curMonth) });
    setViewYear(curYear);
    setPicking(null);
    setOpen(false);
  };
  const setThisYear = () => {
    onChange({ from: toKey(curYear, 1), to: toKey(curYear, curMonth) });
    setViewYear(curYear);
    setPicking(null);
    setOpen(false);
  };
  const handleClear = (e) => {
    if (e) e.stopPropagation();
    onChange(null);
    setPicking(null);
    setHover(null);
  };

  // Label hiển thị trên button
  const label = (() => {
    if (!from) return placeholder;
    if (!to || (from[0] === to[0] && from[1] === to[1]))
      return `Tháng ${from[1]}/${from[0]}`;
    return `T${from[1]}/${from[0]} → T${to[1]}/${to[0]}`;
  })();
  const hasValue = !!from;

  // Render calendar cells
  const renderGrid = () => {
    // Determine range for highlighting
    let rangeStart = picking || (from ? from : null);
    let rangeEnd = hover || (picking ? picking : (to || from));

    return ML.map((lbl, idx) => {
      const m = idx + 1;
      const ym = [viewYear, m];

      const isFrom = eq(ym, from);
      const isTo = eq(ym, to);
      const isSelected = isFrom || isTo;
      const isPicking = eq(ym, picking);

      // In range?
      let inRange = false;
      if (picking && hover) {
        inRange = between(ym, picking, hover);
      } else if (from && to) {
        inRange = between(ym, from, to);
      }

      // Future month không cho chọn
      const isFuture = viewYear > curYear || (viewYear === curYear && m > curMonth);

      return (
        <button
          key={m}
          type="button"
          disabled={isFuture}
          onClick={() => handlePick(m)}
          onMouseEnter={() => handleHover(m)}
          className={`py-2.5 rounded-xl text-xs font-semibold transition-all relative
            ${isFuture
              ? 'text-faint cursor-not-allowed opacity-40'
              : isSelected || isPicking
                ? 'bg-gold text-white shadow-sm'
                : inRange
                  ? 'bg-gold/15 text-gold'
                  : 'bg-canvas text-ink hover:bg-surface-2'
            }`}
        >
          {lbl}
        </button>
      );
    });
  };

  const dropdown = open ? createPortal(
    <div
      ref={panelRef}
      style={{
        position: 'absolute',
        top: pos.top,
        left: pos.left,
        zIndex: 99999,
        filter: 'drop-shadow(0 8px 32px rgba(0,0,0,0.18))',
      }}
      className="bg-surface rounded-2xl shadow-2xl border border-line overflow-hidden w-[300px]"
      onMouseLeave={() => { if (picking) setHover(null); }}
    >
      {/* Hướng dẫn */}
      {picking && (
        <div className="px-4 py-2 bg-gold/10 text-xs text-gold font-medium text-center">
          Chọn tháng kết thúc
        </div>
      )}

      {/* Header: chuyển năm */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-line-soft">
        <button type="button" onClick={() => setViewYear(y => Math.max(minYear, y - 1))}
          disabled={viewYear <= minYear}
          className="p-1.5 rounded-lg text-muted hover:bg-canvas hover:text-ink transition-colors disabled:opacity-30">
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-bold text-ink">{viewYear}</span>
        <button type="button" onClick={() => setViewYear(y => y + 1)}
          disabled={viewYear >= curYear}
          className="p-1.5 rounded-lg text-muted hover:bg-canvas hover:text-ink transition-colors disabled:opacity-30">
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Grid 4×3 */}
      <div className="grid grid-cols-4 gap-1.5 p-3">
        {renderGrid()}
      </div>

      {/* Quick actions */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-line-soft bg-canvas">
        <button type="button" onClick={handleClear}
          className="text-xs text-muted hover:text-ink transition-colors font-medium">
          Xoá
        </button>
        <div className="flex gap-1.5">
          <button type="button" onClick={setThisMonth}
            className="px-2.5 py-1.5 text-[11px] text-muted rounded-lg border border-line hover:bg-surface transition-colors font-medium">
            Tháng này
          </button>
          <button type="button" onClick={setThisQuarter}
            className="px-2.5 py-1.5 text-[11px] text-muted rounded-lg border border-line hover:bg-surface transition-colors font-medium">
            Quý này
          </button>
          <button type="button" onClick={setThisYear}
            className="px-2.5 py-1.5 text-[11px] font-semibold text-white bg-gold rounded-lg hover:bg-gold-strong transition-colors">
            Năm nay
          </button>
        </div>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div ref={btnRef} className="inline-block w-full">
      <button
        type="button"
        onClick={handleOpen}
        className={`flex items-center gap-1.5 px-4 py-2.5 w-full rounded-xl text-sm font-medium
          transition-all border
          ${hasValue
            ? 'bg-surface text-ink border-hairline-2'
            : 'bg-surface text-muted border-hairline-2 hover:border-gold'
          }`}
      >
        <CalendarDays size={14} className="text-gold flex-shrink-0" />
        <span className="flex-1 text-left truncate">{label}</span>
        {hasValue ? (
          <span onClick={handleClear}
            className="w-4 h-4 rounded-full bg-surface-2 text-muted flex items-center
              justify-center hover:bg-surface-3 transition-colors text-[10px] font-bold leading-none cursor-pointer flex-shrink-0">
            ×
          </span>
        ) : (
          <ChevronDown size={13} className={`text-muted transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`} />
        )}
      </button>
      {dropdown}
    </div>
  );
}