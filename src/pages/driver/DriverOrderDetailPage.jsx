// src/pages/driver/DriverOrderDetailPage.jsx
// Chi tiết đơn hàng cho TÀI XẾ — thông tin cần giao + nút "Hoàn thành".
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, MapPin, Phone, Package, Clock, User, FileText,
  CheckCircle2, AlertCircle, Navigation, Warehouse,
} from 'lucide-react';
import { driverApi } from '../../api/driverApi';
import {
  SectionCard, LoadingSpinner, PrimaryButton, SecondaryButton,
  Field, inputCls, formatCurrency,
} from '../../components/ui';
import Modal from '../../components/ui/Modal';
import { useToast } from '../../components/common/Toast';

// ── Hàng thông tin ────────────────────────────────────────────────────────────
function InfoRow({ icon: Icon, label, value, href }) {
  if (!value) return null;
  const content = (
    <div className="flex items-start gap-3 py-3">
      <div className="w-8 h-8 rounded-xl bg-[#FAF7F2] flex items-center justify-center shrink-0">
        <Icon size={15} className="text-[#8E8878]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-wide text-[#8E8878] font-semibold">{label}</p>
        <p className={`text-[15px] leading-snug mt-0.5 ${href ? 'text-[#C9A84C] font-semibold' : 'text-[#1C1C1E]'}`}>
          {value}
        </p>
      </div>
    </div>
  );
  return href ? <a href={href} className="block active:opacity-70">{content}</a> : content;
}

