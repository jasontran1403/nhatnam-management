// src/pages/warehouse/OperationsPage.jsx
// ADDED: WarehouseSelector — chọn kho để thao tác (nhập/xuất/chuyển/điều chỉnh)
import { useLang } from '../../context/LangContext';
import { useState, useEffect } from 'react';
import { CardSkeleton, Sk } from '../../components/ui/Skeleton.jsx';
import useMinLoading from '../../hooks/useMinLoading.js';
import { warehouseApi } from '../../api/warehouseApi';
import { useAuth } from '../../context/AuthContext';
import { useWarehouse } from '../../context/WarehouseContext';
import WarehouseSelector from '../../components/warehouse/WarehouseSelector';
import ImageUploader from '../../components/warehouse/ImageUploader';
import IngredientSelector from '../../components/warehouse/IngredientSelector';

export default function OperationsPage() {
  const { t } = useLang();
  const [tab, setTab] = useState('import');
  const { activeWarehouseName, hasMultipleWarehouses } = useWarehouse();

  const TABS = [
    { key: 'import', label: t('warehouse', 'import_label') },
    { key: 'export', label: t('warehouse', 'export_label') },
    { key: 'transfer', label: t('warehouse', 'transfer_label') },
    { key: 'adjust', label: t('warehouse', 'adjust_label') },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* ── Header với WarehouseSelector ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <h1 className="wh-page-title" style={{ margin: 0 }}>{t('nav', 'import_export')}</h1>
        <WarehouseSelector />
      </div>

      <div className="wh-tabs">
        {TABS.map(t => (
          <button key={t.key} className={`wh-tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'import' && <ImportForm />}
      {tab === 'export' && <ExportForm />}
      {tab === 'transfer' && <TransferForm />}
      {tab === 'adjust' && <AdjustForm />}
    </div>
  );
}

// ── Hook lấy kho đang active ──────────────────────────────────────────────────
function useMyWarehouse() {
  const { activeWarehouseId } = useWarehouse();
  const [myWarehouse, setMyWarehouse] = useState(null);
  const [allWarehouses, setAllWarehouses] = useState([]);
  const [stocks, setStocks] = useState([]);

  useEffect(() => {
    warehouseApi.getAll().then(res => {
      const list = res.data || [];
      setAllWarehouses(list);
      if (activeWarehouseId) {
        const found = list.find(w => w.id === Number(activeWarehouseId));
        if (found) setMyWarehouse(found);
      } else {
        const firstSale = list.find(w => w.type === 'SALE') || list[0];
        if (firstSale) setMyWarehouse(firstSale);
      }
    });
  }, [activeWarehouseId]);

  useEffect(() => {
    if (!myWarehouse?.id) return;
    warehouseApi.getStock(myWarehouse.id).then(res => setStocks(res.data || []));
  }, [myWarehouse?.id]);

  return { myWarehouse, allWarehouses, stocks };
}

function emptyRow(mode) {
  if (mode === 'import') return { ingredientId: '', quantity: '', expiryDate: '' };
  if (mode === 'adjust') return { ingredientId: '', physicalQty: '' };
  return { ingredientId: '', quantity: '' };
}

function FormShell({ title, warehouseName, onSubmit, loading, error, success, children }) {
  const { t } = useLang();
  return (
    <div className="wh-card" style={{ paddingBottom: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{title}</h2>
        {warehouseName && (
          <span style={{
            fontSize: 12, fontWeight: 600,
            background: 'rgba(201,168,76,.12)', color: 'var(--wh-accent)',
            padding: '3px 10px', borderRadius: 99,
          }}>
            🏪 {warehouseName}
          </span>
        )}
      </div>
      {error && <div className="wh-alert wh-alert-error">⚠️ {error}</div>}
      {success && <div className="wh-alert wh-alert-success">✅ {success}</div>}

      {/* Phần nội dung form — cuộn được riêng nếu quá dài */}
      <div style={{ paddingBottom: 30 }}>
        {children}
      </div>

      {/* Nút Xác nhận — sticky ở đáy viewport trên mobile */}
      <div
        style={{
          position: 'sticky',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'var(--wh-surface, #fff)',
          paddingTop: 12,
          paddingBottom: 'max(36px, env(safe-area-inset-bottom))',
          marginLeft: -16,
          marginRight: -16,
          paddingLeft: 16,
          paddingRight: 16,
          borderTop: '1px solid var(--wh-border, #eee)',
          zIndex: 5,
        }}
      >
        <button className="wh-btn wh-btn-primary" onClick={onSubmit} disabled={loading} style={{ width: '100%' }}>
          {loading ? t('common', 'processing') : t('common', 'confirm')}
        </button>
      </div>
    </div>
  );
}

// ── NHẬP KHO ─────────────────────────────────────────────────────────────────
function ImportForm() {
  const { myWarehouse, stocks } = useMyWarehouse();
  const [refCode, setRefCode] = useState('');
  const [note, setNote] = useState('');
  const [images, setImages] = useState([]);
  const [rows, setRows] = useState([emptyRow('import')]);
  const [loading, setLoading] = useMinLoading();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const updateRow = (i, v) => setRows(rows.map((r, idx) => idx === i ? v : r));
  const removeRow = (i) => setRows(rows.filter((_, idx) => idx !== i));

  const handleSubmit = async () => {
    setError(''); setSuccess('');
    if (!myWarehouse?.id) return setError('Không xác định được kho.');
    const validRows = rows.filter(r => r.ingredientId && r.quantity > 0);
    if (!validRows.length) return setError('Vui lòng thêm ít nhất 1 nguyên liệu.');
    setLoading(true);
    try {
      const res = await warehouseApi.import({
        warehouseId: myWarehouse.id,
        referenceCode: refCode,
        note,
        imageUrls: images,
        items: validRows.map(r => ({
          ingredientId: r.ingredientId,
          quantity: Number(r.quantity),
          expiryDate: r.expiryDate || null,
        })),
      });
      setSuccess(`Phiếu nhập đã tạo! Mã phiếu: ${res.data.receiptCode} — Chờ kế toán trưởng nhập giá vốn để cộng tồn kho.`);
      setRows([emptyRow('import')]); setRefCode(''); setNote(''); setImages([]);
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || 'Có lỗi xảy ra');
    } finally { setLoading(false); }
  };

  return (
    <FormShell title="📥 Phiếu nhập kho" warehouseName={myWarehouse?.name}
      onSubmit={handleSubmit} loading={loading} error={error} success={success}>
      <div style={{
        background: 'rgba(201,168,76,.08)', border: '1px solid rgba(201,168,76,.3)',
        borderRadius: 10, padding: '10px 14px', marginBottom: 16,
        fontSize: 12, color: '#92681a', lineHeight: 1.5,
      }}>
        ℹ️ Sau khi tạo phiếu, <strong>Kế toán trưởng</strong> sẽ nhập giá vốn và xác nhận.
        Tồn kho sẽ được cộng sau khi kế toán trưởng xác nhận.
      </div>

      <div className="wh-form-row">
        <div>
          <label className="wh-label">Mã phiếu NCC</label>
          <input className="wh-input" placeholder="VD: NCC-2024-001"
            value={refCode} onChange={e => setRefCode(e.target.value)} />
        </div>
      </div>
      <div className="wh-form-row">
        <div>
          <label className="wh-label">Ghi chú</label>
          <textarea className="wh-textarea" rows={2} value={note}
            onChange={e => setNote(e.target.value)} placeholder="Ghi chú thêm..." />
        </div>
      </div>
      <div style={{ marginBottom: 14 }}>
        <label className="wh-label">Ảnh phiếu nhập hàng</label>
        <ImageUploader value={images} onChange={setImages} />
      </div>
      <hr className="wh-sep" />
      <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 13 }}>Danh sách nguyên liệu nhập</div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 8, marginBottom: 6, paddingLeft: 12, fontSize: 12, color: 'var(--wh-muted)' }}>
        <span>Nguyên liệu</span><span>Số lượng</span><span>Hạn sử dụng</span><span></span>
      </div>
      <div className="wh-ing-rows">
        {rows.map((row, i) => (
          <IngredientSelector key={i} stocks={stocks} value={row}
            selectedIngredientIds={rows.map(r => r.ingredientId).filter(Boolean)}
            onChange={v => updateRow(i, v)} onRemove={() => removeRow(i)} mode="import"
            canRemove={rows.length > 1} />
        ))}
      </div>
      <button className="wh-btn wh-btn-secondary wh-btn-sm" onClick={() => setRows([...rows, emptyRow('import')])}
        style={{ marginBottom: 14 }}>
        + Thêm nguyên liệu
      </button>
    </FormShell>
  );
}

// ── XUẤT KHO ─────────────────────────────────────────────────────────────────
function ExportForm() {
  const { myWarehouse, stocks } = useMyWarehouse();
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [images, setImages] = useState([]);
  const [rows, setRows] = useState([emptyRow('export')]);
  const [loading, setLoading] = useMinLoading();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const updateRow = (i, v) => setRows(rows.map((r, idx) => idx === i ? v : r));
  const removeRow = (i) => setRows(rows.filter((_, idx) => idx !== i));

  const handleSubmit = async () => {
    setError(''); setSuccess('');
    if (!myWarehouse?.id) return setError('Không xác định được kho.');
    if (myWarehouse.type === 'TRANSIT') return setError('Kho trung chuyển không được phép xuất bán.');
    if (!reason.trim()) return setError('Vui lòng nhập lý do xuất kho.');
    const validRows = rows.filter(r => r.ingredientId && r.quantity > 0);
    if (!validRows.length) return setError('Vui lòng thêm ít nhất 1 nguyên liệu.');
    setLoading(true);
    try {
      const res = await warehouseApi.export({
        warehouseId: myWarehouse.id, reason, note, imageUrls: images,
        items: validRows.map(r => ({ ingredientId: r.ingredientId, quantity: Number(r.quantity) })),
      });
      setSuccess(`Xuất kho thành công! Mã phiếu: ${res.data.receiptCode}`);
      setRows([emptyRow('export')]); setReason(''); setNote(''); setImages([]);
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || 'Có lỗi xảy ra');
    } finally { setLoading(false); }
  };

  return (
    <FormShell title="📤 Phiếu xuất kho" warehouseName={myWarehouse?.name}
      onSubmit={handleSubmit} loading={loading} error={error} success={success}>
      {myWarehouse?.type === 'TRANSIT' && (
        <div className="wh-alert wh-alert-error">⛔ Kho trung chuyển không được phép xuất bán!</div>
      )}
      <div className="wh-form-row">
        <div>
          <label className="wh-label">Lý do xuất kho <span style={{ color: 'var(--wh-danger)' }}>*</span></label>
          <input className="wh-input" placeholder="Nhập lý do bắt buộc..."
            value={reason} onChange={e => setReason(e.target.value)} />
        </div>
      </div>
      <div className="wh-form-row">
        <div>
          <label className="wh-label">Ghi chú</label>
          <textarea className="wh-textarea" rows={2} value={note}
            onChange={e => setNote(e.target.value)} placeholder="Ghi chú thêm..." />
        </div>
      </div>
      <div style={{ marginBottom: 14 }}>
        <label className="wh-label">Ảnh chứng từ</label>
        <ImageUploader value={images} onChange={setImages} />
      </div>
      <hr className="wh-sep" />
      <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 13 }}>Danh sách nguyên liệu xuất</div>
      <div className="wh-ing-rows">
        {rows.map((row, i) => (
          <IngredientSelector key={i} stocks={stocks} value={row}
            selectedIngredientIds={rows.map(r => r.ingredientId).filter(Boolean)}
            onChange={v => updateRow(i, v)} onRemove={() => removeRow(i)} mode="export"
            canRemove={rows.length > 1} />
        ))}
      </div>
      <button className="wh-btn wh-btn-secondary wh-btn-sm" onClick={() => setRows([...rows, emptyRow('export')])}
        style={{ marginBottom: 14 }}>
        + Thêm nguyên liệu
      </button>
    </FormShell>
  );
}

// ── CHUYỂN KHO ───────────────────────────────────────────────────────────────
function TransferForm() {
  const { myWarehouse, allWarehouses, stocks } = useMyWarehouse();
  // dest được mã hoá "w:<id>" (kho thường) hoặc "f:<id>" (kho sản xuất/xưởng)
  const [dest, setDest] = useState('');
  const [note, setNote] = useState('');
  const [images, setImages] = useState([]);
  const [rows, setRows] = useState([emptyRow('transfer')]);
  const [loading, setLoading] = useMinLoading();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [factories, setFactories] = useState([]);
  const [fgFactories, setFgFactories] = useState([]);
  // Bộ khoá nguyên liệu mà kho ĐÍCH đang có (để lọc dropdown kho nguồn):
  //  - kho thường: Set ingredientId
  //  - kho xưởng : Set tên nguyên liệu (lowercase)
  const [destIngredientIds, setDestIngredientIds] = useState(null);
  const [destMaterialNames, setDestMaterialNames] = useState(null);
  const [destLoading, setDestLoading] = useState(false);

  const destWarehouses = allWarehouses.filter(w => w.id !== myWarehouse?.id);

  useEffect(() => {
    warehouseApi.listProductionFactories()
      .then(res => setFactories(res.data || []))
      .catch(() => setFactories([]));
    warehouseApi.listFinishedGoodsFactories()
      .then(res => setFgFactories(res.data || []))
      .catch(() => setFgFactories([]));
  }, []);

  // Khi đổi kho đích → nạp danh mục nguyên liệu kho đích + reset dòng
  useEffect(() => {
    setDestIngredientIds(null);
    setDestMaterialNames(null);
    setRows([emptyRow('transfer')]);
    if (!dest) return;
    const [kind, idStr] = dest.split(':');
    const id = Number(idStr);
    setDestLoading(true);
    if (kind === 'w') {
      // "kho đích có nguyên liệu X" = X đã ĐĂNG KÝ (gán) cho kho đích
      warehouseApi.getRegisteredIngredientIds(id)
        .then(res => setDestIngredientIds(new Set(res.data || [])))
        .catch(() => setDestIngredientIds(new Set()))
        .finally(() => setDestLoading(false));
    } else if (kind === 'g') {
      // kho THÀNH PHẨM xưởng: lọc theo tên thành phẩm đang có
      warehouseApi.getFinishedGoodsProductNames(id)
        .then(res => setDestMaterialNames(new Set((res.data || []).map(n => String(n).trim().toLowerCase()))))
        .catch(() => setDestMaterialNames(new Set()))
        .finally(() => setDestLoading(false));
    } else {
      warehouseApi.getFactoryMaterialNames(id)
        .then(res => setDestMaterialNames(new Set((res.data || []).map(n => String(n).trim().toLowerCase()))))
        .catch(() => setDestMaterialNames(new Set()))
        .finally(() => setDestLoading(false));
    }
  }, [dest]);

  // Kho nguồn chỉ hiển thị nguyên liệu CÓ TỒN (qty>0) và mà kho đích cũng có (Mục 4.1 & 4.2)
  const availableStocks = (() => {
    const inStock = stocks.filter(s => Number(s.stockQuantity) > 0);
    if (!dest) return inStock;
    if (destIngredientIds) return inStock.filter(s => destIngredientIds.has(s.ingredientId));
    if (destMaterialNames) return inStock.filter(s => destMaterialNames.has(String(s.ingredientName || '').trim().toLowerCase()));
    return [];
  })();

  const updateRow = (i, v) => setRows(rows.map((r, idx) => idx === i ? v : r));
  const removeRow = (i) => setRows(rows.filter((_, idx) => idx !== i));

  const handleSubmit = async () => {
    setError(''); setSuccess('');
    if (!myWarehouse?.id) return setError('Không xác định được kho nguồn.');
    if (!dest) return setError('Vui lòng chọn kho đích.');
    const validRows = rows.filter(r => r.ingredientId && r.quantity > 0);
    if (!validRows.length) return setError('Vui lòng thêm ít nhất 1 nguyên liệu.');
    const [kind, idStr] = dest.split(':');
    const destId = Number(idStr);
    setLoading(true);
    try {
      const payload = {
        fromWarehouseId: myWarehouse.id, note, imageUrls: images,
        items: validRows.map(r => ({ ingredientId: r.ingredientId, quantity: Number(r.quantity) })),
      };
      if (kind === 'w') payload.toWarehouseId = destId;
      else if (kind === 'g') payload.toFinishedGoodsFactoryId = destId;
      else payload.toProductionFactoryId = destId;
      const res = await warehouseApi.transfer(payload);
      const outCode = res.data?.outReceipt?.receiptCode;
      const inCode = res.data?.inReceipt?.receiptCode;
      setSuccess(inCode
        ? `Chuyển kho thành công! Phiếu xuất: ${outCode} — Phiếu nhập: ${inCode}`
        : `Chuyển sang kho sản xuất thành công! Phiếu xuất: ${outCode}`);
      setRows([emptyRow('transfer')]); setDest(''); setNote(''); setImages([]);
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || 'Có lỗi xảy ra');
    } finally { setLoading(false); }
  };

  const toWhName = (() => {
    if (!dest) return '';
    const [kind, idStr] = dest.split(':');
    const id = Number(idStr);
    return kind === 'w'
      ? (destWarehouses.find(w => w.id === id)?.name || '')
      : kind === 'g'
        ? (fgFactories.find(f => f.id === id)?.name || '')
        : (factories.find(f => f.id === id)?.name || '');
  })();

  return (
    <FormShell title="🔄 Phiếu chuyển kho" warehouseName={myWarehouse?.name}
      onSubmit={handleSubmit} loading={loading} error={error} success={success}>
      <div className="wh-form-row cols-2">
        <div>
          <label className="wh-label">Kho nguồn</label>
          <div className="wh-input" style={{ background: 'var(--wh-surface2)', color: 'var(--wh-muted)', cursor: 'default' }}>
            {myWarehouse?.name || '—'}
          </div>
        </div>
        <div>
          <label className="wh-label">Kho đích <span style={{ color: 'var(--wh-danger)' }}>*</span></label>
          <select className="wh-select" value={dest} onChange={e => setDest(e.target.value)}>
            <option value="">-- Chọn kho đích --</option>
            {destWarehouses.length > 0 && (
              <optgroup label="Kho hàng">
                {destWarehouses.map(w => (
                  <option key={`w${w.id}`} value={`w:${w.id}`}>
                    {w.name} ({w.type === 'TRANSIT' ? 'Trung chuyển' : 'Bán hàng'})
                  </option>
                ))}
              </optgroup>
            )}
            {factories.length > 0 && (
              <optgroup label="Kho sản xuất (xưởng)">
                {factories.map(f => (
                  <option key={`f${f.id}`} value={`f:${f.id}`}>{f.name}</option>
                ))}
              </optgroup>
            )}
            {fgFactories.length > 0 && (
              <optgroup label="Kho thành phẩm xưởng">
                {fgFactories.map(f => (
                  <option key={`g${f.id}`} value={`g:${f.id}`}>{f.name}</option>
                ))}
              </optgroup>
            )}
          </select>
        </div>
      </div>
      {dest && myWarehouse && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 14px', borderRadius: 8,
          background: 'rgba(2,132,199,.07)', color: '#0284c7',
          fontSize: 13, marginBottom: 14,
        }}>
          <span style={{ fontWeight: 600 }}>{myWarehouse.name}</span>
          <span>→</span>
          <span style={{ fontWeight: 600 }}>{toWhName}</span>
        </div>
      )}
      <div className="wh-form-row">
        <div>
          <label className="wh-label">Ghi chú</label>
          <textarea className="wh-textarea" rows={2} value={note}
            onChange={e => setNote(e.target.value)} placeholder="Ghi chú..." />
        </div>
      </div>
      <div style={{ marginBottom: 14 }}>
        <label className="wh-label">Ảnh chứng từ</label>
        <ImageUploader value={images} onChange={setImages} />
      </div>
      <hr className="wh-sep" />
      <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 13 }}>
        Nguyên liệu cần chuyển (từ {myWarehouse?.name || 'kho nguồn'})
      </div>
      {dest && (
        <div style={{ fontSize: 12, color: 'var(--wh-muted)', marginBottom: 8 }}>
          {destLoading
            ? 'Đang tải danh mục kho đích…'
            : `Chỉ hiển thị nguyên liệu mà kho đích (${toWhName}) đang có.`}
        </div>
      )}
      {dest && !destLoading && availableStocks.length === 0 && (
        <div style={{ fontSize: 13, color: 'var(--wh-danger)', marginBottom: 8 }}>
          Kho đích không có nguyên liệu nào trùng với kho nguồn.
        </div>
      )}
      <div className="wh-ing-rows">
        {rows.map((row, i) => (
          <IngredientSelector key={i} stocks={availableStocks} value={row}
            selectedIngredientIds={rows.map(r => r.ingredientId).filter(Boolean)}
            onChange={v => updateRow(i, v)} onRemove={() => removeRow(i)} mode="transfer"
            canRemove={rows.length > 1} />
        ))}
      </div>
      <button className="wh-btn wh-btn-secondary wh-btn-sm" onClick={() => setRows([...rows, emptyRow('transfer')])}
        style={{ marginBottom: 14 }}>
        + Thêm nguyên liệu
      </button>
    </FormShell>
  );
}

// ── ĐIỀU CHỈNH ───────────────────────────────────────────────────────────────
function AdjustForm() {
  const { myWarehouse, stocks } = useMyWarehouse();
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [images, setImages] = useState([]);
  const [rows, setRows] = useState([emptyRow('adjust')]);
  const [loading, setLoading] = useMinLoading();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const updateRow = (i, v) => setRows(rows.map((r, idx) => idx === i ? v : r));
  const removeRow = (i) => setRows(rows.filter((_, idx) => idx !== i));

  const handleSubmit = async () => {
    setError(''); setSuccess('');
    if (!myWarehouse?.id) return setError('Không xác định được kho.');
    const validRows = rows.filter(r => r.ingredientId && r.physicalQty !== '' && r.physicalQty !== undefined);
    if (!validRows.length) return setError('Vui lòng thêm ít nhất 1 nguyên liệu cần điều chỉnh.');
    setLoading(true);
    try {
      const res = await warehouseApi.adjust({
        warehouseId: myWarehouse.id, reason, note, imageUrls: images,
        items: validRows.map(r => ({ ingredientId: r.ingredientId, physicalQty: Number(r.physicalQty) })),
      });
      setSuccess(`Điều chỉnh thành công! Mã phiếu: ${res.data.receiptCode}`);
      setRows([emptyRow('adjust')]); setReason(''); setNote(''); setImages([]);
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || 'Có lỗi xảy ra');
    } finally { setLoading(false); }
  };

  return (
    <FormShell title="🔧 Phiếu điều chỉnh tồn kho" warehouseName={myWarehouse?.name}
      onSubmit={handleSubmit} loading={loading} error={error} success={success}>
      <div className="wh-form-row">
        <div>
          <label className="wh-label">Lý do điều chỉnh</label>
          <input className="wh-input" placeholder="Kiểm kê định kỳ, hư hỏng..."
            value={reason} onChange={e => setReason(e.target.value)} />
        </div>
      </div>
      <div className="wh-form-row">
        <div>
          <label className="wh-label">Ghi chú</label>
          <textarea className="wh-textarea" rows={2} value={note}
            onChange={e => setNote(e.target.value)} placeholder="Ghi chú thêm..." />
        </div>
      </div>
      <div style={{ marginBottom: 14 }}>
        <label className="wh-label">Ảnh chứng từ / biên bản</label>
        <ImageUploader value={images} onChange={setImages} />
      </div>
      <hr className="wh-sep" />
      <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 13 }}>Danh sách kiểm kê</div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 8, marginBottom: 6, paddingLeft: 12, fontSize: 12, color: 'var(--wh-muted)' }}>
        <span>Nguyên liệu</span><span>Tồn hệ thống</span><span>Thực tế kiểm</span><span>Chênh lệch</span><span></span>
      </div>
      <div className="wh-ing-rows">
        {rows.map((row, i) => (
          <IngredientSelector key={i} stocks={stocks} value={row}
            selectedIngredientIds={rows.map(r => r.ingredientId).filter(Boolean)}
            onChange={v => updateRow(i, v)} onRemove={() => removeRow(i)} mode="adjust"
            canRemove={rows.length > 1} />
        ))}
      </div>
      <button className="wh-btn wh-btn-secondary wh-btn-sm" onClick={() => setRows([...rows, emptyRow('adjust')])}
        style={{ marginBottom: 14 }}>
        + Thêm nguyên liệu
      </button>
    </FormShell>
  );
}