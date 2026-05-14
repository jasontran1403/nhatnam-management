// src/pages/operator/OperatorProductBatchPage.jsx
import ReactDOM from 'react-dom';
import { useState, useEffect, useRef } from 'react';
import { operatorApi } from '../../api/operatorApi';
import { useToast } from '../../components/common/Toast';
import {
  Plus, Trash2, X, Package, ChevronDown, ChevronUp,
  ImagePlus, Send, Info,
} from 'lucide-react';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:9261';
const VAT_RATES = [0, 5, 8, 10];

const emptyItem = () => ({
  _id: Date.now() + Math.random(),
  existingProductId: null,
  name: '', categoryName: '', unit: '',
  basePrice: '', maxDiscountRate: 0,
  vatRate: 8, vatMode: 'INCLUSIVE',  // mặc định, không đổi
  imageUrl: '',
  tiers: [{ _id: Date.now(), fromQty: 0, price: '' }],  // tier đầu mặc định
  ingredients: [],
  _expanded: true,
  _uploading: false,
});

const emptyTier = () => ({
  _id: `tier-${Date.now()}-${Math.random()}`,
  fromQty: '',
  price: '',
});

export default function OperatorProductBatchPage() {
  const toast = useToast();
  const [batchType, setBatchType] = useState('CREATE');
  const [note, setNote] = useState('');
  const [items, setItems] = useState([emptyItem()]);
  const [categories, setCategories] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [products, setProducts] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      operatorApi.getCategories(),
      operatorApi.getIngredients(),
      operatorApi.getProducts(),
    ]).then(([c, i, p]) => {
      setCategories(c.data?.data || []);
      setIngredients(i.data?.data || []);
      setProducts(p.data?.data || []);
    }).catch(() => { });
  }, []);

  const setItem = (id, patch) =>
    setItems(prev => prev.map(it => it._id === id ? { ...it, ...patch } : it));
  const removeItem = (id) => setItems(prev => prev.filter(it => it._id !== id));
  const addItem = () => setItems(prev => [...prev, emptyItem()]);
  const toggleExpand = (id) => setItem(id, { _expanded: !items.find(i => i._id === id)?._expanded });

  const handleUpload = async (itemId, file) => {
    if (!file) return;
    setItem(itemId, { _uploading: true });
    try {
      const fd = new FormData(); fd.append('image', file);
      const res = await window.fetch(`${BASE_URL}/api/upload/product-image`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: fd,
      });
      const json = await res.json();
      setItem(itemId, { imageUrl: json?.data?.imageUrl || '', _uploading: false });
    } catch { toast('Lỗi upload ảnh', 'error'); setItem(itemId, { _uploading: false }); }
  };

  const selectExistingProduct = (itemId, productId) => {
    if (!productId) { setItem(itemId, { existingProductId: null }); return; }
    const p = products.find(p => String(p.id) === String(productId));
    if (!p) return;

    const mappedTiers = (p.tiers || []).map(t => ({
      _id: Date.now() + Math.random(),
      fromQty: t.minQuantity != null ? String(t.minQuantity) : '0',
      price: t.price != null ? String(t.price) : '',
    }));


    const mappedIngredients = (p.ingredients || []).map(ing => ({
      _id: Date.now() + Math.random(),
      ingredientId: String(ing.ingredientId || ''),
      quantity: ing.quantity != null ? ing.quantity : 1,
      canOverride: ing.canOverride || false,
    }));

    setItem(itemId, {
      existingProductId: p.id,
      name: p.name || '',
      categoryName: p.category || '',
      unit: p.unit || 'kg',
      basePrice: p.basePrice != null ? String(p.basePrice) : '',
      maxDiscountRate: p.maxDiscountRate ?? 0,
      vatRate: p.vatRate ?? 8,
      vatMode: p.vatMode || 'INCLUSIVE',
      imageUrl: p.imageUrl || '',
      tiers: mappedTiers,
      ingredients: mappedIngredients,
    });
  };

  const handleSubmit = async () => {
    for (const it of items) {
      if (!it.name.trim()) return toast('Tên sản phẩm không được trống', 'error');

      if (!it.unit.trim())
        return toast(`Đơn vị tính "${it.name || 'sản phẩm ' + (idx + 1)}" không được trống`, 'error');

      const price = Number(String(it.basePrice).replace(/[^0-9]/g, ''));
      if (!price || price <= 0)
        return toast(`Giá gốc "${it.name}" không hợp lệ`, 'error');
    }

    setSubmitting(true);
    try {
      const payload = {
        type: batchType,
        note,
        items: items.map(it => ({
          existingProductId: it.existingProductId,
          name: it.name.trim(),
          categoryName: it.categoryName,
          unit: it.unit,
          basePrice: Number(String(it.basePrice).replace(/[^0-9]/g, '')),  // ← parse đúng
          maxDiscountRate: Number(it.maxDiscountRate) || 0,
          vatRate: 8,
          vatMode: 'INCLUSIVE',
          imageUrl: it.imageUrl,
          tiers: it.tiers                                                          // ← it, không phải item
            .filter(t => Number(String(t.price).replace(/[^0-9]/g, '')) > 0)
            .map((t, idx, arr) => ({
              tierName: `Khung giá ${idx + 1}`,
              minQuantity: idx === 0 ? 0 : Number(t.fromQty) || 0,
              maxQuantity: idx < arr.length - 1                                   // ← arr, không phải it.tiers
                ? Number(arr[idx + 1].fromQty) - 0.01
                : null,
              price: Number(String(t.price).replace(/[^0-9]/g, '')) || 0,
              sortOrder: idx,
            })),
          ingredients: it.ingredients
            .filter(ing => ing.ingredientId)
            .map(ing => ({
              ingredientId: Number(ing.ingredientId),
              quantity: Number(ing.quantity) || 1,
              canOverride: ing.canOverride || false,
            })),
        })),
      };

      console.log('payload:', JSON.stringify(payload, null, 2));
      await operatorApi.submitBatch(payload);

      toast('Phiếu đã gửi, chờ Admin duyệt', 'success');
      setItems([emptyItem()]);
      setNote('');
    } catch (e) {
      toast(e?.response?.data?.message || 'Lỗi gửi phiếu', 'error');
    } finally { setSubmitting(false); }
  };

  const imgSrc = (url) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    return `${BASE_URL}/api/auth${url}`;
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 bg-white border-b border-[#F0EBE3]">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-[#1C1C1E]" style={{ fontFamily: 'var(--font-display)' }}>
              Tạo phiếu sản phẩm
            </h1>
            <p className="text-xs text-[#8E8878]">Gửi cho Admin duyệt trước khi áp dụng</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Batch type toggle */}
            <div className="flex rounded-xl border border-[#E8DDD0] overflow-hidden">
              {['CREATE', 'UPDATE'].map(t => (
                <button key={t} onClick={() => {
                  setBatchType(t);
                  setItems([emptyItem()]);
                  setNote('');
                }}
                  className={`px-4 py-2 text-xs font-medium transition-colors
                    ${batchType === t ? 'bg-[#C9A84C] text-white' : 'text-[#5C5C5C] hover:bg-[#FAF7F2]'}`}>
                  {t === 'CREATE' ? 'Tạo mới' : 'Cập nhật'}
                </button>
              ))}
            </div>
            <button onClick={handleSubmit} disabled={submitting || items.length === 0}
              className="flex items-center gap-2 px-5 py-2 rounded-xl btn-gold text-sm font-medium disabled:opacity-50">
              <Send size={14} />
              {submitting ? 'Đang gửi...' : 'Gửi phiếu'}
            </button>
          </div>
        </div>
        {/* Note */}
        <div className="mt-3">
          <input value={note} onChange={e => setNote(e.target.value)}
            placeholder="Ghi chú cho phiếu (tuỳ chọn)..."
            className="w-full px-3 py-2 text-sm rounded-xl border border-[#E8DDD0] bg-[#FAF7F2] focus:outline-none focus:border-[#C9A84C]" />
        </div>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-auto p-6 space-y-4">
        {items.map((item, idx) => (
          <ProductItemCard
            key={item._id}
            item={item}
            idx={idx}
            batchType={batchType}
            categories={categories}
            ingredients={ingredients}
            products={products}
            imgSrc={imgSrc}
            onUpdate={(patch) => setItem(item._id, patch)}
            onRemove={() => removeItem(item._id)}
            onToggle={() => toggleExpand(item._id)}
            onUpload={(file) => handleUpload(item._id, file)}
            onSelectProduct={(pid) => selectExistingProduct(item._id, pid)}
          />
        ))}

        <button onClick={addItem}
          className="w-full py-3 rounded-2xl border-2 border-dashed border-[#E8DDD0] text-[#8E8878] hover:border-[#C9A84C] hover:text-[#C9A84C] transition-all flex items-center justify-center gap-2 text-sm">
          <Plus size={16} /> Thêm sản phẩm
        </button>
      </div>
    </div>
  );
}

