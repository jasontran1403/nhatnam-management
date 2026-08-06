// src/components/hr/SalaryBreakdownCards.jsx
// Chi tiết lương 1 nhân viên — dùng chung cho Owner (xem chi tiết) và
// SUPER_ACCOUNTANT (panel preview khi nhập).
//
// ══════════════════════════════════════════════════════════════════════════════
// ĐỔI CÁCH HIỂN THỊ — 08/2026
// ══════════════════════════════════════════════════════════════════════════════
//
// Doanh nghiệp chi trả TOÀN BỘ bảo hiểm và thuế TNCN thay cho nhân viên, nên bố
// cục cũ (trừ dần từ GROSS xuống NET trong card của nhân viên) mô tả sai thực tế
// dòng tiền: nhân viên không bị trừ đồng nào.
//
// Bản MỚI:
//   · Card NGƯỜI LAO ĐỘNG — lương cơ bản, phụ cấp, thưởng KPI, lương thực nhận.
//   · Card DOANH NGHIỆP   — 2 breakdown tách bạch:
//       (a) bảo hiểm phần DOANH NGHIỆP đóng (21,5%)
//       (b) bảo hiểm + thuế TNCN phần CÁ NHÂN phải đóng, doanh nghiệp trả thay
//     rồi tổng tiền bảo hiểm của cả 2 phần, và tổng tiền doanh nghiệp phải chi.
//
// ── CÁCH QUAY LẠI BẢN CŨ ──────────────────────────────────────────────────────
// Đổi USE_LEGACY_LAYOUT bên dưới thành true. Code cũ giữ nguyên trong
// LegacySalaryBreakdownCards, không xoá dòng nào.
//
// Cố ý dùng cờ thay vì comment khối code cũ: code còn nằm trong luồng biên dịch
// nên đổi field ở DTO là lint báo ngay, không bị mục âm thầm rồi đến lúc cần
// rollback mới phát hiện hỏng.
import { formatCurrency } from '../ui';

/** true = dùng lại giao diện cũ (nhân viên bị trừ dần từ GROSS xuống NET). */
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

