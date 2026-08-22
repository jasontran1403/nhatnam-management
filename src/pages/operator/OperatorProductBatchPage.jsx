// src/pages/operator/OperatorProductBatchPage.jsx
// Đã đổi thành: Danh sách sản phẩm + Tạo mới / Sửa / Xóa
import { useLang } from '../../context/LangContext';
import ReactDOM from 'react-dom';
import { useState, useEffect, useRef, useMemo } from 'react';
import { operatorApi } from '../../api/operatorApi';
import { useToast } from '../../components/common/Toast';
import { BRAND } from '../../config/brand';
import {
  Plus, Trash2, X, ChevronDown, ChevronUp,
  ImagePlus, Box, Search, Edit2, AlertTriangle,
  Package, Tag, Layers, Download, Upload, Hash,
  ArrowUpAZ, ArrowDownAZ,
} from 'lucide-react';


const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:9261';
const VAT_RATES = [0, 5, 8, 10];
const UNITS = ['Kg', 'Gr', 'Lít', 'ml', 'Cái', 'Hộp', 'Cây', 'Bó', 'Túi', 'Gói', 'Chai', 'Lon', 'Phần', 'Mét'];

// ── SKU Generator ─────────────────────────────────────────────────────────────
// Tạo SKU ngắn gọn, dễ nhớ cho ~500 sản phẩm thực phẩm
// Format: [CAT]-[2-3 ký tự tên]-[ID 3 số]  ví dụ: KEM-SDA-001, HAI-TOM-042
const CATEGORY_PREFIX = {
  'kem': 'KEM', 'cream': 'KEM',
  'gia vị': 'GVJ', 'gia vi': 'GVJ', 'sauce': 'GVJ', 'sốt': 'GVJ', 'sot': 'GVJ',
  'thịt': 'THT', 'thit': 'THT', 'meat': 'THT',
  'hải sản': 'HSN', 'hai san': 'HSN', 'seafood': 'HSN', 'tôm': 'HSN', 'tom': 'HSN',
  'xúc xích': 'XXC', 'xuc xich': 'XXC', 'sausage': 'XXC',
  'rau': 'RAU', 'củ': 'RAU', 'cu': 'RAU',
  'đồ uống': 'DUO', 'do uong': 'DUO', 'drink': 'DUO',
  'bánh': 'BNH', 'banh': 'BNH',
};

function generateSKU(productName, category, productId) {
  const removeVietnamese = (str) =>
    (str || '').normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/gi, 'd')
      .toUpperCase()
      .replace(/[^A-Z0-9 ]/g, '')
      .trim();

  // 1. Prefix danh mục (3 ký tự)
  const catLower = (category || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
  let catCode = 'PRD';
  for (const [key, val] of Object.entries(CATEGORY_PREFIX)) {
    if (catLower.includes(key)) { catCode = val; break; }
  }

  // 2. Tên sản phẩm → lấy 2-3 ký tự đầu của từ đầu tiên có nghĩa
  const cleanName = removeVietnamese(productName);
  const words = cleanName.split(/\s+/).filter(w => w.length >= 2);
  let nameCode = '';
  if (words.length >= 2) {
    nameCode = words[0].slice(0, 2) + words[1].slice(0, 1);
  } else if (words.length === 1) {
    nameCode = words[0].slice(0, 3);
  } else {
    nameCode = cleanName.slice(0, 3);
  }
  nameCode = nameCode.padEnd(3, 'X').slice(0, 3);

  // 3. ID sản phẩm (3 chữ số, nếu chưa có ID thì dùng random)
  const idNum = productId ? String(productId).padStart(3, '0').slice(-3) : String(Math.floor(Math.random() * 900) + 100);

  return `${catCode}-${nameCode}-${idNum}`;
}

