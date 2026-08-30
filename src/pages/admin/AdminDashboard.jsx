// src/pages/admin/AdminDashboard.jsx
import { useLang } from '../../context/LangContext';
import { useEffect, useState, useRef, useCallback } from 'react';
import { ChartSkeleton, Sk, StatCardSkeleton, TableSkeleton } from '../../components/ui/Skeleton.jsx';
import useMinLoading from '../../hooks/useMinLoading.js';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, DollarSign, ShoppingCart, Users, Package,
  UserPlus, Clock, Trophy, Medal,
  ChevronDown, CalendarDays, TrendingUp, TrendingDown, Minus, Crown,
  AlertTriangle, Wallet, Activity, Receipt, BarChart2,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { adminDashboardApi, getImageUrl } from '../../api/adminApi';
import StatCard from '../../components/ui/StatCard';
import { PageHeader, EmptyState, formatCurrency, formatNumber } from '../../components/ui';
import DateRangePicker, { presetToRange, previousMonthRange } from '../../components/ui/DateRangePicker';
import { ORDER_STATUS_COLOR, FALLBACK_COLOR } from '../../config/chartPalette';
import { SubPageButtons } from '../../components/common/SubPageNav';

// ── CountUp hook ──────────────────────────────────────────────────────────────
function useCountUp(target, duration = 800) {
  const [val, setVal] = useState(0);
  const raf = useRef(null);
  const prev = useRef(0);

  useEffect(() => {
    const end = Number(target) || 0;
    const start = prev.current;
    const t0 = performance.now();
    const ease = (t) => t === 1 ? 1 : 1 - Math.pow(2, -10 * t);

    cancelAnimationFrame(raf.current);
    const tick = (now) => {
      const p = Math.min((now - t0) / duration, 1);
      setVal(start + (end - start) * ease(p));
      if (p < 1) raf.current = requestAnimationFrame(tick);
      else { setVal(end); prev.current = end; }
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);

  return val;
}

function AnimCurrency({ value }) {
  const v = useCountUp(value);
  return <>{formatCurrency(v)}</>;
}
function AnimNumber({ value }) {
  const v = useCountUp(value);
  return <>{formatNumber(Math.round(v))}</>;
}
function AnimDecimal({ value }) {
  const v = useCountUp(value);
  // Tồn kho có thể có số lẻ (VD: 12.5 kg) — giữ tối đa 2 chữ số thập phân, bỏ số 0 thừa
  return <>{new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(v)}</>;
}
// Rút gọn số lớn để không tràn khỏi card trên mobile (VD: 137.995.016,35 → "138,0 triệu").
// Số nhỏ (< 100.000) vẫn hiển thị đầy đủ như bình thường — chỉ rút gọn khi thực sự dài.
function formatCompactQty(v) {
  const n = Number(v) || 0;
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(n / 1_000_000_000) + ' tỷ';
  if (abs >= 1_000_000) return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(n / 1_000_000) + ' triệu';
  if (abs >= 100_000) return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(n / 1_000) + ' nghìn';
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(n);
}
function AnimCompactQty({ value }) {
  const v = useCountUp(value);
  return <>{formatCompactQty(v)}</>;
}
// Rút gọn tiền tệ để không tràn card/chip khi số quá dài (VD: 4.316.438.393 → "4,32 tỷ").
// Dưới 1 triệu vẫn hiển thị đầy đủ kèm "đ".
function formatCompactCurrency(v) {
  const n = Number(v) || 0;
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(n / 1_000_000_000) + ' tỷ';
  if (abs >= 1_000_000) return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(n / 1_000_000) + ' tr';
  return new Intl.NumberFormat('vi-VN').format(Math.round(n)) + ' đ';
}
function AnimCompactCurrency({ value }) {
  const v = useCountUp(value);
  return <>{formatCompactCurrency(v)}</>;
}



// ── Status colors & Vietnamese labels ────────────────────────────────────────



// ── Custom tooltip ────────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-chrome rounded-xl px-3 py-2 shadow-xl text-xs space-y-1">
      <p className="text-white/60 mb-1">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-white/70">{p.name === 'revenue' ? 'Doanh thu' : 'Đơn'}:</span>
          <span className="text-white font-semibold">
            {p.name === 'revenue' ? formatCurrency(p.value) : formatNumber(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Pie custom tooltip ────────────────────────────────────────────────────────
function PieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  return (
    <div className="bg-chrome rounded-xl px-3 py-2 shadow-xl text-xs">
      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: entry.payload.fill }} />
        <span className="text-white/70">{STATUS_LABEL_VI[entry.name] ?? entry.name}:</span>
        <span className="text-white font-semibold">{formatNumber(entry.value)}</span>
      </div>
    </div>
  );
}

// ── Sort select ───────────────────────────────────────────────────────────────
function SortSelect({ value, onChange, options }) {
  return (
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)}
        className="appearance-none pl-3 pr-7 py-1.5 text-xs border border-line rounded-xl
          bg-surface text-muted focus:outline-none focus:border-gold cursor-pointer">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
    </div>
  );
}

