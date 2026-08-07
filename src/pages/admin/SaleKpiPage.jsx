// src/pages/admin/SaleKpiPage.jsx
import { useLang } from '../../context/LangContext';
import { useEffect, useState, useCallback } from 'react';
import { TableSkeleton } from '../../components/ui/Skeleton.jsx';
import useMinLoading from '../../hooks/useMinLoading.js';
import {
  TrendingUp, DollarSign, ShoppingBag, Users, UserPlus, UserCheck,
  CreditCard, AlertCircle, Clock, RefreshCw, Trophy, Package,
} from 'lucide-react';
import { adminSaleKpiApi } from '../../api/adminApi';
import Modal from '../../components/ui/Modal';
import { useToast } from '../../components/common/Toast';
import DateRangePicker, { presetToRange } from '../../components/ui/DateRangePicker';
import { PageHeader, formatCurrency, formatNumber } from '../../components/ui';
import { BackButton } from '../../components/common/SubPageNav';
import { withAlpha } from '../../config/chartPalette';

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n) { return formatCurrency(Number(n) || 0); }
function fmtNum(n) { return formatNumber(Number(n) || 0); }

// ── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, sub, accent = 'var(--c-gold)', bg = 'bg-surface' }) {
  return (
    <div className={`${bg} rounded-2xl border border-hairline shadow-sm p-5 flex flex-col gap-3`}>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center"
        style={{ background: withAlpha(accent, 9) }}>
        <Icon size={18} style={{ color: accent }} />
      </div>
      <div>
        <p className="text-[22px] font-bold text-ink leading-tight">{value}</p>
        <p className="text-sm text-muted mt-0.5">{label}</p>
        {sub && <p className="text-xs text-faint mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Skeleton card ─────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="bg-surface rounded-2xl border border-hairline p-5 space-y-3 animate-pulse">
      <div className="w-9 h-9 rounded-xl bg-surface-2" />
      <div className="h-6 w-2/3 bg-surface-2 rounded-lg" />
      <div className="h-4 w-1/2 bg-surface-2 rounded-lg" />
    </div>
  );
}

