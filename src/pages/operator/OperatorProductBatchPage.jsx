import { useLang } from '../../context/LangContext';
import ReactDOM from 'react-dom';
import { useState, useEffect, useRef } from 'react';
import { operatorApi } from '../../api/operatorApi';
import { useToast } from '../../components/common/Toast';
import {
  Plus, Trash2, X, ChevronDown, ChevronUp,
  ImagePlus, Send, Box, Search, ToggleLeft, ToggleRight,
  Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle2
} from 'lucide-react';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:9261';
const VAT_RATES = [0, 5, 8, 10];
const UNITS = ['Kg', 'Gr', 'Lít', 'ml', 'Cái', 'Hộp', 'Cây', 'Bó', 'Túi', 'Gói', 'Chai', 'Lon', 'Phần'];

// 3 khung giá cố định mặc định
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
  hasWholesale: false,  // toggle bật/tắt giá sỉ
  tiers: DEFAULT_TIERS.map(t => ({ ...t, _id: `${t._id}-${Date.now()}` })),
  ingredients: [emptyIngredient()],
  _expanded: true,
  _uploading: false,
});

// Format số nguyên với dấu phẩy
const fmtNum = (v) => {
  const n = parseInt(String(v ?? '').replace(/[^0-9]/g, ''), 10);
  return isNaN(n) ? '' : n.toLocaleString('vi-VN');
};

