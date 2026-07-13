// src/pages/super_factory_worker/SuperFactoryWorkerDashboard.jsx
// Dashboard cho SUPER_FACTORY_WORKER — giống OwnerProductionDashboard nhưng:
// - KHÔNG hiển thị các KPI card (Kế hoạch đang chạy, Tổng lệnh SX, Đang sản xuất,
//   Chờ phương án, Hoàn thành, Máy hoạt động)
// - KHÔNG có nút "Kế hoạch mới" — kế hoạch chỉ do OWNER tạo, ở đây chỉ render khi có
// - Click vào kế hoạch / lệnh sản xuất → vẫn xem chi tiết, nhưng trang chi tiết sẽ tự
//   ẩn phần metric (xử lý trong OwnerPlanDetailPage / OwnerWorkOrderDetailPage theo role)
// - Click vào máy KHÔNG chuyển qua trang Metric của máy (không truyền onMachineClick)
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Factory, Plus, ClipboardList, Settings2,
} from 'lucide-react';
import useMinLoading from '../../hooks/useMinLoading';
import {
  PageHeader, SectionCard, SectionHeader, PrimaryButton,
} from '../../components/ui';
import { StatCardSkeleton } from '../../components/ui/Skeleton';
import { ownerProdApi, factoryProdApi } from '../../api/productionModuleApi';
import { useLang } from '../../context/LangContext';
import { factoryProductApi } from '../../api/productionApi';
import {
  ProductionGantt, MaintenanceGantt, MaintenanceDetailModal, AddMachineModal, CreateWorkOrderModal,
} from '../owner/OwnerProductionDashboard';

