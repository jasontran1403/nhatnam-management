// src/pages/super_accountant/ExpenseCreatePage.jsx
import { useLang } from '../../context/LangContext';
import { useState, useRef, useEffect } from 'react';
import { Sk, TableSkeleton } from '../../components/ui/Skeleton.jsx';
import useMinLoading from '../../hooks/useMinLoading.js';
import { expenseApi } from '../../api/services';
import { accountantSupplierApi } from '../../api/accountantApi';
import { useToast } from '../../components/common/Toast';
import { Plus, Trash2, Upload, X, Receipt, Send, Building2, ChevronDown } from 'lucide-react';

function formatVND(n) {
  return new Intl.NumberFormat('vi-VN').format(n || 0) + ' đ';
}
function parseVND(s) {
  return Number(String(s).replace(/[^0-9]/g, '')) || 0;
}

export default function ExpenseCreatePage() {
  const { t } = useLang();
  const toast = useToast();

  const [vendorName, setVendorName]           = useState('');
  const [vendorSearchMode, setVendorSearchMode] = useState('select');
  const [suppliers, setSuppliers]             = useState([]);
  const [supplierLoading, setSupplierLoading] = useMinLoading();
  const [supplierDropOpen, setSupplierDropOpen] = useState(false);
  const [supplierSearch, setSupplierSearch]   = useState('');

  const [reason, setReason]                   = useState('');
  const [requestedByName, setRequestedByName] = useState('');
  const [items, setItems]                     = useState([{ id: 1, itemName: '', amount: '', note: '' }]);
  const [images, setImages]                   = useState([]);
  const [submitting, setSubmitting]           = useState(false);
  const [vouchers, setVouchers]               = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [listLoaded, setListLoaded]           = useState(false);
  const fileRef = useRef();

  // Load danh sách nhà cung cấp — dùng đúng method .list()
  useEffect(() => {
    (async () => {
      setSupplierLoading(true);
      try {
        const res = await accountantSupplierApi.list();  // ← đúng method
        setSuppliers(res.data?.data || []);
      } catch (e) {
        console.error('Load suppliers error:', e);
      } finally {
        setSupplierLoading(false);
      }
    })();
  }, []);

  const filteredSuppliers = suppliers.filter(s =>
    s.name.toLowerCase().includes(supplierSearch.toLowerCase()) ||
    (s.phone && s.phone.includes(supplierSearch))
  );

  const addItem    = () => setItems(prev => [...prev, { id: Date.now(), itemName: '', amount: '', note: '' }]);
  const removeItem = (id) => setItems(prev => prev.filter(i => i.id !== id));
  const updateItem = (id, key, val) => setItems(prev => prev.map(i => i.id === id ? { ...i, [key]: val } : i));

  const totalAmount = items.reduce((s, i) => s + parseVND(i.amount), 0);

  const handleImageChange = async (e) => {
    const files = Array.from(e.target.files);
    for (const file of files) {
      const preview = URL.createObjectURL(file);
      const tmp = { id: Date.now() + Math.random(), file, url: preview, uploading: true, uploadedUrl: null };
      setImages(prev => [...prev, tmp]);
      try {
        const res = await expenseApi.uploadImage(file);
        const uploaded = res.data?.data?.imageUrl || res.data?.imageUrl || '';
        if (!uploaded) throw new Error('Không nhận được đường dẫn ảnh');
        setImages(prev => prev.map(img => img.id === tmp.id ? { ...img, uploading: false, uploadedUrl: uploaded } : img));
      } catch (err) {
        setImages(prev => prev.filter(img => img.id !== tmp.id));
        toast(t('common','error') + ': ' + (err?.response?.data?.message || err?.message || 'Unknown'), 'error');
      }
    }
    e.target.value = '';
  };

  const handleSubmit = async () => {
    if (!reason.trim()) { toast(t('voucher','expense_reason_required'), 'error'); return; }
    const validItems = items.filter(i => i.itemName.trim() && parseVND(i.amount) > 0);
    if (validItems.length === 0) { toast('Phải có ít nhất 1 khoản chi hợp lệ', 'error'); return; }
    const uploadingCount = images.filter(img => img.uploading).length;
    if (uploadingCount > 0) { toast(`Đang tải ${uploadingCount} ảnh, vui lòng chờ...`, 'warning'); return; }
    const uploadedUrls = images.filter(img => img.uploadedUrl).map(img => img.uploadedUrl);

    setSubmitting(true);
    try {
      await expenseApi.create({
        vendorName: vendorName.trim() || null,
        reason: reason.trim(),
        requestedByName: requestedByName.trim() || null,
        items: validItems.map(i => ({ itemName: i.itemName.trim(), amount: parseVND(i.amount), note: i.note.trim() || null })),
        imageUrls: uploadedUrls,
      });
      toast('Phiếu chi đã gửi, chờ ADMIN/OWNER duyệt', 'success');
      setVendorName(''); setReason(''); setRequestedByName('');
      setItems([{ id: 1, itemName: '', amount: '', note: '' }]);
      setImages([]); setSupplierSearch('');
      if (listLoaded) loadMyVouchers();
    } catch (e) {
      toast(e?.response?.data?.message || 'Lỗi khi tạo phiếu', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const loadMyVouchers = async () => {
    setLoadingList(true);
    try {
      const res = await expenseApi.listMy({ page: 0, size: 20 });
      setVouchers(res.data?.data?.content || []);
      setListLoaded(true);
    } catch (e) {
      toast('Lỗi tải danh sách', 'error');
    } finally {
      setLoadingList(false);
    }
  };

  return (
    // full width — bỏ max-w-3xl, dùng toàn bộ chiều rộng
    <div className="p-4 sm:p-6 lg:p-8 space-y-5">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Receipt size={24} className="text-[#C9A84C]" />
        <div>
          <h1 className="text-2xl font-bold text-[#1C1C1E]">Tạo phiếu chi</h1>
          <p className="text-sm text-[#8E8878]">Phiếu chi sẽ được gửi lên ADMIN/OWNER để duyệt</p>
        </div>
      </div>

      {/* 2-col layout trên desktop */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* Cột trái: Form tạo phiếu (2/3) */}
        <div className="xl:col-span-2 bg-white rounded-2xl border border-black/5 shadow-sm p-5 space-y-4">

          {/* Nhà cung cấp */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-semibold text-[#1C1C1E] flex items-center gap-1.5">
                <Building2 size={14} className="text-[#C9A84C]" /> Nhà cung cấp / Đơn vị
              </label>
              <button
                onClick={() => { setVendorSearchMode(m => m === 'select' ? 'manual' : 'select'); setVendorName(''); setSupplierSearch(''); }}
                className="text-xs text-[#C9A84C] hover:underline"
              >
                {vendorSearchMode === 'select' ? '+ Nhập thủ công' : '← Chọn từ danh sách'}
              </button>
            </div>

            {vendorSearchMode === 'select' ? (
              <div className="relative">
                <div
                  onClick={() => setSupplierDropOpen(o => !o)}
                  className="flex items-center justify-between px-4 py-2.5 rounded-xl border border-black/10 bg-white cursor-pointer hover:border-[#C9A84C] transition"
                >
                  <span className={vendorName ? 'text-[#1C1C1E] text-sm' : 'text-[#8E8878] text-sm'}>
                    {vendorName || (supplierLoading ? 'Đang tải...': suppliers.length === 0 ? 'Chưa có nhà cung cấp' : 'Chọn nhà cung cấp...')}
                  </span>
                  <ChevronDown size={16} className={`text-[#8E8878] transition-transform ${supplierDropOpen ? 'rotate-180' : ''}`} />
                </div>

                {supplierDropOpen && (
                  <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-black/10 rounded-xl shadow-lg overflow-hidden">
                    <div className="p-2 border-b border-black/5">
                      <input
                        autoFocus
                        value={supplierSearch}
                        onChange={e => setSupplierSearch(e.target.value)}
                        placeholder="Tìm kiếm..."
                        className="w-full px-3 py-2 text-sm rounded-lg border border-black/10 focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/40"
                      />
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      <button
                        onClick={() => { setVendorName(''); setSupplierDropOpen(false); }}
                        className="w-full text-left px-4 py-2.5 text-sm text-[#8E8878] hover:bg-[#FAF7F2] transition"
                      >
                        — Không chọn —
                      </button>
                      {filteredSuppliers.length === 0 && supplierSearch && (
                        <p className="text-center py-3 text-xs text-[#8E8878]">Không tìm thấy</p>
                      )}
                      {filteredSuppliers.map(s => (
                        <button key={s.id}
                          onClick={() => { setVendorName(s.name); setSupplierDropOpen(false); setSupplierSearch(''); }}
                          className="w-full text-left px-4 py-2.5 hover:bg-[#FAF7F2] transition"
                        >
                          <p className="text-sm font-medium text-[#1C1C1E]">{s.name}</p>
                          {s.phone && <p className="text-xs text-[#8E8878]">{s.phone}</p>}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <input
                value={vendorName}
                onChange={e => setVendorName(e.target.value)}
                placeholder="Nhập tên nhà cung cấp / đơn vị thi công..."
                className="w-full px-4 py-2.5 rounded-xl border border-black/10 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/40"
              />
            )}
          </div>

          {/* Lý do chi */}
          <div>
            <label className="block text-sm font-semibold text-[#1C1C1E] mb-1.5">Lý do chi *</label>
            <input value={reason} onChange={e => setReason(e.target.value)}
              placeholder="Mô tả lý do chi tiết..."
              className="w-full px-4 py-2.5 rounded-xl border border-black/10 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/40" />
          </div>

          {/* Người yêu cầu */}
          <div>
            <label className="block text-sm font-semibold text-[#1C1C1E] mb-1.5">Người yêu cầu</label>
            <input value={requestedByName} onChange={e => setRequestedByName(e.target.value)}
              placeholder="Tên người yêu cầu (nếu khác người lập phiếu)..."
              className="w-full px-4 py-2.5 rounded-xl border border-black/10 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/40" />
          </div>

          {/* Khoản chi */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-[#1C1C1E]">Các khoản chi *</label>
              <button onClick={addItem} className="flex items-center gap-1 text-xs text-[#C9A84C] hover:underline font-semibold">
                <Plus size={13} /> Thêm khoản
              </button>
            </div>
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={item.id} className="bg-[#FAF7F2] rounded-xl p-3 space-y-2">
                  <div className="flex gap-2">
                    <input value={item.itemName} onChange={e => updateItem(item.id, 'itemName', e.target.value)}
                      placeholder={`Khoản chi ${idx + 1}...`}
                      className="flex-1 px-3 py-2 rounded-lg border border-black/10 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/40 bg-white" />
                    <input
                      value={item.amount ? new Intl.NumberFormat('vi-VN').format(parseVND(item.amount)) : ''}
                      onChange={e => updateItem(item.id, 'amount', String(parseVND(e.target.value)))}
                      placeholder="Số tiền"
                      className="w-36 px-3 py-2 rounded-lg border border-black/10 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/40 bg-white text-right" />
                    {items.length > 1 && (
                      <button onClick={() => removeItem(item.id)} className="p-2 rounded-lg hover:bg-red-50 text-red-400 transition flex-shrink-0">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  <input value={item.note} onChange={e => updateItem(item.id, 'note', e.target.value)}
                    placeholder="Ghi chú (tuỳ chọn)..."
                    className="w-full px-3 py-2 rounded-lg border border-black/10 text-xs focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/40 bg-white" />
                </div>
              ))}
            </div>
            <div className="text-right mt-2 text-sm font-bold text-[#1C1C1E]">
              Tổng: {formatVND(totalAmount)}
            </div>
          </div>

          {/* Ảnh chứng từ */}
          <div>
            <label className="block text-sm font-semibold text-[#1C1C1E] mb-1.5">Ảnh chứng từ</label>
            <div className="flex flex-wrap gap-2">
              {images.map(img => (
                <div key={img.id} className="relative w-20 h-20 rounded-xl overflow-hidden border border-black/10">
                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                  {img.uploading && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    </div>
                  )}
                  {!img.uploading && (
                    <button onClick={() => setImages(p => p.filter(i => i.id !== img.id))}
                      className="absolute top-1 right-1 p-0.5 bg-red-500 text-white rounded-full">
                      <X size={10} />
                    </button>
                  )}
                </div>
              ))}
              <button onClick={() => fileRef.current?.click()}
                className="w-20 h-20 rounded-xl border-2 border-dashed border-black/20 flex flex-col items-center justify-center gap-1 hover:border-[#C9A84C] hover:bg-[#C9A84C]/5 transition text-[#8E8878] hover:text-[#C9A84C]">
                <Upload size={18} />
                <span className="text-xs font-medium">Thêm ảnh</span>
              </button>
              <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={handleImageChange} />
            </div>
          </div>

          <button onClick={handleSubmit} disabled={submitting}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#C9A84C] text-white font-bold hover:bg-[#B8923E] transition disabled:opacity-50">
            {submitting ? <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Send size={18} />}
            {submitting ? 'Đang gửi...' : 'Gửi phiếu chi'}
          </button>
        </div>

        {/* Cột phải: Lịch sử phiếu chi (1/3) */}
        <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-[#1C1C1E]">Phiếu chi của tôi</h2>
            <button onClick={loadMyVouchers} disabled={loadingList}
              className="text-sm text-[#C9A84C] hover:underline disabled:opacity-50">
              {loadingList ? 'Đang tải...': 'Tải danh sách'}
            </button>
          </div>

          {vouchers.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-[#8E8878] text-center py-4">Nhấn "Tải danh sách" để xem phiếu của bạn</p>
            </div>
          ) : (
            <div className="space-y-2 overflow-y-auto flex-1">
              {vouchers.map(v => (
                <div key={v.id} className="flex items-center justify-between p-3 bg-[#FAF7F2] rounded-xl text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono font-bold text-[#C9A84C] text-xs">{v.voucherCode}</p>
                    <p className="text-[#1C1C1E] font-medium truncate">{v.reason}</p>
                    {v.vendorName && <p className="text-xs text-[#8E8878] truncate">{v.vendorName}</p>}
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    <p className="font-bold text-[#1C1C1E]">{formatVND(v.totalAmount)}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      v.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                      v.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {v.status === 'APPROVED' ? t('status','approved'): v.status === 'REJECTED' ? t('status','rejected_short'): t('status','pending')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}