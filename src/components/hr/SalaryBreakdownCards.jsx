// src/components/hr/SalaryBreakdownCards.jsx
// Hiển thị chi tiết lương 1 nhân viên thành 2 card: Nhân viên & Doanh nghiệp.
// Dùng chung cho Owner (xem chi tiết) và SUPER_ACCOUNTANT (panel preview khi nhập).
import { formatCurrency } from '../ui';

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

export default function SalaryBreakdownCards({ row, showComponents = true }) {
  if (!row) return null;
  const fmt = (n) => formatCurrency(n || 0);
  const kpi = row.kpiPercent != null ? row.kpiPercent : 100;
  const kpiStr = Number.isInteger(kpi) ? `${kpi}%` : `${kpi.toFixed(2)}%`;
  const effBonus = row.effectiveBonus != null ? row.effectiveBonus : (row.bonus || 0);
  const allowances = row.allowances || [];
  const nonTax = row.nonTaxableAdditions || 0;
  const hourly = !!row.hourlyBased;
  const hoursStr = (h) => (`${h}`.replace('.', ',')) + ' giờ';

  // ── KHÔNG ĐÓNG BẢO HIỂM ────────────────────────────────────────────────────
  //   Lương đóng BH = 0 nghĩa là nhân viên không tham gia BHXH/BHYT/BHTN.
  //   Ưu tiên cờ `insuranceExempt` do BE trả về; nếu BE đời cũ chưa có cờ này
  //   thì suy từ chính mức đóng BH, nên component vẫn chạy đúng.
  const noIns = row.insuranceExempt != null
    ? !!row.insuranceExempt
    : !(row.insuranceSalary > 0);

  return (
    <div className="space-y-4">
      {/* Các khoản cấu thành */}
      {showComponents && (
        <div className="bg-[#FAF7F2] rounded-xl p-4 space-y-2">
          <p className="text-xs font-bold text-[#8E8878] uppercase tracking-wider mb-2">Các khoản cấu thành</p>
          <Row label={hourly ? 'Lương cơ bản (theo giờ thực tế)' : 'Lương cơ bản (NET)'} val={fmt(row.baseSalary)} />
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
          <Row label={`Thưởng KPI — đạt ${kpiStr}`}
            val={`+ ${fmt(effBonus)}`} />
          {kpi !== 100 && <Row sub label={`Thưởng gốc ${fmt(row.bonus)} × ${kpiStr}`} val={fmt(effBonus)} />}
        </div>
      )}

      {/* Card 1 — Nhân viên */}
      <div className="bg-[#FAF7F2] rounded-xl p-4 space-y-2">
        <p className="text-xs font-bold text-[#8E8878] uppercase tracking-wider mb-2">Của nhân viên (VNĐ)</p>
        <Row label="Lương GROSS" val={fmt(row.grossSalary)} bold />
        <Divider />
        {/* Không đóng bảo hiểm: gộp thành 1 dòng thay vì 4 dòng 0đ gây hiểu nhầm
            là "có đóng nhưng bằng 0". */}
        {noIns ? (
          <Row label="Bảo hiểm nhân viên đóng" val="Không tham gia" />
        ) : (
          <>
            <Row label="Tổng bảo hiểm nhân viên đóng (10,5%)" val={`- ${fmt(row.employeeInsuranceTotal)}`} red />
            <Row sub label="Bảo hiểm xã hội (8%)" val={`- ${fmt(row.employeeSocialInsurance)}`} red />
            <Row sub label="Bảo hiểm y tế (1,5%)" val={`- ${fmt(row.employeeHealthInsurance)}`} red />
            <Row sub label="Bảo hiểm thất nghiệp (1%)" val={`- ${fmt(row.employeeUnemploymentInsurance)}`} red />
          </>
        )}
        <Divider />
        <Row label="Thu nhập trước thuế" val={fmt(row.preTaxIncome)} />
        {nonTax > 0 && <Row label="Khoản phụ cấp/thưởng miễn thuế" val={`- ${fmt(nonTax)}`} red />}
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
      </div>

      {/* Card 2 — Doanh nghiệp */}
      <div className="bg-[#FAF7F2] rounded-xl p-4 space-y-2">
        <p className="text-xs font-bold text-[#8E8878] uppercase tracking-wider mb-2">Của doanh nghiệp phải trả (VNĐ)</p>
        <Row label="Lương GROSS" val={fmt(row.grossSalary)} />
        <Divider />
        {noIns ? (
          <Row label="Bảo hiểm doanh nghiệp đóng" val="Không tham gia" />
        ) : (
          <>
            <Row label="Tổng bảo hiểm DN đóng (21,5%)" val={`+ ${fmt(row.employerInsuranceTotal)}`} />
            <Row sub label="Bảo hiểm xã hội (17%)" val={`+ ${fmt(row.employerSocialInsurance)}`} />
            <Row sub label="BH Tai nạn LĐ - Bệnh nghề nghiệp (0,5%)" val={`+ ${fmt(row.employerAccidentInsurance)}`} />
            <Row sub label="Bảo hiểm y tế (3%)" val={`+ ${fmt(row.employerHealthInsurance)}`} />
            <Row sub label="Bảo hiểm thất nghiệp (1%)" val={`+ ${fmt(row.employerUnemploymentInsurance)}`} />
          </>
        )}
        <Divider />
        <Row label="TỔNG CỘNG (chi phí DN / tháng)" val={fmt(row.totalCost)} bold />
      </div>

      <p className="text-[11px] text-[#A8A090] leading-relaxed">
        {noIns ? (
          <>
            Nhân viên này <strong>KHÔNG tham gia bảo hiểm bắt buộc</strong> (lương đóng BH = 0)
            — không trích BHXH/BHYT/BHTN cho cả người lao động lẫn doanh nghiệp.
            Thuế TNCN vẫn được tính bình thường.
          </>
        ) : (
          <>
            Lương đóng bảo hiểm: {fmt(row.insuranceSalary)}. Bảo hiểm (NLĐ &amp; DN) tính cố định trên mức này.
          </>
        )}
        {' '}Lương NET = Lương cơ bản + các khoản phụ cấp + thưởng (KPI).
      </p>
    </div>
  );
}