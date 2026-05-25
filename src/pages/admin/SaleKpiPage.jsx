// src/pages/admin/SaleKpiPage.jsx
import { useEffect, useState, useCallback } from 'react';
import { TableSkeleton } from '../../components/ui/Skeleton.jsx';
import useMinLoading from '../../hooks/useMinLoading.js';
import {
  TrendingUp, DollarSign, ShoppingBag, Users, UserPlus, UserCheck,
  CreditCard, AlertCircle, Clock, RefreshCw, Trophy,
} from 'lucide-react';
import { adminSaleKpiApi } from '../../api/adminApi';
import { useToast } from '../../components/common/Toast';
import DateRangePicker, { presetToRange } from '../../components/ui/DateRangePicker';
import { PageHeader, formatCurrency, formatNumber } from '../../components/ui';

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n) { return formatCurrency(Number(n) || 0); }
function fmtNum(n) { return formatNumber(Number(n) || 0); }

// ── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, sub, accent = '#C9A84C', bg = 'bg-white' }) {
  return (
    <div className={`${bg} rounded-2xl border border-black/5 shadow-sm p-5 flex flex-col gap-3`}>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center"
        style={{ background: accent + '18' }}>
        <Icon size={18} style={{ color: accent }} />
      </div>
      <div>
        <p className="text-[22px] font-bold text-[#1C1C1E] leading-tight">{value}</p>
        <p className="text-sm text-[#8E8878] mt-0.5">{label}</p>
        {sub && <p className="text-xs text-[#AAA] mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Skeleton card ─────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-black/5 p-5 space-y-3 animate-pulse">
      <div className="w-9 h-9 rounded-xl bg-[#F0EBE3]" />
      <div className="h-6 w-2/3 bg-[#F0EBE3] rounded-lg" />
      <div className="h-4 w-1/2 bg-[#F0EBE3] rounded-lg" />
    </div>
  );
}

