// src/pages/owner/OwnerEmployeesPage.jsx
// Owner xem nhân sự: tab Nhân viên, Phiếu nghỉ, Phiếu OT, Duyệt lương, Duyệt phiếu lương
import { useLang } from '../../context/LangContext';
import { useState, useEffect, useCallback } from 'react';
import {
  Users, Calendar, Clock, DollarSign, Check, X, FileText,
  Search, ChevronDown, Calculator, Download, Eye,
} from 'lucide-react';
import { adminUserApi } from '../../api/adminApi';
import { hrSalaryApi, hrLeaveApi, hrOtApi, payrollApi } from '../../api/hrApi';
import { downloadBlob } from '../../api/services';
import {
  PageHeader, SectionCard, Table, Thead, Th, Td, Tr,
  EmptyState, LoadingSpinner, Field, inputCls, selectCls,
  PrimaryButton, SecondaryButton, DangerButton,
  formatCurrency, formatDate, formatDateTime, TabBar,
} from '../../components/ui';
import { Badge } from '../../components/ui/Badge';
import Pagination from '../../components/ui/Pagination';
import Modal from '../../components/ui/Modal';
import { useToast } from '../../components/common/Toast';

function Row({ label, val, bold, red }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs text-[#8E8878]">{label}</span>
      <span className={`text-sm ${bold ? 'font-bold' : 'font-medium'} ${red ? 'text-red-600' : 'text-[#1C1C1E]'}`}>{val}</span>
    </div>
  );
}

// ── Reject Modal ──────────────────────────────────────────────────────────────
function RejectModal({ salary, onClose, onDone }) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!reason.trim()) return toast('Cần nhập lý do từ chối', 'error');
    setSaving(true);
    try {
      await hrSalaryApi.reject(salary.id, { rejectReason: reason });
      toast('Đã từ chối phiếu lương', 'success');
      onDone();
      onClose();
    } catch (e) { toast(e.message || 'Lỗi khi xử lý', 'error'); }
    finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title="Từ chối phiếu lương">
      <p className="text-sm text-[#8E8878] mb-3">
        Phiếu lương của <b>{salary.userFullName}</b> — lương CB: {formatCurrency(salary.baseSalary)}
      </p>
      <Field label="Lý do từ chối" required>
        <textarea className={inputCls} rows={3} value={reason}
          onChange={e => setReason(e.target.value)} placeholder="Nhập lý do từ chối…" />
      </Field>
      <div className="flex gap-2 pt-3">
        <SecondaryButton onClick={onClose} className="flex-1">Huỷ</SecondaryButton>
        <DangerButton onClick={submit} loading={saving} className="flex-1">Từ chối</DangerButton>
      </div>
    </Modal>
  );
}

