/*
 * SALES BONUS v2 — ConfigModal + ReviewModal (10/2026)
 *
 * Features:
 *   • Ladder tiers (nhiều mốc % đạt target → % đơn giá)
 *   • Personal target per SELLER (chỉ áp dụng cho SELLER / SUPER_SELLER)
 *   • Review modal 2 dòng per seller + sub-dialog set personal target
 */

import { useEffect, useMemo, useState } from 'react';
import { X, Calculator, Check, AlertTriangle, Edit3, Plus, Trash2, Target } from 'lucide-react';

const fmt = (v) => (v == null ? '—' : Number(v).toLocaleString('vi-VN'));
const parseInt0 = (s) => {
  if (s === '' || s == null) return 0;
  const n = Number(String(s).replace(/[^\d-]/g, ''));
  return Number.isFinite(n) ? Math.trunc(n) : 0;
};
const DEFAULT_TIERS = [
  { thresholdPercent: 90, pricePercent: 100 },
  { thresholdPercent: 75, pricePercent: 50 },
];

/* ╔══════════════════════════════════════════════════════════════════════╗
   ║ CONFIG MODAL — target + bước + đơn giá + tiers                       ║
   ╚══════════════════════════════════════════════════════════════════════╝ */
export function SalesBonusV2ConfigModal({
  month, year,
  initialTarget = 0,
  initialStepAmount = 100_000_000,
  initialStepUnitPrice = 400_000,
  initialTiers = DEFAULT_TIERS,
  computing = false,
  onCancel,
  onConfirm,              // ({target, stepAmount, stepUnitPrice, tiers}) => void
}) {
  const [target, setTarget] = useState(fmt(initialTarget));
  const [stepAmount, setStepAmount] = useState(fmt(initialStepAmount));
  const [stepUnit, setStepUnit] = useState(fmt(initialStepUnitPrice));
  const [tiers, setTiers] = useState(() =>
    (initialTiers && initialTiers.length > 0 ? initialTiers : DEFAULT_TIERS)
      .map(t => ({ th: String(t.thresholdPercent ?? ''), pr: String(t.pricePercent ?? '') }))
  );

  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') onCancel?.(); };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [onCancel]);

  const addTier = () => setTiers(p => [...p, { th: '', pr: '' }]);
  const delTier = (i) => setTiers(p => p.filter((_, j) => j !== i));
  const upTier  = (i, key, val) => setTiers(p => p.map((t, j) => j === i ? { ...t, [key]: val.replace(/[^\d]/g, '') } : t));

  const submit = () => {
    const cleanTiers = tiers
      .map(t => ({ thresholdPercent: parseInt0(t.th), pricePercent: parseInt0(t.pr) }))
      .filter(t => t.thresholdPercent > 0 && t.pricePercent >= 0)
      .sort((a, b) => b.thresholdPercent - a.thresholdPercent);
    const payload = {
      target: parseInt0(target),
      stepAmount: parseInt0(stepAmount),
      stepUnitPrice: parseInt0(stepUnit),
      tiers: cleanTiers,
    };
    if (payload.stepAmount <= 0 || payload.stepUnitPrice <= 0) return;
    onConfirm?.(payload);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-surface w-full max-w-xl rounded-t-3xl sm:rounded-2xl shadow-2xl
        max-h-[92vh] sm:max-h-[88vh] flex flex-col overflow-y-auto">

        <div className="flex items-center justify-between px-5 py-4 border-b border-hairline">
          <div className="flex items-center gap-2">
            <Calculator size={18} className="text-gold" />
            <h3 className="text-base font-bold text-ink">
              Tính thưởng Sales — Tháng {month}/{year}
            </h3>
          </div>
          <button onClick={onCancel} className="w-8 h-8 rounded-lg hover:bg-canvas flex items-center justify-center">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <Field label="Doanh thu TARGET của phòng (đồng)"
                 hint="Target cá nhân mỗi NV kinh doanh set riêng ở modal xác nhận."
                 value={target} onChange={setTarget} />
          <Field label="Bước doanh thu (đồng)"
                 hint="Mặc định 100.000.000 — mỗi 100tr tính 1 bước."
                 value={stepAmount} onChange={setStepAmount} />
          <Field label="Đơn giá / bước full 100% (đồng)"
                 hint="Giá cho mỗi bước khi đạt mốc 100% trong ladder dưới."
                 value={stepUnit} onChange={setStepUnit} />

          {/* ─── Ladder tiers ─── */}
          <div className="rounded-xl border border-hairline-2 bg-canvas/40 p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-bold text-ink-2">
                Mốc tỷ lệ (% đạt target → % đơn giá)
              </div>
              <button type="button" onClick={addTier}
                className="text-[11px] font-semibold text-gold hover:underline inline-flex items-center gap-1">
                <Plus size={12} /> Thêm mốc
              </button>
            </div>
            <p className="text-[11px] text-muted mb-2">
              Áp per-seller theo <strong>% doanh thu / target cá nhân</strong>. Mốc đầu tiên match → áp dụng. Nếu không khớp → 0đ.
            </p>
            <div className="space-y-1.5">
              {tiers.map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-[11px] text-muted shrink-0 w-6">≥</span>
                  <input type="text" inputMode="numeric" value={t.th}
                         onChange={(e) => upTier(i, 'th', e.target.value)}
                         onFocus={(e) => e.target.select()}
                         placeholder="90"
                         className="w-16 text-right px-2 py-1 rounded border border-hairline-2 bg-surface
                                    tabular-nums font-semibold text-sm focus:border-gold outline-none" />
                  <span className="text-[11px] text-muted shrink-0">%</span>
                  <span className="text-[11px] text-muted shrink-0 mx-1">→</span>
                  <input type="text" inputMode="numeric" value={t.pr}
                         onChange={(e) => upTier(i, 'pr', e.target.value)}
                         onFocus={(e) => e.target.select()}
                         placeholder="100"
                         className="w-16 text-right px-2 py-1 rounded border border-hairline-2 bg-surface
                                    tabular-nums font-semibold text-sm focus:border-gold outline-none" />
                  <span className="text-[11px] text-muted shrink-0">% đơn giá</span>
                  <button type="button" onClick={() => delTier(i)}
                          className="ml-auto p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-500/10 text-red-500">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              {tiers.length === 0 && (
                <p className="text-[11px] text-muted italic">Không có mốc → dùng mặc định (≥90% full, ≥75% 50%).</p>
              )}
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-hairline bg-canvas/60 flex justify-end gap-2">
          <button onClick={onCancel} disabled={computing}
                  className="px-4 py-2 rounded-lg text-sm font-semibold border border-hairline-2 hover:bg-canvas">
            Hủy
          </button>
          <button onClick={submit} disabled={computing}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-gold text-black hover:bg-gold/90 disabled:opacity-50">
            {computing ? 'Đang tính...' : 'Tính thưởng'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, value, onChange }) {
  return (
    <div>
      <label className="block text-xs font-bold text-ink-2 mb-1">{label}</label>
      <input
        type="text" inputMode="numeric"
        className="w-full px-3 py-2 rounded-lg border border-hairline-2 bg-surface text-ink
                   font-bold tabular-nums focus:border-gold focus:ring-1 focus:ring-gold/30 outline-none"
        value={value}
        onChange={(e) => onChange(fmt(parseInt0(e.target.value)))}
        onFocus={(e) => e.target.select()}
      />
      {hint && <p className="text-[11px] text-muted mt-1">{hint}</p>}
    </div>
  );
}

/* ╔══════════════════════════════════════════════════════════════════════╗
   ║ REVIEW MODAL — bảng per-seller editable, click row để set target CN  ║
   ╚══════════════════════════════════════════════════════════════════════╝ */
export function SalesBonusV2ReviewModal({
  preview,
  publishing = false,
  readOnly = false,
  onCancel,
  onBack,                  // "Quay lại" — reopen ConfigModal
  onPublish,               // "Xác nhận" — save overrides (chưa Public)
}) {
  const [edits, setEdits] = useState(() => {
    const o = {};
    (preview?.rows || []).forEach(r => {
      o[r.userId] = {
        stepUnitPrice: fmt(r.stepUnitPrice ?? 0),
        remainderBonus: fmt(r.remainderBonus ?? 0),
        personalTarget: r.personalTarget != null ? fmt(r.personalTarget) : '',
      };
    });
    return o;
  });
  const [editingTargetFor, setEditingTargetFor] = useState(null); // userId of row being edited

  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') onCancel?.(); };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [onCancel]);

  const rows = preview?.rows || [];

  const totals = useMemo(() => {
    let pool = 0, rev = 0;
    rows.forEach(r => {
      const unit = parseInt0(edits[r.userId]?.stepUnitPrice);
      const rem  = parseInt0(edits[r.userId]?.remainderBonus);
      pool += (r.steps || 0) * unit + rem;
      rev  += r.revenue || 0;
    });
    return { pool, rev };
  }, [rows, edits]);

  const update = (uid, field, raw) => {
    setEdits(prev => ({
      ...prev,
      [uid]: { ...(prev[uid] || {}), [field]: fmt(parseInt0(raw)) },
    }));
  };

  const submit = () => {
    const overrides = rows.map(r => {
      const base = {
        userId: r.userId,
        stepUnitPrice: parseInt0(edits[r.userId]?.stepUnitPrice),
        remainderBonus: parseInt0(edits[r.userId]?.remainderBonus),
      };
      if (r.isSalesSeller) {
        const t = parseInt0(edits[r.userId]?.personalTarget);
        if (t > 0) base.personalTarget = t;
      }
      return base;
    });
    onPublish?.(overrides);
  };

  const targetRow = rows.find(r => r.userId === editingTargetFor);

  return (
    <>
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-surface w-full max-w-6xl rounded-t-3xl sm:rounded-2xl shadow-2xl
        max-h-[92vh] sm:max-h-[90vh] flex flex-col">

        <div className="flex items-center justify-between px-5 py-4 border-b border-hairline">
          <div className="flex items-center gap-2">
            <Edit3 size={18} className="text-gold" />
            <h3 className="text-base font-bold text-ink">
              Xác nhận thưởng Sales — Tháng {preview?.month}/{preview?.year}
            </h3>
          </div>
          <button onClick={onCancel} className="w-8 h-8 rounded-lg hover:bg-canvas flex items-center justify-center">
            <X size={16} />
          </button>
        </div>

        {/* Header stats */}
        <div className="px-5 py-3 border-b border-hairline bg-canvas/40 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatBox label="Doanh thu phòng" value={fmt(preview?.deptRevenue)} tone={preview?.targetAchieved ? 'ok' : 'warn'} />
          <StatBox label="Target phòng" value={fmt(preview?.target)} />
          <StatBox label="Mốc"
                   value={(preview?.tiers || []).map(t => `≥${t.thresholdPercent}%=${t.pricePercent}%`).join(' · ') || '—'} />
          <StatBox label="Tổng thưởng" value={fmt(totals.pool)} tone="gold" />
        </div>

        <div className="flex-1 overflow-auto px-3 sm:px-5 py-3">
          <table className="w-full text-sm table-fixed">
            <colgroup>
              <col style={{ width: '28%' }} />
              <col style={{ width: '16%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '22%' }} />
              <col style={{ width: '24%' }} />
            </colgroup>
            <thead>
              <tr className="text-[11px] font-bold text-muted border-b border-hairline">
                <th className="text-left py-2 px-2">Nhân viên</th>
                <th className="text-right py-2 px-2">Số tiền</th>
                <th className="text-right py-2 px-2">Số bước</th>
                <th className="text-right py-2 px-2">Đơn giá</th>
                <th className="text-right py-2 px-2">Tổng</th>
              </tr>
            </thead>
            <tbody>
              {rows.flatMap(r => {
                const stepUnit = parseInt0(edits[r.userId]?.stepUnitPrice);
                const remUnit  = parseInt0(edits[r.userId]?.remainderBonus);
                const stepTotal = (r.steps || 0) * stepUnit;
                const remTotal  = remUnit;
                const sellerTotal = stepTotal + remTotal;
                const stepsAmount = (r.steps || 0) * (preview?.stepAmount || 0);
                const defaultUnit = Math.round((preview?.stepUnitPrice || 0) * (r.appliedMultiplier ?? preview?.multiplier ?? 1));
                // (10/2026) Default remainderBonus theo công thức mới:
                //   remPercent = floor(remainder / stepAmount * 100) — chỉ phần nguyên
                //   remBonus   = ceilTo5000(remPercent × defaultUnit / 100)
                const stepAmt = preview?.stepAmount || 0;
                const remPct = stepAmt > 0
                  ? Math.floor((r.remainder || 0) * 100 / stepAmt) : 0;
                const defaultRemRaw = Math.floor(remPct * defaultUnit / 100);
                const defaultRem = defaultRemRaw > 0
                  ? Math.ceil(defaultRemRaw / 5000) * 5000 : 0;
                const edited = (stepUnit !== defaultUnit) || (remUnit !== defaultRem);
                const t = r.personalTarget;
                const achieved = r.achievedPercent;

                return [
                  <tr key={`${r.userId}-step`} className="border-t border-hairline hover:bg-canvas/40">
                    <td className="py-2 px-2 align-top" rowSpan={2}>
                      <div className="font-semibold text-ink">{r.fullName}</div>
                      <div className="text-[11px] text-muted">{r.roleLabel}</div>
                      <div className="text-[11px] text-muted mt-1">
                        DT: <span className="tabular-nums font-semibold text-ink-2">{fmt(r.revenue)}</span>
                      </div>
                      {/* (10/2026) Mọi NV trong list đều set được target, kể cả doanh thu 0 */}
                      <button type="button"
                              disabled={readOnly}
                              onClick={() => !readOnly && setEditingTargetFor(r.userId)}
                              className="mt-1 text-[11px] inline-flex items-center gap-1 px-1.5 py-0.5
                                         rounded bg-blue-50 dark:bg-blue-500/10 border border-blue-200
                                         dark:border-blue-500/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100
                                         disabled:cursor-default disabled:hover:bg-blue-50">
                        <Target size={10} />
                        Target: <span className="tabular-nums font-bold">{t ? fmt(t) : 'chưa set'}</span>
                        {achieved != null && (
                          <span className="opacity-80">· {(Math.floor(achieved * 100) / 100).toFixed(2)}%</span>
                        )}
                      </button>
                    </td>
                    <td className="text-right tabular-nums py-2 px-2">{fmt(stepsAmount)}</td>
                    <td className="text-right tabular-nums py-2 px-2">
                      {r.steps > 0 ? `${r.steps} bước` : '—'}
                    </td>
                    <td className="py-2 px-2">
                      <input type="text" inputMode="numeric"
                             disabled={readOnly}
                             value={edits[r.userId]?.stepUnitPrice ?? ''}
                             onChange={(e) => update(r.userId, 'stepUnitPrice', e.target.value)}
                             onFocus={(e) => e.target.select()}
                             className="w-full text-right px-2 py-1 rounded border border-hairline-2 bg-surface
                                        tabular-nums font-semibold text-sm focus:border-gold outline-none
                                        disabled:bg-canvas disabled:text-muted disabled:cursor-default" />
                    </td>
                    <td className="text-right tabular-nums font-semibold text-ink py-2 px-2 truncate">
                      {fmt(stepTotal)}
                    </td>
                  </tr>,
                  <tr key={`${r.userId}-rem`} className="hover:bg-canvas/40">
                    <td className="text-right tabular-nums py-2 px-2 text-muted">{fmt(r.remainder)}</td>
                    <td className="text-right tabular-nums py-2 px-2 text-muted">—</td>
                    <td className="py-2 px-2">
                      <input type="text" inputMode="numeric"
                             disabled={readOnly}
                             value={edits[r.userId]?.remainderBonus ?? ''}
                             onChange={(e) => update(r.userId, 'remainderBonus', e.target.value)}
                             onFocus={(e) => e.target.select()}
                             className="w-full text-right px-2 py-1 rounded border border-hairline-2 bg-surface
                                        tabular-nums font-semibold text-sm focus:border-gold outline-none
                                        disabled:bg-canvas disabled:text-muted disabled:cursor-default" />
                    </td>
                    <td className="text-right tabular-nums font-semibold text-ink py-2 px-2 truncate">
                      {fmt(remTotal)}
                    </td>
                  </tr>,
                  <tr key={`${r.userId}-sum`} className="border-b-2 border-hairline-2 bg-canvas/30">
                    <td colSpan={4} className="text-right text-[11px] text-muted py-1.5 px-2 font-semibold">
                      Σ {r.fullName}:
                      {edited && <span className="ml-1 text-[9px] text-amber-500">● đã sửa</span>}
                    </td>
                    <td className="text-right tabular-nums font-bold text-gold py-1.5 px-2 truncate">
                      {fmt(sellerTotal)}
                    </td>
                  </tr>,
                ];
              })}
              {rows.length === 0 && (
                <tr><td colSpan={5} className="text-center py-8 text-muted">Chưa có nhân viên nào.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-4 border-t border-hairline bg-canvas/60 flex items-center justify-between gap-4">
          <div className="text-[11px] text-muted flex-1 space-y-1">
            <p className="flex items-center gap-1">
              <AlertTriangle size={12} /> Chỉ nhập số nguyên. Bấm "Lưu & Public" để nhân viên thấy phiếu.
            </p>
            <p>
              Đơn giá trên mỗi bước: <strong className="text-ink">{fmt(preview?.stepUnitPrice)}đ</strong> trên mỗi{' '}
              <strong className="text-ink">{fmt(preview?.stepAmount)}đ</strong> doanh thu đã trừ VAT và giảm giá.
            </p>
          </div>
          <div className="flex gap-2">
            {readOnly ? (
              <button onClick={onCancel}
                      className="px-4 py-2 rounded-lg text-sm font-semibold bg-gold text-black hover:bg-gold/90">
                Đóng
              </button>
            ) : (
              <>
                <button onClick={onBack || onCancel} disabled={publishing}
                        className="px-4 py-2 rounded-lg text-sm font-semibold border border-hairline-2 hover:bg-canvas">
                  Quay lại
                </button>
                <button onClick={submit} disabled={publishing}
                        className="px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 inline-flex items-center gap-1.5">
                  <Check size={14} /> {publishing ? 'Đang lưu...' : 'Xác nhận'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>

    {/* Sub-dialog: set personal target */}
    {editingTargetFor && targetRow && (
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setEditingTargetFor(null)} />
        <div className="relative bg-surface w-full max-w-md rounded-2xl shadow-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Target size={18} className="text-blue-500" />
            <h4 className="text-base font-bold text-ink">
              Target cá nhân — {targetRow.fullName}
            </h4>
          </div>
          <p className="text-[11px] text-muted mb-3">
            Lưu vào tài khoản của NV. Các tháng sau sẽ dùng số này cho đến khi sửa tiếp.
          </p>
          <input
            type="text" inputMode="numeric"
            autoFocus
            value={edits[editingTargetFor]?.personalTarget ?? ''}
            onChange={(e) => update(editingTargetFor, 'personalTarget', e.target.value)}
            onFocus={(e) => e.target.select()}
            placeholder="VD 500.000.000"
            className="w-full px-3 py-2 rounded-lg border border-hairline-2 bg-canvas text-ink
                       font-bold tabular-nums text-lg focus:border-gold focus:ring-1 focus:ring-gold/30 outline-none"
          />
          <div className="text-[11px] text-muted mt-2">
            DT thực đạt: <strong className="text-ink">{fmt(targetRow.revenue)}đ</strong>
            {parseInt0(edits[editingTargetFor]?.personalTarget) > 0 && (
              <> · % đạt: <strong className="text-ink">
                {((targetRow.revenue / parseInt0(edits[editingTargetFor]?.personalTarget)) * 100).toFixed(2)}%
              </strong></>
            )}
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setEditingTargetFor(null)}
                    className="px-4 py-2 rounded-lg text-sm font-semibold border border-hairline-2 hover:bg-canvas">
              Xong
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

function StatBox({ label, value, tone = 'default' }) {
  const toneCls = {
    default: 'bg-surface border-hairline text-ink',
    ok:      'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-200',
    warn:    'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-200',
    gold:    'bg-gold/10 border-gold/40 text-ink',
  }[tone];
  return (
    <div className={`rounded-lg border p-2 ${toneCls}`}>
      <p className="text-[10px] uppercase tracking-wider opacity-80 font-bold">{label}</p>
      <p className="text-sm font-bold tabular-nums mt-0.5 truncate">{value}</p>
    </div>
  );
}