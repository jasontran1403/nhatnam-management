// src/pages/accountant/ExpenseDetailModal.jsx
import { useState, useEffect } from 'react';
import { X, Receipt, Building2, User, Clock, CheckCircle, XCircle, Wallet, Landmark, ShieldCheck, Pencil, FileDown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/common/Toast';
import { expenseApi } from '../../api/services';
import { VENDOR_TYPE_LABELS } from './ExpenseCreateModal';
import ExpenseItemsEditor from '../../components/expense/ExpenseItemsEditor';
import { formatVND } from '../../utils/format.js';
import ExpenseEditModal from './ExpenseEditModal';

function formatDate(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function formatDateOnly(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

const STATUS_CFG = {
  PENDING: { label: 'Chờ duyệt', cls: 'bg-amber-100 dark:bg-amber-500/18 text-amber-700 dark:text-amber-300', icon: Clock },
  APPROVED: { label: 'Đã duyệt', cls: 'bg-green-100 dark:bg-green-500/18 text-green-700 dark:text-green-300', icon: CheckCircle },
  REJECTED: { label: 'Từ chối', cls: 'bg-red-100 dark:bg-red-500/18 text-red-600 dark:text-red-300', icon: XCircle },
};

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
function imgSrc(url) {
  if (!url) return '';
  return url.startsWith('http') ? url : `${BASE_URL}/api/auth${url}`;
}

const VN_BANKS = [
  'Vietcombank', 'Vietinbank', 'BIDV', 'Agribank', 'ACB', 'Techcombank',
  'MB Bank', 'VPBank', 'Sacombank', 'SHB', 'HDBank', 'TPBank', 'OCB',
  'SeABank', 'LienVietPostBank', 'VIB', 'MSB', 'Eximbank', 'ABBank',
  'BacABank', 'NamABank', 'PGBank', 'VietABank', 'KienLongBank',
  'DongABank', 'BaoVietBank', 'SCB', 'Saigonbank', 'NCB', 'PublicBank',
  'UOB', 'HSBC', 'StandardChartered', 'Shinhan', 'Woori', 'CIMB',
];

export default function ExpenseDetailModal({ voucher, onClose, onChanged }) {
  const { role } = useAuth();
  const toast = useToast();
  const [showEditModal, setShowEditModal] = useState(false);

  // Bản sao cục bộ của phiếu — sau khi sửa (lý do / khoản chi) ta tải lại phiếu
  // từ server để modal hiển thị dữ liệu mới ngay, không phải đóng/mở lại.
  const [v, setV] = useState(voucher);
  useEffect(() => { setV(voucher); }, [voucher]);

  const canEdit = v.status !== 'REJECTED' && (
    role === 'OWNER' || role === 'ADMIN' ||
    (role === 'SUPER_ACCOUNTANT' || role === 'ACCOUNTANT')
  );

  const handleEditSuccess = async () => {
    // Refresh dữ liệu phiếu chi trong modal detail
    await refresh();
    // Đóng modal detail
    onClose();
    // Gọi onChanged để refresh danh sách bên ngoài
    if (onChanged) onChanged();
  };

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
  const [downloading, setDownloading] = useState(false);
  const downloadPdf = async () => {
    setDownloading(true);
    try {
      const res = await expenseApi.exportPdf(v.id);
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a'); a.href = url;
      a.download = `phieu-chi-${v.paymentNumber || v.voucherCode}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    } catch { toast('Lỗi xuất PDF', 'error'); }
    finally { setDownloading(false); }
  };
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [refundPaymentType, setRefundPaymentType] = useState('CASH');
  const [refundBankName, setRefundBankName] = useState('');
  const [refundBankAccount, setRefundBankAccount] = useState('');
  const [refundBankHolder, setRefundBankHolder] = useState('');

  const s = STATUS_CFG[v.status] || STATUS_CFG.PENDING;
  const StatusIcon = s.icon;
  const isBank = v.paymentType === 'BANK_TRANSFER';

  // Ai được duyệt phiếu này?
  const isVendorDebt = v.voucherType === 'VENDOR_DEBT_PAYMENT';
  const canApprove = v.status === 'PENDING' && !isVendorDebt && (
    role === 'OWNER' || role === 'ADMIN' ||
    (role === 'SUPER_ACCOUNTANT' && v.approverScope === 'SUPER_ACCOUNTANT')
  );

  function formatExpenseDateDisplay(v) {
    if (!v) return null;

    // Ưu tiên hiển thị expenseDate nếu có
    if (v.expenseDate) {
      const d = new Date(v.expenseDate);
      return `Ngày ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    }

    // Nếu không có expenseDate nhưng có expensePeriod -> hiển thị kỳ
    if (v.expensePeriod) {
      const [year, month] = v.expensePeriod.split('-');
      return `Kỳ Tháng ${parseInt(month)}/${year}`;
    }

    return null;
  }


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

  /** Lập phiếu chi hoàn phần dư cho đơn cuối của phiếu thu. */
  const doRefundOverpay = async () => {
    if (!v.overpay?.orderCode) return;
    setBusy(true);
    try {
      const payload = {
        orderCode: v.overpay.orderCode,
        paymentType: refundPaymentType,
      };
      if (refundPaymentType === 'BANK_TRANSFER') {
        if (refundBankName.trim()) payload.customerBankName = refundBankName.trim();
        if (refundBankAccount.trim()) payload.customerBankAccount = refundBankAccount.trim();
        if (refundBankHolder.trim()) payload.customerBankHolder = refundBankHolder.trim();
      }
      const res = await expenseApi.refundOverpay(payload);
      const code = res?.data?.data?.voucherCode || res?.data?.voucherCode;
      toast(code ? `Đã tạo phiếu chi hoàn ${code}` : 'Đã tạo phiếu chi hoàn phần dư', 'success');
      onChanged && onChanged();
      onClose();
    } catch (e) {
      toast(e?.response?.data?.message || 'Lỗi khi tạo phiếu chi hoàn', 'error');
    } finally { setBusy(false); }
  };

  // Format ngày chi / kỳ chi để hiển thị
  const getExpenseDateDisplay = () => {
    if (!v) return null;

    // Ưu tiên hiển thị expense_period nếu có (phiếu tạo theo kỳ)
    if (v.expensePeriod) {
      const [year, month] = v.expensePeriod.split('-');
      return `Kỳ Tháng ${parseInt(month)}/${year}`;
    }

    // Nếu không có expense_period, hiển thị expense_date (phiếu tạo theo ngày)
    if (v.expenseDate) {
      return `Ngày ${formatDateOnly(v.expenseDate)}`;
    }

    return null;
  };

  const expenseDisplay = getExpenseDateDisplay();

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
            {/* Lý do chi — chỉ hiển thị, không cho sửa riêng lẻ nữa */}
            <div className="col-span-2 bg-canvas rounded-xl px-3 py-2">
              <p className="text-[10px] text-muted uppercase tracking-wider font-semibold mb-0.5">Lý do chi</p>
              <p className="text-sm text-ink">{v.reason || '—'}</p>
            </div>
            {v.vendorName && <InfoRow label="Người nhận / Nhà cung cấp / Đơn vị" value={v.vendorName} icon={<Building2 size={12} />} full />}
            {v.vendorType && <InfoRow label="Danh mục" value={VENDOR_TYPE_LABELS[v.vendorType] || v.vendorType} />}
            <InfoRow label="Người lập" value={v.createdByName} icon={<User size={12} />} />
            {v.requestedByName && <InfoRow label="Người tạo" value={v.requestedByName} icon={<User size={12} />} />}
            <InfoRow label="Ngày tạo" value={formatDate(v.createdAt)} />
            {/* Hiển thị Ngày chi / Kỳ chi */}
            {expenseDisplay && <InfoRow label="Ngày chi / Kỳ chi" value={expenseDisplay} icon={<Clock size={12} />} />}
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

          {/* Thông tin STK khách hàng (phiếu hoàn phần dư qua chuyển khoản) */}
          {v.customerBankName && (
            <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/18 rounded-xl p-3">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase mb-2">
                Thông tin chuyển khoản cho khách
              </p>
              <div className="grid grid-cols-1 gap-2">
                <InfoRow label="Ngân hàng" value={v.customerBankName} icon={<Landmark size={12} />} full />
                <InfoRow label="Số tài khoản" value={v.customerBankAccount} full />
                <InfoRow label="Chủ tài khoản" value={v.customerBankHolder} icon={<User size={12} />} full />
              </div>
            </div>
          )}

          {v.rejectReason && (
            <div className="bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/18 rounded-xl p-3">
              <p className="text-xs font-semibold text-red-600 dark:text-red-300 mb-1">Lý do từ chối</p>
              <p className="text-sm text-red-700 dark:text-red-300">{v.rejectReason}</p>
            </div>
          )}

          {/* Items — chỉ hiển thị, không cho sửa riêng lẻ nữa */}
          {v.items?.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted uppercase tracking-wider">Danh sách khoản chi</p>
              {v.items.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center bg-canvas rounded-xl px-4 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-ink">{item.itemName}</p>
                    {item.note && <p className="text-xs text-muted">{item.note}</p>}
                  </div>
                  <span className="text-sm font-bold text-gold">{formatVND(item.amount)}</span>
                </div>
              ))}
              <div className="flex justify-between items-center bg-gold/10 rounded-xl px-4 py-3">
                <span className="text-sm font-semibold text-ink">Tổng cộng</span>
                <span className="text-base font-bold text-gold">{formatVND(v.totalAmount)}</span>
              </div>
            </div>
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

          {/* Khối HOÀN PHẦN DƯ — chỉ với phiếu THU có khách trả dư */}
          {v.overpay && v.overpay.amount > 0 && (
            <div className="bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/28 rounded-xl p-4">
              <p className="text-xs font-semibold text-sky-700 dark:text-sky-300 uppercase mb-1">
                Khách thanh toán dư
              </p>
              <p className="text-sm text-ink">
                Đơn <span className="font-mono text-gold">{v.overpay.orderCode}</span> có phần dư{' '}
                <span className="font-bold">{formatVND(v.overpay.amount)}</span>
                {v.overpay.customerName ? <> của {v.overpay.customerName}</> : null}.
              </p>
              {v.overpay.refundVoucherCode ? (
                <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-300 flex items-center gap-1">
                  <CheckCircle size={14} /> Đã lập phiếu chi hoàn:{' '}
                  <span className="font-mono">{v.overpay.refundVoucherCode}</span>
                </p>
              ) : (
                <div className="mt-3 space-y-3">
                  {/* Phương thức thanh toán */}
                  <div>
                    <label className="block text-xs font-semibold text-ink mb-1">Phương thức thanh toán</label>
                    <div className="flex gap-2">
                      {[{ v: 'CASH', l: 'Tiền mặt' }, { v: 'BANK_TRANSFER', l: 'Chuyển khoản' }].map(o => (
                        <button key={o.v} type="button"
                          onClick={() => setRefundPaymentType(o.v)}
                          className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition ${refundPaymentType === o.v
                            ? 'border-sky-500 bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-200'
                            : 'border-line text-muted hover:bg-canvas'
                            }`}>{o.l}</button>
                      ))}
                    </div>
                  </div>

                  {/* Thông tin STK khách — chỉ hiện khi chuyển khoản */}
                  {refundPaymentType === 'BANK_TRANSFER' && (
                    <div className="space-y-2 bg-white dark:bg-surface rounded-lg p-3 border border-sky-100 dark:border-sky-500/18">
                      <p className="text-[10px] text-muted italic">Thông tin STK khách hàng (tuỳ chọn)</p>
                      <div>
                        <label className="block text-xs text-muted mb-1">Ngân hàng</label>
                        <select value={refundBankName} onChange={e => setRefundBankName(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-line text-sm focus:outline-none focus:border-sky-400 bg-surface">
                          <option value="">-- Chọn ngân hàng --</option>
                          {VN_BANKS.map(b => (<option key={b} value={b}>{b}</option>))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-muted mb-1">Số tài khoản</label>
                        <input value={refundBankAccount} onChange={e => setRefundBankAccount(e.target.value)}
                          placeholder="VD: 0123456789"
                          className="w-full px-3 py-2 rounded-lg border border-line text-sm focus:outline-none focus:border-sky-400 bg-surface" />
                      </div>
                      <div>
                        <label className="block text-xs text-muted mb-1">Tên chủ tài khoản</label>
                        <input value={refundBankHolder} onChange={e => setRefundBankHolder(e.target.value)}
                          placeholder="VD: NGUYEN VAN A"
                          className="w-full px-3 py-2 rounded-lg border border-line text-sm focus:outline-none focus:border-sky-400 bg-surface" />
                      </div>
                    </div>
                  )}

                  <button
                    onClick={doRefundOverpay}
                    disabled={busy}
                    className="w-full py-2.5 rounded-xl bg-sky-600 text-white text-sm font-bold hover:bg-sky-700 transition disabled:opacity-50"
                  >
                    {busy ? 'Đang xử lý...' : `Tạo phiếu chi hoàn phần dư (${formatVND(v.overpay.amount)})`}
                  </button>
                </div>
              )}
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
          <button onClick={downloadPdf} disabled={downloading}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-hairline-2 text-sm font-semibold text-ink-2 hover:border-gold hover:text-gold transition disabled:opacity-50"
            title="Xuất PDF">
            <FileDown size={14} /> {downloading ? '...' : 'PDF'}
          </button>

          {/* Nút sửa phiếu */}
          {canEdit && (
            <button onClick={() => setShowEditModal(true)}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-gold text-sm font-semibold text-gold hover:bg-gold/10 transition"
              title="Sửa phiếu chi">
              <Pencil size={14} /> Sửa phiếu
            </button>
          )}

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
          {!canApprove && !canEdit && (
            <button onClick={onClose} className="w-full py-3 rounded-xl border border-hairline-2 text-sm font-semibold text-muted hover:bg-canvas transition">
              Đóng
            </button>
          )}
          {!canApprove && canEdit && (
            <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-hairline-2 text-sm font-semibold text-muted hover:bg-canvas transition">
              Đóng
            </button>
          )}
        </div>
      </div>

      {showEditModal && (
        <ExpenseEditModal
          voucher={v}
          onClose={() => setShowEditModal(false)}
          onChanged={refresh}
          onSaved={handleEditSuccess}
        />
      )}
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