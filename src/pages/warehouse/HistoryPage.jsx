// src/pages/warehouse/HistoryPage.jsx
// FIX #4: Chỉ hiển thị lịch sử của kho đang active (hỗ trợ đa kho)
import { useState, useEffect, useCallback } from 'react';
import { TableSkeleton } from '../../components/ui/Skeleton.jsx';
import useMinLoading from '../../hooks/useMinLoading.js';
import { warehouseApi, getImageUrl } from '../../api/warehouseApi';
import { useAuth } from '../../context/AuthContext';
import { useWarehouse } from '../../context/WarehouseContext';

const TABS = [
  { key: 'IMPORT', label: '📥 Nhập kho' },
  { key: 'EXPORT', label: '📤 Xuất kho' },
  { key: 'ADJUST', label: '🔧 Điều chỉnh' },
  { key: 'TRANSFER', label: '🔄 Chuyển kho' },
];

const TYPE_BADGE = {
  IMPORT:       { cls: 'badge-import',    label: 'Nhập' },
  EXPORT_ORDER: { cls: 'badge-export',    label: 'Xuất đơn' },
  EXPORT_OTHER: { cls: 'badge-export',    label: 'Xuất khác' },
  ADJUST:       { cls: 'badge-adjust',    label: 'Điều chỉnh' },
  TRANSFER_IN:  { cls: 'badge-transfer',  label: 'Chuyển vào' },
  TRANSFER_OUT: { cls: 'badge-transfer',  label: 'Chuyển ra' },
};

