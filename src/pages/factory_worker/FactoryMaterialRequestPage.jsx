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
import { factoryProdApi } from '../../api/productionModuleApi';
import { useToast } from '../../components/common/Toast.jsx';
import { useAuth } from '../../context/AuthContext';
import { useLang } from '../../context/LangContext';

// ── Countdown badge ────────────────────────────────────────────────────────────
function CountdownBadge({ targetMs, label }) {
  const { t } = useLang();
  const effectiveLabel = label || t('production', 'mr_countdown_default_label');
  const [info, setInfo] = useState(() => countdownInfo(targetMs));
  useEffect(() => {
    if (!targetMs) return;
    const t2 = setInterval(() => setInfo(countdownInfo(targetMs)), 30000);
    return () => clearInterval(t2);
  }, [targetMs]);
  if (!info) return null;
  const cls = { red: 'bg-red-100 text-red-700', yellow: 'bg-amber-100 text-amber-700', normal: 'bg-emerald-50 text-emerald-700' }[info.color];
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>{effectiveLabel}: {info.label}</span>;
}

function cardBg(req) {
  if (req.status === 'PARTIALLY_RECEIVED') return 'bg-amber-50 border-amber-200';
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
  const { t } = useLang();
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
    // KHÔNG còn cho nhập tự do tạo nguyên liệu mới — gõ chỉ để lọc danh sách,
    // giá trị thật (onChange) chỉ được set khi người dùng bấm CHỌN 1 nguyên
    // liệu có sẵn trong danh mục (xem hàm select() bên dưới).
    onChange(null);
    calcPos();
    setOpen(true);
  };

  const handleFocus = () => { calcPos(); setOpen(true); };

  const handleBlur = () => {
    // Nếu rời khỏi ô mà chưa chọn nguyên liệu hợp lệ nào → xoá text gõ dở,
    // tránh hiểu nhầm là đã chọn trong khi thực chất chưa có giá trị.
    setTimeout(() => {
      if (!value?.name) setQ('');
    }, 150);
  };

  const select = (m) => {
    setQ(m.name);
    onChange({ name: m.name, unit: m.unit, materialId: m.id, orderUnit: m.orderUnit, conversionRatio: m.conversionRatio, factoryIds: m.factoryIds });
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
        <div className="px-3 py-2 text-xs text-[#8E8878] italic">{t('production', 'mr_all_materials_selected')}</div>
      ) : filtered.length === 0 ? (
        <div className="px-3 py-2 text-xs text-[#8E8878] italic">{t('production', 'mr_material_not_in_catalog')}</div>
      ) : (
        filtered.map((m) => (
          <button
            key={m.id}
            className="w-full text-left px-3 py-2.5 hover:bg-[#FAF7F2] transition-colors border-b border-black/5 last:border-0"
            onMouseDown={e => e.preventDefault()}
            onClick={() => select(m)}
          >
            <p className="text-sm text-[#1C1C1E] font-medium">{m.name}</p>
            <p className="text-xs text-[#8E8878]">
              {m.unit}{m.orderUnit && m.orderUnit !== m.unit ? ` · ĐVT đặt: ${m.orderUnit}` : ''}
            </p>
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
        placeholder={t('production', 'mr_select_material_placeholder')}
        value={q}
        onChange={e => handleInput(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
      />
      {dropdown}
    </div>
  );
}

// ── Request Card ───────────────────────────────────────────────────────────────
function RequestCard({ req, onReceive }) {
  const { t } = useLang();
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
              {req.productionFactoryName && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-50 text-blue-700">
                  {req.productionFactoryName}
                </span>
              )}
            </div>
            <p className="text-xs text-[#8E8878] mt-1">{req.itemCount} {t('production', 'mr_item_count_suffix')} · {t('production', 'mr_created_at_prefix')} {fmtTs(req.createdAt)}</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {req.requiredBy && <span className="text-xs text-[#8E8878]">{t('production', 'mr_required_by_label')}: {fmtDateTime(req.requiredBy)}</span>}
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
              <div key={item.id || i} className="flex items-start justify-between text-sm gap-2">
                <span className="text-[#1C1C1E]">{item.materialName}</span>
                <div className="text-right">
                  <div>
                    <span className="text-[#1C1C1E] font-medium">{item.qtyRequested} {item.unit}</span>
                    {item.qtyReceived != null && (
                      <span className="ml-2 text-emerald-600 text-xs">({t('production', 'mr_actual_received_label')}: {item.qtyReceived} {item.unit})</span>
                    )}
                    {Number(item.qtyOutstanding) > 0 && item.receiveStatus === 'PARTIAL' && (
                      <span className="ml-2 text-amber-600 text-xs font-medium">còn {item.qtyOutstanding} {item.unit}</span>
                    )}
                    {item.receiveStatus === 'CLOSED_SHORT' && (
                      <span className="ml-2 text-red-500 text-xs font-medium">chốt thiếu</span>
                    )}
                  </div>
                  {item.weighingLogs?.length > 0 && (
                    <p className="text-[11px] text-[#8E8878] mt-0.5">
                      {item.weighingLogs.length} {t('production', 'mr_weighing_count_suffix')}: {item.weighingLogs.join(' + ')} = {item.qtyReceived} {item.unit}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
          {req.vendors?.length > 0 && (
            <div className="mt-3 pt-3 border-t border-black/5">
              <p className="text-xs font-medium text-[#8E8878] mb-1">{t('production', 'mr_vendor_section_label')}</p>
              {req.vendors.map((v, i) => (
                <div key={v.id || i} className="text-xs text-[#1C1C1E] py-0.5">
                  <div>{v.vendorName}{v.contactPhone ? ` · ${v.contactPhone}` : ''}</div>
                  {(v.importReceiptInfo || v.serialImei) && (
                    <div className="flex flex-wrap gap-x-3 mt-0.5 text-[11px] text-[#8E8878]">
                      {v.importReceiptInfo && <span>Phiếu nhập: <span className="text-[#1C1C1E]">{v.importReceiptInfo}</span></span>}
                      {v.serialImei && <span>Serial/IMEI: <span className="text-[#1C1C1E]">{v.serialImei}</span></span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {(req.status === 'ORDERED' || req.status === 'PARTIALLY_RECEIVED') && (
            <div className="mt-4">
              <PrimaryButton className="w-full" onClick={() => onReceive(req)}>
                <CheckCircle2 size={14} className="mr-2" />
                {req.status === 'PARTIALLY_RECEIVED'
                  ? `Tiếp tục nhận hàng (đã ${req.receipts?.length || 0} đợt)`
                  : t('production', 'mr_confirm_receive_btn')}
              </PrimaryButton>
            </div>
          )}
          {req.status === 'RECEIVED' && (
            <>
              <p className="mt-3 text-xs text-emerald-600 font-medium">
                ✓ {t('production', 'mr_received_at_prefix')} {fmtDateTime(req.receivedAt)}
                {req.receipts?.length > 1 ? ` · ${req.receipts.length} đợt` : ''}
                {req.receiveNotes ? ` · ${req.receiveNotes}` : ''}
              </p>
              {req.shortageReason && (
                <p className="mt-1 text-xs text-red-500">Nhận thiếu — lý do: {req.shortageReason}</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Receive Modal ──────────────────────────────────────────────────────────────
// ── Nhập nhiều lần cân cho 1 nguyên liệu, tự cộng dồn ra tổng thực nhận ───────
function WeighingInput({ qtyRequested, unit, weighings, onChange }) {
  const { t } = useLang();
  // weighings: array string (mỗi lần cân, để giữ nguyên input người dùng đang gõ)
  const setWeighing = (idx, val) => {
    const next = weighings.map((w, i) => i === idx ? val : w);
    onChange(next);
  };
  const addRow = () => onChange([...weighings, '']);
  const removeRow = (idx) => {
    if (weighings.length <= 1) { onChange(['']); return; }
    onChange(weighings.filter((_, i) => i !== idx));
  };
  const setMax = () => onChange([String(qtyRequested)]);

  const total = weighings.reduce((sum, w) => {
    const n = parseFloat(w);
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);
  const validCount = weighings.filter(w => parseFloat(w) > 0).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-xs font-semibold text-[#8E8878] uppercase tracking-wider">{t('production', 'mr_weighing_count_label')} ({unit})</p>
        <button type="button" onClick={setMax}
          className="text-xs font-semibold text-[#C9A84C] hover:underline px-2 py-0.5">
          {t('production', 'mr_max_btn')} ({qtyRequested})
        </button>
      </div>
      <div className="space-y-1.5">
        {weighings.map((w, idx) => (
          <div key={idx} className="flex items-center gap-1.5">
            <span className="text-xs text-[#8E8878] w-5 flex-shrink-0 text-center">{idx + 1}.</span>
            <input
              type="number" min="0" step="0.001" value={w}
              onChange={e => setWeighing(idx, e.target.value)}
              className={inputCls + ' flex-1'} placeholder={`${t('production', 'mr_weighing_row_placeholder')} ${idx + 1}`} />
            <button type="button" onClick={() => removeRow(idx)}
              className="text-[#8E8878] hover:text-red-500 flex-shrink-0 p-1">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
      <button type="button" onClick={addRow}
        className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-[#1A2B1A] bg-[#E8F0E8] px-2.5 py-1.5 rounded-lg hover:bg-[#D8E8D8] transition-colors">
        <Plus size={12} /> {t('production', 'mr_add_weighing_row')}
      </button>
      <div className="mt-2 flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-[#E8DDD0]">
        <span className="text-xs text-[#8E8878]">
          {t('production', 'mr_total_label')} {validCount > 0 ? `(${validCount} ${t('production', 'mr_weighing_count_suffix')})` : ''}
        </span>
        <span className="text-sm font-bold text-[#1C1C1E]">{total.toFixed(3).replace(/\.?0+$/, '')} {unit}</span>
      </div>
    </div>
  );
}

// ── Nhận hàng NHIỀU ĐỢT ────────────────────────────────────────────────────────
//
// NCC giao lẻ (mỗi NCC giao một lúc) và có thể giao thiếu rồi giao bù. Vì vậy:
//   • [Lưu đợt nhận]          — lưu phần hàng VỪA nhận. Bấm được nhiều lần.
//                               Hàng vào kho ngay, phiếu chuyển "Đang nhận hàng".
//   • [Xác nhận đã giao xong]  — BƯỚC CUỐI. Khoá phiếu, kế toán mới xử lý được.
//
// Ô nhập của mỗi dòng là SL CỦA ĐỢT NÀY, không phải tổng cộng dồn.
function ReceiveModal({ req: initialReq, allMaterials = [], onClose, onDone }) {
  const toast = useToast();
  const { t } = useLang();

  const [req, setReq] = useState(initialReq);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [askShortage, setAskShortage] = useState(false);
  const [shortageReason, setShortageReason] = useState('');
  const [dirty, setDirty] = useState(false);   // đã lưu ít nhất 1 đợt trong phiên này?

  const matLookup = {};
  (allMaterials || []).forEach(m => { if (m.id) matLookup[m.id] = m; });

  // Dựng lại form nhập cho ĐỢT MỚI mỗi khi phiếu được refresh sau một lần lưu.
  const buildDraft = useCallback((r) => (r.items || []).map(i => {
    const fm = matLookup[i.factoryMaterialId];
    let defaultExpiry = null;
    if (fm?.shelfLifeDays > 0) defaultExpiry = Date.now() + fm.shelfLifeDays * 86400000;
    return {
      ...i,
      weighings: [''],
      expiryDate: defaultExpiry,
      // Đvt bị KHOÁ theo đợt đầu tiên: đợt 1 nhận theo Kg thì đợt bù cũng phải Kg,
      // nếu không tổng cộng dồn "50 Kg + 2 Thùng" sẽ vô nghĩa.
      receivedUnitType: i.receivedUnitType || 'STORAGE',
      unitLocked: !!i.receivedUnitType,
      _fm: fm,
    };
  }), [allMaterials]); // eslint-disable-line

  const [items, setItems] = useState(() => buildDraft(initialReq));

  const setItem = (idx, key, val) => setItems(p => p.map((it, i) => i === idx ? { ...it, [key]: val } : it));
  const setWeighings = (idx, arr) => setItem(idx, 'weighings', arr);
  const totalOf = (weighings) => weighings.reduce((s, w) => {
    const n = parseFloat(w);
    return s + (Number.isFinite(n) ? n : 0);
  }, 0);

  const num = (v) => Number(v || 0);
  const fmtQty = (n) => Number(n).toFixed(3).replace(/\.?0+$/, '');

  // Các dòng thực sự có hàng trong đợt đang nhập
  const batchLines = items.filter(it => totalOf(it.weighings) > 0);
  const allFulfilled = (req.items || []).every(i => i.receiveStatus === 'FULFILLED');
  const shortNames = (req.items || [])
    .filter(i => i.receiveStatus !== 'FULFILLED')
    .map(i => i.materialName);

  const refresh = async () => {
    const fresh = await factoryMaterialRequestApi.getById(req.id);
    setReq(fresh);
    setItems(buildDraft(fresh));
    setNotes('');
  };

  // ── Lưu 1 đợt ───────────────────────────────────────────────────────────────
  const handleSaveBatch = async () => {
    if (batchLines.length === 0) {
      toast('Chưa nhập số lượng nào cho đợt này', 'error');
      return;
    }
    setSaving(true);
    try {
      await factoryMaterialRequestApi.saveReceipt(req.id, {
        notes,
        // CHỈ gửi dòng thực giao. Dòng bỏ trống = NCC chưa giao ở đợt này,
        // gửi qty 0 sẽ khiến BE hiểu nhầm là đã nhận.
        items: batchLines.map(it => {
          const logs = it.weighings.map(w => parseFloat(w)).filter(n => Number.isFinite(n) && n > 0);
          return {
            itemId: it.id,
            qty: logs.reduce((s, n) => s + n, 0),
            expiryDate: it.expiryDate || null,
            receivedUnitType: it.receivedUnitType || 'STORAGE',
            weighingLogs: logs.length > 1 ? logs : null,
          };
        }),
      });
      toast('Đã lưu đợt nhận hàng', 'success');
      setDirty(true);
      await refresh();
    } catch (e) {
      toast(e?.response?.data?.message || t('production', 'mr_err_generic'), 'error');
    } finally { setSaving(false); }
  };

  // ── Chốt đã giao xong ───────────────────────────────────────────────────────
  const handleFinish = async () => {
    if (!allFulfilled && !shortageReason.trim()) {
      setAskShortage(true);
      toast('Còn nguyên liệu nhận thiếu — vui lòng nhập lý do', 'warning');
      return;
    }
    setFinishing(true);
    try {
      await factoryMaterialRequestApi.finishReceiving(req.id, {
        shortageReason: shortageReason.trim() || null,
      });
      toast('Đã xác nhận nhận hàng xong', 'success');
      onDone();
    } catch (e) {
      toast(e?.response?.data?.message || t('production', 'mr_err_generic'), 'error');
      setFinishing(false);
    }
  };

  const close = () => (dirty ? onDone() : onClose());

  // Nhóm dòng theo NCC để đối chiếu đúng thực tế "NCC nào giao đợt này"
  const groups = [];
  items.forEach((it, idx) => {
    const key = it.requestVendorId || 0;
    let g = groups.find(x => x.key === key);
    if (!g) { g = { key, name: it.suppliedByVendorName || 'Chưa gán NCC', rows: [] }; groups.push(g); }
    g.rows.push({ it, idx });
  });

  const nextSeq = (req.receipts?.length || 0) + 1;

  return (
    <Modal open onClose={close} title={`Nhận hàng — ${req.requestCode}`} size="lg">
      <div className="space-y-4" style={{ minHeight: 520 }}>

        <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
          <p className="text-xs text-amber-800">
            Nhập số lượng <b>vừa nhận ở đợt này</b>. NCC giao thiếu thì cứ lưu, đợt sau giao bù lưu tiếp.
            Chỉ bấm <b>Xác nhận đã giao xong</b> khi không còn hàng về nữa.
          </p>
        </div>

        {/* ── Lịch sử các đợt đã nhận ───────────────────────────────────────── */}
        {req.receipts?.length > 0 && (
          <div className="rounded-xl border border-[#E8DDD0] overflow-hidden">
            <p className="px-3 py-2 bg-[#F0EBE3] text-xs font-semibold text-[#5C4E3D]">
              Đã nhận {req.receipts.length} đợt
            </p>
            <div className="divide-y divide-black/5">
              {req.receipts.map(r => (
                <div key={r.id} className="px-3 py-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#1C1C1E]">Đợt {r.sequenceNo}</span>
                    <span className="text-[11px] text-[#8E8878]">
                      {fmtDateTime(r.receivedAt)}{r.receivedByName ? ` · ${r.receivedByName}` : ''}
                    </span>
                  </div>
                  {r.items?.map(li => (
                    <div key={li.id} className="flex justify-between text-[11px] text-[#5C4E3D] mt-0.5">
                      <span>{li.materialName}{li.vendorName ? ` · ${li.vendorName}` : ''}</span>
                      <span className="font-medium">+{fmtQty(li.qty)} {li.receivedUnit}</span>
                    </div>
                  ))}
                  {r.notes && <p className="text-[11px] text-[#8E8878] italic mt-1">{r.notes}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Form nhập đợt mới, nhóm theo NCC ──────────────────────────────── */}
        <p className="text-sm font-semibold text-[#1C1C1E]">Đợt {nextSeq} — nhập hàng vừa về</p>

        {groups.map(g => (
          <div key={g.key} className="space-y-2">
            <p className="text-xs font-bold text-[#C9A84C] uppercase tracking-wider">{g.name}</p>

            {g.rows.map(({ it: item, idx }) => {
              const done = num(item.qtyReceived);
              const left = num(item.qtyOutstanding);
              const closed = item.receiveStatus === 'CLOSED_SHORT';
              const full = item.receiveStatus === 'FULFILLED';

              const batch = totalOf(item.weighings);
              const fm = item._fm;
              const hasOrderUnit = fm?.orderUnit && fm.orderUnit !== fm.unit;
              const isOrder = item.receivedUnitType === 'ORDER';
              const displayUnit = isOrder && hasOrderUnit ? fm.orderUnit : item.unit;
              const ratio = fm?.conversionRatio;
              const stockQty = isOrder && ratio > 0 ? batch * ratio : null;

              // Cảnh báo giao DƯ (được phép, chỉ nhắc)
              const over = batch > 0 && left > 0 && batch - left > 0.001;
              const overNoLeft = batch > 0 && left <= 0;

              return (
                <div key={item.id || idx} className={`rounded-xl p-3 ${closed ? 'bg-red-50/60' : 'bg-[#FAF7F2]'}`}>
                  <div className="flex items-center justify-between mb-1 gap-2">
                    <span className="text-sm font-medium text-[#1C1C1E]">{item.materialName}</span>
                    {full && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold">Đã đủ</span>}
                    {closed && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-semibold">Chốt thiếu</span>}
                  </div>

                  {/* Đặt / Đã nhận / Còn lại */}
                  <div className="grid grid-cols-3 gap-2 mb-2 text-center">
                    <div className="bg-white rounded-lg py-1 border border-[#E8DDD0]">
                      <p className="text-[10px] text-[#8E8878]">Đặt</p>
                      <p className="text-xs font-bold text-[#1C1C1E]">{fmtQty(item.qtyRequested)} {item.unit}</p>
                    </div>
                    <div className="bg-white rounded-lg py-1 border border-[#E8DDD0]">
                      <p className="text-[10px] text-[#8E8878]">Đã nhận</p>
                      <p className="text-xs font-bold text-emerald-600">{done ? fmtQty(done) : '—'}</p>
                    </div>
                    <div className="bg-white rounded-lg py-1 border border-[#E8DDD0]">
                      <p className="text-[10px] text-[#8E8878]">Còn lại</p>
                      <p className={`text-xs font-bold ${left > 0 ? 'text-amber-600' : 'text-[#8E8878]'}`}>
                        {left > 0 ? fmtQty(left) : '—'}
                      </p>
                    </div>
                  </div>

                  {closed ? (
                    <p className="text-xs text-red-500">Đã chốt thiếu — không nhận thêm được.</p>
                  ) : (
                    <>
                      {hasOrderUnit && (
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs text-[#8E8878]">{t('production', 'mr_received_unit')}:</span>
                          <select
                            className="text-xs px-2 py-1 rounded-lg border border-[#E8DDD0] bg-white text-[#1C1C1E] disabled:opacity-60"
                            value={item.receivedUnitType}
                            disabled={item.unitLocked}
                            onChange={e => setItem(idx, 'receivedUnitType', e.target.value)}>
                            <option value="STORAGE">{fm.unit} (lưu kho)</option>
                            <option value="ORDER">{fm.orderUnit} (đặt hàng)</option>
                          </select>
                          {item.unitLocked && (
                            <span className="text-[10px] text-[#8E8878] italic">đã khoá theo đợt 1</span>
                          )}
                          {stockQty != null && batch > 0 && (
                            <span className="text-xs text-[#C9A84C] font-medium">
                              → {fmtQty(stockQty)} {fm.unit} vào kho
                            </span>
                          )}
                        </div>
                      )}

                      <WeighingInput
                        qtyRequested={left > 0 ? fmtQty(left) : fmtQty(item.qtyRequested)}
                        unit={displayUnit}
                        weighings={item.weighings}
                        onChange={arr => setWeighings(idx, arr)}
                      />

                      {(over || overNoLeft) && (
                        <p className="mt-1.5 text-xs font-medium text-amber-600">
                          Giao dư {fmtQty(batch - Math.max(left, 0))} {displayUnit} so với số còn lại — vẫn lưu được.
                        </p>
                      )}

                      {batch > 0 && (
                        <div className="mt-2">
                          <Field label={t('production', 'mr_expiry_label')}>
                            <DatePicker value={item.expiryDate} onChange={v => setItem(idx, 'expiryDate', v)}
                              placeholder={t('production', 'mr_expiry_placeholder')} minDate={new Date()} />
                          </Field>
                          <p className="text-[10px] text-[#8E8878] mt-0.5">HSD của riêng lô đợt này.</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ))}

        <Field label="Ghi chú đợt này">
          <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} className={inputCls}
            placeholder="VD: NCC Minh Phát giao trước phần ba rọi" />
        </Field>

        {/* ── Lý do nhận thiếu (chỉ khi chốt mà còn thiếu) ──────────────────── */}
        {askShortage && !allFulfilled && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-3 space-y-2">
            <p className="text-xs font-semibold text-red-600">
              Còn thiếu: {shortNames.join(', ')}
            </p>
            <textarea rows={2} value={shortageReason} onChange={e => setShortageReason(e.target.value)}
              className={inputCls} placeholder="Lý do nhận thiếu (bắt buộc) — VD: NCC hết hàng, không giao bù" />
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <SecondaryButton className="flex-1" onClick={handleSaveBatch} disabled={saving || batchLines.length === 0}>
            {saving ? 'Đang lưu…' : `Lưu đợt ${nextSeq}`}
          </SecondaryButton>
          <PrimaryButton className="flex-1" onClick={handleFinish}
            disabled={finishing || (req.receipts?.length || 0) === 0}>
            {finishing ? 'Đang chốt…' : 'Xác nhận đã giao xong'}
          </PrimaryButton>
        </div>
        {(req.receipts?.length || 0) === 0 && (
          <p className="text-[11px] text-[#8E8878] text-center">
            Phải lưu ít nhất 1 đợt nhận trước khi xác nhận đã giao xong.
          </p>
        )}
      </div>
    </Modal>
  );
}

// ── Create Modal ───────────────────────────────────────────────────────────────
function CreateModal({ onClose, onDone, allMaterials }) {
  const toast = useToast();
  const { t } = useLang();
  const [requiredBy, setRequiredBy] = useState(null);
  // items: [{ material: {...} | null, qtyRequested: string, orderUnitType: 'STORAGE'|'ORDER' }]
  const [items, setItems] = useState([{ material: null, qtyRequested: '', orderUnitType: 'STORAGE' }]);
  const [saving, setSaving] = useState(false);
  // Xưởng của phiếu — nv có thể kiêm nhiều xưởng, phải chọn đúng xưởng đặt hàng.
  const [factories, setFactories] = useState([]);
  const [factoryId, setFactoryId] = useState('');

  useEffect(() => {
    let alive = true;
    factoryProdApi.listMyFactories()
      .then(list => {
        if (!alive) return;
        setFactories(list || []);
        if ((list || []).length === 1) setFactoryId(list[0].id);
      })
      .catch(() => { if (alive) setFactories([]); });
    return () => { alive = false; };
  }, []);

  const addItem = () => setItems(p => [...p, { material: null, qtyRequested: '', orderUnitType: 'STORAGE' }]);
  const removeItem = (i) => setItems(p => p.filter((_, idx) => idx !== i));

  const setItemField = (i, key, val) =>
    setItems(p => p.map((it, idx) => idx === i ? { ...it, [key]: val } : it));

  const handleMaterialSelect = (i, selected) => {
    // selected = { name, unit } — unit từ factory_material
    setItems(p => p.map((it, idx) => idx === i ? { ...it, material: selected } : it));
  };

  // Các nguyên liệu chưa được chọn trong các dòng trước (trừ dòng hiện tại)
  // + lọc theo xưởng đang chọn
  const getAvailable = (currentIdx) => {
    const chosenNames = items
      .filter((_, idx) => idx !== currentIdx)
      .map(it => it.material?.name)
      .filter(Boolean);
    return allMaterials
      .filter(m => !chosenNames.includes(m.name))
      .filter(m => !factoryId || (m.factoryIds || []).includes(Number(factoryId)));
  };

  const handleSubmit = async () => {
    const invalid = items.some(it => !it.material?.name?.trim() || !it.qtyRequested);
    if (invalid) { toast(t('production', 'mr_err_need_all_fields'), 'error'); return; }
    if (!factoryId) { toast(t('production','mr_err_select_factory'), 'error'); return; }
    setSaving(true);
    try {
      await factoryMaterialRequestApi.create({
        requiredBy: requiredBy || null,
        productionFactoryId: Number(factoryId),
        items: items.map((it, i) => ({
          materialName: it.material.name.trim(),
          unit: it.orderUnitType === 'ORDER' && it.material.orderUnit ? it.material.orderUnit : (it.material.unit || 'Kg'),
          qtyRequested: parseFloat(it.qtyRequested),
          sortOrder: i,
          factoryMaterialId: it.material.materialId || null,
          orderUnitType: it.orderUnitType || 'STORAGE',
        })),
      });
      toast(t('production', 'mr_create_success'), 'success');
      onDone();
    } catch (e) {
      toast(e?.response?.data?.message || t('production', 'mr_err_generic'), 'error');
    } finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title={t('production', 'mr_create_title')} size="lg">
      <div className="space-y-4" style={{ minHeight: 420 }}>
        <Field label={t('production', 'dash_plan_factory')} required>
          {factories.length <= 1 ? (
            <div className={`${inputCls} bg-[#FAF7F2] text-[#8E8878]`} style={{ cursor: 'default' }}>
              {factories[0]?.name || 'Bạn chưa được gán xưởng nào'}
            </div>
          ) : (
            <select className={inputCls} value={factoryId}
              onChange={e => setFactoryId(e.target.value)}>
              <option value="">{t('production','omach_select_factory')}</option>
              {factories.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          )}
        </Field>

        <Field label={t('production', 'mr_required_by_optional')}>
          <DatePicker value={requiredBy} onChange={setRequiredBy} placeholder={t('production', 'mr_required_by_placeholder')} minDate={new Date()} />
        </Field>

        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-[#1C1C1E]">{t('production', 'mr_material_list_label')}</p>
            <button onClick={addItem}
              className="flex items-center gap-1 text-xs text-[#1A2B1A] font-semibold bg-[#E8F0E8] px-2.5 py-1.5 rounded-lg hover:bg-[#D8E8D8] transition-colors">
              <Plus size={12} /> {t('production', 'mr_add_row')}
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
                    placeholder={t('production', 'mr_qty_placeholder')}
                    value={item.qtyRequested}
                    onChange={e => setItemField(i, 'qtyRequested', e.target.value)}
                  />
                  {/* Chọn ĐVT: lưu kho hoặc đặt hàng */}
                  {item.material?.orderUnit && item.material.orderUnit !== item.material.unit ? (
                    <select
                      className="text-xs px-1.5 py-1 rounded-lg border border-[#E8DDD0] bg-white text-[#1C1C1E] flex-shrink-0"
                      style={{ width: 64 }}
                      value={item.orderUnitType}
                      onChange={e => setItemField(i, 'orderUnitType', e.target.value)}>
                      <option value="STORAGE">{item.material.unit}</option>
                      <option value="ORDER">{item.material.orderUnit}</option>
                    </select>
                  ) : item.material?.unit ? (
                    <span className="text-xs text-[#8E8878] font-medium flex-shrink-0 w-7">
                      {item.material.unit}
                    </span>
                  ) : null}
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
          <SecondaryButton className="flex-1" onClick={onClose}>{t('production', 'mr_cancel')}</SecondaryButton>
          <PrimaryButton className="flex-1" onClick={handleSubmit} disabled={saving}>
            {saving ? t('production', 'mr_creating') : t('production', 'mr_create_btn')}
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function FactoryMaterialRequestPage() {
  const { t } = useLang();
  const { role } = useAuth();
  // FACTORY_WORKER chỉ được xác nhận nhận hàng, không được tạo phiếu đặt hàng mới.
  const canCreate = role !== 'FACTORY_WORKER';
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
        <h1 className="text-xl font-bold text-[#1C1C1E]">{t('production', 'mr_page_title')}</h1>
        {canCreate && (
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-[#1A2B1A] text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-[#243524] transition-colors">
            <Plus size={16} /> {t('production', 'mr_create_btn')}
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-4 space-y-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8878]" />
          <input
            className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-[#E8DDD0] focus:outline-none focus:border-[#C9A84C] bg-[#FAF7F2] placeholder-[#8E8878]"
            placeholder={t('production', 'mr_search_placeholder')}
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { val: '', label: t('production', 'mr_filter_all') }, { val: 'NEW', label: t('production', 'mr_filter_new') },
            { val: 'ORDERED', label: t('production', 'mr_filter_ordered') },
            { val: 'PARTIALLY_RECEIVED', label: 'Đang nhận' },
            { val: 'RECEIVED', label: t('production', 'mr_filter_received') },
            { val: 'COMPLETED', label: t('production', 'mr_filter_completed') },
          ].map(s => (
            <button key={s.val} onClick={() => { setStatusFilter(s.val); setPage(0); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all
                ${statusFilter === s.val ? 'bg-[#1A2B1A] text-white border-[#1A2B1A]' : 'bg-white text-[#8E8878] border-[#E8DDD0] hover:border-[#1A2B1A]'}`}>
              {s.label}
            </button>
          ))}
          <DateRangePicker from={dateRange.from} to={dateRange.to}
            onChange={r => { setDateRange(r); setPage(0); }} placeholder={t('production', 'mr_filter_by_date')} />
        </div>
      </div>

      {loading
        ? <div className="space-y-3">{[1,2,3].map(i => <CardSkeleton key={i} />)}</div>
        : requests.length === 0
          ? <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-10 text-center">
              <Package size={32} className="mx-auto text-[#8E8878] mb-2" />
              <p className="text-[#8E8878] text-sm">{t('production', 'mr_empty')}</p>
            </div>
          : <div className="space-y-3">
              {requests.map(req => <RequestCard key={req.id} req={req} onReceive={setReceiveTarget} />)}
            </div>
      }

      {data?.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
            className="px-4 py-2 rounded-xl border border-[#E8DDD0] text-sm disabled:opacity-40 hover:bg-[#F0EBE3]">{t('production', 'mr_prev_page')}</button>
          <span className="px-4 py-2 text-sm text-[#8E8878]">{page + 1} / {data.totalPages}</span>
          <button disabled={page >= data.totalPages - 1} onClick={() => setPage(p => p + 1)}
            className="px-4 py-2 rounded-xl border border-[#E8DDD0] text-sm disabled:opacity-40 hover:bg-[#F0EBE3]">{t('production', 'mr_next_page')}</button>
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
        <ReceiveModal req={receiveTarget} allMaterials={allMaterials} onClose={() => setReceiveTarget(null)} onDone={() => { setReceiveTarget(null); load(); }} />
      )}
    </div>
  );
}