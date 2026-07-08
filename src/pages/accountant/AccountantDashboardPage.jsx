// src/pages/accountant/AccountantDashboardPage.jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  ShoppingBag, TrendingUp, Clock, AlertTriangle,
  Crown, Package, CheckCircle, Truck, ChefHat, Wallet,
  Medal, AlertCircle,
} from 'lucide-react';
import { accountantDashboardApi } from '../../api/accountantApi';
import DateRangePicker, { presetToRange } from '../../components/ui/DateRangePicker';
import { useLang } from '../../context/LangContext';
import useMinLoading from '../../hooks/useMinLoading.js';

// ── Formatters ────────────────────────────────────────────────────────────────
function formatPrice(n) {
  if (!n && n !== 0) return '0 đ';
  const num = Number(n);
  // if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(1).replace('.0', '') + ' tỷ';
  // if (num >= 1_000_000)     return (num / 1_000_000).toFixed(1).replace('.0', '') + ' tr';
  return new Intl.NumberFormat('vi-VN').format(Math.round(num)) + ' đ';
}
function formatPriceFull(n) {
  return new Intl.NumberFormat('vi-VN').format(Math.round(Number(n) || 0)) + ' đ';
}
const fmtNum = (n) => new Intl.NumberFormat('vi-VN').format(Number(n) || 0);

// ── CountUp ───────────────────────────────────────────────────────────────────
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

