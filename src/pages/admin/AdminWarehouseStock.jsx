// src/pages/admin/AdminWarehouseStock.jsx
// Change 7: Admin click vào kho → hiển thị danh sách nguyên liệu sort qty desc + giá vốn
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminWarehouseApi } from '../../api/adminApi';
import { adminWarehouseStockApi } from '../../api/adminApi';
import { ArrowLeft, Package, TrendingDown, DollarSign } from 'lucide-react';
import {
  PageHeader, LoadingSpinner, EmptyState,
  formatCurrency, formatNumber,
} from '../../components/admin/ui';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
function imgUrl(p) {
  if (!p) return null;
  return p.startsWith('http') ? p : `${BASE_URL}/api/auth${p}`;
}

export default function AdminWarehouseStock() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [warehouse, setWarehouse] = useState(null);
  const [items, setItems] = useState([]);
  const [grandTotal, setGrandTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      adminWarehouseApi.getById(id),
      adminWarehouseStockApi.getStock(id),
    ]).then(([wh, stock]) => {
      setWarehouse(wh);
      setItems(stock.items || []);
      setGrandTotal(stock.grandTotalCostValue || 0);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="p-8"><LoadingSpinner /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/admin/warehouses')}
          className="p-2 rounded-xl bg-[#F0EBE3] hover:bg-[#E8DDD0] text-[#5C4E3D] transition-colors">
          <ArrowLeft size={18} />
        </button>
        <PageHeader
          icon={Package}
          title={warehouse?.name || 'Kho hàng'}
          subtitle={`${items.length} nguyên liệu — ${warehouse?.address || ''}`}
        />
      </div>

      {/* Tổng giá vốn */}
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-4">
        <div className="p-3 bg-amber-100 rounded-xl">
          <DollarSign size={22} className="text-amber-600" />
        </div>
        <div>
          <p className="text-xs text-amber-600 font-medium uppercase tracking-wide">Tổng giá vốn tồn kho</p>
          <p className="text-2xl font-bold text-amber-700">{formatCurrency(grandTotal)}</p>
        </div>
      </div>

      {items.length === 0
        ? <EmptyState icon={Package} title="Kho chưa có nguyên liệu" />
        : (
          <div className="bg-white rounded-2xl border border-[#E8DDD0] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#FAF7F2] border-b border-[#E8DDD0]">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#8E8878] uppercase">Nguyên liệu</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-[#8E8878] uppercase">Tồn kho</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-[#8E8878] uppercase">Giá vốn tích lũy</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={item.ingredientId}
                    className={`border-b border-[#F0EBE3] hover:bg-[#FAF7F2] transition-colors ${idx % 2 === 0 ? '' : 'bg-[#FDFBF8]'}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {item.imageUrl
                          ? <img src={imgUrl(item.imageUrl)} alt={item.ingredientName}
                              className="w-8 h-8 rounded-lg object-cover border border-[#E8DDD0]" />
                          : <div className="w-8 h-8 rounded-lg bg-[#F0EBE3] flex items-center justify-center text-sm">🧂</div>
                        }
                        <div>
                          <p className="font-medium text-[#1C1C1E]">{item.ingredientName}</p>
                          <p className="text-xs text-[#8E8878]">{item.unit}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-semibold ${Number(item.stockQuantity) <= 0
                        ? 'text-red-500' : Number(item.stockQuantity) <= 5
                        ? 'text-amber-500' : 'text-[#1C1C1E]'}`}>
                        {formatNumber(item.stockQuantity)}
                      </span>
                      <span className="text-xs text-[#8E8878] ml-1">{item.unit}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-[#C9A84C]">
                      {Number(item.totalCostValue) > 0 ? formatCurrency(item.totalCostValue) : <span className="text-[#C4B9A8] font-normal">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[#FAF7F2] border-t-2 border-[#E8DDD0]">
                  <td colSpan={2} className="px-4 py-3 font-bold text-[#5C4E3D]">Tổng cộng</td>
                  <td className="px-4 py-3 text-right font-bold text-amber-600 text-base">{formatCurrency(grandTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )
      }
    </div>
  );
}
