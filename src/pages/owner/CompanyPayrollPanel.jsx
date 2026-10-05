// src/pages/owner/CompanyPayrollPanel.jsx
//
// PANEL "TÍNH LƯƠNG CẢ CÔNG TY" — Phase 7 refactor (10/2026).
//
// Layout mới:
//   ┌─────────────────┬──────────────────────────────────────────────┐
//   │  Bảng chấm công  │  Lịch nghỉ/trễ/sớm │ Thưởng │ Phụ cấp       │
//   │   (1/3 chiều ngang)│   (chia 3 cột đều,  ngăn bằng divider dọc) │
//   └─────────────────┴──────────────────────────────────────────────┘
//
// So với Phase 6:
//   - Bỏ hẳn "Đơn xin nghỉ phép" (nhân viên tự tạo qua MyRequestsPage).
//   - Khối phải gộp 3 loại upload (lịch nghỉ · thưởng · phụ cấp) chia 3 cột.
//   - Upload thưởng/phụ cấp giờ chung cho cả công ty (bỏ per-department).
//
// Mọi lifecycle action (upload, Tính lương, Public, Unpublic, Mở lại) gọi
// vào BE Phase 2/7 — FE chỉ việc đọc flags canCalculate/canPublish/...

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload, FileSpreadsheet, Trash2, Calculator, Send, Lock, Unlock,
  AlertCircle, CheckCircle2, RefreshCw, Clock, CalendarClock,
  Clock3, Gift, Wallet, CalendarCheck, Download, Search, X,
} from 'lucide-react';
import { companyPayrollApi, CALC_STATUS_LABEL, CALC_STATUS_COLOR } from '../../api/companyPayrollApi';
import { factoryPayrollApi } from '../../api/factoryPayrollApi';
import { PayrollTables } from './AttendanceSheetsPage';
import {
  SectionCard, PrimaryButton, SecondaryButton, LoadingSpinner,
  formatDateTime, formatCurrency,
} from '../../components/ui';
import { useToast } from '../../components/common/Toast';

// Phase 6: key dùng để đồng bộ tháng/năm giữa trang này và ChuyenCanPage.
const PAYROLL_MONTH_KEY = 'payrollSelectedMonth';

// ──────────────────────────────────────────────────────────────────────────────
// COMPACT SLOT — dùng trong khối phải (3 sub-cột). Gọn hơn FileSlot cũ.
// ──────────────────────────────────────────────────────────────────────────────

