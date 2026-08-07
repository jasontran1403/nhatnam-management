// src/pages/accountant/AccountantWarehouseReceiptsPage.jsx
//
// KẾ TOÁN TRƯỞNG NHẬP GIÁ VỐN cho phiếu nhập kho.
//
// LƯU Ý FLOW MỚI: tồn kho ĐÃ được cộng ngay lúc nhân viên kho tạo phiếu nhập
// (lô HSD được tạo trước với giá vốn = 0). Bước này CHỈ cập nhật lại giá vốn thật.
//
// Nhập giá có 2 cách (mặc định = ĐƠN GIÁ):
//   1. Đơn giá / 1 đơn vị
//   2. Tổng tiền của mặt hàng → UI tự chia cho số lượng ra đơn giá (làm tròn 3 số lẻ)
//
// Thuế/phí: mỗi dòng là 1 loại riêng, label tự nhập, chọn được áp dụng cho những
// nguyên liệu nào. Phân bổ theo tỷ trọng giá trị (đơn giá × SL) — xem utils/costCalc.js.
import { useState, useEffect, useCallback, useMemo } from 'react';
import useMinLoading from '../../hooks/useMinLoading.js';
import {
  Warehouse, DollarSign, CheckCircle, Clock, RefreshCw, Plus, Trash2, Eye, Info,
} from 'lucide-react';
import { accountantWarehouseApi } from '../../api/accountantApi';
import { useToast } from '../../components/common/Toast';
import { useLang } from '../../context/LangContext';
import Modal from '../../components/ui/Modal';
import {
  allocateCost, unitPriceFromTotal, parseMoneyInput, clampDecimalInput,
  fmtMoney, fmtDong, MONEY_DECIMALS,
} from '../../utils/costCalc';

const inputCls =
  'w-full px-3 py-2 rounded-lg border border-hairline-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40';

