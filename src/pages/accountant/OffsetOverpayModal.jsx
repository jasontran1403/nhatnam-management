// src/pages/accountant/OffsetOverpayModal.jsx
//
// Modal "Cấn trừ phần dư": owner chọn 1 đơn CÙNG KHÁCH với phiếu nguồn, chọn
// cách thu (đủ / 1 phần + nhập số tiền), BE sẽ:
//   · Tạo 1 phiếu thu mới gắn vào đơn đó (status CONFIRMED, allocation đầy đủ).
//   · Tăng offsetUsedAmount của phiếu nguồn → phần dư giảm tương ứng.
//
// Danh sách đơn lấy từ /api/accountant/orders/pending-payment (đã có sẵn ở
// IncomeCreateModal). Modal này tự lọc theo tên khách của phiếu nguồn — ưu
// tiên linkedCustomerNames[0], fallback về customerName/payerName.
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  X, Search, RefreshCw, Package, CheckCircle2,
} from 'lucide-react';
import api from '../../api/axios';
import { incomeApi } from '../../api/services';
import { useToast } from '../../components/common/Toast';
import { formatVND } from '../../utils/format.js';

const parseVND = (s) => Number(String(s ?? '').replace(/[^\d]/g, '')) || 0;
const nf = (n) => new Intl.NumberFormat('vi-VN').format(Math.round(Number(n) || 0));

