// src/api/factoryPayrollApi.js
// API "Quản lý lương" — dùng chung cho MỌI bộ phận.
import api from './axios';

const r = (res) => res.data?.data ?? res.data;

/** 5 bộ phận tính lương — khớp với enum PayrollDepartment bên backend. */
export const PAYROLL_DEPARTMENTS = [
  { code: 'FACTORY',    label: 'Xưởng sản xuất', attendanceBased: true,  hasKpiBonus: true  },
  { code: 'SALES',      label: 'Kinh doanh',     attendanceBased: true,  hasKpiBonus: false },
  { code: 'WAREHOUSE',  label: 'Kho',            attendanceBased: true,  hasKpiBonus: false },
  { code: 'ACCOUNTING', label: 'Kế toán',        attendanceBased: true,  hasKpiBonus: false },
  { code: 'DRIVER',     label: 'Tài xế',         attendanceBased: false, hasKpiBonus: false },
];

export const factoryPayrollApi = {
  // ── Nhân viên ──────────────────────────────────────────────────────────────

  /** Bộ phận + role nhận lương của tài khoản đang đăng nhập */
  me: () => api.get('/api/factory-payroll/me').then(r),

  /** Tháng có thể chọn — CHỈ các THÁNG ĐÃ QUA. [{month,year,label,attendanceReady,finalized}] */
  periods: () => api.get('/api/factory-payroll/periods').then(r),

  /**
   * Phiếu lương của chính mình cho 1 tháng.
   * status: PROCESSING (chưa Hoàn tất) | NO_SALARY | NO_DEPARTMENT | READY
   */
  myPayslip: (month, year) =>
    api.get('/api/factory-payroll/my-payslip', { params: { month, year } }).then(r),

  // ── Quản trị ───────────────────────────────────────────────────────────────

  /** Danh sách bộ phận kèm số nhân viên */
  departments: () => api.get('/api/factory-payroll/departments').then(r),

  listSheets: (department) =>
    api.get('/api/factory-payroll/sheets', { params: { department } }).then(r),

  uploadablePeriods: (department = 'FACTORY') =>
    api.get('/api/factory-payroll/sheets/periods', { params: { department } }).then(r),

  monthStatus: (month, year, department = 'FACTORY') =>
    api.get('/api/factory-payroll/sheets/status', { params: { month, year, department } }).then(r),

  /** Trạng thái của CẢ 5 bộ phận trong 1 tháng — dựng tab bar 1 lần */
  monthStatusAll: (month, year) =>
    api.get('/api/factory-payroll/sheets/status-all', { params: { month, year } }).then(r),

  // ── Upload 3 loại file (theo bộ phận) ──────────────────────────────────────

  uploadSheet: (file, month, year, department = 'FACTORY') => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post('/api/factory-payroll/sheets/upload', fd, {
      params: { month, year, department },
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r);
  },

  uploadExceptions: (file, month, year, department = 'FACTORY') => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post('/api/factory-payroll/exceptions/upload', fd, {
      params: { month, year, department },
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r);
  },

  uploadLeaves: (file, month, year, department = 'FACTORY') => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post('/api/factory-payroll/leaves/upload', fd, {
      params: { month, year, department },
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r);
  },

  /** Xoá file của tháng. kind: 'attendance' | 'exception' | 'leave' */
  deleteFile: (kind, month, year, department = 'FACTORY') =>
    api.delete(`/api/factory-payroll/files/${kind}`, {
      params: { month, year, department },
    }).then(r),

  // ── Hoàn tất / mở lại ──────────────────────────────────────────────────────

  /** OWNER bấm "Hoàn tất" → nhân viên bộ phận đó xem được phiếu lương */
  finalize: (month, year, department = 'FACTORY') =>
    api.post('/api/factory-payroll/finalize', null, {
      params: { month, year, department },
    }).then(r),

  /** Mở lại tháng đã hoàn tất */
  reopen: (month, year, department = 'FACTORY') =>
    api.post('/api/factory-payroll/reopen', null, {
      params: { month, year, department },
    }).then(r),

  // ── 2 bảng OWNER xem sau khi Hoàn tất ─────────────────────────────────────

  /** { rows: [...], totalNetSalary, ... } — Phiếu lương + Chi tiết ngày công */
  departmentPayroll: (month, year, department = 'FACTORY') =>
    api.get('/api/factory-payroll/department-payroll', {
      params: { month, year, department },
    }).then(r),

  /** Chi tiết ngày công của 1 nhân viên (OWNER bấm vào 1 dòng) */
  employeeAttendance: (userId, month, year) =>
    api.get('/api/factory-payroll/employee-attendance', {
      params: { userId, month, year },
    }).then(r),

  /** Số km theo ngày của 1 tài xế (OWNER bấm vào 1 dòng) */
  employeeDriver: (userId, month, year) =>
    api.get('/api/factory-payroll/employee-driver', {
      params: { userId, month, year },
    }).then(r),

  // ── Thưởng & phụ cấp theo tháng (import Excel) ────────────────────────────

  /** { bonus: n, allowance: n } — số dòng đã import của kỳ */
  adjustmentStatus: (month, year) =>
    api.get('/api/factory-payroll/adjustments/status', { params: { month, year } }).then(r),

  uploadBonus: (file, month, year) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post('/api/factory-payroll/bonus/upload', fd, {
      params: { month, year },
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r);
  },

  uploadAllowance: (file, month, year) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post('/api/factory-payroll/allowance/upload', fd, {
      params: { month, year },
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r);
  },

  /** type: 'BONUS' | 'ALLOWANCE' */
  clearAdjustments: (type, month, year) =>
    api.delete(`/api/factory-payroll/adjustments/${type}`, { params: { month, year } }).then(r),

  /** Danh sách các KHOẢN thưởng đã có trong kỳ — mỗi khoản một nhãn riêng. */
  /** Danh sách nhân sự của bộ phận — modal "Chi tiết bộ phận". */
  departmentMembers: (department) =>
    api.get(`/api/factory-payroll/departments/${department}/members`).then(r),

  bonusBatches: (month, year) =>
    api.get('/api/factory-payroll/adjustments/bonus/batches', { params: { month, year } }).then(r),

  /** Xoá ĐÚNG MỘT khoản thưởng, các khoản khác của cùng tháng không bị đụng. */
  clearBonusLabel: (month, year, label) =>
    api.delete('/api/factory-payroll/adjustments/bonus', { params: { month, year, label } }).then(r),

  // ── File mẫu ───────────────────────────────────────────────────────────────

  /** kind: 'exception' | 'leave' | 'bonus' | 'allowance' */
  downloadTemplate: async (kind, month, year, department = 'FACTORY') => {
    const res = await api.get(`/api/factory-payroll/templates/${kind}`, {
      params: { month, year, department },
      responseType: 'blob',
    });
    const mm = String(month).padStart(2, '0');
    const PREFIX = {
      exception: 'lich-nghi',
      leave: 'don-xin-nghi',
      bonus: 'thuong',
      allowance: 'phu-cap',
    };
    const name = `${PREFIX[kind] || kind}-${department}-${mm}-${year}.xlsx`;
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click();
    a.remove(); window.URL.revokeObjectURL(url);
  },

  // ── KPI (chỉ bộ phận Xưởng) ───────────────────────────────────────────────

  kpi: (month, year) =>
    api.get('/api/factory-payroll/kpi', { params: { month, year } }).then(r),

  /**
   * Tính lại thưởng KPI xưởng.
   * securityRate = mức thưởng cố định cho MỘT bảo vệ xưởng. Bỏ trống thì backend
   * giữ nguyên mức đã dùng cho tháng đó (đừng gửi 0 nếu chỉ muốn giữ nguyên).
   */
  recomputeKpi: (month, year, securityRate) =>
    api.post('/api/factory-payroll/kpi/recompute', null, {
      params: { month, year, ...(securityRate != null ? { securityRate } : {}) },
    }).then(r),
};

export default factoryPayrollApi;