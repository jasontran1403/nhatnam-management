// src/pages/operator/OperatorCategoriesPage.jsx
import { useState, useEffect } from 'react';
import { operatorApi } from '../../api/operatorApi';
import { uploadApi, getImageUrl } from '../../api/services';
import { useToast } from '../../components/common/Toast';
import { Plus, Edit2, Trash2, Search, Layers, X, ImagePlus } from 'lucide-react';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:9261';

export default function OperatorCategoriesPage() {
  const toast = useToast();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState({ open: false, cat: null });
  const [form, setForm] = useState({ name: '', imageUrl: '' });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const loadCategories = () => {
    setLoading(true);
    operatorApi.getCategories()
      .then(r => setCategories(r.data?.data || []))
      .catch(() => toast('Lỗi tải danh mục', 'error'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { loadCategories(); }, []);

  const openCreate = () => { setForm({ name: '', imageUrl: '' }); setModal({ open: true, cat: null }); };
  const openEdit = (c) => { setForm({ name: c.name, imageUrl: c.imageUrl || '' }); setModal({ open: true, cat: c }); };

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
    } catch { toast('Lỗi upload ảnh', 'error'); }
    finally { setUploading(false); }
  };

  const handleSave = async () => {
    if (!form.name.trim()) return toast('Tên danh mục không được trống', 'error');
    setSaving(true);
    try {
      if (modal.cat) {
        await operatorApi.updateCategory(modal.cat.id, form);
        toast('Cập nhật thành công', 'success');
      } else {
        await operatorApi.createCategory(form);
        toast('Tạo danh mục thành công', 'success');
      }
      setModal({ open: false, cat: null });
      loadCategories(); // thay fetch()
    } catch (e) {
      toast(e?.response?.data?.message || 'Lỗi lưu danh mục', 'error');
    } finally { setSaving(false); }
  };

  const handleDelete = async (c) => {
    if (!window.confirm(`Xoá danh mục "${c.name}"?`)) return;
    try {
      await operatorApi.deleteCategory(c.id);
      toast('Đã xoá danh mục', 'success');
      loadCategories();
    } catch (e) { toast(e?.response?.data?.message || 'Lỗi xoá', 'error'); }
  };

  const filtered = categories.filter(c => !search || c.name?.toLowerCase().includes(search.toLowerCase()));

  const imgSrc = (url) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    return `${BASE_URL}/api/auth${url}`;
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 bg-white border-b border-[#F0EBE3]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-[#1C1C1E]" style={{ fontFamily: 'var(--font-display)' }}>Danh mục</h1>
            <p className="text-xs text-[#8E8878]">{categories.length} danh mục</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8878]" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm danh mục..."
                className="pl-8 pr-3 py-2 text-sm rounded-xl border border-[#E8DDD0] bg-[#FAF7F2] focus:outline-none focus:border-[#C9A84C] w-48" />
            </div>
            <button onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 rounded-xl btn-gold text-sm font-medium">
              <Plus size={15} /> Thêm mới
            </button>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-6 h-6 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-[#8E8878]">
            <Layers size={40} className="mx-auto mb-3 opacity-30" />
            <p>Chưa có danh mục nào</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filtered.map(c => (
              <div key={c.id} className="bg-white rounded-2xl border border-[#F0EBE3] overflow-hidden hover:border-[#C9A84C] hover:shadow-md transition-all group">
                <div className="h-28 bg-[#FAF7F2] flex items-center justify-center overflow-hidden">
                  {imgSrc(c.imageUrl) ? (
                    <img src={imgSrc(c.imageUrl)} alt={c.name} className="w-full h-full object-cover" />
                  ) : (
                    <Layers size={32} className="text-[#D3CFC8]" />
                  )}
                </div>
                <div className="p-3">
                  <p className="text-sm font-semibold text-[#1C1C1E] truncate">{c.name}</p>
                  <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(c)}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs rounded-lg border border-[#E8DDD0] text-[#5C5C5C] hover:border-[#C9A84C] hover:text-[#C9A84C] transition-all">
                      <Edit2 size={11} /> Sửa
                    </button>
                    <button onClick={() => handleDelete(c)}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs rounded-lg border border-[#E8DDD0] text-[#5C5C5C] hover:border-red-400 hover:text-red-500 transition-all">
                      <Trash2 size={11} /> Xoá
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {modal.open && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#F0EBE3]">
              <h2 className="text-lg font-bold text-[#1C1C1E]">{modal.cat ? 'Sửa danh mục' : 'Thêm danh mục'}</h2>
              <button onClick={() => setModal({ open: false, cat: null })} className="text-[#8E8878] hover:text-[#1C1C1E]"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              {/* Image upload */}
              <div>
                <label className="block text-xs font-medium text-[#5C5C5C] mb-1">Ảnh danh mục</label>
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-xl border border-[#E8DDD0] bg-[#FAF7F2] flex items-center justify-center overflow-hidden flex-shrink-0">
                    {form.imageUrl ? (
                      <img src={imgSrc(form.imageUrl)} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <ImagePlus size={20} className="text-[#D3CFC8]" />
                    )}
                  </div>
                  <label className="flex items-center gap-2 px-3 py-2 text-xs rounded-xl border border-[#E8DDD0] text-[#5C5C5C] hover:border-[#C9A84C] cursor-pointer transition-all">
                    {uploading ? <div className="w-3 h-3 border border-[#C9A84C] border-t-transparent rounded-full animate-spin" /> : <ImagePlus size={13} />}
                    {uploading ? 'Đang tải...' : 'Chọn ảnh'}
                    <input type="file" accept="image/*" className="hidden" onChange={e => handleUpload(e.target.files[0])} />
                  </label>
                </div>
              </div>
              {/* Name */}
              <div>
                <label className="block text-xs font-medium text-[#5C5C5C] mb-1">Tên danh mục *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Nhập tên danh mục"
                  className="w-full px-3 py-2.5 text-sm rounded-xl input-elegant" />
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-2">
              <button onClick={() => setModal({ open: false, cat: null })}
                className="flex-1 py-2.5 rounded-xl border border-[#E8DDD0] text-sm text-[#5C5C5C] hover:bg-[#FAF7F2]">
                Huỷ
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-2.5 rounded-xl btn-gold text-sm font-medium disabled:opacity-50">
                {saving ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
