import { useState, useEffect } from 'react';
import { Sk, TableSkeleton } from '../../components/ui/Skeleton.jsx';
import useMinLoading from '../../hooks/useMinLoading.js';
import { productApi, categoryApi, getImageUrl } from '../../api/services';
import { useToast } from '../../components/common/Toast';
import { useLang } from '../../context/LangContext';
import { Plus, Search, Edit2, Trash2, RefreshCw, Package } from 'lucide-react';
import ProductFormModal from '../../components/seller/ProductFormModal';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

function formatPrice(price) {
  return new Intl.NumberFormat('vi-VN').format(price || 0) + ' đ';
}

export default function ProductsPage() {
  const toast = useToast();
  const { t } = useLang();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useMinLoading();
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('ALL');
  const [formModal, setFormModal] = useState({ open: false, product: null });
  const [deletingId, setDeletingId] = useState(null);

  const fetchAll = () => {
    setLoading(true);
    Promise.all([
      productApi.getAll({ page: 0, size: 200 }),
      categoryApi.getAll(),
    ])
      .then(([pRes, cRes]) => {
        setProducts(pRes.data?.data?.content || []);
        setCategories(cRes.data?.data || []);
      })
      .catch(() => toast(t('common', 'error_retry'), 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchAll(); }, []);

  const handleDelete = async (p) => {
    if (!window.confirm(`${t('common', 'delete')} "${p.name}"?`)) return;
    setDeletingId(p.id);
    try {
      await productApi.delete(p.id);
      toast(t('common', 'success'), 'success');
      fetchAll();
    } catch (err) {
      toast(err?.response?.data?.message || t('common', 'error'), 'error');
    } finally { setDeletingId(null); }
  };

  const filtered = products.filter((p) => {
    const matchCat = catFilter === 'ALL' || String(p.categoryId) === String(catFilter);
    const q = search.toLowerCase();
    const matchSearch = !search || p.name?.toLowerCase().includes(q);
    return matchCat && matchSearch;
  });

  const getProductImage = (p) => {
    if (!p.imageUrl) return null;
    if (p.imageUrl.startsWith('http')) return p.imageUrl;
    return `${BASE_URL}/api/auth${p.imageUrl}`;
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-4 sm:px-6 py-4 bg-surface border-b border-line-soft">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div>
            <h1 className="text-xl font-bold text-ink" style={{ fontFamily: 'var(--font-display)' }}>
              {t('product','product_name_label')}
            </h1>
            <p className="text-xs text-muted">t('product','product_count').replace('{n}',products.length)</p>
          </div>
          <div className="sm:ml-auto flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                {...{placeholder: t("product","search_placeholder")}}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-elegant rounded-xl pl-9 pr-4 py-2 text-sm w-48"
              />
            </div>
            <button
              onClick={fetchAll}
              className="p-2 rounded-xl bg-surface-2 text-muted hover:bg-surface-3"
            >
              <RefreshCw size={15} />
            </button>
            <button
              onClick={() => setFormModal({ open: true, product: null })}
              className="btn-gold rounded-xl px-4 py-2 text-sm flex items-center gap-1.5"
            >
              <Plus size={15} /> Thêm sản phẩm
            </button>
          </div>
        </div>

        {/* Category filter */}
        <div className="flex gap-1.5 mt-3 overflow-x-auto pb-0.5">
          <button
            onClick={() => setCatFilter('ALL')}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              catFilter === 'ALL' ? 'bg-gold text-white' : 'bg-surface-2 text-muted hover:bg-surface-3'
            }`}
          >
            Tất cả
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setCatFilter(c.id)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                catFilter == c.id ? 'bg-gold text-white' : 'bg-surface-2 text-muted hover:bg-surface-3'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted gap-2">
            <Package size={36} strokeWidth={1} />
            <p className="text-sm">{t('common','no_data')}</p>
            <button
              onClick={() => setFormModal({ open: true, product: null })}
              className="btn-gold rounded-xl px-4 py-2 text-sm mt-2"
            >
              Thêm sản phẩm đầu tiên
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((p) => {
              const defaultPrice = p.prices?.find((pr) => pr.isDefault) || p.prices?.[0];
              const imgUrl = getProductImage(p);
              return (
                <div
                  key={p.id}
                  className="bg-surface rounded-2xl border border-line-soft overflow-hidden hover:border-gold hover:shadow-lg transition-all duration-200 animate-fadeIn"
                >
                  {/* Image */}
                  <div className="aspect-video bg-surface-2 relative overflow-hidden">
                    {imgUrl ? (
                      <img src={imgUrl} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl">🍽️</div>
                    )}
                    {p.isActive === false && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <span className="text-white text-xs font-semibold bg-red-500 px-2 py-0.5 rounded-full">Tạm ẩn</span>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="font-semibold text-ink text-sm line-clamp-1">{p.name}</h3>
                    </div>
                    {p.category && (
                      <p className="text-[10px] text-muted mb-2">{p.category}</p>
                    )}
                    {defaultPrice && (
                      <p className="text-sm font-bold text-gold">{formatPrice(defaultPrice.price)}</p>
                    )}
                    {p.prices?.length > 1 && (
                      <p className="text-[10px] text-muted">+{p.prices.length - 1} mức giá</p>
                    )}
                    {p.variants?.length > 0 && (
                      <p className="text-[10px] text-muted">{p.variants.length} phân loại</p>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-line-soft">
                      <button
                        onClick={() => setFormModal({ open: true, product: p })}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-surface-2 text-ink text-xs font-medium hover:bg-surface-3 transition-colors"
                      >
                        <Edit2 size={12} /> Sửa
                      </button>
                      <button
                        onClick={() => handleDelete(p)}
                        disabled={deletingId === p.id}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-400 text-xs font-medium hover:bg-red-100 dark:bg-red-500/18 transition-colors"
                      >
                        {deletingId === p.id
                          ? <div className="w-3 h-3 border border-red-400 border-t-transparent rounded-full animate-spin" />
                          : <Trash2 size={12} />
                        }
                        {t('common', 'delete')}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {formModal.open && (
        <ProductFormModal
          product={formModal.product}
          categories={categories}
          onClose={() => setFormModal({ open: false, product: null })}
          onSaved={() => { setFormModal({ open: false, product: null }); fetchAll(); }}
        />
      )}
    </div>
  );
}
