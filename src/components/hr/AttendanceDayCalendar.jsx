// src/components/hr/AttendanceDayCalendar.jsx
// LỊCH CHẤM CÔNG 1 THÁNG CỦA 1 NHÂN VIÊN — dùng chung.
//
//   · Trang "Quản lý lương" (MyPayrollPage) — nhân viên tự xem của mình.
//   · Modal "Chi tiết ngày công" trong Bảng chấm công của OWNER — xem của
//     nhân viên bất kỳ trong bảng Phiếu lương.
//
// Component này CHỈ render phần ruột (lưới ngày + chi tiết ngày + tổng kết),
// KHÔNG bọc SectionCard, để nơi gọi tự quyết định khung chứa (card hay modal).
//
// Dữ liệu `attendance` lấy từ:
//   · GET /api/factory-payroll/my-payslip     → slip.attendance
//   · GET /api/factory-payroll/employee-attendance?userId&month&year
// Hai nguồn trả về CÙNG một DTO (AttendanceSummaryDto) nên dùng chung được.
import { useState, useEffect } from 'react';
import {
  AlertCircle, AlertTriangle, Check, Clock, Coffee, LogIn, LogOut, Minus,
  MousePointerClick, Plane, Sun, X,
} from 'lucide-react';

const fmtNum = (v, d = 2) =>
  v == null ? '\u2014' : Number(v).toLocaleString('vi-VN', { maximumFractionDigits: d });

export const WEEKDAY_LABEL = { 2: 'T2', 3: 'T3', 4: 'T4', 5: 'T5', 6: 'T6', 7: 'T7', 8: 'CN' };

/** Màu + icon cho từng loại ngày công trên lịch. */
const DAY_TYPE = {
  WORK: { cls: 'bg-emerald-500 text-white border-emerald-500', label: 'Đủ công', icon: Check },
  MISSING: { cls: 'bg-red-400 text-white border-red-400', label: 'Thiếu chấm công (0 công)', icon: AlertTriangle },
  EXCEPTION: { cls: 'bg-violet-500 text-white border-violet-500', label: 'Nghỉ có phép (đủ công)', icon: Plane },
  HALF: { cls: 'bg-emerald-100 text-emerald-700 border-emerald-300', label: 'Nửa công', icon: Minus },
  HOLIDAY: { cls: 'bg-violet-100 text-violet-700 border-violet-300', label: 'Lễ / Tết', icon: Sun },
  LEAVE: { cls: 'bg-blue-100 text-blue-700 border-blue-300', label: 'Nghỉ phép', icon: Plane },
  UNPAID: { cls: 'bg-red-100 text-red-700 border-red-300', label: 'Nghỉ không lương', icon: AlertCircle },
  OFF: { cls: 'bg-[#FAF7F2] text-[#C4B9A8] border-black/5', label: 'Không chấm công', icon: Coffee },
};

/** Đổi số phút thành dạng "8h33" cho dễ đọc. */
const fmtDuration = (m) => {
  if (!m || m <= 0) return '—';
  const h = Math.floor(m / 60), r = m % 60;
  return h > 0 ? `${h}h${r ? String(r).padStart(2, '0') : ''}` : `${r} phút`;
};

// ═════════════════════════════
// CHI TIẾT 1 NGÀY CHẤM CÔNG — cột phải
// ═════════════════════════════

