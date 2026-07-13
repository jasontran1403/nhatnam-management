// src/pages/owner/OwnerInventoryPage.jsx
// Tồn kho nguyên liệu theo kỳ (đầu kỳ · phát sinh · cuối kỳ) — ADMIN & OWNER.
// Nhóm theo Danh mục → Danh mục con, chọn kho (Tất cả / từng kho), collapse/expand.
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { inventoryFlowApi } from '../../api/services';
import { useToast } from '../../components/common/Toast';
import DateRangePicker, { presetToRange } from '../../components/ui/DateRangePicker';
import {
  Package, Warehouse, Search, RefreshCw, ChevronDown, ChevronRight,
  ClipboardCheck, X, Filter, Layers
} from 'lucide-react';
import { useLang } from '../../context/LangContext';
import { useFmt } from '../../utils/useFmt';

const NO_CAT = '__none__';

const getPresets = (t) => [
  { key: 'today', label: t('production', 'oinv_preset_today') },
  { key: 'week',  label: t('production', 'oinv_preset_week') },
  { key: 'month', label: t('production', 'oinv_preset_month') },
  { key: 'year',  label: t('production', 'oinv_preset_year') },
];

const getColMeta = (t) => ({
  opening: { label: t('production', 'oinv_col_opening'), cls: 'text-[#5C4E3D]', sign: '' },
  nhap:    { label: t('production', 'oinv_col_import'),  cls: 'text-emerald-600', sign: '+' },
  ban:     { label: t('production', 'oinv_col_sold'),    cls: 'text-blue-600',    sign: '−' },
  xuat:    { label: t('production', 'oinv_col_export'),  cls: 'text-red-500',     sign: '−' },
  closing: { label: t('production', 'oinv_col_closing'), cls: 'text-[#C9A84C] font-bold', sign: '' },
});

