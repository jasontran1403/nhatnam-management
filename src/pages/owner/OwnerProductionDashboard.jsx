// src/pages/owner/OwnerProductionDashboard.jsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Factory, Plus, Clock, CheckCircle2, AlertTriangle,
  Wrench, Settings2, ChevronRight, CalendarRange,
  ClipboardList, X, Loader2, Package,
} from 'lucide-react';
import { startOfDay } from 'date-fns';
import useMinLoading from '../../hooks/useMinLoading';
import Modal from '../../components/ui/Modal';
import DateRangePicker from '../../components/ui/DateRangePicker';
import {
  PageHeader, PrimaryButton, SecondaryButton, DangerButton,
  Field, inputCls, EmptyState, SectionCard, SectionHeader,
} from '../../components/ui';
import { StatCardSkeleton } from '../../components/ui/Skeleton';
import {
  ownerProdApi, STATUS_LABELS, progressColor, fmtDate, fmtNum, fmtCurrency,
} from '../../api/productionModuleApi';
import { factoryProductApi } from '../../api/productionApi';

const BRAND = '#C9A84C';

function StatusBadge({ status }) {
  const cfg = STATUS_LABELS[status] || { label: status, cls: 'bg-gray-100 text-gray-600' };
  return <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.cls}`}>{cfg.label}</span>;
}

function KpiCard({ icon: Icon, label, value, sub, color = 'text-[#C9A84C]', iconBg = 'bg-[#C9A84C]/10' }) {
  return (
    <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-[#8E8878] font-medium">{label}</p>
          <p className={`text-3xl font-bold mt-1.5 ${color}`}>{value}</p>
          {sub && <p className="text-xs text-[#8E8878] mt-1">{sub}</p>}
        </div>
        <div className={`w-11 h-11 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0`}>
          <Icon size={20} className={color} />
        </div>
      </div>
    </div>
  );
}

// ── Shimmer CSS ───────────────────────────────────────────────────────────────
const GANTT_CSS = `
@keyframes ganttFlow {
  0%   { background-position: -200% center; }
  100% { background-position: 200% center; }
}
/* WO IN_PROGRESS shimmer */
.gantt-shimmer {
  background-size: 200% 100% !important;
  animation: ganttFlow 2s linear infinite;
}
/* Machine active: green shimmer - background travels left to right */
@keyframes machineFlow {
  0%   { background-position: 100% center; }
  100% { background-position: -100% center; }
}
.mday-active {
  background: linear-gradient(90deg,
    #10b981 0%,
    #10b981 20%,
    #10b981 80%,
    #10b981 100%) !important;
  background-size: 300% 100% !important;
  animation: machineFlow 1.8s ease-in-out infinite;
}
/* Machine maintenance day: red diagonal stripes, no animation */
.mday-maint {
  background: repeating-linear-gradient(
    45deg,
    rgba(220,38,38,0.7),
    rgba(220,38,38,0.7) 3px,
    rgba(254,202,202,0.85) 3px,
    rgba(254,202,202,0.85) 8px
  ) !important;
}
/* Inactive machine */
.mday-inactive {
  background: rgba(0,0,0,0.04) !important;
}
`;
function GanttCSS() { return <style>{GANTT_CSS}</style>; }

// ── DragScroll ────────────────────────────────────────────────────────────────
function DragScroll({ children, weeksBack, totalWeeks, className = '' }) {
  const ref = useRef(null);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startScroll = useRef(0);
  useEffect(() => {
    if (!ref.current || !weeksBack || !totalWeeks) return;
    const pct = weeksBack / totalWeeks;
    ref.current.scrollLeft = ref.current.scrollWidth * pct - ref.current.clientWidth / 2;
  }, []);
  const onMouseDown = e => {
    if (e.button !== 0) return;
    dragging.current = true;
    startX.current = e.pageX - ref.current.offsetLeft;
    startScroll.current = ref.current.scrollLeft;
    ref.current.style.cursor = 'grabbing';
    e.preventDefault();
  };
  const onMouseMove = e => {
    if (!dragging.current) return;
    ref.current.scrollLeft = startScroll.current - (e.pageX - ref.current.offsetLeft - startX.current);
  };
  const onMouseUp = () => { dragging.current = false; if (ref.current) ref.current.style.cursor = 'grab'; };
  const ts = useRef(0); const tsc = useRef(0);
  const onTouchStart = e => { ts.current = e.touches[0].pageX; tsc.current = ref.current.scrollLeft; };
  const onTouchMove = e => { ref.current.scrollLeft = tsc.current - (e.touches[0].pageX - ts.current); };
  return (
    <div ref={ref} className={'overflow-x-auto select-none scrollbar-hide ' + className}
      style={{ cursor: 'grab' }}
      onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
      onTouchStart={onTouchStart} onTouchMove={onTouchMove}>
      {children}
    </div>
  );
}

// ── PRODUCTION GANTT ──────────────────────────────────────────────────────────
const WO_STATUS_COLOR = {
  SCHEDULED:    '#6366f1', PENDING_PLAN: '#f59e0b', PLANNED: '#3b82f6',
  IN_PROGRESS:  '#f97316', COMPLETED: '#10b981', CANCELLED: '#9ca3af',
};

function ProductionGantt({ plans, orders, onPlanClick, onOrderClick }) {
  const WEEKS_BACK = 8, WEEKS_TOTAL = 32;
  const today = new Date(); today.setHours(0,0,0,0);
  const mon = new Date(today); mon.setDate(today.getDate()-((today.getDay()+6)%7)); mon.setHours(0,0,0,0);
  const wStart = new Date(mon); wStart.setDate(mon.getDate()-WEEKS_BACK*7);
  const weeks = Array.from({length:WEEKS_TOTAL},(_,i)=>{const d=new Date(wStart);d.setDate(wStart.getDate()+i*7);return d;});
  const totalMs = WEEKS_TOTAL*7*86400000, startMs = wStart.getTime(), endMs = startMs+totalMs;
  const pL = ms => Math.max(0,Math.min(100,((ms-startMs)/totalMs)*100));
  const pW = (s,e) => Math.max(0.5,((Math.min(e,endMs)-Math.max(s,startMs))/totalMs)*100);
  const todayPct = pL(today.getTime());
  const COL_W = 110; // px per week

  // Build rows
  const ordersByPlan = {};
  (orders||[]).forEach(o => {
    const k = o.productionPlanId||'__none__';
    if(!ordersByPlan[k]) ordersByPlan[k]=[];
    ordersByPlan[k].push(o);
  });
  const rows = [];
  (plans||[]).forEach(p => {
    rows.push({type:'plan',data:p});
    (ordersByPlan[p.id]||[]).forEach(o => rows.push({type:'order',data:o}));
  });
  (ordersByPlan['__none__']||[]).forEach(o => rows.push({type:'order',data:o}));
  if(!rows.length) return <EmptyState icon={CalendarRange} title="Chưa có kế hoạch hoặc lệnh sản xuất nào"/>;

  const LABEL_W = 200;
  const ROW_H = 36;
  const PLAN_ROW_H = 44;

  return (
    <div style={{fontFamily:'inherit'}}>
      <GanttCSS/>
      <div className="flex">
        {/* Fixed label column */}
        <div style={{width:LABEL_W,flexShrink:0}}>
          <div style={{height:32}}/>
          {rows.map((row,ri) => {
            const isPlan = row.type==='plan';
            const d = row.data;
            const h = isPlan ? PLAN_ROW_H : ROW_H;
            return (
              <div key={`lbl-${ri}`} style={{height:h,marginBottom:4}} className="flex items-center pr-3">
                {isPlan ? (
                  <div className="w-full">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold tracking-wide">KH</span>
                      <span className="text-xs font-bold text-[#1C1C1E] truncate">{d.planCode}</span>
                    </div>
                    <p className="text-[10px] text-[#8E8878] truncate mt-0.5">{d.title}</p>
                  </div>
                ) : (
                  <div className="pl-3 w-full">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-[#C9A84C] flex-shrink-0"/>
                      <span className="text-[11px] font-semibold text-[#1C1C1E] truncate">{d.workOrderCode}</span>
                    </div>
                    <p className="text-[9px] text-[#8E8878] truncate pl-2.5">{d.productName}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Scrollable timeline */}
        <DragScroll weeksBack={WEEKS_BACK} totalWeeks={WEEKS_TOTAL} className="flex-1 min-w-0">
          <div style={{minWidth:WEEKS_TOTAL*COL_W,position:'relative'}}>
            {/* Week headers */}
            <div className="flex sticky top-0 z-30" style={{height:32,background:'white'}}>
              {weeks.map((w,i) => {
                const isNow = w<=today && today<new Date(w.getTime()+7*86400000);
                const isMonth = w.getDate()<=7;
                return (
                  <div key={i} style={{flex:'0 0 '+COL_W+'px',width:COL_W}}
                    className={`flex-shrink-0 flex items-center justify-center border-l text-[10px] font-medium
                      ${isNow?'text-[#C9A84C] font-bold':'text-[#8E8878]'}
                      ${isMonth?'border-l-2 border-[#C9A84C]/30 bg-[#FAF7F2]':'border-black/5'}`}>
                    {isMonth
                      ? <span className="font-bold">{w.toLocaleDateString('vi',{month:'short'})}</span>
                      : `${w.getDate()}/${w.getMonth()+1}`}
                  </div>
                );
              })}
            </div>

            {/* Today line */}
            <div className="absolute top-0 bottom-0 z-20 pointer-events-none"
              style={{left:`${todayPct}%`,width:1.5,background:`linear-gradient(to bottom,${BRAND},${BRAND}55)`}}/>

            {/* Rows */}
            {rows.map((row,ri) => {
              const isPlan = row.type==='plan';
              const d = row.data;
              const h = isPlan ? PLAN_ROW_H : ROW_H;
              const cancelled = d.status==='CANCELLED';
              const pct = Number(d.progressPct||0);
              const s = Number(isPlan?d.startDate:d.scheduledStartDate);
              const e = Number(isPlan?d.endDate:d.plannedEndDate);
              if(!s) return <div key={`row-${ri}`} style={{height:h,marginBottom:4}}/>;
              const left = pL(s);
              const width = pW(s,e);
              const color = isPlan
                ? (cancelled?'#9ca3af':'#3b82f6')
                : (WO_STATUS_COLOR[d.status]||'#9ca3af');
              const isActive = d.status==='IN_PROGRESS';

              return (
                <div key={`row-${ri}`} style={{height:h,marginBottom:4,position:'relative'}}>
                  {/* Row bg stripe */}
                  <div className="absolute inset-0" style={{background: ri%2===0?'transparent':'rgba(0,0,0,0.012)'}}/>

                  <button
                    onClick={() => isPlan?onPlanClick(d.id):onOrderClick(d.id)}
                    style={{
                      position:'absolute',
                      top: isPlan?6:8, bottom: isPlan?6:8,
                      left:`${left}%`, width:`${width}%`,
                      minWidth:3,
                      borderRadius: isPlan?6:4,
                      overflow:'hidden',
                      cursor:'pointer',
                      border:'none', padding:0,
                      background: isPlan
                        ? (cancelled ? '#d1d5db' : '#3b82f6')
                        : (isActive
                            ? `linear-gradient(90deg,${color}99 0%,${color}ff 40%,#ffffff44 50%,${color}ff 60%,${color}99 100%)`
                            : cancelled ? color+'88' : color),
                      borderLeft: isPlan ? `3px solid ${cancelled?'#9ca3af':'#2563eb'}` : undefined,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                    }}
                    className={isActive?'gantt-shimmer':''}
                    title={isPlan?`${d.planCode} — ${pct.toFixed(0)}%`:`${d.workOrderCode} — ${pct.toFixed(0)}%`}>
                    <div className="h-full w-full flex items-center px-2 overflow-hidden">
                      {/* Progress fill for plans */}
                      {isPlan && !cancelled && (
                        <div style={{
                          position:'absolute',left:0,top:0,bottom:0,
                          width:`${Math.min(pct,100)}%`,
                          background:'rgba(255,255,255,0.2)',
                          pointerEvents:'none'
                        }}/>
                      )}
                      <span className="text-white text-[10px] font-bold whitespace-nowrap relative z-10 drop-shadow-sm">
                        {pct.toFixed(0)}%
                      </span>
                    </div>
                  </button>
                </div>
              );
            })}

            {/* Legend */}
            <div className="flex flex-wrap gap-4 mt-3 px-1 pb-1 text-[10px] text-[#8E8878]">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{background:'#3b82f6',borderLeft:'2px solid #2563eb'}}/>Kế hoạch</span>
              {Object.entries(WO_STATUS_COLOR).map(([s,c]) => (
                <span key={s} className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded" style={{backgroundColor:c}}/>
                  {{SCHEDULED:'Hẹn giờ',PENDING_PLAN:'Chờ PA',PLANNED:'Có phương án',IN_PROGRESS:'Đang SX',COMPLETED:'Hoàn thành',CANCELLED:'Đã huỷ'}[s]}
                </span>
              ))}
            </div>
          </div>
        </DragScroll>
      </div>
    </div>
  );
}

