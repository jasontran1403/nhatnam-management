// src/pages/warehouse/WarehouseGiftQueuePage.jsx
import { useCallback, useEffect, useState } from 'react';
import {
  Gift, RefreshCw, Truck, CheckCircle2, Package, Building2,
  User as UserIcon, Warehouse as WarehouseIcon, Phone,
} from 'lucide-react';
import { giftOrderApi, GIFT_OCCASION } from '../../api/giftOrderApi';
import { TableSkeleton } from '../../components/ui/Skeleton.jsx';
import useMinLoading from '../../hooks/useMinLoading.js';
import { useToast } from '../../components/common/Toast';
import { PageHeader, EmptyState } from '../../components/ui';
import { formatDateTime } from '../../utils/anniversary';

/**
 * PHIẾU TẶNG QUÀ CHỜ KHO XỬ LÝ.
 *
 * <p>Chỉ hiện phiếu ĐÃ ĐƯỢC DUYỆT — tồn kho đã bị trừ và phiếu xuất kho đã tồn tại, nên
 * nhân viên kho chỉ việc soạn hàng và giao. Phiếu chưa duyệt không xuất hiện ở đây để
 * kho không soạn nhầm hàng cho phiếu có thể bị từ chối.
 *
 * <p>Danh sách giới hạn trong các kho nhân viên được phân công (backend lọc theo token).
 */
export default function WarehouseGiftQueuePage() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useMinLoading();
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await giftOrderApi.warehouseQueue() || []);
    } catch (e) {
      toast(e?.message || 'Không tải được danh sách phiếu tặng', 'error');
    } finally { setLoading(false); }
  }, [setLoading, toast]);

  useEffect(() => { load(); }, [load]);

  const act = async (g, fn, msg) => {
    setBusyId(g.id);
    try {
      await fn(g.id);
      toast(msg, 'success');
      await load();
    } catch (e) {
      toast(e?.message || 'Thao tác thất bại', 'error');
    } finally { setBusyId(null); }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5">
      <PageHeader
        icon={Gift}
        title="Phiếu tặng quà"
        subtitle={`${rows.length} phiếu cần xử lý`}
        action={
          <button onClick={load}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-line text-xs text-ink-2 hover:border-gold transition-colors">
            <RefreshCw size={13} /> Làm mới
          </button>
        }
      />

      <div className="bg-surface rounded-2xl border border-hairline shadow-sm overflow-hidden">
        {loading ? (
          <TableSkeleton cols={4} rows={5} />
        ) : rows.length === 0 ? (
          <EmptyState icon={Gift} title="Không có phiếu tặng nào chờ xử lý"
            description="Phiếu sẽ xuất hiện ở đây sau khi quản lý duyệt." />
        ) : (
          <div className="divide-y divide-hairline">
            {rows.map(g => (
              <div key={g.id}
                className={`p-4 ${g.status === 'DELIVERING'
                  ? 'bg-violet-50/60 dark:bg-violet-500/10' : ''}`}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-ink text-sm">{g.code}</span>
                      <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold
                        ${g.status === 'DELIVERING'
                          ? 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300'}`}>
                        {g.status === 'DELIVERING' ? 'Đang giao' : 'Chờ soạn hàng'}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-canvas text-muted border border-line-soft">
                        {GIFT_OCCASION[g.occasion] || g.occasion}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 mt-1.5">
                      {g.customerType === 'COMPANY'
                        ? <Building2 size={12} className="text-blue-500 shrink-0" />
                        : <UserIcon size={12} className="text-gold shrink-0" />}
                      <span className="text-sm text-ink font-medium truncate">{g.customerName}</span>
                      {g.customerPhone && (
                        <a href={`tel:${g.customerPhone}`}
                          className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-gold">
                          <Phone size={10} /> {g.customerPhone}
                        </a>
                      )}
                    </div>

                    <div className="flex items-center gap-3 flex-wrap mt-1.5 text-[11px] text-muted">
                      <span className="inline-flex items-center gap-1">
                        <WarehouseIcon size={10} /> {g.warehouseName}
                      </span>
                      <span>Seller: {g.createdByName}</span>
                      {g.approvedAt && <span>Duyệt {formatDateTime(g.approvedAt)}</span>}
                    </div>

                    {/* Danh sách hàng cần soạn — tên, số lượng, ĐVT. Không có giá. */}
                    <div className="mt-2 rounded-xl border border-line-soft divide-y divide-hairline">
                      {(g.items || []).map((it, i) => (
                        <div key={i} className="flex items-center justify-between px-3 py-1.5">
                          <span className="text-xs text-ink truncate flex items-center gap-1.5">
                            <Package size={11} className="text-muted shrink-0" />
                            {it.productName}
                          </span>
                          <span className="text-xs font-bold text-ink shrink-0">
                            {it.quantity} {it.unit || ''}
                          </span>
                        </div>
                      ))}
                    </div>

                    {g.note && (
                      <p className="mt-1.5 text-[11px] text-muted italic">Ghi chú: {g.note}</p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 shrink-0">
                    {g.status === 'APPROVED' && (
                      <button onClick={() => act(g, giftOrderApi.startDelivery, 'Đã chuyển đi giao')}
                        disabled={busyId === g.id}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold
                                   bg-gold text-white hover:bg-gold-deep disabled:opacity-50 transition-colors">
                        <Truck size={13} /> Xác nhận & giao
                      </button>
                    )}
                    <button onClick={() => act(g, giftOrderApi.complete, 'Đã hoàn thành')}
                      disabled={busyId === g.id}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold
                                 border border-emerald-200 dark:border-emerald-500/30
                                 text-emerald-600 dark:text-emerald-300
                                 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 disabled:opacity-50 transition-colors">
                      <CheckCircle2 size={13} /> Đã giao xong
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
