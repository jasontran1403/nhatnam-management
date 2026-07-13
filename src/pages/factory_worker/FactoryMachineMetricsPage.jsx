// src/pages/factory_worker/FactoryMachineMetricsPage.jsx
// Trang quản lý metric máy: thời gian mua, hoạt động sản xuất, downtime, chi phí bảo trì,
// chart sản xuất/bảo trì theo tháng, và lịch sử bảo trì/bảo dưỡng đầy đủ.
import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Activity, Wrench, Calendar, DollarSign, Settings2,
  TrendingUp, AlertTriangle, FileText, ArrowLeft,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import useMinLoading from '../../hooks/useMinLoading';
import { CardSkeleton, ChartSkeleton } from '../../components/ui/Skeleton';
import Modal from '../../components/ui/Modal';
import { SecondaryButton, EmptyState } from '../../components/ui';
import { ownerProdApi, factoryProdApi } from '../../api/productionModuleApi';
import { useLang } from '../../context/LangContext';
import { useFmt } from '../../utils/useFmt';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
const imgUrl = p => p?.startsWith('http') ? p : BASE_URL + '/api/auth' + p;

const getMaintStatusCfg = (t) => ({
  PLANNED:     { label: t('production', 'maint_status_planned'),     cls: 'bg-blue-100 text-blue-700' },
  IN_PROGRESS: { label: t('production', 'maint_status_in_progress'), cls: 'bg-orange-100 text-orange-700' },
  COMPLETED:   { label: t('production', 'maint_status_completed'),   cls: 'bg-emerald-100 text-emerald-700' },
  ADJUSTED:    { label: t('production', 'maint_status_adjusted'),    cls: 'bg-purple-100 text-purple-700' },
  MISSED:      { label: t('production', 'maint_status_missed'),      cls: 'bg-gray-100 text-gray-600' },
});

function fmtMonthLabel(monthKey) {
  // "2026-01" -> "01/2026"
  if (!monthKey) return '';
  const [y, m] = monthKey.split('-');
  return `${m}/${y}`;
}