export default function OwnerInventoryPage() {
  const toast = useToast();
  const { t } = useLang();
  const { fmtNum } = useFmt();
  const fmtQty = (n) => (n == null || Number.isNaN(Number(n))) ? '0' : fmtNum(n, 3);

  const PRESETS = useMemo(() => getPresets(t), [t]);

  const [preset, setPreset] = useState('today');
  const [range, setRange] = useState(() => presetToRange('today'));
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [scope, setScope] = useState('ALL');
  const [catFilter, setCatFilter] = useState('');
  const [subFilter, setSubFilter] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [showTable, setShowTable] = useState(true);
  const [collapsedCats, setCollapsedCats] = useState(new Set());
  const [collapsedSubs, setCollapsedSubs] = useState(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await inventoryFlowApi.summary(range.from, range.to, search.trim() || undefined);
      setData(res.data?.data || res.data || null);
    } catch { toast(t('production', 'oinv_toast_load_failed'), 'error'); }
    finally { setLoading(false); }
  }, [range, search, t, toast]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const tm = setTimeout(() => setSearch(searchInput), 400); return () => clearTimeout(tm); }, [searchInput]);

  const applyPreset = (key) => { setPreset(key); setRange(presetToRange(key)); };
  const applyCustom = (r) => { if (!r.from && !r.to) return; setPreset('custom'); setRange({ from: r.from, to: r.to }); };

  const warehouses = data?.warehouses || [];
  const allIngredients = useMemo(() => data?.ingredients || [], [data]);

  const valueOf = useCallback((ing) => {
    if (scope === 'ALL') {
      return { opening: ing.totalOpening, nhap: ing.totalNhap, ban: ing.totalBan, xuat: ing.totalXuat, closing: ing.totalClosing };
    }
    const cell = (ing.byWarehouse || []).find(c => String(c.warehouseId) === String(scope));
    return cell ? { opening: cell.opening, nhap: cell.nhap, ban: cell.ban, xuat: cell.xuat, closing: cell.closing } : null;
  }, [scope]);

  const categoryOptions = useMemo(() => {
    const map = new Map();
    let hasNone = false;
    allIngredients.forEach(i => {
      if (i.categoryId != null) map.set(String(i.categoryId), i.categoryName || `${t('production', 'oinv_cat_fallback')} #${i.categoryId}`);
      else hasNone = true;
    });
    const arr = [...map.entries()].map(([id, name]) => ({ id, name }));
    arr.sort((a, b) => a.name.localeCompare(b.name));
    if (hasNone) arr.push({ id: NO_CAT, name: t('production', 'oinv_no_category') });
    return arr;
  }, [allIngredients, t]);

  const subCategoryOptions = useMemo(() => {
    const map = new Map();
    allIngredients.forEach(i => {
      if (catFilter && catFilter !== NO_CAT && String(i.categoryId) !== String(catFilter)) return;
      if (catFilter === NO_CAT && i.categoryId != null) return;
      if (i.subCategoryId != null) map.set(String(i.subCategoryId), i.subCategoryName || `${t('production', 'oinv_subcat_fallback')} #${i.subCategoryId}`);
    });
    const arr = [...map.entries()].map(([id, name]) => ({ id, name }));
    arr.sort((a, b) => a.name.localeCompare(b.name));
    return arr;
  }, [allIngredients, catFilter, t]);

  const filtered = useMemo(() => {
    return allIngredients.filter(ing => {
      if (catFilter === NO_CAT && ing.categoryId != null) return false;
      if (catFilter && catFilter !== NO_CAT && String(ing.categoryId) !== String(catFilter)) return false;
      if (subFilter && String(ing.subCategoryId) !== String(subFilter)) return false;
      if (scope !== 'ALL' && !valueOf(ing)) return false;
      return true;
    });
  }, [allIngredients, catFilter, subFilter, scope, valueOf]);

  const tree = useMemo(() => {
    const m = new Map();
    filtered.forEach(ing => {
      const catKey = ing.categoryId != null ? String(ing.categoryId) : NO_CAT;
      const catName = ing.categoryId != null ? (ing.categoryName || `${t('production', 'oinv_cat_fallback')} #${ing.categoryId}`) : t('production', 'oinv_no_category');
      const subKey = ing.subCategoryId != null ? String(ing.subCategoryId) : NO_CAT;
      const subName = ing.subCategoryId != null ? (ing.subCategoryName || `${t('production', 'oinv_subcat_fallback')} #${ing.subCategoryId}`) : t('production', 'oinv_no_subcategory');
      if (!m.has(catKey)) m.set(catKey, { key: catKey, name: catName, subs: new Map() });
      const cat = m.get(catKey);
      if (!cat.subs.has(subKey)) cat.subs.set(subKey, { key: subKey, name: subName, items: [] });
      cat.subs.get(subKey).items.push(ing);
    });
    return [...m.values()];
  }, [filtered, t]);

  const searching = !!search.trim();
  const catOpen = (k) => searching || !collapsedCats.has(k);
  const subOpen = (ck, sk) => searching || !collapsedSubs.has(ck + ':' + sk);
  const toggleCat = (k) => setCollapsedCats(p => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const toggleSub = (ck, sk) => setCollapsedSubs(p => { const key = ck + ':' + sk; const n = new Set(p); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const scopeLabel = scope === 'ALL'
    ? t('production', 'oinv_all_warehouses')
    : (warehouses.find(w => String(w.id) === String(scope))?.name || t('production', 'oinv_warehouse'));

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4 pb-10">
      <div className="flex items-center gap-3">
        <Package size={22} className="text-[#C9A84C]" />
        <h1 className="text-xl font-bold text-[#1C1C1E]">{t('production', 'oinv_title')}</h1>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setShowConfirm(true)}
            className="flex items-center gap-1.5 px-3 h-9 rounded-xl bg-[#C9A84C] text-white text-sm font-semibold hover:bg-[#B8923E] transition"
            title={t('production', 'oinv_btn_confirm')}>
            <ClipboardCheck size={16} /> <span className="hidden sm:inline">{t('production', 'oinv_btn_confirm')}</span>
          </button>
          <button onClick={load} className="p-2 rounded-xl border border-[#E8DDD0] text-[#8E8878] hover:bg-[#FAF7F2] transition"
            title={t('common', 'refresh')}>
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {PRESETS.map(p => (
          <button key={p.key} onClick={() => applyPreset(p.key)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${preset === p.key ? 'bg-[#C9A84C] text-white' : 'bg-white border border-[#E8DDD0] text-[#8E8878] hover:border-[#C9A84C]'}`}>
            {p.label}
          </button>
        ))}
        <DateRangePicker from={range.from} to={range.to} onChange={applyCustom}
          placeholder={t('production', 'oinv_custom_range')} align="right" />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8878]" />
          <input value={searchInput} onChange={e => setSearchInput(e.target.value)}
            placeholder={t('production', 'oinv_search_ph')}
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#E8DDD0] text-sm focus:outline-none focus:border-[#C9A84C]" />
        </div>
        <select value={scope} onChange={e => setScope(e.target.value)}
          title={t('production', 'oinv_select_warehouse')}
          className="px-3 py-2 rounded-xl border border-[#E8DDD0] text-sm bg-white focus:outline-none focus:border-[#C9A84C]">
          <option value="ALL">🏬 {t('production', 'oinv_all_warehouses')}</option>
          {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        <select value={catFilter} onChange={e => { setCatFilter(e.target.value); setSubFilter(''); }}
          title={t('production', 'oinv_parent_category')}
          className="px-3 py-2 rounded-xl border border-[#E8DDD0] text-sm bg-white focus:outline-none focus:border-[#C9A84C]">
          <option value="">{t('production', 'oinv_all_categories')}</option>
          {categoryOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={subFilter} onChange={e => setSubFilter(e.target.value)}
          title={t('production', 'oinv_sub_category')}
          disabled={catFilter === NO_CAT}
          className="px-3 py-2 rounded-xl border border-[#E8DDD0] text-sm bg-white focus:outline-none focus:border-[#C9A84C] disabled:opacity-50">
          <option value="">{t('production', 'oinv_all_subcategories')}</option>
          {subCategoryOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {(catFilter || subFilter) && (
          <button onClick={() => { setCatFilter(''); setSubFilter(''); }}
            className="text-xs text-[#C9A84C] font-semibold hover:underline flex items-center gap-1">
            <Filter size={12} /> {t('production', 'fg_clear_filter')}
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-40 bg-gray-100 rounded-2xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-[#8E8878]">
          <Package size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">{t('production', 'oinv_empty')}</p>
          <p className="text-sm mt-1">
            {search || catFilter || subFilter ? t('production', 'oinv_empty_try_other') : t('production', 'oinv_empty_period')}
          </p>
        </div>
      ) : (
        <CollapsibleCard
          title={`${t('production', 'oinv_stock_movement')} · ${scopeLabel}`}
          icon={Layers} open={showTable} onToggle={() => setShowTable(v => !v)}>
          <GroupedTable
            tree={tree} valueOf={valueOf} columns={['opening', 'nhap', 'ban', 'xuat', 'closing']}
            catOpen={catOpen} subOpen={subOpen} toggleCat={toggleCat} toggleSub={toggleSub}
            fmtQty={fmtQty} />
        </CollapsibleCard>
      )}

      {showConfirm && (
        <ConfirmModal warehouses={warehouses} onClose={() => setShowConfirm(false)}
          onDone={() => { setShowConfirm(false); load(); }} />
      )}
    </div>
  );
}

function CollapsibleCard({ title, icon: Icon, open, onToggle, children }) {
  return (
    <div className="bg-white rounded-2xl border border-[#E8DDD0] overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#FAF7F2] transition">
        <span className="flex items-center gap-2 text-sm font-semibold text-[#1C1C1E]">
          <Icon size={16} className="text-[#C9A84C]" /> {title}
        </span>
        {open ? <ChevronDown size={16} className="text-[#8E8878]" /> : <ChevronRight size={16} className="text-[#8E8878]" />}
      </button>
      {open && <div className="overflow-x-auto">{children}</div>}
    </div>
  );
}

function GroupedTable({ tree, valueOf, columns, catOpen, subOpen, toggleCat, toggleSub, fmtQty }) {
  const { t } = useLang();
  const COL_META = useMemo(() => getColMeta(t), [t]);
  const colSpan = 1 + columns.length;

  const cellVal = (v, key) => {
    if (!v) return '—';
    const raw = v[key];
    const meta = COL_META[key];
    if ((key === 'nhap' || key === 'ban' || key === 'xuat')) return Number(raw) ? meta.sign + fmtQty(raw) : '—';
    return fmtQty(raw);
  };

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-[#FAF7F2] text-[#8E8878] text-xs">
          <th className="text-left px-4 py-2 font-semibold">{t('production', 'oinv_col_ingredient')}</th>
          {columns.map(c => <th key={c} className={`text-right px-4 py-2 font-semibold ${COL_META[c].cls}`}>{COL_META[c].label}</th>)}
        </tr>
      </thead>
      <tbody>
        {tree.map(cat => {
          const co = catOpen(cat.key);
          return (
            <FragmentRows key={cat.key}>
              <tr className="border-t border-black/5 bg-[#FBF8F2] cursor-pointer" onClick={() => toggleCat(cat.key)}>
                <td colSpan={colSpan} className="px-3 py-2 font-bold text-[#1C1C1E]">
                  <span className="inline-flex items-center gap-1">
                    {co ? <ChevronDown size={14} className="text-[#C9A84C]" /> : <ChevronRight size={14} className="text-[#8E8878]" />}
                    {cat.name}
                  </span>
                </td>
              </tr>
              {co && [...cat.subs.values()].map(sub => {
                const isNoSub = sub.key === NO_CAT;
                const so = isNoSub ? true : subOpen(cat.key, sub.key);
                return (
                  <FragmentRows key={sub.key}>
                    {!isNoSub && (
                      <tr className="border-t border-black/5 cursor-pointer" onClick={() => toggleSub(cat.key, sub.key)}>
                        <td colSpan={colSpan} className="pl-8 pr-3 py-1.5 text-xs font-semibold text-[#8E8878]">
                          <span className="inline-flex items-center gap-1">
                            {so ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                            {sub.name} <span className="text-[10px] font-normal">({sub.items.length})</span>
                          </span>
                        </td>
                      </tr>
                    )}
                    {so && sub.items.map(ing => {
                      const v = valueOf(ing);
                      return (
                        <tr key={ing.ingredientId} className="border-t border-black/5 hover:bg-[#FAF7F2]/50">
                          <td className={`${isNoSub ? 'pl-8' : 'pl-12'} pr-4 py-2 text-[#1C1C1E]`}>
                            {ing.name} <span className="text-[10px] text-[#8E8878]">({ing.unit})</span>
                          </td>
                          {columns.map(c => (
                            <td key={c} className={`text-right px-4 py-2 ${COL_META[c].cls}`}>{cellVal(v, c)}</td>
                          ))}
                        </tr>
                      );
                    })}
                  </FragmentRows>
                );
              })}
            </FragmentRows>
          );
        })}
      </tbody>
    </table>
  );
}

