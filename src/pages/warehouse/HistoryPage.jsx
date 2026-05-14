// src/pages/warehouse/HistoryPage.jsx
import { useState, useEffect, useCallback } from 'react';
import { warehouseApi, getImageUrl } from '../../api/warehouseApi';

const TABS = [
  { key: 'IMPORT', label: '📥 Nhập kho' },
  { key: 'EXPORT', label: '📤 Xuất kho' },
  { key: 'ADJUST', label: '🔧 Điều chỉnh' },
  { key: 'TRANSFER', label: '🔄 Chuyển kho' },
];

const TYPE_BADGE = {
  IMPORT: { cls: 'badge-import', label: 'Nhập' },
  EXPORT_ORDER: { cls: 'badge-export', label: 'Xuất đơn' },
  EXPORT_OTHER: { cls: 'badge-export', label: 'Xuất khác' },
  ADJUST: { cls: 'badge-adjust', label: 'Điều chỉnh' },
  TRANSFER_IN: { cls: 'badge-transfer', label: 'Chuyển vào' },
  TRANSFER_OUT: { cls: 'badge-transfer', label: 'Chuyển ra' },
};

export default function HistoryPage() {
  const [tab, setTab] = useState('IMPORT');
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [receipts, setReceipts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    warehouseApi.getAll().then(res => setWarehouses(res.data));
  }, []);

  const load = useCallback((p = 0) => {
    setLoading(true);
    warehouseApi.getHistory(tab, warehouseId || undefined, p, 15)
      .then(res => {
        setReceipts(res.data.content || []);
        setTotal(res.data.totalElements || 0);
        setPage(p);
      })
      .finally(() => setLoading(false));
  }, [tab, warehouseId]);

  useEffect(() => { load(0); setExpanded(null); }, [tab, warehouseId]);

  const totalPages = Math.ceil(total / 15);

  return (
    <div>
      <h1 className="wh-page-title">Lịch sử kho</h1>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div className="wh-tabs" style={{ marginBottom: 0 }}>
          {TABS.map(t => (
            <button key={t.key} className={`wh-tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>
        <select className="wh-select" style={{ width: 180 }} value={warehouseId} onChange={e => setWarehouseId(e.target.value)}>
          <option value="">Tất cả kho</option>
          {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        <span style={{ color: 'var(--wh-muted)', fontSize: 13 }}>{total} phiếu</span>
      </div>

      {loading ? <SkeletonTable /> : receipts.length === 0 ? (
        <div className="wh-empty"><div className="wh-empty-icon">📭</div><div>Không có phiếu nào</div></div>
      ) : (
        <>
          <div className="wh-table-wrap">
            <table className="wh-table">
              <thead>
                <tr>
                  <th style={{ width: 32 }}></th>
                  <th>Mã phiếu</th>
                  <th>Loại</th>
                  <th>Kho</th>
                  {tab === 'TRANSFER' && <th>Kho đối ứng</th>}
                  <th>Tham chiếu / Lý do</th>
                  <th>Người thao tác</th>
                  <th>Thời gian</th>
                </tr>
              </thead>
              <tbody>
                {receipts.map(r => (
                  <>
                    <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                      <td style={{ textAlign: 'center', color: 'var(--wh-muted)' }}>{expanded === r.id ? '▾' : '▸'}</td>
                      <td><span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 13 }}>{r.receiptCode}</span></td>
                      <td><span className={`wh-badge ${TYPE_BADGE[r.receiptType]?.cls || ''}`}>{TYPE_BADGE[r.receiptType]?.label || r.receiptType}</span></td>
                      <td style={{ fontWeight: 500 }}>{r.warehouseName}</td>
                      {tab === 'TRANSFER' && <td style={{ color: 'var(--wh-muted)' }}>{r.partnerWarehouseName || '—'}</td>}
                      <td style={{ color: 'var(--wh-muted)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.referenceCode || r.reason || '—'}</td>
                      <td>{r.createdByName}</td>
                      <td style={{ color: 'var(--wh-muted)', fontSize: 12, whiteSpace: 'nowrap' }}>{r.createdAt ? new Date(r.createdAt).toLocaleString('vi-VN') : '—'}</td>
                    </tr>
                    {expanded === r.id && (
                      <tr key={`${r.id}-detail`}>
                        <td colSpan={10} style={{ padding: 0, background: 'var(--wh-surface2)' }}>
                          <ReceiptDetail receipt={r} tab={tab} onLightbox={setLightbox} />
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 16 }}>
              <button className="wh-btn wh-btn-secondary wh-btn-sm" disabled={page === 0} onClick={() => load(page - 1)}>‹ Trước</button>
              <span style={{ padding: '5px 12px', color: 'var(--wh-muted)', fontSize: 13 }}>{page + 1} / {totalPages}</span>
              <button className="wh-btn wh-btn-secondary wh-btn-sm" disabled={page >= totalPages - 1} onClick={() => load(page + 1)}>Sau ›</button>
            </div>
          )}
        </>
      )}

      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, cursor: 'zoom-out' }}>
          <img src={getImageUrl(lightbox)} alt="" style={{ maxWidth: '85vw', maxHeight: '85vh', borderRadius: 12 }} />
        </div>
      )}
    </div>
  );
}

function ReceiptDetail({ receipt, tab, onLightbox }) {
  const isAdjust = tab === 'ADJUST';
  return (
    <div style={{ padding: '14px 20px' }}>
      {receipt.note && <div style={{ marginBottom: 10, color: 'var(--wh-muted)', fontSize: 13 }}>📝 {receipt.note}</div>}
      {receipt.imageUrls?.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--wh-muted)', marginBottom: 6 }}>Ảnh đính kèm:</div>
          <div className="wh-img-grid">
            {receipt.imageUrls.map((url, i) => <img key={i} src={getImageUrl(url)} alt="" className="wh-img-thumb" onClick={() => onLightbox(url)} />)}
          </div>
        </div>
      )}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '6px 10px', color: 'var(--wh-muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Nguyên liệu</th>
            <th style={{ textAlign: 'right', padding: '6px 10px', color: 'var(--wh-muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Trước</th>
            {isAdjust && <th style={{ textAlign: 'right', padding: '6px 10px', color: 'var(--wh-muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Thực tế</th>}
            <th style={{ textAlign: 'right', padding: '6px 10px', color: 'var(--wh-muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Sau</th>
            <th style={{ textAlign: 'right', padding: '6px 10px', color: 'var(--wh-muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Số lượng</th>
            {isAdjust && <th style={{ padding: '6px 10px', color: 'var(--wh-muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Kết quả</th>}
            {tab === 'IMPORT' && <th style={{ padding: '6px 10px', color: 'var(--wh-muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Hạn SD</th>}
          </tr>
        </thead>
        <tbody>
          {receipt.items?.map((item, i) => (
            <tr key={i} style={{ borderTop: '1px solid var(--wh-border)' }}>
              <td style={{ padding: '8px 10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {item.imageUrl && (
                    <img
                      src={getImageUrl(item.imageUrl)}
                      style={{ width: 64, height: 64, borderRadius: 4, objectFit: 'cover' }}
                      alt=""
                    />
                  )}
                  <span>{item.ingredientName}</span>
                  <span style={{ color: 'var(--wh-muted)', fontSize: 11 }}>({item.unit})</span>
                </div>
              </td>
              <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--wh-muted)' }}>{Number(item.quantityBefore).toLocaleString('vi-VN')}</td>
              {isAdjust && <td style={{ padding: '8px 10px', textAlign: 'right' }}>{item.physicalQty != null ? Number(item.physicalQty).toLocaleString('vi-VN') : '—'}</td>}
              <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>{Number(item.quantityAfter).toLocaleString('vi-VN')}</td>
              <td style={{ padding: '8px 10px', textAlign: 'right' }}><DiffText diff={item.difference} /></td>
              {isAdjust && <td style={{ padding: '8px 10px' }}><AdjustBadge result={item.adjustResult} /></td>}
              {tab === 'IMPORT' && <td style={{ padding: '8px 10px', fontSize: 12, color: 'var(--wh-warn)' }}>{item.expiryDate || '—'}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DiffText({ diff }) {
  const n = Number(diff);
  if (n > 0) return <span style={{ color: 'var(--wh-accent2)', fontWeight: 600 }}>+{n.toLocaleString('vi-VN')}</span>;
  if (n < 0) return <span style={{ color: 'var(--wh-danger)', fontWeight: 600 }}>{n.toLocaleString('vi-VN')}</span>;
  return <span style={{ color: 'var(--wh-muted)' }}>0</span>;
}

function AdjustBadge({ result }) {
  const map = { SURPLUS: { cls: 'badge-surplus', label: 'Thừa' }, SHORTAGE: { cls: 'badge-shortage', label: 'Thiếu' }, MATCH: { cls: 'badge-match', label: 'Khớp' } };
  const m = map[result];
  return m ? <span className={`wh-badge ${m.cls}`}>{m.label}</span> : null;
}

function SkeletonTable() {
  return (
    <div className="wh-table-wrap">
      <table className="wh-table">
        <thead><tr><th></th><th>Mã phiếu</th><th>Loại</th><th>Kho</th><th>Tham chiếu</th><th>Người TT</th><th>Thời gian</th></tr></thead>
        <tbody>
          {[...Array(5)].map((_, i) => (
            <tr key={i}>{[16, 120, 60, 80, 100, 80, 90].map((w, j) => (
              <td key={j}><div style={{ height: 14, borderRadius: 4, background: 'var(--wh-surface2)', width: w, animation: 'pulse 1.2s ease-in-out infinite alternate' }} /></td>
            ))}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}