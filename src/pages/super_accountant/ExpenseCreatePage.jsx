// src/pages/super_accountant/ExpenseCreatePage.jsx
// Change 5: SUPER_ACCOUNTANT / SUPER_WAREHOUSE tạo phiếu chi
import { useState, useRef } from 'react';
import { expenseApi } from '../../api/services';
import { useToast } from '../../components/common/Toast';
import { Plus, Trash2, Upload, X, Receipt, Send } from 'lucide-react';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

function formatVND(n) {
  return new Intl.NumberFormat('vi-VN').format(n || 0) + ' đ';
}
function parseVND(s) {
  return Number(String(s).replace(/[^0-9]/g, '')) || 0;
}

export default function ExpenseCreatePage() {
  const toast = useToast();
  const user = (() => { try { return JSON.parse(localStorage.getItem('user')); } catch { return null; } })();

  const [vendorName, setVendorName] = useState('');
  const [reason, setReason] = useState('');
  const [requestedByName, setRequestedByName] = useState('');
  const [items, setItems] = useState([{ id: 1, itemName: '', amount: '', note: '' }]);
  const [images, setImages] = useState([]); // { file, url, uploading, uploadedUrl }
  const [submitting, setSubmitting] = useState(false);
  const [vouchers, setVouchers] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [listLoaded, setListLoaded] = useState(false);
  const fileRef = useRef();

  const addItem = () => setItems(prev => [...prev, { id: Date.now(), itemName: '', amount: '', note: '' }]);
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
      } catch(err) {
        setImages(prev => prev.filter(img => img.id !== tmp.id));
        toast('Lỗi upload ảnh: ' + (err?.response?.data?.message || err?.message || 'Unknown'), 'error');
      }
    }
    e.target.value = '';
  };

  const handleSubmit = async () => {
    if (!reason.trim()) { toast('Lý do chi là bắt buộc', 'error'); return; }
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
      setImages([]);
      if (listLoaded) loadMyVouchers();
    } catch(e) { toast(e?.response?.data?.message || 'Lỗi khi tạo phiếu', 'error'); }
    finally { setSubmitting(false); }
  };

  const loadMyVouchers = async () => {
    setLoadingList(true);
    try {
      const res = await expenseApi.listMy({ page: 0, size: 30 });
      setVouchers(res.data?.data?.content || []);
      setListLoaded(true);
    } catch { toast('Không thể tải danh sách', 'error'); }
    finally { setLoadingList(false); }
  };

  const STATUS_CLS = {
    PENDING:  'bg-amber-50 text-amber-700 border-amber-200',
    APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    REJECTED: 'bg-red-50 text-red-600 border-red-200',
  };
  const STATUS_LABEL = { PENDING: 'Chờ duyệt', APPROVED: 'Đã duyệt', REJECTED: 'Từ chối' };

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-[#C9A84C]/10 rounded-xl"><Receipt size={22} className="text-[#C9A84C]" /></div>
        <div>
          <h1 className="text-xl font-bold text-[#1C1C1E]">Tạo phiếu chi phí</h1>
          <p className="text-xs text-[#8E8878]">Người lập: <strong>{user?.fullName || user?.username}</strong></p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[#E8DDD0] p-5 space-y-4">
        {/* Tên đơn vị */}
        <div>
          <label className="text-xs font-semibold text-[#8E8878] uppercase block mb-1">Đơn vị thi công / Nhà cung cấp <span className="normal-case font-normal">(tùy chọn)</span></label>
          <input value={vendorName} onChange={e => setVendorName(e.target.value)}
            className="w-full border border-[#E8DDD0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30"
            placeholder="Tên đơn vị..." />
        </div>

        {/* Lý do */}
        <div>
          <label className="text-xs font-semibold text-[#8E8878] uppercase block mb-1">Lý do chi <span className="text-red-400">*</span></label>
          <textarea value={reason} onChange={e => setReason(e.target.value)}
            className="w-full border border-[#E8DDD0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30 min-h-[80px]"
            placeholder="Mô tả lý do chi phí..." />
        </div>

        {/* Người yêu cầu */}
        <div>
          <label className="text-xs font-semibold text-[#8E8878] uppercase block mb-1">Người yêu cầu <span className="normal-case font-normal">(mặc định là bạn)</span></label>
          <input value={requestedByName} onChange={e => setRequestedByName(e.target.value)}
            className="w-full border border-[#E8DDD0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30"
            placeholder="Tên người yêu cầu..." />
        </div>

        {/* Danh sách khoản chi */}
        <div>
          <label className="text-xs font-semibold text-[#8E8878] uppercase block mb-2">Khoản chi <span className="text-red-400">*</span></label>
          <div className="space-y-2">
            {items.map((item, idx) => (
              <div key={item.id} className="flex gap-2 items-start">
                <span className="text-xs text-[#8E8878] mt-2.5 w-5 shrink-0">{idx + 1}.</span>
                <input value={item.itemName} onChange={e => updateItem(item.id, 'itemName', e.target.value)}
                  className="flex-1 border border-[#E8DDD0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30"
                  placeholder="Tên khoản chi..." />
                <input value={item.amount} onChange={e => updateItem(item.id, 'amount', e.target.value.replace(/[^0-9]/g, ''))}
                  className="w-32 border border-[#E8DDD0] rounded-xl px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30"
                  placeholder="Số tiền" />
                {items.length > 1 && (
                  <button onClick={() => removeItem(item.id)} className="p-2 text-red-400 hover:text-red-600 mt-0.5">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button onClick={addItem} className="mt-2 flex items-center gap-1 text-xs text-[#C9A84C] hover:text-[#B8973B] font-medium">
            <Plus size={13} /> Thêm khoản chi
          </button>
          {totalAmount > 0 && (
            <div className="mt-3 text-right text-sm font-bold text-[#C9A84C]">
              Tổng: {formatVND(totalAmount)}
            </div>
          )}
        </div>

        {/* Ảnh chứng từ */}
        <div>
          <label className="text-xs font-semibold text-[#8E8878] uppercase block mb-2">Ảnh chứng từ <span className="normal-case font-normal">(tùy chọn)</span></label>
          <div className="flex flex-wrap gap-2">
            {images.map(img => (
              <div key={img.id} className="relative w-20 h-20">
                <img src={img.url} className="w-full h-full object-cover rounded-xl border border-[#E8DDD0]" />
                {img.uploading && (
                  <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
                {!img.uploading && (
                  <button onClick={() => setImages(prev => prev.filter(i => i.id !== img.id))}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white">
                    <X size={10} />
                  </button>
                )}
              </div>
            ))}
            <button onClick={() => fileRef.current?.click()}
              className="w-20 h-20 border-2 border-dashed border-[#E8DDD0] rounded-xl flex flex-col items-center justify-center text-[#8E8878] hover:border-[#C9A84C] hover:text-[#C9A84C] transition-colors">
              <Upload size={16} />
              <span className="text-[9px] mt-1">Tải ảnh</span>
            </button>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageChange} />
          </div>
        </div>
      </div>

      <button onClick={handleSubmit} disabled={submitting}
        className="w-full py-3 bg-[#C9A84C] hover:bg-[#B8973B] disabled:opacity-60 text-white rounded-2xl font-semibold flex items-center justify-center gap-2 transition-colors">
        <Send size={16} />
        {submitting ? 'Đang gửi...' : 'Gửi phiếu chi'}
      </button>

      {/* Danh sách phiếu của tôi */}
      <div>
        {!listLoaded
          ? <button onClick={loadMyVouchers} className="text-sm text-[#C9A84C] hover:underline">
              Xem phiếu chi đã tạo →
            </button>
          : loadingList ? <p className="text-sm text-[#8E8878]">Đang tải...</p>
          : (
            <div className="bg-white rounded-2xl border border-[#E8DDD0] overflow-hidden">
              <div className="px-4 py-3 border-b border-[#E8DDD0] bg-[#FAF7F2]">
                <h2 className="text-sm font-bold text-[#1C1C1E]">Phiếu chi của tôi</h2>
              </div>
              {vouchers.length === 0
                ? <p className="p-4 text-sm text-[#8E8878]">Chưa có phiếu nào</p>
                : vouchers.map(v => (
                  <div key={v.id} className="px-4 py-3 border-b border-[#F0EBE3] last:border-0">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs font-mono text-[#C9A84C]">{v.voucherCode}</p>
                        <p className="text-sm font-medium text-[#1C1C1E]">{v.reason}</p>
                        {v.rejectReason && <p className="text-xs text-red-500 mt-0.5">Từ chối: {v.rejectReason}</p>}
                      </div>
                      <div className="text-right">
                        <span className={`inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_CLS[v.status]}`}>
                          {STATUS_LABEL[v.status]}
                        </span>
                        <p className="text-sm font-bold text-[#C9A84C] mt-1">{formatVND(v.totalAmount)}</p>
                      </div>
                    </div>
                  </div>
                ))
              }
            </div>
          )
        }
      </div>
    </div>
  );
}