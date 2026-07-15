import { useLang } from '../../context/LangContext';
import { useEffect, useState } from 'react';
import { CardSkeleton, Sk, TableSkeleton } from '../../components/ui/Skeleton.jsx';
import useMinLoading from '../../hooks/useMinLoading.js';
import { useNavigate, useLocation } from 'react-router-dom';
import { Warehouse as WarehouseIcon, Plus, Edit2, Power, Truck, Store, Package, Factory, Boxes, PackageOpen } from 'lucide-react';
import { adminWarehouseApi } from '../../api/adminApi';
import { ownerProdApi } from '../../api/productionModuleApi';
import { Badge } from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import useDebounce from '../../utils/useDebounce.js';
import {
  PageHeader,
  LoadingSpinner,
  EmptyState,
  PrimaryButton,
  SecondaryButton,
  DangerButton,
  Field,
  inputCls,
  formatDateTime,
} from '../../components/ui';

export default function AdminWarehouses() {
  const { t } = useLang();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const rolePrefix = pathname.startsWith('/owner') ? '/owner' : '/admin';
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useMinLoading();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const [activeConfirm, setActiveConfirm] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminWarehouseApi.list();
      setItems(res || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  // Kho xưởng chỉ hiển thị cho OWNER (mỗi xưởng gồm 3 kho: NL / bán TP / TP)
  const isOwner = rolePrefix === '/owner';
  const [factories, setFactories] = useState([]);
  useEffect(() => {
    if (!isOwner) return;
    ownerProdApi.listFactories()
      .then(list => setFactories((list || []).filter(f => f.status === 'ACTIVE')))
      .catch(() => setFactories([]));
  }, [isOwner]);

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (w) => { setEditing(w); setFormOpen(true); };

  const confirmActive = async () => {
    if (!activeConfirm) return;
    setSaving(true);
    try {
      await adminWarehouseApi.setActive(activeConfirm.id, !activeConfirm.active);
      setActiveConfirm(null);
      load();
    } catch (e) { alert(e?.response?.data?.message || e.message); } finally { setSaving(false); }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5">
      <PageHeader
        icon={WarehouseIcon}
        {...{ title: t("warehouse", "warehouses") }}
        subtitle={t('admin', 'warehouse_count').replace('{n}', items.length)}
        action={<PrimaryButton onClick={openCreate}><Plus size={15} />{t('warehouse', 'create_warehouse_new')}</PrimaryButton>}
      />

      {loading ? (
        <TableSkeleton cols={4} rows={6} />
      ) : items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-black/5 shadow-sm">
          <EmptyState icon={WarehouseIcon} title="Chưa có kho" description="Tạo kho đầu tiên để bắt đầu quản lý nguyên liệu" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((w) => (
            <div key={w.id}
              className={`bg-white rounded-2xl border border-black/5 shadow-sm p-5 hover:shadow-md transition-shadow cursor-pointer ${!w.active ? 'opacity-60' : ''}`}
              onClick={() => navigate(`${rolePrefix}/warehouses/${w.id}/stock`)}>
              <div className="flex items-start justify-between gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ring-1 ${w.type === 'TRANSIT' ? 'bg-blue-50 text-blue-600 ring-blue-200' : 'bg-[#C9A84C]/10 text-[#C9A84C] ring-[#C9A84C]/20'}`}>
                  {w.type === 'TRANSIT' ? <Truck size={22} /> : <Store size={22} />}
                </div>
                <Badge className={w.active ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-slate-50 text-slate-600 ring-slate-200'}>
                  {w.active ? t('status', 'active') : t('common', 'close')}
                </Badge>
              </div>

              <h3 className="font-bold text-[#1C1C1E] text-lg mt-3 truncate">{w.name}</h3>
              <p className="text-xs text-[#8E8878] mt-0.5 truncate">{w.address || t('common', 'no_data')}</p>

              <div className="flex items-center gap-1.5 mt-3">
                <Badge className={w.type === 'TRANSIT' ? 'bg-blue-50 text-blue-700 ring-blue-200' : 'bg-amber-50 text-amber-700 ring-amber-200'}>
                  {w.type === 'TRANSIT' ? 'Trung chuyển' : 'Bán hàng'}
                </Badge>
                {typeof w.ingredientCount === 'number' && (
                  <Badge className="bg-slate-50 text-slate-700 ring-slate-200">
                    <Package size={10} /> {w.ingredientCount} NL
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-black/5">
                <button onClick={e => { e.stopPropagation(); openEdit(w); }} className="flex-1 py-2 rounded-xl text-xs font-medium bg-[#FAF7F2] text-[#1C1C1E] hover:bg-[#C9A84C]/10 hover:text-[#C9A84C] transition-colors flex items-center justify-center gap-1.5">
                  <Edit2 size={13} /> Sửa
                </button>
                <button
                  onClick={e => { e.stopPropagation(); setActiveConfirm(w); }}
                  className={`flex-1 py-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${w.active ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}
                >
                  <Power size={13} /> {w.active ? 'Đóng kho' : 'Mở kho'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── KHO XƯỞNG (chỉ OWNER) ── */}
      {isOwner && factories.length > 0 && (
        <div className="space-y-3 pt-2">
          {factories.map(f => (
            <div key={f.id}>
              <p className="text-xs font-semibold text-[#8E8878] mb-2 flex items-center gap-1.5">
                <Factory size={13} className="text-[#C9A84C]" /> {f.name}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-2">
                <FactoryStockCard factory={f} kind="material" icon={Package}
                  title="Kho nguyên liệu xưởng" color="amber"
                  onClick={() => navigate(`${rolePrefix}/factory-stock?factoryId=${f.id}&kind=material`)} />
                <FactoryStockCard factory={f} kind="semi" icon={Boxes}
                  title="Kho bán thành phẩm" color="blue"
                  onClick={() => navigate(`${rolePrefix}/factory-stock?factoryId=${f.id}&kind=semi`)} />
                <FactoryStockCard factory={f} kind="finished" icon={PackageOpen}
                  title="Kho thành phẩm (kho xưởng)" color="green"
                  onClick={() => navigate(`${rolePrefix}/factory-stock?factoryId=${f.id}&kind=finished`)} />
              </div>
            </div>
          ))}
        </div>
      )}
      <WarehouseFormModal open={formOpen} editing={editing} onClose={() => setFormOpen(false)} onSaved={() => { setFormOpen(false); load(); }} />

      <Modal
        open={!!activeConfirm}
        onClose={() => !saving && setActiveConfirm(null)}
        title={activeConfirm?.active ? 'Đóng kho' : 'Mở kho'}
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <SecondaryButton onClick={() => setActiveConfirm(null)} disabled={saving}>Hủy</SecondaryButton>
            {activeConfirm?.active
              ? <DangerButton onClick={confirmActive} loading={saving}>Xác nhận đóng</DangerButton>
              : <PrimaryButton onClick={confirmActive} loading={saving}>Xác nhận mở</PrimaryButton>
            }
          </div>
        }
      >
        <p className="text-sm text-[#1C1C1E]">
          Bạn có chắc muốn {activeConfirm?.active ? 'đóng' : 'mở'} kho <span className="font-semibold">{activeConfirm?.name}</span>?
        </p>
      </Modal>
    </div>
  );
}

function WarehouseFormModal({ open, editing, onClose, onSaved }) {
  const { t } = useLang();
  const [form, setForm] = useState(() => ({
    name: editing?.name || '',
    address: editing?.address || '',
    type: editing?.type || 'SALE',
    active: editing?.active ?? true,
  }));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    setErr('');
    if (!form.name.trim()) { setErr('Tên kho bắt buộc'); return; }
    setSaving(true);
    try {
      if (editing) {
        await adminWarehouseApi.update(editing.id, form);
      } else {
        await adminWarehouseApi.create(form);
      }
      onSaved();
    } catch (e) { setErr(e?.response?.data?.message || e.message); } finally { setSaving(false); }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `Sửa kho: ${editing.name}` : 'Tạo kho mới'}
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose} disabled={saving}>Hủy</SecondaryButton>
          <PrimaryButton onClick={submit} loading={saving}>{editing ? 'Cập nhật' : 'Tạo kho'}</PrimaryButton>
        </div>
      }
    >
      <div className="space-y-3">
        {err && <div className="bg-red-50 text-red-700 text-sm p-3 rounded-xl">{err}</div>}
        {!editing && (
          <div className="bg-[#C9A84C]/10 border border-[#C9A84C]/30 text-[#1C1C1E] text-xs p-3 rounded-xl">
            💡 Khi tạo kho mới, hệ thống sẽ <strong>tự động thêm tất cả nguyên liệu hiện có</strong> vào kho với số lượng 0.
          </div>
        )}

        <Field label="Tên kho" required>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} placeholder="VD: Kho trung tâm Q1" />
        </Field>

        <Field label="Địa chỉ">
          <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className={inputCls} placeholder="VD: 123 Nguyễn Huệ, Q1, TPHCM" />
        </Field>

        <Field label="Loại kho" required>
          <div className="grid grid-cols-2 gap-2">
            <TypeCard
              selected={form.type === 'SALE'}
              onClick={() => setForm({ ...form, type: 'SALE' })}
              icon={Store}
              title="Bán hàng"
              desc="Nhập, xuất bán, chuyển, điều chỉnh"
              color="gold"
            />
            <TypeCard
              selected={form.type === 'TRANSIT'}
              onClick={() => setForm({ ...form, type: 'TRANSIT' })}
              icon={Truck}
              title="Trung chuyển"
              desc="Chỉ nhập & chuyển, không xuất bán"
              color="blue"
            />
          </div>
        </Field>

        <Field label="Trạng thái">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setForm({ ...form, active: !form.active })}
              className={`relative w-11 h-6 rounded-full transition-colors ${form.active ? 'bg-[#C9A84C]' : 'bg-slate-300'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${form.active ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
            <span className="text-sm text-[#1C1C1E]">{form.active ? t('status', 'active') : t('common', 'close')}</span>
          </div>
        </Field>
      </div>
    </Modal>
  );
}

function FactoryStockCard({ title, icon: Icon, color, onClick }) {
  const colorMap = {
    amber: 'bg-[#C9A84C]/10 text-[#C9A84C] ring-[#C9A84C]/20',
    blue: 'bg-blue-50 text-blue-600 ring-blue-200',
    green: 'bg-emerald-50 text-emerald-600 ring-emerald-200',
  };
  return (
    <div onClick={onClick}
      className="bg-white rounded-2xl border border-black/5 shadow-sm p-5 hover:shadow-md transition-shadow cursor-pointer">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ring-1 ${colorMap[color]}`}>
        <Icon size={22} />
      </div>
      <h3 className="font-bold text-[#1C1C1E] text-base mt-3">{title}</h3>
      <p className="text-xs text-[#8E8878] mt-1">Nhấn để xem tồn kho</p>
    </div>
  );
}

function TypeCard({ selected, onClick, icon: Icon, title, desc, color }) {
  const sel = color === 'gold' ? 'border-[#C9A84C] bg-[#C9A84C]/10 text-[#C9A84C]' : 'border-blue-500 bg-blue-50 text-blue-600';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left border-2 rounded-xl p-3 transition-colors ${selected ? sel : 'border-black/10 hover:bg-[#FAF7F2]'}`}
    >
      <Icon size={18} className={selected ? '' : 'text-[#8E8878]'} />
      <p className={`font-semibold text-sm mt-1.5 ${selected ? '' : 'text-[#1C1C1E]'}`}>{title}</p>
      <p className="text-xs text-[#8E8878] mt-0.5">{desc}</p>
    </button>
  );
}
