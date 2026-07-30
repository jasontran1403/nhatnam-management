// src/components/expense/ExpenseBulkActionModal.jsx
//
// Modal xem lại DANH SÁCH PHIẾU ĐANG ĐƯỢC CHỌN rồi duyệt / từ chối một lượt.
//
// Lựa chọn được giữ ở component cha dưới dạng Map(id → voucher) nên NGƯỜI DÙNG CÓ THỂ
// TICK PHIẾU Ở NHIỀU TRANG KHÁC NHAU: chuyển trang không làm mất tick, vì dữ liệu phiếu
// đã được chụp lại lúc tick chứ không đọc từ danh sách của trang hiện tại.
//
// Chỉ phiếu NGƯỜI DÙNG DUYỆT ĐƯỢC mới chọn được — xem hàm canApproveVoucher() bên dưới:
// OWNER/ADMIN duyệt mọi phiếu chờ duyệt; SUPER_ACCOUNTANT chỉ duyệt phiếu có
// approverScope = SUPER_ACCOUNTANT. Backend vẫn kiểm lại trên từng phiếu.

/**
 * Phiếu này có được người dùng (theo vai trò đang active) duyệt/từ chối không?
 * Dùng chung cho trang OWNER/ADMIN và trang SUPER_ACCOUNTANT để logic tick chọn
 * khớp nhau, tránh tick nhầm phiếu ngoài tầm rồi nhận lỗi hàng loạt.
 */
export function canApproveVoucher(v, role) {
  if (!v || v.status !== 'PENDING') return false;
  if (v.voucherType === 'VENDOR_DEBT_PAYMENT') return false;
  if (role === 'OWNER' || role === 'ADMIN' || role === 'SUPERADMIN') return true;
  if (role === 'SUPER_ACCOUNTANT') return v.approverScope === 'SUPER_ACCOUNTANT';
  return false;
}

import { useState } from 'react';
import { X, CheckCircle, XCircle, Trash2, AlertTriangle, Receipt } from 'lucide-react';
import { expenseApi } from '../../api/services';
import { useToast } from '../common/Toast';

const fmtVND = (n) => new Intl.NumberFormat('vi-VN').format(Number(n) || 0) + ' đ';

