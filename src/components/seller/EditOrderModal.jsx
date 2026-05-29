// src/components/seller/EditOrderModal.jsx
// Modal sửa đơn hàng đang ở trạng thái PREPARING
// Cho phép thay đổi: món, số lượng, giá override (như POS)
import { useLang } from '../../context/LangContext';
import { useState, useEffect, useCallback } from 'react';
import { X, Plus, Minus, Trash2, Save, AlertTriangle, Search } from 'lucide-react';
import { orderApi, productApi } from '../../api/services';
import { useToast } from '../common/Toast';

function formatPrice(n) {
  return new Intl.NumberFormat('vi-VN').format(Math.round(n || 0)) + ' đ';
}

let editItemCounter = 0;
const newId = () => ++editItemCounter;

// ─── Row item in edit modal ───────────────────────────────────────────────────
function EditItemRow({ item, onUpdateQty, onRemove, onPriceOverride }) {
  const [editingPrice, setEditingPrice] = useState(false);
  const [priceInput, setPriceInput] = useState('');

  const startEditPrice = () => {
    setPriceInput(String(Math.round(item.unitPrice)));
    setEditingPrice(true);
  };

  const confirmPrice = () => {
    const val = Number(String(priceInput).replace(/[^0-9]/g, ''));
    if (val > 0) onPriceOverride(item._editId, val);
    setEditingPrice(false);
  };

  return (
    <div className="flex items-start gap-3 py-3 border-b border-[#F0EBE3] last:border-0">
      {item.productImageUrl && (
        <img src={item.productImageUrl} alt={item.productName}
          className="w-10 h-10 rounded-lg object-cover shrink-0 border border-[#F0EBE3]" />
      )}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-[#1C1C1E] truncate">{item.productName}</p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {editingPrice ? (
            <div className="flex items-center gap-1">
              <input
                autoFocus
                value={priceInput}
                onChange={e => setPriceInput(e.target.value)}
                onBlur={confirmPrice}
                onKeyDown={e => { if (e.key === 'Enter') confirmPrice(); if (e.key === 'Escape') setEditingPrice(false); }}
                className="w-28 text-xs border border-[#C9A84C] rounded-lg px-2 py-1 text-center outline-none"
              />
              <span className="text-[10px] text-[#8E8878]">đ</span>
            </div>
          ) : (
            <button onClick={startEditPrice}
              className="text-xs font-semibold text-[#C9A84C] border border-[#C9A84C]/40 rounded-lg px-2 py-0.5 hover:bg-[#FDF8ED]">
              {formatPrice(item.unitPrice)}
            </button>
          )}
          {item.isManualPrice && (
            <span className="text-[10px] bg-amber-100 text-amber-600 rounded-full px-1.5 py-0.5">Giá tự nhập</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0 mt-1">
        <button onClick={() => onUpdateQty(item._editId, item.quantity - 1)}
          className="w-6 h-6 rounded-full bg-[#F0EBE3] flex items-center justify-center hover:bg-[#E8DDD0]">
          <Minus size={11} />
        </button>
        <span className="text-sm font-bold w-8 text-center">{item.quantity}</span>
        <button onClick={() => onUpdateQty(item._editId, item.quantity + 1)}
          className="w-6 h-6 rounded-full bg-[#F0EBE3] flex items-center justify-center hover:bg-[#E8DDD0]">
          <Plus size={11} />
        </button>
        <button onClick={() => onRemove(item._editId)}
          className="w-6 h-6 rounded-full bg-red-50 flex items-center justify-center text-red-400 hover:bg-red-100 ml-1">
          <Trash2 size={11} />
        </button>
      </div>

      <div className="text-right shrink-0 min-w-[72px] mt-1">
        <p className="text-xs font-bold text-[#1C1C1E]">
          {formatPrice(item.unitPrice * item.quantity)}
        </p>
      </div>
    </div>
  );
}

// ─── Product search panel ─────────────────────────────────────────────────────
function AddProductPanel({ warehouseId, onAdd }) {
  const [q, setQ] = useState('');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!warehouseId) return;
    setLoading(true);
    productApi.getAll({ page: 0, size: 100, warehouseId, search: q || undefined })
      .then(res => setProducts(res.data?.data?.content || []))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [warehouseId, q]);

  return (
    <div className="border-t border-[#F0EBE3] pt-3 mt-2">
      <p className="text-xs font-semibold text-[#5C4E3D] mb-2">{t('product','add_product')}</p>
      <div className="relative mb-2">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8E8878]" />
        <input value={q} onChange={e => setQ(e.target.value)}
          placeholder="Tìm sản phẩm..."
          className="w-full pl-8 pr-3 py-1.5 text-xs border border-[#E8DDD0] rounded-xl outline-none focus:border-[#C9A84C]" />
      </div>
      <div className="max-h-40 overflow-y-auto space-y-1">
        {loading
          ? <p className="text-xs text-[#8E8878] text-center py-2">Đang tải...</p>
          : products.length === 0
            ? <p className="text-xs text-[#8E8878] text-center py-2">Không tìm thấy</p>
            : products.map(p => (
              <button key={p.id} onClick={() => onAdd(p)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-[#FDF8ED] text-left transition-colors">
                {p.imageUrl && <img src={p.imageUrl} alt={p.name} className="w-8 h-8 rounded-lg object-cover shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[#1C1C1E] truncate">{p.name}</p>
                  <p className="text-[10px] text-[#8E8878]">{formatPrice(p.basePrice)}</p>
                </div>
                <Plus size={14} className="text-[#C9A84C] shrink-0" />
              </button>
            ))
        }
      </div>
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────
export default function EditOrderModal({open, order, onClose, onSaved }) {
  const { t } = useLang(); 
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);
  const [showAddPanel, setShowAddPanel] = useState(false);

  // Init items from order
  useEffect(() => {
    if (!open || !order) return;
    const mapped = (order.items || order.orderItems || []).map(i => ({
      _editId: newId(),
      productId: i.productId,
      productName: i.productName,
      productImageUrl: i.productImageUrl,
      unit: i.unit,
      quantity: Number(i.quantity),
      unitPrice: Number(i.unitPrice),
      basePrice: Number(i.basePrice || i.unitPrice),
      priceMode: i.priceMode || 'BASE',
      tierId: i.tierId,
      tierName: i.tierName,
      discountPercent: i.discountPercent,
      isManualPrice: false,
      saleType: i.saleType || 'RETAIL',
      unitsPerBox: i.unitsPerBox,
      notes: i.notes,
    }));
    setItems(mapped);
    setShowAddPanel(false);
  }, [open, order]);

  const updateQty = useCallback((editId, newQty) => {
    if (newQty <= 0) {
      setItems(prev => prev.filter(i => i._editId !== editId));
    } else {
      setItems(prev => prev.map(i => i._editId === editId ? { ...i, quantity: newQty } : i));
    }
  }, []);

  const removeItem = useCallback((editId) => {
    setItems(prev => prev.filter(i => i._editId !== editId));
  }, []);

  const priceOverride = useCallback((editId, price) => {
    setItems(prev => prev.map(i =>
      i._editId === editId ? { ...i, unitPrice: price, isManualPrice: true, priceMode: 'BASE' } : i
    ));
  }, []);

  const addProduct = useCallback((product) => {
    setItems(prev => {
      const existing = prev.find(i => i.productId === product.id);
      if (existing) {
        return prev.map(i =>
          i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, {
        _editId: newId(),
        productId: product.id,
        productName: product.name,
        productImageUrl: product.imageUrl,
        unit: product.unit || 'kg',
        quantity: 1,
        unitPrice: Number(product.basePrice),
        basePrice: Number(product.basePrice),
        priceMode: 'BASE',
        tierId: null,
        isManualPrice: false,
        saleType: 'RETAIL',
      }];
    });
  }, []);

  const handleSave = async () => {
    if (items.length === 0) { toast('Đơn hàng cần có ít nhất 1 sản phẩm', 'warning'); return; }
    setSaving(true);
    try {
      const payload = {
        items: items.map(i => ({
          productId: i.productId,
          quantity: i.quantity,
          priceMode: i.isManualPrice ? 'BASE' : (i.priceMode || 'BASE'),
          tierId: i.isManualPrice ? null : i.tierId,
          sentUnitPrice: i.unitPrice,
          isManualPrice: i.isManualPrice,
          saleType: i.saleType || 'RETAIL',
          notes: i.notes,
          discountPercent: i.discountPercent,
        })),
      };
      await orderApi.updateOrderItems(order.id, payload);
      toast('Đã cập nhật đơn hàng', 'success');
      onSaved?.();
      onClose();
    } catch (err) {
      toast(err?.response?.data?.message || 'Lỗi khi cập nhật đơn hàng', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!open || !order) return null;

  const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#F0EBE3] shrink-0">
          <div>
            <h3 className="font-bold text-[#1C1C1E] text-base">Sửa đơn hàng</h3>
            <p className="text-xs text-[#8E8878] mt-0.5">{order.orderCode}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-[#8E8878] hover:text-red-400 hover:bg-red-50 rounded-xl">
            <X size={18} />
          </button>
        </div>

        {/* Warning */}
        <div className="mx-5 mt-3 px-3 py-2 bg-amber-50 rounded-xl border border-amber-200 flex gap-2 items-start shrink-0">
          <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-700">
            Khi lưu: tồn kho cũ sẽ được hoàn lại, tồn kho mới sẽ được trừ theo danh sách sửa.
          </p>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {items.length === 0 ? (
            <p className="text-sm text-[#8E8878] text-center py-6">Chưa có sản phẩm nào</p>
          ) : (
            items.map(item => (
              <EditItemRow
                key={item._editId}
                item={item}
                onUpdateQty={updateQty}
                onRemove={removeItem}
                onPriceOverride={priceOverride}
              />
            ))
          )}

          {/* Add product toggle */}
          <button onClick={() => setShowAddPanel(v => !v)}
            className="w-full mt-3 py-2 rounded-xl border-2 border-dashed border-[#E8DDD0] text-[#8E8878] text-xs font-semibold flex items-center justify-center gap-1.5 hover:border-[#C9A84C] hover:text-[#C9A84C] transition-colors">
            <Plus size={13} /> Thêm sản phẩm
          </button>

          {showAddPanel && (
            <AddProductPanel
              warehouseId={order.warehouseId}
              onAdd={addProduct}
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-3 border-t border-[#F0EBE3] shrink-0">
          <div className="flex justify-between text-sm font-bold text-[#1C1C1E] mb-3">
            <span>Tổng ({items.length} món)</span>
            <span className="text-[#C9A84C]">{formatPrice(subtotal)}</span>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} disabled={saving}
              className="flex-1 py-2.5 rounded-xl border border-[#E8DDD0] text-sm text-[#5C4E3D] font-semibold hover:bg-[#F0EBE3] transition-colors disabled:opacity-50">
              Hủy
            </button>
            <button onClick={handleSave} disabled={saving || items.length === 0}
              className="flex-1 py-2.5 rounded-xl bg-[#C9A84C] text-white text-sm font-bold flex items-center justify-center gap-2 hover:bg-[#b8973d] transition-colors disabled:opacity-50">
              {saving
                ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Đang lưu...</>
                : <><Save size={14} /> Lưu thay đổi</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
