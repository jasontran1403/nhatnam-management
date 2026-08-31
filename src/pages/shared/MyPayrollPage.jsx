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
  Truck, Route, Package, MapPin, Lock,
} from 'lucide-react';
import { factoryPayrollApi } from '../../api/factoryPayrollApi';
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
};
const dayColorCfg = (d) => DAY_COLOR[d?.dayColor] || DAY_COLOR.GRAY;


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

                      {/* Chưa HOÀN TẤT thì báo "Đang xử lý" */}
                      {!p.finalized && (
                        <span className={`
                          shrink-0 whitespace-nowrap text-[10px] font-semibold
                          px-1.5 py-0.5 rounded-md
                          ${active ? 'bg-white/20 text-white' : 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300'}
                        `}>
                          Đang xử lý
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

            <div className="grid grid-cols-[repeat(7,44px)] gap-1.5 mb-1.5">
              {[2, 3, 4, 5, 6, 7, 8].map(w => (
                <div key={w} className="text-center text-[10px] font-bold text-muted">
                  {WEEKDAY_LABEL[w]}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-[repeat(7,44px)] gap-1.5">
              {cells.map((d, i) => {
                if (!d) return <div key={`empty-${i}`} />;
                const cfg = dayColorCfg(d);
                const isSelected = selected?.day === d.day;
                const clickable = (d.totalKm || 0) > 0 || (d.orderCount || 0) > 0
                  || (d.odo && d.odo.length > 0);

                return (
                  <button key={d.day}
                    onClick={() => setSelected(isSelected ? null : d)}
                    title={`Ngày ${d.day} · ${fmtNum(d.totalKm, 1)} km · ${d.orderCount || 0} đơn`}
                    className={`h-11 rounded-lg border flex flex-col items-center justify-center
                      leading-none transition-all ${cfg.cls}
                      ${clickable ? 'hover:scale-110 cursor-pointer' : 'cursor-default'}
                      ${isSelected ? 'ring-2 ring-gold ring-offset-1 scale-110' : ''}`}
                  >
                    <span className="text-[12px] font-bold">{d.day}</span>
                    {(d.totalKm || 0) > 0 && (
                      <span className="text-[8px] font-semibold opacity-80 mt-0.5">
                        {Math.round(d.totalKm)}
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
  const steps = [
    {
      label: 'Tổng sản lượng xưởng trong tháng',
      value: `${fmtNum(kpi.totalOutputKg)} kg`,
      sub: `= ${fmtNum(kpi.totalOutputTon, 4)} tấn`,
    },
    { label: 'Đơn giá thưởng', value: `${fmtVnd(kpi.ratePerTon)} / tấn` },
    {
      label: 'Tổng tiền thưởng cả xưởng',
      value: fmtVnd(kpi.bonusPool),
      sub: `${fmtNum(kpi.totalOutputTon, 4)} tấn × ${fmtVnd(kpi.ratePerTon)}, làm tròn hàng nghìn`,
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

        {slip.kpiBonus > 0 && (
          <div className="mt-2.5 flex items-center justify-between gap-4">
            <span className="text-[11px] text-white/50">
              Thưởng KPI sản xuất (chi riêng ngoài bảng lương)
            </span>
            <span className="text-sm font-bold text-gold">+ {fmtVnd(slip.kpiBonus)}</span>
          </div>
        )}
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
          // Ưu tiên chọn tháng hiện tại (nếu có)
          const now = new Date();
          const currentMonth = now.getMonth() + 1;
          const currentYear = now.getFullYear();

          const currentPeriod = arr.find(
            p => p.month === currentMonth && p.year === currentYear
          );

          setSelected(currentPeriod || arr[0]);
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

            {/* Ngày công (mọi bộ phận trừ tài xế) HOẶC số km (tài xế) */}
            {isDriver
              ? <DriverCalendar driver={slip.driver} month={slip.month} year={slip.year} />
              : <AttendanceCalendar attendance={slip.attendance}
                month={slip.month} year={slip.year} />}

            {/* THƯỞNG KPI SẢN XUẤT — CHỈ bộ phận Xưởng */}
            {slip.hasKpiBonus && (
              <KpiBreakdown kpi={slip.kpi} amount={slip.kpiBonus} />
            )}

            {/* Các bộ phận khác: bảng thưởng riêng sẽ bổ sung sau */}
            {!slip.hasKpiBonus && !isDriver && (
              <SectionCard>
                <div className="flex items-center gap-3 px-5 py-6">
                  <span className="w-10 h-10 rounded-xl bg-canvas flex items-center justify-center shrink-0">
                    <Package size={17} className="text-faint" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-ink">
                      Bảng thưởng của bộ phận {slip.payrollDepartmentLabel}
                    </p>
                    <p className="text-xs text-muted mt-0.5 leading-relaxed">
                      Bộ phận này không áp dụng thưởng KPI sản xuất. Bảng thưởng riêng
                      sẽ được bổ sung trong bản cập nhật tiếp theo.
                    </p>
                  </div>
                </div>
              </SectionCard>
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
