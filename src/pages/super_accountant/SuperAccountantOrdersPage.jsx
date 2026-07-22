import { useState } from 'react';
import { Factory, ShoppingBag } from 'lucide-react';
import SuperAccountantMaterialRequestPage from './SuperAccountantMaterialRequestPage';
import SupplyOrderAccountantPage from './SupplyOrderAccountantPage';
import { PageHeader, TabBar } from '../../components/ui';

/**
 * PAGE "Phiếu đặt hàng" của SUPER_ACCOUNTANT — tách 2 tab.
 *
 * <ul>
 *   <li><b>Tab 1 — Nguyên liệu sản xuất:</b> render nguyên xi
 *       {@code SuperAccountantMaterialRequestPage} cũ, KHÔNG sửa gì bên trong.
 *       Backend cũng đã lọc {@code orderType = 'MATERIAL'} ở tầng repository nên
 *       tab này không bao giờ thấy phiếu văn phòng phẩm.</li>
 *   <li><b>Tab 2 — Đồ dùng:</b> các phiếu {@code orderType = SUPPLY}.</li>
 * </ul>
 *
 * <p>Route cũ {@code /super-accountant/material-requests} nay trỏ vào component
 * này; người dùng vẫn vào đúng chỗ quen thuộc, chỉ có thêm 1 tab.
 */
export default function SuperAccountantOrdersPage() {
  const [tab, setTab] = useState('MATERIAL');

  return (
    <div className="space-y-5">
      <PageHeader
        icon={ShoppingBag}
        title="Phiếu đặt hàng"
        subtitle="Xác nhận đặt hàng và tất toán phiếu"
      />

      <TabBar
        tabs={[
          { id: 'MATERIAL', label: 'Nguyên liệu sản xuất', icon: Factory },
          { id: 'SUPPLY', label: 'Đồ dùng', icon: ShoppingBag },
        ]}
        active={tab}
        onChange={setTab}
      />

      {/* Giữ cả 2 tab mounted sẽ tốn 2 lần gọi API mỗi lần vào page, nên chỉ
          render tab đang mở. Đổi tab = load lại — chấp nhận được vì 2 luồng
          hoàn toàn độc lập, không có state chung cần giữ. */}
      {tab === 'MATERIAL'
        ? <SuperAccountantMaterialRequestPage />
        : <SupplyOrderAccountantPage />}
    </div>
  );
}
