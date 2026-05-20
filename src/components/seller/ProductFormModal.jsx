import { useState, useEffect, useRef } from 'react';
import { X, Plus, Trash2, Camera, Image, Search, ChevronDown, CheckCircle2, Circle } from 'lucide-react';
import { productApi, uploadApi, allIngredientApi } from '../../api/services';
import { useToast } from '../common/Toast';

const UNITS = ['Kg', 'Gr', 'Lít', 'ml', 'Cái', 'Hộp', 'Cây', 'Bó', 'Túi', 'Gói', 'Chai', 'Lon', 'Phần', 'Con'];
const VAT_RATES = [0, 5, 8, 10];

// ── Map giữa UI label và backend enum ────────────────────────────────────────
// Backend: INCLUSIVE (trong giá) | EXCLUSIVE (ngoài giá)
const UI_TO_BACKEND_VAT_MODE = { INCLUDED: 'INCLUSIVE', ADDED: 'EXCLUSIVE' };
const BACKEND_TO_UI_VAT_MODE = { INCLUSIVE: 'INCLUDED', EXCLUSIVE: 'ADDED' };

function toBackendVatMode(uiMode) {
  return UI_TO_BACKEND_VAT_MODE[uiMode] ?? 'INCLUSIVE';
}
function toUiVatMode(backendMode) {
  return BACKEND_TO_UI_VAT_MODE[backendMode] ?? 'INCLUDED';
}

// ─────────────────────────────────────────────────────────────────────────────

function formatNumber(val) {
  if (val === '' || val == null) return '';
  const n = parseInt(String(val).replace(/[^0-9]/g, ''), 10);
  return isNaN(n) ? '' : new Intl.NumberFormat('vi-VN').format(n);
}

function PriceInput({ value, onChange, placeholder, className }) {
  const [display, setDisplay] = useState(value !== '' ? formatNumber(value) : '');
  const debounceRef = useRef(null);

  useEffect(() => { setDisplay(value !== '' ? formatNumber(value) : ''); }, [value]);

  const handleChange = (e) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    setDisplay(raw === '' ? '' : new Intl.NumberFormat('vi-VN').format(parseInt(raw, 10)));
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onChange(raw === '' ? '' : parseInt(raw, 10));
    }, 300);
  };

  return (
    <input type="text" inputMode="numeric" value={display}
      onChange={handleChange} onFocus={e => e.target.select()} placeholder={placeholder} className={className} />
  );
}

function ImagePicker({ value, onChange }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const toast = useToast();

  const handleFile = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast('Chỉ chấp nhận file ảnh', 'warning'); return; }
    setUploading(true);
    try {
      const res = await uploadApi.productImage(file);
      const url = res.data?.data?.imageUrl;
      if (url) onChange(url);
      else throw new Error();
    } catch (err) {
      toast(err?.response?.data?.message || 'Upload ảnh thất bại', 'error');
    } finally { setUploading(false); }
  };

  const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
  const previewUrl = value
    ? value.startsWith('http') ? value : `${BASE_URL}/api/auth${value}`
    : null;

  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs text-[#8E8878] block font-medium">
        Ảnh sản phẩm <span className="text-red-400">*</span>
      </label>
      <div
        onClick={() => !uploading && fileRef.current?.click()}
        className="relative w-full h-36 rounded-xl border-2 border-dashed border-[#E8DDD0] bg-[#FAF8F3] flex items-center justify-center cursor-pointer overflow-hidden group hover:border-[#C9A84C] transition-colors"
      >
        {previewUrl ? (
          <>
            <img src={previewUrl} alt="preview" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <Camera size={18} className="text-white" />
              <span className="text-white text-xs font-medium">Đổi ảnh</span>
            </div>
            <button type="button"
              onClick={(e) => { e.stopPropagation(); onChange(''); }}
              className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <X size={11} />
            </button>
          </>
        ) : uploading ? (
          <div className="flex flex-col items-center gap-2 text-[#C9A84C]">
            <div className="w-6 h-6 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
            <span className="text-xs">Đang upload...</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-[#C4B9A8]">
            <Image size={28} strokeWidth={1.5} />
            <span className="text-xs">Nhấn để chọn ảnh</span>
          </div>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])} />
    </div>
  );
}

