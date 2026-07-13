// src/pages/admin/IncomeVoucherPage.jsx
import { useLang } from '../../context/LangContext';
import { useState, useEffect, useCallback } from 'react';
import { Sk, TableSkeleton } from '../../components/ui/Skeleton.jsx';
import useMinLoading from '../../hooks/useMinLoading.js';
import { adminIncomeApi } from '../../api/adminApi';
import { useToast } from '../../components/common/Toast';
import { TrendingUp, Clock, DollarSign, FileText, BadgeCheck, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, X, Download, Upload } from 'lucide-react';
import {
  PageHeader, LoadingSpinner, EmptyState, formatCurrency, formatDateTime,
} from '../../components/ui';
import DateRangePicker from '../../components/ui/DateRangePicker';
import VoucherDetailModal from '../../components/common/VoucherDetailModal';
import { VOUCHER_PAGE_SIZE } from '../../constants/pagination';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

function imgSrc(url) {
  if (!url) return '';
  return url.startsWith('http') ? url : `${BASE_URL}/api/auth${url}`;
}

// ── Lightbox ─────────────────────────────────────────────────────────────────
function Lightbox({ images, index, onClose }) {
  const [cur, setCur] = useState(index);
  useEffect(() => {
    const h = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft')  setCur(i => (i - 1 + images.length) % images.length);
      if (e.key === 'ArrowRight') setCur(i => (i + 1) % images.length);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [images.length, onClose]);

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center" onClick={onClose}>
      <button onClick={onClose} className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"><X size={20} /></button>
      <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white/70 text-sm">{cur + 1} / {images.length}</div>
      {images.length > 1 && (
        <button onClick={e => { e.stopPropagation(); setCur(i => (i - 1 + images.length) % images.length); }} className="absolute left-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"><ChevronLeft size={22} /></button>
      )}
      <img src={imgSrc(images[cur])} alt="" className="max-h-[85vh] max-w-[85vw] object-contain rounded-xl shadow-2xl" onClick={e => e.stopPropagation()} />
      {images.length > 1 && (
        <button onClick={e => { e.stopPropagation(); setCur(i => (i + 1) % images.length); }} className="absolute right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"><ChevronRight size={22} /></button>
      )}
      {images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
          {images.map((url, i) => (
            <button key={i} onClick={e => { e.stopPropagation(); setCur(i); }}
              className={`w-12 h-12 rounded-lg overflow-hidden border-2 transition-all ${i === cur ? 'border-white scale-110' : 'border-white/30 opacity-60 hover:opacity-100'}`}>
              <img src={imgSrc(url)} className="w-full h-full object-cover" alt="" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Summary card ──────────────────────────────────────────────────────────────
function SummaryCard({ icon: Icon, label, value, accent }) {
  const colors = {
    gold:  { bg: 'bg-amber-50',   icon: 'text-amber-600',   val: 'text-amber-700'   },
    green: { bg: 'bg-emerald-50', icon: 'text-emerald-600', val: 'text-emerald-700' },
    blue:  { bg: 'bg-sky-50',     icon: 'text-sky-600',     val: 'text-sky-700'     },
  };
  const c = colors[accent] || colors.gold;
  return (
    <div className={`${c.bg} rounded-2xl p-4 flex items-center gap-3 border border-white/60`}>
      <div className={`p-2.5 bg-white/70 rounded-xl ${c.icon}`}><Icon size={20} /></div>
      <div>
        <p className="text-xs text-[#8E8878] font-medium">{label}</p>
        <p className={`text-xl font-bold ${c.val}`}>{value}</p>
      </div>
    </div>
  );
}

// ── Row ───────────────────────────────────────────────────────────────────────
function VoucherRow({ v, onOpenLightbox, onOpenDetail }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const total = v.totalAmount ?? v.items?.reduce((s, i) => s + Number(i.amount), 0) ?? 0;

  return (
    <>
      <tr
        className="border-b border-[#F0EBE3] hover:bg-[#FAF7F2] cursor-pointer"
        onClick={() => setOpen(o => !o)}
      >
        <td className="px-3 py-3 font-mono text-xs text-[#C9A84C] whitespace-nowrap">{v.receiptNumber || v.voucherCode}</td>
        <td className="px-3 py-3 max-w-[180px]">
          <p className="font-medium text-[#1C1C1E] text-sm truncate">{v.reason}</p>
          {v.payerName && <p className="text-xs text-[#8E8878] truncate">{v.payerName}</p>}
        </td>
        <td className="px-3 py-3 text-sm text-[#5C4E3D] whitespace-nowrap">{v.createdByName}</td>
        <td className="px-3 py-3 text-left font-bold text-emerald-600 whitespace-nowrap">{formatCurrency(total)}</td>
        <td className="px-3 py-3">
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            <BadgeCheck size={10} /> Đã xác nhận
          </span>
        </td>
        <td className="px-3 py-3 text-xs text-[#8E8878] whitespace-nowrap">{formatDateTime(v.createdAt)}</td>
        <td className="px-2 py-3 text-[#8E8878]">
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </td>
      </tr>

      {open && (
        <tr className="bg-[#FAF7F2]">
          <td colSpan={8} className="px-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-[#8E8878] uppercase mb-2">{t('admin','income_items_label')}</p>
                <div className="space-y-1">
                  {(v.items || []).map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-[#5C4E3D]">{item.itemName}</span>
                      <span className="font-semibold text-[#1C1C1E]">{formatCurrency(item.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
              {(v.imageUrls || []).length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-[#8E8878] uppercase mb-2">
                    {t('admin','receipt_images')} ({v.imageUrls.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {v.imageUrls.map((url, i) => (
                      <button key={i}
                        onClick={e => { e.stopPropagation(); onOpenLightbox(v.imageUrls, i); }}
                        className="w-20 h-20 rounded-lg overflow-hidden border border-[#E8DDD0] hover:border-[#C9A84C] hover:scale-105 transition-all"
                      >
                        <img src={imgSrc(url)} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function IncomeVoucherPage() {
  const { t } = useLang();
  const toast = useToast();
  const [vouchers, setVouchers]       = useState([]);
  const [loading, setLoading] = useMinLoading();
  const [page, setPage]               = useState(0);
  const [totalPages, setTotalPages]   = useState(0);
  const [dateRange, setDateRange]     = useState({ from: null, to: null });
  const [lightboxImages, setLightboxImages] = useState([]);
  const [lightboxIndex, setLightboxIndex]   = useState(null);
  const [detailVoucher, setDetailVoucher]   = useState(null);

  const [totalAmount, setTotalAmount]     = useState(0);
  const [totalElements, setTotalElements] = useState(0);

  const load = useCallback(async (p = 0) => {
    setLoading(true);
    try {
      // FIX 1: trước đây lọc ngày Ở PHÍA CLIENT trên đúng 20 phiếu của trang hiện tại
      // → lọc sai (phiếu ở trang khác bị bỏ sót) và số trang không đổi theo bộ lọc.
      //   Giờ đẩy bộ lọc ngày xuống SERVER qua endpoint /by-date.
      // FIX 2: "Tổng số tiền phiếu thu" trước đây cộng các phiếu TRÊN TRANG HIỆN TẠI
      // → lệch số. Giờ lấy từ API /summary — SUM trên TOÀN BỘ kết quả khớp bộ lọc.
      const params = { page: p, size: VOUCHER_PAGE_SIZE, sort: 'createdAt,desc' };

      // Chỉ chọn 1 đầu mốc → tự bù đầu còn lại (đầu kỷ nguyên / cuối hôm nay)
      const anyDate = !!(dateRange.from || dateRange.to);
      const from = anyDate
        ? (dateRange.from ? new Date(dateRange.from).setHours(0, 0, 0, 0) : 0)
        : null;
      const to = anyDate
        ? (dateRange.to
            ? new Date(dateRange.to).setHours(23, 59, 59, 999)
            : new Date().setHours(23, 59, 59, 999))
        : null;
      const hasRange = anyDate;

      const [res, sum] = await Promise.all([
        hasRange
          ? adminIncomeApi.listByDate(from, to, params)
          : adminIncomeApi.listAll(params),
        adminIncomeApi.summary(undefined, from ?? undefined, to ?? undefined),
      ]);

      setVouchers(res.content || []);
      setTotalPages(res.totalPages || 0);
      setTotalElements(res.totalElements || 0);
      setTotalAmount(Number(sum?.totalAmount) || 0);
      setPage(p);
    } catch {
      toast(t('common','error_retry'), 'error');
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => { load(0); }, [load]);

  // Tổng số phiếu = toàn bộ kết quả khớp bộ lọc (không phải số phiếu trên trang)
  const confirmedCount = totalElements;

  return (
    <>
      <div className="p-4 sm:p-6 lg:p-8 space-y-5">
        <PageHeader
          icon={TrendingUp}
          {...{title: t("voucher","income_voucher")}}
          subtitle={`${confirmedCount} ${t('voucher','income_voucher').toLowerCase()}`}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <SummaryCard icon={DollarSign} label="Tổng tiền phiếu thu" value={formatCurrency(totalAmount)} accent="green" />
          <SummaryCard icon={FileText}   label="Số phiếu thu"      value={confirmedCount + ' phiếu'}   accent="blue" />
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <DateRangePicker
            from={dateRange.from} to={dateRange.to}
            onChange={r => { setDateRange(r); setPage(0); }}
            placeholder="Lọc theo ngày"
          />
          {/* FIX #3: Import / Export Phiếu thu */}
          <div className="flex items-center gap-2 ml-auto">
            <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E8DDD0] text-xs text-[#5C5C5C] hover:border-[#C9A84C] cursor-pointer transition-all">
              <Upload size={13} /> Import
              <input type="file" accept=".xlsx,.csv" className="hidden" onChange={e => {
                if (e.target.files[0]) alert('Chức năng Import sẽ được xử lý ở backend');
              }} />
            </label>
            <button onClick={() => alert('Chức năng Export sẽ được xử lý ở backend')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E8DDD0] text-xs text-[#5C5C5C] hover:border-[#C9A84C] transition-all">
              <Download size={13} /> Export
            </button>
          </div>
        </div>

        {loading ? (
        <TableSkeleton cols={5} rows={8} />
      ) : vouchers.length === 0
          ? <EmptyState icon={TrendingUp} title="Không có phiếu thu nào" />
          : (
            <div className="bg-white rounded-2xl border border-[#E8DDD0] overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="bg-[#FAF7F2] border-b border-[#E8DDD0]">
                    {['Số phiếu thu', 'Lý do / Người nộp', 'Người lập', t('order','total_amount'), t('common','status'), 'Ngày tạo', ''].map(h => (
                      <th key={h} className="text-left px-3 py-3 text-xs font-semibold text-[#8E8878] uppercase whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {vouchers.map(v => (
                    <VoucherRow
                      key={v.id} v={v}
                      onOpenLightbox={(imgs, i) => { setLightboxImages(imgs); setLightboxIndex(i); }}
                      onOpenDetail={setDetailVoucher}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )
        }

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              onClick={() => load(page - 1)} disabled={page === 0}
              className="px-3 py-1.5 rounded-lg border border-[#E8DDD0] text-sm font-medium disabled:opacity-40 hover:bg-[#FAF7F2] transition"
            >
              ← Trước
            </button>
            <span className="text-sm text-[#8E8878]">{page + 1} / {totalPages}</span>
            <button
              onClick={() => load(page + 1)} disabled={page >= totalPages - 1}
              className="px-3 py-1.5 rounded-lg border border-[#E8DDD0] text-sm font-medium disabled:opacity-40 hover:bg-[#FAF7F2] transition"
            >
              Tiếp →
            </button>
          </div>
        )}
      </div>

      {lightboxIndex !== null && lightboxImages.length > 0 && (
        <Lightbox images={lightboxImages} index={lightboxIndex} onClose={() => setLightboxIndex(null)} />
      )}

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