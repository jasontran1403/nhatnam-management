// src/api/payrollPasscodeApi.js
// MẬT KHẨU XEM LƯƠNG (passcode 6 số) — tách riêng khỏi mật khẩu đăng nhập.
import api from './axios';

const r = (res) => res.data?.data ?? res.data;

/** Mã nghiệp vụ backend trả về — khớp với StatusCode.java. */
export const PASSCODE_CODE = {
  REQUIRED: 951,   // chưa nhập / hết hạn  → bật màn hình nhập passcode
  WRONG:    952,   // sai passcode         → data.remainingAttempts
  LOCKED:   953,   // khoá, liên hệ admin
};

/**
 * Bóc thông tin lỗi từ interceptor axios.
 *
 * <p>Interceptor reject MỌI code khác 900 và gắn `err.businessCode` +
 * `err.response`. Các màn hình passcode cần đọc cả `data.remainingAttempts`
 * nên gom việc bóc tách vào một chỗ thay vì lặp lại ở từng component.
 */
export function parsePasscodeError(e) {
  const code = e?.businessCode ?? e?.response?.data?.code;
  const data = e?.response?.data?.data || {};
  return {
    code,
    locked: code === PASSCODE_CODE.LOCKED || data.locked === true,
    wrong: code === PASSCODE_CODE.WRONG,
    required: code === PASSCODE_CODE.REQUIRED,
    remainingAttempts:
      typeof data.remainingAttempts === 'number' ? data.remainingAttempts : null,
    message: e?.response?.data?.message || e?.message || 'Có lỗi xảy ra',
  };
}

export const payrollPasscodeApi = {
  /** { locked, failCount, remainingAttempts, maxAttempts, usingDefault, unlocked, accessExpiresAt, lockedAt } */
  status: () => api.get('/api/payroll-passcode/status').then(r),

  /** Nhập 6 số. Đúng → backend cấp "vé" xem lương 15 phút. */
  verify: (passcode) =>
    api.post('/api/payroll-passcode/verify', { passcode }).then(r),

  /** Đổi passcode: cần passcode cũ + 2 lần nhập passcode mới. */
  change: (currentPasscode, newPasscode, confirmPasscode) =>
    api.put('/api/payroll-passcode', {
      currentPasscode, newPasscode, confirmPasscode,
    }).then(r),

  /** Chủ động huỷ vé (rời trang lương / bấm "Khoá lại"). */
  lock: () => api.post('/api/payroll-passcode/lock').then(r),

  // ── Quản trị ───────────────────────────────────────────────────────────────

  lockedUsers: () => api.get('/api/payroll-passcode/locked-users').then(r),

  /** reset=true → đưa passcode của nhân viên về 000000. */
  unlock: (userId, reset = true) =>
    api.post(`/api/payroll-passcode/${userId}/unlock`, null, { params: { reset } }).then(r),
};

export default payrollPasscodeApi;
