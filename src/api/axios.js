// src/api/axios.js
import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true'
  },
});

// ── Attach JWT ────────────────────────────────────────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Response: xử lý token hết hạn / không hợp lệ ────────────────────────────
// Code 923 = token hết hạn, 901 = thiếu/sai token
const SESSION_EXPIRED_CODES = new Set([923, 901]);
let _sessionExpiredAt = 0;

function handleSessionExpired(message) {
  if (!localStorage.getItem('token')) return;  // đã logout rồi → bỏ qua
  if (Date.now() - _sessionExpiredAt < 5000) return;  // cooldown 5 giây
  _sessionExpiredAt = Date.now();

  // Hiện toast — dùng event để Toast provider bên React bắt
  window.dispatchEvent(new CustomEvent('app:session-expired', {
    detail: { message: message || 'Phiên đăng nhập đã hết, vui lòng đăng nhập lại.' },
  }));

  // Sau 3 giây (đủ để user đọc toast) → clear + redirect
  setTimeout(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  }, 3000);
}

// ⚠️ FIX LỖI NGHIÊM TRỌNG:
// Backend LUÔN trả HTTP 200, lỗi nằm ở `code` trong body (900 = thành công).
// Bản cũ chỉ reject với một danh sách code cứng {921,922,924...} — nghĩa là các lỗi
// phổ biến nhất (903 BAD_REQUEST, 904 NOT_FOUND, 902 FORBIDDEN, 905 CONFLICT,
// 906 VALIDATION_ERROR, 947 OUT_OF_STOCK, 941, 942, 950...) KHÔNG bị reject
// → khối try/catch ở component chạy vào nhánh thành công, toast báo "Thành công"
// dù server đã từ chối. Rất nguy hiểm với các thao tác kho/kế toán.
//
// Fix: MỌI code khác 900 đều là lỗi → reject để catch block xử lý đúng.
const SUCCESS_CODE = 900;

api.interceptors.response.use(
  (res) => {
    const code = res.data?.code;

    // Không có code (blob, file download, endpoint ngoài chuẩn) → trả nguyên
    if (code === undefined || code === null) return res;

    if (SESSION_EXPIRED_CODES.has(code)) {
      handleSessionExpired(res.data?.message);
    }

    if (code !== SUCCESS_CODE) {
      const err = new Error(res.data?.message || 'Có lỗi xảy ra');
      err.response = res;      // giữ lại response để catch có thể đọc message
      err.businessCode = code;
      return Promise.reject(err);
    }
    return res;
  },
  (err) => {
    // HTTP 401 fallback (nếu có)
    if (err.response?.status === 401) {
      handleSessionExpired('Phiên đăng nhập đã hết, vui lòng đăng nhập lại.');
    }
    return Promise.reject(err);
  }
);

export default api;