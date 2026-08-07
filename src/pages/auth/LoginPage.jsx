// src/pages/auth/LoginPage.jsx
import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/common/Toast';
import { useLang } from '../../context/LangContext';
import { Eye, EyeOff, LogIn, ChevronRight } from 'lucide-react';
import SplashScreen from '../../components/common/SplashScreen';
import LangToggle from '../../components/common/LangToggle';
import { BRAND } from '../../config/brand';

function getRoleLabel(role, t) {
  const colorMap = {
    ADMIN:            'bg-red-100 dark:bg-red-500/18 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/28',
    OWNER:            'bg-purple-100 dark:bg-purple-500/18 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-500/28',
    ACCOUNTANT:       'bg-blue-100 dark:bg-blue-500/18 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/28',
    SUPER_ACCOUNTANT: 'bg-indigo-100 dark:bg-indigo-500/18 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/28',
    WAREHOUSE:        'bg-yellow-100 dark:bg-yellow-500/18 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-500/28',
    SUPER_WAREHOUSE:  'bg-orange-100 dark:bg-orange-500/18 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-500/28',
    SELLER:           'bg-green-100 dark:bg-green-500/18 text-green-700 dark:text-green-300 border-green-200 dark:border-green-500/28',
    SUPER_SELLER:     'bg-emerald-100 dark:bg-emerald-500/18 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/28',
    OPERATOR:         'bg-teal-100 dark:bg-teal-500/18 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-500/28',
    SHIPPER:          'bg-sky-100 dark:bg-sky-500/18 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-500/28',
    FACTORY_WORKER:   'bg-cyan-100 dark:bg-cyan-500/18 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-500/28',
    SUPER_FACTORY_WORKER: 'bg-cyan-200 dark:bg-cyan-500/28 text-cyan-800 dark:text-cyan-300 border-cyan-300 dark:border-cyan-500/35',
    FACTORY_ACCOUNTANT: 'bg-teal-100 dark:bg-teal-500/18 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-500/28',
    HR:               'bg-pink-100 dark:bg-pink-500/18 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-500/28',
  };
  return {
    label: t('roles', role.toLowerCase()) || role,
    color: colorMap[role] || 'bg-surface-2 text-ink-2 border-line',
  };
}

function getRedirectPath(role) {
  switch (role) {
    case 'ADMIN':            return '/admin/dashboard';
    case 'OWNER':            return '/owner/dashboard';
    case 'WAREHOUSE':        return '/warehouse/management';
    case 'SUPER_WAREHOUSE':  return '/super-warehouse/management';
    case 'ACCOUNTANT':       return '/accountant/dashboard';
    case 'SUPER_ACCOUNTANT': return '/super-accountant/dashboard';
    case 'OPERATOR':         return '/operator/products';
    case 'SHIPPER':          return '/shipper/dashboard';
    case 'FACTORY_WORKER':   return '/factory/orders';
    case 'SUPER_FACTORY_WORKER': return '/super-factory/production';
    case 'FACTORY_ACCOUNTANT': return '/factory-accountant/transfers';
    case 'HR':               return '/hr/manage';
    default:                 return '/seller/dashboard';
  }
}

