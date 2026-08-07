// src/pages/shared/CameraManagementPage.jsx
//
// QUẢN LÝ CAMERA (OWNER / ADMIN).
//
// Hiển thị các thiết bị camera đã kết nối (đầu ghi hoặc camera IP đơn lẻ) và
// toàn bộ các camera gắn trong IP/domain đó.
//
// LƯU Ý PHẠM VI: camera chưa được lắp đặt nên phần STREAM chưa hoạt động —
// mỗi ô camera hiện đang là placeholder. Backend đã lưu đầy đủ thông tin kết
// nối; khi camera sẵn sàng chỉ cần đổ luồng thật vào <VideoTile /> là xong.
//
// LAYOUT: responsive cho desktop / laptop / tablet / điện thoại
//   - Lưới thiết bị: 1 cột (mobile) → 2 cột (tablet) → 3 cột (desktop lớn)
//   - Lưới camera trong 1 thiết bị: 1 → 2 → 3 → 4 cột
import { useState, useEffect, useCallback } from 'react';
import {
  Video, VideoOff, Plus, RefreshCw, Trash2, Pencil, Wifi, WifiOff,
  ChevronDown, ChevronRight, MapPin, Server, HelpCircle, Power, Camera as CameraIcon,
} from 'lucide-react';
import useMinLoading from '../../hooks/useMinLoading.js';
import { cameraApi } from '../../api/cameraApi';
import { useToast } from '../../components/common/Toast';
import Modal from '../../components/ui/Modal';

const inputCls =
  'w-full px-3 py-2 rounded-lg border border-hairline-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40';
const labelCls = 'block text-xs font-semibold text-ink-2 mb-1.5';

const STATUS = {
  ONLINE:      { label: 'Đang kết nối', cls: 'bg-green-100 dark:bg-green-500/18 text-green-700 dark:text-green-300',   Icon: Wifi },
  OFFLINE:     { label: 'Mất kết nối',  cls: 'bg-red-100 dark:bg-red-500/18 text-red-700 dark:text-red-300',       Icon: WifiOff },
  AUTH_FAILED: { label: 'Sai tài khoản', cls: 'bg-orange-100 dark:bg-orange-500/18 text-orange-700 dark:text-orange-300', Icon: WifiOff },
  UNKNOWN:     { label: 'Chưa kiểm tra', cls: 'bg-surface-2 text-ink-2',    Icon: HelpCircle },
};

const fmtTime = (ms) => (ms ? new Date(Number(ms)).toLocaleString('vi-VN') : '—');

