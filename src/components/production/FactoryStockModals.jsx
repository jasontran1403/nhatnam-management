// src/components/production/FactoryStockModals.jsx
// Modal Xuất kho / Chuyển kho cho KHO NGUYÊN LIỆU XƯỞNG (Mục 2).
//
//  - Xuất kho: lý do (bắt buộc) + ảnh chứng từ (optional) + nhiều dòng nguyên liệu.
//  - Chuyển kho: chọn kho đích (dropdown "Tên kho — Loại kho": Kho bán / Trung chuyển
//    / Kho nguyên liệu xưởng / Kho xưởng) → chọn nguyên liệu bằng INPUT SEARCH có
//    dropdown, chỉ liệt kê nguyên liệu mà kho đích đang có (trùng tên).
import { useState, useEffect, useMemo, useRef } from 'react';
import { Search, X, Plus, Trash2, FlaskConical, CheckCircle2, AlertCircle } from 'lucide-react';
import Modal from '../ui/Modal.jsx';
import DatePicker from '../ui/DatePicker.jsx';
import ImageUploader from '../warehouse/ImageUploader';
import { Field, inputCls, PrimaryButton, SecondaryButton } from '../ui';
import { factoryStockApi, mixApi } from '../../api/productionModuleApi';
import { useFmt } from '../../utils/useFmt';
import { useToast } from '../common/Toast.jsx';

