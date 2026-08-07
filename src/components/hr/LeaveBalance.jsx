// src/components/hr/LeaveBalance.jsx
//
// Quỹ ngày phép — dùng chung cho CẢ HAI phía:
//   · Nhân viên  (MyRequestsPage)        → card số dư + nút xem lịch sử
//   · Người duyệt (EmployeeRequestsPanel) → số dư của nhân viên đang xét
//
// Gộp vào một file vì hai bên hiển thị y hệt nhau, chỉ khác nguồn dữ liệu. Tách
// đôi thì mỗi lần đổi chính sách phép phải sửa hai chỗ và chúng sẽ lệch nhau.
import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, History, AlertTriangle, X } from 'lucide-react';
import { employeeRequestApi } from '../../api/employeeRequestApi';
import Modal from '../ui/Modal';

const fmtDays = (v) => {
  const n = Number(v ?? 0);
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
};

const fmtDate = (iso) => {
  if (!iso) return '—';
  const [y, m, d] = String(iso).split('-');
  return `${d}/${m}/${y}`;
};

/**
 * Nạp số dư phép.
 *
 * @param userId  null/undefined = lấy của CHÍNH MÌNH (endpoint my-*).
 *                Có giá trị = lấy của nhân viên đó (cần quyền duyệt).
 */
export function useLeaveBalance(userId, year) {
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const p = userId
      ? employeeRequestApi.leaveBalance(userId, year)
      : employeeRequestApi.myLeaveBalance(year);
    p.then(setBalance)
      .catch(() => setBalance(null))
      .finally(() => setLoading(false));
  }, [userId, year]);

  useEffect(() => { load(); }, [load]);

  return { balance, loading, reload: load };
}

/* ══════════════════════════════════════════════════════════════════════════
   MODAL LỊCH SỬ NGHỈ PHÉP
   ══════════════════════════════════════════════════════════════════════════ */