function LegacySalaryBreakdownCards({ row, showComponents = true }) {
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

// ══════════════════════════════════════════════════════════════════════════════
// BẢN MỚI
// ══════════════════════════════════════════════════════════════════════════════

function NewSalaryBreakdownCards({ row }) {
  const fmt = (n) => formatCurrency(n || 0);

  const kpi = row.kpiPercent != null ? row.kpiPercent : 100;
  const kpiStr = Number.isInteger(kpi) ? `${kpi}%` : `${kpi.toFixed(2)}%`;
  const effBonus = row.effectiveBonus != null ? row.effectiveBonus : (row.bonus || 0);
  const allowances = row.allowances || [];
  const hourly = !!row.hourlyBased;
  const hoursStr = (h) => (`${h}`.replace('.', ',')) + ' giờ';

  // Không tham gia BHXH/BHYT/BHTN. Ưu tiên cờ từ BE; BE đời cũ chưa có cờ thì
  // suy từ mức đóng — giữ nguyên cách nhận biết của bản cũ.
  const noIns = row.insuranceExempt != null
    ? !!row.insuranceExempt
    : !(row.insuranceSalary > 0);

  const employerIns = row.employerInsuranceTotal || 0;
  const employeeIns = row.employeeInsuranceTotal || 0;
  const pit = row.personalIncomeTax || 0;

  // Tổng tiền BẢO HIỂM của cả hai phần — chỉ bảo hiểm, KHÔNG gộp thuế TNCN vào.
  // Thuế và bảo hiểm nộp cho hai cơ quan khác nhau nên gộp chung một con số sẽ
  // không đối chiếu được với chứng từ nộp tiền.
  const insuranceBothSides = employerIns + employeeIns;

  const totalAllowance = allowances.reduce((s, a) => s + (a.amount || 0), 0);

  return (
    <div className="space-y-4">
      {/* ── CARD 1 — NGƯỜI LAO ĐỘNG ───────────────────────────────────────── */}
      <div className="bg-[#FAF7F2] rounded-xl p-4 space-y-2">
        <p className="text-xs font-bold text-[#8E8878] uppercase tracking-wider mb-2">
          Của người lao động (VNĐ)
        </p>

        <Row label={hourly ? 'Lương cơ bản (theo giờ thực tế)' : 'Lương cơ bản'}
          val={fmt(row.baseSalary)} />

        {hourly && (
          <>
            <Row sub label="Lương chuẩn khi đủ công" val={fmt(row.standardBaseSalary)} />
            <Row sub label="Giờ công chuẩn / thực tế"
              val={`${hoursStr(row.standardWorkHours ?? 208)} / ${hoursStr(row.actualWorkHours ?? 208)}`} />
          </>
        )}

        {!!row.attendanceProrated && (
          <Row sub label="Ngày công chuẩn / thực tế"
            val={`${row.standardWorkdays ?? 26} / ${row.actualWorkdays ?? '—'}`} />
        )}

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

        <Divider />
        <Row label={`Thưởng KPI — đạt ${kpiStr}`} val={`+ ${fmt(effBonus)}`} />
        {kpi !== 100 && (
          <Row sub label={`Thưởng gốc ${fmt(row.bonus)} × ${kpiStr}`} val={fmt(effBonus)} />
        )}

        <Divider />
        <Row label="LƯƠNG THỰC NHẬN" val={fmt(row.netSalary)} bold green />
      </div>

      {/* ── CARD 2 — DOANH NGHIỆP ─────────────────────────────────────────── */}
      <div className="bg-[#FAF7F2] rounded-xl p-4 space-y-2">
        <p className="text-xs font-bold text-[#8E8878] uppercase tracking-wider mb-2">
          Của doanh nghiệp phải trả (VNĐ)
        </p>

        <Row label="Lương thực nhận trả cho nhân viên" val={fmt(row.netSalary)} />

        {noIns ? (
          <>
            <Divider />
            <Row label="Bảo hiểm bắt buộc" val="Không tham gia" />
            {pit > 0 && (
              <>
                <Divider />
                <Row label="Thuế TNCN doanh nghiệp nộp thay" val={`+ ${fmt(pit)}`} />
              </>
            )}
          </>
        ) : (
          <>
            {/* (a) Phần bảo hiểm DOANH NGHIỆP đóng */}
            <Divider />
            <Row label="Bảo hiểm doanh nghiệp đóng (21,5%)" val={`+ ${fmt(employerIns)}`} bold />
            <Row sub label="Bảo hiểm xã hội (17%)" val={`+ ${fmt(row.employerSocialInsurance)}`} />
            <Row sub label="BH Tai nạn LĐ - Bệnh nghề nghiệp (0,5%)"
              val={`+ ${fmt(row.employerAccidentInsurance)}`} />
            <Row sub label="Bảo hiểm y tế (3%)" val={`+ ${fmt(row.employerHealthInsurance)}`} />
            <Row sub label="Bảo hiểm thất nghiệp (1%)"
              val={`+ ${fmt(row.employerUnemploymentInsurance)}`} />

            {/* (b) Phần cá nhân phải đóng — doanh nghiệp trả thay */}
            <Divider />
            <Row label="Bảo hiểm cá nhân đóng (10,5%) — DN trả thay"
              val={`+ ${fmt(employeeIns)}`} bold />
            <Row sub label="Bảo hiểm xã hội (8%)" val={`+ ${fmt(row.employeeSocialInsurance)}`} />
            <Row sub label="Bảo hiểm y tế (1,5%)" val={`+ ${fmt(row.employeeHealthInsurance)}`} />
            <Row sub label="Bảo hiểm thất nghiệp (1%)"
              val={`+ ${fmt(row.employeeUnemploymentInsurance)}`} />

            <Row label="Thuế TNCN — DN nộp thay" val={`+ ${fmt(pit)}`} bold />
            {(row.pitBrackets || []).map((b, i) => (
              <Row key={i} sub label={`Bậc ${b.ratePercent}% trên ${fmt(b.incomeInBracket)}`}
                val={`+ ${fmt(b.taxInBracket)}`} />
            ))}

            {/* Tổng bảo hiểm cả hai phần */}
            <Divider />
            <Row label="TỔNG TIỀN BẢO HIỂM (cả 2 phần — 32%)"
              val={fmt(insuranceBothSides)} bold />
          </>
        )}

        <Divider />
        <Row label="TỔNG DOANH NGHIỆP PHẢI CHI TRẢ" val={fmt(row.totalCost)} bold green />
      </div>

      <p className="text-[11px] text-[#A8A090] leading-relaxed">
        {noIns ? (
          <>
            Nhân viên này <strong>KHÔNG tham gia bảo hiểm bắt buộc</strong> (lương đóng
            BH = 0) — không trích BHXH/BHYT/BHTN cho cả hai phía.
          </>
        ) : (
          <>
            Lương đóng bảo hiểm: {fmt(row.insuranceSalary)}. Bảo hiểm của cả người lao
            động và doanh nghiệp đều tính cố định trên mức này.
          </>
        )}
        {' '}Doanh nghiệp chi trả toàn bộ phần bảo hiểm và thuế TNCN, nhân viên nhận
        đủ {fmt(row.netSalary)} không bị khấu trừ.
      </p>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ĐIỂM VÀO — chọn giao diện theo cờ USE_LEGACY_LAYOUT
// ══════════════════════════════════════════════════════════════════════════════

/**
 * @param {object}  row             SalaryBreakdownDto từ BE
 * @param {boolean} showComponents  CHỈ có tác dụng ở bản cũ. Bản mới đã gộp
 *                                  "các khoản cấu thành" vào card người lao động.
 */
export default function SalaryBreakdownCards({ row, showComponents = true }) {
  if (!row) return null;

  if (USE_LEGACY_LAYOUT)
    return <LegacySalaryBreakdownCards row={row} showComponents={showComponents} />;

  return <NewSalaryBreakdownCards row={row} />;
}
