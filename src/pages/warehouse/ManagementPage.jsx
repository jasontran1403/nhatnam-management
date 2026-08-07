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
  EXPIRED_OR_CRITICAL: { bar: 'var(--c-warning)', label: 'Có lô đã/sắp hết hạn (dưới 7 ngày)' },
  NEAR_EXPIRY:         { bar: 'var(--c-warning)', label: 'Có lô gần hết hạn (trong 1 tháng)' },
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
        <p style={{ fontSize: 13, color: 'var(--c-muted)', textAlign: 'center', padding: '32px 0' }}>
          Nguyên liệu này chưa có lô nào còn hàng.
        </p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--c-muted)', borderBottom: '1px solid rgba(0,0,0,.06)' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left' }}>Thời gian nhập</th>
                <th style={{ padding: '8px 12px', textAlign: 'right' }}>Số lượng tồn</th>
                <th style={{ padding: '8px 12px', textAlign: 'left' }}>Hạn sử dụng</th>
              </tr>
            </thead>
            <tbody>
              {lots.map((lot, i) => {
                const d = daysUntil(lot.expiryDate);
                const expColor = d == null ? 'var(--c-muted)' : d < 7 ? 'var(--c-warning)' : d <= 30 ? '#d97706' : 'var(--c-ink)';
                const imported = fmtDateTime(lot.importedAt);
                const expText = lot.expiryDate
                  ? `${fmtDate(lot.expiryDate)}${d != null ? (d < 0 ? ' (đã hết hạn)' : ` (còn ${d} ngày)`) : ''}`
                  : (lot.tracked === false ? '—' : 'Không có hạn');
                return (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(0,0,0,.05)' }}>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: 'var(--c-ink)' }}>
                      {imported || <span style={{ color: 'var(--c-muted)', fontStyle: 'italic' }}>Không rõ</span>}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>
                      {Number(lot.quantity).toLocaleString('vi-VN')}
                      <span style={{ fontSize: 11, color: 'var(--c-muted)', fontWeight: 400, marginLeft: 4 }}>{item.unit}</span>
                    </td>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: expColor, fontWeight: d != null && d <= 30 ? 600 : 400 }}>{expText}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '1px solid rgba(0,0,0,.1)', fontWeight: 600 }}>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--c-muted)' }}>Tổng</td>
                <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                  {totalQty.toLocaleString('vi-VN')}
                  <span style={{ fontSize: 11, color: 'var(--c-muted)', fontWeight: 400, marginLeft: 4 }}>{item.unit}</span>
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
          <p style={{ fontSize: 11, color: 'var(--c-muted)', marginTop: 8 }}>
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

  // Danh mục không còn nguyên liệu nào thì không hiện lên giao diện.
  if (ingredients.length === 0) return null;

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
  // Chốt chặn cuối: dữ liệu đã được lọc ở trang, nhưng giữ lại để component này
  // dùng lại được ở chỗ khác mà không bao giờ vẽ ra một mục con trống.
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
  // Sắc nền pha từ token bằng color-mix, không dùng rgba cứng — rgba cam 7% trên
  // nền trắng thì nhạt vừa phải, nhưng trên nền tối lại gần như biến mất.
  const ROW_BG = {
    EXPIRED_OR_CRITICAL: { bg: 'color-mix(in srgb, var(--c-warning) 9%, var(--c-surface))',  bar: 'var(--c-warning)' },
    NEAR_EXPIRY:         { bg: 'color-mix(in srgb, var(--c-warning) 6%, var(--c-surface))', bar: 'var(--c-warning)' },
    NEWLY_STOCKED:       { bg: 'color-mix(in srgb, var(--c-info) 9%, var(--c-surface))', bar: 'var(--c-info)' },
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
      background: fresh ? fresh.bg : 'var(--c-surface)',
      // Dải màu bên trái cho dễ nhận, không phá layout grid.
      boxShadow: fresh ? `inset 3px 0 0 ${fresh.bar}` : 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
          background: 'var(--c-surface-2)', overflow: 'hidden',
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
  }, []);

  // Danh mục nguyên liệu phải theo ĐÚNG kho đang xem — nếu lấy danh mục dùng
  // chung thì nguyên liệu đã gỡ khỏi kho vẫn được gán category và hiện lên cây.
  //
  // Tồn kho và danh mục luôn tải theo CÙNG một id kho: tài khoản chưa gán kho sẽ
  // rơi vào kho đầu tiên, nếu hai lời gọi dùng hai id khác nhau thì cây danh mục
  // và bảng tồn sẽ lệch nhau.
  const loadForWarehouse = (whId) => {
    if (!whId) return;
    loadStock(whId);
    warehouseApi.getIngredients(whId)
      .then(r => setIngredientMeta(r.data?.data || []))
      .catch(() => { });
  };

  useEffect(() => {
    if (!warehouseId) {
      warehouseApi.getAll().then(res => {
        const list = res.data;
        if (list.length > 0) { setWarehouseInfo(list[0]); loadForWarehouse(list[0].id); }
      });
      return;
    }
    warehouseApi.getAll().then(res => {
      const found = res.data.find(w => w.id === Number(warehouseId));
      if (found) setWarehouseInfo(found);
    });
    loadForWarehouse(warehouseId);
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

    // Chốt chặn phía FE: chỉ hiện nguyên liệu CÓ TRONG danh mục của kho đang xem.
    // Backend đã lọc ở cả /stock lẫn /all-ingredients, nhưng nếu một bản build
    // cũ còn trả dư thì giao diện vẫn đúng.
    //
    // Chỉ áp dụng khi đã tải xong danh mục — ingredientMeta rỗng lúc đầu, lọc
    // ngay sẽ làm cả bảng trắng một nhịp.
    const ready = ingredientMeta.length > 0;

    return stocks
      .filter(s => !ready || metaMap[s.ingredientId])
      .map(s => {
        const meta = metaMap[s.ingredientId] || {};
        return {
          ...s,
          categoryId: meta.categoryId ?? null,
          subCategoryId: meta.subCategoryId ?? null,
        };
      });
  }, [stocks, ingredientMeta]);

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

  // CÂY DANH MỤC CHỈ GỒM MỤC CÓ NGUYÊN LIỆU.
  //
  // Danh mục / danh mục con rỗng bị loại ngay ở đây thay vì để component con tự
  // trả null: gom một chỗ thì đếm số mục, hiển thị trạng thái rỗng và render đều
  // nhìn cùng một dữ liệu, không lệch nhau.
  const visibleCats = useMemo(() => {
    return categories
      .map(cat => {
        const catStocks = stocksByCat[String(cat.id)] || [];
        if (catStocks.length === 0) return null;

        const subs = (subCatMap[cat.id] || [])
          .filter(sub => catStocks.some(s => String(s.subCategoryId) === String(sub.id)));

        return { cat, stocks: catStocks, subs };
      })
      .filter(Boolean);
  }, [categories, stocksByCat, subCatMap]);

  // Nguyên liệu chưa gắn danh mục, CỘNG những nguyên liệu trỏ tới một danh mục
  // không còn tồn tại (đã xoá / ngừng hoạt động). Nếu không gom vào đây chúng sẽ
  // biến mất khỏi giao diện trong khi tồn kho vẫn còn.
  const knownCatIds = useMemo(
    () => new Set(categories.map(c => String(c.id))),
    [categories]);

  const uncategorized = useMemo(
    () => filteredStocks.filter(s =>
      !s.categoryId || !knownCatIds.has(String(s.categoryId))),
    [filteredStocks, knownCatIds]);

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
              background: 'var(--c-steel)', color: 'var(--c-surface)',
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
          {visibleCats.map(({ cat, subs, stocks: catStocks }) => (
            <CategorySection
              key={cat.id}
              cat={cat}
              subCats={subs}
              ingredients={catStocks}
              search={search}
            />
          ))}
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
                <td key={j}><div style={{ height: 18, background: 'var(--c-surface-2)', borderRadius: 4, animation: 'pulse 1.5s infinite' }} /></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}