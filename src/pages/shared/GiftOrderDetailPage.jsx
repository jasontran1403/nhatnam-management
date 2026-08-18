// src/pages/shared/GiftOrderDetailPage.jsx
import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft, Gift, Package, Building2, User as UserIcon, RefreshCw,
  Warehouse as WarehouseIcon, Phone, Clock, CheckCircle2, XCircle, Truck, FileText,
} from 'lucide-react';
import { giftOrderApi, GIFT_STATUS, GIFT_OCCASION } from '../../api/giftOrderApi';
import { TableSkeleton } from '../../components/ui/Skeleton.jsx';
import useMinLoading from '../../hooks/useMinLoading.js';
import { useToast } from '../../components/common/Toast';
import { EmptyState } from '../../components/ui';
import { formatDate, formatDateTime } from '../../utils/anniversary';

/**
 * CHI TIẾT PHIẾU TẶNG QUÀ + LỊCH SỬ XỬ LÝ.
 *
 * <p>Thay cho modal chi tiết cũ. Một phiếu đi qua nhiều bước (tạo → duyệt → kho nhận →
 * giao xong), mỗi bước có người và thời điểm riêng — nhồi hết vào modal thì phải cuộn
 * trong khung hẹp, và không chia sẻ được đường dẫn khi cần hỏi nhau về một phiếu cụ thể.
 *
 * <p>Đường quay lại suy từ URL hiện tại chứ không hardcode: trang này dùng chung cho
 * {@code /owner}, {@code /admin} và {@code /seller}.
 */
