// src/api/warehouseApi.js
import api from './axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
const BASE = '/api/warehouse';

export const getImageUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${BASE_URL}/api/auth${path}`;
};

export const warehouseApi = {
  // ── Kho ──────────────────────────────────────────────────────────────────
  getAll: () => api.get(BASE),
  create: (data) => api.post(BASE, data),
  update: (id, data) => api.put(`${BASE}/${id}`, data),

  getOrders: (params) => api.get('/api/warehouse/orders/preparing', { params }),
  getOrderDetail: (id) => api.get(`/api/accountant/orders/${id}/detail`),
  getOrderLogs: (id) => api.get(`/api/accountant/orders/${id}/logs`),
  markDelivering: (id) => api.patch(`/api/warehouse/orders/${id}/deliver`),
  uploadReceiptFile: (id, formData) =>
    api.patch(`/api/accountant/orders/${id}/receipt-file`, formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }),


  // ── Categories & SubCategories ────────────────────────────────────────────
  getCategories: () => api.get(`${BASE}/categories`),
  getAllSubCategories: () => api.get(`${BASE}/subcategories`),

  // ── Nguyên liệu ───────────────────────────────────────────────────────────
  getIngredients: () => api.get(`${BASE}/all-ingredients`),

  // ── Tồn kho ───────────────────────────────────────────────────────────────
  getStock: (warehouseId) => api.get(`${BASE}/${warehouseId}/stock`),

  // ── Thao tác — luôn gửi warehouseId trong body ───────────────────────────
  import: (data) => api.post(`${BASE}/import`, data),
  export: (data) => api.post(`${BASE}/export`, data),
  transfer: (data) => api.post(`${BASE}/transfer`, data),
  adjust: (data) => api.post(`${BASE}/adjust`, data),

  // ── Lịch sử — gửi warehouseId qua query param ────────────────────────────
  getHistory: (tab, warehouseId, page = 0, size = 20, extra = {}) =>
    api.get(`${BASE}/history`, {
      params: { tab, warehouseId: warehouseId || undefined, page, size, ...extra },
    }),
  getReceiptDetail: (id) => api.get(`${BASE}/receipt/${id}`),

  // ── Orders — gửi warehouseId qua query param ─────────────────────────────
  getPreparingOrders: (warehouseId) =>
    api.get(`${BASE}/orders/preparing`, {
      params: { warehouseId: warehouseId || undefined },
    }),
  markDelivering: (id) => api.patch(`${BASE}/orders/${id}/deliver`),
  cancelOrder: (id, reason) => api.patch(`${BASE}/orders/${id}/cancel`, { reason }),
  getInvoice: (id) => api.get(`${BASE}/orders/${id}/invoice`, { responseType: 'blob' }),
  setOrderDrivers: (id, driverIds) => api.patch(`${BASE}/orders/${id}/drivers`, { driverIds }),

  // ── Drivers ───────────────────────────────────────────────────────────────
  getDrivers: (q = '') => api.get(`${BASE}/drivers`, { params: { q } }),
  createDriver: (name) => api.post(`${BASE}/drivers`, { name }),
};

export const uploadInventoryImage = (file) => {
  const fd = new FormData();
  fd.append('image', file);
  return api.post('/api/upload/inventory-image', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};
