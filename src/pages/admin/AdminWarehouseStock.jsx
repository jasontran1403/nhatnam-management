// src/pages/admin/AdminWarehouseStock.jsx
import { useLang } from '../../context/LangContext';
import Modal from '../../components/ui/Modal';
import { useEffect, useState, useMemo } from 'react';
import { CardSkeleton, Sk } from '../../components/ui/Skeleton.jsx';
import useMinLoading from '../../hooks/useMinLoading.js';
import { useParams, useNavigate } from 'react-router-dom';
import { adminWarehouseApi, adminWarehouseStockApi } from '../../api/adminApi';
import {
  ArrowLeft, Package, DollarSign, Search, X,
  ChevronDown, ChevronRight, Layers, Calendar,
} from 'lucide-react';
import {
  PageHeader, LoadingSpinner, EmptyState,
  formatCurrency, formatNumber,
} from '../../components/ui';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
// Màu tình trạng lô — ưu tiên gắt nhất đã được BE quyết, FE chỉ tô.
//   EXPIRED_OR_CRITICAL: đỏ cam · NEAR_EXPIRY: vàng · NEWLY_STOCKED: xanh dương nhạt
const FRESHNESS = {
  EXPIRED_OR_CRITICAL: {
    row: 'bg-orange-50 dark:bg-orange-500/10 hover:bg-orange-100/70 dark:bg-orange-500/13',
    dot: 'bg-orange-500',
    label: 'Có lô đã/sắp hết hạn (dưới 7 ngày)',
  },
  NEAR_EXPIRY: {
    row: 'bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-100/70 dark:bg-amber-500/13',
    dot: 'bg-amber-400',
    label: 'Có lô gần hết hạn (trong 1 tháng)',
  },
  NEWLY_STOCKED: {
    row: 'bg-sky-50 dark:bg-sky-500/10 hover:bg-sky-100/70 dark:bg-sky-500/13',
    dot: 'bg-sky-400',
    label: 'Có lô mới nhập (dưới 1 tháng)',
  },
};

function imgUrl(p) {
  if (!p) return null;
  return p.startsWith('http') ? p : `${BASE_URL}/api/auth${p}`;
}

// ── Single ingredient row ─────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return null;
  const [y, m, d] = String(iso).split('-');
  return `${d}/${m}/${y}`;
}

function fmtDateTime(ms) {
  if (!ms) return null;
  const dt = new Date(Number(ms));
  const p = (n) => String(n).padStart(2, '0');
  return `${p(dt.getHours())}:${p(dt.getMinutes())} ${p(dt.getDate())}/${p(dt.getMonth() + 1)}/${dt.getFullYear()}`;
}

// Số ngày tới hạn (âm = đã hết hạn). Dùng để tô màu từng lô trong modal.
function daysUntil(iso) {
  if (!iso) return null;
  const [y, m, d] = String(iso).split('-').map(Number);
  const exp = new Date(y, m - 1, d);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((exp - today) / 86400000);
}

