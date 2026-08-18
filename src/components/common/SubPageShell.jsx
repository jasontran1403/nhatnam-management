// src/components/common/SubPageShell.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

/**
 * KHUNG TRANG CON — trượt vào từ phải, có nút quay lại.
 *
 * <p>Dùng cho các trang được mở TỪ một trang khác chứ không từ menu (Quản lý voucher,
 * Phiếu tặng quà — đều mở từ trang Khách hàng). Nút quay lại và hiệu ứng trượt cho người
 * dùng biết đây là một tầng sâu hơn, không phải một mục ngang hàng trong menu.
 *
 * <p><b>Vì sao nút back dùng `navigate(backTo)` chứ không phải `navigate(-1)`?</b>
 * `-1` chỉ đúng khi người dùng vào đây bằng cách bấm nút từ trang Khách hàng. Nếu họ mở
 * thẳng bằng URL, refresh giữa chừng, hoặc tới từ một trang khác, `-1` sẽ ném họ ra khỏi
 * ứng dụng hoặc về một chỗ không liên quan. Đích cố định luôn đưa về đúng trang cha.
 *
 * @param backTo    đường dẫn trang cha (bắt buộc)
 * @param backLabel nhãn nút quay lại
 * @param children  nội dung trang
 */
export default function SubPageShell({ backTo, backLabel = 'Khách hàng', children }) {
  const navigate = useNavigate();
  const [entered, setEntered] = useState(false);

  // Bật animation ở frame kế tiếp. Đặt class cuối ngay từ lần render đầu thì trình duyệt
  // gộp hai trạng thái làm một và không có gì để trượt.
  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div
      className={`transition-all duration-300 ease-out
        ${entered ? 'translate-x-0 opacity-100' : 'translate-x-6 opacity-0'}`}>
      <div className="px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6">
        <button
          onClick={() => navigate(backTo)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-line
                     text-xs font-semibold text-ink-2 hover:border-gold hover:text-gold
                     transition-colors">
          <ArrowLeft size={14} />
          Quay lại {backLabel}
        </button>
      </div>
      {children}
    </div>
  );
}
