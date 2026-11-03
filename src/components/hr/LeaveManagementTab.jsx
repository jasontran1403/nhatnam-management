// src/components/hr/LeaveManagementTab.jsx
//
// Tab "Nghỉ phép" trong trang /hr/manage — THAY cho tab "Tính lương" cũ.
//
// Hiển thị toàn bộ nhân viên đang hoạt động, group theo PHÒNG và sort theo
// CHỨC VỤ trong phòng. Mỗi hàng gồm:
//   · Tên nhân viên + chức vụ
//   · Số phép còn lại — format "N ngày M phút"
//   · Nút "Tạo phiếu nghỉ" → mở modal chọn ngày trên lịch tháng trước đó.
//
// Khi HR tạo phiếu: backend tự động duyệt bởi tài khoản id=2 (Chủ tịch), auto
// phân bổ phần có lương / không lương dựa trên quỹ phép còn lại.

import { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
import { CalendarPlus, Loader2, Users, RefreshCw } from 'lucide-react';
import { employeeRequestApi } from '../../api/employeeRequestApi';
import {
  SectionCard, PrimaryButton, SecondaryButton, LoadingSpinner, EmptyState,
} from '../ui';
import { useToast } from '../common/Toast';
import CreateLeaveForEmployeeModal from './CreateLeaveForEmployeeModal';

export default function LeaveManagementTab() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createFor, setCreateFor] = useState(null);   // employee object

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await employeeRequestApi.leaveOverview();
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      toast(e?.response?.data?.message || 'Không tải được danh sách', 'error');
      setRows([]);
    } finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  // Group theo phòng; giữ nguyên thứ tự BE đã sort sẵn.
  const groups = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      const key = r.deptKey || 'OTHER';
      if (!map.has(key)) {
        map.set(key, { key, label: r.deptLabel || 'Khác', employees: [] });
      }
      map.get(key).employees.push(r);
    }
    return Array.from(map.values());
  }, [rows]);

  const total = rows.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">
          Hiển thị tất cả nhân viên. Bấm "Tạo phiếu nghỉ" để tạo & tự động duyệt
          phiếu nghỉ phép — phần vượt quỹ sẽ được ghi nhận là nghỉ không lương.
        </p>
        <SecondaryButton onClick={load} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Làm mới
        </SecondaryButton>
      </div>

      {loading ? (
        <SectionCard><LoadingSpinner label="Đang tải..." /></SectionCard>
      ) : total === 0 ? (
        <SectionCard>
          <EmptyState icon={Users} title="Chưa có nhân viên"
            description="Hệ thống chưa có nhân viên nào đang hoạt động." />
        </SectionCard>
      ) : (
        <SectionCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-canvas text-[11px] text-muted uppercase tracking-wider sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-2.5 text-left min-w-[220px]">Nhân viên</th>
                  <th className="px-4 py-2.5 text-left min-w-[160px]">Chức vụ</th>
                  <th className="px-4 py-2.5 text-center min-w-[160px]" title="Số phép còn lại">
                    Phép còn lại
                  </th>
                  <th className="px-4 py-2.5 text-right min-w-[160px]">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {groups.map(g => (
                  <Fragment key={g.key}>
                    <tr className="bg-gold/10">
                      <td colSpan={4} className="px-4 py-2 font-bold text-gold text-sm">
                        ▶ {g.label} · {g.employees.length} nhân viên
                      </td>
                    </tr>
                    {g.employees.map(emp => {
                      const remainingMinutes = emp.remainingMinutes ?? 0;
                      const negative = remainingMinutes < 0;
                      const zero = remainingMinutes === 0;
                      return (
                        <tr key={emp.userId}
                          className="hover:bg-canvas/50 border-b border-hairline">
                          <td className="px-4 py-2.5">
                            <div className="font-medium text-ink">{emp.fullName}</div>
                            <div className="text-xs text-muted">{emp.username}</div>
                          </td>
                          <td className="px-4 py-2.5 text-ink">
                            {emp.roleLabel || '—'}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <RemainingBadge
                              display={emp.remainingDisplay}
                              negative={negative}
                              zero={zero} />
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <PrimaryButton
                              className="!px-3 !py-1.5 text-xs"
                              onClick={() => setCreateFor(emp)}>
                              <CalendarPlus size={13} /> Tạo phiếu nghỉ
                            </PrimaryButton>
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {createFor && (
        <CreateLeaveForEmployeeModal
          employee={createFor}
          onClose={() => setCreateFor(null)}
          onCreated={() => { setCreateFor(null); load(); }}
        />
      )}
    </div>
  );
}

// ── Badge số phép còn lại — "N ngày M phút" ────────────────────────────────
function RemainingBadge({ display, negative, zero }) {
  const text = display || '0 ngày';
  const color = negative
    ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/28'
    : zero
      ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/28'
      : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/28';
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border ${color} tabular-nums`}>
      {text}
    </span>
  );
}
