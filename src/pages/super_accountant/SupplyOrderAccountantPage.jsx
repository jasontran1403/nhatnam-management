import { useCallback, useEffect, useState } from 'react';
import {
  Search, Package, CheckCircle2, XCircle, Wallet, Plus, Trash2,
  Warehouse, AlertTriangle, CalendarClock, Receipt, Info,
} from 'lucide-react';
import {
  accountantSupplyApi, supplyOrderApi,
  SUPPLY_STATUS, RECEIVE_STATUS, GROUP_STATUS,
  fmtQty, fmtMoney, fmtMoney3, fmtDate, fmtDateTime,
  dateInputToMs, allocateFees,
} from '../../api/supplyApi';
import { useToast } from '../../components/common/Toast';
import useDebounce from '../../utils/useDebounce.js';
import Modal from '../../components/ui/Modal';
import Pagination from '../../components/ui/Pagination';
import ImageUploader from '../../components/supply/ImageUploader';
import {
  SectionCard, PrimaryButton, SecondaryButton, DangerButton, Field,
  inputCls, selectCls, LoadingSpinner, EmptyState, TabBar,
} from '../../components/ui';

/**
 * TAB "ĐỒ DÙNG" của page Phiếu đặt hàng — SUPER_ACCOUNTANT.
 *
 * <p>Tab "Nguyên liệu sản xuất" giữ nguyên hoàn toàn như cũ
 * ({@code SuperAccountantMaterialRequestPage}); component này chỉ phụ trách
 * các phiếu {@code orderType = SUPPLY}.
 *
 * <p>Kế toán làm 3 việc ở đây:
 *   B2 xác nhận đặt hàng — CHỈ DUYỆT HẾT hoặc TỪ CHỐI HẾT;
 *      gia hạn ETA khi NCC giao trễ;
 *   B4 tất toán — nhập tiền theo SL thực nhận, thuế/phí phân bổ theo tỷ trọng
 *      giá trị, rồi chọn Thanh toán ngay (tạo phiếu chi) hoặc Công nợ.
 */

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const PAGE_SIZE = 10;

