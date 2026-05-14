import { useState } from 'react';
import { X, Check } from 'lucide-react';

function formatPrice(price) {
  return new Intl.NumberFormat('vi-VN').format(price || 0) + ' đ';
}

export default function ProductVariantModal({ product, onClose, onAdd }) {
  const hasVariants = product.variants?.length > 0;
  const [selectedVariant, setSelectedVariant] = useState(
    hasVariants ? product.variants.find((v) => v.isDefault) || product.variants[0] : null
  );
  const [selectedPrice, setSelectedPrice] = useState(
    product.prices?.find((p) => p.isDefault) || product.prices?.[0] || null
  );

  const handleAdd = () => {
    if (!selectedPrice) return;
    onAdd(selectedVariant, selectedPrice);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#F0EBE3]">
          <div>
            <h2 className="font-semibold text-[#1C1C1E] text-sm" style={{ fontFamily: 'var(--font-display)' }}>
              {product.name}
            </h2>
            <p className="text-xs text-[#8E8878]">Chọn phân loại & mức giá</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[#8E8878] hover:bg-[#F0EBE3]">
            <X size={17} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Variants */}
          {hasVariants && (
            <div>
              <p className="text-xs font-semibold text-[#8E8878] uppercase tracking-wider mb-2">Phân loại</p>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVariant(v)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      selectedVariant?.id === v.id
                        ? 'border-[#C9A84C] bg-[#C9A84C]/10 text-[#C9A84C]'
                        : 'border-[#E8DDD0] text-[#8E8878] hover:border-[#C9A84C]'
                    }`}
                  >
                    {v.variantName}
                    {selectedVariant?.id === v.id && <Check size={11} className="inline ml-1" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Prices */}
          {product.prices?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-[#8E8878] uppercase tracking-wider mb-2">Mức giá</p>
              <div className="space-y-1.5">
                {product.prices.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPrice(p)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm transition-all ${
                      selectedPrice?.id === p.id
                        ? 'border-[#C9A84C] bg-[#C9A84C]/10'
                        : 'border-[#E8DDD0] hover:border-[#C9A84C]'
                    }`}
                  >
                    <span className={`font-medium ${selectedPrice?.id === p.id ? 'text-[#1C1C1E]' : 'text-[#8E8878]'}`}>
                      {p.priceName}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#C9A84C]">{formatPrice(p.price)}</span>
                      {selectedPrice?.id === p.id && <Check size={14} className="text-[#C9A84C]" />}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5">
          <button
            onClick={handleAdd}
            disabled={!selectedPrice}
            className="btn-gold w-full rounded-xl py-3 text-sm font-bold disabled:opacity-40"
          >
            Thêm vào giỏ — {selectedPrice ? formatPrice(selectedPrice.price) : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
