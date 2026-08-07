// src/components/production/FactoryManagement.jsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Check, Power, Building2, Users, MapPin, X } from 'lucide-react';
import Modal from '../ui/Modal';
import { PrimaryButton, SecondaryButton, EmptyState, inputCls } from '../ui';
import { ownerProdApi } from '../../api/productionModuleApi';
import { adminUserApi } from '../../api/adminApi';
import { useLang } from '../../context/LangContext';

const getStatusCfg = (t) => ({
  ACTIVE:   { label: t('production', 'fmgmt_status_active'),   cls: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' },
  INACTIVE: { label: t('production', 'fmgmt_status_inactive'), cls: 'bg-surface-2 text-muted' },
});

/**
 * Modal quản lý XƯỞNG cho OWNER: tạo xưởng (tên + địa chỉ) & gán nhân viên xưởng.
 * Dùng ở trang Quản lý sản xuất (/owner/production).
 */
export default function FactoryManagementModal({ open, onClose, onChanged }) {
  const { t } = useLang();
  const [factories, setFactories] = useState(null);
  const [workers, setWorkers] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [manageFactory, setManageFactory] = useState(null);

  const STATUS_CFG = useMemo(() => getStatusCfg(t), [t]);

  const load = useCallback(async () => {
    try { setFactories(await ownerProdApi.listFactories() || []); }
    catch { setFactories([]); }
  }, []);

  const loadWorkers = useCallback(async () => {
    try {
      const [sup, wrk] = await Promise.all([
        adminUserApi.list({ role: 'SUPER_FACTORY_WORKER', size: 200 }),
        adminUserApi.list({ role: 'FACTORY_WORKER', size: 200 }),
      ]);
      const merge = (d) => (d?.content ?? d ?? []);
      const map = new Map();
      [...merge(sup), ...merge(wrk)].forEach(u => map.set(u.id, u));
      setWorkers([...map.values()]);
    } catch { setWorkers([]); }
  }, []);

  useEffect(() => { if (open) { load(); loadWorkers(); } }, [open, load, loadWorkers]);

  const toggle = async (f) => {
    await ownerProdApi.toggleFactory(f.id, f.status !== 'ACTIVE');
    load(); onChanged?.();
  };

  if (!open) return null;

  return (
    <Modal open title={t('production', 'fmgmt_title')} onClose={onClose} size="lg"
      footer={<div className="flex justify-end"><SecondaryButton onClick={onClose}>{t('common', 'close')}</SecondaryButton></div>}>
      <div className="space-y-3">
        <div className="flex justify-between items-center gap-3 flex-wrap">
          <p className="text-sm text-muted">
            {t('production', 'fmgmt_desc')}
          </p>
          <PrimaryButton onClick={() => setShowCreate(true)}>
            <Plus size={15} /> {t('production', 'fmgmt_create')}
          </PrimaryButton>
        </div>

        {factories == null ? (
          <div className="py-8 text-center text-sm text-muted">{t('common', 'loading')}</div>
        ) : factories.length === 0 ? (
          <EmptyState icon={Building2} title={t('production', 'fmgmt_empty_title')}
            description={t('production', 'fmgmt_empty_desc')} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-1 gap-3">
            {factories.map(f => {
              const cfg = STATUS_CFG[f.status] || STATUS_CFG.INACTIVE;
              return (
                <div key={f.id} className="bg-surface rounded-2xl border border-hairline shadow-sm p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-gold/15 text-gold flex items-center justify-center flex-shrink-0">
                        <Building2 size={18} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-ink truncate">{f.name}</p>
                        {f.address && (
                          <p className="text-xs text-muted mt-0.5 flex items-center gap-1">
                            <MapPin size={11} className="flex-shrink-0" /> <span className="truncate">{f.address}</span>
                          </p>
                        )}
                      </div>
                    </div>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${cfg.cls}`}>{cfg.label}</span>
                  </div>
                  <div className="mt-3 pt-3 border-t border-hairline flex items-center justify-between gap-2">
                    <span className="text-xs text-muted flex items-center gap-1.5">
                      <Users size={13} /> {t('production', 'fmgmt_worker_count', { n: (f.managers || []).length })}
                    </span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setManageFactory(f)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-ink bg-canvas hover:bg-surface-2">
                        {t('production', 'fmgmt_assign_workers')}
                      </button>
                      <button onClick={() => toggle(f)}
                        title={f.status === 'ACTIVE' ? t('production', 'fmgmt_status_inactive') : t('production', 'fmgmt_activate')}
                        className="p-2 rounded-lg text-muted hover:bg-canvas hover:text-ink">
                        <Power size={15} />
                      </button>
                    </div>
                  </div>
                  {(f.managers || []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {f.managers.map(m => (
                        <span key={m.id} className="text-[11px] bg-surface-2 text-muted px-2 py-0.5 rounded-full">
                          {m.fullName || m.username}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showCreate && (
        <CreateFactoryModal workers={workers}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load(); onChanged?.(); }} />
      )}
      {manageFactory && (
        <AssignManagersModal factory={manageFactory} workers={workers}
          onClose={() => setManageFactory(null)}
          onSaved={() => { setManageFactory(null); load(); onChanged?.(); }} />
      )}
    </Modal>
  );
}

function CreateFactoryModal({ workers, onClose, onCreated }) {
  const { t } = useLang();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [managerIds, setManagerIds] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const save = async () => {
    setErr('');
    if (!name.trim()) return setErr(t('production', 'fmgmt_err_name'));
    if (!address.trim()) return setErr(t('production', 'fmgmt_err_address'));
    setBusy(true);
    try {
      await ownerProdApi.createFactory({ name: name.trim(), address: address.trim(), description: description.trim(), managerIds });
      onCreated();
    } catch (e) { setErr(e?.response?.data?.message || t('production', 'fmgmt_err_create')); }
    finally { setBusy(false); }
  };

  return (
    <Modal open title={t('production', 'fmgmt_create')} onClose={onClose} size="md"
      footer={<div className="flex justify-end gap-2">
        <SecondaryButton onClick={onClose}>{t('common', 'cancel')}</SecondaryButton>
        <PrimaryButton onClick={save} disabled={busy}>
          {busy ? t('common', 'saving') : t('production', 'fmgmt_create')}
        </PrimaryButton>
      </div>}>
      <div className="space-y-3">
        {err && <div className="text-sm text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-500/10 rounded-lg px-3 py-2">{err}</div>}
        <div>
          <label className="text-sm font-medium text-ink">
            {t('production', 'fmgmt_field_name')} <span className="text-red-500">*</span>
          </label>
          <input className={inputCls} value={name} onChange={e => setName(e.target.value)}
            placeholder={t('production', 'fmgmt_field_name_ph')} />
        </div>
        <div>
          <label className="text-sm font-medium text-ink">
            {t('production', 'fmgmt_field_address')} <span className="text-red-500">*</span>
          </label>
          <input className={inputCls} value={address} onChange={e => setAddress(e.target.value)}
            placeholder={t('production', 'fmgmt_field_address_ph')} />
        </div>
        <div>
          <label className="text-sm font-medium text-ink">{t('production', 'fmgmt_field_desc')}</label>
          <input className={inputCls} value={description} onChange={e => setDescription(e.target.value)}
            placeholder={t('production', 'fmgmt_field_desc_ph')} />
        </div>
        <ManagerPicker workers={workers} selected={managerIds} onChange={setManagerIds} />
      </div>
    </Modal>
  );
}

function AssignManagersModal({ factory, workers, onClose, onSaved }) {
  const { t } = useLang();
  const [managerIds, setManagerIds] = useState((factory.managers || []).map(m => m.id));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const save = async () => {
    setErr(''); setBusy(true);
    try { await ownerProdApi.updateFactoryManagers(factory.id, { managerIds }); onSaved(); }
    catch (e) { setErr(e?.response?.data?.message || t('production', 'fmgmt_err_save')); }
    finally { setBusy(false); }
  };

  return (
    <Modal open title={t('production', 'fmgmt_assign_title', { name: factory.name })} onClose={onClose} size="md"
      footer={<div className="flex justify-end gap-2">
        <SecondaryButton onClick={onClose}>{t('common', 'cancel')}</SecondaryButton>
        <PrimaryButton onClick={save} disabled={busy}>
          {busy ? t('common', 'saving') : t('common', 'save')}
        </PrimaryButton>
      </div>}>
      <div className="space-y-3">
        {err && <div className="text-sm text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-500/10 rounded-lg px-3 py-2">{err}</div>}
        <p className="text-xs text-muted">
          {t('production', 'fmgmt_assign_desc')}
        </p>
        <ManagerPicker workers={workers} selected={managerIds} onChange={setManagerIds} />
      </div>
    </Modal>
  );
}

function ManagerPicker({ workers, selected, onChange }) {
  const { t } = useLang();
  const toggle = (id) =>
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
  return (
    <div>
      <label className="text-sm font-medium text-ink">{t('production', 'fmgmt_manager_label')}</label>
      {workers.length === 0 ? (
        <p className="text-xs text-muted mt-1">{t('production', 'fmgmt_no_workers')}</p>
      ) : (
        <div className="flex flex-wrap gap-2 mt-2 max-h-56 overflow-y-auto">
          {workers.map(u => {
            const on = selected.includes(u.id);
            return (
              <button key={u.id} type="button" onClick={() => toggle(u.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${on
                  ? 'bg-gold/15 text-gold border-gold/40'
                  : 'bg-surface text-muted border-line hover:border-gold/40'}`}>
                {on && <Check size={12} className="inline mr-1" />}{u.fullName || u.username}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
