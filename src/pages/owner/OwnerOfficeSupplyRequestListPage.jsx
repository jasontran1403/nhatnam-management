// src/pages/owner/OwnerOfficeSupplyRequestListPage.jsx
//
// TRANG CHÍNH MODULE VPP (Owner/Admin) — "Danh sách yêu cầu văn phòng phẩm".
//
// Hiển thị: tên vật dụng, đơn vị tính, TỔNG SỐ LƯỢNG (cộng dồn từ tất cả nhân viên
// đang có phiếu yêu cầu pending).
//
// Các nút hành động:
//   - Quản lý          → OwnerOfficeSupplyManagePage (thống kê + Danh sách VPP)
//   - In phiếu đặt hàng → tải PDF (BE render bằng iText7, dùng font DejaVu)
//   - Đặt hàng         → OfficeSupplyPricingModal (nhập giá + phí) rồi mới
//                        tạo OfficeSupplyOrder snapshot + clear toàn bộ phiếu
//
// KHÔNG có warehouse selector: sau refactor chỉ còn "Kho Trung tâm".
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Archive, ShoppingCart, RefreshCw, Package,
  Settings2, Printer, ChevronDown, Users,
} from 'lucide-react';
import {
  officeSupplyApi, fmtQtyOff, resolveCentralWarehouseId,
} from '../../api/officeSupplyApi';
import { downloadBlob } from '../../api/services';
import { useToast } from '../../components/common/Toast';
import { BackButton } from '../../components/common/SubPageNav';
import OfficeSupplyPricingModal from './OfficeSupplyPricingModal';
import {
  PageHeader, SectionCard, PrimaryButton, SecondaryButton,
  LoadingSpinner, EmptyState,
} from '../../components/ui';

/**
 * @param {object} props
 * @param {boolean} [props.compact] - true cho role PURCHASING: ẩn nút "Quản lý",
 *   phần "Chi tiết theo nhân viên", chỉ còn Tổng hợp + In phiếu + Đặt hàng.
 */
