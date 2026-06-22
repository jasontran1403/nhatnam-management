// src/pages/factory_worker/FactoryMachinePage.jsx
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Settings2, Plus, CheckCircle2, AlertTriangle,
  Camera, Loader2, ChevronDown, ChevronRight, Search, X,
} from 'lucide-react';
import Modal from '../../components/ui/Modal';
import { PrimaryButton, SecondaryButton, Field, inputCls } from '../../components/ui';
import { ownerProdApi, factoryProdApi, fmtDate, fmtCurrency } from '../../api/productionModuleApi';
import { useToast } from '../../components/common/Toast';
import { useAuth } from '../../context/AuthContext';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
const imgUrl = p => p?.startsWith('http') ? p : BASE_URL + '/api/auth' + p;

const MAINT_STATUS_CFG = {
  PLANNED:     { label: 'Đã lên lịch',     cls: 'bg-blue-100 text-blue-700' },
  IN_PROGRESS: { label: 'Đang thực hiện',  cls: 'bg-orange-100 text-orange-700' },
  COMPLETED:   { label: 'Hoàn thành',      cls: 'bg-emerald-100 text-emerald-700' },
  ADJUSTED:    { label: 'Điều chỉnh',      cls: 'bg-purple-100 text-purple-700' },
  MISSED:      { label: 'Bỏ lỡ',           cls: 'bg-gray-100 text-gray-600' },
};
const MACHINE_STATUS_CFG = {
  ACTIVE:            { label: 'Hoạt động',          cls: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-400 animate-pulse' },
  INACTIVE:          { label: 'Không hoạt động',    cls: 'bg-gray-100 text-gray-600',       dot: 'bg-gray-300' },
  UNDER_MAINTENANCE: { label: '🔧 Đang bảo trì',    cls: 'bg-red-100 text-red-700',         dot: 'bg-red-400 animate-pulse' },
};
const VENDOR_TYPE_LABELS = { MATERIAL: 'Nguyên liệu', MACHINE: 'Máy móc', REPAIR: 'Sửa chữa' };

// ── Image uploader ─────────────────────────────────────────────────────────────
function ImageUploader({ label, onUpload, uploaded = [] }) {
  const ref = useRef();
  const [previews, setPreviews] = useState([]);
  const [uploading, setUploading] = useState(false);
  const handleFiles = async files => {
    const arr = Array.from(files); if (!arr.length) return;
    const lp = arr.map(f => URL.createObjectURL(f));
    setPreviews(p => [...p, ...lp]); setUploading(true);
    try { await onUpload(arr); setPreviews(p => p.filter(x => !lp.includes(x))); }
    finally { setUploading(false); }
  };
  return (
    <div>
      {label && <p className="text-xs font-semibold text-[#8E8878] uppercase tracking-wider mb-2">{label}</p>}
      <div className="flex gap-2 flex-wrap">
        {uploaded.map((u, i) => <div key={i} className="w-16 h-16 rounded-xl overflow-hidden border border-black/10"><img src={imgUrl(u)} alt="" className="w-full h-full object-cover"/></div>)}
        {previews.map((p, i) => (
          <div key={`p${i}`} className="w-16 h-16 rounded-xl overflow-hidden border border-black/10 relative">
            <img src={p} alt="" className="w-full h-full object-cover"/>
            {uploading && <div className="absolute inset-0 bg-black/40 flex items-center justify-center"><Loader2 size={10} className="text-white animate-spin"/></div>}
          </div>
        ))}
        <button type="button" onClick={() => ref.current?.click()}
          className="w-16 h-16 rounded-xl border-2 border-dashed border-[#C9A84C]/40 flex flex-col items-center justify-center hover:border-[#C9A84C] hover:bg-[#C9A84C]/5">
          <Camera size={18} className="text-[#C9A84C]"/><span className="text-[10px] text-[#C9A84C] mt-0.5">Thêm</span>
        </button>
        <input ref={ref} type="file" multiple accept="image/*" className="hidden" onChange={e => handleFiles(e.target.files)}/>
      </div>
    </div>
  );
}

// ── Vendor Search Input ────────────────────────────────────────────────────────
function VendorSearchInput({ value, onChange, types = 'MACHINE,REPAIR', onCreateNew }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef();

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const search = useCallback(async q => {
    setLoading(true);
    try { const r = await factoryProdApi.listVendors(q, types); setResults(r || []); }
    finally { setLoading(false); }
  }, [types]);

  useEffect(() => {
    const t = setTimeout(() => { if (open) search(query); }, 200);
    return () => clearTimeout(t);
  }, [query, open, search]);

  const handleOpen = () => { setOpen(true); search(query); };
  const select = v => { onChange(v); setQuery(v.name); setOpen(false); };
  const clear = () => { onChange(null); setQuery(''); };

  return (
    <div className="relative" ref={ref}>
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8878] pointer-events-none"/>
        <input className={`${inputCls} pl-8 pr-8`}
          placeholder="Tìm nhà cung cấp..."
          value={query} onFocus={handleOpen}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
        />
        {value && <button onClick={clear} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8E8878] hover:text-[#1C1C1E]"><X size={14}/></button>}
      </div>
      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border border-black/10 rounded-xl shadow-lg overflow-hidden">
          {loading && <div className="px-3 py-2 text-xs text-[#8E8878]">Đang tìm...</div>}
          {!loading && results.length === 0 && (
            <div className="px-3 py-2 text-xs text-[#8E8878]">Không tìm thấy</div>
          )}
          {results.map(v => (
            <button key={v.id} onClick={() => select(v)}
              className="w-full text-left px-3 py-2.5 hover:bg-[#FAF7F2] border-b border-black/5 last:border-0">
              <p className="text-sm font-medium text-[#1C1C1E]">{v.name}</p>
              <p className="text-xs text-[#8E8878]">{v.contactPerson} · {v.contactPhone} · <span className="text-[#C9A84C]">{VENDOR_TYPE_LABELS[v.vendorType]||v.vendorType}</span></p>
            </button>
          ))}
          <button onClick={onCreateNew}
            className="w-full text-left px-3 py-2.5 text-xs text-[#C9A84C] font-semibold hover:bg-[#FAF7F2] flex items-center gap-1.5 border-t border-black/5">
            <Plus size={12}/> Thêm nhà cung cấp mới
          </button>
        </div>
      )}
    </div>
  );
}

