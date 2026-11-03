// src/components/hr/CreateLeaveForEmployeeModal.jsx
//
// Modal HR dùng để TẠO phiếu nghỉ cho 1 nhân viên.
// Hiển thị lịch MẶC ĐỊNH là tháng trước đó (có thể bấm mũi tên để chuyển
// tháng khác). Click 1 ngày = chọn/bỏ chọn ngày đó. Mặc định ngày vừa chọn
// là CẢ NGÀY (sáng + chiều). Toggle sáng/chiều để nghỉ nửa buổi.
//
// Sau khi lưu, backend tự duyệt bằng tài khoản id=2 (Chủ tịch). Phần vượt
// quỹ phép còn lại sẽ được ghi nhận là nghỉ không lương (auto-split).

import { useState, useMemo, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Loader2, Sun, Moon } from 'lucide-react';
import { employeeRequestApi } from '../../api/employeeRequestApi';
import { PrimaryButton, SecondaryButton } from '../ui';
import Modal from '../ui/Modal';
import { useToast } from '../common/Toast';

// ── Helpers ────────────────────────────────────────────────────────────────
const DOW = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const MONTH_LABEL = (m, y) => `Tháng ${m + 1}/${y}`;

/** YYYY-MM-DD từ (year, monthIndex0, day). */
function isoOf(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Grid 6 tuần của tháng — mỗi phần tử: { d, m, y, iso, inMonth }. */
function buildMonthGrid(year, monthIndex) {
  const first = new Date(year, monthIndex, 1);
  const startDow = first.getDay();              // 0=CN
  const start = new Date(year, monthIndex, 1 - startDow);
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const dt = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    cells.push({
      d: dt.getDate(),
      m: dt.getMonth(),
      y: dt.getFullYear(),
      iso: isoOf(dt.getFullYear(), dt.getMonth(), dt.getDate()),
      inMonth: dt.getMonth() === monthIndex,
      isWeekend: dt.getDay() === 0 || dt.getDay() === 6,
    });
  }
  return cells;
}

