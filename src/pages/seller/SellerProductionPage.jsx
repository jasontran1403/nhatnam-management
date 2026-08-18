// src/pages/seller/SellerProductionPage.jsx
import OwnerProductionDashboard from '../owner/OwnerProductionDashboard';

/**
 * TRANG SẢN XUẤT CHO SELLER / SUPER_SELLER.
 *
 * <p>Dùng lại đúng màn hình của OWNER ở chế độ {@code restricted}: chỉ còn nút
 * "Tạo kế hoạch mới" và biểu đồ Gantt sản xuất. Ẩn reset dữ liệu, hao hụt đóng gói,
 * tồn kho nguyên vật liệu, quản lý xưởng, tạo sản phẩm mới, và toàn bộ timeline máy móc.
 *
 * <p>Mục đích: seller là người nắm nhu cầu khách nên chủ động lên kế hoạch sản xuất
 * được, nhưng không có lý do gì đụng tới thiết bị và tồn kho của xưởng.
 *
 * <p>Bấm vào kế hoạch / lệnh sản xuất vẫn mở trang chi tiết như OWNER — chỉ khác đường
 * dẫn nằm dưới {@code /seller}.
 */
export default function SellerProductionPage() {
  return <OwnerProductionDashboard basePath="/seller" restricted />;
}
