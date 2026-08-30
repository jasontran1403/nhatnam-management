// src/pages/factory_accountant/FactoryAccountantMaterialRequestsPage.jsx
// Phiếu đặt hàng nguyên liệu — wrapper thêm nút Back về Kho (tab nguyên liệu).
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import FactoryMaterialRequestPage from '../factory_worker/FactoryMaterialRequestPage';

export default function FactoryAccountantMaterialRequestsPage() {
  const navigate = useNavigate();

  return (
    <div>
      <div className="px-4 pt-3 pb-1">
        <button onClick={() => navigate('/factory-accountant/warehouse?tab=material')}
          className="flex items-center gap-1.5 text-sm text-muted hover:text-ink font-medium">
          <ChevronLeft size={16} /> Quay lại Kho nguyên liệu
        </button>
      </div>
      <FactoryMaterialRequestPage />
    </div>
  );
}