// ── Employees Tab ─────────────────────────────────────────────────────────────
function EmployeesTab() {
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminUserApi.list({ q, page, size: 20 });
      setUsers(data.content ?? data);
      setTotalPages(data.totalPages ?? 1);
    } catch { toast('Không tải được danh sách', 'error'); }
    finally { setLoading(false); }
  }, [q, page]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="relative max-w-xs">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8878]" />
        <input className={`${inputCls} pl-8`} value={q}
          onChange={e => { setQ(e.target.value); setPage(0); }}
          placeholder="Tìm nhân viên…" />
      </div>

      <SectionCard>
        {loading ? <LoadingSpinner /> : users.length === 0 ? (
          <EmptyState icon={Users} title="Không có nhân viên" />
        ) : (
          <Table>
            <Thead>
              <Tr>
                <Th>Họ tên</Th>
                <Th>Bộ phận</Th>
                <Th>Chức vụ</Th>
              </Tr>
            </Thead>
            <tbody>
              {users.map(u => (
                <Tr key={u.id}>
                  <Td>
                    <div className="font-medium">{u.fullName}</div>
                    <div className="text-xs text-[#8E8878]">{u.username}</div>
                  </Td>
                  <Td>{u.department || '—'}</Td>
                  <Td>{u.position || '—'}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-black/5">
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </div>
        )}
      </SectionCard>
    </div>
  );
}

// ── Leaves Tab (read-only for owner) ─────────────────────────────────────────
function LeavesTab() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await hrLeaveApi.list({ page, size: 20 });
      setRows(data.content ?? data);
      setTotalPages(data.totalPages ?? 1);
    } catch { toast('Không tải được phiếu nghỉ', 'error'); }
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  return (
    <SectionCard>
      {loading ? <LoadingSpinner /> : rows.length === 0 ? (
        <EmptyState icon={Calendar} title="Chưa có phiếu nghỉ" />
      ) : (
        <Table>
          <Thead>
            <Tr>
              <Th>Nhân viên</Th>
              <Th>Loại</Th>
              <Th>Từ ngày</Th>
              <Th>Đến ngày</Th>
              <Th>Số ngày</Th>
              <Th>Bàn giao</Th>
              <Th>SĐT</Th>
              <Th>Ngày tạo</Th>
            </Tr>
          </Thead>
          <tbody>
            {rows.map(l => (
              <Tr key={l.id}>
                <Td>
                  <div className="font-medium">{l.userFullName}</div>
                  {l.department && <div className="text-xs text-[#8E8878]">{l.department}</div>}
                </Td>
                <Td><Badge variant={l.leaveType === 'PAID' ? 'success' : 'warning'}>{LEAVE_LABEL[l.leaveType]}</Badge></Td>
                <Td>{formatDate(l.leaveDate)}</Td>
                <Td>{formatDate(l.leaveEndDate)}</Td>
                <Td>{l.leaveDays} ngày</Td>
                <Td>{l.handoverTo || '—'}</Td>
                <Td>{l.contactPhone || '—'}</Td>
                <Td>{formatDateTime(l.createdAt)}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
      {totalPages > 1 && (
        <div className="px-4 py-3 border-t border-black/5">
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </div>
      )}
    </SectionCard>
  );
}

// ── OT Tab (read-only for owner) ──────────────────────────────────────────────
function OtTab() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await hrOtApi.list({ page, size: 20 });
      setRows(data.content ?? data);
      setTotalPages(data.totalPages ?? 1);
    } catch { toast('Không tải được đơn OT', 'error'); }
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  return (
    <SectionCard>
      {loading ? <LoadingSpinner /> : rows.length === 0 ? (
        <EmptyState icon={Clock} title="Chưa có đơn OT" />
      ) : (
        <Table>
          <Thead>
            <Tr>
              <Th>Ngày OT</Th>
              <Th>Giờ</Th>
              <Th>Số giờ</Th>
              <Th>Nhân viên</Th>
              <Th>Lý do</Th>
              <Th>Ngày tạo</Th>
            </Tr>
          </Thead>
          <tbody>
            {rows.map(o => (
              <Tr key={o.id}>
                <Td>{formatDate(o.otDate)}</Td>
                <Td>{o.startTime} — {o.endTime}</Td>
                <Td>{o.otHours}h</Td>
                <Td>
                  <div className="text-sm">{(o.employees || []).map(e => e.fullName).join(', ')}</div>
                </Td>
                <Td><span className="text-sm text-[#8E8878] line-clamp-1">{o.reason}</span></Td>
                <Td>{formatDateTime(o.createdAt)}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
      {totalPages > 1 && (
        <div className="px-4 py-3 border-t border-black/5">
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </div>
      )}
    </SectionCard>
  );
}

// ── Salary Approval Tab ───────────────────────────────────────────────────────
function SalaryApprovalTab() {
  const { t } = useLang();
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [rejectModal, setRejectModal] = useState(null);
  const [approving, setApproving] = useState(null);
  const [selected, setSelected] = useState([]);
  const [bulkApproving, setBulkApproving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await hrSalaryApi.list({ status: statusFilter || undefined, page, size: 20 });
      setRows(data.content ?? data);
      setTotalPages(data.totalPages ?? 1);
      setSelected([]);
    } catch { toast(t('common', 'error_retry'), 'error'); }
    finally { setLoading(false); }
  }, [page, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const pendingRows = rows.filter(r => r.status === 'PENDING');
  const toggleAll = () =>
    setSelected(selected.length === pendingRows.length ? [] : pendingRows.map(r => r.id));
  const toggleOne = (id) =>
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  const handleApprove = async (id) => {
    setApproving(id);
    try {
      await hrSalaryApi.approve(id);
      toast('Đã duyệt phiếu lương', 'success');
      load();
    } catch (e) { toast(e.message || t('common', 'error'), 'error'); }
    finally { setApproving(null); }
  };

  const handleBulkApprove = async () => {
    if (selected.length === 0) return;
    setBulkApproving(true);
    try {
      await hrSalaryApi.bulkApprove(selected);
      toast(`Đã duyệt ${selected.length} phiếu lương`, 'success');
      load();
    } catch (e) { toast(e.message || t('common', 'error'), 'error'); }
    finally { setBulkApproving(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-2">
          {[
            { val: 'PENDING', label: t('status', 'pending') },
            { val: 'APPROVED', label: t('status', 'approved') },
            { val: 'REJECTED', label: t('common', 'reject') },
            { val: '', label: t('common', 'all') },
          ].map(({ val, label }) => (
            <button key={val} onClick={() => { setStatusFilter(val); setPage(0); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors
                ${statusFilter === val ? 'bg-[#1C1C1E] text-white' : 'bg-white border border-black/10 text-[#8E8878] hover:bg-[#FAF7F2]'}`}>
              {label}
            </button>
          ))}
        </div>
        {statusFilter === 'PENDING' && selected.length > 0 && (
          <PrimaryButton onClick={handleBulkApprove} loading={bulkApproving}>
            <Check size={14} /> Duyệt đã chọn ({selected.length})
          </PrimaryButton>
        )}
      </div>

      <SectionCard>
        {loading ? <LoadingSpinner /> : rows.length === 0 ? (
          <EmptyState icon={DollarSign} title="Không có phiếu lương nào" />
        ) : (
          <Table>
            <Thead>
              <Tr>
                {statusFilter === 'PENDING' && (
                  <Th><input type="checkbox" checked={selected.length === pendingRows.length && pendingRows.length > 0}
                    onChange={toggleAll} className="w-4 h-4 accent-amber-500" /></Th>
                )}
                <Th>Nhân viên</Th>
                <Th>Bộ phận</Th>
                <Th>Phòng ban</Th>
                <Th right>Lương trước thuế</Th>
                <Th>Trạng thái</Th>
                <Th>Ngày gửi</Th>
                {statusFilter === 'PENDING' && <Th right>Thao tác</Th>}
              </Tr>
            </Thead>
            <tbody>
              {rows.map(s => (
                <Tr key={s.id}>
                  {statusFilter === 'PENDING' && (
                    <Td>
                      {s.status === 'PENDING' && (
                        <input type="checkbox" checked={selected.includes(s.id)}
                          onChange={() => toggleOne(s.id)} className="w-4 h-4 accent-amber-500" />
                      )}
                    </Td>
                  )}
                  <Td>
                    <div className="font-medium">{s.userFullName}</div>
                    <div className="text-xs text-[#8E8878]">{s.position || '—'}</div>
                  </Td>
                  <Td>{s.department || '—'}</Td>
                  <Td>{s.division || '—'}</Td>
                  <Td right>{s.baseSalary ? formatCurrency(s.baseSalary) : '—'}</Td>
                  <Td>
                    <Badge variant={
                      s.status === 'APPROVED' ? 'success' :
                        s.status === 'REJECTED' ? 'danger' : 'warning'
                    }>
                      {s.status === 'PENDING' ? 'Chờ duyệt' : s.status === 'APPROVED' ? 'Đã duyệt' : t('common', 'reject')}
                    </Badge>
                    {s.rejectReason && (
                      <p className="text-xs text-red-500 mt-0.5 max-w-[140px] truncate">{s.rejectReason}</p>
                    )}
                  </Td>
                  <Td>{formatDateTime(s.createdAt)}</Td>
                  {statusFilter === 'PENDING' && (
                    <Td right>
                      <div className="flex gap-1 justify-end">
                        <PrimaryButton className="!px-2 !py-1 text-xs"
                          loading={approving === s.id}
                          onClick={() => handleApprove(s.id)}>
                          <Check size={12} /> Duyệt
                        </PrimaryButton>
                        <DangerButton className="!px-2 !py-1 text-xs"
                          onClick={() => setRejectModal(s)}>
                          <X size={12} /> Từ chối
                        </DangerButton>
                      </div>
                    </Td>
                  )}
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-black/5">
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </div>
        )}
      </SectionCard>

      {rejectModal && (
        <RejectModal salary={rejectModal}
          onClose={() => setRejectModal(null)}
          onDone={load} />
      )}
    </div>
  );
}

// ── Payroll Approval Tab — Owner duyệt toàn bộ phiếu lương tháng 1 lần ────────
const MONTH_NAMES_OWNER = ['', 'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
  'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];

const PAYROLL_STATUS_LABEL_OWNER = {
  DRAFT: { label: 'Đã export, chưa import', cls: 'bg-amber-50 text-amber-700' },
  PENDING_APPROVAL: { label: 'Chờ duyệt', cls: 'bg-blue-50 text-blue-700' },
  APPROVED: { label: 'Đã duyệt', cls: 'bg-emerald-50 text-emerald-700' },
  REJECTED: { label: 'Đã từ chối', cls: 'bg-red-50 text-red-700' },
};

function PayrollStatusBadgeOwner({ status }) {
  const cfg = PAYROLL_STATUS_LABEL_OWNER[status] || { label: status, cls: 'bg-gray-100 text-gray-600' };
  return <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.cls}`}>{cfg.label}</span>;
}

async function readErrorMessageOwner(err, fallback) {
  try {
    const blob = err?.response?.data;
    if (blob instanceof Blob) {
      const text = await blob.text();
      try { return JSON.parse(text)?.message || fallback; } catch { return text || fallback; }
    }
    return err?.response?.data?.message || fallback;
  } catch { return fallback; }
}

// ── Modal: từ chối toàn bộ phiếu lương tháng ──────────────────────────────────
function RejectPayrollModal({ batch, onClose, onDone }) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!reason.trim()) return toast('Cần nhập lý do từ chối', 'error');
    setSaving(true);
    try {
      await payrollApi.rejectBatch(batch.id, { rejectReason: reason });
      toast('Đã từ chối phiếu lương', 'success');
      onDone();
      onClose();
    } catch (e) { toast(e?.response?.data?.message || 'Lỗi khi xử lý', 'error'); }
    finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title="Từ chối phiếu lương">
      <p className="text-sm text-[#8E8878] mb-3">
        Phiếu lương tháng <b>{MONTH_NAMES_OWNER[batch.month]}/{batch.year}</b> — {batch.employeeCount} nhân viên.
        HR/Kế toán sẽ cần tạo lại phiếu lương từ đầu sau khi bị từ chối.
      </p>
      <Field label="Lý do từ chối" required>
        <textarea className={inputCls} rows={3} value={reason}
          onChange={e => setReason(e.target.value)} placeholder="Nhập lý do từ chối…" />
      </Field>
      <div className="flex gap-2 pt-3">
        <SecondaryButton onClick={onClose} className="flex-1">Huỷ</SecondaryButton>
        <DangerButton onClick={submit} loading={saving} className="flex-1">Từ chối</DangerButton>
      </div>
    </Modal>
  );
}

// ── Modal: xem chi tiết từng phiếu lương trong batch ──────────────────────────
function PayrollBatchDetailModal({ batch, onClose, onApproved }) {
  const toast = useToast();
  const [payslips, setPayslips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    payrollApi.getPayslips(batch.id)
      .then(data => setPayslips(Array.isArray(data) ? data : []))
      .catch(() => { toast('Không tải được chi tiết phiếu lương', 'error'); setPayslips([]); })
      .finally(() => setLoading(false));
  }, [batch.id]);

  const handleApprove = async () => {
    setApproving(true);
    try {
      await payrollApi.approveBatch(batch.id);
      toast('Đã duyệt phiếu lương', 'success');
      onApproved();
      onClose();
    } catch (e) { toast(e?.response?.data?.message || 'Lỗi khi duyệt', 'error'); }
    finally { setApproving(false); }
  };

  const totalNet = payslips.reduce((sum, p) => sum + (p.netSalary || 0), 0);

  return (
    <Modal open onClose={onClose} size="2xl"
      title={`Chi tiết phiếu lương — ${MONTH_NAMES_OWNER[batch.month]}/${batch.year}`}>
      {loading ? <LoadingSpinner /> : payslips.length === 0 ? (
        <EmptyState icon={FileText} title="Chưa có dữ liệu" />
      ) : (
        <div className="space-y-3">
          <div className="bg-[#FAF7F2] rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-[#8E8878]">Tổng lương NET phải chi tháng này</span>
            <span className="text-lg font-bold text-emerald-700">{formatCurrency(totalNet)}</span>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <Thead>
                <Tr>
                  <Th>Nhân viên</Th>
                  <Th right>Lương GROSS</Th>
                  <Th right>Người phụ thuộc</Th>
                  <Th right>Tổng bảo hiểm</Th>
                  <Th right>Thu nhập tính thuế</Th>
                  <Th right>Thuế TNCN</Th>
                  <Th right>Lương NET</Th>
                </Tr>
              </Thead>
              <tbody>
                {payslips.map(p => (
                  <Tr key={p.id}>
                    <Td>
                      <div className="font-medium">{p.userFullName}</div>
                      <div className="text-xs text-[#8E8878]">{p.department || '—'} {p.division ? `· ${p.division}` : ''}</div>
                    </Td>
                    <Td right>{formatCurrency(p.grossSalary)}</Td>
                    <Td right>{p.dependents ?? 0}</Td>
                    <Td right>{formatCurrency(p.totalInsuranceAmount)}</Td>
                    <Td right>{formatCurrency(p.taxableIncome)}</Td>
                    <Td right>{formatCurrency(p.personalIncomeTax)}</Td>
                    <Td right><span className="font-semibold text-emerald-700">{formatCurrency(p.netSalary)}</span></Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </div>
          {batch.status === 'PENDING_APPROVAL' && (
            <div className="flex gap-2 pt-2">
              <PrimaryButton onClick={handleApprove} loading={approving} className="flex-1">
                <Check size={14} /> Duyệt toàn bộ phiếu lương ({payslips.length} nhân viên)
              </PrimaryButton>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function PayrollApprovalTab() {
  const toast = useToast();
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('PENDING_APPROVAL');
  const [detailBatch, setDetailBatch] = useState(null);
  const [rejectBatch, setRejectBatch] = useState(null);
  const [approvingId, setApprovingId] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await payrollApi.listBatches({ status: statusFilter || undefined, size: 50 });
      const list = Array.isArray(data?.content) ? data.content : (Array.isArray(data) ? data : []);
      setBatches(list);
    } catch { toast('Không tải được danh sách phiếu lương', 'error'); setBatches([]); }
    finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleQuickApprove = async (batch) => {
    setApprovingId(batch.id);
    try {
      await payrollApi.approveBatch(batch.id);
      toast('Đã duyệt phiếu lương', 'success');
      load();
    } catch (e) { toast(e?.response?.data?.message || 'Lỗi khi duyệt', 'error'); }
    finally { setApprovingId(null); }
  };

  const handleDownload = async (batch) => {
    setDownloadingId(batch.id);
    try {
      const res = await payrollApi.downloadPayslips(batch.id);
      downloadBlob(res.data, `phieu-luong-${batch.month}-${batch.year}.xlsx`);
      toast('Đã tải phiếu lương', 'success');
    } catch (e) {
      const msg = await readErrorMessageOwner(e, 'Lỗi khi tải phiếu lương');
      toast(msg, 'error');
    } finally { setDownloadingId(null); }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {[
          { val: 'PENDING_APPROVAL', label: 'Chờ duyệt' },
          { val: 'APPROVED', label: 'Đã duyệt' },
          { val: 'REJECTED', label: 'Đã từ chối' },
          { val: '', label: 'Tất cả' },
        ].map(({ val, label }) => (
          <button key={val} onClick={() => setStatusFilter(val)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors
              ${statusFilter === val ? 'bg-[#1C1C1E] text-white' : 'bg-white border border-black/10 text-[#8E8878] hover:bg-[#FAF7F2]'}`}>
            {label}
          </button>
        ))}
      </div>

      <SectionCard>
        {loading ? <LoadingSpinner /> : batches.length === 0 ? (
          <EmptyState icon={Calculator} title="Không có phiếu lương nào" />
        ) : (
          <Table>
            <Thead>
              <Tr>
                <Th>Tháng</Th>
                <Th right>Số nhân viên</Th>
                <Th>Trạng thái</Th>
                <Th>Người tạo</Th>
                <Th>Ngày gửi</Th>
                <Th right>Thao tác</Th>
              </Tr>
            </Thead>
            <tbody>
              {batches.map(b => (
                <Tr key={b.id}>
                  <Td><span className="font-medium">{MONTH_NAMES_OWNER[b.month]}/{b.year}</span></Td>
                  <Td right>{b.employeeCount ?? '—'}</Td>
                  <Td>
                    <PayrollStatusBadgeOwner status={b.status} />
                    {b.rejectReason && <p className="text-xs text-red-500 mt-1 max-w-[200px]">{b.rejectReason}</p>}
                  </Td>
                  <Td>{b.createdByName || '—'}</Td>
                  <Td>{formatDateTime(b.importedAt || b.createdAt)}</Td>
                  <Td right>
                    <div className="flex gap-1.5 justify-end">
                      <SecondaryButton className="!px-2.5 !py-1.5 text-xs" onClick={() => setDetailBatch(b)}>
                        <Eye size={12} /> Xem
                      </SecondaryButton>
                      {b.status === 'PENDING_APPROVAL' && (
                        <>
                          <PrimaryButton className="!px-2.5 !py-1.5 text-xs"
                            loading={approvingId === b.id}
                            onClick={() => handleQuickApprove(b)}>
                            <Check size={12} /> Duyệt
                          </PrimaryButton>
                          <DangerButton className="!px-2.5 !py-1.5 text-xs" onClick={() => setRejectBatch(b)}>
                            <X size={12} /> Từ chối
                          </DangerButton>
                        </>
                      )}
                      {b.status === 'APPROVED' && (
                        <SecondaryButton className="!px-2.5 !py-1.5 text-xs"
                          loading={downloadingId === b.id}
                          onClick={() => handleDownload(b)}>
                          <Download size={12} /> Tải
                        </SecondaryButton>
                      )}
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </SectionCard>

      {detailBatch && (
        <PayrollBatchDetailModal batch={detailBatch} onClose={() => setDetailBatch(null)} onApproved={load} />
      )}
      {rejectBatch && (
        <RejectPayrollModal batch={rejectBatch} onClose={() => setRejectBatch(null)} onDone={load} />
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'employees', label: 'Nhân viên', icon: Users },
  { id: 'leaves', label: 'Phiếu nghỉ', icon: Calendar },
  { id: 'ot', label: 'Phiếu OT', icon: Clock },
  { id: 'salary', label: 'Duyệt lương', icon: DollarSign },
  { id: 'payroll', label: 'Duyệt phiếu lương', icon: Calculator },
];

export default function OwnerEmployeesPage() {
  const { t } = useLang();
  const [tab, setTab] = useState('employees');

  const LEAVE_LABEL = { PAID: t('hr', 'leave_paid'), UNPAID: t('hr', 'leave_unpaid') };


  return (
    <div className="p-4 sm:p-6 space-y-5">
      <PageHeader icon={Users} title="Nhân sự" subtitle="Quản lý & duyệt lương nhân viên" />
      <TabBar tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'employees' && <EmployeesTab />}
      {tab === 'leaves' && <LeavesTab />}
      {tab === 'ot' && <OtTab />}
      {tab === 'salary' && <SalaryApprovalTab />}
      {tab === 'payroll' && <PayrollApprovalTab />}
    </div>
  );
}