export default function LoginPage() {
  const { login, isAuthenticated, role } = useAuth();
  const toast    = useToast();
  const navigate = useNavigate();
  const { t }    = useLang();

  const [form, setForm]       = useState({ username: '', password: '' });
  const [showPw, setShowPw]   = useState(false);
  const [loading, setLoading] = useState(false);

  // ── Splash: render alongside (not instead of) the page to avoid unmount race
  const [showSplash, setShowSplash]       = useState(false);
  const [splashTarget, setSplashTarget]   = useState(null);

  // Multi-role
  const [availableRoles, setAvailableRoles] = useState(null);
  const [pendingCreds, setPendingCreds]     = useState(null);
  const [selectingRole, setSelectingRole]   = useState(false);

  // Already logged in → redirect immediately (no splash needed)
  if (isAuthenticated && !showSplash) {
    return <Navigate to={getRedirectPath(role)} replace />;
  }

  const triggerSplash = (redirectPath) => {
    setSplashTarget(redirectPath);
    setShowSplash(true);
    // onDone will call navigate; splash unmounts itself via portal
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.username.trim() || !form.password.trim()) {
      toast(t('auth', 'fill_all_fields'), 'warning');
      return;
    }
    setLoading(true);
    try {
      const data = await login(form.username.trim(), form.password, null);
      if (data.requireRoleSelection && data.availableRoles?.length > 1) {
        setAvailableRoles(data.availableRoles);
        setPendingCreds({ username: form.username.trim(), password: form.password });
      } else {
        triggerSplash(getRedirectPath(data.role));
      }
    } catch (err) {
      const msg = err?.response?.data?.message || t('auth', 'wrong_credentials');
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
      triggerSplash(getRedirectPath(data.role));
    } catch (err) {
      const msg = err?.response?.data?.message || t('auth', 'login_error');
      toast(msg, 'error');
    } finally {
      setSelectingRole(false);
    }
  };

  return (
    <>
      {/* Splash renders into document.body via portal — no unmount race */}
      {showSplash && splashTarget && (
        <SplashScreen onDone={() => navigate(splashTarget, { replace: true })} />
      )}

      <div className="min-h-screen flex">
        {/* ── Left panel ─────────────────────────────── */}
        <div className="hidden lg:flex flex-col justify-between w-1/2 bg-chrome p-12 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-gold blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-gold-deep blur-2xl translate-y-1/2 -translate-x-1/2" />
          </div>
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-gold/40 bg-gold/10 mb-8">
              <span className="text-gold text-xs tracking-widest uppercase font-semibold">
                {'Hệ thống quản lý'}
              </span>
            </div>
            <h1 className="text-white text-5xl font-bold leading-tight"
              style={{ fontFamily: 'var(--font-display)' }}>
              {BRAND.name}<br />
              <span className="text-gold">{BRAND.suffix}</span>
            </h1>
            <p className="text-muted text-base mt-4 leading-relaxed">
              {'Nền tảng quản lý bán hàng chuyên nghiệp — thực đơn, đơn hàng, kho hàng trong tầm tay.'}
            </p>
          </div>
          <div className="relative z-10 grid grid-cols-3 gap-6 opacity-40">
            {['🍜', '🥩', '🦐', '🍚', '🥗', '🍵'].map((e, i) => (
              <div key={i} className="text-6xl text-center">{e}</div>
            ))}
          </div>
          <p className="relative z-10 text-muted text-xs">
            {BRAND.copyright}
          </p>
        </div>

        {/* ── Right panel ────────────────────────────── */}
        <div className="flex-1 flex items-center justify-center bg-canvas px-6">
          <div className="w-full max-w-md">
            {/* Lang toggle */}
            <div className="flex justify-end mb-4">
              <LangToggle variant="default" />
            </div>

            <div className="mb-8">
              <h2 className="text-3xl font-bold text-ink">{t('auth', 'login')}</h2>
              <p className="text-muted mt-2">{t('auth', 'welcome_back')}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-ink mb-1.5">
                  {'Tên đăng nhập'}
                </label>
                <input
                  type="text"
                  autoComplete="username"
                  value={form.username}
                  onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-hairline-2 bg-surface text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-gold/40"
                  placeholder={t('auth', 'enter_username')}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-ink mb-1.5">
                  {'Mật khẩu'}
                </label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={form.password}
                    onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-hairline-2 bg-surface text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-gold/40 pr-12"
                    placeholder={t('auth', 'enter_password')}
                  />
                  <button type="button" onClick={() => setShowPw(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink">
                    {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gold text-white font-semibold hover:bg-gold-strong transition disabled:opacity-50"
              >
                {loading
                  ? <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  : <LogIn size={18} />}
                {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
              </button>
            </form>
          </div>
        </div>

        {/* ── Multi-role popup ────────────────────────── */}
        {availableRoles && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-md p-6">
              <h3 className="text-xl font-bold text-ink mb-1">{t('auth', 'select_role')}</h3>
              <p className="text-sm text-muted mb-5">
                {t('auth', 'select_role_hint').replace('{{count}}', availableRoles.length)}
              </p>
              <div className="space-y-3">
                {availableRoles.map(r => {
                  const info = getRoleLabel(r, t);
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
                className="mt-4 w-full py-2.5 rounded-xl border border-hairline-2 text-muted hover:bg-canvas text-sm"
              >
                {t('common', 'cancel')}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
