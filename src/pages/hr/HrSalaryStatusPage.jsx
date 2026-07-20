// src/pages/hr/HrSalaryStatusPage.jsx
// HR / SUPER_ACCOUNTANT xem trạng thái các phiếu lương đã gửi + import/export
import { useLang } from '../../context/LangContext';
import { useState, useEffect, useCallback, useRef } from 'react';
import { DollarSign, Clock, Check, X, Upload, Download, CalendarClock, AlertCircle } from 'lucide-react';
import { hrSalaryApi } from '../../api/hrApi';
import { factoryPayrollApi } from '../../api/factoryPayrollApi';
import {
  PageHeader, SectionCard, Table, Thead, Th, Td, Tr,
  EmptyState, LoadingSpinner, formatCurrency, formatDateTime,
  SecondaryButton,
} from '../../components/ui';
import { Badge } from '../../components/ui/Badge';
import Pagination from '../../components/ui/Pagination';
import Modal from '../../components/ui/Modal';
import { useToast } from '../../components/common/Toast';

// ── Import BẢNG CHẤM CÔNG ───────────────────────────────────────────────────
// Đọc file "BẢNG CHI TIẾT CHẤM CÔNG" xuất từ máy chấm công, khớp với các nhân
// viên đang có role thuộc xưởng (FACTORY_*) rồi lưu ngày công + giờ vào/ra.
function ImportAttendanceModal({ open, onClose, onDone }) {
  const now = new Date();
  // Mặc định chọn THÁNG TRƯỚC — tháng hiện tại chưa hết nên không cho chọn
  const options = [];
  for (let i = 1; i <= 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push({ month: d.getMonth() + 1, year: d.getFullYear() });
  }

  const [sel, setSel] = useState(options[0]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState(null);
  const fileRef = useRef(null);
  const toast = useToast();

  useEffect(() => {
    if (!open) { setResult(null); setErr(null); setSel(options[0]); }
  }, [open]); // eslint-disable-line

  const handleFile = async (file) => {
    if (!file) return;
    setUploading(true); setErr(null);
    try {
      const res = await factoryPayrollApi.uploadSheet(file, sel.month, sel.year);
      setResult(res);
      toast(`Tháng ${sel.month}/${sel.year}: khớp ${res?.matched ?? 0} nhân viên xưởng`, 'success');
      onDone?.();
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || 'Lỗi import bảng chấm công');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} title="Import bảng chấm công" size="sm">
      <div className="space-y-4 py-2">
        <div>
          <label className="block text-xs font-semibold text-[#8E8878] mb-1.5">Tháng chấm công</label>
          <select
            value={`${sel.month}-${sel.year}`}
            onChange={e => {
              const [m, y] = e.target.value.split('-').map(Number);
              setSel({ month: m, year: y });
            }}
            className="w-full px-3 py-2.5 rounded-xl border border-black/10 text-sm bg-white">
            {options.map(o => (
              <option key={`${o.month}-${o.year}`} value={`${o.month}-${o.year}`}>
                Tháng {o.month}/{o.year}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-[#8E8878] mt-1.5">
            Chỉ tải được cho các tháng đã kết thúc.
          </p>
        </div>

        <div className="text-[11px] text-[#8E8878] bg-[#FAF7F2] rounded-xl px-3.5 py-3 space-y-1.5">
          <p className="font-bold text-[#1C1C1E] text-xs">File "BẢNG CHI TIẾT CHẤM CÔNG"</p>
          <p>• Dùng đúng file Excel xuất từ máy chấm công — mỗi nhân viên một block
            có dòng <strong>Mã nhân viên / Tên nhân viên</strong> và bảng chi tiết
            từng ngày kèm giờ <strong>Vào / Ra</strong>.</p>
          <p>• Chỉ lấy nhân viên đang có role thuộc <strong>xưởng (FACTORY_*)</strong>,
            khớp theo mã chấm công đã lưu hoặc theo họ tên.</p>
          <p className="text-amber-700">⚠ Tải lại cùng tháng sẽ <strong>ghi đè</strong> dữ liệu cũ
            và tính lại thưởng KPI của tháng đó.</p>
        </div>

        {err && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
            <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
            <p className="text-xs text-red-600 font-medium">{err}</p>
          </div>
        )}

        {result && (
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'NV trong file', value: result.blocksInFile ?? 0, color: 'text-[#1C1C1E]' },
                { label: 'NV xưởng',      value: result.factoryEmployees ?? 0, color: 'text-[#C9A84C]' },
                { label: 'Đã khớp',       value: result.matched ?? 0, color: 'text-emerald-600' },
              ].map(s => (
                <div key={s.label} className="bg-[#FAF7F2] rounded-xl px-3 py-2.5 text-center">
                  <p className="text-[10px] text-[#8E8878] font-semibold">{s.label}</p>
                  <p className={`text-xl font-bold mt-0.5 ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>
            {result.unmatchedRows?.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                <p className="text-[11px] text-amber-800 font-semibold mb-1">
                  {result.unmatchedRows.length} nhân viên xưởng không có trong file:
                </p>
                <p className="text-[11px] text-amber-700 leading-snug">
                  {result.unmatchedRows.map(r => r.fullName).join(', ')}
                </p>
              </div>
            )}
            <p className="text-[11px] text-[#8E8878]">
              Xem báo cáo đầy đủ ở trang <strong>Bảng chấm công</strong>.
            </p>
          </div>
        )}

        {!uploading ? (
          <label className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl
            bg-[#C9A84C] text-white text-sm font-bold cursor-pointer
            hover:bg-[#A07830] transition-colors">
            <Upload size={15} /> Chọn file .xlsx
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
              onChange={e => { if (e.target.files[0]) handleFile(e.target.files[0]); }} />
          </label>
        ) : (
          <div className="flex items-center justify-center gap-2 py-3 text-sm text-[#8E8878]">
            <div className="w-4 h-4 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
            Đang xử lý...
          </div>
        )}
      </div>
    </Modal>
  );
}

// ── Import Salaries Modal ───────────────────────────────────────────────────
function ImportSalariesModal({ open, onClose, onDone }) {
  const [step, setStep] = useState('upload');
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => { if (!open) { setStep('upload'); setResult(null); setUploadError(null); } }, [open]);

  const handleFile = async (file) => {
    if (!file) return;
    setUploading(true); setUploadError(null);
    try {
      const res = await hrSalaryApi.importAll(file);
      const body = res?.data || {};
      const d = body.data ?? body;
      setResult({ updated: d.updated ?? 0, skipped: d.skipped ?? 0, errors: d.errors || [] });
      setStep('result');
      if ((d.updated ?? 0) > 0) onDone();
    } catch (e) {
      setUploadError(e?.response?.data?.message || 'Lỗi import bảng lương');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} title="Import bảng lương"
      subtitle={step === 'upload' ? 'Dùng file Export từ hệ thống — file chỉ import được 1 lần' : 'Kết quả import'}
      size="sm">
      {step === 'upload' ? (
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="w-14 h-14 rounded-full bg-[#C9A84C]/10 flex items-center justify-center">
            {uploading
              ? <div className="w-7 h-7 border-[3px] border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
              : <Upload size={24} className="text-[#C9A84C]" />}
          </div>
          <div className="text-center space-y-1.5">
            <p className="text-sm font-semibold text-[#1C1C1E]">{uploading ? 'Đang xử lý...' : 'Chọn file Excel để import'}</p>
            <p className="text-xs text-[#8E8878]">Hệ thống cập nhật đúng nhân viên theo cột <strong>ID</strong> — không dùng thứ tự dòng.</p>
            <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-1.5">
              ⚠ Mỗi file chỉ import được <strong>1 lần</strong>. Export lại nếu muốn import tiếp.
            </p>
            {uploadError && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-left">
                <span className="text-red-500 shrink-0 mt-0.5">✕</span>
                <p className="text-xs text-red-600 font-medium">{uploadError}</p>
              </div>
            )}
          </div>
          {!uploading && (
            <label className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#C9A84C] text-white text-sm font-semibold cursor-pointer hover:bg-[#A07830] transition-colors">
              <Upload size={14} /> Chọn file .xlsx
              <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
                onChange={e => { if (e.target.files[0]) handleFile(e.target.files[0]); }} />
            </label>
          )}
        </div>
      ) : (
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-center">
              <p className="text-2xl font-bold text-emerald-600">{result?.updated ?? 0}</p>
              <p className="text-xs text-emerald-700 mt-0.5">Cập nhật thành công</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-center">
              <p className="text-2xl font-bold text-red-500">{result?.skipped ?? 0}</p>
              <p className="text-xs text-red-600 mt-0.5">Bỏ qua / lỗi</p>
            </div>
          </div>
          {result?.errors?.length > 0 && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-3 max-h-40 overflow-y-auto">
              <p className="text-xs font-semibold text-red-600 mb-1.5">Chi tiết lỗi:</p>
              {result.errors.map((err, i) => (
                <p key={i} className="text-xs text-red-500 py-0.5 border-b border-red-100 last:border-0">{err}</p>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <SecondaryButton onClick={onClose} className="flex-1">Đóng</SecondaryButton>
            <label className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-[#C9A84C] text-white text-sm font-semibold cursor-pointer hover:bg-[#A07830]">
              <Upload size={13} /> Import file mới
              <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
                onChange={e => { if (e.target.files[0]) { setStep('upload'); handleFile(e.target.files[0]); } }} />
            </label>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function HrSalaryStatusPage() {
  const { t } = useLang();
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [exporting, setExporting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [attendanceOpen, setAttendanceOpen] = useState(false);

  const STATUS_CONFIG = {
    PENDING: { label: t('status', 'pending'), variant: 'warning', icon: Clock },
    APPROVED: { label: t('status', 'approved'), variant: 'success', icon: Check },
    REJECTED: { label: t('status', 'rejected_short'), variant: 'danger', icon: X },
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await hrSalaryApi.list({ status: statusFilter || undefined, page, size: 20 });
      setRows(data.content ?? data);
      setTotalPages(data.totalPages ?? 1);
    } catch { toast(t('common', 'error_retry'), 'error'); }
    finally { setLoading(false); }
  }, [page, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const res = await hrSalaryApi.exportAll();
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const disposition = res.headers?.['content-disposition'] || '';
      const match = disposition.match(/filename="?([^"]+)"?/);
      const a = document.createElement('a');
      a.href = url;
      a.download = match ? match[1] : 'bang-luong-export.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast('Lỗi khi export bảng lương', 'error');
    } finally {
      setExporting(false);
    }
  }, []);

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <PageHeader icon={DollarSign} title={t('hr', 'salary_slips_sent')}
        subtitle={t('batch', 'review_status')}
        action={
          <div className="flex gap-2">
            <button onClick={() => setAttendanceOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-black/10 text-[#1C1C1E] hover:bg-[#FAF7F2] transition-colors">
              <CalendarClock size={13} /> Import chấm công
            </button>
            <button onClick={() => setImportOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-black/10 text-[#1C1C1E] hover:bg-[#FAF7F2] transition-colors">
              <Upload size={13} /> Import
            </button>
            <button onClick={handleExport} disabled={exporting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#C9A84C] text-white hover:bg-[#A07830] transition-colors disabled:opacity-60">
              <Download size={13} /> {exporting ? 'Đang xuất...' : 'Export'}
            </button>
          </div>
        } />

      {/* Filter */}
      <div className="flex gap-2">
        {['', 'PENDING', 'APPROVED', 'REJECTED'].map(s => (
          <button key={s} onClick={() => { setStatusFilter(s); setPage(0); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors
              ${statusFilter === s ? 'bg-[#1C1C1E] text-white' : 'bg-white border border-black/10 text-[#8E8878] hover:bg-[#FAF7F2]'}`}>
            {s === '' ? t('batch', 'status_filter_all') : STATUS_CONFIG[s]?.label}
          </button>
        ))}
      </div>

      <SectionCard>
        {loading ? <LoadingSpinner /> : rows.length === 0 ? (
          <EmptyState icon={DollarSign} title={t('common', 'no_data')} />
        ) : (
          <Table>
            <Thead>
              <Tr>
                <Th>Nhân viên</Th>
                <Th>Bộ phận</Th>
                <Th right>Lương trước thuế</Th>
                <Th>Trạng thái</Th>
                <Th>Lý do từ chối</Th>
                <Th>Duyệt bởi</Th>
                <Th>Ngày tạo</Th>
              </Tr>
            </Thead>
            <tbody>
              {rows.map(s => {
                const cfg = STATUS_CONFIG[s.status] || {};
                return (
                  <Tr key={s.id}>
                    <Td>
                      <div className="font-medium">{s.userFullName}</div>
                      <div className="text-xs text-[#8E8878]">{s.position || '—'}</div>
                    </Td>
                    <Td>{s.department || '—'}</Td>
                    <Td right>{s.baseSalary ? formatCurrency(s.baseSalary) : '—'}</Td>
                    <Td>
                      <Badge variant={cfg.variant || 'default'}>{cfg.label || s.status}</Badge>
                    </Td>
                    <Td>
                      {s.rejectReason
                        ? <span className="text-xs text-red-600">{s.rejectReason}</span>
                        : '—'}
                    </Td>
                    <Td>{s.approvedByName || '—'}</Td>
                    <Td>{formatDateTime(s.createdAt)}</Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        )}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-black/5">
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </div>
        )}
      </SectionCard>

      <ImportSalariesModal open={importOpen} onClose={() => setImportOpen(false)} onDone={load} />
      <ImportAttendanceModal open={attendanceOpen} onClose={() => setAttendanceOpen(false)} onDone={load} />
    </div>
  );
}
