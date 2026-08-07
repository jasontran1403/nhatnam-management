// src/pages/admin/AdminUsers.jsx
import { useLang } from '../../context/LangContext';
import { useEffect, useState, useCallback } from 'react';
import { Sk, TableSkeleton } from '../../components/ui/Skeleton.jsx';
import useMinLoading from '../../hooks/useMinLoading.js';
import {
  UserCog, Plus, Search, Lock, Unlock, KeyRound, Edit2, X, Check, AlertCircle, Trash2,
  DollarSign, CalendarClock, ShieldAlert, Gauge, ClipboardSignature,
} from 'lucide-react';
import { adminUserApi } from '../../api/adminApi';
import { payrollPasscodeApi } from '../../api/payrollPasscodeApi';
import { SubPageButtons } from '../../components/common/SubPageNav';
import UserSalaryModal from '../../components/admin/UserSalaryModal';
import UserRequestsModal from '../../components/admin/UserRequestsModal';
import PayrollUnlockModal from '../../components/admin/PayrollUnlockModal';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/common/Toast';
import useDebounce from '../../utils/useDebounce.js';
import { Badge } from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import Pagination from '../../components/ui/Pagination';
import {
  PageHeader, LoadingSpinner, EmptyState, PrimaryButton, SecondaryButton,
  DangerButton, Field, inputCls, formatNumber, formatDateTime,
} from '../../components/ui';

// ── TOP-LEVEL constants ───────────────────────────────────────────────────────

const getRoleConfig = (t) => [
  { value: 'OWNER',            label: t('admin', 'owner_role') },
  { value: 'ADMIN',            label: t('admin', 'admin_role') },
  { value: 'SUPER_ACCOUNTANT', label: t('admin', 'super_accountant_role') },
  { value: 'ACCOUNTANT',       label: t('admin', 'accountant_role') },
  { value: 'SUPER_SELLER',     label: 'Trưởng phòng kinh doanh' },
  { value: 'SELLER',           label: 'Nhân viên kinh doanh' },
  { value: 'SUPER_WAREHOUSE',  label: 'Trưởng xưởng' },
  { value: 'WAREHOUSE',        label: 'Nhân viên kho' },
  { value: 'OPERATOR',         label: 'Nhân viên nhập liệu' },
  { value: 'SUPER_FACTORY_WORKER', label: 'Trưởng xưởng sản xuất' },
  { value: 'FACTORY_WORKER',   label: 'Nhân viên xưởng SX' },
  { value: 'FACTORY_ACCOUNTANT', label: 'Kế toán kho xưởng' },
  { value: 'HR',               label: 'Nhân viên nhân sự' },

  // ── ROLE MỚI ──────────────────────────────────────────────────────────────
  { value: 'DRIVER',                    label: 'Tài xế' },
  { value: 'SECURITY',                  label: 'Bảo vệ' },
  { value: 'FACTORY_MANAGER',           label: 'Quản lý xưởng' },
  { value: 'FACTORY_PRODUCTION_WORKER', label: 'Nhân viên sản xuất' },
  { value: 'FACTORY_STAFF',             label: 'Trợ lý kho (xưởng)' },
  { value: 'FACTORY_SECURITY',          label: 'Bảo vệ xưởng' },
];

const CONFLICT_GROUPS = [
  ['ACCOUNTANT', 'SUPER_ACCOUNTANT'],
  ['WAREHOUSE',  'SUPER_WAREHOUSE'],
  ['SELLER',     'SUPER_SELLER'],
  ['OWNER',      'ADMIN'],
  ['FACTORY_WORKER', 'SUPER_FACTORY_WORKER'],

  // ── Vị trí XƯỞNG loại trừ nhau ────────────────────────────────────────────
  // Mỗi người chỉ giữ 1 vị trí xưởng, nếu không việc chia thưởng KPI sẽ lấy
  // trọng số cao nhất và có thể không đúng ý.
  ['FACTORY_PRODUCTION_WORKER', 'FACTORY_MANAGER'],
  ['FACTORY_PRODUCTION_WORKER', 'FACTORY_STAFF'],
  ['FACTORY_PRODUCTION_WORKER', 'FACTORY_SECURITY'],
  ['FACTORY_STAFF',             'FACTORY_MANAGER'],
  ['FACTORY_STAFF',             'FACTORY_SECURITY'],
  ['FACTORY_MANAGER',           'FACTORY_SECURITY'],
];

