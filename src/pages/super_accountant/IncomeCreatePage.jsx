// src/pages/shared/IncomeCreatePage.jsx
// Dùng chung cho ACCOUNTANT và SUPER_ACCOUNTANT
import { useLang } from '../../context/LangContext';
import { useState, useRef } from 'react';
import { Sk, TableSkeleton } from '../../components/ui/Skeleton.jsx';
import useMinLoading from '../../hooks/useMinLoading.js';
import { incomeApi } from '../../api/services';
import { useToast } from '../../components/common/Toast';
import { Plus, Trash2, Upload, X, TrendingUp, Send, User, Eye } from 'lucide-react';
import VoucherDetailModal from '../../components/common/VoucherDetailModal';
import { formatVND } from '../../utils/format.js';

function parseVND(s) {
  return Number(String(s).replace(/[^0-9]/g, '')) || 0;
}



export default function IncomeCreatePage() {
  const { t } = useLang();
  const toast = useToast();

  const STATUS_CFG = {
    CONFIRMED: { label: t('status', 'confirmed'), cls: 'bg-emerald-100 dark:bg-emerald-500/18 text-emerald-700 dark:text-emerald-300' },
    APPROVED: { label: t('status', 'approved'), cls: 'bg-emerald-100 dark:bg-emerald-500/18 text-emerald-700 dark:text-emerald-300' },
    PENDING: { label: t('status', 'pending'), cls: 'bg-amber-100 dark:bg-amber-500/18 text-amber-700 dark:text-amber-300' },
    REJECTED: { label: t('status', 'rejected_short'), cls: 'bg-red-100 dark:bg-red-500/18 text-red-600 dark:text-red-300' },
  };

  const [payerName, setPayerName] = useState('');
  const [reason, setReason] = useState('');
  const [items, setItems] = useState([{ id: 1, itemName: '', amount: '', note: '' }]);
  const [images, setImages] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [vouchers, setVouchers] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [listLoaded, setListLoaded] = useState(false);
  const [detailVoucher, setDetailVoucher] = useState(null);
  const fileRef = useRef();

  const addItem = () => setItems(prev => [...prev, { id: Date.now(), itemName: '', amount: '', note: '' }]);
  const removeItem = (id) => setItems(prev => prev.filter(i => i.id !== id));
  const updateItem = (id, key, val) =>
    setItems(prev => prev.map(i => i.id === id ? { ...i, [key]: val } : i));

  const totalAmount = items.reduce((s, i) => s + parseVND(i.amount), 0);

  const handleImageChange = async (e) => {
    const files = Array.from(e.target.files);
    for (const file of files) {
      const preview = URL.createObjectURL(file);
      const tmp = { id: Date.now() + Math.random(), file, url: preview, uploading: true, uploadedUrl: null };
      setImages(prev => [...prev, tmp]);
      try {
        // Dùng đúng endpoint /income-image → lưu vào folder income-voucher
        const res = await incomeApi.uploadImage(file);
        const uploaded = res.data?.data?.imageUrl || res.data?.imageUrl || '';
        if (!uploaded) throw new Error('Không nhận được đường dẫn ảnh');
        setImages(prev =>
          prev.map(img => img.id === tmp.id ? { ...img, uploading: false, uploadedUrl: uploaded } : img));
      } catch (err) {
        setImages(prev => prev.filter(img => img.id !== tmp.id));
        toast(t('common', 'error') + ': ' + (err?.response?.data?.message || err?.message || 'Unknown'), 'error');
      }
    }
    e.target.value = '';
  };

  const handleSubmit = async () => {
    if (!reason.trim()) { toast(t('voucher', 'income_reason_required'), 'error'); return; }
    const validItems = items.filter(i => i.itemName.trim() && parseVND(i.amount) > 0);
    if (validItems.length === 0) { toast(t('voucher', 'min_one_income'), 'error'); return; }
    const uploadingCount = images.filter(img => img.uploading).length;
    if (uploadingCount > 0) { toast(`Đang tải ${uploadingCount} ảnh, vui lòng chờ...`, 'warning'); return; }
    const uploadedUrls = images.filter(img => img.uploadedUrl).map(img => img.uploadedUrl);

    setSubmitting(true);
    try {
      await incomeApi.create({
        payerName: payerName.trim() || null,
        reason: reason.trim(),
        items: validItems.map(i => ({
          itemName: i.itemName.trim(),
          amount: parseVND(i.amount),
          note: i.note.trim() || null,
        })),
        imageUrls: uploadedUrls,
      });
      toast('Phiếu thu đã được tạo thành công', 'success');
      setPayerName('');
      setReason('');
      setItems([{ id: 1, itemName: '', amount: '', note: '' }]);
      setImages([]);
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
      const res = await incomeApi.listMy({ page: 0, size: 20 });
      setVouchers(res.data?.data?.content || []);
      setListLoaded(true);
    } catch (e) {
      toast('Lỗi tải danh sách', 'error');
    } finally {
      setLoadingList(false);
    }
  };

  return (
    <>
      <div className="p-4 sm:p-6 lg:p-8 space-y-5">

        {/* Header */}
        <div className="flex items-center gap-3">
          <TrendingUp size={24} className="text-gold" />
          <div>
            <h1 className="text-2xl font-bold text-ink">Tạo phiếu thu</h1>
            <p className="text-sm text-muted">Phiếu thu có hiệu lực ngay sau khi tạo, không cần duyệt</p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

          {/* Form (2/3) */}
          <div className="xl:col-span-2 bg-surface rounded-2xl border border-hairline shadow-sm p-5 space-y-4">

            {/* Người nộp tiền */}
            <div>
              <label className="text-sm font-semibold text-ink mb-1.5 flex items-center gap-1.5">
                <User size={14} className="text-gold" /> Người nộp tiền / Đơn vị
              </label>
              <input
                value={payerName}
                onChange={e => setPayerName(e.target.value)}
                placeholder="Tên người nộp tiền hoặc đơn vị (tuỳ chọn)..."
                className="w-full px-4 py-2.5 rounded-xl border border-hairline-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40"
              />
            </div>

            {/* Lý do thu */}
            <div>
              <label className="block text-sm font-semibold text-ink mb-1.5">Lý do thu *</label>
              <input
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Mô tả lý do thu chi tiết..."
                className="w-full px-4 py-2.5 rounded-xl border border-hairline-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40"
              />
            </div>

            {/* Các khoản thu */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-ink">Các khoản thu *</label>
                <button
                  onClick={addItem}
                  className="flex items-center gap-1 text-xs text-gold hover:underline font-semibold"
                >
                  <Plus size={13} /> Thêm khoản
                </button>
              </div>
              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div key={item.id} className="bg-canvas rounded-xl p-3 space-y-2">
                    <div className="flex gap-2">
                      <input
                        value={item.itemName}
                        onChange={e => updateItem(item.id, 'itemName', e.target.value)}
                        placeholder={`Khoản thu ${idx + 1}...`}
                        className="flex-1 px-3 py-2 rounded-lg border border-hairline-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40 bg-surface"
                      />
                      <input
                        value={item.amount ? new Intl.NumberFormat('vi-VN').format(parseVND(item.amount)) : ''}
                        onChange={e => updateItem(item.id, 'amount', String(parseVND(e.target.value)))}
                        placeholder="Số tiền"
                        className="w-36 px-3 py-2 rounded-lg border border-hairline-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40 bg-surface text-right"
                      />
                      {items.length > 1 && (
                        <button
                          onClick={() => removeItem(item.id)}
                          className="p-2 rounded-lg hover:bg-red-50 dark:bg-red-500/10 text-red-400 transition flex-shrink-0"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                    <input
                      value={item.note}
                      onChange={e => updateItem(item.id, 'note', e.target.value)}
                      placeholder="Ghi chú (tuỳ chọn)..."
                      className="w-full px-3 py-2 rounded-lg border border-hairline-2 text-xs focus:outline-none focus:ring-2 focus:ring-gold/40 bg-surface"
                    />
                  </div>
                ))}
              </div>
              <div className="text-right mt-2 text-sm font-bold text-ink">
                Tổng: <span className="text-gold">{formatVND(totalAmount)}</span>
              </div>
            </div>

            {/* Ảnh chứng từ */}
            <div>
              <label className="block text-sm font-semibold text-ink mb-1.5">Ảnh chứng từ</label>
              <div className="flex flex-wrap gap-2">
                {images.map(img => (
                  <div key={img.id} className="relative w-20 h-20 rounded-xl overflow-hidden border border-hairline-2">
                    <img src={img.url} alt="" className="w-full h-full object-cover" />
                    {img.uploading && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      </div>
                    )}
                    {!img.uploading && (
                      <button
                        onClick={() => setImages(p => p.filter(i => i.id !== img.id))}
                        className="absolute top-1 right-1 p-0.5 bg-red-500 text-white rounded-full"
                      >
                        <X size={10} />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-20 h-20 rounded-xl border-2 border-dashed border-hairline-3 flex flex-col items-center justify-center gap-1 hover:border-gold hover:bg-gold/5 transition text-muted hover:text-gold"
                >
                  <Upload size={18} />
                  <span className="text-xs font-medium">Thêm ảnh</span>
                </button>
                <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={handleImageChange} />
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gold text-white font-bold hover:bg-gold-strong transition disabled:opacity-50"
            >
              {submitting
                ? <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                : <Send size={18} />}
              {submitting ? 'Đang tạo...' : 'Tạo phiếu thu'}
            </button>
          </div>

          {/* Lịch sử (1/3) */}
          <div className="bg-surface rounded-2xl border border-hairline shadow-sm p-5 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-ink">Phiếu thu của tôi</h2>
              <button
                onClick={loadMyVouchers}
                disabled={loadingList}
                className="text-sm text-gold hover:underline disabled:opacity-50"
              >
                {loadingList ? 'Đang tải...' : 'Tải danh sách'}
              </button>
            </div>

            {vouchers.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm text-muted text-center py-4">
                  Nhấn "Tải danh sách" để xem phiếu của bạn
                </p>
              </div>
            ) : (
              <div className="space-y-2 overflow-y-auto flex-1">
                {vouchers.map(v => {
                  const s = STATUS_CFG[v.status] || STATUS_CFG.CONFIRMED;
                  return (
                    <div
                      key={v.id}
                      className="flex items-center justify-between p-3 bg-canvas rounded-xl text-sm hover:bg-surface-2 cursor-pointer transition group"
                      onClick={() => setDetailVoucher(v)}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-mono font-bold text-gold text-xs">{v.voucherCode}</p>
                        <p className="text-ink font-medium truncate">{v.reason}</p>
                        {v.payerName && <p className="text-xs text-muted truncate">{v.payerName}</p>}
                      </div>
                      <div className="text-right flex-shrink-0 ml-2">
                        <p className="font-bold text-ink">{formatVND(v.totalAmount)}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.cls}`}>
                          {s.label}
                        </span>
                      </div>
                      <Eye size={14} className="ml-2 text-muted opacity-0 group-hover:opacity-100 transition flex-shrink-0" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detail modal */}
      {detailVoucher && (
        <VoucherDetailModal
          voucher={detailVoucher}
          type="income"
          onClose={() => setDetailVoucher(null)}
        />
      )}
    </>
  );
}