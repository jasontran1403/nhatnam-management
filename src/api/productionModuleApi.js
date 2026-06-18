// src/api/productionModuleApi.js
// API client cho Production Module v2
import api from './axios';

// ── Upload helper ─────────────────────────────────────────────────────────────
async function uploadFiles(endpoint, params, files) {
  const form = new FormData();
  Object.entries(params).forEach(([k, v]) => form.append(k, v));
  files.forEach(f => form.append('files', f));
  const res = await api.post(endpoint, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.data; // List<String> URLs
}

// ── Owner APIs ────────────────────────────────────────────────────────────────

export const ownerProdApi = {
  // Dashboard
  getDashboard: () =>
    api.get('/api/owner/production/dashboard').then(r => r.data.data),

  // Plans
  listPlans: (page = 0, size = 20, status) =>
    api.get('/api/owner/production/plans', { params: { page, size, status } }).then(r => r.data.data),
  getPlan: (id) =>
    api.get(`/api/owner/production/plans/${id}`).then(r => r.data.data),
  listPlanWorkOrders: (planId) =>
    api.get(`/api/owner/production/plans/${planId}/work-orders`).then(r => r.data.data),
  createPlan: (body) =>
    api.post('/api/owner/production/plans', body).then(r => r.data.data),
  updatePlanStatus: (id, status) =>
    api.patch(`/api/owner/production/plans/${id}/status`, null, { params: { status } }).then(r => r.data.data),

  // Work Orders
  listWorkOrders: (page = 0, size = 20, status) =>
    api.get('/api/owner/production/work-orders', { params: { page, size, status } }).then(r => r.data.data),
  getWorkOrderDetail: (id) =>
    api.get(`/api/owner/production/work-orders/${id}`).then(r => r.data.data),
  createWorkOrder: (body) =>
    api.post('/api/owner/production/work-orders', body).then(r => r.data.data),
  extendWorkOrder: (id, body) =>
    api.patch(`/api/owner/production/work-orders/${id}/extend`, body).then(r => r.data.data),
  updateWorkOrderStatus: (id, body) =>
    api.patch(`/api/owner/production/work-orders/${id}/status`, body).then(r => r.data.data),

  // Machines
  listMachines: (activeOnly = false) =>
    api.get('/api/owner/production/machines', { params: { activeOnly } }).then(r => r.data.data),
  createMachine: (body) =>
    api.post('/api/owner/production/machines', body).then(r => r.data.data),
  updateMachine: (id, body) =>
    api.put(`/api/owner/production/machines/${id}`, body).then(r => r.data.data),
  toggleMachine: (id, active) =>
    api.patch(`/api/owner/production/machines/${id}/toggle`, null, { params: { active } }).then(r => r.data.data),

  // Maintenance
  listMaintenance: (year, machineId) =>
    api.get('/api/owner/production/maintenance', { params: { year, machineId } }).then(r => r.data.data),

  // Machine occupancy (WorkOrder/Batch đang chiếm máy) — cho Gantt sọc chéo xanh dương
  listMachineOccupancy: (fromMs, toMs) =>
    api.get('/api/owner/production/machine-occupancy', { params: { fromMs, toMs } }).then(r => r.data.data),

  // Factories (xưởng)
  listFactories: () =>
    api.get('/api/owner/production/factories').then(r => r.data.data),
  createFactory: (body) =>
    api.post('/api/owner/production/factories', body).then(r => r.data.data),
  updateFactoryManagers: (id, body) =>
    api.patch(`/api/owner/production/factories/${id}/managers`, body).then(r => r.data.data),
  toggleFactory: (id, active) =>
    api.patch(`/api/owner/production/factories/${id}/toggle`, null, { params: { active } }).then(r => r.data.data),
};

// ── Factory Worker APIs ───────────────────────────────────────────────────────

export const factoryProdApi = {
  // Work Orders — xem theo xưởng (không lọc theo user nữa)
  listMyOrders: (factoryId) =>
    api.get('/api/factory/work-orders', { params: factoryId ? { factoryId } : {} }).then(r => r.data.data),
  listMyFactories: () =>
    api.get('/api/factory/my-factories').then(r => r.data.data),
  getOrderDetail: (id) =>
    api.get(`/api/factory/work-orders/${id}`).then(r => r.data.data),

  // Biến thể sản xuất — lọc theo FactoryProduct của lệnh để chọn khi lập phương án
  listRecipesByProduct: (factoryProductId) =>
    api.get('/api/factory/recipes', { params: factoryProductId ? { productId: factoryProductId } : {} }).then(r => r.data.data),

  // Lập phương án theo Biến thể sản xuất (chọn biến thể + nhập sản lượng cần SX)
  previewPlan: (workOrderId, recipeId, requestedQty) =>
    api.get(`/api/factory/work-orders/${workOrderId}/plan-preview`, { params: { recipeId, requestedQty } }).then(r => r.data.data),
  submitPlanByRecipe: (workOrderId, body) =>
    api.post(`/api/factory/work-orders/${workOrderId}/plan-by-recipe`, body).then(r => r.data.data),

  // Bắt đầu sản xuất
  startOrder: (workOrderId) =>
    api.post(`/api/factory/work-orders/${workOrderId}/start`).then(r => r.data.data),

  // Batch operations
  startBatch: (body) =>
    api.post('/api/factory/batches/start', body).then(r => r.data.data),
  startStep: (batchId, stepSeq, body) =>
    api.post(`/api/factory/batches/${batchId}/steps/${stepSeq}/start`, body || {}).then(r => r.data.data),
  completeStep: (batchId, stepSeq, body) =>
    api.post(`/api/factory/batches/${batchId}/steps/${stepSeq}/complete`, body).then(r => r.data.data),
  completeBatch: (batchId, body) =>
    api.post(`/api/factory/batches/${batchId}/complete`, body).then(r => r.data.data),
  cancelBatch: (batchId, body) =>
    api.post(`/api/factory/batches/${batchId}/cancel`, body).then(r => r.data.data),
  // Danh sách NVL đã trừ kho (chưa hoàn) của lệnh sản xuất — dùng cho form huỷ mẻ
  getMaterialUsage: (workOrderId) =>
    api.get(`/api/factory/work-orders/${workOrderId}/material-usage`).then(r => r.data.data),


  // Material Vendors (NCC nguyên liệu / máy móc / sửa chữa)
  listVendors: (q = '', types = '') =>
    api.get('/api/factory/material-vendors', { params: { ...(q?{q}:{}), ...(types?{types}:{}) } }).then(r => r.data.data),
  createVendor: (body) =>
    api.post('/api/factory/material-vendors', body).then(r => r.data.data),
  updateVendor: (id, body) =>
    api.put(`/api/factory/material-vendors/${id}`, body).then(r => r.data.data),
  deleteVendor: (id) =>
    api.delete(`/api/factory/material-vendors/${id}`).then(r => r.data.data),

  // Machines
  listMachines: () =>
    api.get('/api/factory/machines').then(r => r.data.data),
  createMachine: (body) =>
    api.post('/api/factory/machines', body).then(r => r.data.data),

  // Maintenance
  listMaintenance: (year) =>
    api.get('/api/factory/maintenance', { params: { year } }).then(r => r.data.data),
  createMaintenance: (body) =>
    api.post('/api/factory/maintenance', body).then(r => r.data.data),
  completeMaintenance: (id, body) =>
    api.patch(`/api/factory/maintenance/${id}/complete`, body).then(r => r.data.data),
  deleteMaintenance: (id) =>
    api.delete(`/api/factory/maintenance/${id}`).then(r => r.data.data),

  // Preset bước sản xuất (BatchStepTemplate)
  listStepTemplates: () =>
    api.get('/api/factory/step-templates').then(r => r.data.data),
  createStepTemplate: (body) =>
    api.post('/api/factory/step-templates', body).then(r => r.data.data),
};

// ── Upload APIs ───────────────────────────────────────────────────────────────

export const productionUploadApi = {
  uploadBatchStepImages: (batchId, stepSeq, files) =>
    uploadFiles('/api/upload/production/batch-step', { batchId, stepSeq }, files),
  uploadBatchCancelImages: (batchId, files) =>
    uploadFiles('/api/upload/production/batch-cancel', { batchId }, files),
  uploadMaintenanceBefore: (maintenanceId, files) =>
    uploadFiles('/api/upload/production/maintenance-before', { maintenanceId }, files),
  uploadMaintenanceAfter: (maintenanceId, files) =>
    uploadFiles('/api/upload/production/maintenance-after', { maintenanceId }, files),
  uploadMaintenanceReceipt: (maintenanceId, files) =>
    uploadFiles('/api/upload/production/maintenance-receipt', { maintenanceId }, files),
  uploadMaterialInvoice: (workOrderId, files) =>
    uploadFiles('/api/upload/production/material-invoice', { workOrderId }, files),
};

// ── Shared helpers ────────────────────────────────────────────────────────────

export const STATUS_LABELS = {
  SCHEDULED:    { label: 'Hẹn giờ',         cls: 'bg-blue-100 text-blue-700',    dot: 'bg-blue-400' },
  PENDING_PLAN: { label: 'Chờ phương án',    cls: 'bg-amber-100 text-amber-700',  dot: 'bg-amber-400' },
  PLANNED:      { label: 'Đã lên phương án', cls: 'bg-indigo-100 text-indigo-700',dot: 'bg-indigo-400' },
  IN_PROGRESS:  { label: 'Đang sản xuất',    cls: 'bg-orange-100 text-orange-700',dot: 'bg-orange-400' },
  COMPLETED:    { label: 'Hoàn thành',       cls: 'bg-emerald-100 text-emerald-700',dot:'bg-emerald-400' },
  CANCELLED:    { label: 'Đã huỷ',           cls: 'bg-red-100 text-red-600',      dot: 'bg-red-400' },
  ACTIVE:       { label: 'Đang triển khai',  cls: 'bg-emerald-100 text-emerald-700',dot:'bg-emerald-400' },
};

// Màu progress bar / Gantt theo % tiến độ
export function progressColor(pct) {
  const v = Number(pct || 0);
  if (v > 100) return { bg: 'bg-emerald-700', text: 'text-emerald-700', hex: '#047857' };
  if (v >= 100) return { bg: 'bg-emerald-500', text: 'text-emerald-600', hex: '#10b981' };
  if (v >= 75)  return { bg: 'bg-lime-500',    text: 'text-lime-600',    hex: '#84cc16' };
  if (v >= 50)  return { bg: 'bg-yellow-400',  text: 'text-yellow-600',  hex: '#facc15' };
  if (v >= 25)  return { bg: 'bg-orange-400',  text: 'text-orange-600',  hex: '#fb923c' };
  return             { bg: 'bg-red-400',      text: 'text-red-600',     hex: '#f87171' };
}

export const fmtDate = (ms) =>
  ms ? new Date(Number(ms)).toLocaleDateString('vi-VN', { day:'2-digit', month:'2-digit', year:'numeric' }) : '—';

export const fmtNum = (v) =>
  new Intl.NumberFormat('vi-VN').format(Number(v || 0));

export const fmtCurrency = (v) =>
  new Intl.NumberFormat('vi-VN').format(Math.round(Number(v || 0))) + '₫';