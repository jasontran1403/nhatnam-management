// src/pages/super_accountant/SuperAccountantMaterialRequestPage.jsx
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Search, Package, ChevronDown, ChevronUp, Plus, X, Check, Camera, Loader2, Trash2, Info, CalendarClock, Eye } from 'lucide-react';
import useMinLoading from '../../hooks/useMinLoading.js';
import { Field, inputCls, PrimaryButton, SecondaryButton } from '../../components/ui';
import { CardSkeleton } from '../../components/ui/Skeleton.jsx';
import Modal from '../../components/ui/Modal.jsx';
import DateRangePicker from '../../components/ui/DateRangePicker.jsx';
import DatePicker from '../../components/ui/DatePicker.jsx';
import {
  accountantMaterialRequestApi, STATUS_CONFIG, fmtTs, fmtDateTime, countdownInfo, fmtVND, PAYMENT_METHODS,
} from '../../api/materialRequestApi.js';
import { factoryProdApi } from '../../api/productionModuleApi.js';
import { useToast } from '../../components/common/Toast.jsx';
import { useLang } from '../../context/LangContext';
import { useFmt } from '../../utils/useFmt';
import api from '../../api/axios.js';
import {
  allocateCost, unitPriceFromTotal, parseMoneyInput, clampDecimalInput,
  normalizeMoney, fmtMoney, fmtDong, MONEY_DECIMALS,
} from '../../utils/costCalc';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
const imgUrl = (p) => { if (!p) return ''; if (p.startsWith('http')) return p; return BASE_URL + "/api/auth" + p; };

// ── Countdown badge — đếm ngược giây ─────────────────────────────────────────
function CountdownBadge({ targetMs, label }) {
  const { t } = useLang();
  const { fmtCurrency, fmtDate, fmtDateTime } = useFmt();
  const [info, setInfo] = useState(() => countdownInfo(targetMs));
  useEffect(() => {
    if (!targetMs) return;
    // Cập nhật mỗi giây
    const t = setInterval(() => setInfo(countdownInfo(targetMs)), 1000);
    return () => clearInterval(t);
  }, [targetMs]);
  if (!info) return null;
  const cls = {
    red:    'bg-red-100 text-red-700',
    yellow: 'bg-amber-100 text-amber-700',
    normal: 'bg-blue-50 text-blue-700',
  }[info.color];
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>{label}: {info.label}</span>;
}

// Cập nhật hàm countdownInfo để hiện giây khi < 1 giờ
function liveCountdown(targetMs) {
  if (!targetMs) return null;
  const diff = targetMs - Date.now();
  if (diff <= 0) return { label: 'Overdue', color: 'red' };
  const totalSec = Math.floor(diff / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h < 1) return { label: `${m}p ${s}s`, color: totalSec < 600 ? 'red' : 'yellow' };
  if (h < 24) return { label: `${h}g ${m}p`, color: h < 6 ? 'red' : 'yellow' };
  const d = Math.floor(h / 24);
  return { label: `${d}d ${h % 24}h`, color: 'normal' };
}

