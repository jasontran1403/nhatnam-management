/**
 * Modal.jsx — unified, thay thế components/admin/Modal.jsx và components/common/Modal.jsx
 */
import { useEffect } from 'react';
import { X } from 'lucide-react';

const SIZE = {
  sm:  'max-w-md',
  md:  'max-w-lg',
  lg:  'max-w-2xl',
  xl:  'max-w-4xl',
  '2xl': 'max-w-6xl',
};

export default function Modal({ open, onClose, title, children, size = 'md', footer }) {
  useEffect(() => {
    if (!open) return;
    const fn = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className={`
        relative bg-white w-full ${SIZE[size] || SIZE.md}
        rounded-t-3xl sm:rounded-2xl shadow-2xl
        max-h-[92vh] sm:max-h-[88vh] flex flex-col
        animate-[slideUp_.18s_ease-out]
      `}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/5 flex-shrink-0">
          <h3 className="font-bold text-[#1C1C1E] text-base" style={{ fontFamily: 'var(--font-display)' }}>
            {title}
          </h3>
          <button onClick={onClose}
            className="text-[#8E8878] hover:text-[#1C1C1E] p-1.5 rounded-lg hover:bg-[#FAF7F2] transition-colors">
            <X size={17} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="px-5 py-3.5 border-t border-black/5 flex-shrink-0 bg-[#FAF7F2]/60">
            {footer}
          </div>
        )}
      </div>
      <style>{`@keyframes slideUp { from { transform: translateY(16px); opacity:0 } to { transform: translateY(0); opacity:1 } }`}</style>
    </div>
  );
}
