/**
 * navConfigs.js — cấu hình nav menu cho từng role.
 * Import vào routes để truyền vào AppLayout.
 */
import {
  LayoutDashboard, ShoppingCart, Users, UserCog,
  Warehouse, Package, LogOut, Receipt, TrendingUp,
  TrendingDown, BarChart2, Factory, ClipboardList,
  FileText, Layers, Globe, Tags, FlaskConical, UserCheck,
} from 'lucide-react';

export const adminNav = [
  { to: '/admin/dashboard',  label: 'Dashboard',      icon: LayoutDashboard },
  { to: '/admin/orders',     label: 'Đơn hàng',       icon: ShoppingCart },
  { to: '/admin/customers',  label: 'Khách hàng',     icon: Users },
  { to: '/admin/users',      label: 'Nhân viên',      icon: UserCog },
  { to: '/admin/warehouses', label: 'Kho hàng',       icon: Warehouse },
  { to: '/admin/expenses',   label: 'Phiếu chi',      icon: TrendingDown },
  { to: '/admin/incomes',    label: 'Phiếu thu',      icon: TrendingUp },
  { to: '/admin/sale-kpi',   label: 'KPI Sale',       icon: Receipt },
  { to: '/admin/analytics',  label: 'Phân tích',      icon: BarChart2 },
  { to: '/admin/production', label: 'Sản xuất',       icon: Factory },
];

export const ownerNav = [
  { to: '/owner/dashboard',   label: 'Dashboard',      icon: LayoutDashboard },
  { to: '/owner/orders',      label: 'Đơn hàng',       icon: ShoppingCart },
  { to: '/owner/customers',   label: 'Khách hàng',     icon: Users },
  { to: '/owner/users',       label: 'Nhân viên',      icon: UserCog },
  { to: '/owner/employees',   label: 'Nhân sự / Lương',icon: UserCheck },
  { to: '/owner/warehouses',  label: 'Kho hàng',       icon: Warehouse },
  { to: '/owner/expenses',    label: 'Phiếu chi',      icon: TrendingDown },
  { to: '/owner/incomes',     label: 'Phiếu thu',      icon: TrendingUp },
  { to: '/owner/sale-kpi',    label: 'KPI Sale',       icon: Receipt },
  { to: '/owner/analytics',   label: 'Phân tích',      icon: BarChart2 },
  { to: '/owner/production',  label: 'Sản xuất',       icon: Factory },
];

export const hrNav = [
  { to: '/hr/manage',   label: 'Quản lý nhân sự', icon: UserCog },
  { to: '/hr/salaries', label: 'Phiếu lương',     icon: Receipt },
];

export const sellerNav = [
  { to: '/seller/pos',       label: 'Bán hàng',    icon: ShoppingCart },
  { to: '/seller/orders',    label: 'Đơn hàng',    icon: ClipboardList },
  { to: '/seller/drafts',    label: 'Đơn nháp',    icon: FileText },
  { to: '/seller/customers', label: 'Khách hàng',  icon: Users },
];

export const warehouseNav = [
  { to: '/warehouse/management', label: 'Quản lý kho',  icon: Warehouse },
  { to: '/warehouse/operations', label: 'Nhập/Xuất',    icon: Package },
  { to: '/warehouse/history',    label: 'Lịch sử',      icon: ClipboardList },
  { to: '/warehouse/orders',     label: 'Đơn hàng',     icon: ShoppingCart },
  { to: '/warehouse/expenses',   label: 'Phiếu chi',    icon: TrendingDown },
];

export const superWarehouseNav = [
  { to: '/super-warehouse/management', label: 'Quản lý kho', icon: Warehouse },
  { to: '/super-warehouse/operations', label: 'Nhập/Xuất',   icon: Package },
  { to: '/super-warehouse/history',    label: 'Lịch sử',     icon: ClipboardList },
  { to: '/super-warehouse/orders',     label: 'Đơn hàng',    icon: ShoppingCart },
  { to: '/super-warehouse/expenses',   label: 'Phiếu chi',   icon: TrendingDown },
];

export const accountantNav = [
  { to: '/accountant/dashboard', label: 'Dashboard',    icon: LayoutDashboard },
  { to: '/accountant/orders',    label: 'Đơn hàng',     icon: ShoppingCart },
  { to: '/accountant/customers', label: 'Khách hàng',   icon: Users },
  { to: '/accountant/suppliers', label: 'Nhà cung cấp', icon: Package },
  { to: '/accountant/incomes',   label: 'Phiếu thu',    icon: TrendingUp },
];

export const superAccountantNav = [
  { to: '/super-accountant/dashboard',          label: 'Dashboard',       icon: LayoutDashboard },
  { to: '/super-accountant/history',            label: 'Đơn hàng',        icon: ShoppingCart },
  { to: '/super-accountant/expenses',           label: 'Phiếu chi',       icon: TrendingDown },
  { to: '/super-accountant/incomes',            label: 'Phiếu thu',       icon: TrendingUp },
  { to: '/super-accountant/suppliers',          label: 'Nhà cung cấp',    icon: Package },
  { to: '/super-accountant/warehouse-receipts', label: 'Phiếu nhập kho',  icon: FileText },
];

export const operatorNav = [
  { to: '/operator/categories',  label: 'Danh mục',    icon: Tags },
  { to: '/operator/ingredients', label: 'Nguyên liệu', icon: FlaskConical },
  { to: '/operator/products',    label: 'Sản phẩm',    icon: Package },
  { to: '/operator/batches',     label: 'Lô hàng',     icon: Layers },
  { to: '/operator/landingpage', label: 'Landing page', icon: Globe },
];

export const factoryWorkerNav = [
  { to: '/factory/dashboard', label: 'Dashboard',  icon: LayoutDashboard },
  { to: '/factory/batches',   label: 'Nhập mẻ SX', icon: ClipboardList },
  { to: '/factory/history',   label: 'Lịch sử mẻ', icon: Package },
];

// Default path cho từng role (dùng trong PrivateRoute + RootRedirect)
export const ROLE_DEFAULT_PATH = {
  ADMIN:            '/admin/dashboard',
  OWNER:            '/owner/dashboard',
  WAREHOUSE:        '/warehouse/management',
  SUPER_WAREHOUSE:  '/super-warehouse/management',
  ACCOUNTANT:       '/accountant/dashboard',
  SUPER_ACCOUNTANT: '/super-accountant/dashboard',
  OPERATOR:         '/operator/categories',
  SHIPPER:          '/shipper/dashboard',
  FACTORY_WORKER:   '/factory/dashboard',
  SELLER:           '/seller/pos',
  SUPER_SELLER:     '/seller/pos',
  HR:               '/hr/manage',
};