// ── Helpers (dùng ROLE_LABEL động) ───────────────────────────────────────────

function findConflict(current, adding) {
  for (const group of CONFLICT_GROUPS) {
    if (!group.includes(adding)) continue;
    const conflicting = group.find(r => r !== adding && current.includes(r));
    if (conflicting) return conflicting;
  }
  return null;
}

function getDisabledReason(selected, candidate, ROLE_LABEL) {
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
function RolePicker({ selected, onChange, availableRoles, ROLE_LABEL }) {
  const [conflictMsg, setConflictMsg] = useState('');

  const toggle = (val) => {
    setConflictMsg('');
    if (selected.includes(val)) {
      if (selected.length === 1) return;
      onChange(selected.filter(r => r !== val));
    } else {
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
          const active = selected.includes(r.value);
          const disabledReason = !active ? getDisabledReason(selected, r.value, ROLE_LABEL) : null;
          const isDisabled = !!disabledReason;

          return (
            <button
              key={r.value}
              type="button"
              onClick={() => toggle(r.value)}
              disabled={isDisabled}
              title={disabledReason ?? undefined}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition
                ${active
                  ? 'bg-gold text-white border-gold'
                  : isDisabled
                    ? 'bg-canvas text-faint border-hairline cursor-not-allowed opacity-60'
                    : 'bg-surface text-ink-2 border-hairline-2 hover:border-gold hover:text-gold'
                }`}
            >
              {active && <Check size={11} />}
              {r.label}
            </button>
          );
        })}
      </div>

      {conflictMsg && (
        <div className="flex items-start gap-1.5 text-xs text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/28 rounded-lg px-3 py-2">
          <AlertCircle size={13} className="mt-0.5 flex-shrink-0" />
          <span>{conflictMsg}</span>
        </div>
      )}

      {selected.length > 1 && !conflictMsg && (
        <p className="text-xs text-muted">
          Khi đăng nhập, user sẽ được chọn role muốn sử dụng trong phiên đó.
        </p>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AdminUsers() {
  const toast = useToast();
  const { t } = useLang();
  const { user: currentUser } = useAuth();

  const ROLE_CONFIG = getRoleConfig(t);
  const ADMIN_ROLES = ROLE_CONFIG.filter(r => r.value !== 'OWNER');
  const ROLE_LABEL  = Object.fromEntries(ROLE_CONFIG.map(r => [r.value, r.label]));

  const [filters, setFilters] = useState({ q: '', role: '', locked: '' });
  const debouncedQ = useDebounce(filters.q, 600);

  const [page, setPage] = useState(0);
  const [data, setData] = useState({ content: [], totalPages: 0, totalElements: 0 });
  const [loading, setLoading] = useMinLoading();

  const [formOpen, setFormOpen]     = useState(false);
  const [editing, setEditing]       = useState(null);
  const [saving, setSaving]         = useState(false);
  const [lockConfirm, setLockConfirm] = useState(null);
  // Xoá mềm nhân viên
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [pwdTarget, setPwdTarget]   = useState(null);
  const [newPwd, setNewPwd]         = useState('');
  const [pwdErr, setPwdErr]         = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, size: 20, sort: 'id,desc' };
      if (debouncedQ)       params.q      = debouncedQ;
      if (filters.role)     params.role   = filters.role;
      if (filters.locked !== '') params.locked = filters.locked;
      const res = await adminUserApi.list(params);
      setData(res);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [page, debouncedQ, filters.role, filters.locked]);

  useEffect(() => { load(); }, [load]);

  // ── Trang phụ & modal gom về trang này ──────────────────────────────────
  // Route con chỉ tồn tại cho OWNER; ADMIN dùng chung trang Tài xế.
  const rolePrefix = window.location.pathname.startsWith('/owner') ? '/owner' : '/admin';
  const isOwner = rolePrefix === '/owner';

  const [salaryTarget, setSalaryTarget] = useState(null);
  const [requestsTarget, setRequestsTarget] = useState(null);
  const [unlockTarget, setUnlockTarget] = useState(null);

  // Tập id nhân viên đang bị KHOÁ XEM LƯƠNG (sai mật khẩu 3 lần). Tải một lần
  // cho cả trang thay vì hỏi trạng thái từng dòng — danh sách này rất ngắn.
  const [payrollLockedIds, setPayrollLockedIds] = useState(() => new Set());

  const loadPayrollLocks = useCallback(async () => {
    try {
      const list = await payrollPasscodeApi.lockedUsers();
      setPayrollLockedIds(new Set((list || []).map(u => u.id)));
    } catch {
      // Không chặn cả trang chỉ vì thiếu badge khoá lương.
      setPayrollLockedIds(new Set());
    }
  }, []);

  useEffect(() => { loadPayrollLocks(); }, [loadPayrollLocks]);

  const openCreate = () => { setEditing(null); setFormOpen(true); };
  const openEdit   = (u) => { setEditing(u);   setFormOpen(true); };

  // XOÁ MỀM: BE set deleted=true, khoá tài khoản, thu hồi token và đổi username/email/SĐT
  // thành SOFT_DELETED_{id}_... → có thể tạo lại nhân viên mới với đúng thông tin cũ.
  const doSoftDelete = async () => {
    setSaving(true);
    try {
      await adminUserApi.softDelete(deleteConfirm.id);
      setDeleteConfirm(null); load();
    } catch (e) {
      toast(e?.response?.data?.message || e.message || 'Lỗi xoá nhân viên', 'error');
    } finally { setSaving(false); }
  };

  const toggleLock = async () => {
    if (!lockConfirm) return;
    setSaving(true);
    try {
      await adminUserApi.setLocked(lockConfirm.id, !lockConfirm.isLockAccount);
      setLockConfirm(null); load();
    } catch (e) { toast(e?.response?.data?.message || e.message, 'error'); }
    finally { setSaving(false); }
  };

  const submitPwd = async () => {
    if (!newPwd || newPwd.length < 6) {
      setPwdErr('Mật khẩu tối thiểu 6 ký tự');
      return;
    }
    setSaving(true); setPwdErr('');
    const username = pwdTarget?.username;
    try {
      await adminUserApi.resetPassword(pwdTarget.id, newPwd);
      setPwdTarget(null); setNewPwd('');
      toast(`Đã đổi mật khẩu cho @${username}`, 'success');
    } catch (e) {
      const msg = e?.response?.data?.message || e.message || 'Đổi mật khẩu thất bại';
      setPwdErr(msg);
      toast(msg, 'error');
    } finally { setSaving(false); }
  };

  const closePwdModal = () => {
    if (saving) return;
    setPwdTarget(null); setNewPwd(''); setPwdErr('');
  };

  const renderRoleBadges = (u) => {
    const roles = u.roles?.length ? [...u.roles] : (u.role ? [u.role] : []);
    return roles.map(r => (
      <Badge key={r} className="bg-canvas text-ink-2 ring-line">
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

      {/* Các trang trước đây nằm ở sidebar, nay mở từ đây và có nút Quay lại. */}
      <SubPageButtons
        items={[
          { to: '/owner/employees', label: 'Duyệt lương', icon: DollarSign, hidden: !isOwner },
          { to: `${rolePrefix}/drivers`, label: 'Tài xế', icon: Gauge },
          { to: '/owner/attendance', label: 'Bảng chấm công', icon: ClipboardSignature, hidden: !isOwner },
        ]}
      />

      {/* Filters */}
      <div className="bg-surface rounded-2xl border border-hairline p-3 sm:p-4 shadow-sm flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
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
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink">
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
      <div className="bg-surface rounded-2xl border border-hairline shadow-sm overflow-hidden">
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
                  <tr className="bg-canvas text-muted">
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
                    <tr key={u.id} className="border-t border-hairline hover:bg-canvas/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gold to-gold-deep flex items-center justify-center text-white text-xs font-bold shrink-0">
                            {(u.fullName || u.username || '?')[0]?.toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-ink truncate">{u.fullName || u.username}</p>
                            <p className="text-xs text-muted truncate">@{u.username}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-ink text-xs truncate max-w-[180px]">{u.email || '—'}</p>
                        <p className="text-xs text-muted">{u.phoneNumber || '—'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {renderRoleBadges(u)}
                          {u.warehouses?.length > 0
                            ? u.warehouses.map(w => (
                              <Badge key={w.id} className="bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-300 ring-sky-100 dark:ring-sky-500/18 text-[10px]">
                                🏭 {w.name}
                              </Badge>
                            ))
                            : u.warehouseName && (
                              <Badge className="bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-300 ring-sky-100 dark:ring-sky-500/18 text-[10px]">
                                🏭 {u.warehouseName}
                              </Badge>
                            )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          {u.isLockAccount
                            ? <Badge className="bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 ring-red-200 dark:ring-red-500/28">Đã khóa</Badge>
                            : <Badge className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-500/28">Hoạt động</Badge>}
                          {payrollLockedIds.has(u.id) && (
                            <Badge className="bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-amber-200 dark:ring-amber-500/28 text-[10px]">
                              Khoá xem lương
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted whitespace-nowrap">{formatDateTime(u.timeCreate)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {canManageUser(currentUser?.role, u) ? (
                            <>
                              <button onClick={() => openEdit(u)} className="p-2 rounded-lg text-muted hover:bg-canvas hover:text-ink" title="Sửa">
                                <Edit2 size={15} />
                              </button>
                              <button onClick={() => setPwdTarget(u)} className="p-2 rounded-lg text-muted hover:bg-gold/10 hover:text-gold" title="Đổi mật khẩu">
                                <KeyRound size={15} />
                              </button>
                              <button onClick={() => setSalaryTarget(u)}
                                className="p-2 rounded-lg text-muted hover:bg-emerald-50 dark:hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-300"
                                title="Xem lương / duyệt phiếu lương">
                                <DollarSign size={15} />
                              </button>
                              <button onClick={() => setRequestsTarget(u)}
                                className="p-2 rounded-lg text-muted hover:bg-sky-50 dark:hover:bg-sky-500/10 hover:text-sky-600 dark:hover:text-sky-300"
                                title="Duyệt phiếu nghỉ / phiếu OT">
                                <CalendarClock size={15} />
                              </button>
                              {/* Mở khoá xem lương — luôn hiện để thao tác ngay tại
                                  dòng nhân viên. Đỏ = đang bị khoá do nhập sai 3 lần. */}
                              <button onClick={() => setUnlockTarget(u)}
                                className={`p-2 rounded-lg transition-colors border
                                  ${payrollLockedIds.has(u.id)
                                    ? 'text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/28 hover:bg-red-100 dark:hover:bg-red-500/20'
                                    : 'text-muted bg-surface border-hairline-2 hover:text-ink hover:bg-canvas'}`}
                                title={payrollLockedIds.has(u.id)
                                  ? 'Đang bị khoá xem lương (sai mật khẩu 3 lần) — bấm để mở khoá'
                                  : 'Mở khoá / đặt lại mật khẩu xem lương'}>
                                <ShieldAlert size={15} />
                              </button>
                              <button onClick={() => setLockConfirm(u)}
                                className={`p-2 rounded-lg transition-colors ${u.isLockAccount ? 'text-muted hover:bg-emerald-50 dark:bg-emerald-500/10 hover:text-emerald-600 dark:text-emerald-300' : 'text-muted hover:bg-red-50 dark:bg-red-500/10 hover:text-red-600 dark:text-red-300'}`}
                                title={u.isLockAccount ? 'Mở khóa' : t('status', 'locked')}>
                                {u.isLockAccount ? <Unlock size={15} /> : <Lock size={15} />}
                              </button>
                              <button onClick={() => setDeleteConfirm(u)}
                                className="p-2 rounded-lg text-muted hover:bg-red-50 dark:bg-red-500/10 hover:text-red-600 dark:text-red-300 transition-colors"
                                title="Xoá nhân viên">
                                <Trash2 size={15} />
                              </button>
                            </>
                          ) : (
                            <span className="text-xs text-faint italic px-2">Không có quyền</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="md:hidden divide-y divide-hairline">
              {data.content.map(u => (
                <div key={u.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gold to-gold-deep flex items-center justify-center text-white text-sm font-bold shrink-0">
                      {(u.fullName || u.username)[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-ink truncate">{u.fullName || u.username}</p>
                      <p className="text-xs text-muted truncate">@{u.username} · {u.email}</p>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {renderRoleBadges(u)}
                        {u.isLockAccount
                          ? <Badge className="bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 ring-red-200 dark:ring-red-500/28">Đã khóa</Badge>
                          : <Badge className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-500/28">Hoạt động</Badge>}
                      </div>
                    </div>
                  </div>
                  {canManageUser(currentUser?.role, u) && (
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => setSalaryTarget(u)}
                        className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
                        Xem lương
                      </button>
                      <button onClick={() => setRequestsTarget(u)}
                        className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-300">
                        Duyệt nghỉ/OT
                      </button>
                      <button onClick={() => setUnlockTarget(u)}
                        className={`px-3 py-2 rounded-lg text-xs font-medium border
                          ${payrollLockedIds.has(u.id)
                            ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-300 border-red-200 dark:border-red-500/28'
                            : 'bg-surface text-muted border-hairline-2'}`}>
                        <ShieldAlert size={13} />
                      </button>
                    </div>
                  )}

                  <div className="flex gap-2 mt-2">
                    {canManageUser(currentUser?.role, u) ? (
                      <>
                        <button onClick={() => openEdit(u)} className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-canvas text-ink">Sửa</button>
                        <button onClick={() => setPwdTarget(u)} className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-gold/10 text-gold">Mật khẩu</button>
                        <button onClick={() => setLockConfirm(u)}
                          className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium ${u.isLockAccount ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-300' : 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-300'}`}>
                          {u.isLockAccount ? 'Mở khóa' : t('status', 'locked')}
                        </button>
                        <button onClick={() => setDeleteConfirm(u)}
                          className="px-3 py-2 rounded-lg text-xs font-medium bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-300">
                          <Trash2 size={13} />
                        </button>
                      </>
                    ) : (
                      <p className="text-xs text-faint italic py-2">Không có quyền thao tác</p>
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

      {salaryTarget && (
        <UserSalaryModal
          user={salaryTarget}
          onClose={(changed) => { setSalaryTarget(null); if (changed) load(); }}
        />
      )}

      {requestsTarget && (
        <UserRequestsModal
          user={requestsTarget}
          onClose={() => setRequestsTarget(null)}
        />
      )}

      {unlockTarget && (
        <PayrollUnlockModal
          user={unlockTarget}
          onClose={(done) => { setUnlockTarget(null); if (done) loadPayrollLocks(); }}
        />
      )}

      {formOpen && (
        <UserFormModal
          open={formOpen}
          editing={editing}
          currentUserRole={currentUser?.role}
          t={t}
          onClose={() => setFormOpen(false)}
          onSaved={() => { setFormOpen(false); load(); }}
        />
      )}

      {/* Soft delete confirm */}
      <Modal open={!!deleteConfirm} onClose={() => !saving && setDeleteConfirm(null)}
        title="Xoá nhân viên" size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <SecondaryButton onClick={() => setDeleteConfirm(null)} disabled={saving}>Hủy</SecondaryButton>
            <DangerButton onClick={doSoftDelete} loading={saving}>Xoá nhân viên</DangerButton>
          </div>
        }>
        <p className="text-sm text-ink">
          Xoá nhân viên <span className="font-semibold">{deleteConfirm?.fullName || deleteConfirm?.username}</span>{' '}
          (<span className="font-mono text-xs">{deleteConfirm?.username}</span>)?
        </p>
        <div className="mt-3 px-3 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/28 text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
          Tài khoản sẽ bị <b>khoá và ẩn khỏi danh sách</b>, mọi phiên đăng nhập bị thu hồi.
          Lịch sử đơn hàng / phiếu kho do nhân viên này tạo <b>vẫn được giữ nguyên</b>.
          <br />
          Username, email và SĐT sẽ được <b>giải phóng</b> — bạn có thể tạo lại nhân viên mới
          với đúng thông tin cũ.
        </div>
      </Modal>

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
        <p className="text-sm text-ink">
          Bạn có chắc muốn {lockConfirm?.isLockAccount ? 'mở khóa' : 'khóa'} user{' '}
          <span className="font-semibold">{lockConfirm?.username}</span>?
        </p>
      </Modal>

      {/* Reset password */}
      <Modal open={!!pwdTarget} onClose={closePwdModal}
        title="Đổi mật khẩu" size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <SecondaryButton onClick={closePwdModal} disabled={saving}>Hủy</SecondaryButton>
            <PrimaryButton onClick={submitPwd} loading={saving}>Xác nhận</PrimaryButton>
          </div>
        }>
        <p className="text-sm text-ink mb-3">User: <span className="font-semibold">@{pwdTarget?.username}</span></p>
        <Field label="Mật khẩu mới" required hint="Tối thiểu 6 ký tự">
          <input type="password" value={newPwd}
            onChange={e => { setNewPwd(e.target.value); setPwdErr(''); }}
            onKeyDown={e => e.key === 'Enter' && !saving && submitPwd()}
            className={`${inputCls} ${pwdErr ? 'border-red-400' : ''}`}
            autoFocus />
          {pwdErr && <p className="text-xs text-red-500 mt-1">{pwdErr}</p>}
        </Field>
      </Modal>
    </div>
  );
}

