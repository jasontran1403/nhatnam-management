import { X } from 'lucide-react';
import { useEffect } from 'react';

export default function Modal({ open, onClose, title, children, size = 'md', footer }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const sizeCls = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    '2xl': 'max-w-6xl',
  }[size] || 'max-w-lg';

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-white w-full ${sizeCls} rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[92vh] flex flex-col animate-[slideUp_.2s_ease-out]`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/5 flex-shrink-0">
          <h3 className="font-bold text-[#1C1C1E] text-base">{title}</h3>
          <button onClick={onClose} className="text-[#8E8878] hover:text-[#1C1C1E] p-1 rounded-lg hover:bg-[#FAF7F2] transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="px-5 py-3 border-t border-black/5 flex-shrink-0 bg-[#FAF7F2]/50">{footer}</div>}
      </div>
      <style>{`@keyframes slideUp { from { transform: translateY(20px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }`}</style>
    </div>
  );
}
