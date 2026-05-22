// src/pages/warehouse/ManagementPage.jsx
// FIX 1: Popup hạn sử dụng không tràn màn hình — luôn hiển thị vào trong
// FIX 2: Hiển thị category/subcategory dạng cây, collapse/expand
import { useState, useEffect, useRef, useMemo } from 'react';
import { warehouseApi, getImageUrl } from '../../api/warehouseApi';
import { useAuth } from '../../context/AuthContext';
import { ChevronRight, ChevronDown, Layers } from 'lucide-react';

const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return Math.round((d - TODAY) / 86400000);
}

// ── ExpiryCell — FIX 1: popup luôn hiển thị vào trong màn hình ──────────────
function ExpiryCell({ expiryList }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  const popRef = useRef(null);

  const dated = (expiryList || [])
    .filter(e => e.expiryDate && Number(e.quantity) > 0)
    .sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));

  // Đóng khi click ngoài
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (btnRef.current && !btnRef.current.contains(e.target) &&
        popRef.current && !popRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // FIX 1: Tính vị trí popup sau khi render để biết có tràn phải không
  const [popStyle, setPopStyle] = useState({ left: 0 });
  useEffect(() => {
    if (!open || !btnRef.current || !popRef.current) return;
    const btnRect = btnRef.current.getBoundingClientRect();
    const popWidth = popRef.current.offsetWidth || 260;
    const vw = window.innerWidth;
    // Nếu mở sang phải bị tràn → mở sang trái
    if (btnRect.left + popWidth > vw - 12) {
      setPopStyle({ right: 0, left: 'auto' });
    } else {
      setPopStyle({ left: 0, right: 'auto' });
    }
  }, [open]);

  if (dated.length === 0) {
    return <span style={{ color: 'var(--wh-muted)', fontSize: 12 }}>—</span>;
  }

  const soonCount = dated.filter(e => {
    const d = daysUntil(e.expiryDate);
    return d !== null && d <= 30;
  }).length;

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        ref={btnRef}
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        }}
      >
        {soonCount > 0 && (
          <span style={{
            background: 'rgba(234,88,12,.12)', color: 'var(--wh-warn)',
            border: '1px solid rgba(234,88,12,.25)',
            borderRadius: 99, padding: '2px 8px',
            fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
          }}>
            ⚠️ {soonCount} lô sắp hết hạn
          </span>
        )}
        <span style={{
          background: 'rgba(201,168,76,.1)', color: 'var(--wh-accent)',
          border: '1px solid rgba(201,168,76,.2)',
          borderRadius: 99, padding: '2px 8px',
          fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
        }}>
          {dated.length} lô ▾
        </span>
      </button>

      {open && (
        <div
          ref={popRef}
          style={{
            position: 'absolute', top: '100%', zIndex: 50, marginTop: 6,
            background: '#fff', border: '1px solid var(--wh-border)',
            borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,.12)',
            minWidth: 240, maxWidth: 'min(300px, 90vw)',
            padding: '8px 0', whiteSpace: 'nowrap',
            ...popStyle,
          }}
        >
          <div style={{
            padding: '6px 14px 8px', borderBottom: '1px solid var(--wh-border)',
            fontSize: 11, fontWeight: 700, color: 'var(--wh-muted)',
            textTransform: 'uppercase', letterSpacing: '.5px',
          }}>
            Danh sách lô hàng
          </div>
          {dated.map((e, i) => {
            const days = daysUntil(e.expiryDate);
            const isExpired = days !== null && days < 0;
            const isSoon = days !== null && days >= 0 && days <= 30;
            const color = isExpired ? '#dc2626' : isSoon ? 'var(--wh-warn)' : 'var(--wh-text)';
            const bgColor = isExpired ? 'rgba(220,38,38,.04)' : isSoon ? 'rgba(234,88,12,.04)' : 'transparent';
            return (
              <div key={e.id ?? i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '7px 14px', background: bgColor,
                borderBottom: i < dated.length - 1 ? '1px solid var(--wh-border)' : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color }}>
                    {String(e.expiryDate)}
                  </span>
                  {isExpired && (
                    <span style={{ fontSize: 10, background: 'rgba(220,38,38,.1)', color: '#dc2626', borderRadius: 4, padding: '1px 5px' }}>Hết hạn</span>
                  )}
                  {isSoon && !isExpired && (
                    <span style={{ fontSize: 10, background: 'rgba(234,88,12,.1)', color: 'var(--wh-warn)', borderRadius: 4, padding: '1px 5px' }}>
                      {days === 0 ? 'Hôm nay' : `${days} ngày`}
                    </span>
                  )}
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--wh-accent)', marginLeft: 16 }}>
                  {Number(e.quantity).toLocaleString('vi-VN')}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Category tree row ─────────────────────────────────────────────────────────
function CategorySection({ cat, subCats, ingredients, categoryMap, search }) {
  // Nếu có search → flatten, không dùng cây
  const [expanded, setExpanded] = useState(true);

  // Lọc ingredient thuộc cat này (không thuộc bất kỳ subCat nào — hoặc subCat chưa được map)
  const catIngredients = useMemo(() => {
    const subCatIds = new Set(subCats.map(s => String(s.id)));
    return ingredients.filter(s => {
      if (String(s.categoryId) !== String(cat.id)) return false;
      // Nếu không có subCategoryId hoặc subCategoryId không thuộc các sub đã biết → show ở cấp cat
      return !s.subCategoryId || !subCatIds.has(String(s.subCategoryId));
    });
  }, [ingredients, cat.id, subCats]);

  if (ingredients.length === 0 && subCats.length === 0) return null;

  return (
    <div style={{ marginBottom: 12 }}>
      {/* Category header */}
      <div
        onClick={() => setExpanded(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
          padding: '10px 14px', background: 'var(--wh-bg)',
          borderRadius: 10, border: '1px solid var(--wh-border)',
          marginBottom: expanded ? 0 : 0,
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
          {ingredients.length} nguyên liệu
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
          {/* Sub categories */}
          {subCats.map(sub => (
            <SubCategorySection key={sub.id} sub={sub} allIngredients={ingredients} search={search} />
          ))}
          {/* Ingredients không thuộc sub nào */}
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
      {/* Sub header */}
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
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr auto auto auto',
      alignItems: 'center', gap: 12,
      padding: `9px 14px 9px ${subIndent ? 52 : indent ? 36 : 14}px`,
      borderBottom: '1px solid var(--wh-border)',
      background: 'white',
    }}>
      {/* Name + image */}
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
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--wh-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {s.ingredientName}
        </span>
      </div>
      {/* Unit */}
      <span style={{ fontSize: 12, color: 'var(--wh-muted)', whiteSpace: 'nowrap' }}>{s.unit}</span>
      {/* Stock */}
      <span style={{
        fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
        padding: '2px 10px', borderRadius: 99,
        background: isLow ? 'rgba(234,88,12,.1)' : 'rgba(201,168,76,.1)',
        color: isLow ? 'var(--wh-warn)' : 'var(--wh-accent)',
      }}>
        {isLow && '⚠️ '}{Number(s.stockQuantity).toLocaleString('vi-VN')}
      </span>
      {/* Expiry */}
      <div style={{ minWidth: 80 }}>
        <ExpiryCell expiryList={s.expiryList} />
      </div>
    </div>
  );
}

// ── Uncategorized section ─────────────────────────────────────────────────────
function UncategorizedSection({ ingredients }) {
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
          {ingredients.length} nguyên liệu
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
  const { user } = useAuth();
  const [stocks, setStocks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subCategories, setSubCategories] = useState([]);
  const [ingredientMeta, setIngredientMeta] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [warehouseInfo, setWarehouseInfo] = useState(null);

  const warehouseId = user?.warehouseId || user?.warehouse?.id;

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

  // Join stock với ingredient metadata để biết categoryId/subCategoryId
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

  // Category tree: root cats và sub cats
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

  // Filtered stocks by search
  const filteredStocks = useMemo(() => {
    if (!search.trim()) return enrichedStocks;
    const q = search.toLowerCase();
    return enrichedStocks.filter(s => s.ingredientName?.toLowerCase().includes(q));
  }, [enrichedStocks, search]);

  const lowStockCount = filteredStocks.filter(s => Number(s.stockQuantity) < 5).length;

  // Group stocks by category
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
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
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
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 24 }}>
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
        /* Khi search → hiển thị flat table đơn giản */
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
              {filteredStocks.map(s => (
                <tr key={s.ingredientId}>
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
                  <td><ExpiryCell expiryList={s.expiryList} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* Không search → hiển thị cây category/subcategory */
        <div>
          {rootCats.map(cat => {
            const catStocks = stocksByCat[String(cat.id)] || [];
            const subCats = subCatMap[cat.id] || [];
            // Chỉ show nếu có nguyên liệu trong cat này (bao gồm trong sub)
            const allCatStocks = catStocks.concat(
              subCats.flatMap(s => (stocksByCat[String(s.id)] || []))
            );
            // Merge stocks bởi cả direct và subcat
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