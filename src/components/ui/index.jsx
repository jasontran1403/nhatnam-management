/**
 * ui.jsx — Single source of truth cho tất cả shared UI primitives.
 */
import { Loader2 } from 'lucide-react';

// ── Layout helpers ────────────────────────────────────────────────────────────

export function PageHeader({ icon: Icon, title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between gap-3 flex-wrap">
      <div className="flex items-start gap-3 min-w-0">
        {Icon && (
          <div className="w-10 h-10 rounded-xl bg-[#C9A84C]/15 text-[#C9A84C] flex items-center justify-center flex-shrink-0 mt-0.5 ring-1 ring-[#C9A84C]/20">
            <Icon size={19} />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-[#1C1C1E]" style={{ fontFamily: 'var(--font-display)' }}>
            {title}
          </h1>
          {subtitle && <p className="text-sm text-[#8E8878] mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

export function SectionCard({ children, className = '' }) {
  return (
    <div className={`bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

export function SectionHeader({ title, action }) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5 border-b border-black/5 bg-[#FAF7F2]">
      <h3 className="text-xs font-semibold text-[#8E8878] uppercase tracking-wider">{title}</h3>
      {action}
    </div>
  );
}

// ── Feedback ──────────────────────────────────────────────────────────────────

export function LoadingSpinner({ label = '' }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-[#8E8878]">
      <Loader2 className="animate-spin text-[#C9A84C]" size={26} />
      <p className="mt-2.5 text-sm">{label}</p>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {Icon && (
        <div className="w-14 h-14 rounded-2xl bg-[#FAF7F2] flex items-center justify-center text-[#C9A84C]/40 mb-3">
          <Icon size={24} />
        </div>
      )}
      <p className="text-[#1C1C1E] font-medium">{title}</p>
      {description && <p className="text-sm text-[#8E8878] mt-1 max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ── Buttons ───────────────────────────────────────────────────────────────────

export function PrimaryButton({ children, loading, className = '', ...rest }) {
  return (
    <button {...rest} disabled={loading || rest.disabled}
      className={`inline-flex items-center justify-center gap-2 px-4 py-2.5
        bg-[#C9A84C] text-white text-sm font-semibold rounded-xl
        hover:bg-[#B69842] active:bg-[#A58832]
        disabled:bg-[#C9A84C]/50 disabled:cursor-not-allowed
        transition-colors shadow-sm ${className}`}>
      {loading && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  );
}

export function SecondaryButton({ children, className = '', ...rest }) {
  return (
    <button {...rest}
      className={`inline-flex items-center justify-center gap-2 px-4 py-2.5
        bg-white text-[#1C1C1E] text-sm font-semibold rounded-xl
        border border-black/10 hover:bg-[#FAF7F2] active:bg-[#F0EBE3]
        transition-colors ${className}`}>
      {children}
    </button>
  );
}

export function DangerButton({ children, loading, className = '', ...rest }) {
  return (
    <button {...rest} disabled={loading || rest.disabled}
      className={`inline-flex items-center justify-center gap-2 px-4 py-2.5
        bg-red-600 text-white text-sm font-semibold rounded-xl
        hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed
        transition-colors ${className}`}>
      {loading && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  );
}

export function IconButton({ icon: Icon, label, onClick, className = '' }) {
  return (
    <button onClick={onClick} title={label}
      className={`p-2 rounded-lg text-[#8E8878] hover:text-[#1C1C1E] hover:bg-[#FAF7F2] transition-colors ${className}`}>
      <Icon size={15} />
    </button>
  );
}

// ── Form ──────────────────────────────────────────────────────────────────────

export function Field({ label, children, required, hint, error }) {
  return (
    // Dùng <div> thay vì <label> — label HTML tự động forward click/focus tới
    // control con đầu tiên bên trong nó. Với input/select đơn giản thì vô hại,
    // nhưng với các custom dropdown nhiều bước (search input + list item + tag
    // xoá) như MultiProductSelect/SearchDropdown, hành vi forward này khiến
    // click vào ô input bị browser "chuyển tiếp" thành click vào nút xoá tag
    // hoặc phần tử ẩn đầu tiên, gây mất lựa chọn đã chọn và dropdown không mở
    // được trên mobile (touch event bị label nuốt mất).
    <div className="block">
      <span className="block text-xs font-semibold text-[#1C1C1E] uppercase tracking-wider mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      {children}
      {hint && !error && <p className="text-xs text-[#8E8878] mt-1">{hint}</p>}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

export const inputCls =
  'w-full px-3 py-2.5 bg-white border border-black/10 rounded-xl text-sm text-[#1C1C1E] placeholder-[#8E8878]/70 focus:outline-none focus:border-[#C9A84C] focus:ring-2 focus:ring-[#C9A84C]/20 transition-all';

export const selectCls = inputCls + ' cursor-pointer';

// ── Tabs ──────────────────────────────────────────────────────────────────────

export function TabBar({ tabs, active, onChange }) {
  return (
    <div className="flex bg-white border border-black/5 rounded-xl p-1 shadow-sm w-fit flex-wrap gap-0.5">
      {tabs.map(tab => (
        <button key={tab.id} onClick={() => onChange(tab.id)}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap
            ${active === tab.id ? 'bg-[#1C1C1E] text-white shadow-sm' : 'text-[#8E8878] hover:text-[#1C1C1E] hover:bg-[#FAF7F2]'}`}>
          {tab.icon && <tab.icon size={14} />}
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// ── Table ─────────────────────────────────────────────────────────────────────

export function Table({ children, className = '' }) {
  return (
    <div className="overflow-x-auto">
      <table className={`w-full text-sm ${className}`}>{children}</table>
    </div>
  );
}

export function Thead({ children, className = '' }) {
  return (
    <thead className={className}>
      {children}
    </thead>
  );
}

export function Th({ children, className = '', right = false }) {
  return (
    <th className={`px-4 py-3 font-semibold text-xs uppercase tracking-wider ${right ? 'text-right' : 'text-left'} ${className}`}>
      {children}
    </th>
  );
}

// `...rest` để truyền được colSpan / rowSpan / title xuống thẻ <td> thật.
// Thiếu nó thì mọi ô gộp cột đều âm thầm bị bỏ qua và bảng lệch cột.
export function Td({ children, className = '', right = false, ...rest }) {
  return (
    <td className={`px-4 py-3 ${right ? 'text-right' : ''} ${className}`} {...rest}>
      {children}
    </td>
  );
}

export function Tr({ children, onClick, className = '' }) {
  const isHeader =
    className.includes('bg-[#FAF7F2]') ||
    className.includes('bg-');

  return (
    <tr
      onClick={onClick}
      {...rest}
      className={`
        ${!isHeader ? 'border-t border-black/5' : ''}
        transition-colors
        ${onClick
          ? 'cursor-pointer hover:bg-[#FAF7F2]/60'
          : !isHeader
            ? 'hover:bg-[#FAF7F2]/30'
            : ''
        }
        ${className}
      `}
    >
      {children}
    </tr>
  );
}

// ── Format helpers ────────────────────────────────────────────────────────────

export const formatCurrency = (v) =>
  new Intl.NumberFormat('vi-VN').format(Math.round(Number(v || 0))) + '₫';

export const formatNumber = (v) =>
  new Intl.NumberFormat('vi-VN').format(Number(v || 0));

export const formatDateTime = (ms) => {
  if (!ms) return '–';
  return new Date(Number(ms)).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

export const formatDate = (ms) => {
  if (!ms) return '–';
  return new Date(Number(ms)).toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
};

export * from './Skeleton.jsx';