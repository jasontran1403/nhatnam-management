/**
 * AppLayout — layout dùng chung cho tất cả roles.
 * Truyền vào `navItems` để mỗi role có menu riêng.
 */
import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LogOut, Menu, X, ChevronRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLang } from '../../context/LangContext';
import NotificationBell from '../common/NotificationBell';
import ProfileButton from '../common/ProfileButton';
import LangToggle from '../common/LangToggle';

export default function AppLayout({ navItems = [], groups = null }) {
  const { user, token, logout } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const close = () => setOpen(false);
  const handleLogout = () => { logout(); navigate('/login'); };

  const menuGroups = groups || [{ label: 'Menu', items: navItems }];

  // Tất cả path trong menu — dùng để phát hiện path cha (prefix) của path con.
  // Ví dụ: '/owner/production' là prefix của '/owner/production/suppliers',
  // nên NavLink '/owner/production' phải match chính xác (end) để không active
  // khi đang ở trang con.
  const allPaths = menuGroups.flatMap(g => g.items.map(i => i.to));
  const isPrefixOfAnother = (to) =>
    allPaths.some(p => p !== to && p.startsWith(to.endsWith('/') ? to : to + '/'));

  return (
    <div className="flex h-screen overflow-hidden bg-[#FAF7F2]">
      {/* Overlay mobile */}
      {open && (
        <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden" onClick={close} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:relative inset-y-0 left-0 z-50 w-60 bg-[#1C1C1E] flex flex-col
        transform transition-transform duration-300 ease-in-out
        ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
      `}>
        {/* Logo */}
        <div className="px-6 py-5 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-white font-bold text-lg leading-tight" style={{ fontFamily: 'var(--font-display)' }}>
                Nhất Nam
              </h1>
              <p className="text-[#C9A84C] text-[10px] tracking-widest uppercase mt-0.5">Fine Foods</p>
            </div>
            <button className="lg:hidden text-white/40 hover:text-white p-1" onClick={close}>
              <X size={17} />
            </button>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-4">
          {menuGroups.map(group => (
            <div key={group.label}>
              <p className="text-[#8E8878]/60 text-[10px] uppercase tracking-widest px-3 mb-1">{group.label}</p>
              {group.items.map(({ to, label, icon: Icon }) => (
                <NavLink key={to} to={to} onClick={close} end={isPrefixOfAnother(to)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-xl mb-0.5 transition-all duration-150
                    ${isActive
                      ? 'bg-[#C9A84C]/20 text-[#C9A84C]'
                      : 'text-[#8E8878] hover:text-white hover:bg-white/5'}`
                  }>
                  {({ isActive }) => (
                    <>
                      <Icon size={16} className="flex-shrink-0" />
                      <span className="text-sm font-medium flex-1 truncate">{label}</span>
                      {isActive && <ChevronRight size={13} className="flex-shrink-0 opacity-60" />}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* User + logout + lang toggle */}
        <div className="px-3 py-3 border-t border-white/10 flex-shrink-0">
          <button onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl w-full text-[#8E8878] hover:text-red-400 hover:bg-red-500/10 transition-all">
            <LogOut size={16} />
            <span className="text-sm font-medium">{t('profile', 'logout')}</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Mobile topbar */}
        <header className="lg:hidden bg-[#1C1C1E] px-4 py-3 flex items-center gap-3 flex-shrink-0">
          <button onClick={() => setOpen(true)} className="text-white p-1">
            <Menu size={20} />
          </button>
          <span className="text-white text-sm font-bold flex-1" style={{ fontFamily: 'var(--font-display)' }}>
            Nhất Nam Fine Foods
          </span>
          <ProfileButton compact />
          <NotificationBell role={user?.role} token={token} compact />
        </header>

        {/* Desktop topbar */}
        <div className="hidden lg:flex items-center justify-end px-6 py-2 border-b border-[#F0EBE3] bg-white flex-shrink-0 gap-1">
          <LangToggle variant="ghost" />
          <div className="w-px h-5 bg-black/10 mx-1" />
          <ProfileButton />
          <div className="w-px h-5 bg-black/10 mx-1" />
          <NotificationBell role={user?.role} token={token} />
        </div>

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
