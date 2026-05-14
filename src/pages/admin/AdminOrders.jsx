import { useEffect, useState, useCallback } from 'react';
import {
  ShoppingCart, Search, Eye, Ban, Package,
  Building2, Calendar, CreditCard, History,
  CheckCircle2, Truck, Clock, XCircle, DollarSign,
  TimerReset, User,
  Download,
} from 'lucide-react';
import { adminOrderApi, getImageUrl } from '../../api/adminApi';
import { downloadBlob } from '../../api/services';
import { OrderStatusBadge } from '../../components/admin/Badge';
import Modal from '../../components/admin/Modal';
import Pagination from '../../components/admin/Pagination';
import useDebounce from '../../utils/useDebounce';
import {
  PageHeader, LoadingSpinner, EmptyState,
  SecondaryButton, DangerButton,
  Field, inputCls, formatCurrency, formatNumber, formatDateTime,
} from '../../components/admin/ui';

const STATUS_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'PREPARING', label: 'Đang chuẩn bị' },
  { value: 'DELIVERING', label: 'Đang giao' },
  { value: 'PENDING_PAYMENT', label: 'Chờ thanh toán' },
  { value: 'COMPLETED', label: 'Hoàn thành' },
  { value: 'CANCELLED', label: 'Đã hủy' },
];

const PAYMENT_METHOD_LABELS = {
  CASH: '💵 Tiền mặt',
  BANK_TRANSFER: '🏦 Chuyển khoản',
  DEBT: '📋 Công nợ',
};

function formatLogNote(note) {
  if (!note) return '—';
  return note
    .replace('Đổi sang: CASH', 'Đổi sang: Tiền mặt')
    .replace('Đổi sang: BANK_TRANSFER', 'Đổi sang: Chuyển khoản')
    .replace('Đổi sang: DEBT', 'Đổi sang: Công nợ');
}