// ── Metric overview card ──────────────────────────────────────────────────────
function MetricCard({ icon: Icon, label, value, sub, color = '#C9A84C' }) {
  return (
    <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-4 flex items-start gap-3">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${color}1A` }}>
        <Icon size={18} style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-[#8E8878] uppercase tracking-wide font-medium">{label}</p>
        <p className="text-lg font-bold text-[#1C1C1E] mt-0.5 truncate">{value}</p>
        {sub && <p className="text-[11px] text-[#8E8878] mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Maintenance detail modal ─────────────────────────────────────────────────
function MaintenanceDetailModal({ item, onClose }) {
  const { t } = useLang();
  const { fmtDate, fmtCurrency } = useFmt();
  const cfg = getMaintStatusCfg(t)[item.status] || { label: item.status, cls: 'bg-gray-100 text-gray-600' };
  return (
    <Modal open title={item.title} onClose={onClose} size="lg"
      footer={<SecondaryButton onClick={onClose}>{t('common', 'close')}</SecondaryButton>}>
      <div className="space-y-5">
        <div className="flex gap-3 flex-wrap">
          <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${item.maintenanceType === 'CORRECTIVE' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
            {item.maintenanceType === 'CORRECTIVE'
              ? `🚨 ${t('production', 'metrics_type_corrective')}`
              : `🔧 ${t('production', 'metrics_type_preventive')}`}
          </span>
          <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${cfg.cls}`}>{cfg.label}</span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          {[
            { label: t('production', 'metrics_planned_start'), value: fmtDate(item.plannedStart) },
            { label: t('production', 'metrics_planned_end'),   value: fmtDate(item.plannedEnd) },
            { label: t('production', 'metrics_actual_start'),  value: item.actualStart ? fmtDate(item.actualStart) : '—' },
            {
              label: t('production', 'metrics_actual_end'),
              value: item.actualEnd
                ? fmtDate(item.actualEnd)
                : (item.status === 'COMPLETED' ? '—' : t('production', 'metrics_not_finished')),
            },
            {
              label: t('production', 'metrics_downtime_hours'),
              value: item.actualDowntimeHours
                ? t('production', 'metrics_hours_actual', { n: item.actualDowntimeHours })
                : t('production', 'metrics_hours_planned', { n: item.plannedDowntimeHours || 0 }),
            },
            {
              label: t('production', 'metrics_cost'),
              value: item.actualCost
                ? fmtCurrency(item.actualCost)
                : item.estimatedCost
                  ? t('production', 'metrics_cost_estimated', { value: fmtCurrency(item.estimatedCost) })
                  : '—',
            },
            { label: t('production', 'metrics_vendor'),         value: item.vendorName || '—' },
            { label: t('production', 'metrics_contact_person'), value: item.vendorContactPerson || '—' },
            { label: t('production', 'metrics_contact_phone'),  value: item.vendorPhone || '—' },
          ].map(s => (
            <div key={s.label} className="bg-[#FAF7F2] rounded-xl p-3">
              <p className="text-xs text-[#8E8878] mb-0.5">{s.label}</p>
              <p className="font-semibold text-[#1C1C1E]">{s.value}</p>
            </div>
          ))}
        </div>

        {item.description && (
          <div className="bg-[#FAF7F2] rounded-xl p-3">
            <p className="text-xs text-[#8E8878] mb-1">{t('production', 'metrics_description')}</p>
            <p className="text-sm">{item.description}</p>
          </div>
        )}
        {item.completionNotes && (
          <div className="bg-[#FAF7F2] rounded-xl p-3">
            <p className="text-xs text-[#8E8878] mb-1">{t('production', 'metrics_completion_notes')}</p>
            <p className="text-sm">{item.completionNotes}</p>
          </div>
        )}

        {[
          [t('production', 'metrics_before_images'),  item.beforeImages],
          [t('production', 'metrics_after_images'),   item.afterImages],
          [t('production', 'metrics_receipt_images'), item.receiptImages],
        ].map(([label, imgs]) => imgs?.length > 0 && (
          <div key={label}>
            <p className="text-xs font-semibold text-[#8E8878] uppercase tracking-wider mb-2">{label}</p>
            <div className="flex gap-2 flex-wrap">
              {imgs.map((url, i) => (
                <a key={i} href={imgUrl(url)} target="_blank" rel="noreferrer">
                  <img src={imgUrl(url)} alt="" className="w-24 h-24 object-cover rounded-xl border border-black/10 hover:scale-105 transition-transform" />
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

// ── Maintenance history row ───────────────────────────────────────────────────
function MaintenanceRow({ item, onOpen }) {
  const { t } = useLang();
  const { fmtDate, fmtCurrency } = useFmt();
  const cfg = getMaintStatusCfg(t)[item.status] || { label: item.status, cls: 'bg-gray-100 text-gray-600' };
  const isOngoing = item.status === 'PLANNED' || item.status === 'IN_PROGRESS' || item.status === 'ADJUSTED';
  return (
    <button onClick={onOpen}
      className="w-full text-left bg-white rounded-xl border border-black/5 hover:border-[#C9A84C]/40 hover:shadow-sm transition-all p-3 sm:p-4 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${item.maintenanceType === 'CORRECTIVE' ? 'bg-red-50' : 'bg-blue-50'}`}>
        {item.maintenanceType === 'CORRECTIVE'
          ? <AlertTriangle size={16} className="text-red-500" />
          : <Wrench size={16} className="text-blue-500" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-sm text-[#1C1C1E] truncate">{item.title}</p>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.cls}`}>{cfg.label}</span>
        </div>
        <p className="text-xs text-[#8E8878] mt-0.5">
          {fmtDate(item.plannedStart)} → {isOngoing
            ? t('production', 'metrics_date_planned', { date: fmtDate(item.plannedEnd) })
            : fmtDate(item.actualEnd || item.plannedEnd)}
          {item.vendorName && <> · {item.vendorName}</>}
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-sm font-bold text-[#1C1C1E]">
          {item.actualCost ? fmtCurrency(item.actualCost) : item.estimatedCost ? `~${fmtCurrency(item.estimatedCost)}` : '—'}
        </p>
        <p className="text-[10px] text-[#8E8878]">
          {item.status === 'COMPLETED' ? t('production', 'metrics_done') : t('production', 'metrics_expected')}
        </p>
      </div>
    </button>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function FactoryMachineMetricsPage() {
  // Trang chỉ được vào từ Owner: /owner/production/machines/:id/metrics
  const { id: machineId } = useParams();
  const navigate = useNavigate();
  const { t } = useLang();
  const { fmtDate, fmtNum, fmtCurrency } = useFmt();
  const [machines, setMachines] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loadingMachines, setLoadingMachines] = useMinLoading(true);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [openMaint, setOpenMaint] = useState(null);
  const [err, setErr] = useState('');

  const fmtHours = (v) => t('production', 'metrics_hours', { n: fmtNum(v) });

  useEffect(() => {
    (async () => {
      setLoadingMachines(true);
      try {
        const m = await ownerProdApi.listMachines(false);
        setMachines(m || []);
      } finally { setLoadingMachines(false); }
    })();
  }, []);

  useEffect(() => {
    if (!machineId) return;
    (async () => {
      setLoadingMetrics(true);
      setErr('');
      try {
        const data = await factoryProdApi.getMachineMetrics(machineId);
        setMetrics(data);
      } catch (e) {
        setErr(e?.response?.data?.message || e.message || t('production', 'metrics_load_failed'));
        setMetrics(null);
      } finally { setLoadingMetrics(false); }
    })();
  }, [machineId]); // eslint-disable-line

  const machineName = machines.find(m => String(m.id) === String(machineId))?.name
    || t('production', 'metrics_machine_fallback', { id: machineId });

  const labelProduction  = t('production', 'metrics_chart_production');
  const labelMaintenance = t('production', 'metrics_chart_maintenance');

  const chartData = useMemo(() => (metrics?.monthlyChart || []).map(p => ({
    month: fmtMonthLabel(p.month),
    [labelProduction]:  Number(p.productionHours || 0),
    [labelMaintenance]: Number(p.maintenanceHours || 0),
  })), [metrics, labelProduction, labelMaintenance]);

  const machineStatusLabel = metrics?.status === 'ACTIVE'
    ? t('production', 'machine_status_active')
    : metrics?.status === 'UNDER_MAINTENANCE'
      ? t('production', 'machine_status_maintenance')
      : t('production', 'machine_status_inactive');

  return (
    <div className="p-4 sm:p-6 space-y-4 bg-[#F5F0EB] min-h-full">
      <div className="bg-[#1A2B1A] rounded-2xl p-5 text-white">
        <button onClick={() => navigate('/owner/production?tab=machines')}
          className="flex items-center gap-1.5 text-xs text-white/60 hover:text-white transition-colors mb-2">
          <ArrowLeft size={14} />
        </button>
        <h1 className="text-xl font-bold mt-0.5">
          {t('production', 'metrics_title', { name: machineName })}
        </h1>
        <p className="text-white/60 text-xs mt-1">
          {t('production', 'metrics_subtitle', { name: machineName })}
        </p>
      </div>

      {err && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{err}</p>}

      {loadingMetrics ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{[...Array(4)].map((_, i) => <CardSkeleton key={i} lines={2} />)}</div>
          <ChartSkeleton />
        </>
      ) : !metrics ? (
        machines.length > 0 && (
          <EmptyState icon={Activity}
            title={t('production', 'metrics_empty_title')}
            description={t('production', 'metrics_empty_desc')} />
        )
      ) : (
        <>
          {/* Metric overview cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetricCard icon={Calendar} label={t('production', 'metrics_purchase_date')} value={fmtDate(metrics.purchaseDate)} color="#6366F1" />
            <MetricCard icon={Activity} label={t('production', 'metrics_last_production')}
              value={metrics.lastProductionAt ? fmtDate(metrics.lastProductionAt) : t('production', 'metrics_never_run')}
              sub={metrics.firstProductionAt ? t('production', 'metrics_since', { date: fmtDate(metrics.firstProductionAt) }) : null}
              color="#10B981" />
            <MetricCard icon={Wrench} label={t('production', 'metrics_total_production_hours')} value={fmtHours(metrics.totalProductionHours)} color="#F59E0B" />
            <MetricCard icon={AlertTriangle} label={t('production', 'metrics_total_maintenance_hours')} value={fmtHours(metrics.totalMaintenanceHours)} color="#EF4444" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetricCard icon={DollarSign} label={t('production', 'metrics_total_completed_cost')} value={fmtCurrency(metrics.totalCompletedMaintenanceCost)} color="#C9A84C" />
            <MetricCard icon={TrendingUp} label={t('production', 'metrics_completed_count')} value={metrics.completedMaintenanceCount} color="#0EA5E9" />
            <MetricCard icon={Wrench} label={t('production', 'metrics_active_count')} value={metrics.activeMaintenanceCount} color="#A855F7" />
            <MetricCard icon={Settings2} label={t('production', 'metrics_machine_status')} value={machineStatusLabel}
              color={metrics.status === 'ACTIVE' ? '#10B981' : metrics.status === 'UNDER_MAINTENANCE' ? '#EF4444' : '#9CA3AF'} />
          </div>

          {/* Chart: Sản xuất vs Bảo trì theo tháng */}
          <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-4 sm:p-5">
            <p className="text-sm font-semibold text-[#1C1C1E] mb-1">{t('production', 'metrics_chart_title')}</p>
            <p className="text-xs text-[#8E8878] mb-4">{t('production', 'metrics_chart_desc')}</p>
            {chartData.length === 0 ? (
              <p className="text-sm text-[#8E8878] italic text-center py-10">{t('production', 'metrics_chart_empty')}</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#00000010" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey={labelProduction} fill="#10B981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey={labelMaintenance} fill="#EF4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Lịch sử bảo trì */}
          <div>
            <p className="text-sm font-semibold text-[#1C1C1E] mb-2 flex items-center gap-1.5">
              <FileText size={14} /> {t('production', 'metrics_history_title')} ({metrics.maintenanceHistory?.length || 0})
            </p>
            {(!metrics.maintenanceHistory || metrics.maintenanceHistory.length === 0) ? (
              <EmptyState icon={Wrench}
                title={t('production', 'metrics_history_empty_title')}
                description={t('production', 'metrics_history_empty_desc')} />
            ) : (
              <div className="space-y-2">
                {metrics.maintenanceHistory.map(item => (
                  <MaintenanceRow key={item.id} item={item} onOpen={() => setOpenMaint(item)} />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {openMaint && <MaintenanceDetailModal item={openMaint} onClose={() => setOpenMaint(null)} />}
    </div>
  );
}
