// src/components/seller/ProductCard.jsx
// UPDATED: Allow adding out-of-stock items — they go to cart but order button will be disabled
import { useLang } from '../../context/LangContext';
import { PackageX } from 'lucide-react';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

function formatPrice(price) {
  if (price == null) return '0 đ';
  return new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(price) + ' đ';
}

export default function ProductCard({ product, onAdd, cartQty = 0, ingStockMap = {} }) {
  const { t } = useLang();

  const priceVal = product.basePrice ?? 0;
  const hasTiers = product.priceTiers && product.priceTiers.length > 0;

  const imageUrl = product.imageUrl
    ? product.imageUrl.startsWith('http')
      ? product.imageUrl
      : `${BASE_URL}/api/auth${product.imageUrl}`
    : null;

  const stock = product.stockQuantity != null ? Number(product.stockQuantity) : null;
  const isOutOfStock = stock !== null && stock == 0;
  // NOTE: No longer disabled when out of stock — allow adding to draft/cart
  // The order button in CartPanel will be disabled instead
  const remaining = stock !== null ? Math.max(0, stock) : null;

  const getIngStock = (ing) => {
    const key = String(ing.ingredientId);
    const fromMap = ingStockMap[key];
    return fromMap != null ? fromMap : (ing.stockQuantity != null ? Number(ing.stockQuantity) : null);
  };

  return (
    <button
      onClick={() => onAdd(product)}
      className="card-product rounded-xl overflow-hidden text-left w-full flex flex-col
        cursor-pointer active:scale-95 transition-transform"
    >
      <div className="relative aspect-square bg-surface-2 overflow-hidden w-full">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={product.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'flex';
            }}
          />
        ) : null}

        <div
          className="absolute inset-0 items-center justify-center text-faint text-3xl"
          style={{ display: imageUrl ? 'none' : 'flex' }}
        >
          🍽️
        </div>

        {/* Out of stock overlay — dimmed but still clickable */}
        {isOutOfStock && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
            <div className="flex flex-col items-center text-white gap-1">
              <PackageX size={18} />
              <span className="text-[11px] font-semibold">{t('status', 'out_of_stock')}</span>
              <span className="text-[9px] text-white/70">Thêm vào nháp</span>
            </div>
          </div>
        )}

        {/* Badge TỒN KHO — góc phải TRÊN của ảnh, size gấp đôi so với cũ
            (text-[8px]/[9px] → text-[16px]/[18px]).
            Đặt z-30 để nằm trên overlay hết hàng (z-10) và overlay giá (z-20). */}
        {product.ingredients && product.ingredients.length > 0
          ? (
            <div className="absolute top-2 right-2 z-30 flex flex-col items-end gap-1 max-w-[85%]">
              {product.ingredients.slice(0, 2).map(ing => {
                const qty = getIngStock(ing);
                const low = qty !== null && qty > 0 && qty <= 5;
                const none = qty !== null && qty <= 0;
                const qtyStr = qty != null
                  ? parseFloat(qty.toFixed(2)).toLocaleString('vi-VN')
                  : '?';
                return (
                  <span key={ing.ingredientId} className={`
                    text-[16px] rounded-md px-3 py-1 leading-none font-semibold whitespace-nowrap shadow-lg
                    ${none ? 'text-red-100 bg-red-700/85' : low ? 'text-yellow-100 bg-yellow-700/80' : 'text-white bg-black/60'}
                  `}>
                    {qtyStr} {ing.unit || ''}
                  </span>
                );
              })}
            </div>
          )
          : stock !== null && (
            <div className="absolute top-2 right-2 z-30 max-w-[85%]">
              <span className={`
                inline-block text-[18px] rounded-full px-3 py-1 leading-none font-semibold whitespace-nowrap shadow-lg
                ${isOutOfStock ? 'text-red-100 bg-red-700/85' : remaining <= 5 ? 'text-yellow-100 bg-yellow-700/80' : 'text-white bg-black/60'}
              `}>
                {isOutOfStock
                  ? t('status', 'out_of_stock')
                  : `${t('product', 'remaining_stock')} ${parseFloat(Number(remaining).toFixed(3)).toLocaleString('vi-VN')}`}
              </span>
            </div>
          )
        }

        <div className="absolute inset-x-0 bottom-0 z-20
          bg-gradient-to-t from-black/80 via-black/45 to-transparent
          px-2.5 pt-8 pb-2 flex flex-col gap-0.5">

          <p className="text-white text-[11px] sm:text-xs font-semibold leading-tight line-clamp-2 drop-shadow">
            {product.name}
          </p>

          <div className="flex items-center justify-between gap-1 mt-0.5">
            <div className="flex flex-col gap-0.5">
              <span className="text-gold text-[11px] sm:text-xs font-bold drop-shadow">
                {formatPrice(priceVal)}
              </span>
              {hasTiers && (
                <span className="text-[9px] bg-orange-400/80 text-white rounded px-1 py-0.5 font-semibold w-fit">
                  Có giá sỉ
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}