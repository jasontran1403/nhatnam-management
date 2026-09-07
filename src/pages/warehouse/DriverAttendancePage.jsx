/**
 * DriverAttendancePage.jsx — Điểm danh ODO tài xế
 *
 * THAY ĐỔI: Cho phép nhập ODO nhỏ hơn ngày trước, nhưng bắt buộc ghi chú lý do.
 */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Gauge, CheckCircle2, Clock, Bike, Truck, Save, Loader2, Pencil, Search, X, AlertTriangle } from 'lucide-react';
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
/**
 * Ô nhập ODO của một ca.
 *
 * @param minOdo      mốc sàn — nếu nhập nhỏ hơn thì cảnh báo + bắt nhập ghi chú
 * @param minLabel    giải thích mốc sàn
 * @param maxOdo      mốc trần — chỉ dùng cho ca đầu (không được lớn hơn ODO cuối ca)
 * @param maxLabel    giải thích mốc trần
 * @param currentNote ghi chú hiện tại (nếu trước đó đã nhập ODO bất thường)
 */
function OdoEditor({
  driverId, vehicleType, session, currentOdo, recordedBy, date, onSaved,
  minOdo = null, minLabel = '', maxOdo = null, maxLabel = '',
  blockedReason = '', currentNote = '',
}) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef();

  const startEdit = () => {
    if (blockedReason) { toast(blockedReason, 'error'); return; }
    setVal(currentOdo != null ? String(currentOdo) : '');
    setNote('');
    setEditing(true);
    setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select(); }, 30);
  };

  const num = Number(val);

  // maxOdo vẫn chặn cứng (đầu ca không được > cuối ca)
  const hardInvalid = val !== '' && !isNaN(num) && maxOdo != null && num > maxOdo;

  // ODO < mốc sàn → cảnh báo mềm: cho nhập nhưng phải có ghi chú
  const belowMin = val !== '' && !isNaN(num) && minOdo != null && num < minOdo;

  // Cần note khi ODO nhỏ hơn mốc sàn
  const needsNote = belowMin;
  const noteEmpty = note.trim() === '';

  const warningMsg =
    hardInvalid
      ? `Không được lớn hơn ${fmtOdo(maxOdo)} km${maxLabel ? ` (${maxLabel})` : ''}`
      : belowMin
        ? `Nhỏ hơn ${fmtOdo(minOdo)} km${minLabel ? ` (${minLabel})` : ''} — vui lòng ghi lý do`
        : '';

  const save = async () => {
    if (!val || isNaN(num) || num < 0) { toast('Nhập số km hợp lệ', 'error'); return; }
    if (hardInvalid) {
      toast(`ODO không được lớn hơn ${fmtOdo(maxOdo)} km${maxLabel ? ` — ${maxLabel}` : ''}`, 'error');
      return;
    }
    // Nếu nhỏ hơn mốc sàn → bắt buộc ghi chú
    if (needsNote && noteEmpty) {
      toast('Vui lòng nhập lý do khi ODO nhỏ hơn số đã ghi trước đó', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        driverId, vehicleType, sessionType: session, odometer: num, date,
      };
      // Chỉ gửi note khi ODO bất thường
      if (needsNote) {
        payload.note = note.trim();
      }
      const res = await api.post('/api/warehouse/driver-attendance', payload);
      onSaved(res.data?.data);
      setEditing(false);
      toast('Đã lưu', 'success');
    } catch (e) {
      toast(e?.response?.data?.message || 'Lỗi lưu', 'error');
    } finally { setSaving(false); }
  };

  const isStart = session === 'START';
  const color = isStart ? 'text-sky-600 dark:text-sky-300' : 'text-amber-600 dark:text-amber-300';

  if (editing) {
    return (
      <div className="space-y-1">
        <p className={`text-[10px] font-bold ${color}`}>{isStart ? 'Đầu ca' : 'Cuối ca'}</p>
        <div className="flex items-center gap-1">
          <div className="relative flex-1">
            <input ref={inputRef} type="number" inputMode="numeric"
              value={val} onChange={e => setVal(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (!needsNote || !noteEmpty)) save(); if (e.key === 'Escape') setEditing(false); }}
              className={`w-full h-8 px-2 pr-6 rounded-lg text-sm font-mono text-right border-2 focus:outline-none bg-surface
                ${hardInvalid ? 'border-red-500' : belowMin ? 'border-amber-500' : 'border-gold'}`} />
            <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] text-muted">km</span>
          </div>
          <button onClick={save} disabled={saving || hardInvalid || (needsNote && noteEmpty)}
            className="h-8 w-8 rounded-lg bg-gold text-white flex items-center justify-center flex-shrink-0 disabled:opacity-40">
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
          </button>
          <button onClick={() => setEditing(false)}
            className="h-8 w-7 rounded-lg border border-line text-muted text-xs flex items-center justify-center flex-shrink-0">
            ✕
          </button>
        </div>

        {/* Cảnh báo cứng (maxOdo) */}
        {hardInvalid && (
          <p className="text-[9px] text-red-500 font-medium leading-tight">{warningMsg}</p>
        )}

        {/* Cảnh báo mềm + ô nhập ghi chú khi ODO < mốc sàn */}
        {belowMin && !hardInvalid && (
          <div className="space-y-1.5 mt-1">
            <div className="flex items-start gap-1.5 bg-amber-50 dark:bg-amber-500/10 rounded-lg px-2 py-1.5">
              <AlertTriangle size={12} className="text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-[10px] text-amber-700 dark:text-amber-300 leading-tight">{warningMsg}</p>
            </div>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="VD: Đổi xe mới, sửa đồng hồ, xe khác…"
              rows={2}
              className={`w-full px-2 py-1.5 rounded-lg text-xs border-2 focus:outline-none bg-surface resize-none
                ${noteEmpty ? 'border-amber-400' : 'border-emerald-400'}`}
            />
            {noteEmpty && (
              <p className="text-[9px] text-amber-600 dark:text-amber-400 font-medium">
                * Bắt buộc nhập lý do
              </p>
            )}
          </div>
        )}

        {/* Thông tin mốc sàn (khi không vi phạm) */}
        {!belowMin && !hardInvalid && minOdo != null && (
          <p className="text-[9px] text-muted leading-tight">
            Tối thiểu {fmtOdo(minOdo)} km{minLabel ? ` — ${minLabel}` : ''}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      <p className={`text-[10px] font-bold ${color}`}>{isStart ? 'Đầu ca' : 'Cuối ca'}</p>
      {currentOdo != null ? (
        <div>
          <div className="flex items-center gap-1">
            <span className="text-sm font-mono font-bold text-ink">{fmtOdo(currentOdo)}</span>
            <span className="text-[10px] text-muted">km</span>
            <button onClick={startEdit} className="p-0.5 text-faint hover:text-gold">
              <Pencil size={10} />
            </button>
          </div>
          {/* Hiển thị ghi chú bất thường (ODO giảm) */}
          {currentNote && (
            <div className="flex items-start gap-1 mt-1 bg-amber-50 dark:bg-amber-500/10 rounded px-1.5 py-1">
              <AlertTriangle size={9} className="text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-[9px] text-amber-700 dark:text-amber-300 leading-tight">{currentNote}</p>
            </div>
          )}
        </div>
      ) : (
        <button onClick={startEdit}
          className={`flex items-center gap-1 text-xs font-medium
            ${blockedReason ? 'text-faint/60 cursor-not-allowed' : 'text-faint hover:text-gold'}`}
          title={blockedReason || undefined}>
          — Chưa nhập {!blockedReason && <Pencil size={10} />}
        </button>
      )}
      {recordedBy && (
        <p className="text-[9px] text-muted truncate">↳ {recordedBy}</p>
      )}
    </div>
  );
}

