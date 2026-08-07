import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ShoppingBag, Plus, Trash2, Search, Package, PackageCheck, Warehouse,
  ChevronDown, Save, Send, AlertTriangle, Info, Pencil, Lock,
} from 'lucide-react';
import {
  supplyOrderApi, supplyWarehouseApi, supplyItemApi,
  SUPPLY_STATUS, RECEIVE_STATUS, GROUP_STATUS,
  fmtQty, fmtMoney, fmtDate, fmtDateTime,
} from '../../api/supplyApi';
import { useToast } from '../../components/common/Toast';
import useDebounce from '../../utils/useDebounce.js';
import Modal from '../../components/ui/Modal';
import DatePicker from '../../components/ui/DatePicker';
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
/**
 * @param {(q:string)=>void} [onQuickCreate]  Bật chế độ "tìm không thấy thì tạo
 *   nhanh". Nhận từ khoá đang gõ để form tạo điền sẵn tên, người dùng khỏi gõ lại.
 * @param {string} [quickCreateHint]  Chữ nhỏ mô tả hành động tạo nhanh.
 */
function SearchDropdown({
  value, label, placeholder, fetcher, onPick, disabled,
  onQuickCreate, quickCreateHint,
}) {
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
        <span className={value ? 'text-ink truncate' : 'text-muted/70'}>
          {label || placeholder}
        </span>
        <ChevronDown size={14} className="text-muted flex-shrink-0 ml-2" />
      </button>

      {open && rect && createPortal(
        <div ref={panelRef}
          style={{ position: 'fixed', top: rect.bottom + 4, left: rect.left, width: rect.width, zIndex: 9999 }}
          className="bg-surface rounded-xl border border-hairline-2 shadow-lg overflow-hidden">
          <div className="p-2 border-b border-hairline">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
              <input autoFocus value={q} onChange={e => setQ(e.target.value)}
                placeholder="Tìm kiếm..."
                className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-hairline-2 focus:outline-none focus:border-gold" />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {loading ? (
              <p className="px-3 py-4 text-sm text-muted text-center">Đang tải…</p>
            ) : options.length === 0 ? (
              /* KHÔNG TÌM THẤY → mời tạo nhanh ngay tại chỗ.
                 Trước đây tới đây là cụt đường: người lập phiếu phải bỏ dở đi
                 nhờ Owner thêm nhãn rồi quay lại làm phiếu từ đầu. */
              onQuickCreate ? (
                <button type="button"
                  onClick={() => { onQuickCreate(q.trim()); setOpen(false); }}
                  className="w-full text-left px-3 py-4 hover:bg-canvas">
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-gold">
                    <Plus size={14} className="flex-shrink-0" />
                    {q.trim() ? <>Tạo nhanh “{q.trim()}”</> : 'Tạo mới'}
                  </div>
                  <div className="text-xs text-muted mt-1">
                    {quickCreateHint || 'Không tìm thấy kết quả nào phù hợp.'}
                  </div>
                </button>
              ) : (
                <p className="px-3 py-4 text-sm text-muted text-center">Không có kết quả</p>
              )
            ) : options.map(o => (
              <button key={o.id} type="button"
                onClick={() => { onPick(o); setOpen(false); }}
                className="w-full text-left px-3 py-2.5 text-sm hover:bg-canvas border-b border-hairline last:border-0">
                <div className="text-ink font-medium">{o._label ?? o.name}</div>
                {o._sub && <div className="text-xs text-muted mt-0.5">{o._sub}</div>}
              </button>
            ))}
          </div>

          {/* Vẫn cho tạo nhanh KỂ CẢ khi có kết quả: gõ "Bút" ra "Bút bi xanh"
              không có nghĩa là người dùng muốn chọn nó thay vì tạo "Bút lông". */}
          {onQuickCreate && !loading && options.length > 0 && (
            <button type="button"
              onClick={() => { onQuickCreate(q.trim()); setOpen(false); }}
              className="w-full flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold
                         text-gold hover:bg-canvas border-t border-hairline">
              <Plus size={13} className="flex-shrink-0" />
              {q.trim() ? <>Không có trong danh sách — tạo nhanh “{q.trim()}”</> : 'Tạo nhãn mới'}
            </button>
          )}
        </div>, document.body)}
    </>
  );
}

