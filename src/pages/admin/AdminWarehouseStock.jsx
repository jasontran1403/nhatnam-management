// src/pages/admin/AdminWarehouseStock.jsx
import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminWarehouseApi, adminWarehouseStockApi } from '../../api/adminApi';
import {
  ArrowLeft, Package, DollarSign, Search, SlidersHorizontal,
  ArrowUp, ArrowDown, ArrowUpDown, Tag, X,
} from 'lucide-react';
import {
  PageHeader, LoadingSpinner, EmptyState,
  formatCurrency, formatNumber,
} from '../../components/admin/ui';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
function imgUrl(p) {
  if (!p) return null;
  return p.startsWith('http') ? p : `${BASE_URL}/api/auth${p}`;
}

const SORT_OPTIONS = [
  { value: 'name_asc',   label: 'Tên A → Z',      icon: ArrowUp   },
  { value: 'name_desc',  label: 'Tên Z → A',      icon: ArrowDown },
  { value: 'stock_desc', label: 'Tồn nhiều → ít', icon: ArrowDown },
  { value: 'stock_asc',  label: 'Tồn ít → nhiều', icon: ArrowUp   },
  { value: 'cost_desc',  label: 'Giá vốn cao → thấp', icon: ArrowDown },
  { value: 'cost_asc',   label: 'Giá vốn thấp → cao', icon: ArrowUp   },
];

