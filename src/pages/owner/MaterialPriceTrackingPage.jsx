// src/pages/owner/MaterialPriceTrackingPage.jsx
// Biến động giá nguyên liệu — chart cột, chọn nguyên liệu, thêm giá (modal).
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, BarChart3, Search, Plus, ChevronRight, ChevronLeftIcon,
  Building2, Save, X,
} from 'lucide-react';
import { materialPriceTrackingApi } from '../../api/services';
import { useToast } from '../../components/common/Toast';

function fmtDateTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function fmtDate(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function fmtMoney(v) {
  if (v == null) return '0 đ';
  return new Intl.NumberFormat('vi-VN').format(Math.round(Number(v))) + ' đ';
}

// ── Bar Chart (SVG, pan trái/phải) ────────────────────────────────────────────
function PriceBarChart({ points, materialName, unit }) {
  const containerRef = useRef(null);
  const [offset, setOffset] = useState(0);
  const [tooltip, setTooltip] = useState(null);
  const [containerH, setContainerH] = useState(400);

  const BAR_W = 38;
  const GAP = 6;
  const PAD_TOP = 30;
  const PAD_BOTTOM = 50;
  const PAD_LEFT = 80;

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        const h = e.contentRect.height;
        if (h > 50) setContainerH(h);
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const H = containerH;

  const grouped = useMemo(() => {
    const map = new Map();
    for (const p of points) {
      const dayKey = fmtDate(p.createdAt);
      if (!map.has(dayKey)) map.set(dayKey, []);
      map.get(dayKey).push(p);
    }
    return Array.from(map, ([day, pts]) => ({ day, pts }));
  }, [points]);

  const bars = useMemo(() => {
    const result = [];
    let globalIdx = 0;
    for (const g of grouped) {
      const startIdx = globalIdx;
      for (let j = 0; j < g.pts.length; j++) {
        result.push({
          ...g.pts[j],
          dayLabel: g.day,
          isFirstInDay: j === 0,
          dayBarCount: g.pts.length,
          dayStartIdx: startIdx,
        });
        globalIdx++;
      }
    }
    return result;
  }, [grouped]);

  const totalW = PAD_LEFT + bars.length * (BAR_W + GAP) + 20;
  const maxPrice = Math.max(...bars.map(b => Number(b.unitPrice) || 0), 1) * 1.5;

  useEffect(() => {
    if (containerRef.current && totalW > containerRef.current.clientWidth) {
      setOffset(totalW - containerRef.current.clientWidth);
    } else {
      setOffset(0);
    }
  }, [totalW, bars.length]);

  const panLeft = () => setOffset(o => Math.max(0, o - 220));
  const panRight = () => {
    if (!containerRef.current) return;
    const maxOff = Math.max(0, totalW - containerRef.current.clientWidth);
    setOffset(o => Math.min(maxOff, o + 220));
  };

  const chartH = H - PAD_TOP - PAD_BOTTOM;

  if (bars.length === 0) {
    return (
      <div className="bg-canvas rounded-xl p-8 text-center text-muted text-sm h-full flex items-center justify-center">
        Chưa có dữ liệu giá cho nguyên liệu này.
      </div>
    );
  }

  const yTicks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="bg-canvas rounded-xl p-4 flex flex-col h-full">
      <div className="flex items-center justify-between mb-2 shrink-0">
        <h3 className="text-sm font-semibold text-ink flex items-center gap-1.5">
          <BarChart3 size={15} className="text-gold" /> Biểu đồ giá — {materialName}
        </h3>
        <div className="flex items-center gap-1">
          <button onClick={panLeft} className="p-1.5 rounded-lg hover:bg-surface-2 text-muted">
            <ChevronLeftIcon size={16} />
          </button>
          <button onClick={panRight} className="p-1.5 rounded-lg hover:bg-surface-2 text-muted">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      <div ref={containerRef} className="overflow-hidden relative flex-1 min-h-0">
        <svg
          width={Math.max(totalW, containerRef.current?.clientWidth || 700)}
          height={H}
          style={{ transform: `translateX(-${offset}px)`, transition: 'transform 0.3s ease' }}
        >
          {yTicks.map(f => {
            const y = PAD_TOP + chartH * (1 - f);
            return (
              <g key={f}>
                <line
                  x1={PAD_LEFT} y1={y}
                  x2={Math.max(totalW, containerRef.current?.clientWidth || 700)} y2={y}
                  stroke="var(--c-line-soft)" strokeWidth={0.5}
                />
                <text
                  x={offset + PAD_LEFT - 8} y={y + 3}
                  fontSize={10} fill="var(--c-muted)" textAnchor="end" fontFamily="monospace"
                >
                  {fmtMoney(maxPrice * f).replace(' đ', '')}
                </text>
              </g>
            );
          })}

          <line
            x1={PAD_LEFT} y1={PAD_TOP}
            x2={PAD_LEFT} y2={PAD_TOP + chartH}
            stroke="var(--c-line-soft)" strokeWidth={1}
          />

          {bars.map((b, i) => {
            const x = PAD_LEFT + 10 + i * (BAR_W + GAP);
            const price = Number(b.unitPrice) || 0;
            const barH = Math.max(1, (price / maxPrice) * chartH);
            const y = PAD_TOP + chartH - barH;
            return (
              <g key={i}
                onMouseEnter={() => setTooltip({ x: x + BAR_W / 2, y, point: b })}
                onMouseLeave={() => setTooltip(null)}
                style={{ cursor: 'pointer' }}
              >
                <rect x={x} y={y} width={BAR_W} height={barH}
                  rx={4} fill="var(--c-gold)" opacity={0.85} />
                <text x={x + BAR_W / 2} y={y - 4}
                  fontSize={8} fill="var(--c-muted)" textAnchor="middle" fontFamily="monospace">
                  {Number(price).toLocaleString('vi-VN')}
                </text>
              </g>
            );
          })}

          {grouped.map((g) => {
            const startI = bars.findIndex(b => b.isFirstInDay && b.dayLabel === g.day);
            if (startI < 0) return null;
            const count = g.pts.length;
            const xStart = PAD_LEFT + 10 + startI * (BAR_W + GAP);
            const xEnd = PAD_LEFT + 10 + (startI + count - 1) * (BAR_W + GAP) + BAR_W;
            const xMid = (xStart + xEnd) / 2;
            return (
              <g key={g.day}>
                {count > 1 && (
                  <line x1={xStart - GAP / 2} y1={H - PAD_BOTTOM + 2}
                    x2={xEnd + GAP / 2} y2={H - PAD_BOTTOM + 2}
                    stroke="var(--c-gold)" strokeWidth={1.5} opacity={0.3} />
                )}
                <text x={xMid} y={H - PAD_BOTTOM + 18}
                  fontSize={10} fill="var(--c-ink)" textAnchor="middle" fontWeight="600">
                  {g.day}
                </text>
                {count > 1 && (
                  <text x={xMid} y={H - PAD_BOTTOM + 30}
                    fontSize={8} fill="var(--c-muted)" textAnchor="middle">
                    ({count} lần)
                  </text>
                )}
              </g>
            );
          })}

          {tooltip && (() => {
            const p = tooltip.point;
            const tw = 210, th = 96;
            let tx = tooltip.x - tw / 2;
            let ty = tooltip.y - th - 12;
            if (ty < 0) ty = tooltip.y + 24;
            if (tx < PAD_LEFT) tx = PAD_LEFT + 4;
            const svgW = Math.max(totalW, containerRef.current?.clientWidth || 700);
            if (tx + tw > svgW - 4) tx = svgW - tw - 4;
            return (
              <g>
                <rect x={tx} y={ty} width={tw} height={th} rx={8}
                  fill="var(--c-chrome)" opacity={0.96} />
                <text x={tx + 10} y={ty + 16} fontSize={11} fill="var(--c-gold)" fontWeight="bold">
                  {p.materialName}
                </text>
                <text x={tx + 10} y={ty + 32} fontSize={10} fill="white" opacity={0.8}>
                  Thời gian: {fmtDateTime(p.createdAt)}
                </text>
                <text x={tx + 10} y={ty + 47} fontSize={10} fill="white" opacity={0.8}>
                  Đơn giá: {fmtMoney(p.unitPrice)} / {unit}
                </text>
                <text x={tx + 10} y={ty + 62} fontSize={10} fill="white" opacity={0.8}>
                  SL: {p.quantity != null ? Number(p.quantity).toLocaleString('vi-VN') + ' ' + unit : '—'}
                </text>
                <text x={tx + 10} y={ty + 77} fontSize={10} fill="white" opacity={0.8}>
                  NCC: {p.supplierName || '—'}
                </text>
              </g>
            );
          })()}
        </svg>
      </div>
    </div>
  );
}

