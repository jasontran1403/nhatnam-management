/**
 * codemod-theme.mjs — chuyển toàn bộ mã màu cứng sang design token.
 *
 * Chạy: node codemod-theme.mjs <thư-mục-src> [--dry]
 *
 * Nguyên tắc cốt lõi: MỘT mã hex có thể mang HAI vai trò khác nhau.
 * Ví dụ #1C1C1E vừa là màu chữ chính (text-[#1C1C1E]) vừa là nền sidebar
 * (bg-[#1C1C1E]). Ở dark mode màu chữ phải lật thành kem, còn nền sidebar
 * phải ở lại tối. Nếu map mù theo hex, sidebar sẽ hoá màu kem.
 * => Bảng tra được chia theo TIỀN TỐ utility (text-/bg-/border-), không theo hex.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.argv[2] || './src';
const DRY = process.argv.includes('--dry');

/* ── Bảng tra ────────────────────────────────────────────────────────────── */

// Chữ, icon, viền-chữ: giá trị LẬT khi sang dark.
const CONTENT = {
  '#1C1C1E': 'ink', '#333': 'ink', '#1A1A2E': 'ink', '#2D2D44': 'ink',
  '#5C5C5C': 'ink-2', '#5A5548': 'ink-2', '#5C4E3D': 'ink-2', '#555': 'ink-2',
  '#6B7280': 'ink-2', '#9C9C9C': 'muted',
  '#8E8878': 'muted', '#A8A090': 'muted', '#B0A898': 'muted', '#9CA3AF': 'muted',
  '#AAA': 'faint', '#C4B9A8': 'faint', '#D3CFC8': 'faint', '#B0A090': 'faint',
  '#C9A84C': 'gold', '#F5C842': 'gold', '#FFD97D': 'gold',
  '#B8963D': 'gold-strong', '#B8923E': 'gold-strong', '#B8963E': 'gold-strong',
  '#B69842': 'gold-strong', '#B8943C': 'gold-strong', '#B8973D': 'gold-strong',
  '#A07830': 'gold-deep', '#92681A': 'gold-deep', '#8B6F2E': 'gold-deep',
  '#8A6D1F': 'gold-deep', '#8B5A00': 'gold-deep', '#E8A020': 'gold-deep',
  '#1A2B1A': 'forest', '#243824': 'forest', '#243524': 'forest', '#2A3B2A': 'forest',
  '#7CB87C': 'forest',
  '#FAF7F2': 'canvas', '#FFF': 'surface', '#FFFFFF': 'surface',
  '#F0EBE3': 'line-soft', '#E8DDD0': 'line',
  '#FDF8ED': 'gold-tint',
  '#16A34A': 'success', '#1A9E4A': 'success', '#10B981': 'success', '#15803D': 'success',
  '#EA580C': 'warning', '#F97316': 'warning', '#F59E0B': 'warning', '#EAB308': 'warning',
  '#DC2626': 'danger', '#EF4444': 'danger',
  '#0284C7': 'info', '#3B82F6': 'info', '#2563EB': 'info', '#06B6D4': 'info',
  '#1A3C6E': 'info', '#1A2744': 'info',
};