// ── MAINTENANCE GANTT ─────────────────────────────────────────────────────────
function MachineWeekModal({ machine, dayMs, maintenanceList, onClose }) {
  // Show info for the clicked day: which week it belongs to, work hours, downtime
  const dayDate = new Date(dayMs);
  // Monday of this week
  const dow = dayDate.getDay();
  const monOffset = (dow === 0 ? -6 : 1 - dow);
  const monDate = new Date(dayDate); monDate.setDate(dayDate.getDate() + monOffset); monDate.setHours(0,0,0,0);
  const satDate = new Date(monDate); satDate.setDate(monDate.getDate() + 5); satDate.setHours(23,59,59,999);

  const weekStart = monDate.getTime();
  const weekEnd = satDate.getTime();

  const fmt = d => new Date(d).toLocaleDateString('vi', {weekday:'short', day:'2-digit', month:'2-digit', year:'numeric'});
  const fmtTime = ms => ms ? new Date(ms).toLocaleTimeString('vi', {hour:'2-digit', minute:'2-digit'}) : '—';

  // Maintenance overlapping this day (8:00–18:00)
  const dayStart = new Date(dayMs); dayStart.setHours(8,0,0,0);
  const dayEnd = new Date(dayMs); dayEnd.setHours(18,0,0,0);
  const dayMaints = maintenanceList.filter(mt => {
    const ms2 = Number(mt.actualStart||mt.plannedStart);
    const me  = Number(mt.actualEnd||mt.plannedEnd);
    return ms2 && me && ms2 < dayEnd.getTime() && me > dayStart.getTime();
  });

  const totalDowntimeHours = dayMaints.reduce((sum, mt) => {
    const ms2 = Math.max(Number(mt.actualStart||mt.plannedStart), dayStart.getTime());
    const me  = Math.min(Number(mt.actualEnd||mt.plannedEnd), dayEnd.getTime());
    return sum + Math.max(0, (me - ms2) / 3600000);
  }, 0);

  const workHours = Math.max(0, 10 - totalDowntimeHours); // 8:00–18:00 = 10h

  return (
    <Modal open title={`${machine.name} — ${dayDate.toLocaleDateString('vi', {weekday:'long', day:'2-digit', month:'2-digit'})}`} onClose={onClose} size="md"
      footer={<SecondaryButton onClick={onClose}>Đóng</SecondaryButton>}>
      <div className="space-y-4">
        <div className="bg-[#FAF7F2] rounded-xl px-4 py-3 text-xs space-y-1.5">
          <div className="flex justify-between"><span className="text-[#8E8878]">Tuần làm việc</span><span className="font-semibold">{fmt(weekStart)} → {fmt(weekEnd)}</span></div>
          <div className="flex justify-between"><span className="text-[#8E8878]">Ca làm việc</span><span className="font-semibold text-emerald-600">08:00 – 18:00 (10 giờ/ngày)</span></div>
          <div className="flex justify-between"><span className="text-[#8E8878]">Giờ thực tế hôm nay</span>
            <span className={`font-bold ${workHours < 10 ? 'text-amber-600' : 'text-emerald-600'}`}>{workHours.toFixed(1)}h</span>
          </div>
          {totalDowntimeHours > 0 && (
            <div className="flex justify-between"><span className="text-[#8E8878]">Giờ ngưng máy</span>
              <span className="font-bold text-red-600">{totalDowntimeHours.toFixed(1)}h</span>
            </div>
          )}
        </div>

        {dayMaints.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#8E8878] uppercase tracking-wider">Lý do ngưng máy</p>
            {dayMaints.map((mt, i) => {
              const ms2 = Number(mt.actualStart||mt.plannedStart);
              const me  = Number(mt.actualEnd||mt.plannedEnd);
              return (
                <div key={i} className="bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${mt.maintenanceType==='CORRECTIVE'?'bg-red-200 text-red-800':'bg-blue-100 text-blue-700'}`}>
                      {mt.maintenanceType==='CORRECTIVE'?'🚨 Sự cố':'🔧 Bảo trì'}
                    </span>
                    <span className="text-sm font-semibold text-[#1C1C1E]">{mt.title}</span>
                  </div>
                  <p className="text-xs text-[#8E8878]">{fmtTime(ms2)} → {fmtTime(me)}</p>
                  {mt.vendorName && <p className="text-xs text-[#8E8878]">Đơn vị: {mt.vendorName}</p>}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-700 font-medium text-center">
            ✓ Máy hoạt động bình thường cả ngày
          </div>
        )}
      </div>
    </Modal>
  );
}

function MaintenanceGantt({ machines, maintenanceList, onItemClick }) {
  // Per-day view: 30 days back + 60 days forward = 90 days
  const DAYS_BACK = 30, DAYS_TOTAL = 90;
  const COL_W = 120; // px per day
  const LABEL_W = 200, ROW_H = 40;
  const WORK_START_H = 8, WORK_END_H = 18; // 8:00–18:00

  const today = new Date(); today.setHours(0,0,0,0);
  const dStart = new Date(today); dStart.setDate(today.getDate() - DAYS_BACK);

  const days = Array.from({length:DAYS_TOTAL}, (_,i) => {
    const d = new Date(dStart); d.setDate(dStart.getDate()+i); return d;
  });

  const totalMs = DAYS_TOTAL * 86400000;
  const startMs = dStart.getTime();
  const endMs = startMs + totalMs;

  const todayPct = ((today.getTime() - startMs) / totalMs) * 100;

  const [clickedDay, setClickedDay] = useState(null); // {machine, dayMs}

  const maintByMachine = {};
  (maintenanceList||[]).forEach(m => {
    if (!maintByMachine[m.machineId]) maintByMachine[m.machineId] = [];
    maintByMachine[m.machineId].push(m);
  });

  const rows = [];
  (machines||[]).forEach(machine => {
    rows.push({type:'machine', data:machine});
    const maints = maintByMachine[machine.id]||[];
    const groups = {};
    maints.forEach(m => {
      const key = m.title||m.id;
      if (!groups[key]) groups[key] = {title:m.title, items:[], maintenanceType:m.maintenanceType, status:m.status};
      groups[key].items.push(m);
    });
    Object.values(groups).forEach(group => rows.push({type:'maint', data:group, machine}));
  });

  if (!machines||!machines.length) return <EmptyState icon={Settings2} title="Chưa có máy nào"/>;

  const maintColor = item => {
    if (item.status==='COMPLETED') return '#22c55e';
    if (item.status==='MISSED') return '#6b7280';
    if (item.maintenanceType==='CORRECTIVE') return '#ef4444';
    if (item.status==='IN_PROGRESS') return '#eab308';
    return '#3b82f6';
  };

  // Check if a day (00:00 ms) has maintenance overlapping work hours 8:00–18:00
  const getDayMaintOverlap = (machineMaints, dayMs) => {
    const workStart = dayMs + WORK_START_H * 3600000;
    const workEnd   = dayMs + WORK_END_H   * 3600000;
    return machineMaints.filter(mt => {
      const ms2 = Number(mt.actualStart||mt.plannedStart);
      const me  = Number(mt.actualEnd||mt.plannedEnd);
      return ms2 && me && ms2 < workEnd && me > workStart;
    });
  };

  // Bar position helpers: scale matches day segments (COL_W = 10 work hours 08:00-18:00)
  const WORK_MS = (WORK_END_H - WORK_START_H) * 3600000; // 10h in ms
  const msToWorkLeft = ms => {
    // Which day index?
    const msDay = new Date(ms); msDay.setHours(0,0,0,0);
    const di = Math.round((msDay.getTime() - dStart.getTime()) / 86400000);
    const dayWorkStart = msDay.getTime() + WORK_START_H * 3600000;
    const dayWorkEnd   = msDay.getTime() + WORK_END_H   * 3600000;
    const clampedMs = Math.max(dayWorkStart, Math.min(ms, dayWorkEnd));
    return di * COL_W + ((clampedMs - dayWorkStart) / WORK_MS) * COL_W;
  };
  const msToWorkWidth = (s, e) => {
    // Span across days: sum up work-hour pixels for each day covered
    const sDay = new Date(s); sDay.setHours(0,0,0,0);
    const eDay = new Date(e); eDay.setHours(0,0,0,0);
    const diS = Math.round((sDay.getTime() - dStart.getTime()) / 86400000);
    const diE = Math.round((eDay.getTime() - dStart.getTime()) / 86400000);
    let totalPx = 0;
    for (let di = diS; di <= diE; di++) {
      const dayMs2 = dStart.getTime() + di * 86400000;
      const dayWorkStart = dayMs2 + WORK_START_H * 3600000;
      const dayWorkEnd   = dayMs2 + WORK_END_H   * 3600000;
      const segS = Math.max(s, dayWorkStart);
      const segE = Math.min(e, dayWorkEnd);
      if (segE > segS) totalPx += ((segE - segS) / WORK_MS) * COL_W;
    }
    return Math.max(4, totalPx);
  };

  return (
    <div>
      <GanttCSS/>
      <div className="flex">
        {/* Labels */}
        <div style={{width:LABEL_W, flexShrink:0}}>
          <div style={{height:32}}/>
          {rows.map((row,ri) => {
            const isMachine = row.type==='machine';
            const d = row.data;
            return (
              <div key={`lbl-${ri}`} style={{height:ROW_H, marginBottom:4}} className="flex items-center pr-3">
                {isMachine ? (
                  <div className="flex items-center gap-2 w-full">
                    {(() => {
                      // Check if currently in maintenance window
                      const nowMs = Date.now();
                      const machineMaintList = maintByMachine[d.id]||[];
                      const inActiveMaint = machineMaintList.some(mt => {
                        const ms2 = Number(mt.actualStart||mt.plannedStart);
                        const me  = Number(mt.actualEnd||mt.plannedEnd);
                        return ms2 && me && nowMs >= ms2 && nowMs <= me;
                      });
                      const dotCls = inActiveMaint
                        ? 'bg-red-400 animate-pulse'
                        : d.status==='ACTIVE' ? 'bg-emerald-400 animate-pulse' : 'bg-gray-300';
                      return <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dotCls}`}/>;
                    })()}
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#1C1C1E] truncate">{d.name}</p>
                      {d.factoryName && <p className="text-[9px] text-[#8E8878] truncate">{d.factoryName}</p>}
                    </div>
                  </div>
                ) : (
                  <div className="pl-4 flex items-center gap-1.5 w-full">
                    <span className="w-1 h-1 rounded-full flex-shrink-0"
                      style={{backgroundColor: d.maintenanceType==='CORRECTIVE'?'#ef4444':'#3b82f6'}}/>
                    <span className="text-[10px] text-[#8E8878] truncate block">{d.title}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Timeline */}
        <DragScroll weeksBack={DAYS_BACK} totalWeeks={DAYS_TOTAL} className="flex-1 min-w-0">
          <div style={{minWidth:DAYS_TOTAL*COL_W, position:'relative'}}>

            {/* Day headers */}
            <div className="flex sticky top-0 z-30" style={{height:32, background:'white'}}>
              {days.map((d,i) => {
                const isToday = d.getTime() === today.getTime();
                const isSun = d.getDay() === 0;
                const isSat = d.getDay() === 6;
                const isFirstOfMonth = d.getDate() === 1;
                return (
                  <div key={i} style={{flex:`0 0 ${COL_W}px`, width:COL_W}}
                    className={`flex-shrink-0 flex items-center justify-center border-l text-[10px] font-medium
                      ${isToday?'bg-[#C9A84C]/10 text-[#C9A84C] font-bold border-[#C9A84C]/30':
                        isSun||isSat?'bg-gray-50 text-gray-400 border-black/5':'text-[#8E8878] border-black/5'}
                      ${isFirstOfMonth?'border-l-2 border-[#C9A84C]/40':''}`}>
                    <div className="text-center leading-tight">
                      {isFirstOfMonth
                        ? <><span className="font-bold block">{d.toLocaleDateString('vi',{month:'short'})}</span><span className="text-[9px]">{d.getDate()}</span></>
                        : <><span className="block">{['CN','T2','T3','T4','T5','T6','T7'][d.getDay()]}</span><span className="font-semibold">{d.getDate()}</span></>
                      }
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Today line */}
            <div className="absolute top-0 bottom-0 z-20 pointer-events-none"
              style={{left:`${todayPct}%`, width:2, background:`linear-gradient(to bottom,${BRAND},${BRAND}55)`}}/>

            {/* Rows */}
            {rows.map((row,ri) => {
              const isMachine = row.type==='machine';
              const d = row.data;
              const machineMaints = isMachine ? (maintByMachine[d.id]||[]) : [];

              return (
                <div key={`row-${ri}`} style={{height:ROW_H, marginBottom:4, position:'relative'}}>
                  <div className="absolute inset-0" style={{background: ri%2===0?'transparent':'rgba(0,0,0,0.012)'}}/>

                  {isMachine ? (
                    // Per-day segments with 8:00–18:00 work window
                    <div className="absolute" style={{top:6, bottom:6, left:0, right:0}}>
                      {days.map((dayDate, di) => {
                        const dayMs = dayDate.getTime();
                        const isSun = dayDate.getDay() === 0;
                        const dayLeft = di * COL_W;

                        if (isSun) {
                          // Sunday: grey gap
                          return <div key={di} style={{
                            position:'absolute', top:0, bottom:0, left:dayLeft, width:COL_W,
                            background:'rgba(0,0,0,0.025)', borderRadius:3,
                          }}/>;
                        }

                        // Work window: 8:00–18:00 within this day
                        const workStart = dayMs + WORK_START_H * 3600000;
                        const workEnd   = dayMs + WORK_END_H   * 3600000;
                        const maintOverlaps = getDayMaintOverlap(machineMaints, dayMs);

                        // Build segments: green for working, red for maintenance
                        const segments = [];
                        let cursor = workStart;
                        const sorted = [...maintOverlaps].sort((a,b) =>
                          Number(a.actualStart||a.plannedStart) - Number(b.actualStart||b.plannedStart));

                        sorted.forEach(mt => {
                          const ms2 = Math.max(Number(mt.actualStart||mt.plannedStart), workStart);
                          const me  = Math.min(Number(mt.actualEnd||mt.plannedEnd), workEnd);
                          if (ms2 > cursor) segments.push({start:cursor, end:ms2, type:'work'});
                          if (me > ms2) segments.push({start:ms2, end:me, type:'maint'});
                          cursor = Math.max(cursor, me);
                        });
                        if (cursor < workEnd) segments.push({start:cursor, end:workEnd, type:'work'});

                        const totalWork = workEnd - workStart; // 10h in ms

                        // Always render as layered segments: green base + red overlays
                        const hasMaint = segments.some(s => s.type === 'maint');
                        return (
                          <div key={di}
                            onClick={() => setClickedDay({machine:d, dayMs})}
                            className="mday-active"
                            style={{
                              position:'absolute', top:0, bottom:0, left:dayLeft, width:COL_W-2,
                              borderRadius:4, cursor:'pointer',
                            }}>
                            {/* Overlay red maintenance segments on top of green shimmer base */}
                            {hasMaint && segments.filter(s => s.type==='maint').map((seg, si) => {
                              const segLeft2 = ((seg.start - workStart) / totalWork) * 100;
                              const segWidth2 = ((seg.end - seg.start) / totalWork) * 100;
                              return (
                                <div key={si} className="mday-maint" style={{
                                  position:'absolute', top:0, bottom:0,
                                  left:`${segLeft2}%`, width:`${segWidth2}%`,
                                }}/>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    // Maintenance bars using pixel-based positioning
                    <>
                      {(d.items||[]).map((item, ii) => {
                        const s = Number(item.actualStart||item.plannedStart);
                        const e = Number(item.actualEnd||item.plannedEnd||(s+86400000*2));
                        if (!s||s>endMs||e<startMs) return null;
                        const color = maintColor(item);
                        const barLeft = msToWorkLeft(s);
                        const barW    = msToWorkWidth(s, e);
                        return (
                          <button key={ii}
                            onClick={() => onItemClick(item)}
                            style={{
                              position:'absolute', top:6, bottom:6,
                              left:barLeft, width:Math.max(barW,4),
                              borderRadius:4, overflow:'hidden', cursor:'pointer',
                              border:'none', padding:'0 6px',
                              backgroundColor:color+'cc',
                              boxShadow:'0 1px 3px rgba(0,0,0,0.2)', zIndex:10,
                            }}>
                            <span className="text-white text-[9px] font-bold whitespace-nowrap truncate drop-shadow-sm">
                              {item.title?.length>10?item.title.slice(0,8)+'…':item.title}
                              {' '}{item.plannedStart ? new Date(item.plannedStart).toLocaleTimeString('vi',{hour:'2-digit',minute:'2-digit'}) : ''}
                            </span>
                          </button>
                        );
                      })}
                    </>
                  )}
                </div>
              );
            })}

            {/* Legend */}
            <div className="flex flex-wrap gap-4 mt-3 px-1 pb-1 text-[10px] text-[#8E8878]">
              {[['#10b981','Đang hoạt động'],['#ef4444','Bảo trì/Sự cố'],['#3b82f6','Theo lịch'],['#eab308','Đang xử lý'],['#22c55e','Hoàn thành']].map(([c,l])=>(
                <span key={l} className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded" style={{backgroundColor:c}}/>{l}
                </span>
              ))}
            </div>
          </div>
        </DragScroll>
      </div>

      {/* Click modal for machine day */}
      {clickedDay && (
        <MachineWeekModal
          machine={clickedDay.machine}
          dayMs={clickedDay.dayMs}
          maintenanceList={maintByMachine[clickedDay.machine.id]||[]}
          onClose={() => setClickedDay(null)}
        />
      )}
    </div>
  );
}

// ── MAINTENANCE DETAIL MODAL ──────────────────────────────────────────────────
function MaintenanceDetailModal({ item, onClose }) {
  const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
  const img = p => p?.startsWith('http') ? p : BASE + '/api/auth' + p;
  return (
    <Modal open title={item.title} onClose={onClose} size="lg"
      footer={<SecondaryButton onClick={onClose}>Đóng</SecondaryButton>}>
      <div className="space-y-5">
        <div className="flex gap-3 flex-wrap">
          <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
            item.status==='COMPLETED'?'bg-emerald-100 text-emerald-700':
            item.maintenanceType==='CORRECTIVE'?'bg-red-100 text-red-700':'bg-blue-100 text-blue-700'}`}>
            {item.maintenanceType==='CORRECTIVE'?'🚨 Sự cố phát sinh':'🔧 Bảo trì định kỳ'}
          </span>
          <span className="text-xs px-2.5 py-1 rounded-full bg-[#FAF7F2] text-[#8E8878]">{item.machineName}</span>
          <StatusBadge status={item.status}/>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {[
            {label:'Bắt đầu kế hoạch',value:fmtDate(item.plannedStart)},
            {label:'Kết thúc dự kiến',value:fmtDate(item.plannedEnd)},
            {label:'Thực tế hoàn thành',value:fmtDate(item.actualEnd)||'—'},
            {label:'Giờ downtime',value:item.actualDowntimeHours?`${item.actualDowntimeHours}h`:`${item.plannedDowntimeHours||0}h (KH)`},
            {label:'Chi phí',value:item.actualCost?fmtCurrency(item.actualCost):item.estimatedCost?`~${fmtCurrency(item.estimatedCost)}`:'—'},
            {label:'Đơn vị thi công',value:item.vendorName||'—'},
          ].map(s=>(
            <div key={s.label} className="bg-[#FAF7F2] rounded-xl p-3">
              <p className="text-xs text-[#8E8878] mb-0.5">{s.label}</p>
              <p className="font-semibold text-[#1C1C1E]">{s.value}</p>
            </div>
          ))}
        </div>
        {item.description&&<div className="bg-[#FAF7F2] rounded-xl p-3"><p className="text-xs text-[#8E8878] mb-1">Nội dung</p><p className="text-sm">{item.description}</p></div>}
        {item.completionNotes&&<div className="bg-[#FAF7F2] rounded-xl p-3"><p className="text-xs text-[#8E8878] mb-1">Ghi chú hoàn thành</p><p className="text-sm">{item.completionNotes}</p></div>}
        {[['Ảnh trước bảo trì',item.beforeImages],['Ảnh sau bảo trì',item.afterImages],['Chứng từ',item.receiptImages]].map(([label,imgs])=>
          imgs?.length>0&&(
            <div key={label}>
              <p className="text-xs font-semibold text-[#8E8878] uppercase tracking-wider mb-2">{label}</p>
              <div className="flex gap-2 flex-wrap">
                {imgs.map((url,i)=>(
                  <a key={i} href={img(url)} target="_blank" rel="noreferrer">
                    <img src={img(url)} alt="" className="w-24 h-24 object-cover rounded-xl border border-black/10 hover:scale-105 transition-transform"/>
                  </a>
                ))}
              </div>
            </div>
          )
        )}
      </div>
    </Modal>
  );
}

// ── CREATE PLAN MODAL ─────────────────────────────────────────────────────────
function CreatePlanModal({ products, onClose, onSaved }) {
  const todayMs = startOfDay(new Date()).getTime();
  const [form, setForm] = useState({title:'',factoryProductId:'',targetQty:'',notes:''});
  const [dateRange, setDateRange] = useState({from:null,to:null});
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const submit=async()=>{
    if(!form.title||!form.factoryProductId||!form.targetQty){setErr('Vui lòng điền đầy đủ');return;}
    if(!dateRange.from||!dateRange.to){setErr('Chọn thời gian kế hoạch');return;}
    setSaving(true);
    try{await ownerProdApi.createPlan({title:form.title,factoryProductId:Number(form.factoryProductId),targetQty:Number(form.targetQty),startDate:dateRange.from,endDate:dateRange.to,notes:form.notes});onSaved();}
    catch(e){setErr(e?.response?.data?.message||'Có lỗi xảy ra');}finally{setSaving(false);}
  };
  return (
    <Modal open title="Tạo kế hoạch sản xuất" onClose={onClose} size="md"
      footer={<div className="flex justify-end gap-2"><SecondaryButton onClick={onClose}>Huỷ</SecondaryButton><PrimaryButton onClick={submit} loading={saving}>Tạo kế hoạch</PrimaryButton></div>}>
      <div className="space-y-4">
        {err&&<p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{err}</p>}
        <Field label="Tiêu đề" required><input className={inputCls} value={form.title} onChange={e=>set('title',e.target.value)}/></Field>
        <Field label="Sản phẩm" required>
          <select className={inputCls} value={form.factoryProductId} onChange={e=>set('factoryProductId',e.target.value)}>
            <option value="">-- Chọn --</option>
            {products.map(p=><option key={p.id} value={p.id}>{p.name} ({p.unit})</option>)}
          </select>
        </Field>
        <Field label="Sản lượng mục tiêu" required><input type="number" className={inputCls} value={form.targetQty} onChange={e=>set('targetQty',e.target.value)}/></Field>
        <Field label="Thời gian kế hoạch" required>
          <div className="pt-1"><DateRangePicker from={dateRange.from} to={dateRange.to} onChange={setDateRange}/></div>
        </Field>
        <Field label="Ghi chú"><textarea className={inputCls} rows={2} value={form.notes} onChange={e=>set('notes',e.target.value)}/></Field>
      </div>
    </Modal>
  );
}

// ── CREATE WORK ORDER MODAL ───────────────────────────────────────────────────
function CreateWorkOrderModal({ plans, products, factories, prefilledPlanId, onClose, onSaved }) {
  const [form, setForm] = useState({productionPlanId:prefilledPlanId?String(prefilledPlanId):'',factoryProductId:'',plannedQty:'',notes:'',productionFactoryId:'',scheduledMode:false});
  const [dateRange, setDateRange] = useState({from:null,to:null});
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [overPlanConfirm, setOverPlanConfirm] = useState(null);
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const selectedPlan=plans.find(p=>p.id===Number(form.productionPlanId));
  useEffect(()=>{if(prefilledPlanId){const p=plans.find(x=>x.id===Number(prefilledPlanId));if(p)set('factoryProductId',String(p.factoryProductId));}},[prefilledPlanId,plans]);
  const doSubmit=async(force=false)=>{
    setSaving(true);
    try{
      await ownerProdApi.createWorkOrder({productionPlanId:Number(form.productionPlanId),factoryProductId:Number(form.factoryProductId),plannedQty:Number(form.plannedQty),scheduledStartDate:dateRange.from,plannedEndDate:dateRange.to,notes:form.notes,forceCreate:force,productionFactoryId:form.productionFactoryId?Number(form.productionFactoryId):null,scheduledMode:form.scheduledMode});
      setOverPlanConfirm(null);onSaved();
    }catch(e){
      const msg=e?.response?.data?.message||e?.message||'Có lỗi xảy ra';
      if(msg.startsWith('OVER_PLAN_QTY:')){const[,nT,tQ]=msg.split(':');setOverPlanConfirm({newTotal:nT,targetQty:tQ});}
      else setErr(msg);
    }finally{setSaving(false);}
  };
  const planAcc=selectedPlan?Number(selectedPlan.accumulatedQty||0):0;
  const planTgt=selectedPlan?Number(selectedPlan.targetQty||0):0;
  return (
    <>
      <Modal open title="Tạo lệnh sản xuất" onClose={onClose} size="md"
        footer={<div className="flex justify-end gap-2"><SecondaryButton onClick={onClose}>Huỷ</SecondaryButton><PrimaryButton onClick={async()=>{if(!form.productionPlanId||!form.factoryProductId||!form.plannedQty||!dateRange.from){setErr('Điền đầy đủ thông tin');return;}setErr('');await doSubmit(false);}} loading={saving}>Tạo lệnh</PrimaryButton></div>}>
        <div className="space-y-4">
          {err&&<p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{err}</p>}
          <Field label="Kế hoạch" required>
            <select className={inputCls} value={form.productionPlanId} onChange={e=>{set('productionPlanId',e.target.value);const p=plans.find(x=>x.id===Number(e.target.value));if(p)set('factoryProductId',String(p.factoryProductId));}}>
              <option value="">-- Chọn kế hoạch --</option>
              {plans.filter(p=>p.status==='ACTIVE').map(p=><option key={p.id} value={p.id}>{p.planCode} — {p.title}</option>)}
            </select>
          </Field>
          {selectedPlan&&(
            <div className="bg-[#FAF7F2] rounded-xl px-4 py-3 text-xs space-y-1">
              <div className="flex justify-between"><span className="text-[#8E8878]">Mục tiêu</span><span className="font-medium">{fmtNum(planTgt)} {selectedPlan.outputUnit}</span></div>
              <div className="flex justify-between"><span className="text-[#8E8878]">Đã lên lệnh</span><span className={`font-medium ${planAcc>=planTgt?'text-red-500':'text-emerald-600'}`}>{fmtNum(planAcc)}</span></div>
              <div className="flex justify-between"><span className="text-[#8E8878]">Còn lại</span><span className={`font-bold ${planTgt-planAcc<=0?'text-red-500':'text-[#C9A84C]'}`}>{planTgt-planAcc<=0?'Đã đủ':fmtNum(planTgt-planAcc)}</span></div>
            </div>
          )}
          <Field label="Sản phẩm" required>
            <select className={inputCls} value={form.factoryProductId} onChange={e=>set('factoryProductId',e.target.value)}>
              <option value="">-- Chọn --</option>
              {products.map(p=><option key={p.id} value={p.id}>{p.name} ({p.unit})</option>)}
            </select>
          </Field>
          <Field label="Sản lượng lệnh" required><input type="number" className={inputCls} value={form.plannedQty} onChange={e=>set('plannedQty',e.target.value)}/></Field>
          <Field label="Thời gian sản xuất" required>
            <div className="pt-1"><DateRangePicker from={dateRange.from} to={dateRange.to} onChange={setDateRange} placeholder={selectedPlan?`Từ ${fmtDate(selectedPlan.startDate)} trở đi`:'Chọn ngày'}/></div>
          </Field>
          <Field label="Ghi chú"><textarea className={inputCls} rows={2} value={form.notes} onChange={e=>set('notes',e.target.value)}/></Field>
          {factories?.length>0&&(
            <Field label="Xưởng sản xuất">
              <select className={inputCls} value={form.productionFactoryId} onChange={e=>set('productionFactoryId',e.target.value)}>
                <option value="">-- Không gán xưởng --</option>
                {factories.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </Field>
          )}
          <div className="flex items-center justify-between bg-[#FAF7F2] rounded-xl px-4 py-3">
            <div><p className="text-sm font-medium">Hẹn giờ chặt</p><p className="text-xs text-[#8E8878]">Nhân viên chỉ được nhập NVL trước 3 ngày</p></div>
            <button onClick={()=>set('scheduledMode',!form.scheduledMode)}
              className={`w-12 h-6 rounded-full transition-colors relative ${form.scheduledMode?'bg-[#C9A84C]':'bg-black/15'}`}>
              <div className={`w-5 h-5 bg-white rounded-full shadow absolute top-0.5 transition-all ${form.scheduledMode?'left-6':'left-0.5'}`}/>
            </button>
          </div>
        </div>
      </Modal>
      {overPlanConfirm&&(
        <Modal open title="Xác nhận vượt kế hoạch" onClose={()=>setOverPlanConfirm(null)} size="sm"
          footer={<div className="flex justify-end gap-2"><SecondaryButton onClick={()=>setOverPlanConfirm(null)}>Huỷ</SecondaryButton><PrimaryButton onClick={()=>doSubmit(true)} loading={saving}>Vẫn tạo lệnh</PrimaryButton></div>}>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-3">
            <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5"/>
            <div className="text-sm text-amber-800">
              <p className="font-semibold">Tổng sản lượng sẽ vượt kế hoạch!</p>
              <p className="mt-1">Tổng: <b>{fmtNum(overPlanConfirm.newTotal)}</b> / Mục tiêu: <b>{fmtNum(overPlanConfirm.targetQty)}</b></p>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

// ── ADD MACHINE MODAL ─────────────────────────────────────────────────────────
function AddMachineModal({ factories, onClose, onSaved }) {
  const [form, setForm] = useState({name:'',capacityHoursPerMonth:'',description:'',manufacturer:'',serialNumber:'',purchaseCost:'',factoryId:''});
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const submit=async()=>{
    if(!form.name||!form.capacityHoursPerMonth){setErr('Vui lòng nhập tên máy và công suất');return;}
    setSaving(true);
    try{
      await ownerProdApi.createMachine({name:form.name,capacityHoursPerMonth:Number(form.capacityHoursPerMonth),description:form.description,manufacturer:form.manufacturer,serialNumber:form.serialNumber,purchaseCost:form.purchaseCost?Number(form.purchaseCost):null,factoryId:form.factoryId?Number(form.factoryId):null});
      onSaved();
    }catch(e){setErr(e?.response?.data?.message||'Có lỗi xảy ra');}finally{setSaving(false);}
  };
  return (
    <Modal open title="Thêm máy / dây chuyền" onClose={onClose} size="md"
      footer={<div className="flex justify-end gap-2"><SecondaryButton onClick={onClose}>Huỷ</SecondaryButton><PrimaryButton onClick={submit} loading={saving}>Thêm máy</PrimaryButton></div>}>
      <div className="space-y-4">
        {err&&<p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{err}</p>}
        <Field label="Tên máy / dây chuyền" required><input className={inputCls} placeholder="VD: Máy xay thịt A" value={form.name} onChange={e=>set('name',e.target.value)}/></Field>
        <Field label="Công suất (giờ/tháng)" required><input type="number" className={inputCls} value={form.capacityHoursPerMonth} onChange={e=>set('capacityHoursPerMonth',e.target.value)}/></Field>
        {factories?.length>0&&(
          <Field label="Thuộc xưởng">
            <select className={inputCls} value={form.factoryId} onChange={e=>set('factoryId',e.target.value)}>
              <option value="">-- Chưa gán xưởng --</option>
              {factories.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nhà sản xuất"><input className={inputCls} value={form.manufacturer} onChange={e=>set('manufacturer',e.target.value)}/></Field>
          <Field label="Số serial"><input className={inputCls} value={form.serialNumber} onChange={e=>set('serialNumber',e.target.value)}/></Field>
        </div>
        <Field label="Giá trị máy (₫)"><input type="number" className={inputCls} value={form.purchaseCost} onChange={e=>set('purchaseCost',e.target.value)}/></Field>
        <Field label="Mô tả"><textarea className={inputCls} rows={2} value={form.description} onChange={e=>set('description',e.target.value)}/></Field>
      </div>
    </Modal>
  );
}

// ── MAIN DASHBOARD ────────────────────────────────────────────────────────────
export default function OwnerProductionDashboard() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [plans, setPlans] = useState([]);
  const [products, setProducts] = useState([]);
  const [factories, setFactories] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [loading, setLoading] = useMinLoading(true);
  const [showCreatePlan, setShowCreatePlan] = useState(false);
  const [showCreateWO, setShowCreateWO] = useState(false);
  const [showAddMachine, setShowAddMachine] = useState(false);
  const [prefilledPlan, setPrefilledPlan] = useState(null);
  const [selectedMaint, setSelectedMaint] = useState(null);
  const [activeSection, setActiveSection] = useState('orders');

  const load=async()=>{
    setLoading(true);
    try{
      const [dash,planList,prods,maint,factList]=await Promise.all([
        ownerProdApi.getDashboard(),ownerProdApi.listPlans(0,50,'ACTIVE'),
        factoryProductApi.list(true),ownerProdApi.listMaintenance(new Date().getFullYear()),
        ownerProdApi.listFactories().catch(()=>[]),
      ]);
      setDashboard(dash);setPlans(planList?.content||[]);setProducts(prods||[]);setMaintenance(maint||[]);setFactories(factList||[]);
    }finally{setLoading(false);}
  };
  useEffect(()=>{load();},[]);
  const onSaved=()=>{setShowCreatePlan(false);setShowCreateWO(false);setPrefilledPlan(null);load();};

  if(loading&&!dashboard) return(
    <div className="p-6 space-y-6"><div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[...Array(4)].map((_,i)=><StatCardSkeleton key={i}/>)}</div></div>
  );
  const d=dashboard||{};

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <PageHeader icon={Factory} title="Quản lý sản xuất" subtitle="Kế hoạch · Lệnh sản xuất · Máy móc"/>
        <div className="flex gap-2">
          <SecondaryButton onClick={()=>setShowCreateWO(true)}><Plus size={15}/> Tạo lệnh</SecondaryButton>
          <PrimaryButton onClick={()=>setShowCreatePlan(true)}><Plus size={15}/> Kế hoạch mới</PrimaryButton>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          {icon:CalendarRange,label:'Kế hoạch đang chạy',value:d.totalActivePlans||0,color:'text-blue-600',iconBg:'bg-blue-50'},
          {icon:ClipboardList,label:'Tổng lệnh SX',value:d.totalWorkOrders||0,color:'text-[#1C1C1E]',iconBg:'bg-[#FAF7F2]'},
          {icon:Factory,label:'Đang sản xuất',value:d.inProgressOrders||0,color:'text-orange-600',iconBg:'bg-orange-50'},
          {icon:Clock,label:'Chờ phương án',value:d.pendingPlanOrders||0,color:d.pendingPlanOrders>0?'text-amber-600':'text-[#8E8878]',iconBg:'bg-amber-50'},
          {icon:CheckCircle2,label:'Hoàn thành',value:d.completedOrders||0,color:'text-emerald-600',iconBg:'bg-emerald-50'},
          {icon:Settings2,label:'Máy hoạt động',value:`${d.activeMachines||0}/${d.totalMachines||0}`,color:'text-[#C9A84C]',iconBg:'bg-[#C9A84C]/10'},
        ].map(kpi=><KpiCard key={kpi.label} {...kpi}/>)}
      </div>

      {d.pendingPlanOrders>0&&(
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
          <AlertTriangle size={18} className="text-amber-600 flex-shrink-0"/>
          <p className="text-sm text-amber-800 font-medium">{d.pendingPlanOrders} lệnh đang chờ nhân viên xưởng lập phương án sản xuất</p>
        </div>
      )}

      <div className="flex gap-1 bg-white border border-black/5 rounded-xl p-1 w-fit shadow-sm">
        {[{id:'orders',label:'Timeline sản xuất',icon:ClipboardList},{id:'machines',label:'Máy móc',icon:Settings2}].map(s=>(
          <button key={s.id} onClick={()=>setActiveSection(s.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeSection===s.id?'bg-[#1C1C1E] text-white':'text-[#8E8878] hover:text-[#1C1C1E]'}`}>
            <s.icon size={14}/>{s.label}
          </button>
        ))}
      </div>

      {activeSection==='orders'&&(
        <SectionCard>
          <SectionHeader title="Timeline 39 tuần — Kế hoạch & Lệnh sản xuất"
            action={<button onClick={()=>setShowCreateWO(true)} className="flex items-center gap-1 text-xs text-[#C9A84C] font-semibold hover:underline"><Plus size={12}/> Tạo lệnh</button>}/>
          <div className="p-4">
            <ProductionGantt
              plans={d.recentPlans||[]} orders={d.calendarItems||[]}
              onPlanClick={id=>navigate(`/owner/production/plans/${id}`)}
              onOrderClick={id=>navigate(`/owner/production/work-orders/${id}`)}/>
          </div>
        </SectionCard>
      )}

      {activeSection==='machines'&&(
        <SectionCard>
          <SectionHeader title="Máy móc & lịch bảo trì — 39 tuần"
            action={<button onClick={()=>setShowAddMachine(true)} className="flex items-center gap-1 text-xs text-[#C9A84C] font-semibold hover:underline"><Plus size={12}/> Thêm máy</button>}/>
          <div className="p-4">
            <MaintenanceGantt machines={d.machines||[]} maintenanceList={maintenance} onItemClick={setSelectedMaint}/>
          </div>
        </SectionCard>
      )}

      {showCreatePlan&&<CreatePlanModal products={products} onClose={()=>setShowCreatePlan(false)} onSaved={onSaved}/>}
      {(showCreateWO||prefilledPlan)&&(
        <CreateWorkOrderModal plans={plans} products={products} factories={factories} prefilledPlanId={prefilledPlan?.id}
          onClose={()=>{setShowCreateWO(false);setPrefilledPlan(null);}} onSaved={onSaved}/>
      )}
      {selectedMaint&&<MaintenanceDetailModal item={selectedMaint} onClose={()=>setSelectedMaint(null)}/>}
      {showAddMachine&&<AddMachineModal factories={factories} onClose={()=>setShowAddMachine(false)} onSaved={onSaved}/>}
    </div>
  );
}