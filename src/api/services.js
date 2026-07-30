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
  switchRole: (role) => api.post('/api/auth/switch-role', { role }),
  setDefaultRole: (role) => api.put('/api/auth/default-role', { role }),

  /**
   * Nạp lại phiên: roles/kho mới nhất từ DB.
   * accessToken trong response có thể null = token hiện tại vẫn dùng được.
   */
  me: () => api.get('/api/auth/me'),
};

// ─── Upload ──────────────────────────────────────────────────────────────────
const multipart = { headers: { 'Content-Type': 'multipart/form-data' } };
const toFormData = (field, file) => { const fd = new FormData(); fd.append(field, file); return fd; };

export const uploadApi = {
  productImage: (file) => api.post('/api/upload/product-image', toFormData('image', file), multipart),
  ingredientImage: (file) => api.post('/api/upload/ingredient-image', toFormData('image', file), multipart),
};

// ─── Reports (báo cáo công nợ / aged receivables) ─────────────────────────────
export const reportApi = {
  // asOf: 'yyyy-MM-dd' (tuỳ chọn, bỏ trống = hôm nay).
  // filters: { q, type, isActive, sellerId, customerIds }
  //   - customerIds (mảng ID): CHỈ xuất đúng các khách được chọn ở modal,
  //     backend sẽ bỏ qua các bộ lọc còn lại.
  exportAgedReceivables: (asOf, filters = {}) => {
    const params = {};
    if (asOf) params.asOf = asOf;

    if (Array.isArray(filters.customerIds) && filters.customerIds.length) {
      // Gửi dạng "1,2,3" để Spring bind thẳng vào List<Long>.
      params.customerIds = filters.customerIds.join(',');
      return api.get('/api/accountant/reports/aged-receivables', { params, responseType: 'blob' });
    }

    if (filters.q) params.q = filters.q;
    if (filters.type) params.type = filters.type;
    if (filters.isActive !== undefined && filters.isActive !== '' && filters.isActive !== null)
      params.isActive = filters.isActive;
    if (filters.sellerId !== undefined && filters.sellerId !== '' && filters.sellerId !== null)
      params.sellerId = filters.sellerId;

    return api.get('/api/accountant/reports/aged-receivables', { params, responseType: 'blob' });
  },
};

// ─── Reports (báo cáo công nợ — bản của SELLER/SUPER_SELLER) ─────────────────
// Backend tự giới hạn trong phạm vi khách hàng mà tài khoản được phép xem.
export const sellerReportApi = {
  exportAgedReceivables: (asOf, filters = {}) => {
    const params = {};
    if (asOf) params.asOf = asOf;
    if (Array.isArray(filters.customerIds) && filters.customerIds.length)
      params.customerIds = filters.customerIds.join(',');
    return api.get('/api/seller/reports/aged-receivables', {
      params,
      responseType: 'blob',
    });
  },
};

// ─── Warehouses (seller) ──────────────────────────────────────────────────────
export const warehouseApi = {
  getAll: () => api.get('/api/seller/warehouses'),
  getDeliveryOrders: (params) => api.get('/api/warehouse/orders/delivery', { params }),
  markDelivering: (id) => api.patch(`/api/warehouse/orders/${id}/deliver`),
  confirmDelivered: (id) => api.patch(`/api/warehouse/orders/${id}/confirm-delivered`),
  uploadReceiptFile: (id, formData) =>
    api.patch(`/api/warehouse/orders/${id}/receipt-file`, formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }),
  getOrderDetail: (id) => api.get(`/api/warehouse/orders/${id}/detail`),
  getOrderLogs: (id) => api.get(`/api/accountant/orders/${id}/logs`),
  getInvoice: (id) => api.get(`/api/warehouse/orders/${id}/invoice`, { responseType: 'blob' }), // ← thêm
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
  exportCustomerProductReport: (params) =>
    api.get('/api/seller/customer-product-report', { params, responseType: 'blob' }),
  getReportCategories: () => api.get('/api/seller/report-categories'),
  create: (data) => api.post('/api/seller/orders', data),
  getById: (id) => api.get(`/api/seller/orders/${id}`),
  getMyOrders: (params) => api.get('/api/seller/orders', { params }),
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
  cancelOrder: (id, reason) =>
    api.patch(`/api/seller/orders/${id}/cancel`, { reason }),
  updateOrderItems: (id, data) =>
    api.put(`/api/seller/orders/${id}/items`, data),
  superSellerUpdateOrder: (id, data) =>
    api.put(`/api/seller/orders/${id}/super-edit`, data),
  checkSuperCancelInfo: (id) =>
    api.get(`/api/seller/orders/${id}/super-cancel/check`),
  superSellerCancelOrder: (id, data) =>
    api.put(`/api/seller/orders/${id}/super-cancel`, data),
  searchStaff: (keyword) =>
    api.get('/api/seller/orders/super-edit/staff-search', { params: { keyword } }),
  searchDrivers: (keyword, vehicleType) =>
    api.get('/api/warehouse/drivers', { params: { q: keyword, type: vehicleType } }),
  exportIngredients: (params) =>
    api.get('/api/seller/orders/export-ingredients', { params, responseType: 'blob' }),
  exportDeliveryReport: (params) =>
    api.get('/api/seller/orders/export-delivery-report', { params, responseType: 'blob' }),

  /**
   * Báo cáo SẢN PHẨM theo đơn hàng — trả về file PDF (blob) để in.
   * params: { from, to, categoryIds?: number[] }
   * categoryIds bỏ trống hoặc chọn hết = xuất tất cả danh mục.
   */
  exportOrderProductReport: ({ from, to, categoryIds }) =>
    api.get('/api/seller/orders/export-product-report', {
      // Spring nhận "1,2,3" -> List<Long>, không phụ thuộc cách axios serialize mảng
      params: { from, to, ...(categoryIds?.length ? { categoryIds: categoryIds.join(',') } : {}) },
      responseType: 'blob',
    }),
};

