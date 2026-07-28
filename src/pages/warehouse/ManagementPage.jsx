// src/pages/warehouse/ManagementPage.jsx
// FIX 1: Popup hạn sử dụng không tràn màn hình — luôn hiển thị vào trong
// FIX 2: Hiển thị category/subcategory dạng cây, collapse/expand
// ADDED: WarehouseSelector — chọn kho cho tài khoản quản lý nhiều kho
import { useLang } from '../../context/LangContext';
import { useState, useEffect, useRef, useMemo } from 'react';
import { Sk, StatCardSkeleton, TableSkeleton } from '../../components/ui/Skeleton.jsx';
import useMinLoading from '../../hooks/useMinLoading.js';
import { warehouseApi, getImageUrl } from '../../api/warehouseApi';
import { useAuth } from '../../context/AuthContext';
import { useWarehouse } from '../../context/WarehouseContext';
import WarehouseSelector from '../../components/warehouse/WarehouseSelector';
import { ChevronRight, ChevronDown, Layers, ClipboardList } from 'lucide-react';
import InventoryCheckExportModal from '../../components/warehouse/InventoryCheckExportModal.jsx';
import Modal from '../../components/ui/Modal';

const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return Math.round((d - TODAY) / 86400000);
}

// ── LotBadge + modal chi tiết lô ─────────────────────────────────────────────
//   Thay dropdown cũ (bị card overflow:hidden cắt mất) bằng nút màu mở MODAL.
//   Màu badge do BE tính (freshnessBadge), giống trang kho OWNER/ADMIN.
const FRESHNESS = {
  EXPIRED_OR_CRITICAL: { bar: '#ea580c', label: 'Có lô đã/sắp hết hạn (dưới 7 ngày)' },
  NEAR_EXPIRY:         { bar: '#f59e0b', label: 'Có lô gần hết hạn (trong 1 tháng)' },
  NEWLY_STOCKED:       { bar: '#38bdf8', label: 'Có lô mới nhập (dưới 1 tháng)' },
};

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

function LotDetailModal({ open, onClose, item }) {
  if (!item) return null;
  const lots = item.expiryList || [];
  const fmtMoney = (v) => Number(v || 0).toLocaleString('vi-VN') + 'đ';
  const totalQty  = lots.reduce((s, l) => s + Number(l.quantity || 0), 0);
  const totalCost = lots.reduce((s, l) => s + Number(l.lotCost || 0), 0);
  return (
    <Modal open={open} onClose={onClose} title={`Chi tiết lô — ${item.ingredientName}`} size="lg">
      {lots.length === 0 ? (
        <p style={{ fontSize: 13, color: '#8E8878', textAlign: 'center', padding: '32px 0' }}>
          Nguyên liệu này chưa có lô nào còn hàng.
        </p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.5px', color: '#8E8878', borderBottom: '1px solid rgba(0,0,0,.06)' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left' }}>Thời gian nhập</th>
                <th style={{ padding: '8px 12px', textAlign: 'right' }}>Số lượng tồn</th>
                <th style={{ padding: '8px 12px', textAlign: 'left' }}>Hạn sử dụng</th>
              </tr>
            </thead>
            <tbody>
              {lots.map((lot, i) => {
                const d = daysUntil(lot.expiryDate);
                const expColor = d == null ? '#8E8878' : d < 7 ? '#ea580c' : d <= 30 ? '#d97706' : '#1C1C1E';
                const imported = fmtDateTime(lot.importedAt);
                const expText = lot.expiryDate
                  ? `${fmtDate(lot.expiryDate)}${d != null ? (d < 0 ? ' (đã hết hạn)' : ` (còn ${d} ngày)`) : ''}`
                  : (lot.tracked === false ? '—' : 'Không có hạn');
                return (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(0,0,0,.05)' }}>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: '#1C1C1E' }}>
                      {imported || <span style={{ color: '#8E8878', fontStyle: 'italic' }}>Không rõ</span>}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>
                      {Number(lot.quantity).toLocaleString('vi-VN')}
                      <span style={{ fontSize: 11, color: '#8E8878', fontWeight: 400, marginLeft: 4 }}>{item.unit}</span>
                    </td>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: expColor, fontWeight: d != null && d <= 30 ? 600 : 400 }}>{expText}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '1px solid rgba(0,0,0,.1)', fontWeight: 600 }}>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: '#8E8878' }}>Tổng</td>
                <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                  {totalQty.toLocaleString('vi-VN')}
                  <span style={{ fontSize: 11, color: '#8E8878', fontWeight: 400, marginLeft: 4 }}>{item.unit}</span>
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
          <p style={{ fontSize: 11, color: '#8E8878', marginTop: 8 }}>
            Sắp theo hạn sử dụng gần nhất trước; lô không có hạn xếp cuối.
            {lots.some(l => l.tracked === false) && ' Dòng "Không rõ" là phần tồn chưa gắn lô.'}
          </p>
        </div>
      )}
    </Modal>
  );
}