function LiveCountdownBadge({ targetMs, label }) {
  const { t } = useLang();
  const { fmtCurrency, fmtDate, fmtDateTime } = useFmt();
  const [info, setInfo] = useState(() => liveCountdown(targetMs));
  useEffect(() => {
    if (!targetMs) return;
    const t = setInterval(() => setInfo(liveCountdown(targetMs)), 1000);
    return () => clearInterval(t);
  }, [targetMs]);
  if (!info) return null;
  const cls = { red: 'bg-red-100 text-red-700', yellow: 'bg-amber-100 text-amber-700', normal: 'bg-blue-50 text-blue-700' }[info.color];
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold tabular-nums ${cls}`}>
      ⏱ {label}: {info.label}
    </span>
  );
}

// ── Card bg ────────────────────────────────────────────────────────────────────
function cardBg(req) {
  if (req.status === 'RECEIVED') return 'bg-emerald-50 border-emerald-200';
  if (req.status === 'COMPLETED') return 'bg-white';
  if (!req.requiredBy) return 'bg-white';
  const info = liveCountdown(req.requiredBy);
  if (!info) return 'bg-white';
  if (info.color === 'red') return 'bg-red-50 border-red-200';
  if (info.color === 'yellow') return 'bg-amber-50 border-amber-200';
  return 'bg-white';
}

// ── Upload hóa đơn / chứng từ thanh toán ──────────────────────────────────────
function InvoiceUploader({ requestId, value = [], onChange, label, required = true }) {
  // FIX: trước đây gọi t(...) TRƯỚC khi khai báo const { t } = useLang() → ReferenceError
  // (temporal dead zone) mỗi khi component render mà không truyền prop `label`.
  const { t } = useLang();
  if (!label) label = t('production','mr_invoice_label');
  const { fmtCurrency, fmtDate, fmtDateTime } = useFmt();
  const fileRef = useRef();
  const videoRef = useRef();
  const canvasRef = useRef();
  const [uploading, setUploading] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [stream, setStream] = useState(null);
  const [previews, setPreviews] = useState([]);
  const toast = useToast();

  const uploadFiles = async (files) => {
    if (!files.length) return;
    setUploading(true);
    try {
      const form = new FormData();
      files.forEach(f => form.append('files', f));
      if (requestId) form.append('requestId', requestId);
      const res = await api.post('/api/upload/production/material-request-invoice', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onChange([...value, ...(res.data?.data || [])]);
    } catch (e) { toast(e?.response?.data?.message || t('production','mr_upload_failed'), 'error'); }
    finally { setUploading(false); }
  };

  const handleFiles = async (files) => {
    const arr = Array.from(files);
    const lp = arr.map(f => URL.createObjectURL(f));
    setPreviews(p => [...p, ...lp]);
    await uploadFiles(arr);
    setPreviews(p => p.filter(x => !lp.includes(x)));
  };

  const openCamera = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      setStream(s); setCameraOpen(true);
      setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = s; }, 50);
    } catch { toast(t('production','mr_camera_error'), 'error'); }
  };

  const closeCamera = () => { stream?.getTracks().forEach(t => t.stop()); setStream(null); setCameraOpen(false); };

  const capturePhoto = () => {
    const v = videoRef.current, c = canvasRef.current;
    if (!v || !c) return;
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d').drawImage(v, 0, 0);
    c.toBlob(blob => {
      if (!blob) return;
      closeCamera();
      handleFiles([new File([blob], `invoice-${Date.now()}.jpg`, { type: 'image/jpeg' })]);
    }, 'image/jpeg', 0.85);
  };

  return (
    <div>
      <p className="text-xs font-semibold text-[#8E8878] uppercase tracking-wider mb-2">
        {label} {required && <span className="text-red-500">*</span>}
      </p>
      <div className="flex gap-2 flex-wrap">
        {value.map((url, i) => (
          <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border border-black/10 group">
            <img src={imgUrl(url)} alt="" className="w-full h-full object-cover"/>
            <button onClick={() => onChange(value.filter((_, j) => j !== i))}
              className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <X size={10}/>
            </button>
          </div>
        ))}
        {previews.map((p, i) => (
          <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border border-black/10">
            <img src={`${import.meta.env.VITE_API_BASE_URL}/api/auth/${p}`} alt="" className="w-full h-full object-cover"/>
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center"><Loader2 size={16} className="text-white animate-spin"/></div>
          </div>
        ))}
        <button type="button" onClick={openCamera}
          className="w-20 h-20 rounded-xl border-2 border-dashed border-[#C9A84C]/40 flex flex-col items-center justify-center hover:border-[#C9A84C] hover:bg-[#C9A84C]/5 gap-1">
          <Camera size={20} className="text-[#C9A84C]"/>
          <span className="text-[10px] text-[#C9A84C] font-medium">{t('production','mr_capture')}</span>
        </button>
        <button type="button" onClick={() => fileRef.current?.click()}
          className="w-20 h-20 rounded-xl border-2 border-dashed border-[#E8DDD0] flex flex-col items-center justify-center hover:border-[#C9A84C] hover:bg-[#C9A84C]/5 gap-1">
          <Plus size={20} className="text-[#8E8878]"/>
          <span className="text-[10px] text-[#8E8878]">{t('production','mr_choose_file')}</span>
        </button>
        <input ref={fileRef} type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={e => handleFiles(e.target.files)}/>
      </div>
      {cameraOpen && (
        <div className="fixed inset-0 z-[90] bg-black flex flex-col items-center justify-center">
          <button onClick={closeCamera} className="absolute top-4 right-4 text-white p-2"><X size={24}/></button>
          <video ref={videoRef} autoPlay playsInline muted className="max-w-full max-h-[70vh] rounded-xl"/>
          <canvas ref={canvasRef} className="hidden"/>
          <button onClick={capturePhoto}
            className="mt-6 w-16 h-16 rounded-full bg-white border-4 border-[#C9A84C] flex items-center justify-center hover:scale-105 transition-transform">
            <Camera size={24} className="text-[#C9A84C]"/>
          </button>
        </div>
      )}
    </div>
  );
}

// ── Vendor select — bắt buộc chọn từ danh mục NCC có sẵn (không nhập tự do) ──
// Dùng portal để render danh sách ra <body> — tránh bị modal (overflow-y-auto)
// cắt mất phần dropdown khi ô chọn nằm gần đáy modal.
function VendorSelectDropdown({ value, onChange, vendors: vendorsProp, loading: loadingProp }) {
  const { t } = useLang();
  const { fmtCurrency, fmtDate, fmtDateTime } = useFmt();
  const [vendors, setVendors] = useState(vendorsProp || []);
  const [loading, setLoading] = useState(!vendorsProp && loadingProp !== false);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0, dropUp: false });
  const triggerRef = useRef(null);
  const popRef = useRef(null);

  // Nếu danh sách NCC được truyền từ ngoài vào (vd: danh sách NCC vừa thêm
  // trong cùng phiếu), dùng luôn — không tự fetch lại.
  useEffect(() => {
    if (vendorsProp) { setVendors(vendorsProp); setLoading(false); return; }
    (async () => {
      setLoading(true);
      try {
        const res = await factoryProdApi.listVendors('', 'MATERIAL');
        setVendors(res || []);
      } catch { setVendors([]); }
      finally { setLoading(false); }
    })();
  }, [vendorsProp]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (triggerRef.current && !triggerRef.current.contains(e.target) &&
          popRef.current && !popRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const calcPos = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const estListHeight = 260; // search bar + max-h danh sách
    const spaceBelow = window.innerHeight - r.bottom;
    const dropUp = spaceBelow < estListHeight && r.top > spaceBelow;
    setPos({
      top: dropUp ? r.top + window.scrollY : r.bottom + window.scrollY + 4,
      left: r.left + window.scrollX,
      width: r.width,
      dropUp,
    });
  }, []);

  const toggleOpen = () => {
    if (!open) calcPos();
    setOpen(o => !o);
  };

  useEffect(() => {
    if (!open) return;
    calcPos();
    const onScrollOrResize = () => calcPos();
    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('scroll', onScrollOrResize, true);
    return () => {
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('scroll', onScrollOrResize, true);
    };
  }, [open, calcPos]);

  const filtered = vendors.filter(v => v.name.toLowerCase().includes(search.toLowerCase()));

  const select = (v) => {
    setOpen(false); setSearch('');
    onChange({ vendorId: v.id, vendorName: v.name, contactPerson: v.contactPerson || '', contactPhone: v.contactPhone || '' });
  };

  const dropdown = open ? createPortal(
    <div
      ref={popRef}
      style={{
        position: 'absolute',
        top: pos.dropUp ? undefined : pos.top,
        bottom: pos.dropUp ? (window.innerHeight - pos.top + window.scrollY + 4) : undefined,
        left: pos.left,
        width: pos.width,
        zIndex: 9999,
      }}
      className="bg-white border border-[#E8DDD0] rounded-xl shadow-2xl overflow-hidden"
    >
      <div className="p-2 border-b border-black/5 relative">
        <Search size={12} className="absolute left-5 top-1/2 -translate-y-1/2 text-[#8E8878]"/>
        <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
          placeholder={t('production','mr_search_vendor')}
          className="w-full pl-7 pr-2 py-1.5 text-sm rounded-lg border border-black/10 focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/40"/>
      </div>
      <div className="max-h-44 overflow-auto">
        {filtered.length === 0 && (
          <p className="text-center py-4 text-xs text-[#8E8878]">
            {loading ? 'Đang tải...' : 'Không có nhà cung cấp — hãy tạo trong trang Công nợ NCC'}
          </p>
        )}
        {filtered.map(v => (
          <button key={v.id} className="w-full text-left px-3 py-2 text-sm hover:bg-[#FAF7F2] border-b border-black/5 last:border-0" onClick={() => select(v)}>
            <p className="font-medium text-[#1C1C1E]">{v.name}</p>
            {(v.contactPerson || v.contactPhone) && (
              <p className="text-xs text-[#8E8878]">{v.contactPerson}{v.contactPerson && v.contactPhone ? ' · ' : ''}{v.contactPhone}</p>
            )}
          </button>
        ))}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div className="relative" ref={triggerRef}>
      <div
        onClick={toggleOpen}
        className={`flex items-center justify-between px-3 py-2.5 rounded-xl border cursor-pointer transition text-sm ${value?.vendorId ? 'border-[#C9A84C] bg-white' : 'border-[#E8DDD0] bg-[#FAF7F2]'}`}
      >
        {value?.vendorId ? (
          <div className="min-w-0">
            <p className="font-medium text-[#1C1C1E] truncate">{value.vendorName}</p>
            {(value.contactPerson || value.contactPhone) && (
              <p className="text-xs text-[#8E8878] truncate">
                {value.contactPerson}{value.contactPerson && value.contactPhone ? ' · ' : ''}{value.contactPhone}
              </p>
            )}
          </div>
        ) : (
          <span className="text-[#8E8878]">{loading ? 'Đang tải...' : 'Chọn nhà cung cấp...'}</span>
        )}
        <ChevronDown size={14} className={`text-[#8E8878] flex-shrink-0 ml-2 transition-transform ${open ? 'rotate-180' : ''}`}/>
      </div>
      {dropdown}
    </div>
  );
}

