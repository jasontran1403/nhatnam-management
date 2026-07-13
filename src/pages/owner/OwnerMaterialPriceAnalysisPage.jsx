// src/pages/owner/OwnerMaterialPriceAnalysisPage.jsx
//
// Phân tích giá 1 nguyên liệu — GỘP ĐA-NHÀ-CUNG-CẤP theo tên nguyên liệu.
// Mở từ Sản xuất → Tồn kho nguyên liệu (nút "Phân tích giá" trên card — Phase B).
// Đọc tên nguyên liệu từ query param ?name=...
//
// Khác bản cũ (modal trong Quản lý NCC, chỉ 1 NCC):
//  • Gộp dữ liệu giá từ TẤT CẢ nhà cung cấp cùng bán tên nguyên liệu này.
//  • Card Giá thấp nhất / cao nhất hiển thị thêm tên NCC + thời điểm mua.
//  • Bảng lịch sử giá có cột NCC, cho sort theo Đơn giá / Số lượng / Ngày.
//    Không phân trang (hiển thị toàn bộ).
import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ChevronLeft, TrendingUp, TrendingDown, Minus, BarChart3,
  Building2, ArrowUpDown, ArrowUp, ArrowDown,
} from 'lucide-react';
import { PageHeader, EmptyState } from '../../components/ui';
import { ownerMaterialStockApi, ownerExpenseCategoryApi } from '../../api/materialRequestApi.js';
import { useLang } from '../../context/LangContext';
import { useFmt } from '../../utils/useFmt';

