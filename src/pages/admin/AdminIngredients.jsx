// src/pages/admin/AdminIngredients.jsx
import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Package, Search, AlertTriangle, AlertCircle,
  ChevronDown, ChevronRight, Warehouse as WhIcon,
} from 'lucide-react';
import { adminIngredientApi, adminWarehouseApi, getImageUrl } from '../../api/adminApi';
import { ExpiryBadge } from '../../components/admin/Badge';
import useDebounce from '../../utils/useDebounce';
import {
  PageHeader, LoadingSpinner, EmptyState, inputCls, formatNumber, formatDate,
} from '../../components/admin/ui';

// ── Formatters ────────────────────────────────────────────────────────────────
function formatPrice(n) {
  if (n == null || Number(n) === 0) return '—';
  return new Intl.NumberFormat('vi-VN').format(Math.round(Number(n))) + ' đ';
}

// ── Summary card ─────────────────────────────────────────────────────────────
function SummaryCard({ icon: Icon, label, value, color }) {
  const colors = {
    gold:  'bg-[#C9A84C]/10 text-[#C9A84C]',
    amber: 'bg-amber-50 text-amber-600',
    red:   'bg-red-50 text-red-500',
  };
  return (
    <div className="bg-white rounded-2xl border border-black/5 p-4 shadow-sm">
      <div className={`inline-flex p-2 rounded-xl ${colors[color]} mb-2`}>
        <Icon size={16} />
      </div>
      <p className="text-2xl font-bold text-[#1C1C1E]">{value}</p>
      <p className="text-xs text-[#8E8878] mt-0.5">{label}</p>
    </div>
  );
}

