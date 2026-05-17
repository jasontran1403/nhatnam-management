import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/common/Toast';
import { Eye, EyeOff, LogIn } from 'lucide-react';

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

  // ── Tất cả hooks phải gọi TRƯỚC mọi early return ─────────────────────────
  const [form, setForm]     = useState({ username: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  // Early return SAU hooks
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
      const data = await login(form.username.trim(), form.password);
      navigate(getRedirectPath(data.role));
    } catch (err) {
      const msg = err?.response?.data?.message || 'Sai tên đăng nhập hoặc mật khẩu';
      toast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex flex-col justify-between w-1/2 bg-[#1C1C1E] p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-[#C9A84C] blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-[#A07830] blur-2xl translate-y-1/2 -translate-x-1/2" />
        </div>
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#C9A84C]/40 bg-[#C9A84C]/10 mb-8">
            <span className="text-[#C9A84C] text-xs tracking-widest uppercase font-semibold">Hệ thống quản lý</span>
          </div>
          <h1 className="text-white text-5xl font-bold leading-tight" style={{ fontFamily: 'var(--font-display)' }}>
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

      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 bg-[#FAF7F2]">
        <div className="w-full max-w-sm animate-fadeIn">
          <div className="lg:hidden text-center mb-8">
            <h1 className="text-3xl font-bold text-[#1C1C1E]" style={{ fontFamily: 'var(--font-display)' }}>
              Nhất Nam
            </h1>
            <p className="text-[#C9A84C] text-xs tracking-widest uppercase">Fine Foods</p>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-[#1C1C1E]" style={{ fontFamily: 'var(--font-display)' }}>
              Đăng nhập
            </h2>
            <p className="text-[#8E8878] text-sm mt-1">Nhập thông tin để tiếp tục</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1 group">
              <label className="text-xs font-semibold text-[#8E8878] uppercase tracking-wider transition-colors group-focus-within:text-[#C9A84C]">
                Tên đăng nhập
              </label>
              <input
                type="text" autoFocus placeholder="username"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                className="input-elegant w-full rounded-xl px-4 py-3 text-sm text-[#1C1C1E] placeholder:text-[#C4B9A8]"
              />
            </div>

            <div className="flex flex-col gap-1 group">
              <label className="text-xs font-semibold text-[#8E8878] uppercase tracking-wider transition-colors group-focus-within:text-[#C9A84C]">
                Mật khẩu
              </label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="input-elegant w-full rounded-xl px-4 py-3 pr-11 text-sm text-[#1C1C1E] placeholder:text-[#C4B9A8]"
                />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8E8878] hover:text-[#1C1C1E] transition-colors">
                  {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="btn-gold w-full rounded-xl py-3 mt-2 flex items-center justify-center gap-2 text-sm font-semibold">
              {loading
                ? <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                : <LogIn size={16} />}
              {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}