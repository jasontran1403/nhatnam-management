// src/pages/owner/ChuyenCanPage.jsx
//
// PAGE CHUYÊN CẦN — Phase 6 (10/2026).
//
// Matrix dòng = nhân viên × cột = ngày trong tháng. Mỗi ô có 2 số:
//   - inDelta  (phút): >0 trễ (đỏ), <0 sớm (xanh dương), =0 đúng giờ (xanh lá)
//   - outDelta (phút): >0 về sớm (đỏ), <0 về trễ (xanh dương), =0 đúng giờ (xanh lá)
//
// Cột tên nhân viên FIXED khi scroll ngang (sticky left).
// Cột chủ nhật nền đỏ nhạt; ngày lễ nền xanh dương nhạt.
// 2 cột cuối: tổng phút trễ + tổng phút về sớm.
//
// Tháng/năm được truyền qua URL state (?month=9&year=2026). Khi đổi tháng
// trong page này, chạy navigate(..., state) đồng bộ với trang cha
// (AttendanceSheetsPage) qua localStorage trung gian.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  CalendarCheck, Calendar as CalendarIcon,
  AlertCircle, RefreshCw, Search, X,
} from 'lucide-react';
import { companyPayrollApi } from '../../api/companyPayrollApi';
import {
  PageHeader, SectionCard, LoadingSpinner, SecondaryButton, EmptyState,
} from '../../components/ui';
import { useToast } from '../../components/common/Toast';
import { BackButton } from '@/components/common/SubPageNav';

// Key dùng chung với CompanyPayrollPanel / AttendanceSheetsPage để đồng bộ
// tháng được chọn khi bấm back.
const PAYROLL_MONTH_KEY = 'payrollSelectedMonth';

// ──────────────────────────────────────────────────────────────────────────────
// Helpers — fuzzy search (không phụ thuộc lib)
// ──────────────────────────────────────────────────────────────────────────────

