// src/components/ui/DatePicker.jsx
import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Calendar } from 'react-date-range';
import { vi } from 'date-fns/locale';
import { format, startOfDay } from 'date-fns';
import { CalendarDays, ChevronDown } from 'lucide-react';

export default function DatePicker({ value, onChange, placeholder = 'Chọn ngày', align = 'left', minDate, maxDate }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(value ? new Date(value) : new Date());
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);

  useEffect(() => {
    if (value) setSelected(new Date(value));
  }, [value]);

  // Tính vị trí ngay dưới button
  const calcPos = useCallback(() => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + window.scrollY + 4, left: r.left + window.scrollX });
  }, []);

  const handleOpen = () => {
    calcPos();
    setOpen(p => !p);
  };

  // Đóng khi click ngoài
  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (btnRef.current && !btnRef.current.contains(e.target) &&
          !document.getElementById('__datepicker_portal__')?.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const handleApply = () => {
    onChange(startOfDay(selected).getTime());
    setOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange(null);
  };

  const hasValue = !!value;
  const label = hasValue ? format(new Date(value), 'dd/MM/yyyy') : placeholder;

  const dropdown = open ? createPortal(
    <div
      id="__datepicker_portal__"
      style={{
        position: 'absolute',
        // top: pos.top,
        bottom: 0,
        left: align === 'right' ? undefined : pos.left,
        right: align === 'right' ? 0 : undefined,
        zIndex: 99999,
        filter: 'drop-shadow(0 8px 32px rgba(0,0,0,0.15))',
      }}
      className="bg-surface rounded-2xl shadow-2xl border border-line overflow-hidden"
    >
      <Calendar
        date={selected}
        onChange={date => setSelected(date)}
        locale={vi}
        color="var(--c-gold)"
        weekStartsOn={1}
        minDate={minDate}
        maxDate={maxDate}
      />
      <div className="flex items-center justify-between px-4 py-3 border-t border-line-soft bg-canvas">
        <span className="text-xs text-gold">{format(selected, 'dd/MM/yyyy')}</span>
        <div className="flex gap-2">
          <button onClick={() => setOpen(false)}
            className="px-3 py-1.5 text-xs text-muted rounded-xl border border-line hover:bg-surface-2 transition-colors">
            Huỷ
          </button>
          <button onClick={handleApply}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-gold rounded-xl hover:bg-gold-strong transition-colors">
            Xác nhận
          </button>
        </div>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div ref={btnRef} style={{ display: 'inline-block' }}>
      <button
        type="button"
        onClick={handleOpen}
        className={`flex items-center gap-1.5 px-3 h-[38px] rounded-xl text-xs font-semibold
          transition-all border whitespace-nowrap
          ${hasValue
            ? 'bg-gold text-white border-gold shadow-sm'
            : 'bg-surface text-muted border-line hover:border-gold hover:text-gold'
          }`}
      >
        <CalendarDays size={12} />
        {label}
        {hasValue ? (
          <span onClick={handleClear}
            className="ml-0.5 w-3.5 h-3.5 rounded-full bg-white/30 text-white flex items-center
              justify-center hover:bg-white/50 transition-colors text-[10px] font-bold leading-none cursor-pointer">
            ×
          </span>
        ) : (
          <ChevronDown size={11} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        )}
      </button>
      {dropdown}
    </div>
  );
}