// src/pages/hr/HrPage.jsx
import { useLang } from '../../context/LangContext';
import { useState, useEffect, useCallback } from 'react';
import {
  Users, FileText, Clock, Plus, Search, ChevronDown, ChevronUp,
  DollarSign, Calendar, UserCog, X, Check, Loader2, AlertCircle, Download,
} from 'lucide-react';
import { adminUserApi } from '../../api/adminApi';
import { hrSalaryApi, hrLeaveApi, hrOtApi, hrEmployeeApi } from '../../api/hrApi';
import { downloadBlob } from '../../api/services';
import api from '../../api/axios';
import {
  PageHeader, PrimaryButton, SecondaryButton, Field, inputCls, selectCls,
  Table, Thead, Th, Td, Tr, TabBar, EmptyState, LoadingSpinner,
  formatCurrency, formatDate, formatDateTime, SectionCard,
} from '../../components/ui';
import Pagination from '../../components/ui/Pagination';
import Modal from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { useToast } from '../../components/common/Toast';
import DateRangePicker from '../../components/ui/DateRangePicker';


// ── Salary Modal (single) ─────────────────────────────────────────────────────
function SalaryModal({ user, onClose, onSaved }) {
  const { t } = useLang();
  const toast = useToast();
  const [form, setForm] = useState({
    baseSalary: '', socialInsuranceRate: '8', socialInsuranceSalary: '',
    bonus: '', mealAllowance: '', transportAllowance: '',
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const num = (v) => (v === '' ? null : Number(v));

  const submit = async () => {
    setSaving(true);
    try {
      await hrSalaryApi.set({
        userId: user.id,
        baseSalary: num(form.baseSalary),
        socialInsuranceRate: num(form.socialInsuranceRate),
        socialInsuranceSalary: num(form.socialInsuranceSalary),
        bonus: num(form.bonus),
        mealAllowance: num(form.mealAllowance),
        transportAllowance: num(form.transportAllowance),
      });
      toast(t('hr', 'salary_pending_owner'), 'success');
      onSaved();
      onClose();
    } catch (e) {
      toast(e.message || 'Lỗi khi lưu', 'error');
    } finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title={`${t('hr', 'update_salary')} — ${user.fullName}`}>
      <div className="space-y-3 py-1">
        <Field label="Lương cơ bản (VNĐ)" required>
          <input className={inputCls} type="number" value={form.baseSalary}
            onChange={e => set('baseSalary', e.target.value)} placeholder="VD: 8000000" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tỷ lệ BHXH NLĐ (%)">
            <input className={inputCls} type="number" value={form.socialInsuranceRate}
              onChange={e => set('socialInsuranceRate', e.target.value)} />
          </Field>
          <Field label="Mức lương đóng BHXH (VNĐ)">
            <input className={inputCls} type="number" value={form.socialInsuranceSalary}
              onChange={e => set('socialInsuranceSalary', e.target.value)} />
          </Field>
        </div>
        <Field label="Bonus tháng (VNĐ)">
          <input className={inputCls} type="number" value={form.bonus}
            onChange={e => set('bonus', e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phụ cấp cơm (VNĐ/ngày)">
            <input className={inputCls} type="number" value={form.mealAllowance}
              onChange={e => set('mealAllowance', e.target.value)} />
          </Field>
          <Field label="Phụ cấp xăng (VNĐ/tháng)">
            <input className={inputCls} type="number" value={form.transportAllowance}
              onChange={e => set('transportAllowance', e.target.value)} />
          </Field>
        </div>
      </div>
      <div className="flex gap-2 pt-3">
        <SecondaryButton onClick={onClose} className="flex-1">Huỷ</SecondaryButton>
        <PrimaryButton onClick={submit} loading={saving} className="flex-1">Gửi duyệt</PrimaryButton>
      </div>
    </Modal>
  );
}

// ── Batch Salary Modal ────────────────────────────────────────────────────────
function BatchSalaryModal({ userIds, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({
    baseSalary: '', socialInsuranceRate: '8', socialInsuranceSalary: '',
    bonus: '', mealAllowance: '', transportAllowance: '',
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const num = (v) => (v === '' ? null : Number(v));

  const submit = async () => {
    setSaving(true);
    try {
      await hrSalaryApi.setBatch({
        userIds,
        baseSalary: num(form.baseSalary),
        socialInsuranceRate: num(form.socialInsuranceRate),
        socialInsuranceSalary: num(form.socialInsuranceSalary),
        bonus: num(form.bonus),
        mealAllowance: num(form.mealAllowance),
        transportAllowance: num(form.transportAllowance),
      });
      toast(`Đã gửi phiếu lương cho ${userIds.length} nhân viên`, 'success');
      onSaved();
      onClose();
    } catch (e) {
      toast(e.message || 'Lỗi khi lưu', 'error');
    } finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title={`Set lương hàng loạt (${userIds.length} nhân viên)`}>
      <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mb-3">
        Các thông số dưới sẽ được áp dụng cho tất cả nhân viên đã chọn.
      </p>
      <div className="space-y-3 py-1">
        <Field label="Lương cơ bản (VNĐ)" required>
          <input className={inputCls} type="number" value={form.baseSalary}
            onChange={e => set('baseSalary', e.target.value)} placeholder="VD: 8000000" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tỷ lệ BHXH NLĐ (%)">
            <input className={inputCls} type="number" value={form.socialInsuranceRate}
              onChange={e => set('socialInsuranceRate', e.target.value)} />
          </Field>
          <Field label="Mức lương đóng BHXH (VNĐ)">
            <input className={inputCls} type="number" value={form.socialInsuranceSalary}
              onChange={e => set('socialInsuranceSalary', e.target.value)} />
          </Field>
        </div>
        <Field label="Bonus tháng (VNĐ)">
          <input className={inputCls} type="number" value={form.bonus}
            onChange={e => set('bonus', e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phụ cấp cơm (VNĐ/ngày)">
            <input className={inputCls} type="number" value={form.mealAllowance}
              onChange={e => set('mealAllowance', e.target.value)} />
          </Field>
          <Field label="Phụ cấp xăng (VNĐ/tháng)">
            <input className={inputCls} type="number" value={form.transportAllowance}
              onChange={e => set('transportAllowance', e.target.value)} />
          </Field>
        </div>
      </div>
      <div className="flex gap-2 pt-3">
        <SecondaryButton onClick={onClose} className="flex-1">Huỷ</SecondaryButton>
        <PrimaryButton onClick={submit} loading={saving} className="flex-1">Gửi duyệt</PrimaryButton>
      </div>
    </Modal>
  );
}

// ── Info Modal (dept/pos) ─────────────────────────────────────────────────────
function InfoModal({ user, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ department: user.department || '', position: user.position || '' });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await hrEmployeeApi.updateInfo(user.id, form);
      toast('Đã cập nhật thông tin', 'success');
      onSaved();
      onClose();
    } catch (e) {
      toast(e.message || t('common', 'error'), 'error');
    } finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title={`Thông tin — ${user.fullName}`}>
      <div className="space-y-3 py-1">
        <Field label="Bộ phận / Phòng ban">
          <input className={inputCls} value={form.department}
            onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
            placeholder="VD: Kinh doanh, Kế toán, Xưởng sản xuất…" />
        </Field>
        <Field label="Chức vụ">
          <input className={inputCls} value={form.position}
            onChange={e => setForm(f => ({ ...f, position: e.target.value }))}
            placeholder="VD: Trưởng phòng, Nhân viên, Thực tập sinh…" />
        </Field>
      </div>
      <div className="flex gap-2 pt-3">
        <SecondaryButton onClick={onClose} className="flex-1">Huỷ</SecondaryButton>
        <PrimaryButton onClick={submit} loading={saving} className="flex-1">Lưu</PrimaryButton>
      </div>
    </Modal>
  );
}

// ── Create Leave Modal ────────────────────────────────────────────────────────
function CreateLeaveModal({ users, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({
    userId: '', leaveType: 'PAID', leaveDate: '', leaveEndDate: '',
    leaveDays: '', handoverTo: '', contactPhone: '', note: '',
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.userId || !form.leaveDate) return toast('Chọn nhân viên và ngày nghỉ', 'error');
    setSaving(true);
    try {
      await hrLeaveApi.create({
        userId: Number(form.userId),
        leaveType: form.leaveType,
        leaveDate: new Date(form.leaveDate).getTime(),
        leaveEndDate: form.leaveEndDate ? new Date(form.leaveEndDate).getTime() : new Date(form.leaveDate).getTime(),
        leaveDays: Number(form.leaveDays) || 1,
        handoverTo: form.handoverTo,
        contactPhone: form.contactPhone,
        note: form.note,
      });
      toast('Đã tạo phiếu nghỉ', 'success');
      onSaved();
      onClose();
    } catch (e) {
      toast(e.message || t('common', 'error'), 'error');
    } finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title="Tạo phiếu nghỉ" size="lg">
      <div className="space-y-3 py-1">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nhân viên" required>
            <select className={selectCls} value={form.userId} onChange={e => set('userId', e.target.value)}>
              <option value="">— Chọn —</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
            </select>
          </Field>
          <Field label="Loại nghỉ">
            <select className={selectCls} value={form.leaveType} onChange={e => set('leaveType', e.target.value)}>
              <option value="PAID">Có lương</option>
              <option value="UNPAID">Không lương</option>
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Từ ngày" required>
            <input type="date" className={inputCls} value={form.leaveDate}
              onChange={e => set('leaveDate', e.target.value)} />
          </Field>
          <Field label="Đến ngày">
            <input type="date" className={inputCls} value={form.leaveEndDate}
              onChange={e => set('leaveEndDate', e.target.value)} />
          </Field>
          <Field label="Số ngày nghỉ" required>
            <input type="number" step="0.5" className={inputCls} value={form.leaveDays}
              onChange={e => set('leaveDays', e.target.value)} placeholder="VD: 1, 0.5" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Bàn giao cho">
            <input className={inputCls} value={form.handoverTo}
              onChange={e => set('handoverTo', e.target.value)} placeholder="Tên người nhận bàn giao" />
          </Field>
          <Field label="SĐT liên lạc">
            <input className={inputCls} value={form.contactPhone}
              onChange={e => set('contactPhone', e.target.value)} placeholder="090xxxxxxx" />
          </Field>
        </div>
        <Field label="Ghi chú">
          <textarea className={inputCls} rows={2} value={form.note}
            onChange={e => set('note', e.target.value)} />
        </Field>
      </div>
      <div className="flex gap-2 pt-3">
        <SecondaryButton onClick={onClose} className="flex-1">Huỷ</SecondaryButton>
        <PrimaryButton onClick={submit} loading={saving} className="flex-1">Tạo phiếu</PrimaryButton>
      </div>
    </Modal>
  );
}

// ── Create OT Modal ───────────────────────────────────────────────────────────
function CreateOtModal({ users, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({
    otDate: '', startTime: '18:00', endTime: '22:00', otHours: '',
    reason: '', userIds: [],
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleUser = (id) => setForm(f => ({
    ...f,
    userIds: f.userIds.includes(id) ? f.userIds.filter(x => x !== id) : [...f.userIds, id],
  }));

  const submit = async () => {
    if (!form.otDate || form.userIds.length === 0) return toast('Cần chọn ngày và ít nhất 1 nhân viên', 'error');
    setSaving(true);
    try {
      await hrOtApi.create({
        otDate: new Date(form.otDate).getTime(),
        startTime: form.startTime,
        endTime: form.endTime,
        otHours: Number(form.otHours) || 0,
        reason: form.reason,
        userIds: form.userIds,
      });
      toast('Đã tạo đơn OT', 'success');
      onSaved();
      onClose();
    } catch (e) {
      toast(e.message || t('common', 'error'), 'error');
    } finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title="Tạo đơn OT" size="lg">
      <div className="space-y-3 py-1">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Ngày OT" required>
            <input type="date" className={inputCls} value={form.otDate}
              onChange={e => set('otDate', e.target.value)} />
          </Field>
          <Field label="Số giờ OT" required>
            <input type="number" step="0.5" className={inputCls} value={form.otHours}
              onChange={e => set('otHours', e.target.value)} placeholder="VD: 4" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Giờ bắt đầu">
            <input type="time" className={inputCls} value={form.startTime}
              onChange={e => set('startTime', e.target.value)} />
          </Field>
          <Field label="Giờ kết thúc">
            <input type="time" className={inputCls} value={form.endTime}
              onChange={e => set('endTime', e.target.value)} />
          </Field>
        </div>
        <Field label="Lý do OT" required>
          <textarea className={inputCls} rows={2} value={form.reason}
            onChange={e => set('reason', e.target.value)} placeholder="Lý do làm thêm giờ…" />
        </Field>
        <Field label={`Nhân viên OT (đã chọn ${form.userIds.length})`} required>
          <div className="max-h-48 overflow-y-auto space-y-1 border border-black/10 rounded-xl p-2">
            {users.map(u => {
              const checked = form.userIds.includes(u.id);
              return (
                <label key={u.id} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-colors
                  ${checked ? 'bg-amber-50 border border-amber-200' : 'bg-[#FAF7F2] border border-transparent hover:border-[#E8DDD0]'}`}>
                  <input type="checkbox" checked={checked} onChange={() => toggleUser(u.id)}
                    className="w-4 h-4 accent-amber-500 rounded" />
                  <span className={`text-sm font-medium ${checked ? 'text-amber-700' : 'text-[#1C1C1E]'}`}>{u.fullName}</span>
                  {u.department && <span className="text-xs text-[#8E8878]">({u.department})</span>}
                </label>
              );
            })}
          </div>
        </Field>
      </div>
      <div className="flex gap-2 pt-3">
        <SecondaryButton onClick={onClose} className="flex-1">Huỷ</SecondaryButton>
        <PrimaryButton onClick={submit} loading={saving} className="flex-1">Tạo đơn OT</PrimaryButton>
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
  const [selected, setSelected] = useState([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [salaryModal, setSalaryModal] = useState(null);
  const [batchModal, setBatchModal] = useState(false);
  const [infoModal, setInfoModal] = useState(null);

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

  const toggleAll = () =>
    setSelected(selected.length === users.length ? [] : users.map(u => u.id));
  const toggleOne = (id) =>
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8878]" />
          <input className={`${inputCls} pl-8`} value={q}
            onChange={e => { setQ(e.target.value); setPage(0); }}
            placeholder="Tìm nhân viên…" />
        </div>
        {selected.length > 1 && (
          <PrimaryButton onClick={() => setBatchModal(true)}>
            <DollarSign size={14} /> Set lương ({selected.length})
          </PrimaryButton>
        )}
      </div>

      <SectionCard>
        {loading ? <LoadingSpinner /> : users.length === 0 ? (
          <EmptyState icon={Users} title="Không có nhân viên" />
        ) : (
          <Table>
            <Thead>
              <Tr>
                <Th><input type="checkbox" checked={selected.length === users.length && users.length > 0}
                  onChange={toggleAll} className="w-4 h-4 accent-amber-500" /></Th>
                <Th>Họ tên</Th>
                <Th>Bộ phận</Th>
                <Th>Chức vụ</Th>
                <Th right>Thao tác</Th>
              </Tr>
            </Thead>
            <tbody>
              {users.map(u => (
                <Tr key={u.id}>
                  <Td><input type="checkbox" checked={selected.includes(u.id)}
                    onChange={() => toggleOne(u.id)} className="w-4 h-4 accent-amber-500" /></Td>
                  <Td>
                    <div className="font-medium text-[#1C1C1E]">{u.fullName}</div>
                    <div className="text-xs text-[#8E8878]">{u.username}</div>
                  </Td>
                  <Td><span className="text-sm">{u.department || '—'}</span></Td>
                  <Td><span className="text-sm">{u.position || '—'}</span></Td>
                  <Td right>
                    <div className="flex gap-1 justify-end">
                      <SecondaryButton className="!px-2.5 !py-1.5 text-xs" onClick={() => setInfoModal(u)}>
                        <UserCog size={12} /> Phòng ban
                      </SecondaryButton>
                      <PrimaryButton className="!px-2.5 !py-1.5 text-xs" onClick={() => setSalaryModal(u)}>
                        <DollarSign size={12} /> Lương
                      </PrimaryButton>
                    </div>
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

      {salaryModal && <SalaryModal user={salaryModal} onClose={() => setSalaryModal(null)} onSaved={load} />}
      {batchModal && <BatchSalaryModal userIds={selected} onClose={() => setBatchModal(false)} onSaved={() => { setBatchModal(false); setSelected([]); }} />}
      {infoModal && <InfoModal user={infoModal} onClose={() => setInfoModal(null)} onSaved={load} />}
    </div>
  );
}

// ── Leaves Tab ────────────────────────────────────────────────────────────────
function LeavesTab() {
  const toast = useToast();
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [users, setUsers] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await hrLeaveApi.list({ page, size: 20 });
      setLeaves(data.content ?? data);
      setTotalPages(data.totalPages ?? 1);
    } catch { toast('Không tải được phiếu nghỉ', 'error'); }
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    adminUserApi.list({ size: 200 }).then(d => setUsers(d.content ?? d)).catch(() => { });
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <PrimaryButton onClick={() => setShowCreate(true)}>
          <Plus size={14} /> Tạo phiếu nghỉ
        </PrimaryButton>
      </div>

      <SectionCard>
        {loading ? <LoadingSpinner /> : leaves.length === 0 ? (
          <EmptyState icon={Calendar} title="Chưa có phiếu nghỉ nào" />
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
                <Th>Ngày tạo</Th>
              </Tr>
            </Thead>
            <tbody>
              {leaves.map(l => (
                <Tr key={l.id}>
                  <Td>
                    <div className="font-medium">{l.userFullName}</div>
                    {l.department && <div className="text-xs text-[#8E8878]">{l.department}</div>}
                  </Td>
                  <Td>
                    <Badge variant={l.leaveType === 'PAID' ? 'success' : 'warning'}>
                      {LEAVE_TYPE_LABEL[l.leaveType] || l.leaveType}
                    </Badge>
                  </Td>
                  <Td>{formatDate(l.leaveDate)}</Td>
                  <Td>{formatDate(l.leaveEndDate)}</Td>
                  <Td>{l.leaveDays} ngày</Td>
                  <Td>{l.handoverTo || '—'}</Td>
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

      {showCreate && <CreateLeaveModal users={users} onClose={() => setShowCreate(false)} onSaved={load} />}
    </div>
  );
}

// ── OT Tab ────────────────────────────────────────────────────────────────────
function OtTab() {
  const toast = useToast();
  const [ots, setOts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [users, setUsers] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await hrOtApi.list({ page, size: 20 });
      setOts(data.content ?? data);
      setTotalPages(data.totalPages ?? 1);
    } catch { toast('Không tải được đơn OT', 'error'); }
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    adminUserApi.list({ size: 200 }).then(d => setUsers(d.content ?? d)).catch(() => { });
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <PrimaryButton onClick={() => setShowCreate(true)}>
          <Plus size={14} /> Tạo đơn OT
        </PrimaryButton>
      </div>

      <SectionCard>
        {loading ? <LoadingSpinner /> : ots.length === 0 ? (
          <EmptyState icon={Clock} title="Chưa có đơn OT nào" />
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
              {ots.map(o => (
                <Tr key={o.id}>
                  <Td>{formatDate(o.otDate)}</Td>
                  <Td>{o.startTime} — {o.endTime}</Td>
                  <Td>{o.otHours}h</Td>
                  <Td>
                    <div className="text-sm">
                      {(o.employees || []).map(e => e.fullName).join(', ')}
                    </div>
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

      {showCreate && <CreateOtModal users={users} onClose={() => setShowCreate(false)} onSaved={load} />}
    </div>
  );
}

// ── Driver Report Export Modal ────────────────────────────────────────────────
function DriverReportModal({ onClose }) {
  const toast = useToast();
  const [from, setFrom] = useState(null);
  const [to, setTo] = useState(null);
  const [bikeRate, setBikeRate] = useState('');
  const [truckRate, setTruckRate] = useState('');
  const [exporting, setExporting] = useState(false);

  const fmt = (d) => {
    if (!d) return '';
    return new Date(d).toLocaleDateString('vi-VN');
  };

  const handleExport = async () => {
    if (!from || !to) { toast('Chọn khoảng thời gian', 'error'); return; }
    setExporting(true);
    try {
      const params = new URLSearchParams({
        from: String(from),
        to: String(to),
        excludeWarehouse: 'true',
        bikeRatePerKm: bikeRate || '0',
        truckRatePerKm: truckRate || '0',
      });
      const res = await api.get(`/api/admin/users/reports?${params}`, { responseType: 'blob' });
      downloadBlob(res.data, `bao-cao-tai-xe-${from}_${to}.xlsx`);
      toast('Xuất báo cáo thành công', 'success');
      onClose();
    } catch { toast('Lỗi xuất báo cáo', 'error'); }
    finally { setExporting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#1A1A2E] to-[#2D2D44] px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
              <Download size={16} className="text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">Báo cáo & Lương tài xế</h3>
              <p className="text-white/60 text-[10px]">Xuất file Excel chuyên nghiệp</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30">
            <X size={14} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Date range */}
          <div>
            <p className="text-[10px] font-bold text-[#8E8878] uppercase tracking-wider mb-2">KHOẢNG THỜI GIAN</p>
            <DateRangePicker
              from={from}
              to={to}
              onChange={({ from, to }) => {
                setFrom(from);
                setTo(to);
              }}
              placeholder="Chọn khoảng thời gian"
            />
          </div>

          {/* Salary rates */}
          <div>
            <p className="text-[10px] font-bold text-[#8E8878] uppercase tracking-wider mb-2">Lương theo km</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-sky-50 border border-sky-200 p-3">
                <label className="block text-[11px] font-bold text-sky-700 mb-1.5">🏍️ Xe máy (đ/km)</label>
                <input type="number" min="0" value={bikeRate} onChange={e => setBikeRate(e.target.value)}
                  placeholder="VD: 2000"
                  className="w-full h-8 px-2 rounded-lg border border-sky-200 text-sm focus:outline-none focus:border-sky-400 bg-white" />
              </div>
              <div className="rounded-xl bg-orange-50 border border-orange-200 p-3">
                <label className="block text-[11px] font-bold text-orange-700 mb-1.5">🚛 Xe tải (đ/km)</label>
                <input type="number" min="0" value={truckRate} onChange={e => setTruckRate(e.target.value)}
                  placeholder="VD: 5000"
                  className="w-full h-8 px-2 rounded-lg border border-orange-200 text-sm focus:outline-none focus:border-orange-400 bg-white" />
              </div>
            </div>
            <p className="text-[10px] text-[#8E8878] mt-1.5 italic">Để trống = không tính lương km (chỉ thống kê)</p>
          </div>
        </div>

        <div className="flex gap-2 px-5 pb-5 pt-3 border-t border-[#E8DDD0]">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[#E8DDD0] text-sm text-[#5C5C5C] hover:bg-[#F0EBE3] font-medium">Hủy</button>
          <button onClick={handleExport} disabled={exporting || !from || !to}
            className="flex-1 py-2.5 rounded-xl bg-[#1A1A2E] text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#2D2D44] disabled:opacity-40 transition-colors">
            {exporting
              ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Đang xuất...</>
              : <><Download size={14} /> Xuất Excel</>}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function HrPage() {
  const { t } = useLang();
  const [tab, setTab] = useState('employees');
  const [showDriverReport, setShowDriverReport] = useState(false);

  const LEAVE_TYPE_LABEL = { PAID: t('hr', 'leave_paid'), UNPAID: t('hr', 'leave_unpaid') };

  const TABS = [
    { id: 'employees', label: 'Quản lý nhân viên', icon: Users },
    { id: 'leaves', label: 'Phiếu nghỉ', icon: Calendar },
    { id: 'ot', label: 'Phiếu OT', icon: Clock },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <PageHeader icon={UserCog} title="Nhân sự" subtitle="Quản lý lương, nghỉ phép, tăng ca" />
        <button onClick={() => setShowDriverReport(true)}
          className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1A1A2E] text-white text-sm font-semibold hover:bg-[#2D2D44] transition-colors shadow-sm mt-1">
          <Download size={14} /> Báo cáo tài xế
        </button>
      </div>
      <TabBar tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'employees' && <EmployeesTab />}
      {tab === 'leaves' && <LeavesTab />}
      {tab === 'ot' && <OtTab />}
      {showDriverReport && <DriverReportModal onClose={() => setShowDriverReport(false)} />}
    </div>
  );
}