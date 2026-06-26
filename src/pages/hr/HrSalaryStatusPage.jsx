// src/pages/hr/HrSalaryStatusPage.jsx
// HR / SUPER_ACCOUNTANT xem trạng thái các phiếu lương đã gửi + import/export
import { useLang } from '../../context/LangContext';
import { useState, useEffect, useCallback, useRef } from 'react';
import { DollarSign, Clock, Check, X, Upload, Download } from 'lucide-react';
import { hrSalaryApi } from '../../api/hrApi';
import {
  PageHeader, SectionCard, Table, Thead, Th, Td, Tr,
  EmptyState, LoadingSpinner, formatCurrency, formatDateTime,
  SecondaryButton,
} from '../../components/ui';
import { Badge } from '../../components/ui/Badge';
import Pagination from '../../components/ui/Pagination';
import Modal from '../../components/ui/Modal';
import { useToast } from '../../components/common/Toast';

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
    </div>
  );
}