export default function SuperFactoryWorkerDashboard() {
  const { t } = useLang();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [dashboard, setDashboard] = useState(null);
  const [plans, setPlans] = useState([]);
  const [products, setProducts] = useState([]);
  const [factories, setFactories] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [occupancy, setOccupancy] = useState([]);
  const [loading, setLoading] = useMinLoading(true);
  const [showAddMachine, setShowAddMachine] = useState(false);
  const [showCreateWorkOrder, setShowCreateWorkOrder] = useState(false);
  const [selectedMaint, setSelectedMaint] = useState(null);
  // Cho phép quay lại đúng tab đã xem trước đó
  const [activeSection, setActiveSection] = useState(
    searchParams.get('tab') === 'machines' ? 'machines' : 'orders'
  );
  const [factoryId, setFactoryId] = useState(null);

  useEffect(() => {
    factoryProdApi.listMyFactories().then(list => {
      const active = (list || []).filter(f => f.status === 'ACTIVE');
      if (active.length >= 1) setFactoryId(active[0].id);
    }).catch(() => {});
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      // Khoảng thời gian khớp với MaintenanceGantt: 30 ngày trước → 60 ngày sau (tổng 90 ngày)
      const now = Date.now();
      const fromMs = now - 30 * 86400000;
      const toMs = now + 60 * 86400000;
      const [dash, planList, prods, maint, factList, occ] = await Promise.all([
        ownerProdApi.getDashboard(),
        ownerProdApi.listPlans(0, 50, 'ACTIVE'),
        factoryProductApi.list(true).catch(() => []),
        ownerProdApi.listMaintenance(new Date().getFullYear()),
        ownerProdApi.listFactories().catch(() => []),
        ownerProdApi.listMachineOccupancy(fromMs, toMs).catch(() => []),
      ]);
      setDashboard(dash);
      setPlans(planList?.content || []);
      setProducts(prods || []);
      setMaintenance(maint || []);
      setFactories(factList || []);
      setOccupancy(occ || []);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  // Auto-refresh occupancy mỗi 60 giây khi đang xem tab machines — để Gantt cập nhật realtime
  useEffect(() => {
    if (activeSection !== 'machines') return;
    const refreshOccupancy = async () => {
      const now = Date.now();
      const fromMs = now - 30 * 86400000;
      const toMs = now + 60 * 86400000;
      try {
        const occ = await ownerProdApi.listMachineOccupancy(fromMs, toMs);
        setOccupancy(occ || []);
      } catch (_) { }
    };
    const timer = setInterval(refreshOccupancy, 60000);
    refreshOccupancy(); // immediate refresh khi chuyển sang tab machines
    return () => clearInterval(timer);
  }, [activeSection]);

  const onSaved = () => { setShowAddMachine(false); setShowCreateWorkOrder(false); load(); };

  if (loading && !dashboard) return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <StatCardSkeleton key={i} />)}</div>
    </div>
  );

  const d = dashboard || {};

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <PageHeader icon={Factory} title={t('production','dash_title')} subtitle={t('production','dash_subtitle')} />
        {/* Không có nút "Kế hoạch mới" — kế hoạch chỉ do Owner tạo. Có nút "Tạo lệnh sản xuất"
            cho kế hoạch đã có (SUPER_FACTORY_WORKER được tạo lệnh sản xuất). */}
        <div className="flex gap-2">
          <PrimaryButton onClick={() => setShowCreateWorkOrder(true)}>
            <ClipboardList size={15} /> {t('production','dash_create_work_order')}
          </PrimaryButton>
        </div>
      </div>

      {factories.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#8E8878] font-medium">{t('production','mstock_factory_label')}:</span>
          <select className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-[#E8DDD0] bg-white text-[#1C1C1E] focus:outline-none focus:border-[#C9A84C]"
            value={factoryId || ''} onChange={e => setFactoryId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">{t('common','all')}</option>
            {factories.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
      )}

      <div className="flex gap-1 bg-white border border-black/5 rounded-xl p-1 w-fit shadow-sm">
        {[{ id: 'orders', label: t('production','dash_tab_orders'), icon: ClipboardList }, { id: 'machines', label: t('production','dash_tab_machines'), icon: Settings2 }].map(s => (
          <button key={s.id} onClick={() => setActiveSection(s.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeSection === s.id ? 'bg-[#1C1C1E] text-white' : 'text-[#8E8878] hover:text-[#1C1C1E]'}`}>
            <s.icon size={14} />{s.label}
          </button>
        ))}
      </div>

      {activeSection === 'orders' && (
        <SectionCard>
          <SectionHeader title={t('production','dash_gantt_title')} />
          <div className="p-4">
            <ProductionGantt
              plans={d.recentPlans || []} orders={d.calendarItems || []}
              onPlanClick={id => navigate(`/super-factory/production/plans/${id}`)}
              onOrderClick={id => navigate(`/super-factory/production/work-orders/${id}`)} />
          </div>
        </SectionCard>
      )}

      {activeSection === 'machines' && (
        <SectionCard>
          <SectionHeader title={t('production','dash_machines_gantt_title')}
            action={<button onClick={() => setShowAddMachine(true)} className="flex items-center gap-1 text-xs text-[#C9A84C] font-semibold hover:underline"><Plus size={12} />{t('production','dash_add_machine')}</button>} />
          <div className="p-4">
            {/* Không truyền onMachineClick — click vào máy không chuyển qua trang Metric */}
            <MaintenanceGantt machines={d.machines || []} maintenanceList={maintenance} occupancyList={occupancy}
              onItemClick={setSelectedMaint} />
          </div>
        </SectionCard>
      )}

      {selectedMaint && <MaintenanceDetailModal item={selectedMaint} onClose={() => setSelectedMaint(null)} />}
      {showAddMachine && <AddMachineModal factories={factories} onClose={() => setShowAddMachine(false)} onSaved={onSaved} />}
      {showCreateWorkOrder && (
        <CreateWorkOrderModal plans={plans} products={products} factories={factories}
          onClose={() => setShowCreateWorkOrder(false)} onSaved={onSaved} />
      )}
    </div>
  );
}
