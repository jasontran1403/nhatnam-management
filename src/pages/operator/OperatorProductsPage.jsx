// src/pages/operator/OperatorProductsPage.jsx
// FIX #3: Thêm nút Import/Export
// FIX #4: Thêm mã hàng (itemCode), danh mục con (subCategoryId) vào form sản phẩm
import { useLang } from '../../context/LangContext';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { operatorApi, uploadApi } from '../../api/services';
import { useToast } from '../../components/common/Toast';
import {
  Plus, Send, Trash2, Edit2, X, ChevronDown, ChevronUp,
  Package, AlertTriangle, CheckCircle, Image as ImageIcon,
  Loader2, Download, Upload,
} from 'lucide-react';

const DEFAULT_VAT = 8;
const VAT_OPTIONS = [0, 5, 8, 10];

function formatPrice(n) {
  return new Intl.NumberFormat('vi-VN').format(Math.round(n || 0));
}

function parsePriceInput(str) {
  return Number(String(str).replace(/[^0-9]/g, '')) || 0;
}

const emptyItem = () => ({
  _id: Date.now() + Math.random(),
  name: '',
  categoryName: '',
  categoryId: '',
  subCategoryId: '',
  itemCode: '',
  unit: '',
  basePrice: '',
  maxDiscountRate: 0,
  vatRate: DEFAULT_VAT,
  vatMode: 'INCLUSIVE',
  imageUrl: '',
  tiers: [],
  ingredients: [],
  existingProductId: null,
  isUpdate: false,
});

function TierRow({ tier, idx, onChange, onRemove }) {
  return (
    <div className="flex gap-2 items-center py-1.5 border-b border-line-soft last:border-0">
      <input
        className="flex-1 text-xs border border-line rounded-lg px-2 py-1.5 focus:outline-none focus:border-gold"
        {...{placeholder: t("operator","tier_name_placeholder")}}
        value={tier.tierName}
        onChange={e => onChange(idx, 'tierName', e.target.value)}
      />
      <input
        className="w-20 text-xs border border-line rounded-lg px-2 py-1.5 focus:outline-none focus:border-gold text-center"
        {...{placeholder: t("operator","from_qty_placeholder")}}
        type="number" min="0"
        value={tier.minQuantity}
        onChange={e => onChange(idx, 'minQuantity', e.target.value)}
      />
      <input
        className="w-24 text-xs border border-line rounded-lg px-2 py-1.5 focus:outline-none focus:border-gold text-right"
        {...{placeholder: t("common","price")}}
        type="text"
        value={tier.priceDisplay || ''}
        onChange={e => {
          const raw = e.target.value.replace(/[^0-9]/g, '');
          onChange(idx, 'price', raw);
          onChange(idx, 'priceDisplay', raw ? formatPrice(Number(raw)) : '');
        }}
      />
      <button onClick={() => onRemove(idx)} className="text-red-400 hover:text-red-600 dark:text-red-300 shrink-0">
        <Trash2 size={13} />
      </button>
    </div>
  );
}