// ── Chart tooltip ─────────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1C1C1E] rounded-xl px-3 py-2.5 shadow-xl text-xs space-y-1.5 max-w-[220px]">
      <p className="text-white/60 font-medium mb-1">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-white/70 truncate">{p.name}:</span>
          <span className="text-white font-semibold shrink-0">
            {p.value > 1000 ? formatPriceFull(p.value) : fmtNum(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Top Product Row ───────────────────────────────────────────────────────────
function TopProductRow({ p, i, imgUrl, pct }) {
  const animRev = useCountUp(Number(p.totalRevenue), 900);
  const animQty = useCountUp(Number(p.totalQty ?? p.totalQuantitySold ?? 0), 900);
  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <span className={`hidden sm:inline text-xs font-bold w-5 text-right shrink-0
        ${i===0?'text-[#C9A84C]':i===1?'text-[#8E8878]':i===2?'text-amber-700':'text-[#C4B9A8]'}`}>
        {i + 1}
      </span>
      <div className="hidden sm:block w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-[#F0EBE3] overflow-hidden shrink-0">
        {imgUrl
          ? <img src={imgUrl} alt={p.productName} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center text-sm">🍽️</div>
        }
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5 sm:mb-1">
          <p className="text-[11px] sm:text-xs font-semibold text-[#1C1C1E] truncate pr-1">{p.productName}</p>
          <span className="text-[11px] sm:text-xs font-bold text-[#C9A84C] shrink-0 tabular-nums">
            {formatPrice(animRev)}
          </span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="flex-1 h-1.5 bg-[#F0EBE3] rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${pct}%`,
                background: i === 0 ? 'linear-gradient(90deg, #C9A84C, #F5C842)' : '#C9A84C',
              }} />
          </div>
          <span className="text-[9px] sm:text-[10px] text-[#8E8878] shrink-0 tabular-nums">
            {parseFloat(Number(animQty).toFixed(3)).toLocaleString('vi-VN')} sp
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Card 1: Tổng đơn hàng ─────────────────────────────────────────────────────
function OrderSummaryCard({ summary, loading }) {
  const animTotal = useCountUp(summary?.totalOrders ?? 0);
  const statuses = [
    { label: 'Chuẩn bị',   value: summary?.preparingOrders      ?? 0, color: 'text-purple-500', bg: 'bg-purple-100', icon: ChefHat    },
    { label: 'Đang giao',  value: summary?.deliveringOrders     ?? 0, color: 'text-blue-500',   bg: 'bg-blue-100',   icon: Truck      },
    { label: 'Chờ TT',     value: summary?.pendingPaymentOrders ?? 0, color: 'text-orange-500', bg: 'bg-orange-100', icon: Clock      },
    { label: 'Hoàn thành', value: summary?.completedOrders      ?? 0, color: 'text-emerald-500',bg: 'bg-emerald-100',icon: CheckCircle},
  ];
  return (
    <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#F0EBE3] shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] sm:text-xs text-[#8E8878] font-medium">Tổng đơn hàng</p>
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-[#C9A84C]/10 flex items-center justify-center shrink-0">
          <ShoppingBag size={13} className="text-[#C9A84C]" />
        </div>
      </div>
      {loading
        ? <div className="h-8 rounded-lg bg-[#F0EBE3] animate-pulse mb-3" />
        : <p className="text-2xl sm:text-3xl font-bold text-[#1C1C1E] tabular-nums mb-3">
            {fmtNum(Math.round(animTotal))}
          </p>
      }
      <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
        {statuses.map(({ label, value, color, bg, icon: Icon }) => (
          <div key={label} className={`rounded-xl px-1.5 py-2 ${bg} flex flex-col items-center gap-1`}>
            <Icon size={12} className={color} />
            <p className={`text-xs font-bold tabular-nums leading-tight ${color}`}>
              {loading ? '…' : fmtNum(value)}
            </p>
            <p className="text-[9px] text-[#8E8878] font-medium leading-tight text-center whitespace-nowrap">
              {label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Card 2: Tổng doanh thu ────────────────────────────────────────────────────
function RevenueSummaryCard({ summary, loading }) {
  const animTotal      = useCountUp(Number(summary?.totalRevenue      ?? 0));
  const animProcessing = useCountUp(Number(summary?.processingAmount  ?? 0));
  const animCollected  = useCountUp(Number(summary?.collectedRevenue  ?? 0));
  const animUncoll     = useCountUp(Number(summary?.uncollectedRevenue ?? 0));

  const rows = [
    { label: 'Đang xử lý', icon: Truck,       val: animProcessing, bg: 'bg-blue-50',    text: 'text-blue-600'    },
    { label: 'Đã thu',     icon: Wallet,      val: animCollected,  bg: 'bg-emerald-50', text: 'text-emerald-600' },
    { label: 'Chưa thu',   icon: Clock,       val: animUncoll,     bg: 'bg-amber-50',   text: 'text-amber-600'   },
  ];
  return (
    <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#F0EBE3] shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] sm:text-xs text-[#8E8878] font-medium">Tổng doanh thu</p>
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
          <TrendingUp size={13} className="text-emerald-500" />
        </div>
      </div>
      {loading
        ? <div className="h-8 rounded-lg bg-[#F0EBE3] animate-pulse mb-3" />
        : <p className="text-base sm:text-xl font-bold text-[#1C1C1E] tabular-nums mb-3">
            {formatPrice(animTotal)}
          </p>
      }
      <div className="space-y-1.5">
        {rows.map((r, i) => (
          <div key={i} className={`flex items-center justify-between rounded-xl ${r.bg} px-3 py-2`}>
            <div className="flex items-center gap-1.5">
              <r.icon size={11} className={r.text} />
              <span className={`text-xs font-medium ${r.text}`}>{r.label}</span>
            </div>
            <span className={`text-xs font-bold tabular-nums ${r.text}`}>
              {loading ? '…' : formatPrice(r.val)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Card 3 & 4: Công nợ (clickable) ──────────────────────────────────────────
function DebtCard({ label, icon: Icon, value, accent, loading, onClick }) {
  const map = {
    orange: { bg: 'bg-orange-50', ico: 'text-orange-500', val: 'text-orange-500', border: 'border-orange-200' },
    red:    { bg: 'bg-red-50',    ico: 'text-red-500',    val: 'text-red-500',    border: 'border-red-200'    },
  };
  const cls = map[accent] ?? map.orange;
  const animVal = useCountUp(Number(value ?? 0));
  return (
    <div onClick={onClick}
      className={`bg-white rounded-2xl p-4 sm:p-5 border shadow-sm transition-all cursor-pointer
        hover:shadow-md hover:-translate-y-0.5 active:scale-95 ${cls.border}`}>
      <div className="flex items-center justify-between mb-2 sm:mb-3">
        <p className="text-[10px] sm:text-xs text-[#8E8878] font-medium leading-tight">{label}</p>
        <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center shrink-0 ${cls.bg}`}>
          <Icon size={13} className={cls.ico} />
        </div>
      </div>
      {loading
        ? <div className="h-8 rounded-lg bg-[#F0EBE3] animate-pulse" />
        : <p className={`text-base sm:text-xl font-bold tabular-nums ${cls.val}`}>
            {formatPrice(animVal)}
          </p>
      }
      {!loading && <p className="text-[10px] text-[#C9A84C] mt-1.5 font-medium">Nhấn để xem chi tiết →</p>}
    </div>
  );
}

// ── Hàng card mới: phân tuổi công nợ chưa thanh toán (theo ngày tạo đơn) ──────
function AgingCard({ label, value, accent, loading }) {
  const map = {
    green:  { bg: 'bg-emerald-50', ico: 'text-emerald-600', border: 'border-emerald-200' },
    amber:  { bg: 'bg-amber-50',   ico: 'text-amber-600',   border: 'border-amber-200' },
    orange: { bg: 'bg-orange-50',  ico: 'text-orange-600',  border: 'border-orange-200' },
    red:    { bg: 'bg-red-50',     ico: 'text-red-600',     border: 'border-red-200' },
  };
  const cls = map[accent] ?? map.green;
  const animVal = useCountUp(Number(value ?? 0));
  return (
    <div className={`bg-white rounded-2xl p-4 sm:p-5 border shadow-sm ${cls.border}`}>
      <div className="flex items-center justify-between mb-2 sm:mb-3">
        <p className="text-[10px] sm:text-xs text-[#8E8878] font-medium leading-tight">{label}</p>
        <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center shrink-0 ${cls.bg}`}>
          <Clock size={13} className={cls.ico} />
        </div>
      </div>
      {loading
        ? <div className="h-8 rounded-lg bg-[#F0EBE3] animate-pulse" />
        : <p className={`text-base sm:text-xl font-bold tabular-nums ${cls.ico}`}>{formatPrice(animVal)}</p>
      }
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AccountantDashboardPage() {
  const { t } = useLang();
  const navigate = useNavigate();

  const [preset,       setPreset]       = useState('today');
  const [range,        setRange]        = useState(() => presetToRange('today'));
  const [summary,      setSummary]      = useState(null);
  const [chartData,    setChartData]    = useState([]);
  const [topProducts,  setTopProducts]  = useState([]);
  const [topSellers,   setTopSellers]   = useState([]);
  const [topCustomers, setTopCustomers] = useState([]);
  const [loading, setLoading] = useMinLoading();
  const [error,   setError]   = useState(null);

  const basePath = window.location.pathname.split('/').slice(0, 2).join('/');
  const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

  const groupByFromRange = (r) => {
    if (!r) return 'DAY';
    const diff = r.to - r.from;
    if (diff <= 86_400_000)      return 'HOUR';
    if (diff <= 32 * 86_400_000) return 'DAY';
    return 'MONTH';
  };

  const load = useCallback(async (r) => {
    if (!r) return;
    setLoading(true); setError(null);
    try {
      const [s, c, tp, ts, tc] = await Promise.all([
        accountantDashboardApi.getSummary(r.from, r.to),
        accountantDashboardApi.getChart(r.from, r.to, groupByFromRange(r)),
        accountantDashboardApi.getTopProducts(r.from, r.to, 10),
        accountantDashboardApi.getTopSellers(r.from, r.to, 10).catch(() => []),
        accountantDashboardApi.getTopCustomers(r.from, r.to, 10).catch(() => []),
      ]);
      setSummary(s); setChartData(c || []);
      setTopProducts(tp || []); setTopSellers(ts || []);
      setTopCustomers(tc || []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(range); }, [range]);

  const maxRevenue = Number(topProducts[0]?.totalRevenue) || 1;

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 min-h-full bg-[#FAF7F2]">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#1C1C1E]">Dashboard</h1>
          <p className="text-xs text-[#8E8878] mt-0.5">Tổng quan doanh thu & đơn hàng</p>
        </div>
        {loading && (
          <div className="flex items-center gap-2 text-xs text-[#8E8878]">
            <div className="w-4 h-4 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
            <span className="hidden sm:inline">Đang tải...</span>
          </div>
        )}
      </div>

      {/* Date picker */}
      <div className="bg-white rounded-2xl border border-[#F0EBE3] px-4 py-3 shadow-sm">
        <DateRangePicker preset={preset} onPreset={setPreset} onRangeChange={setRange} />
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-xs sm:text-sm text-red-600">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {/* Row 1: Card đơn + Card doanh thu — stack mobile, 2 cột từ sm */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <OrderSummaryCard summary={summary} loading={loading} />
        <RevenueSummaryCard summary={summary} loading={loading} />
      </div>

      {/* Row 2: Công nợ — luôn 2 cột */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <DebtCard
          label="Công nợ gần đến hạn" icon={Clock}
          value={summary?.nearingDeadlineAmount} accent="orange" loading={loading}
          onClick={() => navigate(`${basePath}/debt-orders`, { state: { type: 'NEARING' } })}
        />
        <DebtCard
          label="Công nợ quá hạn" icon={AlertTriangle}
          value={summary?.overdueAmount} accent="red" loading={loading}
          onClick={() => navigate(`${basePath}/debt-orders`, { state: { type: 'OVERDUE' } })}
        />
      </div>

      {/* Row 2b: Phân tuổi công nợ chưa thanh toán — 4 cột (theo ngày tạo đơn) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <AgingCard label="Công nợ 0 - 30 ngày"  value={summary?.aging0to30}  accent="green"  loading={loading} />
        <AgingCard label="Công nợ 31 - 60 ngày" value={summary?.aging31to60} accent="amber"  loading={loading} />
        <AgingCard label="Công nợ 61 - 90 ngày" value={summary?.aging61to90} accent="orange" loading={loading} />
        <AgingCard label="Công nợ trên 90 ngày" value={summary?.aging90plus} accent="red"    loading={loading} />
      </div>

      {/* Chart */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#F0EBE3] shadow-sm">
        <h2 className="text-xs sm:text-sm font-semibold text-[#1C1C1E] mb-4">
          Biểu đồ đơn hàng & Doanh thu
        </h2>
        {loading ? (
          <div className="h-52 rounded-xl bg-[#FAF7F2] animate-pulse" />
        ) : chartData.length === 0 ? (
          <div className="flex items-center justify-center h-44 text-sm text-[#8E8878]">Không có dữ liệu</div>
        ) : (
          <div style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={chartData}
                margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                barCategoryGap="30%" barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0EBE3" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#8E8878' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left"  tick={{ fontSize: 10, fill: '#8E8878' }} allowDecimals={false} width={25} axisLine={false} tickLine={false} />
                <YAxis yAxisId="right" orientation="right"
                  tickFormatter={v => v >= 1_000_000 ? (v / 1_000_000).toFixed(0) + 'M' : v}
                  tick={{ fontSize: 10, fill: '#8E8878' }} width={38} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Legend formatter={v => <span style={{ fontSize: 10, color: '#8E8878' }}>{v}</span>} />
                <Bar yAxisId="left"  dataKey="pendingCount"  name="Đang xử lý"  fill="#F5C842" radius={[4,4,0,0]} barSize={14} />
                <Bar yAxisId="left"  dataKey="successCount"  name="Hoàn thành"  fill="#34C759" radius={[4,4,0,0]} barSize={14} />
                <Line yAxisId="right" type="linear" dataKey="pendingRevenue" name="DT Đang xử lý" stroke="#E8A020" strokeWidth={2} dot={false} activeDot={{ r:3, fill:'#E8A020', strokeWidth:0 }} />
                <Line yAxisId="right" type="linear" dataKey="successRevenue" name="DT Hoàn thành"  stroke="#1A9E4A" strokeWidth={2} dot={false} activeDot={{ r:3, fill:'#1A9E4A', strokeWidth:0 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Top products + Top sellers — 2 cột bằng nhau */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-5 xl:items-stretch">

        {/* Top products */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#F0EBE3] shadow-sm flex flex-col">
          <div className="flex items-center gap-2 mb-3 sm:mb-4 shrink-0">
            <Package size={16} className="text-[#C9A84C]" />
            <h2 className="text-xs sm:text-sm font-semibold text-[#1C1C1E]">Món bán chạy nhất</h2>
          </div>
          {loading ? (
            <div className="space-y-3">{[...Array(5)].map((_, i) => (
              <div key={i} className="h-11 rounded-xl bg-[#FAF7F2] animate-pulse" style={{ animationDelay: `${i*80}ms` }} />
            ))}</div>
          ) : topProducts.length === 0 ? (
            <p className="text-sm text-[#8E8878] text-center py-6">Không có dữ liệu</p>
          ) : (
            <div className="flex flex-col flex-1 justify-between">
              {topProducts.map((p, i) => {
                const imgUrl = p.imageUrl
                  ? p.imageUrl.startsWith('http') ? p.imageUrl : `${BASE_URL}/api/auth${p.imageUrl}`
                  : null;
                const pct = Math.round((Number(p.totalRevenue) / maxRevenue) * 100);
                return <TopProductRow key={p.productId ?? i} p={p} i={i} imgUrl={imgUrl} pct={pct} />;
              })}
            </div>
          )}
        </div>

        {/* Top sellers */}
        <div className="bg-white rounded-2xl border border-[#F0EBE3] shadow-sm overflow-hidden flex flex-col">
          <div className="px-4 sm:px-5 py-4 border-b border-[#F0EBE3] flex items-center gap-2 shrink-0">
            <Medal size={16} className="text-[#C9A84C]" />
            <h2 className="text-xs sm:text-sm font-semibold text-[#1C1C1E]">Top seller bán chạy</h2>
          </div>
          {loading ? (
            <div className="p-4 space-y-3">{[...Array(5)].map((_, i) => (
              <div key={i} className="h-11 rounded-xl bg-[#FAF7F2] animate-pulse" style={{ animationDelay: `${i*80}ms` }} />
            ))}</div>
          ) : topSellers.length === 0 ? (
            <p className="text-sm text-[#8E8878] text-center py-8">Không có dữ liệu</p>
          ) : (
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-sm h-full">
                <thead>
                  <tr className="bg-[#FAF7F2] text-[#8E8878]">
                    <th className="hidden sm:table-cell px-4 py-3 text-left text-xs font-bold uppercase tracking-wider w-8">#</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Seller</th>
                    <th className="hidden sm:table-cell px-4 py-3 text-right text-xs font-bold uppercase tracking-wider">Đơn</th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider">Doanh thu</th>
                  </tr>
                </thead>
                <tbody>
                  {topSellers.map((u, i) => (
                    <tr key={u.userId ?? i} className="border-t border-[#F0EBE3] hover:bg-[#FAF7F2] transition-colors">
                      <td className="hidden sm:table-cell px-4 py-3">
                        <span className={`text-xs font-bold ${i===0?'text-[#C9A84C]':i===1?'text-[#8E8878]':i===2?'text-amber-700':'text-[#C4B9A8]'}`}>{i+1}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#C9A84C] to-[#A07830] flex items-center justify-center text-white text-xs font-bold shrink-0">
                            {(u.fullName || u.username || '?')[0]?.toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-[#1C1C1E] text-xs truncate">{u.fullName || u.username}</p>
                            {u.username && <p className="text-[10px] text-[#8E8878]">@{u.username}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="hidden sm:table-cell px-4 py-3.5 text-right text-xs font-semibold text-[#1C1C1E] tabular-nums">
                        {fmtNum(u.totalCompletedOrders)}
                      </td>
                      <td className="px-4 py-3.5 text-right text-xs font-bold text-[#C9A84C] tabular-nums">
                        {formatPrice(Number(u.totalRevenue))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Top customers — full width */}
      {/* <div className="bg-white rounded-2xl border border-[#F0EBE3] shadow-sm overflow-hidden">
        <div className="px-4 sm:px-5 py-4 border-b border-[#F0EBE3] flex items-center gap-2">
          <Crown size={16} className="text-[#C9A84C]" />
          <h2 className="text-xs sm:text-sm font-semibold text-[#1C1C1E]">Khách hàng chi tiêu nhiều nhất</h2>
        </div>
        {loading ? (
          <div className="p-4 space-y-3">{[...Array(5)].map((_, i) => (
            <div key={i} className="h-11 rounded-xl bg-[#FAF7F2] animate-pulse" style={{ animationDelay: `${i*80}ms` }} />
          ))}</div>
        ) : topCustomers.length === 0 ? (
          <p className="text-sm text-[#8E8878] text-center py-8">Không có dữ liệu</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#FAF7F2] text-[#8E8878]">
                  <th className="hidden sm:table-cell px-4 py-3 text-left text-xs font-bold uppercase tracking-wider w-8">#</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Khách hàng</th>
                  <th className="hidden sm:table-cell px-4 py-3 text-center text-xs font-bold uppercase tracking-wider">Đơn hàng</th>
                  <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider">Tổng chi tiêu</th>
                </tr>
              </thead>
              <tbody>
                {topCustomers.map((c, i) => {
                  const total     = Number(c.totalOrders     ?? 0);
                  const completed = Number(c.completedOrders ?? 0);
                  const spent     = Number(c.totalSpent      ?? c.totalRevenue ?? 0);
                  const rate      = total > 0 ? Math.round((completed / total) * 100) : 0;
                  return (
                    <tr key={c.customerId ?? i} className="border-t border-[#F0EBE3] hover:bg-[#FAF7F2] transition-colors">
                      <td className="hidden sm:table-cell px-4 py-3.5">
                        <span className={`text-xs font-bold ${i===0?'text-[#C9A84C]':i===1?'text-[#8E8878]':i===2?'text-amber-700':'text-[#C4B9A8]'}`}>{i+1}</span>
                      </td>
                      <td className="px-4 py-3.5 max-w-[150px] sm:max-w-none">
                        <p className="font-semibold text-[#1C1C1E] text-xs truncate sm:break-words sm:whitespace-normal leading-snug">
                          {c.customerName ?? '—'}
                        </p>
                        {c.customerPhone && (
                          <p className="text-[10px] text-[#8E8878]">{c.customerPhone}</p>
                        )}
                      </td>
                      <td className="hidden sm:table-cell px-4 py-3.5 text-center">
                        <p className="text-xs font-semibold text-[#1C1C1E] tabular-nums">
                          {fmtNum(completed)}<span className="text-[#C4B9A8] font-normal">/{fmtNum(total)}</span>
                        </p>
                        <span className={`text-[10px] font-semibold tabular-nums
                          ${rate>=80?'text-emerald-500':rate>=50?'text-amber-500':'text-red-400'}`}>
                          {rate}% thành công
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className="text-xs font-bold text-[#C9A84C] tabular-nums">
                          {formatPrice(spent)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div> */}
    </div>
  );
}