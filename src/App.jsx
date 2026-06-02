import { useEffect, useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { WarehouseProvider } from './context/WarehouseContext';
import { ToastProvider, useToast } from './components/common/Toast';
import { LangProvider } from './context/LangContext';
import AppRoutes from './routes';

function SessionExpiredListener() {
  const toast = useToast();

  useEffect(() => {
    const handler = (e) =>
      toast(
        e.detail?.message ||
        'Phiên đăng nhập đã hết, vui lòng đăng nhập lại.',
        'error'
      );

    window.addEventListener('app:session-expired', handler);

    return () =>
      window.removeEventListener('app:session-expired', handler);
  }, [toast]);

  return null;
}

function VersionUpdateModal({
  open,
  version,
  message,
  onRefresh,
  onLater
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-xl">
        <h3 className="text-lg font-semibold mb-3">
          Có phiên bản mới
        </h3>

        <p className="text-sm text-gray-600 mb-2">
          Phiên bản mới: <strong>{version}</strong>
        </p>

        <p className="text-sm text-gray-600 mb-6">
          {message || 'Hệ thống đã được cập nhật.'}
        </p>

        <div className="flex justify-end gap-2">
          <button
            onClick={onLater}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Để sau
          </button>

          <button
            onClick={onRefresh}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Tải lại ngay
          </button>
        </div>
      </div>
    </div>
  );
}

function VersionListener() {
  const [showModal, setShowModal] = useState(false);
  const [message, setMessage] = useState('');
  const [versionName, setVersionName] = useState('');
  const [serverVersionCode, setServerVersionCode] = useState(null);

  useEffect(() => {
    const checkVersion = async () => {
      try {
        const token =
          localStorage.getItem('token') ||
          localStorage.getItem('accessToken');

        // Không check nếu chưa đăng nhập
        if (!token) {
          return;
        }

        const res = await fetch(
          `${import.meta.env.VITE_API_BASE_URL}/api/auth/version`
        );

        const json = await res.json();

        if (json.code < 900 || !json.data) {
          return;
        }

        const latestVersionCode = Number(
          json.data.versionCode
        );

        const currentVersionCode = Number(
          localStorage.getItem('app-version-code')
        );

        // Lần đầu truy cập
        if (!currentVersionCode) {
          localStorage.setItem(
            'app-version-code',
            latestVersionCode
          );

          return;
        }

        // Có phiên bản mới
        if (
          json.data.forceRefresh &&
          latestVersionCode > currentVersionCode
        ) {
          setServerVersionCode(latestVersionCode);

          setVersionName(
            json.data.version || ''
          );

          setMessage(
            json.data.message ||
            'Hệ thống đã được cập nhật.'
          );

          setShowModal(true);
        }
      } catch (err) {
        console.error(
          'Version check error:',
          err
        );
      }
    };

    checkVersion();

    const interval = setInterval(
      checkVersion,
      60000
    );

    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    if (serverVersionCode != null) {
      localStorage.setItem(
        'app-version-code',
        serverVersionCode
      );
    }

    window.location.reload();
  };

  return (
    <VersionUpdateModal
      open={showModal}
      version={versionName}
      message={message}
      onRefresh={handleRefresh}
      onLater={() => setShowModal(false)}
    />
  );
}

export default function App() {
  return (
    <LangProvider>
      <AuthProvider>
        <WarehouseProvider>
          <ToastProvider>
            <SessionExpiredListener />
            <VersionListener />

            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </ToastProvider>
        </WarehouseProvider>
      </AuthProvider>
    </LangProvider>
  );
}