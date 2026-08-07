// src/pages/operator/OperatorIngredientsPage.jsx
// THAY ĐỔI: thêm nút xóa ingredient + confirm dialog
import { useLang } from '../../context/LangContext';
import { useState, useEffect, useMemo, useRef } from 'react';
import useMinLoading from '../../hooks/useMinLoading.js';
import { operatorApi } from '../../api/operatorApi';
import { useToast } from '../../components/common/Toast';
import {
  Plus, Edit2, Search, X, Leaf, ImagePlus,
  Download, Upload, Warehouse, Check, ChevronRight, ChevronDown,
  FolderOpen, Folder, Trash2, AlertTriangle,
} from 'lucide-react';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:9261';
// Danh sách đơn vị tính khi tạo/sửa nguyên liệu.
//
//   Viết THƯỜNG toàn bộ để khớp với dữ liệu đang có trong bảng ingredient của
//   trang này. Trang Kho và trang Bán hàng dùng danh sách viết Hoa ('Kg', 'Bó')
//   — hai kiểu vẫn tồn tại song song vì đơn vị lưu nguyên chuỗi vào DB, đổi
//   kiểu chữ ở đây sẽ làm nguyên liệu cũ không khớp option nào và ô chọn hiện
//   trống khi mở form sửa.
//
//   'bó' và 'mét' bổ sung 08/2026 — hai trang kia đã có sẵn.
const UNITS = ['kg', 'gram', 'lít', 'ml', 'cái', 'hộp', 'túi', 'chai', 'bó', 'mét'];

