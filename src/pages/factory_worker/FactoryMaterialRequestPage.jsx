// src/pages/factory_worker/FactoryMaterialRequestPage.jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Plus, X, Package, Search, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';
import useMinLoading from '../../hooks/useMinLoading.js';
import { Field, inputCls, PrimaryButton, SecondaryButton } from '../../components/ui';
import { CardSkeleton } from '../../components/ui/Skeleton.jsx';
import Modal from '../../components/ui/Modal.jsx';
import DateRangePicker from '../../components/ui/DateRangePicker.jsx';
import DatePicker from '../../components/ui/DatePicker.jsx';
import {
  factoryMaterialRequestApi, STATUS_CONFIG, UNITS, fmtTs, fmtDateTime, countdownInfo,
} from '../../api/materialRequestApi.js';
import { useToast } from '../../components/common/Toast.jsx';

// ── Countdown badge ────────────────────────────────────────────────────────────
function CountdownBadge({ targetMs, label = 'Nhận hàng dự kiến' }) {
  const [info, setInfo] = useState(() => countdownInfo(targetMs));
  useEffect(() => {
    if (!targetMs) return;
    const t = setInterval(() => setInfo(countdownInfo(targetMs)), 30000);
    return () => clearInterval(t);
  }, [targetMs]);
  if (!info) return null;
  const cls = { red: 'bg-red-100 text-red-700', yellow: 'bg-amber-100 text-amber-700', normal: 'bg-emerald-50 text-emerald-700' }[info.color];
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>{label}: {info.label}</span>;
}

function cardBg(req) {
  if (req.status === 'RECEIVED' || req.status === 'COMPLETED') return 'bg-white';
  if (!req.estimatedDelivery) return 'bg-white';
  const info = countdownInfo(req.estimatedDelivery);
  if (!info) return 'bg-white';
  if (info.color === 'red') return 'bg-red-50 border-red-200';
  if (info.color === 'yellow') return 'bg-amber-50 border-amber-200';
  return 'bg-white';
}

// ── Material search dropdown — dùng Portal để không bị clip bởi Modal ─────────
function MaterialSearchInput({ value, onChange, availableMaterials }) {
  const [q, setQ] = useState(value?.name || '');
  const [open, setOpen] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 });
  const inputRef = useRef(null);

  useEffect(() => { setQ(value?.name || ''); }, [value]);

  // Tính vị trí dropdown ngay dưới input
  const calcPos = () => {
    if (!inputRef.current) return;
    const r = inputRef.current.getBoundingClientRect();
    setDropPos({ top: r.bottom + window.scrollY + 2, left: r.left + window.scrollX, width: r.width });
  };

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (!inputRef.current?.contains(e.target) &&
          !document.getElementById('__mat_dropdown__')?.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const filtered = q.trim()
    ? availableMaterials.filter(m => m.name.toLowerCase().includes(q.toLowerCase()))
    : availableMaterials;

  const handleInput = (text) => {
    setQ(text);
    onChange({ name: text, unit: null });
    calcPos();
    setOpen(true);
  };

  const handleFocus = () => { calcPos(); setOpen(true); };

  const select = (m) => {
    setQ(m.name);
    onChange({ name: m.name, unit: m.unit });
    setOpen(false);
  };

  const dropdown = open ? createPortal(
    <div
      id="__mat_dropdown__"
      style={{
        position: 'absolute',
        top: dropPos.top,
        left: dropPos.left,
        width: dropPos.width,
        zIndex: 99999,
      }}
      className="bg-white border border-[#E8DDD0] rounded-xl shadow-xl max-h-52 overflow-y-auto"
    >
      {availableMaterials.length === 0 && !q ? (
        <div className="px-3 py-2 text-xs text-[#8E8878] italic">Đã chọn tất cả nguyên liệu</div>
      ) : filtered.length === 0 ? (
        <div className="px-3 py-2 text-xs text-[#8E8878] italic">Không tìm thấy — nhập tự do: <b>{q}</b></div>
      ) : (
        filtered.map((m) => (
          <button
            key={m.id}
            className="w-full text-left px-3 py-2.5 hover:bg-[#FAF7F2] transition-colors border-b border-black/5 last:border-0"
            onMouseDown={e => e.preventDefault()}
            onClick={() => select(m)}
          >
            <p className="text-sm text-[#1C1C1E] font-medium">{m.name}</p>
            <p className="text-xs text-[#8E8878]">{m.unit}</p>
          </button>
        ))
      )}
    </div>,
    document.body
  ) : null;

  return (
    <div className="w-full" ref={inputRef}>
      <input
        className={inputCls}
        placeholder="Chọn nguyên liệu..."
        value={q}
        onChange={e => handleInput(e.target.value)}
        onFocus={handleFocus}
      />
      {dropdown}
    </div>
  );
}

