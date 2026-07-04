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
              label={`${a.label || 'Phụ cấp'}${a.taxable ? ' · chịu thuế' : ' · miễn thuế'}`}
              val={`+ ${fmt(a.amount)}`} />
          ))}
          <Divider />
          <Row label={`Thưởng KPI — đạt ${kpiStr}${row.bonusTaxable ? ' · chịu thuế' : ' · miễn thuế'}`}
            val={`+ ${fmt(effBonus)}`} />
          {kpi !== 100 && <Row sub label={`Thưởng gốc ${fmt(row.bonus)} × ${kpiStr}`} val={fmt(effBonus)} />}
        </div>
      )}

      {/* Card 1 — Nhân viên */}
      <div className="bg-[#FAF7F2] rounded-xl p-4 space-y-2">
        <p className="text-xs font-bold text-[#8E8878] uppercase tracking-wider mb-2">Của nhân viên (VNĐ)</p>
        <Row label="Lương GROSS" val={fmt(row.grossSalary)} bold />
        <Divider />
        <Row label="Tổng bảo hiểm nhân viên đóng (10,5%)" val={`- ${fmt(row.employeeInsuranceTotal)}`} red />
        <Row sub label="Bảo hiểm xã hội (8%)" val={`- ${fmt(row.employeeSocialInsurance)}`} red />
        <Row sub label="Bảo hiểm y tế (1,5%)" val={`- ${fmt(row.employeeHealthInsurance)}`} red />
        <Row sub label="Bảo hiểm thất nghiệp (1%)" val={`- ${fmt(row.employeeUnemploymentInsurance)}`} red />
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
        <Row label="Tổng bảo hiểm DN đóng (21,5%)" val={`+ ${fmt(row.employerInsuranceTotal)}`} />
        <Row sub label="Bảo hiểm xã hội (17%)" val={`+ ${fmt(row.employerSocialInsurance)}`} />
        <Row sub label="BH Tai nạn LĐ - Bệnh nghề nghiệp (0,5%)" val={`+ ${fmt(row.employerAccidentInsurance)}`} />
        <Row sub label="Bảo hiểm y tế (3%)" val={`+ ${fmt(row.employerHealthInsurance)}`} />
        <Row sub label="Bảo hiểm thất nghiệp (1%)" val={`+ ${fmt(row.employerUnemploymentInsurance)}`} />
        <Divider />
        <Row label="TỔNG CỘNG (chi phí DN / tháng)" val={fmt(row.totalCost)} bold />
      </div>

      <p className="text-[11px] text-[#A8A090] leading-relaxed">
        Lương đóng bảo hiểm: {fmt(row.insuranceSalary)}. Bảo hiểm (NLĐ &amp; DN) tính cố định trên mức này.
        Lương NET = Lương cơ bản + các khoản phụ cấp + thưởng (KPI).
      </p>
    </div>
  );
}