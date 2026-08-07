import { useLang } from '../../context/LangContext';
import { useState, useEffect, useRef } from 'react';
import { Sk, TableSkeleton } from '../../components/ui/Skeleton.jsx';
import useMinLoading from '../../hooks/useMinLoading.js';
import { ingredientApi, uploadApi } from '../../api/services';
import { useToast } from '../../components/common/Toast';
import { Plus, Edit2, Trash2, RefreshCw, Leaf, X, Check, Search, Camera, Image } from 'lucide-react';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

const UNITS = ['Kg', 'Gr', 'Lít', 'ml', 'Cái', 'Hộp', 'Cây', 'Bó', 'Túi', 'Gói', 'Chai', 'Lon', 'Mét', 'Cuộn'];

const UNIT_COLORS = {
  kg: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-300 border-blue-200 dark:border-blue-500/28',
  gr: 'bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-300 border-violet-200 dark:border-violet-500/28',
  lít: 'bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-300 border-teal-200 dark:border-teal-500/28',
  ml: 'bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-300 border-cyan-200 dark:border-cyan-500/28',
  cái: 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-300 border-orange-200 dark:border-orange-500/28',
  hộp: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-200 dark:border-amber-500/28',
  cây: 'bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-300 border-green-200 dark:border-green-500/28',
};
const getUnitColor = (u) =>
  UNIT_COLORS[u?.toLowerCase()] ?? 'bg-canvas text-muted border-line';