/** Bỏ dấu tiếng Việt để search không phân biệt dấu. */
function stripDiacritics(str) {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

/**
 * Fuzzy score: query chars xuất hiện theo thứ tự trong target.
 * Trả về score >= 0 (cao hơn = khớp tốt hơn), -1 nếu không khớp.
 */
function fuzzyScore(query, target) {
  const q = stripDiacritics(query).trim();
  const t = stripDiacritics(target);
  if (!q) return 0;
  if (!t) return -1;

  // Exact / includes ưu tiên cao
  if (t === q) return 1000;
  if (t.includes(q)) return 500 + (100 - Math.min(t.length - q.length, 100));

  // Fuzzy: từng ký tự query phải xuất hiện theo thứ tự
  let ti = 0;
  let consecutive = 0;
  let maxConsecutive = 0;
  let score = 0;
  for (let qi = 0; qi < q.length; qi++) {
    const ch = q[qi];
    let found = false;
    while (ti < t.length) {
      if (t[ti] === ch) {
        found = true;
        consecutive++;
        maxConsecutive = Math.max(maxConsecutive, consecutive);
        score += 10 + consecutive * 2; // thưởng chuỗi liên tiếp
        ti++;
        break;
      }
      consecutive = 0;
      ti++;
    }
    if (!found) return -1;
  }
  // Thưởng nếu khớp sớm / ngắn hơn
  score += maxConsecutive * 5;
  score -= Math.max(0, t.length - q.length);
  return score;
}

/** Tìm index nhân viên khớp tốt nhất (fuzzy). Trả -1 nếu không có. */
function findBestMatchIndex(employees, query) {
  if (!query?.trim() || !employees?.length) return -1;
  let bestIdx = -1;
  let bestScore = -1;
  employees.forEach((emp, i) => {
    const s = fuzzyScore(query, emp.fullName || '');
    if (s > bestScore) {
      bestScore = s;
      bestIdx = i;
    }
  });
  return bestScore >= 0 ? bestIdx : -1;
}  // score >= 0 nghĩa là có khớp (kể cả fuzzy yếu) —
  // nếu muốn chặt hơn có thể yêu cầu bestScore > 0 hoặc threshold riêng.

// ──────────────────────────────────────────────────────────────────────────────
// MONTH / YEAR PICKER — gọn
// ──────────────────────────────────────────────────────────────────────────────

function MonthYearPicker({ month, year, onChange }) {
  const [open, setOpen] = useState(false);
  const now = new Date();
  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-surface border border-hairline-2
          shadow-sm hover:border-gold/50 transition-colors min-w-[140px]">
        <CalendarIcon size={16} className="text-gold" />
        <span className="font-bold text-ink text-sm">
          {String(month).padStart(2, '0')}/{year}
        </span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-30 mt-2 w-[280px] bg-surface rounded-2xl border border-hairline-2 shadow-xl p-3">
            <div className="mb-2">
              <label className="text-xs font-bold text-muted uppercase">Năm</label>
              <div className="flex gap-1 mt-1 flex-wrap">
                {years.map(y => (
                  <button key={y}
                    onClick={() => onChange(month, y)}
                    className={`px-2.5 py-1 rounded-lg text-sm transition-colors
                      ${y === year ? 'bg-gold text-white font-bold' : 'bg-canvas text-ink hover:bg-hairline-1'}`}>
                    {y}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-muted uppercase">Tháng</label>
              <div className="grid grid-cols-4 gap-1 mt-1">
                {months.map(m => (
                  <button key={m}
                    onClick={() => { onChange(m, year); setOpen(false); }}
                    className={`px-2 py-1.5 rounded-lg text-sm transition-colors
                      ${m === month ? 'bg-gold text-white font-bold' : 'bg-canvas text-ink hover:bg-hairline-1'}`}>
                    T{m}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// DAY CELL — vẽ 2 số với màu theo delta
// ──────────────────────────────────────────────────────────────────────────────

const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

/** Màu text theo delta: null = trống xám, >0 = đỏ, <0 = xanh dương, =0 = xanh lá. */
function deltaClass(d) {
  if (d == null) return 'text-muted/40';
  if (d > 0)     return 'text-red-600 dark:text-red-400 font-bold';
  if (d < 0)     return 'text-blue-600 dark:text-blue-400 font-semibold';
  return 'text-emerald-600 dark:text-emerald-400';
}

/** Hiển thị dấu nhưng không hiển thị dấu "-" ở phía trước số âm (đã nhận biết qua màu). */
function deltaText(d) {
  if (d == null) return '·';
  return Math.abs(d);
}

function DayCell({ cell }) {
  // Background theo loại ngày
  let bg = '';
  if (cell.sunday) bg = 'bg-red-50 dark:bg-red-500/10';
  else if (cell.holiday) bg = 'bg-blue-50 dark:bg-blue-500/10';

  // Ngày nghỉ phép được duyệt → nền xanh lá nhạt
  // PHASE 6b: Ngày làm ở nhà cũng dùng CÙNG màu xanh lá — phân biệt bằng
  //   badge "W" nhỏ ở góc trên bên phải để OWNER xem lướt biết đâu là WFH.
  if (cell.leave || cell.wfh) bg = 'bg-emerald-50 dark:bg-emerald-500/10';

  // Cờ "giờ VÀO hoặc RA là fill mặc định" → viền dashed vàng.
  //   defaultedOut: thiếu giờ ra, fill 17:00.
  //   defaultedIn:  thiếu giờ vào, fill 08:00.
  // Cả hai dùng chung visual (viền vàng dashed) để OWNER lướt bảng là thấy
  // ngay ô bất thường, không cần phân biệt chi tiết — tooltip giải thích rõ.
  const borderClass = (cell.defaultedOut || cell.defaultedIn)
    ? 'border-dashed border-amber-400'
    : 'border-hairline-1';

  // Nếu không present và không phải lý do đặc biệt → chấm xám
  if (!cell.present && !cell.sunday && !cell.holiday && !cell.leave && !cell.wfh) {
    return (
      <td className={`border ${borderClass} ${bg} px-1.5 py-1.5 text-center text-[11px] leading-none`}>
        <div className="text-muted/40">—</div>
      </td>
    );
  }

  // Badge "W" cho ngày WFH (góc trên phải).
  const wfhBadge = cell.wfh && (
    <span className="absolute top-0 right-0.5 text-[8px] font-bold text-emerald-700 dark:text-emerald-300 leading-none">
      W
    </span>
  );

  return (
    <td className={`relative border ${borderClass} ${bg} px-1.5 py-1.5 text-center text-[11px] leading-tight`}
        title={
          cell.wfh ? 'Làm ở nhà — đã duyệt'
            : cell.defaultedOut ? 'Thiếu chấm công ra — hệ thống fill 17:00'
            : cell.defaultedIn  ? 'Thiếu chấm công vào — hệ thống fill 08:00'
            : undefined
        }>
      {wfhBadge}
      {cell.wfh && !cell.present ? (
        <div className="text-[10px] text-emerald-700 dark:text-emerald-300 font-semibold">WFH</div>
      ) : (
        <>
          <div className={deltaClass(cell.inDelta)}>{deltaText(cell.inDelta)}</div>
          <div className={deltaClass(cell.outDelta)}>{deltaText(cell.outDelta)}</div>
        </>
      )}
    </td>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// HEADER CELL — hiển thị số ngày + nhãn thứ, màu theo loại ngày
// ──────────────────────────────────────────────────────────────────────────────

function DayHeaderCell({ day, year, month, isSunday, isHoliday }) {
  const date = new Date(year, month - 1, day);
  const wd = WEEKDAYS[date.getDay()];
  let bg = '';
  let textCls = 'text-ink';
  if (isSunday) { bg = 'bg-red-100 dark:bg-red-500/20'; textCls = 'text-red-700 dark:text-red-300'; }
  else if (isHoliday) { bg = 'bg-blue-100 dark:bg-blue-500/20'; textCls = 'text-blue-700 dark:text-blue-300'; }
  return (
    <th className={`border border-hairline-2 px-1 py-1.5 text-center text-[10px] font-bold ${bg} ${textCls} min-w-[32px]`}>
      <div className="leading-tight">{day}</div>
      <div className="text-[9px] font-normal leading-tight opacity-70">{wd}</div>
    </th>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// MAIN
// ──────────────────────────────────────────────────────────────────────────────

export default function ChuyenCanPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();

  // Nguồn tháng/năm:
  //   1. URL query ?month&year  (ưu tiên cao nhất)
  //   2. localStorage (tháng đang chọn ở trang cha)
  //   3. Tháng/năm hiện tại
  const initial = useMemo(() => {
    const sp = new URLSearchParams(location.search);
    let m = parseInt(sp.get('month'), 10);
    let y = parseInt(sp.get('year'), 10);
    if (!m || !y) {
      try {
        const saved = JSON.parse(localStorage.getItem(PAYROLL_MONTH_KEY) || 'null');
        if (saved?.month && saved?.year) { m = saved.month; y = saved.year; }
      } catch {}
    }
    if (!m || !y) {
      const now = new Date();
      m = now.getMonth() + 1; y = now.getFullYear();
    }
    return { month: m, year: y };
  }, [location.search]);

  const [month, setMonth] = useState(initial.month);
  const [year, setYear] = useState(initial.year);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedUserId, setHighlightedUserId] = useState(null);
  const rowRefs = useRef({});           // userId → <tr>
  const tableScrollRef = useRef(null);  // div overflow của table
  const highlightTimerRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await companyPayrollApi.attendanceDetail(month, year);
      setData(d);
    } catch (e) {
      toast(e?.response?.data?.message || 'Không tải được chuyên cần', 'error');
    } finally { setLoading(false); }
  }, [month, year, toast]);

  useEffect(() => { load(); }, [load]);

  // Sync tháng/năm sang localStorage để khi back ra ngoài, trang cha đọc được
  useEffect(() => {
    localStorage.setItem(PAYROLL_MONTH_KEY, JSON.stringify({ month, year }));
  }, [month, year]);

  // Clear highlight khi đổi tháng / data mới
  useEffect(() => {
    setHighlightedUserId(null);
    setSearchQuery('');
  }, [month, year, data]);

  useEffect(() => () => {
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
  }, []);

  const handlePickMonth = (m, y) => {
    setMonth(m); setYear(y);
    navigate(`?month=${m}&year=${y}`, { replace: true });
  };

  const runSearch = useCallback((query) => {
    if (!data?.employees?.length) return;
    const q = (query ?? searchQuery).trim();
    if (!q) {
      setHighlightedUserId(null);
      return;
    }
    const idx = findBestMatchIndex(data.employees, q);
    if (idx < 0) {
      toast('Không tìm thấy nhân viên khớp', 'error');
      setHighlightedUserId(null);
      return;
    }
    const emp = data.employees[idx];
    setHighlightedUserId(emp.userId);

    // Scroll dòng vào giữa vùng nhìn thấy của table
    requestAnimationFrame(() => {
      const el = rowRefs.current[emp.userId];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });

    // Tự tắt highlight sau vài giây
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => {
      setHighlightedUserId(null);
    }, 4000);
  }, [data, searchQuery, toast]);

  const onSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      runSearch();
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setHighlightedUserId(null);
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
  };

  return (
    // ──────────────────────────────────────────────────────────────────────
    // LAYOUT (10/2026 redesign):
    //   - Padding ngoài rộng rãi (p-4 md:p-6) để nội dung không dính mép màn.
    //   - Mỗi khối (back · header · legend · table) tách rời nhau bằng
    //     space-y-4 thay vì xếp sát như trước — dễ đọc, dễ nhận biết nhóm.
    //   - Vẫn giữ chiều cao full-screen để bảng ngày × nhân viên có thể
    //     scroll nội bộ, nhưng container ngoài padding đều mọi phía.
    // ──────────────────────────────────────────────────────────────────────
    <div className="h-screen flex flex-col bg-canvas overflow-hidden">
      <div className="flex-1 flex flex-col min-h-0 max-w-[1600px] w-full mx-auto
                      px-4 md:px-6 pt-4 md:pt-5 pb-4 md:pb-6 space-y-3 md:space-y-4">

        {/* Back */}
        <div className="shrink-0 w-fit">
          <BackButton fallback="/owner/attendance" />
        </div>

        {/* Header — bo tròn, nền trắng, tách khỏi legend bên dưới */}
        <div className="shrink-0 rounded-2xl bg-surface border border-hairline-2 shadow-sm px-4 md:px-5 py-3 md:py-4">
          <PageHeader
            icon={CalendarCheck}
            title="Chuyên cần"
            subtitle={`Đi trễ / về sớm tháng ${String(month).padStart(2, '0')}/${year}`}
            right={
              <div className="flex items-center gap-2">
                <SecondaryButton onClick={load} disabled={loading}>
                  <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Làm mới
                </SecondaryButton>
                <MonthYearPicker month={month} year={year} onChange={handlePickMonth} />
              </div>
            }
          />
        </div>

        {/* Legend + Search — card riêng, có padding thoáng */}
        <SectionCard className="shrink-0 !p-3 md:!p-4">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5 justify-between">
            <div className="flex flex-wrap gap-x-3.5 gap-y-1.5 text-xs text-muted">
              <LegendItem color="text-red-600" label="Đỏ: đi trễ / về sớm" />
              <LegendItem color="text-emerald-600" label="Xanh lá: đúng giờ (có du di 5')" />
              <LegendItem color="text-blue-600" label="Xanh dương: đi sớm / về trễ" />
              <LegendItem color="bg-red-100 inline-block w-3 h-3 rounded align-middle" label="Chủ nhật" isBox />
              <LegendItem color="bg-blue-100 inline-block w-3 h-3 rounded align-middle" label="Ngày lễ" isBox />
              <LegendItem color="bg-emerald-100 inline-block w-3 h-3 rounded align-middle" label="Phép có duyệt" isBox />
              <LegendItem color="bg-emerald-100 inline-block w-3 h-3 rounded align-middle relative" label="Làm ở nhà (W)" isBox />
              <LegendItem color="border border-dashed border-amber-400 inline-block w-3 h-3 rounded align-middle" label="Thiếu giờ vào/ra (fill 08:00 / 17:00)" isBox />
            </div>

            {/* Ô search fuzzy theo tên */}
            <div className="relative flex items-center gap-1.5 min-w-[220px] max-w-[320px] w-full sm:w-auto">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={onSearchKeyDown}
                  placeholder="Tìm tên nhân viên…"
                  className="w-full pl-8 pr-8 py-2 text-sm rounded-xl bg-canvas border border-hairline-2
                    text-ink placeholder:text-muted/60 focus:outline-none focus:border-gold/60 focus:ring-1 focus:ring-gold/30"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={clearSearch}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-ink p-0.5"
                    aria-label="Xóa tìm kiếm"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => runSearch()}
                disabled={!searchQuery.trim() || loading}
                className="shrink-0 px-3.5 py-2 rounded-xl text-sm font-semibold bg-gold text-white
                  hover:bg-gold/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Tìm
              </button>
            </div>
          </div>
        </SectionCard>

        {loading ? (
          <SectionCard className="flex-1 flex items-center justify-center">
            <LoadingSpinner />
          </SectionCard>
        ) : !data || data.employees.length === 0 ? (
          <SectionCard className="flex-1 flex items-center justify-center">
            <EmptyState
              icon={AlertCircle}
              title="Chưa có dữ liệu chuyên cần"
              hint={`Tháng ${month}/${year} chưa upload file chấm công hoặc chưa bấm Tính lương.`}
            />
          </SectionCard>
        ) : (
          // Card bảng: bo góc lớn, viền mềm, có shadow nhẹ — tách hẳn khỏi
          // background canvas để nhìn ra "khối dữ liệu" rõ ràng.
          <SectionCard className="flex-1 flex flex-col min-h-0 overflow-hidden !p-0 rounded-2xl shadow-sm">
            <div ref={tableScrollRef} className="flex-1 overflow-auto relative">
              <table className="border-collapse text-xs w-full" style={{ minWidth: 'max-content' }}>
                <thead className="sticky top-0 z-10 bg-surface shadow-sm">
                  <tr>
                    <th className="sticky left-0 z-20 bg-surface border border-hairline-2 px-3 py-2 text-left min-w-[200px]">
                      <div className="font-bold text-ink">Nhân viên</div>
                    </th>
                    {Array.from({ length: data.daysInMonth }, (_, i) => (
                      <DayHeaderCell
                        key={i}
                        day={i + 1}
                        year={year}
                        month={month}
                        isSunday={data.sundays[i]}
                        isHoliday={data.holidays[i]}
                      />
                    ))}
                    <th className="border border-hairline-2 px-2 py-2 text-center min-w-[72px] bg-red-50 dark:bg-red-500/10">
                      <div className="text-[10px] font-bold text-red-700 dark:text-red-300 leading-tight">Tổng</div>
                      <div className="text-[10px] font-normal text-red-700/70 dark:text-red-300/70 leading-tight">trễ (phút)</div>
                    </th>
                    <th className="border border-hairline-2 px-2 py-2 text-center min-w-[72px] bg-red-50 dark:bg-red-500/10">
                      <div className="text-[10px] font-bold text-red-700 dark:text-red-300 leading-tight">Tổng</div>
                      <div className="text-[10px] font-normal text-red-700/70 dark:text-red-300/70 leading-tight">sớm (phút)</div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.employees.map(emp => {
                    const isHighlight = highlightedUserId === emp.userId;
                    return (
                      <tr
                        key={emp.userId}
                        ref={(el) => { if (el) rowRefs.current[emp.userId] = el; }}
                        className={`
                          group transition-colors duration-200
                          ${isHighlight
                            ? 'bg-amber-200/90 dark:bg-amber-500/30 ring-2 ring-inset ring-amber-400 dark:ring-amber-500'
                            : 'hover:bg-amber-50/80 dark:hover:bg-amber-500/10'}
                        `}
                      >
                        <td
                          className={`
                            sticky left-0 z-10 border border-hairline-2 px-3 py-1.5 min-w-[200px]
                            transition-colors duration-200
                            ${isHighlight
                              ? 'bg-amber-200/90 dark:bg-amber-500/30'
                              : 'bg-surface group-hover:bg-amber-50/80 dark:group-hover:bg-amber-500/10'}
                          `}
                        >
                          <div className="font-semibold text-ink text-xs">{emp.fullName}</div>
                        </td>
                        {emp.days.map((c, i) => <DayCell key={i} cell={c} />)}
                        <td
                          className={`
                            border border-hairline-2 px-2 py-1.5 text-center text-sm font-bold
                            text-red-700 dark:text-red-300 transition-colors duration-200
                            ${isHighlight
                              ? 'bg-amber-200/70 dark:bg-amber-500/25'
                              : 'bg-red-50/50 dark:bg-red-500/5 group-hover:bg-amber-50/60 dark:group-hover:bg-amber-500/15'}
                          `}
                        >
                          {emp.totalLateMinutes}
                        </td>
                        <td
                          className={`
                            border border-hairline-2 px-2 py-1.5 text-center text-sm font-bold
                            text-red-700 dark:text-red-300 transition-colors duration-200
                            ${isHighlight
                              ? 'bg-amber-200/70 dark:bg-amber-500/25'
                              : 'bg-red-50/50 dark:bg-red-500/5 group-hover:bg-amber-50/60 dark:group-hover:bg-amber-500/15'}
                          `}
                        >
                          {emp.totalEarlyLeaveMinutes}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </SectionCard>
        )}
      </div>
    </div>
  );
}

function LegendItem({ color, label, isBox }) {
  return (
    <div className="flex items-center gap-1.5">
      {isBox
        ? <span className={color} />
        : <span className={`font-bold ${color}`}>■</span>}
      <span>{label}</span>
    </div>
  );
}