// src/pages/owner/OwnerLeaveManagementPage.jsx
//
// PAGE "Quản lý phép" (Owner/Admin) — thay cho nút "Xuất ngày phép" cũ.
//
// Layout theo spec:
//   Cột A     : Tên nhân viên (có dấu, đã map user)
//   Cột B-M   : T1..T12 — usage mỗi tháng ở dạng "n days m mins"
//               (paid leave đã duyệt + phút trễ/về sớm, quy về phút)
//   Cột N     : Phép tồn năm trước (đơn vị ngày)
//   Cột O     : Phép cơ bản cộng dồn của năm hiện tại (đơn vị ngày)
//   Cột P     : Tổng đã sử dụng — "n days m mins"
//   Cột Q     : Tổng phép được cộng (đơn vị ngày)
//   Cột R     : Phép còn lại — "n days m mins"
//
// Nhóm theo phòng ban đã sort theo role rank (BE lo — xem
// LeaveManagementService.roleRank khớp thứ tự spec).
//
// Tính năng bổ sung:
//   · Nút Xuất Leave Report → hit endpoint XLSX cũ (không đổi công thức).
//   · Chip "Mở lại tính lương" mỗi tháng — enable/disable theo policy
//     UI: chỉ tháng hiện tại và tháng liền trước, THUỘC NĂM HIỆN TẠI, được mở
//     lại. Ví dụ hôm nay 9/2026 → chỉ 9/2026 và 8/2026 enable; 7/2026 trở về
//     trước disable; 8/2025 và 9/2025 cũng disable (khác năm).
//     (Backend enforcement của policy này nằm ở FactoryPayrollService — không
//     đụng ở lần refactor này, chỉ chặn ở UI như user yêu cầu.)
import { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
import {
  CalendarClock, Download, RefreshCw, Users, Unlock, Lock,
} from 'lucide-react';
import { hrLeaveApi } from '../../api/hrApi';
import { downloadBlob } from '../../api/services';
import { useToast } from '../../components/common/Toast';
import { BackButton } from '../../components/common/SubPageNav';
import { useLang } from '../../context/LangContext';
import {
  PageHeader, SectionCard, SecondaryButton,
  LoadingSpinner, EmptyState,
} from '../../components/ui';

// ── Policy: các tháng được phép "Mở lại tính lương" ─────────────────────────
// Chỉ tháng hiện tại và tháng liền trước, THUỘC NĂM HIỆN TẠI. Không có exception
// cho tháng 1 (vì 12/năm-trước không được mở lại) — spec đã nói rõ.
function buildReopenablePolicy(year) {
  const now = new Date();
  const nowYear = now.getFullYear();
  const nowMonth = now.getMonth() + 1; // 1..12
  const set = new Set();
  if (year === nowYear) {
    set.add(nowMonth);
    if (nowMonth > 1) set.add(nowMonth - 1);
  }
  return set;
}

// ── Cell hiển thị "n days m mins" ───────────────────────────────────────────
function DaysMinsCell({ cell }) {
  if (!cell) return <span className="text-muted">—</span>;
  const negative = cell.minutes < 0;
  return (
    <span className={`inline-block whitespace-nowrap ${negative ? 'text-red-600' : ''}`}>
      {cell.label}
    </span>
  );
}

// ── Ô T1..T8: click để sửa ─────────────────────────────────────────────────
// Format hiển thị theo spec OWNER:
//   · 0 phút            → " - "
//   · phút = 0, ngày>0  → "N ngày"
//   · ngày = 0, phút>0  → "M phút"
//   · cả hai            → "N ngày M phút"
// Input tự do: người dùng gõ được "3", "3 ngày", "3 ngày 45 phút", "45 phút",
// "0.5 ngày", "-", … regex nới lỏng, sai chữ (giờ, gio, phut, …) cũng nhận.
function formatUsageLabel(cell) {
  if (!cell || cell.minutes === 0) return '-';
  const negative = cell.minutes < 0;
  const days = Math.trunc(Math.abs(cell.days));
  const halfDay = Math.abs(cell.days) - days >= 0.25;
  const mins = Math.abs(cell.extraMinutes ?? 0);

  const daysPart = halfDay ? `${days}.5` : `${days}`;
  const hasDays = Math.abs(cell.days) > 0;

  let out;
  if (hasDays && mins > 0)  out = `${daysPart} ngày ${mins} phút`;
  else if (hasDays)         out = `${daysPart} ngày`;
  else                      out = `${mins} phút`;
  return negative ? '-' + out : out;
}

/** "3 ngày 45 phút" → 3*480+45 = 1485; "3" → 1440; "-" → 0; "45 phút" → 45. */
function parseUsageInput(raw) {
  const s = (raw || '').toString().trim().toLowerCase().replace(',', '.');
  if (!s || s === '-') return 0;

  const dayMatch = s.match(/([\d.]+)\s*(?:ng[àa]y|d(?:ay)?)/);
  const minMatch = s.match(/([\d.]+)\s*(?:ph[uú]t|m(?:in)?)/);

  let days = dayMatch ? parseFloat(dayMatch[1]) : 0;
  let mins = minMatch ? parseFloat(minMatch[1]) : 0;

  if (!dayMatch && !minMatch) {
    // Không có đơn vị → hiểu là NGÀY (thói quen OWNER)
    const n = parseFloat(s);
    if (!Number.isNaN(n)) days = n;
  }
  if (Number.isNaN(days)) days = 0;
  if (Number.isNaN(mins)) mins = 0;
  const total = Math.round(days * 480 + mins);
  return Math.max(0, total);
}

function EditableUsageCell({ cell, userId, year, month, onSaved, disabled }) {  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const commit = useCallback(async () => {
    if (busy) return;
    const minutes = parseUsageInput(value);
    const currentMinutes = cell?.minutes ?? 0;
    setEditing(false);
    if (minutes === currentMinutes) return;              // không đổi → khỏi gọi API
    setBusy(true);
    try {
      const res = await hrLeaveApi.setManualUsage({ userId, year, month, minutes });
      onSaved?.(res);
    } catch (e) {
      toast(e?.response?.data?.message || 'Không ghi được số phép', 'error');
    } finally { setBusy(false); }
  }, [value, cell, userId, year, month, onSaved, toast, busy]);

  if (disabled) {
    return (
      <span className="inline-block whitespace-nowrap text-ink">
        {formatUsageLabel(cell)}
      </span>
    );
  }

  if (!editing) {
    const label = formatUsageLabel(cell);
    const negative = (cell?.minutes ?? 0) < 0;
    return (
      <button type="button"
        onClick={() => { setValue(label === '-' ? '' : label); setEditing(true); }}
        title="Click để sửa"
        className={`inline-block whitespace-nowrap px-1.5 py-0.5 rounded border border-transparent
          hover:border-gold hover:bg-gold/5 transition-colors
          ${negative ? 'text-red-600' : 'text-ink'} ${busy ? 'opacity-50' : ''}`}>
        {label}
      </button>
    );
  }

  return (
    <input
      autoFocus
      value={value}
      onChange={e => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={e => {
        if (e.key === 'Enter')  { e.preventDefault(); e.currentTarget.blur(); }
        if (e.key === 'Escape') { setEditing(false); }
      }}
      placeholder="Vd: 3 ngày 45 phút"
      className="w-[100px] px-1.5 py-0.5 text-xs border border-gold rounded
        bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-gold text-center"
    />
  );
}

// ── Ô "TỒN NĂM TRƯỚC" / "PHÉP NĂM HIỆN TẠI": click để sửa số ngày ─────────
// Đơn vị hiển thị NGÀY (thập phân). Cho phép nhập kèm phút cho chính xác:
//   "22", "22.5", "22,5", "22 ngày", "22 ngày 240 phút" đều nhận.
// Lưu về BE dưới dạng Double days (240 phút = 0.5 ngày).
function parseDaysInput(raw) {
  const s = (raw || '').toString().trim().toLowerCase().replace(',', '.');
  if (!s || s === '-') return 0;
  const dayMatch = s.match(/([\d.]+)\s*(?:ng[àa]y|d(?:ay)?)/);
  const minMatch = s.match(/([\d.]+)\s*(?:ph[uú]t|m(?:in)?)/);
  let days = dayMatch ? parseFloat(dayMatch[1]) : 0;
  let mins = minMatch ? parseFloat(minMatch[1]) : 0;
  if (!dayMatch && !minMatch) {
    const n = parseFloat(s);
    if (!Number.isNaN(n)) days = n;
  }
  if (Number.isNaN(days)) days = 0;
  if (Number.isNaN(mins)) mins = 0;
  return Math.max(0, days + mins / 480);
}

function EditableDaysCell({ days, onSave }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const displayValue = (days ?? 0).toLocaleString('vi-VN',
    { maximumFractionDigits: 1 });

  const commit = useCallback(async () => {
    if (busy) return;
    const newDays = parseDaysInput(value);
    setEditing(false);
    if (Math.abs(newDays - (days ?? 0)) < 0.001) return;   // không đổi → khỏi gọi API
    setBusy(true);
    try {
      await onSave(newDays);
    } catch (e) {
      toast(e?.response?.data?.message || 'Không ghi được số ngày phép', 'error');
    } finally { setBusy(false); }
  }, [value, days, onSave, toast, busy]);

  if (!editing) {
    return (
      <button type="button"
        onClick={() => { setValue(displayValue); setEditing(true); }}
        title="Click để sửa"
        className={`inline-block whitespace-nowrap px-1.5 py-0.5 rounded border border-transparent
          hover:border-gold hover:bg-gold/5 transition-colors text-ink text-right
          ${busy ? 'opacity-50' : ''}`}>
        {displayValue}
      </button>
    );
  }

  return (
    <input
      autoFocus
      value={value}
      onChange={e => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={e => {
        if (e.key === 'Enter')  { e.preventDefault(); e.currentTarget.blur(); }
        if (e.key === 'Escape') { setEditing(false); }
      }}
      placeholder="0"
      className="w-[70px] px-1.5 py-0.5 text-xs border border-gold rounded
        bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-gold text-right"
    />
  );
}

// ── Header của 1 nhóm phòng ban ─────────────────────────────────────────────
function DepartmentHeader({ group }) {
  // 1 (name) + 12 (T1..T12) + 5 (prior/current/totalUsed/plus/remaining) = 18
  return (
    <tr className="bg-gold/10">
      <td colSpan={18} className="px-4 py-2 font-bold text-gold text-sm">
        ▶ {group.label} · {group.employees.length} nhân viên
      </td>
    </tr>
  );
}

export default function OwnerLeaveManagementPage() {
  const toast = useToast();
  const { t } = useLang();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await hrLeaveApi.management());
    } catch (e) {
      toast(e?.response?.data?.message || 'Không tải được dữ liệu', 'error');
    } finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await hrLeaveApi.exportReport();
      const y = data?.year ?? new Date().getFullYear();
      downloadBlob(res.data ?? res, `Leave_Report_${y}.xlsx`);
      toast('Đã tải Leave Report', 'success');
    } catch (e) {
      toast(e?.response?.data?.message || 'Xuất báo cáo thất bại', 'error');
    } finally { setExporting(false); }
  };

  const reopenable = useMemo(
    () => buildReopenablePolicy(data?.year ?? new Date().getFullYear()),
    [data?.year],
  );

  const totalEmployees = useMemo(
    () => (data?.departments ?? [])
      .reduce((s, d) => s + (d.employees?.length ?? 0), 0),
    [data],
  );

  const monthCols = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <BackButton fallback="/owner/users" />
      <PageHeader
        icon={CalendarClock}
        title={`Quản lý phép ${data?.year ? `— ${data.year}` : ''}`}
        subtitle={loading
          ? 'Đang tải…'
          : `${totalEmployees} nhân viên · ${data?.departments?.length ?? 0} phòng ban`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <SecondaryButton onClick={load} disabled={loading}>
              <RefreshCw size={15} /> Làm mới
            </SecondaryButton>
            <SecondaryButton onClick={handleExport} disabled={exporting}>
              <Download size={15} />
              {exporting ? 'Đang xuất…' : 'Xuất Leave Report'}
            </SecondaryButton>
          </div>
        }
      />

      {/* Chú thích các tháng có thể mở lại */}
      <SectionCard>
        <div className="px-5 py-3 text-xs text-muted flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="inline-flex items-center gap-1">
            <Unlock size={12} className="text-emerald-600" />
            Tháng có thể mở lại tính lương:
          </span>
          {monthCols.map(m => (
            <span key={m}
              className={`px-1.5 py-0.5 rounded font-semibold
                ${reopenable.has(m)
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'text-muted'}`}>
              T{m}
            </span>
          ))}
          <span className="ml-2 text-muted">
            (chỉ tháng hiện tại + tháng liền trước của năm hiện tại)
          </span>
        </div>
      </SectionCard>

      {loading ? (
        <SectionCard><LoadingSpinner label="Đang tải bảng phép..." /></SectionCard>
      ) : !data || data.departments?.length === 0 ? (
        <SectionCard>
          <EmptyState icon={Users} title="Chưa có dữ liệu"
            description="Không có nhân viên nào hoạt động trong hệ thống." />
        </SectionCard>
      ) : (
        <SectionCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-canvas text-[11px] text-muted uppercase tracking-wider sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-2 text-left min-w-[180px] sticky left-0 bg-canvas z-20">
                    Tên nhân viên
                  </th>
                  {monthCols.map(m => (
                    <th key={m} className="px-2 py-2 text-center min-w-[110px]">T{m}</th>
                  ))}
                  <th className="px-2 py-2 text-right min-w-[70px]" title="Phép tồn năm trước">
                    {data.priorYear}
                  </th>
                  <th className="px-2 py-2 text-right min-w-[70px]" title="Phép năm hiện tại (cộng dồn)">
                    {data.year}
                  </th>
                  <th className="px-2 py-2 text-center min-w-[110px]" title="Tổng đã sử dụng">
                    Tổng đã dùng
                  </th>
                  <th className="px-2 py-2 text-right min-w-[70px]" title="Tổng phép được cộng">
                    Được cộng
                  </th>
                  <th className="px-2 py-2 text-center min-w-[110px]" title="Phép còn lại">
                    Còn lại
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.departments.map(group => (
                  <Fragment key={group.key}>
                    <DepartmentHeader group={group} />
                    {group.employees.map(emp => (
                      <tr key={emp.userId} className="hover:bg-canvas/50 border-b border-hairline">
                        <td className="px-3 py-2 sticky left-0 bg-surface z-10">
                          <div className="font-medium text-ink">{emp.fullName}</div>
                          {emp.position && (
                            <div className="text-[10px] text-muted">{emp.position}</div>
                          )}
                        </td>
                        {emp.months.map((cell, i) => {
                          const monthNo = i + 1;
                          const canReopen = reopenable.has(monthNo);
                          // T1..T8 nhập tay; T9..T12 tính theo phiếu nghỉ
                          const editable = monthNo <= 8;
                          return (
                            <td key={monthNo}
                              className={`px-2 py-2 text-center ${canReopen ? '' : ''}`}>
                              <div className="flex flex-col items-center gap-0.5">
                                <EditableUsageCell
                                  cell={cell}
                                  userId={emp.userId}
                                  year={data.year}
                                  month={monthNo}
                                  disabled={!editable}
                                  onSaved={setData}
                                />
                                <span
                                  className={`inline-flex items-center gap-0.5 text-[9px] px-1 py-0.5 rounded
                                    ${canReopen
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : 'bg-canvas text-muted border border-hairline-2 opacity-50'}`}
                                  title={canReopen
                                    ? 'Có thể mở lại để tính lương lại'
                                    : 'Đã khoá — không được mở lại'}>
                                  {canReopen ? <Unlock size={9} /> : <Lock size={9} />}
                                  {canReopen ? 'Mở lại' : 'Khoá'}
                                </span>
                              </div>
                            </td>
                          );
                        })}
                        <td className="px-2 py-2 text-right text-ink">
                          <EditableDaysCell
                            days={emp.priorYearBalanceDays}
                            onSave={async (days) => {
                              const res = await hrLeaveApi.setPriorYearBalance({
                                userId: emp.userId, days });
                              setData(res);
                            }}
                          />
                        </td>
                        <td className="px-2 py-2 text-right text-ink">
                          <EditableDaysCell
                            days={emp.currentYearEntitledDays}
                            onSave={async (days) => {
                              const res = await hrLeaveApi.setCurrentYearEntitled({
                                userId: emp.userId, days });
                              setData(res);
                            }}
                          />
                        </td>
                        <td className="px-2 py-2 text-center font-semibold text-ink">
                          <DaysMinsCell cell={emp.totalUsed} />
                        </td>
                        <td className="px-2 py-2 text-right text-ink">
                          {(emp.totalPlusDays ?? 0).toLocaleString('vi-VN',
                            { maximumFractionDigits: 1 })}
                        </td>
                        <td className="px-2 py-2 text-center font-bold text-ink">
                          <DaysMinsCell cell={emp.remaining} />
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}
    </div>
  );
}