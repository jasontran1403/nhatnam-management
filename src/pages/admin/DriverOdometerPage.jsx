// src/pages/admin/DriverOdometerPage.jsx
//
// QUẢN LÝ TÀI XẾ (OWNER / ADMIN) — tổng hợp đồng hồ ODO theo KHOẢNG NGÀY.
//
// Số liệu gốc do kho nhập hằng ngày (điểm danh vào ca / kết ca). Màn này chỉ đọc.
//
// Điểm dễ hiểu nhầm: odo đầu kỳ / cuối kỳ KHÔNG chắc rơi đúng ngày biên. Tài xế nghỉ,
// quên điểm danh, hoặc kỳ kéo tới tương lai đều làm thiếu số liệu ở hai đầu, nên backend
// dò tới/lùi cho đến khi gặp bản ghi. Vì vậy card luôn hiển thị NGÀY THỰC TẾ lấy được
// bên cạnh số odo — nếu không, người xem sẽ tưởng đó là số của ngày mình chọn.

import { useState, useEffect, useMemo } from 'react';
import {
  Truck, Bike, Gauge, Package, Calendar, RefreshCw, X, MapPin,
  ChevronRight, AlertCircle, Settings2, EyeOff, Eye, Plus, Pencil,
} from 'lucide-react';
import { adminDriverOdometerApi } from '../../api/adminApi';
import { BackButton } from '../../components/common/SubPageNav';
import DateRangePicker from '../../components/ui/DateRangePicker';
import { driverAdminApi } from '../../api/driverApi';
import { useToast } from '../../components/common/Toast';
import { fmtVND } from '../../utils/format.js';

const fmtKm = (n) =>
  n === null || n === undefined ? '—' : new Intl.NumberFormat('vi-VN').format(n);

/** yyyy-MM-dd → dd/MM */
const shortDate = (s) => {
  if (!s) return '';
  const [y, m, d] = s.split('-');
  return `${d}/${m}`;
};

const todayStr = () => new Date().toLocaleDateString('en-CA');   // yyyy-MM-dd theo giờ máy
const firstOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toLocaleDateString('en-CA');
};

/** DateRangePicker trả epoch millis, backend nhận "yyyy-MM-dd" → quy đổi hai chiều. */
const msToDateStr = (ms) => (ms ? new Date(ms).toLocaleDateString('en-CA') : null);
const dateStrToMs = (s) => (s ? new Date(`${s}T00:00:00`).getTime() : null);

const VEHICLE_CFG = {
  TRUCK:     { label: 'Xe tải',  icon: Truck },
  MOTORBIKE: { label: 'Xe máy',  icon: Bike },
};

const STATUS_LABEL = {
  PENDING: 'Chờ xử lý', CONFIRMED: 'Đã xác nhận', PREPARING: 'Đang chuẩn bị',
  READY: 'Sẵn sàng', DELIVERING: 'Đang giao',
  PENDING_PAYMENT: 'Chờ thanh toán', COMPLETED: 'Hoàn thành',
};