function IngredientPickerPopup({ selected, onConfirm, onClose }) {
  const [allIngredients, setAllIngredients] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [picks, setPicks] = useState(() => {
    const map = {};
    selected.forEach(s => {
      map[s.ingredientId] = { qty: s.qty ?? 1, canOverride: s.canOverride ?? false };
    });
    return map;
  });

  const toggle = (ing) => {
    setPicks(prev => {
      const next = { ...prev };
      if (next[ing.id]) delete next[ing.id];
      else next[ing.id] = { qty: 1, canOverride: false };  // ← object thay vì số
      return next;
    });
  };

  const setQty = (id, val) => {
    setPicks(prev => ({ ...prev, [id]: { ...prev[id], qty: val } }));
  };

  const toggleOverride = (id) => {
    setPicks(prev => ({
      ...prev,
      [id]: { ...prev[id], canOverride: !prev[id]?.canOverride }
    }));
  };

  useEffect(() => {
    allIngredientApi.sellerGetAll()
      .then(res => setAllIngredients(res.data?.data || []))
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);

  const filtered = allIngredients.filter(ing =>
    !search || ing.name?.toLowerCase().includes(search.toLowerCase())
  );

  const commitQty = (id, val) => {
    const n = parseFloat(parseFloat(val).toFixed(3));
    setPicks(prev => ({
      ...prev,
      [id]: { ...prev[id], qty: isNaN(n) || n <= 0 ? 1 : n }  // ← giữ nguyên canOverride
    }));
  };

  const limitDecimalInput = (e) => {
    const val = e.target.value;
    const dotIndex = val.indexOf('.');
    if (dotIndex !== -1 && val.length - dotIndex > 3 &&
      e.key !== 'Backspace' && e.key !== 'Delete' &&
      e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' &&
      e.key !== 'Tab') {
      e.preventDefault();
    }
  };

  const handleConfirm = () => {
    const result = Object.entries(picks).map(([id, val]) => {
      const ing = allIngredients.find(i => String(i.id) === String(id));
      return {
        ingredientId: Number(id),
        qty: val.qty,
        canOverride: val.canOverride ?? false,
        name: ing?.name,
        unit: ing?.unit,
      };
    });
    onConfirm(result);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col max-h-[80vh] animate-fadeIn">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#F0EBE3]">
          <h3 className="font-semibold text-[#1C1C1E] text-sm">Chọn nguyên liệu</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-[#8E8878] hover:bg-[#F0EBE3]"><X size={16} /></button>
        </div>
        <div className="px-4 py-2.5 border-b border-[#F0EBE3]">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8878]" />
            <input autoFocus type="text" placeholder="Tìm nguyên liệu..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 rounded-xl border border-[#E8DDD0] text-xs focus:outline-none focus:border-[#C9A84C] bg-[#FAF8F3]" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-2">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-xs text-[#8E8878] py-8">Không tìm thấy</p>
          ) : (
            <div className="space-y-1">
              {filtered.map(ing => {
                const isSelected = !!picks[ing.id];
                return (
                  <div key={ing.id}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors
                      ${isSelected ? 'bg-[#FDF8ED] border border-[#C9A84C]/30' : 'hover:bg-[#FAF8F3]'}`}>
                    <div onClick={() => toggle(ing)} className="shrink-0">
                      {isSelected
                        ? <CheckCircle2 size={18} className="text-[#C9A84C]" />
                        : <Circle size={18} className="text-[#D4C9B8]" />}
                    </div>
                    <div onClick={() => toggle(ing)} className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-[#1C1C1E] truncate">{ing.name}</p>
                      <p className="text-[10px] text-[#8E8878]">{ing.unit}</p>
                    </div>
                    {isSelected && (
                      <div className="shrink-0 flex items-center gap-1">
                        <input
                          type="number"
                          value={picks[ing.id]?.qty ?? 1}
                          onChange={e => setQty(ing.id, e.target.value)}
                          className="w-16 text-center border border-[#E8DDD0] rounded-lg px-2 py-1 text-xs ..."
                        />
                        <span className="text-[10px] text-[#8E8878]">{ing.unit}</span>

                        {/* Toggle canOverride */}
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); toggleOverride(ing.id); }}
                          className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-colors border ${picks[ing.id]?.canOverride
                            ? 'bg-[#FDF8ED] border-[#C9A84C] text-[#C9A84C]'
                            : 'bg-[#F0EBE3] border-transparent text-[#8E8878]'
                            }`}
                        >
                          <span>{picks[ing.id]?.canOverride ? '≈ Tỷ lệ' : '# Cố định'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="px-4 pb-4 pt-3 border-t border-[#F0EBE3] flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-2 rounded-xl border border-[#E8DDD0] text-[#8E8878] text-xs font-medium hover:bg-[#F0EBE3]">
            Huỷ
          </button>
          <button onClick={handleConfirm}
            className="flex-1 py-2 rounded-xl bg-[#C9A84C] text-white text-xs font-bold hover:bg-[#A07830]">
            Xác nhận ({Object.keys(picks).length})
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ProductFormModal
// ─────────────────────────────────────────────────────────────────────────────
export default function ProductFormModal({ product, categories, onClose, onSaved }) {
  const toast = useToast();
  const isEdit = !!product;
  const [saving, setSaving] = useState(false);
  const [showIngPicker, setShowIngPicker] = useState(false);

  // vatMode trong state UI dùng 'INCLUDED' | 'ADDED'
  // khi submit sẽ map sang 'INCLUSIVE' | 'EXCLUSIVE' cho backend
  const [form, setForm] = useState({
    name: '', unit: 'Kg', imageUrl: '',
    categoryId: null, description: '',
    vatRate: 0,
    vatMode: 'INCLUDED',   // UI value — map sang INCLUSIVE khi submit
    unitsPerBox: '',       // Số đơn vị / thùng (rỗng = không hỗ trợ bán thùng)
  });
  const [tiers, setTiers] = useState([{ fromQty: 0, price: '' }]);
  const [ingredients, setIngredients] = useState([]);

  useEffect(() => {
    if (product) {
      setForm({
        name: product.name || '',
        unit: product.unit || 'Kg',
        imageUrl: product.imageUrl || '',
        categoryId: product.categoryId || null,
        description: product.description || '',
        vatRate: product.vatRate ?? 0,
        // backend trả về INCLUSIVE/EXCLUSIVE → map về INCLUDED/ADDED cho UI
        vatMode: toUiVatMode(product.vatMode),
        unitsPerBox: product.unitsPerBox ? String(product.unitsPerBox) : '',
      });
      if (product.priceTiers?.length > 0) {
        setTiers(product.priceTiers.map(t => ({
          fromQty: t.minQuantity ?? 0,
          price: t.price ?? '',
        })));
      } else {
        setTiers([{ fromQty: 0, price: '' }]);
      }
      if (product.ingredients?.length > 0) {
        setIngredients(product.ingredients.map(i => ({
          ingredientId: i.ingredientId,
          qty: i.quantity ?? i.qty ?? 1,
          canOverride: i.canOverride ?? false,  // ← thêm
          name: i.ingredientName,
          unit: i.unit,
        })));
      }
    }
  }, [product]);

  const handleTierPrice = (idx, val) => setTiers(prev => prev.map((t, i) => i === idx ? { ...t, price: val } : t));
  const handleTierFromQty = (idx, val) => setTiers(prev => prev.map((t, i) => i === idx ? { ...t, fromQty: val } : t));
  const handleIngConfirm = (picked) => { setIngredients(picked); setShowIngPicker(false); };
  const removeIngredient = (id) => setIngredients(prev => prev.filter(i => i.ingredientId !== id));

  const updateIngQty = (id, val) => {
    // Lưu raw string để input hiển thị đúng trong lúc gõ
    setIngredients(prev => prev.map(i =>
      i.ingredientId === id ? { ...i, qty: val } : i
    ));
  };

  const commitIngQty = (id, val) => {
    const n = parseFloat(parseFloat(val).toFixed(3)); // ← làm tròn 3 chữ số
    if (isNaN(n) || n <= 0) {
      setIngredients(prev => prev.map(i =>
        i.ingredientId === id ? { ...i, qty: 1 } : i
      ));
    } else {
      setIngredients(prev => prev.map(i =>
        i.ingredientId === id ? { ...i, qty: n } : i
      ));
    }
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) { toast('Vui lòng nhập tên sản phẩm', 'warning'); return; }
    if (!form.imageUrl) { toast('Vui lòng chọn ảnh sản phẩm', 'warning'); return; }
    if (ingredients.length === 0) { toast('Vui lòng chọn ít nhất 1 nguyên liệu', 'warning'); return; }
    if (!tiers[0].price) { toast('Vui lòng nhập giá', 'warning'); return; }
    for (let i = 1; i < tiers.length; i++) {
      if (tiers[i].fromQty === '') { toast(`Thiếu số lượng bắt đầu mức giá ${i + 1}`, 'warning'); return; }
      if (!tiers[i].price) { toast(`Thiếu giá mức ${i + 1}`, 'warning'); return; }
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description?.trim() || null,
        unit: form.unit,
        imageUrl: form.imageUrl,
        categoryId: form.categoryId || null,
        vatRate: form.vatRate,
        // ✅ Map UI vatMode → backend enum trước khi gửi
        vatMode: toBackendVatMode(form.vatMode),
        basePrice: tiers[0].price || 0,
        unitsPerBox: form.unitsPerBox ? parseInt(form.unitsPerBox, 10) : null,
        tiers: tiers.map((t, idx) => ({
          tierName: idx === 0 ? 'Mặc định' : `Từ ${t.fromQty}`,
          minQuantity: parseFloat(t.fromQty) || 0,
          maxQuantity: idx < tiers.length - 1
            ? parseFloat(tiers[idx + 1].fromQty) - 0.01
            : null,
          price: parseFloat(t.price) || 0,
        })),
        ingredients: ingredients.map(i => ({
          ingredientId: i.ingredientId,
          quantity: i.qty,
          canOverride: i.canOverride ?? false,  // ← thêm
        })),
      };

      if (isEdit) {
        await productApi.update(product.id, payload);
        toast('Cập nhật sản phẩm thành công', 'success');
      } else {
        await productApi.create(payload);
        toast('Tạo sản phẩm thành công', 'success');
      }
      onSaved();
    } catch (err) {
      toast(err?.response?.data?.message || 'Lỗi khi lưu sản phẩm', 'error');
    } finally { setSaving(false); }
  };

  const limitDecimalInput = (e) => {
    const val = e.target.value;
    const dotIndex = val.indexOf('.');
    if (dotIndex !== -1 && val.length - dotIndex > 3 &&
      e.key !== 'Backspace' && e.key !== 'Delete' &&
      e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' &&
      e.key !== 'Tab') {
      e.preventDefault();
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fadeIn flex flex-col max-h-[90vh]">

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#F0EBE3]">
            <h2 className="font-semibold text-[#1C1C1E]" style={{ fontFamily: 'var(--font-display)' }}>
              {isEdit ? 'Cập nhật sản phẩm' : 'Thêm sản phẩm mới'}
            </h2>
            <button onClick={onClose} className="p-1.5 rounded-lg text-[#8E8878] hover:bg-[#F0EBE3]">
              <X size={17} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

            <ImagePicker value={form.imageUrl} onChange={(url) => setForm({ ...form, imageUrl: url })} />

            {/* Name */}
            <div>
              <label className="text-xs text-[#8E8878] mb-1 block font-medium">
                Tên sản phẩm <span className="text-red-400">*</span>
              </label>
              <input autoFocus value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ví dụ: Cua rang muối"
                className="input-elegant w-full rounded-xl px-3 py-2.5 text-sm" />
            </div>

            {/* Category */}
            {categories?.length > 0 && (
              <div>
                <label className="text-xs text-[#8E8878] mb-1 block font-medium">Danh mục</label>
                <div className="relative">
                  <select
                    value={form.categoryId || ''}
                    onChange={(e) => setForm({ ...form, categoryId: e.target.value ? Number(e.target.value) : null })}
                    className="w-full px-3 py-2 pr-8 rounded-lg border border-[#E8DDD0] text-sm bg-white appearance-none focus:outline-none focus:border-[#C9A84C]">
                    <option value="">-- Không chọn --</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8E8878] pointer-events-none" />
                </div>
              </div>
            )}

            {/* Unit */}
            <div>
              <label className="text-xs text-[#8E8878] mb-1 block font-medium">Đơn vị tính</label>
              <div className="relative">
                <select value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value, unitsPerBox: '' })}
                  className="w-full px-3 py-2 pr-8 rounded-lg border border-[#E8DDD0] text-sm bg-white appearance-none focus:outline-none focus:border-[#C9A84C]">
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
                <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8E8878] pointer-events-none" />
              </div>
            </div>

            {/* Quy cách bán thùng */}
            <div className="rounded-xl border border-[#E8DDD0] overflow-hidden">
              {/* Toggle header */}
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, unitsPerBox: f.unitsPerBox ? '' : '1' }))}
                className="w-full flex items-center justify-between px-4 py-3 bg-[#FAF7F2] hover:bg-[#F5F0E8] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">📦</span>
                  <span className="text-xs font-semibold text-[#1C1C1E]">Bán theo thùng / quy cách</span>
                </div>
                {/* Toggle pill */}
                <div className={`w-10 h-5 rounded-full transition-colors relative ${form.unitsPerBox ? 'bg-[#C9A84C]' : 'bg-[#D8D0C8]'}`}>
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${form.unitsPerBox ? 'left-5' : 'left-0.5'}`} />
                </div>
              </button>

              {/* Expanded content */}
              {form.unitsPerBox !== '' && (
                <div className="px-4 py-3 space-y-3 border-t border-[#E8DDD0] bg-white">
                  <p className="text-[11px] text-[#8E8878]">
                    Cho phép bán nguyên thùng. Giá thùng = giá {form.unit} × số {form.unit}/thùng.
                  </p>

                  {/* Input số lượng / thùng */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 flex-1">
                      <span className="text-xs text-[#8E8878] whitespace-nowrap">1 thùng =</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={form.unitsPerBox}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/[^0-9]/g, '');
                          setForm({ ...form, unitsPerBox: raw });
                        }}
                        placeholder="12"
                        className="w-20 px-3 py-2 rounded-lg border-2 border-[#C9A84C] text-sm font-bold text-center focus:outline-none text-[#1C1C1E]"
                      />
                      <span className="text-xs text-[#8E8878]">{form.unit}</span>
                    </div>
                  </div>

                  {/* Preview giá thùng */}
                  {form.unitsPerBox && parseInt(form.unitsPerBox) > 0 && tiers[0]?.price && (
                    <div className="bg-[#FDF8ED] rounded-lg px-3 py-2 flex items-center justify-between">
                      <span className="text-xs text-[#8E8878]">Giá 1 thùng ({form.unitsPerBox} {form.unit})</span>
                      <span className="text-sm font-bold text-[#C9A84C]">
                        {new Intl.NumberFormat('vi-VN').format(
                          parseInt(form.unitsPerBox) * (parseFloat(tiers[0].price) || 0)
                        )} đ
                      </span>
                    </div>
                  )}

                  {form.unitsPerBox && parseInt(form.unitsPerBox) > 0 && !tiers[0]?.price && (
                    <p className="text-[11px] text-[#C4B9A8] italic">Nhập giá bên dưới để xem giá thùng.</p>
                  )}
                </div>
              )}
            </div>

            {/* VAT */}
            <div>
              <label className="text-xs text-[#8E8878] mb-2 block font-medium">Thuế VAT</label>
              <div className="flex gap-2 items-start">
                {/* VAT rate selector */}
                <div className="relative shrink-0">
                  <select
                    value={form.vatRate}
                    onChange={(e) => setForm(f => ({
                      ...f,
                      vatRate: Number(e.target.value),
                      // Reset vatMode về INCLUDED nếu chọn lại 0%
                      vatMode: Number(e.target.value) === 0 ? 'INCLUDED' : f.vatMode,
                    }))}
                    className="px-3 py-2 pr-8 rounded-lg border border-[#E8DDD0] text-sm bg-white appearance-none focus:outline-none focus:border-[#C9A84C]">
                    {VAT_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                  </select>
                  <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8E8878] pointer-events-none" />
                </div>

                {/* VAT mode toggle — chỉ hiện khi vatRate > 0 */}
                {form.vatRate > 0 && (
                  <div className="flex rounded-lg border border-[#E8DDD0] overflow-hidden text-xs flex-1">
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, vatMode: 'INCLUDED' }))}
                      className={`flex-1 px-3 py-2 font-medium transition-colors
                        ${form.vatMode === 'INCLUDED'
                          ? 'bg-[#C9A84C] text-white'
                          : 'text-[#8E8878] hover:bg-[#F0EBE3]'}`}>
                      Có trong giá
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, vatMode: 'ADDED' }))}
                      className={`flex-1 px-3 py-2 font-medium transition-colors border-l border-[#E8DDD0]
                        ${form.vatMode === 'ADDED'
                          ? 'bg-[#C9A84C] text-white'
                          : 'text-[#8E8878] hover:bg-[#F0EBE3]'}`}>
                      Tính thêm
                    </button>
                  </div>
                )}
              </div>

              {/* Hint text */}
              {form.vatRate > 0 && (
                <p className="text-[10px] text-[#B0A898] mt-1.5">
                  {form.vatMode === 'INCLUDED'
                    ? `Giá hiển thị đã bao gồm VAT ${form.vatRate}%. Ví dụ: giá 100.000đ → đã có VAT.`
                    : `VAT ${form.vatRate}% sẽ được cộng thêm vào giá khi thanh toán. Ví dụ: giá 100.000đ → cộng thêm ${form.vatRate === 8 ? '8.000đ' : form.vatRate === 10 ? '10.000đ' : `${form.vatRate}.000đ`}.`}
                </p>
              )}
            </div>

            {/* Price tiers */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-[#8E8878] uppercase tracking-wider">
                  Bảng giá <span className="text-red-400">*</span>
                </p>
                <button
                  onClick={() => setTiers(prev => [...prev, { fromQty: '', price: '' }])}
                  className="flex items-center gap-1 text-[#C9A84C] text-xs font-medium hover:text-[#A07830]">
                  <Plus size={13} /> Thêm mức
                </button>
              </div>
              <div className="space-y-2">
                {tiers.map((t, idx) => {
                  const nextFrom = idx < tiers.length - 1 ? tiers[idx + 1].fromQty : null;
                  const toLabel = nextFrom !== '' && nextFrom != null ? formatNumber(nextFrom) : '∞';
                  return (
                    <div key={idx} className="grid items-center gap-1.5 bg-[#FAF7F2] rounded-xl px-3 py-2.5"
                      style={{ gridTemplateColumns: 'auto 56px auto 56px auto 1fr auto auto' }}>

                      <span className="text-[10px] text-[#8E8878]">Từ</span>

                      {idx === 0 ? (
                        <span className="text-xs font-semibold text-[#1C1C1E] text-center">0</span>
                      ) : (
                        <input
                          type="number" min="0"
                          value={t.fromQty}
                          onChange={(e) => handleTierFromQty(idx, e.target.value)}
                          onFocus={e => e.target.select()}
                          className="input-elegant w-full rounded-lg px-2 py-1 text-xs text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      )}

                      <span className="text-[10px] text-[#8E8878] text-center">–</span>

                      <span className="text-xs font-semibold text-[#8E8878] text-center">{toLabel}</span>

                      <span className="text-[10px] text-[#8E8878]">:</span>

                      <PriceInput value={t.price} onChange={(val) => handleTierPrice(idx, val)}
                        placeholder="Đơn giá"
                        className="input-elegant w-full rounded-lg px-3 py-1 text-xs text-right" />

                      <span className="text-[10px] text-[#8E8878]">đ</span>

                      {idx > 0 ? (
                        <button
                          onClick={() => setTiers(prev => prev.filter((_, i) => i !== idx))}
                          className="text-red-400 hover:text-red-600">
                          <Trash2 size={13} />
                        </button>
                      ) : (
                        <div className="w-[13px]" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Ingredients */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-[#8E8878] uppercase tracking-wider">
                  Nguyên liệu <span className="text-red-400">*</span>
                </p>
                <button onClick={() => setShowIngPicker(true)}
                  className="flex items-center gap-1 text-[#C9A84C] text-xs font-medium hover:text-[#A07830]">
                  <Plus size={13} /> Chọn nguyên liệu
                </button>
              </div>

              {ingredients.length === 0 ? (
                <button onClick={() => setShowIngPicker(true)}
                  className="w-full py-3 rounded-xl border-2 border-dashed border-[#E8DDD0] text-xs text-[#8E8878] hover:border-[#C9A84C] hover:text-[#C9A84C] transition-colors">
                  + Thêm nguyên liệu cho sản phẩm
                </button>
              ) : (
                <div className="space-y-1.5">
                  {ingredients.map((ing) => (
                    <div key={ing.ingredientId} className="flex items-center gap-2 bg-[#FAF7F2] rounded-xl px-3 py-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-medium text-[#1C1C1E] truncate">{ing.name}</p>
                          {/* Badge hiển thị chế độ tính */}
                          <span className={`shrink-0 text-[9px] px-1.5 py-0.5 rounded font-medium ${ing.canOverride
                            ? 'bg-[#FDF8ED] text-[#C9A84C]'
                            : 'bg-[#F0EBE3] text-[#8E8878]'
                            }`}>
                            {ing.canOverride ? '≈' : '#'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <input
                          type="number"
                          min="0.001"
                          step="0.001"
                          onKeyDown={limitDecimalInput}
                          value={ing.qty}
                          onChange={e => updateIngQty(ing.ingredientId, e.target.value)}
                          onBlur={e => commitIngQty(ing.ingredientId, e.target.value)}
                          onFocus={e => e.target.select()}
                          className="w-16 text-center border border-[#E8DDD0] rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-[#C9A84C] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <span className="text-[10px] text-[#8E8878] w-8">{ing.unit}</span>
                        <button onClick={() => removeIngredient(ing.ingredientId)}
                          className="text-red-400 hover:text-red-600">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                  <button onClick={() => setShowIngPicker(true)}
                    className="w-full py-2 rounded-xl border border-dashed border-[#E8DDD0] text-[10px] text-[#8E8878] hover:border-[#C9A84C] hover:text-[#C9A84C] transition-colors">
                    Chỉnh sửa danh sách nguyên liệu
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 pb-5 pt-3 border-t border-[#F0EBE3] flex gap-3">
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-[#E8DDD0] text-[#8E8878] text-sm font-medium hover:bg-[#F0EBE3] transition-colors">
              Huỷ
            </button>
            <button onClick={handleSubmit} disabled={saving}
              className="flex-1 btn-gold rounded-xl py-2.5 text-sm font-bold flex items-center justify-center gap-2">
              {saving
                ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Đang lưu...</>
                : isEdit ? 'Cập nhật' : 'Tạo sản phẩm'
              }
            </button>
          </div>
        </div>
      </div>

      {showIngPicker && (
        <IngredientPickerPopup
          selected={ingredients}
          onConfirm={handleIngConfirm}
          onClose={() => setShowIngPicker(false)}
        />
      )}
    </>
  );
}