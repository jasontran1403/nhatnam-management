import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider, useToast } from './components/common/Toast';
import PrivateRoute from './components/common/PrivateRoute';
import SellerLayout from './components/seller/SellerLayout';
import AdminLayout from './components/admin/AdminLayout';
import WarehouseLayout from './components/warehouse/WarehouseLayout';
import AccountantLayout from './components/accountant/AccountantLayout';
import LoginPage from './pages/auth/LoginPage';
import POSPage from './pages/seller/POSPage';
import OrdersPage from './pages/seller/OrdersPage';
import DashboardPage from './pages/admin/AdminDashboard';
import AdminOrders from './pages/admin/AdminOrders';
import AdminCustomers from './pages/admin/AdminCustomers';
import AdminUsers from './pages/admin/AdminUsers';
import AdminWarehouses from './pages/admin/AdminWarehouses';
import AdminIngredients from './pages/admin/AdminIngredients';
import ManagementPage from './pages/warehouse/ManagementPage';
import OperationsPage from './pages/warehouse/OperationsPage';
import HistoryPage from './pages/warehouse/HistoryPage';
import AccountantDashboardPage from './pages/accountant/AccountantDashboardPage';
import AccountantOrdersPage from './pages/accountant/AccountantOrdersPage';
import WarehouseOrdersPage from './pages/warehouse/WarehouseOrdersPage';
import AccountantCustomersPage from './pages/accountant/AccountantCustomersPage';

import OperatorLayout from './components/operator/OperatorLayout';
import OperatorCategoriesPage from './pages/operator/OperatorCategoriesPage';
import OperatorIngredientsPage from './pages/operator/OperatorIngredientsPage';
import OperatorProductBatchPage from './pages/operator/OperatorProductBatchPage';
import OperatorMyBatchesPage from './pages/operator/OperatorMyBatchesPage';
import AdminBatchApproval from './pages/admin/AdminBatchApproval';

// ── Lắng nghe event token hết hạn từ axios interceptor ───────────────────────
// Phải đặt bên TRONG ToastProvider để useToast hoạt động
function SessionExpiredListener() {
  const toast = useToast();
  useEffect(() => {
    const handler = (e) => {
      toast(e.detail?.message || 'Phiên đăng nhập đã hết, vui lòng đăng nhập lại.', 'error');
    };
    window.addEventListener('app:session-expired', handler);
    return () => window.removeEventListener('app:session-expired', handler);
  }, []);
  return null;
}

// ── Root redirect theo role ───────────────────────────────────────────────────
function RootRedirect() {
  const user = (() => {
    try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
  })();

  if (user?.role === 'ADMIN')             return <Navigate to="/admin/dashboard"      replace />;
  if (user?.role === 'WAREHOUSE')         return <Navigate to="/warehouse/management" replace />;
  if (user?.role === 'ACCOUNTANT')        return <Navigate to="/accountant/dashboard" replace />;
  if (user?.role === 'SUPER_ACCOUNTANT')  return <Navigate to="/super-accountant/dashboard" replace />;
  if (user?.role === 'SHIPPER')           return <Navigate to="/shipper/dashboard"    replace />;
  if (user?.role === 'OPERATOR')          return <Navigate to="/operator/categories"  replace />;
  return <Navigate to="/seller/pos" replace />;
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        {/* SessionExpiredListener phải nằm trong ToastProvider */}
        <SessionExpiredListener />

        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<RootRedirect />} />

            {/* ── SELLER ──────────────────────────────────────────────── */}
            <Route
              path="/seller"
              element={
                <PrivateRoute allowedRoles={['ADMIN', 'SELLER']}>
                  <SellerLayout />
                </PrivateRoute>
              }
            >
              <Route index element={<Navigate to="/seller/pos" replace />} />
              <Route path="pos"    element={<POSPage />} />
              <Route path="orders" element={<OrdersPage />} />
            </Route>

            {/* ── ADMIN ───────────────────────────────────────────────── */}
            <Route
              path="/admin"
              element={
                <PrivateRoute allowedRoles={['ADMIN']}>
                  <AdminLayout />
                </PrivateRoute>
              }
            >
              <Route index element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="dashboard"  element={<DashboardPage />} />
              <Route path="orders"     element={<AdminOrders />} />
              <Route path="customers"  element={<AdminCustomers />} />
              <Route path="users"      element={<AdminUsers />} />
              <Route path="warehouses" element={<AdminWarehouses />} />
              <Route path="ingredients"element={<AdminIngredients />} />
              <Route path="batches"    element={<AdminBatchApproval />} />
            </Route>

            {/* ── OPERATOR ────────────────────────────────────────────── */}
            <Route
              path="/operator"
              element={
                <PrivateRoute allowedRoles={['OPERATOR', 'ADMIN']}>
                  <OperatorLayout />
                </PrivateRoute>
              }
            >
              <Route index element={<Navigate to="/operator/categories" replace />} />
              <Route path="categories"  element={<OperatorCategoriesPage />} />
              <Route path="ingredients" element={<OperatorIngredientsPage />} />
              <Route path="products"    element={<OperatorProductBatchPage />} />
              <Route path="batches"     element={<OperatorMyBatchesPage />} />
            </Route>

            {/* ── WAREHOUSE ───────────────────────────────────────────── */}
            <Route
              path="/warehouse"
              element={
                <PrivateRoute allowedRoles={['ADMIN', 'WAREHOUSE']}>
                  <WarehouseLayout />
                </PrivateRoute>
              }
            >
              <Route index element={<Navigate to="/warehouse/management" replace />} />
              <Route path="management" element={<ManagementPage />} />
              <Route path="operations" element={<OperationsPage />} />
              <Route path="history"    element={<HistoryPage />} />
              <Route path="orders"     element={<WarehouseOrdersPage />} />
            </Route>

            {/* ── ACCOUNTANT ──────────────────────────────────────────── */}
            <Route
              path="/accountant"
              element={
                <PrivateRoute allowedRoles={['ADMIN', 'ACCOUNTANT']}>
                  <AccountantLayout />
                </PrivateRoute>
              }
            >
              <Route index element={<Navigate to="/accountant/dashboard" replace />} />
              <Route path="dashboard"  element={<AccountantDashboardPage />} />
              <Route path="orders"     element={<AccountantOrdersPage />} />
              <Route path="customers"  element={<AccountantCustomersPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}