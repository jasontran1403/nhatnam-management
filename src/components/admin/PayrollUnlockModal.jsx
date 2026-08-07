// src/components/admin/PayrollUnlockModal.jsx
//
// MỞ KHOÁ MẬT KHẨU XEM LƯƠNG cho MỘT nhân viên — mở từ nút hình ổ khoá trên
// dòng nhân viên (chỉ hiện khi tài khoản đó đang bị khoá do nhập sai 3 lần).
//
// Hai lựa chọn, đúng như trang "Khoá xem lương":
//   · Đặt lại về 000000     — nhân viên quên mật khẩu (đa số trường hợp)
//   · Giữ nguyên mật khẩu cũ — nhân viên vẫn nhớ, chỉ bị khoá nhầm
import { useState } from 'react';
import { Unlock, Check } from 'lucide-react';
import { payrollPasscodeApi } from '../../api/payrollPasscodeApi';
import { useToast } from '../common/Toast';
import Modal from '../ui/Modal';
import { PrimaryButton, SecondaryButton } from '../ui';

const OPTIONS = [
  {
    val: true,
    title: 'Đặt lại về mặc định 000000',
    desc: 'Chọn khi nhân viên quên mật khẩu. Nhắc họ đổi lại ngay sau khi vào được.',
  },
  {
    val: false,
    title: 'Đặt lại mật khẩu cũ',
    desc: 'Giữ nguyên mật khẩu nhân viên đang dùng, chỉ xoá trạng thái khoá.',
  },
];

export default function PayrollUnlockModal({ user, onClose }) {
  const toast = useToast();
  const [reset, setReset] = useState(true);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await payrollPasscodeApi.unlock(user.id, reset);
      toast(
        reset
          ? `Đã mở khoá ${user.fullName || user.username} — mật khẩu xem lương về 000000`
          : `Đã mở khoá ${user.fullName || user.username} — giữ nguyên mật khẩu cũ`,
        'success'
      );
      onClose?.(true);
    } catch (e) {
      toast(e?.response?.data?.message || 'Không mở khoá được', 'error');
    } finally { setSaving(false); }
  };

  return (
    <Modal
      open
      onClose={() => !saving && onClose?.(false)}
      title="Mở khoá xem lương"
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={() => onClose?.(false)} disabled={saving}>Huỷ</SecondaryButton>
          <PrimaryButton onClick={submit} loading={saving}>
            <Unlock size={14} /> Xác nhận mở khoá
          </PrimaryButton>
        </div>
      }
    >
      <p className="text-sm text-ink mb-3">
        Nhân viên <span className="font-semibold">{user.fullName || user.username}</span>{' '}
        (<span className="font-mono text-xs">@{user.username}</span>) đã nhập sai
        mật khẩu xem lương quá 3 lần.
      </p>

      <div className="space-y-2.5">
        {OPTIONS.map(opt => (
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
      </div>
    </Modal>
  );
}
