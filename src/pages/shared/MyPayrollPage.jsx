// src/pages/shared/MyPayrollPage.jsx
// "QUẢN LÝ LƯƠNG" — trang dùng chung cho MỌI BỘ PHẬN:
//   · Xưởng sản xuất (FACTORY_*)  → có bảng "Thưởng KPI sản xuất"
//   · Kế toán / Kinh doanh / Kho  → KHÔNG có bảng KPI (sẽ bổ sung bảng riêng sau)
//   · Tài xế (DRIVER)             → KHÔNG có bảng chấm công, thay bằng số km/ngày
//
// Luồng:
//   1. Chọn tháng — CHỈ các tháng ĐÃ QUA.
//   2. OWNER chưa bấm "Hoàn tất" cho tháng + bộ phận → "Đang xử lý lương".
//   3. Đã hoàn tất → Phiếu lương (chi tiết lương) + ngày công / km + KPI (nếu có).
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Wallet, ChevronDown, Calendar, Award, Factory, AlertCircle, Loader2, X,
  Truck, Route, Package, MapPin, Lock, Gift,
} from 'lucide-react';import { factoryPayrollApi } from '../../api/factoryPayrollApi';
import { useAuth } from '../../context/AuthContext';
import { PageHeader, SectionCard, LoadingSpinner, formatCurrency } from '../../components/ui';
import PayslipBreakdownCards from '../../components/hr/PayslipBreakdownCards';
import AttendanceDayCalendar, {
  DayDetailPlaceholder, WEEKDAY_LABEL,
} from '../../components/hr/AttendanceDayCalendar';
import PayrollLockPage from './PayrollLockPage';
import { payrollPasscodeApi, parsePasscodeError } from '../../api/payrollPasscodeApi';

// ══════════════════════════════════════════════════════════════════════════════
// TIỆN ÍCH
// ══════════════════════════════════════════════════════════════════════════════

const fmtVnd = (v) => (v == null ? '—' : formatCurrency(v));
const fmtNum = (v, d = 2) =>
  v == null ? '—' : Number(v).toLocaleString('vi-VN', { maximumFractionDigits: d });


/** Mức độ chạy xe trong ngày của tài xế — tô màu ô lịch theo số km. */
const KM_LEVEL = [
  { min: 120, cls: 'bg-gold-deep text-white border-gold-deep', label: 'Trên 120 km' },
  { min: 60, cls: 'bg-gold text-white border-gold', label: '60 – 120 km' },
  { min: 1, cls: 'bg-gold/20 text-gold-deep border-gold/40', label: 'Dưới 60 km' },
  { min: 0, cls: 'bg-canvas text-faint border-hairline', label: 'Không chạy' },
];
const kmLevel = (km) => KM_LEVEL.find(l => (km || 0) >= l.min) || KM_LEVEL[KM_LEVEL.length - 1];

/**
 * MÀU Ô LỊCH theo yêu cầu:
 *   GREEN  = có chạy (km > 0)
 *   YELLOW = có điểm danh nhưng ODO start = end (km = 0)
 *   GRAY   = không chạy / không có dữ liệu
 */
const DAY_COLOR = {
  GREEN: { cls: 'bg-emerald-500 text-white border-emerald-500', dot: 'bg-emerald-500', label: 'Có chạy' },
  YELLOW: { cls: 'bg-amber-400 text-amber-950 border-amber-400', dot: 'bg-amber-400', label: 'ODO đầu = cuối' },
  GRAY: { cls: 'bg-canvas text-faint border-hairline', dot: 'bg-hairline-2', label: 'Không chạy' },
  // (10/2026) Thêm 2 màu riêng — ưu tiên khi NV không chạy (nếu chạy giữ xanh)
  SUNDAY: { cls: 'bg-red-500 text-white border-red-500', dot: 'bg-red-500', label: 'Chủ Nhật' },
  HOLIDAY: { cls: 'bg-blue-500 text-white border-blue-500', dot: 'bg-blue-500', label: 'Lễ / Tết' },
};
const dayColorCfg = (d) => {
  // Có chạy xe → giữ GREEN/YELLOW (NV đi làm bất kể lễ hay CN)
  if (d?.dayColor === 'GREEN' || d?.dayColor === 'YELLOW') return DAY_COLOR[d.dayColor];
  // CN mà không chạy → đỏ
  if (d?.weekday === 8) return DAY_COLOR.SUNDAY;
  // Lễ (type HOLIDAY nếu BE trả) → xanh dương
  if (d?.type === 'HOLIDAY' || d?.isHoliday) return DAY_COLOR.HOLIDAY;
  return DAY_COLOR[d?.dayColor] || DAY_COLOR.GRAY;
};


// ══════════════════════════════════════════════════════════════════════════════
// CHỌN THÁNG
// ══════════════════════════════════════════════════════════════════════════════

