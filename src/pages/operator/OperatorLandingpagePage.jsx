// src/pages/operator/OperatorLandingpagePage.jsx
import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../api/axios';
import { useToast } from '../../components/common/Toast';
import { Plus, Pencil, Trash2, X, Upload, Globe, ChevronLeft, ChevronRight, Eye, EyeOff, Tag } from 'lucide-react';

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
        toolbar: { items: ['heading','|','fontFamily','fontSize','fontColor','fontBackgroundColor','|','bold','italic','underline','strikethrough','|','bulletedList','numberedList','todoList','|','alignment','|','link','blockQuote','insertTable','|','horizontalLine','|','undo','redo'], shouldNotGroupWhenFull: false },
        heading: { options: [
          { model: 'paragraph', title: 'Đoạn văn', class: 'ck-heading_paragraph' },
          { model: 'heading1', view: 'h1', title: 'Tiêu đề 1', class: 'ck-heading_heading1' },
          { model: 'heading2', view: 'h2', title: 'Tiêu đề 2', class: 'ck-heading_heading2' },
          { model: 'heading3', view: 'h3', title: 'Tiêu đề 3', class: 'ck-heading_heading3' },
        ]},
        fontSize: { options: [10,12,14,'default',18,20,24,28,32,36], supportAllValues: true },
        fontFamily: { options: ['default','Arial, Helvetica, sans-serif','Georgia, serif','Times New Roman, serif','Verdana, Geneva, sans-serif','Courier New, Courier, monospace'], supportAllValues: true },
        table: { contentToolbar: ['tableColumn','tableRow','mergeTableCells'] },
        language: 'vi',
      }).then(editor => {
        if (!mounted) { editor.destroy(); return; }
        editorRef.current = editor;
        editor.setData(value || '');
        editor.model.document.on('change:data', () => { if (!skipRef.current) onChange(editor.getData()); });
      }).catch(console.error);
    });
    return () => { mounted = false; editorRef.current?.destroy().catch(() => {}); editorRef.current = null; };
  }, []);
  useEffect(() => {
    if (!editorRef.current) return;
    if (editorRef.current.getData() !== value) { skipRef.current = true; editorRef.current.setData(value || ''); skipRef.current = false; }
  }, [value]);
  return (
    <div>
      <div ref={elRef} />
      <style>{`.ck-editor__editable{min-height:200px;font-size:14px;line-height:1.7;padding:12px 16px}.ck.ck-editor__top .ck-sticky-panel .ck-toolbar{border-radius:12px 12px 0 0!important;background:#FAF7F2;border-color:#E8DDD0;flex-wrap:wrap;padding:4px;gap:2px}.ck.ck-editor__main>.ck-editor__editable{border-radius:0 0 12px 12px!important;border-color:#E8DDD0}.ck.ck-editor__main>.ck-editor__editable:focus{border-color:#C9A84C!important;box-shadow:0 0 0 3px rgba(201,168,76,.15)!important}.ck.ck-button:hover:not(.ck-disabled),.ck.ck-button.ck-on{background:rgba(201,168,76,.12)!important;color:#C9A84C!important}.ck-dropdown .ck-dropdown__panel{z-index:9999!important}`}</style>
    </div>
  );
}

