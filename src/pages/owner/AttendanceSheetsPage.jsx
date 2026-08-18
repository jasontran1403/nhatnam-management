// src/pages/owner/AttendanceSheetsPage.jsx
// BẢNG CHẤM CÔNG — OWNER quản lý dữ liệu lương theo THÁNG × BỘ PHẬN.
//
//   Bộ phận:  Xưởng sản xuất · Kinh doanh · Kho · Kế toán · Tài xế
//
//   Mỗi bộ phận (trừ Tài xế) có 3 loại file RIÊNG cho mỗi tháng:
//     1. Bảng chấm công (xuất từ máy chấm công)
//     2. Lịch nghỉ / đi trễ / về sớm
//     3. Đơn xin đi trễ / về sớm / nghỉ phép của cá nhân
//   Mỗi loại tối đa 1 file/tháng — đã có thì phải xoá rồi mới tải lại được.
//
//   Xử lý xong → bấm "HOÀN TẤT". Lúc đó nhân viên của bộ phận mới xem được
//   phiếu lương; chưa hoàn tất thì họ thấy "Đang xử lý lương".
//   Hoàn tất rồi vẫn xoá/đổi file được — cờ hoàn tất tự gỡ, bấm Hoàn tất lần
//   nữa sẽ tính lại theo file MỚI NHẤT.
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ClipboardCheck, Upload, RefreshCw, AlertCircle, CheckCircle2, Trash2,
  FileSpreadsheet, Calculator, Download, CalendarDays, ChevronDown, Gift, Wallet,
  CalendarClock, UserCheck, Clock, Lock, Unlock, Users, Receipt, Truck, Route, ShieldCheck,
  PiggyBank, Plus, X, Search, CornerDownRight, MapPin, User as UserIcon, Package, Eye,
} from 'lucide-react';
import { factoryPayrollApi } from '../../api/factoryPayrollApi';
import { BackButton } from '../../components/common/SubPageNav';
import {
  PageHeader, SectionCard, LoadingSpinner, SecondaryButton, PrimaryButton,
  Table, Thead, Th, Td, Tr, EmptyState, formatDateTime, formatCurrency,
} from '../../components/ui';
import Modal from '../../components/ui/Modal';
import AttendanceDayCalendar from '../../components/hr/AttendanceDayCalendar';
import { useToast } from '../../components/common/Toast';
import SalaryBreakdownCards from '../../components/hr/SalaryBreakdownCards';

const fmtNum = (v, d = 2) =>
  v == null ? '—' : Number(v).toLocaleString('vi-VN', { maximumFractionDigits: d });

// ══════════════════════════════════════════════════════════════════════════════
// CHỌN THÁNG — tháng hiện tại + quá khứ, KHÔNG có tương lai
// ══════════════════════════════════════════════════════════════════════════════

