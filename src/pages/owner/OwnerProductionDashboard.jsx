// src/pages/owner/OwnerProductionDashboard.jsx
import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Factory, Plus, Clock, CheckCircle2, AlertTriangle,
  Wrench, Settings2, ChevronRight, CalendarRange,
  ClipboardList, X, Loader2, Package, Search, ChevronDown, FileWarning, RotateCcw, Check, Wallet,
} from 'lucide-react';
import { startOfDay } from 'date-fns';
import useMinLoading from '../../hooks/useMinLoading';
import Modal from '../../components/ui/Modal';
import DateRangePicker from '../../components/ui/DateRangePicker';
import {
  PageHeader, PrimaryButton, SecondaryButton, DangerButton,
  Field, inputCls, EmptyState, SectionCard, SectionHeader,
} from '../../components/ui';
import { StatCardSkeleton } from '../../components/ui/Skeleton';
import {
  ownerProdApi, getStatusLabels, progressColor, productionResetApi,
} from '../../api/productionModuleApi';
import { useLang } from '../../context/LangContext';
import { useFmt } from '../../utils/useFmt';
import { factoryProductApi } from '../../api/productionApi';
import FactoryManagementModal from '../../components/production/FactoryManagement';
import { Building2 } from 'lucide-react';

const BRAND = '#C9A84C';