// ── UserFormModal ─────────────────────────────────────────────────────────────
function UserFormModal({ open, editing, onClose, onSaved, currentUserRole, t }) {
  const ROLE_CONFIG = getRoleConfig(t);
  const ADMIN_ROLES = ROLE_CONFIG.filter(r => r.value !== 'OWNER');
  const ROLE_LABEL  = Object.fromEntries(ROLE_CONFIG.map(r => [r.value, r.label]));

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

  const initWarehouseIds = editing?.warehouses?.map(w => String(w.id)) ||
    (editing?.warehouseId ? [String(editing.warehouseId)] : []);
  const [selectedWarehouseIds, setSelectedWarehouseIds] = useState(initWarehouseIds);
  const [saving, setSaving]     = useState(false);
  const [err, setErr]           = useState('');
  const [warehouses, setWarehouses] = useState([]);

  useEffect(() => {
    import('../../api/adminApi').then(({ adminWarehouseApi }) => {
      adminWarehouseApi.list().then(whs => setWarehouses(whs || [])).catch(() => { });
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
          <div className="flex items-start gap-2 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 text-sm p-3 rounded-xl border border-red-200 dark:border-red-500/28">
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
            ROLE_LABEL={ROLE_LABEL}
          />
        </Field>

        {needsWarehouse && (
          <Field label="Kho được phân công" required
            hint="Có thể chọn nhiều kho — tài khoản sẽ quản lý tất cả kho đã chọn">
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {warehouses.length === 0 && (
                <p className="text-xs text-muted italic py-1">Chưa có kho nào</p>
              )}
              {warehouses.map(w => {
                const checked = selectedWarehouseIds.includes(String(w.id));
                return (
                  <label key={w.id}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-colors
                      ${checked ? 'bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/28' : 'bg-canvas border border-transparent hover:border-line'}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleWarehouse(w.id)}
                      className="w-4 h-4 accent-amber-500 rounded"
                    />
                    <span className={`text-sm font-medium ${checked ? 'text-amber-700 dark:text-amber-300' : 'text-ink'}`}>
                      {w.name}
                    </span>
                    {w.type === 'TRANSIT' && (
                      <span className="ml-auto text-[10px] text-muted bg-surface-2 px-1.5 py-0.5 rounded">Trung chuyển</span>
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