function DayDetail({ day, month, year, onClose }) {
  if (!day) return null;

  const cfg = DAY_TYPE[day.type] || DAY_TYPE.OFF;
  const Icon = cfg.icon;
  const dateStr = `${String(day.day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;

  const sessions = day.sessions?.length
    ? day.sessions
    : (day.checkIn || day.checkOut ? [{ in: day.checkIn, out: day.checkOut }] : []);

  return (
    <div className="lg:h-full flex flex-col rounded-2xl border border-[#C9A84C]/30 overflow-hidden
      bg-gradient-to-br from-[#C9A84C]/10 to-transparent">

      <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-3
        border-b border-[#C9A84C]/20">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${cfg.cls}`}>
            <Icon size={15} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-[#1C1C1E] leading-tight">
              {dateStr} · Thứ {day.weekdayLabel}
            </p>
            <p className="text-[11px] text-[#8E8878] mt-0.5">{cfg.label}</p>
          </div>
        </div>
        <button onClick={onClose}
          className="p-1.5 rounded-lg text-[#8E8878] hover:text-[#1C1C1E]
            hover:bg-white/60 transition-colors shrink-0">
          <X size={15} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {sessions.length === 0 ? (
          <p className="text-sm text-[#8E8878] text-center py-3">
            Không có dữ liệu chấm công trong ngày này.
          </p>
        ) : (
          <div className="space-y-2">
            {sessions.map((s, i) => (
              <div key={i}
                className="flex items-center gap-3 bg-white rounded-xl px-3.5 py-3 border border-black/5">
                {sessions.length > 1 && (
                  <span className="w-6 h-6 rounded-lg bg-[#FAF7F2] flex items-center justify-center
                    text-[11px] font-bold text-[#8E8878] shrink-0">{i + 1}</span>
                )}
                <div className="flex-1 flex items-center gap-2">
                  <LogIn size={14} className="text-emerald-600 shrink-0" />
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-[#8E8878] font-bold">Vào</p>
                    <p className="text-base font-bold text-[#1C1C1E] leading-tight">{s.in || '--:--'}</p>
                  </div>
                </div>
                <div className="w-px h-8 bg-black/5" />
                <div className="flex-1 flex items-center gap-2">
                  <LogOut size={14} className="text-orange-600 shrink-0" />
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-[#8E8878] font-bold">Ra</p>
                    <p className="text-base font-bold text-[#1C1C1E] leading-tight">{s.out || '--:--'}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg
            bg-white border border-black/5 text-[#5A5548]">
            Công ghi nhận: <strong className="text-[#1C1C1E]">{fmtNum(day.value)}</strong>
          </span>
          {day.lateMinutes > 0 && (
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg
              bg-amber-50 border border-amber-200 text-amber-700">
              Đi trễ {day.lateMinutes} phút
            </span>
          )}
          {day.earlyMinutes > 0 && (
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg
              bg-blue-50 border border-blue-200 text-blue-700">
              Về sớm {day.earlyMinutes} phút
            </span>
          )}
          {day.workedMinutes > 0 && (
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg
              bg-white border border-black/5 text-[#5A5548]"
              title="Đã trừ 1 tiếng nghỉ trưa 12:00–13:00">
              Thời gian làm: <strong className="text-[#1C1C1E]">{fmtDuration(day.workedMinutes)}</strong>
              {day.requiredMinutes > 0 && (
                <span className="text-[#8E8878]"> / {fmtDuration(day.requiredMinutes)}</span>
              )}
            </span>
          )}
        </div>

        {day.exception && (
          <div className="flex items-start gap-2 bg-violet-50 border border-violet-200 rounded-xl px-3 py-2.5">
            <Plane size={14} className="text-violet-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-violet-800 leading-snug">
              <strong>{day.exception}</strong>
              {day.windowStart && ` — ca làm ngày này là ${day.windowStart}–${day.windowEnd}.`}
            </p>
          </div>
        )}

        {day.type === 'MISSING' && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
            <AlertTriangle size={14} className="text-red-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-red-800 leading-snug">
              Ngày này thiếu giờ vào hoặc giờ ra nên <strong>không được tính công</strong>.
              Nếu có lý do chính đáng, hãy nộp đơn xin nghỉ / đi trễ cho bộ phận nhân sự.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ═════════════════════════════
// PLACEHOLDER CỘT PHẢI — dùng chung cho cả chấm công lẫn tài xế
// ═════════════════════════════

export function DayDetailPlaceholder({ description }) {
  return (
    <div className="hidden lg:flex flex-col items-center justify-center text-center
      h-full px-8 rounded-2xl border border-dashed border-black/10 bg-[#FAF7F2]/60">
      <span className="w-12 h-12 rounded-2xl bg-white border border-black/5
        flex items-center justify-center shadow-sm">
        <MousePointerClick size={20} className="text-[#C9A84C]" />
      </span>
      <p className="text-sm font-bold text-[#1C1C1E] mt-4">Chọn một ngày để xem chi tiết</p>
      <p className="text-xs text-[#8E8878] mt-1.5 leading-relaxed max-w-[280px]">
        {description}
      </p>
    </div>
  );
}

// ═════════════════════════════
// LỊCH CHẤM CÔNG (mọi bộ phận trừ Tài xế)
// ═════════════════════════════

export default function AttendanceDayCalendar({ attendance, month, year, showHeader = true }) {
  const [selected, setSelected] = useState(null);
  const days = attendance?.days || [];

  useEffect(() => { setSelected(null); }, [month, year, attendance]);

  // Không có dữ liệu ngày nào → báo rõ thay vì render khung rỗng. Trường hợp hay
  // gặp: nhân viên không khớp được mã chấm công khi import file Excel.
  if (!days.length) {
    return (
      <div className="flex flex-col items-center justify-center text-center px-6 py-12">
        <span className="w-12 h-12 rounded-2xl bg-[#FAF7F2] border border-black/5
          flex items-center justify-center">
          <Coffee size={20} className="text-[#C4B9A8]" />
        </span>
        <p className="text-sm font-bold text-[#1C1C1E] mt-4">Chưa có dữ liệu chấm công</p>
        <p className="text-xs text-[#8E8878] mt-1.5 max-w-[320px] leading-relaxed">
          Tháng này chưa có bảng chấm công cho nhân viên, hoặc mã chấm công của
          nhân viên không khớp với dòng nào trong file đã tải lên.
        </p>
      </div>
    );
  }

  const leading = Math.max(0, days[0].weekday - 2);   // T2 = cột 0
  const cells = [...Array(leading).fill(null), ...days];

  const usedTypes = [...new Set(days.map(d => d.type))].filter(t => DAY_TYPE[t]);
  const hasPunchData = days.some(d => d.checkIn || d.checkOut || d.sessions?.length);

  return (
    <>
      {/* Tiêu đề — ẩn được khi component nằm trong Modal đã có tiêu đề riêng */}
      {showHeader && (
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/5">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-[#C9A84C]" />
            <h3 className="text-sm font-bold text-[#1C1C1E]">Chi tiết ngày công</h3>
          </div>
          <span className="text-xs font-semibold text-[#8E8878]">
            {fmtNum(attendance.actualDays)} / {fmtNum(attendance.standardDays)} công
          </span>
        </div>
      )}

      <div className="p-4 sm:p-5">
        <div className="grid lg:grid-cols-[auto_1fr] gap-5 lg:gap-8 lg:items-stretch">

          {/* CỘT TRÁI — lưới lịch + chú thích */}
          <div>
            {hasPunchData && (
              <p className="text-[11px] text-[#8E8878] mb-3 lg:hidden">
                Bấm vào một ngày để xem giờ chấm công vào / ra (tối đa 3 lượt).
              </p>
            )}

            <div className="grid grid-cols-[repeat(7,44px)] gap-1.5 mb-1.5">
              {[2, 3, 4, 5, 6, 7, 8].map(w => (
                <div key={w} className="text-center text-[10px] font-bold text-[#8E8878]">
                  {WEEKDAY_LABEL[w]}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-[repeat(7,44px)] gap-1.5">
              {cells.map((d, i) => {
                if (!d) return <div key={`empty-${i}`} />;
                const cfg = DAY_TYPE[d.type] || DAY_TYPE.OFF;
                const isSelected = selected?.day === d.day;
                const clickable = !!(d.checkIn || d.checkOut || d.sessions?.length || d.value > 0);

                return (
                  <button key={d.day}
                    onClick={() => setSelected(isSelected ? null : d)}
                    title={`Ngày ${d.day} · ${cfg.label}`
                      + (d.checkIn ? ` · ${d.checkIn}–${d.checkOut || '--:--'}` : '')}
                    className={`h-11 rounded-lg border flex items-center justify-center
                      text-[12px] font-bold leading-none transition-all ${cfg.cls}
                      ${clickable ? 'hover:scale-110 cursor-pointer' : 'cursor-default'}
                      ${isSelected ? 'ring-2 ring-[#C9A84C] ring-offset-1 scale-110' : ''}`}
                  >
                    {d.day}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4 pt-4 border-t border-black/5
              max-w-[340px]">
              {usedTypes.map(t => {
                const cfg = DAY_TYPE[t];
                return (
                  <div key={t} className="flex items-center gap-1.5">
                    <span className={`w-3.5 h-3.5 rounded-md border ${cfg.cls}`} />
                    <span className="text-[11px] text-[#8E8878] font-medium">{cfg.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* CỘT PHẢI — chi tiết ngày đang chọn / placeholder */}
          <div className="min-w-0 lg:h-full lg:min-h-[300px]">
            {selected ? (
              <DayDetail day={selected} month={month} year={year}
                onClose={() => setSelected(null)} />
            ) : (
              <DayDetailPlaceholder description={hasPunchData
                ? 'Bấm vào ô ngày bên trái để xem giờ vào / ra, số công ghi nhận và ghi chú của ngày đó.'
                : 'Tháng này chưa có dữ liệu chấm công chi tiết. Bấm vào một ngày để xem thông tin hiện có.'} />
            )}
          </div>
        </div>

        {/* Tổng kết */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-5 pt-5 border-t border-black/5">
          {[
            { label: 'Công chuẩn', value: fmtNum(attendance.standardDays), color: 'text-[#1C1C1E]' },
            {
              label: 'Tổng công tháng', value: fmtNum(attendance.actualDays), color: 'text-emerald-600',
              sub: `${attendance.presentDays ?? 0} ngày có chấm công`
            },
            {
              label: 'Tổng phút đi trễ', value: (attendance.lateMinutes ?? 0).toLocaleString('vi-VN'),
              color: 'text-amber-600', sub: `${attendance.lateCount ?? 0} ngày`
            },
            {
              label: 'Tổng phút về sớm', value: (attendance.earlyMinutes ?? 0).toLocaleString('vi-VN'),
              color: 'text-blue-600', sub: `${attendance.earlyCount ?? 0} ngày`
            },
          ].map(st => (
            <div key={st.label} className="bg-[#FAF7F2] rounded-xl px-3 py-2.5">
              <p className="text-[11px] text-[#8E8878] font-medium">{st.label}</p>
              <p className={`text-lg font-bold mt-0.5 leading-tight ${st.color}`}>{st.value}</p>
              {st.sub && <p className="text-[10px] text-[#8E8878] mt-0.5">{st.sub}</p>}
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[11px] text-[#8E8878]">
          {attendance.shiftStart && (
            <span>Ca chuẩn: <strong className="text-[#1C1C1E]">
              {attendance.shiftStart}–{attendance.shiftEnd}</strong></span>
          )}
          {attendance.employeeCode && (
            <span>Mã chấm công: <strong className="text-[#1C1C1E]">{attendance.employeeCode}</strong></span>
          )}
        </div>
      </div>
    </>
  );
}