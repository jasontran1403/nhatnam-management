/*
 * ACCOUNTANT BONUS VIEW PAGE — Kế Toán Trưởng xem thưởng tháng (10/2026)
 *
 * READ-ONLY. Mỗi phòng là 1 card tương tự owner. Fix 10/2026:
 *   1) Search: debounce + rAF + scrollIntoView, highlight border + padding
 *      ngang. scroll-margin-top chừa chỗ cho sticky bar.
 *   2) Bảng Tài xế: 2 bảng (Tài xế + Hỗ trợ) share colgroup → cột đều nhau.
 *      Áp cho MỌI bảng còn lại luôn — tất cả dùng helper BonusTable.
 *   3) MonthPicker: wrap SectionCard dùng `!overflow-visible` để dropdown
 *      tràn khỏi card.
 *   4) SALES: thêm cột "DT đang hold" + fetch `getCurrentSalesBonusV2` để
 *      hiển thị target / % target / đơn giá bước / tỷ lệ áp dụng.
 *   5) Factory: cột Trọng số + nhãn "Tổng tỷ trọng" (đã có sẵn trong KpiSummary).
 *   6) Số doanh thu BigDecimal hiển thị tối đa 2 chữ số thập phân — đồng bộ
 *      với UI owner, không lệch.
 *   7) Driver tổng → làm tròn LÊN bước 5.000.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Award, Download, Lock, Calculator, Gift, Truck, Users, Wallet, Search,
} from 'lucide-react';
import { PageHeader, SectionCard, LoadingSpinner, SecondaryButton } from '../../components/ui';
import { factoryPayrollApi } from '../../api/factoryPayrollApi';
import api from '../../api/axios';
import { useToast } from '../../components/common/Toast';
import { MonthPicker, KpiSummary } from '../owner/AttendanceSheetsPage';

// ── Helpers ────────────────────────────────────────────────────────────────
/** VND đã làm tròn về đồng (không hiển thị số lẻ) — khớp cách owner render.
 *  BE trả BigDecimal cho doanh thu → owner `Math.round` → KT phải làm y hệt
 *  để 2 bên không lệch nhau 1 đồng ở hàng đơn vị. */
const fmtVnd = (v) => {
  if (v == null || v === '') return '—';
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return Math.round(n).toLocaleString('vi-VN') + 'đ';
};
const fmtNum = (v, d = 2) => (v == null ? '—' :
  Number(v).toLocaleString('vi-VN', { maximumFractionDigits: d, minimumFractionDigits: 0 }));
const monthKeyOf = (m, y) => `${y}-${String(m).padStart(2, '0')}`;

/** Làm tròn LÊN step. */
const roundUpTo = (v, step) => {
  const n = Number(v) || 0;
  if (step <= 0) return n;
  return Math.ceil(n / step) * step;
};

/** Chuẩn hoá tiếng Việt về dạng không dấu, lowercase. */
const norm = (s) => (s || '').toString().toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');

/** NV có phải "hỗ trợ" của phòng (dựa roleLabel). */
function isSupportFor(dept, roleLabel) {
  const r = norm(roleLabel);
  if (!r) return false;
  if (dept === 'SALES')      return !r.includes('kinh doanh');
  if (dept === 'ACCOUNTING') return !r.includes('ke toan');
  return false;
}

const DEPTS = [
  { key: 'SALES',      label: 'Kinh doanh',     icon: Gift },
  { key: 'FACTORY',    label: 'Sản xuất',       icon: Calculator },
  { key: 'ACCOUNTING', label: 'Kế toán',        icon: Wallet },
  { key: 'WAREHOUSE',  label: 'Kho',            icon: Users },
  { key: 'DRIVER',     label: 'Tài xế',         icon: Truck },
];

function statusOf(all, key) {
  if (!all) return null;
  if (Array.isArray(all)) return all.find(s => s.department === key) || null;
  return all[key] || null;
}
function hasAnyStatus(s) {
  return s?.bonusCalcStatus === 'PUBLISHED' || s?.bonusCalcStatus === 'CALCULATED'
      || s?.calcStatus === 'PUBLISHED'       || s?.calcStatus === 'CALCULATED'
      || s?.kpiFinalized === true            || s?.bonusFinalized === true;
}

// ── CSS dùng chung cho bảng — divider dọc + scroll-margin cho search ──────
// (10/2026) Dùng cùng palette (hairline) với owner/attendance để nhất quán.
const CELL = 'px-4 py-2';
const HEAD_ROW = 'text-left text-[11px] uppercase tracking-wider text-muted border-b border-hairline';
const BODY_DIVIDER =
  '[&_tbody_td:not(:last-child)]:border-r [&_tbody_td]:border-hairline/30 ' +
  '[&_thead_th:not(:last-child)]:border-r [&_thead_th]:border-hairline/40';

// Row khớp search — bg gold-tint mềm + border accent gold, có cảm giác pill:
//   • Trước đây dùng outline + bg-yellow-100 → đổ sát cạnh tr, dính vào ô
//     content, màu vàng chói không hợp palette.
//   • Nay chuyển sang bg nhẹ + viền trên/dưới gold, bo góc 2 đầu để trông
//     như "chip" lồng trong bảng. First/last td cũng được padding nhẹ hơn
//     chuẩn CELL để tránh content chạm viền.
const HILITE_ROW =
  'bg-gold/15 dark:bg-gold/10 ' +
  '[&>td]:!border-y-2 [&>td]:!border-gold/60 ' +
  '[&>td:first-child]:!border-l-2 [&>td:first-child]:rounded-l-xl ' +
  '[&>td:last-child]:!border-r-2 [&>td:last-child]:rounded-r-xl';
// scroll-margin-top chừa chỗ cho sticky header (search bar + tabs ~ 160px).
const SCROLL_MARGIN = { scrollMarginTop: '160px' };

