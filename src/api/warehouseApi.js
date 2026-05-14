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
  // ── Kho ────────────────────────────────────────────────────────────────────
  getAll:   ()           => api.get(BASE),
  create:   (data)       => api.post(BASE,           data),
  update:   (id, data)   => api.put(`${BASE}/${id}`, data),

  // ── Tồn kho ────────────────────────────────────────────────────────────────
  getStock: (warehouseId) => api.get(`${BASE}/${warehouseId}/stock`),

  // ── Thao tác ───────────────────────────────────────────────────────────────
  import:   (data) => api.post(`${BASE}/import`,   data),
  export:   (data) => api.post(`${BASE}/export`,   data),
  transfer: (data) => api.post(`${BASE}/transfer`, data),
  adjust:   (data) => api.post(`${BASE}/adjust`,   data),

  // ── Lịch sử ────────────────────────────────────────────────────────────────
  getHistory:      (tab, warehouseId, page = 0, size = 20) =>
    api.get(`${BASE}/history`, { params: { tab, warehouseId: warehouseId || undefined, page, size } }),
  getReceiptDetail:(id) => api.get(`${BASE}/receipt/${id}`),

  // ── Orders ─────────────────────────────────────────────────────────────────
  getPreparingOrders: ()   => api.get(`${BASE}/orders/preparing`),
  markDelivering:     (id) => api.patch(`${BASE}/orders/${id}/deliver`),
};

export const uploadInventoryImage = (file) => {
  const fd = new FormData();
  fd.append('image', file);
  return api.post('/api/upload/inventory-image', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};