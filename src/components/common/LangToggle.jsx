// src/components/common/LangToggle.jsx
import { useLang } from '../../context/LangContext';

/**
 * LangToggle
 * Props:
 *  - variant: 'default' | 'ghost' | 'dark'  (visual style)
 *  - compact: boolean (icon only on small)
 */
export default function LangToggle({ variant = 'default', compact = false }) {
  const { lang, toggle } = useLang();
  const isVi = lang === 'vi';

  if (variant === 'dark') {
    // Dùng trong sidebar / tối
    return (
      <button
        onClick={toggle}
        title={isVi ? 'Switch to English' : 'Chuyển sang Tiếng Việt'}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition text-white text-xs font-semibold select-none"
      >
        <span className="text-sm leading-none">{isVi ? '🇻🇳' : '🇬🇧'}</span>
        {!compact && <span>{isVi ? 'VI' : 'EN'}</span>}
      </button>
    );
  }

  if (variant === 'ghost') {
    // Dùng trong topbar sáng
    return (
      <button
        onClick={toggle}
        title={isVi ? 'Switch to English' : 'Chuyển sang Tiếng Việt'}
        className="flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-black/5 transition text-[#5C5C5C] hover:text-[#1C1C1E] text-xs font-semibold select-none"
      >
        <span className="text-sm leading-none">{isVi ? '🇻🇳' : '🇬🇧'}</span>
        <span>{isVi ? 'VI' : 'EN'}</span>
      </button>
    );
  }

  // default — pill style (login page)
  return (
    <button
      onClick={toggle}
      title={isVi ? 'Switch to English' : 'Chuyển sang Tiếng Việt'}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-black/10 bg-white hover:bg-[#FAF7F2] shadow-sm transition text-[#1C1C1E] text-xs font-semibold select-none"
    >
      <span className="text-sm leading-none">{isVi ? '🇻🇳' : '🇬🇧'}</span>
      <span>{isVi ? 'Tiếng Việt' : 'English'}</span>
    </button>
  );
}
