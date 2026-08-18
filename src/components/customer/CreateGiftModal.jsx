// src/components/customer/CreateGiftModal.jsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  X, Ticket, Package, Search, Plus, Minus, Trash2, Warehouse as WarehouseIcon,
  Cake, Store, Layers,
} from 'lucide-react';
import api from '../../api/axios';
import { voucherApi } from '../../api/voucherApi';
import { giftOrderApi } from '../../api/giftOrderApi';
import DatePicker from '../ui/DatePicker';
import { useToast } from '../common/Toast';
import useDebounce from '../../utils/useDebounce.js';

/**
 * TẠO QUÀ TẶNG CHO KHÁCH HÀNG — hai lựa chọn: VOUCHER hoặc SẢN PHẨM.
 *
 * <p>Gộp hai loại quà vào một modal vì với người dùng đây là một quyết định duy nhất
 * ("tặng gì cho khách này"), dù phía sau là hai luồng nghiệp vụ hoàn toàn khác nhau:
 * voucher lưu thẳng và dùng được ngay, còn phiếu sản phẩm phải qua duyệt rồi mới trừ kho.
 *
 * <p>Khác biệt quan trọng phải nói rõ trên giao diện: <b>phiếu sản phẩm KHÔNG giữ hàng</b>.
 * Số tồn hiển thị lúc chọn chỉ là tham khảo, tồn thật bị trừ ở bước OWNER duyệt — nếu
 * không nói, seller sẽ tưởng hàng đã được đặt chỗ cho khách của mình.
 *
 * @param customer khách nhận quà (bắt buộc); null = modal đóng
 * @param onClose  đóng modal
 * @param onDone   gọi sau khi tạo thành công, để màn hình cha refresh
 */
export default function CreateGiftModal({ customer, onClose, onDone }) {
  const toast = useToast();
  const [mode, setMode] = useState('VOUCHER');   // VOUCHER | PRODUCT

  if (!customer) return null;

  const isCompany = customer.customerType === 'COMPANY';
  const displayName = isCompany
    ? (customer.companyName || customer.name) : customer.name;
  const occasionLabel = isCompany ? 'Khai trương cửa hàng mới' : 'Sinh nhật';
  const OccasionIcon = isCompany ? Store : Cake;

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface w-full max-w-2xl max-h-[92vh] overflow-y-auto
                      rounded-t-3xl sm:rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-surface border-b border-hairline px-5 py-4 z-10">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-bold text-ink text-base">Tạo quà tặng</h3>
              <p className="text-xs text-muted mt-0.5 truncate">{displayName}</p>
              <span className={`inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold
                ${isCompany
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                  : 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300'}`}>
                <OccasionIcon size={10} /> {occasionLabel}
              </span>
            </div>
            <button onClick={onClose}
              className="text-muted hover:text-ink p-1.5 rounded-lg hover:bg-canvas shrink-0">
              <X size={17} />
            </button>
          </div>

          {/* Chọn loại quà */}
          <div className="grid grid-cols-2 gap-2 mt-4">
            <ModeTab active={mode === 'VOUCHER'} onClick={() => setMode('VOUCHER')}
              icon={Ticket} label="Voucher" hint="Dùng để thanh toán" />
            <ModeTab active={mode === 'PRODUCT'} onClick={() => setMode('PRODUCT')}
              icon={Package} label="Sản phẩm" hint="Cần duyệt & xuất kho" />
          </div>
        </div>

        <div className="p-5">
          {mode === 'VOUCHER'
            ? <VoucherGiftForm customer={customer} isCompany={isCompany}
                onClose={onClose} onDone={onDone} />
            : <ProductGiftForm customer={customer} isCompany={isCompany}
                onClose={onClose} onDone={onDone} />}
        </div>
      </div>
    </div>
  );
}

