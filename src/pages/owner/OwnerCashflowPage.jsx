// src/pages/owner/OwnerCashflowPage.jsx
// Quản lý dòng tiền — dùng chung cho ADMIN & OWNER.
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { cashflowApi, bankApi } from '../../api/services';
import { useToast } from '../../components/common/Toast';
import { presetToRange } from '../../components/ui/DateRangePicker';
import DateRangePicker from '../../components/ui/DateRangePicker';
import {
  Activity, Wallet, Landmark, TrendingUp, TrendingDown, ChevronDown, ChevronUp,
  CheckCircle, AlertTriangle, FileDown, ShieldCheck, X, Plus, RefreshCw
} from 'lucide-react';
import { BackButton, SubPageButtons } from '../../components/common/SubPageNav';
import { useLang } from '../../context/LangContext';
import { useFmt } from '../../utils/useFmt';

const parseVND = (s) => Number(String(s).replace(/[^\d]/g, '')) || 0;
const nf = (n) => new Intl.NumberFormat('vi-VN').format(n);

// Mệnh giá tiền mặt VNĐ đang lưu hành — phải KHỚP với CashDenominations.ALLOWED ở BE.
// Giảm dần để người đếm quỹ đi từ tờ to xuống tờ nhỏ, đúng thao tác thực tế.
// 11 mệnh giá → lưới 3 cột × 4 dòng.
const DENOMINATIONS = [500000, 200000, 100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200];

const getPresets = (t) => [
  { key: 'today', label: t('production', 'oinv_preset_today') },
  { key: 'week',  label: t('production', 'oinv_preset_week') },
  { key: 'month', label: t('production', 'oinv_preset_month') },
  { key: 'year',  label: t('production', 'oinv_preset_year') },
];

