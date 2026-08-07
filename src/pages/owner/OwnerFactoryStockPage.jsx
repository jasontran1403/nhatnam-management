// src/pages/owner/OwnerFactoryStockPage.jsx
// OWNER xem tồn kho của MỘT kho xưởng: nguyên liệu | bán thành phẩm | thành phẩm.
// factoryId + kind lấy từ URL query (?factoryId=..&kind=material|semi|finished).
// Layout card list giống các trang tồn kho khác.
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Package, Search, ChevronLeft, Factory } from 'lucide-react';
import { CardSkeleton } from '../../components/ui/Skeleton.jsx';
import { useFmt } from '../../utils/useFmt';
import { factoryMaterialRequestApi } from '../../api/materialRequestApi.js';
import { finishedGoodsApi, semiFinishedGoodsApi, ownerProdApi } from '../../api/productionModuleApi';

const KIND_LABEL = {
  material: 'Kho nguyên liệu xưởng',
  semi: 'Kho bán thành phẩm',
  finished: 'Kho thành phẩm (kho xưởng)',
};

export default function OwnerFactoryStockPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { fmtNum, fmtDate } = useFmt();

  const factoryId = params.get('factoryId') ? Number(params.get('factoryId')) : null;
  const kind = params.get('kind') || 'material';

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [factoryName, setFactoryName] = useState('');

  useEffect(() => {
    ownerProdApi.listFactories()
      .then(list => {
        const f = (list || []).find(x => x.id === factoryId);
        if (f) setFactoryName(f.name);
      }).catch(() => {});
  }, [factoryId]);

  const load = useCallback(() => {
    if (!factoryId) { setRows([]); setLoading(false); return; }
    setLoading(true);
    const done = (data) => { setRows(normalize(kind, data || [])); setLoading(false); };
    const fail = () => { setRows([]); setLoading(false); };

    if (kind === 'material') {
      factoryMaterialRequestApi.getStock(factoryId).then(done).catch(fail);
    } else if (kind === 'semi') {
      semiFinishedGoodsApi.listSummary(undefined, factoryId).then(done).catch(fail);
    } else {
      finishedGoodsApi.listSummary(undefined, undefined, factoryId).then(done).catch(fail);
    }
  }, [factoryId, kind]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? rows.filter(r => r.name.toLowerCase().includes(q)) : rows;
  }, [rows, search]);

  const totalTypes = rows.length;

  return (
    <div className="p-4 space-y-4 bg-surface-2 min-h-full">
      <button onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink transition-colors">
        <ChevronLeft size={16} /> Quay lại danh sách kho
      </button>

      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-gold/15 text-gold flex items-center justify-center flex-shrink-0">
          <Factory size={20} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-ink">{factoryName || 'Kho xưởng'}</h1>
          <p className="text-sm text-muted">{KIND_LABEL[kind]} · {totalTypes} loại</p>
        </div>
      </div>

      <div className="bg-surface rounded-2xl border border-hairline shadow-sm p-4">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-line focus:outline-none focus:border-gold bg-canvas placeholder-muted"
            placeholder="Tìm tên..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <CardSkeleton key={i} />)}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-hairline shadow-sm p-10 text-center">
          <Package size={32} className="mx-auto text-muted mb-2" />
          <p className="text-muted text-sm">Kho trống</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r, i) => (
            <div key={i} className="bg-surface rounded-2xl border border-hairline shadow-sm p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-ink">{r.name}</p>
                <p className="text-2xl font-bold text-forest mt-0.5">
                  {fmtNum(r.qty, 3)} <span className="text-xs font-medium text-muted">{r.unit}</span>
                </p>
                {r.nearestExpiry && (
                  <p className="text-[11px] text-muted mt-1">HSD gần nhất: {fmtDate(r.nearestExpiry)}</p>
                )}
              </div>
              <span className="text-xs text-muted">{r.lotCount} lô</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Chuẩn hoá dữ liệu 3 nguồn về {name, unit, qty, lotCount, nearestExpiry}
function normalize(kind, data) {
  if (kind === 'material') {
    return data.map(s => ({
      name: s.materialName, unit: s.unit, qty: s.totalQty,
      lotCount: (s.lots || []).length,
      nearestExpiry: nearest((s.lots || []).map(l => l.expiryDate)),
    }));
  }
  // semi + finished cùng shape summary
  return data.map(s => ({
    name: s.productName, unit: s.unit, qty: s.totalQuantity,
    lotCount: s.lotCount ?? (s.lots || []).length,
    nearestExpiry: nearest((s.lots || []).map(l => l.expiryDate)),
  }));
}

function nearest(dates) {
  const valid = (dates || []).filter(Boolean);
  return valid.length ? Math.min(...valid) : null;
}
