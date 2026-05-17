// src/pages/warehouse/OperationsPage.jsx
import { useState, useEffect } from 'react';
import { warehouseApi } from '../../api/warehouseApi';
import { useAuth } from '../../context/AuthContext';
import ImageUploader from '../../components/warehouse/ImageUploader';
import IngredientSelector from '../../components/warehouse/IngredientSelector';

const TABS = [
  { key: 'import',   label: '📥 Nhập kho' },
  { key: 'export',   label: '📤 Xuất kho' },
  { key: 'transfer', label: '🔄 Chuyển kho' },
  { key: 'adjust',   label: '🔧 Điều chỉnh' },
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
      {tab === 'import'   && <ImportForm />}
      {tab === 'export'   && <ExportForm />}
      {tab === 'transfer' && <TransferForm />}
      {tab === 'adjust'   && <AdjustForm />}
    </div>
  );
}

// ── Hook lấy kho của user hiện tại ───────────────────────────────────────────
function useMyWarehouse() {
  const { user } = useAuth();
  const [myWarehouse, setMyWarehouse]   = useState(null);  // { id, name, type }
  const [allWarehouses, setAllWarehouses] = useState([]);
  const [stocks, setStocks]             = useState([]);

  useEffect(() => {
    warehouseApi.getAll().then(res => {
      const list = res.data || [];
      setAllWarehouses(list);

      // Lấy warehouseId từ login response (AuthResponse đã trả về warehouseId)
      const assignedId = user?.warehouseId;
      if (assignedId) {
        const found = list.find(w => w.id === Number(assignedId));
        if (found) setMyWarehouse(found);
      } else {
        // Fallback: ADMIN/OWNER không gắn kho → dùng kho đầu tiên loại SALE
        const firstSale = list.find(w => w.type === 'SALE') || list[0];
        if (firstSale) setMyWarehouse(firstSale);
      }
    });
  }, [user?.warehouseId]);

  useEffect(() => {
    if (!myWarehouse?.id) return;
    warehouseApi.getStock(myWarehouse.id).then(res => setStocks(res.data || []));
  }, [myWarehouse?.id]);

  return { myWarehouse, allWarehouses, stocks };
}

function emptyRow(mode) {
  if (mode === 'import') return { ingredientId: '', quantity: '', expiryDate: '', costPrice: '' };
  if (mode === 'adjust') return { ingredientId: '', physicalQty: '' };
  return { ingredientId: '', quantity: '' };
}

function FormShell({ title, warehouseName, onSubmit, loading, error, success, children }) {
  return (
    <div className="wh-card">
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
      {error   && <div className="wh-alert wh-alert-error">⚠️ {error}</div>}
      {success && <div className="wh-alert wh-alert-success">✅ {success}</div>}
      {children}
      <hr className="wh-sep" />
      <button className="wh-btn wh-btn-primary" onClick={onSubmit} disabled={loading}>
        {loading ? 'Đang xử lý...' : 'Xác nhận'}
      </button>
    </div>
  );
}

