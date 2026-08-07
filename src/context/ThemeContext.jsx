/**
 * ThemeContext — quản lý light / dark / theo hệ thống.
 *
 * Cơ chế: gắn hoặc gỡ class `.dark` trên <html>. Toàn bộ token trong
 * styles/tokens.css đổi giá trị theo class này, nên không component nào phải
 * biết theme hiện tại là gì — trừ khi nó cần render icon khác nhau.
 */
import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';

const STORAGE_KEY = 'app_theme';

/** 'light' | 'dark' | 'system' */
const VALID = ['light', 'dark', 'system'];

const ThemeContext = createContext(null);

function readStored() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return VALID.includes(v) ? v : 'system';
  } catch {
    // localStorage có thể bị chặn (chế độ riêng tư, iframe cross-origin)
    return 'system';
  }
}

function systemPrefersDark() {
  return typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
}

/** Áp class lên <html>. Tách riêng để applyTheme() dùng được cả ngoài React. */
export function applyThemeClass(resolved) {
  const root = document.documentElement;
  root.classList.toggle('dark', resolved === 'dark');
  root.style.colorScheme = resolved;
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(readStored);
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  // Theme thực sự đang hiển thị, sau khi giải nghĩa 'system'.
  const resolvedTheme = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;

  // Theo dõi thay đổi cài đặt của hệ điều hành — người dùng có thể bật dark mode
  // giữa chừng, app phải đổi theo ngay chứ không đợi tải lại trang.
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const onChange = (e) => setSystemDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    applyThemeClass(resolvedTheme);
  }, [resolvedTheme]);

  const setTheme = useCallback((next) => {
    if (!VALID.includes(next)) return;
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* bỏ qua */ }
    setThemeState(next);
  }, []);

  /** Đảo nhanh giữa sáng và tối. Nếu đang 'system' thì chọn ngược lại với hệ thống. */
  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  }, [resolvedTheme, setTheme]);

  const value = useMemo(
    () => ({ theme, resolvedTheme, isDark: resolvedTheme === 'dark', setTheme, toggleTheme }),
    [theme, resolvedTheme, setTheme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme phải nằm trong <ThemeProvider>');
  return ctx;
}

/**
 * Script chạy trước khi React mount, để tránh nháy trắng một nhịp khi tải trang
 * ở chế độ tối. Nhúng chuỗi này vào <script> trong index.html, đặt trong <head>.
 */
export const THEME_INIT_SCRIPT = `
(function(){try{
  var s=localStorage.getItem('${STORAGE_KEY}');
  var d=s==='dark'||((!s||s==='system')&&matchMedia('(prefers-color-scheme: dark)').matches);
  if(d){document.documentElement.classList.add('dark');}
  document.documentElement.style.colorScheme=d?'dark':'light';
}catch(e){}})();
`.trim();