const LOG_CONFIG = {
  CREATED: { label: 'Tạo đơn hàng', icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  DELIVERING: { label: 'Bắt đầu giao hàng', icon: Truck, color: 'text-purple-600 bg-purple-50 border-purple-200' },
  PENDING_PAYMENT: { label: 'Chờ thanh toán', icon: Clock, color: 'text-orange-600 bg-orange-50 border-orange-200' },
  COMPLETED: { label: 'Hoàn thành đơn', icon: CheckCircle2, color: 'text-teal-600 bg-teal-50 border-teal-200' },
  CANCELLED: { label: 'Hủy đơn hàng', icon: XCircle, color: 'text-red-600 bg-red-50 border-red-200' },
  PAYMENT_METHOD_UPDATED: { label: 'Đổi phương thức TT', icon: DollarSign, color: 'text-blue-600 bg-blue-50 border-blue-200' },
  DEADLINE_EXTENDED: { label: 'Gia hạn công nợ', icon: TimerReset, color: 'text-amber-600 bg-amber-50 border-amber-200' },
  PARTIAL_PAYMENT: { label: 'Thu tiền một phần', icon: DollarSign, color: 'text-indigo-600 bg-indigo-50 border-indigo-200' }, // ← thêm
  FULLY_PAID: { label: 'Thanh toán đủ', icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' }, // ← thêm
};

const ROLE_LABELS = {
  SELLER: 'Bán hàng',
  WAREHOUSE: 'Kho',
  ACCOUNTANT: 'Kế toán',
  ADMIN: 'Admin',
};

// ── Seller badge ──────────────────────────────────────────────────────────────
function SellerBadge({ name }) {
  if (!name) return <span className="text-[#C4B9A8] text-xs">—</span>;
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="w-full h-6 px-2 rounded-full bg-[#C9A84C]/20 text-[#C9A84C] text-[10px] font-bold flex items-center justify-center shrink-0">
        {name}
      </span>
    </span>
  );
}

export default function AdminOrders() {
  const [filters, setFilters] = useState({ q: '', status: '' });
  const [page, setPage] = useState(0);
  const [data, setData] = useState({ content: [], totalPages: 0, totalElements: 0 });
  const [loading, setLoading] = useState(true);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailOrder, setDetailOrder] = useState(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = {};
      if (filters.status) params.status = filters.status;
      if (debouncedQ) params.q = debouncedQ;
      const res = await adminOrderApi.exportOrders(params);
      downloadBlob(res.data, `don-hang-admin-${new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')}.xlsx`);
    } catch {
      alert('Không thể xuất file Excel');
    } finally {
      setExporting(false);
    }
  };

  const debouncedQ = useDebounce(filters.q, 600);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, size: 20, sort: 'createdAt,desc' };
      if (debouncedQ) params.q = debouncedQ;
      if (filters.status) params.status = filters.status;
      const res = await adminOrderApi.list(params);
      setData(res);
    } finally { setLoading(false); }
  }, [page, debouncedQ, filters.status]);

  useEffect(() => { load(); }, [load]);

  const openDetail = async (id) => {
    try {
      const order = await adminOrderApi.getById(id);
      setDetailOrder(order);
      setDetailOpen(true);
    } catch { alert('Lỗi tải chi tiết'); }
  };

  const openCancel = (order) => {
    setCancelTarget(order);
    setCancelReason('');
    setCancelOpen(true);
  };

  const confirmCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await adminOrderApi.cancel(cancelTarget.id, cancelReason);
      setCancelOpen(false);
      if (detailOpen && detailOrder?.id === cancelTarget.id) setDetailOpen(false);
      load();
    } catch (e) {
      alert(e?.response?.data?.message || e.message || 'Hủy đơn thất bại');
    } finally { setCancelling(false); }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5">
      <PageHeader icon={ShoppingCart} title="Đơn hàng" subtitle={`Tổng ${formatNumber(data.totalElements)} đơn`} />

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-black/5 p-3 sm:p-4 shadow-sm flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8878]" size={16} />
          <input type="text" placeholder="Tìm theo mã đơn, tên khách, SĐT..."
            value={filters.q}
            onChange={e => { setFilters({ ...filters, q: e.target.value }); setPage(0); }}
            className={`${inputCls} pl-9`} />
        </div>
        <select value={filters.status}
          onChange={e => { setFilters({ ...filters, status: e.target.value }); setPage(0); }}
          className={`${inputCls} sm:w-52`}>
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <button onClick={handleExport} disabled={exporting}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200
    hover:bg-emerald-100 transition-colors disabled:opacity-60 text-sm font-medium whitespace-nowrap"
          title="Xuất Excel">
          {exporting
            ? <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
            : <Download size={15} />}
          Xuất Excel
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
        {loading ? <LoadingSpinner /> : data.content.length === 0 ? (
          <EmptyState icon={ShoppingCart} title="Không có đơn hàng" description="Thử điều chỉnh bộ lọc" />
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#FAF7F2] text-[#8E8878]">
                    <th className="px-4 py-3 text-left   text-xs font-bold uppercase tracking-wider">Mã đơn</th>
                    <th className="px-4 py-3 text-left   text-xs font-bold uppercase tracking-wider">Khách hàng</th>
                    <th className="px-4 py-3 text-left   text-xs font-bold uppercase tracking-wider">Seller</th>
                    <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider">Tổng tiền</th>
                    <th className="px-4 py-3 text-left   text-xs font-bold uppercase tracking-wider">Trạng thái</th>
                    <th className="px-4 py-3 text-left   text-xs font-bold uppercase tracking-wider">TT</th>
                    <th className="px-4 py-3 text-left   text-xs font-bold uppercase tracking-wider whitespace-nowrap">Ngày tạo</th>
                    <th className="px-4 py-3 w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {data.content.map(o => (
                    <tr key={o.id} className={`border-t border-black/5 hover:bg-[#FAF7F2]/50 transition-colors ${o.status === 'CANCELLED' ? 'opacity-60' : ''}`}>
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-[#C9A84C] whitespace-nowrap">{o.orderCode}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-[#1C1C1E]">{o.customerName || '—'}</p>
                        {o.customerPhone && <p className="text-xs text-[#8E8878]">{o.customerPhone}</p>}
                      </td>
                      {/* ← fullName dưới dạng badge */}
                      <td className="px-4 py-3"><SellerBadge name={o.fullName || o.userName} /></td>
                      {/* ← canh giữa */}
                      <td className="px-4 py-3 text-center font-semibold text-[#1C1C1E]">{formatCurrency(o.finalAmount)}</td>
                      <td className="px-4 py-3"><OrderStatusBadge status={o.status} /></td>
                      <td className="px-4 py-3">
                        <PaymentStatusBadge status={o.paymentStatus} paidAmount={o.paidAmount} finalAmount={o.finalAmount} orderStatus={o.status} />
                      </td>
                      <td className="px-4 py-3 text-xs text-[#8E8878] whitespace-nowrap">{formatDateTime(o.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openDetail(o.id)}
                            className="p-2 rounded-lg text-[#8E8878] hover:bg-[#FAF7F2] hover:text-[#1C1C1E] transition-colors" title="Xem chi tiết">
                            <Eye size={15} />
                          </button>
                          {o.status !== 'CANCELLED' && o.status !== 'COMPLETED' && (
                            <button onClick={() => openCancel(o)}
                              className="p-2 rounded-lg text-[#8E8878] hover:bg-red-50 hover:text-red-600 transition-colors" title="Hủy đơn">
                              <Ban size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards — layout mới */}
            <div className="lg:hidden divide-y divide-black/5">
              {data.content.map(o => (
                <div key={o.id} className={`p-4 space-y-2.5 ${o.status === 'CANCELLED' ? 'opacity-60' : ''}`}>

                  {/* Row 1: mã đơn + ngày tạo */}
                  <div className="flex items-center justify-between">
                    <p className="font-mono text-xs font-semibold text-[#C9A84C]">{o.orderCode}</p>
                    <p className="text-[10px] text-[#8E8878]">{formatDateTime(o.createdAt)}</p>
                  </div>

                  {/* Row 2: tên khách hàng — full wrap */}
                  <p className="font-semibold text-[#1C1C1E] leading-snug">{o.customerName || '—'}</p>

                  {/* Row 3: SĐT khách */}
                  {o.customerPhone && (
                    <p className="text-xs text-[#8E8878]">📞 {o.customerPhone}</p>
                  )}

                  {/* Row 4: Seller badge */}
                  <div className="flex items-center gap-1.5">
                    <User size={11} className="text-[#8E8878]" />
                    <SellerBadge name={o.fullName || o.userName} />
                  </div>

                  {/* Row 5: badges */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <OrderStatusBadge status={o.status} />
                    <PaymentStatusBadge status={o.paymentStatus} paidAmount={o.paidAmount} finalAmount={o.finalAmount} orderStatus={o.status} />
                  </div>

                  {/* Row 6: tổng tiền + actions */}
                  <div className="flex items-center justify-between pt-1 border-t border-black/5">
                    <p className="font-bold text-[#1C1C1E]">{formatCurrency(o.finalAmount)}</p>
                    <div className="flex gap-1.5">
                      <button onClick={() => openDetail(o.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#FAF7F2] text-[#1C1C1E]">
                        Chi tiết
                      </button>
                      {o.status !== 'CANCELLED' && o.status !== 'COMPLETED' && (
                        <button onClick={() => openCancel(o)}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-600">
                          Hủy
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        {!loading && data.content.length > 0 && <Pagination page={page} totalPages={data.totalPages} onChange={setPage} />}
      </div>

      {/* Detail modal */}
      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title="Chi tiết đơn hàng" size="xl"
        footer={
          <div className="flex justify-end gap-2">
            {detailOrder && detailOrder.status !== 'CANCELLED' && detailOrder.status !== 'COMPLETED' && (
              <DangerButton onClick={() => openCancel(detailOrder)}><Ban size={14} /> Hủy đơn này</DangerButton>
            )}
            <SecondaryButton onClick={() => setDetailOpen(false)}>Đóng</SecondaryButton>
          </div>
        }
      >
        {detailOrder && (
          <div className="max-h-[70vh] overflow-y-auto pr-1">
            <OrderDetail order={detailOrder} />
          </div>
        )}
      </Modal>

      {/* Cancel modal */}
      <Modal open={cancelOpen} onClose={() => !cancelling && setCancelOpen(false)} title="Hủy đơn hàng" size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <SecondaryButton onClick={() => setCancelOpen(false)} disabled={cancelling}>Không</SecondaryButton>
            <DangerButton onClick={confirmCancel} loading={cancelling}>Xác nhận hủy</DangerButton>
          </div>
        }
      >
        <p className="text-sm text-[#1C1C1E]">
          Bạn có chắc muốn hủy đơn <span className="font-semibold text-[#C9A84C]">{cancelTarget?.orderCode}</span>?
        </p>
        <p className="text-xs text-[#8E8878] mt-1">Đơn sẽ lưu lại với trạng thái "Đã hủy".</p>
        <div className="mt-4">
          <Field label="Lý do hủy" hint="Không bắt buộc">
            <textarea rows={3} value={cancelReason} onChange={e => setCancelReason(e.target.value)}
              placeholder="VD: Khách đổi ý, hết hàng, ..." className={inputCls} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}

// ── OrderDetail ───────────────────────────────────────────────────────────────
function OrderDetail({ order }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm font-bold text-[#C9A84C]">{order.orderCode}</span>
        <OrderStatusBadge status={order.status} />
        <PaymentStatusBadge status={order.paymentStatus} paidAmount={order.paidAmount} finalAmount={order.finalAmount} orderStatus={order.status} />
        {order.paymentMethod && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-50 text-slate-700 ring-1 ring-slate-200">
            <CreditCard size={11} />
            {PAYMENT_METHOD_LABELS[order.paymentMethod] || order.paymentMethod}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InfoBlock icon={Building2} title="Thông tin khách">
          <Line label="Tên" value={order.customerName || '—'} />
          <Line label="SĐT" value={order.customerPhone || '—'} />
          <Line label="Email" value={order.customerEmail || '—'} />
          <Line label="Loại" value={order.customerType || '—'} />
          {order.companyName && <Line label="Công ty" value={order.companyName} />}
          {order.taxCode && <Line label="MST" value={order.taxCode} />}
          {order.companyAddress && <Line label="Địa chỉ cty" value={order.companyAddress} />}
          {order.contactName && <Line label="Người liên hệ" value={order.contactName} />}
        </InfoBlock>
        <InfoBlock icon={Calendar} title="Giao hàng & Meta">
          {/* ← fullName thay vì userName */}
          <Line label="Seller" value={<SellerBadge name={order.fullName || order.userName} />} />
          <Line label="Kho" value={order.warehouseName || '—'} />
          <Line label="Địa chỉ nhận" value={order.shippingAddress || order.deliveryAddress || '—'} />
          <Line label="Người đặt" value={order.orderedByName || '—'} />
          <Line label="Ngày tạo" value={formatDateTime(order.createdAt)} />
          <Line label="Cập nhật" value={formatDateTime(order.updatedAt)} />
        </InfoBlock>
      </div>

      <div>
        <h4 className="text-xs font-semibold text-[#1C1C1E] uppercase tracking-wider mb-2">
          Sản phẩm ({order.items?.length || 0})
        </h4>
        <div className="border border-black/5 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#FAF7F2] text-[#8E8878]">
                <th className="px-3 py-2 text-left  font-semibold text-xs">Sản phẩm</th>
                <th className="px-3 py-2 text-right font-semibold text-xs">SL</th>
                <th className="px-3 py-2 text-right font-semibold text-xs">Đơn giá</th>
                <th className="px-3 py-2 text-right font-semibold text-xs">Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              {(order.items || []).map(it => (
                <tr key={it.id} className="border-t border-black/5">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {it.productImageUrl ? (
                        <img src={getImageUrl(it.productImageUrl)} alt="" className="w-8 h-8 rounded-lg object-cover border border-black/5" />
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-[#FAF7F2] flex items-center justify-center"><Package size={12} className="text-[#8E8878]" /></div>
                      )}
                      <div>
                        <p className="font-medium text-[#1C1C1E]">{it.productName}</p>
                        {it.tierName && <p className="text-xs text-[#8E8878]">{it.tierName}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">{formatNumber(it.quantity)} {it.unit}</td>
                  <td className="px-3 py-2 text-right">
                    {formatCurrency(
                      (it.discountPercent ?? 0) > 0
                        ? Math.round(Number(it.unitPrice) / (1 - it.discountPercent / 100))
                        : Number(it.unitPrice ?? 0)
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold">
                    {formatCurrency(
                      ((it.discountPercent ?? 0) > 0
                        ? Math.round(Number(it.unitPrice) / (1 - it.discountPercent / 100))
                        : Number(it.unitPrice ?? 0)
                      ) * Number(it.quantity ?? 1)
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-[#FAF7F2] rounded-xl p-4 space-y-1.5 text-sm">
        {/* Tạm tính = Σ(giá tier × qty) */}
        <Row label="Tạm tính" value={formatCurrency(
          (order.items ?? []).reduce((s, it) => {
            const discPct = it.discountPercent ?? 0;
            const tierPrice = discPct > 0
              ? Math.round(Number(it.unitPrice) / (1 - discPct / 100))
              : Number(it.unitPrice ?? 0);
            return s + tierPrice * Number(it.quantity ?? 1);
          }, 0)
        )} />

        {/* Giảm = CK món + giảm bill */}
        {(() => {
          const itemDiscount = (order.items ?? []).reduce((s, it) => {
            const discPct = it.discountPercent ?? 0;
            if (!discPct) return s;
            const tierPrice = Math.round(Number(it.unitPrice) / (1 - discPct / 100));
            return s + tierPrice * (discPct / 100) * Number(it.quantity ?? 1);
          }, 0);
          const billDiscount = Number(order.discountAmount ?? 0);
          const total = itemDiscount + billDiscount;
          if (total <= 0) return null;
          return (
            <>
              <Row label="Giảm" value={'-' + formatCurrency(total)} />
              {itemDiscount > 0 && (
                <div className="flex justify-between text-xs text-[#8E8878] pl-3">
                  <span>• CK món</span>
                  <span>-{formatCurrency(itemDiscount)}</span>
                </div>
              )}
              {billDiscount > 0 && (
                <div className="flex justify-between text-xs text-[#8E8878] pl-3">
                  <span>• Giảm bill ({order.discountRate || 0}%)</span>
                  <span>-{formatCurrency(billDiscount)}</span>
                </div>
              )}
            </>
          );
        })()}

        {order.surcharge > 0 && <Row label="Phụ thu" value={formatCurrency(order.surcharge)} />}

        <div className="border-t border-black/10 pt-2 mt-2">
          <Row label={<span className="font-bold">Tổng cộng</span>}
            value={<span className="font-bold text-[#C9A84C] text-base">{formatCurrency(order.finalAmount)}</span>} />
        </div>

        {/* VAT — chỉ thông tin, có breakdown */}
        {(() => {
          const { groups, total } = buildVatBreakdownFromItems(order.items);
          if (total <= 0) return null;
          return (
            <div className="border-t border-black/5 pt-1.5 mt-1 space-y-0.5">
              <div className="flex justify-between text-xs text-[#C4B9A8]">
                <span>VAT (đã trong giá)</span>
                <span>{formatCurrency(total)}</span>
              </div>
              {groups.map(g => (
                <div key={`${g.rate}-${g.mode}`} className="flex justify-between text-[10px] text-[#C4B9A8] pl-3">
                  <span>• {g.rate}% ({g.mode === 'EXCLUSIVE' ? 'ngoài giá' : 'trong giá'})</span>
                  <span>{g.mode === 'EXCLUSIVE' ? '+' : ''}{formatCurrency(g.amount)}</span>
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      {order.notes && (
        <div>
          <h4 className="text-xs font-semibold text-[#1C1C1E] uppercase tracking-wider mb-1.5">Ghi chú</h4>
          <p className="text-sm text-[#1C1C1E] whitespace-pre-wrap bg-[#FAF7F2] p-3 rounded-xl">{order.notes}</p>
        </div>
      )}

      {order.logs && order.logs.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-[#1C1C1E] uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <History size={13} className="text-[#C9A84C]" /> Lịch sử thao tác
          </h4>
          <div className="hidden sm:block border border-black/5 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#FAF7F2] text-[#8E8878]">
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider">Thao tác</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider">Người thực hiện</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider">Vai trò</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider">Ghi chú</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">Thời gian</th>
                </tr>
              </thead>
              <tbody>
                {order.logs.map((l, idx) => {
                  const cfg = LOG_CONFIG[l.action] || { label: l.action, icon: History, color: 'text-[#8E8878] bg-[#F0EBE3] border-[#E8DDD0]' };
                  const Icon = cfg.icon;
                  return (
                    <tr key={idx} className="border-t border-black/5 hover:bg-[#FAF7F2]/50 transition-colors">
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${cfg.color}`}>
                          <Icon size={9} /> {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs font-medium text-[#1C1C1E]">{l.actorName || '—'}</td>
                      <td className="px-4 py-2.5 text-[10px] text-[#8E8878]">{ROLE_LABELS[l.actorRole] || l.actorRole || '—'}</td>
                      <td className="px-4 py-2.5 text-xs text-[#8E8878] max-w-[180px] truncate">{formatLogNote(l.note)}</td>
                      <td className="px-4 py-2.5 text-xs text-[#8E8878] whitespace-nowrap">{formatDateTime(l.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="sm:hidden space-y-2">
            {order.logs.map((l, idx) => {
              const cfg = LOG_CONFIG[l.action] || { label: l.action, icon: History, color: 'text-[#8E8878] bg-[#F0EBE3] border-[#E8DDD0]' };
              const Icon = cfg.icon;
              return (
                <div key={idx} className="border border-black/5 rounded-xl p-3 space-y-2 bg-white">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${cfg.color}`}>
                      <Icon size={9} /> {cfg.label}
                    </span>
                    <span className="text-[10px] text-[#8E8878] whitespace-nowrap">{formatDateTime(l.createdAt)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-[#1C1C1E]">{l.actorName || '—'}</span>
                    <span className="text-[10px] text-[#8E8878] bg-[#F0EBE3] px-1.5 py-0.5 rounded-full">
                      {ROLE_LABELS[l.actorRole] || l.actorRole || '—'}
                    </span>
                  </div>
                  {l.note && <p className="text-xs text-[#8E8878]">{formatLogNote(l.note)}</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function InfoBlock({ icon: Icon, title, children }) {
  return (
    <div className="border border-black/5 rounded-xl p-4 bg-white">
      <div className="flex items-center gap-2 mb-2 text-[#C9A84C]">
        <Icon size={15} />
        <h4 className="text-xs font-bold uppercase tracking-wider text-[#1C1C1E]">{title}</h4>
      </div>
      <div className="space-y-1.5 text-sm">{children}</div>
    </div>
  );
}

function Line({ label, value }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-[#8E8878] text-xs w-28 flex-shrink-0 mt-0.5">{label}</span>
      <span className="text-[#1C1C1E] flex-1 text-right break-words">{value}</span>
    </div>
  );
}

function buildVatBreakdownFromItems(items) {
  if (!items?.length) return { groups: [], total: 0 };
  const map = {};
  for (const item of items) {
    const rate = item.vatRate ?? 0;
    const mode = item.vatMode ?? 'INCLUSIVE';
    if (rate === 0) continue;
    const amt = Number(item.vatAmount ?? 0);
    const key = `${rate}|${mode}`;
    if (!map[key]) map[key] = { rate, mode, amount: 0 };
    map[key].amount += amt;
  }
  const groups = Object.values(map).sort((a, b) => a.rate - b.rate);
  const total = groups.reduce((s, g) => s + g.amount, 0);
  return { groups, total };
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[#8E8878]">{label}</span>
      <span className="text-[#1C1C1E]">{value}</span>
    </div>
  );
}

function PaymentStatusBadge({ status, paidAmount, finalAmount, orderStatus }) {
  if (orderStatus === 'CANCELLED') {
    return <span className="text-xs text-[#C4B9A8]">—</span>;
  }

  const map = {
    PAID: { label: 'Đã TT', cls: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
    UNPAID: { label: 'Chưa TT', cls: 'text-red-500 bg-red-50 border-red-200' },
    PARTIAL: { label: 'TT 1 phần', cls: 'text-blue-600 bg-blue-50 border-blue-200' },
  };
  const cfg = map[status] || { label: status, cls: 'text-gray-500 bg-gray-50 border-gray-200' };

  if (status === 'PARTIAL' && paidAmount != null && finalAmount != null) {
    const remaining = Number(finalAmount) - Number(paidAmount);
    return (
      <div className="flex flex-col gap-0.5">
        <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${cfg.cls}`}>
          {cfg.label}
        </span>
        <span className={`inline-flex text-[10px] text-emerald-600 whitespace-nowrap items-center font-semibold px-2 py-0.5 rounded-full border ${cfg.cls}`}>
          Đã thu: {new Intl.NumberFormat('vi-VN').format(Math.round(paidAmount))}đ
        </span>
      </div>
    );
  }

  return (
    <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}