// src/pages/admin/ExpenseVoucherPage.jsx
import { useLang } from '../../context/LangContext';
import { useState, useEffect, useCallback } from 'react';
import { Sk, TableSkeleton } from '../../components/ui/Skeleton.jsx';
import useMinLoading from '../../hooks/useMinLoading.js';
import { adminExpenseApi } from '../../api/adminApi';
import { useToast } from '../../components/common/Toast';
import { Receipt, CheckCircle, XCircle, Clock, ChevronDown, ChevronUp, DollarSign, FileText, X, ChevronLeft, ChevronRight, Download, Upload, Wallet, Search } from 'lucide-react';
import {
  PageHeader, LoadingSpinner, EmptyState,
  formatCurrency, formatDateTime,
} from '../../components/ui';
import DateRangePicker from '../../components/ui/DateRangePicker';


const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

function imgSrc(url) {
  if (!url) return '';
  return url.startsWith('http') ? url : `${BASE_URL}/api/auth${url}`;
}

// ── Lightbox ──────────────────────────────────────────────────────────────────
function Lightbox({ images, index, onClose, onPrev, onNext }) {
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onPrev();
      if (e.key === 'ArrowRight') onNext();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, onPrev, onNext]);

  if (index === null || !images?.length) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors z-10"
      >
        <X size={20} />
      </button>

      {/* Counter */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white/70 text-sm">
        {index + 1} / {images.length}
      </div>

      {/* Prev */}
      {images.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); onPrev(); }}
          className="absolute left-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
        >
          <ChevronLeft size={22} />
        </button>
      )}

      {/* Image */}
      <img
        src={imgSrc(images[index])}
        alt={`Ảnh ${index + 1}`}
        className="max-h-[85vh] max-w-[85vw] object-contain rounded-xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />

      {/* Next */}
      {images.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          className="absolute right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
        >
          <ChevronRight size={22} />
        </button>
      )}

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
          {images.map((url, i) => (
            <button
              key={i}
              onClick={(e) => { e.stopPropagation(); /* handled by parent */ }}
              className={`w-12 h-12 rounded-lg overflow-hidden border-2 transition-all ${i === index ? 'border-white scale-110' : 'border-white/30 opacity-60 hover:opacity-100'
                }`}
            >
              <img src={imgSrc(url)} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status, statusMap }) {
  const cfg = (statusMap || {})[status] || { label: status, cls: 'bg-gray-50 text-gray-600 border-gray-200', icon: Clock };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${cfg.cls}`}>
      <Icon size={10} />{cfg.label}
    </span>
  );
}

function SummaryCard({ icon: Icon, label, value, accent }) {
  const colors = {
    gold: { bg: 'bg-amber-50', icon: 'text-amber-600', val: 'text-amber-700' },
    green: { bg: 'bg-emerald-50', icon: 'text-emerald-600', val: 'text-emerald-700' },
    blue: { bg: 'bg-sky-50', icon: 'text-sky-600', val: 'text-sky-700' },
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

function VoucherRow({ v, onOpenLightbox, statusMap }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const total = v.totalAmount ?? v.items?.reduce((s, i) => s + Number(i.amount), 0) ?? 0;

  return (
    <>
      <tr className="border-b border-[#F0EBE3] hover:bg-[#FAF7F2] cursor-pointer"
        onClick={() => setOpen(o => !o)}>
        <td className="px-3 py-3 font-mono text-xs text-[#C9A84C] whitespace-nowrap">{v.paymentNumber || v.voucherCode}</td>
        <td className="px-3 py-3 max-w-[180px]">
          <p className="font-medium text-[#1C1C1E] text-sm truncate">{v.reason}</p>
          {v.vendorName && <p className="text-xs text-[#8E8878] truncate">{v.vendorName}</p>}
          {v.expenseDate ? (
            <p className="text-[10px] text-[#8E8878] mt-0.5">
              Ngày chi: {(() => { const d = new Date(v.expenseDate); return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`; })()}
            </p>
          ) : v.expensePeriod && (
            <p className="text-[10px] text-[#8E8878] mt-0.5">
              Kỳ: {(() => { const [y, m] = v.expensePeriod.split('-'); return `Tháng ${Number(m)}/${y}`; })()}
            </p>
          )}
          {v.voucherType === 'VENDOR_DEBT_PAYMENT' && (
            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-amber-50 text-amber-700 mt-1">
              <Wallet size={9} /> Trả công nợ NCC
            </span>
          )}
        </td>
        <td className="px-3 py-3 text-sm text-[#5C4E3D] whitespace-nowrap">{v.createdByName}</td>
        <td className="px-3 py-3 text-sm text-[#5C4E3D] whitespace-nowrap">{v.requestedByName || v.createdByName}</td>
        <td className="px-3 py-3 text-right font-bold text-[#C9A84C] whitespace-nowrap">{formatCurrency(total)}</td>
        <td className="px-3 py-3 whitespace-nowrap"><StatusBadge status={v.status} statusMap={statusMap} /></td>
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
                <p className="text-xs font-semibold text-[#8E8878] uppercase mb-2">Các khoản chi</p>
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
                    Ảnh chứng từ ({v.imageUrls.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {v.imageUrls.map((url, i) => (
                      <button
                        key={i}
                        onClick={(e) => { e.stopPropagation(); onOpenLightbox(v.imageUrls, i); }}
                        className="w-20 h-20 rounded-lg overflow-hidden border border-[#E8DDD0] hover:border-[#C9A84C] hover:scale-105 transition-all focus:outline-none focus:ring-2 focus:ring-[#C9A84C]"
                      >
                        <img src={imgSrc(url)} alt={`ảnh ${i + 1}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {v.status === 'REJECTED' && v.rejectReason && (
                <div className="md:col-span-2">
                  <p className="text-xs font-semibold text-red-500 uppercase mb-1">Lý do từ chối</p>
                  <p className="text-sm text-[#5C4E3D]">{v.rejectReason}</p>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function ExpenseVoucherPage() {
  const { t } = useLang();
  const toast = useToast();
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useMinLoading();
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [dateRange, setDateRange] = useState({ from: null, to: null });
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const STATUS_MAP = {
    PENDING: { label: t('status', 'pending'), cls: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock },
    APPROVED: { label: t('status', 'approved'), cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle },
    REJECTED: { label: t('status', 'rejected_short'), cls: 'bg-red-50 text-red-600 border-red-200', icon: XCircle },
  };

  // Lightbox state
  const [lightboxImages, setLightboxImages] = useState([]);
  const [lightboxIndex, setLightboxIndex] = useState(null);

  const openLightbox = (images, i) => { setLightboxImages(images); setLightboxIndex(i); };
  const closeLightbox = () => setLightboxIndex(null);
  const prevImage = () => setLightboxIndex(i => (i - 1 + lightboxImages.length) % lightboxImages.length);
  const nextImage = () => setLightboxIndex(i => (i + 1) % lightboxImages.length);

  const load = useCallback(async (p = 0) => {
    setLoading(true);
    try {
      const params = { page: p, size: 20, sort: 'createdAt,desc' };
      if (statusFilter) params.status = statusFilter;
      const res = await adminExpenseApi.listAll(params);
      let items = res.content || [];

      if (dateRange.from) {
        const f = new Date(dateRange.from).setHours(0, 0, 0, 0);
        items = items.filter(v => v.createdAt >= f);
      }
      if (dateRange.to) {
        const t = new Date(dateRange.to).setHours(23, 59, 59, 999);
        items = items.filter(v => v.createdAt <= t);
      }

      const kw = search.trim().toLowerCase();
      if (kw) {
        items = items.filter(v =>
          (v.paymentNumber && String(v.paymentNumber).toLowerCase().includes(kw)) ||
          (v.voucherCode && v.voucherCode.toLowerCase().includes(kw)) ||
          (v.reason && v.reason.toLowerCase().includes(kw)) ||
          (v.vendorName && v.vendorName.toLowerCase().includes(kw))
        );
      }

      setVouchers(items);
      setTotalPages(res.totalPages || 0);
      setPage(p);
    } catch { toast('Không thể tải phiếu chi', 'error'); }
    finally { setLoading(false); }
  }, [dateRange, statusFilter, search]);

  useEffect(() => { load(0); }, [load]);

  const totalAmount = vouchers.reduce((s, v) => s + Number(v.totalAmount || 0), 0);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5">
      <PageHeader icon={Receipt} title="Phiếu chi phí"
        subtitle="Kế toán lập phiếu là chi luôn — chỉ xem, không cần duyệt" />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <SummaryCard icon={DollarSign} label="Tổng số tiền phiếu chi" value={formatCurrency(totalAmount)} accent="gold" />
        <SummaryCard icon={FileText} label="Tổng số phiếu chi" value={vouchers.length + ' phiếu'} accent="blue" />
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8878]" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            placeholder="Tìm số phiếu chi, lý do, nhà cung cấp..."
            className="w-full pl-9 pr-8 py-2 rounded-xl border border-[#E8DDD0] text-xs bg-white focus:outline-none focus:border-[#C9A84C]"
          />
          {search && (
            <button onClick={() => { setSearch(''); setPage(0); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8E8878] hover:text-[#1C1C1E]">
              <X size={13} />
            </button>
          )}
        </div>
        <DateRangePicker
          from={dateRange.from} to={dateRange.to}
          onChange={r => { setDateRange(r); setPage(0); }}
          placeholder="Lọc theo ngày" />
        <select value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(0); }}
          className="border border-[#E8DDD0] rounded-xl px-3 py-2 text-xs bg-white focus:outline-none focus:border-[#C9A84C]">
          <option value="">Tất cả trạng thái</option>
          <option value="PENDING">Chờ duyệt</option>
          <option value="APPROVED">Đã duyệt</option>
          <option value="REJECTED">Từ chối</option>
        </select>
        {/* FIX #3: Import / Export Phiếu chi */}
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
        ? <EmptyState icon={Receipt} title="Không có phiếu chi nào" />
        : (
          <div className="bg-white rounded-2xl border border-[#E8DDD0] overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead>
                <tr className="bg-[#FAF7F2] border-b border-[#E8DDD0]">
                  {['Số phiếu', 'Lý do / Đơn vị', 'Người lập', 'Người yêu cầu', t('order', 'total_amount'), t('common', 'status'), 'Ngày tạo', ''].map(h => (
                    <th key={h} className="text-left px-3 py-3 text-xs font-semibold text-[#8E8878] uppercase whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vouchers.map(v => (
                  <VoucherRow key={v.id} v={v}
                    onOpenLightbox={openLightbox}
                    statusMap={STATUS_MAP} />
                ))}
              </tbody>
            </table>
          </div>
        )
      }

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 flex-wrap">
          {Array.from({ length: totalPages }, (_, i) => (
            <button key={i} onClick={() => load(i)}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${i === page
                ? 'bg-[#C9A84C] text-white'
                : 'bg-[#F0EBE3] text-[#5C4E3D] hover:bg-[#E8DDD0]'}`}>
              {i + 1}
            </button>
          ))}
        </div>
      )}

      {/* Lightbox */}
      <Lightbox
        images={lightboxImages}
        index={lightboxIndex}
        onClose={closeLightbox}
        onPrev={prevImage}
        onNext={nextImage}
      />
    </div>
  );
}