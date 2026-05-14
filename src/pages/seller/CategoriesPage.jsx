import { useState, useEffect } from 'react';
import { categoryApi } from '../../api/services';
import { useToast } from '../../components/common/Toast';
import { Plus, Edit2, Trash2, RefreshCw, Layers, X, Check } from 'lucide-react';

export default function CategoriesPage() {
  const toast = useToast();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState({ open: false, cat: null });
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const fetchAll = () => {
    setLoading(true);
    categoryApi.getAll()
      .then((r) => setCategories(r.data?.data || []))
      .catch(() => toast('Không thể tải danh mục', 'error'))
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
    if (!formData.name.trim()) { toast('Vui lòng nhập tên danh mục', 'warning'); return; }
    setSaving(true);
    try {
      if (editModal.cat) {
        await categoryApi.update(editModal.cat.id, formData);
        toast('Cập nhật danh mục thành công', 'success');
      } else {
        await categoryApi.create(formData);
        toast('Tạo danh mục thành công', 'success');
      }
      setEditModal({ open: false, cat: null });
      fetchAll();
    } catch (err) {
      toast(err?.response?.data?.message || 'Lỗi khi lưu', 'error');
    } finally { setSaving(false); }
  };

  const handleDelete = async (cat) => {
    if (!window.confirm(`Xoá danh mục "${cat.name}"?`)) return;
    setDeletingId(cat.id);
    try {
      await categoryApi.delete(cat.id);
      toast('Đã xoá danh mục', 'success');
      fetchAll();
    } catch (err) {
      toast(err?.response?.data?.message || 'Lỗi khi xoá', 'error');
    } finally { setDeletingId(null); }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-4 sm:px-6 py-4 bg-white border-b border-[#F0EBE3]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#1C1C1E]" style={{ fontFamily: 'var(--font-display)' }}>
              Danh mục
            </h1>
            <p className="text-xs text-[#8E8878]">{categories.length} danh mục</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchAll} className="p-2 rounded-xl bg-[#F0EBE3] text-[#8E8878] hover:bg-[#E8DDD0]">
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
            <div className="w-8 h-8 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : categories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-[#8E8878] gap-2">
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
                className="bg-white rounded-2xl border border-[#F0EBE3] p-5 hover:border-[#C9A84C] hover:shadow-lg transition-all duration-200 animate-fadeIn"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#C9A84C] to-[#A07830] flex items-center justify-center">
                    <Layers size={18} className="text-white" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => openEdit(cat)}
                      className="p-1.5 rounded-lg bg-[#F0EBE3] text-[#8E8878] hover:bg-[#E8DDD0] hover:text-[#1C1C1E] transition-colors"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={() => handleDelete(cat)}
                      disabled={deletingId === cat.id}
                      className="p-1.5 rounded-lg bg-red-50 text-red-400 hover:bg-red-100 transition-colors"
                    >
                      {deletingId === cat.id
                        ? <div className="w-3 h-3 border border-red-400 border-t-transparent rounded-full animate-spin" />
                        : <Trash2 size={13} />
                      }
                    </button>
                  </div>
                </div>
                <h3 className="font-semibold text-[#1C1C1E] text-sm mb-1">{cat.name}</h3>
                {cat.description && (
                  <p className="text-xs text-[#8E8878] line-clamp-2">{cat.description}</p>
                )}
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#F0EBE3]">
                  <span className="text-[10px] text-[#8E8878]">ID: {cat.id}</span>
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
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-fadeIn">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#F0EBE3]">
              <h2 className="font-semibold text-[#1C1C1E] text-sm" style={{ fontFamily: 'var(--font-display)' }}>
                {editModal.cat ? 'Cập nhật danh mục' : 'Thêm danh mục mới'}
              </h2>
              <button onClick={() => setEditModal({ open: false, cat: null })} className="p-1.5 rounded-lg text-[#8E8878] hover:bg-[#F0EBE3]">
                <X size={17} />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="text-xs text-[#8E8878] mb-1 block">Tên danh mục *</label>
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
                className="flex-1 py-2.5 rounded-xl border border-[#E8DDD0] text-[#8E8878] text-sm font-medium hover:bg-[#F0EBE3] transition-colors"
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
                {saving ? 'Đang lưu...' : (editModal.cat ? 'Cập nhật' : 'Tạo danh mục')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
