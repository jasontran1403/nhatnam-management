// src/pages/shared/GiftOrdersPage.jsx
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Gift, Search, RefreshCw, Check, XCircle, Package, AlertTriangle,
  Building2, User as UserIcon, Warehouse as WarehouseIcon, Truck, CheckCircle2,
} from 'lucide-react';
import { giftOrderApi, GIFT_STATUS, GIFT_OCCASION } from '../../api/giftOrderApi';
import Modal from '../../components/ui/Modal';
import Pagination from '../../components/ui/Pagination';
import { TableSkeleton } from '../../components/ui/Skeleton.jsx';
import useMinLoading from '../../hooks/useMinLoading.js';
import useDebounce from '../../utils/useDebounce.js';
import { useToast } from '../../components/common/Toast';
import {
  PageHeader, EmptyState, SecondaryButton, DangerButton, inputCls, formatNumber,
} from '../../components/ui';
import { formatDate, formatDateTime } from '../../utils/anniversary';

/**
 * PHIẾU TẶNG QUÀ BẰNG SẢN PHẨM — màn hình duyệt (OWNER/ADMIN) và theo dõi (SELLER).
 *
 * <p>Trước khi duyệt, hệ thống kiểm tồn kho và hiện danh sách thiếu hụt nếu có. Đây là
 * bước bắt buộc vì phiếu được tạo mà KHÔNG giữ hàng — giữa lúc seller tạo và lúc quản lý
 * duyệt, đơn bán khác có thể đã lấy mất tồn.
 *
 * @param canApprove true = OWNER/ADMIN (duyệt/từ chối); false = SELLER (chỉ xem và huỷ)
 */