// ── Seller table row ──────────────────────────────────────────────────────────
function SellerRow({ seller, rank }) {
  const medalColors = ['text-yellow-500', 'text-faint', 'text-amber-600 dark:text-amber-300'];
  const medalIcons = ['🥇', '🥈', '🥉'];

  return (
    <tr className="hover:bg-canvas/60 transition-colors">
      {/* Rank */}
      <td className="px-4 py-3 text-center">
        {rank <= 3
          ? <span className="text-lg">{medalIcons[rank - 1]}</span>
          : <span className="text-sm text-muted font-medium">{rank}</span>
        }
      </td>

      {/* Tên seller */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gold to-gold-deep flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">
              {(seller.sellerName || '?')[0].toUpperCase()}
            </span>
          </div>
          <span className="font-semibold text-ink text-sm">{seller.sellerName}</span>
        </div>
      </td>

      {/* Doanh thu (khách công ty) */}
      <td className="px-4 py-3 text-right">
        <span className="font-bold text-ink text-sm">{fmt(seller.revenue)}</span>
      </td>

      {/* Đã thu */}
      <td className="px-4 py-3 text-right">
        <span className="text-green-600 dark:text-green-300 font-semibold text-sm">{fmt(seller.collected)}</span>
      </td>

      {/* Công nợ */}
      <td className="px-4 py-3 text-right">
        {Number(seller.debt) > 0
          ? <span className="text-red-500 font-semibold text-sm">{fmt(seller.debt)}</span>
          : <span className="text-muted text-sm">—</span>
        }
      </td>

      {/* Đơn chưa thành công */}
      <td className="px-4 py-3 text-right">
        {Number(seller.inProgress) > 0
          ? <span className="text-orange-500 font-semibold text-sm">{fmt(seller.inProgress)}</span>
          : <span className="text-muted text-sm">—</span>
        }
      </td>

      {/* Chưa thu (trừ công nợ) */}
      <td className="px-4 py-3 text-right">
        {Number(seller.uncollected) > 0
          ? <span className="text-yellow-600 dark:text-yellow-300 font-semibold text-sm">{fmt(seller.uncollected)}</span>
          : <span className="text-muted text-sm">—</span>
        }
      </td>
    </tr>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SaleKpiPage() {
  const { t } = useLang();
  const toast = useToast();

  const [preset, setPreset] = useState('month');
  const [range, setRange] = useState(() => presetToRange('month'));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useMinLoading();

  // Doanh số theo danh mục — endpoint RIÊNG, nạp song song. Gộp vào /sale-kpi
  // sẽ bắt cả trang chờ phần nặng nhất (duyệt toàn bộ order item của kỳ).
  const [catData, setCatData] = useState(null);
  const [catLoading, setCatLoading] = useState(true);
  const [catDetail, setCatDetail] = useState(null);

  const load = useCallback(async (from, to) => {
    setLoading(true);
    try {
      const res = await adminSaleKpiApi.get({ from, to });
      setData(res.data?.data);
    } catch (e) {
      toast('Lỗi tải KPI', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCategories = useCallback(async (from, to) => {
    setCatLoading(true);
    try {
      const res = await adminSaleKpiApi.categories({ from, to });
      setCatData(res.data?.data);
    } catch {
      setCatData(null);
    } finally {
      setCatLoading(false);
    }
  }, []);

  useEffect(() => { load(range.from, range.to); loadCategories(range.from, range.to); }, []);

  const handlePreset = (key) => setPreset(key);
  const handleRangeChange = (r) => { setRange(r); load(r.from, r.to); loadCategories(r.from, r.to); };

  const cards = data?.cards;
  const sellers = data?.sellers || [];
  const categories = catData?.categories || [];

  const CARD_DEFS = [
    { icon: ShoppingBag, label: 'Tổng số đơn', value: cards ? fmtNum(cards.totalOrders) : '—', accent: 'var(--c-info)' },
    { icon: UserPlus, label: 'Khách mới', value: cards ? fmtNum(cards.newCustomers) : '—', accent: 'var(--c-info)' },
    { icon: UserCheck, label: 'Khách quay lại', value: cards ? fmtNum(cards.returnCustomers) : '—', accent: '#8B5CF6' },
    { icon: CreditCard, label: 'Đã thu', value: cards ? fmt(cards.collected) : '—', accent: 'var(--c-success)', bg: 'bg-green-50/60 dark:bg-green-500/6' },
    { icon: DollarSign, label: 'Doanh thu', value: cards ? fmt(cards.revenue) : '—', accent: 'var(--c-gold)' },
    { icon: TrendingUp, label: 'Lợi nhuận gộp', value: cards ? fmt(cards.profit) : '—', accent: 'var(--c-success)' },
    { icon: AlertCircle, label: 'Còn nợ', value: cards ? fmt(cards.debt) : '—', accent: 'var(--c-danger)', bg: 'bg-red-50/60 dark:bg-red-500/6' },
    { icon: Clock, label: 'Đang xử lý', value: cards ? fmt(cards.processing) : '—', accent: 'var(--c-warning)', bg: 'bg-yellow-50/60 dark:bg-yellow-500/6' },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">

      <BackButton fallback={window.location.pathname.startsWith('/owner') ? '/owner/dashboard' : '/admin/dashboard'} />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader
          icon={TrendingUp}
          title="KPI Phòng Sale"
          subtitle="Thống kê hiệu suất kinh doanh theo kỳ"
        />
        <button onClick={() => load(range.from, range.to)} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-hairline-2 text-sm text-ink-2 hover:bg-canvas transition disabled:opacity-50">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Làm mới
        </button>
      </div>

      {/* Date picker — dùng đúng component của AdminDashboard */}
      <div className="bg-surface rounded-2xl border border-line-soft px-4 py-3 shadow-sm relative">
        <DateRangePicker
          preset={preset}
          onPreset={handlePreset}
          onRangeChange={handleRangeChange}
        />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 9 }).map((_, i) => <SkeletonCard key={i} />)
          : CARD_DEFS.map((c, i) => (
            <KpiCard key={i} icon={c.icon} label={c.label} value={c.value}
              accent={c.accent} bg={c.bg || 'bg-surface'} />
          ))
        }
      </div>

      {/* ── Doanh số theo Danh mục ──────────────────────────────────────
          Đặt TRƯỚC bảng Seller. Lưu ý: bảng này đếm 4 trạng thái
          (PREPARING / DELIVERING / PENDING_PAYMENT / COMPLETED) còn các card
          phía trên chỉ đếm COMPLETED — nên hai chỗ KHÔNG khớp nhau, đúng chủ ý. */}
      <div className="bg-surface rounded-2xl border border-hairline shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-hairline flex items-center gap-2">
          <Package size={18} className="text-gold" />
          <h2 className="font-bold text-ink">Doanh số theo Danh mục</h2>
          <span className="ml-auto text-xs text-muted bg-canvas px-2.5 py-1 rounded-full">
            Top 10 · đơn đang xử lý &amp; hoàn thành
          </span>
        </div>

        {catLoading ? (
          <div className="p-8 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 bg-canvas rounded-xl animate-pulse" />
            ))}
          </div>
        ) : categories.length === 0 ? (
          <div className="text-center py-14 text-muted">
            <Package size={40} className="mx-auto mb-3 opacity-20" />
            <p className="font-medium">Không có dữ liệu danh mục trong kỳ này</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[620px]">
              <thead className="bg-canvas">
                <tr className="text-[11px] uppercase tracking-wider text-muted">
                  <th className="px-5 py-3 text-left w-16">STT</th>
                  <th className="px-5 py-3 text-left">Danh mục sản phẩm</th>
                  <th className="px-5 py-3 text-right">Số lượng bán</th>
                  <th className="px-5 py-3 text-right">Tổng tiền</th>
                  <th className="px-5 py-3 text-center w-24">Chi tiết</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((c, i) => (
                  <tr key={c.id ?? c.name} className="border-t border-hairline hover:bg-canvas/40">
                    <td className="px-5 py-3">
                      {i < 3
                        ? <span className="text-lg">{['🥇', '🥈', '🥉'][i]}</span>
                        : <span className="text-sm text-muted font-medium">{i + 1}</span>}
                    </td>
                    <td className="px-5 py-3 font-semibold text-ink">{c.name}</td>
                    <td className="px-5 py-3 text-right text-ink">
                      {c.quantity}{c.unit ? ` ${c.unit}` : ''}
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-ink">{fmt(c.amount)}</td>
                    <td className="px-5 py-3 text-center">
                      <button type="button" onClick={() => setCatDetail(c)}
                        className="text-xs font-semibold text-gold hover:text-gold-strong">
                        Chi tiết
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal chi tiết: các sản phẩm trong danh mục */}
      <Modal open={!!catDetail} onClose={() => setCatDetail(null)}
        title={catDetail ? `Chi tiết danh mục — ${catDetail.name}` : ''} size="lg">
        {catDetail && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-muted border-b border-hairline">
                  <th className="px-3 py-2 text-left w-12">STT</th>
                  <th className="px-3 py-2 text-left">Sản phẩm</th>
                  <th className="px-3 py-2 text-right">Số lượng bán</th>
                  <th className="px-3 py-2 text-right">Tổng tiền</th>
                </tr>
              </thead>
              <tbody>
                {(catDetail.products || []).map((p, i) => (
                  <tr key={p.id ?? p.name} className="border-b border-hairline last:border-0">
                    <td className="px-3 py-2.5 text-muted">{i + 1}</td>
                    <td className="px-3 py-2.5 text-ink">{p.name}</td>
                    <td className="px-3 py-2.5 text-right">
                      {p.quantity}{p.unit ? ` ${p.unit}` : ''}
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold text-ink">{fmt(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-hairline-2 font-bold">
                  <td className="px-3 py-2.5" colSpan={2}>Tổng</td>
                  <td className="px-3 py-2.5 text-right">
                    {catDetail.quantity}{catDetail.unit ? ` ${catDetail.unit}` : ''}
                  </td>
                  <td className="px-3 py-2.5 text-right">{fmt(catDetail.amount)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Modal>

      {/* Seller table */}
      <div className="bg-surface rounded-2xl border border-hairline shadow-sm overflow-hidden">
        {/* Table header */}
        <div className="px-5 py-4 border-b border-hairline flex items-center gap-2">
          <Trophy size={18} className="text-gold" />
          <h2 className="font-bold text-ink">Doanh số theo Seller</h2>
          <span className="ml-auto text-xs text-muted bg-canvas px-2.5 py-1 rounded-full">
            Chỉ tính khách Công ty
          </span>
        </div>

        {loading ? (
          <div className="p-8 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 bg-canvas rounded-xl animate-pulse" />
            ))}
          </div>
        ) : sellers.length === 0 ? (
          <div className="text-center py-14 text-muted">
            <Trophy size={40} className="mx-auto mb-3 opacity-20" />
            <p className="font-medium">Không có dữ liệu seller trong kỳ này</p>
            <p className="text-xs mt-1">Chỉ hiển thị seller có đơn khách công ty</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[780px]">
              <thead className="bg-canvas">
                <tr>
                  <th className="px-4 py-3 text-center w-12 text-xs font-semibold text-muted uppercase tracking-wider">#</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">Seller</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted uppercase tracking-wider">
                    Doanh thu
                    <span className="block font-normal normal-case text-[10px] text-faint">Khách công ty</span>
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-green-600 dark:text-green-300 uppercase tracking-wider">Đã thu</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-red-500 uppercase tracking-wider">Công nợ</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-orange-500 uppercase tracking-wider">
                    Đơn chưa
                    <span className="block font-normal normal-case text-[10px] text-faint">thành công</span>
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-yellow-600 dark:text-yellow-300 uppercase tracking-wider">
                    Chưa thu
                    <span className="block font-normal normal-case text-[10px] text-faint">trừ công nợ</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {sellers.map((seller, i) => (
                  <SellerRow key={seller.sellerId} seller={seller} rank={i + 1} />
                ))}
              </tbody>

              {/* Footer: tổng cột */}
              {sellers.length > 1 && (
                <tfoot className="bg-canvas border-t-2 border-line">
                  <tr>
                    <td colSpan={2} className="px-4 py-3 text-sm font-bold text-ink">
                      Tổng ({sellers.length} seller)
                    </td>
                    {['revenue', 'collected', 'debt', 'inProgress', 'uncollected'].map(key => {
                      const total = sellers.reduce((s, r) => s + Number(r[key] || 0), 0);
                      const colors = {
                        revenue: 'text-ink',
                        collected: 'text-green-600 dark:text-green-300',
                        debt: 'text-red-500',
                        inProgress: 'text-orange-500',
                        uncollected: 'text-yellow-600 dark:text-yellow-300',
                      };
                      return (
                        <td key={key} className={`px-4 py-3 text-right font-bold text-sm ${colors[key]}`}>
                          {fmt(total)}
                        </td>
                      );
                    })}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

      {/* Note về doanh thu lẻ */}
      <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/18 rounded-xl px-4 py-3 text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2">
        <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
        <span>
          Bảng Seller chỉ tính đơn <strong>khách Công ty</strong> cho từng seller.
          Doanh thu <strong>khách lẻ</strong> được tính chung vào cards tổng hợp phía trên nhưng không hiển thị theo seller.
        </span>
      </div>
    </div>
  );
}