// ── Sub-component: ProductItemCard ───────────────────────────────────────────
function ProductItemCard({ item, idx, batchType, categories, ingredients, products,
  imgSrc, onUpdate, onRemove, onToggle, onUpload, onSelectProduct }) {

  const addTier = () =>
    onUpdate({ tiers: [...item.tiers, emptyTier()] });

  const removeTier = (tid) =>
    onUpdate({ tiers: item.tiers.filter(t => t._id !== tid) });

  const setTier = (tid, patch) =>
    onUpdate({ tiers: item.tiers.map(t => t._id === tid ? { ...t, ...patch } : t) });

  const addIngredient = () => onUpdate({
    ingredients: [...item.ingredients, { _id: Date.now(), ingredientId: '', quantity: 1, canOverride: false, _searchText: '' }],
  });
  const removeIngredient = (iid) => onUpdate({ ingredients: item.ingredients.filter(i => i._id !== iid) });
  const setIng = (iid, patch) => onUpdate({
    ingredients: item.ingredients.map(i => i._id === iid ? { ...i, ...patch } : i),
  });

  return (
    <div className="bg-white rounded-2xl border border-[#F0EBE3] overflow-hidden shadow-sm">
      {/* Card Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-[#F8F5F0] bg-[#FDFAF6]">
        <div className="w-7 h-7 rounded-full bg-[#C9A84C]/15 flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-bold text-[#C9A84C]">{idx + 1}</span>
        </div>
        <span className="flex-1 text-sm font-semibold text-[#1C1C1E] truncate">
          {item.name || 'Sản phẩm mới'}
        </span>
        <button onClick={onToggle} className="p-1 text-[#8E8878] hover:text-[#1C1C1E]">
          {item._expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        <button onClick={onRemove} className="p-1 text-[#8E8878] hover:text-red-500 transition-colors">
          <Trash2 size={15} />
        </button>
      </div>

      {item._expanded && (
        <div className="p-5 space-y-5">
          {/* If UPDATE: select existing product */}
          {batchType === 'UPDATE' && (
            <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
              <label className="block text-xs font-medium text-blue-700 mb-1.5">
                <Info size={11} className="inline mr-1" />Chọn sản phẩm cần cập nhật
              </label>
              <select
                value={item.existingProductId || ''}
                onChange={e => onSelectProduct(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-blue-200 bg-white focus:outline-none focus:border-blue-400">
                <option value="">— Chọn sản phẩm —</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Left: Image */}
            <div>
              <label className="block text-xs font-medium text-[#5C5C5C] mb-1">Ảnh sản phẩm</label>
              <div className="flex items-center gap-3">
                <div className="w-20 h-20 rounded-xl border border-[#E8DDD0] bg-[#FAF7F2] flex items-center justify-center overflow-hidden flex-shrink-0">
                  {imgSrc(item.imageUrl)
                    ? <img src={imgSrc(item.imageUrl)} alt="" className="w-full h-full object-cover" />
                    : <Package size={24} className="text-[#D3CFC8]" />}
                </div>
                <label className="flex flex-col items-center gap-1 px-3 py-2 text-xs rounded-xl border border-[#E8DDD0] cursor-pointer hover:border-[#C9A84C] transition-all text-[#5C5C5C]">
                  {item._uploading
                    ? <div className="w-4 h-4 border border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
                    : <ImagePlus size={14} />}
                  {item._uploading ? 'Đang tải...' : 'Chọn ảnh'}
                  <input type="file" accept="image/*" className="hidden" onChange={e => onUpload(e.target.files[0])} />
                </label>
              </div>
            </div>

            {/* Right: Basic info */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#5C5C5C] mb-1">Tên sản phẩm *</label>
                <input value={item.name} onChange={e => onUpdate({ name: e.target.value })}
                  placeholder="Tên sản phẩm" className="w-full px-3 py-2 text-sm rounded-xl input-elegant" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-[#5C5C5C] mb-1">Danh mục</label>
                  <select value={item.categoryName} onChange={e => onUpdate({ categoryName: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl input-elegant bg-white">
                    <option value="">— Chọn —</option>
                    {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#5C5C5C] mb-1">Đơn vị *</label>
                  <input
                    value={item.unit}
                    onChange={e => onUpdate({ unit: e.target.value })}
                    placeholder="vd: kg, pkt, ea, roll..."
                    className={`w-full px-3 py-2 text-sm rounded-xl input-elegant ${!item.unit.trim() ? 'border-red-300 focus:border-red-400' : ''
                      }`}
                  />
                  {!item.unit.trim() && (
                    <p className="text-[10px] text-red-400 mt-0.5">Bắt buộc</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#5C5C5C] mb-1">Giá gốc *</label>
              <PriceInput
                value={item.basePrice}
                onChange={val => onUpdate({ basePrice: val })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#5C5C5C] mb-1">CK tối đa (%)</label>
              <input type="number" min={0} max={100} value={item.maxDiscountRate}
                onChange={e => onUpdate({ maxDiscountRate: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-xl input-elegant" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#5C5C5C] mb-1">Thuế VAT</label>
              <div className="px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#E8DDD0] text-sm text-[#8E8878]">
                8% · đã tính vào giá
              </div>
            </div>
          </div>

          {/* Price Tiers */}
          <div className="border border-[#F0EBE3] rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-[#FAF7F2]">
              <span className="text-xs font-semibold text-[#5C5C5C]">
                Khung giá sỉ
                {item.tiers.length > 0 && (
                  <span className="ml-1.5 text-[10px] text-[#C9A84C] font-normal">
                    ({item.tiers.length} khung)
                  </span>
                )}
              </span>
              <button onClick={addTier}
                className="flex items-center gap-1 text-xs text-[#C9A84C] hover:underline font-medium">
                <Plus size={12} /> Thêm khung
              </button>
            </div>

            {item.tiers.length === 0 ? (
              <p className="text-xs text-[#8E8878] italic px-4 py-3">
                Nhấn "Thêm khung" để thêm khung giá.
              </p>
            ) : (
              <div className="px-3 py-2 space-y-2">
                <div className="grid grid-cols-4 gap-2 text-[10px] font-medium text-[#8E8878] px-1">
                  <span>Tên khung</span>
                  <span>SL từ</span>
                  <span>SL đến</span>
                  <span>Giá (đ)</span>
                </div>
                {item.tiers.map((tier, ti) => {
                  const tierName = `Khung giá ${ti + 1}`;
                  const nextTier = item.tiers[ti + 1];
                  const toQtyDisplay = nextTier
                    ? (nextTier.fromQty !== '' && nextTier.fromQty !== null
                      ? `< ${Number(nextTier.fromQty).toLocaleString('vi-VN')}`
                      : '—')
                    : 'Max';

                  return (
                    <div key={tier._id}
                      className="grid grid-cols-4 gap-2 items-center p-2 bg-white rounded-xl border border-[#F0EBE3]">
                      {/* Tên: read-only, tự tính theo index */}
                      <div className="px-2 py-1.5 text-xs rounded-lg bg-[#FAF7F2] text-[#5C5C5C] font-medium truncate">
                        {tierName}
                      </div>
                      {/* SL từ: tier 0 luôn là 0 và locked */}
                      {ti === 0 ? (
                        <div className="px-2 py-1.5 text-xs rounded-lg bg-[#FAF7F2] text-[#8E8878]">0</div>
                      ) : (
                        <input
                          key={`from-${tier._id}`}
                          type="number" min={0}
                          value={tier.fromQty}
                          onChange={e => {
                            const val = e.target.value;
                            onUpdate({
                              tiers: item.tiers.map(t =>
                                t._id === tier._id ? { ...t, fromQty: val } : t
                              )
                            });
                          }}
                          className="px-2 py-1.5 text-xs rounded-lg input-elegant"
                        />
                      )}
                      {/* SL đến: luôn read-only */}
                      <div className="px-2 py-1.5 text-xs rounded-lg bg-[#FAF7F2] text-[#8E8878]">
                        {toQtyDisplay}
                      </div>

                      {/* Giá */}
                      <div className="flex items-center gap-1">
                        <PriceInput
                          key={`price-${tier._id}`}
                          value={tier.price}
                          onChange={val => {
                            onUpdate({
                              tiers: item.tiers.map(t =>
                                t._id === tier._id ? { ...t, price: val } : t
                              )
                            });
                          }}
                        />
                        {/* Chỉ hiện nút xóa ở tier cuối cùng, và không cho xóa nếu chỉ còn 1 tier */}
                        {ti === item.tiers.length - 1 && item.tiers.length > 1 && (
                          <button
                            onClick={() => onUpdate({ tiers: item.tiers.filter(t => t._id !== tier._id) })}
                            className="text-red-400 hover:text-red-600 transition-colors flex-shrink-0">
                            <Trash2 size={13} />
                          </button>
                        )}
                        {/* Placeholder để giữ layout khi không có nút xóa */}
                        {!(ti === item.tiers.length - 1 && item.tiers.length > 1) && (
                          <div className="w-[13px] flex-shrink-0" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Ingredients */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-[#5C5C5C]">Nguyên liệu</label>
              <button onClick={addIngredient} className="flex items-center gap-1 text-xs text-[#C9A84C] hover:underline">
                <Plus size={11} /> Thêm nguyên liệu
              </button>
            </div>
            {item.ingredients.length === 0 ? (
              <p className="text-xs text-[#8E8878] italic">Chưa có nguyên liệu.</p>
            ) : (
              <div className="space-y-2">
                {item.ingredients.map((ing) => (
                  <div key={ing._id} className="grid grid-cols-4 gap-2 items-center p-2 bg-[#FAF7F2] rounded-xl border border-[#F0EBE3]">
                    <IngredientSelect
                      ingredients={ingredients}
                      value={ing.ingredientId}
                      onChange={val => setIng(ing._id, { ingredientId: val })}
                    />
                    <input
                      type="number" min={0.001} step={0.001} value={ing.quantity}
                      onChange={e => setIng(ing._id, { quantity: e.target.value })}
                      placeholder="Số lượng"
                      className="px-2 py-1.5 text-xs rounded-lg input-elegant"
                    />
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1 text-[10px] text-[#5C5C5C] cursor-pointer select-none">
                        <input type="checkbox" checked={ing.canOverride}
                          onChange={e => setIng(ing._id, { canOverride: e.target.checked })}
                          className="rounded" />
                        Linh hoạt
                      </label>
                      <button onClick={() => removeIngredient(ing._id)}
                        className="ml-auto text-red-400 hover:text-red-600">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PriceInput({ value, onChange }) {
  const [focused, setFocused] = useState(false);

  const rawNum = String(value ?? '').replace(/[^0-9]/g, '');
  const display = focused
    ? rawNum
    : rawNum ? Number(rawNum).toLocaleString('vi-VN') : '';

  return (
    <input
      type="text"
      inputMode="numeric"
      value={display}
      placeholder="0"
      onFocus={e => { setFocused(true); e.target.select(); }}
      onBlur={() => setFocused(false)}
      onChange={e => onChange(e.target.value.replace(/[^0-9]/g, ''))}
      className="w-full px-2 py-1.5 text-xs rounded-lg input-elegant text-right"
    />
  );
}

function IngredientSelect({ ingredients, value, onChange }) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef(null);
  const inputRef = useRef(null);

  const selected = ingredients.find(i => String(i.id) === String(value));
  const filtered = !search
    ? ingredients
    : ingredients.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));

  const openDropdown = (e) => {
    e.preventDefault();
    if (!open) {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const dropHeight = 260; // max-h-52 ~208px + search ~52px

      const goUp = spaceBelow < dropHeight && spaceAbove > spaceBelow;

      setDropPos({
        top: goUp
          ? rect.top + window.scrollY - dropHeight - 4   // dropup
          : rect.bottom + window.scrollY + 4,             // dropdown
        left: rect.left + window.scrollX,
        width: Math.max(rect.width, 280),
      });
    }
    setOpen(v => !v);
  };


  useEffect(() => {
    if (!open) return;
    setTimeout(() => inputRef.current?.focus(), 50);
    const handler = (e) => {
      if (triggerRef.current && !triggerRef.current.contains(e.target)) {
        const portal = document.getElementById('ing-dropdown-portal');
        if (portal && portal.contains(e.target)) return;
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const dropdown = open && (
    <div
      id="ing-dropdown-portal"
      style={{ position: 'fixed', top: dropPos.top, left: dropPos.left, width: dropPos.width, zIndex: 9999 }}
      className="bg-white rounded-xl shadow-2xl border border-[#E8DDD0] flex flex-col overflow-hidden"
    >
      <div className="p-2 border-b border-[#F0EBE3]">
        <input
          ref={inputRef}
          value={search}
          onChange={e => setSearch(e.target.value)}
          onMouseDown={e => e.stopPropagation()}
          placeholder="Tìm nguyên liệu..."
          className="w-full px-2 py-1.5 text-xs rounded-lg border border-[#E8DDD0] focus:outline-none focus:border-[#C9A84C] bg-[#FAF7F2]"
        />
      </div>
      <div className="overflow-y-auto max-h-52">
        {filtered.length === 0 ? (
          <p className="text-xs text-[#8E8878] text-center py-4 italic">Không tìm thấy</p>
        ) : filtered.map(i => (
          <div
            key={i.id}
            onMouseDown={e => {
              e.preventDefault();
              onChange(String(i.id));
              setOpen(false);
              setSearch('');
            }}
            className={`flex items-center justify-between px-3 py-2 text-xs cursor-pointer transition-colors
              ${String(i.id) === String(value)
                ? 'bg-[#C9A84C]/10 text-[#C9A84C] font-semibold'
                : 'hover:bg-[#FAF7F2] text-[#1C1C1E]'
              }`}
          >
            <span className="truncate mr-2">{i.name}</span>
            <span className="text-[10px] text-[#8E8878] flex-shrink-0 bg-[#F0EBE3] px-1.5 py-0.5 rounded-full">{i.unit}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <>
      <div ref={triggerRef} className="relative col-span-2">
        <div
          onMouseDown={openDropdown}
          className="flex items-center gap-1 w-full px-2 py-1.5 text-xs rounded-lg input-elegant bg-white cursor-pointer select-none"
        >
          <span className="flex-1 truncate text-left text-[#1C1C1E]">
            {selected
              ? `${selected.name} (${selected.unit})`
              : <span className="text-[#8E8878]">Tìm nguyên liệu...</span>
            }
          </span>
          <ChevronDown size={11} className={`text-[#8E8878] flex-shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {/* Render dropdown vào body — tránh bị clip bởi overflow:hidden */}
      {typeof document !== 'undefined' && open
        ? ReactDOM.createPortal(dropdown, document.body)
        : null
      }
    </>
  );
}