// src/components/hr/PayslipBreakdownCards.jsx
// CHI TIẾT LƯƠNG hiển thị trên card "Phiếu lương" của trang Quản lý lương.
//
// ══════════════════════════════════════════════════════════════════════════════
// ĐỔI CÁCH HIỂN THỊ — 08/2026
// ══════════════════════════════════════════════════════════════════════════════
//
// Doanh nghiệp chi trả TOÀN BỘ phần bảo hiểm và thuế TNCN thay cho nhân viên.
// Vì vậy màn hình của người lao động không còn ý nghĩa khi bày ra các dòng
// "trừ BHXH 8%", "trừ thuế TNCN" — nhân viên không hề bị trừ những khoản đó,
// nhìn vào chỉ gây hiểu nhầm là lương bị cắt.
//
// Bản MỚI chỉ hiển thị 4 nhóm: lương cơ bản · các khoản phụ cấp · thưởng KPI ·
// lương thực nhận. Toàn bộ breakdown bảo hiểm/thuế chuyển sang màn hình của
// doanh nghiệp (SalaryBreakdownCards).
//
// ── CÁCH QUAY LẠI BẢN CŨ ──────────────────────────────────────────────────────
// Đổi USE_LEGACY_LAYOUT bên dưới thành true. Code cũ được GIỮ NGUYÊN trong
// LegacyPayslipBreakdownCards, không xoá dòng nào.
//
// Cố ý dùng cờ thay vì comment khối code cũ: code còn nằm trong luồng biên dịch
// nên đổi tên biến / đổi field ở DTO là lint báo ngay, không bị mục âm thầm rồi
// đến lúc cần rollback mới phát hiện hỏng.
import { formatCurrency } from '../ui';

/** true = dùng lại giao diện cũ (có breakdown bảo hiểm/thuế của nhân viên). */
const USE_LEGACY_LAYOUT = false;

function Row({ label, val, bold, red, green, sub }) {
  return (
    <div className={`flex justify-between items-center gap-3 ${sub ? 'pl-3' : ''}`}>
      <span className={`text-xs ${sub ? 'text-[#A8A090]' : 'text-[#8E8878]'}`}>{label}</span>
      <span className={`text-sm whitespace-nowrap ${bold ? 'font-bold' : 'font-medium'} ${
        red ? 'text-red-600' : green ? 'text-emerald-700' : 'text-[#1C1C1E]'}`}>{val}</span>
    </div>
  );
}

const Divider = () => <div className="h-px bg-[#E8E0D6] my-1" />;

/**
 * @param {object}  row              SalaryBreakdownDto trả từ BE (payslip.salaryDetail)
 * @param {boolean} showComponents   ẩn/hiện khối "Các khoản cấu thành"
 * @param {string}  className        class bổ sung cho wrapper
 */
