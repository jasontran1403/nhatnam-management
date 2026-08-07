// src/pages/hr/PayrollPasscodeAdminPage.jsx
// MỞ KHOÁ XEM LƯƠNG — dành cho OWNER / ADMIN / HR / SUPERADMIN.
//
// Nhân viên nhập sai mật khẩu xem lương 3 lần sẽ bị khoá và KHÔNG tự mở lại
// được (kể cả tự đổi passcode) — đó là chốt chặn để passcode 6 số không bị dò.
// Trang này là đường mở khoá duy nhất.
//
// Hai lựa chọn khi mở khoá:
//   · Đặt lại về 000000 — dùng khi nhân viên QUÊN mật khẩu (đa số trường hợp)
//   · Giữ nguyên mật khẩu — dùng khi nhân viên vẫn nhớ, chỉ bị người khác
//     nghịch máy làm khoá nhầm
import { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert, Unlock, RefreshCw, Loader2, AlertCircle, KeyRound, X, Check,
} from 'lucide-react';
import { payrollPasscodeApi } from '../../api/payrollPasscodeApi';
import { PageHeader, SectionCard, LoadingSpinner, EmptyState } from '../../components/ui';
import { useToast } from '../../components/common/Toast';
import { roleLabelOf } from '../../components/common/ProfileButton';
import { useLang } from '../../context/LangContext';
import { BackButton, useSubPageNav } from '../../components/common/SubPageNav';