// ── Confirm Order Modal — datetime picker (ngày + giờ phút) ──────────────────
function ConfirmOrderModal({ req, onClose, onDone }) {
  const { t } = useLang();
  const { fmtCurrency, fmtDate, fmtDateTime } = useFmt();
  const toast = useToast();
  // Date + time riêng để dễ nhập
  const [deliveryDate, setDeliveryDate] = useState(null);    // timestamp ms (chỉ ngày)
  const [deliveryTime, setDeliveryTime] = useState('08:00'); // "HH:mm"
  const [vendors, setVendors] = useState([{ vendorId: null, vendorName: '', contactPerson: '', contactPhone: '' }]);
  // itemId -> vendorId (NCC nào cung cấp nguyên liệu này)
  const [itemVendorId, setItemVendorId] = useState({});
  const [saving, setSaving] = useState(false);

  const items = req.items || [];

  // Combine date + time thành timestamp
  const getEstDeliveryMs = () => {
    if (!deliveryDate) return null;
    const d = new Date(deliveryDate);
    const [h, m] = (deliveryTime || '08:00').split(':').map(Number);
    d.setHours(h || 0, m || 0, 0, 0);
    return d.getTime();
  };

  // Chỉ những NCC đã thật sự chọn (có vendorId) mới tính là hợp lệ để gán cho nguyên liệu
  const validVendors = vendors.filter(v => v.vendorId);

  const addVendor = () => setVendors(p => [...p, { vendorId: null, vendorName: '', contactPerson: '', contactPhone: '' }]);
  const removeVendor = (i) => setVendors(p => p.filter((_, idx) => idx !== i));
  const setVendor = (i, data) => setVendors(p => p.map((v, idx) => idx === i ? { ...v, ...data } : v));

  // Nếu chỉ có đúng 1 NCC hợp lệ, tự gán mặc định NCC đó cho tất cả nguyên liệu
  // chưa được gán (giúp đỡ phải chọn lại thủ công cho trường hợp phổ biến nhất).
  // Lưu ý: gán theo vendorId (ổn định) thay vì vị trí trong mảng — vì vị trí có
  // thể đổi khi thêm/xoá NCC, còn vendorId thì không.
  useEffect(() => {
    if (validVendors.length !== 1) return;
    const onlyVendorId = validVendors[0].vendorId;
    setItemVendorId(prev => {
      const next = { ...prev };
      let changed = false;
      items.forEach(it => {
        if (next[it.id] == null) { next[it.id] = onlyVendorId; changed = true; }
      });
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validVendors.length, validVendors[0]?.vendorId, items.length]);

  // Nếu NCC nào bị xoá khỏi danh sách, bỏ gán của các nguyên liệu đang gán cho NCC đó
  useEffect(() => {
    const validIds = new Set(validVendors.map(v => v.vendorId));
    setItemVendorId(prev => {
      const next = {};
      let changed = false;
      Object.entries(prev).forEach(([itemId, vendorId]) => {
        if (vendorId != null && validIds.has(vendorId)) next[itemId] = vendorId;
        else changed = true;
      });
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validVendors.map(v => v.vendorId).join(',')]);

  const setItemVendor = (itemId, vendorId) => setItemVendorId(p => ({ ...p, [itemId]: vendorId }));

  const allItemsAssigned = items.length > 0 && items.every(it => itemVendorId[it.id] != null);

  const handleSubmit = async () => {
    const estDelivery = getEstDeliveryMs();
    if (!estDelivery) { toast(t('production','mr_err_delivery_time'), 'error'); return; }
    if (validVendors.length === 0) { toast(t('production','mr_err_select_vendor'), 'error'); return; }
    if (!allItemsAssigned) { toast(t('production','mr_err_assign_vendor'), 'error'); return; }
    setSaving(true);
    try {
      const vendorIndexById = new Map(validVendors.map((v, i) => [v.vendorId, i]));
      await accountantMaterialRequestApi.confirmOrder(req.id, {
        estimatedDelivery: estDelivery,
        vendors: validVendors.map((v, i) => ({ ...v, sortOrder: i })),
        items: items.map(it => ({ itemId: it.id, vendorIndex: vendorIndexById.get(itemVendorId[it.id]) })),
      });
      toast(t('production','mr_toast_confirmed'), 'success');
      onDone();
    } catch (e) {
      toast(e?.response?.data?.message || t('error','generic'), 'error');
    } finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title={`Xác nhận đặt hàng — ${req.requestCode}`} size="lg">
      <div className="space-y-4">
        {/* Thời gian giao hàng — ngày + giờ phút */}
        <div>
          <p className="text-xs font-semibold text-[#8E8878] uppercase tracking-wider mb-2">
            Thời gian giao hàng dự kiến <span className="text-red-500">*</span>
          </p>
          <div className="flex gap-3 items-center">
            <div className="flex-1">
              <DatePicker
                value={deliveryDate}
                onChange={setDeliveryDate}
                placeholder={t('production','mr_ph_delivery_date')}
                minDate={new Date()}
              />
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <input
                type="time"
                className={`${inputCls} w-32`}
                value={deliveryTime}
                onChange={e => setDeliveryTime(e.target.value)}
              />
              <span className="text-xs text-[#8E8878]">{t('production','mr_delivery_hour')}</span>
            </div>
          </div>
          {deliveryDate && (
            <p className="text-xs text-[#C9A84C] mt-1.5">
              → Dự kiến: {new Date(getEstDeliveryMs()).toLocaleString('vi-VN', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })}
            </p>
          )}
        </div>

        {/* Nhà cung cấp */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-[#1C1C1E]">{t('production','metrics_vendor')}</p>
            <button onClick={addVendor} className="text-xs text-[#C9A84C] font-semibold flex items-center gap-1">
              <Plus size={11}/> Thêm NCC
            </button>
          </div>
          <div className="space-y-3">
            {vendors.map((v, i) => (
              <div key={i} className="bg-[#FAF7F2] rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-[#8E8878]">NCC {i + 1}</p>
                  {vendors.length > 1 && (
                    <button onClick={() => removeVendor(i)} className="text-red-400 hover:text-red-600"><X size={14}/></button>
                  )}
                </div>
                <VendorSelectDropdown value={v} onChange={data => setVendor(i, data)}/>
              </div>
            ))}
          </div>
        </div>

        {/* Gán nguyên liệu cho từng NCC — bắt buộc ──────────────────────────── */}
        <div>
          <p className="text-xs font-semibold text-[#8E8878] uppercase tracking-wider mb-2">
            Gán nguyên liệu cho nhà cung cấp <span className="text-red-500">*</span>
          </p>
          {validVendors.length === 0 ? (
            <p className="text-sm text-[#8E8878] bg-[#FAF7F2] rounded-xl p-3">
              Chọn nhà cung cấp ở trên trước, sau đó gán từng nguyên liệu cho NCC tương ứng.
            </p>
          ) : (
            <div className="space-y-2">
              {items.map((it, i) => {
                const assignedVendorId = itemVendorId[it.id];
                const unassigned = assignedVendorId == null;
                return (
                  <div key={it.id} className={`rounded-xl p-3 ${unassigned ? 'bg-red-50 border border-red-200' : 'bg-[#FAF7F2]'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#1C1C1E] truncate">{it.materialName}</p>
                        <p className="text-xs text-[#8E8878]">{it.qtyRequested} {it.unit}</p>
                      </div>
                      {validVendors.length === 1 ? (
                        <div className="text-xs font-semibold text-[#1C1C1E] bg-white px-3 py-2 rounded-lg border border-[#E8DDD0] whitespace-nowrap max-w-[40%] truncate flex-shrink-0">
                          {validVendors[0].vendorName}
                        </div>
                      ) : (
                        <select
                          className={`${inputCls} w-28 sm:w-32 flex-shrink-0 text-xs`}
                          value={assignedVendorId ?? ''}
                          onChange={e => setItemVendor(it.id, e.target.value === '' ? null : Number(e.target.value))}
                        >
                          <option value="">{t('production','mr_select_vendor_option')}</option>
                          {validVendors.map(v => (
                            <option key={v.vendorId} value={v.vendorId}>{v.vendorName}</option>
                          ))}
                        </select>
                      )}
                    </div>
                    {unassigned && (
                      <p className="text-xs text-red-500 mt-1.5">{t('production','mr_vendor_not_assigned')}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <SecondaryButton className="flex-1" onClick={onClose}>Huỷ</SecondaryButton>
          <PrimaryButton className="flex-1" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Đang xử lý...' : 'Xác nhận đặt hàng'}
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

// ── Complete Modal — nhập đơn giá từng NL, chọn NCC, Thanh toán/Công nợ theo NCC ──
function CompleteModal({ req, onClose, onDone }) {
  const { t } = useLang();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const vendors = req.vendors || [];
  const singleVendor = vendors.length === 1 ? vendors[0] : null;

  const receivedItems = (req.items || []).filter(it => it.qtyReceived != null && Number(it.qtyReceived) > 0);

  // itemId -> requestVendorId
  const [itemVendors, setItemVendors] = useState(() => {
    const init = {};
    receivedItems.forEach(it => {
      init[it.id] = it.requestVendorId || (singleVendor ? singleVendor.id : null);
    });
    return init;
  });

  // ── LOẠI GIÁ NHẬP ─────────────────────────────────────────────────────────
  // 'UNIT'  : nhập ĐƠN GIÁ của 1 đơn vị tính  (MẶC ĐỊNH)
  // 'TOTAL' : nhập TỔNG TIỀN của 1 nguyên liệu → tự chia SL ra đơn giá (3 số lẻ)
  const [priceMode, setPriceMode] = useState('UNIT');

  // itemId -> chuỗi người dùng gõ (ý nghĩa tuỳ priceMode). Tối đa 3 số thập phân.
  const [priceInputs, setPriceInputs] = useState(() => {
    const init = {};
    receivedItems.forEach(it => { init[it.id] = ''; });
    return init;
  });

  const setPriceInput = (itemId, raw) => {
    setPriceInputs(p => ({ ...p, [itemId]: clampDecimalInput(raw) }));
    setShowPreview(false);
  };

  const switchMode = (mode) => {
    if (mode === priceMode) return;
    setPriceInputs(prev => {
      const next = {};
      receivedItems.forEach(it => {
        const v = parseMoneyInput(prev[it.id]);
        const qty = Number(it.qtyReceived) || 0;
        if (v === null || !qty) { next[it.id] = ''; return; }
        next[it.id] = mode === 'TOTAL'
          ? String(v * qty)                      // đơn giá → tổng tiền
          : String(unitPriceFromTotal(v, qty));  // tổng tiền → đơn giá (3 số lẻ)
      });
      return next;
    });
    setPriceMode(mode);
    setShowPreview(false);
  };

  // Đơn giá thực tế đã quy đổi theo chế độ nhập
  const unitPrices = useMemo(() => {
    const m = {};
    receivedItems.forEach(it => {
      const v = parseMoneyInput(priceInputs[it.id]);
      const qty = Number(it.qtyReceived) || 0;
      m[it.id] = v === null ? 0 : (priceMode === 'TOTAL' ? unitPriceFromTotal(v, qty) : v);
    });
    return m;
  }, [priceInputs, priceMode, req.id]);

  // ── Thuế/phí tuỳ chỉnh: [{ id, label, amount, itemIds }] ───────────────────
  const [customEntries, setCustomEntries] = useState([]);

  const setItemVendor = (itemId, vendorId) => setItemVendors(p => ({ ...p, [itemId]: vendorId }));

  const addCustomEntry = () => { setShowPreview(false); setCustomEntries(p => [
    ...p,
    { id: Date.now() + Math.random(), label: '', amount: '', itemIds: receivedItems.map(it => it.id) },
  ]); };
  const removeCustomEntry = (id) => { setShowPreview(false); setCustomEntries(p => p.filter(e => e.id !== id)); };
  const updateCustomEntry = (id, patch) => { setShowPreview(false); setCustomEntries(p => p.map(e => e.id === id ? { ...e, ...patch } : e)); };
  const toggleCustomEntryItem = (entryId, itemId) => { setShowPreview(false); setCustomEntries(p => p.map(e => {
    if (e.id !== entryId) return e;
    const has = e.itemIds.includes(itemId);
    return { ...e, itemIds: has ? e.itemIds.filter(x => x !== itemId) : [...e.itemIds, itemId] };
  })); };

  // ── PHÂN BỔ THUẾ/PHÍ → GIÁ VỐN (cùng công thức với backend) ────────────────
  const alloc = useMemo(() => allocateCost(
    receivedItems.map(it => ({
      id: it.id,
      quantity: Number(it.qtyReceived) || 0,
      unitPrice: unitPrices[it.id] || 0,
    })),
    customEntries
      .filter(ce => ce.label.trim() && parseMoneyInput(ce.amount) > 0)
      .map(ce => ({ label: ce.label.trim(), amount: parseMoneyInput(ce.amount), itemIds: ce.itemIds })),
  ), [unitPrices, customEntries, req.id]);

  // Tiền THẬT phải trả NCC của mỗi dòng = giá trị hàng + thuế/phí phân bổ (chưa làm tròn về đồng)
  const itemPayables = {};
  receivedItems.forEach(it => {
    const r = alloc.get(it.id);
    itemPayables[it.id] = r ? r.lineValue + r.feeShare : 0;
  });

  const totalsByVendor = {};
  for (const it of receivedItems) {
    const vendorId = itemVendors[it.id];
    if (!vendorId) continue;
    const amount = itemPayables[it.id] || 0;
    if (!amount) continue;
    totalsByVendor[vendorId] = (totalsByVendor[vendorId] || 0) + amount;
  }
  const vendorsWithAmount = vendors.filter(v => totalsByVendor[v.id] > 0);
  const grandTotal = Object.values(totalsByVendor).reduce((s, v) => s + v, 0);
  const grandMaterialTotal = receivedItems.reduce((s, it) => s + (alloc.get(it.id)?.lineValue || 0), 0);
  const grandFeeTotal = customEntries.reduce((s, ce) => s + (parseMoneyInput(ce.amount) || 0), 0);

  // requestVendorId -> { action, paymentMethod, paymentInfo, proofImages }
  const [vendorDecisions, setVendorDecisions] = useState(() => {
    const init = {};
    vendors.forEach(v => {
      init[v.id] = { action: null, paymentMethod: 'BANK', paymentInfo: '', proofImages: [] };
    });
    return init;
  });
  const setVendorDecision = (vendorId, patch) =>
    setVendorDecisions(p => ({ ...p, [vendorId]: { ...p[vendorId], ...patch } }));

  const allVendorsAssigned = receivedItems.every(it => !!itemVendors[it.id]);
  const allMaterialEntered = receivedItems.every(it => (unitPrices[it.id] || 0) > 0);
  const allCustomValid = customEntries.every(ce => ce.label.trim() && parseMoneyInput(ce.amount) > 0 && ce.itemIds.length > 0);

  const allDecisionsValid = vendorsWithAmount.every(v => {
    const d = vendorDecisions[v.id];
    if (!d || !d.action) return false;
    if (d.action === 'PAID') return d.proofImages.length > 0 && d.paymentMethod;
    return true;
  });
  const vendorsWithoutCatalogLink = vendorsWithAmount.filter(v =>
    vendorDecisions[v.id]?.action === 'DEBT' && !v.vendorId);

  const pricesReady = receivedItems.length > 0 && allMaterialEntered && allCustomValid;
  const canSubmit = pricesReady && allVendorsAssigned
    && vendorsWithAmount.length > 0 && allDecisionsValid && vendorsWithoutCatalogLink.length === 0;

  const handlePreview = () => {
    if (!pricesReady) {
      toast('Vui lòng nhập đủ giá cho tất cả nguyên liệu và hoàn thiện các dòng thuế/phí', 'error');
      return;
    }
    setShowPreview(true);
  };

  const handleSubmit = async () => {
    if (!canSubmit) { toast('Vui lòng nhập đầy đủ giá nguyên liệu, phí/thuế và xử lý thanh toán cho tất cả NCC', 'error'); return; }
    setSaving(true);
    try {
      const itemVendorsPayload = receivedItems.map(it => ({
        itemId: it.id,
        requestVendorId: itemVendors[it.id],
      }));
      const costEntriesPayload = [
        // MATERIAL: luôn gửi ĐƠN GIÁ — server tự nhân với qtyReceived để ra tổng tiền.
        ...receivedItems.map(it => ({
          type: 'MATERIAL',
          label: 'Giá nguyên liệu',
          unitPrice: unitPrices[it.id],
          amount: normalizeMoney((unitPrices[it.id] || 0) * Number(it.qtyReceived || 0)),
          itemIds: [it.id],
        })),
        ...customEntries.map(ce => ({
          type: 'CUSTOM',
          label: ce.label.trim(),
          amount: parseMoneyInput(ce.amount),
          itemIds: ce.itemIds,
        })),
      ];
      const vendorPayments = vendorsWithAmount.map(v => {
        const d = vendorDecisions[v.id];
        return {
          requestVendorId: v.id,
          action: d.action,
          paymentMethod: d.action === 'PAID' ? d.paymentMethod : null,
          paymentInfo: d.action === 'PAID' ? d.paymentInfo : null,
          proofImages: d.action === 'PAID' ? d.proofImages : [],
        };
      });
      await accountantMaterialRequestApi.complete(req.id, {
        itemVendors: itemVendorsPayload,
        costEntries: costEntriesPayload,
        vendorPayments,
      });
      toast(t('production','mr_toast_completed'), 'success');
      onDone();
    } catch (e) { toast(e?.response?.data?.message || t('error','generic'), 'error'); }
    finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title={`Hoàn thành phiếu — ${req.requestCode}`} size="lg">
      <div className="space-y-5">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
          <p className="text-sm font-medium text-emerald-700">{t('production','mr_received')}</p>
          <p className="text-xs text-emerald-600 mt-0.5">
            Nhập giá cho từng nguyên liệu, thêm các loại thuế/phí (nếu có). Thuế/phí được phân bổ
            theo tỷ trọng giá trị từng nguyên liệu; giá vốn chỉ làm tròn tới hàng đồng ở bước cuối.
          </p>
        </div>

        {/* ── Chọn loại giá nhập ── */}
        <div>
          <p className="text-xs font-semibold text-[#8E8878] uppercase tracking-wider mb-2">Loại giá nhập</p>
          <div className="flex gap-2">
            <button onClick={() => switchMode('UNIT')}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition ${priceMode === 'UNIT'
                ? 'bg-[#C9A84C] text-white border-[#C9A84C]' : 'bg-white text-[#8E8878] border-[#E8DDD0]'}`}>
              Đơn giá / 1 đơn vị tính
            </button>
            <button onClick={() => switchMode('TOTAL')}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition ${priceMode === 'TOTAL'
                ? 'bg-[#C9A84C] text-white border-[#C9A84C]' : 'bg-white text-[#8E8878] border-[#E8DDD0]'}`}>
              Tổng tiền của 1 nguyên liệu
            </button>
          </div>
          <p className="text-[11px] text-[#8E8878] mt-1.5">
            Nhập tối đa {MONEY_DECIMALS} số sau dấu thập phân.
            {priceMode === 'TOTAL' && ' Hệ thống tự chia cho số lượng thực nhận để ra đơn giá.'}
          </p>
        </div>

        {/* ── Giá từng dòng nguyên liệu ── */}
        <div>
          <p className="text-xs font-semibold text-[#8E8878] uppercase tracking-wider mb-2">
            Giá nguyên liệu (theo số lượng thực nhận)
          </p>
          {vendors.length === 0 && (
            <p className="text-sm text-red-500 mb-2">
              Phiếu này chưa có nhà cung cấp nào. Vui lòng quay lại bước "Xác nhận đặt hàng" để thêm NCC trước khi hoàn thành.
            </p>
          )}
          <div className="space-y-2">
            {receivedItems.map(it => {
              const r = alloc.get(it.id);
              const up = unitPrices[it.id] || 0;
              return (
                <div key={it.id} className="bg-[#FAF7F2] rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-[#1C1C1E]">{it.materialName}</span>
                    <span className="text-xs text-[#8E8878]">{it.qtyReceived} {it.unit}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {vendors.length > 1 ? (
                      <select className={inputCls} value={itemVendors[it.id] || ''}
                        onChange={e => setItemVendor(it.id, Number(e.target.value) || null)}>
                        <option value="">{t('production','mr_select_vendor_option')}</option>
                        {vendors.map(v => <option key={v.id} value={v.id}>{v.vendorName}</option>)}
                      </select>
                    ) : (
                      <div className="flex items-center px-3 py-2 text-sm text-[#8E8878] bg-white rounded-lg border border-[#E8DDD0]">
                        {singleVendor ? singleVendor.vendorName : '— Chưa có NCC —'}
                      </div>
                    )}
                    <input
                      type="text" inputMode="decimal"
                      className={inputCls}
                      placeholder={priceMode === 'UNIT'
                        ? `Đơn giá / ${it.unit || 'đv'} (đ)`
                        : 'Tổng tiền nguyên liệu (đ)'}
                      value={priceInputs[it.id] ?? ''}
                      onChange={e => setPriceInput(it.id, e.target.value)}
                    />
                  </div>
                  {up > 0 && (
                    <p className="text-right text-xs text-[#1C1C1E]">
                      {priceMode === 'TOTAL'
                        ? <>Đơn giá: <span className="font-semibold text-[#C9A84C]">{fmtMoney(up)} đ/{it.unit}</span></>
                        : <>Thành tiền: <span className="font-semibold text-[#C9A84C]">{fmtMoney(r?.lineValue)} đ</span></>}
                    </p>
                  )}
                </div>
              );
            })}
            {receivedItems.length === 0 && (
              <p className="text-sm text-red-500">{t('production','mr_no_received_qty')}</p>
            )}
          </div>
          {grandMaterialTotal > 0 && (
            <p className="text-right text-xs text-[#8E8878] mt-1.5">
              Tổng tiền nguyên liệu: <span className="font-semibold text-[#1C1C1E]">{fmtMoney(grandMaterialTotal)} đ</span>
            </p>
          )}
        </div>

        {/* ── Thuế/phí tuỳ chỉnh ── */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-[#8E8878] uppercase tracking-wider">
              Thuế / phí khác (mỗi dòng 1 loại)
            </p>
            <button onClick={addCustomEntry}
              className="flex items-center gap-1 text-xs font-semibold text-[#C9A84C] hover:underline">
              <Plus size={13} /> Thêm thuế/phí
            </button>
          </div>

          {customEntries.length === 0 ? (
            <p className="text-xs text-[#8E8878] flex items-center gap-1.5">
              <Info size={12} /> Không có thuế/phí → giá vốn = đơn giá nhập.
            </p>
          ) : (
            <div className="space-y-3">
              {customEntries.map(ce => (
                <div key={ce.id} className="bg-white border border-[#E8DDD0] rounded-xl p-3 space-y-2">
                  <div className="flex gap-2">
                    <input className={inputCls} placeholder={t('production','mr_ph_cost_name')}
                      value={ce.label} onChange={e => updateCustomEntry(ce.id, { label: e.target.value })} />
                    <input type="text" inputMode="decimal" className={`${inputCls} w-40`} placeholder="Số tiền (đ)"
                      value={ce.amount}
                      onChange={e => updateCustomEntry(ce.id, { amount: clampDecimalInput(e.target.value) })} />
                    <button onClick={() => removeCustomEntry(ce.id)}
                      className="p-2 rounded-lg hover:bg-red-50 text-red-400 transition flex-shrink-0">
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div>
                    <p className="text-[10px] text-[#8E8878] mb-1">{t('production','mr_apply_to')}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {receivedItems.map(it => {
                        const checked = ce.itemIds.includes(it.id);
                        return (
                          <button key={it.id} onClick={() => toggleCustomEntryItem(ce.id, it.id)}
                            className={`text-xs px-2 py-1 rounded-full border transition ${checked
                              ? 'bg-[#C9A84C]/10 border-[#C9A84C] text-[#C9A84C] font-semibold'
                              : 'bg-white border-[#E8DDD0] text-[#8E8878]'}`}>
                            {checked ? '✓ ' : ''}{it.materialName}
                          </button>
                        );
                      })}
                    </div>
                    {ce.itemIds.length === 0 && (
                      <p className="text-xs text-red-500 mt-1">{t('production','mr_no_material_selected')}</p>
                    )}
                  </div>
                </div>
              ))}
              <p className="text-right text-xs text-[#8E8878]">
                Tổng thuế/phí: <span className="font-semibold text-[#1C1C1E]">{fmtMoney(grandFeeTotal)} đ</span>
              </p>
            </div>
          )}
        </div>

        {/* ── PREVIEW giá vốn tạm tính ── */}
        <div>
          <button onClick={handlePreview} disabled={!pricesReady}
            className="w-full py-2.5 rounded-xl border border-[#C9A84C] text-[#C9A84C] font-semibold hover:bg-[#C9A84C]/10 transition disabled:opacity-40 flex items-center justify-center gap-2">
            <Eye size={16} /> Xem trước giá vốn tạm tính
          </button>

          {showPreview && (
            <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-xl p-3 space-y-2">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[#6b7280] border-b border-emerald-200">
                      <th className="text-left py-1.5 font-semibold">Nguyên liệu</th>
                      <th className="text-right py-1.5 font-semibold">SL</th>
                      <th className="text-right py-1.5 font-semibold">Đơn giá</th>
                      <th className="text-right py-1.5 font-semibold">Thuế/phí gánh</th>
                      <th className="text-right py-1.5 font-semibold">Giá vốn / đv</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receivedItems.map(it => {
                      const r = alloc.get(it.id);
                      if (!r) return null;
                      return (
                        <tr key={it.id} className="border-b border-emerald-100 last:border-0">
                          <td className="py-1.5 text-[#1C1C1E]">{it.materialName}</td>
                          <td className="py-1.5 text-right tabular-nums">{it.qtyReceived} {it.unit}</td>
                          <td className="py-1.5 text-right tabular-nums">{fmtMoney(r.unitPrice)}</td>
                          <td className="py-1.5 text-right tabular-nums text-amber-700">
                            {r.feeShare > 0 ? fmtMoney(r.feeShare) : '—'}
                          </td>
                          <td className="py-1.5 text-right tabular-nums font-bold text-emerald-800">
                            {fmtDong(r.unitCost)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-emerald-700">
                Giá vốn làm tròn tới hàng đơn vị đồng ở bước cuối; các bước trung gian giữ nguyên phần thập phân.
              </p>
            </div>
          )}
        </div>

        {/* ── Thanh toán / Công nợ theo từng NCC ── */}
        {vendorsWithAmount.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-[#8E8878] uppercase tracking-wider mb-2">
              Thanh toán cho từng nhà cung cấp
            </p>
            <div className="space-y-3">
              {vendorsWithAmount.map(v => {
                const total = totalsByVendor[v.id] || 0;
                const d = vendorDecisions[v.id];
                const missingCatalogLink = d.action === 'DEBT' && !v.vendorId;
                return (
                  <div key={v.id} className="bg-white border border-[#E8DDD0] rounded-xl p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-[#1C1C1E]">{v.vendorName}</p>
                      <p className="text-sm font-bold text-[#C9A84C]">{fmtMoney(total)} đ</p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all ${d.action === 'PAID' ? 'bg-[#1A2B1A] text-white border-[#1A2B1A]' : 'bg-white text-[#8E8878] border-[#E8DDD0]'}`}
                        onClick={() => setVendorDecision(v.id, { action: 'PAID' })}>
                        Thanh toán luôn
                      </button>
                      <button
                        className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all ${d.action === 'DEBT' ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-[#8E8878] border-[#E8DDD0]'}`}
                        onClick={() => setVendorDecision(v.id, { action: 'DEBT' })}>
                        Công nợ
                      </button>
                    </div>

                    {d.action === 'PAID' && (
                      <div className="space-y-2 pt-1">
                        <div className="grid grid-cols-2 gap-2">
                          <select className={inputCls} value={d.paymentMethod}
                            onChange={e => setVendorDecision(v.id, { paymentMethod: e.target.value })}>
                            {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                          </select>
                          <input className={inputCls}
                            placeholder={d.paymentMethod === 'CASH' ? 'Ghi chú tiền mặt' : 'Số TK / nội dung CK'}
                            value={d.paymentInfo}
                            onChange={e => setVendorDecision(v.id, { paymentInfo: e.target.value })}/>
                        </div>
                        <InvoiceUploader
                          requestId={req.id}
                          value={d.proofImages}
                          onChange={imgs => setVendorDecision(v.id, { proofImages: imgs })}
                          label="Chứng từ thanh toán"
                        />
                        {d.proofImages.length === 0 && (
                          <p className="text-xs text-red-500">{t('production','mr_need_receipt')}</p>
                        )}
                      </div>
                    )}

                    {d.action === 'DEBT' && missingCatalogLink && (
                      <p className="text-xs text-red-500">
                        NCC này chưa liên kết với danh mục Nhà cung cấp nên không thể ghi công nợ.
                        Vui lòng quay lại bước "Xác nhận đặt hàng" và chọn NCC có sẵn trong danh mục.
                      </p>
                    )}
                    {d.action === 'DEBT' && !missingCatalogLink && (
                      <p className="text-xs text-amber-700">
                        Sẽ cộng {fmtMoney(total)} đ vào công nợ của {v.vendorName}.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {grandTotal > 0 && (
          <div className="pt-2 border-t border-black/5 flex items-center justify-between">
            <span className="text-sm font-semibold text-[#1C1C1E]">{t('production','mr_total_amount')}</span>
            <span className="text-lg font-bold text-[#C9A84C]">{fmtMoney(grandTotal)} đ</span>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <SecondaryButton className="flex-1" onClick={onClose}>Huỷ</SecondaryButton>
          <PrimaryButton className="flex-1" onClick={handleSubmit}
            disabled={saving || !canSubmit || !showPreview}
            title={!showPreview ? 'Bấm "Xem trước giá vốn" để kiểm tra trước khi lưu' : ''}>
            {saving ? 'Đang xử lý...' : 'Hoàn thành phiếu'}
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

// ── Request Card ──────────────────────────────────────────────────────────────
// ── Modal gia hạn ngày giao hàng ───────────────────────────────────────────────
function ExtendDeliveryModal({ req, onClose, onDone }) {
  const { t } = useLang();
  const toast = useToast();
  const [newDate, setNewDate] = useState(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!newDate) { toast(t('production','mr_err_new_date'), 'error'); return; }
    setSaving(true);
    try {
      await accountantMaterialRequestApi.extendDelivery(req.id, {
        newDeliveryDate: newDate,
        reason: reason.trim() || null,
      });
      toast(t('production','mr_toast_extended'), 'success');
      onDone();
    } catch (e) {
      toast(e?.response?.data?.message || t('error','generic'), 'error');
    } finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title={`Gia hạn giao hàng — ${req.requestCode}`} size="sm">
      <div className="space-y-4">
        <div>
          <p className="text-xs text-[#8E8878] mb-1">
            Ngày giao hiện tại: <span className="font-semibold text-[#1C1C1E]">{req.estimatedDelivery ? fmtDateTime(req.estimatedDelivery) : '—'}</span>
          </p>
          {req.deliveryExtendedTo && (
            <p className="text-xs text-amber-700 mb-1">
              Đã gia hạn trước đó: {fmtDateTime(req.deliveryExtendedTo)}
              {req.deliveryExtendReason ? ` — ${req.deliveryExtendReason}` : ''}
            </p>
          )}
        </div>
        <Field label="Ngày giao hàng mới" required>
          <DatePicker value={newDate} onChange={setNewDate} placeholder={t('production','mr_ph_new_date')} minDate={new Date()} />
        </Field>
        <Field label="Lý do gia hạn">
          <textarea className={inputCls} rows={2} value={reason} onChange={e => setReason(e.target.value)}
            placeholder={t('production','mr_ph_extend_reason')} />
        </Field>
        <div className="flex gap-2">
          <SecondaryButton className="flex-1" onClick={onClose}>Huỷ</SecondaryButton>
          <PrimaryButton className="flex-1" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Đang lưu...' : 'Gia hạn'}
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

function RequestCard({ req, onConfirmOrder, onComplete, onExtendDelivery }) {
  const { t } = useLang();
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CONFIG[req.status] || STATUS_CONFIG.NEW;
  const bg = cardBg(req);

  return (
    <div className={`rounded-2xl border ${bg} border-black/5 shadow-sm overflow-hidden`}>
      <button className="w-full text-left px-5 py-4" onClick={() => setExpanded(e => !e)}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm font-bold text-[#1C1C1E]">{req.requestCode}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.cls}`}>{cfg.label}</span>
              {req.status === 'RECEIVED' && (
                <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">{t('production','mr_status_pending')}</span>
              )}
            </div>
            <p className="text-xs text-[#8E8878] mt-1">
              {req.createdByName} · {req.itemCount} nguyên liệu · {fmtTs(req.createdAt)}
            </p>
            {/* Countdown badges — hiển thị trên card */}
            <div className="mt-2 flex flex-wrap gap-2">
              {req.requiredBy && req.status === 'NEW' && (
                <LiveCountdownBadge targetMs={req.requiredBy} label="Cần xử lý trong"/>
              )}
              {req.estimatedDelivery && req.status === 'ORDERED' && (
                <LiveCountdownBadge targetMs={req.estimatedDelivery} label="Giao hàng trong"/>
              )}
            </div>
          </div>
          {expanded
            ? <ChevronUp size={16} className="text-[#8E8878] flex-shrink-0 mt-1"/>
            : <ChevronDown size={16} className="text-[#8E8878] flex-shrink-0 mt-1"/>}
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-4 border-t border-black/5">
          {/* Danh sách nguyên liệu */}
          <div className="mt-3">
            <p className="text-xs font-semibold text-[#8E8878] uppercase tracking-wider mb-2">{t('production','pcalc_ingredients')}</p>
            <div className="space-y-2">
              {(req.items || []).map((it, i) => (
                <div key={i} className="flex items-center justify-between bg-[#FAF7F2] rounded-xl px-3 py-2">
                  <div>
                    <span className="text-sm text-[#1C1C1E] font-medium">{it.materialName}</span>
                    {it.suppliedByVendorName && (
                      <p className="text-xs text-[#8E8878]">{it.suppliedByVendorName}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-[#1C1C1E]">{it.qtyRequested}</span>
                    <span className="text-xs text-[#8E8878] ml-1">{it.unit}</span>
                    {it.qtyReceived != null && (
                      <span className="ml-2 text-xs text-emerald-600">(nhận: {it.qtyReceived})</span>
                    )}
                    {it.lineAmount != null && (
                      <p className="text-xs text-[#C9A84C] font-semibold">{fmtVND(it.lineAmount)}</p>
                    )}
                    {it.costBreakdown?.length > 1 && (
                      <p className="text-[10px] text-[#8E8878] mt-0.5">
                        {it.costBreakdown.map((b, bi) => `${b.label}: ${fmtVND(b.amount)}`).join(' · ')}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Nhà cung cấp (nếu đã có) */}
          {req.vendors?.length > 0 && (
            <div className="mt-3 pt-3 border-t border-black/5">
              <p className="text-xs font-semibold text-[#8E8878] uppercase tracking-wider mb-1">{t('production','metrics_vendor')}</p>
              {req.vendors.map((v, i) => (
                <div key={i} className="flex items-center justify-between text-xs text-[#1C1C1E] py-0.5">
                  <span>
                    {v.vendorName}{v.contactPerson ? ` · ${v.contactPerson}` : ''}{v.contactPhone ? ` · ${v.contactPhone}` : ''}
                  </span>
                  {v.paymentStatus === 'PAID' && (
                    <span className="text-emerald-600 font-semibold">Đã thanh toán {fmtVND(v.totalAmount)}</span>
                  )}
                  {v.paymentStatus === 'DEBT' && (
                    <span className="text-amber-700 font-semibold">
                      Công nợ {fmtVND(v.debtRemaining)}
                      {v.debtSettlementStatus === 'SETTLED' ? ' (đã trả hết)' : v.debtSettlementStatus === 'PARTIAL' ? ' (đã trả 1 phần)' : ''}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Thời gian giao nếu đã đặt */}
          {req.estimatedDelivery && req.status !== 'NEW' && (
            <div className="mt-2 space-y-0.5">
              <p className="text-xs text-[#8E8878]">
                🚚 Dự kiến giao: <span className="font-medium text-[#1C1C1E]">{fmtDateTime(req.estimatedDelivery)}</span>
              </p>
              {req.deliveryExtendedTo && (
                <p className="text-xs text-amber-700">
                  📅 Gia hạn đến: <span className="font-semibold">{fmtDateTime(req.deliveryExtendedTo)}</span>
                  {req.deliveryExtendReason ? <span className="text-[#8E8878]"> — {req.deliveryExtendReason}</span> : ''}
                </p>
              )}
            </div>
          )}

          {/* Actions */}
          {req.status === 'NEW' && (
            <div className="mt-4">
              <PrimaryButton className="w-full" onClick={() => onConfirmOrder(req)}>
                Xác nhận đặt hàng
              </PrimaryButton>
            </div>
          )}

          {req.status === 'ORDERED' && (
            <div className="mt-4 flex gap-2">
              <SecondaryButton className="flex-1 flex items-center justify-center gap-1.5" onClick={() => onExtendDelivery(req)}>
                <CalendarClock size={14} /> Gia hạn giao hàng
              </SecondaryButton>
            </div>
          )}

          {req.status === 'RECEIVED' && (
            <div className="mt-4">
              <p className="text-xs text-emerald-600 mb-2">✓ Nhận hàng lúc {fmtDateTime(req.receivedAt)}</p>
              <PrimaryButton className="w-full" onClick={() => onComplete(req)}>
                <Check size={14} className="mr-2"/> Hoàn thành phiếu
              </PrimaryButton>
            </div>
          )}

          {req.status === 'COMPLETED' && req.completedAt && (
            <p className="mt-3 text-xs text-gray-500">
              ✓ Hoàn thành {fmtDateTime(req.completedAt)}
              {req.totalAmount != null && <> · Tổng tiền: <span className="font-semibold text-[#1C1C1E]">{fmtVND(req.totalAmount)}</span></>}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SuperAccountantMaterialRequestPage() {
  const { t } = useLang();
  const { fmtCurrency, fmtDate, fmtDateTime } = useFmt();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useMinLoading();
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [completeTarget, setCompleteTarget] = useState(null);
  const [extendTarget, setExtendTarget] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateRange, setDateRange] = useState({ from: null, to: null });
  const [page, setPage] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await accountantMaterialRequestApi.list({
        status: statusFilter || undefined,
        dateFrom: dateRange.from || undefined,
        dateTo: dateRange.to || undefined,
        search: search || undefined,
        page,
      });
      setData(res);
    } finally { setLoading(false); }
  }, [statusFilter, dateRange, search, page]);

  useEffect(() => { load(); }, [load]);

  const requests = data?.content || [];

  return (
    <div className="p-4 space-y-4 bg-[#F5F0EB] min-h-full">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#1C1C1E]">{t('production','mr_title')}</h1>
      </div>

      <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-4 space-y-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8878]"/>
          <input
            className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-[#E8DDD0] focus:outline-none focus:border-[#C9A84C] bg-[#FAF7F2] placeholder-[#8E8878]"
            placeholder={t('production','mr_search_ph')}
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { val: '', label: 'Tất cả' }, { val: 'NEW', label: 'Mới tạo' },
            { val: 'ORDERED', label: 'Đã đặt' }, { val: 'RECEIVED', label: 'Đã nhận' },
            { val: 'COMPLETED', label: 'Hoàn thành' },
          ].map(s => (
            <button key={s.val} onClick={() => { setStatusFilter(s.val); setPage(0); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${statusFilter === s.val ? 'bg-[#1A2B1A] text-white border-[#1A2B1A]' : 'bg-white text-[#8E8878] border-[#E8DDD0] hover:border-[#1A2B1A]'}`}>
              {s.label}
            </button>
          ))}
          <DateRangePicker from={dateRange.from} to={dateRange.to} onChange={r => { setDateRange(r); setPage(0); }} placeholder={t('production','mr_filter_date')}/>
        </div>
      </div>

      {loading
        ? <div className="space-y-3">{[1,2,3].map(i => <CardSkeleton key={i}/>)}</div>
        : requests.length === 0
          ? <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-10 text-center">
              <Package size={32} className="mx-auto text-[#8E8878] mb-2"/>
              <p className="text-[#8E8878] text-sm">{t('production','mr_empty')}</p>
            </div>
          : <div className="space-y-3">
              {requests.map(req => (
                <RequestCard key={req.id} req={req} onConfirmOrder={setConfirmTarget} onComplete={setCompleteTarget} onExtendDelivery={setExtendTarget}/>
              ))}
            </div>
      }

      {data?.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
            className="px-4 py-2 rounded-xl border border-[#E8DDD0] text-sm disabled:opacity-40 hover:bg-[#F0EBE3]">{t('production','mr_prev')}</button>
          <span className="px-4 py-2 text-sm text-[#8E8878]">{page + 1} / {data.totalPages}</span>
          <button disabled={page >= data.totalPages - 1} onClick={() => setPage(p => p + 1)}
            className="px-4 py-2 rounded-xl border border-[#E8DDD0] text-sm disabled:opacity-40 hover:bg-[#F0EBE3]">{t('production','mr_next')}</button>
        </div>
      )}

      {confirmTarget && (
        <ConfirmOrderModal req={confirmTarget} onClose={() => setConfirmTarget(null)} onDone={() => { setConfirmTarget(null); load(); }}/>
      )}
      {completeTarget && (
        <CompleteModal req={completeTarget} onClose={() => setCompleteTarget(null)} onDone={() => { setCompleteTarget(null); load(); }}/>
      )}
      {extendTarget && (
        <ExtendDeliveryModal req={extendTarget} onClose={() => setExtendTarget(null)} onDone={() => { setExtendTarget(null); load(); }}/>
      )}
    </div>
  );
}