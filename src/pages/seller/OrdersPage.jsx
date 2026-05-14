// src/pages/seller/OrdersPage.jsx
import { useState, useEffect } from 'react';
import { orderApi, downloadBlob } from '../../api/services';
import { useToast } from '../../components/common/Toast';
import {
  Search, FileText, Clock, CheckCircle, RefreshCw,
  Eye, Truck, Package, XCircle, AlertCircle,
  CreditCard, CheckSquare, X, Download,
} from 'lucide-react';
import OrderDetailModal from '../../components/seller/OrderDetailModal';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

function formatPrice(price) {
  return new Intl.NumberFormat('vi-VN').format(price || 0) + ' đ';
}

function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatDateShort(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function parseDeadlineDate(str) {
  if (!str || str === 'Thanh toán khi nhận hàng') return null;
  const m = str.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return null;
}

function getPaymentBadge(order) {
  if (order.status === 'CANCELLED') return null;

  const { paymentStatus, paymentMethod, paymentDeadline } = order;

  if (paymentStatus === 'PAID') {
    return { label: 'Đã thanh toán', color: 'text-emerald-600 bg-emerald-50 border-emerald-200', deadline: null, diffDays: null, urgency: 'paid' };
  }

  if (paymentStatus === 'PARTIAL') {
    const paid = Number(order.paidAmount || 0);
    const remaining = Number(order.finalAmount || 0) - paid;
    const deadlineDate = parseDeadlineDate(order.paymentDeadline);
    let deadline = null, diffDays = null, urgency = 'partial';
    let color = 'text-blue-600 bg-blue-50 border-blue-200';

    if (deadlineDate) {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      diffDays = Math.ceil((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      deadline = deadlineDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });

      if (diffDays < 0) { urgency = 'overdue'; color = 'text-red-600 bg-red-50 border-red-300'; }
      else if (diffDays <= 4) { urgency = 'critical'; color = 'text-rose-600 bg-rose-50 border-rose-300'; }
      else if (diffDays <= 7) { urgency = 'warning'; color = 'text-amber-600 bg-amber-50 border-amber-300'; }
      else { urgency = 'normal'; color = 'text-orange-500 bg-orange-50 border-orange-200'; }
    }

    return { label: 'TT một phần', color, deadline, diffDays, urgency, paid, remaining };
  }

  const method = (paymentMethod || '').toUpperCase();

  // COD / CASH / TRANSFER → chưa thanh toán thông thường, không phải công nợ
  if (['CASH', 'BANK_TRANSFER'].includes(method)) {
    return { label: 'Chưa thanh toán', color: 'text-gray-500 bg-gray-50 border-gray-200', deadline: null, diffDays: null, urgency: null };
  }

  // Chỉ DEBT / OTHER mới là công nợ
  const isDebt = ['DEBT', 'OTHER'].includes(method);

  if (!isDebt) {
    return { label: 'Chưa thanh toán', color: 'text-gray-500 bg-gray-50 border-gray-200', deadline: null, diffDays: null, urgency: null };
  }

  const deadlineDate = parseDeadlineDate(paymentDeadline);
  if (!deadlineDate) {
    return { label: 'Công nợ', color: 'text-orange-500 bg-orange-50 border-orange-200', deadline: null, diffDays: null, urgency: 'normal' };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffMs = deadlineDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const deadlineStr = deadlineDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });

  if (diffDays < 0) return { label: 'Quá hạn', color: 'text-red-600 bg-red-50 border-red-300', deadline: deadlineStr, diffDays, urgency: 'overdue' };
  if (diffDays <= 4) return { label: 'Công nợ', color: 'text-rose-600 bg-rose-50 border-rose-300', deadline: deadlineStr, diffDays, urgency: 'critical' };
  if (diffDays <= 7) return { label: 'Công nợ', color: 'text-amber-600 bg-amber-50 border-amber-300', deadline: deadlineStr, diffDays, urgency: 'warning' };
  return { label: 'Công nợ', color: 'text-orange-500 bg-orange-50 border-orange-200', deadline: deadlineStr, diffDays, urgency: 'normal' };
}

