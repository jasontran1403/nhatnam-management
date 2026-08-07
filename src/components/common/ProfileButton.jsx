// src/components/common/ProfileButton.jsx
import { useState } from 'react';
import { UserCircle, X, Eye, EyeOff, Loader2, Check, Mail, Phone, Lock, RefreshCw, Star, ChevronRight, Wallet, ShieldAlert, KeyRound, AlertCircle } from 'lucide-react';
import api from '../../api/axios';
import { useToast } from './Toast';
import { useAuth } from '../../context/AuthContext';
import { useLang } from '../../context/LangContext';
import { useNavigate } from 'react-router-dom';
import PasscodeInput from './PasscodeInput';
import { payrollPasscodeApi, parsePasscodeError } from '../../api/payrollPasscodeApi';

function inputCls(hasErr) {
    return `w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none transition
    ${hasErr
            ? 'border-red-400 bg-red-50/40 dark:bg-red-500/4 focus:border-red-400'
            : 'border-hairline-2 focus:border-gold focus:ring-2 focus:ring-gold/20'}`;
}

export const ROLE_LABELS = {
    SUPERADMIN: 'Quản lý',
    ADMIN: 'Giám Đốc',
    OWNER: 'Chủ tịch',

    SELLER: 'Nhân viên Kinh doanh',
    SUPER_SELLER: 'Trưởng phòng Kinh doanh',

    ACCOUNTANT: 'Nhân viên Kế Toán',
    SUPER_ACCOUNTANT: 'Kế toán Trưởng',

    WAREHOUSE: 'Nhân viên Kho',
    SUPER_WAREHOUSE: 'Trưởng kho',

    FACTORY_WORKER: 'Nhân viên Xưởng',
    SUPER_FACTORY_WORKER: 'Trưởng Xưởng Sản Xuất',
    FACTORY_ACCOUNTANT: 'Kế toán Xưởng',
    FACTORY_STAFF: 'Trợ lý Xưởng',
    FACTORY_SECURITY: 'Bảo vệ xưởng',
    FACTORY_PRODUCTION_WORKER: 'Công nhân sản xuất',
    
    FACTORY_MANAGER: 'Quản lý Xưởng',

    DRIVER: 'Tài xế',
    SECURITY: 'Bảo vệ',

    HR: 'Nhân sự',

    OPERATOR: 'Nhân viên Nhập liệu',
    POS: 'Bán hàng tại quầy',
    SHIPPER: 'Giao hàng',
    USER: 'Người dùng',
    UN_AUTH: 'Chưa phân quyền',
};

/**
 * TÊN HIỂN THỊ CỦA ROLE.
 *
 * <p>Lưu ý: hàm `t()` KHÔNG trả về null khi thiếu key — nó trả lại CHÍNH KEY
 * ('factory_staff'). Nếu cứ dùng `t(...) || ROLE_LABELS[...]` thì key thiếu vẫn
 * là chuỗi truthy nên màn hình hiện tên biến thay vì tên thật.
 *
 * <p>Vì vậy phải so sánh kết quả với key: chỉ khi bản dịch KHÁC key mới coi là
 * dịch được, ngược lại rơi xuống ROLE_LABELS rồi mới tới tên role gốc.
 */
export function roleLabelOf(role, t) {
    if (!role) return '';
    const key = String(role).toLowerCase();
    const translated = t ? t('roles', key) : null;
    if (translated && translated !== key) return translated;
    return ROLE_LABELS[role] || role;
}

