// src/api/sellerMaterialApi.js
import api from './axios';

const unwrap = (res) => {
  const body = res?.data;
  if (body && typeof body === 'object' && 'success' in body) {
    if (!body.success) throw new Error(body.message || 'Request failed');
    return body.data;
  }
  return body;
};

const BASE = '/api/seller/material-requests';

export const sellerMaterialApi = {
  /** Nguyên liệu đặt được (đã lọc theo category cho phép) */
  getIngredients: (q) => api.get(`${BASE}/ingredients`, { params: { q } }).then(unwrap),
  /** Danh sách kho để chọn nơi nhận */
  getWarehouses: () => api.get(`${BASE}/warehouses`).then(unwrap),
  /** Tạo phiếu đặt hàng (SELLER) */
  create: (payload) => api.post(BASE, payload).then(unwrap),
  /** Danh sách phiếu của chính mình */
  list: (params) => api.get(BASE, { params }).then(unwrap),
  /** Chi tiết 1 phiếu */
  getById: (id) => api.get(`${BASE}/${id}`).then(unwrap),
  /** Thực nhận + chọn kho từng dòng */
  receive: (id, payload) => api.post(`${BASE}/${id}/receive`, payload).then(unwrap),
};