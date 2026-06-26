// src/components/seller/SuperSellerCancelOrderModal.jsx
// Modal xác nhận hủy đơn hàng cho SUPER_SELLER — hủy được mọi trạng thái.
// Có 2 input: (1) người yêu cầu hủy (search dropdown, copy từ EditOrderModal),
// (2) lý do hủy. Trước khi hủy, hiển thị cảnh báo nếu đơn đã thanh toán /
// đã có phiếu thu liên kết.
import { useState, useEffect, useRef } from 'react';
import { X, AlertTriangle, Search, User, Loader2, Receipt } from 'lucide-react';
import { orderApi } from '../../api/services';
import { useToast } from '../common/Toast';

export default function SuperSellerCancelOrderModal({ order, onClose, onCancelled }) {
  const toast = useToast();
  const [checking, setChecking] = useState(true);
  const [cancelInfo, setCancelInfo] = useState(null);

  const [requestedBy, setRequestedBy] = useState('');
  const [requestedById, setRequestedById] = useState(null);
  const [requestedByRoles, setRequestedByRoles] = useState([]);
  const [requestedByRole, setRequestedByRole] = useState('');
  const [staffSearch, setStaffSearch] = useState('');
  const [staffResults, setStaffResults] = useState([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const staffDebounceRef = useRef(null);

  const [cancelReason, setCancelReason] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!order) return;
    setChecking(true);
    orderApi.checkSuperCancelInfo(order.id)
      .then(res => setCancelInfo(res?.data?.data || null))
      .catch(() => setCancelInfo(null))
      .finally(() => setChecking(false));
  }, [order]);

  const searchStaff = (kw) => {
    setStaffSearch(kw);
    if (staffDebounceRef.current) clearTimeout(staffDebounceRef.current);
    if (!kw.trim()) { setStaffResults([]); return; }
    staffDebounceRef.current = setTimeout(async () => {
      setLoadingStaff(true);
      try {
        const res = await orderApi.searchStaff(kw);
        setStaffResults(res?.data?.data || []);
      } catch { setStaffResults([]); }
      finally { setLoadingStaff(false); }
    }, 500);
  };

  const selectStaff = (s) => {
    const roles = s.roles || (s.role ? [s.role] : []);
    const defaultRole = roles.length === 1 ? roles[0] : '';
    setRequestedBy(s.fullName);
    setRequestedById(s.id);
    setRequestedByRoles(roles);
    setRequestedByRole(defaultRole);
    setStaffSearch(s.fullName);
    setStaffResults([]);
  };

  const clearStaff = () => {
    setRequestedBy(''); setRequestedById(null);
    setRequestedByRoles([]); setRequestedByRole('');
    setStaffSearch(''); setStaffResults([]);
  };

  const canSubmit = requestedBy && cancelReason.trim()
    && (requestedByRoles.length <= 1 || requestedByRole) && !saving;

  const handleConfirm = async () => {
    if (!requestedBy) { setError('Vui lòng chọn người yêu cầu hủy đơn'); return; }
    if (!cancelReason.trim()) { setError('Vui lòng nhập lý do hủy đơn'); return; }
    if (requestedByRoles.length > 1 && !requestedByRole) { setError('Vui lòng chọn role của người yêu cầu'); return; }

    setSaving(true);
    try {
      await orderApi.superSellerCancelOrder(order.id, {
        requestedById,
        requestedBy,
        requestedByRole: requestedByRole || undefined,
        cancelReason: cancelReason.trim(),
      });
      toast('Đã hủy đơn hàng', 'success');
      onCancelled?.();
      onClose();
    } catch (err) {
      toast(err?.response?.data?.message || 'Lỗi khi hủy đơn hàng', 'error');
    } finally { setSaving(false); }
  };

  if (!order) return null;
  const orderCode = order.orderCode ?? `#${order.id}`;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center">
              <AlertTriangle size={16} className="text-red-500" />
            </div>
            <div>
              <p className="text-xs text-[#8E8878]">Xác nhận hủy đơn hàng</p>
              <p className="font-bold text-[#1C1C1E] font-mono text-sm">{orderCode}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 text-[#8E8878]">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Cảnh báo thanh toán / phiếu thu */}
          {checking ? (
            <div className="flex items-center gap-2 text-xs text-[#8E8878] bg-[#FAF7F2] rounded-xl px-3 py-2.5">
              <Loader2 size={13} className="animate-spin" /> Đang kiểm tra thông tin đơn hàng...
            </div>
          ) : cancelInfo?.isPaid && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
              <Receipt size={15} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-700">
                <p className="font-semibold">Đơn này đã được thanh toán.</p>
                {cancelInfo.hasIncomeVoucher ? (
                  <p className="mt-0.5">
                    Đã có phiếu thu liên kết: <strong>{cancelInfo.incomeVoucherCodes.join(', ')}</strong>.
                    Vui lòng kiểm tra và xử lý phiếu thu (hoàn tiền/điều chỉnh) sau khi hủy đơn.
                  </p>
                ) : (
                  <p className="mt-0.5">Chưa tìm thấy phiếu thu liên kết — vui lòng đối soát lại công nợ/thanh toán sau khi hủy.</p>
                )}
              </div>
            </div>
          )}

          <p className="text-sm text-[#5C5C5C]">
            Hành động này sẽ hủy đơn <strong>{orderCode}</strong> (trạng thái hiện tại:{' '}
            <strong>{order.status}</strong>) và hoàn lại toàn bộ tồn kho đã trừ.
            <strong className="text-red-500"> Không thể hoàn tác.</strong>
          </p>

          {/* Ô 1: Người yêu cầu hủy */}
          <div>
            <label className="block text-xs font-semibold text-[#5C5C5C] mb-1.5">
              Người yêu cầu hủy <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8878] pointer-events-none" />
              <input
                className="w-full h-10 pl-8 pr-3 rounded-xl border border-black/10 text-sm focus:outline-none focus:ring-2 focus:ring-red-400/30"
                placeholder="Tìm theo tên nhân viên..."
                value={staffSearch}
                onChange={e => { searchStaff(e.target.value); setError(''); }} />
              {loadingStaff && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8E8878] animate-spin" />}
            </div>
            {staffResults.length > 0 && !requestedBy && (
              <div className="mt-1 border border-black/10 rounded-xl overflow-hidden shadow-sm">
                {staffResults.map(s => (
                  <button key={s.id} onClick={() => selectStaff(s)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[#FAF7F2] text-left transition-colors">
                    <User size={14} className="text-[#8E8878] flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm text-[#1C1C1E] font-medium truncate">{s.fullName}</p>
                      <p className="text-xs text-[#8E8878]">{s.role}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {requestedBy && (
              <div className="mt-1.5 flex items-center gap-2 bg-red-50 text-red-600 rounded-xl px-3 py-2">
                <User size={13} />
                <span className="text-sm font-medium flex-1">{requestedBy}</span>
                <button onClick={clearStaff} className="text-[#8E8878] hover:text-red-500">
                  <X size={13} />
                </button>
              </div>
            )}
          </div>

          {/* Role selector — khi nhân viên có nhiều role */}
          {requestedBy && requestedByRoles.length > 1 && (
            <div>
              <label className="block text-xs font-semibold text-[#5C5C5C] mb-1.5">
                Role yêu cầu <span className="text-red-500">*</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {requestedByRoles.map(r => (
                  <button key={r} onClick={() => setRequestedByRole(r)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                      requestedByRole === r
                        ? 'bg-red-500 text-white border-red-500'
                        : 'bg-white text-[#5C5C5C] border-black/10 hover:border-red-300'
                    }`}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Ô 2: Lý do hủy */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#1C1C1E]">
              Lý do hủy đơn <span className="text-red-500">*</span>
            </label>
            <textarea
              value={cancelReason}
              onChange={e => { setCancelReason(e.target.value); setError(''); }}
              placeholder="Nhập lý do hủy đơn..."
              rows={3} autoFocus
              className="w-full px-3 py-2.5 border border-[#E8DDD0] rounded-xl text-sm text-[#1C1C1E]
                focus:outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400/20 resize-none"
            />
            {error && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <AlertTriangle size={11} /> {error}
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-[#E8DDD0] text-sm text-[#8E8878]
              hover:bg-[#F0EBE3] transition-colors font-medium">
            Hủy bỏ
          </button>
          <button onClick={handleConfirm} disabled={!canSubmit}
            className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold
              hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed
              flex items-center justify-center gap-2">
            {saving
              ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : 'Xác nhận hủy đơn'
            }
          </button>
        </div>
      </div>
    </div>
  );
}