export default function OwnerOfficeSupplyRequestListPage({ compact = false }) {
  const navigate = useNavigate();
  const toast = useToast();

  const [warehouseId, setWarehouseId] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [confirmPlace, setConfirmPlace] = useState(false); // modal nhập giá & xác nhận đặt

  // Resolve kho Trung tâm 1 lần
  useEffect(() => {
    resolveCentralWarehouseId()
      .then(setWarehouseId)
      .catch(() => toast('Không lấy được kho Trung tâm', 'error'));
  }, [toast]);

  const load = useCallback(async () => {
    if (!warehouseId) return;
    setLoading(true);
    try {
      setSummary(await officeSupplyApi.summary(warehouseId));
    } catch (e) {
      toast(e?.response?.data?.message || 'Không tải được tổng hợp', 'error');
    } finally { setLoading(false); }
  }, [warehouseId, toast]);

  useEffect(() => { load(); }, [load]);

  const placeOrder = async (payload) => {
    setPlacing(true);
    try {
      await officeSupplyApi.placeOrder(warehouseId, payload);
      toast('Đã đặt hàng. Phiếu yêu cầu đã reset về 0.', 'success');
      setConfirmPlace(false);
      await load();
    } catch (e) {
      toast(e?.response?.data?.message || 'Không đặt được', 'error');
    } finally { setPlacing(false); }
  };

  // Tải PDF trực tiếp — không cần page in nữa
  const downloadPdf = async () => {
    if (!warehouseId) return;
    if (!summary || !summary.employeeCount) {
      toast('Chưa có yêu cầu nào để in', 'warning');
      return;
    }
    setPrinting(true);
    try {
      const res = await officeSupplyApi.exportOrderVoucherPdf(warehouseId);
      const ts = new Date().toISOString().slice(0, 16).replace(/[:T-]/g, '');
      downloadBlob(res.data ?? res, `Phieu-dat-VPP-${ts}.pdf`);
      toast('Đã tải phiếu đặt hàng (PDF)', 'success');
    } catch (e) {
      toast(e?.response?.data?.message || 'Không tải được PDF', 'error');
    } finally { setPrinting(false); }
  };

  const summaryRows = summary?.summary || [];
  const detailRows  = summary?.detail  || [];
  const empCount    = summary?.employeeCount || 0;

  // Gom detail theo nhân viên (giữ nguyên thứ tự BE trả về).
  // Kết quả: [{ userId, fullName, department, position, items: [...] }, ...]
  // Dùng cho rowSpan: 4 cột đầu (STT + tên + bộ phận + chức vụ) chỉ render ở
  // dòng đầu của mỗi nhân viên với rowSpan = số vật dụng, các dòng còn lại
  // của cùng nhân viên bỏ qua 4 cells đó để browser tự merge.
  const groupedDetail = (() => {
    const groups = [];
    let cur = null;
    for (const r of detailRows) {
      const key = r.userId ?? r.userFullName;
      if (!cur || cur.key !== key) {
        cur = {
          key,
          userId:     r.userId,
          fullName:   r.userFullName,
          department: r.userDepartment,
          position:   r.userPosition,
          items:      [],
        };
        groups.push(cur);
      }
      cur.items.push(r);
    }
    return groups;
  })();

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <PageHeader
        icon={Archive}
        title="Danh sách yêu cầu văn phòng phẩm"
        subtitle={empCount > 0
          ? `${empCount} nhân viên đang yêu cầu · ${summaryRows.length} loại vật dụng`
          : 'Chưa có phiếu yêu cầu nào'}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {!compact && (
              <SecondaryButton onClick={() => navigate('/owner/office-supply/manage')}>
                <Settings2 size={15} /> Quản lý
              </SecondaryButton>
            )}
            <SecondaryButton onClick={downloadPdf}
              disabled={empCount === 0 || printing}>
              <Printer size={15} />
              {printing ? 'Đang tải…' : 'In phiếu đặt hàng'}
            </SecondaryButton>
            <SecondaryButton onClick={load}>
              <RefreshCw size={15} /> Làm mới
            </SecondaryButton>
            {empCount > 0 && (
              <PrimaryButton onClick={() => setConfirmPlace(true)} disabled={placing}>
                <ShoppingCart size={15} />
                {placing ? 'Đang đặt...' : 'Đặt hàng & Xác nhận'}
              </PrimaryButton>
            )}
          </div>
        }
      />

      {loading ? (
        <SectionCard><LoadingSpinner label="Đang tải..." /></SectionCard>
      ) : empCount === 0 ? (
        <SectionCard>
          <EmptyState icon={Package} title="Chưa có phiếu yêu cầu"
            description="Nhân viên chưa gửi yêu cầu vật phẩm nào." />
        </SectionCard>
      ) : (
        <>
          {/* Bảng tổng hợp: tên vật dụng, ĐVT, tổng số lượng */}
          <SectionCard>
            <div className="flex items-center justify-between px-5 py-4 border-b border-hairline">
              <p className="text-sm font-bold text-ink">Tổng hợp yêu cầu</p>
              <p className="text-xs text-muted">Số lượng = tổng cộng từ tất cả nhân viên</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-canvas text-xs text-muted uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-2.5 text-left w-10">STT</th>
                    <th className="px-4 py-2.5 text-left">Tên vật dụng</th>
                    <th className="px-4 py-2.5 text-left">Đơn vị tính</th>
                    <th className="px-4 py-2.5 text-right">Số lượng</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {summaryRows.map(row => (
                    <tr key={row.stt} className="hover:bg-canvas/50">
                      <td className="px-4 py-2.5 text-muted text-center">{row.stt}</td>
                      <td className="px-4 py-2.5 font-medium text-ink">
                        {row.name}
                        {row.specification && (
                          <span className="text-xs text-muted ml-1">({row.specification})</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-muted">{row.unit}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-ink">
                        {fmtQtyOff(row.totalQuantity)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          {/* Chi tiết theo nhân viên — ẩn hoàn toàn với role PURCHASING */}
          {!compact && (
          <SectionCard>
            <button
              onClick={() => setDetailOpen(o => !o)}
              className="w-full flex items-center justify-between px-5 py-4 border-b border-hairline">
              <div className="flex items-center gap-2">
                <Users size={15} className="text-gold" />
                <p className="text-sm font-bold text-ink">Chi tiết theo nhân viên</p>
              </div>
              <ChevronDown size={15}
                className={`text-muted transition-transform ${detailOpen ? 'rotate-180' : ''}`} />
            </button>
            {detailOpen && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-canvas text-xs text-muted uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-2.5 text-left w-10">STT</th>
                      <th className="px-4 py-2.5 text-left">Nhân viên</th>
                      <th className="px-4 py-2.5 text-left">Bộ phận</th>
                      <th className="px-4 py-2.5 text-left">Chức vụ</th>
                      <th className="px-4 py-2.5 text-left">Vật dụng</th>
                      <th className="px-4 py-2.5 text-right">Số lượng</th>
                      <th className="px-4 py-2.5 text-left">ĐVT</th>
                      <th className="px-4 py-2.5 text-left">Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedDetail.map((g, gIdx) => (
                      g.items.map((row, iIdx) => {
                        // Dòng đầu của mỗi nhân viên: render 4 cells "chung" với rowSpan.
                        // Đường ranh giữa các nhân viên đậm hơn hairline thường —
                        // giúp mắt tách nhóm mà không cần thêm header row.
                        const isFirst = iIdx === 0;
                        const isLastOfGroup = iIdx === g.items.length - 1;
                        const groupBorder = isFirst && gIdx > 0
                          ? 'border-t-2 border-hairline-2'
                          : (iIdx > 0 ? 'border-t border-hairline' : '');
                        return (
                          <tr key={`${g.key}-${iIdx}`}
                              className={`hover:bg-canvas/50 ${groupBorder}
                                ${isLastOfGroup ? '' : ''}`}>
                            {isFirst && (
                              <>
                                <td className="px-4 py-2.5 text-muted text-center align-top"
                                    rowSpan={g.items.length}>
                                  {gIdx + 1}
                                </td>
                                <td className="px-4 py-2.5 font-medium text-ink align-top"
                                    rowSpan={g.items.length}>
                                  {g.fullName}
                                </td>
                                <td className="px-4 py-2.5 text-muted align-top"
                                    rowSpan={g.items.length}>
                                  {g.department || '—'}
                                </td>
                                <td className="px-4 py-2.5 text-muted align-top"
                                    rowSpan={g.items.length}>
                                  {g.position || '—'}
                                </td>
                              </>
                            )}
                            <td className="px-4 py-2.5 text-ink">{row.itemName}</td>
                            <td className="px-4 py-2.5 text-right font-semibold text-ink">
                              {fmtQtyOff(row.quantity)}
                            </td>
                            <td className="px-4 py-2.5 text-muted">{row.unit}</td>
                            <td className="px-4 py-2.5 text-muted">{row.note || '—'}</td>
                          </tr>
                        );
                      })
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
          )}
        </>
      )}

      {/* Modal nhập giá + xác nhận đặt hàng. Sau khi lưu, toàn bộ phiếu yêu
          cầu sẽ reset về 0. Giá nhập ở đây được BE phân bổ phí theo tỉ trọng
          và lưu đơn giá theo đơn vị tính nhỏ nhất. */}
      {confirmPlace && (
        <OfficeSupplyPricingModal
          summaryRows={summaryRows}
          submitting={placing}
          onCancel={() => setConfirmPlace(false)}
          onConfirm={placeOrder}
        />
      )}
    </div>
  );
}