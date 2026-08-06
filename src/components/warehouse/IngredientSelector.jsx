// src/components/warehouse/IngredientSelector.jsx
// REDESIGN: Modal picker thay cho <select> — sắp xếp cate/subcate, tìm kiếm, chống trùng
import { useState, useEffect, useMemo, useRef } from 'react';
import ExpiryDatePicker from './ExpiryDatePicker';
import { Search, X, ChevronDown, ChevronRight, Check, Layers, Package } from 'lucide-react';
import { warehouseApi, getImageUrl } from '../../api/warehouseApi';

// ── Cache categories/subcategories/meta ở module level để tránh fetch lại mỗi row ──
let _catCache = null, _subCache = null, _metaCache = null;
async function loadMeta() {
  if (!_catCache)  _catCache  = warehouseApi.getCategories().then(r => r.data?.data || []);
  if (!_subCache)  _subCache  = warehouseApi.getAllSubCategories().then(r => r.data?.data || []);
  if (!_metaCache) _metaCache = warehouseApi.getIngredients().then(r => r.data?.data || []);
  return Promise.all([_catCache, _subCache, _metaCache]);
}

// ── Ingredient Picker Modal ───────────────────────────────────────────────────
export function IngredientPickerModal({ stocks, selectedIds, onSelect, onClose }) {
  const [search, setSearch]         = useState('');
  const [cats, setCats]             = useState([]);
  const [subs, setSubs]             = useState([]);
  const [meta, setMeta]             = useState([]);
  const [expanded, setExpanded]     = useState({});    // catId/subId → bool
  const searchRef = useRef(null);

  useEffect(() => {
    loadMeta().then(([c, s, m]) => {
      setCats(c); setSubs(s); setMeta(m);
      // Mặc định mở tất cả cat
      const exp = {};
      c.forEach(cat => { exp[`cat_${cat.id}`] = true; });
      s.forEach(sub => { exp[`sub_${sub.id}`] = true; });
      setExpanded(exp);
    });
    setTimeout(() => searchRef.current?.focus(), 100);
  }, []);

  // Enrich stocks với categoryId/subCategoryId từ meta
  const enriched = useMemo(() => {
    const metaMap = {};
    meta.forEach(i => { metaMap[i.id] = i; });
    return stocks.map(s => ({
      ...s,
      categoryId:    metaMap[s.ingredientId]?.categoryId    ?? null,
      subCategoryId: metaMap[s.ingredientId]?.subCategoryId ?? null,
    }));
  }, [stocks, meta]);

  const filtered = useMemo(() => {
    if (!search.trim()) return enriched;
    const q = search.toLowerCase();
    return enriched.filter(s => s.ingredientName?.toLowerCase().includes(q));
  }, [enriched, search]);

  // Build cate tree
  const subMap = useMemo(() => {
    const m = {};
    subs.forEach(s => {
      const k = String(s.categoryId);
      if (!m[k]) m[k] = [];
      m[k].push(s);
    });
    return m;
  }, [subs]);

  const stocksByCat = useMemo(() => {
    const m = {};
    filtered.forEach(s => {
      const k = s.categoryId ? String(s.categoryId) : '__none__';
      if (!m[k]) m[k] = [];
      m[k].push(s);
    });
    return m;
  }, [filtered]);

  const toggle = (key) => setExpanded(v => ({ ...v, [key]: !v[key] }));

  const isSearching = search.trim().length > 0;

  // ── Render một ingredient row ──
  const IngRow = ({ s, indent = 0 }) => {
    const isSelected = selectedIds.includes(s.ingredientId);
    const isLow = Number(s.stockQuantity) < 5;
    return (
      <button
        onClick={() => !isSelected && onSelect(s)}
        disabled={isSelected}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
          padding: `9px 14px 9px ${14 + indent}px`,
          borderBottom: '1px solid var(--wh-border)',
          background: isSelected ? 'rgba(201,168,76,.06)' : 'white',
          cursor: isSelected ? 'default' : 'pointer',
          transition: 'background .12s',
        }}
        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#faf7f2'; }}
        onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'white'; }}
      >
        {/* Ảnh */}
        <div style={{
          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
          background: '#f5f0eb', overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
        }}>
          {s.imageUrl
            ? <img src={getImageUrl(s.imageUrl)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : '🧂'}
        </div>

        {/* Tên + đơn vị */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13, fontWeight: isSelected ? 700 : 500,
            color: isSelected ? 'var(--wh-accent)' : 'var(--wh-text)',
            textDecoration: isSelected ? 'line-through' : 'none',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {s.ingredientName}
          </div>
          <div style={{ fontSize: 11, color: 'var(--wh-muted)', marginTop: 1 }}>{s.unit}</div>
        </div>

        {/* Tồn kho */}
        <span style={{
          fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
          padding: '2px 8px', borderRadius: 99,
          background: isLow ? 'rgba(234,88,12,.1)' : 'rgba(201,168,76,.1)',
          color: isLow ? 'var(--wh-warn)' : 'var(--wh-accent)',
        }}>
          {isLow && '⚠️ '}{Number(s.stockQuantity).toLocaleString('vi-VN')}
        </span>

        {/* Check icon nếu đã chọn */}
        {isSelected && (
          <Check size={15} style={{ color: 'var(--wh-accent)', flexShrink: 0 }} />
        )}
      </button>
    );
  };

  // ── Flat list khi search ──
  const FlatList = () => (
    <>
      {filtered.length === 0
        ? <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--wh-muted)', fontSize: 13 }}>
            Không tìm thấy nguyên liệu
          </div>
        : filtered.map(s => <IngRow key={s.ingredientId} s={s} />)
      }
    </>
  );

  // ── Tree list khi không search ──
  const TreeList = () => (
    <>
      {cats.map(cat => {
        const catStocks = stocksByCat[String(cat.id)] || [];
        const catSubs   = (subMap[String(cat.id)] || []).filter(sub =>
          catStocks.some(s => String(s.subCategoryId) === String(sub.id))
        );
        const subCatIds = new Set(catSubs.map(s => String(s.id)));
        const directStocks = catStocks.filter(s =>
          !s.subCategoryId || !subCatIds.has(String(s.subCategoryId))
        );
        if (catStocks.length === 0) return null;
        const catKey = `cat_${cat.id}`;
        const catOpen = expanded[catKey] !== false;

        return (
          <div key={cat.id}>
            {/* Category header */}
            <div
              onClick={() => toggle(catKey)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                padding: '9px 14px', background: 'var(--wh-bg)',
                borderBottom: '1px solid var(--wh-border)',
                position: 'sticky', top: 0, zIndex: 2,
              }}
            >
              <div style={{
                width: 26, height: 26, borderRadius: 7, background: 'rgba(201,168,76,.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                {cat.imageUrl
                  ? <img src={cat.imageUrl.startsWith('http') ? cat.imageUrl : `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:9261'}/api/auth${cat.imageUrl}`}
                      alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 7 }} />
                  : <Layers size={13} style={{ color: 'var(--wh-accent)' }} />
                }
              </div>
              <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--wh-text)', flex: 1 }}>{cat.name}</span>
              <span style={{
                fontSize: 10, color: 'var(--wh-muted)', background: 'rgba(0,0,0,.06)',
                borderRadius: 99, padding: '1px 7px', fontWeight: 600,
              }}>{catStocks.length}</span>
              {catOpen ? <ChevronDown size={14} style={{ color: 'var(--wh-muted)' }} />
                       : <ChevronRight size={14} style={{ color: 'var(--wh-muted)' }} />}
            </div>

            {catOpen && (
              <>
                {/* SubCategories */}
                {catSubs.map(sub => {
                  const subStocks = catStocks.filter(s => String(s.subCategoryId) === String(sub.id));
                  if (subStocks.length === 0) return null;
                  const subKey = `sub_${sub.id}`;
                  const subOpen = expanded[subKey] !== false;
                  return (
                    <div key={sub.id}>
                      <div
                        onClick={() => toggle(subKey)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                          padding: '7px 14px 7px 32px',
                          background: 'rgba(201,168,76,.04)',
                          borderBottom: '1px solid var(--wh-border)',
                        }}
                      >
                        <div style={{
                          width: 20, height: 20, borderRadius: 5, background: 'rgba(201,168,76,.12)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}>
                          {sub.imageUrl
                            ? <img src={sub.imageUrl.startsWith('http') ? sub.imageUrl : `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:9261'}/api/auth${sub.imageUrl}`}
                                alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 5 }} />
                            : <Layers size={10} style={{ color: 'var(--wh-accent)' }} />
                          }
                        </div>
                        <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--wh-text)', flex: 1 }}>{sub.name}</span>
                        <span style={{ fontSize: 10, color: 'var(--wh-muted)', fontWeight: 600 }}>{subStocks.length}</span>
                        {subOpen ? <ChevronDown size={12} style={{ color: 'var(--wh-muted)' }} />
                                 : <ChevronRight size={12} style={{ color: 'var(--wh-muted)' }} />}
                      </div>
                      {subOpen && subStocks.map(s => <IngRow key={s.ingredientId} s={s} indent={36} />)}
                    </div>
                  );
                })}
                {/* Direct (không thuộc sub nào) */}
                {directStocks.map(s => <IngRow key={s.ingredientId} s={s} indent={catSubs.length > 0 ? 20 : 0} />)}
              </>
            )}
          </div>
        );
      })}

      {/* Chưa phân loại */}
      {(stocksByCat['__none__'] || []).length > 0 && (
        <div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px',
            background: 'var(--wh-bg)', borderBottom: '1px solid var(--wh-border)',
            position: 'sticky', top: 0, zIndex: 2,
          }}>
            <Package size={14} style={{ color: 'var(--wh-muted)' }} />
            <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--wh-text)', flex: 1 }}>Chưa phân loại</span>
            <span style={{ fontSize: 10, color: 'var(--wh-muted)', background: 'rgba(0,0,0,.06)', borderRadius: 99, padding: '1px 7px', fontWeight: 600 }}>
              {stocksByCat['__none__'].length}
            </span>
          </div>
          {stocksByCat['__none__'].map(s => <IngRow key={s.ingredientId} s={s} />)}
        </div>
      )}
    </>
  );

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px',
    }}>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(4px)' }}
      />

      {/* Modal */}
      <div style={{
        position: 'relative', width: '100%', maxWidth: 480,
        background: '#fff', borderRadius: 16,
        boxShadow: '0 20px 60px rgba(0,0,0,.2)',
        display: 'flex', flexDirection: 'column',
        maxHeight: 'min(600px, 85vh)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '14px 16px', borderBottom: '1px solid var(--wh-border)',
          flexShrink: 0,
        }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--wh-text)', flex: 1 }}>
            Chọn nguyên liệu
          </span>
          <button onClick={onClose} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 28, height: 28, borderRadius: 8,
            background: 'var(--wh-surface2)', border: 'none', cursor: 'pointer',
          }}>
            <X size={15} style={{ color: 'var(--wh-muted)' }} />
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--wh-border)', flexShrink: 0 }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{
              position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
              color: 'var(--wh-muted)',
            }} />
            <input
              ref={searchRef}
              className="wh-input"
              placeholder="Tìm nguyên liệu..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 32, margin: 0 }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{
                  position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--wh-muted)',
                  display: 'flex', alignItems: 'center',
                }}
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {isSearching ? <FlatList /> : <TreeList />}
        </div>

        {/* Footer count */}
        <div style={{
          padding: '10px 14px', borderTop: '1px solid var(--wh-border)',
          fontSize: 12, color: 'var(--wh-muted)', flexShrink: 0,
          display: 'flex', justifyContent: 'space-between',
        }}>
          <span>{filtered.length} nguyên liệu</span>
          {selectedIds.length > 0 && (
            <span style={{ color: 'var(--wh-accent)', fontWeight: 600 }}>
              {selectedIds.length} đã chọn
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── IngredientSelector (row) ──────────────────────────────────────────────────
export default function IngredientSelector({ stocks = [], value, onChange, onRemove, mode, canRemove = true, selectedIngredientIds = [] }) {
  const [showModal, setShowModal] = useState(false);
  const selected = stocks.find(s => s.ingredientId === value.ingredientId);

  // Tất cả id đã chọn trong form (để chặn trùng) — bao gồm cả row hiện tại nếu đã chọn
  // Row hiện tại không count là "blocked" với chính nó
  const blockedIds = selectedIngredientIds.filter(id => id !== value.ingredientId);

  const handleSelect = (s) => {
    onChange({ ...value, ingredientId: s.ingredientId });
    setShowModal(false);
  };

  const gridClass = {
    import:   'wh-ing-row import-grid',
    export:   'wh-ing-row export-grid',
    transfer: 'wh-ing-row export-grid',
    adjust:   'wh-ing-row adjust-grid',
  }[mode];

  return (
    <>
      <div className={gridClass}>
        {/* ── Trigger chọn nguyên liệu ── */}
        <button
          onClick={() => setShowModal(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            width: '100%', textAlign: 'left',
            padding: '8px 12px', borderRadius: 8,
            border: '1px solid var(--wh-border)',
            background: selected ? 'white' : 'var(--wh-surface2)',
            cursor: 'pointer', transition: 'border-color .15s',
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--wh-accent)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--wh-border)'}
        >
          {selected ? (
            <>
              {/* Ảnh */}
              <div style={{
                width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                background: '#f5f0eb', overflow: 'hidden',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
              }}>
                {selected.imageUrl
                  ? <img src={getImageUrl(selected.imageUrl)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : '🧂'}
              </div>
              {/* Tên */}
              <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--wh-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selected.ingredientName}
              </span>
              {/* Đơn vị + tồn */}
              <span style={{ fontSize: 11, color: 'var(--wh-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                {selected.unit} · {Number(selected.stockQuantity).toLocaleString('vi-VN')}
              </span>
              <ChevronDown size={13} style={{ color: 'var(--wh-muted)', flexShrink: 0 }} />
            </>
          ) : (
            <>
              <span style={{ fontSize: 13, color: 'var(--wh-muted)', flex: 1 }}>-- Chọn nguyên liệu --</span>
              <ChevronDown size={13} style={{ color: 'var(--wh-muted)' }} />
            </>
          )}
        </button>

        {/* Số lượng */}
        {(mode === 'import' || mode === 'export' || mode === 'transfer') && (
          <div>
            <input
              className="wh-input"
              type="number" min="0" step="0.01"
              placeholder="Số lượng"
              value={value.quantity || ''}
              onChange={e => onChange({ ...value, quantity: e.target.value })}
            />
          </div>
        )}

        {/* Hạn sử dụng — chỉ import */}
        {mode === 'import' && (
          <div>
            {/* DatePicker của app thay cho <input type="date"> mặc định —
                đồng bộ giao diện và không phụ thuộc lịch riêng của từng trình
                duyệt. Không bắt buộc: có thể để trống. */}
            <ExpiryDatePicker
              value={value.expiryDate || ''}
              onChange={iso => onChange({ ...value, expiryDate: iso })}
            />
          </div>
        )}

        {/* Điều chỉnh */}
        {mode === 'adjust' && (
          <>
            <div>
              <input
                className="wh-input"
                placeholder="Tồn hiện tại"
                readOnly
                value={selected ? Number(selected.stockQuantity).toLocaleString() : '—'}
                style={{ color: 'var(--wh-muted)', cursor: 'default' }}
              />
            </div>
            <div>
              <input
                className="wh-input"
                type="number" min="0" step="0.01"
                placeholder="Thực tế kiểm"
                value={value.physicalQty || ''}
                onChange={e => onChange({ ...value, physicalQty: e.target.value })}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {selected && value.physicalQty !== '' && value.physicalQty !== undefined ? (
                <DiffBadge diff={Number(value.physicalQty) - Number(selected.stockQuantity)} unit={selected.unit} />
              ) : (
                <span style={{ color: 'var(--wh-muted)', fontSize: 12 }}>—</span>
              )}
            </div>
          </>
        )}

        {/* Xóa */}
        {canRemove && (
          <button
            className="wh-btn wh-btn-danger wh-btn-sm"
            onClick={onRemove}
            style={{ alignSelf: 'flex-start', marginTop: mode === 'adjust' ? 8 : 0 }}
          >✕</button>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <IngredientPickerModal
          stocks={stocks}
          selectedIds={blockedIds}
          onSelect={handleSelect}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}

function DiffBadge({ diff, unit }) {
  if (diff === 0) return <span className="wh-badge badge-match">✓ Khớp</span>;
  if (diff > 0)   return <span className="wh-badge badge-surplus">+{Number(diff).toLocaleString()} {unit} Thừa</span>;
  return <span className="wh-badge badge-shortage">{Number(diff).toLocaleString()} {unit} Thiếu</span>;
}