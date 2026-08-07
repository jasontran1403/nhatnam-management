// src/pages/accountant/ExpenseDetailModal.jsx
import { useState, useEffect } from 'react';
import { X, Receipt, Building2, User, Clock, CheckCircle, XCircle, Wallet, Landmark, ShieldCheck, Pencil } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/common/Toast';
import { expenseApi } from '../../api/services';
import { VENDOR_TYPE_LABELS } from './ExpenseCreateModal';
import ExpenseItemsEditor from '../../components/expense/ExpenseItemsEditor';
import { formatVND } from '../../utils/format.js';

function formatDate(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')} ${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

const STATUS_CFG = {
  PENDING:  { label: 'Chờ duyệt',  cls: 'bg-amber-100 dark:bg-amber-500/18 text-amber-700 dark:text-amber-300',  icon: Clock },
  APPROVED: { label: 'Đã duyệt',   cls: 'bg-green-100 dark:bg-green-500/18 text-green-700 dark:text-green-300',  icon: CheckCircle },
  REJECTED: { label: 'Từ chối',    cls: 'bg-red-100 dark:bg-red-500/18 text-red-600 dark:text-red-300',      icon: XCircle },
};

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
function imgSrc(url) {
  if (!url) return '';
  return url.startsWith('http') ? url : `${BASE_URL}/api/auth${url}`;
}

export default function ExpenseDetailModal({ voucher, onClose, onChanged }) {
  const { role } = useAuth();
  const toast = useToast();

  // Bản sao cục bộ của phiếu — sau khi sửa (lý do / khoản chi) ta tải lại phiếu
  // từ server để modal hiển thị dữ liệu mới ngay, không phải đóng/mở lại.
  const [v, setV] = useState(voucher);
  useEffect(() => { setV(voucher); }, [voucher]);

  /** Tải lại phiếu từ server rồi báo cho danh sách bên ngoài reload. */
  const refresh = async () => {
    try {
      const res = await expenseApi.getById(voucher.id);
      const fresh = res.data?.data || res.data;
      if (fresh) setV(fresh);
    } catch { /* giữ nguyên dữ liệu cũ nếu lỗi */ }
    onChanged && onChanged();
  };

  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [editingReason, setEditingReason] = useState(false);
  const [editedReason, setEditedReason] = useState(v.reason || '');
  const [savingReason, setSavingReason] = useState(false);

  // Cho phép sửa lý do: PENDING hoặc APPROVED (REJECTED thì không)
  const canEditReason = v.status !== 'REJECTED';

  const s = STATUS_CFG[v.status] || STATUS_CFG.PENDING;
  const StatusIcon = s.icon;
  const isBank = v.paymentType === 'BANK_TRANSFER';

  // Ai được duyệt phiếu này?
  const isVendorDebt = v.voucherType === 'VENDOR_DEBT_PAYMENT';
  const canApprove = v.status === 'PENDING' && !isVendorDebt && (
    role === 'OWNER' || role === 'ADMIN' ||
    (role === 'SUPER_ACCOUNTANT' && v.approverScope === 'SUPER_ACCOUNTANT')
  );

  const doSaveReason = async () => {
    if (!editedReason.trim()) { toast('Lý do chi không được để trống', 'error'); return; }
    setSavingReason(true);
    try {
      await expenseApi.updateReason(v.id, editedReason.trim());
      toast('Đã cập nhật lý do phiếu chi', 'success');
      setEditingReason(false);
      await refresh();
    } catch (e) {
      toast(e?.response?.data?.message || 'Có lỗi xảy ra', 'error');
    } finally { setSavingReason(false); }
  };

  const doApprove = async () => {
    setBusy(true);
    try {
      await expenseApi.approve(v.id, null);
      toast('Đã duyệt phiếu chi', 'success');
      onChanged && onChanged();
      onClose();
    } catch (e) {
      toast(e?.response?.data?.message || 'Lỗi khi duyệt', 'error');
    } finally { setBusy(false); }
  };
  const doReject = async () => {
    if (!rejectReason.trim()) { toast('Vui lòng nhập lý do từ chối', 'error'); return; }
    setBusy(true);
    try {
      await expenseApi.reject(v.id, rejectReason.trim());
      toast('Đã từ chối phiếu chi', 'success');
      onChanged && onChanged();
      onClose();
    } catch (e) {
      toast(e?.response?.data?.message || 'Lỗi khi từ chối', 'error');
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-hairline">
          <div className="flex items-center gap-3">
            <Receipt size={20} className="text-gold" />
            <div>
              <p className="font-mono text-sm font-bold text-gold">Số phiếu chi {v.paymentNumber || v.voucherCode}</p>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${s.cls}`}>
                  <StatusIcon size={10} /> {s.label}
                </span>
                <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${isBank ? 'bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300' : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'}`}>
                  {isBank ? <Landmark size={10} /> : <Wallet size={10} />} {isBank ? 'Chuyển khoản' : 'Tiền mặt'}
                </span>
                {isVendorDebt && (
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300">
                    <Wallet size={10} /> Trả công nợ NCC
                  </span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-canvas text-muted transition">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">

          <div className="grid grid-cols-2 gap-3">
            {/* Lý do chi — có thể sửa nếu chưa bị từ chối */}
            <div className="col-span-2 bg-canvas rounded-xl px-3 py-2">
              <p className="text-[10px] text-muted uppercase tracking-wider font-semibold mb-0.5">Lý do chi</p>
              {editingReason ? (
                <div className="flex items-start gap-2 mt-1">
                  <textarea
                    className="flex-1 px-2.5 py-1.5 text-sm rounded-lg border border-line focus:outline-none focus:border-gold bg-surface"
                    rows={2}
                    value={editedReason}
                    onChange={e => setEditedReason(e.target.value)}
                    autoFocus
                  />
                  <div className="flex flex-col gap-1">
                    <button onClick={doSaveReason} disabled={savingReason}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-forest-deep text-white hover:bg-forest-mid disabled:opacity-50">
                      {savingReason ? '...' : 'Lưu'}
                    </button>
                    <button onClick={() => { setEditingReason(false); setEditedReason(v.reason || ''); }}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-line text-muted hover:bg-surface-2">
                      Huỷ
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="text-sm text-ink flex-1">{v.reason || '—'}</p>
                  {canEditReason && (
                    <button onClick={() => { setEditedReason(v.reason || ''); setEditingReason(true); }}
                      className="p-1 rounded-lg hover:bg-surface-3 text-muted hover:text-gold transition-colors"
                      title="Sửa lý do">
                      <Pencil size={13} />
                    </button>
                  )}
                </div>
              )}
            </div>
            {v.vendorName && <InfoRow label="Nhà cung cấp" value={v.vendorName} icon={<Building2 size={12} />} full />}
            {v.vendorType && <InfoRow label="Danh mục" value={VENDOR_TYPE_LABELS[v.vendorType] || v.vendorType} />}
            <InfoRow label="Người lập" value={v.createdByName} icon={<User size={12} />} />
            {v.requestedByName && <InfoRow label="Người yêu cầu" value={v.requestedByName} icon={<User size={12} />} />}
            <InfoRow label="Ngày tạo" value={formatDate(v.createdAt)} />
            {v.approvedByName && <InfoRow label="Người duyệt" value={v.approvedByName} icon={<ShieldCheck size={12} />} />}
            {v.approvedAt && <InfoRow label="Ngày duyệt" value={formatDate(v.approvedAt)} />}
          </div>

          {/* Thông tin ngân hàng */}
          {isBank && (
            <div className="bg-sky-50 dark:bg-sky-500/10 border border-sky-100 dark:border-sky-500/18 rounded-xl p-3 grid grid-cols-2 gap-3">
              <InfoRow label="Ngân hàng" value={v.bankName} icon={<Landmark size={12} />} />
              <InfoRow label="Mã tham chiếu" value={v.bankRef} />
            </div>
          )}

          {v.rejectReason && (
            <div className="bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/18 rounded-xl p-3">
              <p className="text-xs font-semibold text-red-600 dark:text-red-300 mb-1">Lý do từ chối</p>
              <p className="text-sm text-red-700 dark:text-red-300">{v.rejectReason}</p>
            </div>
          )}

          {/* Items — có thể sửa trực tiếp (xem quy tắc quyền trong ExpenseItemsEditor) */}
          {v.items?.length > 0 ? (
            <ExpenseItemsEditor voucher={v} onChanged={refresh} />
          ) : (
            <div className="flex justify-between items-center bg-canvas rounded-xl px-4 py-3">
              <span className="text-sm font-semibold text-muted">Tổng cộng</span>
              <span className="text-base font-bold text-gold">{formatVND(v.totalAmount)}</span>
            </div>
          )}

          {/* Images */}
          {v.imageUrls?.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-ink mb-2">Ảnh chứng từ</p>
              <div className="flex flex-wrap gap-2">
                {v.imageUrls.map((url, i) => (
                  <a key={i} href={imgSrc(url)} target="_blank" rel="noreferrer">
                    <img src={imgSrc(url)} alt="" className="w-20 h-20 object-cover rounded-xl border border-hairline-2 hover:opacity-80 transition" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Khối từ chối */}
          {rejecting && (
            <div className="bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/18 rounded-xl p-3">
              <label className="block text-xs font-semibold text-red-600 dark:text-red-300 mb-1">Lý do từ chối *</label>
              <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={2}
                placeholder="Nhập lý do..."
                className="w-full px-3 py-2 rounded-lg border border-red-200 dark:border-red-500/28 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 dark:ring-red-500/28 bg-surface" />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-hairline flex gap-3">
          {canApprove && !rejecting && (
            <>
              <button onClick={() => setRejecting(true)} disabled={busy}
                className="flex-1 py-3 rounded-xl border border-red-200 dark:border-red-500/28 text-sm font-semibold text-red-600 dark:text-red-300 hover:bg-red-50 dark:bg-red-500/10 transition disabled:opacity-50">
                Từ chối
              </button>
              <button onClick={doApprove} disabled={busy}
                className="flex-1 py-3 rounded-xl bg-green-600 text-white text-sm font-bold hover:bg-green-700 transition disabled:opacity-50">
                {busy ? 'Đang xử lý...' : 'Duyệt phiếu'}
              </button>
            </>
          )}
          {canApprove && rejecting && (
            <>
              <button onClick={() => { setRejecting(false); setRejectReason(''); }} disabled={busy}
                className="flex-1 py-3 rounded-xl border border-hairline-2 text-sm font-semibold text-muted hover:bg-canvas transition disabled:opacity-50">
                Huỷ
              </button>
              <button onClick={doReject} disabled={busy}
                className="flex-1 py-3 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition disabled:opacity-50">
                {busy ? 'Đang xử lý...' : 'Xác nhận từ chối'}
              </button>
            </>
          )}
          {!canApprove && (
            <button onClick={onClose} className="w-full py-3 rounded-xl border border-hairline-2 text-sm font-semibold text-muted hover:bg-canvas transition">
              Đóng
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, icon, full }) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <p className="text-xs text-muted mb-0.5">{label}</p>
      <p className="text-sm font-medium text-ink flex items-center gap-1">
        {icon && <span className="text-gold">{icon}</span>}
        {value || '—'}
      </p>
    </div>
  );
}