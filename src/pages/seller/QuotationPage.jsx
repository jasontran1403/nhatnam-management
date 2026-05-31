import { useLang } from '../../context/LangContext';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Search, Trash2, X, FileText, ChevronDown, ArrowUpDown, ArrowUp, ArrowDown,
  Plus, Check, PackageX,
} from 'lucide-react';
import { productApi, categoryApi, downloadBlob, quotationApi } from '../../api/services';
import { useToast } from '../../components/common/Toast';
import { useAuth } from '../../context/AuthContext';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

const VAT_RATES = [0, 5, 8, 10, 12];

// ── Helpers ────────────────────────────────────────────────────────────────
const normalize = (str) =>
  (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** Làm tròn đến hàng đơn vị (Math.round) */
const roundUnit = (n) => Math.round(n);

/** Format số VND */
const fmt = (n) =>
  new Intl.NumberFormat('vi-VN').format(roundUnit(n || 0)) + ' đ';

/**
 * Tính giá trước thuế và giá sau thuế từ giá chọn + VAT config
 * INCLUSIVE: giá chọn = giá SAU thuế → giá TRƯỚC thuế = price / (1 + rate/100)
 * EXCLUSIVE: giá chọn = giá TRƯỚC thuế → giá SAU thuế = price * (1 + rate/100)
 */
function calcPrices(price, vatRate, vatMode) {
  const rate = vatRate ?? 0;
  const mode = vatMode ?? 'INCLUSIVE';
  if (rate === 0) return { preTax: roundUnit(price), postTax: roundUnit(price) };
  if (mode === 'INCLUSIVE') {
    const preTax = price / (1 + rate / 100);
    return { preTax: roundUnit(preTax), postTax: roundUnit(price) };
  }
  // EXCLUSIVE
  const postTax = price * (1 + rate / 100);
  return { preTax: roundUnit(price), postTax: roundUnit(postTax) };
}

function getImgSrc(url) {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${BASE_URL}/api/auth${url}`;
}

let idCounter = 0;
const newId = () => ++idCounter;

// ── PricePickerModal ───────────────────────────────────────────────────────
// Hiện khi click sản phẩm: chọn giá, VAT rate, VAT mode
function PricePickerModal({ product, existing, onConfirm, onClose }) {
  const hasTiers = product.priceTiers && product.priceTiers.length > 0;

  const [selectedTierId, setSelectedTierId] = useState(existing?.tierId ?? null);
  const [vatRate, setVatRate] = useState(existing?.vatRate ?? (product.vatRate ?? 0));
  const [vatMode, setVatMode] = useState(existing?.vatMode ?? (product.vatMode ?? 'INCLUSIVE'));

  // Giá đang chọn
  const selectedPrice = useMemo(() => {
    if (selectedTierId !== null) {
      const tier = product.priceTiers?.find(t => t.id === selectedTierId);
      return tier?.price ?? product.basePrice ?? 0;
    }
    return product.basePrice ?? 0;
  }, [selectedTierId, product]);

  const { preTax, postTax } = useMemo(
    () => calcPrices(selectedPrice, vatRate, vatMode),
    [selectedPrice, vatRate, vatMode]
  );

  const handleConfirm = () => {
    onConfirm({ tierId: selectedTierId, vatRate, vatMode, unitPrice: selectedPrice });
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-fadeIn">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#C9A84C] to-[#b8963d] px-5 py-4 flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-white/70 text-[10px] uppercase tracking-widest font-semibold">Chọn giá & VAT</p>
            <h3 className="text-white font-bold text-sm mt-0.5 truncate">{product.name}</h3>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 shrink-0 ml-2">
            <X size={14} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Chọn giá */}
          <div>
            <p className="text-[11px] font-bold text-[#8E8878] uppercase tracking-wider mb-2">Loại giá</p>
            <div className="space-y-2">
              {/* Giá lẻ */}
              <button
                onClick={() => setSelectedTierId(null)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all
                  ${selectedTierId === null
                    ? 'border-sky-400 bg-sky-50'
                    : 'border-[#E8DDD0] hover:border-sky-300 hover:bg-sky-50/40'}`}
              >
                <div className="flex items-center gap-2">
                  {selectedTierId === null && <Check size={13} className="text-sky-500" />}
                  <span className="text-sm font-semibold text-[#1C1C1E]">Giá lẻ</span>
                </div>
                <span className="text-sm font-bold text-sky-600">{fmt(product.basePrice)}</span>
              </button>

              {/* Các tier */}
              {hasTiers && product.priceTiers
                .slice().sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
                .map((tier, idx) => (
                  <button
                    key={tier.id}
                    onClick={() => setSelectedTierId(tier.id)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all
                      ${selectedTierId === tier.id
                        ? 'border-orange-400 bg-orange-50'
                        : 'border-[#E8DDD0] hover:border-orange-300 hover:bg-orange-50/40'}`}
                  >
                    <div className="flex items-center gap-2">
                      {selectedTierId === tier.id && <Check size={13} className="text-orange-500" />}
                      <span className="text-sm font-semibold text-[#1C1C1E]">
                        {tier.tierName || `Sỉ ${idx + 1}`}
                      </span>
                      <span className="text-[10px] text-[#8E8878]">
                        {tier.minQuantity ?? 0}{tier.maxQuantity ? `–${tier.maxQuantity}` : '+'}
                      </span>
                    </div>
                    <span className="text-sm font-bold text-orange-600">{fmt(tier.price)}</span>
                  </button>
                ))
              }
            </div>
          </div>

          {/* VAT Rate */}
          <div>
            <p className="text-[11px] font-bold text-[#8E8878] uppercase tracking-wider mb-2">Tỷ suất VAT</p>
            <div className="flex gap-1.5 flex-wrap">
              {VAT_RATES.map(r => (
                <button
                  key={r}
                  onClick={() => setVatRate(r)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors
                    ${vatRate === r
                      ? 'bg-[#C9A84C] text-white border-[#C9A84C]'
                      : 'bg-white text-[#8E8878] border-[#E8DDD0] hover:border-[#C9A84C]'}`}
                >
                  {r}%
                </button>
              ))}
            </div>
          </div>

          {/* VAT Mode */}
          <div>
            <p className="text-[11px] font-bold text-[#8E8878] uppercase tracking-wider mb-2">Loại VAT</p>
            <div className="flex rounded-xl border border-[#E8DDD0] overflow-hidden text-xs">
              {[
                ['INCLUSIVE', 'Trong giá'],
                ['EXCLUSIVE', 'Ngoài giá'],
              ].map(([val, label], i) => (
                <button
                  key={val}
                  onClick={() => setVatMode(val)}
                  className={`flex-1 py-2 font-semibold transition-colors
                    ${i > 0 ? 'border-l border-[#E8DDD0]' : ''}
                    ${vatMode === val ? 'bg-[#C9A84C] text-white' : 'text-[#8E8878] hover:bg-[#F0EBE3]'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Preview tính toán */}
          <div className="bg-[#FAF7F2] rounded-xl p-3 border border-[#F0EBE3] space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-[#8E8878]">Giá trước thuế</span>
              <span className="font-semibold text-[#1C1C1E]">{fmt(preTax)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[#8E8878]">VAT ({vatRate}% — {vatMode === 'INCLUSIVE' ? 'trong giá' : 'ngoài giá'})</span>
              <span className="font-semibold text-[#C9A84C]">{fmt(postTax - preTax)}</span>
            </div>
            <div className="flex justify-between text-xs pt-1 border-t border-[#E8DDD0]">
              <span className="text-[#8E8878]">Giá sau thuế</span>
              <span className="font-bold text-[#1C1C1E]">{fmt(postTax)}</span>
            </div>
          </div>
        </div>

        <div className="px-4 pb-4 flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-[#E8DDD0] text-[#8E8878] text-sm font-medium hover:bg-[#F0EBE3] transition-colors">
            Huỷ
          </button>
          <button onClick={handleConfirm}
            className="flex-1 py-2.5 rounded-xl bg-[#C9A84C] text-white text-sm font-bold hover:bg-[#b8963d] transition-colors">
            {existing ? 'Cập nhật' : 'Thêm vào báo giá'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── QuotationCartItem ──────────────────────────────────────────────────────
function QuotationCartItem({ item, onEdit, onRemove }) {
  const { preTax, postTax } = calcPrices(item.unitPrice, item.vatRate, item.vatMode);
  const tierLabel = item.tierId
    ? (item.tierName || 'Giá sỉ')
    : 'Giá lẻ';

  return (
    <div className="flex items-start gap-3 py-3 border-b border-[#F0EBE3] last:border-0">
      {/* Ảnh */}
      <div className="w-10 h-10 rounded-lg bg-[#F0EBE3] overflow-hidden shrink-0 mt-0.5">
        {getImgSrc(item.productImageUrl)
          ? <img src={getImgSrc(item.productImageUrl)} alt={item.productName} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center text-base">🍽️</div>
        }
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-[#1C1C1E] truncate">{item.productName}</p>

        {/* Badges */}
        <div className="flex items-center gap-1 flex-wrap mt-0.5">
          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold border
            ${item.tierId
              ? 'bg-orange-50 text-orange-700 border-orange-200'
              : 'bg-sky-50 text-sky-700 border-sky-200'}`}>
            {tierLabel}
          </span>
          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold border bg-amber-50 text-amber-700 border-amber-200">
            VAT {item.vatRate}%
          </span>
          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold border bg-[#F0EBE3] text-[#8E8878] border-[#E8DDD0]">
            {item.vatMode === 'INCLUSIVE' ? 'Trong giá' : 'Ngoài giá'}
          </span>
        </div>

        {/* Giá */}
        <div className="mt-1 space-y-0.5">
          <div className="flex justify-between text-[10px]">
            <span className="text-[#8E8878]">Trước thuế</span>
            <span className="font-semibold text-[#1C1C1E]">{fmt(preTax)}</span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span className="text-[#8E8878]">Sau thuế</span>
            <span className="font-bold text-[#C9A84C]">{fmt(postTax)}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <button onClick={() => onRemove(item.id)}
          className="w-5 h-5 rounded-full text-[#C4B9A8] hover:text-red-400 hover:bg-red-50 flex items-center justify-center transition-colors">
          <Trash2 size={11} />
        </button>
        <button onClick={() => onEdit(item)}
          className="text-[9px] px-2 py-1 rounded-lg border border-[#E8DDD0] text-[#8E8878] hover:border-[#C9A84C] hover:text-[#C9A84C] transition-colors">
          Sửa
        </button>
      </div>
    </div>
  );
}

// ── ExportModal ────────────────────────────────────────────────────────────
function ExportModal({ onConfirm, onClose, exporting }) {
  const [customerName, setCustomerName] = useState('');
  const [content, setContent] = useState('');

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-fadeIn">
        <div className="bg-gradient-to-r from-[#C9A84C] to-[#b8963d] px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-white/70 text-[10px] uppercase tracking-widest font-semibold">Xuất báo giá</p>
            <h3 className="text-white font-bold text-base mt-0.5">Thông tin báo giá</h3>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30">
            <X size={15} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-[#8E8878] uppercase tracking-wider mb-1.5">
              Kính gửi
            </label>
            <input
              type="text"
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
              placeholder="Để trống → QUÝ KHÁCH HÀNG"
              className="w-full rounded-xl border-2 border-[#E8DDD0] px-4 py-2.5 text-sm focus:outline-none focus:border-[#C9A84C] bg-[#FAFAF8]"
            />
            <p className="text-[10px] text-[#C4B9A8] mt-1">
              Nếu để trống sẽ hiển thị: <em>QUÝ KHÁCH HÀNG</em>
            </p>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#8E8878] uppercase tracking-wider mb-1.5">
              Nội dung báo giá
            </label>
            <input
              type="text"
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="VD: SẢN PHẨM ICEHOT & RICH'S"
              className="w-full rounded-xl border-2 border-[#E8DDD0] px-4 py-2.5 text-sm focus:outline-none focus:border-[#C9A84C] bg-[#FAFAF8]"
            />
          </div>
        </div>

        <div className="px-5 pb-5 flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-[#E8DDD0] text-[#8E8878] text-sm font-semibold hover:bg-[#F0EBE3] transition-colors">
            Huỷ
          </button>
          <button
            onClick={() => onConfirm({ customerName: customerName.trim(), content: content.trim() })}
            disabled={exporting}
            className="flex-1 py-2.5 rounded-xl bg-[#C9A84C] text-white text-sm font-bold hover:bg-[#b8963d] disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
          >
            {exporting
              ? <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Đang tạo...</>
              : <><FileText size={14} /> Tạo PDF</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ProductCard (dành riêng cho Quotation — không hiện tồn kho) ─────────────
function QuotationProductCard({ product, onAdd, isInCart }) {
  const priceVal = product.basePrice ?? 0;
  const hasTiers = product.priceTiers && product.priceTiers.length > 0;
  const imageUrl = getImgSrc(product.imageUrl);

  return (
    <button
      onClick={() => onAdd(product)}
      className="card-product rounded-xl overflow-hidden text-left w-full flex flex-col cursor-pointer active:scale-95 transition-transform relative"
    >
      {/* Badge đã thêm */}
      {isInCart && (
        <div className="absolute top-2 right-2 z-30 w-5 h-5 rounded-full bg-[#C9A84C] flex items-center justify-center shadow">
          <Check size={11} className="text-white" />
        </div>
      )}

      <div className="relative aspect-square bg-[#F0EBE3] overflow-hidden w-full">
        {imageUrl
          ? <img src={imageUrl} alt={product.name} className="w-full h-full object-cover"
              onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
          : null
        }
        <div className="absolute inset-0 items-center justify-center text-[#C4B9A8] text-3xl"
          style={{ display: imageUrl ? 'none' : 'flex' }}>
          🍽️
        </div>

        <div className="absolute inset-x-0 bottom-0 z-20
          bg-gradient-to-t from-black/80 via-black/45 to-transparent
          px-2.5 pt-8 pb-2 flex flex-col gap-0.5">
          <p className="text-white text-[11px] sm:text-xs font-semibold leading-tight line-clamp-2 drop-shadow">
            {product.name}
          </p>
          <div className="flex items-center justify-between gap-1 mt-0.5">
            <div className="flex flex-col gap-0.5">
              <span className="text-[#FFD97D] text-[11px] sm:text-xs font-bold drop-shadow">
                {new Intl.NumberFormat('vi-VN').format(Math.round(priceVal))} đ
              </span>
              {hasTiers && (
                <span className="text-[9px] bg-orange-400/80 text-white rounded px-1 py-0.5 font-semibold w-fit">
                  Có giá sỉ
                </span>
              )}
            </div>
            {product.sku && (
              <span className="text-[8px] text-white/70 font-mono">{product.sku}</span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

// ── QuotationPage (main) ────────────────────────────────────────────────────
export default function QuotationPage() {
  const toast = useToast();
  const { user } = useAuth();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);

  const [inputSearch, setInputSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [sortField, setSortField] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  // Cart: list sản phẩm đã thêm vào báo giá
  const [cartItems, setCartItems] = useState([]);

  // Modal chọn giá
  const [pickerProduct, setPickerProduct] = useState(null);   // product đang mở picker
  const [pickerExisting, setPickerExisting] = useState(null); // cartItem nếu đang edit

  // Modal export
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Load sản phẩm và danh mục
  useEffect(() => {
    setLoading(true);
    productApi.getAll({ page: 0, size: 500 })
      .then(res => setProducts(res.data?.data?.content || []))
      .catch(() => toast('Không thể tải sản phẩm', 'error'))
      .finally(() => setLoading(false));

    categoryApi.getAll()
      .then(res => setCategories(res.data?.data || res.data || []))
      .catch(() => {});
  }, []);

  // Debounce search
  const searchDebounceRef = useRef(null);
  const handleSearchChange = (val) => {
    setInputSearch(val);
    clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => setSearchQuery(val), 300);
  };

  // Filter + sort sản phẩm
  const filteredProducts = useMemo(() => {
    let list = products;
    if (activeCategory !== 'ALL')
      list = list.filter(p => p.categoryId == activeCategory || p.category === activeCategory);
    if (searchQuery.trim()) {
      const q = normalize(searchQuery);
      list = list.filter(p => normalize(p.name).includes(q));
    }
    if (sortField) {
      list = [...list].sort((a, b) => {
        if (sortField === 'name') {
          const av = normalize(a.name), bv = normalize(b.name);
          return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
        }
        if (sortField === 'price') {
          const av = a.basePrice ?? 0, bv = b.basePrice ?? 0;
          return sortDir === 'asc' ? av - bv : bv - av;
        }
        return 0;
      });
    }
    return list;
  }, [products, activeCategory, searchQuery, sortField, sortDir]);

  // IDs đã trong giỏ
  const cartProductIds = useMemo(() => new Set(cartItems.map(i => i.productId)), [cartItems]);

  // Click sản phẩm: mở picker
  const handleAddProduct = useCallback((product) => {
    setPickerProduct(product);
    setPickerExisting(null);
  }, []);

  // Click "Sửa" item trong giỏ
  const handleEditItem = useCallback((item) => {
    const product = products.find(p => p.id === item.productId);
    if (!product) return;
    setPickerProduct(product);
    setPickerExisting(item);
  }, [products]);

  // Confirm từ PricePickerModal
  const handlePickerConfirm = useCallback(({ tierId, vatRate, vatMode, unitPrice }) => {
    const tierName = tierId
      ? pickerProduct.priceTiers?.find(t => t.id === tierId)?.tierName || 'Giá sỉ'
      : null;

    if (pickerExisting) {
      // Edit existing
      setCartItems(prev => prev.map(i =>
        i.id === pickerExisting.id
          ? { ...i, tierId, tierName, vatRate, vatMode, unitPrice }
          : i
      ));
    } else {
      // Add new (replace nếu cùng sản phẩm)
      const newItem = {
        id: newId(),
        productId: pickerProduct.id,
        productName: pickerProduct.name,
        productImageUrl: pickerProduct.imageUrl,
        sku: pickerProduct.sku || '',
        packagingDescription: pickerProduct.packagingDescription || '',
        storageInstruction: pickerProduct.storageInstruction || '',
        unit: pickerProduct.unit || '',
        tierId,
        tierName,
        vatRate,
        vatMode,
        unitPrice,
      };
      setCartItems(prev => {
        // Nếu đã có sản phẩm này rồi → replace
        const exists = prev.find(i => i.productId === pickerProduct.id);
        if (exists) return prev.map(i => i.productId === pickerProduct.id ? { ...newItem, id: i.id } : i);
        return [...prev, newItem];
      });
    }

    setPickerProduct(null);
    setPickerExisting(null);
  }, [pickerProduct, pickerExisting]);

  const handleRemoveItem = useCallback((id) => {
    setCartItems(prev => prev.filter(i => i.id !== id));
  }, []);

  // Xuất PDF
  const handleExport = useCallback(async ({ customerName, content }) => {
    if (cartItems.length === 0) {
      toast('Vui lòng thêm ít nhất 1 sản phẩm', 'warning');
      return;
    }
    setExporting(true);
    try {
      const payload = {
        customerName: customerName || null,
        quotationContent: content || null,
        items: cartItems.map(i => ({
          productId: i.productId,
          tierId: i.tierId ?? null,
          vatRate: i.vatRate,
          vatMode: i.vatMode,
        })),
      };
      const res = await quotationApi.exportPdf(payload);
      const now = new Date();
      const stamp = `${now.getDate().toString().padStart(2, '0')}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getFullYear()}`;
      downloadBlob(res.data, `BaoGia_${stamp}.pdf`);
      toast('Xuất báo giá thành công', 'success');
      setExportModalOpen(false);
    } catch (err) {
      toast(err?.response?.data?.message || 'Lỗi khi tạo báo giá', 'error');
    } finally {
      setExporting(false);
    }
  }, [cartItems, toast]);

  return (
    <div className="h-full flex flex-col lg:flex-row overflow-hidden bg-[#FAF7F2]">

      {/* ── Product panel ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Search + Filter */}
        <div className="flex-shrink-0 px-3 pt-3 pb-2 bg-white border-b border-[#F0EBE3] space-y-2">
          <div className="flex items-center justify-between">
            <h1 className="text-base font-bold text-[#1C1C1E]">Tạo báo giá</h1>
            {/* Mobile: nút tạo báo giá */}
            <button
              onClick={() => setExportModalOpen(true)}
              disabled={cartItems.length === 0}
              className="lg:hidden flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#C9A84C] text-white text-xs font-bold disabled:opacity-40 transition-colors"
            >
              <FileText size={13} />
              Xuất ({cartItems.length})
            </button>
          </div>

          {/* Search */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8878]" />
              <input
                type="text"
                placeholder="Tìm sản phẩm (có thể không dấu)..."
                value={inputSearch}
                onChange={e => handleSearchChange(e.target.value)}
                className="input-elegant w-full rounded-xl pl-9 pr-4 py-2 text-sm"
              />
            </div>
            {/* Sort */}
            {[{ field: 'name', label: 'Tên' }, { field: 'price', label: 'Giá' }].map(({ field, label }) => {
              const active = sortField === field;
              const Icon = active ? (sortDir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
              return (
                <button key={field} onClick={() => {
                  if (!active) { setSortField(field); setSortDir('asc'); }
                  else if (sortDir === 'asc') setSortDir('desc');
                  else { setSortField(null); setSortDir('asc'); }
                }}
                  className={`shrink-0 flex items-center gap-1 px-3 py-2 rounded-xl border text-xs font-medium transition-colors
                    ${active ? 'border-[#C9A84C] bg-[#C9A84C]/10 text-[#C9A84C]' : 'border-[#E8DDD0] text-[#8E8878] hover:border-[#C9A84C]'}`}>
                  <Icon size={13} />{label}
                </button>
              );
            })}
          </div>

          {/* Categories */}
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
            <button onClick={() => setActiveCategory('ALL')}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                ${activeCategory === 'ALL' ? 'bg-[#C9A84C] text-white' : 'bg-[#F0EBE3] text-[#8E8878] hover:bg-[#E8DDD0]'}`}>
              Tất cả
            </button>
            {categories.map(cat => (
              <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                  ${activeCategory === cat.id ? 'bg-[#C9A84C] text-white' : 'bg-[#F0EBE3] text-[#8E8878] hover:bg-[#E8DDD0]'}`}>
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Product grid */}
        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="flex justify-center items-center h-40">
              <div className="w-8 h-8 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-[#8E8878] gap-2">
              <span className="text-3xl">🔍</span>
              <p className="text-sm">Không tìm thấy sản phẩm</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4">
              {filteredProducts.map(p => (
                <QuotationProductCard
                  key={p.id}
                  product={p}
                  onAdd={handleAddProduct}
                  isInCart={cartProductIds.has(p.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Cart / Quotation list panel (Desktop) ── */}
      <div className="hidden lg:flex flex-col w-80 xl:w-96 border-l border-[#E8DDD0] h-full bg-white">
        {/* Header */}
        <div className="px-4 py-3 border-b border-[#F0EBE3] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-[#C9A84C]" />
            <span className="font-semibold text-sm text-[#1C1C1E]">Danh sách báo giá</span>
            {cartItems.length > 0 && (
              <span className="bg-[#C9A84C] text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {cartItems.length}
              </span>
            )}
          </div>
          {cartItems.length > 0 && (
            <button onClick={() => setCartItems([])}
              className="flex items-center gap-1 text-[10px] text-red-400 hover:text-red-600">
              <Trash2 size={11} /> Xoá tất cả
            </button>
          )}
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-4">
          {cartItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-[#C4B9A8] gap-2 py-8">
              <FileText size={32} strokeWidth={1} />
              <p className="text-sm text-center">Chưa có sản phẩm nào<br/>Click sản phẩm để thêm</p>
            </div>
          ) : (
            cartItems.map(item => (
              <QuotationCartItem
                key={item.id}
                item={item}
                onEdit={handleEditItem}
                onRemove={handleRemoveItem}
              />
            ))
          )}
        </div>

        {/* Footer: nút xuất */}
        <div className="px-4 pb-4 pt-3 border-t border-[#F0EBE3]">
          <p className="text-[10px] text-[#C4B9A8] mb-2 text-center">
            {cartItems.length} sản phẩm trong báo giá
          </p>
          <button
            onClick={() => setExportModalOpen(true)}
            disabled={cartItems.length === 0}
            className="w-full py-3 rounded-xl bg-[#C9A84C] hover:bg-[#b8963d] text-white text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            <FileText size={15} />
            Tạo báo giá PDF
          </button>
        </div>
      </div>

      {/* ── Modals ── */}
      {pickerProduct && (
        <PricePickerModal
          product={pickerProduct}
          existing={pickerExisting}
          onConfirm={handlePickerConfirm}
          onClose={() => { setPickerProduct(null); setPickerExisting(null); }}
        />
      )}

      {exportModalOpen && (
        <ExportModal
          onConfirm={handleExport}
          onClose={() => setExportModalOpen(false)}
          exporting={exporting}
        />
      )}
    </div>
  );
}