const normalize = (str) =>
  (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();


function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

export default function OperatorProductBatchPage() {
  const { t } = useLang();
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
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importResult, setImportResult] = useState(null); // {imported/updated, skipped, errors}
  const importFileRef = useRef(null);

  const downloadBlob = (data, filename) => {
    const url = URL.createObjectURL(data);
    const a = document.createElement('a'); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const handleExportTemplate = async () => {
    setExporting(true);
    try {
      const res = batchType === 'CREATE'
        ? await operatorApi.exportTemplate()
        : await operatorApi.exportFullList();
      downloadBlob(res.data, batchType === 'CREATE'
        ? 'product-import-template.xlsx'
        : 'product-update-template.xlsx');
    } catch { toast('Không thể tải template', 'error'); }
    finally { setExporting(false); }
  };

  const handleImportFile = async (file) => {
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const res = batchType === 'CREATE'
        ? await operatorApi.importProducts(file)
        : await operatorApi.importUpdateProducts(file);
      const data = res.data?.data;
      setImportResult(data);
      const count = data?.imported ?? data?.updated ?? 0;
      if ((data?.errors?.length ?? 0) === 0) {
        toast(`✅ ${batchType === 'CREATE' ? 'Tạo' : 'Cập nhật'} ${count} sản phẩm thành công!`, 'success');
      } else {
        toast(`⚠️ ${count} thành công, ${data.skipped} dòng lỗi`, 'warning');
      }
    } catch (e) {
      toast(e?.response?.data?.message || 'Lỗi import', 'error');
    } finally { setImporting(false); }
  };


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
    const hasTiers = p.tiers && p.tiers.length > 0;
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
      hasWholesale: hasTiers,
      tiers: hasTiers
        ? p.tiers.map((t, idx) => ({
          _id: `tier-${idx}-${Date.now()}`,
          tierName: t.tierName || `Sỉ ${idx + 1}`,
          minQty: t.minQuantity ?? DEFAULT_TIERS[idx]?.minQty ?? 0,
          maxQty: t.maxQuantity ?? DEFAULT_TIERS[idx]?.maxQty ?? null,
          price: t.price != null ? String(t.price) : '',
        }))
        : DEFAULT_TIERS.map(t => ({ ...t, _id: `${t._id}-${Date.now()}`, price: '' })),
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
      toast(t('common', 'error'), 'error');
      setItem(itemId, { _uploading: false });
    }
  };

  const handleSubmit = async () => {
    for (const it of items) {
      // Validate tên
      if (!it.name.trim()) return toast(t('product', 'product_name_required'), 'error');
      // Validate đơn vị
      if (!it.unit.trim()) return toast(`Đơn vị tính của "${it.name}" không được trống`, 'error');
      // Validate basePrice
      const price = Number(String(it.basePrice).replace(/[^0-9]/g, ''));
      if (!price || price <= 0) return toast(`Giá bán lẻ "${it.name}" không hợp lệ`, 'error');
      // Validate unitsPerBox
      if (it.unitsPerBox && parseInt(it.unitsPerBox) < 1)
        return toast(`Số đơn vị/thùng của "${it.name}" không hợp lệ`, 'error');
      // Validate tiers nếu bật giá sỉ
      if (it.hasWholesale) {
        const p1 = Number(String(it.tiers[0].price).replace(/[^0-9]/g, ''));
        const p2 = Number(String(it.tiers[1].price).replace(/[^0-9]/g, ''));
        const p3 = Number(String(it.tiers[2].price).replace(/[^0-9]/g, ''));
        if (!p1 || !p2 || !p3)
          return toast(`"${it.name}": Vui lòng nhập đủ giá cho cả 3 khung sỉ`, 'error');
        if (!(p1 > p2))
          return toast(`"${it.name}": Giá khung 1 phải lớn hơn giá khung 2`, 'error');
        if (!(p2 > p3))
          return toast(`"${it.name}": Giá khung 2 phải lớn hơn giá khung 3`, 'error');
      }
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
          // Chỉ gửi tiers nếu bật giá sỉ
          tiers: it.hasWholesale
            ? it.tiers.map((tier, idx) => ({
              tierName: tier.tierName,
              minQuantity: tier.minQty,
              maxQuantity: tier.maxQty,
              price: Number(String(tier.price).replace(/[^0-9]/g, '')),
              sortOrder: idx,
            }))
            : [],
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
            <h1 className="text-lg font-bold text-[#1C1C1E]">Tạo sản phẩm</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-xl border border-[#E8DDD0] overflow-hidden bg-[#FAF7F2]">
              {['CREATE', 'UPDATE'].map(type => (
                <button key={type} onClick={() => { setBatchType(type); setItems([emptyItem()]); setNote(''); }}
                  className={`px-4 py-2 text-xs font-semibold transition-colors ${batchType === type ? 'bg-[#C9A84C] text-white' : 'text-[#8E8878] hover:text-[#1C1C1E]'}`}>
                  {type === 'CREATE' ? 'Tạo mới' : t('common', 'update')}
                </button>
              ))}
            </div>

            {/* Nút Export Template */}
            <button
              onClick={handleExportTemplate}
              disabled={exporting}
              title={batchType === 'CREATE' ? 'Tải template tạo mới' : 'Tải full list để cập nhật'}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E8DDD0] bg-white text-[#5C5C5C] hover:border-[#C9A84C] hover:text-[#C9A84C] text-xs font-semibold transition-colors disabled:opacity-50">
              {exporting
                ? <div className="w-3.5 h-3.5 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
                : <Download size={13} />}
              {batchType === 'CREATE' ? 'Tải template' : 'Tải full list'}
            </button>

            {/* Nút Import */}
            <label
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E8DDD0] bg-white
    text-[#5C5C5C] hover:border-emerald-400 hover:text-emerald-600 text-xs font-semibold
    transition-colors cursor-pointer ${importing ? 'opacity-50 pointer-events-none' : ''}`}
              title="Import từ file Excel">
              {importing
                ? <div className="w-3.5 h-3.5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                : <Upload size={13} />}
              Import Excel
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={e => { handleImportFile(e.target.files[0]); e.target.value = ''; }}
              />
            </label>

            <button onClick={handleSubmit} disabled={submitting}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#C9A84C] hover:bg-[#A07830] text-white text-xs font-semibold disabled:opacity-50 transition-colors">
              <Send size={13} />
              {submitting ? 'Đang submit...' : 'Submit'}
            </button>
          </div>
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
      </div>

      {importResult && (
        <ImportResultPanel
          result={importResult}
          batchType={batchType}
          onClose={() => setImportResult(null)}
        />
      )}

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

// ── ProductSearchModal ────────────────────────────────────────────────────
function ProductSearchModal({ open, onClose, products, search, onSearchChange, onSelect, imgSrc }) {
  if (!open) return null;
  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h3 className="font-semibold text-lg">Chọn sản phẩm cần cập nhật</h3>
          <button onClick={onClose} className="text-[#8E8878] hover:text-red-500"><X size={20} /></button>
        </div>
        <div className="p-4 border-b">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#C4B9A8]" />
            <input value={search} onChange={e => onSearchChange(e.target.value)}
              placeholder="Tìm theo tên sản phẩm..."
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-[#E8DDD0] focus:border-[#C9A84C] focus:outline-none text-sm"
              autoFocus />
          </div>
        </div>
        <div className="flex-1 overflow-auto p-2">
          {products.length === 0 ? (
            <div className="text-center py-12 text-[#8E8878] italic">Không tìm thấy sản phẩm nào</div>
          ) : (
            products.map(p => (
              <div key={p.id} onClick={() => onSelect(p.id)}
                className="flex items-center gap-3 px-4 py-3 hover:bg-[#FAF7F2] rounded-xl cursor-pointer transition-colors">
                {p.imageUrl && (
                  <img src={imgSrc(p.imageUrl)} alt={p.name} className="w-10 h-10 object-cover rounded-lg" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-[#1C1C1E] truncate">{p.name}</p>
                  <p className="text-xs text-[#8E8878]">
                    {p.category} · {p.unit} · {Number(p.basePrice || 0).toLocaleString('vi-VN')}đ
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

// ── ProductItemCard ───────────────────────────────────────────────────────
function ProductItemCard({ item, idx, batchType, categories, ingredients, products,
  imgSrc, onUpdate, onRemove, onToggle, onUpload, onSelectProduct }) {

  const addIngredient = () => onUpdate({ ingredients: [...item.ingredients, emptyIngredient()] });
  const removeIngredient = (iid) => {
    if (item.ingredients.length <= 1) return;
    onUpdate({ ingredients: item.ingredients.filter(i => i._id !== iid) });
  };
  const setIng = (iid, patch) =>
    onUpdate({ ingredients: item.ingredients.map(i => i._id === iid ? { ...i, ...patch } : i) });

  // Toggle giá sỉ
  const toggleWholesale = () => {
    onUpdate({
      hasWholesale: !item.hasWholesale,
      // Reset tiers về mặc định khi bật
      tiers: !item.hasWholesale
        ? DEFAULT_TIERS.map(t => ({ ...t, _id: `${t._id}-${Date.now()}`, price: '' }))
        : item.tiers,
    });
  };

  // Cập nhật giá 1 tier (chỉ giá, không đổi qty range)
  const setTierPrice = (tierId, newPrice) => {
    onUpdate({
      tiers: item.tiers.map(t => t._id === tierId ? { ...t, price: newPrice } : t),
    });
  };

  // Tính giá thùng preview (theo tier 1 nếu có sỉ, không thì basePrice)
  const basePrice0 = Number(String(
    item.hasWholesale ? (item.tiers[0]?.price ?? item.basePrice) : item.basePrice
  ).replace(/[^0-9]/g, ''));
  const unitsPerBoxNum = parseInt(item.unitsPerBox, 10);
  const boxPrice = !isNaN(unitsPerBoxNum) && unitsPerBoxNum > 0 && basePrice0 > 0
    ? basePrice0 * unitsPerBoxNum : null;

  return (
    <div className="bg-white rounded-2xl border border-[#EDE8E0] shadow-sm overflow-hidden">
      {/* Card Header */}
      <div className="flex items-center gap-3 px-5 py-3 bg-[#FDFAF6] border-b border-[#F0EBE3]">
        <div className="w-6 h-6 rounded-full bg-[#C9A84C]/20 flex items-center justify-center flex-shrink-0">
          <span className="text-[11px] font-bold text-[#C9A84C]">{idx + 1}</span>
        </div>
        <span className="flex-1 text-sm font-semibold text-[#1C1C1E] truncate">
          {item.name || <span className="text-[#B0A898] font-normal">Sản phẩm mới</span>}
        </span>
        {item.hasWholesale && (
          <span className="text-[10px] bg-orange-50 text-orange-600 border border-orange-200 rounded-full px-2 py-0.5 font-medium">
            Có giá sỉ
          </span>
        )}
        {item.unitsPerBox && parseInt(item.unitsPerBox) > 0 && (
          <span className="text-[10px] bg-amber-50 text-amber-600 border border-amber-200 rounded-full px-2 py-0.5 font-medium flex items-center gap-1">
            <Box size={9} /> {item.unitsPerBox} {item.unit || 'đvt'}/thùng
          </span>
        )}
        <button onClick={onToggle} className="p-1 text-[#B0A898] hover:text-[#1C1C1E]">
          {item._expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
        <button onClick={onRemove} className="p-1 text-[#B0A898] hover:text-red-500">
          <Trash2 size={14} />
        </button>
      </div>

      {item._expanded && (
        <div className="p-5 space-y-5">
          {/* Chọn sản phẩm cập nhật (UPDATE mode) */}
          {batchType === 'UPDATE' && (
            <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
              <label className="block text-xs font-semibold text-blue-700 mb-2">Chọn sản phẩm cần cập nhật</label>
              <button onClick={onSelectProduct}
                className="w-full px-4 py-3 bg-white border border-[#E8DDD0] hover:border-[#C9A84C] rounded-xl text-left flex items-center justify-between transition-colors">
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
                flex items-center justify-center cursor-pointer hover:border-[#C9A84C] transition-all overflow-hidden">
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
                  <select value={item.unit} onChange={e => onUpdate({ unit: e.target.value, unitsPerBox: '' })}
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
              <label className="block text-xs font-semibold text-[#5C5C5C] mb-1">
                Giá bán lẻ (đ) <span className="text-red-400">*</span>
              </label>
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

          {/* ── Quy cách thùng ── */}
          <div className="rounded-xl border border-[#E8DDD0] overflow-hidden">
            <button type="button" onClick={() => onUpdate({ unitsPerBox: item.unitsPerBox ? '' : '1' })}
              className="w-full flex items-center justify-between px-4 py-3 bg-[#FAF7F2] hover:bg-[#F5F0E8] transition-colors">
              <div className="flex items-center gap-2">
                <Box size={14} className="text-[#C9A84C]" />
                <span className="text-xs font-semibold text-[#1C1C1E]">Bán theo thùng / quy cách</span>
                <span className="text-[10px] text-[#B0A898]">(tuỳ chọn)</span>
              </div>
              <div className={`w-9 h-5 rounded-full transition-colors relative flex-shrink-0 ${item.unitsPerBox ? 'bg-[#C9A84C]' : 'bg-[#D8D0C8]'}`}>
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${item.unitsPerBox ? 'left-4' : 'left-0.5'}`} />
              </div>
            </button>
            {item.unitsPerBox !== '' && (
              <div className="px-4 py-3 bg-white border-t border-[#F0EBE3] space-y-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#5C5C5C] whitespace-nowrap font-medium">1 thùng =</span>
                    <input type="text" inputMode="numeric" value={item.unitsPerBox}
                      onFocus={(e) => requestAnimationFrame(() => e.target.select())}
                      onMouseUp={(e) => e.preventDefault()}
                      onChange={e => onUpdate({ unitsPerBox: e.target.value.replace(/[^0-9]/g, '') })}
                      placeholder="12"
                      className="w-20 px-3 py-2 text-sm font-bold text-center rounded-xl border-2 border-[#C9A84C] focus:outline-none bg-[#FFFDF7]" />
                    <span className="text-xs text-[#5C5C5C] font-medium">{item.unit || 'đơn vị'}</span>
                  </div>
                  {boxPrice && (
                    <div className="flex items-center gap-2 bg-[#FDF8ED] rounded-xl px-3 py-2 border border-[#EDD98A]">
                      <Box size={13} className="text-[#C9A84C]" />
                      <span className="text-xs text-[#8E8878]">Giá 1 thùng:</span>
                      <span className="text-sm font-bold text-[#C9A84C]">{fmtNum(boxPrice)} đ</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Giá sỉ (toggle + 3 khung cố định) ── */}
          <div className="rounded-xl border border-[#E8DDD0] overflow-hidden">
            {/* Toggle header */}
            <button type="button" onClick={toggleWholesale}
              className="w-full flex items-center justify-between px-4 py-3 bg-[#FAF7F2] hover:bg-[#F5F0E8] transition-colors">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[#1C1C1E]">Có giá sỉ (khung giá)</span>
                <span className="text-[10px] text-[#B0A898]">(tuỳ chọn)</span>
              </div>
              <div className={`w-9 h-5 rounded-full transition-colors relative flex-shrink-0 ${item.hasWholesale ? 'bg-[#C9A84C]' : 'bg-[#D8D0C8]'}`}>
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${item.hasWholesale ? 'left-4' : 'left-0.5'}`} />
              </div>
            </button>

            {item.hasWholesale && (
              <div className="px-4 py-3 bg-white border-t border-[#F0EBE3]">
                <p className="text-[11px] text-[#8E8878] mb-3">
                  3 khung giá cố định. Giá khung 1 &gt; khung 2 &gt; khung 3.
                </p>
                <div className="space-y-2">
                  {item.tiers.map((tier, ti) => (
                    <div key={tier._id}
                      className="grid items-center gap-3 bg-[#FDFAF6] rounded-xl px-3 py-2.5 border border-[#F0EBE3]"
                      style={{ gridTemplateColumns: '80px 1fr 1fr 1fr' }}>
                      {/* Tên khung */}
                      <span className="text-xs font-semibold text-[#5C5C5C]">{tier.tierName}</span>
                      {/* Từ qty */}
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-[#B0A898]">Từ</span>
                        <span className="text-xs font-medium text-[#1C1C1E] bg-[#F5F0E8] rounded-lg px-2 py-1">
                          {tier.minQty}
                        </span>
                      </div>
                      {/* Đến qty */}
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-[#B0A898]">Đến</span>
                        <span className="text-xs font-medium text-[#1C1C1E] bg-[#F5F0E8] rounded-lg px-2 py-1">
                          {tier.maxQty != null ? tier.maxQty : '∞'}
                        </span>
                      </div>
                      {/* Giá */}
                      <div>
                        <PriceInput
                          value={tier.price}
                          onChange={val => setTierPrice(tier._id, val)}
                          placeholder={`Giá ${tier.tierName}`}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Validate preview */}
                {item.hasWholesale && (() => {
                  const p1 = Number(String(item.tiers[0]?.price ?? '').replace(/[^0-9]/g, ''));
                  const p2 = Number(String(item.tiers[1]?.price ?? '').replace(/[^0-9]/g, ''));
                  const p3 = Number(String(item.tiers[2]?.price ?? '').replace(/[^0-9]/g, ''));
                  if (p1 && p2 && p3) {
                    if (!(p1 > p2)) return <p className="text-[11px] text-red-500 mt-2">⚠ Giá Sỉ 1 phải lớn hơn Sỉ 2</p>;
                    if (!(p2 > p3)) return <p className="text-[11px] text-red-500 mt-2">⚠ Giá Sỉ 2 phải lớn hơn Sỉ 3</p>;
                    return <p className="text-[11px] text-emerald-600 mt-2">✓ Giá hợp lệ: {p1.toLocaleString('vi-VN')} &gt; {p2.toLocaleString('vi-VN')} &gt; {p3.toLocaleString('vi-VN')}</p>;
                  }
                  return null;
                })()}
              </div>
            )}
          </div>

          {/* Nguyên liệu */}
          <div className="rounded-xl border border-[#E8DDD0] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-[#FAF7F2]">
              <span className="text-xs font-semibold text-[#5C5C5C]">Nguyên liệu ({item.ingredients.length})</span>
              <button onClick={addIngredient} className="flex items-center gap-1 text-xs text-[#C9A84C] hover:text-[#A07830] font-semibold">
                <Plus size={12} /> Thêm
              </button>
            </div>
            <div className="px-4 py-3 space-y-2">
              {item.ingredients.map((ing) => (
                <div key={ing._id} className="grid gap-2 items-center bg-[#FDFAF6] rounded-xl px-3 py-2 border border-[#F0EBE3]"
                  style={{ gridTemplateColumns: '1fr 80px auto 28px' }}>
                  <IngredientSelect
                    ingredients={ingredients}
                    value={ing.ingredientId}
                    onChange={val => setIng(ing._id, { ingredientId: val })}
                  />
                  <input type="number" step="0.001" value={ing.quantity}
                    onChange={e => setIng(ing._id, { quantity: e.target.value })}
                    className="text-xs text-center rounded-lg border border-[#E8DDD0] py-1.5 focus:outline-none focus:border-[#C9A84C]" />
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

// ── PriceInput ─────────────────────────────────────────────────────────────
function PriceInput({ value, onChange, placeholder }) {
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
      placeholder={placeholder}
      className="w-full px-3 py-2 text-sm rounded-xl border border-[#E8DDD0] bg-white focus:outline-none focus:border-[#C9A84C] text-right"
    />
  );
}

// ── IngredientSelect ──────────────────────────────────────────────────────
function IngredientSelect({ ingredients, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const selected = ingredients.find(i => String(i.id) === String(value));

  const filtered = ingredients.filter(i =>
    normalize(i.name).includes(normalize(search))
  );

  const handleOpen = () => { setSearch(''); setOpen(true); };
  const handleSelect = (id) => { onChange(id); setOpen(false); setSearch(''); };

  return (
    <>
      <div onClick={handleOpen}
        className="border border-[#E8DDD0] rounded-lg px-3 py-1.5 text-xs cursor-pointer hover:border-[#C9A84C] truncate">
        {selected ? selected.name : 'Chọn nguyên liệu...'}
      </div>

      {open && ReactDOM.createPortal(
        <div className="fixed inset-0 z-[11000] flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg h-[60svh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-lg">Chọn nguyên liệu</h3>
              <button onClick={() => { setOpen(false); setSearch(''); }}
                className="text-[#8E8878] hover:text-red-500">
                <X size={20} />
              </button>
            </div>

            {/* Search */}
            <div className="p-4 border-b">
              <div className="relative">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#C4B9A8]" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Tìm nguyên liệu..."
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-[#E8DDD0] focus:border-[#C9A84C] focus:outline-none text-sm"
                  autoFocus
                />
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-auto p-2">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-[#B0A898]">
                  <Search size={32} className="mb-2 opacity-30" />
                  <p className="text-sm italic">Không tìm thấy nguyên liệu nào</p>
                </div>
              ) : (
                filtered.map(i => (
                  <div key={i.id} onClick={() => handleSelect(i.id)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-colors
                      ${String(i.id) === String(value)
                        ? 'bg-[#C9A84C]/10 border border-[#C9A84C]/30'
                        : 'hover:bg-[#FAF7F2]'}`}>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[#1C1C1E] truncate text-sm">{i.name}</p>
                      {i.unit && <p className="text-xs text-[#8E8878]">ĐVT: {i.unit}</p>}
                    </div>
                    {String(i.id) === String(value) && (
                      <span className="text-[10px] bg-[#C9A84C] text-white rounded-full px-2 py-0.5 font-semibold shrink-0">
                        Đang chọn
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

function ImportResultPanel({ result, batchType, onClose }) {
  const successCount = result?.imported ?? result?.updated ?? 0;
  const skippedCount = result?.skipped ?? 0;
  const errors = result?.errors ?? [];
  const hasErrors = errors.length > 0;
  const action = batchType === 'CREATE' ? 'tạo mới' : 'cập nhật';

  return (
    <div className={`rounded-2xl border p-4 space-y-3 shadow-sm
      ${hasErrors
        ? 'bg-amber-50 border-amber-200'
        : 'bg-emerald-50 border-emerald-200'}`}>

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {hasErrors
            ? <span className="text-lg">⚠️</span>
            : <span className="text-lg">✅</span>}
          <div>
            <p className={`text-sm font-bold ${hasErrors ? 'text-amber-800' : 'text-emerald-800'}`}>
              Kết quả import {action}
            </p>
            <p className="text-xs text-[#8E8878] mt-0.5">
              <span className="font-semibold text-emerald-700">{successCount} thành công</span>
              {skippedCount > 0 && (
                <span className="ml-2 font-semibold text-red-600">{skippedCount} lỗi</span>
              )}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-[#8E8878] hover:bg-white/60 transition-colors flex-shrink-0">
          <X size={14} />
        </button>
      </div>

      {/* Stats */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex items-center gap-2 bg-white/70 rounded-xl px-3 py-2 border border-emerald-200">
          <CheckCircle2 size={14} className="text-emerald-600" />
          <div>
            <p className="text-[10px] text-[#8E8878]">
              {batchType === 'CREATE' ? 'Đã tạo' : 'Đã cập nhật'}
            </p>
            <p className="text-sm font-bold text-emerald-700">{successCount} sản phẩm</p>
          </div>
        </div>
        {skippedCount > 0 && (
          <div className="flex items-center gap-2 bg-white/70 rounded-xl px-3 py-2 border border-red-200">
            <AlertCircle size={14} className="text-red-500" />
            <div>
              <p className="text-[10px] text-[#8E8878]">Bỏ qua (lỗi)</p>
              <p className="text-sm font-bold text-red-600">{skippedCount} dòng</p>
            </div>
          </div>
        )}
      </div>

      {/* Error list */}
      {hasErrors && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-amber-800">
            Chi tiết lỗi ({errors.length} dòng):
          </p>
          <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
            {errors.map((err, i) => (
              <div
                key={i}
                className="flex items-start gap-2 bg-white/80 rounded-xl px-3 py-2
                           border border-red-100 text-xs">
                <AlertCircle size={12} className="text-red-400 flex-shrink-0 mt-0.5" />
                <span className="text-red-700 break-words">{err}</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-amber-700 italic">
            💡 Sửa các dòng lỗi trong file Excel và import lại — các dòng đã thành công
            sẽ báo trùng tên và bị bỏ qua an toàn (không bị tạo đôi).
          </p>
        </div>
      )}
    </div>
  );
}
