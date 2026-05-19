// src/pages/operator/OperatorIngredientsPage.jsx
import { useState, useEffect } from 'react';
import { operatorApi } from '../../api/operatorApi';
import { useToast } from '../../components/common/Toast';
import { Plus, Edit2, Search, X, Leaf, ImagePlus } from 'lucide-react';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:9261';
const UNITS = ['kg', 'gram', 'lít', 'ml', 'cái', 'hộp', 'túi', 'chai'];

export default function OperatorIngredientsPage() {
  const toast = useToast();
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState({ open: false, item: null });
  const [form, setForm] = useState({ name: '', unit: 'kg', imageUrl: '' });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fetch = () => {
    setLoading(true);
    operatorApi.getIngredients()
      .then(r => setIngredients(r.data?.data || []))
      .catch(() => toast('Lỗi tải nguyên liệu', 'error'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { fetch(); }, []);

  const openCreate = () => { setForm({ name: '', unit: 'kg', imageUrl: '' }); setModal({ open: true, item: null }); };
  const openEdit = (i) => { setForm({ name: i.name, unit: i.unit || 'kg', imageUrl: i.imageUrl || '' }); setModal({ open: true, item: i }); };

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData(); fd.append('image', file);
      const res = await window.fetch(`${BASE_URL}/api/upload/ingredient-image`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: fd,
      });
      const json = await res.json();
      const url = json?.data?.imageUrl || '';
      setForm(f => ({ ...f, imageUrl: url }));
    } catch { toast('Lỗi upload ảnh', 'error'); }
    finally { setUploading(false); }
  };

  const handleSave = async () => {
    if (!form.name.trim()) return toast('Tên nguyên liệu không được trống', 'error');
    if (!form.unit) return toast('Chọn đơn vị', 'error');
    setSaving(true);
    try {
      if (modal.item) {
        await operatorApi.updateIngredient(modal.item.id, form);
        toast('Cập nhật thành công', 'success');
      } else {
        await operatorApi.createIngredient(form);
        toast('Tạo nguyên liệu thành công', 'success');
      }
      setModal({ open: false, item: null });
      fetch();
    } catch (e) {
      toast(e?.response?.data?.message || 'Lỗi lưu nguyên liệu', 'error');
    } finally { setSaving(false); }
  };

  const imgSrc = (url) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    return `${BASE_URL}/api/auth${url}`;
  };

  const filtered = ingredients.filter(i =>
    !search || i.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 px-6 py-4 bg-white border-b border-[#F0EBE3]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-[#1C1C1E]" style={{ fontFamily: 'var(--font-display)' }}>Nguyên liệu</h1>
            <p className="text-xs text-[#8E8878]">{ingredients.length} nguyên liệu</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8878]" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm nguyên liệu..."
                className="pl-8 pr-3 py-2 text-sm rounded-xl border border-[#E8DDD0] bg-[#FAF7F2] focus:outline-none focus:border-[#C9A84C] w-48" />
            </div>
            <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 rounded-xl btn-gold text-sm font-medium">
              <Plus size={15} /> Thêm mới
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-6 h-6 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-[#F0EBE3] overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#F0EBE3] bg-[#FAF7F2]">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#5C5C5C]">Ảnh</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#5C5C5C]">Tên nguyên liệu</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#5C5C5C]">Đơn vị</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-[#5C5C5C]">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(i => (
                  <tr key={i.id} className="border-b border-[#F8F5F0] hover:bg-[#FAF7F2] transition-colors">
                    <td className="px-4 py-3">
                      <div className="w-10 h-10 rounded-xl overflow-hidden bg-[#FAF7F2] flex items-center justify-center">
                        {imgSrc(i.imageUrl)
                          ? <img src={imgSrc(i.imageUrl)} alt="" className="w-full h-full object-cover" />
                          : <Leaf size={16} className="text-[#D3CFC8]" />}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-[#1C1C1E]">{i.name}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 text-xs bg-[#F0EBE3] text-[#5C5C5C] rounded-full">{i.unit}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => openEdit(i)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-[#E8DDD0] text-[#5C5C5C] hover:border-[#C9A84C] hover:text-[#C9A84C] transition-all">
                        <Edit2 size={11} /> Sửa
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={4} className="text-center py-12 text-[#8E8878] text-sm">Chưa có nguyên liệu</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {modal.open && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#F0EBE3]">
              <h2 className="text-lg font-bold text-[#1C1C1E]">{modal.item ? 'Sửa nguyên liệu' : 'Thêm nguyên liệu'}</h2>
              <button onClick={() => setModal({ open: false, item: null })} className="text-[#8E8878] hover:text-[#1C1C1E]"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              {/* Image */}
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-xl border border-[#E8DDD0] bg-[#FAF7F2] flex items-center justify-center overflow-hidden flex-shrink-0">
                  {form.imageUrl ? <img src={imgSrc(form.imageUrl)} alt="" className="w-full h-full object-cover" /> : <Leaf size={20} className="text-[#D3CFC8]" />}
                </div>
                <label className="flex items-center gap-2 px-3 py-2 text-xs rounded-xl border border-[#E8DDD0] text-[#5C5C5C] hover:border-[#C9A84C] cursor-pointer transition-all">
                  {uploading ? <div className="w-3 h-3 border border-[#C9A84C] border-t-transparent rounded-full animate-spin" /> : <ImagePlus size={13} />}
                  {uploading ? 'Đang tải...' : 'Chọn ảnh'}
                  <input type="file" accept="image/*" className="hidden" onChange={e => handleUpload(e.target.files[0])} />
                </label>
              </div>
              {/* Name */}
              <div>
                <label className="block text-xs font-medium text-[#5C5C5C] mb-1">Tên nguyên liệu *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Nhập tên nguyên liệu" className="w-full px-3 py-2.5 text-sm rounded-xl input-elegant" />
              </div>
              {/* Unit */}
              <div>
                <label className="block text-xs font-medium text-[#5C5C5C] mb-1">Đơn vị *</label>
                <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm rounded-xl input-elegant bg-white">
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-2">
              <button onClick={() => setModal({ open: false, item: null })}
                className="flex-1 py-2.5 rounded-xl border border-[#E8DDD0] text-sm text-[#5C5C5C] hover:bg-[#FAF7F2]">Huỷ</button>
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
