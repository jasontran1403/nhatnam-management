import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import NotificationBell from '../common/NotificationBell';
import {
  ShoppingCart, ClipboardList,
  LogOut, Menu, X, ChevronRight,
} from 'lucide-react';

const navItems = [
  { to: '/seller/pos',    label: 'Bán Hàng', icon: ShoppingCart },
  { to: '/seller/orders', label: 'Đơn Hàng', icon: ClipboardList },
];

export default function SellerLayout() {
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

        <div className="px-4 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#C9A84C] to-[#A07830] flex items-center justify-center">
              <span className="text-white text-xs font-bold">
                {user?.fullName?.[0] || user?.username?.[0] || 'S'}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-white text-xs font-semibold truncate">{user?.fullName || user?.username || 'Seller'}</p>
              <p className="text-[#8E8878] text-xs truncate">Nhân viên bán hàng</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <p className="text-[#8E8878] text-xs uppercase tracking-wider px-3 mb-2">Menu</p>
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1 transition-all duration-200
                ${isActive ? 'bg-[#C9A84C]/20 text-[#C9A84C]' : 'text-[#8E8878] hover:text-white hover:bg-white/5'}`}>
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
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl w-full text-[#8E8878] hover:text-red-400 hover:bg-red-500/10 transition-all duration-200">
            <LogOut size={17} />
            <span className="text-sm font-medium">Đăng xuất</span>
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header — không có NotificationBell */}
        <header className="lg:hidden bg-[#1C1C1E] px-4 py-3 flex items-center gap-3 flex-shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="text-white p-1">
            <Menu size={22} />
          </button>
          <div className="flex-1">
            <h1 className="text-white text-sm font-bold" style={{ fontFamily: 'var(--font-display)' }}>
              Nhất Nam Fine Foods
            </h1>
          </div>
        </header>

        {/* Topbar duy nhất — 1 NotificationBell instance */}
        <div className="flex items-center justify-end px-6 py-2 border-b border-[#F0EBE3] bg-white flex-shrink-0">
          <NotificationBell role={user?.role} token={token} />
        </div>

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
