// src/pages/owner/OwnerSupplyPriceHistoryPage.jsx
//
// Trang BIẾN ĐỘNG GIÁ của 1 vật dụng ở "Kho Trung tâm". Mở từ bảng Quản lý
// văn phòng phẩm — click 1 dòng → trang này.
//
// Hiển thị:
//   · Chart line theo thời gian của đơn giá (đã bao gồm phí phân bổ).
//   · Thẻ thống kê: giá thấp nhất · cao nhất · trung bình · trung vị · lần gần nhất.
//
// Giá được LƯU theo đơn vị tính nhỏ nhất (xem OfficeSupplyService.placeOrder).
// Nếu không có lần đặt nào có đơn giá (dữ liệu cũ, chưa nhập giá), trang hiện
// EmptyState thay vì chart.
import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp, TrendingDown, Activity, Clock, Package,
  BarChart2, ArrowLeft, Calculator,
} from 'lucide-react';
import {
  officeSupplyApi, resolveCentralWarehouseId, fmtDateOff, fmtQtyOff,
} from '../../api/officeSupplyApi';
import { useToast } from '../../components/common/Toast';
import {
  PageHeader, SectionCard, SecondaryButton,
  LoadingSpinner, EmptyState,
} from '../../components/ui';

const nf = (n) => n == null ? '—'
  : new Intl.NumberFormat('vi-VN').format(Math.round(Number(n) || 0));
const nfPrecise = (n) => n == null ? '—'
  : new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(Number(n) || 0);

