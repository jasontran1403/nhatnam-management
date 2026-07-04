// src/pages/factory_worker/FactoryMaterialStockPage.jsx
import { useState, useEffect } from 'react';
import { Package, AlertTriangle, ChevronDown, ChevronUp, Search } from 'lucide-react';
import useMinLoading from '../../hooks/useMinLoading.js';
import { CardSkeleton } from '../../components/ui/Skeleton.jsx';
import { factoryMaterialRequestApi } from '../../api/materialRequestApi.js';

function fmtQty(v) {
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 }).format(Number(v || 0));
}

function fmtDate(ms) {
  if (!ms) return null;
  return new Date(ms).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function daysLeft(ms) {
  if (!ms) return null;
  return Math.ceil((ms - Date.now()) / 86400000);
}


// ── Stock Card ────────────────────────────────────────────────────────────────
function StockCard({ item }) {
  const [expanded, setExpanded] = useState(false);
  const nearExpiryLots = (item.lots || []).filter(l => l.nearExpiry);
  const hasWarning = nearExpiryLots.length > 0;

  return (
    <div className={`rounded-2xl border shadow-sm overflow-hidden ${hasWarning ? 'bg-amber-50 border-amber-200' : 'bg-white border-black/5'}`}>
      <button className="w-full text-left px-5 py-4" onClick={() => setExpanded(e => !e)}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[#1C1C1E]">{item.materialName}</span>
              {hasWarning && (
                <span className="flex items-center gap-1 text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full font-medium">
                  <AlertTriangle size={10} /> {nearExpiryLots.length} lô sắp hết hạn
                </span>
              )}
            </div>
            <p className="text-2xl font-bold text-[#1A2B1A] mt-1">
              {fmtQty(item.totalQty)}
              <span className="text-xs text-[#8E8878] bg-[#F5F0EB] px-2 py-0.5 rounded-full">{item.unit}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#8E8878]">{item.lots?.length || 0} lô</span>
            {expanded ? <ChevronUp size={16} className="text-[#8E8878]" /> : <ChevronDown size={16} className="text-[#8E8878]" />}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-4 border-t border-black/10">
          <p className="text-xs font-medium text-[#8E8878] mt-3 mb-2">Chi tiết từng lô</p>
          <div className="space-y-2">
            {(item.lots || []).map((lot, i) => {
              const days = daysLeft(lot.expiryDate);
              return (
                <div key={lot.id || i}
                  className={`flex items-center justify-between text-sm px-3 py-2 rounded-xl ${lot.nearExpiry ? 'bg-amber-100' : 'bg-[#FAF7F2]'}`}>
                  <div>
                    <span className="text-[#1C1C1E] font-medium">{fmtQty(lot.quantity)} {item.unit}</span>
                  </div>
                  <div className="text-right">
                    {lot.expiryDate ? (
                      <div>
                        <p className={`text-xs font-medium ${lot.nearExpiry ? 'text-amber-700' : 'text-[#8E8878]'}`}>
                          HSD: {fmtDate(lot.expiryDate)}
                        </p>
                        {days != null && days <= 30 && (
                          <p className={`text-xs ${days <= 7 ? 'text-red-600' : 'text-amber-600'}`}>còn {days} ngày</p>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-[#8E8878]">Không có HSD</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function FactoryMaterialStockPage() {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useMinLoading();
  const [search, setSearch] = useState('');

  const load = () => {
    setLoading(true);
    factoryMaterialRequestApi.getStock()
      .then(d => setStocks(d || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = stocks.filter(s =>
    !search || s.materialName.toLowerCase().includes(search.toLowerCase())
  );

  const nearExpiryCount = stocks.reduce((acc, s) =>
    acc + (s.lots || []).filter(l => l.nearExpiry).length, 0);

  return (
    <div className="p-4 space-y-4 bg-[#F5F0EB] min-h-full">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#1C1C1E]">Kho nguyên liệu xưởng</h1>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-4">
          <p className="text-xs text-[#8E8878]">Số loại nguyên liệu</p>
          <p className="text-2xl font-bold text-[#1A2B1A] mt-1">{stocks.length}</p>
        </div>
        <div className={`rounded-2xl border shadow-sm p-4 ${nearExpiryCount > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-black/5'}`}>
          <p className="text-xs text-[#8E8878]">Lô sắp hết hạn (&lt;30 ngày)</p>
          <p className={`text-2xl font-bold mt-1 ${nearExpiryCount > 0 ? 'text-amber-700' : 'text-[#1A2B1A]'}`}>
            {nearExpiryCount}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-4">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8878]" />
          <input
            className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-[#E8DDD0]
              focus:outline-none focus:border-[#C9A84C] bg-[#FAF7F2] placeholder-[#8E8878]"
            placeholder="Tìm tên nguyên liệu..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* List */}
      {loading
        ? <div className="space-y-3">{[1, 2, 3].map(i => <CardSkeleton key={i} />)}</div>
        : filtered.length === 0
          ? (
            <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-10 text-center">
              <Package size={32} className="mx-auto text-[#8E8878] mb-2" />
              <p className="text-[#8E8878] text-sm">Kho trống</p>
            </div>
          )
          : (
            <div className="space-y-3">
              {filtered.map((item, i) => <StockCard key={i} item={item} />)}
            </div>
          )
      }
    </div>
  );
}