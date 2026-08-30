/**
 * navConfigs.js — cấu hình nav menu cho từng role.
 */
import {
  LayoutDashboard, ShoppingCart, Users, UserCog,
  Warehouse, Package, LogOut, Receipt, TrendingUp,
  TrendingDown, Factory, ClipboardList,
  FileText, Layers, Globe, Tags, FlaskConical,
  FileSpreadsheet, ClipboardCheck, Truck, Gauge,
  Wrench, Settings2, ShoppingBag, Archive, CalendarRange, Wallet, Calculator, Building2,
  Boxes, Video, ShieldAlert, Gift,
} from 'lucide-react';

// ── ADMIN ─────────────────────────────────────────────────────────────────────
// Dòng tiền / KPI Sale / Phân tích mở bằng nút trên trang Dashboard;
// Phiếu thu / Phiếu chi mở bằng nút trên trang Dòng tiền;
// Tài xế mở bằng nút trên trang Nhân viên. Xem components/common/SubPageNav.jsx.
export const adminNavRaw = [
  { to: '/admin/dashboard', labelKey: 'dashboard', icon: LayoutDashboard },
  { to: '/admin/orders', labelKey: 'orders', icon: ShoppingCart },
  { to: '/admin/customers', labelKey: 'customers', icon: Users },
  { to: '/admin/users', labelKey: 'employees', icon: UserCog },
  { to: '/admin/warehouses', labelKey: 'warehouses', icon: Warehouse },
  { to: '/admin/suppliers', labelKey: 'supplier_management', icon: Building2 },
  { to: '/admin/production', labelKey: 'production', icon: Factory },
  { to: '/admin/cameras', labelKey: 'cameras', icon: Video },
];

// ── OWNER ─────────────────────────────────────────────────────────────────────
// Đã gom vào nút trên trang chính (không còn ở sidebar):
//   Dashboard   → Dòng tiền, Quản lý sales, Dự báo
//   Dòng tiền   → Phiếu thu, Phiếu chi
//   Nhân viên   → Duyệt lương, Tài xế, Bảng chấm công (mở khoá xem lương
//                 nằm ngay cột Thao tác của từng dòng)
//   Kho hàng    → Lượng tiêu thụ, Kho văn phòng phẩm
export const ownerNavRaw = [
  { to: '/owner/dashboard', labelKey: 'dashboard', icon: LayoutDashboard },
  { to: '/owner/pos', labelKey: 'pos', icon: ShoppingCart },
  { to: '/owner/drafts', labelKey: 'drafts', icon: FileText },
  { to: '/owner/orders', labelKey: 'orders', icon: ClipboardList },
  { to: '/owner/customers', labelKey: 'customers', icon: Users },
  { to: '/owner/users', labelKey: 'employees', icon: UserCog },
  { to: '/owner/warehouses', labelKey: 'warehouses', icon: Warehouse },
  { to: '/owner/production/suppliers', labelKey: 'supplier_management', icon: Building2 },
  { to: '/owner/certificates', labelKey: 'certificates', icon: FileSpreadsheet },
  { to: '/owner/production', labelKey: 'production', icon: Factory },
  { to: '/owner/cameras', labelKey: 'cameras', icon: Video },
];

export const hrNavRaw = [
  { to: '/hr/manage', labelKey: 'hr_manage', icon: UserCog },
  { to: '/hr/salaries', labelKey: 'salaries', icon: Receipt },
  // Mở khoá cho nhân viên nhập sai mật khẩu xem lương 3 lần
  { to: '/hr/payroll-passcode', labelKey: 'payroll_passcode', icon: ShieldAlert },
];

