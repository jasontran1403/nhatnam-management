// src/pages/owner/OwnerPlanDetailPage.jsx
import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Factory, CheckCircle2, Clock, AlertTriangle,
  ClipboardList, TrendingUp, Package, X, Loader2, Plus,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import useMinLoading from '../../hooks/useMinLoading';
import { CardSkeleton } from '../../components/ui/Skeleton';
import {
  SectionCard, SectionHeader, PrimaryButton, SecondaryButton, DangerButton,
} from '../../components/ui';
import {
  ownerProdApi, getStatusLabels, progressColor,
} from '../../api/productionModuleApi';
import { useAuth } from '../../context/AuthContext';
import { useLang } from '../../context/LangContext';
import { useFmt } from '../../utils/useFmt';

// ── Helpers ───────────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const { t } = useLang();
  const cfg = getStatusLabels(t)[status] || { label: status, cls: 'bg-gray-100 text-gray-600' };
  return <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.cls}`}>{cfg.label}</span>;
}

function ProgressRing({ pct, size = 80 }) {
  const v = Math.min(Number(pct || 0), 100);
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (v / 100) * circ;
  const color = progressColor(v);
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={8} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color.hex}
        strokeWidth={8} strokeDasharray={`${dash} ${circ-dash}`} strokeLinecap="round" />
    </svg>
  );
}

const WO_STATUS_COLOR = {
  SCHEDULED:    '#3b82f6',
  PENDING_PLAN: '#f59e0b',
  PLANNED:      '#6366f1',
  IN_PROGRESS:  '#f97316',
  COMPLETED:    '#10b981',
  CANCELLED:    '#9ca3af',
};

// Nhãn trạng thái lệnh SX — dùng chung key status_* trong productionModuleApi
const getWoStatusLabel = (t) => {
  const S = getStatusLabels(t);
  return Object.fromEntries(Object.keys(WO_STATUS_COLOR).map(k => [k, S[k]?.label || k]));
};

// Custom tooltip for charts
function ChartTooltip({ active, payload, label, unit = '' }) {
  const { fmtNum } = useFmt();
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-black/10 rounded-xl shadow-lg px-3 py-2 text-xs">
      {label && <p className="font-semibold text-[#1C1C1E] mb-1">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-medium">
          {p.name}: {fmtNum(p.value)}{unit}
        </p>
      ))}
    </div>
  );
}

export default function OwnerPlanDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { role } = useAuth();
  const { t } = useLang();
  const { fmtDate, fmtNum } = useFmt();
  const isSuperFactoryWorker = role === 'SUPER_FACTORY_WORKER';
  const basePath = isSuperFactoryWorker ? '/super-factory/production' : '/owner/production';
  const woBasePath = isSuperFactoryWorker ? '/super-factory/production/work-orders' : '/owner/production/work-orders';
  const [plan, setPlan]       = useState(null);
  const [orders, setOrders]   = useState([]);
  const [loading, setLoading] = useMinLoading(true);
  const [acting, setActing]   = useState(false);

  const WO_STATUS_LABEL = useMemo(() => getWoStatusLabel(t), [t]);

  // Nhãn series biểu đồ (dùng làm dataKey → phải lấy từ t)
  const LBL_PLANNED = t('production', 'plandt_series_planned');
  const LBL_ACTUAL  = t('production', 'plandt_series_actual');

  const load = async () => {
    setLoading(true);
    try {
      const [p, wo] = await Promise.all([
        ownerProdApi.getPlan(Number(id)),
        ownerProdApi.listPlanWorkOrders(Number(id)),
      ]);
      setPlan(p);
      setOrders(wo || []);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]); // eslint-disable-line

  if (loading && !plan) return <div className="p-8"><CardSkeleton lines={8} /></div>;
  if (!plan) return <div className="p-8 text-[#8E8878]">{t('production', 'plandt_not_found')}</div>;

  const pct       = Number(plan.progressPct || 0);
  const color     = progressColor(pct);

  // ── Derived stats ────────────────────────────────────────────────────────
  const activeOrders    = orders.filter(o => o.status !== 'CANCELLED');
  const completedOrders = orders.filter(o => o.status === 'COMPLETED');
  const inProgressOrders= orders.filter(o => o.status === 'IN_PROGRESS');
  const pendingOrders   = orders.filter(o => ['PENDING_PLAN','PLANNED','SCHEDULED'].includes(o.status));

  // Tổng sản lượng thực tế = tất cả lệnh (kể cả đang SX và đã hủy đã làm được)
  const totalActual  = orders.reduce((s, o) => s + Number(o.accumulatedQty || 0), 0);

  // ── Chart data ───────────────────────────────────────────────────────────

  // Bar: sản lượng kế hoạch vs thực tế mỗi lệnh
  // accumulatedQty = tổng sản lượng thực tế đã sản xuất (cập nhật real-time sau mỗi mẻ hoàn thành)
  const qtyBarData = orders.map(o => ({
    name: o.workOrderCode || `WO${o.id}`,
    [LBL_PLANNED]: Number(o.plannedQty || 0),
    [LBL_ACTUAL]:  Number(o.accumulatedQty || 0),
    status: o.status,
  }));

  // Area: timeline tiến độ (sort by scheduledStartDate)
  const sorted = [...orders].sort((a,b) => (a.scheduledStartDate||0) - (b.scheduledStartDate||0));
  let cumActual = 0, cumPlanned = 0;
  const timelineData = sorted.map(o => {
    cumActual  += Number(o.accumulatedQty || 0);
    // Kế hoạch: completed dùng actual, còn lại dùng planned
    cumPlanned += o.status === 'COMPLETED' ? Number(o.accumulatedQty || 0) : Number(o.plannedQty || 0);
    return {
      name: o.workOrderCode,
      [LBL_ACTUAL]:  Math.round(cumActual * 10) / 10,
      [LBL_PLANNED]: Math.round(cumPlanned * 10) / 10,
    };
  });
  if (timelineData.length > 0) {
    timelineData.unshift({ name: t('production', 'plandt_chart_start'), [LBL_ACTUAL]: 0, [LBL_PLANNED]: 0 });
  }

  const canCancel = plan.status === 'ACTIVE';

  const planInfo = [
    { label: t('production', 'plandt_info_code'),    value: plan.planCode },
    { label: t('production', 'mps_field_product'),   value: `${plan.productName} (${plan.outputUnit})` },
    { label: t('production', 'mps_target'),          value: `${fmtNum(plan.targetQty)} ${plan.outputUnit}` },
    { label: t('production', 'plandt_info_start'),   value: fmtDate(plan.startDate) },
    { label: t('production', 'plandt_info_end'),     value: fmtDate(plan.endDate) },
    { label: t('production', 'plandt_info_creator'), value: plan.createdByName || '—' },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(basePath)}
          className="p-2 rounded-xl hover:bg-[#FAF7F2] text-[#8E8878] hover:text-[#1C1C1E] transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-[#1C1C1E] font-mono">{plan.planCode}</h1>
            <StatusBadge status={plan.status} />
          </div>
          <p className="text-sm text-[#8E8878] mt-0.5">{plan.title}</p>
        </div>
        <div className="flex gap-2">
          {canCancel && !isSuperFactoryWorker && (
            <DangerButton loading={acting} onClick={async () => {
              if (!confirm(t('production', 'plandt_confirm_cancel'))) return;
              setActing(true);
              try { await ownerProdApi.updatePlanStatus(plan.id, 'CANCELLED'); await load(); }
              finally { setActing(false); }
            }}>{t('production', 'plandt_cancel_plan')}</DangerButton>
          )}
        </div>
      </div>

      {/* ── KPI cards — chỉ hiện cho Owner ── */}
      {!isSuperFactoryWorker && (
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Progress ring */}
        <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-5 flex items-center gap-4">
          <div className="relative flex-shrink-0">
            <ProgressRing pct={pct} size={80} />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-sm font-bold ${color.text}`}>{pct.toFixed(0)}%</span>
            </div>
          </div>
          <div>
            <p className="text-xs text-[#8E8878]">{t('production', 'plandt_progress')}</p>
            <p className="text-lg font-bold text-[#1C1C1E]">{fmtNum(totalActual)}</p>
            <p className="text-xs text-[#8E8878]">/ {fmtNum(plan.targetQty)} {plan.outputUnit}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-5">
          <p className="text-xs text-[#8E8878]">{t('production', 'plandt_work_orders')}</p>
          <p className="text-3xl font-bold text-[#1C1C1E] mt-1">{activeOrders.length}</p>
          <div className="flex gap-3 mt-1 text-xs">
            {completedOrders.length > 0 && (
              <span className="text-emerald-600">✓ {t('production', 'plandt_done_n', { n: completedOrders.length })}</span>
            )}
            {inProgressOrders.length > 0 && (
              <span className="text-orange-500">⚡ {t('production', 'plandt_running_n', { n: inProgressOrders.length })}</span>
            )}
            {pendingOrders.length > 0 && (
              <span className="text-[#8E8878]">{t('production', 'plandt_waiting_n', { n: pendingOrders.length })}</span>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-5">
          <p className="text-xs text-[#8E8878]">{t('common', 'time')}</p>
          <p className="text-sm font-semibold text-[#1C1C1E] mt-1">{fmtDate(plan.startDate)}</p>
          <p className="text-xs text-[#8E8878]">→ {fmtDate(plan.endDate)}</p>
          {Date.now() > Number(plan.endDate) && plan.status !== 'COMPLETED' && (
            <p className="text-[10px] text-red-500 mt-1 font-medium">⚠ {t('production', 'mps_overdue')}</p>
          )}
        </div>
      </div>
      )}

      {/* ── Charts row — chỉ hiện cho Owner ── */}
      {!isSuperFactoryWorker && (
      <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">

        {/* Area chart: tích luỹ theo thời gian */}
        <div className="lg:col-span-2">
          <SectionCard>
            <SectionHeader title={t('production', 'plandt_chart_progress')} />
            <div className="p-4">
              {timelineData.length > 1 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={timelineData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="gradActual" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradPlan" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#C9A84C" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#C9A84C" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe3" />
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#8E8878' }} tickLine={false}
                      tickFormatter={v => v?.replace('WO-20260610-', '#')?.replace('WO-', '#') || v} />
                    <YAxis tick={{ fontSize: 10, fill: '#8E8878' }} tickLine={false} axisLine={false}
                      tickFormatter={v => fmtNum(v)} />
                    <Tooltip content={<ChartTooltip unit={` ${plan.outputUnit}`} />} />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                    <Area type="monotone" dataKey={LBL_PLANNED} stroke="#C9A84C"
                      strokeWidth={2} fill="url(#gradPlan)" strokeDasharray="4 2" dot={false} />
                    <Area type="monotone" dataKey={LBL_ACTUAL} stroke="#10b981"
                      strokeWidth={2.5} fill="url(#gradActual)" dot={{ r: 4, fill: '#10b981' }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[220px] text-[#8E8878] text-sm">
                  {t('production', 'plandt_no_wo_data')}
                </div>
              )}
            </div>
          </SectionCard>
        </div>
      </div>
      )}

      {/* Bar chart: sản lượng từng lệnh — chỉ hiện cho Owner */}
      {!isSuperFactoryWorker && qtyBarData.length > 0 && (
        <SectionCard>
          <SectionHeader title={`${t('production', 'plandt_chart_per_wo')} (${plan.outputUnit})`} />
          <div className="p-4">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={qtyBarData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#8E8878' }} tickLine={false}
                  tickFormatter={v => v?.replace('WO-20260610-', '#')?.replace('WO-', '#') || v} />
                <YAxis tick={{ fontSize: 10, fill: '#8E8878' }} tickLine={false} axisLine={false}
                  tickFormatter={v => fmtNum(v)} />
                <Tooltip content={<ChartTooltip unit={` ${plan.outputUnit}`} />} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                <Bar dataKey={LBL_PLANNED} fill="#C9A84C" opacity={0.5} radius={[3,3,0,0]} />
                <Bar dataKey={LBL_ACTUAL} fill="#10b981" radius={[3,3,0,0]}
                  label={{ position: 'top', fontSize: 9, fill: '#8E8878',
                    formatter: v => v > 0 ? fmtNum(v) : '' }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      )}

      {/* ── Work orders table ── */}
      <SectionCard>
        <SectionHeader title={`${t('production', 'plandt_work_orders')} (${orders.length})`} />
        <div className="divide-y divide-black/5">
          {orders.length === 0 ? (
            <p className="text-sm text-[#8E8878] italic text-center py-10">{t('production', 'plandt_no_wo')}</p>
          ) : (
            orders.map(o => {
              const oPct  = Number(o.progressPct || 0);
              const oColor = o.status === 'CANCELLED' ? { hex: '#9ca3af' } : progressColor(oPct);
              const isActive = o.status === 'IN_PROGRESS';
              return (
                <button key={o.id}
                  onClick={() => navigate(`${woBasePath}/${o.id}`)}
                  className="w-full px-5 py-4 flex items-center gap-4 hover:bg-[#FAF7F2] transition-colors text-left group">
                  {/* Status dot */}
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isActive ? 'animate-pulse' : ''}`}
                    style={{ backgroundColor: WO_STATUS_COLOR[o.status] || '#9ca3af' }} />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-mono font-semibold text-[#1C1C1E]">{o.workOrderCode}</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: (WO_STATUS_COLOR[o.status] || '#9ca3af') + '20',
                                 color: WO_STATUS_COLOR[o.status] || '#9ca3af' }}>
                        {WO_STATUS_LABEL[o.status] || o.status}
                      </span>
                      {o.productionFactoryName && (
                        <span className="text-[10px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Factory size={10} /> {o.productionFactoryName}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#8E8878] mt-0.5">
                      {fmtDate(o.scheduledStartDate)} → {fmtDate(o.plannedEndDate)}
                    </p>
                  </div>

                  {/* Progress bar */}
                  <div className="w-36 hidden sm:block">
                    {o.packagingLoss ? (
                      (() => {
                        const loss = o.packagingLoss;
                        const lossPct = Number(loss.lossPct || 0);
                        const displayLossPct = loss.lossQty > 0 ? Math.max(1, Math.round(lossPct)) : 0;
                        const keepPct = 100 - displayLossPct;
                        return (
                          <>
                            <div className="flex justify-between mb-1 text-[10px]">
                              <span className="text-[#8E8878]">{fmtNum(loss.totalActualReceivedWeight)} / {fmtNum(loss.totalActualOutputQty)} {o.outputUnit}</span>
                              <span className={`font-bold ${loss.lossQty > 0 ? 'text-red-500' : 'text-emerald-600'}`}>{keepPct}%</span>
                            </div>
                            <div className="h-1.5 bg-black/5 rounded-full overflow-hidden flex">
                              <div className="h-full bg-emerald-500" style={{ width: `${keepPct}%` }} />
                              {displayLossPct > 0 && <div className="h-full bg-red-500" style={{ width: `${displayLossPct}%` }} />}
                            </div>
                            {loss.lossQty > 0 && (
                              <p className="text-[10px] text-red-500 font-medium mt-1">
                                {t('production', 'plandt_loss', {
                                  qty: fmtNum(loss.lossQty), unit: o.outputUnit, pct: lossPct.toFixed(2),
                                })}
                              </p>
                            )}
                          </>
                        );
                      })()
                    ) : (
                      <>
                        <div className="flex justify-between mb-1 text-[10px]">
                          <span className="text-[#8E8878]">{fmtNum(o.accumulatedQty)} / {fmtNum(o.plannedQty)} {o.outputUnit}</span>
                          <span className="font-bold" style={{ color: oColor.hex }}>{oPct.toFixed(0)}%</span>
                        </div>
                        <div className="h-1.5 bg-black/5 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all${isActive ? ' animate-pulse' : ''}`}
                            style={{ width: `${Math.min(oPct,100)}%`, backgroundColor: oColor.hex }} />
                        </div>
                      </>
                    )}
                  </div>

                  <ArrowLeft size={14} className="text-[#8E8878] rotate-180 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                </button>
              );
            })
          )}
        </div>
      </SectionCard>

      {/* ── Plan info ── */}
      <SectionCard>
        <SectionHeader title={t('production', 'plandt_info_title')} />
        <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          {planInfo.map(s => (
            <div key={s.label}>
              <p className="text-xs text-[#8E8878] mb-0.5">{s.label}</p>
              <p className="font-semibold text-[#1C1C1E]">{s.value}</p>
            </div>
          ))}
          {plan.notes && (
            <div className="col-span-full">
              <p className="text-xs text-[#8E8878] mb-0.5">{t('common', 'note')}</p>
              <p className="text-[#1C1C1E] italic">{plan.notes}</p>
            </div>
          )}
        </div>
      </SectionCard>

    </div>
  );
}
