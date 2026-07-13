// src/pages/owner/OwnerMaterialStockPage.jsx
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, AlertTriangle, Search, ArrowDownAZ, ArrowUpZA, CalendarClock, ChevronLeft, ChevronDown, ChevronRight, Plus, BarChart3, Layers, Receipt } from 'lucide-react';
import { PageHeader, EmptyState, PrimaryButton, SecondaryButton, Field, inputCls } from '../../components/ui';
import { CardSkeleton } from '../../components/ui/Skeleton.jsx';
import Modal from '../../components/ui/Modal';
import DateRangePicker from '../../components/ui/DateRangePicker';
import { ownerMaterialStockApi } from '../../api/materialRequestApi.js';
import { factoryMaterialApi, factoryMaterialCategoryApi } from '../../api/productionApi';
import { ownerProdApi } from '../../api/productionModuleApi';
import { useToast } from '../../components/common/Toast.jsx';
import { useLang } from '../../context/LangContext';
import { useFmt } from '../../utils/useFmt';

const STORAGE_UNITS = ['Kg', 'Gr', 'Lít', 'Ml', 'Túi', 'Hộp', 'Bịch', 'Thùng', 'Chai', 'Lon', 'Can', 'Khay'];
const ORDER_UNITS = ['Chai', 'Can', 'Hộp', 'Túi', 'Khay', 'Kg', 'Gr', 'Lít', 'Ml', 'Thùng', 'Bịch', 'Lon'];

// fmtQty/fmtDate removed — use useFmt()
function daysLeft(ms) {
  if (!ms) return null;
  return Math.ceil((ms - Date.now()) / 86400000);
}

// Hạn dùng gần nhất của 1 nguyên liệu (dùng để sort theo "lô hết hạn")
// — null (không có HSD) coi như xa nhất.
function nearestExpiry(item) {
  const dates = (item.lots || []).map(l => l.expiryDate).filter(Boolean);
  if (dates.length === 0) return null;
  return Math.min(...dates);
}

const getNameSorts = (t) => ({
  az: { label: t('production','mstock_sort_az'), icon: ArrowDownAZ },
  za: { label: t('production','mstock_sort_za'), icon: ArrowUpZA },
});
const getExpirySorts = (t) => ({
  near: { label: t('production','mstock_sort_near'), icon: CalendarClock },
  far:  { label: t('production','mstock_sort_far'),  icon: CalendarClock },
});

