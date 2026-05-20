import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider, useToast } from './components/common/Toast';
import PrivateRoute from './components/common/PrivateRoute';
import SellerLayout from './components/seller/SellerLayout';
import AdminLayout from './components/admin/AdminLayout';
import WarehouseLayout from './components/warehouse/WarehouseLayout';
import AccountantLayout from './components/accountant/AccountantLayout';
import OwnerLayout from './components/owner/OwnerLayout';
import SuperWarehouseLayout from './components/super_warehouse/SuperWarehouseLayout';
import SuperAccountantLayout from './components/super_accountant/SuperAccountantLayout';
import LoginPage from './pages/auth/LoginPage';

// Seller
import POSPage from './pages/seller/POSPage';
import OrdersPage from './pages/seller/OrdersPage';

// Admin
import DashboardPage from './pages/admin/AdminDashboard';
import AdminOrders from './pages/admin/AdminOrders';
import AdminCustomers from './pages/admin/AdminCustomers';
import AdminUsers from './pages/admin/AdminUsers';
import AdminWarehouses from './pages/admin/AdminWarehouses';
import AdminIngredients from './pages/admin/AdminIngredients';
import AdminBatchApproval from './pages/admin/AdminBatchApproval';
import ExpenseVoucherPage from './pages/admin/ExpenseVoucherPage';
import AdminWarehouseStock from './pages/admin/AdminWarehouseStock';
import SaleKpiPage from './pages/admin/SaleKpiPage';

// Warehouse
import ManagementPage from './pages/warehouse/ManagementPage';
import OperationsPage from './pages/warehouse/OperationsPage';
import HistoryPage from './pages/warehouse/HistoryPage';
import WarehouseOrdersPage from './pages/warehouse/WarehouseOrdersPage';

// Accountant
import AccountantDashboardPage from './pages/accountant/AccountantDashboardPage';
import AccountantOrdersPage from './pages/accountant/AccountantOrdersPage';
import AccountantCustomersPage from './pages/accountant/AccountantCustomersPage';
import SupplierManagementPage from './pages/accountant/SupplierManagementPage';

// Super Accountant
import ExpenseCreatePage from './pages/super_accountant/ExpenseCreatePage';
import AccountantWarehouseReceiptsPage from './pages/accountant/AccountantWarehouseReceiptsPage';

// Operator
import OperatorLayout from './components/operator/OperatorLayout';
import OperatorCategoriesPage from './pages/operator/OperatorCategoriesPage';
import OperatorIngredientsPage from './pages/operator/OperatorIngredientsPage';
import OperatorProductBatchPage from './pages/operator/OperatorProductBatchPage';
import OperatorMyBatchesPage from './pages/operator/OperatorMyBatchesPage';
import OperatorLandingpagePage from './pages/operator/OperatorLandingpagePage';
import IncomeCreatePage from './pages/super_accountant/IncomeCreatePage';
import IncomeVoucherPage from './pages/admin/IncomeVoucherPage';
import DebtOrdersPage from './pages/shared/DebtOrdersPage';

