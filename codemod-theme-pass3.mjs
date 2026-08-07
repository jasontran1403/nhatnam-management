/**
 * codemod-theme-pass3.mjs — gom các mã hex "lệch một chút".
 *
 * Sau 2 pass đầu còn lại vài chục mã kiểu #b8953f, #A58832, #D8CFC2 — thực chất
 * là cùng một màu thương hiệu nhưng ai đó gõ lệch vài đơn vị. Pass này đo
 * khoảng cách màu trong không gian Lab và gộp về token gần nhất, chỉ khi đủ gần
 * (ΔE < 12) để không gộp nhầm hai màu thật sự khác nhau.
 *
 * Chạy: node codemod-theme-pass3.mjs <thư-mục-src> [--dry]
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.argv[2] || './src';
const DRY = process.argv.includes('--dry');
const THRESHOLD = 12;

// Giá trị LIGHT của từng token — mốc để so khoảng cách.
const TOKENS = {
  canvas: '#FAF7F2', surface: '#FFFFFF', 'surface-2': '#F0EBE3', 'surface-3': '#E8DDD0',
  chrome: '#1C1C1E', 'forest-deep': '#1A2B1A', 'forest-mid': '#243824',
  ink: '#1C1C1E', 'ink-2': '#5C5C5C', muted: '#8E8878', faint: '#C4B9A8',
  line: '#E8DDD0', 'line-soft': '#F0EBE3',
  gold: '#C9A84C', 'gold-strong': '#B8963D', 'gold-deep': '#A07830', 'gold-tint': '#FDF8ED',
  success: '#16A34A', 'success-tint': '#DCFCE7', 'success-ink': '#15803D',
  warning: '#EA580C', 'warning-tint': '#FFEDD5', 'warning-ink': '#9A3412',
  danger: '#DC2626', 'danger-tint': '#FEE2E2', 'danger-ink': '#B91C1C',
  info: '#0284C7', 'info-tint': '#E0F2FE', 'info-ink': '#0369A1',
  steel: '#1A3C6E', 'steel-tint': '#EBF3FB',
};

// Token nào hợp lệ cho tiền tố nào — tránh biến nền sidebar thành màu chữ.
const SURFACE_OK = new Set(['canvas', 'surface', 'surface-2', 'surface-3', 'chrome',
  'forest-deep', 'forest-mid', 'gold', 'gold-strong', 'gold-deep', 'gold-tint',
  'success', 'success-tint', 'warning', 'warning-tint', 'danger', 'danger-tint',
  'info', 'info-tint', 'steel', 'steel-tint', 'faint', 'muted']);
const CONTENT_OK = new Set(['ink', 'ink-2', 'muted', 'faint', 'gold', 'gold-strong',
  'gold-deep', 'success', 'success-ink', 'warning', 'warning-ink', 'danger',
  'danger-ink', 'info', 'info-ink', 'steel', 'canvas', 'surface']);
const BORDER_OK = new Set(['line', 'line-soft', 'gold', 'gold-strong', 'gold-deep',
  'muted', 'faint', 'chrome', 'success', 'warning', 'danger', 'info', 'steel',
  'surface', 'canvas', 'surface-3']);

const GROUP = {
  bg: SURFACE_OK, from: SURFACE_OK, via: SURFACE_OK, to: SURFACE_OK,
  text: CONTENT_OK, fill: CONTENT_OK, stroke: CONTENT_OK, placeholder: CONTENT_OK,
  accent: CONTENT_OK, caret: CONTENT_OK,
  border: BORDER_OK, ring: BORDER_OK, divide: BORDER_OK, outline: BORDER_OK,
};

/* ── Chuyển đổi màu ──────────────────────────────────────────────────────── */

function hexToRgb(h) {
  let s = h.replace('#', '');
  if (s.length === 3) s = s.split('').map(c => c + c).join('');
  return [0, 2, 4].map(i => parseInt(s.slice(i, i + 2), 16));
}

function rgbToLab([r, g, b]) {
  const f = (v) => { v /= 255; return v > 0.04045 ? ((v + 0.055) / 1.055) ** 2.4 : v / 12.92; };
  const [R, G, B] = [f(r), f(g), f(b)];
  const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const Y = (R * 0.2126 + G * 0.7152 + B * 0.0722) / 1.0;
  const Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const g_ = (t) => t > 0.008856 ? Math.cbrt(t) : (7.787 * t) + 16 / 116;
  const [fx, fy, fz] = [g_(X), g_(Y), g_(Z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

const LAB = Object.fromEntries(Object.entries(TOKENS).map(([k, v]) => [k, rgbToLab(hexToRgb(v))]));

function nearest(hex, allowed) {
  const lab = rgbToLab(hexToRgb(hex));
  let best = null, bestD = Infinity;
  for (const [name, l] of Object.entries(LAB)) {
    if (allowed && !allowed.has(name)) continue;
    const d = Math.hypot(lab[0] - l[0], lab[1] - l[1], lab[2] - l[2]);
    if (d < bestD) { bestD = d; best = name; }
  }
  return bestD <= THRESHOLD ? { token: best, d: bestD } : null;
}

/* ── Chạy ────────────────────────────────────────────────────────────────── */

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

const log = [];
let changed = 0;

for (const file of walk(ROOT)) {
  const before = fs.readFileSync(file, 'utf8');
  const after = before.replace(
    /\b((?:[a-z]+)(?:-[a-z])?)-\[(#[0-9A-Fa-f]{3,6})\]/g,
    (whole, prefix, hex) => {
      const base = prefix.split('-')[0];
      const hit = nearest(hex, GROUP[base]);
      if (!hit) return whole;
      log.push(`${whole} → ${prefix}-${hit.token} (ΔE ${hit.d.toFixed(1)})  ${path.relative(ROOT, file)}`);
      return `${prefix}-${hit.token}`;
    }
  );
  if (after !== before) { changed++; if (!DRY) fs.writeFileSync(file, after); }
}

console.log(`[pass3] ${changed} file · ${log.length} thay thế (ΔE ≤ ${THRESHOLD})`);
log.slice(0, 40).forEach(l => console.log('  ' + l));