// Nền, gradient: giá trị đi theo vai trò BỀ MẶT.
const SURFACE = {
  '#FFFFFF': 'surface', '#FFF': 'surface', '#FAFAF8': 'surface',
  '#FAF7F2': 'canvas', '#FBF7F0': 'canvas', '#FAF8F3': 'canvas',
  '#F0EBE3': 'surface-2', '#F5F0EB': 'surface-2', '#F5F0E8': 'surface-2',
  '#F3F0EB': 'surface-2', '#F0E9DF': 'surface-2', '#EDE8E0': 'surface-2',
  '#EFE7DA': 'surface-2', '#E8E2D8': 'surface-2', '#E8E0D6': 'surface-2',
  '#E8DDD0': 'surface-3', '#D8D0C8': 'surface-3', '#D0C9BE': 'surface-3',
  '#C4B9A8': 'faint',
  '#FDF8ED': 'gold-tint',
  // Bề mặt tối cố định — KHÔNG lật ở dark mode.
  '#1C1C1E': 'chrome', '#1A1A2E': 'chrome', '#2D2D44': 'chrome',
  '#1A2B1A': 'forest-deep', '#243824': 'forest-mid', '#243524': 'forest-mid',
  '#2A3B2A': 'forest-mid',
  '#E8F0E8': 'surface-2', '#D8E8D8': 'surface-3',
  '#C9A84C': 'gold', '#B8963D': 'gold-strong', '#B8923E': 'gold-strong',
  '#B69842': 'gold-strong', '#B8963E': 'gold-strong', '#B8943C': 'gold-strong',
  '#A07830': 'gold-deep',
  '#8E8878': 'muted', '#1C1C1E_': 'chrome',
  '#16A34A': 'success', '#10B981': 'success', '#EA580C': 'warning',
  '#DC2626': 'danger', '#EF4444': 'danger', '#0284C7': 'info', '#3B82F6': 'info',
};

// Viền, ring, divide.
const BORDER = {
  '#E8DDD0': 'line', '#E8E0D6': 'line', '#E8E2D8': 'line', '#D3CFC8': 'line',
  '#D8D0C8': 'line', '#D0C9BE': 'line', '#E5E7EB': 'line',
  '#F0EBE3': 'line-soft', '#F5F0EB': 'line-soft', '#F3F0EB': 'line-soft',
  '#EDE8E0': 'line-soft', '#F0E9DF': 'line-soft', '#EFE7DA': 'line-soft',
  '#C9A84C': 'gold', '#B8963D': 'gold-strong', '#A07830': 'gold-deep',
  '#FDF8ED': 'gold-tint',
  '#1C1C1E': 'chrome', '#1A2B1A': 'forest-deep', '#243824': 'forest-mid',
  '#8E8878': 'muted', '#C4B9A8': 'faint', '#FFFFFF': 'surface', '#FFF': 'surface',
  '#FAF7F2': 'canvas',
  '#16A34A': 'success', '#EA580C': 'warning', '#DC2626': 'danger',
  '#EF4444': 'danger', '#0284C7': 'info', '#3B82F6': 'info',
};

// Tiền tố utility → bảng nào
const PREFIX_TABLE = {
  text: CONTENT, fill: CONTENT, stroke: CONTENT, placeholder: CONTENT,
  accent: CONTENT, caret: CONTENT, decoration: CONTENT,
  bg: SURFACE, from: SURFACE, via: SURFACE, to: SURFACE, shadow: SURFACE,
  border: BORDER, ring: BORDER, divide: BORDER, outline: BORDER,
};
// border-t-[#..], border-x-[#..] ...
for (const side of ['t', 'r', 'b', 'l', 'x', 'y', 's', 'e']) {
  PREFIX_TABLE[`border-${side}`] = BORDER;
  PREFIX_TABLE[`divide-${side}`] = BORDER;
}

// Thuộc tính CSS trong style={{...}} → bảng nào
const CSS_PROP_TABLE = {
  color: CONTENT, fill: CONTENT, stroke: CONTENT, stopColor: CONTENT,
  caretColor: CONTENT, textDecorationColor: CONTENT, accentColor: CONTENT,
  background: SURFACE, backgroundColor: SURFACE, boxShadow: SURFACE,
  borderColor: BORDER, borderTopColor: BORDER, borderBottomColor: BORDER,
  borderLeftColor: BORDER, borderRightColor: BORDER, outlineColor: BORDER,
};

