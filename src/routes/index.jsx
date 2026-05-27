/**
 * routes/index.jsx — tất cả routes tập trung một chỗ.
 */
import { Routes, Route, Navigate } from 'react-router-dom';
import PrivateRoute from '../components/common/PrivateRoute';
import AppLayout from '../components/layout/AppLayout';
import {
  adminNav, ownerNav, hrNav, sellerNav, warehouseNav, superWarehouseNav,
  accountantNav, superAccountantNav, operatorNav, factoryWorkerNav,
  ROLE_DEFAULT_PATH,
} from '../components/layout/navConfigs';

// Auth
import LoginPage from '../pages/auth/LoginPage';

// Admin / Owner shared pages
import AdminDashboard from '../pages/admin/AdminDashboard';
import AdminOrders from '../pages/admin/AdminOrders';
import AdminCustomers from '../pages/admin/AdminCustomers';
import AdminUsers from '../pages/admin/AdminUsers';
import AdminWarehouses from '../pages/admin/AdminWarehouses';
import AdminIngredients from '../pages/admin/AdminIngredients';
import AdminBatchApproval from '../pages/admin/AdminBatchApproval';
import AdminWarehouseStock from '../pages/admin/AdminWarehouseStock';
import ExpenseVoucherPage from '../pages/admin/ExpenseVoucherPage';
import IncomeVoucherPage from '../pages/admin/IncomeVoucherPage';
import SaleKpiPage from '../pages/admin/SaleKpiPage';
import OwnerAnalyticsPage from '../pages/owner/OwnerAnalyticsPage';
import OwnerProductionPage from '../pages/owner/OwnerProductionPage';
import OwnerEmployeesPage from '../pages/owner/OwnerEmployeesPage';
import DebtOrdersPage from '../pages/shared/DebtOrdersPage';

// HR
import HrPage from '../pages/hr/HrPage';
import HrSalaryStatusPage from '../pages/hr/HrSalaryStatusPage';

// Seller
import POSPage from '../pages/seller/POSPage';
import OrdersPage from '../pages/seller/OrdersPage';
import DraftOrdersPage from '../pages/seller/DraftOrdersPage';
import SellerCustomersPage from '../pages/seller/SellerCustomersPage';
import AccountantOrdersPage from '../pages/accountant/AccountantOrdersPage';

// Warehouse
import ManagementPage from '../pages/warehouse/ManagementPage';
import OperationsPage from '../pages/warehouse/OperationsPage';
import HistoryPage from '../pages/warehouse/HistoryPage';
import WarehouseOrdersPage from '../pages/warehouse/WarehouseOrdersPage';
import ExpenseCreatePage from '../pages/super_accountant/ExpenseCreatePage';

// Accountant
import AccountantDashboardPage from '../pages/accountant/AccountantDashboardPage';
import AccountantCustomersPage from '../pages/accountant/AccountantCustomersPage';
import SupplierManagementPage from '../pages/accountant/SupplierManagementPage';
import IncomeCreatePage from '../pages/super_accountant/IncomeCreatePage';
import AccountantWarehouseReceiptsPage from '../pages/accountant/AccountantWarehouseReceiptsPage';

// Operator
import OperatorCategoriesPage from '../pages/operator/OperatorCategoriesPage';
import OperatorIngredientsPage from '../pages/operator/OperatorIngredientsPage';
import OperatorProductBatchPage from '../pages/operator/OperatorProductBatchPage';
import OperatorMyBatchesPage from '../pages/operator/OperatorMyBatchesPage';
import OperatorLandingpagePage from '../pages/operator/OperatorLandingpagePage';

// Factory Worker
import { FactoryDashboardPage, FactoryHistoryPage } from '../pages/factory_worker/FactoryWorkerPages';
import FactoryCreateBatchPage from '../pages/factory_worker/FactoryCreateBatchPage';

// ── Root redirect ─────────────────────────────────────────────────────────────
function RootRedirect() {
  let user = null;
  try { user = JSON.parse(localStorage.getItem('user')); } catch {}
  const path = user?.role ? (ROLE_DEFAULT_PATH[user.role] || '/seller/pos') : '/login';
  return <Navigate to={path} replace />;
}

