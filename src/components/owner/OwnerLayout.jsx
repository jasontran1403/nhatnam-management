// src/components/owner/OwnerLayout.jsx
import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard, ShoppingCart, Users, UserCog,
  Warehouse, Package, LogOut, Menu, X, Receipt,
  Crown, FileText, BarChart2, TrendingUp,
} from 'lucide-react';
import NotificationBell from '../common/NotificationBell';
import ProfileButton from '../common/ProfileButton';

const navItems = [
  { to: '/owner/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/owner/orders', label: 'Đơn hàng', icon: ShoppingCart },
  { to: '/owner/customers', label: 'Khách hàng', icon: Users },
  { to: '/owner/users', label: 'Nhân viên', icon: UserCog },
  { to: '/owner/warehouses', label: 'Kho hàng', icon: Warehouse },
  { to: '/owner/expenses', label: 'Phiếu chi phí', icon: Receipt },
  { to: '/owner/sale-kpi', label: 'KPI Phòng Sale', icon: TrendingUp },
];

export default function OwnerLayout() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="flex h-screen overflow-hidden bg-[#FAF7F2]">
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`fixed lg:relative inset-y-0 left-0 z-50 w-60 bg-[#1C1C1E] flex flex-col
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        <div className="px-6 py-6 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-white font-bold text-lg leading-tight" style={{ fontFamily: 'var(--font-display)' }}>
                Nhất Nam
              </h1>
              <p className="text-[#C9A84C] text-xs tracking-widest uppercase">Fine Foods</p>
            </div>
            <button className="lg:hidden text-white/50 hover:text-white" onClick={() => setSidebarOpen(false)}>
              <X size={18} />
            </button>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <p className="text-[#8E8878] text-xs uppercase tracking-wider px-3 mb-2">Menu</p>
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1 transition-all duration-200
                ${isActive ? 'bg-[#C9A84C]/20 text-[#C9A84C]' : 'text-[#8E8878] hover:text-white hover:bg-white/5'}`}>
              <Icon size={17} />
              <span className="text-sm font-medium">{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-white/10">
          <button onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl w-full text-[#8E8878] hover:text-red-400 hover:bg-red-500/10 transition-all duration-200">
            <LogOut size={17} />
            <span className="text-sm font-medium">Đăng xuất</span>
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="lg:hidden bg-[#1C1C1E] px-4 py-3 flex items-center gap-3 flex-shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="text-white p-1">
            <Menu size={22} />
          </button>
          <h1 className="text-white text-sm font-bold flex-1" style={{ fontFamily: 'var(--font-display)' }}>
            Nhất Nam Fine Foods
          </h1>
        </header>

        <div className="flex items-center justify-end px-6 py-2 border-b border-[#F0EBE3] bg-white flex-shrink-0">
          <ProfileButton />
          <div className="w-px h-5 bg-black/10" />
          <NotificationBell role={user?.role} token={token} />
        </div>

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