function MonthPicker({ periods, value, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const current = periods.find(p => p.month === value?.month && p.year === value?.year);

  const grouped = periods.reduce((acc, p) => {
    (acc[p.year] ||= []).push(p);
    return acc;
  }, {});

  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)} disabled={disabled || !periods.length}
        className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-surface border border-hairline-2
          shadow-sm hover:border-gold/50 transition-colors disabled:opacity-50 min-w-[190px]">
        <CalendarDays size={16} className="text-gold shrink-0" />
        <span className="flex-1 text-left text-sm font-bold text-ink">
          {current?.label || 'Chọn tháng'}
        </span>
        <ChevronDown size={15} className={`text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute z-30 mt-2 w-full min-w-[220px] max-h-[360px] overflow-y-auto
            bg-surface rounded-2xl border border-hairline-2 shadow-xl p-2">
            {Object.entries(grouped).sort((a, b) => b[0] - a[0]).map(([year, items]) => (
              <div key={year} className="mb-1 last:mb-0">
                <p className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">
                  Năm {year}
                </p>
                {items.map(p => {
                  const active = p.month === value?.month && p.year === value?.year;
                  return (
                    <button key={`${p.year}-${p.month}`}
                      onClick={() => { onChange(p); setOpen(false); }}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl
                        text-sm transition-colors
                        ${active ? 'bg-gold text-white font-bold' : 'text-ink hover:bg-canvas'}`}>
                      <span>Tháng {p.month}</span>
                      {p.finalized && (
                        <CheckCircle2 size={13} className={active ? 'text-white' : 'text-emerald-500'} />
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB BỘ PHẬN
// ══════════════════════════════════════════════════════════════════════════════

// Gõ tiền kiểu Việt Nam: chỉ giữ chữ số, chèn dấu chấm ngăn cách hàng nghìn.
// Giữ ở dạng chuỗi trong state để người dùng xoá trắng được (số 0 sẽ dính lại).
const formatVnInt = (v) => {
  const d = String(v ?? '').replace(/[^\d]/g, '');
  return d ? Number(d).toLocaleString('vi-VN') : '';
};

/**
 * MODAL "CHI TIẾT BỘ PHẬN" — ai đang thuộc bộ phận này ngay lúc mở.
 *
 * Không gắn với kỳ lương nào: dùng để đối chiếu nhân sự TRƯỚC khi tải bảng chấm
 * công lên, nên phải phản ánh hiện trạng chứ không phải ảnh chụp của tháng.
 */
function DepartmentMembersModal({ open, department, departmentLabel, onClose }) {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !department) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const d = await factoryPayrollApi.departmentMembers(department);
        if (alive) setData(d);
      } catch (e) {
        if (alive) toast(e?.response?.data?.message || 'Không tải được danh sách nhân sự', 'error');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    // Cờ alive chặn setState sau khi modal đã đóng — đổi bộ phận liên tục sẽ
    // khiến response cũ về sau response mới và ghi đè danh sách đúng.
    return () => { alive = false; };
  }, [open, department, toast]);

  const members = data?.members ?? [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={`Chi tiết bộ phận — ${departmentLabel || ''}`}
    >
      {loading ? (
        <LoadingSpinner label="Đang tải danh sách…" />
      ) : members.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Bộ phận chưa có nhân viên"
          description="Gán bộ phận cho nhân viên ở trang Nhân sự để họ xuất hiện tại đây."
        />
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted">{data.total} nhân viên</p>
          <Table>
            <Thead>
              <Tr className="bg-canvas text-muted">
                <Th>Nhân viên</Th>
                <Th>Chức vụ</Th>
                <Th>Chức danh trả lương</Th>
              </Tr>
            </Thead>
            <tbody>
              {members.map(m => (
                <Tr key={m.userId}>
                  <Td>
                    <div className="font-medium text-ink">{m.fullName}</div>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {!m.hasSalary && (
                        <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10
                          border border-amber-200 dark:border-amber-500/28 rounded px-1.5 py-0.5">
                          chưa có hồ sơ lương
                        </span>
                      )}
                      {m.attendanceExempt && (
                        <span className="text-[10px] font-semibold text-muted bg-canvas
                          border border-hairline-2 rounded px-1.5 py-0.5">
                          không chấm công
                        </span>
                      )}
                    </div>
                  </Td>
                  <Td className="text-ink">
                    {m.position || <span className="text-faint">—</span>}
                    {m.division && (
                      <div className="text-[11px] text-muted">{m.division}</div>
                    )}
                  </Td>
                  {/* Lệch với cột Chức vụ nghĩa là người này đang được tính lương
                      ở bộ phận khác với hồ sơ — đáng để OWNER để ý. */}
                  <Td className="text-muted">{m.roleLabel || '—'}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </Modal>
  );
}

function DepartmentTabs({ statuses, value, onChange }) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
      {statuses.map(s => {
        const active = s.department === value;
        return (
          <button key={s.department} onClick={() => onChange(s.department)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold
              whitespace-nowrap border transition-colors shrink-0
              ${active
                ? 'bg-chrome text-white border-chrome'
                : 'bg-surface text-ink border-hairline-2 hover:border-gold/50'}`}>
            {(() => {
              // Bộ phận Quản lý (OWNER/ADMIN) và Tài xế có biểu tượng riêng để
              // phân biệt nhanh với các bộ phận nhân viên thông thường.
              const Icon = s.department === 'DRIVER' ? Truck
                : s.department === 'MANAGEMENT' ? ShieldCheck
                : Users;
              return <Icon size={14} className={active ? 'text-gold' : 'text-muted'} />;
            })()}
            <span>{s.departmentLabel}</span>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md
              ${active ? 'bg-white/15 text-white/80' : 'bg-canvas text-muted'}`}>
              {s.employeeCount ?? 0}
            </span>
            {s.finalized && (
              <CheckCircle2 size={13} className={active ? 'text-emerald-400' : 'text-emerald-500'} />
            )}
          </button>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// KHỐI 1 LOẠI FILE
// ══════════════════════════════════════════════════════════════════════════════

function FileSlot({ icon: Icon, title, description, hint,
                    exists, fileName, uploadedAt, rowCount, rowLabel,
                    onUpload, onDelete, onTemplate, uploading, deleting }) {
  const fileRef = useRef(null);

  return (
    <div className={`rounded-2xl border overflow-hidden transition-colors
      ${exists ? 'border-emerald-200 dark:border-emerald-500/28 bg-emerald-50/30 dark:bg-emerald-500/4' : 'border-hairline-2 bg-surface'}`}>

      <div className="flex items-start gap-3 px-4 py-3.5 border-b border-hairline">
        <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0
          ${exists ? 'bg-emerald-100 dark:bg-emerald-500/18' : 'bg-canvas'}`}>
          <Icon size={16} className={exists ? 'text-emerald-600 dark:text-emerald-300' : 'text-muted'} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-ink leading-tight">{title}</p>
          <p className="text-[11px] text-muted mt-0.5 leading-snug">{description}</p>
        </div>
        {exists && (
          <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg
            bg-emerald-100 dark:bg-emerald-500/18 text-emerald-700 dark:text-emerald-300 shrink-0">
            <CheckCircle2 size={11} /> Đã có
          </span>
        )}
      </div>

      {exists && (
        <div className="px-4 py-2.5 bg-surface/60 border-b border-hairline">
          <p className="text-[11px] text-ink-2 truncate" title={fileName}>{fileName || '—'}</p>
          <p className="text-[10px] text-muted mt-0.5">
            {uploadedAt ? formatDateTime(uploadedAt) : '—'}
            {rowCount != null && ` · ${rowCount} ${rowLabel}`}
          </p>
        </div>
      )}

      <div className="px-4 py-3 space-y-2">
        {hint && !exists && <p className="text-[10px] text-muted leading-snug">{hint}</p>}

        <div className="flex gap-2">
          {onTemplate && (
            <button onClick={onTemplate}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[11px]
                font-semibold bg-surface border border-hairline-2 text-ink
                hover:bg-canvas transition-colors shrink-0">
              <Download size={12} /> Tải mẫu
            </button>
          )}

          {!exists ? (
            <label className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl
              text-[11px] font-bold text-white transition-colors
              ${uploading ? 'bg-faint cursor-wait' : 'bg-gold hover:bg-gold-deep cursor-pointer'}`}>
              {uploading ? (
                <>
                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Đang xử lý
                </>
              ) : (
                <><Upload size={12} /> Tải file lên</>
              )}
              <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" disabled={uploading}
                onChange={e => { if (e.target.files[0]) { onUpload(e.target.files[0]); e.target.value = ''; } }} />
            </label>
          ) : (
            <button onClick={onDelete} disabled={deleting}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl
                text-[11px] font-bold bg-surface border border-red-200 dark:border-red-500/28 text-red-600 dark:text-red-300
                hover:bg-red-50 dark:bg-red-500/10 transition-colors disabled:opacity-50">
              <Trash2 size={12} />
              {deleting ? 'Đang xoá...' : 'Xoá file cũ, tải lại'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// BÁO CÁO KẾT QUẢ IMPORT — file có bao nhiêu NV, thiếu của ai
// ══════════════════════════════════════════════════════════════════════════════

function ImportResultModal({ result, title, onClose }) {
  const [tab, setTab] = useState('unmatched');
  if (!result) return null;

  const matched = result.matchedRows || [];
  const unmatched = result.unmatchedRows || [];
  const unused = result.unusedBlocks || [];
  const MATCH_LABEL = { CODE: 'mã chấm công', EXACT_NAME: 'họ tên' };

  const tabs = [
    { id: 'unmatched', label: `Thiếu (${unmatched.length})`, show: true },
    { id: 'matched', label: `Đã khớp (${matched.length})`, show: matched.length > 0 },
    { id: 'unused', label: `Không dùng (${unused.length})`, show: unused.length > 0 },
  ].filter(t => t.show);

  return (
    <Modal open onClose={onClose} title={title} size="md">
      <div className="space-y-3 py-1">
        {/* Tóm tắt: file có bao nhiêu người / khớp / thiếu */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'NV trong file', value: result.blocksInFile ?? 0, color: 'text-ink' },
            { label: 'NV bộ phận', value: result.departmentEmployees ?? 0, color: 'text-ink' },
            { label: 'Đã khớp', value: result.matched ?? 0, color: 'text-emerald-600 dark:text-emerald-300' },
            { label: 'Thiếu', value: result.skipped ?? 0, color: 'text-amber-600 dark:text-amber-300' },
          ].map(s => (
            <div key={s.label} className="bg-canvas rounded-xl px-2 py-2.5 text-center">
              <p className="text-[10px] text-muted font-semibold leading-tight">{s.label}</p>
              <p className={`text-xl font-bold mt-0.5 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {result.departmentLabel && (
          <p className="text-[11px] text-muted">
            Bộ phận: <strong className="text-ink">{result.departmentLabel}</strong>
            {' · '}Tháng {result.month}/{result.year}
          </p>
        )}

        {result.skipped > 0 && (
          <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/28 rounded-xl px-3 py-2.5">
            <AlertCircle size={14} className="text-amber-600 dark:text-amber-300 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-snug">
              File thiếu dữ liệu của <strong>{result.skipped} nhân viên</strong> —
              xem danh sách ở tab "Thiếu". Những người này sẽ được ghi nhận 0 công cho tháng.
            </p>
          </div>
        )}

        {tabs.length > 1 && (
          <div className="flex gap-1 bg-canvas rounded-xl p-1">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold transition-colors
                  ${tab === t.id ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'}`}>
                {t.label}
              </button>
            ))}
          </div>
        )}

        <div className="max-h-52 overflow-y-auto rounded-xl border border-hairline divide-y divide-hairline">
          {tab === 'matched' && (matched.length === 0
            ? <p className="text-[11px] text-muted text-center py-6">Không có dữ liệu</p>
            : matched.map((r, i) => (
              <div key={r.userId ?? i} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-ink truncate">{r.fullName}</p>
                  <p className="text-[10px] text-muted truncate">
                    {r.roleLabel || '—'}
                    {r.employeeCode ? ` · mã ${r.employeeCode}` : ''}
                    {r.matchedBy ? ` · khớp theo ${MATCH_LABEL[r.matchedBy] || r.matchedBy}` : ''}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-bold text-emerald-600 dark:text-emerald-300">{r.actualDays ?? 0} công</p>
                  <p className="text-[10px] text-muted">{r.presentDays ?? 0} ngày chấm</p>
                </div>
              </div>
            )))}

          {tab === 'unmatched' && (unmatched.length === 0
            ? <p className="text-[11px] text-emerald-700 dark:text-emerald-300 text-center py-6">
                Không có ai bị bỏ sót — file đủ toàn bộ nhân viên của bộ phận.
              </p>
            : unmatched.map((r, i) => (
              <div key={r.userId ?? i} className="px-3 py-2.5">
                <p className="text-xs font-semibold text-ink">{r.fullName}</p>
                <p className="text-[10px] text-muted">
                  {r.roleLabel || 'Không tìm thấy trong hệ thống'}
                </p>
              </div>
            )))}

          {tab === 'unused' && unused.map((u, i) => (
            <p key={i} className="px-3 py-2 text-[11px] text-ink-2">{u}</p>
          ))}
        </div>

        {result.errors?.length > 0 && (
          <details className="bg-canvas rounded-xl px-3 py-2.5">
            <summary className="text-[11px] font-semibold text-muted cursor-pointer">
              {result.errors.length} cảnh báo khi đọc file
            </summary>
            <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
              {result.errors.map((e, i) => (
                <p key={i} className="text-[10px] text-amber-700 dark:text-amber-300 leading-snug">{e}</p>
              ))}
            </div>
          </details>
        )}
      </div>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// KẾT QUẢ IMPORT THƯỞNG / PHỤ CẤP
// ══════════════════════════════════════════════════════════════════════════════
//
// Modal riêng, KHÔNG dùng chung ImportResultModal của bảng chấm công vì kết quả
// ở đó theo cấu trúc khớp/không khớp từng người, còn ở đây là lỗi theo DÒNG.

function AdjustmentResultModal({ result, title, onClose }) {
  if (!result) return null;

  const savedItems = result.savedItems || [];
  const unmatched = result.unmatchedItems || [];
  const errors = result.errors || [];
  const warnings = result.warnings || [];

  const savedTotal = savedItems.reduce((s, i) => s + (i.amount || 0), 0);
  const newItems = savedItems.filter(i => !i.alreadyExisted);
  const existedItems = savedItems.filter(i => i.alreadyExisted);

  return (
    <Modal open onClose={onClose} title={title} size="lg">
      <div className="space-y-4 py-1">
        {/* Tóm tắt */}
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/28 px-3 py-2.5">
            <p className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-300 tracking-wider">Đã lưu</p>
            <p className="text-sm font-bold text-ink mt-0.5">{result.saved ?? 0} khoản</p>
            {result.totalAmount > 0 && <p className="text-[10px] text-muted">{formatCurrency(result.totalAmount)}</p>}
          </div>
          {existedItems.length > 0 && (
            <div className="rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/28 px-3 py-2.5">
              <p className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-300 tracking-wider">Đã có sẵn</p>
              <p className="text-sm font-bold text-ink mt-0.5">{existedItems.length} người</p>
              <p className="text-[10px] text-muted">bỏ qua, giữ số cũ</p>
            </div>
          )}
          {unmatched.length > 0 && (
            <div className="rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/28 px-3 py-2.5">
              <p className="text-[10px] uppercase font-bold text-red-700 dark:text-red-300 tracking-wider">Không tìm thấy</p>
              <p className="text-sm font-bold text-ink mt-0.5">{unmatched.length} dòng</p>
              <p className="text-[10px] text-muted">import nhầm file / sai tên</p>
            </div>
          )}
        </div>

        {/* PHẦN 1: Danh sách đã xử lý */}
        {savedItems.length > 0 && (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300 mb-1.5">
              Nhân viên đã xử lý ({savedItems.length}) · Tổng {formatCurrency(savedTotal)}
            </p>
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/28 overflow-hidden max-h-64 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-emerald-50 dark:bg-emerald-500/10 sticky top-0">
                  <tr className="text-left text-emerald-700 dark:text-emerald-300">
                    <th className="px-3 py-1.5 font-semibold">Nhân viên</th>
                    <th className="px-3 py-1.5 font-semibold">Khoản</th>
                    <th className="px-3 py-1.5 font-semibold text-right">Số tiền</th>
                    <th className="px-3 py-1.5 font-semibold text-center">Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {savedItems.map((it, i) => (
                    <tr key={i} className="border-t border-emerald-100 dark:border-emerald-500/20">
                      <td className="px-3 py-1.5 font-medium text-ink">{it.employeeName || `#${it.userId}`}</td>
                      <td className="px-3 py-1.5 text-ink">{it.label || '—'}</td>
                      <td className="px-3 py-1.5 text-right font-semibold text-gold">{formatCurrency(it.amount)}</td>
                      <td className="px-3 py-1.5 text-center text-[10px]">
                        {it.alreadyExisted
                          ? <span className="text-amber-600 dark:text-amber-300">Đã có, giữ nguyên</span>
                          : <span className="text-emerald-600 dark:text-emerald-300">Thêm mới</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* PHẦN 2: Không tìm thấy — thường do import nhầm file khác bộ phận */}
        {unmatched.length > 0 && (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-red-600 dark:text-red-300 mb-1.5">
              Không tìm thấy nhân viên ({unmatched.length})
            </p>
            <p className="text-[10px] text-muted mb-1.5">
              Các dòng dưới đây không khớp được nhân viên nào trong bộ phận. Kiểm tra
              xem có phải import nhầm file của bộ phận khác không, hoặc tên bị gõ sai.
            </p>
            <div className="rounded-xl border border-red-200 dark:border-red-500/28 overflow-hidden max-h-56 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-red-50 dark:bg-red-500/10 sticky top-0">
                  <tr className="text-left text-red-700 dark:text-red-300">
                    <th className="px-3 py-1.5 font-semibold">Dòng</th>
                    <th className="px-3 py-1.5 font-semibold">Tên trong file</th>
                    <th className="px-3 py-1.5 font-semibold">Khoản / lý do</th>
                    <th className="px-3 py-1.5 font-semibold text-right">Số tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {unmatched.map((it, i) => (
                    <tr key={i} className="border-t border-red-100 dark:border-red-500/20">
                      <td className="px-3 py-1.5 text-muted">{it.rowNumber}</td>
                      <td className="px-3 py-1.5 font-medium text-ink">
                        {it.rawName || <span className="italic text-muted">(trống)</span>}
                        {it.rawIdString && <span className="text-[10px] text-muted ml-1">ID: {it.rawIdString}</span>}
                      </td>
                      <td className="px-3 py-1.5 text-[11px]">
                        {it.label && <div className="text-ink">{it.label}</div>}
                        <div className="text-red-600 dark:text-red-300 text-[10px]">{it.reason}</div>
                      </td>
                      <td className="px-3 py-1.5 text-right text-ink">
                        {it.amount != null ? formatCurrency(it.amount) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Cảnh báo/lỗi khác (VD nhãn phụ cấp không có trong danh mục) */}
        {errors.length > 0 && (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-red-600 dark:text-red-300 mb-1.5">
              Lỗi khác ({errors.length})
            </p>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {errors.map((e, i) => (
                <p key={i} className="text-[11px] text-red-800 dark:text-red-300 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/28
                  rounded-lg px-3 py-2 leading-snug">{e}</p>
              ))}
            </div>
          </div>
        )}

        {warnings.length > 0 && (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-300 mb-1.5">
              Cảnh báo ({warnings.length})
            </p>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {warnings.map((w, i) => (
                <p key={i} className="text-[11px] text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/28
                  rounded-lg px-3 py-2 leading-snug">{w}</p>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// THẺ IMPORT THƯỞNG / PHỤ CẤP THEO THÁNG
// ══════════════════════════════════════════════════════════════════════════════
//
// Khác FileSlot ở chỗ KHÔNG lưu file gốc — dữ liệu được đọc thẳng vào bảng
// monthly_adjustment. Vì vậy chỉ hiện SỐ DÒNG đã import, và nút "Xoá" là xoá dữ
// liệu của kỳ chứ không phải xoá file.

function AdjustmentSlot({ icon: Icon, title, description, hint, count, rowLabel,
                          onUpload, onClear, onTemplate, uploading, clearing,
                          batches, onDeleteBatch, deletingLabel, onPreview }) {
  const fileRef = useRef(null);
  const has = (count ?? 0) > 0;
  const isBonus = Array.isArray(batches);

  return (
    <div className={`rounded-2xl border overflow-hidden transition-colors
      ${has ? 'border-emerald-200 dark:border-emerald-500/28 bg-emerald-50/30 dark:bg-emerald-500/4' : 'border-hairline-2 bg-surface'}`}>

      <div className="flex items-start gap-3 px-4 py-3.5 border-b border-hairline">
        <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0
          ${has ? 'bg-emerald-100 dark:bg-emerald-500/18' : 'bg-canvas'}`}>
          <Icon size={16} className={has ? 'text-emerald-600 dark:text-emerald-300' : 'text-muted'} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-ink leading-tight">{title}</p>
          <p className="text-[11px] text-muted mt-0.5 leading-snug">{description}</p>
        </div>
        {has && (
          <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg
            bg-emerald-100 dark:bg-emerald-500/18 text-emerald-700 dark:text-emerald-300 shrink-0">
            <CheckCircle2 size={11} /> {count} {rowLabel}
          </span>
        )}
      </div>

      <div className="px-4 py-3.5 space-y-3">
        <p className="text-[11px] text-muted leading-relaxed">{hint}</p>

        {/* Liệt kê TỪNG KHOẢN đã tải lên (BONUS). Mỗi khoản có nút Xem + Xoá. */}
        {isBonus && batches.length > 0 && (
          <div className="space-y-1.5">
            {batches.map(b => (
              <div key={b.label}
                className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-surface border border-hairline-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-ink truncate">{b.label}</p>
                  <p className="text-[10px] text-muted">
                    {b.employeeCount} người · {formatCurrency(b.totalAmount)}
                  </p>
                </div>
                {onPreview && (
                  <button
                    onClick={() => onPreview('BONUS', b.label)}
                    title={`Xem lại nội dung khoản "${b.label}"`}
                    className="p-1.5 rounded-lg text-muted hover:text-gold hover:bg-canvas transition-colors shrink-0">
                    <Eye size={13} />
                  </button>
                )}
                {onDeleteBatch && (
                  <button
                    onClick={() => onDeleteBatch(b.label)}
                    disabled={deletingLabel === b.label}
                    title={`Xoá khoản "${b.label}"`}
                    className="p-1.5 rounded-lg text-muted hover:text-red-600 dark:text-red-300 hover:bg-red-50 dark:bg-red-500/10
                      transition-colors shrink-0 disabled:opacity-50">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Phụ cấp: nút Xem toàn khối (không có batch riêng). */}
        {!isBonus && has && onPreview && (
          <button type="button" onClick={() => onPreview('ALLOWANCE')}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-hairline-2
              bg-surface hover:bg-canvas text-ink text-[11px] font-semibold transition-colors">
            <Eye size={13} /> Xem lại nội dung đã import
          </button>
        )}

        <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
          onChange={e => {
            const f = e.target.files?.[0];
            // Reset value để chọn LẠI CÙNG một file vẫn kích hoạt onChange
            e.target.value = '';
            if (f) onUpload(f);
          }} />

        <div className="flex items-center gap-2">
          <SecondaryButton onClick={onTemplate} className="shrink-0">
            <Download size={14} /> Tải mẫu
          </SecondaryButton>
          <PrimaryButton onClick={() => fileRef.current?.click()}
            disabled={uploading} className="flex-1 justify-center">
            <Upload size={14} /> {uploading ? 'Đang tải lên...' : 'Tải file lên'}
          </PrimaryButton>
        </div>

        {has && (
          <button type="button" onClick={onClear} disabled={clearing}
            className="w-full flex items-center justify-center gap-1.5 text-[11px] font-semibold
              text-red-500 hover:text-red-600 dark:text-red-300 py-1.5 rounded-lg hover:bg-red-50 dark:bg-red-500/10
              transition-colors disabled:opacity-50">
            <Trash2 size={13} /> {clearing ? 'Đang xoá...' : 'Xoá dữ liệu đã import'}
          </button>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TỔNG HỢP QUỸ THƯỞNG KPI — hiện sau khi đã tính
// ══════════════════════════════════════════════════════════════════════════════

function KpiSummary({ kpi }) {
  if (!kpi) return null;

  const pool = kpi.bonusPool ?? 0;
  const carryIn = kpi.carryOverIn ?? 0;
  const distributed = (kpi.distributedTotal ?? 0) + (kpi.securityTotal ?? 0);
  const remaining = kpi.carryOverOut ?? 0;
  const detail = kpi.carryOverInDetail || [];

  const cards = [
    { label: 'Tổng sản lượng tháng', value: `${fmtNum(kpi.totalOutputKg)} kg`,
      sub: `${fmtNum(kpi.totalOutputTon, 4)} tấn` },
    { label: 'Đơn giá thưởng', value: `${formatCurrency(kpi.ratePerTon)}`, sub: 'mỗi tấn' },
    { label: 'Tổng bonus tháng', value: formatCurrency(pool), gold: true,
      sub: 'sản lượng × đơn giá' },
    { label: 'Quỹ dư các tháng trước', value: formatCurrency(carryIn),
      sub: detail.length ? detail.map(c => `${formatCurrency(c.amount)} · ${c.label}`).join(' — ') : 'không có' },
    { label: 'Đã chia cho nhân viên', value: formatCurrency(distributed),
      sub: 'gồm cả thưởng cố định của bảo vệ' },
    { label: 'Còn lại chưa chia', value: formatCurrency(remaining), gold: true,
      sub: 'chuyển sang quỹ tháng sau' },
  ];

  return (
    <SectionCard>
      <div className="flex items-center gap-2 px-5 py-4 border-b border-hairline">
        <Calculator size={16} className="text-gold" />
        <h3 className="text-sm font-bold text-ink">Quỹ thưởng KPI sản xuất</h3>
      </div>
      <div className="p-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(c => (
          <div key={c.label}
            className={`rounded-xl px-4 py-3 border
              ${c.gold ? 'bg-gold/10 border-gold/25' : 'bg-canvas border-transparent'}`}>
            <p className="text-[11px] text-muted font-medium">{c.label}</p>
            <p className={`text-lg font-bold mt-0.5 leading-tight
              ${c.gold ? 'text-gold' : 'text-ink'}`}>{c.value}</p>
            {c.sub && <p className="text-[10px] text-muted mt-1 leading-snug">{c.sub}</p>}
          </div>
        ))}
      </div>
    </SectionCard>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// QUỸ DƯ KHAI BÁO TAY
// ══════════════════════════════════════════════════════════════════════════════
//
// Quỹ thưởng chia không hết thì phần lẻ tự chuyển sang tháng sau — nhưng cơ chế
// đó chỉ chạy khi CẢ HAI tháng đều được tính trong app.
//
// Lúc mới đưa app vào dùng: tháng trước phòng sản xuất đã chia tay và còn dư,
// tháng đó không hề có trong hệ thống ⇒ không có sổ dư nào để kế thừa ⇒ tiền dư
// biến mất. Panel này là chỗ khai báo tay khoản đó.
//
// Cố ý KHÔNG tự gọi recompute sau khi thêm/xoá: người nhập thường thêm vài dòng
// liên tiếp, recompute mỗi lần vừa chậm vừa dễ ghi đè số đang xem. Nút "Tính lại
// thưởng KPI" ở dưới trang mới là chỗ áp dụng.

function CarryOverSeedPanel({ month, year, periodLabel, onChanged }) {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  // Mặc định nguồn = tháng liền trước tháng đang xem (trường hợp phổ biến nhất)
  const prev = month === 1 ? { m: 12, y: year - 1 } : { m: month - 1, y: year };
  const [form, setForm] = useState({
    sourceMonth: prev.m, sourceYear: prev.y, amount: '', note: '',
  });

  const load = useCallback(async () => {
    if (!month || !year) return;
    setLoading(true);
    try {
      const list = await factoryPayrollApi.carryOverSeeds(month, year);
      setRows(Array.isArray(list) ? list : []);
    } catch (e) {
      toast(e?.response?.data?.message || 'Không tải được quỹ dư khai báo tay', 'error');
    } finally { setLoading(false); }
  }, [month, year, toast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const p = month === 1 ? { m: 12, y: year - 1 } : { m: month - 1, y: year };
    setForm(f => ({ ...f, sourceMonth: p.m, sourceYear: p.y }));
  }, [month, year]);

  const total = rows.reduce((s, r) => s + (r.amount || 0), 0);

  const submit = async () => {
    const amt = Number(String(form.amount).replace(/[^\d]/g, ''));
    if (!amt || amt <= 0) return toast('Nhập số tiền dư lớn hơn 0', 'error');

    setSaving(true);
    try {
      await factoryPayrollApi.addCarryOverSeed({
        applyMonth: month, applyYear: year,
        sourceMonth: Number(form.sourceMonth), sourceYear: Number(form.sourceYear),
        amount: amt, note: form.note?.trim() || null,
      });
      toast('Đã lưu. Bấm "Tính lại thưởng KPI" để cộng vào quỹ.', 'success');
      setForm(f => ({ ...f, amount: '', note: '' }));
      setAdding(false);
      await load();
      onChanged?.();
    } catch (e) {
      toast(e?.response?.data?.message || 'Không lưu được', 'error');
    } finally { setSaving(false); }
  };

  const remove = async (row) => {
    try {
      await factoryPayrollApi.deleteCarryOverSeed(row.id);
      toast('Đã xoá. Bấm "Tính lại thưởng KPI" để cập nhật quỹ.', 'success');
      await load();
      onChanged?.();
    } catch (e) {
      toast(e?.response?.data?.message || 'Không xoá được', 'error');
    }
  };

  return (
    <SectionCard>
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-hairline">
        <div className="flex items-center gap-2 min-w-0">
          <PiggyBank size={16} className="text-gold shrink-0" />
          <h3 className="text-sm font-bold text-ink truncate">
            Quỹ dư khai báo tay {periodLabel ? `— ${periodLabel}` : ''}
          </h3>
        </div>

        <button
          type="button"
          onClick={() => setAdding(v => !v)}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-hairline-2
                     text-xs font-semibold text-ink hover:border-gold/50 hover:text-gold transition"
        >
          {adding ? <><X size={14} /> Đóng</> : <><Plus size={14} /> Thêm khoản dư</>}
        </button>
      </div>

      <div className="p-5 space-y-4">
        <p className="text-xs text-muted leading-relaxed">
          Dùng khi tháng trước đã chia thưởng <b>ngoài app</b> và còn dư — hệ thống
          không có bản ghi nào của tháng đó để kế thừa quỹ dư. Khoản khai báo ở đây
          sẽ được cộng vào quỹ chia của kỳ đang chọn.
          {' '}<b className="text-ink">Chỉ khai báo cho một tháng duy nhất</b>;
          phần chưa tiêu hết sẽ tự chuyển tiếp cho các tháng sau như bình thường.
        </p>

        {adding && (
          <div className="rounded-2xl border border-gold/30 bg-gold-tint p-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="block text-[11px] font-semibold text-muted mb-1">
                  Tháng phát sinh
                </label>
                <div className="flex gap-2">
                  <input type="number" min={1} max={12} value={form.sourceMonth}
                    onChange={e => setForm(f => ({ ...f, sourceMonth: e.target.value }))}
                    className="w-16 px-2.5 py-2 rounded-xl border border-hairline-2 text-sm
                               focus:outline-none focus:border-gold" />
                  <input type="number" value={form.sourceYear}
                    onChange={e => setForm(f => ({ ...f, sourceYear: e.target.value }))}
                    className="w-24 px-2.5 py-2 rounded-xl border border-hairline-2 text-sm
                               focus:outline-none focus:border-gold" />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-muted mb-1">
                  Số tiền dư (VNĐ)
                </label>
                <input type="text" inputMode="numeric" value={form.amount}
                  placeholder="VD 513000"
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-hairline-2 text-sm
                             focus:outline-none focus:border-gold" />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-muted mb-1">
                  Ghi chú
                </label>
                <input type="text" value={form.note}
                  placeholder="Chốt tay theo phiếu thưởng"
                  onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-hairline-2 text-sm
                             focus:outline-none focus:border-gold" />
              </div>
            </div>

            <button onClick={submit} disabled={saving}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gold text-white text-sm
                         font-semibold hover:bg-gold-strong transition disabled:opacity-50">
              {saving ? 'Đang lưu...' : 'Lưu khoản dư'}
            </button>
          </div>
        )}

        {loading ? (
          <LoadingSpinner label="Đang tải..." />
        ) : !rows.length ? (
          <p className="text-xs text-faint py-2">
            Chưa khai báo khoản dư nào cho kỳ này.
          </p>
        ) : (
          <div className="space-y-2">
            {rows.map(r => (
              <div key={r.id}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-canvas border border-hairline">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-ink">
                    {formatCurrency(r.amount)}
                    <span className="text-xs font-medium text-muted"> · nguồn {r.sourceLabel}</span>
                  </p>
                  <p className="text-[11px] text-muted mt-0.5 truncate">
                    {r.note || 'Không có ghi chú'}
                    {r.createdBy ? ` — ${r.createdBy}` : ''}
                  </p>
                </div>
                <button onClick={() => remove(r)} title="Xoá khoản này"
                  className="shrink-0 p-2 rounded-lg text-faint hover:text-red-500 hover:bg-red-50 dark:bg-red-500/10 transition">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}

            <div className="flex justify-between items-center px-4 pt-2">
              <span className="text-xs font-semibold text-muted">Tổng khai báo tay</span>
              <span className="text-sm font-bold text-gold">{formatCurrency(total)}</span>
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MODAL "CHI TIẾT NGÀY CÔNG" CỦA 1 NHÂN VIÊN
// ══════════════════════════════════════════════════════════════════════════════
//
// Trước đây trang này có hẳn một BẢNG chi tiết ngày công liệt kê mọi nhân viên —
// chỉ xem được số tổng (công chuẩn / công thực tế / đi trễ / về sớm), không xem
// được từng ngày. Nay bảng đó được bỏ, thay bằng nút mở modal ở từng dòng Phiếu
// lương, dùng CHUNG lịch chấm công với trang "Quản lý lương" của nhân viên.

function EmployeeAttendanceModal({ employee, month, year, periodLabel, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!employee) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      setData(null);
      try {
        // factoryPayrollApi đã bóc sẵn ApiResponse → trả thẳng AttendanceSummaryDto
        const res = await factoryPayrollApi.employeeAttendance(employee.userId, month, year);
        if (!cancelled) setData(res || null);
      } catch (e) {
        if (!cancelled) setError(e?.response?.data?.message || e.message || 'Không tải được dữ liệu');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    // Đổi nhân viên / đóng modal khi request đang bay → bỏ qua kết quả cũ để
    // không ghi đè dữ liệu của người vừa chọn.
    return () => { cancelled = true; };
  }, [employee, month, year]);

  return (
    <Modal
      open={!!employee}
      onClose={onClose}
      size="2xl"
      title={`Chi tiết ngày công — ${employee?.userFullName || ''} · ${periodLabel || ''}`}
    >
      {loading && <LoadingSpinner label="Đang tải chi tiết ngày công..." />}

      {!loading && error && (
        <div className="flex items-start gap-2 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/28 rounded-xl px-4 py-3 m-1">
          <AlertCircle size={15} className="text-red-600 dark:text-red-300 shrink-0 mt-0.5" />
          <p className="text-xs text-red-800 dark:text-red-300 leading-relaxed">{error}</p>
        </div>
      )}

      {!loading && !error && (
        <AttendanceDayCalendar
          attendance={data}
          month={month}
          year={year}
          showHeader={false}
        />
      )}
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 2 BẢNG SAU KHI HOÀN TẤT — Phiếu lương & Chi tiết ngày công
// ══════════════════════════════════════════════════════════════════════════════

/**
 * DẢI SỐ LIỆU TỔNG QUAN trên đầu bảng Phiếu lương.
 *
 * Ba trạng thái, quyết định bằng cờ từ server chứ không suy từ số liệu — quỹ
 * thưởng bằng 0 là hợp lệ và khác hẳn với "chưa tính":
 *   · Bộ phận có KPI + ĐÃ tính  → đủ 6 ô: sản lượng, đơn giá, quỹ thưởng,
 *                                 quỹ dư đợt trước, tổng NET, tổng KPI
 *   · Bộ phận có KPI + CHƯA tính → chỉ tổng NET, kèm nhắc bấm "Tính lại KPI"
 *   · Bộ phận không có KPI       → chỉ tổng NET
 */
function PayrollSummary({ data }) {
  const kpiReady = data.hasKpiBonus && data.kpiComputed;

  const fmtTon = (v) =>
    v == null ? '—' : `${Number(v).toLocaleString('vi-VN', { maximumFractionDigits: 3 })} tấn`;

  const Stat = ({ label, value, tone = 'text-ink', hint }) => (
    <div className="min-w-0 sm:min-w-[120px]">
      <p className="text-[10px] font-semibold text-muted uppercase tracking-wider">{label}</p>
      <p className={`text-sm font-bold mt-0.5 ${tone}`}>{value}</p>
      {hint && <p className="text-[10px] text-faint mt-0.5">{hint}</p>}
    </div>
  );

  return (
    <div className="space-y-2.5">
      {/* Điện thoại: lưới 2 cột, ô cột phải canh phải để hai mép thẳng hàng.
          Trước đây dùng flex-wrap nên trên màn hẹp các ô rơi xuống lệch nhau,
          cột phải vẫn canh trái và nhìn như bị lỗi tràn.
          Từ sm trở lên quay về flex-wrap như cũ. */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-3
                      [&>div:nth-child(even)]:text-right
                      sm:flex sm:flex-wrap sm:gap-x-7
                      sm:[&>div:nth-child(even)]:text-left">
        {kpiReady && (
          <>
            <Stat
              label="Tổng sản lượng tháng"
              value={fmtTon(data.kpiTotalOutputTon)}
              hint={data.kpiTotalOutputKg != null
                ? `${Number(data.kpiTotalOutputKg).toLocaleString('vi-VN')} kg` : null}
            />
            <Stat label="Đơn giá thưởng" value={`${formatCurrency(data.kpiRatePerTon)} / tấn`} />
            <Stat label="Tổng tiền thưởng" value={formatCurrency(data.kpiBonusPool)} tone="text-gold" />
            <Stat
              label="Tiền dư đợt trước"
              value={formatCurrency(data.kpiCarryOverIn)}
              hint={data.kpiCarryOverInDetail?.length
                ? data.kpiCarryOverInDetail
                    .map(c => `${c.label}: ${formatCurrency(c.amount)}`).join(' · ')
                : null}
            />
          </>
        )}

        <Stat label="Tổng NET" value={formatCurrency(data.totalNetSalary)} tone="text-emerald-700 dark:text-emerald-300" />

        {kpiReady && (
          <Stat label="Tổng KPI" value={formatCurrency(data.totalKpiBonus)} tone="text-gold" />
        )}
      </div>

      {data.hasKpiBonus && !data.kpiComputed && (
        <p className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/28 rounded-lg px-2.5 py-1.5 inline-block">
          Chưa tính thưởng KPI cho kỳ này — bấm "Tính lại KPI" hoặc "Hoàn tất" để tính.
        </p>
      )}
    </div>
  );
}


// Bỏ dấu tiếng Việt để "nga" tìm được "Nguyễn Thị Hồng Nga" và "hong nga" cũng
// khớp. Chuẩn hoá NFD tách dấu thành ký tự tổ hợp rồi xoá; riêng đ/Đ không có
// dạng tổ hợp nên phải thay tay.
const normText = (v) =>
  String(v ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();

// Số công: bỏ đuôi ,00 cho gọn (27,00 → 27 · 25,28 giữ nguyên)
const fmtDays = (v) =>
  v == null ? '—' : Number(v).toLocaleString('vi-VN', { maximumFractionDigits: 2 });

// Tháng này có bị trừ lương vì thiếu công không — dùng để tô cảnh báo cột
// "Lương thực tế". So bằng số tiền chứ không so ngày công: nhân viên được miễn
// chấm công hoặc bản ghi cũ thiếu standardDays vẫn cho ra kết quả đúng.
const shortfall = (r) =>
  r.standardBaseSalary != null && r.baseSalary != null && r.baseSalary < r.standardBaseSalary;

// LƯƠNG KHOÁN TRỌN THÁNG — bảo vệ xưởng thuê từ đơn vị bên ngoài. Lương không
// chia theo chấm công, không bảo hiểm/thuế/phụ cấp, nên gộp 2 cột lương và bỏ
// nút "Chi tiết lương".
//
// Ưu tiên cờ attendanceExempt từ BE; so thêm payrollRole để bảng vẫn đúng với
// bản ghi cũ chưa có cờ này.
const flatPay = (r) => !!r.attendanceExempt || r.payrollRole === 'FACTORY_SECURITY';


// ══════════════════════════════════════════════════════════════════════════════
// THẺ PHIẾU LƯƠNG — BẢN ĐIỆN THOẠI
// ══════════════════════════════════════════════════════════════════════════════
//
// Bố cục 2 cột: nhãn/giá trị bên trái canh trái, bên phải canh phải — hai mép
// thẳng hàng nên mắt quét dọc được, không bị so le như khi để flex-wrap.
//
//   ┌──────────────────────────────────────┐
//   │ Tên nhân viên                        │
//   │ Chức vụ                              │
//   ├──────────────────┬───────────────────┤
//   │ Lương cơ bản     │      Lương thực tế│
//   ├──────────────────┼───────────────────┤
//   │ Phụ cấp          │        Thưởng KPI │
//   │ Thưởng           │                   │
//   ├──────────────────┴───────────────────┤
//   │ [Chi tiết lương]     [Ngày công]     │
//   └──────────────────────────────────────┘

function PayrollMobileCard({ row: r, isDriver, showKpi, highlight = false, onAttendance, onSalary }) {
  const flat = flatPay(r);

  // Bảo vệ khoán trọn tháng: không breakdown, không chấm công → không nút nào.
  const showSalaryBtn = !flat && !!r.salaryDetail;
  const showAttendanceBtn = !isDriver && !flat;

  const Cell = ({ label, value, sub, tone = '', right = false }) => (
    <div className={right ? 'text-right' : 'text-left'}>
      <p className="text-[10px] font-semibold text-muted uppercase tracking-wider">{label}</p>
      <p className={`text-sm font-bold mt-0.5 ${tone || 'text-ink'}`}>{value}</p>
      {sub && <p className="text-[11px] text-muted mt-0.5">{sub}</p>}
    </div>
  );

  return (
    <div
      id={`payroll-card-${r.userId}`}
      className={`rounded-2xl border px-4 py-4 space-y-3 transition-colors
        ${highlight
          ? 'border-gold bg-gold/10 shadow-sm'
          : 'border-hairline-2 bg-surface'}`}
    >
      {/* Header — gạch dưới để tách hẳn khỏi phần số liệu */}
      <div className="pb-2.5 border-b border-hairline">
        <p className="font-semibold text-ink leading-snug">{r.userFullName}</p>
        <p className="text-xs text-muted">
          {r.roleLabel || '—'}
          {r.salaryStatus === 'NO_SALARY' && (
            <span className="ml-1.5 text-amber-600 dark:text-amber-300 font-semibold">· chưa có hồ sơ lương</span>
          )}
        </p>
      </div>

      {/* Lương cơ bản | Lương thực tế */}
      {flat ? (
        <Cell
          label="Lương khoán trọn tháng"
          value={formatCurrency(r.baseSalary)}
          sub="Hợp đồng thuê ngoài"
        />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Cell label="Lương cơ bản" value={formatCurrency(r.standardBaseSalary ?? r.baseSalary)} />
          <Cell
            right
            label="Lương thực tế"
            value={formatCurrency(r.baseSalary)}
            tone={shortfall(r) ? 'text-amber-700 dark:text-amber-300' : ''}
            sub={r.standardDays != null
              ? `${fmtDays(r.actualDays)} / ${fmtDays(r.standardDays)} công`
              : null}
          />
        </div>
      )}

      {/* Phụ cấp + Thưởng (trái, 2 dòng) | Thưởng KPI (phải) */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Cell label="Phụ cấp" value={formatCurrency(r.allowance)} />
          <Cell label="Thưởng" value={formatCurrency(r.bonus)} />
        </div>

        {showKpi && (
          <Cell
            right
            label="Thưởng KPI"
            value={formatCurrency(r.kpiBonus)}
            tone="text-gold"
          />
        )}
      </div>

      {/* Hai nút chia đôi trái / phải */}
      {(showSalaryBtn || showAttendanceBtn) && (
        <div className="flex items-center gap-2 pt-1">
          {showSalaryBtn && (
            <button
              type="button"
              onClick={onSalary}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl
                border border-hairline-2 bg-surface text-[11px] font-semibold text-ink-2
                active:bg-canvas transition-colors"
            >
              <Receipt size={13} className="text-gold" />
              Chi tiết lương
            </button>
          )}

          {showAttendanceBtn && (
            <button
              type="button"
              onClick={onAttendance}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl
                border border-hairline-2 bg-surface text-[11px] font-semibold text-ink-2
                active:bg-canvas transition-colors"
            >
              <Clock size={13} className="text-gold" />
              Chi tiết ngày công
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function PayrollTables({ data, loading }) {
  // Nhân viên đang mở modal chi tiết ngày công (null = đóng).
  const [detailOf, setDetailOf] = useState(null);
  // Nhân viên đang mở modal breakdown lương (null = đóng).
  const [salaryOf, setSalaryOf] = useState(null);

  // ── TÌM NHÂN VIÊN THEO TÊN ────────────────────────────────────────────────
  //   Cố ý KHÔNG lọc bớt dòng: bảng lương là chứng từ, ẩn bớt người đi thì tổng
  //   ở đầu bảng không còn khớp với những gì đang nhìn thấy. Thay vào đó tô sáng
  //   người khớp và cuộn tới họ — vẫn thấy nguyên danh sách để đối chiếu.
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);   // ô tìm nổi trên mobile

  // ── MỌI HOOK PHẢI NẰM TRÊN CÁC `return` SỚM ───────────────────────────────
  //   React nhận diện hook theo THỨ TỰ GỌI, không theo tên. Đặt useEffect phía
  //   dưới `if (loading) return ...` thì lần render đang tải chỉ chạy 4 hook,
  //   lần sau chạy 5 → "Rendered more hooks than during the previous render".
  //   Vì vậy phần suy ra dữ liệu bên dưới phải chịu được data = null.
  const rows = data?.rows || [];
  const isDriver = !data?.attendanceBased;

  const q = normText(query);
  const matchIds = q
    ? rows.filter(r => normText(r.userFullName).includes(q)).map(r => r.userId)
    : [];
  const isMatch = (r) => matchIds.includes(r.userId);

  // Chuỗi id thay cho mảng trong deps: mảng tạo mới mỗi lần render nên so sánh
  // tham chiếu luôn khác nhau, effect sẽ chạy vô hạn và cuộn giật liên tục.
  const matchKey = matchIds.join(',');

  // Cuộn tới người khớp ĐẦU TIÊN. Tìm cả id của thẻ mobile lẫn dòng bảng rồi
  // chọn phần tử đang thực sự hiển thị (offsetParent = null khi bị `hidden`),
  // nên cùng một đoạn code chạy đúng ở cả hai bố cục.
  useEffect(() => {
    if (!matchKey) return;
    const id = matchKey.split(',')[0];
    const el = [
      document.getElementById(`payroll-card-${id}`),
      document.getElementById(`payroll-row-${id}`),
    ].find(e => e && e.offsetParent !== null);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [matchKey]);

  if (loading) return <SectionCard><LoadingSpinner label="Đang tải bảng lương..." /></SectionCard>;
  if (!data) return null;

  return (
    <>
      {/* ── BẢNG 1: PHIẾU LƯƠNG ─────────────────────────────────────────── */}
      <SectionCard>
        <div className="px-5 py-4 border-b border-hairline">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <Receipt size={16} className="text-gold shrink-0" />
              <h3 className="text-sm font-bold text-ink">
                Phiếu lương — {data.departmentLabel} · {data.periodLabel}
              </h3>
            </div>

            {/* Ô tìm cố định — ẩn trên mobile, nơi đó dùng nút nổi bên dưới */}
            <div className="hidden md:block relative shrink-0">
              <Search size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-faint pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Tìm theo tên nhân viên..."
                className="w-56 lg:w-64 pl-8 pr-8 py-2 rounded-xl border border-hairline-2 text-xs
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

          <PayrollSummary data={data} />

          {query && (
            <p className="text-[11px] text-muted mt-2.5">
              {matchIds.length
                ? `Tìm thấy ${matchIds.length} nhân viên khớp "${query}"`
                : `Không có nhân viên nào khớp "${query}"`}
            </p>
          )}
        </div>

        {/* Bảng đầy đủ — chỉ từ md trở lên. Màn hẹp dùng danh sách thẻ bên dưới:
            7 cột nhét vào 380px thì chữ nhỏ tới mức không đọc nổi, còn cuộn
            ngang thì mất luôn cột tên nên không biết đang xem của ai. */}
        <div className="hidden md:block overflow-x-auto">
          <Table>
            <Thead>
              <Tr>
                {/* Bố cục 7 cột: bỏ GROSS / Bảo hiểm NLĐ / Thuế TNCN khỏi bảng
                    vì doanh nghiệp trả toàn bộ các khoản đó — nhân viên không bị
                    trừ đồng nào nên bày ra đây chỉ gây hiểu nhầm. Ai cần vẫn xem
                    được đầy đủ trong modal "Chi tiết lương". */}
                <Th>Nhân viên</Th>
                <Th right>Lương cơ bản</Th>
                <Th right>Lương thực tế</Th>
                <Th right>Phụ cấp</Th>
                <Th right>Thưởng</Th>
                {data.hasKpiBonus && <Th right>Thưởng KPI</Th>}
                <Th right>Chi tiết</Th>
              </Tr>
            </Thead>
            <tbody>
              {rows.map(r => (
                <Tr
                  key={r.userId}
                  id={`payroll-row-${r.userId}`}
                  className={isMatch(r) ? 'bg-gold/12' : ''}
                >
                  <Td>
                    <div className="font-medium">{r.userFullName}</div>
                    <div className="text-xs text-muted">
                      {r.roleLabel || '—'}
                      {r.salaryStatus === 'NO_SALARY' && (
                        <span className="ml-1.5 text-amber-600 dark:text-amber-300 font-semibold">· chưa có hồ sơ lương</span>
                      )}
                    </div>
                  </Td>
                  {/* NGƯỜI KHOÁN TRỌN THÁNG (bảo vệ xưởng — hợp đồng thuê ngoài):
                      gộp 2 cột làm một. Lương thực tế luôn bằng lương cơ bản vì
                      không chia theo chấm công, tách ra chỉ lặp lại một con số. */}
                  {flatPay(r) ? (
                    <Td right colSpan={2}>
                      <div>{formatCurrency(r.baseSalary)}</div>
                      <div className="text-[11px] text-muted">Khoán trọn tháng</div>
                    </Td>
                  ) : (
                    <>
                      {/* Lương cơ bản NGUYÊN MỨC — chưa chia theo chấm công.
                          standardBaseSalary chỉ có ở bản ghi mới; bản ghi cũ rơi
                          về baseSalary để bảng không hiện ô trống. */}
                      <Td right>{formatCurrency(r.standardBaseSalary ?? r.baseSalary)}</Td>

                      {/* Lương thực tế + số ngày công ở dòng dưới */}
                      <Td right>
                        <div className={shortfall(r) ? 'text-amber-700 dark:text-amber-300 font-semibold' : ''}>
                          {formatCurrency(r.baseSalary)}
                        </div>
                        <div className="text-[11px] text-muted">
                          {r.standardDays != null
                            ? `${fmtDays(r.actualDays)} / ${fmtDays(r.standardDays)} công`
                            : '—'}
                        </div>
                      </Td>
                    </>
                  )}

                  <Td right>{formatCurrency(r.allowance)}</Td>
                  <Td right>{formatCurrency(r.bonus)}</Td>
                  {data.hasKpiBonus && (
                    <Td right><span className="text-gold font-semibold">
                      {formatCurrency(r.kpiBonus)}</span></Td>
                  )}

                  <Td right>
                    <div className="flex items-center justify-end gap-1.5">
                      {/* Người hưởng khoán (bảo vệ xưởng) không có dữ liệu chấm
                          công — ẩn nút thay vì mở ra lịch trống. */}
                      {!isDriver && !r.attendanceExempt && (
                        <button
                          type="button"
                          onClick={() => setDetailOf(r)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg
                            border border-hairline-2 bg-surface text-[11px] font-semibold text-ink-2
                            hover:border-gold/60 hover:text-ink transition-colors"
                        >
                          <Clock size={13} className="text-gold" />
                          Ngày công
                        </button>
                      )}

                      {/* Người khoán trọn tháng không có breakdown để xem: không
                          bảo hiểm, không thuế, không phụ cấp — modal sẽ chỉ lặp
                          lại đúng con số đã hiện ở cột lương. */}
                      {!flatPay(r) && (
                        <button
                          type="button"
                          onClick={() => setSalaryOf(r)}
                          disabled={!r.salaryDetail}
                          title={r.salaryDetail ? 'Xem breakdown lương' : 'Chưa có hồ sơ lương'}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg
                            border border-hairline-2 bg-surface text-[11px] font-semibold text-ink-2
                            hover:border-gold/60 hover:text-ink transition-colors
                            disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Receipt size={13} className="text-gold" />
                          Chi tiết lương
                        </button>
                      )}

                      {flatPay(r) && (
                        <span className="text-[11px] text-faint italic">Hợp đồng thuê ngoài</span>
                      )}
                    </div>
                  </Td>
                </Tr>
              ))}
              {rows.length === 0 && (
                <Tr><Td className="text-center text-muted py-8">
                  Bộ phận này chưa có nhân viên nào</Td></Tr>
              )}
            </tbody>
          </Table>
        </div>

        {/* ── ĐIỆN THOẠI: mỗi nhân viên một thẻ ───────────────────────────── */}
        <div className="md:hidden p-3 space-y-3">
          {rows.map(r => (
            <PayrollMobileCard
              key={r.userId}
              row={r}
              isDriver={isDriver}
              showKpi={!!data.hasKpiBonus}
              highlight={isMatch(r)}
              onAttendance={() => setDetailOf(r)}
              onSalary={() => setSalaryOf(r)}
            />
          ))}
          {rows.length === 0 && (
            <p className="text-center text-sm text-muted py-10">
              Bộ phận này chưa có nhân viên nào
            </p>
          )}
        </div>
      </SectionCard>

      {/* Bảng "Chi tiết số km theo tháng" đã BỎ — thông tin km/số đơn đã hiện
          đầy đủ trong bảng "Lương tài xế theo km & lượt giao" ở panel bên trên. */}

      {/* Modal chi tiết ngày công của nhân viên vừa bấm */}
      <EmployeeAttendanceModal
        employee={detailOf}
        month={data.month}
        year={data.year}
        periodLabel={data.periodLabel}
        onClose={() => setDetailOf(null)}
      />

      {/* Modal breakdown lương — dùng lại đúng component của trang Nhân sự để
          hai màn hình không bao giờ hiện hai cách tính khác nhau. */}
      <SalaryDetailModal row={salaryOf} onClose={() => setSalaryOf(null)} />

      {/* ── NÚT TÌM NỔI — CHỈ TRÊN ĐIỆN THOẠI ─────────────────────────────────
          Danh sách thẻ dài hàng chục màn hình, ô tìm đặt ở đầu bảng sẽ trôi mất
          ngay khi cuộn xuống. Nút nổi bám màn hình nên tìm được ở bất kỳ đâu.
          Ẩn khi đang mở modal để không đè lên nội dung modal. */}
      {!detailOf && !salaryOf && (
        <div className="md:hidden fixed bottom-5 right-4 z-40 flex items-center gap-2">
          {searchOpen && (
            <div className="relative">
              <input
                autoFocus
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Tên nhân viên..."
                className="w-52 pl-3 pr-8 py-3 rounded-2xl border border-hairline-2 bg-surface
                           text-sm shadow-lg focus:outline-none focus:border-gold"
              />
              {query && (
                <button onClick={() => setQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-faint">
                  <X size={15} />
                </button>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              // Đóng thì xoá luôn từ khoá — để lại highlight trong khi ô tìm đã
              // biến mất sẽ khiến người dùng không hiểu vì sao dòng bị tô vàng.
              if (searchOpen) setQuery('');
              setSearchOpen(v => !v);
            }}
            aria-label={searchOpen ? 'Đóng tìm kiếm' : 'Tìm nhân viên'}
            className="shrink-0 rounded-full bg-gradient-to-br from-gold to-gold-deep
                       text-white shadow-lg shadow-gold/30 flex items-center justify-center
                       active:scale-95 transition-transform"
            style={{ width: '3.25rem', height: '3.25rem' }}
          >
            {searchOpen ? <X size={20} /> : <Search size={20} />}
          </button>
        </div>
      )}
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MODAL "CHI TIẾT LƯƠNG"
// ══════════════════════════════════════════════════════════════════════════════

function SalaryDetailModal({ row, onClose }) {
  if (!row) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-surface rounded-2xl shadow-2xl w-full max-w-lg
                      max-h-[88vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-hairline shrink-0">
          <h3 className="font-bold text-ink text-sm">
            Chi tiết lương — {row.userFullName}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted hover:bg-canvas">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto">
          {row.salaryDetail
            ? <SalaryBreakdownCards row={row.salaryDetail} />
            : <p className="text-sm text-muted text-center py-8">
                Nhân viên chưa có hồ sơ lương được duyệt.
              </p>}
        </div>

        <div className="px-5 py-4 border-t border-hairline shrink-0">
          <button onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-canvas text-sm font-semibold
                       text-ink hover:bg-surface-2 transition">
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TRANG CHÍNH
// ══════════════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════════════════
// LƯƠNG TÀI XẾ — OWNER nhập giá xăng + đơn giá thưởng (xe máy & xe tải),
// xem bảng lương tách theo loại xe. Bấm 1 dòng → modal 2 tab (đơn hàng + lương).
// ══════════════════════════════════════════════════════════════════════════════

// Format số kiểu Việt Nam: 1234 → "1.234"
const fmtVN = (v) => {
  if (v == null || v === '') return '';
  const n = String(v).replace(/[^\d]/g, '');
  if (!n) return '';
  return n.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};
const parseVN = (v) => {
  const n = Number(String(v ?? '').replace(/[^\d]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

/** Ô nhập số kiểu VN: gõ ký tự → format ngay, gợi ý "vnđ" phía sau. */
function VNMoneyInput({ value, onChange, placeholder, disabled }) {
  return (
    <div className={`relative ${disabled ? 'opacity-60' : ''}`}>
      <input
        inputMode="numeric" disabled={disabled}
        value={fmtVN(value)}
        onChange={e => onChange(String(e.target.value).replace(/[^\d]/g, ''))}
        placeholder={placeholder}
        className="w-full pl-4 pr-14 py-2.5 rounded-xl border border-hairline-2 text-sm text-right
          focus:outline-none focus:ring-2 focus:ring-gold bg-surface disabled:cursor-not-allowed
          disabled:bg-canvas"
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted pointer-events-none">
        vnđ
      </span>
    </div>
  );
}

function DriverPayrollPanel({ month, year, onSaved }) {
  const toast = useToast();
  const [cfg, setCfg] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [gasPrice, setGasPrice] = useState('');
  const [bonusMoto, setBonusMoto] = useState('');
  const [bonusTruck, setBonusTruck] = useState('');
  const [modalDriver, setModalDriver] = useState(null); // { userId, name, vehicleType }

  const finalized = cfg?.finalized === true;

  const load = useCallback(async () => {
    if (!month || !year) return;
    setLoading(true);
    try {
      const data = await factoryPayrollApi.driverConfig(month, year);
      setCfg(data);
      setGasPrice(data?.gasPrice != null ? String(data.gasPrice) : '');
      setBonusMoto(data?.bonusUnitPrice != null ? String(data.bonusUnitPrice) : '');
      setBonusTruck(data?.truckBonusUnitPrice != null ? String(data.truckBonusUnitPrice) : '');
    } catch (e) {
      toast(e?.response?.data?.message || 'Không tải được lương tài xế', 'error');
    } finally { setLoading(false); }
  }, [month, year]); // eslint-disable-line

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const data = await factoryPayrollApi.saveDriverConfig(
        month, year, parseVN(gasPrice), parseVN(bonusMoto), parseVN(bonusTruck));
      setCfg(data);
      toast('Đã lưu giá xăng và đơn giá thưởng. Bấm "Hoàn tất" để chốt lương.', 'success');
      onSaved && onSaved();
    } catch (e) {
      toast(e?.response?.data?.message || 'Lỗi khi lưu', 'error');
    } finally { setSaving(false); }
  };

  const rows = cfg?.rows || [];

  return (
    <SectionCard>
      <div className="px-5 py-5 space-y-5">
        <div className="flex items-start gap-3">
          <span className="w-10 h-10 rounded-xl bg-canvas flex items-center justify-center shrink-0">
            <Truck size={17} className="text-gold" />
          </span>
          <div>
            <p className="text-sm font-bold text-ink">Lương tài xế theo km &amp; lượt giao</p>
            <p className="text-xs text-muted mt-1 leading-relaxed max-w-2xl">
              Lương xe máy = <strong>tổng km × giá xăng</strong> +{' '}
              <strong>lượt xe máy × đơn giá thưởng xe máy</strong>.
              Xe tải chỉ tính <strong>lượt xe tải × đơn giá thưởng xe tải</strong> (lương cứng
              xe tải quản lý riêng ở phần Nhân sự).
              {finalized && (
                <span className="block mt-1 text-emerald-600 dark:text-emerald-300 font-semibold">
                  Đã Hoàn tất — bấm "Mở lại" ở trên để chỉnh sửa.
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Nhập giá xăng + 2 đơn giá thưởng */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">
              Giá xăng <span className="font-normal">(đồng / km, cho xe máy)</span>
            </label>
            <VNMoneyInput value={gasPrice} onChange={setGasPrice}
              placeholder="VD: 3.000" disabled={finalized || loading} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">
              Đơn giá thưởng xe máy <span className="font-normal">(đồng / lượt)</span>
            </label>
            <VNMoneyInput value={bonusMoto} onChange={setBonusMoto}
              placeholder="VD: 20.000" disabled={finalized || loading} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">
              Đơn giá thưởng xe tải <span className="font-normal">(đồng / lượt)</span>
            </label>
            <VNMoneyInput value={bonusTruck} onChange={setBonusTruck}
              placeholder="VD: 30.000" disabled={finalized || loading} />
          </div>
        </div>
        <div className="flex justify-end">
          <PrimaryButton onClick={save} disabled={saving || loading || finalized}>
            {saving ? 'Đang lưu...' : 'Lưu giá xăng & đơn giá thưởng'}
          </PrimaryButton>
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : rows.length === 0 ? (
          <EmptyState title="Chưa có tài xế" description="Không có tài xế nào có tài khoản để tính lương." />
        ) : (
          <>
            {/* ── DESKTOP: bảng, mỗi tài xế 1 dòng xe máy (chính) + 1 dòng xe tải ── */}
            <div className="hidden md:block overflow-x-auto rounded-xl border border-hairline">
              <table className="w-full text-xs">
                <thead className="bg-canvas">
                  <tr className="text-left text-muted">
                    <th className="px-3 py-2 font-semibold">Tài xế</th>
                    <th className="px-3 py-2 font-semibold text-right">Tổng km</th>
                    <th className="px-3 py-2 font-semibold text-right">Số đơn</th>
                    <th className="px-3 py-2 font-semibold text-right">Số lượt</th>
                    <th className="px-3 py-2 font-semibold text-right">Tiền xăng</th>
                    <th className="px-3 py-2 font-semibold text-right">Thưởng</th>
                    <th className="px-3 py-2 font-semibold text-right">Tổng theo loại</th>
                    <th className="px-3 py-2 font-semibold text-right">Tổng lương tài xế</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => <DriverSalaryRows key={r.userId} row={r} onOpen={setModalDriver} />)}
                </tbody>
              </table>
              <div className="flex justify-end p-3 text-sm bg-canvas border-t border-hairline">
                <span className="text-muted mr-2">Tổng chi lương tài xế:</span>
                <span className="font-bold text-gold">{formatCurrency(cfg?.grandTotalSalary || 0)}</span>
              </div>
            </div>

            {/* ── MOBILE: mỗi tài xế 1 card, có card con nếu chạy cả 2 loại ── */}
            <div className="md:hidden space-y-3">
              {rows.map(r => <DriverSalaryCard key={r.userId} row={r} onOpen={setModalDriver} />)}
              <div className="rounded-xl bg-canvas p-3 flex items-center justify-between text-sm">
                <span className="text-muted font-semibold">Tổng chi lương tài xế</span>
                <span className="font-bold text-gold">{formatCurrency(cfg?.grandTotalSalary || 0)}</span>
              </div>
            </div>

            {(cfg?.gasPrice == null || cfg?.bonusUnitPrice == null || cfg?.truckBonusUnitPrice == null) && (
              <p className="mt-2 text-xs text-amber-600 dark:text-amber-300 flex items-center gap-1">
                <AlertCircle size={12} /> Cần nhập & lưu đủ 3 giá trên trước khi Hoàn tất.
              </p>
            )}
          </>
        )}
      </div>

      {modalDriver && (
        <DriverDetailModal driver={modalDriver} month={month} year={year}
          onClose={() => setModalDriver(null)} />
      )}
    </SectionCard>
  );
}

/** 1 dòng chính (xe máy) + 1 dòng phụ (xe tải) cho 1 tài xế, hoặc đảo lại nếu
    chỉ có xe tải. Rowspan cột "Tổng lương tài xế" gộp 2 dòng. */
function DriverSalaryRows({ row, onOpen }) {
  const hasMoto = !!row.motorbike;
  const hasTruck = !!row.truck;
  const rowspan = (hasMoto && hasTruck) ? 2 : 1;
  const nameCell = (
    <td rowSpan={rowspan} className="px-3 py-2 font-medium text-ink align-top border-t border-hairline">
      <button onClick={() => onOpen({ userId: row.userId, name: row.driverName, vehicleType: row.vehicleType })}
        className="text-left hover:text-gold">
        {row.driverName}
        <span className="block text-[10px] text-muted font-normal">
          {row.vehicleType === 'BOTH' ? 'Xe máy + Xe tải'
            : row.vehicleType === 'TRUCK' ? 'Xe tải' : 'Xe máy'}
        </span>
      </button>
    </td>
  );
  const grandCell = (
    <td rowSpan={rowspan} className="px-3 py-2 text-right align-middle border-t border-hairline">
      <span className="font-bold text-gold">
        {row.grandTotalSalary != null ? formatCurrency(row.grandTotalSalary) : '—'}
      </span>
    </td>
  );

  // Dòng chính: XE MÁY nếu có, ngược lại XE TẢI (khi tài xế chỉ chạy xe tải).
  const first = hasMoto ? { kind: 'MOTO', s: row.motorbike } : { kind: 'TRUCK', s: row.truck };
  const second = (hasMoto && hasTruck) ? { kind: 'TRUCK', s: row.truck } : null;

  return (
    <>
      <tr className="hover:bg-canvas cursor-pointer" onClick={() =>
        onOpen({ userId: row.userId, name: row.driverName, vehicleType: row.vehicleType })}>
        {nameCell}
        <SalaryCells s={first.s} kind={first.kind} />
        {grandCell}
      </tr>
      {second && (
        <tr className="hover:bg-canvas cursor-pointer" onClick={() =>
          onOpen({ userId: row.userId, name: row.driverName, vehicleType: row.vehicleType })}>
          <SalaryCells s={second.s} kind={second.kind} subRow />
        </tr>
      )}
    </>
  );
}

function SalaryCells({ s, kind, subRow }) {
  const isTruck = kind === 'TRUCK';
  const label = isTruck ? 'Xe tải' : 'Xe máy';
  return (
    <>
      <td className={`px-3 py-2 text-right ${subRow ? '' : 'border-t border-hairline'}`}>
        <div className="flex items-center justify-end gap-1">
          {subRow && <CornerDownRight size={11} className="text-muted" />}
          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-canvas text-muted">{label}</span>
          {!isTruck && <span className="text-ink font-medium ml-1">{fmtNum(s?.totalKm, 1)}</span>}
        </div>
      </td>
      <td className={`px-3 py-2 text-right ${subRow ? '' : 'border-t border-hairline'}`}>{s?.totalOrders ?? 0}</td>
      <td className={`px-3 py-2 text-right ${subRow ? '' : 'border-t border-hairline'}`}>{s?.totalTrips ?? 0}</td>
      <td className={`px-3 py-2 text-right ${subRow ? '' : 'border-t border-hairline'}`}>
        {isTruck ? '—' : (s?.fuelPay != null ? formatCurrency(s.fuelPay) : '—')}
      </td>
      <td className={`px-3 py-2 text-right ${subRow ? '' : 'border-t border-hairline'}`}>
        {s?.bonusPay != null ? formatCurrency(s.bonusPay) : '—'}
      </td>
      <td className={`px-3 py-2 text-right font-semibold ${subRow ? '' : 'border-t border-hairline'}`}>
        {s?.totalSalary != null ? formatCurrency(s.totalSalary) : '—'}
      </td>
    </>
  );
}

/** Card cho mobile: 1 card chính + card con nếu tài xế chạy cả 2 loại. */
function DriverSalaryCard({ row, onOpen }) {
  const hasMoto = !!row.motorbike;
  const hasTruck = !!row.truck;
  return (
    <div onClick={() => onOpen({ userId: row.userId, name: row.driverName, vehicleType: row.vehicleType })}
      className="rounded-2xl border border-hairline bg-surface p-3 cursor-pointer active:scale-[0.99] transition-transform">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-ink">{row.driverName}</p>
          <p className="text-[11px] text-muted">
            {row.vehicleType === 'BOTH' ? 'Xe máy + Xe tải'
              : row.vehicleType === 'TRUCK' ? 'Xe tải' : 'Xe máy'}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-muted uppercase tracking-wider">Tổng lương</p>
          <p className="text-base font-bold text-gold">
            {row.grandTotalSalary != null ? formatCurrency(row.grandTotalSalary) : '—'}
          </p>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        {hasMoto && <VehicleSubCard s={row.motorbike} kind="MOTO" />}
        {hasTruck && <VehicleSubCard s={row.truck} kind="TRUCK" />}
      </div>
    </div>
  );
}

function VehicleSubCard({ s, kind }) {
  const isTruck = kind === 'TRUCK';
  const label = isTruck ? 'Xe tải' : 'Xe máy';
  return (
    <div className="rounded-xl bg-canvas p-2.5">
      <div className="flex items-center justify-between mb-1.5">
        <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
          isTruck ? 'bg-blue-500/10 text-blue-600 dark:text-blue-300'
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-300'}`}>
          {label}
        </span>
        <span className="text-sm font-bold text-ink">
          {s?.totalSalary != null ? formatCurrency(s.totalSalary) : '—'}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
        {!isTruck && (
          <>
            <span className="text-muted">Tổng km</span>
            <span className="text-right text-ink font-medium">{fmtNum(s?.totalKm, 1)} km</span>
          </>
        )}
        <span className="text-muted">Số đơn</span>
        <span className="text-right text-ink font-medium">{s?.totalOrders ?? 0}</span>
        <span className="text-muted">Số lượt</span>
        <span className="text-right text-ink font-medium">{s?.totalTrips ?? 0}</span>
        {!isTruck && (
          <>
            <span className="text-muted">Tiền xăng</span>
            <span className="text-right text-ink font-medium">
              {s?.fuelPay != null ? formatCurrency(s.fuelPay) : '—'}
            </span>
          </>
        )}
        <span className="text-muted">Thưởng</span>
        <span className="text-right text-ink font-medium">
          {s?.bonusPay != null ? formatCurrency(s.bonusPay) : '—'}
        </span>
      </div>
    </div>
  );
}

/** Modal chi tiết: Tab 1 = đơn hàng theo ngày, Tab 2 = chi tiết lương. */
function DriverDetailModal({ driver, month, year, onClose }) {
  const toast = useToast();
  const [tab, setTab] = useState('orders');
  const [dm, setDm] = useState(null);      // DriverMonthDto (đơn hàng theo ngày)
  const [salary, setSalary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [openDays, setOpenDays] = useState({}); // day -> collapsed?

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const [d, s] = await Promise.all([
          factoryPayrollApi.employeeDriver(driver.userId, month, year),
          factoryPayrollApi.driverSalaryDetail(driver.userId, month, year),
        ]);
        if (!alive) return;
        setDm(d); setSalary(s);
        // Mặc định mở tất cả ngày có đơn
        const init = {};
        (d?.days || []).forEach(day => { if ((day.orderCount || 0) > 0) init[day.day] = true; });
        setOpenDays(init);
      } catch (e) {
        toast(e?.response?.data?.message || 'Không tải được chi tiết', 'error');
      } finally { setLoading(false); }
    })();
    return () => { alive = false; };
  }, [driver.userId, month, year]); // eslint-disable-line

  // Danh sách ngày có đơn, sort tăng dần (đã có trong dm.days)
  const daysWithOrders = (dm?.days || []).filter(d => (d.orders?.length || 0) > 0);

  const payStatusColor = (st) => st === 'PAID'
    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
    : st === 'PARTIAL'
      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-300'
      : 'bg-red-500/10 text-red-600 dark:text-red-300';

  return (
    <div className="fixed inset-0 z-[95] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
      <div className="bg-surface rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-hairline">
          <div>
            <p className="font-bold text-ink text-sm sm:text-base">{driver.name}</p>
            <p className="text-xs text-muted">Tháng {month}/{year}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-canvas text-muted">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-hairline shrink-0">
          {[
            { k: 'orders', label: 'Đơn hàng trong tháng' },
            { k: 'salary', label: 'Chi tiết lương' },
          ].map(t => (
            <button key={t.k} onClick={() => setTab(t.k)}
              className={`flex-1 px-4 py-3 text-sm font-semibold transition-colors ${
                tab === t.k ? 'text-gold border-b-2 border-gold' : 'text-muted hover:text-ink'}`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {loading ? <LoadingSpinner /> : tab === 'orders' ? (
            <>
              {daysWithOrders.length === 0 ? (
                <EmptyState title="Không có đơn" description="Tài xế chưa giao đơn nào trong tháng này." />
              ) : (
                <div className="space-y-2">
                  {daysWithOrders.map(day => (
                    <div key={day.day} className="rounded-xl border border-hairline overflow-hidden">
                      <button onClick={() => setOpenDays(o => ({ ...o, [day.day]: !o[day.day] }))}
                        className="w-full flex items-center justify-between px-3 sm:px-4 py-2.5 bg-canvas hover:bg-surface-2 transition">
                        <div className="flex items-center gap-2">
                          <ChevronDown size={14}
                            className={`text-muted transition-transform ${openDays[day.day] ? '' : '-rotate-90'}`} />
                          <span className="text-sm font-bold text-ink">
                            {String(day.day).padStart(2, '0')}/{String(month).padStart(2, '0')}/{year}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-canvas text-muted">
                            {day.weekdayLabel}
                          </span>
                        </div>
                        <span className="text-xs font-semibold text-gold">{day.orders.length} đơn</span>
                      </button>
                      {openDays[day.day] && (
                        <div className="p-2 space-y-2 bg-surface">
                          {day.orders.map(o => <OrderRow key={o.orderId} o={o} payStatusColor={payStatusColor} />)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <SalaryDetailTab salary={salary} days={dm?.days || []} month={month} year={year} />
          )}
        </div>
      </div>
    </div>
  );
}

/** Lịch tháng của tài xế: màu ô theo điểm danh + 2 badge (số đơn / tổng km). */
function MonthCalendar({ days, month, year }) {
  if (!days || days.length === 0) return null;

  // Bắt đầu tuần T2. weekday: 2..7 = T2..T7, 8 = CN → cột 1..7
  const colOf = (wd) => (wd === 8 ? 7 : Math.max(1, wd - 1));
  const first = days[0];
  const leading = colOf(first.weekday) - 1;

  const colorCls = (c) => c === 'GREEN'
    ? 'bg-emerald-500/15 border-emerald-500/40'
    : c === 'YELLOW'
      ? 'bg-amber-400/15 border-amber-400/40'
      : 'bg-canvas border-hairline';

  return (
    <div className="rounded-2xl border border-hairline bg-surface p-4">
      <div className="flex items-center justify-between mb-3 gap-2">
        <p className="text-sm font-bold text-ink">Điểm danh tháng {month}/{year}</p>
        <div className="flex items-center gap-2.5 text-[10px] text-muted">
          <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded bg-emerald-500/60" /> Đủ</span>
          <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded bg-amber-400/70" /> Thiếu 1</span>
          <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded bg-hairline-2" /> Không</span>
        </div>
      </div>

      {/* Nhãn thứ */}
      <div className="grid grid-cols-7 gap-1.5 mb-1.5">
        {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(w => (
          <div key={w} className="text-[11px] text-muted text-center font-semibold py-1">{w}</div>
        ))}
      </div>

      {/* Các ô ngày */}
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: leading }).map((_, i) => <div key={`x${i}`} />)}
        {days.map(d => {
          const orders = d.orderCount || 0;
          const km = d.totalKm || 0;
          return (
            <div key={d.day}
              className={`aspect-square rounded-lg border p-1.5 flex flex-col ${colorCls(d.dayColor)}`}>
              <span className="text-xs font-bold text-ink leading-none">{d.day}</span>
              {(orders > 0 || km > 0) && (
                <div className="mt-auto flex flex-col items-end gap-0.5">
                  {orders > 0 && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500 text-white leading-none">
                      {orders} đơn
                    </span>
                  )}
                  {km > 0 && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-600 text-white leading-none">
                      {Math.round(km)} km
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OrderRow({ o, payStatusColor }) {
  const fmtDT = (ts) => ts ? new Date(ts).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  }) : '—';
  return (
    <div className="rounded-lg bg-canvas p-3 space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-gold font-mono">{o.orderCode}</p>
          {o.customerName && (
            <p className="text-[11px] text-muted flex items-center gap-1 mt-0.5">
              <UserIcon size={10} /> {o.customerName}
            </p>
          )}
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded font-bold whitespace-nowrap ${payStatusColor(o.paymentStatus)}`}>
          {o.paymentStatusLabel}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
        <span className="text-muted">Số tiền đơn</span>
        <span className="text-right text-ink font-semibold">{formatCurrency(o.finalAmount || 0)}</span>
        <span className="text-muted">Đã thanh toán</span>
        <span className="text-right text-emerald-600 dark:text-emerald-300 font-semibold">
          {formatCurrency(o.paidAmount || 0)}
        </span>
        <span className="text-muted">Đặt lúc</span>
        <span className="text-right text-ink">{fmtDT(o.placedAt)}</span>
        <span className="text-muted">Bắt đầu giao</span>
        <span className="text-right text-ink">{fmtDT(o.deliveredAt)}</span>
      </div>
      {o.deliveryAddress && (
        <p className="text-[11px] text-muted flex items-start gap-1 pt-1 border-t border-hairline">
          <MapPin size={11} className="mt-0.5 shrink-0" />
          <span className="line-clamp-2">{o.deliveryAddress}</span>
        </p>
      )}
      {(o.tripsMotorbike > 0 || o.tripsTruck > 0) && (
        <div className="flex items-center gap-2 text-[10px] pt-1">
          {o.tripsMotorbike > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-300 font-semibold">
              Xe máy × {o.tripsMotorbike}
            </span>
          )}
          {o.tripsTruck > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-300 font-semibold">
              Xe tải × {o.tripsTruck}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function SalaryDetailTab({ salary, days, month, year }) {
  if (!salary) return <EmptyState title="Chưa có" description="Không có dữ liệu lương." />;
  return (
    // Mobile (mặc định flex-col): calendar TRƯỚC, khối lương ở dưới.
    // Desktop (md+): 2 cột — lương 7/12, calendar 5/12; gap rộng hơn cho thoáng.
    <div className="flex flex-col md:grid md:grid-cols-12 md:gap-5 gap-3">
      <div className="order-2 md:order-1 md:col-span-7 space-y-3">
        <DriverEmployeeCard salary={salary} />
        <DriverEmployerCard salary={salary} />
      </div>
      <div className="order-1 md:order-2 md:col-span-5">
        <div className="md:sticky md:top-2">
          <MonthCalendar days={days} month={month} year={year} />
        </div>
      </div>
    </div>
  );
}

/** Card "Của doanh nghiệp phải trả" — copy nguyên từ SalaryBreakdownCards
    (bản mới), giữ đúng layout với các bộ phận khác. Tách ra vì phải bỏ Card 1
    NLĐ (đã có DriverEmployeeCard riêng). */
function DriverEmployerCard({ salary: row }) {
  const fmt = (n) => formatCurrency(n || 0);
  const noIns = row.insuranceExempt != null ? !!row.insuranceExempt : !(row.insuranceSalary > 0);
  const employerIns = row.employerInsuranceTotal || 0;
  const employeeIns = row.employeeInsuranceTotal || 0;
  const pit = row.personalIncomeTax || 0;
  const insuranceBothSides = employerIns + employeeIns;

  const Row = ({ label, val, sub, bold, green }) => (
    <div className={`flex items-center justify-between ${sub ? 'pl-4 py-0.5' : 'py-1'}`}>
      <span className={`text-sm ${sub ? 'text-muted italic' : bold ? 'font-bold text-ink' : 'text-ink'}`}>{label}</span>
      <span className={`text-sm whitespace-nowrap ${bold ? 'font-bold' : 'font-medium'} ${
        green ? 'text-emerald-700 dark:text-emerald-300' : 'text-ink'}`}>{val}</span>
    </div>
  );
  const Divider = () => <div className="h-px bg-surface-2 my-1" />;

  return (
    <div className="bg-canvas rounded-xl p-4 space-y-2">
      <p className="text-xs font-bold text-muted uppercase tracking-wider mb-2">
        Của doanh nghiệp phải trả (VNĐ)
      </p>
      <Row label="Lương thực nhận trả cho nhân viên" val={fmt(row.netSalary)} />
      {noIns ? (
        <>
          <Divider />
          <Row label="Bảo hiểm bắt buộc" val="Không tham gia" />
          {pit > 0 && (<><Divider /><Row label="Thuế TNCN doanh nghiệp nộp thay" val={`+ ${fmt(pit)}`} /></>)}
        </>
      ) : (
        <>
          <Divider />
          <Row label="Bảo hiểm doanh nghiệp đóng (21,5%)" val={`+ ${fmt(employerIns)}`} bold />
          <Row sub label="Bảo hiểm xã hội (17%)" val={`+ ${fmt(row.employerSocialInsurance)}`} />
          <Row sub label="BH Tai nạn LĐ - Bệnh nghề nghiệp (0,5%)" val={`+ ${fmt(row.employerAccidentInsurance)}`} />
          <Row sub label="Bảo hiểm y tế (3%)" val={`+ ${fmt(row.employerHealthInsurance)}`} />
          <Row sub label="Bảo hiểm thất nghiệp (1%)" val={`+ ${fmt(row.employerUnemploymentInsurance)}`} />
          <Divider />
          <Row label="Bảo hiểm cá nhân đóng (10,5%) — DN trả thay" val={`+ ${fmt(employeeIns)}`} bold />
          <Row sub label="Bảo hiểm xã hội (8%)" val={`+ ${fmt(row.employeeSocialInsurance)}`} />
          <Row sub label="Bảo hiểm y tế (1,5%)" val={`+ ${fmt(row.employeeHealthInsurance)}`} />
          <Row sub label="Bảo hiểm thất nghiệp (1%)" val={`+ ${fmt(row.employeeUnemploymentInsurance)}`} />
          <Row label="Thuế TNCN — DN nộp thay" val={`+ ${fmt(pit)}`} bold />
          {(row.pitBrackets || []).map((b, i) => (
            <Row key={i} sub label={`Bậc ${b.ratePercent}% trên ${fmt(b.incomeInBracket)}`}
              val={`+ ${fmt(b.taxInBracket)}`} />
          ))}
          <Divider />
          <Row label="TỔNG TIỀN BẢO HIỂM (cả 2 phần — 32%)" val={fmt(insuranceBothSides)} bold />
        </>
      )}
      <Divider />
      <Row label="TỔNG DOANH NGHIỆP PHẢI CHI TRẢ" val={fmt(row.totalCost)} bold green />
    </div>
  );
}

/** Card "Của người lao động" riêng cho TÀI XẾ — chỉ hiện các dòng theo yêu cầu:
    Lương cơ bản → phụ cấp (cơm, xăng, …) → Tổng phụ cấp → Thưởng đơn hàng →
    Thưởng KPI → LƯƠNG THỰC NHẬN. */
function DriverEmployeeCard({ salary }) {
  const fmt = (n) => formatCurrency(n || 0);
  const allowances = salary.allowances || [];
  const totalAllowance = allowances.reduce((s, a) => s + (a.amount || 0), 0);
  const kpi = salary.kpiPercent != null ? salary.kpiPercent : 100;
  const kpiStr = Number.isInteger(kpi) ? `${kpi}%` : `${kpi.toFixed(2)}%`;
  // Tách rõ: KPI thuần vs bonus items import (Chuyên cần, Tháng 13…). Field
  // effectiveBonus cũ gộp cả 2 → sẽ hiện Chuyên cần thành "Thưởng KPI".
  const bonusItems = salary.bonusItems || [];
  const bonusItemsTotal = salary.bonusItemsTotal
    || bonusItems.reduce((s, b) => s + (b.amount || 0), 0);
  const effBonusKpi = salary.effectiveBonusKpiOnly != null
    ? salary.effectiveBonusKpiOnly
    : ((salary.effectiveBonus || 0) - bonusItemsTotal);
  const orderBonus = salary.driverOrderBonus || 0;
  const totalBonus = orderBonus + (salary.effectiveBonus || 0);
  const bonusSourceCount = (orderBonus > 0 ? 1 : 0)
    + bonusItems.length + (effBonusKpi > 0 ? 1 : 0);

  const Row = ({ label, val, sub, bold, green }) => (
    <div className={`flex items-center justify-between ${sub ? 'pl-4 py-0.5' : 'py-1'}`}>
      <span className={`text-sm ${sub ? 'text-muted italic' : bold ? 'font-bold text-ink' : 'text-ink'}`}>
        {label}
      </span>
      <span className={`text-sm whitespace-nowrap ${bold ? 'font-bold' : 'font-medium'} ${
        green ? 'text-emerald-700 dark:text-emerald-300' : 'text-ink'}`}>{val}</span>
    </div>
  );
  const Divider = () => <div className="h-px bg-surface-2 my-1" />;

  return (
    <div className="bg-canvas rounded-xl p-4 space-y-2">
      <p className="text-xs font-bold text-muted uppercase tracking-wider mb-2">
        Của người lao động (VNĐ)
      </p>
      <Row label="Lương cơ bản" val={fmt(salary.baseSalary)} />

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
      {/* Thưởng đơn hàng — nếu có DETAIL thì hiện 3 dòng (xe máy / xe tải / tổng) */}
      {salary.driverOrderBonusDetail ? (
        <>
          {(salary.driverOrderBonusDetail.motorbikeAmount || 0) > 0 && (
            <Row label={`Thưởng đơn hàng (xe máy × ${salary.driverOrderBonusDetail.motorbikeTrips || 0} lượt)`}
              val={`+ ${fmt(salary.driverOrderBonusDetail.motorbikeAmount)}`} />
          )}
          {(salary.driverOrderBonusDetail.truckAmount || 0) > 0 && (
            <Row label={`Thưởng đơn hàng (xe tải × ${salary.driverOrderBonusDetail.truckTrips || 0} lượt)`}
              val={`+ ${fmt(salary.driverOrderBonusDetail.truckAmount)}`} />
          )}
          {(salary.driverOrderBonusDetail.motorbikeAmount || 0) > 0
            && (salary.driverOrderBonusDetail.truckAmount || 0) > 0 && (
            <Row sub label="Tổng thưởng đơn hàng"
              val={`+ ${fmt(salary.driverOrderBonusDetail.totalAmount)}`} />
          )}
        </>
      ) : orderBonus > 0 && (
        <Row label="Thưởng đơn hàng" val={`+ ${fmt(orderBonus)}`} />
      )}
      {bonusItems.map((b, i) => (
        <Row key={i} label={b.label || 'Thưởng khác'} val={`+ ${fmt(b.amount)}`} />
      ))}
      <Row label={`Thưởng KPI — đạt ${kpiStr}`} val={`+ ${fmt(effBonusKpi)}`} />
      {bonusSourceCount > 1 && (
        <Row sub label="Tổng thưởng" val={`+ ${fmt(totalBonus)}`} />
      )}

      <Divider />
      <Row label="LƯƠNG THỰC NHẬN" val={fmt(salary.netSalary)} bold green />
    </div>
  );
}

export default function AttendanceSheetsPage() {
  const [periods, setPeriods] = useState([]);
  const [selected, setSelected] = useState(null);
  const [department, setDepartment] = useState('FACTORY');
  const [statuses, setStatuses] = useState([]);           // trạng thái CẢ 5 bộ phận
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);                 // 'attendance' | 'exception' | 'leave'
  const [deleting, setDeleting] = useState(null);
  const [finalizing, setFinalizing] = useState(false);
  const [result, setResult] = useState(null);
  const [resultTitle, setResultTitle] = useState('');
  const [recomputing, setRecomputing] = useState(false);
  const [payroll, setPayroll] = useState(null);
  const [loadingPayroll, setLoadingPayroll] = useState(false);
  const [adjustments, setAdjustments] = useState(null);   // { bonus, allowance }
  // Mỗi khoản thưởng là một nhãn riêng, tải lên từ một file riêng.
  const [bonusBatches, setBonusBatches] = useState([]);   // [{ label, employeeCount, totalAmount }]
  const [deletingLabel, setDeletingLabel] = useState(null);
  // Preview modal state — hiển thị nội dung 1 khoản đã import cho OWNER xem lại.
  const [preview, setPreview] = useState(null);       // PreviewResult
  const [previewLoading, setPreviewLoading] = useState(false);
  // Mức thưởng cố định cho MỘT bảo vệ xưởng, nhập lúc bấm tính KPI.
  // Chuỗi rỗng = chưa nhập → gửi null để backend giữ nguyên mức cũ của tháng.
  const [securityRate, setSecurityRate] = useState('');
  const [membersOpen, setMembersOpen] = useState(false);
  const [adjResult, setAdjResult] = useState(null);
  const [adjResultTitle, setAdjResultTitle] = useState('');
  const [kpi, setKpi] = useState(null);
  const toast = useToast();

  const status = statuses.find(s => s.department === department) || null;

  // ── Nạp danh sách tháng ───────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const list = await factoryPayrollApi.uploadablePeriods('FACTORY');
        const arr = Array.isArray(list) ? list : [];
        setPeriods(arr);
        if (arr.length) setSelected(arr[0]);
      } catch (e) {
        toast(e?.response?.data?.message || 'Không tải được danh sách tháng', 'error');
      } finally {
        setLoading(false);
      }
    })();
  }, []); // eslint-disable-line

  // ── Nạp trạng thái CẢ 5 bộ phận khi đổi tháng ─────────────────────────────
  const loadStatus = useCallback(async (p) => {
    if (!p) return;
    try {
      const list = await factoryPayrollApi.monthStatusAll(p.month, p.year);
      setStatuses(Array.isArray(list) ? list : []);
    } catch (e) {
      toast(e?.response?.data?.message || 'Không tải được trạng thái tháng', 'error');
    }
  }, []); // eslint-disable-line

  useEffect(() => { loadStatus(selected); }, [selected, loadStatus]);

  // ── Số dòng thưởng/phụ cấp đã import + quỹ KPI của kỳ ─────────────────────
  const loadAdjustments = useCallback(async (p, dept) => {
    if (!p) { setAdjustments(null); setBonusBatches([]); return; }
    try {
      setAdjustments(await factoryPayrollApi.adjustmentStatus(p.month, p.year, dept));
    } catch {
      setAdjustments(null);
    }
    try {
      const b = await factoryPayrollApi.bonusBatches(p.month, p.year, dept);
      setBonusBatches(Array.isArray(b) ? b : []);
    } catch {
      setBonusBatches([]);
    }
  }, []);

  const loadKpi = useCallback(async (p, dept) => {
    // Chỉ Xưởng sản xuất mới có quỹ thưởng KPI
    if (!p || dept !== 'FACTORY') { setKpi(null); return; }
    try {
      setKpi(await factoryPayrollApi.kpi(p.month, p.year));
    } catch {
      setKpi(null);
    }
  }, []);

  useEffect(() => { loadAdjustments(selected, department); }, [selected, department, loadAdjustments]);
  useEffect(() => { loadKpi(selected, department); }, [selected, department, loadKpi]);

  // ── Nạp 2 bảng lương khi đã HOÀN TẤT ──────────────────────────────────────
  const loadPayroll = useCallback(async (p, dept, finalized) => {
    // Reset ngay khi đổi tháng/tab để không hiển thị nhãn bộ phận CŨ trong lúc
    // chờ fetch (bug: đổi tab Xưởng vẫn thấy "Phiếu lương — Tài xế").
    setPayroll(null);
    if (!p || !finalized) return;
    setLoadingPayroll(true);
    try {
      const res = await factoryPayrollApi.departmentPayroll(p.month, p.year, dept);
      // Chỉ nhận kết quả nếu vẫn khớp với bộ phận đang chọn (tránh race khi bấm
      // nhanh giữa các tab).
      if (res?.department === dept || res?.departmentCode === dept) {
        setPayroll(res);
      } else {
        setPayroll(res);   // BE không trả cờ dept: chấp nhận (đã reset đúng thời điểm gọi)
      }
    } catch (e) {
      toast(e?.response?.data?.message || 'Không tải được bảng lương', 'error');
      setPayroll(null);
    } finally {
      setLoadingPayroll(false);
    }
  }, []); // eslint-disable-line

  useEffect(() => {
    loadPayroll(selected, department, status?.finalized);
  }, [selected, department, status?.finalized, loadPayroll]);

  // ── Hành động ─────────────────────────────────────────────────────────────
  const upload = async (kind, file) => {
    if (!selected) return;
    setBusy(kind);
    try {
      const fn = { attendance: 'uploadSheet', exception: 'uploadExceptions', leave: 'uploadLeaves' }[kind];
      const res = await factoryPayrollApi[fn](file, selected.month, selected.year, department);
      setResult(res);
      setResultTitle({
        attendance: 'Kết quả import bảng chấm công',
        exception:  'Kết quả import lịch nghỉ',
        leave:      'Kết quả import đơn xin nghỉ',
      }[kind]);
      toast(`${status?.departmentLabel} · tháng ${selected.month}/${selected.year}: đã xử lý ${res?.matched ?? 0} dòng`, 'success');
      await loadStatus(selected);
    } catch (e) {
      toast(e?.response?.data?.message || e?.message || 'Lỗi tải file', 'error');
    } finally {
      setBusy(null);
    }
  };

  const remove = async (kind) => {
    if (!selected) return;
    setDeleting(kind);
    try {
      await factoryPayrollApi.deleteFile(kind, selected.month, selected.year, department);
      toast('Đã xoá file. Tải file mới rồi bấm "Hoàn tất" lại để tính theo file mới nhất.', 'success');
      await loadStatus(selected);
    } catch (e) {
      toast(e?.response?.data?.message || 'Lỗi xoá file', 'error');
    } finally {
      setDeleting(null);
    }
  };

  const template = async (kind) => {
    if (!selected) return;
    try {
      await factoryPayrollApi.downloadTemplate(kind, selected.month, selected.year, department);
    } catch {
      toast('Không tải được file mẫu', 'error');
    }
  };

  const uploadAdjustment = async (kind, file) => {
    if (!selected) return;
    setBusy(kind);
    try {
      const fn = kind === 'bonus'
        ? factoryPayrollApi.uploadBonus
        : factoryPayrollApi.uploadAllowance;
      const res = await fn(file, selected.month, selected.year, department);

      const errs = res?.errors || [];
      const warns = res?.warnings || [];

      // Với thưởng, con số đáng chú ý là "bỏ qua vì đã có" — đó là bằng chứng
      // rằng tải lại file cũ không ghi đè tiền của người cũ.
      const skipped = res?.skippedExisting ?? 0;
      toast(
        `Đã thêm ${res?.saved ?? 0} khoản`
          + (skipped ? ` · bỏ qua ${skipped} người đã có` : '')
          + (errs.length ? ` · ${errs.length} dòng lỗi` : ''),
        errs.length ? 'warning' : 'success'
      );
      // LUÔN mở modal kết quả để owner thấy chi tiết đã xử lý ai/không tìm thấy ai.
      setAdjResultTitle(kind === 'bonus' ? 'Kết quả import thưởng' : 'Kết quả import phụ cấp');
      setAdjResult(res);
      await loadAdjustments(selected, department);
    } catch (e) {
      toast(e?.response?.data?.message || 'Không import được file', 'error');
    } finally {
      setBusy(null);
    }
  };

  const clearBonusLabel = async (label) => {
    if (!selected) return;
    setDeletingLabel(label);
    try {
      await factoryPayrollApi.clearBonusLabel(selected.month, selected.year, label, department);
      toast(`Đã xoá khoản "${label}"`, 'success');
      await loadAdjustments(selected, department);
    } catch (e) {
      toast(e?.response?.data?.message || 'Không xoá được khoản thưởng', 'error');
    } finally {
      setDeletingLabel(null);
    }
  };

  const openPreview = async (type, label) => {
    if (!selected) return;
    setPreviewLoading(true);
    setPreview({ type, label, department, rows: [], rowCount: 0, totalAmount: 0 });
    try {
      const res = await factoryPayrollApi.adjustmentPreview(
        selected.month, selected.year, type, { label, department });
      setPreview(res || null);
    } catch (e) {
      toast(e?.response?.data?.message || 'Không tải được xem trước', 'error');
      setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const clearAdjustment = async (type) => {
    if (!selected) return;
    setDeleting(type.toLowerCase());
    try {
      await factoryPayrollApi.clearAdjustments(type, selected.month, selected.year, department);
      toast('Đã xoá dữ liệu đã import', 'success');
      await loadAdjustments(selected, department);
    } catch (e) {
      toast(e?.response?.data?.message || 'Không xoá được', 'error');
    } finally {
      setDeleting(null);
    }
  };

  const doFinalize = async () => {
    if (!selected) return;
    setFinalizing(true);
    try {
      await factoryPayrollApi.finalize(selected.month, selected.year, department);
      toast(`Đã hoàn tất lương ${status?.departmentLabel} tháng ${selected.month}/${selected.year}`, 'success');
      await loadStatus(selected);
    } catch (e) {
      toast(e?.response?.data?.message || 'Lỗi hoàn tất', 'error');
    } finally {
      setFinalizing(false);
    }
  };

  const doReopen = async () => {
    if (!selected) return;
    setFinalizing(true);
    try {
      await factoryPayrollApi.reopen(selected.month, selected.year, department);
      toast('Đã mở lại tháng — nhân viên sẽ thấy "Đang xử lý lương"', 'success');
      await loadStatus(selected);
    } catch (e) {
      toast(e?.response?.data?.message || 'Lỗi mở lại', 'error');
    } finally {
      setFinalizing(false);
    }
  };

  const recompute = async () => {
    if (!selected) return;
    const raw = String(securityRate).replace(/[^\d]/g, '');
    if (securityRate !== '' && raw === '')
      return toast('Mức thưởng bảo vệ không hợp lệ', 'error');

    setRecomputing(true);
    try {
      await factoryPayrollApi.recomputeKpi(
        selected.month, selected.year, raw === '' ? null : Number(raw));
      toast(`Đã tính lại thưởng KPI tháng ${selected.month}/${selected.year}`, 'success');
      await loadKpi(selected, department);
    } catch (e) {
      toast(e?.response?.data?.message || 'Lỗi tính lại KPI', 'error');
    } finally {
      setRecomputing(false);
    }
  };

  const period = selected ? `${String(selected.month).padStart(2, '0')}_${selected.year}` : '—';
  const attendanceBased = department !== 'DRIVER';

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <BackButton fallback="/owner/users" />

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <PageHeader icon={ClipboardCheck} title="Bảng chấm công"
          subtitle="Quản lý dữ liệu chấm công & chốt lương theo từng bộ phận — nhân viên xem phiếu lương sau khi bấm Hoàn tất" />
        <div className="flex items-center gap-2 flex-wrap">
          <MonthPicker periods={periods} value={selected} onChange={setSelected} disabled={loading} />
          <SecondaryButton onClick={() => loadStatus(selected)} disabled={loading}>
            <RefreshCw size={14} /> Làm mới
          </SecondaryButton>
        </div>
      </div>

      {loading ? (
        <SectionCard><LoadingSpinner label="Đang tải..." /></SectionCard>
      ) : !selected ? (
        <SectionCard>
          <p className="text-center text-sm text-muted py-10">Chưa chọn tháng</p>
        </SectionCard>
      ) : (
        <>
          {/* Tab bộ phận */}
          <DepartmentTabs statuses={statuses} value={department} onChange={setDepartment} />

          {/* Thanh trạng thái + nút HOÀN TẤT */}
          <SectionCard>
            <div className="flex items-center justify-between gap-4 px-5 py-4 flex-wrap">
              <div className="flex items-center gap-3 min-w-0">
                <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0
                  ${status?.finalized ? 'bg-emerald-100 dark:bg-emerald-500/18' : 'bg-amber-50 dark:bg-amber-500/10'}`}>
                  {status?.finalized
                    ? <Lock size={17} className="text-emerald-600 dark:text-emerald-300" />
                    : <Unlock size={17} className="text-amber-600 dark:text-amber-300" />}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-ink">
                    {status?.finalized ? 'Đã hoàn tất xử lý lương' : 'Chưa hoàn tất — nhân viên thấy "Đang xử lý lương"'}
                  </p>
                  <p className="text-[11px] text-muted mt-0.5">
                    {status?.departmentLabel} · {status?.employeeCount ?? 0} nhân viên
                    {status?.finalized && status?.finalizedAt
                      ? ` · chốt lúc ${formatDateTime(status.finalizedAt)}`
                      : ''}
                    {status?.finalizedByName ? ` bởi ${status.finalizedByName}` : ''}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <SecondaryButton onClick={() => setMembersOpen(true)}>
                  <Users size={14} /> Chi tiết bộ phận
                </SecondaryButton>
                {status?.finalized ? (
                  <SecondaryButton onClick={doReopen} disabled={finalizing}>
                    <Unlock size={14} /> Mở lại tháng
                  </SecondaryButton>
                ) : (
                  <PrimaryButton onClick={doFinalize} loading={finalizing}
                    disabled={!status?.canFinalize}>
                    <CheckCircle2 size={14} /> Hoàn tất
                  </PrimaryButton>
                )}
              </div>
            </div>

            {!status?.finalized && !status?.canFinalize && attendanceBased && (
              <p className="px-5 pb-4 text-[11px] text-amber-700 dark:text-amber-300">
                Cần tải lên bảng chấm công của bộ phận này trước khi bấm Hoàn tất.
              </p>
            )}
          </SectionCard>

          {attendanceBased ? (
            <>
              {/* Đường dẫn lưu trữ */}
              <div className="flex items-center gap-2 text-[11px] text-muted bg-canvas
                rounded-xl px-3.5 py-2.5">
                <FileSpreadsheet size={13} className="shrink-0" />
                <span>Cả 3 file của bộ phận này được lưu trong thư mục
                  <strong className="text-ink"> attendance/{period}/{department}/</strong></span>
              </div>

              {/* 2 khối file */}
              <div className="grid gap-4 lg:grid-cols-2">
                <FileSlot
                  icon={Clock}
                  title="Bảng chấm công"
                  description="File xuất từ máy chấm công, chứa giờ vào/ra từng ngày"
                  hint="Mỗi nhân viên là một block riêng có dòng Mã nhân viên / Tên nhân viên."
                  exists={status?.hasAttendanceFile}
                  fileName={status?.fileName}
                  uploadedAt={status?.uploadedAt}
                  rowCount={status?.parsedRows}
                  rowLabel="nhân viên"
                  uploading={busy === 'attendance'}
                  deleting={deleting === 'attendance'}
                  onUpload={f => upload('attendance', f)}
                  onDelete={() => remove('attendance')}
                />

                <FileSlot
                  icon={CalendarClock}
                  title="Lịch nghỉ / đi trễ / về sớm"
                  description="Áp dụng cho TOÀN BỘ nhân viên của bộ phận trong ngày được khai báo"
                  hint="Tải file mẫu, chọn Loại ở những ngày có ngoại lệ rồi tải lên."
                  exists={status?.hasExceptionFile}
                  fileName={status?.exceptionFileName}
                  uploadedAt={status?.exceptionUploadedAt}
                  rowCount={status?.exceptionRows}
                  rowLabel="ngày"
                  uploading={busy === 'exception'}
                  deleting={deleting === 'exception'}
                  onUpload={f => upload('exception', f)}
                  onDelete={() => remove('exception')}
                  onTemplate={() => template('exception')}
                />

                {/* Khối upload "Đơn xin đi trễ / nghỉ phép" đã được gỡ bỏ.
                    Đơn nay do nhân viên tự tạo trên app và OWNER duyệt ở tab
                    Nhân sự → Phiếu nghỉ → Đơn nhân viên; hệ thống tự khớp đơn
                    đã duyệt vào bảng chấm công khi tính công. Giữ lại ô upload
                    sẽ tạo ra nguồn sự thật thứ hai, và file tải lên sau sẽ ghi
                    đè kết quả duyệt trên app. */}
              </div>
            </>
          ) : (
            selected && (
              <DriverPayrollPanel
                month={selected.month}
                year={selected.year}
                onSaved={() => loadStatus(selected)}
              />
            )
          )}

          {/* ── THƯỞNG & PHỤ CẤP THEO THÁNG — DÙNG CHUNG CHO MỌI BỘ PHẬN ─────
              Hai khoản này KHÔNG cố định nên không nằm trong hồ sơ lương;
              OWNER import Excel riêng cho từng kỳ. Import lại = thay thế.
              Tài xế cũng có thể có phụ cấp cơm, phụ cấp điện thoại... nên
              vẫn hiển thị 2 slot dưới đây cho tab Tài xế. */}
          <div className="grid gap-4 lg:grid-cols-2">
            <AdjustmentSlot
              icon={Gift}
              title="Thưởng theo tháng"
              description="Nhiều khoản khác nhau — mỗi khoản một file, phân biệt bằng nhãn ở ô B2"
              hint={'Tải mẫu → gõ nhãn thưởng ở ô B2 → điền số tiền từng người → tải lên. '
                + 'Tải lại cùng nhãn CHỈ thêm người chưa có, không ghi đè số của người cũ — '
                + 'dùng khi vừa thêm nhân viên. Muốn sửa số đã nhập thì xoá khoản đó rồi tải lại.'}
              count={adjustments?.bonus}
              rowLabel="dòng"
              batches={bonusBatches}
              onDeleteBatch={clearBonusLabel}
              deletingLabel={deletingLabel}
              uploading={busy === 'bonus'}
              clearing={deleting === 'bonus'}
              onUpload={f => uploadAdjustment('bonus', f)}
              onClear={() => clearAdjustment('BONUS')}
              onTemplate={() => template('bonus')}
              onPreview={(type, label) => openPreview(type, label)}
            />

            <AdjustmentSlot
              icon={Wallet}
              title="Phụ cấp theo tháng"
              description={attendanceBased
                ? "Xăng xe, điện thoại… — chọn nhãn từ danh mục phụ cấp"
                : "Phụ cấp khác ngoài xăng xe & cơm trưa (điện thoại, chuyên cần…) — hệ thống đã tự tính xăng theo km và cơm theo ngày điểm danh"}
              hint={attendanceBased
                ? "Mỗi nhân viên tối đa 4 khoản. Phụ cấp cơm KHÔNG nhập ở đây, hệ thống tự tính theo ngày đi làm."
                : "Mỗi tài xế tối đa 4 khoản. Phụ cấp xăng xe & cơm trưa KHÔNG nhập ở đây — hệ thống tự tính."}
              count={adjustments?.allowance}
              rowLabel="khoản phụ cấp"
              uploading={busy === 'allowance'}
              clearing={deleting === 'allowance'}
              onUpload={f => uploadAdjustment('allowance', f)}
              onClear={() => clearAdjustment('ALLOWANCE')}
              onTemplate={() => template('allowance')}
              onPreview={() => openPreview('ALLOWANCE')}
            />
          </div>

          {/* Tổng hợp quỹ thưởng KPI — chỉ Xưởng và chỉ khi đã tính */}
          {department === 'FACTORY' && <KpiSummary kpi={kpi} />}

          {/* Khai báo quỹ dư của tháng chia ngoài app */}
          {department === 'FACTORY' && selected && (
            <CarryOverSeedPanel
              month={selected.month}
              year={selected.year}
              periodLabel={selected.label}
              onChanged={() => loadKpi(selected, department)}
            />
          )}

          {/* 2 bảng sau khi HOÀN TẤT */}
          {status?.finalized && <PayrollTables data={payroll} loading={loadingPayroll} />}

          {/* Ghi chú cách tính + tính lại KPI (chỉ Xưởng) */}
          {attendanceBased && (
            <SectionCard>
              <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-hairline">
                <h3 className="text-sm font-bold text-ink">Cách tính công</h3>
                {department === 'FACTORY' && (
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    {/* Mức thưởng bảo vệ — placeholder là mức mặc định 300.000đ.
                        Để trống thì backend giữ nguyên mức đã dùng cho tháng này,
                        nên bấm tính lại sau khi import chấm công không làm mất
                        con số OWNER đã chỉnh. */}
                    <label className="flex items-center gap-1.5 text-[11px] text-muted">
                      Thưởng bảo vệ
                      <input
                        type="text" inputMode="numeric"
                        value={securityRate}
                        onChange={e => setSecurityRate(formatVnInt(e.target.value))}
                        placeholder={kpi?.securityRate != null
                          ? Number(kpi.securityRate).toLocaleString('vi-VN')
                          : '300.000'}
                        className="w-24 px-2 py-1 rounded-lg border border-hairline-2 text-xs
                          text-right text-ink focus:outline-none focus:border-gold" />
                      đ/người
                    </label>
                    <button onClick={recompute} disabled={recomputing}
                      className="flex items-center gap-1.5 text-xs font-semibold text-gold
                        hover:underline disabled:opacity-50">
                      <Calculator size={13} />
                      {recomputing ? 'Đang tính...' : 'Tính lại thưởng KPI'}
                    </button>
                  </div>
                )}
              </div>
              <div className="px-5 py-4 grid gap-2.5 sm:grid-cols-2 text-[11px] text-ink-2">
                {[
                  ['Ca chuẩn', '08:00 – 17:00. Vào muộn hơn tính trễ, ra sớm hơn tính về sớm.'],
                  ['Nghỉ cả ngày', 'Đủ 1 công vô điều kiện, kể cả không chấm công.'],
                  ['Nghỉ nửa ngày – Sáng', 'Ca thu còn 13:30 – 17:00.'],
                  ['Nghỉ nửa ngày – Chiều', 'Ca thu còn 08:00 – 12:00.'],
                  ['Đi trễ có phép', 'Mốc 10:00 → vào 10:00 đủ công, vào 10:01 trễ 1 phút.'],
                  ['Về sớm có phép', 'Mốc 14:00 → ra 14:00 đủ công, ra 13:59 sớm 1 phút.'],
                  ['Thiếu giờ vào hoặc giờ ra', 'Không có ngoại lệ thì ngày đó 0 công.'],
                  ['Đơn cá nhân', 'Ghi đè lịch bộ phận. Chỉ trạng thái Đã duyệt mới có hiệu lực.'],
                  ['Nhân viên kiêm nhiệm', 'Chỉ tính ở bộ phận của ROLE NHẬN LƯƠNG, không nằm ở 2 bộ phận.'],
                  ['Đổi file sau khi hoàn tất', 'Xoá file cũ → tải file mới → bấm Hoàn tất lại để tính theo file mới nhất.'],
                ].map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <span className="text-gold shrink-0">•</span>
                    <span><strong className="text-ink">{k}</strong> — {v}</span>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {status?.note && (
            <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/28 rounded-xl px-4 py-3">
              <AlertCircle size={15} className="text-amber-600 dark:text-amber-300 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 dark:text-amber-300 leading-snug">{status.note}</p>
            </div>
          )}
        </>
      )}

      {result && (
        <ImportResultModal result={result} title={resultTitle} onClose={() => setResult(null)} />
      )}

      {adjResult && (
        <AdjustmentResultModal result={adjResult} title={adjResultTitle}
          onClose={() => setAdjResult(null)} />
      )}

      {/* Danh sách nhân sự của bộ phận đang chọn */}
      <DepartmentMembersModal
        open={membersOpen}
        department={department}
        departmentLabel={status?.departmentLabel}
        onClose={() => setMembersOpen(false)}
      />

      {/* Preview nội dung đã import — read-only */}
      {preview && (
        <AdjustmentPreviewModal
          preview={preview} loading={previewLoading}
          departmentLabel={status?.departmentLabel}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}

/** Modal xem lại nội dung đã import — CHỈ đọc, không sửa. */
function AdjustmentPreviewModal({ preview, loading, departmentLabel, onClose }) {
  const isBonus = preview?.type === 'BONUS';
  const title = isBonus
    ? `Xem lại file thưởng — ${preview?.label || '(không nhãn)'}`
    : 'Xem lại file phụ cấp';
  const headers = preview?.fileHeaders || [];
  const rows = preview?.fileRows || [];
  const hasFile = headers.length > 0 || rows.length > 0;

  // Với ALLOWANCE, pivot dạng "wide" (mỗi cặp Khoản/Số tiền là 1 cột) sang
  // "long" (mỗi khoản là 1 dòng riêng dưới nhân viên). Bỏ khoản trống.
  // Cấu trúc gốc: [ID, Họ tên, Khoản 1, Số tiền 1, Khoản 2, Số tiền 2, ...]
  const pivoted = !isBonus && hasFile
    ? rows.map(row => {
        const id = row[0] || '';
        const name = row[1] || '';
        const items = [];
        for (let c = 2; c + 1 < row.length; c += 2) {
          const label = (row[c] || '').trim();
          const amount = (row[c + 1] || '').trim();
          if (label || amount) items.push({ label, amount });
        }
        return { id, name, items };
      }).filter(r => r.id || r.name || r.items.length > 0)
    : null;

  return (
    <div className="fixed inset-0 z-[95] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
      <div className="bg-surface rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-hairline">
          <div className="min-w-0">
            <p className="font-bold text-ink text-base sm:text-lg truncate">{title}</p>
            <p className="text-xs text-muted truncate">
              {departmentLabel || '—'}
              {preview?.fileName && <> · <span className="font-mono">{preview.fileName}</span></>}
              {' · '}Tổng {formatCurrency(preview?.totalAmount || 0)}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-canvas text-muted shrink-0">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {loading ? <LoadingSpinner /> : !hasFile ? (
            <EmptyState title="Không có file gốc"
              description="Khoản này được import trước khi hệ thống bắt đầu lưu file gốc. Import lại để có preview." />
          ) : pivoted ? (
            // ── Bảng dọc cho PHỤ CẤP: mỗi khoản có data là 1 dòng riêng ─────
            <div className="overflow-auto rounded-xl border border-hairline">
              <table className="w-full text-xs border-collapse">
                <thead className="bg-canvas sticky top-0">
                  <tr>
                    <th className="px-2 py-1.5 text-[10px] font-bold text-muted border-b border-r border-hairline w-10">#</th>
                    <th className="px-3 py-1.5 text-left text-[11px] font-bold text-ink border-b border-hairline w-16">ID</th>
                    <th className="px-3 py-1.5 text-left text-[11px] font-bold text-ink border-b border-hairline">Họ tên</th>
                    <th className="px-3 py-1.5 text-left text-[11px] font-bold text-ink border-b border-hairline">Khoản phụ cấp</th>
                    <th className="px-3 py-1.5 text-right text-[11px] font-bold text-ink border-b border-hairline w-32">Số tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {pivoted.map((p, r) => {
                    // Không có khoản nào → vẫn hiện 1 dòng với "—"
                    const items = p.items.length > 0 ? p.items : [{ label: '', amount: '' }];
                    return items.map((it, i) => (
                      <tr key={`${r}-${i}`} className="hover:bg-canvas/60">
                        {i === 0 && (
                          <>
                            <td rowSpan={items.length}
                              className="px-2 py-1.5 text-[10px] text-muted border-b border-r border-hairline text-center bg-canvas/40 align-top">
                              {r + 1}
                            </td>
                            <td rowSpan={items.length}
                              className="px-3 py-1.5 text-ink border-b border-hairline align-top font-medium">
                              {p.id || <span className="text-muted italic">—</span>}
                            </td>
                            <td rowSpan={items.length}
                              className="px-3 py-1.5 text-ink border-b border-hairline align-top">
                              {p.name || <span className="text-muted italic">—</span>}
                            </td>
                          </>
                        )}
                        <td className="px-3 py-1.5 text-ink border-b border-hairline whitespace-nowrap">
                          {it.label || <span className="text-muted italic">—</span>}
                        </td>
                        <td className="px-3 py-1.5 text-ink border-b border-hairline whitespace-nowrap text-right font-semibold">
                          {it.amount
                            ? <>{it.amount}<span className="text-muted">đ</span></>
                            : <span className="text-muted italic">—</span>}
                        </td>
                      </tr>
                    ));
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            // ── Bảng ngang cho THƯỞNG: giữ layout gốc (ID | Họ tên | Số tiền) ──
            <div className="overflow-auto rounded-xl border border-hairline">
              <table className="w-full text-xs border-collapse">
                <thead className="bg-canvas sticky top-0">
                  <tr>
                    <th className="px-2 py-1.5 text-[10px] font-bold text-muted border-b border-r border-hairline w-10">#</th>
                    {headers.map((h, i) => {
                      const isMoney = i === headers.length - 1;   // cột "Số tiền thưởng"
                      return (
                        <th key={i}
                          className={`px-3 py-1.5 text-[11px] font-bold text-ink border-b border-hairline whitespace-nowrap ${
                            isMoney ? 'text-right' : 'text-left'}`}>
                          {h || <span className="text-muted italic">Cột {String.fromCharCode(65 + i)}</span>}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, r) => (
                    <tr key={r} className="hover:bg-canvas/60">
                      <td className="px-2 py-1.5 text-[10px] text-muted border-b border-r border-hairline text-center bg-canvas/40">
                        {r + 1}
                      </td>
                      {row.map((cell, c) => {
                        const isMoney = c === row.length - 1;
                        return (
                          <td key={c}
                            className={`px-3 py-1.5 text-ink border-b border-hairline whitespace-nowrap ${
                              isMoney ? 'text-right font-semibold' : ''}`}>
                            {cell
                              ? (isMoney ? <>{cell}<span className="text-muted">đ</span></> : cell)
                              : <span className="text-muted italic">—</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}