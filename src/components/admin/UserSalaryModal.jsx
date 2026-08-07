// src/components/admin/UserSalaryModal.jsx
//
// XEM & DUYỆT LƯƠNG CỦA MỘT NHÂN VIÊN — mở từ nút "Xem lương" trên trang Nhân viên.
//
// Ba trạng thái, quyết định bởi dữ liệu chứ không phải bởi người dùng chọn tab:
//
//   1. Chưa có lương, có phiếu chờ  → hiện chi tiết phiếu + nút Duyệt / Từ chối
//   2. Đã có lương, không phiếu mới → chỉ hiện lương hiện tại (chế độ xem)
//   3. Đã có lương, có phiếu mới    → hai card cạnh nhau (cũ | mới) + Duyệt / Từ chối
//
// Việc gộp cả ba vào một modal là có chủ đích: người duyệt luôn bấm cùng một
// nút và tự thấy mình đang ở tình huống nào, không phải nhớ quy trình.
import { useState, useEffect, useCallback } from 'react';
import { DollarSign, Check, X, ArrowRight, AlertCircle } from 'lucide-react';
import { hrSalaryApi } from '../../api/hrApi';
import { useToast } from '../common/Toast';
import Modal from '../ui/Modal';
import { Badge } from '../ui/Badge';
import {
  LoadingSpinner, EmptyState, PrimaryButton, SecondaryButton, DangerButton,
  Field, inputCls, formatCurrency, formatDateTime,
} from '../ui';

const STATUS_META = {
  APPROVED: { label: 'Đã duyệt', variant: 'success' },
  PENDING: { label: 'Chờ duyệt', variant: 'warning' },
  REJECTED: { label: 'Đã từ chối', variant: 'danger' },
};

/** Tổng phụ cấp: ưu tiên danh sách chi tiết, ngã về field gộp nếu chưa có. */
function totalAllowance(s) {
  if (Array.isArray(s?.allowances) && s.allowances.length) {
    return s.allowances.reduce((t, a) => t + (Number(a.amount) || 0), 0);
  }
  return Number(s?.allowance) || 0;
}

/** Một dòng số liệu; `diff` khác null thì tô màu theo chiều tăng/giảm. */
function Line({ label, value, diff = null, strong = false }) {
  const cls = diff == null || diff === 0
    ? 'text-ink'
    : diff > 0
      ? 'text-emerald-600 dark:text-emerald-300'
      : 'text-red-600 dark:text-red-300';

  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="text-xs text-muted">{label}</span>
      <span className={`text-sm ${strong ? 'font-bold' : 'font-medium'} ${cls} tabular-nums`}>
        {value}
        {diff != null && diff !== 0 && (
          <span className="ml-1.5 text-[11px] font-semibold">
            ({diff > 0 ? '+' : '−'}{formatCurrency(Math.abs(diff))})
          </span>
        )}
      </span>
    </div>
  );
}

/**
 * Card một bản ghi lương.
 *
 * @param compareTo  bản ghi đối chiếu — truyền vào thì mỗi dòng hiện thêm mức chênh
 */
function SalaryCard({ salary, title, tone = 'neutral', compareTo = null }) {
  if (!salary) {
    return (
      <div className="rounded-2xl border border-dashed border-line-soft p-5 flex items-center justify-center min-h-[220px]">
        <p className="text-xs text-muted text-center leading-relaxed">
          Chưa có mức lương nào<br />được duyệt trước đó
        </p>
      </div>
    );
  }

  const meta = STATUS_META[salary.status] || STATUS_META.PENDING;
  const ring = tone === 'new'
    ? 'border-gold/50 bg-gold-tint'
    : 'border-hairline bg-surface';

  const d = (a, b) => (compareTo ? (Number(a) || 0) - (Number(b) || 0) : null);
  const allow = totalAllowance(salary);
  const allowOld = compareTo ? totalAllowance(compareTo) : 0;

  return (
    <div className={`rounded-2xl border p-5 ${ring}`}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <p className="text-xs font-bold uppercase tracking-wider text-muted">{title}</p>
        <Badge variant={meta.variant}>{meta.label}</Badge>
      </div>

      <div className="divide-y divide-hairline">
        <Line label="Lương NET thực nhận"
          value={formatCurrency(salary.baseSalary)}
          diff={d(salary.baseSalary, compareTo?.baseSalary)} strong />
        <Line label="Mức lương đóng BH"
          value={formatCurrency(salary.insuranceSalary ?? salary.baseSalary)}
          diff={d(salary.insuranceSalary ?? salary.baseSalary,
            compareTo?.insuranceSalary ?? compareTo?.baseSalary)} />
        <Line label="Tổng phụ cấp"
          value={formatCurrency(allow)}
          diff={compareTo ? allow - allowOld : null} />
        <Line label="Thưởng"
          value={formatCurrency(salary.bonus)}
          diff={d(salary.bonus, compareTo?.bonus)} />
        <Line label="Người phụ thuộc" value={salary.dependents ?? 0} />
      </div>

      {Array.isArray(salary.allowances) && salary.allowances.length > 0 && (
        <div className="mt-3 pt-3 border-t border-hairline space-y-1">
          <p className="text-[10px] uppercase tracking-wide text-muted font-semibold mb-1">
            Chi tiết phụ cấp
          </p>
          {salary.allowances.map((a, i) => (
            <div key={i} className="flex justify-between gap-2 text-xs">
              <span className="text-muted truncate">{a.label}</span>
              <span className="text-ink font-medium tabular-nums">{formatCurrency(a.amount)}</span>
            </div>
          ))}
        </div>
      )}

      <p className="text-[11px] text-muted mt-3 pt-3 border-t border-hairline">
        {salary.createdByName ? `Lập bởi ${salary.createdByName} · ` : ''}
        {formatDateTime(salary.createdAt)}
      </p>

      {salary.rejectReason && (
        <p className="text-[11px] text-red-600 dark:text-red-300 mt-2">
          Lý do từ chối: {salary.rejectReason}
        </p>
      )}
    </div>
  );
}

