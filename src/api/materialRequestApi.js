// src/api/materialRequestApi.js
import api from './axios';

const UNITS = ['Kg', 'Gr', 'Lít', 'Túi', 'Hộp', 'Bịch', 'Thùng', 'Chai', 'Lon', 'Can'];
export { UNITS };

export const PAYMENT_METHODS = [
  { value: 'BANK', label: 'Chuyển khoản' },
  { value: 'CASH', label: 'Tiền mặt' },
];

export const STATUS_CONFIG = {
  NEW:       { label: 'Mới tạo',      cls: 'bg-gray-100 text-gray-600',       dot: 'bg-gray-400' },
  ORDERED:   { label: 'Đã đặt hàng',  cls: 'bg-blue-100 text-blue-700',       dot: 'bg-blue-400' },
  RECEIVED:  { label: 'Đã nhận hàng', cls: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-400' },
  COMPLETED: { label: 'Hoàn thành',   cls: 'bg-gray-100 text-gray-500',       dot: 'bg-gray-300' },
};

// ── Factory Worker ────────────────────────────────────────────────────────────
export const factoryMaterialRequestApi = {
  create: (body) =>
    api.post('/api/factory/material-requests', body).then(r => r.data.data),

  list: ({ status, dateFrom, dateTo, search, page = 0, size = 20 } = {}) =>
    api.get('/api/factory/material-requests', {
      params: { status, dateFrom, dateTo, search, page, size },
    }).then(r => r.data.data),

  getById: (id) =>
    api.get(`/api/factory/material-requests/${id}`).then(r => r.data.data),

  receive: (id, body) =>
    api.post(`/api/factory/material-requests/${id}/receive`, body).then(r => r.data.data),

  // Lấy tồn kho (factory_material_stock) — dùng để hiển thị số lượng còn lại
  getStock: () =>
    api.get('/api/factory/material-stock').then(r => r.data.data),

  // Lấy danh sách nguyên liệu từ factory_material — dùng cho dropdown tạo phiếu
  listMaterials: () =>
    api.get('/api/factory/materials').then(r => r.data.data),

  // Tạo nguyên liệu mới vào factory_material
  createMaterial: (body) =>
    api.post('/api/factory/materials', body).then(r => r.data.data),
};

// ── Super Accountant ──────────────────────────────────────────────────────────
export const accountantMaterialRequestApi = {
  list: ({ status, dateFrom, dateTo, search, page = 0, size = 20 } = {}) =>
    api.get('/api/super-accountant/material-requests', {
      params: { status, dateFrom, dateTo, search, page, size },
    }).then(r => r.data.data),

  getById: (id) =>
    api.get(`/api/super-accountant/material-requests/${id}`).then(r => r.data.data),

  confirmOrder: (id, body) =>
    api.post(`/api/super-accountant/material-requests/${id}/order`, body).then(r => r.data.data),

  // body: { items: [{itemId, requestVendorId, unitPrice}], vendorPayments: [{requestVendorId, action, paymentMethod, paymentInfo, proofImages}] }
  complete: (id, body) =>
    api.post(`/api/super-accountant/material-requests/${id}/complete`, body).then(r => r.data.data),
};

// ── Owner (stock) ─────────────────────────────────────────────────────────────
export const ownerMaterialStockApi = {
  getStock: () =>
    api.get('/api/owner/factory/material-stock').then(r => r.data.data),
};

// ── Owner — Công nợ nhà cung cấp ──────────────────────────────────────────────
export const ownerVendorDebtApi = {
  // sortBy: 'oldest' (công nợ lâu nhất trước) | 'amount' (công nợ nhiều nhất trước)
  list: (sortBy = 'oldest') =>
    api.get('/api/owner/production/vendor-debts', { params: { sortBy } }).then(r => r.data.data),

  getHistory: (vendorId) =>
    api.get(`/api/owner/production/vendor-debts/${vendorId}/history`).then(r => r.data.data),

  getOutstanding: (vendorId) =>
    api.get(`/api/owner/production/vendor-debts/${vendorId}/outstanding`).then(r => r.data.data),

  listExpenses: ({ vendorId, search, page = 0, size = 20 } = {}) =>
    api.get('/api/owner/production/vendor-expenses', { params: { vendorId, search, page, size } }).then(r => r.data.data),
};

// ── Accountant / Super Accountant — Phiếu chi trả công nợ NCC ────────────────
function vendorExpenseApiFor(basePath) {
  return {
    create: (body) => api.post(basePath, body).then(r => r.data.data),
    list: ({ vendorId, search, page = 0, size = 20 } = {}) =>
      api.get(basePath, { params: { vendorId, search, page, size } }).then(r => r.data.data),
    getById: (id) => api.get(`${basePath}/${id}`).then(r => r.data.data),
    getOutstanding: (vendorId) => api.get(`${basePath}/outstanding/${vendorId}`).then(r => r.data.data),
  };
}
export const accountantVendorExpenseApi = vendorExpenseApiFor('/api/accountant/vendor-expenses');
export const superAccountantVendorExpenseApi = vendorExpenseApiFor('/api/super-accountant/vendor-expenses');

// ── Helpers ───────────────────────────────────────────────────────────────────
export function fmtTs(ms) {
  if (!ms) return '—';
  return new Date(ms).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function fmtDateTime(ms) {
  if (!ms) return '—';
  return new Date(ms).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function fmtVND(n) {
  if (n == null) return '—';
  return new Intl.NumberFormat('vi-VN').format(Number(n) || 0) + ' đ';
}

export function countdownInfo(targetMs) {
  if (!targetMs) return null;
  const diff = targetMs - Date.now();
  if (diff <= 0) return { label: 'Đã quá hạn', color: 'red' };
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h < 6) return { label: `${h}g ${m}p`, color: 'red' };
  if (h < 24) return { label: `${h}g ${m}p`, color: 'yellow' };
  const d = Math.floor(h / 24);
  return { label: `${d}n ${h % 24}g`, color: 'normal' };
}