// ═════════════════════════════════════════════════════════════════════════════
// MODAL THÊM / SỬA THIẾT BỊ
// ═════════════════════════════════════════════════════════════════════════════
function DeviceModal({ device, onClose, onDone }) {
  const toast = useToast();
  const editing = Boolean(device);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: device?.name || '',
    host: device?.host || '',
    port: device?.port ?? 80,
    username: device?.username || '',
    password: '',
    protocol: device?.protocol || 'HTTP',
    vendor: device?.vendor || '',
    location: device?.location || '',
    channelCount: device?.channelCount ?? 1,
    note: device?.note || '',
  });

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  // Đổi giao thức → gợi ý cổng mặc định (chỉ khi user chưa sửa cổng thủ công)
  const changeProtocol = (protocol) => {
    const defaults = { HTTP: 80, HTTPS: 443, RTSP: 554 };
    const wasDefault = Object.values(defaults).includes(Number(form.port));
    set({ protocol, ...(wasDefault ? { port: defaults[protocol] } : {}) });
  };

  const canSubmit =
    form.host.trim() &&
    form.username.trim() &&
    (editing || form.password.trim());

  const handleSave = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        name: form.name.trim() || form.host.trim(),
        host: form.host.trim(),
        port: Number(form.port) || 80,
        channelCount: Number(form.channelCount) || 1,
      };
      // Sửa mà để trống mật khẩu ⇒ không gửi lên, backend giữ nguyên mật khẩu cũ
      if (editing && !form.password.trim()) delete payload.password;

      const res = editing
        ? await cameraApi.updateDevice(device.id, payload)
        : await cameraApi.createDevice(payload);

      if (res.data?.status && res.data.status !== 200 && res.data?.message) {
        toast(res.data.message, 'error');
        return;
      }
      toast(editing ? 'Đã cập nhật thiết bị' : 'Đã thêm thiết bị camera', 'success');
      onDone();
    } catch (e) {
      toast(e?.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} size="lg"
      title={editing ? `Sửa thiết bị — ${device.name}` : 'Thêm thiết bị camera'}>
      <div className="space-y-4">
        <div className="bg-canvas border border-hairline rounded-xl p-3 text-xs text-muted leading-relaxed">
          Nhập địa chỉ IP/domain và tài khoản đăng nhập của đầu ghi hoặc camera IP.
          Hệ thống sẽ lưu lại và dựng danh sách các camera gắn trong thiết bị đó.
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelCls}>Tên gợi nhớ</label>
            <input className={inputCls} placeholder="VD: Đầu ghi kho A"
              value={form.name} onChange={(e) => set({ name: e.target.value })} />
          </div>

          <div>
            <label className={labelCls}>Địa chỉ IP / Domain *</label>
            <input className={inputCls} placeholder="192.168.1.64 hoặc camera.congty.vn"
              value={form.host} onChange={(e) => set({ host: e.target.value })} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Giao thức</label>
              <select className={inputCls} value={form.protocol}
                onChange={(e) => changeProtocol(e.target.value)}>
                <option value="HTTP">HTTP</option>
                <option value="HTTPS">HTTPS</option>
                <option value="RTSP">RTSP</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Cổng</label>
              <input className={inputCls} type="number" min="1" max="65535"
                value={form.port} onChange={(e) => set({ port: e.target.value })} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Tên đăng nhập *</label>
            <input className={inputCls} autoComplete="off" placeholder="admin"
              value={form.username} onChange={(e) => set({ username: e.target.value })} />
          </div>

          <div>
            <label className={labelCls}>
              Mật khẩu {editing ? <span className="font-normal text-muted">(bỏ trống = giữ nguyên)</span> : '*'}
            </label>
            <input className={inputCls} type="password" autoComplete="new-password"
              placeholder={editing ? '••••••••' : 'Mật khẩu thiết bị'}
              value={form.password} onChange={(e) => set({ password: e.target.value })} />
          </div>

          <div>
            <label className={labelCls}>Số camera trên thiết bị</label>
            <input className={inputCls} type="number" min="1" max="64"
              value={form.channelCount} onChange={(e) => set({ channelCount: e.target.value })} />
          </div>

          <div>
            <label className={labelCls}>Hãng</label>
            <input className={inputCls} placeholder="Hikvision, Dahua, KBVision..."
              value={form.vendor} onChange={(e) => set({ vendor: e.target.value })} />
          </div>

          <div className="sm:col-span-2">
            <label className={labelCls}>Vị trí lắp đặt</label>
            <input className={inputCls} placeholder="VD: Kho A - tầng 1"
              value={form.location} onChange={(e) => set({ location: e.target.value })} />
          </div>

          <div className="sm:col-span-2">
            <label className={labelCls}>Ghi chú</label>
            <textarea className={inputCls} rows={2} placeholder="Ghi chú thêm..."
              value={form.note} onChange={(e) => set({ note: e.target.value })} />
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row gap-2 pt-1">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-hairline-2 text-ink-2 hover:bg-canvas font-medium transition">
            Huỷ
          </button>
          <button onClick={handleSave} disabled={!canSubmit || saving}
            className="flex-1 py-2.5 rounded-xl bg-gold text-white font-semibold hover:bg-gold-strong transition disabled:opacity-50 flex items-center justify-center gap-2">
            {saving
              ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : <CameraIcon size={16} />}
            {saving ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Thêm thiết bị'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Ô XEM CAMERA — placeholder cho tới khi camera được lắp đặt
// ═════════════════════════════════════════════════════════════════════════════
function VideoTile({ channel }) {
  const off = !channel.enabled;
  return (
    <div className="rounded-xl overflow-hidden border border-hairline bg-surface">
      <div className="relative aspect-video bg-chrome flex flex-col items-center justify-center gap-1.5">
        {off ? (
          <VideoOff size={26} className="text-white/30" />
        ) : (
          <Video size={26} className="text-white/40" />
        )}
        <p className="text-[10.5px] text-white/40 px-2 text-center">
          {off ? 'Đã tắt hiển thị' : 'Chưa kết nối luồng'}
        </p>

        <span className="absolute top-1.5 left-1.5 text-[10px] font-bold text-white/80 bg-black/50 px-1.5 py-0.5 rounded">
          CH {channel.channelNo}
        </span>
        <span className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full ${
          channel.online ? 'bg-green-400' : 'bg-gray-500'
        }`} />
      </div>
      <div className="px-2.5 py-2">
        <p className="text-xs font-semibold text-ink truncate">{channel.name}</p>
        <p className="text-[10px] text-muted truncate font-mono">{channel.streamUrl || '—'}</p>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// CARD THIẾT BỊ
// ═════════════════════════════════════════════════════════════════════════════
function DeviceCard({ device, onEdit, onDeleted, onChanged }) {
  const toast = useToast();
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState(false);

  const st = STATUS[device.connectionStatus] || STATUS.UNKNOWN;
  const StatusIcon = st.Icon;

  const run = async (fn, okMsg) => {
    setBusy(true);
    try {
      const res = await fn();
      if (res?.data?.status && res.data.status !== 200 && res.data?.message) {
        toast(res.data.message, 'error');
        return;
      }
      if (okMsg) toast(okMsg, 'success');
      onChanged();
    } catch (e) {
      toast(e?.response?.data?.message || 'Có lỗi xảy ra', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Xoá thiết bị "${device.name}" và toàn bộ camera của nó?`)) return;
    setBusy(true);
    try {
      await cameraApi.deleteDevice(device.id);
      toast('Đã xoá thiết bị', 'success');
      onDeleted();
    } catch (e) {
      toast(e?.response?.data?.message || 'Không xoá được thiết bị', 'error');
    } finally {
      setBusy(false);
    }
  };

  const channels = device.channels || [];

  return (
    <div className={`bg-surface rounded-2xl border border-hairline shadow-sm overflow-hidden transition ${
      device.active ? '' : 'opacity-60'
    }`}>
      {/* Header */}
      <div className="p-4 flex items-start gap-3 flex-wrap">
        <button onClick={() => setOpen((v) => !v)}
          className="mt-0.5 text-muted hover:text-ink transition flex-shrink-0">
          {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-ink truncate">{device.name}</p>
            <span className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-semibold ${st.cls}`}>
              <StatusIcon size={11} /> {st.label}
            </span>
            {!device.active && (
              <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-surface-2 text-ink-2">
                Đã tắt
              </span>
            )}
          </div>

          <p className="flex items-center gap-1.5 text-xs text-muted mt-1 font-mono truncate">
            <Server size={12} className="flex-shrink-0" />
            {device.protocol?.toLowerCase()}://{device.host}:{device.port}
            <span className="font-sans">· {device.username}</span>
          </p>

          <p className="flex items-center gap-3 text-xs text-muted mt-1 flex-wrap">
            <span className="flex items-center gap-1">
              <CameraIcon size={12} /> {channels.length} camera
            </span>
            {device.location && (
              <span className="flex items-center gap-1 truncate">
                <MapPin size={12} /> {device.location}
              </span>
            )}
            {device.vendor && <span>· {device.vendor}</span>}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <IconBtn title="Nạp lại danh sách camera" disabled={busy}
            onClick={() => run(() => cameraApi.refreshDevice(device.id), 'Đã nạp lại danh sách camera')}>
            <RefreshCw size={15} className={busy ? 'animate-spin' : ''} />
          </IconBtn>
          <IconBtn title={device.active ? 'Tắt thiết bị' : 'Bật thiết bị'} disabled={busy}
            onClick={() => run(() => cameraApi.toggleDevice(device.id))}>
            <Power size={15} />
          </IconBtn>
          <IconBtn title="Sửa thông tin" disabled={busy} onClick={() => onEdit(device)}>
            <Pencil size={15} />
          </IconBtn>
          <IconBtn title="Xoá thiết bị" danger disabled={busy} onClick={handleDelete}>
            <Trash2 size={15} />
          </IconBtn>
        </div>
      </div>

      {/* Lưới camera */}
      {open && (
        <div className="px-4 pb-4">
          {channels.length === 0 ? (
            <div className="text-center py-8 bg-canvas rounded-xl">
              <VideoOff size={28} className="mx-auto mb-2 text-muted" />
              <p className="text-sm text-muted">Chưa có camera nào — bấm nạp lại để dò thiết bị</p>
            </div>
          ) : (
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {channels.map((ch) => <VideoTile key={ch.id} channel={ch} />)}
            </div>
          )}

          <p className="text-[11px] text-muted mt-3">
            Cập nhật lần cuối: {fmtTime(device.lastSyncedAt)}
            {device.note && <> · {device.note}</>}
          </p>
        </div>
      )}
    </div>
  );
}

function IconBtn({ children, title, onClick, disabled, danger }) {
  return (
    <button title={title} onClick={onClick} disabled={disabled}
      className={`p-2 rounded-lg border border-hairline-2 transition disabled:opacity-40 ${
        danger ? 'text-red-600 dark:text-red-300 hover:bg-red-50 dark:bg-red-500/10' : 'text-ink-2 hover:bg-canvas'
      }`}>
      {children}
    </button>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// PAGE
// ═════════════════════════════════════════════════════════════════════════════
export default function CameraManagementPage() {
  const toast = useToast();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useMinLoading();
  const [modal, setModal] = useState(null);   // null | { device? }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await cameraApi.getDevices();
      setDevices(res.data?.data || []);
    } catch (e) {
      toast('Không tải được danh sách camera', 'error');
    } finally {
      setLoading(false);
    }
  }, [setLoading, toast]);

  useEffect(() => { load(); }, [load]);

  const totalChannels = devices.reduce((n, d) => n + (d.channels?.length || 0), 0);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5">
      {/* Header */}
      <div className="flex items-start sm:items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Video size={24} className="text-gold flex-shrink-0" />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-ink">Quản lý camera</h1>
            <p className="text-sm text-muted">
              {devices.length} thiết bị · {totalChannels} camera
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={load} disabled={loading} title="Làm mới"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-hairline-2 text-sm text-ink-2 hover:bg-canvas transition disabled:opacity-50">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Làm mới</span>
          </button>
          <button onClick={() => setModal({})}
            className="flex items-center gap-1.5 px-4 py-2 bg-gold text-white rounded-xl text-sm font-semibold hover:bg-gold-strong transition">
            <Plus size={15} /> Thêm camera
          </button>
        </div>
      </div>

      {/* Ghi chú phạm vi hiện tại */}
      <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/28 rounded-xl px-4 py-3 text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
        ℹ️ Camera chưa được lắp đặt nên phần xem trực tiếp hiện là ô giữ chỗ.
        Thông tin kết nối vẫn được lưu đầy đủ — khi camera sẵn sàng, hệ thống sẽ dùng
        chính dữ liệu này để kết nối và hiển thị luồng video.
      </div>

      {/* Danh sách thiết bị */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
        </div>
      ) : devices.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-hairline shadow-sm text-center py-16 px-4">
          <VideoOff size={48} className="mx-auto mb-3 text-gold/40" />
          <p className="text-lg font-semibold text-ink">Chưa có camera nào</p>
          <p className="text-sm text-muted mt-1 mb-4">
            Thêm địa chỉ IP/domain và tài khoản để kết nối thiết bị đầu tiên
          </p>
          <button onClick={() => setModal({})}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-gold text-white rounded-xl text-sm font-semibold hover:bg-gold-strong transition">
            <Plus size={15} /> Thêm camera
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {devices.map((d) => (
            <DeviceCard
              key={d.id}
              device={d}
              onEdit={(device) => setModal({ device })}
              onDeleted={load}
              onChanged={load}
            />
          ))}
        </div>
      )}

      {modal && (
        <DeviceModal
          key={modal.device?.id || 'new'}
          device={modal.device}
          onClose={() => setModal(null)}
          onDone={() => { setModal(null); load(); }}
        />
      )}
    </div>
  );
}
