// src/pages/accountant/IncomeCreateModal.jsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { incomeApi, bankApi } from '../../api/services';
import { accountantOrderApi } from '../../api/accountantApi';
import api from '../../api/axios';
import { useToast } from '../../components/common/Toast';
import { formatVND } from '../../utils/format.js';
import {
  X, TrendingUp, Send, CreditCard, Banknote,
  Search, Plus, Trash2, Upload, ShoppingCart,
  AlertCircle, FileText, ChevronRight, CheckCircle2, Clock, RefreshCw,
  User, Copy,
} from 'lucide-react';

function parseVND(s) { return Number(String(s).replace(/[^0-9]/g, '')) || 0; }

/** Viết hoa chữ cái đầu mỗi từ (hỗ trợ Unicode / tiếng Việt) */
function capitalizeWords(str) {
  if (!str) return '';
  return str
    .split(' ')
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

// ── Hiển thị nhãn payrollRole ────────────────────────────────────────────────
function payrollRoleLabel(r) {
  const map = {
    SELLER: 'Kinh doanh',
    SUPER_SELLER: 'TP Kinh doanh',
    DRIVER: 'Tài xế',
    WAREHOUSE: 'Kho',
    ACCOUNTANT: 'Kế toán',
    SUPER_ACCOUNTANT: 'KT Trưởng',
    ADMIN: 'Quản trị',
    OWNER: 'Chủ',
    FACTORY_WORKER: 'CN Sản xuất',
    FACTORY_MANAGER: 'QL Sản xuất',
  };
  return map[r] || r || '';
}

// ── Modal chi tiết các đơn đã chọn ───────────────────────────────────────────
function OrderSummaryModal({ orders, onClose }) {
  const total = orders.reduce((s, o) => s + Math.round(o.remainingAmount ?? o.finalAmount ?? 0), 0);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between p-5 border-b border-hairline flex-shrink-0">
          <div className="flex items-center gap-2">
            <ShoppingCart size={18} className="text-gold" />
            <h3 className="font-bold text-ink">Chi tiết đơn hàng ({orders.length})</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-canvas text-muted">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-5 space-y-2">
          {orders.map(o => (
            <div key={o.id} className="flex items-center justify-between py-2.5 px-3 bg-canvas rounded-xl">
              <div>
                <p className="font-mono text-xs font-bold text-gold">{o.orderCode}</p>
                <p className="text-sm text-ink">{o.customerName || 'Khách lẻ'}</p>
              </div>
              <p className="text-sm font-bold text-ink">
                {formatVND(Math.round(o.remainingAmount ?? o.finalAmount ?? 0))}
                {o.paymentStatus === 'PARTIAL' && (
                  <span className="block text-xs font-normal text-amber-500 text-right">
                    {formatVND(Math.round(o.finalAmount ?? 0))}
                  </span>
                )}
              </p>
            </div>
          ))}
        </div>
        <div className="p-5 border-t border-hairline flex-shrink-0">
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm font-semibold text-muted">Tổng cần thu</span>
            <span className="text-lg font-bold text-gold">{formatVND(total)}</span>
          </div>
          <button onClick={onClose} className="w-full py-2.5 rounded-xl border border-hairline-2 text-sm font-semibold text-muted hover:bg-canvas transition">
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal xác nhận thu thiếu đơn cuối ────────────────────────────────────────
function PartialConfirmModal({ info, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="p-5 border-b border-hairline">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle size={18} className="text-amber-500" />
            <h3 className="font-bold text-ink">Xác nhận thu thiếu</h3>
          </div>
          <p className="text-sm text-muted">
            Số tiền thu <span className="font-bold text-ink">{formatVND(info.collected)}</span> thiếu{' '}
            <span className="font-bold text-red-500">{formatVND(info.shortfall)}</span> so với tổng đơn hàng{' '}
            <span className="font-bold text-ink">{formatVND(info.orderTotal)}</span>.
          </p>
        </div>

        <div className="p-5 space-y-3">
          <p className="text-xs font-semibold text-muted uppercase tracking-wide">
            Đơn bị thiếu: <span className="font-mono text-gold">{info.lastOrder.orderCode}</span>
          </p>
          <div className="bg-canvas rounded-xl p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted">Cần thu</span>
              <span className="font-bold">
                {formatVND(Math.round(info.lastOrder.remainingAmount ?? info.lastOrder.finalAmount ?? 0))}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Số tiền sẽ thu</span>
              <span className="font-bold text-amber-600 dark:text-amber-300">{formatVND(info.lastOrderRemaining)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Còn thiếu</span>
              <span className="font-bold text-red-500">{formatVND(info.shortfall)}</span>
            </div>
          </div>

          <p className="text-xs text-muted">Chọn cách xử lý cho đơn này:</p>

          <button
            onClick={() => onConfirm('PARTIAL')}
            className="w-full flex items-start gap-3 p-3 rounded-xl border-2 border-amber-200 dark:border-amber-500/28 bg-amber-50 dark:bg-amber-500/10 hover:border-amber-400 transition text-left"
          >
            <Clock size={18} className="text-amber-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-amber-700 dark:text-amber-300">Thu 1 phần</p>
              <p className="text-xs text-amber-600 dark:text-amber-300 mt-0.5">
                Ghi nhận thu {formatVND(info.lastOrderRemaining)}, đơn vẫn ở trạng thái <strong>Chờ thanh toán</strong>. Còn thiếu {formatVND(info.shortfall)}.
              </p>
            </div>
          </button>

          <button
            onClick={() => onConfirm('FULL')}
            className="w-full flex items-start gap-3 p-3 rounded-xl border-2 border-green-200 dark:border-green-500/28 bg-green-50 dark:bg-green-500/10 hover:border-green-400 transition text-left"
          >
            <CheckCircle2 size={18} className="text-green-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-green-700 dark:text-green-300">Ghi nhận đã thu đủ</p>
              <p className="text-xs text-green-600 dark:text-green-300 mt-0.5">
                Chấp nhận lệch {formatVND(info.shortfall)}, đánh dấu đơn <strong>Hoàn thành</strong>.
              </p>
            </div>
          </button>
        </div>

        <div className="px-5 pb-5">
          <button
            onClick={onCancel}
            className="w-full py-2.5 rounded-xl border border-hairline-2 text-sm font-semibold text-muted hover:bg-canvas transition"
          >
            Huỷ, kiểm tra lại
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal xác nhận thu DƯ ─────────────────────────────────────────────────
function OverpayConfirmModal({ info, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="p-5 border-b border-hairline">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle size={18} className="text-orange-500" />
            <h3 className="font-bold text-ink">Xác nhận thu dư</h3>
          </div>
          <p className="text-sm text-muted">
            Số tiền thu <span className="font-bold text-ink">{formatVND(info.collected)}</span> nhiều hơn{' '}
            tổng cần thu <span className="font-bold text-ink">{formatVND(info.orderTotal)}</span>.
          </p>
        </div>

        <div className="p-5 space-y-3">
          <div className="bg-orange-50 dark:bg-orange-500/10 rounded-xl p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted">Tổng cần thu</span>
              <span className="font-bold text-ink">{formatVND(info.orderTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Số tiền thực thu</span>
              <span className="font-bold text-ink">{formatVND(info.collected)}</span>
            </div>
            <div className="flex justify-between border-t border-orange-200 dark:border-orange-500/28 pt-1 mt-1">
              <span className="font-semibold text-orange-700 dark:text-orange-300">Số tiền thu dư</span>
              <span className="font-bold text-orange-600 dark:text-orange-300">{formatVND(info.overpayAmount)}</span>
            </div>
          </div>

          <p className="text-xs text-muted">
            Phiếu thu sẽ ghi nhận đầy đủ <b>{formatVND(info.collected)}</b> và đánh dấu <b>thu dư</b>.
            Sau khi tạo phiếu, bạn có thể lập phiếu chi hoàn lại phần dư cho khách.
          </p>

          <button
            onClick={onConfirm}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-orange-500 text-white text-sm font-bold hover:bg-orange-600 transition"
          >
            <CheckCircle2 size={16} /> Xác nhận thu dư
          </button>
        </div>

        <div className="px-5 pb-5">
          <button
            onClick={onCancel}
            className="w-full py-2.5 rounded-xl border border-hairline-2 text-sm font-semibold text-muted hover:bg-canvas transition"
          >
            Huỷ, kiểm tra lại
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────
export default function IncomeCreateModal({ onClose, onCreated, editVoucher = null }) {
  const isEdit = !!editVoucher;
  const toast = useToast();
  const fileRef = useRef();
  const searchDebounce = useRef(null);
  const orderDropRef = useRef();
  const [receiptNumber, setReceiptNumber] = useState('');
  const [suggestedReceiptNumber, setSuggestedReceiptNumber] = useState('');

  // Đơn hàng
  const [orderSearch, setOrderSearch] = useState('');
  const [orderResults, setOrderResults] = useState([]);
  const [orderLoading, setOrderLoading] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [showOrderDrop, setShowOrderDrop] = useState(false);
  const [showOrderDetail, setShowOrderDetail] = useState(false);

  // Số tiền thực thu
  const [collectedAmount, setCollectedAmount] = useState('');
  const [collectedError, setCollectedError] = useState('');
  const [showPartialConfirm, setShowPartialConfirm] = useState(false);
  const [partialInfo, setPartialInfo] = useState(null);
  const [overpayInfo, setOverpayInfo] = useState(null);
  const [showOverpayConfirm, setShowOverpayConfirm] = useState(false);
  const [pendingHandling, setPendingHandling] = useState(null);

  // ─── Form ──────────────────────────────────────────────────────────────────
  // customerName = tên KHÁCH HÀNG (auto-fill từ đơn hàng đầu tiên)
  const [customerName, setCustomerName] = useState('');
  // payerName = tên NGƯỜI NỘP TIỀN thực tế (nhân viên hoặc nhập tay)
  const [payerName, setPayerName] = useState('');

  const [reason, setReason] = useState('');
  const [paymentType, setPaymentType] = useState('CASH');
  const [bankName, setBankName] = useState('');
  const [banks, setBanks] = useState([]);
  const [bankRef, setBankRef] = useState('');
  const [items, setItems] = useState([{ id: 1, itemName: 'Khoản thu 1', amount: '', note: '' }]);
  const [images, setImages] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [staleWarning, setStaleWarning] = useState(null);
  const [reloading, setReloading] = useState(false);

  // ─── Dropdown người nộp tiền (nhân viên) ───────────────────────────────────
  const [payerSearch, setPayerSearch] = useState('');
  const [payerResults, setPayerResults] = useState([]);
  const [payerLoading, setPayerLoading] = useState(false);
  const [showPayerDrop, setShowPayerDrop] = useState(false);
  const payerDropRef = useRef();
  const payerDebounce = useRef(null);

  // ─── Tìm nhân viên (seller / driver theo payrollRole) ─────────────────────
  const searchEmployees = useCallback(async (q) => {
    setPayerLoading(true);
    try {
      const res = await incomeApi.suggestEmployees(q || '');
      setPayerResults(res.data?.data ?? []);
    } catch {
      setPayerResults([]);
    } finally {
      setPayerLoading(false);
    }
  }, []);

  const handlePayerSearchChange = (val) => {
    setPayerSearch(val);
    setPayerName(val); // cho phép nhập tự do
    clearTimeout(payerDebounce.current);
    payerDebounce.current = setTimeout(() => searchEmployees(val), 400);
  };

  const handlePayerInputFocus = () => {
    setShowPayerDrop(true);
    if (payerResults.length === 0) searchEmployees(payerSearch);
  };

  const selectEmployee = (emp) => {
    const val = `[NN] ${emp.fullName}`;
    setPayerName(val);
    setPayerSearch(val);
    setShowPayerDrop(false);
  };

  /** Khi rời ô nhập: viết hoa chữ cái đầu nếu nhập tay (không có tiền tố [NN]) */
  const handlePayerBlur = () => {
    setTimeout(() => {
      if (payerName && !payerName.startsWith('[NN]')) {
        const capitalized = capitalizeWords(payerName);
        setPayerName(capitalized);
        setPayerSearch(capitalized);
      }
      setShowPayerDrop(false);
    }, 200);
  };

  // ─── Re-fetch đơn đang chọn ───────────────────────────────────────────────
  const reloadSelectedOrders = useCallback(async () => {
    if (selectedOrders.length === 0) return;
    setReloading(true);
    try {
      const updated = await Promise.all(
        selectedOrders.map(o =>
          api.get(`/api/accountant/orders/${o.id}`)
            .then(r => r.data?.data || r.data)
            .catch(() => o)
        )
      );
      setSelectedOrders(updated);
      setCollectedAmount('');
      setCollectedError('');
      setPartialInfo(null);
      setOverpayInfo(null);
      setPendingHandling(null);
      setStaleWarning(null);
      toast('Đã cập nhật thông tin đơn hàng', 'success');
    } catch {
      toast('Lỗi tải lại đơn hàng', 'error');
    } finally {
      setReloading(false);
    }
  }, [selectedOrders]);

  const orderTotal = selectedOrders.reduce(
    (s, o) => s + Math.round(o.remainingAmount ?? o.finalAmount ?? 0), 0
  );

  const collectedNum = parseVND(collectedAmount);
  const manualTotal = items.reduce((s, i) => s + parseVND(i.amount), 0);
  const hasOrders = selectedOrders.length > 0;
  const displayTotal = hasOrders ? (collectedAmount ? collectedNum : orderTotal) : manualTotal;

  // ─── Đóng dropdown khi click ngoài ─────────────────────────────────────────
  useEffect(() => {
    const fn = (e) => {
      if (orderDropRef.current && !orderDropRef.current.contains(e.target))
        setShowOrderDrop(false);
      if (payerDropRef.current && !payerDropRef.current.contains(e.target))
        setShowPayerDrop(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  // ─── Nạp dữ liệu phiếu cũ khi SỬA ────────────────────────────────────────
  useEffect(() => {
    if (!editVoucher) return;
    setReceiptNumber(editVoucher.receiptNumber || '');
    setCustomerName(editVoucher.customerName || '');
    setPayerName(editVoucher.payerName || '');
    setPayerSearch(editVoucher.payerName || '');
    setReason(editVoucher.reason || '');
    setPaymentType(editVoucher.paymentType || 'CASH');
    setBankName(editVoucher.bankName || '');
    setBankRef(editVoucher.bankRef || '');
    if (editVoucher.items?.length) {
      setItems(editVoucher.items.map((it, i) => ({
        id: i + 1, itemName: it.itemName || `Khoản thu ${i + 1}`,
        amount: String(it.amount ?? ''), note: it.note || '',
      })));
    }
    if (editVoucher.imageUrls?.length) {
      setImages(editVoucher.imageUrls.map((url, i) => ({ id: i + 1, uploadedUrl: url, preview: url })));
    }

    const codes = editVoucher.linkedOrderCodes || [];
    const allocs = editVoucher.orderAllocations || {};
    if (codes.length) {
      Promise.all(codes.map(code =>
        api.get(`/api/accountant/orders/by-code/${encodeURIComponent(code)}`)
          .then(r => r.data?.data || r.data).catch(() => null)))
        .then(list => {
          const orders = list.filter(Boolean).map(o => {
            const fin = Math.round(o.finalAmount ?? 0);
            const curRem = Math.round(o.remainingAmount ?? 0);
            const mine = allocs[o.orderCode] != null ? Math.round(Number(allocs[o.orderCode])) : 0;
            const restored = Math.min(fin, curRem + mine);
            return { ...o, remainingAmount: restored, _realRemaining: curRem };
          });
          setSelectedOrders(orders);
          setCollectedAmount(String(Math.round(editVoucher.collectedAmount ?? orders.reduce(
            (s, o) => s + (o.remainingAmount || 0), 0))));
        });
    }
  }, [editVoucher]);

  // Gợi ý số phiếu thu kế tiếp
  useEffect(() => {
    incomeApi.nextReceiptNumber()
      .then(res => {
        const suggestion = res.data?.data ?? res.data ?? '';
        if (suggestion) setSuggestedReceiptNumber(String(suggestion));
      })
      .catch(() => {});
  }, []);

  // Reset collected khi thay đổi danh sách đơn
  const prefillDone = useRef(!isEdit);
  useEffect(() => {
    if (isEdit && !prefillDone.current) { prefillDone.current = true; return; }
    setCollectedAmount('');
    setCollectedError('');
    setPartialInfo(null);
    setOverpayInfo(null);
    setPendingHandling(null);
  }, [selectedOrders.length]);

  // Danh mục ngân hàng
  useEffect(() => {
    bankApi.list()
      .then(res => setBanks(res.data?.data ?? res.data ?? []))
      .catch(() => {});
  }, []);

  // ─── Tìm đơn PENDING_PAYMENT ──────────────────────────────────────────────
  const searchOrders = useCallback(async (q) => {
    setOrderLoading(true);
    try {
      const res = await api.get('/api/accountant/orders/pending-payment', {
        params: { search: q || '', page: 0, size: 20 }
      });
      const content = res.data?.data?.content || [];
      const selectedIds = new Set(selectedOrders.map(o => o.id));
      setOrderResults(content.filter(o => !selectedIds.has(o.id)));
    } catch {
      setOrderResults([]);
    } finally {
      setOrderLoading(false);
    }
  }, [selectedOrders]);

  const handleOrderSearchChange = (val) => {
    setOrderSearch(val);
    clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => searchOrders(val), 600);
  };

  const handleOrderInputFocus = () => {
    setShowOrderDrop(true);
    if (orderResults.length === 0) searchOrders(orderSearch);
  };

  const selectOrder = (order) => {
    if (selectedOrders.find(o => o.id === order.id)) return;
    const newSelected = [...selectedOrders, order];
    setSelectedOrders(newSelected);
    updateAutoFields(newSelected);
    setOrderResults(prev => prev.filter(o => o.id !== order.id));
    setOrderSearch('');
    setShowOrderDrop(false);
  };

  const removeOrder = (orderId) => {
    const newSelected = selectedOrders.filter(o => o.id !== orderId);
    setSelectedOrders(newSelected);
    updateAutoFields(newSelected);
  };

  // ─── Auto-fill customerName + reason khi chọn đơn ─────────────────────────
  const updateAutoFields = (orders) => {
    if (orders.length === 0) {
      setCustomerName('');
      setReason('');
      // KHÔNG reset payerName — user tự chọn / nhập
      return;
    }
    // customerName = luôn lấy tên KH đơn ĐẦU TIÊN
    const firstCustomer = orders[0].customerName || 'Khách lẻ';
    setCustomerName(firstCustomer);

    // reason auto-fill
    if (orders.length === 1) {
      setReason(`Thu tiền đơn hàng: ${orders[0].orderCode}`);
    } else {
      setReason(`Thu tiền cho các đơn hàng: ${orders.map(o => o.orderCode).join(', ')}`);
    }
  };

  // ─── Validate số tiền thu ──────────────────────────────────────────────────
  const validateCollected = (collected) => {
    if (!hasOrders) return { valid: true };
    if (!collected || collected <= 0) return { valid: false, error: 'Vui lòng nhập số tiền thực thu' };
    if (collected > orderTotal) {
      return { valid: true, partial: false, overpay: collected - orderTotal };
    }
    if (collected === orderTotal) return { valid: true, partial: false };

    let remaining = collected;
    for (let i = 0; i < selectedOrders.length; i++) {
      const orderAmt = Math.round(selectedOrders[i].remainingAmount ?? selectedOrders[i].finalAmount ?? 0);
      const isLast = i === selectedOrders.length - 1;

      if (remaining >= orderAmt) {
        remaining -= orderAmt;
      } else {
        if (!isLast || remaining <= 0) {
          const shortOrders = selectedOrders.slice(i);
          return {
            valid: false,
            error: `Tổng tiền thu không đủ cho ${shortOrders.map(o => o.orderCode).join(', ')}. Vui lòng kiểm tra lại.`
          };
        }
        return {
          valid: true,
          partial: true,
          lastOrder: selectedOrders[i],
          lastOrderRemaining: remaining,
          shortfall: orderAmt - remaining,
        };
      }
    }
    return { valid: true, partial: false };
  };

  const handleCollectedChange = (val) => {
    setCollectedAmount(val);
    setCollectedError('');
    setPendingHandling(null);
    setPartialInfo(null);
    setOverpayInfo(null);
    if (!val) return;
    const num = parseVND(val);
    const result = validateCollected(num);
    if (!result.valid) {
      setCollectedError(result.error);
    } else if (result.partial) {
      setPartialInfo({ ...result, collected: num, orderTotal });
    } else if (result.overpay > 0) {
      setOverpayInfo({ amount: result.overpay });
    }
  };

  // Items manual
  const addItem = () => setItems(p => [...p, { id: Date.now(), itemName: `Khoản thu ${p.length + 1}`, amount: '', note: '' }]);
  const removeItem = (id) => setItems(p => p.filter(i => i.id !== id));
  const updateItem = (id, k, v) => setItems(p => p.map(i => i.id === id ? { ...i, [k]: v } : i));

  // Upload ảnh
  const handleImageChange = async (e) => {
    for (const file of Array.from(e.target.files)) {
      const preview = URL.createObjectURL(file);
      const tmp = { id: Date.now() + Math.random(), file, url: preview, uploading: true, uploadedUrl: null };
      setImages(p => [...p, tmp]);
      try {
        const res = await incomeApi.uploadImage(file);
        const uploaded = res.data?.data?.imageUrl || res.data?.imageUrl || '';
        if (!uploaded) throw new Error();
        setImages(p => p.map(img => img.id === tmp.id ? { ...img, uploading: false, uploadedUrl: uploaded } : img));
      } catch {
        setImages(p => p.filter(img => img.id !== tmp.id));
        toast('Lỗi upload ảnh', 'error');
      }
    }
    e.target.value = '';
  };

  // ─── Submit ────────────────────────────────────────────────────────────────
  const doSubmit = async (lastOrderHandling) => {
    setSubmitting(true);
    try {
      let submitItems;
      const collected = hasOrders ? collectedNum : null;

      if (hasOrders) {
        submitItems = [{
          itemName: `Thu tiền đơn hàng: ${selectedOrders.map(o => o.orderCode).join(', ')}`,
          amount: collected,
          note: null,
        }];
      } else {
        submitItems = items
          .filter(i => i.itemName.trim() && parseVND(i.amount) > 0)
          .map(i => ({ itemName: i.itemName.trim(), amount: parseVND(i.amount), note: i.note.trim() || null }));
      }

      const payload = {
        customerName: customerName.trim() || null,
        payerName: payerName.trim() || null,
        reason: reason.trim(),
        paymentType,
        bankName: paymentType === 'BANK_TRANSFER' ? bankName.trim() : undefined,
        bankRef: paymentType === 'BANK_TRANSFER' ? bankRef.trim() : undefined,
        linkedOrderCodes: hasOrders ? selectedOrders.map(o => o.orderCode) : undefined,
        collectedAmount: collected,
        lastOrderHandling: lastOrderHandling || undefined,
        items: submitItems,
        imageUrls: images.filter(img => img.uploadedUrl).map(img => img.uploadedUrl),
        receiptNumber: (receiptNumber.trim() || suggestedReceiptNumber),
      };

      if (hasOrders) {
        payload.expectedOrderAmounts = selectedOrders.map(o => ({
          orderCode: o.orderCode,
          expectedRemainingAmount: Math.round(
            isEdit
              ? (o._realRemaining ?? o.remainingAmount ?? o.finalAmount ?? 0)
              : (o.remainingAmount ?? o.finalAmount ?? 0)
          ),
        }));
      }

      const res = await (isEdit
        ? incomeApi.update(editVoucher.id, payload)
        : incomeApi.create(payload)
      );

      const data = res.data;
      if (data.message !== 'OK') {
        const cleanMessage = (data.message || 'Lỗi khi tạo phiếu').replace(/\\"/g, '').replace(/"/g, '');
        toast(cleanMessage, 'error');
        return;
      }

      toast(isEdit ? 'Đã lưu thay đổi phiếu thu' : 'Phiếu thu đã được tạo thành công', 'success');
      onCreated();
    } catch (e) {
      if (e?.response?.status === 409) {
        const body = e.response.data?.data || e.response.data;
        setStaleWarning({
          message: body?.message || 'Số tiền đơn hàng đã thay đổi',
          actualRemainingAmount: body?.actualRemainingAmount,
          paidAmount: body?.paidAmount,
          orderCode: body?.orderCode,
        });
        return;
      }
      toast(e?.response?.data?.message || 'Lỗi khi tạo phiếu', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    const effectiveReceiptNumber = receiptNumber.trim() || suggestedReceiptNumber;
    if (!effectiveReceiptNumber) { toast('Số phiếu thu là bắt buộc', 'error'); return; }
    if (!reason.trim()) { toast('Lý do thu là bắt buộc', 'error'); return; }
    if (paymentType === 'BANK_TRANSFER') {
      if (!bankName.trim()) { toast('Vui lòng nhập tên ngân hàng', 'error'); return; }
      if (!bankRef.trim()) { toast('Vui lòng nhập mã tham chiếu giao dịch', 'error'); return; }
    }
    if (images.some(img => img.uploading)) { toast('Đang tải ảnh, vui lòng chờ...', 'warning'); return; }

    if (hasOrders) {
      if (!collectedNum) { toast('Vui lòng nhập số tiền thực thu', 'error'); return; }
      const validation = validateCollected(collectedNum);
      if (!validation.valid) { toast(validation.error, 'error'); return; }

      if (validation.partial) {
        setPartialInfo({ ...validation, collected: collectedNum, orderTotal });
        setShowPartialConfirm(true);
        return;
      }
      if (validation.overpay > 0) {
        setShowOverpayConfirm(true);
        return;
      }
      await doSubmit(null);
    } else {
      const validItems = items.filter(i => i.itemName.trim() && parseVND(i.amount) > 0);
      if (validItems.length === 0) { toast('Phải có ít nhất 1 khoản thu hợp lệ', 'error'); return; }
      await doSubmit(null);
    }
  };

  const handlePartialConfirm = async (handling) => {
    setShowPartialConfirm(false);
    await doSubmit(handling);
  };

  // Trạng thái collected amount
  const collectedStatus = (() => {
    if (!hasOrders || !collectedNum) return null;
    if (collectedError) return 'error';
    if (collectedNum === orderTotal) return 'exact';
    if (partialInfo) return 'partial';
    if (collectedNum > orderTotal) return 'overpay';
    return null;
  })();

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">

          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-hairline flex-shrink-0">
            <div className="flex items-center gap-3">
              <TrendingUp size={20} className="text-gold" />
              <div>
                <h2 className="text-lg font-bold text-ink">{isEdit ? 'Sửa phiếu thu' : 'Tạo phiếu thu'}</h2>
                <p className="text-xs text-muted">Có hiệu lực ngay, không cần duyệt</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-canvas text-muted transition">
              <X size={20} />
            </button>
          </div>

          {/* Body */}
          <div className="overflow-y-auto flex-1 p-5 space-y-4">

            {/* ══════════════ Chọn đơn hàng ══════════════ */}
            <div>
              <label className="block text-sm font-semibold text-ink mb-1.5 flex items-center gap-1.5">
                <ShoppingCart size={14} className="text-gold" />
                Chọn đơn hàng cần thu tiền
                <span className="text-xs font-normal text-muted ml-1">(tuỳ chọn)</span>
              </label>

              <div className="relative" ref={orderDropRef}>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    value={orderSearch}
                    onChange={e => handleOrderSearchChange(e.target.value)}
                    onFocus={handleOrderInputFocus}
                    placeholder="Nhập mã đơn hoặc tên khách hàng..."
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-hairline-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40"
                  />
                  {orderLoading && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
                  )}
                </div>

                {showOrderDrop && (
                  <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-surface border border-hairline-2 rounded-xl shadow-xl max-h-52 overflow-y-auto">
                    {orderResults.length === 0 ? (
                      <div className="px-4 py-6 text-center text-sm text-muted">
                        {orderLoading ? 'Đang tìm...' : 'Không có đơn chờ thanh toán'}
                      </div>
                    ) : (
                      orderResults.map(o => (
                        <button
                          key={o.id}
                          onClick={() => selectOrder(o)}
                          className="w-full text-left px-4 py-3 hover:bg-canvas transition border-b border-hairline last:border-0"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <p className="font-mono text-xs font-bold text-gold">{o.orderCode}</p>
                                {o.prepaymentOrder && (
                                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full
                                    bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/28">
                                    Thu trước khi giao
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-ink">{o.customerName || 'Khách lẻ'}</p>
                            </div>
                            <span className="text-sm font-bold text-ink">
                              {formatVND(Math.round(o.remainingAmount ?? o.finalAmount ?? 0))}
                              {o.paymentStatus === 'PARTIAL' && (
                                <span className="block text-xs font-normal text-amber-500">
                                  Còn lại / {formatVND(Math.round(o.finalAmount ?? 0))}
                                </span>
                              )}
                            </span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Ghi chú đơn thu trước khi giao */}
              {hasOrders && selectedOrders.some(o => o.prepaymentOrder) && (
                <div className="mt-2 px-3 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/28
                  text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                  <b>Có đơn "Thu trước khi giao".</b> Phiếu thu sẽ chỉ ghi nhận <b>ĐÃ THU TIỀN</b> —
                  đơn vẫn ở trạng thái "Đang chuẩn bị" để kho giao hàng.
                  Khi thu đủ, kho mới được bấm "Bắt đầu giao hàng".
                </div>
              )}

              {/* Tóm tắt đơn đã chọn */}
              {hasOrders && (
                <div className="mt-2 bg-canvas rounded-xl border border-gold/20 p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-ink">
                        {selectedOrders.length} đơn hàng đang chọn:
                      </span>
                      <span className="text-sm font-bold text-gold">
                        {formatVND(orderTotal)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowOrderDetail(true)}
                        className="flex items-center gap-1 text-xs text-gold font-semibold hover:underline"
                      >
                        <FileText size={13} /> Chi tiết <ChevronRight size={12} />
                      </button>
                      <button
                        onClick={() => { setSelectedOrders([]); setCustomerName(''); setReason(''); }}
                        className="text-xs text-red-400 hover:text-red-600 dark:text-red-300 hover:underline"
                      >
                        Xoá hết
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {selectedOrders.map(o => (
                      <span
                        key={o.id}
                        className="inline-flex items-center gap-1 font-mono text-xs bg-surface border border-gold/30 text-gold px-2 py-1 rounded-lg font-bold"
                      >
                        {o.orderCode}
                        <button onClick={() => removeOrder(o.id)} className="text-gold/60 hover:text-red-400 transition">
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Banner cảnh báo race condition */}
              {staleWarning && (
                <div className="mt-2 rounded-xl border-2 border-rose-300 dark:border-rose-500/35 bg-rose-50 dark:bg-rose-500/10 p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle size={15} className="text-rose-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-rose-700 dark:text-rose-300">Số tiền đã thay đổi!</p>
                      <p className="text-xs text-rose-600 dark:text-rose-300 mt-0.5">{staleWarning.message}</p>
                      {staleWarning.orderCode && (
                        <p className="text-xs text-rose-500 mt-0.5">
                          Đơn: <span className="font-mono font-bold">{staleWarning.orderCode}</span>
                          {staleWarning.paidAmount != null && (
                            <> · Đã thu: <span className="font-bold">{formatVND(staleWarning.paidAmount)}</span></>
                          )}
                          {staleWarning.actualRemainingAmount != null && (
                            <> · Còn lại: <span className="font-bold text-rose-700 dark:text-rose-300">{formatVND(staleWarning.actualRemainingAmount)}</span></>
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={reloadSelectedOrders}
                    disabled={reloading}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-rose-500 text-white text-xs font-bold hover:bg-rose-600 transition disabled:opacity-50"
                  >
                    <RefreshCw size={12} className={reloading ? 'animate-spin' : ''} />
                    {reloading ? 'Đang tải lại...' : 'Tải lại đơn hàng để cập nhật'}
                  </button>
                </div>
              )}
            </div>

            {/* ══════════════ Số tiền thực thu (chỉ hiện khi có đơn) ══════════════ */}
            {hasOrders && (
              <div>
                <label className="block text-sm font-semibold text-ink mb-1.5">
                  Số tiền thực thu <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <input
                      value={collectedAmount ? new Intl.NumberFormat('vi-VN').format(parseVND(collectedAmount)) : ''}
                      onChange={e => handleCollectedChange(String(parseVND(e.target.value)))}
                      placeholder="Nhập số tiền..."
                      className={`w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 text-right pr-10 ${collectedError
                        ? 'border-red-300 dark:border-red-500/35 focus:ring-red-200 dark:ring-red-500/28 bg-red-50 dark:bg-red-500/10'
                        : collectedStatus === 'exact'
                          ? 'border-green-300 dark:border-green-500/35 focus:ring-green-200 dark:ring-green-500/28 bg-green-50 dark:bg-green-500/10'
                          : collectedStatus === 'partial'
                            ? 'border-amber-300 dark:border-amber-500/35 focus:ring-amber-200 dark:ring-amber-500/28 bg-amber-50 dark:bg-amber-500/10'
                            : 'border-hairline-2 focus:ring-gold/40'
                        }`}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">đ</span>
                  </div>
                  <button
                    onClick={() => handleCollectedChange(String(orderTotal))}
                    className="px-3 py-2.5 rounded-xl border border-gold/40 text-xs font-bold text-gold hover:bg-gold/10 transition whitespace-nowrap"
                  >
                    Thu đủ
                  </button>
                </div>

                {collectedError && (
                  <p className="mt-1.5 text-xs text-red-500 flex items-start gap-1">
                    <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
                    {collectedError}
                  </p>
                )}
                {collectedStatus === 'exact' && (
                  <p className="mt-1.5 text-xs text-green-600 dark:text-green-300 flex items-center gap-1">
                    <CheckCircle2 size={12} /> Thu đủ tổng đơn hàng
                  </p>
                )}
                {collectedStatus === 'partial' && partialInfo && (
                  <div className="mt-1.5 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/28">
                    <p className="text-xs text-amber-700 dark:text-amber-300 font-semibold flex items-center gap-1">
                      <AlertCircle size={12} />
                      Thu thiếu <span className="font-mono">{formatVND(partialInfo.shortfall)}</span> cho đơn cuối{' '}
                      <span className="font-mono text-gold">{partialInfo.lastOrder.orderCode}</span>
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-300 mt-0.5">
                      Sẽ thu {formatVND(partialInfo.lastOrderRemaining)} / {formatVND(Math.round(partialInfo.lastOrder.finalAmount || 0))} — bạn sẽ chọn cách xử lý khi tạo phiếu.
                    </p>
                  </div>
                )}
                {collectedStatus === 'overpay' && overpayInfo && (
                  <div className="mt-1.5 p-2.5 rounded-xl bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/28">
                    <p className="text-xs text-sky-700 dark:text-sky-300 font-semibold flex items-center gap-1">
                      <AlertCircle size={12} />
                      Khách trả dư <span className="font-mono">{formatVND(overpayInfo.amount)}</span>
                    </p>
                    <p className="text-xs text-sky-600 dark:text-sky-300 mt-0.5">
                      Phiếu thu vẫn ghi đủ {formatVND(collectedNum)}. Phần dư được lưu vào đơn cuối
                      {selectedOrders.length > 0 && (
                        <> (<span className="font-mono text-gold">{selectedOrders[selectedOrders.length - 1].orderCode}</span>)</>
                      )}. Sau khi tạo phiếu, bạn có thể lập phiếu chi hoàn lại {formatVND(overpayInfo.amount)} cho khách.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ══════════════ Tên khách hàng ══════════════ */}
            <div>
              <label className="block text-sm font-semibold text-ink mb-1.5">
                Tên khách hàng / Đơn vị
                {hasOrders && (
                  <span className="text-xs font-normal text-muted ml-1">(tự động từ đơn hàng)</span>
                )}
              </label>
              <input
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                placeholder="Tên khách hàng hoặc đơn vị..."
                className="w-full px-4 py-2.5 rounded-xl border border-hairline-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40"
              />
            </div>

            {/* ══════════════ Người nộp tiền (dropdown nhân viên + nhập tay) ══════════════ */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-semibold text-ink flex items-center gap-1.5">
                  <User size={14} className="text-gold" />
                  Người nộp tiền
                  <span className="text-xs font-normal text-muted ml-1">(chọn nhân viên hoặc nhập tên)</span>
                </label>
                {customerName && (
                  <button
                    type="button"
                    onClick={() => {
                      setPayerName(customerName);
                      setPayerSearch(customerName);
                    }}
                    className="flex items-center gap-1 text-xs text-gold font-semibold hover:underline"
                  >
                    <Copy size={11} /> Lấy từ tên KH
                  </button>
                )}
              </div>

              <div className="relative" ref={payerDropRef}>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    value={payerSearch}
                    onChange={e => handlePayerSearchChange(e.target.value)}
                    onFocus={handlePayerInputFocus}
                    onBlur={handlePayerBlur}
                    placeholder="Nhập tên nhân viên hoặc người ngoài..."
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-hairline-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40"
                  />
                  {payerLoading && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
                  )}
                </div>

                {showPayerDrop && payerResults.length > 0 && (
                  <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-surface border border-hairline-2 rounded-xl shadow-xl max-h-52 overflow-y-auto">
                    {payerResults.map(emp => (
                      <button
                        key={emp.id}
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => selectEmployee(emp)}
                        className="w-full text-left px-4 py-2.5 hover:bg-canvas transition border-b border-hairline last:border-0"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-ink">{emp.fullName}</p>
                            {emp.position && (
                              <p className="text-xs text-muted">{emp.position}</p>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ══════════════ Lý do thu ══════════════ */}
            <div>
              <label className="block text-sm font-semibold text-ink mb-1.5">
                Lý do thu <span className="text-red-500">*</span>
              </label>
              <input
                value={reason} onChange={e => setReason(e.target.value)}
                placeholder="Mô tả lý do thu tiền..."
                className="w-full px-4 py-2.5 rounded-xl border border-hairline-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40"
              />
            </div>

            {/* ══════════════ Số phiếu thu ══════════════ */}
            <div>
              <label className="block text-sm font-semibold text-ink mb-1.5">
                Số phiếu thu <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  value={receiptNumber}
                  onChange={e => setReceiptNumber(e.target.value)}
                  placeholder={suggestedReceiptNumber ? `Gợi ý: ${suggestedReceiptNumber}` : 'Nhập số phiếu thu...'}
                  className="w-full px-4 py-2.5 pr-20 rounded-xl border border-hairline-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40 font-mono"
                />
                {suggestedReceiptNumber && !receiptNumber && (
                  <button
                    type="button"
                    onClick={() => setReceiptNumber(suggestedReceiptNumber)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg text-xs font-semibold bg-gold/10 text-gold hover:bg-gold/20 transition"
                  >
                    Dùng số này
                  </button>
                )}
              </div>
              {suggestedReceiptNumber && (
                <p className="text-xs text-muted mt-1">
                  Số kế tiếp gợi ý: <span className="font-mono font-semibold text-gold">{suggestedReceiptNumber}</span> — bạn có thể tự nhập số khác.
                </p>
              )}
            </div>

            {/* ══════════════ Loại thanh toán ══════════════ */}
            <div>
              <label className="block text-sm font-semibold text-ink mb-2">
                Hình thức thanh toán <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setPaymentType('CASH')}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition ${paymentType === 'CASH'
                    ? 'border-gold bg-gold/10 text-gold'
                    : 'border-hairline-2 text-muted hover:border-gold/50'
                    }`}
                >
                  <Banknote size={18} />
                  <div className="text-left">
                    <p className="text-sm font-semibold">Tiền mặt</p>
                    <p className="text-xs opacity-70">Thu trực tiếp</p>
                  </div>
                </button>
                <button
                  onClick={() => setPaymentType('BANK_TRANSFER')}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition ${paymentType === 'BANK_TRANSFER'
                    ? 'border-blue-400 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-300'
                    : 'border-hairline-2 text-muted hover:border-blue-300 dark:border-blue-500/35'
                    }`}
                >
                  <CreditCard size={18} />
                  <div className="text-left">
                    <p className="text-sm font-semibold">Chuyển khoản</p>
                    <p className="text-xs opacity-70">Cần mã tham chiếu</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Bank info */}
            {paymentType === 'BANK_TRANSFER' && (
              <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/18 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-300 text-xs font-semibold mb-1">
                  <AlertCircle size={13} /> Bắt buộc điền khi chuyển khoản
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Tên ngân hàng *</label>
                  <select
                    value={bankName} onChange={e => setBankName(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-blue-200 dark:border-blue-500/28 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 dark:ring-blue-500/35 bg-surface">
                    <option value="">-- Chọn ngân hàng * --</option>
                    {banks.map(b => <option key={b.id || b.name} value={b.name}>{b.name}</option>)}
                  </select>
                  {banks.length === 0 && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-300 mt-1">Chưa có ngân hàng — Chủ/Quản trị cần tạo ở trang Quản lý dòng tiền.</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Mã tham chiếu giao dịch *</label>
                  <input
                    value={bankRef} onChange={e => setBankRef(e.target.value)}
                    placeholder="Mã GD / Transaction ID..."
                    className="w-full px-3 py-2.5 rounded-xl border border-blue-200 dark:border-blue-500/28 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 dark:ring-blue-500/35 bg-surface font-mono"
                  />
                </div>
              </div>
            )}

            {/* ══════════════ Khoản thu manual (ẩn khi có đơn) ══════════════ */}
            {!hasOrders && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold text-ink">
                    Các khoản thu <span className="text-red-500">*</span>
                  </label>
                  <button onClick={addItem} className="flex items-center gap-1 text-xs text-gold hover:underline font-semibold">
                    <Plus size={13} /> Thêm khoản
                  </button>
                </div>
                <div className="space-y-2">
                  {items.map((item, idx) => (
                    <div key={item.id} className="bg-canvas rounded-xl p-3 space-y-2">
                      <div className="flex gap-2">
                        <input
                          value={item.itemName} onChange={e => updateItem(item.id, 'itemName', e.target.value)}
                          placeholder={`Khoản thu ${idx + 1}...`}
                          className="flex-1 px-3 py-2 rounded-lg border border-hairline-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40 bg-surface"
                        />
                        <input
                          value={item.amount ? new Intl.NumberFormat('vi-VN').format(parseVND(item.amount)) : ''}
                          onChange={e => updateItem(item.id, 'amount', String(parseVND(e.target.value)))}
                          placeholder="Số tiền"
                          className="w-32 px-3 py-2 rounded-lg border border-hairline-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40 bg-surface text-right"
                        />
                        {items.length > 1 && (
                          <button onClick={() => removeItem(item.id)} className="p-2 rounded-lg hover:bg-red-50 dark:bg-red-500/10 text-red-400 transition flex-shrink-0">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                      <input
                        value={item.note} onChange={e => updateItem(item.id, 'note', e.target.value)}
                        placeholder="Ghi chú (tuỳ chọn)..."
                        className="w-full px-3 py-2 rounded-lg border border-hairline-2 text-xs focus:outline-none focus:ring-2 focus:ring-gold/40 bg-surface"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tổng */}
            <div className="flex justify-between items-center py-2 border-t border-hairline">
              <span className="text-sm font-semibold text-muted">
                {hasOrders ? 'Số tiền thực thu' : 'Tổng cần thu'}
              </span>
              <span className={`text-lg font-bold ${collectedStatus === 'error' ? 'text-red-500' :
                collectedStatus === 'partial' ? 'text-amber-500' :
                  'text-gold'
                }`}>
                {formatVND(displayTotal)}
              </span>
            </div>

            {/* ══════════════ Ảnh chứng từ ══════════════ */}
            <div>
              <label className="block text-sm font-semibold text-ink mb-1.5">Ảnh chứng từ</label>
              <div className="flex flex-wrap gap-2">
                {images.map(img => (
                  <div key={img.id} className="relative w-16 h-16 rounded-xl overflow-hidden border border-hairline-2">
                    <img src={img.url} alt="" className="w-full h-full object-cover" />
                    {img.uploading ? (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      </div>
                    ) : (
                      <button onClick={() => setImages(p => p.filter(i => i.id !== img.id))}
                        className="absolute top-1 right-1 p-0.5 bg-red-500 text-white rounded-full">
                        <X size={8} />
                      </button>
                    )}
                  </div>
                ))}
                <button onClick={() => fileRef.current?.click()}
                  className="w-16 h-16 rounded-xl border-2 border-dashed border-hairline-3 flex flex-col items-center justify-center gap-0.5 hover:border-gold hover:bg-gold/5 transition text-muted hover:text-gold">
                  <Upload size={14} />
                  <span className="text-xs">Thêm</span>
                </button>
                <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={handleImageChange} />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-5 border-t border-hairline flex-shrink-0 flex gap-3">
            <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-hairline-2 text-sm font-semibold text-muted hover:bg-canvas transition">
              Huỷ
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || !!collectedError || !!staleWarning}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gold text-white font-bold hover:bg-gold-strong transition disabled:opacity-50"
            >
              {submitting
                ? <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                : <Send size={16} />}
              {submitting ? (isEdit ? 'Đang lưu...' : 'Đang tạo...') : (isEdit ? 'Lưu thay đổi' : 'Tạo phiếu thu')}
            </button>
          </div>
        </div>
      </div>

      {/* Modal chi tiết đơn hàng */}
      {showOrderDetail && (
        <OrderSummaryModal
          orders={selectedOrders}
          onClose={() => setShowOrderDetail(false)}
        />
      )}

      {/* Modal xác nhận thu thiếu */}
      {showPartialConfirm && partialInfo && (
        <PartialConfirmModal
          info={partialInfo}
          onConfirm={handlePartialConfirm}
          onCancel={() => setShowPartialConfirm(false)}
        />
      )}

      {/* Modal xác nhận thu dư */}
      {showOverpayConfirm && overpayInfo && (
        <OverpayConfirmModal
          info={{ overpayAmount: overpayInfo.amount, collected: collectedNum, orderTotal }}
          onConfirm={async () => { setShowOverpayConfirm(false); await doSubmit(null); }}
          onCancel={() => setShowOverpayConfirm(false)}
        />
      )}
    </>
  );
}