// ── Vehicle section (1 loại xe) ───────────────────────────────────────────────
function VehicleSection({ row, date, onUpdate }) {
  const isTruck = row.vehicleType === 'TRUCK';
  const bothDone = row.startOdometer != null && row.endOdometer != null;

  const prev = row.prevOdometer ?? null;
  const prevLabel = row.prevOdometerDate ? `số ngày ${fmtDateVN(row.prevOdometerDate)}` : 'lần ghi trước';

  const startMin = prev;
  const startMinLabel = prev != null ? prevLabel : '';
  const startMax = row.endOdometer ?? null;

  const endMin = row.startOdometer != null ? row.startOdometer : prev;
  const endMinLabel = row.startOdometer != null
    ? 'ODO đầu ca'
    : (prev != null ? prevLabel : '');

  return (
    <div className={`rounded-xl border p-3 space-y-2
      ${bothDone ? 'bg-emerald-50/40 dark:bg-emerald-500/4 border-emerald-200 dark:border-emerald-500/28' : 'bg-surface border-line-soft'}`}>
      <div className="flex items-center gap-1.5">
        {isTruck
          ? <Truck size={13} className="text-orange-500 flex-shrink-0" />
          : <Bike size={13} className="text-sky-500 flex-shrink-0" />}
        <span className="text-xs font-semibold text-ink-2">
          {isTruck ? 'Xe tải' : 'Xe máy'}
        </span>
        {bothDone && <CheckCircle2 size={12} className="text-emerald-500 ml-auto" />}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <OdoEditor driverId={row.driverId} vehicleType={row.vehicleType}
          session="START" currentOdo={row.startOdometer} recordedBy={row.startRecordedBy}
          minOdo={startMin} minLabel={startMinLabel}
          maxOdo={startMax} maxLabel="ODO cuối ca"
          currentNote={row.startNote}
          date={date} onSaved={d => onUpdate(row.driverId, row.vehicleType, 'start', d)} />
        <OdoEditor driverId={row.driverId} vehicleType={row.vehicleType}
          session="END" currentOdo={row.endOdometer} recordedBy={row.endRecordedBy}
          minOdo={endMin} minLabel={endMinLabel}
          currentNote={row.endNote}
          blockedReason={row.startOdometer == null
            ? 'Chưa điểm danh đầu ca — vui lòng nhập ODO đầu ca trước.'
            : ''}
          date={date} onSaved={d => onUpdate(row.driverId, row.vehicleType, 'end', d)} />
      </div>

      {bothDone && (
        <p className="text-[10px] text-gold font-semibold text-right">
          +{(row.endOdometer - row.startOdometer).toLocaleString('vi-VN')} km
        </p>
      )}
    </div>
  );
}

