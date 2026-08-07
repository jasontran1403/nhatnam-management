// src/components/common/SubPageNav.jsx
//
// GOM TRANG PHỤ VÀO TRANG CHÍNH.
//
// Trước đây mỗi mục ở sidebar là một trang riêng. Nay các trang phụ (Dòng tiền,
// KPI Sale, Dự báo, Duyệt lương, Tài xế, Bảng chấm công, Khoá xem lương, Kho
// văn phòng phẩm…) được gỡ khỏi sidebar và mở từ NÚT trên trang chính.
//
// Điều hướng vẫn dùng router (giữ nguyên URL, F5 không mất trang) nhưng kèm
// `state.slide` để <SlideOutlet> biết trượt sang phải hay trượt ngược về —
// cảm giác như swipe qua/lại chứ không phải nhảy sang một trang mới.
//
//   · goSub(to)            → sang trang phụ, ghi nhớ trang gốc trong state.from
//   · <BackButton fallback> → quay lại trang gốc (ưu tiên state.from)
import { useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

/**
 * Hook điều hướng trang phụ.
 *
 * @returns {{ goSub: (to: string, extraState?: object) => void,
 *             goBack: (fallback: string) => void,
 *             from: string | null }}
 */
export function useSubPageNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const goSub = useCallback((to, extraState = {}) => {
    navigate(to, {
      state: {
        slide: 'forward',
        // Ghi lại đường dẫn hiện tại để nút Quay lại biết về đâu, kể cả khi
        // người dùng đi tiếp nhiều tầng.
        from: location.pathname + location.search,
        ...extraState,
      },
    });
  }, [navigate, location.pathname, location.search]);

  const goBack = useCallback((fallback) => {
    const target = location.state?.from || fallback;
    if (!target) { navigate(-1); return; }
    // replace: true để nút Back của trình duyệt không kẹt trong vòng lặp
    // trang chính → trang phụ → trang chính.
    navigate(target, { state: { slide: 'back' }, replace: true });
  }, [navigate, location.state]);

  return { goSub, goBack, from: location.state?.from ?? null };
}

/**
 * Nút "Quay lại" đặt ở đầu mỗi trang phụ.
 *
 * @param fallback  đường dẫn dùng khi người dùng mở thẳng URL (không có state.from)
 * @param label     nhãn hiển thị, mặc định "Quay lại"
 */
export function BackButton({ fallback, label = 'Quay lại', className = '' }) {
  const { goBack } = useSubPageNav();

  return (
    <button
      type="button"
      onClick={() => goBack(fallback)}
      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl
        bg-surface border border-hairline-2 text-sm font-semibold text-ink-2
        hover:border-gold hover:text-gold transition-colors ${className}`}
    >
      <ArrowLeft size={15} />
      {label}
    </button>
  );
}

/**
 * Hàng nút mở các trang phụ, đặt ngay dưới tiêu đề trang chính.
 *
 * @param items  [{ to, label, icon, hidden? }]
 */
export function SubPageButtons({ items = [], className = '' }) {
  const { goSub } = useSubPageNav();
  const visible = items.filter(i => i && !i.hidden && i.to);

  if (visible.length === 0) return null;

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {visible.map(({ to, label, icon: Icon }) => (
        <button
          key={to}
          type="button"
          onClick={() => goSub(to)}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl
            bg-surface border border-hairline-2 shadow-sm text-sm font-semibold text-ink
            hover:border-gold hover:text-gold active:scale-[0.98] transition-all"
        >
          {Icon && <Icon size={15} className="text-gold" />}
          {label}
        </button>
      ))}
    </div>
  );
}

export default SubPageButtons;
