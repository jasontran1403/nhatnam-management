// src/api/services.js
import api from './axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

export const getImageUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${BASE_URL}/api/auth${path}`;
};

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (data) => api.post('/api/auth/login', data),
};

// ─── Upload ──────────────────────────────────────────────────────────────────
const multipart = { headers: { 'Content-Type': 'multipart/form-data' } };
const toFormData = (field, file) => { const fd = new FormData(); fd.append(field, file); return fd; };

export const uploadApi = {
  productImage: (file) => api.post('/api/upload/product-image', toFormData('image', file), multipart),
  ingredientImage: (file) => api.post('/api/upload/ingredient-image', toFormData('image', file), multipart),
};

// ─── Warehouses (seller) ──────────────────────────────────────────────────────
export const warehouseApi = {
  getAll: () => api.get('/api/seller/warehouses'),
};

// ─── Products ────────────────────────────────────────────────────────────────
export const productApi = {
  getAll: (params) => api.get('/api/seller/products', { params }),
  getById: (id) => api.get(`/api/seller/products/${id}`),
  create: (data) => api.post('/api/seller/products', data),
  update: (id, data) => api.put(`/api/seller/products/${id}`, data),
  delete: (id) => api.delete(`/api/seller/products/${id}`),
  getVariants: (id) => api.get(`/api/seller/products/${id}/variants`),
  getPrices: (id) => api.get(`/api/seller/products/${id}/prices`),
  validateCart: (items) => api.post('/api/seller/cart/validate-items', items),
};

// ─── Categories ──────────────────────────────────────────────────────────────
export const categoryApi = {
  getAll: () => api.get('/api/seller/all-categories'),
  getPaginated: (params) => api.get('/api/seller/categories', { params }),
  getById: (id) => api.get(`/api/seller/categories/${id}`),
  create: (data) => api.post('/api/seller/categories', data),
  update: (id, data) => api.put(`/api/seller/categories/${id}`, data),
  delete: (id) => api.delete(`/api/seller/categories/${id}`),
};

// ─── Ingredients ─────────────────────────────────────────────────────────────
export const allIngredientApi = {
  sellerGetAll: () => api.get('/api/seller/all-ingredients'),
};

export const ingredientApi = {
  getAll: () => api.get('/api/warehouse/all-ingredients'),
  getPaginated: (params) => api.get('/api/warehouse/ingredients', { params }),
  getById: (id) => api.get(`/api/warehouse/ingredients/${id}`),
  create: (data) => api.post('/api/warehouse/ingredients', data),
  update: (id, data) => api.put(`/api/warehouse/ingredients/${id}`, data),
  delete: (id) => api.delete(`/api/warehouse/ingredients/${id}`),
};

// ─── Customers ───────────────────────────────────────────────────────────────
export const customerApi = {
  getAll: () => api.get('/api/seller/customers/b2b'),
  getById: (id) => api.get(`/api/seller/customers/b2b/${id}`),
  search: (params) => api.get('/api/seller/customers/b2b', { params }),
  searchB2b: (query) => api.get('/api/seller/customers/b2b', { params: { search: query, size: 50 } }),
  create: (data) => api.post('/api/seller/customers/b2b', data),
  createB2b: (data) => api.post('/api/seller/customers/b2b', data),
  update: (id, data) => api.put(`/api/seller/customers/b2b/${id}`, data),
  checkCode: (code) => api.get('/api/seller/customers/check-code', { params: { code } }),
  getReceiverInfos: (customerId) => api.get(`/api/seller/customers/${customerId}/receiver-infos`),
  addReceiverInfo: (customerId, data) => api.post(`/api/seller/customers/${customerId}/receiver-infos`, data),
  updateReceiverInfo: (customerId, rid, data) => api.put(`/api/seller/customers/${customerId}/receiver-infos/${rid}`, data),
  deleteReceiverInfo: (customerId, rid) => api.delete(`/api/seller/customers/${customerId}/receiver-infos/${rid}`),
  checkReceiverPhone: (phone) =>
    api.get('/api/seller/customers/receiver-infos/check-phone', { params: { phone } }),
  setDefaultReceiverInfo: (customerId, rid) =>
    api.patch(`/api/seller/customers/${customerId}/receiver-infos/${rid}/set-default`),
};

// ─── Orders ──────────────────────────────────────────────────────────────────
export const orderApi = {
  create: (data) => api.post('/api/seller/orders', data),
  getById: (id) => api.get(`/api/seller/orders/${id}`),
  getMyOrders: () => api.get('/api/seller/orders'),
  prepare: (id) => api.patch(`/api/seller/orders/${id}/prepare`),
  getInvoice: (id) => api.get(`/api/seller/orders/${id}/invoice`, { responseType: 'blob' }),
  completeOrder: (id) => api.patch(`/api/seller/orders/${id}/complete`),
  updatePaymentMethod: (id, paymentMethod) =>
    api.patch(`/api/seller/orders/${id}/payment-method`, { paymentMethod }),
  recordPartialPayment: (id, paidAmount, debtDays) =>
    api.patch(`/api/seller/orders/${id}/partial-payment`, { paidAmount, debtDays }),
  exportMyOrders: () =>
    api.get('/api/seller/orders/export', { responseType: 'blob' }),
  markPendingPayment: (orderId) =>
    api.patch(`/api/seller/orders/${orderId}/pending-payment`),
};

// ─── Inventory ───────────────────────────────────────────────────────────────
export const inventoryApi = {
  getLogs: (params) => api.get('/api/seller/inventory-logs', { params }),
  getBatches: (params) => api.get('/api/seller/inventory-batches', { params }),
  getBatch: (id) => api.get(`/api/seller/inventory-batches/${id}`),
};

// ─── Accountant ──────────────────────────────────────────────────────────────
export const accountantApi = {
  // Orders
  getOrders: (params) => api.get('/api/accountant/orders', { params }),
  markPendingPayment: (id) => api.patch(`/api/accountant/orders/${id}/pending-payment`),
  markCompleted: (id) => api.patch(`/api/accountant/orders/${id}/complete`),
  updatePaymentMethod: (id, paymentMethod) => api.patch(`/api/accountant/orders/${id}/payment`, { paymentMethod }),
  exportOrders: (params) =>
    api.get('/api/accountant/orders/export', { params, responseType: 'blob' }),

  // Customers
  getCustomers: (params) => api.get('/api/accountant/customers', { params }),
  getCustomerOrders: (customerId) => api.get(`/api/accountant/customers/${customerId}/orders`),

  // Dashboard
  getSummary: (from, to) => api.get('/api/accountant/dashboard/summary', { params: { from, to } }),
  getChart: (from, to, groupBy) => api.get('/api/accountant/dashboard/chart', { params: { from, to, groupBy } }),
  getTopProducts: (from, to, limit = 10) => api.get('/api/accountant/dashboard/top-products', { params: { from, to, limit } }),

  recordPartialPayment: (id, paidAmountOrData, debtDays) => {
    // Support both old (id, amount, days) and new (id, dataObj) signature
    const body = typeof paidAmountOrData === 'object' && paidAmountOrData !== null
      ? paidAmountOrData
      : { paidAmount: paidAmountOrData, debtDays };
    return api.patch(`/api/accountant/orders/${id}/partial-payment`, body);
  },

  getInvoice: (orderId) =>
    api.get(`/api/accountant/orders/${orderId}/invoice`, { responseType: 'blob' }),

  getOrderDetail: (id) => api.get(`/api/accountant/orders/${id}/detail`),
};

// ─── Dashboard (shared) ───────────────────────────────────────────────────────
export const dashboardApi = accountantApi; // alias nếu cần dùng chung

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Operator API ─────────────────────────────────────────────────────────────
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

  // Products (read-only list)
  getProducts: () => api.get('/api/operator/products'),

  // Batches
  submitBatch: (data) => api.post('/api/operator/batches', data),
  getMyBatches: () => api.get('/api/operator/batches'),
};

// ─── Admin Batch Approval API ─────────────────────────────────────────────────
export const adminBatchApi = {
  list: (params) => api.get('/api/admin/batches', { params }),
  getDetail: (id) => api.get(`/api/admin/batches/${id}`),
  approve: (id, note) => api.post(`/api/admin/batches/${id}/approve`, { note }),
  approveItems: (batchId, itemIds, note) =>
    api.post(`/api/admin/batches/${batchId}/items/approve`, { itemIds, note }),
  reject: (id, note) => api.post(`/api/admin/batches/${id}/reject`, { note }),
};

// ─── Notification API ─────────────────────────────────────────────────────────
export const notificationApi = {
  getList: (params) => api.get('/api/notifications', { params }),
  getUnreadCount: () => api.get('/api/notifications/unread-count'),
  markRead: (id) => api.patch(`/api/notifications/${id}/read`),
  markAllRead: () => api.patch('/api/notifications/read-all'),
};

// ─── Payment Transactions ─────────────────────────────────────────────────────
export const paymentApi = {
  getTransactions: (orderId) =>
    api.get(`/api/accountant/orders/${orderId}/payment-transactions`),
  recordPartialPayment: (id, data) =>
    api.patch(`/api/accountant/orders/${id}/partial-payment`, data),
};