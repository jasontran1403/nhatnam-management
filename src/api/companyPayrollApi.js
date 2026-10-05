// src/api/companyPayrollApi.js
//
// API "Tính lương cả công ty" — Phase 3 (FE) song hành với refactor BE Phase 2.
//
// Thay thế dần cho các endpoint per-department ở /api/factory-payroll/sheets/*.
// 5 bộ phận (FACTORY / ACCOUNTING / SALES / WAREHOUSE / DRIVER) nay dùng
// CHUNG 1 file chấm công, 1 lifecycle UPLOADED → CALCULATED → PUBLISHED.
import api from './axios';

const r = (res) => res.data?.data ?? res.data;

/**
 * Trạng thái tháng + flags enable/disable các nút (canCalculate, canPublish,
 * canUnpublish, canReopen, canUploadAdjustments). FE chỉ cần đọc các cờ này
 * để dựng nút — không tự tính logic lifecycle.
 *
 * Response shape:
 * {
 *   month, year,
 *   calcStatus: 'NONE' | 'UPLOADED' | 'CALCULATED' | 'PUBLISHED',
 *   hasAttendanceFile, hasExceptionFile, hasLeaveFile,
 *   attendanceFileName, exceptionFileName, leaveFileName,
 *   attendanceUploadedAt, exceptionUploadedAt, leaveUploadedAt,
 *   calculatedAt, calculatedByName, publishedAt, publishedByName,
 *   otTotalWeekdayMinutes, otTotalSundayMinutes, otTotalHolidayMinutes, otTotalAmount,
 *   canUploadAttendance, canUploadAdjustments, canCalculate, canPublish,
 *   canUnpublish, canReopen,
 *   bonusLineCount, allowanceLineCount, parsedRows
 * }
 */
