// src/pages/shared/VoucherDetailPage.jsx
import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft, Ticket, RefreshCw, Printer, Building2, User as UserIcon,
  Clock, Layers, Package, Cake, Store, Gift, Receipt,
} from 'lucide-react';
import { voucherApi, downloadBlob } from '../../api/voucherApi';
import { TableSkeleton } from '../../components/ui/Skeleton.jsx';
import useMinLoading from '../../hooks/useMinLoading.js';
import { useToast } from '../../components/common/Toast';
import { EmptyState, SecondaryButton, formatNumber } from '../../components/ui';
import { formatDate, formatDateTime } from '../../utils/anniversary';

/**
 * CHI TIẾT VOUCHER + LỊCH SỬ SỬ DỤNG.
 *
 * <p>Trả lời hai câu hỏi mà màn hình danh sách không trả lời được: voucher này đã tiêu ở
 * những đơn nào, và sau mỗi lần tiêu còn lại bao nhiêu. Khi khách khiếu nại "tôi chưa
 * dùng mà sao hết tiền", đây là chỗ tra.
 *
 * <p>Đường quay lại suy từ URL vì trang này dùng chung cho {@code /owner}, {@code /admin}
 * và {@code /seller}.
 */

const STATUS_LABEL = {
  ACTIVE:    { label: 'Còn hiệu lực', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' },
  USED:      { label: 'Đã dùng hết',  cls: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300' },
  EXPIRED:   { label: 'Hết hạn',      cls: 'bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300' },
  CANCELLED: { label: 'Đã thu hồi',   cls: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300' },
};

const REASON_LABEL = {
  BIRTHDAY:      { label: 'Sinh nhật',   icon: Cake },
  STORE_OPENING: { label: 'Khai trương', icon: Store },
  PROMOTION:     { label: 'Khuyến mãi',  icon: Gift },
  OTHER:         { label: 'Khác',        icon: Ticket },
};

export default function VoucherDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const toast = useToast();

  const [voucher, setVoucher] = useState(null);
  const [usages, setUsages] = useState([]);
  const [loading, setLoading] = useMinLoading();

  const base = pathname.startsWith('/owner') ? '/owner'
    : pathname.startsWith('/admin') ? '/admin' : '/seller';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Nạp song song: hai lời gọi độc lập, chờ tuần tự chỉ làm trang lâu hiện gấp đôi.
      const [v, u] = await Promise.all([
        voucherApi.getById(id),
        voucherApi.usages(id).catch(() => []),
      ]);
      setVoucher(v);
      setUsages(u || []);
    } catch (e) {
      toast(e?.message || 'Không tải được voucher', 'error');
    } finally { setLoading(false); }
  }, [id, setLoading, toast]);

  useEffect(() => { load(); }, [load]);

  const handlePrint = async () => {
    try {
      const res = await voucherApi.pdf(voucher.id);
      downloadBlob(res, `voucher-${voucher.code}.pdf`);
    } catch (e) { toast(e?.message || 'Không tạo được phiếu in', 'error'); }
  };

  if (loading) {
    return <div className="p-4 sm:p-6 lg:p-8"><TableSkeleton cols={3} rows={6} /></div>;
  }
  if (!voucher) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <EmptyState icon={Ticket} title="Không tìm thấy voucher" />
      </div>
    );
  }

  const st = STATUS_LABEL[voucher.effectiveStatus] || STATUS_LABEL.ACTIVE;
  const reason = REASON_LABEL[voucher.reason] || REASON_LABEL.OTHER;
  const ReasonIcon = reason.icon;
  const isCompany = voucher.customerType === 'COMPANY';

  const used = Number(voucher.usedAmount || 0);
  const total = Number(voucher.amount || 0);
  const usedPct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button onClick={() => navigate(`${base}/vouchers`)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-line
                     text-xs font-semibold text-ink-2 hover:border-gold hover:text-gold transition-colors">
          <ArrowLeft size={14} /> Quay lại Quản lý voucher
        </button>
        <div className="flex items-center gap-2">
          <SecondaryButton onClick={handlePrint} className="text-xs">
            <Printer size={13} /> In phiếu
          </SecondaryButton>
          <button onClick={load}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-line text-xs text-ink-2 hover:border-gold transition-colors">
            <RefreshCw size={13} /> Làm mới
          </button>
        </div>
      </div>

      {/* Tóm tắt */}
      <div className="bg-surface rounded-2xl border border-hairline shadow-sm p-5 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Ticket size={18} className="text-gold" />
              <h1 className="font-mono font-bold text-ink text-lg tracking-wide">{voucher.code}</h1>
              <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${st.cls}`}>{st.label}</span>
              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md
                               bg-canvas text-muted border border-line-soft">
                <ReasonIcon size={10} /> {reason.label}
              </span>
            </div>
            {voucher.title && <p className="text-sm text-muted mt-1">{voucher.title}</p>}

            <div className="flex items-center gap-1.5 mt-2">
              {isCompany
                ? <Building2 size={13} className="text-blue-500 shrink-0" />
                : <UserIcon size={13} className="text-gold shrink-0" />}
              <span className="text-sm font-semibold text-ink">{voucher.customerName || '—'}</span>
              {voucher.customerPhone && (
                <span className="text-xs text-muted">· {voucher.customerPhone}</span>
              )}
            </div>
          </div>
        </div>

        {/* Hạn mức + tiến độ dùng */}
        <div className="rounded-xl bg-canvas p-4 space-y-2">
          <div className="flex items-end justify-between gap-3 flex-wrap">
            <div>
              <p className="text-[11px] text-muted uppercase tracking-wider">Còn lại</p>
              <p className="text-2xl font-bold text-gold">{formatNumber(voucher.remaining)} đ</p>
            </div>
            <p className="text-xs text-muted">
              Đã dùng {formatNumber(used)} / {formatNumber(total)} đ
            </p>
          </div>
          <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
            <div className="h-full bg-gold transition-all" style={{ width: `${usedPct}%` }} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <Row label="Hạn sử dụng"
            value={`${formatDate(voucher.validFrom)} — ${formatDate(voucher.validTo)}`} />
          <Row label="Người tạo" value={voucher.createdByName} />
          <Row label="Ngày tạo" value={formatDate(voucher.createdAt)} />
          <Row label="Điều kiện áp dụng" value={<ScopeText v={voucher} />} />
          {voucher.note && <Row label="Ghi chú" value={voucher.note} />}
        </div>
      </div>

      {/* Lịch sử sử dụng */}
      <div className="bg-surface rounded-2xl border border-hairline shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-hairline flex items-center justify-between">
          <h2 className="font-bold text-ink text-sm flex items-center gap-2">
            <Clock size={15} className="text-muted" /> Lịch sử sử dụng
          </h2>
          <span className="text-xs text-muted">{usages.length} lần</span>
        </div>

        {usages.length === 0 ? (
          <EmptyState icon={Receipt} title="Voucher chưa được sử dụng"
            description="Khi voucher được dùng để thanh toán đơn hàng, các lần dùng sẽ hiện ở đây." />
        ) : (
          <div className="divide-y divide-hairline">
            {usages.map((u, i) => (
              <div key={i}
                onClick={() => u.orderId && navigate(`${base}/orders?keyword=${u.orderCode || ''}`)}
                className={`px-5 py-3.5 flex items-center justify-between gap-3 flex-wrap
                  ${u.orderId ? 'hover:bg-canvas cursor-pointer transition-colors' : ''}`}>
                <div className="min-w-0">
                  <p className="font-mono font-bold text-ink text-sm">{u.orderCode || `Đơn #${u.orderId}`}</p>
                  <p className="text-[11px] text-muted mt-0.5">
                    {u.usedByName || '—'} · {formatDateTime(u.createdAt)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-gold">− {formatNumber(u.amount)} đ</p>
                  <p className="text-[11px] text-muted">
                    còn {formatNumber(u.remainingAfter)} đ
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted shrink-0">{label}</span>
      <span className="text-ink font-medium text-right">{value || '—'}</span>
    </div>
  );
}

function ScopeText({ v }) {
  if (v.applyScope === 'ALL' || !v.applyScope) return <>Toàn bộ sản phẩm</>;

  const items = v.applyScope === 'CATEGORY' ? (v.categories || []) : (v.products || []);
  const Icon = v.applyScope === 'CATEGORY' ? Layers : Package;

  return (
    <span className="inline-flex items-center gap-1.5 justify-end flex-wrap">
      <Icon size={12} className="text-muted" />
      {items.length === 0
        ? <span className="text-faint italic">—</span>
        : items.map(i => (
          <span key={i.id}
            className="px-1.5 py-0.5 rounded-md bg-canvas text-[11px] text-ink-2 border border-line-soft">
            {i.name}
          </span>
        ))}
    </span>
  );
}