// ── Single ingredient row ─────────────────────────────────────────────────────
function IngredientRow({ row }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-black/5 last:border-0">
      {/* Header row */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#FAF7F2]/60 transition text-left"
      >
        {/* Expand icon */}
        <span className="text-[#C4B9A8] flex-shrink-0">
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>

        {/* Image */}
        {row.ingredientImageUrl ? (
          <img src={getImageUrl(row.ingredientImageUrl)} alt=""
            className="w-9 h-9 rounded-xl object-cover flex-shrink-0" />
        ) : (
          <div className="w-9 h-9 rounded-xl bg-[#FAF7F2] flex items-center justify-center flex-shrink-0">
            <Package size={16} className="text-[#C9A84C]" />
          </div>
        )}

        {/* Name + badge */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-[#1C1C1E] text-sm truncate">{row.ingredientName}</p>
            {row.expiryBadge === 'DANGER'  && <AlertCircle  size={13} className="text-red-500 flex-shrink-0" />}
            {row.expiryBadge === 'WARNING' && <AlertTriangle size={13} className="text-amber-500 flex-shrink-0" />}
          </div>
          <p className="text-xs text-[#8E8878]">
            {row.lots?.length || 0} lô
            {row.lots?.length > 0 && row.lots.some(l => l.expiryDate) && (
              <> · HSD gần nhất: {formatDate(row.nearestExpiryDate)}</>
            )}
          </p>
        </div>

        {/* Stock + cost */}
        <div className="text-right flex-shrink-0">
          <p className="font-bold text-[#1C1C1E] text-sm">
            {formatNumber(row.stockQuantity)} <span className="text-[#8E8878] font-normal text-xs">{row.unit}</span>
          </p>
          {row.totalCostValue != null && Number(row.totalCostValue) > 0 && (
            <p className="text-xs text-[#C9A84C] font-medium">{formatPrice(row.totalCostValue)}</p>
          )}
        </div>
      </button>

      {/* Lot detail */}
      {open && row.lots?.length > 0 && (
        <div className="bg-[#FAF7F2] px-4 py-3 border-t border-black/5">
          <p className="text-[10px] font-bold text-[#8E8878] uppercase tracking-wider mb-2">Chi tiết lô</p>
          <div className="space-y-1.5">
            {row.lots.map((lot, i) => (
              <div key={i} className="flex items-center justify-between text-xs gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[#555]">
                    HSD: {lot.expiryDate ? formatDate(lot.expiryDate) : 'Không có HSD'}
                  </span>
                  <ExpiryBadge expiryDate={lot.expiryDate} />
                </div>
                <div className="flex items-center gap-4 flex-shrink-0 text-right">
                  <span className="text-[#8E8878]">
                    Giá vốn: <span className="font-medium text-[#1C1C1E]">{formatPrice(lot.costPrice)}</span>
                  </span>
                  <span className="font-semibold text-[#1C1C1E]">
                    {formatNumber(lot.quantity)} {row.unit}
                  </span>
                  {lot.totalCost != null && Number(lot.totalCost) > 0 && (
                    <span className="text-[#C9A84C] font-medium">{formatPrice(lot.totalCost)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          {/* Tổng giá vốn */}
          {row.totalCostValue != null && Number(row.totalCostValue) > 0 && (
            <div className="mt-2 pt-2 border-t border-black/5 flex justify-end">
              <span className="text-xs text-[#8E8878]">
                Tổng giá vốn: <span className="font-bold text-[#C9A84C]">{formatPrice(row.totalCostValue)}</span>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── SubCategory section ───────────────────────────────────────────────────────
function SubCategorySection({ name, rows }) {
  const [open, setOpen] = useState(true);
  const totalStock = rows.reduce((s, r) => s + Number(r.stockQuantity || 0), 0);
  const totalCost  = rows.reduce((s, r) => s + Number(r.totalCostValue || 0), 0);
  const hasDanger  = rows.some(r => r.expiryBadge === 'DANGER');
  const hasWarning = rows.some(r => r.expiryBadge === 'WARNING');

  return (
    <div className="ml-4 border-l-2 border-[#F0EBE3] mb-1">
      {/* SubCat header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#FAF7F2] transition text-left"
      >
        {open ? <ChevronDown size={13} className="text-[#C4B9A8]" /> : <ChevronRight size={13} className="text-[#C4B9A8]" />}
        <span className="text-xs font-semibold text-[#5C5C5C] flex-1 truncate">
          {name || 'Chưa phân loại'}
        </span>
        {hasDanger  && <AlertCircle  size={11} className="text-red-400 flex-shrink-0" />}
        {hasWarning && !hasDanger && <AlertTriangle size={11} className="text-amber-400 flex-shrink-0" />}
        <span className="text-[10px] text-[#8E8878] flex-shrink-0">{rows.length} NL</span>
        {totalCost > 0 && (
          <span className="text-[10px] text-[#C9A84C] font-medium flex-shrink-0">{formatPrice(totalCost)}</span>
        )}
      </button>

      {open && (
        <div className="bg-white rounded-xl mx-2 mb-2 border border-black/5 overflow-hidden">
          {rows.map(r => <IngredientRow key={r.ingredientId} row={r} />)}
        </div>
      )}
    </div>
  );
}

// ── Category section ──────────────────────────────────────────────────────────
function CategorySection({ name, rows }) {
  const [open, setOpen] = useState(true);

  // Group by subCategoryName
  const subGroups = useMemo(() => {
    const map = new Map();
    rows.forEach(r => {
      const key = r.subCategoryName || '__none__';
      if (!map.has(key)) map.set(key, { name: r.subCategoryName || null, rows: [] });
      map.get(key).rows.push(r);
    });
    // Sort: subcat with name first, null last
    return Array.from(map.values()).sort((a, b) => {
      if (!a.name && b.name) return 1;
      if (a.name && !b.name) return -1;
      return (a.name || '').localeCompare(b.name || '', 'vi');
    });
  }, [rows]);

  const totalCost  = rows.reduce((s, r) => s + Number(r.totalCostValue || 0), 0);
  const hasDanger  = rows.some(r => r.expiryBadge === 'DANGER');
  const hasWarning = rows.some(r => r.expiryBadge === 'WARNING');
  const hasSubCats = subGroups.length > 1 || subGroups[0]?.name;

  return (
    <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden mb-3">
      {/* Category header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2.5 px-4 py-3 bg-[#FAF7F2] hover:bg-[#F0EBE3] transition text-left border-b border-black/5"
      >
        {open ? <ChevronDown size={15} className="text-[#C9A84C]" /> : <ChevronRight size={15} className="text-[#C9A84C]" />}
        <span className="font-bold text-[#1C1C1E] flex-1 truncate">{name}</span>
        {hasDanger  && <AlertCircle  size={13} className="text-red-500 flex-shrink-0" />}
        {hasWarning && !hasDanger && <AlertTriangle size={13} className="text-amber-500 flex-shrink-0" />}
        <span className="text-xs text-[#8E8878] flex-shrink-0">{rows.length} nguyên liệu</span>
        {totalCost > 0 && (
          <span className="text-xs text-[#C9A84C] font-semibold flex-shrink-0 ml-2">{formatPrice(totalCost)}</span>
        )}
      </button>

      {open && (
        <>
          {hasSubCats
            ? subGroups.map(sg => (
                <SubCategorySection key={sg.name || '__none__'} name={sg.name} rows={sg.rows} />
              ))
            : rows.map(r => <IngredientRow key={r.ingredientId} row={r} />)
          }
        </>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AdminIngredients() {
  const [warehouses,   setWarehouses]   = useState([]);
  const [selectedWhId, setSelectedWhId] = useState(null);
  const [q,            setQ]            = useState('');
  const [rows,         setRows]         = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [loadingWh,    setLoadingWh]    = useState(true);
  const debouncedQ = useDebounce(q, 600);

  useEffect(() => {
    (async () => {
      try {
        const list = await adminWarehouseApi.list();
        setWarehouses(list || []);
        if (list?.length) setSelectedWhId(list[0].id);
      } catch (e) { console.error(e); }
      finally { setLoadingWh(false); }
    })();
  }, []);

  const load = useCallback(async () => {
    if (!selectedWhId) return;
    setLoading(true);
    try {
      const res = await adminIngredientApi.listByWarehouse(selectedWhId, debouncedQ || undefined);
      setRows(res || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [selectedWhId, debouncedQ]);

  useEffect(() => { load(); }, [load]);

  // Group rows: category → subCategory → ingredients
  const categoryGroups = useMemo(() => {
    const map = new Map();

    rows.forEach(r => {
      const catKey  = r.categoryId   || '__none__';
      const catName = r.categoryName || 'Chưa phân loại';

      if (!map.has(catKey)) map.set(catKey, { id: catKey, name: catName, rows: [] });
      map.get(catKey).rows.push(r);
    });

    // Sort: named categories first (by name), Chưa phân loại last
    return Array.from(map.values()).sort((a, b) => {
      if (a.id === '__none__') return 1;
      if (b.id === '__none__') return -1;
      return a.name.localeCompare(b.name, 'vi');
    });
  }, [rows]);

  const counts = {
    total:   rows.length,
    warning: rows.filter(r => r.expiryBadge === 'WARNING').length,
    danger:  rows.filter(r => r.expiryBadge === 'DANGER').length,
  };

  const grandTotalCost = rows.reduce((s, r) => s + Number(r.totalCostValue || 0), 0);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5">
      <PageHeader icon={Package} title="Nguyên liệu" subtitle="Quản lý tồn kho và hạn sử dụng" />

      {/* Warehouse selector */}
      <div className="bg-white rounded-2xl border border-black/5 p-4 shadow-sm">
        <label className="block text-xs font-semibold text-[#1C1C1E] uppercase tracking-wider mb-2">
          <WhIcon size={12} className="inline mr-1" /> Chọn kho
        </label>
        {loadingWh ? (
          <div className="h-10 bg-[#FAF7F2] rounded-xl animate-pulse" />
        ) : warehouses.length === 0 ? (
          <p className="text-sm text-[#8E8878]">Chưa có kho nào.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {warehouses.map(w => (
              <button key={w.id} onClick={() => setSelectedWhId(w.id)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition ring-1
                  ${selectedWhId === w.id
                    ? 'bg-[#C9A84C] text-white ring-[#C9A84C]'
                    : 'bg-white text-[#1C1C1E] ring-black/10 hover:bg-[#FAF7F2]'}`}>
                {w.name}
                <span className={`ml-2 text-xs ${selectedWhId === w.id ? 'text-white/80' : 'text-[#8E8878]'}`}>
                  {w.type === 'SALE' ? 'Bán hàng' : 'Trung chuyển'}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Summary cards */}
      {!loading && rows.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryCard icon={Package}       label="Tổng nguyên liệu"        value={counts.total}   color="gold" />
          <SummaryCard icon={AlertTriangle} label="Sắp hết hạn (≤ 3 tháng)" value={counts.warning} color="amber" />
          <SummaryCard icon={AlertCircle}   label="Hết hạn gấp (≤ 1 tháng)" value={counts.danger}  color="red" />
          <div className="bg-white rounded-2xl border border-black/5 p-4 shadow-sm">
            <div className="inline-flex p-2 rounded-xl bg-emerald-50 text-emerald-600 mb-2">
              <Package size={16} />
            </div>
            <p className="text-lg font-bold text-[#1C1C1E] truncate">{formatPrice(grandTotalCost)}</p>
            <p className="text-xs text-[#8E8878] mt-0.5">Tổng giá vốn tồn kho</p>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8878]" size={16} />
        <input
          type="text"
          placeholder="Tìm tên nguyên liệu..."
          value={q}
          onChange={e => setQ(e.target.value)}
          className={`${inputCls} pl-9 w-full`}
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-[#C9A84C]/30 border-t-[#C9A84C] rounded-full animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState icon={Package} message="Không có nguyên liệu nào" />
      ) : (
        <div>
          {categoryGroups.map(cg => (
            <CategorySection key={cg.id} name={cg.name} rows={cg.rows} />
          ))}
        </div>
      )}
    </div>
  );
}