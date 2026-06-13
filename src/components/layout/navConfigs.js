/**
 * navConfigs.js — cấu hình nav menu cho từng role.
 */
import {
  LayoutDashboard, ShoppingCart, Users, UserCog,
  Warehouse, Package, LogOut, Receipt, TrendingUp,
  TrendingDown, BarChart2, Factory, ClipboardList,
  FileText, Layers, Globe, Tags, FlaskConical, UserCheck,
  FileSpreadsheet, ClipboardCheck, FileClock, Truck, Gauge,
  Wrench, Settings2,
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
  // ── Sản xuất — 1 item duy nhất, dashboard gộp tất cả ──────────────────────
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
  { to: '/accountant/incomes', labelKey: 'incomes', icon: TrendingUp },
  { to: '/accountant/expenses', labelKey: 'expenses', icon: TrendingDown },
  // { to: '/accountant/suppliers', labelKey: 'suppliers', icon: Package },
];

export const superAccountantNavRaw = [
  { to: '/super-accountant/dashboard', labelKey: 'dashboard', icon: LayoutDashboard },
  { to: '/super-accountant/history', labelKey: 'orders', icon: ShoppingCart },
  { to: '/super-accountant/customers', labelKey: 'customers', icon: Users },
  { to: '/super-accountant/expenses', labelKey: 'expenses', icon: TrendingDown },
  { to: '/super-accountant/incomes', labelKey: 'incomes', icon: TrendingUp },
  { to: '/super-accountant/warehouse-receipts', labelKey: 'warehouse_receipts', icon: FileText },
  // { to: '/super-accountant/suppliers', labelKey: 'suppliers', icon: Package },
];

export const operatorNavRaw = [
  { to: '/operator/products', labelKey: 'products', icon: Package },
  { to: '/operator/ingredients', labelKey: 'ingredients', icon: FlaskConical },
  { to: '/operator/batches', labelKey: 'batches', icon: Layers },
  { to: '/operator/certificates', labelKey: 'certificates', icon: FileSpreadsheet },
  { to: '/operator/landingpage', labelKey: 'landing_page', icon: Globe },
];

export const factoryWorkerNavRaw = [
  { to: '/factory/dashboard', labelKey: 'dashboard', icon: LayoutDashboard },
  // Lệnh sản xuất — trang mới (xem lệnh, lập phương án, xác nhận bước)
  { to: '/factory/orders', labelKey: 'work_orders', icon: ClipboardList },
  // Nhập mẻ legacy (vẫn giữ)
  { to: '/factory/batches', labelKey: 'factory_batches', icon: ClipboardCheck },
  // Lịch sử mẻ
  { to: '/factory/history', labelKey: 'batch_history', icon: Package },
  // Quản lý máy + bảo trì
  { to: '/factory/machines', labelKey: 'machine_manage', icon: Wrench },
];

/** Helper: build translated nav items from raw config + t function */
export function buildNav(rawNav, t) {
  return rawNav.map(({ to, labelKey, icon }) => ({
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
  FACTORY_WORKER: '/factory/dashboard',
  SELLER: '/seller/dashboard',
  SUPER_SELLER: '/seller/dashboard',
  HR: '/hr/manage',
};