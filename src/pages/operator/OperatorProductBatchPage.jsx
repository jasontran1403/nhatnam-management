// src/pages/operator/OperatorProductBatchPage.jsx
import ReactDOM from 'react-dom';
import { useState, useEffect, useRef } from 'react';
import { operatorApi } from '../../api/operatorApi';
import { useToast } from '../../components/common/Toast';
import {
  Plus, Trash2, X, Package, ChevronDown, ChevronUp,
  ImagePlus, Send, Info, Box, Search,
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
  name: '', 
  categoryName: '', 
  unit: '',
  basePrice: '', 
  maxDiscountRate: 0,
  vatRate: 8, 
  vatMode: 'INCLUSIVE',
  imageUrl: '',
  unitsPerBox: '',
  tiers: [{ _id: `tier-${Date.now()}`, fromQty: 0, price: '' }],
  ingredients: [emptyIngredient()],
  _expanded: true,
  _uploading: false,
});

const emptyTier = () => ({
  _id: `tier-${Date.now()}-${Math.random()}`,
  fromQty: '',
  price: '',
});

function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function OperatorProductBatchPage() {
  const toast = useToast();
  const [batchType, setBatchType] = useState('CREATE');
  const [note, setNote] = useState('');
  const [items, setItems] = useState([emptyItem()]);
  const [categories, setCategories] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [products, setProducts] = useState([]);

  const [showProductModal, setShowProductModal] = useState(false);
  const [modalItemId, setModalItemId] = useState(null);
  const [productSearch, setProductSearch] = useState('');
  const debouncedProductSearch = useDebounce(productSearch, 600);

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
    setItems(prev => prev.length <= 1 ? prev : prev.filter(it => it._id !== id));
  };

  const addItem = () => setItems(prev => [...prev, emptyItem()]);
  const toggleExpand = (id) =>
    setItem(id, { _expanded: !items.find(i => i._id === id)?._expanded });

  const openProductModal = (itemId) => {
    setModalItemId(itemId);
    setProductSearch('');
    setShowProductModal(true);
  };

  const selectExistingProduct = (itemId, productId) => {
    if (!productId) return;
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
      tiers: (p.tiers && p.tiers.length > 0) 
        ? p.tiers.map(t => ({
            _id: `tier-${Date.now()}-${Math.random()}`,
            fromQty: t.minQuantity != null ? String(t.minQuantity) : '0',
            price: t.price != null ? String(t.price) : '',
          }))
        : [{ _id: `tier-${Date.now()}`, fromQty: 0, price: String(p.basePrice || '') }],
      ingredients: (p.ingredients && p.ingredients.length > 0)
        ? p.ingredients.map(ing => ({
            _id: Date.now() + Math.random(),
            ingredientId: String(ing.ingredientId || ''),
            quantity: ing.quantity != null ? ing.quantity : 1,
            canOverride: ing.canOverride || false,
          }))
        : [emptyIngredient()],
    });

    setShowProductModal(false);
    setProductSearch('');
  };

  const handleUpload = async (itemId, file) => {
    if (!file) return;
    setItem(itemId, { _uploading: true });
    try {
      const fd = new FormData();
      fd.append('image', file);
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

  const handleSubmit = async () => {
    for (const it of items) {
      if (!it.name.trim()) return toast('Tên sản phẩm không được trống', 'error');
      if (!it.unit.trim()) return toast(`Đơn vị tính của "${it.name}" không được trống`, 'error');
      const price = Number(String(it.basePrice).replace(/[^0-9]/g, ''));
      if (!price || price <= 0) return toast(`Giá bán lẻ "${it.name}" không hợp lệ`, 'error');
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
          basePrice: Number(String(it.basePrice).replace(/[^0-9]/g, '')),
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
        })),
      };
      await operatorApi.submitBatch(payload);
      toast('Phiếu đã được gửi thành công!', 'success');
      setItems([emptyItem()]);
      setNote('');
    } catch (e) {
      toast(e?.response?.data?.message || 'Lỗi gửi phiếu', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const imgSrc = (url) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    return `${BASE_URL}/api/auth${url}`;
  };

  const filteredProducts = products.filter(p =>
    p.name?.toLowerCase().includes(debouncedProductSearch.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#F9F6F1]">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 bg-white border-b border-[#EDE8E0]">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-lg font-bold text-[#1C1C1E]">Tạo phiếu sản phẩm</h1>
            <p className="text-xs text-[#8E8878] mt-0.5">Gửi cho Admin duyệt trước khi áp dụng</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-xl border border-[#E8DDD0] overflow-hidden bg-[#FAF7F2]">
              {['CREATE', 'UPDATE'].map(t => (
                <button key={t} onClick={() => { setBatchType(t); setItems([emptyItem()]); setNote(''); }}
                  className={`px-4 py-2 text-xs font-semibold transition-colors ${batchType === t ? 'bg-[#C9A84C] text-white' : 'text-[#8E8878] hover:text-[#1C1C1E]'}`}>
                  {t === 'CREATE' ? 'Tạo mới' : 'Cập nhật'}
                </button>
              ))}
            </div>
            <button onClick={handleSubmit} disabled={submitting}
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
            onSelectProduct={() => openProductModal(item._id)}
          />
        ))}
        <button onClick={addItem}
          className="w-full py-3 rounded-2xl border-2 border-dashed border-[#D8D0C4] text-[#8E8878] hover:border-[#C9A84C] hover:text-[#C9A84C] transition-all flex items-center justify-center gap-2 text-sm font-medium bg-white">
          <Plus size={15} /> Thêm sản phẩm
        </button>
      </div>

      <ProductSearchModal
        open={showProductModal}
        onClose={() => setShowProductModal(false)}
        products={filteredProducts}
        search={productSearch}
        onSearchChange={setProductSearch}
        onSelect={(productId) => selectExistingProduct(modalItemId, productId)}
        imgSrc={imgSrc}
      />
    </div>
  );
}

