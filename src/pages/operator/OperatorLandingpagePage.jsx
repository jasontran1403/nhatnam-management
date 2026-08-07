// src/pages/operator/OperatorLandingpagePage.jsx
import { useLang } from '../../context/LangContext';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Sk, TableSkeleton } from '../../components/ui/Skeleton.jsx';
import useMinLoading from '../../hooks/useMinLoading.js';
import api from '../../api/axios';
import { useToast } from '../../components/common/Toast';
import { Plus, Pencil, Trash2, X, Upload, Globe, ChevronLeft, ChevronRight, Eye, EyeOff, Tag, ImageIcon, Calendar } from 'lucide-react';
import { BRAND } from '../../config/brand';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
function imgUrl(p) { if (!p) return null; return p.startsWith('http') ? p : `${BASE_URL}/api/auth${p}`; }

async function loadCKEditor() {
  if (window.ClassicEditor) return window.ClassicEditor;
  await new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.ckeditor.com/ckeditor5/39.0.1/classic/ckeditor.js';
    s.onload = res; s.onerror = rej; document.head.appendChild(s);
  });
  return window.ClassicEditor;
}

function RichEditor({ value, onChange, placeholder = '' }) {
  const elRef = useRef(null);
  const editorRef = useRef(null);
  const skipRef = useRef(false);
  useEffect(() => {
    let mounted = true;
    loadCKEditor().then(Editor => {
      if (!mounted || !elRef.current) return;
      Editor.create(elRef.current, {
        placeholder,
        toolbar: { items: ['heading', '|', 'fontFamily', 'fontSize', 'fontColor', 'fontBackgroundColor', '|', 'bold', 'italic', 'underline', 'strikethrough', '|', 'bulletedList', 'numberedList', 'todoList', '|', 'alignment', '|', 'link', 'blockQuote', 'insertTable', '|', 'horizontalLine', '|', 'undo', 'redo'], shouldNotGroupWhenFull: false },
        heading: {
          options: [
            { model: 'paragraph', title: t('misc', 'paragraph'), class: 'ck-heading_paragraph' },
            { model: 'heading1', view: 'h1', title: t('misc', 'heading1'), class: 'ck-heading_heading1' },
            { model: 'heading2', view: 'h2', title: t('misc', 'heading2'), class: 'ck-heading_heading2' },
            { model: 'heading3', view: 'h3', title: t('misc', 'heading3'), class: 'ck-heading_heading3' },
          ]
        },
        fontSize: { options: [10, 12, 14, 'default', 18, 20, 24, 28, 32, 36], supportAllValues: true },
        fontFamily: { options: ['default', 'Arial, Helvetica, sans-serif', 'Georgia, serif', 'Times New Roman, serif', 'Verdana, Geneva, sans-serif', 'Courier New, Courier, monospace'], supportAllValues: true },
        table: { contentToolbar: ['tableColumn', 'tableRow', 'mergeTableCells'] },
        language: 'vi',
      }).then(editor => {
        if (!mounted) { editor.destroy(); return; }
        editorRef.current = editor;
        editor.setData(value || '');
        editor.model.document.on('change:data', () => { if (!skipRef.current) onChange(editor.getData()); });
      }).catch(console.error);
    });
    return () => { mounted = false; editorRef.current?.destroy().catch(() => { }); editorRef.current = null; };
  }, []);
  useEffect(() => {
    if (!editorRef.current) return;
    if (editorRef.current.getData() !== value) { skipRef.current = true; editorRef.current.setData(value || ''); skipRef.current = false; }
  }, [value]);
  return (
    <div>
      <div ref={elRef} />
      <style>{`.ck-editor__editable{min-height:200px;font-size:14px;line-height:1.7;padding:12px 16px}.ck.ck-editor__top .ck-sticky-panel .ck-toolbar{border-radius:12px 12px 0 0!important;background:var(--c-canvas);border-color:var(--c-line);flex-wrap:wrap;padding:4px;gap:2px}.ck.ck-editor__main>.ck-editor__editable{border-radius:0 0 12px 12px!important;border-color:var(--c-line)}.ck.ck-editor__main>.ck-editor__editable:focus{border-color:var(--c-gold)!important;box-shadow:0 0 0 3px rgba(201,168,76,.15)!important}.ck.ck-button:hover:not(.ck-disabled),.ck.ck-button.ck-on{background:rgba(201,168,76,.12)!important;color:var(--c-gold)!important}.ck-dropdown .ck-dropdown__panel{z-index:9999!important}`}</style>
    </div>
  );
}