function PreviewPanel({ name, nameEn, description, descriptionEn, imagePath, activeLang, category }) {
  const title = activeLang === 'vi' ? name : (nameEn || name);
  const desc  = activeLang === 'vi' ? description : (descriptionEn || description);
  const catLabel = category ? (activeLang === 'vi' ? (category.nameVi || category.name) : category.name) : null;
  return (
    <div style={{ background:'#fff', border:'1px solid #E8DDD0', borderRadius:16, overflow:'hidden', boxShadow:'0 4px 20px rgba(0,0,0,.06)' }}>
      <div style={{ background:'linear-gradient(135deg,#1C1C1E,#2D2D30)', padding:'10px 16px', display:'flex', alignItems:'center', gap:8 }}>
        <div style={{ display:'flex', gap:6 }}>{['#FF5F57','#FEBC2E','#28C840'].map(c=><div key={c} style={{width:10,height:10,borderRadius:'50%',background:c}}/>)}</div>
        <span style={{ color:'#8E8878', fontSize:11, marginLeft:4 }}>Preview · {activeLang==='vi'?'🇻🇳 Tiếng Việt':'🇬🇧 English'}</span>
      </div>
      {imagePath && <div style={{aspectRatio:'16/7',overflow:'hidden',background:'#F0EBE3'}}><img src={imagePath} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/></div>}
      <div style={{ padding:'20px 24px' }}>
        {catLabel && <span style={{ fontSize:11, fontWeight:700, color:'#C9A84C', textTransform:'uppercase', letterSpacing:'.5px', display:'block', marginBottom:8 }}>{catLabel}</span>}
        {title ? <h3 style={{fontSize:20,fontWeight:700,color:'#1C1C1E',marginBottom:12,lineHeight:1.3}}>{title}</h3>
          : <div style={{height:24,background:'#F0EBE3',borderRadius:6,width:'60%',marginBottom:12}}/>}
        {desc ? <div dangerouslySetInnerHTML={{__html:desc}} style={{fontSize:14,color:'#5C4E3D',lineHeight:1.75}}/>
          : [100,85,92,70].map((w,i)=><div key={i} style={{height:14,background:'#F0EBE3',borderRadius:4,width:`${w}%`,marginBottom:8}}/>)}
      </div>
      <style>{`.ck-content h1,.preview-html h1{font-size:22px;font-weight:700;margin:16px 0 8px}.preview-html h2{font-size:18px;font-weight:700;margin:14px 0 8px}.preview-html h3{font-size:16px;font-weight:600;margin:12px 0 6px}.preview-html p{margin:0 0 8px}.preview-html ul,.preview-html ol{padding-left:20px;margin:8px 0}.preview-html li{margin-bottom:4px}.preview-html blockquote{border-left:3px solid #C9A84C;padding:8px 16px;margin:12px 0;background:rgba(201,168,76,.06);border-radius:0 8px 8px 0;color:#5C4E3D}.preview-html table{width:100%;border-collapse:collapse;margin:12px 0}.preview-html td,.preview-html th{border:1px solid #E8DDD0;padding:6px 10px;font-size:13px}.preview-html th{background:#FAF7F2;font-weight:600}.preview-html a{color:#C9A84C;text-decoration:underline}.preview-html strong{font-weight:700}.preview-html em{font-style:italic}.preview-html hr{border:none;border-top:1px solid #E8DDD0;margin:16px 0}`}</style>
    </div>
  );
}

