// src/components/warehouse/WarehouseLayout.jsx
import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const NAV = [
  { label: 'Quản lý kho', path: '/warehouse/management', icon: '🏭' },
  { label: 'Thao tác',    path: '/warehouse/operations', icon: '⚙️' },
  { label: 'Lịch sử',     path: '/warehouse/history',    icon: '📋' },
  { label: 'Đơn hàng',     path: '/warehouse/orders',    icon: '📦' },
];

export default function WarehouseLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="wh-app">
      <aside className="wh-sidebar">
        <div className="wh-logo">
          <span className="wh-logo-icon">📦</span>
          <span className="wh-logo-text">Kho Hàng</span>
        </div>

        <nav className="wh-nav">
          {NAV.map(n => (
            <NavLink
              key={n.path}
              to={n.path}
              className={({ isActive }) => `wh-nav-item${isActive ? ' active' : ''}`}
            >
              <span className="wh-nav-icon">{n.icon}</span>
              <span>{n.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="wh-sidebar-footer">
          <div className="wh-user">
            <div className="wh-user-avatar">{(user?.username || 'W')[0].toUpperCase()}</div>
            <div>
              <div className="wh-user-name">{user?.username}</div>
              <div className="wh-user-role">Kho</div>
            </div>
          </div>
          <button className="wh-logout" onClick={handleLogout} title="Đăng xuất">⏻</button>
        </div>
      </aside>

      <main className="wh-main">
        <Outlet />
      </main>

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --wh-bg: #0f1117;
          --wh-surface: #1a1d27;
          --wh-surface2: #232637;
          --wh-border: #2e3147;
          --wh-accent: #6c8aff;
          --wh-accent2: #4ade80;
          --wh-warn: #fb923c;
          --wh-danger: #f87171;
          --wh-text: #e2e4f0;
          --wh-muted: #7b7f9e;
          --wh-radius: 12px;
          font-family: 'DM Sans', 'Segoe UI', sans-serif;
        }
        body { background: var(--wh-bg); color: var(--wh-text); }
        .wh-app { display: flex; height: 100vh; overflow: hidden; background: var(--wh-bg); }

        /* Sidebar */
        .wh-sidebar {
          width: 220px; flex-shrink: 0;
          background: var(--wh-surface);
          border-right: 1px solid var(--wh-border);
          display: flex; flex-direction: column;
          padding: 24px 16px;
        }
        .wh-logo {
          display: flex; align-items: center; gap: 10px;
          padding: 0 8px 28px;
          font-size: 18px; font-weight: 700; color: var(--wh-accent);
        }
        .wh-logo-icon { font-size: 24px; }
        .wh-nav { flex: 1; display: flex; flex-direction: column; gap: 4px; }
        .wh-nav-item {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 12px; border-radius: 8px;
          color: var(--wh-muted); text-decoration: none;
          font-size: 14px; font-weight: 500;
          transition: all .15s;
        }
        .wh-nav-item:hover { background: var(--wh-surface2); color: var(--wh-text); }
        .wh-nav-item.active { background: rgba(108,138,255,.15); color: var(--wh-accent); }
        .wh-nav-icon { font-size: 16px; }
        .wh-sidebar-footer {
          display: flex; align-items: center; gap: 10px;
          padding-top: 16px; border-top: 1px solid var(--wh-border);
        }
        .wh-user { flex: 1; display: flex; align-items: center; gap: 10px; }
        .wh-user-avatar {
          width: 34px; height: 34px; border-radius: 50%;
          background: linear-gradient(135deg, var(--wh-accent), #a78bfa);
          display: flex; align-items: center; justify-content: center;
          font-weight: 700; font-size: 14px; color: #fff;
        }
        .wh-user-name { font-size: 13px; font-weight: 600; }
        .wh-user-role { font-size: 11px; color: var(--wh-muted); }
        .wh-logout {
          background: none; border: none; cursor: pointer;
          color: var(--wh-muted); font-size: 18px; padding: 4px;
          transition: color .15s;
        }
        .wh-logout:hover { color: var(--wh-danger); }

        /* Main */
        .wh-main { flex: 1; overflow-y: auto; padding: 28px 32px; }

        /* Shared page styles */
        .wh-page-title {
          font-size: 22px; font-weight: 700; color: var(--wh-text);
          margin-bottom: 20px;
        }
        .wh-card {
          background: var(--wh-surface); border: 1px solid var(--wh-border);
          border-radius: var(--wh-radius); padding: 20px;
        }
        .wh-tabs {
          display: flex; gap: 6px; margin-bottom: 20px;
          background: var(--wh-surface); border-radius: 10px;
          padding: 6px; border: 1px solid var(--wh-border);
          width: fit-content;
        }
        .wh-tab {
          padding: 8px 16px; border-radius: 7px;
          border: none; cursor: pointer; font-size: 13px; font-weight: 500;
          background: none; color: var(--wh-muted); transition: all .15s;
        }
        .wh-tab.active { background: var(--wh-accent); color: #fff; }
        .wh-tab:hover:not(.active) { color: var(--wh-text); }

        /* Table */
        .wh-table-wrap { overflow-x: auto; border-radius: 10px; border: 1px solid var(--wh-border); }
        .wh-table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
        .wh-table th {
          text-align: left; padding: 11px 14px;
          background: var(--wh-surface2); color: var(--wh-muted);
          font-weight: 600; font-size: 12px; text-transform: uppercase;
          letter-spacing: .4px;
        }
        .wh-table td { padding: 12px 14px; border-top: 1px solid var(--wh-border); }
        .wh-table tr:hover td { background: rgba(255,255,255,.02); }

        /* Form */
        .wh-form-row { display: grid; gap: 14px; margin-bottom: 14px; }
        .wh-form-row.cols-2 { grid-template-columns: 1fr 1fr; }
        .wh-form-row.cols-3 { grid-template-columns: 1fr 1fr 1fr; }
        .wh-label { display: block; font-size: 12px; font-weight: 600; color: var(--wh-muted); margin-bottom: 5px; text-transform: uppercase; letter-spacing: .4px; }
        .wh-input, .wh-select, .wh-textarea {
          width: 100%; padding: 9px 12px;
          background: var(--wh-surface2); border: 1px solid var(--wh-border);
          border-radius: 8px; color: var(--wh-text); font-size: 14px;
          outline: none; transition: border-color .15s;
        }
        .wh-input:focus, .wh-select:focus, .wh-textarea:focus {
          border-color: var(--wh-accent);
        }
        .wh-select option { background: var(--wh-surface2); }
        .wh-textarea { resize: vertical; min-height: 72px; }

        /* Buttons */
        .wh-btn {
          padding: 9px 18px; border-radius: 8px; border: none;
          cursor: pointer; font-size: 13.5px; font-weight: 600;
          transition: all .15s; display: inline-flex; align-items: center; gap: 6px;
        }
        .wh-btn-primary { background: var(--wh-accent); color: #fff; }
        .wh-btn-primary:hover { filter: brightness(1.1); }
        .wh-btn-secondary { background: var(--wh-surface2); color: var(--wh-text); border: 1px solid var(--wh-border); }
        .wh-btn-secondary:hover { border-color: var(--wh-accent); color: var(--wh-accent); }
        .wh-btn-danger { background: rgba(248,113,113,.1); color: var(--wh-danger); border: 1px solid var(--wh-danger); }
        .wh-btn-sm { padding: 5px 11px; font-size: 12px; }
        .wh-btn:disabled { opacity: .45; cursor: not-allowed; }

        /* Badge */
        .wh-badge {
          display: inline-flex; align-items: center;
          padding: 3px 9px; border-radius: 99px;
          font-size: 11px; font-weight: 600;
        }
        .badge-import  { background: rgba(74,222,128,.12); color: var(--wh-accent2); }
        .badge-export  { background: rgba(251,146,60,.12); color: var(--wh-warn); }
        .badge-adjust  { background: rgba(167,139,250,.12); color: #a78bfa; }
        .badge-transfer{ background: rgba(56,189,248,.12);  color: #38bdf8; }
        .badge-surplus  { background: rgba(74,222,128,.12);  color: var(--wh-accent2); }
        .badge-shortage { background: rgba(248,113,113,.12); color: var(--wh-danger); }
        .badge-match    { background: rgba(108,138,255,.12); color: var(--wh-accent); }

        /* Image grid */
        .wh-img-grid { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
        .wh-img-thumb {
          width: 72px; height: 72px; border-radius: 8px;
          object-fit: cover; border: 1px solid var(--wh-border);
          cursor: pointer; transition: transform .15s;
        }
        .wh-img-thumb:hover { transform: scale(1.05); }

        /* Ingredient row in form */
        .wh-ing-rows { display: flex; flex-direction: column; gap: 10px; margin-bottom: 14px; }
        .wh-ing-row {
          display: grid; gap: 10px; align-items: center;
          background: var(--wh-surface2); padding: 12px; border-radius: 10px;
          border: 1px solid var(--wh-border);
        }
        .wh-ing-row.import-grid { grid-template-columns: 2fr 1fr 1fr auto; }
        .wh-ing-row.export-grid { grid-template-columns: 2fr 1fr auto; }
        .wh-ing-row.adjust-grid { grid-template-columns: 2fr 1fr 1fr 1fr auto; }

        /* Stock quantity pill */
        .wh-stock-qty {
          display: inline-flex; align-items: center; gap: 4px;
          background: rgba(108,138,255,.1); color: var(--wh-accent);
          padding: 3px 10px; border-radius: 99px; font-size: 13px; font-weight: 600;
        }

        /* Ingredient img */
        .wh-ing-img {
          width: 36px; height: 36px; border-radius: 8px; object-fit: cover;
          background: var(--wh-surface2); border: 1px solid var(--wh-border);
        }
        .wh-ing-info { display: flex; align-items: center; gap: 10px; }

        /* Empty state */
        .wh-empty {
          text-align: center; padding: 48px 20px;
          color: var(--wh-muted); font-size: 14px;
        }
        .wh-empty-icon { font-size: 48px; margin-bottom: 12px; }

        /* Alert */
        .wh-alert {
          padding: 10px 14px; border-radius: 8px; font-size: 13.5px;
          margin-bottom: 14px;
        }
        .wh-alert-error { background: rgba(248,113,113,.1); color: var(--wh-danger); border: 1px solid rgba(248,113,113,.3); }
        .wh-alert-success { background: rgba(74,222,128,.1); color: var(--wh-accent2); border: 1px solid rgba(74,222,128,.3); }

        /* Scrollbar */
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: var(--wh-border); border-radius: 99px; }

        /* Separator */
        .wh-sep { border: none; border-top: 1px solid var(--wh-border); margin: 20px 0; }

        /* Expiry pills */
        .wh-expiry-list { display: flex; flex-wrap: wrap; gap: 4px; }
        .wh-expiry-pill {
          font-size: 11px; padding: 2px 8px; border-radius: 99px;
          background: rgba(251,146,60,.1); color: var(--wh-warn);
          border: 1px solid rgba(251,146,60,.2);
        }
      `}</style>
    </div>
  );
}