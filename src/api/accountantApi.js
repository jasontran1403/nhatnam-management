// src/api/accountantApi.js
import api from './axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

export const getImageUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${BASE_URL}/api/auth${path}`;
};

const unwrap = (res) => {
  const body = res?.data;
  if (body && typeof body === 'object' && 'success' in body) {
    if (!body.success) throw new Error(body.message || 'Request failed');
    return body.data;
  }
  return body;
};

// ─── Dashboard ────────────────────────────────────────────────────────────────
export const accountantDashboardApi = {
  getSummary: (from, to) =>
    api.get('/api/accountant/dashboard/summary', { params: { from, to } }).then(unwrap),

  getChart: (from, to, groupBy = 'DAY') =>
    api.get('/api/accountant/dashboard/chart', { params: { from, to, groupBy } }).then(unwrap),

  getTopProducts: (from, to, limit = 10) =>
    api.get('/api/accountant/dashboard/top-products', { params: { from, to, limit } }).then(unwrap),

  getTopSellers: (from, to, limit = 10) =>
    api.get('/api/accountant/dashboard/top-sellers', { params: { from, to, limit } }).then(unwrap),

  getTopCustomers: (from, to, limit = 10) =>
    api.get('/api/accountant/dashboard/top-customers', { params: { from, to, limit } }).then(unwrap),

  getDebtStats: (from, to) =>
    api.get('/api/accountant/dashboard/debt-stats', { params: { from, to } }).then(unwrap),
};

// ─── Orders ───────────────────────────────────────────────────────────────────
export const accountantOrderApi = {
  list: (params) => api.get('/api/accountant/orders', { params }).then(unwrap),

  getPendingPayment: (params) =>
    api.get('/api/accountant/orders/pending-payment', { params }).then(unwrap),

  markPendingPayment: (id) =>
    api.patch(`/api/accountant/orders/${id}/pending-payment`).then(unwrap),

  markCompleted: (id) =>
    api.patch(`/api/accountant/orders/${id}/complete`).then(unwrap),

  updatePayment: (id, body) =>
    api.patch(`/api/accountant/orders/${id}/payment`, body).then(unwrap),

  updateStatus: (id, status) =>
    api.patch(`/api/accountant/orders/${id}/status`, { status }).then(unwrap),

  recordPartialPayment: (id, paidAmount, debtDays) =>
    api.patch(`/api/accountant/orders/${id}/partial-payment`, { paidAmount, debtDays }).then(unwrap),

  waiveRemainder: (id, data) =>
    api.patch(`/api/accountant/orders/${id}/waive-remainder`, data),
};

// ─── Customers ────────────────────────────────────────────────────────────────
export const accountantCustomerApi = {
  list: (params) => api.get('/api/accountant/customers', { params }).then(unwrap),

  getOrders: (customerId) =>
    api.get(`/api/accountant/customers/${customerId}/orders`).then(unwrap),
};

// ─── Feature 1: Nhà cung cấp (Supplier) ──────────────────────────────────────
export const accountantSupplierApi = {
  /** Danh sách đầy đủ (dùng cho dropdown) */
  list: () => api.get('/api/accountant/suppliers/list'),

  /** Tìm kiếm / phân trang */
  search: (params) => api.get('/api/accountant/suppliers', { params }),

  create: (data) => api.post('/api/accountant/suppliers', data),

  update: (id, data) => api.put(`/api/accountant/suppliers/${id}`, data),

  deactivate: (id) => api.delete(`/api/accountant/suppliers/${id}`),
};

// ─── Feature 2: Phiếu nhập kho chờ giá vốn ───────────────────────────────────
export const accountantWarehouseApi = {
  /** Danh sách phiếu nhập chờ nhập giá vốn */
  getPendingCost: () => api.get('/api/accountant/warehouse-receipts/pending-cost'),

  /** Chi tiết phiếu (kèm items) */
  getDetail: (id) => api.get(`/api/accountant/warehouse-receipts/${id}`),

  /** Xác nhận giá vốn + cộng tồn kho */
  confirmCost: (id, data) =>
    api.post(`/api/accountant/warehouse-receipts/${id}/confirm-cost`, data),
};
