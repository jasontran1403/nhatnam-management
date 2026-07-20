/**
 * routes/index.jsx — tất cả routes tập trung một chỗ.
 */
import { Routes, Route, Navigate } from 'react-router-dom';
import PrivateRoute from '../components/common/PrivateRoute';
import AppLayout from '../components/layout/AppLayout';
import { useLang } from '../context/LangContext';
import {
  adminNavRaw, ownerNavRaw, hrNavRaw, sellerNavRaw, warehouseNavRaw,
  superWarehouseNavRaw, accountantNavRaw, superAccountantNavRaw,
  operatorNavRaw, factoryWorkerNavRaw, superFactoryWorkerNavRaw, factoryAccountantNavRaw,
  driverNavRaw, securityNavRaw, factoryPayrollNavRaw,
  buildNav, ROLE_DEFAULT_PATH,
} from '../components/layout/navConfigs';

// Auth
import LoginPage from '../pages/auth/LoginPage';

// Admin / Owner shared pages
import AdminDashboard from '../pages/admin/AdminDashboard';
import AdminOrders from '../pages/admin/AdminOrders';
import AdminPOSPage from '../pages/admin/AdminPOSPage';
import AdminCustomers from '../pages/admin/AdminCustomers';
import AdminUsers from '../pages/admin/AdminUsers';
import AdminWarehouses from '../pages/admin/AdminWarehouses';
import AdminIngredients from '../pages/admin/AdminIngredients';
import AdminBatchApproval from '../pages/admin/AdminBatchApproval';
import AdminWarehouseStock from '../pages/admin/AdminWarehouseStock';
import ExpenseVoucherPage from '../pages/admin/ExpenseVoucherPage';
import AdminSupplierManagementPage from '../pages/admin/AdminSupplierManagementPage';
import IncomeVoucherPage from '../pages/admin/IncomeVoucherPage';
import SaleKpiPage from '../pages/admin/SaleKpiPage';
import OwnerAnalyticsPage from '../pages/owner/OwnerAnalyticsPage';
import OwnerProductionPage from '../pages/owner/OwnerProductionPage';
import OwnerEmployeesPage from '../pages/owner/OwnerEmployeesPage';
import DebtOrdersPage from '../pages/shared/DebtOrdersPage';

// Production v2 — Owner
import OwnerProductionDashboard from '../pages/owner/OwnerProductionDashboard';
import OwnerVendorDebtPage from '../pages/owner/OwnerVendorDebtPage';
import OwnerSupplierManagementPage from '../pages/owner/OwnerSupplierManagementPage';
import OwnerMaterialStockPage from '../pages/owner/OwnerMaterialStockPage';
import OwnerFactoryStockPage from '../pages/owner/OwnerFactoryStockPage';
import OwnerMaterialPriceAnalysisPage from '../pages/owner/OwnerMaterialPriceAnalysisPage';
import OwnerPlanDetailPage from '../pages/owner/OwnerPlanDetailPage';
import OwnerWorkOrderDetailPage from '../pages/owner/OwnerWorkOrderDetailPage';
import OwnerExpenseCategoryPage from '../pages/owner/OwnerExpenseCategoryPage';

// Production v2 — Super Factory Worker (dashboard riêng, tái sử dụng trang chi tiết của Owner)
import SuperFactoryWorkerDashboard from '../pages/super_factory_worker/SuperFactoryWorkerDashboard';

// Production legacy — Owner (giữ lại cho các route cũ còn trong nav)
import OwnerMachinePage from '../pages/owner/OwnerMachinePage';
import OwnerMaintenancePage from '../pages/owner/OwnerMaintenancePage';
import OwnerAnnualMpsPage from '../pages/owner/OwnerAnnualMpsPage';
import OwnerWorkOrderPage from '../pages/owner/OwnerWorkOrderPage';
import OwnerBatchReviewPage from '../pages/owner/OwnerBatchReviewPage';

// HR
import HrPage from '../pages/hr/HrPage';
import HrSalaryStatusPage from '../pages/hr/HrSalaryStatusPage';

// Seller
import SellerDashboardPage from '../pages/seller/SellerDashboardPage';
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
import WarehouseDeliveryPage from '../pages/warehouse/WarehouseDeliveryPage';
import DriverAttendancePage from '../pages/warehouse/DriverAttendancePage';

