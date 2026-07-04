// src/pages/accountant/ExpenseDetailModal.jsx
import { X, Receipt, Building2, User, Clock, CheckCircle, XCircle, Package, Wallet } from 'lucide-react';

function formatVND(n) {
  if (!n && n !== 0) return '0 đ';
  return new Intl.NumberFormat('vi-VN').format(n) + ' đ';
}
function formatDate(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')} ${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

const STATUS_CFG = {
  PENDING:  { label: 'Chờ duyệt',  cls: 'bg-amber-100 text-amber-700',  icon: Clock },
  APPROVED: { label: 'Đã duyệt',   cls: 'bg-green-100 text-green-700',  icon: CheckCircle },
  REJECTED: { label: 'Từ chối',    cls: 'bg-red-100 text-red-600',      icon: XCircle },
};

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
function imgSrc(url) {
  if (!url) return '';
  return url.startsWith('http') ? url : `${BASE_URL}/api/auth${url}`;
}

export default function ExpenseDetailModal({ voucher: v, onClose }) {
  const s = STATUS_CFG[v.status] || STATUS_CFG.PENDING;
  const StatusIcon = s.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-black/5">
          <div className="flex items-center gap-3">
            <Receipt size={20} className="text-[#C9A84C]" />
            <div>
              <p className="font-mono text-sm font-bold text-[#C9A84C]">{v.voucherCode}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${s.cls}`}>
                  <StatusIcon size={10} /> {s.label}
                </span>
                {v.voucherType === 'VENDOR_DEBT_PAYMENT' && (
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-amber-50 text-amber-700">
                    <Wallet size={10} /> Trả công nợ NCC
                  </span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-[#FAF7F2] text-[#8E8878] transition">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">

          {/* Info rows */}
          <div className="grid grid-cols-2 gap-3">
            <InfoRow label="Lý do chi" value={v.reason} full />
            {v.vendorName && <InfoRow label="Nhà cung cấp" value={v.vendorName} icon={<Building2 size={12} />} full />}
            <InfoRow label="Người lập" value={v.createdByName} icon={<User size={12} />} />
            {v.requestedByName && <InfoRow label="Người yêu cầu" value={v.requestedByName} icon={<User size={12} />} />}
            <InfoRow label="Ngày tạo" value={formatDate(v.createdAt)} />
            {v.approvedByName && <InfoRow label="Người duyệt" value={v.approvedByName} />}
            {v.approvedAt && <InfoRow label="Ngày duyệt" value={formatDate(v.approvedAt)} />}
          </div>

          {v.rejectReason && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-3">
              <p className="text-xs font-semibold text-red-600 mb-1">Lý do từ chối</p>
              <p className="text-sm text-red-700">{v.rejectReason}</p>
            </div>
          )}

          {/* Items */}
          {v.items?.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-[#1C1C1E] mb-2">Các khoản chi</p>
              <div className="space-y-2">
                {v.items.map((item, i) => (
                  <div key={item.id || i} className="flex items-start justify-between bg-[#FAF7F2] rounded-xl px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-[#1C1C1E]">{item.itemName}</p>
                      {item.note && <p className="text-xs text-[#8E8878] mt-0.5">{item.note}</p>}
                    </div>
                    <p className="text-sm font-bold text-[#1C1C1E] flex-shrink-0 ml-3">{formatVND(item.amount)}</p>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center mt-3 pt-3 border-t border-black/5">
                <span className="text-sm font-semibold text-[#8E8878]">Tổng cộng</span>
                <span className="text-base font-bold text-[#C9A84C]">{formatVND(v.totalAmount)}</span>
              </div>
            </div>
          )}
          {(!v.items || v.items.length === 0) && (
            <div className="flex justify-between items-center bg-[#FAF7F2] rounded-xl px-4 py-3">
              <span className="text-sm font-semibold text-[#8E8878]">Tổng cộng</span>
              <span className="text-base font-bold text-[#C9A84C]">{formatVND(v.totalAmount)}</span>
            </div>
          )}

          {/* Images */}
          {v.imageUrls?.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-[#1C1C1E] mb-2">Ảnh chứng từ</p>
              <div className="flex flex-wrap gap-2">
                {v.imageUrls.map((url, i) => (
                  <a key={i} href={imgSrc(url)} target="_blank" rel="noreferrer">
                    <img src={imgSrc(url)} alt="" className="w-20 h-20 object-cover rounded-xl border border-black/10 hover:opacity-80 transition" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-black/5">
          <button onClick={onClose} className="w-full py-3 rounded-xl border border-black/10 text-sm font-semibold text-[#8E8878] hover:bg-[#FAF7F2] transition">
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
      <p className="text-xs text-[#8E8878] mb-0.5">{label}</p>
      <p className="text-sm font-medium text-[#1C1C1E] flex items-center gap-1">
        {icon && <span className="text-[#C9A84C]">{icon}</span>}
        {value || '—'}
      </p>
    </div>
  );
}
