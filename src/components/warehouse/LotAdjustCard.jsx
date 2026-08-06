// src/components/warehouse/LotAdjustCard.jsx
//
// ĐIỀU CHỈNH TỒN KHO THEO LÔ.
//
// Mỗi card = 1 nguyên liệu. Hiển thị TỔNG tồn hệ thống (chỉ đọc) và danh sách
// các LÔ của nguyên liệu đó tại kho đang chọn. User sửa số lượng / hạn sử dụng
// trên TỪNG LÔ, tổng mới = tổng số lượng các lô.
//
// Lô mới tạo ở đây sẽ có giá vốn mặc định = 1 và được gửi sang KẾ TOÁN TRƯỞNG
// để nhập giá vốn thật (giống luồng nhập kho).
import { useState, useMemo } from 'react';
import { ChevronDown, Plus, Trash2, Sparkles, CalendarClock } from 'lucide-react';
import { getImageUrl } from '../../api/warehouseApi';
import { IngredientPickerModal } from './IngredientSelector';

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const fmt = (v) => Number(v || 0).toLocaleString('vi-VN', { maximumFractionDigits: 3 });

/** Tình trạng HSD → màu badge */
function expiryTone(dateStr) {
  if (!dateStr) return { bg: '#f3f0eb', color: '#8E8878', label: 'Không HSD' };
  const days = Math.ceil((new Date(dateStr) - new Date()) / 86400000);
  if (days < 0) return { bg: '#fee2e2', color: '#b91c1c', label: `Quá hạn ${Math.abs(days)} ngày` };
  if (days <= 30) return { bg: '#ffedd5', color: '#c2410c', label: `Còn ${days} ngày` };
  return { bg: '#dcfce7', color: '#15803d', label: `Còn ${days} ngày` };
}