export default function OwnerMaterialPriceAnalysisPage() {
  const navigate = useNavigate();
  const { t } = useLang();
  const { fmtCurrency, fmtNum, fmtDate } = useFmt();
  const money = (v) => fmtCurrency(v);
  const qtyFmt = (v) => (v == null ? '—' : fmtNum(v, 3));
  const [params] = useSearchParams();
  const name = params.get('name') || '';
  // kind: MATERIAL (mặc định — mở từ Tồn kho NL) | EXPENSE (khoản chi/dịch vụ)
  const kind = (params.get('kind') || 'MATERIAL').toUpperCase();
  // from=categories → mở từ trang "Phân tích danh mục chi" (đổi đích nút Quay lại)
  const from = params.get('from') || '';
  const isExpense = kind === 'EXPENSE';

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    // Khoản chi dùng endpoint danh mục chi; nguyên liệu giữ nguyên endpoint cũ.
    const fetcher = isExpense
      ? ownerExpenseCategoryApi.getAnalysis(name, 'EXPENSE')
      : ownerMaterialStockApi.getPriceAnalysis(name);
    fetcher
      .then(d => { if (alive) setStats(d); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [name, isExpense]);

  const trend = stats?.priceTrendPct;
  const TrendIcon = trend == null || Number(trend) === 0 ? Minus
    : Number(trend) > 0 ? TrendingUp : TrendingDown;
  const trendColor = trend == null || Number(trend) === 0 ? 'text-[#8E8878]'
    : Number(trend) > 0 ? 'text-red-600' : 'text-emerald-600';

  const back = () => navigate(from === 'categories'
    ? '/owner/production/expense-categories'
    : '/owner/production/material-stock');
  const backLabel = from === 'categories'
    ? 'Quay lại phân tích danh mục chi'
    : t('production', 'mprice_back');

  const vendorTimeHint = (vendor, at) => {
    const d = at ? fmtDate(at) : '';
    if (vendor && d) return `${vendor} · ${d}`;
    return vendor || d || '';
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5">
      <button onClick={back}
        className="flex items-center gap-1.5 text-sm text-[#8E8878] hover:text-[#1C1C1E] font-medium">
        <ChevronLeft size={16} /> {backLabel}
      </button>

      <PageHeader icon={BarChart3}
        title={stats?.materialName || name || t('production', 'mprice_title')}
        subtitle={
          stats && stats.purchaseCount > 0
            ? t('production', 'mprice_subtitle_stats', {
                purchases: stats.purchaseCount, vendors: stats.vendorCount, unit: stats.unit,
              })
            : t('production', 'mprice_subtitle_default')
        } />

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-16 bg-[#FAF7F2] rounded-xl animate-pulse" />)}</div>
      ) : !stats || stats.purchaseCount === 0 ? (
        <EmptyState icon={BarChart3}
          title={t('production', 'mprice_empty_title')}
          description={t('production', 'mprice_empty_desc')} />
      ) : (
        <div className="space-y-5">
          {/* Giá gần nhất + xu hướng */}
          <div className="bg-gradient-to-r from-[#FAF7F2] to-white rounded-2xl border border-[#E8DDD0] p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-[#8E8878]">{t('production', 'mprice_latest')}</p>
              <p className="text-2xl font-bold text-[#1C1C1E] mt-0.5">{money(stats.latestPrice)}</p>
              <p className="text-[11px] text-[#8E8878] mt-0.5">
                {fmtDate(stats.latestAt)}
                {stats.latestVendorName ? ` · ${stats.latestVendorName}` : ''}
              </p>
            </div>
            {trend != null ? (
              <div className={`flex flex-col items-end ${trendColor}`}>
                <div className="flex items-center gap-1 text-lg font-bold">
                  <TrendIcon size={18} />
                  {Number(trend) > 0 ? '+' : ''}{trend}%
                </div>
                <p className="text-[11px] text-[#8E8878]">{t('production', 'mprice_vs_first')}</p>
              </div>
            ) : (
              // Chưa có lần trước để so sánh (mới mua/chi đúng 1 lần)
              <p className="text-[11px] text-[#8E8878] italic">
                {isExpense ? t('production', 'mprice_first_expense') : t('production', 'mprice_first_purchase')}
              </p>
            )}
          </div>

          {/* Lưới chỉ số chính */}
          <div className="grid grid-cols-2 gap-3">
            <PriceCell
              label={isExpense ? 'Trung bình mỗi lần chi' : t('production', 'mprice_avg_weighted')}
              value={money(stats.avgPrice)}
              hint={isExpense ? 'Tổng tiền đã chi / số lần chi' : t('production', 'mprice_avg_weighted_hint')}
              accent />
            <PriceCell label={t('production', 'mprice_median')} value={money(stats.medianPrice)}
              hint={t('production', 'mprice_median_hint')} />
            <PriceCell label={t('production', 'mprice_min')} value={money(stats.minPrice)}
              hint={vendorTimeHint(stats.minVendorName, stats.minAt)} good />
            <PriceCell label={t('production', 'mprice_max')} value={money(stats.maxPrice)}
              hint={vendorTimeHint(stats.maxVendorName, stats.maxAt)} bad />
          </div>

          {/* Chỉ số bổ trợ */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <MiniStat label={t('production', 'mprice_simple_avg')} value={money(stats.simpleAvgPrice)} />
            <MiniStat label={t('production', 'mprice_prev_price')}
              value={stats.prevPrice != null ? money(stats.prevPrice) : '—'}
              sub={stats.prevPrice != null ? vendorTimeHint(stats.prevVendorName, stats.prevAt) : '—'} />
            <MiniStat label={t('production', 'mprice_first_price')} value={money(stats.firstPrice)}
              sub={vendorTimeHint(stats.firstVendorName, stats.firstAt)} />
            <MiniStat label={t('production', 'mprice_volatility')}
              value={stats.volatilityPct != null ? `${stats.volatilityPct}%` : '—'}
              sub={t('production', 'mprice_volatility_hint')} />
            <MiniStat
              label={isExpense ? 'Số lần đã chi' : t('production', 'mprice_total_bought')}
              value={isExpense
                ? `${stats.purchaseCount} lần`
                : `${qtyFmt(stats.totalQuantity)} ${stats.unit}`} />
            <MiniStat
              label={isExpense ? 'Tổng tiền đã chi' : t('production', 'mprice_total_spent')}
              value={money(stats.totalSpent)} />
            <MiniStat label={t('production', 'mprice_vendor_count')} value={stats.vendorCount} />
          </div>

          {/* Mini biểu đồ giá theo thời gian */}
          {stats.points.length > 1 && <PriceSparkline points={stats.points} />}

          {/* Bảng lịch sử giá — có cột NCC, cho sort, không phân trang */}
          <PriceHistoryTable stats={stats} />
        </div>
      )}
    </div>
  );
}

// ── Bảng lịch sử giá (sortable, không phân trang) ────────────────────────────
function PriceHistoryTable({ stats }) {
  const { t } = useLang();
  const { fmtCurrency, fmtNum, fmtDate } = useFmt();
  const money = (v) => fmtCurrency(v);
  const qtyFmt = (v) => (v == null ? '—' : fmtNum(v, 3));
  const [sortKey, setSortKey] = useState('date'); // 'date' | 'price' | 'qty'
  const [sortDir, setSortDir] = useState('desc'); // 'asc' | 'desc'

  const toggle = (key) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      // mặc định: ngày & giá & SL đều bắt đầu từ giảm dần cho trực quan
      setSortDir('desc');
    }
  };

  const rows = useMemo(() => {
    const arr = [...(stats.points || [])];
    const dir = sortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      let av, bv;
      if (sortKey === 'price') { av = Number(a.unitPrice); bv = Number(b.unitPrice); }
      else if (sortKey === 'qty') { av = Number(a.quantity || 0); bv = Number(b.quantity || 0); }
      else { av = Number(a.at || 0); bv = Number(b.at || 0); }
      if (av === bv) return 0;
      return av > bv ? dir : -dir;
    });
    return arr;
  }, [stats.points, sortKey, sortDir]);

  const SortHeader = ({ label, keyName, align = 'left' }) => {
    const active = sortKey === keyName;
    const Icon = !active ? ArrowUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown;
    return (
      <th className={`px-3 py-2 text-xs font-semibold uppercase select-none ${align === 'right' ? 'text-right' : 'text-left'}`}>
        <button onClick={() => toggle(keyName)}
          className={`inline-flex items-center gap-1 hover:text-[#C9A84C] transition-colors ${active ? 'text-[#C9A84C]' : ''} ${align === 'right' ? 'flex-row-reverse' : ''}`}>
          {label} <Icon size={12} />
        </button>
      </th>
    );
  };

  return (
    <div>
      <p className="text-xs font-semibold text-[#8E8878] uppercase tracking-wider mb-2">
        {t('production', 'mprice_history_title', { n: rows.length })}
      </p>
      <div className="rounded-xl border border-black/5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#FAF7F2] text-[#8E8878]">
              <SortHeader label={t('common', 'date')} keyName="date" />
              <th className="text-left px-3 py-2 text-xs font-semibold uppercase">{t('production', 'mprice_col_request')}</th>
              <th className="text-left px-3 py-2 text-xs font-semibold uppercase">{t('production', 'metrics_vendor')}</th>
              <SortHeader label={t('production', 'mprice_col_unit_price')} keyName="price" align="right" />
              <SortHeader label={t('production', 'mprice_col_qty')} keyName="qty" align="right" />
            </tr>
          </thead>
          <tbody>
            {rows.map((p, i) => {
              const isMin = Number(p.unitPrice) === Number(stats.minPrice);
              const isMax = Number(p.unitPrice) === Number(stats.maxPrice);
              return (
                <tr key={i} className="border-t border-[#F0EBE3]">
                  <td className="px-3 py-2 text-[#8E8878] whitespace-nowrap">{fmtDate(p.at)}</td>
                  <td className="px-3 py-2 font-mono text-xs text-[#C9A84C] whitespace-nowrap">{p.requestCode}</td>
                  <td className="px-3 py-2 text-[#1C1C1E]">
                    <span className="inline-flex items-center gap-1.5">
                      <Building2 size={12} className="text-[#8E8878] flex-shrink-0" />
                      {p.vendorName || '—'}
                    </span>
                  </td>
                  <td className={`px-3 py-2 text-right font-semibold whitespace-nowrap ${isMin ? 'text-emerald-600' : isMax ? 'text-red-600' : 'text-[#1C1C1E]'}`}>
                    {money(p.unitPrice)}
                    {isMin && <span className="ml-1 text-[10px]">▼</span>}
                    {isMax && <span className="ml-1 text-[10px]">▲</span>}
                  </td>
                  <td className="px-3 py-2 text-right text-[#8E8878] whitespace-nowrap">{qtyFmt(p.quantity)} {p.unit}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PriceCell({ label, value, hint, accent, good, bad }) {
  const color = good ? 'text-emerald-600' : bad ? 'text-red-600' : accent ? 'text-[#C9A84C]' : 'text-[#1C1C1E]';
  return (
    <div className="bg-[#FAF7F2] rounded-xl p-3">
      <p className="text-xs text-[#8E8878]">{label}</p>
      <p className={`text-lg font-bold mt-0.5 ${color}`}>{value}</p>
      {hint && <p className="text-[11px] text-[#8E8878] mt-0.5">{hint}</p>}
    </div>
  );
}

function MiniStat({ label, value, sub }) {
  return (
    <div className="border border-black/5 rounded-xl p-2.5">
      <p className="text-[11px] text-[#8E8878]">{label}</p>
      <p className="text-sm font-semibold text-[#1C1C1E] mt-0.5">{value}</p>
      {sub && <p className="text-[10px] text-[#8E8878] mt-0.5">{sub}</p>}
    </div>
  );
}

// Mini biểu đồ đường (SVG thuần)
function PriceSparkline({ points }) {
  const { t } = useLang();
  const { fmtDate } = useFmt();
  const { path, dots } = useMemo(() => {
    const W = 300, H = 80, PAD = 6;
    const prices = points.map(p => Number(p.unitPrice));
    const min = Math.min(...prices), max = Math.max(...prices);
    const range = max - min || 1;
    const n = points.length;
    const xy = points.map((p, i) => {
      const x = PAD + (i / (n - 1)) * (W - 2 * PAD);
      const y = H - PAD - ((Number(p.unitPrice) - min) / range) * (H - 2 * PAD);
      return { x, y };
    });
    const path = xy.map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(' ');
    return { path, dots: xy };
  }, [points]);

  return (
    <div>
      <p className="text-xs font-semibold text-[#8E8878] uppercase tracking-wider mb-2">
        {t('production', 'mprice_sparkline_title')}
      </p>
      <div className="bg-[#FAF7F2] rounded-xl p-3">
        <svg viewBox="0 0 300 80" className="w-full h-20" preserveAspectRatio="none">
          <path d={path} fill="none" stroke="#C9A84C" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          {dots.map((d, i) => (
            <circle key={i} cx={d.x} cy={d.y} r="2.5" fill="#C9A84C" />
          ))}
        </svg>
        <div className="flex items-center justify-between text-[11px] text-[#8E8878] mt-1">
          <span>{fmtDate(points[0].at)}</span>
          <span>{fmtDate(points[points.length - 1].at)}</span>
        </div>
      </div>
    </div>
  );
}