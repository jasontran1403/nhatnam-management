// src/pages/admin/AdminUsers.jsx
import { useEffect, useState, useCallback } from 'react';
import { Sk, TableSkeleton } from '../../components/ui/Skeleton.jsx';
import useMinLoading from '../../hooks/useMinLoading.js';
import {
  UserCog, Plus, Search, Lock, Unlock, KeyRound, Edit2, X, Check, AlertCircle,
} from 'lucide-react';
import { adminUserApi } from '../../api/adminApi';
import { useAuth } from '../../context/AuthContext';
import useDebounce from '../../utils/useDebounce.js';
import { Badge } from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import Pagination from '../../components/ui/Pagination';
import {
  PageHeader, LoadingSpinner, EmptyState, PrimaryButton, SecondaryButton,
  DangerButton, Field, inputCls, formatNumber, formatDateTime,
} from '../../components/ui';

const ROLE_CONFIG = [
  { value: 'OWNER',           label: 'Chủ tịch' },
  { value: 'ADMIN',           label: 'Giám đốc' },
  { value: 'SUPER_ACCOUNTANT',label: 'Kế toán trưởng' },
  { value: 'ACCOUNTANT',      label: 'Kế toán' },
  { value: 'SUPER_SELLER',    label: 'Trưởng phòng kinh doanh' },
  { value: 'SELLER',          label: 'Nhân viên kinh doanh' },
  { value: 'SUPER_WAREHOUSE', label: 'Trưởng xưởng' },
  { value: 'WAREHOUSE',       label: 'Nhân viên kho' },
  { value: 'OPERATOR',        label: 'Nhân viên nhập liệu' },
  { value: 'FACTORY_WORKER',  label: 'Nhân viên xưởng SX' },
  { value: 'HR',              label: 'Nhân viên nhân sự' },
];
const ADMIN_ROLES = ROLE_CONFIG.filter(r => r.value !== 'OWNER');
const ROLE_LABEL  = Object.fromEntries(ROLE_CONFIG.map(r => [r.value, r.label]));

// ── Các cặp role XUNG ĐỘT — không được tồn tại cùng nhau ─────────────────────
// Mỗi phần tử là 1 nhóm loại trừ lẫn nhau
const CONFLICT_GROUPS = [
  ['ACCOUNTANT',      'SUPER_ACCOUNTANT'],
  ['WAREHOUSE',       'SUPER_WAREHOUSE'],
  ['SELLER',          'SUPER_SELLER'],
  ['OWNER',           'ADMIN'],
];

/**
 * Trả về role xung đột với `adding` trong danh sách `current`,
 * hoặc null nếu không có xung đột.
 */
function findConflict(current, adding) {
  for (const group of CONFLICT_GROUPS) {
    if (!group.includes(adding)) continue;
    const conflicting = group.find(r => r !== adding && current.includes(r));
    if (conflicting) return conflicting;
  }
  return null;
}

/**
 * Trả về tên của nhóm xung đột mà `role` thuộc về (để hiển thị hint),
 * hoặc null nếu không bị disabled.
 */
function getDisabledReason(selected, candidate) {
  for (const group of CONFLICT_GROUPS) {
    if (!group.includes(candidate)) continue;
    const blocking = group.find(r => r !== candidate && selected.includes(r));
    if (blocking) return `Xung đột với "${ROLE_LABEL[blocking]}"`;
  }
  return null;
}

function canManageUser(currentUserRole, targetUser) {
  if (currentUserRole === 'OWNER') return true;
  const isTargetOwner = targetUser?.roles?.includes('OWNER') || targetUser?.role === 'OWNER';
  return !isTargetOwner;
}