function LotDetailModal({ open, onClose, item }) {
  if (!item) return null;
  const lots = item.lots || [];
  return (
    <Modal open={open} onClose={onClose}
      title={`Chi tiết lô — ${item.ingredientName}`} size="lg">
      {lots.length === 0 ? (
        <p className="text-sm text-muted text-center py-8">
          Nguyên liệu này chưa có lô nào còn hàng.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-muted border-b border-hairline">
                <th className="px-3 py-2 text-left">Thời gian nhập</th>
                <th className="px-3 py-2 text-right">Số lượng tồn</th>
                <th className="px-3 py-2 text-right">Giá vốn</th>
                <th className="px-3 py-2 text-left">Hạn sử dụng</th>
              </tr>
            </thead>
            <tbody>
              {lots.map((lot, i) => {
                const d = daysUntil(lot.expiryDate);
                // Cùng ngưỡng với badge: <7 đỏ cam, ≤30 vàng, còn lại thường.
                const expCls = d == null ? 'text-muted'
                  : d < 7 ? 'text-orange-600 dark:text-orange-300 font-semibold'
                  : d <= 30 ? 'text-amber-600 dark:text-amber-300 font-medium'
                  : 'text-ink';
                const importedText = fmtDateTime(lot.importedAt);
                const expText = lot.expiryDate
                  ? `${fmtDate(lot.expiryDate)}${d != null ? (d < 0 ? ' (đã hết hạn)' : ` (còn ${d} ngày)`) : ''}`
                  : (lot.tracked === false ? '—' : 'Không có hạn');
                return (
                  <tr key={i} className="border-b border-hairline last:border-0">
                    <td className="px-3 py-2.5 text-ink whitespace-nowrap">
                      {importedText || <span className="text-muted italic">Không rõ</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium text-ink">
                      {formatNumber(lot.quantity)}
                      <span className="text-xs text-muted font-normal ml-1">{item.unit}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right text-gold font-medium whitespace-nowrap">
                      {lot.lotCost != null ? formatCurrency(lot.lotCost) : '—'}
                    </td>
                    <td className={`px-3 py-2.5 whitespace-nowrap ${expCls}`}>{expText}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-hairline-2 font-semibold">
                <td className="px-3 py-2.5 text-right text-muted">Tổng</td>
                <td className="px-3 py-2.5 text-right text-ink">
                  {formatNumber(lots.reduce((sum, l) => sum + Number(l.quantity || 0), 0))}
                  <span className="text-xs text-muted font-normal ml-1">{item.unit}</span>
                </td>
                <td className="px-3 py-2.5 text-right text-gold">
                  {formatCurrency(lots.reduce((sum, l) => sum + Number(l.lotCost || 0), 0))}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
          <p className="text-[11px] text-muted mt-2">
            Sắp theo hạn sử dụng gần nhất trước; lô không có hạn xếp cuối.
            {lots.some(l => l.tracked === false) && ' Dòng "Không rõ" là phần tồn chưa gắn lô (nhập trước khi theo dõi lô hoặc điều chỉnh tồn tay).'}
          </p>
        </div>
      )}
    </Modal>
  );
}

function IngredientRow({ item }) {
  const fresh = FRESHNESS[item.freshnessBadge];   // undefined = bình thường (trắng)
  const [lotOpen, setLotOpen] = useState(false);
  const lotCount = (item.lots || []).length;
  return (
    <div title={fresh?.label}
      className={`flex items-center gap-3 px-4 py-3 border-b border-line-soft last:border-0 transition-colors
        ${fresh ? fresh.row : 'hover:bg-canvas'}`}>
      {fresh
        ? <span className={`w-1.5 h-8 rounded-full flex-shrink-0 ${fresh.dot}`} />
        : null}
      {item.imageUrl
        ? <img src={imgUrl(item.imageUrl)} alt={item.ingredientName}
            className="w-8 h-8 rounded-lg object-cover border border-line flex-shrink-0" />
        : <div className="w-8 h-8 rounded-lg bg-surface-2 flex items-center justify-center text-sm flex-shrink-0">🧂</div>
      }
      <div className="flex-1 min-w-0">
        <p className="font-medium text-ink text-sm truncate">{item.ingredientName}</p>
        <p className="text-xs text-muted">{item.unit}</p>
      </div>
      <div className="text-right flex-shrink-0 min-w-[80px]">
        <p className={`font-semibold text-sm ${
          Number(item.stockQuantity) <= 0 ? 'text-red-500'
          : Number(item.stockQuantity) <= 5 ? 'text-amber-500'
          : 'text-ink'}`}>
          {formatNumber(item.stockQuantity)}
          <span className="text-xs text-muted font-normal ml-1">{item.unit}</span>
        </p>
        <p className="text-xs font-medium text-gold">
          {Number(item.totalCostValue) > 0 ? formatCurrency(item.totalCostValue) : '—'}
        </p>
      </div>
      <button type="button" onClick={() => setLotOpen(true)}
        className="flex-shrink-0 inline-flex items-center gap-1 text-xs font-semibold
          text-gold hover:text-gold-strong px-2 py-1 rounded-lg hover:bg-gold/10 transition-colors"
        title="Xem chi tiết lô">
        <Layers size={13} />
        <span className="hidden sm:inline">Chi tiết</span>
        {lotCount > 0 && <span className="text-[10px] text-muted">({lotCount})</span>}
      </button>
      <LotDetailModal open={lotOpen} onClose={() => setLotOpen(false)} item={item} />
    </div>
  );
}

// ── SubCategory section ───────────────────────────────────────────────────────
function SubCategorySection({ name, items }) {
  const { t } = useLang();
  const [open, setOpen] = useState(true);
  const totalCost = items.reduce((s, i) => s + Number(i.totalCostValue || 0), 0);

  // Danh mục con rỗng không hiện lên giao diện.
  if (!items || items.length === 0) return null;

  return (
    <div className="ml-4 border-l-2 border-line-soft mb-1">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-canvas transition text-left"
      >
        {open
          ? <ChevronDown  size={13} className="text-faint flex-shrink-0" />
          : <ChevronRight size={13} className="text-faint flex-shrink-0" />}
        <span className="text-xs font-semibold text-ink-2 flex-1 truncate">
          {name || t('warehouse','uncategorized')}
        </span>
        <span className="text-[10px] text-muted flex-shrink-0 mr-2">{items.length} NL</span>
        {totalCost > 0 && (
          <span className="text-[10px] text-gold font-semibold flex-shrink-0">
            {formatCurrency(totalCost)}
          </span>
        )}
      </button>

      {open && (
        <div className="bg-surface rounded-xl mx-2 mb-2 border border-hairline overflow-hidden">
          {items.map(item => <IngredientRow key={item.ingredientId} item={item} />)}
        </div>
      )}
    </div>
  );
}

// ── Category section ──────────────────────────────────────────────────────────
function CategorySection({ name, items }) {
  const { t } = useLang();
  const [open, setOpen] = useState(true);

  // Group by subCategory — nhóm rỗng bị loại luôn ở đây.
  const subGroups = useMemo(() => {
    const map = new Map();
    (items || []).forEach(item => {
      const key = item.subCategoryName || '__none__';
      if (!map.has(key)) map.set(key, { name: item.subCategoryName || null, items: [] });
      map.get(key).items.push(item);
    });
    return Array.from(map.values())
      .filter(g => g.items.length > 0)
      .sort((a, b) => {
        if (!a.name && b.name) return 1;
        if (a.name && !b.name) return -1;
        return (a.name || '').localeCompare(b.name || '', 'vi');
      });
  }, [items]);

  // Danh mục không còn nguyên liệu nào (VD: bị lọc hết do tìm kiếm, hoặc mọi
  // nguyên liệu đã gỡ khỏi kho) thì không dựng khối nào cả.
  if (!items || items.length === 0) return null;

  const totalCost  = items.reduce((s, i) => s + Number(i.totalCostValue || 0), 0);
  const hasSubCats = subGroups.length > 1 || subGroups[0]?.name;

  return (
    <div className="bg-surface rounded-2xl border border-hairline shadow-sm overflow-hidden mb-3">
      {/* Category header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2.5 px-4 py-3 bg-canvas hover:bg-surface-2
          transition text-left border-b border-hairline"
      >
        {open
          ? <ChevronDown  size={15} className="text-gold flex-shrink-0" />
          : <ChevronRight size={15} className="text-gold flex-shrink-0" />}
        <span className="font-bold text-ink flex-1 truncate">{name}</span>
        <span className="text-xs text-muted flex-shrink-0 mr-3">{t('warehouse','ingredient_count').replace('{n}',items.length)}</span>
        {totalCost > 0 && (
          <span className="text-sm font-bold text-gold flex-shrink-0">
            {formatCurrency(totalCost)}
          </span>
        )}
      </button>

      {open && (
        <>
          {hasSubCats
            ? subGroups.map(sg => (
                <SubCategorySection
                  key={sg.name || '__none__'}
                  name={sg.name}
                  items={sg.items}
                />
              ))
            : items.map(item => <IngredientRow key={item.ingredientId} item={item} />)
          }
        </>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AdminWarehouseStock() {
  const { t } = useLang();
  const { id }    = useParams();
  const navigate  = useNavigate();

  const [warehouse,   setWarehouse]   = useState(null);
  const [items,       setItems]       = useState([]);
  const [grandTotal,  setGrandTotal]  = useState(0);
  const [loading, setLoading] = useMinLoading();
  const [q,           setQ]           = useState('');

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

  // Search filter
  const filteredItems = useMemo(() => {
    if (!q.trim()) return items;
    const lq = q.trim().toLowerCase();
    return items.filter(i => i.ingredientName?.toLowerCase().includes(lq));
  }, [items, q]);

  // Group by category
  const categoryGroups = useMemo(() => {
    const map = new Map();
    filteredItems.forEach(item => {
      const key  = item.categoryId   || '__none__';
      const name = item.categoryName || t('warehouse','uncategorized');
      if (!map.has(key)) map.set(key, { id: key, name, items: [] });
      map.get(key).items.push(item);
    });
    return Array.from(map.values())
      .filter(g => g.items.length > 0)
      .sort((a, b) => {
        if (a.id === '__none__') return 1;
        if (b.id === '__none__') return -1;
        return a.name.localeCompare(b.name, 'vi');
      });
  }, [filteredItems]);

  // Grand total of currently visible items
  const visibleTotal = filteredItems.reduce((s, i) => s + Number(i.totalCostValue || 0), 0);

  if (loading) return <div className="p-8 space-y-4"><TableSkeleton cols={4} rows={8} /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)}
          className="p-2 rounded-xl bg-surface-2 hover:bg-surface-3 text-ink-2 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <PageHeader
          icon={Package}
          title={warehouse?.name || t('warehouse','warehouse')}
          subtitle={`${t('warehouse','ingredient_count').replace('{n}',items.length)}${warehouse?.address ? ` — ${warehouse.address}` : ''}`}
        />
      </div>

      {/* Tổng giá vốn */}
      <div className="bg-gradient-to-br from-amber-50 dark:from-amber-500/10 to-orange-50 dark:to-orange-500/10 border border-amber-200 dark:border-amber-500/28 rounded-2xl p-4 flex items-center gap-4">
        <div className="p-3 bg-amber-100 dark:bg-amber-500/18 rounded-xl">
          <DollarSign size={22} className="text-amber-600 dark:text-amber-300" />
        </div>
        <div>
          <p className="text-xs text-amber-600 dark:text-amber-300 font-medium uppercase tracking-wide">Tổng giá vốn tồn kho</p>
          <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{formatCurrency(grandTotal)}</p>
        </div>
      </div>

      {/* Chú thích màu tình trạng lô */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted">
        <span className="font-medium text-ink-2">Tình trạng lô:</span>
        {[
          ['bg-orange-500', 'Đã/sắp hết hạn (dưới 7 ngày)'],
          ['bg-amber-400', 'Gần hết hạn (trong 1 tháng)'],
          ['bg-sky-400', 'Mới nhập (dưới 1 tháng)'],
        ].map(([dot, label]) => (
          <span key={label} className="inline-flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${dot}`} />
            {label}
          </span>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          {...{placeholder: t("ingredient","search_placeholder")}}
          className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-hairline-2 text-sm
            bg-surface focus:outline-none focus:ring-2 focus:ring-gold/40"
        />
        {q && (
          <button onClick={() => setQ('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Result info */}
      {q && (
        <p className="text-xs text-muted">
          Tìm thấy <strong>{filteredItems.length}</strong> / {t('warehouse','ingredient_count').replace('{n}',items.length)}
          {visibleTotal > 0 && <> · Giá vốn hiển thị: <strong className="text-gold">{formatCurrency(visibleTotal)}</strong></>}
        </p>
      )}

      {/* Content */}
      {filteredItems.length === 0 ? (
        <EmptyState icon={Package}
          title={q ? `Không tìm thấy "${q}"` : 'Kho chưa có nguyên liệu'} />
      ) : (
        <div>
          {categoryGroups.map(cg => (
            <CategorySection key={cg.id} name={cg.name} items={cg.items} />
          ))}
        </div>
      )}
    </div>
  );
}