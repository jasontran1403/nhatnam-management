// OwnerMaintenancePage.jsx
// Trang lịch bảo trì máy móc — calendar + dashboard theo năm
import { useState, useEffect, useMemo } from 'react';
import { Plus, X, Wrench, TrendingDown, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import useMinLoading from '../../hooks/useMinLoading.js';
import { Field, inputCls, PrimaryButton } from '../../components/ui';
import { CardSkeleton } from '../../components/ui/Skeleton.jsx';
import { ownerProductionApi } from '../../api/productionApi';
import { useLang } from '../../context/LangContext';
import { useFmt } from '../../utils/useFmt';

const getMonths = (t) =>
  Array.from({ length: 12 }, (_, i) => t('production', 'month_short', { n: i + 1 }));

const getStatusConfig = (t) => ({
  PLANNED:   { label: t('production', 'omaint_status_planned'),   cls: 'bg-blue-100 text-blue-700' },
  SCHEDULED: { label: t('production', 'omaint_status_scheduled'), cls: 'bg-indigo-100 text-indigo-700' },
  COMPLETED: { label: t('production', 'maint_status_completed'),  cls: 'bg-emerald-100 text-emerald-700' },
  ADJUSTED:  { label: t('production', 'maint_status_adjusted'),   cls: 'bg-amber-100 text-amber-700' },
  MISSED:    { label: t('production', 'maint_status_missed'),     cls: 'bg-red-100 text-red-700' },
});

const getTypeLabels = (t) => ({
  PREVENTIVE: t('production', 'omaint_type_preventive'),
  CORRECTIVE: t('production', 'omaint_type_corrective'),
  INSPECTION: t('production', 'omaint_type_inspection'),
});

// ── Calendar Row (Gantt-style per machine) ────────────────────────────────────
function MaintenanceCalendar({ items, year }) {
  const { t } = useLang();
  const { fmtDate } = useFmt();
  const MONTHS = useMemo(() => getMonths(t), [t]);
  const TYPE_LABELS = useMemo(() => getTypeLabels(t), [t]);

  // Group by machine
  const byMachine = {};
  items.forEach(it => {
    if (!byMachine[it.machineId]) byMachine[it.machineId] = { name: it.machineName, events: [] };
    byMachine[it.machineId].events.push(it);
  });

  const legend = [
    ['bg-blue-400',    t('production', 'omaint_status_planned')],
    ['bg-emerald-400', t('production', 'maint_status_completed')],
    ['bg-amber-400',   t('production', 'maint_status_adjusted')],
    ['bg-red-400',     t('production', 'maint_status_missed')],
  ];

  return (
    <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[700px]">
          <thead>
            <tr className="bg-[#FAF7F2] border-b border-black/5">
              <th className="text-left px-4 py-3 font-semibold text-[#1C1C1E] w-36">
                {t('production', 'omaint_col_machine')}
              </th>
              {MONTHS.map((m, i) => (
                <th key={i} className="text-center py-3 font-medium text-[#8E8878] w-16">{m}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(byMachine).map(([machineId, { name, events }]) => (
              <tr key={machineId} className="border-b border-black/5 last:border-0">
                <td className="px-4 py-3 font-semibold text-[#1C1C1E] text-xs truncate max-w-[140px]">{name}</td>
                {MONTHS.map((_, mo) => {
                  const monthEvents = events.filter(e => {
                    const d = new Date(e.plannedStart);
                    return d.getFullYear() === year && d.getMonth() === mo;
                  });
                  return (
                    <td key={mo} className="text-center py-2 px-1">
                      {monthEvents.map((ev, i) => (
                        <div key={i}
                          title={`${ev.machineName} — ${TYPE_LABELS[ev.maintenanceType]}\n${fmtDate(ev.plannedStart)}\n${ev.plannedDowntimeHours}h downtime`}
                          className={`mx-auto w-7 h-4 rounded cursor-default ${
                            ev.status === 'COMPLETED' ? 'bg-emerald-400' :
                            ev.status === 'ADJUSTED'  ? 'bg-amber-400' :
                            ev.status === 'MISSED'    ? 'bg-red-400' : 'bg-blue-400'
                          }`} />
                      ))}
                    </td>
                  );
                })}
              </tr>
            ))}
            {Object.keys(byMachine).length === 0 && (
              <tr><td colSpan={13} className="text-center py-10 text-[#8E8878] text-sm italic">
                {t('production', 'omaint_empty_calendar')}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
      {/* Legend */}
      <div className="px-4 py-3 border-t border-black/5 bg-[#FAF7F2] flex flex-wrap gap-4 text-xs text-[#8E8878]">
        {legend.map(([c, l]) => (
          <span key={l} className="flex items-center gap-1.5">
            <span className={`w-3 h-3 rounded ${c}`} />{l}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Modal thêm / sửa lịch ─────────────────────────────────────────────────────
function MaintenanceModal({ machines, item, onClose, onSaved }) {
  const { t } = useLang();
  const [form, setForm] = useState({
    machineId: item?.machineId || '',
    plannedStart: item?.plannedStart ? new Date(item.plannedStart).toISOString().slice(0,10) : '',
    plannedEnd:   item?.plannedEnd   ? new Date(item.plannedEnd).toISOString().slice(0,10) : '',
    plannedDowntimeHours: item?.plannedDowntimeHours || '',
    maintenanceType: item?.maintenanceType || 'PREVENTIVE',
    notes: item?.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const toMs = (dateStr) => dateStr ? new Date(dateStr + 'T07:00:00').getTime() : null;

  const submit = async () => {
    if (!form.machineId || !form.plannedStart || !form.plannedDowntimeHours) return;
    setSaving(true);
    try {
      const payload = {
        machineId: Number(form.machineId),
        plannedStart: toMs(form.plannedStart),
        plannedEnd: toMs(form.plannedEnd || form.plannedStart),
        plannedDowntimeHours: Number(form.plannedDowntimeHours),
        maintenanceType: form.maintenanceType,
        notes: form.notes,
      };
      const saved = item?.id
        ? await ownerProductionApi.updateMaintenance(item.id, payload)
        : await ownerProductionApi.createMaintenance(payload);
      onSaved(saved);
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-black/5 bg-[#1A2B1A] flex items-center justify-between">
          <h2 className="text-white font-semibold text-sm">
            {item ? t('production', 'omaint_edit_title') : t('production', 'omaint_create_title')}
          </h2>
          <button onClick={onClose} className="text-white/60 hover:text-white"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          <Field label={t('production', 'omaint_col_machine')} required>
            <select className={inputCls} value={form.machineId} onChange={e => set('machineId', e.target.value)}>
              <option value="">{t('production', 'omaint_select_machine')}</option>
              {machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('production', 'omaint_field_start')} required>
              <input type="date" className={inputCls} value={form.plannedStart}
                onChange={e => set('plannedStart', e.target.value)} />
            </Field>
            <Field label={t('production', 'omaint_field_end')}>
              <input type="date" className={inputCls} value={form.plannedEnd}
                onChange={e => set('plannedEnd', e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('production', 'omaint_field_downtime')} required>
              <input type="number" className={inputCls} placeholder={t('production', 'omaint_ph_downtime')}
                value={form.plannedDowntimeHours}
                onChange={e => set('plannedDowntimeHours', e.target.value)} />
            </Field>
            <Field label={t('production', 'omaint_field_type')}>
              <select className={inputCls} value={form.maintenanceType}
                onChange={e => set('maintenanceType', e.target.value)}>
                <option value="PREVENTIVE">{t('production', 'omaint_type_preventive')}</option>
                <option value="CORRECTIVE">{t('production', 'omaint_type_corrective')}</option>
                <option value="INSPECTION">{t('production', 'omaint_type_inspection')}</option>
              </select>
            </Field>
          </div>
          <Field label={t('common', 'note')}>
            <textarea className={inputCls} rows={2} value={form.notes}
              onChange={e => set('notes', e.target.value)} />
          </Field>
        </div>
        <div className="px-6 py-4 border-t border-black/5 bg-[#FAF7F2]/50 flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-[#8E8878]">{t('common', 'cancel')}</button>
          <PrimaryButton onClick={submit} loading={saving}
            disabled={!form.machineId || !form.plannedStart || !form.plannedDowntimeHours}>
            {item ? t('common', 'save_changes') : t('production', 'omaint_add')}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function OwnerMaintenancePage() {
  const { t } = useLang();
  const { fmtDate } = useFmt();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [summary, setSummary] = useState(null);
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useMinLoading();
  const [modal, setModal] = useState(null);
  const [filterMachine, setFilterMachine] = useState('');

  const STATUS_CONFIG = useMemo(() => getStatusConfig(t), [t]);
  const TYPE_LABELS   = useMemo(() => getTypeLabels(t), [t]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sum, mach] = await Promise.all([
        ownerProductionApi.getMaintenanceSummary(year, filterMachine || null),
        ownerProductionApi.listMachines(true),
      ]);
      setSummary(sum);
      setMachines(mach || []);
    } finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, [year, filterMachine]); // eslint-disable-line

  const onSaved = () => { setModal(null); loadData(); };

  const deleteItem = async (id) => {
    if (!confirm(t('production', 'omaint_confirm_delete'))) return;
    await ownerProductionApi.deleteMaintenance(id);
    loadData();
  };

  if (loading && !summary) return <div className="p-8"><CardSkeleton lines={5} /></div>;

  const items = summary?.items || [];

  const kpis = summary ? [
    { icon: Clock,         label: t('production', 'omaint_kpi_planned_downtime'), value: t('production', 'metrics_hours', { n: summary.totalPlannedDowntimeHours }), color: 'text-blue-600' },
    { icon: CheckCircle2,  label: t('production', 'omaint_kpi_on_schedule'),      value: `${summary.completedOnSchedule}/${summary.totalScheduled}`, color: 'text-emerald-600' },
    { icon: AlertTriangle, label: t('production', 'maint_status_adjusted'),       value: summary.adjustmentsMade, color: 'text-amber-600' },
    { icon: TrendingDown,  label: t('production', 'omaint_kpi_avg_deviation'),    value: summary.avgDeviationDays ?? 0, color: 'text-[#C9A84C]' },
  ] : [];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#1C1C1E]"
              style={{ fontFamily: 'var(--font-display)' }}>
            {t('production', 'omaint_title')}
          </h1>
          <p className="text-sm text-[#8E8878] mt-1">
            {t('production', 'omaint_subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <select className={inputCls + ' !py-2 !text-sm w-28'}
            value={year} onChange={e => setYear(Number(e.target.value))}>
            {[currentYear-1, currentYear, currentYear+1].map(y =>
              <option key={y} value={y}>{y}</option>)}
          </select>
          <select className={inputCls + ' !py-2 !text-sm w-44'}
            value={filterMachine} onChange={e => setFilterMachine(e.target.value)}>
            <option value="">{t('production', 'omaint_all_machines')}</option>
            {machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <button onClick={() => setModal('create')}
            className="flex items-center gap-2 bg-[#1A2B1A] text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#243824] transition-colors">
            <Plus size={16} />{t('production', 'omaint_add')}
          </button>
        </div>
      </div>

      {/* KPIs */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {kpis.map(kpi => (
            <div key={kpi.label} className="bg-white rounded-2xl border border-black/5 p-4 shadow-sm">
              <kpi.icon size={18} className={kpi.color + ' mb-2'} />
              <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
              <p className="text-xs text-[#8E8878] mt-0.5">{kpi.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Gantt Calendar */}
      <div>
        <p className="text-xs font-medium text-[#8E8878] uppercase tracking-wide mb-3">
          {t('production', 'omaint_calendar_title')} — {year}
        </p>
        <MaintenanceCalendar items={items} year={year} />
      </div>

      {/* Detail list */}
      <div>
        <p className="text-xs font-medium text-[#8E8878] uppercase tracking-wide mb-3">
          {t('production', 'omaint_detail_list')} ({items.length})
        </p>
        <div className="space-y-2">
          {items.map(item => (
            <div key={item.id} className="bg-white rounded-2xl border border-black/5 shadow-sm p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-[#1C1C1E]">{item.machineName}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_CONFIG[item.status]?.cls || 'bg-gray-100 text-gray-500'}`}>
                      {STATUS_CONFIG[item.status]?.label || item.status}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[#FAF7F2] text-[#8E8878]">
                      {TYPE_LABELS[item.maintenanceType]}
                    </span>
                  </div>
                  <p className="text-xs text-[#8E8878] mt-1">
                    {t('production', 'omaint_planned')}: {fmtDate(item.plannedStart)}
                    {item.plannedEnd && item.plannedEnd !== item.plannedStart && ` → ${fmtDate(item.plannedEnd)}`}
                    {' · '}{item.plannedDowntimeHours}h downtime
                  </p>
                  {item.actualStart && (
                    <p className="text-xs text-emerald-600 mt-0.5">
                      {t('production', 'omaint_actual')}: {fmtDate(item.actualStart)} · {item.actualDowntimeHours}h
                      {item.deviationDays !== null && item.deviationDays !== 0 &&
                        <span className={`ml-1 ${Math.abs(item.deviationDays) > 0 ? 'text-amber-600' : ''}`}>
                          ({item.deviationDays > 0 ? '+' : ''}{t('production', 'omaint_days', { n: item.deviationDays })})
                        </span>}
                    </p>
                  )}
                  {item.notes && <p className="text-xs text-[#8E8878] italic mt-0.5">{item.notes}</p>}
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  <button onClick={() => setModal(item)}
                    title={t('common', 'edit')}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-black/5 text-[#8E8878] hover:text-[#1C1C1E] transition-colors text-xs">
                    ✏️
                  </button>
                  <button onClick={() => deleteItem(item.id)}
                    title={t('common', 'delete')}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-[#8E8878] hover:text-red-500 transition-colors">
                    <X size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {items.length === 0 && (
            <div className="bg-white rounded-2xl border border-black/5 p-10 text-center">
              <Wrench size={28} className="mx-auto text-[#8E8878] mb-3" />
              <p className="text-sm text-[#8E8878]">
                {t('production', 'omaint_empty_year', { year })}
              </p>
            </div>
          )}
        </div>
      </div>

      {modal && (
        <MaintenanceModal
          machines={machines}
          item={modal === 'create' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}
