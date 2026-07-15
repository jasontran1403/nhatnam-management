// src/pages/factory_worker/FactoryOrdersPage.jsx
import { useState, useEffect, useRef } from 'react';
import { useLang } from '../../context/LangContext';
import {
  ClipboardList, ChevronLeft, ChevronRight, ZoomIn, Factory,
  Lock, Camera, X, Plus, Loader2, CheckCircle2, AlertTriangle,
  Trash2, ChevronDown, ChevronUp, XCircle, PackageX, Eye,
} from 'lucide-react';
import useMinLoading from '../../hooks/useMinLoading';
import { CardSkeleton } from '../../components/ui/Skeleton';
import Modal from '../../components/ui/Modal';
import DatePicker from '../../components/ui/DatePicker';
import { addMonths, addYears, startOfDay } from 'date-fns';
import {
  PrimaryButton, SecondaryButton, Field, inputCls, EmptyState,
} from '../../components/ui';
import {
  factoryProdApi, productionUploadApi, progressColor, fmtDate, fmtNum,
} from '../../api/productionModuleApi';
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
  const { t } = useLang();
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
          <Camera size={18} className="text-[#C9A84C]"/><span className="text-[10px] text-[#C9A84C] mt-0.5">{t('common', 'add')}</span>
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
  const { t } = useLang();
  if (!orders?.length) return <EmptyState icon={ClipboardList} title={t('production', 'gantt_no_orders')}/>;
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
// Badge hiển thị loại kiểm soát của 1 bước: không KS (ẩn) / KS trực quan (👁) / KS hình ảnh cân ký (📷)
function StepControlBadge({ step }) {
  const { t } = useLang();
  const controlType = step.controlType || (step.requiresQC === true || step.requiresQc === true ? 'PHOTO_WEIGHT' : 'NONE');
  if (controlType === 'PHOTO_WEIGHT') {
    return <span className="ml-2 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-normal">📷 {t('production', 'step_badge_photo_weight')}</span>;
  }
  if (controlType === 'VISUAL') {
    return <span className="ml-2 text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-normal">👁 {t('production', 'step_badge_visual')}</span>;
  }
  return null;
}

function ConfirmStepModal({ batch, step, onClose, onSaved }) {
  const toast = useToast();
  const { t } = useLang();
  const [notes, setNotes] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  // controlType: NONE (không KS) | VISUAL (KS trực quan — chỉ cần xác nhận, không cần ảnh) | PHOTO_WEIGHT (KS hình ảnh cân ký — bắt buộc ảnh)
  const controlType = step.controlType || (step.requiresQC === true || step.requiresQc === true ? 'PHOTO_WEIGHT' : 'NONE');
  const requiresPhoto = controlType === 'PHOTO_WEIGHT';
  const isVisualControl = controlType === 'VISUAL';
  const submit = async () => {
    if (requiresPhoto && attachments.length===0) { setErr(t('production', 'confirm_step_err_need_photo')); return; }
    setSaving(true);
    try {
      await factoryProdApi.completeStep(batch.id, step.stepSequence, {attachments, notes});
      onSaved();
    } catch(e) {
      const msg = e?.response?.data?.message||e?.message||t('production', 'confirm_step_err_generic');
      if (msg.includes('đã được xác nhận bởi')) {
        toast(msg+t('production', 'confirm_step_already_done_reload'),'warning',4000);
        setTimeout(()=>window.location.reload(),2000);
      } else { setErr(msg); }
    } finally { setSaving(false); }
  };
  return (
    <Modal open title={`${t('production', 'confirm_step_title')} ${step.stepSequence}: ${step.stepName}`} onClose={onClose} size="sm"
      footer={<div className="flex justify-end gap-2"><SecondaryButton onClick={onClose}>{t('production', 'confirm_step_cancel')}</SecondaryButton><PrimaryButton onClick={submit} loading={saving}>{t('production', 'confirm_step_confirm')}</PrimaryButton></div>}>
      <div className="space-y-4">
        {err&&<p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{err}</p>}
        {requiresPhoto ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-600 flex-shrink-0"/>
            <p className="text-xs text-amber-700">{t('production', 'confirm_step_photo_weight_notice')}</p>
          </div>
        ) : isVisualControl ? (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-2">
            <Eye size={16} className="text-blue-600 flex-shrink-0"/>
            <p className="text-xs text-blue-700">{t('production', 'confirm_step_visual_notice')}</p>
          </div>
        ) : (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-2">
            <CheckCircle2 size={16} className="text-blue-600 flex-shrink-0"/>
            <p className="text-xs text-blue-700">{t('production', 'confirm_step_none_notice')}</p>
          </div>
        )}
        {requiresPhoto && (
          <ImageUploader label={t('production', 'confirm_step_photo_label')} required={requiresPhoto} uploaded={attachments}
            onUpload={async(files)=>{
              const urls = await productionUploadApi.uploadBatchStepImages(batch.id, step.stepSequence, files);
              setAttachments(p=>[...p,...urls]); return urls;
            }}/>
        )}
        <Field label={t('production', 'confirm_step_notes_label')}><textarea className={inputCls} rows={2} value={notes} onChange={e=>setNotes(e.target.value)} placeholder={t('production', 'confirm_step_notes_placeholder')}/></Field>
      </div>
    </Modal>
  );
}

