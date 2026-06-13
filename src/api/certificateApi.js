import api from './axios';

const unwrap = (r) => r.data?.data ?? r.data;

export const certificateApi = {
  /** Danh sách sản phẩm có chứng nhận (kèm số lượng) */
  listProductsWithCerts: () =>
    api.get('/api/certificates/products').then(unwrap),

  /** Danh sách tất cả sản phẩm để chọn khi upload */
  listAllProducts: () =>
    api.get('/api/certificates/all-products').then(unwrap),

  /** Danh sách chứng nhận của 1 sản phẩm */
  listByProduct: (productId) =>
    api.get(`/api/certificates/by-product/${productId}`).then(unwrap),

  /** Tạo chứng nhận mới (multipart) */
  create: (formData) =>
    api.post('/api/certificates', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(unwrap),

  /** Xóa chứng nhận */
  deleteCert: (id) =>
    api.delete(`/api/certificates/${id}`).then(unwrap),

  /** Xóa 1 file trong chứng nhận */
  deleteFile: (certId, fileId) =>
    api.delete(`/api/certificates/${certId}/files/${fileId}`).then(unwrap),
};