const fmtTime = (ms) => {
  if (!ms) return '—';
  const d = new Date(Number(ms));
  return d.toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

// ══════════════════════════════════════════════════════════════════════════════
// HỘP THOẠI XÁC NHẬN
// ══════════════════════════════════════════════════════════════════════════════

function UnlockModal({ target, onClose, onDone }) {
  const toast = useToast();
  const [reset, setReset] = useState(true);
  const [saving, setSaving] = useState(false);

  if (!target) return null;

  const submit = async () => {
    setSaving(true);
    try {
      await payrollPasscodeApi.unlock(target.id, reset);
      toast(
        reset
          ? `Đã mở khoá ${target.fullName || target.username} — mật khẩu xem lương đặt lại về 000000`
          : `Đã mở khoá ${target.fullName || target.username}`,
        'success'
      );
      onDone?.();
      onClose?.();
    } catch (e) {
      toast(e?.response?.data?.message || 'Không mở khoá được', 'error');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-surface rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-hairline">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-gold/10 flex items-center justify-center">
              <Unlock size={16} className="text-gold" />
            </span>
            <div>
              <p className="font-bold text-ink text-sm">Mở khoá xem lương</p>
              <p className="text-xs text-muted">
                {target.fullName || target.username} · @{target.username}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted hover:bg-canvas">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-3">
          {[
            {
              val: true,
              title: 'Đặt lại về 000000',
              desc: 'Chọn khi nhân viên quên mật khẩu. Nhắc họ đổi lại ngay sau khi vào được.',
            },
            {
              val: false,
              title: 'Giữ nguyên mật khẩu cũ',
              desc: 'Chọn khi nhân viên vẫn nhớ mật khẩu, chỉ cần xoá trạng thái khoá.',
            },
          ].map(opt => (
            <button
              key={String(opt.val)}
              type="button"
              onClick={() => setReset(opt.val)}
              className={`w-full text-left flex items-start gap-3 px-4 py-3 rounded-xl border transition
                ${reset === opt.val
                  ? 'border-gold bg-gold-tint'
                  : 'border-line-soft hover:border-gold/40 hover:bg-canvas'}`}
            >
              <span className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0
                ${reset === opt.val ? 'border-gold bg-gold' : 'border-line'}`}>
                {reset === opt.val && <Check size={10} className="text-white" strokeWidth={4} />}
              </span>
              <span>
                <span className="block text-sm font-semibold text-ink">{opt.title}</span>
                <span className="block text-xs text-muted mt-0.5 leading-relaxed">{opt.desc}</span>
              </span>
            </button>
          ))}

          <button
            onClick={submit}
            disabled={saving}
            className="w-full py-2.5 rounded-xl bg-gold text-white font-semibold
                       hover:bg-gold-strong transition disabled:opacity-50
                       flex items-center justify-center gap-2 mt-1"
          >
            {saving
              ? <><Loader2 size={16} className="animate-spin" /> Đang xử lý...</>
              : <><Unlock size={16} /> Xác nhận mở khoá</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TRANG CHÍNH
// ══════════════════════════════════════════════════════════════════════════════

export default function PayrollPasscodeAdminPage() {
  const { t } = useLang();
  const { from } = useSubPageNav();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [target, setTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const list = await payrollPasscodeApi.lockedUsers();
      setRows(Array.isArray(list) ? list : []);
    } catch (e) {
      setError(e?.response?.data?.message || 'Không tải được danh sách');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5 w-full">
      {/* Trang này còn nằm trong sidebar của HR nên nút Quay lại chỉ hiện khi
          được mở từ nút trên trang Nhân viên của OWNER/ADMIN. */}
      {from && <BackButton fallback={from} />}

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <PageHeader
          icon={ShieldAlert}
          title="Khoá xem lương"
          subtitle="Nhân viên nhập sai mật khẩu xem lương 3 lần — cần mở khoá thủ công"
        />

        <button
          onClick={load}
          disabled={loading}
          className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-surface
                     border border-hairline-2 shadow-sm text-sm font-semibold text-ink
                     hover:border-gold/50 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={15} className={`text-gold ${loading ? 'animate-spin' : ''}`} />
          Tải lại
        </button>
      </div>

      <div className="flex items-start gap-2.5 bg-canvas border border-hairline rounded-2xl px-4 py-3">
        <KeyRound size={15} className="text-gold shrink-0 mt-0.5" />
        <p className="text-xs text-muted leading-relaxed">
          Mật khẩu xem lương mặc định của mọi nhân viên là <b className="text-ink">000000</b>.
          Nhân viên tự đổi trong <b className="text-ink">Thông tin tài khoản → Xem lương</b>.
          Bị khoá thì chỉ trang này mở lại được.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/28 rounded-xl px-4 py-3">
          <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-600 dark:text-red-300 font-medium">{error}</p>
        </div>
      )}

      {loading ? (
        <SectionCard><LoadingSpinner label="Đang tải..." /></SectionCard>
      ) : !rows.length ? (
        <SectionCard>
          <EmptyState
            icon={ShieldAlert}
            title="Không có nhân viên nào bị khoá"
            description="Mọi người đang xem lương bình thường."
          />
        </SectionCard>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map(u => (
            <SectionCard key={u.id}>
              <div className="p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <span className="w-10 h-10 rounded-full bg-gradient-to-br from-gold to-gold-deep
                                   flex items-center justify-center text-white font-bold shrink-0">
                    {(u.fullName || u.username || '?')[0]?.toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-ink truncate">
                      {u.fullName || u.username}
                    </p>
                    <p className="text-xs text-muted truncate">
                      @{u.username}{u.role ? ` · ${roleLabelOf(u.role, t)}` : ''}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted font-semibold">
                      Khoá lúc
                    </p>
                    <p className="text-xs font-medium text-ink mt-0.5">{fmtTime(u.lockedAt)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted font-semibold">
                      Bộ phận
                    </p>
                    <p className="text-xs font-medium text-ink mt-0.5">
                      {u.department || u.position || '—'}
                    </p>
                  </div>
                </div>

                {u.usingDefault && (
                  <p className="text-[11px] text-gold-deep bg-gold-tint border border-gold/25
                                rounded-lg px-2.5 py-1.5">
                    Đang dùng mật khẩu mặc định 000000
                  </p>
                )}

                <button
                  onClick={() => setTarget(u)}
                  className="w-full py-2.5 rounded-xl bg-gold text-white text-sm font-semibold
                             hover:bg-gold-strong transition flex items-center justify-center gap-2"
                >
                  <Unlock size={15} /> Mở khoá
                </button>
              </div>
            </SectionCard>
          ))}
        </div>
      )}

      <UnlockModal target={target} onClose={() => setTarget(null)} onDone={load} />
    </div>
  );
}
