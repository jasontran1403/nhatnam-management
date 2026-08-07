// src/api/supplyApi.js
//
// API cho module "Phiếu đặt hàng Văn phòng phẩm / Đồ dùng".
// Tách hoàn toàn khỏi materialRequestApi.js (phiếu nguyên liệu sản xuất).
import api from './axios';

const unwrap = (r) => r.data.data;

/* ── Trạng thái phiếu ──────────────────────────────────────────────────────── */
// PARTIALLY_RECEIVED là tên cột trong DB; nhãn hiển thị theo tài liệu là "Đang nhận hàng".
export const SUPPLY_STATUS = {
  NEW:                { label: 'Mới tạo',        cls: 'bg-surface-2 text-ink-2 ring-line' },
  ORDERED:            { label: 'Đã đặt hàng',    cls: 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 ring-blue-200 dark:ring-blue-500/28' },
  PARTIALLY_RECEIVED: { label: 'Đang nhận hàng', cls: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-amber-200 dark:ring-amber-500/28' },
  RECEIVED:           { label: 'Đã nhận hàng',   cls: 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 ring-indigo-200 dark:ring-indigo-500/28' },
  COMPLETED:          { label: 'Hoàn thành',     cls: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-500/28' },
  REJECTED:           { label: 'Đã từ chối',     cls: 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 ring-red-200 dark:ring-red-500/28' },
};

export const RECEIVE_STATUS = {
  PENDING:      { label: 'Chưa nhận',   cls: 'bg-surface-2 text-muted' },
  PARTIAL:      { label: 'Nhận 1 phần', cls: 'bg-amber-100 dark:bg-amber-500/18 text-amber-700 dark:text-amber-300' },
  FULFILLED:    { label: 'Đã đủ',       cls: 'bg-emerald-100 dark:bg-emerald-500/18 text-emerald-700 dark:text-emerald-300' },
  CLOSED_SHORT: { label: 'Chốt thiếu',  cls: 'bg-red-100 dark:bg-red-500/18 text-red-600 dark:text-red-300' },
};

export const GROUP_STATUS = {
  ORDERED:  { label: 'Đã đặt',      cls: 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300' },
  RECEIVED: { label: 'Đã nhận',     cls: 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300' },
  SETTLED:  { label: 'Đã tất toán', cls: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' },
};

/* ── Người tạo phiếu (SUPER_SELLER / SUPER_WAREHOUSE / SUPER_FACTORY_WORKER) ── */
export const supplyOrderApi = {
  /** Dropdown NCC — TẤT CẢ nhà cung cấp, không giới hạn NCC nguyên liệu. */
  suppliers: (q) =>
    api.get('/api/supply-orders/suppliers', { params: { q } }).then(unwrap),

  /** Danh mục khoản chi kèm categoryKind / unit / specification. */
  categories: (supplierId) =>
    api.get('/api/supply-orders/expense-categories', { params: { supplierId } }).then(unwrap),

  /**
   * TẠO NHANH nhãn khoản chi ngay trên form lập phiếu.
   *
   * Nhãn vào thẳng POOL DÙNG CHUNG (giống hệt nhãn do Owner tạo ở trang Quản lý
   * NCC), nên đừng coi đây là "nhãn tạm" — Owner vẫn sửa/ẩn được sau đó.
   *
   * body: { name, description, categoryKind: 'SERVICE'|'CONSUMABLE', unit, specification, supplyItemId }
   * Với CONSUMABLE, BE bắt buộc có unit + specification rồi tự gán supplyItemId
   * để không tách dòng tồn kho.
   */
  createCategory: (body) =>
    api.post('/api/supply-orders/expense-categories', body).then(unwrap),

  // body: { supplyWarehouseId, requiredBy, draft, items:[{supplierId, expenseCategoryId, quantity, note, sortOrder}] }
  create: (body) => api.post('/api/supply-orders', body).then(unwrap),

  /** Sửa phiếu nháp — chỉ khi còn NEW và do chính người tạo. */
  updateDraft: (id, body) => api.put(`/api/supply-orders/${id}`, body).then(unwrap),

  list: ({ status, warehouseId, dateFrom, dateTo, search, page = 0, size = 20 } = {}) =>
    api.get('/api/supply-orders', {
      params: { status, warehouseId, dateFrom, dateTo, search, page, size },
    }).then(unwrap),

  getById: (id) => api.get(`/api/supply-orders/${id}`).then(unwrap),

  /**
   * Lưu / xác nhận MỘT đợt nhận hàng.
   * body: { notes, draft, items: [{ itemId, qty, closeLine, note }] }
   * LƯU Ý: chỉ gửi các dòng THỰC GIAO trong đợt này.
   */
  saveReceipt: (id, body) =>
    api.post(`/api/supply-orders/${id}/receipts`, body).then(unwrap),
};

/* ── SUPER_ACCOUNTANT ──────────────────────────────────────────────────────── */
export const accountantSupplyApi = {
  list: ({ status, warehouseId, dateFrom, dateTo, search, page = 0, size = 20 } = {}) =>
    api.get('/api/super-accountant/supply-orders', {
      params: { status, warehouseId, dateFrom, dateTo, search, page, size },
    }).then(unwrap),

  getById: (id) => api.get(`/api/super-accountant/supply-orders/${id}`).then(unwrap),

  // body: { groups: [{ supplierId, expectedDeliveryAt, contactName, contactPhone, itemIds:[] }] }
  confirm: (id, body) =>
    api.post(`/api/super-accountant/supply-orders/${id}/confirm`, body).then(unwrap),

  // body: { reason } — REJECTED là TERMINAL
  reject: (id, body) =>
    api.post(`/api/super-accountant/supply-orders/${id}/reject`, body).then(unwrap),

  // body: { groupId, newExpectedDeliveryAt, reason }
  extendDelivery: (id, body) =>
    api.post(`/api/super-accountant/supply-orders/${id}/extend-delivery`, body).then(unwrap),

  // body: { groups: [{ groupId, items:[{itemId, priceInputMode, unitPrice|totalAmount}],
  //                    fees:[{label, amount}], paymentMode, paymentType,
  //                    bankName, bankRef, imageUrls, reason }] }
  settle: (id, body) =>
    api.post(`/api/super-accountant/supply-orders/${id}/settle`, body).then(unwrap),
};

/* ── Kho VPP ───────────────────────────────────────────────────────────────── */
export const supplyWarehouseApi = {
  /** Kho user được thao tác. FE auto-select khi chỉ có 1 kho. */
  myWarehouses: () => api.get('/api/supply-warehouses').then(unwrap),

  /** onlyPositive = true cho dropdown Rút sử dụng (chỉ món có tồn > 0). */
  stock: (warehouseId, { onlyPositive = false, search } = {}) =>
    api.get(`/api/supply-warehouses/${warehouseId}/stock`, {
      params: { onlyPositive, search },
    }).then(unwrap),

  // body: { warehouseId, note, lines: [{ supplyItemId, quantity, note }] }
  withdraw: (body) => api.post('/api/supply-warehouses/withdraw', body).then(unwrap),

  // type: 'IN' | 'OUT' | 'ALL'
  history: (warehouseId, { type, from, to, page = 0, size = 50 } = {}) =>
    api.get(`/api/supply-warehouses/${warehouseId}/history`, {
      params: { type, from, to, page, size },
    }).then(unwrap),
};

/* ── Owner ─────────────────────────────────────────────────────────────────── */
export const ownerSupplyApi = {
  warehouses: () => api.get('/api/owner/supply-warehouses').then(unwrap),

  assignments: () => api.get('/api/owner/supply-warehouses/assignments').then(unwrap),

  // body: { userId, warehouseIds: [] } — ghi đè toàn bộ danh sách kho của user
  assign: (body) => api.post('/api/owner/supply-warehouses/assignments', body).then(unwrap),

  items: () => api.get('/api/owner/supply-items').then(unwrap),

  merge: (sourceId, targetId) =>
    api.post(`/api/owner/supply-items/${sourceId}/merge-into/${targetId}`).then(r => r.data),

  orders: (params) => api.get('/api/owner/supply-orders', { params }).then(unwrap),
};

/**
 * Autocomplete danh mục vật dụng — BIỆN PHÁP CHÍNH chống phân mảnh tồn kho.
 * Khi chọn một gợi ý, form PHẢI tự điền tên + quy cách + ĐVT rồi KHOÁ 3 ô đó lại;
 * chỉ khi bấm "Tạo mới" mới cho gõ tay.
 */
export const supplyItemApi = {
  suggest: (q) => api.get('/api/supply-items/suggest', { params: { q } }).then(unwrap),
};

/**
 * Upload ảnh chứng từ thanh toán.
 *
 * <p>Dùng lại đúng endpoint của phiếu chi (`/api/upload/expense-image`) vì ảnh
 * cuối cùng cũng được gắn vào ExpenseVoucher do bước tất toán sinh ra — không
 * việc gì phải tạo endpoint mới cho cùng một loại tài liệu.
 *
 * @returns {Promise<string>} URL ảnh đã upload
 */
export const supplyUploadApi = {
  uploadImage: async (file) => {
    const fd = new FormData();
    fd.append('image', file);
    const res = await api.post('/api/upload/expense-image', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    const url = res.data?.data?.imageUrl || res.data?.imageUrl || '';
    if (!url) throw new Error('Upload thất bại');
    return url;
  },
};

/* ── Helpers ───────────────────────────────────────────────────────────────── */

/** Số lượng: cho phép 3 số thập phân, bỏ số 0 thừa. */
export const fmtQty = (v) => {
  if (v == null) return '—';
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 }).format(n);
};

/** Tiền hiển thị — làm tròn LÊN hàng đơn vị đồng (khớp quy tắc BE). */
export const fmtMoney = (v) => {
  if (v == null) return '—';
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('vi-VN').format(Math.ceil(n)) + ' đ';
};

/** Tiền giữ phần thập phân — dùng khi hiển thị đơn giá / số trung gian 3 số lẻ. */
export const fmtMoney3 = (v) => {
  if (v == null) return '—';
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 }).format(n);
};

export const fmtDate = (ms) =>
  ms ? new Date(Number(ms)).toLocaleDateString('vi-VN',
    { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

export const fmtDateTime = (ms) =>
  ms ? new Date(Number(ms)).toLocaleString('vi-VN',
    { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

export const msToDateInput = (ms) => {
  if (!ms) return '';
  const d = new Date(Number(ms));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const dateInputToMs = (s) => (s ? new Date(s + 'T00:00:00').getTime() : null);

/** Cuối ngày (23:59:59.999) — dùng cho filter "đến ngày". */
export const endOfDayMs = (s) => (s ? dateInputToMs(s) + 86_399_999 : null);

/**
 * PHÂN BỔ THUẾ/PHÍ THEO TỶ TRỌNG GIÁ TRỊ — bản sao logic của
 * `utils/CostAllocation.java` phía BE, dùng để PREVIEW ngay trên form tất toán.
 * BE vẫn là nguồn chân lý; hàm này chỉ để người dùng thấy trước con số.
 *
 * @param lines [{ id, qty, unitPrice }]
 * @param fees  [{ label, amount }]  — áp dụng cho toàn bộ lines trong nhóm
 * @returns { byItem: { [id]: { goods, feeShare, total } }, goodsTotal, feeTotal, grandTotal }
 */
export function allocateFees(lines, fees) {
  const goodsById = {};
  let goodsTotal = 0;
  for (const l of lines) {
    const g = (Number(l.qty) || 0) * (Number(l.unitPrice) || 0);
    goodsById[l.id] = g;
    goodsTotal += g;
  }
  const feeTotal = (fees || []).reduce((s, f) => s + (Number(f.amount) || 0), 0);

  const byItem = {};
  for (const l of lines) {
    const goods = goodsById[l.id];
    // Tổng giá trị = 0 → chia đều để không "bốc hơi" mất tiền phí
    const share = goodsTotal > 0
      ? (feeTotal * goods) / goodsTotal
      : (lines.length ? feeTotal / lines.length : 0);
    byItem[l.id] = { goods, feeShare: share, total: goods + share };
  }
  return {
    byItem,
    goodsTotal,
    feeTotal,
    // Chỉ làm tròn ở BƯỚC CUỐI, và làm tròn LÊN hàng đơn vị đồng
    grandTotal: Math.ceil(goodsTotal + feeTotal),
  };
}
