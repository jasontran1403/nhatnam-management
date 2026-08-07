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
import { useLang } from '../../context/LangContext';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
const imgUrl = p => p?.startsWith('http') ? p : BASE_URL + '/api/auth' + p;

const getMaintStatusCfg = (t) => ({
  PLANNED:     { label: t('production', 'maint_status_planned'),     cls: 'bg-blue-100 dark:bg-blue-500/18 text-blue-700 dark:text-blue-300' },
  IN_PROGRESS: { label: t('production', 'maint_status_in_progress'), cls: 'bg-orange-100 dark:bg-orange-500/18 text-orange-700 dark:text-orange-300' },
  COMPLETED:   { label: t('production', 'maint_status_completed'),   cls: 'bg-emerald-100 dark:bg-emerald-500/18 text-emerald-700 dark:text-emerald-300' },
  ADJUSTED:    { label: t('production', 'maint_status_adjusted'),    cls: 'bg-purple-100 dark:bg-purple-500/18 text-purple-700 dark:text-purple-300' },
  MISSED:      { label: t('production', 'maint_status_missed'),      cls: 'bg-surface-2 text-ink-2' },
});
const getMachineStatusCfg = (t) => ({
  ACTIVE:            { label: t('production', 'machine_status_active'),       cls: 'bg-emerald-100 dark:bg-emerald-500/18 text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-400 animate-pulse' },
  INACTIVE:          { label: t('production', 'machine_status_inactive'),     cls: 'bg-surface-2 text-ink-2',       dot: 'bg-surface-3' },
  UNDER_MAINTENANCE: { label: `🔧 ${t('production', 'machine_status_maintenance')}`, cls: 'bg-red-100 dark:bg-red-500/18 text-red-700 dark:text-red-300', dot: 'bg-red-400 animate-pulse' },
});
const getVendorTypeLabels = (t) => ({
  MATERIAL: t('production', 'vendor_type_material'),
  MACHINE: t('production', 'vendor_type_machine'),
  REPAIR: t('production', 'vendor_type_repair'),
});

// ── Image uploader ─────────────────────────────────────────────────────────────
function ImageUploader({ label, onUpload, uploaded = [] }) {
  const { t } = useLang();
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
      {label && <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">{label}</p>}
      <div className="flex gap-2 flex-wrap">
        {uploaded.map((u, i) => <div key={i} className="w-16 h-16 rounded-xl overflow-hidden border border-hairline-2"><img src={imgUrl(u)} alt="" className="w-full h-full object-cover"/></div>)}
        {previews.map((p, i) => (
          <div key={`p${i}`} className="w-16 h-16 rounded-xl overflow-hidden border border-hairline-2 relative">
            <img src={p} alt="" className="w-full h-full object-cover"/>
            {uploading && <div className="absolute inset-0 bg-black/40 flex items-center justify-center"><Loader2 size={10} className="text-white animate-spin"/></div>}
          </div>
        ))}
        <button type="button" onClick={() => ref.current?.click()}
          className="w-16 h-16 rounded-xl border-2 border-dashed border-gold/40 flex flex-col items-center justify-center hover:border-gold hover:bg-gold/5">
          <Camera size={18} className="text-gold"/><span className="text-[10px] text-gold mt-0.5">{t('common', 'add')}</span>
        </button>
        <input ref={ref} type="file" multiple accept="image/*" className="hidden" onChange={e => handleFiles(e.target.files)}/>
      </div>
    </div>
  );
}