export default function AdminWarehouseStock() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [warehouse, setWarehouse] = useState(null);
  const [items, setItems]         = useState([]);
  const [grandTotal, setGrandTotal] = useState(0);
  const [loading, setLoading]     = useState(true);

  // Filter / sort state
  const [q, setQ]                         = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [sortBy, setSortBy]               = useState('stock_desc');
  const [showFilters, setShowFilters]     = useState(false);

  useEffect(() => {
    Promise.all([
      adminWarehouseApi.getById(id),
      adminWarehouseStockApi.getStock(id),
    ]).then(([wh, stock]) => {
      setWarehouse(wh);
      setItems(stock.items || []);
      setGrandTotal(stock.grandTotalCostValue || 0);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  // Danh mục: lấy từ field `category` hoặc fallback `unit`
  const categories = useMemo(() => {
    const cats = new Set(items.map(i => i.category || i.unit || '—'));
    return ['ALL', ...Array.from(cats).sort()];
  }, [items]);

  // Filter + Sort
  const filtered = useMemo(() => {
    let result = [...items];

    if (q.trim()) {
      const lq = q.trim().toLowerCase();
      result = result.filter(i => i.ingredientName?.toLowerCase().includes(lq));
    }

    if (selectedCategory !== 'ALL') {
      result = result.filter(i => (i.category || i.unit || '—') === selectedCategory);
    }

    switch (sortBy) {
      case 'name_asc':   result.sort((a, b) => (a.ingredientName || '').localeCompare(b.ingredientName || '', 'vi')); break;
      case 'name_desc':  result.sort((a, b) => (b.ingredientName || '').localeCompare(a.ingredientName || '', 'vi')); break;
      case 'stock_desc': result.sort((a, b) => Number(b.stockQuantity || 0) - Number(a.stockQuantity || 0)); break;
      case 'stock_asc':  result.sort((a, b) => Number(a.stockQuantity || 0) - Number(b.stockQuantity || 0)); break;
      case 'cost_desc':  result.sort((a, b) => Number(b.totalCostValue || 0) - Number(a.totalCostValue || 0)); break;
      case 'cost_asc':   result.sort((a, b) => Number(a.totalCostValue || 0) - Number(b.totalCostValue || 0)); break;
    }

    return result;
  }, [items, q, selectedCategory, sortBy]);

  const hasActiveFilter = q || selectedCategory !== 'ALL' || sortBy !== 'stock_desc';

  if (loading) return <div className="p-8"><LoadingSpinner /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)}
          className="p-2 rounded-xl bg-[#F0EBE3] hover:bg-[#E8DDD0] text-[#5C4E3D] transition-colors">
          <ArrowLeft size={18} />
        </button>
        <PageHeader
          icon={Package}
          title={warehouse?.name || 'Kho hàng'}
          subtitle={`${items.length} nguyên liệu — ${warehouse?.address || ''}`}
        />
      </div>

      {/* Tổng giá vốn */}
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-4">
        <div className="p-3 bg-amber-100 rounded-xl">
          <DollarSign size={22} className="text-amber-600" />
        </div>
        <div>
          <p className="text-xs text-amber-600 font-medium uppercase tracking-wide">Tổng giá vốn tồn kho</p>
          <p className="text-2xl font-bold text-amber-700">{formatCurrency(grandTotal)}</p>
        </div>
      </div>

      {/* Search + Filter bar */}
      <div className="bg-white rounded-2xl border border-[#E8DDD0] p-3 sm:p-4 space-y-3">
        <div className="flex gap-2 items-center">
          {/* Search */}
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8878]" />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Tìm tên nguyên liệu..."
              className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-black/10 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/40"
            />
            {q && (
              <button onClick={() => setQ('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8E8878] hover:text-[#1C1C1E]">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Toggle filter panel */}
          <button
            onClick={() => setShowFilters(s => !s)}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm font-medium transition whitespace-nowrap
              ${showFilters ? 'border-[#C9A84C] text-[#C9A84C] bg-[#C9A84C]/5' : 'border-black/10 text-[#555] hover:bg-[#FAF7F2]'}`}
          >
            <SlidersHorizontal size={15} />
            Bộ lọc
            {hasActiveFilter && <span className="w-2 h-2 bg-[#C9A84C] rounded-full" />}
          </button>

          {/* Quick reset */}
          {hasActiveFilter && (
            <button
              onClick={() => { setQ(''); setSelectedCategory('ALL'); setSortBy('stock_desc'); }}
              className="px-3 py-2.5 rounded-xl border border-red-200 text-red-500 text-sm hover:bg-red-50 transition whitespace-nowrap"
            >
              Xoá lọc
            </button>
          )}
        </div>

        {showFilters && (
          <div className="pt-3 border-t border-black/5 space-y-3">

            {/* Category filter */}
            {categories.length > 2 && (
              <div>
                <p className="text-xs font-semibold text-[#8E8878] uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Tag size={11} /> Danh mục / Đơn vị
                </p>
                <div className="flex flex-wrap gap-2">
                  {categories.map(cat => (
                    <button key={cat} onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition
                        ${selectedCategory === cat
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
              <p className="text-xs font-semibold text-[#8E8878] uppercase tracking-wider mb-2 flex items-center gap-1">
                <ArrowUpDown size={11} /> Sắp xếp
              </p>
              <div className="flex flex-wrap gap-2">
                {SORT_OPTIONS.map(opt => {
                  const Icon = opt.icon;
                  return (
                    <button key={opt.value} onClick={() => setSortBy(opt.value)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition
                        ${sortBy === opt.value
                          ? 'bg-[#C9A84C] text-white'
                          : 'bg-[#FAF7F2] text-[#555] hover:bg-[#C9A84C]/10'}`}>
                      <Icon size={11} /> {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState icon={Package} title={q ? `Không tìm thấy "${q}"` : 'Kho chưa có nguyên liệu'} />
      ) : (
        <div className="bg-white rounded-2xl border border-[#E8DDD0] overflow-hidden">
          {/* Result count */}
          <div className="px-4 py-2.5 border-b border-[#F0EBE3] flex items-center gap-2 text-xs text-[#8E8878]">
            Hiển thị {filtered.length} / {items.length} nguyên liệu
            {selectedCategory !== 'ALL' && (
              <span className="bg-[#FAF7F2] px-2 py-0.5 rounded-full">
                {selectedCategory}
              </span>
            )}
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#FAF7F2] border-b border-[#E8DDD0]">
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#8E8878] uppercase">Nguyên liệu</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-[#8E8878] uppercase">Tồn kho</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-[#8E8878] uppercase">Giá vốn tích lũy</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, idx) => (
                <tr key={item.ingredientId}
                  className={`border-b border-[#F0EBE3] hover:bg-[#FAF7F2] transition-colors ${idx % 2 !== 0 ? 'bg-[#FDFBF8]' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {item.imageUrl
                        ? <img src={imgUrl(item.imageUrl)} alt={item.ingredientName}
                            className="w-8 h-8 rounded-lg object-cover border border-[#E8DDD0] flex-shrink-0" />
                        : <div className="w-8 h-8 rounded-lg bg-[#F0EBE3] flex items-center justify-center text-sm flex-shrink-0">🧂</div>
                      }
                      <div>
                        <p className="font-medium text-[#1C1C1E]">{item.ingredientName}</p>
                        <p className="text-xs text-[#8E8878]">{item.unit}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-semibold ${
                      Number(item.stockQuantity) <= 0 ? 'text-red-500'
                      : Number(item.stockQuantity) <= 5 ? 'text-amber-500'
                      : 'text-[#1C1C1E]'}`}>
                      {formatNumber(item.stockQuantity)}
                    </span>
                    <span className="text-xs text-[#8E8878] ml-1">{item.unit}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-[#C9A84C]">
                    {Number(item.totalCostValue) > 0
                      ? formatCurrency(item.totalCostValue)
                      : <span className="text-[#C4B9A8] font-normal">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-[#FAF7F2] border-t-2 border-[#E8DDD0]">
                <td colSpan={2} className="px-4 py-3 font-bold text-[#5C4E3D]">
                  Tổng cộng {filtered.length < items.length ? `(${filtered.length} đang hiển thị)` : ''}
                </td>
                <td className="px-4 py-3 text-right font-bold text-amber-600 text-base">
                  {formatCurrency(filtered.reduce((s, i) => s + Number(i.totalCostValue || 0), 0))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}