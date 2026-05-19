// src/components/warehouse/IngredientSelector.jsx
import { useState } from 'react';

/**
 * Props:
 *   stocks       : StockResponse[]
 *   value        : { ingredientId, quantity, expiryDate?, physicalQty? }
 *   onChange     : (val) => void
 *   onRemove     : () => void
 *   mode         : 'import' | 'export' | 'adjust' | 'transfer'
 *   canRemove    : boolean
 *
 * NOTE (Feature 2): Khi mode='import', KHÔNG hiển thị trường giá vốn.
 * Giá vốn sẽ do SUPER_ACCOUNTANT nhập sau khi xem phiếu nhập kho.
 */
export default function IngredientSelector({ stocks = [], value, onChange, onRemove, mode, canRemove = true }) {
  const selected = stocks.find(s => s.ingredientId === value.ingredientId);

  const gridClass = {
    import:   'wh-ing-row import-grid',
    export:   'wh-ing-row export-grid',
    transfer: 'wh-ing-row export-grid',
    adjust:   'wh-ing-row adjust-grid',
  }[mode];

  return (
    <div className={gridClass}>
      {/* Chọn nguyên liệu */}
      <div>
        <select
          className="wh-select"
          value={value.ingredientId || ''}
          onChange={e => onChange({ ...value, ingredientId: Number(e.target.value) })}
        >
          <option value="">-- Chọn nguyên liệu --</option>
          {stocks.map(s => (
            <option key={s.ingredientId} value={s.ingredientId}>
              {s.ingredientName} ({s.unit}) — Tồn: {Number(s.stockQuantity).toLocaleString()}
            </option>
          ))}
        </select>
      </div>

      {/* Số lượng */}
      {(mode === 'import' || mode === 'export' || mode === 'transfer') && (
        <div>
          <input
            className="wh-input"
            type="number"
            min="0"
            step="0.01"
            placeholder="Số lượng"
            value={value.quantity || ''}
            onChange={e => onChange({ ...value, quantity: e.target.value })}
          />
        </div>
      )}

      {/* Hạn sử dụng — chỉ hiện khi import, KHÔNG có giá vốn (kế toán trưởng nhập sau) */}
      {mode === 'import' && (
        <div>
          <input
            className="wh-input"
            type="date"
            value={value.expiryDate || ''}
            onChange={e => onChange({ ...value, expiryDate: e.target.value })}
          />
        </div>
      )}

      {/* Điều chỉnh: tồn hiện tại + số thực tế + chênh lệch */}
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
              type="number"
              min="0"
              step="0.01"
              placeholder="Thực tế kiểm"
              value={value.physicalQty || ''}
              onChange={e => onChange({ ...value, physicalQty: e.target.value })}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {selected && value.physicalQty !== '' && value.physicalQty !== undefined ? (
              <DiffBadge
                diff={Number(value.physicalQty) - Number(selected.stockQuantity)}
                unit={selected.unit}
              />
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
  );
}

function DiffBadge({ diff, unit }) {
  if (diff === 0) return <span className="wh-badge badge-match">✓ Khớp</span>;
  if (diff > 0)   return <span className="wh-badge badge-surplus">+{Number(diff).toLocaleString()} {unit} Thừa</span>;
  return <span className="wh-badge badge-shortage">{Number(diff).toLocaleString()} {unit} Thiếu</span>;
}