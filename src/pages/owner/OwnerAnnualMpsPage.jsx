// OwnerAnnualMpsPage.jsx
// Trang kế hoạch sản xuất chủ đạo hàng năm — Annual MPS Dashboard
import { useState, useEffect, useMemo } from 'react';
import { Plus, X, TrendingUp, Package2, BarChart3, Clock } from 'lucide-react';
import useMinLoading from '../../hooks/useMinLoading.js';
import { Field, inputCls, PrimaryButton } from '../../components/ui';
import { CardSkeleton } from '../../components/ui/Skeleton.jsx';
import { ownerProductionApi } from '../../api/productionApi';
import { useLang } from '../../context/LangContext';
import { useFmt } from '../../utils/useFmt';

const getMonths = (t) =>
  Array.from({ length: 12 }, (_, i) => t('production', 'month_short', { n: i + 1 }));

const getStatusConfig = (t) => ({
  DRAFT:    { label: t('production', 'amps_status_draft'),    cls: 'bg-gray-100 text-gray-600' },
  APPROVED: { label: t('production', 'amps_status_approved'), cls: 'bg-blue-100 text-blue-700' },
  RELEASED: { label: t('production', 'amps_status_released'), cls: 'bg-emerald-100 text-emerald-700' },
});

// ── Bar Chart — Monthly KPIs ─────────────────────────────────────────────────
function MonthlyBarChart({ kpis }) {
  const { t } = useLang();
  const maxHrs = Math.max(...kpis.map(k => Number(k.plannedHours || 0)), 1);

  return (
    <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-5">
      <p className="text-sm font-semibold text-[#1C1C1E] mb-4">{t('production', 'amps_chart_hours')}</p>
      <div className="flex items-end gap-1.5 h-32">
        {kpis.map((k, i) => {
          const runtimeH = Math.round((Number(k.plannedHours || 0) / maxHrs) * 100);
          const maintH   = Math.round((Number(k.maintenanceHours || 0) / maxHrs) * 100);
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-0.5 group relative">
              <div className="w-full flex flex-col-reverse rounded-t overflow-hidden"
                   style={{ height: `${Math.max(runtimeH + maintH, 2)}%` }}>
                <div className="bg-[#1A2B1A]" style={{ flex: runtimeH }}
                  title={t('production', 'amps_hours_production', { n: k.plannedHours })} />
                <div className="bg-amber-300" style={{ flex: maintH }}
                  title={t('production', 'amps_hours_maintenance', { n: k.maintenanceHours })} />
              </div>
              {/* tooltip */}
              <div className="absolute bottom-full mb-1 hidden group-hover:block bg-[#1C1C1E] text-white text-xs rounded-lg px-2 py-1 whitespace-nowrap z-10">
                {k.monthLabel}: {t('production', 'amps_tooltip_hours', {
                  prod: k.plannedHours, maint: k.maintenanceHours,
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-2">
        {kpis.map((k, i) => (
          <span key={i} className="flex-1 text-center text-[9px] text-[#8E8878]">{k.monthLabel}</span>
        ))}
      </div>
      <div className="flex items-center gap-4 mt-3 text-xs text-[#8E8878]">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#1A2B1A]" />{t('production', 'amps_legend_production')}</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-300" />{t('production', 'amps_legend_maintenance')}</span>
      </div>
    </div>
  );
}

// ── Utilization Trend ────────────────────────────────────────────────────────
function UtilizationChart({ kpis }) {
  const { t } = useLang();
  const max = 100;
  const pts = kpis.map((k, i) => {
    const x = (i / (kpis.length - 1)) * 260;
    const y = 60 - (Number(k.utilizationPct || 0) / max) * 56;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-5">
      <p className="text-sm font-semibold text-[#1C1C1E] mb-4">{t('production', 'amps_chart_utilization')}</p>
      <svg viewBox="0 0 260 70" className="w-full h-20">
        <polyline points={pts} fill="none" stroke="#C9A84C" strokeWidth="2" />
        {kpis.map((k, i) => {
          const x = (i / (kpis.length - 1)) * 260;
          const y = 60 - (Number(k.utilizationPct || 0) / max) * 56;
          return <circle key={i} cx={x} cy={y} r="3" fill="#C9A84C" />;
        })}
        <line x1="0" y1="18" x2="260" y2="18" stroke="#e5e7eb" strokeDasharray="4 2" />
        <text x="2" y="16" fontSize="8" fill="#8E8878">80%</text>
      </svg>
      <div className="flex justify-between">
        {kpis.map((k, i) => (
          <span key={i} className="flex-1 text-center text-[9px] text-[#8E8878]">{k.monthLabel}</span>
        ))}
      </div>
    </div>
  );
}

// ── Modal thêm / sửa kế hoạch ────────────────────────────────────────────────
function MpsModal({ products, machines, item, year, onClose, onSaved }) {
  const { t } = useLang();
  const MONTHS = useMemo(() => getMonths(t), [t]);
  const [form, setForm] = useState({
    year: item?.year || year,
    month: item?.month || 1,
    factoryProductId: item?.factoryProductId || '',
    machineId: item?.machineId || '',
    forecastDemand: item?.forecastDemand || '',
    plannedProductionQty: item?.plannedProductionQty || '',
    machineHoursRequired: item?.machineHoursRequired || '',
    netAvailableMachineHours: item?.netAvailableMachineHours || '',
    notes: item?.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.factoryProductId || !form.plannedProductionQty) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        year: Number(form.year),
        month: Number(form.month),
        factoryProductId: Number(form.factoryProductId),
        machineId: form.machineId ? Number(form.machineId) : null,
        forecastDemand: form.forecastDemand ? Number(form.forecastDemand) : null,
        plannedProductionQty: Number(form.plannedProductionQty),
        machineHoursRequired: form.machineHoursRequired ? Number(form.machineHoursRequired) : null,
        netAvailableMachineHours: form.netAvailableMachineHours ? Number(form.netAvailableMachineHours) : null,
      };
      const saved = item?.id
        ? await ownerProductionApi.updateMps(item.id, payload)
        : await ownerProductionApi.createMps(payload);
      onSaved(saved);
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-black/5 bg-[#1A2B1A] flex items-center justify-between sticky top-0">
          <h2 className="text-white font-semibold text-sm">
            {item ? t('production', 'amps_edit_title') : t('production', 'amps_create_title')}
          </h2>
          <button onClick={onClose} className="text-white/60 hover:text-white"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('common', 'year')} required>
              <input type="number" className={inputCls} value={form.year}
                onChange={e => set('year', e.target.value)} />
            </Field>
            <Field label={t('common', 'month')} required>
              <select className={inputCls} value={form.month}
                onChange={e => set('month', e.target.value)}>
                {MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
              </select>
            </Field>
          </div>
          <Field label={t('production', 'amps_field_product')} required>
            <select className={inputCls} value={form.factoryProductId}
              onChange={e => set('factoryProductId', e.target.value)}>
              <option value="">{t('production', 'amps_select_product')}</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>)}
            </select>
          </Field>
          <Field label={t('production', 'amps_field_machine')}>
            <select className={inputCls} value={form.machineId}
              onChange={e => set('machineId', e.target.value)}>
              <option value="">{t('production', 'amps_all_machines_opt')}</option>
              {machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('production', 'amps_field_forecast')}>
              <input type="number" className={inputCls} placeholder={t('production', 'mps_ph_qty')}
                value={form.forecastDemand} onChange={e => set('forecastDemand', e.target.value)} />
            </Field>
            <Field label={t('production', 'amps_field_planned_qty')} required>
              <input type="number" className={inputCls} placeholder={t('production', 'amps_ph_planned_qty')}
                value={form.plannedProductionQty}
                onChange={e => set('plannedProductionQty', e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('production', 'amps_field_hours_required')}>
              <input type="number" className={inputCls} placeholder={t('production', 'amps_ph_hours_required')}
                value={form.machineHoursRequired}
                onChange={e => set('machineHoursRequired', e.target.value)} />
            </Field>
            <Field label={t('production', 'amps_field_hours_available')}>
              <input type="number" className={inputCls} placeholder={t('production', 'amps_ph_hours_available')}
                value={form.netAvailableMachineHours}
                onChange={e => set('netAvailableMachineHours', e.target.value)} />
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
            disabled={!form.factoryProductId || !form.plannedProductionQty}>
            {item ? t('common', 'save') : t('production', 'amps_add')}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function OwnerAnnualMpsPage() {
  const { t } = useLang();
  const { fmtNum } = useFmt();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [dashboard, setDashboard] = useState(null);
  const [products, setProducts] = useState([]);
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useMinLoading();
  const [modal, setModal] = useState(null);
  const [filterProduct, setFilterProduct] = useState('');
  const [view, setView] = useState('dashboard'); // 'dashboard' | 'list'

  const STATUS_CONFIG = useMemo(() => getStatusConfig(t), [t]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [dash, prods, machs] = await Promise.all([
        ownerProductionApi.getMpsDashboard(year, filterProduct || null),
        ownerProductionApi.listProducts(true),
        ownerProductionApi.listMachines(true),
      ]);
      setDashboard(dash);
      setProducts(prods || []);
      setMachines(machs || []);
    } finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, [year, filterProduct]); // eslint-disable-line

  const onSaved = () => { setModal(null); loadData(); };

  const deletePlan = async (id) => {
    if (!confirm(t('production', 'amps_confirm_delete'))) return;
    await ownerProductionApi.deleteMps(id);
    loadData();
  };

  if (loading && !dashboard) return <div className="p-8"><CardSkeleton lines={6} /></div>;

  const kpis   = dashboard?.monthlyKpis || [];
  const plans  = dashboard?.plans || [];
  const totalHrs = Number(dashboard?.totalProductionHours || 0);
  const avgUtil  = Number(dashboard?.avgUtilizationPct || 0);

  const kpiCards = [
    { icon: Clock,      label: t('production', 'amps_kpi_total_hours'),  value: `${fmtNum(totalHrs)}h`, color: 'text-[#1A2B1A]' },
    { icon: BarChart3,  label: t('production', 'amps_kpi_avg_util'),     value: `${avgUtil.toFixed(1)}%`, color: avgUtil > 90 ? 'text-red-500' : avgUtil > 70 ? 'text-[#C9A84C]' : 'text-emerald-600' },
    { icon: Package2,   label: t('production', 'amps_kpi_total_plans'),  value: plans.length, color: 'text-blue-600' },
    { icon: TrendingUp, label: t('production', 'amps_kpi_total_output'),
      value: fmtNum(plans.reduce((s, p) => s + Number(p.plannedProductionQty || 0), 0)),
      color: 'text-[#C9A84C]' },
  ];

  const tableHeaders = [
    t('common', 'month'),
    t('production', 'amps_col_planned_qty'),
    t('production', 'amps_col_prod_hours'),
    t('production', 'amps_col_machine_hours'),
    t('production', 'amps_col_maint_hours'),
    t('production', 'amps_col_utilization'),
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#1C1C1E]"
              style={{ fontFamily: 'var(--font-display)' }}>
            {t('production', 'mps_title')}
          </h1>
          <p className="text-sm text-[#8E8878] mt-1">Annual Master Production Schedule — {year}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Year filter */}
          <select className={inputCls + ' !py-2 !text-sm w-28'}
            value={year} onChange={e => setYear(Number(e.target.value))}>
            {[currentYear-1, currentYear, currentYear+1].map(y =>
              <option key={y} value={y}>{y}</option>)}
          </select>
          {/* Product filter */}
          <select className={inputCls + ' !py-2 !text-sm w-44'}
            value={filterProduct} onChange={e => setFilterProduct(e.target.value)}>
            <option value="">{t('production', 'recipe_all_products')}</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {/* View toggle */}
          <div className="flex rounded-xl border border-black/10 overflow-hidden">
            {['dashboard','list'].map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-2 text-xs font-medium transition-colors ${
                  view === v ? 'bg-[#1A2B1A] text-white' : 'bg-white text-[#8E8878] hover:text-[#1C1C1E]'
                }`}>
                {v === 'dashboard' ? t('production', 'amps_view_overview') : t('production', 'amps_view_detail')}
              </button>
            ))}
          </div>
          <button onClick={() => setModal('create')}
            className="flex items-center gap-2 bg-[#1A2B1A] text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#243824] transition-colors">
            <Plus size={16} />{t('production', 'amps_add')}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {kpiCards.map(kpi => (
          <div key={kpi.label} className="bg-white rounded-2xl border border-black/5 p-4 shadow-sm">
            <kpi.icon size={18} className={kpi.color + ' mb-2'} />
            <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
            <p className="text-xs text-[#8E8878] mt-0.5">{kpi.label}</p>
          </div>
        ))}
      </div>

      {view === 'dashboard' ? (
        /* Dashboard charts */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <MonthlyBarChart kpis={kpis} />
          <UtilizationChart kpis={kpis} />

          {/* Monthly KPI table */}
          <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden lg:col-span-2">
            <div className="px-5 py-4 border-b border-black/5 bg-[#FAF7F2]">
              <p className="text-sm font-semibold text-[#1C1C1E]">{t('production', 'amps_monthly_detail')}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-[#8E8878] border-b border-black/5">
                    {tableHeaders.map((h, i) => (
                      <th key={h} className={`py-3 px-4 font-medium ${i === 0 ? 'text-left' : 'text-right'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {kpis.map((k, i) => (
                    <tr key={i} className={`border-b border-black/5 last:border-0 ${
                      Number(k.plannedQty) > 0 ? '' : 'opacity-40'
                    }`}>
                      <td className="py-3 px-4 font-medium text-[#1C1C1E]">{k.monthLabel}</td>
                      <td className="py-3 px-4 text-right text-[#1C1C1E]">{fmtNum(k.plannedQty)}</td>
                      <td className="py-3 px-4 text-right">{fmtNum(k.plannedHours || 0)}h</td>
                      <td className="py-3 px-4 text-right">{fmtNum(k.machineHours || 0)}h</td>
                      <td className="py-3 px-4 text-right text-amber-600">{Number(k.maintenanceHours || 0)}h</td>
                      <td className="py-3 px-4 text-right">
                        <span className={`font-semibold ${
                          Number(k.utilizationPct) > 90 ? 'text-red-500' :
                          Number(k.utilizationPct) > 70 ? 'text-[#C9A84C]' : 'text-emerald-600'
                        }`}>{Number(k.utilizationPct || 0).toFixed(1)}%</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* List view */
        <div className="space-y-2">
          {plans.length === 0 && (
            <div className="bg-white rounded-2xl border border-black/5 p-10 text-center">
              <Package2 size={28} className="mx-auto text-[#8E8878] mb-3" />
              <p className="text-sm text-[#8E8878]">{t('production', 'amps_empty_year', { year })}</p>
            </div>
          )}
          {plans.map(plan => (
            <div key={plan.id} className="bg-white rounded-2xl border border-black/5 shadow-sm p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-[#1C1C1E]">{plan.factoryProductName}</span>
                    <span className="text-xs text-[#8E8878]">
                      {t('production', 'month_short', { n: plan.month })}/{plan.year}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_CONFIG[plan.status]?.cls}`}>
                      {STATUS_CONFIG[plan.status]?.label}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-4 mt-2 text-xs text-[#8E8878]">
                    <span>
                      {t('production', 'amps_label_planned')}: <b className="text-[#1C1C1E]">{fmtNum(plan.plannedProductionQty)} {plan.factoryProductUnit}</b>
                    </span>
                    {plan.machineHoursRequired && (
                      <span>{t('production', 'amps_label_machine_hours')}: <b className="text-[#1C1C1E]">{plan.machineHoursRequired}h</b></span>
                    )}
                    {plan.utilizationPercent && (
                      <span>
                        {t('production', 'amps_col_utilization')}: <b className={Number(plan.utilizationPercent) > 90 ? 'text-red-500' : 'text-[#1C1C1E]'}>{plan.utilizationPercent}%</b>
                      </span>
                    )}
                    {plan.machineName && (
                      <span>{t('production', 'omaint_col_machine')}: <b className="text-[#1C1C1E]">{plan.machineName}</b></span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  <button onClick={() => setModal(plan)}
                    title={t('common', 'edit')}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-black/5 text-[#8E8878] hover:text-[#1C1C1E] transition-colors text-xs">
                    ✏️
                  </button>
                  <button onClick={() => deletePlan(plan.id)}
                    title={t('common', 'delete')}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-[#8E8878] hover:text-red-500 transition-colors">
                    <X size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <MpsModal
          products={products} machines={machines}
          item={modal === 'create' ? null : modal}
          year={year}
          onClose={() => setModal(null)}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}
