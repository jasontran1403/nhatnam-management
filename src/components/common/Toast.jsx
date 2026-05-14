import { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle, XCircle, AlertTriangle, X, Info } from 'lucide-react';

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'success', duration = 3500) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), duration);
  }, []);

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const icons = {
    success: <CheckCircle size={18} className="text-emerald-500 shrink-0" />,
    error:   <XCircle size={18} className="text-red-500 shrink-0" />,
    warning: <AlertTriangle size={18} className="text-amber-500 shrink-0" />,
    info:    <Info size={18} className="text-blue-500 shrink-0" />,
  };

  const borders = {
    success: 'border-emerald-100',
    error:   'border-red-100',
    warning: 'border-amber-100',
    info:    'border-blue-100',
  };

  return (
    <ToastContext.Provider value={addToast}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`animate-fadeIn flex items-start gap-3 bg-white rounded-xl shadow-xl px-4 py-3 border ${borders[t.type] || 'border-[#F0EBE3]'}`}
          >
            {icons[t.type] || icons.success}
            <span className="text-sm text-[#1C1C1E] flex-1">{t.message}</span>
            <button onClick={() => remove(t.id)} className="text-[#8E8878] hover:text-[#1C1C1E]">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);

