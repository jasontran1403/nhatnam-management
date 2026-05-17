// src/pages/warehouse/WarehouseOrdersPage.jsx
// FIX #5: Chỉ load đơn hàng của kho mà user quản lý, không có chọn kho
import { useState, useEffect, useCallback } from 'react';
import { warehouseApi, getImageUrl } from '../../api/warehouseApi';
import { useToast } from '../../components/common/Toast';
import { useAuth } from '../../context/AuthContext';
import {
  RefreshCw, Package, Truck, Clock, X,
  ChevronRight, Box, Search,
} from 'lucide-react';

function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}
function formatQty(n) {
  if (n == null) return '0';
  const num = Number(n);
  return parseFloat(num.toFixed(3)).toLocaleString('vi-VN');
}

// ── Order Detail Modal ────────────────────────────────────────────────────────
function OrderDetailModal({ order, onClose, onDeliver, delivering }) {
  if (!order) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl
        max-h-[90vh] flex flex-col overflow-hidden">

        <div className="flex items-center justify-between px-5 py-4 border-b border-[#F0EBE3] flex-shrink-0">
          <div>
            <p className="font-mono text-sm font-bold text-[#C9A84C]">{order.orderCode}</p>
            <p className="text-xs text-[#8E8878] mt-0.5">{formatDate(order.createdAt)}</p>
          </div>
          <button onClick={onClose}
            className="p-2 rounded-xl bg-[#F0EBE3] text-[#8E8878] hover:bg-[#E8DDD0] transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-3 bg-[#FAF7F2] border-b border-[#F0EBE3] flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-[#1C1C1E]">
                {order.customerName || 'Khách lẻ/Khách vãng lai'}
              </p>
              <p className="text-[10px] text-[#8E8878]">{order.customerPhone}</p>
            </div>
          </div>
          {order.notes && (
            <p className="text-[11px] text-[#8E8878] mt-1.5 italic">📝 {order.notes}</p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <p className="text-xs font-bold text-[#8E8878] uppercase tracking-wider">
            Danh sách sản phẩm cần chuẩn bị
          </p>

          {order.items?.map((item, idx) => (
            <div key={idx} className="bg-[#FAF7F2] rounded-2xl p-3.5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white overflow-hidden shrink-0 border border-[#F0EBE3]">
                  {item.productImageUrl
                    ? <img src={getImageUrl(item.productImageUrl)} alt={item.productName}
                        className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-lg">🍽️</div>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[#1C1C1E] truncate">{item.productName}</p>
                  <p className="text-xs text-[#C9A84C] font-semibold mt-0.5">
                    SL: {formatQty(item.quantity)} {item.unit}
                  </p>
                </div>
                <div className="shrink-0 w-8 h-8 rounded-full bg-[#C9A84C]/10 flex items-center justify-center">
                  <span className="text-xs font-bold text-[#C9A84C]">{idx + 1}</span>
                </div>
              </div>

              {item.ingredients?.length > 0 && (
                <div className="border-t border-[#E8DDD0] pt-2.5 space-y-1.5">
                  <p className="text-[10px] text-[#8E8878] uppercase font-bold tracking-wider mb-2">
                    Nguyên liệu
                  </p>
                  {item.ingredients.map((ing, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#C9A84C]" />
                        <span className="text-xs text-[#1C1C1E]">{ing.ingredientName}</span>
                      </div>
                      <span className="text-xs font-semibold text-[#C9A84C]">
                        {formatQty(ing.quantityUsed)} {ing.unit}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {item.notes && (
                <p className="text-[11px] text-[#8E8878] italic border-t border-[#E8DDD0] pt-2">
                  📝 {item.notes}
                </p>
              )}
            </div>
          ))}
        </div>

        <div className="px-5 py-4 border-t border-[#F0EBE3] flex-shrink-0">
          <button
            onClick={() => onDeliver(order.id)}
            disabled={delivering}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl
              bg-[#C9A84C] text-white font-semibold text-sm
              hover:bg-[#B8943C] active:scale-[0.98] transition-all
              disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {delivering
              ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : <Truck size={16} />
            }
            {delivering ? 'Đang xử lý...' : 'Bắt đầu giao hàng'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Order Card ────────────────────────────────────────────────────────────────
function OrderCard({ order, onClick }) {
  const itemCount = order.items?.length || 0;

  return (
    <button
      onClick={() => onClick(order)}
      className="w-full bg-white rounded-2xl border border-[#F0EBE3] p-4
        hover:border-[#C9A84C] hover:shadow-md active:scale-[0.99]
        transition-all text-left group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-mono text-sm font-bold text-[#C9A84C]">{order.orderCode}</p>
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5
              rounded-full bg-blue-50 text-blue-600 border border-blue-200">
              <Package size={9} /> Đang chuẩn bị
            </span>
          </div>

          {/* FIX #2: hiển thị "Khách lẻ/Khách vãng lai" khi không có tên */}
          <p className="text-sm font-semibold text-[#1C1C1E] truncate">
            {order.customerName || 'Khách lẻ/Khách vãng lai'}
          </p>
          <p className="text-[11px] text-[#8E8878] mt-0.5">{order.customerPhone}</p>

          <div className="flex items-center gap-3 mt-2">
            <span className="flex items-center gap-1 text-[10px] text-[#8E8878]">
              <Clock size={10} /> {formatDate(order.createdAt)}
            </span>
            <span className="flex items-center gap-1 text-[10px] text-[#8E8878]">
              <Box size={10} /> {itemCount} sản phẩm
            </span>
          </div>
        </div>

        <ChevronRight size={16}
          className="text-[#C4B9A8] group-hover:text-[#C9A84C] transition-colors shrink-0 mt-1" />
      </div>

      {order.notes && (
        <p className="text-[11px] text-[#8E8878] italic mt-2 pt-2 border-t border-[#F0EBE3] truncate">
          📝 {order.notes}
        </p>
      )}
    </button>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function WarehouseOrdersPage() {
  const toast = useToast();
  const { user } = useAuth();

  const [orders,     setOrders]     = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [selected,   setSelected]   = useState(null);
  const [delivering, setDelivering] = useState(false);
  const [search,     setSearch]     = useState('');

  // FIX #5: warehouseId từ user
  const assignedWarehouseId = user?.warehouseId || user?.warehouse?.id;

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      // API sẽ tự filter theo warehouseId của user (xem backend fix)
      const res = await warehouseApi.getPreparingOrders();
      setOrders(res.data?.data || []);
    } catch {
      toast('Không thể tải danh sách đơn hàng', 'error');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const handleDeliver = async (orderId) => {
    setDelivering(true);
    try {
      const res = await warehouseApi.markDelivering(orderId);
      if (res?.data?.success === false) {
        toast(res.data.message || 'Không thể cập nhật', 'error');
        return;
      }
      setOrders(prev => prev.filter(o => o.id !== orderId));
      setSelected(null);
      toast('Đã chuyển sang Đang giao hàng', 'success');
    } catch (e) {
      toast(e?.response?.data?.message || 'Lỗi khi cập nhật trạng thái', 'error');
    } finally { setDelivering(false); }
  };

  const filtered = orders.filter(o => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      o.orderCode?.toLowerCase().includes(q) ||
      o.customerName?.toLowerCase().includes(q) ||
      o.customerPhone?.includes(q)
    );
  });

  return (
    <div className="flex flex-col h-full bg-[#FAF7F2]">

      <div className="flex-shrink-0 px-4 sm:px-6 py-4 bg-white border-b border-[#F0EBE3]">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <h1 className="text-xl font-bold text-[#1C1C1E]" style={{ fontFamily: 'var(--font-display)' }}>
              Đơn cần giao
            </h1>
            <p className="text-xs text-[#8E8878] mt-0.5">
              {orders.length} đơn đang chuẩn bị
            </p>
          </div>
          <button onClick={fetchOrders}
            className="p-2 rounded-xl bg-[#F0EBE3] text-[#8E8878] hover:bg-[#E8DDD0] transition-colors">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Search */}
        <div className="relative mt-3">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8878]" />
          <input
            type="text"
            placeholder="Tìm theo mã đơn, khách hàng..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full border border-[#E8DDD0] rounded-xl pl-9 pr-4 py-2.5 text-sm bg-white
              focus:outline-none focus:border-[#C9A84C]"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-[#8E8878] gap-3">
            <div className="w-16 h-16 rounded-2xl bg-[#F0EBE3] flex items-center justify-center">
              <Package size={28} strokeWidth={1.5} />
            </div>
            <p className="text-sm font-medium">
              {search ? 'Không tìm thấy đơn hàng' : 'Không có đơn hàng cần chuẩn bị'}
            </p>
            {!search && (
              <p className="text-xs text-center max-w-[200px]">
                Các đơn hàng trạng thái "Đang chuẩn bị" sẽ xuất hiện ở đây
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                onClick={setSelected}
              />
            ))}
          </div>
        )}
      </div>

      {selected && (
        <OrderDetailModal
          order={selected}
          onClose={() => setSelected(null)}
          onDeliver={handleDeliver}
          delivering={delivering}
        />
      )}
    </div>
  );
}
