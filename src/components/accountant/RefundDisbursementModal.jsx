// src/components/accountant/RefundDisbursementModal.jsx
// Modal tạo phiếu chi hoàn tiền — layout 2 cột:
//  Trái: ô search + TABLE danh sách đơn (luôn hiển thị khi có data)
//  Phải: danh sách đơn đã chọn + tổng + form phiếu chi
//
// Rules:
//  - Đơn đầu tiên xác định customerId — các đơn sau phải cùng khách
//  - Đơn đã có refundVoucherCode → không cho chọn
//  - Khi confirm: POST /api/orders/refund-disbursement/bulk

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, Search, Loader2, Plus, Trash2, CheckCircle2,
  AlertTriangle, RotateCcw, CreditCard, Banknote, User, Inbox,
} from 'lucide-react';
import { accountantApi } from '../../api/services';
import { useToast } from '../common/Toast';

const fmtVnd = v => Math.round(Number(v) || 0).toLocaleString('vi-VN') + ' đ';

export default function RefundDisbursementModal({ onClose, onSuccess }) {
  const toast = useToast();

  // ── State ─────────────────────────────────────────────────────────────────
  const [keyword, setKeyword]           = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching]       = useState(false);

  // Danh sách đơn đã thêm vào phiếu chi
  const [selectedOrders, setSelectedOrders] = useState([]);
  // customerId đã lock (theo đơn đầu tiên)
  const [lockedCustomerId, setLockedCustomerId] = useState(null);
  const [lockedCustomerName, setLockedCustomerName] = useState('');

  // Form phiếu chi
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [bankName, setBankName]           = useState('');
  const [transactionRef, setTransRef]     = useState('');
  const [receiverName, setReceiverName]   = useState('');
  const [note, setNote]                   = useState('');

  const [submitting, setSubmitting]       = useState(false);
  const [done, setDone]                   = useState(null); // result object

  const timerRef = useRef(null);

  // ── Search debounce ────────────────────────────────────────────────────────
  const doSearch = useCallback(async (kw) => {
    setSearching(true);
    try {
      const params = { keyword: kw, size: 30 };
      if (lockedCustomerId) params.customerId = lockedCustomerId;
      const res = await accountantApi.searchPendingRefundOrders(params);
      const data = res?.data?.data ?? res?.data ?? [];
      // Lọc bỏ những đơn đã được thêm vào danh sách
      const addedIds = new Set(selectedOrders.map(o => o.id));
      setSearchResults(Array.isArray(data) ? data.filter(o => !addedIds.has(o.id)) : []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [lockedCustomerId, selectedOrders]);

  useEffect(() => {
    clearTimeout(timerRef.current);
    if (!keyword.trim()) {
      // Khi rỗng: load danh sách mặc định
      timerRef.current = setTimeout(() => doSearch(''), 200);
      return;
    }
    timerRef.current = setTimeout(() => doSearch(keyword), 350);
    return () => clearTimeout(timerRef.current);
  }, [keyword, doSearch]);

  // ── Auto-generate note từ selectedOrders ──────────────────────────────────
  useEffect(() => {
    if (selectedOrders.length > 0) {
      const orderCodes = selectedOrders.map(o => o.orderCode).join(', ');
      setNote(`Hoàn tiền cho đơn hàng ${orderCodes}`);
    } else {
      setNote('');
    }
  }, [selectedOrders]);

  // ── Thêm đơn vào danh sách ────────────────────────────────────────────────
  const handleAdd = (order) => {
    // Lock customerId theo đơn đầu tiên
    if (selectedOrders.length === 0) {
      setLockedCustomerId(order.customerId ?? null);
      setLockedCustomerName(order.customerName ?? '');
      setReceiverName(order.customerName ?? '');
    }
    setSelectedOrders(prev => [...prev, order]);
    // Xoá đơn vừa thêm khỏi table luôn cho UI mượt
    setSearchResults(prev => prev.filter(o => o.id !== order.id));
  };

  const handleRemove = (id) => {
    const next = selectedOrders.filter(o => o.id !== id);
    setSelectedOrders(next);
    if (next.length === 0) {
      setLockedCustomerId(null);
      setLockedCustomerName('');
      setReceiverName('');
    }
    // Reload lại table để đơn vừa xoá có thể xuất hiện lại
    doSearch(keyword);
  };

  const totalRefund = selectedOrders.reduce((s, o) => s + Number(o.pendingRefundAmount || 0), 0);

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (selectedOrders.length === 0) { toast('Vui lòng chọn ít nhất 1 đơn', 'error'); return; }
    if (!receiverName.trim()) { toast('Vui lòng nhập tên người nhận', 'error'); return; }
    if (paymentMethod === 'BANK_TRANSFER' && !bankName.trim()) {
      toast('Vui lòng nhập tên ngân hàng', 'error'); return;
    }
    setSubmitting(true);
    try {
      const res = await accountantApi.createBulkRefundDisbursement({
        orderIds: selectedOrders.map(o => o.id),
        paymentMethod,
        bankName: paymentMethod === 'BANK_TRANSFER' ? bankName.trim() : undefined,
        transactionRef: paymentMethod === 'BANK_TRANSFER' ? transactionRef.trim() : undefined,
        note: note.trim(),
      });
      const data = res?.data?.data ?? res?.data;
      setDone(data);
      if (onSuccess) onSuccess();
    } catch (e) {
      toast(e?.response?.data?.message || 'Lỗi tạo phiếu chi', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Done screen ────────────────────────────────────────────────────────────
  if (done) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md bg-surface rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        <div className="px-6 py-5 border-b border-hairline flex items-center gap-3">
          <CheckCircle2 size={22} className="text-emerald-500 shrink-0" />
          <h2 className="text-base font-bold text-ink flex-1">Tạo phiếu chi thành công</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-canvas text-muted"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/25 px-5 py-4 space-y-2.5">
            <Row label="Mã phiếu chi"  value={<span className="font-mono font-bold">{done.voucherCode}</span>} />
            <Row label="Tổng hoàn"     value={<span className="font-bold text-emerald-600">{fmtVnd(done.totalAmount)}</span>} />
            <Row label="Số đơn"        value={`${done.orderCount} đơn`} />
          </div>
          {done.orderCodes?.length > 0 && (
            <div className="rounded-xl bg-canvas px-4 py-3">
              <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2">Các đơn đã xử lý</p>
              <div className="flex flex-wrap gap-1.5">
                {done.orderCodes.map(c => (
                  <span key={c} className="px-2 py-0.5 rounded-md bg-surface border border-hairline-2 text-xs font-mono text-ink">{c}</span>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="px-6 pb-6">
          <button onClick={onClose} className="w-full py-3 rounded-xl bg-gold text-white font-bold hover:bg-gold-strong">Đóng</button>
        </div>
      </div>
    </div>
  );

  // ── Main UI — 2 cột ────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl bg-surface rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b border-hairline flex items-center gap-3 shrink-0">
          <RotateCcw size={18} className="text-emerald-500 shrink-0" />
          <div className="flex-1">
            <h2 className="text-base font-bold text-ink">Tạo phiếu chi hoàn tiền</h2>
            <p className="text-[10px] text-muted mt-0.5">
              Chọn các đơn cần hoàn tiền — phải cùng 1 khách hàng
            </p>
          </div>
          {lockedCustomerName && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gold/10 border border-gold/30">
              <User size={12} className="text-gold" />
              <span className="text-xs font-semibold text-gold truncate max-w-32">{lockedCustomerName}</span>
            </div>
          )}
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-canvas text-muted"><X size={18} /></button>
        </div>

        {/* Body — 2 cột */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* ═══ CỘT TRÁI — Search & TABLE đơn ═══ */}
          <div className="w-1/2 border-r border-hairline flex flex-col min-h-0">
            <div className="px-4 py-3 border-b border-hairline shrink-0">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold text-muted uppercase tracking-wider">
                  Danh sách đơn cần hoàn tiền
                </p>
                {searching && <Loader2 size={11} className="text-muted animate-spin" />}
              </div>

              {/* Ô search — chỉ làm việc search */}
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                <input
                  value={keyword}
                  onChange={e => setKeyword(e.target.value)}
                  placeholder={lockedCustomerId
                    ? `Tìm đơn của ${lockedCustomerName}...`
                    : 'Tìm mã đơn, tên KH, SĐT...'}
                  className="w-full pl-8 pr-8 py-2 rounded-xl border border-hairline-2 text-sm
                    focus:outline-none focus:border-gold bg-canvas"
                />
                {keyword && (
                  <button
                    onClick={() => setKeyword('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-faint hover:text-muted"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            {/* ── TABLE luôn hiển thị khi có data ── */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {searching && searchResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-faint gap-2">
                  <Loader2 size={20} className="animate-spin" />
                  <p className="text-[11px]">Đang tải...</p>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                  <Inbox size={28} strokeWidth={1} className="text-faint mb-2" />
                  <p className="text-xs text-faint">
                    {keyword.trim()
                      ? 'Không tìm thấy đơn phù hợp'
                      : lockedCustomerId
                        ? 'Không còn đơn nào của khách này'
                        : 'Chưa có đơn nào cần hoàn tiền'}
                  </p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-canvas z-10">
                    <tr className="border-b border-hairline">
                      <th className="px-3 py-2 text-[10px] font-bold text-muted uppercase tracking-wider">Mã đơn</th>
                      <th className="px-3 py-2 text-[10px] font-bold text-muted uppercase tracking-wider">Khách hàng</th>
                      <th className="px-3 py-2 text-[10px] font-bold text-muted uppercase tracking-wider text-right">Hoàn</th>
                      <th className="px-3 py-2 w-9" />
                    </tr>
                  </thead>
                  <tbody>
                    {searchResults.map(o => (
                      <tr
                        key={o.id}
                        onClick={() => handleAdd(o)}
                        className="border-b border-hairline last:border-0 hover:bg-canvas cursor-pointer transition-colors group"
                      >
                        <td className="px-3 py-2 align-top">
                          <p className="text-xs font-mono font-semibold text-ink">{o.orderCode}</p>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <p className="text-[11px] text-muted truncate max-w-[140px]">{o.customerName}</p>
                        </td>
                        <td className="px-3 py-2 align-top text-right">
                          <p className="text-xs font-bold text-emerald-600 whitespace-nowrap">
                            {fmtVnd(o.pendingRefundAmount)}
                          </p>
                        </td>
                        <td className="px-2 py-2 align-top">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleAdd(o); }}
                            title="Thêm vào phiếu chi"
                            className="p-1 rounded-md text-faint group-hover:text-gold group-hover:bg-gold/10 transition-colors"
                          >
                            <Plus size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* ═══ CỘT PHẢI — Chi tiết phiếu chi ═══ */}
          <div className="w-1/2 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

              {/* Danh sách đơn đã chọn */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-bold text-muted uppercase tracking-wider">
                    Đơn đã chọn ({selectedOrders.length})
                  </p>
                </div>
                {selectedOrders.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-hairline-2 px-4 py-6 text-center">
                    <p className="text-[11px] text-faint">Chưa có đơn nào — chọn từ bảng bên trái</p>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {selectedOrders.map(o => (
                      <div key={o.id} className="flex items-center justify-between px-3 py-2
                        rounded-xl bg-canvas border border-hairline">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-mono font-semibold text-ink">{o.orderCode}</p>
                          <p className="text-[10px] text-muted truncate">{o.customerName}</p>
                        </div>
                        <div className="flex items-center gap-2 ml-2 shrink-0">
                          <span className="text-xs font-bold text-emerald-600">{fmtVnd(o.pendingRefundAmount)}</span>
                          <button onClick={() => handleRemove(o.id)}
                            className="p-1 rounded-md text-faint hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Tổng tiền */}
              <div className={`rounded-2xl px-4 py-3 border transition-colors
                ${selectedOrders.length > 0
                  ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/25'
                  : 'bg-canvas border-hairline'}`}>
                <p className="text-[10px] text-muted mb-1">Tổng tiền hoàn</p>
                <p className={`text-2xl font-black ${selectedOrders.length > 0 ? 'text-emerald-600' : 'text-faint'}`}>
                  {fmtVnd(totalRefund)}
                </p>
              </div>

              {/* Người nhận */}
              <div>
                <label className="text-xs font-semibold text-muted mb-1.5 block">
                  Người nhận <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <User size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                  <input
                    value={receiverName}
                    onChange={e => setReceiverName(e.target.value)}
                    placeholder="Tên người nhận tiền hoàn..."
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-hairline-2 text-sm
                      focus:outline-none focus:border-gold bg-surface"
                  />
                </div>
              </div>

              {/* Phương thức */}
              <div>
                <label className="text-xs font-semibold text-muted mb-1.5 block">Hình thức chi trả</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'CASH', label: 'Tiền mặt', icon: Banknote },
                    { key: 'BANK_TRANSFER', label: 'Chuyển khoản', icon: CreditCard },
                  ].map(({ key, label, icon: Icon }) => (
                    <button key={key} onClick={() => setPaymentMethod(key)}
                      className={`p-3 rounded-xl border-2 text-left transition-all
                        ${paymentMethod === key ? 'border-gold bg-gold/5' : 'border-hairline-2 hover:border-gold/40'}`}>
                      <Icon size={14} className={paymentMethod === key ? 'text-gold' : 'text-muted'} />
                      <p className="text-xs font-bold text-ink mt-1">{label}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Bank info */}
              {paymentMethod === 'BANK_TRANSFER' && (
                <div className="space-y-2.5">
                  <div>
                    <label className="text-xs text-muted mb-1 block">Ngân hàng / ví <span className="text-red-400">*</span></label>
                    <input value={bankName} onChange={e => setBankName(e.target.value)}
                      placeholder="VCB, MB Bank, Momo..."
                      className="w-full px-3 py-2 rounded-xl border border-hairline-2 text-sm focus:outline-none focus:border-gold bg-surface" />
                  </div>
                  <div>
                    <label className="text-xs text-muted mb-1 block">Mã giao dịch</label>
                    <input value={transactionRef} onChange={e => setTransRef(e.target.value)}
                      placeholder="Số tham chiếu..."
                      className="w-full px-3 py-2 rounded-xl border border-hairline-2 text-sm focus:outline-none focus:border-gold bg-surface" />
                  </div>
                </div>
              )}

              {/* Lý do / ghi chú — chỉ đọc, tự sinh */}
              <div>
                <label className="text-xs text-muted mb-1 block">Lý do / Ghi chú</label>
                <textarea
                  value={note}
                  readOnly
                  rows={2}
                  placeholder="Chọn đơn để tự sinh lý do..."
                  className="w-full px-3 py-2 rounded-xl border border-hairline-2 text-sm
                    focus:outline-none bg-canvas text-muted cursor-default resize-none"
                />
              </div>

              {/* Warning */}
              {selectedOrders.length > 0 && (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl
                  bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/25">
                  <AlertTriangle size={13} className="text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-amber-700 dark:text-amber-300 leading-relaxed">
                    Sau khi xác nhận, <strong>paidAmount</strong> của từng đơn sẽ bị trừ và
                    đơn sẽ bị đánh dấu đã hoàn — không thể tạo phiếu chi lại.
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-hairline flex gap-3 shrink-0">
              <button onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-hairline-2 text-sm font-semibold text-muted hover:bg-canvas">
                Đóng
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || selectedOrders.length === 0 || !receiverName.trim()}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl
                  bg-emerald-500 text-white font-bold disabled:opacity-40 hover:bg-emerald-600">
                {submitting
                  ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  : <CheckCircle2 size={15} />}
                {submitting ? 'Đang xử lý...' : `Tạo phiếu chi ${selectedOrders.length > 0 ? fmtVnd(totalRefund) : ''}`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-muted">{label}</span>
      <span className="font-semibold text-ink">{value}</span>
    </div>
  );
}