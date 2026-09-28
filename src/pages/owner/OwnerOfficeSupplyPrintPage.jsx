// src/pages/owner/OwnerOfficeSupplyPrintPage.jsx
//
// PHIẾU IN ĐẶT HÀNG VĂN PHÒNG PHẨM (Owner).
//
// Chỉ hiển thị YÊU CẦU HIỆN TẠI đang pending — KHÔNG bao gồm lịch sử hay các
// lần đặt trước. Dữ liệu được truyền qua router state từ trang "Danh sách yêu
// cầu VPP" (openPrint) để tránh race condition: nếu owner bấm "Đặt hàng" ở
// tab khác giữa lúc mở phiếu in, dữ liệu vẫn giữ nguyên snapshot.
//
// Cấu trúc phiếu:
//   [Tiêu đề công ty] [Ngày in]
//   ┌ NHÂN VIÊN 1 — Bộ phận · Chức vụ
//   │   ┌───┬────────────────┬──────┬─────────┐
//   │   │ # │ Tên vật dụng   │ ĐVT  │ SL       │
//   │   └───┴────────────────┴──────┴─────────┘
//   ├ NHÂN VIÊN 2 — Bộ phận · Chức vụ
//   │   ...
//
// Có nút "In" gọi window.print(); CSS @media print ẩn header/nút, giữ nội dung.
import { useEffect, useMemo, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Printer, ArrowLeft, RefreshCw } from 'lucide-react';
import { officeSupplyApi, fmtQtyOff, resolveCentralWarehouseId } from '../../api/officeSupplyApi';
import { useToast } from '../../components/common/Toast';
import { LoadingSpinner, SecondaryButton, PrimaryButton } from '../../components/ui';

const VN_DATE = (ms = Date.now()) =>
  new Date(ms).toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

// ── Style riêng cho phiếu in ────────────────────────────────────────────────
const PRINT_STYLES = `
  @page { size: A4; margin: 16mm; }
  @media print {
    .no-print { display: none !important; }
    body { background: #fff; }
    .print-page { padding: 0; margin: 0; }
    .print-employee { page-break-inside: avoid; }
  }
`;

export default function OwnerOfficeSupplyPrintPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const initial = location.state?.summary ?? null;
  const [summary, setSummary] = useState(initial);
  const [loading, setLoading] = useState(!initial);

  // Nếu vào thẳng URL /print (F5) không có state → fetch lại
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const id = await resolveCentralWarehouseId();
      setSummary(await officeSupplyApi.summary(id));
    } catch (e) {
      toast(e?.response?.data?.message || 'Không tải được dữ liệu', 'error');
    } finally { setLoading(false); }
  }, [toast]);

  useEffect(() => {
    if (!initial) reload();
  }, [initial, reload]);

  // Gom detail rows theo nhân viên → mỗi nhân viên 1 khối
  const groups = useMemo(() => {
    const rows = summary?.detail || [];
    const map = new Map();
    for (const r of rows) {
      const key = r.userId ?? r.userFullName;
      if (!map.has(key)) {
        map.set(key, {
          userId: r.userId,
          fullName: r.userFullName,
          department: r.userDepartment,
          position: r.userPosition,
          items: [],
        });
      }
      map.get(key).items.push(r);
    }
    // Sort theo tên cho ổn định (BE đã sort theo tên rồi, giữ nguyên là an toàn)
    return [...map.values()];
  }, [summary]);

  const empty = !loading && groups.length === 0;

  return (
    <>
      <style>{PRINT_STYLES}</style>

      {/* Thanh công cụ — ẩn khi in */}
      <div className="no-print p-4 sm:p-6 flex flex-wrap items-center gap-2 border-b border-hairline">
        <SecondaryButton onClick={() => navigate(-1)}>
          <ArrowLeft size={14} /> Quay lại
        </SecondaryButton>
        <SecondaryButton onClick={reload} disabled={loading}>
          <RefreshCw size={14} /> Làm mới
        </SecondaryButton>
        <div className="flex-1" />
        <PrimaryButton onClick={() => window.print()} disabled={loading || empty}>
          <Printer size={14} /> In phiếu
        </PrimaryButton>
      </div>

      {/* Phiếu — cả xem trên màn và in */}
      <div className="print-page p-6 sm:p-10 max-w-[850px] mx-auto bg-white text-black">
        {loading ? (
          <LoadingSpinner label="Đang tải..." />
        ) : empty ? (
          <p className="text-center text-muted py-16">
            Chưa có phiếu yêu cầu nào để in.
          </p>
        ) : (
          <>
            <header className="text-center mb-6">
              <h1 className="text-xl font-bold uppercase tracking-wide">
                Phiếu yêu cầu văn phòng phẩm
              </h1>
              <p className="text-xs mt-1">Ngày in: {VN_DATE()}</p>
              <p className="text-xs mt-0.5">
                Tổng số: {groups.length} nhân viên
                {' · '}{summary?.summary?.length || 0} loại vật dụng
              </p>
            </header>

            <div className="space-y-6">
              {groups.map(g => (
                <section key={g.userId ?? g.fullName}
                         className="print-employee border border-gray-300 rounded-lg overflow-hidden">
                  <div className="px-4 py-2 bg-gray-100 border-b border-gray-300">
                    <p className="font-bold text-sm">{g.fullName}</p>
                    <p className="text-xs text-gray-600">
                      {[g.department, g.position].filter(Boolean).join(' · ') || '—'}
                    </p>
                  </div>
                  <table className="w-full text-sm">
                    <thead className="text-xs">
                      <tr className="border-b border-gray-300">
                        <th className="px-3 py-1.5 text-left w-8">#</th>
                        <th className="px-3 py-1.5 text-left">Tên vật dụng</th>
                        <th className="px-3 py-1.5 text-left w-24">Đơn vị tính</th>
                        <th className="px-3 py-1.5 text-right w-24">Số lượng</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.items.map((it, i) => (
                        <tr key={i} className="border-b border-gray-200 last:border-b-0">
                          <td className="px-3 py-1.5 text-gray-500">{i + 1}</td>
                          <td className="px-3 py-1.5">
                            {it.itemName}
                            {it.note && (
                              <span className="text-xs text-gray-500 ml-1">— {it.note}</span>
                            )}
                          </td>
                          <td className="px-3 py-1.5">{it.unit}</td>
                          <td className="px-3 py-1.5 text-right font-semibold">
                            {fmtQtyOff(it.quantity)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              ))}
            </div>

            <footer className="mt-10 grid grid-cols-2 gap-6 text-sm">
              <div className="text-center">
                <p className="font-semibold">Người lập phiếu</p>
                <p className="text-xs text-gray-500">(Ký, ghi rõ họ tên)</p>
              </div>
              <div className="text-center">
                <p className="font-semibold">Người duyệt</p>
                <p className="text-xs text-gray-500">(Ký, ghi rõ họ tên)</p>
              </div>
            </footer>
          </>
        )}
      </div>
    </>
  );
}