function ProductForm({ initial, categories: categoriesProp, onSave, onCancel, saving }) {
  const [name,setName]           = useState(initial?.name||'');
  const [nameEn,setNameEn]       = useState(initial?.nameEn||'');
  const [desc,setDesc]           = useState(initial?.description||'');
  const [descEn,setDescEn]       = useState(initial?.descriptionEn||'');
  const [catId,setCatId]         = useState(initial?.categoryId||initial?.category?.id||'');
  const [imgFile,setImgFile]     = useState(null);
  const [imgPrev,setImgPrev]     = useState(initial?.imagePath?imgUrl(initial.imagePath):null);
  const [lang,setLang]           = useState('vi');
  const [preview,setShowPreview] = useState(false);
  const [categories,setLocalCats] = useState(categoriesProp||[]);
  const fileRef = useRef(null);

  // Nếu prop rỗng (chưa load xong) thì tự fetch
  useEffect(() => {
    if (categories.length === 0) {
      api.get('/api/auth/landingpage/categories')
        .then(r => {
          const list = Array.isArray(r.data?.data) ? r.data.data : [];
          setLocalCats(list);
        })
        .catch(() => {});
    }
  }, []);

  // Sync khi prop có dữ liệu
  useEffect(() => {
    if (categoriesProp?.length > 0) setLocalCats(categoriesProp);
  }, [categoriesProp?.length]);

  const selectedCat = categories.find(c => c.id === Number(catId)) || null;
  const handleImg = e => { const f=e.target.files[0];if(!f)return;setImgFile(f);setImgPrev(URL.createObjectURL(f));e.target.value=''; };

  const inputStyle = { width:'100%', border:'1px solid #E8DDD0', borderRadius:10, padding:'10px 14px', fontSize:14, outline:'none', boxSizing:'border-box' };
  const labelStyle = { fontSize:11, fontWeight:700, color:'#8E8878', textTransform:'uppercase', letterSpacing:'.5px', display:'block', marginBottom:6 };

  return (
    <div style={{ position:'fixed', inset:0, zIndex:50, background:'rgba(0,0,0,.55)', backdropFilter:'blur(4px)', display:'flex', alignItems:'flex-start', justifyContent:'center', padding:16, overflowY:'auto' }}>
      <div style={{ background:'#fff', borderRadius:20, width:'100%', maxWidth:preview?1100:700, boxShadow:'0 24px 80px rgba(0,0,0,.2)', display:'flex', flexDirection:'column', margin:'auto', transition:'max-width .3s ease' }}>

        {/* Header */}
        <div style={{ padding:'20px 24px', borderBottom:'1px solid #F0EBE3', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <h2 style={{ fontSize:17, fontWeight:700, color:'#1C1C1E', margin:0 }}>{initial?'Cập nhật sản phẩm':'Thêm sản phẩm mới'}</h2>
            <p style={{ fontSize:12, color:'#8E8878', margin:'2px 0 0' }}>Song ngữ 🇻🇳 Tiếng Việt / 🇬🇧 English</p>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={()=>setShowPreview(v=>!v)} style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 14px', borderRadius:10, border:'1px solid #E8DDD0', background:preview?'#FAF7F2':'#fff', color:preview?'#C9A84C':'#8E8878', fontSize:12, fontWeight:600, cursor:'pointer' }}>
              {preview?<EyeOff size={14}/>:<Eye size={14}/>} Preview
            </button>
            <button onClick={onCancel} style={{ width:32, height:32, borderRadius:'50%', border:'none', background:'#F0EBE3', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <X size={16} color="#5C4E3D"/>
            </button>
          </div>
        </div>

        <div style={{ display:'flex', flex:1, overflow:'hidden' }}>
          <div style={{ flex:1, overflowY:'auto', padding:'20px 24px', minWidth:0 }}>

            {/* Ảnh + Danh mục row */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:20 }}>
              {/* Ảnh */}
              <div>
                <label style={labelStyle}>Hình ảnh</label>
                <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                  {imgPrev && (
                    <div style={{ position:'relative', width:80, height:80, borderRadius:10, overflow:'hidden', border:'1px solid #E8DDD0', flexShrink:0 }}>
                      <img src={imgPrev} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                      <button onClick={()=>{setImgFile(null);setImgPrev(null);}} style={{ position:'absolute', top:3, right:3, width:18, height:18, borderRadius:'50%', background:'rgba(220,38,38,.9)', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                        <X size={9} color="#fff"/>
                      </button>
                    </div>
                  )}
                  <button onClick={()=>fileRef.current?.click()} style={{ width:80, height:80, borderRadius:10, border:'2px dashed #E8DDD0', background:'#FAF7F2', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:5, color:'#8E8878' }}>
                    <Upload size={16}/><span style={{fontSize:10,fontWeight:600}}>{imgPrev?'Đổi':'Tải ảnh'}</span>
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}} onChange={handleImg}/>
                </div>
              </div>

              {/* Danh mục */}
              <div>
                <label style={labelStyle}><Tag size={11} style={{display:'inline',marginRight:4}}/>Danh mục <span style={{color:'#ef4444'}}>*</span></label>
                <select value={catId} onChange={e=>setCatId(e.target.value)} style={{ ...inputStyle, background:'#fff', cursor:'pointer', color: catId?'#1C1C1E':'#8E8878' }}
                  onFocus={e=>e.target.style.borderColor='#C9A84C'}
                  onBlur={e=>e.target.style.borderColor='#E8DDD0'}>
                  {categories.length === 0
                    ? <option value="" disabled>Đang tải danh mục...</option>
                    : <option value="">-- Chọn danh mục --</option>
                  }
                  {categories.map(c=>(
                    <option key={c.id} value={c.id}>{c.name}{c.nameVi ? ` · ${c.nameVi}` : ''}</option>
                  ))}
                </select>
                {categories.length > 0 && !catId && <p style={{fontSize:11,color:'#ef4444',margin:'4px 0 0'}}>Vui lòng chọn danh mục</p>}
              </div>
            </div>

            {/* Lang tabs */}
            <div style={{ display:'flex', background:'#F0EBE3', borderRadius:10, padding:4, marginBottom:16, width:'fit-content' }}>
              {[['vi','🇻🇳 Tiếng Việt'],['en','🇬🇧 English']].map(([l,lbl])=>(
                <button key={l} onClick={()=>setLang(l)} style={{ padding:'6px 16px', borderRadius:7, border:'none', fontSize:12, fontWeight:600, cursor:'pointer', transition:'all .15s', background:lang===l?'#fff':'transparent', color:lang===l?'#1C1C1E':'#8E8878', boxShadow:lang===l?'0 1px 4px rgba(0,0,0,.08)':'none' }}>{lbl}</button>
              ))}
            </div>

            {/* Tên */}
            <div style={{ marginBottom:16 }}>
              <label style={labelStyle}>
                {lang==='vi'?'Tên sản phẩm':'Product Name (EN)'}
                {lang==='vi'&&<span style={{color:'#ef4444'}}> *</span>}
                {lang==='en'&&<span style={{marginLeft:6,fontSize:10,color:'#C4B9A8',fontWeight:400,textTransform:'none'}}>(Tùy chọn)</span>}
              </label>
              <input value={lang==='vi'?name:nameEn} onChange={e=>lang==='vi'?setName(e.target.value):setNameEn(e.target.value)}
                placeholder={lang==='vi'?'Ví dụ: Xúc xích truyền thống Nhất Nam':'e.g. Traditional Sausage'}
                style={{ ...inputStyle, fontWeight:500 }}
                onFocus={e=>e.target.style.borderColor='#C9A84C'}
                onBlur={e=>e.target.style.borderColor='#E8DDD0'}
              />
            </div>

            {/* Mô tả */}
            <div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
                <label style={labelStyle}>{lang==='vi'?'Mô tả sản phẩm':'Description (EN)'}</label>
                {lang==='en'&&<span style={{fontSize:10,color:'#C4B9A8',marginTop:-2}}>Dùng cùng cấu trúc với bản VI</span>}
              </div>
              <div style={{display:lang==='vi'?'block':'none'}}>
                <RichEditor value={desc} onChange={setDesc} placeholder="Nhập mô tả bằng tiếng Việt..."/>
              </div>
              <div style={{display:lang==='en'?'block':'none'}}>
                <RichEditor value={descEn} onChange={setDescEn} placeholder="Enter description in English..."/>
              </div>
              {lang==='en'&&<p style={{fontSize:11,color:'#C4B9A8',marginTop:6}}>💡 Dùng cùng heading, bullet, format với bản Tiếng Việt.</p>}
            </div>
          </div>

          {/* Preview */}
          {preview && (
            <div style={{ width:370, flexShrink:0, borderLeft:'1px solid #F0EBE3', overflowY:'auto', padding:20, background:'#FAF7F2' }}>
              <p style={{ fontSize:11, fontWeight:700, color:'#8E8878', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:12 }}>Preview</p>
              <PreviewPanel name={name} nameEn={nameEn} description={desc} descriptionEn={descEn} imagePath={imgPrev} activeLang={lang} category={selectedCat}/>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding:'16px 24px', borderTop:'1px solid #F0EBE3', display:'flex', gap:12 }}>
          <button onClick={onCancel} disabled={saving} style={{ flex:1, padding:'11px 0', borderRadius:10, border:'1px solid #E8DDD0', background:'#fff', fontSize:13, fontWeight:600, color:'#8E8878', cursor:'pointer' }}>Hủy</button>
          <button
            onClick={()=>{
              if(!name.trim()||!catId) return;
              onSave({name:name.trim(),nameEn:nameEn.trim(),description:desc,descriptionEn:descEn,categoryId:Number(catId),imageFile:imgFile});
            }}
            disabled={saving||!name.trim()||!catId}
            style={{ flex:2, padding:'11px 0', borderRadius:10, border:'none', background:(!name.trim()||!catId)?'#E8DDD0':'linear-gradient(135deg,#C9A84C,#A07830)', fontSize:13, fontWeight:700, color:(!name.trim()||!catId)?'#8E8878':'#fff', cursor:(!name.trim()||!catId)?'not-allowed':'pointer', boxShadow:(name.trim()&&catId&&!saving)?'0 4px 12px rgba(201,168,76,.35)':'none' }}>
            {saving?'Đang lưu...':(initial?'✓ Cập nhật':'+ Tạo sản phẩm')}
          </button>
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

export default function OperatorLandingpagePage() {
  const toast = useToast();
  const [products,setProducts]   = useState([]);
  const [categories,setCategories] = useState([]);
  const [loading,setLoading]     = useState(false);
  const [page,setPage]           = useState(0);
  const [totalPages,setTotal]    = useState(0);
  const [totalItems,setTI]       = useState(0);
  const [filterCat,setFilterCat] = useState('');
  const [formOpen,setFormOpen]   = useState(false);
  const [editing,setEditing]     = useState(null);
  const [saving,setSaving]       = useState(false);
  const [deleting,setDeleting]   = useState(null);
  const PAGE_SIZE = 10;

  useEffect(()=>{
    api.get('/api/auth/landingpage/categories')
      .then(r => {
        // API trả về { code, data: [...], success }
        const data = r.data?.data;
        const list = Array.isArray(data) ? data : [];
        setCategories(list);
      })
      .catch(e => console.error('Failed to load categories', e));
  },[]);

  const load = useCallback(async (p=0,cat=filterCat) => {
    setLoading(true);
    try {
      const params = { page:p, size:PAGE_SIZE };
      if(cat) params.categoryId = cat;
      const res = await api.get('/api/auth/landingpage/products',{params});
      const d = res.data?.data;
      setProducts(d?.content||[]); setTotal(d?.totalPages||0); setTI(d?.totalItems||0); setPage(p);
    } catch { toast('Không thể tải dữ liệu','error'); }
    finally { setLoading(false); }
  },[filterCat]);
  useEffect(()=>{load(0);},[load]);

  const handleSave = async ({name,nameEn,description,descriptionEn,categoryId,imageFile}) => {
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('name',name);
      if(nameEn)        fd.append('nameEn',nameEn);
      if(description)   fd.append('description',description);
      if(descriptionEn) fd.append('descriptionEn',descriptionEn);
      if(categoryId)    fd.append('categoryId',categoryId);
      if(imageFile)     fd.append('image',imageFile);
      const h = {'Content-Type':'multipart/form-data'};
      if(editing){ await api.put(`/api/operator/landingpage/products/${editing.id}`,fd,{headers:h}); toast('Cập nhật thành công','success'); }
      else       { await api.post('/api/operator/landingpage/products',fd,{headers:h}); toast('Tạo thành công','success'); }
      setFormOpen(false); setEditing(null); load(page);
    } catch(e){ toast(e?.response?.data?.message||'Lỗi khi lưu','error'); }
    finally{ setSaving(false); }
  };

  const handleDelete = async id => {
    if(!confirm('Xác nhận xóa?')) return;
    setDeleting(id);
    try{ await api.delete(`/api/operator/landingpage/products/${id}`); toast('Đã xóa','success'); load(products.length===1&&page>0?page-1:page); }
    catch{ toast('Lỗi khi xóa','error'); }
    finally{ setDeleting(null); }
  };

  return (
    <div style={{padding:24,maxWidth:900,margin:'0 auto'}}>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24}}>
        <div style={{display:'flex',alignItems:'center',gap:14}}>
          <div style={{width:44,height:44,borderRadius:12,background:'rgba(201,168,76,.12)',display:'flex',alignItems:'center',justifyContent:'center'}}>
            <Globe size={22} color="#C9A84C"/>
          </div>
          <div>
            <h1 style={{fontSize:20,fontWeight:700,color:'#1C1C1E',margin:0}}>Sản phẩm Landing Page</h1>
            <p style={{fontSize:12,color:'#8E8878',margin:'2px 0 0'}}>{totalItems} sản phẩm · Song ngữ 🇻🇳 / 🇬🇧</p>
          </div>
        </div>
        <button onClick={()=>{setEditing(null);setFormOpen(true);}} style={{display:'flex',alignItems:'center',gap:8,padding:'10px 20px',borderRadius:12,border:'none',background:'linear-gradient(135deg,#C9A84C,#A07830)',color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer',boxShadow:'0 4px 12px rgba(201,168,76,.35)'}}>
          <Plus size={16}/> Thêm mới
        </button>
      </div>

      {/* Category filter */}
      <div style={{display:'flex',gap:8,marginBottom:20,flexWrap:'wrap'}}>
        {[{id:'',name:'Tất cả'},...categories].map(c=>(
          <button key={c.id} onClick={()=>{setFilterCat(c.id);load(0,c.id);}} style={{padding:'6px 16px',borderRadius:99,border:'1px solid',fontSize:12,fontWeight:600,cursor:'pointer',transition:'all .15s',
            borderColor: filterCat===c.id?'#C9A84C':'#E8DDD0',
            background: filterCat===c.id?'rgba(201,168,76,.1)':'#fff',
            color: filterCat===c.id?'#C9A84C':'#5C4E3D',
          }}>
            {c.id?`${c.name}${c.nameVi?` · ${c.nameVi}`:''}`:c.name}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div style={{display:'flex',justifyContent:'center',padding:'60px 0'}}>
          <div style={{width:32,height:32,border:'3px solid #F0EBE3',borderTopColor:'#C9A84C',borderRadius:'50%',animation:'spin 1s linear infinite'}}/>
        </div>
      ) : products.length===0 ? (
        <div style={{textAlign:'center',padding:'60px 0',color:'#8E8878'}}>
          <Globe size={48} style={{opacity:.2,marginBottom:12}}/><p style={{margin:0}}>Chưa có sản phẩm nào</p>
        </div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          {products.map(p=>(
            <div key={p.id} style={{background:'#fff',border:'1px solid #E8DDD0',borderRadius:16,padding:16,display:'flex',gap:16,alignItems:'flex-start'}}>
              <div style={{width:80,height:80,borderRadius:12,overflow:'hidden',background:'#F0EBE3',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
                {imgUrl(p.imagePath)?<img src={imgUrl(p.imagePath)} style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontSize:28}}>🖼️</span>}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4,flexWrap:'wrap'}}>
                  <span style={{fontSize:14,fontWeight:700,color:'#1C1C1E'}}>{p.name}</span>
                  {p.nameEn&&<span style={{fontSize:12,color:'#8E8878',fontStyle:'italic'}}>/ {p.nameEn}</span>}
                  {p.category&&<span style={{fontSize:10,padding:'2px 8px',borderRadius:99,background:'rgba(201,168,76,.1)',color:'#C9A84C',fontWeight:600}}>{p.category.name}</span>}
                  <span style={{fontSize:10,padding:'2px 8px',borderRadius:99,background:p.descriptionEn?'rgba(34,197,94,.1)':'rgba(200,200,200,.15)',color:p.descriptionEn?'#16a34a':'#8E8878',fontWeight:600}}>
                    {p.descriptionEn?'🇻🇳+🇬🇧':'🇻🇳 only'}
                  </span>
                </div>
                {p.description&&<div style={{fontSize:12,color:'#8E8878',overflow:'hidden',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical'}} dangerouslySetInnerHTML={{__html:p.description}}/>}
                <p style={{fontSize:11,color:'#C4B9A8',margin:'6px 0 0'}}>{p.createdAt?new Date(p.createdAt).toLocaleDateString('vi-VN'):''}</p>
              </div>
              <div style={{display:'flex',gap:8,flexShrink:0}}>
                <button onClick={()=>{setEditing(p);setFormOpen(true);}} style={{width:34,height:34,borderRadius:10,border:'1px solid #E8DDD0',background:'#fff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <Pencil size={14} color="#5C4E3D"/>
                </button>
                <button onClick={()=>handleDelete(p.id)} disabled={deleting===p.id} style={{width:34,height:34,borderRadius:10,border:'1px solid #E8DDD0',background:'#fff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',opacity:deleting===p.id?.4:1}}>
                  <Trash2 size={14} color="#dc2626"/>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages>1&&(
        <div style={{display:'flex',justifyContent:'center',alignItems:'center',gap:12,marginTop:24}}>
          <button onClick={()=>load(page-1)} disabled={page===0} style={{width:36,height:36,borderRadius:10,border:'1px solid #E8DDD0',background:'#fff',cursor:page===0?'not-allowed':'pointer',display:'flex',alignItems:'center',justifyContent:'center',opacity:page===0?.3:1}}>
            <ChevronLeft size={16} color="#5C4E3D"/>
          </button>
          <span style={{fontSize:13,color:'#5C4E3D',fontWeight:600}}>Trang {page+1} / {totalPages}</span>
          <button onClick={()=>load(page+1)} disabled={page>=totalPages-1} style={{width:36,height:36,borderRadius:10,border:'1px solid #E8DDD0',background:'#fff',cursor:page>=totalPages-1?'not-allowed':'pointer',display:'flex',alignItems:'center',justifyContent:'center',opacity:page>=totalPages-1?.3:1}}>
            <ChevronRight size={16} color="#5C4E3D"/>
          </button>
        </div>
      )}

      {formOpen&&<ProductForm initial={editing} categories={categories} saving={saving} onSave={handleSave} onCancel={()=>{setFormOpen(false);setEditing(null);}}/>}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}