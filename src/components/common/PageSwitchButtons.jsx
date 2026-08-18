// src/components/common/PageSwitchButtons.jsx
import { useNavigate } from 'react-router-dom';

/**
 * NÚT CHUYỂN SANG TRANG CON — dùng ở các trang cha sau khi gỡ mục khỏi menu.
 *
 * <p>Trang đích được bọc bằng {@code SubPageShell} nên tự có nút quay lại và hiệu ứng
 * trượt. Component này chỉ lo phần nút bấm ở trang cha.
 *
 * <p>Cặp component này thay cho việc để mọi thứ ngoài menu: menu chỉ giữ các đầu việc
 * chính, còn những trang chỉ dùng kèm một đầu việc (Báo giá đi với Bán hàng, Đơn nháp
 * đi với Đơn hàng) thì mở từ chính chỗ đang làm việc.
 *
 * @example
 * <PageSwitchButtons items={[
 *   { to: '/seller/material-requests', label: 'Đặt hàng', icon: ShoppingBag },
 *   { to: '/seller/quotation',         label: 'Báo giá',  icon: Receipt },
 * ]} />
 */
export default function PageSwitchButtons({ items = [], size = 'md', className = '' }) {
  const navigate = useNavigate();
  if (!items.length) return null;

  const pad = size === 'sm' ? 'h-8 px-2.5 text-[11px]' : 'h-9 px-3 text-xs';

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {items.map(({ to, label, icon: Icon }) => (
        <button
          key={to}
          onClick={() => navigate(to)}
          title={label}
          className={`${pad} rounded-xl border border-line flex items-center gap-1.5
                      font-semibold text-ink-2 hover:border-gold hover:text-gold
                      transition-colors shrink-0`}>
          {Icon && <Icon size={14} />}
          {/* Ẩn chữ trên màn hình hẹp — hàng nút ở header rất dễ tràn trên điện thoại. */}
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * TOGGLE HAI TRANG NGANG HÀNG — dùng cho cặp Đơn hàng ↔ Đơn nháp.
 *
 * <p>Khác {@link PageSwitchButtons} ở chỗ đây là hai trang đồng cấp, người dùng qua lại
 * liên tục, nên hiển thị dạng công tắc có nhấn mạnh trang đang đứng thay vì nút rời.
 *
 * @param current đường dẫn trang đang mở, phải khớp một trong hai `to`
 */
export function PageToggle({ options = [], current, className = '' }) {
  const navigate = useNavigate();
  if (options.length < 2) return null;

  return (
    <div className={`inline-flex items-center p-0.5 rounded-xl bg-surface-2 border border-line-soft ${className}`}>
      {options.map(({ to, label, icon: Icon }) => {
        const active = to === current;
        return (
          <button
            key={to}
            onClick={() => { if (!active) navigate(to); }}
            className={`h-7 px-3 rounded-lg text-[11px] font-semibold flex items-center gap-1.5
                        transition-colors
              ${active
                ? 'bg-surface text-ink shadow-sm'
                : 'text-muted hover:text-ink'}`}>
            {Icon && <Icon size={12} />}
            {label}
          </button>
        );
      })}
    </div>
  );
}