// ── NHẬP KHO ─────────────────────────────────────────────────────────────────
function ImportForm() {
  const { myWarehouse, stocks } = useMyWarehouse();
  const [refCode, setRefCode] = useState('');
  const [note, setNote]       = useState('');
  const [images, setImages]   = useState([]);
  const [rows, setRows]       = useState([emptyRow('import')]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');

  const updateRow = (i, v) => setRows(rows.map((r, idx) => idx === i ? v : r));
  const removeRow = (i)    => setRows(rows.filter((_, idx) => idx !== i));

  const handleSubmit = async () => {
    setError(''); setSuccess('');
    if (!myWarehouse?.id) return setError('Không xác định được kho.');
    const validRows = rows.filter(r => r.ingredientId && r.quantity > 0);
    if (!validRows.length) return setError('Vui lòng thêm ít nhất 1 nguyên liệu.');
    setLoading(true);
    try {
      const res = await warehouseApi.import({
        warehouseId: myWarehouse.id, referenceCode: refCode, note, imageUrls: images,
        items: validRows.map(r => ({
          ingredientId: r.ingredientId,
          quantity:     Number(r.quantity),
          expiryDate:   r.expiryDate || null,
          costPrice:    r.costPrice ? Number(r.costPrice) : null,
        })),
      });
      setSuccess(`Nhập kho thành công! Mã phiếu: ${res.data.receiptCode}`);
      setRows([emptyRow('import')]); setRefCode(''); setNote(''); setImages([]);
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || 'Có lỗi xảy ra');
    } finally { setLoading(false); }
  };

  return (
    <FormShell title="📥 Phiếu nhập kho" warehouseName={myWarehouse?.name}
               onSubmit={handleSubmit} loading={loading} error={error} success={success}>
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
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 8, marginBottom: 6, paddingLeft: 12, fontSize: 12, color: 'var(--wh-muted)' }}>
        <span>Nguyên liệu</span><span>Số lượng</span><span>Giá vốn (đ)</span><span>Hạn sử dụng</span><span></span>
      </div>
      <div className="wh-ing-rows">
        {rows.map((row, i) => (
          <IngredientSelector key={i} stocks={stocks} value={row}
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
  const [note, setNote]     = useState('');
  const [images, setImages] = useState([]);
  const [rows, setRows]     = useState([emptyRow('export')]);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');
  const [success, setSuccess] = useState('');

  const updateRow = (i, v) => setRows(rows.map((r, idx) => idx === i ? v : r));
  const removeRow = (i)    => setRows(rows.filter((_, idx) => idx !== i));

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
  const [toWh, setToWh]     = useState('');
  const [note, setNote]     = useState('');
  const [images, setImages] = useState([]);
  const [rows, setRows]     = useState([emptyRow('transfer')]);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');
  const [success, setSuccess] = useState('');

  // Kho đích: loại bỏ kho hiện tại của user
  const destWarehouses = allWarehouses.filter(w => w.id !== myWarehouse?.id);

  const updateRow = (i, v) => setRows(rows.map((r, idx) => idx === i ? v : r));
  const removeRow = (i)    => setRows(rows.filter((_, idx) => idx !== i));

  const handleSubmit = async () => {
    setError(''); setSuccess('');
    if (!myWarehouse?.id) return setError('Không xác định được kho nguồn.');
    if (!toWh) return setError('Vui lòng chọn kho đích.');
    const validRows = rows.filter(r => r.ingredientId && r.quantity > 0);
    if (!validRows.length) return setError('Vui lòng thêm ít nhất 1 nguyên liệu.');
    setLoading(true);
    try {
      const res = await warehouseApi.transfer({
        fromWarehouseId: myWarehouse.id, toWarehouseId: toWh, note, imageUrls: images,
        items: validRows.map(r => ({ ingredientId: r.ingredientId, quantity: Number(r.quantity) })),
      });
      setSuccess(
        `Chuyển kho thành công! Phiếu xuất: ${res.data.outReceipt.receiptCode} — Phiếu nhập: ${res.data.inReceipt.receiptCode}`
      );
      setRows([emptyRow('transfer')]); setToWh(''); setNote(''); setImages([]);
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || 'Có lỗi xảy ra');
    } finally { setLoading(false); }
  };

  const toWhName = destWarehouses.find(w => w.id === toWh)?.name || '';

  return (
    <FormShell title="🔄 Phiếu chuyển kho" warehouseName={myWarehouse?.name}
               onSubmit={handleSubmit} loading={loading} error={error} success={success}>

      {/* Kho nguồn: hiển thị label, không cho chọn */}
      <div className="wh-form-row cols-2">
        <div>
          <label className="wh-label">Kho nguồn</label>
          <div className="wh-input" style={{ background: 'var(--wh-surface2)', color: 'var(--wh-muted)', cursor: 'default' }}>
            {myWarehouse?.name || '—'}
          </div>
        </div>

        {/* Kho đích: chọn từ danh sách, loại bỏ kho hiện tại */}
        <div>
          <label className="wh-label">Kho đích <span style={{ color: 'var(--wh-danger)' }}>*</span></label>
          <select className="wh-select" value={toWh} onChange={e => setToWh(Number(e.target.value))}>
            <option value="">-- Chọn kho đích --</option>
            {destWarehouses.map(w => (
              <option key={w.id} value={w.id}>
                {w.name} ({w.type === 'TRANSIT' ? 'Trung chuyển' : 'Bán hàng'})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Preview chiều chuyển */}
      {toWh && myWarehouse && (
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
      <div className="wh-ing-rows">
        {rows.map((row, i) => (
          <IngredientSelector key={i} stocks={stocks} value={row}
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
  const [note, setNote]     = useState('');
  const [images, setImages] = useState([]);
  const [rows, setRows]     = useState([emptyRow('adjust')]);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');
  const [success, setSuccess] = useState('');

  const updateRow = (i, v) => setRows(rows.map((r, idx) => idx === i ? v : r));
  const removeRow = (i)    => setRows(rows.filter((_, idx) => idx !== i));

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