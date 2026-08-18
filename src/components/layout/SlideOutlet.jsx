// src/components/layout/SlideOutlet.jsx
//
// Vùng render trang con của AppLayout, có thêm hiệu ứng trượt.
//
// Chỉ trượt khi điều hướng đi kèm `state.slide` (do useSubPageNav gắn vào) —
// mọi thao tác điều hướng khác (bấm sidebar, F5, gõ URL) giữ nguyên hành vi cũ,
// không animation, để không làm chậm những trang nặng biểu đồ.
//
// ⚠️ QUAN TRỌNG — vì sao phải GỠ class sau khi chạy xong:
// animation dùng `transform`, mà một phần tử có transform sẽ trở thành containing
// block cho mọi con `position: fixed`. Với `animation-fill-mode: both`, transform
// (dù chỉ là translateX(0)) còn nguyên sau khi animation kết thúc, nên mọi modal
// bên trong trang sẽ căn theo khối này thay vì theo màn hình — modal rơi xuống
// dưới vùng cuộn, phải kéo xuống mới thấy. Gỡ class ngay khi animation xong trả
// lại hành vi `fixed` đúng nghĩa.
import { useState, useEffect } from 'react';
import { useLocation, Outlet } from 'react-router-dom';

export default function SlideOutlet() {
  const location = useLocation();
  const slide = location.state?.slide;
  const key = location.pathname + (slide || '');

  const [animating, setAnimating] = useState(!!slide);

  // Điều hướng mới → bật lại animation (hoặc tắt hẳn nếu lần này không trượt).
  useEffect(() => { setAnimating(!!slide); }, [key, slide]);

  // Chốt an toàn: nếu sự kiện animationend không bắn (tab ẩn, người dùng bật
  // prefers-reduced-motion…), vẫn gỡ class sau đúng thời lượng animation.
  useEffect(() => {
    if (!animating) return;
    const id = setTimeout(() => setAnimating(false), 400);
    return () => clearTimeout(id);
  }, [animating, key]);

  const cls = !animating ? ''
    : slide === 'forward' ? 'page-slide-forward'
      : slide === 'back' ? 'page-slide-back'
        : '';

  return (
    // key đổi theo pathname + hướng trượt để animation chạy lại mỗi lần chuyển.
    /*
     * h-full là MẮT XÍCH bắt buộc để các trang dạng "toàn màn hình" (POS) hoạt động.
     *
     * <main> của AppLayout có chiều cao xác định (flex-1 trong khung h-[100dvh]), nhưng
     * lớp bọc này trước đây để chiều cao tự động. Chiều cao theo phần trăm chỉ tính được
     * khi CHA có chiều cao xác định, nên `h-full` của trang POS rơi vào lớp bọc cao 0 và
     * bị bỏ qua — cả trang phình theo nội dung và <main> cuộn tất cả: thanh chọn kho,
     * danh mục và giỏ hàng đều trôi lên theo.
     *
     * Trang có nội dung dài hơn màn hình vẫn cuộn bình thường qua <main>, vì nội dung
     * chỉ tràn ra chứ không bị cắt.
     */
    <div
      key={key}
      className={`h-full ${cls}`}
      onAnimationEnd={() => setAnimating(false)}
    >
      <Outlet />
    </div>
  );
}