// ── Import Products Modal ─────────────────────────────────────────────────────
function ImportProductsModal({ open, onClose, onDone }) {
  const toast = useToast();
  const [step, setStep] = useState('upload'); // 'upload' | 'result'
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => { if (!open) { setStep('upload'); setResult(null); setUploadError(null); } }, [open]);

  const handleFile = async (file) => {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const res = await operatorApi.importUpdateProducts(file);
      const body = res?.data || {};

      // Backend trả success:true nhưng code != 200 khi có lỗi nghiệp vụ (token sai, file cũ...)
      if (!body.success || (body.data === null && body.message && body.code !== 200)) {
        setUploadError(body.message || 'Lỗi import sản phẩm');
        return;
      }

      const d = body.data || {};
      setResult({ updated: d.updated ?? 0, skipped: d.skipped ?? 0, errors: d.errors || [] });
      setStep('result');
      if ((d.updated ?? 0) > 0) onDone();
    } catch (e) {
      setUploadError(e?.response?.data?.message || 'Lỗi import sản phẩm');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  if (!open) return null;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-line-soft">
          <div>
            <h2 className="text-base font-bold text-ink">Import sản phẩm</h2>
            <p className="text-xs text-muted mt-0.5">
              {step === 'upload' ? 'Dùng file Export từ hệ thống — file chỉ import được 1 lần' : 'Kết quả import'}
            </p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-ink"><X size={20} /></button>
        </div>

        {step === 'upload' ? (
          <div className="flex flex-col items-center justify-center p-10 gap-5">
            <div className="w-16 h-16 rounded-full bg-gold/10 flex items-center justify-center">
              {uploading
                ? <div className="w-8 h-8 border-[3px] border-gold border-t-transparent rounded-full animate-spin" />
                : <Upload size={28} className="text-gold" />}
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-ink">{uploading ? 'Đang xử lý...' : 'Chọn file Excel để import'}</p>
              <p className="text-xs text-muted mt-1">Backend dựa vào cột <strong>ID</strong> để cập nhật.</p>
              <p className="text-xs text-amber-600 dark:text-amber-300 mt-1 bg-amber-50 dark:bg-amber-500/10 rounded-lg px-3 py-1.5">
                ⚠ Mỗi file chỉ import được <strong>1 lần</strong>. Export lại nếu muốn import tiếp.
              </p>
              {uploadError && (
                <div className="flex items-start gap-2 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/28 rounded-xl px-4 py-3 text-left max-w-xs">
                  <span className="text-red-500 mt-0.5 shrink-0">✕</span>
                  <p className="text-xs text-red-600 dark:text-red-300 font-medium">{uploadError}</p>
                </div>
              )}
            </div>
            {!uploading && (
              <label className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gold text-white text-sm font-semibold cursor-pointer hover:bg-gold-deep transition-colors">
                <Upload size={15} /> Chọn file .xlsx
                <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
                  onChange={e => { if (e.target.files[0]) handleFile(e.target.files[0]); }} />
              </label>
            )}
          </div>
        ) : (
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/28 rounded-xl px-4 py-3 text-center">
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-300">{result?.updated ?? 0}</p>
                <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">Cập nhật thành công</p>
              </div>
              <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/28 rounded-xl px-4 py-3 text-center">
                <p className="text-2xl font-bold text-red-500">{result?.skipped ?? 0}</p>
                <p className="text-xs text-red-600 dark:text-red-300 mt-0.5">Bỏ qua / lỗi</p>
              </div>
            </div>
            {result?.errors?.length > 0 && (
              <div className="bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/18 rounded-xl p-3 max-h-48 overflow-y-auto">
                <p className="text-xs font-semibold text-red-600 dark:text-red-300 mb-2">Chi tiết lỗi:</p>
                {result.errors.map((err, i) => (
                  <p key={i} className="text-xs text-red-500 py-0.5 border-b border-red-100 dark:border-red-500/18 last:border-0">{err}</p>
                ))}
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <button onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-line text-sm text-ink-2 hover:bg-canvas">
                Đóng
              </button>
              <label className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gold text-white text-sm font-semibold cursor-pointer hover:bg-gold-deep">
                <Upload size={14} /> Import file mới
                <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
                  onChange={e => { if (e.target.files[0]) { setStep('upload'); handleFile(e.target.files[0]); } }} />
              </label>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

const DEFAULT_TIERS = [
  { _id: 'tier-1', tierName: 'Sỉ 1', minQty: 0, maxQty: 5, price: '' },
  { _id: 'tier-2', tierName: 'Sỉ 2', minQty: 5, maxQty: 20, price: '' },
  { _id: 'tier-3', tierName: 'Sỉ 3', minQty: 20, maxQty: null, price: '' },
];

const emptyIngredient = () => ({
  _id: Date.now() + Math.random(),
  ingredientId: '',
  quantity: 1,
  canOverride: false,
});

const emptyForm = () => ({
  existingProductId: null,
  name: '',
  sku: '',
  categoryName: '',
  unit: '',
  basePrice: '',
  maxDiscountRate: 0,
  vatRate: 8,
  vatMode: 'INCLUSIVE',
  imageUrl: '',
  unitsPerBox: '',
  // ── NEW: conversion fields ──
  conversionUnit: '',
  conversionFactor: '',
  hasWholesale: false,
  tiers: DEFAULT_TIERS.map(t => ({ ...t, _id: `${t._id}-${Date.now()}` })),
  ingredients: [emptyIngredient()],
  _uploading: false,
});

const fmtNum = (v) => {
  const n = parseInt(String(v ?? '').replace(/[^0-9]/g, ''), 10);
  return isNaN(n) ? '' : n.toLocaleString('vi-VN');
};

const normalize = (str) =>
  (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// ── ConfirmDeleteModal ────────────────────────────────────────────────────────
function ConfirmDeleteModal({ open, onClose, onConfirm, itemName, deleting }) {
  if (!open) return null;
  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={18} className="text-red-500" />
            </div>
            <div>
              <h3 className="text-base font-bold text-ink">Xác nhận xóa</h3>
              <p className="text-xs text-muted mt-0.5">Sản phẩm sẽ bị ẩn khỏi hệ thống</p>
            </div>
          </div>
          <p className="text-sm text-ink-2">
            Bạn có chắc muốn xóa sản phẩm <strong>"{itemName}"</strong>?
            <br />
            <span className="text-xs text-muted">Các đơn hàng cũ vẫn giữ nguyên thông tin.</span>
          </p>
        </div>
        <div className="px-6 pb-6 flex gap-2">
          <button onClick={onClose} disabled={deleting}
            className="flex-1 py-2.5 rounded-xl border border-line text-sm text-ink-2 hover:bg-canvas disabled:opacity-50">
            Huỷ
          </button>
          <button onClick={onConfirm} disabled={deleting}
            className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
            {deleting
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <Trash2 size={14} />}
            {deleting ? 'Đang xóa...' : 'Xóa sản phẩm'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── PriceInput ────────────────────────────────────────────────────────────────
function PriceInput({ value, onChange, placeholder }) {
  const [focused, setFocused] = useState(false);
  const rawNum = String(value ?? '').replace(/[^0-9]/g, '');
  const display = focused ? rawNum : (rawNum ? Number(rawNum).toLocaleString('vi-VN') : '');
  return (
    <input type="text" value={display}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      onChange={e => onChange(e.target.value.replace(/[^0-9]/g, ''))}
      placeholder={placeholder}
      className="w-full px-3 py-2 text-sm rounded-xl border border-line bg-surface focus:outline-none focus:border-gold text-right" />
  );
}

// ── IngredientSelect ──────────────────────────────────────────────────────────
function IngredientSelect({ ingredients, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const selected = ingredients.find(i => String(i.id) === String(value));
  const filtered = ingredients.filter(i => normalize(i.name).includes(normalize(search)));

  return (
    <>
      <div onClick={() => { setSearch(''); setOpen(true); }}
        className="border border-line rounded-lg px-3 py-1.5 text-xs cursor-pointer hover:border-gold truncate">
        {selected ? selected.name : 'Chọn nguyên liệu...'}
      </div>
      {open && ReactDOM.createPortal(
        <div className="fixed inset-0 z-[11000] flex items-center justify-center bg-black/60 p-4">
          <div className="bg-surface rounded-2xl w-full max-w-lg h-[60svh] flex flex-col shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-lg">Chọn nguyên liệu</h3>
              <button onClick={() => { setOpen(false); setSearch(''); }} className="text-muted hover:text-red-500">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 border-b">
              <div className="relative">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Tìm nguyên liệu..."
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-line focus:border-gold focus:outline-none text-sm"
                  autoFocus />
              </div>
            </div>
            <div className="flex-1 overflow-auto p-2">
              {filtered.length === 0
                ? <div className="flex flex-col items-center justify-center h-full text-muted">
                  <Search size={32} className="mb-2 opacity-30" />
                  <p className="text-sm italic">Không tìm thấy</p>
                </div>
                : filtered.map(i => (
                  <div key={i.id}
                    onClick={() => { onChange(i.id); setOpen(false); setSearch(''); }}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-colors
                      ${String(i.id) === String(value) ? 'bg-gold/10 border border-gold/30' : 'hover:bg-canvas'}`}>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-ink truncate text-sm">{i.name}</p>
                      {i.unit && <p className="text-xs text-muted">ĐVT: {i.unit}</p>}
                    </div>
                    {String(i.id) === String(value) && (
                      <span className="text-[10px] bg-gold text-white rounded-full px-2 py-0.5 font-semibold shrink-0">Đang chọn</span>
                    )}
                  </div>
                ))}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

// ── ProductFormModal ──────────────────────────────────────────────────────────
function ProductFormModal({ open, onClose, onSaved, editProduct, categories, ingredients }) {
  const { t } = useLang();
  const toast = useToast();
  const [form, setForm] = useState(emptyForm());
  const [submitting, setSubmitting] = useState(false);

  // Khi mở modal edit: load data từ product
  useEffect(() => {
    if (!open) return;
    if (editProduct) {
      const hasTiers = editProduct.tiers && editProduct.tiers.length > 0;
      setForm({
        existingProductId: editProduct.id,
        name: editProduct.name || '',
        sku: editProduct.sku || '',
        categoryName: editProduct.category || editProduct.categoryName || '',
        unit: editProduct.unit || '',
        basePrice: editProduct.basePrice != null ? String(editProduct.basePrice) : '',
        maxDiscountRate: editProduct.maxDiscountRate ?? 0,
        vatRate: editProduct.vatRate ?? 8,
        vatMode: editProduct.vatMode || 'INCLUSIVE',
        imageUrl: editProduct.imageUrl || '',
        unitsPerBox: editProduct.unitsPerBox ? String(editProduct.unitsPerBox) : '',
        // ── NEW: conversion fields ──
        conversionUnit: editProduct.conversionUnit || '',
        conversionFactor: editProduct.conversionFactor != null ? String(editProduct.conversionFactor) : '',
        hasWholesale: hasTiers,
        tiers: hasTiers
          ? editProduct.tiers.map((t, idx) => ({
            _id: `tier-${idx}-${Date.now()}`,
            tierName: t.tierName || `Sỉ ${idx + 1}`,
            minQty: t.minQuantity ?? DEFAULT_TIERS[idx]?.minQty ?? 0,
            maxQty: t.maxQuantity ?? DEFAULT_TIERS[idx]?.maxQty ?? null,
            price: t.price != null ? String(t.price) : '',
          }))
          : DEFAULT_TIERS.map(t => ({ ...t, _id: `${t._id}-${Date.now()}`, price: '' })),
        ingredients: (editProduct.ingredients && editProduct.ingredients.length > 0)
          ? editProduct.ingredients.map(ing => ({
            _id: Date.now() + Math.random(),
            ingredientId: String(ing.ingredientId || ''),
            quantity: ing.quantity != null ? ing.quantity : 1,
            canOverride: ing.canOverride || false,
          }))
          : [emptyIngredient()],
        _uploading: false,
      });
    } else {
      setForm(emptyForm());
    }
  }, [open, editProduct]);

  const upd = (patch) => setForm(f => ({ ...f, ...patch }));

  const addIngredient = () =>
    setForm(f => ({ ...f, ingredients: computeAutoRetail(f.unit, [...f.ingredients, emptyIngredient()]) }));
  const removeIngredient = (iid) => {
    if (form.ingredients.length <= 1) return;
    setForm(f => ({ ...f, ingredients: computeAutoRetail(f.unit, f.ingredients.filter(i => i._id !== iid)) }));
  };
  const setIng = (iid, patch) =>
    upd({ ingredients: form.ingredients.map(i => i._id === iid ? { ...i, ...patch } : i) });

  // ── TỰ ĐỘNG TICK "bán lẻ" (canOverride) THEO ĐƠN VỊ TÍNH ────────────────────
  //   Quy tắc: CHỈ xử lý khi đơn vị SẢN PHẨM = Kg. Khi đó, nếu TẤT CẢ nguyên liệu
  //   đang chọn đều có đvt = Kg thì mặc định tick tất cả; có nguyên liệu khác Kg
  //   thì bỏ tick. Đơn vị ≠ Kg → bỏ qua, không đụng vào checkbox.
  //   - Giữ quyền chỉnh tay: khi người dùng tự bấm checkbox → DỪNG auto (trong phiên).
  //   - Chỉ áp dụng khi người dùng đổi đơn vị / chọn / thêm / xoá nguyên liệu,
  //     KHÔNG chạy lúc mở form → không ghi đè giá trị đã lưu khi sửa.
  const retailManualRef = useRef(false);
  useEffect(() => { if (open) retailManualRef.current = false; }, [open, editProduct]);

  /** Trả về mảng ingredients đã set canOverride theo quy tắc (giữ nguyên nếu đvt ≠ Kg). */
  const computeAutoRetail = (unit, ings) => {
    if (retailManualRef.current) return ings;                        // người dùng đã tự chỉnh
    if ((unit || '').trim().toLowerCase() !== 'kg') return ings;     // chỉ xử lý khi SP = Kg
    const chosen = ings.filter(i => i.ingredientId);
    if (chosen.length === 0) return ings;                            // chưa chọn nguyên liệu
    const unitOf = (id) => {
      const m = ingredients.find(x => String(x.id) === String(id));
      return (m?.unit || '').trim().toLowerCase();
    };
    const allKg = chosen.every(i => unitOf(i.ingredientId) === 'kg');
    return ings.map(i => ({ ...i, canOverride: allKg }));
  };

  /** Đổi đơn vị sản phẩm → tính lại auto-tick. */
  const setProductUnit = (unit) =>
    setForm(f => ({ ...f, unit, unitsPerBox: '', ingredients: computeAutoRetail(unit, f.ingredients) }));

  /** Chọn nguyên liệu cho 1 dòng → tính lại auto-tick. */
  const setIngredientId = (iid, ingredientId) =>
    setForm(f => {
      const ings = f.ingredients.map(i => i._id === iid ? { ...i, ingredientId } : i);
      return { ...f, ingredients: computeAutoRetail(f.unit, ings) };
    });

  const setTierPrice = (tierId, val) =>
    upd({ tiers: form.tiers.map(t => t._id === tierId ? { ...t, price: val } : t) });

  const toggleWholesale = () => upd({
    hasWholesale: !form.hasWholesale,
    tiers: !form.hasWholesale
      ? DEFAULT_TIERS.map(t => ({ ...t, _id: `${t._id}-${Date.now()}`, price: '' }))
      : form.tiers,
  });

  const handleUpload = async (file) => {
    if (!file) return;
    upd({ _uploading: true });
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await window.fetch(`${BASE_URL}/api/upload/product-image`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: fd,
      });
      const json = await res.json();
      upd({ imageUrl: json?.data?.imageUrl || '', _uploading: false });
    } catch {
      toast(t('common', 'error'), 'error');
      upd({ _uploading: false });
    }
  };

  const imgSrc = (url) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    return `${BASE_URL}/api/auth${url}`;
  };

  const basePrice0 = Number(String(
    form.hasWholesale ? (form.tiers[0]?.price ?? form.basePrice) : form.basePrice
  ).replace(/[^0-9]/g, ''));
  const unitsPerBoxNum = parseInt(form.unitsPerBox, 10);
  const boxPrice = !isNaN(unitsPerBoxNum) && unitsPerBoxNum > 0 && basePrice0 > 0
    ? basePrice0 * unitsPerBoxNum : null;

  const handleSubmit = async () => {
    if (!form.name.trim()) return toast('Tên sản phẩm không được trống', 'error');
    if (!form.unit.trim()) return toast('Đơn vị tính không được trống', 'error');
    const price = Number(String(form.basePrice).replace(/[^0-9]/g, ''));
    if (!price || price <= 0) return toast('Giá bán lẻ không hợp lệ', 'error');
    if (form.unitsPerBox && parseInt(form.unitsPerBox) < 1)
      return toast('Số đơn vị/thùng không hợp lệ', 'error');

    // ── Validate conversion fields ──
    // Chỉ validate khi đơn vị KHÔNG phải Kg và có nhập ít nhất 1 trong 2 field
    const unitIsKg = form.unit.toLowerCase() === 'kg';
    const hasConversionUnit = form.conversionUnit && form.conversionUnit.trim() !== '';
    const hasConversionFactor = form.conversionFactor && form.conversionFactor.trim() !== '';

    if (!unitIsKg) {
      if (hasConversionUnit && !hasConversionFactor) {
        return toast('Vui lòng nhập hệ số quy đổi khi đã chọn đơn vị quy đổi', 'error');
      }
      if (!hasConversionUnit && hasConversionFactor) {
        return toast('Vui lòng chọn đơn vị quy đổi khi đã nhập hệ số', 'error');
      }
      if (hasConversionUnit && hasConversionFactor) {
        const factor = parseFloat(form.conversionFactor);
        if (isNaN(factor) || factor <= 0) {
          return toast('Hệ số quy đổi phải là số dương', 'error');
        }
      }
    }

    if (form.hasWholesale) {
      const p1 = Number(String(form.tiers[0].price).replace(/[^0-9]/g, ''));
      const p2 = Number(String(form.tiers[1].price).replace(/[^0-9]/g, ''));
      const p3 = Number(String(form.tiers[2].price).replace(/[^0-9]/g, ''));
      if (!p1 || !p2 || !p3) return toast('Vui lòng nhập đủ giá 3 khung sỉ', 'error');
      if (!(p1 > p2)) return toast('Giá Sỉ 1 phải lớn hơn Sỉ 2', 'error');
      if (!(p2 > p3)) return toast('Giá Sỉ 2 phải lớn hơn Sỉ 3', 'error');
    }

    setSubmitting(true);
    try {
      const payload = {
        type: form.existingProductId ? 'UPDATE' : 'CREATE',
        note: form.existingProductId ? 'Cập nhật sản phẩm' : 'Tạo sản phẩm mới',
        items: [{
          existingProductId: form.existingProductId,
          name: form.name.trim(),
          sku: form.sku.trim() || null,
          categoryName: form.categoryName,
          unit: form.unit,
          basePrice: Number(String(form.basePrice).replace(/[^0-9]/g, '')),
          maxDiscountRate: Number(form.maxDiscountRate) || 0,
          vatRate: form.vatRate ?? 8,
          vatMode: form.vatMode || 'INCLUSIVE',
          imageUrl: form.imageUrl,
          unitsPerBox: form.unitsPerBox ? parseInt(form.unitsPerBox, 10) : null,
          // ── NEW: conversion fields ──
          conversionUnit: (!unitIsKg && form.conversionUnit && form.conversionUnit.trim() !== '')
            ? form.conversionUnit.trim()
            : null,
          conversionFactor: (!unitIsKg && form.conversionFactor && form.conversionFactor.trim() !== '')
            ? parseFloat(form.conversionFactor)
            : null,
          tiers: form.hasWholesale
            ? form.tiers.map((tier, idx) => ({
              tierName: tier.tierName,
              minQuantity: tier.minQty,
              maxQuantity: tier.maxQty,
              price: Number(String(tier.price).replace(/[^0-9]/g, '')),
              sortOrder: idx,
            }))
            : [],
          ingredients: form.ingredients
            .filter(ing => ing.ingredientId)
            .map(ing => ({
              ingredientId: Number(ing.ingredientId),
              quantity: Number(ing.quantity) || 1,
              canOverride: ing.canOverride || false,
            })),
        }],
      };
      await operatorApi.submitBatch(payload);
      toast(form.existingProductId ? 'Cập nhật thành công!' : 'Tạo sản phẩm thành công!', 'success');
      onSaved();
      onClose();
    } catch (e) {
      toast(e?.response?.data?.message || 'Lỗi lưu sản phẩm', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-line-soft flex-shrink-0">
          <h2 className="text-lg font-bold text-ink">
            {form.existingProductId ? 'Sửa sản phẩm' : 'Tạo sản phẩm mới'}
          </h2>
          <button onClick={onClose} className="text-muted hover:text-ink">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Ảnh + Tên + Danh mục + Đơn vị */}
          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <label className="block text-xs font-semibold text-ink-2 mb-1.5">Ảnh</label>
              <label className="relative w-20 h-20 rounded-xl border-2 border-dashed border-line bg-canvas
                flex items-center justify-center cursor-pointer hover:border-gold transition-all overflow-hidden">
                {imgSrc(form.imageUrl) ? (
                  <img src={imgSrc(form.imageUrl)} alt="" className="w-full h-full object-cover" />
                ) : form._uploading ? (
                  <div className="w-5 h-5 border-2 border-gold border-t-transparent rounded-full animate-spin" />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-faint">
                    <ImagePlus size={18} />
                    <span className="text-[10px]">Chọn ảnh</span>
                  </div>
                )}
                <input type="file" accept="image/*" className="hidden"
                  onChange={e => handleUpload(e.target.files[0])} />
              </label>
            </div>

            <div className="flex-1 grid grid-cols-1 gap-3">
              <div>
                <label className="block text-xs font-semibold text-ink-2 mb-1">
                  Tên sản phẩm <span className="text-red-400">*</span>
                </label>
                <input value={form.name} onChange={e => upd({ name: e.target.value })}
                  placeholder={BRAND.examples.sauce.vi}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-line focus:outline-none focus:border-gold bg-surface" />
              </div>
              {/* SKU */}
              <div>
                <label className="block text-xs font-semibold text-ink-2 mb-1 flex items-center gap-1">
                  <Hash size={11} className="text-gold" /> SKU
                  <span className="font-normal text-muted">(mã hàng ngắn)</span>
                </label>
                <div className="flex gap-2">
                  <input value={form.sku} onChange={e => upd({ sku: e.target.value.toUpperCase() })}
                    placeholder="VD: KEM-SDA-001"
                    className="flex-1 px-3 py-2 text-sm rounded-xl border border-line focus:outline-none focus:border-gold bg-surface font-mono" />
                  <button type="button"
                    onClick={() => upd({ sku: generateSKU(form.name, form.categoryName, form.existingProductId) })}
                    className="px-3 py-2 text-xs rounded-xl bg-gold/10 text-gold hover:bg-gold/20 font-semibold whitespace-nowrap transition-colors">
                    Tạo SKU
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-ink-2 mb-1">Danh mục</label>
                  <select value={form.categoryName} onChange={e => upd({ categoryName: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-line bg-surface focus:outline-none focus:border-gold">
                    <option value="">— Chọn —</option>
                    {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-2 mb-1">
                    Đơn vị tính <span className="text-red-400">*</span>
                  </label>
                  <select value={form.unit} onChange={e => setProductUnit(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-line bg-surface focus:outline-none focus:border-gold">
                    <option value="">— Chọn —</option>
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* ── Quy đổi đơn vị ────────────────────────────────────────────────────── */}
          {form.unit && form.unit.toLowerCase() !== 'kg' && (
            <div className="rounded-xl border border-line overflow-hidden bg-canvas/40">
              <div className="px-4 py-2.5 bg-canvas border-b border-line-soft flex items-center gap-2">
                <span className="text-xs font-semibold text-ink-2">Quy đổi đơn vị</span>
                <span className="text-[10px] text-muted">
                  (1 {form.unit} = ? kg)
                </span>
              </div>
              <div className="px-4 py-3 flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-ink-2 font-medium">1 {form.unit} =</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={form.conversionFactor}
                    onChange={e => {
                      const val = e.target.value.replace(/[^0-9.]/g, '');
                      // Chỉ cho phép 1 dấu chấm
                      const parts = val.split('.');
                      const sanitized = parts[0] + (parts.length > 1 ? '.' + parts.slice(1).join('') : '');
                      upd({ conversionFactor: sanitized });
                    }}
                    placeholder="VD: 0.454"
                    className="w-28 px-3 py-2 text-sm font-bold text-center rounded-xl border-2 border-gold/60 focus:border-gold focus:outline-none bg-surface"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-ink-2 font-medium">Đơn vị quy đổi</span>
                  <select
                    value={form.conversionUnit}
                    onChange={e => upd({ conversionUnit: e.target.value })}
                    className="px-3 py-2 text-sm rounded-xl border border-line bg-surface focus:outline-none focus:border-gold"
                  >
                    <option value="">— Chọn —</option>
                    <option value="Kg">Kg</option>
                    <option value="Gram">Gram</option>
                    <option value="Lít">Lít</option>
                    <option value="ml">ml</option>
                  </select>
                </div>
                {form.conversionFactor && form.conversionUnit && (
                  <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl px-3 py-2 border border-emerald-200 dark:border-emerald-500/28">
                    <span className="text-xs text-muted">1 {form.unit} =</span>
                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-300">
                      {parseFloat(form.conversionFactor).toFixed(3)} {form.conversionUnit}
                    </span>
                  </div>
                )}
                <span className="text-[10px] text-muted ml-auto">
                  ⚡ Dùng để quy đổi khi xuất hoá đơn Misa
                </span>
              </div>
            </div>
          )}

          {/* Giá + VAT */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-ink-2 mb-1">
                Giá bán lẻ (đ) <span className="text-red-400">*</span>
              </label>
              <PriceInput value={form.basePrice} onChange={val => upd({ basePrice: val })} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-2 mb-1">CK tối đa (%)</label>
              <input type="number" min={0} max={100} value={form.maxDiscountRate}
                onChange={e => upd({ maxDiscountRate: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-xl border border-line bg-surface focus:outline-none focus:border-gold" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-2 mb-1">Thuế VAT (%)</label>
              <select value={form.vatRate} onChange={e => upd({ vatRate: Number(e.target.value) })}
                className="w-full px-3 py-2 text-sm rounded-xl border border-line bg-surface focus:outline-none focus:border-gold">
                {VAT_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-2 mb-1">Kiểu VAT</label>
              <select value={form.vatMode} onChange={e => upd({ vatMode: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-xl border border-line bg-surface focus:outline-none focus:border-gold">
                <option value="INCLUSIVE">VAT trong giá</option>
                <option value="EXCLUSIVE">VAT tính thêm</option>
              </select>
            </div>
          </div>

          {/* Quy cách thùng */}
          <div className="rounded-xl border border-line overflow-hidden">
            <button type="button" onClick={() => upd({ unitsPerBox: form.unitsPerBox ? '' : '1' })}
              className="w-full flex items-center justify-between px-4 py-3 bg-canvas hover:bg-surface-2 transition-colors">
              <div className="flex items-center gap-2">
                <Box size={14} className="text-gold" />
                <span className="text-xs font-semibold text-ink">Bán theo thùng / quy cách</span>
                <span className="text-[10px] text-muted">(tuỳ chọn)</span>
              </div>
              <div className={`w-9 h-5 rounded-full transition-colors relative flex-shrink-0 ${form.unitsPerBox ? 'bg-gold' : 'bg-surface-3'}`}>
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-surface shadow transition-all ${form.unitsPerBox ? 'left-4' : 'left-0.5'}`} />
              </div>
            </button>
            {form.unitsPerBox !== '' && (
              <div className="px-4 py-3 bg-surface border-t border-line-soft">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-ink-2 whitespace-nowrap font-medium">1 thùng =</span>
                    <input type="text" inputMode="numeric" value={form.unitsPerBox}
                      onFocus={e => requestAnimationFrame(() => e.target.select())}
                      onMouseUp={e => e.preventDefault()}
                      onChange={e => upd({ unitsPerBox: e.target.value.replace(/[^0-9]/g, '') })}
                      placeholder="12"
                      className="w-20 px-3 py-2 text-sm font-bold text-center rounded-xl border-2 border-gold focus:outline-none bg-canvas" />
                    <span className="text-xs text-ink-2 font-medium">{form.unit || 'đơn vị'}</span>
                  </div>
                  {boxPrice && (
                    <div className="flex items-center gap-2 bg-gold-tint rounded-xl px-3 py-2 border border-gold/40">
                      <Box size={13} className="text-gold" />
                      <span className="text-xs text-muted">Giá 1 thùng:</span>
                      <span className="text-sm font-bold text-gold">{fmtNum(boxPrice)} đ</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Giá sỉ */}
          <div className="rounded-xl border border-line overflow-hidden">
            <button type="button" onClick={toggleWholesale}
              className="w-full flex items-center justify-between px-4 py-3 bg-canvas hover:bg-surface-2 transition-colors">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-ink">Có giá sỉ (khung giá)</span>
                <span className="text-[10px] text-muted">(tuỳ chọn)</span>
              </div>
              <div className={`w-9 h-5 rounded-full transition-colors relative flex-shrink-0 ${form.hasWholesale ? 'bg-gold' : 'bg-surface-3'}`}>
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-surface shadow transition-all ${form.hasWholesale ? 'left-4' : 'left-0.5'}`} />
              </div>
            </button>
            {form.hasWholesale && (
              <div className="px-4 py-3 bg-surface border-t border-line-soft">
                <p className="text-[11px] text-muted mb-3">3 khung giá cố định. Sỉ 1 &gt; Sỉ 2 &gt; Sỉ 3.</p>
                <div className="space-y-2">
                  {form.tiers.map((tier) => (
                    <div key={tier._id}
                      className="grid items-center gap-3 bg-canvas rounded-xl px-3 py-2.5 border border-line-soft"
                      style={{ gridTemplateColumns: '80px 1fr 1fr 1fr' }}>
                      <span className="text-xs font-semibold text-ink-2">{tier.tierName}</span>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-muted">Từ</span>
                        <span className="text-xs font-medium text-ink bg-surface-2 rounded-lg px-2 py-1">{tier.minQty}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-muted">Đến</span>
                        <span className="text-xs font-medium text-ink bg-surface-2 rounded-lg px-2 py-1">
                          {tier.maxQty != null ? tier.maxQty : '∞'}
                        </span>
                      </div>
                      <PriceInput value={tier.price} onChange={val => setTierPrice(tier._id, val)}
                        placeholder={`Giá ${tier.tierName}`} />
                    </div>
                  ))}
                </div>
                {form.hasWholesale && (() => {
                  const p1 = Number(String(form.tiers[0]?.price ?? '').replace(/[^0-9]/g, ''));
                  const p2 = Number(String(form.tiers[1]?.price ?? '').replace(/[^0-9]/g, ''));
                  const p3 = Number(String(form.tiers[2]?.price ?? '').replace(/[^0-9]/g, ''));
                  if (p1 && p2 && p3) {
                    if (!(p1 > p2)) return <p className="text-[11px] text-red-500 mt-2">⚠ Sỉ 1 phải lớn hơn Sỉ 2</p>;
                    if (!(p2 > p3)) return <p className="text-[11px] text-red-500 mt-2">⚠ Sỉ 2 phải lớn hơn Sỉ 3</p>;
                    return <p className="text-[11px] text-emerald-600 dark:text-emerald-300 mt-2">✓ Giá hợp lệ</p>;
                  }
                  return null;
                })()}
              </div>
            )}
          </div>

          {/* Nguyên liệu */}
          <div className="rounded-xl border border-line overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-canvas">
              <span className="text-xs font-semibold text-ink-2">Nguyên liệu ({form.ingredients.length})</span>
              <button onClick={addIngredient} className="flex items-center gap-1 text-xs text-gold hover:text-gold-deep font-semibold">
                <Plus size={12} /> Thêm
              </button>
            </div>
            <div className="px-4 py-3 space-y-2">
              {form.ingredients.map((ing) => (
                <div key={ing._id}
                  className="grid gap-2 items-center bg-canvas rounded-xl px-3 py-2 border border-line-soft"
                  style={{ gridTemplateColumns: '1fr 80px auto 28px' }}>
                  <IngredientSelect ingredients={ingredients} value={ing.ingredientId}
                    onChange={val => setIngredientId(ing._id, val)} />
                  <input type="number" step="0.001" value={ing.quantity}
                    onChange={e => setIng(ing._id, { quantity: e.target.value })}
                    className="text-xs text-center rounded-lg border border-line py-1.5 focus:outline-none focus:border-gold" />
                  <label className="flex justify-center">
                    <input type="checkbox" checked={ing.canOverride}
                      onChange={e => { retailManualRef.current = true; setIng(ing._id, { canOverride: e.target.checked }); }}
                      className="accent-gold" />
                  </label>
                  <button onClick={() => removeIngredient(ing._id)} className="text-red-400 hover:text-red-600 dark:text-red-300">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-line-soft flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-line text-sm text-ink-2 hover:bg-canvas">
            Huỷ
          </button>
          <button onClick={handleSubmit} disabled={submitting}
            className="flex-1 py-2.5 rounded-xl bg-gold hover:bg-gold-deep text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
            {submitting && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {submitting ? 'Đang lưu...' : (form.existingProductId ? 'Cập nhật' : 'Tạo sản phẩm')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── ProductCard ───────────────────────────────────────────────────────────────
function ProductCard({ product, onEdit, onDelete, imgSrc }) {
  const hasTiers = product.tiers && product.tiers.length > 0;
  const hasBox = product.unitsPerBox && product.unitsPerBox > 0;

  return (
    <div className="bg-surface rounded-2xl border border-line-soft shadow-sm overflow-hidden hover:shadow-md transition-shadow group">
      <div className="flex gap-4 p-4">
        {/* Ảnh */}
        <div className="flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden border border-line-soft bg-canvas">
          {imgSrc(product.imageUrl)
            ? <img src={imgSrc(product.imageUrl)} alt={product.name} className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center">
              <Package size={20} className="text-faint" />
            </div>}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink truncate">{product.name}</p>
              <p className="text-xs text-muted mt-0.5">
                {product.category && <span>{product.category} · </span>}
                {product.unit}
                {product.sku && <span className="ml-1.5 font-mono bg-surface-2 text-gold rounded px-1.5 py-0.5 text-[10px]">{product.sku}</span>}
              </p>
            </div>
            {/* Action buttons - visible on hover */}
            <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => onEdit(product)}
                className="flex items-center gap-1 px-2.5 py-1 text-[10px] rounded-lg border border-line text-ink-2 hover:border-gold hover:text-gold transition-all">
                <Edit2 size={10} /> Sửa
              </button>
              <button onClick={() => onDelete(product)}
                className="flex items-center gap-1 px-2.5 py-1 text-[10px] rounded-lg border border-transparent text-faint hover:border-red-200 dark:border-red-500/28 hover:text-red-500 hover:bg-red-50 dark:bg-red-500/10 transition-all">
                <Trash2 size={10} /> Xóa
              </button>
            </div>
          </div>

          {/* Tags */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="text-sm font-bold text-gold">
              {Number(product.basePrice || 0).toLocaleString('vi-VN')}đ
            </span>
            {hasBox && (
              <span className="text-[10px] bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-300 border border-amber-200 dark:border-amber-500/28 rounded-full px-2 py-0.5 flex items-center gap-1">
                <Box size={9} /> {product.unitsPerBox} {product.unit}/thùng
              </span>
            )}
            {product.conversionUnit && product.conversionFactor && product.unit?.toLowerCase() !== 'kg' && (
              <span className="text-[10px] bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-300 border border-purple-200 dark:border-purple-500/28 rounded-full px-2 py-0.5 flex items-center gap-1">
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4L20 20M20 4L4 20" />
                </svg>
                1 {product.unit} = {Number(product.conversionFactor).toFixed(3)} {product.conversionUnit}
              </span>
            )}
            {hasTiers && (
              <span className="text-[10px] bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-300 border border-orange-200 dark:border-orange-500/28 rounded-full px-2 py-0.5">
                Có giá sỉ
              </span>
            )}
            {product.maxDiscountRate > 0 && (
              <span className="text-[10px] bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-500/28 rounded-full px-2 py-0.5">
                CK {product.maxDiscountRate}%
              </span>
            )}
          </div>

          

          {/* Tiers */}
          {hasTiers && (
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {product.tiers.map((t, i) => (
                <span key={i} className="text-[10px] bg-canvas border border-line-soft rounded-lg px-2 py-0.5 text-ink-2">
                  {t.tierName}: {Number(t.price || 0).toLocaleString('vi-VN')}đ
                </span>
              ))}
            </div>
          )}

          {/* Ingredients */}
          {product.ingredients && product.ingredients.length > 0 && (
            <div className="flex gap-1 mt-2 flex-wrap">
              {product.ingredients.slice(0, 3).map((ing, i) => (
                <span key={i} className="text-[10px] bg-canvas border border-success/30 text-success rounded-full px-2 py-0.5">
                  {ing.ingredientName}
                </span>
              ))}
              {product.ingredients.length > 3 && (
                <span className="text-[10px] text-muted">+{product.ingredients.length - 3} khác</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function OperatorProductBatchPage() {
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [sortOrder, setSortOrder] = useState('');

  // Modal tạo/sửa
  const [modalOpen, setModalOpen] = useState(false);
  const [editProduct, setEditProduct] = useState(null);

  // Modal xóa
  const [deleteModal, setDeleteModal] = useState({ open: false, product: null });
  const [deleting, setDeleting] = useState(false);

  // Import/Export
  const [importModalOpen, setImportModalOpen] = useState(false);

  const imgSrc = (url) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    return `${BASE_URL}/api/auth${url}`;
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [catRes, ingRes, prodRes] = await Promise.all([
        operatorApi.getCategories(),
        operatorApi.getIngredients(),
        operatorApi.getProducts(),
      ]);
      setCategories(catRes.data?.data || []);
      setIngredients(ingRes.data?.data || []);
      setProducts(prodRes.data?.data || []);
    } catch {
      toast('Lỗi tải dữ liệu', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // Filter
  const filtered = useMemo(() => {
    let list = products;
    if (filterCat) list = list.filter(p => p.category === filterCat);
    if (search.trim()) {
      const q = normalize(search);
      list = list.filter(p => normalize(p.name).includes(q));
    }
    if (sortOrder === 'asc' || sortOrder === 'desc') {
      list = [...list].sort((a, b) => {
        const cmp = (a.name || '').localeCompare(b.name || '', 'vi', { sensitivity: 'base' });
        return sortOrder === 'asc' ? cmp : -cmp;
      });
    }
    return list;
  }, [products, filterCat, search, sortOrder]);

  const handleEdit = (product) => {
    setEditProduct(product);
    setModalOpen(true);
  };

  const handleCreate = () => {
    setEditProduct(null);
    setModalOpen(true);
  };

  const handleDeleteClick = (product) => {
    setDeleteModal({ open: true, product });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteModal.product) return;
    setDeleting(true);
    try {
      await operatorApi.deleteProduct(deleteModal.product.id);
      toast(`Đã xóa sản phẩm "${deleteModal.product.name}"`, 'success');
      setDeleteModal({ open: false, product: null });
      fetchData();
    } catch (e) {
      toast(e?.response?.data?.message || 'Lỗi xóa sản phẩm', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const [exporting, setExporting] = useState(false);

  const handleExportProducts = async () => {
    setExporting(true);
    try {
      const res = await operatorApi.exportFullList();
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const disposition = res.headers?.['content-disposition'] || '';
      const match = disposition.match(/filename="?([^"]+)"?/);
      a.download = match ? match[1] : 'danh-sach-san-pham.xlsx';
      a.click();
      URL.revokeObjectURL(url);
      toast(`Đã xuất file sản phẩm`, 'success');
    } catch (e) {
      toast(e?.response?.data?.message || 'Lỗi xuất file', 'error');
    } finally {
      setExporting(false);
    }
  };

  // Unique categories from products
  const catOptions = useMemo(() => {
    const set = new Set(products.map(p => p.category).filter(Boolean));
    return [...set].sort();
  }, [products]);

  return (
    <div className="h-full flex flex-col overflow-hidden bg-canvas">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 bg-surface border-b border-line-soft">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-lg font-bold text-ink">Sản phẩm</h1>
            <p className="text-xs text-muted mt-0.5">{filtered.length}/{products.length} sản phẩm</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Filter danh mục */}
            <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
              className="px-3 py-2 text-sm rounded-xl border border-line bg-canvas focus:outline-none focus:border-gold text-ink-2">
              <option value="">Tất cả danh mục</option>
              {catOptions.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            {/* Search */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Tìm tên sản phẩm..."
                className="pl-8 pr-3 py-2 text-sm rounded-xl border border-line bg-canvas focus:outline-none focus:border-gold w-48" />
            </div>

            <button
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : prev === 'desc' ? '' : 'asc')}
              title={sortOrder === 'asc' ? 'Đang sort A→Z' : sortOrder === 'desc' ? 'Đang sort Z→A' : 'Sort theo tên'}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-all
    ${sortOrder
                  ? 'border-gold text-gold bg-gold/10'
                  : 'border-line text-ink-2 hover:border-gold'}`}>
              {sortOrder === 'desc' ? <ArrowDownAZ size={14} /> : <ArrowUpAZ size={14} />}
              {sortOrder === 'asc' ? 'A → Z' : sortOrder === 'desc' ? 'Z → A' : 'Sort tên'}
            </button>

            {/* Import */}
            <button onClick={() => setImportModalOpen(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-line text-sm text-ink-2 hover:border-gold transition-all">
              <Upload size={14} /> Import
            </button>

            {/* Export */}
            <button onClick={handleExportProducts} disabled={exporting}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-line text-sm text-ink-2 hover:border-gold transition-all disabled:opacity-60">
              {exporting
                ? <span className="w-3.5 h-3.5 border-2 border-gold border-t-transparent rounded-full animate-spin" />
                : <Download size={14} />}
              Export
            </button>

            {/* Tạo mới */}
            <button onClick={handleCreate}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gold hover:bg-gold-deep text-white text-sm font-semibold transition-colors">
              <Plus size={15} /> Tạo mới
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-5">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted">
            <Package size={36} className="mb-2 opacity-30" />
            <p className="text-sm italic">
              {products.length === 0 ? 'Chưa có sản phẩm nào' : 'Không tìm thấy sản phẩm'}
            </p>
            {products.length === 0 && (
              <button onClick={handleCreate}
                className="mt-3 px-4 py-2 rounded-xl bg-gold text-white text-sm font-medium">
                Tạo sản phẩm đầu tiên
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {filtered.map(p => (
              <ProductCard key={p.id} product={p}
                onEdit={handleEdit}
                onDelete={handleDeleteClick}
                imgSrc={imgSrc} />
            ))}
          </div>
        )}
      </div>

      {/* Modal tạo/sửa */}
      <ProductFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={fetchData}
        editProduct={editProduct}
        categories={categories}
        ingredients={ingredients}
      />

      {/* Modal xóa */}
      <ConfirmDeleteModal
        open={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, product: null })}
        onConfirm={handleDeleteConfirm}
        itemName={deleteModal.product?.name || ''}
        deleting={deleting}
      />

      {/* Modal import */}
      <ImportProductsModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onDone={fetchData}
      />
    </div>
  );
}