export default function UserSalaryModal({ user, onClose }) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await hrSalaryApi.overview(user.id));
    } catch (e) {
      toast(e?.response?.data?.message || 'Không tải được thông tin lương', 'error');
    } finally { setLoading(false); }
  }, [user.id, toast]);

  useEffect(() => { load(); }, [load]);

  const pending = data?.pending || null;
  const current = data?.current || null;

  const approve = async () => {
    setSaving(true);
    try {
      await hrSalaryApi.approve(pending.id);
      toast(`Đã duyệt lương cho ${user.fullName || user.username}`, 'success');
      onClose?.(true);
    } catch (e) {
      toast(e?.response?.data?.message || e.message || 'Duyệt lương thất bại', 'error');
    } finally { setSaving(false); }
  };

  const reject = async () => {
    if (!reason.trim()) { toast('Cần nhập lý do từ chối', 'error'); return; }
    setSaving(true);
    try {
      await hrSalaryApi.reject(pending.id, { rejectReason: reason.trim() });
      toast('Đã từ chối phiếu lương', 'success');
      onClose?.(true);
    } catch (e) {
      toast(e?.response?.data?.message || e.message || 'Từ chối thất bại', 'error');
    } finally { setSaving(false); }
  };

  // So sánh chỉ có nghĩa khi tồn tại cả hai vế.
  const isComparison = !!(pending && current);

  return (
    <Modal
      open
      onClose={() => !saving && onClose?.(false)}
      title={`Lương — ${user.fullName || user.username}`}
      size={isComparison ? 'lg' : 'md'}
      footer={
        pending ? (
          rejecting ? (
            <div className="flex justify-end gap-2">
              <SecondaryButton onClick={() => { setRejecting(false); setReason(''); }} disabled={saving}>
                Huỷ
              </SecondaryButton>
              <DangerButton onClick={reject} loading={saving}>Xác nhận từ chối</DangerButton>
            </div>
          ) : (
            <div className="flex justify-end gap-2">
              <DangerButton onClick={() => setRejecting(true)} disabled={saving}>
                <X size={14} /> Từ chối
              </DangerButton>
              <PrimaryButton onClick={approve} loading={saving}>
                <Check size={14} /> Duyệt lương
              </PrimaryButton>
            </div>
          )
        ) : (
          <div className="flex justify-end">
            <SecondaryButton onClick={() => onClose?.(false)}>Đóng</SecondaryButton>
          </div>
        )
      }
    >
      {loading ? (
        <LoadingSpinner label="Đang tải lương…" />
      ) : !pending && !current ? (
        <EmptyState
          icon={DollarSign}
          title="Chưa có dữ liệu lương"
          description="Nhân viên này chưa được nhập mức lương nào."
        />
      ) : isComparison ? (
        <>
          <div className="flex items-start gap-2 mb-4 px-3 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/28">
            <AlertCircle size={15} className="text-amber-600 dark:text-amber-300 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
              Có phiếu lương mới đang chờ duyệt. Mức chênh so với lương hiện tại
              được ghi ngay cạnh từng dòng ở card bên phải.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 items-center">
            <SalaryCard salary={current} title="Lương hiện tại" />
            <ArrowRight size={20} className="text-gold mx-auto rotate-90 md:rotate-0" />
            <SalaryCard salary={pending} title="Phiếu lương mới" tone="new" compareTo={current} />
          </div>
        </>
      ) : pending ? (
        <>
          <p className="text-xs text-muted mb-3 leading-relaxed">
            Nhân viên chưa có mức lương nào được duyệt. Dưới đây là phiếu lương
            đang chờ — duyệt để áp dụng chính thức.
          </p>
          <SalaryCard salary={pending} title="Phiếu lương chờ duyệt" tone="new" />
        </>
      ) : (
        <SalaryCard salary={current} title="Lương hiện tại" />
      )}

      {rejecting && pending && (
        <div className="mt-4">
          <Field label="Lý do từ chối" required>
            <textarea
              className={inputCls}
              rows={3}
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Nhập lý do để người lập phiếu sửa lại…"
              autoFocus
            />
          </Field>
        </div>
      )}
    </Modal>
  );
}
