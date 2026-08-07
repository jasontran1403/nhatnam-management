// src/components/warehouse/WarehouseLayout.jsx
import { useLang } from '../../context/LangContext';
import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { WarehouseProvider } from '../../context/WarehouseContext';
import NotificationBell from '../common/NotificationBell';
import WarehouseSelector from './WarehouseSelector';
import {
  Warehouse, ClipboardList, History,
  LogOut, Menu, X, ChevronRight, Truck
} from 'lucide-react';
import ProfileButton from '../common/ProfileButton';
import BrandLogo from '../common/BrandLogo';
import ThemeToggle from '../common/ThemeToggle';

const navItems = [
  { to: '/warehouse/management', labelKey: 'warehouse_management', icon: Warehouse },
  { to: '/warehouse/operations', labelKey: 'import_export', icon: ClipboardList },
  { to: '/warehouse/history', labelKey: 'history', icon: History },
  { to: '/warehouse/orders', labelKey: 'orders', icon: Truck },
];

export default function WarehouseLayout() {
  const { t } = useLang();
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <WarehouseProvider>
    <div className="flex h-screen overflow-hidden bg-canvas">

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:relative inset-y-0 left-0 z-50
        w-60 bg-chrome flex flex-col
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
      `}>

        {/* Logo */}
        <div className="px-6 py-6 border-b border-white/10">
          <div className="flex items-center justify-between">
            <BrandLogo size="md" />
            <button className="lg:hidden text-white/50 hover:text-white" onClick={() => setSidebarOpen(false)}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <p className="text-muted text-xs uppercase tracking-wider px-3 mb-2">Menu</p>
          {navItems.map(({ to, labelKey, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => `
                flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1 transition-all duration-200
                ${isActive
                  ? 'bg-gold/20 text-gold'
                  : 'text-muted hover:text-white hover:bg-white/5'
                }
              `}
            >
              {({ isActive }) => (
                <>
                  <Icon size={17} />
                  <span className="text-sm font-medium">{t('nav', labelKey)}</span>
                  {isActive && <ChevronRight size={14} className="ml-auto" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className="px-3 py-4 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl w-full text-muted hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
          >
            <LogOut size={17} />
            <span className="text-sm font-medium">{t('profile', 'logout')}</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Mobile topbar */}
        <header className="lg:hidden bg-chrome px-4 py-3 flex items-center gap-3 flex-shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="text-white p-1">
            <Menu size={22} />
          </button>
          <BrandLogo inline className="flex-1" />
        </header>

        <div className="flex items-center justify-end px-6 py-2 border-b border-line-soft bg-surface flex-shrink-0">
          <WarehouseSelector />
          <div className="w-px h-5 bg-hairline-2 mx-2" />
          <ThemeToggle variant="ghost" />
          <ProfileButton />
          <div className="w-px h-5 bg-hairline-2" />
          <NotificationBell role={user?.role} token={token} />
        </div>

        <main className="flex-1 overflow-auto wh-root">
          <Outlet />
        </main>
      </div>

      {/* CSS của module Kho (.wh-*) đã chuyển sang src/styles/warehouse.css
          — giữ ở đây thì nó hardcode màu và không theo được dark mode. */}
    </div>
    </WarehouseProvider>
  );
}