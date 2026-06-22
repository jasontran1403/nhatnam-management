// src/pages/owner/OwnerWorkOrderDetailPage.jsx
// Chi tiết lệnh sản xuất: metrics, Gantt mẻ, ảnh xác nhận từng bước
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, CheckCircle2, Clock, AlertTriangle, Package,
  ChevronDown, ChevronUp, Image, X, Loader2, Users, ShoppingCart, Factory, FileWarning,
} from 'lucide-react';
import useMinLoading from '../../hooks/useMinLoading';
import { CardSkeleton } from '../../components/ui/Skeleton';
import Modal from '../../components/ui/Modal';
import {
  SectionCard, SectionHeader, SecondaryButton, PrimaryButton,
  DangerButton, formatDate, inputCls,
} from '../../components/ui';
import { Badge } from '../../components/ui/Badge';
import {
  ownerProdApi, STATUS_LABELS, progressColor, fmtDate, fmtNum, fmtCurrency,
} from '../../api/productionModuleApi';
import { useAuth } from '../../context/AuthContext';

// ── Helpers ───────────────────────────────────────────────────────────────────
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

function imgUrl(path) {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  // Production/all images served via /api/auth/images/...
  if (path.startsWith('/images/')) return BASE_URL + '/api/auth' + path;
  return BASE_URL + path;
}

const fmtDateTime = (ms) => ms
  ? new Date(Number(ms)).toLocaleString('vi-VN', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })
  : '—';

function StatusBadge({ status }) {
  const cfg = STATUS_LABELS[status] || { label: status, cls: 'bg-gray-100 text-gray-600' };
  return <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.cls}`}>{cfg.label}</span>;
}

function ProgressRing({ pct, size = 64 }) {
  const v = Math.min(Number(pct || 0), 100);
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (v / 100) * circ;
  const color = progressColor(pct);
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={6} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color.hex}
        strokeWidth={6} strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round" />
    </svg>
  );
}

// ── Image Lightbox ────────────────────────────────────────────────────────────
function ImageLightbox({ images, onClose }) {
  const [idx, setIdx] = useState(0);
  if (!images || images.length === 0) return null;
  return (
    <div className="fixed inset-0 z-[80] bg-black/90 flex items-center justify-center p-4">
      <button onClick={onClose} className="absolute top-4 right-4 text-white/80 hover:text-white">
        <X size={24} />
      </button>
      <button onClick={() => setIdx(i => Math.max(0, i-1))}
        className="absolute left-4 text-white/60 hover:text-white text-2xl px-4 py-2">‹</button>
      <img src={imgUrl(images[idx])} alt=""
        className="max-w-full max-h-full rounded-xl object-contain" />
      <button onClick={() => setIdx(i => Math.min(images.length-1, i+1))}
        className="absolute right-4 text-white/60 hover:text-white text-2xl px-4 py-2">›</button>
      <p className="absolute bottom-4 text-white/60 text-sm">{idx+1}/{images.length}</p>
    </div>
  );
}

// ── Step Popover (click trên roadmap) ────────────────────────────────────────
function StepPopover({ step, onClose }) {
  const [lightbox, setLightbox] = useState(null);
  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 space-y-3" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
              ${step.status==='COMPLETED'?'bg-emerald-500 text-white':'bg-black/10 text-[#8E8878]'}`}>
              {step.status==='COMPLETED'?'✓':step.stepSequence}
            </div>
            <p className="font-semibold text-sm text-[#1C1C1E]">{step.stepName}</p>
          </div>
          <button onClick={onClose} className="text-[#8E8878] hover:text-[#1C1C1E]"><X size={16}/></button>
        </div>
        {step.completedByName && (
          <div className="bg-emerald-50 rounded-xl px-3 py-2 text-xs space-y-0.5">
            <p className="font-medium text-emerald-700">✓ Đã xác nhận bởi {step.completedByName}</p>
            <p className="text-emerald-600">{fmtDateTime(step.completedAt)}</p>
          </div>
        )}
        {step.notes && <p className="text-xs text-[#8E8878] italic">{step.notes}</p>}
        {step.attachments?.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-[#8E8878] uppercase tracking-wider mb-2">Ảnh xác nhận ({step.attachments.length})</p>
            <div className="flex gap-2 flex-wrap">
              {step.attachments.map((url,i)=>(
                <button key={i} onClick={()=>setLightbox(step.attachments)}
                  className="w-16 h-16 rounded-lg overflow-hidden border border-black/10 hover:scale-105 transition-transform">
                  <img src={imgUrl(url)} alt="" className="w-full h-full object-cover"/>
                </button>
              ))}
            </div>
          </div>
        )}
        {!step.completedByName && step.status!=='COMPLETED' && (
          <p className="text-xs text-[#8E8878] italic">Bước chưa được thực hiện</p>
        )}
      </div>
      {lightbox && <ImageLightbox images={lightbox} onClose={()=>setLightbox(null)}/>}
    </div>
  );
}

