// src/pages/owner/OwnerOfficeSupplyManagePage.jsx
//
// PAGE "Quản lý văn phòng phẩm" (Owner/Admin).
//
// Hiển thị thống kê theo TỪNG vật dụng — dữ liệu từ lịch sử đặt hàng
// (OfficeSupplyOrder):
//   · Tên vật dụng
//   · Thời gian đặt gần nhất
//   · Tổng số lượng đã đặt (mọi lần đặt)
//   · Khoảng cách TRUNG BÌNH giữa 2 lần đặt (đơn vị ngày)
//   · Số lượng TRUNG BÌNH mỗi lần đặt
//
// Có 1 nút "Danh sách văn phòng phẩm" điều hướng sang trang quản lý catalog
// (add/edit vật dụng).
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Archive, BarChart2, RefreshCw, Package, ListChecks,
} from 'lucide-react';
import {
  officeSupplyApi, fmtQtyOff, fmtDateOff, daysSince,
  resolveCentralWarehouseId,
} from '../../api/officeSupplyApi';
import { useToast } from '../../components/common/Toast';
import { BackButton } from '../../components/common/SubPageNav';
import {
  PageHeader, SectionCard, SecondaryButton,
  LoadingSpinner, EmptyState,
} from '../../components/ui';

/** Format số ngày TB "n.n ngày" (1 chữ số thập phân). null → "—". */
const fmtDays = (d) => (d == null ? '—' : `${(Math.round(d * 10) / 10).toLocaleString('vi-VN')} ngày`);

export default function OwnerOfficeSupplyManagePage() {
  const navigate = useNavigate();
  const toast = useToast();

  const [warehouseId, setWarehouseId] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    resolveCentralWarehouseId()
      .then(setWarehouseId)
      .catch(() => toast('Không lấy được kho Trung tâm', 'error'));
  }, [toast]);

  const load = useCallback(async () => {
    if (!warehouseId) return;
    setLoading(true);
    try {
      setRows(await officeSupplyApi.itemReport(warehouseId));
    } catch (e) {
      toast(e?.response?.data?.message || 'Không tải được báo cáo', 'error');
    } finally { setLoading(false); }
  }, [warehouseId, toast]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <BackButton fallback="/owner/office-supply/requests" />
      <PageHeader
        icon={BarChart2}
        title="Quản lý văn phòng phẩm"
        subtitle="Thống kê tần suất & số lượng đặt hàng theo từng vật dụng"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <SecondaryButton onClick={() => navigate('/owner/office-supply/items')}>
              <ListChecks size={15} /> Danh sách văn phòng phẩm
            </SecondaryButton>
            <SecondaryButton onClick={load}>
              <RefreshCw size={15} /> Làm mới
            </SecondaryButton>
          </div>
        }
      />

      {loading ? (
        <SectionCard><LoadingSpinner label="Đang tải..." /></SectionCard>
      ) : rows.length === 0 ? (
        <SectionCard>
          <EmptyState icon={Package} title="Chưa có dữ liệu"
            description="Chưa có lần đặt hàng nào để thống kê." />
        </SectionCard>
      ) : (
        <SectionCard>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-canvas text-xs text-muted uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-2.5 text-left">Tên vật dụng</th>
                  <th className="px-4 py-2.5 text-left">ĐVT</th>
                  <th className="px-4 py-2.5 text-right">Số lần đặt</th>
                  <th className="px-4 py-2.5 text-right">Tổng số lượng</th>
                  <th className="px-4 py-2.5 text-right">SL TB / lần</th>
                  <th className="px-4 py-2.5 text-right">Khoảng cách TB</th>
                  <th className="px-4 py-2.5 text-left">Đặt gần nhất</th>
                  <th className="px-4 py-2.5 text-right">Cách hôm nay</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {rows.map(row => {
                  const days = daysSince(row.lastOrderedAt);
                  return (
                    <tr key={row.supplyItemId} className="hover:bg-canvas/50">
                      <td className="px-4 py-2.5 font-medium text-ink">
                        {row.name}
                        {row.specification && (
                          <span className="text-xs text-muted ml-1">({row.specification})</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-muted">{row.unit}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-ink">
                        {row.orderCount}
                      </td>
                      <td className="px-4 py-2.5 text-right text-ink">
                        {fmtQtyOff(row.totalQuantity)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-ink">
                        {fmtQtyOff(row.avgQuantityPerOrder)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-ink">
                        {fmtDays(row.avgIntervalDays)}
                      </td>
                      <td className="px-4 py-2.5 text-muted">{fmtDateOff(row.lastOrderedAt)}</td>
                      <td className="px-4 py-2.5 text-right">
                        {days != null && (
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full
                            ${days <= 7
                              ? 'bg-emerald-50 text-emerald-700'
                              : days <= 30
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-canvas text-muted'}`}>
                            {days} ngày
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}
    </div>
  );
}
