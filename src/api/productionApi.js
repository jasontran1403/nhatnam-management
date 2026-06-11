import api from './axios';

// ── Analytics ─────────────────────────────────────────────────────────────────
export const analyticsApi = {
  getBusinessAnalytics: (period = 'MONTH') =>
    api.get('/api/owner/analytics', { params: { period } }).then(r => r.data.data),
};

// ── Factory Materials ─────────────────────────────────────────────────────────
export const factoryMaterialApi = {
  list: (activeOnly = true) =>
    api.get('/api/owner/factory/materials', { params: { activeOnly } }).then(r => r.data.data),
  create: (data) =>
    api.post('/api/owner/factory/materials', data).then(r => r.data.data),
  update: (id, data) =>
    api.put(`/api/owner/factory/materials/${id}`, data).then(r => r.data.data),
  toggle: (id, active) =>
    api.patch(`/api/owner/factory/materials/${id}/toggle`, null, { params: { active } }),
};

// ── Factory Products ──────────────────────────────────────────────────────────
export const factoryProductApi = {
  list: (activeOnly = true) =>
    api.get('/api/owner/factory/products', { params: { activeOnly } }).then(r => r.data.data),
  create: (data) =>
    api.post('/api/owner/factory/products', data).then(r => r.data.data),
  update: (id, data) =>
    api.put(`/api/owner/factory/products/${id}`, data).then(r => r.data.data),
};

// ── Production Recipes ────────────────────────────────────────────────────────
export const recipeApi = {
  list: (productId) =>
    api.get('/api/owner/factory/recipes', { params: productId ? { productId } : {} }).then(r => r.data.data),
  get: (id) =>
    api.get(`/api/owner/factory/recipes/${id}`).then(r => r.data.data),
  create: (data) =>
    api.post('/api/owner/factory/recipes', data).then(r => r.data.data),
  update: (id, data) =>
    api.put(`/api/owner/factory/recipes/${id}`, data).then(r => r.data.data),
  toggle: (id, active) =>
    api.patch(`/api/owner/factory/recipes/${id}/toggle`, null, { params: { active } }),
};

// ── Production Batches (Owner) ────────────────────────────────────────────────
export const batchOwnerApi = {
  list: (page = 0, size = 20) =>
    api.get('/api/owner/factory/batches', { params: { page, size } }).then(r => r.data.data),
  get: (id) =>
    api.get(`/api/owner/factory/batches/${id}`).then(r => r.data.data),
  markReviewed: (id) =>
    api.patch(`/api/owner/factory/batches/${id}/reviewed`).then(r => r.data.data),
};

// ── Production Batches (Factory Worker) ───────────────────────────────────────
export const factoryWorkerApi = {
  listMyBatches: (page = 0, size = 20) =>
    api.get('/api/factory/batches', { params: { page, size } }).then(r => r.data.data),
  createBatch: (data) =>
    api.post('/api/factory/batches', data).then(r => r.data.data),
  listRecipes: (productId) =>
    api.get('/api/factory/recipes', { params: productId ? { productId } : {} }).then(r => r.data.data),
  listProducts: () =>
    api.get('/api/factory/products').then(r => r.data.data),
  listMaterials: () =>
    api.get('/api/factory/materials').then(r => r.data.data),
};