// ── Change badge ─────────────────────────────────────────────────────────────
function ChangeBadge({ pct }) {
  if (pct == null) return null;
  if (pct > 0) return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
      <TrendingUp size={9} /> +{pct.toFixed(1)}%
    </span>
  );
  if (pct < 0) return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-red-500 bg-red-50 dark:bg-red-500/10 px-1.5 py-0.5 rounded-full">
      <TrendingDown size={9} /> {pct.toFixed(1)}%
    </span>
  );
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-muted bg-surface-2 px-1.5 py-0.5 rounded-full">
      <Minus size={9} /> 0%
    </span>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { t } = useLang();
  const navigate = useNavigate();
  const basePath = window.location.pathname.split('/').slice(0, 2).join('/');

  const PRESETS = [
    { key: 'today', label: t('common', 'today') },
    { key: 'week', label: t('common', 'this_week') },
    { key: 'month', label: t('common', 'this_month') },
    { key: 'year', label: t('common', 'this_year') },
    { key: 'custom', label: t('common', 'date_range') },
  ];
  const STATUS_LABEL_VI = {
    PENDING: t('status', 'pending_confirm'),
    CONFIRMED: t('status', 'confirmed'),
    PREPARING: t('status', 'preparing'),
    READY: t('status', 'ready'),
    DELIVERING: 'Đang giao hàng',
    PENDING_PAYMENT: 'Chờ thanh toán',
    COMPLETED: 'Thành công',
    CANCELLED: 'Huỷ',
    FAILED: 'Thất bại',
  };

  const [preset, setPreset] = useState('fixedmonth');
  const [stats, setStats] = useState(null);
  const [debtStats, setDebtStats] = useState(null);
  const [topProducts, setTopProducts] = useState([]);
  const [topSellers, setTopSellers] = useState([]);
  const [topCustomers, setTopCustomers] = useState([]);
  const [loading, setLoading] = useMinLoading();
  const [productSort, setProductSort] = useState('revenue');
  const [sellerSort, setSellerSort] = useState('revenue');
  const [range, setRange] = useState(() => previousMonthRange().range);

  const load = useCallback(async (r, ps, ss) => {
    if (!r) return;
    setLoading(true);
    try {
      const [s, p, u, tc, ds] = await Promise.all([
        adminDashboardApi.getStats(r.from, r.to),
        adminDashboardApi.getTopProducts(10, r.from, r.to, ps),
        adminDashboardApi.getTopSellers(10, r.from, r.to, ss),
        adminDashboardApi.getTopCustomers(10, r.from, r.to).catch(() => []),
        adminDashboardApi.getDebtStats().catch(() => null),
      ]);
      setStats(s);
      setDebtStats(ds);
      setTopProducts(p || []);
      setTopSellers(u || []);
      setTopCustomers(tc || []);
    } catch (e) {
      console.error('Dashboard load failed', e);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(range, productSort, sellerSort); }, [range]);

  useEffect(() => {
    if (!range) return;
    adminDashboardApi.getTopProducts(10, range.from, range.to, productSort)
      .then(p => setTopProducts(p || [])).catch(console.error);
  }, [productSort]);

  useEffect(() => {
    if (!range) return;
    adminDashboardApi.getTopSellers(10, range.from, range.to, sellerSort)
      .then(u => setTopSellers(u || [])).catch(console.error);
  }, [sellerSort]);

  const handlePreset = (key) => { setPreset(key); };
  const handleRangeChange = (r) => { setRange(r); };

  // Map pie data: dùng label tiếng Việt cho Legend
  const pieData = (stats?.ordersByStatus || []).map(s => ({
    name: s.status,
    label: STATUS_LABEL_VI[s.status] ?? s.status,
    value: Number(s.count),
  }));

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5">
      <PageHeader icon={LayoutDashboard} title="Dashboard" subtitle="Tổng quan hoạt động kinh doanh" />

      {/* ── Trang phụ gom từ sidebar về đây ────────────────────────────────
           Dòng tiền / KPI Sale / Phân tích không còn là mục menu riêng nữa;
           bấm nút sẽ trượt sang trang đích, trang đó có nút Quay lại. */}
      <SubPageButtons
        items={[
          { to: `${basePath}/cashflow`, label: 'Dòng tiền', icon: Activity },
          { to: `${basePath}/sale-kpi`, label: 'Quản lý sales', icon: Receipt },
          { to: `${basePath}/analytics`, label: 'Dự báo', icon: BarChart2 },
          { to: `${basePath}/material-price-tracking`, label: 'Biến động giá NL', icon: BarChart2 },
        ]}
      />

      {/* ── Date range picker ── */}
      <div className="bg-surface rounded-2xl border border-line-soft px-4 py-3 shadow-sm relative">
        <DateRangePicker
          preset={preset}
          onPreset={handlePreset}
          onRangeChange={handleRangeChange}
        />
      </div>

      {/* ══════════════════════════════════════════════════════════════
           ROW 1 — Doanh thu (full width, gộp Đơn hàng + Khách hàng)
      ══════════════════════════════════════════════════════════════ */}
      <div className="bg-surface rounded-2xl border border-line-soft shadow-sm p-4 sm:p-5">
        <div className="lg:flex lg:items-stretch lg:gap-6">

          {/* Left: doanh thu + 3 chip phân loại */}
          <div className="lg:flex-1 min-w-0">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] sm:text-xs text-muted font-medium">Doanh thu kỳ này</p>
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gold/10 flex items-center justify-center shrink-0">
                <DollarSign size={14} className="text-gold" />
              </div>
            </div>

            {/* Big number + change badge */}
            {loading ? (
              <div className="h-8 rounded-lg bg-surface-2 animate-pulse mt-1" />
            ) : (
              <p className="text-2xl sm:text-3xl font-bold text-ink tabular-nums break-words leading-tight">
                <AnimCurrency value={stats?.revenueToday ?? 0} />
              </p>
            )}
            {stats?.revenueChangePercent != null && !loading && (
              <div className="mt-1.5"><ChangeBadge pct={stats.revenueChangePercent} /></div>
            )}

            {/* 3 chip: Đang xử lý | Đã thu | Chưa thu — cùng 1 dòng */}
            {loading ? (
              <div className="h-14 rounded-lg bg-surface-2 animate-pulse mt-3" />
            ) : (
              <div className="grid grid-cols-3 gap-2 mt-3">
                {[
                  { label: 'Đang xử lý', value: stats?.processingAmount, text: 'text-blue-600 dark:text-blue-300', bg: 'bg-blue-50 dark:bg-blue-500/10' },
                  { label: 'Đã thu', value: stats?.totalPaidAmount ?? stats?.totalPaid, text: 'text-emerald-600 dark:text-emerald-300', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
                  { label: 'Chưa thu', value: stats?.totalUnpaidAmount, text: 'text-orange-600 dark:text-orange-300', bg: 'bg-orange-50 dark:bg-orange-500/10' },
                ].map((r, i) => (
                  <div key={i} className={`${r.bg} rounded-xl px-2.5 py-2 flex flex-col`}>
                    <span className={`text-[10px] sm:text-[11px] font-semibold ${r.text}`}>{r.label}</span>
                    <span className={`mt-1 text-[13px] sm:text-[15px] font-bold leading-none tabular-nums ${r.text}`}>
                      <AnimCompactCurrency value={r.value ?? 0} />
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: Đơn hàng + Khách hàng — mobile 2 cột, desktop vách ngăn bên phải */}
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3 mt-4 lg:mt-0 lg:w-[40rem] lg:shrink-0
            lg:border-l lg:border-line-soft lg:pl-6">

            {/* Đơn hàng kỳ này */}
            <div className="rounded-xl bg-blue-50/70 dark:bg-blue-500/7 p-3 flex flex-col justify-center">
              <div className="flex items-center gap-1.5 mb-1">
                <ShoppingCart size={12} className="text-blue-500 shrink-0" />
                <span className="text-[10px] sm:text-[11px] text-muted font-medium leading-tight">Đơn hàng kỳ này</span>
              </div>
              {loading ? (
                <div className="h-7 rounded bg-surface-2 animate-pulse" />
              ) : (
                <p className="text-xl sm:text-2xl font-bold text-ink tabular-nums leading-tight">
                  <AnimNumber value={stats?.ordersToday ?? 0} />
                </p>
              )}
              {stats?.ordersChangePercent != null && !loading && (
                <div className="mt-1.5"><ChangeBadge pct={stats.ordersChangePercent} /></div>
              )}
            </div>

            {/* Khách hàng */}
            <div className="rounded-xl bg-emerald-50/70 dark:bg-emerald-500/7 p-3 flex flex-col justify-center">
              <div className="flex items-center gap-1.5 mb-1">
                <Users size={12} className="text-emerald-500 shrink-0" />
                <span className="text-[10px] sm:text-[11px] text-muted font-medium leading-tight">Khách hàng</span>
              </div>
              {loading ? (
                <div className="h-7 rounded bg-surface-2 animate-pulse" />
              ) : (
                <p className="text-xl sm:text-2xl font-bold text-ink tabular-nums leading-tight">
                  <AnimNumber value={stats?.totalCustomers ?? 0} />
                </p>
              )}
              {!loading && (
                <p className="text-[10px] text-emerald-600 dark:text-emerald-300 mt-1.5 font-medium truncate">
                  +<AnimNumber value={stats?.newCustomersToday ?? 0} /> mới kỳ này
                </p>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
           ROW 2 — 4 card: Tổng chi | Tồn kho Kem | Tồn kho Gia vị | Tồn kho Xúc xích
      ══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">

        {/* Card Tổng chi — dời từ ROW 1 xuống, thay chỗ card Khách hàng cũ */}
        <div className="bg-surface rounded-2xl border border-line-soft shadow-sm p-4 sm:p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] sm:text-xs text-muted font-medium">Tổng chi</p>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center shrink-0">
              <TrendingDown size={14} className="text-red-500" />
            </div>
          </div>
          {loading
            ? <div className="h-8 rounded-lg bg-surface-2 animate-pulse mt-1" />
            : <p className="text-xl sm:text-3xl font-bold text-ink tabular-nums break-words leading-tight">
              <AnimCurrency value={stats?.totalExpenses ?? 0} />
            </p>
          }
        </div>

        {[
          {
            label: 'Tổng tồn kho Kem', icon: Package, accent: 'purple',
            value: stats?.creamStockQty, unit: 'hộp', subValue: stats?.creamStockValue,
          },
          {
            label: 'Tổng tồn kho Gia vị', icon: Package, accent: 'green',
            value: stats?.spiceStockQty, unit: 'kg', subValue: stats?.spiceStockValue,
          },
          {
            label: 'Tổng tồn kho Xúc xích', icon: Package, accent: 'red',
            value: stats?.sausageStockQty, unit: 'kg', subValue: stats?.sausageStockValue,
          },
        ].map((c, i) => (
          <div key={i} className="bg-surface rounded-2xl border border-line-soft shadow-sm p-4 sm:p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] sm:text-xs text-muted font-medium">{c.label}</p>
              <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center shrink-0
                ${c.accent === 'purple' ? 'bg-purple-50 dark:bg-purple-500/10' : c.accent === 'green' ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'bg-red-50 dark:bg-red-500/10'}`}>
                <c.icon size={14} className={
                  c.accent === 'purple' ? 'text-purple-500' : c.accent === 'green' ? 'text-emerald-500' : 'text-red-500'} />
              </div>
            </div>
            {loading
              ? <div className="h-8 rounded-lg bg-surface-2 animate-pulse mt-1" />
              : <p className="text-xl sm:text-3xl font-bold text-ink tabular-nums break-words leading-tight">
                <AnimCompactQty value={c.value ?? 0} /> <span className="text-xs sm:text-sm font-medium text-muted">{c.unit}</span>
              </p>
            }
            {!loading && (
              <p className="text-[10px] sm:text-xs text-muted mt-1 truncate">
                Giá trị: <span className="font-semibold text-ink"><AnimCompactCurrency value={c.subValue ?? 0} /></span>
              </p>
            )}
          </div>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════
           ROW 3 — 2 card debt clickable (full width 2 col)
      ══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {/* Sắp đến hạn */}
        <div
          onClick={() => navigate(`${basePath}/debt-orders`, { state: { type: 'NEARING' } })}
          className="bg-surface rounded-2xl border border-orange-200 dark:border-orange-500/28 shadow-sm p-4 sm:p-5
            cursor-pointer hover:shadow-md hover:-translate-y-0.5 hover:border-gold/60
            active:scale-95 transition-all duration-150"
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] sm:text-xs text-muted font-medium">Sắp đến hạn TT</p>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center">
              <Clock size={14} className="text-orange-500" />
            </div>
          </div>
          {loading
            ? <div className="h-8 rounded-lg bg-surface-2 animate-pulse mt-1" />
            : <p className="text-xl sm:text-3xl font-bold text-orange-500 tabular-nums break-words leading-tight">
              <AnimCurrency value={debtStats?.nearingDeadlineAmount ?? 0} />
            </p>
          }
          <p className="text-[10px] text-gold mt-1.5 font-medium">Nhấn để xem chi tiết →</p>
        </div>

        {/* Quá hạn */}
        <div
          onClick={() => navigate(`${basePath}/debt-orders`, { state: { type: 'OVERDUE' } })}
          className="bg-surface rounded-2xl border border-red-200 dark:border-red-500/28 shadow-sm p-4 sm:p-5
            cursor-pointer hover:shadow-md hover:-translate-y-0.5 hover:border-red-400/60
            active:scale-95 transition-all duration-150"
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] sm:text-xs text-muted font-medium">Công nợ quá hạn</p>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center">
              <AlertTriangle size={14} className="text-red-500" />
            </div>
          </div>
          {loading
            ? <div className="h-8 rounded-lg bg-surface-2 animate-pulse mt-1" />
            : <p className="text-xl sm:text-3xl font-bold text-red-500 tabular-nums break-words leading-tight">
              <AnimCurrency value={debtStats?.overdueAmount ?? 0} />
            </p>
          }
          <p className="text-[10px] text-gold mt-1.5 font-medium">Nhấn để xem chi tiết →</p>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
           ROW 3b — 4 card phân tuổi công nợ chưa thanh toán (theo ngày tạo đơn)
      ══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: 'Công nợ 0 - 30 ngày', value: debtStats?.aging0to30, color: 'text-emerald-600 dark:text-emerald-300', bg: 'bg-emerald-50 dark:bg-emerald-500/10', border: 'border-emerald-200 dark:border-emerald-500/28' },
          { label: 'Công nợ 31 - 60 ngày', value: debtStats?.aging31to60, color: 'text-amber-600 dark:text-amber-300', bg: 'bg-amber-50 dark:bg-amber-500/10', border: 'border-amber-200 dark:border-amber-500/28' },
          { label: 'Công nợ 61 - 90 ngày', value: debtStats?.aging61to90, color: 'text-orange-600 dark:text-orange-300', bg: 'bg-orange-50 dark:bg-orange-500/10', border: 'border-orange-200 dark:border-orange-500/28' },
          { label: 'Công nợ trên 90 ngày', value: debtStats?.aging90plus, color: 'text-red-600 dark:text-red-300', bg: 'bg-red-50 dark:bg-red-500/10', border: 'border-red-200 dark:border-red-500/28' },
        ].map((c, i) => (
          <div key={i} className={`bg-surface rounded-2xl border ${c.border} shadow-sm p-4 sm:p-5`}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] sm:text-xs text-muted font-medium leading-tight">{c.label}</p>
              <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl ${c.bg} flex items-center justify-center shrink-0`}>
                <Clock size={14} className={c.color} />
              </div>
            </div>
            {loading
              ? <div className="h-8 rounded-lg bg-surface-2 animate-pulse mt-1" />
              : <p className={`text-lg sm:text-2xl font-bold tabular-nums break-words leading-tight ${c.color}`}>
                <AnimCurrency value={c.value ?? 0} />
              </p>
            }
          </div>
        ))}
      </div>

      {/* ── Chart + Pie ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Area chart */}
        <div className="lg:col-span-2 bg-surface rounded-2xl border border-line-soft p-4 sm:p-5 shadow-sm outline-none" tabIndex={-1}>
          <div className="mb-3">
            <h3 className="font-bold text-ink">Doanh thu theo kỳ</h3>
            <p className="text-xs text-muted mt-0.5">Chỉ tính đơn đã hoàn thành</p>
          </div>
          {loading ? (
            <div className="h-64 rounded-xl bg-canvas animate-pulse" />
          ) : !stats?.revenueLast30Days?.length ? (
            <div className="flex items-center justify-center h-64 text-sm text-muted">
              Không có dữ liệu
            </div>
          ) : (
            <div className="h-64 -ml-2 outline-none" tabIndex={-1} style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  // Normalize: backend có thể trả về field "date" hoặc "label"
                  onClick={() => { }}
                  style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
                  data={(stats.revenueLast30Days || []).map(d => ({
                    ...d,
                    // Đảm bảo luôn có field "revenue" — backend có thể trả về
                    // successRevenue hoặc revenue
                    revenue: Number(d.revenue ?? d.successRevenue ?? 0),
                    // Đảm bảo luôn có field label cho XAxis
                    date: d.date ?? d.label ?? '',
                  }))}
                  margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--c-gold)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--c-gold)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--c-line-soft)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--c-muted)' }}
                    tickFormatter={v => v?.slice(-5)} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--c-muted)' }}
                    tickFormatter={v => v >= 1_000_000 ? (v / 1_000_000).toFixed(1) + 'M'
                      : v >= 1000 ? (v / 1000).toFixed(0) + 'K' : v}
                    axisLine={false} tickLine={false} width={38} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="revenue" name="revenue"
                    stroke="var(--c-gold)" strokeWidth={2} fill="url(#revGrad)"
                    animationDuration={800} animationEasing="ease-out"
                    activeDot={{ r: 4, fill: 'var(--c-gold)', strokeWidth: 0 }}  // ← dot nhỏ gọn, không có ring
                    dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Pie — label tiếng Việt */}
        <div className="bg-surface rounded-2xl border border-line-soft p-4 sm:p-5 shadow-sm">
          <h3 className="font-bold text-ink mb-3">Phân bố đơn hàng</h3>
          {loading ? (
            <div className="h-64 rounded-xl bg-canvas animate-pulse" />
          ) : pieData.length === 0 ? (
            <EmptyState icon={ShoppingCart} title="Chưa có đơn hàng" />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%" cy="42%"
                    innerRadius={45} outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="label"
                    animationBegin={0} animationDuration={700} animationEasing="ease-out">
                    {pieData.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={ORDER_STATUS_COLOR[entry.name] || FALLBACK_COLOR}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: 10, paddingTop: 8 }}
                    iconType="circle"
                    // Recharts dùng nameKey="label" để hiển thị Legend
                    formatter={(value) => (
                      <span style={{ color: 'var(--c-muted)', fontSize: 10 }}>{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* ── Top products + Top sellers ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <TopProductsTable
          loading={loading} data={topProducts}
          sortBy={productSort} onSort={setProductSort}
        />
        <TopSellersTable
          loading={loading} data={topSellers}
          sortBy={sellerSort} onSort={setSellerSort}
        />
      </div>

      {/* ── Top customers ── */}
      <TopCustomersTable loading={loading} data={topCustomers} />
    </div>
  );
}

// ── Top Products ──────────────────────────────────────────────────────────────
function TopProductsTable({ loading, data, sortBy, onSort }) {
  const { t } = useLang();
  return (
    <div className="bg-surface rounded-2xl border border-line-soft shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-line-soft flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Trophy size={18} className="text-gold" />
          <h3 className="font-bold text-ink">Top 10 sản phẩm bán chạy</h3>
        </div>
        <SortSelect value={sortBy} onChange={onSort} options={[
          { value: 'revenue', label: 'Doanh thu' },
          { value: 'quantity', label: t('common', 'quantity') },
          { value: 'orders', label: 'Số đơn' },
        ]} />
      </div>

      {loading ? (
        <div className="p-5 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 rounded-xl bg-canvas animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
          ))}
        </div>
      ) : data.length === 0 ? (
        <EmptyState icon={Package} title="Chưa có dữ liệu" description="Chưa có đơn hàng hoàn thành nào" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-canvas text-muted">
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider w-8">#</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Sản phẩm</th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider">SL</th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider hidden sm:table-cell">Đơn</th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider">Doanh thu</th>
              </tr>
            </thead>
            <tbody>
              {data.map((p, i) => (
                <tr key={p.productId}
                  className="border-t border-line-soft hover:bg-canvas transition-colors">
                  <td className="px-4 py-3">
                    <span className={`text-xs font-bold ${i === 0 ? 'text-gold' : i === 1 ? 'text-muted' : i === 2 ? 'text-amber-700 dark:text-amber-300' : 'text-faint'}`}>
                      {i + 1}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl overflow-hidden shrink-0 bg-surface-2 border border-line">
                        {p.productImageUrl
                          ? <img src={getImageUrl(p.productImageUrl)} alt="" className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center"><Package size={14} className="text-muted" /></div>
                        }
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-ink text-xs truncate">{p.productName}</p>
                        {p.unit && <p className="text-[10px] text-muted">{p.unit}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-xs font-semibold text-ink tabular-nums">
                    {formatNumber(p.totalQuantitySold)}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-muted hidden sm:table-cell tabular-nums">
                    {formatNumber(p.totalOrders)}
                  </td>
                  <td className="px-4 py-3 text-right text-xs font-bold text-gold tabular-nums">
                    {formatCurrency(p.totalRevenue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Top Sellers ───────────────────────────────────────────────────────────────
function TopSellersTable({ loading, data, sortBy, onSort }) {
  return (
    <div className="bg-surface rounded-2xl border border-line-soft shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-line-soft flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Medal size={18} className="text-gold" />
          <h3 className="font-bold text-ink">Top 10 seller bán chạy</h3>
        </div>
        <SortSelect value={sortBy} onChange={onSort} options={[
          { value: 'revenue', label: 'Doanh thu' },
          { value: 'orders', label: 'Số đơn' },
        ]} />
      </div>

      {loading ? (
        <div className="p-5 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 rounded-xl bg-canvas animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
          ))}
        </div>
      ) : data.length === 0 ? (
        <EmptyState icon={Users} title="Chưa có dữ liệu" description="Chưa có seller nào có đơn hoàn thành" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-canvas text-muted">
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider w-8">#</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Seller</th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider">Đơn</th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider">Doanh thu</th>
              </tr>
            </thead>
            <tbody>
              {data.map((u, i) => (
                <tr key={u.userId}
                  className="border-t border-line-soft hover:bg-canvas transition-colors">
                  <td className="px-4 py-3">
                    <span className={`text-xs font-bold ${i === 0 ? 'text-gold' : i === 1 ? 'text-muted' : i === 2 ? 'text-amber-700 dark:text-amber-300' : 'text-faint'}`}>
                      {i + 1}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gold to-gold-deep
                        flex items-center justify-center text-white text-xs font-bold shrink-0">
                        {(u.fullName || u.username || '?')[0]?.toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-ink text-xs truncate">{u.fullName || u.username}</p>
                        <p className="text-[10px] text-muted">@{u.username}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-xs font-semibold text-ink tabular-nums">
                    {formatNumber(u.totalCompletedOrders)}
                  </td>
                  <td className="px-4 py-3 text-right text-xs font-bold text-gold tabular-nums">
                    {formatCurrency(u.totalRevenue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Top Customers ─────────────────────────────────────────────────────────────
// Expected DTO fields: customerId, customerName, totalOrders, completedOrders, totalSpent
function TopCustomersTable({ loading, data }) {
  return (
    <div className="bg-surface rounded-2xl border border-line-soft shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-line-soft flex items-center gap-2">
        <Crown size={18} className="text-gold" />
        <h3 className="font-bold text-ink">Top 10 khách hàng chi tiêu nhiều nhất</h3>
      </div>

      {loading ? (
        <div className="p-5 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 rounded-xl bg-canvas animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
          ))}
        </div>
      ) : data.length === 0 ? (
        <EmptyState icon={Users} title="Chưa có dữ liệu" description="Chưa có khách hàng nào có đơn hoàn thành" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-canvas text-muted">
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider w-8">#</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Khách hàng</th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider">Đơn hàng</th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider">Tổng chi tiêu</th>
              </tr>
            </thead>
            <tbody>
              {data.map((c, i) => {
                const total = Number(c.totalOrders ?? 0);
                const completed = Number(c.completedOrders ?? c.successOrders ?? 0);
                const spent = Number(c.totalSpent ?? c.totalRevenue ?? 0);
                const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

                return (
                  <tr key={c.customerId ?? i}
                    className="border-t border-line-soft hover:bg-canvas transition-colors">

                    {/* Rank */}
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold
                        ${i === 0 ? 'text-gold' : i === 1 ? 'text-muted'
                          : i === 2 ? 'text-amber-700 dark:text-amber-300' : 'text-faint'}`}>
                        {i + 1}
                      </span>
                    </td>

                    {/* Customer name — wraps if long */}
                    <td className="px-4 py-3 max-w-[160px] sm:max-w-none">
                      <p className="font-semibold text-ink text-xs break-words leading-snug">
                        {c.customerName ?? c.customer_name ?? '—'}
                      </p>
                    </td>

                    {/* Orders + success rate — single column */}
                    <td className="px-4 py-3 text-center">
                      <p className="text-xs font-semibold text-ink tabular-nums">
                        {formatNumber(completed)}
                        <span className="text-faint font-normal">/{formatNumber(total)}</span>
                      </p>
                      <span className={`text-[10px] font-semibold tabular-nums
                        ${rate >= 80 ? 'text-emerald-500' : rate >= 50 ? 'text-amber-500' : 'text-red-400'}`}>
                        {rate}% thành công
                      </span>
                    </td>

                    {/* Total spent — only COMPLETED orders */}
                    <td className="px-4 py-3 text-right">
                      <span className="text-xs font-bold text-gold tabular-nums">
                        {formatCurrency(spent)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}