export function StatusBadge({ status }) {
  const { t } = useLang();
  const cfg = getStatusLabels(t)[status] || { label: status, cls: 'bg-gray-100 text-gray-600' };
  return <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.cls}`}>{cfg.label}</span>;
}

export function KpiCard({ icon: Icon, label, value, sub, color = 'text-[#C9A84C]', iconBg = 'bg-[#C9A84C]/10' }) {
  const { t } = useLang();
  const { loc, fmtDate, fmtNum, fmtCurrency, fmtDateTime, monthShort } = useFmt();
  return (
    <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-[#8E8878] font-medium">{label}</p>
          <p className={`text-3xl font-bold mt-1.5 ${color}`}>{value}</p>
          {sub && <p className="text-xs text-[#8E8878] mt-1">{sub}</p>}
        </div>
        <div className={`w-11 h-11 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0`}>
          <Icon size={20} className={color} />
        </div>
      </div>
    </div>
  );
}

// ── Search Dropdown — dùng chung ──────────────────────────────────────────────
function SearchDropdown({ items, value, onChange, onCreateNew, placeholder = 'Tìm...', disabled = false }) {
  const { t } = useLang();
  const { loc, fmtDate, fmtNum, fmtCurrency, fmtDateTime, monthShort } = useFmt();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Reset q khi đóng
  useEffect(() => { if (!open) setQ(''); }, [open]);
  // Focus thủ công sau khi mở — tránh autoFocus kéo bàn phím mobile lên ngay
  // lúc mở khiến layout nhảy và "nuốt" mất lượt chạm chọn đầu tiên.
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  const selected = items.find(i => i.id === value);
  const filtered = q.trim()
    ? items.filter(i => i.name.toLowerCase().includes(q.toLowerCase()))
    : items;

  const handleOpen = () => { if (!disabled) setOpen(o => !o); };

  return (
    <div className="relative" ref={ref}>
      <div
        role="button"
        tabIndex={0}
        onClick={handleOpen}
        className={`${inputCls} flex items-center gap-2 cursor-pointer min-h-[38px]
          ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-50' : ''}`}
      >
        <Search size={13} className="text-[#8E8878] flex-shrink-0" />
        <span className={`flex-1 truncate text-sm ${selected ? 'text-[#1C1C1E]' : 'text-[#8E8878]'}`}>
          {selected ? `${selected.name}${selected.unit ? ` (${selected.unit})` : ''}` : placeholder}
        </span>
        {selected && !disabled && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onChange(''); }}
            className="text-[#8E8878] hover:text-red-500 flex-shrink-0"
          >
            <X size={13} />
          </button>
        )}
        {!selected && (
          <ChevronDown size={13} className={`text-[#8E8878] transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`} />
        )}
      </div>

      {open && !disabled && (
        <div className="absolute top-full left-0 right-0 z-50 bg-white border border-[#E8DDD0]
          rounded-xl shadow-lg mt-1 overflow-hidden">
          <div className="p-2 border-b border-[#F0EBE3]">
            <input
              ref={inputRef}
              className="w-full text-sm px-3 py-1.5 rounded-lg border border-[#E8DDD0]
                focus:outline-none focus:border-[#C9A84C] bg-[#FAF7F2] placeholder-[#8E8878]"
              placeholder="Tìm..."
              value={q}
              onChange={e => setQ(e.target.value)}
              onClick={e => e.stopPropagation()}
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-sm text-[#8E8878] italic">Không tìm thấy</div>
            ) : (
              filtered.map(item => (
                <button
                  type="button"
                  key={item.id}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-[#FAF7F2] active:bg-[#F0EBE3] transition-colors
    ${value === item.id ? 'bg-[#F0EBE3] font-medium text-[#1C1C1E]' : 'text-[#1C1C1E]'}`}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onChange(item.id);
                    setOpen(false);
                  }}
                >
                  {item.name}{item.unit ? ` (${item.unit})` : ''}
                </button>
              ))
            )}
          </div>
          {onCreateNew && (
            <button
              type="button"
              className="w-full text-left px-3 py-2.5 text-sm text-[#C9A84C] font-semibold
                border-t border-[#F0EBE3] hover:bg-[#FAF7F2] flex items-center gap-1.5"
              onClick={() => { setOpen(false); onCreateNew(q); }}
            >
              <Plus size={13} /> Tạo sản phẩm mới{q ? `: "${q}"` : ''}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Multi-product select (tag-style, search + dropdown) ────────────────────────
// Lưu ý quan trọng: KHÔNG dùng document.addEventListener('mousedown', ...) để
// đóng dropdown khi click ra ngoài — global listener này chạy TRƯỚC khi React
// xử lý onClick của item trong dropdown (mousedown luôn fire trước click), nên
// nó có thể đóng dropdown / thay đổi DOM giữa lúc click đang diễn ra, khiến
// click vào đúng item lại rơi vào item khác (DOM đã re-render dưới ngón tay).
// Dùng onBlur trên wrapper (kết hợp tabIndex để wrapper nhận được focus/blur
// event của các con) là cách chuẩn và an toàn hơn nhiều cho combobox kiểu này.
function MultiProductSelect({ allProducts, selected, onChange }) {
  const { t } = useLang();
  const { loc, fmtDate, fmtNum, fmtCurrency, fmtDateTime, monthShort } = useFmt();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const closeTimer = useRef(null);

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  // Đóng dropdown khi focus rời khỏi toàn bộ wrapper (kể cả qua phím Tab).
  // Dùng setTimeout để cho phép click vào 1 item con (mousedown -> blur ->
  // click) vẫn kịp chạy onClick của item đó trước khi dropdown bị đóng/unmount.
  const handleBlur = () => {
    closeTimer.current = setTimeout(() => {
      if (!wrapRef.current?.contains(document.activeElement)) setOpen(false);
    }, 120);
  };

  // QUAN TRỌNG: danh sách dropdown KHÔNG được lọc bỏ item đã chọn — nếu lọc bỏ,
  // mỗi lần chọn 1 sản phẩm thì các item phía dưới nó sẽ "nhảy" lên lấp chỗ
  // trống ngay trong lúc người dùng đang click liên tiếp để chọn nhiều sản
  // phẩm, khiến lần click tiếp theo rơi vào đúng item vừa "trồi" lên vị trí đó
  // — kết quả: chọn nhầm/bỏ lỡ sản phẩm, hoặc nhìn như vừa chọn vừa mất sản
  // phẩm. Giữ nguyên thứ tự cố định, chỉ đổi trạng thái tick/highlight.
  const filtered = q.trim()
    ? allProducts.filter(p => p.name.toLowerCase().includes(q.toLowerCase()))
    : allProducts;
  const selectedItems = allProducts.filter(p => selected.includes(p.id));

  const removeTag = (id) => onChange(prev => prev.filter(x => x !== id));
  const toggleProduct = (id) => {
    onChange(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <div ref={wrapRef} onBlur={handleBlur} tabIndex={-1}>
      {/* Tags đã chọn — mỗi tag là 1 hàng riêng biệt, nút X có vùng bấm 24x24px
          (không phải icon 11px trần) để tránh bấm nhầm sang text cạnh bên. */}
      {selectedItems.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selectedItems.map(p => (
            <span key={p.id}
              className="flex items-center gap-1 bg-[#1A2B1A] text-white text-xs pl-2.5 py-1 rounded-full">
              <span>{p.name}{p.unit ? ` (${p.unit})` : ''}</span>
              <button
                type="button"
                onClick={() => removeTag(p.id)}
                className="w-6 h-6 -mr-1 flex items-center justify-center hover:text-red-300 transition-colors flex-shrink-0"
                aria-label={`Xoá ${p.name}`}
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input search + dropdown — chỉ chọn từ danh sách sản phẩm đã có sẵn
          (đã liên kết Ingredient), KHÔNG cho tạo sản phẩm mới ở đây nữa. Sản
          phẩm mới phải được tạo riêng từ trang quản lý sản phẩm xưởng, luôn
          gắn với 1 Ingredient có sẵn để dữ liệu không bị lệch khi chuyển kho. */}
      <div className="relative">
        <button
          type="button"
          className={`${inputCls} w-full flex items-center gap-2 cursor-pointer min-h-[38px] text-left`}
          onClick={() => setOpen(o => !o)}
        >
          <Search size={13} className="text-[#8E8878] flex-shrink-0" />
          <span className="flex-1 text-sm text-[#8E8878]">
            {selected.length === 0 ? 'Chọn sản phẩm...' : `Đã chọn ${selected.length} sản phẩm`}
          </span>
          <ChevronDown size={13} className={`text-[#8E8878] transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div className="absolute top-full left-0 right-0 z-50 bg-white border border-[#E8DDD0]
            rounded-xl shadow-lg mt-1 overflow-hidden">
            <div className="sticky top-0 z-20 bg-white p-2 border-b border-[#F0EBE3]">
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  className="flex-1 min-w-0 text-sm px-3 py-1.5 rounded-lg border border-[#E8DDD0]
        focus:outline-none focus:border-[#C9A84C] bg-[#FAF7F2] placeholder-[#8E8878]"
                  placeholder="Tìm sản phẩm..."
                  value={q}
                  onChange={e => setQ(e.target.value)}
                />

                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setOpen(false);
                    setQ('');
                  }}
                  className="w-9 h-9 flex-shrink-0 rounded-lg flex items-center justify-center
        text-[#8E8878] bg-[#FAF7F2] border border-[#E8DDD0]
        hover:text-red-500 hover:bg-red-50 active:bg-red-100"
                  aria-label="Đóng dropdown"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="px-3 py-2 text-sm text-[#8E8878] italic">Không tìm thấy</div>
              ) : (
                filtered.map(item => {
                  const checked = selected.includes(item.id);
                  return (
                    <button
                      type="button"
                      key={item.id}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleProduct(item.id);
                      }}
                      className={`w-full flex items-center gap-2.5 text-left px-3 py-2 text-sm transition-colors active:bg-[#F0EBE3]
    ${checked ? 'bg-[#FAF7F2] text-[#1C1C1E] font-medium' : 'text-[#1C1C1E] hover:bg-[#FAF7F2]'}`}
                    >
                      <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0
    ${checked ? 'bg-[#1A2B1A] border-[#1A2B1A]' : 'border-[#E8DDD0]'}`}>
                        {checked && <Check size={11} className="text-white" />}
                      </span>
                      <span className="flex-1">{item.name}{item.unit ? ` (${item.unit})` : ''}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Shimmer CSS ───────────────────────────────────────────────────────────────
const GANTT_CSS = `
@keyframes ganttFlow {
  0%   { background-position: -200% center; }
  100% { background-position: 200% center; }
}
.gantt-shimmer {
  background-size: 200% 100% !important;
  animation: ganttFlow 2s linear infinite;
}
@keyframes machineFlow {
  0%   { background-position: 100% center; }
  100% { background-position: -100% center; }
}
.mday-active {
  background: linear-gradient(90deg,#10b981 0%,#10b981 20%,#10b981 80%,#10b981 100%) !important;
  background-size: 300% 100% !important;
  animation: machineFlow 1.8s ease-in-out infinite;
}
.mday-maint {
  background: repeating-linear-gradient(
    45deg,rgba(220,38,38,0.7),rgba(220,38,38,0.7) 3px,
    rgba(254,202,202,0.85) 3px,rgba(254,202,202,0.85) 8px
  ) !important;
}
.mday-occupied {
  background: repeating-linear-gradient(
    45deg,rgba(37,99,235,0.7),rgba(37,99,235,0.7) 3px,
    rgba(191,219,254,0.85) 3px,rgba(191,219,254,0.85) 8px
  ) !important;
}
.mday-occupied-done {
  background: repeating-linear-gradient(
    45deg,rgba(16,185,129,0.55),rgba(16,185,129,0.55) 3px,
    rgba(255,255,255,0.85) 3px,rgba(255,255,255,0.85) 8px
  ) !important;
}
.mday-occupied-future {
  background: repeating-linear-gradient(
    45deg,rgba(234,179,8,0.65),rgba(234,179,8,0.65) 3px,
    rgba(255,255,255,0.85) 3px,rgba(255,255,255,0.85) 8px
  ) !important;
}
.mday-inactive { background: rgba(0,0,0,0.04) !important; }
`;
export function GanttCSS() { return <style>{GANTT_CSS}</style>; }

// ── DragScroll ────────────────────────────────────────────────────────────────
function DragScroll({ children, weeksBack, totalWeeks, className = '' }) {
  const ref = useRef(null);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startScroll = useRef(0);
  useEffect(() => {
    if (!ref.current || !weeksBack || !totalWeeks) return;
    const pct = weeksBack / totalWeeks;
    ref.current.scrollLeft = ref.current.scrollWidth * pct - ref.current.clientWidth / 2;
  }, []);
  const onMouseDown = e => {
    if (e.button !== 0) return;
    dragging.current = true; startX.current = e.pageX - ref.current.offsetLeft;
    startScroll.current = ref.current.scrollLeft; ref.current.style.cursor = 'grabbing'; e.preventDefault();
  };
  const onMouseMove = e => { if (!dragging.current) return; ref.current.scrollLeft = startScroll.current - (e.pageX - ref.current.offsetLeft - startX.current); };
  const onMouseUp = () => { dragging.current = false; if (ref.current) ref.current.style.cursor = 'grab'; };
  const ts = useRef(0); const tsc = useRef(0);
  return (
    <div ref={ref} className={'overflow-x-auto select-none scrollbar-hide ' + className}
      style={{ cursor: 'grab' }}
      onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
      onTouchStart={e => { ts.current = e.touches[0].pageX; tsc.current = ref.current.scrollLeft; }}
      onTouchMove={e => { ref.current.scrollLeft = tsc.current - (e.touches[0].pageX - ts.current); }}>
      {children}
    </div>
  );
}

// ── PRODUCTION GANTT ──────────────────────────────────────────────────────────
const WO_STATUS_COLOR = {
  SCHEDULED: '#6366f1', PENDING_PLAN: '#f59e0b', PLANNED: '#3b82f6',
  IN_PROGRESS: '#f97316', COMPLETED: '#10b981', CANCELLED: '#9ca3af',
};

export function ProductionGantt({ plans, orders, onPlanClick, onOrderClick }) {
  const { t } = useLang();
  const { loc, fmtDate, fmtNum, fmtCurrency, fmtDateTime, monthShort } = useFmt();
  const WEEKS_BACK = 8, WEEKS_TOTAL = 32;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const mon = new Date(today); mon.setDate(today.getDate() - ((today.getDay() + 6) % 7)); mon.setHours(0, 0, 0, 0);
  const wStart = new Date(mon); wStart.setDate(mon.getDate() - WEEKS_BACK * 7);
  const weeks = Array.from({ length: WEEKS_TOTAL }, (_, i) => { const d = new Date(wStart); d.setDate(wStart.getDate() + i * 7); return d; });
  const totalMs = WEEKS_TOTAL * 7 * 86400000, startMs = wStart.getTime(), endMs = startMs + totalMs;
  const pL = ms => Math.max(0, Math.min(100, ((ms - startMs) / totalMs) * 100));
  const pW = (s, e) => Math.max(0.5, ((Math.min(e, endMs) - Math.max(s, startMs)) / totalMs) * 100);
  const todayPct = pL(today.getTime());
  const COL_W = 110;

  const ordersByPlan = {};
  (orders || []).forEach(o => { const k = o.productionPlanId || '__none__'; if (!ordersByPlan[k]) ordersByPlan[k] = []; ordersByPlan[k].push(o); });
  const rows = [];
  (plans || []).forEach(p => { rows.push({ type: 'plan', data: p }); (ordersByPlan[p.id] || []).forEach(o => rows.push({ type: 'order', data: o })); });
  (ordersByPlan['__none__'] || []).forEach(o => rows.push({ type: 'order', data: o }));
  if (!rows.length) return <EmptyState icon={CalendarRange} title={t('production','dash_empty_production')} />;

  const LABEL_W = 200, ROW_H = 36, PLAN_ROW_H = 44;
  return (
    <div>
      <GanttCSS />
      <div className="flex">
        <div style={{ width: LABEL_W, flexShrink: 0 }}>
          <div style={{ height: 32 }} />
          {rows.map((row, ri) => {
            const isPlan = row.type === 'plan'; const d = row.data; const h = isPlan ? PLAN_ROW_H : ROW_H;
            return (
              <div key={`lbl-${ri}`} style={{ height: h, marginBottom: 4 }} className="flex items-center pr-3">
                {isPlan ? (
                  <div className="w-full">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold tracking-wide">KH</span>
                      <span className="text-xs font-bold text-[#1C1C1E] truncate">{d.planCode}</span>
                    </div>
                    <p className="text-[10px] text-[#8E8878] truncate mt-0.5">{d.title}</p>
                  </div>
                ) : (
                  <div className="pl-3 w-full">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-[#C9A84C] flex-shrink-0" />
                      <span className="text-[11px] font-semibold text-[#1C1C1E] truncate">{d.workOrderCode}</span>
                    </div>
                    <p className="text-[9px] text-[#8E8878] truncate pl-2.5">{d.productName}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <DragScroll weeksBack={WEEKS_BACK} totalWeeks={WEEKS_TOTAL} className="flex-1 min-w-0">
          <div style={{ minWidth: WEEKS_TOTAL * COL_W, position: 'relative' }}>
            <div className="flex sticky top-0 z-30" style={{ height: 32, background: 'white' }}>
              {weeks.map((w, i) => {
                const isNow = w <= today && today < new Date(w.getTime() + 7 * 86400000);
                const isMonth = w.getDate() <= 7;
                return (
                  <div key={i} style={{ flex: '0 0 ' + COL_W + 'px', width: COL_W }}
                    className={`flex-shrink-0 flex items-center justify-center border-l text-[10px] font-medium
                      ${isNow ? 'text-[#C9A84C] font-bold' : 'text-[#8E8878]'}
                      ${isMonth ? 'border-l-2 border-[#C9A84C]/30 bg-[#FAF7F2]' : 'border-black/5'}`}>
                    {isMonth ? <span className="font-bold">{w.toLocaleDateString(loc, { month: 'short' })}</span> : `${w.getDate()}/${w.getMonth() + 1}`}
                  </div>
                );
              })}
            </div>
            <div className="absolute top-0 bottom-0 z-20 pointer-events-none"
              style={{ left: `${todayPct}%`, width: 1.5, background: `linear-gradient(to bottom,${BRAND},${BRAND}55)` }} />
            {rows.map((row, ri) => {
              const isPlan = row.type === 'plan'; const d = row.data; const h = isPlan ? PLAN_ROW_H : ROW_H;
              const cancelled = d.status === 'CANCELLED'; const pct = Number(d.progressPct || 0);
              const s = Number(isPlan ? d.startDate : d.scheduledStartDate); const e = Number(isPlan ? d.endDate : d.plannedEndDate);
              if (!s) return <div key={`row-${ri}`} style={{ height: h, marginBottom: 4 }} />;
              const left = pL(s); const width = pW(s, e);
              const color = isPlan ? (cancelled ? '#9ca3af' : '#3b82f6') : (WO_STATUS_COLOR[d.status] || '#9ca3af');
              const isActive = d.status === 'IN_PROGRESS';
              return (
                <div key={`row-${ri}`} style={{ height: h, marginBottom: 4, position: 'relative' }}>
                  <div className="absolute inset-0" style={{ background: ri % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.012)' }} />
                  <button onClick={() => isPlan ? onPlanClick(d.id) : onOrderClick(d.id)}
                    style={{
                      position: 'absolute', top: isPlan ? 6 : 8, bottom: isPlan ? 6 : 8, left: `${left}%`, width: `${width}%`, minWidth: 3,
                      borderRadius: isPlan ? 6 : 4, overflow: 'hidden', cursor: 'pointer', border: 'none', padding: 0,
                      background: isPlan ? (cancelled ? '#d1d5db' : '#3b82f6') : (isActive ? `linear-gradient(90deg,${color}99 0%,${color}ff 40%,#ffffff44 50%,${color}ff 60%,${color}99 100%)` : cancelled ? color + '88' : color),
                      borderLeft: isPlan ? `3px solid ${cancelled ? '#9ca3af' : '#2563eb'}` : undefined,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.15)'
                    }}
                    className={isActive ? 'gantt-shimmer' : ''}>
                    <div className="h-full w-full flex items-center px-2 overflow-hidden">
                      {isPlan && !cancelled && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(pct, 100)}%`, background: 'rgba(255,255,255,0.2)', pointerEvents: 'none' }} />}
                      <span className="text-white text-[10px] font-bold whitespace-nowrap relative z-10 drop-shadow-sm">{pct.toFixed(0)}%</span>
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        </DragScroll>
      </div>
    </div>
  );
}

// ── MAINTENANCE GANTT (giữ nguyên từ bản cũ) ─────────────────────────────────
function MachineWeekModal({ machine, dayMs, maintenanceList, onClose }) {
  const { t } = useLang();
  const { loc, fmtDate, fmtNum, fmtCurrency, fmtDateTime, monthShort } = useFmt();
  const dayDate = new Date(dayMs);
  const dow = dayDate.getDay();
  const monOffset = (dow === 0 ? -6 : 1 - dow);
  const monDate = new Date(dayDate); monDate.setDate(dayDate.getDate() + monOffset); monDate.setHours(0, 0, 0, 0);
  const satDate = new Date(monDate); satDate.setDate(monDate.getDate() + 5); satDate.setHours(23, 59, 59, 999);
  const weekStart = monDate.getTime(); const weekEnd = satDate.getTime();
  const fmt = d => new Date(d).toLocaleDateString(loc, { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
  const fmtTime = ms => ms ? new Date(ms).toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' }) : '—';
  const dayStart = new Date(dayMs); dayStart.setHours(8, 0, 0, 0);
  const dayEnd = new Date(dayMs); dayEnd.setHours(18, 0, 0, 0);
  const dayMaints = maintenanceList.filter(mt => {
    const ms2 = Number(mt.actualStart || mt.plannedStart); const me = Number(mt.actualEnd || mt.plannedEnd);
    return ms2 && me && ms2 < dayEnd.getTime() && me > dayStart.getTime();
  });
  const totalDowntimeHours = dayMaints.reduce((sum, mt) => {
    const ms2 = Math.max(Number(mt.actualStart || mt.plannedStart), dayStart.getTime());
    const me = Math.min(Number(mt.actualEnd || mt.plannedEnd), dayEnd.getTime());
    return sum + Math.max(0, (me - ms2) / 3600000);
  }, 0);
  const workHours = Math.max(0, 10 - totalDowntimeHours);
  return (
    <Modal open title={`${machine.name} — ${dayDate.toLocaleDateString(loc, { weekday: 'long', day: '2-digit', month: '2-digit' })}`} onClose={onClose} size="md"
      footer={<SecondaryButton onClick={onClose}>Đóng</SecondaryButton>}>
      <div className="space-y-4">
        <div className="bg-[#FAF7F2] rounded-xl px-4 py-3 text-xs space-y-1.5">
          <div className="flex justify-between"><span className="text-[#8E8878]">Tuần làm việc</span><span className="font-semibold">{fmt(weekStart)} → {fmt(weekEnd)}</span></div>
          <div className="flex justify-between"><span className="text-[#8E8878]">Ca làm việc</span><span className="font-semibold text-emerald-600">08:00 – 18:00 (10 giờ/ngày)</span></div>
          <div className="flex justify-between"><span className="text-[#8E8878]">Giờ thực tế hôm nay</span><span className={`font-bold ${workHours < 10 ? 'text-amber-600' : 'text-emerald-600'}`}>{workHours.toFixed(1)}h</span></div>
          {totalDowntimeHours > 0 && <div className="flex justify-between"><span className="text-[#8E8878]">Giờ ngưng máy</span><span className="font-bold text-red-600">{totalDowntimeHours.toFixed(1)}h</span></div>}
        </div>
        {dayMaints.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#8E8878] uppercase tracking-wider">Lý do ngưng máy</p>
            {dayMaints.map((mt, i) => {
              const ms2 = Number(mt.actualStart || mt.plannedStart); const me = Number(mt.actualEnd || mt.plannedEnd);
              return (
                <div key={i} className="bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${mt.maintenanceType === 'CORRECTIVE' ? 'bg-red-200 text-red-800' : 'bg-blue-100 text-blue-700'}`}>
                      {mt.maintenanceType === 'CORRECTIVE' ? '🚨 Sự cố' : '🔧 Bảo trì'}
                    </span>
                    <span className="text-sm font-semibold text-[#1C1C1E]">{mt.title}</span>
                  </div>
                  <p className="text-xs text-[#8E8878]">{fmtTime(ms2)} → {fmtTime(me)}</p>
                  {mt.vendorName && <p className="text-xs text-[#8E8878]">Đơn vị: {mt.vendorName}</p>}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-700 font-medium text-center">✓ Máy hoạt động bình thường cả ngày</div>
        )}
      </div>
    </Modal>
  );
}

export function MaintenanceGantt({ machines, maintenanceList, occupancyList, onItemClick, onMachineClick }) {
  const { t } = useLang();
  const { loc, fmtDate, fmtNum, fmtCurrency, fmtDateTime, monthShort } = useFmt();
  const DAYS_BACK = 30, DAYS_TOTAL = 90, COL_W = 120, LABEL_W = 200, ROW_H = 40, WORK_START_H = 8, WORK_END_H = 18;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dStart = new Date(today); dStart.setDate(today.getDate() - DAYS_BACK);
  const days = Array.from({ length: DAYS_TOTAL }, (_, i) => { const d = new Date(dStart); d.setDate(dStart.getDate() + i); return d; });
  const totalMs = DAYS_TOTAL * 86400000, startMs = dStart.getTime(), endMs = startMs + totalMs;
  const todayPct = ((today.getTime() - startMs) / totalMs) * 100;
  const [clickedDay, setClickedDay] = useState(null);
  const [clickedOccupancy, setClickedOccupancy] = useState(null);
  const maintByMachine = {};
  (maintenanceList || []).forEach(m => { if (!maintByMachine[m.machineId]) maintByMachine[m.machineId] = []; maintByMachine[m.machineId].push(m); });
  const occByMachine = {};
  (occupancyList || []).forEach(o => { if (!occByMachine[o.machineId]) occByMachine[o.machineId] = []; occByMachine[o.machineId].push(o); });
  const rows = [];
  (machines || []).forEach(machine => {
    rows.push({ type: 'machine', data: machine });
    const maints = maintByMachine[machine.id] || [];
    const groups = {};
    maints.forEach(m => { const key = m.title || m.id; if (!groups[key]) groups[key] = { title: m.title, items: [], maintenanceType: m.maintenanceType, status: m.status }; groups[key].items.push(m); });
    Object.values(groups).forEach(group => rows.push({ type: 'maint', data: group, machine }));

    // ── Dòng riêng cho mỗi lệnh sản xuất đang/đã/sẽ chiếm máy này ──────────
    // Group theo workOrderCode + stepName (1 lệnh có thể chạy nhiều mẻ nối tiếp
    // cùng 1 bước/máy → gộp thành 1 dòng, show tất cả occurrence trong items)
    const occs = occByMachine[machine.id] || [];
    const occGroups = {};
    occs.forEach(o => {
      const key = `${o.workOrderCode || ''}__${o.stepName || ''}`;
      if (!occGroups[key]) occGroups[key] = { workOrderCode: o.workOrderCode, stepName: o.stepName, items: [] };
      occGroups[key].items.push(o);
    });
    Object.values(occGroups).forEach(group => rows.push({ type: 'occ', data: group, machine }));
  });
  if (!machines || !machines.length) return <EmptyState icon={Settings2} title={t('production','dash_empty_machine')} />;
  const maintColor = item => {
    if (item.status === 'COMPLETED') return '#22c55e';
    if (item.status === 'MISSED') return '#6b7280';
    if (item.maintenanceType === 'CORRECTIVE') return '#ef4444';
    if (item.status === 'IN_PROGRESS') return '#eab308';
    return '#3b82f6';
  };
  const getDayMaintOverlap = (machineMaints, dayMs) => {
    const workStart = dayMs + WORK_START_H * 3600000, workEnd = dayMs + WORK_END_H * 3600000;
    return machineMaints.filter(mt => { const ms2 = Number(mt.actualStart || mt.plannedStart), me = Number(mt.actualEnd || mt.plannedEnd); return ms2 && me && ms2 < workEnd && me > workStart; });
  };
  // Occupancy = lịch hoạt động DỰ KIẾN của máy, không phụ thuộc giờ hiện tại.
  // Điểm kết thúc dùng estimatedEndAt (đã tính ở backend = startedAt + durationMinutes
  // nếu chưa hoàn thành, hoặc completedAt nếu đã xong) — không dùng Date.now().
  // Không giới hạn theo giờ hành chính 8h-18h vì sản xuất có thể chạy ngoài giờ đó.
  const getDayOccupancyOverlap = (machineOcc, dayMs) => {
    const dayStart = dayMs, dayEnd = dayMs + 86400000;
    return (machineOcc || []).filter(o => {
      const ms2 = Number(o.startedAt);
      const me = o.estimatedEndAt != null ? Number(o.estimatedEndAt) : (o.completedAt ? Number(o.completedAt) : ms2);
      return ms2 && me && ms2 < dayEnd && me > dayStart;
    });
  };

  const WORK_MS = (WORK_END_H - WORK_START_H) * 3600000;
  const msToWorkLeft = ms => {
    const msDay = new Date(ms); msDay.setHours(0, 0, 0, 0);
    const di = Math.round((msDay.getTime() - dStart.getTime()) / 86400000);
    const dayWorkStart = msDay.getTime() + WORK_START_H * 3600000, dayWorkEnd = msDay.getTime() + WORK_END_H * 3600000;
    const clampedMs = Math.max(dayWorkStart, Math.min(ms, dayWorkEnd));
    return di * COL_W + ((clampedMs - dayWorkStart) / WORK_MS) * COL_W;
  };
  const msToWorkWidth = (s, e) => {
    const sDay = new Date(s); sDay.setHours(0, 0, 0, 0); const eDay = new Date(e); eDay.setHours(0, 0, 0, 0);
    const diS = Math.round((sDay.getTime() - dStart.getTime()) / 86400000), diE = Math.round((eDay.getTime() - dStart.getTime()) / 86400000);
    let totalPx = 0;
    for (let di = diS; di <= diE; di++) {
      const dayMs2 = dStart.getTime() + di * 86400000, dayWorkStart = dayMs2 + WORK_START_H * 3600000, dayWorkEnd = dayMs2 + WORK_END_H * 3600000;
      const segS = Math.max(s, dayWorkStart), segE = Math.min(e, dayWorkEnd);
      if (segE > segS) totalPx += ((segE - segS) / WORK_MS) * COL_W;
    }
    return Math.max(4, totalPx);
  };
  return (
    <div>
      <GanttCSS />
      <div className="flex">
        <div style={{ width: LABEL_W, flexShrink: 0 }}>
          <div style={{ height: 32 }} />
          {rows.map((row, ri) => {
            const isMachine = row.type === 'machine'; const d = row.data;
            return (
              <div key={`lbl-${ri}`} style={{ height: ROW_H, marginBottom: 4 }} className="flex items-center pr-3">
                {isMachine ? (
                  <div className="flex items-center gap-2 w-full">
                    {(() => {
                      const nowMs = Date.now(); const machineMaintList = maintByMachine[d.id] || [];
                      const inActiveMaint = machineMaintList.some(mt => { const ms2 = Number(mt.actualStart || mt.plannedStart), me = Number(mt.actualEnd || mt.plannedEnd); return ms2 && me && nowMs >= ms2 && nowMs <= me; });
                      const machineOccList = occByMachine[d.id] || [];
                      const inActiveOcc = machineOccList.some(o => { const ms2 = Number(o.startedAt), me = o.completedAt ? Number(o.completedAt) : nowMs; return ms2 && nowMs >= ms2 && nowMs <= me; });
                      const dotCls = inActiveMaint ? 'bg-red-400 animate-pulse' : inActiveOcc ? 'bg-blue-400 animate-pulse' : d.status === 'ACTIVE' ? 'bg-emerald-400 animate-pulse' : 'bg-gray-300';
                      return <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dotCls}`} />;
                    })()}
                    <div className="min-w-0">
                      <button onClick={() => onMachineClick?.(d.id)}
                        className="text-xs font-bold text-[#1C1C1E] truncate hover:text-[#C9A84C] hover:underline transition-colors block text-left">
                        {d.name}
                      </button>
                      {d.factoryName && <p className="text-[9px] text-[#8E8878] truncate">{d.factoryName}</p>}
                    </div>
                  </div>
                ) : row.type === 'occ' ? (
                  <div className="pl-4 flex items-center gap-1.5 w-full">
                    <span className="w-1 h-1 rounded-full flex-shrink-0 bg-blue-500" />
                    <span className="text-[10px] text-[#8E8878] truncate block">
                      {d.workOrderCode}{d.stepName ? ` — ${d.stepName}` : ''}
                    </span>
                  </div>
                ) : (
                  <div className="pl-4 flex items-center gap-1.5 w-full">
                    <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ backgroundColor: d.maintenanceType === 'CORRECTIVE' ? '#ef4444' : '#3b82f6' }} />
                    <span className="text-[10px] text-[#8E8878] truncate block">{d.title}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <DragScroll weeksBack={DAYS_BACK} totalWeeks={DAYS_TOTAL} className="flex-1 min-w-0">
          <div style={{ minWidth: DAYS_TOTAL * COL_W, position: 'relative' }}>
            <div className="flex sticky top-0 z-30" style={{ height: 32, background: 'white' }}>
              {days.map((d, i) => {
                const isToday = d.getTime() === today.getTime(); const isSun = d.getDay() === 0; const isSat = d.getDay() === 6; const isFirstOfMonth = d.getDate() === 1;
                return (
                  <div key={i} style={{ flex: `0 0 ${COL_W}px`, width: COL_W }}
                    className={`flex-shrink-0 flex items-center justify-center border-l text-[10px] font-medium
                      ${isToday ? 'bg-[#C9A84C]/10 text-[#C9A84C] font-bold border-[#C9A84C]/30' : isSun || isSat ? 'bg-gray-50 text-gray-400 border-black/5' : 'text-[#8E8878] border-black/5'}
                      ${isFirstOfMonth ? 'border-l-2 border-[#C9A84C]/40' : ''}`}>
                    <div className="text-center leading-tight">
                      {isFirstOfMonth ? <><span className="font-bold block">{d.toLocaleDateString(loc, { month: 'short' })}</span><span className="text-[9px]">{d.getDate()}</span></>
                        : <><span className="block">{['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][d.getDay()]}</span><span className="font-semibold">{d.getDate()}</span></>}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="absolute top-0 bottom-0 z-20 pointer-events-none" style={{ left: `${todayPct}%`, width: 2, background: `linear-gradient(to bottom,${BRAND},${BRAND}55)` }} />
            {rows.map((row, ri) => {
              const isMachine = row.type === 'machine'; const d = row.data; const machineMaints = isMachine ? (maintByMachine[d.id] || []) : []; const machineOcc = isMachine ? (occByMachine[d.id] || []) : [];
              const isOcc = row.type === 'occ';
              return (
                <div key={`row-${ri}`} style={{ height: ROW_H, marginBottom: 4, position: 'relative' }}>
                  <div className="absolute inset-0" style={{ background: ri % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.012)' }} />
                  {isOcc ? (
                    <>
                      {(d.items || []).map((o, ii) => {
                        const s = Number(o.startedAt);
                        const e = o.estimatedEndAt != null ? Number(o.estimatedEndAt) : (o.completedAt ? Number(o.completedAt) : s);
                        if (!s || s > endMs || e < startMs) return null;
                        const nowMs = Date.now();
                        const isDone = e < nowMs;
                        const isFuture = s > nowMs;
                        const color = isDone ? '#10b981' : isFuture ? '#eab308' : '#2563eb';
                        const barLeft = msToWorkLeft(s); const barW = msToWorkWidth(s, e);
                        return (
                          <button key={ii} onClick={() => setClickedOccupancy(o)}
                            title={`${o.workOrderCode || ''} — Mẻ ${o.batchCode || ''}\nBước: ${o.stepName || ''}\nBắt đầu: ${o.startedAt ? new Date(Number(o.startedAt)).toLocaleString(loc) : ''}\n${o.completedAt ? 'Hoàn thành' : 'Dự kiến hoàn thành'}: ${o.completedAt ? new Date(Number(o.completedAt)).toLocaleString(loc) : (o.estimatedEndAt != null ? new Date(Number(o.estimatedEndAt)).toLocaleString(loc) : '—')}`}
                            style={{ position: 'absolute', top: 6, bottom: 6, left: barLeft, width: Math.max(barW, 4), borderRadius: 4, overflow: 'hidden', cursor: 'pointer', border: 'none', padding: '0 6px', backgroundColor: color + 'cc', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', zIndex: 10 }}>
                            <span className="text-white text-[9px] font-bold whitespace-nowrap truncate drop-shadow-sm">
                              {o.workOrderCode}{' '}{o.startedAt ? new Date(Number(o.startedAt)).toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                          </button>
                        );
                      })}
                    </>
                  ) : isMachine ? (
                    <div className="absolute" style={{ top: 6, bottom: 6, left: 0, right: 0 }}>
                      {days.map((dayDate, di) => {
                        const dayMs = dayDate.getTime(); const isSun = dayDate.getDay() === 0; const dayLeft = di * COL_W;
                        if (isSun) return <div key={di} style={{ position: 'absolute', top: 0, bottom: 0, left: dayLeft, width: COL_W, background: 'rgba(0,0,0,0.025)', borderRadius: 3 }} />;
                        const workStart = dayMs + WORK_START_H * 3600000, workEnd = dayMs + WORK_END_H * 3600000;
                        const dayFullStart = dayMs, dayFullEnd = dayMs + 86400000;
                        const maintOverlaps = getDayMaintOverlap(machineMaints, dayMs);
                        const occOverlaps = getDayOccupancyOverlap(machineOcc, dayMs);
                        const blocks = [
                          ...maintOverlaps.map(mt => ({ start: Math.max(Number(mt.actualStart || mt.plannedStart), workStart), end: Math.min(Number(mt.actualEnd || mt.plannedEnd), workEnd), kind: 'maint' })),
                          ...occOverlaps.map(o => {
                            const oStart = Number(o.startedAt);
                            const oEnd = o.estimatedEndAt != null ? Number(o.estimatedEndAt) : (o.completedAt ? Number(o.completedAt) : oStart);
                            return { start: Math.max(oStart, dayFullStart), end: Math.min(oEnd, dayFullEnd), kind: 'occupied', data: o };
                          }),
                        ].sort((a, b) => a.start - b.start);
                        const totalDay = dayFullEnd - dayFullStart; const hasBlock = blocks.length > 0;
                        return (
                          <div key={di} onClick={() => setClickedDay({ machine: d, dayMs })} className="mday-active"
                            style={{ position: 'absolute', top: 0, bottom: 0, left: dayLeft, width: COL_W - 2, borderRadius: 4, cursor: 'pointer' }}>
                            {hasBlock && blocks.map((seg, si) => {
                              const totalRef = seg.kind === 'maint' ? (workEnd - workStart) : totalDay;
                              const refStart = seg.kind === 'maint' ? workStart : dayFullStart;
                              const segLeft2 = ((seg.start - refStart) / totalRef) * 100, segWidth2 = ((seg.end - seg.start) / totalRef) * 100;
                              if (segWidth2 <= 0) return null;
                              return (
                                <div key={si}
                                  className={seg.kind === 'maint' ? 'mday-maint' : 'mday-occupied'}
                                  onClick={seg.kind === 'occupied' ? (e) => { e.stopPropagation(); setClickedOccupancy(seg.data); } : undefined}
                                  style={{ position: 'absolute', top: 0, bottom: 0, left: `${segLeft2}%`, width: `${segWidth2}%`, cursor: seg.kind === 'occupied' ? 'pointer' : undefined }} />
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <>
                      {(d.items || []).map((item, ii) => {
                        const s = Number(item.actualStart || item.plannedStart), e = Number(item.actualEnd || item.plannedEnd || (s + 86400000 * 2));
                        if (!s || s > endMs || e < startMs) return null;
                        const color = maintColor(item); const barLeft = msToWorkLeft(s); const barW = msToWorkWidth(s, e);
                        return (
                          <button key={ii} onClick={() => onItemClick(item)}
                            style={{ position: 'absolute', top: 6, bottom: 6, left: barLeft, width: Math.max(barW, 4), borderRadius: 4, overflow: 'hidden', cursor: 'pointer', border: 'none', padding: '0 6px', backgroundColor: color + 'cc', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', zIndex: 10 }}>
                            <span className="text-white text-[9px] font-bold whitespace-nowrap truncate drop-shadow-sm">
                              {item.title?.length > 10 ? item.title.slice(0, 8) + '…' : item.title}{' '}{item.plannedStart ? new Date(item.plannedStart).toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                          </button>
                        );
                      })}
                    </>
                  )}
                </div>
              );
            })}
            <div className="flex flex-wrap gap-4 mt-3 px-1 pb-1 text-[10px] text-[#8E8878]">
              {[['#10b981', 'Đang hoạt động'], ['#2563eb', 'Đang sản xuất (lệnh)'], ['#ef4444', 'Bảo trì/Sự cố'], ['#3b82f6', 'Theo lịch'], ['#eab308', 'Đang xử lý'], ['#22c55e', 'Hoàn thành']].map(([c, l]) => (
                <span key={l} className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ backgroundColor: c }} />{l}</span>
              ))}
            </div>
          </div>
        </DragScroll>
      </div>
      {clickedDay && <MachineWeekModal machine={clickedDay.machine} dayMs={clickedDay.dayMs} maintenanceList={maintByMachine[clickedDay.machine.id] || []} onClose={() => setClickedDay(null)} />}
      {clickedOccupancy && <MachineOccupancyModal occupancy={clickedOccupancy} onClose={() => setClickedOccupancy(null)} />}
    </div>
  );
}

// ── Machine Occupancy Detail (click vào sọc chéo xanh dương) ─────────────────
export function MachineOccupancyModal({ occupancy, onClose }) {
  const { t } = useLang();
  const { loc, fmtDate, fmtNum, fmtCurrency, fmtDateTime, monthShort } = useFmt();
  const o = occupancy;
  const isRunning = !o.completedAt;
  const endLabel = o.completedAt
    ? new Date(Number(o.completedAt)).toLocaleString(loc)
    : (o.estimatedEndAt != null ? new Date(Number(o.estimatedEndAt)).toLocaleString(loc) : null);
  return (
    <Modal open title="Máy đang được sử dụng" onClose={onClose} size="sm"
      footer={<div className="flex justify-end"><SecondaryButton onClick={onClose}>Đóng</SecondaryButton></div>}>
      <div className="space-y-3">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-1.5">
          <p className="text-sm font-semibold text-blue-700">{o.workOrderCode}</p>
          <p className="text-sm text-blue-600">Mẻ {o.batchCode} — Bước: {o.stepName}</p>
          <p className="text-xs text-blue-500">
            Bắt đầu: {new Date(Number(o.startedAt)).toLocaleString(loc)}
          </p>
          {isRunning ? (
            <>
              <p className="text-xs font-semibold text-blue-600">⏳ Đang thực hiện</p>
              {endLabel && (
                <p className="text-xs text-blue-500">Dự kiến hoàn thành: {endLabel}</p>
              )}
            </>
          ) : (
            <p className="text-xs text-blue-500">Hoàn thành: {endLabel}</p>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ── MAINTENANCE DETAIL MODAL ──────────────────────────────────────────────────
export function MaintenanceDetailModal({ item, onClose }) {
  const { t } = useLang();
  const { loc, fmtDate, fmtNum, fmtCurrency, fmtDateTime, monthShort } = useFmt();
  const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
  const img = p => p?.startsWith('http') ? p : BASE + '/api/auth' + p;
  return (
    <Modal open title={item.title} onClose={onClose} size="lg" footer={<SecondaryButton onClick={onClose}>Đóng</SecondaryButton>}>
      <div className="space-y-5">
        <div className="flex gap-3 flex-wrap">
          <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${item.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : item.maintenanceType === 'CORRECTIVE' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
            {item.maintenanceType === 'CORRECTIVE' ? '🚨 Sự cố phát sinh' : '🔧 Bảo trì định kỳ'}
          </span>
          <span className="text-xs px-2.5 py-1 rounded-full bg-[#FAF7F2] text-[#8E8878]">{item.machineName}</span>
          <StatusBadge status={item.status} />
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {[{ label: 'Bắt đầu kế hoạch', value: fmtDate(item.plannedStart) }, { label: 'Kết thúc dự kiến', value: fmtDate(item.plannedEnd) }, { label: 'Thực tế hoàn thành', value: fmtDate(item.actualEnd) || '—' }, { label: 'Giờ downtime', value: item.actualDowntimeHours ? `${item.actualDowntimeHours}h` : `${item.plannedDowntimeHours || 0}h (KH)` }, { label: 'Chi phí', value: item.actualCost ? fmtCurrency(item.actualCost) : item.estimatedCost ? `~${fmtCurrency(item.estimatedCost)}` : '—' }, { label: 'Đơn vị thi công', value: item.vendorName || '—' }].map(s => (
            <div key={s.label} className="bg-[#FAF7F2] rounded-xl p-3"><p className="text-xs text-[#8E8878] mb-0.5">{s.label}</p><p className="font-semibold text-[#1C1C1E]">{s.value}</p></div>
          ))}
        </div>
        {item.description && <div className="bg-[#FAF7F2] rounded-xl p-3"><p className="text-xs text-[#8E8878] mb-1">Nội dung</p><p className="text-sm">{item.description}</p></div>}
        {item.completionNotes && <div className="bg-[#FAF7F2] rounded-xl p-3"><p className="text-xs text-[#8E8878] mb-1">Ghi chú hoàn thành</p><p className="text-sm">{item.completionNotes}</p></div>}
        {[['Ảnh trước bảo trì', item.beforeImages], ['Ảnh sau bảo trì', item.afterImages], ['Chứng từ', item.receiptImages]].map(([label, imgs]) => imgs?.length > 0 && (
          <div key={label}><p className="text-xs font-semibold text-[#8E8878] uppercase tracking-wider mb-2">{label}</p><div className="flex gap-2 flex-wrap">{imgs.map((url, i) => <a key={i} href={img(url)} target="_blank" rel="noreferrer"><img src={img(url)} alt="" className="w-24 h-24 object-cover rounded-xl border border-black/10 hover:scale-105 transition-transform" /></a>)}</div></div>
        ))}
      </div>
    </Modal>
  );
}

// ── CREATE PLAN MODAL — multi-product + search dropdown ───────────────────────
// ── Modal tạo sản phẩm sản xuất ─────────────────────────────────────────────
export function CreateProductModal({ onClose, onSaved }) {
  const { t } = useLang();
  const { loc, fmtDate, fmtNum, fmtCurrency, fmtDateTime, monthShort } = useFmt();
  const [form, setForm] = useState({ name: '', unit: 'Kg', description: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.name.trim()) { setErr(t('production','wo_err_product_name')); return; }
    if (!form.unit.trim()) { setErr(t('production','mstock_err_unit')); return; }
    setSaving(true);
    try {
      await factoryProductApi.create({ name: form.name.trim(), unit: form.unit.trim(), description: form.description.trim() || null });
      onSaved();
    } catch (e) {
      setErr(e?.response?.data?.message || t('error','generic'));
    } finally { setSaving(false); }
  };

  return (
    <Modal open title={t('production','dash_create_product_title')} onClose={onClose} size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose}>{t('common','cancel')}</SecondaryButton>
          <PrimaryButton onClick={submit} loading={saving}>{t('production','wo_create_product')}</PrimaryButton>
        </div>
      }>
      <div className="space-y-3">
        {err && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{err}</p>}
        <Field label={t('production','wo_field_product_name')} required>
          <input className={inputCls} value={form.name} onChange={e => set('name', e.target.value)} placeholder={t('production','wo_ph_product_name')} autoFocus />
        </Field>
        <Field label={t('production','oinv_unit')} required>
          <input className={inputCls} value={form.unit} onChange={e => set('unit', e.target.value)} placeholder={t('production','omach_field_capacity_ph')} />
        </Field>
        <Field label={t('production','omach_field_desc')}>
          <textarea className={inputCls} rows={2} value={form.description} onChange={e => set('description', e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

export function CreatePlanModal({ products, factories = [], onClose, onSaved }) {
  const { t } = useLang();
  const { loc, fmtDate, fmtNum, fmtCurrency, fmtDateTime, monthShort } = useFmt();
  const [form, setForm] = useState({ title: '', targetQty: '', notes: '', productionFactoryId: '' });
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [dateRange, setDateRange] = useState({ from: null, to: null });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const activeFactories = factories.filter(f => f.status === 'ACTIVE');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Nếu chỉ có 1 xưởng → tự chọn
  useEffect(() => {
    if (!form.productionFactoryId && activeFactories.length === 1) {
      set('productionFactoryId', String(activeFactories[0].id));
    }
  }, [activeFactories.length]); // eslint-disable-line

  const submit = async () => {
    if (!form.title || selectedProductIds.length === 0 || !form.targetQty) {
      setErr('Vui lòng điền đầy đủ tiêu đề, chọn ít nhất 1 sản phẩm và sản lượng');
      return;
    }
    if (!form.productionFactoryId) { setErr('Vui lòng chọn xưởng xử lý kế hoạch'); return; }
    if (!dateRange.from || !dateRange.to) { setErr('Chọn thời gian kế hoạch'); return; }
    setSaving(true);
    try {
      await ownerProdApi.createPlan({
        title: form.title,
        // Gửi array sản phẩm (backend cần hỗ trợ factoryProductIds)
        factoryProductId: selectedProductIds[0], // backward compat — sản phẩm chính
        factoryProductIds: selectedProductIds,
        productionFactoryId: Number(form.productionFactoryId),
        targetQty: Number(form.targetQty),
        startDate: dateRange.from,
        endDate: dateRange.to,
        notes: form.notes,
      });
      onSaved();
    } catch (e) {
      setErr(e?.response?.data?.message || 'Có lỗi xảy ra');
    } finally { setSaving(false); }
  };

  return (
    <Modal open title={t('production','dash_create_plan')} onClose={onClose} size="md"
      footer={
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose}>Huỷ</SecondaryButton>
          <PrimaryButton onClick={submit} loading={saving}>Tạo kế hoạch</PrimaryButton>
        </div>
      }>
      <div className="space-y-4">
        {err && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{err}</p>}

        <Field label={t('production','dash_plan_title')} required>
          <input className={inputCls} value={form.title} onChange={e => set('title', e.target.value)} placeholder="VD: Kế hoạch Q3 2026" />
        </Field>

        <Field label={t('production','dash_plan_factory')} required>
          <select className={inputCls} value={form.productionFactoryId}
            onChange={e => set('productionFactoryId', e.target.value)}>
            <option value="">-- Chọn xưởng --</option>
            {activeFactories.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </Field>

        <Field label={t('production','dash_plan_products')} required>
          <MultiProductSelect
            allProducts={products}
            selected={selectedProductIds}
            onChange={setSelectedProductIds}
          />
        </Field>

        <Field label={t('production','dash_plan_target_qty')} required>
          <input type="number" className={inputCls} value={form.targetQty}
            onChange={e => set('targetQty', e.target.value)} placeholder="VD: 5000" />
        </Field>

        <Field label={t('production','dash_plan_date_range')} required>
          <div className="pt-1">
            <DateRangePicker from={dateRange.from} to={dateRange.to} onChange={setDateRange} />
          </div>
        </Field>

        <Field label={t('production','dash_plan_notes')}>
          <textarea className={inputCls} rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

// ── CREATE WORK ORDER MODAL — block sản phẩm khi chưa chọn kế hoạch ──────────
export function CreateWorkOrderModal({ plans, products, factories, prefilledPlanId, onClose, onSaved }) {
  const { t } = useLang();
  const { loc, fmtDate, fmtNum, fmtCurrency, fmtDateTime, monthShort } = useFmt();
  const [form, setForm] = useState({
    productionPlanId: prefilledPlanId ? String(prefilledPlanId) : '',
    factoryProductId: '',
    plannedQty: '', notes: '', productionFactoryId: '', scheduledMode: false,
  });
  const [dateRange, setDateRange] = useState({ from: null, to: null });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [overPlanConfirm, setOverPlanConfirm] = useState(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const selectedPlan = plans.find(p => p.id === Number(form.productionPlanId));

  // Sản phẩm trong kế hoạch: ưu tiên factoryProductIds (array), fallback factoryProductId (single)
  const planProductIds = selectedPlan
    ? (selectedPlan.factoryProductIds?.length
      ? selectedPlan.factoryProductIds
      : selectedPlan.factoryProductId ? [selectedPlan.factoryProductId] : [])
    : [];
  const planProducts = planProductIds.length > 0
    ? products.filter(p => planProductIds.includes(p.id))
    : [];

  // Khi chọn plan, auto-fill sản phẩm nếu plan chỉ có 1 sản phẩm
  useEffect(() => {
    if (prefilledPlanId) {
      const p = plans.find(x => x.id === Number(prefilledPlanId));
      if (p) {
        const ids = p.factoryProductIds?.length ? p.factoryProductIds : p.factoryProductId ? [p.factoryProductId] : [];
        if (ids.length === 1) set('factoryProductId', String(ids[0]));
      }
    }
  }, [prefilledPlanId, plans]);

  const handlePlanChange = (planId) => {
    set('productionPlanId', planId);
    set('factoryProductId', ''); // reset sản phẩm khi đổi kế hoạch
  };

  const doSubmit = async (force = false) => {
    setSaving(true);
    try {
      await ownerProdApi.createWorkOrder({
        productionPlanId: Number(form.productionPlanId),
        factoryProductId: Number(form.factoryProductId),
        plannedQty: Number(form.plannedQty),
        scheduledStartDate: dateRange.from,
        plannedEndDate: dateRange.to,
        notes: form.notes,
        forceCreate: force,
        productionFactoryId: form.productionFactoryId ? Number(form.productionFactoryId) : null,
        scheduledMode: form.scheduledMode,
      });
      setOverPlanConfirm(null);
      onSaved();
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Có lỗi xảy ra';
      if (msg.startsWith('OVER_PLAN_QTY:')) {
        const [, nT, tQ] = msg.split(':');
        setOverPlanConfirm({ newTotal: nT, targetQty: tQ });
      } else { setErr(msg); }
    } finally { setSaving(false); }
  };

  const planAcc = selectedPlan ? Number(selectedPlan.accumulatedQty || 0) : 0;
  const planTgt = selectedPlan ? Number(selectedPlan.targetQty || 0) : 0;
  const noPlanSelected = !form.productionPlanId;

  // Plan items for dropdown
  const planItems = plans
    .filter(p => p.status === 'ACTIVE')
    .map(p => ({ id: p.id, name: `${p.planCode} — ${p.title}`, unit: '' }));

  return (
    <>
      <Modal open title={t('production','dash_create_work_order')} onClose={onClose} size="md"
        footer={
          <div className="flex justify-end gap-2">
            <SecondaryButton onClick={onClose}>{t('common','cancel')}</SecondaryButton>
            <PrimaryButton
              onClick={async () => {
                if (!form.productionPlanId || !form.factoryProductId || !form.plannedQty || !dateRange.from) {
                  setErr(t('production','dash_err_required_fields')); return;
                }
                setErr('');
                await doSubmit(false);
              }}
              loading={saving}>
              {t('production','dash_create_work_order')}
            </PrimaryButton>
          </div>
        }>
        <div className="space-y-4">
          {err && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{err}</p>}

          {/* Kế hoạch — search dropdown */}
          <Field label={t('production','dash_plan')} required>
            <SearchDropdown
              items={planItems}
              value={form.productionPlanId ? Number(form.productionPlanId) : ''}
              onChange={id => handlePlanChange(id ? String(id) : '')}
              placeholder={t('production','dash_select_plan')}
            />
          </Field>

          {/* Summary kế hoạch */}
          {selectedPlan && (
            <div className="bg-[#FAF7F2] rounded-xl px-4 py-3 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-[#8E8878]">{t('production','dash_plan_products')}</span>
                <span className="font-medium">{planProducts.map(p => p.name).join(', ') || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8E8878]">{t('production','dash_plan_target_qty')}</span>
                <span className="font-medium">{fmtNum(planTgt)} {selectedPlan.outputUnit}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8E8878]">{t('production','dash_plan_in_progress')}</span>
                <span className={`font-medium ${planAcc >= planTgt ? 'text-red-500' : 'text-emerald-600'}`}>{fmtNum(planAcc)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8E8878]">{t('production','dash_plan_remaining')}</span>
                <span className={`font-bold ${planTgt - planAcc <= 0 ? 'text-red-500' : 'text-[#C9A84C]'}`}>
                  {planTgt - planAcc <= 0 ? 'Đã đủ' : fmtNum(planTgt - planAcc)}
                </span>
              </div>
            </div>
          )}

          {/* Sản phẩm — chỉ hiện khi đã chọn kế hoạch, chỉ cho chọn sản phẩm trong kế hoạch */}
          <Field label={t('production','dash_plan_products')} required>
            {noPlanSelected ? (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-[#E8DDD0] bg-gray-50">
                <Search size={13} className="text-[#8E8878]" />
                <span className="text-sm text-[#8E8878]">{t('production','dash_select_plan')}</span>
              </div>
            ) : planProducts.length === 0 ? (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-amber-200 bg-amber-50">
                <AlertTriangle size={13} className="text-amber-600" />
                <span className="text-sm text-amber-700">{t('production','dash_plan_no_products')}</span>
              </div>
            ) : (
              <SearchDropdown
                items={planProducts}
                value={form.factoryProductId ? Number(form.factoryProductId) : ''}
                onChange={id => set('factoryProductId', id ? String(id) : '')}
                placeholder={t('production','dash_select_product')}
                disabled={noPlanSelected}
              />
            )}
          </Field>

          <Field label={t('production','dash_total_production_qty')} required>
            <input type="number" className={inputCls} value={form.plannedQty}
              onChange={e => set('plannedQty', e.target.value)} placeholder="VD: 500" />
          </Field>

          <Field label={t('production','dash_production_date')} required>
            <div className="pt-1">
              <DateRangePicker from={dateRange.from} to={dateRange.to} onChange={setDateRange}
                placeholder={selectedPlan ? `Từ ${fmtDate(selectedPlan.startDate)} trở đi` : t('production','dash_select_date')} />
            </div>
          </Field>

          <Field label={t('production','dash_notes')}>
            <textarea className={inputCls} rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
          </Field>

          {factories?.length > 0 && (
            <Field label={t('production','dash_production_factory')}>
              <select className={inputCls} value={form.productionFactoryId}
                onChange={e => set('productionFactoryId', e.target.value)}>
                <option value="">-- Không gán xưởng --</option>
                {factories.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </Field>
          )}

          <div className="flex items-center justify-between bg-[#FAF7F2] rounded-xl px-4 py-3">
            <div>
              <p className="text-sm font-medium">{t('production','dash_scheduled_cutting')}</p>
              <p className="text-xs text-[#8E8878]">{t('production','dash_scheduled_cutting_desc')}</p>
            </div>
            <button onClick={() => set('scheduledMode', !form.scheduledMode)}
              className={`w-12 h-6 rounded-full transition-colors relative ${form.scheduledMode ? 'bg-[#C9A84C]' : 'bg-black/15'}`}>
              <div className={`w-5 h-5 bg-white rounded-full shadow absolute top-0.5 transition-all ${form.scheduledMode ? 'left-6' : 'left-0.5'}`} />
            </button>
          </div>
        </div>
      </Modal>

      {overPlanConfirm && (
        <Modal open title={t('production','dash_over_plan_confirm')} onClose={() => setOverPlanConfirm(null)} size="sm"
          footer={
            <div className="flex justify-end gap-2">
              <SecondaryButton onClick={() => setOverPlanConfirm(null)}>Huỷ</SecondaryButton>
              <PrimaryButton onClick={() => doSubmit(true)} loading={saving}>Vẫn tạo lệnh</PrimaryButton>
            </div>
          }>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-3">
            <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-semibold">Tổng sản lượng sẽ vượt kế hoạch!</p>
              <p className="mt-1">Tổng: <b>{fmtNum(overPlanConfirm.newTotal)}</b> / Mục tiêu: <b>{fmtNum(overPlanConfirm.targetQty)}</b></p>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

// ── ADD MACHINE MODAL ─────────────────────────────────────────────────────────
export function AddMachineModal({ factories, onClose, onSaved }) {
  const { t } = useLang();
  const { loc, fmtDate, fmtNum, fmtCurrency, fmtDateTime, monthShort } = useFmt();
  const [form, setForm] = useState({ name: '', capacityHoursPerMonth: 0, description: '', manufacturer: '', serialNumber: '', purchaseCost: '', factoryId: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const submit = async () => {
    // if (!form.name || !form.capacityHoursPerMonth) { setErr('Vui lòng nhập tên máy và công suất'); return; }
    setSaving(true);
    try {
      await ownerProdApi.createMachine({ name: form.name, capacityHoursPerMonth: Number(form.capacityHoursPerMonth), description: form.description, manufacturer: form.manufacturer, serialNumber: form.serialNumber, purchaseCost: form.purchaseCost ? Number(form.purchaseCost) : null, factoryId: form.factoryId ? Number(form.factoryId) : null });
      onSaved();
    } catch (e) { setErr(e?.response?.data?.message || 'Có lỗi xảy ra'); } finally { setSaving(false); }
  };
  return (
    <Modal open title={t('production', 'add_machine')} onClose={onClose} size="md"
      footer={<div className="flex justify-end gap-2"><SecondaryButton onClick={onClose}>Huỷ</SecondaryButton><PrimaryButton onClick={submit} loading={saving}>Thêm máy</PrimaryButton></div>}>
      <div className="space-y-4">
        {err && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{err}</p>}
        <Field label={t('production', 'machine_name')} required><input className={inputCls} placeholder="VD: Máy xay thịt A" value={form.name} onChange={e => set('name', e.target.value)} /></Field>
        {factories?.length > 0 && (
          <Field label={t('production', 'factory')}>
            <select className={inputCls} value={form.factoryId} onChange={e => set('factoryId', e.target.value)}>
              <option value="">-- Chưa gán xưởng --</option>
              {factories.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </Field>
        )}
        <Field label="Mô tả"><textarea className={inputCls} rows={2} value={form.description} onChange={e => set('description', e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

// ── MAIN DASHBOARD ────────────────────────────────────────────────────────────
export default function OwnerProductionDashboard() {
  const { t } = useLang();
  const { loc, fmtDate, fmtNum, fmtCurrency, fmtDateTime, monthShort } = useFmt();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [dashboard, setDashboard] = useState(null);
  const [plans, setPlans] = useState([]);
  const [products, setProducts] = useState([]);
  const [factories, setFactories] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [occupancy, setOccupancy] = useState([]);
  const [loading, setLoading] = useMinLoading(true);
  const [showCreatePlan, setShowCreatePlan] = useState(false);
  const [showCreateWorkOrder, setShowCreateWorkOrder] = useState(false);
  const [showAddMachine, setShowAddMachine] = useState(false);
  const [showFactories, setShowFactories] = useState(false);
  const [showCreateProduct, setShowCreateProduct] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [selectedMaint, setSelectedMaint] = useState(null);
  // Cho phép quay lại đúng tab đã xem trước đó (VD: từ trang Metric máy back về ?tab=machines)
  const [activeSection, setActiveSection] = useState(
    searchParams.get('tab') === 'machines' ? 'machines' : 'orders'
  );

  const load = async () => {
    setLoading(true);
    try {
      // Khoảng thời gian khớp với MaintenanceGantt: 30 ngày trước → 60 ngày sau (tổng 90 ngày)
      const now = Date.now();
      const fromMs = now - 30 * 86400000;
      const toMs = now + 60 * 86400000;
      const [dash, planList, prods, maint, factList, occ] = await Promise.all([
        ownerProdApi.getDashboard(),
        ownerProdApi.listPlans(0, 50, 'ACTIVE'),
        factoryProductApi.list(true),
        ownerProdApi.listMaintenance(new Date().getFullYear()),
        ownerProdApi.listFactories().catch(() => []),
        ownerProdApi.listMachineOccupancy(fromMs, toMs).catch(() => []),
      ]);
      setDashboard(dash);
      setPlans(planList?.content || []);
      setProducts(prods || []);
      setMaintenance(maint || []);
      setFactories(factList || []);
      setOccupancy(occ || []);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  // Auto-refresh occupancy mỗi 60 giây khi đang xem tab machines — để Gantt cập nhật realtime
  useEffect(() => {
    if (activeSection !== 'machines') return;
    const refreshOccupancy = async () => {
      const now = Date.now();
      const fromMs = now - 30 * 86400000;
      const toMs = now + 60 * 86400000;
      try {
        const occ = await ownerProdApi.listMachineOccupancy(fromMs, toMs);
        setOccupancy(occ || []);
      } catch (_) { }
    };
    const timer = setInterval(refreshOccupancy, 60000);
    refreshOccupancy(); // immediate refresh khi chuyển sang tab machines
    return () => clearInterval(timer);
  }, [activeSection]);

  const onSaved = () => { setShowCreatePlan(false); setShowCreateWorkOrder(false); load(); };

  const handleResetTestData = async () => {
    if (!window.confirm(
      '⚠️ XOÁ SẠCH dữ liệu module sản xuất (kế hoạch, lệnh, mẻ, biến thể, nguyên liệu, ' +
      'thành phẩm, bán thành phẩm, scrap, phiếu chuyển kho, biên bản hao hụt...) và tạo ' +
      'lại sản phẩm từ Ingredient hiện có.\n\nHÀNH ĐỘNG KHÔNG THỂ HOÀN TÁC.\n\nBạn CHẮC CHẮN muốn tiếp tục?'
    )) return;
    if (!window.confirm('Xác nhận LẦN CUỐI: toàn bộ dữ liệu sản xuất sẽ bị xoá vĩnh viễn. Tiếp tục?')) return;
    setResetting(true);
    try {
      const result = await productionResetApi.resetAndSeed();
      alert(`Đã xoá ${result.reset.tablesCleared} bảng, kích hoạt lại ${result.reset.machinesReactivated} máy, và tạo lại ${result.seed.factoryProductsCreated} sản phẩm từ ${result.seed.totalIngredients} nguyên liệu.`);
      load();
    } catch (e) {
      alert(e?.response?.data?.message || 'Có lỗi xảy ra khi reset dữ liệu');
    } finally { setResetting(false); }
  };

  if (loading && !dashboard) return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <StatCardSkeleton key={i} />)}</div>
    </div>
  );

  const d = dashboard || {};

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <PageHeader icon={Factory} title={t('production','dash_title')} subtitle={t('production','dash_subtitle')} />
        <div className="flex gap-2">
          {/* ⚠️ CHỈ DÙNG MÔI TRƯỜNG TEST — xoá nút này (và productionResetApi) trước khi
              deploy lên môi trường có dữ liệu thật. Xem ProductionResetController backend. */}
          <button onClick={handleResetTestData} disabled={resetting}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl
              bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 disabled:opacity-50">
            <RotateCcw size={13} /> {resetting ? 'Resetting...' : 'Reset data (test)'}
          </button>
          <SecondaryButton onClick={() => navigate('/owner/production/loss-reports')}>
            <FileWarning size={15} /> {t('production','dash_loss_reports')}
          </SecondaryButton>
          <SecondaryButton onClick={() => navigate('/owner/production/material-stock')}>
            <Package size={15} /> {t('production','mstock_title')}
          </SecondaryButton>
          <SecondaryButton onClick={() => setShowFactories(true)}>
            <Building2 size={15} /> {t('production','factory_title')}
          </SecondaryButton>
          <SecondaryButton onClick={() => setShowCreateProduct(true)}>
            <Package size={15} /> {t('production','dash_create_product')}
          </SecondaryButton>
          <PrimaryButton onClick={() => setShowCreatePlan(true)}><Plus size={15} />{t('production','dash_new_plan')}</PrimaryButton>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { icon: CalendarRange, label: t('production','dash_kpi_active_plans'), value: d.totalActivePlans || 0, color: 'text-blue-600', iconBg: 'bg-blue-50' },
          { icon: ClipboardList, label: t('production','dash_kpi_total_wo'), value: d.totalWorkOrders || 0, color: 'text-[#1C1C1E]', iconBg: 'bg-[#FAF7F2]' },
          { icon: Factory, label: t('production','dash_kpi_in_progress'), value: d.inProgressOrders || 0, color: 'text-orange-600', iconBg: 'bg-orange-50' },
          { icon: Clock, label: t('production','dash_kpi_pending_plan'), value: d.pendingPlanOrders || 0, color: d.pendingPlanOrders > 0 ? 'text-amber-600' : 'text-[#8E8878]', iconBg: 'bg-amber-50' },
          { icon: CheckCircle2, label: t('production','dash_kpi_completed'), value: d.completedOrders || 0, color: 'text-emerald-600', iconBg: 'bg-emerald-50' },
          { icon: Settings2, label: t('production','dash_kpi_active_machines'), value: `${d.activeMachines || 0}/${d.totalMachines || 0}`, color: 'text-[#C9A84C]', iconBg: 'bg-[#C9A84C]/10' },
        ].map(kpi => <KpiCard key={kpi.label} {...kpi} />)}
      </div>

      {d.pendingPlanOrders > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
          <AlertTriangle size={18} className="text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-800 font-medium">{d.pendingPlanOrders} {t('production', 'dash_pending_plans')}</p>
        </div>
      )}

      <div className="flex gap-1 bg-white border border-black/5 rounded-xl p-1 w-fit shadow-sm">
        {[{ id: 'orders', label: t('production','dash_tab_orders'), icon: ClipboardList }, { id: 'machines', label: t('production','dash_tab_machines'), icon: Settings2 }].map(s => (
          <button key={s.id} onClick={() => setActiveSection(s.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeSection === s.id ? 'bg-[#1C1C1E] text-white' : 'text-[#8E8878] hover:text-[#1C1C1E]'}`}>
            <s.icon size={14} />{s.label}
          </button>
        ))}
      </div>

      {activeSection === 'orders' && (
        <SectionCard>
          <SectionHeader title={t('production','dash_gantt_title')} />
          <div className="p-4">
            <ProductionGantt
              plans={d.recentPlans || []} orders={d.calendarItems || []}
              onPlanClick={id => navigate(`/owner/production/plans/${id}`)}
              onOrderClick={id => navigate(`/owner/production/work-orders/${id}`)} />
          </div>
        </SectionCard>
      )}

      {activeSection === 'machines' && (
        <SectionCard>
          <SectionHeader title={t('production','dash_machines_gantt_title')}
            action={<button onClick={() => setShowAddMachine(true)} className="flex items-center gap-1 text-xs text-[#C9A84C] font-semibold hover:underline"><Plus size={12} />{t('production','dash_add_machine')}</button>} />
          <div className="p-4">
            <MaintenanceGantt machines={d.machines || []} maintenanceList={maintenance} occupancyList={occupancy}
              onItemClick={setSelectedMaint}
              onMachineClick={id => navigate(`/owner/production/machines/${id}/metrics`)} />
          </div>
        </SectionCard>
      )}

      {showCreatePlan && <CreatePlanModal products={products} factories={factories} onClose={() => setShowCreatePlan(false)} onSaved={onSaved} />}
      {showCreateWorkOrder && <CreateWorkOrderModal plans={plans} products={products} factories={factories} onClose={() => setShowCreateWorkOrder(false)} onSaved={onSaved} />}
      {showCreateProduct && <CreateProductModal onClose={() => setShowCreateProduct(false)} onSaved={() => { setShowCreateProduct(false); load(); }} />}
      {selectedMaint && <MaintenanceDetailModal item={selectedMaint} onClose={() => setSelectedMaint(null)} />}
      {showAddMachine && <AddMachineModal factories={factories} onClose={() => setShowAddMachine(false)} onSaved={onSaved} />}
      <FactoryManagementModal open={showFactories} onClose={() => setShowFactories(false)} onChanged={load} />
    </div>
  );
}