function PreviewPanel({ name, nameEn, description, descriptionEn, imagePath, activeLang, category }) {
  const title = activeLang === 'vi' ? name : (nameEn || name);
  const desc = activeLang === 'vi' ? description : (descriptionEn || description);
  const catLabel = category ? (activeLang === 'vi' ? (category.nameVi || category.name) : category.name) : null;
  return (
    <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-line)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,.06)' }}>
      <div style={{ background: 'linear-gradient(135deg,var(--c-ink),#2D2D30)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', gap: 6 }}>{['#FF5F57', '#FEBC2E', '#28C840'].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />)}</div>
        <span style={{ color: 'var(--c-muted)', fontSize: 11, marginLeft: 4 }}>Preview · {activeLang === 'vi' ? '🇻🇳 Tiếng Việt' : '🇬🇧 English'}</span>
      </div>
      {imagePath && <div style={{ aspectRatio: '16/7', overflow: 'hidden', background: 'var(--c-surface-2)' }}><img src={imagePath} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>}
      <div style={{ padding: '20px 24px' }}>
        {catLabel && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-gold)', textTransform: 'uppercase', letterSpacing: '.5px', display: 'block', marginBottom: 8 }}>{catLabel}</span>}
        {title ? <h3 style={{ fontSize: 20, fontWeight: 700, color: 'var(--c-ink)', marginBottom: 12, lineHeight: 1.3 }}>{title}</h3>
          : <div style={{ height: 24, background: 'var(--c-surface-2)', borderRadius: 6, width: '60%', marginBottom: 12 }} />}
        {desc ? <div dangerouslySetInnerHTML={{ __html: desc }} style={{ fontSize: 14, color: 'var(--c-ink-2)', lineHeight: 1.75 }} />
          : [100, 85, 92, 70].map((w, i) => <div key={i} style={{ height: 14, background: 'var(--c-surface-2)', borderRadius: 4, width: `${w}%`, marginBottom: 8 }} />)}
      </div>
      <style>{`.ck-content h1,.preview-html h1{font-size:22px;font-weight:700;margin:16px 0 8px}.preview-html h2{font-size:18px;font-weight:700;margin:14px 0 8px}.preview-html h3{font-size:16px;font-weight:600;margin:12px 0 6px}.preview-html p{margin:0 0 8px}.preview-html ul,.preview-html ol{padding-left:20px;margin:8px 0}.preview-html li{margin-bottom:4px}.preview-html blockquote{border-left:3px solid var(--c-gold);padding:8px 16px;margin:12px 0;background:rgba(201,168,76,.06);border-radius:0 8px 8px 0;color:var(--c-ink-2)}.preview-html table{width:100%;border-collapse:collapse;margin:12px 0}.preview-html td,.preview-html th{border:1px solid var(--c-line);padding:6px 10px;font-size:13px}.preview-html th{background:var(--c-canvas);font-weight:600}.preview-html a{color:var(--c-gold);text-decoration:underline}.preview-html strong{font-weight:700}.preview-html em{font-style:italic}.preview-html hr{border:none;border-top:1px solid var(--c-line);margin:16px 0}`}</style>
    </div>
  );
}

