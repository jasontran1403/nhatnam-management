import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Tag, Plus, Pencil, Trash2, Lock, Info, Search, X } from 'lucide-react';
import { ownerSupplierApi } from '../../api/materialRequestApi';
import { supplyItemApi } from '../../api/supplyApi';
import useDebounce from '../../utils/useDebounce.js';
import Modal from '../../components/ui/Modal';
import { PrimaryButton, SecondaryButton, Field, inputCls } from '../../components/ui';

/**
 * DANH MỤC KHOẢN CHI — bản có phân loại Dịch vụ / Đồ dùng tiêu hao.
 *
 * <p>Thay thế component {@code ExpenseCategorySection} nội bộ trong
 * {@code pages/shared/SupplierManagementShared.jsx}. UI cũ là các "pill" sửa
 * tên tại chỗ, không chứa nổi 4 trường mới nên chuyển sang form modal.
 *
 * <h3>Chống phân mảnh tồn kho</h3>
 * Khi chọn loại <b>Đồ dùng tiêu hao</b>, ô Tên có autocomplete tra
 * {@code SupplyItem} đã tồn tại. Chọn một gợi ý ⇒ tên + quy cách + ĐVT được
 * điền sẵn và <b>KHOÁ LẠI</b>; muốn gõ tay phải bấm "Tạo mới". Đây là biện
 * pháp chính, đặc biệt để bảo vệ ô Quy cách (free text — nguồn phân mảnh lớn
 * nhất: "4L/chai" vs "4 lít/chai" vs "4l/ chai").
 */

const KIND_LABEL = {
  SERVICE: 'Dịch vụ',
  CONSUMABLE: 'Đồ dùng tiêu hao',
};

