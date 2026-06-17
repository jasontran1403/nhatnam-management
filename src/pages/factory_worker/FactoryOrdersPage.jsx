// src/pages/factory_worker/FactoryOrdersPage.jsx
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  ClipboardList, ChevronLeft, ChevronRight, ZoomIn, Factory,
  Lock, Camera, X, Plus, Loader2, CheckCircle2, AlertTriangle,
  Trash2, ChevronDown, ChevronUp, XCircle, PackageX,
} from 'lucide-react';
import useMinLoading from '../../hooks/useMinLoading';
import { CardSkeleton } from '../../components/ui/Skeleton';
import Modal from '../../components/ui/Modal';
import {
  PrimaryButton, SecondaryButton, Field, inputCls, EmptyState,
} from '../../components/ui';
import {
  factoryProdApi, productionUploadApi, progressColor, fmtDate, fmtNum,
} from '../../api/productionModuleApi';
import { factoryWorkerApi } from '../../api/productionApi';
import { factoryMaterialRequestApi } from '../../api/materialRequestApi';
import { useToast } from '../../components/common/Toast';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
const img = (p) => {
  if (!p) return '';
  if (p.startsWith('http')) return p;
  if (p.startsWith('/images/')) return BASE_URL + '/api/auth' + p;
  return BASE_URL + p;
};

const PRESET_STEPS = [
  'Chuẩn bị nguyên liệu','Rửa thịt','Phay thịt','Xay thịt',
  'Nhồi thịt','Luộc','Xông khói','Đóng gói',
];
const UNITS = ['Kg', 'Gr', 'Lít', 'Túi', 'Hộp', 'Bịch', 'Thùng', 'Chai', 'Lon', 'Can'];

// ── Lightbox ──────────────────────────────────────────────────────────────────
function ImageLightbox({ images, initialIdx = 0, onClose }) {
  const [idx, setIdx] = useState(initialIdx);
  if (!images?.length) return null;
  return (
    <div className="fixed inset-0 z-[90] bg-black/95 flex items-center justify-center" onClick={onClose}>
      <button className="absolute top-4 right-4 text-white/70 hover:text-white p-2" onClick={onClose}><X size={24}/></button>
      <button className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/10 rounded-xl p-3 disabled:opacity-20 text-white/70 hover:text-white"
        disabled={idx===0} onClick={e=>{e.stopPropagation();setIdx(i=>i-1)}}><ChevronLeft size={24}/></button>
      <img src={img(images[idx])} alt="" className="max-w-[85vw] max-h-[85vh] object-contain rounded-xl" onClick={e=>e.stopPropagation()}/>
      <button className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/10 rounded-xl p-3 disabled:opacity-20 text-white/70 hover:text-white"
        disabled={idx===images.length-1} onClick={e=>{e.stopPropagation();setIdx(i=>i+1)}}><ChevronRight size={24}/></button>
      <p className="absolute bottom-4 text-white/50 text-sm">{idx+1}/{images.length}</p>
    </div>
  );
}

// ── Multi-image Uploader ──────────────────────────────────────────────────────
function ImageUploader({ label, onUpload, uploaded=[], required=false }) {
  const ref = useRef();
  const [previews, setPreviews] = useState([]);
  const [uploading, setUploading] = useState(false);
  const handleFiles = async (files) => {
    if (!files?.length) return;
    const arr = Array.from(files);
    const lp = arr.map(f=>URL.createObjectURL(f));
    setPreviews(p=>[...p,...lp]);
    setUploading(true);
    try { await onUpload(arr); setPreviews(p=>p.filter(x=>!lp.includes(x))); }
    finally { setUploading(false); }
  };
  return (
    <div>
      {label && <p className="text-xs font-semibold text-[#8E8878] uppercase tracking-wider mb-2">{label}{required&&<span className="text-red-500 ml-1">*</span>}</p>}
      <div className="flex gap-2 flex-wrap">
        {uploaded.map((u,i)=><div key={`u-${i}`} className="w-16 h-16 rounded-xl overflow-hidden border border-black/10"><img src={img(u)} alt="" className="w-full h-full object-cover"/></div>)}
        {previews.map((p,i)=>(
          <div key={`p-${i}`} className="w-16 h-16 rounded-xl overflow-hidden border border-black/10 relative">
            <img src={p} alt="" className="w-full h-full object-cover"/>
            {uploading&&<div className="absolute inset-0 bg-black/40 flex items-center justify-center"><Loader2 size={10} className="text-white animate-spin"/></div>}
          </div>
        ))}
        <button type="button" onClick={()=>ref.current?.click()}
          className="w-16 h-16 rounded-xl border-2 border-dashed border-[#C9A84C]/40 flex flex-col items-center justify-center hover:border-[#C9A84C] hover:bg-[#C9A84C]/5 transition-colors">
          <Camera size={18} className="text-[#C9A84C]"/><span className="text-[10px] text-[#C9A84C] mt-0.5">Thêm</span>
        </button>
        <input ref={ref} type="file" multiple accept="image/*" capture="environment" className="hidden" onChange={e=>handleFiles(e.target.files)}/>
      </div>
    </div>
  );
}

// ── Gantt shimmer styles ─────────────────────────────────────────────────────
const GANTT_SHIMMER = `
@keyframes ganttFlow {
  0%   { background-position: -200% center; }
  100% { background-position: 200% center; }
}
.gantt-bar-active { background-size: 200% 100% !important; animation: ganttFlow 2s linear infinite; }
`;
function GanttStyles() { return <style>{GANTT_SHIMMER}</style>; }

// ── Drag-scroll ───────────────────────────────────────────────────────────────
function DragScroll({ children, initScrollPct = 0, className = '' }) {
  const ref = useRef();
  const dragging = useRef(false);
  const startX = useRef(0);
  const startScroll = useRef(0);
  useEffect(() => {
    if (!ref.current || !initScrollPct) return;
    ref.current.scrollLeft = ref.current.scrollWidth * initScrollPct - ref.current.clientWidth / 3;
  }, []);
  const onMouseDown = (e) => {
    if (e.button !== 0) return;
    dragging.current = true; startX.current = e.pageX - ref.current.offsetLeft;
    startScroll.current = ref.current.scrollLeft; ref.current.style.cursor = 'grabbing'; e.preventDefault();
  };
  const onMouseMove = (e) => { if (!dragging.current) return; ref.current.scrollLeft = startScroll.current - (e.pageX - ref.current.offsetLeft - startX.current); };
  const onMouseUp = () => { dragging.current = false; if (ref.current) ref.current.style.cursor = 'grab'; };
  const touchStart = useRef(0); const touchScroll = useRef(0);
  return (
    <div ref={ref} className={"overflow-x-auto select-none " + className} style={{ cursor: 'grab' }}
      onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
      onTouchStart={e=>{touchStart.current=e.touches[0].pageX;touchScroll.current=ref.current.scrollLeft;}}
      onTouchMove={e=>{ref.current.scrollLeft=touchScroll.current+(touchStart.current-e.touches[0].pageX);}}>
      {children}
    </div>
  );
}