function getFullImageUrl(url) {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${BASE_URL}/api/auth/images/ingredient/${url.split('/').pop()}`;
}

const EMPTY_FORM = { name: '', unit: 'Kg', imageUrl: '' };

// ─── Image picker ─────────────────────────────────────────────────────────────
function ImagePicker({ value, onChange }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useMinLoading();
  const toast = useToast();

  const handleFile = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast('Chỉ chấp nhận file ảnh', 'warning'); return; }
    setUploading(true);
    try {
      const res = await uploadApi.ingredientImage(file);
      const url = res.data?.data?.imageUrl;
      if (url) onChange(url);
      else throw new Error('Không nhận được URL ảnh');
    } catch (err) {
      toast(err?.response?.data?.message || 'Upload ảnh thất bại', 'error');
    } finally {
      setUploading(false);
    }
  };

  const previewUrl = getFullImageUrl(value);

  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs text-muted block">Ảnh nguyên liệu</label>
      <div
        onClick={() => !uploading && fileRef.current?.click()}
        className="relative w-full h-32 rounded-xl border-2 border-dashed border-line bg-canvas flex items-center justify-center cursor-pointer overflow-hidden group hover:border-gold transition-colors"
      >
        {previewUrl ? (
          <>
            <img src={previewUrl} alt="preview" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <Camera size={18} className="text-white" />
              <span className="text-white text-xs font-medium">Đổi ảnh</span>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onChange(''); }}
              className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X size={11} />
            </button>
          </>
        ) : uploading ? (
          <div className="flex flex-col items-center gap-2 text-gold">
            <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
            <span className="text-xs">Đang upload...</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-faint">
            <Image size={28} strokeWidth={1.5} />
            <span className="text-xs">Nhấn để chọn ảnh</span>
          </div>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function IngredientsPage() {
  const { t } = useLang();
  const toast = useToast();
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useMinLoading();
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState({ open: false, item: null });
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const fetchAll = () => {
    setLoading(true);
    ingredientApi.getAll()
      .then((r) => setIngredients(r.data?.data || []))
      .catch(() => toast('Không thể tải nguyên liệu', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchAll(); }, []);

  const openCreate = () => { setForm(EMPTY_FORM); setModal({ open: true, item: null }); };
  const openEdit = (item) => {
    setForm({ name: item.name || '', unit: item.unit || 'Kg', imageUrl: item.imageUrl || '' });
    setModal({ open: true, item });
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast('Vui lòng nhập tên nguyên liệu', 'warning'); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        unit: form.unit,
        imageUrl: form.imageUrl || null,
        stockQuantity: 0,  // backend @NotNull — mặc định 0
      };
      if (modal.item) {
        await ingredientApi.update(modal.item.id, payload);
        toast('Cập nhật thành công', 'success');
      } else {
        await ingredientApi.create(payload);
        toast('Tạo nguyên liệu thành công', 'success');
      }
      setModal({ open: false, item: null });
      fetchAll();
    } catch (err) {
      toast(err?.response?.data?.message || 'Lỗi khi lưu', 'error');
    } finally { setSaving(false); }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Xoá nguyên liệu "${item.name}"?`)) return;
    setDeletingId(item.id);
    try {
      await ingredientApi.delete(item.id);
      toast('Đã xoá nguyên liệu', 'success');
      fetchAll();
    } catch (err) {
      toast(err?.response?.data?.message || 'Lỗi khi xoá', 'error');
    } finally { setDeletingId(null); }
  };

  const filtered = ingredients.filter((i) =>
    !search || i.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* Header */}
      <div className="flex-shrink-0 px-4 sm:px-6 py-4 bg-surface border-b border-line-soft">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div>
            <h1 className="text-xl font-bold text-ink" style={{ fontFamily: 'var(--font-display)' }}>
              Nguyên liệu
            </h1>
            <p className="text-xs text-muted">{ingredients.length} nguyên liệu</p>
          </div>
          <div className="sm:ml-auto flex items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                placeholder="Tìm nguyên liệu..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-elegant rounded-xl pl-9 pr-4 py-2 text-sm w-44"
              />
            </div>
            <button onClick={fetchAll} className="p-2 rounded-xl bg-surface-2 text-muted hover:bg-surface-3 transition-colors">
              <RefreshCw size={15} />
            </button>
            <button onClick={openCreate} className="btn-gold flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm">
              <Plus size={15} /> Thêm
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
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted gap-2">
            <Leaf size={36} strokeWidth={1} />
            <p className="text-sm">Không có nguyên liệu nào</p>
            <button onClick={openCreate} className="btn-gold rounded-xl px-4 py-2 text-sm mt-2">Thêm nguyên liệu</button>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block bg-surface rounded-2xl border border-line-soft overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-canvas border-b border-line-soft">
                  <tr>
                    {[t('ingredient','ingredient'), t('common','unit'), t('warehouse','stock'), t('common','actions')].map((h) => (
                      <th key={h} className="text-left text-[10px] font-bold text-muted uppercase tracking-wider px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => {
                    const img = getFullImageUrl(item.imageUrl);
                    return (
                      <tr key={item.id} className="border-b border-line-soft last:border-0 hover:bg-canvas transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg overflow-hidden bg-surface-2 flex-shrink-0 flex items-center justify-center">
                              {img ? <img src={img} alt={item.name} className="w-full h-full object-cover" /> : <Leaf size={14} className="text-gold" />}
                            </div>
                            <p className="font-medium text-ink text-sm">{item.name}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getUnitColor(item.unit)}`}>{item.unit}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm font-semibold text-ink">{item.stockQuantity ?? 0}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg bg-surface-2 text-muted hover:bg-surface-3 hover:text-ink transition-colors">
                              <Edit2 size={12} />
                            </button>
                            <button onClick={() => handleDelete(item)} disabled={deletingId === item.id} className="p-1.5 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-400 hover:bg-red-100 dark:bg-red-500/18 transition-colors">
                              {deletingId === item.id
                                ? <div className="w-3 h-3 border border-red-400 border-t-transparent rounded-full animate-spin" />
                                : <Trash2 size={12} />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden space-y-2">
              {filtered.map((item) => {
                const img = getFullImageUrl(item.imageUrl);
                return (
                  <div key={item.id} className="bg-surface rounded-xl border border-line-soft p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl overflow-hidden bg-surface-2 flex-shrink-0 flex items-center justify-center">
                          {img ? <img src={img} alt={item.name} className="w-full h-full object-cover" /> : <Leaf size={16} className="text-gold" />}
                        </div>
                        <div>
                          <p className="font-semibold text-ink text-sm">{item.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${getUnitColor(item.unit)}`}>{item.unit}</span>
                            <span className="text-xs text-muted">Tồn: {item.stockQuantity ?? 0}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg bg-surface-2 text-muted"><Edit2 size={13} /></button>
                        <button onClick={() => handleDelete(item)} className="p-1.5 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-400"><Trash2 size={13} /></button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Modal */}
      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setModal({ open: false, item: null })} />
          <div className="relative bg-surface rounded-2xl shadow-2xl w-full max-w-sm animate-fadeIn">
            <div className="flex items-center justify-between px-5 py-4 border-b border-line-soft">
              <h2 className="font-semibold text-ink text-sm" style={{ fontFamily: 'var(--font-display)' }}>
                {modal.item ? 'Cập nhật nguyên liệu' : 'Thêm nguyên liệu'}
              </h2>
              <button onClick={() => setModal({ open: false, item: null })} className="p-1.5 rounded-lg text-muted hover:bg-surface-2">
                <X size={17} />
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <ImagePicker value={form.imageUrl} onChange={(url) => setForm({ ...form, imageUrl: url })} />
              <div>
                <label className="text-xs text-muted mb-1 block font-medium">
                  Tên nguyên liệu <span className="text-red-400">*</span>
                </label>
                <input
                  autoFocus
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                  placeholder="Ví dụ: Cua biển, Tôm hùm..."
                  className="input-elegant w-full rounded-xl px-3 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted mb-2 block font-medium">
                  Đơn vị tính
                </label>

                <select
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-line text-sm text-muted focus:outline-none focus:border-gold"
                >
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="px-5 pb-5 flex gap-3">
              <button
                onClick={() => setModal({ open: false, item: null })}
                className="flex-1 py-2.5 rounded-xl border border-line text-muted text-sm font-medium hover:bg-surface-2 transition-colors"
              >
                Huỷ
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 btn-gold rounded-xl py-2.5 text-sm font-bold flex items-center justify-center gap-2"
              >
                {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check size={15} />}
                {saving ? 'Đang lưu...' : (modal.item ? 'Cập nhật': 'Tạo mới')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}