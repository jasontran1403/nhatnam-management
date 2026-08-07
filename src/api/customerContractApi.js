// src/api/customerContractApi.js
//
// HỢP ĐỒNG KHÁCH HÀNG — ảnh/PDF hợp đồng, là điều kiện để khách được mua công nợ.
import api from './axios';
import { getImageUrl } from './adminApi';

const unwrap = (res) => res.data?.data ?? res.data;

export const customerContractApi = {
  /**
   * {
   *   customerId, hasContract, contractRequired, debtAllowed,
   *   images: [{ id, imageUrl, sortOrder, uploadedByName, uploadedAt }],
   *   uploadedByName, uploadedAt
   * }
   *
   * · hasContract      — đã tải hợp đồng lên chưa (dùng cho badge)
   * · contractRequired — khách MỚI, bắt buộc có hợp đồng mới được công nợ
   * · debtAllowed      — CÓ ĐƯỢC bán công nợ không (khách cũ luôn true)
   *
   * Ẩn/hiện lựa chọn Công nợ phải dựa vào `debtAllowed`, không phải `hasContract`.
   */
  get: (customerId) =>
    api.get(`/api/customer-contracts/${customerId}`).then(unwrap),

  /**
   * Tải hợp đồng lên. LƯU Ý: thay TOÀN BỘ bộ ảnh cũ — gọi hàm này khi khách đã
   * có hợp đồng thì phải hỏi xác nhận trước.
   *
   * @param {File[]} files
   */
  upload: (customerId, files) => {
    const fd = new FormData();
    (files || []).forEach(f => fd.append('files', f));
    return api.post(`/api/customer-contracts/${customerId}`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(unwrap);
  },
};

/** Đường dẫn ảnh hợp đồng đầy đủ để hiển thị / mở tab mới. */
export const contractImageUrl = getImageUrl;

export default customerContractApi;
