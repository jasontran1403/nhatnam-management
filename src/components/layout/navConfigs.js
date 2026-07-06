/**
 * navConfigs.js — cấu hình nav menu cho từng role.
 */
import {
  LayoutDashboard, ShoppingCart, Users, UserCog,
  Warehouse, Package, LogOut, Receipt, TrendingUp,
  TrendingDown, BarChart2, Factory, ClipboardList,
  FileText, Layers, Globe, Tags, FlaskConical, UserCheck,
  FileSpreadsheet, ClipboardCheck, FileClock, Truck, Gauge,
  Wrench, Settings2, ShoppingBag, Archive, CalendarRange, Activity, Wallet, Calculator,
} from 'lucide-react';

export const adminNavRaw = [
  { to: '/admin/dashboard', labelKey: 'dashboard', icon: LayoutDashboard },
  { to: '/admin/orders', labelKey: 'orders', icon: ShoppingCart },
  { to: '/admin/customers', labelKey: 'customers', icon: Users },
  { to: '/admin/users', labelKey: 'employees', icon: UserCog },
  { to: '/admin/warehouses', labelKey: 'warehouses', icon: Warehouse },
  { to: '/admin/expenses', labelKey: 'expenses', icon: TrendingDown },
  { to: '/admin/incomes', labelKey: 'incomes', icon: TrendingUp },
  { to: '/admin/sale-kpi', labelKey: 'sale_kpi', icon: Receipt },
  { to: '/admin/analytics', labelKey: 'analytics', icon: BarChart2 },
  { to: '/admin/production', labelKey: 'production', icon: Factory },
];

export const ownerNavRaw = [
  { to: '/owner/dashboard', labelKey: 'dashboard', icon: LayoutDashboard },
  { to: '/owner/pos', labelKey: 'pos', icon: ShoppingCart },
  { to: '/owner/drafts', labelKey: 'drafts', icon: FileText },
  { to: '/owner/orders', labelKey: 'orders', icon: ClipboardList },
  { to: '/owner/customers', labelKey: 'customers', icon: Users },
  { to: '/owner/users', labelKey: 'employees', icon: UserCog },
  { to: '/owner/employees', labelKey: 'staff', icon: UserCheck },
  { to: '/owner/warehouses', labelKey: 'warehouses', icon: Warehouse },
  { to: '/owner/expenses', labelKey: 'expenses', icon: TrendingDown },
  { to: '/owner/incomes', labelKey: 'incomes', icon: TrendingUp },
  { to: '/owner/sale-kpi', labelKey: 'sale_kpi', icon: Receipt },
  { to: '/owner/analytics', labelKey: 'analytics', icon: BarChart2 },
  { to: '/owner/certificates', labelKey: 'certificates', icon: FileSpreadsheet },
  { to: '/owner/production', labelKey: 'production', icon: Factory },
];

export const hrNavRaw = [
  { to: '/hr/manage', labelKey: 'hr_manage', icon: UserCog },
  { to: '/hr/salaries', labelKey: 'salaries', icon: Receipt },
];

export const sellerNavRaw = [
  { to: '/seller/dashboard', labelKey: 'seller_dashboard', icon: LayoutDashboard },
  { to: '/seller/pos', labelKey: 'pos', icon: ShoppingCart },
  { to: '/seller/orders', labelKey: 'orders', icon: ClipboardCheck },
  { to: '/seller/drafts', labelKey: 'drafts', icon: FileClock },
  { to: '/seller/customers', labelKey: 'customers', icon: Users },
  { to: '/seller/quotation', labelKey: 'quotation', icon: Receipt },
  { to: '/seller/material-requests', labelKey: 'material_requests', icon: ShoppingBag, roles: ['SUPER_SELLER'] },
];

export const warehouseNavRaw = [
  { to: '/warehouse/management', labelKey: 'warehouse_management', icon: Warehouse },
  { to: '/warehouse/operations', labelKey: 'import_export', icon: Package },
  { to: '/warehouse/history', labelKey: 'history', icon: ClipboardList },
  { to: '/warehouse/expenses', labelKey: 'expenses', icon: TrendingDown },
  { to: '/warehouse/delivery', labelKey: 'delivering', icon: Truck },
  { to: '/warehouse/driver-attendance', labelKey: 'driver_attendance', icon: Gauge },
];

