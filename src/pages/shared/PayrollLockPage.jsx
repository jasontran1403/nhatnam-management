// src/pages/shared/PayrollLockPage.jsx
// MÀN HÌNH KHOÁ XEM LƯƠNG.
//
// Chắn trước trang "Quản lý lương": chưa nhập đúng passcode 6 số thì không thấy
// bất kỳ con số lương nào. Có 3 trạng thái:
//
//   1. Đang tải     — hỏi backend xem còn "vé" không / đã bị khoá chưa
//   2. Nhập passcode — 6 ô kiểu OTP, sai tối đa 3 lần
//   3. ĐÃ KHOÁ      — sai lần thứ 3 → không cho nhập nữa, phải liên hệ admin
//
// Component này KHÔNG tự nhớ trạng thái mở khoá: mỗi lần vào lại trang là một
// lần hỏi passcode mới (yêu cầu nghiệp vụ). Backend cũng chỉ cấp "vé" ngắn hạn
// nên gọi thẳng API cũng không lách được.
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Wallet, ShieldCheck, ShieldAlert, Lock, Loader2, AlertCircle, KeyRound, Phone,
} from 'lucide-react';
import PasscodeInput from '../../components/common/PasscodeInput';
import { payrollPasscodeApi, parsePasscodeError } from '../../api/payrollPasscodeApi';
import { useAuth } from '../../context/AuthContext';

// ══════════════════════════════════════════════════════════════════════════════
// KHUNG NỀN — dùng chung cho cả 3 trạng thái để không bị giật layout khi đổi
// ══════════════════════════════════════════════════════════════════════════════

