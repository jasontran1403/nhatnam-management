/**
 * DriverAttendancePage.jsx — Điểm danh ODO tài xế
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { Gauge, CheckCircle2, Clock, Bike, Truck, Save, Loader2, Pencil } from 'lucide-react';
import api from '../../api/axios';
import { useToast } from '../../components/common/Toast';

const toLocalDate = () =>
  new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });

const fmtDateVN = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

const fmtOdo = (n) => n != null ? Number(n).toLocaleString('vi-VN') : '—';

// ── Inline ODO editor ─────────────────────────────────────────────────────────
function OdoEditor({ driverId, vehicleType, session, currentOdo, recordedBy, date, onSaved }) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef();

  const startEdit = () => {
    setVal(currentOdo != null ? String(currentOdo) : '');
    setEditing(true);
    setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select(); }, 30);
  };

  const save = async () => {
    const num = Number(val);
    if (!val || isNaN(num) || num < 0) { toast('Nhập số km hợp lệ', 'error'); return; }
    setSaving(true);
    try {
      const res = await api.post('/api/warehouse/driver-attendance', {
        driverId, vehicleType, sessionType: session, odometer: num, date,
      });
      onSaved(res.data?.data);
      setEditing(false);
      toast('Đã lưu', 'success');
    } catch (e) {
      toast(e?.response?.data?.message || 'Lỗi lưu', 'error');
    } finally { setSaving(false); }
  };

  const isStart = session === 'START';
  const color = isStart ? 'text-sky-600' : 'text-amber-600';

  if (editing) {
    return (
      <div className="space-y-1">
        <p className={`text-[10px] font-bold ${color}`}>{isStart ? 'Đầu ca' : 'Cuối ca'}</p>
        <div className="flex items-center gap-1">
          <div className="relative flex-1">
            <input ref={inputRef} type="number" inputMode="numeric" min="0"
              value={val} onChange={e => setVal(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
              className="w-full h-8 px-2 pr-6 rounded-lg text-sm font-mono text-right border-2 border-[#C9A84C] focus:outline-none bg-white" />
            <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] text-[#8E8878]">km</span>
          </div>
          <button onClick={save} disabled={saving}
            className="h-8 w-8 rounded-lg bg-[#C9A84C] text-white flex items-center justify-center flex-shrink-0">
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
          </button>
          <button onClick={() => setEditing(false)}
            className="h-8 w-7 rounded-lg border border-[#E8DDD0] text-[#8E8878] text-xs flex items-center justify-center flex-shrink-0">
            ✕
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      <p className={`text-[10px] font-bold ${color}`}>{isStart ? 'Đầu ca' : 'Cuối ca'}</p>
      {currentOdo != null ? (
        <div className="flex items-center gap-1">
          <span className="text-sm font-mono font-bold text-[#1C1C1E]">{fmtOdo(currentOdo)}</span>
          <span className="text-[10px] text-[#8E8878]">km</span>
          <button onClick={startEdit} className="p-0.5 text-[#C4B9A8] hover:text-[#C9A84C]">
            <Pencil size={10} />
          </button>
        </div>
      ) : (
        <button onClick={startEdit}
          className="flex items-center gap-1 text-xs text-[#C4B9A8] hover:text-[#C9A84C] font-medium">
          — Chưa nhập <Pencil size={10} />
        </button>
      )}
      {recordedBy && (
        <p className="text-[9px] text-[#8E8878] truncate">↳ {recordedBy}</p>
      )}
    </div>
  );
}

// ── Vehicle section (1 loại xe) ───────────────────────────────────────────────
function VehicleSection({ row, date, onUpdate }) {
  const isTruck = row.vehicleType === 'TRUCK';
  const bothDone = row.startOdometer != null && row.endOdometer != null;

  return (
    <div className={`rounded-xl border p-3 space-y-2
      ${bothDone ? 'bg-emerald-50/40 border-emerald-200' : 'bg-[#FAFAF8] border-[#F0EBE3]'}`}>
      <div className="flex items-center gap-1.5">
        {isTruck
          ? <Truck size={13} className="text-orange-500 flex-shrink-0" />
          : <Bike size={13} className="text-sky-500 flex-shrink-0" />}
        <span className="text-xs font-semibold text-[#5C4E3D]">
          {isTruck ? 'Xe tải' : 'Xe máy'}
        </span>
        {bothDone && <CheckCircle2 size={12} className="text-emerald-500 ml-auto" />}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <OdoEditor driverId={row.driverId} vehicleType={row.vehicleType}
          session="START" currentOdo={row.startOdometer} recordedBy={row.startRecordedBy}
          date={date} onSaved={d => onUpdate(row.driverId, row.vehicleType, 'start', d)} />
        <OdoEditor driverId={row.driverId} vehicleType={row.vehicleType}
          session="END" currentOdo={row.endOdometer} recordedBy={row.endRecordedBy}
          date={date} onSaved={d => onUpdate(row.driverId, row.vehicleType, 'end', d)} />
      </div>

      {bothDone && (
        <p className="text-[10px] text-[#C9A84C] font-semibold text-right">
          +{(row.endOdometer - row.startOdometer).toLocaleString('vi-VN')} km
        </p>
      )}
    </div>
  );
}

// ── Driver Card ───────────────────────────────────────────────────────────────
function DriverCard({ driverName, rows, date, onUpdate }) {
  const allDone = rows.every(r => r.startOdometer != null && r.endOdometer != null);
  const anyDone = rows.some(r => r.startOdometer != null || r.endOdometer != null);
  const hasBoth = rows.length > 1;

  return (
    <div className={`bg-white rounded-2xl border-2 overflow-hidden
      ${allDone ? 'border-emerald-200' : anyDone ? 'border-[#C9A84C]/30' : 'border-[#F0EBE3]'}`}>
      <div className={`flex items-center gap-2 px-4 py-2.5
        ${allDone ? 'bg-emerald-50/50' : anyDone ? 'bg-[#FDF8ED]' : 'bg-[#FAFAF8]'}`}>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-[#1C1C1E]">{driverName}</p>
        </div>
        {allDone
          ? <CheckCircle2 size={15} className="text-emerald-500 flex-shrink-0" />
          : anyDone
            ? <Clock size={15} className="text-[#C9A84C] flex-shrink-0" />
            : <span className="text-[10px] text-[#C4B9A8]">Chưa điểm danh</span>}
      </div>

      <div className={`p-3 ${hasBoth ? 'grid grid-cols-2 gap-2' : ''}`}>
        {rows.map(row => (
          <VehicleSection key={row.vehicleType} row={row} date={date} onUpdate={onUpdate} />
        ))}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
const EXCLUDE_NAMES = ['kho giao tại kho'];

export default function DriverAttendancePage() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const today = toLocalDate();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/warehouse/driver-attendance', { params: { date: today } });
      setRows(res.data?.data || []);
    } catch { toast('Lỗi tải dữ liệu', 'error'); }
    finally { setLoading(false); }
  }, [today]);

  useEffect(() => { load(); }, [load]);

  const handleUpdate = (driverId, vehicleType, which, data) => {
    setRows(prev => prev.map(r => {
      if (r.driverId !== driverId || r.vehicleType !== vehicleType) return r;
      return which === 'start'
        ? { ...r, startOdometer: data.odometer, startRecordedBy: data.recordedBy }
        : { ...r, endOdometer: data.odometer, endRecordedBy: data.recordedBy };
    }));
  };

  // Group, filter "Kho giao tại kho", sort MOTORBIKE trước TRUCK
  const grouped = [];
  const seen = {};
  rows.forEach(r => {
    if (EXCLUDE_NAMES.includes(r.driverName?.toLowerCase().trim())) return;
    if (!seen[r.driverName]) {
      seen[r.driverName] = [];
      grouped.push({ driverName: r.driverName, rows: seen[r.driverName] });
    }
    seen[r.driverName].push(r);
  });
  grouped.forEach(g => g.rows.sort((a, b) =>
    (a.vehicleType === 'MOTORBIKE' ? 0 : 1) - (b.vehicleType === 'MOTORBIKE' ? 0 : 1)));

  const totalRows = rows.filter(r => !EXCLUDE_NAMES.includes(r.driverName?.toLowerCase().trim())).length;
  const doneStart = rows.filter(r => !EXCLUDE_NAMES.includes(r.driverName?.toLowerCase().trim()) && r.startOdometer != null).length;
  const doneBoth  = rows.filter(r => !EXCLUDE_NAMES.includes(r.driverName?.toLowerCase().trim()) && r.startOdometer != null && r.endOdometer != null).length;

  return (
    <div className="min-h-screen bg-[#FAF7F2]">
      <div className="bg-white border-b border-[#F0EBE3] sticky top-0 z-10 px-4 sm:px-6 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#C9A84C]/15 flex items-center justify-center flex-shrink-0">
              <Gauge size={16} className="text-[#C9A84C]" />
            </div>
            <div>
              <h1 className="font-bold text-[#1C1C1E] text-sm">Điểm danh ODO</h1>
              <p className="text-[10px] text-[#8E8878]">{fmtDateVN(today)} · {grouped.length} tài xế</p>
            </div>
          </div>
          {!loading && totalRows > 0 && (
            <div className="flex items-center gap-2 text-[10px]">
              <span className={`px-2 py-1 rounded-full font-semibold
                ${doneStart === totalRows ? 'bg-sky-100 text-sky-700' : 'bg-[#F0EBE3] text-[#8E8878]'}`}>
                🌅 {doneStart}/{totalRows}
              </span>
              <span className={`px-2 py-1 rounded-full font-semibold
                ${doneBoth === totalRows ? 'bg-emerald-100 text-emerald-700' : 'bg-[#F0EBE3] text-[#8E8878]'}`}>
                ✓ {doneBoth}/{totalRows}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 sm:px-6 py-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-20 gap-2 text-[#8E8878]">
            <Loader2 size={20} className="animate-spin text-[#C9A84C]" />
            <span className="text-sm">Đang tải...</span>
          </div>
        ) : grouped.length === 0 ? (
          <div className="text-center py-20 text-[#8E8878]">
            <Gauge size={40} className="mx-auto mb-3 opacity-20" />
            <p className="text-sm">Chưa có tài xế nào</p>
          </div>
        ) : (
          grouped.map(g => (
            <DriverCard key={g.driverName} driverName={g.driverName}
              rows={g.rows} date={today} onUpdate={handleUpdate} />
          ))
        )}
      </div>
    </div>
  );
}