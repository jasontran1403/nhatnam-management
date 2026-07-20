// src/pages/driver/DriverDashboardPage.jsx
// Dashboard TÀI XẾ — danh sách các đơn đang giao được gán cho mình.
// Thiết kế ưu tiên mobile: tài xế dùng điện thoại khi đang trên đường.
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Truck, MapPin, Phone, Package, Clock, ChevronRight,
  RefreshCw, AlertCircle, CheckCircle2,
} from 'lucide-react';
import { driverApi } from '../../api/driverApi';
import { useAuth } from '../../context/AuthContext';
import {
  PageHeader, SectionCard, EmptyState, LoadingSpinner, formatCurrency,
} from '../../components/ui';

// ── Trạng thái đơn ────────────────────────────────────────────────────────────
const STATUS_MAP = {
  PREPARING:  { label: 'Đang chuẩn bị', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  READY:      { label: 'Sẵn sàng giao',  cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  DELIVERING: { label: 'Đang giao',      cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

function StatusPill({ status }) {
  const cfg = STATUS_MAP[status] || { label: status, cls: 'bg-gray-50 text-gray-600 border-gray-200' };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

// ── Format thời gian giao ─────────────────────────────────────────────────────
function fmtDeliveryTime(ms) {
  if (!ms) return null;
  const d = new Date(ms);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  if (isToday) return `Hôm nay ${time}`;
  return `${d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })} ${time}`;
}

// ── Card 1 đơn hàng ───────────────────────────────────────────────────────────
function OrderCard({ order, onClick }) {
  const deliveryTime = fmtDeliveryTime(order.deliveryDatetime);

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white rounded-2xl border border-black/5 shadow-sm
        hover:shadow-md hover:border-[#C9A84C]/40 transition-all active:scale-[0.99] overflow-hidden">

      {/* Header — mã đơn + trạng thái */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-[#FAF7F2] border-b border-black/5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-[#C9A84C]/15 flex items-center justify-center shrink-0">
            <Truck size={15} className="text-[#C9A84C]" />
          </div>
          <span className="font-bold text-sm text-[#1C1C1E] truncate">{order.orderCode}</span>
        </div>
        <StatusPill status={order.status} />
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-2.5">
        <p className="font-semibold text-[15px] text-[#1C1C1E] leading-snug">
          {order.customerName || 'Khách lẻ'}
        </p>

        {order.deliveryAddress && (
          <div className="flex items-start gap-2 text-[13px] text-[#5A5548]">
            <MapPin size={14} className="text-[#8E8878] shrink-0 mt-0.5" />
            <span className="leading-snug">{order.deliveryAddress}</span>
          </div>
        )}

        {order.customerPhone && (
          <div className="flex items-center gap-2 text-[13px] text-[#5A5548]">
            <Phone size={14} className="text-[#8E8878] shrink-0" />
            <span>{order.customerPhone}</span>
          </div>
        )}

        <div className="flex items-center gap-4 pt-1 flex-wrap">
          <span className="flex items-center gap-1.5 text-xs text-[#8E8878]">
            <Package size={13} /> {order.itemCount || 0} mặt hàng
          </span>
          {deliveryTime && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-[#C9A84C]">
              <Clock size={13} /> {deliveryTime}
            </span>
          )}
          {order.warehouseName && (
            <span className="text-xs text-[#8E8878]">Kho: {order.warehouseName}</span>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-black/5 bg-white">
        {order.showPrices && order.finalAmount != null ? (
          <span className="text-sm font-bold text-[#1C1C1E]">{formatCurrency(order.finalAmount)}</span>
        ) : <span />}
        <span className="flex items-center gap-1 text-xs font-semibold text-[#C9A84C]">
          Xem chi tiết <ChevronRight size={14} />
        </span>
      </div>
    </button>
  );
}

// ── Trang chính ───────────────────────────────────────────────────────────────
export default function DriverDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [orders, setOrders] = useState([]);
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const [meRes, ordersRes] = await Promise.all([
        driverApi.me().catch(() => null),
        driverApi.myOrders().catch(() => []),
      ]);
      setMe(meRes);
      setOrders(Array.isArray(ordersRes) ? ordersRes : []);
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || 'Không tải được danh sách đơn');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Tự làm mới mỗi 60 giây — đơn mới được kho gán trong lúc đang chạy
  useEffect(() => {
    const timer = setInterval(() => load(true), 60_000);
    return () => clearInterval(timer);
  }, [load]);

  // ── Chưa được gắn với bản ghi tài xế ────────────────────────────────────────
  if (!loading && me && me.linked === false) {
    return (
      <div className="p-4 sm:p-6 space-y-5">
        <PageHeader icon={Truck} title="Đơn đang giao"
          subtitle={user?.fullName || 'Tài xế'} />
        <SectionCard>
          <div className="flex flex-col items-center gap-3 py-12 px-6 text-center">
            <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center">
              <AlertCircle size={24} className="text-amber-600" />
            </div>
            <p className="font-semibold text-[#1C1C1E]">Tài khoản chưa được gắn với tài xế</p>
            <p className="text-sm text-[#8E8878] max-w-sm">
              Vui lòng liên hệ quản lý để gắn tài khoản của bạn với hồ sơ tài xế
              trong mục <strong>Quản lý tài xế</strong>.
            </p>
          </div>
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <PageHeader
        icon={Truck}
        title="Đơn đang giao"
        subtitle={me?.driverName ? `Tài xế: ${me.driverName}` : (user?.fullName || 'Tài xế')}
        action={
          <button onClick={() => load(true)} disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold
              bg-white border border-black/10 text-[#1C1C1E] hover:bg-[#FAF7F2]
              transition-colors disabled:opacity-50">
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Đang tải' : 'Làm mới'}
          </button>
        } />

      {/* Tổng quan nhanh */}
      {!loading && orders.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-4">
            <p className="text-xs text-[#8E8878] font-medium">Tổng đơn cần giao</p>
            <p className="text-2xl font-bold text-[#1C1C1E] mt-1">{orders.length}</p>
          </div>
          <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-4">
            <p className="text-xs text-[#8E8878] font-medium">Tổng mặt hàng</p>
            <p className="text-2xl font-bold text-[#C9A84C] mt-1">
              {orders.reduce((s, o) => s + (o.itemCount || 0), 0)}
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-600 font-medium">{error}</p>
        </div>
      )}

      {loading ? (
        <SectionCard><LoadingSpinner label="Đang tải đơn hàng..." /></SectionCard>
      ) : orders.length === 0 ? (
        <SectionCard>
          <EmptyState icon={CheckCircle2}
            title="Không có đơn nào đang giao"
            description="Khi kho gán đơn cho bạn, đơn sẽ hiện ở đây." />
        </SectionCard>
      ) : (
        <div className="space-y-3">
          {orders.map(o => (
            <OrderCard key={o.id} order={o}
              onClick={() => navigate(`/driver/orders/${o.id}`)} />
          ))}
        </div>
      )}
    </div>
  );
}