function ModeTab({ active, onClick, icon: Icon, label, hint }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-colors
        ${active
          ? 'bg-gold/10 border-gold text-ink'
          : 'border-line text-ink-2 hover:bg-canvas'}`}>
      <Icon size={17} className={active ? 'text-gold' : 'text-muted'} />
      <div className="min-w-0">
        <p className="text-sm font-semibold leading-tight">{label}</p>
        <p className="text-[10px] text-muted leading-tight mt-0.5">{hint}</p>
      </div>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// QUÀ TẶNG DẠNG VOUCHER
// ═══════════════════════════════════════════════════════════════════════════

const inputCls = 'w-full rounded-xl border border-line px-3 py-2 text-sm text-ink ' +
  'focus:outline-none focus:border-gold transition-colors bg-surface placeholder:text-faint';

/**
 * Voucher: hạn sử dụng, giá trị, và danh mục/sản phẩm được phép thanh toán.
 *
 * <p>Phạm vi áp dụng là MỘT trong ba (toàn bộ / danh mục / sản phẩm), không cho chọn lai
 * danh mục + sản phẩm cùng lúc: điều kiện kiểu "hoặc thuộc danh mục A hoặc là sản phẩm B"
 * rất hay bị tranh cãi ở quầy thanh toán.
 */
function VoucherGiftForm({ customer, isCompany, onClose, onDone }) {
  const toast = useToast();
  const [amount, setAmount] = useState('');
  const [validTo, setValidTo] = useState(() => Date.now() + 30 * 86400000);
  const [scope, setScope] = useState('ALL');
  const [categoryIds, setCategoryIds] = useState([]);
  const [productIds, setProductIds] = useState([]);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [catRes, prodRes] = await Promise.all([
          api.get('/api/seller/all-categories'),
          api.get('/api/seller/products'),
        ]);
        setCategories(catRes?.data?.data || []);
        const p = prodRes?.data?.data;
        setProducts(Array.isArray(p) ? p : (p?.content || []));
      } catch {
        // Không chặn form: vẫn tạo được voucher phạm vi "toàn bộ sản phẩm".
        toast('Không tải được danh mục/sản phẩm', 'error');
      }
    })();
  }, [toast]);

  const toggle = (list, setList, id) =>
    setList(list.includes(id) ? list.filter(x => x !== id) : [...list, id]);

  const handleSave = async () => {
    if (!amount || Number(amount) <= 0) { toast('Vui lòng nhập giá trị voucher', 'error'); return; }
    if (!validTo) { toast('Vui lòng chọn ngày hết hạn', 'error'); return; }
    if (scope === 'CATEGORY' && categoryIds.length === 0) {
      toast('Vui lòng chọn ít nhất 1 danh mục', 'error'); return;
    }
    if (scope === 'PRODUCT' && productIds.length === 0) {
      toast('Vui lòng chọn ít nhất 1 sản phẩm', 'error'); return;
    }

    setSaving(true);
    try {
      await voucherApi.create({
        customerId: customer.id,
        amount: Number(amount),
        validFrom: Date.now(),
        validTo,
        reason: isCompany ? 'STORE_OPENING' : 'BIRTHDAY',
        applyScope: scope,
        categoryIds: scope === 'CATEGORY' ? categoryIds : [],
        productIds: scope === 'PRODUCT' ? productIds : [],
      });
      toast('Đã tạo voucher — vào trang Quản lý voucher để in phiếu', 'success');
      onDone?.();
      onClose();
    } catch (e) {
      toast(e?.message || 'Tạo voucher thất bại', 'error');
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>Giá trị voucher (đ) *</Label>
        <input type="number" min="0" step="1000" value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder="VD: 500000" className={inputCls} />
        <div className="flex gap-1.5 mt-2 flex-wrap">
          {[200000, 500000, 1000000, 2000000].map(v => (
            <button key={v} type="button" onClick={() => setAmount(String(v))}
              className="px-2.5 py-1 rounded-lg border border-line text-[11px] text-ink-2 hover:border-gold hover:text-gold transition-colors">
              {v.toLocaleString('vi-VN')}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label>Hạn sử dụng đến ngày *</Label>
        <DatePicker value={validTo} onChange={setValidTo} placeholder="Chọn ngày hết hạn" />
      </div>

      <div>
        <Label>Được phép thanh toán cho</Label>
        <div className="flex gap-2 flex-wrap">
          {[
            { v: 'ALL', l: 'Toàn bộ sản phẩm' },
            { v: 'CATEGORY', l: 'Theo danh mục' },
            { v: 'PRODUCT', l: 'Sản phẩm cụ thể' },
          ].map(s => (
            <button key={s.v} type="button" onClick={() => setScope(s.v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors
                ${scope === s.v ? 'bg-gold text-white border-gold' : 'border-line text-ink-2 hover:bg-canvas'}`}>
              {s.l}
            </button>
          ))}
        </div>

        {scope === 'CATEGORY' && (
          <PickList items={categories} selected={categoryIds}
            onToggle={id => toggle(categoryIds, setCategoryIds, id)}
            icon={Layers} emptyText="Chưa có danh mục nào" />
        )}
        {scope === 'PRODUCT' && (
          <PickList items={products} selected={productIds}
            onToggle={id => toggle(productIds, setProductIds, id)}
            icon={Package} emptyText="Chưa có sản phẩm nào" />
        )}
      </div>

      <Actions onClose={onClose} onSave={handleSave} saving={saving} label="Tạo voucher" />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// QUÀ TẶNG DẠNG SẢN PHẨM
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Phiếu tặng sản phẩm: chọn kho → chọn hàng trong kho đó → gửi duyệt.
 *
 * <p>Chỉ hiện TÊN, ĐƠN VỊ TÍNH và SỐ LƯỢNG — cố ý không có giá. Đây là phiếu tặng,
 * không phải đơn bán; giá vốn được ghi nhận ở phiếu xuất kho sinh ra lúc duyệt.
 */