function ProductForm({ initial, categories: categoriesProp, onSave, onCancel, saving }) {
  const [name, setName] = useState(initial?.name || '');
  const [nameEn, setNameEn] = useState(initial?.nameEn || '');
  const [desc, setDesc] = useState(initial?.description || '');
  const [descEn, setDescEn] = useState(initial?.descriptionEn || '');
  const [catId, setCatId] = useState(initial?.categoryId || initial?.category?.id || '');
  const [imgFile, setImgFile] = useState(null);
  const [imgPrev, setImgPrev] = useState(initial?.imagePath ? imgUrl(initial.imagePath) : null);
  const [lang, setLang] = useState('vi');
  const [preview, setShowPreview] = useState(false);
  const [categories, setLocalCats] = useState(categoriesProp || []);
  const fileRef = useRef(null);

  // Nếu prop rỗng (chưa load xong) thì tự fetch
  useEffect(() => {
    if (categories.length === 0) {
      api.get('/api/auth/landingpage/categories')
        .then(r => {
          const list = Array.isArray(r.data?.data) ? r.data.data : [];
          setLocalCats(list);
        })
        .catch(() => { });
    }
  }, []);

  // Sync khi prop có dữ liệu
  useEffect(() => {
    if (categoriesProp?.length > 0) setLocalCats(categoriesProp);
  }, [categoriesProp?.length]);

  const selectedCat = categories.find(c => c.id === Number(catId)) || null;
  const handleImg = e => { const f = e.target.files[0]; if (!f) return; setImgFile(f); setImgPrev(URL.createObjectURL(f)); e.target.value = ''; };

  const inputStyle = { width: '100%', border: '1px solid var(--c-line)', borderRadius: 10, padding: '10px 14px', fontSize: 14, outline: 'none', boxSizing: 'border-box' };
  const labelStyle = { fontSize: 11, fontWeight: 700, color: 'var(--c-muted)', textTransform: 'uppercase', letterSpacing: '.5px', display: 'block', marginBottom: 6 };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16, overflowY: 'auto' }}>
      <div style={{ background: 'var(--c-surface)', borderRadius: 20, width: '100%', maxWidth: preview ? 1100 : 700, boxShadow: '0 24px 80px rgba(0,0,0,.2)', display: 'flex', flexDirection: 'column', margin: 'auto', transition: 'max-width .3s ease' }}>

        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--c-surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--c-ink)', margin: 0 }}>{initial ? 'Cập nhật sản phẩm' : 'Thêm sản phẩm mới'}</h2>
            <p style={{ fontSize: 12, color: 'var(--c-muted)', margin: '2px 0 0' }}>Song ngữ 🇻🇳 Tiếng Việt / 🇬🇧 English</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setShowPreview(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 10, border: '1px solid var(--c-line)', background: preview ? 'var(--c-canvas)' : 'var(--c-surface)', color: preview ? 'var(--c-gold)' : 'var(--c-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              {preview ? <EyeOff size={14} /> : <Eye size={14} />} Preview
            </button>
            <button onClick={onCancel} style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'var(--c-surface-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={16} color="var(--c-ink-2)" />
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', minWidth: 0 }}>

            {/* Ảnh + Danh mục row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
              {/* Ảnh */}
              <div>
                <label style={labelStyle}>Hình ảnh</label>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  {imgPrev && (
                    <div style={{ position: 'relative', width: 80, height: 80, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--c-line)', flexShrink: 0 }}>
                      <img src={imgPrev} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button onClick={() => { setImgFile(null); setImgPrev(null); }} style={{ position: 'absolute', top: 3, right: 3, width: 18, height: 18, borderRadius: '50%', background: 'rgba(220,38,38,.9)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <X size={9} color="var(--c-surface)" />
                      </button>
                    </div>
                  )}
                  <button onClick={() => fileRef.current?.click()} style={{ width: 80, height: 80, borderRadius: 10, border: '2px dashed var(--c-line)', background: 'var(--c-canvas)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, color: 'var(--c-muted)' }}>
                    <Upload size={16} /><span style={{ fontSize: 10, fontWeight: 600 }}>{imgPrev ? 'Đổi' : 'Tải ảnh'}</span>
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImg} />
                </div>
              </div>

              {/* Danh mục */}
              <div>
                <label style={labelStyle}><Tag size={11} style={{ display: 'inline', marginRight: 4 }} />Danh mục <span style={{ color: 'var(--c-danger)' }}>*</span></label>
                <select value={catId} onChange={e => setCatId(e.target.value)} style={{ ...inputStyle, background: 'var(--c-surface)', cursor: 'pointer', color: catId ? 'var(--c-ink)' : 'var(--c-muted)' }}
                  onFocus={e => e.target.style.borderColor = 'var(--c-gold)'}
                  onBlur={e => e.target.style.borderColor = 'var(--c-line)'}>
                  {categories.length === 0
                    ? <option value="" disabled>Đang tải danh mục...</option>
                    : <option value="">-- Chọn danh mục --</option>
                  }
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}{c.nameVi ? ` · ${c.nameVi}` : ''}</option>
                  ))}
                </select>
                {categories.length > 0 && !catId && <p style={{ fontSize: 11, color: 'var(--c-danger)', margin: '4px 0 0' }}>Vui lòng chọn danh mục</p>}
              </div>
            </div>

            {/* Lang tabs */}
            <div style={{ display: 'flex', background: 'var(--c-surface-2)', borderRadius: 10, padding: 4, marginBottom: 16, width: 'fit-content' }}>
              {[['vi', '🇻🇳 Tiếng Việt'], ['en', '🇬🇧 English']].map(([l, lbl]) => (
                <button key={l} onClick={() => setLang(l)} style={{ padding: '6px 16px', borderRadius: 7, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all .15s', background: lang === l ? 'var(--c-surface)' : 'transparent', color: lang === l ? 'var(--c-ink)' : 'var(--c-muted)', boxShadow: lang === l ? '0 1px 4px rgba(0,0,0,.08)' : 'none' }}>{lbl}</button>
              ))}
            </div>

            {/* Tên */}
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>
                {lang === 'vi' ? 'Tên sản phẩm' : 'Product Name (EN)'}
                {lang === 'vi' && <span style={{ color: 'var(--c-danger)' }}> *</span>}
                {lang === 'en' && <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--c-faint)', fontWeight: 400, textTransform: 'none' }}>(Tùy chọn)</span>}
              </label>
              <input value={lang === 'vi' ? name : nameEn} onChange={e => lang === 'vi' ? setName(e.target.value) : setNameEn(e.target.value)}
                placeholder={BRAND.examples.sausage[lang] || BRAND.examples.sausage.vi}
                style={{ ...inputStyle, fontWeight: 500 }}
                onFocus={e => e.target.style.borderColor = 'var(--c-gold)'}
                onBlur={e => e.target.style.borderColor = 'var(--c-line)'}
              />
            </div>

            {/* Mô tả */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={labelStyle}>{lang === 'vi' ? 'Mô tả sản phẩm' : 'Description (EN)'}</label>
                {lang === 'en' && <span style={{ fontSize: 10, color: 'var(--c-faint)', marginTop: -2 }}>Dùng cùng cấu trúc với bản VI</span>}
              </div>
              <div style={{ display: lang === 'vi' ? 'block' : 'none' }}>
                <RichEditor value={desc} onChange={setDesc} placeholder="Nhập mô tả bằng tiếng Việt..." />
              </div>
              <div style={{ display: lang === 'en' ? 'block' : 'none' }}>
                <RichEditor value={descEn} onChange={setDescEn} placeholder="Enter description in English..." />
              </div>
              {lang === 'en' && <p style={{ fontSize: 11, color: 'var(--c-faint)', marginTop: 6 }}>💡 Dùng cùng heading, bullet, format với bản Tiếng Việt.</p>}
            </div>
          </div>

          {/* Preview */}
          {preview && (
            <div style={{ width: 370, flexShrink: 0, borderLeft: '1px solid var(--c-surface-2)', overflowY: 'auto', padding: 20, background: 'var(--c-canvas)' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 12 }}>Preview</p>
              <PreviewPanel name={name} nameEn={nameEn} description={desc} descriptionEn={descEn} imagePath={imgPrev} activeLang={lang} category={selectedCat} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--c-surface-2)', display: 'flex', gap: 12 }}>
          <button onClick={onCancel} disabled={saving} style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: '1px solid var(--c-line)', background: 'var(--c-surface)', fontSize: 13, fontWeight: 600, color: 'var(--c-muted)', cursor: 'pointer' }}>Hủy</button>
          <button
            onClick={() => {
              if (!name.trim() || !catId) return;
              onSave({ name: name.trim(), nameEn: nameEn.trim(), description: desc, descriptionEn: descEn, categoryId: Number(catId), imageFile: imgFile });
            }}
            disabled={saving || !name.trim() || !catId}
            style={{ flex: 2, padding: '11px 0', borderRadius: 10, border: 'none', background: (!name.trim() || !catId) ? 'var(--c-line)' : 'linear-gradient(135deg,var(--c-gold),var(--c-gold-deep))', fontSize: 13, fontWeight: 700, color: (!name.trim() || !catId) ? 'var(--c-muted)' : 'var(--c-surface)', cursor: (!name.trim() || !catId) ? 'not-allowed' : 'pointer', boxShadow: (name.trim() && catId && !saving) ? '0 4px 12px rgba(201,168,76,.35)' : 'none' }}>
            {saving ? 'Đang lưu...' : (initial ? '✓ Cập nhật' : '+ Tạo sản phẩm')}
          </button>
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ── EventManager: quản lý ảnh bento gallery ─────────────────────────────────
// ── EventManager: quản lý ảnh bento gallery ─────────────────────────────────
// Thay thế toàn bộ function EventManager trong OperatorLandingpagePage.jsx
function EventManager() {
  const toast = useToast();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useMinLoading();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [form, setForm] = useState(null); // null=closed, {}=create, obj=edit
  const [label, setLabel] = useState('');

  // Multi-image state (chỉ dùng khi tạo mới)
  const [imgFiles, setImgFiles] = useState([]); // File[]
  const [imgPrevs, setImgPrevs] = useState([]); // string[] (object URLs)

  // Single image state (chỉ dùng khi edit)
  const [editImgFile, setEditImgFile] = useState(null);
  const [editImgPrev, setEditImgPrev] = useState(null);

  const fileRef = useRef(null);
  const editFileRef = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/operator/landingpage/events');
      setEvents(r.data?.data || []);
    } catch { toast('Không thể tải events', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setForm({});
    setLabel('');
    setImgFiles([]);
    setImgPrevs([]);
  };

  const openEdit = (e) => {
    setForm(e);
    setLabel(e.eventLabel || '');
    setEditImgFile(null);
    setEditImgPrev(imgUrl(e.eventImgPath));
  };

  const closeForm = () => {
    setForm(null);
    // Revoke object URLs để giải phóng bộ nhớ
    imgPrevs.forEach(url => URL.revokeObjectURL(url));
    setImgFiles([]);
    setImgPrevs([]);
  };

  // Chọn nhiều ảnh (chỉ khi tạo mới)
  const handleMultiImg = e => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    const newPrevs = files.map(f => URL.createObjectURL(f));
    setImgFiles(prev => [...prev, ...files]);
    setImgPrevs(prev => [...prev, ...newPrevs]);
    e.target.value = '';
  };

  const removeImg = (idx) => {
    URL.revokeObjectURL(imgPrevs[idx]);
    setImgFiles(prev => prev.filter((_, i) => i !== idx));
    setImgPrevs(prev => prev.filter((_, i) => i !== idx));
  };

  // Ảnh edit (1 ảnh)
  const handleEditImg = e => {
    const f = e.target.files[0]; if (!f) return;
    setEditImgFile(f);
    setEditImgPrev(URL.createObjectURL(f));
    e.target.value = '';
  };

  // Lưu: tạo mới = nhiều event (1 ảnh/event), edit = cập nhật 1 event
  const handleSave = async () => {
    const h = { 'Content-Type': 'multipart/form-data' };

    if (form?.id) {
      // ── EDIT: cập nhật 1 event ──────────────────────────────────────────
      setSaving(true);
      try {
        const fd = new FormData();
        if (label) fd.append('eventLabel', label);
        if (editImgFile) fd.append('image', editImgFile);
        await api.put(`/api/operator/landingpage/events/${form.id}`, fd, { headers: h });
        toast('Cập nhật thành công', 'success');
        closeForm(); load();
      } catch (e) {
        toast(e?.response?.data?.message || 'Lỗi khi lưu', 'error');
      } finally { setSaving(false); }

    } else {
      // ── CREATE: tạo nhiều event song song, 1 ảnh mỗi event ─────────────
      if (!imgFiles.length) { toast('Vui lòng chọn ít nhất 1 ảnh', 'warning'); return; }
      setSaving(true);
      try {
        await Promise.all(imgFiles.map(file => {
          const fd = new FormData();
          if (label) fd.append('eventLabel', label);
          fd.append('image', file);
          return api.post('/api/operator/landingpage/events', fd, { headers: h });
        }));
        toast(`Đã thêm ${imgFiles.length} ảnh event`, 'success');
        closeForm(); load();
      } catch (e) {
        toast(e?.response?.data?.message || 'Lỗi khi lưu', 'error');
      } finally { setSaving(false); }
    }
  };

  const handleDelete = async id => {
    if (!confirm('Xóa ảnh event này?')) return;
    setDeleting(id);
    try { await api.delete(`/api/operator/landingpage/events/${id}`); toast('Đã xóa', 'success'); load(); }
    catch { toast('Lỗi khi xóa', 'error'); }
    finally { setDeleting(null); }
  };

  const isCreate = form !== null && !form?.id;

  return (
    <div style={{ padding: '0 0 32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <p style={{ fontSize: 13, color: 'var(--c-ink-2)', margin: 0 }}>
          {events.length} ảnh · API tự random 9 ảnh mỗi lần load trang
        </p>
        <button onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,var(--c-gold),var(--c-gold-deep))', color: 'var(--c-surface)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          <Plus size={14} /> Thêm ảnh
        </button>
      </div>

      {/* Grid */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
          <div style={{ width: 28, height: 28, border: '3px solid var(--c-surface-2)', borderTopColor: 'var(--c-gold)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        </div>
      ) : events.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--c-muted)' }}>
          <ImageIcon size={40} style={{ opacity: .2, marginBottom: 10 }} /><p style={{ margin: 0 }}>Chưa có ảnh nào</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12 }}>
          {events.map(e => (
            <div key={e.id} style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--c-line)', aspectRatio: '1', background: 'var(--c-surface-2)' }}>
              <img src={imgUrl(e.eventImgPath)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              {e.eventLabel && (
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,.6)', color: 'var(--c-surface)', fontSize: 11, fontWeight: 600, padding: '6px 8px', textAlign: 'center' }}>
                  {e.eventLabel}
                </div>
              )}
              <div style={{ position: 'absolute', top: 6, right: 6, display: 'flex', gap: 4 }}>
                <button onClick={() => openEdit(e)} style={{ width: 26, height: 26, borderRadius: 8, border: 'none', background: 'rgba(255,255,255,.9)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Pencil size={12} color="var(--c-ink-2)" />
                </button>
                <button onClick={() => handleDelete(e.id)} disabled={deleting === e.id} style={{ width: 26, height: 26, borderRadius: 8, border: 'none', background: 'rgba(255,255,255,.9)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: deleting === e.id ? .4 : 1 }}>
                  <Trash2 size={12} color="var(--c-danger)" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {form !== null && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--c-surface)', borderRadius: 16, width: '100%', maxWidth: isCreate ? 580 : 420, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>

            {/* Modal header */}
            <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--c-surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--c-ink)' }}>
                {isCreate ? 'Thêm ảnh event' : 'Cập nhật ảnh event'}
              </h3>
              <button onClick={closeForm} style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', background: 'var(--c-surface-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={14} color="var(--c-ink-2)" />
              </button>
            </div>

            <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* ── CREATE: multi-image picker ── */}
              {isCreate && (
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-muted)', textTransform: 'uppercase', letterSpacing: '.5px', display: 'block', marginBottom: 8 }}>
                    Ảnh <span style={{ color: 'var(--c-danger)' }}>*</span>
                    <span style={{ marginLeft: 8, fontSize: 10, color: 'var(--c-faint)', fontWeight: 400, textTransform: 'none' }}>Chọn nhiều ảnh — mỗi ảnh tạo 1 event</span>
                  </label>

                  {/* Grid preview ảnh đã chọn */}
                  {imgPrevs.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                      {imgPrevs.map((prev, idx) => (
                        <div key={idx} style={{ position: 'relative', width: 80, height: 80, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--c-line)', flexShrink: 0 }}>
                          <img src={prev} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <button onClick={() => removeImg(idx)} style={{ position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: '50%', background: 'rgba(220,38,38,.9)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <X size={9} color="var(--c-surface)" />
                          </button>
                        </div>
                      ))}

                      {/* Nút thêm ảnh nữa */}
                      <button onClick={() => fileRef.current?.click()} style={{ width: 80, height: 80, borderRadius: 10, border: '2px dashed var(--c-line)', background: 'var(--c-canvas)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, color: 'var(--c-muted)', flexShrink: 0 }}>
                        <Plus size={18} /><span style={{ fontSize: 10, fontWeight: 600 }}>Thêm</span>
                      </button>
                    </div>
                  )}

                  {/* Nút chọn ảnh lần đầu */}
                  {imgPrevs.length === 0 && (
                    <button onClick={() => fileRef.current?.click()} style={{ width: '100%', height: 100, borderRadius: 12, border: '2px dashed var(--c-line)', background: 'var(--c-canvas)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--c-muted)' }}>
                      <Upload size={22} />
                      <span style={{ fontSize: 12, fontWeight: 600 }}>Chọn ảnh (có thể chọn nhiều)</span>
                    </button>
                  )}

                  <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleMultiImg} />

                  {imgFiles.length > 0 && (
                    <p style={{ fontSize: 11, color: 'var(--c-gold)', fontWeight: 600, marginTop: 6 }}>
                      ✓ Đã chọn {imgFiles.length} ảnh → sẽ tạo {imgFiles.length} event mới
                    </p>
                  )}
                </div>
              )}

              {/* ── EDIT: single image picker ── */}
              {!isCreate && (
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-muted)', textTransform: 'uppercase', letterSpacing: '.5px', display: 'block', marginBottom: 8 }}>Ảnh</label>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    {editImgPrev && (
                      <div style={{ position: 'relative', width: 90, height: 90, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--c-line)', flexShrink: 0 }}>
                        <img src={editImgPrev} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    )}
                    <button onClick={() => editFileRef.current?.click()} style={{ width: 90, height: 90, borderRadius: 10, border: '2px dashed var(--c-line)', background: 'var(--c-canvas)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, color: 'var(--c-muted)' }}>
                      <Upload size={16} /><span style={{ fontSize: 10, fontWeight: 600 }}>{editImgPrev ? 'Đổi ảnh' : 'Tải ảnh'}</span>
                    </button>
                    <input ref={editFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleEditImg} />
                  </div>
                </div>
              )}

              {/* Label — dùng chung cho create và edit */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-muted)', textTransform: 'uppercase', letterSpacing: '.5px', display: 'block', marginBottom: 6 }}>
                  Label <span style={{ fontSize: 10, color: 'var(--c-faint)', fontWeight: 400, textTransform: 'none' }}>(tùy chọn{isCreate && imgFiles.length > 1 ? ' · áp dụng cho tất cả ảnh' : ''})</span>
                </label>
                <input value={label} onChange={e => setLabel(e.target.value)}
                  placeholder="Hiển thị khi hover..."
                  style={{ width: '100%', border: '1px solid var(--c-line)', borderRadius: 10, padding: '10px 14px', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                  onFocus={e => e.target.style.borderColor = 'var(--c-gold)'}
                  onBlur={e => e.target.style.borderColor = 'var(--c-line)'}
                />
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '14px 22px', borderTop: '1px solid var(--c-surface-2)', display: 'flex', gap: 10 }}>
              <button onClick={closeForm} style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: '1px solid var(--c-line)', background: 'var(--c-surface)', fontSize: 13, fontWeight: 600, color: 'var(--c-muted)', cursor: 'pointer' }}>Hủy</button>
              <button
                onClick={handleSave}
                disabled={saving || (isCreate && imgFiles.length === 0)}
                style={{ flex: 2, padding: '10px 0', borderRadius: 10, border: 'none', background: (isCreate && imgFiles.length === 0) ? 'var(--c-line)' : 'linear-gradient(135deg,var(--c-gold),var(--c-gold-deep))', fontSize: 13, fontWeight: 700, color: (isCreate && imgFiles.length === 0) ? 'var(--c-muted)' : 'var(--c-surface)', cursor: 'pointer' }}
              >
                {saving
                  ? 'Đang lưu...'
                  : isCreate
                    ? `Thêm ${imgFiles.length > 0 ? imgFiles.length + ' ảnh' : 'ảnh'}`
                    : t('common', 'update')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function OperatorLandingpagePage() {
  const { t } = useLang();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('products'); // 'products' | 'events'
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useMinLoading();
  const [page, setPage] = useState(0);
  const [totalPages, setTotal] = useState(0);
  const [totalItems, setTI] = useState(0);
  const [filterCat, setFilterCat] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const PAGE_SIZE = 10;

  useEffect(() => {
    api.get('/api/auth/landingpage/categories')
      .then(r => {
        // API trả về { code, data: [...], success }
        const data = r.data?.data;
        const list = Array.isArray(data) ? data : [];
        setCategories(list);
      })
      .catch(e => console.error('Failed to load categories', e));
  }, []);

  const load = useCallback(async (p = 0, cat = filterCat) => {
    setLoading(true);
    try {
      const params = { page: p, size: PAGE_SIZE };
      if (cat) params.categoryId = cat;
      const res = await api.get('/api/auth/landingpage/products', { params });
      const d = res.data?.data;
      setProducts(d?.content || []); setTotal(d?.totalPages || 0); setTI(d?.totalItems || 0); setPage(p);
    } catch { toast('Không thể tải dữ liệu', 'error'); }
    finally { setLoading(false); }
  }, [filterCat]);
  useEffect(() => { load(0); }, [load]);

  const handleSave = async ({ name, nameEn, description, descriptionEn, categoryId, imageFile }) => {
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('name', name);
      if (nameEn) fd.append('nameEn', nameEn);
      if (description) fd.append('description', description);
      if (descriptionEn) fd.append('descriptionEn', descriptionEn);
      if (categoryId) fd.append('categoryId', categoryId);
      if (imageFile) fd.append('image', imageFile);
      const h = { 'Content-Type': 'multipart/form-data' };
      if (editing) { await api.put(`/api/operator/landingpage/products/${editing.id}`, fd, { headers: h }); toast('Cập nhật thành công', 'success'); }
      else { await api.post('/api/operator/landingpage/products', fd, { headers: h }); toast('Tạo thành công', 'success'); }
      setFormOpen(false); setEditing(null); load(page);
    } catch (e) { toast(e?.response?.data?.message || 'Lỗi khi lưu', 'error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async id => {
    if (!confirm('Xác nhận xóa?')) return;
    setDeleting(id);
    try { await api.delete(`/api/operator/landingpage/products/${id}`); toast('Đã xóa', 'success'); load(products.length === 1 && page > 0 ? page - 1 : page); }
    catch { toast('Lỗi khi xóa', 'error'); }
    finally { setDeleting(null); }
  };

  return (
    <div style={{ padding: 24 }}>
      {/* Header — chỉ title, không có nút */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(201,168,76,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Globe size={22} color="var(--c-gold)" />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--c-ink)', margin: 0 }}>Quản lý Landing Page</h1>
            <p style={{ fontSize: 12, color: 'var(--c-muted)', margin: '2px 0 0' }}>{totalItems} sản phẩm · Song ngữ 🇻🇳 / 🇬🇧</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', background: 'var(--c-surface-2)', borderRadius: 12, padding: 4, marginBottom: 20, width: 'fit-content', gap: 2 }}>
        {[['products', <><Globe size={13} /> Sản phẩm</>], ['events', <><Calendar size={13} /> Ảnh Event</>]].map(([tab, lbl]) => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 18px', borderRadius: 9, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all .15s', background: activeTab === tab ? 'var(--c-surface)' : 'transparent', color: activeTab === tab ? 'var(--c-ink)' : 'var(--c-muted)', boxShadow: activeTab === tab ? '0 1px 4px rgba(0,0,0,.08)' : 'none' }}>
            {lbl}
          </button>
        ))}
      </div>

      {activeTab === 'events' && <EventManager />}

      {activeTab === 'products' && <>

        {/* Nút thêm sản phẩm — chỉ hiện ở tab này */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <button onClick={() => { setEditing(null); setFormOpen(true); }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,var(--c-gold),var(--c-gold-deep))', color: 'var(--c-surface)', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(201,168,76,.35)' }}>
            <Plus size={16} /> Thêm sản phẩm
          </button>
        </div>

        {/* Category filter */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {[{ id: '', name: t('common', 'all') }, ...categories].map(c => (
            <button key={c.id} onClick={() => { setFilterCat(c.id); load(0, c.id); }} style={{
              padding: '6px 16px', borderRadius: 99, border: '1px solid', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all .15s',
              borderColor: filterCat === c.id ? 'var(--c-gold)' : 'var(--c-line)',
              background: filterCat === c.id ? 'rgba(201,168,76,.1)' : 'var(--c-surface)',
              color: filterCat === c.id ? 'var(--c-gold)' : 'var(--c-ink-2)',
            }}>
              {c.id ? `${c.name}${c.nameVi ? ` · ${c.nameVi}` : ''}` : c.name}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
            <div style={{ width: 32, height: 32, border: '3px solid var(--c-surface-2)', borderTopColor: 'var(--c-gold)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          </div>
        ) : products.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--c-muted)' }}>
            <Globe size={48} style={{ opacity: .2, marginBottom: 12 }} /><p style={{ margin: 0 }}>Chưa có sản phẩm nào</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {products.map(p => (
              <div key={p.id} style={{ background: 'var(--c-surface)', border: '1px solid var(--c-line)', borderRadius: 16, padding: 16, display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <div style={{ width: 80, height: 80, borderRadius: 12, overflow: 'hidden', background: 'var(--c-surface-2)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {imgUrl(p.imagePath) ? <img src={imgUrl(p.imagePath)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 28 }}>🖼️</span>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-ink)' }}>{p.name}</span>
                    {p.nameEn && <span style={{ fontSize: 12, color: 'var(--c-muted)', fontStyle: 'italic' }}>/ {p.nameEn}</span>}
                    {p.category && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, background: 'rgba(201,168,76,.1)', color: 'var(--c-gold)', fontWeight: 600 }}>{p.category.name}</span>}
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, background: p.descriptionEn ? 'rgba(34,197,94,.1)' : 'rgba(200,200,200,.15)', color: p.descriptionEn ? 'var(--c-success)' : 'var(--c-muted)', fontWeight: 600 }}>
                      {p.descriptionEn ? '🇻🇳+🇬🇧' : '🇻🇳 only'}
                    </span>
                  </div>
                  {p.description && <div style={{ fontSize: 12, color: 'var(--c-muted)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }} dangerouslySetInnerHTML={{ __html: p.description }} />}
                  <p style={{ fontSize: 11, color: 'var(--c-faint)', margin: '6px 0 0' }}>{p.createdAt ? new Date(p.createdAt).toLocaleDateString('vi-VN') : ''}</p>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button onClick={() => { setEditing(p); setFormOpen(true); }} style={{ width: 34, height: 34, borderRadius: 10, border: '1px solid var(--c-line)', background: 'var(--c-surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Pencil size={14} color="var(--c-ink-2)" />
                  </button>
                  <button onClick={() => handleDelete(p.id)} disabled={deleting === p.id} style={{ width: 34, height: 34, borderRadius: 10, border: '1px solid var(--c-line)', background: 'var(--c-surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: deleting === p.id ? .4 : 1 }}>
                    <Trash2 size={14} color="var(--c-danger)" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 24 }}>
            <button onClick={() => load(page - 1)} disabled={page === 0} style={{ width: 36, height: 36, borderRadius: 10, border: '1px solid var(--c-line)', background: 'var(--c-surface)', cursor: page === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: page === 0 ? .3 : 1 }}>
              <ChevronLeft size={16} color="var(--c-ink-2)" />
            </button>
            <span style={{ fontSize: 13, color: 'var(--c-ink-2)', fontWeight: 600 }}>Trang {page + 1} / {totalPages}</span>
            <button onClick={() => load(page + 1)} disabled={page >= totalPages - 1} style={{ width: 36, height: 36, borderRadius: 10, border: '1px solid var(--c-line)', background: 'var(--c-surface)', cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: page >= totalPages - 1 ? .3 : 1 }}>
              <ChevronRight size={16} color="var(--c-ink-2)" />
            </button>
          </div>
        )}

      </>}

      {formOpen && <ProductForm initial={editing} categories={categories} saving={saving} onSave={handleSave} onCancel={() => { setFormOpen(false); setEditing(null); }} />}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}