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
  getDebtStats: () =>
    api.get('/api/admin/dashboard/debt-stats').then(r => r.data?.data ?? r.data),
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
  getProducts: () => api.get('/api/admin/products').then(unwrap),
  downloadInvoice: (orderId) =>
    api.get(`/api/admin/orders/orders/${orderId}/invoice`, { responseType: 'blob' }),
  searchCustomers: (q = '') =>
    api.get('/api/admin/orders/customers/search', { params: { q, size: 50 } }).then(unwrap),
};

// ─── Customers ───────────────────────────────────────────────────────────────
export const adminCustomerApi = {
  list: (params) => api.get('/api/admin/customers', { params }).then(unwrap),
  getById: (id) => api.get(`/api/admin/customers/${id}`).then(unwrap),
  create: (data) => api.post('/api/admin/customers', data).then(unwrap),
  update: (id, data) => api.put(`/api/admin/customers/${id}`, data).then(unwrap),
  softDelete: (id, password) =>                                          // ← thêm
    api.delete(`/api/admin/customers/${id}`, { data: { password } }).then(unwrap),
  updateDiscount: (id, discountRate) => api.put(`/api/admin/customers/${id}/discount`, { discountRate }).then(unwrap),
  bulkDiscount: (customerIds, discountRate) => api.put('/api/admin/customers/bulk-discount', { customerIds, discountRate }).then(unwrap),
  setActive: (id, value) => api.put(`/api/admin/customers/${id}/active`, null, { params: { value } }).then(unwrap),
  bulkSetActive: (customerIds, isActive) => api.put('/api/admin/customers/bulk-active', { customerIds, isActive }).then(unwrap),
  updateDebtDays: (id, days) => api.put(`/api/admin/customers/${id}/debt-days`, null, { params: { days } }).then(unwrap),
  /** Cập nhật nhanh TÊN TRÊN HỢP ĐỒNG. Gửi '' để xoá → quay về tên mặc định. */
  updateContractName: (id, contractName) =>
    api.put(`/api/admin/customers/${id}/contract-name`, { contractName }).then(unwrap),
  /** OWNER/ADMIN: bật/tắt "yêu cầu thanh toán trước khi giao hàng" cho khách hàng.
   *  Chỉ ảnh hưởng ĐƠN TẠO MỚI — đơn cũ giữ nguyên cấu hình đã snapshot lúc tạo. */
  updateRequirePrepayment: (id, requirePrepayment) =>
    api.put(`/api/admin/customers/${id}/require-prepayment`, { requirePrepayment }).then(unwrap),
  getOrderHistory: (customerId) => api.get(`/api/admin/customers/${customerId}/orders`).then(unwrap),
  assignSeller: (id, sellerId) => api.put(`/api/admin/customers/${id}/assign-seller`, null, { params: sellerId != null ? { sellerId } : {} }).then(unwrap),
  searchSellers: (q) => api.get('/api/admin/customers/sellers/search', { params: { q } }).then(unwrap),
  exportAll: (params) => api.get('/api/admin/customers/export', { params, responseType: 'blob' }),
  importAll: (file) => {
    const fd = new FormData(); fd.append('file', file);
    return api.post('/api/admin/customers/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
};

// ─── Users ───────────────────────────────────────────────────────────────────
export const adminUserApi = {
  list: (params) => api.get('/api/admin/users', { params }).then(unwrap),
  getById: (id) => api.get(`/api/admin/users/${id}`).then(unwrap),
  create: (data) => api.post('/api/admin/users', data).then(unwrap),
  update: (id, data) => api.put(`/api/admin/users/${id}`, data).then(unwrap),
  setLocked: (id, value) => api.put(`/api/admin/users/${id}/lock`, null, { params: { value } }).then(unwrap),
  resetPassword: (id, newPassword) => api.put(`/api/admin/users/${id}/reset-password`, { newPassword }).then(unwrap),

  /** XOÁ MỀM nhân viên: deleted = true, khoá tài khoản, thu hồi token,
   *  và gắn tiền tố SOFT_DELETED_{id}_ vào username/email/SĐT → giải phóng các
   *  giá trị unique để có thể tạo lại nhân viên mới với đúng thông tin cũ. */
  softDelete: (id) => api.delete(`/api/admin/users/${id}`).then(unwrap),

  /** Khôi phục nhân viên đã xoá (nếu username/email/SĐT cũ chưa bị ai dùng mất) */
  restore: (id) => api.put(`/api/admin/users/${id}/restore`).then(unwrap),

  /** Danh sách nhân viên đã xoá */
  listDeleted: (params) => api.get('/api/admin/users/deleted', { params }).then(unwrap),
};

// ─── Reports (báo cáo công nợ / aged receivables) ─────────────────────────────
export const reportApi = {
  // asOf: chuỗi 'yyyy-MM-dd' (tuỳ chọn). Bỏ trống = hôm nay (backend tự lấy).
  exportAgedReceivables: (asOf) =>
    api.get('/api/accountant/reports/aged-receivables', {
      params: asOf ? { asOf } : {},
      responseType: 'blob',
    }),
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

// ─── Expense Vouchers (ADMIN/OWNER side) ─────────────────────────────────────
export const adminExpenseApi = {
  listAll: (params) => api.get('/api/expense-vouchers', { params }).then(unwrap),
  getById: (id) => api.get(`/api/expense-vouchers/${id}`).then(unwrap),
  approve: (id, note) => api.post(`/api/expense-vouchers/${id}/approve`, { note }).then(unwrap),
  reject: (id, reason) => api.post(`/api/expense-vouchers/${id}/reject`, { reason }).then(unwrap),
};

export const adminIncomeApi = {
  listAll: (params) => api.get('/api/income-vouchers', { params }).then(unwrap),
  /** Lọc theo khoảng ngày Ở PHÍA SERVER (from/to = epoch millis) */
  listByDate: (from, to, params) =>
    api.get('/api/income-vouchers/by-date', { params: { from, to, ...params } }).then(unwrap),
  /** Tổng tiền + tổng số phiếu theo ĐÚNG bộ lọc — không phụ thuộc phân trang */
  summary: (q, from, to) =>
    api.get('/api/income-vouchers/summary', { params: { q, from, to } }).then(unwrap),
  getById: (id) => api.get(`/api/income-vouchers/${id}`).then(unwrap),
};

// ─── KPI Admin ───────────────────────────────────────────────────────────────
export const adminKpiApi = {
  getPeriod: (periodKey) => api.get('/api/admin/kpi', { params: { periodKey } }).then(unwrap),
};

// ─── Feature 4: KPI Phòng Sale ────────────────────────────────────────────────
export const adminSaleKpiApi = {
  get: (params) => api.get('/api/admin/sale-kpi', { params }),
};

// ─── Warehouse Stock Detail ──────────────────────────────────────────────────
export const adminWarehouseStockApi = {
  getStock: (id) => api.get(`/api/admin/warehouses/${id}/stock`).then(unwrap),
};