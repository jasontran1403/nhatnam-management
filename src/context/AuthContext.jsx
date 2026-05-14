import { createContext, useContext, useState, useCallback } from 'react';
import { authApi } from '../api/services';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
  });
  const [token, setToken] = useState(() => localStorage.getItem('token'));

  const login = useCallback(async (username, password) => {
    const res = await authApi.login({ username, password });
    const { data } = res.data;
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

  const isAuthenticated = !!token && !!user;
  const role = user?.role || user?.roles?.[0] || '';

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated, role }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