// ── Request Card ───────────────────────────────────────────────────────────────
function RequestCard({ req, onReceive }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CONFIG[req.status] || STATUS_CONFIG.NEW;
  const bg = cardBg(req);

  return (
    <div className={`rounded-2xl border ${bg} border-black/5 shadow-sm overflow-hidden`}>
      <button className="w-full text-left px-5 py-4" onClick={() => setExpanded(e => !e)}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm font-bold text-[#1C1C1E]">{req.requestCode}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.cls}`}>{cfg.label}</span>
            </div>
            <p className="text-xs text-[#8E8878] mt-1">{req.itemCount} nguyên liệu · Tạo {fmtTs(req.createdAt)}</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {req.requiredBy && <span className="text-xs text-[#8E8878]">Cần xử lý: {fmtDateTime(req.requiredBy)}</span>}
              {req.status === 'ORDERED' && req.estimatedDelivery && <CountdownBadge targetMs={req.estimatedDelivery} />}
            </div>
          </div>
          {expanded ? <ChevronUp size={16} className="text-[#8E8878] flex-shrink-0 mt-1" /> : <ChevronDown size={16} className="text-[#8E8878] flex-shrink-0 mt-1" />}
        </div>
      </button>

      {expanded && req.items && (
        <div className="px-5 pb-4 border-t border-black/5">
          <div className="mt-3 space-y-2">
            {req.items.map((item, i) => (
              <div key={item.id || i} className="flex items-center justify-between text-sm">
                <span className="text-[#1C1C1E]">{item.materialName}</span>
                <div className="text-right">
                  <span className="text-[#1C1C1E] font-medium">{item.qtyRequested} {item.unit}</span>
                  {item.qtyReceived != null && (
                    <span className="ml-2 text-emerald-600 text-xs">(thực nhận: {item.qtyReceived} {item.unit})</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          {req.vendors?.length > 0 && (
            <div className="mt-3 pt-3 border-t border-black/5">
              <p className="text-xs font-medium text-[#8E8878] mb-1">Nhà cung cấp</p>
              {req.vendors.map((v, i) => (
                <div key={v.id || i} className="text-xs text-[#1C1C1E]">
                  {v.vendorName}{v.contactPhone ? ` · ${v.contactPhone}` : ''}
                </div>
              ))}
            </div>
          )}
          {req.status === 'ORDERED' && (
            <div className="mt-4">
              <PrimaryButton className="w-full" onClick={() => onReceive(req)}>
                <CheckCircle2 size={14} className="mr-2" /> Xác nhận nhận hàng
              </PrimaryButton>
            </div>
          )}
          {req.status === 'RECEIVED' && (
            <p className="mt-3 text-xs text-emerald-600 font-medium">
              ✓ Đã nhận {fmtDateTime(req.receivedAt)}{req.receiveNotes ? ` · ${req.receiveNotes}` : ''}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Receive Modal ──────────────────────────────────────────────────────────────
function ReceiveModal({ req, onClose, onDone }) {
  const toast = useToast();
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState((req.items || []).map(i => ({ ...i, qtyReceived: i.qtyRequested, expiryDate: null })));
  const [saving, setSaving] = useState(false);
  const setItem = (idx, key, val) => setItems(prev => prev.map((it, i) => i === idx ? { ...it, [key]: val } : it));

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await factoryMaterialRequestApi.receive(req.id, {
        notes,
        items: items.map(it => ({ itemId: it.id, qtyReceived: parseFloat(it.qtyReceived) || 0, expiryDate: it.expiryDate || null })),
      });
      toast('Xác nhận nhận hàng thành công', 'success');
      onDone();
    } catch (e) {
      toast(e?.response?.data?.message || 'Có lỗi xảy ra', 'error');
    } finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title={`Xác nhận nhận hàng — ${req.requestCode}`} size="lg">
      <div className="space-y-4" style={{ minHeight: 520 }}>
        <p className="text-sm text-[#8E8878]">Nhập số lượng thực nhận và hạn sử dụng (nếu có) cho từng nguyên liệu.</p>
        <div className="space-y-3">
          {items.map((item, idx) => (
            <div key={item.id || idx} className="bg-[#FAF7F2] rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-[#1C1C1E]">{item.materialName}</span>
                <span className="text-xs text-[#8E8878]">Đặt: {item.qtyRequested} {item.unit}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Thực nhận">
                  <input type="number" min="0" step="0.001" value={item.qtyReceived}
                    onChange={e => setItem(idx, 'qtyReceived', e.target.value)} className={inputCls} placeholder="0" />
                </Field>
                <Field label="Đơn vị">
                  <input className={inputCls} value={item.unit} disabled />
                </Field>
              </div>
              <div className="mt-2">
                <Field label="Hạn sử dụng (không bắt buộc)">
                  <DatePicker value={item.expiryDate} onChange={val => setItem(idx, 'expiryDate', val)} placeholder="Chọn ngày hết hạn" minDate={new Date()} />
                </Field>
              </div>
            </div>
          ))}
        </div>
        <Field label="Ghi chú">
          <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} className={inputCls} placeholder="Ghi chú thêm (nếu có)" />
        </Field>
        <div className="flex gap-2 pt-2">
          <SecondaryButton className="flex-1" onClick={onClose}>Huỷ</SecondaryButton>
          <PrimaryButton className="flex-1" onClick={handleSubmit} disabled={saving}>{saving ? 'Đang xử lý...' : 'Xác nhận'}</PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

// ── Create Modal ───────────────────────────────────────────────────────────────
function CreateModal({ onClose, onDone, allMaterials }) {
  const toast = useToast();
  const [requiredBy, setRequiredBy] = useState(null);
  // items: [{ material: {name, unit} | null, unit: string, qtyRequested: string }]
  const [items, setItems] = useState([{ material: null, qtyRequested: '' }]);
  const [saving, setSaving] = useState(false);

  const addItem = () => setItems(p => [...p, { material: null, qtyRequested: '' }]);
  const removeItem = (i) => setItems(p => p.filter((_, idx) => idx !== i));

  const setItemField = (i, key, val) =>
    setItems(p => p.map((it, idx) => idx === i ? { ...it, [key]: val } : it));

  const handleMaterialSelect = (i, selected) => {
    // selected = { name, unit } — unit từ factory_material
    setItems(p => p.map((it, idx) => idx === i ? { ...it, material: selected } : it));
  };

  // Các nguyên liệu chưa được chọn trong các dòng trước (trừ dòng hiện tại)
  const getAvailable = (currentIdx) => {
    const chosenNames = items
      .filter((_, idx) => idx !== currentIdx)
      .map(it => it.material?.name)
      .filter(Boolean);
    return allMaterials.filter(m => !chosenNames.includes(m.name));
  };

  const handleSubmit = async () => {
    const invalid = items.some(it => !it.material?.name?.trim() || !it.qtyRequested);
    if (invalid) { toast('Vui lòng nhập đầy đủ tên và số lượng nguyên liệu', 'error'); return; }
    setSaving(true);
    try {
      await factoryMaterialRequestApi.create({
        requiredBy: requiredBy || null,
        items: items.map((it, i) => ({
          materialName: it.material.name.trim(),
          unit: it.material.unit || 'Kg',
          qtyRequested: parseFloat(it.qtyRequested),
          sortOrder: i,
        })),
      });
      toast('Tạo phiếu đặt hàng thành công', 'success');
      onDone();
    } catch (e) {
      toast(e?.response?.data?.message || 'Có lỗi xảy ra', 'error');
    } finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title="Tạo phiếu đặt hàng nguyên liệu" size="lg">
      <div className="space-y-4" style={{ minHeight: 420 }}>
        <Field label="Thời gian cần xử lý (không bắt buộc)">
          <DatePicker value={requiredBy} onChange={setRequiredBy} placeholder="Chọn deadline" minDate={new Date()} />
        </Field>

        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-[#1C1C1E]">Danh sách nguyên liệu</p>
            <button onClick={addItem}
              className="flex items-center gap-1 text-xs text-[#1A2B1A] font-semibold bg-[#E8F0E8] px-2.5 py-1.5 rounded-lg hover:bg-[#D8E8D8] transition-colors">
              <Plus size={12} /> Thêm dòng
            </button>
          </div>

          <div className="space-y-2">
            {items.map((item, i) => (
              <div key={i} className="bg-[#FAF7F2] rounded-xl p-3">
                <div className="flex items-center gap-2" style={{ paddingRight: 10 }}>
                  {/* Tên nguyên liệu — chiếm hết space */}
                  <div className="flex-1 min-w-0">
                    <MaterialSearchInput
                      value={item.material}
                      onChange={selected => handleMaterialSelect(i, selected)}
                      availableMaterials={getAvailable(i)}
                    />
                  </div>
                  {/* Số lượng + đơn vị — sát phải */}
                  <input
                    type="number" min="0" step="0.001"
                    className={`${inputCls} text-center flex-shrink-0`}
                    style={{ width: 72 }}
                    placeholder="SL"
                    value={item.qtyRequested}
                    onChange={e => setItemField(i, 'qtyRequested', e.target.value)}
                  />
                  {item.material?.unit && (
                    <span className="text-xs text-[#8E8878] font-medium flex-shrink-0 w-7">
                      {item.material.unit}
                    </span>
                  )}
                  {items.length > 1 && (
                    <button onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600 flex-shrink-0">
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <SecondaryButton className="flex-1" onClick={onClose}>Huỷ</SecondaryButton>
          <PrimaryButton className="flex-1" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Đang tạo...' : 'Tạo phiếu'}
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function FactoryMaterialRequestPage() {
  const [data, setData] = useState(null);
  const [allMaterials, setAllMaterials] = useState([]); // từ factory_material
  const [loading, setLoading] = useMinLoading();
  const [showCreate, setShowCreate] = useState(false);
  const [receiveTarget, setReceiveTarget] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateRange, setDateRange] = useState({ from: null, to: null });
  const [page, setPage] = useState(0);

  // Load danh sách nguyên liệu từ factory_material
  useEffect(() => {
    factoryMaterialRequestApi.listMaterials()
      .then(d => setAllMaterials(d || []))
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await factoryMaterialRequestApi.list({
        status: statusFilter || undefined,
        dateFrom: dateRange.from || undefined,
        dateTo: dateRange.to || undefined,
        search: search || undefined,
        page,
      });
      setData(res);
    } finally { setLoading(false); }
  }, [statusFilter, dateRange, search, page]);

  useEffect(() => { load(); }, [load]);

  const requests = data?.content || [];

  return (
    <div className="p-4 space-y-4 bg-[#F5F0EB] min-h-full">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#1C1C1E]">Phiếu đặt hàng nguyên liệu</h1>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-[#1A2B1A] text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-[#243524] transition-colors">
          <Plus size={16} /> Tạo phiếu
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-4 space-y-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8878]" />
          <input
            className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-[#E8DDD0] focus:outline-none focus:border-[#C9A84C] bg-[#FAF7F2] placeholder-[#8E8878]"
            placeholder="Tìm theo mã phiếu..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { val: '', label: 'Tất cả' }, { val: 'NEW', label: 'Mới tạo' },
            { val: 'ORDERED', label: 'Đã đặt' }, { val: 'RECEIVED', label: 'Đã nhận' },
            { val: 'COMPLETED', label: 'Hoàn thành' },
          ].map(s => (
            <button key={s.val} onClick={() => { setStatusFilter(s.val); setPage(0); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all
                ${statusFilter === s.val ? 'bg-[#1A2B1A] text-white border-[#1A2B1A]' : 'bg-white text-[#8E8878] border-[#E8DDD0] hover:border-[#1A2B1A]'}`}>
              {s.label}
            </button>
          ))}
          <DateRangePicker from={dateRange.from} to={dateRange.to}
            onChange={r => { setDateRange(r); setPage(0); }} placeholder="Lọc theo ngày" />
        </div>
      </div>

      {loading
        ? <div className="space-y-3">{[1,2,3].map(i => <CardSkeleton key={i} />)}</div>
        : requests.length === 0
          ? <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-10 text-center">
              <Package size={32} className="mx-auto text-[#8E8878] mb-2" />
              <p className="text-[#8E8878] text-sm">Chưa có phiếu đặt hàng nào</p>
            </div>
          : <div className="space-y-3">
              {requests.map(req => <RequestCard key={req.id} req={req} onReceive={setReceiveTarget} />)}
            </div>
      }

      {data?.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
            className="px-4 py-2 rounded-xl border border-[#E8DDD0] text-sm disabled:opacity-40 hover:bg-[#F0EBE3]">Trước</button>
          <span className="px-4 py-2 text-sm text-[#8E8878]">{page + 1} / {data.totalPages}</span>
          <button disabled={page >= data.totalPages - 1} onClick={() => setPage(p => p + 1)}
            className="px-4 py-2 rounded-xl border border-[#E8DDD0] text-sm disabled:opacity-40 hover:bg-[#F0EBE3]">Tiếp</button>
        </div>
      )}

      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onDone={() => { setShowCreate(false); load(); }}
          allMaterials={allMaterials}
        />
      )}
      {receiveTarget && (
        <ReceiveModal req={receiveTarget} onClose={() => setReceiveTarget(null)} onDone={() => { setReceiveTarget(null); load(); }} />
      )}
    </div>
  );
}