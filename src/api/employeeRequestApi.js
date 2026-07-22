// src/api/employeeRequestApi.js
// Phiếu nghỉ / đi trễ / về sớm / công tác / quên chấm công.
//
// Backend nhận và trả ngày dưới dạng chuỗi ISO "YYYY-MM-DD" (LocalTime là "HH:mm"),
// trong khi các picker của dự án làm việc bằng epoch ms. Hai helper dưới đây là
// ranh giới quy đổi — mọi chỗ khác chỉ dùng một trong hai dạng, không trộn lẫn.
import api from './axios';

const r = (res) => res.data?.data ?? res.data;

/** epoch ms (giờ máy người dùng) → "YYYY-MM-DD", giữ nguyên NGÀY THEO LỊCH. */
export const msToIsoDate = (ms) => {
  if (ms == null) return null;
  const d = new Date(Number(ms));
  // Tự ghép từ các getter local thay vì toISOString(): toISOString() đổi sang UTC
  // nên ở múi giờ +07 mọi mốc trước 07:00 sẽ bị lùi mất một ngày.
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** "YYYY-MM-DD" → epoch ms tại 00:00 giờ địa phương. */
export const isoDateToMs = (iso) => {
  if (!iso) return null;
  const [y, m, d] = String(iso).split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
};

export const employeeRequestApi = {
  // ── Nhân viên ──────────────────────────────────────────────────────────────

  /** Loại phiếu + giới hạn lịch (minDate/maxDate đã tính sẵn theo giờ VN). */
  formConfig: () => api.get('/api/employee-requests/form-config').then(r),

  /**
   * Tạo phiếu.
   * body: { type, fromDate, toDate, fromTime, toTime, minutes, reason }
   * — fromDate/toDate là chuỗi ISO, fromTime/toTime là "HH:mm".
   */
  create: (body) => api.post('/api/employee-requests', body).then(r),

  mine: (params) => api.get('/api/employee-requests/mine', { params }).then(r),

  cancel: (id) => api.delete(`/api/employee-requests/${id}`).then(r),

  detail: (id) => api.get(`/api/employee-requests/${id}`).then(r),

  // ── OWNER / ADMIN ──────────────────────────────────────────────────────────

  /** params: { department, status, from, to, page, size } */
  search: (params) => api.get('/api/employee-requests', { params }).then(r),

  summary: (department) =>
    api.get('/api/employee-requests/summary', { params: { department } }).then(r),

  statuses: () => api.get('/api/employee-requests/statuses').then(r),

  /**
   * Ba thao tác của OWNER.
   *   approve(id, true)        → duyệt, nghỉ có lương
   *   approve(id, false)       → duyệt, nghỉ không lương
   *   deduct(id, 0.1)          → duyệt nhưng trừ 0.1 công
   *   reject(id, 'lý do…')     → từ chối
   */
  decide: (id, body) => api.post(`/api/employee-requests/${id}/decide`, body).then(r),

  approve: (id, paid, note) =>
    api.post(`/api/employee-requests/${id}/decide`,
      { action: 'APPROVE', paid, note }).then(r),

  deduct: (id, deductedDays, note) =>
    api.post(`/api/employee-requests/${id}/decide`,
      { action: 'DEDUCT', deductedDays, note }).then(r),

  reject: (id, note) =>
    api.post(`/api/employee-requests/${id}/decide`,
      { action: 'REJECT', note }).then(r),
};

export default employeeRequestApi;