import { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { WarehouseProvider } from './context/WarehouseContext';
import { ToastProvider, useToast } from './components/common/Toast';
import AppRoutes from './routes';

function SessionExpiredListener() {
  const toast = useToast();
  useEffect(() => {
    const handler = (e) =>
      toast(e.detail?.message || 'Phiên đăng nhập đã hết, vui lòng đăng nhập lại.', 'error');
    window.addEventListener('app:session-expired', handler);
    return () => window.removeEventListener('app:session-expired', handler);
  }, []);
  return null;
}

export default function App() {
  return (
    <AuthProvider>
      <WarehouseProvider>
        <ToastProvider>
          <SessionExpiredListener />
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </ToastProvider>
      </WarehouseProvider>
    </AuthProvider>
  );
}