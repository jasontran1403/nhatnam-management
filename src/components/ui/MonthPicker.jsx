// src/components/ui/MonthPicker.jsx
// Dropdown chọn "Tháng/Năm" theo đúng phong cách thiết kế của DatePicker.jsx —
// dùng cho các trường hợp chỉ cần chọn kỳ theo tháng (VD: Kỳ chi phí), thay
// cho <input type="month"> mặc định của trình duyệt (giao diện xấu, không
// đồng bộ với design system của app).
import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

const MONTH_LABELS = ['Th 1', 'Th 2', 'Th 3', 'Th 4', 'Th 5', 'Th 6', 'Th 7', 'Th 8', 'Th 9', 'Th 10', 'Th 11', 'Th 12'];

// value/onChange dùng định dạng string "YYYY-MM" (khớp với backend expensePeriod)
export default function MonthPicker({ value, onChange, placeholder = 'Chọn tháng', align = 'left' }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);

  const parsed = value ? value.split('-').map(Number) : null; // [year, month(1-12)]
  const [viewYear, setViewYear] = useState(parsed ? parsed[0] : new Date().getFullYear());

  useEffect(() => {
    if (parsed) setViewYear(parsed[0]);
  }, [value]);

  const calcPos = useCallback(() => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + window.scrollY + 4, left: r.left + window.scrollX });
  }, []);

  const handleOpen = () => { calcPos(); setOpen(p => !p); };

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (btnRef.current && !btnRef.current.contains(e.target) &&
          !document.getElementById('__monthpicker_portal__')?.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const pick = (month1to12) => {
    const mm = String(month1to12).padStart(2, '0');
    onChange(`${viewYear}-${mm}`);
    setOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('');
  };

  const setThisMonth = () => {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    setViewYear(now.getFullYear());
    onChange(`${now.getFullYear()}-${mm}`);
    setOpen(false);
  };

  const setLastMonth = () => {
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const mm = String(prev.getMonth() + 1).padStart(2, '0');
    setViewYear(prev.getFullYear());
    onChange(`${prev.getFullYear()}-${mm}`);
    setOpen(false);
  };

  const hasValue = !!value;
  const label = hasValue ? `Tháng ${parsed[1]}/${parsed[0]}` : placeholder;

  const dropdown = open ? createPortal(
    <div
      id="__monthpicker_portal__"
      style={{
        position: 'absolute',
        top: pos.top,
        left: align === 'right' ? undefined : pos.left,
        right: align === 'right' ? 0 : undefined,
        zIndex: 99999,
        filter: 'drop-shadow(0 8px 32px rgba(0,0,0,0.15))',
      }}
      className="bg-white rounded-2xl shadow-2xl border border-[#E8DDD0] overflow-hidden w-[280px]"
    >
      {/* Header: chuyển năm */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#F0EBE3]">
        <button type="button" onClick={() => setViewYear(y => y - 1)}
          className="p-1.5 rounded-lg text-[#8E8878] hover:bg-[#FAF7F2] hover:text-[#1C1C1E] transition-colors">
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-bold text-[#1C1C1E]">{viewYear}</span>
        <button type="button" onClick={() => setViewYear(y => y + 1)}
          className="p-1.5 rounded-lg text-[#8E8878] hover:bg-[#FAF7F2] hover:text-[#1C1C1E] transition-colors">
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Grid 4x3 chọn tháng */}
      <div className="grid grid-cols-4 gap-1.5 p-3">
        {MONTH_LABELS.map((label, idx) => {
          const m = idx + 1;
          const isSelected = parsed && parsed[0] === viewYear && parsed[1] === m;
          return (
            <button key={m} type="button" onClick={() => pick(m)}
              className={`py-2 rounded-xl text-xs font-semibold transition-colors
                ${isSelected
                  ? 'bg-[#C9A84C] text-white shadow-sm'
                  : 'bg-[#FAF7F2] text-[#1C1C1E] hover:bg-[#F0EBE3]'}`}>
              {label}
            </button>
          );
        })}
      </div>

      {/* Quick actions */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-[#F0EBE3] bg-[#FAF7F2]">
        <button type="button" onClick={handleClear}
          className="text-xs text-[#8E8878] hover:text-[#1C1C1E] transition-colors font-medium">
          Xoá
        </button>
        <div className="flex gap-2">
          <button type="button" onClick={setLastMonth}
            className="px-3 py-1.5 text-xs text-[#8E8878] rounded-xl border border-[#E8DDD0] hover:bg-white transition-colors font-medium">
            Tháng trước
          </button>
          <button type="button" onClick={setThisMonth}
            className="px-3 py-1.5 text-xs font-semibold text-white bg-[#C9A84C] rounded-xl hover:bg-[#B8943C] transition-colors">
            Tháng này
          </button>
        </div>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div ref={btnRef} style={{ display: 'inline-block', width: '100%' }}>
      <button
        type="button"
        onClick={handleOpen}
        className={`flex items-center gap-1.5 px-4 py-2.5 w-full rounded-xl text-sm font-medium
          transition-all border
          ${hasValue
            ? 'bg-white text-[#1C1C1E] border-black/10'
            : 'bg-white text-[#8E8878] border-black/10 hover:border-[#C9A84C]'
          }`}
      >
        <CalendarDays size={14} className="text-[#C9A84C] flex-shrink-0" />
        <span className="flex-1 text-left">{label}</span>
        {hasValue ? (
          <span onClick={handleClear}
            className="w-4 h-4 rounded-full bg-[#F0EBE3] text-[#8E8878] flex items-center
              justify-center hover:bg-[#E8DDD0] transition-colors text-[10px] font-bold leading-none cursor-pointer flex-shrink-0">
            ×
          </span>
        ) : (
          <ChevronDown size={13} className={`text-[#8E8878] transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`} />
        )}
      </button>
      {dropdown}
    </div>
  );
}
