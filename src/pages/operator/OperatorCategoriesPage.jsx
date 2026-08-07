// src/pages/operator/OperatorCategoriesPage.jsx
// FIX #4: Thêm subcategory (2 cấp) — danh mục gốc + danh mục con
import { useLang } from '../../context/LangContext';
import { useState, useEffect, useMemo } from 'react';
import { CardSkeleton, Sk } from '../../components/ui/Skeleton.jsx';
import useMinLoading from '../../hooks/useMinLoading.js';
import { operatorApi } from '../../api/operatorApi';
import { uploadApi, getImageUrl } from '../../api/services';
import { useToast } from '../../components/common/Toast';
import { Plus, Edit2, Trash2, Search, Layers, X, ImagePlus, ChevronRight, ChevronDown } from 'lucide-react';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:9261';

export default function OperatorCategoriesPage() {
  const { t } = useLang();
  const toast = useToast();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useMinLoading();
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState({ open: false, cat: null });
  // parentId: null = tạo danh mục gốc, number = tạo sub cho parent đó
  const [form, setForm] = useState({ name: '', imageUrl: '', parentId: null });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useMinLoading();
  const [expandedRoots, setExpandedRoots] = useState({});

  const [subCategories, setSubCategories] = useState([]);

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      operatorApi.getCategories(),
      operatorApi.getAllSubCategories(), // ← THÊM
    ])
      .then(([catRes, subCatRes]) => {
        setCategories(catRes.data?.data || []);
        setSubCategories(subCatRes.data?.data || []); // ← THÊM
      })
      .catch(() => toast(t('common', 'error_retry'), 'error'))
      .finally(() => setLoading(false));
  };

  const subCatsOf = (catId) =>
    subCategories.filter(s => String(s.categoryId) === String(catId));

  const loadCategories = () => {
    setLoading(true);
    operatorApi.getCategories()
      .then(r => setCategories(r.data?.data || []))
      .catch(() => toast(t('common', 'error_retry'), 'error'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { loadCategories(); }, []);

  // Tách danh mục gốc và con
  const rootCats = useMemo(() => categories.filter(c => !c.parentId), [categories]);
  const childMap = useMemo(() => {
    const m = {};
    categories.forEach(c => {
      if (c.parentId) {
        if (!m[c.parentId]) m[c.parentId] = [];
        m[c.parentId].push(c);
      }
    });
    return m;
  }, [categories]);

  const openCreate = (parentId = null) => {
    setForm({ name: '', imageUrl: '', parentId });
    setModal({ open: true, cat: null });
  };
  const openEdit = (c) => {
    setForm({ name: c.name, imageUrl: c.imageUrl || '', parentId: c.parentId ?? null });
    setModal({ open: true, cat: c });
  };

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData(); fd.append('file', file);
      const res = await fetch(`${BASE_URL}/api/upload/categories/upload-image`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: fd,
      });
      const json = await res.json();
      const url = json?.data || json?.imageUrl || '';
      setForm(f => ({ ...f, imageUrl: url }));
    } catch { toast(t('common','error'), 'error'); }
    finally { setUploading(false); }
  };

  const handleSave = async () => {
    if (!form.name.trim()) return toast(t('category','name_required'), 'error');
    setSaving(true);
    try {
      const payload = { name: form.name, imageUrl: form.imageUrl, parentId: form.parentId };
      if (modal.cat) {
        await operatorApi.updateCategory(modal.cat.id, payload);
        toast(t('common', 'success'), 'success');
      } else {
        await operatorApi.createCategory(payload);
        toast(t('category','create_success'), 'success');
      }
      setModal({ open: false, cat: null });
      loadCategories();
    } catch (e) {
      toast(e?.response?.data?.message || 'Lỗi lưu danh mục', 'error');
    } finally { setSaving(false); }
  };

  const handleDelete = async (c) => {
    const hasChildren = (childMap[c.id] || []).length > 0;
    if (hasChildren) return toast('Xoá danh mục con trước', 'error');
    if (!window.confirm(`Xoá danh mục "${c.name}"?`)) return;
    try {
      await operatorApi.deleteCategory(c.id);
      toast('Đã xoá danh mục', 'success');
      loadCategories();
    } catch (e) { toast(e?.response?.data?.message || 'Lỗi xoá', 'error'); }
  };

  const toggleExpand = (id) => setExpandedRoots(p => ({ ...p, [id]: !p[id] }));

  const imgSrc = (url) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    return `${BASE_URL}/api/auth${url}`;
  };

  const filteredRoots = rootCats.filter(c =>
    !search || c.name?.toLowerCase().includes(search.toLowerCase()) ||
    (childMap[c.id] || []).some(ch => ch.name?.toLowerCase().includes(search.toLowerCase()))
  );

  const parentLabel = form.parentId
    ? `Danh mục con của: ${categories.find(c => c.id === form.parentId)?.name || '?'}`
    : 'Danh mục gốc';

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 bg-surface border-b border-line-soft">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-ink" style={{ fontFamily: 'var(--font-display)' }}>Danh mục</h1>
            <p className="text-xs text-muted">{rootCats.length} danh mục gốc · {categories.length - rootCats.length} danh mục con</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm danh mục..."
                className="pl-8 pr-3 py-2 text-sm rounded-xl border border-line bg-canvas focus:outline-none focus:border-gold w-48" />
            </div>
            <button onClick={() => openCreate(null)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl btn-gold text-sm font-medium">
              <Plus size={15} /> Thêm danh mục
            </button>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredRoots.length === 0 ? (
          <div className="text-center py-16 text-muted">
            <Layers size={40} className="mx-auto mb-3 opacity-30" />
            <p>Chưa có danh mục nào</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRoots.map(root => {
              const children = childMap[root.id] || [];
              const isExpanded = expandedRoots[root.id] ?? true;
              return (
                <div key={root.id} className="bg-surface rounded-2xl border border-line-soft overflow-hidden">
                  {/* Root row */}
                  <div className="flex items-center gap-3 px-4 py-3 hover:bg-canvas group">
                    <button onClick={() => toggleExpand(root.id)} className="text-muted hover:text-ink">
                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                    <div className="w-10 h-10 rounded-xl border border-line-soft bg-canvas flex items-center justify-center overflow-hidden flex-shrink-0">
                      {imgSrc(root.imageUrl) ? (
                        <img src={imgSrc(root.imageUrl)} alt={root.name} className="w-full h-full object-cover" />
                      ) : (
                        <Layers size={18} className="text-faint" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-ink">{root.name}</p>
                      <p className="text-xs text-muted">{children.length} danh mục con</p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openCreate(root.id)}
                        className="px-2.5 py-1.5 text-xs rounded-lg border border-line text-ink-2 hover:border-gold hover:text-gold transition-all">
                        + Con
                      </button>
                      <button onClick={() => openEdit(root)}
                        className="px-2.5 py-1.5 text-xs rounded-lg border border-line text-ink-2 hover:border-gold hover:text-gold transition-all">
                        <Edit2 size={11} />
                      </button>
                      <button onClick={() => handleDelete(root)}
                        className="px-2.5 py-1.5 text-xs rounded-lg border border-line text-ink-2 hover:border-red-400 hover:text-red-500 transition-all">
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                  {/* Children */}
                  {isExpanded && children.length > 0 && (
                    <div className="border-t border-line-soft bg-canvas">
                      {children.map(child => (
                        <div key={child.id} className="flex items-center gap-3 px-4 py-2.5 ml-6 border-b last:border-b-0 border-line-soft hover:bg-surface group">
                          <div className="w-8 h-8 rounded-lg border border-line-soft bg-surface flex items-center justify-center overflow-hidden flex-shrink-0">
                            {imgSrc(child.imageUrl) ? (
                              <img src={imgSrc(child.imageUrl)} alt={child.name} className="w-full h-full object-cover" />
                            ) : (
                              <Layers size={14} className="text-faint" />
                            )}
                          </div>
                          <p className="flex-1 text-sm text-ink">{child.name}</p>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openEdit(child)}
                              className="px-2.5 py-1.5 text-xs rounded-lg border border-line text-ink-2 hover:border-gold hover:text-gold transition-all">
                              <Edit2 size={11} />
                            </button>
                            <button onClick={() => handleDelete(child)}
                              className="px-2.5 py-1.5 text-xs rounded-lg border border-line text-ink-2 hover:border-red-400 hover:text-red-500 transition-all">
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {modal.open && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-line-soft">
              <div>
                <h2 className="text-lg font-bold text-ink">{modal.cat ? 'Sửa danh mục' : 'Thêm danh mục'}</h2>
                <p className="text-xs text-muted mt-0.5">{parentLabel}</p>
              </div>
              <button onClick={() => setModal({ open: false, cat: null })} className="text-muted hover:text-ink"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              {/* Image */}
              <div>
                <label className="block text-xs font-medium text-ink-2 mb-1">Ảnh danh mục</label>
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-xl border border-line bg-canvas flex items-center justify-center overflow-hidden flex-shrink-0">
                    {form.imageUrl ? (
                      <img src={imgSrc(form.imageUrl)} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <ImagePlus size={20} className="text-faint" />
                    )}
                  </div>
                  <label className="flex items-center gap-2 px-3 py-2 text-xs rounded-xl border border-line text-ink-2 hover:border-gold cursor-pointer transition-all">
                    {uploading ? <div className="w-3 h-3 border border-gold border-t-transparent rounded-full animate-spin" /> : <ImagePlus size={13} />}
                    {uploading ? t('common', 'loading'): 'Chọn ảnh'}
                    <input type="file" accept="image/*" className="hidden" onChange={e => handleUpload(e.target.files[0])} />
                  </label>
                </div>
              </div>
              {/* Name */}
              <div>
                <label className="block text-xs font-medium text-ink-2 mb-1">Tên danh mục *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Nhập tên danh mục"
                  className="w-full px-3 py-2.5 text-sm rounded-xl input-elegant" />
              </div>
              {/* Parent selector (chỉ hiện khi tạo mới hoặc edit) */}
              {!form.parentId && !modal.cat && (
                <div className="px-3 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/28 text-xs text-amber-700 dark:text-amber-300">
                  Đây là <strong>danh mục gốc</strong>. Để tạo danh mục con, nhấn "+ Con" ở danh mục gốc.
                </div>
              )}
            </div>
            <div className="px-6 pb-6 flex gap-2">
              <button onClick={() => setModal({ open: false, cat: null })}
                className="flex-1 py-2.5 rounded-xl border border-line text-sm text-ink-2 hover:bg-canvas">
                Huỷ
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-2.5 rounded-xl btn-gold text-sm font-medium disabled:opacity-50">
                {saving ? 'Đang lưu...' : t('common','save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