// ── Debounce hook ─────────────────────────────────────────────────────────
function useDebounced(value, delay = 200) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

/** Scroll vào giữa + smooth, defer qua rAF sau khi lớp highlight đã apply. */
function scrollRowToCenter(el) {
  if (!el) return;
  requestAnimationFrame(() => {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}

function useScrollToFirstMatch(matchedIds, rowRefs, deps = []) {
  useEffect(() => {
    if (!matchedIds.length) return;
    scrollRowToCenter(rowRefs.current[matchedIds[0]]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchedIds.join(','), ...deps]);
}

// ── Shared placeholder ─────────────────────────────────────────────────────
function PendingNotice({ deptLabel, note }) {
  return (
    <div className="p-10 text-center text-muted">
      <Lock size={22} className="mx-auto mb-2 opacity-60" />
      <p className="text-sm">Phòng <b>{deptLabel}</b> đang tính toán…</p>
      <p className="text-xs mt-1">{note || 'Chỉ hiển thị khi phòng đã chốt thưởng.'}</p>
    </div>
  );
}

// (10/2026) Dòng tổng dưới cùng — DÙNG CHUNG cho MỌI tab (SALES, ACCOUNTING,
// WAREHOUSE, DRIVER, FACTORY) để UI đồng bộ. Box emerald bo tròn, viền nhẹ,
// margin trong card (mx-5 mb-5) để không chạm viền SectionCard.
function TotalFooter({ label, amount, count }) {
  return (
    <div className="mx-5 mb-5 mt-3 px-4 py-3 rounded-xl
                    bg-emerald-50/60 dark:bg-emerald-500/5
                    border border-emerald-200 dark:border-emerald-500/28
                    flex justify-between items-center gap-3 flex-wrap text-sm">
      <span className="uppercase font-bold tracking-wider text-xs
                       text-emerald-700 dark:text-emerald-300">
        {label}{count != null ? ` (${count} người)` : ''}
      </span>
      <b className="text-base text-emerald-700 dark:text-emerald-300 tabular-nums">
        {typeof amount === 'number'
          ? Math.round(amount).toLocaleString('vi-VN') + 'đ'
          : amount}
      </b>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// SALES / ACCOUNTING card
// ══════════════════════════════════════════════════════════════════════════
function OfficeBonusCard({ department, departmentLabel, month, year, search }) {
  const [data, setData] = useState(null);
  const [salesV2, setSalesV2] = useState(null);
  const [loading, setLoading] = useState(true);
  const rowRefs = useRef({});
  const toast = useToast();

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const base = factoryPayrollApi.officeBonusPreview(month, year, department)
      .then(d => { if (alive) setData(d); })
      .catch(e => toast(e?.response?.data?.message || 'Không tải được', 'error'));
    const extra = department === 'SALES'
      ? factoryPayrollApi.getCurrentSalesBonusV2(month, year)
          .then(d => { if (alive) setSalesV2(d); })
          .catch(() => { if (alive) setSalesV2(null); })
      : Promise.resolve();
    Promise.all([base, extra]).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [department, month, year, toast]);

  const items = data?.items || [];
  const q = norm(search);
  const matchedIds = useMemo(
    () => q ? items.filter(i => norm(i.userFullName).includes(q)).map(i => i.userId) : [],
    [items, q],
  );
  useScrollToFirstMatch(matchedIds, rowRefs);

  if (loading) return <div className="py-10 flex justify-center"><LoadingSpinner /></div>;
  if (!data) return <p className="p-6 text-sm text-muted text-center">Không có dữ liệu.</p>;
  if (!data.commissionCalculated) {
    return <SectionCard><PendingNotice deptLabel={departmentLabel} /></SectionCard>;
  }

  const isSales = department === 'SALES';
  const totalBonus = items.reduce((s, i) => s + (i.bonusAmount || 0), 0);
  const mains = items.filter(i => !isSupportFor(department, i.roleLabel));
  const supports = items.filter(i => isSupportFor(department, i.roleLabel));

  // ── Header + 3 ô số tổng ────────────────────────────────────────────────
  const headerBar = (
    <>
      <div className="flex items-center justify-between px-5 py-4 border-b border-hairline">
        <div className="flex items-center gap-2">
          <Gift size={16} className="text-gold" />
          <h3 className="text-sm font-bold text-ink">
            Bonus của {departmentLabel} · Tháng {String(month).padStart(2, '0')}/{year}
          </h3>
        </div>
        {data.computedAt && (
          <span className="text-[11px] text-muted">
            Tính lúc {new Date(data.computedAt).toLocaleString('vi-VN')}
            {data.computedByName && ` · ${data.computedByName}`}
          </span>
        )}
      </div>
      <div className="p-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl px-4 py-3 bg-canvas border border-transparent">
          <p className="text-[11px] text-muted font-medium uppercase tracking-wider">
            Tổng doanh thu T{String(month).padStart(2, '0')}/{year}
          </p>
          <p className="text-lg font-bold mt-0.5 text-ink">{fmtVnd(data.totalMonthOrderRevenue)}</p>
          <p className="text-[10px] text-muted mt-1">Σ các đơn tạo trong tháng (EX-VAT)</p>
        </div>
        <div className="rounded-xl px-4 py-3 bg-amber-50/60 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/28">
          <p className="text-[11px] text-amber-700 dark:text-amber-300 font-medium uppercase tracking-wider">
            Doanh thu đang hold
          </p>
          <p className="text-lg font-bold mt-0.5 text-amber-800 dark:text-amber-200">{fmtVnd(data.totalHoldRevenue)}</p>
          <p className="text-[10px] text-muted mt-1">Σ (final − paid), chưa COMPLETED</p>
        </div>
        <div className="rounded-xl px-4 py-3 bg-emerald-50/60 dark:bg-emerald-500/5 border border-emerald-200 dark:border-emerald-500/28">
          <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium uppercase tracking-wider">
            Doanh thu được chia hoa hồng
          </p>
          <p className="text-lg font-bold mt-0.5 text-emerald-800 dark:text-emerald-200">{fmtVnd(data.totalCollectedRevenue)}</p>
          <p className="text-[10px] text-muted mt-1">Σ thực thu EX-VAT + waived</p>
        </div>
      </div>
    </>
  );

  // ── Config bar (SALES: target / step / multiplier, ACCOUNTING: %) ───────
  const configBar = (() => {
    if (isSales && salesV2) {
      const achievedPct = salesV2.target && salesV2.target > 0
        ? (Number(salesV2.deptRevenue || 0) / Number(salesV2.target)) * 100
        : null;
      return (
        <div className="mx-5 mb-3 rounded-xl bg-canvas border border-hairline px-4 py-3 text-[12px] space-y-1">
          <div className="flex items-center gap-6 flex-wrap">
            <span><b className="text-ink">Target doanh thu:</b> {fmtVnd(salesV2.target)}</span>
            {achievedPct != null && (
              <span>
                <b className="text-ink">Đạt:</b>{' '}
                <span className={achievedPct >= 100 ? 'text-emerald-600 font-semibold' : 'text-blue-600 font-semibold'}>
                  {fmtNum(achievedPct, 2)}%
                </span>
              </span>
            )}
            {salesV2.stepAmount != null && salesV2.stepUnitPrice != null && (
              <span>
                <b className="text-ink">Mỗi {fmtVnd(salesV2.stepAmount)} = {fmtVnd(salesV2.stepUnitPrice)}</b> / bước
              </span>
            )}
            {salesV2.multiplier != null && (
              <span>· áp dụng <b className="text-gold">{fmtNum(salesV2.multiplier * 100, 0)}%</b></span>
            )}
          </div>
          {Array.isArray(salesV2.tiers) && salesV2.tiers.length > 0 && (
            <div className="text-muted">
              <b className="text-ink">Mốc ladder:</b>{' '}
              {salesV2.tiers.map((t, i) => (
                <span key={i} className="mr-3">
                  ≥ {t.thresholdPercent}% → {t.pricePercent}%
                </span>
              ))}
            </div>
          )}
        </div>
      );
    }
    if (!isSales && data.accountingPercent != null) {
      return (
        <div className="px-5 pb-3 text-[12px] text-muted">
          <b className="text-ink">Phòng:</b> {fmtNum(data.accountingPercent, 2)}% doanh thu
          — chia theo tỉ lệ từng người.
        </div>
      );
    }
    return null;
  })();

  // ── Bảng NV (dùng chung widths cho main + support) ──────────────────────
  // (10/2026) SALES thêm cột "DT tính HH" (collected = thực thu EX-VAT + waived) —
  // giống owner/attendance → 6 cột tổng cộng.
  const salesCols = (
    <colgroup>
      <col style={{ width: '22%' }} />
      <col style={{ width: '15%' }} />
      <col style={{ width: '17%' }} />
      <col style={{ width: '15%' }} />
      <col style={{ width: '15%' }} />
      <col style={{ width: '16%' }} />
    </colgroup>
  );
  const accCols = (
    <colgroup>
      <col style={{ width: '32%' }} />
      <col style={{ width: '24%' }} />
      <col style={{ width: '22%' }} />
      <col style={{ width: '22%' }} />
    </colgroup>
  );
  const colGroup = isSales ? salesCols : accCols;
  const colCount = isSales ? 6 : 4;

  const headerRow = (
    <tr className={HEAD_ROW}>
      <th className={`${CELL} font-semibold`}>Nhân viên</th>
      <th className={`${CELL} font-semibold`}>Chức vụ</th>
      {isSales
        ? <>
            <th className={`${CELL} text-right font-semibold`}>DT cá nhân</th>
            <th className={`${CELL} text-right font-semibold`}>DT đang hold</th>
            <th className={`${CELL} text-right font-semibold`}>DT tính HH</th>
          </>
        : <th className={`${CELL} text-right font-semibold`}>Tỉ lệ</th>}
      <th className={`${CELL} text-right font-semibold`}>Hoa hồng</th>
    </tr>
  );

  const renderRow = (i) => {
    const highlight = matchedIds.includes(i.userId);
    return (
      <tr
        key={i.userId}
        ref={(el) => { if (el) rowRefs.current[i.userId] = el; }}
        style={SCROLL_MARGIN}
        className={`border-b border-hairline/40 last:border-0 transition-colors ${highlight ? HILITE_ROW : ''}`}>
        <td className={`${CELL} text-ink`}>{i.userFullName}</td>
        <td className={`${CELL} text-muted`}>{i.roleLabel || '—'}</td>
        {isSales ? (
          <>
            <td className={`${CELL} text-right text-ink`}>{fmtVnd(i.totalMonthOrderRevenue)}</td>
            <td className={`${CELL} text-right text-amber-700 dark:text-amber-300`}>{fmtVnd(i.totalHoldRevenue)}</td>
            <td className={`${CELL} text-right text-ink`}>
              {fmtVnd(i.totalCollectedRevenue)}
              {i.transactionCount > 0 && (
                <div className="text-[10px] text-muted font-normal">({i.transactionCount} phiếu)</div>
              )}
            </td>
          </>
        ) : (
          <td className={`${CELL} text-right text-ink`}>
            {i.ratioPercent != null ? `${fmtNum(i.ratioPercent, 2)}%` : '—'}
          </td>
        )}
        <td className={`${CELL} text-right font-semibold text-emerald-700 dark:text-emerald-300`}>
          {fmtVnd(i.bonusAmount)}
        </td>
      </tr>
    );
  };

  return (
    <SectionCard>
      {headerBar}
      {configBar}

      <div className="px-5 pb-3 overflow-x-auto">
        <table className={`w-full text-sm table-fixed ${BODY_DIVIDER}`}>
          {colGroup}
          <thead>{headerRow}</thead>
          <tbody>
            {mains.length === 0 && (
              <tr><td colSpan={colCount} className="py-6 text-center text-muted">Không có nhân viên.</td></tr>
            )}
            {mains.map(renderRow)}
          </tbody>
        </table>
      </div>

      {supports.length > 0 && (
        <div className="px-5 pb-3 overflow-x-auto">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted mb-1">
            Nhân viên hỗ trợ ({supports.length})
          </h4>
          <table className={`w-full text-sm table-fixed ${BODY_DIVIDER}`}>
            {colGroup}
            <thead>{headerRow}</thead>
            <tbody>{supports.map(renderRow)}</tbody>
          </table>
        </div>
      )}

      {items.length > 0 && (
        <TotalFooter
          label={`Tổng thưởng ${departmentLabel}`}
          amount={totalBonus}
          count={items.length}
        />
      )}
    </SectionCard>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// FACTORY card
// ══════════════════════════════════════════════════════════════════════════
function FactoryBonusCard({ month, year, search }) {
  const [kpi, setKpi] = useState(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    let alive = true;
    setLoading(true);
    factoryPayrollApi.kpi(month, year)
      .then(d => { if (alive) setKpi(d); })
      .catch(e => toast(e?.response?.data?.message || 'Không tải được KPI', 'error'))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [month, year, toast]);

  // Highlight + scroll NV khớp search — inject vào DOM của KpiSummary.
  const q = norm(search);
  useEffect(() => {
    const scope = document.querySelector('[data-factory-kpi-scope]');
    if (!scope) return;
    const rows = scope.querySelectorAll('tbody tr');
    let first = null;
    // (10/2026) KpiSummary dùng cấu trúc tbody tr/td RIÊNG (không có HILITE_ROW
    // class), lại có padding td `py-1.5` tight hơn các bảng khác → highlight
    // qua classList trước đây dính sát mép. Nay dùng INLINE STYLE cho chắc
    // (không phụ thuộc Tailwind JIT sinh class từ string động), đồng thời
    // tăng padding td và bo góc 2 đầu để tạo pill đồng bộ với các tab khác.
    const GOLD_BG     = 'rgba(197, 164, 80, 0.15)';
    const GOLD_BORDER = 'rgba(197, 164, 80, 0.60)';
    rows.forEach(row => {
      const name = row.children[0]?.textContent || '';
      const match = !!q && norm(name).includes(q);
      row.style.scrollMarginTop = '160px';
      const tds = Array.from(row.children);
      if (match) {
        row.style.backgroundColor = GOLD_BG;
        tds.forEach((td, i) => {
          td.style.borderTop = '2px solid ' + GOLD_BORDER;
          td.style.borderBottom = '2px solid ' + GOLD_BORDER;
          td.style.paddingTop = '6px';
          td.style.paddingBottom = '6px';
          if (i === 0) {
            td.style.borderLeft = '2px solid ' + GOLD_BORDER;
            td.style.borderTopLeftRadius = '12px';
            td.style.borderBottomLeftRadius = '12px';
            td.style.paddingLeft = '12px';
          }
          if (i === tds.length - 1) {
            td.style.borderRight = '2px solid ' + GOLD_BORDER;
            td.style.borderTopRightRadius = '12px';
            td.style.borderBottomRightRadius = '12px';
            td.style.paddingRight = '12px';
          }
        });
        if (!first) first = row;
      } else {
        row.style.backgroundColor = '';
        tds.forEach((td, i) => {
          td.style.borderTop = '';
          td.style.borderBottom = '';
          td.style.paddingTop = '';
          td.style.paddingBottom = '';
          if (i === 0) {
            td.style.borderLeft = '';
            td.style.borderTopLeftRadius = '';
            td.style.borderBottomLeftRadius = '';
            td.style.paddingLeft = '';
          }
          if (i === tds.length - 1) {
            td.style.borderRight = '';
            td.style.borderTopRightRadius = '';
            td.style.borderBottomRightRadius = '';
            td.style.paddingRight = '';
          }
        });
      }
    });
    if (first) scrollRowToCenter(first);
  }, [q, kpi]);

  if (loading) return <div className="py-10 flex justify-center"><LoadingSpinner /></div>;
  if (!kpi || !(kpi.items?.length)) {
    return <SectionCard><PendingNotice deptLabel="Sản xuất" /></SectionCard>;
  }
  // (10/2026) Dòng tổng FOOTER riêng cho page Thưởng tháng (super-accountant) —
  // không đụng KpiSummary (dùng chung cho owner/Bảng chấm công, bên đó đã có
  // ô "Tổng bonus tháng" ở KPI card nên không cần footer thêm nữa).
  const totalBonus = (kpi.items || []).reduce((s, i) => s + (i.amount || 0), 0);
  return (
    <div data-factory-kpi-scope>
      <KpiSummary kpi={kpi} />
      {/* (10/2026) Footer dùng chung TotalFooter — nằm ngoài SectionCard của
          KpiSummary nên dùng -mt-2 pull lên sát mép rồi mx-0 cho full width. */}
      <TotalFooter
        label="Tổng thưởng Sản xuất"
        amount={totalBonus}
        count={kpi.items.length}
      />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// WAREHOUSE card
// ══════════════════════════════════════════════════════════════════════════
function WarehouseBonusCard({ month, year, search }) {
  const [trend, setTrend] = useState(null);
  const [loading, setLoading] = useState(true);
  const rowRefs = useRef({});
  const toast = useToast();
  useEffect(() => {
    let alive = true;
    setLoading(true);
    factoryPayrollApi.getBonusTrend('WAREHOUSE')
      .then(d => { if (alive) setTrend(d); })
      .catch(e => toast(e?.response?.data?.message || 'Không tải được', 'error'))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [month, year, toast]);

  const mk = monthKeyOf(month, year);
  const users = useMemo(() => (trend?.users || []).map(u => ({
    ...u, amount: u.amountsByMonth?.[mk] ?? 0,
  })), [trend, mk]);
  const total = users.reduce((s, u) => s + (u.amount || 0), 0);
  const q = norm(search);
  const matchedIds = useMemo(
    () => q ? users.filter(u => norm(u.fullName).includes(q)).map(u => u.userId) : [],
    [users, q],
  );
  useScrollToFirstMatch(matchedIds, rowRefs);

  if (loading) return <div className="py-10 flex justify-center"><LoadingSpinner /></div>;
  if (!trend) return <p className="p-6 text-sm text-muted text-center">Không có dữ liệu.</p>;
  if (!users.some(u => u.amount > 0)) {
    return <SectionCard><PendingNotice deptLabel="Kho" /></SectionCard>;
  }

  return (
    <SectionCard>
      <div className="flex items-center justify-between px-5 py-4 border-b border-hairline">
        <div className="flex items-center gap-2">
          <Gift size={16} className="text-purple-500" />
          <h3 className="text-sm font-bold text-ink">
            Thưởng Kho · Tháng {String(month).padStart(2, '0')}/{year}
          </h3>
        </div>
      </div>
      <div className="p-5 overflow-x-auto">
        <table className={`w-full text-sm table-fixed ${BODY_DIVIDER}`}>
          <colgroup>
            <col style={{ width: '48%' }} />
            <col style={{ width: '28%' }} />
            <col style={{ width: '24%' }} />
          </colgroup>
          <thead>
            <tr className={HEAD_ROW}>
              <th className={`${CELL} font-semibold`}>Nhân viên</th>
              <th className={`${CELL} font-semibold`}>Chức vụ</th>
              <th className={`${CELL} text-right font-semibold`}>Số tiền</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => {
              const highlight = matchedIds.includes(u.userId);
              return (
                <tr
                  key={u.userId}
                  ref={(el) => { if (el) rowRefs.current[u.userId] = el; }}
                  style={SCROLL_MARGIN}
                  className={`border-b border-hairline/40 last:border-0 ${highlight ? HILITE_ROW : ''}`}>
                  <td className={`${CELL} text-ink`}>{u.fullName}</td>
                  <td className={`${CELL} text-muted`}>{u.roleLabel || '—'}</td>
                  <td className={`${CELL} text-right font-semibold text-ink`}>{fmtVnd(u.amount)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <TotalFooter label="Tổng thưởng Kho" amount={total} count={users.length} />
    </SectionCard>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// DRIVER card
// ══════════════════════════════════════════════════════════════════════════
function DriverBonusCard({ month, year, search }) {
  const [cfg, setCfg] = useState(null);
  const [attBonusMap, setAttBonusMap] = useState({}); // userId → amount
  const [loading, setLoading] = useState(true);
  const rowRefs = useRef({});
  const toast = useToast();
  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([
      factoryPayrollApi.driverConfig(month, year),
      factoryPayrollApi.listAttendanceBonus(month, year).catch(() => []),
    ])
      .then(([c, abList]) => {
        if (!alive) return;
        setCfg(c);
        const m = {};
        (abList || []).forEach(x => { if (x?.userId != null) m[x.userId] = x.amount || 0; });
        setAttBonusMap(m);
      })
      .catch(e => toast(e?.response?.data?.message || 'Không tải được', 'error'))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [month, year, toast]);

  const rowSum = (r) => {
    const fuel = r.motorbike?.fuelPay || 0;
    const bMoto = r.motorbike?.bonusPay || 0;
    const bTruck = r.truck?.bonusPay || 0;
    return fuel + bMoto + bTruck;
  };
  const drivers  = useMemo(() => (cfg?.rows         || []).filter(r => rowSum(r) > 0 || (attBonusMap[r.userId] || 0) > 0), [cfg, attBonusMap]);
  const supports = useMemo(() => (cfg?.nonDriverRows || []).filter(r => rowSum(r) > 0 || (attBonusMap[r.userId] || 0) > 0), [cfg, attBonusMap]);
  // (10/2026) Tài xế xe tải — thưởng cố định. Ẩn người có fixedTruckBonus = 0
  // VÀ không có thưởng chuyên cần (chưa nhập + chưa có gì → không hiện).
  const truckDrivers = useMemo(
    () => (cfg?.truckDriverRows || []).filter(r =>
      (r.fixedTruckBonus || 0) > 0 || (attBonusMap[r.userId] || 0) > 0),
    [cfg, attBonusMap],
  );
  const q = norm(search);
  const matched = useMemo(() => {
    if (!q) return [];
    return [...drivers, ...truckDrivers, ...supports]
      .filter(r => norm(r.driverName).includes(q)).map(r => r.userId);
  }, [drivers, truckDrivers, supports, q]);
  useScrollToFirstMatch(matched, rowRefs);

  if (loading) return <div className="py-10 flex justify-center"><LoadingSpinner /></div>;
  if (!cfg || (drivers.length === 0 && truckDrivers.length === 0 && supports.length === 0)) {
    return <SectionCard><PendingNotice deptLabel="Tài xế" /></SectionCard>;
  }

  // Grand total = Σ (từng total đã làm tròn LÊN 5.000) cho xe máy + hỗ trợ,
  // CỘNG thưởng cố định tài xế xe tải (không round, OWNER đã nhập số chẵn).
  const rowTotal = (r) => roundUpTo(
    rowSum(r) + (attBonusMap[r.userId] || 0),
    5000,
  );
  const truckDriverTotal = (r) => (r.fixedTruckBonus || 0) + (attBonusMap[r.userId] || 0);
  const grandTotal = [...drivers, ...supports].reduce((s, r) => s + rowTotal(r), 0)
    + truckDrivers.reduce((s, r) => s + truckDriverTotal(r), 0);

  // 10 cột — share colgroup cho CẢ 2 bảng → cột đều nhau.
  // Tên · Chức vụ · Km · Tiền xăng · Số đơn xe máy · Thưởng xe máy ·
  // Số đơn xe tải · Thưởng xe tải · Thưởng chuyên cần · Tổng thưởng
  const colGroup = (
    <colgroup>
      <col style={{ width: '14%' }} />
      <col style={{ width: '12%' }} />
      <col style={{ width:  '7%' }} />
      <col style={{ width: '10%' }} />
      <col style={{ width:  '8%' }} />
      <col style={{ width: '11%' }} />
      <col style={{ width:  '8%' }} />
      <col style={{ width: '11%' }} />
      <col style={{ width: '10%' }} />
      <col style={{ width:  '9%' }} />
    </colgroup>
  );
  // (10/2026) Dùng <br/> cho header xuống dòng — `\n` trong JSX text là literal
  // backslash-n chứ không phải newline, nên `whitespace-pre-line` không có tác dụng.
  const headRow = (firstLabel) => (
    <tr className={HEAD_ROW}>
      <th className={`${CELL} font-semibold`}>{firstLabel}</th>
      <th className={`${CELL} font-semibold`}>Chức vụ</th>
      <th className={`${CELL} text-right font-semibold`}>Số km</th>
      <th className={`${CELL} text-right font-semibold`}>Tiền xăng</th>
      <th className={`${CELL} text-right font-semibold`}>Số lượt<br/>xe máy</th>
      <th className={`${CELL} text-right font-semibold`}>Thưởng<br/>xe máy</th>
      <th className={`${CELL} text-right font-semibold`}>Số lượt<br/>xe tải</th>
      <th className={`${CELL} text-right font-semibold`}>Thưởng<br/>xe tải</th>
      <th className={`${CELL} text-right font-semibold`}>Thưởng<br/>chuyên cần</th>
      <th className={`${CELL} text-right font-semibold`}>Tổng thưởng</th>
    </tr>
  );

  // (10/2026) Header RIÊNG cho section Tài xế xe tải — thay 6 cột tính-theo-lượt
  // (Số km → Thưởng xe tải) bằng 1 ô "Thưởng trách nhiệm" merged. User không
  // muốn label chữ nằm trong ô data nữa; phải nằm trên header mới gọn.
  const headRowTruck = () => (
    <tr className={HEAD_ROW}>
      <th className={`${CELL} font-semibold`}>Tài xế xe tải</th>
      <th className={`${CELL} font-semibold`}>Chức vụ</th>
      <th colSpan={6} className={`${CELL} text-right font-semibold`}>Thưởng trách nhiệm</th>
      <th className={`${CELL} text-right font-semibold`}>Thưởng<br/>chuyên cần</th>
      <th className={`${CELL} text-right font-semibold`}>Tổng thưởng</th>
    </tr>
  );
  const renderRow = (r) => {
    const km       = r.motorbike?.totalKm || 0;
    const fuel     = r.motorbike?.fuelPay || 0;
    // (10/2026) FIX: user yêu cầu đổi "Số đơn" thành "Số lượt" — data lấy từ
    // totalTrips (số CHUYẾN đi) chứ không phải totalOrders (số ĐƠN). 1 chuyến
    // có thể giao nhiều đơn nên 2 số khác nhau.
    const nMoto    = r.motorbike?.totalTrips || 0;
    const bMoto    = r.motorbike?.bonusPay || 0;
    const nTruck   = r.truck?.totalTrips || 0;
    const bTruck   = r.truck?.bonusPay || 0;
    const attBonus = attBonusMap[r.userId] || 0;
    const total    = rowTotal(r); // đã roundUp 5.000
    const highlight = matched.includes(r.userId);
    const chucVu = r.position || r.department || (r.nonDriver ? '—' : 'Tài xế xe máy');
    return (
      <tr
        key={r.userId}
        ref={(el) => { if (el) rowRefs.current[r.userId] = el; }}
        style={SCROLL_MARGIN}
        className={`border-b border-hairline/40 last:border-0 ${highlight ? HILITE_ROW : ''}`}>
        <td className={`${CELL} text-ink`}>{r.driverName}</td>
        <td className={`${CELL} text-muted`}>{chucVu}</td>
        <td className={`${CELL} text-right text-ink`}>{km ? fmtNum(km, 2) : '—'}</td>
        <td className={`${CELL} text-right text-ink`}>{fmtVnd(fuel)}</td>
        <td className={`${CELL} text-right text-ink`}>{nMoto || '—'}</td>
        <td className={`${CELL} text-right text-ink`}>{fmtVnd(bMoto)}</td>
        <td className={`${CELL} text-right text-ink`}>{nTruck || '—'}</td>
        <td className={`${CELL} text-right text-ink`}>{fmtVnd(bTruck)}</td>
        <td className={`${CELL} text-right text-ink`}>{fmtVnd(attBonus)}</td>
        <td className={`${CELL} text-right font-semibold text-emerald-700 dark:text-emerald-300`}>
          {fmtVnd(total)}
        </td>
      </tr>
    );
  };

  // (10/2026) Row cho TÀI XẾ XE TẢI — thưởng cố định.
  // User yêu cầu: bỏ các cột Số km → Số lượt xe tải (5 cột rỗng không cần),
  // "Thưởng xe tải" đổi label thành "Thưởng trách nhiệm", merge toàn bộ 6 cột
  // (từ Số km đến Thưởng xe tải) thành 1 ô duy nhất show "Thưởng trách nhiệm: X".
  const renderTruckDriverRow = (r) => {
    const attBonus = attBonusMap[r.userId] || 0;
    const total = truckDriverTotal(r);
    const highlight = matched.includes(r.userId);
    return (
      <tr
        key={r.userId}
        ref={(el) => { if (el) rowRefs.current[r.userId] = el; }}
        style={SCROLL_MARGIN}
        className={`border-b border-hairline/40 last:border-0 ${highlight ? HILITE_ROW : ''}`}>
        <td className={`${CELL} text-ink`}>{r.driverName}</td>
        <td className={`${CELL} text-muted`}>Tài xế xe tải</td>
        {/* Merge 6 cột (Số km / Tiền xăng / Số lượt xe máy / Thưởng xe máy /
            Số lượt xe tải / Thưởng xe tải) thành 1 ô "Thưởng trách nhiệm". */}
        <td colSpan={6} className={`${CELL} text-right font-bold text-ink tabular-nums`}>
          {fmtVnd(r.fixedTruckBonus)}
        </td>
        <td className={`${CELL} text-right text-ink`}>{fmtVnd(attBonus)}</td>
        <td className={`${CELL} text-right font-semibold text-emerald-700 dark:text-emerald-300`}>
          {fmtVnd(total)}
        </td>
      </tr>
    );
  };

  return (
    <SectionCard>
      <div className="flex items-center justify-between px-5 py-4 border-b border-hairline">
        <div className="flex items-center gap-2">
          <Truck size={16} className="text-gold" />
          <h3 className="text-sm font-bold text-ink">
            Lương tài xế theo km &amp; lượt giao · Tháng {String(month).padStart(2, '0')}/{year}
          </h3>
        </div>
      </div>

      <div className="px-5 pt-3 grid gap-3 sm:grid-cols-3 text-[12px]">
        <div className="rounded-lg bg-canvas border border-hairline px-3 py-2">
          <p className="text-muted uppercase tracking-wider text-[10px]">Giá xăng (/km)</p>
          <p className="text-sm font-bold text-ink mt-0.5">{fmtVnd(cfg.gasPrice)}</p>
        </div>
        <div className="rounded-lg bg-canvas border border-hairline px-3 py-2">
          <p className="text-muted uppercase tracking-wider text-[10px]">Thưởng xe máy (/lượt)</p>
          <p className="text-sm font-bold text-ink mt-0.5">{fmtVnd(cfg.bonusUnitPrice)}</p>
        </div>
        <div className="rounded-lg bg-canvas border border-hairline px-3 py-2">
          <p className="text-muted uppercase tracking-wider text-[10px]">Thưởng xe tải (/lượt)</p>
          <p className="text-sm font-bold text-ink mt-0.5">{fmtVnd(cfg.truckBonusUnitPrice)}</p>
        </div>
      </div>

      <div className="px-5 pt-4 pb-2 overflow-x-auto">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted mb-1">
          Tài xế xe máy ({drivers.length})
        </h4>
        <table className={`w-full text-sm table-fixed whitespace-pre-line ${BODY_DIVIDER}`}>
          {colGroup}
          <thead>{headRow('Tài xế xe máy')}</thead>
          <tbody>
            {drivers.length === 0
              ? <tr><td colSpan={10} className="py-6 text-center text-muted">—</td></tr>
              : drivers.map(renderRow)}
          </tbody>
        </table>
      </div>

      {/* (10/2026) Tài xế XE TẢI — thưởng cố định tháng, không tính theo lượt.
          Header RIÊNG (headRowTruck) với ô "Thưởng trách nhiệm" merged 6 cột,
          thay vì dùng chung header của bảng xe máy (vốn có Số km, Tiền xăng…
          không áp dụng cho tài xế xe tải). */}
      {truckDrivers.length > 0 && (
        <div className="px-5 pt-4 pb-2 overflow-x-auto">
          <h4 className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 mb-1">
            Tài xế xe tải — thưởng cố định ({truckDrivers.length})
          </h4>
          <table className={`w-full text-sm table-fixed whitespace-pre-line ${BODY_DIVIDER}`}>
            {colGroup}
            <thead>{headRowTruck()}</thead>
            <tbody>{truckDrivers.map(renderTruckDriverRow)}</tbody>
          </table>
        </div>
      )}

      {supports.length > 0 && (
        <div className="px-5 pt-4 pb-5 overflow-x-auto">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted mb-1">
            Nhân viên hỗ trợ ({supports.length})
          </h4>
          <table className={`w-full text-sm table-fixed whitespace-pre-line ${BODY_DIVIDER}`}>
            {colGroup}
            <thead>{headRow('Nhân viên')}</thead>
            <tbody>{supports.map(renderRow)}</tbody>
          </table>
        </div>
      )}

      <TotalFooter
        label="Tổng thưởng Tài xế (xe máy làm tròn 5.000, xe tải cố định)"
        amount={grandTotal}
        count={drivers.length + truckDrivers.length + supports.length}
      />
    </SectionCard>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════
export default function AccountantBonusViewPage() {
  const now = new Date();
  const [periods, setPeriods] = useState([]);
  const [selected, setSelected] = useState({ month: now.getMonth() + 1, year: now.getFullYear() });
  const [tab, setTab] = useState('SALES');
  const [searchRaw, setSearchRaw] = useState('');
  const search = useDebounced(searchRaw, 200);

  const [allStatus, setAllStatus] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const toast = useToast();

  useEffect(() => { setSearchRaw(''); }, [tab, selected.month, selected.year]);

  useEffect(() => {
    let alive = true;
    factoryPayrollApi.uploadablePeriods('FACTORY')
      .then(list => { if (alive) setPeriods(list || []); })
      .catch(() => { if (alive) setPeriods([]); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    setAllStatus(null);
    factoryPayrollApi.monthStatusAll(selected.month, selected.year)
      .then(d => { if (alive) setAllStatus(d); })
      .catch(e => {
        if (!alive) return;
        toast(e?.response?.data?.message || 'Không tải được trạng thái', 'error');
        setAllStatus([]);
      });
    return () => { alive = false; };
  }, [selected.month, selected.year, toast]);

  // Default: tháng gần nhất có BẤT KỲ phòng nào đã tính.
  useEffect(() => {
    if (!periods.length) return;
    let alive = true;
    (async () => {
      for (const p of periods) {
        try {
          const st = await factoryPayrollApi.monthStatusAll(p.month, p.year);
          const any = Array.isArray(st) ? st.some(hasAnyStatus)
            : Object.values(st || {}).some(hasAnyStatus);
          if (any) {
            if (alive) setSelected({ month: p.month, year: p.year });
            return;
          }
        } catch { /* bỏ qua */ }
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periods.length]);

  const deptLabel = DEPTS.find(d => d.key === tab)?.label || tab;

  const exportBonus = async () => {
    setDownloading(true);
    try {
      const res = await api.post('/api/factory-payroll/salary-export',
        { departments: [tab], exportType: 'BONUS_ONLY' },
        { params: { month: selected.month, year: selected.year }, responseType: 'blob' });
      const blob = res.data;
      const head = await blob.slice(0, 5).text();
      if (!head.startsWith('%PDF')) {
        const txt = await blob.text();
        let msg = txt;
        try { const j = JSON.parse(txt); msg = j.message || j.error || txt; } catch { /* raw */ }
        toast(msg || 'BE không trả về PDF', 'error');
        return;
      }
      const mm = String(selected.month).padStart(2, '0');
      const slug = { ACCOUNTING: '-ketoan', SALES: '-kinhdoanh', FACTORY: '-xuongsx',
                     WAREHOUSE: '-kho', DRIVER: '-taixe' }[tab] || '';
      const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `bang-thuong${slug}-thang-${mm}-${selected.year}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
      toast('Đã tải file PDF thưởng', 'success');
    } catch (e) {
      let msg = e?.message || 'Không tải được file';
      try {
        if (e?.response?.data instanceof Blob) {
          const txt = await e.response.data.text();
          try { const j = JSON.parse(txt); msg = j.message || j.error || txt; } catch { msg = txt; }
        }
      } catch { /* ignore */ }
      toast(msg, 'error');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="p-5 space-y-4">
      <PageHeader
        icon={Award}
        title="Thưởng tháng"
        subtitle="Xem thưởng tháng của 5 phòng — tự hiện ngay khi phòng tính xong (chưa cần Public)."
      />

      {/* !overflow-visible để MonthPicker dropdown tràn ra ngoài card */}
      <SectionCard className="!p-4 !overflow-visible">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <MonthPicker
            periods={periods}
            value={selected}
            onChange={(p) => setSelected({ month: p.month, year: p.year })}
          />
          <SecondaryButton
            onClick={exportBonus}
            disabled={downloading}
            loading={downloading}
            title="Xuất PDF thưởng của phòng đang chọn">
            <Download size={14} /> Xuất PDF thưởng
          </SecondaryButton>
        </div>

        {/* (10/2026) Tabs pill — đồng bộ phong cách DepartmentTabs của owner/attendance */}
        <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          {DEPTS.map(d => {
            const s = statusOf(allStatus, d.key);
            const any = hasAnyStatus(s);
            const active = tab === d.key;
            const Icon = d.icon;
            return (
              <button
                key={d.key}
                onClick={() => setTab(d.key)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold
                  whitespace-nowrap border transition-colors shrink-0
                  ${active
                    ? 'bg-chrome text-white border-chrome'
                    : 'bg-surface text-ink border-hairline-2 hover:border-gold/50'}`}>
                <Icon size={14} className={active ? 'text-gold' : 'text-muted'} />
                <span>{d.label}</span>
                {allStatus && !any && (
                  <Lock size={11} className={active ? 'text-white/70' : 'text-muted opacity-70'} />
                )}
              </button>
            );
          })}
        </div>
      </SectionCard>

      {/* Ô SEARCH FLOATING — sticky trên viewport khi scroll */}
      <div className="sticky top-0 z-30 -mx-5 px-5 py-2
                      bg-canvas/95 backdrop-blur-sm border-y border-hairline/50">
        <div className="relative max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={searchRaw}
            onChange={(e) => setSearchRaw(e.target.value)}
            placeholder={`Tìm NV trong phòng ${deptLabel}...`}
            className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg border border-hairline bg-surface
                       focus:outline-none focus:ring-1 focus:ring-gold/50" />
        </div>
      </div>

      {!allStatus
        ? <div className="py-10 flex justify-center"><LoadingSpinner /></div>
        :   tab === 'SALES'      ? <OfficeBonusCard department="SALES"      departmentLabel="Kinh doanh" month={selected.month} year={selected.year} search={search} />
          : tab === 'ACCOUNTING' ? <OfficeBonusCard department="ACCOUNTING" departmentLabel="Kế toán"    month={selected.month} year={selected.year} search={search} />
          : tab === 'FACTORY'    ? <FactoryBonusCard   month={selected.month} year={selected.year} search={search} />
          : tab === 'WAREHOUSE'  ? <WarehouseBonusCard month={selected.month} year={selected.year} search={search} />
          : tab === 'DRIVER'     ? <DriverBonusCard    month={selected.month} year={selected.year} search={search} />
          : null
      }
    </div>
  );
}