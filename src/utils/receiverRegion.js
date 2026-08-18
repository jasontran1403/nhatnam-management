import { PICKUP_AT_WAREHOUSE } from '../components/common/PickupToggle';

/**
 * KIỂM TRA NGƯỜI NHẬN ĐANG CHỌN CÓ THIẾU TỈNH/PHƯỜNG KHÔNG.
 *
 * Dùng để chặn tạo đơn với dữ liệu khách CŨ: những người nhận được lưu từ trước khi
 * có tính năng chọn tỉnh/thành + phường/xã nên `provinceName` / `wardName` đang trống.
 * Buộc seller cập nhật lại thông tin nhận hàng trước khi tạo đơn thì vùng COD mới tra được.
 *
 * Quy tắc:
 *   - Không có người nhận nào được chọn → KHÔNG chặn (đây là việc của validate khác).
 *   - "Nhận tại kho" → KHÔNG chặn (vốn dĩ không có tỉnh/phường).
 *   - Có địa chỉ giao thật mà thiếu tỉnh HOẶC phường → CHẶN.
 *
 * @param {object|null|undefined} receiver đối tượng người nhận đang chọn (selectedReceiver)
 * @returns {boolean} true nếu cần chặn tạo đơn để yêu cầu cập nhật.
 */
export function receiverMissingRegion(receiver) {
  if (!receiver) return false;
  const addr = (receiver.receiverAddress || '').trim();
  if (!addr || addr === PICKUP_AT_WAREHOUSE) return false;
  return !receiver.provinceName || !receiver.wardName;
}

/** Thông báo chuẩn khi chặn — dùng chung để mọi nơi hiển thị giống nhau. */
export const MISSING_REGION_MESSAGE =
  'Địa chỉ nhận hàng đang chọn chưa có Tỉnh/Thành phố và Phường/Xã. ' +
  'Vui lòng cập nhật thông tin nhận hàng của khách trước khi tạo đơn.';