const STATUS_CONFIG = {
  PENDING: { label: 'Chờ xử lý', color: 'text-gray-600 bg-gray-50 border-gray-200', icon: Clock },
  CONFIRMED: { label: 'Đã xác nhận', color: 'text-sky-600 bg-sky-50 border-sky-200', icon: CheckCircle },
  PREPARING: { label: 'Đang chuẩn bị', color: 'text-blue-600 bg-blue-50 border-blue-200', icon: Package },
  READY: { label: 'Sẵn sàng', color: 'text-indigo-600 bg-indigo-50 border-indigo-200', icon: CheckCircle },
  DELIVERING: { label: 'Đang giao', color: 'text-purple-600 bg-purple-50 border-purple-200', icon: Truck },
  PENDING_PAYMENT: { label: 'Chờ thanh toán', color: 'text-orange-600 bg-orange-50 border-orange-200', icon: Clock },
  COMPLETED: { label: 'Hoàn thành', color: 'text-emerald-600 bg-emerald-50 border-emerald-200', icon: CheckCircle },
  CANCELLED: { label: 'Đã huỷ', color: 'text-red-500 bg-red-50 border-red-200', icon: XCircle },
};

const FILTER_TABS = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'PENDING', label: 'Chờ xử lý' },
  { value: 'PREPARING', label: 'Đang chuẩn bị' },
  { value: 'READY', label: 'Sẵn sàng' },
  { value: 'DELIVERING', label: 'Đang giao' },
  { value: 'PENDING_PAYMENT', label: 'Chờ thanh toán' },
  { value: 'COMPLETED', label: 'Hoàn thành' },
  { value: 'CANCELLED', label: 'Đã huỷ' },
];

const PAYMENT_METHOD_OPTIONS = [
  { value: 'CASH', label: '💵 Tiền mặt' },
  { value: 'BANK_TRANSFER', label: '🏦 Chuyển khoản' },
  { value: 'DEBT', label: '📋 Công nợ' },
];

function canComplete(order) {
  const okStatus = ['DELIVERING', 'PENDING_PAYMENT'].includes(order.status);
  const okPartial = order.paymentStatus === 'PARTIAL';
  return okStatus || okPartial;
}

// Chỉ DELIVERING → PENDING_PAYMENT (đã giao nhưng chưa thanh toán)
function canPendingPayment(order) {
  return order.status === 'DELIVERING';
}

function canChangePayment(order) {
  return ['DELIVERING', 'PENDING_PAYMENT'].includes(order.status)
    && order.paymentStatus !== 'PAID';
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status];
  if (!cfg) return null;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.color}`}>
      <Icon size={9} /> {cfg.label}
    </span>
  );
}

function PaymentBadge({ order }) {
  const badge = getPaymentBadge(order);
  if (!badge) return <span className="text-xs text-[#C4B9A8]">—</span>;
  return (
    <div className="flex flex-col gap-0.5">
      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border w-fit ${badge.color}`}>
        {badge.urgency === 'overdue' && <AlertCircle size={9} />}
        {badge.label}
      </span>
      {badge.deadline && (
        <span className={`text-[10px] font-medium px-2 ${badge.urgency === 'overdue' ? 'text-red-500' :
          badge.urgency === 'critical' ? 'text-rose-500' :
            badge.urgency === 'warning' ? 'text-amber-500' : 'text-orange-400'}`}>
          {badge.urgency === 'overdue'
            ? `⚠ Quá hạn TT ${badge.deadline}`
            : badge.diffDays === 0
              ? `Hôm nay (${badge.deadline})`
              : `Hạn TT ${badge.deadline} (còn ${badge.diffDays}d)`}
        </span>
      )}
      {badge.paid > 0 && (
        <span className="text-[10px] font-medium px-2 text-blue-500">
          Đã thu: {formatPrice(badge.paid)} · Còn: {formatPrice(badge.remaining)}
        </span>
      )}
    </div>
  );
}

