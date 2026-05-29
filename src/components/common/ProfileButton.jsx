// src/components/common/ProfileButton.jsx
import { useState } from 'react';
import { UserCircle, X, Eye, EyeOff, Loader2, Check, Mail, Phone, Lock } from 'lucide-react';
import api from '../../api/axios';
import { useToast } from './Toast';
import { useAuth } from '../../context/AuthContext';
import { useLang } from '../../context/LangContext';
import { useNavigate } from 'react-router-dom';

function inputCls(hasErr) {
    return `w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none transition
    ${hasErr
            ? 'border-red-400 bg-red-50/40 focus:border-red-400'
            : 'border-black/10 focus:border-[#C9A84C] focus:ring-2 focus:ring-[#C9A84C]/20'}`;
}

export default function ProfileButton({ compact = false }) {
    const navigate = useNavigate();
    const [redirecting, setRedirecting] = useState(false);
    const toast = useToast();
    const { user: authUser, logout, updateUser } = useAuth();
    const { t } = useLang();
    const [open, setOpen] = useState(false);
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

    const loadProfile = async () => {
        setLoadingProfile(true);
        try {
            const res = await api.get('/api/profile');
            const data = res.data?.data;
            setProfile(data);
            setInfoForm({ fullName: data?.fullName || '', email: data?.email || '', phoneNumber: data?.phoneNumber || '' });
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingProfile(false);
        }
    };

    const handleOpen = () => {
        setOpen(true);
        setTab('info');
        setPwdForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setPwdErr({});
        setInfoErr({});
        loadProfile();
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
            if (res.data?.success === false) {
                toast(res.data?.message || t('profile', 'update_info_error'), 'error');
                return;
            }
            toast(t('common', 'update') + ' ' + t('common', 'success').toLowerCase(), 'success');
            const updated = res.data?.data;
            setProfile(updated);
            updateUser({ fullName: updated?.fullName, email: updated?.email, phoneNumber: updated?.phoneNumber });
        } catch (e) {
            toast(e?.response?.data?.message || t('profile', 'update_info_error'), 'error');
        } finally {
            setSavingInfo(false);
        }
    };

    const handleChangePassword = async () => {
        const errs = {};
        if (!pwdForm.currentPassword) errs.currentPassword = t('common', 'required');
        if (!pwdForm.newPassword || pwdForm.newPassword.length < 6)
            errs.newPassword = t('auth', 'password_min_length');
        if (pwdForm.newPassword !== pwdForm.confirmPassword)
            errs.confirmPassword = t('auth', 'password_mismatch');
        setPwdErr(errs);
        if (Object.keys(errs).length) return;

        setSavingPwd(true);
        try {
            const res = await api.put('/api/profile/password', {
                currentPassword: pwdForm.currentPassword,
                newPassword: pwdForm.newPassword,
            });
            if (res.data?.success === false) {
                toast(res.data?.message || t('auth', 'change_password_error'), 'error');
                return;
            }
            toast(t('auth', 'change_password_success_relogin'), 'success');
            setRedirecting(true);
            setTimeout(() => { setOpen(false); logout(); navigate('/login'); }, 1500);
        } catch (e) {
            toast(e?.response?.data?.message || t('auth', 'change_password_error'), 'error');
        } finally {
            setSavingPwd(false);
        }
    };

    const displayRole = t('roles', (authUser?.role || '').toLowerCase()) || authUser?.role || '';

    const tabs = [
        { key: 'info',     label: t('profile', 'info_tab'),    icon: UserCircle },
        { key: 'password', label: t('profile', 'password_tab'), icon: Lock },
    ];

    const pwdFields = [
        { key: 'currentPassword', label: t('auth', 'current_password'), showKey: 'current' },
        { key: 'newPassword',     label: t('auth', 'new_password'),     showKey: 'new',     hint: t('auth', 'password_min_length') },
        { key: 'confirmPassword', label: t('auth', 'confirm_password'), showKey: 'confirm' },
    ];

    return (
        <>
            <button
                onClick={handleOpen}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-[#FAF7F2] transition group"
                title={t('profile', 'my_profile')}
            >
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#C9A84C] to-[#A07830] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {(authUser?.fullName || authUser?.username || '?')[0]?.toUpperCase()}
                </div>
                {!compact && (
                    <div className="hidden sm:block text-left">
                        <p className="text-xs font-semibold text-[#1C1C1E] leading-tight truncate max-w-[120px]">
                            {authUser?.fullName || authUser?.username}
                        </p>
                        <p className="text-[10px] text-[#8E8878] leading-tight">{displayRole}</p>
                    </div>
                )}
            </button>

            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                        {redirecting && (
                            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center gap-3 rounded-2xl">
                                <Loader2 size={28} className="animate-spin text-[#C9A84C]" />
                                <p className="text-sm font-semibold text-[#1C1C1E]">{t('common', 'loading')}</p>
                            </div>
                        )}

                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-black/5">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#C9A84C] to-[#A07830] flex items-center justify-center text-white font-bold">
                                    {(authUser?.fullName || authUser?.username || '?')[0]?.toUpperCase()}
                                </div>
                                <div>
                                    <p className="font-bold text-[#1C1C1E]">{authUser?.fullName || authUser?.username}</p>
                                    <p className="text-xs text-[#8E8878]">@{authUser?.username} · {displayRole}</p>
                                </div>
                            </div>
                            <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg text-[#8E8878] hover:bg-[#FAF7F2]">
                                <X size={18} />
                            </button>
                        </div>

                        {/* Tabs */}
                        <div className="flex border-b border-black/5">
                            {tabs.map(({ key, label, icon: Icon }) => (
                                <button key={key} onClick={() => setTab(key)}
                                    className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition border-b-2
                    ${tab === key
                                            ? 'border-[#C9A84C] text-[#C9A84C]'
                                            : 'border-transparent text-[#8E8878] hover:text-[#1C1C1E] hover:bg-[#FAF7F2]'}`}>
                                    <Icon size={15} /> {label}
                                </button>
                            ))}
                        </div>

                        {/* Tab: Info */}
                        {tab === 'info' && (
                            <div className="p-5 space-y-4">
                                {loadingProfile ? (
                                    <div className="flex justify-center py-8">
                                        <Loader2 size={24} className="animate-spin text-[#C9A84C]" />
                                    </div>
                                ) : (
                                    <>
                                        <div>
                                            <label className="block text-sm font-semibold text-[#1C1C1E] mb-1.5 flex items-center gap-1.5">
                                                <UserCircle size={13} className="text-[#C9A84C]" /> {t('profile', 'full_name')}
                                            </label>
                                            <input
                                                type="text"
                                                value={infoForm.fullName}
                                                onChange={e => setInfoForm(p => ({ ...p, fullName: e.target.value }))}
                                                placeholder={t('placeholder', 'name_example')}
                                                className={inputCls(false)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-[#1C1C1E] mb-1.5 flex items-center gap-1.5">
                                                <Mail size={13} className="text-[#C9A84C]" /> Email
                                            </label>
                                            <input
                                                type="email"
                                                value={infoForm.email}
                                                onChange={e => { setInfoForm(p => ({ ...p, email: e.target.value })); setInfoErr(p => ({ ...p, email: '' })); }}
                                                placeholder="email@example.com"
                                                className={inputCls(!!infoErr.email)}
                                            />
                                            {infoErr.email && <p className="text-xs text-red-500 mt-1">{infoErr.email}</p>}
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-[#1C1C1E] mb-1.5 flex items-center gap-1.5">
                                                <Phone size={13} className="text-[#C9A84C]" /> {t('customer', 'phone')}
                                            </label>
                                            <input
                                                type="tel"
                                                value={infoForm.phoneNumber}
                                                onChange={e => setInfoForm(p => ({ ...p, phoneNumber: e.target.value }))}
                                                placeholder="0912 345 678"
                                                className={inputCls(false)}
                                            />
                                        </div>
                                        <button
                                            onClick={handleSaveInfo}
                                            disabled={savingInfo}
                                            className="w-full py-2.5 rounded-xl bg-[#C9A84C] text-white font-semibold hover:bg-[#B8923E] transition disabled:opacity-50 flex items-center justify-center gap-2"
                                        >
                                            {savingInfo
                                                ? <><Loader2 size={16} className="animate-spin" /> {t('common', 'processing')}</>
                                                : <><Check size={16} /> {t('common', 'save_changes')}</>}
                                        </button>
                                    </>
                                )}
                            </div>
                        )}

                        {/* Tab: Password */}
                        {tab === 'password' && (
                            <div className="p-5 space-y-4">
                                {pwdFields.map(({ key, label, showKey, hint }) => (
                                    <div key={key}>
                                        <label className="block text-sm font-semibold text-[#1C1C1E] mb-1.5">{label}</label>
                                        <div className="relative">
                                            <input
                                                type={showPwd[showKey] ? 'text' : 'password'}
                                                value={pwdForm[key]}
                                                onChange={e => { setPwdForm(p => ({ ...p, [key]: e.target.value })); setPwdErr(p => ({ ...p, [key]: '' })); }}
                                                placeholder="••••••••"
                                                className={`${inputCls(!!pwdErr[key])} pr-10`}
                                            />
                                            <button type="button"
                                                onClick={() => setShowPwd(p => ({ ...p, [showKey]: !p[showKey] }))}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8E8878] hover:text-[#1C1C1E]">
                                                {showPwd[showKey] ? <EyeOff size={15} /> : <Eye size={15} />}
                                            </button>
                                        </div>
                                        {pwdErr[key] && <p className="text-xs text-red-500 mt-1">{pwdErr[key]}</p>}
                                        {hint && !pwdErr[key] && <p className="text-xs text-[#8E8878] mt-1">{hint}</p>}
                                    </div>
                                ))}
                                <button
                                    onClick={handleChangePassword}
                                    disabled={savingPwd}
                                    className="w-full py-2.5 rounded-xl bg-[#C9A84C] text-white font-semibold hover:bg-[#B8923E] transition disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {savingPwd
                                        ? <><Loader2 size={16} className="animate-spin" /> {t('common', 'processing')}</>
                                        : <><Lock size={16} /> {t('auth', 'change_password')}</>}
                                </button>
                                <p className="text-xs text-[#8E8878] text-center">
                                    {t('auth', 'change_password_success_relogin')}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
