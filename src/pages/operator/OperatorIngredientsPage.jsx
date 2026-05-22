// src/pages/operator/OperatorIngredientsPage.jsx
// FIX #3: Import/Export
// FIX #4: Category/SubCategory combobox với search + nút + tạo nhanh
import { useState, useEffect, useMemo, useRef } from 'react';
import { operatorApi } from '../../api/operatorApi';
import { useToast } from '../../components/common/Toast';
import { Plus, Edit2, Search, X, Leaf, ImagePlus, Download, Upload } from 'lucide-react';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:9261';
const UNITS = ['kg', 'gram', 'lít', 'ml', 'cái', 'hộp', 'túi', 'chai'];

// ── Combobox với search + nút + tạo nhanh ────────────────────────────────────
function CategoryCombobox({ label, options, value, onChange, onCreateNew, placeholder = 'Tìm hoặc chọn...', disabled = false }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef(null);
  const inputRef = useRef(null);

  const selected = options.find(o => String(o.id) === String(value));

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    return options.filter(o => o.name?.toLowerCase().includes(query.toLowerCase()));
  }, [options, query]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const handleOpen = () => {
    if (disabled) return;
    setOpen(true);
    setQuery('');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleSelect = (opt) => {
    onChange(String(opt.id));
    setOpen(false);
    setQuery('');
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('');
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {label && <label className="block text-xs font-medium text-[#5C5C5C] mb-1">{label}</label>}
      <div className="flex items-center gap-1.5">
        {/* Trigger */}
        <div
          onClick={handleOpen}
          className={`flex-1 flex items-center gap-2 px-3 py-2.5 text-sm rounded-xl border cursor-pointer transition-all
            ${disabled ? 'opacity-50 cursor-not-allowed bg-[#FAF7F2]' : 'bg-white hover:border-[#C9A84C]'}
            ${open ? 'border-[#C9A84C] ring-1 ring-[#C9A84C]/20' : 'border-[#E8DDD0]'}`}
        >
          {selected ? (
            <>
              <span className="flex-1 text-[#1C1C1E] truncate">{selected.name}</span>
              <button onClick={handleClear} className="text-[#C4B9A8] hover:text-[#5C5C5C] flex-shrink-0">
                <X size={13} />
              </button>
            </>
          ) : (
            <span className="flex-1 text-[#C4B9A8]">{placeholder}</span>
          )}
          <Search size={13} className="text-[#C4B9A8] flex-shrink-0" />
        </div>

        {/* Nút + tạo nhanh */}
        {onCreateNew && !disabled && (
          <button onClick={() => onCreateNew(query)}
            title={`Tạo mới "${query || label}"`}
            className="w-9 h-9 flex items-center justify-center rounded-xl border border-[#E8DDD0] text-[#C9A84C] hover:border-[#C9A84C] hover:bg-[#C9A84C]/10 transition-all flex-shrink-0">
            <Plus size={15} />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-[#E8DDD0] rounded-xl shadow-xl overflow-hidden"
          style={{ width: 'calc(100% - 44px)', minWidth: 180, maxHeight: 260 }}>
          {/* Search input */}
          <div className="p-2 border-b border-[#F0EBE3]">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#C4B9A8]" />
              <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Tìm danh mục..."
                className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-[#E8DDD0] focus:outline-none focus:border-[#C9A84C]" />
            </div>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 196 }}>
            {filtered.length === 0 ? (
              <div className="px-3 py-3 text-xs text-[#C4B9A8] text-center">
                Không tìm thấy
                {query && onCreateNew && (
                  <button onClick={() => { onCreateNew(query); setOpen(false); }}
                    className="block mx-auto mt-1.5 text-[#C9A84C] font-medium hover:underline">
                    + Tạo "{query}"
                  </button>
                )}
              </div>
            ) : (
              filtered.map(opt => (
                <button key={opt.id} onClick={() => handleSelect(opt)}
                  className={`w-full text-left px-3 py-2.5 text-sm flex items-center gap-2 hover:bg-[#FAF7F2] transition-colors
                    ${String(opt.id) === String(value) ? 'text-[#C9A84C] font-semibold bg-[#C9A84C]/5' : 'text-[#1C1C1E]'}`}>
                  {opt.imageUrl && (
                    <div className="w-6 h-6 rounded-md overflow-hidden flex-shrink-0 border border-[#F0EBE3]">
                      <img src={opt.imageUrl.startsWith('http') ? opt.imageUrl : `${BASE_URL}/api/auth${opt.imageUrl}`}
                        alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  {opt.name}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Modal tạo nhanh category/subcategory ─────────────────────────────────────
function QuickCreateCategoryModal({ open, onClose, onCreated, parentId, parentName, prefill = '' }) {
  const toast = useToast();
  const [name, setName] = useState(prefill);
  const [imageUrl, setImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) setName(prefill); }, [open, prefill]);

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
      setImageUrl(json?.data || json?.imageUrl || '');
    } catch { toast('Lỗi upload ảnh', 'error'); }
    finally { setUploading(false); }
  };

  const handleSave = async () => {
    if (!name.trim()) return toast('Tên không được trống', 'error');
    setSaving(true);
    try {
      let res;
      if (parentId) {
        // Subcategory → gọi endpoint riêng /api/operator/subcategories
        const payload = { name: name.trim(), imageUrl, categoryId: parentId };
        res = await operatorApi.createSubCategory(payload);
      } else {
        // Category gốc → gọi /api/operator/categories
        const payload = { name: name.trim(), imageUrl };
        res = await operatorApi.createCategory(payload);
      }
      const created = res.data?.data || res.data;
      toast(`Đã tạo "${name.trim()}"`, 'success');
      // Truyền parentId vào để handleQuickCreated biết đây là subcategory hay category
      onCreated(created, parentId);
      onClose();
    } catch (e) {
      toast(e?.response?.data?.message || 'Lỗi tạo danh mục', 'error');
    } finally { setSaving(false); }
  };

  if (!open) return null;

  const imgSrc = (url) => {
    if (!url) return null;
    return url.startsWith('http') ? url : `${BASE_URL}/api/auth${url}`;
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#F0EBE3]">
          <div>
            <h3 className="text-base font-bold text-[#1C1C1E]">
              {parentId ? 'Thêm danh mục con' : 'Thêm danh mục'}
            </h3>
            {parentId && parentName && (
              <p className="text-xs text-[#8E8878] mt-0.5">Thuộc: <strong>{parentName}</strong></p>
            )}
          </div>
          <button onClick={onClose} className="text-[#8E8878] hover:text-[#1C1C1E]"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          {/* Image */}
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-xl border border-[#E8DDD0] bg-[#FAF7F2] flex items-center justify-center overflow-hidden flex-shrink-0">
              {imageUrl
                ? <img src={imgSrc(imageUrl)} alt="" className="w-full h-full object-cover" />
                : <ImagePlus size={20} className="text-[#D3CFC8]" />}
            </div>
            <label className="flex items-center gap-2 px-3 py-2 text-xs rounded-xl border border-[#E8DDD0] text-[#5C5C5C] hover:border-[#C9A84C] cursor-pointer transition-all">
              {uploading ? <div className="w-3 h-3 border border-[#C9A84C] border-t-transparent rounded-full animate-spin" /> : <ImagePlus size={13} />}
              {uploading ? 'Đang tải...' : 'Chọn ảnh'}
              <input type="file" accept="image/*" className="hidden" onChange={e => handleUpload(e.target.files[0])} />
            </label>
          </div>
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-[#5C5C5C] mb-1">Tên danh mục *</label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="VD: Thịt bò, Rau củ..."
              className="w-full px-3 py-2.5 text-sm rounded-xl border border-[#E8DDD0] focus:outline-none focus:border-[#C9A84C]"
              onKeyDown={e => e.key === 'Enter' && handleSave()} />
          </div>
        </div>
        <div className="px-5 pb-5 flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-[#E8DDD0] text-sm text-[#5C5C5C] hover:bg-[#FAF7F2]">Huỷ</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 rounded-xl btn-gold text-sm font-medium disabled:opacity-50">
            {saving ? 'Đang lưu...' : 'Tạo'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function OperatorIngredientsPage() {
  const toast = useToast();
  const [ingredients, setIngredients] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subCategories, setSubCategories] = useState([]); // từ bảng sub_categories
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCatId, setFilterCatId] = useState('');
  const [filterSubCatId, setFilterSubCatId] = useState('');
  const [modal, setModal] = useState({ open: false, item: null });
  const [form, setForm] = useState({ name: '', unit: 'kg', imageUrl: '', itemCode: '', categoryId: '', subCategoryId: '' });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Quick create category modal state
  const [quickCreate, setQuickCreate] = useState({
    open: false, parentId: null, parentName: '', prefill: '', target: null, // 'category' | 'subcategory'
  });

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      operatorApi.getIngredients(),
      operatorApi.getCategories(),
      operatorApi.getAllSubCategories(),
    ])
      .then(([ingRes, catRes, subCatRes]) => {
        setIngredients(ingRes.data?.data || []);
        setCategories(catRes.data?.data || []);
        setSubCategories(subCatRes.data?.data || []);
      })
      .catch(() => toast('Lỗi tải dữ liệu', 'error'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { fetchData(); }, []);

  // Category helpers
  const rootCats = useMemo(() => categories, [categories]); // API đã chỉ trả root
  // subCatsOf dùng bảng sub_categories riêng
  const subCatsOf = (catId) => subCategories.filter(s => String(s.categoryId) === String(catId));
  const availableSubCats = filterCatId ? subCatsOf(filterCatId) : [];
  const formSubCats = form.categoryId ? subCatsOf(form.categoryId) : [];

  const getCatName = (id) => categories.find(c => String(c.id) === String(id))?.name || '—';
  const getSubCatName = (id) => subCategories.find(s => String(s.id) === String(id))?.name || '—';

  // Open create ingredient modal
  const openCreate = () => {
    setForm({ name: '', unit: 'kg', imageUrl: '', itemCode: '', categoryId: '', subCategoryId: '' });
    setModal({ open: true, item: null });
  };
  const openEdit = (i) => {
    setForm({
      name: i.name, unit: i.unit || 'kg', imageUrl: i.imageUrl || '',
      itemCode: i.itemCode || '',
      categoryId: i.categoryId ? String(i.categoryId) : '',
      subCategoryId: i.subCategoryId ? String(i.subCategoryId) : '',
    });
    setModal({ open: true, item: i });
  };

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData(); fd.append('image', file);
      const res = await window.fetch(`${BASE_URL}/api/upload/ingredient-image`, {
        method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }, body: fd,
      });
      const json = await res.json();
      setForm(f => ({ ...f, imageUrl: json?.data?.imageUrl || '' }));
    } catch { toast('Lỗi upload ảnh', 'error'); }
    finally { setUploading(false); }
  };

  const handleSave = async () => {
    if (!form.name.trim()) return toast('Tên nguyên liệu không được trống', 'error');
    if (!form.unit) return toast('Chọn đơn vị', 'error');
    setSaving(true);
    try {
      const payload = {
        name: form.name, unit: form.unit, imageUrl: form.imageUrl,
        itemCode: form.itemCode || null,
        categoryId: form.categoryId ? Number(form.categoryId) : null,
        subCategoryId: form.subCategoryId ? Number(form.subCategoryId) : null,
      };
      if (modal.item) {
        await operatorApi.updateIngredient(modal.item.id, payload);
        toast('Cập nhật thành công', 'success');
      } else {
        await operatorApi.createIngredient(payload);
        toast('Tạo nguyên liệu thành công', 'success');
      }
      setModal({ open: false, item: null });
      fetchData();
    } catch (e) { toast(e?.response?.data?.message || 'Lỗi lưu nguyên liệu', 'error'); }
    finally { setSaving(false); }
  };

  // Quick create category handlers
  const handleQuickCreateCategory = (prefill = '') => {
    setQuickCreate({ open: true, parentId: null, parentName: '', prefill, target: 'category' });
  };
  const handleQuickCreateSubCategory = (prefill = '') => {
    const parentCat = rootCats.find(c => String(c.id) === form.categoryId);
    setQuickCreate({
      open: true,
      parentId: form.categoryId ? Number(form.categoryId) : null,
      parentName: parentCat?.name || '',
      prefill, target: 'subcategory',
    });
  };
  const handleQuickCreated = (created, parentId) => {
    // parentId !== null → là subcategory (bảng sub_categories)
    // parentId === null → là category gốc (bảng categories)
    if (parentId == null) {
      // Reload categories root
      operatorApi.getCategories().then(r => {
        setCategories(r.data?.data || []);
        if (created?.id) setForm(f => ({ ...f, categoryId: String(created.id), subCategoryId: '' }));
      }).catch(() => { });
    } else {
      // Reload subcategories của parent này
      operatorApi.getAllSubCategories().then(r => {
        setSubCategories(r.data?.data || []);
        if (created?.id) setForm(f => ({ ...f, subCategoryId: String(created.id) }));
      }).catch(() => { });
    }
  };

  const handleExport = () => toast('Chức năng Export sẽ được xử lý ở backend', 'info');
  const handleImport = (file) => { if (!file) return; toast('Chức năng Import sẽ được xử lý ở backend', 'info'); };

  const imgSrc = (url) => {
    if (!url) return null;
    return url.startsWith('http') ? url : `${BASE_URL}/api/auth${url}`;
  };

  const filtered = useMemo(() => {
    let list = ingredients;
    if (filterCatId) list = list.filter(i => String(i.categoryId) === filterCatId);
    if (filterSubCatId) list = list.filter(i => String(i.subCategoryId) === filterSubCatId);
    if (search) list = list.filter(i =>
      i.name?.toLowerCase().includes(search.toLowerCase()) ||
      i.itemCode?.toLowerCase().includes(search.toLowerCase())
    );
    return list;
  }, [ingredients, filterCatId, filterSubCatId, search]);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 bg-white border-b border-[#F0EBE3]">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-[#1C1C1E]" style={{ fontFamily: 'var(--font-display)' }}>Nguyên liệu</h1>
            <p className="text-xs text-[#8E8878]">{filtered.length}/{ingredients.length} nguyên liệu</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Category filter combobox */}
            <div className="w-44">
              <CategoryCombobox
                options={rootCats}
                value={filterCatId}
                onChange={(v) => { setFilterCatId(v); setFilterSubCatId(''); }}
                placeholder="Tất cả danh mục"
              />
            </div>
            {/* Sub category filter */}
            {filterCatId && availableSubCats.length > 0 && (
              <div className="w-44">
                <CategoryCombobox
                  options={availableSubCats}
                  value={filterSubCatId}
                  onChange={setFilterSubCatId}
                  placeholder="Tất cả danh mục con"
                />
              </div>
            )}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8878]" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm tên, mã hàng..."
                className="pl-8 pr-3 py-2 text-sm rounded-xl border border-[#E8DDD0] bg-[#FAF7F2] focus:outline-none focus:border-[#C9A84C] w-44" />
            </div>
            <label className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[#E8DDD0] text-sm text-[#5C5C5C] hover:border-[#C9A84C] cursor-pointer transition-all">
              <Upload size={14} /> Import
              <input type="file" accept=".xlsx,.csv" className="hidden" onChange={e => handleImport(e.target.files[0])} />
            </label>
            <button onClick={handleExport}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[#E8DDD0] text-sm text-[#5C5C5C] hover:border-[#C9A84C] transition-all">
              <Download size={14} /> Export
            </button>
            <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 rounded-xl btn-gold text-sm font-medium">
              <Plus size={15} /> Thêm mới
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-6 h-6 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-[#8E8878]">
            <Leaf size={40} className="mx-auto mb-3 opacity-30" />
            <p>Không tìm thấy nguyên liệu</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-[#F0EBE3] overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[#FAF7F2] border-b border-[#F0EBE3]">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#5C5C5C]">Nguyên liệu</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#5C5C5C]">Mã hàng</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#5C5C5C]">Danh mục</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#5C5C5C]">Danh mục con</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#5C5C5C]">Đơn vị</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(i => (
                  <tr key={i.id} className="border-b border-[#F0EBE3] hover:bg-[#FAF7F2] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg border border-[#F0EBE3] bg-[#FAF7F2] flex items-center justify-center overflow-hidden flex-shrink-0">
                          {imgSrc(i.imageUrl)
                            ? <img src={imgSrc(i.imageUrl)} alt={i.name} className="w-full h-full object-cover" />
                            : <Leaf size={14} className="text-[#D3CFC8]" />}
                        </div>
                        <span className="font-medium text-[#1C1C1E]">{i.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {i.itemCode
                        ? <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-xs font-mono">{i.itemCode}</span>
                        : <span className="text-[#C4B9A8]">—</span>}
                    </td>
                    <td className="px-4 py-3 text-[#5C5C5C] text-xs">{getCatName(i.categoryId)}</td>
                    <td className="px-4 py-3 text-[#5C5C5C] text-xs">{getSubCatName(i.subCategoryId)}</td>
                    <td className="px-4 py-3 text-[#8E8878]">{i.unit}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => openEdit(i)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-[#E8DDD0] text-[#5C5C5C] hover:border-[#C9A84C] hover:text-[#C9A84C] transition-all">
                        <Edit2 size={11} /> Sửa
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal thêm/sửa nguyên liệu */}
      {modal.open && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#F0EBE3] sticky top-0 bg-white z-10">
              <h2 className="text-lg font-bold text-[#1C1C1E]">{modal.item ? 'Sửa nguyên liệu' : 'Thêm nguyên liệu'}</h2>
              <button onClick={() => setModal({ open: false, item: null })} className="text-[#8E8878] hover:text-[#1C1C1E]"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              {/* Image */}
              <div>
                <label className="block text-xs font-medium text-[#5C5C5C] mb-1">Ảnh</label>
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-xl border border-[#E8DDD0] bg-[#FAF7F2] flex items-center justify-center overflow-hidden flex-shrink-0">
                    {form.imageUrl
                      ? <img src={imgSrc(form.imageUrl)} alt="" className="w-full h-full object-cover" />
                      : <ImagePlus size={20} className="text-[#D3CFC8]" />}
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
                <label className="block text-xs font-medium text-[#5C5C5C] mb-1">Tên nguyên liệu *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Nhập tên nguyên liệu"
                  className="w-full px-3 py-2.5 text-sm rounded-xl border border-[#E8DDD0] focus:outline-none focus:border-[#C9A84C]" />
              </div>

              {/* Item code */}
              <div>
                <label className="block text-xs font-medium text-[#5C5C5C] mb-1">Mã hàng</label>
                <input value={form.itemCode} onChange={e => setForm(f => ({ ...f, itemCode: e.target.value }))}
                  placeholder="VD: NL-001, THIT-BO-01"
                  className="w-full px-3 py-2.5 text-sm rounded-xl border border-[#E8DDD0] focus:outline-none focus:border-[#C9A84C] font-mono" />
              </div>

              {/* Category — combobox + nút + tạo nhanh */}
              <CategoryCombobox
                label="Danh mục"
                options={rootCats}
                value={form.categoryId}
                onChange={v => setForm(f => ({ ...f, categoryId: v, subCategoryId: '' }))}
                onCreateNew={handleQuickCreateCategory}
                placeholder="Chọn hoặc tìm danh mục..."
              />

              {/* Sub category — chỉ hiện khi đã chọn category */}
              {form.categoryId && (
                <CategoryCombobox
                  label="Danh mục con"
                  options={formSubCats}
                  value={form.subCategoryId}
                  onChange={v => setForm(f => ({ ...f, subCategoryId: v }))}
                  onCreateNew={formSubCats.length === 0 || true ? handleQuickCreateSubCategory : undefined}
                  placeholder={formSubCats.length === 0 ? 'Chưa có danh mục con — nhấn + để tạo' : 'Chọn danh mục con...'}
                />
              )}

              {/* Unit */}
              <div>
                <label className="block text-xs font-medium text-[#5C5C5C] mb-1">Đơn vị *</label>
                <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm rounded-xl border border-[#E8DDD0] bg-white focus:outline-none focus:border-[#C9A84C]">
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

      {/* Quick create category modal */}
      <QuickCreateCategoryModal
        open={quickCreate.open}
        onClose={() => setQuickCreate(q => ({ ...q, open: false }))}
        onCreated={handleQuickCreated}
        parentId={quickCreate.parentId}
        parentName={quickCreate.parentName}
        prefill={quickCreate.prefill}
      />
    </div>
  );
}