// ── All routes ────────────────────────────────────────────────────────────────
export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<RootRedirect />} />

      {/* ── HR ───────────────────────────────────────────────────────────── */}
      <Route path="/hr"
        element={<PrivateRoute allowedRoles={['HR']}><AppLayout navItems={hrNav} /></PrivateRoute>}>
        <Route index element={<Navigate to="/hr/manage" replace />} />
        <Route path="manage"   element={<HrPage />} />
        <Route path="salaries" element={<HrSalaryStatusPage />} />
      </Route>

      {/* ── SELLER ───────────────────────────────────────────────────────── */}
      <Route path="/seller"
        element={<PrivateRoute allowedRoles={['ADMIN','OWNER','SELLER','SUPER_SELLER']}><AppLayout navItems={sellerNav} /></PrivateRoute>}>
        <Route index element={<Navigate to="/seller/pos" replace />} />
        <Route path="pos"           element={<POSPage />} />
        <Route path="orders"        element={<OrdersPage />} />
        <Route path="drafts"        element={<DraftOrdersPage />} />
        <Route path="customers"     element={<SellerCustomersPage />} />
        <Route path="orders-manage" element={<AccountantOrdersPage />} />
      </Route>

      {/* ── OWNER ────────────────────────────────────────────────────────── */}
      <Route path="/owner"
        element={<PrivateRoute allowedRoles={['OWNER']}><AppLayout navItems={ownerNav} /></PrivateRoute>}>
        <Route index element={<Navigate to="/owner/dashboard" replace />} />
        <Route path="dashboard"            element={<AdminDashboard />} />
        <Route path="pos"                  element={<POSPage />} />
        <Route path="drafts"               element={<DraftOrdersPage />} />
        <Route path="orders"               element={<AdminOrders />} />
        <Route path="customers"            element={<AdminCustomers />} />
        <Route path="users"                element={<AdminUsers />} />
        <Route path="employees"            element={<OwnerEmployeesPage />} />
        <Route path="warehouses"           element={<AdminWarehouses />} />
        <Route path="warehouses/:id/stock" element={<AdminWarehouseStock />} />
        <Route path="ingredients"          element={<AdminIngredients />} />
        <Route path="expenses"             element={<ExpenseVoucherPage />} />
        <Route path="incomes"              element={<IncomeVoucherPage />} />
        <Route path="debt-orders"          element={<DebtOrdersPage />} />
        <Route path="sale-kpi"             element={<SaleKpiPage />} />
        <Route path="analytics"            element={<OwnerAnalyticsPage />} />
        <Route path="production"           element={<OwnerProductionPage />} />
      </Route>

      {/* ── ADMIN ────────────────────────────────────────────────────────── */}
      <Route path="/admin"
        element={<PrivateRoute allowedRoles={['ADMIN']}><AppLayout navItems={adminNav} /></PrivateRoute>}>
        <Route index element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="dashboard"            element={<AdminDashboard />} />
        <Route path="orders"               element={<AdminOrders />} />
        <Route path="customers"            element={<AdminCustomers />} />
        <Route path="users"                element={<AdminUsers />} />
        <Route path="warehouses"           element={<AdminWarehouses />} />
        <Route path="warehouses/:id/stock" element={<AdminWarehouseStock />} />
        <Route path="ingredients"          element={<AdminIngredients />} />
        <Route path="batches"              element={<AdminBatchApproval />} />
        <Route path="expenses"             element={<ExpenseVoucherPage />} />
        <Route path="incomes"              element={<IncomeVoucherPage />} />
        <Route path="debt-orders"          element={<DebtOrdersPage />} />
        <Route path="sale-kpi"             element={<SaleKpiPage />} />
        <Route path="analytics"            element={<OwnerAnalyticsPage />} />
        <Route path="production"           element={<OwnerProductionPage />} />
      </Route>

      {/* ── WAREHOUSE ────────────────────────────────────────────────────── */}
      <Route path="/warehouse"
        element={<PrivateRoute allowedRoles={['ADMIN','WAREHOUSE']}><AppLayout navItems={warehouseNav} /></PrivateRoute>}>
        <Route index element={<Navigate to="/warehouse/management" replace />} />
        <Route path="management" element={<ManagementPage />} />
        <Route path="operations" element={<OperationsPage />} />
        <Route path="history"    element={<HistoryPage />} />
        <Route path="orders"     element={<WarehouseOrdersPage />} />
        <Route path="expenses"   element={<ExpenseCreatePage />} />
      </Route>

      {/* ── SUPER WAREHOUSE ──────────────────────────────────────────────── */}
      <Route path="/super-warehouse"
        element={<PrivateRoute allowedRoles={['SUPER_WAREHOUSE']}><AppLayout navItems={superWarehouseNav} /></PrivateRoute>}>
        <Route index element={<Navigate to="/super-warehouse/management" replace />} />
        <Route path="management" element={<ManagementPage />} />
        <Route path="operations" element={<OperationsPage />} />
        <Route path="history"    element={<HistoryPage />} />
        <Route path="orders"     element={<WarehouseOrdersPage />} />
        <Route path="expenses"   element={<ExpenseCreatePage />} />
      </Route>

      {/* ── ACCOUNTANT ───────────────────────────────────────────────────── */}
      <Route path="/accountant"
        element={<PrivateRoute allowedRoles={['ADMIN','OWNER','ACCOUNTANT','SUPER_ACCOUNTANT']}><AppLayout navItems={accountantNav} /></PrivateRoute>}>
        <Route index element={<Navigate to="/accountant/dashboard" replace />} />
        <Route path="dashboard"   element={<AccountantDashboardPage />} />
        <Route path="orders"      element={<AccountantOrdersPage />} />
        <Route path="debt-orders" element={<DebtOrdersPage />} />
        <Route path="customers"   element={<AccountantCustomersPage />} />
        <Route path="suppliers"   element={<SupplierManagementPage />} />
        <Route path="incomes"     element={<IncomeCreatePage />} />
      </Route>

      {/* ── SUPER ACCOUNTANT ─────────────────────────────────────────────── */}
      <Route path="/super-accountant"
        element={<PrivateRoute allowedRoles={['SUPER_ACCOUNTANT']}><AppLayout navItems={superAccountantNav} /></PrivateRoute>}>
        <Route index element={<Navigate to="/super-accountant/dashboard" replace />} />
        <Route path="dashboard"          element={<AccountantDashboardPage />} />
        <Route path="history"            element={<AccountantOrdersPage />} />
        <Route path="expenses"           element={<ExpenseCreatePage />} />
        <Route path="incomes"            element={<IncomeCreatePage />} />
        <Route path="suppliers"          element={<SupplierManagementPage />} />
        <Route path="warehouse-receipts" element={<AccountantWarehouseReceiptsPage />} />
      </Route>

      {/* ── OPERATOR ─────────────────────────────────────────────────────── */}
      <Route path="/operator"
        element={<PrivateRoute allowedRoles={['OPERATOR','ADMIN','OWNER']}><AppLayout navItems={operatorNav} /></PrivateRoute>}>
        <Route index element={<Navigate to="/operator/categories" replace />} />
        <Route path="categories"  element={<OperatorCategoriesPage />} />
        <Route path="ingredients" element={<OperatorIngredientsPage />} />
        <Route path="products"    element={<OperatorProductBatchPage />} />
        <Route path="batches"     element={<OperatorMyBatchesPage />} />
        <Route path="landingpage" element={<OperatorLandingpagePage />} />
      </Route>

      {/* ── FACTORY WORKER ───────────────────────────────────────────────── */}
      <Route path="/factory"
        element={<PrivateRoute allowedRoles={['FACTORY_WORKER']}><AppLayout navItems={factoryWorkerNav} /></PrivateRoute>}>
        <Route index element={<Navigate to="/factory/dashboard" replace />} />
        <Route path="dashboard" element={<FactoryDashboardPage />} />
        <Route path="batches"   element={<FactoryCreateBatchPage />} />
        <Route path="history"   element={<FactoryHistoryPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}