function ProductGiftForm({ customer, isCompany, onClose, onDone }) {
  const toast = useToast();
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [q, setQ] = useState('');
  const debouncedQ = useDebounce(q, 400);
  const [options, setOptions] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  /** Map productId → { productId, name, unit, quantity } */
  const [picked, setPicked] = useState({});
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        // Dùng endpoint của module quà tặng, KHÔNG dùng /api/warehouse — đường dẫn đó
        // chỉ mở cho role WAREHOUSE nên seller gọi vào sẽ nhận 401 (code 901).
        // Backend đã lọc sẵn kho đang hoạt động và loại kho trung chuyển.
        const list = await giftOrderApi.warehouses();
        setWarehouses(list || []);
        if ((list || []).length === 1) setWarehouseId(String(list[0].id));
      } catch (e) {
        toast(e?.message || 'Không tải được danh sách kho', 'error');
      }
    })();
  }, [toast]);

  const loadProducts = useCallback(async () => {
    if (!warehouseId) { setOptions([]); return; }
    setLoadingProducts(true);
    try {
      setOptions(await giftOrderApi.products(warehouseId, debouncedQ) || []);
    } catch (e) {
      toast(e?.message || 'Không tải được sản phẩm của kho', 'error');
    } finally { setLoadingProducts(false); }
  }, [warehouseId, debouncedQ, toast]);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  // Đổi kho thì bỏ hàng đã chọn: sản phẩm chọn từ kho cũ có thể không tồn tại ở kho mới,
  // giữ lại sẽ tạo phiếu xuất từ kho không có hàng đó.
  useEffect(() => { setPicked({}); }, [warehouseId]);

  const addProduct = (p) => setPicked(prev => ({
    ...prev,
    [p.id]: prev[p.id]
      ? { ...prev[p.id], quantity: prev[p.id].quantity + 1 }
      : { productId: p.id, name: p.name, unit: p.unit, quantity: 1 },
  }));

  const setQty = (id, qty) => setPicked(prev => {
    if (qty <= 0) { const n = { ...prev }; delete n[id]; return n; }
    return { ...prev, [id]: { ...prev[id], quantity: qty } };
  });

  const pickedList = useMemo(() => Object.values(picked), [picked]);

  const handleSave = async () => {
    if (!warehouseId) { toast('Vui lòng chọn kho xuất hàng', 'error'); return; }
    if (pickedList.length === 0) { toast('Vui lòng chọn ít nhất 1 sản phẩm', 'error'); return; }

    setSaving(true);
    try {
      await giftOrderApi.create({
        customerId: customer.id,
        warehouseId: Number(warehouseId),
        occasion: isCompany ? 'STORE_OPENING' : 'BIRTHDAY',
        note: note.trim() || null,
        items: pickedList.map(p => ({ productId: p.productId, quantity: p.quantity })),
      });
      toast('Đã tạo phiếu tặng quà, chờ duyệt', 'success');
      onDone?.();
      onClose();
    } catch (e) {
      toast(e?.message || 'Tạo phiếu thất bại', 'error');
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>Kho xuất hàng *</Label>
        <select value={warehouseId} onChange={e => setWarehouseId(e.target.value)}
          className={inputCls}>
          <option value="">— Chọn kho —</option>
          {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </div>

      {!warehouseId ? (
        <div className="rounded-xl border border-dashed border-line py-8 text-center">
          <WarehouseIcon size={26} className="mx-auto text-faint mb-2" />
          <p className="text-xs text-muted">Chọn kho để xem danh sách sản phẩm</p>
        </div>
      ) : (
        <>
          {/* Đã chọn */}
          {pickedList.length > 0 && (
            <div className="rounded-xl border border-gold/30 bg-gold/5 p-3 space-y-2">
              <p className="text-[11px] font-bold text-gold uppercase tracking-wider">
                Sản phẩm tặng ({pickedList.length})
              </p>
              {pickedList.map(p => (
                <div key={p.productId} className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ink truncate">{p.name}</p>
                    <p className="text-[10px] text-muted">{p.unit || '—'}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <QtyBtn onClick={() => setQty(p.productId, p.quantity - 1)}><Minus size={12} /></QtyBtn>
                    <input type="number" min="0" value={p.quantity}
                      onChange={e => setQty(p.productId, Number(e.target.value))}
                      className="w-14 text-center rounded-lg border border-line py-1 text-sm bg-surface text-ink" />
                    <QtyBtn onClick={() => setQty(p.productId, p.quantity + 1)}><Plus size={12} /></QtyBtn>
                    <button onClick={() => setQty(p.productId, 0)}
                      className="p-1.5 rounded-lg text-muted hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Chọn hàng */}
          <div>
            <Label>Sản phẩm trong kho</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={15} />
              <input value={q} onChange={e => setQ(e.target.value)}
                placeholder="Tìm sản phẩm..." className={`${inputCls} pl-9`} />
            </div>
            <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-line-soft divide-y divide-hairline">
              {loadingProducts ? (
                <p className="text-xs text-faint italic text-center py-4">Đang tải...</p>
              ) : options.length === 0 ? (
                <p className="text-xs text-faint italic text-center py-4">
                  Kho này chưa có sản phẩm khả dụng
                </p>
              ) : options.map(p => (
                <button key={p.id} type="button" onClick={() => addProduct(p)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-canvas transition-colors">
                  <Package size={13} className="text-muted shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-ink truncate">{p.name}</p>
                    <p className="text-[10px] text-faint">{p.unit || '—'}</p>
                  </div>
                  {/* Tồn chỉ để tham khảo — xem javadoc component. */}
                  <span className={`text-[10px] font-semibold shrink-0
                    ${Number(p.availableQty) > 0 ? 'text-emerald-600 dark:text-emerald-300' : 'text-red-500'}`}>
                    còn ~{p.availableQty}
                  </span>
                  <Plus size={13} className="text-gold shrink-0" />
                </button>
              ))}
            </div>
            <p className="text-[10px] text-faint mt-1.5 leading-relaxed">
              Số tồn chỉ để tham khảo. Phiếu này <strong>không giữ hàng</strong> — tồn kho
              chỉ bị trừ khi quản lý duyệt phiếu.
            </p>
          </div>

          <div>
            <Label>Ghi chú</Label>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
              placeholder="VD: giao kèm đơn hàng tuần sau"
              className={`${inputCls} resize-none`} />
          </div>
        </>
      )}

      <Actions onClose={onClose} onSave={handleSave} saving={saving} label="Gửi duyệt" />
    </div>
  );
}

// ── Dùng chung ───────────────────────────────────────────────────────────────

function Label({ children }) {
  return (
    <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1.5">
      {children}
    </label>
  );
}

function QtyBtn({ children, onClick }) {
  return (
    <button onClick={onClick}
      className="w-7 h-7 rounded-lg border border-line flex items-center justify-center
                 text-ink-2 hover:border-gold hover:text-gold transition-colors">
      {children}
    </button>
  );
}

function Actions({ onClose, onSave, saving, label }) {
  return (
    <div className="flex gap-2 pt-1">
      <button onClick={onClose}
        className="flex-1 py-2.5 rounded-xl border border-line text-sm font-semibold text-ink-2 hover:bg-canvas transition-colors">
        Huỷ
      </button>
      <button onClick={onSave} disabled={saving}
        className="flex-1 py-2.5 rounded-xl bg-gold text-white text-sm font-semibold hover:bg-gold-deep disabled:opacity-50 transition-colors">
        {saving ? 'Đang lưu...' : label}
      </button>
    </div>
  );
}

function PickList({ items, selected, onToggle, icon: Icon, emptyText }) {
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter(i => (i.name || '').toLowerCase().includes(needle));
  }, [items, q]);

  return (
    <div className="mt-2 space-y-2">
      <input value={q} onChange={e => setQ(e.target.value)}
        placeholder="Lọc nhanh..." className={`${inputCls} text-xs`} />
      <div className="max-h-40 overflow-y-auto rounded-xl border border-line-soft divide-y divide-hairline">
        {filtered.length === 0 ? (
          <p className="text-xs text-faint italic text-center py-3">{emptyText}</p>
        ) : filtered.map(i => {
          const active = selected.includes(i.id);
          return (
            <button key={i.id} type="button" onClick={() => onToggle(i.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors
                ${active ? 'bg-gold/15 text-ink' : 'hover:bg-canvas text-ink-2'}`}>
              <input type="checkbox" checked={active} readOnly className="rounded accent-gold" />
              {Icon && <Icon size={11} className="text-muted shrink-0" />}
              <span className="truncate">{i.name}</span>
            </button>
          );
        })}
      </div>
      {selected.length > 0 && (
        <p className="text-[11px] text-gold font-medium">Đã chọn {selected.length} mục</p>
      )}
    </div>
  );
}
