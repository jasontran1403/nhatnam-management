// src/pages/owner/OwnerOfficeSupplyPage.jsx
// KHO VĂN PHÒNG PHẨM (OWNER) — tổng hợp đăng ký, đặt hàng, lịch sử, báo cáo.
import { useState, useEffect, useCallback } from 'react';
import {
  Archive, ShoppingCart, History, BarChart2, ChevronRight,
  Download, Package, RefreshCw, AlertCircle, ChevronDown, X,
  FileText, Users, CalendarDays,
} from 'lucide-react';
import {
  officeSupplyApi, fmtQtyOff, fmtDtOff, fmtDateOff, daysSince,
} from '../../api/officeSupplyApi';
import { supplyWarehouseApi } from '../../api/supplyApi';
import { useToast } from '../../components/common/Toast';
import { BackButton } from '../../components/common/SubPageNav';
import {
  PageHeader, SectionCard, PrimaryButton, SecondaryButton,
  LoadingSpinner, EmptyState, TabBar,
} from '../../components/ui';

// ── Tab IDs ──────────────────────────────────────────────────────────────────
const TAB_REQUEST = 'request';   // Tổng hợp đăng ký + đặt hàng
const TAB_HISTORY = 'history';   // Lịch sử đặt hàng
const TAB_REPORT  = 'report';    // Báo cáo vật dụng

// ── Helpers ──────────────────────────────────────────────────────────────────
const badge = (n, label) =>
  n > 0 ? <span className="ml-1.5 text-[10px] font-bold bg-gold/15 text-gold px-1.5 py-0.5 rounded-md">{n}</span>
    : null;