function ProductItemCard({ item, idx, categories, ingredients, existingProducts, onUpdate, onRemove }) {
  const [expanded, setExpanded] = useState(true);
  const [uploading, setUploading] = useState(false);
  const toast = useToast();

  const update = (field, val) => onUpdate(idx, field, val);

  // Danh mục con của categoryId đang chọn
  const rootCats = useMemo(() => categories.filter(c => !c.parentId), [categories]);
  const subCats = useMemo(() => {
    if (!item.categoryId) return [];
    return categories.filter(c => String(c.parentId) === String(item.categoryId));
  }, [categories, item.categoryId]);

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      const res = await uploadApi.productImage(file);
      const url = res.data?.data?.imageUrl || res.data?.data;
      update('imageUrl', url);
    } catch {
      toast(t('common','error'), 'error');
    } finally {
      setUploading(false);
    }
  };

  const addTier = () => {
    update('tiers', [...(item.tiers || []), {
      tierName: '', minQuantity: 0, price: 0, priceDisplay: '', sortOrder: item.tiers?.length || 0,
    }]);
  };

  const updateTier = (tIdx, field, val) => {
    const tiers = [...(item.tiers || [])];
    tiers[tIdx] = { ...tiers[tIdx], [field]: val };
    update('tiers', tiers);
  };

  const removeTier = (tIdx) => {
    update('tiers', item.tiers.filter((_, i) => i !== tIdx));
  };

  return (
    <div className="bg-surface rounded-2xl border border-line-soft overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-canvas border-b border-line-soft">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-gold/10 text-gold flex items-center justify-center text-xs font-bold">
            {idx + 1}
          </div>
          <span className="text-sm font-semibold text-ink">
            {item.name || <span className="text-faint">Sản phẩm {idx + 1}</span>}
          </span>
          {item.itemCode && (
            <span className="text-[10px] font-mono bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/28 rounded-full px-2 py-0.5">
              {item.itemCode}
            </span>
          )}
          {item.isUpdate && (
            <span className="text-[10px] bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-500/28 rounded-full px-2 py-0.5">
              Cập nhật
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setExpanded(v => !v)} className="p-1.5 text-muted hover:text-ink">
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
          <button onClick={() => onRemove(idx)} className="p-1.5 text-red-400 hover:text-red-600 dark:text-red-300">
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="p-4 grid grid-cols-2 gap-3">
          {/* Existing product selector (for UPDATE batch) */}
          {item.isUpdate && (
            <div className="col-span-2">
              <label className="text-xs font-medium text-ink mb-1 block">
                Sản phẩm cần cập nhật *
              </label>
              <select
                className="w-full text-xs border border-line rounded-xl px-3 py-2 focus:outline-none focus:border-gold bg-surface"
                value={item.existingProductId || ''}
                onChange={e => {
                  const prod = existingProducts.find(p => p.id === Number(e.target.value));
                  if (prod) {
                    onUpdate(idx, 'existingProductId', prod.id);
                    onUpdate(idx, 'name', prod.name);
                    onUpdate(idx, 'categoryName', prod.category || '');
                    onUpdate(idx, 'categoryId', prod.categoryId ? String(prod.categoryId) : '');
                    onUpdate(idx, 'subCategoryId', prod.subCategoryId ? String(prod.subCategoryId) : '');
                    onUpdate(idx, 'itemCode', prod.itemCode || '');
                    onUpdate(idx, 'unit', prod.unit || '');
                    onUpdate(idx, 'basePrice', prod.basePrice || '');
                    onUpdate(idx, 'vatRate', prod.vatRate ?? DEFAULT_VAT);
                    onUpdate(idx, 'vatMode', prod.vatMode || 'INCLUSIVE');
                    onUpdate(idx, 'maxDiscountRate', prod.maxDiscountRate || 0);
                    onUpdate(idx, 'imageUrl', prod.imageUrl || '');
                  }
                }}
              >
                <option value="">— Chọn sản phẩm —</option>
                {existingProducts.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Name */}
          <div>
            <label className="text-xs font-medium text-ink mb-1 block">Tên sản phẩm *</label>
            <input
              className="w-full text-xs border border-line rounded-xl px-3 py-2 focus:outline-none focus:border-gold"
              placeholder="VD: Thịt heo ba chỉ"
              value={item.name}
              onChange={e => update('name', e.target.value)}
            />
          </div>

          {/* Item code — FIX #4 */}
          <div>
            <label className="text-xs font-medium text-ink mb-1 block">Mã hàng</label>
            <input
              className="w-full text-xs border border-line rounded-xl px-3 py-2 focus:outline-none focus:border-gold font-mono"
              placeholder="VD: SP-001, NUOC-DUA"
              value={item.itemCode}
              onChange={e => update('itemCode', e.target.value)}
            />
          </div>

          {/* Category — FIX #4: dùng ID thay vì tên */}
          <div>
            <label className="text-xs font-medium text-ink mb-1 block">Danh mục</label>
            <select
              className="w-full text-xs border border-line rounded-xl px-3 py-2 focus:outline-none focus:border-gold bg-surface"
              value={item.categoryId}
              onChange={e => {
                const cat = rootCats.find(c => String(c.id) === e.target.value);
                update('categoryId', e.target.value);
                update('categoryName', cat?.name || '');
                update('subCategoryId', '');
              }}
            >
              <option value="">— Chọn danh mục —</option>
              {rootCats.map(c => (
                <option key={c.id} value={String(c.id)}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Sub category — FIX #4 */}
          <div>
            <label className="text-xs font-medium text-ink mb-1 block">Danh mục con</label>
            <select
              className="w-full text-xs border border-line rounded-xl px-3 py-2 focus:outline-none focus:border-gold bg-surface"
              value={item.subCategoryId}
              onChange={e => update('subCategoryId', e.target.value)}
              disabled={!item.categoryId || subCats.length === 0}
            >
              <option value="">{!item.categoryId ? '— Chọn danh mục trước —' : subCats.length === 0 ? '— Không có danh mục con —' : '— Chọn danh mục con —'}</option>
              {subCats.map(c => (
                <option key={c.id} value={String(c.id)}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Unit */}
          <div>
            <label className="text-xs font-medium text-ink mb-1 block">Đơn vị</label>
            <input
              className="w-full text-xs border border-line rounded-xl px-3 py-2 focus:outline-none focus:border-gold"
              placeholder="kg, hộp, túi..."
              value={item.unit}
              onChange={e => update('unit', e.target.value)}
            />
          </div>

          {/* Base price */}
          <div>
            <label className="text-xs font-medium text-ink mb-1 block">Giá gốc (đ)</label>
            <input
              className="w-full text-xs border border-line rounded-xl px-3 py-2 focus:outline-none focus:border-gold text-right"
              placeholder="0"
              type="text"
              value={item.basePrice ? formatPrice(item.basePrice) : ''}
              onChange={e => {
                const raw = parsePriceInput(e.target.value);
                update('basePrice', raw);
              }}
            />
          </div>

          {/* VAT rate */}
          <div>
            <label className="text-xs font-medium text-ink mb-1 block">
              VAT (mặc định {DEFAULT_VAT}%)
            </label>
            <select
              className="w-full text-xs border border-line rounded-xl px-3 py-2 focus:outline-none focus:border-gold bg-surface"
              value={item.vatRate}
              onChange={e => update('vatRate', Number(e.target.value))}
            >
              {VAT_OPTIONS.map(v => (
                <option key={v} value={v}>{v}%</option>
              ))}
            </select>
          </div>

          {/* VAT mode */}
          <div>
            <label className="text-xs font-medium text-ink mb-1 block">Chế độ VAT</label>
            <select
              className="w-full text-xs border border-line rounded-xl px-3 py-2 focus:outline-none focus:border-gold bg-surface"
              value={item.vatMode}
              onChange={e => update('vatMode', e.target.value)}
            >
              <option value="INCLUSIVE">Đã tính trong giá (mặc định)</option>
              <option value="EXCLUSIVE">Cộng thêm ngoài giá</option>
            </select>
          </div>

          {/* Max discount */}
          <div>
            <label className="text-xs font-medium text-ink mb-1 block">
              Chiết khấu tối đa (%)
            </label>
            <input
              className="w-full text-xs border border-line rounded-xl px-3 py-2 focus:outline-none focus:border-gold text-center"
              type="number" min="0" max="100"
              placeholder="0 = không giới hạn"
              value={item.maxDiscountRate}
              onChange={e => update('maxDiscountRate', Math.min(100, Math.max(0, Number(e.target.value))))}
            />
          </div>

          {/* Image */}
          <div>
            <label className="text-xs font-medium text-ink mb-1 block">Ảnh sản phẩm</label>
            <div className="flex gap-2 items-center">
              <label className="flex-1 flex items-center gap-2 cursor-pointer border border-dashed border-line rounded-xl px-3 py-2 hover:border-gold transition-colors">
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
                {uploading
                  ? <Loader2 size={13} className="animate-spin text-gold" />
                  : <ImageIcon size={13} className="text-muted" />
                }
                <span className="text-xs text-muted">
                  {uploading ? 'Đang tải...': item.imageUrl ? 'Đổi ảnh' : 'Chọn ảnh'}
                </span>
              </label>
              {item.imageUrl && (
                <div className="w-10 h-10 rounded-lg overflow-hidden border border-line">
                  <img src={item.imageUrl.startsWith('http') ? item.imageUrl :
                    `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'}/api/auth${item.imageUrl}`}
                    alt="" className="w-full h-full object-cover" />
                </div>
              )}
            </div>
          </div>

          {/* Price tiers */}
          <div className="col-span-2">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-ink">Khung giá sỉ</label>
              <button onClick={addTier}
                className="flex items-center gap-1 text-[10px] text-gold hover:text-gold-deep transition-colors">
                <Plus size={11} /> Thêm tier
              </button>
            </div>
            {(item.tiers || []).length > 0 ? (
              <div className="border border-line-soft rounded-xl overflow-hidden">
                <div className="grid grid-cols-4 gap-0 px-3 py-1.5 bg-canvas text-[10px] font-medium text-muted">
                  <span>Tên tier</span>
                  <span className="text-center">Từ SL</span>
                  <span className="text-right">Giá</span>
                  <span></span>
                </div>
                <div className="px-3">
                  {item.tiers.map((t, ti) => (
                    <TierRow key={ti} tier={t} idx={ti} onChange={updateTier} onRemove={removeTier} />
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-faint italic">Chưa có khung giá sỉ</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function OperatorProductsPage() {
  const { t } = useLang();
  const toast = useToast();
  const [batchType, setBatchType] = useState('CREATE');
  const [note, setNote] = useState('');
  const [items, setItems] = useState([emptyItem()]);
  const [categories, setCategories] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [existingProducts, setExistingProducts] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    operatorApi.getCategories().then(r => setCategories(r.data?.data || [])).catch(() => {});
    operatorApi.getIngredients().then(r => setIngredients(r.data?.data || [])).catch(() => {});
    operatorApi.getProducts().then(r => setExistingProducts(r.data?.data || [])).catch(() => {});
  }, []);

  const addItem = () => {
    const item = emptyItem();
    item.isUpdate = batchType === 'UPDATE';
    setItems(prev => [...prev, item]);
  };

  const removeItem = (idx) => {
    if (items.length === 1) { toast('Phiếu phải có ít nhất 1 sản phẩm', 'warning'); return; }
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const updateItem = (idx, field, val) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: val } : item));
  };

  const handleBatchTypeChange = (type) => {
    setBatchType(type);
    setItems([{ ...emptyItem(), isUpdate: type === 'UPDATE' }]);
  };

  const validate = () => {
    for (const item of items) {
      if (!item.name?.trim()) return 'Vui lòng nhập tên cho tất cả sản phẩm';
      if (batchType === 'UPDATE' && !item.existingProductId)
        return 'Vui lòng chọn sản phẩm cần cập nhật';
    }
    return null;
  };

  // FIX #3: Export stub
  const handleExport = () => {
    toast('Chức năng Export sẽ được xử lý ở backend', 'info');
    // TODO: api.get('/api/operator/products/export', { responseType: 'blob' })
  };

  // FIX #3: Import stub
  const handleImport = (file) => {
    if (!file) return;
    toast('Chức năng Import sẽ được xử lý ở backend', 'info');
    // TODO: POST /api/operator/products/import với FormData
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) { toast(err, 'warning'); return; }

    try {
      setSubmitting(true);
      const payload = {
        type: batchType,
        note: note.trim() || null,
        items: items.map(item => ({
          ...(batchType === 'UPDATE' && item.existingProductId
            ? { existingProductId: item.existingProductId } : {}),
          name: item.name.trim(),
          categoryName: item.categoryName || null,
          categoryId: item.categoryId ? Number(item.categoryId) : null,
          subCategoryId: item.subCategoryId ? Number(item.subCategoryId) : null,
          itemCode: item.itemCode || null,
          unit: item.unit || null,
          basePrice: item.basePrice ? Number(item.basePrice) : null,
          maxDiscountRate: item.maxDiscountRate || 0,
          vatRate: item.vatRate ?? DEFAULT_VAT,
          vatMode: item.vatMode || 'INCLUSIVE',
          imageUrl: item.imageUrl || null,
          tiers: (item.tiers || []).map((t, i) => ({
            tierName: t.tierName,
            minQuantity: Number(t.minQuantity) || 0,
            price: Number(t.price) || 0,
            sortOrder: i,
          })),
          ingredients: item.ingredients || [],
        })),
      };

      await operatorApi.submitBatch(payload);
      toast('Phiếu đã được gửi, chờ Admin duyệt!', 'success');
      setSubmitted(true);
      setItems([emptyItem()]);
      setNote('');
    } catch (e) {
      toast(e.response?.data?.message || 'Lỗi khi gửi phiếu', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center">
          <CheckCircle size={32} className="text-emerald-500" />
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-ink">Phiếu đã được gửi!</p>
          <p className="text-sm text-muted mt-1">Admin sẽ xem xét và duyệt trong thời gian sớm nhất.</p>
        </div>
        <button
          onClick={() => setSubmitted(false)}
          className="px-6 py-2.5 bg-chrome text-white rounded-xl text-sm font-medium hover:bg-black transition-colors"
        >
          Tạo phiếu mới
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Page header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink">Gửi phiếu sản phẩm</h1>
          <p className="text-sm text-muted mt-1">
            Tạo phiếu thêm mới hoặc cập nhật sản phẩm — Admin sẽ duyệt trước khi áp dụng.
          </p>
        </div>
        {/* FIX #3: Import / Export buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <label className="flex items-center gap-2 px-3 py-2 rounded-xl border border-line text-sm text-ink-2 hover:border-gold cursor-pointer transition-all">
            <Upload size={14} /> Import
            <input type="file" accept=".xlsx,.csv" className="hidden" onChange={e => handleImport(e.target.files[0])} />
          </label>
          <button onClick={handleExport}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-line text-sm text-ink-2 hover:border-gold transition-all">
            <Download size={14} /> Export
          </button>
        </div>
      </div>

      {/* Batch type + note */}
      <div className="bg-surface rounded-2xl border border-line-soft p-4 mb-4">
        <div className="flex gap-3 mb-4">
          {['CREATE', 'UPDATE'].map(type => (
            <button
              key={type}
              onClick={() => handleBatchTypeChange(type)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium border-2 transition-all ${
                batchType === type
                  ? 'border-gold bg-gold/10 text-gold-deep'
                  : 'border-line text-muted hover:border-gold/50'
              }`}
            >
              {type === 'CREATE' ? '➕ Phiếu thêm mới' : '✏️ Phiếu chỉnh sửa'}
            </button>
          ))}
        </div>
        <div>
          <label className="text-xs font-medium text-ink mb-1.5 block">Ghi chú cho Admin</label>
          <textarea
            className="w-full text-sm border border-line rounded-xl px-3 py-2.5 focus:outline-none focus:border-gold resize-none"
            rows={2}
            placeholder="Lý do thêm/sửa, nguồn gốc sản phẩm..."
            value={note}
            onChange={e => setNote(e.target.value)}
          />
        </div>
      </div>

      {/* Items */}
      <div className="space-y-3 mb-4">
        {items.map((item, idx) => (
          <ProductItemCard
            key={item._id}
            item={item}
            idx={idx}
            categories={categories}
            ingredients={ingredients}
            existingProducts={existingProducts}
            onUpdate={updateItem}
            onRemove={removeItem}
          />
        ))}
      </div>

      {/* Add item */}
      <button
        onClick={addItem}
        className="w-full py-3 border-2 border-dashed border-line rounded-2xl text-sm text-muted hover:border-gold hover:text-gold transition-all flex items-center justify-center gap-2 mb-6"
      >
        <Plus size={16} /> Thêm sản phẩm vào phiếu
      </button>

      {/* Submit */}
      <div className="flex items-center gap-3">
        <div className="flex-1 text-sm text-muted">
          {items.length} sản phẩm · Loại phiếu: {batchType === 'CREATE' ? 'Thêm mới': 'Cập nhật'}
        </div>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="flex items-center gap-2 px-6 py-3 bg-chrome text-white rounded-xl text-sm font-semibold hover:bg-black transition-colors disabled:opacity-50"
        >
          {submitting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          {submitting ? 'Đang gửi...' : 'Gửi phiếu'}
        </button>
      </div>
    </div>
  );
}