// ── Confirm Stage Run Modal (xác nhận 1 lần chạy công đoạn: bước chung/riêng) ──
function ConfirmStageRunModal({ run, stageName, outputUnit, onClose, onSaved }) {
  const toast = useToast();
  const { t } = useLang();
  const [notes, setNotes] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [damagedQty, setDamagedQty] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const controlType = run.controlType || (run.requiresQc === true ? 'PHOTO_WEIGHT' : 'NONE');
  const requiresPhoto = controlType === 'PHOTO_WEIGHT';
  const isVisualControl = controlType === 'VISUAL';
  // Mục 3: bước CÓ kiểm soát (trực quan hoặc cân ký) → cho nhập số hư hỏng.
  // Đơn vị luôn theo đơn vị sản lượng của sản phẩm đang sản xuất.
  const hasControl = requiresPhoto || isVisualControl;
  const unit = outputUnit || 'kg';
  const runLabel = run.batchNumber != null
    ? `Mẻ ${run.batchNumber}`
    : (run.totalRuns > 1 ? `Lần ${run.runNumber}/${run.totalRuns}` : 'Làm chung');
  const submit = async () => {
    if (requiresPhoto && attachments.length === 0) { setErr(t('production', 'confirm_step_err_need_photo')); return; }
    let damaged = null;
    if (hasControl && String(damagedQty).trim() !== '') {
      damaged = Number(damagedQty);
      if (isNaN(damaged) || damaged < 0) { setErr('Số hư hỏng không hợp lệ (phải ≥ 0)'); return; }
    }
    setSaving(true);
    try {
      await factoryProdApi.completeStageRun(run.id, {
        attachments, notes,
        damagedQty: hasControl ? (damaged ?? 0) : undefined,
      });
      onSaved();
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || t('production', 'confirm_step_err_generic');
      if (msg.includes('đã được xác nhận')) {
        toast(msg + t('production', 'confirm_step_already_done_reload'), 'warning', 4000);
        setTimeout(() => window.location.reload(), 2000);
      } else { setErr(msg); }
    } finally { setSaving(false); }
  };
  return (
    <Modal open title={`${t('production', 'confirm_step_title')}: ${stageName} — ${runLabel}`} onClose={onClose} size="sm"
      footer={<div className="flex justify-end gap-2"><SecondaryButton onClick={onClose}>{t('production', 'confirm_step_cancel')}</SecondaryButton><PrimaryButton onClick={submit} loading={saving}>{t('production', 'confirm_step_confirm')}</PrimaryButton></div>}>
      <div className="space-y-4">
        {err && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{err}</p>}
        {requiresPhoto ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-600 flex-shrink-0"/>
            <p className="text-xs text-amber-700">{t('production', 'confirm_step_photo_weight_notice')}</p>
          </div>
        ) : isVisualControl ? (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-2">
            <Eye size={16} className="text-blue-600 flex-shrink-0"/>
            <p className="text-xs text-blue-700">{t('production', 'confirm_step_visual_notice')}</p>
          </div>
        ) : (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-2">
            <CheckCircle2 size={16} className="text-blue-600 flex-shrink-0"/>
            <p className="text-xs text-blue-700">{t('production', 'confirm_step_none_notice')}</p>
          </div>
        )}
        {requiresPhoto && (
          <ImageUploader label={t('production', 'confirm_step_photo_label')} required={requiresPhoto} uploaded={attachments}
            onUpload={async(files)=>{
              const urls = await productionUploadApi.uploadWorkOrderStepImages(run.id, files);
              setAttachments(p=>[...p,...urls]); return urls;
            }}/>
        )}
        {hasControl && (
          <Field label={`Số hư hỏng (${unit})`} hint="Bỏ trống hoặc 0 nếu không có hư hỏng. Chỉ ghi nhận thống kê, không tự trừ sản lượng.">
            <input type="number" step="0.001" min="0" className={inputCls}
              placeholder={`0 (${unit})`}
              value={damagedQty} onChange={e=>setDamagedQty(e.target.value)}/>
          </Field>
        )}
        <Field label={t('production', 'confirm_step_notes_label')}><textarea className={inputCls} rows={2} value={notes} onChange={e=>setNotes(e.target.value)} placeholder={t('production', 'confirm_step_notes_placeholder')}/></Field>
      </div>
    </Modal>
  );
}

