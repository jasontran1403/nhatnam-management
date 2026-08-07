// src/pages/factory_worker/FactoryPlansPage.jsx
// Nhân viên xưởng xem các kế hoạch sản xuất do Owner tạo, và tạo lệnh sản xuất (Work Order) cho từng kế hoạch.
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardList, Plus, AlertTriangle, Search, X, Factory, Calendar, RefreshCw,
} from 'lucide-react';
import useMinLoading from '../../hooks/useMinLoading';
import { CardSkeleton } from '../../components/ui/Skeleton';
import Modal from '../../components/ui/Modal';
import DateRangePicker from '../../components/ui/DateRangePicker';
import {
  SectionCard, SectionHeader, PrimaryButton, SecondaryButton, EmptyState,
  Field, inputCls,
} from '../../components/ui';
import {
  ownerProdApi, getStatusLabels, progressColor,
} from '../../api/productionModuleApi';
import { factoryWorkerApi } from '../../api/productionApi';
import { useToast } from '../../components/common/Toast';
import { useLang } from '../../context/LangContext';
import { useFmt } from '../../utils/useFmt';

// ── Status badge cho kế hoạch ────────────────────────────────────────────────
function StatusBadge({ status }) {
  const { t } = useLang();
  const cfg = getStatusLabels(t)[status] || { label: status, cls: 'bg-surface-2 text-ink-2' };
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.cls}`}>{cfg.label}</span>;
}

// ── Modal tạo lệnh sản xuất từ 1 kế hoạch ────────────────────────────────────
function CreateWorkOrderModal({ plan, products, factories, onClose, onSaved }) {
  const toast = useToast();
  const { t } = useLang();
  const { fmtDate, fmtNum } = useFmt();
  const [factoryProductId, setFactoryProductId] = useState('');
  const [plannedQty, setPlannedQty] = useState('');
  const [notes, setNotes] = useState('');
  const [productionFactoryId, setProductionFactoryId] = useState('');
  const [scheduledMode, setScheduledMode] = useState(false);
  const [dateRange, setDateRange] = useState({ from: null, to: null });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [overPlanConfirm, setOverPlanConfirm] = useState(null);

  // Sản phẩm trong kế hoạch: ưu tiên factoryProductIds (array), fallback factoryProductId (single)
  const planProductIds = plan.factoryProductIds?.length
    ? plan.factoryProductIds
    : (plan.factoryProductId ? [plan.factoryProductId] : []);
  const planProducts = planProductIds.length > 0
    ? products.filter(p => planProductIds.includes(p.id))
    : [];

  useEffect(() => {
    if (planProductIds.length === 1) setFactoryProductId(String(planProductIds[0]));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const planAcc = Number(plan.accumulatedQty || 0);
  const planTgt = Number(plan.targetQty || 0);

  const doSubmit = async (force = false) => {
    setSaving(true);
    try {
      await ownerProdApi.createWorkOrder({
        productionPlanId: plan.id,
        factoryProductId: Number(factoryProductId),
        plannedQty: Number(plannedQty),
        scheduledStartDate: dateRange.from,
        plannedEndDate: dateRange.to,
        notes,
        forceCreate: force,
        productionFactoryId: productionFactoryId ? Number(productionFactoryId) : null,
        scheduledMode,
      });
      setOverPlanConfirm(null);
      toast(t('production', 'mps_toast_wo_created'), 'success', 3000);
      onSaved();
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || t('error', 'generic');
      if (msg.startsWith('OVER_PLAN_QTY:')) {
        const [, nT, tQ] = msg.split(':');
        setOverPlanConfirm({ newTotal: nT, targetQty: tQ });
      } else { setErr(msg); }
    } finally { setSaving(false); }
  };

  return (
    <>
      <Modal open title={t('production', 'mps_create_wo_title', { code: plan.planCode })} onClose={onClose} size="md"
        footer={
          <div className="flex justify-end gap-2">
            <SecondaryButton onClick={onClose}>{t('common', 'cancel')}</SecondaryButton>
            <PrimaryButton
              onClick={async () => {
                if (!factoryProductId || !plannedQty || !dateRange.from) {
                  setErr(t('production', 'mps_err_fill_all')); return;
                }
                setErr('');
                await doSubmit(false);
              }}
              loading={saving}>
              {t('production', 'mps_create_wo')}
            </PrimaryButton>
          </div>
        }>
        <div className="space-y-4">
          {err && <p className="text-xs text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/28 rounded-xl px-3 py-2">{err}</p>}

          <div className="bg-canvas rounded-xl px-4 py-3 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-muted">{t('production', 'mps_plan_products')}</span>
              <span className="font-medium">{planProducts.map(p => p.name).join(', ') || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">{t('production', 'mps_target')}</span>
              <span className="font-medium">{fmtNum(planTgt)} {plan.outputUnit}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">{t('production', 'mps_ordered')}</span>
              <span className={`font-medium ${planAcc >= planTgt ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-300'}`}>{fmtNum(planAcc)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">{t('production', 'mps_remaining')}</span>
              <span className={`font-bold ${planTgt - planAcc <= 0 ? 'text-red-500' : 'text-gold'}`}>
                {planTgt - planAcc <= 0 ? t('production', 'mps_fulfilled') : fmtNum(planTgt - planAcc)}
              </span>
            </div>
          </div>

          <Field label={t('production', 'mps_field_product')} required>
            {planProducts.length === 0 ? (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-amber-200 dark:border-amber-500/28 bg-amber-50 dark:bg-amber-500/10">
                <AlertTriangle size={13} className="text-amber-600 dark:text-amber-300" />
                <span className="text-sm text-amber-700 dark:text-amber-300">{t('production', 'mps_no_product_in_plan')}</span>
              </div>
            ) : (
              <select className={inputCls} value={factoryProductId} onChange={e => setFactoryProductId(e.target.value)}>
                <option value="">{t('production', 'mps_select_product')}</option>
                {planProducts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
          </Field>

          <Field label={t('production', 'mps_field_total_qty')} required>
            <input type="number" className={inputCls} value={plannedQty}
              onChange={e => setPlannedQty(e.target.value)} placeholder={t('production', 'mps_ph_qty')} />
          </Field>

          <Field label={t('production', 'mps_field_period')} required>
            <div className="pt-1">
              <DateRangePicker from={dateRange.from} to={dateRange.to} onChange={setDateRange}
                placeholder={t('production', 'mps_ph_period', { date: fmtDate(plan.startDate) })} />
            </div>
          </Field>

          <Field label={t('common', 'note')}>
            <textarea className={inputCls} rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
          </Field>

          {factories?.length > 0 && (
            <Field label={t('production', 'machine_page_factory_label')}>
              <select className={inputCls} value={productionFactoryId}
                onChange={e => setProductionFactoryId(e.target.value)}>
                <option value="">{t('production', 'mps_no_factory')}</option>
                {factories.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </Field>
          )}

          <div className="flex items-center justify-between bg-canvas rounded-xl px-4 py-3">
            <div>
              <p className="text-sm font-medium">{t('production', 'mps_strict_schedule')}</p>
              <p className="text-xs text-muted">{t('production', 'mps_strict_schedule_hint')}</p>
            </div>
            <button onClick={() => setScheduledMode(v => !v)}
              className={`w-12 h-6 rounded-full transition-colors relative ${scheduledMode ? 'bg-gold' : 'bg-hairline-3'}`}>
              <div className={`w-5 h-5 bg-surface rounded-full shadow absolute top-0.5 transition-all ${scheduledMode ? 'left-6' : 'left-0.5'}`} />
            </button>
          </div>
        </div>
      </Modal>

      {overPlanConfirm && (
        <Modal open title={t('production', 'mps_over_plan_title')} onClose={() => setOverPlanConfirm(null)} size="sm"
          footer={
            <div className="flex justify-end gap-2">
              <SecondaryButton onClick={() => setOverPlanConfirm(null)}>{t('common', 'cancel')}</SecondaryButton>
              <PrimaryButton onClick={() => doSubmit(true)} loading={saving}>
                {t('production', 'mps_over_plan_confirm')}
              </PrimaryButton>
            </div>
          }>
          <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/28 rounded-xl p-3 flex gap-3">
            <AlertTriangle size={18} className="text-amber-600 dark:text-amber-300 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800 dark:text-amber-300">
              <p className="font-semibold">{t('production', 'mps_over_plan_warning')}</p>
              <p className="mt-1">
                {t('production', 'mps_total')}: <b>{fmtNum(overPlanConfirm.newTotal)}</b>
                {' / '}
                {t('production', 'mps_target')}: <b>{fmtNum(overPlanConfirm.targetQty)}</b>
              </p>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

// ── Plan card ─────────────────────────────────────────────────────────────────
function PlanCard({ plan, onCreateWO, onOpen }) {
  const { t } = useLang();
  const { fmtDate, fmtNum } = useFmt();
  const pct = Number(plan.progressPct || 0);
  const color = progressColor(pct);
  return (
    <div className="bg-surface rounded-2xl border border-hairline shadow-sm p-4 sm:p-5 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <button onClick={onOpen} className="text-left min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-ink font-mono">{plan.planCode}</span>
            <StatusBadge status={plan.status} />
          </div>
          <p className="text-sm text-muted mt-0.5 truncate">{plan.title}</p>
        </button>
      </div>

      <div className="flex flex-wrap gap-2 text-xs text-muted">
        <span className="flex items-center gap-1">
          <Calendar size={11} /> {fmtDate(plan.startDate)} → {fmtDate(plan.endDate)}
        </span>
        {Date.now() > Number(plan.endDate) && plan.status !== 'COMPLETED' && (
          <span className="text-red-500 font-medium">⚠ {t('production', 'mps_overdue')}</span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="flex justify-between mb-1 text-[10px]">
            <span className="text-muted">{fmtNum(plan.accumulatedQty)} / {fmtNum(plan.targetQty)} {plan.outputUnit}</span>
            <span className="font-bold" style={{ color: color.hex }}>{pct.toFixed(0)}%</span>
          </div>
          <div className="h-1.5 bg-hairline rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color.hex }} />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-muted">
        <span>{t('production', 'mps_wo_count', { n: plan.totalWorkOrders || 0 })}</span>
        {plan.status === 'ACTIVE' && (
          <button onClick={onCreateWO}
            className="flex items-center gap-1 font-semibold text-gold hover:underline">
            <Plus size={12} /> {t('production', 'mps_create_wo')}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function FactoryPlansPage() {
  const navigate = useNavigate();
  const { t } = useLang();
  const [plans, setPlans] = useState([]);
  const [products, setProducts] = useState([]);
  const [factories, setFactories] = useState([]);
  const [loading, setLoading] = useMinLoading(true);
  const [search, setSearch] = useState('');
  const [createForPlan, setCreateForPlan] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [planRes, prods, facts] = await Promise.all([
        ownerProdApi.listPlans(0, 50, 'ACTIVE'),
        factoryWorkerApi.listProducts().catch(() => []),
        ownerProdApi.listFactories().catch(() => []),
      ]);
      setPlans(planRes?.content || []);
      setProducts(prods || []);
      setFactories(facts || []);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = plans.filter(p =>
    !search.trim() ||
    p.planCode?.toLowerCase().includes(search.toLowerCase()) ||
    p.title?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 sm:p-6 space-y-4 bg-surface-2 min-h-full">
      <div className="bg-forest-deep rounded-2xl p-5 text-white">
        <p className="text-forest text-xs uppercase tracking-widest font-medium">
          {t('production', 'machine_page_factory_label')}
        </p>
        <h1 className="text-xl font-bold mt-0.5">{t('production', 'mps_title')}</h1>
        <p className="text-white/60 text-xs mt-1">{t('production', 'mps_subtitle')}</p>
      </div>

      <div className="bg-surface rounded-2xl border border-hairline shadow-sm p-3 sm:p-4 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <input className={inputCls + ' pl-8'} placeholder={t('production', 'mps_search_ph')}
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-2 px-3 py-2 bg-canvas border border-line rounded-xl text-sm text-ink hover:bg-surface-2 transition-colors">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> {t('common', 'refresh')}
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{[...Array(4)].map((_, i) => <CardSkeleton key={i} lines={4} />)}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-hairline shadow-sm p-10 text-center">
          <ClipboardList size={32} className="mx-auto text-faint mb-3" />
          <p className="text-sm text-muted">{t('production', 'mps_empty')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filtered.map(p => (
            <PlanCard key={p.id} plan={p}
              onOpen={() => navigate('/factory/orders')}
              onCreateWO={() => setCreateForPlan(p)} />
          ))}
        </div>
      )}

      {createForPlan && (
        <CreateWorkOrderModal plan={createForPlan} products={products} factories={factories}
          onClose={() => setCreateForPlan(null)}
          onSaved={() => { setCreateForPlan(null); load(); }} />
      )}
    </div>
  );
}