// ── Input search + dropdown (combobox) ───────────────────────────────────────
function SearchSelect({ options, value, onChange, placeholder, disabled, emptyText }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const boxRef = useRef(null);
  const selected = options.find(o => o.value === value) || null;

  useEffect(() => {
    const onDoc = e => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter(o => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);

  return (
    <div className="relative" ref={boxRef}>
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input className={inputCls + ' pl-9 pr-8'} disabled={disabled} placeholder={placeholder}
          value={open ? query : (selected ? selected.label : '')}
          onFocus={() => { if (!disabled) { setOpen(true); setQuery(''); } }}
          onChange={e => { setQuery(e.target.value); setOpen(true); }} />
        {selected && !disabled && (
          <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
            onClick={() => { onChange(''); setQuery(''); setOpen(false); }}><X size={14} /></button>
        )}
      </div>
      {open && !disabled && (
        <div className="absolute z-30 mt-1 w-full max-h-52 overflow-auto rounded-xl border border-line bg-surface shadow-lg">
          {filtered.length === 0
            ? <p className="px-3 py-3 text-xs text-muted">{emptyText || 'Không có kết quả'}</p>
            : filtered.map(o => (
              <button key={o.value} type="button"
                className={`w-full text-left px-3 py-2 text-sm hover:bg-canvas ${o.value === value ? 'bg-canvas font-semibold' : ''}`}
                onClick={() => { onChange(o.value); setOpen(false); setQuery(''); }}>
                <span className="text-ink">{o.label}</span>
                {o.hint && <span className="block text-[11px] text-muted">{o.hint}</span>}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

// ── Dòng nguyên liệu (dùng chung) ────────────────────────────────────────────
function MaterialLine({ options, line, onChange, onRemove, canRemove }) {
  const { fmtNum } = useFmt();
  const selected = options.find(o => `${o.materialName}||${o.unit}` === line.key) || null;
  return (
    <div className="flex gap-2 items-start">
      <div className="basis-[80%] min-w-0">
        <SearchSelect
          options={options.map(o => ({
            value: `${o.materialName}||${o.unit}`,
            label: `${o.materialName} (${o.unit})`,
            hint: `Tồn: ${fmtNum(o.availableQuantity, 3)} ${o.unit}`,
          }))}
          value={line.key}
          onChange={key => {
            const opt = options.find(o => `${o.materialName}||${o.unit}` === key);
            onChange({ ...line, key, materialName: opt?.materialName || '', unit: opt?.unit || '', available: opt?.availableQuantity });
          }}
          placeholder="Tìm & chọn nguyên liệu..."
          emptyText="Không có nguyên liệu phù hợp"
        />
        {selected && (
          <p className="text-[11px] text-muted mt-1 ml-1">
            Tồn khả dụng: {fmtNum(selected.availableQuantity, 3)} {selected.unit}
          </p>
        )}
      </div>
      <input type="number" step="0.001" min="0" className={inputCls + ' basis-[15%] min-w-0'}
        placeholder="SL" value={line.quantity}
        onChange={e => onChange({ ...line, quantity: e.target.value })} />
      {canRemove && (
        <button type="button" onClick={onRemove}
          className="mt-2 text-muted hover:text-red-500 flex-shrink-0"><Trash2 size={16} /></button>
      )}
    </div>
  );
}

const emptyLine = () => ({ key: '', materialName: '', unit: '', quantity: '', available: null });

// ── XUẤT KHO ─────────────────────────────────────────────────────────────────
export function ExportMaterialModal({ factoryId, sourceMaterials, onClose, onDone }) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [images, setImages] = useState([]);
  const [lines, setLines] = useState([emptyLine()]);
  const [saving, setSaving] = useState(false);

  // Nguồn = tồn kho xưởng hiện có (map về dạng option)
  const options = (sourceMaterials || [])
    .filter(m => Number(m.availableQuantity) > 0);

  const validLines = lines.filter(l => l.materialName && Number(l.quantity) > 0);

  const submit = async () => {
    if (!reason.trim()) return toast('Vui lòng nhập lý do xuất kho', 'error');
    if (!validLines.length) return toast('Vui lòng chọn ít nhất 1 nguyên liệu', 'error');
    for (const l of validLines) {
      if (l.available != null && Number(l.quantity) > Number(l.available))
        return toast(`"${l.materialName}" vượt tồn kho`, 'error');
    }
    setSaving(true);
    try {
      await factoryStockApi.exportStock({
        factoryId, reason: reason.trim(), documentImages: images,
        items: validLines.map(l => ({ materialName: l.materialName, unit: l.unit, quantity: Number(l.quantity) })),
      });
      toast('Đã xuất kho thành công', 'success');
      onDone();
    } catch (e) { toast(e?.response?.data?.message || 'Có lỗi xảy ra', 'error'); }
    finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title="Xuất kho nguyên liệu xưởng">
      <div className="space-y-4">
        <Field label="Lý do xuất kho *">
          <textarea className={inputCls + ' min-h-[70px]'} value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="VD: Hư hỏng, tiêu hao, kiểm kê..." />
        </Field>
        <div>
          <label className="block text-xs font-medium text-muted mb-1.5">Nguyên liệu *</label>
          <div className="space-y-2">
            {lines.map((l, i) => (
              <MaterialLine key={i} options={options} line={l}
                onChange={v => setLines(lines.map((x, idx) => idx === i ? v : x))}
                onRemove={() => setLines(lines.filter((_, idx) => idx !== i))}
                canRemove={lines.length > 1} />
            ))}
          </div>
          <button type="button" onClick={() => setLines([...lines, emptyLine()])}
            className="mt-2 flex items-center gap-1 text-xs font-semibold text-forest hover:underline">
            <Plus size={13} /> Thêm nguyên liệu
          </button>
        </div>
        <Field label="Ảnh chứng từ (không bắt buộc)">
          <ImageUploader value={images} onChange={setImages} />
        </Field>
        <div className="flex gap-2 pt-1">
          <SecondaryButton className="flex-1" onClick={onClose}>Huỷ</SecondaryButton>
          <PrimaryButton className="flex-1" onClick={submit} disabled={saving}>
            {saving ? 'Đang xử lý...' : 'Xuất kho'}
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

// ── CHUYỂN KHO ───────────────────────────────────────────────────────────────
export function TransferMaterialModal({ factoryId, onClose, onDone }) {
  const toast = useToast();
  const [targets, setTargets] = useState([]);
  const [targetKey, setTargetKey] = useState('');
  const [materials, setMaterials] = useState([]);
  const [loadingMats, setLoadingMats] = useState(false);
  const [note, setNote] = useState('');
  const [lines, setLines] = useState([emptyLine()]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!factoryId) return;
    factoryStockApi.listTransferTargets(factoryId)
      .then(d => setTargets(d || [])).catch(() => setTargets([]));
  }, [factoryId]);

  useEffect(() => {
    if (!targetKey || !factoryId) { setMaterials([]); setLines([emptyLine()]); return; }
    setLoadingMats(true);
    factoryStockApi.listTransferable(factoryId, targetKey)
      .then(d => { setMaterials(d || []); setLines([emptyLine()]); })
      .catch(() => setMaterials([]))
      .finally(() => setLoadingMats(false));
  }, [targetKey, factoryId]);

  const validLines = lines.filter(l => l.materialName && Number(l.quantity) > 0);

  const submit = async () => {
    if (!targetKey) return toast('Vui lòng chọn kho đích', 'error');
    if (!validLines.length) return toast('Vui lòng chọn ít nhất 1 nguyên liệu', 'error');
    for (const l of validLines) {
      if (l.available != null && Number(l.quantity) > Number(l.available))
        return toast(`"${l.materialName}" vượt tồn kho`, 'error');
    }
    setSaving(true);
    try {
      await factoryStockApi.transferStock({
        factoryId, targetKey, note, documentImages: [],
        items: validLines.map(l => ({ materialName: l.materialName, unit: l.unit, quantity: Number(l.quantity) })),
      });
      toast('Đã chuyển kho thành công — HSD và giá vốn được giữ nguyên', 'success', 4000);
      onDone();
    } catch (e) { toast(e?.response?.data?.message || 'Có lỗi xảy ra', 'error'); }
    finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title="Chuyển kho nguyên liệu xưởng">
      <div className="space-y-4">
        <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/28 rounded-xl px-3 py-2">
          HSD và giá vốn của từng lô được chuyển nguyên vẹn sang kho đích. Chỉ hiện
          nguyên liệu mà kho đích <strong>đã có (trùng tên)</strong>.
        </p>
        <Field label="Kho đích *">
          <select className={inputCls} value={targetKey} onChange={e => setTargetKey(e.target.value)}>
            <option value="">— Chọn kho đích —</option>
            {targets.map(t => (
              <option key={t.key} value={t.key}>{t.name} — {t.typeLabel}</option>
            ))}
          </select>
        </Field>

        <div>
          <label className="block text-xs font-medium text-muted mb-1.5">
            Nguyên liệu * {!targetKey && <span className="text-faint">(chọn kho đích trước)</span>}
          </label>
          {loadingMats
            ? <p className="text-xs text-muted">Đang tải...</p>
            : targetKey && materials.length === 0
              ? <p className="text-xs text-red-500">Kho đích không có nguyên liệu nào trùng tên với kho xưởng.</p>
              : (
                <div className="space-y-2">
                  {lines.map((l, i) => (
                    <MaterialLine key={i} options={materials} line={l}
                      onChange={v => setLines(lines.map((x, idx) => idx === i ? v : x))}
                      onRemove={() => setLines(lines.filter((_, idx) => idx !== i))}
                      canRemove={lines.length > 1} />
                  ))}
                </div>
              )
          }
          {targetKey && materials.length > 0 && (
            <button type="button" onClick={() => setLines([...lines, emptyLine()])}
              className="mt-2 flex items-center gap-1 text-xs font-semibold text-forest hover:underline">
              <Plus size={13} /> Thêm nguyên liệu
            </button>
          )}
        </div>

        <Field label="Ghi chú">
          <textarea className={inputCls} rows={2} value={note}
            onChange={e => setNote(e.target.value)} placeholder="Ghi chú..." />
        </Field>

        <div className="flex gap-2 pt-1">
          <SecondaryButton className="flex-1" onClick={onClose}>Huỷ</SecondaryButton>
          <PrimaryButton className="flex-1" onClick={submit} disabled={saving || !targetKey || materials.length === 0}>
            {saving ? 'Đang xử lý...' : 'Chuyển kho'}
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

// ── MIX GIA VỊ (Mục 4) ───────────────────────────────────────────────────────
// Chọn nhiều đầu vào (search dropdown) + số lượng → kiểm tra tồn → nếu đủ, nhập
// HSD (datepicker) + số lượng mix được (lẻ 3 số) → Trộn. Tạo 2 phiếu ở BE.
export function MixModal({ factoryId, sourceMaterials, onClose, onDone }) {
  const { fmtNum } = useFmt();
  const toast = useToast();

  const [outputs, setOutputs] = useState([]);       // nguyên liệu isMixable=true
  const [outputKey, setOutputKey] = useState('');   // "name||unit"
  const [lines, setLines] = useState([emptyLine()]);
  const [checkResult, setCheckResult] = useState(null);
  const [checking, setChecking] = useState(false);
  const [showMixForm, setShowMixForm] = useState(false);
  const [outQty, setOutQty] = useState('');
  const [outExpiry, setOutExpiry] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!factoryId) return;
    mixApi.listOutputs(factoryId).then(d => setOutputs(d || [])).catch(() => setOutputs([]));
  }, [factoryId]);

  const output = outputs.find(o => `${o.name}||${o.unit}` === outputKey) || null;

  // Đầu vào: TẤT CẢ nguyên liệu của kho đang chọn (kể cả tồn 0 — bước "Kiểm tra tồn"
  // sẽ báo thiếu), TRỪ sản phẩm đầu ra đang chọn.
  const inputOptions = (sourceMaterials || [])
    .filter(m => !output || m.materialName.trim().toLowerCase() !== output.name.trim().toLowerCase());

  const validLines = lines.filter(l => l.materialName && Number(l.quantity) > 0);

  // Đổi đầu vào/đầu ra → reset kết quả kiểm tra
  useEffect(() => { setCheckResult(null); setShowMixForm(false); }, [lines, outputKey]);

  const runCheck = async () => {
    if (!output) return toast('Vui lòng chọn sản phẩm đầu ra', 'error');
    if (!validLines.length) return toast('Vui lòng chọn ít nhất 1 nguyên liệu đầu vào', 'error');
    setChecking(true);
    try {
      const res = await mixApi.check({
        factoryId,
        inputs: validLines.map(l => ({ materialName: l.materialName, unit: l.unit, quantity: Number(l.quantity) })),
      });
      setCheckResult(res);
      if (res.sufficient) setShowMixForm(true);
      else toast('Không đủ tồn kho cho một số nguyên liệu', 'error');
    } catch (e) { toast(e?.response?.data?.message || 'Có lỗi xảy ra', 'error'); }
    finally { setChecking(false); }
  };

  const submit = async () => {
    const q = Number(outQty);
    if (!q || isNaN(q) || q <= 0) return toast('Số lượng mix được phải > 0', 'error');
    if (!outExpiry) return toast('Vui lòng chọn hạn sử dụng', 'error');
    setSaving(true);
    try {
      await mixApi.execute({
        factoryId,
        outputMaterialName: output.name,
        outputUnit: output.unit,
        outputQuantity: q,
        outputExpiryDate: outExpiry,
        inputs: validLines.map(l => ({ materialName: l.materialName, unit: l.unit, quantity: Number(l.quantity) })),
      });
      toast('Trộn thành công — đã tạo phiếu nhập & phiếu xuất kho sản xuất', 'success', 4000);
      onDone();
    } catch (e) { toast(e?.response?.data?.message || 'Có lỗi xảy ra', 'error'); }
    finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title="Mix gia vị">
      <div className="space-y-4">
        <Field label="Sản phẩm đầu ra * (nguyên liệu có thể mix)">
          <select className={inputCls} value={outputKey} onChange={e => setOutputKey(e.target.value)}>
            <option value="">— Chọn sản phẩm đầu ra —</option>
            {outputs.map(o => (
              <option key={`${o.name}||${o.unit}`} value={`${o.name}||${o.unit}`}>{o.name} ({o.unit})</option>
            ))}
          </select>
        </Field>

        <div>
          <label className="block text-xs font-medium text-muted mb-1.5">Nguyên liệu đầu vào *</label>
          <div className="space-y-2">
            {lines.map((l, i) => (
              <MaterialLine key={i} options={inputOptions} line={l}
                onChange={v => setLines(lines.map((x, idx) => idx === i ? v : x))}
                onRemove={() => setLines(lines.filter((_, idx) => idx !== i))}
                canRemove={lines.length > 1} />
            ))}
          </div>
          <button type="button" onClick={() => setLines([...lines, emptyLine()])}
            className="mt-2 flex items-center gap-1 text-xs font-semibold text-forest hover:underline">
            <Plus size={13} /> Thêm nguyên liệu
          </button>
        </div>

        {/* Kết quả kiểm tra tồn */}
        {checkResult && (
          <div className="rounded-xl border border-line p-3 space-y-1.5">
            <p className="text-xs font-semibold text-muted mb-1">Kết quả kiểm tra tồn</p>
            {checkResult.inputs.map((s, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5">
                  {s.enough
                    ? <CheckCircle2 size={14} className="text-emerald-500" />
                    : <AlertCircle size={14} className="text-red-500" />}
                  {s.materialName}
                </span>
                <span className={s.enough ? 'text-ink' : 'text-red-600 dark:text-red-300 font-medium'}>
                  cần {fmtNum(s.required, 3)} / tồn {fmtNum(s.available, 3)} {s.unit}
                </span>
              </div>
            ))}
            {checkResult.sufficient && checkResult.totalInputCost != null && (
              <p className="text-xs text-muted pt-1 border-t border-line mt-1">
                Tổng giá vốn đầu vào: <strong>{fmtNum(checkResult.totalInputCost, 0)} đ</strong>
              </p>
            )}
          </div>
        )}

        {/* Form nhập HSD + SL khi đủ tồn */}
        {showMixForm && (
          <div className="rounded-xl bg-canvas border border-line p-3 space-y-3">
            <p className="text-xs font-semibold text-forest flex items-center gap-1.5">
              <FlaskConical size={14} /> Thông tin lô thành phẩm
            </p>
            <Field label={`Số lượng mix được * (${output?.unit || ''})`}>
              <input type="number" step="0.001" min="0" className={inputCls}
                placeholder={`Số lượng (${output?.unit || ''})`}
                value={outQty} onChange={e => setOutQty(e.target.value)} />
            </Field>
            <Field label="Hạn sử dụng *">
              <DatePicker value={outExpiry} onChange={setOutExpiry} placeholder="Chọn HSD" />
            </Field>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <SecondaryButton className="flex-1" onClick={onClose}>Huỷ</SecondaryButton>
          {!showMixForm ? (
            <PrimaryButton className="flex-1" onClick={runCheck} disabled={checking}>
              {checking ? 'Đang kiểm tra...' : 'Kiểm tra tồn'}
            </PrimaryButton>
          ) : (
            <PrimaryButton className="flex-1" onClick={submit} disabled={saving}>
              {saving ? 'Đang trộn...' : 'Trộn'}
            </PrimaryButton>
          )}
        </div>
      </div>
    </Modal>
  );
}
