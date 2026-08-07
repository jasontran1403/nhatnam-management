// src/components/ui/ExpenseDatePeriodPicker.jsx
// Bộ chọn thời điểm cho phiếu chi, gồm 2 chế độ:
//   • "Ngày"  → chọn 1 ngày cụ thể (mặc định = hôm nay). Dùng để tạo lại các
//               phiếu chi cũ đúng ngày phát sinh. Backend suy ra kỳ = tháng của ngày này.
//   • "Kỳ"    → chỉ chọn THÁNG (như cũ). Cho phép cả tháng hiện tại và tương lai.
//
// value: { mode: 'DATE' | 'PERIOD', expenseDate: number|null (epoch ms), expensePeriod: string|null 'YYYY-MM' }
// onChange(nextValue)
import DatePicker from './DatePicker';
import MonthPicker from './MonthPicker';
import { CalendarDays, CalendarRange } from 'lucide-react';

/** Giá trị mặc định: chế độ Ngày = hôm nay (00:00 giờ máy). */
export function defaultExpenseWhen() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return { mode: 'DATE', expenseDate: d.getTime(), expensePeriod: null };
}

/** Kỳ (tháng) hiện tại dạng "YYYY-MM". */
export function currentMonthPeriod() {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return `${now.getFullYear()}-${mm}`;
}

/** Nhãn hiển thị gọn cho một giá trị when (dùng ở danh sách/lịch sử). */
export function formatExpenseWhen(when) {
  if (!when) return '';
  if (when.expenseDate) {
    const d = new Date(when.expenseDate);
    return `Ngày ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  }
  if (when.expensePeriod) {
    const [y, m] = when.expensePeriod.split('-');
    return `Kỳ Tháng ${Number(m)}/${y}`;
  }
  return '';
}

export default function ExpenseDatePeriodPicker({ value, onChange }) {
  const mode = value?.mode || 'DATE';

  const switchMode = (nextMode) => {
    if (nextMode === mode) return;
    if (nextMode === 'DATE') {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      onChange({ mode: 'DATE', expenseDate: value?.expenseDate ?? d.getTime(), expensePeriod: null });
    } else {
      onChange({ mode: 'PERIOD', expenseDate: null, expensePeriod: value?.expensePeriod ?? currentMonthPeriod() });
    }
  };

  const tabs = [
    { id: 'DATE', label: 'Ngày', icon: CalendarDays },
    { id: 'PERIOD', label: 'Kỳ (tháng)', icon: CalendarRange },
  ];

  return (
    <div className="space-y-2">
      {/* Segmented toggle Ngày | Kỳ */}
      <div className="inline-flex gap-1 bg-canvas border border-hairline rounded-xl p-1">
        {tabs.map(tb => {
          const active = mode === tb.id;
          return (
            <button
              key={tb.id}
              type="button"
              onClick={() => switchMode(tb.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
                ${active ? 'bg-gold text-white shadow-sm' : 'text-muted hover:text-ink'}`}
            >
              <tb.icon size={13} />
              {tb.label}
            </button>
          );
        })}
      </div>

      {/* Trường chọn tương ứng chế độ */}
      {mode === 'DATE' ? (
        <DatePicker
          value={value?.expenseDate ?? null}
          onChange={(ms) => onChange({ mode: 'DATE', expenseDate: ms, expensePeriod: null })}
          placeholder="Chọn ngày chi"
        />
      ) : (
        <MonthPicker
          value={value?.expensePeriod ?? ''}
          onChange={(p) => onChange({ mode: 'PERIOD', expenseDate: null, expensePeriod: p })}
          placeholder="Chọn kỳ chi phí"
        />
      )}
    </div>
  );
}