function PeriodPicker({ periods, value, onChange, loading }) {
  const [open, setOpen] = useState(false);

  const current = periods.find(
    p => p.month === value?.month && p.year === value?.year
  );

  const grouped = useMemo(() => {
    const map = new Map();
    for (const p of periods) {
      if (!map.has(p.year)) map.set(p.year, []);
      map.get(p.year).push(p);
    }
    return [...map.entries()];
  }, [periods]);

  return (
    <div className="relative w-full sm:w-auto sm:shrink-0">
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        disabled={loading || !periods.length}
        className="
          flex items-center gap-2.5 w-full sm:w-auto min-w-0 sm:min-w-[190px]
          px-4 py-2.5 rounded-2xl bg-surface border border-hairline-2 shadow-sm
          hover:border-gold/50 transition-colors disabled:opacity-50
        "
      >
        <Calendar size={16} className="text-gold shrink-0" />
        <span className="flex-1 text-left text-sm font-bold text-ink">
          {current?.label || 'Chọn tháng'}
        </span>
        <ChevronDown size={15}
          className={`text-muted transition-transform shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          <div className="
            absolute left-0 right-auto sm:left-auto sm:right-0 z-50 mt-2
            w-full sm:w-[260px] max-w-[calc(100vw-2rem)] max-h-[380px]
            overflow-y-auto overscroll-contain bg-surface rounded-2xl
            border border-hairline-2 shadow-xl p-2
          ">
            {grouped.map(([year, items]) => (
              <div key={year} className="mb-1 last:mb-0">
                <p className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">
                  Năm {year}
                </p>

                {items.map(p => {
                  const active = p.month === value?.month && p.year === value?.year;
                  return (
                    <button
                      type="button"
                      key={`${p.year}-${p.month}`}
                      onClick={() => { onChange(p); setOpen(false); }}
                      className={`
                        w-full flex items-center justify-between gap-2 px-3 py-2
                        rounded-xl text-sm transition-colors
                        ${active
                          ? 'bg-gold text-white font-bold'
                          : 'text-ink hover:bg-canvas'}
                      `}
                    >
                      <span>Tháng {p.month}</span>

                      {/* (10/2026) 3 trạng thái:
                        * chưa tính lương       → "Đang xử lý" (vàng)
                        * đã tính lương         → "Đã có lương" (xanh)
                        * đã tính lương+thưởng  → "Đã có lương/thưởng" (xanh đậm)
                        */}
                      {!p.finalized ? (
                        <span className={`
                          shrink-0 whitespace-nowrap text-[10px] font-semibold
                          px-1.5 py-0.5 rounded-md
                          ${active ? 'bg-white/20 text-white' : 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300'}
                        `}>
                          Đang xử lý
                        </span>
                      ) : (
                        <span className={`
                          shrink-0 whitespace-nowrap text-[10px] font-semibold
                          px-1.5 py-0.5 rounded-md
                          ${active ? 'bg-white/20 text-white'
                            : p.bonusReady
                              ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                              : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'}
                        `}>
                          {p.bonusReady ? 'Đã có lương/thưởng' : 'Đã có lương'}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TRẠNG THÁI "ĐANG XỬ LÝ LƯƠNG"
// ══════════════════════════════════════════════════════════════════════════════

function ProcessingState({ label, departmentLabel }) {
  return (
    <SectionCard>
      <div className="flex flex-col items-center gap-4 py-16 px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center">
          <Loader2 size={26} className="text-amber-500 animate-spin" />
        </div>
        <div className="space-y-1.5">
          <p className="text-lg font-bold text-ink">Đang xử lý lương</p>
          <p className="text-sm text-muted max-w-sm leading-relaxed">
            Lương <strong>{label}</strong>
            {departmentLabel ? <> của bộ phận <strong>{departmentLabel}</strong></> : null}
            {' '}chưa được chốt. Phiếu lương sẽ hiển thị ngay khi ban quản lý hoàn tất xử lý.
          </p>
        </div>
      </div>
    </SectionCard>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// LỊCH CHẤM CÔNG (mọi bộ phận trừ Tài xế)
// ══════════════════════════════════════════════════════════════════════════════

function AttendanceCalendar({ attendance, month, year }) {
  if (!attendance?.days?.length) return null;
  return (
    <SectionCard>
      <AttendanceDayCalendar attendance={attendance} month={month} year={year} />
    </SectionCard>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// CHI TIẾT 1 NGÀY CHẠY XE — cột phải của lịch tài xế
// ══════════════════════════════════════════════════════════════════════════════

function DriverDayDetail({ day, month, year, kmPerTrip, onClose }) {
  if (!day) return null;

  const dateStr = `${String(day.day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
  const cfg = dayColorCfg(day);
  const estimated = day.kmSource !== 'ODOMETER';
  const odo = day.odo || [];

  return (
    <div className="lg:h-full flex flex-col rounded-2xl border border-gold/30 overflow-hidden
      bg-gradient-to-br from-gold/10 to-transparent">

      <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-3
        border-b border-gold/20">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${cfg.cls}`}>
            <Truck size={15} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-ink leading-tight">
              {dateStr} · Thứ {day.weekdayLabel}
            </p>
            <p className="text-[11px] text-muted mt-0.5">
              {day.orderCount ? `${day.orderCount} đơn · ${day.trips} chuyến` : 'Không có đơn được phân công'}
            </p>
          </div>
        </div>
        <button onClick={onClose}
          className="p-1.5 rounded-lg text-muted hover:text-ink
            hover:bg-surface/60 transition-colors shrink-0">
          <X size={15} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Tổng km trong ngày */}
        <div className="bg-surface rounded-2xl border border-hairline px-4 py-3.5">
          <p className="text-[10px] uppercase tracking-wide text-muted font-bold">
            Tổng số km đã chạy
          </p>
          <p className="text-3xl font-bold text-gold leading-none mt-1.5">
            {fmtNum(day.totalKm, 1)} <span className="text-base font-semibold text-muted">km</span>
          </p>
          <p className="text-[11px] text-muted mt-2 leading-snug">
            {estimated
              ? `Ước tính từ các đơn được phân công: ${day.trips || 0} chuyến × ${fmtNum(kmPerTrip, 0)} km/chuyến.`
              : 'Số liệu thật, lấy từ chốt odo vào ca / kết ca của ngày này.'}
          </p>
        </div>

        {/* Chi tiết điểm danh ODO */}
        {odo.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-wide font-bold text-muted">
              Chi tiết điểm danh
            </p>
            {odo.map((o, i) => (
              <div key={i} className="bg-surface rounded-xl border border-hairline px-3.5 py-2.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-ink">
                    {o.vehicleType === 'TRUCK' ? 'Xe tải' : o.vehicleType === 'MOTORBIKE' ? 'Xe máy' : o.vehicleType}
                  </span>
                  <span className="text-[11px] font-bold text-gold">
                    {o.km != null ? `${fmtNum(o.km, 0)} km` : '—'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-canvas rounded-lg px-2.5 py-1.5">
                    <p className="text-[10px] text-muted">ODO vào ca</p>
                    <p className="text-xs font-bold text-ink">{o.odoStart != null ? fmtNum(o.odoStart, 0) : '—'}</p>
                    {o.startRecordedBy && (
                      <p className="text-[10px] text-muted mt-0.5 truncate">bởi {o.startRecordedBy}</p>
                    )}
                  </div>
                  <div className="bg-canvas rounded-lg px-2.5 py-1.5">
                    <p className="text-[10px] text-muted">ODO kết ca</p>
                    <p className="text-xs font-bold text-ink">{o.odoEnd != null ? fmtNum(o.odoEnd, 0) : '—'}</p>
                    {o.endRecordedBy && (
                      <p className="text-[10px] text-muted mt-0.5 truncate">bởi {o.endRecordedBy}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Danh sách đơn */}
        {day.orders?.length ? (
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-wide font-bold text-muted">
              Đơn hàng trong ngày
            </p>
            {day.orders.map(o => (
              <div key={o.orderId}
                className="bg-surface rounded-xl border border-hairline px-3.5 py-2.5 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-ink truncate">{o.orderCode}</p>
                    <p className="text-[11px] text-muted truncate">{o.customerName || '—'}</p>
                  </div>
                  <span className="text-[11px] font-bold text-gold shrink-0 whitespace-nowrap">
                    {fmtNum(o.km, 1)} km
                  </span>
                </div>
                {o.deliveryAddress && (
                  <p className="flex items-start gap-1 text-[10px] text-muted leading-snug">
                    <MapPin size={11} className="shrink-0 mt-0.5" />
                    <span className="truncate">{o.deliveryAddress}</span>
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md
                    bg-canvas text-ink-2">{o.statusLabel}</span>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md
                    bg-canvas text-ink-2">{o.trips} chuyến</span>
                  {o.warehouseName && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md
                      bg-canvas text-ink-2">{o.warehouseName}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted text-center py-3">
            Ngày này không có đơn hàng nào được phân công cho bạn.
          </p>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// LỊCH CHẠY XE CỦA TÀI XẾ — layout y hệt bảng chấm công
// ══════════════════════════════════════════════════════════════════════════════

function DriverCalendar({ driver, month, year }) {
  const [selected, setSelected] = useState(null);
  const days = driver?.days || [];

  useEffect(() => { setSelected(null); }, [month, year]);

  if (!days.length) return null;

  const leading = Math.max(0, days[0].weekday - 2);
  const cells = [...Array(leading).fill(null), ...days];

  // Chỉ hiện chú thích màu thực sự xuất hiện trong tháng.
  const usedColors = ['GREEN', 'YELLOW', 'GRAY']
    .filter(c => days.some(d => (d.dayColor || 'GRAY') === c))
    .map(c => ({ key: c, ...DAY_COLOR[c] }));

  return (
    <SectionCard>
      <div className="flex items-center justify-between px-5 py-4 border-b border-hairline">
        <div className="flex items-center gap-2">
          <Route size={16} className="text-gold" />
          <h3 className="text-sm font-bold text-ink">Chi tiết số km theo ngày</h3>
        </div>
        <span className="text-xs font-semibold text-muted">
          {fmtNum(driver.totalKm, 1)} km · {driver.totalOrders ?? 0} đơn
        </span>
      </div>

      <div className="p-4 sm:p-5">
        <div className="grid lg:grid-cols-[auto_1fr] gap-5 lg:gap-8 lg:items-stretch">

          {/* CỘT TRÁI — lưới ngày trong tháng */}
          <div>
            <p className="text-[11px] text-muted mb-3 lg:hidden">
              Bấm vào một ngày để xem số km và các đơn đã giao trong ngày đó.
            </p>

            {/* (10/2026) Tăng cell từ 44px → 64px để chứa đủ 3 dòng:
              *   1. Số ngày (bold)
              *   2. Số km (nhỏ)
              *   3. Số đơn (nhỏ)
              */}
            <div className="grid grid-cols-[repeat(7,64px)] gap-1.5 mb-1.5">
              {[2, 3, 4, 5, 6, 7, 8].map(w => (
                <div key={w} className="text-center text-[10px] font-bold text-muted">
                  {WEEKDAY_LABEL[w]}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-[repeat(7,64px)] gap-1.5">
              {cells.map((d, i) => {
                if (!d) return <div key={`empty-${i}`} />;
                const cfg = dayColorCfg(d);
                const isSelected = selected?.day === d.day;
                const clickable = (d.totalKm || 0) > 0 || (d.orderCount || 0) > 0
                  || (d.odo && d.odo.length > 0);
                const km = d.totalKm || 0;
                const orderCnt = d.orderCount || 0;

                return (
                  <button key={d.day}
                    onClick={() => setSelected(isSelected ? null : d)}
                    title={`Ngày ${d.day} · ${fmtNum(km, 1)} km · ${orderCnt} đơn`}
                    className={`h-16 rounded-lg border flex flex-col items-center justify-center
                      leading-tight transition-all ${cfg.cls}
                      ${clickable ? 'hover:scale-105 cursor-pointer' : 'cursor-default'}
                      ${isSelected ? 'ring-2 ring-gold ring-offset-1 scale-105' : ''}`}
                  >
                    <span className="text-[13px] font-bold">{d.day}</span>
                    {km > 0 && (
                      <span className="text-[9px] font-semibold opacity-85 mt-0.5">
                        {Math.round(km)} km
                      </span>
                    )}
                    {orderCnt > 0 && (
                      <span className="text-[9px] font-semibold opacity-75">
                        {orderCnt} đơn
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4 pt-4 border-t border-hairline
              max-w-[340px]">
              {usedColors.map(l => (
                <div key={l.key} className="flex items-center gap-1.5">
                  <span className={`w-3.5 h-3.5 rounded-md border ${l.cls}`} />
                  <span className="text-[11px] text-muted font-medium">{l.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* CỘT PHẢI — chi tiết ngày / placeholder giống các role khác */}
          <div className="min-w-0 lg:h-full lg:min-h-[300px]">
            {selected ? (
              <DriverDayDetail day={selected} month={month} year={year}
                kmPerTrip={driver.kmPerTrip} onClose={() => setSelected(null)} />
            ) : (
              <DayDetailPlaceholder
                description="Bấm vào ô ngày bên trái để xem tổng số km đã chạy và danh sách đơn hàng được phân công trong ngày đó." />
            )}
          </div>
        </div>

        {/* Tổng kết tháng */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-5 pt-5 border-t border-hairline">
          {[
            { label: 'Tổng km trong tháng', value: fmtNum(driver.totalKm, 1), color: 'text-gold' },
            { label: 'Số ngày có chạy', value: driver.activeDays ?? 0, color: 'text-emerald-600 dark:text-emerald-300' },
            { label: 'Tổng số đơn', value: driver.totalOrders ?? 0, color: 'text-ink' },
            { label: 'Tổng số lượt giao', value: driver.totalTrips ?? 0, color: 'text-blue-600 dark:text-blue-300' },
          ].map(st => (
            <div key={st.label} className="bg-canvas rounded-xl px-3 py-2.5">
              <p className="text-[11px] text-muted font-medium">{st.label}</p>
              <p className={`text-lg font-bold mt-0.5 leading-tight ${st.color}`}>{st.value}</p>
            </div>
          ))}
        </div>

        {/* Bảng tính lương — khi OWNER đã nhập giá xăng + đơn giá thưởng và Hoàn tất */}
        {driver.totalSalary != null && (
          <div className="mt-4 rounded-2xl border border-gold/30 bg-gradient-to-br from-gold/10 to-transparent p-4">
            <p className="text-[11px] uppercase tracking-wide font-bold text-muted mb-3">Lương tháng này</p>
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted">
                  Tiền xăng: {fmtNum(driver.totalKm, 1)} km × {fmtVnd(driver.gasPrice)}/km
                </span>
                <span className="font-semibold text-ink">{fmtVnd(driver.fuelPay)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">
                  Thưởng: {driver.totalTrips ?? 0} lượt × {fmtVnd(driver.bonusUnitPrice)}/lượt
                </span>
                <span className="font-semibold text-ink">{fmtVnd(driver.bonusPay)}</span>
              </div>
              <div className="flex items-center justify-between pt-2 mt-1 border-t border-gold/20">
                <span className="font-bold text-ink">Tổng lương</span>
                <span className="text-lg font-bold text-gold">{fmtVnd(driver.totalSalary)}</span>
              </div>
            </div>
          </div>
        )}

        <p className="text-[11px] text-muted mt-3 leading-relaxed">
          Số km được ước tính từ các đơn hàng <strong>đã và đang giao</strong> mà bạn được phân công
          trong ngày ({fmtNum(driver.kmPerTrip, 0)} km/chuyến). Ngày nào kho có chốt odo vào ca /
          kết ca thì hệ thống lấy đúng số km thật thay cho ước tính.
        </p>
      </div>
    </SectionCard>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// BREAKDOWN THƯỞNG KPI — CHỈ bộ phận Xưởng sản xuất
// ══════════════════════════════════════════════════════════════════════════════

function KpiBreakdown({ kpi, amount }) {
  if (!kpi) return null;

  // CỐ Ý KHÔNG hiển thị "Tổng hệ số toàn xưởng" và "Hệ số chia": đó là số liệu
  // nội bộ của cả xưởng, nhân viên chỉ cần biết quỹ hình thành thế nào và mình
  // nhận bao nhiêu. Hiện hệ số còn dễ gây so bì lương giữa các vị trí.
  // (10/2026) BỎ dòng "Đơn giá thưởng" + bỏ sub công thức đơn giá —
  // yêu cầu nghiệp vụ: nhân viên không cần thấy đơn giá/tấn.
  const steps = [
    {
      label: 'Tổng sản lượng xưởng trong tháng',
      value: `${fmtNum(kpi.totalOutputKg)} kg`,
      sub: `= ${fmtNum(kpi.totalOutputTon, 4)} tấn`,
    },
    {
      label: 'Tổng tiền thưởng cả xưởng',
      value: fmtVnd(kpi.bonusPool),
      highlight: true,
    },
  ];

  const carryDetail = kpi.carryOverInDetail || [];

  if (kpi.carryOverIn > 0) {
    steps.push({
      label: 'Quỹ dư các tháng trước chia tiếp',
      value: `+ ${fmtVnd(kpi.carryOverIn)}`,
      // Nêu rõ từng khoản của tháng nào — quỹ dư có thể tích tụ qua nhiều tháng
      sub: carryDetail.length
        ? carryDetail.map(c => `${fmtVnd(c.amount)} của ${c.label}`).join(' · ')
        : null,
    });
  }
  if (kpi.securityTotal > 0) {
    steps.push({ label: 'Trừ thưởng cố định cho bảo vệ', value: `− ${fmtVnd(kpi.securityTotal)}` });
  }

  return (
    <SectionCard>
      <div className="flex items-center justify-between px-5 py-4 border-b border-hairline">
        <div className="flex items-center gap-2">
          <Award size={16} className="text-gold" />
          <h3 className="text-sm font-bold text-ink">Thưởng KPI sản xuất</h3>
        </div>
        <span className="text-base font-bold text-gold">{fmtVnd(amount)}</span>
      </div>

      <div className="p-5 grid lg:grid-cols-2 gap-5">
        <div>
          <p className="text-[11px] uppercase tracking-wide font-bold text-muted mb-2.5">
            Quỹ thưởng chung
          </p>
          <div className="space-y-2">
            {steps.map((s, i) => (
              <div key={i}
                className={`flex items-start justify-between gap-3 px-3.5 py-2.5 rounded-xl
                  ${s.highlight ? 'bg-gold/10 border border-gold/25' : 'bg-canvas'}`}>
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-ink leading-snug">{s.label}</p>
                  {s.sub && <p className="text-[11px] text-muted mt-0.5 leading-snug">{s.sub}</p>}
                </div>
                <span className={`text-sm font-bold shrink-0 whitespace-nowrap
                  ${s.highlight ? 'text-gold' : 'text-ink'}`}>
                  {s.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[11px] uppercase tracking-wide font-bold text-muted mb-2.5">
            Phần của bạn
          </p>

          <div className="bg-gradient-to-br from-gold/15 to-gold/5
            border border-gold/30 rounded-2xl px-4 py-4">
            <p className="text-[13px] text-ink-2">
              Vị trí <strong>{kpi.myRoleLabel || '—'}</strong>
              {kpi.myFixedRole && ' — hưởng mức thưởng KPI cố định hàng tháng'}
            </p>
            <p className="text-3xl font-bold text-gold mt-2 leading-none">{fmtVnd(amount)}</p>
            <p className="text-[11px] text-muted mt-2">Thưởng KPI thực nhận tháng này</p>
          </div>

          {kpi.carryOverOut > 0 && (
            <p className="text-[11px] text-muted bg-canvas rounded-xl px-3.5 py-2.5 mt-2 leading-relaxed">
              Phần chưa chia hết <strong>{fmtVnd(kpi.carryOverOut)}</strong> được
              chuyển sang quỹ thưởng của tháng sau.
            </p>
          )}
        </div>
      </div>
    </SectionCard>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// (10/2026) THƯỞNG DOANH THU — KT/KD/Driver
//
// FACTORY đã có KpiBreakdown (card chi tiết công thức xưởng SX). KT/KD/Driver
// trước đây không có card nào → chỉ hiển thị dòng "+X đ" nhỏ trên dark header
// phiếu lương, user kêu "ko thấy chi tiết". Component này bổ sung card tương
// đương: hiển thị số thưởng + chi tiết công thức (nếu có).
// ══════════════════════════════════════════════════════════════════════════════

/**
 * (10/2026) Card "Thưởng hỗ trợ bán hàng" — cho NV ko thuộc SALES
 * nhưng có tạo đơn trong tháng (NV kho, trưởng xưởng kiêm bán, …).
 * Hiển thị tổng thưởng + doanh thu chia hoa hồng cá nhân.
 */
function SalesSupportBonusCard({ deptLabel, amount, revenue, month, year }) {
  const monthStr = String(month).padStart(2, '0');
  return (
    <SectionCard>
      <div className="flex items-center justify-between px-5 py-4 border-b border-hairline">
        <div className="flex items-center gap-2">
          <Gift size={16} className="text-emerald-500" />
          <h3 className="text-sm font-bold text-ink">
            Thưởng hỗ trợ bán hàng tháng {monthStr}/{year}
          </h3>
        </div>
        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          {deptLabel}
        </span>
      </div>
      <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-hairline bg-canvas/40 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
            Doanh thu chia hoa hồng
          </p>
          <p className="text-lg font-bold tabular-nums mt-1 text-ink">
            {Number(revenue || 0).toLocaleString('vi-VN')}đ
          </p>
          <p className="text-[11px] text-muted mt-0.5">
            Σ thực thu EX-VAT từ đơn bạn tạo trong tháng
          </p>
        </div>
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/10 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
            Tiền thưởng hỗ trợ bán hàng
          </p>
          <p className="text-lg font-bold tabular-nums mt-1 text-emerald-700 dark:text-emerald-200">
            {Number(amount || 0).toLocaleString('vi-VN')}đ
          </p>
          <p className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80 mt-0.5">
            Chi riêng, không cộng vào phiếu lương
          </p>
        </div>
      </div>
    </SectionCard>
  );
}

function OfficeOrDriverBonusCard({ dept, deptLabel, amount, driver, salaryDetail, slip }) {
  const isDriver  = dept === 'DRIVER';
  const isSales   = dept === 'SALES';
  const isAcc     = dept === 'ACCOUNTING';
  const isSupport = dept === 'SUPPORT'; // NV ko thuộc DRIVER mà có km/trips

  // Driver: lấy chi tiết tiền xăng + bonus đơn từ salaryDetail (BE đã dựng sẵn).
  // Dùng cho CẢ nhân viên tài xế LẪN nhân viên hỗ trợ giao hàng (dept khác
  // nhưng vẫn có driverOrderBonusDetail nếu tháng có lượt giao).
  const dKpi = salaryDetail?.driverOrderBonusDetail;
  const showDriverBreakdown = (isDriver || isSupport)
      && dKpi
      && (dKpi.totalAmount || 0) > 0;

  // Tiêu đề + icon tuỳ loại
  // (10/2026) Driver / NV hỗ trợ giao hàng: label "Thưởng giao hàng tháng N"
  const monthStr = slip?.month ? String(slip.month).padStart(2, '0') : '';
  const title = isDriver  ? `Thưởng giao hàng tháng ${monthStr}`
              : isAcc     ? `Thưởng doanh thu — ${deptLabel || 'Kế toán'}`
              : isSales   ? `Thưởng doanh thu — ${deptLabel || 'Kinh doanh'}`
              : isSupport ? `Thưởng hỗ trợ giao hàng tháng ${monthStr}`
              :             `Thưởng tháng ${monthStr}`;

  return (
    <SectionCard>
      <div className="flex items-center justify-between px-5 py-4 border-b border-hairline">
        <div className="flex items-center gap-2">
          <Award size={16} className="text-gold" />
          <h3 className="text-sm font-bold text-ink">{title}</h3>
        </div>
        <span className="text-base font-bold text-gold">{fmtVnd(amount)}</span>
      </div>

      <div className="p-5 space-y-3">
        {/* ── KẾ TOÁN: chỉ pool phòng (không % tỷ lệ cá nhân) ── */}
        {isAcc && slip?.officeBonusPoolTotal != null && (
          <Row label="Pool thưởng (số tiền chia hoa hồng cả phòng)"
               value={fmtVnd(slip.officeBonusPoolTotal)} />
        )}

        {/* ── KINH DOANH: pool CÁ NHÂN — doanh thu, hold, chia hoa hồng ── */}
        {/* (10/2026) 3 chỉ số KHÁC NHAU:
          *   Doanh thu thực thu = Σ (final − vat) đơn tạo trong tháng (EX-VAT)
          *   Hold               = (final − paid) × netRatio của đơn chưa chốt
          *   Chia hoa hồng      = Σ thực thu EX-VAT từ payment_transaction
          * Trước đây 3 dòng dùng chung field officeBonusPersonalRevenue → sai.
          */}
        {isSales && (
          <div className="space-y-2">
            {slip?.officeBonusPersonalRevenue != null && (
              <Row label="Doanh thu thực thu của bạn trong tháng (EX-VAT)"
                   value={fmtVnd(slip.officeBonusPersonalRevenue)} />
            )}
            {slip?.officeBonusPersonalHold != null && (
              <Row label="Doanh thu đang hold của bạn trong tháng (EX-VAT)"
                   value={fmtVnd(slip.officeBonusPersonalHold)} />
            )}
            {slip?.officeBonusPersonalChiaHoaHong != null && (
              <Row label="Doanh thu chia hoa hồng tháng này"
                   value={fmtVnd(slip.officeBonusPersonalChiaHoaHong)} />
            )}
            {/* (10/2026) Chỉ hiển thị cho SELLER có target cá nhân */}
            {slip?.salesPersonalTarget > 0 && (
              <>
                <Row label="Target doanh thu cá nhân"
                     value={fmtVnd(slip.salesPersonalTarget)} />
                {slip?.salesAchievedPercent != null && (
                  <Row label="Tỷ lệ đạt target"
                       value={<span className={
                         slip.salesAchievedPercent >= 90 ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                         : slip.salesAchievedPercent >= 50 ? 'text-blue-600 dark:text-blue-400 font-bold'
                         : 'text-amber-600 dark:text-amber-400 font-bold'
                       }>
                         {(Math.floor(slip.salesAchievedPercent * 100) / 100).toFixed(2)}%
                       </span>} />
                )}
              </>
            )}
          </div>
        )}

        {/* ── DRIVER + NV HỖ TRỢ GIAO HÀNG: km/tiền xăng, lượt/tiền (KHÔNG hiện đơn giá) ── */}
        {showDriverBreakdown && (
          <div className="space-y-2">
            {(dKpi.gasKm || 0) > 0 && (
              <Row label={`Tiền xăng xe máy — ${fmtNum(dKpi.gasKm, 1)} km`}
                   value={fmtVnd(dKpi.gasAmount)} />
            )}
            {(dKpi.motorbikeTrips || 0) > 0 && (
              <Row label={`Thưởng đơn xe máy — ${dKpi.motorbikeTrips} lượt`}
                   value={fmtVnd(dKpi.motorbikeAmount)} />
            )}
            {(dKpi.truckTrips || 0) > 0 && (
              <Row label={`Thưởng đơn xe tải — ${dKpi.truckTrips} lượt`}
                   value={fmtVnd(dKpi.truckAmount)} />
            )}
          </div>
        )}

        {/* Tổng thưởng — highlight */}
        <div className="rounded-2xl bg-gradient-to-br from-gold/15 to-gold/5
          border border-gold/30 px-4 py-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] text-ink-2">Tổng thưởng tháng này</p>
            <p className="text-[10px] text-muted mt-0.5">
              (Chi riêng ngoài bảng lương chính)
            </p>
          </div>
          <p className="text-2xl font-bold text-gold leading-none">{fmtVnd(amount)}</p>
        </div>
      </div>
    </SectionCard>
  );
}

/** Row item 2 cột: label trái + value phải, có hàng phụ (sub) nhỏ dưới label. */
function Row({ label, sub, value }) {
  return (
    <div className="flex items-start justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-canvas">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-ink leading-snug">{label}</p>
        {sub && <p className="text-[11px] text-muted mt-0.5 leading-snug">{sub}</p>}
      </div>
      <span className="text-sm font-bold text-ink shrink-0 whitespace-nowrap">{value}</span>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// CARD PHIẾU LƯƠNG — header tối + CHI TIẾT LƯƠNG như OWNER xem
// ══════════════════════════════════════════════════════════════════════════════

function PayslipCard({ slip }) {
  const detail = slip.salaryDetail;
  const netSalary = detail?.netSalary;

  return (
    <SectionCard className="overflow-hidden">
      {/* Header tối */}
      <div className="bg-gradient-to-br from-chrome to-chrome px-6 py-5 text-white">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-white/45 font-bold">Phiếu lương</p>
            <p className="text-xl font-bold mt-1">{slip.periodLabel}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-white/90">{slip.userFullName}</p>
            <p className="text-xs text-white/50 mt-0.5">
              {slip.roleLabel || slip.position || '—'}
              {slip.payrollDepartmentLabel ? ` · ${slip.payrollDepartmentLabel}` : ''}
            </p>
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-white/10 flex items-end justify-between gap-4">
          <span className="text-sm font-semibold text-white/70">Lương NET thực nhận</span>
          <span className="text-3xl font-bold text-gold leading-none">
            {fmtVnd(netSalary != null ? netSalary : slip.totalPay)}
          </span>
        </div>

        {/* (10/2026) BỎ dòng "Thưởng KPI / Bonus (chi riêng ngoài bảng lương)"
           + dòng "Thưởng đang được tính..." — thông tin thưởng giờ đã có card
           riêng dưới (OfficeOrDriverBonusCard / KpiBreakdown). Yêu cầu nghiệp vụ:
           dark header chỉ hiển thị Lương NET, không phô thêm. */}
      </div>

      {/* Chi tiết lương — GIỐNG màn hình OWNER xem, chỉ 2 khối đầu */}
      <div className="p-5">
        {detail ? (
          <PayslipBreakdownCards row={detail} />
        ) : (
          <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/28 rounded-xl px-4 py-3">
            <AlertCircle size={16} className="text-amber-600 dark:text-amber-300 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800 dark:text-amber-300">
              Bạn chưa có hồ sơ lương trong hệ thống nên chưa hiển thị được chi tiết lương.
              Vui lòng liên hệ bộ phận nhân sự.
            </p>
          </div>
        )}
      </div>

      {slip.finalizedAt && (
        <p className="px-5 pb-4 text-[11px] text-muted">
          Lương tháng này đã được chốt ngày{' '}
          {new Date(slip.finalizedAt).toLocaleDateString('vi-VN')}.
        </p>
      )}
    </SectionCard>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TRANG CHÍNH
// ══════════════════════════════════════════════════════════════════════════════

function MyPayrollContent({ onNeedPasscode }) {
  const { user } = useAuth();

  const [periods, setPeriods] = useState([]);
  const [selected, setSelected] = useState(null);
  const [slip, setSlip] = useState(null);
  const [loadingPeriods, setLoadingPeriods] = useState(true);
  const [loadingSlip, setLoadingSlip] = useState(false);
  const [error, setError] = useState(null);

  // Nạp danh sách tháng — mặc định chọn tháng gần nhất
  useEffect(() => {
    (async () => {
      setLoadingPeriods(true);
      try {
        const list = await factoryPayrollApi.periods();
        const arr = Array.isArray(list) ? list : [];
        setPeriods(arr);

        if (arr.length) {
          // (10/2026) Mặc định chọn THÁNG GẦN NHẤT ĐÃ TÍNH XONG LƯƠNG (finalized),
          // KHÔNG phải tháng hiện tại. Tháng đang xử lý thì xem cũng chỉ thấy
          // "Đang xử lý lương" — vô ích. periods trả theo thứ tự mới-nhất-trước.
          const latestFinalized = arr.find(p => p.finalized);
          setSelected(latestFinalized || arr[0]);
        }
      } catch (e) {
        setError(e?.response?.data?.message || 'Không tải được danh sách tháng');
      } finally {
        setLoadingPeriods(false);
      }
    })();
  }, []);


  // Nạp phiếu lương khi đổi tháng
  const loadSlip = useCallback(async (p) => {
    if (!p) return;
    setLoadingSlip(true); setError(null); setSlip(null);
    try {
      setSlip(await factoryPayrollApi.myPayslip(p.month, p.year));
    } catch (e) {
      // "Vé" xem lương hết hạn giữa chừng (hoặc bị khoá) → quay lại màn hình
      // passcode thay vì hiện một dòng lỗi đỏ khó hiểu.
      const info = parsePasscodeError(e);
      if (info.required || info.locked) { onNeedPasscode?.(); return; }
      setError(e?.response?.data?.message || 'Không tải được phiếu lương');
    } finally {
      setLoadingSlip(false);
    }
  }, [onNeedPasscode]);

  useEffect(() => { loadSlip(selected); }, [selected, loadSlip]);

  const isDriver = slip?.payrollDepartment === 'DRIVER';

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5 w-full">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <PageHeader
          icon={Wallet}
          title="Quản lý lương"
          subtitle={
            user?.fullName
              ? `${user.fullName} — phiếu lương theo tháng`
              : 'Phiếu lương theo tháng'
          }
        />

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <PeriodPicker
            periods={periods}
            value={selected}
            onChange={setSelected}
            loading={loadingPeriods}
          />

          {/* Khoá lại ngay — hữu ích khi phải rời máy mà chưa đóng trang */}
          <button
            type="button"
            onClick={onNeedPasscode}
            title="Khoá lại màn hình lương"
            className="shrink-0 flex items-center gap-1.5 px-3 py-2.5 rounded-2xl bg-surface
                       border border-hairline-2 shadow-sm text-muted
                       hover:border-gold/50 hover:text-gold transition-colors"
          >
            <Lock size={15} />
            <span className="hidden sm:inline text-xs font-semibold">Khoá lại</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/28 rounded-xl px-4 py-3">
          <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-600 dark:text-red-300 font-medium">{error}</p>
        </div>
      )}

      {loadingPeriods ? (
        <SectionCard><LoadingSpinner label="Đang tải..." /></SectionCard>
      ) : !periods.length ? (
        <SectionCard>
          <div className="flex flex-col items-center gap-3 py-14 px-6 text-center">
            <Calendar size={28} className="text-faint" />
            <p className="text-sm font-semibold text-ink">Chưa có tháng nào để xem</p>
            <p className="text-xs text-muted">Phiếu lương chỉ hiển thị cho các tháng đã kết thúc.</p>
          </div>
        </SectionCard>
      ) : loadingSlip ? (
        <SectionCard><LoadingSpinner label="Đang tải phiếu lương..." /></SectionCard>
      ) : !slip ? null
        : slip.status === 'NO_DEPARTMENT' ? (
          <SectionCard>
            <div className="flex flex-col items-center gap-3 py-14 px-6 text-center">
              <AlertCircle size={28} className="text-faint" />
              <p className="text-sm font-semibold text-ink">
                Tài khoản của bạn chưa được xếp vào bộ phận tính lương
              </p>
              <p className="text-xs text-muted max-w-sm leading-relaxed">
                Vui lòng liên hệ bộ phận nhân sự để cập nhật role nhận lương.
              </p>
            </div>
          </SectionCard>
        ) : slip.status === 'PROCESSING' ? (
          <ProcessingState label={slip.periodLabel}
            departmentLabel={slip.payrollDepartmentLabel} />
        ) : (
          <div className="space-y-5">
            {/* Thông tin nhân viên */}
            <SectionCard>
              <div className="flex items-center gap-2 px-5 py-4 border-b border-hairline">
                {isDriver
                  ? <Truck size={16} className="text-gold" />
                  : <Factory size={16} className="text-gold" />}
                <h3 className="text-sm font-bold text-ink">Thông tin nhân viên</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-5">
                {[
                  { label: 'Họ tên', value: slip.userFullName },
                  { label: 'Bộ phận tính lương', value: slip.payrollDepartmentLabel },
                  { label: 'Vị trí', value: slip.roleLabel || slip.position },
                ].map(f => (
                  <div key={f.label}>
                    <p className="text-[11px] uppercase tracking-wide text-muted font-semibold">{f.label}</p>
                    <p className="text-sm font-medium text-ink mt-1">{f.value || '—'}</p>
                  </div>
                ))}
              </div>
            </SectionCard>

            {slip.status === 'NO_SALARY' && (
              <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/28 rounded-xl px-4 py-3">
                <AlertCircle size={16} className="text-amber-600 dark:text-amber-300 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  Bạn chưa có hồ sơ lương được duyệt nên phiếu lương chưa đầy đủ.
                  Vui lòng liên hệ bộ phận nhân sự.
                </p>
              </div>
            )}

            {/* PHIẾU LƯƠNG — chi tiết lương giống OWNER xem */}
            <PayslipCard slip={slip} />

            {/* (10/2026) THỨ TỰ MỚI theo yêu cầu nghiệp vụ:
              *   3. Thưởng chính (KPI xưởng / doanh thu KT-KD / giao hàng tài xế)
              *   4. Thưởng hỗ trợ giao hàng (nếu NV không thuộc DRIVER mà có km/trips)
              *   5. Chi tiết ngày công (ẩn với tài xế — tài xế chỉ dùng DriverCalendar)
              *   6. Chi tiết số km theo ngày (tài xế LẪN NV hỗ trợ giao hàng)
              */}

            {/* 3a — THƯỞNG KPI xưởng SX (chỉ FACTORY, kpiStatus=PENDING hiện placeholder) */}
            {slip.hasKpiBonus && slip.kpiStatus === 'PENDING' && (
              <SectionCard>
                <div className="flex items-center gap-3 px-5 py-6">
                  <span className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-500/10
                    flex items-center justify-center shrink-0">
                    <Award size={17} className="text-amber-500 animate-pulse" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-ink">Đang tính thưởng / KPI</p>
                    <p className="text-xs text-muted mt-0.5 leading-relaxed">
                      Ban quản lý đang tổng hợp KPI và thưởng cho tháng này.
                      Kết quả sẽ hiển thị ngay khi hoàn tất.
                    </p>
                  </div>
                </div>
              </SectionCard>
            )}
            {slip.hasKpiBonus && slip.kpiStatus === 'READY' && (
              <KpiBreakdown kpi={slip.kpi} amount={slip.kpiBonus} />
            )}

            {/* 3b — THƯỞNG DOANH THU KT/KD / THƯỞNG GIAO HÀNG TÀI XẾ
              * Chỉ render cho KT/KD/DRIVER chính thức (dept-match), không bao
              * gồm NV hỗ trợ giao hàng (họ có card riêng ở 3c). */}
            {!slip.hasKpiBonus
             && (slip.payrollDepartment === 'SALES'
                 || slip.payrollDepartment === 'ACCOUNTING'
                 || slip.payrollDepartment === 'DRIVER')
             && (slip.kpiBonus > 0 && slip.kpiStatus === 'READY') && (
              <OfficeOrDriverBonusCard
                dept={slip.payrollDepartment}
                deptLabel={slip.payrollDepartmentLabel}
                amount={slip.kpiBonus}
                driver={slip.driver}
                salaryDetail={slip.salaryDetail}
                slip={slip}
              />
            )}

            {/* 4 — THƯỞNG HỖ TRỢ GIAO HÀNG (NV không phải DRIVER có km/trips) */}
            {!isDriver
             && slip.payrollDepartment !== 'DRIVER'
             && (slip.salaryDetail?.driverOrderBonusDetail?.totalAmount > 0) && (
              <OfficeOrDriverBonusCard
                dept={'SUPPORT'}
                deptLabel={slip.payrollDepartmentLabel}
                amount={slip.salaryDetail.driverOrderBonusDetail.totalAmount}
                driver={slip.driver}
                salaryDetail={slip.salaryDetail}
                slip={slip}
              />
            )}

            {/* 4b — THƯỞNG HỖ TRỢ BÁN HÀNG (NV không phải SALES có tạo đơn) */}
            {slip.payrollDepartment !== 'SALES'
             && (slip.salesSupportBonus > 0) && (
              <SalesSupportBonusCard
                deptLabel={slip.payrollDepartmentLabel}
                amount={slip.salesSupportBonus}
                revenue={slip.salesSupportRevenue}
                month={slip.month}
                year={slip.year}
              />
            )}

            {/* 5 — CHI TIẾT NGÀY CÔNG (tất cả role TRỪ tài xế) */}
            {!isDriver && <AttendanceCalendar attendance={slip.attendance}
              month={slip.month} year={slip.year} />}

            {/* 6 — CHI TIẾT SỐ KM THEO NGÀY
              * - Tài xế: luôn hiện (thay cho bảng chấm công ở trên)
              * - NV hỗ trợ giao hàng: hiện khi có km/trips > 0 (dưới bảng chấm công)
              */}
            {(isDriver
              || (slip.salaryDetail?.driverOrderBonusDetail?.totalAmount > 0)) && (
              <DriverCalendar driver={slip.driver} month={slip.month} year={slip.year} />
            )}

          </div>
        )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// CỔNG PASSCODE
// ══════════════════════════════════════════════════════════════════════════════
//
// Bọc toàn bộ trang lương bằng màn hình nhập mật khẩu 6 số.
//
// Trạng thái `unlocked` cố ý để trong state của component (KHÔNG dùng
// localStorage/sessionStorage): rời trang là component unmount, quay lại thì
// state khởi tạo lại từ false ⇒ luôn phải nhập passcode. Backend cũng chỉ cấp
// "vé" 15 phút nên không thể lách bằng cách gọi API trực tiếp.
export default function MyPayrollPage() {
  const [unlocked, setUnlocked] = useState(false);

  // Đổi key ⇒ ép PayrollLockPage mount lại (xoá ô nhập, hỏi lại trạng thái khoá)
  const [gateKey, setGateKey] = useState(0);

  const handleUnlocked = useCallback(() => setUnlocked(true), []);

  const handleNeedPasscode = useCallback(() => {
    setUnlocked(false);
    setGateKey(k => k + 1);
    // Huỷ luôn "vé" phía server — bấm "Khoá lại" phải khoá thật, không chỉ ẩn UI
    payrollPasscodeApi.lock().catch(() => { });
  }, []);

  if (!unlocked)
    return <PayrollLockPage key={gateKey} onUnlocked={handleUnlocked} />;

  return <MyPayrollContent onNeedPasscode={handleNeedPasscode} />;
}