export default function CreateLeaveForEmployeeModal({ employee, onClose, onCreated }) {
  const toast = useToast();
  const now = new Date();
  // Mặc định hiển thị tháng TRƯỚC đó.
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const [year, setYear]   = useState(prev.getFullYear());
  const [month, setMonth] = useState(prev.getMonth());

  // sessions: { 'YYYY-MM-DD': { morning: bool, afternoon: bool } }
  const [sessions, setSessions] = useState({});
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  // Ngày đã có phiếu — load từ BE để disable, tránh tạo trùng.
  const [occupied, setOccupied] = useState({});   // iso → { morning, afternoon, statusLabel }

  // Nạp occupied cho KHOẢNG tháng đang xem (±1 tháng để chuyển mượt).
  // Dùng endpoint occupiedDatesOf — trả về từng NGÀY CỤ THỂ + buổi sáng/chiều,
  // không phải khoảng from→to như leaveHistory (sẽ sai với phiếu ngắt quãng).
  useEffect(() => {
    let active = true;
    const fromM = month - 1 < 0 ? 11 : month - 1;
    const fromY = month - 1 < 0 ? year - 1 : year;
    const toM   = month + 1 > 11 ? 0 : month + 1;
    const toY   = month + 1 > 11 ? year + 1 : year;
    const from = isoOf(fromY, fromM, 1);
    const to   = isoOf(toY, toM, new Date(toY, toM + 1, 0).getDate());

    employeeRequestApi.occupiedDatesOf(employee.userId, from, to)
      .then(list => {
        if (!active) return;
        const map = {};
        for (const d of (list || [])) {
          if (!d?.date) continue;
          map[d.date] = {
            morning: !!d.morning,
            afternoon: !!d.afternoon,
            statusLabel: d.statusLabel || 'Đã có phiếu',
          };
        }
        setOccupied(map);
      })
      .catch(() => { if (active) setOccupied({}); });

    return () => { active = false; };
  }, [employee.userId, year, month]);

  const grid = useMemo(() => buildMonthGrid(year, month), [year, month]);

  const selectedList = useMemo(() => {
    return Object.entries(sessions)
      .filter(([, s]) => s?.morning || s?.afternoon)
      .map(([iso, s]) => ({ iso, ...s }))
      .sort((a, b) => a.iso.localeCompare(b.iso));
  }, [sessions]);

  const totalDays = useMemo(
    () => selectedList.reduce(
      (sum, d) => sum + (d.morning ? 0.5 : 0) + (d.afternoon ? 0.5 : 0), 0),
    [selectedList]
  );

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  };

  const toggleDay = (iso, isInMonth) => {
    if (!isInMonth) return;
    const occ = occupied[iso];
    // Nếu đã kín cả 2 buổi → không chọn được
    if (occ && occ.morning && occ.afternoon) {
      toast(`Ngày ${iso} đã có phiếu nghỉ cả ngày.`, 'error');
      return;
    }
    setSessions(prev => {
      const next = { ...prev };
      if (next[iso]?.morning || next[iso]?.afternoon) {
        delete next[iso];                       // click lại → bỏ chọn
      } else if (occ) {
        // Đã nghỉ nửa buổi → tự động chọn buổi còn lại
        next[iso] = {
          morning: !occ.morning,
          afternoon: !occ.afternoon,
        };
      } else {
        next[iso] = { morning: true, afternoon: true };   // mặc định cả ngày
      }
      return next;
    });
  };

  const toggleSession = (iso, key) => {
    setSessions(prev => {
      const curr = prev[iso] || { morning: false, afternoon: false };
      const nx = { ...curr, [key]: !curr[key] };
      const next = { ...prev };
      if (!nx.morning && !nx.afternoon) delete next[iso];
      else next[iso] = nx;
      return next;
    });
  };

  const submit = async () => {
    if (selectedList.length === 0) {
      toast('Chưa chọn ngày nào.', 'error');
      return;
    }
    const days = selectedList.map(d => ({
      date: d.iso, morning: !!d.morning, afternoon: !!d.afternoon,
    }));
    const fromDate = days[0].date;
    const toDate   = days[days.length - 1].date;

    setSaving(true);
    try {
      await employeeRequestApi.createForEmployee(employee.userId, {
        type: 'LEAVE',
        fromDate, toDate, days,
        reason: reason.trim() || undefined,
      });
      toast('Đã tạo và tự động duyệt phiếu nghỉ.', 'success');
      onCreated?.();
    } catch (e) {
      toast(e?.response?.data?.message || 'Không tạo được phiếu nghỉ', 'error');
    } finally { setSaving(false); }
  };

  // Phép còn lại hiển thị
  const remainingText = employee.remainingDisplay || '0 ngày';

  return (
    <Modal open onClose={onClose}
      title={`Tạo phiếu nghỉ — ${employee.fullName}`}
      size="xl">
      <div className="space-y-4">
        {/* Thông tin NV + số phép */}
        <div className="rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/28 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          <strong>{employee.fullName}</strong>
          {employee.roleLabel && <> · {employee.roleLabel}</>}
          {' — Phép còn lại: '}
          <strong className="tabular-nums">{remainingText}</strong>
          <p className="mt-1">
            Phiếu sẽ được <strong>tự động duyệt</strong> bởi Chủ tịch (id=2).
            Phần vượt quỹ phép sẽ ghi nhận là nghỉ <strong>không lương</strong>.
          </p>
        </div>

        {/* Lịch */}
        <div className="rounded-xl border border-hairline overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-canvas">
            <button type="button" onClick={prevMonth}
              className="p-1.5 rounded hover:bg-surface">
              <ChevronLeft size={16} />
            </button>
            <div className="font-semibold text-ink">{MONTH_LABEL(month, year)}</div>
            <button type="button" onClick={nextMonth}
              className="p-1.5 rounded hover:bg-surface">
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="grid grid-cols-7 bg-canvas text-[11px] text-muted uppercase tracking-wider border-y border-hairline">
            {DOW.map(d => (
              <div key={d} className="px-2 py-1.5 text-center">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {grid.map((c, i) => {
              const sel = sessions[c.iso];
              const isSelected = !!(sel?.morning || sel?.afternoon);
              const occ = occupied[c.iso];
              const dim = !c.inMonth;
              return (
                <button key={i} type="button"
                  onClick={() => toggleDay(c.iso, c.inMonth)}
                  disabled={!c.inMonth}
                  className={`
                    relative h-14 border-b border-r border-hairline text-sm transition-colors
                    ${dim ? 'bg-canvas/50 text-muted/60' : 'bg-surface text-ink hover:bg-gold/5'}
                    ${isSelected ? '!bg-gold/15 border-gold text-gold' : ''}
                    ${occ && !isSelected ? '!bg-red-50 dark:!bg-red-500/5 cursor-not-allowed' : ''}
                    ${c.isWeekend && c.inMonth && !isSelected && !occ ? 'text-muted' : ''}
                  `.trim()}>
                  <div className="absolute top-1 left-1.5 text-xs font-semibold">{c.d}</div>
                  {occ && !isSelected && (
                    <div className="absolute bottom-1 right-1 text-[9px] text-red-600 font-semibold">đã nghỉ</div>
                  )}
                  {sel && (
                    <div className="absolute bottom-1 right-1 text-[9px] font-semibold">
                      {sel.morning && sel.afternoon ? 'cả ngày'
                        : sel.morning ? 'sáng' : 'chiều'}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Danh sách ngày đã chọn + toggle sáng/chiều từng ngày */}
        {selectedList.length > 0 && (
          <div className="rounded-xl border border-hairline overflow-hidden">
            <div className="px-3 py-2 bg-canvas text-xs font-bold text-muted uppercase tracking-wider flex justify-between">
              <span>Chi tiết {selectedList.length} ngày đã chọn — tổng {totalDays} ngày</span>
            </div>
            <div className="divide-y divide-hairline">
              {selectedList.map(d => (
                <div key={d.iso} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span className="font-medium tabular-nums">{formatIsoVi(d.iso)}</span>
                  <div className="flex gap-1.5">
                    <SessionToggle
                      active={d.morning} icon={Sun} label="Sáng"
                      onClick={() => toggleSession(d.iso, 'morning')} />
                    <SessionToggle
                      active={d.afternoon} icon={Moon} label="Chiều"
                      onClick={() => toggleSession(d.iso, 'afternoon')} />
                    <button type="button"
                      onClick={() => setSessions(p => {
                        const n = { ...p }; delete n[d.iso]; return n;
                      })}
                      className="px-2 py-1 text-xs rounded border border-hairline text-muted hover:bg-canvas"
                      title="Bỏ chọn ngày này">
                      <X size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lý do */}
        <div>
          <label className="text-xs font-bold text-muted uppercase tracking-wider mb-1 block">
            Lý do (tuỳ chọn)
          </label>
          <textarea rows={2}
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Mặc định: Nghỉ phép (HR tạo)"
            className="w-full px-3 py-2 rounded-lg border border-hairline bg-surface text-ink text-sm
              focus:outline-none focus:border-gold" />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <SecondaryButton onClick={onClose} disabled={saving}>Huỷ</SecondaryButton>
          <PrimaryButton onClick={submit} disabled={saving || selectedList.length === 0}>
            {saving && <Loader2 size={14} className="animate-spin" />}
            Tạo phiếu & duyệt
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

function SessionToggle({ active, icon: Icon, label, onClick }) {
  return (
    <button type="button" onClick={onClick}
      className={`flex items-center gap-1 px-2 py-1 text-xs rounded border font-semibold transition-colors
        ${active
          ? 'bg-gold/10 border-gold text-gold'
          : 'bg-surface border-hairline text-muted hover:text-ink'}`}>
      <Icon size={12} /> {label}
    </button>
  );
}

/** "2026-11-18" → "T4, 18/11/2026" */
function formatIsoVi(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const dow = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][dt.getDay()];
  return `${dow}, ${d}/${m}/${y}`;
}