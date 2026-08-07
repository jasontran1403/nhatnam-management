/**
 * ThemeToggle — nút đổi giao diện sáng/tối.
 *
 * Hai kiểu:
 *   variant="ghost"   nút tròn 1 icon, dùng ở thanh trên cùng (mặc định)
 *   variant="segmented"  ba lựa chọn Sáng / Tối / Hệ thống, dùng trong trang Cài đặt
 */
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useLang } from '../../context/LangContext';

export default function ThemeToggle({ variant = 'ghost', className = '' }) {
  const { theme, isDark, setTheme, toggleTheme } = useTheme();
  const { t } = useLang();

  const label = isDark ? t('theme', 'switch_to_light') : t('theme', 'switch_to_dark');

  if (variant === 'segmented') {
    const options = [
      { id: 'light', icon: Sun, label: t('theme', 'light') },
      { id: 'dark', icon: Moon, label: t('theme', 'dark') },
      { id: 'system', icon: Monitor, label: t('theme', 'system') },
    ];

    return (
      <div
        role="radiogroup"
        aria-label={t('theme', 'appearance')}
        className={`inline-flex bg-surface border border-hairline rounded-xl p-1 gap-0.5 ${className}`}
      >
        {options.map(({ id, icon: Icon, label: optLabel }) => (
          <button
            key={id}
            role="radio"
            aria-checked={theme === id}
            onClick={() => setTheme(id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
              ${theme === id
                ? 'bg-chrome text-on-chrome'
                : 'text-muted hover:text-ink hover:bg-canvas'}`}
          >
            <Icon size={14} />
            {optLabel}
          </button>
        ))}
      </div>
    );
  }

  return (
    <button
      onClick={toggleTheme}
      title={label}
      aria-label={label}
      className={`p-2 rounded-lg text-muted hover:text-ink hover:bg-canvas transition-colors ${className}`}
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

/** Biến thể cho nền tối cố định (sidebar, topbar mobile). */
export function ThemeToggleOnChrome({ className = '' }) {
  const { isDark, toggleTheme } = useTheme();
  const { t } = useLang();
  const label = isDark ? t('theme', 'switch_to_light') : t('theme', 'switch_to_dark');

  return (
    <button
      onClick={toggleTheme}
      title={label}
      aria-label={label}
      className={`p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors ${className}`}
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