/* ── Autocomplete vật dụng ────────────────────────────────────────────────── */
function SupplyItemAutocomplete({ value, onPick, onManual, locked }) {
  const [q, setQ] = useState(value || '');
  const dq = useDebounce(q, 300);
  const [options, setOptions] = useState([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => { setQ(value || ''); }, [value]);

  useEffect(() => {
    if (!open || locked) return;
    let alive = true;
    supplyItemApi.suggest(dq)
      .then(d => { if (alive) setOptions(d || []); })
      .catch(() => { if (alive) setOptions([]); });
    return () => { alive = false; };
  }, [dq, open, locked]);

  useEffect(() => {
    const onDown = (e) => { if (!boxRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <input
          className={`${inputCls} ${locked ? 'bg-canvas pr-9' : ''}`}
          value={q}
          readOnly={locked}
          placeholder="VD: Nước rửa chén"
          onFocus={() => !locked && setOpen(true)}
          onChange={e => { setQ(e.target.value); onManual(e.target.value); setOpen(true); }}
        />
        {locked && (
          <Lock size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
        )}
      </div>

      {open && !locked && (
        <div className="absolute z-50 mt-1 w-full bg-surface rounded-xl border border-hairline-2 shadow-lg max-h-56 overflow-y-auto">
          {options.length === 0 ? (
            <p className="px-3 py-3 text-xs text-muted text-center">
              Chưa có vật dụng nào khớp — cứ gõ tiếp để tạo mới.
            </p>
          ) : options.map(o => (
            <button key={o.id} type="button"
              onClick={() => { onPick(o); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-canvas border-b border-hairline last:border-0">
              <div className="text-ink">{o.name}</div>
              <div className="text-xs text-muted">
                {o.specification || '(không có quy cách)'} · {o.unit}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Form thêm / sửa ──────────────────────────────────────────────────────── */
function CategoryFormModal({ open, editing, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: '', description: '', categoryKind: 'SERVICE',
    unit: '', specification: '', supplyItemId: null,
  });
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!open) return;
    setErr('');
    if (editing) {
      setForm({
        name: editing.name || '',
        description: editing.description || '',
        categoryKind: editing.categoryKind || 'SERVICE',
        unit: editing.unit || '',
        specification: editing.specification || '',
        supplyItemId: editing.supplyItemId ?? null,
      });
      // Đã liên kết vật dụng → khoá 3 ô để không vô tình tách bản ghi tồn kho
      setLocked(!!editing.supplyItemId);
    } else {
      setForm({ name: '', description: '', categoryKind: 'SERVICE', unit: '', specification: '', supplyItemId: null });
      setLocked(false);
    }
  }, [open, editing]);

  const isConsumable = form.categoryKind === 'CONSUMABLE';

  const pickExisting = (o) => {
    // Chọn từ autocomplete → điền sẵn cả 3 và khoá lại
    setForm(f => ({ ...f, name: o.name, specification: o.specification || '', unit: o.unit, supplyItemId: o.id }));
    setLocked(true);
  };

  const unlock = () => {
    setLocked(false);
    setForm(f => ({ ...f, supplyItemId: null }));
  };

  const submit = async () => {
    if (!form.name.trim()) { setErr('Tên nhãn khoản chi là bắt buộc'); return; }
    if (isConsumable) {
      if (!form.unit.trim()) { setErr('Đồ dùng tiêu hao bắt buộc nhập Đơn vị tính'); return; }
      if (!form.specification.trim()) { setErr('Đồ dùng tiêu hao bắt buộc nhập Quy cách'); return; }
    }
    setBusy(true); setErr('');
    const body = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      categoryKind: form.categoryKind,
      unit: isConsumable ? form.unit.trim() : null,
      specification: isConsumable ? form.specification.trim() : null,
      supplyItemId: isConsumable ? form.supplyItemId : null,
    };
    try {
      if (editing) await ownerSupplierApi.updateCategory(editing.id, body);
      else await ownerSupplierApi.createCategory(body);
      onSaved(); onClose();
    } catch (e) {
      setErr(e?.response?.data?.message || 'Không lưu được');
    } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose}
      title={editing ? 'Sửa nhãn khoản chi' : 'Thêm nhãn khoản chi'} size="md">
      <div className="space-y-4">
        {/* ── Radio phân loại ── */}
        <Field label="Loại khoản chi" required>
          <div className="flex gap-2">
            {['SERVICE', 'CONSUMABLE'].map(k => (
              <button key={k} type="button"
                onClick={() => setForm(f => ({ ...f, categoryKind: k }))}
                className={`flex-1 px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors
                  ${form.categoryKind === k
                    ? 'bg-gold/10 border-gold text-ink'
                    : 'bg-surface border-hairline-2 text-muted hover:bg-canvas'}`}>
                {KIND_LABEL[k]}
              </button>
            ))}
          </div>
        </Field>

        <p className="flex items-start gap-1.5 text-xs text-muted">
          <Info size={13} className="mt-0.5 flex-shrink-0" />
          {isConsumable
            ? 'Đồ dùng tiêu hao sẽ được NHẬP KHO khi người tạo phiếu xác nhận nhận hàng. Tồn kho gộp theo tên + quy cách + ĐVT, không phụ thuộc nhà cung cấp.'
            : 'Dịch vụ không nhập kho — chỉ ghi nhận chi phí. Đơn vị tính và quy cách để trống được.'}
        </p>

        {/* ── Tên: autocomplete khi là đồ dùng tiêu hao ── */}
        <Field label="Tên nhãn khoản chi" required
          hint={isConsumable && !locked
            ? 'Gõ để tìm vật dụng đã có — chọn gợi ý sẽ tự điền quy cách + ĐVT'
            : undefined}>
          {isConsumable ? (
            <SupplyItemAutocomplete
              value={form.name}
              locked={locked}
              onPick={pickExisting}
              onManual={(v) => setForm(f => ({ ...f, name: v, supplyItemId: null }))}
            />
          ) : (
            <input className={inputCls} value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="VD: Tiền điện" />
          )}
        </Field>

        {isConsumable && (
          <>
            {locked && (
              <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-canvas border border-hairline">
                <span className="text-xs text-muted">
                  Đang dùng vật dụng có sẵn — tên, quy cách, ĐVT đã khoá để không tách tồn kho.
                </span>
                <button type="button" onClick={unlock}
                  className="text-xs font-semibold text-gold hover:text-gold-strong whitespace-nowrap ml-2">
                  Tạo mới
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Field label="Quy cách" required>
                <input className={`${inputCls} ${locked ? 'bg-canvas' : ''}`}
                  readOnly={locked} value={form.specification}
                  onChange={e => setForm(f => ({ ...f, specification: e.target.value }))}
                  placeholder="VD: 4L/chai" />
              </Field>
              <Field label="Đơn vị tính" required>
                <input className={`${inputCls} ${locked ? 'bg-canvas' : ''}`}
                  readOnly={locked} value={form.unit}
                  onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                  placeholder="VD: Chai" />
              </Field>
            </div>
          </>
        )}

        <Field label="Ghi chú">
          <input className={inputCls} value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        </Field>

        {err && <p className="text-xs text-red-600 dark:text-red-300">{err}</p>}

        <div className="flex items-center justify-end gap-2">
          <SecondaryButton onClick={onClose}>Huỷ</SecondaryButton>
          <PrimaryButton onClick={submit} loading={busy}>Lưu</PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

/* ── Section chính ────────────────────────────────────────────────────────── */
export default function ExpenseCategorySection({ canManage }) {
  const [cats, setCats] = useState(null);
  const [open, setOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    try { setCats(await ownerSupplierApi.listCategories(false) || []); }
    catch { setCats([]); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const activeCats = (cats || []).filter(c => c.active);

  /* Lọc ngay trên client — danh mục đã nạp sẵn toàn bộ, gọi lại API mỗi lần gõ
     chỉ tổ chớp nháy. Bỏ dấu tiếng Việt để gõ "quet nha" vẫn ra "Chổi quét nhà",
     và tìm cả trong Quy cách / ĐVT / Ghi chú chứ không riêng tên nhãn. */
  const filtered = useMemo(() => {
    const norm = (s) => (s || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd').replace(/Đ/g, 'D')
      .toLowerCase().trim();

    const nq = norm(q);
    if (!nq) return cats || [];
    return (cats || []).filter(c =>
      norm(c.name).includes(nq)
      || norm(c.specification).includes(nq)
      || norm(c.unit).includes(nq)
      || norm(c.description).includes(nq));
  }, [cats, q]);

  const toggleActive = async (c) => {
    setErr('');
    try { await ownerSupplierApi.updateCategory(c.id, { active: !c.active }); await load(); }
    catch (e) { setErr(e?.response?.data?.message || 'Không cập nhật được'); }
  };

  const doDelete = async (c) => {
    if (!window.confirm(`Ẩn nhãn "${c.name}"? Nhãn sẽ không còn chọn được khi lập phiếu chi hoặc phiếu đặt văn phòng phẩm (phiếu cũ giữ nguyên).`)) return;
    setErr('');
    try { await ownerSupplierApi.deleteCategory(c.id); await load(); }
    catch (e) { setErr(e?.response?.data?.message || 'Không xoá được'); }
  };

  return (
    <div className="bg-surface rounded-2xl border border-hairline shadow-sm overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-4 py-3.5">
        <div className="flex items-center gap-2">
          <Tag size={16} className="text-gold" />
          <span className="text-sm font-semibold text-ink">Danh mục khoản chi</span>
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-gold/10 text-gold border border-gold/30">
            Dùng chung
          </span>
          {cats && <span className="text-xs text-muted">({activeCats.length} nhãn)</span>}
        </div>
        <span className="text-xs text-muted">{open ? 'Thu gọn' : 'Mở rộng'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-hairline pt-3 space-y-3">
          <p className="text-xs text-muted">
            {canManage
              ? 'Danh mục DÙNG CHUNG cho tất cả nhà cung cấp — tạo nhãn một lần, mọi NCC đều chọn được. Nhãn loại "Đồ dùng tiêu hao" sẽ được nhập kho văn phòng phẩm khi nhận hàng.'
              : 'Danh mục khoản chi dùng chung cho mọi nhà cung cấp (do chủ quản lý).'}
          </p>

          {err && <p className="text-xs text-red-600 dark:text-red-300">{err}</p>}

          {/* Ô tìm kiếm — chỉ hiện khi danh mục đủ dài để cần tìm */}
          {cats != null && cats.length > 0 && (
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={q} onChange={e => setQ(e.target.value)}
                placeholder="Tìm nhãn, quy cách, ĐVT…"
                className={`${inputCls} pl-9 pr-9`} />
              {q && (
                <button type="button" onClick={() => setQ('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
                  title="Xoá tìm kiếm">
                  <X size={14} />
                </button>
              )}
            </div>
          )}

          {cats == null ? (
            <div className="space-y-2">{[1, 2].map(i => <div key={i} className="h-10 bg-canvas rounded-xl animate-pulse" />)}</div>
          ) : cats.length === 0 ? (
            <p className="text-xs text-muted py-2">Chưa có nhãn nào{canManage ? ' — hãy thêm nhãn đầu tiên.' : '.'}</p>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-muted py-3 text-center">
              Không có nhãn nào khớp “{q}”.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase text-muted bg-canvas/60">
                    <th className="px-3 py-2 text-left">Nhãn</th>
                    <th className="px-3 py-2 text-left">Loại</th>
                    <th className="px-3 py-2 text-left">Quy cách</th>
                    <th className="px-3 py-2 text-left">ĐVT</th>
                    {canManage && <th className="px-3 py-2 text-right"></th>}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => (
                    <tr key={c.id} className={`border-t border-hairline ${c.active ? '' : 'opacity-50'}`}>
                      <td className="px-3 py-2">
                        <span className={c.active ? 'text-ink' : 'line-through text-faint'}>{c.name}</span>
                        {c.description && <div className="text-xs text-muted">{c.description}</div>}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium
                          ${c.categoryKind === 'CONSUMABLE'
                            ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                            : 'bg-surface-2 text-ink-2'}`}>
                          {KIND_LABEL[c.categoryKind] || 'Dịch vụ'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-muted">{c.specification || '—'}</td>
                      <td className="px-3 py-2 text-muted">{c.unit || '—'}</td>
                      {canManage && (
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          <button onClick={() => { setEditing(c); setFormOpen(true); }} title="Sửa"
                            className="text-muted hover:text-gold p-1"><Pencil size={13} /></button>
                          <button onClick={() => toggleActive(c)} title={c.active ? 'Ẩn' : 'Bật lại'}
                            className="text-muted hover:text-amber-600 dark:text-amber-300 text-[11px] font-semibold px-1.5">
                            {c.active ? 'Ẩn' : 'Bật'}
                          </button>
                          <button onClick={() => doDelete(c)} title="Xoá (ẩn)"
                            className="text-muted hover:text-red-600 dark:text-red-300 p-1"><Trash2 size={13} /></button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {canManage && (
            <button onClick={() => { setEditing(null); setFormOpen(true); }}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-gold hover:text-gold-strong">
              <Plus size={14} /> Thêm nhãn khoản chi
            </button>
          )}
        </div>
      )}

      <CategoryFormModal open={formOpen} editing={editing}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        onSaved={load} />
    </div>
  );
}