// ── Warehouse selector ────────────────────────────────────────────────────────
function WarehouseTabs({ warehouses, value, onChange }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {warehouses.map(w => (
        <button key={w.id} onClick={() => onChange(w.id)}
          className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-colors
            ${value === w.id
              ? 'bg-gold text-white border-gold'
              : 'bg-surface text-ink border-hairline-2 hover:border-gold/50'}`}>
          {w.name}
        </button>
      ))}
    </div>
  );
}

// ── Tab: Tổng hợp đăng ký ───────────────────────────────────────────────────
function RequestTab({ warehouseId, warehouseName }) {
  const toast = useToast();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  const load = useCallback(async () => {
    if (!warehouseId) return;
    setLoading(true);
    try {
      setSummary(await officeSupplyApi.summary(warehouseId));
    } catch (e) {
      toast(e?.response?.data?.message || 'Không tải được tổng hợp', 'error');
    } finally { setLoading(false); }
  }, [warehouseId, toast]);

  useEffect(() => { load(); }, [load]);

  const placeOrder = async () => {
    if (!window.confirm(`Xác nhận đặt hàng cho ${warehouseName}?\nSau khi đặt, toàn bộ phiếu đăng ký sẽ bị xóa.`)) return;
    setPlacing(true);
    try {
      await officeSupplyApi.placeOrder(warehouseId);
      toast('Đã đặt hàng thành công! Phiếu đăng ký đã được clear.', 'success');
      await load();
    } catch (e) {
      toast(e?.response?.data?.message || 'Không đặt được', 'error');
    } finally { setPlacing(false); }
  };

  if (loading) return <LoadingSpinner label="Đang tải tổng hợp..." />;

  const summaryRows = summary?.summary || [];
  const detailRows  = summary?.detail  || [];
  const empCount    = summary?.employeeCount || 0;

  return (
    <div className="space-y-5">
      {/* Header + nút đặt hàng */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm font-bold text-ink">Tổng hợp đăng ký — {warehouseName}</p>
          <p className="text-xs text-muted mt-0.5">
            {empCount > 0
              ? `${empCount} nhân viên đã đăng ký · ${summaryRows.length} loại vật dụng`
              : 'Chưa có phiếu đăng ký nào'}
          </p>
        </div>
        <div className="flex gap-2">
          <SecondaryButton onClick={load}>
            <RefreshCw size={14} /> Làm mới
          </SecondaryButton>
          {empCount > 0 && (
            <PrimaryButton onClick={placeOrder} disabled={placing}>
              <ShoppingCart size={14} />
              {placing ? 'Đang đặt...' : 'Đặt hàng'}
            </PrimaryButton>
          )}
        </div>
      </div>

      {empCount === 0 ? (
        <EmptyState icon={Package} title="Chưa có phiếu đăng ký"
          description="Nhân viên chưa đăng ký vật dụng nào cho văn phòng này." />
      ) : (
        <>
          {/* Sheet 1: Tổng hợp */}
          <SectionCard>
            <div className="flex items-center justify-between px-5 py-4 border-b border-hairline">
              <div className="flex items-center gap-2">
                <FileText size={15} className="text-gold" />
                <p className="text-sm font-bold text-ink">Sheet 1 — Tổng hợp</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-canvas text-xs text-muted uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-2.5 text-left w-10">STT</th>
                    <th className="px-4 py-2.5 text-left">Tên sản phẩm</th>
                    <th className="px-4 py-2.5 text-left">Quy cách</th>
                    <th className="px-4 py-2.5 text-right">Số lượng</th>
                    <th className="px-4 py-2.5 text-left">ĐVT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {summaryRows.map(row => (
                    <tr key={row.stt} className="hover:bg-canvas/50">
                      <td className="px-4 py-2.5 text-muted text-center">{row.stt}</td>
                      <td className="px-4 py-2.5 font-medium text-ink">{row.name}</td>
                      <td className="px-4 py-2.5 text-muted">{row.specification || '—'}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-ink">{fmtQtyOff(row.totalQuantity)}</td>
                      <td className="px-4 py-2.5 text-muted">{row.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          {/* Sheet 2: Chi tiết */}
          <SectionCard>
            <button onClick={() => setDetailOpen(o => !o)}
              className="w-full flex items-center justify-between px-5 py-4 border-b border-hairline">
              <div className="flex items-center gap-2">
                <Users size={15} className="text-gold" />
                <p className="text-sm font-bold text-ink">Sheet 2 — Chi tiết theo nhân viên</p>
              </div>
              <ChevronDown size={15}
                className={`text-muted transition-transform ${detailOpen ? 'rotate-180' : ''}`} />
            </button>
            {detailOpen && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-canvas text-xs text-muted uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-2.5 text-left w-10">STT</th>
                      <th className="px-4 py-2.5 text-left">Nhân viên</th>
                      <th className="px-4 py-2.5 text-left">Chức vụ</th>
                      <th className="px-4 py-2.5 text-left">Vật dụng</th>
                      <th className="px-4 py-2.5 text-right">Số lượng</th>
                      <th className="px-4 py-2.5 text-left">ĐVT</th>
                      <th className="px-4 py-2.5 text-left">Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline">
                    {detailRows.map((row, i) => (
                      <tr key={i} className="hover:bg-canvas/50">
                        <td className="px-4 py-2.5 text-muted text-center">{i + 1}</td>
                        <td className="px-4 py-2.5 font-medium text-ink">{row.userFullName}</td>
                        <td className="px-4 py-2.5 text-muted">{row.userPosition || '—'}</td>
                        <td className="px-4 py-2.5 text-ink">{row.itemName}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-ink">{fmtQtyOff(row.quantity)}</td>
                        <td className="px-4 py-2.5 text-muted">{row.unit}</td>
                        <td className="px-4 py-2.5 text-muted">{row.note || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </>
      )}
    </div>
  );
}

// ── Tab: Lịch sử đặt hàng ────────────────────────────────────────────────────
function HistoryTab({ warehouseId, warehouseName }) {
  const toast = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);   // orderId đang xem chi tiết
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const load = useCallback(async () => {
    if (!warehouseId) return;
    setLoading(true);
    try {
      setOrders(await officeSupplyApi.orderHistory(warehouseId));
    } catch { setOrders([]); }
    finally { setLoading(false); }
  }, [warehouseId]);

  useEffect(() => { load(); setSelected(null); setDetail(null); }, [load]);

  const openDetail = async (orderId) => {
    if (selected === orderId) { setSelected(null); setDetail(null); return; }
    setSelected(orderId);
    setLoadingDetail(true);
    try {
      setDetail(await officeSupplyApi.orderDetail(orderId));
    } catch (e) {
      toast('Không tải được chi tiết', 'error');
    } finally { setLoadingDetail(false); }
  };

  if (loading) return <LoadingSpinner label="Đang tải lịch sử..." />;
  if (orders.length === 0)
    return <EmptyState icon={History} title="Chưa có đơn hàng" description="Chưa có lần đặt hàng nào." />;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">{orders.length} lần đặt hàng · mới nhất trước</p>
      {orders.map(o => {
        const days = daysSince(o.placedAt);
        const isOpen = selected === o.id;
        return (
          <SectionCard key={o.id}>
            <button onClick={() => openDetail(o.id)}
              className="w-full flex items-center justify-between gap-3 px-5 py-4
                hover:bg-canvas/40 transition-colors">
              <div className="min-w-0 flex-1 text-left">
                <div className="flex items-center gap-2">
                  <CalendarDays size={14} className="text-gold shrink-0" />
                  <p className="text-sm font-bold text-ink">{fmtDtOff(o.placedAt)}</p>
                  {days != null && (
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full
                      ${days <= 7
                        ? 'bg-emerald-50 text-emerald-700'
                        : days <= 30
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-canvas text-muted'}`}>
                      {days} ngày trước
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted mt-1">
                  {o.itemTypeCount} loại · {fmtQtyOff(o.totalQuantity)} sản phẩm
                  {o.placedByName && ` · bởi ${o.placedByName}`}
                </p>
              </div>
              <ChevronDown size={15}
                className={`text-muted transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
              <div className="border-t border-hairline">
                {loadingDetail ? (
                  <div className="py-6"><LoadingSpinner label="Đang tải chi tiết..." /></div>
                ) : detail ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-canvas text-xs text-muted uppercase tracking-wider">
                        <tr>
                          <th className="px-4 py-2.5 text-left">Nhân viên</th>
                          <th className="px-4 py-2.5 text-left">Chức vụ</th>
                          <th className="px-4 py-2.5 text-left">Vật dụng</th>
                          <th className="px-4 py-2.5 text-right">Số lượng</th>
                          <th className="px-4 py-2.5 text-left">ĐVT</th>
                          <th className="px-4 py-2.5 text-left">Ghi chú</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-hairline">
                        {detail.items.map((item, i) => (
                          <tr key={i} className="hover:bg-canvas/50">
                            <td className="px-4 py-2.5 font-medium text-ink">{item.userFullName || '—'}</td>
                            <td className="px-4 py-2.5 text-muted">{item.userPosition || '—'}</td>
                            <td className="px-4 py-2.5 text-ink">
                              {item.itemName}
                              {item.specification && (
                                <span className="text-xs text-muted ml-1">({item.specification})</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-right font-semibold">{fmtQtyOff(item.quantity)}</td>
                            <td className="px-4 py-2.5 text-muted">{item.unit}</td>
                            <td className="px-4 py-2.5 text-muted">{item.note || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            )}
          </SectionCard>
        );
      })}
    </div>
  );
}

// ── Tab: Báo cáo vật dụng ────────────────────────────────────────────────────
function ReportTab({ warehouseId }) {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!warehouseId) return;
    setLoading(true);
    try {
      setRows(await officeSupplyApi.itemReport(warehouseId));
    } catch { setRows([]); }
    finally { setLoading(false); }
  }, [warehouseId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingSpinner label="Đang tải báo cáo..." />;
  if (rows.length === 0)
    return <EmptyState icon={BarChart2} title="Chưa có dữ liệu"
      description="Chưa có lần đặt hàng nào để thống kê." />;

  return (
    <SectionCard>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-canvas text-xs text-muted uppercase tracking-wider">
            <tr>
              <th className="px-4 py-2.5 text-left">Tên vật dụng</th>
              <th className="px-4 py-2.5 text-left">Quy cách</th>
              <th className="px-4 py-2.5 text-left">ĐVT</th>
              <th className="px-4 py-2.5 text-right">Số lần mua</th>
              <th className="px-4 py-2.5 text-right">Tổng SL</th>
              <th className="px-4 py-2.5 text-left">Ngày mua gần nhất</th>
              <th className="px-4 py-2.5 text-right">Số ngày trước</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {rows.map(row => {
              const days = daysSince(row.lastOrderedAt);
              return (
                <tr key={row.supplyItemId} className="hover:bg-canvas/50">
                  <td className="px-4 py-2.5 font-medium text-ink">{row.name}</td>
                  <td className="px-4 py-2.5 text-muted">{row.specification || '—'}</td>
                  <td className="px-4 py-2.5 text-muted">{row.unit}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-ink">{row.orderCount}</td>
                  <td className="px-4 py-2.5 text-right text-ink">{fmtQtyOff(row.totalQuantity)}</td>
                  <td className="px-4 py-2.5 text-muted">{fmtDateOff(row.lastOrderedAt)}</td>
                  <td className="px-4 py-2.5 text-right">
                    {days != null && (
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full
                        ${days <= 7
                          ? 'bg-emerald-50 text-emerald-700'
                          : days <= 30
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-canvas text-muted'}`}>
                        {days} ngày
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

// ── Trang chính ──────────────────────────────────────────────────────────────
export default function OwnerOfficeSupplyPage() {
  const toast = useToast();
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseId, setWarehouseId] = useState(null);
  const [tab, setTab] = useState(TAB_REQUEST);

  useEffect(() => {
    supplyWarehouseApi.listAll()
      .then(list => {
        const ws = list || [];
        setWarehouses(ws);
        if (ws.length > 0) setWarehouseId(ws[0].id);
      })
      .catch(() => toast('Không tải được danh sách văn phòng', 'error'));
  }, [toast]);

  const wh = warehouses.find(w => w.id === warehouseId);

  const tabs = [
    { id: TAB_REQUEST, label: 'Đăng ký & Đặt hàng', icon: ShoppingCart },
    { id: TAB_HISTORY, label: 'Lịch sử đặt hàng',   icon: History },
    { id: TAB_REPORT,  label: 'Báo cáo vật dụng',    icon: BarChart2 },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <BackButton fallback="/owner/users" />
      <PageHeader
        icon={Archive}
        title="Kho văn phòng phẩm"
        subtitle="Tổng hợp đăng ký, đặt hàng và xem lịch sử sử dụng VPP"
      />

      {/* Chọn văn phòng */}
      {warehouses.length > 1 && (
        <WarehouseTabs
          warehouses={warehouses}
          value={warehouseId}
          onChange={id => { setWarehouseId(id); }}
        />
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-canvas rounded-2xl p-1 w-fit">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold
              transition-colors
              ${tab === t.id
                ? 'bg-surface text-ink shadow-sm'
                : 'text-muted hover:text-ink'}`}>
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Nội dung theo tab */}
      {warehouseId ? (
        tab === TAB_REQUEST ? (
          <RequestTab warehouseId={warehouseId} warehouseName={wh?.name} />
        ) : tab === TAB_HISTORY ? (
          <HistoryTab warehouseId={warehouseId} warehouseName={wh?.name} />
        ) : (
          <ReportTab warehouseId={warehouseId} />
        )
      ) : (
        <SectionCard>
          <EmptyState icon={Archive} title="Đang tải văn phòng..." />
        </SectionCard>
      )}
    </div>
  );
}