function LegacyPayslipBreakdownCards({ row, showComponents = true, className = '' }) {
  if (!row) return null;

  const fmt = (n) => formatCurrency(n || 0);
  const kpi = row.kpiPercent != null ? row.kpiPercent : 100;
  const kpiStr = Number.isInteger(kpi) ? `${kpi}%` : `${kpi.toFixed(2)}%`;
  const effBonus = row.effectiveBonus != null ? row.effectiveBonus : (row.bonus || 0);
  const allowances = row.allowances || [];
  const nonTax = row.nonTaxableAdditions || 0;
  const hourly = !!row.hourlyBased;

  // Lương khoán theo hợp đồng bên thứ ba (bảo vệ xưởng): mọi số bảo hiểm/thuế
  // đều bằng 0 CÓ CHỦ ĐÍCH. Render nguyên khối khấu trừ toàn "0đ" sẽ khiến người
  // xem tưởng hồ sơ bảo hiểm bị bỏ trống, nên ẩn hẳn và nói rõ lý do.
  const flat = !!row.flatContract;
  const hoursStr = (h) => (`${h}`.replace('.', ',')) + ' giờ';

  return (
    <div className={`space-y-4 ${className}`}>
      {/* ── 1. CÁC KHOẢN CẤU THÀNH ───────────────────────────────────────── */}
      {showComponents && (
        <div className="bg-[#FAF7F2] rounded-xl p-4 space-y-2">
          <p className="text-xs font-bold text-[#8E8878] uppercase tracking-wider mb-2">
            Các khoản cấu thành
          </p>

          <Row
            label={hourly ? 'Lương cơ bản (theo giờ thực tế)' : 'Lương cơ bản (NET)'}
            val={fmt(row.baseSalary)}
          />

          {hourly && (
            <>
              <Row sub label="Lương chuẩn khi đủ công" val={fmt(row.standardBaseSalary)} />
              <Row sub label="Giờ công chuẩn / thực tế"
                val={`${hoursStr(row.standardWorkHours ?? 208)} / ${hoursStr(row.actualWorkHours ?? 208)}`} />
            </>
          )}

          {allowances.length > 0 && <Divider />}
          {allowances.map((a, i) => (
            <Row key={i}
              label={`${a.label || 'Phụ cấp'}`}
              val={`+ ${fmt(a.amount)}`} />
          ))}

          <Divider />
          <Row
            label={`Thưởng KPI — đạt ${kpiStr}`}
            val={`+ ${fmt(effBonus)}`} />
          {kpi !== 100 && (
            <Row sub label={`Thưởng gốc ${fmt(row.bonus)} × ${kpiStr}`} val={fmt(effBonus)} />
          )}
        </div>
      )}

      {/* ── 2. CỦA NHÂN VIÊN ─────────────────────────────────────────────── */}
      <div className="bg-[#FAF7F2] rounded-xl p-4 space-y-2">
        <p className="text-xs font-bold text-[#8E8878] uppercase tracking-wider mb-2">
          Của nhân viên (VNĐ)
        </p>

        {flat ? (
          <>
            <Row label="Lương khoán theo hợp đồng" val={fmt(row.standardBaseSalary)} />
            {(row.effectiveBonus || 0) > 0 && (
              <Row label="Thưởng thêm" val={fmt(row.effectiveBonus)} green />
            )}
            <Divider />
            <Row label="LƯƠNG NET (thực nhận)" val={fmt(row.netSalary)} bold green />
          </>
        ) : (
          <>
            <Row label="Lương GROSS" val={fmt(row.grossSalary)} bold />
            <Divider />
            <Row label="Tổng bảo hiểm nhân viên đóng (10,5%)"
              val={`- ${fmt(row.employeeInsuranceTotal)}`} red />
            <Row sub label="Bảo hiểm xã hội (8%)" val={`- ${fmt(row.employeeSocialInsurance)}`} red />
            <Row sub label="Bảo hiểm y tế (1,5%)" val={`- ${fmt(row.employeeHealthInsurance)}`} red />
            <Row sub label="Bảo hiểm thất nghiệp (1%)"
              val={`- ${fmt(row.employeeUnemploymentInsurance)}`} red />
            <Divider />
            <Row label="Thu nhập trước thuế" val={fmt(row.preTaxIncome)} />
            {nonTax > 0 && (
              <Row label="Khoản phụ cấp/thưởng miễn thuế" val={`- ${fmt(nonTax)}`} red />
            )}
            <Row label="Giảm trừ gia cảnh bản thân" val={`- ${fmt(row.personalDeduction)}`} red />
            <Row label="Giảm trừ gia cảnh người phụ thuộc" val={`- ${fmt(row.dependentDeduction)}`} red />
            <Divider />
            <Row label="Thu nhập chịu thuế" val={fmt(row.taxableIncome)} bold />
            <Row label="Thuế thu nhập cá nhân" val={`- ${fmt(row.personalIncomeTax)}`} red />
            {(row.pitBrackets || []).map((b, i) => (
              <Row key={i} sub label={`Bậc ${b.ratePercent}% trên ${fmt(b.incomeInBracket)}`}
                val={`- ${fmt(b.taxInBracket)}`} red />
            ))}
            <Divider />
            <Row label="LƯƠNG NET (thực nhận)" val={fmt(row.netSalary)} bold green />
          </>
        )}
      </div>

      <p className="text-[11px] text-[#A8A090] leading-relaxed">
        {flat ? (
          <>
            Lương khoán trọn tháng theo hợp đồng với đơn vị cung cấp dịch vụ bảo vệ,
            không chia theo ngày công. Thuế TNCN và bảo hiểm do đơn vị đó chi trả nên
            không khấu trừ ở đây; suất ăn cũng không tính phụ cấp cơm.
            Thưởng KPI xưởng được hiển thị riêng.
          </>
        ) : (
          <>
            Lương đóng bảo hiểm: {fmt(row.insuranceSalary)}. Bảo hiểm tính cố định trên mức này.
            Lương NET = Lương cơ bản + các khoản phụ cấp + thưởng (KPI).
          </>
        )}
      </p>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// BẢN MỚI — CHỈ NHỮNG GÌ NGƯỜI LAO ĐỘNG THỰC SỰ NHẬN
// ══════════════════════════════════════════════════════════════════════════════

function NewPayslipBreakdownCards({ row, className = '' }) {
  const fmt = (n) => formatCurrency(n || 0);

  const kpi = row.kpiPercent != null ? row.kpiPercent : 100;
  const kpiStr = Number.isInteger(kpi) ? `${kpi}%` : `${kpi.toFixed(2)}%`;
  const effBonus = row.effectiveBonus != null ? row.effectiveBonus : (row.bonus || 0);
  const allowances = row.allowances || [];
  const hourly = !!row.hourlyBased;
  const flat = !!row.flatContract;
  const hoursStr = (h) => (`${h}`.replace('.', ',')) + ' giờ';

  const totalAllowance = allowances.reduce((s, a) => s + (a.amount || 0), 0);

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="bg-[#FAF7F2] rounded-xl p-4 space-y-2">
        <p className="text-xs font-bold text-[#8E8878] uppercase tracking-wider mb-2">
          Lương của bạn (VNĐ)
        </p>

        {/* ── Lương cơ bản ── */}
        <Row
          label={
            flat ? 'Lương khoán theo hợp đồng'
              : hourly ? 'Lương cơ bản (theo giờ thực tế)'
                : 'Lương cơ bản'
          }
          val={fmt(flat ? row.standardBaseSalary : row.baseSalary)}
        />

        {hourly && !flat && (
          <>
            <Row sub label="Lương chuẩn khi đủ công" val={fmt(row.standardBaseSalary)} />
            <Row sub label="Giờ công chuẩn / thực tế"
              val={`${hoursStr(row.standardWorkHours ?? 208)} / ${hoursStr(row.actualWorkHours ?? 208)}`} />
          </>
        )}

        {/* Lương chia theo ngày công — nói rõ vì sao lương tháng này khác tháng khác */}
        {!!row.attendanceProrated && !flat && (
          <Row sub label="Ngày công chuẩn / thực tế"
            val={`${row.standardWorkdays ?? 26} / ${row.actualWorkdays ?? '—'}`} />
        )}

        {/* ── Các khoản phụ cấp ── */}
        {allowances.length > 0 && (
          <>
            <Divider />
            {allowances.map((a, i) => (
              <Row key={i} label={a.label || 'Phụ cấp'} val={`+ ${fmt(a.amount)}`} />
            ))}
            {allowances.length > 1 && (
              <Row sub label="Tổng phụ cấp" val={`+ ${fmt(totalAllowance)}`} />
            )}
          </>
        )}

        {/* ── Thưởng KPI ── */}
        <Divider />
        <Row label={`Thưởng KPI — đạt ${kpiStr}`} val={`+ ${fmt(effBonus)}`} />
        {kpi !== 100 && (
          <Row sub label={`Thưởng gốc ${fmt(row.bonus)} × ${kpiStr}`} val={fmt(effBonus)} />
        )}

        {/* ── Thực nhận ── */}
        <Divider />
        <Row label="LƯƠNG THỰC NHẬN" val={fmt(row.netSalary)} bold green />
      </div>

      <p className="text-[11px] text-[#A8A090] leading-relaxed">
        {flat ? (
          <>
            Lương khoán trọn tháng theo hợp đồng với đơn vị cung cấp dịch vụ, không chia
            theo ngày công. Thưởng KPI xưởng được hiển thị riêng.
          </>
        ) : (
          <>
            Đây là số tiền bạn <strong>thực nhận</strong>. Các khoản bảo hiểm bắt buộc
            (BHXH, BHYT, BHTN) và thuế thu nhập cá nhân do <strong>doanh nghiệp chi trả
            toàn bộ</strong>, không trừ vào lương của bạn.
          </>
        )}
      </p>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ĐIỂM VÀO — chọn giao diện theo cờ USE_LEGACY_LAYOUT
// ══════════════════════════════════════════════════════════════════════════════

/**
 * @param {object}  row              SalaryBreakdownDto trả từ BE (payslip.salaryDetail)
 * @param {boolean} showComponents   CHỈ có tác dụng ở bản cũ. Bản mới đã gộp
 *                                   "các khoản cấu thành" vào một khối duy nhất
 *                                   nên không còn gì để ẩn/hiện.
 * @param {string}  className        class bổ sung cho wrapper
 */
export default function PayslipBreakdownCards({ row, showComponents = true, className = '' }) {
  if (!row) return null;

  if (USE_LEGACY_LAYOUT)
    return <LegacyPayslipBreakdownCards row={row} showComponents={showComponents} className={className} />;

  return <NewPayslipBreakdownCards row={row} className={className} />;
}