// Lớp xám mặc định của Tailwind → token thương hiệu (giữ tông ấm nhất quán)
const NEUTRAL_MAP = {
  'bg-white': 'bg-surface', 'text-white': null, // text-white giữ nguyên (nằm trên nền tối)
  'bg-gray-50': 'bg-canvas', 'bg-gray-100': 'bg-surface-2', 'bg-gray-200': 'bg-surface-3',
  'bg-gray-300': 'bg-surface-3',
  'bg-slate-50': 'bg-canvas', 'bg-slate-100': 'bg-surface-2', 'bg-stone-50': 'bg-canvas',
  'text-gray-900': 'text-ink', 'text-gray-800': 'text-ink', 'text-gray-700': 'text-ink-2',
  'text-gray-600': 'text-ink-2', 'text-gray-500': 'text-muted', 'text-gray-400': 'text-faint',
  'text-gray-300': 'text-faint',
  'text-slate-700': 'text-ink-2', 'text-slate-600': 'text-ink-2', 'text-slate-500': 'text-muted',
  'text-stone-500': 'text-muted',
  'border-gray-50': 'border-line-soft', 'border-gray-100': 'border-line-soft',
  'border-gray-200': 'border-line', 'border-stone-200': 'border-line',
  'ring-gray-200': 'ring-line', 'ring-slate-200': 'ring-line',
};

// black/N và white/N → hairline token (black/5 vô hình trên nền tối)
const ALPHA_MAP = {
  'black/5': 'hairline', 'black/10': 'hairline-2', 'black/15': 'hairline-3',
  'black/20': 'hairline-3',
};

// Lớp trạng thái ngữ nghĩa cần thêm biến thể dark
const SEM_COLORS = 'red|rose|emerald|green|amber|orange|blue|sky|indigo|violet|purple|cyan|teal|yellow|lime|pink|fuchsia';
const DARK_TINT = { 50: '10', 100: '18', 200: '28', 300: '35' };

/* ── Bộ biến đổi ─────────────────────────────────────────────────────────── */

const stats = {};
const bump = (k) => { stats[k] = (stats[k] || 0) + 1; };

