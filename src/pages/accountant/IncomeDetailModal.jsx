// src/pages/accountant/IncomeDetailModal.jsx
// Modal xem chi tiết phiếu THU — hiển thị đúng nhãn phiếu thu, có nút Sửa,
// hiển thị phần dư (overpay) + tạo phiếu chi hoàn.
import { useState, useEffect } from 'react';
import {
  X, TrendingUp, User, Clock, CheckCircle, XCircle,
  Wallet, Landmark, Pencil, ShieldCheck, AlertCircle, FileDown,
  Building2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/common/Toast';
import { incomeApi, expenseApi } from '../../api/services';
import { formatVND } from '../../utils/format.js';

function formatDate(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')} ${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

const STATUS_CFG = {
  CONFIRMED: { label: 'Đã xác nhận', cls: 'bg-emerald-100 dark:bg-emerald-500/18 text-emerald-700 dark:text-emerald-300', icon: CheckCircle },
  PENDING:   { label: 'Chờ duyệt',  cls: 'bg-amber-100 dark:bg-amber-500/18 text-amber-700 dark:text-amber-300',       icon: Clock },
  APPROVED:  { label: 'Đã duyệt',   cls: 'bg-green-100 dark:bg-green-500/18 text-green-700 dark:text-green-300',       icon: CheckCircle },
  REJECTED:  { label: 'Từ chối',    cls: 'bg-red-100 dark:bg-red-500/18 text-red-600 dark:text-red-300',              icon: XCircle },
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

export default function IncomeDetailModal({ voucher, onClose, onEdit, onChanged }) {
  const { role } = useAuth();
  const toast = useToast();

  const [v, setV] = useState(voucher);
  useEffect(() => { setV(voucher); }, [voucher]);

  // Fetch đầy đủ phiếu khi mở
  useEffect(() => {
    (async () => {
      try {
        const res = await incomeApi.getById(voucher.id);
        const fresh = res.data?.data || res.data;
        if (fresh) setV(fresh);
      } catch { /* giữ dữ liệu từ prop */ }
    })();
  }, [voucher.id]);

  const refresh = async () => {
    try {
      const res = await incomeApi.getById(voucher.id);
      const fresh = res.data?.data || res.data;
      if (fresh) setV(fresh);
    } catch { /* giữ nguyên */ }
    onChanged && onChanged();
  };

  const [downloading, setDownloading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refundPaymentType, setRefundPaymentType] = useState('CASH');
  const [refundBankName, setRefundBankName] = useState('');
  const [refundBankAccount, setRefundBankAccount] = useState('');
  const [refundBankHolder, setRefundBankHolder] = useState('');

  const downloadPdf = async () => {
    setDownloading(true);
    try {
      const res = await incomeApi.exportPdf(v.id);
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a'); a.href = url;
      a.download = `phieu-thu-${v.receiptNumber || v.voucherCode}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    } catch { toast('Lỗi xuất PDF', 'error'); }
    finally { setDownloading(false); }
  };

  const s = STATUS_CFG[v.status] || STATUS_CFG.CONFIRMED;
  const StatusIcon = s.icon;
  const isBank = v.paymentType === 'BANK_TRANSFER';

  const canEdit = (role === 'ACCOUNTANT' || role === 'SUPER_ACCOUNTANT' || role === 'ADMIN' || role === 'OWNER');

  // Overpay info
  const hasOverpay = v.overpay && v.overpay.amount > 0;
  const overpayRefunded = hasOverpay && !!v.overpay.refundVoucherCode;

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
      await refresh();
    } catch (e) {
      toast(e?.response?.data?.message || 'Lỗi khi tạo phiếu chi hoàn', 'error');
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-hairline">
          <div className="flex items-center gap-3">
            <TrendingUp size={20} className="text-emerald-600 dark:text-emerald-300" />
            <div>
              <p className="font-mono text-sm font-bold text-gold">Số phiếu thu {v.receiptNumber || v.voucherCode}</p>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${s.cls}`}>
                  <StatusIcon size={10} /> {s.label}
                </span>
                <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${isBank ? 'bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300' : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'}`}>
                  {isBank ? <Landmark size={10} /> : <Wallet size={10} />} {isBank ? 'Chuyển khoản' : 'Tiền mặt'}
                </span>
                {/* Badge thu dư */}
                {hasOverpay && !overpayRefunded && (
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-500/28">
                    <AlertCircle size={10} /> Thu dư {formatVND(v.overpay.amount)}
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
            {/* Lý do thu */}
            <div className="col-span-2 bg-canvas rounded-xl px-3 py-2">
              <p className="text-[10px] text-muted uppercase tracking-wider font-semibold mb-0.5">Lý do thu</p>
              <p className="text-sm text-ink">{v.reason || '—'}</p>
            </div>

            {/* Tên khách hàng */}
            {v.customerName && (
              <InfoRow label="Khách hàng" value={v.customerName} icon={<Building2 size={12} />} full />
            )}

            {/* Người nộp tiền */}
            {v.payerName && (
              <InfoRow label="Người nộp tiền" value={v.payerName} icon={<User size={12} />} full />
            )}

            <InfoRow label="Người lập" value={v.createdByName} icon={<User size={12} />} />
            <InfoRow label="Ngày tạo" value={formatDate(v.createdAt)} />

            {v.linkedOrderCodes?.length > 0 && (
              <div className="col-span-2">
                <p className="text-xs text-muted mb-1">Đơn hàng liên kết</p>
                <div className="flex flex-wrap gap-1">
                  {v.linkedOrderCodes.map(code => (
                    <span key={code} className="font-mono text-xs bg-canvas border border-gold/30 text-gold px-2 py-0.5 rounded-lg font-bold">
                      {code}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Thông tin ngân hàng */}
          {isBank && (
            <div className="bg-sky-50 dark:bg-sky-500/10 border border-sky-100 dark:border-sky-500/18 rounded-xl p-3 grid grid-cols-2 gap-3">
              <InfoRow label="Ngân hàng" value={v.bankName} icon={<Landmark size={12} />} />
              <InfoRow label="Mã tham chiếu" value={v.bankRef} />
            </div>
          )}

          {/* Khoản thu */}
          {v.items?.length > 0 && (
            <div>
              <p className="text-[10px] text-muted uppercase tracking-wider font-semibold mb-2">Các khoản thu</p>
              <div className="space-y-1.5">
                {v.items.map((item, i) => (
                  <div key={i} className="flex justify-between items-start py-2 border-b border-line-soft last:border-0">
                    <div className="flex-1 min-w-0 mr-3">
                      <p className="text-sm text-ink font-medium">{item.itemName}</p>
                      {item.note && <p className="text-xs text-muted mt-0.5">{item.note}</p>}
                    </div>
                    <p className="text-sm font-bold text-gold flex-shrink-0">{formatVND(item.amount)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tổng cộng */}
          <div className="flex justify-between items-center bg-canvas rounded-xl px-4 py-3">
            <span className="text-sm font-semibold text-muted">Tổng cộng</span>
            <span className="text-base font-bold text-gold">{formatVND(v.totalAmount)}</span>
          </div>

          {/* Lần sửa gần nhất */}
          {v.lastEditedAt && (
            <p className="text-[11px] text-amber-600 dark:text-amber-300 italic">
              Lần sửa gần nhất bởi {v.lastEditedByName} vào lúc {formatDate(v.lastEditedAt)}
            </p>
          )}

          {/* Ảnh chứng từ */}
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

          {/* ── Khối THU DƯ — tạo phiếu chi hoàn ──
          {hasOverpay && (
            <div className={`border rounded-xl p-4 ${overpayRefunded
              ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/28'
              : 'bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/28'
            }`}>
              <p className={`text-xs font-semibold uppercase mb-1 ${overpayRefunded ? 'text-emerald-700 dark:text-emerald-300' : 'text-orange-700 dark:text-orange-300'}`}>
                {overpayRefunded ? 'Đã xử lý phần thu dư' : 'Phiếu thu có phần dư'}
              </p>
              <p className="text-sm text-ink">
                Phần dư{' '}
                <span className="font-bold">{formatVND(v.overpay.amount)}</span>
                {v.overpay.customerName ? <> của <span className="font-semibold">{v.overpay.customerName}</span></> : null}
                {v.overpay.orderCode ? <> (đơn <span className="font-mono text-gold">{v.overpay.orderCode}</span>)</> : null}.
              </p>

              {overpayRefunded ? (
                <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-300 flex items-center gap-1">
                  <CheckCircle size={14} /> Đã lập phiếu chi hoàn:{' '}
                  <span className="font-mono font-bold">{v.overpay.refundVoucherCode}</span>
                </p>
              ) : (
                <div className="mt-3 space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-ink mb-1">Phương thức hoàn tiền</label>
                    <div className="flex gap-2">
                      {[{v:'CASH',l:'Tiền mặt'},{v:'BANK_TRANSFER',l:'Chuyển khoản'}].map(o=>(
                        <button key={o.v} type="button"
                          onClick={()=>setRefundPaymentType(o.v)}
                          className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition ${
                            refundPaymentType===o.v
                              ? 'border-orange-400 bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-200'
                              : 'border-line text-muted hover:bg-canvas'
                          }`}>{o.l}</button>
                      ))}
                    </div>
                  </div>

                  {refundPaymentType === 'BANK_TRANSFER' && (
                    <div className="space-y-2 bg-white dark:bg-surface rounded-lg p-3 border border-orange-100 dark:border-orange-500/18">
                      <p className="text-[10px] text-muted italic">Thông tin STK khách hàng (tuỳ chọn)</p>
                      <div>
                        <label className="block text-xs text-muted mb-1">Ngân hàng</label>
                        <select value={refundBankName} onChange={e=>setRefundBankName(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-line text-sm focus:outline-none focus:border-orange-400 bg-surface">
                          <option value="">-- Chọn ngân hàng --</option>
                          {VN_BANKS.map(b=>(<option key={b} value={b}>{b}</option>))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-muted mb-1">Số tài khoản</label>
                        <input value={refundBankAccount} onChange={e=>setRefundBankAccount(e.target.value)}
                          placeholder="VD: 0123456789"
                          className="w-full px-3 py-2 rounded-lg border border-line text-sm focus:outline-none focus:border-orange-400 bg-surface" />
                      </div>
                      <div>
                        <label className="block text-xs text-muted mb-1">Tên chủ tài khoản</label>
                        <input value={refundBankHolder} onChange={e=>setRefundBankHolder(e.target.value)}
                          placeholder="VD: NGUYEN VAN A"
                          className="w-full px-3 py-2 rounded-lg border border-line text-sm focus:outline-none focus:border-orange-400 bg-surface" />
                      </div>
                    </div>
                  )}

                  <button
                    onClick={doRefundOverpay}
                    disabled={busy}
                    className="w-full py-2.5 rounded-xl bg-orange-500 text-white text-sm font-bold hover:bg-orange-600 transition disabled:opacity-50"
                  >
                    {busy ? 'Đang xử lý...' : `Tạo phiếu chi hoàn phần dư (${formatVND(v.overpay.amount)})`}
                  </button>
                </div>
              )}
            </div>
          )}
            */}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-hairline flex gap-3">
          <button onClick={downloadPdf} disabled={downloading}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-hairline-2 text-sm font-semibold text-ink-2 hover:border-gold hover:text-gold transition disabled:opacity-50"
            title="Xuất PDF">
            <FileDown size={14} /> {downloading ? '...' : 'PDF'}
          </button>
          {canEdit && onEdit && (
            <button onClick={() => onEdit(v)}
              className="flex-1 py-3 rounded-xl border border-gold/50 text-sm font-semibold text-gold hover:bg-gold/10 transition flex items-center justify-center gap-2">
              <Pencil size={14} /> Sửa phiếu thu
            </button>
          )}
          <button onClick={onClose}
            className={`${canEdit && onEdit ? 'flex-1' : 'w-full'} py-3 rounded-xl border border-hairline-2 text-sm font-semibold text-muted hover:bg-canvas transition`}>
            Đóng
          </button>
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