// src/pages/operator/OperatorProductBatchPage.jsx
import ReactDOM from 'react-dom';
import { useState, useEffect, useRef } from 'react';
import { operatorApi } from '../../api/operatorApi';
import { useToast } from '../../components/common/Toast';
import {
  Plus, Trash2, X, Package, ChevronDown, ChevronUp,
  ImagePlus, Send, Info, Box,
} from 'lucide-react';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:9261';
const VAT_RATES = [0, 5, 8, 10];
const UNITS = ['Kg', 'Gr', 'Lít', 'ml', 'Cái', 'Hộp', 'Cây', 'Bó', 'Túi', 'Gói', 'Chai', 'Lon', 'Phần'];

const emptyIngredient = () => ({
  _id: Date.now() + Math.random(),
  ingredientId: '',
  quantity: 1,
  canOverride: false,
});

const emptyItem = () => ({
  _id: Date.now() + Math.random(),
  existingProductId: null,
  name: '', categoryName: '', unit: '',
  basePrice: '', maxDiscountRate: 0,
  vatRate: 8, vatMode: 'INCLUSIVE',
  imageUrl: '',
  unitsPerBox: '',
  tiers: [{ _id: `tier-${Date.now()}`, fromQty: 0, price: '' }],

  // sửa đoạn này
  ingredients: [emptyIngredient()],

  _expanded: true,
  _uploading: false,
});

const emptyTier = () => ({
  _id: `tier-${Date.now()}-${Math.random()}`,
  fromQty: '',
  price: '',
});

// ── Helper ───────────────────────────────────────────────────────────────────
const fmtNum = (v) => {
  const n = parseInt(String(v ?? '').replace(/[^0-9]/g, ''), 10);
  return isNaN(n) ? '' : n.toLocaleString('vi-VN');
};