export default function GiftOrdersPage({ canApprove = true }) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const debouncedQ = useDebounce(q, 500);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(0);
  const [data, setData] = useState({ content: [], totalPages: 0, totalElements: 0 });
  const [loading, setLoading] = useMinLoading();

  const navigate = useNavigate();
  const { pathname } = useLocation();
  // Trang này mount ở cả /owner, /admin và /seller nên đường dẫn con phải suy từ URL.
  const base = pathname.startsWith('/owner') ? '/owner'
    : pathname.startsWith('/admin') ? '/admin' : '/seller';
  const [approveTarget, setApproveTarget] = useState(null);
  const [stockCheck, setStockCheck] = useState(null);
  const [checking, setChecking] = useState(false);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await giftOrderApi.list({
        q: debouncedQ || undefined,
        status: status || undefined,
        page, size: 20,
      }) || { content: [] });
    } catch (e) {
      toast(e?.message || 'Không tải được danh sách phiếu', 'error');
    } finally { setLoading(false); }
  }, [debouncedQ, status, page, setLoading, toast]);

  useEffect(() => { load(); }, [load]);

  /** Mở hộp thoại duyệt và kiểm tồn ngay — quản lý thấy cảnh báo trước khi bấm. */
  const openApprove = async (g) => {
    setApproveTarget(g);
    setStockCheck(null);
    setChecking(true);
    try {
      setStockCheck(await giftOrderApi.stockCheck(g.id));
    } catch (e) {
      toast(e?.message || 'Không kiểm tra được tồn kho', 'error');
    } finally { setChecking(false); }
  };

  const handleApprove = async () => {
    setBusy(true);
    try {
      await giftOrderApi.approve(approveTarget.id);
      toast('Đã duyệt phiếu và xuất kho', 'success');
      setApproveTarget(null); load();
    } catch (e) {
      toast(e?.message || 'Duyệt thất bại', 'error');
    } finally { setBusy(false); }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) { toast('Vui lòng nhập lý do từ chối', 'error'); return; }
    setBusy(true);
    try {
      await giftOrderApi.reject(rejectTarget.id, rejectReason.trim());
      toast('Đã từ chối phiếu', 'success');
      setRejectTarget(null); setRejectReason(''); load();
    } catch (e) {
      toast(e?.message || 'Thao tác thất bại', 'error');
    } finally { setBusy(false); }
  };

  const handleCancel = async (g) => {
    try {
      await giftOrderApi.cancel(g.id);
      toast('Đã huỷ phiếu', 'success');
      load();
    } catch (e) { toast(e?.message || 'Huỷ thất bại', 'error'); }
  };

  const rows = data.content || [];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5">
      <PageHeader
        icon={Gift}
        title="Phiếu tặng quà"
        subtitle={`${formatNumber(data.totalElements || 0)} phiếu`}
        action={
          <button onClick={load}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-line text-xs text-ink-2 hover:border-gold transition-colors">
            <RefreshCw size={13} /> Làm mới
          </button>
        }
      />

      <div className="bg-surface rounded-2xl border border-hairline p-3 sm:p-4 shadow-sm
                      flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
          <input value={q} onChange={e => { setQ(e.target.value); setPage(0); }}
            placeholder="Tìm mã phiếu, tên khách, SĐT..." className={`${inputCls} pl-9`} />
        </div>
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(0); }}
          className={`${inputCls} sm:w-44`}>
          <option value="">Tất cả trạng thái</option>
          {Object.entries(GIFT_STATUS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      <div className="bg-surface rounded-2xl border border-hairline shadow-sm overflow-hidden">
        {loading ? (
          <TableSkeleton cols={5} rows={6} />
        ) : rows.length === 0 ? (
          <EmptyState icon={Gift} title="Chưa có phiếu tặng quà nào"
            description="Seller tạo phiếu từ màn hình Khách hàng khi khách tới sinh nhật hoặc khai trương." />
        ) : (
          <div className="divide-y divide-hairline">
            {rows.map(g => (
              <div key={g.id}
                onClick={() => navigate(`${base}/gift-orders/${g.id}`)}
                className="p-4 hover:bg-canvas/50 transition-colors cursor-pointer">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-ink text-sm">{g.code}</span>
                      <StatusBadge status={g.status} />
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
                        <span className="text-[11px] text-muted">· {g.customerPhone}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 flex-wrap mt-1.5 text-[11px] text-muted">
                      <span className="inline-flex items-center gap-1">
                        <WarehouseIcon size={10} /> {g.warehouseName}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Package size={10} /> {g.items?.length || 0} loại · SL {g.totalQuantity}
                      </span>
                      <span>Tạo bởi {g.createdByName} · {formatDate(g.createdAt)}</span>
                    </div>

                    {/* Dòng sản phẩm — tên, ĐVT, số lượng. Cố ý không có giá. */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {(g.items || []).slice(0, 4).map((it, idx) => (
                        <span key={idx}
                          className="px-2 py-0.5 rounded-lg bg-canvas border border-line-soft text-[11px] text-ink-2">
                          {it.productName} × {it.quantity} {it.unit || ''}
                        </span>
                      ))}
                      {(g.items?.length || 0) > 4 && (
                        <span className="text-[11px] text-faint self-center">
                          +{g.items.length - 4} sản phẩm
                        </span>
                      )}
                    </div>

                    {g.status === 'REJECTED' && g.rejectReason && (
                      <p className="mt-2 text-[11px] text-red-600 dark:text-red-300">
                        Lý do từ chối: {g.rejectReason}
                      </p>
                    )}
                    {g.approvedAt && g.status !== 'REJECTED' && (
                      <p className="mt-1.5 text-[11px] text-emerald-600 dark:text-emerald-300">
                        Duyệt bởi {g.approvedByName} lúc {formatDateTime(g.approvedAt)}
                      </p>
                    )}
                    {g.handledAt && (
                      <p className="mt-0.5 text-[11px] text-violet-600 dark:text-violet-300">
                        Kho xử lý: {g.handledByName} · {formatDateTime(g.handledAt)}
                      </p>
                    )}
                  </div>

                  {/* stopPropagation: nếu không, bấm Duyệt/Từ chối sẽ kéo theo click của
                      cả hàng và người dùng bị đẩy sang trang chi tiết giữa chừng. */}
                  <div className="flex items-center gap-2 shrink-0"
                    onClick={(e) => e.stopPropagation()}>
                    <SecondaryButton
                      onClick={() => navigate(`${base}/gift-orders/${g.id}`)}
                      className="text-xs">
                      Chi tiết
                    </SecondaryButton>
                    {canApprove && g.status === 'PENDING' && (
                      <>
                        <button onClick={() => openApprove(g)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                                     bg-emerald-500 text-white hover:bg-emerald-600 transition-colors">
                          <Check size={13} /> Duyệt
                        </button>
                        <button onClick={() => { setRejectTarget(g); setRejectReason(''); }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                                     border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-300
                                     hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                          <XCircle size={13} /> Từ chối
                        </button>
                      </>
                    )}
                    {!canApprove && g.status === 'PENDING' && (
                      <SecondaryButton onClick={() => handleCancel(g)} className="text-xs">
                        Huỷ phiếu
                      </SecondaryButton>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {data.totalPages > 1 && (
        <Pagination page={page} totalPages={data.totalPages} onChange={setPage} />
      )}

      {/* Duyệt + kiểm tồn */}
      <Modal open={!!approveTarget} onClose={() => setApproveTarget(null)}
        title="Duyệt phiếu tặng quà" size="md">
        {approveTarget && (
          <div className="space-y-4">
            <p className="text-sm text-ink-2">
              Duyệt phiếu <span className="font-mono font-bold text-ink">{approveTarget.code}</span> tặng{' '}
              <strong className="text-ink">{approveTarget.customerName}</strong>?
            </p>

            {checking ? (
              <p className="text-xs text-muted italic">Đang kiểm tra tồn kho...</p>
            ) : stockCheck && !stockCheck.ok ? (
              <div className="rounded-xl border border-red-200 dark:border-red-500/30
                              bg-red-50 dark:bg-red-500/10 p-3 space-y-2">
                <p className="flex items-center gap-1.5 text-xs font-bold text-red-700 dark:text-red-300">
                  <AlertTriangle size={14} /> Không đủ tồn kho — cần nhập thêm
                </p>
                {(stockCheck.shortages || []).map((s, i) => (
                  <div key={i} className="text-[11px] text-red-700 dark:text-red-300">
                    <span className="font-semibold">{s.ingredientName}</span>
                    {' '}· cần {s.required} {s.unit || ''}, còn {s.available} → thiếu{' '}
                    <strong>{s.missing} {s.unit || ''}</strong>
                    <span className="text-red-500/70 dark:text-red-300/60"> (cho {s.productName})</span>
                  </div>
                ))}
                <p className="text-[10px] text-red-600/80 dark:text-red-300/70 pt-1">
                  Phiếu chưa được duyệt và tồn kho chưa bị trừ. Hãy nhập kho rồi duyệt lại.
                </p>
              </div>
            ) : stockCheck?.ok ? (
              <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/30
                              bg-emerald-50 dark:bg-emerald-500/10 p-3">
                <p className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 size={14} /> Tồn kho đủ để xuất
                </p>
                <p className="text-[10px] text-emerald-600/80 dark:text-emerald-300/70 mt-1">
                  Khi duyệt, hệ thống sẽ trừ kho và tạo phiếu xuất với lý do
                  "Tặng quà cho {approveTarget.customerName}".
                </p>
              </div>
            ) : null}

            <div className="flex gap-2">
              <SecondaryButton onClick={() => setApproveTarget(null)} className="flex-1">
                Huỷ
              </SecondaryButton>
              <button onClick={handleApprove}
                disabled={busy || checking || (stockCheck && !stockCheck.ok)}
                className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-semibold
                           hover:bg-emerald-600 disabled:opacity-40 transition-colors">
                {busy ? 'Đang duyệt...' : 'Duyệt & xuất kho'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Từ chối */}
      <Modal open={!!rejectTarget} onClose={() => setRejectTarget(null)}
        title="Từ chối phiếu" size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1.5">
              Lý do từ chối *
            </label>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              rows={3} placeholder="Seller sẽ đọc được lý do này"
              className={`${inputCls} resize-none`} />
          </div>
          <div className="flex gap-2">
            <SecondaryButton onClick={() => setRejectTarget(null)} className="flex-1">Huỷ</SecondaryButton>
            <DangerButton onClick={handleReject} disabled={busy} className="flex-1">
              {busy ? 'Đang xử lý...' : 'Từ chối'}
            </DangerButton>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function StatusBadge({ status }) {
  const s = GIFT_STATUS[status] || GIFT_STATUS.PENDING;
  return (
    <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${s.cls}`}>{s.label}</span>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-muted shrink-0">{label}</span>
      <span className="text-ink font-medium text-right">{value || '—'}</span>
    </div>
  );
}
