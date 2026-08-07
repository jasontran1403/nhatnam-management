// src/components/ui/TimePicker.jsx
// ĐỒNG HỒ CHỌN GIỜ — thay cho <input type="time"> mặc định của trình duyệt.
//
// Vì sao tự dựng: input type="time" render khác nhau ở từng trình duyệt và trên
// iOS bị hệ điều hành chiếm quyền thành bánh xe cuộn, không cách nào cho khớp
// với phần còn lại của giao diện. Component này dùng đúng bảng màu / bo góc /
// portal như DatePicker và DateRangePicker nên đứng cạnh nhau trong một form
// vẫn đồng bộ.
//
// Cách dùng:
//   <TimePicker value="13:30" onChange={setV} minuteStep={5} />
//   value / onChange đều là chuỗi "HH:mm" (hoặc null khi chưa chọn) — trùng đúng
//   định dạng LocalTime mà backend nhận, khỏi phải đổi qua lại.
import { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Clock, ChevronDown } from 'lucide-react';

// ── Chuyển đổi chuỗi "HH:mm" ⇄ số phút ───────────────────────────────────────
const toMinutes = (hhmm) => {
  if (!hhmm || typeof hhmm !== 'string') return null;
  const m = hhmm.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = Number(m[1]), mi = Number(m[2]);
  if (h > 23 || mi > 59) return null;
  return h * 60 + mi;
};