// ── Main Page ────────────────────────────────────────────────────────────────
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
  const removeItem = (id) => {
    setItems(prev => {
      if (prev.length <= 1) return prev;
      return prev.filter(it => it._id !== id);
    });
  };
  const addItem = () => setItems(prev => [...prev, emptyItem()]);
  const toggleExpand = (id) =>
    setItem(id, { _expanded: !items.find(i => i._id === id)?._expanded });

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
    } catch {
      toast('Lỗi upload ảnh', 'error');
      setItem(itemId, { _uploading: false });
    }
  };

  const selectExistingProduct = (itemId, productId) => {
    if (!productId) { setItem(itemId, { existingProductId: null }); return; }
    const p = products.find(p => String(p.id) === String(productId));
    if (!p) return;
    setItem(itemId, {
      existingProductId: p.id,
      name: p.name || '',
      categoryName: p.category || '',
      unit: p.unit || '',
      basePrice: p.basePrice != null ? String(p.basePrice) : '',
      maxDiscountRate: p.maxDiscountRate ?? 0,
      vatRate: p.vatRate ?? 8,
      vatMode: p.vatMode || 'INCLUSIVE',
      imageUrl: p.imageUrl || '',
      unitsPerBox: p.unitsPerBox ? String(p.unitsPerBox) : '',
      tiers: (p.tiers || []).map(t => ({
        _id: `tier-${Date.now()}-${Math.random()}`,
        fromQty: t.minQuantity != null ? String(t.minQuantity) : '0',
        price: t.price != null ? String(t.price) : '',
      })),
      ingredients:
        (p.ingredients || []).length > 0
          ? (p.ingredients || []).map(ing => ({
            _id: Date.now() + Math.random(),
            ingredientId: String(ing.ingredientId || ''),
            quantity: ing.quantity != null ? ing.quantity : 1,
            canOverride: ing.canOverride || false,
          }))
          : [emptyIngredient()],
    });
  };

  const handleSubmit = async () => {
    for (const it of items) {
      if (!it.name.trim()) return toast('Tên sản phẩm không được trống', 'error');
      if (!it.unit.trim()) return toast(`Đơn vị tính của "${it.name}" không được trống`, 'error');
      const price = Number(String(it.basePrice).replace(/[^0-9]/g, ''));
      if (!price || price <= 0) return toast(`Giá gốc "${it.name}" không hợp lệ`, 'error');
    }
    setSubmitting(true);
    try {
      const payload = {
        type: batchType,
        note,
        items: items.map(it => {
          // Đảm bảo basePrice luôn = tiers[0].price nếu có tier
          const resolvedBasePrice = it.tiers.length > 0 && it.tiers[0].price
            ? Number(String(it.tiers[0].price).replace(/[^0-9]/g, ''))
            : Number(String(it.basePrice).replace(/[^0-9]/g, ''));
          return {
            existingProductId: it.existingProductId,
            name: it.name.trim(),
            categoryName: it.categoryName,
            unit: it.unit,
            basePrice: resolvedBasePrice,
            maxDiscountRate: Number(it.maxDiscountRate) || 0,
            vatRate: it.vatRate ?? 8,
            vatMode: it.vatMode || 'INCLUSIVE',
            imageUrl: it.imageUrl,
            unitsPerBox: it.unitsPerBox ? parseInt(it.unitsPerBox, 10) : null,
            tiers: it.tiers
              .filter(t => Number(String(t.price).replace(/[^0-9]/g, '')) > 0)
              .map((t, idx, arr) => ({
                tierName: `Khung giá ${idx + 1}`,
                minQuantity: idx === 0 ? 0 : Number(t.fromQty) || 0,
                maxQuantity: idx < arr.length - 1 ? Number(arr[idx + 1].fromQty) - 0.01 : null,
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
          };
        }),
      };
      await operatorApi.submitBatch(payload);
      toast('Phiếu đã được gửi thành công!', 'success');
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
    <div className="h-full flex flex-col overflow-hidden bg-[#F9F6F1]">
      {/* ── Header ── */}
      <div className="flex-shrink-0 px-6 py-4 bg-white border-b border-[#EDE8E0]">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-lg font-bold text-[#1C1C1E]" style={{ fontFamily: 'var(--font-display)' }}>
              Tạo phiếu sản phẩm
            </h1>
            <p className="text-xs text-[#8E8878] mt-0.5">Gửi cho Admin duyệt trước khi áp dụng</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Toggle Tạo mới / Cập nhật */}
            <div className="flex rounded-xl border border-[#E8DDD0] overflow-hidden bg-[#FAF7F2]">
              {['CREATE', 'UPDATE'].map(t => (
                <button key={t}
                  onClick={() => { setBatchType(t); setItems([emptyItem()]); setNote(''); }}
                  className={`px-4 py-2 text-xs font-semibold transition-colors
                    ${batchType === t ? 'bg-[#C9A84C] text-white' : 'text-[#8E8878] hover:text-[#1C1C1E]'}`}>
                  {t === 'CREATE' ? 'Tạo mới' : 'Cập nhật'}
                </button>
              ))}
            </div>
            <button onClick={handleSubmit} disabled={submitting || items.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#C9A84C] hover:bg-[#A07830] text-white text-xs font-semibold disabled:opacity-50 transition-colors">
              <Send size={13} />
              {submitting ? 'Đang gửi...' : 'Gửi phiếu'}
            </button>
          </div>
        </div>
        <div className="mt-3">
          <input value={note} onChange={e => setNote(e.target.value)}
            placeholder="Ghi chú cho phiếu (tuỳ chọn)..."
            className="w-full px-3 py-2 text-sm rounded-xl border border-[#E8DDD0] bg-[#FAF7F2] focus:outline-none focus:border-[#C9A84C]" />
        </div>
      </div>

      {/* ── Item list ── */}
      <div className="flex-1 overflow-auto p-5 space-y-4">
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
          className="w-full py-3 rounded-2xl border-2 border-dashed border-[#D8D0C4] text-[#8E8878]
            hover:border-[#C9A84C] hover:text-[#C9A84C] transition-all flex items-center justify-center gap-2 text-sm font-medium bg-white">
          <Plus size={15} /> Thêm sản phẩm
        </button>
      </div>
    </div>
  );
}

// ── ProductItemCard ───────────────────────────────────────────────────────────
function ProductItemCard({ item, idx, batchType, categories, ingredients, products,
  imgSrc, onUpdate, onRemove, onToggle, onUpload, onSelectProduct }) {

  const addTier = () => onUpdate({ tiers: [...item.tiers, emptyTier()] });
  const addIngredient = () => onUpdate({
    ingredients: [...item.ingredients, emptyIngredient()],
  });
  const removeIngredient = (iid) => {
    if (item.ingredients.length <= 1) return;

    onUpdate({
      ingredients: item.ingredients.filter(i => i._id !== iid)
    });
  };
  const setIng = (iid, patch) =>
    onUpdate({ ingredients: item.ingredients.map(i => i._id === iid ? { ...i, ...patch } : i) });

  // Tính giá thùng preview
  const basePrice0 = Number(String(item.tiers[0]?.price ?? item.basePrice ?? '').replace(/[^0-9]/g, ''));
  const unitsPerBoxNum = parseInt(item.unitsPerBox, 10);
  const boxPrice = !isNaN(unitsPerBoxNum) && unitsPerBoxNum > 0 && basePrice0 > 0
    ? basePrice0 * unitsPerBoxNum : null;

  return (
    <div className="bg-white rounded-2xl border border-[#EDE8E0] shadow-sm overflow-hidden">
      {/* Card header */}
      <div className="flex items-center gap-3 px-5 py-3 bg-[#FDFAF6] border-b border-[#F0EBE3]">
        <div className="w-6 h-6 rounded-full bg-[#C9A84C]/20 flex items-center justify-center flex-shrink-0">
          <span className="text-[11px] font-bold text-[#C9A84C]">{idx + 1}</span>
        </div>
        <span className="flex-1 text-sm font-semibold text-[#1C1C1E] truncate">
          {item.name || <span className="text-[#B0A898] font-normal">Sản phẩm mới</span>}
        </span>
        {item.unitsPerBox && parseInt(item.unitsPerBox) > 0 && (
          <span className="text-[10px] bg-amber-50 text-amber-600 border border-amber-200 rounded-full px-2 py-0.5 font-medium flex items-center gap-1">
            <Box size={9} /> {item.unitsPerBox} {item.unit || 'đvt'}/thùng
          </span>
        )}
        <button onClick={onToggle} className="p-1 text-[#B0A898] hover:text-[#1C1C1E] transition-colors">
          {item._expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
        <button onClick={onRemove} className="p-1 text-[#B0A898] hover:text-red-500 transition-colors">
          <Trash2 size={14} />
        </button>
      </div>

      {item._expanded && (
        <div className="p-5 space-y-5">

          {/* Chọn sản phẩm cập nhật */}
          {batchType === 'UPDATE' && (
            <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
              <label className="block text-xs font-semibold text-blue-700 mb-1.5 flex items-center gap-1">
                <Info size={11} /> Chọn sản phẩm cần cập nhật
              </label>
              <select value={item.existingProductId || ''}
                onChange={e => onSelectProduct(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-blue-200 bg-white focus:outline-none focus:border-blue-400">
                <option value="">— Chọn sản phẩm —</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}

          {/* ── Row 1: Ảnh + Tên + Danh mục + Đơn vị ── */}
          <div className="flex gap-4">
            {/* Ảnh */}
            <div className="flex-shrink-0">
              <label className="block text-xs font-semibold text-[#5C5C5C] mb-1.5">Ảnh</label>
              <label className="relative w-20 h-20 rounded-xl border-2 border-dashed border-[#E8DDD0] bg-[#FAF7F2]
                flex items-center justify-center cursor-pointer hover:border-[#C9A84C] transition-all overflow-hidden group">
                {imgSrc(item.imageUrl)
                  ? <>
                    <img src={imgSrc(item.imageUrl)} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <ImagePlus size={16} className="text-white" />
                    </div>
                  </>
                  : item._uploading
                    ? <div className="w-5 h-5 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
                    : <div className="flex flex-col items-center gap-1 text-[#C4B9A8]">
                      <ImagePlus size={18} />
                      <span className="text-[10px]">Chọn ảnh</span>
                    </div>
                }
                <input type="file" accept="image/*" className="hidden"
                  onChange={e => onUpload(e.target.files[0])} />
              </label>
            </div>

            {/* Tên + Danh mục + Đơn vị */}
            <div className="flex-1 grid grid-cols-1 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#5C5C5C] mb-1">
                  Tên sản phẩm <span className="text-red-400">*</span>
                </label>
                <input value={item.name} onChange={e => onUpdate({ name: e.target.value })}
                  placeholder="Ví dụ: Sốt dừa Nhất Nam"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-[#E8DDD0] focus:outline-none focus:border-[#C9A84C] bg-white" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#5C5C5C] mb-1">Danh mục</label>
                  <select value={item.categoryName} onChange={e => onUpdate({ categoryName: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-[#E8DDD0] bg-white focus:outline-none focus:border-[#C9A84C]">
                    <option value="">— Chọn —</option>
                    {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#5C5C5C] mb-1">
                    Đơn vị tính <span className="text-red-400">*</span>
                  </label>
                  <select value={item.unit}
                    onChange={e => onUpdate({ unit: e.target.value, unitsPerBox: '' })}
                    className={`w-full px-3 py-2 text-sm rounded-xl border bg-white focus:outline-none focus:border-[#C9A84C]
                      ${!item.unit ? 'border-red-300' : 'border-[#E8DDD0]'}`}>
                    <option value="">— Chọn —</option>
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* ── Row 2: Giá + CK + VAT rate + VAT mode ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#5C5C5C] mb-1">
                Giá gốc (đ) <span className="text-red-400">*</span>
              </label>
              <PriceInput value={item.basePrice} onChange={val => {
                // Đồng bộ giá gốc → khung giá 1 (tiers[0])
                const updatedTiers = item.tiers.length > 0
                  ? item.tiers.map((t, i) => i === 0 ? { ...t, price: val } : t)
                  : item.tiers;
                onUpdate({ basePrice: val, tiers: updatedTiers });
              }} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#5C5C5C] mb-1">CK tối đa (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={item.maxDiscountRate}
                onFocus={(e) => {
                  requestAnimationFrame(() => e.target.select());
                }}
                onMouseUp={(e) => e.preventDefault()}
                onChange={e => onUpdate({ maxDiscountRate: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-xl border border-[#E8DDD0] bg-white focus:outline-none focus:border-[#C9A84C]" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#5C5C5C] mb-1">Thuế VAT (%)</label>
              <select value={item.vatRate} onChange={e => onUpdate({ vatRate: Number(e.target.value) })}
                className="w-full px-3 py-2 text-sm rounded-xl border border-[#E8DDD0] bg-white focus:outline-none focus:border-[#C9A84C]">
                {VAT_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#5C5C5C] mb-1">Kiểu VAT</label>
              <select value={item.vatMode} onChange={e => onUpdate({ vatMode: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-xl border border-[#E8DDD0] bg-white focus:outline-none focus:border-[#C9A84C]">
                <option value="INCLUSIVE">VAT trong giá</option>
                <option value="EXCLUSIVE">VAT tính thêm</option>
              </select>
            </div>
          </div>

          {/* ── Row 3: Quy cách thùng ── */}
          <div className="rounded-xl border border-[#E8DDD0] overflow-hidden">
            {/* Toggle header */}
            <button type="button"
              onClick={() => onUpdate({ unitsPerBox: item.unitsPerBox ? '' : '1' })}
              className="w-full flex items-center justify-between px-4 py-3 bg-[#FAF7F2] hover:bg-[#F5F0E8] transition-colors">
              <div className="flex items-center gap-2">
                <Box size={14} className="text-[#C9A84C]" />
                <span className="text-xs font-semibold text-[#1C1C1E]">Bán theo thùng / quy cách</span>
                <span className="text-[10px] text-[#B0A898]">(tuỳ chọn)</span>
              </div>
              {/* Toggle pill */}
              <div className={`w-9 h-5 rounded-full transition-colors relative flex-shrink-0
                ${item.unitsPerBox ? 'bg-[#C9A84C]' : 'bg-[#D8D0C8]'}`}>
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all
                  ${item.unitsPerBox ? 'left-4' : 'left-0.5'}`} />
              </div>
            </button>

            {/* Expanded: nhập số lượng/thùng */}
            {item.unitsPerBox !== '' && (
              <div className="px-4 py-3 bg-white border-t border-[#F0EBE3] space-y-3">
                <p className="text-[11px] text-[#8E8878]">
                  Cho phép bán nguyên thùng. Khi đặt 1 thùng, hệ thống tự nhân giá và trừ kho tương ứng.
                </p>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#5C5C5C] whitespace-nowrap font-medium">1 thùng =</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={item.unitsPerBox}
                      onFocus={(e) => {
                        requestAnimationFrame(() => e.target.select());
                      }}
                      onMouseUp={(e) => e.preventDefault()}
                      onChange={e => onUpdate({ unitsPerBox: e.target.value.replace(/[^0-9]/g, '') })}
                      placeholder="12"
                      className="w-20 px-3 py-2 text-sm font-bold text-center rounded-xl border-2 border-[#C9A84C] focus:outline-none text-[#1C1C1E] bg-[#FFFDF7]"
                    />
                    <span className="text-xs text-[#5C5C5C] font-medium">
                      {item.unit || 'đơn vị'}
                    </span>
                  </div>

                  {/* Preview giá thùng */}
                  {boxPrice && (
                    <div className="flex items-center gap-2 bg-[#FDF8ED] rounded-xl px-3 py-2 border border-[#EDD98A]">
                      <Box size={13} className="text-[#C9A84C]" />
                      <span className="text-xs text-[#8E8878]">Giá 1 thùng:</span>
                      <span className="text-sm font-bold text-[#C9A84C]">
                        {fmtNum(boxPrice)} đ
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Row 4: Khung giá sỉ ── */}
          <div className="rounded-xl border border-[#E8DDD0] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-[#FAF7F2]">
              <span className="text-xs font-semibold text-[#5C5C5C]">
                Khung giá sỉ
                <span className="ml-1.5 text-[10px] text-[#C9A84C] font-normal">
                  ({item.tiers.length} khung)
                </span>
              </span>
              <span className="text-[10px] text-[#B0A898]">Khung 1 = giá gốc</span>
              <button onClick={addTier}
                className="flex items-center gap-1 text-xs text-[#C9A84C] hover:text-[#A07830] font-semibold transition-colors">
                <Plus size={12} /> Thêm khung
              </button>
            </div>

            <div className="px-4 py-3 space-y-2">
              {/* Header row */}
              <div className="grid gap-2 text-[10px] font-semibold text-[#B0A898] uppercase tracking-wide px-1"
                style={{ gridTemplateColumns: '1fr 80px 80px 1fr 28px' }}>
                <span>Tên khung</span>
                <span className="text-center">SL từ</span>
                <span className="text-center">SL đến</span>
                <span className="text-right">Giá (đ)</span>
                <span />
              </div>

              {item.tiers.map((tier, ti) => {
                const nextTier = item.tiers[ti + 1];
                const toQtyDisplay = nextTier
                  ? (nextTier.fromQty !== '' ? `< ${Number(nextTier.fromQty).toLocaleString('vi-VN')}` : '—')
                  : 'Max';
                return (
                  <div key={tier._id}
                    className="grid gap-2 items-center bg-[#FDFAF6] rounded-xl px-3 py-2.5 border border-[#F0EBE3]"
                    style={{ gridTemplateColumns: '1fr 80px 80px 1fr 28px' }}>
                    <div className="text-xs font-medium text-[#5C5C5C] truncate px-1">
                      Khung {ti + 1}
                    </div>
                    {ti === 0
                      ? <div className="text-xs text-center text-[#B0A898] bg-[#F5F0E8] rounded-lg py-1.5">0</div>
                      :
                      <input
                        type="number"
                        min={0}
                        value={tier.fromQty}
                        onFocus={(e) => {
                          requestAnimationFrame(() => e.target.select());
                        }}
                        onMouseUp={(e) => e.preventDefault()}
                        onChange={e => onUpdate({
                          tiers: item.tiers.map(t =>
                            t._id === tier._id
                              ? { ...t, fromQty: e.target.value }
                              : t
                          )
                        })}
                        className="text-xs text-center rounded-lg border border-[#E8DDD0] py-1.5 focus:outline-none focus:border-[#C9A84C] bg-white
    [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    }
                    <div className="text-xs text-center text-[#B0A898] bg-[#F5F0E8] rounded-lg py-1.5 px-1 truncate">
                      {toQtyDisplay}
                    </div>
                    {ti === 0 ? (
                      /* Khung 1: hiển thị = giá gốc, không cho sửa */
                      <div className="relative">
                        <PriceInput value={item.basePrice} onChange={() => { }} />
                        <div className="absolute inset-0 rounded-xl bg-[#FAF7F2]/80 cursor-not-allowed" title="Giá khung 1 bằng giá gốc" />
                      </div>
                    ) : (
                      <PriceInput value={tier.price}
                        onChange={val => onUpdate({
                          tiers: item.tiers.map(t => t._id === tier._id ? { ...t, price: val } : t)
                        })} />
                    )}
                    <div className="flex justify-center">
                      {ti === item.tiers.length - 1 && item.tiers.length > 1
                        ? <button onClick={() => onUpdate({ tiers: item.tiers.filter(t => t._id !== tier._id) })}
                          className="text-[#D8D0C4] hover:text-red-500 transition-colors">
                          <Trash2 size={13} />
                        </button>
                        : <div className="w-[13px]" />
                      }
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Row 5: Nguyên liệu ── */}
          <div className="rounded-xl border border-[#E8DDD0] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-[#FAF7F2]">
              <span className="text-xs font-semibold text-[#5C5C5C]">
                Nguyên liệu
                {item.ingredients.length > 0 && (
                  <span className="ml-1.5 text-[10px] text-[#C9A84C] font-normal">
                    ({item.ingredients.length})
                  </span>
                )}
              </span>
              <button onClick={addIngredient}
                className="flex items-center gap-1 text-xs text-[#C9A84C] hover:text-[#A07830] font-semibold transition-colors">
                <Plus size={12} /> Thêm nguyên liệu
              </button>
            </div>

            <div className="px-4 py-3">
              {item.ingredients.length === 0
                ? <p className="text-xs text-[#B0A898] italic text-center py-2">Chưa có nguyên liệu.</p>
                : (
                  <div className="space-y-2">
                    {/* Header */}
                    <div className="grid gap-2 text-[10px] font-semibold text-[#B0A898] uppercase tracking-wide px-1"
                      style={{ gridTemplateColumns: '1fr 80px auto 28px' }}>
                      <span>Nguyên liệu</span>
                      <span className="text-center">Số lượng</span>
                      <span className="text-center">Linh hoạt</span>
                      <span />
                    </div>
                    {item.ingredients.map((ing) => (
                      <div key={ing._id}
                        className="grid gap-2 items-center bg-[#FDFAF6] rounded-xl px-3 py-2 border border-[#F0EBE3]"
                        style={{ gridTemplateColumns: '1fr 80px auto 28px' }}>
                        <IngredientSelect
                          ingredients={ingredients}
                          value={ing.ingredientId}
                          onChange={val => setIng(ing._id, { ingredientId: val })}
                        />
                        <input
                          type="number"
                          min={0.001}
                          step={0.001}
                          value={ing.quantity}
                          onFocus={(e) => {
                            requestAnimationFrame(() => e.target.select());
                          }}
                          onMouseUp={(e) => e.preventDefault()}
                          onChange={e => setIng(ing._id, { quantity: e.target.value })}
                          className="text-xs text-center rounded-lg border border-[#E8DDD0] py-1.5 focus:outline-none focus:border-[#C9A84C] bg-white
    [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <label className="flex items-center justify-center gap-1 cursor-pointer select-none">
                          <input type="checkbox" checked={ing.canOverride}
                            onChange={e => setIng(ing._id, { canOverride: e.target.checked })}
                            className="rounded accent-[#C9A84C]" />
                        </label>
                        <button onClick={() => removeIngredient(ing._id)}
                          className="flex justify-center text-[#D8D0C4] hover:text-red-500 transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}

// ── PriceInput ────────────────────────────────────────────────────────────────
function PriceInput({ value, onChange, placeholder = '0' }) {
  const [focused, setFocused] = useState(false);

  const rawNum = String(value ?? '').replace(/[^0-9]/g, '');
  const display = focused
    ? rawNum
    : (rawNum ? Number(rawNum).toLocaleString('vi-VN') : '');

  const handleFocus = (e) => {
    setFocused(true);

    requestAnimationFrame(() => {
      e.target.select();
    });
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      value={display}
      placeholder={placeholder}
      onFocus={handleFocus}

      // thêm dòng này
      onMouseUp={(e) => e.preventDefault()}

      onBlur={() => setFocused(false)}
      onChange={e => onChange(e.target.value.replace(/[^0-9]/g, ''))}
      className="w-full px-3 py-2 text-sm rounded-xl border border-[#E8DDD0] bg-white
        focus:outline-none focus:border-[#C9A84C] text-right"
    />
  );
}

// ── IngredientSelect (portal dropdown) ───────────────────────────────────────
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
      const dropHeight = 280;
      const goUp = spaceBelow < dropHeight && rect.top > spaceBelow;
      setDropPos({
        top: goUp
          ? rect.top + window.scrollY - dropHeight - 4
          : rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: Math.max(rect.width, 260),
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
        setOpen(false); setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const dropdown = open && (
    <div id="ing-dropdown-portal"
      style={{ position: 'fixed', top: dropPos.top, left: dropPos.left, width: dropPos.width, zIndex: 9999 }}
      className="bg-white rounded-xl shadow-2xl border border-[#E8DDD0] flex flex-col overflow-hidden">
      <div className="p-2 border-b border-[#F0EBE3]">
        <input ref={inputRef} value={search}
          onChange={e => setSearch(e.target.value)}
          onMouseDown={e => e.stopPropagation()}
          placeholder="Tìm nguyên liệu..."
          className="w-full px-2 py-1.5 text-xs rounded-lg border border-[#E8DDD0]
            focus:outline-none focus:border-[#C9A84C] bg-[#FAF7F2]" />
      </div>
      <div className="overflow-y-auto max-h-52">
        {filtered.length === 0
          ? <p className="text-xs text-[#8E8878] text-center py-4 italic">Không tìm thấy</p>
          : filtered.map(i => (
            <div key={i.id}
              onMouseDown={e => { e.preventDefault(); onChange(String(i.id)); setOpen(false); setSearch(''); }}
              className={`flex items-center justify-between px-3 py-2 text-xs cursor-pointer transition-colors
                ${String(i.id) === String(value)
                  ? 'bg-[#C9A84C]/10 text-[#C9A84C] font-semibold'
                  : 'hover:bg-[#FAF7F2] text-[#1C1C1E]'}`}>
              <span className="truncate mr-2">{i.name}</span>
              <span className="text-[10px] text-[#8E8878] flex-shrink-0 bg-[#F0EBE3] px-1.5 py-0.5 rounded-full">
                {i.unit}
              </span>
            </div>
          ))
        }
      </div>
    </div>
  );

  return (
    <>
      <div ref={triggerRef}>
        <div onMouseDown={openDropdown}
          className="flex items-center gap-1 w-full px-2 py-1.5 text-xs rounded-lg border border-[#E8DDD0]
            bg-white cursor-pointer select-none hover:border-[#C9A84C] transition-colors">
          <span className="flex-1 truncate">
            {selected
              ? <span className="text-[#1C1C1E]">{selected.name} <span className="text-[#B0A898]">({selected.unit})</span></span>
              : <span className="text-[#B0A898]">Tìm nguyên liệu...</span>
            }
          </span>
          <ChevronDown size={10} className={`text-[#B0A898] flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </div>
      {typeof document !== 'undefined' && open
        ? ReactDOM.createPortal(dropdown, document.body)
        : null}
    </>
  );
}