export default function GiftOrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const toast = useToast();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useMinLoading();

  const base = pathname.startsWith('/owner') ? '/owner'
    : pathname.startsWith('/admin') ? '/admin' : '/seller';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await giftOrderApi.getById(id));
    } catch (e) {
      toast(e?.message || 'Không tải được phiếu', 'error');
    } finally { setLoading(false); }
  }, [id, setLoading, toast]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <div className="p-4 sm:p-6 lg:p-8"><TableSkeleton cols={3} rows={6} /></div>;
  }
  if (!data) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <EmptyState icon={Gift} title="Không tìm thấy phiếu tặng quà" />
      </div>
    );
  }

  const isCompany = data.customerType === 'COMPANY';
  const st = GIFT_STATUS[data.status] || GIFT_STATUS.PENDING;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button onClick={() => navigate(`${base}/gift-orders`)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-line
                     text-xs font-semibold text-ink-2 hover:border-gold hover:text-gold transition-colors">
          <ArrowLeft size={14} /> Quay lại danh sách
        </button>
        <button onClick={load}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-line text-xs text-ink-2 hover:border-gold transition-colors">
          <RefreshCw size={13} /> Làm mới
        </button>
      </div>

      {/* Tóm tắt */}
      <div className="bg-surface rounded-2xl border border-hairline shadow-sm p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Gift size={18} className="text-gold" />
              <h1 className="font-mono font-bold text-ink text-lg">{data.code}</h1>
              <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${st.cls}`}>
                {st.label}
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-canvas text-muted border border-line-soft">
                {GIFT_OCCASION[data.occasion] || data.occasion}
              </span>
            </div>

            <div className="flex items-center gap-1.5 mt-2">
              {isCompany
                ? <Building2 size={13} className="text-blue-500 shrink-0" />
                : <UserIcon size={13} className="text-gold shrink-0" />}
              <span className="text-sm font-semibold text-ink">{data.customerName}</span>
              {data.customerPhone && (
                <a href={`tel:${data.customerPhone}`}
                  className="inline-flex items-center gap-1 text-xs text-muted hover:text-gold">
                  <Phone size={10} /> {data.customerPhone}
                </a>
              )}
            </div>

            <div className="flex items-center gap-3 flex-wrap mt-1.5 text-[11px] text-muted">
              <span className="inline-flex items-center gap-1">
                <WarehouseIcon size={11} /> {data.warehouseName}
              </span>
              {data.warehouseReceiptId && (
                <span className="inline-flex items-center gap-1">
                  <FileText size={11} /> Phiếu xuất #{data.warehouseReceiptId}
                </span>
              )}
            </div>

            {data.note && (
              <p className="mt-2 text-xs text-muted italic">Ghi chú: {data.note}</p>
            )}
          </div>
        </div>
      </div>

      {/* Sản phẩm tặng */}
      <div className="bg-surface rounded-2xl border border-hairline shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-hairline">
          <h2 className="font-bold text-ink text-sm flex items-center gap-2">
            <Package size={15} className="text-muted" /> Sản phẩm tặng
          </h2>
        </div>
        <div className="divide-y divide-hairline">
          {(data.items || []).map((it, i) => (
            <div key={i} className="flex items-center justify-between px-5 py-3">
              <span className="text-sm text-ink truncate">{it.productName}</span>
              <span className="text-sm font-bold text-ink shrink-0">
                {it.quantity} {it.unit || ''}
              </span>
            </div>
          ))}
        </div>
        <div className="px-5 py-3 bg-canvas/60 flex items-center justify-between">
          <span className="text-xs text-muted">Tổng số lượng</span>
          <span className="text-sm font-bold text-ink">{data.totalQuantity}</span>
        </div>
      </div>

      {/* Lịch sử xử lý */}
      <div className="bg-surface rounded-2xl border border-hairline shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-hairline">
          <h2 className="font-bold text-ink text-sm flex items-center gap-2">
            <Clock size={15} className="text-muted" /> Lịch sử xử lý
          </h2>
        </div>
        <div className="p-5">
          <Timeline data={data} />
        </div>
      </div>
    </div>
  );
}

/**
 * Dòng thời gian dựng từ các mốc đã có trên phiếu.
 *
 * <p>Không có bảng log riêng cho phiếu tặng quà — mỗi bước đã lưu sẵn cặp
 * "ai + lúc nào" ngay trên bản ghi (createdBy/approvedBy/handledBy). Dựng lại từ đó
 * đủ dùng và tránh thêm một bảng nữa chỉ để ghi bốn sự kiện cố định.
 */
function Timeline({ data }) {
  const steps = [];

  steps.push({
    icon: Gift, tone: 'gold',
    title: 'Tạo phiếu',
    who: data.createdByName,
    at: data.createdAt,
    done: true,
  });

  if (data.status === 'REJECTED') {
    steps.push({
      icon: XCircle, tone: 'red',
      title: 'Bị từ chối',
      who: data.approvedByName,
      at: data.approvedAt,
      note: data.rejectReason,
      done: true,
    });
  } else {
    steps.push({
      icon: CheckCircle2, tone: 'emerald',
      title: 'Duyệt & xuất kho',
      who: data.approvedByName,
      at: data.approvedAt,
      note: data.approvedAt ? 'Đã trừ tồn kho và sinh phiếu xuất' : null,
      done: !!data.approvedAt,
    });
    steps.push({
      icon: Truck, tone: 'violet',
      title: data.status === 'COMPLETED' ? 'Đã giao xong' : 'Kho xử lý & giao hàng',
      who: data.handledByName,
      at: data.handledAt,
      done: !!data.handledAt,
    });
  }

  const tones = {
    gold: 'bg-gold/15 text-gold',
    emerald: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300',
    violet: 'bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-300',
    red: 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-300',
  };

  return (
    <div className="space-y-0">
      {steps.map((s, i) => {
        const Icon = s.icon;
        const last = i === steps.length - 1;
        return (
          <div key={i} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0
                ${s.done ? tones[s.tone] : 'bg-canvas text-faint'}`}>
                <Icon size={15} />
              </div>
              {!last && (
                <div className={`w-px flex-1 min-h-[28px] ${s.done ? 'bg-line' : 'bg-hairline'}`} />
              )}
            </div>
            <div className={`pb-5 min-w-0 ${last ? 'pb-0' : ''}`}>
              <p className={`text-sm font-semibold ${s.done ? 'text-ink' : 'text-faint'}`}>
                {s.title}
              </p>
              {s.done ? (
                <>
                  <p className="text-[11px] text-muted mt-0.5">
                    {s.who || '—'} · {formatDateTime(s.at)}
                  </p>
                  {s.note && (
                    <p className="text-[11px] text-muted italic mt-0.5">{s.note}</p>
                  )}
                </>
              ) : (
                <p className="text-[11px] text-faint mt-0.5">Chưa thực hiện</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