export const ownerProductionApi = {

  // ── Products & Materials (đã có, expose cho Owner) ────────────────────────
  listProducts: (activeOnly = true) =>
    api.get(`/api/owner/factory/products?activeOnly=${activeOnly}`).then(r => r.data.data),

  createProduct: (body) =>
    api.post('/api/owner/factory/products', body).then(r => r.data.data),

  updateProduct: (id, body) =>
    api.put(`/api/owner/factory/products/${id}`, body).then(r => r.data.data),

  listMaterials: (activeOnly = true) =>
    api.get(`/api/owner/factory/materials?activeOnly=${activeOnly}`).then(r => r.data.data),

  createMaterial: (body) =>
    api.post('/api/owner/factory/materials', body).then(r => r.data.data),

  updateMaterial: (id, body) =>
    api.put(`/api/owner/factory/materials/${id}`, body).then(r => r.data.data),

  toggleMaterial: (id, active) =>
    api.patch(`/api/owner/factory/materials/${id}/toggle?active=${active}`).then(r => r.data.data),

  // ── Recipes ───────────────────────────────────────────────────────────────
  listRecipes: (productId) => {
    const qs = productId ? `?productId=${productId}` : '';
    return api.get(`/api/owner/factory/recipes${qs}`).then(r => r.data.data);
  },
  getRecipe: (id) =>
    api.get(`/api/owner/factory/recipes/${id}`).then(r => r.data.data),
  createRecipe: (body) =>
    api.post('/api/owner/factory/recipes', body).then(r => r.data.data),
  updateRecipe: (id, body) =>
    api.put(`/api/owner/factory/recipes/${id}`, body).then(r => r.data.data),

  // ── Batches (Owner review) ────────────────────────────────────────────────
  listAllBatches: (page = 0, size = 20) =>
    api.get(`/api/owner/factory/batches?page=${page}&size=${size}`).then(r => r.data.data),
  getBatch: (id) =>
    api.get(`/api/owner/factory/batches/${id}`).then(r => r.data.data),
  markBatchReviewed: (id) =>
    api.patch(`/api/owner/factory/batches/${id}/reviewed`).then(r => r.data.data),

  // ── Machines (MỚI) ────────────────────────────────────────────────────────
  listMachines: (activeOnly = true) =>
    api.get(`/api/owner/factory/machines?activeOnly=${activeOnly}`).then(r => r.data.data),
  createMachine: (body) =>
    api.post('/api/owner/factory/machines', body).then(r => r.data.data),
  updateMachine: (id, body) =>
    api.put(`/api/owner/factory/machines/${id}`, body).then(r => r.data.data),
  toggleMachine: (id, active) =>
    api.patch(`/api/owner/factory/machines/${id}/toggle?active=${active}`).then(r => r.data.data),

  // ── Maintenance Schedule (MỚI) ────────────────────────────────────────────
  getMaintenanceSummary: (year, machineId) => {
    const qs = [`year=${year}`, machineId ? `machineId=${machineId}` : ''].filter(Boolean).join('&');
    return api.get(`/api/owner/factory/maintenance?${qs}`).then(r => r.data.data);
  },
  createMaintenance: (body) =>
    api.post('/api/owner/factory/maintenance', body).then(r => r.data.data),
  updateMaintenance: (id, body) =>
    api.put(`/api/owner/factory/maintenance/${id}`, body).then(r => r.data.data),
  completeMaintenance: (id, body) =>
    api.patch(`/api/owner/factory/maintenance/${id}/complete`, body).then(r => r.data.data),
  deleteMaintenance: (id) =>
    api.delete(`/api/owner/factory/maintenance/${id}`).then(r => r.data.data),

  // ── Annual MPS (MỚI) ──────────────────────────────────────────────────────
  getMpsDashboard: (year, productId) => {
    const qs = [`year=${year}`, productId ? `productId=${productId}` : ''].filter(Boolean).join('&');
    return api.get(`/api/owner/factory/mps/dashboard?${qs}`).then(r => r.data.data);
  },
  listMps: (year, productId) => {
    const qs = [`year=${year}`, productId ? `productId=${productId}` : ''].filter(Boolean).join('&');
    return api.get(`/api/owner/factory/mps?${qs}`).then(r => r.data.data);
  },
  createMps: (body) =>
    api.post('/api/owner/factory/mps', body).then(r => r.data.data),
  updateMps: (id, body) =>
    api.put(`/api/owner/factory/mps/${id}`, body).then(r => r.data.data),
  updateMpsStatus: (id, status) =>
    api.patch(`/api/owner/factory/mps/${id}/status?status=${status}`).then(r => r.data.data),
  deleteMps: (id) =>
    api.delete(`/api/owner/factory/mps/${id}`).then(r => r.data.data),

  // ── Work Orders (MỚI) ─────────────────────────────────────────────────────
  listWorkOrders: (page = 0, size = 20, status) => {
    const qs = [`page=${page}`, `size=${size}`, status ? `status=${status}` : ''].filter(Boolean).join('&');
    return api.get(`/api/owner/factory/work-orders?${qs}`).then(r => r.data.data);
  },
  getWorkOrder: (id) =>
    api.get(`/api/owner/factory/work-orders/${id}`).then(r => r.data.data),
  createWorkOrder: (body) =>
    api.post('/api/owner/factory/work-orders', body).then(r => r.data.data),
  updateWorkOrderStatus: (id, body) =>
    api.patch(`/api/owner/factory/work-orders/${id}/status`, body).then(r => r.data.data),
};