import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLang } from '../../context/LangContext';
import NotificationBell from '../common/NotificationBell';
import {
  ShoppingCart, ClipboardList,
  LogOut, Menu, X, ChevronRight,
} from 'lucide-react';
import ProfileButton from '../common/ProfileButton';
import BrandLogo from '../common/BrandLogo';
import ThemeToggle, { ThemeToggleOnChrome } from '../common/ThemeToggle';

export default function SellerLayout() {
  const { user, token, logout } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navItems = [
    { to: '/seller/pos', label: t('nav', 'pos'), icon: ShoppingCart },
    { to: '/seller/orders', label: t('nav', 'orders'), icon: ClipboardList },
  ];

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`fixed lg:relative inset-y-0 left-0 z-50 w-60 bg-chrome flex flex-col
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        <div className="px-6 py-6 border-b border-white/10">
          <div className="flex items-center justify-between">
            <BrandLogo size="md" />
            <button className="lg:hidden text-white/50 hover:text-white" onClick={() => setSidebarOpen(false)}>
              <X size={18} />
            </button>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <p className="text-muted text-xs uppercase tracking-wider px-3 mb-2">Menu</p>
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1 transition-all duration-200
                ${isActive ? 'bg-gold/20 text-gold' : 'text-muted hover:text-white hover:bg-white/5'}`}>
              {({ isActive }) => (
                <>
                  <Icon size={17} />
                  <span className="text-sm font-medium">{label}</span>
                  {isActive && <ChevronRight size={14} className="ml-auto" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-white/10">
          <button onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl w-full text-muted hover:text-red-400 hover:bg-red-500/10 transition-all duration-200">
            <LogOut size={17} />
            <span className="text-sm font-medium">{t('profile', 'logout')}</span>
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="lg:hidden bg-chrome px-4 py-3 flex items-center gap-3 flex-shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="text-white p-1">
            <Menu size={22} />
          </button>
          <BrandLogo inline className="flex-1" />
          <ThemeToggleOnChrome />
        </header>

        <div className="flex items-center justify-end px-6 py-2 border-b border-line-soft bg-surface flex-shrink-0">
          <ThemeToggle variant="ghost" />
          <ProfileButton />
          <div className="w-px h-5 bg-hairline-2" />
          <NotificationBell role={user?.role} token={token} />
        </div>

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
