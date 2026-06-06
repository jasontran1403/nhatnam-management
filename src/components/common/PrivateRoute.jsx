import { Navigate } from 'react-router-dom';
import { ROLE_DEFAULT_PATH } from '../layout/navConfigs';

export default function PrivateRoute({ children, allowedRoles }) {
  let user = null;
  try { user = JSON.parse(localStorage.getItem('user')); } catch {}

  if (!user) return <Navigate to="/login" replace />;

  if (allowedRoles) {
    const role = user.role ?? user.roles?.[0] ?? '';
    if (!allowedRoles.includes(role)) {
      return <Navigate to={ROLE_DEFAULT_PATH[role] || '/seller/dashboard'} replace />;
    }
  }

  return children;
}