// ── KM Summary Modal ─────────────────────────────────────────────────────────
import MonthRangePicker from '../../components/ui/MonthRangePicker';

const MONTH_LABELS = ['T1','T2','T3','T4','T5','T6','T7','T8','T9','T10','T11','T12'];

function KmSummaryModal({ driver, onClose }) {
  const toast = useToast();
  const now = new Date();
  const curYear  = now.getFullYear();
  const curMonth = now.getMonth() + 1;

  // Mặc định: tháng hiện tại
  const defaultKey = `${curYear}-${String(curMonth).padStart(2, '0')}`;
  const [range, setRange] = useState({ from: defaultKey, to: defaultKey });
  const [loading, setLoading]     = useState(false);
  const [monthData, setMonthData] = useState([]);

  // Parse "YYYY-MM" → { year, month(1-indexed) }
  const parseYM = (k) => {
    if (!k) return null;
    const [y, m] = k.split('-').map(Number);
    return { year: y, month: m };
  };

  useEffect(() => {
    if (!range?.from || !range?.to) return;
    let alive = true;
    const fetchAll = async () => {
      setLoading(true);
      const results = [];
      const f = parseYM(range.from);
      const t = parseYM(range.to);
      if (!f || !t) return;

      // Duyệt từ from đến to (có thể cross-year)
      let y = f.year, m = f.month;
      const endY = t.year, endM = t.month;
      try {
        while (y < endY || (y === endY && m <= endM)) {
          const mStr = String(m).padStart(2, '0');
          const from = `${y}-${mStr}-01`;
          const lastDay = new Date(y, m, 0).getDate();
          const to   = `${y}-${mStr}-${String(lastDay).padStart(2, '0')}`;

          const res = await api.get('/api/warehouse/driver-odometer', {
            params: { from, to, includeInactive: true },
          });
          const arr = res.data?.data || res.data || [];
          const found = arr.find(d => d.driverId === driver.driverId);
          results.push({
            year: y, month: m,
            label: `${MONTH_LABELS[m - 1]}/${y}`,
            vehicles: found?.vehicles || [],
            totalKm: found?.totalKm ?? 0,
          });

          // Next month
          m++;
          if (m > 12) { m = 1; y++; }
        }
        if (alive) setMonthData(results);
      } catch {
        if (alive) toast('Không tải được dữ liệu KM', 'error');
      } finally {
        if (alive) setLoading(false);
      }
    };
    fetchAll();
    return () => { alive = false; };
  }, [range, driver.driverId]);

  const grandTotal = monthData.reduce((s, d) => s + (d.totalKm || 0), 0);

  const allVehicleTypes = useMemo(() => {
    const set = new Set();
    monthData.forEach(d => d.vehicles.forEach(v => set.add(v.vehicleType)));
    return [...set].sort();
  }, [monthData]);

  const totalByVehicle = useMemo(() => {
    const map = {};
    allVehicleTypes.forEach(vt => { map[vt] = 0; });
    monthData.forEach(d => d.vehicles.forEach(v => {
      map[v.vehicleType] = (map[v.vehicleType] || 0) + (v.km || 0);
    }));
    return map;
  }, [monthData, allVehicleTypes]);

  const VtIcon = (vt) => vt === 'TRUCK' ? Truck : Bike;
  const vtLabel = (vt) => vt === 'TRUCK' ? 'Xe tải' : 'Xe máy';

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-line-soft">
          <div>
            <p className="text-lg font-bold text-ink">{driver.driverName}</p>
            <p className="text-xs text-muted">Tổng hợp KM theo loại xe</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-canvas"><X size={18} /></button>
        </div>

        {/* Month range picker */}
        <div className="px-5 py-3 border-b border-line-soft">
          <MonthRangePicker
            value={range}
            onChange={(r) => setRange(r || { from: defaultKey, to: defaultKey })}
            placeholder="Chọn khoảng tháng"
          />
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-10 gap-2 text-muted">
              <Loader2 size={18} className="animate-spin text-gold" />
              <span className="text-sm">Đang tải...</span>
            </div>
          ) : monthData.length === 0 ? (
            <p className="text-sm text-muted text-center py-10">Không có dữ liệu</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-line-soft">
                  <th className="text-left py-2 pr-3 font-semibold text-muted">Tháng</th>
                  {allVehicleTypes.map(vt => {
                    const Icon = VtIcon(vt);
                    return (
                      <th key={vt} className="text-right py-2 px-3 font-semibold text-muted">
                        <span className="inline-flex items-center gap-1 justify-end">
                          <Icon size={12} /> {vtLabel(vt)}
                        </span>
                      </th>
                    );
                  })}
                  <th className="text-right py-2 pl-3 font-bold text-ink">Tổng</th>
                </tr>
              </thead>
              <tbody>
                {monthData.map(d => (
                  <tr key={`${d.year}-${d.month}`} className="border-b border-line-soft hover:bg-canvas/50">
                    <td className="py-2.5 pr-3 font-medium text-ink">{d.label}</td>
                    {allVehicleTypes.map(vt => {
                      const v = d.vehicles.find(x => x.vehicleType === vt);
                      return (
                        <td key={vt} className="py-2.5 px-3 text-right tabular-nums text-ink">
                          {v?.km != null ? fmtOdo(v.km) : '—'}
                        </td>
                      );
                    })}
                    <td className="py-2.5 pl-3 text-right font-bold text-gold tabular-nums">
                      {fmtOdo(d.totalKm)}
                    </td>
                  </tr>
                ))}
              </tbody>
              {monthData.length > 1 && (
                <tfoot>
                  <tr className="border-t-2 border-line-soft">
                    <td className="py-2.5 pr-3 font-bold text-ink">Tổng cộng</td>
                    {allVehicleTypes.map(vt => (
                      <td key={vt} className="py-2.5 px-3 text-right font-bold tabular-nums text-ink">
                        {fmtOdo(totalByVehicle[vt])}
                      </td>
                    ))}
                    <td className="py-2.5 pl-3 text-right font-extrabold text-gold tabular-nums text-base">
                      {fmtOdo(grandTotal)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-line-soft">
          <button onClick={onClose}
            className="w-full py-2.5 rounded-xl border border-line text-sm font-semibold text-muted hover:bg-canvas transition">
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Driver Card ───────────────────────────────────────────────────────────────
function DriverCard({ driver, date, onUpdate, onNameClick }) {
  const { driverId, driverName, vehicles } = driver;
  const allDone = vehicles.every(v => v.startOdometer != null && v.endOdometer != null);
  const anyDone = vehicles.some(v => v.startOdometer != null || v.endOdometer != null);
  const hasBoth = vehicles.length > 1;

  const sorted = [...vehicles].sort((a, b) =>
    (a.vehicleType === 'MOTORBIKE' ? 0 : 1) - (b.vehicleType === 'MOTORBIKE' ? 0 : 1));

  return (
    <div className={`bg-surface rounded-2xl border-2 overflow-hidden
      ${allDone ? 'border-emerald-200 dark:border-emerald-500/28' : anyDone ? 'border-gold/30' : 'border-line-soft'}`}>
      <div className={`flex items-center gap-2 px-4 py-2.5
        ${allDone ? 'bg-emerald-50/50 dark:bg-emerald-500/5' : anyDone ? 'bg-gold-tint' : 'bg-surface'}`}>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-ink cursor-pointer hover:text-gold active:text-gold/80 transition"
             onClick={() => onNameClick?.(driver)}>{driverName}</p>
        </div>
        {allDone
          ? <CheckCircle2 size={15} className="text-emerald-500 flex-shrink-0" />
          : anyDone
            ? <Clock size={15} className="text-gold flex-shrink-0" />
            : <span className="text-[10px] text-faint">Chưa điểm danh</span>}
      </div>

      <div className={`p-3 ${hasBoth ? 'grid grid-cols-2 gap-2' : ''}`}>
        {sorted.map(v => (
          <VehicleSection
            key={v.vehicleType}
            row={{ driverId, vehicleType: v.vehicleType, ...v }}
            date={date}
            onUpdate={onUpdate}
          />
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
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [kmSummaryDriver, setKmSummaryDriver] = useState(null);
  const debounceRef = useRef(null);
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

  const handleSearchChange = (val) => {
    setSearchInput(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearchQuery(val.trim().toLowerCase()), 300);
  };

  const clearSearch = () => {
    setSearchInput('');
    setSearchQuery('');
    clearTimeout(debounceRef.current);
  };

  const handleUpdate = (driverId, vehicleType, which, data) => {
    setRows(prev => prev.map(driver => {
      if (driver.driverId !== driverId) return driver;
      return {
        ...driver,
        vehicles: driver.vehicles.map(v => {
          if (v.vehicleType !== vehicleType) return v;
          return which === 'start'
            ? { ...v, startOdometer: data.odometer, startRecordedBy: data.recordedBy, startNote: data.note || null }
            : { ...v, endOdometer: data.odometer, endRecordedBy: data.recordedBy, endNote: data.note || null };
        }),
      };
    }));
  };

  // Filter: bỏ kho + search debounce
  const grouped = rows
    .filter(r => !EXCLUDE_NAMES.includes(r.driverName?.toLowerCase().trim()))
    .filter(r => !searchQuery || r.driverName?.toLowerCase().includes(searchQuery));

  const totalVehicles = grouped.reduce((s, r) => s + r.vehicles.length, 0);
  const doneStart = grouped.reduce((s, r) =>
    s + r.vehicles.filter(v => v.startOdometer != null).length, 0);
  const doneBoth = grouped.reduce((s, r) =>
    s + r.vehicles.filter(v => v.startOdometer != null && v.endOdometer != null).length, 0);

  return (
    <div className="min-h-screen bg-canvas">
      <div className="bg-surface border-b border-line-soft sticky top-0 z-10 px-4 sm:px-6 py-3 space-y-2.5">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gold/15 flex items-center justify-center flex-shrink-0">
              <Gauge size={16} className="text-gold" />
            </div>
            <div>
              <h1 className="font-bold text-ink text-sm">Điểm danh ODO</h1>
              <p className="text-[10px] text-muted">{fmtDateVN(today)} · {grouped.length} tài xế</p>
            </div>
          </div>
          {!loading && totalVehicles > 0 && (
            <div className="flex items-center gap-2 text-[10px]">
              <span className={`px-2 py-1 rounded-full font-semibold
                ${doneStart === totalVehicles ? 'bg-sky-100 dark:bg-sky-500/18 text-sky-700 dark:text-sky-300' : 'bg-surface-2 text-muted'}`}>
                🌅 {doneStart}/{totalVehicles}
              </span>
              <span className={`px-2 py-1 rounded-full font-semibold
                ${doneBoth === totalVehicles ? 'bg-emerald-100 dark:bg-emerald-500/18 text-emerald-700 dark:text-emerald-300' : 'bg-surface-2 text-muted'}`}>
                ✓ {doneBoth}/{totalVehicles}
              </span>
            </div>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={searchInput}
            onChange={e => handleSearchChange(e.target.value)}
            placeholder="Tìm tài xế..."
            className="w-full pl-8 pr-8 py-2 rounded-xl border border-line text-sm bg-surface focus:outline-none focus:border-gold focus:bg-surface transition-colors"
          />
          {searchInput && (
            <button onClick={clearSearch}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink">
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      <div className="px-4 sm:px-6 py-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-20 gap-2 text-muted">
            <Loader2 size={20} className="animate-spin text-gold" />
            <span className="text-sm">Đang tải...</span>
          </div>
        ) : grouped.length === 0 ? (
          <div className="text-center py-20 text-muted">
            <Gauge size={40} className="mx-auto mb-3 opacity-20" />
            <p className="text-sm">
              {searchQuery ? `Không tìm thấy "${searchInput}"` : 'Chưa có tài xế nào'}
            </p>
          </div>
        ) : (
          grouped.map(driver => (
            <DriverCard key={driver.driverId} driver={driver}
              date={today} onUpdate={handleUpdate} onNameClick={setKmSummaryDriver} />
          ))
        )}
      </div>

      {kmSummaryDriver && (
        <KmSummaryModal driver={kmSummaryDriver}
          onClose={() => setKmSummaryDriver(null)} />
      )}
    </div>
  );
}