export default function ExpenseBulkActionModal({
  vouchers,       // mảng phiếu đang được chọn
  onRemove,       // (id) => void — bỏ chọn một phiếu ngay trong modal
  onClose,
  onDone,         // (result) => void — cha bỏ chọn các phiếu THÀNH CÔNG rồi reload
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [result, setResult] = useState(null);   // kết quả trả về từ backend
  // Ảnh chụp danh sách lúc bấm nút: sau khi cha bỏ chọn các phiếu thành công,
  // modal vẫn hiển thị đủ để người dùng đọc phiếu nào lỗi và vì sao.
  const [snapshot, setSnapshot] = useState(null);

  const shown = snapshot ?? vouchers;
  const ids = vouchers.map(v => v.id);
  const total = shown.reduce((s, v) => s + Number(v.totalAmount || 0), 0);

  const run = async (fn, successLabel) => {
    if (ids.length === 0) { toast('Chưa chọn phiếu nào', 'error'); return; }
    setBusy(true);
    setSnapshot(vouchers);
    try {
      const raw = await fn();
      const res = raw?.data?.data || raw?.data || raw;
      setResult(res);
      onDone && onDone(res);
      if (res.failed === 0) {
        toast(`${successLabel} ${res.succeeded} phiếu`, 'success');
        onClose();
      } else {
        // Còn phiếu lỗi → giữ modal để người dùng đọc lý do
        toast(`${successLabel} ${res.succeeded}/${res.total} phiếu, ${res.failed} phiếu lỗi`, 'error');
        setRejecting(false);
      }
    } catch (e) {
      toast(e?.response?.data?.message || 'Có lỗi xảy ra', 'error');
    } finally { setBusy(false); }
  };

  const doApprove = () => run(() => expenseApi.bulkApprove(ids, null), 'Đã duyệt');
  const doReject = () => {
    if (!reason.trim()) { toast('Vui lòng nhập lý do từ chối', 'error'); return; }
    return run(() => expenseApi.bulkReject(ids, reason.trim()), 'Đã từ chối');
  };

  const failedById = {};
  const okIds = new Set();
  (result?.results || []).forEach(r => {
    if (r.success) okIds.add(r.id); else failedById[r.id] = r.message;
  });

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        <div className="flex items-center justify-between p-5 border-b border-black/5">
          <div className="flex items-center gap-3">
            <Receipt size={20} className="text-[#C9A84C]" />
            <div>
              <p className="font-bold text-[#1C1C1E]">Phiếu chi đang chọn</p>
              <p className="text-xs text-[#8E8878] mt-0.5">
                {shown.length} phiếu · Tổng {fmtVND(total)}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-[#FAF7F2] text-[#8E8878] transition">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-2">
          {shown.length === 0 && (
            <p className="text-sm text-[#8E8878] text-center py-6">
              Chưa chọn phiếu nào. Đóng modal và tick vào phiếu ở danh sách.
            </p>
          )}

          {shown.map(v => {
            const err = failedById[v.id];
            const done = okIds.has(v.id);
            return (
              <div key={v.id}
                className={`flex items-start gap-3 rounded-xl px-4 py-3 border ${
                  err ? 'bg-red-50 border-red-200'
                      : done ? 'bg-green-50 border-green-200'
                      : 'bg-[#FAF7F2] border-transparent'
                }`}>
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-xs font-bold text-[#C9A84C]">
                    Số phiếu {v.paymentNumber || v.voucherCode}
                  </p>
                  <p className="text-sm text-[#1C1C1E] truncate">{v.reason}</p>
                  <p className="text-xs text-[#8E8878] truncate">
                    {v.vendorName ? `${v.vendorName} · ` : ''}{v.createdByName}
                  </p>
                  {err && (
                    <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                      <AlertTriangle size={11} /> {err}
                    </p>
                  )}
                  {done && (
                    <p className="text-xs text-green-700 mt-1 flex items-center gap-1">
                      <CheckCircle size={11} /> Xử lý thành công
                    </p>
                  )}
                </div>
                <p className="text-sm font-bold text-[#1C1C1E] whitespace-nowrap">
                  {fmtVND(v.totalAmount)}
                </p>
                <button
                  onClick={() => onRemove(v.id)}
                  disabled={busy}
                  title="Bỏ chọn phiếu này"
                  className="p-1.5 rounded-lg hover:bg-red-100 text-red-400 hover:text-red-600 transition disabled:opacity-50"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}

          {rejecting && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-3 mt-2">
              <label className="block text-xs font-semibold text-red-600 mb-1">
                Lý do từ chối * (áp dụng cho tất cả {ids.length} phiếu)
              </label>
              <textarea
                value={reason} onChange={e => setReason(e.target.value)} rows={2}
                placeholder="Nhập lý do..."
                className="w-full px-3 py-2 rounded-lg border border-red-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 bg-white"
              />
            </div>
          )}
        </div>

        <div className="p-5 border-t border-black/5 flex gap-3">
          {!rejecting ? (
            <>
              <button onClick={() => setRejecting(true)} disabled={busy || ids.length === 0}
                className="flex-1 py-3 rounded-xl border border-red-200 text-sm font-semibold text-red-600 hover:bg-red-50 transition disabled:opacity-50 flex items-center justify-center gap-2">
                <XCircle size={15} /> Từ chối tất cả
              </button>
              <button onClick={doApprove} disabled={busy || ids.length === 0}
                className="flex-1 py-3 rounded-xl bg-green-600 text-white text-sm font-bold hover:bg-green-700 transition disabled:opacity-50 flex items-center justify-center gap-2">
                <CheckCircle size={15} /> {busy ? 'Đang xử lý...' : `Duyệt ${ids.length} phiếu`}
              </button>
            </>
          ) : (
            <>
              <button onClick={() => { setRejecting(false); setReason(''); }} disabled={busy}
                className="flex-1 py-3 rounded-xl border border-black/10 text-sm font-semibold text-[#8E8878] hover:bg-[#FAF7F2] transition disabled:opacity-50">
                Huỷ
              </button>
              <button onClick={doReject} disabled={busy}
                className="flex-1 py-3 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition disabled:opacity-50">
                {busy ? 'Đang xử lý...' : `Xác nhận từ chối ${ids.length} phiếu`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}