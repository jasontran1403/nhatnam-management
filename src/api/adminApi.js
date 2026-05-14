// src/api/adminApi.js
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

// ─── Dashboard ───────────────────────────────────────────────────────────────
export const adminDashboardApi = {
  getStats: (from, to) =>
    api.get('/api/admin/dashboard/stats', { params: { from, to } }).then(r => r.data?.data ?? r.data),
  getTopProducts: (limit = 10, from, to, sortBy = 'revenue') =>
    api.get('/api/admin/dashboard/top-products', { params: { limit, from, to, sortBy } }).then(r => r.data?.data ?? r.data),
  getTopSellers: (limit = 10, from, to, sortBy = 'revenue') =>
    api.get('/api/admin/dashboard/top-sellers', { params: { limit, from, to, sortBy } }).then(r => r.data?.data ?? r.data),
  getTopCustomers: (limit = 10, from, to) =>
    api.get('/api/admin/dashboard/top-customers', { params: { limit, from, to } }).then(r => r.data?.data ?? r.data),
};

// ─── Orders ──────────────────────────────────────────────────────────────────
export const adminOrderApi = {
  list: (params) => api.get('/api/admin/orders', { params }).then(unwrap),
  getById: (id) => api.get(`/api/admin/orders/${id}`).then(unwrap),
  cancel: (id, reason) => api.post(`/api/admin/orders/${id}/cancel`, { reason }).then(unwrap),
  extendDeadline: (orderId, days) =>
    api.put(`/api/admin/orders/${orderId}/extend-deadline`, null, { params: { days } }).then(unwrap),
  exportOrders: (params) =>
    api.get('/api/admin/orders/export', { params, responseType: 'blob' }),
};

// ─── Customers ───────────────────────────────────────────────────────────────
export const adminCustomerApi = {
  list: (params) => api.get('/api/admin/customers', { params }).then(unwrap),
  getById: (id) => api.get(`/api/admin/customers/${id}`).then(unwrap),
  updateDiscount: (id, discountRate) => api.put(`/api/admin/customers/${id}/discount`, { discountRate }).then(unwrap),
  bulkDiscount: (customerIds, discountRate) => api.put('/api/admin/customers/bulk-discount', { customerIds, discountRate }).then(unwrap),
  setActive: (id, value) => api.put(`/api/admin/customers/${id}/active`, null, { params: { value } }).then(unwrap),
  bulkSetActive: (customerIds, isActive) => api.put('/api/admin/customers/bulk-active', { customerIds, isActive }).then(unwrap),
  updateDebtDays: (id, days) => api.put(`/api/admin/customers/${id}/debt-days`, null, { params: { days } }).then(unwrap),
  getOrderHistory: (customerId) => api.get(`/api/admin/customers/${customerId}/orders`).then(unwrap),
};

// ─── Users ───────────────────────────────────────────────────────────────────
export const adminUserApi = {
  list: (params) => api.get('/api/admin/users', { params }).then(unwrap),
  getById: (id) => api.get(`/api/admin/users/${id}`).then(unwrap),
  create: (data) => api.post('/api/admin/users', data).then(unwrap),
  update: (id, data) => api.put(`/api/admin/users/${id}`, data).then(unwrap),
  setLocked: (id, value) => api.put(`/api/admin/users/${id}/lock`, null, { params: { value } }).then(unwrap),
  resetPassword: (id, newPassword) => api.put(`/api/admin/users/${id}/reset-password`, { newPassword }).then(unwrap),
};

// ─── Warehouses ──────────────────────────────────────────────────────────────
export const adminWarehouseApi = {
  list: () => api.get('/api/admin/warehouses').then(unwrap),
  getById: (id) => api.get(`/api/admin/warehouses/${id}`).then(unwrap),
  create: (data) => api.post('/api/admin/warehouses', data).then(unwrap),
  update: (id, data) => api.put(`/api/admin/warehouses/${id}`, data).then(unwrap),
  setActive: (id, value) => api.put(`/api/admin/warehouses/${id}/active`, null, { params: { value } }).then(unwrap),
};

// ─── Ingredients ─────────────────────────────────────────────────────────────
export const adminIngredientApi = {
  listByWarehouse: (warehouseId, q) => api.get('/api/admin/ingredients', { params: { warehouseId, q } }).then(unwrap),
  getDefaultWarehouse: () => api.get('/api/admin/ingredients/default-warehouse').then(unwrap),
};