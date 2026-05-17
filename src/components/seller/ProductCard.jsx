import { PackageX } from 'lucide-react';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

function formatPrice(price) {
  if (!price) return '0 đ';
  return new Intl.NumberFormat('vi-VN').format(price) + ' đ';
}

export default function ProductCard({ product, onAdd, cartQty = 0, ingStockMap = {} }) {
  const defaultTier = product.priceTiers?.find((t) => t.sortOrder === 0) || product.priceTiers?.[0];
  const priceVal = defaultTier?.price ?? product.basePrice ?? 0;

  const imageUrl = product.imageUrl
    ? product.imageUrl.startsWith('http')
      ? product.imageUrl
      : `${BASE_URL}/api/auth${product.imageUrl}`
    : null;

  // stockQuantity đã được POSPage tính sẵn qua calcEffectiveStock
  const stock = product.stockQuantity != null ? Number(product.stockQuantity) : null;
  const isOutOfStock = stock !== null && stock <= 0;
  const isDisabled = isOutOfStock;
  const remaining = stock !== null ? Math.max(0, stock) : null;

  // Lấy stock nguyên liệu từ ingStockMap (đã trừ hold realtime)
  // Fallback về ing.stockQuantity nếu chưa có trong map
  const getIngStock = (ing) => {
    const key = String(ing.ingredientId);
    const fromMap = ingStockMap[key];
    return fromMap != null ? fromMap : (ing.stockQuantity != null ? Number(ing.stockQuantity) : null);
  };

  return (
    <button
      onClick={() => { if (!isDisabled) onAdd(product); }}
      disabled={isDisabled}
      className="card-product rounded-xl overflow-hidden text-left w-full flex flex-col
        cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed
        active:scale-95 transition-transform"
    >
      <div className="relative aspect-square bg-[#F0EBE3] overflow-hidden w-full">

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
          className="absolute inset-0 items-center justify-center text-[#C4B9A8] text-3xl"
          style={{ display: imageUrl ? 'none' : 'flex' }}
        >
          🍽️
        </div>

        {isOutOfStock && (
          <div className="absolute inset-0 bg-black/65 flex items-center justify-center z-10">
            <div className="flex flex-col items-center text-white gap-1">
              <PackageX size={18} />
              <span className="text-[11px] font-semibold">Hết hàng</span>
            </div>
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 z-20
          bg-gradient-to-t from-black/80 via-black/45 to-transparent
          px-2.5 pt-8 pb-2 flex flex-col gap-0.5">

          <p className="text-white text-[11px] sm:text-xs font-semibold leading-tight line-clamp-2 drop-shadow">
            {product.name}
          </p>

          <div className="flex items-center justify-between gap-1 mt-0.5">
            <span className="text-[#FFD97D] text-[11px] sm:text-xs font-bold drop-shadow">
              {formatPrice(priceVal)}
            </span>

            {product.ingredients && product.ingredients.length > 0
              ? (
                <div className="flex flex-col gap-0.5 max-h-10 overflow-hidden">
                  {product.ingredients.slice(0, 2).map(ing => {
                    // Dùng ingStockMap thay vì ing.stockQuantity — phản ánh hold realtime
                    const qty  = getIngStock(ing);
                    const low  = qty !== null && qty > 0 && qty <= 5;
                    const none = qty !== null && qty <= 0;
                    const qtyStr = qty != null
                      ? parseFloat(qty.toFixed(2)).toLocaleString('vi-VN')
                      : '?';
                    return (
                      <span key={ing.ingredientId} className={`
                        text-[8px] rounded-md px-1.5 py-0.5 leading-none font-semibold whitespace-nowrap
                        ${none ? 'text-red-200 bg-red-800/60' : low ? 'text-yellow-200 bg-yellow-800/50' : 'text-white/90 bg-black/35'}
                      `}>
                        {qtyStr} {ing.unit || ''}
                      </span>
                    );
                  })}
                </div>
              )
              : stock !== null && (
                <span className={`
                  text-[9px] rounded-full px-1.5 py-0.5 leading-none font-semibold whitespace-nowrap
                  ${isOutOfStock ? 'text-red-200 bg-red-800/60' : remaining <= 5 ? 'text-yellow-200 bg-yellow-800/50' : 'text-white/90 bg-black/35'}
                `}>
                  {isOutOfStock ? 'Hết hàng' : `Còn ${parseFloat(Number(remaining).toFixed(3)).toLocaleString('vi-VN')}`}
                </span>
              )
            }
          </div>
        </div>
      </div>
    </button>
  );
}