export default function LotAdjustCard({
  stocks = [],
  value,                 // { ingredientId, lots: [{ key, lotId, quantity, expiryDate, costPrice, isNew }] }
  onChange,
  onRemove,
  canRemove = true,
  selectedIngredientIds = [],
}) {
  const [showPicker, setShowPicker] = useState(false);
  const selected = stocks.find((s) => s.ingredientId === value.ingredientId);
  const blockedIds = selectedIngredientIds.filter((id) => id !== value.ingredientId);

  const lots = value.lots || [];

  // Phần tồn chưa gắn lô (backend trả về dòng tracked=false) — chỉ hiển thị, không sửa
  const untracked = useMemo(() => {
    const row = (selected?.expiryList || []).find((e) => e.tracked === false);
    return row ? num(row.quantity) : 0;
  }, [selected]);

  const systemQty = num(selected?.stockQuantity);
  const newTotal = lots.reduce((s, l) => s + num(l.quantity), 0);
  const diff = newTotal - systemQty;

  // ── Khi chọn nguyên liệu: nạp sẵn các lô hiện có của nguyên liệu đó ─────────
  const handleSelectIngredient = (s) => {
    const existing = (s.expiryList || [])
      .filter((e) => e.tracked !== false && e.id != null)
      .map((e) => ({
        key: `lot_${e.id}`,
        lotId: e.id,
        quantity: e.quantity ?? '',
        expiryDate: e.expiryDate || '',
        costPrice: e.costPrice,
        isNew: false,
      }));
    onChange({ ...value, ingredientId: s.ingredientId, lots: existing });
    setShowPicker(false);
  };

  const updateLot = (key, patch) =>
    onChange({ ...value, lots: lots.map((l) => (l.key === key ? { ...l, ...patch } : l)) });

  const addLot = () =>
    onChange({
      ...value,
      lots: [
        ...lots,
        { key: `new_${Date.now()}_${Math.random()}`, lotId: null, quantity: '', expiryDate: '', isNew: true },
      ],
    });

  const removeLot = (key) => onChange({ ...value, lots: lots.filter((l) => l.key !== key) });

  return (
    <>
      <div
        style={{
          border: '1px solid var(--wh-border)',
          borderRadius: 12,
          background: 'var(--wh-surface)',
          padding: 12,
          marginBottom: 12,
        }}
      >
        {/* ── Header: chọn nguyên liệu ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => setShowPicker(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0,
              textAlign: 'left', padding: '8px 12px', borderRadius: 8,
              border: '1px solid var(--wh-border)',
              background: selected ? 'white' : 'var(--wh-surface2)',
              cursor: 'pointer',
            }}
          >
            {selected ? (
              <>
                <div style={{
                  width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: '#f5f0eb',
                  overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
                }}>
                  {selected.imageUrl
                    ? <img src={getImageUrl(selected.imageUrl)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : '🧂'}
                </div>
                <span style={{
                  flex: 1, fontSize: 13.5, fontWeight: 700, color: 'var(--wh-text)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {selected.ingredientName}
                </span>
                <ChevronDown size={14} style={{ color: 'var(--wh-muted)', flexShrink: 0 }} />
              </>
            ) : (
              <>
                <span style={{ fontSize: 13, color: 'var(--wh-muted)', flex: 1 }}>-- Chọn nguyên liệu --</span>
                <ChevronDown size={14} style={{ color: 'var(--wh-muted)' }} />
              </>
            )}
          </button>

          {canRemove && (
            <button className="wh-btn wh-btn-danger wh-btn-sm" onClick={onRemove} title="Bỏ nguyên liệu này">
              ✕
            </button>
          )}
        </div>

        {selected && (
          <>
            {/* ── Tổng số ── */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
              gap: 8, marginTop: 10,
            }}>
              <Stat label="Tồn hệ thống" value={`${fmt(systemQty)} ${selected.unit || ''}`} />
              <Stat label="Tổng sau điều chỉnh" value={`${fmt(newTotal)} ${selected.unit || ''}`} strong />
              <Stat
                label="Chênh lệch"
                value={diff === 0 ? '✓ Khớp' : `${diff > 0 ? '+' : ''}${fmt(diff)} ${selected.unit || ''}`}
                tone={diff === 0 ? 'ok' : diff > 0 ? 'up' : 'down'}
              />
            </div>

            {untracked > 0 && (
              <div style={{
                marginTop: 8, fontSize: 11.5, lineHeight: 1.5,
                background: 'rgba(234,88,12,.08)', border: '1px solid rgba(234,88,12,.25)',
                color: '#9a3412', borderRadius: 8, padding: '7px 10px',
              }}>
                ⚠️ Có <b>{fmt(untracked)} {selected.unit}</b> tồn chưa gắn lô. Sau khi lưu, tổng tồn sẽ
                được tính lại bằng đúng tổng các lô bên dưới — phần chưa gắn lô sẽ không còn.
              </div>
            )}

            {/* ── Danh sách lô ── */}
            <div style={{ marginTop: 12 }}>
              <div style={{
                fontSize: 11.5, fontWeight: 700, color: 'var(--wh-muted)',
                textTransform: 'uppercase', letterSpacing: .4, marginBottom: 6,
              }}>
                Các lô trong kho ({lots.length})
              </div>

              {lots.length === 0 && (
                <div style={{
                  fontSize: 12.5, color: 'var(--wh-muted)', padding: '10px 12px',
                  background: 'var(--wh-surface2)', borderRadius: 8, marginBottom: 8,
                }}>
                  Nguyên liệu này chưa có lô nào. Bấm “Thêm lô” để tạo lô mới.
                </div>
              )}

              {lots.map((lot) => (
                <LotRow
                  key={lot.key}
                  lot={lot}
                  unit={selected.unit}
                  onChange={(patch) => updateLot(lot.key, patch)}
                  onRemove={lot.isNew ? () => removeLot(lot.key) : null}
                />
              ))}

              <button className="wh-btn wh-btn-secondary wh-btn-sm" onClick={addLot}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Plus size={13} /> Thêm lô
              </button>
            </div>
          </>
        )}
      </div>

      {showPicker && (
        <IngredientPickerModal
          stocks={stocks}
          selectedIds={blockedIds}
          onSelect={handleSelectIngredient}
          onClose={() => setShowPicker(false)}
        />
      )}
    </>
  );
}