export const superWarehouseNavRaw = [
  { to: '/super-warehouse/management', labelKey: 'warehouse_management', icon: Warehouse },
  { to: '/super-warehouse/operations', labelKey: 'import_export', icon: Package },
  { to: '/super-warehouse/history', labelKey: 'history', icon: ClipboardList },
  { to: '/super-warehouse/expenses', labelKey: 'expenses', icon: TrendingDown },
  { to: '/warehouse/delivery', labelKey: 'delivering', icon: Truck },
  { to: '/warehouse/driver-attendance', labelKey: 'driver_attendance', icon: Gauge },
];

export const accountantNavRaw = [
  { to: '/accountant/dashboard', labelKey: 'dashboard', icon: LayoutDashboard },
  { to: '/accountant/orders', labelKey: 'orders', icon: ShoppingCart },
  { to: '/accountant/customers', labelKey: 'customers', icon: Users },
  { to: '/accountant/vendor-debts', labelKey: 'vendor_debts', icon: Wallet },
  { to: '/accountant/incomes', labelKey: 'incomes', icon: TrendingUp },
  { to: '/accountant/expenses', labelKey: 'expenses', icon: TrendingDown },
];

export const superAccountantNavRaw = [
  { to: '/super-accountant/dashboard', labelKey: 'dashboard', icon: LayoutDashboard },
  { to: '/super-accountant/history', labelKey: 'orders', icon: ShoppingCart },
  { to: '/super-accountant/customers', labelKey: 'customers', icon: Users },
  { to: '/super-accountant/vendor-debts', labelKey: 'vendor_debts', icon: Wallet },
  { to: '/super-accountant/expenses', labelKey: 'expenses', icon: TrendingDown },
  { to: '/super-accountant/incomes', labelKey: 'incomes', icon: TrendingUp },
  { to: '/super-accountant/warehouse-receipts', labelKey: 'warehouse_receipts', icon: FileText },
  // ── Phiếu đặt hàng nguyên liệu xưởng ────────────────────────────────────
  { to: '/super-accountant/material-requests', labelKey: 'material_requests', icon: ShoppingBag },
  { to: '/super-accountant/pricing', labelKey: 'pricing', icon: Calculator },
  // ── Quản lý nhân sự (SUPER_ACCOUNTANT được xem HR) ───────────────────────
  { to: '/super-accountant/manage', labelKey: 'hr_manage', icon: UserCog },
  { to: '/super-accountant/salaries', labelKey: 'salaries', icon: Receipt },
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
  // ── Kho thành phẩm xưởng ──────────────────────────────────────────────────
  // { to: '/factory/finished-goods', labelKey: 'finished_goods', icon: Package },
];

// ── SUPER_FACTORY_WORKER: dashboard sản xuất (kế hoạch/lệnh SX + máy móc) là
// mặc định, cộng thêm đặt hàng, tồn kho NVL, biến thể SX, máy móc & bảo trì
// (định kỳ + đột xuất), lịch sử lệnh SX, kho bán thành phẩm, tồn kho thành phẩm. ──
export const superFactoryWorkerNavRaw = [
  { to: '/super-factory/production', labelKey: 'production', icon: Factory },
  { to: '/super-factory/material-requests', labelKey: 'material_requests', icon: ShoppingBag },
  { to: '/super-factory/material-stock', labelKey: 'material_stock', icon: Archive },
  { to: '/super-factory/recipes', labelKey: 'production_variants', icon: FlaskConical },
  { to: '/super-factory/machines', labelKey: 'machine_manage', icon: Wrench },
  { to: '/super-factory/history', labelKey: 'work_order_history', icon: ClipboardList },
  { to: '/super-factory/semi-finished-goods', labelKey: 'semi_finished_goods', icon: Layers },
  // { to: '/super-factory/finished-goods', labelKey: 'finished_goods', icon: Package },
];

// ── FACTORY_ACCOUNTANT (Kế toán kho xưởng): xác nhận nhận phiếu chuyển kho bán
// thành phẩm (mặc định), quản lý kho thành phẩm (chuyển kho bán hàng/xuất kho),
// biên bản hao hụt đóng gói. ─────────────────────────────────────────────────
export const factoryAccountantNavRaw = [
  { to: '/factory-accountant/transfers', labelKey: 'semi_finished_transfers', icon: FileText },
  { to: '/factory-accountant/finished-goods', labelKey: 'finished_goods', icon: Package },
  { to: '/factory-accountant/loss-reports', labelKey: 'packaging_loss_reports', icon: ClipboardCheck },
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
  SUPER_FACTORY_WORKER: '/super-factory/production',
  FACTORY_ACCOUNTANT: '/factory-accountant/transfers',
  SELLER: '/seller/dashboard',
  SUPER_SELLER: '/seller/dashboard',
  HR: '/hr/manage',
};