// ── Multi-role picker ─────────────────────────────────────────────────────────
function RolePicker({ selected, onChange, availableRoles }) {
  const [conflictMsg, setConflictMsg] = useState('');

  const toggle = (val) => {
    setConflictMsg('');

    if (selected.includes(val)) {
      // Bỏ role — không cho bỏ nếu chỉ còn 1
      if (selected.length === 1) return;
      onChange(selected.filter(r => r !== val));
    } else {
      // Thêm role — kiểm tra xung đột
      const conflict = findConflict(selected, val);
      if (conflict) {
        setConflictMsg(
          `"${ROLE_LABEL[val]}" không thể đi chung với "${ROLE_LABEL[conflict]}". Bỏ chọn "${ROLE_LABEL[conflict]}" trước.`
        );
        return;
      }
      onChange([...selected, val]);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {availableRoles.map(r => {
          const active        = selected.includes(r.value);
          const disabledReason = !active ? getDisabledReason(selected, r.value) : null;
          const isDisabled    = !!disabledReason;

          return (
            <button
              key={r.value}
              type="button"
              onClick={() => toggle(r.value)}
              disabled={isDisabled}
              title={disabledReason ?? undefined}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition
                ${active
                  ? 'bg-[#C9A84C] text-white border-[#C9A84C]'
                  : isDisabled
                    ? 'bg-[#FAF7F2] text-[#C4B9A8] border-black/5 cursor-not-allowed opacity-60'
                    : 'bg-white text-[#555] border-black/10 hover:border-[#C9A84C] hover:text-[#C9A84C]'
                }`}
            >
              {active && <Check size={11} />}
              {r.label}
            </button>
          );
        })}
      </div>

      {/* Conflict error message */}
      {conflictMsg && (
        <div className="flex items-start gap-1.5 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <AlertCircle size={13} className="mt-0.5 flex-shrink-0" />
          <span>{conflictMsg}</span>
        </div>
      )}

      {/* Info khi chọn nhiều role */}
      {selected.length > 1 && !conflictMsg && (
        <p className="text-xs text-[#8E8878]">
          Khi đăng nhập, user sẽ được chọn role muốn sử dụng trong phiên đó.
        </p>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AdminUsers() {
  const { user: currentUser } = useAuth();
  const [filters, setFilters]  = useState({ q: '', role: '', locked: '' });
  const debouncedQ = useDebounce(filters.q, 600);

  const [page, setPage]     = useState(0);
  const [data, setData]     = useState({ content: [], totalPages: 0, totalElements: 0 });
  const [loading, setLoading] = useMinLoading();

  const [formOpen, setFormOpen]     = useState(false);
  const [editing, setEditing]       = useState(null);
  const [saving, setSaving]         = useState(false);
  const [lockConfirm, setLockConfirm] = useState(null);
  const [pwdTarget, setPwdTarget]   = useState(null);
  const [newPwd, setNewPwd]         = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, size: 20, sort: 'id,desc' };
      if (debouncedQ)        params.q      = debouncedQ;
      if (filters.role)      params.role   = filters.role;
      if (filters.locked !== '') params.locked = filters.locked;
      const res = await adminUserApi.list(params);
      setData(res);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [page, debouncedQ, filters.role, filters.locked]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setFormOpen(true); };
  const openEdit   = (u) => { setEditing(u);   setFormOpen(true); };

  const toggleLock = async () => {
    if (!lockConfirm) return;
    setSaving(true);
    try {
      await adminUserApi.setLocked(lockConfirm.id, !lockConfirm.isLockAccount);
      setLockConfirm(null); load();
    } catch (e) { alert(e?.response?.data?.message || e.message); }
    finally { setSaving(false); }
  };

  const submitPwd = async () => {
    if (!newPwd || newPwd.length < 6) { alert('Mật khẩu tối thiểu 6 ký tự'); return; }
    setSaving(true);
    try {
      await adminUserApi.resetPassword(pwdTarget.id, newPwd);
      setPwdTarget(null); setNewPwd('');
      alert('Đổi mật khẩu thành công');
    } catch (e) { alert(e?.response?.data?.message || e.message); }
    finally { setSaving(false); }
  };

  const renderRoleBadges = (u) => {
    const roles = u.roles?.length ? [...u.roles] : (u.role ? [u.role] : []);
    return roles.map(r => (
      <Badge key={r} className="bg-slate-50 text-slate-700 ring-slate-200">
        {ROLE_LABEL[r] || r}
      </Badge>
    ));
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5">
      <PageHeader
        icon={UserCog}
        title="Người dùng"
        subtitle={`Tổng ${formatNumber(data.totalElements)} tài khoản`}
        action={<PrimaryButton onClick={openCreate}><Plus size={15} /> Thêm user</PrimaryButton>}
      />

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-black/5 p-3 sm:p-4 shadow-sm flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8878]" size={16} />
          <input
            type="text"
            placeholder="Tìm username, họ tên, email..."
            value={filters.q}
            onChange={e => { setFilters({ ...filters, q: e.target.value }); setPage(0); }}
            onKeyDown={e => { if (e.key === 'Escape') { setFilters({ ...filters, q: '' }); setPage(0); } }}
            className={`${inputCls} pl-9 pr-9`}
          />
          {filters.q && (
            <button type="button" onClick={() => { setFilters({ ...filters, q: '' }); setPage(0); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8E8878] hover:text-[#1C1C1E]">
              <X size={16} />
            </button>
          )}
        </div>
        <select value={filters.role}
          onChange={e => { setFilters({ ...filters, role: e.target.value }); setPage(0); }}
          className={`${inputCls} sm:w-44`}>
          <option value="">Tất cả quyền</option>
          {ROLE_CONFIG.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <select value={filters.locked}
          onChange={e => { setFilters({ ...filters, locked: e.target.value }); setPage(0); }}
          className={`${inputCls} sm:w-40`}>
          <option value="">Tất cả trạng thái</option>
          <option value="false">Đang hoạt động</option>
          <option value="true">Đã khóa</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
        {loading ? (
        <TableSkeleton cols={5} rows={8} />
      ) : data.content.length === 0 ? (
          <EmptyState icon={UserCog} title="Không có user nào" />
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#FAF7F2] text-[#8E8878]">
                    <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider">User</th>
                    <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider">Liên hệ</th>
                    <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider">Quyền</th>
                    <th className="px-4 py-3 text-center font-semibold text-xs uppercase tracking-wider">Trạng thái</th>
                    <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider">Tạo lúc</th>
                    <th className="px-4 py-3 text-right font-semibold text-xs uppercase tracking-wider">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {data.content.map(u => (
                    <tr key={u.id} className="border-t border-black/5 hover:bg-[#FAF7F2]/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#C9A84C] to-[#A07830] flex items-center justify-center text-white text-xs font-bold shrink-0">
                            {(u.fullName || u.username || '?')[0]?.toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-[#1C1C1E] truncate">{u.fullName || u.username}</p>
                            <p className="text-xs text-[#8E8878] truncate">@{u.username}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-[#1C1C1E] text-xs truncate max-w-[180px]">{u.email || '—'}</p>
                        <p className="text-xs text-[#8E8878]">{u.phoneNumber || '—'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {renderRoleBadges(u)}
                          {/* Hiển thị tất cả kho được phân công */}
                          {u.warehouses?.length > 0
                            ? u.warehouses.map(w => (
                                <Badge key={w.id} className="bg-sky-50 text-sky-600 ring-sky-100 text-[10px]">
                                  🏭 {w.name}
                                </Badge>
                              ))
                            : u.warehouseName && (
                                <Badge className="bg-sky-50 text-sky-600 ring-sky-100 text-[10px]">
                                  🏭 {u.warehouseName}
                                </Badge>
                              )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {u.isLockAccount
                          ? <Badge className="bg-red-50 text-red-700 ring-red-200">Đã khóa</Badge>
                          : <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-200">Hoạt động</Badge>}
                      </td>
                      <td className="px-4 py-3 text-xs text-[#8E8878] whitespace-nowrap">{formatDateTime(u.timeCreate)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {canManageUser(currentUser?.role, u) ? (
                            <>
                              <button onClick={() => openEdit(u)} className="p-2 rounded-lg text-[#8E8878] hover:bg-[#FAF7F2] hover:text-[#1C1C1E]" title="Sửa">
                                <Edit2 size={15} />
                              </button>
                              <button onClick={() => setPwdTarget(u)} className="p-2 rounded-lg text-[#8E8878] hover:bg-[#C9A84C]/10 hover:text-[#C9A84C]" title="Đổi mật khẩu">
                                <KeyRound size={15} />
                              </button>
                              <button onClick={() => setLockConfirm(u)}
                                className={`p-2 rounded-lg transition-colors ${u.isLockAccount ? 'text-[#8E8878] hover:bg-emerald-50 hover:text-emerald-600' : 'text-[#8E8878] hover:bg-red-50 hover:text-red-600'}`}
                                title={u.isLockAccount ? 'Mở khóa' : 'Khóa'}>
                                {u.isLockAccount ? <Unlock size={15} /> : <Lock size={15} />}
                              </button>
                            </>
                          ) : (
                            <span className="text-xs text-[#C4B9A8] italic px-2">Không có quyền</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="md:hidden divide-y divide-black/5">
              {data.content.map(u => (
                <div key={u.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#C9A84C] to-[#A07830] flex items-center justify-center text-white text-sm font-bold shrink-0">
                      {(u.fullName || u.username)[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[#1C1C1E] truncate">{u.fullName || u.username}</p>
                      <p className="text-xs text-[#8E8878] truncate">@{u.username} · {u.email}</p>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {renderRoleBadges(u)}
                        {u.isLockAccount
                          ? <Badge className="bg-red-50 text-red-700 ring-red-200">Đã khóa</Badge>
                          : <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-200">Hoạt động</Badge>}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    {canManageUser(currentUser?.role, u) ? (
                      <>
                        <button onClick={() => openEdit(u)} className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-[#FAF7F2] text-[#1C1C1E]">Sửa</button>
                        <button onClick={() => setPwdTarget(u)} className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-[#C9A84C]/10 text-[#C9A84C]">Mật khẩu</button>
                        <button onClick={() => setLockConfirm(u)}
                          className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium ${u.isLockAccount ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                          {u.isLockAccount ? 'Mở khóa' : 'Khóa'}
                        </button>
                      </>
                    ) : (
                      <p className="text-xs text-[#C4B9A8] italic py-2">Không có quyền thao tác</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        {!loading && data.content.length > 0 && (
          <Pagination page={page} totalPages={data.totalPages} onChange={setPage} />
        )}
      </div>

      {formOpen && (
        <UserFormModal
          open={formOpen}
          editing={editing}
          currentUserRole={currentUser?.role}
          onClose={() => setFormOpen(false)}
          onSaved={() => { setFormOpen(false); load(); }}
        />
      )}

      {/* Lock confirm */}
      <Modal open={!!lockConfirm} onClose={() => !saving && setLockConfirm(null)}
        title={lockConfirm?.isLockAccount ? 'Mở khóa user' : 'Khóa user'} size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <SecondaryButton onClick={() => setLockConfirm(null)} disabled={saving}>Hủy</SecondaryButton>
            {lockConfirm?.isLockAccount
              ? <PrimaryButton onClick={toggleLock} loading={saving}>Mở khóa</PrimaryButton>
              : <DangerButton onClick={toggleLock} loading={saving}>Khóa</DangerButton>}
          </div>
        }>
        <p className="text-sm text-[#1C1C1E]">
          Bạn có chắc muốn {lockConfirm?.isLockAccount ? 'mở khóa' : 'khóa'} user{' '}
          <span className="font-semibold">{lockConfirm?.username}</span>?
        </p>
      </Modal>

      {/* Reset password */}
      <Modal open={!!pwdTarget} onClose={() => !saving && setPwdTarget(null)}
        title="Đổi mật khẩu" size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <SecondaryButton onClick={() => setPwdTarget(null)} disabled={saving}>Hủy</SecondaryButton>
            <PrimaryButton onClick={submitPwd} loading={saving}>Xác nhận</PrimaryButton>
          </div>
        }>
        <p className="text-sm text-[#1C1C1E] mb-3">User: <span className="font-semibold">@{pwdTarget?.username}</span></p>
        <Field label="Mật khẩu mới" required hint="Tối thiểu 6 ký tự">
          <input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} className={inputCls} />
        </Field>
      </Modal>
    </div>
  );
}

// ── UserFormModal ─────────────────────────────────────────────────────────────
function UserFormModal({ open, editing, onClose, onSaved, currentUserRole }) {
  const availableRoles = currentUserRole === 'OWNER' ? ROLE_CONFIG : ADMIN_ROLES;

  const initRoles = () => {
    if (editing) {
      if (editing.roles?.length) return [...editing.roles];
      if (editing.role) return [editing.role];
    }
    return ['SELLER'];
  };

  const [selectedRoles, setSelectedRoles] = useState(initRoles);
  const [form, setForm] = useState({
    username:    editing?.username    || '',
    password:    '',
    fullName:    editing?.fullName    || '',
    email:       editing?.email       || '',
    phoneNumber: editing?.phoneNumber || '',
    warehouseId: editing?.warehouseId ? String(editing.warehouseId) : '',
  });
  // Multi-warehouse selection
  const initWarehouseIds = editing?.warehouses?.map(w => String(w.id)) || 
                           (editing?.warehouseId ? [String(editing.warehouseId)] : []);
  const [selectedWarehouseIds, setSelectedWarehouseIds] = useState(initWarehouseIds);
  const [saving, setSaving]     = useState(false);
  const [err, setErr]           = useState('');
  const [warehouses, setWarehouses] = useState([]);

  useEffect(() => {
    import('../../api/adminApi').then(({ adminWarehouseApi }) => {
      adminWarehouseApi.list().then(whs => setWarehouses(whs || [])).catch(() => {});
    });
  }, []);

  const needsWarehouse = selectedRoles.includes('WAREHOUSE') || selectedRoles.includes('SUPER_WAREHOUSE');

  const toggleWarehouse = (wId) => {
    setSelectedWarehouseIds(prev =>
      prev.includes(String(wId))
        ? prev.filter(id => id !== String(wId))
        : [...prev, String(wId)]
    );
  };

  // Validate toàn bộ danh sách roles trước khi submit
  const validateRoles = (roles) => {
    for (const group of CONFLICT_GROUPS) {
      const hits = group.filter(r => roles.includes(r));
      if (hits.length > 1) {
        return `"${ROLE_LABEL[hits[0]]}" và "${ROLE_LABEL[hits[1]]}" không thể đi chung nhau.`;
      }
    }
    return null;
  };

  const submit = async (e) => {
    e.preventDefault();
    setErr('');

    if (!editing && (!form.username || !form.password || !form.fullName)) {
      setErr('Username, password, họ tên là bắt buộc'); return;
    }
    if (selectedRoles.length === 0) {
      setErr('Phải chọn ít nhất 1 quyền'); return;
    }
    if (needsWarehouse && selectedWarehouseIds.length === 0) {
      setErr('Phải chọn ít nhất 1 kho cho role kho'); return;
    }

    const conflictErr = validateRoles(selectedRoles);
    if (conflictErr) { setErr(conflictErr); return; }

    setSaving(true);
    try {
      const payload = {
        ...form,
        roles:        selectedRoles,
        role:         selectedRoles[0],
        warehouseId:  selectedWarehouseIds.length > 0 ? Number(selectedWarehouseIds[0]) : null,
        warehouseIds: selectedWarehouseIds.map(Number),
      };
      if (editing) {
        await adminUserApi.update(editing.id, payload);
      } else {
        await adminUserApi.create(payload);
      }
      onSaved();
    } catch (e) {
      setErr(e?.response?.data?.message || e.message);
    } finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose}
      title={editing ? `Sửa user: @${editing.username}` : 'Thêm user mới'}
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose} disabled={saving}>Hủy</SecondaryButton>
          <PrimaryButton onClick={submit} loading={saving}>{editing ? 'Cập nhật' : 'Tạo user'}</PrimaryButton>
        </div>
      }>
      <form onSubmit={submit} className="space-y-4">
        {err && (
          <div className="flex items-start gap-2 bg-red-50 text-red-700 text-sm p-3 rounded-xl border border-red-200">
            <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
            <span>{err}</span>
          </div>
        )}

        {!editing && (
          <>
            <Field label="Username" required>
              <input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Password" required hint="Tối thiểu 6 ký tự">
              <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className={inputCls} />
            </Field>
          </>
        )}

        <Field label="Họ tên" required={!editing}>
          <input value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} className={inputCls} />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Email">
            <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Số điện thoại">
            <input value={form.phoneNumber} onChange={e => setForm({ ...form, phoneNumber: e.target.value })} className={inputCls} />
          </Field>
        </div>

        <Field label="Quyền" required hint="Một số quyền không thể kết hợp với nhau">
          <RolePicker
            selected={selectedRoles}
            onChange={setSelectedRoles}
            availableRoles={availableRoles}
          />
        </Field>

        {needsWarehouse && (
          <Field label="Kho được phân công" required
            hint="Có thể chọn nhiều kho — tài khoản sẽ quản lý tất cả kho đã chọn">
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {warehouses.length === 0 && (
                <p className="text-xs text-[#8E8878] italic py-1">Chưa có kho nào</p>
              )}
              {warehouses.map(w => {
                const checked = selectedWarehouseIds.includes(String(w.id));
                return (
                  <label key={w.id}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-colors
                      ${checked ? 'bg-amber-50 border border-amber-200' : 'bg-[#FAF7F2] border border-transparent hover:border-[#E8DDD0]'}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleWarehouse(w.id)}
                      className="w-4 h-4 accent-amber-500 rounded"
                    />
                    <span className={`text-sm font-medium ${checked ? 'text-amber-700' : 'text-[#1C1C1E]'}`}>
                      {w.name}
                    </span>
                    {w.type === 'TRANSIT' && (
                      <span className="ml-auto text-[10px] text-[#8E8878] bg-[#F0EBE3] px-1.5 py-0.5 rounded">Trung chuyển</span>
                    )}
                  </label>
                );
              })}
            </div>
          </Field>
        )}
      </form>
    </Modal>
  );
}