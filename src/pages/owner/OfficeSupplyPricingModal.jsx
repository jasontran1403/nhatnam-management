// src/pages/owner/OfficeSupplyPricingModal.jsx
//
// Modal nhập GIÁ các vật dụng + phí phát sinh khi Owner bấm "Đặt hàng".
//
// Logic:
//   - Mỗi vật dụng có 1 ô "Thành tiền" (lineAmount) — người dùng nhập số nguyên VNĐ.
//   - Phí: mảng [{name, amount}] — Owner có thể thêm nhiều phí (phí giao hàng, phí
//     đóng gói…). Phí được BE chia theo tỉ trọng lineAmount và cộng vào đơn giá
//     theo đơn vị tính nhỏ nhất khi lưu.
//   - BẮT BUỘC: tất cả vật dụng phải có lineAmount ≥ 0 (được phép 0 để biếu/khuyến
//     mãi). Chỉ chặn ô bỏ TRỐNG hoặc giá trị không hợp lệ.
//
// Preview đơn giá hiển thị ở mỗi dòng — client dùng để Owner thấy ngay con số, BE
// tính lại khi lưu (cùng công thức).
import { useMemo, useState } from 'react';
import { X, Plus, Trash2, Wallet, Receipt, Package, Tag } from 'lucide-react';
import { fmtQtyOff } from '../../api/officeSupplyApi';

const nf = (n) => new Intl.NumberFormat('vi-VN').format(Math.round(Number(n) || 0));
const parseVND = (s) => Number(String(s ?? '').replace(/[^\d]/g, '')) || 0;