// ── Product Search Modal ─────────────────────────────────────────────────────
function ProductSearchModal({ open, onClose, products, search, onSearchChange, onSelect, imgSrc }) {
  if (!open) return null;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h3 className="font-semibold text-lg">Chọn sản phẩm cần cập nhật</h3>
          <button onClick={onClose} className="text-[#8E8878] hover:text-red-500">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 border-b">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#C4B9A8]" />
            <input
              value={search}
              onChange={e => onSearchChange(e.target.value)}
              placeholder="Tìm theo tên sản phẩm..."
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-[#E8DDD0] focus:border-[#C9A84C] focus:outline-none text-sm"
              autoFocus
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto p-2">
          {products.length === 0 ? (
            <div className="text-center py-12 text-[#8E8878] italic">Không tìm thấy sản phẩm nào</div>
          ) : (
            products.map(p => (
              <div
                key={p.id}
                onClick={() => onSelect(p.id)}
                className="flex items-center gap-3 px-4 py-3 hover:bg-[#FAF7F2] rounded-xl cursor-pointer transition-colors"
              >
                {p.imageUrl && (
                  <img
                    src={imgSrc(p.imageUrl)}
                    alt={p.name}
                    className="w-10 h-10 object-cover rounded-lg"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-[#1C1C1E] truncate">{p.name}</p>
                  <p className="text-xs text-[#8E8878]">
                    {p.category} • {p.unit} • {Number(p.basePrice || 0).toLocaleString('vi-VN')}đ
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── ProductItemCard (giữ nguyên logic khung giá độc lập) ─────────────────────
function ProductItemCard({ item, idx, batchType, categories, ingredients, products,
  imgSrc, onUpdate, onRemove, onToggle, onUpload, onSelectProduct }) {

  const addTier = () => onUpdate({ tiers: [...item.tiers, emptyTier()] });
  const addIngredient = () => onUpdate({ ingredients: [...item.ingredients, emptyIngredient()] });
  const removeIngredient = (iid) => {
    if (item.ingredients.length <= 1) return;
    onUpdate({ ingredients: item.ingredients.filter(i => i._id !== iid) });
  };
  const setIng = (iid, patch) =>
    onUpdate({ ingredients: item.ingredients.map(i => i._id === iid ? { ...i, ...patch } : i) });

  return (
    <div className="bg-white rounded-2xl border border-[#EDE8E0] shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 bg-[#FDFAF6] border-b border-[#F0EBE3]">
        <div className="w-6 h-6 rounded-full bg-[#C9A84C]/20 flex items-center justify-center flex-shrink-0">
          <span className="text-[11px] font-bold text-[#C9A84C]">{idx + 1}</span>
        </div>
        <span className="flex-1 text-sm font-semibold text-[#1C1C1E] truncate">
          {item.name || <span className="text-[#B0A898] font-normal">Sản phẩm mới</span>}
        </span>
        <button onClick={onToggle} className="p-1 text-[#B0A898] hover:text-[#1C1C1E]">
          {item._expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
        <button onClick={onRemove} className="p-1 text-[#B0A898] hover:text-red-500">
          <Trash2 size={14} />
        </button>
      </div>

      {item._expanded && (
        <div className="p-5 space-y-5">
          {/* Modal Trigger */}
          {batchType === 'UPDATE' && (
            <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
              <label className="block text-xs font-semibold text-blue-700 mb-2">Chọn sản phẩm cần cập nhật</label>
              <button
                onClick={onSelectProduct}
                className="w-full px-4 py-3 bg-white border border-[#E8DDD0] hover:border-[#C9A84C] rounded-xl text-left flex items-center justify-between transition-colors"
              >
                <span>
                  {item.existingProductId 
                    ? products.find(p => p.id === item.existingProductId)?.name || 'Đã chọn' 
                    : 'Chọn sản phẩm từ danh sách...'}
                </span>
                <Search size={16} className="text-[#C9A84C]" />
              </button>
            </div>
          )}

          {/* Ảnh + Tên + Danh mục + Đơn vị */}
          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <label className="block text-xs font-semibold text-[#5C5C5C] mb-1.5">Ảnh</label>
              <label className="relative w-20 h-20 rounded-xl border-2 border-dashed border-[#E8DDD0] bg-[#FAF7F2]
                flex items-center justify-center cursor-pointer hover:border-[#C9A84C] transition-all overflow-hidden group">
                {imgSrc(item.imageUrl) ? (
                  <img src={imgSrc(item.imageUrl)} alt="" className="w-full h-full object-cover" />
                ) : item._uploading ? (
                  <div className="w-5 h-5 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-[#C4B9A8]">
                    <ImagePlus size={18} />
                    <span className="text-[10px]">Chọn ảnh</span>
                  </div>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={e => onUpload(e.target.files[0])} />
              </label>
            </div>

            <div className="flex-1 grid grid-cols-1 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#5C5C5C] mb-1">Tên sản phẩm <span className="text-red-400">*</span></label>
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
                  <label className="block text-xs font-semibold text-[#5C5C5C] mb-1">Đơn vị tính <span className="text-red-400">*</span></label>
                  <select value={item.unit} onChange={e => onUpdate({ unit: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-[#E8DDD0] bg-white focus:outline-none focus:border-[#C9A84C]">
                    <option value="">— Chọn —</option>
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Giá bán lẻ + CK + VAT */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#5C5C5C] mb-1">Giá bán lẻ (đ) <span className="text-red-400">*</span></label>
              <PriceInput value={item.basePrice} onChange={val => onUpdate({ basePrice: val })} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#5C5C5C] mb-1">CK tối đa (%)</label>
              <input type="number" min={0} max={100} value={item.maxDiscountRate}
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

          {/* Khung giá sỉ */}
          <div className="rounded-xl border border-[#E8DDD0] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-[#FAF7F2]">
              <span className="text-xs font-semibold text-[#5C5C5C]">Khung giá sỉ ({item.tiers.length} khung)</span>
              <button onClick={addTier} className="flex items-center gap-1 text-xs text-[#C9A84C] hover:text-[#A07830] font-semibold">
                <Plus size={12} /> Thêm khung
              </button>
            </div>
            <div className="px-4 py-3 space-y-2">
              {item.tiers.map((tier, ti) => {
                const nextTier = item.tiers[ti + 1];
                const toQtyDisplay = nextTier ? `< ${Number(nextTier.fromQty || 0).toLocaleString('vi-VN')}` : 'Max';
                return (
                  <div key={tier._id} className="grid gap-2 items-center bg-[#FDFAF6] rounded-xl px-3 py-2.5 border border-[#F0EBE3]"
                    style={{ gridTemplateColumns: '1fr 80px 80px 1fr 28px' }}>
                    <div className="text-xs font-medium text-[#5C5C5C]">Khung {ti + 1}</div>
                    {ti === 0 ? (
                      <div className="text-xs text-center text-[#B0A898] bg-[#F5F0E8] rounded-lg py-1.5">0</div>
                    ) : (
                      <input
                        type="number"
                        value={tier.fromQty}
                        onChange={e => onUpdate({
                          tiers: item.tiers.map(t => t._id === tier._id ? { ...t, fromQty: e.target.value } : t)
                        })}
                        className="text-xs text-center rounded-lg border border-[#E8DDD0] py-1.5 focus:outline-none focus:border-[#C9A84C]"
                      />
                    )}
                    <div className="text-xs text-center text-[#B0A898] bg-[#F5F0E8] rounded-lg py-1.5">{toQtyDisplay}</div>
                    <PriceInput
                      value={tier.price}
                      onChange={val => onUpdate({
                        tiers: item.tiers.map(t => t._id === tier._id ? { ...t, price: val } : t)
                      })}
                    />
                    {ti > 0 && (
                      <button onClick={() => onUpdate({ tiers: item.tiers.filter(t => t._id !== tier._id) })}>
                        <Trash2 size={13} className="text-red-400" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Nguyên liệu */}
          <div className="rounded-xl border border-[#E8DDD0] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-[#FAF7F2]">
              <span className="text-xs font-semibold text-[#5C5C5C]">Nguyên liệu ({item.ingredients.length})</span>
              <button onClick={addIngredient} className="flex items-center gap-1 text-xs text-[#C9A84C] hover:text-[#A07830] font-semibold">
                <Plus size={12} /> Thêm
              </button>
            </div>
            <div className="px-4 py-3">
              {item.ingredients.map((ing) => (
                <div key={ing._id} className="grid gap-2 items-center bg-[#FDFAF6] rounded-xl px-3 py-2 border border-[#F0EBE3]"
                  style={{ gridTemplateColumns: '1fr 80px auto 28px' }}>
                  <IngredientSelect
                    ingredients={ingredients}
                    value={ing.ingredientId}
                    onChange={val => setIng(ing._id, { ingredientId: val })}
                  />
                  <input
                    type="number"
                    step="0.001"
                    value={ing.quantity}
                    onChange={e => setIng(ing._id, { quantity: e.target.value })}
                    className="text-xs text-center rounded-lg border border-[#E8DDD0] py-1.5 focus:outline-none focus:border-[#C9A84C]"
                  />
                  <label className="flex justify-center">
                    <input type="checkbox" checked={ing.canOverride}
                      onChange={e => setIng(ing._id, { canOverride: e.target.checked })}
                      className="accent-[#C9A84C]" />
                  </label>
                  <button onClick={() => removeIngredient(ing._id)} className="text-red-400">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── PriceInput ────────────────────────────────────────────────────────────────
function PriceInput({ value, onChange }) {
  const [focused, setFocused] = useState(false);
  const rawNum = String(value ?? '').replace(/[^0-9]/g, '');
  const display = focused ? rawNum : (rawNum ? Number(rawNum).toLocaleString('vi-VN') : '');

  return (
    <input
      type="text"
      value={display}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={e => onChange(e.target.value.replace(/[^0-9]/g, ''))}
      className="w-full px-3 py-2 text-sm rounded-xl border border-[#E8DDD0] bg-white focus:outline-none focus:border-[#C9A84C] text-right"
    />
  );
}

// ── IngredientSelect ─────────────────────────────────────────────────────────
function IngredientSelect({ ingredients, value, onChange }) {
  const [open, setOpen] = useState(false);
  const selected = ingredients.find(i => String(i.id) === String(value));

  return (
    <div className="relative">
      <div onClick={() => setOpen(!open)} className="border border-[#E8DDD0] rounded-lg px-3 py-1.5 text-xs cursor-pointer hover:border-[#C9A84C]">
        {selected ? selected.name : 'Chọn nguyên liệu...'}
      </div>
      {open && ReactDOM.createPortal(
        <div className="fixed bg-white border border-[#E8DDD0] rounded-xl shadow-2xl z-[11000] w-80 max-h-72 overflow-auto"
          style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
          {ingredients.map(i => (
            <div key={i.id} onClick={() => { onChange(i.id); setOpen(false); }}
              className="px-4 py-2 hover:bg-[#FAF7F2] cursor-pointer text-sm">
              {i.name}
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}