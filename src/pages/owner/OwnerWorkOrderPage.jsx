// src/pages/owner/OwnerWorkOrderPage.jsx
import { useState, useEffect, useRef } from 'react';
import { Plus, X, ChevronDown, ChevronUp, ClipboardList, Search } from 'lucide-react';
import useMinLoading from '../../hooks/useMinLoading.js';
import { Field, inputCls, PrimaryButton } from '../../components/ui';
import { CardSkeleton } from '../../components/ui/Skeleton.jsx';
import { ownerProductionApi, factoryProductApi } from '../../api/productionApi';
import { ownerProdApi } from '../../api/productionModuleApi';

const fmtDate = (ms) => ms
  ? new Date(ms).toLocaleDateString('vi-VN', { day:'2-digit', month:'2-digit', year:'numeric' })
  : '—';

const STATUS_CONFIG = {
  DRAFT:       { label: 'Bản nháp',       cls: 'bg-gray-100 text-gray-600',        dot: 'bg-gray-400' },
  RELEASED:    { label: 'Đã phát hành',   cls: 'bg-blue-100 text-blue-700',        dot: 'bg-blue-400' },
  IN_PROGRESS: { label: 'Đang thực hiện', cls: 'bg-amber-100 text-amber-700',      dot: 'bg-amber-400' },
  COMPLETED:   { label: 'Hoàn thành',     cls: 'bg-emerald-100 text-emerald-700',  dot: 'bg-emerald-400' },
  CLOSED:      { label: 'Đóng',           cls: 'bg-gray-100 text-gray-500',        dot: 'bg-gray-300' },
  CANCELLED:   { label: 'Huỷ',            cls: 'bg-red-100 text-red-600',          dot: 'bg-red-400' },
};

const QC_STATUS = {
  PENDING:      { label: 'Chờ',         cls: 'text-gray-500' },
  PASS:         { label: '✓ Đạt',       cls: 'text-emerald-600' },
  FAIL:         { label: '✗ Không đạt', cls: 'text-red-600' },
  NEEDS_REVIEW: { label: '⚠ Xem lại',   cls: 'text-amber-600' },
};