// ─── Draft Order API ──────────────────────────────────────────────────────────
export const draftApi = {
  /** Lưu đơn nháp mới (DRAFT hoặc SCHEDULED) */
  save: (data) => api.post('/api/seller/drafts', data),

  /** Lấy danh sách đơn nháp của seller đang đăng nhập */
  getAll: () => api.get('/api/seller/drafts'),

  /** Chi tiết 1 đơn nháp */
  getById: (id) => api.get(`/api/seller/drafts/${id}`),

  /** Xóa đơn nháp */
  delete: (id) => api.delete(`/api/seller/drafts/${id}`),

  /** Kiểm tra tồn kho trước khi chuyển sang POS */
  checkStock: (id) => api.get(`/api/seller/drafts/${id}/stock-check`),

  /**
   * Tạo phiếu đặt hàng PDF từ đơn nháp.
   * Trả về Blob — dùng fetch trực tiếp với Authorization header
   * hoặc dùng responseType: 'blob' nếu dùng axios:
   */
  getInvoice: (id) => api.get(`/api/seller/drafts/${id}/invoice`, { responseType: 'blob' }),
};


// ─── Inventory ───────────────────────────────────────────────────────────────
export const inventoryApi = {
  getLogs: (params) => api.get('/api/seller/inventory-logs', { params }),
  getBatches: (params) => api.get('/api/seller/inventory-batches', { params }),
  getBatch: (id) => api.get(`/api/seller/inventory-batches/${id}`),
};

// ─── Accountant ──────────────────────────────────────────────────────────────
export const accountantApi = {
  getOrders: (params) => api.get('/api/accountant/orders', { params }),
  markPendingPayment: (id) => api.patch(`/api/accountant/orders/${id}/pending-payment`),
  markCompleted: (id) => api.patch(`/api/accountant/orders/${id}/complete`),
  updatePaymentMethod: (id, paymentMethod) => api.patch(`/api/accountant/orders/${id}/payment`, { paymentMethod }),
  exportOrders: (params) =>
    api.get('/api/accountant/orders/export', { params, responseType: 'blob' }),
  getProducts: () => api.get('/api/accountant/products'),
  getCustomersList: (q) => api.get('/api/accountant/customers', { params: { q, size: 100 } }),
  getCustomers: (params) => api.get('/api/accountant/customers', { params }),
  getCustomerOrders: (customerId) => api.get(`/api/accountant/customers/${customerId}/orders`),
  getSummary: (from, to) => api.get('/api/accountant/dashboard/summary', { params: { from, to } }),
  getChart: (from, to, groupBy) => api.get('/api/accountant/dashboard/chart', { params: { from, to, groupBy } }),
  getTopProducts: (from, to, limit = 10) => api.get('/api/accountant/dashboard/top-products', { params: { from, to, limit } }),
  recordPartialPayment: (id, paidAmountOrData, debtDays) => {
    const body = typeof paidAmountOrData === 'object' && paidAmountOrData !== null
      ? paidAmountOrData
      : { paidAmount: paidAmountOrData, debtDays };
    return api.patch(`/api/accountant/orders/${id}/partial-payment`, body);
  },
  getInvoice: (orderId) =>
    api.get(`/api/accountant/orders/${orderId}/invoice`, { responseType: 'blob' }),
  waiveRemainder: (id, data) =>
    api.patch(`/api/accountant/orders/${id}/waive-remainder`, data),
  getOrderDetail: (id) => api.get(`/api/accountant/orders/${id}/detail`),
  getOrderLogs: (id) => api.get(`/api/accountant/orders/${id}/logs`),
  bulkComplete: (data) => api.post('/api/accountant/orders/bulk-complete', data),
  uploadReceiptFile: (id, formData) =>
    api.patch(`/api/accountant/orders/${id}/receipt-file`, formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }),
  cancelOrder: (id, reason) =>
    api.patch(`/api/accountant/orders/${id}/cancel`, { reason }),
};

