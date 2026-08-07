import { useLang } from '../../context/LangContext';
import { customerContractApi } from '../../api/customerContractApi';
import { X, FileText, CreditCard, CheckSquare, CheckCircle, Banknote } from 'lucide-react';
import { orderApi } from '../../api/services';
import { useToast } from '../common/Toast';
import { useState, useEffect } from 'react';
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

function formatDeliveryTime(o) {
  if (o.deliveryDatetime) return formatDate(o.deliveryDatetime);
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

function formatLogDate(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

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

function VatBreakdownBlock({ groups, total, light }) {
  if (!groups?.length) return null;
  const textMuted = light ? 'text-white/40' : 'text-faint';
  const textMain = light ? 'text-white/50' : 'text-faint';
  return (
    <div className="border-t border-white/10 pt-1.5 mt-1.5">
      <div className="flex justify-between">
        <span className={`text-xs ${textMuted}`}>VAT</span>
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

function resolveDeadlineDisplay(order) {
  const { paymentStatus, paymentMethod, paymentDeadline, status } = order;
  if (paymentStatus === 'PAID' || status === 'COMPLETED') return '—';
  if (paymentStatus === 'PARTIAL') {
    if (paymentDeadline && paymentDeadline !== 'Thanh toán khi nhận hàng') return paymentDeadline;
    return 'N/A';
  }
  const isDebt = ['DEBT', 'OTHER'].includes((paymentMethod || '').toUpperCase());
  if (!isDebt) return '—';
  if (paymentDeadline && paymentDeadline !== 'Thanh toán khi nhận hàng') return paymentDeadline;
  return 'N/A';
}

function ChangePaymentModal({ order, onClose, onSuccess }) {
  const toast = useToast();
  const { t } = useLang();
  const [method, setMethod] = useState(order.paymentMethod || 'CASH');
  const [loading, setLoading] = useState(false);

  // Chuyển sang công nợ chỉ được phép khi backend cho phép (`debtAllowed`):
  // khách cũ được miễn hợp đồng, khách mới thì bắt buộc phải có. Hỏi khi mở
  // modal thay vì đọc từ `order` — DTO đơn hàng không mang theo cờ này, và hợp
  // đồng có thể vừa được tải lên ở tab khác.
  //
  // Mặc định `null` (chưa biết) để không nháy nút Công nợ hiện rồi ẩn.
  const [debtAllowed, setDebtAllowed] = useState(null);
  useEffect(() => {
    let alive = true;
    if (!order.customerId) { setDebtAllowed(false); return; }
    customerContractApi.get(order.customerId)
      .then(d => { if (alive) setDebtAllowed(!!d?.debtAllowed); })
      .catch(() => { if (alive) setDebtAllowed(false); });
    return () => { alive = false; };
  }, [order.customerId]);

  const PAYMENT_METHOD_OPTIONS = [
    { value: 'CASH', label: t('payment', 'cash_icon') },
    { value: 'BANK_TRANSFER', label: t('payment', 'bank_transfer_icon') },
    // Đơn ĐANG là công nợ thì vẫn giữ lựa chọn để không khoá người dùng lại ở
    // một giá trị không chọn được — chỉ chặn việc CHUYỂN SANG công nợ.
    ...(debtAllowed || order.paymentMethod === 'DEBT'
      ? [{ value: 'DEBT', label: t('payment', 'debt_icon') }] : []),
  ];
  const handleSave = async () => {
    if (method === 'DEBT' && debtAllowed === false) {
      toast('Khách hàng chưa có hợp đồng nên không được chuyển sang công nợ.', 'error');
      return;
    }
    setLoading(true);
    try {
      await orderApi.updatePaymentMethod(order.id, method);
      toast('Cập nhật phương thức thanh toán thành công', 'success');
      onSuccess(); onClose();
    } catch { toast('Không thể cập nhật phương thức thanh toán', 'error'); }
    finally { setLoading(false); }
  };
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-xs p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-ink text-sm">Đổi phương thức thanh toán</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-2 text-muted"><X size={15} /></button>
        </div>
        <p className="text-xs text-muted mb-4">
          Đơn <span className="font-mono font-bold text-gold">{order.orderCode}</span> — chỉ áp dụng khi đơn đang <strong>Chờ thanh toán</strong>.
        </p>
        <div className="grid grid-cols-1 gap-2 mb-5">
          {PAYMENT_METHOD_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => setMethod(opt.value)}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all
                ${method === opt.value ? 'border-gold bg-gold/10 text-gold' : 'border-line-soft bg-surface text-ink hover:border-gold/40'}`}>
              <CreditCard size={13} />{opt.label}
              {method === opt.value && <CheckCircle size={13} className="ml-auto" />}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-line-soft text-sm text-muted hover:bg-surface-2">Huỷ</button>
          <button onClick={handleSave} disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-gold text-white text-sm font-semibold hover:bg-gold-strong disabled:opacity-60">
            {loading ? 'Đang lưu...' : 'Lưu'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmCompleteModal({ order, onClose, onSuccess }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const handleConfirm = async () => {
    setLoading(true);
    try {
      await orderApi.completeOrder(order.id);
      toast('Đơn hàng đã hoàn thành!', 'success');
      onSuccess(); onClose();
    } catch { toast('Không thể hoàn thành đơn hàng', 'error'); }
    finally { setLoading(false); }
  };
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-xs p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-ink text-sm">Xác nhận hoàn thành</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-2 text-muted"><X size={15} /></button>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/28 rounded-xl p-3 mb-4">
          <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300 mb-1">Đơn <span className="font-mono font-bold">{order.orderCode}</span></p>
          <p className="text-xs text-emerald-600 dark:text-emerald-300">Trạng thái → <strong>Hoàn thành</strong> · Thanh toán → <strong>Đã thanh toán</strong></p>
        </div>
        <p className="text-xs text-muted mb-5">Hành động này không thể hoàn tác.</p>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-line-soft text-sm text-muted hover:bg-surface-2">Huỷ</button>
          <button onClick={handleConfirm} disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 disabled:opacity-60">
            {loading ? 'Đang xử lý...' : '✓ Xác nhận'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PartialPaymentModal({ order, onClose, onSuccess }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [rawInput, setRawInput] = useState('');
  const alreadyPaid = Number(order.paidAmount || 0);
  const finalAmount = Number(order.finalAmount || 0);
  const remaining = Math.round(finalAmount - alreadyPaid);
  const handleInput = (e) => { const digits = e.target.value.replace(/\D/g, ''); setRawInput(digits); };
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
      toast(afterPay >= finalAmount ? 'Đã thanh toán đủ!' : 'Ghi nhận thanh toán thành công', 'success');
      onSuccess(); onClose();
    } catch (err) { toast(err?.response?.data?.message || 'Không thể ghi nhận thanh toán', 'error'); }
    finally { setLoading(false); }
  };
  const displayInput = rawInput ? new Intl.NumberFormat('vi-VN').format(Number(rawInput)) : '';
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-ink text-sm">Ghi nhận thanh toán</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-2 text-muted"><X size={15} /></button>
        </div>
        <div className="bg-canvas rounded-xl p-3 mb-4 space-y-1.5">
          <div className="flex justify-between text-xs"><span className="text-muted">Mã đơn</span><span className="font-mono font-bold text-gold">{order.orderCode}</span></div>
          <div className="flex justify-between text-xs"><span className="text-muted">Tổng đơn</span><span className="font-semibold text-ink">{formatPrice(finalAmount)}</span></div>
          {alreadyPaid > 0 && <div className="flex justify-between text-xs"><span className="text-muted">Đã thu</span><span className="font-semibold text-emerald-600 dark:text-emerald-300">{formatPrice(alreadyPaid)}</span></div>}
          <div className="flex justify-between text-xs border-t border-line-soft pt-1.5"><span className="text-muted font-medium">Còn lại</span><span className="font-bold text-orange-500">{formatPrice(remaining)}</span></div>
        </div>
        <div className="mb-2">
          <label className="text-xs text-muted mb-1.5 block">Số tiền thu lần này</label>
          <div className={`flex items-center border rounded-xl px-4 py-3 gap-2 transition-colors ${isOverpay ? 'border-red-300 dark:border-red-500/35 bg-red-50 dark:bg-red-500/10' : 'border-line bg-surface focus-within:border-gold'}`}>
            <Banknote size={15} className={isOverpay ? 'text-red-400' : 'text-gold'} />
            <input type="text" inputMode="numeric" placeholder="0" value={displayInput} onChange={handleInput}
              className="flex-1 outline-none text-sm font-semibold text-ink bg-transparent" />
            <span className="text-xs text-muted">đ</span>
          </div>
          {isOverpay && <p className="text-xs text-red-500 mt-1">Vượt quá số tiền còn lại ({formatPrice(remaining)})</p>}
        </div>
        {paidAmount > 0 && !isOverpay && (
          <div className={`rounded-xl p-3 mb-2 text-xs space-y-1 ${afterPay >= finalAmount ? 'bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/28' : 'bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/28'}`}>
            {afterPay >= finalAmount
              ? <p className="text-emerald-700 dark:text-emerald-300 font-medium">✓ Thanh toán đủ — đơn sẽ chuyển sang <strong>Hoàn thành</strong></p>
              : <><div className="flex justify-between text-blue-700 dark:text-blue-300"><span>Tổng đã thu sau lần này</span><span className="font-bold">{formatPrice(afterPay)}</span></div><div className="flex justify-between text-blue-600 dark:text-blue-300"><span>Còn nợ</span><span className="font-bold">{formatPrice(finalAmount - afterPay)}</span></div><p className="text-blue-500 pt-0.5">Đơn sẽ giữ trạng thái <strong>Chờ thanh toán</strong></p></>}
          </div>
        )}
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-line-soft text-sm text-muted hover:bg-surface-2">Huỷ</button>
          <button onClick={handleSave} disabled={loading || isEmpty || isOverpay}
            className="flex-1 py-2.5 rounded-xl bg-gold text-white text-sm font-semibold hover:bg-gold-strong disabled:opacity-50">
            {loading ? 'Đang lưu...' : 'Xác nhận thu'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────
export default function OrderDetailModal({ order: o, onClose, onRefresh }) {
  const { t } = useLang();
  const toast = useToast();
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showPartialModal, setShowPartialModal] = useState(false);

  const STATUS_LABEL = {
    PENDING: t('status', 'pending'), CONFIRMED: t('status', 'confirmed'),
    PREPARING: t('status', 'preparing'), READY: t('status', 'ready_to_ship'),
    DELIVERING: t('status', 'delivering'), PENDING_PAYMENT: t('status', 'completed_delivered'),
    COMPLETED: t('status', 'completed'), CANCELLED: t('status', 'cancelled'),
  };

  const ACTION_LABEL = {
    CREATED: t('order', 'create_order'), PREPARING: 'Bắt đầu chuẩn bị',
    DELIVERING: 'Bắt đầu giao hàng', PENDING_PAYMENT: t('status', 'pending_payment'),
    COMPLETED: 'Hoàn thành đơn', CANCELLED: 'Huỷ đơn',
    PARTIAL_PAYMENT: 'Thu tiền 1 phần', FULLY_PAID: 'Thanh toán đủ',
    PAYMENT_METHOD_UPDATED: 'Đổi phương thức TT', DEADLINE_EXTENDED: 'Gia hạn công nợ',
    ORDER_UPDATED: 'Sửa món/số lượng/giá (delta)', FAILED: 'Thất bại',
    // Thu tiền TRƯỚC khi giao (khách bị yêu cầu thanh toán trước)
    PREPAYMENT_FULL: 'Thu trước — đã đủ', PREPAYMENT_PARTIAL: 'Thu trước — chưa đủ',
    WAIVE_REMAINDER: 'Bỏ số lẻ',
  };

  const ACTION_STYLE = {
    CREATED: 'bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-500/28',
    PREPARING: 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/28',
    DELIVERING: 'bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-500/28',
    PENDING_PAYMENT: 'bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-500/28',
    COMPLETED: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/28',
    CANCELLED: 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-300 border-red-200 dark:border-red-500/28',
    PARTIAL_PAYMENT: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/28',
    FULLY_PAID: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/28',
    PREPAYMENT_FULL: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/28',
    PREPAYMENT_PARTIAL: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/28',
    WAIVE_REMAINDER: 'bg-canvas text-ink-2 border-line',
    PAYMENT_METHOD_UPDATED: 'bg-canvas text-ink-2 border-line',
    ORDER_UPDATED: 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/28',
  };

  const ROLE_LABEL = {
    SELLER: 'Bán hàng', WAREHOUSE: 'Kho', ACCOUNTANT: 'Kế toán',
    ADMIN: 'Admin', OWNER: 'Owner',
    SUPER_SELLER: 'Trưởng phòng KD', SUPER_WAREHOUSE: 'Quản lý kho',
    SUPER_ACCOUNTANT: 'Kế toán trưởng',
    DRIVER: 'Tài xế',
  };

  const handleActionSuccess = () => { onRefresh?.(); onClose(); };

  const deliveryAddr = o.deliveryAddress || o.shippingAddress || '—';
  const recipientName = o.contactName || o.receiverName || o.customerName || '—';
  const orderedByName = o.orderedByName || o.contactName || '—';

  const { groups: vatGroups, total: vatTotal } = buildVatBreakdownFromItems(o.items);
  const hasItemBreakdown = vatGroups.length > 0;

  // ── Tạm tính: dùng o.subtotal từ BE (gross), fallback tính từ items ─────────
  const subtotalDisplay = Number(o.subtotal) > 0
    ? Number(o.subtotal)
    : (o.items ?? []).reduce((s, item) => {
      const isBox = item.saleType === 'BOX' && item.unitsPerBox > 0;
      const price = isBox
        ? Number(item.unitPrice) * item.unitsPerBox
        : Number(item.unitPrice ?? 0);
      return s + price * Number(item.quantity ?? 1);
    }, 0);

  function parseDriverName(rawName) {
    if (!rawName?.trim()) return [];

    // Split bằng + hoặc - (có hoặc không có khoảng trắng)
    const parts = rawName.split(/\s*[-+]\s*/).map(p => p.trim()).filter(Boolean);

    if (parts.length === 0) return [];
    if (parts.length === 1) return [{ name: parts[0], count: 1 }];

    // Kiểm tra tất cả các phần có giống nhau không (case-insensitive)
    const normalized = parts.map(p => p.toLowerCase());
    const allSame = normalized.every(p => p === normalized[0]);

    if (allSame) {
      // Capitalize first letter
      const name = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
      return [{ name, count: parts.length }];
    }

    // Khác nhau → từng người 1 lượt
    return parts.map(p => ({ name: p, count: 1 }));
  }

  // ── Helper: lấy thời gian giao từ logs (action = DELIVERING) ─────────────────
  function getDeliveryTimeFromLogs(logs) {
    if (!logs?.length) return null;
    const deliveringLog = logs.find(l => l.action === 'DELIVERING');
    if (!deliveringLog?.createdAt) return null;
    return formatLogDate(deliveringLog.createdAt);
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-surface rounded-2xl shadow-2xl w-full animate-fadeIn flex flex-col"
          style={{ maxWidth: 'min(90vw, 900px)', maxHeight: '90vh' }}>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-line-soft shrink-0">
            <div>
              <p className="text-[10px] text-muted uppercase tracking-wider">Chi tiết đơn hàng</p>
              <h2 className="font-bold text-ink font-mono">{o.orderCode}</h2>
            </div>
            <div className="flex items-center gap-2 mr-3 flex-wrap justify-end">
              {canChangePayment(o) && (
                <button onClick={() => setShowPaymentModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-300 hover:bg-blue-100 dark:bg-blue-500/18 text-xs font-semibold">
                  <CreditCard size={13} /> Đổi TT
                </button>
              )}
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-muted hover:bg-surface-2"><X size={17} /></button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

            {/* Khách hàng + Thông tin đơn */}
            <div className="bg-canvas rounded-xl p-4">
              <div className="flex flex-col md:flex-row md:gap-6">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-muted uppercase tracking-wider mb-3">Thông tin khách hàng</p>
                  <div className="space-y-2.5">
                    <InfoRow label="Tên khách hàng" value={o.customerName || (o.customerType === 'RETAIL' ? 'Khách lẻ / Khách vãng lai' : '—')} />
                    <InfoRow label="Địa chỉ giao hàng" value={deliveryAddr} />
                    <InfoRow label="SĐT" value={o.customerPhone && !o.customerPhone.startsWith('KL-') ? o.customerPhone : '—'} />
                    <InfoRow label="Thời hạn thanh toán" value={resolveDeadlineDisplay(o)} />
                  </div>
                </div>
                <div className="hidden md:block w-px bg-surface-2 self-stretch mx-1" />
                <div className="block md:hidden h-px bg-surface-2 my-3" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-muted uppercase tracking-wider mb-3">Thông tin đơn</p>
                  <div className="space-y-2.5">
                    <InfoRow label="Ngày đặt hàng" value={formatDate(o.createdAt)} />
                    <InfoRow label="Tên người nhận" value={recipientName} />
                    <InfoRow label="Tên người đặt" value={orderedByName} />
                    <InfoRow label="Ngày/giờ giao hàng" value={formatDeliveryTime(o)} />
                  </div>
                </div>
              </div>
            </div>

            {/* Trạng thái */}
            <div className="bg-canvas rounded-xl p-4">
              <div className="flex flex-col md:flex-row md:gap-6">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-muted uppercase tracking-wide mb-1">Trạng thái đơn hàng</p>
                  <p className="text-sm font-semibold text-ink">{STATUS_LABEL[o.status] || o.status || '—'}</p>
                </div>
                <div className="hidden md:block w-px bg-surface-2 self-stretch mx-1" />
                <div className="block md:hidden h-px bg-surface-2 my-2" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-muted uppercase tracking-wide mb-1">Trạng thái thanh toán</p>
                  <p className="text-sm font-semibold text-ink">{formatPaymentDisplay(o, t)}</p>
                </div>
                {o.notes && (
                  <>
                    <div className="hidden md:block w-px bg-surface-2 self-stretch mx-1" />
                    <div className="block md:hidden h-px bg-surface-2 my-2" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-muted uppercase tracking-wide mb-1">Ghi chú</p>
                      <p className="text-sm font-medium text-ink">{o.notes}</p>
                    </div>
                  </>
                )}
                {o.receiptNumbers?.length > 0 && (
                  <>
                    <div className="hidden md:block w-px bg-surface-2 self-stretch mx-1" />
                    <div className="block md:hidden h-px bg-surface-2 my-2" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-muted uppercase tracking-wide mb-1">Số phiếu thu</p>
                      <div className="flex flex-wrap gap-1">
                        {o.receiptNumbers.map((rn, i) => (
                          <span key={i} className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/28 rounded-lg px-2 py-0.5">
                            {rn}
                          </span>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Chi tiết sản phẩm */}
            <div>
              <p className="text-xs font-bold text-muted uppercase tracking-wider mb-2">Chi tiết đơn hàng</p>
              <div className="bg-canvas rounded-xl overflow-hidden">
                {o.items?.map((item, i) => (
                  <div key={i}
                    className={`flex items-start justify-between px-4 py-3 ${i < o.items.length - 1 ? 'border-b border-line-soft' : ''}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-ink truncate">{item.productName}</p>
                      {item.variantName && <p className="text-xs text-muted">{item.variantName}</p>}
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        {item.saleType === 'BOX' ? (
                          <span className="text-[10px] font-semibold bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/28 rounded px-1.5 py-0.5">
                            📦 Thùng {item.unitsPerBox ? `(${item.unitsPerBox} ${item.unit}/thùng)` : ''}
                          </span>
                        ) : item.unit && (
                          <span className="text-[10px] text-muted bg-surface-2 rounded px-1.5 py-0.5">
                            ĐVT: {item.unit}
                          </span>
                        )}
                        {item.priceName && item.priceMode !== 'DISCOUNT_PERCENT' && (
                          <span className="text-[10px] text-gold bg-gold/10 rounded px-1.5 py-0.5">
                            {item.priceName}
                          </span>
                        )}
                        {(item.discountPercent ?? 0) > 0 && (
                          <span className="text-[10px] text-orange-600 dark:text-orange-300 bg-orange-50 dark:bg-orange-500/10 rounded px-1.5 py-0.5">
                            Giảm {item.discountPercent}%
                          </span>
                        )}
                        {(item.vatRate ?? 0) > 0 && (
                          <span className="text-[10px] text-muted bg-surface-2 rounded px-1.5 py-0.5">
                            VAT {item.vatRate}% · {item.vatMode === 'EXCLUSIVE' ? 'ngoài giá' : 'trong giá'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* ── Giá item: dùng unitPrice trực tiếp, KHÔNG reverse ── */}
                    <div className="text-right ml-3 shrink-0">
                      {(() => {
                        const isBox = item.saleType === 'BOX' && item.unitsPerBox > 0;
                        // unitPrice từ BE = giá gốc (gross cho INCLUSIVE)
                        // discountPercent chỉ là metadata badge, không dùng để tính ngược giá
                        const displayPrice = isBox
                          ? Number(item.unitPrice) * item.unitsPerBox
                          : Number(item.unitPrice ?? 0);
                        const lineTotal = displayPrice * Number(item.quantity ?? 1);
                        return (
                          <>
                            <p className="text-xs text-muted">
                              {item.quantity} × {formatPrice(displayPrice)}
                            </p>
                            <p className="font-bold text-sm text-ink">{formatPrice(lineTotal)}</p>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tổng tiền */}
            <div className="bg-chrome rounded-xl p-4 space-y-1.5">

              {/* Tạm tính — dùng o.subtotal từ BE (gross) */}
              <TotalRow label="Tạm tính" value={formatPrice(subtotalDisplay)} />

              {/* Giảm giá — dùng o.discountAmount từ BE (đã gồm item + bill discount) */}
              {Number(o.discountAmount) > 0 && (
                <TotalRow label="Giảm" value={`-${formatPrice(o.discountAmount)}`} />
              )}

              {/* Phụ phí */}
              {Number(o.surcharge) > 0 && (
                <TotalRow label="Phụ phí" value={`+${formatPrice(o.surcharge)}`} />
              )}

              {/* Tổng tiền */}
              <div className="flex justify-between pt-2 border-t border-white/10">
                <span className="text-sm font-bold text-white">Tổng tiền</span>
                <span className="text-sm font-bold text-gold">{formatPrice(o.finalAmount)}</span>
              </div>

              {/* VAT */}
              {hasItemBreakdown ? (
                <VatBreakdownBlock groups={vatGroups} total={vatTotal} light />
              ) : Number(o.vatAmount) > 0 ? (
                <div className="border-t border-white/10 pt-1.5 mt-1.5">
                  <div className="flex justify-between">
                    <span className="text-xs text-white/40">VAT</span>
                    <span className="text-xs text-white/50">{formatPrice(o.vatAmount)}</span>
                  </div>
                </div>
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

            {/* Tài xế giao hàng */}
            {o.deliveryInfo && o.deliveryInfo.length > 0 && (
              <div>
                <p className="text-l font-bold text-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  🚚 Tài xế giao hàng
                </p>

                {(() => {
                  const deliveryTime = getDeliveryTimeFromLogs(o.logs);
                  return deliveryTime ? (
                    <p className="text-md text-muted mb-1">
                      ⏱️ Bắt đầu giao: <span className="font-medium text-ink">{deliveryTime}</span>
                    </p>
                  ) : null;
                })()}

                {/* Nhóm theo loại xe */}
                {Object.entries(
                  o.deliveryInfo.reduce((acc, d) => {
                    const key = d.type === 'TRUCK' ? 'Xe tải' : 'Xe máy';
                    if (!acc[key]) acc[key] = [];
                    acc[key].push(d);
                    return acc;
                  }, {})
                ).map(([type, drivers]) => (
                  <div key={type} className="mt-1.5">
                    <p className="text-md text-muted mb-1.5">{type === 'Xe tải' ? '🚛' : '🛵'} Loại: <span className="font-semibold text-ink">{type}</span></p>
                    <div className="flex flex-wrap gap-2">
                      {drivers.map((d, i) => (
                        <span key={i}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-500/28">
                          {d.trips > 1 ? `${d.name} x${d.trips} lượt` : d.name}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Lịch sử thao tác */}
            {o.logs && o.logs.length > 0 && (
              <div>
                <p className="text-xs font-bold text-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  🕐 Lịch sử thao tác
                </p>
                <div className="bg-canvas rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-line-soft">
                        {[t('common', 'actions'), 'Người thực hiện', t('common', 'role'), t('common', 'note'), 'Thời gian'].map(h => (
                          <th key={h} className="text-left text-[10px] font-bold text-muted uppercase tracking-wider px-3 py-2 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {o.logs.map((l, i) => (
                        <tr key={l.id} className={i < o.logs.length - 1 ? 'border-b border-line-soft' : ''}>
                          <td className="px-3 py-2">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border whitespace-nowrap ${ACTION_STYLE[l.action] || 'bg-canvas text-ink-2 border-line'}`}>
                              {ACTION_LABEL[l.action] || l.action}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-medium text-ink whitespace-nowrap">{l.actorName || '—'}</td>
                          <td className="px-3 py-2 text-muted whitespace-nowrap">{ROLE_LABEL[l.actorRole] || l.actorRole || '—'}</td>
                          <td className="px-3 py-2 text-muted max-w-[160px] truncate">{l.note || '—'}</td>
                          <td className="px-3 py-2 text-muted whitespace-nowrap">{formatLogDate(l.createdAt)}</td>
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

      {showPaymentModal && (
        <ChangePaymentModal order={o} onClose={() => setShowPaymentModal(false)} onSuccess={handleActionSuccess} />
      )}
      {showCompleteModal && (
        <ConfirmCompleteModal order={o} onClose={() => setShowCompleteModal(false)} onSuccess={handleActionSuccess} />
      )}
      {showPartialModal && (
        <PartialPaymentModal order={o} onClose={() => setShowPartialModal(false)} onSuccess={handleActionSuccess} />
      )}
    </>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-muted uppercase tracking-wide">{label}</span>
      <span className="text-sm font-medium text-ink leading-snug">{value}</span>
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

function formatPaymentDisplay(order, t) {
  const { paymentMethod, paymentStatus, paymentDeadline, paidAmount, finalAmount } = order;
  const methodLabel = {
    CASH: t('payment', 'cash'), BANK_TRANSFER: t('payment', 'bank_transfer'),
    TRANSFER: t('payment', 'bank_transfer'), BANK: t('payment', 'bank_transfer'),
    DEBT: t('payment', 'debt'), OTHER: t('payment', 'debt'), COD: t('payment', 'cash'),
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