function FragmentRows({ children }) { return <>{children}</>; }

// ── Modal xác nhận (kiểm kê) ──
function ConfirmModal({ warehouses, onClose, onDone }) {
  const toast = useToast();
  const { t } = useLang();
  const { fmtNum } = useFmt();
  const fmtQty = (n) => fmtNum(n, 3);
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id || '');
  const [ingredients, setIngredients] = useState([]);
  const [ingSearch, setIngSearch] = useState('');
  const [dropOpen, setDropOpen] = useState(false);
  const [rows, setRows] = useState([]);
  const [saving, setSaving] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const inputRef = useRef(null);

  useEffect(() => {
    inventoryFlowApi.ingredients()
      .then(res => setIngredients(res.data?.data ?? res.data ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (dropOpen && inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownPosition({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX, width: rect.width });
    }
  }, [dropOpen, ingSearch]);

  const chosenIds = new Set(rows.map(r => String(r.id)));
  const options = ingredients
    .filter(i => !chosenIds.has(String(i.id)))
    .filter(i => !ingSearch || i.name.toLowerCase().includes(ingSearch.toLowerCase()))
    .slice(0, 50);

  const addRow = (ing) => {
    setRows(prev => [...prev, { id: ing.id, name: ing.name, unit: ing.unit, qty: '' }]);
    setIngSearch('');
    setDropOpen(false);
  };
  const removeRow = (id) => setRows(prev => prev.filter(r => String(r.id) !== String(id)));
  const setQty = (id, v) => setRows(prev => prev.map(r => String(r.id) === String(id) ? { ...r, qty: v } : r));

  const submit = async () => {
    if (!warehouseId) { toast(t('production', 'oinv_err_select_warehouse'), 'error'); return; }
    if (rows.length === 0) { toast(t('production', 'oinv_err_select_ingredient'), 'error'); return; }
    const missing = rows.find(r => r.qty === '' || r.qty == null || Number.isNaN(Number(r.qty)) || Number(r.qty) < 0);
    if (missing) { toast(t('production', 'oinv_err_invalid_qty', { name: missing.name }), 'error'); return; }
    setSaving(true);
    try {
      await inventoryFlowApi.confirm({
        warehouseId: Number(warehouseId),
        items: rows.map(r => ({ ingredientId: Number(r.id), countedQuantity: Number(r.qty) })),
      });
      toast(t('production', 'oinv_toast_confirmed', { n: rows.length }), 'success');
      onDone();
    } catch (e) {
      toast(e?.response?.data?.message || t('production', 'oinv_err_confirm_failed'), 'error');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh] lg:max-h-[70vh]">
        <div className="flex items-center justify-between p-5 border-b border-black/5 flex-shrink-0">
          <div className="flex items-center gap-2">
            <ClipboardCheck size={20} className="text-[#C9A84C]" />
            <h2 className="text-lg font-bold text-[#1C1C1E]">{t('production', 'oinv_btn_confirm')}</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-[#FAF7F2] text-[#8E8878]"><X size={20} /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4" style={{ overflowY: 'auto', position: 'relative' }}>
          <p className="text-xs text-[#8E8878]">
            {t('production', 'oinv_confirm_desc')}
          </p>

          <div>
            <label className="block text-sm font-semibold text-[#1C1C1E] mb-1.5">
              {t('production', 'oinv_warehouse')} <span className="text-red-500">*</span>
            </label>
            <select value={warehouseId} onChange={e => setWarehouseId(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-[#E8DDD0] text-sm bg-white focus:outline-none focus:border-[#C9A84C]">
              <option value="">{t('production', 'oinv_select_warehouse')}</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>

          <div className="relative" style={{ position: 'relative', zIndex: 1 }}>
            <label className="block text-sm font-semibold text-[#1C1C1E] mb-1.5">
              {t('production', 'oinv_add_ingredient')} <span className="text-red-500">*</span>
            </label>
            <div className="relative" style={{ position: 'relative' }}>
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8878]" />
              <input
                ref={inputRef}
                value={ingSearch}
                onChange={e => { setIngSearch(e.target.value); setDropOpen(true); }}
                onFocus={() => setDropOpen(true)}
                placeholder={t('production', 'oinv_add_ingredient_ph')}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#E8DDD0] text-sm focus:outline-none focus:border-[#C9A84C]" />
            </div>
          </div>

          {rows.length === 0 ? (
            <div className="text-center py-6 text-sm text-[#8E8878] border border-dashed border-[#E8DDD0] rounded-xl">
              {t('production', 'oinv_no_ingredient_selected')}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#8E8878]">
                  {t('production', 'oinv_selected', { n: rows.length })}
                </span>
                <button onClick={() => setRows([])} className="text-xs text-red-400 hover:text-red-600 hover:underline">
                  {t('production', 'oinv_clear_all')}
                </button>
              </div>
              {rows.map(r => {
                const invalid = r.qty === '' || Number.isNaN(Number(r.qty)) || Number(r.qty) < 0;
                return (
                  <div key={r.id} className="flex items-center gap-2 bg-[#FAF7F2] rounded-xl px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#1C1C1E] truncate">{r.name}</p>
                      <p className="text-[10px] text-[#8E8878]">{t('production', 'oinv_unit')}: {r.unit}</p>
                    </div>
                    <input
                      type="number" step="any" min="0" value={r.qty}
                      onChange={e => setQty(r.id, e.target.value)}
                      placeholder={t('production', 'oinv_qty_ph')}
                      className={`w-32 px-3 py-2 rounded-lg border text-sm text-right bg-white focus:outline-none ${invalid ? 'border-red-300 focus:border-red-400' : 'border-[#E8DDD0] focus:border-[#C9A84C]'}`} />
                    <button onClick={() => removeRow(r.id)} className="p-1.5 rounded-lg text-[#8E8878] hover:bg-red-50 hover:text-red-500 transition"
                      title={t('common', 'delete')}>
                      <X size={15} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-5 border-t border-black/5 flex gap-3 flex-shrink-0">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-black/10 text-sm font-semibold text-[#8E8878] hover:bg-[#FAF7F2] transition">
            {t('common', 'cancel')}
          </button>
          <button onClick={submit} disabled={saving}
            className="flex-1 py-3 rounded-xl bg-[#C9A84C] text-white text-sm font-bold hover:bg-[#B8923E] transition disabled:opacity-50">
            {saving ? t('common', 'processing') : `${t('production', 'oinv_btn_confirm')}${rows.length ? ` (${rows.length})` : ''}`}
          </button>
        </div>
      </div>

      {dropOpen && options.length > 0 && (
        <div className="fixed z-[9999] bg-white border border-[#E8DDD0] rounded-xl shadow-2xl max-h-52 overflow-y-auto"
          style={{ top: dropdownPosition.top, left: dropdownPosition.left, width: dropdownPosition.width || '100%', maxWidth: 'calc(100% - 32px)' }}>
          {options.map(i => (
            <button key={i.id} type="button" onClick={() => addRow(i)}
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-[#FAF7F2] transition border-b border-black/5 last:border-0">
              {i.name} <span className="text-[10px] text-[#8E8878]">({i.unit})</span>
            </button>
          ))}
        </div>
      )}
      {dropOpen && ingSearch && options.length === 0 && (
        <div className="fixed z-[9999] bg-white border border-[#E8DDD0] rounded-xl shadow-2xl px-4 py-3 text-xs text-[#8E8878]"
          style={{ top: dropdownPosition.top, left: dropdownPosition.left, width: dropdownPosition.width || '100%', maxWidth: 'calc(100% - 32px)' }}>
          {t('production', 'oinv_not_found')}
        </div>
      )}
    </div>
  );
}