export default function OfficeSupplyPricingModal({ summaryRows, onCancel, onConfirm, submitting }) {
  // Khởi tạo state: {itemId: amountString}
  const [amounts, setAmounts] = useState(() => {
    const o = {};
    summaryRows.forEach(r => { o[r.supplyItemId || r.id] = ''; });
    return o;
  });
  // Nếu BE trả summaryRows không có supplyItemId (một số chỗ dùng stt), cần map
  // theo thứ tự index. Nhưng BE summary trả về chưa có id → dùng key = tên+unit.
  // Chuẩn an toàn: cho dù BE không có id, ta vẫn gửi theo id — nên phải fetch
  // được id ở nơi gọi. Modal này nhận summaryRows đã có `supplyItemId`.

  const [fees, setFees] = useState([]); // [{name, amount}]
  const [discount, setDiscount] = useState(''); // string VNĐ

  const addFee = () => setFees(fs => [...fs, { name: '', amount: '' }]);
  const removeFee = (i) => setFees(fs => fs.filter((_, idx) => idx !== i));
  const updateFee = (i, patch) => setFees(fs => fs.map((f, idx) => idx === i ? { ...f, ...patch } : f));

  const subtotal = useMemo(() =>
    Object.values(amounts).reduce((s, v) => s + parseVND(v), 0), [amounts]);
  const totalFees = useMemo(() =>
    fees.reduce((s, f) => s + parseVND(f.amount), 0), [fees]);
  const discountNum = parseVND(discount);
  // Phí RÒNG = phí - giảm giá. Phân bổ cùng công thức, dấu âm nếu ròng âm.
  const netFees = totalFees - discountNum;
  const grand = subtotal + netFees;

  // Preview đơn giá — cùng công thức BE (feeShare dùng netFees).
  const unitPriceOf = (row) => {
    const id = row.supplyItemId;
    const qty = Number(row.totalQuantity) || 0;
    if (qty <= 0) return 0;
    const line = parseVND(amounts[id]);
    const feeShare = subtotal > 0
      ? netFees * (line / subtotal)
      : (summaryRows.length > 0 ? netFees * (qty / summaryRows.reduce((s, r) => s + (Number(r.totalQuantity) || 0), 0)) : 0);
    return (line + feeShare) / qty;
  };

  // Validate
  const missingItems = summaryRows.filter(r => amounts[r.supplyItemId] === '' || amounts[r.supplyItemId] == null);
  const invalidFees = fees.filter(f => f.amount === '' || parseVND(f.amount) < 0);
  const canSubmit = missingItems.length === 0 && invalidFees.length === 0 && !submitting;

  const handleConfirm = () => {
    const payload = {
      items: summaryRows.map(r => ({
        supplyItemId: r.supplyItemId,
        lineAmount: parseVND(amounts[r.supplyItemId]),
      })),
      fees: fees
        .filter(f => parseVND(f.amount) > 0)
        .map(f => ({ name: (f.name || '').trim() || 'Phí khác', amount: parseVND(f.amount) })),
      discount: discountNum > 0 ? discountNum : 0,
    };
    onConfirm(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-hairline">
          <div className="flex items-center gap-2">
            <Wallet size={20} className="text-gold" />
            <div>
              <h2 className="text-lg font-bold text-ink">Nhập giá đặt hàng</h2>
              <p className="text-xs text-muted">Nhập THÀNH TIỀN mỗi vật dụng và các khoản phí. Phí sẽ phân bổ theo tỉ trọng.</p>
            </div>
          </div>
          <button onClick={onCancel} className="p-2 rounded-xl hover:bg-canvas text-muted">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          {/* ── Bảng vật dụng ─────────────────────────────────────────── */}
          <div>
            <p className="text-sm font-semibold text-ink mb-2 flex items-center gap-1.5">
              <Package size={14} className="text-gold" /> Danh sách vật dụng ({summaryRows.length})
            </p>
            <div className="rounded-xl border border-line overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-canvas text-xs text-muted uppercase tracking-wider">
                  <tr>
                    <th className="px-3 py-2 text-left">Vật dụng</th>
                    <th className="px-3 py-2 text-right">SL</th>
                    <th className="px-3 py-2 text-left">ĐVT</th>
                    <th className="px-3 py-2 text-right">Thành tiền (VNĐ)</th>
                    <th className="px-3 py-2 text-right">Đơn giá /ĐVT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {summaryRows.map(r => {
                    const id = r.supplyItemId;
                    const miss = amounts[id] === '' || amounts[id] == null;
                    return (
                      <tr key={id} className="hover:bg-canvas/50">
                        <td className="px-3 py-2 font-medium text-ink">
                          {r.name}
                          {r.specification && <span className="text-xs text-muted ml-1">({r.specification})</span>}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-ink">
                          {fmtQtyOff(r.totalQuantity)}
                        </td>
                        <td className="px-3 py-2 text-muted">{r.unit}</td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="text" inputMode="numeric"
                            value={amounts[id] === '' ? '' : nf(amounts[id])}
                            onChange={e => setAmounts(a => ({ ...a, [id]: String(parseVND(e.target.value)) }))}
                            onFocus={e => e.target.select()}
                            placeholder="0"
                            className={`w-36 px-2.5 py-1.5 rounded-lg border text-sm text-right tabular-nums focus:outline-none focus:border-gold
                              ${miss ? 'border-red-300 bg-red-50 dark:bg-red-500/10' : 'border-line bg-surface'}`}
                          />
                        </td>
                        <td className="px-3 py-2 text-right text-xs text-gold-strong tabular-nums font-semibold">
                          {nf(unitPriceOf(r))} đ
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {missingItems.length > 0 && (
              <p className="mt-1.5 text-xs text-red-600 dark:text-red-300">
                Còn {missingItems.length} vật dụng chưa nhập giá.
              </p>
            )}
          </div>

          {/* ── Danh sách phí ─────────────────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-ink flex items-center gap-1.5">
                <Receipt size={14} className="text-gold" /> Các khoản phí ({fees.length})
              </p>
              <button onClick={addFee}
                className="flex items-center gap-1 text-xs text-gold font-semibold hover:underline">
                <Plus size={13} /> Thêm phí
              </button>
            </div>
            {fees.length === 0 ? (
              <p className="text-xs text-muted italic px-1">Không có phí. Bấm "Thêm phí" để nhập phí giao hàng, phí đóng gói…</p>
            ) : (
              <div className="space-y-2">
                {fees.map((f, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      value={f.name}
                      onChange={e => updateFee(i, { name: e.target.value })}
                      placeholder="Tên phí (ví dụ: Phí giao hàng)"
                      className="flex-1 px-3 py-1.5 rounded-lg border border-line text-sm bg-surface focus:outline-none focus:border-gold"
                    />
                    <input
                      type="text" inputMode="numeric"
                      value={f.amount === '' ? '' : nf(f.amount)}
                      onChange={e => updateFee(i, { amount: String(parseVND(e.target.value)) })}
                      onFocus={e => e.target.select()}
                      placeholder="0"
                      className="w-36 px-3 py-1.5 rounded-lg border border-line text-sm text-right tabular-nums bg-surface focus:outline-none focus:border-gold"
                    />
                    <button onClick={() => removeFee(i)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-red-500">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Giảm giá ─────────────────────────────────────────────── */}
          {/* Chỉ 1 ô số tiền, không có tên — BE lưu như 1 "fee" tên "Giảm giá"
              với số âm. Phân bổ cùng công thức tỉ trọng với phí. */}
          <div>
            <p className="text-sm font-semibold text-ink mb-2 flex items-center gap-1.5">
              <Tag size={14} className="text-gold" /> Giảm giá
            </p>
            <input
              type="text" inputMode="numeric"
              value={discount === '' ? '' : nf(discount)}
              onChange={e => setDiscount(String(parseVND(e.target.value)))}
              onFocus={e => e.target.select()}
              placeholder="0"
              className="w-full px-3 py-2 rounded-lg border border-line text-sm text-right tabular-nums bg-surface focus:outline-none focus:border-gold"
            />
          </div>

          {/* ── Tổng kết ──────────────────────────────────────────────── */}
          <div className="rounded-xl bg-canvas border border-line p-4 space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-muted">Tổng tiền hàng</span>
              <span className="font-semibold text-ink tabular-nums">{nf(subtotal)} đ</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted">Tổng phí</span>
              <span className="font-semibold text-ink tabular-nums">{nf(totalFees)} đ</span>
            </div>
            {discountNum > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted">Giảm giá</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-300 tabular-nums">
                  − {nf(discountNum)} đ
                </span>
              </div>
            )}
            <div className="flex justify-between text-base pt-2 border-t border-hairline">
              <span className="font-bold text-ink">TỔNG CỘNG</span>
              <span className="font-bold text-gold tabular-nums">{nf(grand)} đ</span>
            </div>
          </div>
        </div>

        <div className="p-5 border-t border-hairline flex gap-3">
          <button onClick={onCancel}
            className="flex-1 py-3 rounded-xl border border-hairline-2 text-sm font-semibold text-muted hover:bg-canvas transition">
            Hủy
          </button>
          <button onClick={handleConfirm} disabled={!canSubmit}
            className="flex-1 py-3 rounded-xl bg-gold text-white text-sm font-bold hover:bg-gold-strong transition disabled:opacity-50">
            {submitting ? 'Đang đặt...' : 'Xác nhận đặt hàng'}
          </button>
        </div>
      </div>
    </div>
  );
}