// ── Search dropdown ────────────────────────────────────────────────────────────
function SearchDropdown({ items, value, onChange, onCreateNew, placeholder = 'Tìm...' }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = items.find(i => i.id === value);
  const filtered = q ? items.filter(i => i.name.toLowerCase().includes(q.toLowerCase())) : items;

  return (
    <div className="relative" ref={ref}>
      <div
        className={`${inputCls} flex items-center gap-2 cursor-pointer min-h-[38px]`}
        onClick={() => setOpen(o => !o)}
      >
        <Search size={13} className="text-[#8E8878] flex-shrink-0" />
        <span className={`flex-1 truncate text-sm ${selected ? 'text-[#1C1C1E]' : 'text-[#8E8878]'}`}>
          {selected ? `${selected.name}${selected.unit ? ` (${selected.unit})` : ''}` : placeholder}
        </span>
        <ChevronDown size={13} className={`text-[#8E8878] transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`} />
      </div>

      {open && (
        <div className="absolute top-full left-0 right-0 z-50 bg-white border border-[#E8DDD0]
          rounded-xl shadow-lg mt-1 overflow-hidden">
          <div className="p-2 border-b border-[#F0EBE3]">
            <input
              autoFocus
              className="w-full text-sm px-3 py-1.5 rounded-lg border border-[#E8DDD0]
                focus:outline-none focus:border-[#C9A84C] bg-[#FAF7F2] placeholder-[#8E8878]"
              placeholder="Tìm sản phẩm..."
              value={q}
              onChange={e => setQ(e.target.value)}
              onClick={e => e.stopPropagation()}
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-sm text-[#8E8878] italic">Không tìm thấy</div>
            ) : (
              filtered.map(item => (
                <button
                  key={item.id}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-[#FAF7F2] transition-colors
                    ${value === item.id ? 'bg-[#F0EBE3] font-medium' : ''}`}
                  onClick={() => { onChange(item.id); setOpen(false); setQ(''); }}
                >
                  {item.name}{item.unit ? ` (${item.unit})` : ''}
                </button>
              ))
            )}
          </div>
          {onCreateNew && (
            <button
              className="w-full text-left px-3 py-2.5 text-sm text-[#C9A84C] font-semibold
                border-t border-[#F0EBE3] hover:bg-[#FAF7F2] flex items-center gap-1.5"
              onClick={() => { setOpen(false); onCreateNew(q); }}
            >
              <Plus size={13} /> Tạo sản phẩm mới{q ? `: "${q}"` : ''}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Modal tạo sản phẩm nhanh ──────────────────────────────────────────────────
function QuickCreateProductModal({ initialName = '', onClose, onCreated }) {
  const [name, setName] = useState(initialName);
  const [unit, setUnit] = useState('Kg');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    if (!name.trim()) { setErr('Vui lòng nhập tên sản phẩm'); return; }
    setSaving(true);
    try {
      const created = await factoryProductApi.create({ name: name.trim(), unit });
      onCreated(created);
    } catch (e) {
      setErr(e?.response?.data?.message || 'Có lỗi xảy ra');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-[#1C1C1E]">Tạo sản phẩm mới</h3>
          <button onClick={onClose} className="text-[#8E8878] hover:text-[#1C1C1E]"><X size={18} /></button>
        </div>
        {err && <p className="text-xs text-red-600 mb-3 bg-red-50 px-3 py-2 rounded-xl">{err}</p>}
        <div className="space-y-3">
          <Field label="Tên sản phẩm *">
            <input
              autoFocus
              className={inputCls}
              placeholder="VD: Xúc xích heo"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submit()}
            />
          </Field>
          <Field label="Đơn vị">
            <select className={inputCls} value={unit} onChange={e => setUnit(e.target.value)}>
              {['Kg', 'Gr', 'Hộp', 'Túi', 'Cái', 'Thùng'].map(u => <option key={u}>{u}</option>)}
            </select>
          </Field>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={onClose}
            className="flex-1 py-2 text-sm text-[#8E8878] border border-[#E8DDD0] rounded-xl hover:bg-[#FAF7F2]">
            Huỷ
          </button>
          <PrimaryButton className="flex-1" onClick={submit} loading={saving}>
            Tạo sản phẩm
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}

// ── Work Order Card ────────────────────────────────────────────────────────────
function WorkOrderCard({ wo, onStatusChange }) {
  const [expanded, setExpanded] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const cfg = STATUS_CONFIG[wo.status] || STATUS_CONFIG.DRAFT;

  const nextStatus = {
    DRAFT: 'RELEASED', RELEASED: 'IN_PROGRESS',
    IN_PROGRESS: 'COMPLETED', COMPLETED: 'CLOSED',
  }[wo.status];

  const handleAdvance = async () => {
    if (!nextStatus) return;
    setChangingStatus(true);
    try {
      await ownerProductionApi.updateWorkOrderStatus(wo.id, { status: nextStatus });
      onStatusChange();
    } finally { setChangingStatus(false); }
  };

  return (
    <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
      <button className="w-full text-left px-5 py-4" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm font-bold text-[#1C1C1E]">{wo.workOrderCode}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${cfg.cls}`}>{cfg.label}</span>
            </div>
            <p className="text-sm text-[#8E8878] mt-0.5 truncate">{wo.productName}</p>
            <div className="flex gap-4 mt-1 text-xs text-[#8E8878] flex-wrap">
              <span>KH: <b className="text-[#1C1C1E]">{Number(wo.plannedQty || 0).toLocaleString('vi-VN')} {wo.outputUnit}</b></span>
              {wo.actualQty && <span>TT: <b className="text-emerald-600">{Number(wo.actualQty).toLocaleString('vi-VN')} {wo.outputUnit}</b></span>}
              {wo.plannedStartDate && <span>📅 {fmtDate(wo.plannedStartDate)} → {fmtDate(wo.plannedEndDate)}</span>}
              {wo.assignedToName && <span>👤 {wo.assignedToName}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {nextStatus && (
              <button
                onClick={e => { e.stopPropagation(); handleAdvance(); }}
                disabled={changingStatus}
                className="px-3 py-1.5 bg-[#1A2B1A] text-white text-xs font-semibold rounded-lg hover:bg-[#243824] disabled:opacity-50 transition-colors">
                {changingStatus ? '...' : `→ ${STATUS_CONFIG[nextStatus]?.label}`}
              </button>
            )}
            {expanded ? <ChevronUp size={16} className="text-[#8E8878]" /> : <ChevronDown size={16} className="text-[#8E8878]" />}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-4 border-t border-black/5">
          {wo.operations?.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold text-[#8E8878] uppercase tracking-wider mb-2">Các bước</p>
              <div className="space-y-1.5">
                {wo.operations.map((op, i) => {
                  const qcCfg = QC_STATUS[op.qcStatus] || QC_STATUS.PENDING;
                  return (
                    <div key={i} className="flex items-center gap-3 text-xs">
                      <div className="w-5 h-5 rounded-full bg-[#1A2B1A]/10 flex items-center justify-center text-[10px] font-bold text-[#1A2B1A] flex-shrink-0">
                        {op.operationSequence}
                      </div>
                      <span className="flex-1 text-[#1C1C1E]">{op.operationName}</span>
                      {op.machineName && <span className="text-[#8E8878]">⚙ {op.machineName}</span>}
                      {op.qcRequired && <span className={`font-medium ${qcCfg.cls}`}>{qcCfg.label}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {wo.notes && (
            <p className="mt-3 text-xs text-[#8E8878] italic">{wo.notes}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Modal tạo Work Order ──────────────────────────────────────────────────────
function CreateWorkOrderModal({ plans, allProducts, machines, onClose, onSaved }) {
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [form, setForm] = useState({
    factoryProductId: '',
    plannedQty: '',
    plannedStartDate: '',
    plannedEndDate: '',
    notes: '',
  });
  const [operations, setOperations] = useState([
    { operationSequence: 1, operationName: '', machineId: '', plannedHours: '', qcRequired: false, qcType: '', qcControlPoint: '' },
  ]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [quickCreateName, setQuickCreateName] = useState('');
  const [localProducts, setLocalProducts] = useState(allProducts);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toMs = (dateStr) => dateStr ? new Date(dateStr + 'T07:00:00').getTime() : null;
  const setOp = (idx, k, v) => setOperations(prev => prev.map((o, i) => i === idx ? { ...o, [k]: v } : o));
  const addOp = () => setOperations(prev => [...prev, {
    operationSequence: prev.length + 1, operationName: '', machineId: '',
    plannedHours: '', qcRequired: false, qcType: '', qcControlPoint: '',
  }]);
  const removeOp = (idx) => setOperations(prev => prev.filter((_, i) => i !== idx));

  // Sản phẩm có thể chọn: nếu đã chọn kế hoạch thì chỉ trong kế hoạch đó
  const selectedPlan = plans.find(p => String(p.id) === String(selectedPlanId));
  // plans[].factoryProductIds là mảng ID sản phẩm trong kế hoạch
  // Nếu plan chỉ có factoryProductId đơn (cũ), fallback về đó
  const planProductIds = selectedPlan
    ? (selectedPlan.factoryProductIds?.length
        ? selectedPlan.factoryProductIds
        : selectedPlan.factoryProductId ? [selectedPlan.factoryProductId] : [])
    : [];
  const planProducts = planProductIds.length > 0
    ? localProducts.filter(p => planProductIds.includes(p.id))
    : localProducts;

  const submit = async () => {
    if (!form.factoryProductId || !form.plannedQty) {
      setErr('Vui lòng chọn sản phẩm và nhập sản lượng');
      return;
    }
    setSaving(true);
    setErr('');
    try {
      const payload = {
        factoryProductId: Number(form.factoryProductId),
        productionPlanId: selectedPlanId ? Number(selectedPlanId) : null,
        plannedQty: Number(form.plannedQty),
        plannedStartDate: toMs(form.plannedStartDate),
        plannedEndDate: toMs(form.plannedEndDate),
        notes: form.notes,
        operations: operations
          .filter(o => o.operationName.trim())
          .map(o => ({
            operationSequence: o.operationSequence,
            operationName: o.operationName,
            machineId: o.machineId ? Number(o.machineId) : null,
            plannedHours: o.plannedHours ? Number(o.plannedHours) : null,
            qcRequired: o.qcRequired,
            qcType: o.qcRequired && o.qcType ? o.qcType : null,
            qcControlPoint: o.qcRequired ? o.qcControlPoint : null,
          })),
      };
      await ownerProductionApi.createWorkOrder(payload);
      onSaved();
    } catch (e) {
      setErr(e?.response?.data?.message || 'Có lỗi xảy ra');
    } finally { setSaving(false); }
  };

  const handleProductCreated = (newProd) => {
    setLocalProducts(prev => [...prev, newProd]);
    set('factoryProductId', newProd.id);
    setShowQuickCreate(false);
  };

  // Plan display name
  const planItems = plans.map(p => ({
    id: p.id,
    name: p.planCode || p.title || `KH-${p.id}`,
    unit: '',
  }));

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b border-black/5 bg-[#1A2B1A] flex items-center justify-between flex-shrink-0">
            <h2 className="text-white font-semibold text-sm">Tạo lệnh sản xuất mới</h2>
            <button onClick={onClose} className="text-white/60 hover:text-white"><X size={18} /></button>
          </div>

          <div className="p-6 space-y-5 overflow-y-auto flex-1">
            {err && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{err}</p>}

            {/* Kế hoạch sản xuất (optional) */}
            {plans.length > 0 && (
              <Field label="Kế hoạch sản xuất">
                <SearchDropdown
                  items={planItems}
                  value={selectedPlanId ? Number(selectedPlanId) : ''}
                  onChange={(id) => {
                    setSelectedPlanId(id);
                    set('factoryProductId', '');
                  }}
                  placeholder="Chọn kế hoạch (không bắt buộc)"
                />
              </Field>
            )}

            {/* Sản phẩm + sản lượng */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Thành phẩm" required>
                <SearchDropdown
                  items={planProducts}
                  value={form.factoryProductId ? Number(form.factoryProductId) : ''}
                  onChange={(id) => set('factoryProductId', id)}
                  onCreateNew={(name) => { setQuickCreateName(name); setShowQuickCreate(true); }}
                  placeholder={
                    selectedPlanId && planProducts.length === 0
                      ? 'Kế hoạch chưa có sản phẩm'
                      : 'Chọn sản phẩm...'
                  }
                />
              </Field>
              <Field label="Sản lượng kế hoạch" required>
                <input type="number" className={inputCls} placeholder="VD: 500"
                  value={form.plannedQty} onChange={e => set('plannedQty', e.target.value)} />
              </Field>
              <Field label="Ngày bắt đầu">
                <input type="date" className={inputCls} value={form.plannedStartDate}
                  onChange={e => set('plannedStartDate', e.target.value)} />
              </Field>
              <Field label="Ngày kết thúc">
                <input type="date" className={inputCls} value={form.plannedEndDate}
                  onChange={e => set('plannedEndDate', e.target.value)} />
              </Field>
            </div>

            <Field label="Ghi chú">
              <textarea className={inputCls} rows={2} value={form.notes}
                onChange={e => set('notes', e.target.value)} />
            </Field>

            {/* Operations */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-[#1C1C1E]">Các bước thao tác</p>
                <button onClick={addOp}
                  className="flex items-center gap-1 text-xs text-[#1A2B1A] font-semibold hover:underline">
                  <Plus size={13} />Thêm bước
                </button>
              </div>
              <div className="space-y-3">
                {operations.map((op, idx) => (
                  <div key={idx} className="border border-black/5 rounded-xl p-4 bg-[#FAF7F2]">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-5 h-5 rounded-full bg-[#1A2B1A] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                        {op.operationSequence}
                      </div>
                      <span className="text-xs font-medium text-[#8E8878]">Bước {op.operationSequence}</span>
                      {operations.length > 1 && (
                        <button onClick={() => removeOp(idx)} className="ml-auto text-[#8E8878] hover:text-red-500">
                          <X size={13} />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Field label="Tên thao tác" required>
                        <input className={inputCls} placeholder="VD: Xay thịt, Trộn gia vị..."
                          value={op.operationName} onChange={e => setOp(idx, 'operationName', e.target.value)} />
                      </Field>
                      <Field label="Máy thực hiện">
                        <select className={inputCls} value={op.machineId}
                          onChange={e => setOp(idx, 'machineId', e.target.value)}>
                          <option value="">-- Không cần máy --</option>
                          {machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                      </Field>
                      <Field label="Giờ kế hoạch">
                        <input type="number" className={inputCls} placeholder="VD: 2"
                          value={op.plannedHours} onChange={e => setOp(idx, 'plannedHours', e.target.value)} />
                      </Field>
                      <div className="flex items-end gap-3">
                        <label className="flex items-center gap-2 cursor-pointer text-sm">
                          <input type="checkbox" checked={op.qcRequired}
                            onChange={e => setOp(idx, 'qcRequired', e.target.checked)}
                            className="w-4 h-4 rounded accent-[#1A2B1A]" />
                          <span className="text-[#1C1C1E]">Cần kiểm QC</span>
                        </label>
                      </div>
                      {op.qcRequired && (
                        <>
                          <Field label="Loại QC">
                            <select className={inputCls} value={op.qcType}
                              onChange={e => setOp(idx, 'qcType', e.target.value)}>
                              <option value="">-- Chọn --</option>
                              <option value="VISUAL">Quan sát</option>
                              <option value="MEASUREMENT">Đo lường</option>
                              <option value="SAMPLING">Lấy mẫu</option>
                              <option value="OTHER">Khác</option>
                            </select>
                          </Field>
                          <Field label="Điểm kiểm soát">
                            <input className={inputCls} placeholder="VD: Bước 2 – Nhồi"
                              value={op.qcControlPoint} onChange={e => setOp(idx, 'qcControlPoint', e.target.value)} />
                          </Field>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-black/5 bg-[#FAF7F2]/50 flex gap-3 justify-end flex-shrink-0">
            <button onClick={onClose} className="px-4 py-2 text-sm text-[#8E8878]">Hủy</button>
            <PrimaryButton onClick={submit} loading={saving}
              disabled={!form.factoryProductId || !form.plannedQty}>
              Tạo lệnh sản xuất
            </PrimaryButton>
          </div>
        </div>
      </div>

      {showQuickCreate && (
        <QuickCreateProductModal
          initialName={quickCreateName}
          onClose={() => setShowQuickCreate(false)}
          onCreated={handleProductCreated}
        />
      )}
    </>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function OwnerWorkOrderPage() {
  const [workOrders, setWorkOrders] = useState([]);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [products, setProducts] = useState([]);
  const [machines, setMachines] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useMinLoading();
  const [showModal, setShowModal] = useState(false);

  const loadData = async (p = 0) => {
    setLoading(true);
    try {
      const [woData, prods, machs, planData] = await Promise.all([
        ownerProductionApi.listWorkOrders(p, 20, statusFilter || null),
        ownerProductionApi.listProducts(true),
        ownerProductionApi.listMachines(true),
        ownerProdApi.listPlans(0, 100, 'ACTIVE').catch(() => ({ content: [] })),
      ]);
      setWorkOrders(woData?.content || []);
      setTotalPages(woData?.totalPages || 0);
      setPage(p);
      setProducts(prods || []);
      setMachines(machs || []);
      setPlans(planData?.content || []);
    } finally { setLoading(false); }
  };

  useEffect(() => { loadData(0); }, [statusFilter]);

  const onSaved = () => { setShowModal(false); loadData(0); };

  const counts = workOrders.reduce((acc, wo) => {
    acc[wo.status] = (acc[wo.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#1C1C1E]">Lệnh sản xuất</h1>
          <p className="text-sm text-[#8E8878] mt-1">Tạo và theo dõi các lệnh sản xuất</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-[#1A2B1A] text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#243824] transition-colors">
          <Plus size={16} />Tạo lệnh
        </button>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {[['', 'Tất cả'], ...Object.entries(STATUS_CONFIG).map(([k, v]) => [k, v.label])].map(([val, label]) => (
          <button key={val}
            onClick={() => setStatusFilter(val)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
              statusFilter === val
                ? 'bg-[#1A2B1A] text-white'
                : 'bg-white border border-black/10 text-[#8E8878] hover:text-[#1C1C1E]'
            }`}>
            {label}
            {val && counts[val] ? ` (${counts[val]})` : ''}
          </button>
        ))}
      </div>

      {/* List */}
      {loading && workOrders.length === 0 && <div className="p-8"><CardSkeleton lines={4} /></div>}
      <div className="space-y-3">
        {workOrders.map(wo => (
          <WorkOrderCard key={wo.id} wo={wo} onStatusChange={() => loadData(page)} />
        ))}
        {!loading && workOrders.length === 0 && (
          <div className="bg-white rounded-2xl border border-black/5 p-12 text-center">
            <ClipboardList size={32} className="mx-auto text-[#8E8878] mb-3" />
            <p className="text-sm text-[#8E8878]">Chưa có lệnh sản xuất nào</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => (
            <button key={i} onClick={() => loadData(i)}
              className={`w-8 h-8 rounded-lg text-sm font-medium ${
                page === i ? 'bg-[#1A2B1A] text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}>{i + 1}</button>
          ))}
        </div>
      )}

      {showModal && (
        <CreateWorkOrderModal
          plans={plans}
          allProducts={products}
          machines={machines}
          onClose={() => setShowModal(false)}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}