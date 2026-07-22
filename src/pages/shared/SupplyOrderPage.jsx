import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ShoppingBag, Plus, Trash2, Search, Package, PackageCheck, Warehouse,
  ChevronDown, Save, Send, AlertTriangle, Info, Pencil,
} from 'lucide-react';
import {
  supplyOrderApi, supplyWarehouseApi,
  SUPPLY_STATUS, RECEIVE_STATUS, GROUP_STATUS,
  fmtQty, fmtMoney, fmtDate, fmtDateTime, msToDateInput, dateInputToMs,
} from '../../api/supplyApi';
import { useToast } from '../../components/common/Toast';
import useDebounce from '../../utils/useDebounce.js';
import Modal from '../../components/ui/Modal';
import Pagination from '../../components/ui/Pagination';
import {
  PageHeader, SectionCard, PrimaryButton, SecondaryButton, Field,
  inputCls, selectCls, LoadingSpinner, EmptyState, TabBar,
} from '../../components/ui';

/**
 * PAGE "Phiếu đặt văn phòng phẩm" — dùng chung cho SUPER_SELLER,
 * SUPER_WAREHOUSE và SUPER_FACTORY_WORKER.
 *
 * <p>Tách biệt HOÀN TOÀN với page "Phiếu đặt hàng nguyên liệu sản xuất":
 * khác route, khác API base, và backend lọc theo `orderType = SUPPLY` ngay ở
 * tầng repository nên hai luồng không bao giờ nhìn thấy nhau.
 *
 * <p>3 việc người tạo làm ở đây:
 *   B1 lập phiếu (chọn kho nhận + NCC + danh mục khoản chi + SL + ghi chú),
 *      sửa lại khi còn ở trạng thái Mới tạo;
 *   B3 nhận hàng nhiều đợt — CHỈ người tạo phiếu mới nhập được số thực nhận;
 *      theo dõi tiến độ cho tới khi kế toán tất toán.
 */

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const PAGE_SIZE = 12;

/* ══════════════════════════════════════════════════════════════════════════
   Search dropdown dùng portal — tránh bị modal cắt mất panel
   ══════════════════════════════════════════════════════════════════════════ */
