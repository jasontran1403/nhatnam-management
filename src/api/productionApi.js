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