// ── Quick Create Vendor Modal ──────────────────────────────────────────────────
function CreateVendorModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', contactPerson: '', contactPhone: '', vendorType: 'REPAIR' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const submit = async () => {
    if (!form.name.trim()) { setErr('Vui lòng nhập tên nhà cung cấp'); return; }
    setSaving(true);
    try { const v = await factoryProdApi.createVendor(form); onCreated(v); }
    catch (e) { setErr(e?.response?.data?.message || 'Có lỗi xảy ra'); }
    finally { setSaving(false); }
  };
  return (
    <Modal open title="Thêm nhà cung cấp" onClose={onClose} size="sm"
      footer={<div className="flex justify-end gap-2"><SecondaryButton onClick={onClose}>Huỷ</SecondaryButton><PrimaryButton onClick={submit} loading={saving}>Thêm</PrimaryButton></div>}>
      <div className="space-y-3">
        {err && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{err}</p>}
        <Field label="Tên nhà cung cấp" required><input className={inputCls} value={form.name} onChange={e => set('name', e.target.value)} placeholder="VD: Công ty TNHH ABC"/></Field>
        <Field label="Loại nhà cung cấp">
          <select className={inputCls} value={form.vendorType} onChange={e => set('vendorType', e.target.value)}>
            <option value="MACHINE">Nhà cung cấp máy móc</option>
            <option value="REPAIR">Nhà cung cấp sửa chữa</option>
            <option value="MATERIAL">Nhà cung cấp nguyên liệu</option>
          </select>
        </Field>
        <Field label="Người liên hệ"><input className={inputCls} value={form.contactPerson} onChange={e => set('contactPerson', e.target.value)} placeholder="Tên người liên hệ"/></Field>
        <Field label="Số điện thoại"><input className={inputCls} value={form.contactPhone} onChange={e => set('contactPhone', e.target.value)} placeholder="0900123456"/></Field>
      </div>
    </Modal>
  );
}

// ── DateTime helpers ───────────────────────────────────────────────────────────
function DateTimeInput({ label, value, onChange, required, timeOnly = false }) {
  return (
    <Field label={label} required={required}>
      <input
        type={timeOnly ? 'time' : 'datetime-local'}
        className={inputCls}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </Field>
  );
}

