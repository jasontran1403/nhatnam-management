// src/pages/admin/AdminIngredients.jsx
// Feature 5: Thêm filter theo danh mục, sort theo tên và số lượng tồn kho
import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Package, Search, AlertTriangle, AlertCircle, ArrowUpDown,
  ArrowUp, ArrowDown, Warehouse as WhIcon, Tag, SlidersHorizontal
} from 'lucide-react';
import { adminIngredientApi, adminWarehouseApi, getImageUrl } from '../../api/adminApi';
import { ExpiryBadge } from '../../components/admin/Badge';
import useDebounce from '../../utils/useDebounce';
import {
  PageHeader, LoadingSpinner, EmptyState, inputCls, formatNumber, formatDate,
} from '../../components/admin/ui';

// Danh mục (category) được lấy từ danh sách nguyên liệu thực tế
// Nếu backend có field `category` trên ingredient → dùng; nếu không → auto-generate từ đơn vị

const SORT_OPTIONS = [
  { value: 'name_asc',   label: 'Tên A → Z',     icon: ArrowUp },
  { value: 'name_desc',  label: 'Tên Z → A',     icon: ArrowDown },
  { value: 'stock_asc',  label: 'Tồn ít → nhiều', icon: ArrowUp },
  { value: 'stock_desc', label: 'Tồn nhiều → ít', icon: ArrowDown },
];

