// src/pages/accountant/IncomeCreateModal.jsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { incomeApi } from '../../api/services';
import { accountantOrderApi } from '../../api/accountantApi';
import api from '../../api/axios';
import { useToast } from '../../components/common/Toast';
import {
  X, TrendingUp, Send, CreditCard, Banknote,
  Search, Plus, Trash2, Upload, ShoppingCart,
  AlertCircle, FileText, ChevronRight
} from 'lucide-react';

function formatVND(n) { return new Intl.NumberFormat('vi-VN').format(n || 0) + ' đ'; }
function parseVND(s)   { return Number(String(s).replace(/[^0-9]/g, '')) || 0; }

// ── Modal chi tiết các đơn đã chọn ───────────────────────────────────────────
function OrderSummaryModal({ orders, onClose }) {
  const total = orders.reduce((s, o) => s + (o.finalAmount || 0), 0);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between p-5 border-b border-black/5 flex-shrink-0">
          <div className="flex items-center gap-2">
            <ShoppingCart size={18} className="text-[#C9A84C]" />
            <h3 className="font-bold text-[#1C1C1E]">Chi tiết đơn hàng ({orders.length})</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-[#FAF7F2] text-[#8E8878]">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-2">
          {orders.map(o => (
            <div key={o.id} className="flex items-center justify-between py-2.5 px-3 bg-[#FAF7F2] rounded-xl">
              <div>
                <p className="font-mono text-xs font-bold text-[#C9A84C]">{o.orderCode}</p>
                <p className="text-sm text-[#1C1C1E]">{o.customerName || 'Khách lẻ'}</p>
              </div>
              <p className="text-sm font-bold text-[#1C1C1E]">{formatVND(o.finalAmount)}</p>
            </div>
          ))}
        </div>

        <div className="p-5 border-t border-black/5 flex-shrink-0">
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm font-semibold text-[#8E8878]">Tổng cần thu</span>
            <span className="text-lg font-bold text-[#C9A84C]">{formatVND(total)}</span>
          </div>
          <button onClick={onClose} className="w-full py-2.5 rounded-xl border border-black/10 text-sm font-semibold text-[#8E8878] hover:bg-[#FAF7F2] transition">
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────
export default function IncomeCreateModal({ onClose, onCreated }) {
  const toast = useToast();
  const fileRef = useRef();
  const searchDebounce = useRef(null);
  const orderDropRef = useRef();

  // Đơn hàng
  const [orderSearch, setOrderSearch]       = useState('');
  const [orderResults, setOrderResults]     = useState([]);
  const [orderLoading, setOrderLoading]     = useState(false);
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [showOrderDrop, setShowOrderDrop]   = useState(false);
  const [showOrderDetail, setShowOrderDetail] = useState(false);

  // Form
  const [payerName, setPayerName]     = useState('');
  const [reason, setReason]           = useState('');
  const [paymentType, setPaymentType] = useState('CASH');
  const [bankName, setBankName]       = useState('');
  const [bankRef, setBankRef]         = useState('');
  const [items, setItems]             = useState([{ id: 1, itemName: 'Khoản thu 1', amount: '', note: '' }]);
  const [images, setImages]           = useState([]);
  const [submitting, setSubmitting]   = useState(false);

  const orderTotal  = selectedOrders.reduce((s, o) => s + (o.finalAmount || 0), 0);
  const manualTotal = items.reduce((s, i) => s + parseVND(i.amount), 0);
  const hasOrders   = selectedOrders.length > 0;
  const displayTotal = hasOrders ? orderTotal : manualTotal;

  // Đóng dropdown khi click ngoài
  useEffect(() => {
    const fn = (e) => {
      if (orderDropRef.current && !orderDropRef.current.contains(e.target)) setShowOrderDrop(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  // Tìm đơn PENDING_PAYMENT — dùng endpoint mới
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

  const updateAutoFields = (orders) => {
    if (orders.length === 0) { setPayerName(''); setReason(''); return; }
    const uniqueCustomers = [...new Set(orders.map(o => o.customerName || 'Khách lẻ'))];
    if (uniqueCustomers.length === 1) {
      setPayerName(uniqueCustomers[0]);
      setReason(`Thu tiền đơn hàng: ${orders.map(o => o.orderCode).join(', ')}`);
    } else {
      setPayerName('Thu nhiều đơn');
      setReason(`Thu tiền cho các đơn hàng: ${orders.map(o => o.orderCode).join(', ')}`);
    }
  };

  // Items manual
  const addItem    = () => setItems(p => [...p, { id: Date.now(), itemName: `Khoản thu ${p.length + 1}`, amount: '', note: '' }]);
  const removeItem = (id) => setItems(p => p.filter(i => i.id !== id));
  const updateItem = (id, k, v) => setItems(p => p.map(i => i.id === id ? {...i, [k]: v} : i));

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
        setImages(p => p.map(img => img.id === tmp.id ? {...img, uploading: false, uploadedUrl: uploaded} : img));
      } catch {
        setImages(p => p.filter(img => img.id !== tmp.id));
        toast('Lỗi upload ảnh', 'error');
      }
    }
    e.target.value = '';
  };

  const handleSubmit = async () => {
    if (!reason.trim()) { toast('Lý do thu là bắt buộc', 'error'); return; }
    if (paymentType === 'BANK_TRANSFER') {
      if (!bankName.trim()) { toast('Vui lòng nhập tên ngân hàng', 'error'); return; }
      if (!bankRef.trim())  { toast('Vui lòng nhập mã tham chiếu giao dịch', 'error'); return; }
    }

    let submitItems;
    if (hasOrders) {
      submitItems = [{
        itemName: `Thu tiền đơn hàng: ${selectedOrders.map(o => o.orderCode).join(', ')}`,
        amount: orderTotal,
        note: null,
      }];
    } else {
      submitItems = items.filter(i => i.itemName.trim() && parseVND(i.amount) > 0)
        .map(i => ({ itemName: i.itemName.trim(), amount: parseVND(i.amount), note: i.note.trim() || null }));
      if (submitItems.length === 0) { toast('Phải có ít nhất 1 khoản thu hợp lệ', 'error'); return; }
    }
    if (images.some(img => img.uploading)) { toast('Đang tải ảnh, vui lòng chờ...', 'warning'); return; }

    setSubmitting(true);
    try {
      await incomeApi.create({
        payerName:        payerName.trim() || null,
        reason:           reason.trim(),
        paymentType,
        bankName:         paymentType === 'BANK_TRANSFER' ? bankName.trim() : undefined,
        bankRef:          paymentType === 'BANK_TRANSFER' ? bankRef.trim()  : undefined,
        linkedOrderCodes: hasOrders ? selectedOrders.map(o => o.orderCode) : undefined,
        items:            submitItems,
        imageUrls:        images.filter(img => img.uploadedUrl).map(img => img.uploadedUrl),
      });
      toast('Phiếu thu đã được tạo thành công', 'success');
      onCreated();
    } catch (e) {
      toast(e?.response?.data?.message || 'Lỗi khi tạo phiếu', 'error');
    } finally { setSubmitting(false); }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">

          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-black/5 flex-shrink-0">
            <div className="flex items-center gap-3">
              <TrendingUp size={20} className="text-[#C9A84C]" />
              <div>
                <h2 className="text-lg font-bold text-[#1C1C1E]">Tạo phiếu thu</h2>
                <p className="text-xs text-[#8E8878]">Có hiệu lực ngay, không cần duyệt</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-[#FAF7F2] text-[#8E8878] transition">
              <X size={20} />
            </button>
          </div>

          {/* Body */}
          <div className="overflow-y-auto flex-1 p-5 space-y-4">

            {/* ── Chọn đơn hàng ── */}
            <div>
              <label className="block text-sm font-semibold text-[#1C1C1E] mb-1.5 flex items-center gap-1.5">
                <ShoppingCart size={14} className="text-[#C9A84C]" />
                Chọn đơn hàng cần thu tiền
                <span className="text-xs font-normal text-[#8E8878] ml-1">(tuỳ chọn)</span>
              </label>

              {/* Ô search đơn hàng */}
              <div className="relative" ref={orderDropRef}>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8878]" />
                  <input
                    value={orderSearch}
                    onChange={e => handleOrderSearchChange(e.target.value)}
                    onFocus={handleOrderInputFocus}
                    placeholder="Nhập mã đơn hoặc tên khách hàng..."
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-black/10 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/40"
                  />
                  {orderLoading && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-[#C9A84C]/30 border-t-[#C9A84C] rounded-full animate-spin" />
                  )}
                </div>

                {showOrderDrop && (
                  <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-black/10 rounded-xl shadow-xl max-h-52 overflow-y-auto">
                    {orderResults.length === 0 ? (
                      <div className="px-4 py-6 text-center text-sm text-[#8E8878]">
                        {orderLoading ? 'Đang tìm...' : 'Không có đơn chờ thanh toán'}
                      </div>
                    ) : (
                      orderResults.map(o => (
                        <button
                          key={o.id}
                          onClick={() => selectOrder(o)}
                          className="w-full text-left px-4 py-3 hover:bg-[#FAF7F2] transition border-b border-black/5 last:border-0"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-mono text-xs font-bold text-[#C9A84C]">{o.orderCode}</p>
                              <p className="text-sm text-[#1C1C1E]">{o.customerName || 'Khách lẻ'}</p>
                            </div>
                            <span className="text-sm font-bold text-[#1C1C1E]">{formatVND(o.finalAmount)}</span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Tóm tắt đơn đã chọn + nút chi tiết */}
              {hasOrders && (
                <div className="mt-2 bg-[#FAF7F2] rounded-xl border border-[#C9A84C]/20 p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[#1C1C1E]">
                        {selectedOrders.length} đơn hàng đã chọn
                      </span>
                      <span className="text-sm font-bold text-[#C9A84C]">· {formatVND(orderTotal)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowOrderDetail(true)}
                        className="flex items-center gap-1 text-xs text-[#C9A84C] font-semibold hover:underline"
                      >
                        <FileText size={13} /> Chi tiết <ChevronRight size={12} />
                      </button>
                      <button
                        onClick={() => { setSelectedOrders([]); setPayerName(''); setReason(''); }}
                        className="text-xs text-red-400 hover:text-red-600 hover:underline"
                      >
                        Xoá hết
                      </button>
                    </div>
                  </div>
                  {/* Danh sách mã đơn dạng tag nhỏ */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {selectedOrders.map(o => (
                      <span
                        key={o.id}
                        className="inline-flex items-center gap-1 font-mono text-xs bg-white border border-[#C9A84C]/30 text-[#C9A84C] px-2 py-1 rounded-lg font-bold"
                      >
                        {o.orderCode}
                        <button onClick={() => removeOrder(o.id)} className="text-[#C9A84C]/60 hover:text-red-400 transition">
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── Người nộp tiền ── */}
            <div>
              <label className="block text-sm font-semibold text-[#1C1C1E] mb-1.5">
                Người nộp tiền / Đơn vị
              </label>
              <input
                value={payerName} onChange={e => setPayerName(e.target.value)}
                placeholder="Tên người nộp tiền hoặc đơn vị..."
                className="w-full px-4 py-2.5 rounded-xl border border-black/10 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/40"
              />
            </div>

            {/* ── Lý do thu ── */}
            <div>
              <label className="block text-sm font-semibold text-[#1C1C1E] mb-1.5">
                Lý do thu <span className="text-red-500">*</span>
              </label>
              <input
                value={reason} onChange={e => setReason(e.target.value)}
                placeholder="Mô tả lý do thu tiền..."
                className="w-full px-4 py-2.5 rounded-xl border border-black/10 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/40"
              />
            </div>

            {/* ── Loại thanh toán ── */}
            <div>
              <label className="block text-sm font-semibold text-[#1C1C1E] mb-2">
                Hình thức thanh toán <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setPaymentType('CASH')}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition ${
                    paymentType === 'CASH'
                      ? 'border-[#C9A84C] bg-[#C9A84C]/10 text-[#C9A84C]'
                      : 'border-black/10 text-[#8E8878] hover:border-[#C9A84C]/50'
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
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition ${
                    paymentType === 'BANK_TRANSFER'
                      ? 'border-blue-400 bg-blue-50 text-blue-600'
                      : 'border-black/10 text-[#8E8878] hover:border-blue-300'
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
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-blue-600 text-xs font-semibold mb-1">
                  <AlertCircle size={13} /> Bắt buộc điền khi chuyển khoản
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#1C1C1E] mb-1">Tên ngân hàng *</label>
                  <input
                    value={bankName} onChange={e => setBankName(e.target.value)}
                    placeholder="VD: Vietcombank, Techcombank, MBBank..."
                    className="w-full px-3 py-2.5 rounded-xl border border-blue-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#1C1C1E] mb-1">Mã tham chiếu giao dịch *</label>
                  <input
                    value={bankRef} onChange={e => setBankRef(e.target.value)}
                    placeholder="Mã GD / Transaction ID..."
                    className="w-full px-3 py-2.5 rounded-xl border border-blue-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white font-mono"
                  />
                </div>
              </div>
            )}

            {/* ── Khoản thu manual (ẩn khi có đơn) ── */}
            {!hasOrders && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold text-[#1C1C1E]">
                    Các khoản thu <span className="text-red-500">*</span>
                  </label>
                  <button onClick={addItem} className="flex items-center gap-1 text-xs text-[#C9A84C] hover:underline font-semibold">
                    <Plus size={13} /> Thêm khoản
                  </button>
                </div>
                <div className="space-y-2">
                  {items.map((item, idx) => (
                    <div key={item.id} className="bg-[#FAF7F2] rounded-xl p-3 space-y-2">
                      <div className="flex gap-2">
                        <input
                          value={item.itemName} onChange={e => updateItem(item.id, 'itemName', e.target.value)}
                          placeholder={`Khoản thu ${idx + 1}...`}
                          className="flex-1 px-3 py-2 rounded-lg border border-black/10 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/40 bg-white"
                        />
                        <input
                          value={item.amount ? new Intl.NumberFormat('vi-VN').format(parseVND(item.amount)) : ''}
                          onChange={e => updateItem(item.id, 'amount', String(parseVND(e.target.value)))}
                          placeholder="Số tiền"
                          className="w-32 px-3 py-2 rounded-lg border border-black/10 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/40 bg-white text-right"
                        />
                        {items.length > 1 && (
                          <button onClick={() => removeItem(item.id)} className="p-2 rounded-lg hover:bg-red-50 text-red-400 transition flex-shrink-0">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                      <input
                        value={item.note} onChange={e => updateItem(item.id, 'note', e.target.value)}
                        placeholder="Ghi chú (tuỳ chọn)..."
                        className="w-full px-3 py-2 rounded-lg border border-black/10 text-xs focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/40 bg-white"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tổng */}
            <div className="flex justify-between items-center py-2 border-t border-black/5">
              <span className="text-sm font-semibold text-[#8E8878]">Tổng cần thu</span>
              <span className="text-lg font-bold text-[#C9A84C]">{formatVND(displayTotal)}</span>
            </div>

            {/* ── Ảnh chứng từ ── */}
            <div>
              <label className="block text-sm font-semibold text-[#1C1C1E] mb-1.5">Ảnh chứng từ</label>
              <div className="flex flex-wrap gap-2">
                {images.map(img => (
                  <div key={img.id} className="relative w-16 h-16 rounded-xl overflow-hidden border border-black/10">
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
                  className="w-16 h-16 rounded-xl border-2 border-dashed border-black/20 flex flex-col items-center justify-center gap-0.5 hover:border-[#C9A84C] hover:bg-[#C9A84C]/5 transition text-[#8E8878] hover:text-[#C9A84C]">
                  <Upload size={14} />
                  <span className="text-xs">Thêm</span>
                </button>
                <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={handleImageChange} />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-5 border-t border-black/5 flex-shrink-0 flex gap-3">
            <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-black/10 text-sm font-semibold text-[#8E8878] hover:bg-[#FAF7F2] transition">
              Huỷ
            </button>
            <button
              onClick={handleSubmit} disabled={submitting}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[#C9A84C] text-white font-bold hover:bg-[#B8923E] transition disabled:opacity-50"
            >
              {submitting
                ? <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                : <Send size={16} />}
              {submitting ? 'Đang tạo...' : 'Tạo phiếu thu'}
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
    </>
  );
}