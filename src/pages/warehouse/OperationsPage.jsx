// src/pages/warehouse/OperationsPage.jsx
import { useState, useEffect } from 'react';
import { warehouseApi, getImageUrl } from '../../api/warehouseApi';
import ImageUploader from '../../components/warehouse/ImageUploader';
import IngredientSelector from '../../components/warehouse/IngredientSelector';

const TABS = [
  { key: 'import', label: '📥 Nhập kho' },
  { key: 'export', label: '📤 Xuất kho' },
  { key: 'transfer', label: '🔄 Chuyển kho' },
  { key: 'adjust', label: '🔧 Điều chỉnh' },
];

export default function OperationsPage() {
  const [tab, setTab] = useState('import');
  return (
    <div>
      <h1 className="wh-page-title">Thao tác kho</h1>
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

// ── Shared hooks & components ─────────────────────────────────────────────────

function useWarehouseData() {
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWh, setSelectedWh] = useState('');
  const [stocks, setStocks] = useState([]);

  useEffect(() => {
    warehouseApi.getAll().then(res => {
      const list = res.data;
      setWarehouses(list);
      const firstSale = list.find(w => w.type === 'SALE');
      if (firstSale) setFromWh(firstSale.id);
      else if (list.length > 0) setFromWh(list[0].id);
    });
  }, []);

  useEffect(() => {
    if (!selectedWh) return;
    warehouseApi.getStock(selectedWh).then(res => setStocks(res.data));
  }, [selectedWh]);

  return { warehouses, selectedWh, setSelectedWh, stocks };
}

function emptyRow(mode) {
  if (mode === 'import') return { ingredientId: '', quantity: '', expiryDate: '' };
  if (mode === 'adjust') return { ingredientId: '', physicalQty: '' };
  return { ingredientId: '', quantity: '' };
}

function FormShell({ title, onSubmit, loading, error, success, children }) {
  return (
    <div className="wh-card">
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>{title}</h2>
      {error && <div className="wh-alert wh-alert-error">⚠️ {error}</div>}
      {success && <div className="wh-alert wh-alert-success">✅ {success}</div>}
      {children}
      <hr className="wh-sep" />
      <button className="wh-btn wh-btn-primary" onClick={onSubmit} disabled={loading}>
        {loading ? 'Đang xử lý...' : 'Xác nhận'}
      </button>
    </div>
  );
}

function WarehouseSelect({ warehouses, value, onChange, label = 'Kho', filter }) {
  const list = filter ? warehouses.filter(filter) : warehouses;
  return (
    <div>
      <label className="wh-label">{label}</label>
      <select className="wh-select" value={value} onChange={e => onChange(Number(e.target.value))}>
        <option value="">-- Chọn kho --</option>
        {list.map(w => <option key={w.id} value={w.id}>{w.name} ({w.type === 'TRANSIT' ? 'Trung chuyển' : 'Bán hàng'})</option>)}
      </select>
    </div>
  );
}

function AddRowButton({ onClick }) {
  return (
    <button className="wh-btn wh-btn-secondary wh-btn-sm" onClick={onClick} style={{ marginBottom: 14 }}>
      + Thêm nguyên liệu
    </button>
  );
}

// ── NHẬP KHO ─────────────────────────────────────────────────────────────────
function ImportForm() {
  const { warehouses, selectedWh, setSelectedWh, stocks } = useWarehouseData();
  const [refCode, setRefCode] = useState('');
  const [note, setNote] = useState('');
  const [images, setImages] = useState([]);
  const [rows, setRows] = useState([emptyRow('import')]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const updateRow = (i, v) => setRows(rows.map((r, idx) => idx === i ? v : r));
  const removeRow = (i) => setRows(rows.filter((_, idx) => idx !== i));

  const handleSubmit = async () => {
    setError(''); setSuccess('');
    if (!selectedWh) return setError('Vui lòng chọn kho.');
    const validRows = rows.filter(r => r.ingredientId && r.quantity > 0);
    if (!validRows.length) return setError('Vui lòng thêm ít nhất 1 nguyên liệu.');
    setLoading(true);
    try {
      const res = await warehouseApi.import({
        warehouseId: selectedWh, referenceCode: refCode, note, imageUrls: images,
        items: validRows.map(r => ({ ingredientId: r.ingredientId, quantity: Number(r.quantity), expiryDate: r.expiryDate || null })),
      });
      setSuccess(`Nhập kho thành công! Mã phiếu: ${res.data.receiptCode}`);
      setRows([emptyRow('import')]); setRefCode(''); setNote(''); setImages([]);
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || 'Có lỗi xảy ra');
    } finally { setLoading(false); }
  };

  return (
    <FormShell title="📥 Phiếu nhập kho" onSubmit={handleSubmit} loading={loading} error={error} success={success}>
      <div className="wh-form-row cols-2">
        <WarehouseSelect warehouses={warehouses} value={selectedWh} onChange={setSelectedWh} />
        <div>
          <label className="wh-label">Mã phiếu NCC</label>
          <input className="wh-input" placeholder="VD: NCC-2024-001" value={refCode} onChange={e => setRefCode(e.target.value)} />
        </div>
      </div>
      <div className="wh-form-row">
        <div>
          <label className="wh-label">Ghi chú</label>
          <textarea className="wh-textarea" rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="Ghi chú thêm..." />
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
        {rows.map((row, i) => <IngredientSelector key={i} stocks={stocks} value={row} onChange={v => updateRow(i, v)} onRemove={() => removeRow(i)} mode="import" />)}
      </div>
      <AddRowButton onClick={() => setRows([...rows, emptyRow('import')])} />
    </FormShell>
  );
}

// ── XUẤT KHO ─────────────────────────────────────────────────────────────────
function ExportForm() {
  const { warehouses, selectedWh, setSelectedWh, stocks } = useWarehouseData();
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [images, setImages] = useState([]);
  const [rows, setRows] = useState([emptyRow('export')]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const currentWh = warehouses.find(w => w.id === selectedWh);
  const updateRow = (i, v) => setRows(rows.map((r, idx) => idx === i ? v : r));
  const removeRow = (i) => setRows(rows.filter((_, idx) => idx !== i));

  const handleSubmit = async () => {
    setError(''); setSuccess('');
    if (!selectedWh) return setError('Vui lòng chọn kho.');
    if (currentWh?.type === 'TRANSIT') return setError('Kho trung chuyển không được phép xuất bán.');
    if (!reason.trim()) return setError('Vui lòng nhập lý do xuất kho.');
    const validRows = rows.filter(r => r.ingredientId && r.quantity > 0);
    if (!validRows.length) return setError('Vui lòng thêm ít nhất 1 nguyên liệu.');
    setLoading(true);
    try {
      const res = await warehouseApi.export({
        warehouseId: selectedWh, reason, note, imageUrls: images,
        items: validRows.map(r => ({ ingredientId: r.ingredientId, quantity: Number(r.quantity) })),
      });
      setSuccess(`Xuất kho thành công! Mã phiếu: ${res.data.receiptCode}`);
      setRows([emptyRow('export')]); setReason(''); setNote(''); setImages([]);
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || 'Có lỗi xảy ra');
    } finally { setLoading(false); }
  };

  return (
    <FormShell title="📤 Phiếu xuất kho" onSubmit={handleSubmit} loading={loading} error={error} success={success}>
      {currentWh?.type === 'TRANSIT' && <div className="wh-alert wh-alert-error">⛔ Kho trung chuyển không được phép xuất bán!</div>}
      <div className="wh-form-row cols-2">
        <WarehouseSelect warehouses={warehouses} value={selectedWh} onChange={setSelectedWh} filter={w => w.type === 'SALE'} />
        <div>
          <label className="wh-label">Lý do xuất kho <span style={{ color: 'var(--wh-danger)' }}>*</span></label>
          <input className="wh-input" placeholder="Nhập lý do bắt buộc..." value={reason} onChange={e => setReason(e.target.value)} />
        </div>
      </div>
      <div className="wh-form-row">
        <div>
          <label className="wh-label">Ghi chú</label>
          <textarea className="wh-textarea" rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="Ghi chú thêm..." />
        </div>
      </div>
      <div style={{ marginBottom: 14 }}>
        <label className="wh-label">Ảnh chứng từ</label>
        <ImageUploader value={images} onChange={setImages} />
      </div>
      <hr className="wh-sep" />
      <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 13 }}>Danh sách nguyên liệu xuất</div>
      <div className="wh-ing-rows">
        {rows.map((row, i) => <IngredientSelector key={i} stocks={stocks} value={row} onChange={v => updateRow(i, v)} onRemove={() => removeRow(i)} mode="export" />)}
      </div>
      <AddRowButton onClick={() => setRows([...rows, emptyRow('export')])} />
    </FormShell>
  );
}