export default function OffsetOverpayModal({ voucher, onClose, onCreated }) {
  const toast = useToast();

  // Tên khách để lọc — phiếu thu có thể gắn nhiều khách ở linkedCustomerNames,
  // nhưng cấn trừ phải đúng 1 khách; mặc định lấy khách đầu, có thể đổi.
  const customerCandidates = useMemo(() => {
    const set = new Set();
    (voucher.linkedCustomerNames || []).forEach(n => n && set.add(n.trim()));
    if (voucher.overpay?.customerName) set.add(voucher.overpay.customerName.trim());
    if (voucher.customerName) set.add(voucher.customerName.trim());
    return [...set].filter(Boolean);
  }, [voucher]);
  const [customer, setCustomer] = useState(customerCandidates[0] || '');

  const [search, setSearch] = useState('');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const searchDebounce = useRef(null);

  const [selected, setSelected] = useState(null); // {orderCode, remaining, customerName,...}
  const [handling, setHandling] = useState('FULL'); // FULL | PARTIAL
  const [amount, setAmount] = useState(''); // chỉ dùng cho PARTIAL
  const [receiptNumber, setReceiptNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Gợi ý số phiếu kế tiếp
  useEffect(() => {
    (async () => {
      try {
        const r = await incomeApi.nextReceiptNumber();
        const s = r.data?.data || r.data;
        if (s) setReceiptNumber(String(s));
      } catch { /* bỏ qua, để trống */ }
    })();
  }, []);

  const loadOrders = async (q) => {
    setLoading(true);
    try {
      // Dùng chung endpoint tìm đơn chờ thanh toán. Dùng tên khách làm từ khoá
      // để lọc server-side, FE chỉ filter theo customerName chính xác.
      const kw = (q || '').trim() || customer || '';
      const res = await api.get('/api/accountant/orders/pending-payment', {
        params: { search: kw, page: 0, size: 50 },
      });
      let content = res.data?.data?.content || [];
      // Chỉ giữ đơn CÙNG khách + CHƯA thu đủ + không trùng với các đơn đã có
      // trong phiếu nguồn (tránh cấn trừ lại chính đơn vừa thu).
      const srcCodes = new Set((voucher.linkedOrderCodes || []).map(c => c.trim()));
      const nameNorm = (customer || '').trim().toLowerCase();
      content = content.filter(o => {
        const cName = (o.customerName || '').trim().toLowerCase();
        const remain = Number(o.remainingAmount ?? ((o.finalAmount || 0) - (o.paidAmount || 0)));
        return (!nameNorm || cName === nameNorm)
          && remain > 0
          && !srcCodes.has((o.orderCode || '').trim());
      });
      setOrders(content);
    } catch (e) {
      toast('Không tải được danh sách đơn', 'error');
      setOrders([]);
    } finally { setLoading(false); }
  };

  // Load lần đầu + mỗi khi đổi khách
  useEffect(() => { loadOrders(''); /* eslint-disable-next-line */ }, [customer]);

  const onSearchChange = (v) => {
    setSearch(v);
    clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => loadOrders(v), 400);
  };

  const availableOverpay = Number(voucher.overpay?.amount || 0);
  const selectedRemaining = selected
    ? Number(selected.remainingAmount ?? ((selected.finalAmount || 0) - (selected.paidAmount || 0)))
    : 0;
  const maxCollectable = Math.min(availableOverpay, selectedRemaining);

  const effectiveAmount = handling === 'FULL' ? maxCollectable : parseVND(amount);

  const canSubmit = selected
    && receiptNumber.trim()
    && effectiveAmount > 0
    && effectiveAmount <= maxCollectable
    && !submitting;

  const confirm = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await incomeApi.offset(voucher.id, {
        targetOrderCode: selected.orderCode,
        handling,
        amount: handling === 'PARTIAL' ? effectiveAmount : undefined,
        receiptNumber: receiptNumber.trim(),
      });
      toast('Đã cấn trừ sang đơn ' + selected.orderCode, 'success');
      onCreated && onCreated();
    } catch (e) {
      toast(e?.response?.data?.message || 'Không cấn trừ được', 'error');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-hairline">
          <div>
            <h2 className="text-lg font-bold text-ink flex items-center gap-2">
              <RefreshCw size={18} className="text-orange-500" /> Cấn trừ phần dư
            </h2>
            <p className="text-xs text-muted mt-0.5">
              Phần dư còn lại: <span className="font-bold text-orange-600 dark:text-orange-300">{formatVND(availableOverpay)}</span>
              {voucher.receiptNumber && <> · Từ phiếu <span className="font-mono text-gold font-bold">{voucher.receiptNumber}</span></>}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-canvas text-muted">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {/* Chọn khách — nếu phiếu nguồn có nhiều khách */}
          {customerCandidates.length > 1 && (
            <div>
              <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Khách hàng</p>
              <div className="flex flex-wrap gap-1.5">
                {customerCandidates.map(c => (
                  <button key={c} onClick={() => { setCustomer(c); setSelected(null); }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                      customer === c
                        ? 'bg-gold text-white border-gold'
                        : 'bg-surface text-ink-2 border-line hover:bg-canvas'
                    }`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tìm đơn */}
          <div>
            <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">
              Đơn hàng của {customer || '—'} ({orders.length})
            </p>
            <div className="relative mb-2">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input value={search} onChange={e => onSearchChange(e.target.value)}
                placeholder="Tìm mã đơn / tên sản phẩm..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-line text-sm bg-surface focus:outline-none focus:border-gold" />
            </div>

            <div className="rounded-xl border border-line divide-y divide-hairline max-h-64 overflow-y-auto">
              {loading ? (
                <p className="text-center py-6 text-sm text-muted">Đang tải...</p>
              ) : orders.length === 0 ? (
                <p className="text-center py-6 text-sm text-muted">Không có đơn nào chờ thanh toán</p>
              ) : (
                orders.map(o => {
                  const remain = Number(o.remainingAmount ?? ((o.finalAmount || 0) - (o.paidAmount || 0)));
                  const chosen = selected?.orderCode === o.orderCode;
                  return (
                    <button key={o.orderCode || o.id} onClick={() => { setSelected(o); setHandling('FULL'); setAmount(''); }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 text-left transition ${
                        chosen ? 'bg-gold/10' : 'hover:bg-canvas'
                      }`}>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {chosen && <CheckCircle2 size={14} className="text-gold" />}
                          <span className="font-mono text-xs font-bold text-gold">{o.orderCode}</span>
                          <span className="text-xs text-muted truncate">{o.customerName}</span>
                        </div>
                        <p className="text-[11px] text-muted mt-0.5 truncate">
                          Tổng {formatVND(o.finalAmount)} · Đã thu {formatVND(o.paidAmount || 0)}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0 ml-2">
                        <p className="text-[10px] text-muted">Còn lại</p>
                        <p className="text-sm font-bold text-ink">{formatVND(remain)}</p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Chọn kiểu + số tiền */}
          {selected && (
            <div className="rounded-xl border border-gold/40 bg-gold/5 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted">Đơn đã chọn</p>
                  <p className="font-mono font-bold text-gold">{selected.orderCode}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted">Có thể cấn trừ tối đa</p>
                  <p className="font-bold text-orange-600 dark:text-orange-300">{formatVND(maxCollectable)}</p>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Phương án thu</p>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setHandling('FULL')}
                    className={`py-2 rounded-xl text-sm font-semibold border transition ${
                      handling === 'FULL'
                        ? 'bg-gold text-white border-gold'
                        : 'bg-surface text-ink-2 border-line hover:bg-canvas'
                    }`}>Thu đủ ({formatVND(maxCollectable)})</button>
                  <button onClick={() => setHandling('PARTIAL')}
                    className={`py-2 rounded-xl text-sm font-semibold border transition ${
                      handling === 'PARTIAL'
                        ? 'bg-gold text-white border-gold'
                        : 'bg-surface text-ink-2 border-line hover:bg-canvas'
                    }`}>Thu 1 phần</button>
                </div>
              </div>

              {handling === 'PARTIAL' && (
                <div>
                  <label className="block text-xs text-muted mb-1">Số tiền cấn trừ (VNĐ)</label>
                  <input type="text" inputMode="numeric"
                    value={amount === '' ? '' : nf(amount)}
                    onChange={e => setAmount(String(parseVND(e.target.value)))}
                    onFocus={e => e.target.select()}
                    placeholder="0"
                    className="w-full px-3 py-2 rounded-xl border border-line text-sm text-right tabular-nums bg-surface focus:outline-none focus:border-gold" />
                  {parseVND(amount) > maxCollectable && (
                    <p className="text-xs text-red-600 dark:text-red-300 mt-1">
                      Vượt mức tối đa {formatVND(maxCollectable)}
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs text-muted mb-1">Số phiếu thu mới</label>
                <input value={receiptNumber} onChange={e => setReceiptNumber(e.target.value)}
                  placeholder="VD: 00001"
                  className="w-full px-3 py-2 rounded-xl border border-line text-sm bg-surface focus:outline-none focus:border-gold" />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-hairline flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-hairline-2 text-sm font-semibold text-muted hover:bg-canvas transition">
            Hủy
          </button>
          <button onClick={confirm} disabled={!canSubmit}
            className="flex-1 py-3 rounded-xl bg-orange-500 text-white text-sm font-bold hover:bg-orange-600 transition disabled:opacity-50 flex items-center justify-center gap-2">
            {submitting ? 'Đang xử lý...' : (
              <><RefreshCw size={14} /> Xác nhận cấn trừ {effectiveAmount > 0 ? `(${formatVND(effectiveAmount)})` : ''}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}