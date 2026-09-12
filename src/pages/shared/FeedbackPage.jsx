// src/pages/shared/FeedbackPage.jsx

import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MessageSquare, Search, ArrowLeft, CheckCircle2,
  Package, User, Phone, AlertCircle, Send, Loader2,
  ImageIcon, X, Plus, Clock, FileQuestion, Inbox,
} from 'lucide-react';
import { feedbackApi } from '../../api/feedbackApi';
import { getImageUrl } from '../../api/services';
import { useToast } from '../../components/common/Toast';
import { PageHeader, inputCls, selectCls, formatNumber, formatDateTime } from '../../components/ui';

const MAX_IMAGES = 8;
const MAX_IMAGE_MB = 10;

export default function FeedbackPage() {
  const navigate = useNavigate();
  const toast = useToast();

  const [orderCodeInput, setOrderCodeInput] = useState('');
  const [order, setOrder] = useState(null);
  const [existingFeedbacks, setExistingFeedbacks] = useState([]);
  const [showForm, setShowForm] = useState(false);
  // idle = chưa tra | loading = đang tra | notfound = tra lỗi | found = có đơn
  const [lookupState, setLookupState] = useState('idle');
  const [lookupError, setLookupError] = useState('');

  const [productIdx, setProductIdx] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [content, setContent] = useState('');
  const [images, setImages] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const productInputRef = useRef(null);
  const fileInputRef = useRef(null);

  // ── Tra mã đơn ────────────────────────────────────────────────────────────
  const doLookup = useCallback(async () => {
    const code = orderCodeInput.trim();
    if (!code) { setLookupError('Vui lòng nhập mã đơn'); return; }

    setLookupState('loading');
    setLookupError('');
    setOrder(null);
    setExistingFeedbacks([]);
    setShowForm(false);
    setProductIdx('');

    try {
      const [orderData, fbList] = await Promise.all([
        feedbackApi.lookup(code),
        feedbackApi.listByOrder(code).catch(() => []),
      ]);
      setOrder(orderData);
      setExistingFeedbacks(Array.isArray(fbList) ? fbList : []);
      setShowForm(!fbList || fbList.length === 0);
      setLookupState('found');
      if (!fbList || fbList.length === 0) {
        setTimeout(() => productInputRef.current?.focus(), 50);
      }
    } catch (err) {
      setLookupError(err?.message || 'Không tìm thấy đơn hàng');
      setLookupState('notfound');
    }
  }, [orderCodeInput]);

  // ── Ảnh ──────────────────────────────────────────────────────────────────
  const addImages = (fileList) => {
    const files = Array.from(fileList || []).filter(f => {
      if (!f.type.startsWith('image/')) {
        toast(`Bỏ qua ${f.name}: không phải ảnh`, 'error');
        return false;
      }
      if (f.size > MAX_IMAGE_MB * 1024 * 1024) {
        toast(`Bỏ qua ${f.name}: quá ${MAX_IMAGE_MB}MB`, 'error');
        return false;
      }
      return true;
    });
    const room = MAX_IMAGES - images.length;
    if (files.length > room) toast(`Chỉ được đính kèm tối đa ${MAX_IMAGES} ảnh`, 'error');
    const toAdd = files.slice(0, room).map(f => ({ file: f, previewUrl: URL.createObjectURL(f) }));
    setImages(prev => [...prev, ...toAdd]);
  };

  const removeImage = (idx) => {
    setImages(prev => {
      const next = [...prev];
      const [removed] = next.splice(idx, 1);
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      return next;
    });
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const onSubmit = async (e) => {
    e?.preventDefault?.();
    if (!order) { toast('Vui lòng tra mã đơn trước', 'error'); return; }
    if (productIdx === '') { toast('Vui lòng chọn sản phẩm', 'error'); return; }
    if (!content.trim()) { toast('Vui lòng nhập nội dung feedback', 'error'); return; }

    const product = order.products?.[Number(productIdx)];
    if (!product) { toast('Sản phẩm không hợp lệ', 'error'); return; }

    setSubmitting(true);
    try {
      let imageUrls = [];
      if (images.length > 0) {
        const data = await feedbackApi.uploadImages(images.map(i => i.file));
        imageUrls = data?.urls || [];
      }

      await feedbackApi.create({
        orderCode: order.orderCode,
        productId: product.productId || null,
        productName: product.productName,
        contactName: contactName.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
        content: content.trim(),
        imageUrls,
      });

      toast('Đã ghi nhận feedback', 'success');

      setContent('');
      setProductIdx('');
      setContactName('');
      setContactPhone('');
      images.forEach(i => URL.revokeObjectURL(i.previewUrl));
      setImages([]);

      try {
        const fbList = await feedbackApi.listByOrder(order.orderCode);
        setExistingFeedbacks(Array.isArray(fbList) ? fbList : []);
        setShowForm(false);
      } catch { /* ignore */ }
    } catch (err) {
      toast(err?.message || 'Không tạo được feedback', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full space-y-5">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-line text-sm text-muted hover:text-ink hover:bg-canvas transition-colors">
        <ArrowLeft size={14} /> Quay lại
      </button>

      <PageHeader
        icon={MessageSquare}
        title="Feedback đơn hàng"
        subtitle="Ghi nhận phản hồi của khách về sản phẩm trong đơn"
      />

      {/* ══════ LAYOUT 2 CỘT 30/70 ══════ */}
      <div className="grid grid-cols-1 lg:grid-cols-[30%_1fr] gap-5 items-start">

        {/* ───────── CỘT TRÁI 30% — tra mã đơn + lịch sử FB ───────── */}
        <div className="space-y-4 lg:sticky lg:top-4">
          <div className="bg-surface rounded-2xl border border-hairline shadow-sm p-5 space-y-3">
            <label className="block text-sm font-semibold text-ink">
              Mã đơn hàng <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
                <input
                  type="text"
                  value={orderCodeInput}
                  onChange={e => { setOrderCodeInput(e.target.value); setLookupError(''); }}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); doLookup(); } }}
                  placeholder="Ví dụ: NĐ-05364"
                  className={`${inputCls} pl-9 font-mono`}
                  autoFocus
                />
              </div>
              <button type="button" onClick={doLookup}
                disabled={lookupState === 'loading' || !orderCodeInput.trim()}
                className="px-4 py-2 rounded-xl bg-gold text-white text-sm font-medium hover:bg-gold-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap inline-flex items-center gap-1.5">
                {lookupState === 'loading'
                  ? <Loader2 size={14} className="animate-spin" />
                  : <Search size={14} />}
                Tra đơn
              </button>
            </div>
            {order && (
              <div className="text-xs text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1">
                <CheckCircle2 size={12} /> Đã tìm thấy — KH:{' '}
                <b className="font-semibold">{order.customerName || 'Khách lẻ'}</b>
              </div>
            )}
          </div>

          {/* Lịch sử feedback — chỉ hiện khi có */}
          {order && existingFeedbacks.length > 0 && (
            <div className="bg-surface rounded-2xl border border-hairline shadow-sm p-5 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-ink inline-flex items-center gap-2">
                  <MessageSquare size={14} className="text-sky-600" />
                  Feedback đã có ({existingFeedbacks.length})
                </h3>
                {!showForm && (
                  <button
                    onClick={() => { setShowForm(true); setTimeout(() => productInputRef.current?.focus(), 50); }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-500/28 hover:bg-sky-100 dark:hover:bg-sky-500/18 transition-colors text-[11px] font-medium">
                    <Plus size={11} /> Thêm
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {existingFeedbacks.map(fb => (
                  <div key={fb.id} className="p-3 rounded-xl border border-hairline bg-canvas/40">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="text-xs font-medium text-ink truncate inline-flex items-center gap-1">
                        <Package size={11} className="text-muted" /> {fb.productName}
                      </div>
                      <span className="text-[10px] text-muted inline-flex items-center gap-1 whitespace-nowrap">
                        <Clock size={9} /> {formatDateTime(fb.createdAt)}
                      </span>
                    </div>
                    <div className="text-xs text-ink whitespace-pre-wrap">{fb.content}</div>
                    {fb.imageUrls && fb.imageUrls.length > 0 && (
                      <div className="mt-2 flex gap-1.5 flex-wrap">
                        {fb.imageUrls.map((u, i) => (
                          <a key={i} href={getImageUrl(u)} target="_blank" rel="noreferrer"
                            className="block w-12 h-12 rounded-lg overflow-hidden border border-hairline hover:opacity-80 transition-opacity">
                            <img src={getImageUrl(u)} alt="" className="w-full h-full object-cover" />
                          </a>
                        ))}
                      </div>
                    )}
                    {(fb.contactName || fb.createdByName) && (
                      <div className="mt-1.5 text-[10px] text-muted italic">
                        {fb.contactName && <>LH: {fb.contactName}{fb.contactPhone ? ` (${fb.contactPhone})` : ''}</>}
                        {fb.createdByName && <> · {fb.createdByName}</>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ───────── CỘT PHẢI 70% — vùng động ───────── */}
        <div className="min-h-[400px]">

          {/* (1) IDLE — chưa tra gì */}
          {lookupState === 'idle' && (
            <div className="bg-surface rounded-2xl border border-dashed border-hairline p-10 h-full flex flex-col items-center justify-center text-center">
              <Inbox size={40} className="text-muted/50 mb-3" />
              <div className="text-sm font-medium text-ink">Nhập mã đơn để bắt đầu</div>
              <div className="text-xs text-muted mt-1">Form feedback sẽ hiển thị ở đây sau khi tra đơn.</div>
            </div>
          )}

          {/* (2) LOADING — đang tra */}
          {lookupState === 'loading' && (
            <div className="bg-surface rounded-2xl border border-hairline shadow-sm p-10 h-full flex flex-col items-center justify-center text-center">
              <Loader2 size={36} className="text-gold animate-spin mb-3" />
              <div className="text-sm font-medium text-ink">Đang tra đơn {orderCodeInput}…</div>
              <div className="text-xs text-muted mt-1">Vui lòng đợi trong giây lát.</div>
            </div>
          )}

          {/* (3) NOT FOUND — tra lỗi */}
          {lookupState === 'notfound' && (
            <div className="bg-surface rounded-2xl border border-dashed border-red-300/60 dark:border-red-500/30 p-10 h-full flex flex-col items-center justify-center text-center">
              <FileQuestion size={40} className="text-red-400 mb-3" />
              <div className="text-sm font-medium text-ink">Không tìm thấy đơn hàng</div>
              <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                {lookupError || 'Vui lòng kiểm tra lại mã đơn.'}
              </div>
            </div>
          )}

          {/* (4) FOUND — có đơn, hiện form (hoặc thông báo nếu đơn không có SP) */}
          {lookupState === 'found' && order && (
            <>
              {showForm ? (
                <form onSubmit={onSubmit}
                  className="bg-surface rounded-2xl border border-hairline shadow-sm p-5 sm:p-6 space-y-5">
                  <h3 className="text-sm font-bold text-ink">Tạo feedback mới</h3>

                  {/* Sản phẩm */}
                  <div>
                    <label className="block text-sm font-semibold text-ink mb-2">
                      <Package size={13} className="inline -mt-0.5 mr-1" />
                      Sản phẩm cần feedback <span className="text-red-500">*</span>
                    </label>
                    <select ref={productInputRef} value={productIdx}
                      onChange={e => setProductIdx(e.target.value)}
                      className={selectCls} required>
                      <option value="">— Chọn sản phẩm trong đơn —</option>
                      {(order.products || []).map((p, i) => (
                        <option key={i} value={i}>
                          {p.productName}
                          {p.quantity != null ? ` (${formatNumber(p.quantity)}${p.unit ? ' ' + p.unit : ''})` : ''}
                        </option>
                      ))}
                    </select>
                    {(!order.products || order.products.length === 0) && (
                      <div className="mt-1 text-xs text-muted italic">Đơn không có sản phẩm nào để feedback.</div>
                    )}
                  </div>

                  {/* Contact */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-ink mb-2">
                        <User size={13} className="inline -mt-0.5 mr-1" /> Tên liên hệ
                      </label>
                      <input type="text" value={contactName} onChange={e => setContactName(e.target.value)}
                        placeholder={order.customerName || 'Tên KH'} className={inputCls} />
                      <div className="mt-1 text-[11px] text-muted">Mặc định lấy từ KH, có thể sửa</div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-ink mb-2">
                        <Phone size={13} className="inline -mt-0.5 mr-1" /> SĐT liên hệ
                      </label>
                      <input type="tel" value={contactPhone} onChange={e => setContactPhone(e.target.value)}
                        placeholder={order.customerPhone || 'SĐT KH'} className={inputCls} />
                    </div>
                  </div>

                  {/* Nội dung */}
                  <div>
                    <label className="block text-sm font-semibold text-ink mb-2">
                      Nội dung feedback <span className="text-red-500">*</span>
                    </label>
                    <textarea value={content} onChange={e => setContent(e.target.value)}
                      rows={5} maxLength={5000}
                      placeholder="Ví dụ: khách phản ánh sản phẩm bị vỡ hộp, cần đổi trả..."
                      className={inputCls} required />
                    <div className="mt-1 text-[11px] text-muted text-right">{content.length}/5000</div>
                  </div>

                  {/* Ảnh */}
                  <div>
                    <label className="block text-sm font-semibold text-ink mb-2">
                      <ImageIcon size={13} className="inline -mt-0.5 mr-1" />
                      Ảnh đính kèm <span className="text-muted font-normal">({images.length}/{MAX_IMAGES})</span>
                    </label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      capture="environment"
                      onChange={e => { addImages(e.target.files); e.target.value = ''; }}
                      className="hidden"
                    />
                    <div className="flex gap-2 flex-wrap">
                      {images.map((img, i) => (
                        <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-hairline group">
                          <img src={img.previewUrl} alt="" className="w-full h-full object-cover" />
                          <button type="button" onClick={() => removeImage(i)}
                            className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Xoá ảnh">
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                      {images.length < MAX_IMAGES && (
                        <button type="button" onClick={() => fileInputRef.current?.click()}
                          className="w-20 h-20 rounded-lg border-2 border-dashed border-line hover:border-gold hover:bg-canvas transition-colors inline-flex flex-col items-center justify-center gap-1 text-muted hover:text-gold">
                          <Plus size={18} />
                          <span className="text-[10px]">Thêm ảnh</span>
                        </button>
                      )}
                    </div>
                    <div className="mt-1 text-[11px] text-muted">
                      Tối đa {MAX_IMAGES} ảnh, mỗi ảnh ≤ {MAX_IMAGE_MB}MB. Trên mobile sẽ ưu tiên mở camera.
                    </div>
                  </div>

                  {/* Submit — sticky */}
                  <div className="sticky bottom-0 -mx-5 sm:-mx-6 px-5 sm:px-6 py-3 bg-surface/95 backdrop-blur
                                  border-t border-hairline rounded-b-2xl flex justify-end gap-2">
                    {existingFeedbacks.length > 0 && (
                      <button type="button" onClick={() => setShowForm(false)}
                        className="px-4 py-2.5 rounded-xl border border-line text-sm text-muted hover:text-ink hover:bg-canvas transition-colors">
                        Huỷ
                      </button>
                    )}
                    <button type="submit" disabled={submitting || productIdx === '' || !content.trim()}
                      className="px-5 py-2.5 rounded-xl bg-gold text-white text-sm font-semibold hover:bg-gold-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-2">
                      {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                      Gửi feedback
                    </button>
                  </div>
                </form>
              ) : (
                <div className="bg-surface rounded-2xl border border-dashed border-hairline p-10 h-full flex flex-col items-center justify-center text-center">
                  <CheckCircle2 size={40} className="text-emerald-500 mb-3" />
                  <div className="text-sm font-medium text-ink">Đơn đã có feedback</div>
                  <div className="text-xs text-muted mt-1">
                    Xem lịch sử bên trái, hoặc bấm <b>Thêm</b> để ghi nhận feedback mới.
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}