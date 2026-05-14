// src/components/common/PrivateRoute.jsx
import { Navigate } from 'react-router-dom';

/**
 * Đọc user từ localStorage key 'user'.
 * allowedRoles: string[] — nếu không truyền thì chỉ cần đăng nhập.
 */
export default function PrivateRoute({ children, allowedRoles }) {
  let user = null;
  try { user = JSON.parse(localStorage.getItem('user')); } catch {}

  // Chưa đăng nhập
  if (!user) return <Navigate to="/login" replace />;

  // Kiểm tra role nếu có yêu cầu
  if (allowedRoles) {
    const role = user.role ?? user.roles?.[0] ?? '';
    if (!allowedRoles.includes(role)) {
      // Redirect về trang mặc định của role đó thay vì vòng lặp
      if (role === 'WAREHOUSE') return <Navigate to="/warehouse/management" replace />;
      if (role === 'ADMIN')     return <Navigate to="/admin/dashboard"      replace />;
      if (role === 'ACCOUNTANT')     return <Navigate to="/accountant/dashboard"      replace />;
      if (role === 'OPERATOR') return <Navigate to="/operator" replace />;
      return <Navigate to="/seller/pos" replace />;
    }
  }

  return children;
}