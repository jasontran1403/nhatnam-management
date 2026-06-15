// src/context/AuthContext.jsx
import { createContext, useContext, useState, useCallback } from 'react';
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