export const sellerNavRaw = [
  { to: '/seller/dashboard', labelKey: 'seller_dashboard', icon: LayoutDashboard },
  // Bán hàng — mở kèm Phiếu đặt hàng và Báo giá bằng nút trong trang.
  { to: '/seller/pos', labelKey: 'pos', icon: ShoppingCart },
  // Đơn hàng — có toggle sang Đơn nháp ngay trong trang.
  { to: '/seller/orders', labelKey: 'orders', icon: ClipboardCheck },
  { to: '/seller/customers', labelKey: 'customers', icon: Users },
  // Dự báo đặt hàng — cả SELLER lẫn SUPER_SELLER đều thấy (không khai `roles`).
  { to: '/seller/order-forecast', labelKey: 'order_forecast', icon: TrendingUp },
  { to: '/seller/production', labelKey: 'production', icon: Factory },
  // Kho VPP — mở Phiếu đặt văn phòng phẩm bằng nút trong trang.
  { to: '/seller/supply-warehouse', labelKey: 'supply_warehouse', icon: Archive, roles: ['SUPER_SELLER'] },
  // Quản lý lương — mở Phiếu của tôi bằng nút trong trang.
  { to: '/seller/my-payroll', labelKey: 'my_payroll', icon: Wallet },
];

/*
 * ĐÃ GỠ KHỎI MENU (mở bằng nút từ trang cha, xem SubPageShell):
 *   /seller/drafts          → toggle trong trang Đơn hàng
 *   /seller/quotation       → nút trong trang Bán hàng
 *   /seller/material-requests → nút trong trang Bán hàng
 *   /seller/supply-orders   → nút trong trang Kho văn phòng phẩm
 *   /seller/my-requests     → nút trong trang Quản lý lương
 *   /seller/vouchers, /seller/gift-orders → nút trong trang Khách hàng
 *
 * Route vẫn còn nguyên trong routes/index.jsx — chỉ mục menu bị gỡ, không phải tính năng.
 */

export const warehouseNavRaw = [
  { to: '/warehouse/management', labelKey: 'warehouse_management', icon: Warehouse },
  { to: '/warehouse/operations', labelKey: 'import_export', icon: Package },
  { to: '/warehouse/history', labelKey: 'history', icon: ClipboardList },
  { to: '/warehouse/delivery', labelKey: 'delivering', icon: Truck },
  { to: '/warehouse/gift-orders', labelKey: 'gift_orders', icon: Gift },
  { to: '/warehouse/driver-attendance', labelKey: 'driver_attendance', icon: Gauge },
  // ── Quản lý lương — phiếu lương theo tháng ──────────────────────────────
  { to: '/warehouse/my-payroll', labelKey: 'my_payroll', icon: Wallet },
  { to: '/warehouse/my-requests', labelKey: 'my_requests', icon: FileText },
];

export const superWarehouseNavRaw = [
  { to: '/super-warehouse/management', labelKey: 'warehouse_management', icon: Warehouse },
  // ── Phiếu đặt Văn phòng phẩm / Đồ dùng ────────────────────────────────────
  { to: '/super-warehouse/supply-orders', labelKey: 'supply_orders', icon: Boxes },
  { to: '/super-warehouse/supply-warehouse', labelKey: 'supply_warehouse', icon: Archive },
  { to: '/super-warehouse/operations', labelKey: 'import_export', icon: Package },
  { to: '/super-warehouse/history', labelKey: 'history', icon: ClipboardList },
  { to: '/super-warehouse/expenses', labelKey: 'expenses', icon: TrendingDown },
  { to: '/warehouse/delivery', labelKey: 'delivering', icon: Truck },
  { to: '/warehouse/gift-orders', labelKey: 'gift_orders', icon: Gift },
  { to: '/warehouse/driver-attendance', labelKey: 'driver_attendance', icon: Gauge },
  // ── Quản lý lương — phiếu lương theo tháng ──────────────────────────────
  { to: '/super-warehouse/my-payroll', labelKey: 'my_payroll', icon: Wallet },
  { to: '/super-warehouse/my-requests', labelKey: 'my_requests', icon: FileText },
];

export const accountantNavRaw = [
  { to: '/accountant/dashboard', labelKey: 'dashboard', icon: LayoutDashboard },
  { to: '/accountant/orders', labelKey: 'orders', icon: ShoppingCart },
  { to: '/accountant/customers', labelKey: 'customers', icon: Users },
  // Kho hàng CHỈ XEM — Kho văn phòng phẩm mở bằng nút trong trang này.
  { to: '/accountant/warehouses', labelKey: 'warehouses', icon: Warehouse },
  { to: '/accountant/vendor-debts', labelKey: 'vendor_debts', icon: Wallet },
  // Phiếu thu / Phiếu chi đã chuyển vào bên trong page Dòng tiền (mở từ Dashboard).
  // ── Quản lý lương — phiếu lương theo tháng ──────────────────────────────
  { to: '/accountant/my-payroll', labelKey: 'my_payroll', icon: Wallet },
  { to: '/accountant/my-requests', labelKey: 'my_requests', icon: FileText },
];