function StatusPill({ status }) {
  const meta = SUPPLY_STATUS[status] || { label: status, cls: 'bg-gray-100 text-gray-600 ring-gray-200' };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ${meta.cls}`}>
      {meta.label}
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   BƯỚC 2 — Xác nhận đặt hàng / Từ chối
   ══════════════════════════════════════════════════════════════════════════ */
function ConfirmOrderModal({ open, order, onClose, onDone }) {
  const toast = useToast();
  const [suppliers, setSuppliers] = useState([]);
  const [assign, setAssign] = useState({});   // itemId → supplierId
  const [meta, setMeta] = useState({});       // supplierId → { eta, contactName, contactPhone }
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    if (!open || !order) return;
    supplyOrderApi.suppliers().then(setSuppliers).catch(() => setSuppliers([]));
    const a = {};
    order.items.forEach(i => { a[i.id] = i.supplierId ?? ''; });
    setAssign(a);
    setMeta({});
    setRejecting(false);
    setRejectReason('');
  }, [open, order]);

  // Gom dòng theo NCC — đây chính là các SupplyOrderGroup sẽ được sinh ra
  const grouped = {};
  Object.entries(assign).forEach(([itemId, sid]) => {
    if (!sid) return;
    (grouped[sid] = grouped[sid] || []).push(Number(itemId));
  });

  const unassigned = (order?.items || []).filter(i => !assign[i.id]);
  const supplierName = (sid) => suppliers.find(s => String(s.id) === String(sid))?.name || `#${sid}`;

  const doConfirm = async () => {
    if (unassigned.length) {
      toast('Chưa gán NCC cho: ' + unassigned.map(i => i.itemName).join(', '), 'error');
      return;
    }
    setBusy(true);
    try {
      await accountantSupplyApi.confirm(order.id, {
        groups: Object.entries(grouped).map(([sid, itemIds]) => ({
          supplierId: Number(sid),
          expectedDeliveryAt: dateInputToMs(meta[sid]?.eta),
          contactName: meta[sid]?.contactName || null,
          contactPhone: meta[sid]?.contactPhone || null,
          itemIds,
        })),
      });
      toast('Đã xác nhận đặt hàng', 'success');
      onDone(); onClose();
    } catch (e) {
      toast(e?.response?.data?.message || 'Không xác nhận được', 'error');
    } finally { setBusy(false); }
  };

  const doReject = async () => {
    if (!rejectReason.trim()) { toast('Vui lòng nhập lý do từ chối', 'error'); return; }
    setBusy(true);
    try {
      await accountantSupplyApi.reject(order.id, { reason: rejectReason.trim() });
      toast('Đã từ chối phiếu', 'success');
      onDone(); onClose();
    } catch (e) {
      toast(e?.response?.data?.message || 'Không từ chối được', 'error');
    } finally { setBusy(false); }
  };

  if (!order) return null;

  return (
    <Modal open={open} onClose={onClose} title={`Xác nhận đặt hàng — ${order.requestCode}`} size="xl">
      <div className="space-y-4">
        <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-50 border border-blue-200">
          <Info size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-blue-800">
            Phiếu này <b>chỉ duyệt hết hoặc từ chối hết</b> — không duyệt một phần.
            Từ chối là trạng thái cuối cùng, không thể duyệt lại.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm text-[#8E8878]">
          <span className="inline-flex items-center gap-1.5"><Warehouse size={14} /> {order.supplyWarehouseName}</span>
          <span>Người tạo: {order.createdByName}</span>
          {order.requiredBy && <span>Cần trước: {fmtDate(order.requiredBy)}</span>}
        </div>

        <SectionCard>
          <div className="px-4 py-2.5 bg-[#FAF7F2] text-xs font-semibold text-[#8E8878] uppercase tracking-wider">
            Gán nhà cung cấp cho từng mặt hàng
          </div>
          <div className="divide-y divide-black/5">
            {order.items.map(i => (
              <div key={i.id} className="p-3 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                <div className="sm:col-span-6">
                  <div className="text-sm text-[#1C1C1E]">{i.itemName}</div>
                  <div className="text-xs text-[#8E8878]">
                    {i.specification ? `${i.specification} · ` : ''}
                    {fmtQty(i.orderedQuantity)} {i.unit}
                    {i.categoryKind === 'SERVICE' && ' · Dịch vụ (không nhập kho)'}
                  </div>
                  {i.note && <div className="text-xs text-[#8E8878] italic mt-0.5">{i.note}</div>}
                </div>
                <div className="sm:col-span-6">
                  <Field label="Nhà cung cấp" required>
                    <select className={selectCls} value={assign[i.id] ?? ''}
                      onChange={e => setAssign(a => ({ ...a, [i.id]: e.target.value }))}>
                      <option value="">— Chọn NCC —</option>
                      {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </Field>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        {Object.keys(grouped).length > 0 && (
          <SectionCard>
            <div className="px-4 py-2.5 bg-[#FAF7F2] text-xs font-semibold text-[#8E8878] uppercase tracking-wider">
              Thông tin giao hàng theo nhà cung cấp
            </div>
            <div className="divide-y divide-black/5">
              {Object.entries(grouped).map(([sid, itemIds]) => (
                <div key={sid} className="p-4 space-y-3">
                  <div className="text-sm font-semibold text-[#1C1C1E]">
                    {supplierName(sid)}
                    <span className="ml-2 text-xs font-normal text-[#8E8878]">({itemIds.length} mặt hàng)</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Field label="Giao dự kiến">
                      <input type="date" className={inputCls} value={meta[sid]?.eta ?? ''}
                        onChange={e => setMeta(m => ({ ...m, [sid]: { ...m[sid], eta: e.target.value } }))} />
                    </Field>
                    <Field label="Người liên hệ">
                      <input className={inputCls} value={meta[sid]?.contactName ?? ''}
                        onChange={e => setMeta(m => ({ ...m, [sid]: { ...m[sid], contactName: e.target.value } }))} />
                    </Field>
                    <Field label="Số điện thoại">
                      <input className={inputCls} value={meta[sid]?.contactPhone ?? ''}
                        onChange={e => setMeta(m => ({ ...m, [sid]: { ...m[sid], contactPhone: e.target.value } }))} />
                    </Field>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {rejecting ? (
          <div className="space-y-3 p-4 rounded-xl bg-red-50 border border-red-200">
            <Field label="Lý do từ chối" required
              hint="Phiếu bị từ chối KHÔNG thể duyệt lại — người tạo sẽ phải lập phiếu mới.">
              <textarea rows={3} className={inputCls} value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="VD: Ngân sách quý này đã hết, đề nghị lùi sang tháng sau" />
            </Field>
            <div className="flex items-center justify-end gap-2">
              <SecondaryButton onClick={() => setRejecting(false)}>Quay lại</SecondaryButton>
              <DangerButton onClick={doReject} loading={busy}>
                <XCircle size={14} /> Xác nhận từ chối
              </DangerButton>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-2">
            <SecondaryButton onClick={onClose}>Đóng</SecondaryButton>
            <DangerButton onClick={() => setRejecting(true)}>
              <XCircle size={14} /> Từ chối phiếu
            </DangerButton>
            <PrimaryButton onClick={doConfirm} loading={busy} disabled={unassigned.length > 0}>
              <CheckCircle2 size={14} /> Xác nhận đặt hàng
            </PrimaryButton>
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Gia hạn ETA
   ══════════════════════════════════════════════════════════════════════════ */
function ExtendDeliveryModal({ open, order, onClose, onDone }) {
  const toast = useToast();
  const [groupId, setGroupId] = useState('');
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !order) return;
    const pending = (order.groups || []).filter(g => g.status !== 'SETTLED');
    setGroupId(pending.length === 1 ? String(pending[0].id) : '');
    setDate(''); setReason('');
  }, [open, order]);

  const submit = async () => {
    if (!groupId) { toast('Chọn nhà cung cấp cần gia hạn', 'error'); return; }
    if (!date) { toast('Chọn ngày giao mới', 'error'); return; }
    setBusy(true);
    try {
      await accountantSupplyApi.extendDelivery(order.id, {
        groupId: Number(groupId),
        newExpectedDeliveryAt: dateInputToMs(date),
        reason: reason || null,
      });
      toast('Đã gia hạn giao hàng', 'success');
      onDone(); onClose();
    } catch (e) {
      toast(e?.response?.data?.message || 'Không gia hạn được', 'error');
    } finally { setBusy(false); }
  };

  if (!order) return null;
  const pending = (order.groups || []).filter(g => g.status !== 'SETTLED');

  return (
    <Modal open={open} onClose={onClose} title={`Gia hạn giao hàng — ${order.requestCode}`} size="md">
      <div className="space-y-4">
        <Field label="Nhà cung cấp" required>
          <select className={selectCls} value={groupId} onChange={e => setGroupId(e.target.value)}>
            <option value="">— Chọn NCC —</option>
            {pending.map(g => (
              <option key={g.id} value={g.id}>
                {g.supplierName}
                {g.expectedDeliveryAt ? ` (hiện tại: ${fmtDate(g.expectedDeliveryAt)})` : ''}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Ngày giao mới" required>
          <input type="date" className={inputCls} value={date} onChange={e => setDate(e.target.value)} />
        </Field>

        <Field label="Lý do gia hạn" hint="Người tạo phiếu sẽ nhận được thông báo">
          <input className={inputCls} value={reason} onChange={e => setReason(e.target.value)}
            placeholder="VD: NCC báo hết hàng, giao bù tuần sau" />
        </Field>

        <div className="flex items-center justify-end gap-2">
          <SecondaryButton onClick={onClose}>Huỷ</SecondaryButton>
          <PrimaryButton onClick={submit} loading={busy}>
            <CalendarClock size={14} /> Gia hạn
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   BƯỚC 4 — Tất toán
   ══════════════════════════════════════════════════════════════════════════ */
function SettleModal({ open, order, onClose, onDone }) {
  const toast = useToast();
  const [state, setState] = useState({});
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState({});   // groupId → bool

  useEffect(() => {
    if (!open || !order) return;
    const init = {};
    (order.groups || []).forEach(g => {
      const items = {};
      order.items.filter(i => i.supplyGroupId === g.id).forEach(i => {
        items[i.id] = { mode: 'UNIT_PRICE', unitPrice: '', totalAmount: '' };
      });
      init[g.id] = {
        items, fees: [], paymentMode: 'PAY_NOW',
        paymentType: 'CASH', bankName: '', bankRef: '', reason: '', imageUrls: [],
      };
    });
    setState(init);
    setUploading({});
  }, [open, order]);

  const itemsOf = (gid) => (order?.items || []).filter(i => i.supplyGroupId === gid);

  /** Preview phân bổ thuế/phí — dùng lại đúng thuật toán của BE. */
  const previewOf = (gid) => {
    const g = state[gid];
    if (!g) return null;
    const lines = itemsOf(gid).map(i => {
      const v = g.items[i.id] || {};
      const qty = num(i.receivedQuantity);
      const unitPrice = v.mode === 'TOTAL'
        ? (qty > 0 ? num(v.totalAmount) / qty : 0)
        : num(v.unitPrice);
      return { id: i.id, qty, unitPrice };
    });
    return allocateFees(lines, g.fees);
  };

  const patchGroup = (gid, patch) =>
    setState(s => ({ ...s, [gid]: { ...s[gid], ...patch } }));

  const patchItem = (gid, itemId, patch) =>
    setState(s => ({
      ...s,
      [gid]: { ...s[gid], items: { ...s[gid].items, [itemId]: { ...s[gid].items[itemId], ...patch } } },
    }));

  const submit = async () => {
    // Ảnh đang upload mà submit thì sẽ gửi thiếu chứng từ một cách âm thầm
    if (Object.values(uploading).some(Boolean)) {
      toast('Đang tải ảnh, vui lòng chờ…', 'warning');
      return;
    }

    for (const g of order.groups) {
      const gs = state[g.id];
      if (!gs) continue;
      if (gs.paymentMode === 'PAY_NOW' && gs.paymentType === 'BANK_TRANSFER') {
        if (!gs.bankName?.trim() || !gs.bankRef?.trim()) {
          toast(`NCC ${g.supplierName}: cần Tên ngân hàng và Mã tham chiếu khi chuyển khoản`, 'error');
          return;
        }
      }
      for (const i of itemsOf(g.id)) {
        if (num(i.receivedQuantity) === 0) continue;   // nhận 0 → không cần giá
        const v = gs.items[i.id] || {};
        const val = v.mode === 'TOTAL' ? v.totalAmount : v.unitPrice;
        if (val === '' || val == null) {
          toast(`Thiếu giá cho "${i.itemName}" (NCC ${g.supplierName})`, 'error');
          return;
        }
      }
    }

    setBusy(true);
    try {
      await accountantSupplyApi.settle(order.id, {
        groups: order.groups.map(g => {
          const gs = state[g.id];
          return {
            groupId: g.id,
            items: itemsOf(g.id).map(i => {
              const v = gs.items[i.id] || {};
              return {
                itemId: i.id,
                priceInputMode: v.mode,
                unitPrice: v.mode === 'UNIT_PRICE' ? num(v.unitPrice) : null,
                totalAmount: v.mode === 'TOTAL' ? num(v.totalAmount) : null,
              };
            }),
            fees: gs.fees.filter(f => f.label?.trim()).map(f => ({
              label: f.label.trim(), amount: num(f.amount),
            })),
            paymentMode: gs.paymentMode,
            paymentType: gs.paymentType,
            bankName: gs.bankName || null,
            bankRef: gs.bankRef || null,
            imageUrls: gs.paymentMode === 'PAY_NOW' ? gs.imageUrls : [],
            reason: gs.reason || null,
          };
        }),
      });
      toast('Đã tất toán phiếu', 'success');
      onDone(); onClose();
    } catch (e) {
      toast(e?.response?.data?.message || 'Không tất toán được', 'error');
    } finally { setBusy(false); }
  };

  if (!order) return null;

  return (
    <Modal open={open} onClose={onClose} title={`Tất toán — ${order.requestCode}`} size="xl">
      <div className="space-y-4">
        <div className="flex items-start gap-2 p-3 rounded-xl bg-[#FAF7F2] border border-black/5">
          <Info size={16} className="text-[#C9A84C] mt-0.5 flex-shrink-0" />
          <p className="text-sm text-[#8E8878]">
            Tiền tính theo <b>số lượng thực nhận</b>. Thuế/phí được phân bổ vào từng
            mặt hàng <b>theo tỷ trọng giá trị</b>; mọi bước trung gian giữ 3 số thập
            phân, chỉ làm tròn lên hàng đơn vị đồng ở con số cuối cùng.
          </p>
        </div>

        {order.groups.map(g => {
          const gs = state[g.id];
          if (!gs) return null;
          const items = itemsOf(g.id);
          const preview = previewOf(g.id);

          return (
            <SectionCard key={g.id}>
              <div className="px-4 py-3 bg-[#FAF7F2] flex items-center justify-between">
                <div className="text-sm font-semibold text-[#1C1C1E]">{g.supplierName}</div>
                <div className="text-xs text-[#8E8878]">{g.code}</div>
              </div>

              <div className="p-4 space-y-4">
                {/* ── Giá từng mặt hàng ── */}
                <div className="space-y-2">
                  {items.map(i => {
                    const v = gs.items[i.id] || {};
                    const qty = num(i.receivedQuantity);
                    const p = preview?.byItem[i.id];
                    return (
                      <div key={i.id} className="p-3 rounded-xl bg-[#FAF7F2]/50 space-y-2">
                        <div className="flex items-baseline justify-between gap-3 flex-wrap">
                          <div>
                            <span className="text-sm text-[#1C1C1E]">{i.itemName}</span>
                            <span className="ml-2 text-xs text-[#8E8878]">
                              {i.specification ? `${i.specification} · ` : ''}
                              thực nhận {fmtQty(qty)} {i.unit}
                              {i.receiveStatus === 'CLOSED_SHORT' && ' (chốt thiếu)'}
                            </span>
                          </div>
                          {p && <span className="text-sm font-semibold text-[#1C1C1E]">{fmtMoney(p.total)}</span>}
                        </div>

                        {qty === 0 ? (
                          <p className="text-xs text-[#8E8878] italic">
                            Không nhận được hàng — không phát sinh tiền.
                          </p>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <Field label="Kiểu nhập">
                              <select className={selectCls} value={v.mode}
                                onChange={e => patchItem(g.id, i.id, { mode: e.target.value })}>
                                <option value="UNIT_PRICE">Đơn giá 1 đơn vị</option>
                                <option value="TOTAL">Tổng tiền mặt hàng</option>
                              </select>
                            </Field>
                            {v.mode === 'TOTAL' ? (
                              <Field label="Tổng tiền" required hint="Tối đa 3 số thập phân">
                                <input type="number" min="0" step="0.001" className={inputCls}
                                  value={v.totalAmount ?? ''}
                                  onChange={e => patchItem(g.id, i.id, { totalAmount: e.target.value })} />
                              </Field>
                            ) : (
                              <Field label={`Đơn giá / ${i.unit}`} required hint="Tối đa 3 số thập phân">
                                <input type="number" min="0" step="0.001" className={inputCls}
                                  value={v.unitPrice ?? ''}
                                  onChange={e => patchItem(g.id, i.id, { unitPrice: e.target.value })} />
                              </Field>
                            )}
                            <div className="flex flex-col justify-end pb-2.5 text-xs text-[#8E8878]">
                              {p && (
                                <>
                                  <span>Tiền hàng: {fmtMoney3(p.goods)}</span>
                                  <span>Thuế/phí phân bổ: {fmtMoney3(p.feeShare)}</span>
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* ── Thuế / phí ── */}
                <div className="rounded-xl border border-black/5 overflow-hidden">
                  <div className="px-3 py-2 bg-[#FAF7F2] flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#8E8878] uppercase tracking-wider">Thuế / phí</span>
                    <button type="button"
                      onClick={() => patchGroup(g.id, { fees: [...gs.fees, { label: '', amount: '' }] })}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#C9A84C]">
                      <Plus size={12} /> Thêm dòng
                    </button>
                  </div>
                  {gs.fees.length === 0 ? (
                    <p className="px-3 py-3 text-xs text-[#8E8878]">Chưa có dòng thuế/phí nào.</p>
                  ) : (
                    <div className="p-3 space-y-2">
                      {gs.fees.map((f, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <input className={`${inputCls} flex-1`} value={f.label}
                            placeholder="Tên khoản (VD: VAT 10%, phí vận chuyển)"
                            onChange={e => {
                              const fees = [...gs.fees];
                              fees[idx] = { ...fees[idx], label: e.target.value };
                              patchGroup(g.id, { fees });
                            }} />
                          <input type="number" min="0" step="0.001" className={`${inputCls} w-40`} value={f.amount}
                            placeholder="Số tiền"
                            onChange={e => {
                              const fees = [...gs.fees];
                              fees[idx] = { ...fees[idx], amount: e.target.value };
                              patchGroup(g.id, { fees });
                            }} />
                          <button type="button" className="text-[#8E8878] hover:text-red-600 p-2"
                            onClick={() => patchGroup(g.id, { fees: gs.fees.filter((_, k) => k !== idx) })}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* ── Phương thức thanh toán ── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Phương thức" required>
                    <select className={selectCls} value={gs.paymentMode}
                      onChange={e => patchGroup(g.id, { paymentMode: e.target.value })}>
                      <option value="PAY_NOW">Thanh toán ngay — tạo phiếu chi</option>
                      <option value="DEBT">Ghi công nợ nhà cung cấp</option>
                    </select>
                  </Field>
                  {gs.paymentMode === 'PAY_NOW' && (
                    <Field label="Hình thức chi">
                      <select className={selectCls} value={gs.paymentType}
                        onChange={e => patchGroup(g.id, { paymentType: e.target.value })}>
                        <option value="CASH">Tiền mặt</option>
                        <option value="BANK_TRANSFER">Chuyển khoản</option>
                      </select>
                    </Field>
                  )}
                </div>

                {gs.paymentMode === 'PAY_NOW' && gs.paymentType === 'BANK_TRANSFER' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Tên ngân hàng" required>
                      <input className={inputCls} value={gs.bankName}
                        onChange={e => patchGroup(g.id, { bankName: e.target.value })} />
                    </Field>
                    <Field label="Mã tham chiếu giao dịch" required>
                      <input className={inputCls} value={gs.bankRef}
                        onChange={e => patchGroup(g.id, { bankRef: e.target.value })} />
                    </Field>
                  </div>
                )}

                {gs.paymentMode === 'PAY_NOW' && (
                  <>
                    <Field label="Lý do chi" hint="Để trống sẽ tự sinh theo mã phiếu và tên NCC">
                      <input className={inputCls} value={gs.reason}
                        onChange={e => patchGroup(g.id, { reason: e.target.value })} />
                    </Field>

                    <ImageUploader
                      label="Ảnh chứng từ (đính kèm phiếu chi)"
                      value={gs.imageUrls}
                      onChange={(urls) => patchGroup(g.id, { imageUrls: urls })}
                      onBusyChange={(b) => setUploading(u => ({ ...u, [g.id]: b }))}
                    />

                    <p className="flex items-start gap-1.5 text-xs text-[#8E8878]">
                      <Receipt size={13} className="mt-0.5 flex-shrink-0" />
                      Phiếu chi sẽ đi qua đúng luật duyệt hiện hành: trong danh mục cho phép
                      và dưới hạn mức thì tự duyệt, ngược lại chờ chủ doanh nghiệp duyệt.
                    </p>
                  </>
                )}

                {preview && (
                  <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-[#C9A84C]/10 border border-[#C9A84C]/20">
                    <span className="text-sm text-[#8E8878]">
                      Tiền hàng {fmtMoney3(preview.goodsTotal)} + Thuế/phí {fmtMoney3(preview.feeTotal)}
                    </span>
                    <span className="text-base font-bold text-[#1C1C1E]">{fmtMoney(preview.grandTotal)}</span>
                  </div>
                )}
              </div>
            </SectionCard>
          );
        })}

        <div className="flex items-center justify-end gap-2">
          <SecondaryButton onClick={onClose}>Huỷ</SecondaryButton>
          <PrimaryButton onClick={submit} loading={busy}>
            <Wallet size={14} /> Tất toán phiếu
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   PAGE (tab "Đồ dùng")
   ══════════════════════════════════════════════════════════════════════════ */
export default function SupplyOrderAccountantPage() {
  const toast = useToast();
  const [orders, setOrders] = useState(null);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState('ALL');
  const [search, setSearch] = useState('');
  const dSearch = useDebounce(search, 350);
  const [confirming, setConfirming] = useState(null);
  const [settling, setSettling] = useState(null);
  const [extending, setExtending] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await accountantSupplyApi.list({
        status: status === 'ALL' ? undefined : status,
        search: dSearch || undefined,
        page, size: PAGE_SIZE,
      });
      setOrders(res?.content || []);
      setTotalPages(res?.totalPages ?? 0);
    } catch { setOrders([]); setTotalPages(0); }
  }, [status, dSearch, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(0); }, [status, dSearch]);

  const openModal = async (id, setter) => {
    try { setter(await accountantSupplyApi.getById(id)); }
    catch { toast('Không tải được phiếu', 'error'); }
  };

  const tabs = [
    { id: 'ALL', label: 'Tất cả' },
    { id: 'NEW', label: 'Chờ xác nhận' },
    { id: 'ORDERED', label: 'Đã đặt hàng' },
    { id: 'PARTIALLY_RECEIVED', label: 'Đang nhận' },
    { id: 'RECEIVED', label: 'Chờ tất toán' },
    { id: 'COMPLETED', label: 'Hoàn thành' },
    { id: 'REJECTED', label: 'Đã từ chối' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <TabBar tabs={tabs} active={status} onChange={setStatus} />
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8878]" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Tìm mã phiếu, người tạo, NCC…" className={`${inputCls} pl-9`} />
        </div>
      </div>

      {orders == null ? <LoadingSpinner label="Đang tải phiếu…" />
        : orders.length === 0 ? (
          <EmptyState icon={Package} title="Không có phiếu đồ dùng nào"
            description="Các phiếu đặt văn phòng phẩm sẽ xuất hiện ở đây." />
        ) : (
          <>
            <div className="space-y-3">
              {orders.map(o => (
                <SectionCard key={o.id}>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="font-semibold text-[#1C1C1E]">{o.requestCode}</span>
                          <StatusPill status={o.status} />
                        </div>
                        <div className="text-xs text-[#8E8878] mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="inline-flex items-center gap-1"><Warehouse size={12} /> {o.supplyWarehouseName || '—'}</span>
                          <span>{o.createdByName}</span>
                          <span>{fmtDateTime(o.createdAt)}</span>
                          {o.requiredBy && (
                            <span className="inline-flex items-center gap-1">
                              <CalendarClock size={12} /> cần trước {fmtDate(o.requiredBy)}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {o.status === 'NEW' && (
                          <PrimaryButton onClick={() => openModal(o.id, setConfirming)}>
                            <CheckCircle2 size={14} /> Xử lý phiếu
                          </PrimaryButton>
                        )}
                        {['ORDERED', 'PARTIALLY_RECEIVED'].includes(o.status) && (
                          <SecondaryButton onClick={() => openModal(o.id, setExtending)}>
                            <CalendarClock size={14} /> Gia hạn giao hàng
                          </SecondaryButton>
                        )}
                        {o.status === 'RECEIVED' && (
                          <PrimaryButton onClick={() => openModal(o.id, setSettling)}>
                            <Wallet size={14} /> Tất toán
                          </PrimaryButton>
                        )}
                        {o.grandTotal > 0 && (
                          <span className="text-sm font-bold text-[#1C1C1E]">{fmtMoney(o.grandTotal)}</span>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-xs uppercase text-[#8E8878]">
                            <th className="px-2 py-1.5 text-left">Mặt hàng</th>
                            <th className="px-2 py-1.5 text-left">Quy cách</th>
                            <th className="px-2 py-1.5 text-right">Đặt</th>
                            <th className="px-2 py-1.5 text-right">Thực nhận</th>
                            <th className="px-2 py-1.5 text-left">NCC</th>
                            <th className="px-2 py-1.5 text-left">Tiến độ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {o.items.map(i => {
                            const rs = RECEIVE_STATUS[i.receiveStatus] || {};
                            return (
                              <tr key={i.id} className="border-t border-black/5">
                                <td className="px-2 py-1.5">{i.itemName}</td>
                                <td className="px-2 py-1.5 text-[#8E8878]">{i.specification || '—'}</td>
                                <td className="px-2 py-1.5 text-right">{fmtQty(i.orderedQuantity)} {i.unit}</td>
                                <td className="px-2 py-1.5 text-right">{fmtQty(i.receivedQuantity)}</td>
                                <td className="px-2 py-1.5 text-[#8E8878]">{i.supplierName || '—'}</td>
                                <td className="px-2 py-1.5">
                                  <span className={`px-2 py-0.5 rounded-full text-xs ${rs.cls || 'bg-gray-100 text-gray-500'}`}>
                                    {rs.label || '—'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {o.status === 'REJECTED' && o.rejectReason && (
                      <div className="mt-3 flex items-start gap-2 text-xs text-red-700">
                        <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" />
                        Lý do từ chối: {o.rejectReason}
                      </div>
                    )}

                    {o.groups?.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {o.groups.map(g => {
                          const gs = GROUP_STATUS[g.status] || {};
                          return (
                            <span key={g.id}
                              className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#FAF7F2] border border-black/5 text-xs">
                              <span className="font-medium text-[#1C1C1E]">{g.supplierName}</span>
                              <span className={`px-1.5 py-0.5 rounded-full ${gs.cls || ''}`}>{gs.label || g.status}</span>
                              {g.expectedDeliveryAt && (
                                <span className="text-[#8E8878]">giao {fmtDate(g.expectedDeliveryAt)}</span>
                              )}
                              {g.paymentMode && (
                                <span className="text-[#8E8878]">
                                  {g.paymentMode === 'PAY_NOW' ? `Phiếu chi ${g.paymentVoucherCode || ''}` : 'Công nợ'}
                                </span>
                              )}
                              {g.totalAmount != null && (
                                <span className="font-semibold text-[#1C1C1E]">{fmtMoney(g.totalAmount)}</span>
                              )}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </SectionCard>
              ))}
            </div>

            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </>
        )}

      <ConfirmOrderModal open={!!confirming} order={confirming}
        onClose={() => setConfirming(null)} onDone={load} />
      <ExtendDeliveryModal open={!!extending} order={extending}
        onClose={() => setExtending(null)} onDone={load} />
      <SettleModal open={!!settling} order={settling}
        onClose={() => setSettling(null)} onDone={load} />
    </div>
  );
}
