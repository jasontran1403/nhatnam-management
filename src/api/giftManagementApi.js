// src/api/giftManagementApi.js
import api from './axios';

// Cùng cách unwrap với giftOrderApi.js — service backend trả về ApiResponse<T>,
// FE chỉ quan tâm phần data. Ném Error nếu success=false để component bắt trong try/catch.
const unwrap = (res) => {
  const body = res?.data;
  if (body && typeof body === 'object' && 'success' in body) {
    if (!body.success) throw new Error(body.message || 'Request failed');
    return body.data;
  }
  return body;
};

/**
 * QUẢN LÝ QUÀ TẶNG — API cho trang OWNER / ADMIN / SUPER_ACCOUNTANT.
 *
 * <p>Trang này gộp 2 nguồn quà tặng:
 *   1. Đơn hàng có sản phẩm khuyến mãi (OrderItem có notes bắt đầu bằng "[KM]").
 *   2. Phiếu tặng quà (GiftOrder) đã được duyệt.
 *
 * <p>Mỗi bản ghi trả về là MỘT sản phẩm quà = MỘT dòng UI (flatten server-side),
 * để search theo tên SP ra đúng dòng. Xem `GiftManagementService.java` để hiểu
 * quy tắc merge.
 */
export const giftManagementApi = {
  /**
   * Danh sách quà tặng đã phân trang.
   *
   * @param {object} params
   * @param {string} [params.q]         search — tên KH / mã đơn / SĐT / tên SP
   * @param {number} [params.from]      epoch ms — cận dưới thời gian
   * @param {number} [params.to]        epoch ms — cận trên thời gian
   * @param {number} [params.handlerId] id người tạo (seller)
   * @param {number} [params.page=0]
   * @param {number} [params.size=20]
   */
  list: (params) =>
    api.get('/api/admin/gift-management', {
      params: {
        q: params?.q || undefined,
        from: params?.from || undefined,
        to: params?.to || undefined,
        handlerId: params?.handlerId || undefined,
        page: params?.page ?? 0,
        size: params?.size ?? 20,
      },
    }).then(unwrap),

  /** Người tạo (seller) — cho dropdown filter. */
  handlers: () => api.get('/api/admin/gift-management/handlers').then(unwrap),
};