// ── 12-Week Gantt ─────────────────────────────────────────────────────────────
function FactoryGantt({ orders, onOrderClick }) {
  const WEEKS_BACK = 13;
  const WEEKS_TOTAL = 39;
  const today = new Date(); today.setHours(0,0,0,0);
  const currentWeekMon = new Date(today);
  currentWeekMon.setDate(today.getDate()-((today.getDay()+6)%7));
  currentWeekMon.setHours(0,0,0,0);
  const weekStart = new Date(currentWeekMon);
  weekStart.setDate(currentWeekMon.getDate() - WEEKS_BACK * 7);
  const weeks = Array.from({length:WEEKS_TOTAL},(_,i)=>{const d=new Date(weekStart);d.setDate(weekStart.getDate()+i*7);return d;});
  const totalMs=WEEKS_TOTAL*7*86400000, startMs=weekStart.getTime(), endMs=startMs+totalMs;
  const todayPct=Math.max(0,Math.min(100,((today.getTime()-startMs)/totalMs)*100));
  const pctL=ms=>Math.max(0,Math.min(100,((ms-startMs)/totalMs)*100));
  const pctW=(s,e)=>Math.max(0.8,((Math.min(e,endMs)-Math.max(s,startMs))/totalMs)*100);
  const ROW_H = 32;
  if (!orders?.length) return <EmptyState icon={ClipboardList} title="Không có lệnh sản xuất nào"/>;
  return (
    <><GanttStyles/><div className="flex">
      <div className="flex-shrink-0 w-48 pr-3">
        <div style={{height:26}}/>
        {orders.map(wo=>(
          <div key={`lbl-${wo.id}`} style={{height:ROW_H, marginBottom:6}} className="flex items-center">
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-[#1C1C1E] truncate max-w-[172px]">{wo.workOrderCode}</p>
              <p className="text-[9px] text-[#8E8878] truncate max-w-[172px]">{wo.productName}</p>
            </div>
          </div>
        ))}
      </div>
      <DragScroll initScrollPct={WEEKS_BACK/WEEKS_TOTAL} className="flex-1 min-w-0">
        <div style={{minWidth: WEEKS_TOTAL*120}}>
          <div className="flex mb-1" style={{height:26}}>
            {weeks.map((w,i)=>{
              const isThis=w<=today&&today<new Date(w.getTime()+7*86400000);
              return <div key={i} className={`flex-1 text-center text-[10px] py-1 font-medium border-l border-black/5 ${isThis?'text-[#C9A84C] font-bold bg-[#C9A84C]/5':'text-[#8E8878]'}`}>{`${w.getDate()}/${w.getMonth()+1}`}</div>;
            })}
          </div>
          {orders.map(wo=>{
            const s=wo.scheduledStartDate||startMs, e=wo.plannedEndDate||(s+7*86400000);
            const pct=Number(wo.progressPct||0), cancelled=wo.status==='CANCELLED', completed=wo.status==='COMPLETED';
            const color=cancelled?{hex:'#9ca3af'}:completed?{hex:'#10b981'}:progressColor(pct);
            return (
              <div key={`bar-${wo.id}`} className="relative" style={{height:ROW_H, marginBottom:6}}>
                <div className="absolute top-0 bottom-0 w-px bg-[#C9A84C]/50 z-10" style={{left:`${todayPct}%`}}/>
                <button onClick={()=>onOrderClick(wo)}
                  className={`absolute top-2 bottom-2 rounded cursor-pointer hover:brightness-110 transition-all flex items-center px-1.5 overflow-hidden${wo.status==='IN_PROGRESS'?' gantt-bar-active':''}`}
                  style={{left:`${pctL(Number(s))}%`,width:`${pctW(Number(s),Number(e))}%`,
                    background: wo.status==='IN_PROGRESS'
                      ? `linear-gradient(90deg, ${color.hex}99 0%, ${color.hex}ff 40%, #ffffff55 50%, ${color.hex}ff 60%, ${color.hex}99 100%)`
                      : color.hex+'cc',
                    opacity:cancelled?0.5:1}}>
                  <span className="text-white text-[10px] font-bold">{completed?'✓':`${pct.toFixed(0)}%`}</span>
                </button>
              </div>
            );
          })}
        </div>
      </DragScroll>
    </div></>
  );
}

// ── Confirm Step Modal ────────────────────────────────────────────────────────
function ConfirmStepModal({ batch, step, onClose, onSaved }) {
  const toast = useToast();
  const [notes, setNotes] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const requiresPhoto = step.requiresQC===true || step.requiresQc===true;
  const submit = async () => {
    if (requiresPhoto && attachments.length===0) { setErr('Bước này yêu cầu chụp ảnh kết quả trước khi xác nhận'); return; }
    setSaving(true);
    try {
      await factoryProdApi.completeStep(batch.id, step.stepSequence, {attachments, notes});
      onSaved();
    } catch(e) {
      const msg = e?.response?.data?.message||e?.message||'Có lỗi xảy ra';
      if (msg.includes('đã được xác nhận bởi')) {
        toast(msg+'. Tải lại trang...','warning',4000);
        setTimeout(()=>window.location.reload(),2000);
      } else { setErr(msg); }
    } finally { setSaving(false); }
  };
  return (
    <Modal open title={`Xác nhận bước ${step.stepSequence}: ${step.stepName}`} onClose={onClose} size="sm"
      footer={<div className="flex justify-end gap-2"><SecondaryButton onClick={onClose}>Huỷ</SecondaryButton><PrimaryButton onClick={submit} loading={saving}>Xác nhận hoàn thành</PrimaryButton></div>}>
      <div className="space-y-4">
        {err&&<p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{err}</p>}
        {requiresPhoto?(
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-600 flex-shrink-0"/>
            <p className="text-xs text-amber-700">Bước có kiểm soát — bắt buộc chụp ảnh kết quả (cân ký)</p>
          </div>
        ):(
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-2">
            <CheckCircle2 size={16} className="text-blue-600 flex-shrink-0"/>
            <p className="text-xs text-blue-700">Bước không yêu cầu kiểm soát — có thể xác nhận không cần ảnh</p>
          </div>
        )}
        <ImageUploader label="Ảnh xác nhận" required={requiresPhoto} uploaded={attachments}
          onUpload={async(files)=>{
            const urls = await productionUploadApi.uploadBatchStepImages(batch.id, step.stepSequence, files);
            setAttachments(p=>[...p,...urls]); return urls;
          }}/>
        <Field label="Ghi chú"><textarea className={inputCls} rows={2} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Kết quả, ghi chú..."/></Field>
      </div>
    </Modal>
  );
}

// ── Complete Batch Inline ─────────────────────────────────────────────────────
function CompleteBatchInline({ batch, wo, onSaved }) {
  const toast = useToast();
  const [qty, setQty] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const planQty = Number(wo?.plan?.batchQtyPerRun || batch?.plannedQty || 0);
  const minQty = planQty > 0 ? planQty * 0.9 : 0;
  const maxQty = planQty > 0 ? planQty * 1.1 : Infinity;
  const validate = (v) => {
    const n = Number(v);
    if (!v || isNaN(n) || n <= 0) return 'Vui lòng nhập sản lượng thực tế';
    if (planQty > 0 && n < minQty) return `Sản lượng tối thiểu là ${minQty.toFixed(1)} ${wo.outputUnit} (−10% kế hoạch)`;
    if (planQty > 0 && n > maxQty) return `Sản lượng tối đa là ${maxQty.toFixed(1)} ${wo.outputUnit} (+10% kế hoạch)`;
    return '';
  };
  const submit = async () => {
    const e = validate(qty); if (e) { setErr(e); return; }
    setSaving(true);
    try {
      const res = await factoryProdApi.completeBatch(batch.id, {actualOutputQty: Number(qty)});
      toast(`Đã hoàn thành mẻ ${res?.batchCode||batch.batchCode} — ${qty} ${wo.outputUnit}`, 'success', 4000);
      onSaved();
    } catch(ex) {
      toast(ex?.response?.data?.message||'Có lỗi xảy ra','error');
    } finally { setSaving(false); }
  };
  return (
    <div className="px-4 py-3 bg-emerald-50 border-t border-emerald-200 space-y-2">
      <p className="text-xs font-semibold text-emerald-700">✓ Tất cả bước hoàn thành — nhập sản lượng thực tế</p>
      {planQty>0&&<p className="text-[10px] text-[#8E8878]">Kế hoạch: {planQty} {wo.outputUnit} · Cho phép: {minQty.toFixed(1)}–{maxQty.toFixed(1)} {wo.outputUnit}</p>}
      {err&&<p className="text-xs text-red-600">{err}</p>}
      <div className="flex gap-2">
        <input type="number" step="0.1" className={inputCls+' flex-1'} placeholder={`Sản lượng (${wo.outputUnit})`}
          value={qty} onChange={e=>{setQty(e.target.value);setErr('');}}/>
        <PrimaryButton loading={saving} disabled={!qty} onClick={submit}>Hoàn thành mẻ</PrimaryButton>
      </div>
    </div>
  );
}

// ── Cancel Batch Modal ────────────────────────────────────────────────────────
// Khi NV xưởng huỷ mẻ (lệnh bị huỷ / máy hỏng sản xuất dang dở):
//  - Bắt buộc nhập sản lượng thực tế đã thu được (có thể = 0)
//  - Bắt buộc nhập số lượng từng loại NVL đã thực tế sử dụng
//  - Phần NVL chưa dùng (đã trừ kho - đã dùng) sẽ tự động hoàn lại kho xưởng theo FIFO ngược
function CancelBatchModal({ batch, workOrder, onClose, onSaved }) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [resolution, setResolution] = useState('REDO');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [actualOutputQty, setActualOutputQty] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [materials, setMaterials] = useState([]); // [{materialName, unit, deductedQty(=remaining), usedQty}]
  const [loadingMats, setLoadingMats] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const RESOLUTIONS = [
    { value: 'REDO', label: 'Làm lại mẻ mới', desc: 'Mẻ này bỏ, sẽ bắt đầu mẻ mới ngay sau' },
    { value: 'REPLACE', label: 'Thay thế', desc: 'Thay nguyên liệu/máy rồi tiếp tục' },
    { value: 'ABORT', label: 'Dừng hẳn', desc: 'Không làm lại mẻ này nữa' },
  ];

  useEffect(() => {
    let alive = true;
    setLoadingMats(true);
    factoryProdApi.getMaterialUsage(workOrder.id)
      .then(list => {
        if (!alive) return;
        setMaterials((list || []).map(m => ({
          materialName: m.materialName,
          unit: m.unit,
          remainingQty: Number(m.remainingQty || 0), // số lượng đã trừ kho mà chưa được ghi nhận đã dùng
          usedQty: '',
        })));
      })
      .catch(() => setMaterials([]))
      .finally(() => alive && setLoadingMats(false));
    return () => { alive = false; };
  }, [workOrder.id]);

  const setUsed = (i, v) => setMaterials(p => p.map((m, j) => j === i ? { ...m, usedQty: v } : m));

  const validate = () => {
    if (!reason.trim()) return 'Vui lòng nhập lý do huỷ mẻ';
    if (actualOutputQty === '' || isNaN(Number(actualOutputQty)) || Number(actualOutputQty) < 0)
      return 'Vui lòng nhập sản lượng thực tế đã thu được (nhập 0 nếu chưa có sản phẩm)';
    for (const m of materials) {
      if (m.usedQty === '' || isNaN(Number(m.usedQty)) || Number(m.usedQty) < 0)
        return `Vui lòng nhập số lượng đã dùng cho "${m.materialName}" (nhập 0 nếu chưa dùng)`;
      if (Number(m.usedQty) > m.remainingQty)
        return `Số lượng đã dùng "${m.materialName}" (${m.usedQty} ${m.unit}) không thể vượt số đã lấy từ kho (${m.remainingQty} ${m.unit})`;
    }
    return '';
  };

  const submit = async () => {
    const e = validate();
    if (e) { setErr(e); return; }
    setSaving(true);
    try {
      const usedMaterialQtys = {};
      materials.forEach(m => { usedMaterialQtys[m.materialName] = Number(m.usedQty || 0); });

      const res = await factoryProdApi.cancelBatch(batch.id, {
        reason,
        resolution,
        resolutionNotes,
        attachments,
        actualOutputQty: Number(actualOutputQty),
        usedMaterialQtys,
      });

      const returnedTotal = (res?.cancellation?.materialUsage || [])
        .reduce((sum, x) => sum + Math.max(0, Number(x.deductedQty || 0) - Number(x.actualUsedQty || 0)), 0);
      toast(
        returnedTotal > 0
          ? `Đã huỷ mẻ ${batch.batchCode}. Đã hoàn lại kho phần nguyên liệu chưa dùng.`
          : `Đã huỷ mẻ ${batch.batchCode}.`,
        'success', 5000
      );
      onSaved();
    } catch (ex) {
      setErr(ex?.response?.data?.message || 'Có lỗi xảy ra');
    } finally { setSaving(false); }
  };

  return (
    <Modal open title={`Huỷ mẻ ${batch.batchCode}`} onClose={onClose} size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose}>Đóng</SecondaryButton>
          <PrimaryButton onClick={submit} loading={saving} className="!bg-red-600 hover:!bg-red-700">
            <XCircle size={14}/> Xác nhận huỷ mẻ
          </PrimaryButton>
        </div>
      }>
      <div className="space-y-5">
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
          <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5"/>
          <p className="text-xs text-red-700">
            Mẻ đang sản xuất sẽ chuyển sang trạng thái <b>Đã huỷ</b> và không thể khôi phục.
            Số lượng nguyên liệu chưa thực tế dùng sẽ được tự động hoàn lại kho xưởng.
          </p>
        </div>

        {err && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{err}</p>}

        <Field label="Lý do huỷ" required>
          <textarea className={inputCls} rows={2} value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="VD: Máy xay bị hỏng giữa mẻ, không thể tiếp tục..."/>
        </Field>

        <div>
          <label className="text-xs font-semibold text-[#8E8878] uppercase tracking-wider mb-2 block">
            Hướng xử lý tiếp theo
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {RESOLUTIONS.map(r => (
              <button key={r.value} type="button" onClick={() => setResolution(r.value)}
                className={`text-left rounded-xl border p-2.5 transition-colors ${resolution === r.value
                  ? 'border-[#C9A84C] bg-[#C9A84C]/10' : 'border-black/10 hover:border-[#C9A84C]/40'}`}>
                <p className="text-sm font-semibold text-[#1C1C1E]">{r.label}</p>
                <p className="text-[10px] text-[#8E8878] mt-0.5">{r.desc}</p>
              </button>
            ))}
          </div>
        </div>

        <Field label="Sản lượng thực tế đã thu được" required>
          <div className="flex items-center gap-2">
            <input type="number" min="0" step="0.01" className={inputCls + ' flex-1'}
              placeholder="Nhập 0 nếu chưa có sản phẩm nào"
              value={actualOutputQty} onChange={e => { setActualOutputQty(e.target.value); setErr(''); }}/>
            <span className="text-sm text-[#8E8878] flex-shrink-0">{batch.outputUnit}</span>
          </div>
          <p className="text-[10px] text-[#8E8878] mt-1">Sản lượng này sẽ được cộng vào tổng sản lượng của lệnh {workOrder.workOrderCode}.</p>
        </Field>

        <div>
          <label className="text-xs font-semibold text-[#8E8878] uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <PackageX size={13}/> Nguyên liệu đã thực tế sử dụng
          </label>
          {loadingMats ? (
            <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin text-[#C9A84C]"/></div>
          ) : materials.length === 0 ? (
            <p className="text-xs text-[#8E8878] italic bg-[#FAF7F2] rounded-xl px-3 py-3">
              Lệnh này chưa trừ kho nguyên liệu nào (có thể chưa bắt đầu sản xuất hoặc không dùng nguyên liệu từ kho xưởng).
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-[10px] text-[#8E8878] mb-1">
                Nhập đúng số lượng đã thực tế dùng cho mẻ này. Phần còn lại (đã lấy từ kho nhưng chưa dùng) sẽ được hoàn trả tự động.
              </p>
              {materials.map((m, i) => {
                const over = m.usedQty !== '' && Number(m.usedQty) > m.remainingQty;
                const willReturn = m.usedQty !== '' && !isNaN(Number(m.usedQty))
                  ? Math.max(0, m.remainingQty - Number(m.usedQty)) : null;
                return (
                  <div key={i} className={`rounded-xl border p-3 ${over ? 'border-red-300 bg-red-50' : 'border-black/5 bg-[#FAF7F2]'}`}>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#1C1C1E] truncate">{m.materialName}</p>
                        <p className="text-[10px] text-[#8E8878]">Đã lấy từ kho: {m.remainingQty.toLocaleString('vi-VN')} {m.unit}</p>
                      </div>
                      <input type="number" min="0" max={m.remainingQty} step="0.001" className={`${inputCls} flex-shrink-0`}
                        style={{ width: 90 }} placeholder="Đã dùng"
                        value={m.usedQty} onChange={e => { setUsed(i, e.target.value); setErr(''); }}/>
                      <span className="text-xs text-[#8E8878] font-medium flex-shrink-0 w-8">{m.unit}</span>
                    </div>
                    {willReturn !== null && (
                      <p className={`text-xs mt-1.5 ${over ? 'text-red-600 font-semibold' : 'text-emerald-600'}`}>
                        {over
                          ? `⚠ Vượt số lượng đã lấy từ kho!`
                          : willReturn > 0
                            ? `↩ Sẽ hoàn lại kho: ${willReturn.toLocaleString('vi-VN')} ${m.unit}`
                            : `✓ Đã dùng hết, không hoàn kho`}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <ImageUploader label="Ảnh minh chứng (máy hỏng, sự cố...)" uploaded={attachments}
          onUpload={async (files) => {
            const urls = await productionUploadApi.uploadBatchCancelImages(batch.id, files);
            setAttachments(p => [...p, ...urls]); return urls;
          }}/>

        <Field label="Ghi chú xử lý (tuỳ chọn)">
          <textarea className={inputCls} rows={2} value={resolutionNotes}
            onChange={e => setResolutionNotes(e.target.value)}
            placeholder="Ghi chú thêm về hướng xử lý..."/>
        </Field>
      </div>
    </Modal>
  );
}

// ── Batch Roadmap ─────────────────────────────────────────────────────────────
function BatchRoadmap({ batches, onConfirmStep, wo, planBatchQtyPerRun, onBatchCompleted, onCancelBatch }) {
  const [lightbox, setLightbox] = useState(null);
  const sorted = [...(batches||[])].sort((a,b)=>(b.batchNumber||0)-(a.batchNumber||0));
  const [expanded, setExpanded] = useState(new Set([sorted[0]?.id].filter(Boolean)));
  const toggle = (id) => setExpanded(prev=>{const s=new Set(prev);s.has(id)?s.delete(id):s.add(id);return s;});

  if (!batches?.length) return (
    <div className="text-center py-6 text-[#8E8878] text-sm">
      {wo.status==='IN_PROGRESS'?'Chưa có mẻ nào được bắt đầu':'Lệnh chưa vào sản xuất'}
    </div>
  );

  return (
    <>
      <div className="space-y-3">
        {sorted.map(batch=>{
          const batchPct=Number(batch.stepProgressPct||0);
          const batchColor=batch.status==='CANCELLED'?{hex:'#9ca3af'}:progressColor(batchPct);
          const isExpanded=expanded.has(batch.id);
          const isCompleted=batch.status==='COMPLETED';
          const isCancelled=batch.status==='CANCELLED';
          const woWithPlan = {...wo, plan:{...(wo.plan||{}), batchQtyPerRun: planBatchQtyPerRun}};

          return (
            <div key={batch.id} className={`border rounded-2xl overflow-hidden transition-all
              ${isCompleted?'border-emerald-200 bg-emerald-50/30':isCancelled?'border-red-200 bg-red-50/20 opacity-70':'border-black/5 bg-white'}`}>
              <button className="w-full px-4 py-3 flex items-center justify-between hover:bg-black/5 transition-colors"
                onClick={()=>toggle(batch.id)}>
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
                    ${isCompleted?'bg-emerald-500 text-white':isCancelled?'bg-red-100 text-red-500':'bg-[#C9A84C]/20 text-[#C9A84C]'}`}>
                    {batch.batchNumber}
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-[#1C1C1E]">{batch.batchCode}</p>
                    <p className="text-xs text-[#8E8878]">
                      {isCompleted?`✓ ${fmtNum(batch.actualOutputQty)} ${batch.outputUnit}`
                        :isCancelled?'🚫 Đã huỷ':`${batch.completedSteps}/${batch.totalSteps} bước`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 bg-black/5 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{width:`${Math.min(batchPct,100)}%`,backgroundColor:batchColor.hex}}/>
                  </div>
                  <span className="text-xs font-bold" style={{color:batchColor.hex}}>{batchPct.toFixed(0)}%</span>
                  {isExpanded?<ChevronUp size={14} className="text-[#8E8878]"/>:<ChevronDown size={14} className="text-[#8E8878]"/>}
                </div>
              </button>

              {isExpanded && batch.steps?.length>0 && (
                <div className="px-4 py-4 border-t border-black/5">
                  <div className="relative">
                    <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-black/10"/>
                    <div className="space-y-4">
                      {batch.steps.map((step,i)=>{
                        const done=step.status==='COMPLETED';
                        const prevDone=batch.steps.slice(0,i).every(s=>s.status==='COMPLETED');
                        const isCurrent=!done&&batch.status==='IN_PROGRESS'&&prevDone;
                        return (
                          <div key={step.id} className="flex gap-4 relative">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-10 border-2 transition-all
                              ${done?'bg-emerald-500 border-emerald-500 text-white'
                                :isCurrent?'bg-white border-[#C9A84C] text-[#C9A84C] ring-4 ring-[#C9A84C]/20 animate-pulse'
                                :'bg-white border-black/15 text-[#8E8878]'}`}>
                              {done?<CheckCircle2 size={16}/>:<span className="text-xs font-bold">{step.stepSequence}</span>}
                            </div>
                            <div className={`flex-1 pb-2 ${done?'':'opacity-80'}`}>
                              <div className="flex items-center justify-between gap-2">
                                <p className={`text-sm font-semibold ${done?'text-emerald-700':isCurrent?'text-[#C9A84C]':'text-[#8E8878]'}`}>
                                  {step.stepName}
                                  {(step.requiresQC||step.requiresQc)&&<span className="ml-2 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-normal">📷 KS</span>}
                                  {isCurrent&&<span className="ml-2 text-[10px] bg-[#C9A84C]/10 text-[#C9A84C] px-2 py-0.5 rounded-full font-normal">Đang thực hiện</span>}
                                </p>
                                {isCurrent&&<PrimaryButton onClick={()=>onConfirmStep(batch,step)} className="!px-3 !py-1 text-xs flex-shrink-0">Xác nhận</PrimaryButton>}
                              </div>
                              {done&&step.completedByName&&<p className="text-xs text-[#8E8878] mt-0.5">✓ {step.completedByName} · {fmtDate(step.completedAt)}</p>}
                              {step.attachments?.length>0&&(
                                <div className="flex gap-1.5 mt-2 flex-wrap">
                                  {step.attachments.map((url,idx)=>(
                                    <button key={idx} onClick={()=>setLightbox({images:step.attachments,idx})}
                                      className="w-14 h-14 rounded-lg overflow-hidden border border-black/10 hover:scale-110 transition-transform relative group">
                                      <img src={img(url)} alt="" className="w-full h-full object-cover"/>
                                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center">
                                        <ZoomIn size={14} className="text-white opacity-0 group-hover:opacity-100"/>
                                      </div>
                                    </button>
                                  ))}
                                  {step.notes&&<p className="w-full text-xs text-[#8E8878] italic mt-1">{step.notes}</p>}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {isExpanded && batch.status==='IN_PROGRESS' && (
                <div className="px-4 py-3 border-t border-black/5 flex items-center justify-between gap-2">
                  {batch.steps?.every(s=>s.status==='COMPLETED') ? (
                    <CompleteBatchInline batch={batch} wo={woWithPlan} onSaved={onBatchCompleted}/>
                  ) : (
                    <p className="text-xs text-[#8E8878]">Đang thực hiện — hoàn thành các bước để nhập sản lượng</p>
                  )}
                  <SecondaryButton onClick={()=>onCancelBatch(batch)} className="!text-red-600 !border-red-200 hover:!bg-red-50 flex-shrink-0">
                    <XCircle size={13}/> Huỷ mẻ
                  </SecondaryButton>
                </div>
              )}
              {batch.cancellation&&(
                <div className="px-4 py-3 bg-red-50 border-t border-red-200 text-xs text-red-600 space-y-1.5">
                  <p className="font-semibold">Lý do huỷ: {batch.cancellation.reason}</p>
                  <p>Huỷ bởi {batch.cancellation.cancelledByName} · {fmtDate(batch.cancellation.cancelledAt)}</p>
                  {batch.cancellation.actualOutputQty != null && (
                    <p>Sản lượng thu được trước khi huỷ: <b>{fmtNum(batch.cancellation.actualOutputQty)} {batch.outputUnit}</b></p>
                  )}
                  {batch.cancellation.materialUsage?.length > 0 && (
                    <div className="mt-1.5 pt-1.5 border-t border-red-200">
                      <p className="font-semibold mb-1">Nguyên liệu đã trừ kho:</p>
                      {batch.cancellation.materialUsage.map((m,i) => {
                        const returned = Math.max(0, Number(m.deductedQty||0) - Number(m.actualUsedQty||0));
                        return (
                          <p key={i} className="text-[11px]">
                            {m.materialName}: đã lấy {fmtNum(m.deductedQty)} {m.unit} — đã dùng {fmtNum(m.actualUsedQty)} {m.unit}
                            {returned > 0 && <span className="text-emerald-600"> · hoàn kho {fmtNum(returned)} {m.unit}</span>}
                          </p>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {lightbox&&<ImageLightbox images={lightbox.images} initialIdx={lightbox.idx} onClose={()=>setLightbox(null)}/>}
    </>
  );
}

// ── Submit Plan Modal ────────────────────────────────────────────────────────
// MaterialSearchInput — dropdown từ kho xưởng, lọc bỏ đã chọn
function MaterialSelectInput({ value, onChange, stockList, placeholder = 'Chọn nguyên liệu...' }) {
  const [q, setQ] = useState(value?.materialName || '');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => { setQ(value?.materialName || ''); }, [value]);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target) &&
      !document.getElementById('__mat_step_dd__')?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const [pos, setPos] = useState({top:0,left:0,width:0});
  const calcPos = () => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setPos({top: r.bottom + window.scrollY + 2, left: r.left + window.scrollX, width: r.width});
  };

  const filtered = q.trim() ? stockList.filter(s => s.materialName.toLowerCase().includes(q.toLowerCase())) : stockList;
  const select = (s) => { setQ(s.materialName); onChange(s); setOpen(false); };
  const handleFocus = () => { calcPos(); setOpen(true); };
  const handleInput = (text) => { setQ(text); onChange({materialName: text, unit: null, totalQty: null}); calcPos(); setOpen(true); };

  const dropdown = open ? createPortal(
    <div id="__mat_step_dd__" style={{position:'absolute',top:pos.top,left:pos.left,width:pos.width,zIndex:99999}}
      className="bg-white border border-[#E8DDD0] rounded-xl shadow-xl max-h-44 overflow-y-auto">
      {stockList.length === 0 ? (
        <div className="px-3 py-2 text-xs text-[#8E8878] italic">Kho trống — nhập tự do</div>
      ) : filtered.length === 0 ? (
        <div className="px-3 py-2 text-xs text-[#8E8878] italic">Không tìm thấy: <b>{q}</b></div>
      ) : filtered.map((s, i) => (
        <button key={i} className="w-full text-left px-3 py-2 hover:bg-[#FAF7F2] border-b border-black/5 last:border-0"
          onMouseDown={e => e.preventDefault()} onClick={() => select(s)}>
          <p className="text-sm text-[#1C1C1E] font-medium">{s.materialName}</p>
          <p className="text-xs text-[#8E8878]">Tồn: {Number(s.totalQty||0).toLocaleString('vi-VN')} {s.unit}</p>
        </button>
      ))}
    </div>, document.body
  ) : null;

  return (
    <div ref={ref} className="flex-1 min-w-0">
      <input className={inputCls} placeholder={placeholder} value={q}
        onChange={e => handleInput(e.target.value)} onFocus={handleFocus} />
      {dropdown}
    </div>
  );
}

// StepSearchInput — dropdown preset bước, gõ thêm mới
// StepSearchInput — dropdown preset bước, gõ thêm mới
function StepSearchInput({ stepTemplates, onAddStep }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const inputRef = useRef(null);

  const [pos, setPos] = useState({top:0,left:0,width:0});

  useEffect(() => {
    const h = (e) => { 
      if (ref.current && !ref.current.contains(e.target) &&
        !document.getElementById('__step_dd__')?.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const calcPos = () => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setPos({top: r.bottom + window.scrollY + 2, left: r.left + window.scrollX, width: r.width});
  };

  const filtered = q.trim() ? stepTemplates.filter(s => s.name.toLowerCase().includes(q.toLowerCase())) : stepTemplates;
  const exactMatch = stepTemplates.some(s => s.name.toLowerCase() === q.toLowerCase().trim());

  const select = (t) => { 
    onAddStep({name: t.name, requiresQC: t.requiresQc || false}); 
    setQ(''); 
    setOpen(false);
    // Blur input để đóng bàn phím trên mobile
    if (inputRef.current) inputRef.current.blur();
  };
  
  const createNew = () => { 
    if (q.trim()) { 
      onAddStep({name: q.trim(), requiresQC: false, isNew: true}); 
      setQ(''); 
      setOpen(false);
      if (inputRef.current) inputRef.current.blur();
    } 
  };

  const handleFocus = () => { 
    calcPos(); 
    setOpen(true); 
  };

  const handleInput = (text) => { 
    setQ(text); 
    calcPos(); 
    setOpen(true); 
  };

  // Đóng dropdown khi nhấn Escape
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setOpen(false);
      if (inputRef.current) inputRef.current.blur();
    }
  };

  const dropdown = open ? createPortal(
    <div id="__step_dd__" style={{position:'absolute',top:pos.top,left:pos.left,width:pos.width,zIndex:99999}}
      className="bg-white border border-[#E8DDD0] rounded-xl shadow-xl max-h-52 overflow-y-auto">
      {filtered.length > 0 && filtered.map((t, i) => (
        <button key={i} className="w-full text-left px-3 py-2 hover:bg-[#FAF7F2] border-b border-black/5 last:border-0 transition-colors"
          onMouseDown={e => e.preventDefault()} onClick={() => select(t)}>
          <p className="text-sm text-[#1C1C1E]">{t.name}</p>
          {t.requiresQc && <p className="text-xs text-amber-600">📷 Có kiểm soát mặc định</p>}
        </button>
      ))}
      {q.trim() && !exactMatch && (
        <button className="w-full text-left px-3 py-2.5 bg-[#1A2B1A]/5 hover:bg-[#1A2B1A]/10 text-[#1A2B1A] font-semibold flex items-center gap-1.5 text-sm transition-colors"
          onMouseDown={e => e.preventDefault()} onClick={createNew}>
          <Plus size={12}/> Thêm bước mới: <span className="font-bold">"{q.trim()}"</span>
        </button>
      )}
      {filtered.length === 0 && !q.trim() && (
        <div className="px-3 py-2 text-xs text-[#8E8878] italic">Gõ tên bước để tìm hoặc thêm mới</div>
      )}
    </div>, document.body
  ) : null;

  return (
    <div ref={ref} className="relative">
      <input 
        ref={inputRef}
        className={inputCls} 
        placeholder="Tìm hoặc thêm bước mới..." 
        value={q}
        onChange={e => handleInput(e.target.value)} 
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        autoComplete="off"
      />
      {dropdown}
    </div>
  );
}

function SubmitPlanModal({ workOrder, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({totalBatches:'',batchQtyPerRun:'',notes:''});
  const [perBatchQty, setPerBatchQty] = useState([]);
  const [usePerBatchQty, setUsePerBatchQty] = useState(false);
  const [machines, setMachines] = useState([]);
  const [stepTemplates, setStepTemplates] = useState([]);
  const [stockList, setStockList] = useState([]); // kho nguyên liệu xưởng
  const [steps, setSteps] = useState([]);
  // materials: [{materialName, unit, quantity, totalQty}]
  const [materials, setMaterials] = useState([{materialName:'',unit:'',quantity:'',totalQty:null}]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const canMaterials = workOrder.canInputMaterials !== false;

  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  useEffect(() => {
    // Load máy, preset steps, kho nguyên liệu song song — dùng api module
    Promise.all([
      factoryProdApi.listMachines().catch(() => []),
      factoryProdApi.listStepTemplates().catch(() => []),
      factoryMaterialRequestApi.getStock().catch(() => []),
    ]).then(([machs, templates, stock]) => {
      setMachines(machs || []);
      setStepTemplates(templates || []);
      setStockList(stock || []);
    });
  }, []);

  // Thêm bước — nếu isNew thì lưu lên DB
  const addStep = async (step) => {
    setSteps(p => [...p, {name: step.name, requiresQC: step.requiresQC || false, machineId: null}]);
    if (step.isNew) {
      try {
        const created = await factoryProdApi.createStepTemplate({ name: step.name, requiresQc: false });
        if (created) setStepTemplates(p => [...p.filter(t => t.name !== step.name), created]);
      } catch {}
    }
  };

  const removeStep = (i) => setSteps(p => p.filter((_,j) => j !== i));
  const toggleStepQC = (i) => setSteps(p => p.map((s,j) => j === i ? {...s, requiresQC: !s.requiresQC} : s));

  // Steps chưa được chọn (filter bỏ đã dùng)
  const availableTemplates = stepTemplates.filter(t => !steps.some(s => s.name.toLowerCase() === t.name.toLowerCase()));

  // Materials
  const setMat = (i, k, v) => setMaterials(p => p.map((m,j) => j === i ? {...m, [k]: v} : m));
  const removeMat = (i) => setMaterials(p => p.filter((_,j) => j !== i));

  const handleMaterialSelect = (i, s) => {
    setMaterials(p => p.map((m, j) => j === i ? {
      ...m,
      materialName: s.materialName,
      unit: s.unit || '',
      totalQty: s.totalQty != null ? Number(s.totalQty) : null,
    } : m));
  };

  // Stock chưa được chọn (filter bỏ đã dùng trong các dòng khác)
  const getAvailableStock = (currentIdx) => {
    const chosen = materials.filter((_,j) => j !== currentIdx).map(m => m.materialName).filter(Boolean);
    return stockList.filter(s => !chosen.includes(s.materialName));
  };

  const submit = async () => {
    if (!form.totalBatches || !form.batchQtyPerRun) { setErr('Vui lòng nhập số mẻ và sản lượng/mẻ'); return; }
    if (steps.length === 0) { setErr('Vui lòng thêm ít nhất 1 bước sản xuất'); return; }

    // Validate nguyên liệu: số lượng không vượt tồn kho
    for (const m of materials) {
      if (!m.materialName.trim() || !m.quantity) continue;
      if (m.totalQty != null && Number(m.quantity) > m.totalQty) {
        setErr(`Số lượng "${m.materialName}" (${m.quantity} ${m.unit}) vượt tồn kho (${m.totalQty} ${m.unit})`);
        return;
      }
    }

    setSaving(true);
    try {
      await factoryProdApi.submitPlan(workOrder.id, {
        totalBatches: Number(form.totalBatches),
        batchQtyPerRun: Number(form.batchQtyPerRun),
        batchSteps: steps.map(s => s.name),
        batchStepDetails: steps.map(s => ({name:s.name, requiresQC:s.requiresQC, machineId:s.machineId||null})),
        batchQtyPerRunList: usePerBatchQty && perBatchQty.every(q=>q) ? perBatchQty.map(Number) : null,
        notes: form.notes,
        materials: canMaterials
          ? materials.filter(m => m.materialName.trim()).map((m,i) => ({
              materialName: m.materialName,
              quantity: Number(m.quantity) || 0,
              unit: m.unit,
              sortOrder: i,
            }))
          : [],
      });
      toast('Đã nộp phương án sản xuất thành công!','success',4000);
      onSaved();
    } catch(e) {
      setErr(e?.response?.data?.message || 'Có lỗi xảy ra');
    } finally { setSaving(false); }
  };

  return (
    <Modal open title="Lập phương án sản xuất" onClose={onClose} size="xl"
      footer={
        <div className="flex justify-between items-center">
          <p className="text-xs text-[#8E8878]">Deadline: {fmtDate(workOrder.planDeadline)}</p>
          <div className="flex gap-2">
            <SecondaryButton onClick={onClose}>Huỷ</SecondaryButton>
            <PrimaryButton onClick={submit} loading={saving}>Nộp phương án</PrimaryButton>
          </div>
        </div>
      }>
      <div className="space-y-5">
        {err&&<p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{err}</p>}

        {/* Lệnh info */}
        <div className="bg-[#1A2B1A] rounded-xl p-4 text-white">
          <p className="text-[#7CB87C] text-xs uppercase tracking-wider">Lệnh</p>
          <p className="font-bold text-lg mt-0.5">{workOrder.workOrderCode}</p>
          <p className="text-white/70 text-sm">{workOrder.productName} — {fmtNum(workOrder.plannedQty)} {workOrder.outputUnit}</p>
        </div>

        {/* Số mẻ + sản lượng */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Số mẻ dự kiến" required>
            <input type="number" className={inputCls} placeholder="VD: 3" value={form.totalBatches}
              onChange={e=>{
                set('totalBatches',e.target.value);
                const n=Number(e.target.value)||0;
                setPerBatchQty(Array.from({length:n},(_,i)=>perBatchQty[i]||form.batchQtyPerRun||''));
              }}/>
          </Field>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-[#8E8878] uppercase tracking-wider">
                Sản lượng mỗi mẻ ({workOrder.outputUnit}) *
              </label>
              <button type="button" onClick={()=>setUsePerBatchQty(v=>!v)}
                className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${usePerBatchQty?'bg-[#C9A84C]/10 border-[#C9A84C] text-[#C9A84C]':'bg-white border-black/10 text-[#8E8878]'}`}>
                {usePerBatchQty ? '✓ Từng mẻ khác nhau' : 'Từng mẻ khác nhau'}
              </button>
            </div>
            {!usePerBatchQty ? (
              <input type="number" className={inputCls} placeholder="VD: 30" value={form.batchQtyPerRun}
                onChange={e=>set('batchQtyPerRun',e.target.value)}/>
            ) : (
              <div className="space-y-2">
                {perBatchQty.map((q,i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-[#8E8878] w-12 flex-shrink-0">Mẻ {i+1}:</span>
                    <input type="number" className={inputCls+' flex-1'} placeholder={`VD: ${form.batchQtyPerRun||30}`}
                      value={q} onChange={e=>setPerBatchQty(p=>p.map((v,j)=>j===i?e.target.value:v))}/>
                    <span className="text-xs text-[#8E8878]">{workOrder.outputUnit}</span>
                  </div>
                ))}
                {perBatchQty.length === 0 && <p className="text-xs text-[#8E8878] italic">Nhập số mẻ trước</p>}
              </div>
            )}
          </div>
        </div>

        {/* Các bước sản xuất — search dropdown + thêm mới */}
        <div>
          <label className="text-xs font-semibold text-[#8E8878] uppercase tracking-wider mb-2 block">
            Các bước sản xuất
          </label>
          {/* Danh sách bước đã thêm */}
          {steps.length > 0 && (
            <div className="space-y-1.5 mb-2">
              {steps.map((s,i) => (
                <div key={i} className="flex gap-2 items-center bg-[#FAF7F2] border border-black/5 rounded-xl px-3 py-2">
                  <div className="w-6 h-6 rounded-full bg-white border border-black/10 flex items-center justify-center text-xs font-bold text-[#8E8878] flex-shrink-0">{i+1}</div>
                  <span className="flex-1 text-sm text-[#1C1C1E]">{s.name}</span>
                  <button onClick={()=>toggleStepQC(i)}
                    className={`text-[10px] px-2 py-1 rounded-full border transition-colors flex-shrink-0
                      ${s.requiresQC?'bg-amber-100 border-amber-300 text-amber-700':'bg-white border-black/10 text-[#8E8878] hover:border-[#C9A84C]'}`}>
                    📷 {s.requiresQC?'Có KS':'Không KS'}
                  </button>
                  {machines.length > 0 && (
                    <select className="text-[10px] border border-black/10 rounded-lg px-1.5 py-1 bg-white text-[#8E8878] flex-shrink-0 max-w-[110px]"
                      value={s.machineId||''} onChange={e=>setSteps(p=>p.map((x,j)=>j===i?{...x,machineId:e.target.value?Number(e.target.value):null}:x))}>
                      <option value="">Không chọn máy</option>
                      {machines.map(m=><option key={m.id} value={m.id} disabled={m.status==='UNDER_MAINTENANCE'}>{m.name}{m.status==='UNDER_MAINTENANCE'?' (BT)':''}</option>)}
                    </select>
                  )}
                  <button onClick={()=>removeStep(i)} className="text-[#8E8878] hover:text-red-500 flex-shrink-0"><X size={13}/></button>
                </div>
              ))}
            </div>
          )}
          {/* Search dropdown thêm bước */}
          <StepSearchInput stepTemplates={availableTemplates} onAddStep={addStep} />
        </div>

        {/* Nguyên liệu — chọn từ kho, validate tồn kho */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-xs font-semibold text-[#8E8878] uppercase tracking-wider">Nguyên liệu</label>
            {canMaterials && (
              <button onClick={()=>setMaterials(p=>[...p,{materialName:'',unit:'',quantity:'',totalQty:null}])}
                className="text-xs text-[#C9A84C] font-semibold flex items-center gap-1">
                <Plus size={11}/>Thêm NVL
              </button>
            )}
          </div>
          {!canMaterials ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2">
              <Lock size={16} className="text-amber-600"/>
              <p className="text-xs text-amber-700">Chế độ hẹn giờ: Chỉ được nhập nguyên liệu trong vòng 3 ngày trước ({fmtDate(workOrder.scheduledStartDate)})</p>
            </div>
          ) : (
            <div className="space-y-2">
              {materials.map((m,i) => {
                const over = m.totalQty != null && m.quantity && Number(m.quantity) > m.totalQty;
                return (
                  <div key={i} className={`rounded-xl border p-2.5 ${over?'border-red-300 bg-red-50':'border-black/5 bg-[#FAF7F2]'}`}>
                    {/* 1 dòng: tên | số lượng | đơn vị | remove */}
                    <div className="flex gap-2 items-center">
                      <MaterialSelectInput
                        value={m}
                        onChange={s => handleMaterialSelect(i, s)}
                        stockList={getAvailableStock(i)}
                        placeholder="Chọn nguyên liệu..."
                      />
                      <input type="number" min="0" step="0.001" className={`${inputCls} flex-shrink-0`}
                        style={{width:72}} placeholder="SL"
                        value={m.quantity} onChange={e=>setMat(i,'quantity',e.target.value)}/>
                      <span className="text-xs text-[#8E8878] font-medium flex-shrink-0 w-8">
                        {m.unit || '—'}
                      </span>
                      {materials.length > 1 && (
                        <button onClick={()=>removeMat(i)} className="text-red-400 hover:text-red-600 flex-shrink-0"><X size={14}/></button>
                      )}
                    </div>
                    {/* Tồn kho info */}
                    {m.totalQty != null && m.materialName && (
                      <p className={`text-xs mt-1 ${over?'text-red-600 font-semibold':'text-emerald-600'}`}>
                        {over ? `⚠ Vượt tồn kho! Tồn: ${m.totalQty} ${m.unit}` : `✓ Tồn kho: ${Number(m.totalQty).toLocaleString('vi-VN')} ${m.unit}`}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <Field label="Ghi chú">
          <textarea className={inputCls} rows={2} value={form.notes} onChange={e=>set('notes',e.target.value)}/>
        </Field>
      </div>
    </Modal>
  );
}

// ── Work Order Detail Panel ───────────────────────────────────────────────────
function WorkOrderPanel({ wo: woInit, recipes, onClose, onRefresh }) {
  const toast = useToast();
  const [wo, setWo] = useState(woInit); // local copy — tự refresh sau mỗi action
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(true);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [confirmStep, setConfirmStep] = useState(null);
  const [cancelBatchTarget, setCancelBatchTarget] = useState(null);
  const [startingOrder, setStartingOrder] = useState(false);
  const [startingBatch, setStartingBatch] = useState(false);
  const isCompleted = wo.status === 'COMPLETED';

  const load = async () => {
    setLoadingDetail(true);
    try {
      const d = await factoryProdApi.getOrderDetail(wo.id);
      setDetail(d);
      // Cập nhật luôn wo từ detail để nút hiển thị đúng status mới nhất
      if (d?.workOrder) setWo(d.workOrder);
    } finally { setLoadingDetail(false); }
  };
  useEffect(()=>{load();},[wo.id]);

  const onModalSaved = () => {
    setShowPlanModal(false);
    setConfirmStep(null);
    setCancelBatchTarget(null);
    load();       // reload detail + cập nhật wo.status
    onRefresh();  // cập nhật danh sách ngoài (Gantt)
  };

  const pct=Number(wo.progressPct||0);
  const color=isCompleted?{hex:'#10b981',text:'text-emerald-600'}:wo.status==='CANCELLED'?{hex:'#9ca3af',text:'text-gray-400'}:progressColor(pct);
  const isDaysAway=wo.scheduledStartDate?Math.ceil((wo.scheduledStartDate-Date.now())/86400000):0;
  const batches=detail?.batches||[];
  const plan=detail?.plan;
  const totalPlannedBatches=plan?.totalBatches||0;
  const hasInProgress=batches.some(b=>b.status==='IN_PROGRESS');
  const nextBatchNumber=batches.length+1;
  const canStartBatch=wo.status==='IN_PROGRESS'&&!hasInProgress&&(totalPlannedBatches===0||batches.length<totalPlannedBatches);

  return (
    <Modal open title={wo.workOrderCode} onClose={onClose} size="xl"
      footer={<SecondaryButton onClick={onClose}>Đóng</SecondaryButton>}>
      <div className="space-y-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          {[
            {label:'Sản phẩm',value:wo.productName},
            {label:'Kế hoạch',value:`${fmtNum(wo.plannedQty)} ${wo.outputUnit}`},
            {label:'Thực tế',value:`${fmtNum(wo.accumulatedQty)} ${wo.outputUnit}`},
            {label:'Tiến độ',value:<span className="font-bold" style={{color:color.hex}}>{isCompleted?'✓ Hoàn thành':`${pct.toFixed(0)}%`}</span>},
          ].map(s=>(
            <div key={s.label} className="bg-[#FAF7F2] rounded-xl p-3">
              <p className="text-xs text-[#8E8878] mb-0.5">{s.label}</p>
              <p className="font-semibold text-sm text-[#1C1C1E]">{s.value}</p>
            </div>
          ))}
        </div>
        <div className="flex gap-3 flex-wrap text-xs text-[#8E8878]">
          {wo.productionFactoryName&&<span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-medium flex items-center gap-1"><Factory size={12}/> {wo.productionFactoryName}</span>}
          <span>📅 {fmtDate(wo.scheduledStartDate)} → {fmtDate(wo.plannedEndDate)}</span>
          {wo.status==='SCHEDULED'&&wo.scheduledMode&&<span className="bg-amber-50 text-amber-700 px-3 py-1 rounded-full font-medium flex items-center gap-1"><Lock size={12}/> Hẹn giờ · {isDaysAway>0?`còn ${isDaysAway} ngày`:'Đến ngày rồi'}</span>}
          {isCompleted&&<span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full font-medium">✓ Đã hoàn thành</span>}
        </div>

        {!isCompleted && (
          <div className="flex gap-2 flex-wrap">
            {wo.status==='PENDING_PLAN'&&<PrimaryButton onClick={()=>setShowPlanModal(true)}><ClipboardList size={14}/> Lập phương án</PrimaryButton>}
            {wo.status==='PLANNED'&&(
              <PrimaryButton loading={startingOrder} onClick={async()=>{
                setStartingOrder(true);
                try{
                  await factoryProdApi.startOrder(wo.id);
                  onModalSaved(); // reload → wo.status → IN_PROGRESS → hiện nút Bắt đầu mẻ
                }catch(e){
                  const raw = e?.response?.data?.message || e?.message || '';
                  const msg = raw.replace(/^Lỗi hệ thống:\s*/i, '');
                  if (msg.includes('Chưa đến')) {
                    const match = msg.match(/bắt đầu:\s*(.+)/i);
                    const timeStr = match ? match[1].trim() : msg;
                    toast(`Chưa đến thời gian được phép bắt đầu sản xuất lệnh ${wo.workOrderCode}. Thời gian bắt đầu được phép là ${timeStr}`,'warning',8000);
                  } else {
                    toast(msg || 'Có lỗi xảy ra','error',5000);
                  }
                }finally{setStartingOrder(false);}
              }}>Bắt đầu sản xuất</PrimaryButton>
            )}
            {canStartBatch&&(
              <PrimaryButton loading={startingBatch} onClick={async()=>{
                setStartingBatch(true);
                try{
                  await factoryProdApi.startBatch({workOrderId:wo.id,recipeId:recipes[0]?.id});
                  onModalSaved();
                }catch(e){toast(e?.response?.data?.message||'Có lỗi xảy ra','error');}
                finally{setStartingBatch(false);}
              }}><Plus size={14}/> Bắt đầu mẻ {nextBatchNumber}</PrimaryButton>
            )}
          </div>
        )}

        <div>
          <p className="text-xs font-semibold text-[#8E8878] uppercase tracking-wider mb-3">
            Tiến độ từng mẻ {loadingDetail&&<Loader2 size={10} className="inline animate-spin ml-1"/>}
          </p>
          {loadingDetail?(
            <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-[#C9A84C]"/></div>
          ):(
            <BatchRoadmap batches={batches} wo={wo} planBatchQtyPerRun={plan?.batchQtyPerRun}
              onConfirmStep={(batch,step)=>setConfirmStep({batch,step})}
              onBatchCompleted={onModalSaved}
              onCancelBatch={(batch)=>setCancelBatchTarget(batch)}/>
          )}
        </div>
      </div>

      {showPlanModal&&<SubmitPlanModal workOrder={wo} onClose={()=>setShowPlanModal(false)} onSaved={onModalSaved}/>}
      {confirmStep&&<ConfirmStepModal batch={confirmStep.batch} step={confirmStep.step} onClose={()=>setConfirmStep(null)} onSaved={onModalSaved}/>}
      {cancelBatchTarget&&<CancelBatchModal batch={cancelBatchTarget} workOrder={wo} onClose={()=>setCancelBatchTarget(null)} onSaved={onModalSaved}/>}
    </Modal>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function FactoryOrdersPage() {
  const [factories, setFactories] = useState([]);
  const [selectedFactory, setSelected] = useState(null);
  const [orders, setOrders] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useMinLoading(true);
  const [selectedWO, setSelectedWO] = useState(null);

  const loadFactories = async () => {
    try{const list=await factoryProdApi.listMyFactories();setFactories(list||[]);if(list?.length===1)setSelected(list[0].id);}
    catch{setFactories([]);}
  };
  const loadOrders = async(factoryId)=>{
    setLoading(true);
    try{
      const[ords,recs]=await Promise.all([factoryProdApi.listMyOrders(factoryId),factoryWorkerApi.listRecipes()]);
      setOrders(ords||[]);setRecipes(recs||[]);
    }finally{setLoading(false);}
  };
  useEffect(()=>{loadFactories();},[]);
  useEffect(()=>{loadOrders(selectedFactory);},[selectedFactory]);

  const visible = orders.filter(o=>o.status!=='CANCELLED');
  const pendingCount=visible.filter(o=>o.status==='PENDING_PLAN').length;

  if(loading&&orders.length===0&&factories.length===0) return <div className="p-6 space-y-4">{[...Array(3)].map((_,i)=><CardSkeleton key={i} lines={3}/>)}</div>;

  return (
    <div className="p-4 sm:p-6 space-y-4 bg-[#F5F0EB] min-h-full">
      <div className="bg-[#1A2B1A] rounded-2xl p-5 text-white">
        <p className="text-[#7CB87C] text-xs uppercase tracking-widest font-medium">Xưởng sản xuất</p>
        <h1 className="text-xl font-bold mt-0.5">Lệnh sản xuất</h1>
        {pendingCount>0&&<p className="text-amber-300 text-xs mt-1">⚠ {pendingCount} lệnh đang chờ lập phương án</p>}
        {factories.length>1&&(
          <div className="flex gap-2 mt-3 flex-wrap">
            <button onClick={()=>setSelected(null)} className={`px-3 py-1 rounded-xl text-xs font-medium transition-colors ${selectedFactory===null?'bg-white text-[#1A2B1A]':'bg-white/20 text-white hover:bg-white/30'}`}>Tất cả xưởng</button>
            {factories.map(f=>(
              <button key={f.id} onClick={()=>setSelected(f.id)} className={`px-3 py-1 rounded-xl text-xs font-medium transition-colors flex items-center gap-1 ${selectedFactory===f.id?'bg-white text-[#1A2B1A]':'bg-white/20 text-white hover:bg-white/30'}`}>
                <Factory size={11}/> {f.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {visible.length>0&&(
        <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-4">
          <p className="text-xs font-semibold text-[#8E8878] uppercase tracking-wider mb-3">Timeline 12 tuần</p>
          <FactoryGantt orders={visible} onOrderClick={setSelectedWO}/>
        </div>
      )}
      {visible.length===0&&!loading&&(
        <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-10 text-center">
          <ClipboardList size={32} className="mx-auto text-[#C4B9A8] mb-3"/>
          <p className="text-sm text-[#8E8878]">Không có lệnh sản xuất nào</p>
        </div>
      )}

      {selectedWO&&<WorkOrderPanel wo={selectedWO} recipes={recipes} onClose={()=>setSelectedWO(null)} onRefresh={()=>loadOrders(selectedFactory)}/>}
    </div>
  );
}