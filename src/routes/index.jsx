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
  driverNavRaw, securityNavRaw, factoryPayrollNavRaw, factoryStaffNavRaw,
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
import DriverOdometerPage from '../pages/admin/DriverOdometerPage';
import AdminSupplierManagementPage from '../pages/admin/AdminSupplierManagementPage';
import SaleKpiPage from '../pages/admin/SaleKpiPage';
import OwnerAnalyticsPage from '../pages/owner/OwnerAnalyticsPage';
import OwnerProductionPage from '../pages/owner/OwnerProductionPage';
import OwnerEmployeesPage from '../pages/owner/OwnerEmployeesPage';
import OrgChartPage from '../pages/owner/OrgChartPage';
import DebtOrdersPage from '../pages/shared/DebtOrdersPage';
import CameraManagementPage from '../pages/shared/CameraManagementPage';

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
import PayrollPasscodeAdminPage from '../pages/hr/PayrollPasscodeAdminPage';

// Seller
import SellerDashboardPage from '../pages/seller/SellerDashboardPage';
import POSPage from '../pages/seller/POSPage';
import OrdersPage from '../pages/seller/OrdersPage';
import DraftOrdersPage from '../pages/seller/DraftOrdersPage';
import SellerCustomersPage from '../pages/seller/SellerCustomersPage';
import OrderForecastPage from '../pages/seller/OrderForecastPage';
import VoucherManagementPage from '../pages/shared/VoucherManagementPage';
import VoucherDetailPage from '../pages/shared/VoucherDetailPage';
import GiftOrdersPage from '../pages/shared/GiftOrdersPage';
import GiftOrderDetailPage from '../pages/shared/GiftOrderDetailPage';
import WarehouseGiftQueuePage from '../pages/warehouse/WarehouseGiftQueuePage';
import SubPageShell from '../components/common/SubPageShell';
import SellerProductionPage from '../pages/seller/SellerProductionPage';
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
import AccountantLotPricingPage from '../pages/accountant/AccountantLotPricingPage';
import ExpenseListPage from '../pages/accountant/ExpenseListPage';
import OwnerCashflowPage from '../pages/owner/OwnerCashflowPage';
import OwnerInventoryPage from '../pages/owner/OwnerInventoryPage';
import AccountantVendorDebtPage from '../pages/accountant/AccountantVendorDebtPage';
import IncomeListPage from '../pages/accountant/IncomeListPage';
// ── Phiếu đặt Văn phòng phẩm / Đồ dùng ───────────────────────────────────────
// (SuperAccountantMaterialRequestPage nay được render bên trong
//  SuperAccountantOrdersPage ở tab "Nguyên liệu sản xuất")
import SuperAccountantOrdersPage from '../pages/super_accountant/SuperAccountantOrdersPage';
import SupplyOrderPage from '../pages/shared/SupplyOrderPage';
import SupplyWarehousePage from '../pages/shared/SupplyWarehousePage';
import OwnerSupplyWarehousePage from '../pages/owner/OwnerSupplyWarehousePage';
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
import MyRequestsPage from '../pages/shared/MyRequestsPage';

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
        {/* Mở khoá cho nhân viên nhập sai mật khẩu xem lương 3 lần */}
        <Route path="payroll-passcode" element={<PayrollPasscodeAdminPage />} />
      </Route>

      {/* ── SELLER */}
      <Route path="/seller"
        element={<TranslatedLayout rawNav={sellerNavRaw} allowedRoles={['ADMIN', 'OWNER', 'SELLER', 'SUPER_SELLER']} />}>
        <Route index element={<Navigate to="/seller/dashboard" replace />} />
        <Route path="dashboard" element={<SellerDashboardPage />} />
        <Route path="pos" element={<POSPage />} />
        <Route path="orders" element={<OrdersPage />} />
        {/* Đơn nháp — vào bằng toggle trong trang Đơn hàng, nên có nút quay lại. */}
        <Route path="drafts" element={
          <SubPageShell backTo="/seller/orders" backLabel="Đơn hàng">
            <DraftOrdersPage />
          </SubPageShell>} />
        <Route path="customers" element={<SellerCustomersPage />} />
        {/* Dự báo đặt hàng — SELLER thấy khách được gán, SUPER_SELLER thấy tất cả
            (việc lọc do backend quyết định theo token, không truyền sellerId từ FE). */}
        <Route path="order-forecast" element={<OrderForecastPage />} />
        {/* Sản xuất — dùng lại màn hình của OWNER ở chế độ rút gọn.
            Trang chi tiết kế hoạch / lệnh sản xuất dùng chung component với OWNER. */}
        <Route path="production" element={<SellerProductionPage />} />
        <Route path="production/plans/:id" element={<OwnerPlanDetailPage />} />
        <Route path="production/work-orders/:id" element={<OwnerWorkOrderDetailPage />} />
        {/* Voucher: seller được tạo/xem cho khách của mình, không được sửa/thu hồi. */}
        {/* Voucher và Phiếu tặng quà KHÔNG còn ở menu — mở từ trang Khách hàng,
            nên bọc SubPageShell để có nút quay lại và hiệu ứng trượt. */}
        <Route path="vouchers" element={
          <SubPageShell backTo="/seller/customers">
            <VoucherManagementPage canManage={false} />
          </SubPageShell>} />
        <Route path="vouchers/:id" element={<VoucherDetailPage />} />
        <Route path="gift-orders" element={
          <SubPageShell backTo="/seller/customers">
            <GiftOrdersPage canApprove={false} />
          </SubPageShell>} />
        <Route path="gift-orders/:id" element={<GiftOrderDetailPage />} />
        <Route path="orders-manage" element={<AccountantOrdersPage />} />
        {/* Báo giá — mở từ trang Bán hàng. */}
        <Route path="quotation" element={
          <SubPageShell backTo="/seller/pos" backLabel="Bán hàng">
            <QuotationPage />
          </SubPageShell>} />
        {/* Phiếu đặt hàng (nguyên liệu) — mở từ trang Bán hàng. */}
        <Route path="material-requests" element={
          <SubPageShell backTo="/seller/pos" backLabel="Bán hàng">
            <SellerMaterialRequestPage />
          </SubPageShell>} />
        {/* Phiếu đặt văn phòng phẩm — tách hẳn khỏi phiếu nguyên liệu */}
        {/* Phiếu đặt văn phòng phẩm — mở từ trang Kho văn phòng phẩm. */}
        <Route path="supply-orders" element={
          <SubPageShell backTo="/seller/supply-warehouse" backLabel="Kho văn phòng phẩm">
            <SupplyOrderPage />
          </SubPageShell>} />
        <Route path="supply-warehouse" element={<SupplyWarehousePage />} />
        {/* Quản lý lương — phiếu lương theo tháng */}
        <Route path="my-payroll" element={<MyPayrollPage />} />
        {/* Phiếu của tôi — mở từ trang Quản lý lương. */}
        <Route path="my-requests" element={
          <SubPageShell backTo="/seller/my-payroll" backLabel="Quản lý lương">
            <MyRequestsPage />
          </SubPageShell>} />
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
        <Route path="vouchers" element={
          <SubPageShell backTo="/owner/customers">
            <VoucherManagementPage />
          </SubPageShell>} />
        <Route path="vouchers/:id" element={<VoucherDetailPage />} />
        <Route path="gift-orders" element={
          <SubPageShell backTo="/owner/customers">
            <GiftOrdersPage />
          </SubPageShell>} />
        <Route path="gift-orders/:id" element={<GiftOrderDetailPage />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="employees" element={<OwnerEmployeesPage />} />
        <Route path="org-chart" element={<OrgChartPage />} />
        <Route path="warehouses" element={<AdminWarehouses />} />
        <Route path="warehouses/:id/stock" element={<AdminWarehouseStock />} />
        <Route path="ingredients" element={<AdminIngredients />} />
        <Route path="expenses" element={<ExpenseVoucherPage />} />
        <Route path="drivers" element={<DriverOdometerPage />} />
        <Route path="incomes" element={<IncomeListPage adminMode />} />
        <Route path="cashflow" element={<OwnerCashflowPage />} />
        <Route path="inventory" element={<OwnerInventoryPage />} />
        <Route path="debt-orders" element={<DebtOrdersPage />} />
        <Route path="sale-kpi" element={<SaleKpiPage />} />
        <Route path="analytics" element={<OwnerAnalyticsPage />} />
        <Route path="certificates" element={<CertificatePage />} />
        {/* Quản lý camera */}
        <Route path="cameras" element={<CameraManagementPage />} />
        {/* Bảng chấm công — upload file Excel theo tháng */}
        <Route path="attendance" element={<AttendanceSheetsPage />} />
        {/* Mở khoá xem lương */}
        <Route path="payroll-passcode" element={<PayrollPasscodeAdminPage />} />

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
        {/* Kho văn phòng phẩm — Owner xem cả 2 kho, gán kho, gộp vật dụng */}
        <Route path="supply-warehouse" element={<OwnerSupplyWarehousePage />} />
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
        <Route path="vouchers" element={
          <SubPageShell backTo="/admin/customers">
            <VoucherManagementPage />
          </SubPageShell>} />
        <Route path="vouchers/:id" element={<VoucherDetailPage />} />
        <Route path="gift-orders" element={
          <SubPageShell backTo="/admin/customers">
            <GiftOrdersPage />
          </SubPageShell>} />
        <Route path="gift-orders/:id" element={<GiftOrderDetailPage />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="warehouses" element={<AdminWarehouses />} />
        <Route path="warehouses/:id/stock" element={<AdminWarehouseStock />} />
        <Route path="ingredients" element={<AdminIngredients />} />
        <Route path="batches" element={<AdminBatchApproval />} />
        <Route path="suppliers" element={<AdminSupplierManagementPage />} />
        <Route path="suppliers/:vendorId" element={<AdminSupplierManagementPage />} />
        <Route path="expenses" element={<ExpenseVoucherPage />} />
        <Route path="drivers" element={<DriverOdometerPage />} />
        <Route path="incomes" element={<IncomeListPage adminMode />} />
        <Route path="cashflow" element={<OwnerCashflowPage />} />
        <Route path="inventory" element={<OwnerInventoryPage />} />
        <Route path="debt-orders" element={<DebtOrdersPage />} />
        <Route path="sale-kpi" element={<SaleKpiPage />} />
        <Route path="analytics" element={<OwnerAnalyticsPage />} />
        {/* Quản lý camera */}
        <Route path="cameras" element={<CameraManagementPage />} />
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
        <Route path="gift-orders" element={<WarehouseGiftQueuePage />} />
        <Route path="driver-attendance" element={<DriverAttendancePage />} />
        {/* Quản lý lương — phiếu lương theo tháng */}
        <Route path="my-payroll" element={<MyPayrollPage />} />
        <Route path="my-requests" element={<MyRequestsPage />} />
      </Route>

      {/* ── SUPER WAREHOUSE */}
      <Route path="/super-warehouse"
        element={<TranslatedLayout rawNav={superWarehouseNavRaw} allowedRoles={['SUPER_WAREHOUSE']} />}>
        <Route index element={<Navigate to="/super-warehouse/management" replace />} />
        {/* Phiếu đặt văn phòng phẩm */}
        <Route path="supply-orders" element={<SupplyOrderPage />} />
        <Route path="supply-warehouse" element={<SupplyWarehousePage />} />
        <Route path="management" element={<ManagementPage />} />
        <Route path="operations" element={<OperationsPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="expenses" element={<ExpenseListPage />} />
        <Route path="delivery" element={<WarehouseDeliveryPage />} />
        <Route path="gift-orders" element={<WarehouseGiftQueuePage />} />
        {/* Quản lý lương — phiếu lương theo tháng */}
        <Route path="my-payroll" element={<MyPayrollPage />} />
        <Route path="my-requests" element={<MyRequestsPage />} />
      </Route>

      {/* ── ACCOUNTANT */}
      <Route path="/accountant"
        element={<TranslatedLayout rawNav={accountantNavRaw} allowedRoles={['ADMIN', 'OWNER', 'ACCOUNTANT', 'SUPER_ACCOUNTANT']} />}>
        <Route index element={<Navigate to="/accountant/dashboard" replace />} />
        <Route path="dashboard" element={<AccountantDashboardPage />} />
        <Route path="orders" element={<AccountantOrdersPage />} />
        <Route path="debt-orders" element={<DebtOrdersPage />} />
        {/* Dùng chung page với SUPER_ACCOUNTANT để đồng bộ layout + có lock/unlock */}
        <Route path="customers" element={<SuperAccountantCustomers />} />
        <Route path="suppliers" element={<SupplierManagementPage />} />
        <Route path="vendor-debts" element={<AccountantVendorDebtPage />} />
        <Route path="vendor-debts/:vendorId" element={<AccountantVendorDebtPage />} />
        <Route path="incomes" element={<IncomeListPage />} />
        <Route path="expenses" element={<ExpenseListPage />} />
        {/* Quản lý lương — phiếu lương theo tháng */}
        {/* ── Kho hàng (CHỈ XEM) — dùng chung page với OWNER/ADMIN.
             Kế toán cần đối chiếu tồn kho với chứng từ, nhưng không được tạo /
             sửa / đóng kho; các nút thao tác bị ẩn theo rolePrefix trong page,
             backend vẫn chặn độc lập. */}
        <Route path="warehouses" element={<AdminWarehouses />} />
        <Route path="warehouses/:id/stock" element={<AdminWarehouseStock />} />
        <Route path="supply-warehouse" element={<OwnerSupplyWarehousePage />} />
        <Route path="my-payroll" element={<MyPayrollPage />} />
        <Route path="my-requests" element={<MyRequestsPage />} />
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
        {/* 2 tab: "Nguyên liệu sản xuất" (page cũ, giữ nguyên) + "Đồ dùng" */}
        <Route path="material-requests" element={<SuperAccountantOrdersPage />} />
        <Route path="pricing" element={<PricingCalculatorPage />} />
        <Route path="warehouse-receipts" element={<AccountantWarehouseReceiptsPage />} />
        {/* Panel điều chỉnh lô — nhập giá vốn cho lô mới do kho tạo */}
        {/* ── Kho hàng (CHỈ XEM) — dùng chung page với OWNER/ADMIN.
             Kế toán cần đối chiếu tồn kho với chứng từ, nhưng không được tạo /
             sửa / đóng kho; các nút thao tác bị ẩn theo rolePrefix trong page,
             backend vẫn chặn độc lập. */}
        <Route path="warehouses" element={<AdminWarehouses />} />
        <Route path="warehouses/:id/stock" element={<AdminWarehouseStock />} />
        <Route path="supply-warehouse" element={<OwnerSupplyWarehousePage />} />
        <Route path="lot-pricing" element={<AccountantLotPricingPage />} />
        <Route path="manage" element={<HrPage />} />
        <Route path="salaries" element={<HrSalaryStatusPage />} />
        {/* Quản lý lương — phiếu lương theo tháng */}
        <Route path="my-payroll" element={<MyPayrollPage />} />
        <Route path="my-requests" element={<MyRequestsPage />} />
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
        <Route path="my-requests" element={<MyRequestsPage />} />
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
        {/* Phiếu đặt văn phòng phẩm */}
        <Route path="supply-orders" element={<SupplyOrderPage />} />
        <Route path="supply-warehouse" element={<SupplyWarehousePage />} />
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
        <Route path="my-requests" element={<MyRequestsPage />} />
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
        <Route path="my-requests" element={<MyRequestsPage />} />
      </Route>

      {/* ── TÀI XẾ ── */}
      <Route path="/driver"
        element={<TranslatedLayout rawNav={driverNavRaw} allowedRoles={['DRIVER']} />}>
        <Route index element={<Navigate to="/driver/orders" replace />} />
        <Route path="orders" element={<DriverDashboardPage />} />
        <Route path="orders/:id" element={<DriverOrderDetailPage />} />
        {/* Quản lý lương — lịch tháng + số km chạy mỗi ngày */}
        <Route path="my-payroll" element={<MyPayrollPage />} />
        <Route path="my-requests" element={<MyRequestsPage />} />
      </Route>

      {/* ── TRỢ LÝ XƯỞNG (FACTORY_STAFF) ──
          Dùng CHUNG các trang của Nhân viên xưởng (cùng component), chỉ khác
          nhãn trang đầu. BE đã cho FACTORY_STAFF gọi /api/factory/** và
          /api/owner/production/**. */}
      <Route path="/factory-staff"
        element={<TranslatedLayout rawNav={factoryStaffNavRaw} allowedRoles={['FACTORY_STAFF']} />}>
        <Route index element={<Navigate to="/factory-staff/history" replace />} />
        <Route path="history" element={<FactoryOrdersPage />} />
        <Route path="machines" element={<FactoryMachinePage />} />
        <Route path="material-requests" element={<FactoryMaterialRequestPage />} />
        <Route path="semi-finished-goods" element={<FactorySemiFinishedGoodsPage />} />
        <Route path="my-payroll" element={<MyPayrollPage />} />
        <Route path="my-requests" element={<MyRequestsPage />} />
      </Route>

      {/* ── QUẢN LÝ LƯƠNG — bảo vệ + các role xưởng MỚI ──
          Các role xưởng CŨ dùng route my-payroll nằm trong block riêng của họ
          để giữ nguyên sidebar quen thuộc. */}
      <Route path="/my-payroll"
        element={<TranslatedLayout
          rawNav={factoryPayrollNavRaw}
          allowedRoles={[
            'SECURITY',
            'FACTORY_SECURITY',
            'FACTORY_PRODUCTION_WORKER', 'FACTORY_MANAGER',
          ]} />}>
        <Route index element={<MyPayrollPage />} />
      </Route>

      {/* ── PHIẾU CỦA TÔI — cùng tập role với /my-payroll ở trên.
          Tách route riêng thay vì lồng vào /my-payroll để URL và mục sidebar
          khớp nhau, tránh trang lương bị active khi đang ở trang phiếu. */}
      <Route path="/my-requests"
        element={<TranslatedLayout
          rawNav={factoryPayrollNavRaw}
          allowedRoles={[
            'SECURITY',
            'FACTORY_SECURITY',
            'FACTORY_PRODUCTION_WORKER', 'FACTORY_MANAGER',
          ]} />}>
        <Route index element={<MyRequestsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}