// ══════════════════════════════════════════════════════════════════════════════
// Modal chi tiết đơn hàng của một tài xế
// ══════════════════════════════════════════════════════════════════════════════
function DriverOrdersModal({ driver, from, to, onClose }) {
  const toast = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    adminDriverOdometerApi.orders(driver.driverId, from, to)
      .then(res => { if (alive) setOrders(Array.isArray(res) ? res : (res?.data || [])); })
      .catch(() => { if (alive) toast('Không tải được danh sách đơn', 'error'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [driver.driverId, from, to]);

  // Nhóm theo ngày giao để dễ đối chiếu với odo từng ngày
  const grouped = useMemo(() => {
    const map = new Map();
    orders.forEach(o => {
      const k = o.deliveryDate || '—';
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(o);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [orders]);

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-hairline">
          <div>
            <p className="font-bold text-ink">{driver.driverName}</p>
            <p className="text-xs text-muted mt-0.5">
              {orders.length} đơn · {shortDate(from)} – {shortDate(to)}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-canvas text-muted transition">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {loading ? (
            <p className="text-sm text-muted text-center py-8">Đang tải...</p>
          ) : orders.length === 0 ? (
            <p className="text-sm text-muted text-center py-8">
              Không có đơn nào được gán cho tài xế này trong khoảng đã chọn
            </p>
          ) : grouped.map(([date, list]) => (
            <div key={date}>
              <p className="text-xs font-semibold text-gold uppercase mb-2">
                {shortDate(date)} · {list.length} đơn
              </p>
              <div className="space-y-2">
                {list.map(o => (
                  <div key={o.orderId} className="bg-canvas rounded-xl px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-bold text-gold">{o.orderCode}</span>
                          <span className="text-[11px] px-1.5 py-0.5 rounded bg-surface text-muted">
                            {STATUS_LABEL[o.status] || o.status}
                          </span>
                          {o.trips > 1 && (
                            <span className="text-[11px] px-1.5 py-0.5 rounded bg-gold/15 text-gold-strong font-semibold">
                              {o.trips} chuyến
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-ink mt-1">{o.customerName}</p>
                        <p className="text-xs text-muted mt-0.5 flex items-start gap-1">
                          <MapPin size={11} className="mt-0.5 flex-shrink-0" />
                          <span>{o.deliveryAddress || 'Chưa có địa chỉ giao'}</span>
                        </p>
                      </div>
                      <span className="text-sm font-bold text-ink whitespace-nowrap">
                        {fmtVND(o.finalAmount)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="p-5 border-t border-hairline">
          <button onClick={onClose}
            className="w-full py-3 rounded-xl border border-hairline-2 text-sm font-semibold text-muted hover:bg-canvas transition">
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Card một tài xế
// ══════════════════════════════════════════════════════════════════════════════
function DriverCard({ d, onDetail }) {
  const vehicles = d.vehicles || [];
  const hasData = vehicles.length > 0;

  return (
    <div className="bg-surface rounded-2xl border border-hairline shadow-sm p-4 hover:shadow-md transition">
      <div className="flex flex-col lg:flex-row lg:items-center gap-4">

        {/* Tài xế + tổng km */}
        <div className="flex items-center gap-4 lg:w-64 flex-shrink-0">
          <div className="min-w-0 flex-1">
            <p className="font-bold text-ink truncate">{d.driverName}</p>
            <p className="text-xs text-muted">
              {d.vehicleType === 'BOTH' ? 'Xe máy + Xe tải'
                : (VEHICLE_CFG[d.vehicleType]?.label || d.vehicleType || '—')}
              {!d.active && <span className="text-red-500"> · Đã ngưng</span>}
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-2xl font-bold text-gold leading-none">{fmtKm(d.totalKm)}</p>
            <p className="text-[11px] text-muted mt-1">km</p>
          </div>
        </div>

        {/* ODO từng loại xe — tài xế BOTH có 2 đồng hồ độc lập nên hiển thị cạnh nhau,
            không gộp số vì trừ odo xe máy cho xe tải sẽ ra kết quả vô nghĩa */}
        <div className="flex-1 min-w-0">
          {!hasData ? (
            <div className="bg-canvas rounded-xl px-3 py-3 flex items-center gap-2">
              <AlertCircle size={14} className="text-muted flex-shrink-0" />
              <p className="text-xs text-muted">Không có điểm danh ODO trong khoảng này</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {vehicles.map(v => {
                const Icon = VEHICLE_CFG[v.vehicleType]?.icon || Gauge;
                return (
                  <div key={v.vehicleType} className="bg-canvas rounded-xl px-3 py-2.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold text-ink-2 flex items-center gap-1.5">
                        <Icon size={13} /> {VEHICLE_CFG[v.vehicleType]?.label || v.vehicleType}
                      </span>
                      <span className="text-sm font-bold text-ink">{fmtKm(v.km)} km</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted">
                      <span className="truncate">
                        Đầu <b className="text-ink-2">{fmtKm(v.startOdometer)}</b>
                        {v.startDate && <span className="ml-1">({shortDate(v.startDate)})</span>}
                      </span>
                      <ChevronRight size={11} className="flex-shrink-0" />
                      <span className="truncate">
                        Cuối <b className="text-ink-2">{fmtKm(v.endOdometer)}</b>
                        {v.endDate && <span className="ml-1">({shortDate(v.endDate)})</span>}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Đơn hàng */}
        <div className="flex lg:flex-col items-center lg:items-end justify-between gap-2 lg:w-32 flex-shrink-0
                        border-t lg:border-t-0 lg:border-l border-hairline pt-3 lg:pt-0 lg:pl-4">
          <span className="text-xs text-muted flex items-center gap-1.5">
            <Package size={13} /> <b className="text-ink">{d.orderCount || 0}</b> đơn
          </span>
          <button onClick={() => onDetail(d)}
            disabled={!d.orderCount}
            className="text-xs font-semibold text-gold hover:underline disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed whitespace-nowrap">
            Xem chi tiết
          </button>
        </div>
      </div>
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// Modal chọn tài xế nào được THEO DÕI ODO
// ══════════════════════════════════════════════════════════════════════════════
//
// Dùng lại cờ `systemDriver` sẵn có trong bảng driver — nghĩa của nó vốn đã là
// "bản ghi giao hàng ảo, không phải người thật". Bật cờ này thì tài xế biến mất
// khỏi màn điểm danh ODO của kho và khỏi báo cáo này, nhưng VẪN gán được cho đơn
// hàng như bình thường (Grab, Giao tại kho vẫn là lựa chọn giao hợp lệ).
function ManageDriversModal({ onClose, onSaved }) {
  const toast = useToast();
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  // Form thêm mới
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('BOTH');
  const [newSystem, setNewSystem] = useState(false);
  const [creating, setCreating] = useState(false);

  // Dòng đang sửa
  const [editId, setEditId] = useState(null);
  const [editDraft, setEditDraft] = useState({ name: '', vehicleType: 'BOTH', systemDriver: false, active: true });

  const load = () => {
    setLoading(true);
    driverAdminApi.list()
      .then(res => setDrivers(Array.isArray(res) ? res : (res?.data || [])))
      .catch(() => toast('Không tải được danh sách tài xế', 'error'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const doCreate = async () => {
    if (!newName.trim()) { toast('Nhập tên tài xế', 'error'); return; }
    setCreating(true);
    try {
      await driverAdminApi.create({
        name: newName.trim(), vehicleType: newType, systemDriver: newSystem,
      });
      toast('Đã tạo tài xế', 'success');
      setNewName(''); setNewType('BOTH'); setNewSystem(false);
      load(); onSaved && onSaved();
    } catch (e) {
      toast(e?.response?.data?.message || 'Không tạo được tài xế', 'error');
    } finally { setCreating(false); }
  };

  const startEdit = (d) => {
    setEditId(d.id);
    setEditDraft({
      name: d.name || '',
      vehicleType: d.vehicleType || 'BOTH',
      systemDriver: !!d.systemDriver,
      active: d.active !== false,
    });
  };

  const saveEdit = async () => {
    if (!editDraft.name.trim()) { toast('Tên tài xế không được trống', 'error'); return; }
    setBusyId(editId);
    try {
      await driverAdminApi.update(editId, { ...editDraft, name: editDraft.name.trim() });
      toast('Đã cập nhật', 'success');
      setEditId(null);
      load(); onSaved && onSaved();
    } catch (e) {
      toast(e?.response?.data?.message || 'Không cập nhật được', 'error');
    } finally { setBusyId(null); }
  };

  /** Bật/tắt nhanh cờ "không xử lý" mà không cần vào chế độ sửa. */
  const quickToggle = async (d) => {
    setBusyId(d.id);
    try {
      await driverAdminApi.update(d.id, { systemDriver: !d.systemDriver });
      setDrivers(prev => prev.map(x => x.id === d.id ? { ...x, systemDriver: !x.systemDriver } : x));
      onSaved && onSaved();
    } catch (e) {
      toast(e?.response?.data?.message || 'Không cập nhật được', 'error');
    } finally { setBusyId(null); }
  };

  const TypeSelect = ({ value, onChange }) => (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="px-2 py-1.5 rounded-lg border border-line text-xs bg-surface focus:outline-none focus:ring-2 focus:ring-gold/40">
      <option value="BOTH">Xe máy + Xe tải</option>
      <option value="MOTORBIKE">Xe máy</option>
      <option value="TRUCK">Xe tải</option>
    </select>
  );

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-hairline">
          <div>
            <p className="font-bold text-ink">Quản lý tài xế</p>
            <p className="text-xs text-muted mt-0.5">
              Tài xế "không xử lý" (Grab, Giao tại kho…) vẫn gán được cho đơn nhưng
              không hiện ở điểm danh ODO và báo cáo
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-canvas text-muted transition">
            <X size={20} />
          </button>
        </div>

        {/* Thêm mới */}
        <div className="p-4 border-b border-hairline bg-canvas">
          <div className="flex flex-wrap items-center gap-2">
            <input value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doCreate()}
              placeholder="Tên tài xế mới..."
              className="flex-1 min-w-[140px] px-3 py-1.5 rounded-lg border border-line text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-gold/40" />
            <TypeSelect value={newType} onChange={setNewType} />
            <label className="flex items-center gap-1.5 text-xs text-muted cursor-pointer select-none">
              <input type="checkbox" checked={newSystem} onChange={e => setNewSystem(e.target.checked)}
                className="w-4 h-4 rounded border-gold/60 text-gold focus:ring-gold/40" />
              Không xử lý
            </label>
            <button onClick={doCreate} disabled={creating}
              className="px-3 py-1.5 rounded-lg bg-forest-deep text-white text-xs font-bold hover:bg-forest-mid transition disabled:opacity-50 flex items-center gap-1">
              <Plus size={12} /> Thêm
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-2">
          {loading ? (
            <p className="text-sm text-muted text-center py-8">Đang tải...</p>
          ) : drivers.length === 0 ? (
            <p className="text-sm text-muted text-center py-8">Chưa có tài xế nào</p>
          ) : drivers.map(d => editId === d.id ? (
            // ── Chế độ sửa ──────────────────────────────────────────────
            <div key={d.id} className="bg-surface border border-gold/50 rounded-xl p-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <input value={editDraft.name}
                  onChange={e => setEditDraft(p => ({ ...p, name: e.target.value }))}
                  className="flex-1 min-w-[140px] px-3 py-1.5 rounded-lg border border-line text-sm focus:outline-none focus:ring-2 focus:ring-gold/40" />
                <TypeSelect value={editDraft.vehicleType}
                  onChange={v => setEditDraft(p => ({ ...p, vehicleType: v }))} />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs text-muted cursor-pointer select-none">
                  <input type="checkbox" checked={editDraft.systemDriver}
                    onChange={e => setEditDraft(p => ({ ...p, systemDriver: e.target.checked }))}
                    className="w-4 h-4 rounded border-gold/60 text-gold focus:ring-gold/40" />
                  Không xử lý
                </label>
                <label className="flex items-center gap-1.5 text-xs text-muted cursor-pointer select-none">
                  <input type="checkbox" checked={editDraft.active}
                    onChange={e => setEditDraft(p => ({ ...p, active: e.target.checked }))}
                    className="w-4 h-4 rounded border-gold/60 text-gold focus:ring-gold/40" />
                  Còn hoạt động
                </label>
                <div className="ml-auto flex gap-2">
                  <button onClick={() => setEditId(null)} disabled={busyId === d.id}
                    className="px-3 py-1.5 rounded-lg border border-line text-xs font-semibold text-muted hover:bg-canvas transition disabled:opacity-50">
                    Huỷ
                  </button>
                  <button onClick={saveEdit} disabled={busyId === d.id}
                    className="px-3 py-1.5 rounded-lg bg-forest-deep text-white text-xs font-bold hover:bg-forest-mid transition disabled:opacity-50">
                    Lưu
                  </button>
                </div>
              </div>
            </div>
          ) : (
            // ── Chế độ xem ──────────────────────────────────────────────
            <div key={d.id}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 ${
                d.systemDriver ? 'bg-surface-2' : 'bg-canvas'}`}>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium truncate ${
                  d.systemDriver ? 'text-muted' : 'text-ink'}`}>
                  {d.name}
                </p>
                <p className="text-[11px] text-muted">
                  {d.vehicleType === 'BOTH' ? 'Xe máy + Xe tải'
                    : (VEHICLE_CFG[d.vehicleType]?.label || d.vehicleType)}
                  {d.systemDriver ? ' · Không xử lý' : ' · Theo dõi ODO'}
                  {d.active === false && ' · Đã ngưng'}
                </p>
              </div>
              <button onClick={() => quickToggle(d)} disabled={busyId === d.id}
                title={d.systemDriver ? 'Bật theo dõi ODO' : 'Đánh dấu không xử lý'}
                className={`p-1.5 rounded-lg transition disabled:opacity-50 ${
                  d.systemDriver
                    ? 'text-muted hover:bg-surface'
                    : 'text-amber-600 dark:text-amber-300 hover:bg-amber-50 dark:bg-amber-500/10'}`}>
                {d.systemDriver ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
              <button onClick={() => startEdit(d)}
                className="p-1.5 rounded-lg text-gold hover:bg-surface transition">
                <Pencil size={14} />
              </button>
            </div>
          ))}
        </div>

        <div className="p-5 border-t border-hairline">
          <button onClick={onClose}
            className="w-full py-3 rounded-xl border border-hairline-2 text-sm font-semibold text-muted hover:bg-canvas transition">
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
export default function DriverOdometerPage() {
  const toast = useToast();
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(todayStr());
  const [includeInactive, setIncludeInactive] = useState(false);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [detailDriver, setDetailDriver] = useState(null);
  const [manageOpen, setManageOpen] = useState(false);

  const load = async () => {
    if (from > to) { toast('Ngày kết thúc phải sau ngày bắt đầu', 'error'); return; }
    setLoading(true);
    try {
      const res = await adminDriverOdometerApi.report(from, to, includeInactive);
      setData(Array.isArray(res) ? res : (res?.data || []));
    } catch (e) {
      toast(e?.response?.data?.message || 'Không tải được báo cáo', 'error');
    } finally { setLoading(false); }
  };

  // DateRangePicker chỉ phát sự kiện khi bấm Áp dụng (không phát theo từng ngày được
  // click), nên gắn from/to vào deps là an toàn — đổi khoảng ngày là tự tải lại luôn.
  // Nút "Xem báo cáo" giữ lại để tải lại thủ công.
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [from, to, includeInactive]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4">
      <BackButton fallback={window.location.pathname.startsWith('/owner') ? '/owner/users' : '/admin/users'} />

      <div className="flex items-center gap-3">
        <Gauge size={22} className="text-gold" />
        <h1 className="text-xl font-bold text-ink">Quản lý tài xế</h1>
        <span className="text-sm text-muted">{data.length} tài xế</span>
        <button onClick={() => setManageOpen(true)}
          className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-lg border border-line text-xs font-semibold text-muted hover:bg-canvas transition">
          <Settings2 size={13} /> Danh sách tài xế
        </button>
      </div>

      {/* Bộ lọc khoảng ngày */}
      <div className="bg-surface rounded-2xl border border-hairline shadow-sm p-4">
        <div className="flex flex-wrap items-center gap-3">
          <DateRangePicker
            from={dateStrToMs(from)}
            to={dateStrToMs(to)}
            onChange={(r) => {
              // Xoá khoảng ngày → quay về mặc định (đầu tháng → hôm nay) thay vì
              // để trống, vì API bắt buộc phải có cả from lẫn to.
              setFrom(msToDateStr(r.from) || firstOfMonth());
              setTo(msToDateStr(r.to) || todayStr());
            }}
            placeholder="Chọn khoảng ngày"
          />

          <button onClick={load} disabled={loading}
            className="px-4 py-2 rounded-lg bg-forest-deep text-white text-sm font-bold hover:bg-forest-mid transition disabled:opacity-50 flex items-center gap-2">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Đang tải...' : 'Xem báo cáo'}
          </button>

          <label className="flex items-center gap-2 text-xs text-muted cursor-pointer select-none ml-auto">
            <input type="checkbox" checked={includeInactive}
              onChange={e => setIncludeInactive(e.target.checked)}
              className="w-4 h-4 rounded border-gold/60 text-gold focus:ring-gold/40" />
            Hiện cả tài xế đã ngưng
          </label>
        </div>

        <p className="text-[11px] text-muted mt-3 flex items-start gap-1.5">
          <Calendar size={12} className="mt-0.5 flex-shrink-0" />
          <span>
            ODO đầu kỳ lấy từ lần điểm danh sớm nhất có trong khoảng, ODO cuối kỳ lấy từ lần
            muộn nhất. Ngày thực tế được ghi trong ngoặc cạnh mỗi số — có thể lệch ngày biên
            nếu tài xế nghỉ hoặc chưa điểm danh.
          </span>
        </p>
      </div>

      {/* Danh sách tài xế */}
      {loading ? (
        <p className="text-sm text-muted text-center py-12">Đang tải báo cáo...</p>
      ) : data.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-hairline shadow-sm p-12 text-center">
          <Truck size={28} className="text-line mx-auto mb-2" />
          <p className="text-sm text-muted">Chưa có tài xế nào</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.map(d => (
            <DriverCard key={d.driverId} d={d} onDetail={setDetailDriver} />
          ))}
        </div>
      )}

      {manageOpen && (
        <ManageDriversModal onClose={() => setManageOpen(false)} onSaved={load} />
      )}

      {detailDriver && (
        <DriverOrdersModal driver={detailDriver} from={from} to={to}
          onClose={() => setDetailDriver(null)} />
      )}
    </div>
  );
}