export default function OwnerSupplyPriceHistoryPage() {
  const { itemId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [warehouseId, setWarehouseId] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    resolveCentralWarehouseId()
      .then(setWarehouseId)
      .catch(() => toast('Không lấy được kho Trung tâm', 'error'));
  }, [toast]);

  const load = useCallback(async () => {
    if (!warehouseId || !itemId) return;
    setLoading(true);
    try {
      setData(await officeSupplyApi.priceHistory(itemId, warehouseId));
    } catch (e) {
      toast(e?.response?.data?.message || 'Không tải được lịch sử giá', 'error');
    } finally { setLoading(false); }
  }, [warehouseId, itemId, toast]);

  useEffect(() => { load(); }, [load]);

  const stats = data?.stats;
  const points = data?.points || [];

  // Dữ liệu cho chart: cần cả date string và price number
  const chartData = points.map(p => ({
    at: p.placedAt,
    date: fmtDateOff(p.placedAt),
    price: Math.round(Number(p.unitPrice) || 0),
    qty: Number(p.quantity) || 0,
  }));

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <SecondaryButton onClick={() => navigate(-1)}>
        <ArrowLeft size={15} /> Quay lại
      </SecondaryButton>

      <PageHeader
        icon={BarChart2}
        title={data?.name ? `Biến động giá: ${data.name}` : 'Biến động giá'}
        subtitle={data?.specification
          ? `${data.specification} · ĐVT: ${data.unit || '—'}`
          : (data ? `ĐVT: ${data.unit || '—'}` : 'Đang tải...')}
      />

      {loading ? (
        <SectionCard><LoadingSpinner label="Đang tải..." /></SectionCard>
      ) : !data || points.length === 0 ? (
        <SectionCard>
          <EmptyState icon={Package} title="Chưa có dữ liệu giá"
            description="Vật dụng này chưa có lần đặt nào được nhập giá." />
        </SectionCard>
      ) : (
        <>
          {/* ── Stat cards ──────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              accent="emerald"
              icon={TrendingDown}
              label="Giá thấp nhất"
              value={`${nf(stats?.minPrice)} đ`}
              foot={`${fmtDateOff(stats?.minAt)} · SL ${fmtQtyOff(stats?.minQty)} ${data.unit || ''}`}
            />
            <StatCard
              accent="red"
              icon={TrendingUp}
              label="Giá cao nhất"
              value={`${nf(stats?.maxPrice)} đ`}
              foot={`${fmtDateOff(stats?.maxAt)} · SL ${fmtQtyOff(stats?.maxQty)} ${data.unit || ''}`}
            />
            <StatCard
              accent="sky"
              icon={Calculator}
              label="Giá trung bình · Trung vị"
              value={`${nf(stats?.avgPrice)} đ`}
              foot={`Trung vị: ${nf(stats?.medianPrice)} đ`}
            />
            <StatCard
              accent="gold"
              icon={Clock}
              label="Lần đặt gần nhất"
              value={`${nf(stats?.lastPrice)} đ`}
              foot={`${fmtDateOff(stats?.lastAt)} · SL ${fmtQtyOff(stats?.lastQty)} ${data.unit || ''}`}
            />
          </div>

          {/* ── Chart ──────────────────────────────────────────────── */}
          <SectionCard>
            <div className="px-5 py-4 border-b border-hairline flex items-center gap-2">
              <Activity size={16} className="text-gold" />
              <p className="text-sm font-bold text-ink">
                Biểu đồ biến động đơn giá / {data.unit || 'ĐVT'}
              </p>
              <span className="text-xs text-muted ml-auto">{points.length} lần đặt</span>
            </div>
            <div style={{ width: '100%', height: 320 }} className="p-3">
              <ResponsiveContainer>
                <LineChart data={chartData} margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.08)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={v => new Intl.NumberFormat('vi-VN', { notation: 'compact' }).format(v)}
                  />
                  <Tooltip
                    formatter={(v, name) => name === 'price'
                      ? [`${nf(v)} đ`, 'Đơn giá']
                      : [v, name]}
                    labelFormatter={l => `Ngày: ${l}`}
                  />
                  <Line type="monotone" dataKey="price" stroke="#c9a84c" strokeWidth={2}
                    dot={{ r: 4, fill: '#c9a84c' }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>

          {/* ── Bảng chi tiết các lần đặt ──────────────────────────── */}
          <SectionCard>
            <div className="px-5 py-4 border-b border-hairline">
              <p className="text-sm font-bold text-ink">Chi tiết các lần đặt</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-canvas text-xs text-muted uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-2.5 text-left">Ngày đặt</th>
                    <th className="px-4 py-2.5 text-right">Số lượng</th>
                    <th className="px-4 py-2.5 text-left">ĐVT</th>
                    <th className="px-4 py-2.5 text-right">Đơn giá /ĐVT (đã gồm phí)</th>
                    <th className="px-4 py-2.5 text-right">Thành tiền ước lượng</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {[...points].reverse().map(p => (
                    <tr key={p.orderId} className="hover:bg-canvas/50">
                      <td className="px-4 py-2.5 text-ink">{fmtDateOff(p.placedAt)}</td>
                      <td className="px-4 py-2.5 text-right text-ink">{fmtQtyOff(p.quantity)}</td>
                      <td className="px-4 py-2.5 text-muted">{data.unit}</td>
                      <td className="px-4 py-2.5 text-right text-ink tabular-nums">{nfPrecise(p.unitPrice)} đ</td>
                      <td className="px-4 py-2.5 text-right text-ink tabular-nums">
                        {nf(Number(p.unitPrice || 0) * Number(p.quantity || 0))} đ
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
}

function StatCard({ accent, icon: Icon, label, value, foot }) {
  const palette = {
    emerald: 'from-emerald-500/10 to-emerald-500/5 border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-300',
    red:     'from-red-500/10 to-red-500/5 border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-300',
    sky:     'from-sky-500/10 to-sky-500/5 border-sky-200 dark:border-sky-500/20 text-sky-700 dark:text-sky-300',
    gold:    'from-gold/15 to-gold/5 border-gold/30 text-gold-strong',
  }[accent] || '';
  return (
    <div className={`rounded-2xl bg-gradient-to-br border p-4 ${palette}`}>
      <div className="flex items-center gap-1.5">
        <Icon size={13} /> <p className="text-xs font-medium">{label}</p>
      </div>
      <p className="text-xl font-bold mt-1 tabular-nums">{value}</p>
      <p className="text-[11px] text-muted mt-1">{foot}</p>
    </div>
  );
}
