import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react';

const ToastContext = createContext(null);

let _toastId = 0;

function ToastItem({ t, onRemove }) {
  const [progress, setProgress] = useState(100);
  const startRef = useRef(Date.now());
  const duration = t.duration || 3000;

  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      if (remaining === 0) clearInterval(interval);
    }, 16);
    return () => clearInterval(interval);
  }, [duration]);

  const borderColor = {
    success: 'var(--c-success)',
    error: 'var(--c-danger)',
    warning: 'var(--c-warning)',
    info: 'var(--c-info)',
  }[t.type] || 'var(--c-success)';

  const icons = {
    success: <CheckCircle size={18} className="text-emerald-500 shrink-0" />,
    error: <XCircle size={18} className="text-red-500 shrink-0" />,
    warning: <AlertTriangle size={18} className="text-amber-500 shrink-0" />,
    info: <Info size={18} className="text-blue-500 shrink-0" />,
  };

  return (
    <div
      onClick={() => onRemove(t.id)}
      className="animate-fadeIn cursor-pointer bg-surface rounded-xl shadow-xl overflow-hidden"
      style={{ border: `1.5px solid ${borderColor}20` }}
    >
      <div className="flex items-start gap-3 px-4 py-3">
        {icons[t.type] || icons.success}
        <span className="text-sm text-ink flex-1">{t.message}</span>
      </div>
      {/* Progress bar */}
      <div className="h-[3px] w-full bg-surface-2">
        <div
          className="h-full transition-none"
          style={{
            width: `${progress}%`,
            backgroundColor: borderColor,
            transition: 'width 16ms linear',
          }}
        />
      </div>
    </div>
  );
}

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message, type = 'success', duration = 3000) => {
    setToasts((prev) => {
      if (prev.some(t => t.message === message)) return prev;
      const id = ++_toastId;
      setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), duration);
      return [...prev, { id, message, type, duration }];
    });
  }, []);

  return (
    <ToastContext.Provider value={addToast}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-80">
        {toasts.map((t) => (
          <ToastItem key={t.id} t={t} onRemove={remove} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);