// src/components/common/PickupToggle.jsx

/**
 * ĐỊA CHỈ "NHẬN TẠI KHO" — chuỗi cố định.
 *
 * <p>Phải khớp nguyên văn hằng {@code PICKUP_AT_WAREHOUSE} bên backend
 * ({@code AddressCatalogService}). Đổi một bên thì phải đổi bên kia, nếu không đơn nhận
 * tại kho sẽ bị xếp nhầm vào diện phải thu tiền trước.
 *
 * <p>Dùng chuỗi thay vì cờ boolean vì địa chỉ nhận hàng đã đi xuyên suốt hệ thống dưới
 * dạng văn bản (in trên đơn, phiếu giao, đầu vào phân vùng COD) — thêm cờ mới đồng nghĩa
 * phải sửa mọi chỗ đó.
 */
export const PICKUP_AT_WAREHOUSE = 'Nhận tại kho';

/**
 * CÔNG TẮC "NHẬN TẠI KHO".
 *
 * <p>Luôn đặt TRÊN CÙNG khối địa chỉ vì nó quyết định có phải nhập địa chỉ hay không —
 * để dưới thì người dùng gõ xong địa chỉ mới thấy và phải xoá đi.
 *
 * <p>Bật lên: ghi chuỗi cố định vào ô địa chỉ, xoá tỉnh/phường, khoá các ô bên dưới.
 * Khách tự tới kho thì không có địa chỉ giao; giữ lại dữ liệu cũ sẽ tạo ra bản ghi vừa
 * "nhận tại kho" vừa có địa chỉ nhà — không ai biết phải giao đi đâu.
 *
 * <p>Mặc định TẮT: phần lớn khách vẫn giao tận nơi.
 */
export default function PickupToggle({ checked, onChange }) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border transition-colors
        ${checked ? 'bg-gold/10 border-gold' : 'border-line hover:border-gold/60'}`}>
      <span className={`text-xs font-semibold ${checked ? 'text-gold' : 'text-ink-2'}`}>
        🏭 {PICKUP_AT_WAREHOUSE}
      </span>
      <span className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors
        ${checked ? 'bg-gold' : 'bg-line'}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all
          ${checked ? 'left-[18px]' : 'left-0.5'}`} />
      </span>
    </button>
  );
}
