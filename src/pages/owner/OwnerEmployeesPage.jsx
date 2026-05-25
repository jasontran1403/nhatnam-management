// src/pages/owner/OwnerEmployeesPage.jsx
// Owner xem nhân sự: tab Nhân viên, Phiếu nghỉ, Phiếu OT, Duyệt lương
import { useState, useEffect, useCallback } from 'react';
import {
  Users, Calendar, Clock, DollarSign, Check, X, FileText,
  Search, ChevronDown,
} from 'lucide-react';
import { adminUserApi } from '../../api/adminApi';
import { hrSalaryApi, hrLeaveApi, hrOtApi, hrPayslipApi } from '../../api/hrApi';
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

const LEAVE_LABEL = { PAID: 'Có lương', UNPAID: 'Không lương' };

// ── Payslip Modal ─────────────────────────────────────────────────────────────
function PayslipModal({ userId, userName, onClose }) {
  const toast = useToast();
  const [data, setData]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    hrPayslipApi.get(userId)
      .then(setData)
      .catch(() => toast('Không tải được phiếu lương', 'error'))
      .finally(() => setLoading(false));
  }, [userId]);

  const fmtVnd = (v) => new Intl.NumberFormat('vi-VN').format(v || 0) + ' ₫';
  const monthName = data ? `Tháng ${data.month}/${data.year}` : '';

  return (
    <Modal open onClose={onClose} title={`Phiếu lương — ${userName}`} size="lg">
      {loading ? <LoadingSpinner /> : !data ? (
        <EmptyState icon={DollarSign} title="Không có dữ liệu lương" />
      ) : (
        <div className="space-y-4">
          {/* Header gradient */}
          <div className="rounded-xl overflow-hidden">
            <div className="bg-gradient-to-r from-[#C9A84C] to-[#E8C76A] px-5 py-4 text-white">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs opacity-80 font-medium uppercase tracking-wider">Phiếu lương</p>
                  <h2 className="text-xl font-bold mt-0.5">{data.userFullName}</h2>
                  <p className="text-sm opacity-90">{data.department} {data.position ? `— ${data.position}` : ''}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs opacity-80">{monthName}</p>
                  <p className="text-2xl font-bold">{fmtVnd(data.netSalary)}</p>
                  <p className="text-xs opacity-80">Thực nhận</p>
                </div>
              </div>
            </div>
          </div>

          {/* 2 column details */}
          <div className="grid grid-cols-2 gap-3">
            {/* Left: Thu nhập */}
            <div className="bg-[#FAF7F2] rounded-xl p-4 space-y-2">
              <p className="text-xs font-semibold text-[#8E8878] uppercase tracking-wider mb-2">Thu nhập</p>
              <Row label="Lương CB" val={fmtVnd(data.baseSalary)} />
              <Row label="Phụ cấp cơm" val={fmtVnd(data.mealAllowance)} />
              <Row label="Phụ cấp xăng" val={fmtVnd(data.transportAllowance)} />
              <Row label="Bonus" val={fmtVnd(data.bonus)} />
              <Row label={`OT (${data.otHours}h)`} val={fmtVnd(data.otPay)} />
              <div className="border-t border-black/10 pt-2 mt-2">
                <Row label="Tổng thu" val={fmtVnd(data.grossSalary)} bold />
              </div>
            </div>

            {/* Right: Khấu trừ & Công */}
            <div className="space-y-3">
              <div className="bg-[#FAF7F2] rounded-xl p-4 space-y-2">
                <p className="text-xs font-semibold text-[#8E8878] uppercase tracking-wider mb-2">Khấu trừ</p>
                <Row label={`BHXH (${data.socialInsuranceRate}%)`} val={fmtVnd(data.socialInsuranceAmount)} red />
                <div className="border-t border-black/10 pt-2 mt-2">
                  <Row label="Tổng khấu trừ" val={fmtVnd(data.totalDeductions)} bold red />
                </div>
              </div>
              <div className="bg-[#FAF7F2] rounded-xl p-4 space-y-2">
                <p className="text-xs font-semibold text-[#8E8878] uppercase tracking-wider mb-2">Chấm công</p>
                <Row label="Công chuẩn" val={`${data.standardWorkdays} ngày`} />
                <Row label="Nghỉ phép có lương" val={`${data.paidLeaveDays} ngày`} />
                <Row label="Nghỉ không lương" val={`${data.unpaidLeaveDays} ngày`} red={data.unpaidLeaveDays > 0} />
                <Row label="Công thực tế" val={`${data.actualWorkdays} ngày`} bold />
              </div>
            </div>
          </div>

          {/* Net */}
          <div className="bg-[#1C1C1E] rounded-xl px-5 py-4 flex items-center justify-between text-white">
            <span className="font-semibold">Thực nhận {monthName}</span>
            <span className="text-2xl font-bold text-[#C9A84C]">{fmtVnd(data.netSalary)}</span>
          </div>
        </div>
      )}
    </Modal>
  );
}

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
    } catch (e) { toast(e.message || 'Lỗi', 'error'); }
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
  const [users, setUsers]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [q, setQ]                 = useState('');
  const [page, setPage]           = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [payslip, setPayslip]     = useState(null);

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
                <Th>Role</Th>
                <Th right>Phiếu lương</Th>
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
                  <Td><Badge variant="default">{u.role}</Badge></Td>
                  <Td right>
                    <SecondaryButton className="!px-3 !py-1.5 text-xs" onClick={() => setPayslip(u)}>
                      <FileText size={12} /> Xem phiếu lương
                    </SecondaryButton>
                  </Td>
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

      {payslip && <PayslipModal userId={payslip.id} userName={payslip.fullName}
        onClose={() => setPayslip(null)} />}
    </div>
  );
}