function StatusPill({ status }) {
  const meta = SUPPLY_STATUS[status] || { label: status, cls: 'bg-surface-2 text-ink-2 ring-line' };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ${meta.cls}`}>
      {meta.label}
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   TẠO NHANH DANH MỤC KHOẢN CHI
   ══════════════════════════════════════════════════════════════════════════ */

const KIND_LABEL = {
  SERVICE: 'Dịch vụ',
  CONSUMABLE: 'Đồ dùng tiêu hao',
};

/**
 * Autocomplete vật dụng đã có trong kho — BIỆN PHÁP CHÍNH CHỐNG PHÂN MẢNH TỒN KHO.
 *
 * <p>Chọn một gợi ý ⇒ tên + quy cách + ĐVT được điền sẵn và KHOÁ LẠI, để
 * "Nước rửa chén / 4L/chai / Chai" không bị nhập thành 3 bản ghi khác nhau chỉ
 * vì gõ lệch ("4 lít/chai", "4l/ chai"). Muốn gõ tay thì bấm "Tạo mới".
 *
 * <p>Bản sao có chủ đích của component cùng tên trong
 * {@code components/supply/ExpenseCategorySection.jsx} (form của Owner) — file
 * đó không export nó ra ngoài.
 */
function SupplyItemAutocomplete({ value, onPick, onManual, locked }) {
  const [q, setQ] = useState(value || '');
  const dq = useDebounce(q, 300);
  const [options, setOptions] = useState([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => { setQ(value || ''); }, [value]);

  useEffect(() => {
    if (!open || locked) return;
    let alive = true;
    supplyItemApi.suggest(dq)
      .then(d => { if (alive) setOptions(d || []); })
      .catch(() => { if (alive) setOptions([]); });
    return () => { alive = false; };
  }, [dq, open, locked]);

  useEffect(() => {
    const onDown = (e) => { if (!boxRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <input
          className={`${inputCls} ${locked ? 'bg-canvas pr-9' : ''}`}
          value={q}
          readOnly={locked}
          placeholder="VD: Nước rửa chén"
          onFocus={() => !locked && setOpen(true)}
          onChange={e => { setQ(e.target.value); onManual(e.target.value); setOpen(true); }}
        />
        {locked && (
          <Lock size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
        )}
      </div>

      {open && !locked && (
        <div className="absolute z-50 mt-1 w-full bg-surface rounded-xl border border-hairline-2 shadow-lg max-h-56 overflow-y-auto">
          {options.length === 0 ? (
            <p className="px-3 py-3 text-xs text-muted text-center">
              Chưa có vật dụng nào khớp — cứ gõ tiếp để tạo mới.
            </p>
          ) : options.map(o => (
            <button key={o.id} type="button"
              onClick={() => { onPick(o); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-canvas border-b border-hairline last:border-0">
              <div className="text-ink">{o.name}</div>
              <div className="text-xs text-muted">
                {o.specification || '(không có quy cách)'} · {o.unit}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * MODAL TẠO NHANH NHÃN KHOẢN CHI — bản dành cho người lập phiếu.
 *
 * <p>Giữ ĐÚNG các ràng buộc của form Owner, vì nhãn tạo ra vào chung một pool:
 *   · Dịch vụ      → không có ĐVT / quy cách, không nhập kho.
 *   · Đồ dùng tiêu hao → BẮT BUỘC ĐVT + quy cách, có autocomplete chống trùng.
 *
 * @param {string} initialName  Từ khoá người dùng vừa gõ ở ô tìm kiếm — điền sẵn
 *                              vào ô Tên để khỏi phải gõ lại.
 * @param {(cat)=>void} onCreated  Nhận category vừa tạo để form chọn luôn vào dòng.
 */
function QuickCategoryModal({ open, initialName, onClose, onCreated }) {
  const [form, setForm] = useState({
    name: '', description: '', categoryKind: 'SERVICE',
    unit: '', specification: '', supplyItemId: null,
  });
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!open) return;
    setErr('');
    setLocked(false);
    setForm({
      name: initialName || '',
      description: '', categoryKind: 'SERVICE',
      unit: '', specification: '', supplyItemId: null,
    });
  }, [open, initialName]);

  const isConsumable = form.categoryKind === 'CONSUMABLE';

  const pickExisting = (o) => {
    setForm(f => ({
      ...f, name: o.name, specification: o.specification || '', unit: o.unit, supplyItemId: o.id,
    }));
    setLocked(true);
  };

  const unlock = () => {
    setLocked(false);
    setForm(f => ({ ...f, supplyItemId: null }));
  };

  const submit = async () => {
    if (!form.name.trim()) { setErr('Tên nhãn khoản chi là bắt buộc'); return; }
    if (isConsumable) {
      if (!form.unit.trim()) { setErr('Đồ dùng tiêu hao bắt buộc nhập Đơn vị tính'); return; }
      if (!form.specification.trim()) { setErr('Đồ dùng tiêu hao bắt buộc nhập Quy cách'); return; }
    }
    setBusy(true); setErr('');
    try {
      const created = await supplyOrderApi.createCategory({
        name: form.name.trim(),
        description: form.description.trim() || null,
        categoryKind: form.categoryKind,
        unit: isConsumable ? form.unit.trim() : null,
        specification: isConsumable ? form.specification.trim() : null,
        supplyItemId: isConsumable ? form.supplyItemId : null,
      });
      onCreated(created);
      onClose();
    } catch (e) {
      setErr(e?.response?.data?.message || 'Không tạo được nhãn khoản chi');
    } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Tạo nhanh danh mục khoản chi" size="md">
      <div className="space-y-4">
        <Field label="Loại khoản chi" required>
          <div className="flex gap-2">
            {['SERVICE', 'CONSUMABLE'].map(k => (
              <button key={k} type="button"
                onClick={() => setForm(f => ({ ...f, categoryKind: k }))}
                className={`flex-1 px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors
                  ${form.categoryKind === k
                    ? 'bg-gold/10 border-gold text-ink'
                    : 'bg-surface border-hairline-2 text-muted hover:bg-canvas'}`}>
                {KIND_LABEL[k]}
              </button>
            ))}
          </div>
        </Field>

        <p className="flex items-start gap-1.5 text-xs text-muted">
          <Info size={13} className="mt-0.5 flex-shrink-0" />
          {isConsumable
            ? 'Đồ dùng tiêu hao sẽ được NHẬP KHO khi bạn xác nhận nhận hàng. Tồn kho gộp theo tên + quy cách + ĐVT, không phụ thuộc nhà cung cấp.'
            : 'Dịch vụ không nhập kho — chỉ ghi nhận chi phí. Đơn vị tính và quy cách để trống được.'}
        </p>

        <Field label="Tên nhãn khoản chi" required
          hint={isConsumable && !locked
            ? 'Gõ để tìm vật dụng đã có — chọn gợi ý sẽ tự điền quy cách + ĐVT'
            : undefined}>
          {isConsumable ? (
            <SupplyItemAutocomplete
              value={form.name}
              locked={locked}
              onPick={pickExisting}
              onManual={(v) => setForm(f => ({ ...f, name: v, supplyItemId: null }))}
            />
          ) : (
            <input className={inputCls} value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="VD: Tiền điện" />
          )}
        </Field>

        {isConsumable && (
          <>
            {locked && (
              <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-canvas border border-hairline">
                <span className="text-xs text-muted">
                  Đang dùng vật dụng có sẵn — tên, quy cách, ĐVT đã khoá để không tách tồn kho.
                </span>
                <button type="button" onClick={unlock}
                  className="text-xs font-semibold text-gold hover:text-gold-strong whitespace-nowrap ml-2">
                  Tạo mới
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Field label="Quy cách" required>
                <input className={`${inputCls} ${locked ? 'bg-canvas' : ''}`}
                  readOnly={locked} value={form.specification}
                  onChange={e => setForm(f => ({ ...f, specification: e.target.value }))}
                  placeholder="VD: 4L/chai" />
              </Field>
              <Field label="Đơn vị tính" required>
                <input className={`${inputCls} ${locked ? 'bg-canvas' : ''}`}
                  readOnly={locked} value={form.unit}
                  onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                  placeholder="VD: Chai" />
              </Field>
            </div>
          </>
        )}

        <Field label="Ghi chú">
          <input className={inputCls} value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        </Field>

        {err && <p className="text-xs text-red-600 dark:text-red-300">{err}</p>}

        <div className="flex items-center justify-end gap-2">
          <SecondaryButton onClick={onClose}>Huỷ</SecondaryButton>
          <PrimaryButton onClick={submit} loading={busy}>Tạo &amp; chọn</PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   FORM LẬP / SỬA PHIẾU (Bước 1)
   ══════════════════════════════════════════════════════════════════════════ */
function OrderFormModal({ open, editing, onClose, onSaved, warehouses }) {
  const toast = useToast();
  const [warehouseId, setWarehouseId] = useState('');
  const [requiredBy, setRequiredBy] = useState(null);   // epoch ms — DatePicker dùng ms
  const [rows, setRows] = useState([]);
  const [categories, setCategories] = useState([]);
  const [busy, setBusy] = useState(false);

  const emptyRow = () => ({
    key: Math.random().toString(36).slice(2),
    // Không còn supplierId — NCC do kế toán trưởng chọn ở bước xác nhận.
    expenseCategoryId: null, quantity: '', note: '',
  });

  useEffect(() => {
    if (!open) return;
    supplyOrderApi.categories().then(setCategories).catch(() => setCategories([]));

    if (editing) {
      setWarehouseId(String(editing.supplyWarehouseId ?? ''));
      setRequiredBy(editing.requiredBy ?? null);
      setRows(editing.items.map(i => ({
        key: `it-${i.id}`,
        expenseCategoryId: i.expenseCategoryId ?? null,
        quantity: i.orderedQuantity != null ? String(i.orderedQuantity) : '',
        note: i.note ?? '',
      })));
    } else {
      setRequiredBy(null);
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

  /* ── Tìm kiếm danh mục ────────────────────────────────────────────────────
     Lọc NGAY TRÊN CLIENT từ list đã nạp sẵn: danh mục cỡ vài trăm nhãn, gọi API
     mỗi lần gõ chỉ tổ chớp nháy mà không nhanh hơn. Bỏ dấu tiếng Việt để gõ
     "quet nha" vẫn ra "Chổi quét nhà". */
  const searchCategories = useCallback((q) => {
    const norm = (s) => (s || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd').replace(/Đ/g, 'D')
      .toLowerCase().trim();

    const nq = norm(q);
    const matched = !nq
      ? categories
      : categories.filter(c => norm(c.name).includes(nq));

    return Promise.resolve(matched.map(c => ({
      ...c,
      _label: c.name,
      _sub: c.categoryKind === 'SERVICE'
        ? 'Dịch vụ — không nhập kho'
        : [c.specification, c.unit].filter(Boolean).join(' · ') || 'Đồ dùng tiêu hao',
    })));
  }, [categories]);

  /* ── Tạo nhanh danh mục ───────────────────────────────────────────────────
     Nhớ lại dòng nào đang mở modal để gán thẳng nhãn vừa tạo vào đúng dòng đó. */
  const [quickCreate, setQuickCreate] = useState(null); // { rowKey, name } | null

  const openQuickCreate = (rowKey, name) => setQuickCreate({ rowKey, name });

  const onCategoryCreated = (created) => {
    if (!created) return;
    // Đưa vào list ngay, khỏi phải gọi lại API chỉ để thấy nhãn mình vừa tạo.
    setCategories(cs => [...cs, created].sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', 'vi')));
    if (quickCreate?.rowKey) {
      patchRow(quickCreate.rowKey, { expenseCategoryId: created.id });
    }
  };

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
      requiredBy: requiredBy || null,
      draft,
      items: rows
        .filter(r => r.expenseCategoryId && num(r.quantity) > 0)
        .map((r, i) => ({
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
            <DatePicker value={requiredBy} onChange={setRequiredBy}
              placeholder="Chọn ngày" minDate={new Date()} />
          </Field>
        </div>

        <div className="rounded-xl border border-hairline overflow-hidden">
          <div className="px-4 py-2.5 bg-canvas flex items-center justify-between">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">Danh sách mặt hàng</span>
            <button type="button" onClick={() => setRows(rs => [...rs, emptyRow()])}
              className="inline-flex items-center gap-1 text-xs font-semibold text-gold hover:text-gold-strong">
              <Plus size={13} /> Thêm dòng
            </button>
          </div>

          <div className="divide-y divide-hairline">
            {rows.map((r, idx) => {
              const cat = r.expenseCategoryId ? catById[r.expenseCategoryId] : null;
              const isService = cat && cat.categoryKind === 'SERVICE';
              return (
                <div key={r.key} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted">Mặt hàng #{idx + 1}</span>
                    {rows.length > 1 && (
                      <button type="button" onClick={() => setRows(rs => rs.filter(x => x.key !== r.key))}
                        className="text-muted hover:text-red-600 dark:text-red-300"><Trash2 size={14} /></button>
                    )}
                  </div>

                  {/* NHÀ CUNG CẤP đã BỎ khỏi form này — kế toán trưởng mới là
                      người chọn NCC cho từng mặt hàng ở bước xác nhận đặt hàng
                      (họ nắm giá và công nợ). Người lập phiếu chỉ nêu CẦN GÌ.

                      Ô TÌM KIẾM thay cho select: danh mục dùng chung toàn công ty
                      nên list rất dài, cuộn tay tìm là không khả thi. Tìm không
                      thấy thì tạo nhanh ngay tại chỗ. */}
                  <Field label="Danh mục khoản chi" required>
                    <SearchDropdown
                      value={r.expenseCategoryId}
                      label={cat ? cat.name : ''}
                      placeholder="— Tìm / chọn danh mục —"
                      fetcher={(q) => searchCategories(q)}
                      onPick={(c) => patchRow(r.key, { expenseCategoryId: c.id })}
                      onQuickCreate={(q) => openQuickCreate(r.key, q)}
                      quickCreateHint="Tạo nhãn mới dùng chung cho cả công ty."
                    />
                  </Field>

                  {/* Quy cách + ĐVT hiển thị READ-ONLY, lấy từ danh mục.
                      Dịch vụ không có 2 giá trị này → người dùng chỉ nhập số lượng. */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Field label="Quy cách">
                      <input readOnly className={`${inputCls} bg-canvas cursor-default`}
                        value={cat?.specification || (isService ? '—' : '')} placeholder="—" />
                    </Field>
                    <Field label="Đơn vị tính">
                      <input readOnly className={`${inputCls} bg-canvas cursor-default`}
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
                    <p className="flex items-start gap-1.5 text-xs text-muted">
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

      <QuickCategoryModal
        open={!!quickCreate}
        initialName={quickCreate?.name || ''}
        onClose={() => setQuickCreate(null)}
        onCreated={onCategoryCreated}
      />
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
            <span className="text-sm text-muted inline-flex items-center gap-1.5">
              <Warehouse size={14} /> {order.supplyWarehouseName || '—'}
            </span>
            <span className="text-sm text-muted">Tạo: {fmtDateTime(order.createdAt)}</span>
            {order.requiredBy && (
              <span className="text-sm text-muted">Cần trước: {fmtDate(order.requiredBy)}</span>
            )}
          </div>

          {order.status === 'REJECTED' && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/28">
              <AlertTriangle size={16} className="text-red-600 dark:text-red-300 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-red-700 dark:text-red-300">
                <b>Phiếu đã bị từ chối.</b> {order.rejectReason}
                <p className="text-xs text-red-600/80 mt-1">
                  Trạng thái này là cuối cùng — vui lòng lập phiếu mới nếu vẫn cần hàng.
                </p>
              </div>
            </div>
          )}

          {/* ── Mặt hàng ── */}
          <SectionCard>
            <div className="px-4 py-2.5 bg-canvas text-xs font-semibold text-muted uppercase tracking-wider">
              Mặt hàng
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-canvas/50 text-xs uppercase text-muted">
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
                      <tr key={i.id} className="border-t border-hairline">
                        <td className="px-3 py-2">
                          <div className="text-ink">{i.itemName}</div>
                          {i.note && <div className="text-xs text-muted mt-0.5">{i.note}</div>}
                          {i.categoryKind === 'SERVICE' && (
                            <span className="text-[10px] font-semibold text-muted">Dịch vụ — không nhập kho</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-muted">{i.specification || '—'}</td>
                        <td className="px-3 py-2 text-muted">{i.unit}</td>
                        <td className="px-3 py-2 text-right">{fmtQty(i.orderedQuantity)}</td>
                        <td className="px-3 py-2 text-right font-medium">{fmtQty(i.receivedQuantity)}</td>
                        <td className="px-3 py-2 text-muted">{i.supplierName || '—'}</td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${rs.cls || 'bg-surface-2 text-muted'}`}>
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
              <div className="px-4 py-2.5 bg-canvas text-xs font-semibold text-muted uppercase tracking-wider">
                Nhà cung cấp
              </div>
              <div className="divide-y divide-hairline">
                {order.groups.map(g => {
                  const gs = GROUP_STATUS[g.status] || {};
                  return (
                    <div key={g.id} className="px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
                      <span className="font-medium text-ink">{g.supplierName}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${gs.cls || 'bg-surface-2'}`}>
                        {gs.label || g.status}
                      </span>
                      {g.expectedDeliveryAt && (
                        <span className="text-xs text-muted">Giao dự kiến: {fmtDate(g.expectedDeliveryAt)}</span>
                      )}
                      {g.contactName && (
                        <span className="text-xs text-muted">
                          LH: {g.contactName}{g.contactPhone ? ` · ${g.contactPhone}` : ''}
                        </span>
                      )}
                      {g.totalAmount != null && (
                        <span className="ml-auto font-semibold text-ink">{fmtMoney(g.totalAmount)}</span>
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
              <div className="px-4 py-2.5 bg-canvas flex items-center gap-2">
                <PackageCheck size={14} className="text-gold" />
                <span className="text-xs font-semibold text-muted uppercase tracking-wider">
                  Nhận hàng — đợt mới
                </span>
              </div>
              <div className="p-4 space-y-3">
                <p className="text-xs text-muted">
                  Chỉ nhập các dòng THỰC GIAO trong đợt này. NCC giao thiếu thì để trống,
                  đợt sau nhận bù. Tích <b>“Chốt nhận”</b> khi không nhận thêm nữa (dù còn thiếu).
                </p>

                {openLines.map(i => {
                  const v = receipt[i.id] || {};
                  const remaining = num(i.orderedQuantity) - num(i.receivedQuantity);
                  return (
                    <div key={i.id} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end p-3 rounded-xl bg-canvas/50">
                      <div className="sm:col-span-4">
                        <div className="text-sm text-ink">{i.itemName}</div>
                        <div className="text-xs text-muted">
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
                        <label className="inline-flex items-center gap-2 text-sm text-ink cursor-pointer py-2.5">
                          <input type="checkbox" checked={!!v.closeLine}
                            onChange={e => setReceipt(s => ({ ...s, [i.id]: { ...s[i.id], closeLine: e.target.checked } }))}
                            className="rounded border-hairline-3 text-gold focus:ring-gold" />
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
              <div className="px-4 py-2.5 bg-canvas text-xs font-semibold text-muted uppercase tracking-wider">
                Lịch sử nhận hàng
              </div>
              <div className="divide-y divide-hairline">
                {order.receipts.map(r => (
                  <div key={r.id} className="px-4 py-3">
                    <div className="flex items-center gap-3 text-sm">
                      <span className="font-medium text-ink">Đợt {r.sequenceNo}</span>
                      <span className="text-xs text-muted">{fmtDateTime(r.receivedAt)}</span>
                      <span className="text-xs text-muted">{r.receivedByName}</span>
                    </div>
                    <div className="mt-1.5 text-xs text-muted">
                      {r.items.map(li => `${li.itemName}: ${fmtQty(li.qty)} ${li.unit}`).join(' · ')}
                    </div>
                    {r.notes && <div className="mt-1 text-xs text-muted italic">{r.notes}</div>}
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
    // KHÔNG lọc thêm theo `w.assigned` ở đây: BE đã trả về ĐÚNG danh sách kho
    // user được thao tác rồi. Lọc lại lần nữa từng làm hỏng 2 trường hợp —
    // tài khoản Owner-like (BE trả cả 2 kho nhưng cờ assigned = false) và bất kỳ
    // ai mà cờ assigned chưa kịp đúng — đều ra màn hình "chưa được gán kho".
    supplyWarehouseApi.myWarehouses()
      .then(list => setWarehouses(list || []))
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
    <div className="p-4 sm:p-6 lg:p-8 space-y-5">
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
        <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/28">
          <AlertTriangle size={16} className="text-amber-600 dark:text-amber-300 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-amber-800 dark:text-amber-300">
            Bạn chưa được gán kho văn phòng phẩm nào nên chưa tạo phiếu được.
            Vui lòng liên hệ chủ doanh nghiệp để được phân quyền kho.
          </p>
        </div>
      )}

      {/* Bộ lọc gom vào một thẻ trắng: trước đây TabBar và ô tìm kiếm nằm trần
          trên nền, cao thấp khác nhau nên nhìn rời rạc. Ô tìm kiếm cũng bị kéo
          giãn hết chiều ngang màn hình — nay giới hạn bề rộng lại. */}
      <div className="bg-surface rounded-2xl border border-hairline shadow-sm p-3
                      flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="min-w-0 overflow-x-auto">
          <TabBar tabs={tabs} active={status} onChange={setStatus} />
        </div>
        <div className="relative w-full lg:w-72 lg:ml-auto flex-shrink-0">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Tìm mã phiếu, tên mặt hàng…" className={`${inputCls} pl-9`} />
        </div>
      </div>

      {orders == null ? <LoadingSpinner label="Đang tải phiếu…" />
        : orders.length === 0 ? (
          <SectionCard>
            <EmptyState icon={Package} title="Chưa có phiếu nào"
              description="Bấm “Tạo phiếu” để đặt văn phòng phẩm / đồ dùng." />
          </SectionCard>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {orders.map(o => (
                <div key={o.id}
                  className="bg-surface rounded-2xl border border-hairline shadow-sm p-4 hover:border-gold/40 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <button onClick={() => setDetailId(o.id)} className="text-left min-w-0 flex-1">
                      <div className="font-semibold text-ink">{o.requestCode}</div>
                      <div className="text-xs text-muted mt-0.5 inline-flex items-center gap-1.5">
                        <Warehouse size={12} /> {o.supplyWarehouseName || '—'} · {fmtDate(o.createdAt)}
                      </div>
                    </button>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Còn NEW thì vẫn sửa được — kế toán chưa xử lý gì cả */}
                      {o.status === 'NEW' && (
                        <button onClick={() => openEdit(o.id)} title="Sửa phiếu"
                          className="p-1.5 rounded-lg text-muted hover:text-gold hover:bg-canvas">
                          <Pencil size={14} />
                        </button>
                      )}
                      <StatusPill status={o.status} />
                    </div>
                  </div>

                  <button onClick={() => setDetailId(o.id)} className="text-left w-full">
                    <div className="mt-2.5 text-sm text-muted line-clamp-2">
                      {o.items.map(i => `${i.itemName} × ${fmtQty(i.orderedQuantity)} ${i.unit}`).join(' · ')}
                    </div>
                    {o.grandTotal > 0 && (
                      <div className="mt-2 text-sm font-semibold text-ink">
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