// ── Seller table row ──────────────────────────────────────────────────────────
function SellerRow({ seller, rank }) {
  const medalColors = ['text-yellow-500', 'text-gray-400', 'text-amber-600'];
  const medalIcons = ['🥇', '🥈', '🥉'];

  return (
    <tr className="hover:bg-[#FAF7F2]/60 transition-colors">
      {/* Rank */}
      <td className="px-4 py-3 text-center">
        {rank <= 3
          ? <span className="text-lg">{medalIcons[rank - 1]}</span>
          : <span className="text-sm text-[#8E8878] font-medium">{rank}</span>
        }
      </td>

      {/* Tên seller */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#C9A84C] to-[#A07830] flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">
              {(seller.sellerName || '?')[0].toUpperCase()}
            </span>
          </div>
          <span className="font-semibold text-[#1C1C1E] text-sm">{seller.sellerName}</span>
        </div>
      </td>

      {/* Doanh thu (khách công ty) */}
      <td className="px-4 py-3 text-right">
        <span className="font-bold text-[#1C1C1E] text-sm">{fmt(seller.revenue)}</span>
      </td>

      {/* Đã thu */}
      <td className="px-4 py-3 text-right">
        <span className="text-green-600 font-semibold text-sm">{fmt(seller.collected)}</span>
      </td>

      {/* Công nợ */}
      <td className="px-4 py-3 text-right">
        {Number(seller.debt) > 0
          ? <span className="text-red-500 font-semibold text-sm">{fmt(seller.debt)}</span>
          : <span className="text-[#8E8878] text-sm">—</span>
        }
      </td>

      {/* Đơn chưa thành công */}
      <td className="px-4 py-3 text-right">
        {Number(seller.inProgress) > 0
          ? <span className="text-orange-500 font-semibold text-sm">{fmt(seller.inProgress)}</span>
          : <span className="text-[#8E8878] text-sm">—</span>
        }
      </td>

      {/* Chưa thu (trừ công nợ) */}
      <td className="px-4 py-3 text-right">
        {Number(seller.uncollected) > 0
          ? <span className="text-yellow-600 font-semibold text-sm">{fmt(seller.uncollected)}</span>
          : <span className="text-[#8E8878] text-sm">—</span>
        }
      </td>
    </tr>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SaleKpiPage() {
  const toast = useToast();

  const [preset, setPreset] = useState('month');
  const [range, setRange] = useState(() => presetToRange('month'));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useMinLoading();

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

  useEffect(() => { load(range.from, range.to); }, []);

  const handlePreset = (key) => setPreset(key);
  const handleRangeChange = (r) => { setRange(r); load(r.from, r.to); };

  const cards = data?.cards;
  const sellers = data?.sellers || [];

  const CARD_DEFS = [
    { icon: ShoppingBag, label: 'Tổng số đơn', value: cards ? fmtNum(cards.totalOrders) : '—', accent: '#3B82F6' },
    { icon: UserPlus, label: 'Khách mới', value: cards ? fmtNum(cards.newCustomers) : '—', accent: '#06B6D4' },
    { icon: UserCheck, label: 'Khách quay lại', value: cards ? fmtNum(cards.returnCustomers) : '—', accent: '#8B5CF6' },
    { icon: CreditCard, label: 'Đã thu', value: cards ? fmt(cards.collected) : '—', accent: '#10B981', bg: 'bg-green-50/60' },
    { icon: DollarSign, label: 'Doanh thu', value: cards ? fmt(cards.revenue) : '—', accent: '#C9A84C' },
    { icon: TrendingUp, label: 'Lợi nhuận gộp', value: cards ? fmt(cards.profit) : '—', accent: '#10B981' },
    { icon: AlertCircle, label: 'Còn nợ', value: cards ? fmt(cards.debt) : '—', accent: '#EF4444', bg: 'bg-red-50/60' },
    { icon: Clock, label: 'Đang xử lý', value: cards ? fmt(cards.processing) : '—', accent: '#F59E0B', bg: 'bg-yellow-50/60' },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader
          icon={TrendingUp}
          title="KPI Phòng Sale"
          subtitle="Thống kê hiệu suất kinh doanh theo kỳ"
        />
        <button onClick={() => load(range.from, range.to)} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-black/10 text-sm text-[#555] hover:bg-[#FAF7F2] transition disabled:opacity-50">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Làm mới
        </button>
      </div>

      {/* Date picker — dùng đúng component của AdminDashboard */}
      <div className="bg-white rounded-2xl border border-[#F0EBE3] px-4 py-3 shadow-sm relative">
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
              accent={c.accent} bg={c.bg || 'bg-white'} />
          ))
        }
      </div>

      {/* Seller table */}
      <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
        {/* Table header */}
        <div className="px-5 py-4 border-b border-black/5 flex items-center gap-2">
          <Trophy size={18} className="text-[#C9A84C]" />
          <h2 className="font-bold text-[#1C1C1E]">Doanh số theo Seller</h2>
          <span className="ml-auto text-xs text-[#8E8878] bg-[#FAF7F2] px-2.5 py-1 rounded-full">
            Chỉ tính khách Công ty
          </span>
        </div>

        {loading ? (
          <div className="p-8 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 bg-[#FAF7F2] rounded-xl animate-pulse" />
            ))}
          </div>
        ) : sellers.length === 0 ? (
          <div className="text-center py-14 text-[#8E8878]">
            <Trophy size={40} className="mx-auto mb-3 opacity-20" />
            <p className="font-medium">Không có dữ liệu seller trong kỳ này</p>
            <p className="text-xs mt-1">Chỉ hiển thị seller có đơn khách công ty</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[780px]">
              <thead className="bg-[#FAF7F2]">
                <tr>
                  <th className="px-4 py-3 text-center w-12 text-xs font-semibold text-[#8E8878] uppercase tracking-wider">#</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#8E8878] uppercase tracking-wider">Seller</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-[#8E8878] uppercase tracking-wider">
                    Doanh thu
                    <span className="block font-normal normal-case text-[10px] text-[#AAA]">Khách công ty</span>
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-green-600 uppercase tracking-wider">Đã thu</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-red-500 uppercase tracking-wider">Công nợ</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-orange-500 uppercase tracking-wider">
                    Đơn chưa
                    <span className="block font-normal normal-case text-[10px] text-[#AAA]">thành công</span>
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-yellow-600 uppercase tracking-wider">
                    Chưa thu
                    <span className="block font-normal normal-case text-[10px] text-[#AAA]">trừ công nợ</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {sellers.map((seller, i) => (
                  <SellerRow key={seller.sellerId} seller={seller} rank={i + 1} />
                ))}
              </tbody>

              {/* Footer: tổng cột */}
              {sellers.length > 1 && (
                <tfoot className="bg-[#FAF7F2] border-t-2 border-[#E8DDD0]">
                  <tr>
                    <td colSpan={2} className="px-4 py-3 text-sm font-bold text-[#1C1C1E]">
                      Tổng ({sellers.length} seller)
                    </td>
                    {['revenue', 'collected', 'debt', 'inProgress', 'uncollected'].map(key => {
                      const total = sellers.reduce((s, r) => s + Number(r[key] || 0), 0);
                      const colors = {
                        revenue: 'text-[#1C1C1E]',
                        collected: 'text-green-600',
                        debt: 'text-red-500',
                        inProgress: 'text-orange-500',
                        uncollected: 'text-yellow-600',
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
      <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700 flex items-start gap-2">
        <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
        <span>
          Bảng Seller chỉ tính đơn <strong>khách Công ty</strong> cho từng seller.
          Doanh thu <strong>khách lẻ</strong> được tính chung vào cards tổng hợp phía trên nhưng không hiển thị theo seller.
        </span>
      </div>
    </div>
  );
}
