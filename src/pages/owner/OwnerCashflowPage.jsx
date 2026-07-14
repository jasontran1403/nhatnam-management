// src/pages/owner/OwnerCashflowPage.jsx
// Quản lý dòng tiền — dùng chung cho ADMIN & OWNER.
import { useState, useEffect, useCallback, useMemo } from 'react';
import { cashflowApi, bankApi } from '../../api/services';
import { useToast } from '../../components/common/Toast';
import { presetToRange } from '../../components/ui/DateRangePicker';
import DateRangePicker from '../../components/ui/DateRangePicker';
import {
  Activity, Wallet, Landmark, TrendingUp, TrendingDown, ChevronDown, ChevronUp,
  CheckCircle, AlertTriangle, FileDown, ShieldCheck, X, Plus, RefreshCw
} from 'lucide-react';
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
      <div className="flex items-center gap-3">
        <Activity size={22} className="text-[#C9A84C]" />
        <h1 className="text-xl font-bold text-[#1C1C1E]">{t('production', 'cash_title')}</h1>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={downloadReport} disabled={downloading}
            className="flex items-center gap-1.5 px-3 h-9 rounded-xl bg-white border border-[#E8DDD0] text-[#1C1C1E] text-sm font-semibold hover:border-[#C9A84C] transition disabled:opacity-50"
            title={t('production', 'cash_btn_report')}>
            <FileDown size={16} className="text-[#C9A84C]" />
            <span className="hidden sm:inline">{downloading ? t('production', 'cash_generating') : t('production', 'cash_btn_report')}</span>
          </button>
          <button onClick={() => setShowConfirm(true)}
            className="flex items-center gap-1.5 px-3 h-9 rounded-xl bg-[#C9A84C] text-white text-sm font-semibold hover:bg-[#B8923E] transition"
            title={t('production', 'cash_btn_confirm')}>
            <ShieldCheck size={16} /> <span className="hidden sm:inline">{t('production', 'cash_btn_confirm')}</span>
          </button>
          <button onClick={load} className="p-2 rounded-xl border border-[#E8DDD0] text-[#8E8878] hover:bg-[#FAF7F2] transition"
            title={t('common', 'refresh')}>
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {PRESETS.map(p => (
          <button key={p.key} onClick={() => applyPreset(p.key)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${preset === p.key ? 'bg-[#C9A84C] text-white' : 'bg-white border border-[#E8DDD0] text-[#8E8878] hover:border-[#C9A84C]'}`}>
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
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-gray-100 rounded-2xl animate-pulse" />)}</div>
      ) : !data ? (
        <div className="text-center py-16 text-[#8E8878]">{t('production', 'cash_no_data')}</div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <PositionCard title={t('production', 'cash_opening_balance')} pos={opening} expanded={showOpenBanks} onToggle={() => setShowOpenBanks(v => !v)} accent="grey" />
            <PositionCard title={t('production', 'cash_closing_balance')} pos={closing} expanded={showCloseBanks} onToggle={() => setShowCloseBanks(v => !v)} accent="gold" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-emerald-700 font-medium flex items-center gap-1">
                    <TrendingUp size={13} /> {t('production', 'cash_total_income')}
                  </p>
                  <p className="text-2xl font-bold text-emerald-700 mt-0.5">{fmtVND(incomeTotal)}</p>
                </div>
              </div>
              <p className="text-xs text-emerald-600 mt-1">
                {t('production', 'cash_method_cash')} {fmtVND(data.incomeCashTotal)} · {t('production', 'cash_method_bank')} {fmtVND(data.incomeBankTotal)}
              </p>
            </div>
            <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-red-600 font-medium flex items-center gap-1">
                    <TrendingDown size={13} /> {t('production', 'cash_total_expense')}
                  </p>
                  <p className="text-2xl font-bold text-red-600 mt-0.5">{fmtVND(expenseTotal)}</p>
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
                <div key={c.id} className={`rounded-xl border p-3 ${c.matched ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                  <p className={`text-sm font-semibold flex items-center gap-1.5 ${c.matched ? 'text-emerald-700' : 'text-red-600'}`}>
                    {c.matched ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
                    {t('production', 'cash_confirmed_at', { time: fmtDateTime(c.confirmedAt), name: c.confirmedByName })}
                  </p>
                  {c.matched ? (
                    <p className="text-xs text-emerald-600 mt-0.5">{t('production', 'cash_matched')}</p>
                  ) : (
                    <p className="text-xs text-red-600 mt-0.5">
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
    <div className="bg-white rounded-2xl border border-[#E8DDD0] overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#FAF7F2] transition">
        <span className="flex items-center gap-2 text-sm font-semibold text-[#1C1C1E]">
          <Landmark size={16} className="text-[#C9A84C]" /> {t('production', 'cash_bank_title')}
        </span>
        {open ? <ChevronUp size={16} className="text-[#8E8878]" /> : <ChevronDown size={16} className="text-[#8E8878]" />}
      </button>
      {open && (
        <div className="p-4 border-t border-[#E8DDD0] space-y-3">
          <p className="text-xs text-[#8E8878]">{t('production', 'cash_bank_desc')}</p>
          {loading ? (
            <p className="text-sm text-[#8E8878]">{t('common', 'loading')}</p>
          ) : (
            <div className="space-y-2">
              {banks.map(b => (
                <div key={b.id || b.name} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#FAF7F2]">
                  <Landmark size={14} className="text-sky-600" />
                  <span className="text-sm font-medium text-[#1C1C1E]">{b.name}</span>
                  {b.accountNumber && <span className="text-xs text-[#8E8878] font-mono ml-1">{b.accountNumber}</span>}
                </div>
              ))}
              {banks.length === 0 && <p className="text-sm text-[#8E8878]">{t('production', 'cash_bank_empty')}</p>}
            </div>
          )}

          {adding ? (
            <div className="flex flex-col sm:flex-row gap-2">
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder={t('production', 'cash_bank_name_ph')}
                className="flex-1 px-3 py-2 rounded-xl border border-[#E8DDD0] text-sm focus:outline-none focus:border-[#C9A84C]" />
              <input value={acc} onChange={e => setAcc(e.target.value)}
                placeholder={t('production', 'cash_bank_acc_ph')}
                className="flex-1 px-3 py-2 rounded-xl border border-[#E8DDD0] text-sm focus:outline-none focus:border-[#C9A84C]" />
              <div className="flex gap-2">
                <button onClick={submit} disabled={saving}
                  className="px-4 py-2 rounded-xl bg-[#C9A84C] text-white text-sm font-bold hover:bg-[#B8923E] transition disabled:opacity-50">
                  {saving ? '...' : t('common', 'save')}
                </button>
                <button onClick={() => { setAdding(false); setName(''); setAcc(''); }}
                  className="px-4 py-2 rounded-xl border border-black/10 text-sm font-semibold text-[#8E8878] hover:bg-[#FAF7F2] transition">
                  {t('common', 'cancel')}
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAdding(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#C9A84C] text-[#C9A84C] text-sm font-semibold hover:bg-[#C9A84C]/5 transition">
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
    <div className={`rounded-2xl border p-4 ${isGold ? 'bg-gradient-to-br from-[#C9A84C]/10 to-[#C9A84C]/5 border-[#C9A84C]/20' : 'bg-white border-[#E8DDD0]'}`}>
      <p className="text-xs text-[#8E8878] font-medium">{title}</p>
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-2">
          <Wallet size={16} className="text-emerald-600" />
          <span className="text-sm text-[#8E8878]">{t('production', 'cash_method_cash')}</span>
        </div>
        <span className="text-lg font-bold text-[#1C1C1E]">{fmtVND(pos?.cash)}</span>
      </div>
      <button onClick={onToggle} className="w-full flex items-center justify-between mt-2 group">
        <div className="flex items-center gap-2">
          <Landmark size={16} className="text-sky-600" />
          <span className="text-sm text-[#8E8878]">{t('production', 'cash_method_bank')}</span>
          {expanded ? <ChevronUp size={13} className="text-[#8E8878]" /> : <ChevronDown size={13} className="text-[#8E8878]" />}
        </div>
        <span className="text-lg font-bold text-[#1C1C1E]">{fmtVND(pos?.bankTotal)}</span>
      </button>
      {expanded && pos?.banks?.length > 0 && (
        <div className="mt-2 pl-6 space-y-1 border-t border-black/5 pt-2">
          {pos.banks.map((b, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="text-[#8E8878]">{b.name}</span>
              <span className="font-semibold text-[#1C1C1E]">{fmtVND(b.balance)}</span>
            </div>
          ))}
        </div>
      )}
      <div className="mt-3 pt-3 border-t border-black/5 flex items-center justify-between">
        <span className="text-sm font-semibold text-[#8E8878]">{t('common', 'total')}</span>
        <span className={`text-xl font-bold ${isGold ? 'text-[#C9A84C]' : 'text-[#1C1C1E]'}`}>
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
    <div className="bg-white rounded-2xl border border-[#E8DDD0] overflow-hidden">
      <div className="px-4 py-3 border-b border-[#E8DDD0] flex items-center gap-2">
        {income ? <TrendingUp size={15} className="text-emerald-600" /> : <TrendingDown size={15} className="text-red-500" />}
        <span className="text-sm font-semibold text-[#1C1C1E]">{title}</span>
        <span className="text-xs text-[#8E8878] ml-auto">{flows?.length || 0}</span>
      </div>
      <div className="max-h-80 overflow-y-auto divide-y divide-black/5">
        {(!flows || flows.length === 0) ? (
          <p className="text-center py-8 text-sm text-[#8E8878]">{t('production', 'cash_no_transactions')}</p>
        ) : flows.map(f => (
          <div key={f.id} className="px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-[#C9A84C]">{f.number || f.voucherCode}</span>
              <span className={`text-sm font-bold ${income ? 'text-emerald-700' : 'text-red-600'}`}>
                {income ? '+' : '−'}{fmtVND(f.amount)}
              </span>
            </div>
            <p className="text-sm text-[#1C1C1E] truncate mt-0.5">{f.reason}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${f.paymentType === 'BANK_TRANSFER' ? 'bg-sky-50 text-sky-700' : 'bg-emerald-50 text-emerald-700'}`}>
                {f.paymentType === 'BANK_TRANSFER'
                  ? <><Landmark size={9} /> {f.bankName || t('production', 'cash_method_bank')}</>
                  : <><Wallet size={9} /> {t('production', 'cash_method_cash')}</>}
              </span>
              <span className="text-[10px] text-[#8E8878]">{t('production', 'cash_by')} {f.createdByName}</span>
              {!income && f.approvedByName && (
                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-[#C9A84C]/10 text-[#B8923E]">
                  <ShieldCheck size={9} /> {f.approvedByName}
                </span>
              )}
              <span className="text-[10px] text-[#8E8878] ml-auto">{fmtDateTime(f.at)}</span>
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
    <div className={`rounded-xl border px-2.5 py-2 transition ${active ? 'border-[#C9A84C] bg-[#C9A84C]/5' : 'border-[#E8DDD0] bg-white'}`}>
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] font-bold text-[#1C1C1E] tabular-nums">{nf(denom)}</span>
        <span className="text-[10px] text-[#8E8878]">×</span>
      </div>
      <div className="flex items-center gap-1 mt-1">
        <input
          type="text" inputMode="numeric"
          value={qty || ''}
          onChange={e => onChange(denom, e.target.value)}
          placeholder="0"
          className="w-full min-w-0 px-2 py-1.5 rounded-lg border border-[#E8DDD0] bg-white text-sm text-right tabular-nums focus:outline-none focus:border-[#C9A84C]" />
        <span className="text-[10px] text-[#8E8878] flex-shrink-0">tờ</span>
      </div>
      <p className={`mt-1 text-[11px] text-right tabular-nums font-medium ${active ? 'text-[#B8923E]' : 'text-[#D5CCC0]'}`}>
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

  useEffect(() => {
    (async () => {
      try {
        const res = await bankApi.list();
        setBanks(res.data?.data || res.data || []);
      } catch { toast(t('production', 'cash_bank_load_failed'), 'error'); }
    })();
  }, []); // eslint-disable-line

  const setBal = (name, v) => { setBalances(p => ({ ...p, [name]: String(parseVND(v)) })); setResult(null); };
  const setCount = (denom, v) => {
    const q = Math.max(0, parseVND(v));
    setCounts(p => ({ ...p, [denom]: q }));
    setResult(null);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      {/* max-w-2xl để lưới mệnh giá 3 cột không bị bóp */}
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-black/5">
          <div className="flex items-center gap-2">
            <ShieldCheck size={20} className="text-[#C9A84C]" />
            <h2 className="text-lg font-bold text-[#1C1C1E]">{t('production', 'cash_btn_confirm')}</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-[#FAF7F2] text-[#8E8878]"><X size={20} /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          <p className="text-xs text-[#8E8878]">{t('production', 'cash_confirm_desc')}</p>

          {/* ── TIỀN MẶT: đếm theo mệnh giá — lưới 3 cột × 4 dòng ────────── */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-semibold text-[#1C1C1E] flex items-center gap-1.5">
                <Wallet size={14} className="text-emerald-600" /> {t('production', 'cash_actual_cash')}
              </label>
              {cashTotal > 0 && (
                <button onClick={() => { setCounts({}); setResult(null); }}
                  className="text-xs text-[#8E8878] hover:text-red-500 font-medium">Xoá hết</button>
              )}
            </div>
            <p className="text-xs text-[#8E8878] mb-2">Nhập SỐ TỜ của từng mệnh giá — tổng tự cộng.</p>

            <div className="rounded-xl border border-[#E8DDD0] bg-[#FAF7F2] p-2.5">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {DENOMINATIONS.map(d => (
                  <DenomCell key={d} denom={d} qty={counts[d] || 0}
                    line={d * (counts[d] || 0)} onChange={setCount} />
                ))}
              </div>
              <div className="flex items-center justify-between px-3 py-2.5 mt-2.5 rounded-xl bg-emerald-50 border border-emerald-100">
                <span className="text-sm font-semibold text-emerald-800">Tổng tiền mặt</span>
                <span className="text-base font-bold text-emerald-700 tabular-nums">{fmtVND(cashTotal)}</span>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-semibold text-[#1C1C1E] flex items-center gap-1.5">
                <Landmark size={14} className="text-sky-600" /> {t('production', 'cash_bank_balances')}
              </label>
              <button onClick={() => setAddingBank(a => !a)} className="text-xs text-[#C9A84C] font-semibold hover:underline flex items-center gap-1">
                <Plus size={12} /> {t('production', 'cash_bank_add_short')}
              </button>
            </div>
            {addingBank && (
              <div className="flex gap-2 mb-2">
                <input value={newBank} onChange={e => setNewBank(e.target.value)}
                  placeholder={t('production', 'cash_bank_new_name_ph')}
                  className="flex-1 px-3 py-2 rounded-lg border border-[#E8DDD0] text-sm focus:outline-none focus:border-[#C9A84C]" />
                <button onClick={addBank}
                  className="px-3 py-2 rounded-lg bg-[#C9A84C] text-white text-sm font-semibold">{t('common', 'add')}</button>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {banks.map(b => (
                <div key={b.id || b.name} className="flex items-center gap-2">
                  <span className="text-sm text-[#5C4E3D] w-28 flex-shrink-0 truncate">{b.name}</span>
                  <input value={balances[b.name] ? nf(parseVND(balances[b.name])) : ''}
                    onChange={e => setBal(b.name, e.target.value)}
                    placeholder="0"
                    className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-[#E8DDD0] text-sm text-right tabular-nums focus:outline-none focus:border-[#C9A84C]" />
                </div>
              ))}
              {banks.length === 0 && <p className="text-xs text-[#8E8878]">{t('production', 'cash_bank_empty')}</p>}
            </div>
            {banks.length > 0 && (
              <div className="flex items-center justify-between px-3 py-2.5 mt-2 rounded-xl bg-sky-50 border border-sky-100">
                <span className="text-sm font-semibold text-sky-800">Tổng chuyển khoản</span>
                <span className="text-base font-bold text-sky-700 tabular-nums">{fmtVND(bankTotal)}</span>
              </div>
            )}
          </div>

          {/* ── TỔNG CUỐI = tiền mặt + chuyển khoản ─────────────────────── */}
          <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-[#1A2B1A] text-white">
            <span className="text-sm font-semibold">TỔNG CỘNG</span>
            <span className="text-lg font-bold tabular-nums">{fmtVND(grandTotal)}</span>
          </div>

          {mismatch && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-3 space-y-2">
              <p className="text-sm font-semibold text-red-600 flex items-center gap-1.5">
                <AlertTriangle size={14} /> {t('production', 'cash_mismatch_title')}
              </p>
              <div className="text-xs text-red-700 space-y-0.5">
                <div className="flex justify-between">
                  <span>{t('production', 'cash_system_cash')}</span><b>{fmtVND(result.expected?.cash)}</b>
                </div>
                <div className="flex justify-between">
                  <span>{t('production', 'cash_system_bank')}</span><b>{fmtVND(result.expected?.bankTotal)}</b>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-red-600 mb-1">{t('production', 'cash_mismatch_reason')} *</label>
                <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2}
                  placeholder={t('production', 'cash_mismatch_reason_ph')}
                  className="w-full px-3 py-2 rounded-lg border border-red-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-200" />
              </div>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-black/5 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-black/10 text-sm font-semibold text-[#8E8878] hover:bg-[#FAF7F2] transition">
            {t('common', 'cancel')}
          </button>
          <button onClick={submit} disabled={saving}
            className="flex-1 py-3 rounded-xl bg-[#C9A84C] text-white text-sm font-bold hover:bg-[#B8923E] transition disabled:opacity-50">
            {saving ? t('common', 'processing') : mismatch ? t('production', 'cash_confirm_reset') : t('production', 'cash_btn_confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}