// ─── Dashboard (shared) ───────────────────────────────────────────────────────
export const dashboardApi = accountantApi;

// ─── Expense Vouchers ────────────────────────────────────────────────────────
export const expenseApi = {
  create: (data) => api.post('/api/expense-vouchers', data),
  listMy: (params) => api.get('/api/expense-vouchers/my', { params }),
  listAll: (params) => api.get('/api/expense-vouchers', { params }),
  listByDate: (from, to, params) => api.get('/api/expense-vouchers/by-date', { params: { from, to, ...params } }),
  search: (q, from, to, params) =>
    api.get('/api/expense-vouchers/search', { params: { q, from, to, ...params } }),
  getById: (id) => api.get(`/api/expense-vouchers/${id}`),
  nextPaymentNumber: () => api.get('/api/expense-vouchers/next-payment-number'),
  /** Tải file Excel mẫu để nhập phiếu chi hàng loạt (trả blob). */
  downloadImportTemplate: () =>
    api.get('/api/expense-vouchers/import-template', { responseType: 'blob' }),
  /** Nhập phiếu chi hàng loạt từ file Excel. */
  importExcel: (file) => {
    const fd = new FormData(); fd.append('file', file);
    return api.post('/api/expense-vouchers/import', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  /** Xuất báo cáo phiếu chi (Excel) theo khoảng thời gian. paymentType: CASH | BANK_TRANSFER | ALL */
  exportReport: (from, to, paymentType) =>
    api.get('/api/expense-vouchers/export', { params: { from, to, paymentType }, responseType: 'blob' }),
  // Danh mục khoản chi (đang bật) của 1 NCC — cho form lập phiếu chi
  /** Danh mục khoản chi đang bật — POOL DÙNG CHUNG cho mọi NCC */
  expenseCategories: () => api.get('/api/expense-vouchers/expense-categories'),
  /** Tạo nhanh nhãn khoản chi ngay khi lập phiếu chi (ACCOUNTANT/SUPER_ACCOUNTANT). */
  createExpenseCategory: (name) => api.post('/api/expense-vouchers/expense-categories', { name }),
  /** @deprecated danh mục là pool chung — vendorId bị bỏ qua */
  vendorCategories: () => api.get('/api/expense-vouchers/expense-categories'),
  approve: (id, note) => api.post(`/api/expense-vouchers/${id}/approve`, { note }),
  reject: (id, reason) => api.post(`/api/expense-vouchers/${id}/reject`, { reason }),
  /**
   * Duyệt hàng loạt. `ids` gom từ NHIỀU TRANG khác nhau — backend chỉ nhận id nên
   * không phụ thuộc phân trang. SUPER_ACCOUNTANT gọi được, nhưng backend vẫn kiểm
   * quyền trên từng phiếu (chỉ duyệt được phiếu thuộc tầm của mình).
   */
  bulkApprove: (ids, note) => api.post('/api/expense-vouchers/bulk-approve', { ids, note }),
  /** Từ chối hàng loạt — dùng chung một lý do cho mọi phiếu được chọn. */
  bulkReject: (ids, reason) => api.post('/api/expense-vouchers/bulk-reject', { ids, reason }),
  updateReason: (id, reason) => api.patch(`/api/expense-vouchers/${id}/reason`, { reason }),
  /**
   * Sửa DANH SÁCH khoản chi của phiếu — gửi TOÀN BỘ danh sách sau khi sửa.
   * Backend tự suy ra: có id = cập nhật, id null = thêm mới, khoản cũ vắng mặt = xoá.
   * Sau khi lưu, cấp duyệt (approverScope) được tính lại theo tổng tiền mới.
   * @param {number} id  id phiếu chi
   * @param {Array<{id:number|null, categoryId:number, amount:number, note?:string}>} items
   */
  updateItems: (id, items) => api.patch(`/api/expense-vouchers/${id}/items`, { items }),
  getApprovalConfig: () => api.get('/api/expense-vouchers/approval-config'),
  updateApprovalConfig: (data) => api.put('/api/expense-vouchers/approval-config', data),
  uploadImage: (file) => {
    const fd = new FormData(); fd.append('image', file);
    return api.post('/api/upload/expense-image', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
};

// ─── Income Vouchers ─────────────────────────────────────────────────────────
export const incomeApi = {
  create: (data) => api.post('/api/income-vouchers', data),
  update: (id, data) => api.put(`/api/income-vouchers/${id}`, data),
  getLogs: (id) => api.get(`/api/income-vouchers/${id}/logs`),
  listMy: (params) => api.get('/api/income-vouchers/my', { params }),
  listAll: (params) => api.get('/api/income-vouchers', { params }),
  listByDate: (from, to, params) => api.get('/api/income-vouchers/by-date', { params: { from, to, ...params } }),
  search: (q, from, to, params) => api.get('/api/income-vouchers/search', { params: { q, from, to, ...params } }),
  /** Tổng tiền + tổng số phiếu theo ĐÚNG bộ lọc (không phụ thuộc phân trang) */
  summary: (q, from, to) => api.get('/api/income-vouchers/summary', { params: { q, from, to } }),
  getById: (id) => api.get(`/api/income-vouchers/${id}`),
  nextReceiptNumber: () => api.get('/api/income-vouchers/next-receipt-number'),
  exportReport: (from, to, paymentType) =>
    api.get('/api/income-vouchers/export', { params: { from, to, paymentType }, responseType: 'blob' }),
  uploadImage: (file) => {
    const fd = new FormData(); fd.append('image', file);
    return api.post('/api/upload/income-image', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
};

// ─── Danh mục ngân hàng (dùng chung cho phiếu thu/chi + dòng tiền) ────────────
export const bankApi = {
  list: () => api.get('/api/bank-accounts'),
  add: (data) => api.post('/api/bank-accounts', data),
};

// ─── Tồn kho nguyên liệu theo kỳ (Nguyên liệu — ADMIN/OWNER) ────────────────
export const inventoryFlowApi = {
  summary: (from, to, q) => api.get('/api/inventory/summary', { params: { from, to, ...(q ? { q } : {}) } }),
  ingredients: (q) => api.get('/api/inventory/ingredients', { params: q ? { q } : {} }),
  factoryStock: (q) => api.get('/api/inventory/factory-stock', { params: q ? { q } : {} }),
  confirm: (data) => api.post('/api/inventory/confirm', data),
};

// ─── Cashflow (Quản lý dòng tiền — ADMIN/OWNER) ──────────────────────────────
export const cashflowApi = {
  banks: () => api.get('/api/cashflow/banks'),
  addBank: (data) => api.post('/api/cashflow/banks', data),
  summary: (from, to) => api.get('/api/cashflow/summary', { params: { from, to } }),
  confirm: (data) => api.post('/api/cashflow/confirm', data),
  report: (from, to) =>
    api.get('/api/cashflow/report', { params: { from, to }, responseType: 'blob' }),
};

// ─── KPI ─────────────────────────────────────────────────────────────────────
export const kpiApi = {
  getMyKpi: () => api.get('/api/seller/kpi'),
};

// ─── Admin Warehouse Stock ───────────────────────────────────────────────────
export const adminWarehouseStockApi = {
  getStock: (warehouseId) => api.get(`/api/admin/warehouses/${warehouseId}/stock`),
};

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Operator API ─────────────────────────────────────────────────────────────
export const operatorApi = {
  getCategories: () => api.get('/api/operator/categories'),
  createCategory: (data) => api.post('/api/operator/categories', data),
  updateCategory: (id, data) => api.put(`/api/operator/categories/${id}`, data),
  deleteCategory: (id) => api.delete(`/api/operator/categories/${id}`),
  getIngredients: () => api.get('/api/operator/ingredients'),
  createIngredient: (data) => api.post('/api/operator/ingredients', data),
  updateIngredient: (id, data) => api.put(`/api/operator/ingredients/${id}`, data),
  getProducts: () => api.get('/api/operator/products'),
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

// ─── Quotation API ────────────────────────────────────────────────────────────
export const quotationApi = {
  /**
   * Tạo và download PDF báo giá
   * @param {Object} payload
   * @param {string} payload.customerName       - Tên khách hàng (có thể null → "QUÝ KHÁCH HÀNG")
   * @param {string} payload.quotationContent   - Nội dung báo giá (VD: "SẢN PHẨM ICEHOT & RICH'S")
   * @param {Array}  payload.items              - Danh sách sản phẩm
   * @param {number} payload.items[].productId
   * @param {number} [payload.items[].tierId]   - null = giá lẻ (basePrice)
   * @param {number} payload.items[].vatRate    - 0 | 5 | 8 | 10 | 12
   * @param {string} payload.items[].vatMode    - "INCLUSIVE" | "EXCLUSIVE"
   */
  exportPdf: (payload) =>
    api.post('/api/seller/quotations/export-pdf', payload, { responseType: 'blob' }),
};