const ROLE_COLORS = {
    ADMIN: 'bg-red-100 dark:bg-red-500/18 text-red-700 dark:text-red-300', OWNER: 'bg-purple-100 dark:bg-purple-500/18 text-purple-700 dark:text-purple-300',
    SELLER: 'bg-blue-100 dark:bg-blue-500/18 text-blue-700 dark:text-blue-300', SUPER_SELLER: 'bg-blue-200 dark:bg-blue-500/28 text-blue-800 dark:text-blue-300',
    ACCOUNTANT: 'bg-green-100 dark:bg-green-500/18 text-green-700 dark:text-green-300', SUPER_ACCOUNTANT: 'bg-green-200 dark:bg-green-500/28 text-green-800 dark:text-green-300',
    WAREHOUSE: 'bg-orange-100 dark:bg-orange-500/18 text-orange-700 dark:text-orange-300', SUPER_WAREHOUSE: 'bg-orange-200 dark:bg-orange-500/28 text-orange-800 dark:text-orange-300',
    FACTORY_WORKER: 'bg-cyan-100 dark:bg-cyan-500/18 text-cyan-700 dark:text-cyan-300', SUPER_FACTORY_WORKER: 'bg-cyan-200 dark:bg-cyan-500/28 text-cyan-800 dark:text-cyan-300',
    FACTORY_ACCOUNTANT: 'bg-teal-100 dark:bg-teal-500/18 text-teal-700 dark:text-teal-300',
    HR: 'bg-pink-100 dark:bg-pink-500/18 text-pink-700 dark:text-pink-300', SUPERADMIN: 'bg-surface-3 text-ink',
};