export const companyPayrollApi = {
  // ── TRẠNG THÁI ────────────────────────────────────────────────────────────

  status: (month, year) =>
    api.get('/api/company-payroll/status', { params: { month, year } }).then(r),

  // ── UPLOAD FILE ───────────────────────────────────────────────────────────

  /** Upload file chấm công chung của cả công ty cho 1 tháng. */
  uploadAttendance: (file, month, year) => {
    const fd = new FormData();
    fd.append('file', file);
    return api
      .post('/api/company-payroll/attendance/upload', fd, {
        params: { month, year },
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then(r);
  },

  /** Upload file lịch nghỉ / đi trễ / về sớm (chỉ khi NONE/UPLOADED). */
  uploadException: (file, month, year) => {
    const fd = new FormData();
    fd.append('file', file);
    return api
      .post('/api/company-payroll/exception/upload', fd, {
        params: { month, year },
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then(r);
  },

  /**
   * Phase 7 (10/2026): "Đơn xin nghỉ phép" đã bị gỡ khỏi UI — nhân viên tự
   * tạo phiếu qua MyRequestsPage. Hàm uploadLeave giữ cho backend compat nếu
   * còn code gọi, nhưng không được gọi ở panel chung nữa.
   * @deprecated
   */
  uploadLeave: (file, month, year) => {
    const fd = new FormData();
    fd.append('file', file);
    return api
      .post('/api/company-payroll/leave/upload', fd, {
        params: { month, year },
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then(r);
  },

  // ── PHASE 7: Upload THƯỞNG + PHỤ CẤP chung cho cả công ty ──────────────
  //   Thay thế các endpoint per-department ở /api/factory-payroll/bonus/upload
  //   và /api/factory-payroll/allowance/upload. BE phân bổ về nhân viên dựa
  //   trên role/mã nhân viên có trong file.

  uploadBonus: (file, month, year) => {
    const fd = new FormData();
    fd.append('file', file);
    return api
      .post('/api/company-payroll/bonus/upload', fd, {
        params: { month, year },
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then(r);
  },

  uploadAllowance: (file, month, year) => {
    const fd = new FormData();
    fd.append('file', file);
    return api
      .post('/api/company-payroll/allowance/upload', fd, {
        params: { month, year },
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then(r);
  },

  /** Xoá 1 trong 3 file: kind = 'ATTENDANCE' | 'EXCEPTION' | 'LEAVE' */
  deleteFile: (kind, month, year) =>
    api.delete(`/api/company-payroll/files/${kind}`, { params: { month, year } }).then(r),

  // ── VÒNG ĐỜI ──────────────────────────────────────────────────────────────

  /** UPLOADED → CALCULATED. Tính OT cho toàn bộ nhân viên. */
  calculate: (month, year) =>
    api.post('/api/company-payroll/calculate', null, { params: { month, year } }).then(r),

  /** CALCULATED → PUBLISHED. Nhân viên bắt đầu thấy phiếu lương. */
  publish: (month, year) =>
    api.post('/api/company-payroll/publish', null, { params: { month, year } }).then(r),

  /** PUBLISHED → CALCULATED. Ẩn phiếu lương khỏi nhân viên. */
  unpublish: (month, year) =>
    api.post('/api/company-payroll/unpublish', null, { params: { month, year } }).then(r),

  /** CALCULATED → UPLOADED. Xoá OT auto, cho phép upload adjustment trở lại. */
  reopen: (month, year) =>
    api.post('/api/company-payroll/reopen', null, { params: { month, year } }).then(r),

  // ── PHASE 4: KPI xưởng lifecycle ────────────────────────────────────────
  kpiCalculate:  (m, y) => api.post('/api/company-payroll/kpi/calculate', null, { params: { month: m, year: y } }).then(r),
  kpiPublish:    (m, y) => api.post('/api/company-payroll/kpi/publish',   null, { params: { month: m, year: y } }).then(r),
  kpiUnpublish:  (m, y) => api.post('/api/company-payroll/kpi/unpublish', null, { params: { month: m, year: y } }).then(r),
  kpiReopen:     (m, y) => api.post('/api/company-payroll/kpi/reopen',    null, { params: { month: m, year: y } }).then(r),

  // ── PHASE 4: Thưởng DT (Sales/Accounting) lifecycle ─────────────────────
  bonusCalculate: (m, y) => api.post('/api/company-payroll/bonus/calculate', null, { params: { month: m, year: y } }).then(r),
  bonusPublish:   (m, y) => api.post('/api/company-payroll/bonus/publish',   null, { params: { month: m, year: y } }).then(r),
  bonusUnpublish: (m, y) => api.post('/api/company-payroll/bonus/unpublish', null, { params: { month: m, year: y } }).then(r),
  bonusReopen:    (m, y) => api.post('/api/company-payroll/bonus/reopen',    null, { params: { month: m, year: y } }).then(r),

  // ── PHASE 6: Chuyên cần — matrix đi trễ / về sớm theo ngày ──────────────
  /**
   * Response shape:
   * {
   *   month, year, daysInMonth,
   *   sundays: [bool x daysInMonth],
   *   holidays: [bool x daysInMonth],
   *   employees: [{
   *     userId, fullName, roleLabel, department, sortOrder,
   *     days: [{
   *       day, inDelta, outDelta, present, sunday, holiday, defaultedOut, leave
   *     }],
   *     totalLateMinutes, totalEarlyLeaveMinutes
   *   }]
   * }
   *
   * Delta rules:
   *   inDelta  > 0 → đi trễ (phút sau 8:00) — ĐỎ
   *   inDelta  < 0 → đi sớm (phút trước 8:00) — XANH DƯƠNG
   *   inDelta  = 0 → đúng giờ (có du di 5') — XANH LÁ
   *   outDelta > 0 → về sớm (phút trước 17:00) — ĐỎ
   *   outDelta < 0 → về trễ (phút sau 17:00) — XANH DƯƠNG
   *   outDelta = 0 → đúng giờ — XANH LÁ
   */
  attendanceDetail: (m, y) =>
    api.get('/api/company-payroll/attendance-detail', { params: { month: m, year: y } }).then(r),
};

/**
 * Nhãn tiếng Việt cho trạng thái vòng đời — dùng chung trên FE.
 */
export const CALC_STATUS_LABEL = {
  NONE: 'Chưa có file chấm công',
  UPLOADED: 'Đã có file chấm công',
  CALCULATED: 'Đã tính lương',
  PUBLISHED: 'Đã Public',
};

/** Màu badge trạng thái — tailwind utility. */
export const CALC_STATUS_COLOR = {
  NONE: 'bg-canvas text-muted border-hairline-2',
  UPLOADED: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300',
  CALCULATED: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300',
  PUBLISHED: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300',
};