export function LeaveHistoryModal({ open, onClose, userId, year, title }) {
  const [items, setItems] = useState(null);

  useEffect(() => {
    if (!open) return;
    setItems(null);
    const p = userId
      ? employeeRequestApi.leaveHistory(userId, year)
      : employeeRequestApi.myLeaveHistory(year);
    p.then(d => setItems(d || [])).catch(() => setItems([]));
  }, [open, userId, year]);

  const totalPaid = (items || []).reduce((s, i) => s + Number(i.paidLeaveDays || 0), 0);
  const totalUnpaid = (items || []).reduce((s, i) => s + Number(i.unpaidLeaveDays || 0), 0);

  return (
    <Modal open={open} onClose={onClose}
      title={title || `Lịch sử nghỉ phép ${year || new Date().getFullYear()}`} size="lg">
      {items == null ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-12 bg-canvas rounded-xl animate-pulse" />)}
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted text-center py-8">
          Chưa có ngày nghỉ phép nào được duyệt trong năm này.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-muted border-b border-hairline">
                  <th className="px-3 py-2 text-left">Thời gian nghỉ</th>
                  <th className="px-3 py-2 text-center">Số ngày</th>
                  <th className="px-3 py-2 text-center">Trừ phép</th>
                  <th className="px-3 py-2 text-center">Không lương</th>
                  <th className="px-3 py-2 text-left">Lý do</th>
                  <th className="px-3 py-2 text-left">Người duyệt</th>
                </tr>
              </thead>
              <tbody>
                {items.map(i => (
                  <tr key={i.id} className="border-b border-hairline last:border-0 align-top">
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {i.fromDate === i.toDate
                        ? fmtDate(i.fromDate)
                        : `${fmtDate(i.fromDate)} – ${fmtDate(i.toDate)}`}
                    </td>
                    <td className="px-3 py-2.5 text-center text-muted">{i.calendarDays ?? '—'}</td>
                    <td className="px-3 py-2.5 text-center font-semibold text-gold">
                      {fmtDays(i.paidLeaveDays)}
                    </td>
                    <td className="px-3 py-2.5 text-center text-muted">
                      {fmtDays(i.unpaidLeaveDays)}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-ink max-w-[220px]">
                      {i.reason || '—'}
                      {i.decisionNote && (
                        <div className="text-[11px] text-muted mt-0.5">Ghi chú: {i.decisionNote}</div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted whitespace-nowrap">
                      {i.decidedByName || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-hairline-2 font-semibold">
                  <td className="px-3 py-2.5 text-right" colSpan={2}>Tổng</td>
                  <td className="px-3 py-2.5 text-center text-gold">{fmtDays(totalPaid)}</td>
                  <td className="px-3 py-2.5 text-center text-muted">{fmtDays(totalUnpaid)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="text-[11px] text-muted">
            Chỉ liệt kê phiếu ĐÃ DUYỆT. Phiếu vắt qua giao thừa được tính trọn vào năm bắt đầu nghỉ.
          </p>
        </div>
      )}
    </Modal>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   CARD SỐ DƯ PHÉP
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * @param compact  true = một dòng gọn cho panel duyệt; false = card đầy đủ.
 */
export default function LeaveBalanceCard({ userId, year, compact = false, title }) {
  const y = year || new Date().getFullYear();
  const { balance, loading } = useLeaveBalance(userId, y);
  const [historyOpen, setHistoryOpen] = useState(false);

  if (loading && !balance) {
    return <div className={`bg-canvas rounded-2xl animate-pulse ${compact ? 'h-12' : 'h-24'}`} />;
  }
  if (!balance) return null;

  const remaining = Number(balance.remainingDays ?? 0);
  // Số dư ÂM là chuyện có thật (duyệt vượt quỹ) — hiện đỏ chứ không kẹp về 0,
  // giấu đi thì người duyệt tiếp theo lại duyệt vượt tiếp.
  const remainColor = remaining < 0 ? 'text-red-600 dark:text-red-300'
    : remaining <= 2 ? 'text-amber-600 dark:text-amber-300' : 'text-ink';

  const HistoryButton = (
    <button type="button" onClick={() => setHistoryOpen(true)}
      className="inline-flex items-center gap-1.5 text-xs font-semibold text-gold
                 hover:text-gold-strong whitespace-nowrap">
      <History size={13} /> Xem lịch sử
    </button>
  );

  if (compact) {
    return (
      <>
        <div className="flex items-center gap-3 flex-wrap text-xs">
          <span className="text-muted">Phép {y}:</span>
          <span className="text-ink">
            <b>{fmtDays(balance.entitledDays)}</b> ngày
          </span>
          <span className="text-muted">
            đã nghỉ <b className="text-ink">{fmtDays(balance.usedDays)}</b>
          </span>
          <span className={remainColor}>
            còn <b>{fmtDays(remaining)}</b> ngày
          </span>
          {balance.missingWorkStartDate && (
            <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-300">
              <AlertTriangle size={12} /> chưa có ngày vào làm
            </span>
          )}
          {HistoryButton}
        </div>
        <LeaveHistoryModal open={historyOpen} onClose={() => setHistoryOpen(false)}
          userId={userId} year={y}
          title={`Lịch sử nghỉ phép ${y} — ${balance.fullName || ''}`} />
      </>
    );
  }

  return (
    <>
      <div className="bg-surface rounded-2xl border border-hairline shadow-sm p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gold/10 flex items-center justify-center">
              <CalendarDays size={16} className="text-gold" />
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">{title || `Ngày phép năm ${y}`}</p>
              <p className="text-[11px] text-muted">
                12 ngày cơ bản, cộng 1 ngày mỗi 5 năm thâm niên
                {balance.seniorityYears != null && ` · thâm niên ${balance.seniorityYears} năm`}
              </p>
            </div>
          </div>
          {HistoryButton}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Được nghỉ', value: balance.entitledDays, cls: 'text-ink' },
            { label: 'Đã nghỉ', value: balance.usedDays, cls: 'text-muted' },
            { label: 'Còn lại', value: remaining, cls: remainColor },
          ].map(x => (
            <div key={x.label} className="rounded-xl bg-canvas px-3 py-2.5 text-center">
              <p className={`text-xl font-bold ${x.cls}`}>{fmtDays(x.value)}</p>
              <p className="text-[11px] text-muted mt-0.5">{x.label}</p>
            </div>
          ))}
        </div>

        {balance.missingWorkStartDate && (
          <div className="flex items-start gap-1.5 mt-3 text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10
                          border border-amber-200 dark:border-amber-500/28 rounded-xl px-2.5 py-2">
            <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" />
            <span>
              Hồ sơ chưa có ngày vào làm nên chỉ được tính 12 ngày cơ bản, chưa cộng
              thâm niên. Liên hệ Nhân sự để bổ sung.
            </span>
          </div>
        )}
      </div>

      <LeaveHistoryModal open={historyOpen} onClose={() => setHistoryOpen(false)}
        userId={userId} year={y} />
    </>
  );
}