/** text-[#8E8878] → text-muted  |  bg-[#C9A84C]/10 → bg-gold/10 */
function rewriteArbitraryHex(src) {
  return src.replace(
    /\b((?:[a-z]+)(?:-[a-z])?)-\[(#[0-9A-Fa-f]{3,6})\]/g,
    (whole, prefix, hex) => {
      const table = PREFIX_TABLE[prefix];
      if (!table) return whole;
      const token = table[hex.toUpperCase()];
      if (!token) return whole;
      bump(`${prefix}-[hex] → ${prefix}-${token}`);
      return `${prefix}-${token}`;
    }
  );
}

/** bg-white → bg-surface, text-gray-500 → text-muted ... */
function rewriteNeutrals(src) {
  let out = src;
  for (const [from, to] of Object.entries(NEUTRAL_MAP)) {
    if (!to) continue;
    const re = new RegExp(`(?<![\\w-])${from}(?![\\w-])`, 'g');
    out = out.replace(re, () => { bump(`${from} → ${to}`); return to; });
  }
  return out;
}

/** border-black/5 → border-hairline (không đụng tới bg-black/50 làm lớp phủ) */
function rewriteAlphaBlack(src) {
  return src.replace(
    /\b(border|ring|divide|outline|bg)(-[trblxyse])?-(black\/(?:5|10|15|20))(?![\d])/g,
    (whole, prefix, side, key) => {
      const token = ALPHA_MAP[key];
      if (!token) return whole;
      // bg-black/5 và /10 là ô chia, nền chìm — cũng nên đổi
      bump(`${prefix}-${key} → ${prefix}-${token}`);
      return `${prefix}${side || ''}-${token}`;
    }
  );
}

/**
 * bg-emerald-50 → bg-emerald-50 dark:bg-emerald-500/10
 * Các chip trạng thái dùng thang màu mặc định của Tailwind; nền -50 trên giao
 * diện tối sáng chói. Thêm biến thể dark thay vì đổi hẳn, để light giữ nguyên.
 */
function addDarkSemanticVariants(src) {
  const re = new RegExp(
    `(?<![\\w-])(bg|text|ring|border|divide|from|to)(-[trblxyse])?-(${SEM_COLORS})-(50|100|200|300|600|700|800|900)(\\/[0-9]+)?(?![\\w-])`,
    'g'
  );
  return src.replace(re, (whole, prefix, side, color, shade, alpha, offset, full) => {
    if (alpha) return whole;                       // đã có alpha, để yên
    // Đã có biến thể dark ngay cạnh thì bỏ qua
    const after = full.slice(offset + whole.length, offset + whole.length + 40);
    if (/^\s+dark:/.test(after)) return whole;
    const s = Number(shade);
    const side_ = side || '';
    if (s <= 300) {
      const tint = DARK_TINT[s];
      if (!tint) return whole;
      // Nền/viền nhạt → nền mờ cùng tông trên nền tối
      if (prefix === 'text') {
        bump(`text-${color}-${shade} + dark`);
        return `${whole} dark:text-${color}-${s <= 100 ? 200 : 300}`;
      }
      bump(`${prefix}-${color}-${shade} + dark`);
      return `${whole} dark:${prefix}${side_}-${color}-500/${tint}`;
    }
    // Chữ đậm (600–900) → sáng lên trên nền tối; nền đậm giữ nguyên (vẫn đọc tốt)
    if (prefix === 'text') {
      bump(`text-${color}-${shade} + dark`);
      return `${whole} dark:text-${color}-300`;
    }
    if (prefix === 'border' || prefix === 'ring' || prefix === 'divide') {
      bump(`${prefix}-${color}-${shade} + dark`);
      return `${whole} dark:${prefix}${side_}-${color}-500/40`;
    }
    return whole;
  });
}

/** style={{ color: '#8E8878' }} → style={{ color: 'var(--c-muted)' }} */
function rewriteInlineStyleHex(src) {
  return src.replace(
    /\b([A-Za-z]+)(\s*:\s*)(['"`])(#[0-9A-Fa-f]{3,6})\3/g,
    (whole, prop, sep, q, hex) => {
      const table = CSS_PROP_TABLE[prop];
      if (!table) return whole;
      const token = table[hex.toUpperCase()];
      if (!token) return whole;
      bump(`style ${prop}: hex → var`);
      return `${prop}${sep}${q}var(--c-${token})${q}`;
    }
  );
}

/** fill="#C9A84C" / stroke="#..." trên thẻ SVG */
function rewriteSvgAttrHex(src) {
  return src.replace(
    /\b(fill|stroke|stopColor|stop-color)=(["'])(#[0-9A-Fa-f]{3,6})\2/g,
    (whole, attr, q, hex) => {
      const token = CONTENT[hex.toUpperCase()];
      if (!token) return whole;
      bump(`attr ${attr} → var`);
      return `${attr}=${q}var(--c-${token})${q}`;
    }
  );
}

const TRANSFORMS = [
  rewriteArbitraryHex,
  rewriteAlphaBlack,
  rewriteNeutrals,
  rewriteInlineStyleHex,
  rewriteSvgAttrHex,
  addDarkSemanticVariants,
];

/* ── Chạy ────────────────────────────────────────────────────────────────── */

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (['node_modules', '.git', 'styles'].includes(e.name)) continue;
      walk(p, acc);
    } else if (/\.(jsx?|tsx?)$/.test(e.name)) {
      acc.push(p);
    }
  }
  return acc;
}

const files = walk(ROOT);
let changed = 0;

for (const file of files) {
  const before = fs.readFileSync(file, 'utf8');
  let after = before;
  for (const fn of TRANSFORMS) after = fn(after);
  if (after !== before) {
    changed++;
    if (!DRY) fs.writeFileSync(file, after);
  }
}

const total = Object.values(stats).reduce((a, b) => a + b, 0);
console.log(`${DRY ? '[thử]' : '[đã ghi]'} ${changed}/${files.length} file · ${total} thay thế`);
const top = Object.entries(stats).sort((a, b) => b[1] - a[1]).slice(0, 25);
for (const [k, v] of top) console.log(String(v).padStart(6), k);
