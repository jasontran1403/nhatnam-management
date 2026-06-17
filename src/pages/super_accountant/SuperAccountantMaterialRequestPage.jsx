// src/pages/super_accountant/SuperAccountantMaterialRequestPage.jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Package, ChevronDown, ChevronUp, Plus, X, Check, Camera, Loader2 } from 'lucide-react';
import useMinLoading from '../../hooks/useMinLoading.js';
import { Field, inputCls, PrimaryButton, SecondaryButton } from '../../components/ui';
import { CardSkeleton } from '../../components/ui/Skeleton.jsx';
import Modal from '../../components/ui/Modal.jsx';
import DateRangePicker from '../../components/ui/DateRangePicker.jsx';
import DatePicker from '../../components/ui/DatePicker.jsx';
import {
  accountantMaterialRequestApi, STATUS_CONFIG, fmtTs, fmtDateTime, countdownInfo,
} from '../../api/materialRequestApi.js';
import { factoryProdApi } from '../../api/productionModuleApi.js';
import { useToast } from '../../components/common/Toast.jsx';
import api from '../../api/axios.js';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
const imgUrl = (p) => { if (!p) return ''; if (p.startsWith('http')) return p; return BASE_URL + "/api/auth" + p; };

// ── Countdown badge — đếm ngược giây ─────────────────────────────────────────
function CountdownBadge({ targetMs, label }) {
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
  if (diff <= 0) return { label: 'Đã quá hạn', color: 'red' };
  const totalSec = Math.floor(diff / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h < 1) return { label: `${m}p ${s}s`, color: totalSec < 600 ? 'red' : 'yellow' };
  if (h < 24) return { label: `${h}g ${m}p`, color: h < 6 ? 'red' : 'yellow' };
  const d = Math.floor(h / 24);
  return { label: `${d} ngày ${h % 24}g`, color: 'normal' };
}

function LiveCountdownBadge({ targetMs, label }) {
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

// ── Upload hóa đơn ────────────────────────────────────────────────────────────
function InvoiceUploader({ requestId, value = [], onChange }) {
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
    } catch (e) { toast(e?.response?.data?.message || 'Upload thất bại', 'error'); }
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
    } catch { toast('Không thể mở camera', 'error'); }
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
        Hóa đơn / Chứng từ <span className="text-red-500">*</span>
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
          <span className="text-[10px] text-[#C9A84C] font-medium">Chụp</span>
        </button>
        <button type="button" onClick={() => fileRef.current?.click()}
          className="w-20 h-20 rounded-xl border-2 border-dashed border-[#E8DDD0] flex flex-col items-center justify-center hover:border-[#C9A84C] hover:bg-[#C9A84C]/5 gap-1">
          <Plus size={20} className="text-[#8E8878]"/>
          <span className="text-[10px] text-[#8E8878]">Chọn</span>
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