function LockShell({ children }) {
  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full flex justify-center">
      <div className="w-full max-w-md">
        <div className="bg-surface rounded-3xl border border-hairline-2 shadow-sm overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}

/** Dải màu vàng trên đỉnh thẻ — đồng bộ với gradient avatar / nút chính của app. */
function ShellHeader({ icon: Icon, title, subtitle, danger = false }) {
  return (
    <div className="px-6 pt-8 pb-6 text-center border-b border-hairline">
      <div
        className={`
          w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-4
          ${danger
            ? 'bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/18'
            : 'bg-gradient-to-br from-gold to-gold-deep shadow-lg shadow-gold/25'}
        `}
      >
        <Icon size={28} className={danger ? 'text-red-500' : 'text-white'} />
      </div>

      <h2 className="text-lg font-bold text-ink">{title}</h2>
      <p className="text-xs text-muted mt-1.5 leading-relaxed px-2">{subtitle}</p>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TRẠNG THÁI ĐÃ KHOÁ
// ══════════════════════════════════════════════════════════════════════════════

function LockedState({ user }) {
  return (
    <LockShell>
      <ShellHeader
        danger
        icon={ShieldAlert}
        title="Đã khoá xem lương"
        subtitle="Bạn đã nhập sai mật khẩu xem lương 3 lần. Chức năng này đã bị khoá để bảo vệ thông tin lương của bạn."
      />

      <div className="p-6 space-y-4">
        {/* 6 ô mờ + gạch chéo: nói rõ "không phải đang chờ bạn nhập" */}
        <div className="flex items-center justify-center gap-2 sm:gap-2.5 opacity-40 pointer-events-none">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="w-12 h-[3.75rem] sm:w-14 sm:h-16 rounded-2xl border-2 border-dashed border-hairline-3
                         bg-surface-2 flex items-center justify-center"
            >
              <Lock size={15} className="text-faint" />
            </div>
          ))}
        </div>

        <div className="flex items-start gap-2.5 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/18 rounded-2xl px-4 py-3.5">
          <Phone size={16} className="text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-red-700 dark:text-red-300">Liên hệ quản trị viên để mở khoá</p>
            <p className="text-xs text-red-600/90 mt-1 leading-relaxed">
              Vui lòng liên hệ bộ phận Nhân sự hoặc quản trị viên hệ thống. Sau khi
              được mở khoá, mật khẩu xem lương sẽ đặt lại về <b>000000</b> và bạn nên
              đổi ngay trong mục <b>Thông tin tài khoản</b>.
            </p>
          </div>
        </div>

        {user?.username && (
          <div className="rounded-2xl bg-canvas border border-hairline px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-muted font-semibold">
              Mã tài khoản cần cung cấp cho quản trị viên
            </p>
            <p className="text-sm font-bold text-ink mt-1">
              {user.fullName ? `${user.fullName} — ` : ''}@{user.username}
            </p>
          </div>
        )}
      </div>
    </LockShell>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MÀN HÌNH CHÍNH
// ══════════════════════════════════════════════════════════════════════════════

/**
 * @param {Function} onUnlocked  gọi sau khi nhập đúng passcode
 */
export default function PayrollLockPage({ onUnlocked }) {
  const { user } = useAuth();

  const [checking, setChecking]   = useState(true);
  const [locked, setLocked]       = useState(false);
  const [usingDefault, setUsingDefault] = useState(false);
  const [remaining, setRemaining] = useState(3);

  const [code, setCode]       = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError]     = useState('');
  const [shake, setShake]     = useState(false);

  const shakeTimer = useRef(null);

  // ── Hỏi trạng thái khi mở trang ─────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const s = await payrollPasscodeApi.status();
        if (!alive) return;
        setLocked(!!s?.locked);
        setUsingDefault(!!s?.usingDefault);
        setRemaining(
          typeof s?.remainingAttempts === 'number' ? s.remainingAttempts : 3
        );
      } catch (e) {
        if (!alive) return;
        const info = parsePasscodeError(e);
        setLocked(info.locked);
        setError(info.locked ? '' : info.message);
      } finally {
        if (alive) setChecking(false);
      }
    })();
    return () => {
      alive = false;
      if (shakeTimer.current) clearTimeout(shakeTimer.current);
    };
  }, []);

  const triggerShake = () => {
    setShake(true);
    if (shakeTimer.current) clearTimeout(shakeTimer.current);
    shakeTimer.current = setTimeout(() => setShake(false), 500);
  };

  // ── Tự submit khi nhập đủ 6 số ──────────────────────────────────────────
  const handleComplete = useCallback(async (passcode) => {
    if (verifying) return;
    setVerifying(true);
    setError('');

    try {
      await payrollPasscodeApi.verify(passcode);
      onUnlocked?.();

    } catch (e) {
      const info = parsePasscodeError(e);

      if (info.locked) {
        setLocked(true);
        return;
      }

      if (typeof info.remainingAttempts === 'number') setRemaining(info.remainingAttempts);
      setError(info.message);
      triggerShake();

      // Xoá sạch để nhập lại từ ô đầu — không bắt người dùng tự xoá 6 ô
      setTimeout(() => setCode(''), 450);

    } finally {
      setVerifying(false);
    }
  }, [verifying, onUnlocked]);

  // ── Đang kiểm tra ───────────────────────────────────────────────────────
  if (checking) {
    return (
      <LockShell>
        <div className="flex flex-col items-center justify-center gap-3 py-20">
          <Loader2 size={26} className="animate-spin text-gold" />
          <p className="text-sm text-muted">Đang kiểm tra quyền xem lương...</p>
        </div>
      </LockShell>
    );
  }

  // ── Đã khoá ─────────────────────────────────────────────────────────────
  if (locked) return <LockedState user={user} />;

  // ── Nhập passcode ───────────────────────────────────────────────────────
  return (
    <LockShell>
      <ShellHeader
        icon={Wallet}
        title="Nhập mật khẩu xem lương"
        subtitle="Thông tin lương được bảo vệ riêng. Vui lòng nhập mật khẩu 6 số để tiếp tục."
      />

      <div className="p-6 space-y-5">
        <PasscodeInput
          value={code}
          onChange={setCode}
          onComplete={handleComplete}
          disabled={verifying}
          error={!!error}
          shake={shake}
          autoFocus
        />

        {/* Vùng thông báo chiều cao cố định → không nhảy layout khi hiện/ẩn lỗi */}
        <div className="min-h-[3.25rem] flex items-center justify-center">
          {verifying ? (
            <div className="flex items-center gap-2 text-sm text-muted">
              <Loader2 size={15} className="animate-spin text-gold" />
              Đang xác thực...
            </div>
          ) : error ? (
            <div className="w-full flex items-start gap-2 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/18 rounded-xl px-3.5 py-2.5">
              <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-red-600 dark:text-red-300 leading-snug">{error}</p>
                {remaining > 0 && (
                  <p className="text-[11px] text-red-500/80 mt-0.5">
                    Còn {remaining} lần thử. Sai hết sẽ bị khoá và phải liên hệ quản trị viên.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted text-center leading-relaxed">
              Nhập đủ 6 số, hệ thống sẽ tự kiểm tra.
            </p>
          )}
        </div>

        {/* Nhắc đổi mật khẩu nếu vẫn đang dùng 000000 */}
        {usingDefault && !error && (
          <div className="flex items-start gap-2.5 bg-gold-tint border border-gold/30 rounded-2xl px-4 py-3">
            <KeyRound size={15} className="text-gold shrink-0 mt-0.5" />
            <p className="text-xs text-gold-deep leading-relaxed">
              Bạn đang dùng mật khẩu mặc định <b>000000</b>. Hãy đổi tại{' '}
              <b>Thông tin tài khoản → Mật khẩu xem lương</b> để bảo mật hơn.
            </p>
          </div>
        )}

        <div className="flex items-center justify-center gap-1.5 border-t border-hairline pt-4">
          <ShieldCheck size={13} className="text-faint" />
          <p className="text-[11px] text-faint">
            Mỗi lần vào trang lương đều cần nhập lại mật khẩu
          </p>
        </div>
      </div>
    </LockShell>
  );
}
