// src/components/common/DateRangePicker.jsx
// Calendar range picker — hiển thị 2 tháng, chọn from-to
import { useState, useRef, useEffect } from 'react';
import { Calendar, X, ChevronLeft, ChevronRight } from 'lucide-react';

const MONTHS_VI = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6',
                   'Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];
const DAYS_VI = ['CN','T2','T3','T4','T5','T6','T7'];

function isSameDay(a, b) {
  if (!a || !b) return false;
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth() === b.getMonth() &&
         a.getDate() === b.getDate();
}
function startOfDay(d) {
  if (!d) return null;
  const r = new Date(d); r.setHours(0,0,0,0); return r;
}

function MonthGrid({ year, month, from, to, hover, onDay, onHover }) {
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];

  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  return (
    <div className="w-full">
      <div className="grid grid-cols-7 mb-1">
        {DAYS_VI.map(d => (
          <div key={d} className="text-center text-[10px] font-semibold text-[#8E8878] py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((date, i) => {
          if (!date) return <div key={`e-${i}`} />;
          const s = startOfDay(from);
          const e = startOfDay(to || hover);
          const sd = startOfDay(date);
          const isFrom   = isSameDay(date, from);
          const isTo     = isSameDay(date, to);
          const isHover  = !to && isSameDay(date, hover);
          const inRange  = s && e && sd > s && sd < e;
          const isStart  = isFrom;
          const isEnd    = isTo || isHover;
          const today    = isSameDay(date, new Date());

          return (
            <button key={i}
              onClick={() => onDay(date)}
              onMouseEnter={() => onHover(date)}
              className={`
                relative text-xs py-1 rounded-lg transition-colors select-none
                ${isStart || isEnd ? 'bg-[#C9A84C] text-white font-bold' : ''}
                ${inRange ? 'bg-[#C9A84C]/15 text-[#5C4E3D]' : ''}
                ${!isStart && !isEnd && !inRange ? 'hover:bg-[#F0EBE3] text-[#1C1C1E]' : ''}
                ${today && !isStart && !isEnd ? 'font-bold' : ''}
              `}
            >
              {date.getDate()}
              {today && <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#C9A84C]" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function DateRangePicker({ from, to, onChange, placeholder = 'Chọn khoảng ngày' }) {
  const [open, setOpen] = useState(false);
  const [openLeft, setOpenLeft] = useState(false); // mở sang trái nếu gần mép phải
  const [leftYear, setLeftYear]   = useState(() => (from ? new Date(from) : new Date()).getFullYear());
  const [leftMonth, setLeftMonth] = useState(() => (from ? new Date(from) : new Date()).getMonth());
  const [picking, setPicking]     = useState(null); // first click date
  const [hover, setHover]         = useState(null);
  const ref = useRef();

  // Right month = left + 1
  const rightMonth = (leftMonth + 1) % 12;
  const rightYear  = leftMonth === 11 ? leftYear + 1 : leftYear;

  useEffect(() => {
    function handle(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const prevMonth = () => {
    if (leftMonth === 0) { setLeftMonth(11); setLeftYear(y => y - 1); }
    else setLeftMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (leftMonth === 11) { setLeftMonth(0); setLeftYear(y => y + 1); }
    else setLeftMonth(m => m + 1);
  };

  const handleDay = (date) => {
    if (!picking) {
      setPicking(date);
      onChange({ from: date, to: null });
    } else {
      const s = picking < date ? picking : date;
      const e = picking < date ? date : picking;
      onChange({ from: s, to: e });
      setPicking(null);
      setOpen(false);
    }
  };

  const clear = (ev) => {
    ev.stopPropagation();
    onChange({ from: null, to: null });
    setPicking(null);
  };

  const fmt = (d) => d ? d.toLocaleDateString('vi-VN', { day:'2-digit', month:'2-digit', year:'numeric' }) : '';

  const label = from
    ? to ? `${fmt(from)} → ${fmt(to)}` : `${fmt(from)} → ...`
    : placeholder;

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => {
          if (!open && ref.current) {
            const rect = ref.current.getBoundingClientRect();
            // Nếu không đủ chỗ bên phải (< 560px) thì mở sang trái
            setOpenLeft(window.innerWidth - rect.left < 560);
          }
          setOpen(o => !o);
        }}
        className="flex items-center gap-2 border border-[#E8DDD0] rounded-xl px-3 py-2 text-xs bg-white hover:border-[#C9A84C] transition-colors w-full sm:min-w-[220px] sm:w-auto justify-between">
        <div className="flex items-center gap-1.5">
          <Calendar size={13} className="text-[#8E8878] shrink-0" />
          <span className={from ? 'text-[#1C1C1E]' : 'text-[#8E8878]'}>{label}</span>
        </div>
        {from && (
          <span onClick={clear} className="ml-1 text-[#8E8878] hover:text-red-500">
            <X size={11} />
          </span>
        )}
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1 bg-white border border-[#E8DDD0] rounded-2xl shadow-xl p-4"
          style={{
            minWidth: 'min(540px, calc(100vw - 2rem))',
            right: openLeft ? 0 : 'auto',
            left: openLeft ? 'auto' : 0,
          }}>
          {/* Header nav */}
          <div className="flex items-center justify-between mb-3">
            <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-[#F0EBE3] text-[#5C4E3D]">
              <ChevronLeft size={14} />
            </button>
            <div className="flex gap-4 sm:gap-8 text-sm font-semibold text-[#1C1C1E]">
              <span>{MONTHS_VI[leftMonth]} {leftYear}</span>
              <span className="hidden sm:inline">{MONTHS_VI[rightMonth]} {rightYear}</span>
            </div>
            <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-[#F0EBE3] text-[#5C4E3D]">
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Two month grids — single on mobile */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <MonthGrid year={leftYear}  month={leftMonth}  from={from} to={to} hover={hover}
              onDay={handleDay} onHover={setHover} />
            <div className="hidden sm:block">
              <MonthGrid year={rightYear} month={rightMonth} from={from} to={to} hover={hover}
                onDay={handleDay} onHover={setHover} />
            </div>
          </div>

          {/* Quick presets */}
          <div className="flex gap-2 mt-3 pt-3 border-t border-[#F0EBE3] flex-wrap">
            {[
              { label: 'Hôm nay', fn: () => { const t = new Date(); onChange({ from: t, to: t }); setOpen(false); } },
              { label: '7 ngày', fn: () => { const t = new Date(), s = new Date(t); s.setDate(t.getDate()-6); onChange({ from: s, to: t }); setOpen(false); } },
              { label: '30 ngày', fn: () => { const t = new Date(), s = new Date(t); s.setDate(t.getDate()-29); onChange({ from: s, to: t }); setOpen(false); } },
              { label: 'Tháng này', fn: () => { const t = new Date(), s = new Date(t.getFullYear(), t.getMonth(), 1); onChange({ from: s, to: t }); setOpen(false); } },
            ].map(p => (
              <button key={p.label} onClick={p.fn}
                className="px-3 py-1 text-xs rounded-lg bg-[#F0EBE3] text-[#5C4E3D] hover:bg-[#C9A84C]/20 hover:text-[#C9A84C] font-medium transition-colors">
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