// ── Vendor search ─────────────────────────────────────────────────────────────
function VendorSearchInput({ value, onChange }) {
  const [q, setQ] = useState(value?.vendorName || '');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const search = async (text) => {
    setQ(text);
    onChange({ vendorName: text });
    if (!text.trim()) { setResults([]); return; }
    try {
      const res = await factoryProdApi.listVendors(text, 'MATERIAL');
      setResults(res || []); setOpen(true);
    } catch { setResults([]); }
  };

  const select = (v) => {
    setQ(v.name); setOpen(false);
    onChange({ vendorId: v.id, vendorName: v.name, contactPerson: v.contactPerson || '', contactPhone: v.contactPhone || '' });
  };

  return (
    <div className="relative" ref={ref}>
      <input className={inputCls} placeholder="Tên nhà cung cấp..." value={q} onChange={e => search(e.target.value)} onFocus={() => results.length && setOpen(true)}/>
      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 bg-white border border-[#E8DDD0] rounded-xl shadow-lg mt-1 max-h-40 overflow-auto">
          {results.map(v => (
            <button key={v.id} className="w-full text-left px-3 py-2 text-sm hover:bg-[#FAF7F2]" onClick={() => select(v)}>
              <p className="font-medium text-[#1C1C1E]">{v.name}</p>
              {v.contactPhone && <p className="text-xs text-[#8E8878]">{v.contactPhone}</p>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Confirm Order Modal — datetime picker (ngày + giờ phút) ──────────────────
function ConfirmOrderModal({ req, onClose, onDone }) {
  const toast = useToast();
  // Date + time riêng để dễ nhập
  const [deliveryDate, setDeliveryDate] = useState(null);    // timestamp ms (chỉ ngày)
  const [deliveryTime, setDeliveryTime] = useState('08:00'); // "HH:mm"
  const [vendors, setVendors] = useState([{ vendorId: null, vendorName: '', contactPerson: '', contactPhone: '' }]);
  const [saving, setSaving] = useState(false);

  // Combine date + time thành timestamp
  const getEstDeliveryMs = () => {
    if (!deliveryDate) return null;
    const d = new Date(deliveryDate);
    const [h, m] = (deliveryTime || '08:00').split(':').map(Number);
    d.setHours(h || 0, m || 0, 0, 0);
    return d.getTime();
  };

  const addVendor = () => setVendors(p => [...p, { vendorId: null, vendorName: '', contactPerson: '', contactPhone: '' }]);
  const removeVendor = (i) => setVendors(p => p.filter((_, idx) => idx !== i));
  const setVendor = (i, data) => setVendors(p => p.map((v, idx) => idx === i ? { ...v, ...data } : v));

  const handleSubmit = async () => {
    const estDelivery = getEstDeliveryMs();
    if (!estDelivery) { toast('Vui lòng chọn thời gian giao hàng dự kiến', 'error'); return; }
    setSaving(true);
    try {
      await accountantMaterialRequestApi.confirmOrder(req.id, {
        estimatedDelivery: estDelivery,
        vendors: vendors.filter(v => v.vendorName.trim()).map((v, i) => ({ ...v, sortOrder: i })),
      });
      toast('Đã xác nhận đặt hàng', 'success');
      onDone();
    } catch (e) {
      toast(e?.response?.data?.message || 'Có lỗi xảy ra', 'error');
    } finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title={`Xác nhận đặt hàng — ${req.requestCode}`}>
      <div className="space-y-4">
        {/* Danh sách nguyên liệu */}
        <div className="bg-[#FAF7F2] rounded-xl p-3 space-y-2">
          <p className="text-xs font-semibold text-[#8E8878] uppercase tracking-wider mb-2">Nguyên liệu đặt</p>
          {(req.items || []).map((it, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="text-[#1C1C1E] font-medium">{it.materialName}</span>
              <span className="text-[#8E8878]">{it.qtyRequested} {it.unit}</span>
            </div>
          ))}
        </div>

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
                placeholder="Chọn ngày giao"
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
              <span className="text-xs text-[#8E8878]">giờ giao</span>
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
            <p className="text-sm font-medium text-[#1C1C1E]">Nhà cung cấp</p>
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
                <VendorSearchInput value={v} onChange={data => setVendor(i, data)}/>
                <div className="grid grid-cols-2 gap-2">
                  <input className={inputCls} placeholder="Người liên hệ" value={v.contactPerson}
                    onChange={e => setVendor(i, { contactPerson: e.target.value })}/>
                  <input className={inputCls} placeholder="Số điện thoại" value={v.contactPhone}
                    onChange={e => setVendor(i, { contactPhone: e.target.value })}/>
                </div>
              </div>
            ))}
          </div>
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

// ── Complete Modal ─────────────────────────────────────────────────────────────
function CompleteModal({ req, onClose, onDone }) {
  const toast = useToast();
  const [invoiceImages, setInvoiceImages] = useState([]);
  const [saving, setSaving] = useState(false);

  const handleComplete = async () => {
    if (invoiceImages.length === 0) { toast('Vui lòng upload ít nhất 1 hóa đơn', 'error'); return; }
    setSaving(true);
    try {
      await accountantMaterialRequestApi.complete(req.id, { invoiceImages });
      toast('Hoàn thành phiếu thành công', 'success');
      onDone();
    } catch (e) { toast(e?.response?.data?.message || 'Có lỗi xảy ra', 'error'); }
    finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title={`Hoàn thành phiếu — ${req.requestCode}`}>
      <div className="space-y-4">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
          <p className="text-sm font-medium text-emerald-700">✓ Đã nhận hàng</p>
          <p className="text-xs text-emerald-600 mt-0.5">Upload hóa đơn / chứng từ để đóng phiếu.</p>
        </div>
        <InvoiceUploader requestId={req.id} value={invoiceImages} onChange={setInvoiceImages}/>
        {invoiceImages.length === 0 && <p className="text-xs text-red-500">Bắt buộc ít nhất 1 hóa đơn.</p>}
        <div className="flex gap-2 pt-2">
          <SecondaryButton className="flex-1" onClick={onClose}>Huỷ</SecondaryButton>
          <PrimaryButton className="flex-1" onClick={handleComplete} disabled={saving || invoiceImages.length === 0}>
            {saving ? 'Đang xử lý...' : 'Hoàn thành phiếu'}
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

// ── Request Card ──────────────────────────────────────────────────────────────
function RequestCard({ req, onConfirmOrder, onComplete }) {
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
                <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">Chờ thanh toán</span>
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
            <p className="text-xs font-semibold text-[#8E8878] uppercase tracking-wider mb-2">Nguyên liệu</p>
            <div className="space-y-2">
              {(req.items || []).map((it, i) => (
                <div key={i} className="flex items-center justify-between bg-[#FAF7F2] rounded-xl px-3 py-2">
                  <span className="text-sm text-[#1C1C1E] font-medium">{it.materialName}</span>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-[#1C1C1E]">{it.qtyRequested}</span>
                    <span className="text-xs text-[#8E8878] ml-1">{it.unit}</span>
                    {it.qtyReceived != null && (
                      <span className="ml-2 text-xs text-emerald-600">(nhận: {it.qtyReceived})</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Nhà cung cấp (nếu đã có) */}
          {req.vendors?.length > 0 && (
            <div className="mt-3 pt-3 border-t border-black/5">
              <p className="text-xs font-semibold text-[#8E8878] uppercase tracking-wider mb-1">Nhà cung cấp</p>
              {req.vendors.map((v, i) => (
                <p key={i} className="text-xs text-[#1C1C1E]">
                  {v.vendorName}{v.contactPerson ? ` · ${v.contactPerson}` : ''}{v.contactPhone ? ` · ${v.contactPhone}` : ''}
                </p>
              ))}
            </div>
          )}

          {/* Thời gian giao nếu đã đặt */}
          {req.estimatedDelivery && req.status !== 'NEW' && (
            <p className="mt-2 text-xs text-[#8E8878]">
              🚚 Dự kiến giao: <span className="font-medium text-[#1C1C1E]">{fmtDateTime(req.estimatedDelivery)}</span>
            </p>
          )}

          {/* Actions */}
          {req.status === 'NEW' && (
            <div className="mt-4">
              <PrimaryButton className="w-full" onClick={() => onConfirmOrder(req)}>
                Xác nhận đặt hàng
              </PrimaryButton>
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
            <p className="mt-3 text-xs text-gray-500">✓ Hoàn thành {fmtDateTime(req.completedAt)}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SuperAccountantMaterialRequestPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useMinLoading();
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [completeTarget, setCompleteTarget] = useState(null);
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
        <h1 className="text-xl font-bold text-[#1C1C1E]">Phiếu đặt hàng nguyên liệu</h1>
      </div>

      <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-4 space-y-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8878]"/>
          <input
            className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-[#E8DDD0] focus:outline-none focus:border-[#C9A84C] bg-[#FAF7F2] placeholder-[#8E8878]"
            placeholder="Tìm mã phiếu, tên người đặt..."
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
          <DateRangePicker from={dateRange.from} to={dateRange.to} onChange={r => { setDateRange(r); setPage(0); }} placeholder="Lọc theo ngày"/>
        </div>
      </div>

      {loading
        ? <div className="space-y-3">{[1,2,3].map(i => <CardSkeleton key={i}/>)}</div>
        : requests.length === 0
          ? <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-10 text-center">
              <Package size={32} className="mx-auto text-[#8E8878] mb-2"/>
              <p className="text-[#8E8878] text-sm">Không có phiếu nào</p>
            </div>
          : <div className="space-y-3">
              {requests.map(req => (
                <RequestCard key={req.id} req={req} onConfirmOrder={setConfirmTarget} onComplete={setCompleteTarget}/>
              ))}
            </div>
      }

      {data?.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
            className="px-4 py-2 rounded-xl border border-[#E8DDD0] text-sm disabled:opacity-40 hover:bg-[#F0EBE3]">Trước</button>
          <span className="px-4 py-2 text-sm text-[#8E8878]">{page + 1} / {data.totalPages}</span>
          <button disabled={page >= data.totalPages - 1} onClick={() => setPage(p => p + 1)}
            className="px-4 py-2 rounded-xl border border-[#E8DDD0] text-sm disabled:opacity-40 hover:bg-[#F0EBE3]">Tiếp</button>
        </div>
      )}

      {confirmTarget && (
        <ConfirmOrderModal req={confirmTarget} onClose={() => setConfirmTarget(null)} onDone={() => { setConfirmTarget(null); load(); }}/>
      )}
      {completeTarget && (
        <CompleteModal req={completeTarget} onClose={() => setCompleteTarget(null)} onDone={() => { setCompleteTarget(null); load(); }}/>
      )}
    </div>
  );
}