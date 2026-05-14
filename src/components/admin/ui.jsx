import { Loader2 } from 'lucide-react';

export function PageHeader({ icon: Icon, title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between gap-3 flex-wrap">
      <div className="flex items-start gap-3 min-w-0">
        {Icon && (
          <div className="w-11 h-11 rounded-xl bg-[#C9A84C]/15 text-[#C9A84C] flex items-center justify-center flex-shrink-0 mt-0.5 ring-1 ring-[#C9A84C]/20">
            <Icon size={20} />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-[#1C1C1E]" style={{ fontFamily: 'var(--font-display)' }}>
            {title}
          </h1>
          {subtitle && <p className="text-sm text-[#8E8878] mt-1">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

export function LoadingSpinner({ label = 'Đang tải...' }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-[#8E8878]">
      <Loader2 className="animate-spin text-[#C9A84C]" size={28} />
      <p className="mt-3 text-sm">{label}</p>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {Icon && (
        <div className="w-14 h-14 rounded-2xl bg-[#FAF7F2] flex items-center justify-center text-[#C9A84C]/50 mb-3">
          <Icon size={26} />
        </div>
      )}
      <p className="text-[#1C1C1E] font-medium">{title}</p>
      {description && <p className="text-sm text-[#8E8878] mt-1 max-w-sm">{description}</p>}
    </div>
  );
}

// Buttons
export function PrimaryButton({ children, loading, ...rest }) {
  return (
    <button
      {...rest}
      disabled={loading || rest.disabled}
      className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#C9A84C] text-white text-sm font-semibold rounded-xl hover:bg-[#B69842] disabled:bg-[#C9A84C]/50 disabled:cursor-not-allowed transition-colors shadow-sm ${rest.className || ''}`}
    >
      {loading && <Loader2 size={15} className="animate-spin" />}
      {children}
    </button>
  );
}

export function SecondaryButton({ children, ...rest }) {
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-[#1C1C1E] text-sm font-semibold rounded-xl border border-black/10 hover:bg-[#FAF7F2] transition-colors ${rest.className || ''}`}
    >
      {children}
    </button>
  );
}

export function DangerButton({ children, loading, ...rest }) {
  return (
    <button
      {...rest}
      disabled={loading || rest.disabled}
      className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors ${rest.className || ''}`}
    >
      {loading && <Loader2 size={15} className="animate-spin" />}
      {children}
    </button>
  );
}

// Form field
export function Field({ label, children, required, hint, error }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-[#1C1C1E] uppercase tracking-wider mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      {children}
      {hint && !error && <p className="text-xs text-[#8E8878] mt-1">{hint}</p>}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </label>
  );
}

export const inputCls =
  'w-full px-3 py-2.5 bg-white border border-black/10 rounded-xl text-sm text-[#1C1C1E] placeholder-[#8E8878] focus:outline-none focus:border-[#C9A84C] focus:ring-2 focus:ring-[#C9A84C]/20 transition-all';

// Format helpers
export const formatCurrency = (v) => {
  const n = Number(v || 0);
  return new Intl.NumberFormat('vi-VN').format(n) + '₫';
};

export const formatNumber = (v) => new Intl.NumberFormat('vi-VN').format(Number(v || 0));

export const formatDateTime = (ms) => {
  if (!ms) return '-';
  const d = new Date(Number(ms));
  return d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export const formatDate = (iso) => {
  if (!iso) return '-';
  const d = typeof iso === 'string' ? new Date(iso) : new Date(iso);
  return d.toLocaleDateString('vi-VN');
};
