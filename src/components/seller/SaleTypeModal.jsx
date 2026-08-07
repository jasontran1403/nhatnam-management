/**
 * SaleTypeModal — hỏi khách hàng muốn mua theo thùng hay bán lẻ.
 */
import { X, Package, ShoppingBag } from 'lucide-react';
import { useLang } from '../../context/LangContext';

function formatPrice(price) {
  if (!price) return '0 đ';
  return new Intl.NumberFormat('vi-VN').format(Math.round(price)) + ' đ';
}

export default function SaleTypeModal({ product, onConfirm, onClose }) {
  const { t } = useLang();
  if (!product) return null;

  const defaultTier = product.priceTiers?.find(ti => ti.sortOrder === 0) || product.priceTiers?.[0];
  const unitPrice   = defaultTier?.price ?? product.basePrice ?? 0;
  const unitsPerBox = product.unitsPerBox;
  const unit        = product.unit || '';
  const boxPrice    = unitPrice * unitsPerBox;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface rounded-2xl shadow-2xl w-full max-w-xs animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-line-soft">
          <h3 className="font-semibold text-ink text-sm">{t('product', 'select_sale_type')} — {product.name}</h3>
          <button onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-faint hover:bg-surface-2">
            <X size={14} />
          </button>
        </div>

        {/* Options */}
        <div className="p-4 flex flex-col gap-3">
          {/* Box */}
          <button
            onClick={() => onConfirm({ saleType: 'BOX' })}
            className="flex items-center gap-3 p-4 rounded-xl border-2 border-line hover:border-gold hover:bg-canvas transition-all text-left group">
            <div className="w-10 h-10 rounded-full bg-gold/15 flex items-center justify-center shrink-0 group-hover:bg-gold/25 transition-colors">
              <Package size={20} className="text-gold" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-ink">{t('product', 'box')}</p>
              <p className="text-xs text-muted mt-0.5">
                {t('product', 'box_unit_count').replace('{n}', unitsPerBox).replace('{unit}', unit)}
              </p>
              <p className="text-xs font-bold text-gold mt-1">
                {formatPrice(boxPrice)} {t('product', 'per_box')}
              </p>
            </div>
          </button>

          {/* Retail */}
          <button
            onClick={() => onConfirm({ saleType: 'RETAIL' })}
            className="flex items-center gap-3 p-4 rounded-xl border-2 border-line hover:border-gold hover:bg-canvas transition-all text-left group">
            <div className="w-10 h-10 rounded-full bg-muted/10 flex items-center justify-center shrink-0 group-hover:bg-muted/20 transition-colors">
              <ShoppingBag size={20} className="text-muted" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-ink">{t('product', 'retail')}</p>
              <p className="text-xs text-muted mt-0.5">
                {t('product', 'per_unit').replace('{unit}', unit)}
              </p>
              <p className="text-xs font-bold text-gold mt-1">
                {formatPrice(unitPrice)} / {unit}
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