export default function HistoryPage() {
  const { user } = useAuth();
  const { activeWarehouseId, activeWarehouseName } = useWarehouse();

  // Dùng activeWarehouseId từ context (đa kho), fallback user.warehouseId
  const assignedWarehouseId = activeWarehouseId || user?.warehouseId || user?.warehouse?.id;

  const [tab, setTab] = useState('IMPORT');
  const [warehouseId, setWarehouseId] = useState('');
  const [receipts, setReceipts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useMinLoading();
  const [expanded, setExpanded] = useState(null);
  const [lightbox, setLightbox] = useState(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [ingredientSearch, setIngredientSearch] = useState('');
  const [warehouseName, setWarehouseName] = useState('');

  // Resolve warehouseId khi mount hoặc khi activeWarehouseId thay đổi
  useEffect(() => {
    if (assignedWarehouseId) {
      setWarehouseId(String(assignedWarehouseId));
      // Dùng tên từ context nếu có, ngược lại fetch
      if (activeWarehouseName) {
        setWarehouseName(activeWarehouseName);
      } else {
        warehouseApi.getAll().then(res => {
          const found = res.data.find(w => w.id === Number(assignedWarehouseId));
          if (found) setWarehouseName(found.name);
        });
      }
    } else {
      warehouseApi.getAll().then(res => {
        if (res.data.length > 0) {
          setWarehouseId(String(res.data[0].id));
          setWarehouseName(res.data[0].name);
        }
      });
    }
  }, [assignedWarehouseId, activeWarehouseName]);

  const load = useCallback((p = 0) => {
    if (!warehouseId) return;
    setLoading(true);
    const extra = {};
    if (dateFrom) extra.from = new Date(dateFrom).getTime();
    if (dateTo)   extra.to   = new Date(dateTo).getTime() + 86399999;
    // warehouseId truyền thẳng vào API — backend sẽ validate user có quyền trên kho này
    warehouseApi.getHistory(tab, warehouseId, p, 15, extra)
      .then(res => {
        let items = res.data.content || [];
        if (ingredientSearch.trim()) {
          const q = ingredientSearch.toLowerCase();
          items = items.filter(r =>
            r.items?.some(i => i.ingredientName?.toLowerCase().includes(q))
          );
        }
        setReceipts(items);
        setTotal(res.data.totalElements || 0);
        setPage(p);
      })
      .finally(() => setLoading(false));
  }, [tab, warehouseId, dateFrom, dateTo, ingredientSearch]);

  useEffect(() => {
    if (warehouseId) { load(0); setExpanded(null); }
  }, [tab, warehouseId, dateFrom, dateTo]);

  const totalPages = Math.ceil(total / 15);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <h1 className="wh-page-title">Lịch sử kho</h1>

      {/* FIX #4: Hiển thị tên kho, không cho chọn kho */}
      {warehouseName && (
        <div style={{ marginBottom: 12, padding: '8px 12px', background: 'var(--wh-surface)', borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          🏭 <strong>{warehouseName}</strong>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div className="wh-tabs" style={{ marginBottom: 0 }}>
          {TABS.map(t => (
            <button key={t.key} className={`wh-tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>
        {/* FIX #4: Không hiển thị dropdown chọn kho nữa */}
        <span style={{ color: 'var(--wh-muted)', fontSize: 13 }}>{total} phiếu</span>
      </div>

      {/* Date filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ fontSize: 12, color: 'var(--wh-muted)' }}>Từ</label>
          <input type="date" className="wh-input" style={{ padding: '6px 10px', fontSize: 13 }}
            value={dateFrom} onChange={e => { setDateFrom(e.target.value); load(0); }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ fontSize: 12, color: 'var(--wh-muted)' }}>Đến</label>
          <input type="date" className="wh-input" style={{ padding: '6px 10px', fontSize: 13 }}
            value={dateTo} onChange={e => { setDateTo(e.target.value); load(0); }} />
        </div>
        <input
          className="wh-input"
          placeholder="🔍 Tìm nguyên liệu..."
          style={{ fontSize: 13, padding: '6px 10px' }}
          value={ingredientSearch}
          onChange={e => setIngredientSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && load(0)}
        />
        <button className="wh-btn" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => load(0)}>Lọc</button>
        {(dateFrom || dateTo || ingredientSearch) && (
          <button className="wh-btn" style={{ padding: '6px 14px', fontSize: 13, opacity: 0.6 }}
            onClick={() => { setDateFrom(''); setDateTo(''); setIngredientSearch(''); }}>
            Xóa lọc
          </button>
        )}
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
                  <th>Tham chiếu / Lý do</th>
                  <th>Người thao tác</th>
                  <th>Thời gian</th>
                </tr>
              </thead>
              <tbody>
                {receipts.map(r => (
                  <>
                    <tr key={r.id} onClick={() => setExpanded(expanded === r.id ? null : r.id)} style={{ cursor: 'pointer' }}>
                      <td style={{ textAlign: 'center', color: 'var(--wh-muted)', fontSize: 16 }}>
                        {expanded === r.id ? '▼' : '▶'}
                      </td>
                      <td><span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{r.receiptCode}</span></td>
                      <td>
                        <span className={`wh-badge ${TYPE_BADGE[r.receiptType]?.cls || ''}`}>
                          {TYPE_BADGE[r.receiptType]?.label || r.receiptType}
                        </span>
                      </td>
                      <td style={{ color: 'var(--wh-muted)', fontSize: 13 }}>
                        {r.referenceCode || r.note || '—'}
                      </td>
                      <td style={{ fontSize: 13 }}>{r.createdByName || '—'}</td>
                      <td style={{ fontSize: 13, color: 'var(--wh-muted)' }}>
                        {r.createdAt ? new Date(r.createdAt).toLocaleString('vi-VN') : '—'}
                      </td>
                    </tr>
                    {expanded === r.id && (
                      <tr key={`exp-${r.id}`}>
                        <td colSpan={6} style={{ background: 'var(--wh-bg)', padding: '12px 20px' }}>
                          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                            <thead>
                              <tr>
                                <th style={{ textAlign: 'left', paddingBottom: 6, color: 'var(--wh-muted)' }}>Nguyên liệu</th>
                                <th style={{ textAlign: 'right', paddingBottom: 6, color: 'var(--wh-muted)' }}>SL</th>
                                <th style={{ textAlign: 'right', paddingBottom: 6, color: 'var(--wh-muted)' }}>Trước</th>
                                <th style={{ textAlign: 'right', paddingBottom: 6, color: 'var(--wh-muted)' }}>Sau</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(r.items || []).map((item, idx) => (
                                <tr key={idx}>
                                  <td>{item.ingredientName}</td>
                                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{Number(item.quantity || 0).toLocaleString('vi-VN')} {item.unit}</td>
                                  <td style={{ textAlign: 'right', color: 'var(--wh-muted)' }}>{Number(item.quantityBefore || 0).toLocaleString('vi-VN')}</td>
                                  <td style={{ textAlign: 'right', color: 'var(--wh-accent)' }}>{Number(item.quantityAfter || 0).toLocaleString('vi-VN')}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {r.note && <p style={{ marginTop: 8, fontSize: 12, color: 'var(--wh-muted)', fontStyle: 'italic' }}>📝 {r.note}</p>}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
              <button className="wh-btn" disabled={page === 0} onClick={() => load(page - 1)}>← Trước</button>
              <span style={{ padding: '6px 12px', fontSize: 13, color: 'var(--wh-muted)' }}>
                Trang {page + 1} / {totalPages}
              </span>
              <button className="wh-btn" disabled={page >= totalPages - 1} onClick={() => load(page + 1)}>Tiếp →</button>
            </div>
          )}
        </>
      )}

      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <img src={lightbox} alt="" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 8 }} />
        </div>
      )}
    </div>
  );
}

function SkeletonTable() {
  return (
    <div className="wh-table-wrap">
      <table className="wh-table">
        <tbody>
          {[1,2,3,4,5].map(i => (
            <tr key={i}>
              {[1,2,3,4,5,6].map(j => (
                <td key={j}><div style={{ height: 16, background: '#f0ebe3', borderRadius: 4 }} /></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
