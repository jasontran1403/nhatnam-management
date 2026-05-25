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
  list:       (params)      => api.get('/api/hr/salaries', { params }).then(r),
  approve:    (id)          => api.put(`/api/hr/salaries/${id}/approve`).then(r),
  reject:     (id, data)    => api.put(`/api/hr/salaries/${id}/reject`, data).then(r),
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

// ── Payslip ───────────────────────────────────────────────────────────────────
export const hrPayslipApi = {
  get: (userId) => api.get(`/api/hr/payslip/${userId}`).then(r),
};