// ── Add Price Modal ───────────────────────────────────────────────────────────
function AddPriceModal({ selectedMaterial, onClose, onAdded }) {
  const toast = useToast();
  const [mode, setMode] = useState('calc');
  const [quantity, setQuantity] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [unitInput, setUnitInput] = useState(selectedMaterial?.unit || '');
  const [supplierName, setSupplierName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedMaterial) setUnitInput(selectedMaterial.unit || '');
  }, [selectedMaterial?.name]);

  const calculatedPrice = mode === 'calc' && Number(quantity) > 0 && Number(totalAmount.replace(/\D/g, '')) > 0
    ? (Number(totalAmount.replace(/\D/g, '')) / Number(quantity)).toFixed(2)
    : null;

  const handleSubmit = async () => {
    if (!selectedMaterial) { toast('Chọn nguyên liệu trước', 'error'); return; }
    const unit = unitInput.trim() || selectedMaterial.unit || '';
    if (!unit) { toast('Nhập đơn vị tính', 'error'); return; }

    const payload = {
      materialName: selectedMaterial.name, unit,
      supplierName: supplierName.trim() || null,
      entryType: selectedMaterial.type || 'MATERIAL',
    };
    if (mode === 'calc') {
      const q = Number(quantity), t = Number(totalAmount.replace(/\D/g, ''));
      if (q <= 0 || t <= 0) { toast('Nhập số lượng và tổng tiền hợp lệ', 'error'); return; }
      payload.quantity = q; payload.totalAmount = t;
    } else {
      const p = Number(unitPrice.replace(/\D/g, ''));
      if (p <= 0) { toast('Nhập đơn giá hợp lệ', 'error'); return; }
      payload.unitPrice = p;
    }

    setLoading(true);
    try {
      await materialPriceTrackingApi.addEntry(payload);
      toast('Đã thêm giá thành công!', 'success');
      onAdded?.();
      onClose();
    } catch (err) {
      toast(err?.response?.data?.message || 'Lỗi khi thêm giá', 'error');
    } finally { setLoading(false); }
  };

  const fmtInput = (v) => {
    const digits = v.replace(/\D/g, '');
    return digits ? new Intl.NumberFormat('vi-VN').format(Number(digits)) : '';
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-line-soft">
          <div>
            <h3 className="text-sm font-bold text-ink flex items-center gap-1.5">
              <Plus size={15} className="text-gold" /> Thêm giá
            </h3>
            {selectedMaterial && (
              <p className="text-xs text-gold mt-0.5">{selectedMaterial.name}</p>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-2 text-muted">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {!selectedMaterial && (
            <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/28 rounded-xl p-3 text-xs text-amber-700 dark:text-amber-300">
              Vui lòng chọn nguyên liệu ở danh sách bên trái trước khi thêm giá.
            </div>
          )}

          {/* Mode toggle */}
          <div className="flex gap-2">
            <button onClick={() => setMode('calc')}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold transition ${mode === 'calc' ? 'bg-gold text-white' : 'bg-canvas border border-line text-muted'}`}>
              Nhập SL + Tổng tiền
            </button>
            <button onClick={() => setMode('direct')}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold transition ${mode === 'direct' ? 'bg-gold text-white' : 'bg-canvas border border-line text-muted'}`}>
              Nhập đơn giá trực tiếp
            </button>
          </div>

          {mode === 'calc' ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted mb-1 block">Số lượng</label>
                <input type="text" inputMode="decimal" value={quantity}
                  onChange={e => setQuantity(e.target.value.replace(/[^0-9.]/g, ''))}
                  placeholder="VD: 10"
                  className="w-full px-3 py-2 rounded-xl border border-line text-sm bg-canvas focus:outline-none focus:ring-2 focus:ring-gold/40" />
              </div>
              <div>
                <label className="text-xs text-muted mb-1 block">Tổng tiền (đ)</label>
                <input type="text" inputMode="numeric" value={totalAmount}
                  onChange={e => setTotalAmount(fmtInput(e.target.value))}
                  placeholder="VD: 500.000"
                  className="w-full px-3 py-2 rounded-xl border border-line text-sm bg-canvas focus:outline-none focus:ring-2 focus:ring-gold/40" />
              </div>
              {calculatedPrice && (
                <div className="col-span-2 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/28 rounded-xl p-2.5 text-xs text-emerald-700 dark:text-emerald-300">
                  → Đơn giá tính được: <span className="font-bold">{fmtMoney(calculatedPrice)}</span> / {unitInput || selectedMaterial?.unit || '?'}
                </div>
              )}
            </div>
          ) : (
            <div>
              <label className="text-xs text-muted mb-1 block">Đơn giá (đ / {unitInput || selectedMaterial?.unit || 'đơn vị'})</label>
              <input type="text" inputMode="numeric" value={unitPrice}
                onChange={e => setUnitPrice(fmtInput(e.target.value))}
                placeholder="VD: 50.000"
                className="w-full px-3 py-2 rounded-xl border border-line text-sm bg-canvas focus:outline-none focus:ring-2 focus:ring-gold/40" />
            </div>
          )}

          <div>
            <label className="text-xs text-muted mb-1 block">Đơn vị tính</label>
            <input type="text" value={unitInput}
              onChange={e => setUnitInput(e.target.value)}
              placeholder="VD: kg, g, lít..."
              className="w-full px-3 py-2 rounded-xl border border-line text-sm bg-canvas focus:outline-none focus:ring-2 focus:ring-gold/40" />
          </div>

          <div>
            <label className="text-xs text-muted mb-1 block flex items-center gap-1">
              <Building2 size={12} /> Nhà cung cấp / Đơn vị cung cấp
            </label>
            <input type="text" value={supplierName}
              onChange={e => setSupplierName(e.target.value)}
              placeholder="VD: Công ty ABC, Chợ đầu mối..."
              className="w-full px-3 py-2 rounded-xl border border-line text-sm bg-canvas focus:outline-none focus:ring-2 focus:ring-gold/40" />
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-line-soft flex gap-2">
          <button onClick={onClose} disabled={loading}
            className="flex-1 py-2.5 rounded-xl border border-line-soft text-sm text-muted hover:bg-canvas disabled:opacity-50">
            Huỷ
          </button>
          <button onClick={handleSubmit} disabled={loading || !selectedMaterial}
            className="flex-1 py-2.5 rounded-xl bg-gold text-white text-sm font-semibold hover:bg-gold-strong disabled:opacity-50 flex items-center justify-center gap-1.5">
            {loading
              ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : <Save size={14} />}
            {loading ? 'Đang lưu...' : 'Lưu giá'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page (90dvh, no scroll) ──────────────────────────────────────────────
export default function MaterialPriceTrackingPage() {
  const navigate = useNavigate();
  const toast = useToast();

  const [materials, setMaterials] = useState([]);
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [chartData, setChartData] = useState(null);
  const [search, setSearch] = useState('');
  const [loadingMaterials, setLoadingMaterials] = useState(true);
  const [loadingChart, setLoadingChart] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoadingMaterials(true);
    materialPriceTrackingApi.listMaterials()
      .then(data => {
        if (alive) {
          setMaterials(data || []);
          if (data?.length > 0 && !selectedMaterial) setSelectedMaterial(data[0]);
        }
      })
      .catch(() => toast('Không thể tải danh sách nguyên liệu', 'error'))
      .finally(() => { if (alive) setLoadingMaterials(false); });
    return () => { alive = false; };
  }, []);

  const loadChart = useCallback(() => {
    if (!selectedMaterial) return;
    setLoadingChart(true);
    materialPriceTrackingApi.getChart(selectedMaterial.name)
      .then(data => setChartData(data))
      .catch(() => toast('Không thể tải dữ liệu giá', 'error'))
      .finally(() => setLoadingChart(false));
  }, [selectedMaterial?.name]);

  useEffect(() => { loadChart(); }, [loadChart]);

  const filtered = search.trim()
    ? materials.filter(m => m.name.toLowerCase().includes(search.trim().toLowerCase()))
    : materials;

  const basePath = window.location.pathname.split('/').slice(0, 2).join('/');

  return (
    <div className="flex flex-col" style={{ height: '90dvh', overflow: 'hidden' }}>
      {/* Top bar */}
      <div className="shrink-0 px-4 pt-3 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(`${basePath}/dashboard`)}
            className="flex items-center gap-1 text-sm text-muted hover:text-ink font-medium">
            <ChevronLeft size={16} /> Quay lại
          </button>
          <div className="flex items-center gap-2">
            <BarChart3 size={18} className="text-gold" />
            <h1 className="text-base font-bold text-ink">Biến động giá nguyên liệu</h1>
          </div>
        </div>
        <button onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gold text-white text-sm font-semibold hover:bg-gold-strong transition shadow-sm">
          <Plus size={15} /> Thêm giá
        </button>
      </div>

      {/* Content — full remaining height */}
      <div className="flex-1 min-h-0 flex gap-3 px-4 pb-3">
        {/* Left: Material selector — narrow, full height */}
        <div className="w-80 shrink-0 flex flex-col bg-surface rounded-xl border border-line-soft overflow-hidden">
          <div className="p-2 shrink-0">
            <p className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-1.5">Nguyên liệu</p>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Tìm..."
                className="w-full pl-8 pr-2 py-1.5 rounded-lg border border-line text-xs bg-canvas focus:outline-none focus:ring-2 focus:ring-gold/40" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-1.5 pb-1.5 space-y-0.5">
            {loadingMaterials ? (
              <div className="space-y-2 p-2">{[1,2,3].map(i => <div key={i} className="h-8 bg-canvas rounded-lg animate-pulse" />)}</div>
            ) : filtered.length === 0 ? (
              <p className="text-xs text-muted text-center py-4">Không tìm thấy</p>
            ) : (
              filtered.map(m => (
                <button key={`${m.type}-${m.id}`} onClick={() => setSelectedMaterial(m)}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition ${selectedMaterial?.name === m.name && selectedMaterial?.type === m.type
                    ? 'bg-gold/10 text-gold font-semibold border border-gold/30'
                    : 'hover:bg-canvas text-ink'}`}>
                  <span className="truncate leading-tight block">{m.name}</span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right: Chart — fill all remaining space */}
        <div className="flex-1 min-w-0">
          {loadingChart ? (
            <div className="h-full bg-canvas rounded-xl animate-pulse" />
          ) : chartData ? (
            <PriceBarChart
              points={chartData.points || []}
              materialName={chartData.materialName || selectedMaterial?.name || ''}
              unit={chartData.unit || selectedMaterial?.unit || ''}
            />
          ) : (
            <div className="h-full bg-canvas rounded-xl flex items-center justify-center text-muted text-sm">
              Chọn nguyên liệu để xem biểu đồ giá
            </div>
          )}
        </div>
      </div>

      {/* Add Price Modal */}
      {showAddModal && (
        <AddPriceModal
          selectedMaterial={selectedMaterial}
          onClose={() => setShowAddModal(false)}
          onAdded={loadChart}
        />
      )}
    </div>
  );
}