export const superAccountantNavRaw = [
  { to: '/super-accountant/dashboard', labelKey: 'dashboard', icon: LayoutDashboard },
  { to: '/super-accountant/history', labelKey: 'orders', icon: ShoppingCart },
  { to: '/super-accountant/customers', labelKey: 'customers', icon: Users },
  // Kho hàng CHỈ XEM — Kho văn phòng phẩm mở bằng nút trong trang này.
  { to: '/super-accountant/warehouses', labelKey: 'warehouses', icon: Warehouse },
  { to: '/super-accountant/vendor-debts', labelKey: 'vendor_debts', icon: Wallet },
  // Phiếu thu / Phiếu chi đã chuyển vào bên trong page Dòng tiền (mở từ Dashboard).
  { to: '/super-accountant/warehouse-receipts', labelKey: 'warehouse_receipts', icon: FileText },
  { to: '/super-accountant/lot-pricing', labelKey: 'lot_pricing', icon: Layers },
  // ── Phiếu đặt hàng nguyên liệu xưởng ────────────────────────────────────
  { to: '/super-accountant/material-requests', labelKey: 'material_requests', icon: ShoppingBag },
  { to: '/super-accountant/pricing', labelKey: 'pricing', icon: Calculator },
  // ── Quản lý nhân sự (SUPER_ACCOUNTANT được xem HR) ───────────────────────
  { to: '/super-accountant/manage', labelKey: 'hr_manage', icon: UserCog },
  { to: '/super-accountant/salaries', labelKey: 'salaries', icon: Receipt },
  // ── Quản lý lương — phiếu lương theo tháng ──────────────────────────────
  { to: '/super-accountant/my-payroll', labelKey: 'my_payroll', icon: Wallet },
  { to: '/super-accountant/my-requests', labelKey: 'my_requests', icon: FileText },
];

export const operatorNavRaw = [
  { to: '/operator/products', labelKey: 'products', icon: Package },
  { to: '/operator/ingredients', labelKey: 'ingredients', icon: FlaskConical },
  { to: '/operator/batches', labelKey: 'batches', icon: Layers },
  { to: '/operator/certificates', labelKey: 'certificates', icon: FileSpreadsheet },
  { to: '/operator/landingpage', labelKey: 'landing_page', icon: Globe },
];

// ── FACTORY_WORKER: chỉ còn lệnh SX (mặc định), máy móc & bảo trì (chỉ báo sự cố),
// phiếu đặt hàng (chỉ xác nhận nhận hàng), kho bán thành phẩm (chuyển kho TP),
// kho thành phẩm xưởng. ────────────────────────────────────────────────────────
export const factoryWorkerNavRaw = [
  { to: '/factory/orders', labelKey: 'work_orders', icon: ClipboardList },
  { to: '/factory/machines', labelKey: 'machine_manage', icon: Wrench },
  // ── Phiếu đặt hàng nguyên liệu (chỉ xác nhận nhận hàng) ──────────────────
  { to: '/factory/material-requests', labelKey: 'material_requests', icon: ShoppingBag },
  // ── Kho bán thành phẩm (chưa đóng gói) — lập phiếu chuyển kho thành phẩm ──
  { to: '/factory/semi-finished-goods', labelKey: 'semi_finished_goods', icon: Layers },
  // ── Quản lý lương (phiếu lương theo tháng + thưởng KPI) ───────────────────
  { to: '/factory/my-payroll', labelKey: 'my_payroll', icon: Wallet },
  { to: '/factory/my-requests', labelKey: 'my_requests', icon: FileText },
  // ── Kho thành phẩm xưởng ──────────────────────────────────────────────────
  // { to: '/factory/finished-goods', labelKey: 'finished_goods', icon: Package },
];

