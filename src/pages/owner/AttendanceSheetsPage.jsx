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
  PiggyBank, Plus, X, Search,
} from 'lucide-react';
import { factoryPayrollApi } from '../../api/factoryPayrollApi';
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
        className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-white border border-black/10
          shadow-sm hover:border-[#C9A84C]/50 transition-colors disabled:opacity-50 min-w-[190px]">
        <CalendarDays size={16} className="text-[#C9A84C] shrink-0" />
        <span className="flex-1 text-left text-sm font-bold text-[#1C1C1E]">
          {current?.label || 'Chọn tháng'}
        </span>
        <ChevronDown size={15} className={`text-[#8E8878] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute z-30 mt-2 w-full min-w-[220px] max-h-[360px] overflow-y-auto
            bg-white rounded-2xl border border-black/10 shadow-xl p-2">
            {Object.entries(grouped).sort((a, b) => b[0] - a[0]).map(([year, items]) => (
              <div key={year} className="mb-1 last:mb-0">
                <p className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[#8E8878]">
                  Năm {year}
                </p>
                {items.map(p => {
                  const active = p.month === value?.month && p.year === value?.year;
                  return (
                    <button key={`${p.year}-${p.month}`}
                      onClick={() => { onChange(p); setOpen(false); }}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl
                        text-sm transition-colors
                        ${active ? 'bg-[#C9A84C] text-white font-bold' : 'text-[#1C1C1E] hover:bg-[#FAF7F2]'}`}>
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
          <p className="text-xs text-[#8E8878]">{data.total} nhân viên</p>
          <Table>
            <Thead>
              <Tr className="bg-[#FAF7F2] text-[#8E8878]">
                <Th>Nhân viên</Th>
                <Th>Chức vụ</Th>
                <Th>Chức danh trả lương</Th>
              </Tr>
            </Thead>
            <tbody>
              {members.map(m => (
                <Tr key={m.userId}>
                  <Td>
                    <div className="font-medium text-[#1C1C1E]">{m.fullName}</div>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {!m.hasSalary && (
                        <span className="text-[10px] font-semibold text-amber-700 bg-amber-50
                          border border-amber-200 rounded px-1.5 py-0.5">
                          chưa có hồ sơ lương
                        </span>
                      )}
                      {m.attendanceExempt && (
                        <span className="text-[10px] font-semibold text-[#8E8878] bg-[#FAF7F2]
                          border border-black/10 rounded px-1.5 py-0.5">
                          không chấm công
                        </span>
                      )}
                    </div>
                  </Td>
                  <Td className="text-[#1C1C1E]">
                    {m.position || <span className="text-[#C4B9A8]">—</span>}
                    {m.division && (
                      <div className="text-[11px] text-[#8E8878]">{m.division}</div>
                    )}
                  </Td>
                  {/* Lệch với cột Chức vụ nghĩa là người này đang được tính lương
                      ở bộ phận khác với hồ sơ — đáng để OWNER để ý. */}
                  <Td className="text-[#8E8878]">{m.roleLabel || '—'}</Td>
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
                ? 'bg-[#1C1C1E] text-white border-[#1C1C1E]'
                : 'bg-white text-[#1C1C1E] border-black/10 hover:border-[#C9A84C]/50'}`}>
            {(() => {
              // Bộ phận Quản lý (OWNER/ADMIN) và Tài xế có biểu tượng riêng để
              // phân biệt nhanh với các bộ phận nhân viên thông thường.
              const Icon = s.department === 'DRIVER' ? Truck
                : s.department === 'MANAGEMENT' ? ShieldCheck
                : Users;
              return <Icon size={14} className={active ? 'text-[#C9A84C]' : 'text-[#8E8878]'} />;
            })()}
            <span>{s.departmentLabel}</span>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md
              ${active ? 'bg-white/15 text-white/80' : 'bg-[#FAF7F2] text-[#8E8878]'}`}>
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
      ${exists ? 'border-emerald-200 bg-emerald-50/30' : 'border-black/10 bg-white'}`}>

      <div className="flex items-start gap-3 px-4 py-3.5 border-b border-black/5">
        <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0
          ${exists ? 'bg-emerald-100' : 'bg-[#FAF7F2]'}`}>
          <Icon size={16} className={exists ? 'text-emerald-600' : 'text-[#8E8878]'} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-[#1C1C1E] leading-tight">{title}</p>
          <p className="text-[11px] text-[#8E8878] mt-0.5 leading-snug">{description}</p>
        </div>
        {exists && (
          <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg
            bg-emerald-100 text-emerald-700 shrink-0">
            <CheckCircle2 size={11} /> Đã có
          </span>
        )}
      </div>

      {exists && (
        <div className="px-4 py-2.5 bg-white/60 border-b border-black/5">
          <p className="text-[11px] text-[#5A5548] truncate" title={fileName}>{fileName || '—'}</p>
          <p className="text-[10px] text-[#8E8878] mt-0.5">
            {uploadedAt ? formatDateTime(uploadedAt) : '—'}
            {rowCount != null && ` · ${rowCount} ${rowLabel}`}
          </p>
        </div>
      )}

      <div className="px-4 py-3 space-y-2">
        {hint && !exists && <p className="text-[10px] text-[#8E8878] leading-snug">{hint}</p>}

        <div className="flex gap-2">
          {onTemplate && (
            <button onClick={onTemplate}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[11px]
                font-semibold bg-white border border-black/10 text-[#1C1C1E]
                hover:bg-[#FAF7F2] transition-colors shrink-0">
              <Download size={12} /> Tải mẫu
            </button>
          )}

          {!exists ? (
            <label className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl
              text-[11px] font-bold text-white transition-colors
              ${uploading ? 'bg-[#C4B9A8] cursor-wait' : 'bg-[#C9A84C] hover:bg-[#A07830] cursor-pointer'}`}>
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
                text-[11px] font-bold bg-white border border-red-200 text-red-600
                hover:bg-red-50 transition-colors disabled:opacity-50">
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
            { label: 'NV trong file', value: result.blocksInFile ?? 0, color: 'text-[#1C1C1E]' },
            { label: 'NV bộ phận', value: result.departmentEmployees ?? 0, color: 'text-[#1C1C1E]' },
            { label: 'Đã khớp', value: result.matched ?? 0, color: 'text-emerald-600' },
            { label: 'Thiếu', value: result.skipped ?? 0, color: 'text-amber-600' },
          ].map(s => (
            <div key={s.label} className="bg-[#FAF7F2] rounded-xl px-2 py-2.5 text-center">
              <p className="text-[10px] text-[#8E8878] font-semibold leading-tight">{s.label}</p>
              <p className={`text-xl font-bold mt-0.5 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {result.departmentLabel && (
          <p className="text-[11px] text-[#8E8878]">
            Bộ phận: <strong className="text-[#1C1C1E]">{result.departmentLabel}</strong>
            {' · '}Tháng {result.month}/{result.year}
          </p>
        )}

        {result.skipped > 0 && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
            <AlertCircle size={14} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-800 leading-snug">
              File thiếu dữ liệu của <strong>{result.skipped} nhân viên</strong> —
              xem danh sách ở tab "Thiếu". Những người này sẽ được ghi nhận 0 công cho tháng.
            </p>
          </div>
        )}

        {tabs.length > 1 && (
          <div className="flex gap-1 bg-[#FAF7F2] rounded-xl p-1">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold transition-colors
                  ${tab === t.id ? 'bg-white text-[#1C1C1E] shadow-sm' : 'text-[#8E8878] hover:text-[#1C1C1E]'}`}>
                {t.label}
              </button>
            ))}
          </div>
        )}

        <div className="max-h-52 overflow-y-auto rounded-xl border border-black/5 divide-y divide-black/5">
          {tab === 'matched' && (matched.length === 0
            ? <p className="text-[11px] text-[#8E8878] text-center py-6">Không có dữ liệu</p>
            : matched.map((r, i) => (
              <div key={r.userId ?? i} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#1C1C1E] truncate">{r.fullName}</p>
                  <p className="text-[10px] text-[#8E8878] truncate">
                    {r.roleLabel || '—'}
                    {r.employeeCode ? ` · mã ${r.employeeCode}` : ''}
                    {r.matchedBy ? ` · khớp theo ${MATCH_LABEL[r.matchedBy] || r.matchedBy}` : ''}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-bold text-emerald-600">{r.actualDays ?? 0} công</p>
                  <p className="text-[10px] text-[#8E8878]">{r.presentDays ?? 0} ngày chấm</p>
                </div>
              </div>
            )))}

          {tab === 'unmatched' && (unmatched.length === 0
            ? <p className="text-[11px] text-emerald-700 text-center py-6">
                Không có ai bị bỏ sót — file đủ toàn bộ nhân viên của bộ phận.
              </p>
            : unmatched.map((r, i) => (
              <div key={r.userId ?? i} className="px-3 py-2.5">
                <p className="text-xs font-semibold text-[#1C1C1E]">{r.fullName}</p>
                <p className="text-[10px] text-[#8E8878]">
                  {r.roleLabel || 'Không tìm thấy trong hệ thống'}
                </p>
              </div>
            )))}

          {tab === 'unused' && unused.map((u, i) => (
            <p key={i} className="px-3 py-2 text-[11px] text-[#5A5548]">{u}</p>
          ))}
        </div>

        {result.errors?.length > 0 && (
          <details className="bg-[#FAF7F2] rounded-xl px-3 py-2.5">
            <summary className="text-[11px] font-semibold text-[#8E8878] cursor-pointer">
              {result.errors.length} cảnh báo khi đọc file
            </summary>
            <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
              {result.errors.map((e, i) => (
                <p key={i} className="text-[10px] text-amber-700 leading-snug">{e}</p>
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

  const errors = result.errors || [];
  const warnings = result.warnings || [];

  return (
    <Modal open onClose={onClose} title={title} size="md">
      <div className="space-y-3 py-1">
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200
          rounded-xl px-4 py-3">
          <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
          <p className="text-xs text-emerald-800">
            Đã lưu <strong>{result.saved ?? 0}</strong> khoản
            {result.label ? <> · nhãn <strong>{result.label}</strong></> : null}
            {result.totalAmount > 0 && <> · tổng <strong>{formatCurrency(result.totalAmount)}</strong></>}
          </p>
        </div>

        {errors.length > 0 && (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-red-600 mb-1.5">
              Dòng bị bỏ qua ({errors.length})
            </p>
            <div className="space-y-1 max-h-52 overflow-y-auto">
              {errors.map((e, i) => (
                <p key={i} className="text-[11px] text-red-800 bg-red-50 border border-red-200
                  rounded-lg px-3 py-2 leading-snug">{e}</p>
              ))}
            </div>
          </div>
        )}

        {warnings.length > 0 && (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-amber-600 mb-1.5">
              Cảnh báo ({warnings.length})
            </p>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {warnings.map((w, i) => (
                <p key={i} className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200
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
                          batches, onDeleteBatch, deletingLabel }) {
  const fileRef = useRef(null);
  const has = (count ?? 0) > 0;

  return (
    <div className={`rounded-2xl border overflow-hidden transition-colors
      ${has ? 'border-emerald-200 bg-emerald-50/30' : 'border-black/10 bg-white'}`}>

      <div className="flex items-start gap-3 px-4 py-3.5 border-b border-black/5">
        <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0
          ${has ? 'bg-emerald-100' : 'bg-[#FAF7F2]'}`}>
          <Icon size={16} className={has ? 'text-emerald-600' : 'text-[#8E8878]'} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-[#1C1C1E] leading-tight">{title}</p>
          <p className="text-[11px] text-[#8E8878] mt-0.5 leading-snug">{description}</p>
        </div>
        {has && (
          <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg
            bg-emerald-100 text-emerald-700 shrink-0">
            <CheckCircle2 size={11} /> {count} {rowLabel}
          </span>
        )}
      </div>

      <div className="px-4 py-3.5 space-y-3">
        <p className="text-[11px] text-[#8E8878] leading-relaxed">{hint}</p>

        {/* Liệt kê TỪNG KHOẢN đã tải lên. Một tháng có thể có nhiều khoản
            thưởng khác nhau, mỗi khoản một file; chỉ hiện con số tổng thì
            OWNER không biết đã tải những khoản nào và thiếu khoản nào. */}
        {Array.isArray(batches) && batches.length > 0 && (
          <div className="space-y-1.5">
            {batches.map(b => (
              <div key={b.label}
                className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-white border border-black/10">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-[#1C1C1E] truncate">{b.label}</p>
                  <p className="text-[10px] text-[#8E8878]">
                    {b.employeeCount} người · {formatCurrency(b.totalAmount)}
                  </p>
                </div>
                {onDeleteBatch && (
                  <button
                    onClick={() => onDeleteBatch(b.label)}
                    disabled={deletingLabel === b.label}
                    title={`Xoá khoản "${b.label}"`}
                    className="p-1.5 rounded-lg text-[#8E8878] hover:text-red-600 hover:bg-red-50
                      transition-colors shrink-0 disabled:opacity-50">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
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
              text-red-500 hover:text-red-600 py-1.5 rounded-lg hover:bg-red-50
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
      <div className="flex items-center gap-2 px-5 py-4 border-b border-black/5">
        <Calculator size={16} className="text-[#C9A84C]" />
        <h3 className="text-sm font-bold text-[#1C1C1E]">Quỹ thưởng KPI sản xuất</h3>
      </div>
      <div className="p-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(c => (
          <div key={c.label}
            className={`rounded-xl px-4 py-3 border
              ${c.gold ? 'bg-[#C9A84C]/10 border-[#C9A84C]/25' : 'bg-[#FAF7F2] border-transparent'}`}>
            <p className="text-[11px] text-[#8E8878] font-medium">{c.label}</p>
            <p className={`text-lg font-bold mt-0.5 leading-tight
              ${c.gold ? 'text-[#C9A84C]' : 'text-[#1C1C1E]'}`}>{c.value}</p>
            {c.sub && <p className="text-[10px] text-[#8E8878] mt-1 leading-snug">{c.sub}</p>}
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
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-black/5">
        <div className="flex items-center gap-2 min-w-0">
          <PiggyBank size={16} className="text-[#C9A84C] shrink-0" />
          <h3 className="text-sm font-bold text-[#1C1C1E] truncate">
            Quỹ dư khai báo tay {periodLabel ? `— ${periodLabel}` : ''}
          </h3>
        </div>

        <button
          type="button"
          onClick={() => setAdding(v => !v)}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-black/10
                     text-xs font-semibold text-[#1C1C1E] hover:border-[#C9A84C]/50 hover:text-[#C9A84C] transition"
        >
          {adding ? <><X size={14} /> Đóng</> : <><Plus size={14} /> Thêm khoản dư</>}
        </button>
      </div>

      <div className="p-5 space-y-4">
        <p className="text-xs text-[#8E8878] leading-relaxed">
          Dùng khi tháng trước đã chia thưởng <b>ngoài app</b> và còn dư — hệ thống
          không có bản ghi nào của tháng đó để kế thừa quỹ dư. Khoản khai báo ở đây
          sẽ được cộng vào quỹ chia của kỳ đang chọn.
          {' '}<b className="text-[#1C1C1E]">Chỉ khai báo cho một tháng duy nhất</b>;
          phần chưa tiêu hết sẽ tự chuyển tiếp cho các tháng sau như bình thường.
        </p>

        {adding && (
          <div className="rounded-2xl border border-[#C9A84C]/30 bg-[#FDF8ED] p-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="block text-[11px] font-semibold text-[#8E8878] mb-1">
                  Tháng phát sinh
                </label>
                <div className="flex gap-2">
                  <input type="number" min={1} max={12} value={form.sourceMonth}
                    onChange={e => setForm(f => ({ ...f, sourceMonth: e.target.value }))}
                    className="w-16 px-2.5 py-2 rounded-xl border border-black/10 text-sm
                               focus:outline-none focus:border-[#C9A84C]" />
                  <input type="number" value={form.sourceYear}
                    onChange={e => setForm(f => ({ ...f, sourceYear: e.target.value }))}
                    className="w-24 px-2.5 py-2 rounded-xl border border-black/10 text-sm
                               focus:outline-none focus:border-[#C9A84C]" />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#8E8878] mb-1">
                  Số tiền dư (VNĐ)
                </label>
                <input type="text" inputMode="numeric" value={form.amount}
                  placeholder="VD 513000"
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-black/10 text-sm
                             focus:outline-none focus:border-[#C9A84C]" />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#8E8878] mb-1">
                  Ghi chú
                </label>
                <input type="text" value={form.note}
                  placeholder="Chốt tay theo phiếu thưởng"
                  onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-black/10 text-sm
                             focus:outline-none focus:border-[#C9A84C]" />
              </div>
            </div>

            <button onClick={submit} disabled={saving}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#C9A84C] text-white text-sm
                         font-semibold hover:bg-[#B8923E] transition disabled:opacity-50">
              {saving ? 'Đang lưu...' : 'Lưu khoản dư'}
            </button>
          </div>
        )}

        {loading ? (
          <LoadingSpinner label="Đang tải..." />
        ) : !rows.length ? (
          <p className="text-xs text-[#C4B9A8] py-2">
            Chưa khai báo khoản dư nào cho kỳ này.
          </p>
        ) : (
          <div className="space-y-2">
            {rows.map(r => (
              <div key={r.id}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#FAF7F2] border border-black/5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-[#1C1C1E]">
                    {formatCurrency(r.amount)}
                    <span className="text-xs font-medium text-[#8E8878]"> · nguồn {r.sourceLabel}</span>
                  </p>
                  <p className="text-[11px] text-[#8E8878] mt-0.5 truncate">
                    {r.note || 'Không có ghi chú'}
                    {r.createdBy ? ` — ${r.createdBy}` : ''}
                  </p>
                </div>
                <button onClick={() => remove(r)} title="Xoá khoản này"
                  className="shrink-0 p-2 rounded-lg text-[#C4B9A8] hover:text-red-500 hover:bg-red-50 transition">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}

            <div className="flex justify-between items-center px-4 pt-2">
              <span className="text-xs font-semibold text-[#8E8878]">Tổng khai báo tay</span>
              <span className="text-sm font-bold text-[#C9A84C]">{formatCurrency(total)}</span>
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
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 m-1">
          <AlertCircle size={15} className="text-red-600 shrink-0 mt-0.5" />
          <p className="text-xs text-red-800 leading-relaxed">{error}</p>
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

  const Stat = ({ label, value, tone = 'text-[#1C1C1E]', hint }) => (
    <div className="min-w-0 sm:min-w-[120px]">
      <p className="text-[10px] font-semibold text-[#8E8878] uppercase tracking-wider">{label}</p>
      <p className={`text-sm font-bold mt-0.5 ${tone}`}>{value}</p>
      {hint && <p className="text-[10px] text-[#C4B9A8] mt-0.5">{hint}</p>}
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
            <Stat label="Tổng tiền thưởng" value={formatCurrency(data.kpiBonusPool)} tone="text-[#C9A84C]" />
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

        <Stat label="Tổng NET" value={formatCurrency(data.totalNetSalary)} tone="text-emerald-700" />

        {kpiReady && (
          <Stat label="Tổng KPI" value={formatCurrency(data.totalKpiBonus)} tone="text-[#C9A84C]" />
        )}
      </div>

      {data.hasKpiBonus && !data.kpiComputed && (
        <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 inline-block">
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
      <p className="text-[10px] font-semibold text-[#8E8878] uppercase tracking-wider">{label}</p>
      <p className={`text-sm font-bold mt-0.5 ${tone || 'text-[#1C1C1E]'}`}>{value}</p>
      {sub && <p className="text-[11px] text-[#8E8878] mt-0.5">{sub}</p>}
    </div>
  );

  return (
    <div
      id={`payroll-card-${r.userId}`}
      className={`rounded-2xl border px-4 py-4 space-y-3 transition-colors
        ${highlight
          ? 'border-[#C9A84C] bg-[#C9A84C]/10 shadow-sm'
          : 'border-black/10 bg-white'}`}
    >
      {/* Header — gạch dưới để tách hẳn khỏi phần số liệu */}
      <div className="pb-2.5 border-b border-black/5">
        <p className="font-semibold text-[#1C1C1E] leading-snug">{r.userFullName}</p>
        <p className="text-xs text-[#8E8878]">
          {r.roleLabel || '—'}
          {r.salaryStatus === 'NO_SALARY' && (
            <span className="ml-1.5 text-amber-600 font-semibold">· chưa có hồ sơ lương</span>
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
            tone={shortfall(r) ? 'text-amber-700' : ''}
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
            tone="text-[#C9A84C]"
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
                border border-black/10 bg-white text-[11px] font-semibold text-[#5A5548]
                active:bg-[#FAF7F2] transition-colors"
            >
              <Receipt size={13} className="text-[#C9A84C]" />
              Chi tiết lương
            </button>
          )}

          {showAttendanceBtn && (
            <button
              type="button"
              onClick={onAttendance}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl
                border border-black/10 bg-white text-[11px] font-semibold text-[#5A5548]
                active:bg-[#FAF7F2] transition-colors"
            >
              <Clock size={13} className="text-[#C9A84C]" />
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
        <div className="px-5 py-4 border-b border-black/5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <Receipt size={16} className="text-[#C9A84C] shrink-0" />
              <h3 className="text-sm font-bold text-[#1C1C1E]">
                Phiếu lương — {data.departmentLabel} · {data.periodLabel}
              </h3>
            </div>

            {/* Ô tìm cố định — ẩn trên mobile, nơi đó dùng nút nổi bên dưới */}
            <div className="hidden md:block relative shrink-0">
              <Search size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#C4B9A8] pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Tìm theo tên nhân viên..."
                className="w-56 lg:w-64 pl-8 pr-8 py-2 rounded-xl border border-black/10 text-xs
                           focus:outline-none focus:border-[#C9A84C] transition-colors"
              />
              {query && (
                <button onClick={() => setQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md
                             text-[#C4B9A8] hover:text-[#1C1C1E]">
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          <PayrollSummary data={data} />

          {query && (
            <p className="text-[11px] text-[#8E8878] mt-2.5">
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
                  className={isMatch(r) ? 'bg-[#C9A84C]/12' : ''}
                >
                  <Td>
                    <div className="font-medium">{r.userFullName}</div>
                    <div className="text-xs text-[#8E8878]">
                      {r.roleLabel || '—'}
                      {r.salaryStatus === 'NO_SALARY' && (
                        <span className="ml-1.5 text-amber-600 font-semibold">· chưa có hồ sơ lương</span>
                      )}
                    </div>
                  </Td>
                  {/* NGƯỜI KHOÁN TRỌN THÁNG (bảo vệ xưởng — hợp đồng thuê ngoài):
                      gộp 2 cột làm một. Lương thực tế luôn bằng lương cơ bản vì
                      không chia theo chấm công, tách ra chỉ lặp lại một con số. */}
                  {flatPay(r) ? (
                    <Td right colSpan={2}>
                      <div>{formatCurrency(r.baseSalary)}</div>
                      <div className="text-[11px] text-[#8E8878]">Khoán trọn tháng</div>
                    </Td>
                  ) : (
                    <>
                      {/* Lương cơ bản NGUYÊN MỨC — chưa chia theo chấm công.
                          standardBaseSalary chỉ có ở bản ghi mới; bản ghi cũ rơi
                          về baseSalary để bảng không hiện ô trống. */}
                      <Td right>{formatCurrency(r.standardBaseSalary ?? r.baseSalary)}</Td>

                      {/* Lương thực tế + số ngày công ở dòng dưới */}
                      <Td right>
                        <div className={shortfall(r) ? 'text-amber-700 font-semibold' : ''}>
                          {formatCurrency(r.baseSalary)}
                        </div>
                        <div className="text-[11px] text-[#8E8878]">
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
                    <Td right><span className="text-[#C9A84C] font-semibold">
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
                            border border-black/10 bg-white text-[11px] font-semibold text-[#5A5548]
                            hover:border-[#C9A84C]/60 hover:text-[#1C1C1E] transition-colors"
                        >
                          <Clock size={13} className="text-[#C9A84C]" />
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
                            border border-black/10 bg-white text-[11px] font-semibold text-[#5A5548]
                            hover:border-[#C9A84C]/60 hover:text-[#1C1C1E] transition-colors
                            disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Receipt size={13} className="text-[#C9A84C]" />
                          Chi tiết lương
                        </button>
                      )}

                      {flatPay(r) && (
                        <span className="text-[11px] text-[#C4B9A8] italic">Hợp đồng thuê ngoài</span>
                      )}
                    </div>
                  </Td>
                </Tr>
              ))}
              {rows.length === 0 && (
                <Tr><Td className="text-center text-[#8E8878] py-8">
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
            <p className="text-center text-sm text-[#8E8878] py-10">
              Bộ phận này chưa có nhân viên nào
            </p>
          )}
        </div>
      </SectionCard>

      {/* ── BẢNG 2: CHỈ CÒN CHO TÀI XẾ — số km chạy theo tháng ──────────────
          Bảng "Chi tiết ngày công" của các bộ phận chấm công đã được BỎ: nó chỉ
          hiện số tổng, trùng thông tin và không xem được từng ngày. Thay bằng
          nút "Chi tiết ngày công" ở mỗi dòng Phiếu lương phía trên. */}
      {isDriver && (
        <SectionCard>
          <div className="flex items-center gap-2 px-5 py-4 border-b border-black/5">
            <Route size={16} className="text-[#C9A84C]" />
            <h3 className="text-sm font-bold text-[#1C1C1E]">
              Chi tiết số km theo tháng — {data.periodLabel}
            </h3>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <Thead>
                <Tr>
                  <Th>Tài xế</Th>
                  <Th right>Tổng km</Th>
                  <Th right>Số đơn đã giao</Th>
                </Tr>
              </Thead>
              <tbody>
                {rows.map(r => (
                  <Tr key={r.userId}>
                    <Td>
                      <div className="font-medium">{r.userFullName}</div>
                      <div className="text-xs text-[#8E8878]">{r.roleLabel || '—'}</div>
                    </Td>
                    <Td right><span className="font-semibold text-[#C9A84C]">
                      {fmtNum(r.totalKm, 1)} km</span></Td>
                    <Td right>{r.totalOrders ?? 0}</Td>
                  </Tr>
                ))}
                {rows.length === 0 && (
                  <Tr><Td className="text-center text-[#8E8878] py-8">Không có dữ liệu</Td></Tr>
                )}
              </tbody>
            </Table>
          </div>
        </SectionCard>
      )}

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
                className="w-52 pl-3 pr-8 py-3 rounded-2xl border border-black/10 bg-white
                           text-sm shadow-lg focus:outline-none focus:border-[#C9A84C]"
              />
              {query && (
                <button onClick={() => setQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-[#C4B9A8]">
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
            className="shrink-0 rounded-full bg-gradient-to-br from-[#C9A84C] to-[#A07830]
                       text-white shadow-lg shadow-[#C9A84C]/30 flex items-center justify-center
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

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg
                      max-h-[88vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/5 shrink-0">
          <h3 className="font-bold text-[#1C1C1E] text-sm">
            Chi tiết lương — {row.userFullName}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[#8E8878] hover:bg-[#FAF7F2]">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto">
          {row.salaryDetail
            ? <SalaryBreakdownCards row={row.salaryDetail} />
            : <p className="text-sm text-[#8E8878] text-center py-8">
                Nhân viên chưa có hồ sơ lương được duyệt.
              </p>}
        </div>

        <div className="px-5 py-4 border-t border-black/5 shrink-0">
          <button onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-[#FAF7F2] text-sm font-semibold
                       text-[#1C1C1E] hover:bg-[#F0EBE3] transition">
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
  const loadAdjustments = useCallback(async (p) => {
    if (!p) { setAdjustments(null); setBonusBatches([]); return; }
    try {
      setAdjustments(await factoryPayrollApi.adjustmentStatus(p.month, p.year));
    } catch {
      setAdjustments(null);
    }
    try {
      const b = await factoryPayrollApi.bonusBatches(p.month, p.year);
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

  useEffect(() => { loadAdjustments(selected); }, [selected, loadAdjustments]);
  useEffect(() => { loadKpi(selected, department); }, [selected, department, loadKpi]);

  // ── Nạp 2 bảng lương khi đã HOÀN TẤT ──────────────────────────────────────
  const loadPayroll = useCallback(async (p, dept, finalized) => {
    if (!p || !finalized) { setPayroll(null); return; }
    setLoadingPayroll(true);
    try {
      setPayroll(await factoryPayrollApi.departmentPayroll(p.month, p.year, dept));
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
      const res = await fn(file, selected.month, selected.year);

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
      // Lỗi/cảnh báo theo dòng hiện trong modal chung với các import khác
      if (errs.length || warns.length) {
        setAdjResultTitle(kind === 'bonus' ? 'Kết quả import thưởng' : 'Kết quả import phụ cấp');
        setAdjResult(res);
      }
      await loadAdjustments(selected);
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
      await factoryPayrollApi.clearBonusLabel(selected.month, selected.year, label);
      toast(`Đã xoá khoản "${label}"`, 'success');
      await loadAdjustments(selected);
    } catch (e) {
      toast(e?.response?.data?.message || 'Không xoá được khoản thưởng', 'error');
    } finally {
      setDeletingLabel(null);
    }
  };

  const clearAdjustment = async (type) => {
    if (!selected) return;
    setDeleting(type.toLowerCase());
    try {
      await factoryPayrollApi.clearAdjustments(type, selected.month, selected.year);
      toast('Đã xoá dữ liệu đã import', 'success');
      await loadAdjustments(selected);
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
          <p className="text-center text-sm text-[#8E8878] py-10">Chưa chọn tháng</p>
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
                  ${status?.finalized ? 'bg-emerald-100' : 'bg-amber-50'}`}>
                  {status?.finalized
                    ? <Lock size={17} className="text-emerald-600" />
                    : <Unlock size={17} className="text-amber-600" />}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[#1C1C1E]">
                    {status?.finalized ? 'Đã hoàn tất xử lý lương' : 'Chưa hoàn tất — nhân viên thấy "Đang xử lý lương"'}
                  </p>
                  <p className="text-[11px] text-[#8E8878] mt-0.5">
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
              <p className="px-5 pb-4 text-[11px] text-amber-700">
                Cần tải lên bảng chấm công của bộ phận này trước khi bấm Hoàn tất.
              </p>
            )}
          </SectionCard>

          {attendanceBased ? (
            <>
              {/* Đường dẫn lưu trữ */}
              <div className="flex items-center gap-2 text-[11px] text-[#8E8878] bg-[#FAF7F2]
                rounded-xl px-3.5 py-2.5">
                <FileSpreadsheet size={13} className="shrink-0" />
                <span>Cả 3 file của bộ phận này được lưu trong thư mục
                  <strong className="text-[#1C1C1E]"> attendance/{period}/{department}/</strong></span>
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

              {/* ── THƯỞNG & PHỤ CẤP THEO THÁNG ─────────────────────────────
                  Hai khoản này KHÔNG cố định nên không nằm trong hồ sơ lương;
                  OWNER import Excel riêng cho từng kỳ. Import lại = thay thế. */}
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
                />

                <AdjustmentSlot
                  icon={Wallet}
                  title="Phụ cấp theo tháng"
                  description="Xăng xe, điện thoại… — chọn nhãn từ danh mục phụ cấp"
                  hint="Mỗi nhân viên tối đa 4 khoản. Phụ cấp cơm KHÔNG nhập ở đây, hệ thống tự tính theo ngày đi làm."
                  count={adjustments?.allowance}
                  rowLabel="khoản phụ cấp"
                  uploading={busy === 'allowance'}
                  clearing={deleting === 'allowance'}
                  onUpload={f => uploadAdjustment('allowance', f)}
                  onClear={() => clearAdjustment('ALLOWANCE')}
                  onTemplate={() => template('allowance')}
                />
              </div>
            </>
          ) : (
            <SectionCard>
              <div className="flex items-start gap-3 px-5 py-5">
                <span className="w-10 h-10 rounded-xl bg-[#FAF7F2] flex items-center justify-center shrink-0">
                  <Truck size={17} className="text-[#C9A84C]" />
                </span>
                <div>
                  <p className="text-sm font-bold text-[#1C1C1E]">Tài xế không dùng bảng chấm công</p>
                  <p className="text-xs text-[#8E8878] mt-1 leading-relaxed max-w-2xl">
                    Số công của tài xế được tính theo <strong>tổng số km chạy mỗi ngày</strong>, ước tính
                    từ các đơn hàng đã và đang giao được phân công trong ngày. Ngày nào kho có chốt odo
                    vào ca / kết ca thì hệ thống lấy đúng số km thật. Bạn chỉ cần bấm
                    <strong> Hoàn tất</strong> để chốt lương tháng cho bộ phận này.
                  </p>
                </div>
              </div>
            </SectionCard>
          )}

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
              <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-black/5">
                <h3 className="text-sm font-bold text-[#1C1C1E]">Cách tính công</h3>
                {department === 'FACTORY' && (
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    {/* Mức thưởng bảo vệ — placeholder là mức mặc định 300.000đ.
                        Để trống thì backend giữ nguyên mức đã dùng cho tháng này,
                        nên bấm tính lại sau khi import chấm công không làm mất
                        con số OWNER đã chỉnh. */}
                    <label className="flex items-center gap-1.5 text-[11px] text-[#8E8878]">
                      Thưởng bảo vệ
                      <input
                        type="text" inputMode="numeric"
                        value={securityRate}
                        onChange={e => setSecurityRate(formatVnInt(e.target.value))}
                        placeholder={kpi?.securityRate != null
                          ? Number(kpi.securityRate).toLocaleString('vi-VN')
                          : '300.000'}
                        className="w-24 px-2 py-1 rounded-lg border border-black/10 text-xs
                          text-right text-[#1C1C1E] focus:outline-none focus:border-[#C9A84C]" />
                      đ/người
                    </label>
                    <button onClick={recompute} disabled={recomputing}
                      className="flex items-center gap-1.5 text-xs font-semibold text-[#C9A84C]
                        hover:underline disabled:opacity-50">
                      <Calculator size={13} />
                      {recomputing ? 'Đang tính...' : 'Tính lại thưởng KPI'}
                    </button>
                  </div>
                )}
              </div>
              <div className="px-5 py-4 grid gap-2.5 sm:grid-cols-2 text-[11px] text-[#5A5548]">
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
                    <span className="text-[#C9A84C] shrink-0">•</span>
                    <span><strong className="text-[#1C1C1E]">{k}</strong> — {v}</span>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {status?.note && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <AlertCircle size={15} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 leading-snug">{status.note}</p>
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
    </div>
  );
}