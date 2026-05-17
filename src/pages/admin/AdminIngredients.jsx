import { useEffect, useState, useCallback } from 'react';
import { Package, Search, AlertTriangle, AlertCircle, Calendar, X, Warehouse as WhIcon } from 'lucide-react';
import { adminIngredientApi, adminWarehouseApi, getImageUrl } from '../../api/adminApi';
import { ExpiryBadge } from '../../components/admin/Badge';
import useDebounce from '../../utils/useDebounce';
import {
  PageHeader,
  LoadingSpinner,
  EmptyState,
  inputCls,
  formatNumber,
  formatDate,
} from '../../components/admin/ui';

export default function AdminIngredients() {
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWhId, setSelectedWhId] = useState(null);
  const [q, setQ] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingWh, setLoadingWh] = useState(true);
  const debouncedQ = useDebounce(q, 600);


  // Load warehouses + pick default (first one)
  useEffect(() => {
    (async () => {
      try {
        const list = await adminWarehouseApi.list();
        setWarehouses(list || []);
        if (list?.length) setSelectedWhId(list[0].id);
      } catch (e) { console.error(e); } finally { setLoadingWh(false); }
    })();
  }, []);

  const load = useCallback(async () => {
    if (!selectedWhId) return;

    setLoading(true);
    try {
      const res = await adminIngredientApi.listByWarehouse(
        selectedWhId,
        debouncedQ || undefined
      );
      setRows(res || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [selectedWhId, debouncedQ]);

  useEffect(() => { load(); }, [load]);

  const counts = {
    total: rows.length,
    warning: rows.filter((r) => r.expiryBadge === 'WARNING').length,
    danger: rows.filter((r) => r.expiryBadge === 'DANGER').length,
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5">
      <PageHeader
        icon={Package}
        title="Nguyên liệu"
        subtitle="Quản lý tồn kho và hạn sử dụng"
      />

      {/* Warehouse selector */}
      <div className="bg-white rounded-2xl border border-black/5 p-4 shadow-sm">
        <label className="block text-xs font-semibold text-[#1C1C1E] uppercase tracking-wider mb-2">
          <WhIcon size={12} className="inline mr-1" />
          Chọn kho
        </label>
        {loadingWh ? (
          <div className="h-10 bg-[#FAF7F2] rounded-xl animate-pulse" />
        ) : warehouses.length === 0 ? (
          <p className="text-sm text-[#8E8878]">Chưa có kho nào. Tạo kho ở trang "Kho hàng" trước.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {warehouses.map((w) => (
              <button
                key={w.id}
                onClick={() => setSelectedWhId(w.id)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ring-1 ${selectedWhId === w.id
                  ? 'bg-[#C9A84C] text-white ring-[#C9A84C]'
                  : 'bg-white text-[#1C1C1E] ring-black/10 hover:bg-[#FAF7F2]'
                  }`}
              >
                {w.name}
                <span className={`ml-2 text-xs ${selectedWhId === w.id ? 'text-white/80' : 'text-[#8E8878]'}`}>
                  {w.type === 'SALE' ? 'Bán hàng' : 'Trung chuyển'}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Summary cards */}
      {!loading && rows.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <SummaryCard icon={Package} label="Tổng nguyên liệu" value={counts.total} color="gold" />
          <SummaryCard icon={AlertTriangle} label="Sắp hết hạn (≤ 3 tháng)" value={counts.warning} color="amber" />
          <SummaryCard icon={AlertCircle} label="Hết hạn gấp (≤ 1 tháng)" value={counts.danger} color="red" />
        </div>
      )}

      {/* Search */}
      <div className="bg-white rounded-2xl border border-black/5 p-3 sm:p-4 shadow-sm">
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8878]"
            size={16}
          />

          <input
            type="text"
            placeholder="Tìm tên nguyên liệu..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setQ('');
            }}
            className={`${inputCls} pl-9 pr-9`} // chừa chỗ cho nút X
          />

          {/* Nút clear */}
          {q && (
            <button
              type="button"
              onClick={() => setQ('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8E8878] hover:text-[#1C1C1E]"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
        {loading ? (
          <LoadingSpinner />
        ) : rows.length === 0 ? (
          <EmptyState icon={Package} title="Chưa có nguyên liệu" description="Kho này chưa có nguyên liệu nào, hoặc không khớp kết quả tìm kiếm" />
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#FAF7F2] text-[#8E8878]">
                    <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider">Nguyên liệu</th>
                    <th className="px-4 py-3 text-right font-semibold text-xs uppercase tracking-wider">Tồn kho</th>
                    <th className="px-4 py-3 text-right font-semibold text-xs uppercase tracking-wider">SL sắp hết hạn</th>
                    <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider">Ngày hết hạn gần nhất</th>
                    <th className="px-4 py-3 text-center font-semibold text-xs uppercase tracking-wider">Cảnh báo</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.ingredientId} className="border-t border-black/5 hover:bg-[#FAF7F2]/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {r.ingredientImageUrl ? (
                            <img src={getImageUrl(r.ingredientImageUrl)} alt="" className="w-10 h-10 rounded-lg object-cover border border-black/5" />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-[#FAF7F2] flex items-center justify-center text-[#C9A84C]/60">
                              <Package size={16} />
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-[#1C1C1E]">{r.ingredientName}</p>
                            <p className="text-xs text-[#8E8878]">Đơn vị: {r.unit}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-semibold text-[#1C1C1E]">{formatNumber(r.stockQuantity)}</span>
                        {r.totalCostValue > 0 && (
                          <span className="text-xs text-[#C9A84C] font-medium ml-1">
                            ({formatCurrency(r.totalCostValue)})
                          </span>
                        )}
                        <span className="text-xs text-[#8E8878] ml-1">{r.unit}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {Number(r.nearExpiryQuantity) > 0
                          ? <span className={`font-semibold ${r.expiryBadge === 'DANGER' ? 'text-red-600' : 'text-amber-600'}`}>{formatNumber(r.nearExpiryQuantity)}</span>
                          : <span className="text-[#8E8878]">—</span>
                        }
                      </td>
                      <td className="px-4 py-3">
                        {r.nearestExpiryDate ? (
                          <div className="flex items-center gap-1.5 text-[#1C1C1E]">
                            <Calendar size={13} className="text-[#8E8878]" />
                            <span>{formatDate(r.nearestExpiryDate)}</span>
                            {typeof r.daysUntilExpiry === 'number' && (
                              <span className={`text-xs ml-1 ${r.daysUntilExpiry < 0 ? 'text-red-600 font-semibold' : r.daysUntilExpiry <= 30 ? 'text-red-600' : r.daysUntilExpiry <= 90 ? 'text-amber-600' : 'text-[#8E8878]'}`}>
                                ({r.daysUntilExpiry < 0 ? `Đã quá ${Math.abs(r.daysUntilExpiry)}d` : `còn ${r.daysUntilExpiry}d`})
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[#8E8878] text-xs">Không có lô</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <ExpiryBadge badge={r.expiryBadge} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="md:hidden divide-y divide-black/5">
              {rows.map((r) => (
                <div key={r.ingredientId} className="p-4">
                  <div className="flex items-start gap-3">
                    {r.ingredientImageUrl ? (
                      <img src={getImageUrl(r.ingredientImageUrl)} alt="" className="w-12 h-12 rounded-lg object-cover border border-black/5" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-[#FAF7F2] flex items-center justify-center text-[#C9A84C]/60"><Package size={18} /></div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[#1C1C1E] truncate">{r.ingredientName}</p>
                      <p className="text-xs text-[#8E8878]">
                        Tồn: <span className="font-semibold text-[#1C1C1E]">{formatNumber(r.stockQuantity)}</span> {r.unit}
                      {r.totalCostValue > 0 && (
                        <span className="ml-1 text-[#C9A84C] font-semibold text-xs">({formatCurrency(r.totalCostValue)})</span>
                      )}
                      </p>
                      {r.nearestExpiryDate && (
                        <p className="text-xs text-[#8E8878] mt-0.5">
                          HSD gần nhất: <span className="text-[#1C1C1E]">{formatDate(r.nearestExpiryDate)}</span>
                          {typeof r.daysUntilExpiry === 'number' && <span className="ml-1">(còn {r.daysUntilExpiry} ngày)</span>}
                        </p>
                      )}
                      {r.expiryBadge !== 'NONE' && (
                        <div className="mt-1.5"><ExpiryBadge badge={r.expiryBadge} /></div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, color }) {
  const colorMap = {
    gold: 'from-[#C9A84C]/15 to-[#C9A84C]/5 text-[#C9A84C] ring-[#C9A84C]/20',
    amber: 'from-amber-500/15 to-amber-500/5 text-amber-600 ring-amber-500/20',
    red: 'from-red-500/15 to-red-500/5 text-red-600 ring-red-500/20',
  };
  return (
    <div className="bg-white rounded-2xl border border-black/5 p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ring-1 flex items-center justify-center ${colorMap[color]}`}>
          <Icon size={18} />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-widest text-[#8E8878] font-semibold truncate">{label}</p>
          <p className="text-xl font-bold text-[#1C1C1E] leading-tight">{value}</p>
        </div>
      </div>
    </div>
  );
}