function SearchDropdown({ value, label, placeholder, fetcher, onPick, disabled }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const dq = useDebounce(q, 300);
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [rect, setRect] = useState(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  const updateRect = useCallback(() => {
    if (triggerRef.current) setRect(triggerRef.current.getBoundingClientRect());
  }, []);

  useEffect(() => {
    if (!open) return;
    updateRect();
    const onWin = () => updateRect();
    // capture = true để bắt cả scroll BÊN TRONG modal, không chỉ scroll window
    window.addEventListener('scroll', onWin, true);
    window.addEventListener('resize', onWin);
    return () => {
      window.removeEventListener('scroll', onWin, true);
      window.removeEventListener('resize', onWin);
    };
  }, [open, updateRect]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    Promise.resolve(fetcher(dq))
      .then(d => { if (alive) setOptions(d || []); })
      .catch(() => { if (alive) setOptions([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [open, dq, fetcher]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (triggerRef.current?.contains(e.target)) return;
      if (panelRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  return (
    <>
      <button type="button" ref={triggerRef} disabled={disabled}
        onClick={() => { setOpen(o => !o); setQ(''); }}
        className={`${selectCls} flex items-center justify-between text-left ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}>
        <span className={value ? 'text-[#1C1C1E] truncate' : 'text-[#8E8878]/70'}>
          {label || placeholder}
        </span>
        <ChevronDown size={14} className="text-[#8E8878] flex-shrink-0 ml-2" />
      </button>

      {open && rect && createPortal(
        <div ref={panelRef}
          style={{ position: 'fixed', top: rect.bottom + 4, left: rect.left, width: rect.width, zIndex: 9999 }}
          className="bg-white rounded-xl border border-black/10 shadow-lg overflow-hidden">
          <div className="p-2 border-b border-black/5">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8E8878]" />
              <input autoFocus value={q} onChange={e => setQ(e.target.value)}
                placeholder="Tìm kiếm..."
                className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-black/10 focus:outline-none focus:border-[#C9A84C]" />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {loading ? (
              <p className="px-3 py-4 text-sm text-[#8E8878] text-center">Đang tải…</p>
            ) : options.length === 0 ? (
              <p className="px-3 py-4 text-sm text-[#8E8878] text-center">Không có kết quả</p>
            ) : options.map(o => (
              <button key={o.id} type="button"
                onClick={() => { onPick(o); setOpen(false); }}
                className="w-full text-left px-3 py-2.5 text-sm hover:bg-[#FAF7F2] border-b border-black/5 last:border-0">
                <div className="text-[#1C1C1E] font-medium">{o._label ?? o.name}</div>
                {o._sub && <div className="text-xs text-[#8E8878] mt-0.5">{o._sub}</div>}
              </button>
            ))}
          </div>
        </div>, document.body)}
    </>
  );
}

function StatusPill({ status }) {
  const meta = SUPPLY_STATUS[status] || { label: status, cls: 'bg-gray-100 text-gray-600 ring-gray-200' };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ${meta.cls}`}>
      {meta.label}
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   FORM LẬP / SỬA PHIẾU (Bước 1)
   ══════════════════════════════════════════════════════════════════════════ */
function OrderFormModal({ open, editing, onClose, onSaved, warehouses }) {
  const toast = useToast();
  const [warehouseId, setWarehouseId] = useState('');
  const [requiredBy, setRequiredBy] = useState('');
  const [rows, setRows] = useState([]);
  const [categories, setCategories] = useState([]);
  const [busy, setBusy] = useState(false);

  const emptyRow = () => ({
    key: Math.random().toString(36).slice(2),
    supplierId: null, supplierName: '',
    expenseCategoryId: null, quantity: '', note: '',
  });

  useEffect(() => {
    if (!open) return;
    supplyOrderApi.categories().then(setCategories).catch(() => setCategories([]));

    if (editing) {
      setWarehouseId(String(editing.supplyWarehouseId ?? ''));
      setRequiredBy(msToDateInput(editing.requiredBy));
      setRows(editing.items.map(i => ({
        key: `it-${i.id}`,
        supplierId: i.supplierId ?? null,
        supplierName: i.supplierName ?? '',
        expenseCategoryId: i.expenseCategoryId ?? null,
        quantity: i.orderedQuantity != null ? String(i.orderedQuantity) : '',
        note: i.note ?? '',
      })));
    } else {
      setRequiredBy('');
      setRows([emptyRow()]);
      // Chỉ được gán 1 kho → tự chọn, người dùng khỏi phải thao tác thừa
      setWarehouseId(warehouses.length === 1 ? String(warehouses[0].id) : '');
    }
  }, [open, editing, warehouses]);

  const patchRow = (key, patch) =>
    setRows(rs => rs.map(r => (r.key === key ? { ...r, ...patch } : r)));

  const catById = useMemo(() => {
    const m = {};
    categories.forEach(c => { m[c.id] = c; });
    return m;
  }, [categories]);

  const validate = () => {
    if (!warehouseId) return 'Vui lòng chọn kho nhận hàng';
    const valid = rows.filter(r => r.expenseCategoryId && num(r.quantity) > 0);
    if (!valid.length) return 'Phiếu phải có ít nhất 1 mặt hàng với số lượng > 0';
    for (const r of rows) {
      if (r.expenseCategoryId && num(r.quantity) <= 0) return 'Số lượng phải lớn hơn 0';
      if (!r.expenseCategoryId && num(r.quantity) > 0) return 'Vui lòng chọn danh mục khoản chi cho mọi dòng';
    }
    return null;
  };

  const submit = async (draft) => {
    const err = validate();
    if (err) { toast(err, 'error'); return; }
    setBusy(true);
    const body = {
      supplyWarehouseId: Number(warehouseId),
      requiredBy: dateInputToMs(requiredBy),
      draft,
      items: rows
        .filter(r => r.expenseCategoryId && num(r.quantity) > 0)
        .map((r, i) => ({
          supplierId: r.supplierId,
          expenseCategoryId: r.expenseCategoryId,
          quantity: num(r.quantity),
          note: r.note || null,
          sortOrder: i,
        })),
    };
    try {
      if (editing) await supplyOrderApi.updateDraft(editing.id, body);
      else await supplyOrderApi.create(body);
      toast(draft ? 'Đã lưu phiếu' : 'Đã gửi phiếu tới kế toán trưởng', 'success');
      onSaved();
      onClose();
    } catch (e) {
      toast(e?.response?.data?.message || 'Không lưu được phiếu', 'error');
    } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose}
      title={editing ? `Sửa phiếu ${editing.requestCode}` : 'Tạo phiếu đặt văn phòng phẩm'} size="xl">
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Kho nhận hàng" required
            hint={warehouses.length === 1 ? 'Bạn chỉ được gán 1 kho — đã tự chọn' : undefined}>
            <select className={selectCls} value={warehouseId}
              onChange={e => setWarehouseId(e.target.value)}
              disabled={warehouses.length === 1}>
              <option value="">— Chọn kho —</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </Field>
          <Field label="Cần hàng trước ngày" hint="Không bắt buộc">
            <input type="date" className={inputCls} value={requiredBy}
              onChange={e => setRequiredBy(e.target.value)} />
          </Field>
        </div>

        <div className="rounded-xl border border-black/5 overflow-hidden">
          <div className="px-4 py-2.5 bg-[#FAF7F2] flex items-center justify-between">
            <span className="text-xs font-semibold text-[#8E8878] uppercase tracking-wider">Danh sách mặt hàng</span>
            <button type="button" onClick={() => setRows(rs => [...rs, emptyRow()])}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#C9A84C] hover:text-[#B69842]">
              <Plus size={13} /> Thêm dòng
            </button>
          </div>

          <div className="divide-y divide-black/5">
            {rows.map((r, idx) => {
              const cat = r.expenseCategoryId ? catById[r.expenseCategoryId] : null;
              const isService = cat && cat.categoryKind === 'SERVICE';
              return (
                <div key={r.key} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#8E8878]">Mặt hàng #{idx + 1}</span>
                    {rows.length > 1 && (
                      <button type="button" onClick={() => setRows(rs => rs.filter(x => x.key !== r.key))}
                        className="text-[#8E8878] hover:text-red-600"><Trash2 size={14} /></button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Được chọn TẤT CẢ NCC — không giới hạn NCC nguyên liệu */}
                    <Field label="Nhà cung cấp">
                      <SearchDropdown
                        value={r.supplierId}
                        label={r.supplierName}
                        placeholder="— Chọn nhà cung cấp —"
                        fetcher={(q) => supplyOrderApi.suppliers(q).then(list =>
                          list.map(s => ({ ...s, _label: s.name, _sub: s.contactPhone || s.contactPerson || '' })))}
                        onPick={(s) => patchRow(r.key, { supplierId: s.id, supplierName: s.name })}
                      />
                    </Field>

                    <Field label="Danh mục khoản chi" required>
                      <select className={selectCls} value={r.expenseCategoryId ?? ''}
                        onChange={e => patchRow(r.key, { expenseCategoryId: e.target.value ? Number(e.target.value) : null })}>
                        <option value="">— Chọn danh mục —</option>
                        {categories.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.name}{c.categoryKind === 'SERVICE' ? ' (Dịch vụ)' : ''}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>

                  {/* Quy cách + ĐVT hiển thị READ-ONLY, lấy từ danh mục.
                      Dịch vụ không có 2 giá trị này → người dùng chỉ nhập số lượng. */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Field label="Quy cách">
                      <input readOnly className={`${inputCls} bg-[#FAF7F2] cursor-default`}
                        value={cat?.specification || (isService ? '—' : '')} placeholder="—" />
                    </Field>
                    <Field label="Đơn vị tính">
                      <input readOnly className={`${inputCls} bg-[#FAF7F2] cursor-default`}
                        value={cat?.unit || (isService ? '—' : '')} placeholder="—" />
                    </Field>
                    <Field label="Số lượng" required>
                      <input type="number" min="0" step="0.001" className={inputCls}
                        value={r.quantity} onChange={e => patchRow(r.key, { quantity: e.target.value })}
                        placeholder="0" />
                    </Field>
                    <Field label="Ghi chú riêng">
                      <input className={inputCls} value={r.note}
                        onChange={e => patchRow(r.key, { note: e.target.value })}
                        placeholder="VD: lấy loại nắp bấm" />
                    </Field>
                  </div>

                  {isService && (
                    <p className="flex items-start gap-1.5 text-xs text-[#8E8878]">
                      <Info size={13} className="mt-0.5 flex-shrink-0" />
                      Đây là khoản <b className="mx-1">dịch vụ</b> — sẽ không nhập kho khi nhận hàng.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <SecondaryButton onClick={onClose}>Huỷ</SecondaryButton>
          <SecondaryButton onClick={() => submit(true)} disabled={busy}>
            <Save size={14} /> Lưu
          </SecondaryButton>
          <PrimaryButton onClick={() => submit(false)} loading={busy}>
            <Send size={14} /> {editing ? 'Gửi kế toán' : 'Tạo phiếu'}
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   CHI TIẾT PHIẾU + NHẬN HÀNG (Bước 3)
   ══════════════════════════════════════════════════════════════════════════ */
function OrderDetailModal({ open, orderId, onClose, onChanged }) {
  const toast = useToast();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [receipt, setReceipt] = useState({});   // itemId → { qty, closeLine, note }
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    try { setOrder(await supplyOrderApi.getById(orderId)); }
    catch { toast('Không tải được phiếu', 'error'); }
    finally { setLoading(false); }
  }, [orderId, toast]);

  useEffect(() => { if (open) { setReceipt({}); setNotes(''); load(); } }, [open, load]);

  const canReceive = order && ['ORDERED', 'PARTIALLY_RECEIVED'].includes(order.status);
  const openLines = useMemo(
    () => (order?.items || []).filter(i => !i.receiveClosed), [order]);

  const submitReceipt = async (draft) => {
    const lines = Object.entries(receipt)
      .filter(([, v]) => num(v.qty) > 0 || v.closeLine)
      .map(([itemId, v]) => ({
        itemId: Number(itemId),
        qty: num(v.qty),
        closeLine: !!v.closeLine,
        note: v.note || null,
      }));
    if (!lines.length) { toast('Chưa nhập số thực nhận cho dòng nào', 'error'); return; }

    setBusy(true);
    try {
      const updated = await supplyOrderApi.saveReceipt(order.id, { notes, draft, items: lines });
      setOrder(updated);
      setReceipt({}); setNotes('');
      toast(draft ? 'Đã lưu nháp đợt nhận' : 'Đã xác nhận nhận hàng', 'success');
      onChanged?.();
    } catch (e) {
      toast(e?.response?.data?.message || 'Không lưu được đợt nhận', 'error');
    } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose}
      title={order ? `Phiếu ${order.requestCode}` : 'Chi tiết phiếu'} size="xl">
      {loading || !order ? <LoadingSpinner label="Đang tải…" /> : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <StatusPill status={order.status} />
            <span className="text-sm text-[#8E8878] inline-flex items-center gap-1.5">
              <Warehouse size={14} /> {order.supplyWarehouseName || '—'}
            </span>
            <span className="text-sm text-[#8E8878]">Tạo: {fmtDateTime(order.createdAt)}</span>
            {order.requiredBy && (
              <span className="text-sm text-[#8E8878]">Cần trước: {fmtDate(order.requiredBy)}</span>
            )}
          </div>

          {order.status === 'REJECTED' && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200">
              <AlertTriangle size={16} className="text-red-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-red-700">
                <b>Phiếu đã bị từ chối.</b> {order.rejectReason}
                <p className="text-xs text-red-600/80 mt-1">
                  Trạng thái này là cuối cùng — vui lòng lập phiếu mới nếu vẫn cần hàng.
                </p>
              </div>
            </div>
          )}

          {/* ── Mặt hàng ── */}
          <SectionCard>
            <div className="px-4 py-2.5 bg-[#FAF7F2] text-xs font-semibold text-[#8E8878] uppercase tracking-wider">
              Mặt hàng
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#FAF7F2]/50 text-xs uppercase text-[#8E8878]">
                    <th className="px-3 py-2 text-left">Tên</th>
                    <th className="px-3 py-2 text-left">Quy cách</th>
                    <th className="px-3 py-2 text-left">ĐVT</th>
                    <th className="px-3 py-2 text-right">Đặt</th>
                    <th className="px-3 py-2 text-right">Thực nhận</th>
                    <th className="px-3 py-2 text-left">NCC</th>
                    <th className="px-3 py-2 text-left">Tiến độ</th>
                    <th className="px-3 py-2 text-right">Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map(i => {
                    const rs = RECEIVE_STATUS[i.receiveStatus] || {};
                    return (
                      <tr key={i.id} className="border-t border-black/5">
                        <td className="px-3 py-2">
                          <div className="text-[#1C1C1E]">{i.itemName}</div>
                          {i.note && <div className="text-xs text-[#8E8878] mt-0.5">{i.note}</div>}
                          {i.categoryKind === 'SERVICE' && (
                            <span className="text-[10px] font-semibold text-[#8E8878]">Dịch vụ — không nhập kho</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-[#8E8878]">{i.specification || '—'}</td>
                        <td className="px-3 py-2 text-[#8E8878]">{i.unit}</td>
                        <td className="px-3 py-2 text-right">{fmtQty(i.orderedQuantity)}</td>
                        <td className="px-3 py-2 text-right font-medium">{fmtQty(i.receivedQuantity)}</td>
                        <td className="px-3 py-2 text-[#8E8878]">{i.supplierName || '—'}</td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${rs.cls || 'bg-gray-100 text-gray-500'}`}>
                            {rs.label || '—'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">{i.totalAmount != null ? fmtMoney(i.totalAmount) : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </SectionCard>

          {/* ── Nhóm NCC ── */}
          {order.groups?.length > 0 && (
            <SectionCard>
              <div className="px-4 py-2.5 bg-[#FAF7F2] text-xs font-semibold text-[#8E8878] uppercase tracking-wider">
                Nhà cung cấp
              </div>
              <div className="divide-y divide-black/5">
                {order.groups.map(g => {
                  const gs = GROUP_STATUS[g.status] || {};
                  return (
                    <div key={g.id} className="px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
                      <span className="font-medium text-[#1C1C1E]">{g.supplierName}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${gs.cls || 'bg-gray-100'}`}>
                        {gs.label || g.status}
                      </span>
                      {g.expectedDeliveryAt && (
                        <span className="text-xs text-[#8E8878]">Giao dự kiến: {fmtDate(g.expectedDeliveryAt)}</span>
                      )}
                      {g.contactName && (
                        <span className="text-xs text-[#8E8878]">
                          LH: {g.contactName}{g.contactPhone ? ` · ${g.contactPhone}` : ''}
                        </span>
                      )}
                      {g.totalAmount != null && (
                        <span className="ml-auto font-semibold text-[#1C1C1E]">{fmtMoney(g.totalAmount)}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          )}

          {/* ── Nhập đợt nhận hàng ── */}
          {canReceive && openLines.length > 0 && (
            <SectionCard>
              <div className="px-4 py-2.5 bg-[#FAF7F2] flex items-center gap-2">
                <PackageCheck size={14} className="text-[#C9A84C]" />
                <span className="text-xs font-semibold text-[#8E8878] uppercase tracking-wider">
                  Nhận hàng — đợt mới
                </span>
              </div>
              <div className="p-4 space-y-3">
                <p className="text-xs text-[#8E8878]">
                  Chỉ nhập các dòng THỰC GIAO trong đợt này. NCC giao thiếu thì để trống,
                  đợt sau nhận bù. Tích <b>“Chốt nhận”</b> khi không nhận thêm nữa (dù còn thiếu).
                </p>

                {openLines.map(i => {
                  const v = receipt[i.id] || {};
                  const remaining = num(i.orderedQuantity) - num(i.receivedQuantity);
                  return (
                    <div key={i.id} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end p-3 rounded-xl bg-[#FAF7F2]/50">
                      <div className="sm:col-span-4">
                        <div className="text-sm text-[#1C1C1E]">{i.itemName}</div>
                        <div className="text-xs text-[#8E8878]">
                          {i.specification ? `${i.specification} · ` : ''}Còn lại: {fmtQty(remaining)} {i.unit}
                        </div>
                      </div>
                      <div className="sm:col-span-3">
                        <Field label={`Thực nhận (${i.unit})`}>
                          <input type="number" min="0" step="0.001" className={inputCls}
                            value={v.qty ?? ''} placeholder="0"
                            onChange={e => setReceipt(s => ({ ...s, [i.id]: { ...s[i.id], qty: e.target.value } }))} />
                        </Field>
                      </div>
                      <div className="sm:col-span-3">
                        <Field label="Ghi chú">
                          <input className={inputCls} value={v.note ?? ''}
                            onChange={e => setReceipt(s => ({ ...s, [i.id]: { ...s[i.id], note: e.target.value } }))} />
                        </Field>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="inline-flex items-center gap-2 text-sm text-[#1C1C1E] cursor-pointer py-2.5">
                          <input type="checkbox" checked={!!v.closeLine}
                            onChange={e => setReceipt(s => ({ ...s, [i.id]: { ...s[i.id], closeLine: e.target.checked } }))}
                            className="rounded border-black/20 text-[#C9A84C] focus:ring-[#C9A84C]" />
                          Chốt nhận
                        </label>
                      </div>
                    </div>
                  );
                })}

                <Field label="Ghi chú đợt nhận">
                  <input className={inputCls} value={notes} onChange={e => setNotes(e.target.value)}
                    placeholder="VD: NCC A giao trước phần giấy in" />
                </Field>

                <div className="flex items-center justify-end gap-2">
                  <SecondaryButton onClick={() => submitReceipt(true)} disabled={busy}>
                    <Save size={14} /> Lưu nháp
                  </SecondaryButton>
                  <PrimaryButton onClick={() => submitReceipt(false)} loading={busy}>
                    <PackageCheck size={14} /> Xác nhận nhận hàng
                  </PrimaryButton>
                </div>
              </div>
            </SectionCard>
          )}

          {/* ── Lịch sử các đợt ── */}
          {order.receipts?.length > 0 && (
            <SectionCard>
              <div className="px-4 py-2.5 bg-[#FAF7F2] text-xs font-semibold text-[#8E8878] uppercase tracking-wider">
                Lịch sử nhận hàng
              </div>
              <div className="divide-y divide-black/5">
                {order.receipts.map(r => (
                  <div key={r.id} className="px-4 py-3">
                    <div className="flex items-center gap-3 text-sm">
                      <span className="font-medium text-[#1C1C1E]">Đợt {r.sequenceNo}</span>
                      <span className="text-xs text-[#8E8878]">{fmtDateTime(r.receivedAt)}</span>
                      <span className="text-xs text-[#8E8878]">{r.receivedByName}</span>
                    </div>
                    <div className="mt-1.5 text-xs text-[#8E8878]">
                      {r.items.map(li => `${li.itemName}: ${fmtQty(li.qty)} ${li.unit}`).join(' · ')}
                    </div>
                    {r.notes && <div className="mt-1 text-xs text-[#8E8878] italic">{r.notes}</div>}
                  </div>
                ))}
              </div>
            </SectionCard>
          )}
        </div>
      )}
    </Modal>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   PAGE
   ══════════════════════════════════════════════════════════════════════════ */
export default function SupplyOrderPage() {
  const toast = useToast();
  const [warehouses, setWarehouses] = useState([]);
  const [orders, setOrders] = useState(null);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState('ALL');
  const [search, setSearch] = useState('');
  const dSearch = useDebounce(search, 350);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [detailId, setDetailId] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await supplyOrderApi.list({
        status: status === 'ALL' ? undefined : status,
        search: dSearch || undefined,
        page, size: PAGE_SIZE,
      });
      setOrders(res?.content || []);
      setTotalPages(res?.totalPages ?? 0);
    } catch { setOrders([]); setTotalPages(0); }
  }, [status, dSearch, page]);

  useEffect(() => {
    supplyWarehouseApi.myWarehouses()
      .then(list => setWarehouses((list || []).filter(w => w.assigned)))
      .catch(() => setWarehouses([]));
  }, []);

  useEffect(() => { load(); }, [load]);

  // Đổi bộ lọc thì phải về trang đầu, nếu không sẽ rơi vào trang trống
  useEffect(() => { setPage(0); }, [status, dSearch]);

  const openEdit = async (id) => {
    try { setEditing(await supplyOrderApi.getById(id)); setFormOpen(true); }
    catch { toast('Không tải được phiếu', 'error'); }
  };

  const tabs = [
    { id: 'ALL', label: 'Tất cả' },
    { id: 'NEW', label: 'Mới tạo' },
    { id: 'ORDERED', label: 'Đã đặt hàng' },
    { id: 'PARTIALLY_RECEIVED', label: 'Đang nhận' },
    { id: 'RECEIVED', label: 'Đã nhận' },
    { id: 'COMPLETED', label: 'Hoàn thành' },
    { id: 'REJECTED', label: 'Từ chối' },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        icon={ShoppingBag}
        title="Phiếu đặt văn phòng phẩm"
        subtitle="Đặt đồ dùng / văn phòng phẩm và theo dõi nhận hàng"
        action={
          <PrimaryButton onClick={() => { setEditing(null); setFormOpen(true); }}
            disabled={warehouses.length === 0}>
            <Plus size={15} /> Tạo phiếu
          </PrimaryButton>
        }
      />

      {warehouses.length === 0 && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
          <AlertTriangle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-amber-800">
            Bạn chưa được gán kho văn phòng phẩm nào nên chưa tạo phiếu được.
            Vui lòng liên hệ chủ doanh nghiệp để được phân quyền kho.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <TabBar tabs={tabs} active={status} onChange={setStatus} />
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8878]" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Tìm mã phiếu, tên mặt hàng…" className={`${inputCls} pl-9`} />
        </div>
      </div>

      {orders == null ? <LoadingSpinner label="Đang tải phiếu…" />
        : orders.length === 0 ? (
          <EmptyState icon={Package} title="Chưa có phiếu nào"
            description="Bấm “Tạo phiếu” để đặt văn phòng phẩm / đồ dùng." />
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {orders.map(o => (
                <div key={o.id}
                  className="bg-white rounded-2xl border border-black/5 shadow-sm p-4 hover:border-[#C9A84C]/40 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <button onClick={() => setDetailId(o.id)} className="text-left min-w-0 flex-1">
                      <div className="font-semibold text-[#1C1C1E]">{o.requestCode}</div>
                      <div className="text-xs text-[#8E8878] mt-0.5 inline-flex items-center gap-1.5">
                        <Warehouse size={12} /> {o.supplyWarehouseName || '—'} · {fmtDate(o.createdAt)}
                      </div>
                    </button>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Còn NEW thì vẫn sửa được — kế toán chưa xử lý gì cả */}
                      {o.status === 'NEW' && (
                        <button onClick={() => openEdit(o.id)} title="Sửa phiếu"
                          className="p-1.5 rounded-lg text-[#8E8878] hover:text-[#C9A84C] hover:bg-[#FAF7F2]">
                          <Pencil size={14} />
                        </button>
                      )}
                      <StatusPill status={o.status} />
                    </div>
                  </div>

                  <button onClick={() => setDetailId(o.id)} className="text-left w-full">
                    <div className="mt-2.5 text-sm text-[#8E8878] line-clamp-2">
                      {o.items.map(i => `${i.itemName} × ${fmtQty(i.orderedQuantity)} ${i.unit}`).join(' · ')}
                    </div>
                    {o.grandTotal > 0 && (
                      <div className="mt-2 text-sm font-semibold text-[#1C1C1E]">
                        Tổng: {fmtMoney(o.grandTotal)}
                      </div>
                    )}
                  </button>
                </div>
              ))}
            </div>

            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </>
        )}

      <OrderFormModal open={formOpen} editing={editing}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        onSaved={load} warehouses={warehouses} />

      <OrderDetailModal open={!!detailId} orderId={detailId}
        onClose={() => setDetailId(null)} onChanged={load} />
    </div>
  );
}
