// src/pages/warehouse/ManagementPage.jsx
import { useState, useEffect, useRef } from 'react';
import { warehouseApi, getImageUrl } from '../../api/warehouseApi';
import { useAuth } from '../../context/AuthContext';

const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return Math.round((d - TODAY) / 86400000);
}

// ── ExpiryCell: hiển thị badge tóm tắt + popup danh sách lô ─────────────────
function ExpiryCell({ expiryList }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Chỉ lấy lô có expiryDate (bỏ lô null)
  const dated = (expiryList || [])
    .filter(e => e.expiryDate && Number(e.quantity) > 0)
    .sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));

  // Đóng khi click ngoài
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (dated.length === 0) {
    return <span style={{ color: 'var(--wh-muted)', fontSize: 12 }}>—</span>;
  }

  // Số lô sắp hết hạn (≤ 30 ngày)
  const soonCount = dated.filter(e => {
    const d = daysUntil(e.expiryDate);
    return d !== null && d <= 30;
  }).length;

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        }}
      >
        {/* Badge số lô sắp hết hạn */}
        {soonCount > 0 && (
          <span style={{
            background: 'rgba(234,88,12,.12)', color: 'var(--wh-warn)',
            border: '1px solid rgba(234,88,12,.25)',
            borderRadius: 99, padding: '2px 8px',
            fontSize: 11, fontWeight: 700,
          }}>
            ⚠️ {soonCount} lô sắp hết hạn
          </span>
        )}
        {/* Badge tổng số lô */}
        <span style={{
          background: 'rgba(201,168,76,.1)', color: 'var(--wh-accent)',
          border: '1px solid rgba(201,168,76,.2)',
          borderRadius: 99, padding: '2px 8px',
          fontSize: 11, fontWeight: 600,
        }}>
          {dated.length} lô ▾
        </span>
      </button>

      {/* Popup danh sách lô */}
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 50, marginTop: 6,
          background: '#fff', border: '1px solid var(--wh-border)',
          borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,.12)',
          minWidth: 260, padding: '8px 0', whiteSpace: 'nowrap',
        }}>
          <div style={{ padding: '6px 14px 8px', borderBottom: '1px solid var(--wh-border)', fontSize: 11, fontWeight: 700, color: 'var(--wh-muted)', textTransform: 'uppercase', letterSpacing: '.5px' }}>
            Danh sách lô hàng
          </div>
          {dated.map((e, i) => {
            const days = daysUntil(e.expiryDate);
            const isExpired = days !== null && days < 0;
            const isSoon    = days !== null && days >= 0 && days <= 30;
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
                    {e.expiryDate}
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

export default function ManagementPage() {
  const { user } = useAuth();
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [lightbox, setLightbox] = useState(null);
  const [warehouseInfo, setWarehouseInfo] = useState(null);

  const warehouseId = user?.warehouseId || user?.warehouse?.id;

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

  const filtered = stocks.filter(s =>
    s.ingredientName.toLowerCase().includes(search.toLowerCase())
  );

  const lowStockCount = filtered.filter(s => s.stockQuantity < 5).length;

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
        <StatCard icon="📦" label="Nguyên liệu" value={filtered.length} color="var(--wh-accent)" />
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

      {/* Table */}
      {loading ? <LoadingRows /> : filtered.length === 0 ? (
        <div className="wh-empty">
          <div className="wh-empty-icon">📭</div>
          <div>Không có nguyên liệu nào trong kho này</div>
        </div>
      ) : (
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
              {filtered.map(s => (
                <tr key={s.ingredientId}>
                  <td>
                    <div className="wh-ing-info">
                      {s.imageUrl
                        ? <img src={getImageUrl(s.imageUrl)} alt="" className="wh-ing-img"
                            onClick={() => setLightbox(getImageUrl(s.imageUrl))}
                            style={{ cursor: 'zoom-in' }} />
                        : <div className="wh-ing-img" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🧂</div>
                      }
                      <span style={{ fontWeight: 500 }}>{s.ingredientName}</span>
                    </div>
                  </td>
                  <td style={{ color: 'var(--wh-muted)' }}>{s.unit}</td>
                  <td>
                    <span className="wh-stock-qty"
                      style={s.stockQuantity < 5 ? { background: 'rgba(234,88,12,.1)', color: 'var(--wh-warn)' } : {}}>
                      {s.stockQuantity < 5 && '⚠️ '}
                      {Number(s.stockQuantity).toLocaleString('vi-VN')}
                    </span>
                  </td>
                  <td>
                    <ExpiryCell expiryList={s.expiryList} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 999, cursor: 'zoom-out',
        }}>
          <img src={lightbox} alt="" style={{ maxWidth: '80vw', maxHeight: '80vh', borderRadius: 12 }} />
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
          {[1,2,3,4].map(i => (
            <tr key={i}>
              {[1,2,3,4].map(j => (
                <td key={j}><div style={{ height: 18, background: '#f0ebe3', borderRadius: 4, animation: 'pulse 1.5s infinite' }} /></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}