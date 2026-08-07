import { useLang } from '../../context/LangContext';
import { useState, useEffect, useRef } from 'react';
import { ChartSkeleton, Sk, StatCardSkeleton } from '../../components/ui/Skeleton.jsx';
import useMinLoading from '../../hooks/useMinLoading.js';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  BarChart2, Package, ShoppingCart, DollarSign,
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  RefreshCw, Info,
} from 'lucide-react';
import { analyticsApi } from '../../api/productionApi';
import { PageHeader, formatCurrency } from '../../components/ui';
import { BackButton } from '../../components/common/SubPageNav';

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtM = (n) => {
  const v = Math.round(n || 0);
  if (v >= 1_000_000_000) return (v / 1_000_000_000).toFixed(1) + ' tỷ';
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + ' tr';
  if (v >= 1_000) return (v / 1_000).toFixed(0) + 'k';
  return v.toString();
};

// ── CountUp ───────────────────────────────────────────────────────────────────
function useCountUp(target, duration = 700) {
  const [val, setVal] = useState(0);
  const raf = useRef(null);
  const prev = useRef(0);
  useEffect(() => {
    const end = Number(target) || 0;
    const start = prev.current;
    const t0 = performance.now();
    const ease = t => t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
    cancelAnimationFrame(raf.current);
    const tick = now => {
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

// ── Period selector (same style as Dashboard) ─────────────────────────────────


// ── Stat card matching design system ─────────────────────────────────────────
function AnalyticsStatCard({ label, value, pct, icon: Icon, accent }) {
  const v = useCountUp(Number(value) || 0);
  const accentMap = {
    gold: 'from-gold/15 to-gold/5 text-gold ring-gold/20',
    green: 'from-emerald-500/15 to-emerald-500/5 text-emerald-600 dark:text-emerald-300 ring-emerald-500/20',
    red: 'from-red-500/15 to-red-500/5 text-red-600 dark:text-red-300 ring-red-500/20',
    blue: 'from-blue-500/15 to-blue-500/5 text-blue-600 dark:text-blue-300 ring-blue-500/20',
  };
  const up = pct != null && pct >= 0;
  return (
    <div className="bg-surface rounded-2xl border border-hairline p-4 sm:p-5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-widest text-muted font-semibold truncate">{label}</p>
          <p className="mt-2 text-xl sm:text-2xl font-bold text-ink leading-tight truncate">
            {fmtM(v)}
          </p>
          {pct != null && (
            <div className={`mt-1.5 inline-flex items-center gap-1 text-xs font-medium ${up ? 'text-emerald-600 dark:text-emerald-300' : 'text-red-600 dark:text-red-300'}`}>
              {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
              {up ? '+' : ''}{pct.toFixed(1)}%
            </div>
          )}
        </div>
        {Icon && (
          <div className={`shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br ring-1 flex items-center justify-center ${accentMap[accent]}`}>
            <Icon size={18} />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Forecast card ─────────────────────────────────────────────────────────────
function ForecastStatCard({ label, value, icon: Icon, accent, isCount }) {
  const v = useCountUp(Number(value) || 0);
  const accentMap = {
    gold: 'from-gold/15 to-gold/5 text-gold ring-gold/20',
    green: 'from-emerald-500/15 to-emerald-500/5 text-emerald-600 dark:text-emerald-300 ring-emerald-500/20',
    purple: 'from-violet-500/15 to-violet-500/5 text-violet-600 dark:text-violet-300 ring-violet-500/20',
    blue: 'from-blue-500/15 to-blue-500/5 text-blue-600 dark:text-blue-300 ring-blue-500/20',
  };
  return (
    <div className="bg-sky-50/70 dark:bg-sky-500/7 border border-sky-100 dark:border-sky-500/18 rounded-2xl p-4 sm:p-5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-widest text-sky-400 font-semibold truncate">{label}</p>
          <p className="mt-2 text-xl sm:text-2xl font-bold text-ink leading-tight">{fmtM(v)}</p>
          <p className="text-xs text-sky-400 mt-1 font-medium">Dự đoán kỳ tới</p>
        </div>
        {Icon && (
          <div className={`shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br ring-1 flex items-center justify-center ${accentMap[accent]}`}>
            <Icon size={18} />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tooltip ───────────────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-chrome rounded-xl px-3 py-2.5 shadow-xl text-xs space-y-1 min-w-[140px]">
      <p className="text-gold font-medium mb-1.5">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="text-white/60">{p.name}</span>
          </div>
          <span className="text-white font-semibold">{fmtM(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function OwnerAnalyticsPage() {
  const { t } = useLang();
  const [period, setPeriod] = useState('MONTH');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useMinLoading();

  const PERIODS = [
    { value: 'WEEK', label: t('analytics', 'week') },
    { value: 'MONTH', label: t('analytics', 'month') },
    { value: 'QUARTER', label: t('analytics', 'quarter') },
    { value: 'YEAR', label: t('analytics', 'year'), v: 'YEAR' },
  ];
  const PERIOD_LIST = [
    { value: 'WEEK', label: t('analytics', 'week') },
    { value: 'MONTH', label: t('analytics', 'month') },
    { value: 'QUARTER', label: t('analytics', 'quarter') },
    { value: 'YEAR', label: t('analytics', 'year') },
  ];

  const load = async () => {
    setLoading(true);
    try { setData(await analyticsApi.getBusinessAnalytics(period)); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [period]);

  const historical = data?.historical || [];
  const forecast = data?.forecast;
  const ingForecast = data?.ingredientForecast || [];

  const chartData = [
    ...historical.map(p => ({
      label: p.label,
      'Doanh thu': p.revenue,
      'Lợi nhuận': p.profit,
    })),
    ...(forecast ? [{
      label: forecast.periodLabel,
      'Doanh thu': forecast.forecastRevenue,
      'Lợi nhuận': forecast.forecastProfit,
    }] : []),
  ];

  const expenseData = historical.map(p => ({
    label: p.label,
    'Chi phí': p.expense,
    'Phiếu thu': p.income,
  }));

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5">

      <BackButton fallback={window.location.pathname.startsWith('/owner') ? '/owner/dashboard' : '/admin/dashboard'} />

      {/* ── Header + period selector ─────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <PageHeader
          icon={BarChart2}
          title="Dự báo"
          subtitle="Tổng quan doanh thu, chi phí và dự đoán kỳ tiếp theo"
        />
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex items-center bg-surface border border-line rounded-xl overflow-hidden shadow-sm">
            {PERIOD_LIST.map(p => (
              <button key={p.value} onClick={() => setPeriod(p.value)}
                className={`px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap
                  ${period === p.value
                    ? 'bg-gold text-white'
                    : 'text-muted hover:bg-canvas hover:text-ink'}`}>
                {p.label}
              </button>
            ))}
          </div>
          <button onClick={load}
            className="p-2 bg-surface border border-line rounded-xl hover:bg-canvas shadow-sm">
            <RefreshCw size={15} className={`text-muted ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Stat cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {loading ? [0, 1, 2, 3].map(i => <StatCardSkeleton key={i} />) : (
          <>
            <AnalyticsStatCard label="Doanh thu" value={data?.currentRevenue} pct={data?.revenuePctChange} icon={DollarSign} accent="gold" />
            <AnalyticsStatCard label="Lợi nhuận" value={data?.currentProfit} pct={data?.profitPctChange} icon={TrendingUp} accent="green" />
            <AnalyticsStatCard label="Chi phí" value={data?.currentExpense} pct={null} icon={TrendingDown} accent="red" />
            <AnalyticsStatCard label="Đơn hàng" value={data?.currentOrderCount} pct={data?.orderCountPctChange} icon={ShoppingCart} accent="blue" />
          </>
        )}
      </div>

      {/* ── Forecast skeleton ─────────────────────────────────────────────── */}
      {loading && (
        <div className="space-y-2">
          <Sk className="h-3 w-48" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="bg-sky-50/70 dark:bg-sky-500/7 border border-sky-100 dark:border-sky-500/18 rounded-2xl p-4 sm:p-5 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 space-y-2.5">
                    <Sk className="h-2.5 w-20 bg-sky-100 dark:bg-sky-500/18" />
                    <Sk className="h-7 w-28 bg-sky-100 dark:bg-sky-500/18" />
                    <Sk className="h-2.5 w-16 bg-sky-100 dark:bg-sky-500/18" />
                  </div>
                  <Sk className="w-10 h-10 flex-shrink-0 bg-sky-100 dark:bg-sky-500/18" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Forecast cards (right below stats) ───────────────────────────── */}
      {!loading && forecast && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[11px] font-semibold text-muted uppercase tracking-widest">
              Dự đoán — {forecast.periodLabel}
            </p>
            <span className="text-[10px] bg-gold/10 text-gold px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
              {forecast.method} · {Math.round((forecast.confidence || 0) * 100)}% tin cậy
            </span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <ForecastStatCard label="Doanh thu dự kiến" value={forecast.forecastRevenue} icon={DollarSign} accent="gold" />
            <ForecastStatCard label="Lợi nhuận dự kiến" value={forecast.forecastProfit} icon={TrendingUp} accent="green" />
            <ForecastStatCard label="Chi phí dự kiến" value={forecast.forecastExpense} icon={TrendingDown} accent="purple" />
            <ForecastStatCard label="Đơn hàng dự kiến" value={forecast.forecastOrderCount} icon={ShoppingCart} accent="blue" isCount />
          </div>
        </div>
      )}

      {/* ── Revenue chart ─────────────────────────────────────────────────── */}
      {loading
        ? <ChartSkeleton height={220} />
        : (
          <div className="bg-surface rounded-2xl border border-hairline p-4 sm:p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <p className="font-semibold text-ink text-sm">Xu hướng doanh thu & lợi nhuận</p>
              <span className="flex items-center gap-1 text-[10px] text-gold bg-gold/10 px-2 py-0.5 rounded-full whitespace-nowrap">
                <Info size={10} /> Cột mờ = dự đoán
              </span>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} barGap={4} barCategoryGap="30%"
                margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--c-line)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--c-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={fmtM} tick={{ fontSize: 10, fill: 'var(--c-muted)' }} width={40} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--c-canvas)' }} />
                <Legend wrapperStyle={{ fontSize: 11, color: 'var(--c-muted)' }} />
                <Bar dataKey="Doanh thu" fill="var(--c-gold)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Lợi nhuận" fill="var(--c-success)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

      {/* ── Expense chart ─────────────────────────────────────────────────── */}
      {loading
        ? <ChartSkeleton height={180} />
        : (
          <div className="bg-surface rounded-2xl border border-hairline p-4 sm:p-5 shadow-sm">
            <p className="font-semibold text-ink text-sm mb-4">Chi phí & Phiếu thu theo kỳ</p>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={expenseData}
                margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--c-line)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--c-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={fmtM} tick={{ fontSize: 10, fill: 'var(--c-muted)' }} width={40} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, color: 'var(--c-muted)' }} />
                <Line type="monotone" dataKey="Chi phí" stroke="var(--c-danger)" strokeWidth={2} dot={{ r: 3, fill: 'var(--c-danger)' }} />
                <Line type="monotone" dataKey="Phiếu thu" stroke="var(--c-info)" strokeWidth={2} dot={{ r: 3, fill: 'var(--c-info)' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

      {/* ── Ingredient forecast ───────────────────────────────────────────── */}
      {!loading && ingForecast.length > 0 && (
        <div className="bg-surface rounded-2xl border border-hairline shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-4 sm:px-5 py-3.5 border-b border-hairline bg-canvas flex-wrap">
            <Package size={14} className="text-gold flex-shrink-0" />
            <p className="font-semibold text-ink text-sm">
              Dự đoán NVL cần đặt — {PERIOD_LIST.find(p => p.value === period)?.label} tới
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[400px]">
              <thead>
                <tr className="bg-canvas text-muted">
                  <th className="px-4 sm:px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider">Nguyên liệu</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider hidden sm:table-cell">TB/kỳ</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider">Xu hướng</th>
                  <th className="px-4 sm:px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider">Dự đoán</th>
                </tr>
              </thead>
              <tbody>
                {ingForecast.slice(0, 20).map(ing => {
                  const trend = parseFloat(ing.trendFactor || 0) * 100;
                  const up = trend >= 0;
                  return (
                    <tr key={ing.ingredientId} className="border-t border-hairline hover:bg-canvas/50 transition-colors">
                      <td className="px-4 sm:px-5 py-3 font-medium text-ink">{ing.ingredientName}</td>
                      <td className="px-3 py-3 text-right text-muted hidden sm:table-cell">
                        {parseFloat(ing.avgQtyPerPeriod || 0).toFixed(2)} {ing.unit}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className={`text-xs font-semibold ${up ? 'text-red-600 dark:text-red-300' : 'text-emerald-600 dark:text-emerald-300'}`}>
                          {up ? '+' : ''}{trend.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 sm:px-5 py-3 text-right font-semibold text-ink">
                        {parseFloat(ing.forecastQty || 0).toFixed(2)} {ing.unit}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}