// ── ConfirmDeleteModal ────────────────────────────────────────────────────────
function ConfirmDeleteModal({ open, onClose, onConfirm, itemName, deleting }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={18} className="text-red-500" />
            </div>
            <div>
              <h3 className="text-base font-bold text-ink">Xác nhận xóa</h3>
              <p className="text-xs text-muted mt-0.5">Hành động này không thể hoàn tác</p>
            </div>
          </div>
          <p className="text-sm text-ink-2">
            Bạn có chắc muốn xóa nguyên liệu <strong>"{itemName}"</strong>?
            <br />
            <span className="text-xs text-muted">
              Các đơn hàng và giao dịch kho cũ vẫn giữ nguyên thông tin.
            </span>
          </p>
        </div>
        <div className="px-6 pb-6 flex gap-2">
          <button onClick={onClose} disabled={deleting}
            className="flex-1 py-2.5 rounded-xl border border-line text-sm text-ink-2 hover:bg-canvas disabled:opacity-50">
            Huỷ
          </button>
          <button onClick={onConfirm} disabled={deleting}
            className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
            {deleting
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <Trash2 size={14} />}
            {deleting ? 'Đang xóa...' : 'Xóa nguyên liệu'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── CategoryCombobox ──────────────────────────────────────────────────────────
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

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const handleOpen = () => { if (disabled) return; setOpen(true); setQuery(''); setTimeout(() => inputRef.current?.focus(), 50); };
  const handleSelect = (opt) => { onChange(String(opt.id)); setOpen(false); setQuery(''); };
  const handleClear = (e) => { e.stopPropagation(); onChange(''); };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {label && <label className="block text-xs font-medium text-ink-2 mb-1">{label}</label>}
      <div className="flex items-center gap-1.5">
        <div onClick={handleOpen}
          className={`flex-1 min-w-0 flex items-center gap-2 px-3 py-2.5 text-sm rounded-xl border cursor-pointer transition-all
    ${disabled ? 'opacity-50 cursor-not-allowed bg-canvas' : 'bg-surface hover:border-gold'}
    ${open ? 'border-gold ring-1 ring-gold/20' : 'border-line'}`}>
          {selected
            ? <><span className="flex-1 text-ink truncate">{selected.name}</span>
              <button onClick={handleClear} className="text-faint hover:text-ink-2"><X size={13} /></button></>
            : <span className="flex-1 text-faint">{placeholder}</span>}
          <Search size={13} className="text-faint flex-shrink-0" />
        </div>
        {onCreateNew && !disabled && (
          <button onClick={() => onCreateNew(query)}
            className="w-9 h-9 flex items-center justify-center rounded-xl border border-line text-gold hover:border-gold hover:bg-gold/10 transition-all flex-shrink-0">
            <Plus size={15} />
          </button>
        )}
      </div>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-surface border border-line rounded-xl shadow-xl overflow-hidden"
          style={{ width: 'calc(100% - 44px)', minWidth: 180, maxHeight: 260 }}>
          <div className="p-2 border-b border-line-soft">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
              <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Tìm danh mục..."
                className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-line focus:outline-none focus:border-gold" />
            </div>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 196 }}>
            {filtered.length === 0
              ? <div className="px-3 py-3 text-xs text-faint text-center">
                Không tìm thấy
                {query && onCreateNew && (
                  <button onClick={() => { onCreateNew(query); setOpen(false); }}
                    className="block mx-auto mt-1.5 text-gold font-medium hover:underline">
                    + Tạo "{query}"
                  </button>
                )}
              </div>
              : filtered.map(opt => (
                <button key={opt.id} onClick={() => handleSelect(opt)}
                  className={`w-full text-left px-3 py-2.5 text-sm flex items-center gap-2 hover:bg-canvas transition-colors
                    ${String(opt.id) === String(value) ? 'text-gold font-semibold bg-gold/5' : 'text-ink'}`}>
                  {opt.imageUrl && (
                    <div className="w-6 h-6 rounded-md overflow-hidden flex-shrink-0 border border-line-soft">
                      <img src={opt.imageUrl.startsWith('http') ? opt.imageUrl : `${BASE_URL}/api/auth${opt.imageUrl}`}
                        alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  {opt.name}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── QuickCreateCategoryModal ──────────────────────────────────────────────────
function QuickCreateCategoryModal({ open, onClose, onCreated, parentId, parentName, prefill = '' }) {
  const toast = useToast();
  const { t } = useLang();
  const [name, setName] = useState(prefill);
  const [imageUrl, setImageUrl] = useState('');
  const [uploading, setUploading] = useMinLoading();
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) setName(prefill); }, [open, prefill]);

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData(); fd.append('file', file);
      const res = await fetch(`${BASE_URL}/api/upload/categories/upload-image`, {
        method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }, body: fd,
      });
      const json = await res.json();
      setImageUrl(json?.data || json?.imageUrl || '');
    } catch { toast(t('common', 'error'), 'error'); }
    finally { setUploading(false); }
  };

  const handleSave = async () => {
    if (!name.trim()) return toast(t('category', 'name_required'), 'error');
    setSaving(true);
    try {
      const res = parentId
        ? await operatorApi.createSubCategory({ name: name.trim(), imageUrl, categoryId: parentId })
        : await operatorApi.createCategory({ name: name.trim(), imageUrl });
      const created = res.data?.data || res.data;
      toast(`${t('common', 'success')}: "${name.trim()}"`, 'success');
      onCreated(created, parentId);
      onClose();
    } catch (e) {
      toast(e?.response?.data?.message || t('common', 'error'), 'error');
    } finally { setSaving(false); }
  };

  if (!open) return null;
  const imgSrc = (url) => !url ? null : url.startsWith('http') ? url : `${BASE_URL}/api/auth${url}`;

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-line-soft">
          <div>
            <h3 className="text-base font-bold text-ink">
              {parentId ? t('category', 'add_sub_category') : t('category', 'add_category')}
            </h3>
            {parentId && parentName && <p className="text-xs text-muted mt-0.5">Thuộc: <strong>{parentName}</strong></p>}
          </div>
          <button onClick={onClose} className="text-muted hover:text-ink"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-xl border border-line bg-canvas flex items-center justify-center overflow-hidden flex-shrink-0">
              {imageUrl ? <img src={imgSrc(imageUrl)} alt="" className="w-full h-full object-cover" /> : <ImagePlus size={20} className="text-faint" />}
            </div>
            <label className="flex items-center gap-2 px-3 py-2 text-xs rounded-xl border border-line text-ink-2 hover:border-gold cursor-pointer transition-all">
              {uploading ? <div className="w-3 h-3 border border-gold border-t-transparent rounded-full animate-spin" /> : <ImagePlus size={13} />}
              {uploading ? t('common', 'loading') : t('common', 'select')}
              <input type="file" accept="image/*" className="hidden" onChange={e => handleUpload(e.target.files[0])} />
            </label>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-2 mb-1">{t('category', 'category')} *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="VD: Thịt bò, Rau củ..."
              className="w-full px-3 py-2.5 text-sm rounded-xl border border-line focus:outline-none focus:border-gold"
              onKeyDown={e => e.key === 'Enter' && handleSave()} />
          </div>
        </div>
        <div className="px-5 pb-5 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-line text-sm text-ink-2 hover:bg-canvas">{t('common', 'cancel')}</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 rounded-xl btn-gold text-sm font-medium disabled:opacity-50">
            {saving ? t('common', 'saving') : t('common', 'create')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── WarehouseModal ────────────────────────────────────────────────────────────
function WarehouseModal({ open, onClose, ingredient, warehouses, onSaved }) {
  const toast = useToast();
  const [selected, setSelected] = useState(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && ingredient)
      setSelected(new Set((ingredient.warehouseIds || []).map(String)));
  }, [open, ingredient]);

  const toggle = (wid) => setSelected(prev => {
    const next = new Set(prev);
    next.has(String(wid)) ? next.delete(String(wid)) : next.add(String(wid));
    return next;
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      await operatorApi.assignIngredientWarehouses(ingredient.id, [...selected].map(Number));
      toast('Cập nhật kho thành công', 'success');
      onSaved(); onClose();
    } catch (e) {
      toast(e?.response?.data?.message || 'Lỗi cập nhật kho', 'error');
    } finally { setSaving(false); }
  };

  if (!open || !ingredient) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-line-soft">
          <div>
            <h3 className="text-base font-bold text-ink">Quản lý kho</h3>
            <p className="text-xs text-muted mt-0.5"><strong>{ingredient.name}</strong></p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-ink"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-2 max-h-64 overflow-y-auto">
          {warehouses.length === 0
            ? <p className="text-sm text-center text-faint py-4">Chưa có kho nào</p>
            : warehouses.map(wh => {
              const isSelected = selected.has(String(wh.id));
              return (
                <button key={wh.id} onClick={() => toggle(wh.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left
                    ${isSelected ? 'border-gold bg-gold/5' : 'border-line hover:border-gold/50'}`}>
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0
                    ${isSelected ? 'border-gold bg-gold' : 'border-line'}`}>
                    {isSelected && <Check size={12} className="text-white" strokeWidth={3} />}
                  </div>
                  <span className="text-sm font-medium">{wh.name}</span>
                </button>
              );
            })}
        </div>
        <div className="px-5 pb-5 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-line text-sm text-ink-2 hover:bg-canvas">Huỷ</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 rounded-xl btn-gold text-sm font-medium disabled:opacity-50">
            {saving ? 'Đang lưu...' : 'Lưu'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── IngredientRow ─────────────────────────────────────────────────────────────
// THAY ĐỔI: thêm prop onDelete + nút Xóa
function IngredientRow({ ingredient, warehouses, onEdit, onManageWarehouse, onDelete, imgSrc }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-canvas transition-colors group">
      <div className="w-7 h-7 rounded-lg border border-line-soft bg-canvas flex items-center justify-center overflow-hidden flex-shrink-0">
        {imgSrc(ingredient.imageUrl)
          ? <img src={imgSrc(ingredient.imageUrl)} alt={ingredient.name} className="w-full h-full object-cover" />
          : <Leaf size={12} className="text-faint" />}
      </div>

      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-ink">{ingredient.name}</span>
        {ingredient.itemCode && (
          <span className="ml-2 px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-300 text-[10px] font-mono">
            {ingredient.itemCode}
          </span>
        )}
      </div>

      <span className="text-xs text-muted flex-shrink-0 min-w-[40px] text-center">
        {ingredient.unit.toUpperCase()}
      </span>

      <div className="w-px h-4 bg-surface-3 flex-shrink-0" />

      <div className="flex items-center gap-1 flex-shrink-0">
        <button onClick={() => onEdit(ingredient)}
          className="flex items-center gap-1 px-2.5 py-1 text-[10px] rounded-lg border border-line text-ink-2 hover:border-gold hover:text-gold transition-all">
          <Edit2 size={10} /> Sửa
        </button>
        {/* [NEW] Nút xóa — ẩn mặc định, hiện khi hover row */}
        <button
          onClick={() => onDelete(ingredient)}
          className="flex items-center gap-1 px-2.5 py-1 text-[10px] rounded-lg border border-transparent
            text-faint hover:border-red-200 dark:border-red-500/28 hover:text-red-500 hover:bg-red-50 dark:bg-red-500/10 transition-all
            opacity-0 group-hover:opacity-100">
          <Trash2 size={10} /> Xóa
        </button>
      </div>
    </div>
  );
}

// ── CategoryTree ──────────────────────────────────────────────────────────────
// THAY ĐỔI: truyền onDelete xuống IngredientRow
function CategoryTree({ categories, subCategories, ingredients, warehouses, search,
  onEdit, onManageWarehouse, onDelete, imgSrc }) {

  const [expandedCatId, setExpandedCatId] = useState(null);
  const [expandedSubIds, setExpandedSubIds] = useState(new Set());

  const toggleCat = (catId) => {
    setExpandedCatId(prev => prev === catId ? null : catId);
    setExpandedSubIds(new Set());
  };

  const toggleSub = (subId) => {
    setExpandedSubIds(prev => {
      const next = new Set(prev);
      next.has(subId) ? next.delete(subId) : next.add(subId);
      return next;
    });
  };

  const matchSearch = (ing) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return ing.name?.toLowerCase().includes(q) || ing.itemCode?.toLowerCase().includes(q);
  };

  const ingsOfCat = (catId) => ingredients.filter(i =>
    String(i.categoryId) === String(catId) && !i.subCategoryId && matchSearch(i)
  );
  const ingsOfSub = (subId) => ingredients.filter(i =>
    String(i.subCategoryId) === String(subId) && matchSearch(i)
  );
  const ingsNoCat = ingredients.filter(i => !i.categoryId && matchSearch(i));
  const subsOfCat = (catId) => subCategories.filter(s => String(s.categoryId) === String(catId));

  const countCat = (catId) => {
    const direct = ingredients.filter(i => String(i.categoryId) === String(catId) && !i.subCategoryId && matchSearch(i)).length;
    const fromSubs = subsOfCat(catId).reduce((acc, s) => acc + ingsOfSub(s.id).length, 0);
    return direct + fromSubs;
  };

  // Shared row renderer
  const renderRow = (ing) => (
    <IngredientRow key={ing.id} ingredient={ing} warehouses={warehouses}
      onEdit={onEdit} onManageWarehouse={onManageWarehouse}
      onDelete={onDelete} imgSrc={imgSrc} />
  );

  return (
    <div className="bg-surface rounded-2xl border border-line-soft overflow-hidden">
      {categories.map(cat => {
        const isExpanded = expandedCatId === cat.id;
        const subs = subsOfCat(cat.id);
        const directIngs = ingsOfCat(cat.id);
        const total = countCat(cat.id);

        return (
          <div key={cat.id} className="border-b border-line-soft last:border-b-0">
            <button onClick={() => toggleCat(cat.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors
                ${isExpanded ? 'bg-canvas' : 'hover:bg-canvas/60'}`}>
              <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 text-gold">
                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </div>
              {cat.imageUrl ? (
                <div className="w-6 h-6 rounded-md overflow-hidden flex-shrink-0 border border-line-soft">
                  <img src={cat.imageUrl.startsWith('http') ? cat.imageUrl : `${BASE_URL}/api/auth${cat.imageUrl}`}
                    alt="" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                  {isExpanded ? <FolderOpen size={15} className="text-gold" /> : <Folder size={15} className="text-muted" />}
                </div>
              )}
              <span className={`flex-1 text-sm font-semibold ${isExpanded ? 'text-gold' : 'text-ink'}`}>
                {cat.name}
              </span>
              <span className="text-xs text-faint bg-surface-2 px-2 py-0.5 rounded-full flex-shrink-0">
                {total}
              </span>
            </button>

            {isExpanded && (
              <div className="border-t border-line-soft/60">
                {subs.map(sub => {
                  const isSubExpanded = expandedSubIds.has(sub.id);
                  const subIngs = ingsOfSub(sub.id);
                  return (
                    <div key={sub.id}>
                      <button onClick={() => toggleSub(sub.id)}
                        className={`w-full flex items-center gap-3 pl-10 pr-4 py-2.5 text-left transition-colors
                          ${isSubExpanded ? 'bg-gold/5' : 'hover:bg-canvas/80'}`}>
                        <div className="w-4 h-4 flex items-center justify-center flex-shrink-0 text-gold">
                          {isSubExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                        </div>
                        {sub.imageUrl ? (
                          <div className="w-5 h-5 rounded overflow-hidden flex-shrink-0 border border-line-soft">
                            <img src={sub.imageUrl.startsWith('http') ? sub.imageUrl : `${BASE_URL}/api/auth${sub.imageUrl}`}
                              alt="" className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="w-5 h-5 flex items-center justify-center">
                            {isSubExpanded ? <FolderOpen size={13} className="text-gold" /> : <Folder size={13} className="text-muted" />}
                          </div>
                        )}
                        <span className={`flex-1 text-xs font-medium ${isSubExpanded ? 'text-gold' : 'text-ink-2'}`}>
                          {sub.name}
                        </span>
                        <span className="text-[10px] text-faint bg-surface-2 px-1.5 py-0.5 rounded-full">
                          {subIngs.length}
                        </span>
                      </button>
                      {isSubExpanded && (
                        <div className="pl-14 border-t border-line-soft/40">
                          {subIngs.length === 0
                            ? <p className="px-4 py-3 text-xs text-faint">Không có nguyên liệu</p>
                            : subIngs.map(renderRow)}
                        </div>
                      )}
                    </div>
                  );
                })}

                {directIngs.length > 0 && (
                  <div className={`pl-10 ${subs.length > 0 ? 'border-t border-line-soft/40' : ''}`}>
                    {subs.length > 0 && (
                      <div className="px-4 py-1.5">
                        <span className="text-[10px] text-faint font-medium uppercase tracking-wide">Chung</span>
                      </div>
                    )}
                    {directIngs.map(renderRow)}
                  </div>
                )}

                {directIngs.length === 0 && subs.every(s => ingsOfSub(s.id).length === 0) && (
                  <p className="pl-10 px-4 py-3 text-xs text-faint">Không có nguyên liệu</p>
                )}
              </div>
            )}
          </div>
        );
      })}

      {ingsNoCat.length > 0 && (
        <div className="border-t border-line-soft">
          <div className="flex items-center gap-3 px-4 py-3 bg-canvas/40">
            <Leaf size={14} className="text-faint" />
            <span className="text-sm font-semibold text-muted">Chưa phân loại</span>
            <span className="text-xs text-faint bg-surface-2 px-2 py-0.5 rounded-full ml-auto">{ingsNoCat.length}</span>
          </div>
          {ingsNoCat.map(renderRow)}
        </div>
      )}
    </div>
  );
}

// ── Import Ingredients Modal ───────────────────────────────────────────────────
function ImportIngredientsModal({ open, onClose, onDone }) {
  const toast = useToast();
  const [step, setStep] = useState('upload'); // 'upload' | 'result'
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null); // { updated, skipped, errors }
  const [uploadError, setUploadError] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!open) { setStep('upload'); setResult(null); setUploadError(null); }
  }, [open]);

  const handleFile = async (file) => {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await operatorApi.importIngredients(fd);
      const body = res?.data || {};

      // Backend trả success:true nhưng code != 200 khi có lỗi nghiệp vụ
      if (!body.success || (body.data === null && body.message && body.code !== 200)) {
        setUploadError(body.message || 'Lỗi import nguyên liệu');
        return;
      }

      const d = body.data || {};
      setResult({
        updated: d.updated ?? 0,
        skipped: d.skipped ?? 0,
        errors:  d.errors  || [],
      });
      setStep('result');
      if ((d.updated ?? 0) > 0) onDone();
    } catch (e) {
      setUploadError(e?.response?.data?.message || 'Lỗi import nguyên liệu');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-line-soft">
          <div>
            <h2 className="text-base font-bold text-ink">Import nguyên liệu</h2>
            <p className="text-xs text-muted mt-0.5">
              {step === 'upload'
                ? 'Tải file Excel đã export từ hệ thống để cập nhật'
                : 'Kết quả import'}
            </p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-ink">
            <X size={20} />
          </button>
        </div>

        {step === 'upload' ? (
          <div className="flex flex-col items-center justify-center p-10 gap-5">
            <div className="w-16 h-16 rounded-full bg-gold/10 flex items-center justify-center">
              {uploading
                ? <div className="w-8 h-8 border-3 border-gold border-t-transparent rounded-full animate-spin" />
                : <Upload size={28} className="text-gold" />}
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-ink">
                {uploading ? 'Đang xử lý...' : 'Chọn file Excel để import'}
              </p>
              <p className="text-xs text-muted mt-1">
                Dùng file đã Export từ hệ thống. Backend dựa vào cột <strong>ID</strong> để cập nhật.
              </p>
              <p className="text-xs text-gold mt-1">
                ⚠ Danh mục và kho phải khớp tên trong hệ thống.
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-300 mt-1 bg-amber-50 dark:bg-amber-500/10 rounded-lg px-3 py-1.5">
                ⚠ Mỗi file chỉ import được <strong>1 lần</strong>. Export lại nếu muốn import tiếp.
              </p>
              {uploadError && (
                <div className="flex items-start gap-2 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/28 rounded-xl px-4 py-3 text-left max-w-xs">
                  <span className="text-red-500 mt-0.5 shrink-0">✕</span>
                  <p className="text-xs text-red-600 dark:text-red-300 font-medium">{uploadError}</p>
                </div>
              )}
            </div>
            {!uploading && (
              <label className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gold text-white text-sm font-semibold cursor-pointer hover:bg-gold-deep transition-colors">
                <Upload size={15} /> Chọn file .xlsx
                <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
                  onChange={e => { if (e.target.files[0]) handleFile(e.target.files[0]); }} />
              </label>
            )}
          </div>
        ) : (
          <div className="p-6 space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/28 rounded-xl px-4 py-3 text-center">
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-300">{result?.updated ?? 0}</p>
                <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">Cập nhật thành công</p>
              </div>
              <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/28 rounded-xl px-4 py-3 text-center">
                <p className="text-2xl font-bold text-red-500">{result?.skipped ?? 0}</p>
                <p className="text-xs text-red-600 dark:text-red-300 mt-0.5">Bỏ qua / lỗi</p>
              </div>
            </div>

            {/* Errors */}
            {result?.errors?.length > 0 && (
              <div className="bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/18 rounded-xl p-3 max-h-48 overflow-y-auto">
                <p className="text-xs font-semibold text-red-600 dark:text-red-300 mb-2">Chi tiết lỗi:</p>
                {result.errors.map((err, i) => (
                  <p key={i} className="text-xs text-red-500 py-0.5 border-b border-red-100 dark:border-red-500/18 last:border-0">{err}</p>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <button onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-line text-sm text-ink-2 hover:bg-canvas">
                Đóng
              </button>
              <label className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gold text-white text-sm font-semibold cursor-pointer hover:bg-gold-deep transition-colors">
                <Upload size={14} /> Import thêm
                <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
                  onChange={e => { if (e.target.files[0]) { setStep('upload'); handleFile(e.target.files[0]); } }} />
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function OperatorIngredientsPage() {
  const { t } = useLang();
  const toast = useToast();
  const [ingredients, setIngredients] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subCategories, setSubCategories] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useMinLoading();
  const [search, setSearch] = useState('');
  const [filterWarehouseId, setFilterWarehouseId] = useState('');
  const [modal, setModal] = useState({ open: false, item: null });
  const [form, setForm] = useState({
    name: '', unit: 'kg', imageUrl: '', itemCode: '',
    categoryId: '', subCategoryId: '', warehouseIds: [],
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useMinLoading();
  const [warehouseModal, setWarehouseModal] = useState({ open: false, ingredient: null });
  const [quickCreate, setQuickCreate] = useState({ open: false, parentId: null, parentName: '', prefill: '', target: null });

  // [NEW] Delete state
  const [deleteModal, setDeleteModal] = useState({ open: false, ingredient: null });
  const [deleting, setDeleting] = useState(false);

  // [NEW] Import modal state
  const [importModalOpen, setImportModalOpen] = useState(false);

  const fetchData = () => {
    setLoading(true);
    Promise.allSettled([
      operatorApi.getIngredients(),
      operatorApi.getCategories(),
      operatorApi.getAllSubCategories(),
      operatorApi.getWarehouses(),
    ]).then(([ingRes, catRes, subCatRes, whRes]) => {
      if (ingRes.status === 'fulfilled') setIngredients(ingRes.value.data?.data || []);
      if (catRes.status === 'fulfilled') setCategories(catRes.value.data?.data || []);
      if (subCatRes.status === 'fulfilled') setSubCategories(subCatRes.value.data?.data || []);
      if (whRes.status === 'fulfilled') setWarehouses(whRes.value.data?.data || []);
    }).finally(() => setLoading(false));
  };
  useEffect(() => { fetchData(); }, []);

  const rootCats = useMemo(() => categories, [categories]);
  const subCatsOf = (catId) => subCategories.filter(s => String(s.categoryId) === String(catId));
  const formSubCats = form.categoryId ? subCatsOf(form.categoryId) : [];

  const openCreate = () => {
    setForm({ name: '', unit: 'kg', imageUrl: '', itemCode: '', categoryId: '', subCategoryId: '', warehouseIds: [] });
    setModal({ open: true, item: null });
  };
  const openEdit = (i) => {
    setForm({
      name: i.name, unit: i.unit || 'kg', imageUrl: i.imageUrl || '',
      itemCode: i.itemCode || '',
      categoryId: i.categoryId ? String(i.categoryId) : '',
      subCategoryId: i.subCategoryId ? String(i.subCategoryId) : '',
      warehouseIds: i.warehouseIds || [],
    });
    setModal({ open: true, item: i });
  };

  // [NEW] Handle delete
  const handleDeleteClick = (ingredient) => {
    setDeleteModal({ open: true, ingredient });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteModal.ingredient) return;
    setDeleting(true);
    try {
      await operatorApi.deleteIngredient(deleteModal.ingredient.id);
      toast(`Đã xóa nguyên liệu "${deleteModal.ingredient.name}"`, 'success');
      setDeleteModal({ open: false, ingredient: null });
      fetchData();
    } catch (e) {
      toast(e?.response?.data?.message || 'Lỗi xóa nguyên liệu', 'error');
    } finally {
      setDeleting(false);
    }
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
      let savedId;
      if (modal.item) {
        await operatorApi.updateIngredient(modal.item.id, payload);
        savedId = modal.item.id;
        toast('Cập nhật thành công', 'success');
      } else {
        const res = await operatorApi.createIngredient(payload);
        savedId = res.data?.data?.id;
        toast('Tạo nguyên liệu thành công', 'success');
      }
      if (savedId) await operatorApi.assignIngredientWarehouses(savedId, form.warehouseIds.map(Number));
      setModal({ open: false, item: null });
      fetchData();
    } catch (e) { toast(e?.response?.data?.message || 'Lỗi lưu nguyên liệu', 'error'); }
    finally { setSaving(false); }
  };

  const toggleFormWarehouse = (wid) => {
    setForm(f => {
      const ids = f.warehouseIds.map(String);
      const s = String(wid);
      return { ...f, warehouseIds: ids.includes(s) ? ids.filter(i => i !== s).map(Number) : [...ids, s].map(Number) };
    });
  };

  const handleQuickCreateCategory = (prefill = '') =>
    setQuickCreate({ open: true, parentId: null, parentName: '', prefill, target: 'category' });

  const handleQuickCreateSubCategory = (prefill = '') => {
    const parentCat = rootCats.find(c => String(c.id) === form.categoryId);
    setQuickCreate({ open: true, parentId: form.categoryId ? Number(form.categoryId) : null, parentName: parentCat?.name || '', prefill, target: 'subcategory' });
  };

  const handleQuickCreated = (created, parentId) => {
    if (parentId == null) {
      operatorApi.getCategories().then(r => {
        setCategories(r.data?.data || []);
        if (created?.id) setForm(f => ({ ...f, categoryId: String(created.id), subCategoryId: '' }));
      }).catch(() => { });
    } else {
      operatorApi.getAllSubCategories().then(r => {
        setSubCategories(r.data?.data || []);
        if (created?.id) setForm(f => ({ ...f, subCategoryId: String(created.id) }));
      }).catch(() => { });
    }
  };

  const imgSrc = (url) => {
    if (!url) return null;
    return url.startsWith('http') ? url : `${BASE_URL}/api/auth${url}`;
  };

  const filteredIngredients = useMemo(() => {
    let list = ingredients;
    if (filterWarehouseId)
      list = list.filter(i => (i.warehouseIds || []).some(wid => String(wid) === filterWarehouseId));
    return list;
  }, [ingredients, filterWarehouseId]);

  const totalFiltered = useMemo(() => {
    if (!search.trim()) return filteredIngredients.length;
    const q = search.toLowerCase();
    return filteredIngredients.filter(i =>
      i.name?.toLowerCase().includes(q) || i.itemCode?.toLowerCase().includes(q)
    ).length;
  }, [filteredIngredients, search]);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 bg-surface border-b border-line-soft">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-ink" style={{ fontFamily: 'var(--font-display)' }}>Nguyên liệu</h1>
            <p className="text-xs text-muted">{totalFiltered}/{ingredients.length} nguyên liệu</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select value={filterWarehouseId} onChange={e => setFilterWarehouseId(e.target.value)}
              className="px-3 py-2 text-sm rounded-xl border border-line bg-canvas focus:outline-none focus:border-gold text-ink-2">
              <option value="">Tất cả kho</option>
              {warehouses.map(wh => <option key={wh.id} value={String(wh.id)}>{wh.name}</option>)}
            </select>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm tên, mã hàng..."
                className="pl-8 pr-3 py-2 text-sm rounded-xl border border-line bg-canvas focus:outline-none focus:border-gold w-44" />
            </div>
            <button onClick={() => setImportModalOpen(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-line text-sm text-ink-2 hover:border-gold transition-all">
              <Upload size={14} /> Import
            </button>
            <button onClick={async () => {
              try {
                const res = await operatorApi.exportIngredients();
                const blob = new Blob([res.data], {
                  type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                const disposition = res.headers?.['content-disposition'] || '';
                const match = disposition.match(/filename="?([^"]+)"?/);
                a.download = match ? match[1] : 'danh-sach-nguyen-lieu.xlsx';
                a.click();
                URL.revokeObjectURL(url);
                toast('Đã xuất file nguyên liệu', 'success');
              } catch (e) {
                toast(e?.response?.data?.message || 'Lỗi xuất file', 'error');
              }
            }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-line text-sm text-ink-2 hover:border-gold transition-all">
              <Download size={14} /> Export
            </button>
            <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 rounded-xl btn-gold text-sm font-medium">
              <Plus size={15} /> Thêm mới
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <CategoryTree
            categories={rootCats}
            subCategories={subCategories}
            ingredients={filteredIngredients}
            warehouses={warehouses}
            search={search}
            onEdit={openEdit}
            onManageWarehouse={(ing) => setWarehouseModal({ open: true, ingredient: ing })}
            onDelete={handleDeleteClick}  // [NEW]
            imgSrc={imgSrc}
          />
        )}
      </div>

      {/* Modal thêm/sửa */}
      {modal.open && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-line-soft sticky top-0 bg-surface z-10">
              <h2 className="text-lg font-bold text-ink">{modal.item ? 'Sửa nguyên liệu' : 'Thêm nguyên liệu'}</h2>
              <button onClick={() => setModal({ open: false, item: null })} className="text-muted hover:text-ink"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-ink-2 mb-1">Tên nguyên liệu *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Nhập tên nguyên liệu"
                  className="w-full px-3 py-2.5 text-sm rounded-xl border border-line focus:outline-none focus:border-gold" />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-2 mb-1">Mã hàng</label>
                <input value={form.itemCode} onChange={e => setForm(f => ({ ...f, itemCode: e.target.value }))}
                  placeholder="VD: NL-001"
                  className="w-full px-3 py-2.5 text-sm rounded-xl border border-line focus:outline-none focus:border-gold font-mono" />
              </div>
              <CategoryCombobox label="Danh mục" options={rootCats} value={form.categoryId}
                onChange={v => setForm(f => ({ ...f, categoryId: v, subCategoryId: '' }))}
                onCreateNew={handleQuickCreateCategory} placeholder="Chọn hoặc tìm danh mục..." />
              {form.categoryId && (
                <CategoryCombobox label="Danh mục con" options={formSubCats} value={form.subCategoryId}
                  onChange={v => setForm(f => ({ ...f, subCategoryId: v }))}
                  onCreateNew={handleQuickCreateSubCategory}
                  placeholder={formSubCats.length === 0 ? 'Chưa có danh mục con — nhấn + để tạo' : 'Chọn danh mục con...'} />
              )}
              <div>
                <label className="block text-xs font-medium text-ink-2 mb-1">Đơn vị *</label>
                <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm rounded-xl border border-line bg-surface focus:outline-none focus:border-gold">
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-2 mb-2">Kho chứa nguyên liệu</label>
                {warehouses.length === 0
                  ? <p className="text-xs text-faint">Chưa có kho nào</p>
                  : <div className="grid grid-cols-2 gap-2">
                    {warehouses.map(wh => {
                      const isSelected = form.warehouseIds.map(String).includes(String(wh.id));
                      return (
                        <button key={wh.id} type="button" onClick={() => toggleFormWarehouse(wh.id)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-left transition-all
                            ${isSelected ? 'border-gold bg-gold/5' : 'border-line hover:border-gold/40'}`}>
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0
                            ${isSelected ? 'border-gold bg-gold' : 'border-line'}`}>
                            {isSelected && <Check size={10} className="text-white" strokeWidth={3} />}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-medium truncate">{wh.name}</div>
                            <div className="text-[10px] text-muted">{wh.type === 'TRANSIT' ? 'Trung chuyển' : 'Bán hàng'}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>}
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-2">
              <button onClick={() => setModal({ open: false, item: null })}
                className="flex-1 py-2.5 rounded-xl border border-line text-sm text-ink-2 hover:bg-canvas">Huỷ</button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-2.5 rounded-xl btn-gold text-sm font-medium disabled:opacity-50">
                {saving ? 'Đang lưu...' : t('common', 'save')}
              </button>
            </div>
          </div>
        </div>
      )}

      <WarehouseModal open={warehouseModal.open} ingredient={warehouseModal.ingredient}
        warehouses={warehouses} onClose={() => setWarehouseModal({ open: false, ingredient: null })}
        onSaved={fetchData} />

      <QuickCreateCategoryModal open={quickCreate.open}
        onClose={() => setQuickCreate(q => ({ ...q, open: false }))}
        onCreated={handleQuickCreated} parentId={quickCreate.parentId}
        parentName={quickCreate.parentName} prefill={quickCreate.prefill} />

      {/* [NEW] Delete confirm modal */}
      <ConfirmDeleteModal
        open={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, ingredient: null })}
        onConfirm={handleDeleteConfirm}
        itemName={deleteModal.ingredient?.name || ''}
        deleting={deleting}
      />

      {/* [NEW] Import modal */}
      <ImportIngredientsModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onDone={fetchData}
      />
    </div>
  );
}
