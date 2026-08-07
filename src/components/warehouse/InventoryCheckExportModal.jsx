// ─────────────────────────────────────────────────────────────────────────────
// THÊM VÀO src/api/warehouseApi.js (hoặc services.js tuỳ project)
// ─────────────────────────────────────────────────────────────────────────────
//
// export const warehouseApi = {
//   ...existing methods...,
//
//   exportInventoryCheck: (body) =>
//     api.post('/api/warehouse/export-inventory-check', body, { responseType: 'blob' }),
// };
//
// ─────────────────────────────────────────────────────────────────────────────
// src/components/warehouse/InventoryCheckExportModal.jsx
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useMemo } from 'react';
import { X, Download, CheckSquare, Square, Layers } from 'lucide-react';
import { warehouseApi } from '../../api/warehouseApi';
import { downloadBlob } from '../../api/services';

/**
 * Props:
 *  - stocks        : StockResponse[]  (dữ liệu tồn kho hiện tại trên màn hình)
 *  - categories    : CategoryResponse[] (danh sách danh mục)
 *  - ingredientMeta: IngredientResponse[] (để map categoryId)
 *  - warehouseId   : Long
 *  - warehouseName : string
 *  - onClose       : () => void
 */
export default function InventoryCheckExportModal({
  stocks = [],
  categories = [],
  subCategories = [],
  ingredientMeta = [],
  warehouseId,
  warehouseName,
  onClose,
}) {
  // ── State ───────────────────────────────────────────────────────────────────
  const [selectedCatIds, setSelectedCatIds] = useState(new Set(['ALL']));
  const [loading, setLoading] = useState(false);

  // ── Build danh mục có nguyên liệu ───────────────────────────────────────────
  const metaMap = useMemo(() => {
    const m = {};
    ingredientMeta.forEach(i => { m[i.id] = i; });
    return m;
  }, [ingredientMeta]);

  // Lookup tên danh mục cha / con theo id
  const catNameMap = useMemo(() => {
    const m = {};
    categories.forEach(c => { m[String(c.id)] = c.name; });
    return m;
  }, [categories]);

  const subCatNameMap = useMemo(() => {
    const m = {};
    subCategories.forEach(sc => { m[String(sc.id)] = sc.name; });
    return m;
  }, [subCategories]);

  // Chỉ giữ nguyên liệu CÒN được gán cho kho đang chọn.
  //   Nguồn sự thật là bảng gán kho (ingredient_warehouse) → phản ánh qua
  //   ingredientMeta.warehouseIds. Sau khi bỏ nguyên liệu khỏi kho, dòng tồn
  //   (IngredientStock) vẫn còn nên getStock trả về; ta lọc lại theo assignment
  //   để phiếu kiểm kho không liệt kê nguyên liệu đã gỡ khỏi kho.
  const isAssignedToWarehouse = (ingredientId) => {
    const meta = metaMap[ingredientId];
    if (!meta) return false; // không còn trong danh mục nguyên liệu active → không xuất
    const wids = meta.warehouseIds || [];
    return wids.some(w => String(w) === String(warehouseId));
  };

  const enriched = useMemo(() => {
    // Nếu chưa tải được metadata nguyên liệu hoặc chưa biết kho, không lọc để
    // tránh ẩn nhầm toàn bộ (fallback an toàn).
    const canFilter = ingredientMeta.length > 0 && warehouseId != null;
    return stocks
      .filter(s => !canFilter || isAssignedToWarehouse(s.ingredientId))
      .map(s => {
        const meta = metaMap[s.ingredientId] || {};
        const categoryId = meta.categoryId ?? null;
        const subCategoryId = meta.subCategoryId ?? null;
        return {
          ...s,
          categoryId,
          subCategoryId,
          categoryName: categoryId != null ? (catNameMap[String(categoryId)] ?? null) : null,
          subCategoryName: subCategoryId != null ? (subCatNameMap[String(subCategoryId)] ?? null) : null,
        };
      });
  },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stocks, metaMap, catNameMap, subCatNameMap, ingredientMeta, warehouseId]
  );

  // Danh mục thực sự có nguyên liệu trong kho hiện tại
  const activeCategoryIds = useMemo(() => {
    const ids = new Set();
    enriched.forEach(s => { if (s.categoryId) ids.add(String(s.categoryId)); });
    return ids;
  }, [enriched]);

  const visibleCategories = useMemo(() =>
    categories.filter(c => activeCategoryIds.has(String(c.id))),
    [categories, activeCategoryIds]
  );

  // Số nguyên liệu chưa có danh mục
  const uncategorizedCount = useMemo(() =>
    enriched.filter(s => !s.categoryId).length,
    [enriched]
  );

  // ── Toggle chọn danh mục ─────────────────────────────────────────────────────
  const toggleAll = () => setSelectedCatIds(new Set(['ALL']));

  const toggleCat = (catId) => {
    setSelectedCatIds(prev => {
      const next = new Set(prev);
      next.delete('ALL');
      if (next.has(catId)) {
        next.delete(catId);
        if (next.size === 0) next.add('ALL'); // fallback về ALL nếu bỏ hết
      } else {
        next.add(catId);
      }
      return next;
    });
  };

  const toggleUncategorized = () => toggleCat('__none__');

  // ── Build danh sách nguyên liệu sẽ xuất ────────────────────────────────────
  const itemsToExport = useMemo(() => {
    const isAll = selectedCatIds.has('ALL');
    const filtered = isAll
      ? enriched
      : enriched.filter(s => {
          const key = s.categoryId ? String(s.categoryId) : '__none__';
          return selectedCatIds.has(key);
        });

    // Sắp xếp: danh mục cha → danh mục con (chưa gán để cuối) → tên nguyên liệu
    return [...filtered].sort((a, b) => {
      const catA = a.categoryId ?? 9999999;
      const catB = b.categoryId ?? 9999999;
      if (catA !== catB) return catA - catB;
      // Trong cùng danh mục cha: nguyên liệu có danh mục con lên trước
      const subA = a.subCategoryId ?? 9999999;
      const subB = b.subCategoryId ?? 9999999;
      if (subA !== subB) return subA - subB;
      return (a.ingredientName || '').localeCompare(b.ingredientName || '', 'vi');
    });
  }, [enriched, selectedCatIds]);

  // ── Format ngày cho expiryList ──────────────────────────────────────────────
  const formatExpiryDate = (dateStr) => {
    if (!dateStr) return null;
    // dateStr có thể là "YYYY-MM-DD" hoặc ISO timestamp
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const mo = String(d.getMonth() + 1).padStart(2, '0');
      const yy = d.getFullYear();
      return `${hh}:${mm} ${dd}/${mo}/${yy}`;
    } catch {
      return dateStr;
    }
  };

  // ── Export ───────────────────────────────────────────────────────────────────
  const handleExport = async () => {
    if (itemsToExport.length === 0) return;
    setLoading(true);
    try {
      const body = {
        warehouseId,
        warehouseName,
        checkDate: new Date().toISOString().slice(0, 10),
        items: itemsToExport.map(s => ({
          ingredientId: s.ingredientId ?? null,
          ingredientName: s.ingredientName,
          spec: s.spec || null,           // quy cách nếu có trong StockResponse
          unit: s.unit || null,
          stockQuantity: Number(s.stockQuantity ?? 0),
          categoryId: s.categoryId ?? null,
          categoryName: s.categoryName ?? null,
          subCategoryId: s.subCategoryId ?? null,
          subCategoryName: s.subCategoryName ?? null,
          expiryList: (s.expiryList || [])
            .filter(e => e.expiryDate || e.quantity)
            .map(e => ({
              manufacturingDate: formatExpiryDate(e.manufacturingDate),
              expiryDate: formatExpiryDate(e.expiryDate),
              quantity: e.quantity != null ? Number(e.quantity) : null,
            })),
        })),
      };

      const res = await warehouseApi.exportInventoryCheck(body);
      const today = new Date().toLocaleDateString('vi-VN').replace(/\//g, '-');
      downloadBlob(res.data, `phieu-kiem-kho_${today}.xlsx`);
      onClose();
    } catch (err) {
      console.error('Export error', err);
      alert('Không thể xuất phiếu kiểm kho. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  const isAllSelected = selectedCatIds.has('ALL');

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 60,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      {/* Backdrop */}
      <div
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)' }}
        onClick={onClose}
      />

      {/* Modal */}
      <div style={{
        position: 'relative', background: 'var(--c-surface)', borderRadius: 20,
        boxShadow: '0 24px 60px rgba(0,0,0,0.18)',
        width: '100%', maxWidth: 480, maxHeight: '88vh',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 20px 14px',
          borderBottom: '1px solid var(--c-surface-2)',
          flexShrink: 0,
        }}>
          <div>
            <p style={{ fontSize: 10, color: 'var(--c-muted)', textTransform: 'uppercase', letterSpacing: 1, margin: 0 }}>
              Xuất phiếu
            </p>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--c-ink)', margin: '2px 0 0' }}>
              Phiếu kiểm kho
            </h2>
            {warehouseName && (
              <p style={{ fontSize: 12, color: 'var(--c-muted)', margin: '2px 0 0' }}>
                🏭 {warehouseName}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              padding: 6, border: 'none', background: 'var(--c-surface-2)',
              borderRadius: 10, cursor: 'pointer', color: 'var(--c-muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body — chọn danh mục */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          <p style={{ fontSize: 12, color: 'var(--c-ink-2)', marginBottom: 12 }}>
            Chọn danh mục muốn đưa vào phiếu. Có thể chọn nhiều danh mục.
          </p>

          {/* Tất cả */}
          <CategoryOption
            label="Tất cả danh mục"
            count={enriched.length}
            selected={isAllSelected}
            onToggle={toggleAll}
            icon="📦"
            highlight
          />

          {/* Từng danh mục */}
          {visibleCategories.map(cat => {
            const count = enriched.filter(s => String(s.categoryId) === String(cat.id)).length;
            return (
              <CategoryOption
                key={cat.id}
                label={cat.name}
                count={count}
                selected={!isAllSelected && selectedCatIds.has(String(cat.id))}
                onToggle={() => toggleCat(String(cat.id))}
                icon={cat.imageUrl ? null : '🏷️'}
                imageUrl={cat.imageUrl}
              />
            );
          })}

          {/* Chưa phân loại */}
          {uncategorizedCount > 0 && (
            <CategoryOption
              label="Chưa phân loại"
              count={uncategorizedCount}
              selected={!isAllSelected && selectedCatIds.has('__none__')}
              onToggle={toggleUncategorized}
              icon="📂"
            />
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 20px 18px',
          borderTop: '1px solid var(--c-surface-2)',
          flexShrink: 0,
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          {/* Preview count */}
          <p style={{ fontSize: 12, color: 'var(--c-muted)', margin: 0, textAlign: 'center' }}>
            {itemsToExport.length > 0
              ? `Sẽ xuất ${itemsToExport.length} nguyên liệu`
              : 'Không có nguyên liệu nào trong danh mục đã chọn'}
          </p>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={onClose}
              style={{
                flex: 1, padding: '10px 0', borderRadius: 12,
                border: '1px solid var(--c-line)', background: 'var(--c-surface)',
                fontSize: 14, color: 'var(--c-muted)', cursor: 'pointer', fontWeight: 500,
              }}
            >
              Huỷ
            </button>
            <button
              onClick={handleExport}
              disabled={loading || itemsToExport.length === 0}
              style={{
                flex: 2, padding: '10px 0', borderRadius: 12,
                border: 'none',
                background: itemsToExport.length === 0 ? 'var(--c-line)' : 'var(--c-steel)',
                color: itemsToExport.length === 0 ? 'var(--c-faint)' : 'var(--c-surface)',
                fontSize: 14, fontWeight: 700, cursor: itemsToExport.length === 0 ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'all 0.2s',
              }}
            >
              {loading
                ? <Spinner />
                : <><Download size={15} /> Xuất phiếu kiểm kho</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CategoryOption({ label, count, selected, onToggle, icon, imageUrl, highlight }) {
  return (
    <div
      onClick={onToggle}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '11px 14px', marginBottom: 8,
        borderRadius: 12, cursor: 'pointer',
        border: selected
          ? '2px solid var(--c-steel)'
          : '1px solid var(--c-line)',
        background: selected
          ? (highlight ? 'var(--c-steel-tint)' : 'var(--c-steel-tint)')
          : 'var(--c-surface-2)',
        transition: 'all 0.15s',
        userSelect: 'none',
      }}
    >
      {/* Icon / ảnh */}
      <div style={{
        width: 36, height: 36, borderRadius: 8, flexShrink: 0,
        background: selected ? 'rgba(26,60,110,0.1)' : 'var(--c-surface-2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', fontSize: 18,
      }}>
        {imageUrl
          ? <img src={imageUrl.startsWith('http') ? imageUrl
              : `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:9261'}/api/auth${imageUrl}`}
              alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : icon}
      </div>

      {/* Label + count */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          margin: 0, fontSize: 14, fontWeight: selected ? 700 : 500,
          color: selected ? 'var(--c-steel)' : 'var(--c-ink)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {label}
        </p>
        <p style={{ margin: 0, fontSize: 11, color: 'var(--c-muted)' }}>
          {count} nguyên liệu
        </p>
      </div>

      {/* Checkbox */}
      <div style={{ color: selected ? 'var(--c-steel)' : 'var(--c-faint)', flexShrink: 0 }}>
        {selected ? <CheckSquare size={20} /> : <Square size={20} />}
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <div style={{
      width: 16, height: 16,
      border: '2px solid rgba(255,255,255,0.4)',
      borderTopColor: 'var(--c-surface)',
      borderRadius: '50%',
      animation: 'spin 0.7s linear infinite',
    }} />
  );
}