// ── Modal đổi phương thức thanh toán ─────────────────────────────────────────
function ChangePaymentModal({ order, onClose, onSuccess }) {
  const toast = useToast();
  const [method, setMethod] = useState(order.paymentMethod || 'CASH');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      await orderApi.updatePaymentMethod(order.id, method);
      toast('Cập nhật phương thức thanh toán thành công', 'success');
      onSuccess();
      onClose();
    } catch {
      toast('Không thể cập nhật phương thức thanh toán', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-[#1C1C1E] text-base">Đổi phương thức thanh toán</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[#F0EBE3] text-[#8E8878]"><X size={16} /></button>
        </div>
        <p className="text-xs text-[#8E8878] mb-4">
          Đơn <span className="font-mono font-bold text-[#C9A84C]">{order.orderCode}</span>
          {' '}— chỉ áp dụng khi đơn đang ở trạng thái <strong>Chờ thanh toán</strong>.
        </p>
        <div className="grid grid-cols-1 gap-2 mb-5">
          {PAYMENT_METHOD_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => setMethod(opt.value)}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all
                ${method === opt.value
                  ? 'border-[#C9A84C] bg-[#C9A84C]/10 text-[#C9A84C]'
                  : 'border-[#F0EBE3] bg-white text-[#1C1C1E] hover:border-[#C9A84C]/40'}`}>
              <CreditCard size={14} />
              {opt.label}
              {method === opt.value && <CheckCircle size={14} className="ml-auto" />}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[#F0EBE3] text-sm text-[#8E8878] hover:bg-[#F0EBE3] transition-colors">Huỷ</button>
          <button onClick={handleSave} disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-[#C9A84C] text-white text-sm font-semibold hover:bg-[#B8963E] transition-colors disabled:opacity-60">
            {loading ? 'Đang lưu...' : 'Lưu'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal xác nhận hoàn thành đơn ────────────────────────────────────────────
function ConfirmCompleteModal({ order, onClose, onSuccess }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await orderApi.completeOrder(order.id);
      toast('Đơn hàng đã hoàn thành!', 'success');
      onSuccess();
      onClose();
    } catch {
      toast('Không thể hoàn thành đơn hàng', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-[#1C1C1E] text-base">Xác nhận hoàn thành</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[#F0EBE3] text-[#8E8878]"><X size={16} /></button>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-5">
          <p className="text-sm text-emerald-700 font-medium mb-1">
            Đơn <span className="font-mono font-bold">{order.orderCode}</span>
          </p>
          <p className="text-xs text-emerald-600">
            Thao tác này sẽ chuyển trạng thái đơn thành <strong>Hoàn thành</strong> và trạng thái thanh toán thành <strong>Đã thanh toán</strong>.
          </p>
        </div>
        <p className="text-xs text-[#8E8878] mb-5">Hành động này không thể hoàn tác.</p>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[#F0EBE3] text-sm text-[#8E8878] hover:bg-[#F0EBE3] transition-colors">Huỷ</button>
          <button onClick={handleConfirm} disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 transition-colors disabled:opacity-60">
            {loading ? 'Đang xử lý...' : '✓ Xác nhận'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal xác nhận chờ thanh toán ────────────────────────────────────────────
function ConfirmPendingPaymentModal({ order, onClose, onSuccess }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await orderApi.markPendingPayment(order.id);
      toast('Đã chuyển sang Chờ thanh toán', 'success');
      onSuccess();
      onClose();
    } catch {
      toast('Không thể cập nhật trạng thái đơn hàng', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-[#1C1C1E] text-base">Xác nhận chờ thanh toán</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[#F0EBE3] text-[#8E8878]">
            <X size={16} />
          </button>
        </div>

        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-4">
          <p className="text-sm text-orange-700 font-medium mb-1">
            Đơn <span className="font-mono font-bold">{order.orderCode}</span>
          </p>
          <p className="text-xs text-orange-600">
            Đơn đã được giao nhưng <strong>chưa thanh toán</strong>.
            Thao tác này sẽ chuyển trạng thái sang <strong>Chờ thanh toán</strong>.
          </p>
        </div>

        <p className="text-xs text-[#8E8878] mb-5">
          Sau khi xác nhận, đơn sẽ chờ kế toán ghi nhận thanh toán.
        </p>

        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-[#F0EBE3] text-sm text-[#8E8878] hover:bg-[#F0EBE3] transition-colors">
            Huỷ
          </button>
          <button onClick={handleConfirm} disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
            {loading
              ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : <><Clock size={14} /> Xác nhận</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Spinner nhỏ dùng trong nút ────────────────────────────────────────────────
function BtnSpinner({ size = 13, color = 'border-current' }) {
  return (
    <div
      style={{ width: size, height: size }}
      className={`border-2 ${color} border-t-transparent rounded-full animate-spin`}
    />
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function OrdersPage() {
  const toast = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [exporting, setExporting] = useState(false);

  // id của đơn đang tạo invoice — null khi rảnh
  // Khi có giá trị: nút invoice của đơn đó hiện spinner,
  // toàn bộ nút invoice của đơn khác bị disabled + mờ.
  const [invoiceLoadingId, setInvoiceLoadingId] = useState(null);

  // Modal states
  const [paymentModalOrder, setPaymentModalOrder] = useState(null);
  const [completeModalOrder, setCompleteModalOrder] = useState(null);
  const [pendingPaymentModalOrder, setPendingPaymentModalOrder] = useState(null);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await orderApi.exportMyOrders();
      downloadBlob(res.data, `don-hang-${new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')}.xlsx`);
    } catch {
      toast('Không thể xuất file Excel', 'error');
    } finally {
      setExporting(false);
    }
  };

  const fetchOrders = () => {
    setLoading(true);
    orderApi.getMyOrders()
      .then(r => setOrders(r.data?.data || []))
      .catch(() => toast('Không thể tải đơn hàng', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchOrders(); }, []);

  const handleInvoice = async (orderId, e) => {
    e.stopPropagation();
    if (invoiceLoadingId) return;
    setInvoiceLoadingId(orderId);

    try {
      const res = await orderApi.getInvoice(orderId);
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      // Trên mobile thì ưu tiên download, trên desktop thì mở tab
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

      if (isMobile) {
        const link = document.createElement('a');
        link.href = url;
        link.download = `hoa-don-${orderId}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        window.open(url, '_blank');
      }

      setTimeout(() => URL.revokeObjectURL(url), 60000); // revoke sau 1 phút

    } catch {
      toast('Không thể tải hoá đơn', 'error');
    } finally {
      setInvoiceLoadingId(null);
    }
  };

  const filtered = orders.filter(o => {
    const matchStatus = statusFilter === 'ALL' || o.status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch = !search
      || o.orderCode?.toLowerCase().includes(q)
      || o.customerName?.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  // ── Action buttons ────────────────────────────────────────────────────────
  const ActionButtons = ({ o }) => {
    const isThisLoading = invoiceLoadingId === o.id;
    const isOtherLoading = !!invoiceLoadingId && !isThisLoading;

    return (
      <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>

        {/* ── Nút Invoice ── */}
        <button
          onClick={e => handleInvoice(o.id, e)}
          disabled={!!invoiceLoadingId}
          title={
            isThisLoading ? 'Đang tạo hoá đơn...' :
              isOtherLoading ? 'Chờ đơn khác xong' : 'Xem hoá đơn PDF'
          }
          className={`
            relative p-1.5 rounded-lg border transition-all duration-200
            ${isThisLoading
              /* đơn này đang load: vàng + pulse ring */
              ? 'bg-[#C9A84C]/15 text-[#C9A84C] border-[#C9A84C]/40 cursor-wait ring-2 ring-[#C9A84C]/30 ring-offset-1'
              : isOtherLoading
                /* đơn khác đang load: xám mờ */
                ? 'bg-[#F0EBE3] text-[#C4B9A8] border-[#F0EBE3] cursor-not-allowed opacity-40'
                /* bình thường */
                : 'bg-[#C9A84C]/10 text-[#C9A84C] border-transparent hover:bg-[#C9A84C]/20 hover:scale-105 active:scale-95'
            }
          `}
        >
          {isThisLoading
            ? <BtnSpinner size={13} color="border-[#C9A84C]" />
            : <FileText size={13} />
          }

          {/* Tooltip nhỏ khi đang load */}
          {isThisLoading && (
            <span className="
              absolute -top-7 left-1/2 -translate-x-1/2
              whitespace-nowrap text-[10px] font-medium
              bg-[#1C1C1E] text-white px-2 py-0.5 rounded-md
              pointer-events-none
            ">
              Đang tạo...
            </span>
          )}
        </button>

        {/* ── Nút Chờ thanh toán (DELIVERING → PENDING_PAYMENT) ── */}
        {canPendingPayment(o) && (
          <button
            onClick={e => { e.stopPropagation(); setPendingPaymentModalOrder(o); }}
            disabled={!!invoiceLoadingId}
            title="Đã giao — chờ thanh toán"
            className={`
              p-1.5 rounded-lg border transition-all duration-200
              ${invoiceLoadingId
                ? 'bg-orange-50 text-orange-200 border-transparent cursor-not-allowed opacity-40'
                : 'bg-orange-50 text-orange-500 border-transparent hover:bg-orange-100 hover:scale-105 active:scale-95'
              }
            `}
          >
            <Clock size={13} />
          </button>
        )}

        {/* ── Nút đổi thanh toán ── */}
        {canChangePayment(o) && (
          <button
            onClick={e => { e.stopPropagation(); setPaymentModalOrder(o); }}
            disabled={!!invoiceLoadingId}
            title="Đổi phương thức thanh toán"
            className={`
              p-1.5 rounded-lg border transition-all duration-200
              ${invoiceLoadingId
                ? 'bg-blue-50 text-blue-200 border-transparent cursor-not-allowed opacity-40'
                : 'bg-blue-50 text-blue-600 border-transparent hover:bg-blue-100 hover:scale-105 active:scale-95'
              }
            `}
          >
            <CreditCard size={13} />
          </button>
        )}

        {/* ── Nút hoàn thành đơn ── */}
        {canComplete(o) && (
          <button
            onClick={e => { e.stopPropagation(); setCompleteModalOrder(o); }}
            disabled={!!invoiceLoadingId}
            title="Hoàn thành đơn hàng"
            className={`
              p-1.5 rounded-lg border transition-all duration-200
              ${invoiceLoadingId
                ? 'bg-emerald-50 text-emerald-200 border-transparent cursor-not-allowed opacity-40'
                : 'bg-emerald-50 text-emerald-600 border-transparent hover:bg-emerald-100 hover:scale-105 active:scale-95'
              }
            `}
          >
            <CheckSquare size={13} />
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* ── Header ── */}
      <div className="flex-shrink-0 px-4 sm:px-6 py-4 bg-white border-b border-[#F0EBE3]">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div>
            <h1 className="text-xl font-bold text-[#1C1C1E]" style={{ fontFamily: 'var(--font-display)' }}>
              Đơn hàng
            </h1>
            <p className="text-xs text-[#8E8878]">{orders.length} đơn hàng của bạn</p>
          </div>
          <div className="sm:ml-auto flex items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8878]" />
              <input type="text" placeholder="Tìm đơn hàng..." value={search}
                onChange={e => setSearch(e.target.value)}
                className="input-elegant rounded-xl pl-9 pr-4 py-2 text-sm w-44 sm:w-52" />
            </div>
            <button onClick={fetchOrders}
              className="p-2 rounded-xl bg-[#F0EBE3] text-[#8E8878] hover:bg-[#E8DDD0] transition-colors">
              <RefreshCw size={15} />
            </button>
            <button onClick={handleExport} disabled={exporting}
              className="p-2 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors disabled:opacity-60"
              title="Xuất Excel">
              {exporting
                ? <BtnSpinner size={15} color="border-emerald-500" />
                : <Download size={15} />}
            </button>
          </div>
        </div>

        {/* Status tabs */}
        <div className="flex gap-1.5 mt-3 overflow-x-auto pb-0.5 scrollbar-hide">
          {FILTER_TABS.map(({ value, label }) => (
            <button key={value} onClick={() => setStatusFilter(value)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                ${statusFilter === value
                  ? 'bg-[#C9A84C] text-white'
                  : 'bg-[#F0EBE3] text-[#8E8878] hover:bg-[#E8DDD0]'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-[#8E8878] gap-2">
            <FileText size={36} strokeWidth={1} />
            <p className="text-sm">Không có đơn hàng nào</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block bg-white rounded-2xl border border-[#F0EBE3] overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-[#FAF7F2] border-b border-[#F0EBE3]">
                  <tr>
                    {['Mã đơn', 'Khách hàng', 'Kho', 'Thời gian', 'Tổng tiền', 'Trạng thái', 'Thanh toán', 'Thao tác'].map(h => (
                      <th key={h} className="text-left text-[10px] font-bold text-[#8E8878] uppercase tracking-wider px-4 py-3 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(o => (
                    <tr
                      key={o.id}
                      onClick={() => setSelectedOrder(o)}
                      className={`
                        border-b border-[#F0EBE3] last:border-0 cursor-pointer transition-colors
                        ${invoiceLoadingId === o.id
                          ? 'bg-[#C9A84C]/5'          // highlight nhẹ dòng đang tạo invoice
                          : 'hover:bg-[#FAF7F2]'
                        }
                      `}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-bold text-[#C9A84C]">{o.orderCode}</span>
                          {/* Dot loading nhỏ bên cạnh mã đơn khi đang tạo invoice */}
                          {invoiceLoadingId === o.id && (
                            <span className="flex gap-0.5 items-center">
                              {[0, 1, 2].map(i => (
                                <span
                                  key={i}
                                  className="w-1 h-1 rounded-full bg-[#C9A84C] animate-bounce"
                                  style={{ animationDelay: `${i * 0.15}s` }}
                                />
                              ))}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs font-medium text-[#1C1C1E]">{o.customerName}</p>
                        <p className="text-[10px] text-[#8E8878]">{o.customerPhone}</p>
                      </td>
                      <td className="px-4 py-3">
                        {o.warehouseName
                          ? <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200">{o.warehouseName}</span>
                          : <span className="text-[10px] text-[#C4B9A8]">—</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-xs text-[#8E8878] whitespace-nowrap">{formatDate(o.createdAt)}</td>
                      <td className="px-4 py-3 text-xs font-bold text-[#1C1C1E]">{formatPrice(o.finalAmount)}</td>
                      <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                      <td className="px-4 py-3"><PaymentBadge order={o} /></td>
                      <td className="px-4 py-3"><ActionButtons o={o} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-2">
              {filtered.map(o => (
                <div
                  key={o.id}
                  onClick={() => setSelectedOrder(o)}
                  className={`
                    rounded-xl border p-4 cursor-pointer transition-all
                    ${invoiceLoadingId === o.id
                      ? 'bg-[#C9A84C]/5 border-[#C9A84C]/40'
                      : 'bg-white border-[#F0EBE3] hover:border-[#C9A84C]'
                    }
                  `}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="font-mono text-xs font-bold text-[#C9A84C]">{o.orderCode}</p>
                        {invoiceLoadingId === o.id && (
                          <span className="flex gap-0.5 items-center">
                            {[0, 1, 2].map(i => (
                              <span
                                key={i}
                                className="w-1 h-1 rounded-full bg-[#C9A84C] animate-bounce"
                                style={{ animationDelay: `${i * 0.15}s` }}
                              />
                            ))}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-[#1C1C1E] mt-0.5">{o.customerName}</p>
                      {o.warehouseName && (
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full border bg-blue-50 text-blue-600 border-blue-200 mt-0.5 inline-block">
                          {o.warehouseName}
                        </span>
                      )}
                    </div>
                    <StatusBadge status={o.status} />
                  </div>

                  <div className="mb-2">
                    <PaymentBadge order={o} />
                  </div>

                  <div className="flex items-center justify-between mt-2">
                    <div>
                      <p className="text-xs text-[#8E8878]">{formatDateShort(o.createdAt)}</p>
                      <p className="font-bold text-[#1C1C1E] text-sm mt-0.5">{formatPrice(o.finalAmount)}</p>
                    </div>
                    <div className="flex gap-1.5" onClick={e => e.stopPropagation()}>
                      <ActionButtons o={o} />
                      <button
                        onClick={e => { e.stopPropagation(); setSelectedOrder(o); }}
                        className="p-2 rounded-xl bg-[#F0EBE3] text-[#8E8878]"
                      >
                        <Eye size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Banner loading ở bottom card */}
                  {invoiceLoadingId === o.id && (
                    <div className="mt-3 flex items-center gap-2 bg-[#C9A84C]/10 rounded-lg px-3 py-2">
                      <BtnSpinner size={11} color="border-[#C9A84C]" />
                      <span className="text-[11px] font-medium text-[#C9A84C]">Đang tạo hoá đơn PDF...</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Modals ── */}
      {selectedOrder && (
        <OrderDetailModal order={selectedOrder} onClose={() => setSelectedOrder(null)} onRefresh={fetchOrders} />
      )}
      {paymentModalOrder && (
        <ChangePaymentModal order={paymentModalOrder} onClose={() => setPaymentModalOrder(null)} onSuccess={fetchOrders} />
      )}
      {completeModalOrder && (
        <ConfirmCompleteModal order={completeModalOrder} onClose={() => setCompleteModalOrder(null)} onSuccess={fetchOrders} />
      )}
      {pendingPaymentModalOrder && (
        <ConfirmPendingPaymentModal
          order={pendingPaymentModalOrder}
          onClose={() => setPendingPaymentModalOrder(null)}
          onSuccess={fetchOrders}
        />
      )}
    </div>
  );
}