// ── Vendor Search Input ────────────────────────────────────────────────────────
function VendorSearchInput({ value, onChange, types = 'MACHINE,REPAIR', onCreateNew }) {
  const { t } = useLang();
  const VENDOR_TYPE_LABELS = getVendorTypeLabels(t);
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
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"/>
        <input className={`${inputCls} pl-8 pr-8`}
          placeholder={t('production', 'vendor_search_placeholder')}
          value={query} onFocus={handleOpen}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
        />
        {value && <button onClick={clear} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink"><X size={14}/></button>}
      </div>
      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-surface border border-hairline-2 rounded-xl shadow-lg overflow-hidden">
          {loading && <div className="px-3 py-2 text-xs text-muted">{t('production', 'vendor_searching')}</div>}
          {!loading && results.length === 0 && (
            <div className="px-3 py-2 text-xs text-muted">{t('production', 'vendor_not_found')}</div>
          )}
          {results.map(v => (
            <button key={v.id} onClick={() => select(v)}
              className="w-full text-left px-3 py-2.5 hover:bg-canvas border-b border-hairline last:border-0">
              <p className="text-sm font-medium text-ink">{v.name}</p>
              <p className="text-xs text-muted">{v.contactPerson} · {v.contactPhone} · <span className="text-gold">{VENDOR_TYPE_LABELS[v.vendorType]||v.vendorType}</span></p>
            </button>
          ))}
          <button onClick={onCreateNew}
            className="w-full text-left px-3 py-2.5 text-xs text-gold font-semibold hover:bg-canvas flex items-center gap-1.5 border-t border-hairline">
            <Plus size={12}/> {t('production', 'vendor_add_new')}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Quick Create Vendor Modal ──────────────────────────────────────────────────
function CreateVendorModal({ onClose, onCreated }) {
  const { t } = useLang();
  const [form, setForm] = useState({ name: '', contactPerson: '', contactPhone: '', vendorType: 'REPAIR' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const submit = async () => {
    if (!form.name.trim()) { setErr(t('production', 'vendor_modal_err_need_name')); return; }
    setSaving(true);
    try { const v = await factoryProdApi.createVendor(form); onCreated(v); }
    catch (e) { setErr(e?.response?.data?.message || t('production', 'vendor_modal_err_generic')); }
    finally { setSaving(false); }
  };
  return (
    <Modal open title={t('production', 'vendor_modal_title')} onClose={onClose} size="sm"
      footer={<div className="flex justify-end gap-2"><SecondaryButton onClick={onClose}>{t('production', 'vendor_modal_cancel')}</SecondaryButton><PrimaryButton onClick={submit} loading={saving}>{t('production', 'vendor_modal_add')}</PrimaryButton></div>}>
      <div className="space-y-3">
        {err && <p className="text-xs text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/28 rounded-xl px-3 py-2">{err}</p>}
        <Field label={t('production', 'vendor_modal_name_label')} required><input className={inputCls} value={form.name} onChange={e => set('name', e.target.value)} placeholder={t('production', 'vendor_modal_name_placeholder')}/></Field>
        <Field label={t('production', 'vendor_modal_type_label')}>
          <select className={inputCls} value={form.vendorType} onChange={e => set('vendorType', e.target.value)}>
            <option value="MACHINE">{t('production', 'vendor_modal_type_machine')}</option>
            <option value="REPAIR">{t('production', 'vendor_modal_type_repair')}</option>
            <option value="MATERIAL">{t('production', 'vendor_modal_type_material')}</option>
          </select>
        </Field>
        <Field label={t('production', 'vendor_modal_contact_person')}><input className={inputCls} value={form.contactPerson} onChange={e => set('contactPerson', e.target.value)} placeholder={t('production', 'vendor_modal_contact_person_placeholder')}/></Field>
        <Field label={t('production', 'vendor_modal_contact_phone')}><input className={inputCls} value={form.contactPhone} onChange={e => set('contactPhone', e.target.value)} placeholder="0900123456"/></Field>
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
  const { t } = useLang();
  return (
    <Field label={label}>
      <select className={inputCls} value={value} onChange={e => onChange(e.target.value)}>
        <option value="">{t('production', 'pick_day_placeholder')}</option>
        {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
          <option key={d} value={d}>{t('production', 'day_label')} {d}</option>
        ))}
      </select>
    </Field>
  );
}

// Chọn tháng/ngày cho recurrence hàng quý/năm  
function MonthDayPickerInput({ label, value, onChange, showMonth = false }) {
  const { t } = useLang();
  const [day, setDay] = useState(value?.day || '');
  const [month, setMonth] = useState(value?.month || '');

  const update = (d, m) => {
    onChange({ day: d, month: m });
  };

  return (
    <div className="space-y-2">
      {label && <p className="text-xs font-semibold text-muted uppercase tracking-wider">{label}</p>}
      <div className={`grid gap-2 ${showMonth ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {showMonth && (
          <select className={inputCls} value={month} onChange={e => { setMonth(e.target.value); update(day, e.target.value); }}>
            <option value="">{t('production', 'pick_month_placeholder')}</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>{t('production', 'month_label')} {m}</option>
            ))}
          </select>
        )}
        <select className={inputCls} value={day} onChange={e => { setDay(e.target.value); update(e.target.value, month); }}>
          <option value="">{t('production', 'pick_day_placeholder')}</option>
          {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
            <option key={d} value={d}>{t('production', 'day_label')} {d}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

// ── Create Maintenance Modal ───────────────────────────────────────────────────
function CreateMaintenanceModal({ machine, type, onClose, onSaved }) {
  const toast = useToast();
  const { t } = useLang();
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
    if (!form.title) { setErr(t('production', 'maint_err_need_title')); return; }
    if (!isRecurring && (!form.plannedStart || !form.plannedEnd)) { setErr(t('production', 'maint_err_need_time')); return; }
    if (isRecurring && !form.recurrenceDay) { setErr(t('production', 'maint_err_need_recur_day')); return; }

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
      toast(isCorrective ? `🚨 ${t('production', 'maint_success_corrective')}` : `🔧 ${t('production', 'maint_success_preventive')}`, 'success', 5000);
      onSaved();
    } catch (e) { setErr(e?.response?.data?.message || t('production', 'maint_err_generic')); }
    finally { setSaving(false); }
  };

  return (
    <>
      <Modal open
        title={isCorrective ? `🚨 ${t('production', 'maint_create_corrective_title')}` : `🔧 ${t('production', 'maint_create_preventive_title')}`}
        onClose={onClose} size="md"
        footer={<div className="flex justify-end gap-2"><SecondaryButton onClick={onClose}>{t('production', 'maint_cancel')}</SecondaryButton><PrimaryButton onClick={submit} loading={saving}>{isCorrective ? t('production', 'maint_submit_corrective') : t('production', 'maint_submit_preventive')}</PrimaryButton></div>}>
        <div className="space-y-4">
          {err && <p className="text-xs text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/28 rounded-xl px-3 py-2">{err}</p>}
          {isCorrective && (
            <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/28 rounded-xl p-3 flex gap-2 items-start">
              <AlertTriangle size={16} className="text-red-600 dark:text-red-300 flex-shrink-0 mt-0.5"/>
              <p className="text-xs text-red-700 dark:text-red-300">{t('production', 'maint_corrective_warning')}</p>
            </div>
          )}

          {/* Machine label */}
          <div className="bg-canvas rounded-xl px-4 py-3 text-xs flex items-center gap-2">
            <Settings2 size={14} className="text-gold"/>
            <span className="font-semibold text-ink">{machine.name}</span>
            {machine.factoryName && <span className="text-muted">— {machine.factoryName}</span>}
          </div>

          <Field label={t('production', 'maint_title_label')} required>
            <input className={inputCls} value={form.title}
              placeholder={isCorrective ? t('production', 'maint_title_corrective_placeholder') : t('production', 'maint_title_preventive_placeholder')}
              onChange={e => set('title', e.target.value)}/>
          </Field>
          <Field label={t('production', 'maint_description_label')}>
            <textarea className={inputCls} rows={2} value={form.description} onChange={e => set('description', e.target.value)}/>
          </Field>

          {/* Recurrence — only for PREVENTIVE */}
          {!isCorrective && (
            <Field label={t('production', 'maint_recurrence_label')}>
              <select className={inputCls} value={form.recurrenceType} onChange={e => set('recurrenceType', e.target.value)}>
                <option value="ONCE">{t('production', 'maint_recurrence_once')}</option>
                <option value="MONTHLY">{t('production', 'maint_recurrence_monthly')}</option>
                <option value="QUARTERLY">{t('production', 'maint_recurrence_quarterly')}</option>
                <option value="YEARLY">{t('production', 'maint_recurrence_yearly')}</option>
              </select>
            </Field>
          )}

          {/* Time selection — changes based on recurrence */}
          {!isRecurring ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <DateTimeInput label={t('production', 'maint_start_time_label')} required value={form.plannedStart}
                  onChange={v => {
                    set('plannedStart', v);
                    // Auto-calc downtime
                    if (form.plannedEnd && v) {
                      const diff = (new Date(form.plannedEnd) - new Date(v)) / 3600000;
                      if (diff > 0) set('plannedDowntimeHours', diff.toFixed(1));
                    }
                  }}/>
                <DateTimeInput label={t('production', 'maint_end_time_label')} required value={form.plannedEnd}
                  onChange={v => {
                    set('plannedEnd', v);
                    if (form.plannedStart && v) {
                      const diff = (new Date(v) - new Date(form.plannedStart)) / 3600000;
                      if (diff > 0) set('plannedDowntimeHours', diff.toFixed(1));
                    }
                  }}/>
              </div>
              {form.plannedDowntimeHours > 0 && (
                <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/28 rounded-xl px-3 py-2 text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2">
                  <span>⏱</span>
                  <span>{t('production', 'maint_downtime_label')}: <b>{form.plannedDowntimeHours}h</b>
                    {form.plannedDowntimeHours > 10 && ` — ${t('production', 'maint_downtime_warning_days')}`}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3 bg-canvas rounded-xl p-3">
              <p className="text-xs font-semibold text-muted uppercase tracking-wider">{t('production', 'maint_recurring_schedule_title')}</p>
              {form.recurrenceType === 'MONTHLY' && (
                <MonthDayInput label={t('production', 'maint_day_in_month_label')} value={form.recurrenceDay} onChange={v => set('recurrenceDay', v)}/>
              )}
              {(form.recurrenceType === 'QUARTERLY' || form.recurrenceType === 'YEARLY') && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label={t('production', 'maint_month_label')}>
                    <select className={inputCls} value={form.recurrenceMonth} onChange={e => set('recurrenceMonth', e.target.value)}>
                      <option value="">{t('production', 'pick_month_placeholder')}</option>
                      {(form.recurrenceType === 'QUARTERLY'
                        ? [1, 2, 3].map(m => ({ v: m, l: `${t('production', 'maint_month_in_quarter')} ${m} ${t('production', 'maint_month_in_quarter_suffix')}` }))
                        : Array.from({ length: 12 }, (_, i) => ({ v: i + 1, l: `${t('production', 'month_label')} ${i + 1}` }))
                      ).map(({ v, l }) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </Field>
                  <MonthDayInput label={t('production', 'maint_day_label')} value={form.recurrenceDay} onChange={v => set('recurrenceDay', v)}/>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <Field label={t('production', 'maint_start_hour_label')}>
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
                <Field label={t('production', 'maint_end_hour_label')}>
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
                <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/28 rounded-xl px-3 py-2 text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2">
                  <span>⏱</span>
                  <span>{t('production', 'maint_downtime_label')}: <b>{form.plannedDowntimeHours}h</b>
                    {form.plannedDowntimeHours > 10 && ` — ${t('production', 'maint_downtime_warning_next_day')}`}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Vendor selection */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-muted uppercase tracking-wider">{t('production', 'maint_vendor_label')}</label>
            </div>
            <VendorSearchInput
              value={vendor} onChange={setVendor}
              types="MACHINE,REPAIR"
              onCreateNew={() => setShowCreateVendor(true)}
            />
            {vendor && (
              <div className="mt-2 bg-canvas rounded-xl px-3 py-2 text-xs space-y-0.5">
                <p className="font-semibold text-ink">{vendor.name}</p>
                {vendor.contactPerson && <p className="text-muted">{t('production', 'maint_vendor_contact')}: {vendor.contactPerson}</p>}
                {vendor.contactPhone && <p className="text-muted">{t('production', 'maint_vendor_phone')}: {vendor.contactPhone}</p>}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t('production', 'maint_estimated_cost_label')}>
              <input type="number" className={inputCls} placeholder="0" value={form.estimatedCost} onChange={e => set('estimatedCost', e.target.value)}/>
            </Field>
            <Field label={t('production', 'maint_estimated_downtime_label')}>
              <input type="number" className={inputCls} placeholder="VD: 4" value={form.plannedDowntimeHours} onChange={e => set('plannedDowntimeHours', e.target.value)}/>
            </Field>
          </div>

          <ImageUploader label={t('production', 'maint_before_images_label')} uploaded={beforeImages}
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
  const { t } = useLang();
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
      toast(`✓ ${t('production', 'maint_complete_success_prefix')}: ${item.title} — ${t('production', 'maint_complete_success_suffix')}`, 'success', 5000);
      onSaved();
    } catch (e) { setErr(e?.response?.data?.message || t('production', 'maint_err_generic')); }
    finally { setSaving(false); }
  };

  return (
    <Modal open title={t('production', 'maint_complete_title')} onClose={onClose} size="md"
      footer={<div className="flex justify-end gap-2"><SecondaryButton onClick={onClose}>{t('production', 'maint_cancel')}</SecondaryButton><PrimaryButton onClick={submit} loading={saving}>{t('production', 'maint_complete_confirm')}</PrimaryButton></div>}>
      <div className="space-y-4">
        {err && <p className="text-xs text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/28 rounded-xl px-3 py-2">{err}</p>}
        <div className="bg-canvas rounded-xl px-4 py-3 text-sm">
          <p className="font-semibold text-ink">{item.title}</p>
          <p className="text-xs text-muted">{item.machineName}</p>
        </div>
        <Field label={t('production', 'maint_actual_end_label')}>
          <input type="datetime-local" className={inputCls} value={form.actualEnd} onChange={e => set('actualEnd', e.target.value)}/>
        </Field>
        <Field label={t('production', 'maint_actual_cost_label')}>
          <input type="number" className={inputCls} placeholder="0" value={form.actualCost} onChange={e => set('actualCost', e.target.value)}/>
        </Field>
        <Field label={t('production', 'maint_notes_label')}>
          <textarea className={inputCls} rows={2} placeholder={t('production', 'maint_notes_placeholder')} value={form.notes} onChange={e => set('notes', e.target.value)}/>
        </Field>
        <ImageUploader label={t('production', 'maint_after_images_label')} uploaded={afterImages}
          onUpload={async files => {
            const { productionUploadApi } = await import('../../api/productionModuleApi');
            const urls = await productionUploadApi.uploadMaintenanceAfter(item.id, files);
            setAfterImages(p => [...p, ...urls]); return urls;
          }}/>
        <ImageUploader label={t('production', 'maint_receipt_images_label')} uploaded={receiptImages}
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
  const { t } = useLang();
  const MAINT_STATUS_CFG = getMaintStatusCfg(t);
  const MACHINE_STATUS_CFG = getMachineStatusCfg(t);
  const { role } = useAuth();
  // FACTORY_WORKER chỉ được báo sự cố (CORRECTIVE); SUPER_FACTORY_WORKER (và Owner truy cập
  // qua route khác) được tạo cả bảo trì định kỳ (PREVENTIVE) lẫn báo sự cố.
  const canCreatePreventive = role !== 'FACTORY_WORKER';
  const [allMachines, setAllMachines] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createFor, setCreateFor] = useState(null);
  const [completeFor, setCompleteFor] = useState(null);
  const [expanded, setExpanded] = useState(new Set());
  const [factories, setFactories] = useState([]);
  const [factoryId, setFactoryId] = useState(null);

  useEffect(() => {
    factoryProdApi.listMyFactories().then(list => {
      const active = (list || []).filter(f => f.status === 'ACTIVE');
      setFactories(active);
      if (active.length >= 1) setFactoryId(active[0].id);
    }).catch(() => {});
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [m, maint] = await Promise.all([
        ownerProdApi.listMachines(false),
        factoryProdApi.listMaintenance(new Date().getFullYear()),
      ]);
      setAllMachines(m || []);
      setMaintenance(maint || []);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const machines = factoryId ? allMachines.filter(m => m.factoryId === factoryId) : allMachines;
  const maintForMachine = id => maintenance.filter(m => m.machineId === id);
  const toggle = id => setExpanded(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  if (loading) return <div className="flex justify-center p-12"><Loader2 size={24} className="animate-spin text-gold"/></div>;

  return (
    <div className="p-4 sm:p-6 space-y-4 bg-surface-2 min-h-full">
      <div className="bg-forest-deep rounded-2xl p-5 text-white">
        <p className="text-forest text-xs uppercase tracking-widest font-medium">{t('production', 'machine_page_factory_label')}</p>
        <h1 className="text-xl font-bold mt-0.5">{t('production', 'machine_page_title')}</h1>
        <p className="text-white/60 text-xs mt-1">{machines.filter(m => m.status === 'UNDER_MAINTENANCE').length} {t('production', 'machine_page_under_maintenance_suffix')}</p>
      </div>

      {factories.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted font-medium">Xưởng:</span>
          <select className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-line bg-surface text-ink focus:outline-none focus:border-gold"
            value={factoryId || ''} onChange={e => setFactoryId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">Tất cả</option>
            {factories.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
      )}

      <div className="space-y-3">
        {machines.length === 0 && (
          <div className="bg-surface rounded-2xl border border-hairline p-8 text-center text-muted text-sm">{t('production', 'machine_page_empty')}</div>
        )}
        {machines.map(machine => {
          const cfg = MACHINE_STATUS_CFG[machine.status] || MACHINE_STATUS_CFG.INACTIVE;
          const maints = maintForMachine(machine.id);
          const isExpanded = expanded.has(machine.id);
          return (
            <div key={machine.id} className="bg-surface border border-hairline rounded-2xl overflow-hidden shadow-sm">
              <div className="p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${cfg.dot} flex-shrink-0`}/>
                    <div>
                      <p className="font-semibold text-ink">{machine.name}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.cls}`}>{cfg.label}</span>
                        {machine.factoryName && <span className="text-[10px] text-blue-600 dark:text-blue-300 bg-blue-50 dark:bg-blue-500/10 px-2 py-0.5 rounded-full">{machine.factoryName}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {canCreatePreventive && (
                      <button onClick={() => setCreateFor({ machine, type: 'PREVENTIVE' })}
                        className="flex items-center gap-1 text-xs px-3 py-1.5 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 rounded-xl hover:bg-blue-100 dark:bg-blue-500/18 font-medium">
                        <Plus size={12}/> {t('production', 'machine_create_preventive_btn')}
                      </button>
                    )}
                    <button onClick={() => setCreateFor({ machine, type: 'CORRECTIVE' })}
                      className="flex items-center gap-1 text-xs px-3 py-1.5 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 rounded-xl hover:bg-red-100 dark:bg-red-500/18 font-medium">
                      <AlertTriangle size={12}/> {t('production', 'machine_report_issue_btn')}
                    </button>
                    {maints.length > 0 && (
                      <button onClick={() => toggle(machine.id)}
                        className="flex items-center gap-1 text-xs px-3 py-1.5 bg-canvas text-muted rounded-xl hover:bg-surface-2 font-medium">
                        {maints.length} {t('production', 'machine_schedule_count_suffix')} {isExpanded ? <ChevronDown size={12}/> : <ChevronRight size={12}/>}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {isExpanded && maints.length > 0 && (
                <div className="border-t border-hairline">
                  {maints.map(m => {
                    const sc = MAINT_STATUS_CFG[m.status] || MAINT_STATUS_CFG.PLANNED;
                    const isActive = ['PLANNED', 'IN_PROGRESS'].includes(m.status);
                    return (
                      <div key={m.id} className="px-4 py-3 border-b border-hairline last:border-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${m.maintenanceType === 'CORRECTIVE' ? 'bg-red-100 dark:bg-red-500/18 text-red-700 dark:text-red-300' : 'bg-blue-100 dark:bg-blue-500/18 text-blue-700 dark:text-blue-300'}`}>
                                {m.maintenanceType === 'CORRECTIVE' ? `🚨 ${t('production', 'machine_maint_type_corrective')}` : `🔧 ${t('production', 'machine_maint_type_preventive')}`}
                              </span>
                              <p className="text-sm font-medium text-ink">{m.title}</p>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${sc.cls}`}>{sc.label}</span>
                            </div>
                            <p className="text-xs text-muted mt-0.5">{fmtDate(m.plannedStart)} → {fmtDate(m.plannedEnd)}</p>
                            {m.vendorName && <p className="text-xs text-muted">{t('production', 'machine_maint_vendor_label')}: {m.vendorName} {m.vendorPhone && `· ${m.vendorPhone}`}</p>}
                            {m.actualCost && <p className="text-xs text-emerald-600 dark:text-emerald-300 font-semibold">{t('production', 'machine_maint_cost_label')}: {fmtCurrency(m.actualCost)}</p>}
                          </div>
                          {isActive && (
                            <button onClick={() => setCompleteFor(m)}
                              className="flex-shrink-0 text-xs px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 rounded-xl hover:bg-emerald-100 dark:bg-emerald-500/18 font-medium flex items-center gap-1">
                              <CheckCircle2 size={12}/> {t('production', 'machine_maint_complete_btn')}
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