// ── Live elapsed timer (từ startMs đến hiện tại, cập nhật mỗi giây) ──────────
function ElapsedTimer({ startMs }) {
  const [elapsed, setElapsed] = useState(Date.now() - startMs);
  useEffect(() => {
    const t = setInterval(() => setElapsed(Date.now() - startMs), 1000);
    return () => clearInterval(t);
  }, [startMs]);
  const totalSec = Math.floor(elapsed / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return <span className="tabular-nums text-blue-500">{h}:{String(m).padStart(2,'0')}:{String(s).padStart(2,'0')}</span>;
  return <span className="tabular-nums text-blue-500">{m}p{String(s).padStart(2,'0')}s</span>;
}

// ── Batch Roadmap Row (checkpoint timeline) ───────────────────────────────────
function BatchRoadmapRow({ batch, onBatchCancelClick, planBatchQty }) {
  const [selectedStep, setSelectedStep] = useState(null);
  const [showMaterials, setShowMaterials] = useState(false);
  const isCompleted = batch.status === 'COMPLETED';
  const isCancelled = batch.status === 'CANCELLED';
  const steps = batch.steps || [];

  // Find current in-progress step index
  const currentIdx = steps.findIndex((s,i)=>s.status!=='COMPLETED'&&steps.slice(0,i).every(x=>x.status==='COMPLETED'));

  // Badge màu theo sản lượng so với kế hoạch
  const planQty = Number(planBatchQty || batch.plannedQty || 0);
  const actualQty = Number(batch.actualOutputQty || 0);
  let qtyBadgeCls = 'bg-emerald-100 text-emerald-700';
  if (isCompleted && planQty > 0) {
    if (actualQty < planQty * 0.99) qtyBadgeCls = 'bg-orange-100 text-orange-700';
    else if (actualQty > planQty * 1.001) qtyBadgeCls = 'bg-emerald-700 text-white';
  }

  // Tổng thời gian hoàn thành: bước đầu → bước cuối (chỉ hiện khi isCompleted)
  const firstCompletedAt = steps.find(s => s.completedAt)?.completedAt;
  const lastCompletedAt = [...steps].reverse().find(s => s.completedAt)?.completedAt;
  const totalDurationLabel = (() => {
    if (!isCompleted || !firstCompletedAt || !lastCompletedAt) return null;
    const diffSec = Math.floor((Number(lastCompletedAt) - Number(firstCompletedAt)) / 1000);
    const h = Math.floor(diffSec / 3600);
    const m = Math.floor((diffSec % 3600) / 60);
    if (h > 0) return `${h}h${m}p`;
    return `${m}p`;
  })();

  return (
    <div className="space-y-1">
      {/* Batch header */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
          ${isCompleted?'bg-emerald-500 text-white':isCancelled?'bg-red-100 text-red-500':'bg-[#C9A84C]/20 text-[#C9A84C]'}`}>
          {batch.batchNumber||'?'}
        </div>
        <span className="text-xs font-semibold text-[#1C1C1E]">{batch.batchCode}</span>
        {isCompleted && (
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${qtyBadgeCls}`}>
            ✓ {fmtNum(batch.actualOutputQty)} {batch.outputUnit}
          </span>
        )}
        {/* Tổng thời gian hoàn thành mẻ */}
        {isCompleted && totalDurationLabel && (
          <span className="text-[10px] text-[#8E8878] bg-[#FAF7F2] px-2 py-0.5 rounded-full">
            ⏱ {totalDurationLabel}
          </span>
        )}
        {isCancelled && (
          <>
            <span className="text-[10px] text-red-500">🚫 Đã huỷ</span>
            {batch.cancellation && (
              <button onClick={()=>onBatchCancelClick&&onBatchCancelClick(batch)}
                className="text-[10px] text-red-500 underline">Xem lý do</button>
            )}
          </>
        )}
        {!isCompleted && !isCancelled && (
          <span className="text-[10px] text-[#8E8878]">{batch.completedSteps||0}/{batch.totalSteps||0} bước</span>
        )}
        {batch.batchMaterials?.length > 0 && (
          <button onClick={()=>setShowMaterials(v=>!v)}
            className="text-[10px] text-[#C9A84C] font-semibold underline flex items-center gap-0.5 ml-auto">
            Nguyên liệu mẻ này {showMaterials ? <ChevronUp size={10}/> : <ChevronDown size={10}/>}
          </button>
        )}
      </div>

      {/* Nguyên liệu riêng của mẻ này — expand/collapse */}
      {showMaterials && batch.batchMaterials?.length > 0 && (
        <div className="ml-9 mt-1.5 flex flex-wrap gap-1.5">
          {batch.batchMaterials.map((m,i) => (
            <span key={i} className="text-[10px] bg-[#FAF7F2] border border-black/10 rounded-full px-2 py-1 text-[#1C1C1E]">
              {m.materialName}: <b>{fmtNum(m.qty)} {m.unit}</b>
            </span>
          ))}
        </div>
      )}

      {/* Step checkpoint line */}
      {steps.length > 0 && (
        <div className="flex items-end px-[14px] pt-1">
          {steps.map((step,i)=>{
            const done = step.status==='COMPLETED';
            const isCur = i===currentIdx && !isCancelled && !isCompleted;
            const isFirst = i===0;
            const isLast = i===steps.length-1;

            // Bước trước đó (để lấy completedAt làm startMs cho đồng hồ bước hiện tại)
            const prevStep = i > 0 ? steps[i-1] : null;
            // Thời gian hiển thị dưới icon:
            // - Nếu done & batch chưa xong → hiện giờ hoàn thành (HH:mm)
            // - Nếu là bước hiện tại → đồng hồ đếm từ lúc bước trước xong
            // - Nếu batch đã xong → không hiện gì dưới icon
            const showCompletedTime = done && !isCompleted && step.completedAt;
            const showTimer = isCur && prevStep?.completedAt;

            return (
              <div key={step.id} className="flex items-end flex-1 min-w-0">
                {/* Connector trước dot */}
                {!isFirst && (
                  <div className={`flex-1 h-0.5 mb-[28px] ${steps[i-1].status==='COMPLETED'?'bg-emerald-400':'bg-black/10'}`}/>
                )}
                {/* Dot + label + time */}
                <div className="flex flex-col items-center flex-shrink-0">
                  <p className={`text-[9px] font-semibold text-center leading-tight mb-1 w-14 truncate
                    ${done?'text-emerald-600':isCur?'text-blue-500':'text-[#8E8878]'}`}
                    title={`B${step.stepSequence}: ${step.stepName}`}>
                    B{step.stepSequence}: {step.stepName}
                  </p>
                  <button
                    onClick={()=>setSelectedStep(step)}
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-all hover:scale-125
                      ${done?'bg-emerald-500 border-emerald-500 text-white'
                        :isCur?'bg-white border-blue-400 text-blue-500 animate-pulse shadow-md shadow-blue-200'
                        :isCancelled&&!done?'bg-white border-red-300 text-red-400'
                        :'bg-white border-black/15 text-[#8E8878]'}`}>
                    {done?'✓':step.stepSequence}
                  </button>
                  {/* Thời gian bên dưới icon */}
                  <div className="mt-1 h-4 flex items-center justify-center">
                    {showCompletedTime && (
                      <span className="text-[9px] text-emerald-600 tabular-nums">
                        {new Date(Number(step.completedAt)).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'})}
                      </span>
                    )}
                    {showTimer && (
                      <span className="text-[9px] font-semibold">
                        <ElapsedTimer startMs={Number(prevStep.completedAt)} />
                      </span>
                    )}
                  </div>
                </div>
                {/* Connector sau dot */}
                {!isLast && (
                  <div className={`flex-1 h-0.5 mb-[28px] ${done?'bg-emerald-400':'bg-black/10'}`}/>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Step popover */}
      {selectedStep && <StepPopover step={selectedStep} onClose={()=>setSelectedStep(null)}/>}
    </div>
  );
}

// ── Batch Cancel Info Modal ────────────────────────────────────────────────────
function BatchCancelModal({ batch, onClose }) {
  const [lightbox, setLightbox] = useState(null);
  const c = batch.cancellation;
  return (
    <>
      <Modal open title={`Huỷ mẻ ${batch.batchCode}`} onClose={onClose} size="sm"
        footer={<div className="flex justify-end"><SecondaryButton onClick={onClose}>Đóng</SecondaryButton></div>}>
        <div className="space-y-3">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-2">
            <p className="text-sm font-semibold text-red-700">🚫 Mẻ bị huỷ</p>
            <p className="text-sm text-red-600">{c.reason}</p>
            <p className="text-xs text-red-500">Hướng xử lý: {c.resolution==='REDO'?'Làm lại':c.resolution==='REPLACE'?'Mua thêm NVL':'Dừng hẳn'}</p>
            {c.resolutionNotes && <p className="text-xs text-red-500 italic">{c.resolutionNotes}</p>}
            {c.attachments?.length>0&&(
              <div className="flex gap-2 flex-wrap mt-2">
                {c.attachments.map((url,i)=>(
                  <button key={i} onClick={()=>setLightbox(c.attachments)}
                    className="w-16 h-16 rounded-lg overflow-hidden border border-red-200 hover:scale-105 transition-transform">
                    <img src={imgUrl(url)} alt="" className="w-full h-full object-cover"/>
                  </button>
                ))}
              </div>
            )}
            <p className="text-[10px] text-red-400">Huỷ bởi {c.cancelledByName} · {fmtDate(c.cancelledAt)}</p>
          </div>

          {/* Sản lượng thực tế thu được trước khi huỷ */}
          <div className="bg-[#FAF7F2] border border-black/5 rounded-xl p-4">
            <p className="text-xs font-semibold text-[#8E8878] uppercase tracking-wider mb-1">Sản lượng thực tế thu được</p>
            <p className="text-lg font-bold text-[#1C1C1E]">
              {fmtNum(c.actualOutputQty ?? 0)} {batch.outputUnit}
            </p>
          </div>

          {/* Chi tiết nguyên liệu đã sử dụng / hoàn kho */}
          {c.materialUsage?.length > 0 && (
            <div className="bg-white border border-black/5 rounded-xl p-4">
              <p className="text-xs font-semibold text-[#8E8878] uppercase tracking-wider mb-2">Nguyên liệu đã sử dụng</p>
              <div className="space-y-2">
                {c.materialUsage.map((m,i) => {
                  const returned = Math.max(0, Number(m.deductedQty||0) - Number(m.actualUsedQty||0));
                  return (
                    <div key={i} className="flex items-center justify-between text-xs border-b border-black/5 last:border-0 pb-2 last:pb-0">
                      <span className="font-medium text-[#1C1C1E]">{m.materialName}</span>
                      <div className="text-right">
                        <p className="text-[#1C1C1E]">Đã dùng: <b>{fmtNum(m.actualUsedQty)} {m.unit}</b></p>
                        <p className="text-[#8E8878]">Đã lấy từ kho: {fmtNum(m.deductedQty)} {m.unit}</p>
                        {returned > 0 && (
                          <p className="text-emerald-600">↩ Hoàn kho: {fmtNum(returned)} {m.unit}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {(!c.materialUsage || c.materialUsage.length === 0) && (
            <p className="text-xs text-[#8E8878] italic px-1">
              Mẻ này chưa trừ kho nguyên liệu nào (chưa bắt đầu sản xuất hoặc không dùng NVL từ kho xưởng).
            </p>
          )}
        </div>
      </Modal>
      {lightbox&&<ImageLightbox images={lightbox} onClose={()=>setLightbox(null)}/>}
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function OwnerWorkOrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { role } = useAuth();
  const isSuperFactoryWorker = role === 'SUPER_FACTORY_WORKER';
  const basePath = isSuperFactoryWorker ? '/super-factory/production' : '/owner/production';
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useMinLoading(true);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [showExtend, setShowExtend] = useState(false);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    setLoading(true);
    ownerProdApi.getWorkOrderDetail(Number(id))
      .then(setDetail)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading && !detail) return <div className="p-8"><CardSkeleton lines={6} /></div>;
  if (!detail) return <div className="p-8 text-[#8E8878]">Không tìm thấy lệnh sản xuất</div>;

  const { workOrder: wo, plan, batches, progressPct, currentBatchNumber, currentStepName, packagingLoss } = detail;
  const color = progressColor(progressPct);
  const totalSteps = plan?.batchSteps?.length || 0;

  // SUPER_FACTORY_WORKER chỉ xem chi tiết, không thao tác phát hành/gia hạn/huỷ lệnh
  const canCancel = !isSuperFactoryWorker && ['SCHEDULED','PENDING_PLAN','PLANNED'].includes(wo.status);
  const canRelease = !isSuperFactoryWorker && wo.status === 'SCHEDULED';
  const canExtend = !isSuperFactoryWorker && ['SCHEDULED','PENDING_PLAN','PLANNED','IN_PROGRESS'].includes(wo.status);

  const doAction = async (status) => {
    setActing(true);
    try {
      await ownerProdApi.updateWorkOrderStatus(wo.id, { status });
      const updated = await ownerProdApi.getWorkOrderDetail(wo.id);
      setDetail(updated);
    } finally { setActing(false); setConfirmCancel(false); }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(basePath)}
          className="p-2 rounded-xl hover:bg-[#FAF7F2] text-[#8E8878] hover:text-[#1C1C1E] transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-[#1C1C1E] font-mono">{wo.workOrderCode}</h1>
            <StatusBadge status={wo.status} />
            {wo.productionFactoryName && (
              <span className="inline-flex items-center gap-1 text-xs font-medium bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full border border-blue-100">
                <Factory size={11} /> {wo.productionFactoryName}
              </span>
            )}
          </div>
          <p className="text-sm text-[#8E8878]">
            {wo.productName}
            {wo.planTitle && <> · <span className="text-[#C9A84C]">{wo.planTitle}</span></>}
          </p>
        </div>
        <div className="flex gap-2">
          {canRelease && (
            <PrimaryButton onClick={() => doAction('PENDING_PLAN')} loading={acting}>
              Phát hành lệnh
            </PrimaryButton>
          )}
          {canExtend && (
            <SecondaryButton onClick={() => setShowExtend(true)}>
              Gia hạn
            </SecondaryButton>
          )}
          {canCancel && (
            <DangerButton onClick={() => setConfirmCancel(true)} loading={acting}>
              Huỷ lệnh
            </DangerButton>
          )}
        </div>
      </div>

      {/* Metrics — chỉ hiện cho Owner, SUPER_FACTORY_WORKER chỉ xem chi tiết */}
      {!isSuperFactoryWorker && (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Progress ring */}
        <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-5 flex items-center gap-4">
          <div className="relative">
            <ProgressRing pct={progressPct} size={72} />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-sm font-bold ${color.text}`}>
                {Number(progressPct || 0).toFixed(0)}%
              </span>
            </div>
          </div>
          <div>
            <p className="text-xs text-[#8E8878]">Tiến độ</p>
            <p className="font-bold text-[#1C1C1E]">{fmtNum(wo.accumulatedQty)}</p>
            <p className="text-xs text-[#8E8878]">/ {fmtNum(wo.plannedQty)} {wo.outputUnit}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-5">
          <p className="text-xs text-[#8E8878]">Mẻ hiện tại</p>
          <p className="text-2xl font-bold text-[#1C1C1E] mt-1">
            {currentBatchNumber > 0 ? `#${currentBatchNumber}` : '—'}
          </p>
          <p className="text-xs text-[#8E8878] mt-0.5">
            {currentStepName ? `Bước: ${currentStepName}` : 'Chưa bắt đầu'}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-5">
          <p className="text-xs text-[#8E8878]">Thời gian</p>
          <p className="text-sm font-semibold text-[#1C1C1E] mt-1">{fmtDate(wo.scheduledStartDate)}</p>
          <p className="text-xs text-[#8E8878]">→ {fmtDate(wo.plannedEndDate)}</p>
        </div>

        <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-5">
          <p className="text-xs text-[#8E8878]">Mẻ sản xuất</p>
          <p className="text-2xl font-bold text-[#1C1C1E] mt-1">
            {wo.completedBatches}/{plan?.totalBatches || wo.totalBatches || '?'}
          </p>
          <p className="text-xs text-[#8E8878] mt-0.5">
            {wo.cancelledBatches > 0 && <span className="text-red-500">{wo.cancelledBatches} bị huỷ</span>}
            {wo.inProgressBatches > 0 && <span className="text-orange-500"> {wo.inProgressBatches} đang làm</span>}
          </p>
        </div>
      </div>
      )}

      {/* Card Hao hụt đóng gói — chỉ hiện khi TẤT CẢ mẻ đã hoàn thành và đã đối soát đủ
          (packagingLoss null nếu còn mẻ chưa xong, hoặc chưa chuyển/chưa xác nhận hết kho TP) */}
      {!isSuperFactoryWorker && packagingLoss && (
        <div className={`rounded-2xl border shadow-sm p-5 ${packagingLoss.lossQty > 0 ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
          <div className="flex items-center gap-2 mb-3">
            <FileWarning size={16} className={packagingLoss.lossQty > 0 ? 'text-amber-600' : 'text-emerald-600'} />
            <p className={`text-sm font-semibold ${packagingLoss.lossQty > 0 ? 'text-amber-800' : 'text-emerald-800'}`}>
              Hao hụt đóng gói (sau khi nhập kho thành phẩm)
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-[#8E8878]">Sản lượng thực tế</p>
              <p className="text-lg font-bold text-[#1C1C1E] mt-0.5">{fmtNum(packagingLoss.totalActualOutputQty)} {wo.outputUnit}</p>
            </div>
            <div>
              <p className="text-xs text-[#8E8878]">Đã nhập kho TP</p>
              <p className="text-lg font-bold text-[#1C1C1E] mt-0.5">
                {fmtNum(packagingLoss.totalPackagedQty)} {packagingLoss.packagedUnit}
              </p>
              <p className="text-xs text-[#8E8878]">({fmtNum(packagingLoss.totalActualReceivedWeight)} {wo.outputUnit})</p>
            </div>
            <div>
              <p className="text-xs text-[#8E8878]">Trọng lượng hao hụt</p>
              <p className={`text-lg font-bold mt-0.5 ${packagingLoss.lossQty > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                {fmtNum(packagingLoss.lossQty)} {wo.outputUnit}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#8E8878]">Tỷ lệ hao hụt</p>
              <p className={`text-lg font-bold mt-0.5 ${packagingLoss.lossQty > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                {Number(packagingLoss.lossPct || 0).toFixed(2)}%
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Roadmap mẻ */}
        <div className="lg:col-span-2 space-y-4">
          <SectionCard>
            <SectionHeader title={`Tiến độ từng mẻ (${batches?.length || 0} mẻ)`} />
            <div className="p-4 space-y-4">
              {(!batches || batches.length === 0) ? (
                <p className="text-sm text-[#8E8878] italic text-center py-8">
                  {wo.status === 'IN_PROGRESS' ? 'Chưa có mẻ nào được bắt đầu' : 'Lệnh chưa bắt đầu sản xuất'}
                </p>
              ) : (
                batches.map(b => (
                  <BatchRoadmapRow key={b.id} batch={b}
                    planBatchQty={
                      Array.isArray(plan?.batchQtyPerRunList) && plan.batchQtyPerRunList[(b.batchNumber||1)-1] != null
                        ? plan.batchQtyPerRunList[(b.batchNumber||1)-1]
                        : plan?.batchQtyPerRun
                    }
                    onBatchCancelClick={setSelectedBatch} />
                ))
              )}
            </div>
          </SectionCard>
        </div>

        {/* Right: Plan details */}
        <div className="space-y-4">
          {/* Phương án sản xuất */}
          {plan ? (
            <SectionCard>
              <SectionHeader title="Phương án sản xuất" />
              <div className="p-4 space-y-3 text-sm">
                {plan.recipeName && (
                  <div className="flex justify-between">
                    <span className="text-[#8E8878]">Biến thể sản xuất</span>
                    <span className="font-semibold text-[#1C1C1E]">{plan.recipeName}</span>
                  </div>
                )}
                {plan.requestedQty != null && (
                  <div className="flex justify-between">
                    <span className="text-[#8E8878]">Sản lượng yêu cầu</span>
                    <span className="font-semibold">{fmtNum(plan.requestedQty)} {wo.outputUnit}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-[#8E8878]">Số mẻ</span>
                  <span className="font-semibold">{plan.totalBatches} mẻ</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8E8878]">Mỗi mẻ (chuẩn)</span>
                  <span className="font-semibold">{fmtNum(plan.batchQtyPerRun)} {wo.outputUnit}</span>
                </div>
                {plan.totalEstimatedCost > 0 && (
                  <div className="flex justify-between">
                    <span className="text-[#8E8878]">Chi phí ước tính</span>
                    <span className="font-semibold text-amber-600">{fmtCurrency(plan.totalEstimatedCost)}</span>
                  </div>
                )}
                <div className="text-xs text-[#8E8878]">Lập bởi: {plan.submittedByName}</div>

                {/* Bước sản xuất */}
                {plan.batchSteps?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-[#8E8878] uppercase tracking-wider mb-2">Các bước (chung cho mọi mẻ)</p>
                    <div className="space-y-1">
                      {plan.batchSteps.map((step, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <span className="w-5 h-5 rounded-full bg-[#FAF7F2] border border-black/10 flex items-center justify-center text-[10px] font-bold text-[#8E8878]">{i+1}</span>
                          <span className="text-[#1C1C1E]">{step}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </SectionCard>
          ) : (
            <SectionCard>
              <div className="p-6 text-center">
                <Clock size={24} className="mx-auto text-[#8E8878] mb-2" />
                <p className="text-sm text-[#8E8878]">
                  {wo.status === 'PENDING_PLAN'
                    ? 'Đang chờ nhân viên xưởng lập phương án'
                    : 'Chưa có phương án sản xuất'}
                </p>
                {wo.planDeadline && (
                  <p className="text-xs text-amber-600 mt-1">Deadline: {fmtDate(wo.planDeadline)}</p>
                )}
              </div>
            </SectionCard>
          )}

          {/* Nguyên liệu */}
          {plan?.materials?.length > 0 && (
            <SectionCard>
              <SectionHeader title="Nguyên liệu dùng chung (cả lệnh)" />
              <div className="divide-y divide-black/5">
                {plan.materials.map(m => (
                  <div key={m.id} className="px-4 py-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium text-[#1C1C1E]">{m.materialName}</p>
                        <p className="text-xs text-[#8E8878]">{fmtNum(m.quantity)} {m.unit}</p>
                        {m.vendorName && <p className="text-xs text-[#8E8878]">{m.vendorName}</p>}
                      </div>
                      {m.estimatedTotal && (
                        <span className="text-xs font-semibold text-[#C9A84C]">{fmtCurrency(m.estimatedTotal)}</span>
                      )}
                    </div>
                    {/* Invoice images */}
                    {m.invoiceImages?.length > 0 && (
                      <div className="flex gap-1.5 mt-2">
                        {m.invoiceImages.map((url, i) => (
                          <img key={i} src={imgUrl(url)} alt=""
                            className="w-10 h-10 rounded-lg object-cover border border-black/10 cursor-pointer hover:scale-110 transition-transform" />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </SectionCard>
          )}
        </div>
      </div>

      {/* Batch cancel detail modal */}
      {selectedBatch && selectedBatch.cancellation && (
        <BatchCancelModal batch={selectedBatch} onClose={() => setSelectedBatch(null)} />
      )}

      {/* Extend deadline */}
      {showExtend && <ExtendWorkOrderModal wo={wo} onClose={() => setShowExtend(false)}
        onSaved={async () => { setShowExtend(false); const updated = await ownerProdApi.getWorkOrderDetail(wo.id); setDetail(updated); }} />}

      {/* Confirm cancel */}
      {confirmCancel && (
        <Modal open title="Huỷ lệnh sản xuất" onClose={() => setConfirmCancel(false)} size="sm"
          footer={
            <div className="flex justify-end gap-2">
              <SecondaryButton onClick={() => setConfirmCancel(false)}>Không</SecondaryButton>
              <DangerButton onClick={() => doAction('CANCELLED')} loading={acting}>Xác nhận huỷ</DangerButton>
            </div>
          }>
          <p className="text-sm text-[#1C1C1E]">
            Bạn có chắc muốn huỷ lệnh <strong>{wo.workOrderCode}</strong>?
            Hành động này không thể hoàn tác.
          </p>
        </Modal>
      )}
    </div>
  );
}