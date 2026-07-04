// src/pages/accountant/IncomeDetailModal.jsx
import { X, TrendingUp, Banknote, CreditCard, ShoppingCart } from 'lucide-react';

function formatVND(n) {
  if (!n && n !== 0) return '0 đ';
  return new Intl.NumberFormat('vi-VN').format(n) + ' đ';
}
function formatDate(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')} ${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
function imgSrc(url) {
  if (!url) return '';
  return url.startsWith('http') ? url : `${BASE_URL}/api/auth${url}`;
}

export default function IncomeDetailModal({ voucher: v, onClose }) {
  const isBankTransfer = v.paymentType === 'BANK_TRANSFER';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-black/5">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isBankTransfer ? 'bg-blue-50' : 'bg-[#FAF7F2]'}`}>
              {isBankTransfer ? <CreditCard size={18} className="text-blue-500" /> : <Banknote size={18} className="text-[#C9A84C]" />}
            </div>
            <div>
              <p className="font-mono text-sm font-bold text-[#C9A84C]">Số phiếu thu {v.receiptNumber || v.voucherCode}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isBankTransfer ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>
                {isBankTransfer ? 'Chuyển khoản' : 'Tiền mặt'}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-[#FAF7F2] text-[#8E8878] transition">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-3">
            <InfoRow label="Lý do thu"     value={v.reason}      full />
            {v.payerName && <InfoRow label="Người nộp tiền" value={v.payerName} full />}
            <InfoRow label="Người lập"     value={v.createdByName} />
            <InfoRow label="Ngày tạo"      value={formatDate(v.createdAt)} />
          </div>

          {/* Bank info */}
          {isBankTransfer && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-2">
              <p className="text-xs font-bold text-blue-600 mb-2">Thông tin chuyển khoản</p>
              <InfoRow label="Ngân hàng"         value={v.bankName} />
              <InfoRow label="Mã tham chiếu GD"  value={v.bankRef} mono />
            </div>
          )}

          {/* Linked orders */}
          {v.linkedOrderCodes?.length > 0 && (
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-[#1C1C1E] mb-2">
                <ShoppingCart size={14} className="text-[#C9A84C]" />
                Đơn hàng liên quan ({v.linkedOrderCodes.length})
              </div>
              <div className="flex flex-wrap gap-2">
                {v.linkedOrderCodes.map((code, i) => (
                  <span key={i} className="font-mono text-xs bg-[#FAF7F2] border border-[#C9A84C]/20 text-[#C9A84C] px-3 py-1.5 rounded-lg font-bold">
                    {code}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Items */}
          <div>
            <p className="text-sm font-semibold text-[#1C1C1E] mb-2">Các khoản thu</p>
            <div className="space-y-2">
              {v.items?.map((item, i) => (
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

function InfoRow({ label, value, full, mono }) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <p className="text-xs text-[#8E8878] mb-0.5">{label}</p>
      <p className={`text-sm font-medium text-[#1C1C1E] ${mono ? 'font-mono' : ''}`}>{value || '—'}</p>
    </div>
  );
}
