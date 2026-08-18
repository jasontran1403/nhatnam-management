// src/pages/owner/OwnerWorkOrderDetailPage.jsx
// Chi tiết lệnh sản xuất: metrics, Gantt mẻ, ảnh xác nhận từng bước
import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft, CheckCircle2, Clock, AlertTriangle, Package,
  ChevronDown, ChevronUp, Image, X, Loader2, Users, ShoppingCart, Factory, FileWarning,
} from 'lucide-react';
import useMinLoading from '../../hooks/useMinLoading';
import { CardSkeleton } from '../../components/ui/Skeleton';
import Modal from '../../components/ui/Modal';
import {
  SectionCard, SectionHeader, SecondaryButton, PrimaryButton,
  DangerButton, inputCls,
} from '../../components/ui';
import { Badge } from '../../components/ui/Badge';
import {
  ownerProdApi, getStatusLabels, progressColor,
} from '../../api/productionModuleApi';
import { useLang } from '../../context/LangContext';
import { useFmt } from '../../utils/useFmt';
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

// fmtDateTime removed — use useFmt()

function StatusBadge({ status }) {
  const { t } = useLang();
  const cfg = getStatusLabels(t)[status] || { label: status, cls: 'bg-surface-2 text-ink-2' };
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
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--c-line)" strokeWidth={6} />
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
  const { t } = useLang();
  const { fmtDateTime } = useFmt();
  const [lightbox, setLightbox] = useState(null);
  const done    = step.status === 'COMPLETED';
  const running = step.status === 'IN_PROGRESS';
  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div className="relative bg-surface rounded-2xl shadow-xl w-full max-w-sm p-5 space-y-3" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
              ${done?'bg-emerald-500 text-white':running?'bg-blue-100 dark:bg-blue-500/18 text-blue-600 dark:text-blue-300':'bg-hairline-2 text-muted'}`}>
              {done?'✓':step.stepSequence}
            </div>
            <p className="font-semibold text-sm text-ink">{step.stepName}</p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-ink"><X size={16}/></button>
        </div>
        {/* Đang thực hiện — hiện người bắt đầu + đồng hồ chạy từ startedAt */}
        {running && (
          <div className="bg-blue-50 dark:bg-blue-500/10 rounded-xl px-3 py-2 text-xs space-y-0.5">
            <p className="font-medium text-blue-700 dark:text-blue-300">
              {t('production','wodt_started_by',{name:step.startedByName||'—'})}
            </p>
            {Number(step.startedAt) > 0 && (
              <p className="text-blue-600 dark:text-blue-300">
                {fmtDateTime(step.startedAt)} · <ElapsedTimer startMs={Number(step.startedAt)} limitMin={step.durationMinutes} />
              </p>
            )}
          </div>
        )}
        {done && step.completedByName && (
          <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-xl px-3 py-2 text-xs space-y-0.5">
            <p className="font-medium text-emerald-700 dark:text-emerald-300">{t('production','wodt_confirmed_by',{name:step.completedByName})}</p>
            <p className="text-emerald-600 dark:text-emerald-300">{fmtDateTime(step.completedAt)}</p>
          </div>
        )}
        {step.notes && <p className="text-xs text-muted italic">{step.notes}</p>}
        {step.attachments?.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-2">{t('production','wodt_photos',{n:step.attachments.length})}</p>
            <div className="flex gap-2 flex-wrap">
              {step.attachments.map((url,i)=>(
                <button key={i} onClick={()=>setLightbox(step.attachments)}
                  className="w-16 h-16 rounded-lg overflow-hidden border border-hairline-2 hover:scale-105 transition-transform">
                  <img src={imgUrl(url)} alt="" className="w-full h-full object-cover"/>
                </button>
              ))}
            </div>
          </div>
        )}
        {!done && !running && (
          <p className="text-xs text-muted italic">{t('production','wodt_step_not_done')}</p>
        )}
      </div>
      {lightbox && <ImageLightbox images={lightbox} onClose={()=>setLightbox(null)}/>}
    </div>
  );
}

// ── Live elapsed timer ────────────────────────────────────────────────────────
// CHỈ dùng cho bước ĐANG THỰC HIỆN (status = IN_PROGRESS), đếm từ startedAt của
// chính bước đó. KHÔNG được đếm từ completedAt của bước trước — đó là thời gian
// CHỜ, không phải thời gian làm.
// limitMin (tuỳ chọn): thời gian dự kiến của bước → quá giờ thì đổi màu đỏ.
function ElapsedTimer({ startMs, limitMin }) {
  const valid = Number.isFinite(startMs) && startMs > 0;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!valid) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [valid, startMs]);
  if (!valid) return null;

  const totalSec = Math.max(0, Math.floor((now - startMs) / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const overdue = Number(limitMin) > 0 && totalSec > Number(limitMin) * 60;
  const cls = `tabular-nums ${overdue ? 'text-red-500' : 'text-blue-500'}`;
  if (h > 0) return <span className={cls}>{h}:{String(m).padStart(2,'0')}:{String(s).padStart(2,'0')}</span>;
  return <span className={cls}>{m}p{String(s).padStart(2,'0')}s</span>;
}

// ── Batch Roadmap Row (checkpoint timeline) ───────────────────────────────────
function BatchRoadmapRow({ batch, onBatchCancelClick, planBatchQty }) {
  const { t } = useLang();
  const { fmtNum } = useFmt();
  const [selectedStep, setSelectedStep] = useState(null);
  const [showMaterials, setShowMaterials] = useState(false);
  const isCompleted = batch.status === 'COMPLETED';
  const isCancelled = batch.status === 'CANCELLED';
  const steps = batch.steps || [];

  // Bước ĐANG THỰC HIỆN THẬT SỰ (đã bấm "Bắt đầu" → IN_PROGRESS)
  const runningIdx = steps.findIndex(s => s.status === 'IN_PROGRESS');
  // Bước KẾ TIẾP sẵn sàng làm (chưa bắt đầu, các bước trước đã xong) — chỉ tô nhạt, KHÔNG đếm giờ
  const nextIdx = steps.findIndex((s,i) => s.status === 'PENDING' && steps.slice(0,i).every(x => x.status === 'COMPLETED'));

  // Badge màu theo sản lượng so với kế hoạch
  const planQty = Number(planBatchQty || batch.plannedQty || 0);
  const actualQty = Number(batch.actualOutputQty || 0);
  let qtyBadgeCls = 'bg-emerald-100 dark:bg-emerald-500/18 text-emerald-700 dark:text-emerald-300';
  if (isCompleted && planQty > 0) {
    if (actualQty < planQty * 0.99) qtyBadgeCls = 'bg-orange-100 dark:bg-orange-500/18 text-orange-700 dark:text-orange-300';
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
          ${isCompleted?'bg-emerald-500 text-white':isCancelled?'bg-red-100 dark:bg-red-500/18 text-red-500':'bg-gold/20 text-gold'}`}>
          {batch.batchNumber||'?'}
        </div>
        <span className="text-xs font-semibold text-ink">{batch.batchCode}</span>
        {isCompleted && (
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${qtyBadgeCls}`}>
            ✓ {fmtNum(batch.actualOutputQty)} {batch.outputUnit}
          </span>
        )}
        {/* Tổng thời gian hoàn thành mẻ */}
        {isCompleted && totalDurationLabel && (
          <span className="text-[10px] text-muted bg-canvas px-2 py-0.5 rounded-full">
            ⏱ {totalDurationLabel}
          </span>
        )}
        {isCancelled && (
          <>
            <span className="text-[10px] text-red-500">{t('production','wodt_cancelled')}</span>
            {batch.cancellation && (
              <button onClick={()=>onBatchCancelClick&&onBatchCancelClick(batch)}
                className="text-[10px] text-red-500 underline">{t('production','wodt_view_reason')}</button>
            )}
          </>
        )}
        {!isCompleted && !isCancelled && (
          <span className="text-[10px] text-muted">{t('production','wodt_steps_progress',{done:batch.completedSteps||0,total:batch.totalSteps||0})}</span>
        )}
        {batch.batchMaterials?.length > 0 && (
          <button onClick={()=>setShowMaterials(v=>!v)}
            className="text-[10px] text-gold font-semibold underline flex items-center gap-0.5 ml-auto">
            Nguyên liệu mẻ này {showMaterials ? <ChevronUp size={10}/> : <ChevronDown size={10}/>}
          </button>
        )}
      </div>

      {/* Nguyên liệu riêng của mẻ này — expand/collapse */}
      {showMaterials && batch.batchMaterials?.length > 0 && (
        <div className="ml-9 mt-1.5 flex flex-wrap gap-1.5">
          {batch.batchMaterials.map((m,i) => (
            <span key={i} className="text-[10px] bg-canvas border border-hairline-2 rounded-full px-2 py-1 text-ink">
              {m.materialName}: <b>{fmtNum(m.qty)} {m.unit}</b>
            </span>
          ))}
        </div>
      )}

      {/* Step checkpoint line */}
      {steps.length > 0 && (
        <div className="flex items-end px-[14px] pt-1">
          {steps.map((step,i)=>{
            const done    = step.status==='COMPLETED';
            const active  = !isCancelled && !isCompleted;
            // Đang chạy: BE nói IN_PROGRESS và có mốc startedAt
            const isRunning = active && i===runningIdx && step.status==='IN_PROGRESS';
            // Sẵn sàng nhưng CHƯA bấm bắt đầu → không đếm giờ
            const isNext    = active && !isRunning && i===nextIdx;
            const isFirst = i===0;
            const isLast  = i===steps.length-1;

            // Thời gian hiển thị dưới icon:
            // - done  → giờ hoàn thành (HH:mm)
            // - đang chạy → đồng hồ đếm từ startedAt CỦA CHÍNH BƯỚC ĐÓ
            // - chưa bắt đầu → không hiện gì (trước đây đếm nhầm từ completedAt bước trước)
            const showCompletedTime = done && !isCompleted && step.completedAt;
            const showTimer = isRunning && Number(step.startedAt) > 0;

            return (
              <div key={step.id} className="flex items-end flex-1 min-w-0">
                {/* Connector trước dot */}
                {!isFirst && (
                  <div className={`flex-1 h-0.5 mb-[28px] ${steps[i-1].status==='COMPLETED'?'bg-emerald-400':'bg-hairline-2'}`}/>
                )}
                {/* Dot + label + time */}
                <div className="flex flex-col items-center flex-shrink-0">
                  <p className={`text-[9px] font-semibold text-center leading-tight mb-1 w-14 truncate
                    ${done?'text-emerald-600 dark:text-emerald-300':isRunning?'text-blue-500':isNext?'text-gold':'text-muted'}`}
                    title={`B${step.stepSequence}: ${step.stepName}`}>
                    B{step.stepSequence}: {step.stepName}
                  </p>
                  <button
                    onClick={()=>setSelectedStep(step)}
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-all hover:scale-125
                      ${done?'bg-emerald-500 border-emerald-500 text-white'
                        :isRunning?'bg-surface border-blue-400 text-blue-500 animate-pulse shadow-md shadow-blue-200'
                        :isNext?'bg-surface border-gold border-dashed text-gold'
                        :isCancelled?'bg-surface border-red-300 dark:border-red-500/35 text-red-400'
                        :'bg-surface border-hairline-3 text-muted'}`}>
                    {done?'✓':step.stepSequence}
                  </button>
                  {/* Thời gian bên dưới icon */}
                  <div className="mt-1 h-4 flex items-center justify-center">
                    {showCompletedTime && (
                      <span className="text-[9px] text-emerald-600 dark:text-emerald-300 tabular-nums">
                        {new Date(Number(step.completedAt)).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}
                      </span>
                    )}
                    {showTimer && (
                      <span className="text-[9px] font-semibold">
                        <ElapsedTimer startMs={Number(step.startedAt)} limitMin={step.durationMinutes} />
                      </span>
                    )}
                    {/* {!showCompletedTime && !showTimer && isNext && (
                      <span className="text-[9px] text-gold">{t('production','wodt_step_waiting')}</span>
                    )} */}
                  </div>
                </div>
                {/* Connector sau dot */}
                {!isLast && (
                  <div className={`flex-1 h-0.5 mb-[28px] ${done?'bg-emerald-400':'bg-hairline-2'}`}/>
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
  const { t } = useLang();
  const { fmtNum, fmtDate } = useFmt();
  const [lightbox, setLightbox] = useState(null);
  const c = batch.cancellation;
  return (
    <>
      <Modal open title={t('production','wodt_cancel_batch_title',{code:batch.batchCode})} onClose={onClose} size="sm"
        footer={<div className="flex justify-end"><SecondaryButton onClick={onClose}>{t('common','close')}</SecondaryButton></div>}>
        <div className="space-y-3">
          <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/28 rounded-xl p-4 space-y-2">
            <p className="text-sm font-semibold text-red-700 dark:text-red-300">{t('production','wodt_batch_cancelled')}</p>
            <p className="text-sm text-red-600 dark:text-red-300">{c.reason}</p>
            <p className="text-xs text-red-500">{t('production','wodt_resolution')}: {c.resolution==='REDO'?t('production','wodt_redo'):c.resolution==='REPLACE'?t('production','wodt_replace'):t('production','wodt_stop')}</p>
            {c.resolutionNotes && <p className="text-xs text-red-500 italic">{c.resolutionNotes}</p>}
            {c.attachments?.length>0&&(
              <div className="flex gap-2 flex-wrap mt-2">
                {c.attachments.map((url,i)=>(
                  <button key={i} onClick={()=>setLightbox(c.attachments)}
                    className="w-16 h-16 rounded-lg overflow-hidden border border-red-200 dark:border-red-500/28 hover:scale-105 transition-transform">
                    <img src={imgUrl(url)} alt="" className="w-full h-full object-cover"/>
                  </button>
                ))}
              </div>
            )}
            <p className="text-[10px] text-red-400">Huỷ bởi {c.cancelledByName} · {fmtDate(c.cancelledAt)}</p>
          </div>

          {/* Sản lượng thực tế thu được trước khi huỷ */}
          <div className="bg-canvas border border-hairline rounded-xl p-4">
            <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">{t('production','wodt_actual_output')}</p>
            <p className="text-lg font-bold text-ink">
              {fmtNum(c.actualOutputQty ?? 0)} {batch.outputUnit}
            </p>
          </div>

          {/* Chi tiết nguyên liệu đã sử dụng / hoàn kho */}
          {c.materialUsage?.length > 0 && (
            <div className="bg-surface border border-hairline rounded-xl p-4">
              <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">{t('production','wodt_materials_used')}</p>
              <div className="space-y-2">
                {c.materialUsage.map((m,i) => {
                  const returned = Math.max(0, Number(m.deductedQty||0) - Number(m.actualUsedQty||0));
                  return (
                    <div key={i} className="flex items-center justify-between text-xs border-b border-hairline last:border-0 pb-2 last:pb-0">
                      <span className="font-medium text-ink">{m.materialName}</span>
                      <div className="text-right">
                        <p className="text-ink">{t('production','wodt_used')}: <b>{fmtNum(m.actualUsedQty)} {m.unit}</b></p>
                        <p className="text-muted">{t('production','wodt_deducted')}: {fmtNum(m.deductedQty)} {m.unit}</p>
                        {returned > 0 && (
                          <p className="text-emerald-600 dark:text-emerald-300">{t('production','wodt_returned')}: {fmtNum(returned)} {m.unit}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {(!c.materialUsage || c.materialUsage.length === 0) && (
            <p className="text-xs text-muted italic px-1">
              {t('production','wodt_no_materials_deducted')}
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
  const { t } = useLang();
  const { fmtDate, fmtNum, fmtCurrency, fmtDateTime } = useFmt();
  const { id } = useParams();
  const navigate = useNavigate();
  const { role } = useAuth();
  const isSuperFactoryWorker = role === 'SUPER_FACTORY_WORKER';
  /**
   * Khu vực hiện tại suy từ URL, KHÔNG suy từ role.
   *
   * <p>Trang này được mount ở /owner, /admin, /seller và /super-factory. Suy từ role thì
   * seller đang đứng ở /seller/production/plans/1 bấm quay lại sẽ bị đẩy sang
   * /owner/production — route không tồn tại với họ nên router đá về dashboard.
   *
   * <p>Suy từ URL cũng đúng hơn cho tài khoản mang nhiều role cùng lúc: họ chỉ đang
   * đứng ở đúng một khu vực, và nút quay lại phải trả về chính khu vực đó.
   */
  const { pathname } = useLocation();
  const basePath =
      pathname.startsWith('/super-factory') ? '/super-factory/production'
    : pathname.startsWith('/seller')        ? '/seller/production'
    : pathname.startsWith('/admin')         ? '/admin/production'
    : '/owner/production';
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
  if (!detail) return <div className="p-8 text-muted">{t('production','wodt_not_found')}</div>;

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
          className="p-2 rounded-xl hover:bg-canvas text-muted hover:text-ink transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-ink font-mono">{wo.workOrderCode}</h1>
            <StatusBadge status={wo.status} />
            {wo.productionFactoryName && (
              <span className="inline-flex items-center gap-1 text-xs font-medium bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 px-2.5 py-1 rounded-full border border-blue-100 dark:border-blue-500/18">
                <Factory size={11} /> {wo.productionFactoryName}
              </span>
            )}
          </div>
          <p className="text-sm text-muted">
            {wo.productName}
            {wo.planTitle && <> · <span className="text-gold">{wo.planTitle}</span></>}
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
        <div className="bg-surface rounded-2xl border border-hairline shadow-sm p-5 flex items-center gap-4">
          <div className="relative">
            <ProgressRing pct={progressPct} size={72} />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-sm font-bold ${color.text}`}>
                {Number(progressPct || 0).toFixed(0)}%
              </span>
            </div>
          </div>
          <div>
            <p className="text-xs text-muted">{t('production','plandt_progress')}</p>
            <p className="font-bold text-ink">{fmtNum(wo.accumulatedQty)}</p>
            <p className="text-xs text-muted">/ {fmtNum(wo.plannedQty)} {wo.outputUnit}</p>
          </div>
        </div>

        <div className="bg-surface rounded-2xl border border-hairline shadow-sm p-5">
          <p className="text-xs text-muted">{t('production','wodt_current_batch')}</p>
          <p className="text-2xl font-bold text-ink mt-1">
            {currentBatchNumber > 0 ? `#${currentBatchNumber}` : '—'}
          </p>
          <p className="text-xs text-muted mt-0.5">
            {currentStepName ? t('production','wodt_current_step',{name:currentStepName}) : t('production','wodt_not_started')}
          </p>
        </div>

        <div className="bg-surface rounded-2xl border border-hairline shadow-sm p-5">
          <p className="text-xs text-muted">{t('common','time')}</p>
          <p className="text-sm font-semibold text-ink mt-1">{fmtDate(wo.scheduledStartDate)}</p>
          <p className="text-xs text-muted">→ {fmtDate(wo.plannedEndDate)}</p>
        </div>

        <div className="bg-surface rounded-2xl border border-hairline shadow-sm p-5">
          <p className="text-xs text-muted">{t('production','wodt_batches')}</p>
          <p className="text-2xl font-bold text-ink mt-1">
            {wo.completedBatches}/{plan?.totalBatches || wo.totalBatches || '?'}
          </p>
          <p className="text-xs text-muted mt-0.5">
            {wo.cancelledBatches > 0 && <span className="text-red-500">{wo.cancelledBatches} bị huỷ</span>}
            {wo.inProgressBatches > 0 && <span className="text-orange-500"> {wo.inProgressBatches} đang làm</span>}
          </p>
        </div>
      </div>
      )}

      {/* Card Hao hụt đóng gói — chỉ hiện khi TẤT CẢ mẻ đã hoàn thành và đã đối soát đủ
          (packagingLoss null nếu còn mẻ chưa xong, hoặc chưa chuyển/chưa xác nhận hết kho TP) */}
      {!isSuperFactoryWorker && packagingLoss && (
        <div className={`rounded-2xl border shadow-sm p-5 ${packagingLoss.lossQty > 0 ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/28' : 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/28'}`}>
          <div className="flex items-center gap-2 mb-3">
            <FileWarning size={16} className={packagingLoss.lossQty > 0 ? 'text-amber-600 dark:text-amber-300' : 'text-emerald-600 dark:text-emerald-300'} />
            <p className={`text-sm font-semibold ${packagingLoss.lossQty > 0 ? 'text-amber-800 dark:text-amber-300' : 'text-emerald-800 dark:text-emerald-300'}`}>
              Hao hụt đóng gói (sau khi nhập kho thành phẩm)
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted">{t('production','batchrv_actual_output')}</p>
              <p className="text-lg font-bold text-ink mt-0.5">{fmtNum(packagingLoss.totalActualOutputQty)} {wo.outputUnit}</p>
            </div>
            <div>
              <p className="text-xs text-muted">{t('production','wodt_entered_fg')}</p>
              <p className="text-lg font-bold text-ink mt-0.5">
                {fmtNum(packagingLoss.totalPackagedQty)} {packagingLoss.packagedUnit}
              </p>
              <p className="text-xs text-muted">({fmtNum(packagingLoss.totalActualReceivedWeight)} {wo.outputUnit})</p>
            </div>
            <div>
              <p className="text-xs text-muted">{t('production','wodt_loss_weight')}</p>
              <p className={`text-lg font-bold mt-0.5 ${packagingLoss.lossQty > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
                {fmtNum(packagingLoss.lossQty)} {wo.outputUnit}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted">{t('production','wodt_loss_pct')}</p>
              <p className={`text-lg font-bold mt-0.5 ${packagingLoss.lossQty > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
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
            <SectionHeader title={t('production','wodt_batch_progress',{n:batches?.length||0})} />
            <div className="p-4 space-y-4">
              {(!batches || batches.length === 0) ? (
                <p className="text-sm text-muted italic text-center py-8">
                  {wo.status === 'IN_PROGRESS' ? t('production','wodt_no_batch_started') : t('production','wodt_order_not_started')}
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
              <SectionHeader title={t('production','wodt_plan_title')} />
              <div className="p-4 space-y-3 text-sm">
                {plan.recipeName && (
                  <div className="flex justify-between">
                    <span className="text-muted">{t('production','wodt_recipe_variant')}</span>
                    <span className="font-semibold text-ink">{plan.recipeName}</span>
                  </div>
                )}
                {plan.requestedQty != null && (
                  <div className="flex justify-between">
                    <span className="text-muted">{t('production','wodt_requested_qty')}</span>
                    <span className="font-semibold">{fmtNum(plan.requestedQty)} {wo.outputUnit}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted">{t('production','wodt_total_batches')}</span>
                  <span className="font-semibold">{t('production','wodt_n_batches',{n:plan.totalBatches})}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">{t('production','wodt_qty_per_batch')}</span>
                  <span className="font-semibold">{fmtNum(plan.batchQtyPerRun)} {wo.outputUnit}</span>
                </div>
                {plan.totalEstimatedCost > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted">{t('production','wodt_est_cost')}</span>
                    <span className="font-semibold text-amber-600 dark:text-amber-300">{fmtCurrency(plan.totalEstimatedCost)}</span>
                  </div>
                )}
                <div className="text-xs text-muted">Lập bởi: {plan.submittedByName}</div>

                {/* Bước sản xuất */}
                {plan.batchSteps?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">{t('production','wodt_common_steps')}</p>
                    <div className="space-y-1">
                      {plan.batchSteps.map((step, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <span className="w-5 h-5 rounded-full bg-canvas border border-hairline-2 flex items-center justify-center text-[10px] font-bold text-muted">{i+1}</span>
                          <span className="text-ink">{step}</span>
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
                <Clock size={24} className="mx-auto text-muted mb-2" />
                <p className="text-sm text-muted">
                  {wo.status === 'PENDING_PLAN'
                    ? t('production','wodt_awaiting_plan')
                    : t('production','wodt_no_plan')}
                </p>
                {wo.planDeadline && (
                  <p className="text-xs text-amber-600 dark:text-amber-300 mt-1">Deadline: {fmtDate(wo.planDeadline)}</p>
                )}
              </div>
            </SectionCard>
          )}

          {/* Nguyên liệu */}
          {plan?.materials?.length > 0 && (
            <SectionCard>
              <SectionHeader title={t('production','wodt_shared_materials')} />
              <div className="divide-y divide-hairline">
                {plan.materials.map(m => (
                  <div key={m.id} className="px-4 py-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium text-ink">{m.materialName}</p>
                        <p className="text-xs text-muted">{fmtNum(m.quantity)} {m.unit}</p>
                        {m.vendorName && <p className="text-xs text-muted">{m.vendorName}</p>}
                      </div>
                      {m.estimatedTotal && (
                        <span className="text-xs font-semibold text-gold">{fmtCurrency(m.estimatedTotal)}</span>
                      )}
                    </div>
                    {/* Invoice images */}
                    {m.invoiceImages?.length > 0 && (
                      <div className="flex gap-1.5 mt-2">
                        {m.invoiceImages.map((url, i) => (
                          <img key={i} src={imgUrl(url)} alt=""
                            className="w-10 h-10 rounded-lg object-cover border border-hairline-2 cursor-pointer hover:scale-110 transition-transform" />
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
        <Modal open title={t('production','wodt_cancel_modal_title')} onClose={() => setConfirmCancel(false)} size="sm"
          footer={
            <div className="flex justify-end gap-2">
              <SecondaryButton onClick={() => setConfirmCancel(false)}>{t('common','no')}</SecondaryButton>
              <DangerButton onClick={() => doAction('CANCELLED')} loading={acting}>{t('production','wodt_confirm_cancel')}</DangerButton>
            </div>
          }>
          <p className="text-sm text-ink">
            {t('production','wodt_cancel_confirm_msg',{code:wo.workOrderCode})}
          </p>
        </Modal>
      )}
    </div>
  );
}