// src/api/hrApi.js
import api from './axios';

const r = (res) => res.data?.data ?? res.data;

// ── Employee info ─────────────────────────────────────────────────────────────
export const hrEmployeeApi = {
  updateInfo: (userId, data) =>
    api.put(`/api/hr/employees/${userId}/info`, data).then(r),
};

// ── Salary ────────────────────────────────────────────────────────────────────
export const hrSalaryApi = {
  set:        (data)        => api.post('/api/hr/salaries', data).then(r),
  setBatch:   (data)        => api.post('/api/hr/salaries/batch', data).then(r),
  preview:    (data)        => api.post('/api/hr/salaries/preview', data).then(r),
  list:       (params)      => api.get('/api/hr/salaries', { params }).then(r),
  getCurrent: (userId)      => api.get(`/api/hr/salaries/current/${userId}`).then(res => {
    const body = res.data?.data ?? res.data;
    return (body && typeof body === 'object') ? body : null;
  }),
  listCurrent:()             => api.get('/api/hr/salaries/current').then(r),
  getBreakdown:()            => api.get('/api/hr/salaries/breakdown').then(r),
  approve:    (id)          => api.put(`/api/hr/salaries/${id}/approve`).then(r),
  bulkApprove:(salaryIds)   => api.put('/api/hr/salaries/bulk-approve', { salaryIds }).then(r),
  reject:     (id, data)    => api.put(`/api/hr/salaries/${id}/reject`, data).then(r),
  exportAll:  (params)      => api.get('/api/hr/salaries/export', { params, responseType: 'blob' }),
  importAll:  (file) => {
    const fd = new FormData(); fd.append('file', file);
    return api.post('/api/hr/salaries/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
};

// ── Allowance labels (danh mục nhãn phụ cấp) ───────────────────────────────────
export const allowanceLabelApi = {
  list:   ()      => api.get('/api/hr/allowance-labels').then(r),
  create: (name)  => api.post('/api/hr/allowance-labels', { name }).then(r),
};

// ── Employees (list for HR manage page) ────────────────────────────────────────
export const hrEmployeesListApi = {
  list: () => api.get('/api/hr/employees').then(r),
};

// ── Leave ─────────────────────────────────────────────────────────────────────
export const hrLeaveApi = {
  create: (data)       => api.post('/api/hr/leaves', data).then(r),
  list:   (params)     => api.get('/api/hr/leaves', { params }).then(r),
  get:    (id)         => api.get(`/api/hr/leaves/${id}`).then(r),
};

// ── Overtime ──────────────────────────────────────────────────────────────────
export const hrOtApi = {
  create: (data)       => api.post('/api/hr/overtimes', data).then(r),
  list:   (params)     => api.get('/api/hr/overtimes', { params }).then(r),
  get:    (id)         => api.get(`/api/hr/overtimes/${id}`).then(r),
};

// ── Payroll (Tính lương hàng tháng) ─────────────────────────────────────────────
export const payrollApi = {
  // Tạo phiếu lương tháng + export Excel (trả về blob để download)
  createAndExport: (month, year) =>
    api.get('/api/hr/payroll/export', { params: { month, year }, responseType: 'blob' }),
  // Import file đã điền → tính lương
  importBatch: (file) => {
    const fd = new FormData(); fd.append('file', file);
    return api.post('/api/hr/payroll/batches/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  listBatches: (params)      => api.get('/api/hr/payroll/batches', { params }).then(r),
  getBatch:    (id)          => api.get(`/api/hr/payroll/batches/${id}`).then(r),
  getPayslips: (id)          => api.get(`/api/hr/payroll/batches/${id}/payslips`).then(r),
  getMyPayslips: (userId)    => api.get('/api/hr/payroll/my-payslips', { params: { userId } }).then(r),
  approveBatch: (id)         => api.put(`/api/hr/payroll/batches/${id}/approve`).then(r),
  rejectBatch:  (id, data)   => api.put(`/api/hr/payroll/batches/${id}/reject`, data).then(r),
  // Tải file phiếu lương chi tiết (sau khi Owner duyệt) — trả blob
  downloadPayslips: (id)     => api.get(`/api/hr/payroll/batches/${id}/download`, { responseType: 'blob' }),
};