// ═════════════════════════════════════════════════════════════════════════════
// MODAL NHẬP GIÁ VỐN
// ═════════════════════════════════════════════════════════════════════════════
function CostModal({ receipt, onClose, onDone }) {
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const items = useMemo(() => receipt?.items || [], [receipt]);

  // Chế độ nhập giá: 'UNIT' (đơn giá 1 đơn vị — MẶC ĐỊNH) | 'TOTAL' (tổng tiền của mặt hàng)
  const [priceMode, setPriceMode] = useState('UNIT');

  // itemId -> chuỗi người dùng gõ (đơn giá hoặc tổng tiền tuỳ priceMode)
  const [priceInputs, setPriceInputs] = useState(() => {
    const init = {};
    items.forEach((it) => { init[it.id] = ''; });
    return init;
  });

  // Các dòng thuế/phí: [{ key, label, amount, itemIds }]
  const [fees, setFees] = useState([]);

  const setPrice = (id, raw) =>
    setPriceInputs((p) => ({ ...p, [id]: clampDecimalInput(raw) }));

  // Đổi chế độ nhập → quy đổi lại số đang gõ để user không mất dữ liệu
  const switchMode = (mode) => {
    if (mode === priceMode) return;
    setPriceInputs((prev) => {
      const next = {};
      items.forEach((it) => {
        const v = parseMoneyInput(prev[it.id]);
        const qty = Number(it.quantity) || 0;
        if (v === null || !qty) { next[it.id] = ''; return; }
        next[it.id] = mode === 'TOTAL'
          ? String(v * qty)                       // đơn giá → tổng tiền
          : String(unitPriceFromTotal(v, qty));   // tổng tiền → đơn giá (3 số lẻ)
      });
      return next;
    });
    setPriceMode(mode);
    setShowPreview(false);
  };

  const addFee = () =>
    setFees((p) => [...p, {
      key: Date.now() + Math.random(),
      label: '',
      amount: '',
      itemIds: items.map((it) => it.id),   // mặc định áp dụng cho tất cả
    }]);
  const removeFee = (key) => setFees((p) => p.filter((f) => f.key !== key));
  const updateFee = (key, patch) =>
    setFees((p) => p.map((f) => (f.key === key ? { ...f, ...patch } : f)));
  const toggleFeeItem = (key, itemId) =>
    setFees((p) => p.map((f) => {
      if (f.key !== key) return f;
      const has = f.itemIds.includes(itemId);
      return { ...f, itemIds: has ? f.itemIds.filter((x) => x !== itemId) : [...f.itemIds, itemId] };
    }));

  // ── Đơn giá thực tế của từng dòng (đã quy đổi từ chế độ nhập) ──────────────
  const unitPrices = useMemo(() => {
    const m = {};
    items.forEach((it) => {
      const v = parseMoneyInput(priceInputs[it.id]);
      const qty = Number(it.quantity) || 0;
      if (v === null) { m[it.id] = 0; return; }
      m[it.id] = priceMode === 'TOTAL' ? unitPriceFromTotal(v, qty) : v;
    });
    return m;
  }, [items, priceInputs, priceMode]);

  // ── PREVIEW: giá vốn tạm tính (cùng công thức với backend) ─────────────────
  const alloc = useMemo(() => allocateCost(
    items.map((it) => ({
      id: it.id,
      quantity: Number(it.quantity) || 0,
      unitPrice: unitPrices[it.id] || 0,
    })),
    fees
      .filter((f) => f.label.trim() && parseMoneyInput(f.amount) > 0)
      .map((f) => ({
        label: f.label.trim(),
        amount: parseMoneyInput(f.amount),
        itemIds: f.itemIds,
      })),
  ), [items, unitPrices, fees]);

  const totalFee = fees.reduce((s, f) => s + (parseMoneyInput(f.amount) || 0), 0);
  const totalValue = items.reduce((s, it) => s + (alloc.get(it.id)?.lineValue || 0), 0);
  const totalCost = items.reduce((s, it) => s + (alloc.get(it.id)?.lineCost || 0), 0);

  const allPricesEntered = items.every((it) => (unitPrices[it.id] || 0) > 0);
  const allFeesValid = fees.every(
    (f) => f.label.trim() && parseMoneyInput(f.amount) > 0 && f.itemIds.length > 0,
  );
  const canSubmit = items.length > 0 && allPricesEntered && allFeesValid;

  const buildPayload = () => ({
    items: items.map((it) => ({
      receiptItemId: it.id,
      unitPrice: unitPrices[it.id],
    })),
    costEntries: fees
      .filter((f) => f.label.trim() && parseMoneyInput(f.amount) > 0)
      .map((f) => ({
        label: f.label.trim(),
        amount: parseMoneyInput(f.amount),
        itemIds: f.itemIds,
      })),
  });

  const handlePreview = () => {
    if (!canSubmit) {
      toast('Vui lòng nhập đủ giá cho tất cả nguyên liệu và hoàn thiện các dòng thuế/phí', 'error');
      return;
    }
    setShowPreview(true);
  };

  const handleConfirm = async () => {
    if (!canSubmit) return;
    setConfirming(true);
    try {
      await accountantWarehouseApi.confirmCost(receipt.id, buildPayload());
      toast('Đã xác nhận giá vốn cho phiếu nhập kho', 'success');
      onDone();
    } catch (e) {
      toast(e?.response?.data?.message || 'Có lỗi xảy ra', 'error');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Nhập giá vốn — ${receipt.receiptCode}`} size="lg">
      <div className="mt-3 space-y-5">
        <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/28 rounded-xl p-3">
          <p className="text-sm text-blue-800 dark:text-blue-300">
            Kho: <span className="font-semibold">{receipt.warehouseName}</span>
          </p>
        </div>

        {/* ── Chọn loại giá nhập ── */}
        <div>
          <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
            Loại giá nhập
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => switchMode('UNIT')}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition ${
                priceMode === 'UNIT'
                  ? 'bg-gold text-white border-gold'
                  : 'bg-surface text-muted border-hairline-2'
              }`}>
              Đơn giá / 1 đơn vị
            </button>
            <button
              onClick={() => switchMode('TOTAL')}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition ${
                priceMode === 'TOTAL'
                  ? 'bg-gold text-white border-gold'
                  : 'bg-surface text-muted border-hairline-2'
              }`}>
              Tổng tiền của mặt hàng
            </button>
          </div>
          <p className="text-[11px] text-muted mt-1.5">
            Được nhập tối đa {MONEY_DECIMALS} số sau dấu thập phân.
            {priceMode === 'TOTAL' && ' Hệ thống tự chia cho số lượng để ra đơn giá.'}
          </p>
        </div>

        {/* ── Giá từng nguyên liệu ── */}
        <div className="space-y-3 max-h-[38vh] overflow-y-auto pr-1">
          {items.map((item) => {
            const r = alloc.get(item.id);
            const up = unitPrices[item.id] || 0;
            return (
              <div key={item.id} className="bg-canvas rounded-xl p-3">
                <div className="flex items-center gap-3">
                  {item.imageUrl && (
                    <img src={item.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-ink text-sm">{item.ingredientName}</p>
                    <p className="text-xs text-muted">
                      SL: <span className="font-medium text-ink">{item.quantity} {item.unit}</span>
                      {item.expiryDate && ` · HSD: ${item.expiryDate}`}
                    </p>
                  </div>
                </div>
                <div className="mt-2">
                  <label className="text-xs font-semibold text-ink mb-1 block">
                    {priceMode === 'UNIT'
                      ? `Đơn giá / ${item.unit || 'đơn vị'} (đ) *`
                      : 'Tổng tiền của mặt hàng (đ) *'}
                  </label>
                  <div className="relative">
                    <DollarSign size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                    <input
                      type="text"
                      inputMode="decimal"
                      value={priceInputs[item.id] ?? ''}
                      onChange={(e) => { setPrice(item.id, e.target.value); setShowPreview(false); }}
                      placeholder={priceMode === 'UNIT' ? 'VD: 12500.5' : 'VD: 1250000'}
                      className={`${inputCls} pl-8`}
                    />
                  </div>
                  {up > 0 && (
                    <p className="text-xs text-muted mt-1">
                      {priceMode === 'TOTAL' ? (
                        <>Đơn giá: <b className="text-ink">{fmtMoney(up)} đ/{item.unit}</b></>
                      ) : (
                        <>Thành tiền: <b className="text-ink">{fmtMoney(r?.lineValue)} đ</b></>
                      )}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Thuế / phí ── */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-muted uppercase tracking-wider">
              Thuế / phí (tuỳ chọn)
            </p>
            <button onClick={addFee}
              className="flex items-center gap-1 text-xs font-semibold text-gold hover:underline">
              <Plus size={13} /> Thêm thuế/phí
            </button>
          </div>

          {fees.length === 0 ? (
            <p className="text-xs text-muted flex items-start gap-1.5">
              <Info size={12} className="mt-0.5 flex-shrink-0" />
              Không có thuế/phí → giá vốn = đơn giá nhập. Nếu có, mỗi dòng là 1 loại riêng
              (tên tự đặt) và sẽ được phân bổ theo tỷ trọng giá trị của từng nguyên liệu.
            </p>
          ) : (
            <div className="space-y-3">
              {fees.map((f) => (
                <div key={f.key} className="bg-surface border border-hairline-2 rounded-xl p-3 space-y-2">
                  <div className="flex gap-2">
                    <input
                      className={inputCls}
                      placeholder="Tên loại thuế/phí (VD: Thuế nhập khẩu)"
                      value={f.label}
                      onChange={(e) => { updateFee(f.key, { label: e.target.value }); setShowPreview(false); }}
                    />
                    <input
                      type="text" inputMode="decimal"
                      className={`${inputCls} w-44`}
                      placeholder="Số tiền (đ)"
                      value={f.amount}
                      onChange={(e) => {
                        updateFee(f.key, { amount: clampDecimalInput(e.target.value) });
                        setShowPreview(false);
                      }}
                    />
                    <button onClick={() => { removeFee(f.key); setShowPreview(false); }}
                      className="p-2 rounded-lg hover:bg-red-50 dark:bg-red-500/10 text-red-400 transition flex-shrink-0">
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted mb-1">Áp dụng cho nguyên liệu:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {items.map((it) => {
                        const checked = f.itemIds.includes(it.id);
                        return (
                          <button key={it.id}
                            onClick={() => { toggleFeeItem(f.key, it.id); setShowPreview(false); }}
                            className={`text-xs px-2 py-1 rounded-full border transition ${
                              checked
                                ? 'bg-gold/10 border-gold text-gold font-semibold'
                                : 'bg-surface border-hairline-2 text-muted'
                            }`}>
                            {checked ? '✓ ' : ''}{it.ingredientName}
                          </button>
                        );
                      })}
                    </div>
                    {f.itemIds.length === 0 && (
                      <p className="text-xs text-red-500 mt-1">Chưa chọn nguyên liệu áp dụng</p>
                    )}
                  </div>
                </div>
              ))}
              <p className="text-right text-xs text-muted">
                Tổng thuế/phí: <b className="text-ink">{fmtMoney(totalFee)} đ</b>
              </p>
            </div>
          )}
        </div>

        {/* ── PREVIEW giá vốn tạm tính ── */}
        {showPreview && (
          <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/28 rounded-xl p-3 space-y-2">
            <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
              <Eye size={14} /> Giá vốn tạm tính
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-ink-2 border-b border-emerald-200 dark:border-emerald-500/28">
                    <th className="text-left py-1.5 font-semibold">Nguyên liệu</th>
                    <th className="text-right py-1.5 font-semibold">SL</th>
                    <th className="text-right py-1.5 font-semibold">Đơn giá</th>
                    <th className="text-right py-1.5 font-semibold">Thuế/phí gánh</th>
                    <th className="text-right py-1.5 font-semibold">Giá vốn / đv</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => {
                    const r = alloc.get(it.id);
                    if (!r) return null;
                    return (
                      <tr key={it.id} className="border-b border-emerald-100 dark:border-emerald-500/18 last:border-0">
                        <td className="py-1.5 text-ink">{it.ingredientName}</td>
                        <td className="py-1.5 text-right tabular-nums">{it.quantity} {it.unit}</td>
                        <td className="py-1.5 text-right tabular-nums">{fmtMoney(r.unitPrice)}</td>
                        <td className="py-1.5 text-right tabular-nums text-amber-700 dark:text-amber-300">
                          {r.feeShare > 0 ? fmtMoney(r.feeShare) : '—'}
                        </td>
                        <td className="py-1.5 text-right tabular-nums font-bold text-emerald-800 dark:text-emerald-300">
                          {fmtDong(r.unitCost)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="pt-2 border-t border-emerald-200 dark:border-emerald-500/28 flex justify-between text-xs">
              <span className="text-emerald-700 dark:text-emerald-300">
                Giá trị hàng: <b>{fmtMoney(totalValue)} đ</b> + Thuế/phí: <b>{fmtMoney(totalFee)} đ</b>
              </span>
              <span className="font-bold text-emerald-800 dark:text-emerald-300">
                Tổng giá vốn nhập kho: {fmtDong(totalCost)} đ
              </span>
            </div>
            <p className="text-[10px] text-emerald-700 dark:text-emerald-300">
              Giá vốn được làm tròn tới hàng đơn vị đồng ở bước cuối; các bước tính trung gian giữ nguyên phần thập phân.
            </p>
          </div>
        )}

        {/* ── Actions ── */}
        <div className="flex gap-2 pt-1">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-hairline-2 text-ink-2 hover:bg-canvas font-medium transition">
            Huỷ
          </button>
          <button onClick={handlePreview} disabled={!canSubmit}
            className="flex-1 py-2.5 rounded-xl border border-gold text-gold font-semibold hover:bg-gold/10 transition disabled:opacity-40 flex items-center justify-center gap-2">
            <Eye size={16} /> Xem trước giá vốn
          </button>
          <button onClick={handleConfirm} disabled={confirming || !canSubmit || !showPreview}
            title={!showPreview ? 'Bấm "Xem trước giá vốn" để kiểm tra trước khi lưu' : ''}
            className="flex-1 py-2.5 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-700 transition disabled:opacity-50 flex items-center justify-center gap-2">
            {confirming
              ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : <CheckCircle size={16} />}
            {confirming ? 'Đang lưu...' : 'Xác nhận & Lưu'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// PAGE
// ═════════════════════════════════════════════════════════════════════════════
export default function AccountantWarehouseReceiptsPage() {
  const toast = useToast();
  const { t } = useLang();
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useMinLoading();
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  const loadPending = useCallback(async () => {
    setLoading(true);
    try {
      const res = await accountantWarehouseApi.getPendingCost();
      setReceipts(res.data?.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [setLoading]);

  useEffect(() => { loadPending(); }, [loadPending]);

  const openDetail = async (receiptId) => {
    try {
      const res = await accountantWarehouseApi.getDetail(receiptId);
      setSelectedReceipt(res.data?.data);
    } catch (e) {
      toast(t('common', 'error_retry'), 'error');
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Warehouse size={24} className="text-gold" />
          <div>
            <h1 className="text-2xl font-bold text-ink">Phiếu nhập kho chờ giá vốn</h1>
            <p className="text-sm text-muted">
              Tồn kho đã cộng khi nhập hàng — nhập giá vốn để chốt giá cho các lô
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="bg-orange-100 dark:bg-orange-500/18 text-orange-700 dark:text-orange-300 text-sm font-semibold px-3 py-1 rounded-full">
            {receipts.length} chờ xử lý
          </span>
          <button onClick={loadPending} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-hairline-2 text-sm text-ink-2 hover:bg-canvas transition disabled:opacity-50"
            title="Làm mới">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Làm mới</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
        </div>
      ) : receipts.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-hairline shadow-sm text-center py-16">
          <CheckCircle size={48} className="mx-auto mb-3 text-green-400" />
          <p className="text-lg font-semibold text-ink">Không có phiếu chờ xử lý</p>
          <p className="text-sm text-muted mt-1">Tất cả phiếu nhập kho đã được xác nhận giá vốn</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {receipts.map((r) => (
            <div key={r.id} className="bg-surface rounded-2xl border border-hairline shadow-sm p-4 hover:shadow-md transition">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-gold">{r.receiptCode}</span>
                    <span className="flex items-center gap-1 text-xs bg-orange-100 dark:bg-orange-500/18 text-orange-700 dark:text-orange-300 px-2 py-0.5 rounded-full font-medium">
                      <Clock size={11} /> Chờ giá vốn
                    </span>
                  </div>
                  <p className="text-ink font-medium mt-1">{r.warehouseName}</p>
                  <p className="text-xs text-muted mt-0.5">
                    Người nhập kho: {r.createdByName} · {r.itemCount} mặt hàng
                    {r.referenceCode && ` · Mã NCC: ${r.referenceCode}`}
                  </p>
                </div>
                <button onClick={() => openDetail(r.id)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-gold text-white rounded-xl text-sm font-semibold hover:bg-gold-strong transition">
                  <DollarSign size={14} /> Nhập giá vốn
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedReceipt && (
        <CostModal
          key={selectedReceipt.id}
          receipt={selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
          onDone={() => { setSelectedReceipt(null); loadPending(); }}
        />
      )}
    </div>
  );
}
