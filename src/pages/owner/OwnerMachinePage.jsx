// OwnerMachinePage.jsx
// Trang quản lý máy móc / dây chuyền sản xuất (Owner only)
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Settings2, ToggleLeft, ToggleRight, Pencil, X, Check } from 'lucide-react';
import useMinLoading from '../../hooks/useMinLoading.js';
import { Field, inputCls, PrimaryButton } from '../../components/ui';
import { CardSkeleton } from '../../components/ui/Skeleton.jsx';
import { ownerProductionApi } from '../../api/productionApi';

// ── Modal thêm / sửa máy ────────────────────────────────────────────────────
function MachineModal({ machine, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: machine?.name || '',
    capacityHoursPerMonth: machine?.capacityHoursPerMonth || '',
    description: machine?.description || '',
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.name || !form.capacityHoursPerMonth) return;
    setSaving(true);
    try {
      const saved = machine?.id
        ? await ownerProductionApi.updateMachine(machine.id, form)
        : await ownerProductionApi.createMachine(form);
      onSaved(saved);
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-black/5 bg-[#1A2B1A] flex items-center justify-between">
          <h2 className="text-white font-semibold text-sm">
            {machine ? 'Chỉnh sửa máy' : 'Thêm máy / dây chuyền'}
          </h2>
          <button onClick={onClose} className="text-white/60 hover:text-white">
            <X size={18} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <Field label="Tên máy / dây chuyền" required>
            <input className={inputCls} placeholder="VD: Máy xay thịt A"
              value={form.name} onChange={e => set('name', e.target.value)} />
          </Field>
          <Field label="Công suất (giờ/tháng)" required>
            <input type="number" className={inputCls} placeholder="VD: 200"
              value={form.capacityHoursPerMonth}
              onChange={e => set('capacityHoursPerMonth', e.target.value)} />
          </Field>
          <Field label="Mô tả">
            <textarea className={inputCls} rows={3} placeholder="Ghi chú thêm về máy..."
              value={form.description} onChange={e => set('description', e.target.value)} />
          </Field>
        </div>
        <div className="px-6 py-4 border-t border-black/5 bg-[#FAF7F2]/50 flex gap-3 justify-end">
          <button onClick={onClose}
            className="px-4 py-2 text-sm text-[#8E8878] hover:text-[#1C1C1E] transition-colors">
            Hủy
          </button>
          <PrimaryButton onClick={submit} loading={saving}
            disabled={!form.name || !form.capacityHoursPerMonth}>
            {machine ? 'Lưu thay đổi' : 'Thêm máy'}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function OwnerMachinePage() {
  const navigate = useNavigate();
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useMinLoading();
  const [modal, setModal] = useState(null); // null | 'create' | machine obj

  useEffect(() => {
    ownerProductionApi.listMachines(false)
      .then(d => setMachines(d || []))
      .finally(() => setLoading(false));
  }, []);

  const onSaved = (saved) => {
    setMachines(prev => {
      const idx = prev.findIndex(m => m.id === saved.id);
      return idx >= 0 ? prev.map((m, i) => i === idx ? saved : m) : [saved, ...prev];
    });
    setModal(null);
  };

  const toggleStatus = async (machine) => {
    const updated = await ownerProductionApi.toggleMachine(machine.id, machine.status !== 'ACTIVE');
    setMachines(prev => prev.map(m => m.id === updated.id ? updated : m));
  };

  if (loading) return <div className="p-8"><CardSkeleton lines={4} /></div>;

  const active   = machines.filter(m => m.status === 'ACTIVE');
  const inactive = machines.filter(m => m.status !== 'ACTIVE');

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#1C1C1E]"
              style={{ fontFamily: 'var(--font-display)' }}>
            Máy & Dây chuyền
          </h1>
          <p className="text-sm text-[#8E8878] mt-1">
            Quản lý thiết bị và công suất sản xuất
          </p>
        </div>
        <button
          onClick={() => setModal('create')}
          className="flex items-center gap-2 bg-[#1A2B1A] text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#243824] transition-colors">
          <Plus size={16} />
          Thêm máy
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[
          { label: 'Đang hoạt động', value: active.length, color: 'text-emerald-600' },
          { label: 'Ngừng hoạt động', value: inactive.length, color: 'text-red-500' },
          { label: 'Tổng công suất (giờ/tháng)', value: active.reduce((s, m) => s + Number(m.capacityHoursPerMonth || 0), 0), color: 'text-[#C9A84C]' },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-2xl border border-black/5 p-4 shadow-sm">
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-[#8E8878] mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* List */}
      {machines.length === 0 && (
        <div className="bg-white rounded-2xl border border-black/5 p-12 text-center">
          <Settings2 size={32} className="mx-auto text-[#8E8878] mb-3" />
          <p className="text-sm text-[#8E8878]">Chưa có máy nào. Thêm máy đầu tiên!</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {machines.map(m => (
          <div key={m.id}
               className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-opacity ${
                 m.status !== 'ACTIVE' ? 'opacity-60 border-black/5' : 'border-black/5'
               }`}>
            <div className="px-4 py-3 border-b border-black/5 bg-[#FAF7F2] flex items-center justify-between">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                m.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
              }`}>
                {m.status === 'ACTIVE' ? 'Hoạt động' : 'Ngừng'}
              </span>
              <div className="flex items-center gap-2">
                <button onClick={() => setModal(m)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-black/5 text-[#8E8878] hover:text-[#1C1C1E] transition-colors">
                  <Pencil size={13} />
                </button>
                <button onClick={() => toggleStatus(m)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-black/5 text-[#8E8878] hover:text-[#1C1C1E] transition-colors">
                  {m.status === 'ACTIVE' ? <ToggleRight size={16} className="text-emerald-600" /> : <ToggleLeft size={16} />}
                </button>
              </div>
            </div>
            <div className="p-4">
              <button onClick={() => navigate(`/owner/production/machines/${m.id}/metrics`)}
                className="font-semibold text-[#1C1C1E] text-sm truncate hover:text-[#C9A84C] hover:underline transition-colors text-left">
                {m.name}
              </button>
              {m.description && (
                <p className="text-xs text-[#8E8878] mt-0.5 truncate">{m.description}</p>
              )}
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-[#8E8878]">Công suất</span>
                <span className="text-sm font-bold text-[#1C1C1E]">
                  {Number(m.capacityHoursPerMonth).toLocaleString('vi-VN')} giờ/tháng
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {modal && (
        <MachineModal
          machine={modal === 'create' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}