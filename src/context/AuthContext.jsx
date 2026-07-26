// src/context/AuthContext.jsx
import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { authApi } from '../api/services';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
  });
  const [token, setToken] = useState(() => localStorage.getItem('token'));

  const login = useCallback(async (username, password, selectedRole = null) => {
    const res = await authApi.login({ username, password, selectedRole });
    const { data } = res.data;

    // Backend tự detect defaultRole (user.role field) khi không chọn role
    // Nếu vẫn requireRoleSelection thì user chưa có default → frontend hiện popup
    if (data.requireRoleSelection) {
      return data;
    }

    localStorage.setItem('token', data.accessToken);
    localStorage.setItem('user', JSON.stringify(data));
    setToken(data.accessToken);
    setUser(data);
    return data;
  }, []);

  /**
   * Switch role — gọi API với token hiện tại, nhận token mới với role mới.
   */
  const switchRole = useCallback(async (newRole) => {
    const res = await authApi.switchRole(newRole);
    const data = res.data?.data ?? res.data;
    localStorage.setItem('token', data.accessToken);
    localStorage.setItem('user', JSON.stringify(data));
    setToken(data.accessToken);
    setUser(data);
    return data;
  }, []);

  /**
   * Set role mặc định — lưu vào DB qua API.
   * role = null để bỏ default.
   */
  const setDefaultRole = useCallback(async (role) => {
    await authApi.setDefaultRole(role);
    // Cập nhật user object local để UI reflect ngay
    if (user) {
      const updated = { ...user, defaultRole: role };
      localStorage.setItem('user', JSON.stringify(updated));
      setUser(updated);
    }
  }, [user]);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('app_lang');
    localStorage.removeItem('app-version-code');
    setToken(null);
    setUser(null);
  }, []);

  const updateUser = useCallback((newData) => {
    const updated = { ...user, ...newData };
    localStorage.setItem('user', JSON.stringify(updated));
    setUser(updated);
  }, [user]);

  /* ════════════════════════════════════════════════════════════════════════
     NẠP LẠI PHIÊN KHI MỞ / F5 TRANG
     ════════════════════════════════════════════════════════════════════════
     Trước đây user object chỉ được ghi vào localStorage LÚC ĐĂNG NHẬP rồi
     không bao giờ đọc lại. OWNER gán thêm role hay đổi role thì nhân viên phải
     đăng xuất đăng nhập lại mới thấy — vì menu và route guard đọc từ bản cache
     cũ đó, dù backend đã cấp quyền mới ngay lập tức.

     Gọi /api/auth/me một lần lúc mount là đủ để F5 có role mới.

     KHÔNG chặn render trong lúc chờ: mạng chậm mà treo cả app thì tệ hơn nhiều
     so với việc menu cũ hiển thị thêm nửa giây rồi tự cập nhật. */
  const refreshedRef = useRef(false);

  useEffect(() => {
    if (refreshedRef.current) return;      // StrictMode gọi effect 2 lần
    if (!token) return;
    refreshedRef.current = true;

    let alive = true;
    authApi.me()
      .then(res => {
        if (!alive) return;
        const body = res.data;
        const fresh = body?.data;
        if (!body?.success || !fresh) return;   // lỗi nghiệp vụ → giữ nguyên phiên

        // accessToken null = token cũ vẫn dùng tốt. Chỉ có token mới khi role
        // đang chọn đã bị thu hồi và BE phải cấp lại.
        if (fresh.accessToken) {
          localStorage.setItem('token', fresh.accessToken);
          setToken(fresh.accessToken);
        }
        setUser(prev => {
          const merged = { ...prev, ...fresh, accessToken: fresh.accessToken || prev?.accessToken };
          localStorage.setItem('user', JSON.stringify(merged));
          return merged;
        });
      })
      .catch(() => {
        /* Lỗi mạng thì im lặng bỏ qua — KHÔNG đăng xuất. Rớt mạng lúc mở app mà
           bị đá ra đăng nhập lại là hành vi tệ hơn hẳn việc dùng tạm role cũ.
           Token hỏng/hết hạn đã có interceptor của axios lo. */
      });

    return () => { alive = false; };
  }, [token]);

  const isAuthenticated = !!token && !!user;
  const role = user?.role || user?.roles?.[0] || '';

  return (
    <AuthContext.Provider value={{
      user, token, login, logout,
      switchRole, setDefaultRole,
      isAuthenticated, role, updateUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);