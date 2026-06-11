// src/api/axios.js
import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
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

// Các code lỗi business (server trả HTTP 200 nhưng là lỗi thực sự)
const BUSINESS_ERROR_CODES = new Set([921, 922, 924, 925, 926, 927, 928, 929, 930]);

api.interceptors.response.use(
  (res) => {
    // Backend luôn trả HTTP 200 — check business code trong body
    const code = res.data?.code;
    if (code && SESSION_EXPIRED_CODES.has(code)) {
      handleSessionExpired(res.data?.message);
    }
    // Throw business errors so catch blocks in components work normally
    if (code && BUSINESS_ERROR_CODES.has(code)) {
      const err = new Error(res.data?.message || 'Có lỗi xảy ra');
      err.response = res;  // giữ lại response để catch có thể đọc
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