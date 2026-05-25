// src/pages/auth/LoginPage.jsx
import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/common/Toast';
import { Eye, EyeOff, LogIn, ChevronRight } from 'lucide-react';
import SplashScreen from '../../components/common/SplashScreen';

const ROLE_LABELS = {
  ADMIN:            { label: 'Quản trị viên',      color: 'bg-red-100 text-red-700 border-red-200' },
  OWNER:            { label: 'Chủ sở hữu',         color: 'bg-purple-100 text-purple-700 border-purple-200' },
  ACCOUNTANT:       { label: 'Kế toán',             color: 'bg-blue-100 text-blue-700 border-blue-200' },
  SUPER_ACCOUNTANT: { label: 'Trưởng kế toán',      color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  WAREHOUSE:        { label: 'Kho hàng',            color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  SUPER_WAREHOUSE:  { label: 'Trưởng kho',          color: 'bg-orange-100 text-orange-700 border-orange-200' },
  SELLER:           { label: 'Bán hàng',            color: 'bg-green-100 text-green-700 border-green-200' },
  SUPER_SELLER:     { label: 'Trưởng bán hàng',     color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  OPERATOR:         { label: 'Vận hành',            color: 'bg-teal-100 text-teal-700 border-teal-200' },
  SHIPPER:          { label: 'Giao hàng',           color: 'bg-sky-100 text-sky-700 border-sky-200' },
  FACTORY_WORKER:   { label: 'Nhân viên nhà máy',     color: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
};

function getRedirectPath(role) {
  switch (role) {
    case 'ADMIN':             return '/admin/dashboard';
    case 'OWNER':             return '/owner/dashboard';
    case 'WAREHOUSE':         return '/warehouse/management';
    case 'SUPER_WAREHOUSE':   return '/super-warehouse/management';
    case 'ACCOUNTANT':        return '/accountant/dashboard';
    case 'SUPER_ACCOUNTANT':  return '/super-accountant/dashboard';
    case 'OPERATOR':          return '/operator/categories';
    case 'SHIPPER':           return '/shipper/dashboard';
    default:                  return '/seller/pos';
  }
}

export default function LoginPage() {
  const { login, isAuthenticated, role } = useAuth();
  const toast    = useToast();
  const navigate = useNavigate();

  const [form, setForm]         = useState({ username: '', password: '' });
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [splash, setSplash]     = useState(null); // { user, redirectPath }
  // Multi-role state
  const [availableRoles, setAvailableRoles] = useState(null);
  const [pendingCreds, setPendingCreds]     = useState(null);
  const [selectingRole, setSelectingRole]   = useState(false);

  if (splash) {
    return (
      <SplashScreen onDone={() => navigate(splash.redirectPath)} />
    );
  }

  if (isAuthenticated) {
    return <Navigate to={getRedirectPath(role)} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.username.trim() || !form.password.trim()) {
      toast('Vui lòng nhập đầy đủ thông tin', 'warning');
      return;
    }
    setLoading(true);
    try {
      const data = await login(form.username.trim(), form.password, null);
      if (data.requireRoleSelection && data.availableRoles?.length > 1) {
        setAvailableRoles(data.availableRoles);
        setPendingCreds({ username: form.username.trim(), password: form.password });
      } else {
        setSplash({ user: data, redirectPath: getRedirectPath(data.role) });
      }
    } catch (err) {
      const msg = err?.response?.data?.message || 'Sai tên đăng nhập hoặc mật khẩu';
      toast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRole = async (selectedRole) => {
    if (!pendingCreds) return;
    setSelectingRole(true);
    try {
      const data = await login(pendingCreds.username, pendingCreds.password, selectedRole);
      setAvailableRoles(null);
      setPendingCreds(null);
      setSplash({ user: data, redirectPath: getRedirectPath(data.role) });
    } catch (err) {
      const msg = err?.response?.data?.message || 'Lỗi đăng nhập';
      toast(msg, 'error');
    } finally {
      setSelectingRole(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* ── Left panel ────────────────────────────────── */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 bg-[#1C1C1E] p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-[#C9A84C] blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-[#A07830] blur-2xl translate-y-1/2 -translate-x-1/2" />
        </div>
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#C9A84C]/40 bg-[#C9A84C]/10 mb-8">
            <span className="text-[#C9A84C] text-xs tracking-widest uppercase font-semibold">Hệ thống quản lý</span>
          </div>
          <h1 className="text-white text-5xl font-bold leading-tight">
            Nhất Nam<br />
            <span className="text-[#C9A84C]">Fine Foods</span>
          </h1>
          <p className="text-[#8E8878] text-base mt-4 leading-relaxed">
            Nền tảng quản lý bán hàng chuyên nghiệp — thực đơn, đơn hàng, kho hàng trong tầm tay.
          </p>
        </div>
        <div className="relative z-10 grid grid-cols-3 gap-6 opacity-40">
          {['🍜', '🥩', '🦐', '🍚', '🥗', '🍵'].map((e, i) => (
            <div key={i} className="text-6xl text-center">{e}</div>
          ))}
        </div>
        <p className="relative z-10 text-[#8E8878] text-xs">
          © 2025 Nhất Nam Fine Foods. All rights reserved.
        </p>
      </div>

      {/* ── Right panel ───────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center bg-[#FAF7F2] px-6">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-[#1C1C1E]">Đăng nhập</h2>
            <p className="text-[#8E8878] mt-2">Chào mừng trở lại!</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-[#1C1C1E] mb-1.5">Tên đăng nhập</label>
              <input
                type="text"
                autoComplete="username"
                value={form.username}
                onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl border border-black/10 bg-white text-[#1C1C1E] placeholder:text-[#8E8878] focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/40"
                placeholder="Nhập tên đăng nhập"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#1C1C1E] mb-1.5">Mật khẩu</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-black/10 bg-white text-[#1C1C1E] placeholder:text-[#8E8878] focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/40 pr-12"
                  placeholder="Nhập mật khẩu"
                />
                <button type="button" onClick={() => setShowPw(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8E8878] hover:text-[#1C1C1E]">
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#C9A84C] text-white font-semibold hover:bg-[#B8923E] transition disabled:opacity-50"
            >
              {loading ? <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <LogIn size={18} />}
              {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>
          </form>
        </div>
      </div>

      {/* ── Multi-role popup ──────────────────────────── */}
      {availableRoles && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-xl font-bold text-[#1C1C1E] mb-1">Chọn vai trò đăng nhập</h3>
            <p className="text-sm text-[#8E8878] mb-5">
              Tài khoản của bạn có {availableRoles.length} vai trò. Hãy chọn vai trò bạn muốn sử dụng trong phiên này.
            </p>

            <div className="space-y-3">
              {availableRoles.map(r => {
                const info = ROLE_LABELS[r] || { label: r, color: 'bg-gray-100 text-gray-700 border-gray-200' };
                return (
                  <button
                    key={r}
                    onClick={() => handleSelectRole(r)}
                    disabled={selectingRole}
                    className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl border-2 hover:shadow-md transition font-medium ${info.color} disabled:opacity-50`}
                  >
                    <span>{info.label}</span>
                    <ChevronRight size={18} />
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => { setAvailableRoles(null); setPendingCreds(null); }}
              className="mt-4 w-full py-2.5 rounded-xl border border-black/10 text-[#8E8878] hover:bg-gray-50 text-sm"
            >
              Huỷ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}