// ── CHUYỂN KHO ───────────────────────────────────────────────────────────────
function TransferForm() {
  const [warehouses, setWarehouses] = useState([]);
  const [fromWh, setFromWh] = useState('');
  const [toWh, setToWh] = useState('');
  const [fromStocks, setFromStocks] = useState([]);
  const [note, setNote] = useState('');
  const [images, setImages] = useState([]);
  const [rows, setRows] = useState([emptyRow('transfer')]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    warehouseApi.getAll().then(res => {
      const list = res.data;
      setWarehouses(list);
      if (list.length > 0) setFromWh(list[0].id);
    });
  }, []);

  useEffect(() => {
    if (fromWh) warehouseApi.getStock(fromWh).then(res => setFromStocks(res.data));
  }, [fromWh]);

  const updateRow = (i, v) => setRows(rows.map((r, idx) => idx === i ? v : r));
  const removeRow = (i) => setRows(rows.filter((_, idx) => idx !== i));

  const handleSubmit = async () => {
    setError(''); setSuccess('');
    if (!fromWh || !toWh) return setError('Vui lòng chọn kho nguồn và kho đích.');
    if (fromWh === toWh) return setError('Kho nguồn và kho đích không được trùng nhau.');
    const validRows = rows.filter(r => r.ingredientId && r.quantity > 0);
    if (!validRows.length) return setError('Vui lòng thêm ít nhất 1 nguyên liệu.');
    setLoading(true);
    try {
      const res = await warehouseApi.transfer({
        fromWarehouseId: fromWh, toWarehouseId: toWh, note, imageUrls: images,
        items: validRows.map(r => ({ ingredientId: r.ingredientId, quantity: Number(r.quantity) })),
      });
      setSuccess(`Chuyển kho thành công! Phiếu xuất: ${res.data.outReceipt.receiptCode} — Phiếu nhập: ${res.data.inReceipt.receiptCode}`);
      setRows([emptyRow('transfer')]); setNote(''); setImages([]);
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || 'Có lỗi xảy ra');
    } finally { setLoading(false); }
  };

  const fromName = warehouses.find(w => w.id === fromWh)?.name || '';
  const toName = warehouses.find(w => w.id === toWh)?.name || '';

  return (
    <FormShell title="🔄 Phiếu chuyển kho" onSubmit={handleSubmit} loading={loading} error={error} success={success}>
      <div className="wh-form-row cols-2">
        <WarehouseSelect warehouses={warehouses} value={fromWh} onChange={setFromWh} label="Kho nguồn" />
        <WarehouseSelect warehouses={warehouses} value={toWh} onChange={setToWh} label="Kho đích" />
      </div>
      {fromWh && toWh && fromWh !== toWh && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderRadius: 8, background: 'rgba(2,132,199,.07)', color: '#0284c7', fontSize: 13, marginBottom: 14 }}>
          <span style={{ fontWeight: 600 }}>{fromName}</span>
          <span>→</span>
          <span style={{ fontWeight: 600 }}>{toName}</span>
        </div>
      )}
      <div className="wh-form-row">
        <div>
          <label className="wh-label">Ghi chú</label>
          <textarea className="wh-textarea" rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="Ghi chú..." />
        </div>
      </div>
      <div style={{ marginBottom: 14 }}>
        <label className="wh-label">Ảnh chứng từ</label>
        <ImageUploader value={images} onChange={setImages} />
      </div>
      <hr className="wh-sep" />
      <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 13 }}>Nguyên liệu cần chuyển (từ kho nguồn)</div>
      <div className="wh-ing-rows">
        {rows.map((row, i) => <IngredientSelector key={i} stocks={fromStocks} value={row} onChange={v => updateRow(i, v)} onRemove={() => removeRow(i)} mode="transfer" />)}
      </div>
      <AddRowButton onClick={() => setRows([...rows, emptyRow('transfer')])} />
    </FormShell>
  );
}

