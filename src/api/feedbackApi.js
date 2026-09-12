// src/api/feedbackApi.js
import api from './axios';

const unwrap = (res) => {
  const body = res?.data;
  if (body && typeof body === 'object' && 'success' in body) {
    if (!body.success) throw new Error(body.message || 'Request failed');
    return body.data;
  }
  return body;
};

/**
 * FEEDBACK API.
 *
 * <p>Flow tạo feedback: FE upload ảnh trước (uploadImages) → gọi create với imageUrls
 * lấy về. Tách 2 bước để một ảnh fail không mất form.
 */
export const feedbackApi = {
  /** Tra đơn: KH + list SP (đã bỏ SP KM). */
  lookup: (orderCode) =>
    api.get(`/api/feedback/lookup/${encodeURIComponent(orderCode)}`).then(unwrap),

  /** Feedback đã có của một đơn — sort desc theo createdAt. Dùng cho seller/warehouse. */
  listByOrder: (orderCode) =>
    api.get(`/api/feedback/by-order/${encodeURIComponent(orderCode)}`).then(unwrap),

  /**
   * Upload nhiều ảnh cùng lúc. Trả về { urls: [...] } (list URL để gán vào create).
   * @param {File[]} files
   */
  uploadImages: (files) => {
    const form = new FormData();
    files.forEach(f => form.append('files', f));
    return api.post('/api/feedback/images', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(unwrap);
  },

  create: (payload) => api.post('/api/feedback', payload).then(unwrap),

  list: (params) =>
    api.get('/api/feedback', {
      params: {
        q: params?.q || undefined,
        page: params?.page ?? 0,
        size: params?.size ?? 20,
      },
    }).then(unwrap),
};