// ── Session expired listener ──────────────────────────────────────────────────
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
  if (user?.role === 'ADMIN') return <Navigate to="/admin/dashboard" replace />;
  if (user?.role === 'OWNER') return <Navigate to="/owner/dashboard" replace />;
  if (user?.role === 'WAREHOUSE') return <Navigate to="/warehouse/management" replace />;
  if (user?.role === 'SUPER_WAREHOUSE') return <Navigate to="/super-warehouse/management" replace />;
  if (user?.role === 'ACCOUNTANT') return <Navigate to="/accountant/dashboard" replace />;
  if (user?.role === 'SUPER_ACCOUNTANT') return <Navigate to="/super-accountant/dashboard" replace />;
  if (user?.role === 'SHIPPER') return <Navigate to="/shipper/dashboard" replace />;
  if (user?.role === 'OPERATOR') return <Navigate to="/operator/categories" replace />;
  if (user?.role === 'SUPER_SELLER') return <Navigate to="/seller/pos" replace />;
  return <Navigate to="/seller/pos" replace />;
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <SessionExpiredListener />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<RootRedirect />} />

            {/* ── SELLER ──────────────────────────────────────────────── */}
            <Route path="/seller"
              element={
                <PrivateRoute allowedRoles={['ADMIN', 'OWNER', 'SELLER', 'SUPER_SELLER']}>
                  <SellerLayout />
                </PrivateRoute>
              }>
              <Route index element={<Navigate to="/seller/pos" replace />} />
              <Route path="pos" element={<POSPage />} />
              <Route path="orders" element={<OrdersPage />} />
            </Route>

            {/* ── SUPER ACCOUNTANT ───────────────────────────────────── */}
            <Route path="/super-accountant"
              element={
                <PrivateRoute allowedRoles={['SUPER_ACCOUNTANT']}>
                  <SuperAccountantLayout />
                </PrivateRoute>
              }>
              <Route index element={<Navigate to="/super-accountant/dashboard" replace />} />
              <Route path="dashboard" element={<AccountantDashboardPage />} />
              <Route path="history" element={<AccountantOrdersPage />} />
              <Route path="expenses" element={<ExpenseCreatePage />} />
              <Route path="incomes" element={<IncomeCreatePage />} />
              <Route path="suppliers" element={<SupplierManagementPage />} />
              {/* Phiếu nhập kho chờ giá vốn — chỉ SUPER_ACCOUNTANT */}
              <Route path="warehouse-receipts" element={<AccountantWarehouseReceiptsPage />} />
            </Route>

            {/* ── OWNER ───────────────────────────────────────────────── */}
            <Route path="/owner"
              element={
                <PrivateRoute allowedRoles={['OWNER']}>
                  <OwnerLayout />
                </PrivateRoute>
              }>
              <Route index element={<Navigate to="/owner/dashboard" replace />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="orders" element={<AdminOrders />} />
              <Route path="customers" element={<AdminCustomers />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="warehouses" element={<AdminWarehouses />} />
              <Route path="ingredients" element={<AdminIngredients />} />
              <Route path="expenses" element={<ExpenseVoucherPage />} />
              <Route path="incomes"   element={<IncomeVoucherPage />} />
              <Route path="warehouses/:id/stock" element={<AdminWarehouseStock />} />
              <Route path="sale-kpi" element={<SaleKpiPage />} />
            </Route>

            {/* ── ADMIN ───────────────────────────────────────────────── */}
            <Route path="/admin"
              element={
                <PrivateRoute allowedRoles={['ADMIN']}>
                  <AdminLayout />
                </PrivateRoute>
              }>
              <Route index element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="orders" element={<AdminOrders />} />
              <Route path="customers" element={<AdminCustomers />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="warehouses" element={<AdminWarehouses />} />
              <Route path="ingredients" element={<AdminIngredients />} />
              <Route path="batches" element={<AdminBatchApproval />} />
              <Route path="expenses" element={<ExpenseVoucherPage />} />
              <Route path="incomes"   element={<IncomeVoucherPage />} />
              <Route path="warehouses/:id/stock" element={<AdminWarehouseStock />} />
              <Route path="sale-kpi" element={<SaleKpiPage />} />
            </Route>

            {/* ── OPERATOR ────────────────────────────────────────────── */}
            <Route path="/operator"
              element={
                <PrivateRoute allowedRoles={['OPERATOR', 'ADMIN', 'OWNER']}>
                  <OperatorLayout />
                </PrivateRoute>
              }>
              <Route index element={<Navigate to="/operator/categories" replace />} />
              <Route path="categories" element={<OperatorCategoriesPage />} />
              <Route path="ingredients" element={<OperatorIngredientsPage />} />
              <Route path="products" element={<OperatorProductBatchPage />} />
              <Route path="batches" element={<OperatorMyBatchesPage />} />
              <Route path="landingpage" element={<OperatorLandingpagePage />} />
            </Route>

            {/* ── WAREHOUSE ───────────────────────────────────────────── */}
            <Route path="/warehouse"
              element={
                <PrivateRoute allowedRoles={['ADMIN', 'WAREHOUSE']}>
                  <WarehouseLayout />
                </PrivateRoute>
              }>
              <Route index element={<Navigate to="/warehouse/management" replace />} />
              <Route path="management" element={<ManagementPage />} />
              <Route path="operations" element={<OperationsPage />} />
              <Route path="history" element={<HistoryPage />} />
              <Route path="orders" element={<WarehouseOrdersPage />} />
              <Route path="expenses" element={<ExpenseCreatePage />} />
            </Route>

            {/* ── SUPER WAREHOUSE ─────────────────────────────────────── */}
            <Route path="/super-warehouse"
              element={
                <PrivateRoute allowedRoles={['SUPER_WAREHOUSE']}>
                  <SuperWarehouseLayout />
                </PrivateRoute>
              }>
              <Route index element={<Navigate to="/super-warehouse/management" replace />} />
              <Route path="management" element={<ManagementPage />} />
              <Route path="operations" element={<OperationsPage />} />
              <Route path="history" element={<HistoryPage />} />
              <Route path="orders" element={<WarehouseOrdersPage />} />
              <Route path="expenses" element={<ExpenseCreatePage />} />
            </Route>

            {/* ── ACCOUNTANT ──────────────────────────────────────────── */}
            {/* KHÔNG có route warehouse-receipts — chỉ SUPER_ACCOUNTANT mới có */}
            <Route path="/accountant"
              element={
                <PrivateRoute allowedRoles={['ADMIN', 'OWNER', 'ACCOUNTANT', 'SUPER_ACCOUNTANT']}>
                  <AccountantLayout />
                </PrivateRoute>
              }>
              <Route index element={<Navigate to="/accountant/dashboard" replace />} />
              <Route path="dashboard" element={<AccountantDashboardPage />} />
              <Route path="orders" element={<AccountantOrdersPage />} />
              <Route path="debt-orders" element={<DebtOrdersPage />} />
              <Route path="customers" element={<AccountantCustomersPage />} />
              <Route path="suppliers" element={<SupplierManagementPage />} />
              <Route path="incomes" element={<IncomeCreatePage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}