// src/components/super_warehouse/SuperWarehouseLayout.jsx
import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Warehouse, ClipboardList, History,
  LogOut, Menu, X, ChevronRight, Truck, Receipt, ShieldCheck,
} from 'lucide-react';
import NotificationBell from '../common/NotificationBell';
import ProfileButton from '../common/ProfileButton';

const navItems = [
  { to: '/super-warehouse/management', label: 'Quản lý kho',    icon: Warehouse },
  { to: '/super-warehouse/operations', label: 'Thao tác',       icon: ClipboardList },
  { to: '/super-warehouse/history',    label: 'Lịch sử',        icon: History },
  { to: '/super-warehouse/orders',     label: 'Đơn hàng',       icon: Truck },
  { to: '/super-warehouse/expenses',   label: 'Phiếu chi phí',  icon: Receipt },
];

export default function SuperWarehouseLayout() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="flex h-screen overflow-hidden bg-[#FAF7F2]">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`
        fixed lg:relative inset-y-0 left-0 z-50
        w-60 bg-[#1C1C1E] flex flex-col
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
      `}>
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
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#C9A84C] to-[#A07830] flex items-center justify-center flex-shrink-0">
              <ShieldCheck size={14} className="text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-white text-xs font-semibold truncate">
                {user?.fullName || user?.username || 'Super Kho'}
              </p>
              <p className="text-[#C9A84C] text-xs truncate">Trưởng kho</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <p className="text-[#8E8878] text-xs uppercase tracking-wider px-3 mb-2">Menu</p>
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => `
                flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1 transition-all duration-200
                ${isActive
                  ? 'bg-[#C9A84C]/20 text-[#C9A84C]'
                  : 'text-[#8E8878] hover:text-white hover:bg-white/5'}
              `}
            >
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
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl w-full text-[#8E8878] hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
          >
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

        <div className="flex items-center justify-end gap-2 px-4 py-2 border-b border-[#F0EBE3] bg-white flex-shrink-0">
          <ProfileButton />
          <div className="w-px h-5 bg-black/10" />
          <NotificationBell role={user?.role} token={token} />
        </div>

        {/* wh-root: thêm class này để pages trong super-warehouse dùng được CSS wh-* */}
        <main className="flex-1 overflow-auto wh-root">
          <Outlet />
        </main>
      </div>

      <style>{`
        .wh-root {
          --wh-bg: #FAF7F2;
          --wh-surface: #ffffff;
          --wh-surface2: #f3f0eb;
          --wh-border: #e8e2d8;
          --wh-accent: #C9A84C;
          --wh-accent2: #16a34a;
          --wh-warn: #ea580c;
          --wh-danger: #dc2626;
          --wh-text: #1C1C1E;
          --wh-muted: #8E8878;
          --wh-radius: 12px;
          background: var(--wh-bg);
          padding: 24px 28px;
        }
        @media (max-width: 640px) { .wh-root { padding: 14px; } }

        .wh-page-title { font-size: 20px; font-weight: 700; color: var(--wh-text); margin-bottom: 18px; }

        .wh-card { background: var(--wh-surface); border: 1px solid var(--wh-border); border-radius: var(--wh-radius); padding: 20px; }
        @media (max-width: 640px) { .wh-card { padding: 14px; } }

        .wh-tabs { display: flex; gap: 4px; margin-bottom: 18px; background: var(--wh-surface); border-radius: 10px; padding: 4px; border: 1px solid var(--wh-border); width: fit-content; flex-wrap: wrap; }
        .wh-tab { padding: 7px 14px; border-radius: 7px; border: none; cursor: pointer; font-size: 13px; font-weight: 500; background: none; color: var(--wh-muted); transition: all .15s; white-space: nowrap; }
        .wh-tab.active { background: #1C1C1E; color: #fff; }
        .wh-tab:hover:not(.active) { color: var(--wh-text); background: var(--wh-surface2); }

        .wh-table-wrap { overflow-x: auto; border-radius: 10px; border: 1px solid var(--wh-border); }
        .wh-table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
        .wh-table th { text-align: left; padding: 11px 14px; background: var(--wh-surface2); color: var(--wh-muted); font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: .4px; }
        .wh-table td { padding: 11px 14px; border-top: 1px solid var(--wh-border); color: var(--wh-text); }
        .wh-table tr:hover td { background: var(--wh-surface2); }

        .wh-form-row { display: grid; gap: 14px; margin-bottom: 14px; }
        .wh-form-row.cols-2 { grid-template-columns: 1fr 1fr; }
        .wh-form-row.cols-3 { grid-template-columns: 1fr 1fr 1fr; }
        @media (max-width: 640px) {
          .wh-form-row.cols-2, .wh-form-row.cols-3 { grid-template-columns: 1fr; }
        }

        .wh-label { display: block; font-size: 11px; font-weight: 600; color: var(--wh-muted); margin-bottom: 5px; text-transform: uppercase; letter-spacing: .4px; }
        .wh-input, .wh-select, .wh-textarea { width: 100%; padding: 9px 12px; background: var(--wh-surface2); border: 1px solid var(--wh-border); border-radius: 8px; color: var(--wh-text); font-size: 14px; outline: none; transition: border-color .15s; }
        .wh-input:focus, .wh-select:focus, .wh-textarea:focus { border-color: var(--wh-accent); box-shadow: 0 0 0 3px rgba(201,168,76,.12); }
        .wh-textarea { resize: vertical; min-height: 72px; }

        .wh-btn { padding: 9px 18px; border-radius: 8px; border: none; cursor: pointer; font-size: 13.5px; font-weight: 600; transition: all .15s; display: inline-flex; align-items: center; gap: 6px; }
        .wh-btn-primary { background: #1C1C1E; color: #fff; }
        .wh-btn-primary:hover { background: #333; }
        .wh-btn-secondary { background: var(--wh-surface2); color: var(--wh-text); border: 1px solid var(--wh-border); }
        .wh-btn-secondary:hover { border-color: var(--wh-accent); color: var(--wh-accent); }
        .wh-btn-danger { background: rgba(220,38,38,.08); color: var(--wh-danger); border: 1px solid rgba(220,38,38,.3); }
        .wh-btn-sm { padding: 5px 11px; font-size: 12px; }
        .wh-btn:disabled { opacity: .4; cursor: not-allowed; }

        .wh-badge { display: inline-flex; align-items: center; padding: 3px 9px; border-radius: 99px; font-size: 11px; font-weight: 600; }
        .badge-import   { background: rgba(22,163,74,.1);   color: #16a34a; }
        .badge-export   { background: rgba(234,88,12,.1);   color: #ea580c; }
        .badge-adjust   { background: rgba(124,58,237,.1);  color: #7c3aed; }
        .badge-transfer { background: rgba(2,132,199,.1);   color: #0284c7; }
        .badge-surplus  { background: rgba(22,163,74,.1);   color: #16a34a; }
        .badge-shortage { background: rgba(220,38,38,.1);   color: #dc2626; }
        .badge-match    { background: rgba(201,168,76,.12); color: #C9A84C; }

        .wh-img-grid { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
        .wh-img-thumb { width: 72px; height: 72px; border-radius: 8px; object-fit: cover; border: 1px solid var(--wh-border); cursor: pointer; transition: transform .15s; }
        .wh-img-thumb:hover { transform: scale(1.05); }

        .wh-ing-rows { display: flex; flex-direction: column; gap: 10px; margin-bottom: 14px; }
        .wh-ing-row { display: grid; gap: 10px; align-items: center; background: var(--wh-surface2); padding: 12px; border-radius: 10px; border: 1px solid var(--wh-border); }
        .wh-ing-row.import-grid { grid-template-columns: 2fr 1fr 1fr 1fr auto; }
        .wh-ing-row.export-grid { grid-template-columns: 2fr 1fr auto; }
        .wh-ing-row.adjust-grid { grid-template-columns: 2fr 1fr 1fr 1fr auto; }
        @media (max-width: 768px) {
          .wh-ing-row.import-grid,
          .wh-ing-row.export-grid,
          .wh-ing-row.adjust-grid { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 480px) {
          .wh-ing-row.import-grid,
          .wh-ing-row.export-grid,
          .wh-ing-row.adjust-grid { grid-template-columns: 1fr; }
        }

        .wh-stock-qty { display: inline-flex; align-items: center; gap: 4px; background: rgba(201,168,76,.12); color: var(--wh-accent); padding: 3px 10px; border-radius: 99px; font-size: 12px; font-weight: 600; }
        .wh-ing-img { width: 36px; height: 36px; border-radius: 8px; object-fit: cover; background: var(--wh-surface2); border: 1px solid var(--wh-border); flex-shrink: 0; }
        .wh-ing-info { display: flex; align-items: center; gap: 10px; }

        .wh-empty { text-align: center; padding: 48px 20px; color: var(--wh-muted); font-size: 14px; }
        .wh-empty-icon { font-size: 48px; margin-bottom: 12px; }

        .wh-alert { padding: 10px 14px; border-radius: 8px; font-size: 13.5px; margin-bottom: 14px; }
        .wh-alert-error   { background: rgba(220,38,38,.07);  color: var(--wh-danger); border: 1px solid rgba(220,38,38,.2); }
        .wh-alert-success { background: rgba(22,163,74,.07);  color: var(--wh-accent2); border: 1px solid rgba(22,163,74,.2); }

        .wh-sep { border: none; border-top: 1px solid var(--wh-border); margin: 18px 0; }

        .wh-expiry-list { display: flex; flex-wrap: wrap; gap: 4px; }
        .wh-expiry-pill { font-size: 11px; padding: 2px 8px; border-radius: 99px; background: rgba(234,88,12,.08); color: var(--wh-warn); border: 1px solid rgba(234,88,12,.2); }

        @keyframes pulse { from{opacity:.4} to{opacity:1} }
      `}</style>
    </div>
  );
}