// ── Một dòng lô ───────────────────────────────────────────────────────────────
function LotRow({ lot, unit, onChange, onRemove }) {
  const tone = expiryTone(lot.expiryDate);
  return (
    <div style={{
      border: `1px solid ${lot.isNew ? 'rgba(201,168,76,.55)' : 'var(--wh-border)'}`,
      background: lot.isNew ? 'rgba(201,168,76,.06)' : 'var(--wh-surface2)',
      borderRadius: 10, padding: 10, marginBottom: 8,
    }}>
      {/* Dòng nhãn lô */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        {lot.isNew ? (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700,
            background: 'var(--wh-accent)', color: '#fff', padding: '2px 8px', borderRadius: 99,
          }}>
            <Sparkles size={11} /> LÔ MỚI
          </span>
        ) : (
          <span style={{
            fontSize: 11, fontWeight: 700, color: 'var(--wh-muted)',
            background: '#fff', border: '1px solid var(--wh-border)',
            padding: '2px 8px', borderRadius: 99,
          }}>
            Lô #{lot.lotId}
          </span>
        )}

        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600,
          background: tone.bg, color: tone.color, padding: '2px 8px', borderRadius: 99,
        }}>
          <CalendarClock size={11} /> {tone.label}
        </span>

        {!lot.isNew && lot.costPrice != null && (
          <span style={{ fontSize: 11, color: 'var(--wh-muted)' }}>
            Giá vốn: {Number(lot.costPrice).toLocaleString('vi-VN')} đ/{unit}
          </span>
        )}
        {lot.isNew && (
          <span style={{ fontSize: 11, color: '#92681a' }}>
            Giá vốn tạm = 1 · kế toán trưởng nhập sau
          </span>
        )}

        <span style={{ flex: 1 }} />

        {onRemove && (
          <button onClick={onRemove} title="Bỏ lô mới này"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4, border: 'none',
              background: 'transparent', color: 'var(--wh-danger)', cursor: 'pointer',
              fontSize: 12, fontWeight: 600, padding: 2,
            }}>
            <Trash2 size={13} /> Bỏ
          </button>
        )}
      </div>

      {/* Số lượng + HSD */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
        <div>
          <label className="wh-label" style={{ marginBottom: 4 }}>
            Số lượng {unit ? `(${unit})` : ''}
          </label>
          <input
            className="wh-input" type="number" min="0" step="0.001" inputMode="decimal"
            placeholder="0"
            value={lot.quantity ?? ''}
            onChange={(e) => onChange({ quantity: e.target.value })}
          />
        </div>
        <div>
          {/* HSD không bắt buộc — ghi rõ trên nhãn để người nhập khỏi đi tìm
              một giá trị không tồn tại cho vật tư vốn không có hạn. */}
          <label className="wh-label" style={{ marginBottom: 4 }}>
            Hạn sử dụng <span style={{ color: '#8E8878', fontWeight: 400 }}>(không bắt buộc)</span>
          </label>
          <input
            className="wh-input" type="date"
            value={lot.expiryDate || ''}
            onChange={(e) => onChange({ expiryDate: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, strong, tone }) {
  const color =
    tone === 'up' ? '#15803d' :
    tone === 'down' ? '#b91c1c' :
    tone === 'ok' ? '#15803d' :
    'var(--wh-text)';
  return (
    <div style={{
      background: 'var(--wh-surface2)', border: '1px solid var(--wh-border)',
      borderRadius: 9, padding: '7px 10px', minWidth: 0,
    }}>
      <div style={{ fontSize: 10.5, color: 'var(--wh-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: .3 }}>
        {label}
      </div>
      <div style={{
        fontSize: strong ? 14.5 : 13.5, fontWeight: strong ? 800 : 700, color,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {value}
      </div>
    </div>
  );
}
