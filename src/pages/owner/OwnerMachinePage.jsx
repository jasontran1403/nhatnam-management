// OwnerMachinePage.jsx
// Trang quản lý máy móc / dây chuyền sản xuất (Owner only)
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Settings2, ToggleLeft, ToggleRight, Pencil, X, Check, Building2 } from 'lucide-react';
import useMinLoading from '../../hooks/useMinLoading.js';
import { Field, inputCls, PrimaryButton } from '../../components/ui';
import { CardSkeleton } from '../../components/ui/Skeleton.jsx';
import { ownerProductionApi } from '../../api/productionApi';
import { ownerProdApi } from '../../api/productionModuleApi';
import { useLang } from '../../context/LangContext';
import { useFmt } from '../../utils/useFmt';

// ── Modal thêm / sửa máy ────────────────────────────────────────────────────
function MachineModal({ machine, factories, onClose, onSaved }) {
  const { t } = useLang();
  const [form, setForm] = useState({
    name: machine?.name || '',
    capacityHoursPerMonth: machine?.capacityHoursPerMonth || '',
    description: machine?.description || '',
    factoryId: machine?.factoryId || '',
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.name || !form.capacityHoursPerMonth || !form.factoryId) return;
    setSaving(true);
    try {
      const payload = { ...form, factoryId: Number(form.factoryId) };
      const saved = machine?.id
        ? await ownerProductionApi.updateMachine(machine.id, payload)
        : await ownerProductionApi.createMachine(payload);
      onSaved(saved);
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-black/5 bg-[#1A2B1A] flex items-center justify-between">
          <h2 className="text-white font-semibold text-sm">
            {machine ? t('production', 'omach_edit_title') : t('production', 'omach_create_title')}
          </h2>
          <button onClick={onClose} className="text-white/60 hover:text-white">
            <X size={18} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <Field label={t('production', 'omach_field_name')} required>
            <input className={inputCls} placeholder={t('production', 'omach_field_name_ph')}
              value={form.name} onChange={e => set('name', e.target.value)} />
          </Field>
          <Field label={t('production', 'omach_field_factory')} required>
            <select className={inputCls} value={form.factoryId}
              onChange={e => set('factoryId', e.target.value)}>
              <option value="">{t('production', 'omach_select_factory')}</option>
              {(factories || []).map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </Field>
          <Field label={t('production', 'omach_field_capacity')} required>
            <input type="number" className={inputCls} placeholder={t('production', 'omach_field_capacity_ph')}
              value={form.capacityHoursPerMonth}
              onChange={e => set('capacityHoursPerMonth', e.target.value)} />
          </Field>
          <Field label={t('production', 'omach_field_desc')}>
            <textarea className={inputCls} rows={3} placeholder={t('production', 'omach_field_desc_ph')}
              value={form.description} onChange={e => set('description', e.target.value)} />
          </Field>
        </div>
        <div className="px-6 py-4 border-t border-black/5 bg-[#FAF7F2]/50 flex gap-3 justify-end">
          <button onClick={onClose}
            className="px-4 py-2 text-sm text-[#8E8878] hover:text-[#1C1C1E] transition-colors">
            {t('common', 'cancel')}
          </button>
          <PrimaryButton onClick={submit} loading={saving}
            disabled={!form.name || !form.capacityHoursPerMonth || !form.factoryId}>
            {machine ? t('common', 'save_changes') : t('production', 'omach_add')}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function OwnerMachinePage() {
  const navigate = useNavigate();
  const { t } = useLang();
  const { fmtNum } = useFmt();
  const [machines, setMachines] = useState([]);
  const [factories, setFactories] = useState([]);
  const [loading, setLoading] = useMinLoading();
  const [modal, setModal] = useState(null); // null | 'create' | machine obj

  useEffect(() => {
    ownerProductionApi.listMachines(false)
      .then(d => setMachines(d || []))
      .finally(() => setLoading(false));
    ownerProdApi.listFactories().then(d => setFactories(d || [])).catch(() => setFactories([]));
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

  const active   = useMemo(() => machines.filter(m => m.status === 'ACTIVE'), [machines]);
  const inactive = useMemo(() => machines.filter(m => m.status !== 'ACTIVE'), [machines]);

  const stats = useMemo(() => [
    { label: t('production', 'omach_stat_active'),   value: active.length,   color: 'text-emerald-600' },
    { label: t('production', 'omach_stat_inactive'), value: inactive.length, color: 'text-red-500' },
    {
      label: t('production', 'omach_stat_total_capacity'),
      value: active.reduce((s, m) => s + Number(m.capacityHoursPerMonth || 0), 0),
      color: 'text-[#C9A84C]',
    },
  ], [t, active, inactive]);

  if (loading) return <div className="p-8"><CardSkeleton lines={4} /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#1C1C1E]"
              style={{ fontFamily: 'var(--font-display)' }}>
            {t('production', 'omach_title')}
          </h1>
          <p className="text-sm text-[#8E8878] mt-1">
            {t('production', 'omach_subtitle')}
          </p>
        </div>
        <button
          onClick={() => setModal('create')}
          className="flex items-center gap-2 bg-[#1A2B1A] text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#243824] transition-colors">
          <Plus size={16} />
          {t('production', 'omach_add')}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {stats.map(stat => (
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
          <p className="text-sm text-[#8E8878]">{t('production', 'omach_empty')}</p>
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
                {m.status === 'ACTIVE'
                  ? t('production', 'fmgmt_status_active')
                  : t('production', 'fmgmt_status_inactive')}
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
              {m.factoryName && (
                <p className="text-xs text-[#C9A84C] mt-1 flex items-center gap-1">
                  <Building2 size={11} className="flex-shrink-0" /> {m.factoryName}
                </p>
              )}
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-[#8E8878]">{t('production', 'omach_capacity')}</span>
                <span className="text-sm font-bold text-[#1C1C1E]">
                  {t('production', 'omach_hours_per_month', { n: fmtNum(m.capacityHoursPerMonth) })}
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
          factories={factories}
          onClose={() => setModal(null)}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}
