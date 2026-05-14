// src/api/operatorApi.js
import api from './axios';

export const operatorApi = {
  // Categories
  getCategories: () => api.get('/api/operator/categories'),
  createCategory: (data) => api.post('/api/operator/categories', data),
  updateCategory: (id, data) => api.put(`/api/operator/categories/${id}`, data),
  deleteCategory: (id) => api.delete(`/api/operator/categories/${id}`),

  // Ingredients
  getIngredients: () => api.get('/api/operator/ingredients'),
  createIngredient: (data) => api.post('/api/operator/ingredients', data),
  updateIngredient: (id, data) => api.put(`/api/operator/ingredients/${id}`, data),

  // Products (read-only for context)
  getProducts: () => api.get('/api/operator/products'),

  // Batches
  submitBatch: (data) => api.post('/api/operator/batches', data),
  getMyBatches: () => api.get('/api/operator/batches'),
};

// Admin Batch Approval
export const adminBatchApi = {
  list: (params) => api.get('/api/admin/batches', { params }),
  getDetail: (id) => api.get(`/api/admin/batches/${id}`),
  approveBatch: (id, note) => api.post(`/api/admin/batches/${id}/approve`, { note }),
  rejectBatch: (id, note) => api.post(`/api/admin/batches/${id}/reject`, { note }),
  approveItems: (batchId, itemIds, note) =>
    api.post(`/api/admin/batches/${batchId}/items/approve`, { itemIds, note }),
};

// Notifications
export const notificationApi = {
  getList: (params) => api.get('/api/notifications', { params }),
  getUnreadCount: () => api.get('/api/notifications/unread-count'),
  markRead: (id) => api.patch(`/api/notifications/${id}/read`),
  markAllRead: () => api.patch('/api/notifications/read-all'),
};