// Chọn ngày trong tháng (1-28)
function MonthDayInput({ label, value, onChange }) {
  return (
    <Field label={label}>
      <select className={inputCls} value={value} onChange={e => onChange(e.target.value)}>
        <option value="">-- Chọn ngày --</option>
        {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
          <option key={d} value={d}>Ngày {d}</option>
        ))}
      </select>
    </Field>
  );
}

// Chọn tháng/ngày cho recurrence hàng quý/năm  
function MonthDayPickerInput({ label, value, onChange, showMonth = false }) {
  const [day, setDay] = useState(value?.day || '');
  const [month, setMonth] = useState(value?.month || '');

  const update = (d, m) => {
    onChange({ day: d, month: m });
  };

  return (
    <div className="space-y-2">
      {label && <p className="text-xs font-semibold text-[#8E8878] uppercase tracking-wider">{label}</p>}
      <div className={`grid gap-2 ${showMonth ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {showMonth && (
          <select className={inputCls} value={month} onChange={e => { setMonth(e.target.value); update(day, e.target.value); }}>
            <option value="">-- Tháng --</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>Tháng {m}</option>
            ))}
          </select>
        )}
        <select className={inputCls} value={day} onChange={e => { setDay(e.target.value); update(e.target.value, month); }}>
          <option value="">-- Ngày --</option>
          {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
            <option key={d} value={d}>Ngày {d}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

// ── Create Maintenance Modal ───────────────────────────────────────────────────
function CreateMaintenanceModal({ machine, type, onClose, onSaved }) {
  const toast = useToast();
  const isCorrective = type === 'CORRECTIVE';

  const [form, setForm] = useState({
    title: '', description: '',
    plannedStart: '', plannedEnd: '',
    plannedStartTime: '', plannedEndTime: '',
    plannedDowntimeHours: '',
    estimatedCost: '',
    recurrenceType: 'ONCE',
    recurrenceDay: '',
    recurrenceMonth: '',
  });
  const [vendor, setVendor] = useState(null);
  const [showCreateVendor, setShowCreateVendor] = useState(false);
  const [beforeImages, setBeforeImages] = useState([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const isRecurring = form.recurrenceType !== 'ONCE';

  // Build plannedStart/End timestamps from form values
  const buildTimestamp = (dateStr, timeStr) => {
    if (!dateStr) return null;
    try {
      if (timeStr) {
        return new Date(`${dateStr}T${timeStr}`).getTime();
      }
      return new Date(dateStr).getTime();
    } catch { return null; }
  };

  const submit = async () => {
    if (!form.title) { setErr('Vui lòng nhập tiêu đề'); return; }
    if (!isRecurring && (!form.plannedStart || !form.plannedEnd)) { setErr('Vui lòng chọn thời gian'); return; }
    if (isRecurring && !form.recurrenceDay) { setErr('Vui lòng chọn ngày lặp lại'); return; }

    let plannedStart, plannedEnd;
    if (isRecurring) {
      // For recurring: build next occurrence from recurrenceDay + time
      const now = new Date();
      let d = new Date(now.getFullYear(), now.getMonth(), Number(form.recurrenceDay));
      if (form.recurrenceMonth) d = new Date(now.getFullYear(), Number(form.recurrenceMonth) - 1, Number(form.recurrenceDay));
      if (d < now) d.setMonth(d.getMonth() + 1);
      if (form.plannedStartTime) {
        const [h, m] = form.plannedStartTime.split(':');
        d.setHours(Number(h), Number(m));
      }
      plannedStart = d.getTime();
      const dEnd = new Date(d);
      if (form.plannedEndTime) {
        const [h, m] = form.plannedEndTime.split(':');
        dEnd.setHours(Number(h), Number(m));
        if (dEnd <= d) dEnd.setDate(dEnd.getDate() + 1);
      } else {
        dEnd.setHours(dEnd.getHours() + 4);
      }
      plannedEnd = dEnd.getTime();
    } else {
      plannedStart = buildTimestamp(form.plannedStart, '');
      plannedEnd = buildTimestamp(form.plannedEnd, '');
    }

    setSaving(true);
    try {
      await factoryProdApi.createMaintenance({
        machineId: machine.id,
        maintenanceType: type,
        title: form.title,
        description: form.description,
        plannedStart,
        plannedEnd,
        plannedDowntimeHours: form.plannedDowntimeHours ? Number(form.plannedDowntimeHours) : null,
        vendorName: vendor?.name || '',
        vendorPhone: vendor?.contactPhone || '',
        estimatedCost: form.estimatedCost ? Number(form.estimatedCost) : null,
        recurrenceType: form.recurrenceType,
        recurrenceDay: form.recurrenceDay ? Number(form.recurrenceDay) : null,
        recurrenceMonthInQuarter: form.recurrenceMonth ? Number(form.recurrenceMonth) : null,
        beforeImages,
      });
      toast(isCorrective ? '🚨 Đã tạo phiếu sự cố — đã thông báo owner' : '🔧 Đã tạo lịch bảo trì định kỳ', 'success', 5000);
      onSaved();
    } catch (e) { setErr(e?.response?.data?.message || 'Có lỗi xảy ra'); }
    finally { setSaving(false); }
  };

  return (
    <>
      <Modal open
        title={isCorrective ? '🚨 Tạo phiếu sự cố' : '🔧 Tạo lịch bảo trì định kỳ'}
        onClose={onClose} size="md"
        footer={<div className="flex justify-end gap-2"><SecondaryButton onClick={onClose}>Huỷ</SecondaryButton><PrimaryButton onClick={submit} loading={saving}>{isCorrective ? 'Tạo phiếu sự cố' : 'Tạo lịch bảo trì'}</PrimaryButton></div>}>
        <div className="space-y-4">
          {err && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{err}</p>}
          {isCorrective && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex gap-2 items-start">
              <AlertTriangle size={16} className="text-red-600 flex-shrink-0 mt-0.5"/>
              <p className="text-xs text-red-700">Máy sẽ chuyển sang <b>Đang bảo trì</b> ngay khi tạo phiếu.</p>
            </div>
          )}

          {/* Machine label */}
          <div className="bg-[#FAF7F2] rounded-xl px-4 py-3 text-xs flex items-center gap-2">
            <Settings2 size={14} className="text-[#C9A84C]"/>
            <span className="font-semibold text-[#1C1C1E]">{machine.name}</span>
            {machine.factoryName && <span className="text-[#8E8878]">— {machine.factoryName}</span>}
          </div>

          <Field label="Tiêu đề / nội dung" required>
            <input className={inputCls} value={form.title}
              placeholder={isCorrective ? 'VD: Hỏng motor dây chuyền A' : 'VD: Bảo dưỡng định kỳ tháng 6'}
              onChange={e => set('title', e.target.value)}/>
          </Field>
          <Field label="Mô tả chi tiết">
            <textarea className={inputCls} rows={2} value={form.description} onChange={e => set('description', e.target.value)}/>
          </Field>

          {/* Recurrence — only for PREVENTIVE */}
          {!isCorrective && (
            <Field label="Tần suất lặp lại">
              <select className={inputCls} value={form.recurrenceType} onChange={e => set('recurrenceType', e.target.value)}>
                <option value="ONCE">1 lần</option>
                <option value="MONTHLY">Hàng tháng</option>
                <option value="QUARTERLY">Hàng quý</option>
                <option value="YEARLY">Hàng năm</option>
              </select>
            </Field>
          )}

          {/* Time selection — changes based on recurrence */}
          {!isRecurring ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <DateTimeInput label="Thời gian bắt đầu" required value={form.plannedStart}
                  onChange={v => {
                    set('plannedStart', v);
                    // Auto-calc downtime
                    if (form.plannedEnd && v) {
                      const diff = (new Date(form.plannedEnd) - new Date(v)) / 3600000;
                      if (diff > 0) set('plannedDowntimeHours', diff.toFixed(1));
                    }
                  }}/>
                <DateTimeInput label="Dự kiến kết thúc" required value={form.plannedEnd}
                  onChange={v => {
                    set('plannedEnd', v);
                    if (form.plannedStart && v) {
                      const diff = (new Date(v) - new Date(form.plannedStart)) / 3600000;
                      if (diff > 0) set('plannedDowntimeHours', diff.toFixed(1));
                    }
                  }}/>
              </div>
              {form.plannedDowntimeHours > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-700 flex items-center gap-2">
                  <span>⏱</span>
                  <span>Thời gian downtime: <b>{form.plannedDowntimeHours}h</b>
                    {form.plannedDowntimeHours > 10 && ' — Máy sẽ không hoạt động nhiều ngày'}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3 bg-[#FAF7F2] rounded-xl p-3">
              <p className="text-xs font-semibold text-[#8E8878] uppercase tracking-wider">Lịch lặp lại</p>
              {form.recurrenceType === 'MONTHLY' && (
                <MonthDayInput label="Ngày trong tháng" value={form.recurrenceDay} onChange={v => set('recurrenceDay', v)}/>
              )}
              {(form.recurrenceType === 'QUARTERLY' || form.recurrenceType === 'YEARLY') && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Tháng">
                    <select className={inputCls} value={form.recurrenceMonth} onChange={e => set('recurrenceMonth', e.target.value)}>
                      <option value="">-- Chọn tháng --</option>
                      {(form.recurrenceType === 'QUARTERLY'
                        ? [1, 2, 3].map(m => ({ v: m, l: `Tháng ${m} trong quý` }))
                        : Array.from({ length: 12 }, (_, i) => ({ v: i + 1, l: `Tháng ${i + 1}` }))
                      ).map(({ v, l }) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </Field>
                  <MonthDayInput label="Ngày" value={form.recurrenceDay} onChange={v => set('recurrenceDay', v)}/>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Giờ bắt đầu (ca làm 8g–18g)">
                  <input type="time" className={inputCls} value={form.plannedStartTime}
                    onChange={e => {
                      set('plannedStartTime', e.target.value);
                      if (form.plannedEndTime && e.target.value) {
                        const [sh,sm] = e.target.value.split(':').map(Number);
                        const [eh,em] = form.plannedEndTime.split(':').map(Number);
                        const diff = (eh*60+em - sh*60-sm) / 60;
                        if (diff > 0) set('plannedDowntimeHours', diff.toFixed(1));
                      }
                    }}/>
                </Field>
                <Field label="Giờ kết thúc dự kiến">
                  <input type="time" className={inputCls} value={form.plannedEndTime}
                    onChange={e => {
                      set('plannedEndTime', e.target.value);
                      if (form.plannedStartTime && e.target.value) {
                        const [sh,sm] = form.plannedStartTime.split(':').map(Number);
                        const [eh,em] = e.target.value.split(':').map(Number);
                        const diff = (eh*60+em - sh*60-sm) / 60;
                        if (diff > 0) set('plannedDowntimeHours', diff.toFixed(1));
                      }
                    }}/>
                </Field>
              </div>
              {form.plannedDowntimeHours > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-700 flex items-center gap-2">
                  <span>⏱</span>
                  <span>Thời gian downtime: <b>{form.plannedDowntimeHours}h</b>
                    {form.plannedDowntimeHours > 10 && ' — Sẽ kéo sang ngày hôm sau'}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Vendor selection */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-[#8E8878] uppercase tracking-wider">Đơn vị thi công</label>
            </div>
            <VendorSearchInput
              value={vendor} onChange={setVendor}
              types="MACHINE,REPAIR"
              onCreateNew={() => setShowCreateVendor(true)}
            />
            {vendor && (
              <div className="mt-2 bg-[#FAF7F2] rounded-xl px-3 py-2 text-xs space-y-0.5">
                <p className="font-semibold text-[#1C1C1E]">{vendor.name}</p>
                {vendor.contactPerson && <p className="text-[#8E8878]">Liên hệ: {vendor.contactPerson}</p>}
                {vendor.contactPhone && <p className="text-[#8E8878]">SĐT: {vendor.contactPhone}</p>}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Chi phí ước tính (₫)">
              <input type="number" className={inputCls} placeholder="0" value={form.estimatedCost} onChange={e => set('estimatedCost', e.target.value)}/>
            </Field>
            <Field label="Giờ downtime dự kiến">
              <input type="number" className={inputCls} placeholder="VD: 4" value={form.plannedDowntimeHours} onChange={e => set('plannedDowntimeHours', e.target.value)}/>
            </Field>
          </div>

          <ImageUploader label="Ảnh trước bảo trì" uploaded={beforeImages}
            onUpload={async files => {
              const { productionUploadApi } = await import('../../api/productionModuleApi');
              const urls = await productionUploadApi.uploadMaintenanceBefore(0, files);
              setBeforeImages(p => [...p, ...urls]); return urls;
            }}/>
        </div>
      </Modal>

      {showCreateVendor && (
        <CreateVendorModal
          onClose={() => setShowCreateVendor(false)}
          onCreated={v => { setVendor(v); setShowCreateVendor(false); }}
        />
      )}
    </>
  );
}

// ── Complete Maintenance Modal ─────────────────────────────────────────────────
function CompleteMaintenanceModal({ item, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ actualCost: '', notes: '', actualEnd: new Date().toISOString().slice(0, 16) });
  const [afterImages, setAfterImages] = useState([]);
  const [receiptImages, setReceiptImages] = useState([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    setSaving(true);
    try {
      await factoryProdApi.completeMaintenance(item.id, {
        actualEnd: new Date(form.actualEnd).getTime(),
        actualCost: form.actualCost ? Number(form.actualCost) : null,
        notes: form.notes, afterImages, receiptImages,
      });
      toast(`✓ Hoàn thành: ${item.title} — đã thông báo owner`, 'success', 5000);
      onSaved();
    } catch (e) { setErr(e?.response?.data?.message || 'Có lỗi xảy ra'); }
    finally { setSaving(false); }
  };

  return (
    <Modal open title="Cập nhật hoàn thành bảo trì" onClose={onClose} size="md"
      footer={<div className="flex justify-end gap-2"><SecondaryButton onClick={onClose}>Huỷ</SecondaryButton><PrimaryButton onClick={submit} loading={saving}>Xác nhận hoàn thành</PrimaryButton></div>}>
      <div className="space-y-4">
        {err && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{err}</p>}
        <div className="bg-[#FAF7F2] rounded-xl px-4 py-3 text-sm">
          <p className="font-semibold text-[#1C1C1E]">{item.title}</p>
          <p className="text-xs text-[#8E8878]">{item.machineName}</p>
        </div>
        <Field label="Thời gian hoàn thành thực tế">
          <input type="datetime-local" className={inputCls} value={form.actualEnd} onChange={e => set('actualEnd', e.target.value)}/>
        </Field>
        <Field label="Chi phí thực tế (₫)">
          <input type="number" className={inputCls} placeholder="0" value={form.actualCost} onChange={e => set('actualCost', e.target.value)}/>
        </Field>
        <Field label="Ghi chú bảo trì">
          <textarea className={inputCls} rows={2} placeholder="Kết quả, vật tư đã dùng..." value={form.notes} onChange={e => set('notes', e.target.value)}/>
        </Field>
        <ImageUploader label="Ảnh sau bảo trì" uploaded={afterImages}
          onUpload={async files => {
            const { productionUploadApi } = await import('../../api/productionModuleApi');
            const urls = await productionUploadApi.uploadMaintenanceAfter(item.id, files);
            setAfterImages(p => [...p, ...urls]); return urls;
          }}/>
        <ImageUploader label="Chứng từ / hóa đơn" uploaded={receiptImages}
          onUpload={async files => {
            const { productionUploadApi } = await import('../../api/productionModuleApi');
            const urls = await productionUploadApi.uploadMaintenanceReceipt(item.id, files);
            setReceiptImages(p => [...p, ...urls]); return urls;
          }}/>
      </div>
    </Modal>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function FactoryMachinePage() {
  const { role } = useAuth();
  // FACTORY_WORKER chỉ được báo sự cố (CORRECTIVE); SUPER_FACTORY_WORKER (và Owner truy cập
  // qua route khác) được tạo cả bảo trì định kỳ (PREVENTIVE) lẫn báo sự cố.
  const canCreatePreventive = role !== 'FACTORY_WORKER';
  const [machines, setMachines] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createFor, setCreateFor] = useState(null);
  const [completeFor, setCompleteFor] = useState(null);
  const [expanded, setExpanded] = useState(new Set());

  const load = async () => {
    setLoading(true);
    try {
      const [m, maint] = await Promise.all([
        ownerProdApi.listMachines(false),
        factoryProdApi.listMaintenance(new Date().getFullYear()),
      ]);
      setMachines(m || []);
      setMaintenance(maint || []);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const maintForMachine = id => maintenance.filter(m => m.machineId === id);
  const toggle = id => setExpanded(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  if (loading) return <div className="flex justify-center p-12"><Loader2 size={24} className="animate-spin text-[#C9A84C]"/></div>;

  return (
    <div className="p-4 sm:p-6 space-y-4 bg-[#F5F0EB] min-h-full">
      <div className="bg-[#1A2B1A] rounded-2xl p-5 text-white">
        <p className="text-[#7CB87C] text-xs uppercase tracking-widest font-medium">Xưởng sản xuất</p>
        <h1 className="text-xl font-bold mt-0.5">Máy móc & bảo trì</h1>
        <p className="text-white/60 text-xs mt-1">{machines.filter(m => m.status === 'UNDER_MAINTENANCE').length} máy đang bảo trì</p>
      </div>

      <div className="space-y-3">
        {machines.length === 0 && (
          <div className="bg-white rounded-2xl border border-black/5 p-8 text-center text-[#8E8878] text-sm">Chưa có máy nào</div>
        )}
        {machines.map(machine => {
          const cfg = MACHINE_STATUS_CFG[machine.status] || MACHINE_STATUS_CFG.INACTIVE;
          const maints = maintForMachine(machine.id);
          const isExpanded = expanded.has(machine.id);
          return (
            <div key={machine.id} className="bg-white border border-black/5 rounded-2xl overflow-hidden shadow-sm">
              <div className="p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${cfg.dot} flex-shrink-0`}/>
                    <div>
                      <p className="font-semibold text-[#1C1C1E]">{machine.name}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.cls}`}>{cfg.label}</span>
                        {machine.factoryName && <span className="text-[10px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{machine.factoryName}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {canCreatePreventive && (
                      <button onClick={() => setCreateFor({ machine, type: 'PREVENTIVE' })}
                        className="flex items-center gap-1 text-xs px-3 py-1.5 bg-blue-50 text-blue-700 rounded-xl hover:bg-blue-100 font-medium">
                        <Plus size={12}/> Bảo trì định kỳ
                      </button>
                    )}
                    <button onClick={() => setCreateFor({ machine, type: 'CORRECTIVE' })}
                      className="flex items-center gap-1 text-xs px-3 py-1.5 bg-red-50 text-red-700 rounded-xl hover:bg-red-100 font-medium">
                      <AlertTriangle size={12}/> Báo sự cố
                    </button>
                    {maints.length > 0 && (
                      <button onClick={() => toggle(machine.id)}
                        className="flex items-center gap-1 text-xs px-3 py-1.5 bg-[#FAF7F2] text-[#8E8878] rounded-xl hover:bg-[#F0EAE0] font-medium">
                        {maints.length} lịch {isExpanded ? <ChevronDown size={12}/> : <ChevronRight size={12}/>}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {isExpanded && maints.length > 0 && (
                <div className="border-t border-black/5">
                  {maints.map(m => {
                    const sc = MAINT_STATUS_CFG[m.status] || MAINT_STATUS_CFG.PLANNED;
                    const isActive = ['PLANNED', 'IN_PROGRESS'].includes(m.status);
                    return (
                      <div key={m.id} className="px-4 py-3 border-b border-black/5 last:border-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${m.maintenanceType === 'CORRECTIVE' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                {m.maintenanceType === 'CORRECTIVE' ? '🚨 Sự cố' : '🔧 Định kỳ'}
                              </span>
                              <p className="text-sm font-medium text-[#1C1C1E]">{m.title}</p>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${sc.cls}`}>{sc.label}</span>
                            </div>
                            <p className="text-xs text-[#8E8878] mt-0.5">{fmtDate(m.plannedStart)} → {fmtDate(m.plannedEnd)}</p>
                            {m.vendorName && <p className="text-xs text-[#8E8878]">Đơn vị: {m.vendorName} {m.vendorPhone && `· ${m.vendorPhone}`}</p>}
                            {m.actualCost && <p className="text-xs text-emerald-600 font-semibold">Chi phí: {fmtCurrency(m.actualCost)}</p>}
                          </div>
                          {isActive && (
                            <button onClick={() => setCompleteFor(m)}
                              className="flex-shrink-0 text-xs px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-xl hover:bg-emerald-100 font-medium flex items-center gap-1">
                              <CheckCircle2 size={12}/> Hoàn thành
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {createFor && <CreateMaintenanceModal machine={createFor.machine} type={createFor.type} onClose={() => setCreateFor(null)} onSaved={() => { setCreateFor(null); load(); }}/>}
      {completeFor && <CompleteMaintenanceModal item={completeFor} onClose={() => setCompleteFor(null)} onSaved={() => { setCompleteFor(null); load(); }}/>}
    </div>
  );
}
