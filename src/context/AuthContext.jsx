// src/context/AuthContext.jsx
import { createContext, useContext, useState, useCallback } from 'react';
import { authApi } from '../api/services';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
  });
  const [token, setToken] = useState(() => localStorage.getItem('token'));

  /**
   * login(username, password, selectedRole?)
   * - selectedRole: null = lần đầu (backend sẽ trả requireRoleSelection nếu có nhiều role)
   * - selectedRole: 'ADMIN' | 'ACCOUNTANT' | ... = đăng nhập chính thức với role này
   *
   * Trả về data từ backend:
   * - { requireRoleSelection: true, availableRoles: [...] } → frontend hiện popup
   * - { accessToken, role, ... } → đăng nhập thành công
   */
  const login = useCallback(async (username, password, selectedRole = null) => {
    const res = await authApi.login({ username, password, selectedRole });
    const { data } = res.data;

    // Nếu backend yêu cầu chọn role → không lưu token, chỉ trả data cho UI xử lý
    if (data.requireRoleSelection) {
      return data;
    }

    // Đăng nhập thành công
    localStorage.setItem('token', data.accessToken);
    localStorage.setItem('user', JSON.stringify(data));
    setToken(data.accessToken);
    setUser(data);
    return data;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
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
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated, role, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
