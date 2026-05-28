import { X, FileText, CreditCard, CheckSquare, CheckCircle, Banknote } from 'lucide-react';
import { orderApi } from '../../api/services';
import { useToast } from '../common/Toast';
import { useState } from 'react';
import { formatPrice } from '../../utils/formatPrice';

function formatDate(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${hh}:${mm} ${dd}/${mo}/${yyyy}`;
}

/**
 * Hiển thị thời gian giao hàng:
 * - Nếu có deliveryDatetime → format trực tiếp
 * - Nếu không → tính fallback: createdAt làm tròn lên giờ chẵn + 1h
 *   Ví dụ: 13:59 → 15:00 (làm tròn lên 14:00 rồi + 1h)
 */
function formatDeliveryTime(o) {
  if (o.deliveryDatetime) {
    return formatDate(o.deliveryDatetime);
  }
  if (o.estimatedDelivery) return o.estimatedDelivery;
  if (!o.createdAt) return '—';
  const ordered = new Date(o.createdAt);
  const rounded = new Date(ordered);
  rounded.setSeconds(0, 0);
  if (ordered.getMinutes() > 0 || ordered.getSeconds() > 0) {
    rounded.setMinutes(0);
    rounded.setHours(rounded.getHours() + 1);
  }
  rounded.setHours(rounded.getHours() + 1);
  return formatDate(rounded.getTime());
}

const STATUS_LABEL = {
  PENDING: 'Chờ xử lý',
  CONFIRMED: 'Đã xác nhận',
  PREPARING: 'Đang chuẩn bị',
  READY: 'Sẵn sàng giao',
  DELIVERING: 'Đang giao hàng',
  PENDING_PAYMENT: 'Hoàn thành (Đã giao hàng)',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã huỷ',
};

// ── Order log labels & styles ─────────────────────────────────────────────────
const ACTION_LABEL = {
  CREATED: 'Tạo đơn hàng',
  PREPARING: 'Bắt đầu chuẩn bị',
  DELIVERING: 'Bắt đầu giao hàng',
  PENDING_PAYMENT: 'Chờ thanh toán',
  COMPLETED: 'Hoàn thành đơn',
  CANCELLED: 'Huỷ đơn',
  PARTIAL_PAYMENT: 'Thu tiền 1 phần',
  FULLY_PAID: 'Thanh toán đủ',
  PAYMENT_METHOD_UPDATED: 'Đổi phương thức TT',
  DEADLINE_EXTENDED: 'Gia hạn công nợ',
  FAILED: 'Thất bại',
};

const ACTION_STYLE = {
  CREATED: 'bg-sky-50 text-sky-700 border-sky-200',
  PREPARING: 'bg-blue-50 text-blue-700 border-blue-200',
  DELIVERING: 'bg-purple-50 text-purple-700 border-purple-200',
  PENDING_PAYMENT: 'bg-orange-50 text-orange-700 border-orange-200',
  COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CANCELLED: 'bg-red-50 text-red-600 border-red-200',
  PARTIAL_PAYMENT: 'bg-amber-50 text-amber-700 border-amber-200',
  FULLY_PAID: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  PAYMENT_METHOD_UPDATED: 'bg-gray-50 text-gray-600 border-gray-200',
};

const ROLE_LABEL = {
  SELLER: 'Bán hàng',
  WAREHOUSE: 'Kho',
  ACCOUNTANT: 'Kế toán',
  ADMIN: 'Admin',
  OWNER: 'Owner',
};

function formatLogDate(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

const PAYMENT_METHOD_OPTIONS = [
  { value: 'CASH', label: '💵 Tiền mặt' },
  { value: 'BANK_TRANSFER', label: '🏦 Chuyển khoản' },
  { value: 'DEBT', label: '📋 Công nợ' },
];

// ── Business logic helpers ────────────────────────────────────────────────────
function canComplete(order) {
  const okStatus = ['DELIVERING', 'PENDING_PAYMENT'].includes(order.status);
  const okPartial = order.paymentStatus === 'PARTIAL';
  return okStatus || okPartial;
}

function canChangePayment(order) {
  return order.status === 'PENDING_PAYMENT';
}

function canPartialPay(order) {
  const okStatus = ['DELIVERING', 'PENDING_PAYMENT'].includes(order.status);
  const notPaid = order.paymentStatus !== 'PAID';
  return okStatus && notPaid;
}

// ── VAT helpers ───────────────────────────────────────────────────────────────
function buildVatBreakdownFromItems(items) {
  if (!items?.length) return { groups: [], total: 0 };
  const map = {};
  for (const item of items) {
    const rate = item.vatRate ?? 0;
    const mode = item.vatMode ?? 'INCLUSIVE';
    if (rate === 0) continue;
    const amt = Number(item.vatAmount ?? 0);
    const key = `${rate}|${mode}`;
    if (!map[key]) map[key] = { rate, mode, amount: 0 };
    map[key].amount += amt;
  }
  const groups = Object.values(map).sort((a, b) => a.rate - b.rate || a.mode.localeCompare(b.mode));
  const total = groups.reduce((s, g) => s + g.amount, 0);
  return { groups, total };
}

function VatBreakdownBlock({ groups, total, light, infoOnly }) {
  if (!groups?.length) return null;
  const textMuted = light ? 'text-white/40' : 'text-[#C4B9A8]';
  const textMain = light ? 'text-white/50' : 'text-[#C4B9A8]';
  return (
    <div className="border-t border-white/10 pt-1.5 mt-1.5">
      <div className="flex justify-between">
        <span className={`text-xs ${textMuted}`}>VAT (đã trong giá)</span>
        <span className={`text-xs ${textMain}`}>{formatPrice(total)}</span>
      </div>
      <div className="pl-3 mt-0.5 space-y-0.5">
        {groups.map(g => (
          <div key={`${g.rate}-${g.mode}`} className="flex justify-between items-center">
            <span className={`text-[10px] ${textMuted}`}>
              • {g.rate}% ({g.mode === 'EXCLUSIVE' ? 'ngoài giá' : 'trong giá'})
            </span>
            <span className={`text-[10px] ${textMuted}`}>
              {g.mode === 'EXCLUSIVE' ? '+' : ''}{formatPrice(g.amount)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── resolveDeadlineDisplay ────────────────────────────────────────────────────
function resolveDeadlineDisplay(order) {
  const { paymentStatus, paymentMethod, paymentDeadline, status } = order;

  // Đã thanh toán đủ hoặc hoàn thành → không cần
  if (paymentStatus === 'PAID' || status === 'COMPLETED') return '—';

  // PARTIAL — luôn show deadline nếu có
  if (paymentStatus === 'PARTIAL') {
    if (paymentDeadline && paymentDeadline !== 'Thanh toán khi nhận hàng')
      return paymentDeadline;
    return 'N/A';
  }

  // UNPAID — chỉ show nếu là công nợ
  const isDebt = ['DEBT', 'OTHER'].includes((paymentMethod || '').toUpperCase());
  if (!isDebt) return '—';
  if (paymentDeadline && paymentDeadline !== 'Thanh toán khi nhận hàng') return paymentDeadline;
  return 'N/A';
}

// ── Sub-modal: đổi phương thức thanh toán ────────────────────────────────────
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-6"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-[#1C1C1E] text-sm">Đổi phương thức thanh toán</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[#F0EBE3] text-[#8E8878]"><X size={15} /></button>
        </div>
        <p className="text-xs text-[#8E8878] mb-4">
          Đơn <span className="font-mono font-bold text-[#C9A84C]">{order.orderCode}</span>
          {' '}— chỉ áp dụng khi đơn đang <strong>Chờ thanh toán</strong>.
        </p>
        <div className="grid grid-cols-1 gap-2 mb-5">
          {PAYMENT_METHOD_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => setMethod(opt.value)}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all
                ${method === opt.value
                  ? 'border-[#C9A84C] bg-[#C9A84C]/10 text-[#C9A84C]'
                  : 'border-[#F0EBE3] bg-white text-[#1C1C1E] hover:border-[#C9A84C]/40'}`}>
              <CreditCard size={13} />
              {opt.label}
              {method === opt.value && <CheckCircle size={13} className="ml-auto" />}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-[#F0EBE3] text-sm text-[#8E8878] hover:bg-[#F0EBE3] transition-colors">
            Huỷ
          </button>
          <button onClick={handleSave} disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-[#C9A84C] text-white text-sm font-semibold hover:bg-[#B8963E] transition-colors disabled:opacity-60">
            {loading ? 'Đang lưu...' : 'Lưu'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sub-modal: xác nhận hoàn thành ───────────────────────────────────────────
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-6"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-[#1C1C1E] text-sm">Xác nhận hoàn thành</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[#F0EBE3] text-[#8E8878]"><X size={15} /></button>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-4">
          <p className="text-xs font-medium text-emerald-700 mb-1">
            Đơn <span className="font-mono font-bold">{order.orderCode}</span>
          </p>
          <p className="text-xs text-emerald-600">
            Trạng thái → <strong>Hoàn thành</strong> · Thanh toán → <strong>Đã thanh toán</strong>
          </p>
        </div>
        <p className="text-xs text-[#8E8878] mb-5">Hành động này không thể hoàn tác.</p>
        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-[#F0EBE3] text-sm text-[#8E8878] hover:bg-[#F0EBE3] transition-colors">
            Huỷ
          </button>
          <button onClick={handleConfirm} disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 transition-colors disabled:opacity-60">
            {loading ? 'Đang xử lý...' : '✓ Xác nhận'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sub-modal: thanh toán 1 phần ─────────────────────────────────────────────
function PartialPaymentModal({ order, onClose, onSuccess }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [rawInput, setRawInput] = useState('');

  const alreadyPaid = Number(order.paidAmount || 0);
  const finalAmount = Number(order.finalAmount || 0);
  const remaining = finalAmount - alreadyPaid;

  const handleInput = (e) => {
    const digits = e.target.value.replace(/\D/g, '');
    setRawInput(digits);
  };

  const paidAmount = Number(rawInput) || 0;
  const afterPay = alreadyPaid + paidAmount;
  const isOverpay = paidAmount > remaining;
  const isEmpty = paidAmount <= 0;

  const handleSave = async () => {
    if (isEmpty) return toast('Nhập số tiền cần thu', 'error');
    if (isOverpay) return toast(`Số tiền vượt quá còn lại (${formatPrice(remaining)})`, 'error');
    setLoading(true);
    try {
      await orderApi.recordPartialPayment(order.id, paidAmount, 0);
      toast(
        afterPay >= finalAmount ? 'Đã thanh toán đủ!' : 'Ghi nhận thanh toán thành công',
        'success'
      );
      onSuccess();
      onClose();
    } catch (err) {
      toast(err?.response?.data?.message || 'Không thể ghi nhận thanh toán', 'error');
    } finally {
      setLoading(false);
    }
  };

  const displayInput = rawInput
    ? new Intl.NumberFormat('vi-VN').format(Number(rawInput))
    : '';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-[#1C1C1E] text-sm">Ghi nhận thanh toán</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[#F0EBE3] text-[#8E8878]"><X size={15} /></button>
        </div>

        {/* Tóm tắt đơn */}
        <div className="bg-[#FAF7F2] rounded-xl p-3 mb-4 space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-[#8E8878]">Mã đơn</span>
            <span className="font-mono font-bold text-[#C9A84C]">{order.orderCode}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-[#8E8878]">Tổng đơn</span>
            <span className="font-semibold text-[#1C1C1E]">{formatPrice(finalAmount)}</span>
          </div>
          {alreadyPaid > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-[#8E8878]">Đã thu</span>
              <span className="font-semibold text-emerald-600">{formatPrice(alreadyPaid)}</span>
            </div>
          )}
          <div className="flex justify-between text-xs border-t border-[#EDE8E0] pt-1.5">
            <span className="text-[#8E8878] font-medium">Còn lại</span>
            <span className="font-bold text-orange-500">{formatPrice(remaining)}</span>
          </div>
        </div>

        {/* Input số tiền */}
        <div className="mb-2">
          <label className="text-xs text-[#8E8878] mb-1.5 block">Số tiền thu lần này</label>
          <div className={`flex items-center border rounded-xl px-4 py-3 gap-2 transition-colors
            ${isOverpay
              ? 'border-red-300 bg-red-50'
              : 'border-[#E8DDD0] bg-white focus-within:border-[#C9A84C]'}`}>
            <Banknote size={15} className={isOverpay ? 'text-red-400' : 'text-[#C9A84C]'} />
            <input
              type="text"
              inputMode="numeric"
              placeholder="0"
              value={displayInput}
              onChange={handleInput}
              className="flex-1 outline-none text-sm font-semibold text-[#1C1C1E] bg-transparent"
            />
            <span className="text-xs text-[#8E8878]">đ</span>
          </div>
          {isOverpay && (
            <p className="text-xs text-red-500 mt-1">
              Vượt quá số tiền còn lại ({formatPrice(remaining)})
            </p>
          )}
        </div>

        {/* Preview */}
        {paidAmount > 0 && !isOverpay && (
          <div className={`rounded-xl p-3 mb-2 text-xs space-y-1 ${afterPay >= finalAmount
            ? 'bg-emerald-50 border border-emerald-200'
            : 'bg-blue-50 border border-blue-200'
            }`}>
            {afterPay >= finalAmount ? (
              <p className="text-emerald-700 font-medium">
                ✓ Thanh toán đủ — đơn sẽ chuyển sang <strong>Hoàn thành</strong>
              </p>
            ) : (
              <>
                <div className="flex justify-between text-blue-700">
                  <span>Tổng đã thu sau lần này</span>
                  <span className="font-bold">{formatPrice(afterPay)}</span>
                </div>
                <div className="flex justify-between text-blue-600">
                  <span>Còn nợ</span>
                  <span className="font-bold">{formatPrice(finalAmount - afterPay)}</span>
                </div>
                <p className="text-blue-500 pt-0.5">
                  Đơn sẽ giữ trạng thái <strong>Chờ thanh toán</strong>
                </p>
              </>
            )}
          </div>
        )}

        <div className="flex gap-2 mt-4">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-[#F0EBE3] text-sm text-[#8E8878] hover:bg-[#F0EBE3] transition-colors">
            Huỷ
          </button>
          <button onClick={handleSave} disabled={loading || isEmpty || isOverpay}
            className="flex-1 py-2.5 rounded-xl bg-[#C9A84C] text-white text-sm font-semibold hover:bg-[#B8963E] transition-colors disabled:opacity-50">
            {loading ? 'Đang lưu...' : 'Xác nhận thu'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────
export default function OrderDetailModal({ order: o, onClose, onRefresh }) {
  const toast = useToast();
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showPartialModal, setShowPartialModal] = useState(false);

  const handleInvoice = async () => {
    try {
      const res = await orderApi.getInvoice(o.id);
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      window.open(url, '_blank');
    } catch {
      toast('Không thể tải hoá đơn', 'error');
    }
  };

  const handleActionSuccess = () => {
    onRefresh?.();
    onClose();
  };

  const deliveryAddr = o.deliveryAddress || o.shippingAddress || '—';
  const recipientName = o.contactName || o.customerName || '—';
  const orderedByName = o.orderedByName || o.contactName || '—';

  const { groups: vatGroups, total: vatTotal } = buildVatBreakdownFromItems(o.items);
  const hasItemBreakdown = vatGroups.length > 0;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        <div
          className="relative bg-white rounded-2xl shadow-2xl w-full animate-fadeIn flex flex-col"
          style={{ maxWidth: 'min(90vw, 900px)', maxHeight: '90vh' }}
        >
          {/* ── Header ── */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#F0EBE3] shrink-0">
            <div>
              <p className="text-[10px] text-[#8E8878] uppercase tracking-wider">Chi tiết đơn hàng</p>
              <h2 className="font-bold text-[#1C1C1E] font-mono">{o.orderCode}</h2>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 mr-3 flex-wrap justify-end">
              {canChangePayment(o) && (
                <button onClick={() => setShowPaymentModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors text-xs font-semibold">
                  <CreditCard size={13} /> Đổi TT
                </button>
              )}

              {/* {canPartialPay(o) && (
                <button onClick={() => setShowPartialModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-50 text-orange-600 hover:bg-orange-100 transition-colors text-xs font-semibold">
                  <Banknote size={13} /> Thu tiền
                </button>
              )}

              {canComplete(o) && (
                <button onClick={() => setShowCompleteModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors text-xs font-semibold">
                  <CheckSquare size={13} /> Hoàn thành
                </button>
              )} */}
            </div>

            <button onClick={onClose} className="p-1.5 rounded-lg text-[#8E8878] hover:bg-[#F0EBE3]">
              <X size={17} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

            {/* ── Khách hàng + Thông tin đơn ── */}
            <div className="bg-[#FAF7F2] rounded-xl p-4">
              <div className="flex flex-col md:flex-row md:gap-6">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-[#8E8878] uppercase tracking-wider mb-3">
                    Thông tin khách hàng
                  </p>
                  <div className="space-y-2.5">
                    <InfoRow label="Tên khách hàng" value={o.customerName || (o.customerType === 'RETAIL' ? 'Khách lẻ / Khách vãng lai' : '—')} />
                    <InfoRow label="Địa chỉ giao hàng" value={deliveryAddr} />
                    <InfoRow label="SĐT" value={o.customerPhone && !o.customerPhone.startsWith('KL-') ? o.customerPhone : '—'} />
                    <InfoRow label="Thời hạn thanh toán" value={resolveDeadlineDisplay(o)} />
                  </div>
                </div>
                <div className="hidden md:block w-px bg-[#E8E0D6] self-stretch mx-1" />
                <div className="block md:hidden h-px bg-[#E8E0D6] my-3" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-[#8E8878] uppercase tracking-wider mb-3">
                    Thông tin đơn
                  </p>
                  <div className="space-y-2.5">
                    <InfoRow label="Ngày đặt hàng" value={formatDate(o.createdAt)} />
                    <InfoRow label="Tên người nhận" value={recipientName} />
                    <InfoRow label="Tên người đặt" value={orderedByName} />
                    <InfoRow label="Ngày/giờ giao hàng" value={formatDeliveryTime(o)} />
                  </div>
                </div>
              </div>
            </div>

            {/* ── Trạng thái ── */}
            <div className="bg-[#FAF7F2] rounded-xl p-4">
              <div className="flex flex-col md:flex-row md:gap-6">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-[#8E8878] uppercase tracking-wide mb-1">Trạng thái đơn hàng</p>
                  <p className="text-sm font-semibold text-[#1C1C1E]">{STATUS_LABEL[o.status] || o.status || '—'}</p>
                </div>
                <div className="hidden md:block w-px bg-[#E8E0D6] self-stretch mx-1" />
                <div className="block md:hidden h-px bg-[#E8E0D6] my-2" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-[#8E8878] uppercase tracking-wide mb-1">Trạng thái thanh toán</p>
                  <p className="text-sm font-semibold text-[#1C1C1E]">{formatPaymentDisplay(o)}</p>
                </div>
                {o.notes && (
                  <>
                    <div className="hidden md:block w-px bg-[#E8E0D6] self-stretch mx-1" />
                    <div className="block md:hidden h-px bg-[#E8E0D6] my-2" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-[#8E8878] uppercase tracking-wide mb-1">Ghi chú</p>
                      <p className="text-sm font-medium text-[#1C1C1E]">{o.notes}</p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* ── Chi tiết sản phẩm ── */}
            <div>
              <p className="text-xs font-bold text-[#8E8878] uppercase tracking-wider mb-2">
                Chi tiết đơn hàng
              </p>
              <div className="bg-[#FAF7F2] rounded-xl overflow-hidden">
                {o.items?.map((item, i) => (
                  <div key={i}
                    className={`flex items-start justify-between px-4 py-3 ${i < o.items.length - 1 ? 'border-b border-[#EDE8E0]' : ''}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#1C1C1E] truncate">{item.productName}</p>
                      {item.variantName && <p className="text-xs text-[#8E8878]">{item.variantName}</p>}
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        {/* Quy cách — chỉ hiện badge khi BOX */}
                        {item.saleType === 'BOX' && (
                          <span className="text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 rounded px-1.5 py-0.5">
                            📦 Thùng {item.unitsPerBox ? `(${item.unitsPerBox} ${item.unit}/thùng)` : ''}
                          </span>
                        )}
                        {/* Lẻ: chỉ hiện ĐVT, không badge "Lẻ" */}
                        {item.saleType !== 'BOX' && item.unit && (
                          <span className="text-[10px] text-[#8E8878] bg-[#F5F0E8] rounded px-1.5 py-0.5">
                            ĐVT: {item.unit}
                          </span>
                        )}
                        {item.priceName && item.priceMode !== 'DISCOUNT_PERCENT' && (
                          <span className="text-[10px] text-[#C9A84C] bg-[#C9A84C]/10 rounded px-1.5 py-0.5">
                            {item.priceName}
                          </span>
                        )}
                        {(item.discountPercent ?? 0) > 0 && (
                          <span className="text-[10px] text-orange-600 bg-orange-50 rounded px-1.5 py-0.5">
                            Giảm {item.discountPercent}%
                          </span>
                        )}
                        {(item.vatRate ?? 0) > 0 && (
                          <span className="text-[10px] text-[#8E8878] bg-[#F0EBE3] rounded px-1.5 py-0.5">
                            VAT {item.vatRate}% · {item.vatMode === 'EXCLUSIVE' ? 'ngoài giá' : 'trong giá'}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right ml-3 shrink-0">
                      {(() => {
                        const discPct = item.discountPercent ?? 0;
                        const isBox = item.saleType === 'BOX' && item.unitsPerBox > 0;
                        // unitPrice từ backend luôn là giá lẻ
                        // BOX: đơn giá hiển thị = unitPrice × unitsPerBox
                        const unitPriceRaw = discPct > 0
                          ? Math.round(Number(item.unitPrice) / (1 - discPct / 100))
                          : Number(item.unitPrice ?? 0);
                        const displayPrice = isBox
                          ? unitPriceRaw * item.unitsPerBox
                          : unitPriceRaw;
                        const gross = displayPrice * Number(item.quantity ?? 1);
                        return (
                          <>
                            <p className="text-xs text-[#8E8878]">
                              {item.quantity} × {formatPrice(displayPrice)}
                            </p>
                            <p className="font-bold text-sm text-[#1C1C1E]">{formatPrice(gross)}</p>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Tổng tiền ── */}
            <div className="bg-[#1C1C1E] rounded-xl p-4 space-y-1.5">
              {/* Tạm tính = Σ(displayUnitPrice × qty) — BOX: unitPrice × unitsPerBox */}
              <TotalRow
                label="Tạm tính"
                value={formatPrice((o.items ?? []).reduce(
                  (s, item) => {
                    const discPct = item.discountPercent ?? 0;
                    const isBox = item.saleType === 'BOX' && item.unitsPerBox > 0;
                    const unitPriceRaw = discPct > 0
                      ? Math.round(Number(item.unitPrice) / (1 - discPct / 100))
                      : Number(item.unitPrice ?? 0);
                    const displayPrice = isBox ? unitPriceRaw * item.unitsPerBox : unitPriceRaw;
                    return s + displayPrice * Number(item.quantity ?? 1);
                  }, 0
                ))}
              />

              {/* Giảm giá */}
              {(() => {
                // CK từng món
                const itemDiscount = (o.items ?? []).reduce((s, item) => {
                  const discPct = item.discountPercent ?? 0;
                  if (!discPct) return s;
                  const isBox = item.saleType === 'BOX' && item.unitsPerBox > 0;
                  const tierPrice = Math.round(Number(item.unitPrice) / (1 - discPct / 100));
                  const displayPrice = isBox ? tierPrice * item.unitsPerBox : tierPrice;
                  return s + displayPrice * (discPct / 100) * Number(item.quantity ?? 1);
                }, 0);
                const billDiscount = Number(o.discountAmount ?? 0);
                const totalDiscount = itemDiscount + billDiscount;
                if (totalDiscount <= 0) return null;
                return (
                  <>
                    <TotalRow label="Giảm" value={`-${formatPrice(totalDiscount)}`} />
                    {itemDiscount > 0 && (
                      <div className="flex justify-between pl-3">
                        <span className="text-[10px] text-white/40">• CK món</span>
                        <span className="text-[10px] text-white/40">-{formatPrice(itemDiscount)}</span>
                      </div>
                    )}
                    {billDiscount > 0 && (
                      <div className="flex justify-between pl-3">
                        <span className="text-[10px] text-white/40">• Giảm bill</span>
                        <span className="text-[10px] text-white/40">-{formatPrice(billDiscount)}</span>
                      </div>
                    )}
                  </>
                );
              })()}

              {/* Phụ phí */}
              {Number(o.surcharge) > 0 && (
                <TotalRow label="Phụ phí" value={formatPrice(o.surcharge)} />
              )}

              {/* Tổng tiền */}
              <div className="flex justify-between pt-2 border-t border-white/10">
                <span className="text-sm font-bold text-white">Tổng tiền</span>
                <span className="text-sm font-bold text-[#C9A84C]">{formatPrice(o.finalAmount)}</span>
              </div>

              {/* VAT — chỉ thông tin */}
              {hasItemBreakdown ? (
                <VatBreakdownBlock groups={vatGroups} total={vatTotal} light infoOnly />
              ) : Number(o.vatAmount) > 0 ? (
                <TotalRow label="VAT (trong giá)" value={formatPrice(o.vatAmount)} />
              ) : null}

              {/* Đã thu / còn nợ */}
              {o.paymentStatus === 'PARTIAL' && Number(o.paidAmount) > 0 && (
                <>
                  <div className="flex justify-between pt-1">
                    <span className="text-xs text-emerald-400">Đã thu</span>
                    <span className="text-xs font-semibold text-emerald-400">{formatPrice(o.paidAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-orange-400">Còn nợ</span>
                    <span className="text-xs font-bold text-orange-400">
                      {formatPrice(Number(o.finalAmount) - Number(o.paidAmount))}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* ── Lịch sử thao tác (chỉ hiển thị nếu có logs) ── */}
            {o.logs && o.logs.length > 0 && (
              <div>
                <p className="text-xs font-bold text-[#8E8878] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  🕐 Lịch sử thao tác
                </p>
                <div className="bg-[#FAF7F2] rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-[#EDE8E0]">
                        {['Thao tác', 'Người thực hiện', 'Vai trò', 'Ghi chú', 'Thời gian'].map(h => (
                          <th key={h} className="text-left text-[10px] font-bold text-[#8E8878] uppercase tracking-wider px-3 py-2 whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {o.logs.map((l, i) => (
                        <tr key={l.id} className={`${i < o.logs.length - 1 ? 'border-b border-[#EDE8E0]' : ''}`}>
                          <td className="px-3 py-2">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border whitespace-nowrap ${ACTION_STYLE[l.action] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                              {ACTION_LABEL[l.action] || l.action}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-medium text-[#1C1C1E] whitespace-nowrap">{l.actorName || '—'}</td>
                          <td className="px-3 py-2 text-[#8E8878] whitespace-nowrap">{ROLE_LABEL[l.actorRole] || l.actorRole || '—'}</td>
                          <td className="px-3 py-2 text-[#8E8878] max-w-[160px] truncate">{l.note || '—'}</td>
                          <td className="px-3 py-2 text-[#8E8878] whitespace-nowrap">{formatLogDate(l.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Sub-modals (z-[60] > modal chính z-50) ── */}
      {showPaymentModal && (
        <ChangePaymentModal
          order={o}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={handleActionSuccess}
        />
      )}

      {showCompleteModal && (
        <ConfirmCompleteModal
          order={o}
          onClose={() => setShowCompleteModal(false)}
          onSuccess={handleActionSuccess}
        />
      )}

      {showPartialModal && (
        <PartialPaymentModal
          order={o}
          onClose={() => setShowPartialModal(false)}
          onSuccess={handleActionSuccess}
        />
      )}
    </>
  );
}

// ── Shared helpers ────────────────────────────────────────────────────────────
function InfoRow({ label, value }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-[#8E8878] uppercase tracking-wide">{label}</span>
      <span className="text-sm font-medium text-[#1C1C1E] leading-snug">{value}</span>
    </div>
  );
}

function TotalRow({ label, value }) {
  return (
    <div className="flex justify-between items-start gap-4">
      <span className="text-xs text-white/50 shrink-0">{label}</span>
      <span className="text-xs font-medium text-white text-right">{value}</span>
    </div>
  );
}

function formatPaymentDisplay(order) {
  const { paymentMethod, paymentStatus, paymentDeadline, paidAmount, finalAmount } = order;
  const methodLabel = {
    CASH: 'Tiền mặt', BANK_TRANSFER: 'Chuyển khoản',
    TRANSFER: 'Chuyển khoản', BANK: 'Chuyển khoản',
    DEBT: 'Công nợ', OTHER: 'Công nợ', COD: 'Tiền mặt',
  }[paymentMethod] || paymentMethod || '—';

  if (paymentStatus === 'PAID') return `${methodLabel} / Đã thanh toán`;

  if (paymentStatus === 'PARTIAL') {
    const paid = Number(paidAmount || 0);
    const remaining = Number(finalAmount || 0) - paid;
    const fmt = n => new Intl.NumberFormat('vi-VN').format(Math.round(n)) + ' đ';
    return `Thanh toán 1 phần — Còn nợ ${fmt(remaining)}`;
  }

  const isDebt = ['DEBT', 'OTHER'].includes((paymentMethod || '').toUpperCase());
  if (isDebt && paymentDeadline && paymentDeadline !== 'Thanh toán khi nhận hàng') {
    const m = paymentDeadline.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (m) {
      const deadline = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil((deadline - today) / 86400000);
      const dateStr = `${m[1]}/${m[2]}`;
      if (diffDays < 0) return `Công nợ — Quá hạn (${dateStr})`;
      if (diffDays === 0) return `Công nợ — Hạn hôm nay (${dateStr})`;
      return `Công nợ — Chờ thanh toán (hạn ${dateStr})`;
    }
    return `Công nợ — Chờ thanh toán (hạn ${paymentDeadline})`;
  }
  return `${methodLabel} / Chưa thanh toán`;
}