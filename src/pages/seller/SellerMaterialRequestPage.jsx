import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  ShoppingBag, Plus, Trash2, Search, Package, PackageCheck, X, CheckSquare, Square, Warehouse,
} from 'lucide-react';
import { sellerMaterialApi } from '../../api/sellerMaterialApi';
import { useToast } from '../../components/common/Toast';
import useDebounce from '../../utils/useDebounce.js';
import { formatVNInput, parseVN, formatVN } from '../../utils/vnNumber';
import Modal from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import {
  PageHeader, SectionCard, PrimaryButton, SecondaryButton, Field,
  inputCls, selectCls, formatNumber, LoadingSpinner, EmptyState,
} from '../../components/ui';

const STATUS_META = {
  NEW:       { label: 'Mới tạo',      cls: 'bg-gray-100 text-gray-700 ring-gray-200' },
  ORDERED:   { label: 'Đã đặt hàng',  cls: 'bg-amber-50 text-amber-700 ring-amber-200' },
  RECEIVED:  { label: 'Đã nhận',      cls: 'bg-indigo-50 text-indigo-700 ring-indigo-200' },
  COMPLETED: { label: 'Hoàn thành',   cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
};

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const msToDateInput = (ms) => {
  if (!ms) return '';
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const dateInputToMs = (s) => (s ? new Date(s + 'T00:00:00').getTime() : null);

/* ── Dropdown tìm nguyên liệu (portal ra body để không bị modal cắt) ──────── */
function IngredientSelect({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const dq = useDebounce(q, 350);
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [rect, setRect] = useState(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  const updateRect = useCallback(() => {
    if (triggerRef.current) setRect(triggerRef.current.getBoundingClientRect());
  }, []);

  // Cập nhật vị trí khi mở + khi cuộn/resize (kể cả cuộn bên trong modal)
  useEffect(() => {
    if (!open) return;
    updateRect();
    const onWin = () => updateRect();
    window.addEventListener('scroll', onWin, true);
    window.addEventListener('resize', onWin);
    return () => { window.removeEventListener('scroll', onWin, true); window.removeEventListener('resize', onWin); };
  }, [open, updateRect]);

  useEffect(() => {
    if (!open) return;
    let alive = true; setLoading(true);
    sellerMaterialApi.getIngredients(dq)
      .then((r) => { if (alive) setOptions(r || []); })
      .catch(() => { if (alive) setOptions([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [dq, open]);

  useEffect(() => {
    const onDoc = (e) => {
      if (triggerRef.current?.contains(e.target)) return;
      if (panelRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <>
      <button type="button" ref={triggerRef} onClick={() => setOpen((o) => !o)}
        className={`${inputCls} flex items-center justify-between text-left`}>
        <span className={value ? 'text-[#1C1C1E] truncate' : 'text-[#8E8878]'}>
          {value ? `${value.name}${value.unit ? ` (${value.unit})` : ''}` : 'Chọn nguyên liệu...'}
        </span>
        <Search size={15} className="text-[#8E8878] shrink-0" />
      </button>
      {open && rect && createPortal(
        <div ref={panelRef}
          style={{ position: 'fixed', top: rect.bottom + 4, left: rect.left, width: rect.width, zIndex: 80 }}
          className="bg-white rounded-xl shadow-xl border border-[#E8DDD0] overflow-hidden">
          <div className="p-2 border-b border-[#F0E9DF]">
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Gõ tên nguyên liệu..." className={inputCls} />
          </div>
          <div className="max-h-56 overflow-auto">
            {loading && <p className="px-3 py-3 text-sm text-[#8E8878]">Đang tìm...</p>}
            {!loading && options.length === 0 && (
              <p className="px-3 py-3 text-sm text-[#8E8878]">Không có nguyên liệu phù hợp</p>
            )}
            {!loading && options.map((o) => (
              <button key={o.id} type="button"
                onClick={() => { onChange(o); setOpen(false); setQ(''); }}
                className="w-full text-left px-3 py-2 hover:bg-[#FBF7F0] flex items-center gap-2">
                <Package size={14} className="text-[#C9A84C] shrink-0" />
                <span className="text-sm text-[#1C1C1E] flex-1 truncate">{o.name}</span>
                {o.unit && <span className="text-xs text-[#8E8878]">{o.unit}</span>}
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

let _rid = 0;
const newRow = () => ({ key: `r_${++_rid}`, ingredient: null, qty: '' });

export default function SellerMaterialRequestPage() {
  const toast = useToast();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [warehouses, setWarehouses] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await sellerMaterialApi.list({ page: 0, size: 50 });
      setList(res?.content || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { sellerMaterialApi.getWarehouses().then((w) => setWarehouses(w || [])).catch(() => {}); }, []);

  /* ── Tạo phiếu ── */
  const [createOpen, setCreateOpen] = useState(false);
  const [rows, setRows] = useState([newRow()]);
  const [saving, setSaving] = useState(false);

  const submitCreate = async () => {
    const items = rows.filter((r) => r.ingredient && parseVN(r.qty) > 0)
      .map((r, i) => ({ ingredientId: r.ingredient.id, materialName: r.ingredient.name,
        unit: r.ingredient.unit, qtyRequested: parseVN(r.qty), sortOrder: i }));
    if (items.length === 0) { toast('Cần ít nhất 1 nguyên liệu có số lượng > 0', 'error'); return; }
    setSaving(true);
    try {
      await sellerMaterialApi.create({ items });
      toast('Đã tạo phiếu đặt hàng', 'success');
      setCreateOpen(false); setRows([newRow()]); load();
    } catch (e) { toast(e?.response?.data?.message || e.message || 'Lỗi tạo phiếu', 'error'); }
    finally { setSaving(false); }
  };

  /* ── Nhận hàng ── */
  const [receiveTarget, setReceiveTarget] = useState(null);
  const [recvItems, setRecvItems] = useState({});       // itemId -> {qtyReceived, expiry, warehouseId, selected}
  const [bulkWarehouse, setBulkWarehouse] = useState('');
  const [receiving, setReceiving] = useState(false);

  const openReceive = async (req) => {
    try {
      const full = await sellerMaterialApi.getById(req.id);
      const map = {};
      (full.items || []).forEach((it) => {
        map[it.id] = {
          qtyReceived: formatVN(it.qtyReceived != null ? it.qtyReceived : (it.qtyRequested ?? 0), 3),
          expiry: msToDateInput(it.expiryDate),
          warehouseId: it.warehouseId ? String(it.warehouseId) : '',
          selected: false,
        };
      });
      setReceiveTarget(full); setRecvItems(map); setBulkWarehouse('');
    } catch (e) { toast(e?.response?.data?.message || 'Lỗi tải phiếu', 'error'); }
  };

  const patchRecv = (itemId, patch) =>
    setRecvItems((m) => ({ ...m, [itemId]: { ...m[itemId], ...patch } }));

  const applyBulkWarehouse = () => {
    if (!bulkWarehouse) return;
    setRecvItems((m) => {
      const next = { ...m };
      Object.keys(next).forEach((id) => { if (next[id].selected) next[id] = { ...next[id], warehouseId: bulkWarehouse }; });
      return next;
    });
  };

  const submitReceive = async () => {
    const items = (receiveTarget.items || []).map((it) => {
      const r = recvItems[it.id] || {};
      return {
        itemId: it.id,
        qtyReceived: parseVN(r.qtyReceived),
        expiryDate: dateInputToMs(r.expiry),   // null → BE mặc định +5 năm
        warehouseId: r.warehouseId ? Number(r.warehouseId) : null,
      };
    });
    const missingWh = items.filter((i) => i.qtyReceived > 0 && !i.warehouseId);
    if (missingWh.length > 0) { toast('Mỗi dòng có số nhận phải chọn kho nhận', 'error'); return; }
    if (items.every((i) => i.qtyReceived <= 0)) { toast('Nhập số thực nhận', 'error'); return; }
    setReceiving(true);
    try {
      await sellerMaterialApi.receive(receiveTarget.id, { items });
      toast('Đã xác nhận nhận hàng', 'success');
      setReceiveTarget(null); load();
    } catch (e) { toast(e?.response?.data?.message || e.message || 'Lỗi nhận hàng', 'error'); }
    finally { setReceiving(false); }
  };

  const allSelected = receiveTarget && (receiveTarget.items || []).length > 0
    && (receiveTarget.items || []).every((it) => recvItems[it.id]?.selected);
  const toggleAll = () =>
    setRecvItems((m) => {
      const next = { ...m };
      Object.keys(next).forEach((id) => { next[id] = { ...next[id], selected: !allSelected }; });
      return next;
    });

  return (
    <div className="p-4 md:p-6 space-y-5">
      <PageHeader
        icon={ShoppingBag}
        title="Phiếu đặt hàng"
        subtitle="Đặt nguyên liệu (gia vị, hương liệu...) — kế toán trưởng duyệt, bạn nhận và chọn kho."
        action={<PrimaryButton onClick={() => setCreateOpen(true)}><Plus size={16} /> Tạo phiếu</PrimaryButton>}
      />

      {loading ? <LoadingSpinner label="Đang tải..." /> : list.length === 0 ? (
        <EmptyState icon={ShoppingBag} title="Chưa có phiếu nào"
          description="Bấm 'Tạo phiếu' để đặt nguyên liệu." />
      ) : (
        <div className="space-y-3">
          {list.map((r) => {
            const meta = STATUS_META[r.status] || STATUS_META.NEW;
            return (
              <SectionCard key={r.id}>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[#1C1C1E]">{r.requestCode}</span>
                      <Badge className={meta.cls}>{meta.label}</Badge>
                    </div>
                    <p className="text-xs text-[#8E8878] mt-1">
                      {r.itemCount} nguyên liệu
                      {r.estimatedDelivery ? ` · Giao dự kiến ${new Date(r.estimatedDelivery).toLocaleDateString('vi-VN')}` : ''}
                    </p>
                  </div>
                  {r.status === 'ORDERED' && (
                    <SecondaryButton onClick={() => openReceive(r)}>
                      <PackageCheck size={15} /> Nhận hàng
                    </SecondaryButton>
                  )}
                </div>
              </SectionCard>
            );
          })}
        </div>
      )}

      {/* Modal tạo phiếu */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Tạo phiếu đặt hàng" size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <SecondaryButton onClick={() => setCreateOpen(false)}>Hủy</SecondaryButton>
            <PrimaryButton onClick={submitCreate} loading={saving}>Tạo phiếu</PrimaryButton>
          </div>
        }>
        <div className="space-y-3">
          {rows.map((r, idx) => (
            <div key={r.key} className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-7">
                <Field label={idx === 0 ? 'Nguyên liệu' : ''}>
                  <IngredientSelect value={r.ingredient}
                    onChange={(ing) => setRows((rs) => rs.map((x) => x.key === r.key ? { ...x, ingredient: ing } : x))} />
                </Field>
              </div>
              <div className="col-span-4">
                <Field label={idx === 0 ? `Số lượng${r.ingredient?.unit ? ` (${r.ingredient.unit})` : ''}` : ''}>
                  <input inputMode="decimal" value={r.qty} className={inputCls} placeholder="SL"
                    onChange={(e) => setRows((rs) => rs.map((x) => x.key === r.key ? { ...x, qty: formatVNInput(e.target.value, 3) } : x))} />
                </Field>
              </div>
              <div className="col-span-1 pb-2">
                {rows.length > 1 && (
                  <button onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                    className="text-red-400 hover:text-red-600"><Trash2 size={16} /></button>
                )}
              </div>
            </div>
          ))}
          <SecondaryButton onClick={() => setRows((rs) => [...rs, newRow()])}>
            <Plus size={15} /> Thêm nguyên liệu
          </SecondaryButton>
        </div>
      </Modal>

      {/* Modal nhận hàng */}
      <Modal open={!!receiveTarget} onClose={() => setReceiveTarget(null)}
        title={receiveTarget ? `Nhận hàng — ${receiveTarget.requestCode}` : ''} size="xl"
        footer={
          <div className="flex justify-end gap-2">
            <SecondaryButton onClick={() => setReceiveTarget(null)}>Hủy</SecondaryButton>
            <PrimaryButton onClick={submitReceive} loading={receiving}>Xác nhận nhận hàng</PrimaryButton>
          </div>
        }>
        {receiveTarget && (
          <div className="space-y-3">
            {/* Gán kho nhanh */}
            <div className="flex flex-wrap items-center gap-2 p-2 rounded-xl bg-[#FBF7F0] border border-[#EFE7DA]">
              <button onClick={toggleAll} className="flex items-center gap-1 text-sm text-[#5C5C5C]">
                {allSelected ? <CheckSquare size={16} className="text-[#C9A84C]" /> : <Square size={16} />} Chọn tất cả
              </button>
              <div className="flex-1" />
              <Warehouse size={15} className="text-[#8E8878]" />
              <select value={bulkWarehouse} onChange={(e) => setBulkWarehouse(e.target.value)} className={selectCls + ' w-48'}>
                <option value="">Gán kho cho mục đã chọn...</option>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
              <SecondaryButton onClick={applyBulkWarehouse}>Gán</SecondaryButton>
            </div>

            <div className="space-y-2">
              {(receiveTarget.items || []).map((it) => {
                const r = recvItems[it.id] || {};
                return (
                  <div key={it.id} className="rounded-xl border border-[#EFE7DA] p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <button onClick={() => patchRecv(it.id, { selected: !r.selected })}>
                        {r.selected ? <CheckSquare size={16} className="text-[#C9A84C]" /> : <Square size={16} className="text-[#8E8878]" />}
                      </button>
                      <span className="font-medium text-[#1C1C1E] flex-1">{it.materialName}</span>
                      <span className="text-xs text-[#8E8878]">Đặt: {formatNumber(it.qtyRequested)} {it.unit}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <Field label="Thực nhận">
                        <input inputMode="decimal" value={r.qtyReceived || ''} className={inputCls}
                          onChange={(e) => patchRecv(it.id, { qtyReceived: formatVNInput(e.target.value, 3) })} />
                      </Field>
                      <Field label="Hạn dùng (bỏ trống = +5 năm)">
                        <input type="date" value={r.expiry || ''} className={inputCls}
                          onChange={(e) => patchRecv(it.id, { expiry: e.target.value })} />
                      </Field>
                      <Field label="Kho nhận">
                        <select value={r.warehouseId || ''} className={selectCls}
                          onChange={(e) => patchRecv(it.id, { warehouseId: e.target.value })}>
                          <option value="">Chọn kho...</option>
                          {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                      </Field>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-[#8E8878]">
              Sau khi nhận, kế toán trưởng nhập giá vốn — lúc đó lô hàng mới thực sự nhập kho.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}