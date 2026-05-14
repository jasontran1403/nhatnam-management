// src/pages/warehouse/ManagementPage.jsx
import { useState, useEffect } from 'react';
import { warehouseApi, getImageUrl } from '../../api/warehouseApi';

export default function ManagementPage() {
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWh, setSelectedWh] = useState(null);
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    warehouseApi.getAll().then(res => {
      const list = res.data;
      setWarehouses(list);
      if (list.length > 0) setSelectedWh(list[0].id);
    });
  }, []);

  useEffect(() => {
    if (!selectedWh) return;
    setLoading(true);
    warehouseApi.getStock(selectedWh)
      .then(res => setStocks(res.data))
      .finally(() => setLoading(false));
  }, [selectedWh]);

  const filtered = stocks.filter(s =>
    s.ingredientName.toLowerCase().includes(search.toLowerCase())
  );

  const currentWh = warehouses.find(w => w.id === selectedWh);
  const lowStockCount = filtered.filter(s => s.stockQuantity < 5).length;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="wh-page-title" style={{ marginBottom: 4 }}>Quản lý kho nguyên liệu</h1>
          {currentWh && (
            <span style={{ color: 'var(--wh-muted)', fontSize: 13 }}>
              {currentWh.type === 'TRANSIT' ? '🔄 Kho trung chuyển' : '🏪 Kho bán hàng'}
              {currentWh.address ? ` — ${currentWh.address}` : ''}
            </span>
          )}
        </div>
        <select
          className="wh-select"
          style={{ width: 200 }}
          value={selectedWh || ''}
          onChange={e => setSelectedWh(Number(e.target.value))}
        >
          {warehouses.map(w => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 24 }}>
        <StatCard icon="📦" label="Nguyên liệu" value={filtered.length} color="var(--wh-accent)" />
        <StatCard icon="⚠️" label="Sắp hết" value={lowStockCount} color="var(--wh-warn)" />
        <StatCard icon="🏭" label="Loại kho" value={currentWh?.type === 'TRANSIT' ? 'Trung chuyển' : 'Bán hàng'} color="var(--wh-accent2)" />
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
                        ? <img src={getImageUrl(s.imageUrl)} alt="" className="wh-ing-img" onClick={() => setLightbox(getImageUrl(s.imageUrl))} style={{ cursor: 'zoom-in' }} />
                        : <div className="wh-ing-img" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🧂</div>
                      }
                      <span style={{ fontWeight: 500 }}>{s.ingredientName}</span>
                    </div>
                  </td>
                  <td style={{ color: 'var(--wh-muted)' }}>{s.unit}</td>
                  <td>
                    <span className="wh-stock-qty" style={s.stockQuantity < 5 ? { background: 'rgba(234,88,12,.1)', color: 'var(--wh-warn)' } : {}}>
                      {s.stockQuantity < 5 && '⚠️ '}
                      {Number(s.stockQuantity).toLocaleString('vi-VN')}
                    </span>
                  </td>
                  <td>
                    {s.expiryList?.length > 0 ? (
                      <div className="wh-expiry-list">
                        {s.expiryList.map(e => (
                          <span key={e.id} className="wh-expiry-pill">
                            {/* {e.expiryDate} ({Number(e.quantity).toLocaleString()}) */}
                            {e.expiryDate}
                          </span>
                        ))}
                      </div>
                    ) : <span style={{ color: 'var(--wh-muted)', fontSize: 12 }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, cursor: 'zoom-out' }}>
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
        <thead><tr><th>Nguyên liệu</th><th>Đơn vị</th><th>Tồn kho</th><th>Hạn sử dụng</th></tr></thead>
        <tbody>
          {[...Array(5)].map((_, i) => (
            <tr key={i}>{[140, 80, 60, 100].map((w, j) => (
              <td key={j}><div style={{ height: 14, borderRadius: 4, background: 'var(--wh-surface2)', width: w, animation: 'pulse 1.2s ease-in-out infinite alternate' }} /></td>
            ))}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}