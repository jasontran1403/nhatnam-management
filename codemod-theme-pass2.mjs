/**
 * codemod-theme-pass2.mjs — dọn nốt mã hex còn sót.
 *
 * Pass 1 chỉ xử lý được hex đứng riêng làm giá trị (color: '#fff').
 * Pass 2 xử lý hex nằm LỒNG trong chuỗi CSS ghép:
 *     border: '1px solid #E8DDD0'   →  border: '1px solid var(--c-line)'
 *     { bg: '#fee2e2', color: '#b91c1c' }   (khoá tự đặt, không phải thuộc tính CSS)
 *
 * Ở đây không còn phân biệt được vai trò theo tiền tố, nên dùng một bảng
 * chung — chấp nhận được vì các hex còn lại đều là màu trạng thái hoặc đường kẻ,
 * không có ca "vừa là chữ vừa là nền" như #1C1C1E.
 *
 * Chạy: node codemod-theme-pass2.mjs <thư-mục-src>
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.argv[2] || './src';

const MAP = {
  // Nền / bề mặt
  '#FFFFFF': 'surface', '#FFF': 'surface', '#FAFAFA': 'surface-2',
  '#FAF7F2': 'canvas', '#F3F0EB': 'surface-2', '#F0EBE3': 'surface-2',
  '#F5F0EB': 'surface-2', '#FAFAF8': 'surface',
  // Đường kẻ
  '#E8E2D8': 'line', '#E8DDD0': 'line', '#E5E7EB': 'line', '#D3CFC8': 'line',
  // Chữ
  '#1C1C1E': 'ink', '#333': 'ink', '#5C5C5C': 'ink-2', '#5C4E3D': 'ink-2',
  '#555': 'ink-2', '#6B7280': 'ink-2',
  '#8E8878': 'muted', '#9CA3AF': 'muted', '#9C9C9C': 'muted', '#AAA': 'faint',
  '#C4B9A8': 'faint',
  // Thương hiệu
  '#C9A84C': 'gold', '#B8973D': 'gold-strong', '#B8963D': 'gold-strong',
  '#B8923E': 'gold-strong', '#A07830': 'gold-deep', '#FDF8ED': 'gold-tint',
  '#1A2B1A': 'forest-deep', '#243824': 'forest-mid',
  // Trạng thái — thang Tailwind thô mà code cũ chép tay
  '#16A34A': 'success', '#10B981': 'success', '#22C55E': 'success',
  '#DCFCE7': 'success-tint', '#D1FAE5': 'success-tint', '#ECFDF5': 'success-tint',
  '#15803D': 'success-ink', '#166534': 'success-ink', '#047857': 'success-ink',
  '#EA580C': 'warning', '#F97316': 'warning', '#F59E0B': 'warning', '#EAB308': 'warning',
  '#FFEDD5': 'warning-tint', '#FEF3C7': 'warning-tint', '#FFFBEB': 'warning-tint',
  '#C2410C': 'warning-ink', '#9A3412': 'warning-ink', '#B45309': 'warning-ink',
  '#DC2626': 'danger', '#EF4444': 'danger',
  '#FEE2E2': 'danger-tint', '#FEF2F2': 'danger-tint',
  '#B91C1C': 'danger-ink', '#991B1B': 'danger-ink',
  '#0284C7': 'info', '#3B82F6': 'info', '#2563EB': 'info', '#06B6D4': 'info',
  '#E0F2FE': 'info-tint', '#EFF6FF': 'info-tint',
  '#0369A1': 'info-ink', '#1D4ED8': 'info-ink',
  '#1A3C6E': 'steel', '#1A2744': 'steel', '#EBF3FB': 'steel-tint', '#F5F8FF': 'steel-tint',
};

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (['node_modules', '.git', 'styles'].includes(e.name)) continue;
      walk(p, acc);
    } else if (/\.(jsx?|tsx?)$/.test(e.name)) acc.push(p);
  }
  return acc;
}

let files = walk(ROOT), changed = 0, n = 0;

for (const file of files) {
  const before = fs.readFileSync(file, 'utf8');
  // Chỉ thay hex nằm TRONG chuỗi nháy — không đụng tới comment hay className
  // (className đã được pass 1 xử lý hết dạng `text-[#...]`).
  const after = before.replace(/(['"`])([^'"`\n]*?#[0-9A-Fa-f]{3,6}\b[^'"`\n]*?)\1/g, (whole, q, body) => {
    const next = body.replace(/#[0-9A-Fa-f]{3,6}\b/g, (hex) => {
      const token = MAP[hex.toUpperCase()];
      if (!token) return hex;
      n++;
      return `var(--c-${token})`;
    });
    return `${q}${next}${q}`;
  });
  if (after !== before) { changed++; fs.writeFileSync(file, after); }
}

console.log(`[pass2] ${changed} file · ${n} thay thế`);