function MaterialDetail({ item, onBack }) {
  const { t } = useLang();
  const { fmtNum, fmtDate } = useFmt();
  const fmtQty = v => fmtNum(v,3);
  const [search, setSearch] = useState('');            // tìm gần đúng theo mã phiếu đặt hàng
  const [range, setRange] = useState({ from: null, to: null }); // lọc theo ngày đặt hàng

  const allLots = item.lots || [];

  const visibleLots = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = allLots.filter(lot => {
      // Lọc theo mã phiếu (keyword gần đúng)
      if (q) {
        const code = (lot.materialRequestCode || '').toLowerCase();
        if (!code.includes(q)) return false;
      }
      // Lọc theo ngày tạo phiếu đặt hàng (orderedAt) trong khoảng đã chọn
      if (range.from != null || range.to != null) {
        const at = lot.orderedAt;
        if (at == null) return false;
        if (range.from != null && at < range.from) return false;
        if (range.to != null && at > range.to) return false;
      }
      return true;
    });
    // gần hết hạn nhất lên đầu; lô không có HSD xuống cuối
    return [...list].sort((a, b) => {
      if (!a.expiryDate && !b.expiryDate) return 0;
      if (!a.expiryDate) return 1;
      if (!b.expiryDate) return -1;
      return a.expiryDate - b.expiryDate;
    });
  }, [allLots, search, range]);

  const filtering = !!search.trim() || range.from != null || range.to != null;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-[#8E8878] hover:text-[#1C1C1E] font-medium">
        <ChevronLeft size={16} /> Quay lại danh sách tồn kho
      </button>

      <PageHeader icon={Package} title={item.materialName}
        subtitle={t('production','mstock_detail_subtitle',{qty:fmtQty(item.totalQty),unit:item.unit,n:allLots.length})} />

      {/* Bộ lọc: tìm theo mã phiếu (gần đúng) + lọc theo ngày đặt hàng */}
      <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8878]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('production','mstock_search_request_ph')}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-[#E8DDD0] focus:outline-none focus:border-[#C9A84C] bg-[#FAF7F2] placeholder-[#8E8878]"
          />
        </div>
        <DateRangePicker
          from={range.from}
          to={range.to}
          onChange={setRange}
          placeholder={t('production','mstock_order_date')}
        />
      </div>

      <div className="bg-white rounded-2xl border border-black/5 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-black/5 bg-[#FAF7F2] flex items-center justify-between gap-2">
          <h3 className="text-xs font-semibold text-[#8E8878] uppercase tracking-wider">
            Chi tiết các lô — sắp xếp gần hết hạn nhất trước
          </h3>
          <span className="text-xs text-[#8E8878]">
            {filtering ? t('production','mstock_lots_filtered',{shown:visibleLots.length,total:allLots.length}) : t('production','inv_lot_count',{n:allLots.length})}
          </span>
        </div>
        {visibleLots.length === 0 ? (
          <div className="px-5 py-10">
            <EmptyState icon={Package}
              title={filtering ? t('production','mstock_no_lot_match') : t('production','mstock_no_lot')}
              description={filtering ? t('production','mstock_try_other_filter') : undefined} />
          </div>
        ) : (
          <div className="divide-y divide-black/5">
            {visibleLots.map((lot, i) => {
              const days = daysLeft(lot.expiryDate);
              return (
                <div key={lot.id || i} className={`flex items-start justify-between px-5 py-3.5 gap-3 ${lot.nearExpiry ? 'bg-amber-50' : ''}`}>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#1C1C1E]">{fmtQty(lot.quantity)} {item.unit}</p>
                    <p className="text-xs text-[#8E8878]">{t('production','mstock_initial')}: {fmtQty(lot.initialQuantity)} {item.unit}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                      {lot.materialRequestCode && (
                        <span className="inline-flex items-center gap-1 text-xs text-[#8E8878]">
                          <Receipt size={12} className="text-[#C9A84C]" />
                          <span className="font-mono text-[#C9A84C]">{lot.materialRequestCode}</span>
                        </span>
                      )}
                      {lot.orderedAt && (
                        <span className="inline-flex items-center gap-1 text-xs text-[#8E8878]">
                          <CalendarClock size={12} />
                          Đặt: {fmtDate(lot.orderedAt)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {lot.expiryDate ? (
                      <>
                        <p className={`text-sm font-medium ${lot.nearExpiry ? 'text-amber-700' : 'text-[#1C1C1E]'}`}>
                          HSD: {fmtDate(lot.expiryDate)}
                        </p>
                        {days != null && (
                          <p className={`text-xs ${days <= 7 ? 'text-red-600 font-semibold' : days <= 30 ? 'text-amber-600' : 'text-[#8E8878]'}`}>
                            {days >= 0 ? t('production','inv_days_left',{n:days}) : t('production','mstock_overdue_days',{n:-days})}
                          </p>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-[#8E8878]">{t('production','inv_no_expiry')}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tạo / Sửa nguyên liệu xưởng ─────────────────────────────────────────────
function CreateMaterialModal({ onClose, onCreated, editData }) {
  const toast = useToast();
  const { t } = useLang();
  const isEdit = !!editData;

  const [form, setForm] = useState(() => editData ? {
    name: editData.name || '',
    unit: editData.unit || 'Kg',
    orderUnit: editData.orderUnit || '',
    conversionRatio: editData.conversionRatio ?? '',
    shelfLifeDays: editData.shelfLifeDays ?? '',
    supplierLeadDays: editData.supplierLeadDays ?? '',
    storageCondition: editData.storageCondition || '',
    description: editData.description || '',
    subCategoryId: editData.subCategoryId || '',
    factoryIds: editData.factoryIds || [],
  } : {
    name: '', unit: 'Kg', orderUnit: '', conversionRatio: '',
    shelfLifeDays: '', supplierLeadDays: '', storageCondition: '',
    description: '', subCategoryId: '', factoryIds: [],
  });

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [categories, setCategories] = useState([]);
  const [factories, setFactories] = useState([]);
  const [newCatName, setNewCatName] = useState('');
  const [newSubName, setNewSubName] = useState('');
  const [addingCat, setAddingCat] = useState(false);
  const [addingSub, setAddingSub] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    factoryMaterialCategoryApi.list().then(setCategories).catch(() => {});
    ownerProdApi.listFactories().then(list => {
      setFactories(list || []);
      // Khi TẠO mới: mặc định chọn tất cả xưởng ACTIVE
      if (!isEdit && list?.length) {
        setForm(f => f.factoryIds.length ? f : { ...f, factoryIds: list.filter(x => x.status === 'ACTIVE').map(x => x.id) });
      }
    }).catch(() => {});
  }, []);

  // Danh mục chung đang chọn (để hiển thị danh mục riêng trực thuộc)
  const selectedCatId = useMemo(() => {
    if (!form.subCategoryId) return null;
    for (const c of categories) {
      if ((c.subCategories || []).some(s => s.id === Number(form.subCategoryId))) return c.id;
    }
    return null;
  }, [form.subCategoryId, categories]);

  const [tempCatId, setTempCatId] = useState(selectedCatId || '');
  useEffect(() => { if (selectedCatId) setTempCatId(selectedCatId); }, [selectedCatId]);

  const subCats = useMemo(() => {
    if (!tempCatId) return [];
    const c = categories.find(c => c.id === Number(tempCatId));
    return c?.subCategories || [];
  }, [tempCatId, categories]);

  const handleCreateCat = async () => {
    if (!newCatName.trim()) return;
    setAddingCat(true);
    try {
      const created = await factoryMaterialCategoryApi.createCategory({ name: newCatName.trim() });
      setCategories(prev => [...prev, { ...created, subCategories: [] }]);
      setTempCatId(created.id);
      setNewCatName('');
      toast(t('production','mstock_toast_cat_created',{name:created.name}), 'success');
    } catch (e) { setErr(e?.response?.data?.message || t('production','mstock_err_cat')); }
    finally { setAddingCat(false); }
  };

  const handleCreateSub = async () => {
    if (!newSubName.trim() || !tempCatId) return;
    setAddingSub(true);
    try {
      const created = await factoryMaterialCategoryApi.createSubCategory({ name: newSubName.trim(), categoryId: Number(tempCatId) });
      setCategories(prev => prev.map(c => c.id === Number(tempCatId) ? { ...c, subCategories: [...(c.subCategories || []), created] } : c));
      set('subCategoryId', created.id);
      setNewSubName('');
      toast(t('production','mstock_toast_subcat_created',{name:created.name}), 'success');
    } catch (e) { setErr(e?.response?.data?.message || t('production','mstock_err_subcat')); }
    finally { setAddingSub(false); }
  };

  const toggleFactory = (fId) => {
    setForm(f => {
      const ids = f.factoryIds.includes(fId) ? f.factoryIds.filter(x => x !== fId) : [...f.factoryIds, fId];
      return { ...f, factoryIds: ids };
    });
  };

  const submit = async () => {
    if (!form.name.trim()) { setErr(t('production','mstock_err_name')); return; }
    if (!form.unit) { setErr(t('production','mstock_err_unit')); return; }
    if (!form.subCategoryId) { setErr(t('production','mstock_err_category')); return; }
    if (form.shelfLifeDays !== '' && (isNaN(form.shelfLifeDays) || Number(form.shelfLifeDays) <= 0 || !Number.isInteger(Number(form.shelfLifeDays)))) {
      setErr(t('production','mstock_err_shelf_life')); return;
    }
    if (form.supplierLeadDays !== '' && (isNaN(form.supplierLeadDays) || Number(form.supplierLeadDays) <= 0 || !Number.isInteger(Number(form.supplierLeadDays)))) {
      setErr(t('production','mstock_err_lead_days')); return;
    }
    const orderUnit = form.orderUnit || null;
    const ratio = form.conversionRatio !== '' ? Number(form.conversionRatio) : null;
    if (orderUnit && orderUnit !== form.unit && (!ratio || ratio <= 0)) {
      setErr(t('production','mstock_err_ratio')); return;
    }
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        unit: form.unit,
        orderUnit,
        conversionRatio: ratio,
        shelfLifeDays: form.shelfLifeDays !== '' ? Number(form.shelfLifeDays) : null,
        supplierLeadDays: form.supplierLeadDays !== '' ? Number(form.supplierLeadDays) : null,
        storageCondition: form.storageCondition.trim() || null,
        description: form.description.trim() || null,
        subCategoryId: Number(form.subCategoryId),
        factoryIds: form.factoryIds,
      };
      const result = isEdit
        ? await factoryMaterialApi.update(editData.id, body)
        : await factoryMaterialApi.create(body);
      toast(t('production', isEdit?'mstock_toast_updated':'mstock_toast_created',{name:result?.name||form.name}), 'success');
      onCreated(result);
    } catch (e) {
      setErr(e?.response?.data?.message || t('error','generic'));
    } finally { setSaving(false); }
  };

  return (
    <Modal open title={isEdit ? t('production','mstock_edit_title') : t('production','mstock_create_title')} onClose={onClose} size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose}>{t('common','cancel')}</SecondaryButton>
          <PrimaryButton onClick={submit} loading={saving}>{isEdit ? t('common','save') : t('production','mstock_create_btn')}</PrimaryButton>
        </div>
      }>
      <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
        {err && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{err}</p>}

        {/* Tên */}
        <Field label={t('production','mstock_field_name')} required>
          <input className={inputCls} value={form.name} onChange={e => set('name', e.target.value)} placeholder={t('production','mstock_ph_name')} autoFocus />
        </Field>

        {/* Danh mục chung → riêng */}
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('production','mstock_field_category')} required>
            <select className={inputCls} value={tempCatId} onChange={e => { setTempCatId(e.target.value); set('subCategoryId', ''); }}>
              <option value="">{t('production','mstock_select_ph')}</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div className="flex gap-1.5 mt-1.5">
              <input className={`${inputCls} flex-1 !py-1.5 !text-xs`} placeholder={t('production','mstock_ph_new_cat')} value={newCatName} onChange={e => setNewCatName(e.target.value)} />
              <PrimaryButton onClick={handleCreateCat} loading={addingCat} className="!py-1.5 !px-2.5 !text-xs">+</PrimaryButton>
            </div>
          </Field>
          <Field label={t('production','mstock_field_subcategory')} required>
            <select className={inputCls} value={form.subCategoryId} onChange={e => set('subCategoryId', e.target.value)} disabled={!tempCatId}>
              <option value="">{t('production','mstock_select_ph')}</option>
              {subCats.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {tempCatId && (
              <div className="flex gap-1.5 mt-1.5">
                <input className={`${inputCls} flex-1 !py-1.5 !text-xs`} placeholder={t('production','mstock_ph_new_subcat')} value={newSubName} onChange={e => setNewSubName(e.target.value)} />
                <PrimaryButton onClick={handleCreateSub} loading={addingSub} className="!py-1.5 !px-2.5 !text-xs">+</PrimaryButton>
              </div>
            )}
          </Field>
        </div>

        {/* Đơn vị lưu kho + Đặt hàng + Tỷ lệ quy đổi */}
        <div className="grid grid-cols-3 gap-3">
          <Field label={t('production','mstock_field_storage_unit')} required>
            <select className={inputCls} value={form.unit} onChange={e => set('unit', e.target.value)}>
              {STORAGE_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </Field>
          <Field label={t('production','mstock_field_order_unit')} hint={t('common','optional')}>
            <select className={inputCls} value={form.orderUnit} onChange={e => set('orderUnit', e.target.value)}>
              <option value="">{t('production','mstock_none')}</option>
              {ORDER_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </Field>
          <Field label={t('production','mstock_field_ratio')} hint={form.orderUnit && form.orderUnit !== form.unit ? `1 ${form.orderUnit} = ? ${form.unit}` : ''}>
            <input type="number" min="0" step="any" className={inputCls}
              value={form.conversionRatio}
              onChange={e => set('conversionRatio', e.target.value)}
              disabled={!form.orderUnit || form.orderUnit === form.unit}
              placeholder="VD: 10" />
          </Field>
        </div>

        {/* HSD + Số ngày NCC giao */}
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('production','mstock_field_shelf_life')} hint={t('production','mstock_hint_integer')}>
            <input type="number" min="1" step="1" className={inputCls}
              value={form.shelfLifeDays} onChange={e => set('shelfLifeDays', e.target.value)} placeholder="VD: 30" />
          </Field>
          <Field label={t('production','mstock_field_lead_days')} hint={t('production','mstock_hint_integer')}>
            <input type="number" min="1" step="1" className={inputCls}
              value={form.supplierLeadDays} onChange={e => set('supplierLeadDays', e.target.value)} placeholder="VD: 3" />
          </Field>
        </div>

        {/* Điều kiện bảo quản */}
        <Field label={t('production','mstock_field_storage_cond')}>
          <textarea className={inputCls} rows={2} value={form.storageCondition} onChange={e => set('storageCondition', e.target.value)}
            placeholder={t('production','mstock_ph_storage_cond')} />
        </Field>

        {/* Mô tả */}
        <Field label={t('production','omach_field_desc')}>
          <textarea className={inputCls} rows={2} value={form.description} onChange={e => set('description', e.target.value)} />
        </Field>

        {/* Chọn xưởng có nguyên liệu */}
        {factories.length > 0 && (
          <Field label={t('production','mstock_field_factories')} hint={t('production','mstock_hint_factories')}>
            <div className="flex flex-wrap gap-2 mt-1">
              {factories.filter(f => f.status === 'ACTIVE').map(f => {
                const checked = form.factoryIds.includes(f.id);
                return (
                  <label key={f.id}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border cursor-pointer transition-all select-none ${checked ? 'bg-[#1A2B1A] text-white border-[#1A2B1A]' : 'bg-white text-[#8E8878] border-[#E8DDD0] hover:border-[#1A2B1A]'}`}>
                    <input type="checkbox" className="hidden" checked={checked} onChange={() => toggleFactory(f.id)} />
                    {f.name}
                  </label>
                );
              })}
            </div>
          </Field>
        )}
      </div>
    </Modal>
  );
}

export default function OwnerMaterialStockPage() {
  const { t } = useLang();
  const { fmtNum, fmtDate } = useFmt();
  const fmtQty = v => fmtNum(v,3);
  const navigate = useNavigate();
  const NAME_SORTS = useMemo(() => getNameSorts(t), [t]);
  const EXPIRY_SORTS = useMemo(() => getExpirySorts(t), [t]);
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [nameSort, setNameSort] = useState(null);
  const [expirySort, setExpirySort] = useState(null);
  const [selected, setSelected] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Xưởng
  const [factories, setFactories] = useState([]);
  const [factoryId, setFactoryId] = useState(null); // null = tất cả

  // Collapse state: { "catName": true/false, "catName||subName": true/false }
  const [collapsed, setCollapsed] = useState({});

  useEffect(() => {
    ownerProdApi.listFactories().then(list => {
      const active = (list || []).filter(f => f.status === 'ACTIVE');
      setFactories(active);
      // Mặc định chọn xưởng đầu tiên nếu có
      if (active.length > 0) setFactoryId(active[0].id);
    }).catch(() => {});
  }, []);

  const reload = useCallback(() => {
    setLoading(true);
    ownerMaterialStockApi.getStock(factoryId)
      .then(d => setStocks(d || []))
      .finally(() => setLoading(false));
  }, [factoryId]);

  useEffect(() => { reload(); }, [reload]);

  // Lọc + sort
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let list = stocks.filter(s => !q || s.materialName.toLowerCase().includes(q));
    if (expirySort) {
      list = [...list].sort((a, b) => {
        const ea = nearestExpiry(a), eb = nearestExpiry(b);
        if (ea == null && eb == null) return 0;
        if (ea == null) return 1;
        if (eb == null) return -1;
        return expirySort === 'near' ? ea - eb : eb - ea;
      });
    } else if (nameSort) {
      list = [...list].sort((a, b) =>
        nameSort === 'az'
          ? a.materialName.localeCompare(b.materialName, 'vi')
          : b.materialName.localeCompare(a.materialName, 'vi'));
    }
    return list;
  }, [stocks, search, nameSort, expirySort]);

  // Group theo danh mục chung → riêng
  const grouped = useMemo(() => {
    const map = new Map(); // catName → Map(subName → items[])
    for (const item of filtered) {
      const cat = item.categoryName || t('production','mstock_uncategorized');
      const sub = item.subCategoryName || t('production','mstock_general');
      if (!map.has(cat)) map.set(cat, new Map());
      const subMap = map.get(cat);
      if (!subMap.has(sub)) subMap.set(sub, []);
      subMap.get(sub).push(item);
    }
    return map;
  }, [filtered]);

  // Search auto-expand: khi có search keyword, expand tất cả category chứa kết quả
  const effectiveCollapsed = useMemo(() => {
    if (!search.trim()) return collapsed;
    const result = { ...collapsed };
    for (const [cat, subMap] of grouped) {
      result[cat] = false; // expand danh mục chung
      for (const sub of subMap.keys()) {
        result[`${cat}||${sub}`] = false; // expand danh mục riêng
      }
    }
    return result;
  }, [collapsed, search, grouped]);

  const toggleCat = (key) => setCollapsed(c => ({ ...c, [key]: !c[key] }));

  const nearExpiryCount = stocks.reduce((acc, s) => acc + (s.lots || []).filter(l => l.nearExpiry).length, 0);

  if (selected) {
    const fresh = stocks.find(s => s.materialName === selected.materialName && s.unit === selected.unit) || selected;
    return <MaterialDetail item={fresh} onBack={() => setSelected(null)} />;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5">
      <button onClick={() => navigate('/owner/production')}
        className="flex items-center gap-1.5 text-sm text-[#8E8878] hover:text-[#1C1C1E] font-medium">
        <ChevronLeft size={16} /> {t('production','loss_back_to_production')}
      </button>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <PageHeader icon={Package} title={t('production','mstock_title')}
          subtitle={t('production','mstock_subtitle',{n:stocks.length})+(factoryId?` · ${factories.find(f=>f.id===factoryId)?.name||''}`:'') }
          action={
            <PrimaryButton onClick={() => setShowCreateModal(true)}>
              <Plus size={15} /> {t('production','mstock_create_btn')}
            </PrimaryButton>
          } />
      </div>

      {/* Dropdown đổi kho */}
      {factories.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#8E8878] font-medium">{t('production','mstock_factory_label')}:</span>
          <select
            className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-[#E8DDD0] bg-white text-[#1C1C1E] focus:outline-none focus:border-[#C9A84C]"
            value={factoryId || ''}
            onChange={e => setFactoryId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">{t('production','oinv_all_warehouses')}</option>
            {factories.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-4">
          <p className="text-xs text-[#8E8878]">{t('production','inv_material_types')}</p>
          <p className="text-2xl font-bold text-[#1A2B1A] mt-1">{stocks.length}</p>
        </div>
        <div className={`rounded-2xl border shadow-sm p-4 ${nearExpiryCount > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-black/5'}`}>
          <p className="text-xs text-[#8E8878]">{t('production','inv_near_expiry_lots')}</p>
          <p className={`text-2xl font-bold mt-1 ${nearExpiryCount > 0 ? 'text-amber-700' : 'text-[#1A2B1A]'}`}>{nearExpiryCount}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-4 space-y-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8878]" />
          <input
            className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-[#E8DDD0] focus:outline-none focus:border-[#C9A84C] bg-[#FAF7F2] placeholder-[#8E8878]"
            placeholder={t('production','oinv_search_ph')}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-[#8E8878] font-medium">{t('production','mstock_sort_name')}:</span>
          {Object.entries(NAME_SORTS).map(([key, cfg]) => (
            <button key={key}
              onClick={() => { setNameSort(s => s === key ? null : key); setExpirySort(null); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${nameSort === key ? 'bg-[#1A2B1A] text-white border-[#1A2B1A]' : 'bg-white text-[#8E8878] border-[#E8DDD0] hover:border-[#1A2B1A]'}`}>
              <cfg.icon size={12} />{cfg.label}
            </button>
          ))}
          <span className="text-xs text-[#8E8878] font-medium ml-2">{t('production','mstock_sort_expiry')}:</span>
          {Object.entries(EXPIRY_SORTS).map(([key, cfg]) => (
            <button key={key}
              onClick={() => { setExpirySort(s => s === key ? null : key); setNameSort(null); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${expirySort === key ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-[#8E8878] border-[#E8DDD0] hover:border-amber-600'}`}>
              <cfg.icon size={12} />{cfg.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <CardSkeleton key={i} />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Package} title={t('production','mstock_not_found')} />
      ) : (
        <div className="space-y-4">
          {[...grouped.entries()].map(([catName, subMap]) => {
            const catCollapsed = effectiveCollapsed[catName];
            return (
              <div key={catName} className="rounded-2xl border border-black/5 bg-white overflow-hidden">
                {/* Danh mục chung header */}
                <button onClick={() => toggleCat(catName)}
                  className="w-full flex items-center gap-2 px-4 py-3 bg-[#FAF7F2] hover:bg-[#F0EBE3] transition-colors text-left">
                  {catCollapsed ? <ChevronRight size={14} className="text-[#8E8878]" /> : <ChevronDown size={14} className="text-[#8E8878]" />}
                  <span className="text-sm font-bold text-[#1C1C1E]">{catName}</span>
                  <span className="text-[11px] text-[#8E8878] ml-auto">
                    {[...subMap.values()].reduce((a, arr) => a + arr.length, 0)} nguyên liệu
                  </span>
                </button>

                {!catCollapsed && (
                  <div className="divide-y divide-black/5">
                    {[...subMap.entries()].map(([subName, items]) => {
                      const subKey = `${catName}||${subName}`;
                      const subCollapsed = effectiveCollapsed[subKey];
                      return (
                        <div key={subKey}>
                          {/* Danh mục riêng header */}
                          <button onClick={() => toggleCat(subKey)}
                            className="w-full flex items-center gap-2 px-6 py-2.5 hover:bg-[#FAF7F2]/60 transition-colors text-left">
                            {subCollapsed ? <ChevronRight size={12} className="text-[#C9A84C]" /> : <ChevronDown size={12} className="text-[#C9A84C]" />}
                            <span className="text-xs font-semibold text-[#C9A84C]">{subName}</span>
                            <span className="text-[10px] text-[#8E8878] ml-auto">{items.length}</span>
                          </button>

                          {!subCollapsed && (
                            <div className="space-y-2 px-4 pb-3">
                              {items.map((item, i) => (
                                <MaterialCard key={i} item={item} navigate={navigate} onSelectLot={() => setSelected(item)} />
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showCreateModal && (
        <CreateMaterialModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => { setShowCreateModal(false); reload(); }}
        />
      )}
    </div>
  );
}

// ── Card nguyên liệu (extracted for readability) ─────────────────────────────
function MaterialCard({ item, navigate, onSelectLot }) {
  const { t } = useLang();
  const { fmtNum, fmtDate } = useFmt();
  const fmtQty = v => fmtNum(v,3);
  const nearExpiryLots = (item.lots || []).filter(l => l.nearExpiry);
  const hasWarning = nearExpiryLots.length > 0;
  const nearest = nearestExpiry(item);

  return (
    <div className={`w-full text-left rounded-xl border shadow-sm p-3.5 ${hasWarning ? 'bg-amber-50 border-amber-200' : 'bg-white border-black/5'}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[#1C1C1E] text-sm">{item.materialName}</span>
            {hasWarning && (
              <span className="flex items-center gap-1 text-[10px] text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full font-medium">
                <AlertTriangle size={9} /> {nearExpiryLots.length}
              </span>
            )}
          </div>
          <p className="text-xl font-bold text-[#1A2B1A] mt-0.5">
            {fmtQty(item.totalQty)}
            <span className="text-[10px] text-[#8E8878] bg-[#F5F0EB] px-1.5 py-0.5 rounded-full ml-1">{item.unit}</span>
          </p>
          {nearest && <p className="text-[10px] text-[#8E8878] mt-0.5">{t('production','fg_newest_lot')}: {fmtDate(nearest)}</p>}
        </div>
        <span className="text-[10px] text-[#8E8878] flex-shrink-0">{item.lots?.length || 0} lô</span>
      </div>
      <div className="flex items-center gap-2 mt-2.5 pt-2.5 border-t border-black/5">
        <button
          onClick={() => navigate(`/owner/production/material-price-analysis?name=${encodeURIComponent(item.materialName)}`)}
          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold border border-[#E8DDD0] text-[#8E6C1F] bg-[#FDF8EC] hover:border-[#C9A84C] hover:bg-[#FBF1D8] transition-all">
          <BarChart3 size={12} /> Phân tích giá
        </button>
        <button
          onClick={onSelectLot}
          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold border border-[#E8DDD0] text-[#1A2B1A] bg-white hover:border-[#1A2B1A] hover:bg-[#F5F0EB] transition-all">
          <Layers size={12} /> Chi tiết lô
        </button>
      </div>
    </div>
  );
}