function CompactSlot({
  icon: Icon, title, description,
  fileName, uploadedAt, canUpload, canDelete,
  onUpload, onDelete, onTemplate, uploading, deleting, lockedReason,
  accept = '.xlsx,.xls',
}) {
  const inputRef = useRef(null);
  const hasFile = !!fileName;
  const handlePick = (e) => {
    const f = e.target.files?.[0];
    if (f) onUpload(f);
    e.target.value = '';
  };

  return (
    <div className="flex-1 min-w-0 flex flex-col">
      <div className="flex items-start gap-2 mb-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0
          ${hasFile ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                    : 'bg-canvas text-muted'}`}>
          <Icon size={15} />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-ink text-xs leading-snug">{title}</h4>
          <p className="text-[11px] text-muted mt-0.5 leading-snug">{description}</p>
        </div>
      </div>

      {hasFile && (
        <div className="mb-2 flex items-center gap-1.5 text-[11px]">
          <CheckCircle2 size={11} className="text-emerald-600 shrink-0" />
          <span className="text-emerald-700 dark:text-emerald-300 font-semibold truncate">{fileName}</span>
        </div>
      )}
      {hasFile && uploadedAt && (
        <p className="text-[10px] text-muted mb-2 leading-tight">{formatDateTime(uploadedAt)}</p>
      )}

      {lockedReason && (
        <p className="mb-2 text-[10px] text-amber-700 dark:text-amber-300 flex items-center gap-1 leading-tight">
          <Lock size={10} /> {lockedReason}
        </p>
      )}

      <div className="mt-auto flex items-center gap-1.5">
        <input ref={inputRef} type="file" accept={accept} className="hidden"
          onChange={handlePick} disabled={!canUpload || uploading} />
        {onTemplate && (
          <SecondaryButton
            onClick={onTemplate}
            disabled={uploading || deleting}
            size="sm"
            title="Tải file mẫu"
            className="text-[11px]">
            <Download size={11} /> Mẫu
          </SecondaryButton>
        )}
        {/*
          Nút Tải lên / Thay file:
          - canUpload = false (đã tính lương / public) → chuyển sang kiểu DISABLED
            xám hẳn, kèm cursor-not-allowed; tooltip hiện lockedReason để OWNER
            hiểu phải Mở lại trước.
          - canUpload = true → kiểu primary bình thường.
        */}
        <SecondaryButton
          onClick={() => inputRef.current?.click()}
          disabled={!canUpload || uploading || deleting}
          loading={uploading}
          size="sm"
          title={!canUpload ? (lockedReason || 'Đã khoá — Mở lại để chỉnh sửa') : undefined}
          className={`flex-1 text-[11px] ${!canUpload
              ? 'opacity-50 cursor-not-allowed bg-canvas/50 text-muted border-hairline-1'
              : ''}`}>
          <Upload size={11} /> {hasFile ? 'Thay' : 'Tải lên'}
        </SecondaryButton>
        {hasFile && (
          <SecondaryButton
            onClick={onDelete}
            disabled={!canDelete || uploading || deleting}
            loading={deleting}
            size="sm"
            title={!canDelete ? (lockedReason || 'Đã khoá — Mở lại để chỉnh sửa') : undefined}
            className={!canDelete
              ? 'opacity-50 cursor-not-allowed bg-canvas/50 text-muted border-hairline-1'
              : 'text-red-600 border-red-200 hover:bg-red-50'}>
            <Trash2 size={11} />
          </SecondaryButton>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// LARGE SLOT — bên trái, cho bảng chấm công
// ──────────────────────────────────────────────────────────────────────────────

function LargeSlot({
  icon: Icon, title, description,
  fileName, uploadedAt, canUpload, canDelete,
  onUpload, onDelete, uploading, deleting, lockedReason,
}) {
  const inputRef = useRef(null);
  const hasFile = !!fileName;
  const handlePick = (e) => {
    const f = e.target.files?.[0];
    if (f) onUpload(f);
    e.target.value = '';
  };

  return (
    <div className={`rounded-2xl border p-4 transition-colors h-full flex flex-col
      ${hasFile ? 'border-emerald-200 bg-emerald-50/40 dark:bg-emerald-500/5 dark:border-emerald-500/20'
                : 'border-hairline-2 bg-canvas'}`}>
      <div className="flex items-start gap-3 mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0
          ${hasFile ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                    : 'bg-surface text-muted'}`}>
          <Icon size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-ink text-sm">{title}</h4>
          <p className="text-xs text-muted mt-0.5">{description}</p>
        </div>
      </div>

      {hasFile && (
        <div className="mb-2 flex items-center gap-2 text-xs">
          <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
          <span className="text-emerald-700 dark:text-emerald-300 font-semibold truncate">{fileName}</span>
          {uploadedAt && <span className="text-muted">· {formatDateTime(uploadedAt)}</span>}
        </div>
      )}

      {lockedReason && (
        <p className="mb-2 text-[11px] text-amber-700 dark:text-amber-300 flex items-center gap-1">
          <Lock size={11} /> {lockedReason}
        </p>
      )}

      <div className="mt-auto flex items-center gap-2">
        <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden"
          onChange={handlePick} disabled={!canUpload || uploading} />
        <SecondaryButton
          onClick={() => inputRef.current?.click()}
          disabled={!canUpload || uploading || deleting}
          loading={uploading} size="sm" className="flex-1">
          <Upload size={13} /> {hasFile ? 'Thay file' : 'Tải file lên'}
        </SecondaryButton>
        {hasFile && (
          <SecondaryButton
            onClick={onDelete}
            disabled={!canDelete || uploading || deleting}
            loading={deleting}
            size="sm"
            className="text-red-600 border-red-200 hover:bg-red-50">
            <Trash2 size={13} />
          </SecondaryButton>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// STATUS BADGE
// ──────────────────────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const label = CALC_STATUS_LABEL[status] || status;
  const color = CALC_STATUS_COLOR[status] || CALC_STATUS_COLOR.NONE;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${color}`}>
      {status === 'PUBLISHED' && <CheckCircle2 size={12} />}
      {status === 'CALCULATED' && <Clock3 size={12} />}
      {status === 'UPLOADED' && <FileSpreadsheet size={12} />}
      {status === 'NONE' && <AlertCircle size={12} />}
      {label}
    </span>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// MAIN
// ──────────────────────────────────────────────────────────────────────────────

export default function CompanyPayrollPanel({ month, year, onStatusChanged }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  // kind: 'ATTENDANCE' | 'EXCEPTION' | 'BONUS' | 'ALLOWANCE'
  const [uploadingKind, setUploadingKind] = useState(null);
  const [deletingKind, setDeletingKind] = useState(null);
  const [actionBusy, setActionBusy] = useState(null);
  // HOTFIX (10/2026): hiển thị danh sách warning sau upload — trước đây
  // chỉ log console nên user không thấy nhân viên nào không khớp.
  const [uploadWarnings, setUploadWarnings] = useState(null);
  const toast = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (month && year) {
      localStorage.setItem(PAYROLL_MONTH_KEY, JSON.stringify({ month, year }));
    }
  }, [month, year]);

  const load = useCallback(async () => {
    if (!month || !year) return;
    setLoading(true);
    try {
      const s = await companyPayrollApi.status(month, year);
      setStatus(s);
    } catch (e) {
      toast(e?.response?.data?.message || 'Không tải được trạng thái tháng', 'error');
    } finally {
      setLoading(false);
    }
  }, [month, year, toast]);

  useEffect(() => { load(); }, [load]);

  const notifyParent = () => { if (onStatusChanged) onStatusChanged(); };

  // ── Upload / delete file ────────────────────────────────────────────────────
  const handleUpload = async (kind, file) => {
    setUploadingKind(kind);
    try {
      const apiCall = {
        ATTENDANCE: companyPayrollApi.uploadAttendance,
        EXCEPTION:  companyPayrollApi.uploadException,
        BONUS:      companyPayrollApi.uploadBonus,
        ALLOWANCE:  companyPayrollApi.uploadAllowance,
      }[kind];
      const res = await apiCall(file, month, year);
      setStatus(res.status);
      const msg =
        kind === 'ATTENDANCE' ? `Đã tải lên bảng chấm công (${res.matchedUsers}/${res.parsedRows} nhân viên khớp)`
        : kind === 'BONUS'     ? `Đã import ${res.matchedUsers}/${res.parsedRows} dòng thưởng`
        : kind === 'ALLOWANCE' ? `Đã import ${res.matchedUsers}/${res.parsedRows} dòng phụ cấp`
        : 'Đã tải lên file';
      toast(msg, 'success');
      if (res.warnings?.length) {
        // HOTFIX: lưu warnings vào state để render ra UI thay vì log console.
        setUploadWarnings({ kind, warnings: res.warnings });
        console.warn('[CompanyPayroll] warnings:', res.warnings);
      }
      notifyParent();
    } catch (e) {
      toast(e?.response?.data?.message || 'Upload thất bại', 'error');
    } finally {
      setUploadingKind(null);
    }
  };

  // ── Tải file mẫu — 3 slot ────────────────────────────────────────────────
  // Mỗi slot (lịch nghỉ / thưởng / phụ cấp) có nút "Mẫu" để tải file Excel
  // mẫu đã prefill sẵn danh sách nhân viên của tháng, HR chỉ nhập số liệu.
  const handleTemplate = async (kind) => {
    const apiKind = { EXCEPTION: 'exception', BONUS: 'bonus', ALLOWANCE: 'allowance' }[kind];
    if (!apiKind) return;
    try {
      await factoryPayrollApi.downloadTemplate(apiKind, month, year);
      toast('Đã tải file mẫu', 'success');
    } catch (e) {
      toast(e?.response?.data?.message || 'Không tải được file mẫu', 'error');
    }
  };

  // ── Modal xác nhận cho các hành động nguy hiểm ─────────────────────────
  //
  // Thay native window.confirm (xấu, không khớp theme) bằng 1 modal custom.
  // State:
  //   {title, message, tone, confirmLabel, onConfirm}
  // tone: 'danger' (đỏ) | 'warn' (vàng) | 'neutral' (xám).
  const [confirm, setConfirm] = useState(null);
  const askConfirm = (cfg) => setConfirm(cfg);
  const closeConfirm = () => setConfirm(null);

  const handleDelete = (kind) => {
    const cfg = {
      ATTENDANCE: {
        title: 'Xoá file chấm công?',
        message: 'Toàn bộ dữ liệu chấm công nhân viên tháng này sẽ bị xoá, không thể hoàn tác.',
        confirmLabel: 'Xoá',
        tone: 'danger',
      },
      EXCEPTION: {
        title: 'Xoá file lịch nghỉ / đi trễ / về sớm?',
        message: 'Các ngày phép đã duyệt và các override giờ chấm công cho tháng này sẽ bị gỡ.',
        confirmLabel: 'Xoá',
        tone: 'danger',
      },
    }[kind];
    if (!cfg) return;    // Bonus/Allowance không xoá bằng nút này — có panel riêng

    askConfirm({
      ...cfg,
      onConfirm: async () => {
        closeConfirm();
        setDeletingKind(kind);
        try {
          const s = await companyPayrollApi.deleteFile(kind, month, year);
          setStatus(s);
          toast('Đã xoá file', 'success');
          notifyParent();
        } catch (e) {
          toast(e?.response?.data?.message || 'Không xoá được file', 'error');
        } finally {
          setDeletingKind(null);
        }
      },
    });
  };

  // ── Lifecycle actions ───────────────────────────────────────────────────────
  const runAction = async (name, fn, successMsg) => {
    setActionBusy(name);
    try {
      const res = await fn(month, year);
      setStatus(res?.status ?? res);
      toast(successMsg, 'success');
      notifyParent();
    } catch (e) {
      toast(e?.response?.data?.message || 'Thao tác thất bại', 'error');
    } finally {
      setActionBusy(null);
    }
  };

  const handleCalculate = () => runAction(
    'calc', companyPayrollApi.calculate,
    'Đã tính lương — nội bộ xem được, nhân viên chưa thấy'
  );
  const handlePublish = () => runAction(
    'publish', companyPayrollApi.publish,
    'Đã Public — nhân viên vào phiếu lương xem được'
  );

  const handleUnpublish = () => askConfirm({
    title: 'Unpublic phiếu lương?',
    message:
      'Nhân viên sẽ không còn xem được phiếu lương tháng này cho tới khi bạn Public lại. ' +
      'Dữ liệu lương đã tính vẫn giữ nguyên — bạn có thể Public lại bất cứ lúc nào.',
    confirmLabel: 'Unpublic',
    tone: 'warn',
    onConfirm: () => {
      closeConfirm();
      runAction('unpublish', companyPayrollApi.unpublish,
        'Đã Unpublic — phiếu lương bị ẩn khỏi nhân viên');
    },
  });

  const handleReopen = () => askConfirm({
    title: 'Mở lại kỳ lương?',
    message:
      'Toàn bộ OT đã tính và các khoản thưởng/phụ cấp đã lock cho tháng này sẽ ' +
      'bị XOÁ. Sau khi mở lại, bạn có thể upload/import lại các file. Thao tác này ' +
      'không ảnh hưởng tới file chấm công đã upload.',
    confirmLabel: 'Mở lại',
    tone: 'warn',
    onConfirm: () => {
      closeConfirm();
      runAction('reopen', companyPayrollApi.reopen,
        'Đã Mở lại — có thể upload/import lại');
    },
  });

  // ── RENDER ────────────────────────────────────────────────────────────────

  if (loading && !status) {
    return (
      <SectionCard>
        <div className="py-10 flex justify-center">
          <LoadingSpinner />
        </div>
      </SectionCard>
    );
  }

  if (!status) return null;

  const s = status;
  const lockReason = !s.canUploadAdjustments
    ? `Đang ${CALC_STATUS_LABEL[s.calcStatus]} — Mở lại để chỉnh sửa`
    : null;

  return (
    // FIX (10/2026): SectionCard mặc định padding mỏng, card này rộng và chứa
    // nhiều phần — thêm padding thoáng để các khối không dính nhau.
    <SectionCard className="!p-5 md:!p-6">
      {/* ── HEADER: trạng thái + nút lifecycle ─────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="font-bold text-lg text-ink">
              Tính lương tháng {String(s.month).padStart(2, '0')}/{s.year}
            </h2>
            <StatusBadge status={s.calcStatus} />
          </div>
          <p className="text-xs text-muted mt-1">
            Dùng chung 1 file chấm công cho toàn công ty. Thưởng và phụ cấp
            cũng import chung ở đây, phân bổ theo mã nhân viên.
          </p>

          {s.calculatedAt && (
            <p className="text-[11px] text-muted mt-1.5 flex items-center gap-1">
              <Clock size={11} /> Tính lúc {formatDateTime(s.calculatedAt)}
              {s.calculatedByName && <span>· bởi {s.calculatedByName}</span>}
            </p>
          )}
          {s.publishedAt && (
            <p className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-0.5 flex items-center gap-1">
              <Send size={11} /> Public lúc {formatDateTime(s.publishedAt)}
              {s.publishedByName && <span>· bởi {s.publishedByName}</span>}
            </p>
          )}
        </div>

        {/* NÚT LIFECYCLE */}
        <div className="flex items-center gap-2 flex-wrap">
          <SecondaryButton
            onClick={() => navigate(`/owner/chuyen-can?month=${month}&year=${year}`)}
            disabled={!s.canChuyenCan}
            title={s.canChuyenCan ? 'Xem matrix đi trễ / về sớm' : 'Bấm Tính lương trước'}>
            <CalendarCheck size={15} /> Chuyên cần
          </SecondaryButton>

          {(s.calcStatus === 'NONE' || s.calcStatus === 'UPLOADED') && (
            <PrimaryButton
              onClick={handleCalculate}
              disabled={!s.canCalculate || actionBusy !== null}
              loading={actionBusy === 'calc'}>
              <Calculator size={15} /> Tính lương
            </PrimaryButton>
          )}
          {s.calcStatus === 'CALCULATED' && (
            <SecondaryButton
              onClick={handleReopen}
              disabled={!s.canReopen || actionBusy !== null}
              loading={actionBusy === 'reopen'}>
              <RefreshCw size={15} /> Mở lại
            </SecondaryButton>
          )}
          {s.calcStatus === 'CALCULATED' && (
            <PrimaryButton
              onClick={handlePublish}
              disabled={!s.canPublish || actionBusy !== null}
              loading={actionBusy === 'publish'}>
              <Send size={15} /> Public
            </PrimaryButton>
          )}
          {s.calcStatus === 'PUBLISHED' && (
            <SecondaryButton
              onClick={handleUnpublish}
              disabled={!s.canUnpublish || actionBusy !== null}
              loading={actionBusy === 'unpublish'}
              className="text-amber-700 border-amber-300 hover:bg-amber-50">
              <Unlock size={15} /> Unpublic
            </SecondaryButton>
          )}
        </div>
      </div>

      {/* ── LAYOUT 2 CỘT: TRÁI (chấm công) · PHẢI (3 sub-cột) ──────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-5">
        {/* Cột trái — 1/3 chiều ngang */}
        <LargeSlot
          icon={FileSpreadsheet}
          title="Bảng chấm công"
          description="File xuất từ máy chấm công, dùng cho CẢ CÔNG TY. Bắt buộc trước khi bấm Tính lương."
          fileName={s.attendanceFileName}
          uploadedAt={s.attendanceUploadedAt}
          canUpload={s.canUploadAttendance}
          canDelete={s.canUploadAttendance}
          uploading={uploadingKind === 'ATTENDANCE'}
          deleting={deletingKind === 'ATTENDANCE'}
          onUpload={(f) => handleUpload('ATTENDANCE', f)}
          onDelete={() => handleDelete('ATTENDANCE')}
          lockedReason={!s.canUploadAttendance ? 'Đã Public — Unpublic trước khi thay file' : null}
        />

        {/* Cột phải — chiếm 2/3, bên trong chia 3 cột ngăn bởi divider dọc */}
        <div className="lg:col-span-2 rounded-2xl border border-hairline-2 bg-canvas p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-0 divide-y md:divide-y-0 md:divide-x divide-hairline-2">
            <div className="pb-4 md:pb-0 md:pr-4">
              <CompactSlot
                icon={CalendarClock}
                title="Lịch nghỉ / đi trễ / về sớm"
                description="Danh sách các ngày nghỉ ngoài phép, điều chỉnh giờ chấm công."
                fileName={s.exceptionFileName}
                uploadedAt={s.exceptionUploadedAt}
                canUpload={s.canUploadAdjustments}
                canDelete={s.canUploadAdjustments}
                uploading={uploadingKind === 'EXCEPTION'}
                deleting={deletingKind === 'EXCEPTION'}
                onUpload={(f) => handleUpload('EXCEPTION', f)}
                onDelete={() => handleDelete('EXCEPTION')}
                onTemplate={() => handleTemplate('EXCEPTION')}
                lockedReason={lockReason}
              />
            </div>

            <div className="py-4 md:py-0 md:px-4">
              <CompactSlot
                icon={Gift}
                title="Thưởng"
                description="File thưởng theo nhãn (ô B2). Nhiều khoản = nhiều file, upload riêng từng cái."
                fileName={null}
                uploadedAt={null}
                canUpload={s.canUploadAdjustments}
                canDelete={false}
                uploading={uploadingKind === 'BONUS'}
                deleting={false}
                onUpload={(f) => handleUpload('BONUS', f)}
                onDelete={() => {}}
                onTemplate={() => handleTemplate('BONUS')}
                lockedReason={lockReason}
              />
              {s.bonusLineCount > 0 && (
                <p className="text-[10px] text-emerald-700 dark:text-emerald-300 mt-1.5 flex items-center gap-1">
                  <CheckCircle2 size={10} /> {s.bonusLineCount} dòng đã import
                </p>
              )}
            </div>

            <div className="pt-4 md:pt-0 md:pl-4">
              <CompactSlot
                icon={Wallet}
                title="Phụ cấp"
                description="Xăng xe, điện thoại, trách nhiệm… Mỗi nhãn tối đa 1 dòng/nhân viên."
                fileName={null}
                uploadedAt={null}
                canUpload={s.canUploadAdjustments}
                canDelete={false}
                uploading={uploadingKind === 'ALLOWANCE'}
                deleting={false}
                onUpload={(f) => handleUpload('ALLOWANCE', f)}
                onDelete={() => {}}
                onTemplate={() => handleTemplate('ALLOWANCE')}
                lockedReason={lockReason}
              />
              {s.allowanceLineCount > 0 && (
                <p className="text-[10px] text-emerald-700 dark:text-emerald-300 mt-1.5 flex items-center gap-1">
                  <CheckCircle2 size={10} /> {s.allowanceLineCount} dòng đã import
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── TÓM TẮT OT khi CALCULATED/PUBLISHED ──────────────────────────── */}
      {(s.calcStatus === 'CALCULATED' || s.calcStatus === 'PUBLISHED') && (
        <div className="rounded-2xl border border-hairline-2 bg-canvas p-4 mt-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock3 size={14} className="text-gold" />
            <h3 className="font-bold text-sm text-ink">Tổng phụ cấp OT đã tính</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <OtStat label="Ngày thường" minutes={s.otTotalWeekdayMinutes} multiplier="×1.5" />
            <OtStat label="Chủ nhật"   minutes={s.otTotalSundayMinutes}   multiplier="×2.0" />
            <OtStat label="Ngày lễ"     minutes={s.otTotalHolidayMinutes}  multiplier="×3.0" />
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-500/10 p-3 border border-emerald-200 dark:border-emerald-500/20">
              <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-bold uppercase tracking-wider">
                Tổng tiền OT
              </p>
              <p className="text-lg font-bold text-emerald-800 dark:text-emerald-200 mt-1">
                {formatCurrency(s.otTotalAmount || 0)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── PHIẾU LƯƠNG CHUNG CÔNG TY (khi đã tính lương / public) ────────
          Phase 7 → 10/2026: GỠ bảng phiếu lương per-dept ở phía dưới (tab bộ
          phận giờ chỉ còn Bonus/KPI). Toàn bộ 5 bộ phận lên chung tại đây,
          mỗi bộ phận là 1 header + 1 bảng PayrollTables. Cuộn 1 lèo xem được
          cả công ty, dễ đối chiếu tổng NET giữa các bộ phận. */}
      {(s.calcStatus === 'CALCULATED' || s.calcStatus === 'PUBLISHED') && (
        <CompanyPayrollSection month={month} year={year} statusKey={s.calcStatus} />
      )}

      {/* HOTFIX: dialog hiển thị warnings sau upload — thay vì log console.
          Giúp OWNER thấy ngay nhân viên nào không khớp để điền employee_code
          hoặc sửa tên trong hồ sơ. */}
      {uploadWarnings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
             onClick={() => setUploadWarnings(null)}>
          <div className="bg-surface rounded-2xl border border-hairline-2 max-w-2xl w-full
            max-h-[80vh] flex flex-col shadow-xl"
            onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-hairline-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle size={18} className="text-amber-600" />
                <h3 className="font-bold text-ink text-sm">
                  Có {uploadWarnings.warnings.length} cảnh báo khi upload{' '}
                  {uploadWarnings.kind === 'ATTENDANCE' ? 'bảng chấm công'
                    : uploadWarnings.kind === 'BONUS' ? 'thưởng'
                    : uploadWarnings.kind === 'ALLOWANCE' ? 'phụ cấp'
                    : 'file'}
                </h3>
              </div>
              <button onClick={() => setUploadWarnings(null)}
                className="w-7 h-7 rounded-lg hover:bg-canvas flex items-center justify-center text-muted">
                ×
              </button>
            </div>
            <div className="px-5 py-4 overflow-y-auto flex-1">
              <p className="text-xs text-muted mb-3">
                Những dòng dưới đây KHÔNG được xử lý. Phổ biến nhất: mã nhân viên
                trong file không khớp với <code>employee_code</code> trong hồ sơ
                nhân sự, hoặc tên viết tắt không match. Kiểm tra tại{' '}
                <strong>/admin/users</strong> để điền mã.
              </p>
              <ul className="space-y-1.5 text-xs">
                {uploadWarnings.warnings.map((w, i) => (
                  <li key={i} className="px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-500/10
                    text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-500/20">
                    {w}
                  </li>
                ))}
              </ul>
            </div>
            <div className="px-5 py-3 border-t border-hairline-2 flex justify-end">
              <SecondaryButton onClick={() => setUploadWarnings(null)}>Đóng</SecondaryButton>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL XÁC NHẬN hành động nguy hiểm (xoá / mở lại / unpublic) ── */}
      {confirm && (
        <ConfirmModal
          title={confirm.title}
          message={confirm.message}
          confirmLabel={confirm.confirmLabel}
          tone={confirm.tone}
          onConfirm={confirm.onConfirm}
          onCancel={closeConfirm}
          busy={actionBusy != null || deletingKind != null}
        />
      )}
    </SectionCard>
  );
}

/**
 * Modal xác nhận cho các hành động nguy hiểm. Replace native window.confirm.
 *
 * Tone:
 *  - 'danger': đỏ (xoá file).
 *  - 'warn':   vàng (unpublic, mở lại kỳ lương).
 *  - 'neutral': xám (hành động vô hại cần confirm, hiện chưa dùng).
 *
 * Click ngoài hoặc Esc = cancel. Nút Confirm có loading state khi `busy`.
 */
function ConfirmModal({ title, message, confirmLabel = 'Xác nhận',
                       tone = 'danger', onConfirm, onCancel, busy }) {
  // Esc để huỷ — convenient cho user bấm nhầm.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onCancel?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel, busy]);

  const toneClasses = {
    danger: {
      icon: 'text-red-500',
      iconBg: 'bg-red-100 dark:bg-red-500/15',
      button: 'bg-red-600 hover:bg-red-700 text-white',
    },
    warn: {
      icon: 'text-amber-500',
      iconBg: 'bg-amber-100 dark:bg-amber-500/15',
      button: 'bg-amber-500 hover:bg-amber-600 text-white',
    },
    neutral: {
      icon: 'text-slate-500',
      iconBg: 'bg-slate-100 dark:bg-slate-500/15',
      button: 'bg-slate-700 hover:bg-slate-800 text-white',
    },
  }[tone] || {};

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
         onClick={() => !busy && onCancel?.()}>
      <div className="bg-surface rounded-2xl border border-hairline-2 max-w-md w-full shadow-xl"
           onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="px-5 pt-5 pb-3 flex items-start gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${toneClasses.iconBg}`}>
            <AlertCircle size={20} className={toneClasses.icon} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-ink text-sm leading-snug">{title}</h3>
            <p className="text-xs text-muted mt-1.5 leading-relaxed">{message}</p>
          </div>
        </div>
        <div className="px-5 pb-5 pt-2 flex justify-end gap-2">
          <SecondaryButton onClick={onCancel} disabled={busy} size="sm">
            Huỷ
          </SecondaryButton>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`px-4 py-1.5 rounded-xl text-sm font-semibold transition-colors
              disabled:opacity-60 disabled:cursor-not-allowed ${toneClasses.button}`}>
            {busy ? 'Đang xử lý…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Phiếu lương TOÀN CÔNG TY — gộp 5 bộ phận, mỗi bộ phận là 1 nhóm có header
 * riêng + bảng {@link PayrollTables}. Trước đây các bảng này nằm rải trong
 * từng tab bộ phận; Phase 7 dồn lên trong CompanyPayrollPanel.
 *
 * Load song song 5 request. Nếu 1 bộ phận lỗi hoặc rỗng vẫn hiển thị các bộ
 * phận còn lại — không chặn toàn bảng.
 *
 * `statusKey` được dùng làm cache-buster (lệ thuộc vào CALCULATED/PUBLISHED).
 * Khi Public → Unpublic → Public lại, panel sẽ reload để đồng bộ cờ
 * `finalized` của mỗi dòng.
 */
// Thứ tự hiển thị bộ phận trong bảng gộp — FIX (10/2026): theo yêu cầu
// nghiệp vụ Kế toán → Kinh doanh → Xưởng sản xuất → Kho → Tài xế.
const COMPANY_DEPARTMENTS = [
  { key: 'ACCOUNTING', label: 'Kế toán' },
  { key: 'SALES',      label: 'Kinh doanh' },
  { key: 'FACTORY',    label: 'Xưởng sản xuất' },
  { key: 'WAREHOUSE',  label: 'Kho' },
  { key: 'DRIVER',     label: 'Tài xế' },
];

/**
 * Phiếu lương toàn công ty: GỘP 5 bộ phận thành 1 bảng duy nhất.
 *
 * FIX (10/2026, user request):
 *   - 1 header duy nhất "Phiếu lương Preview/Public · T.M/Y" ở trên.
 *   - 1 ô search duy nhất — áp cho cả 5 bộ phận.
 *   - Giữa các bộ phận chỉ có 1 header con là tên phòng + đếm số dòng.
 *   - KHÔNG lặp header "Phiếu lương — Xưởng · Tháng 9/2026" dưới mỗi bộ phận.
 *   - KHÔNG lặp ô search dưới mỗi bộ phận.
 *   - KHÔNG wrap thêm card (bỏ `rounded-2xl border` giữa các bộ phận → bớt
 *     rối, đọc liên mạch như 1 bảng dài).
 */
function CompanyPayrollSection({ month, year, statusKey }) {
  const [sections, setSections] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [query, setQuery]       = useState('');   // 1 ô tìm chung, áp cho cả 5 bộ phận

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all(
      COMPANY_DEPARTMENTS.map(async (d) => {
        try {
          const res = await factoryPayrollApi.departmentPayroll(month, year, d.key);
          return { dept: d.key, label: d.label, data: res?.data || res, error: null };
        } catch (e) {
          return { dept: d.key, label: d.label, data: null,
            error: e?.response?.data?.message || e.message || 'Không tải được' };
        }
      })
    ).then((results) => {
      if (!alive) return;
      setSections(results.filter(r => (r.data?.rows?.length || 0) > 0 || r.error));
      setLoading(false);
    });
    return () => { alive = false; };
  }, [month, year, statusKey]);

  // Số dòng tổng + số match để hiển thị feedback dưới ô search.
  // Khai báo TRƯỚC các early return để `q` dùng được cho useEffect bên dưới.
  const totalRows = sections.reduce((s, sec) => s + (sec.data?.rows?.length || 0), 0);
  const normalize = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const q = normalize(query);
  const totalMatches = q
    ? sections.reduce((s, sec) => s + (sec.data?.rows || [])
        .filter(r => normalize(r.userFullName).includes(q)).length, 0)
    : 0;

  const isPublished = statusKey === 'PUBLISHED';

  // ── TASK 1 (10/2026): tìm thấy → scroll đến nhân viên khớp ĐẦU TIÊN ──
  //
  // FIX (10/2026): PHẢI đặt useEffect TRƯỚC bất kỳ early return nào. Lượt
  // render đầu loading=true chỉ gọi 4 hooks → sang lượt load xong gọi 5 hooks
  // → React ném "Rendered more hooks than during the previous render" và
  // crash cả CompanyPayrollSection. Hook ở đây rẻ (early-exit khi !q) nên
  // đặt sớm không tốn gì.
  //
  // suppressScroll={true} truyền xuống PayrollTables → tắt effect scroll
  // nội bộ của chúng.
  //
  // Debounce 150ms vì user vẫn đang gõ — tránh scroll liên tục mỗi ký tự.
  useEffect(() => {
    if (!q) return;
    const t = setTimeout(() => {
      for (const sec of sections) {
        const match = (sec.data?.rows || [])
          .find(r => normalize(r.userFullName).includes(q));
        if (match) {
          const el = [
            document.getElementById(`payroll-card-${match.userId}`),
            document.getElementById(`payroll-row-${match.userId}`),
          ].find(e => e && e.offsetParent !== null);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
      }
    }, 150);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, sections]);

  // Early returns NẰM SAU mọi hook — đáp ứng Rules of Hooks.
  if (loading) {
    return (
      <div className="mt-4 py-8 flex justify-center">
        <LoadingSpinner />
      </div>
    );
  }
  if (sections.length === 0) {
    return (
      <div className="mt-4 py-6 text-center text-xs text-muted">
        Chưa có dữ liệu phiếu lương.
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-2xl border border-hairline-2 bg-canvas overflow-hidden">
      {/* ── HEADER CHUNG ──────────────────────────────────────────────── */}
      <div className="px-5 py-4 border-b border-hairline-2 bg-surface/60">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="font-bold text-sm text-ink">
              Phiếu lương{' '}
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase
                tracking-wider align-middle ${isPublished
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200'}`}>
                {isPublished ? 'Public' : 'Preview'}
              </span>{' '}
              · Tháng {String(month).padStart(2, '0')}/{year}
            </h3>
            <span className="text-[11px] text-muted font-semibold ml-1">
              · {totalRows} nhân viên
            </span>
          </div>

          {/* 1 ô tìm chung */}
          <div className="relative shrink-0 w-full sm:w-auto">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Tìm theo tên nhân viên..."
              className="w-full sm:w-64 pl-8 pr-8 py-2 rounded-xl border border-hairline-2 text-xs
                         focus:outline-none focus:border-gold transition-colors"
            />
            {query && (
              <button onClick={() => setQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md
                           text-faint hover:text-ink">
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {query && (
          <p className="text-[11px] text-muted mt-2">
            {totalMatches
              ? `Tìm thấy ${totalMatches} nhân viên khớp "${query}"`
              : `Không có nhân viên nào khớp "${query}"`}
          </p>
        )}
      </div>

      {/* ── DANH SÁCH BỘ PHẬN, ngăn cách chỉ bằng header con ──────────── */}
      {sections.map((sec, i) => (
        <div key={sec.dept}
             className={i > 0 ? 'border-t-4 border-hairline' : ''}>
          <div className="px-5 py-2.5 bg-canvas/80 border-b border-hairline flex items-center justify-between gap-3 sticky top-0 z-10">
            <h4 className="font-bold text-xs uppercase tracking-wider text-muted">
              {sec.label}
            </h4>
            <span className="text-[10px] text-faint font-semibold">
              {sec.data?.rows?.length ?? 0} nhân viên
            </span>
          </div>
          {sec.error ? (
            <div className="px-4 py-6 text-center text-xs text-red-600">
              Lỗi: {sec.error}
            </div>
          ) : (
            <PayrollTables
              data={sec.data}
              loading={false}
              preview={false}
              embedded
              externalQuery={query}
              hideHeader={i > 0}
              suppressScroll
            />
          )}
        </div>
      ))}
    </div>
  );
}

function OtStat({ label, minutes, multiplier }) {
  const hours = Math.floor((minutes || 0) / 60);
  const mins = (minutes || 0) % 60;
  return (
    <div className="rounded-xl bg-surface p-3 border border-hairline-2">
      <p className="text-[11px] text-muted font-bold uppercase tracking-wider">
        {label} <span className="text-gold">{multiplier}</span>
      </p>
      <p className="text-lg font-bold text-ink mt-1">
        {hours}<span className="text-sm font-normal text-muted">h </span>
        {mins > 0 && <>{mins}<span className="text-sm font-normal text-muted">p</span></>}
      </p>
      <p className="text-[10px] text-muted mt-0.5">{(minutes || 0).toLocaleString('vi-VN')} phút</p>
    </div>
  );
}