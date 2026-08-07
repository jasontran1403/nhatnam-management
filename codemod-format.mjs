/**
 * codemod-format.mjs — thay các định nghĩa formatter chép tay bằng import chung.
 *
 * CHỈ thay khi thân hàm khớp CHÍNH XÁC (sau khi chuẩn hoá khoảng trắng) với một
 * biến thể đã biết. Hàm nào lệch dù chỉ một ký tự thì để nguyên và ghi vào
 * danh sách cần xem tay — vì lệch ở đây thường có nghĩa là trang đó cố tình
 * hiển thị khác (ví dụ trả '0 đ' thay vì '—' khi trống), gộp bừa sẽ đổi giao diện.
 *
 * Chạy: node codemod-format.mjs <thư-mục-src> [--dry]
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.argv[2] || './src';
const DRY = process.argv.includes('--dry');

const norm = (s) => s.replace(/\s+/g, ' ').trim();

/**
 * Các thân hàm đã biết → tên export tương ứng trong utils/format.js.
 * Nguồn: 7 nhóm trùng nguyên văn phát hiện khi quét mã.
 */
const KNOWN = [
  ["function formatVND(n) { return new Intl.NumberFormat('vi-VN').format(n || 0) + ' đ'; }", 'formatVND'],
  ["function formatVND(n) { if (!n && n !== 0) return '0 đ'; return new Intl.NumberFormat('vi-VN').format(n) + ' đ'; }", 'formatVND'],
  ["const fmtVND = (n) => new Intl.NumberFormat('vi-VN').format(Number(n) || 0) + ' đ';", 'fmtVND'],
  ["function fmtQty(v) { return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 }).format(Number(v || 0)); }", 'fmtQty'],
].map(([body, name]) => [norm(body), name]);

const KNOWN_MAP = new Map(KNOWN);

/** Tách khối định nghĩa hàm/const bắt đầu ở dòng `start`, dựa vào cân bằng ngoặc. */
function extractBlock(lines, start) {
  let depth = 0;
  for (let i = start; i < Math.min(start + 14, lines.length); i++) {
    depth += (lines[i].match(/\{/g) || []).length - (lines[i].match(/\}/g) || []).length;
    const done = depth <= 0 && (lines[i].includes('}') || lines[i].trimEnd().endsWith(';'));
    if (done) return { end: i, text: lines.slice(start, i + 1).join('\n') };
  }
  return null;
}

function relImport(file) {
  const rel = path.relative(path.dirname(file), path.join(ROOT, 'utils/format.js'));
  return rel.startsWith('.') ? rel : './' + rel;
}

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (['node_modules', '.git', 'styles', 'config'].includes(e.name)) continue;
      walk(p, acc);
    } else if (/\.jsx?$/.test(e.name) && !p.endsWith('utils/format.js')) acc.push(p);
  }
  return acc;
}

const DEF_RE = /^(?:export\s+)?(?:const|function)\s+(fmt[A-Za-z]*|format[A-Za-z]*)\b/;

let replaced = 0, filesChanged = 0;
const review = [];

for (const file of walk(ROOT)) {
  const src = fs.readFileSync(file, 'utf8');
  const lines = src.split('\n');
  const kill = new Set();
  const needed = new Set();

  for (let i = 0; i < lines.length; i++) {
    const m = DEF_RE.exec(lines[i]);
    if (!m) continue;
    const blk = extractBlock(lines, i);
    if (!blk) continue;
    const name = KNOWN_MAP.get(norm(blk.text));
    if (name) {
      for (let j = i; j <= blk.end; j++) kill.add(j);
      needed.add(name === m[1] ? name : `${name} as ${m[1]}`);
      replaced++;
    } else {
      review.push(`${path.relative(ROOT, file)}:${i + 1}  ${m[1]}`);
    }
    i = blk.end;
  }

  if (!needed.size) continue;

  let out = lines.filter((_, i) => !kill.has(i));
  // Chèn import sau dòng import cuối cùng
  let lastImport = -1;
  for (let i = 0; i < out.length; i++) if (/^import .*;$/.test(out[i])) lastImport = i;
  const stmt = `import { ${[...needed].join(', ')} } from '${relImport(file)}';`;
  out.splice(lastImport + 1, 0, stmt);

  if (!DRY) fs.writeFileSync(file, out.join('\n'));
  filesChanged++;
}

console.log(`${DRY ? '[thử]' : '[đã ghi]'} ${filesChanged} file · gỡ ${replaced} định nghĩa trùng`);
console.log(`\nCòn ${review.length} formatter cục bộ cần xem tay (thân hàm khác biến thể chuẩn):`);
review.slice(0, 30).forEach((r) => console.log('  ' + r));
