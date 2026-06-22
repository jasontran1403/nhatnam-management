// src/pages/factory_worker/FactoryMachineMetricsPage.jsx
// Trang quản lý metric máy: thời gian mua, hoạt động sản xuất, downtime, chi phí bảo trì,
// chart sản xuất/bảo trì theo tháng, và lịch sử bảo trì/bảo dưỡng đầy đủ.
import { useState, useEffect } from 'react';
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
import { ownerProdApi, factoryProdApi, fmtDate, fmtCurrency } from '../../api/productionModuleApi';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
const imgUrl = p => p?.startsWith('http') ? p : BASE_URL + '/api/auth' + p;

const MAINT_STATUS_CFG = {
  PLANNED:     { label: 'Đã lên lịch',     cls: 'bg-blue-100 text-blue-700' },
  IN_PROGRESS: { label: 'Đang thực hiện',  cls: 'bg-orange-100 text-orange-700' },
  COMPLETED:   { label: 'Hoàn thành',      cls: 'bg-emerald-100 text-emerald-700' },
  ADJUSTED:    { label: 'Điều chỉnh',      cls: 'bg-purple-100 text-purple-700' },
  MISSED:      { label: 'Bỏ lỡ',           cls: 'bg-gray-100 text-gray-600' },
};

function fmtHours(v) {
  const n = Number(v || 0);
  return `${n.toLocaleString('vi-VN')} giờ`;
}

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
  const cfg = MAINT_STATUS_CFG[item.status] || { label: item.status, cls: 'bg-gray-100 text-gray-600' };
  return (
    <Modal open title={item.title} onClose={onClose} size="lg" footer={<SecondaryButton onClick={onClose}>Đóng</SecondaryButton>}>
      <div className="space-y-5">
        <div className="flex gap-3 flex-wrap">
          <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${item.maintenanceType === 'CORRECTIVE' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
            {item.maintenanceType === 'CORRECTIVE' ? '🚨 Sự cố phát sinh' : '🔧 Bảo trì định kỳ'}
          </span>
          <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${cfg.cls}`}>{cfg.label}</span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          {[
            { label: 'Bắt đầu kế hoạch', value: fmtDate(item.plannedStart) },
            { label: 'Kết thúc dự kiến', value: fmtDate(item.plannedEnd) },
            { label: 'Bắt đầu thực tế', value: item.actualStart ? fmtDate(item.actualStart) : '—' },
            { label: 'Hoàn tất thực tế', value: item.actualEnd ? fmtDate(item.actualEnd) : (item.status === 'COMPLETED' ? '—' : 'Chưa xử lý xong (dùng thời gian dự kiến)') },
            { label: 'Giờ downtime', value: item.actualDowntimeHours ? `${item.actualDowntimeHours}h (thực tế)` : `${item.plannedDowntimeHours || 0}h (dự kiến)` },
            { label: 'Chi phí', value: item.actualCost ? fmtCurrency(item.actualCost) : item.estimatedCost ? `~${fmtCurrency(item.estimatedCost)} (dự kiến)` : '—' },
            { label: 'Nhà cung cấp', value: item.vendorName || '—' },
            { label: 'Người liên hệ', value: item.vendorContactPerson || '—' },
            { label: 'SĐT liên hệ', value: item.vendorPhone || '—' },
          ].map(s => (
            <div key={s.label} className="bg-[#FAF7F2] rounded-xl p-3">
              <p className="text-xs text-[#8E8878] mb-0.5">{s.label}</p>
              <p className="font-semibold text-[#1C1C1E]">{s.value}</p>
            </div>
          ))}
        </div>

        {item.description && (
          <div className="bg-[#FAF7F2] rounded-xl p-3">
            <p className="text-xs text-[#8E8878] mb-1">Mô tả hư hỏng / nội dung</p>
            <p className="text-sm">{item.description}</p>
          </div>
        )}
        {item.completionNotes && (
          <div className="bg-[#FAF7F2] rounded-xl p-3">
            <p className="text-xs text-[#8E8878] mb-1">Ghi chú hoàn thành</p>
            <p className="text-sm">{item.completionNotes}</p>
          </div>
        )}

        {[['Ảnh trước bảo trì/sửa chữa', item.beforeImages], ['Ảnh sau bảo trì/sửa chữa', item.afterImages], ['Chứng từ / hoá đơn', item.receiptImages]]
          .map(([label, imgs]) => imgs?.length > 0 && (
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
  const cfg = MAINT_STATUS_CFG[item.status] || { label: item.status, cls: 'bg-gray-100 text-gray-600' };
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
          {fmtDate(item.plannedStart)} → {isOngoing ? `${fmtDate(item.plannedEnd)} (dự kiến)` : fmtDate(item.actualEnd || item.plannedEnd)}
          {item.vendorName && <> · {item.vendorName}</>}
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-sm font-bold text-[#1C1C1E]">
          {item.actualCost ? fmtCurrency(item.actualCost) : item.estimatedCost ? `~${fmtCurrency(item.estimatedCost)}` : '—'}
        </p>
        <p className="text-[10px] text-[#8E8878]">{item.status === 'COMPLETED' ? 'Đã hoàn tất' : 'Dự kiến'}</p>
      </div>
    </button>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function FactoryMachineMetricsPage() {
  // Trang chỉ được vào từ Owner: /owner/production/machines/:id/metrics
  const { id: machineId } = useParams();
  const navigate = useNavigate();
  const [machines, setMachines] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loadingMachines, setLoadingMachines] = useMinLoading(true);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [openMaint, setOpenMaint] = useState(null);
  const [err, setErr] = useState('');

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
        setErr(e?.response?.data?.message || e.message || 'Không tải được dữ liệu metric máy');
        setMetrics(null);
      } finally { setLoadingMetrics(false); }
    })();
  }, [machineId]);

  const chartData = (metrics?.monthlyChart || []).map(p => ({
    month: fmtMonthLabel(p.month),
    'Sản xuất (giờ)': Number(p.productionHours || 0),
    'Bảo trì/Hư hỏng (giờ)': Number(p.maintenanceHours || 0),
  }));

  return (
    <div className="p-4 sm:p-6 space-y-4 bg-[#F5F0EB] min-h-full">
      <div className="bg-[#1A2B1A] rounded-2xl p-5 text-white">
        <button onClick={() => navigate('/owner/production?tab=machines')}
          className="flex items-center gap-1.5 text-xs text-white/60 hover:text-white transition-colors mb-2">
          <ArrowLeft size={14} />
        </button>
        <h1 className="text-xl font-bold mt-0.5">Quản lý {machines.find(m => String(m.id) === String(machineId))?.name || `Máy #${machineId}`}</h1>
        <p className="text-white/60 text-xs mt-1">Theo dõi thời gian hoạt động, hư hỏng/bảo trì và chi phí bảo dưỡng của {machines.find(m => String(m.id) === String(machineId))?.name || `Máy #${machineId}`}</p>
      </div>

      {err && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{err}</p>}

      {loadingMetrics ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{[...Array(4)].map((_, i) => <CardSkeleton key={i} lines={2} />)}</div>
          <ChartSkeleton />
        </>
      ) : !metrics ? (
        machines.length > 0 && (
          <EmptyState icon={Activity} title="Chưa có dữ liệu" description="Chọn 1 máy để xem metric chi tiết" />
        )
      ) : (
        <>
          {/* Metric overview cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetricCard icon={Calendar} label="Thời gian mua máy" value={fmtDate(metrics.purchaseDate)} color="#6366F1" />
            <MetricCard icon={Activity} label="Hoạt động SX gần nhất" value={metrics.lastProductionAt ? fmtDate(metrics.lastProductionAt) : 'Chưa hoạt động'}
              sub={metrics.firstProductionAt ? `Từ ${fmtDate(metrics.firstProductionAt)}` : null} color="#10B981" />
            <MetricCard icon={Wrench} label="Tổng giờ SX" value={fmtHours(metrics.totalProductionHours)} color="#F59E0B" />
            <MetricCard icon={AlertTriangle} label="Tổng giờ hư hỏng/bảo trì" value={fmtHours(metrics.totalMaintenanceHours)} color="#EF4444" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetricCard icon={DollarSign} label="Tổng chi phí bảo trì đã hoàn tất" value={fmtCurrency(metrics.totalCompletedMaintenanceCost)} color="#C9A84C" />
            <MetricCard icon={TrendingUp} label="Lần bảo trì đã hoàn tất" value={metrics.completedMaintenanceCount} color="#0EA5E9" />
            <MetricCard icon={Wrench} label="Đang xử lý / chờ xử lý" value={metrics.activeMaintenanceCount} color="#A855F7" />
            <MetricCard icon={Settings2} label="Trạng thái máy" value={metrics.status === 'ACTIVE' ? 'Hoạt động' : metrics.status === 'UNDER_MAINTENANCE' ? 'Đang bảo trì' : 'Không hoạt động'}
              color={metrics.status === 'ACTIVE' ? '#10B981' : metrics.status === 'UNDER_MAINTENANCE' ? '#EF4444' : '#9CA3AF'} />
          </div>

          {/* Chart: Sản xuất vs Bảo trì theo tháng */}
          <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-4 sm:p-5">
            <p className="text-sm font-semibold text-[#1C1C1E] mb-1">Thời gian sản xuất / hư hỏng bảo trì theo tháng</p>
            <p className="text-xs text-[#8E8878] mb-4">Tổng số giờ máy hoạt động sản xuất so với số giờ hư hỏng/bảo trì mỗi tháng</p>
            {chartData.length === 0 ? (
              <p className="text-sm text-[#8E8878] italic text-center py-10">Chưa có dữ liệu lịch sử để vẽ biểu đồ</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#00000010" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Sản xuất (giờ)" fill="#10B981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Bảo trì/Hư hỏng (giờ)" fill="#EF4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Lịch sử bảo trì */}
          <div>
            <p className="text-sm font-semibold text-[#1C1C1E] mb-2 flex items-center gap-1.5">
              <FileText size={14} /> Lịch sử bảo trì / bảo dưỡng ({metrics.maintenanceHistory?.length || 0})
            </p>
            {(!metrics.maintenanceHistory || metrics.maintenanceHistory.length === 0) ? (
              <EmptyState icon={Wrench} title="Chưa có lịch sử bảo trì" description="Máy này chưa từng được lập phiếu bảo trì/bảo dưỡng" />
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