import { useState } from 'react';
import { X, Check } from 'lucide-react';
import { useLang } from '../../context/LangContext';

function formatPrice(price) {
  return new Intl.NumberFormat('vi-VN').format(price || 0) + ' đ';
}

export default function ProductVariantModal({ product, onClose, onAdd }) {
  const { t } = useLang();
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
      <div className="relative bg-surface rounded-2xl shadow-2xl w-full max-w-sm animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-line-soft">
          <div>
            <h2 className="font-semibold text-ink text-sm" style={{ fontFamily: 'var(--font-display)' }}>
              {product.name}
            </h2>
            <p className="text-xs text-muted">{t('product', 'select_variant_price')}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted hover:bg-surface-2">
            <X size={17} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Variants */}
          {hasVariants && (
            <div>
              <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">{t('product', 'variant_label')}</p>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVariant(v)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      selectedVariant?.id === v.id
                        ? 'border-gold bg-gold/10 text-gold'
                        : 'border-line text-muted hover:border-gold'
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
              <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">{t('product', 'price_tier_label')}</p>
              <div className="space-y-1.5">
                {product.prices.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPrice(p)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm transition-all ${
                      selectedPrice?.id === p.id
                        ? 'border-gold bg-gold/10'
                        : 'border-line hover:border-gold'
                    }`}
                  >
                    <span className={`font-medium ${selectedPrice?.id === p.id ? 'text-ink' : 'text-muted'}`}>
                      {p.priceName}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gold">{formatPrice(p.price)}</span>
                      {selectedPrice?.id === p.id && <Check size={14} className="text-gold" />}
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
            {t('product', 'add_to_cart_price')} {selectedPrice ? formatPrice(selectedPrice.price) : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
