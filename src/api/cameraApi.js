// src/api/cameraApi.js
//
// API quản lý camera (OWNER/ADMIN).
// Backend hiện chỉ LƯU thông tin kết nối + danh sách kênh; việc stream thật sẽ
// được bổ sung sau khi camera được lắp đặt.
import api from './axios';

const BASE = '/api/camera';

export const cameraApi = {
  /** Danh sách thiết bị (kèm các kênh camera) */
  getDevices: () => api.get(`${BASE}/devices`),

  getDevice: (id) => api.get(`${BASE}/devices/${id}`),

  /** Tạo thiết bị: { name, host, port, username, password, protocol, vendor, location, note, channelCount } */
  createDevice: (data) => api.post(`${BASE}/devices`, data),

  /** Cập nhật — bỏ trống password để giữ nguyên mật khẩu cũ */
  updateDevice: (id, data) => api.put(`${BASE}/devices/${id}`, data),

  toggleDevice: (id) => api.patch(`${BASE}/devices/${id}/toggle`),

  /** Nạp lại danh sách camera của thiết bị */
  refreshDevice: (id) => api.post(`${BASE}/devices/${id}/refresh`),

  deleteDevice: (id) => api.delete(`${BASE}/devices/${id}`),

  /** Sửa 1 kênh camera: { name, streamUrl, snapshotUrl, resolution, enabled } */
  updateChannel: (deviceId, channelId, data) =>
    api.put(`${BASE}/devices/${deviceId}/channels/${channelId}`, data),
};