// ── SUPER_FACTORY_WORKER: dashboard sản xuất (kế hoạch/lệnh SX + máy móc) là
// mặc định, cộng thêm đặt hàng, tồn kho NVL, biến thể SX, máy móc & bảo trì
// (định kỳ + đột xuất), lịch sử lệnh SX, kho bán thành phẩm, tồn kho thành phẩm. ──
export const superFactoryWorkerNavRaw = [
  { to: '/super-factory/production', labelKey: 'production', icon: Factory },
  { to: '/super-factory/material-requests', labelKey: 'material_requests', icon: ShoppingBag },
  // ── Phiếu đặt Văn phòng phẩm / Đồ dùng ────────────────────────────────────
  { to: '/super-factory/supply-orders', labelKey: 'supply_orders', icon: Boxes },
  { to: '/super-factory/supply-warehouse', labelKey: 'supply_warehouse', icon: Archive },
  { to: '/super-factory/material-stock', labelKey: 'material_stock', icon: Archive },
  { to: '/super-factory/recipes', labelKey: 'production_variants', icon: FlaskConical },
  { to: '/super-factory/machines', labelKey: 'machine_manage', icon: Wrench },
  { to: '/super-factory/history', labelKey: 'work_order_history', icon: ClipboardList },
  { to: '/super-factory/expenses', labelKey: 'expenses', icon: TrendingDown },
  { to: '/super-factory/semi-finished-goods', labelKey: 'semi_finished_goods', icon: Layers },
  { to: '/super-factory/my-payroll', labelKey: 'my_payroll', icon: Wallet },
  { to: '/super-factory/my-requests', labelKey: 'my_requests', icon: FileText },
  // { to: '/super-factory/finished-goods', labelKey: 'finished_goods', icon: Package },
];

// ── FACTORY_ACCOUNTANT (Kế toán kho xưởng): xác nhận nhận phiếu chuyển kho bán
// Kế toán kho xưởng: "Kho" (4 tab: thành phẩm, nguyên liệu, phiếu chuyển kho, BB hao hụt).
// Phiếu đặt hàng NL truy cập từ nút trong tab Kho nguyên liệu.
export const factoryAccountantNavRaw = [
  { to: '/factory-accountant/warehouse', labelKey: 'warehouses', icon: Package },
  { to: '/factory-accountant/my-payroll', labelKey: 'my_payroll', icon: Wallet },
  { to: '/factory-accountant/my-requests', labelKey: 'my_requests', icon: FileText },
];

// ── TÀI XẾ: chỉ 1 trang duy nhất là danh sách đơn đang giao ───────────────────
export const driverNavRaw = [
  { to: '/driver/orders', labelKey: 'delivering', icon: Truck },
  // ── Quản lý lương — phiếu lương theo tháng ──────────────────────────────
  { to: '/driver/my-payroll', labelKey: 'my_payroll', icon: Wallet },
  { to: '/driver/my-requests', labelKey: 'my_requests', icon: FileText },
];

// ── BẢO VỆ (công ty): hiện chỉ có trang lương ────────────────────────────────
export const securityNavRaw = [
  { to: '/my-payroll', labelKey: 'my_payroll', icon: Wallet },
  { to: '/my-requests', labelKey: 'my_requests', icon: FileText },
];

// ── NHÂN SỰ XƯỞNG role MỚI (bảo vệ xưởng, trợ lý kho, NV sản xuất, quản lý
// xưởng): hiện CHỈ có 1 trang "Quản lý lương". ───────────────────────────────
export const factoryPayrollNavRaw = [
  { to: '/my-payroll', labelKey: 'my_payroll', icon: Wallet },
  { to: '/my-requests', labelKey: 'my_requests', icon: FileText },
];

