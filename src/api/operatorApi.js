// src/api/operatorApi.js
import api from './axios';

export const operatorApi = {
  // ── Categories (ROOT only — không bao gồm subcategory) ──────────────────
  getCategories: () => api.get('/api/operator/categories'),
  createCategory: (data) => api.post('/api/operator/categories', data),
  updateCategory: (id, data) => api.put(`/api/operator/categories/${id}`, data),
  deleteCategory: (id) => api.delete(`/api/operator/categories/${id}`),

  getIngredientWarehouses: () => api.get('/api/operator/ingredient-warehouses'),
  getWarehousesOfIngredient: (id) => api.get(`/api/operator/ingredients/${id}/warehouses`),
  assignIngredientWarehouses: (id, warehouseIds) => api.put(`/api/operator/ingredients/${id}/warehouses`, warehouseIds),
  addIngredientToWarehouse: (id, warehouseId) => api.post(`/api/operator/ingredients/${id}/warehouses/${warehouseId}`),
  removeIngredientFromWarehouse: (id, warehouseId) => api.delete(`/api/operator/ingredients/${id}/warehouses/${warehouseId}`),
  getIngredientsByWarehouse: (warehouseId) => api.get(`/api/operator/warehouses/${warehouseId}/ingredients`),
  getWarehouses: () => api.get('/api/operator/warehouses'),

  // Warehouses (nếu chưa có)
  getWarehouses: () => api.get('/api/operator/warehouses'),

  // ── SubCategories (bảng sub_categories riêng) ───────────────────────────
  // data: { name, categoryId, imageUrl }
  getAllSubCategories: () => api.get('/api/operator/subcategories'),
  getSubCategoriesByCategoryId: (categoryId) =>
    api.get(`/api/operator/subcategories/by-category/${categoryId}`),
  createSubCategory: (data) => api.post('/api/operator/subcategories', data),
  updateSubCategory: (id, data) => api.put(`/api/operator/subcategories/${id}`, data),
  deleteSubCategory: (id) => api.delete(`/api/operator/subcategories/${id}`),

  // ── Ingredients ──────────────────────────────────────────────────────────
  getIngredients: () => api.get('/api/operator/ingredients'),
  createIngredient: (data) => api.post('/api/operator/ingredients', data),
  updateIngredient: (id, data) => api.put(`/api/operator/ingredients/${id}`, data),

  // ── Import / Export ──────────────────────────────────────────────────────
  exportIngredients: () =>
    api.get('/api/operator/ingredients/export', { responseType: 'blob' }),
  importIngredients: (formData) =>
    api.post('/api/operator/ingredients/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  exportProducts: () =>
    api.get('/api/operator/products/export', { responseType: 'blob' }),
  importProducts: (formData) =>
    api.post('/api/operator/products/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  // ── Products (read-only) ─────────────────────────────────────────────────
  getProducts: () => api.get('/api/operator/products'),

  // ── Batches ──────────────────────────────────────────────────────────────
  submitBatch: (data) => api.post('/api/operator/batches', data),
  getMyBatches: () => api.get('/api/operator/batches'),

  exportTemplate: () =>
    api.get('/api/operator/products/export-template', { responseType: 'blob' }),

  // Export full list để update
  exportFullList: () =>
    api.get('/api/operator/products/export-full', { responseType: 'blob' }),

  // Import tạo mới
  importProducts: (file) => {
    const fd = new FormData(); fd.append('file', file);
    return api.post('/api/operator/products/import', fd,
      { headers: { 'Content-Type': 'multipart/form-data' } });
  },

  // Import cập nhật
  importUpdateProducts: (file) => {
    const fd = new FormData(); fd.append('file', file);
    return api.post('/api/operator/products/import-update', fd,
      { headers: { 'Content-Type': 'multipart/form-data' } });
  },
};

export const adminBatchApi = {
  list: (params) => api.get('/api/admin/batches', { params }),
  getDetail: (id) => api.get(`/api/admin/batches/${id}`),
  approveBatch: (id, note) => api.post(`/api/admin/batches/${id}/approve`, { note }),
  rejectBatch: (id, note) => api.post(`/api/admin/batches/${id}/reject`, { note }),
  approveItems: (batchId, itemIds, note) =>
    api.post(`/api/admin/batches/${batchId}/items/approve`, { itemIds, note }),
};

export const notificationApi = {
  getList: (params) => api.get('/api/notifications', { params }),
  getUnreadCount: () => api.get('/api/notifications/unread-count'),
  markRead: (id) => api.patch(`/api/notifications/${id}/read`),
  markAllRead: () => api.patch('/api/notifications/read-all'),
};