// src/components/common/PasscodeInput.jsx
// Ô NHẬP PASSCODE 6 SỐ — kiểu nhập OTP.
//
//   · Gõ 1 số   → tự nhảy sang ô kế tiếp
//   · Xoá 1 số  → tự lùi về ô trước
//   · Đủ 6 số   → tự submit (gọi onComplete)
//   · Dán 6 số  → điền hết một lượt rồi submit
//
// Dùng chung cho cả màn hình khoá lương và panel đổi mật khẩu xem lương trong
// hộp thoại tài khoản, nên KHÔNG gắn logic gọi API vào đây.
import { useRef, useEffect, useCallback, useState } from 'react';

const LENGTH = 6;

/**
 * @param {string}   value        chuỗi số hiện tại (controlled)
 * @param {Function} onChange     (next: string) => void
 * @param {Function} onComplete   (value: string) => void — gọi khi đủ 6 số
 * @param {boolean}  disabled     khoá nhập (đang gửi request / đã bị khoá)
 * @param {boolean}  error        tô đỏ
 * @param {boolean}  shake        rung 1 nhịp (đổi false→true để phát lại)
 * @param {boolean}  autoFocus    tự focus ô đầu khi mount
 * @param {boolean}  mask         hiện dấu chấm thay vì số (mặc định: true)
 * @param {string}   size         'md' | 'lg'
 */
export default function PasscodeInput({
  value = '',
  onChange,
  onComplete,
  disabled = false,
  error = false,
  shake = false,
  autoFocus = true,
  mask = true,
  size = 'lg',
  label,
}) {
  const inputs = useRef([]);
  const [focusIdx, setFocusIdx] = useState(-1);

  // Chỉ giữ chữ số, tối đa 6 — chống mọi đường vào (gõ, dán, autofill)
  const digits = String(value ?? '').replace(/\D/g, '').slice(0, LENGTH);

  useEffect(() => {
    if (autoFocus && !disabled) inputs.current[0]?.focus();
  }, [autoFocus, disabled]);

  // ── Tự submit khi đủ 6 số ───────────────────────────────────────────────
  // Chốt lại giá trị đã submit để tránh gọi 2 lần khi component re-render vì
  // lý do khác (đổi trạng thái loading chẳng hạn).
  const submitted = useRef(null);
  useEffect(() => {
    if (digits.length === LENGTH && submitted.current !== digits) {
      submitted.current = digits;
      inputs.current[LENGTH - 1]?.blur();
      onComplete?.(digits);
    }
    if (digits.length < LENGTH) submitted.current = null;
  }, [digits, onComplete]);

  const setAt = useCallback((idx, digit) => {
    const arr = digits.padEnd(LENGTH, ' ').split('');
    arr[idx] = digit || ' ';
    onChange?.(arr.join('').replace(/\s/g, '').slice(0, LENGTH));
  }, [digits, onChange]);

  const focusAt = (idx) => {
    const i = Math.max(0, Math.min(LENGTH - 1, idx));
    inputs.current[i]?.focus();
    inputs.current[i]?.select?.();
  };

  const handleChange = (idx, e) => {
    const raw = e.target.value.replace(/\D/g, '');
    if (!raw) return;

    // Dán nhiều số cùng lúc → rải từ ô hiện tại trở đi
    if (raw.length > 1) {
      const next = (digits.slice(0, idx) + raw).replace(/\D/g, '').slice(0, LENGTH);
      onChange?.(next);
      focusAt(next.length >= LENGTH ? LENGTH - 1 : next.length);
      return;
    }

    // Gõ đè lên ô đã có số: vẫn nhận số mới (input maxLength=1 nên value có thể
    // là 2 ký tự — lấy ký tự CUỐI mới đúng ý người dùng).
    const digit = raw.slice(-1);
    const next = (digits.slice(0, idx) + digit + digits.slice(idx + 1)).slice(0, LENGTH);
    onChange?.(next);
    if (idx < LENGTH - 1) focusAt(idx + 1);
  };

  const handleKeyDown = (idx, e) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (digits[idx]) {
        // Ô đang có số → xoá tại chỗ
        setAt(idx, '');
        onChange?.((digits.slice(0, idx) + digits.slice(idx + 1)).slice(0, LENGTH));
      } else if (idx > 0) {
        // Ô trống → lùi về ô trước và xoá số ở đó
        onChange?.((digits.slice(0, idx - 1) + digits.slice(idx)).slice(0, LENGTH));
        focusAt(idx - 1);
      }
      return;
    }

    if (e.key === 'ArrowLeft')  { e.preventDefault(); focusAt(idx - 1); return; }
    if (e.key === 'ArrowRight') { e.preventDefault(); focusAt(idx + 1); return; }
    if (e.key === 'Delete')     { e.preventDefault(); onChange?.((digits.slice(0, idx) + digits.slice(idx + 1))); return; }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const text = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, LENGTH);
    if (!text) return;
    onChange?.(text);
    focusAt(text.length >= LENGTH ? LENGTH - 1 : text.length);
  };

  const box = size === 'md'
    ? 'w-11 h-[3.25rem] sm:w-12 sm:h-14 text-xl'
    : 'w-12 h-[3.75rem] sm:w-14 sm:h-16 text-2xl';

  return (
    <div>
      {label && (
        <p className="text-xs font-semibold text-muted mb-2 text-center">{label}</p>
      )}

      <div
        onPaste={handlePaste}
        className={`flex items-center justify-center gap-2 sm:gap-2.5 ${shake ? 'passcode-shake' : ''}`}
      >
        {Array.from({ length: LENGTH }).map((_, i) => {
          const filled = !!digits[i];
          const active = focusIdx === i && !disabled;

          return (
            <div
              key={i}
              className={`
                relative ${box} rounded-2xl border-2 transition-all duration-150
                flex items-center justify-center select-none
                ${disabled ? 'opacity-50 bg-surface-2 border-hairline-2' : 'bg-surface'}
                ${error
                  ? 'border-red-400 bg-red-50/50 dark:bg-red-500/5'
                  : active
                    ? 'border-gold shadow-[0_0_0_4px_rgba(201,168,76,0.15)]'
                    : filled
                      ? 'border-gold/60'
                      : 'border-hairline-2'}
              `}
            >
              {/* Input trong suốt phủ kín ô — bàn phím số bật lên trên mobile,
                  còn phần hiển thị do div bên dưới vẽ để canh giữa cho đẹp. */}
              <input
                ref={el => (inputs.current[i] = el)}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={1}
                value={digits[i] || ''}
                disabled={disabled}
                onChange={e => handleChange(i, e)}
                onKeyDown={e => handleKeyDown(i, e)}
                onFocus={() => setFocusIdx(i)}
                onBlur={() => setFocusIdx(p => (p === i ? -1 : p))}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                aria-label={`Chữ số thứ ${i + 1}`}
              />

              {filled ? (
                mask ? (
                  <span className={`w-2.5 h-2.5 rounded-full ${error ? 'bg-red-500' : 'bg-chrome'}`} />
                ) : (
                  <span className={`font-bold ${error ? 'text-red-500' : 'text-ink'}`}>
                    {digits[i]}
                  </span>
                )
              ) : active ? (
                <span className="passcode-caret w-[2px] h-6 bg-gold rounded-full" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-surface-3" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { LENGTH as PASSCODE_LENGTH };
