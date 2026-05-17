// src/components/common/PrivateRoute.jsx
import { Navigate } from 'react-router-dom';

function getDefaultPath(role) {
  switch (role) {
    case 'ADMIN':             return '/admin/dashboard';
    case 'OWNER':             return '/owner/dashboard';
    case 'WAREHOUSE':         return '/warehouse/management';
    case 'SUPER_WAREHOUSE':   return '/super-warehouse/management';
    case 'ACCOUNTANT':        return '/accountant/dashboard';
    case 'SUPER_ACCOUNTANT':  return '/super-accountant/dashboard';
    case 'OPERATOR':          return '/operator/categories';
    case 'SHIPPER':           return '/shipper/dashboard';
    default:                  return '/seller/pos';
  }
}

export default function PrivateRoute({ children, allowedRoles }) {
  let user = null;
  try { user = JSON.parse(localStorage.getItem('user')); } catch {}

  if (!user) return <Navigate to="/login" replace />;

  if (allowedRoles) {
    const role = user.role ?? user.roles?.[0] ?? '';
    if (!allowedRoles.includes(role)) {
      return <Navigate to={getDefaultPath(role)} replace />;
    }
  }

  return children;
}