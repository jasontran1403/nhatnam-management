/**
 * BrandLogo — khối tên thương hiệu, dùng chung cho mọi layout.
 *
 * Trước đây đoạn markup này được chép nguyên ở AppLayout, SellerLayout và
 * WarehouseLayout, mỗi nơi một cỡ chữ khác nhau, kèm tên công ty viết cứng.
 * Đổi tên công ty phải sửa 6 chỗ và chắc chắn sót một chỗ.
 *
 * Mọi chữ lấy từ src/config/brand.js.
 */
import { BRAND } from '../../config/brand';

const SIZE = {
  // Dùng trong sidebar rộng
  md: { name: 'text-lg', suffix: 'text-xs' },
  // Dùng trong sidebar hẹp
  sm: { name: 'text-base', suffix: 'text-[10px]' },
};

/**
 * @param {'md'|'sm'} size
 * @param {boolean} inline  true = một dòng "Nhất Nam Fine Foods" (thanh trên mobile)
 */
export default function BrandLogo({ size = 'md', inline = false, className = '' }) {
  if (inline) {
    return (
      <span
        className={`text-white text-sm font-bold ${className}`}
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {BRAND.fullName}
      </span>
    );
  }

  const s = SIZE[size] || SIZE.md;

  return (
    <div className={className}>
      <h1
        className={`text-white font-bold ${s.name} leading-tight`}
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {BRAND.name}
      </h1>
      <p className={`text-gold ${s.suffix} tracking-widest uppercase mt-0.5`}>
        {BRAND.suffix}
      </p>
    </div>
  );
}