// ── Stage Roadmap (công đoạn cấp lệnh: bước chung + bước riêng) ────────────────
function StageRoadmap({ stages, onStartRun, onConfirmRun, startingRunId, outputUnit }) {
  const { t } = useLang();
  const [lightbox, setLightbox] = useState(null);
  if (!stages || stages.length === 0) {
    return <p className="text-xs text-[#8E8878]">{t('production', 'stage_none')}</p>;
  }
  return (
    <>
      <div className="space-y-3">
        {stages.map((stage) => {
          const done = stage.status === 'COMPLETED';
          const running = stage.status === 'IN_PROGRESS';
          return (
            <div key={stage.stageSequence} className="border border-black/5 rounded-2xl overflow-hidden">
              <div className={`px-4 py-3 flex items-center justify-between gap-2 ${done?'bg-emerald-50':running?'bg-amber-50':'bg-[#FAF7F2]'}`}>
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${done?'bg-emerald-500 text-white':'bg-[#C9A84C] text-white'}`}>
                    {done ? <CheckCircle2 size={14}/> : stage.stageSequence}
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-[#1C1C1E] truncate">
                      {stage.stageName}
                      {stage.shared
                        ? <span className="ml-2 text-[10px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full font-normal">🔗 {t('production', 'stage_shared_badge')}</span>
                        : <span className="ml-2 text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full font-normal">{t('production', 'stage_perbatch_badge')}</span>}
                    </p>
                    <p className="text-[11px] text-[#8E8878]">
                      {stage.completedRuns}/{stage.totalRuns} {stage.shared ? t('production', 'stage_runs_suffix') : t('production', 'roadmap_batches_suffix') || 'mẻ'}
                      {stage.machineName ? <> · ⚙ {stage.machineName}</> : null}
                      {stage.durationMinutes ? <> · ⏱ {stage.durationMinutes} {t('production', 'roadmap_minutes')}</> : null}
                    </p>
                  </div>
                </div>
              </div>
              <div className="px-4 py-3 space-y-2">
                {stage.runs.map((run) => {
                  const rDone = run.status === 'COMPLETED';
                  const rRunning = run.status === 'IN_PROGRESS';
                  const rLabel = run.batchNumber != null
                    ? `Mẻ ${run.batchNumber}`
                    : (run.totalRuns > 1 ? `${t('production','stage_run_label')} ${run.runNumber}/${run.totalRuns}` : t('production','stage_shared_all'));
                  const qty = run.runQty != null ? `${fmtNum(run.runQty)}kg` : '';
                  return (
                    <div key={run.id} className="flex items-center gap-3 flex-wrap">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${rDone?'bg-emerald-100 text-emerald-700':rRunning?'bg-amber-100 text-amber-700':'bg-slate-100 text-slate-600'}`}>
                        {rLabel}{qty?` · ${qty}`:''}
                      </span>
                      {rDone && <span className="text-xs text-emerald-600">✓ {run.completedByName} · {fmtDate(run.completedAt)}</span>}
                      {rDone && Number(run.damagedQty) > 0 && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                          Hư hỏng: {fmtNum(run.damagedQty)} {outputUnit || 'kg'}
                        </span>
                      )}
                      {rRunning && <span className="text-xs text-amber-600">▶ {run.startedByName} · {fmtDate(run.startedAt)}</span>}
                      <div className="flex-1"/>
                      {run.status === 'PENDING' && run.canStart && (
                        <SecondaryButton loading={startingRunId===run.id} onClick={()=>onStartRun(run)} className="!px-3 !py-1 text-xs flex-shrink-0">
                          {t('production', 'roadmap_start_btn') || 'Bắt đầu'}
                        </SecondaryButton>
                      )}
                      {run.status === 'PENDING' && !run.canStart && (
                        <span className="text-[11px] text-[#8E8878] italic">{t('production', 'stage_wait_prev')}</span>
                      )}
                      {rRunning && (
                        <PrimaryButton onClick={()=>onConfirmRun(stage, run)} className="!px-3 !py-1 text-xs flex-shrink-0">{t('production', 'roadmap_complete_btn')}</PrimaryButton>
                      )}
                      {rDone && run.attachments?.length>0 && (
                        <div className="flex gap-1">
                          {run.attachments.map((url,idx)=>(
                            <button key={idx} onClick={()=>setLightbox({images:run.attachments,idx})}
                              className="w-8 h-8 rounded-lg overflow-hidden border border-black/10">
                              <img src={url} alt="" className="w-full h-full object-cover"/>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {lightbox&&<ImageLightbox images={lightbox.images} initialIdx={lightbox.idx} onClose={()=>setLightbox(null)}/>}
    </>
  );
}

// ── Complete Batch Inline ─────────────────────────────────────────────────────
function CompleteBatchInline({ batch, wo, onSaved }) {
  const toast = useToast();
  const { t } = useLang();
  const [qty, setQty] = useState('');
  const [scrapQty, setScrapQty] = useState('');
  const [scrapReason, setScrapReason] = useState('');
  const [manufactureDate, setManufactureDate] = useState(Date.now());
  const [expiryDate, setExpiryDate] = useState(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  // Lấy sản lượng kế hoạch đúng cho MẺ NÀY từ danh sách từng mẻ (batchQtyPerRunList)
  // Mẻ 1 → index 0, Mẻ 2 → index 1, ...
  const batchIndex = (batch?.batchNumber || 1) - 1;
  const batchQtyList = wo?.plan?.batchQtyPerRunList;
  const planQty = Number(
    (Array.isArray(batchQtyList) && batchQtyList[batchIndex] != null)
      ? batchQtyList[batchIndex]
      : (wo?.plan?.batchQtyPerRun || batch?.plannedQty || 0)
  );
  const lowQty = planQty > 0 ? planQty * 0.95 : 0;
  const highQty = planQty > 0 ? planQty * 1.05 : Infinity;
  const validate = (v) => {
    const n = Number(v);
    if (!v || isNaN(n) || n < 0) return t('production', 'complete_batch_err_invalid_qty');
    return '';
  };
  const isOutOfRange = (v) => {
    const n = Number(v);
    return planQty > 0 && !isNaN(n) && (n < lowQty || n > highQty);
  };
  const submit = async () => {
    const e = validate(qty); if (e) { setErr(e); return; }
    if (!manufactureDate) { setErr(t('production', 'complete_batch_err_need_mfg_date')); return; }
    if (!expiryDate) { setErr(t('production', 'complete_batch_err_need_expiry')); return; }
    if (expiryDate < manufactureDate) { setErr(t('production', 'complete_batch_err_expiry_before_mfg')); return; }
    const scrapN = Number(scrapQty || 0);
    if (scrapN < 0 || isNaN(scrapN)) { setErr(t('production', 'complete_batch_err_invalid_scrap')); return; }
    if (scrapN > 0 && !scrapReason.trim()) { setErr(t('production', 'complete_batch_err_need_scrap_reason')); return; }
    setSaving(true);
    try {
      const res = await factoryProdApi.completeBatch(batch.id, {
        actualOutputQty: Number(qty),
        manufactureDate,
        expiryDate,
        scrapQty: scrapN > 0 ? scrapN : null,
        scrapReason: scrapN > 0 ? scrapReason.trim() : null,
      });
      const scrapNote = scrapN > 0 ? ` · ${scrapN} ${wo.outputUnit} ${t('production', 'complete_batch_success_scrap_suffix')}` : '';
      toast(`${t('production', 'complete_batch_success')} ${res?.batchCode||batch.batchCode} — ${qty} ${wo.outputUnit} ${t('production', 'complete_batch_success_qty')}${scrapNote}`, 'success', 4000);
      onSaved(true); // true = báo cho parent biết vừa hoàn thành 1 mẻ, để hỏi "bắt đầu mẻ tiếp theo?"
    } catch(ex) {
      toast(ex?.response?.data?.message || t('production', 'submit_plan_err_generic'),'error');
    } finally { setSaving(false); }
  };
  return (
    <div className="px-4 py-3 bg-emerald-50 border-t border-emerald-200 space-y-2">
      <p className="text-xs font-semibold text-emerald-700">✓ {t('production', 'complete_batch_all_done')}</p>
      {planQty>0&&<p className="text-[10px] text-[#8E8878]">{t('production', 'complete_batch_plan_qty')}: {planQty} {wo.outputUnit}</p>}
      {qty && isOutOfRange(qty) && (
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">
          ⚠ {t('production', 'complete_batch_out_of_range')}
        </p>
      )}
      {err&&<p className="text-xs text-red-600">{err}</p>}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-[10px] text-[#8E8878] mb-1">{t('production', 'complete_batch_qty_achieved')} ({wo.outputUnit})</p>
          <input type="number" step="0.1" className={inputCls} placeholder={`${t('production', 'complete_batch_achieved_placeholder')} (${wo.outputUnit})`}
            value={qty} onChange={e=>{setQty(e.target.value);setErr('');}}/>
        </div>
        <div>
          <p className="text-[10px] text-[#8E8878] mb-1">{t('production', 'complete_batch_qty_scrap')} ({wo.outputUnit})</p>
          <input type="number" step="0.1" min="0" className={inputCls} placeholder="0"
            value={scrapQty} onChange={e=>{setScrapQty(e.target.value);setErr('');}}/>
        </div>
      </div>
      {Number(scrapQty || 0) > 0 && (
        <div>
          <p className="text-[10px] text-[#8E8878] mb-1">{t('production', 'complete_batch_scrap_reason_label')}</p>
          <input type="text" className={inputCls} placeholder={t('production', 'complete_batch_scrap_reason_placeholder')}
            value={scrapReason} onChange={e=>{setScrapReason(e.target.value);setErr('');}}/>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-[10px] text-[#8E8878] mb-1">{t('production', 'complete_batch_mfg_date_label')}</p>
          <DatePicker value={manufactureDate} onChange={d=>{setManufactureDate(d);setErr('');}} placeholder={t('production', 'complete_batch_mfg_date_placeholder')} />
        </div>
        <div>
          <p className="text-[10px] text-[#8E8878] mb-1">{t('production', 'complete_batch_expiry_label')}</p>
          <div className="flex flex-wrap gap-1.5 mb-1.5">
            {[
              { label: t('production', 'complete_batch_6m'), fn: (d) => addMonths(d, 6) },
              { label: t('production', 'complete_batch_1y'), fn: (d) => addYears(d, 1) },
              { label: t('production', 'complete_batch_3y'), fn: (d) => addYears(d, 3) },
            ].map(opt => {
              const computed = startOfDay(opt.fn(new Date(manufactureDate || Date.now()))).getTime();
              const active = expiryDate === computed;
              return (
                <button key={opt.label} type="button"
                  onClick={() => { setExpiryDate(computed); setErr(''); }}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition-colors ${
                    active ? 'bg-[#C9A84C] text-white border-[#C9A84C]' : 'bg-[#FAF7F2] text-[#1C1C1E] hover:bg-[#F0EBE3] border-black/5'
                  }`}>
                  {opt.label}
                </button>
              );
            })}
          </div>
          <DatePicker value={expiryDate} onChange={d=>{setExpiryDate(d);setErr('');}} placeholder={t('production', 'complete_batch_expiry_custom_placeholder')} minDate={manufactureDate ? new Date(manufactureDate) : undefined} />
        </div>
      </div>
      <PrimaryButton loading={saving} disabled={!qty} onClick={submit} className="w-full">{t('production', 'complete_batch_submit')}</PrimaryButton>
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
  const { t } = useLang();
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
    { value: 'REDO', label: t('production', 'cancel_batch_resolution_redo'), desc: t('production', 'cancel_batch_resolution_redo_desc') },
    { value: 'REPLACE', label: t('production', 'cancel_batch_resolution_replace'), desc: t('production', 'cancel_batch_resolution_replace_desc') },
    { value: 'ABORT', label: t('production', 'cancel_batch_resolution_abort'), desc: t('production', 'cancel_batch_resolution_abort_desc') },
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
    if (!reason.trim()) return t('production', 'cancel_batch_err_need_reason');
    if (actualOutputQty === '' || isNaN(Number(actualOutputQty)) || Number(actualOutputQty) < 0)
      return t('production', 'cancel_batch_err_need_actual_output');
    for (const m of materials) {
      if (m.usedQty === '' || isNaN(Number(m.usedQty)) || Number(m.usedQty) < 0)
        return `${t('production', 'cancel_batch_err_need_used_qty')} "${m.materialName}" ${t('production', 'cancel_batch_err_used_zero_hint')}`;
      if (Number(m.usedQty) > m.remainingQty)
        return `${m.materialName} (${m.usedQty} ${m.unit}) ${t('production', 'cancel_batch_err_used_exceeds')} (${m.remainingQty} ${m.unit})`;
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
          ? `${t('production', 'cancel_batch_success_with_return')}`
          : `${t('production', 'cancel_batch_success')} ${batch.batchCode}.`,
        'success', 5000
      );
      onSaved();
    } catch (ex) {
      setErr(ex?.response?.data?.message || t('production', 'cancel_batch_err_generic'));
    } finally { setSaving(false); }
  };

  return (
    <Modal open title={`${t('production', 'cancel_batch_title')} ${batch.batchCode}`} onClose={onClose} size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose}>{t('production', 'cancel_batch_close')}</SecondaryButton>
          <PrimaryButton onClick={submit} loading={saving} className="!bg-red-600 hover:!bg-red-700">
            <XCircle size={14}/> {t('production', 'cancel_batch_confirm')}
          </PrimaryButton>
        </div>
      }>
      <div className="space-y-5">
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
          <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5"/>
          <p className="text-xs text-red-700">
            {t('production', 'cancel_batch_warning')}
          </p>
        </div>

        {err && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{err}</p>}

        <Field label={t('production', 'cancel_batch_reason_label')} required>
          <textarea className={inputCls} rows={2} value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder={t('production', 'cancel_batch_reason_placeholder')}/>
        </Field>

        <div>
          <label className="text-xs font-semibold text-[#8E8878] uppercase tracking-wider mb-2 block">
            {t('production', 'cancel_batch_resolution_label')}
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

        <Field label={t('production', 'cancel_batch_actual_output_label')} required>
          <div className="flex items-center gap-2">
            <input type="number" min="0" step="0.01" className={inputCls + ' flex-1'}
              placeholder={t('production', 'cancel_batch_actual_output_placeholder')}
              value={actualOutputQty} onChange={e => { setActualOutputQty(e.target.value); setErr(''); }}/>
            <span className="text-sm text-[#8E8878] flex-shrink-0">{batch.outputUnit}</span>
          </div>
          <p className="text-[10px] text-[#8E8878] mt-1">{t('production', 'cancel_batch_actual_output_hint')} {workOrder.workOrderCode}.</p>
        </Field>

        <div>
          <label className="text-xs font-semibold text-[#8E8878] uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <PackageX size={13}/> {t('production', 'cancel_batch_materials_used_label')}
          </label>
          {loadingMats ? (
            <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin text-[#C9A84C]"/></div>
          ) : materials.length === 0 ? (
            <p className="text-xs text-[#8E8878] italic bg-[#FAF7F2] rounded-xl px-3 py-3">
              {t('production', 'cancel_batch_no_materials')}
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-[10px] text-[#8E8878] mb-1">
                {t('production', 'cancel_batch_materials_hint')}
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
                        <p className="text-[10px] text-[#8E8878]">{t('production', 'cancel_batch_taken_from_stock')}: {m.remainingQty.toLocaleString('vi-VN')} {m.unit}</p>
                      </div>
                      <input type="number" min="0" max={m.remainingQty} step="0.001" className={`${inputCls} flex-shrink-0`}
                        style={{ width: 90 }} placeholder={t('production', 'cancel_batch_used_placeholder')}
                        value={m.usedQty} onChange={e => { setUsed(i, e.target.value); setErr(''); }}/>
                      <span className="text-xs text-[#8E8878] font-medium flex-shrink-0 w-8">{m.unit}</span>
                    </div>
                    {willReturn !== null && (
                      <p className={`text-xs mt-1.5 ${over ? 'text-red-600 font-semibold' : 'text-emerald-600'}`}>
                        {over
                          ? `⚠ ${t('production', 'cancel_batch_over_limit')}`
                          : willReturn > 0
                            ? `↩ ${t('production', 'cancel_batch_will_return')}: ${willReturn.toLocaleString('vi-VN')} ${m.unit}`
                            : `✓ ${t('production', 'cancel_batch_fully_used')}`}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <ImageUploader label={t('production', 'cancel_batch_photo_label')} uploaded={attachments}
          onUpload={async (files) => {
            const urls = await productionUploadApi.uploadBatchCancelImages(batch.id, files);
            setAttachments(p => [...p, ...urls]); return urls;
          }}/>

        <Field label={t('production', 'cancel_batch_notes_label')}>
          <textarea className={inputCls} rows={2} value={resolutionNotes}
            onChange={e => setResolutionNotes(e.target.value)}
            placeholder={t('production', 'cancel_batch_notes_placeholder')}/>
        </Field>
      </div>
    </Modal>
  );
}

// ── Batch Roadmap ─────────────────────────────────────────────────────────────
function BatchRoadmap({ batches, onConfirmStep, onStartStep, startingStepId, wo, planBatchQtyPerRun, onBatchCompleted, onCancelBatch, readOnlySteps }) {
  const { t } = useLang();
  const [lightbox, setLightbox] = useState(null);
  const sorted = [...(batches||[])].sort((a,b)=>(b.batchNumber||0)-(a.batchNumber||0));
  const [expanded, setExpanded] = useState(new Set([sorted[0]?.id].filter(Boolean)));
  const toggle = (id) => setExpanded(prev=>{const s=new Set(prev);s.has(id)?s.delete(id):s.add(id);return s;});

  if (!batches?.length) return (
    <div className="text-center py-6 text-[#8E8878] text-sm">
      {wo.status==='IN_PROGRESS'?t('production', 'roadmap_no_batch_started'):t('production', 'roadmap_order_not_started')}
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
                        :isCancelled?`🚫 ${t('production', 'roadmap_cancelled')}`:`${batch.completedSteps}/${batch.totalSteps} ${t('production', 'roadmap_steps_suffix')}`}
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

              {/* Nguyên liệu riêng của mẻ này — expand/collapse */}
              {isExpanded && batch.batchMaterials?.length > 0 && (
                <div className="px-4 py-3 border-t border-black/5 bg-[#FAF7F2]/60">
                  <p className="text-xs font-semibold text-[#8E8878] uppercase tracking-wider mb-1.5">{t('production', 'roadmap_batch_materials')}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {batch.batchMaterials.map((m,i)=>(
                      <span key={i} className="text-xs bg-white border border-black/10 rounded-full px-2.5 py-1 text-[#1C1C1E]">
                        {m.materialName}: <b>{fmtNum(m.qty)} {m.unit}</b>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {isExpanded && batch.steps?.length>0 && (
                <div className="px-4 py-4 border-t border-black/5">
                  <div className="relative">
                    <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-black/10"/>
                    <div className="space-y-4">
                      {batch.steps.map((step,i)=>{
                        const done=step.status==='COMPLETED';
                        const running=step.status==='IN_PROGRESS';
                        // Không còn ràng buộc thứ tự — có thể bắt đầu nhiều bước song song
                        // (VD: rửa thịt và luộc thịt cùng lúc, không cần rửa hết mới luộc).
                        const canStart=!done&&!running&&batch.status==='IN_PROGRESS';
                        const isStartingThis = startingStepId === step.id;
                        return (
                          <div key={step.id} className="flex gap-4 relative">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-10 border-2 transition-all
                              ${done?'bg-emerald-500 border-emerald-500 text-white'
                                :running?'bg-white border-[#C9A84C] text-[#C9A84C] ring-4 ring-[#C9A84C]/20 animate-pulse'
                                :'bg-white border-black/15 text-[#8E8878]'}`}>
                              {done?<CheckCircle2 size={16}/>:<span className="text-xs font-bold">{step.stepSequence}</span>}
                            </div>
                            <div className={`flex-1 pb-2 ${done?'':'opacity-80'}`}>
                              <div className="flex items-center justify-between gap-2">
                                <p className={`text-sm font-semibold ${done?'text-emerald-700':running?'text-[#C9A84C]':'text-[#8E8878]'}`}>
                                  {step.stepName}
                                  <StepControlBadge step={step} />
                                  {running&&<span className="ml-2 text-[10px] bg-[#C9A84C]/10 text-[#C9A84C] px-2 py-0.5 rounded-full font-normal">{t('production', 'roadmap_in_progress_badge')}</span>}
                                </p>
                                {!readOnlySteps&&running&&<PrimaryButton onClick={()=>onConfirmStep(batch,step)} className="!px-3 !py-1 text-xs flex-shrink-0">{t('production', 'roadmap_complete_btn')}</PrimaryButton>}
                                {!readOnlySteps&&canStart&&(
                                  <SecondaryButton loading={isStartingThis} onClick={()=>onStartStep(batch,step)} className="!px-3 !py-1 text-xs flex-shrink-0">
                                    {t('production', 'roadmap_start_btn')}
                                  </SecondaryButton>
                                )}
                              </div>
                              <p className="text-xs text-[#8E8878] mt-0.5 flex items-center gap-2 flex-wrap">
                                {step.durationMinutes ? <span>⏱ {t('production', 'roadmap_expected_duration')} {step.durationMinutes} {t('production', 'roadmap_minutes')}</span> : null}
                                {step.machineName ? <span>⚙ {step.machineName}</span> : null}
                              </p>
                              {running&&step.startedByName&&<p className="text-xs text-[#8E8878] mt-0.5">▶ {t('production', 'roadmap_started_by')} {step.startedByName} · {fmtDate(step.startedAt)}</p>}
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
                    <p className="text-xs text-[#8E8878]">{t('production', 'roadmap_in_progress_continue')}</p>
                  )}
                  <SecondaryButton onClick={()=>onCancelBatch(batch)} className="!text-red-600 !border-red-200 hover:!bg-red-50 flex-shrink-0">
                    <XCircle size={13}/> {t('production', 'roadmap_cancel_batch')}
                  </SecondaryButton>
                </div>
              )}
              {batch.cancellation&&(
                <div className="px-4 py-3 bg-red-50 border-t border-red-200 text-xs text-red-600 space-y-1.5">
                  <p className="font-semibold">{t('production', 'roadmap_cancel_reason')}: {batch.cancellation.reason}</p>
                  <p>{t('production', 'roadmap_cancelled_by')} {batch.cancellation.cancelledByName} · {fmtDate(batch.cancellation.cancelledAt)}</p>
                  {batch.cancellation.actualOutputQty != null && (
                    <p>{t('production', 'roadmap_output_before_cancel')}: <b>{fmtNum(batch.cancellation.actualOutputQty)} {batch.outputUnit}</b></p>
                  )}
                  {batch.cancellation.materialUsage?.length > 0 && (
                    <div className="mt-1.5 pt-1.5 border-t border-red-200">
                      <p className="font-semibold mb-1">{t('production', 'roadmap_materials_deducted')}:</p>
                      {batch.cancellation.materialUsage.map((m,i) => {
                        const returned = Math.max(0, Number(m.deductedQty||0) - Number(m.actualUsedQty||0));
                        return (
                          <p key={i} className="text-[11px]">
                            {m.materialName}: {t('production', 'roadmap_taken')} {fmtNum(m.deductedQty)} {m.unit} — {t('production', 'roadmap_used')} {fmtNum(m.actualUsedQty)} {m.unit}
                            {returned > 0 && <span className="text-emerald-600"> · {t('production', 'roadmap_returned')} {fmtNum(returned)} {m.unit}</span>}
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

// ── Submit Plan Modal (chọn biến thể sản xuất + nhập sản lượng cần SX) ─────────
function SubmitPlanModal({ workOrder, onClose, onSaved }) {
  const toast = useToast();
  const { t } = useLang();
  const [recipes, setRecipes] = useState([]);
  const [loadingRecipes, setLoadingRecipes] = useState(true);
  const [recipeId, setRecipeId] = useState('');
  const [requestedQty, setRequestedQty] = useState('');
  const [notes, setNotes] = useState('');
  const [preview, setPreview] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    factoryProdApi.listRecipesByProduct(workOrder.factoryProductId)
      .then(list => setRecipes((list || []).filter(r => r.isActive !== false)))
      .catch(() => setRecipes([]))
      .finally(() => setLoadingRecipes(false));
  }, []);

  const runPreview = async () => {
    if (!recipeId) { setErr(t('production', 'submit_plan_err_need_recipe')); return; }
    if (!requestedQty || Number(requestedQty) <= 0) { setErr(t('production', 'submit_plan_err_need_qty')); return; }
    setErr(''); setPreviewing(true); setPreview(null);
    try {
      const p = await factoryProdApi.previewPlan(workOrder.id, Number(recipeId), Number(requestedQty));
      setPreview(p);
    } catch (e) {
      setErr(e?.response?.data?.message || t('production', 'submit_plan_err_preview_failed'));
    } finally { setPreviewing(false); }
  };

  const submit = async () => {
    if (!preview) { setErr(t('production', 'submit_plan_err_need_preview')); return; }
    setSaving(true); setErr('');
    try {
      await factoryProdApi.submitPlanByRecipe(workOrder.id, {
        recipeId: Number(recipeId),
        requestedQty: Number(requestedQty),
        notes,
      });
      toast(t('production', 'submit_plan_success'), 'success', 4000);
      onSaved();
    } catch (e) {
      setErr(e?.response?.data?.message || t('production', 'submit_plan_err_generic'));
    } finally { setSaving(false); }
  };

  return (
    <Modal open title={t('production', 'submit_plan_title')} onClose={onClose} size="xl"
      footer={
        <div className="flex justify-between items-center">
          <p className="text-xs text-[#8E8878]">{t('production', 'submit_plan_deadline')}: {fmtDate(workOrder.planDeadline)}</p>
          <div className="flex gap-2">
            <SecondaryButton onClick={onClose}>{t('production', 'submit_plan_cancel')}</SecondaryButton>
            <PrimaryButton onClick={submit} loading={saving} disabled={!preview}>{t('production', 'submit_plan_submit')}</PrimaryButton>
          </div>
        </div>
      }>
      <div className="space-y-5">
        {err && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{err}</p>}

        {/* Lệnh info */}
        <div className="bg-[#1A2B1A] rounded-xl p-4 text-white">
          <p className="text-[#7CB87C] text-xs uppercase tracking-wider">{t('production', 'submit_plan_order_label')}</p>
          <p className="font-bold text-lg mt-0.5">{workOrder.workOrderCode}</p>
          <p className="text-white/70 text-sm">{workOrder.productName} — {t('production', 'wo_panel_planned').toLowerCase()} {fmtNum(workOrder.plannedQty)} {workOrder.outputUnit}</p>
        </div>

        {/* Chọn biến thể + sản lượng */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label={t('production', 'submit_plan_recipe_label')} required>
            {loadingRecipes ? (
              <p className="text-xs text-[#8E8878]">{t('production', 'submit_plan_loading')}</p>
            ) : recipes.length === 0 ? (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                {t('production', 'submit_plan_no_recipe')}
              </p>
            ) : (
              <select className={inputCls} value={recipeId}
                onChange={e => { setRecipeId(e.target.value); setPreview(null); }}>
                <option value="">{t('production', 'submit_plan_select_recipe')}</option>
                {recipes.map(r => (
                  <option key={r.id} value={r.id}>{r.name} ({t('production', 'submit_plan_recipe_option_suffix')} {r.standardOutputQty} {r.outputUnit}{t('production', 'submit_plan_per_batch')})</option>
                ))}
              </select>
            )}
          </Field>
          <Field label={`${t('production', 'submit_plan_requested_qty_label')} (${workOrder.outputUnit})`} required>
            <input type="number" min="0" step="0.001" className={inputCls} placeholder="VD: 60"
              value={requestedQty}
              onChange={e => { setRequestedQty(e.target.value); setPreview(null); }} />
          </Field>
        </div>

        <div className="flex justify-end">
          <SecondaryButton onClick={runPreview} loading={previewing} disabled={!recipeId || !requestedQty}>
            {t('production', 'submit_plan_preview_btn')}
          </SecondaryButton>
        </div>

        {/* Preview kết quả tính toán */}
        {preview && (
          <div className="space-y-4">
            <div className="bg-[#FAF7F2] rounded-xl p-4 border border-black/5">
              <p className="text-sm font-semibold text-[#1C1C1E]">
                {preview.totalBatches} {t('production', 'submit_plan_batches_count')} — {t('production', 'submit_plan_variant_word')} "{preview.recipeName}" ({t('production', 'submit_plan_recipe_option_suffix')} {fmtNum(preview.standardOutputQty)} {preview.outputUnit}{t('production', 'submit_plan_per_batch')})
              </p>
              <p className="text-xs text-[#8E8878] mt-0.5">{t('production', 'submit_plan_total_requested')}: {fmtNum(preview.requestedQty)} {preview.outputUnit}</p>
            </div>

            {/* Từng mẻ */}
            <div>
              <p className="text-xs font-semibold text-[#8E8878] uppercase tracking-wider mb-2">{t('production', 'submit_plan_batch_detail')}</p>
              <div className="space-y-2">
                {preview.batches?.map(b => (
                  <div key={b.batchNumber} className="border border-black/5 rounded-xl p-3 bg-white">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-semibold text-[#1C1C1E]">{t('production', 'submit_plan_batch_word')} {b.batchNumber}</span>
                      <span className="text-sm text-[#C9A84C] font-semibold">{fmtNum(b.outputQty)} {preview.outputUnit}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {b.materials?.map((m, i) => (
                        <span key={i} className="text-xs bg-[#FAF7F2] border border-black/5 rounded-full px-2.5 py-1 text-[#1C1C1E]">
                          {m.materialName}: <b>{fmtNum(m.qty)} {m.unit}</b>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tổng nguyên liệu */}
            <div>
              <p className="text-xs font-semibold text-[#8E8878] uppercase tracking-wider mb-2">{t('production', 'submit_plan_total_materials')}</p>
              <div className="flex flex-wrap gap-1.5">
                {preview.totalMaterials?.map((m, i) => (
                  <span key={i} className="text-xs bg-blue-50 border border-blue-200 rounded-full px-2.5 py-1 text-blue-700">
                    {m.materialName}: <b>{fmtNum(m.qty)} {m.unit}</b>
                  </span>
                ))}
              </div>
            </div>

            {/* Các bước */}
            <div>
              <p className="text-xs font-semibold text-[#8E8878] uppercase tracking-wider mb-2">{t('production', 'submit_plan_steps_repeat')}</p>
              <ol className="space-y-1.5">
                {preview.steps?.map((s, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm bg-[#FAF7F2] rounded-xl px-3 py-2">
                    <span className="w-5 h-5 rounded-full bg-[#1C1C1E] text-white flex items-center justify-center text-[11px] font-bold flex-shrink-0">{i+1}</span>
                    <span className="font-medium flex-1 text-[#1C1C1E]">{s.stepName}</span>
                    {s.shared && <span className="text-[10px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full">🔗 {t('production','stage_shared_badge')}{s.capacityPerRun ? ` ${fmtNum(s.capacityPerRun)}kg` : ''}</span>}
                    <StepControlBadge step={s} />
                    <span className="text-xs text-[#8E8878]">{s.durationMinutes} {t('production', 'roadmap_minutes')}</span>
                    {s.machineName && <span className="text-xs text-[#8E8878]">⚙ {s.machineName}</span>}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}

        <Field label={t('production', 'submit_plan_notes')}>
          <textarea className={inputCls} rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

// ── Work Order Detail Panel ───────────────────────────────────────────────────
function WorkOrderPanel({ wo: woInit, onClose, onRefresh }) {
  const toast = useToast();
  const { t } = useLang();
  const [wo, setWo] = useState(woInit); // local copy — tự refresh sau mỗi action
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(true);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [confirmStep, setConfirmStep] = useState(null);
  const [confirmRun, setConfirmRun] = useState(null);   // {stage, run} — xác nhận 1 lần chạy công đoạn
  const [cancelBatchTarget, setCancelBatchTarget] = useState(null);
  const [startingOrder, setStartingOrder] = useState(false);
  const [startingBatch, setStartingBatch] = useState(false);
  const [startingStepId, setStartingStepId] = useState(null);
  const [startingRunId, setStartingRunId] = useState(null);
  const [askNextBatch, setAskNextBatch] = useState(false); // (deprecated) giữ để không vỡ tham chiếu cũ
  const isCompleted = wo.status === 'COMPLETED';

  const load = async () => {
    setLoadingDetail(true);
    try {
      const d = await factoryProdApi.getOrderDetail(wo.id);
      setDetail(d);
      // Cập nhật luôn wo từ detail để nút hiển thị đúng status mới nhất
      if (d?.workOrder) setWo(d.workOrder);
      return d;
    } finally { setLoadingDetail(false); }
  };
  useEffect(()=>{load();},[wo.id]);

  const onModalSaved = () => {
    setShowPlanModal(false);
    setConfirmStep(null);
    setConfirmRun(null);
    setCancelBatchTarget(null);
    load();       // reload detail + cập nhật wo.status
    onRefresh();  // cập nhật danh sách ngoài (Gantt)
  };

  // Gọi sau khi hoàn thành 1 mẻ (CompleteBatchInline) — hỏi có muốn bắt đầu mẻ tiếp theo ngay không
  const onBatchCompleted = async () => {
    setConfirmStep(null);
    setCancelBatchTarget(null);
    const d = await load();
    onRefresh();
    if (d?.hasNextBatch) setAskNextBatch(true);
  };

  const handleStartRun = async (run) => {
    setStartingRunId(run.id);
    try {
      await factoryProdApi.startStageRun(run.id, {});
      load();
    } catch (e) {
      toast(e?.response?.data?.message || t('production', 'wo_panel_err_start_step'), 'error', 5000);
    } finally { setStartingRunId(null); }
  };

  const pct=Number(wo.progressPct||0);
  const color=isCompleted?{hex:'#10b981',text:'text-emerald-600'}:wo.status==='CANCELLED'?{hex:'#9ca3af',text:'text-gray-400'}:progressColor(pct);
  const isDaysAway=wo.scheduledStartDate?Math.ceil((wo.scheduledStartDate-Date.now())/86400000):0;
  const batches=detail?.batches||[];
  const plan=detail?.plan;
  const stages=detail?.stages||[];

  return (
    <Modal open title={wo.workOrderCode} onClose={onClose} size="xl"
      footer={<SecondaryButton onClick={onClose}>{t('production', 'wo_panel_close')}</SecondaryButton>}>
      <div className="space-y-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          {[
            {label:t('production', 'wo_panel_product'),value:wo.productName},
            {label:t('production', 'wo_panel_planned'),value:`${fmtNum(wo.plannedQty)} ${wo.outputUnit}`},
            {label:t('production', 'wo_panel_actual'),value:`${fmtNum(wo.accumulatedQty)} ${wo.outputUnit}`},
            {label:t('production', 'wo_panel_progress'),value:<span className="font-bold" style={{color:color.hex}}>{isCompleted?`✓ ${t('production', 'wo_panel_completed')}`:`${pct.toFixed(0)}%`}</span>},
          ].map(s=>(
            <div key={s.label} className="bg-[#FAF7F2] rounded-xl p-3">
              <p className="text-xs text-[#8E8878] mb-0.5">{s.label}</p>
              <p className="font-semibold text-sm text-[#1C1C1E]">{s.value}</p>
            </div>
          ))}
        </div>
        {plan?.recipeName && (
          <div className="bg-[#FAF7F2] rounded-xl px-3 py-2 text-xs text-[#8E8878]">
            {t('production', 'wo_panel_recipe_label')}: <b className="text-[#1C1C1E]">{plan.recipeName}</b>
            {plan.requestedQty != null && <> · {t('production', 'wo_panel_requested_qty')}: <b className="text-[#1C1C1E]">{fmtNum(plan.requestedQty)} {wo.outputUnit}</b></>}
          </div>
        )}
        <div className="flex gap-3 flex-wrap text-xs text-[#8E8878]">
          {wo.productionFactoryName&&<span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-medium flex items-center gap-1"><Factory size={12}/> {wo.productionFactoryName}</span>}
          <span>📅 {fmtDate(wo.scheduledStartDate)} → {fmtDate(wo.plannedEndDate)}</span>
          {wo.status==='SCHEDULED'&&wo.scheduledMode&&<span className="bg-amber-50 text-amber-700 px-3 py-1 rounded-full font-medium flex items-center gap-1"><Lock size={12}/> {t('production', 'wo_panel_scheduled_mode')} · {isDaysAway>0?`${t('production', 'wo_panel_days_left')} ${isDaysAway} ${t('production', 'wo_panel_days_suffix')}`:t('production', 'wo_panel_due_now')}</span>}
          {isCompleted&&<span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full font-medium">✓ {t('production', 'wo_panel_done_badge')}</span>}
        </div>

        {!isCompleted && (
          <div className="flex gap-2 flex-wrap">
            {wo.status==='PENDING_PLAN'&&<PrimaryButton onClick={()=>setShowPlanModal(true)}><ClipboardList size={14}/> {t('production', 'wo_panel_submit_plan_btn')}</PrimaryButton>}
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
                    toast(`${t('production', 'wo_panel_not_yet_time')} ${wo.workOrderCode}. ${t('production', 'wo_panel_allowed_time_is')} ${timeStr}`,'warning',8000);
                  } else {
                    toast(msg || t('production', 'wo_panel_err_generic'),'error',5000);
                  }
                }finally{setStartingOrder(false);}
              }}>{t('production', 'wo_panel_start_production_btn')}</PrimaryButton>
            )}
          </div>
        )}

        {wo.status==='IN_PROGRESS' && (
          <div>
            <p className="text-xs font-semibold text-[#8E8878] uppercase tracking-wider mb-3">
              {t('production', 'stage_section_title')} {loadingDetail&&<Loader2 size={10} className="inline animate-spin ml-1"/>}
            </p>
            {loadingDetail?(
              <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-[#C9A84C]"/></div>
            ):(
              <StageRoadmap stages={stages}
                onStartRun={handleStartRun}
                onConfirmRun={(stage,run)=>setConfirmRun({stage,run})}
                startingRunId={startingRunId}
                outputUnit={wo?.outputUnit}/>
            )}
          </div>
        )}

        <div>
          <p className="text-xs font-semibold text-[#8E8878] uppercase tracking-wider mb-3">
            {t('production', 'wo_panel_batch_progress_title')} {loadingDetail&&<Loader2 size={10} className="inline animate-spin ml-1"/>}
          </p>
          {loadingDetail?(
            <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-[#C9A84C]"/></div>
          ):(
            <BatchRoadmap batches={batches} wo={wo} planBatchQtyPerRun={plan?.batchQtyPerRun}
              readOnlySteps
              onConfirmStep={()=>{}}
              onStartStep={()=>{}}
              startingStepId={startingStepId}
              onBatchCompleted={onBatchCompleted}
              onCancelBatch={(batch)=>setCancelBatchTarget(batch)}/>
          )}
        </div>
      </div>

      {showPlanModal&&<SubmitPlanModal workOrder={wo} onClose={()=>setShowPlanModal(false)} onSaved={onModalSaved}/>}
      {confirmStep&&<ConfirmStepModal batch={confirmStep.batch} step={confirmStep.step} onClose={()=>setConfirmStep(null)} onSaved={onModalSaved}/>}
      {confirmRun&&<ConfirmStageRunModal run={confirmRun.run} stageName={confirmRun.stage?.stageName} outputUnit={wo?.outputUnit} onClose={()=>setConfirmRun(null)} onSaved={onModalSaved}/>}
      {cancelBatchTarget&&<CancelBatchModal batch={cancelBatchTarget} workOrder={wo} onClose={()=>setCancelBatchTarget(null)} onSaved={onModalSaved}/>}
    </Modal>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function FactoryOrdersPage() {
  const { t } = useLang();
  const [factories, setFactories] = useState([]);
  const [selectedFactory, setSelected] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useMinLoading(true);
  const [selectedWO, setSelectedWO] = useState(null);

  const loadFactories = async () => {
    try{const list=await factoryProdApi.listMyFactories();setFactories(list||[]);if(list?.length===1)setSelected(list[0].id);}
    catch{setFactories([]);}
  };
  const loadOrders = async(factoryId)=>{
    setLoading(true);
    try{
      const ords = await factoryProdApi.listMyOrders(factoryId);
      setOrders(ords||[]);
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
        <p className="text-[#7CB87C] text-xs uppercase tracking-widest font-medium">{t('production', 'orders_factory_label')}</p>
        <h1 className="text-xl font-bold mt-0.5">{t('production', 'orders_page_title')}</h1>
        {pendingCount>0&&<p className="text-amber-300 text-xs mt-1">⚠ {pendingCount} {t('production', 'orders_pending_plan_warning')}</p>}
        {factories.length>1&&(
          <div className="flex gap-2 mt-3 flex-wrap">
            <button onClick={()=>setSelected(null)} className={`px-3 py-1 rounded-xl text-xs font-medium transition-colors ${selectedFactory===null?'bg-white text-[#1A2B1A]':'bg-white/20 text-white hover:bg-white/30'}`}>{t('production', 'orders_all_factories')}</button>
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
          <p className="text-xs font-semibold text-[#8E8878] uppercase tracking-wider mb-3">{t('production', 'orders_timeline_12w')}</p>
          <FactoryGantt orders={visible} onOrderClick={setSelectedWO}/>
        </div>
      )}
      {visible.length===0&&!loading&&(
        <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-10 text-center">
          <ClipboardList size={32} className="mx-auto text-[#C4B9A8] mb-3"/>
          <p className="text-sm text-[#8E8878]">{t('production', 'orders_empty')}</p>
        </div>
      )}

      {selectedWO&&<WorkOrderPanel wo={selectedWO} onClose={()=>setSelectedWO(null)} onRefresh={()=>loadOrders(selectedFactory)}/>}
    </div>
  );
}