// Accountant
import AccountantDashboardPage from '../pages/accountant/AccountantDashboardPage';
import AccountantCustomersPage from '../pages/accountant/AccountantCustomersPage';
import SupplierManagementPage from '../pages/accountant/SupplierManagementPage';
import AccountantWarehouseReceiptsPage from '../pages/accountant/AccountantWarehouseReceiptsPage';
import ExpenseListPage from '../pages/accountant/ExpenseListPage';
import OwnerCashflowPage from '../pages/owner/OwnerCashflowPage';
import OwnerInventoryPage from '../pages/owner/OwnerInventoryPage';
import AccountantVendorDebtPage from '../pages/accountant/AccountantVendorDebtPage';
import IncomeListPage from '../pages/accountant/IncomeListPage';
import SuperAccountantMaterialRequestPage from '../pages/super_accountant/SuperAccountantMaterialRequestPage';
import PricingCalculatorPage from '../pages/super_accountant/PricingCalculatorPage';
import SellerMaterialRequestPage from '../pages/seller/SellerMaterialRequestPage';

// Operator
import OperatorCategoriesPage from '../pages/operator/OperatorCategoriesPage';
import OperatorIngredientsPage from '../pages/operator/OperatorIngredientsPage';
import OperatorProductBatchPage from '../pages/operator/OperatorProductBatchPage';
import OperatorMyBatchesPage from '../pages/operator/OperatorMyBatchesPage';
import OperatorLandingpagePage from '../pages/operator/OperatorLandingpagePage';

// Factory Worker
import FactoryOrdersPage from '../pages/factory_worker/FactoryOrdersPage';
import FactoryRecipesPage from '../pages/factory_worker/FactoryRecipesPage';
import FactoryMachinePage from '../pages/factory_worker/FactoryMachinePage';
import FactoryMachineMetricsPage from '../pages/factory_worker/FactoryMachineMetricsPage';
import FactoryMaterialRequestPage from '../pages/factory_worker/FactoryMaterialRequestPage';
import FactoryMaterialStockPage from '../pages/factory_worker/FactoryMaterialStockPage';
import FactoryFinishedGoodsPage from '../pages/factory_worker/FactoryFinishedGoodsPage';
import FactorySemiFinishedGoodsPage from '../pages/factory_worker/FactorySemiFinishedGoodsPage';

// Factory Accountant (Kế toán kho xưởng)
import FactoryAccountantTransfersPage from '../pages/factory_accountant/FactoryAccountantTransfersPage';
import PackagingLossReportsPage from '../pages/factory_accountant/PackagingLossReportsPage';

// Driver (Tài xế)
import DriverDashboardPage from '../pages/driver/DriverDashboardPage';
import DriverOrderDetailPage from '../pages/driver/DriverOrderDetailPage';

// Quản lý lương — dùng chung cho bảo vệ + toàn bộ nhân sự xưởng
import MyPayrollPage from '../pages/shared/MyPayrollPage';

// Bảng chấm công (OWNER upload)
import AttendanceSheetsPage from '../pages/owner/AttendanceSheetsPage';

import QuotationPage from '../pages/seller/QuotationPage';
import SuperAccountantCustomers from '../pages/accountant/SuperAccountantCustomers';
import CertificatePage from '../pages/shared/CertificatePage';

// ── Root redirect ─────────────────────────────────────────────────────────────
function RootRedirect() {
  let user = null;
  try { user = JSON.parse(localStorage.getItem('user')); } catch { }
  const path = user?.role ? (ROLE_DEFAULT_PATH[user.role] || '/seller/dashboard') : '/login';
  return <Navigate to={path} replace />;
}

// ── AppLayout wrapper that auto-translates nav ────────────────────────────────
function TranslatedLayout({ rawNav, allowedRoles, children, ...rest }) {
  const { t } = useLang();
  let userRole = '';
  try { const u = JSON.parse(localStorage.getItem('user')); userRole = u?.role ?? u?.roles?.[0] ?? ''; } catch {}
  const navItems = buildNav(rawNav, t, userRole);
  return (
    <PrivateRoute allowedRoles={allowedRoles}>
      <AppLayout navItems={navItems} {...rest} />
    </PrivateRoute>
  );
}

