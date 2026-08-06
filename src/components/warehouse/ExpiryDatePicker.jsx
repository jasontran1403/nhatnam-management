// src/components/warehouse/ExpiryDatePicker.jsx
// Ô chọn HẠN SỬ DỤNG dùng chung cho cả 4 tab nhập/xuất/chuyển/điều chỉnh.
//
// Vì sao cần lớp bọc này thay vì gọi thẳng <DatePicker>:
//   · DatePicker của app làm việc bằng TIMESTAMP (ms), còn toàn bộ luồng kho
//     đang giữ hạn sử dụng ở dạng chuỗi 'YYYY-MM-DD' — đó là dạng backend nhận
//     và cũng là dạng đang lưu trong state của form. Đổi hết sang ms sẽ phải
//     sửa cả API lẫn chỗ dựng payload.
//   · Quy đổi ngày rất dễ lệch một ngày nếu dùng new Date('YYYY-MM-DD') (chuỗi
//     đó được hiểu là UTC, ở múi giờ +7 sẽ lùi về hôm trước). Gom việc quy đổi
//     vào một chỗ để không phải nhớ cái bẫy này ở từng form.
//
// Hạn sử dụng KHÔNG bắt buộc — nhiều vật tư không có hạn (dây buộc, bao bì,
// hàng tính theo mét/bó). Bấm "Xoá" trong DatePicker sẽ trả về chuỗi rỗng.
import DatePicker from '../ui/DatePicker';

/** 'YYYY-MM-DD' → timestamp ms (giờ địa phương, 00:00). */
function isoToMs(iso) {
  if (!iso) return null;
  const [y, m, d] = String(iso).split('-').map(Number);
  if (!y || !m || !d) return null;
  // Dựng bằng các thành phần số, KHÔNG dùng new Date(chuỗi) — chuỗi dạng
  // 'YYYY-MM-DD' bị parse theo UTC nên ở VN sẽ hiển thị lùi một ngày.
  return new Date(y, m - 1, d).getTime();
}

/** timestamp ms → 'YYYY-MM-DD' theo giờ địa phương. */
function msToIso(ms) {
  if (ms == null) return '';
  const d = new Date(Number(ms));
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * @param {string}   value        'YYYY-MM-DD' hoặc '' khi chưa chọn
 * @param {Function} onChange     (iso: string) => void — trả '' khi xoá
 * @param {string}   placeholder
 * @param {string}   align        'left' | 'right' — hướng bung lịch
 */
export default function ExpiryDatePicker({
  value,
  onChange,
  placeholder = 'Hạn sử dụng',
  align = 'left',
}) {
  return (
    <DatePicker
      value={isoToMs(value)}
      onChange={(ms) => onChange(msToIso(ms))}
      placeholder={placeholder}
      align={align}
    />
  );
}

export { isoToMs, msToIso };