// ── Leaves Tab (read-only for owner) ─────────────────────────────────────────
function LeavesTab() {
  const toast = useToast();
  const [rows, setRows]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [page, setPage]           = useState(0);
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
  const [rows, setRows]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [page, setPage]           = useState(0);
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
  const toast = useToast();
  const [rows, setRows]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [page, setPage]           = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [rejectModal, setRejectModal]   = useState(null);
  const [approving, setApproving]       = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await hrSalaryApi.list({ status: statusFilter || undefined, page, size: 20 });
      setRows(data.content ?? data);
      setTotalPages(data.totalPages ?? 1);
    } catch { toast('Không tải được phiếu lương', 'error'); }
    finally { setLoading(false); }
  }, [page, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (id) => {
    setApproving(id);
    try {
      await hrSalaryApi.approve(id);
      toast('Đã duyệt phiếu lương', 'success');
      load();
    } catch (e) { toast(e.message || 'Lỗi', 'error'); }
    finally { setApproving(null); }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {[
          { val: 'PENDING',  label: 'Chờ duyệt' },
          { val: 'APPROVED', label: 'Đã duyệt' },
          { val: 'REJECTED', label: 'Từ chối' },
          { val: '',         label: 'Tất cả' },
        ].map(({ val, label }) => (
          <button key={val} onClick={() => { setStatusFilter(val); setPage(0); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors
              ${statusFilter === val ? 'bg-[#1C1C1E] text-white' : 'bg-white border border-black/10 text-[#8E8878] hover:bg-[#FAF7F2]'}`}>
            {label}
          </button>
        ))}
      </div>

      <SectionCard>
        {loading ? <LoadingSpinner /> : rows.length === 0 ? (
          <EmptyState icon={DollarSign} title="Không có phiếu lương nào" />
        ) : (
          <Table>
            <Thead>
              <Tr>
                <Th>Nhân viên</Th>
                <Th>Bộ phận</Th>
                <Th right>Lương CB</Th>
                <Th right>BHXH</Th>
                <Th right>Bonus</Th>
                <Th right>Cơm</Th>
                <Th right>Xăng</Th>
                <Th>Trạng thái</Th>
                <Th>Ngày gửi</Th>
                {statusFilter === 'PENDING' && <Th right>Thao tác</Th>}
              </Tr>
            </Thead>
            <tbody>
              {rows.map(s => (
                <Tr key={s.id}>
                  <Td>
                    <div className="font-medium">{s.userFullName}</div>
                    <div className="text-xs text-[#8E8878]">{s.position || '—'}</div>
                  </Td>
                  <Td>{s.department || '—'}</Td>
                  <Td right>{s.baseSalary ? formatCurrency(s.baseSalary) : '—'}</Td>
                  <Td right>
                    {s.socialInsuranceRate != null ? `${s.socialInsuranceRate}%` : '—'}
                  </Td>
                  <Td right>{s.bonus ? formatCurrency(s.bonus) : '—'}</Td>
                  <Td right>{s.mealAllowance ? formatCurrency(s.mealAllowance) : '—'}</Td>
                  <Td right>{s.transportAllowance ? formatCurrency(s.transportAllowance) : '—'}</Td>
                  <Td>
                    <Badge variant={
                      s.status === 'APPROVED' ? 'success' :
                      s.status === 'REJECTED' ? 'danger' : 'warning'
                    }>
                      {s.status === 'PENDING' ? 'Chờ duyệt' : s.status === 'APPROVED' ? 'Đã duyệt' : 'Từ chối'}
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

// ── Main Page ─────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'employees', label: 'Nhân viên',   icon: Users },
  { id: 'leaves',    label: 'Phiếu nghỉ',  icon: Calendar },
  { id: 'ot',        label: 'Phiếu OT',    icon: Clock },
  { id: 'salary',    label: 'Duyệt lương', icon: DollarSign },
];

export default function OwnerEmployeesPage() {
  const [tab, setTab] = useState('employees');

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <PageHeader icon={Users} title="Nhân sự" subtitle="Quản lý & duyệt lương nhân viên" />
      <TabBar tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'employees' && <EmployeesTab />}
      {tab === 'leaves'    && <LeavesTab />}
      {tab === 'ot'        && <OtTab />}
      {tab === 'salary'    && <SalaryApprovalTab />}
    </div>
  );
}
