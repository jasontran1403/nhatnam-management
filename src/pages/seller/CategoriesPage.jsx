import { useLang } from '../../context/LangContext';
import { useState, useEffect } from 'react';
import { CardSkeleton, Sk } from '../../components/ui/Skeleton.jsx';
import useMinLoading from '../../hooks/useMinLoading.js';
import { categoryApi } from '../../api/services';
import { useToast } from '../../components/common/Toast';
import { Plus, Edit2, Trash2, RefreshCw, Layers, X, Check } from 'lucide-react';

export default function CategoriesPage() {
  const { t } = useLang();
  const toast = useToast();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useMinLoading();
  const [editModal, setEditModal] = useState({ open: false, cat: null });
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const fetchAll = () => {
    setLoading(true);
    categoryApi.getAll()
      .then((r) => setCategories(r.data?.data || []))
      .catch(() => toast(t('common', 'error_retry'), 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchAll(); }, []);

  const openCreate = () => {
    setFormData({ name: '', description: '' });
    setEditModal({ open: true, cat: null });
  };
  const openEdit = (cat) => {
    setFormData({ name: cat.name || '', description: cat.description || '' });
    setEditModal({ open: true, cat });
  };

  const handleSave = async () => {
    if (!formData.name.trim()) { toast(t('category','name_required'), 'warning'); return; }
    setSaving(true);
    try {
      if (editModal.cat) {
        await categoryApi.update(editModal.cat.id, formData);
        toast(t('category','update_success'), 'success');
      } else {
        await categoryApi.create(formData);
        toast(t('category','create_success'), 'success');
      }
      setEditModal({ open: false, cat: null });
      fetchAll();
    } catch (err) {
      toast(err?.response?.data?.message || 'Lỗi khi lưu', 'error');
    } finally { setSaving(false); }
  };

  const handleDelete = async (cat) => {
    if (!window.confirm(`${t('common','delete')} "${cat.name}"?`)) return;
    setDeletingId(cat.id);
    try {
      await categoryApi.delete(cat.id);
      toast(t('common','success'), 'success');
      fetchAll();
    } catch (err) {
      toast(err?.response?.data?.message || 'Lỗi khi xoá', 'error');
    } finally { setDeletingId(null); }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-4 sm:px-6 py-4 bg-surface border-b border-line-soft">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-ink" style={{ fontFamily: 'var(--font-display)' }}>
              Danh mục
            </h1>
            <p className="text-xs text-muted">{categories.length} danh mục</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchAll} className="p-2 rounded-xl bg-surface-2 text-muted hover:bg-surface-3">
              <RefreshCw size={15} />
            </button>
            <button
              onClick={openCreate}
              className="btn-gold rounded-xl px-4 py-2 text-sm flex items-center gap-1.5"
            >
              <Plus size={15} /> Thêm danh mục
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
          </div>
        ) : categories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted gap-2">
            <Layers size={36} strokeWidth={1} />
            <p className="text-sm">Chưa có danh mục</p>
            <button onClick={openCreate} className="btn-gold rounded-xl px-4 py-2 text-sm mt-2">
              Tạo danh mục đầu tiên
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="bg-surface rounded-2xl border border-line-soft p-5 hover:border-gold hover:shadow-lg transition-all duration-200 animate-fadeIn"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold to-gold-deep flex items-center justify-center">
                    <Layers size={18} className="text-white" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => openEdit(cat)}
                      className="p-1.5 rounded-lg bg-surface-2 text-muted hover:bg-surface-3 hover:text-ink transition-colors"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={() => handleDelete(cat)}
                      disabled={deletingId === cat.id}
                      className="p-1.5 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-400 hover:bg-red-100 dark:bg-red-500/18 transition-colors"
                    >
                      {deletingId === cat.id
                        ? <div className="w-3 h-3 border border-red-400 border-t-transparent rounded-full animate-spin" />
                        : <Trash2 size={13} />
                      }
                    </button>
                  </div>
                </div>
                <h3 className="font-semibold text-ink text-sm mb-1">{cat.name}</h3>
                {cat.description && (
                  <p className="text-xs text-muted line-clamp-2">{cat.description}</p>
                )}
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-line-soft">
                  <span className="text-[10px] text-muted">ID: {cat.id}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {editModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setEditModal({ open: false, cat: null })} />
          <div className="relative bg-surface rounded-2xl shadow-2xl w-full max-w-sm animate-fadeIn">
            <div className="flex items-center justify-between px-5 py-4 border-b border-line-soft">
              <h2 className="font-semibold text-ink text-sm" style={{ fontFamily: 'var(--font-display)' }}>
                {editModal.cat ? 'Cập nhật danh mục' : 'Thêm danh mục mới'}
              </h2>
              <button onClick={() => setEditModal({ open: false, cat: null })} className="p-1.5 rounded-lg text-muted hover:bg-surface-2">
                <X size={17} />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="text-xs text-muted mb-1 block">Tên danh mục *</label>
                <input
                  autoFocus
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ví dụ: Hải sản, Thịt nướng..."
                  className="input-elegant w-full rounded-xl px-3 py-2.5 text-sm"
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                />
              </div>
            
            </div>
            <div className="px-5 pb-5 flex gap-3">
              <button
                onClick={() => setEditModal({ open: false, cat: null })}
                className="flex-1 py-2.5 rounded-xl border border-line text-muted text-sm font-medium hover:bg-surface-2 transition-colors"
              >
                Huỷ
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 btn-gold rounded-xl py-2.5 text-sm font-bold flex items-center justify-center gap-2"
              >
                {saving
                  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Check size={15} />
                }
                {saving ? 'Đang lưu...' : (editModal.cat ? 'Cập nhật': 'Tạo danh mục')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