const toHHmm = (mins) => {
  if (mins == null) return null;
  const h = Math.floor(mins / 60), m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

// ══════════════════════════════════════════════════════════════════════════════
// MẶT ĐỒNG HỒ
// ══════════════════════════════════════════════════════════════════════════════

const DIAL = 128;          // bán kính vùng vẽ
const R_OUTER = 100;       // vành ngoài — giờ 0–11 / phút
const R_INNER = 64;        // vành trong — giờ 12–23

/**
 * Toạ độ của một mốc trên mặt số.
 * Góc 0 nằm ở vị trí 12 giờ rồi quay theo chiều kim đồng hồ, nên phải trừ 90°
 * so với hệ toạ độ toán học thông thường.
 */
function pointAt(index, total, radius) {
  const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
  return {
    x: DIAL + radius * Math.cos(angle),
    y: DIAL + radius * Math.sin(angle),
  };
}

function ClockFace({ mode, hour, minute, onPickHour, onPickMinute, minuteStep }) {
  // Kim đồng hồ chỉ vào giá trị đang được chỉnh, KHÔNG phải cả giờ lẫn phút.
  // Chỉ một kim giúp người dùng biết ngay mình đang ở bước nào.
  const handAngle = mode === 'hour'
    ? ((hour % 12) / 12) * 360
    : (minute / 60) * 360;

  const handLength = mode === 'hour' && hour >= 12 ? R_INNER : R_OUTER;

  const hours = useMemo(() => Array.from({ length: 12 }, (_, i) => i), []);
  const minutes = useMemo(() => {
    const step = Math.max(1, minuteStep);
    const out = [];
    for (let m = 0; m < 60; m += step) out.push(m);
    return out;
  }, [minuteStep]);

  return (
    <svg width={DIAL * 2} height={DIAL * 2} className="select-none touch-none">
      <circle cx={DIAL} cy={DIAL} r={DIAL - 4} className="fill-canvas" />

      {/* Kim + đầu kim */}
      <line
        x1={DIAL} y1={DIAL}
        x2={DIAL + handLength * Math.cos((handAngle - 90) * Math.PI / 180)}
        y2={DIAL + handLength * Math.sin((handAngle - 90) * Math.PI / 180)}
        stroke="var(--c-gold)" strokeWidth="2" strokeLinecap="round"
      />
      <circle cx={DIAL} cy={DIAL} r="4" fill="var(--c-gold)" />

      {mode === 'hour' ? (
        <>
          {/* Vành ngoài 0–11, vành trong 12–23 — kiểu 24h không cần nút AM/PM */}
          {hours.map((h) => {
            const p = pointAt(h, 12, R_OUTER);
            const active = hour === h;
            return (
              <g key={`h-${h}`} onClick={() => onPickHour(h)} className="cursor-pointer">
                <circle cx={p.x} cy={p.y} r="17" className={active ? 'fill-gold' : 'fill-transparent hover:fill-gold/15'} />
                <text x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central"
                  className={`text-[13px] font-semibold ${active ? 'fill-white' : 'fill-ink'}`}>
                  {h === 0 ? '00' : h}
                </text>
              </g>
            );
          })}
          {hours.map((h) => {
            const val = h + 12;
            const p = pointAt(h, 12, R_INNER);
            const active = hour === val;
            return (
              <g key={`h-${val}`} onClick={() => onPickHour(val)} className="cursor-pointer">
                <circle cx={p.x} cy={p.y} r="15" className={active ? 'fill-gold' : 'fill-transparent hover:fill-gold/15'} />
                <text x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central"
                  className={`text-[11px] font-medium ${active ? 'fill-white' : 'fill-muted'}`}>
                  {val}
                </text>
              </g>
            );
          })}
        </>
      ) : (
        minutes.map((m) => {
          const p = pointAt(m, 60, R_OUTER);
          const active = minute === m;
          return (
            <g key={`m-${m}`} onClick={() => onPickMinute(m)} className="cursor-pointer">
              <circle cx={p.x} cy={p.y} r="17" className={active ? 'fill-gold' : 'fill-transparent hover:fill-gold/15'} />
              <text x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central"
                className={`text-[13px] font-semibold ${active ? 'fill-white' : 'fill-ink'}`}>
                {String(m).padStart(2, '0')}
              </text>
            </g>
          );
        })
      )}
    </svg>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PANEL — neo theo nút, render qua portal để không bị modal cắt
// ══════════════════════════════════════════════════════════════════════════════

function AnchoredPanel({ anchorRef, open, panelRef, align = 'left', children }) {
  const [style, setStyle] = useState(null);

  const update = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const GAP = 8, EST_H = 400;
    const below = window.innerHeight - r.bottom;
    const up = below < EST_H && r.top > below;

    const next = { position: 'fixed', zIndex: 80 };
    if (align === 'right') next.right = Math.max(8, window.innerWidth - r.right);
    else next.left = Math.max(8, r.left);
    if (up) next.bottom = window.innerHeight - r.top + GAP;
    else next.top = r.bottom + GAP;
    setStyle(next);
  }, [anchorRef, align]);

  useLayoutEffect(() => {
    if (!open) return;
    update();
    const h = () => update();
    window.addEventListener('scroll', h, true);
    window.addEventListener('resize', h);
    return () => {
      window.removeEventListener('scroll', h, true);
      window.removeEventListener('resize', h);
    };
  }, [open, update]);

  if (!open || !style) return null;
  return createPortal(<div ref={panelRef} style={style}>{children}</div>, document.body);
}

// ══════════════════════════════════════════════════════════════════════════════
// EXPORT
// ══════════════════════════════════════════════════════════════════════════════

/**
 * @param {string|null} value        "HH:mm"
 * @param {(v:string|null)=>void} onChange
 * @param {number}  minuteStep       bước nhảy phút trên mặt số (mặc định 5)
 * @param {string}  placeholder
 * @param {string}  align            'left' | 'right'
 * @param {boolean} clearable        cho phép xoá giá trị
 * @param {string}  defaultTime      giờ gợi ý khi mở lần đầu mà chưa có value
 */
export default function TimePicker({
  value,
  onChange,
  minuteStep = 5,
  placeholder = 'Chọn giờ',
  align = 'left',
  clearable = true,
  defaultTime = '08:00',
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('hour');   // 'hour' → 'minute'
  const [draft, setDraft] = useState(() => toMinutes(value) ?? toMinutes(defaultTime) ?? 480);

  const btnRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    const v = toMinutes(value);
    if (v != null) setDraft(v);
  }, [value]);

  // Mỗi lần mở lại đều bắt đầu từ bước chọn GIỜ. Giữ nguyên bước cũ sẽ khiến
  // người dùng mở ra thấy mặt số phút mà không hiểu vì sao.
  const handleOpen = () => {
    if (disabled) return;
    setMode('hour');
    setDraft(toMinutes(value) ?? toMinutes(defaultTime) ?? 480);
    setOpen(o => !o);
  };

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (btnRef.current?.contains(e.target)) return;
      if (panelRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const hour = Math.floor(draft / 60);
  const minute = draft % 60;

  const pickHour = (h) => {
    setDraft(h * 60 + minute);
    setMode('minute');          // tự sang bước phút, bớt một cú bấm
  };
  const pickMinute = (m) => setDraft(hour * 60 + m);

  const apply = () => { onChange(toHHmm(draft)); setOpen(false); };
  const clear = (e) => { e.stopPropagation(); onChange(null); };

  const hasValue = !!toMinutes(value);
  const label = hasValue ? value : placeholder;

  return (
    <div ref={btnRef} className="inline-block">
      <button
        type="button"
        onClick={handleOpen}
        disabled={disabled}
        className={`flex items-center gap-1.5 px-3 h-[38px] rounded-xl text-xs font-semibold
          transition-all border whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed
          ${hasValue
            ? 'bg-gold text-white border-gold shadow-sm'
            : 'bg-surface text-muted border-line hover:border-gold hover:text-gold'}`}
      >
        <Clock size={12} />
        {label}
        {hasValue && clearable ? (
          <span onClick={clear}
            className="ml-0.5 w-3.5 h-3.5 rounded-full bg-white/30 text-white flex items-center
              justify-center hover:bg-white/50 transition-colors text-[10px] font-bold leading-none cursor-pointer">
            ×
          </span>
        ) : (
          <ChevronDown size={11} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        )}
      </button>

      <AnchoredPanel anchorRef={btnRef} open={open} panelRef={panelRef} align={align}>
        <div className="bg-surface rounded-2xl shadow-2xl border border-line overflow-hidden"
          style={{ filter: 'drop-shadow(0 8px 32px rgba(0,0,0,0.12))' }}>

          {/* Ô số lớn — bấm để nhảy qua lại giữa bước giờ và bước phút */}
          <div className="flex items-center justify-center gap-1 px-5 pt-4 pb-3">
            <button type="button" onClick={() => setMode('hour')}
              className={`px-3 py-1.5 rounded-xl text-2xl font-bold tabular-nums transition-colors
                ${mode === 'hour' ? 'bg-gold/15 text-gold' : 'text-ink hover:bg-canvas'}`}>
              {String(hour).padStart(2, '0')}
            </button>
            <span className="text-2xl font-bold text-faint">:</span>
            <button type="button" onClick={() => setMode('minute')}
              className={`px-3 py-1.5 rounded-xl text-2xl font-bold tabular-nums transition-colors
                ${mode === 'minute' ? 'bg-gold/15 text-gold' : 'text-ink hover:bg-canvas'}`}>
              {String(minute).padStart(2, '0')}
            </button>
          </div>

          <p className="text-center text-[11px] text-muted pb-2">
            {mode === 'hour' ? 'Chọn giờ — vành trong là 12–23' : 'Chọn phút'}
          </p>

          <div className="px-3 pb-2 flex justify-center">
            <ClockFace
              mode={mode} hour={hour} minute={minute}
              onPickHour={pickHour} onPickMinute={pickMinute}
              minuteStep={minuteStep}
            />
          </div>

          <div className="flex items-center justify-between px-4 py-3 border-t border-line-soft bg-canvas">
            <span className="text-xs text-gold font-semibold tabular-nums">{toHHmm(draft)}</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => setOpen(false)}
                className="px-3 py-1.5 text-xs text-muted rounded-xl border border-line
                  hover:bg-surface-2 transition-colors">
                Huỷ
              </button>
              <button type="button" onClick={apply}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-gold rounded-xl
                  hover:bg-gold-strong transition-colors">
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      </AnchoredPanel>
    </div>
  );
}

export { toMinutes, toHHmm };