// ── ĐIỀU CHỈNH ───────────────────────────────────────────────────────────────
function AdjustForm() {
  const { warehouses, selectedWh, setSelectedWh, stocks } = useWarehouseData();
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [images, setImages] = useState([]);
  const [rows, setRows] = useState([emptyRow('adjust')]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const updateRow = (i, v) => setRows(rows.map((r, idx) => idx === i ? v : r));
  const removeRow = (i) => setRows(rows.filter((_, idx) => idx !== i));

  const handleSubmit = async () => {
    setError(''); setSuccess('');
    if (!selectedWh) return setError('Vui lòng chọn kho.');
    const validRows = rows.filter(r => r.ingredientId && r.physicalQty !== '' && r.physicalQty !== undefined);
    if (!validRows.length) return setError('Vui lòng thêm ít nhất 1 nguyên liệu cần điều chỉnh.');
    setLoading(true);
    try {
      const res = await warehouseApi.adjust({
        warehouseId: selectedWh, reason, note, imageUrls: images,
        items: validRows.map(r => ({ ingredientId: r.ingredientId, physicalQty: Number(r.physicalQty) })),
      });
      setSuccess(`Điều chỉnh thành công! Mã phiếu: ${res.data.receiptCode}`);
      setRows([emptyRow('adjust')]); setReason(''); setNote(''); setImages([]);
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || 'Có lỗi xảy ra');
    } finally { setLoading(false); }
  };

  return (
    <FormShell title="🔧 Phiếu điều chỉnh tồn kho" onSubmit={handleSubmit} loading={loading} error={error} success={success}>
      <div className="wh-form-row cols-2">
        <WarehouseSelect warehouses={warehouses} value={selectedWh} onChange={setSelectedWh} />
        <div>
          <label className="wh-label">Lý do điều chỉnh</label>
          <input className="wh-input" placeholder="Kiểm kê định kỳ, hư hỏng..." value={reason} onChange={e => setReason(e.target.value)} />
        </div>
      </div>
      <div className="wh-form-row">
        <div>
          <label className="wh-label">Ghi chú</label>
          <textarea className="wh-textarea" rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="Ghi chú thêm..." />
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
        {rows.map((row, i) => <IngredientSelector key={i} stocks={stocks} value={row} onChange={v => updateRow(i, v)} onRemove={() => removeRow(i)} mode="adjust" />)}
      </div>
      <AddRowButton onClick={() => setRows([...rows, emptyRow('adjust')])} />
    </FormShell>
  );
}