export default function ProfileButton({ compact = false }) {
    const navigate = useNavigate();
    const [redirecting, setRedirecting] = useState(false);
    const toast = useToast();
    const { user: authUser, logout, updateUser, switchRole, setDefaultRole } = useAuth();
    const { t } = useLang();
    const [open, setOpen] = useState(false);
    // 'menu' | 'profile' | 'switch-role'
    const [view, setView] = useState('menu');
    const [tab, setTab] = useState('info');

    const [profile, setProfile] = useState(null);
    const [loadingProfile, setLoadingProfile] = useState(false);
    const [infoForm, setInfoForm] = useState({ fullName: '', email: '', phoneNumber: '' });
    const [infoErr, setInfoErr] = useState({});
    const [savingInfo, setSavingInfo] = useState(false);

    const [pwdForm, setPwdForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
    const [pwdErr, setPwdErr] = useState({});
    const [savingPwd, setSavingPwd] = useState(false);
    const [showPwd, setShowPwd] = useState({ current: false, new: false, confirm: false });

    // ── Mật khẩu XEM LƯƠNG (passcode 6 số) ────────────────────────────────
    // Tách hẳn khỏi pwdForm ở trên: đây là passcode 6 số chắn màn hình lương,
    // không phải mật khẩu đăng nhập. Đổi passcode KHÔNG bắt đăng nhập lại.
    const [pcForm, setPcForm] = useState({ current: '', next: '', confirm: '' });
    const [pcErr, setPcErr] = useState('');
    const [pcOk, setPcOk] = useState(false);
    const [savingPc, setSavingPc] = useState(false);
    const [pcStatus, setPcStatus] = useState(null);
    const [loadingPcStatus, setLoadingPcStatus] = useState(false);

    const [switchingRole, setSwitchingRole] = useState(null);
    const [settingDefault, setSettingDefault] = useState(null);

    const availableRoles = authUser?.availableRoles || [];
    const currentRole = authUser?.role || '';
    // defaultRole = user.role field in DB (backend sets it)
    // After switchRole, backend returns updated user with role field
    // We detect it by comparing authUser.defaultRole (set by setDefaultRole) or authUser.role
    const defaultRole = authUser?.defaultRole ?? authUser?.role ?? null;

    const loadProfile = async () => {
        setLoadingProfile(true);
        try {
            const res = await api.get('/api/profile');
            const data = res.data?.data;
            setProfile(data);
            setInfoForm({ fullName: data?.fullName || '', email: data?.email || '', phoneNumber: data?.phoneNumber || '' });
        } catch (e) { console.error(e); }
        finally { setLoadingProfile(false); }
    };

    const loadPasscodeStatus = async () => {
        setLoadingPcStatus(true);
        try {
            setPcStatus(await payrollPasscodeApi.status());
        } catch (e) {
            const info = parsePasscodeError(e);
            setPcStatus({ locked: info.locked });
        } finally { setLoadingPcStatus(false); }
    };

    const resetPasscodeForm = () => {
        setPcForm({ current: '', next: '', confirm: '' });
        setPcErr(''); setPcOk(false);
    };

    const handleChangePasscode = async () => {
        setPcErr(''); setPcOk(false);

        // Chặn sớm ở client cho các lỗi hiển nhiên — đỡ tốn 1 lần thử của
        // hạn mức 3 lần sai bên server.
        if (pcForm.current.length !== 6) { setPcErr('Vui lòng nhập đủ 6 số mật khẩu hiện tại'); return; }
        if (pcForm.next.length !== 6) { setPcErr('Mật khẩu mới phải gồm đúng 6 chữ số'); return; }
        if (pcForm.next !== pcForm.confirm) { setPcErr('Hai lần nhập mật khẩu mới không khớp'); return; }
        if (pcForm.next === pcForm.current) { setPcErr('Mật khẩu mới phải khác mật khẩu hiện tại'); return; }

        setSavingPc(true);
        try {
            await payrollPasscodeApi.change(pcForm.current, pcForm.next, pcForm.confirm);
            toast('Đã đổi mật khẩu xem lương', 'success');
            resetPasscodeForm();
            setPcOk(true);
            loadPasscodeStatus();
        } catch (e) {
            const info = parsePasscodeError(e);
            setPcErr(info.message);
            if (info.locked) loadPasscodeStatus();
            setPcForm(p => ({ ...p, current: '' }));
        } finally { setSavingPc(false); }
    };

    const handleOpen = () => {
        setOpen(true);
        setView('menu');
        setPwdForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setPwdErr({}); setInfoErr({});
        resetPasscodeForm();
        setPcStatus(null);
    };

    const handleOpenProfile = () => {
        setView('profile');
        setTab('info');
        loadProfile();
        loadPasscodeStatus();
    };

    const handleSaveInfo = async () => {
        const errs = {};
        if (infoForm.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(infoForm.email))
            errs.email = t('misc', 'email_invalid');
        setInfoErr(errs);
        if (Object.keys(errs).length) return;
        setSavingInfo(true);
        try {
            const res = await api.put('/api/profile', {
                fullName: infoForm.fullName.trim() || null,
                email: infoForm.email.trim() || null,
                phoneNumber: infoForm.phoneNumber.trim() || null,
            });
            if (res.data?.success === false) { toast(res.data?.message || 'Lỗi', 'error'); return; }
            toast('Đã lưu thông tin', 'success');
            const updated = res.data?.data;
            setProfile(updated);
            updateUser({ fullName: updated?.fullName, email: updated?.email, phoneNumber: updated?.phoneNumber });
        } catch (e) { toast(e?.response?.data?.message || 'Lỗi', 'error'); }
        finally { setSavingInfo(false); }
    };

    const handleChangePassword = async () => {
        const errs = {};
        if (!pwdForm.currentPassword) errs.currentPassword = t('common', 'required');
        if (!pwdForm.newPassword || pwdForm.newPassword.length < 6) errs.newPassword = t('auth', 'password_min_length');
        if (pwdForm.newPassword !== pwdForm.confirmPassword) errs.confirmPassword = t('auth', 'password_mismatch');
        setPwdErr(errs);
        if (Object.keys(errs).length) return;
        setSavingPwd(true);
        try {
            const res = await api.put('/api/profile/password', {
                currentPassword: pwdForm.currentPassword, newPassword: pwdForm.newPassword,
            });
            if (res.data?.success === false) { toast(res.data?.message || 'Lỗi', 'error'); return; }
            toast(t('auth', 'change_password_success_relogin'), 'success');
            setRedirecting(true);
            setTimeout(() => { setOpen(false); logout(); navigate('/login'); }, 1500);
        } catch (e) { toast(e?.response?.data?.message || 'Lỗi', 'error'); }
        finally { setSavingPwd(false); }
    };

    const handleSwitchRole = async (role) => {
        if (role === currentRole) return;
        setSwitchingRole(role);
        try {
            await switchRole(role);
            toast(`Đã chuyển sang ${roleLabelOf(role, t)}`, 'success');
            setOpen(false);
            // Force reload to apply new role routing
            setTimeout(() => window.location.href = '/', 300);
        } catch (e) {
            toast(e?.response?.data?.message || 'Lỗi chuyển role', 'error');
        } finally { setSwitchingRole(null); }
    };

    const handleToggleDefault = async (role) => {
        const username = authUser?.username || '';
        setSettingDefault(role);
        try {
            if (defaultRole === role) {
                await setDefaultRole(null);
                toast('Đã bỏ role mặc định', 'info');
            } else {
                await setDefaultRole(role);
                toast(`${roleLabelOf(role, t)} sẽ là role mặc định khi đăng nhập`, 'success');
            }
        } catch {
            toast('Lỗi cập nhật role mặc định', 'error');
        } finally {
            setSettingDefault(null);
        }
    };

    const displayRole = roleLabelOf(currentRole, t);

    const tabs = [
        { key: 'info', label: t('profile', 'info_tab'), icon: UserCircle },
        { key: 'password', label: t('profile', 'password_tab'), icon: Lock },
        // Panel thứ 3: mật khẩu 6 số chắn màn hình "Quản lý lương"
        { key: 'payroll', label: 'Xem lương', icon: Wallet },
    ];

    return (
        <>
            <button onClick={handleOpen}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-canvas transition group"
                title={t('profile', 'my_profile')}>
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-gold to-gold-deep flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {(authUser?.fullName || authUser?.username || '?')[0]?.toUpperCase()}
                </div>
                {!compact && (
                    <div className="hidden sm:block text-left">
                        <p className="text-xs font-semibold text-ink leading-tight truncate max-w-[120px]">
                            {authUser?.fullName || authUser?.username}
                        </p>
                        <p className="text-[10px] text-muted leading-tight">{displayRole}</p>
                    </div>
                )}
            </button>

            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
                    <div className="relative bg-surface rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                        {redirecting && (
                            <div className="absolute inset-0 bg-surface/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center gap-3 rounded-2xl">
                                <Loader2 size={28} className="animate-spin text-gold" />
                                <p className="text-sm font-semibold text-ink">{t('common', 'loading')}</p>
                            </div>
                        )}

                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-hairline">
                            <div className="flex items-center gap-3">
                                {view !== 'menu' && (
                                    <button onClick={() => setView('menu')}
                                        className="p-1 rounded-lg text-muted hover:bg-canvas mr-1">
                                        <ChevronRight size={16} className="rotate-180" />
                                    </button>
                                )}
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gold to-gold-deep flex items-center justify-center text-white font-bold">
                                    {(authUser?.fullName || authUser?.username || '?')[0]?.toUpperCase()}
                                </div>
                                <div>
                                    <p className="font-bold text-ink">{authUser?.fullName || authUser?.username}</p>
                                    <p className="text-xs text-muted">@{authUser?.username} · {displayRole}</p>
                                </div>
                            </div>
                            <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg text-muted hover:bg-canvas">
                                <X size={18} />
                            </button>
                        </div>

                        {/* ── View: Menu ── */}
                        {view === 'menu' && (
                            <div className="p-4 space-y-2">
                                {/* Switch Role option — only if user has multiple roles */}
                                {availableRoles.length > 1 && (
                                    <button onClick={() => setView('switch-role')}
                                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-canvas border border-line-soft transition text-left group">
                                        <div className="w-9 h-9 rounded-xl bg-gold/10 flex items-center justify-center flex-shrink-0">
                                            <RefreshCw size={16} className="text-gold" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-ink">Chuyển đổi vai trò</p>
                                            <p className="text-xs text-muted">Đang dùng: <span className={`px-1.5 py-0.5 rounded font-medium ${ROLE_COLORS[currentRole] || 'bg-surface-2 text-ink-2'}`}>{roleLabelOf(currentRole, t)}</span></p>
                                        </div>
                                        <ChevronRight size={16} className="text-faint group-hover:text-gold flex-shrink-0" />
                                    </button>
                                )}

                                {/* Update profile */}
                                <button onClick={handleOpenProfile}
                                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-canvas border border-line-soft transition text-left group">
                                    <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                                        <UserCircle size={16} className="text-blue-500" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-ink">Thông tin tài khoản</p>
                                        <p className="text-xs text-muted">Cập nhật tên, email, mật khẩu</p>
                                    </div>
                                    <ChevronRight size={16} className="text-faint group-hover:text-gold flex-shrink-0" />
                                </button>
                            </div>
                        )}

                        {/* ── View: Switch Role ── */}
                        {view === 'switch-role' && (
                            <div className="p-4 space-y-2">
                                <p className="text-xs text-muted px-1 mb-3">
                                    Chọn vai trò để chuyển đổi. Nhấn ⭐ để đặt làm mặc định khi đăng nhập.
                                </p>
                                {availableRoles.map(r => {
                                    const isActive = r === currentRole;
                                    const isDefault = r === defaultRole;
                                    const isSwitching = switchingRole === r;
                                    return (
                                        <div key={r}
                                            className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition
                                            ${isActive
                                                    ? 'border-gold bg-gold-tint'
                                                    : 'border-line-soft hover:border-gold/40 hover:bg-canvas'}`}>
                                            {/* Role info - clickable to switch */}
                                            <button
                                                onClick={() => handleSwitchRole(r)}
                                                disabled={isActive || !!switchingRole}
                                                className="flex items-center gap-3 flex-1 text-left disabled:cursor-default">
                                                {isSwitching
                                                    ? <Loader2 size={16} className="animate-spin text-gold flex-shrink-0" />
                                                    : isActive
                                                        ? <Check size={16} className="text-gold flex-shrink-0" />
                                                        : <div className="w-4 h-4 rounded-full border-2 border-line flex-shrink-0" />
                                                }
                                                <div>
                                                    <p className={`text-sm font-semibold ${isActive ? 'text-gold' : 'text-ink'}`}>
                                                        {roleLabelOf(r, t)}
                                                    </p>
                                                </div>
                                            </button>
                                            {/* Star = set default */}
                                            <button
                                                onClick={() => handleToggleDefault(r)}
                                                disabled={!!settingDefault}
                                                title={isDefault ? 'Bỏ mặc định' : 'Đặt làm mặc định khi đăng nhập'}
                                                className={`p-1.5 rounded-lg transition flex-shrink-0
                                                ${isDefault ? 'text-yellow-500 hover:text-yellow-600 dark:text-yellow-300' : 'text-faint hover:text-yellow-500'}
                                                ${settingDefault === r ? 'animate-pulse' : ''}`}>
                                                <Star size={14} fill={isDefault ? 'currentColor' : 'none'} />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* ── View: Profile ── */}
                        {view === 'profile' && (
                            <>
                                <div className="flex border-b border-hairline">
                                    {tabs.map(({ key, label, icon: Icon }) => (
                                        <button key={key} onClick={() => setTab(key)}
                                            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition border-b-2
                                            ${tab === key
                                                    ? 'border-gold text-gold'
                                                    : 'border-transparent text-muted hover:text-ink hover:bg-canvas'}`}>
                                            <Icon size={15} /> {label}
                                        </button>
                                    ))}
                                </div>

                                {tab === 'info' && (
                                    <div className="p-5 space-y-4">
                                        {loadingProfile ? (
                                            <div className="flex justify-center py-8">
                                                <Loader2 size={24} className="animate-spin text-gold" />
                                            </div>
                                        ) : (
                                            <>
                                                <div>
                                                    <label className="block text-sm font-semibold text-ink mb-1.5 flex items-center gap-1.5">
                                                        <UserCircle size={13} className="text-gold" /> {t('profile', 'full_name')}
                                                    </label>
                                                    <input type="text" value={infoForm.fullName}
                                                        onChange={e => setInfoForm(p => ({ ...p, fullName: e.target.value }))}
                                                        placeholder={t('placeholder', 'name_example')}
                                                        className={inputCls(false)} />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-semibold text-ink mb-1.5 flex items-center gap-1.5">
                                                        <Mail size={13} className="text-gold" /> Email
                                                    </label>
                                                    <input type="email" value={infoForm.email}
                                                        onChange={e => { setInfoForm(p => ({ ...p, email: e.target.value })); setInfoErr(p => ({ ...p, email: '' })); }}
                                                        placeholder="email@example.com" className={inputCls(!!infoErr.email)} />
                                                    {infoErr.email && <p className="text-xs text-red-500 mt-1">{infoErr.email}</p>}
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-semibold text-ink mb-1.5 flex items-center gap-1.5">
                                                        <Phone size={13} className="text-gold" /> {t('customer', 'phone')}
                                                    </label>
                                                    <input type="tel" value={infoForm.phoneNumber}
                                                        onChange={e => setInfoForm(p => ({ ...p, phoneNumber: e.target.value }))}
                                                        placeholder="0912 345 678" className={inputCls(false)} />
                                                </div>
                                                <button onClick={handleSaveInfo} disabled={savingInfo}
                                                    className="w-full py-2.5 rounded-xl bg-gold text-white font-semibold hover:bg-gold-strong transition disabled:opacity-50 flex items-center justify-center gap-2">
                                                    {savingInfo ? <><Loader2 size={16} className="animate-spin" /> {t('common', 'processing')}</> : <><Check size={16} /> {t('common', 'save_changes')}</>}
                                                </button>
                                            </>
                                        )}
                                    </div>
                                )}

                                {tab === 'password' && (
                                    <div className="p-5 space-y-4">
                                        {[
                                            { key: 'currentPassword', label: t('auth', 'current_password'), showKey: 'current' },
                                            { key: 'newPassword', label: t('auth', 'new_password'), showKey: 'new', hint: t('auth', 'password_min_length') },
                                            { key: 'confirmPassword', label: t('auth', 'confirm_password'), showKey: 'confirm' },
                                        ].map(({ key, label, showKey, hint }) => (
                                            <div key={key}>
                                                <label className="block text-sm font-semibold text-ink mb-1.5">{label}</label>
                                                <div className="relative">
                                                    <input type={showPwd[showKey] ? 'text' : 'password'} value={pwdForm[key]}
                                                        onChange={e => { setPwdForm(p => ({ ...p, [key]: e.target.value })); setPwdErr(p => ({ ...p, [key]: '' })); }}
                                                        placeholder="••••••••" className={`${inputCls(!!pwdErr[key])} pr-10`} />
                                                    <button type="button"
                                                        onClick={() => setShowPwd(p => ({ ...p, [showKey]: !p[showKey] }))}
                                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink">
                                                        {showPwd[showKey] ? <EyeOff size={15} /> : <Eye size={15} />}
                                                    </button>
                                                </div>
                                                {pwdErr[key] && <p className="text-xs text-red-500 mt-1">{pwdErr[key]}</p>}
                                                {hint && !pwdErr[key] && <p className="text-xs text-muted mt-1">{hint}</p>}
                                            </div>
                                        ))}
                                        <button onClick={handleChangePassword} disabled={savingPwd}
                                            className="w-full py-2.5 rounded-xl bg-gold text-white font-semibold hover:bg-gold-strong transition disabled:opacity-50 flex items-center justify-center gap-2">
                                            {savingPwd ? <><Loader2 size={16} className="animate-spin" /> {t('common', 'processing')}</> : <><Lock size={16} /> {t('auth', 'change_password')}</>}
                                        </button>
                                        <p className="text-xs text-muted text-center">{t('auth', 'change_password_success_relogin')}</p>
                                    </div>
                                )}

                                {/* ── Tab: Mật khẩu XEM LƯƠNG (passcode 6 số) ── */}
                                {tab === 'payroll' && (
                                    <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto">
                                        {loadingPcStatus ? (
                                            <div className="flex justify-center py-8">
                                                <Loader2 size={24} className="animate-spin text-gold" />
                                            </div>
                                        ) : pcStatus?.locked ? (
                                            /* Đang bị khoá → KHÔNG cho tự đổi, tránh dò passcode qua đường vòng */
                                            <div className="flex items-start gap-2.5 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/18 rounded-2xl px-4 py-3.5">
                                                <ShieldAlert size={16} className="text-red-500 shrink-0 mt-0.5" />
                                                <div>
                                                    <p className="text-sm font-bold text-red-700 dark:text-red-300">Đã khoá xem lương</p>
                                                    <p className="text-xs text-red-600/90 mt-1 leading-relaxed">
                                                        Bạn đã nhập sai quá 3 lần nên không thể xem lương và không thể tự
                                                        đổi mật khẩu. Vui lòng liên hệ quản trị viên (Nhân sự) để được mở khoá.
                                                    </p>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex items-start gap-2.5 bg-canvas border border-hairline rounded-2xl px-4 py-3">
                                                    <Wallet size={15} className="text-gold shrink-0 mt-0.5" />
                                                    <p className="text-xs text-muted leading-relaxed">
                                                        Mật khẩu 6 số dùng riêng cho màn hình <b className="text-ink">Quản lý lương</b>,
                                                        không phải mật khẩu đăng nhập.
                                                    </p>
                                                </div>

                                                {pcStatus?.usingDefault && (
                                                    <div className="flex items-start gap-2.5 bg-gold-tint border border-gold/30 rounded-2xl px-4 py-3">
                                                        <KeyRound size={15} className="text-gold shrink-0 mt-0.5" />
                                                        <p className="text-xs text-gold-deep leading-relaxed">
                                                            Bạn đang dùng mật khẩu mặc định <b>000000</b>. Nên đổi ngay để bảo mật.
                                                        </p>
                                                    </div>
                                                )}

                                                <div className="space-y-4 pt-1">
                                                    <PasscodeInput
                                                        label="Mật khẩu xem lương hiện tại"
                                                        size="md"
                                                        autoFocus={false}
                                                        value={pcForm.current}
                                                        onChange={v => { setPcForm(p => ({ ...p, current: v })); setPcErr(''); }}
                                                        error={!!pcErr}
                                                        disabled={savingPc}
                                                    />

                                                    <PasscodeInput
                                                        label="Mật khẩu mới"
                                                        size="md"
                                                        autoFocus={false}
                                                        value={pcForm.next}
                                                        onChange={v => { setPcForm(p => ({ ...p, next: v })); setPcErr(''); }}
                                                        disabled={savingPc}
                                                    />

                                                    <PasscodeInput
                                                        label="Nhập lại mật khẩu mới"
                                                        size="md"
                                                        autoFocus={false}
                                                        value={pcForm.confirm}
                                                        onChange={v => { setPcForm(p => ({ ...p, confirm: v })); setPcErr(''); }}
                                                        error={!!pcForm.confirm && pcForm.confirm.length === 6 && pcForm.confirm !== pcForm.next}
                                                        disabled={savingPc}
                                                    />
                                                </div>

                                                {pcErr && (
                                                    <div className="flex items-start gap-2 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/18 rounded-xl px-3.5 py-2.5">
                                                        <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
                                                        <p className="text-xs font-semibold text-red-600 dark:text-red-300 leading-snug">{pcErr}</p>
                                                    </div>
                                                )}

                                                {pcOk && (
                                                    <div className="flex items-start gap-2 bg-green-50 dark:bg-green-500/10 border border-green-100 dark:border-green-500/18 rounded-xl px-3.5 py-2.5">
                                                        <Check size={15} className="text-green-600 dark:text-green-300 shrink-0 mt-0.5" />
                                                        <p className="text-xs font-semibold text-green-700 dark:text-green-300 leading-snug">
                                                            Đã đổi mật khẩu xem lương. Lần tới vào trang lương hãy dùng mật khẩu mới.
                                                        </p>
                                                    </div>
                                                )}

                                                <button onClick={handleChangePasscode} disabled={savingPc}
                                                    className="w-full py-2.5 rounded-xl bg-gold text-white font-semibold hover:bg-gold-strong transition disabled:opacity-50 flex items-center justify-center gap-2">
                                                    {savingPc
                                                        ? <><Loader2 size={16} className="animate-spin" /> {t('common', 'processing')}</>
                                                        : <><Wallet size={16} /> Đổi mật khẩu xem lương</>}
                                                </button>

                                                <p className="text-xs text-muted text-center leading-relaxed">
                                                    Nhập sai mật khẩu xem lương 3 lần sẽ bị khoá và phải liên hệ quản trị viên.
                                                </p>
                                            </>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}