function SummaryCard({ icon: Icon, label, value, color }) {
  const colors = {
    gold: 'bg-[#C9A84C]/10 text-[#C9A84C]',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-500',
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

export default function AdminIngredients() {
  const [warehouses, setWarehouses]     = useState([]);
  const [selectedWhId, setSelectedWhId] = useState(null);
  const [q, setQ]                       = useState('');
  const [rows, setRows]                 = useState([]);
  const [loading, setLoading]           = useState(true);
  const [loadingWh, setLoadingWh]       = useState(true);
  const debouncedQ                      = useDebounce(q, 600);

  // Feature 5: new state
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [sortBy, setSortBy]                     = useState('name_asc');
  const [showFilters, setShowFilters]           = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const list = await adminWarehouseApi.list();
        setWarehouses(list || []);
        if (list?.length) setSelectedWhId(list[0].id);
      } catch (e) { console.error(e); } finally { setLoadingWh(false); }
    })();
  }, []);

  const load = useCallback(async () => {
    if (!selectedWhId) return;
    setLoading(true);
    try {
      const res = await adminIngredientApi.listByWarehouse(selectedWhId, debouncedQ || undefined);
      setRows(res || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [selectedWhId, debouncedQ]);

  useEffect(() => { load(); }, [load]);

  // Lấy danh mục từ dữ liệu (dùng field `category` nếu có, hoặc `unit` để phân nhóm)
  const categories = useMemo(() => {
    const cats = new Set();
    rows.forEach(r => {
      if (r.category) cats.add(r.category);
      else if (r.unit) cats.add(r.unit); // fallback: nhóm theo đơn vị
    });
    return ['ALL', ...Array.from(cats).sort()];
  }, [rows]);

  // Filter + Sort
  const filteredRows = useMemo(() => {
    let result = [...rows];

    // Filter theo danh mục
    if (selectedCategory !== 'ALL') {
      result = result.filter(r => (r.category || r.unit) === selectedCategory);
    }

    // Sort
    switch (sortBy) {
      case 'name_asc':   result.sort((a, b) => (a.ingredientName || '').localeCompare(b.ingredientName || '', 'vi')); break;
      case 'name_desc':  result.sort((a, b) => (b.ingredientName || '').localeCompare(a.ingredientName || '', 'vi')); break;
      case 'stock_asc':  result.sort((a, b) => Number(a.stockQuantity || 0) - Number(b.stockQuantity || 0)); break;
      case 'stock_desc': result.sort((a, b) => Number(b.stockQuantity || 0) - Number(a.stockQuantity || 0)); break;
    }

    return result;
  }, [rows, selectedCategory, sortBy]);

  const counts = {
    total:   filteredRows.length,
    warning: filteredRows.filter(r => r.expiryBadge === 'WARNING').length,
    danger:  filteredRows.filter(r => r.expiryBadge === 'DANGER').length,
  };

  const currentSort = SORT_OPTIONS.find(s => s.value === sortBy);

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
                className={`px-4 py-2 rounded-xl text-sm font-medium transition ring-1 ${selectedWhId === w.id
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

      {/* Summary */}
      {!loading && rows.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <SummaryCard icon={Package}       label="Tổng nguyên liệu"        value={counts.total}   color="gold" />
          <SummaryCard icon={AlertTriangle} label="Sắp hết hạn (≤ 3 tháng)" value={counts.warning} color="amber" />
          <SummaryCard icon={AlertCircle}   label="Hết hạn gấp (≤ 1 tháng)" value={counts.danger}  color="red" />
        </div>
      )}

      {/* Filters row */}
      <div className="bg-white rounded-2xl border border-black/5 p-3 sm:p-4 shadow-sm space-y-3">
        <div className="flex gap-2 items-center flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8878]" size={16} />
            <input
              type="text"
              placeholder="Tìm tên nguyên liệu..."
              value={q}
              onChange={e => setQ(e.target.value)}
              className={`${inputCls} pl-9 w-full`}
            />
          </div>

          {/* Toggle filters */}
          <button
            onClick={() => setShowFilters(s => !s)}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm font-medium transition ${showFilters ? 'border-[#C9A84C] text-[#C9A84C] bg-[#C9A84C]/5' : 'border-black/10 text-[#555] hover:bg-[#FAF7F2]'}`}
          >
            <SlidersHorizontal size={15} />
            Bộ lọc
            {(selectedCategory !== 'ALL' || sortBy !== 'name_asc') && (
              <span className="w-2 h-2 bg-[#C9A84C] rounded-full" />
            )}
          </button>
        </div>

        {showFilters && (
          <div className="pt-2 border-t border-black/5 space-y-3">
            {/* Category filter */}
            {categories.length > 2 && (
              <div>
                <label className="text-xs font-semibold text-[#8E8878] uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Tag size={11} /> Danh mục
                </label>
                <div className="flex flex-wrap gap-2">
                  {categories.map(cat => (
                    <button key={cat} onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${selectedCategory === cat
                        ? 'bg-[#C9A84C] text-white'
                        : 'bg-[#FAF7F2] text-[#555] hover:bg-[#C9A84C]/10'}`}>
                      {cat === 'ALL' ? 'Tất cả' : cat}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Sort */}
            <div>
              <label className="text-xs font-semibold text-[#8E8878] uppercase tracking-wider mb-2 flex items-center gap-1">
                <ArrowUpDown size={11} /> Sắp xếp
              </label>
              <div className="flex flex-wrap gap-2">
                {SORT_OPTIONS.map(opt => {
                  const Icon = opt.icon;
                  return (
                    <button key={opt.value} onClick={() => setSortBy(opt.value)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${sortBy === opt.value
                        ? 'bg-[#C9A84C] text-white'
                        : 'bg-[#FAF7F2] text-[#555] hover:bg-[#C9A84C]/10'}`}>
                      <Icon size={12} /> {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-[#C9A84C]/30 border-t-[#C9A84C] rounded-full animate-spin" />
        </div>
      ) : filteredRows.length === 0 ? (
        <EmptyState icon={Package} message="Không có nguyên liệu nào" />
      ) : (
        <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 border-b border-black/5 flex items-center gap-2">
            <span className="text-sm text-[#8E8878]">Hiển thị {filteredRows.length} nguyên liệu</span>
            {currentSort && (
              <span className="text-xs bg-[#FAF7F2] px-2 py-0.5 rounded-full text-[#8E8878]">
                Sắp xếp: {currentSort.label}
              </span>
            )}
          </div>
          <div className="divide-y divide-black/5">
            {filteredRows.map(row => (
              <IngredientRow key={row.ingredientId} row={row} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function IngredientRow({ row }) {
  const [open, setOpen] = useState(false);
  const expiryBadge = row.expiryBadge;

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#FAF7F2]/60 transition text-left"
      >
        {row.imageUrl && (
          <img src={getImageUrl(row.imageUrl)} alt="" className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
        )}
        {!row.imageUrl && (
          <div className="w-10 h-10 rounded-xl bg-[#FAF7F2] flex items-center justify-center flex-shrink-0">
            <Package size={18} className="text-[#C9A84C]" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-[#1C1C1E] text-sm">{row.ingredientName}</p>
            {expiryBadge === 'DANGER'  && <AlertCircle size={13} className="text-red-500 flex-shrink-0" />}
            {expiryBadge === 'WARNING' && <AlertTriangle size={13} className="text-amber-500 flex-shrink-0" />}
          </div>
          <p className="text-xs text-[#8E8878]">
            {row.category || row.unit || '—'} · {row.expiryList?.length || 0} lô
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="font-bold text-[#1C1C1E]">{formatNumber(row.stockQuantity)}</p>
          <p className="text-xs text-[#8E8878]">{row.unit}</p>
        </div>
      </button>

      {open && row.expiryList?.length > 0 && (
        <div className="bg-[#FAF7F2] px-4 py-3 border-t border-black/5">
          <p className="text-xs font-semibold text-[#8E8878] uppercase tracking-wider mb-2">Chi tiết lô</p>
          <div className="space-y-1.5">
            {row.expiryList.map(e => (
              <div key={e.id} className="flex items-center justify-between text-xs">
                <span className="text-[#555]">
                  HSD: {e.expiryDate ? formatDate(e.expiryDate) : 'Không có HSD'}
                </span>
                <div className="flex items-center gap-3">
                  <span className="font-medium text-[#1C1C1E]">{formatNumber(e.quantity)} {row.unit}</span>
                  <ExpiryBadge expiryDate={e.expiryDate} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
