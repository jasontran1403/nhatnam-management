/**
 * navConfigs.js — cấu hình nav menu cho từng role.
 * Labels giờ là i18n keys, AppLayout sẽ dịch qua t('nav', key).
 * Export thêm hàm buildNav(t) để tạo nav items đã dịch.
 */
import {
  LayoutDashboard, ShoppingCart, Users, UserCog,
  Warehouse, Package, LogOut, Receipt, TrendingUp,
  TrendingDown, BarChart2, Factory, ClipboardList,
  FileText, Layers, Globe, Tags, FlaskConical, UserCheck,
  FileSpreadsheet,
  ClipboardCheck,
  FileClock,
  Truck
} from 'lucide-react';

// Raw nav configs với i18n keys
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
  // { to: '/warehouse/orders', labelKey: 'orders', icon: ShoppingCart },
  { to: '/warehouse/delivery', labelKey: 'delivering', icon: Truck },
];

export const superWarehouseNavRaw = [
  { to: '/super-warehouse/management', labelKey: 'warehouse_management', icon: Warehouse },
  { to: '/super-warehouse/operations', labelKey: 'import_export', icon: Package },
  { to: '/super-warehouse/history', labelKey: 'history', icon: ClipboardList },
  { to: '/super-warehouse/expenses', labelKey: 'expenses', icon: TrendingDown },
  // { to: '/super-warehouse/orders', labelKey: 'orders', icon: ShoppingCart },
  { to: '/warehouse/delivery', labelKey: 'delivering', icon: Truck },
];

export const accountantNavRaw = [
  { to: '/accountant/dashboard', labelKey: 'dashboard', icon: LayoutDashboard },
  { to: '/accountant/orders', labelKey: 'orders', icon: ShoppingCart },
  { to: '/accountant/customers', labelKey: 'customers', icon: Users },
  { to: '/accountant/suppliers', labelKey: 'suppliers', icon: Package },
  { to: '/accountant/incomes', labelKey: 'incomes', icon: TrendingUp },
];

export const superAccountantNavRaw = [
  { to: '/super-accountant/dashboard', labelKey: 'dashboard', icon: LayoutDashboard },
  { to: '/super-accountant/history', labelKey: 'orders', icon: ShoppingCart },
  { to: '/super-accountant/expenses', labelKey: 'expenses', icon: TrendingDown },
  { to: '/super-accountant/incomes', labelKey: 'incomes', icon: TrendingUp },
  { to: '/super-accountant/suppliers', labelKey: 'suppliers', icon: Package },
  { to: '/super-accountant/warehouse-receipts', labelKey: 'warehouse_receipts', icon: FileText },
];

export const operatorNavRaw = [
  { to: '/operator/products', labelKey: 'products', icon: Package },
  { to: '/operator/ingredients', labelKey: 'ingredients', icon: FlaskConical },
  // { to: '/operator/categories',  labelKey: 'categories',  icon: Tags },
  { to: '/operator/batches', labelKey: 'batches', icon: Layers },
  { to: '/operator/landingpage', labelKey: 'landing_page', icon: Globe },
];

export const factoryWorkerNavRaw = [
  { to: '/factory/dashboard', labelKey: 'dashboard', icon: LayoutDashboard },
  { to: '/factory/batches', labelKey: 'factory_batches', icon: ClipboardList },
  { to: '/factory/history', labelKey: 'batch_history', icon: Package },
];

/** Helper: build translated nav items from raw config + t function */
export function buildNav(rawNav, t) {
  return rawNav.map(({ to, labelKey, icon }) => ({
    to,
    label: t('nav', labelKey),
    icon,
  }));
}

// Legacy exports (static VI labels) — kept for backward compat
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
