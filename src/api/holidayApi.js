// src/api/holidayApi.js
// API quản lý Ngày lễ (Phase 1 BE).
import api from './axios';

const r = (res) => res.data?.data ?? res.data;

export const holidayApi = {
  /** Danh sách ngày lễ trong năm, xếp tăng dần theo ngày. */
  listByYear: (year) =>
    api.get('/api/hr/holidays', { params: { year } }).then(r),

  /** Thêm 1 ngày lễ. body: { date: 'yyyy-MM-dd', name } */
  create: (body) =>
    api.post('/api/hr/holidays', body).then(r),

  /** Xoá 1 ngày lễ theo id. */
  delete: (id) =>
    api.delete(`/api/hr/holidays/${id}`).then(r),

  /** Xoá toàn bộ ngày lễ của 1 năm. */
  deleteYear: (year) =>
    api.delete('/api/hr/holidays', { params: { year } }).then(r),

  /**
   * Import file Excel.
   * @param replaceYear nếu truyền, xoá sạch ngày lễ của năm đó trước khi import.
   */
  importExcel: (file, replaceYear) => {
    const fd = new FormData();
    fd.append('file', file);
    return api
      .post('/api/hr/holidays/import', fd, {
        params: replaceYear != null ? { replaceYear } : {},
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then(r);
  },

  /** Tải về file Excel mẫu — trigger download. */
  downloadTemplate: async (year) => {
    const res = await api.get('/api/hr/holidays/template', {
      params: { year },
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mau-ngay-le-${year}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },
};