// ── Modal xác nhận hoàn thành ─────────────────────────────────────────────────
function CompleteModal({ open, order, onClose, onDone }) {
  const [receiverName, setReceiverName] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const toast = useToast();

  useEffect(() => {
    if (open) { setReceiverName(order?.receiverName || ''); setNote(''); setErr(null); }
  }, [open, order]);

  const submit = async () => {
    setSaving(true); setErr(null);
    try {
      await driverApi.complete(order.id, { receiverName: receiverName.trim(), note: note.trim() });
      toast('Đã xác nhận giao hàng thành công', 'success');
      onDone();
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || 'Lỗi khi xác nhận giao hàng');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} title="Xác nhận đã giao hàng"
      subtitle={`Đơn ${order?.orderCode}`} size="sm">
      <div className="space-y-4 py-1">
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
          <AlertCircle size={15} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800">
            Sau khi xác nhận, đơn chuyển sang <strong>Chờ thanh toán</strong> và
            không thể hoàn tác từ ứng dụng tài xế.
          </p>
        </div>

        <Field label="Người nhận hàng" hint="Tên người ký nhận tại điểm giao">
          <input className={inputCls} value={receiverName}
            onChange={e => setReceiverName(e.target.value)}
            placeholder="VD: Anh Tuấn — quản lý cửa hàng" />
        </Field>

        <Field label="Ghi chú" hint="Không bắt buộc">
          <textarea className={inputCls} rows={3} value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="VD: Giao thiếu 1 thùng, khách hẹn giao bù ngày mai" />
        </Field>

        {err && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
            <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
            <p className="text-xs text-red-600 font-medium">{err}</p>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <SecondaryButton className="flex-1" onClick={onClose} disabled={saving}>Huỷ</SecondaryButton>
          <PrimaryButton className="flex-1" onClick={submit} loading={saving}>
            <CheckCircle2 size={15} /> Xác nhận
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

// ── Trang chính ───────────────────────────────────────────────────────────────
export default function DriverOrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [completeOpen, setCompleteOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      setOrder(await driverApi.orderDetail(id));
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || 'Không tải được đơn hàng');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const isDone = order && ['PENDING_PAYMENT', 'COMPLETED'].includes(order.status);
  const mapsUrl = order?.deliveryAddress
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.deliveryAddress)}`
    : null;

  return (
    <div className="p-4 sm:p-6 space-y-4 pb-28">
      {/* Nút quay lại */}
      <button onClick={() => navigate('/driver/orders')}
        className="flex items-center gap-1.5 text-sm font-semibold text-[#8E8878] hover:text-[#1C1C1E] transition-colors">
        <ArrowLeft size={16} /> Danh sách đơn
      </button>

      {loading ? (
        <SectionCard><LoadingSpinner label="Đang tải đơn hàng..." /></SectionCard>
      ) : error ? (
        <SectionCard>
          <div className="flex flex-col items-center gap-3 py-10 px-6 text-center">
            <AlertCircle size={28} className="text-red-500" />
            <p className="text-sm font-medium text-red-600">{error}</p>
            <SecondaryButton onClick={load}>Thử lại</SecondaryButton>
          </div>
        </SectionCard>
      ) : order && (
        <>
          {/* Header đơn */}
          <div className="bg-gradient-to-br from-[#1C1C1E] to-[#2E2A24] rounded-2xl p-5 text-white shadow-lg">
            <p className="text-[11px] uppercase tracking-wider text-white/50 font-semibold">Mã đơn hàng</p>
            <p className="text-2xl font-bold mt-1">{order.orderCode}</p>
            <p className="text-sm text-white/70 mt-2">{order.customerName || 'Khách lẻ'}</p>
            {order.showPrices && order.finalAmount != null && (
              <p className="text-xl font-bold text-[#C9A84C] mt-3">{formatCurrency(order.finalAmount)}</p>
            )}
          </div>

          {isDone && (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <p className="text-sm text-emerald-800 font-semibold">Đơn này đã được xác nhận giao xong</p>
            </div>
          )}

          {/* Thông tin giao hàng */}
          <SectionCard>
            <div className="px-4 py-3 border-b border-black/5">
              <h3 className="text-sm font-bold text-[#1C1C1E]">Thông tin giao hàng</h3>
            </div>
            <div className="px-4 divide-y divide-black/5">
              <InfoRow icon={MapPin} label="Địa chỉ giao" value={order.deliveryAddress} href={mapsUrl} />
              <InfoRow icon={Phone} label="Số điện thoại" value={order.customerPhone}
                href={order.customerPhone ? `tel:${order.customerPhone}` : null} />
              <InfoRow icon={User} label="Người liên hệ" value={order.contactName || order.receiverName} />
              <InfoRow icon={Warehouse} label="Kho xuất" value={order.warehouseName} />
              <InfoRow icon={Clock} label="Thời gian hẹn giao"
                value={order.deliveryDatetime
                  ? new Date(order.deliveryDatetime).toLocaleString('vi-VN',
                      { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                  : null} />
              <InfoRow icon={FileText} label="Ghi chú" value={order.notes} />
            </div>

            {mapsUrl && (
              <div className="px-4 py-3 border-t border-black/5">
                <a href={mapsUrl} target="_blank" rel="noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl
                    bg-[#FAF7F2] border border-black/10 text-sm font-semibold text-[#1C1C1E]
                    hover:bg-[#F2EDE4] transition-colors">
                  <Navigation size={15} className="text-[#C9A84C]" /> Mở chỉ đường
                </a>
              </div>
            )}
          </SectionCard>

          {/* Danh sách hàng cần giao */}
          <SectionCard>
            <div className="flex items-center justify-between px-4 py-3 border-b border-black/5">
              <h3 className="text-sm font-bold text-[#1C1C1E]">Hàng cần giao</h3>
              <span className="text-xs font-semibold text-[#8E8878]">
                {order.items?.length || 0} mặt hàng
              </span>
            </div>
            {!order.items?.length ? (
              <p className="px-4 py-8 text-center text-sm text-[#8E8878]">Không có mặt hàng</p>
            ) : (
              <ul className="divide-y divide-black/5">
                {order.items.map((it, idx) => (
                  <li key={it.id ?? idx} className="flex items-start gap-3 px-4 py-3">
                    <div className="w-7 h-7 rounded-lg bg-[#C9A84C]/10 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[11px] font-bold text-[#C9A84C]">{idx + 1}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[#1C1C1E] leading-snug">{it.productName}</p>
                      {it.packaging && (
                        <p className="text-xs text-[#8E8878] mt-0.5">{it.packaging}</p>
                      )}
                    </div>
                    <span className="text-sm font-bold text-[#1C1C1E] shrink-0 whitespace-nowrap">
                      {it.quantity} {it.unit || ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          {/* Nút hoàn thành — cố định đáy màn hình cho dễ bấm khi đang giao */}
          {!isDone && (
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur
              border-t border-black/5 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] z-30">
              <button onClick={() => setCompleteOpen(true)}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl
                  bg-emerald-600 text-white text-base font-bold shadow-lg
                  hover:bg-emerald-700 active:scale-[0.98] transition-all">
                <CheckCircle2 size={19} /> Hoàn thành — Đã giao xong
              </button>
            </div>
          )}

          <CompleteModal open={completeOpen} order={order}
            onClose={() => setCompleteOpen(false)}
            onDone={() => { setCompleteOpen(false); navigate('/driver/orders'); }} />
        </>
      )}
    </div>
  );
}