// ── FACTORY_STAFF (Trợ lý xưởng): DÙNG CHUNG các trang của FACTORY_WORKER —
// lịch sử lệnh SX, máy móc & bảo trì, phiếu đặt hàng NVL, kho bán thành phẩm —
// cộng lương & phiếu của tôi. Các trang là cùng component với Nhân viên xưởng,
// chỉ khác nhãn trang đầu ("Lịch sử lệnh sản xuất" theo yêu cầu). ─────────────
export const factoryStaffNavRaw = [
  { to: '/factory-staff/history', labelKey: 'work_order_history', icon: ClipboardList },
  { to: '/factory-staff/machines', labelKey: 'machine_manage', icon: Wrench },
  { to: '/factory-staff/material-requests', labelKey: 'material_requests', icon: ShoppingBag },
  { to: '/factory-staff/semi-finished-goods', labelKey: 'semi_finished_goods', icon: Layers },
  { to: '/factory-staff/my-payroll', labelKey: 'my_payroll', icon: Wallet },
  { to: '/factory-staff/my-requests', labelKey: 'my_requests', icon: FileText },
];

/** Helper: build translated nav items from raw config + t function */
export function buildNav(rawNav, t, userRole) {
  return rawNav
    .filter(({ roles }) => !roles || (userRole && roles.includes(userRole)))
    .map(({ to, labelKey, icon }) => ({
      to,
      label: t('nav', labelKey),
      icon,
    }));
}

// Legacy exports — kept for backward compat
export const adminNav = adminNavRaw.map(({ to, labelKey, icon }) => ({ to, label: labelKey, icon }));
export const ownerNav = ownerNavRaw.map(({ to, labelKey, icon }) => ({ to, label: labelKey, icon }));
export const hrNav = hrNavRaw.map(({ to, labelKey, icon }) => ({ to, label: labelKey, icon }));
export const sellerNav = sellerNavRaw.map(({ to, labelKey, icon }) => ({ to, label: labelKey, icon }));
export const warehouseNav = warehouseNavRaw.map(({ to, labelKey, icon }) => ({ to, label: labelKey, icon }));
export const superWarehouseNav = superWarehouseNavRaw.map(({ to, labelKey, icon }) => ({ to, label: labelKey, icon }));
export const accountantNav = accountantNavRaw.map(({ to, labelKey, icon }) => ({ to, label: labelKey, icon }));
export const superAccountantNav = superAccountantNavRaw.map(({ to, labelKey, icon }) => ({ to, label: labelKey, icon }));
export const operatorNav = operatorNavRaw.map(({ to, labelKey, icon }) => ({ to, label: labelKey, icon }));
export const factoryWorkerNav = factoryWorkerNavRaw.map(({ to, labelKey, icon }) => ({ to, label: labelKey, icon }));
export const superFactoryWorkerNav = superFactoryWorkerNavRaw.map(({ to, labelKey, icon }) => ({ to, label: labelKey, icon }));
export const factoryAccountantNav = factoryAccountantNavRaw.map(({ to, labelKey, icon }) => ({ to, label: labelKey, icon }));
export const driverNav = driverNavRaw.map(({ to, labelKey, icon }) => ({ to, label: labelKey, icon }));
export const securityNav = securityNavRaw.map(({ to, labelKey, icon }) => ({ to, label: labelKey, icon }));
export const factoryPayrollNav = factoryPayrollNavRaw.map(({ to, labelKey, icon }) => ({ to, label: labelKey, icon }));

// Default path cho từng role
export const ROLE_DEFAULT_PATH = {
  ADMIN: '/admin/dashboard',
  OWNER: '/owner/dashboard',
  WAREHOUSE: '/warehouse/management',
  SUPER_WAREHOUSE: '/super-warehouse/management',
  ACCOUNTANT: '/accountant/dashboard',
  SUPER_ACCOUNTANT: '/super-accountant/dashboard',
  OPERATOR: '/operator/products',
  SHIPPER: '/shipper/dashboard',
  FACTORY_WORKER: '/factory/orders',
  FACTORY_STAFF: '/factory-staff/history',
  SUPER_FACTORY_WORKER: '/super-factory/production',
  FACTORY_ACCOUNTANT: '/factory-accountant/warehouse',
  SELLER: '/seller/dashboard',
  SUPER_SELLER: '/seller/dashboard',
  HR: '/hr/manage',
  DRIVER:                    '/driver/orders',
  SECURITY:                  '/my-payroll',
  FACTORY_SECURITY:          '/my-payroll',
  FACTORY_PRODUCTION_WORKER: '/my-payroll',
  FACTORY_MANAGER:           '/my-payroll',
};