function ExpiryCell({ item }) {
  const [open, setOpen] = useState(false);
  const fresh = FRESHNESS[item.freshnessBadge];
  const lotCount = (item.expiryList || []).length;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
      {fresh && (
        <span title={fresh.label} style={{
          width: 10, height: 10, borderRadius: '50%', background: fresh.bar, flexShrink: 0,
        }} />
      )}
      <button onClick={() => setOpen(true)} style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        background: 'none', border: 'none', cursor: 'pointer',
        color: 'var(--wh-accent)', fontSize: 12, fontWeight: 600, padding: '2px 4px',
      }} title="Xem chi tiết lô">
        <Layers size={13} /> Chi tiết
        {lotCount > 0 && <span style={{ fontSize: 10, color: 'var(--wh-muted)' }}>({lotCount})</span>}
      </button>
      <LotDetailModal open={open} onClose={() => setOpen(false)} item={item} />
    </div>
  );
}

// ── Category tree row ─────────────────────────────────────────────────────────
function CategorySection({ cat, subCats, ingredients, categoryMap, search }) {
  const { t } = useLang();
  const [expanded, setExpanded] = useState(true);

  const catIngredients = useMemo(() => {
    const subCatIds = new Set(subCats.map(s => String(s.id)));
    return ingredients.filter(s => {
      if (String(s.categoryId) !== String(cat.id)) return false;
      return !s.subCategoryId || !subCatIds.has(String(s.subCategoryId));
    });
  }, [ingredients, cat.id, subCats]);

  if (ingredients.length === 0 && subCats.length === 0) return null;

  return (
    <div style={{ marginBottom: 12 }}>
      <div
        onClick={() => setExpanded(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
          padding: '10px 14px', background: 'var(--wh-bg)',
          borderRadius: 10, border: '1px solid var(--wh-border)',
          borderBottomLeftRadius: expanded ? 0 : 10,
          borderBottomRightRadius: expanded ? 0 : 10,
        }}
      >
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: 'rgba(201,168,76,.12)', overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          {cat.imageUrl
            ? <img src={cat.imageUrl.startsWith('http') ? cat.imageUrl : `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:9261'}/api/auth${cat.imageUrl}`}
              alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <Layers size={16} style={{ color: 'var(--wh-accent)' }} />
          }
        </div>
        <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--wh-text)', flex: 1 }}>{cat.name}</span>
        <span style={{
          fontSize: 11, color: 'var(--wh-muted)',
          background: 'rgba(201,168,76,.1)', borderRadius: 99,
          padding: '2px 8px', fontWeight: 600,
        }}>
          {t('warehouse', 'ingredient_count').replace('{n}', ingredients.length)}
        </span>
        <span style={{ color: 'var(--wh-muted)', fontSize: 14 }}>
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
      </div>

      {expanded && (
        <div style={{
          border: '1px solid var(--wh-border)', borderTop: 'none',
          borderBottomLeftRadius: 10, borderBottomRightRadius: 10, overflow: 'hidden',
        }}>
          {subCats.map(sub => (
            <SubCategorySection key={sub.id} sub={sub} allIngredients={ingredients} search={search} />
          ))}
          {catIngredients.map(s => (
            <IngredientRow key={s.ingredientId} s={s} indent={subCats.length > 0} />
          ))}
          {subCats.length === 0 && catIngredients.length === 0 && (
            <div style={{ padding: '12px 14px', color: 'var(--wh-muted)', fontSize: 13, fontStyle: 'italic' }}>
              Không có nguyên liệu
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SubCategorySection({ sub, allIngredients, search }) {
  const [expanded, setExpanded] = useState(true);
  const subIngredients = useMemo(
    () => allIngredients.filter(s => String(s.subCategoryId) === String(sub.id)),
    [allIngredients, sub.id]
  );
  if (subIngredients.length === 0) return null;

  return (
    <div>
      <div
        onClick={() => setExpanded(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
          padding: '8px 14px 8px 36px',
          background: 'rgba(201,168,76,.04)',
          borderBottom: '1px solid var(--wh-border)',
        }}
      >
        <div style={{
          width: 24, height: 24, borderRadius: 6,
          background: 'rgba(201,168,76,.1)', overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          {sub.imageUrl
            ? <img src={sub.imageUrl.startsWith('http') ? sub.imageUrl : `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:9261'}/api/auth${sub.imageUrl}`}
              alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <Layers size={11} style={{ color: 'var(--wh-accent)' }} />
          }
        </div>
        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--wh-text)', flex: 1 }}>{sub.name}</span>
        <span style={{ fontSize: 11, color: 'var(--wh-muted)', fontWeight: 600 }}>
          {subIngredients.length}
        </span>
        <span style={{ color: 'var(--wh-muted)', marginLeft: 4 }}>
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
      </div>
      {expanded && subIngredients.map(s => (
        <IngredientRow key={s.ingredientId} s={s} indent={true} subIndent={true} />
      ))}
    </div>
  );
}

function IngredientRow({ s, indent = false, subIndent = false }) {
  const isLow = Number(s.stockQuantity) < 5;
  // Nền hàng theo tình trạng lô — cùng bảng màu với chấm trong ExpiryCell.
  const ROW_BG = {
    EXPIRED_OR_CRITICAL: { bg: 'rgba(234,88,12,.07)',  bar: '#ea580c' },
    NEAR_EXPIRY:         { bg: 'rgba(245,158,11,.08)', bar: '#f59e0b' },
    NEWLY_STOCKED:       { bg: 'rgba(56,189,248,.08)', bar: '#38bdf8' },
  };
  const fresh = ROW_BG[s.freshnessBadge];
  const basePadLeft = subIndent ? 52 : indent ? 36 : 14;
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'minmax(0,1fr) auto auto auto',
      alignItems: 'center', gap: 12,
      padding: `9px 14px 9px ${basePadLeft}px`,
      borderBottom: '1px solid var(--wh-border)',
      background: fresh ? fresh.bg : 'white',
      // Dải màu bên trái cho dễ nhận, không phá layout grid.
      boxShadow: fresh ? `inset 3px 0 0 ${fresh.bar}` : 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
          background: '#f5f0eb', overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
        }}>
          {s.imageUrl
            ? <img src={getImageUrl(s.imageUrl)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : '🧂'
          }
        </div>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--wh-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
          {s.ingredientName}
        </span>
      </div>
      <span style={{ fontSize: 12, color: 'var(--wh-muted)', whiteSpace: 'nowrap' }}>{s.unit}</span>
      <span style={{
        fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
        padding: '2px 10px', borderRadius: 99,
        background: isLow ? 'rgba(234,88,12,.1)' : 'rgba(201,168,76,.1)',
        color: isLow ? 'var(--wh-warn)' : 'var(--wh-accent)',
      }}>
        {isLow && '⚠️ '}{Number(s.stockQuantity).toLocaleString('vi-VN')}
      </span>
      <div style={{ minWidth: 80 }}>
        <ExpiryCell item={s} />
      </div>
    </div>
  );
}

// ── Uncategorized section ─────────────────────────────────────────────────────
function UncategorizedSection({ ingredients }) {
  const { t } = useLang();
  const [expanded, setExpanded] = useState(true);
  if (ingredients.length === 0) return null;
  return (
    <div style={{ marginBottom: 12 }}>
      <div onClick={() => setExpanded(v => !v)} style={{
        display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
        padding: '10px 14px', background: 'var(--wh-bg)',
        borderRadius: 10, border: '1px solid var(--wh-border)',
        borderBottomLeftRadius: expanded ? 0 : 10,
        borderBottomRightRadius: expanded ? 0 : 10,
      }}>
        <span style={{ fontSize: 18 }}>📦</span>
        <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--wh-text)', flex: 1 }}>Chưa phân loại</span>
        <span style={{ fontSize: 11, color: 'var(--wh-muted)', background: 'rgba(0,0,0,.06)', borderRadius: 99, padding: '2px 8px', fontWeight: 600 }}>
          {t('warehouse', 'ingredient_count').replace('{n}', ingredients.length)}
        </span>
        {expanded ? <ChevronDown size={16} style={{ color: 'var(--wh-muted)' }} /> : <ChevronRight size={16} style={{ color: 'var(--wh-muted)' }} />}
      </div>
      {expanded && (
        <div style={{ border: '1px solid var(--wh-border)', borderTop: 'none', borderBottomLeftRadius: 10, borderBottomRightRadius: 10, overflow: 'hidden' }}>
          {ingredients.map(s => <IngredientRow key={s.ingredientId} s={s} />)}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ManagementPage() {
  const { t } = useLang();
  const { user } = useAuth();
  const { activeWarehouseId, activeWarehouseName, hasMultipleWarehouses } = useWarehouse();
  const [stocks, setStocks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subCategories, setSubCategories] = useState([]);
  const [ingredientMeta, setIngredientMeta] = useState([]);
  const [loading, setLoading] = useMinLoading();
  const [search, setSearch] = useState('');
  const [warehouseInfo, setWarehouseInfo] = useState(null);
  const [showInventoryExport, setShowInventoryExport] = useState(false);

  const warehouseId = activeWarehouseId || user?.warehouseId || user?.warehouse?.id;

  useEffect(() => {
    warehouseApi.getCategories()
      .then(r => setCategories(r.data?.data || []))
      .catch(() => { });
    warehouseApi.getAllSubCategories()
      .then(r => setSubCategories(r.data?.data || []))
      .catch(() => { });
    warehouseApi.getIngredients()
      .then(r => setIngredientMeta(r.data?.data || []))
      .catch(() => { });
  }, []);

  useEffect(() => {
    if (!warehouseId) {
      warehouseApi.getAll().then(res => {
        const list = res.data;
        if (list.length > 0) { setWarehouseInfo(list[0]); loadStock(list[0].id); }
      });
      return;
    }
    warehouseApi.getAll().then(res => {
      const found = res.data.find(w => w.id === Number(warehouseId));
      if (found) setWarehouseInfo(found);
    });
    loadStock(warehouseId);
  }, [warehouseId]);

  const loadStock = (whId) => {
    setLoading(true);
    warehouseApi.getStock(whId)
      .then(res => setStocks(res.data))
      .finally(() => setLoading(false));
  };

  const enrichedStocks = useMemo(() => {
    const metaMap = {};
    ingredientMeta.forEach(i => { metaMap[i.id] = i; });
    return stocks.map(s => {
      const meta = metaMap[s.ingredientId] || {};
      return {
        ...s,
        categoryId: meta.categoryId ?? null,
        subCategoryId: meta.subCategoryId ?? null,
      };
    });
  }, [stocks, ingredientMeta]);

  const rootCats = useMemo(() => categories, [categories]);

  const subCatMap = useMemo(() => {
    const m = {};
    subCategories.forEach(sub => {
      const key = String(sub.categoryId);
      if (!m[key]) m[key] = [];
      m[key].push(sub);
    });
    return m;
  }, [subCategories]);

  const filteredStocks = useMemo(() => {
    if (!search.trim()) return enrichedStocks;
    const q = search.toLowerCase();
    return enrichedStocks.filter(s => s.ingredientName?.toLowerCase().includes(q));
  }, [enrichedStocks, search]);

  const lowStockCount = filteredStocks.filter(s => Number(s.stockQuantity) < 5).length;

  const stocksByCat = useMemo(() => {
    const m = {};
    filteredStocks.forEach(s => {
      const key = s.categoryId ? String(s.categoryId) : '__none__';
      if (!m[key]) m[key] = [];
      m[key].push(s);
    });
    return m;
  }, [filteredStocks]);

  const uncategorized = stocksByCat['__none__'] || [];

  return (
    <div className="p-4 sm:p-6 lg:p-8 overflow-x-hidden">
      {/* ── Header với WarehouseSelector ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="wh-page-title" style={{ marginBottom: 4 }}>Quản lý kho nguyên liệu</h1>
          {warehouseInfo && (
            <span style={{ color: 'var(--wh-muted)', fontSize: 13 }}>
              {warehouseInfo.type === 'TRANSIT' ? '🔄 Kho trung chuyển' : '🏪 Kho bán hàng'}
              {' — '}<strong>{warehouseInfo.name}</strong>
              {warehouseInfo.address ? ` — ${warehouseInfo.address}` : ''}
            </span>
          )}
        </div>
        {/* Chọn kho — chỉ hiển thị nếu quản lý nhiều kho, hoặc luôn hiển thị để biết đang ở kho nào */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <WarehouseSelector />
          <button
            onClick={() => setShowInventoryExport(true)}
            title="Xuất phiếu kiểm kho"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 12,
              background: '#1A3C6E', color: '#fff',
              border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600,
              boxShadow: '0 2px 8px rgba(26,60,110,0.25)',
              whiteSpace: 'nowrap',
            }}
          >
            <ClipboardList size={15} />
            Phiếu kiểm kho
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 14, marginBottom: 24 }}>
        <StatCard icon="📦" label="Nguyên liệu" value={filteredStocks.length} color="var(--wh-accent)" />
        <StatCard icon="⚠️" label="Sắp hết" value={lowStockCount} color="var(--wh-warn)" />
        <StatCard icon="🏭" label="Loại kho" value={warehouseInfo?.type === 'TRANSIT' ? 'Trung chuyển' : 'Bán hàng'} color="var(--wh-accent2)" />
      </div>

      {/* Search */}
      <div style={{ marginBottom: 14 }}>
        <input
          className="wh-input"
          placeholder="🔍 Tìm nguyên liệu..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: 320 }}
        />
      </div>

      {/* Content */}
      {loading ? (
        <LoadingRows />
      ) : filteredStocks.length === 0 ? (
        <div className="wh-empty">
          <div className="wh-empty-icon">📭</div>
          <div>Không có nguyên liệu nào trong kho này</div>
        </div>
      ) : search.trim() ? (
        <div className="wh-table-wrap">
          <table className="wh-table">
            <thead>
              <tr>
                <th>Nguyên liệu</th>
                <th>Đơn vị</th>
                <th>Tồn kho</th>
                <th>Hạn sử dụng</th>
              </tr>
            </thead>
            <tbody>
              {filteredStocks.map(s => {
                const ROW_BG = {
                  EXPIRED_OR_CRITICAL: 'rgba(234,88,12,.07)',
                  NEAR_EXPIRY:         'rgba(245,158,11,.08)',
                  NEWLY_STOCKED:       'rgba(56,189,248,.08)',
                };
                const bg = ROW_BG[s.freshnessBadge];
                return (
                <tr key={s.ingredientId} style={bg ? { background: bg } : undefined}>
                  <td>
                    <div className="wh-ing-info">
                      {s.imageUrl
                        ? <img src={getImageUrl(s.imageUrl)} alt="" className="wh-ing-img" />
                        : <div className="wh-ing-img" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🧂</div>
                      }
                      <span style={{ fontWeight: 500 }}>{s.ingredientName}</span>
                    </div>
                  </td>
                  <td style={{ color: 'var(--wh-muted)' }}>{s.unit}</td>
                  <td>
                    <span className="wh-stock-qty"
                      style={Number(s.stockQuantity) < 5 ? { background: 'rgba(234,88,12,.1)', color: 'var(--wh-warn)' } : {}}>
                      {Number(s.stockQuantity) < 5 && '⚠️ '}
                      {Number(s.stockQuantity).toLocaleString('vi-VN')}
                    </span>
                  </td>
                  <td><ExpiryCell item={s} /></td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div>
          {rootCats.map(cat => {
            const subCats = subCatMap[cat.id] || [];
            const directAndSub = filteredStocks.filter(s => String(s.categoryId) === String(cat.id));
            if (directAndSub.length === 0) return null;
            return (
              <CategorySection
                key={cat.id}
                cat={cat}
                subCats={subCats.filter(sub => filteredStocks.some(s => String(s.subCategoryId) === String(sub.id)))}
                ingredients={directAndSub}
                search={search}
              />
            );
          })}
          <UncategorizedSection ingredients={uncategorized} />
        </div>
      )}

      {showInventoryExport && (
        <InventoryCheckExportModal
          stocks={stocks}
          categories={categories}
          subCategories={subCategories}
          ingredientMeta={ingredientMeta}
          warehouseId={warehouseId}
          warehouseName={warehouseInfo?.name}
          onClose={() => setShowInventoryExport(false)}
        />
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color }) {
  return (
    <div className="wh-card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{icon}</div>
      <div>
        <div style={{ color: 'var(--wh-muted)', fontSize: 12, marginBottom: 2 }}>{label}</div>
        <div style={{ fontWeight: 700, fontSize: 20, color }}>{value}</div>
      </div>
    </div>
  );
}

function LoadingRows() {
  return (
    <div className="wh-table-wrap">
      <table className="wh-table">
        <tbody>
          {[1, 2, 3, 4].map(i => (
            <tr key={i}>
              {[1, 2, 3, 4].map(j => (
                <td key={j}><div style={{ height: 18, background: '#f0ebe3', borderRadius: 4, animation: 'pulse 1.5s infinite' }} /></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}