// src/pages/owner/OwnerCashflowPage.jsx
// Quản lý dòng tiền — dùng chung cho ADMIN & OWNER.
import { useState, useEffect, useCallback } from 'react';
import { cashflowApi, bankApi } from '../../api/services';
import { useToast } from '../../components/common/Toast';
import { presetToRange } from '../../components/ui/DateRangePicker';
import DateRangePicker from '../../components/ui/DateRangePicker';
import {
  Activity, Wallet, Landmark, TrendingUp, TrendingDown, ChevronDown, ChevronUp,
  CheckCircle, AlertTriangle, FileDown, ShieldCheck, X, Plus, RefreshCw
} from 'lucide-react';

function fmtVND(n) {
  if (n == null) return '0 đ';
  return new Intl.NumberFormat('vi-VN').format(Math.round(Number(n))) + ' đ';
}
function fmtDT(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')} ${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}
const parseVND = (s) => Number(String(s).replace(/[^\d]/g, '')) || 0;

const PRESETS = [
  { key: 'today', label: 'Hôm nay' },
  { key: 'week', label: 'Tuần này' },
  { key: 'month', label: 'Tháng này' },
  { key: 'year', label: 'Năm nay' },
];

export default function OwnerCashflowPage() {
  const toast = useToast();
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
    } catch { toast('Không tải được dữ liệu dòng tiền', 'error'); }
    finally { setLoading(false); }
  }, [range]);

  useEffect(() => { load(); }, [load]);

  const applyPreset = (key) => { setPreset(key); setRange(presetToRange(key)); };
  const applyCustom = (r) => {
    if (!r.from && !r.to) return;
    setPreset('custom');
    setRange({ from: r.from, to: r.to });
  };

  const downloadReport = async () => {
    setDownloading(true);
    try {
      const res = await cashflowApi.report(range.from, range.to);
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url; a.download = 'bao-cao-dong-tien.pdf';
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    } catch { toast('Lỗi khi tải báo cáo', 'error'); }
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
        <h1 className="text-xl font-bold text-[#1C1C1E]">Quản lý dòng tiền</h1>
        <button onClick={load} className="ml-auto p-2 rounded-xl border border-[#E8DDD0] text-[#8E8878] hover:bg-[#FAF7F2] transition" title="Làm mới">
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Bộ chọn thời gian */}
      <div className="flex items-center gap-2 flex-wrap">
        {PRESETS.map(p => (
          <button key={p.key} onClick={() => applyPreset(p.key)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${preset === p.key ? 'bg-[#C9A84C] text-white' : 'bg-white border border-[#E8DDD0] text-[#8E8878] hover:border-[#C9A84C]'}`}>
            {p.label}
          </button>
        ))}
        <div className="flex-shrink-0">
          <DateRangePicker from={range.from} to={range.to} onChange={applyCustom} placeholder="Tự chọn" align="right" />
        </div>
      </div>

      {/* Quản lý ngân hàng (ADMIN & OWNER tạo — đồng bộ với form phiếu thu/chi) */}
      <BankManagerPanel />

      {loading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-gray-100 rounded-2xl animate-pulse" />)}</div>
      ) : !data ? (
        <div className="text-center py-16 text-[#8E8878]">Không có dữ liệu</div>
      ) : (
        <>
          {/* Đầu kỳ / Cuối kỳ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <PositionCard title="Số dư đầu kỳ" pos={opening} expanded={showOpenBanks} onToggle={() => setShowOpenBanks(v => !v)} accent="grey" />
            <PositionCard title="Số dư cuối kỳ" pos={closing} expanded={showCloseBanks} onToggle={() => setShowCloseBanks(v => !v)} accent="gold" />
          </div>

          {/* Thu / Chi tổng */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-emerald-700 font-medium flex items-center gap-1"><TrendingUp size={13} /> Tổng thu trong kỳ</p>
                  <p className="text-2xl font-bold text-emerald-700 mt-0.5">{fmtVND(incomeTotal)}</p>
                </div>
              </div>
              <p className="text-xs text-emerald-600 mt-1">Tiền mặt {fmtVND(data.incomeCashTotal)} · CK {fmtVND(data.incomeBankTotal)}</p>
            </div>
            <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-red-600 font-medium flex items-center gap-1"><TrendingDown size={13} /> Tổng chi trong kỳ (đã duyệt)</p>
                  <p className="text-2xl font-bold text-red-600 mt-0.5">{fmtVND(expenseTotal)}</p>
                </div>
              </div>
              <p className="text-xs text-red-500 mt-1">Tiền mặt {fmtVND(data.expenseCashTotal)} · CK {fmtVND(data.expenseBankTotal)}</p>
            </div>
          </div>

          {/* Marker xác nhận trong kỳ */}
          {data.confirmations?.length > 0 && (
            <div className="space-y-2">
              {data.confirmations.map(c => (
                <div key={c.id} className={`rounded-xl border p-3 ${c.matched ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                  <p className={`text-sm font-semibold flex items-center gap-1.5 ${c.matched ? 'text-emerald-700' : 'text-red-600'}`}>
                    {c.matched ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
                    Đã xác nhận {fmtDT(c.confirmedAt)} · {c.confirmedByName}
                  </p>
                  {c.matched ? (
                    <p className="text-xs text-emerald-600 mt-0.5">Số tiền khớp hệ thống.</p>
                  ) : (
                    <p className="text-xs text-red-600 mt-0.5">
                      Có sai lệch — dòng tiền mới: tiền mặt <b>{fmtVND(c.cashCounted)}</b>. Lý do: {c.reason}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Danh sách Thu / Chi */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <FlowList title="Phiếu thu trong kỳ" flows={data.incomes} kind="INCOME" />
            <FlowList title="Phiếu chi trong kỳ (đã duyệt)" flows={data.expenses} kind="EXPENSE" />
          </div>
        </>
      )}

      {/* Nút hành động */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col gap-3">
        <button onClick={downloadReport} disabled={downloading}
          className="flex items-center gap-2 px-4 h-12 rounded-full bg-white border border-[#E8DDD0] shadow-lg text-[#1C1C1E] text-sm font-semibold hover:border-[#C9A84C] transition disabled:opacity-50">
          <FileDown size={18} className="text-[#C9A84C]" /> {downloading ? 'Đang tạo...' : 'Báo cáo PDF'}
        </button>
        <button onClick={() => setShowConfirm(true)}
          className="flex items-center gap-2 px-5 h-14 rounded-full bg-[#C9A84C] hover:bg-[#B8923E] shadow-xl text-white font-bold transition">
          <ShieldCheck size={20} /> Xác nhận dòng tiền
        </button>
      </div>

      {showConfirm && <ConfirmModal onClose={() => setShowConfirm(false)} onDone={() => { setShowConfirm(false); load(); }} />}
    </div>
  );
}

function BankManagerPanel() {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [banks, setBanks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [acc, setAcc] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await bankApi.list();
      setBanks(res.data?.data ?? res.data ?? []);
    } catch { toast('Không tải được danh mục ngân hàng', 'error'); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (open) load(); }, [open]);

  const submit = async () => {
    if (!name.trim()) { toast('Nhập tên ngân hàng', 'error'); return; }
    setSaving(true);
    try {
      await bankApi.add({ name: name.trim(), accountNumber: acc.trim() || null });
      toast('Đã thêm ngân hàng', 'success');
      setName(''); setAcc(''); setAdding(false);
      load();
    } catch (e) { toast(e?.response?.data?.message || 'Lỗi khi thêm ngân hàng', 'error'); }
    finally { setSaving(false); }
  };

  return (
    <div className="bg-white rounded-2xl border border-[#E8DDD0] overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#FAF7F2] transition">
        <span className="flex items-center gap-2 text-sm font-semibold text-[#1C1C1E]">
          <Landmark size={16} className="text-[#C9A84C]" /> Quản lý ngân hàng
        </span>
        {open ? <ChevronUp size={16} className="text-[#8E8878]" /> : <ChevronDown size={16} className="text-[#8E8878]" />}
      </button>
      {open && (
        <div className="p-4 border-t border-[#E8DDD0] space-y-3">
          <p className="text-xs text-[#8E8878]">
            Danh mục này được dùng khi lập phiếu thu/chi chuyển khoản. Chỉ ngân hàng ở đây mới chọn được, đảm bảo đồng bộ dòng tiền.
          </p>
          {loading ? (
            <p className="text-sm text-[#8E8878]">Đang tải...</p>
          ) : (
            <div className="space-y-2">
              {banks.map(b => (
                <div key={b.id || b.name} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#FAF7F2]">
                  <Landmark size={14} className="text-sky-600" />
                  <span className="text-sm font-medium text-[#1C1C1E]">{b.name}</span>
                  {b.accountNumber && <span className="text-xs text-[#8E8878] font-mono ml-1">{b.accountNumber}</span>}
                </div>
              ))}
              {banks.length === 0 && <p className="text-sm text-[#8E8878]">Chưa có ngân hàng nào.</p>}
            </div>
          )}

          {adding ? (
            <div className="flex flex-col sm:flex-row gap-2">
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Tên ngân hàng * (VD: Vietcombank)"
                className="flex-1 px-3 py-2 rounded-xl border border-[#E8DDD0] text-sm focus:outline-none focus:border-[#C9A84C]" />
              <input value={acc} onChange={e => setAcc(e.target.value)} placeholder="Số TK (tuỳ chọn)"
                className="flex-1 px-3 py-2 rounded-xl border border-[#E8DDD0] text-sm focus:outline-none focus:border-[#C9A84C]" />
              <div className="flex gap-2">
                <button onClick={submit} disabled={saving}
                  className="px-4 py-2 rounded-xl bg-[#C9A84C] text-white text-sm font-bold hover:bg-[#B8923E] transition disabled:opacity-50">
                  {saving ? '...' : 'Lưu'}
                </button>
                <button onClick={() => { setAdding(false); setName(''); setAcc(''); }}
                  className="px-4 py-2 rounded-xl border border-black/10 text-sm font-semibold text-[#8E8878] hover:bg-[#FAF7F2] transition">Huỷ</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAdding(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#C9A84C] text-[#C9A84C] text-sm font-semibold hover:bg-[#C9A84C]/5 transition">
              <Plus size={15} /> Thêm ngân hàng
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function PositionCard({ title, pos, expanded, onToggle, accent }) {
  const isGold = accent === 'gold';
  return (
    <div className={`rounded-2xl border p-4 ${isGold ? 'bg-gradient-to-br from-[#C9A84C]/10 to-[#C9A84C]/5 border-[#C9A84C]/20' : 'bg-white border-[#E8DDD0]'}`}>
      <p className="text-xs text-[#8E8878] font-medium">{title}</p>
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-2">
          <Wallet size={16} className="text-emerald-600" />
          <span className="text-sm text-[#8E8878]">Tiền mặt</span>
        </div>
        <span className="text-lg font-bold text-[#1C1C1E]">{fmtVND(pos?.cash)}</span>
      </div>
      <button onClick={onToggle} className="w-full flex items-center justify-between mt-2 group">
        <div className="flex items-center gap-2">
          <Landmark size={16} className="text-sky-600" />
          <span className="text-sm text-[#8E8878]">Chuyển khoản</span>
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
        <span className="text-sm font-semibold text-[#8E8878]">Tổng</span>
        <span className={`text-xl font-bold ${isGold ? 'text-[#C9A84C]' : 'text-[#1C1C1E]'}`}>
          {fmtVND((Number(pos?.cash) || 0) + (Number(pos?.bankTotal) || 0))}
        </span>
      </div>
    </div>
  );
}

function FlowList({ title, flows, kind }) {
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
          <p className="text-center py-8 text-sm text-[#8E8878]">Không có phát sinh</p>
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
                {f.paymentType === 'BANK_TRANSFER' ? <><Landmark size={9} /> {f.bankName || 'CK'}</> : <><Wallet size={9} /> Tiền mặt</>}
              </span>
              <span className="text-[10px] text-[#8E8878]">Bởi {f.createdByName}</span>
              {!income && f.approvedByName && (
                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-[#C9A84C]/10 text-[#B8923E]">
                  <ShieldCheck size={9} /> {f.approvedByName}
                </span>
              )}
              <span className="text-[10px] text-[#8E8878] ml-auto">{fmtDT(f.at)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Modal xác nhận dòng tiền ──────────────────────────────────────────────────
function ConfirmModal({ onClose, onDone }) {
  const toast = useToast();
  const [banks, setBanks] = useState([]);
  const [cash, setCash] = useState('');
  const [balances, setBalances] = useState({});   // { bankName: '123' }
  const [reason, setReason] = useState('');
  const [result, setResult] = useState(null);     // kết quả preview sau khi bấm
  const [saving, setSaving] = useState(false);
  const [addingBank, setAddingBank] = useState(false);
  const [newBank, setNewBank] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await bankApi.list();
        setBanks(res.data?.data || res.data || []);
      } catch { toast('Không tải được danh sách ngân hàng', 'error'); }
    })();
  }, []);

  const setBal = (name, v) => setBalances(p => ({ ...p, [name]: String(parseVND(v)) }));

  const addBank = async () => {
    if (!newBank.trim()) return;
    try {
      const res = await bankApi.add({ name: newBank.trim() });
      const b = res.data?.data || res.data;
      setBanks(p => [...p, b]);
      setNewBank(''); setAddingBank(false);
    } catch (e) { toast(e?.response?.data?.message || 'Lỗi khi thêm ngân hàng', 'error'); }
  };

  const submit = async () => {
    const bankBalances = {};
    banks.forEach(b => { bankBalances[b.name] = parseVND(balances[b.name] || 0); });
    // Nếu đã có preview mismatch mà chưa nhập lý do
    if (result && !result.matched && !reason.trim()) {
      toast('Có sai lệch — vui lòng nhập lý do', 'error'); return;
    }
    setSaving(true);
    try {
      const res = await cashflowApi.confirm({ cashCounted: parseVND(cash), bankBalances, reason: reason.trim() || null });
      const r = res.data?.data || res.data;
      if (!r.matched && !reason.trim()) {
        // Lần bấm đầu phát hiện lệch → hiện ô lý do, chưa đóng
        setResult(r);
        toast('Phát hiện sai lệch — vui lòng nhập lý do rồi xác nhận lại', 'warning');
        setSaving(false);
        return;
      }
      toast(r.matched ? 'Đã xác nhận — số tiền khớp' : 'Đã xác nhận & đặt dòng tiền mới', 'success');
      onDone();
    } catch (e) {
      toast(e?.response?.data?.message || 'Lỗi khi xác nhận', 'error');
      setSaving(false);
    }
  };

  const mismatch = result && !result.matched;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-black/5">
          <div className="flex items-center gap-2">
            <ShieldCheck size={20} className="text-[#C9A84C]" />
            <h2 className="text-lg font-bold text-[#1C1C1E]">Xác nhận dòng tiền</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-[#FAF7F2] text-[#8E8878]"><X size={20} /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          <p className="text-xs text-[#8E8878]">
            Nhập số tiền thực tế đang có. Nếu khớp hệ thống → chỉ ghi nhận. Nếu lệch → nhập lý do,
            và số bạn nhập sẽ trở thành <b>dòng tiền đầu kỳ mới</b> từ thời điểm này.
          </p>

          <div>
            <label className="block text-sm font-semibold text-[#1C1C1E] mb-1.5 flex items-center gap-1.5">
              <Wallet size={14} className="text-emerald-600" /> Tiền mặt thực tế
            </label>
            <input value={cash ? new Intl.NumberFormat('vi-VN').format(parseVND(cash)) : ''}
              onChange={e => { setCash(String(parseVND(e.target.value))); setResult(null); }}
              placeholder="Nhập số tiền mặt..."
              className="w-full px-4 py-2.5 rounded-xl border border-[#E8DDD0] text-sm text-right focus:outline-none focus:border-[#C9A84C]" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-semibold text-[#1C1C1E] flex items-center gap-1.5">
                <Landmark size={14} className="text-sky-600" /> Số dư từng ngân hàng
              </label>
              <button onClick={() => setAddingBank(a => !a)} className="text-xs text-[#C9A84C] font-semibold hover:underline flex items-center gap-1">
                <Plus size={12} /> Thêm NH
              </button>
            </div>
            {addingBank && (
              <div className="flex gap-2 mb-2">
                <input value={newBank} onChange={e => setNewBank(e.target.value)} placeholder="Tên ngân hàng mới..."
                  className="flex-1 px-3 py-2 rounded-lg border border-[#E8DDD0] text-sm focus:outline-none focus:border-[#C9A84C]" />
                <button onClick={addBank} className="px-3 py-2 rounded-lg bg-[#C9A84C] text-white text-sm font-semibold">Thêm</button>
              </div>
            )}
            <div className="space-y-2">
              {banks.map(b => (
                <div key={b.id || b.name} className="flex items-center gap-2">
                  <span className="text-sm text-[#5C4E3D] w-32 flex-shrink-0 truncate">{b.name}</span>
                  <input value={balances[b.name] ? new Intl.NumberFormat('vi-VN').format(parseVND(balances[b.name])) : ''}
                    onChange={e => { setBal(b.name, e.target.value); setResult(null); }}
                    placeholder="0"
                    className="flex-1 px-3 py-2 rounded-lg border border-[#E8DDD0] text-sm text-right focus:outline-none focus:border-[#C9A84C]" />
                </div>
              ))}
              {banks.length === 0 && <p className="text-xs text-[#8E8878]">Chưa có ngân hàng nào.</p>}
            </div>
          </div>

          {/* Preview đối chiếu khi lệch */}
          {mismatch && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-3 space-y-2">
              <p className="text-sm font-semibold text-red-600 flex items-center gap-1.5">
                <AlertTriangle size={14} /> Có sai lệch với hệ thống
              </p>
              <div className="text-xs text-red-700 space-y-0.5">
                <div className="flex justify-between"><span>Tiền mặt hệ thống</span><b>{fmtVND(result.expected?.cash)}</b></div>
                <div className="flex justify-between"><span>Chuyển khoản hệ thống</span><b>{fmtVND(result.expected?.bankTotal)}</b></div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-red-600 mb-1">Lý do sai lệch *</label>
                <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2}
                  placeholder="Giải thích nguyên nhân lệch..."
                  className="w-full px-3 py-2 rounded-lg border border-red-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-200" />
              </div>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-black/5 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-black/10 text-sm font-semibold text-[#8E8878] hover:bg-[#FAF7F2] transition">
            Huỷ
          </button>
          <button onClick={submit} disabled={saving}
            className="flex-1 py-3 rounded-xl bg-[#C9A84C] text-white text-sm font-bold hover:bg-[#B8923E] transition disabled:opacity-50">
            {saving ? 'Đang xử lý...' : mismatch ? 'Xác nhận & đặt dòng tiền mới' : 'Xác nhận'}
          </button>
        </div>
      </div>
    </div>
  );
}