export default function OwnerCashflowPage() {
  const toast = useToast();
  const { t } = useLang();
  const { fmtCurrency, fmtDateTime } = useFmt();
  const fmtVND = (n) => (n == null) ? `0 ${t('production', 'cash_currency_suffix')}` : fmtCurrency(n);

  const PRESETS = useMemo(() => getPresets(t), [t]);

  // Trang dùng chung cho OWNER và ADMIN — nút con phải trỏ đúng nhánh route.
  const cashBase = (() => {
    const p = window.location.pathname;
    if (p.startsWith('/owner')) return '/owner';
    if (p.startsWith('/super-accountant')) return '/super-accountant';
    if (p.startsWith('/accountant')) return '/accountant';
    return '/admin';
  })();
  const [preset, setPreset] = useState('today');
  const [range, setRange] = useState(() => presetToRange('today'));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showOpenBanks, setShowOpenBanks] = useState(false);
  const [showCloseBanks, setShowCloseBanks] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await cashflowApi.summary(range.from, range.to);
      setData(res.data?.data || res.data || null);
    } catch { toast(t('production', 'cash_toast_load_failed'), 'error'); }
    finally { setLoading(false); }
  }, [range, t, toast]);

  useEffect(() => { load(); }, [load]);

  const applyPreset = (key) => { setPreset(key); setRange(presetToRange(key)); };
  const applyCustom = (r) => { if (!r.from && !r.to) return; setPreset('custom'); setRange({ from: r.from, to: r.to }); };

  const downloadReport = async () => {
    setDownloading(true);
    try {
      const res = await cashflowApi.report(range.from, range.to);
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url; a.download = `${t('production', 'cash_report_filename')}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    } catch { toast(t('production', 'cash_toast_report_failed'), 'error'); }
    finally { setDownloading(false); }
  };

  const opening = data?.opening;
  const closing = data?.closing;
  const incomeTotal = (Number(data?.incomeCashTotal) || 0) + (Number(data?.incomeBankTotal) || 0);
  const expenseTotal = (Number(data?.expenseCashTotal) || 0) + (Number(data?.expenseBankTotal) || 0);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5 pb-24">
      <BackButton fallback={window.location.pathname.startsWith('/owner') ? '/owner/dashboard' : '/admin/dashboard'} />

      <div className="flex items-center gap-3">
        <Activity size={22} className="text-gold" />
        <h1 className="text-xl font-bold text-ink">{t('production', 'cash_title')}</h1>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={downloadReport} disabled={downloading}
            className="flex items-center gap-1.5 px-3 h-9 rounded-xl bg-surface border border-line text-ink text-sm font-semibold hover:border-gold transition disabled:opacity-50"
            title={t('production', 'cash_btn_report')}>
            <FileDown size={16} className="text-gold" />
            <span className="hidden sm:inline">{downloading ? t('production', 'cash_generating') : t('production', 'cash_btn_report')}</span>
          </button>
          <button onClick={() => setShowConfirm(true)}
            className="flex items-center gap-1.5 px-3 h-9 rounded-xl bg-gold text-white text-sm font-semibold hover:bg-gold-strong transition"
            title={t('production', 'cash_btn_confirm')}>
            <ShieldCheck size={16} /> <span className="hidden sm:inline">{t('production', 'cash_btn_confirm')}</span>
          </button>
          <button onClick={load} className="p-2 rounded-xl border border-line text-muted hover:bg-canvas transition"
            title={t('common', 'refresh')}>
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* Phiếu thu / Phiếu chi không còn ở sidebar — mở từ đây, có nút Quay lại. */}
      <SubPageButtons
        items={[
          { to: `${cashBase}/incomes`, label: 'Phiếu thu', icon: TrendingUp },
          { to: `${cashBase}/expenses`, label: 'Phiếu chi', icon: TrendingDown },
        ]}
      />

      <div className="flex items-center gap-2 flex-wrap">
        {PRESETS.map(p => (
          <button key={p.key} onClick={() => applyPreset(p.key)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${preset === p.key ? 'bg-gold text-white' : 'bg-surface border border-line text-muted hover:border-gold'}`}>
            {p.label}
          </button>
        ))}
        <div className="flex-shrink-0">
          <DateRangePicker from={range.from} to={range.to} onChange={applyCustom}
            placeholder={t('production', 'oinv_custom_range')} align="right" />
        </div>
      </div>

      <BankManagerPanel />

      {loading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-surface-2 rounded-2xl animate-pulse" />)}</div>
      ) : !data ? (
        <div className="text-center py-16 text-muted">{t('production', 'cash_no_data')}</div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <PositionCard title={t('production', 'cash_opening_balance')} pos={opening} expanded={showOpenBanks} onToggle={() => setShowOpenBanks(v => !v)} accent="grey" />
            <PositionCard title={t('production', 'cash_closing_balance')} pos={closing} expanded={showCloseBanks} onToggle={() => setShowCloseBanks(v => !v)} accent="gold" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/18 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300 font-medium flex items-center gap-1">
                    <TrendingUp size={13} /> {t('production', 'cash_total_income')}
                  </p>
                  <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">{fmtVND(incomeTotal)}</p>
                </div>
              </div>
              <p className="text-xs text-emerald-600 dark:text-emerald-300 mt-1">
                {t('production', 'cash_method_cash')} {fmtVND(data.incomeCashTotal)} · {t('production', 'cash_method_bank')} {fmtVND(data.incomeBankTotal)}
              </p>
            </div>
            <div className="bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/18 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-red-600 dark:text-red-300 font-medium flex items-center gap-1">
                    <TrendingDown size={13} /> {t('production', 'cash_total_expense')}
                  </p>
                  <p className="text-2xl font-bold text-red-600 dark:text-red-300 mt-0.5">{fmtVND(expenseTotal)}</p>
                </div>
              </div>
              <p className="text-xs text-red-500 mt-1">
                {t('production', 'cash_method_cash')} {fmtVND(data.expenseCashTotal)} · {t('production', 'cash_method_bank')} {fmtVND(data.expenseBankTotal)}
              </p>
            </div>
          </div>

          {data.confirmations?.length > 0 && (
            <div className="space-y-2">
              {data.confirmations.map(c => (
                <div key={c.id} className={`rounded-xl border p-3 ${c.matched ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/18' : 'bg-red-50 dark:bg-red-500/10 border-red-100 dark:border-red-500/18'}`}>
                  <p className={`text-sm font-semibold flex items-center gap-1.5 ${c.matched ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-600 dark:text-red-300'}`}>
                    {c.matched ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
                    {t('production', 'cash_confirmed_at', { time: fmtDateTime(c.confirmedAt), name: c.confirmedByName })}
                  </p>
                  {c.matched ? (
                    <p className="text-xs text-emerald-600 dark:text-emerald-300 mt-0.5">{t('production', 'cash_matched')}</p>
                  ) : (
                    <p className="text-xs text-red-600 dark:text-red-300 mt-0.5">
                      {t('production', 'cash_mismatch_inline', { cash: fmtVND(c.cashCounted), reason: c.reason })}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <FlowList title={t('production', 'cash_income_list')} flows={data.incomes} kind="INCOME" />
            <FlowList title={t('production', 'cash_expense_list')} flows={data.expenses} kind="EXPENSE" />
          </div>
        </>
      )}

      {showConfirm && <ConfirmModal onClose={() => setShowConfirm(false)} onDone={() => { setShowConfirm(false); load(); }} />}
    </div>
  );
}

function BankManagerPanel() {
  const toast = useToast();
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [banks, setBanks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [acc, setAcc] = useState('');
  const [saving, setSaving] = useState(false);

  const loadBanks = async () => {
    setLoading(true);
    try {
      const res = await bankApi.list();
      setBanks(res.data?.data ?? res.data ?? []);
    } catch { toast(t('production', 'cash_bank_load_failed'), 'error'); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (open) loadBanks(); }, [open]); // eslint-disable-line

  const submit = async () => {
    if (!name.trim()) { toast(t('production', 'cash_bank_err_name'), 'error'); return; }
    setSaving(true);
    try {
      await bankApi.add({ name: name.trim(), accountNumber: acc.trim() || null });
      toast(t('production', 'cash_bank_added'), 'success');
      setName(''); setAcc(''); setAdding(false);
      loadBanks();
    } catch (e) { toast(e?.response?.data?.message || t('production', 'cash_bank_add_failed'), 'error'); }
    finally { setSaving(false); }
  };

  return (
    <div className="bg-surface rounded-2xl border border-line overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-canvas transition">
        <span className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Landmark size={16} className="text-gold" /> {t('production', 'cash_bank_title')}
        </span>
        {open ? <ChevronUp size={16} className="text-muted" /> : <ChevronDown size={16} className="text-muted" />}
      </button>
      {open && (
        <div className="p-4 border-t border-line space-y-3">
          <p className="text-xs text-muted">{t('production', 'cash_bank_desc')}</p>
          {loading ? (
            <p className="text-sm text-muted">{t('common', 'loading')}</p>
          ) : (
            <div className="space-y-2">
              {banks.map(b => (
                <div key={b.id || b.name} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-canvas">
                  <Landmark size={14} className="text-sky-600 dark:text-sky-300" />
                  <span className="text-sm font-medium text-ink">{b.name}</span>
                  {b.accountNumber && <span className="text-xs text-muted font-mono ml-1">{b.accountNumber}</span>}
                </div>
              ))}
              {banks.length === 0 && <p className="text-sm text-muted">{t('production', 'cash_bank_empty')}</p>}
            </div>
          )}

          {adding ? (
            <div className="flex flex-col sm:flex-row gap-2">
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder={t('production', 'cash_bank_name_ph')}
                className="flex-1 px-3 py-2 rounded-xl border border-line text-sm focus:outline-none focus:border-gold" />
              <input value={acc} onChange={e => setAcc(e.target.value)}
                placeholder={t('production', 'cash_bank_acc_ph')}
                className="flex-1 px-3 py-2 rounded-xl border border-line text-sm focus:outline-none focus:border-gold" />
              <div className="flex gap-2">
                <button onClick={submit} disabled={saving}
                  className="px-4 py-2 rounded-xl bg-gold text-white text-sm font-bold hover:bg-gold-strong transition disabled:opacity-50">
                  {saving ? '...' : t('common', 'save')}
                </button>
                <button onClick={() => { setAdding(false); setName(''); setAcc(''); }}
                  className="px-4 py-2 rounded-xl border border-hairline-2 text-sm font-semibold text-muted hover:bg-canvas transition">
                  {t('common', 'cancel')}
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAdding(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gold text-gold text-sm font-semibold hover:bg-gold/5 transition">
              <Plus size={15} /> {t('production', 'cash_bank_add')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function PositionCard({ title, pos, expanded, onToggle, accent }) {
  const { t } = useLang();
  const { fmtCurrency } = useFmt();
  const fmtVND = (n) => fmtCurrency(n);
  const isGold = accent === 'gold';
  return (
    <div className={`rounded-2xl border p-4 ${isGold ? 'bg-gradient-to-br from-gold/10 to-gold/5 border-gold/20' : 'bg-surface border-line'}`}>
      <p className="text-xs text-muted font-medium">{title}</p>
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-2">
          <Wallet size={16} className="text-emerald-600 dark:text-emerald-300" />
          <span className="text-sm text-muted">{t('production', 'cash_method_cash')}</span>
        </div>
        <span className="text-lg font-bold text-ink">{fmtVND(pos?.cash)}</span>
      </div>
      <button onClick={onToggle} className="w-full flex items-center justify-between mt-2 group">
        <div className="flex items-center gap-2">
          <Landmark size={16} className="text-sky-600 dark:text-sky-300" />
          <span className="text-sm text-muted">{t('production', 'cash_method_bank')}</span>
          {expanded ? <ChevronUp size={13} className="text-muted" /> : <ChevronDown size={13} className="text-muted" />}
        </div>
        <span className="text-lg font-bold text-ink">{fmtVND(pos?.bankTotal)}</span>
      </button>
      {expanded && pos?.banks?.length > 0 && (
        <div className="mt-2 pl-6 space-y-1 border-t border-hairline pt-2">
          {pos.banks.map((b, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="text-muted">{b.name}</span>
              <span className="font-semibold text-ink">{fmtVND(b.balance)}</span>
            </div>
          ))}
        </div>
      )}
      <div className="mt-3 pt-3 border-t border-hairline flex items-center justify-between">
        <span className="text-sm font-semibold text-muted">{t('common', 'total')}</span>
        <span className={`text-xl font-bold ${isGold ? 'text-gold' : 'text-ink'}`}>
          {fmtVND((Number(pos?.cash) || 0) + (Number(pos?.bankTotal) || 0))}
        </span>
      </div>
    </div>
  );
}

function FlowList({ title, flows, kind }) {
  const { t } = useLang();
  const { fmtCurrency, fmtDateTime } = useFmt();
  const fmtVND = (n) => fmtCurrency(n);
  const income = kind === 'INCOME';
  return (
    <div className="bg-surface rounded-2xl border border-line overflow-hidden">
      <div className="px-4 py-3 border-b border-line flex items-center gap-2">
        {income ? <TrendingUp size={15} className="text-emerald-600 dark:text-emerald-300" /> : <TrendingDown size={15} className="text-red-500" />}
        <span className="text-sm font-semibold text-ink">{title}</span>
        <span className="text-xs text-muted ml-auto">{flows?.length || 0}</span>
      </div>
      <div className="max-h-80 overflow-y-auto divide-y divide-hairline">
        {(!flows || flows.length === 0) ? (
          <p className="text-center py-8 text-sm text-muted">{t('production', 'cash_no_transactions')}</p>
        ) : flows.map(f => (
          <div key={f.id} className="px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-gold">{f.number || f.voucherCode}</span>
              <span className={`text-sm font-bold ${income ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-600 dark:text-red-300'}`}>
                {income ? '+' : '−'}{fmtVND(f.amount)}
              </span>
            </div>
            <p className="text-sm text-ink truncate mt-0.5">{f.reason}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${f.paymentType === 'BANK_TRANSFER' ? 'bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300' : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'}`}>
                {f.paymentType === 'BANK_TRANSFER'
                  ? <><Landmark size={9} /> {f.bankName || t('production', 'cash_method_bank')}</>
                  : <><Wallet size={9} /> {t('production', 'cash_method_cash')}</>}
              </span>
              <span className="text-[10px] text-muted">{t('production', 'cash_by')} {f.createdByName}</span>
              {!income && f.approvedByName && (
                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-gold/10 text-gold-strong">
                  <ShieldCheck size={9} /> {f.approvedByName}
                </span>
              )}
              <span className="text-[10px] text-muted ml-auto">{fmtDateTime(f.at)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Ô nhập 1 mệnh giá — dùng trong lưới 3 cột × 4 dòng ────────────────────────
function DenomCell({ denom, qty, line, onChange }) {
  const active = qty > 0;
  return (
    <div className={`rounded-xl border px-2.5 py-2 transition ${active ? 'border-gold bg-gold/5' : 'border-line bg-surface'}`}>
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] font-bold text-ink tabular-nums">{nf(denom)}</span>
        <span className="text-[10px] text-muted">×</span>
      </div>
      <div className="flex items-center gap-1 mt-1">
        <input
          type="text" inputMode="numeric"
          value={qty || ''}
          onChange={e => onChange(denom, e.target.value)}
          placeholder="0"
          className="w-full min-w-0 px-2 py-1.5 rounded-lg border border-line bg-surface text-sm text-right tabular-nums focus:outline-none focus:border-gold" />
        <span className="text-[10px] text-muted flex-shrink-0">tờ</span>
      </div>
      <p className={`mt-1 text-[11px] text-right tabular-nums font-medium ${active ? 'text-gold-strong' : 'text-faint'}`}>
        {nf(line)}
      </p>
    </div>
  );
}

// ── Modal xác nhận dòng tiền ──
function ConfirmModal({ onClose, onDone }) {
  const toast = useToast();
  const { t } = useLang();
  const { fmtCurrency } = useFmt();
  const fmtVND = (n) => fmtCurrency(n);
  const [banks, setBanks] = useState([]);
  // counts: { [mệnh giá]: số tờ }. Tổng tiền mặt LUÔN là số dẫn xuất, không nhập tay.
  const [counts, setCounts] = useState({});
  const [balances, setBalances] = useState({});
  const [reason, setReason] = useState('');
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [addingBank, setAddingBank] = useState(false);
  const [newBank, setNewBank] = useState('');
  const mismatchRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await bankApi.list();
        setBanks(res.data?.data || res.data || []);
      } catch { toast(t('production', 'cash_bank_load_failed'), 'error'); }
    })();
  }, []); // eslint-disable-line

  const setBal = (name, v) => { setBalances(p => ({ ...p, [name]: String(parseVND(v)) })); };
  const setCount = (denom, v) => {
    const q = Math.max(0, parseVND(v));
    setCounts(p => ({ ...p, [denom]: q }));
  };

  // ── TỔNG TỰ ĐỘNG ─────────────────────────────────────────────────────────
  // Đổi số lượng bất kỳ mệnh giá nào, hoặc số dư bất kỳ ngân hàng nào → cả 3 tổng
  // (tiền mặt / chuyển khoản / tổng cuối) đều tính lại ngay.
  const cashTotal = useMemo(
    () => DENOMINATIONS.reduce((s2, d) => s2 + d * (counts[d] || 0), 0),
    [counts]
  );
  const bankTotal = useMemo(
    () => banks.reduce((s2, b) => s2 + parseVND(balances[b.name] || 0), 0),
    [banks, balances]
  );
  const grandTotal = cashTotal + bankTotal;

  const addBank = async () => {
    if (!newBank.trim()) return;
    try {
      const res = await bankApi.add({ name: newBank.trim() });
      const b = res.data?.data || res.data;
      setBanks(p => [...p, b]);
      setNewBank(''); setAddingBank(false);
    } catch (e) { toast(e?.response?.data?.message || t('production', 'cash_bank_add_failed'), 'error'); }
  };

  const submit = async () => {
    const bankBalances = {};
    banks.forEach(b => { bankBalances[b.name] = parseVND(balances[b.name] || 0); });
    if (result && !result.matched && !reason.trim()) {
      toast(t('production', 'cash_err_need_reason'), 'error'); return;
    }
    setSaving(true);
    try {
      const cashDenominations = DENOMINATIONS
        .filter(d => (counts[d] || 0) > 0)
        .map(d => ({ denomination: d, quantity: counts[d] }));
      // cashCounted gửi kèm chỉ để hiển thị/log — BE tính lại từ cashDenominations.
      const res = await cashflowApi.confirm({
        cashCounted: cashTotal, cashDenominations, bankBalances, reason: reason.trim() || null,
      });
      const r = res.data?.data || res.data;
      if (!r.matched && !reason.trim()) {
        setResult(r);
        toast(t('production', 'cash_toast_mismatch'), 'warning');
        setSaving(false);
        return;
      }
      toast(r.matched ? t('production', 'cash_toast_matched') : t('production', 'cash_toast_reset'), 'success');
      onDone();
    } catch (e) {
      toast(e?.response?.data?.message || t('production', 'cash_err_confirm'), 'error');
      setSaving(false);
    }
  };

  const mismatch = result && !result.matched;

  // Auto-scroll đến khối lý do lệch khi nó xuất hiện
  useEffect(() => {
    if (mismatch && mismatchRef.current) {
      mismatchRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [mismatch]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      {/* max-w-2xl để lưới mệnh giá 3 cột không bị bóp */}
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-hairline">
          <div className="flex items-center gap-2">
            <ShieldCheck size={20} className="text-gold" />
            <h2 className="text-lg font-bold text-ink">{t('production', 'cash_btn_confirm')}</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-canvas text-muted"><X size={20} /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          <p className="text-xs text-muted">{t('production', 'cash_confirm_desc')}</p>

          {/* ── LÝ DO (luôn hiện — bắt buộc khi lệch) ────────────────────── */}
          

          {/* ── TIỀN MẶT: đếm theo mệnh giá — lưới 3 cột × 4 dòng ────────── */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-semibold text-ink flex items-center gap-1.5">
                <Wallet size={14} className="text-emerald-600 dark:text-emerald-300" /> {t('production', 'cash_actual_cash')}
              </label>
              {cashTotal > 0 && (
                <button onClick={() => { setCounts({}); setResult(null); }}
                  className="text-xs text-muted hover:text-red-500 font-medium">Xoá hết</button>
              )}
            </div>
            <p className="text-xs text-muted mb-2">Nhập SỐ TỜ của từng mệnh giá — tổng tự cộng.</p>

            <div className="rounded-xl border border-line bg-canvas p-2.5">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {DENOMINATIONS.map(d => (
                  <DenomCell key={d} denom={d} qty={counts[d] || 0}
                    line={d * (counts[d] || 0)} onChange={setCount} />
                ))}
              </div>
              <div className="flex items-center justify-between px-3 py-2.5 mt-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/18">
                <span className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Tổng tiền mặt</span>
                <span className="text-base font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">{fmtVND(cashTotal)}</span>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-semibold text-ink flex items-center gap-1.5">
                <Landmark size={14} className="text-sky-600 dark:text-sky-300" /> {t('production', 'cash_bank_balances')}
              </label>
              <button onClick={() => setAddingBank(a => !a)} className="text-xs text-gold font-semibold hover:underline flex items-center gap-1">
                <Plus size={12} /> {t('production', 'cash_bank_add_short')}
              </button>
            </div>
            {addingBank && (
              <div className="flex gap-2 mb-2">
                <input value={newBank} onChange={e => setNewBank(e.target.value)}
                  placeholder={t('production', 'cash_bank_new_name_ph')}
                  className="flex-1 px-3 py-2 rounded-lg border border-line text-sm focus:outline-none focus:border-gold" />
                <button onClick={addBank}
                  className="px-3 py-2 rounded-lg bg-gold text-white text-sm font-semibold">{t('common', 'add')}</button>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {banks.map(b => (
                <div key={b.id || b.name} className="flex items-center gap-2">
                  <span className="text-sm text-ink-2 w-28 flex-shrink-0 truncate">{b.name}</span>
                  <input value={balances[b.name] ? nf(parseVND(balances[b.name])) : ''}
                    onChange={e => setBal(b.name, e.target.value)}
                    placeholder="0"
                    className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-line text-sm text-right tabular-nums focus:outline-none focus:border-gold" />
                </div>
              ))}
              {banks.length === 0 && <p className="text-xs text-muted">{t('production', 'cash_bank_empty')}</p>}
            </div>
            {banks.length > 0 && (
              <div className="flex items-center justify-between px-3 py-2.5 mt-2 rounded-xl bg-sky-50 dark:bg-sky-500/10 border border-sky-100 dark:border-sky-500/18">
                <span className="text-sm font-semibold text-sky-800 dark:text-sky-300">Tổng chuyển khoản</span>
                <span className="text-base font-bold text-sky-700 dark:text-sky-300 tabular-nums">{fmtVND(bankTotal)}</span>
              </div>
            )}
          </div>

          {/* ── TỔNG CUỐI = tiền mặt + chuyển khoản ─────────────────────── */}
          <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-forest-deep text-white">
            <span className="text-sm font-semibold">TỔNG CỘNG</span>
            <span className="text-lg font-bold tabular-nums">{fmtVND(grandTotal)}</span>
          </div>
        </div>

        <div className="p-5 border-t border-hairline flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-hairline-2 text-sm font-semibold text-muted hover:bg-canvas transition">
            {t('common', 'cancel')}
          </button>
          <button onClick={submit} disabled={saving}
            className="flex-1 py-3 rounded-xl bg-gold text-white text-sm font-bold hover:bg-gold-strong transition disabled:opacity-50">
            {saving ? t('common', 'processing') : mismatch ? t('production', 'cash_confirm_reset') : t('production', 'cash_btn_confirm')}
          </button>
        </div>

        <div className={`rounded-xl p-4 space-y-2 transition-colors ${mismatch
            ? 'bg-red-50 dark:bg-red-500/10 border-2 border-red-300 dark:border-red-500/35'
            : 'bg-canvas border border-line'
          }`}>
            {mismatch && (
              <>
                <p className="text-sm font-bold text-red-600 dark:text-red-300 flex items-center gap-1.5">
                  <AlertTriangle size={16} /> {t('production', 'cash_mismatch_title')}
                </p>
                <div className="text-sm text-red-700 dark:text-red-300 space-y-1">
                  <div className="flex justify-between">
                    <span>{t('production', 'cash_system_cash')}</span><b>{fmtVND(result.expected?.cash)}</b>
                  </div>
                  <div className="flex justify-between">
                    <span>{t('production', 'cash_system_bank')}</span><b>{fmtVND(result.expected?.bankTotal)}</b>
                  </div>
                </div>
              </>
            )}
            <div>
              <label className={`block text-xs font-semibold mb-1 ${mismatch ? 'text-red-600 dark:text-red-300' : 'text-muted'}`}>
                {mismatch ? `${t('production', 'cash_mismatch_reason')} *` : 'Ghi chú / Lý do (bắt buộc nếu có sai lệch)'}
              </label>
              <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2}
                placeholder={mismatch ? t('production', 'cash_mismatch_reason_ph') : 'Nhập ghi chú nếu cần...'}
                className={`w-full px-3 py-2 rounded-lg text-sm bg-surface focus:outline-none focus:ring-2 ${mismatch
                  ? 'border-2 border-red-300 dark:border-red-500/40 focus:ring-red-300 dark:ring-red-500/40'
                  : 'border border-line focus:ring-gold/40'
                }`} />
            </div>
          </div>
      </div>
    </div>
  );
}