// ── All routes ────────────────────────────────────────────────────────────────
export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<RootRedirect />} />

      {/* ── HR */}
      <Route path="/hr"
        element={<TranslatedLayout rawNav={hrNavRaw} allowedRoles={['HR', 'SUPER_ACCOUNTANT', 'OWNER', 'ADMIN']} />}>
        <Route index element={<Navigate to="/hr/manage" replace />} />
        <Route path="manage" element={<HrPage />} />
        <Route path="salaries" element={<HrSalaryStatusPage />} />
      </Route>

      {/* ── SELLER */}
      <Route path="/seller"
        element={<TranslatedLayout rawNav={sellerNavRaw} allowedRoles={['ADMIN', 'OWNER', 'SELLER', 'SUPER_SELLER']} />}>
        <Route index element={<Navigate to="/seller/dashboard" replace />} />
        <Route path="dashboard" element={<SellerDashboardPage />} />
        <Route path="pos" element={<POSPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="drafts" element={<DraftOrdersPage />} />
        <Route path="customers" element={<SellerCustomersPage />} />
        <Route path="orders-manage" element={<AccountantOrdersPage />} />
        <Route path="quotation" element={<QuotationPage />} />
        <Route path="material-requests" element={<SellerMaterialRequestPage />} />
        {/* Quản lý lương — phiếu lương theo tháng */}
        <Route path="my-payroll" element={<MyPayrollPage />} />
      </Route>

      {/* ── OWNER */}
      <Route path="/owner"
        element={<TranslatedLayout rawNav={ownerNavRaw} allowedRoles={['OWNER']} />}>
        <Route index element={<Navigate to="/owner/dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="pos" element={<AdminPOSPage />} />
        <Route path="drafts" element={<DraftOrdersPage />} />
        <Route path="orders" element={<AdminOrders />} />
        <Route path="customers" element={<AdminCustomers />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="employees" element={<OwnerEmployeesPage />} />
        <Route path="warehouses" element={<AdminWarehouses />} />
        <Route path="warehouses/:id/stock" element={<AdminWarehouseStock />} />
        <Route path="ingredients" element={<AdminIngredients />} />
        <Route path="expenses" element={<ExpenseVoucherPage />} />
        <Route path="incomes" element={<IncomeVoucherPage />} />
        <Route path="cashflow" element={<OwnerCashflowPage />} />
        <Route path="inventory" element={<OwnerInventoryPage />} />
        <Route path="debt-orders" element={<DebtOrdersPage />} />
        <Route path="sale-kpi" element={<SaleKpiPage />} />
        <Route path="analytics" element={<OwnerAnalyticsPage />} />
        <Route path="certificates" element={<CertificatePage />} />
        {/* Bảng chấm công — upload file Excel theo tháng */}
        <Route path="attendance" element={<AttendanceSheetsPage />} />

        {/* Production v2 — Dashboard chính + detail lệnh */}
        <Route path="production" element={<OwnerProductionDashboard />} />
        <Route path="production/work-orders/:id" element={<OwnerWorkOrderDetailPage />} />
        <Route path="production/plans/:id" element={<OwnerPlanDetailPage />} />
        <Route path="production/machines/:id/metrics" element={<FactoryMachineMetricsPage />} />
        {/* Biên bản hao hụt đóng gói — chỉ xem, không thao tác */}
        <Route path="production/loss-reports" element={<PackagingLossReportsPage />} />
        {/* Công nợ nhà cung cấp — chỉ xem */}
        <Route path="production/vendor-debts" element={<OwnerVendorDebtPage />} />
        <Route path="production/vendor-debts/:vendorId" element={<OwnerVendorDebtPage />} />
        {/* Quản lý nhà cung cấp — công nợ + lịch sử đặt hàng + phân tích giá (chỉ xem) */}
        <Route path="production/suppliers" element={<OwnerSupplierManagementPage />} />
        <Route path="production/suppliers/:vendorId" element={<OwnerSupplierManagementPage />} />
        {/* Tồn kho nguyên liệu sản xuất — chỉ xem */}
        <Route path="production/material-stock" element={<OwnerMaterialStockPage />} />
        <Route path="factory-stock" element={<OwnerFactoryStockPage />} />
        {/* Phân tích giá nguyên liệu — gộp đa nhà cung cấp (mở từ Tồn kho NL)
            Cũng dùng cho danh mục khoản chi qua ?kind=EXPENSE */}
        <Route path="production/material-price-analysis" element={<OwnerMaterialPriceAnalysisPage />} />
        {/* Phân tích danh mục chi — nguyên liệu + khoản chi/dịch vụ (mở từ Quản lý NCC) */}
        <Route path="production/expense-categories" element={<OwnerExpenseCategoryPage />} />

        {/* Production legacy — vẫn giữ để backward compat với nav cũ */}
        <Route path="production/old" element={<OwnerProductionPage />} />
        <Route path="production/machines" element={<OwnerMachinePage />} />
        <Route path="production/maintenance" element={<OwnerMaintenancePage />} />
        <Route path="production/mps" element={<OwnerAnnualMpsPage />} />
        <Route path="production/work-orders" element={<OwnerWorkOrderPage />} />
        <Route path="production/batches" element={<OwnerBatchReviewPage />} />
      </Route>

      {/* ── ADMIN */}
      <Route path="/admin"
        element={<TranslatedLayout rawNav={adminNavRaw} allowedRoles={['ADMIN']} />}>
        <Route index element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="orders" element={<AdminOrders />} />
        <Route path="customers" element={<AdminCustomers />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="warehouses" element={<AdminWarehouses />} />
        <Route path="warehouses/:id/stock" element={<AdminWarehouseStock />} />
        <Route path="ingredients" element={<AdminIngredients />} />
        <Route path="batches" element={<AdminBatchApproval />} />
        <Route path="suppliers" element={<AdminSupplierManagementPage />} />
        <Route path="suppliers/:vendorId" element={<AdminSupplierManagementPage />} />
        <Route path="expenses" element={<ExpenseVoucherPage />} />
        <Route path="incomes" element={<IncomeVoucherPage />} />
        <Route path="cashflow" element={<OwnerCashflowPage />} />
        <Route path="inventory" element={<OwnerInventoryPage />} />
        <Route path="debt-orders" element={<DebtOrdersPage />} />
        <Route path="sale-kpi" element={<SaleKpiPage />} />
        <Route path="analytics" element={<OwnerAnalyticsPage />} />
        <Route path="production" element={<OwnerProductionDashboard />} />
        <Route path="production/work-orders/:id" element={<OwnerWorkOrderDetailPage />} />
        <Route path="production/plans/:id" element={<OwnerPlanDetailPage />} />
      </Route>

      {/* ── WAREHOUSE */}
      <Route path="/warehouse"
        element={<TranslatedLayout rawNav={warehouseNavRaw} allowedRoles={['ADMIN', 'WAREHOUSE']} />}>
        <Route index element={<Navigate to="/warehouse/management" replace />} />
        <Route path="management" element={<ManagementPage />} />
        <Route path="operations" element={<OperationsPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="delivery" element={<WarehouseDeliveryPage />} />
        <Route path="driver-attendance" element={<DriverAttendancePage />} />
        {/* Quản lý lương — phiếu lương theo tháng */}
        <Route path="my-payroll" element={<MyPayrollPage />} />
      </Route>

      {/* ── SUPER WAREHOUSE */}
      <Route path="/super-warehouse"
        element={<TranslatedLayout rawNav={superWarehouseNavRaw} allowedRoles={['SUPER_WAREHOUSE']} />}>
        <Route index element={<Navigate to="/super-warehouse/management" replace />} />
        <Route path="management" element={<ManagementPage />} />
        <Route path="operations" element={<OperationsPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="expenses" element={<ExpenseListPage />} />
        <Route path="delivery" element={<WarehouseDeliveryPage />} />
        {/* Quản lý lương — phiếu lương theo tháng */}
        <Route path="my-payroll" element={<MyPayrollPage />} />
      </Route>

      {/* ── ACCOUNTANT */}
      <Route path="/accountant"
        element={<TranslatedLayout rawNav={accountantNavRaw} allowedRoles={['ADMIN', 'OWNER', 'ACCOUNTANT', 'SUPER_ACCOUNTANT']} />}>
        <Route index element={<Navigate to="/accountant/dashboard" replace />} />
        <Route path="dashboard" element={<AccountantDashboardPage />} />
        <Route path="orders" element={<AccountantOrdersPage />} />
        <Route path="debt-orders" element={<DebtOrdersPage />} />
        <Route path="customers" element={<AccountantCustomersPage />} />
        <Route path="suppliers" element={<SupplierManagementPage />} />
        <Route path="vendor-debts" element={<AccountantVendorDebtPage />} />
        <Route path="vendor-debts/:vendorId" element={<AccountantVendorDebtPage />} />
        <Route path="incomes" element={<IncomeListPage />} />
        <Route path="expenses" element={<ExpenseListPage />} />
        {/* Quản lý lương — phiếu lương theo tháng */}
        <Route path="my-payroll" element={<MyPayrollPage />} />
      </Route>

      {/* ── SUPER ACCOUNTANT */}
      <Route path="/super-accountant"
        element={<TranslatedLayout rawNav={superAccountantNavRaw} allowedRoles={['SUPER_ACCOUNTANT']} />}>
        <Route index element={<Navigate to="/super-accountant/dashboard" replace />} />
        <Route path="dashboard" element={<AccountantDashboardPage />} />
        <Route path="history" element={<AccountantOrdersPage />} />
        <Route path="customers" element={<SuperAccountantCustomers />} />
        <Route path="expenses" element={<ExpenseListPage />} />
        <Route path="incomes" element={<IncomeListPage />} />
        <Route path="suppliers" element={<SupplierManagementPage />} />
        <Route path="vendor-debts" element={<AccountantVendorDebtPage />} />
        <Route path="vendor-debts/:vendorId" element={<AccountantVendorDebtPage />} />
        <Route path="material-requests" element={<SuperAccountantMaterialRequestPage />} />
        <Route path="pricing" element={<PricingCalculatorPage />} />
        <Route path="warehouse-receipts" element={<AccountantWarehouseReceiptsPage />} />
        <Route path="manage" element={<HrPage />} />
        <Route path="salaries" element={<HrSalaryStatusPage />} />
        {/* Quản lý lương — phiếu lương theo tháng */}
        <Route path="my-payroll" element={<MyPayrollPage />} />
      </Route>

      {/* ── OPERATOR */}
      <Route path="/operator"
        element={<TranslatedLayout rawNav={operatorNavRaw} allowedRoles={['OPERATOR', 'ADMIN', 'OWNER']} />}>
        <Route index element={<Navigate to="/operator/products" replace />} />
        <Route path="categories" element={<OperatorCategoriesPage />} />
        <Route path="ingredients" element={<OperatorIngredientsPage />} />
        <Route path="products" element={<OperatorProductBatchPage />} />
        <Route path="batches" element={<OperatorMyBatchesPage />} />
        <Route path="certificates" element={<CertificatePage />} />
        <Route path="landingpage" element={<OperatorLandingpagePage />} />
      </Route>

      {/* ── FACTORY WORKER (đã thu gọn: không còn kế hoạch / tạo lệnh SX / biến thể) */}
      <Route path="/factory"
        element={<TranslatedLayout rawNav={factoryWorkerNavRaw} allowedRoles={['FACTORY_WORKER']} />}>
        <Route index element={<Navigate to="/factory/orders" replace />} />
        <Route path="orders" element={<FactoryOrdersPage />} />
        <Route path="machines" element={<FactoryMachinePage />} />
        <Route path="material-requests" element={<FactoryMaterialRequestPage />} />
        {/* Kho bán thành phẩm (chưa đóng gói) — lập phiếu chuyển kho thành phẩm */}
        <Route path="semi-finished-goods" element={<FactorySemiFinishedGoodsPage />} />
        <Route path="finished-goods" element={<FactoryFinishedGoodsPage />} />
        {/* Quản lý lương — phiếu lương theo tháng + thưởng KPI */}
        <Route path="my-payroll" element={<MyPayrollPage />} />
      </Route>

      {/* ── SUPER FACTORY WORKER ── */}
      <Route path="/super-factory"
        element={<TranslatedLayout rawNav={superFactoryWorkerNavRaw} allowedRoles={['SUPER_FACTORY_WORKER']} />}>
        <Route index element={<Navigate to="/super-factory/production" replace />} />
        {/* Dashboard mặc định: grant kế hoạch/lệnh SX + grant máy móc (2 tab) */}
        <Route path="production" element={<SuperFactoryWorkerDashboard />} />
        <Route path="production/work-orders/:id" element={<OwnerWorkOrderDetailPage />} />
        <Route path="production/plans/:id" element={<OwnerPlanDetailPage />} />
        {/* Đặt hàng (phiếu đặt hàng) — được tạo + xác nhận nhận hàng */}
        <Route path="material-requests" element={<FactoryMaterialRequestPage />} />
        {/* Quản lý tồn kho nguyên liệu */}
        <Route path="material-stock" element={<FactoryMaterialStockPage />} />
        {/* Quản lý biến thể sản xuất */}
        <Route path="recipes" element={<FactoryRecipesPage />} />
        {/* Quản lý máy móc & bảo trì — được tạo bảo trì định kỳ + hỏng sửa chữa đột xuất */}
        <Route path="machines" element={<FactoryMachinePage />} />
        {/* Lịch sử lệnh sản xuất */}
        <Route path="history" element={<FactoryOrdersPage />} />
        {/* Phiếu chi của phòng xưởng */}
        <Route path="expenses" element={<ExpenseListPage />} />
        {/* Kho bán thành phẩm (chưa đóng gói) — lập phiếu chuyển kho thành phẩm */}
        <Route path="semi-finished-goods" element={<FactorySemiFinishedGoodsPage />} />
        {/* Quản lý tồn kho thành phẩm của xưởng */}
        <Route path="finished-goods" element={<FactoryFinishedGoodsPage />} />
        {/* Quản lý lương — phiếu lương theo tháng + thưởng KPI */}
        <Route path="my-payroll" element={<MyPayrollPage />} />
      </Route>

      {/* ── FACTORY ACCOUNTANT (Kế toán kho xưởng) ── */}
      <Route path="/factory-accountant"
        element={<TranslatedLayout rawNav={factoryAccountantNavRaw} allowedRoles={['FACTORY_ACCOUNTANT']} />}>
        <Route index element={<Navigate to="/factory-accountant/transfers" replace />} />
        {/* Xác nhận nhận phiếu chuyển kho bán thành phẩm — mặc định khi vào */}
        <Route path="transfers" element={<FactoryAccountantTransfersPage />} />
        {/* Quản lý kho thành phẩm — chuyển kho bán hàng / xuất kho */}
        <Route path="finished-goods" element={<FactoryFinishedGoodsPage />} />
        {/* Biên bản hao hụt đóng gói */}
        <Route path="loss-reports" element={<PackagingLossReportsPage />} />
        {/* Quản lý lương — phiếu lương theo tháng + thưởng KPI */}
        <Route path="my-payroll" element={<MyPayrollPage />} />
      </Route>

      {/* ── TÀI XẾ ── */}
      <Route path="/driver"
        element={<TranslatedLayout rawNav={driverNavRaw} allowedRoles={['DRIVER']} />}>
        <Route index element={<Navigate to="/driver/orders" replace />} />
        <Route path="orders" element={<DriverDashboardPage />} />
        <Route path="orders/:id" element={<DriverOrderDetailPage />} />
        {/* Quản lý lương — lịch tháng + số km chạy mỗi ngày */}
        <Route path="my-payroll" element={<MyPayrollPage />} />
      </Route>

      {/* ── QUẢN LÝ LƯƠNG — bảo vệ + các role xưởng MỚI ──
          Các role xưởng CŨ dùng route my-payroll nằm trong block riêng của họ
          để giữ nguyên sidebar quen thuộc. */}
      <Route path="/my-payroll"
        element={<TranslatedLayout
          rawNav={factoryPayrollNavRaw}
          allowedRoles={[
            'SECURITY',
            'FACTORY_SECURITY', 'FACTORY_STAFF',
            'FACTORY_PRODUCTION_WORKER', 'FACTORY_MANAGER',
          ]} />}>
        <Route index element={<MyPayrollPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}