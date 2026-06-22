// src/pages/factory_worker/FactorySemiFinishedGoodsPage.jsx
// Kho bán thành phẩm (kg, chưa đóng gói) + Kho Scrap (hàng lỗi) của xưởng.
// Trưởng xưởng/Nhân viên xưởng (SUPER_FACTORY_WORKER/FACTORY_WORKER) xem tồn
// kho theo batch + lập Phiếu chuyển kho sang Kho thành phẩm (Bước 2). Kế toán
// kho xưởng (FACTORY_ACCOUNTANT) sẽ xác nhận nhận ở trang riêng.
import { useState, useEffect } from 'react';
import {
  Package, AlertTriangle, ChevronDown, ChevronUp, Search, Plus, X,
  ArrowRightLeft, Trash2, FileText, Clock, CheckCircle2, Printer,
} from 'lucide-react';
import useMinLoading from '../../hooks/useMinLoading.js';
import { CardSkeleton } from '../../components/ui/Skeleton.jsx';
import Modal from '../../components/ui/Modal.jsx';
import { Field, inputCls, PrimaryButton, SecondaryButton } from '../../components/ui';
import { Badge } from '../../components/ui/Badge';
import { semiFinishedGoodsApi } from '../../api/productionModuleApi';
import { useToast } from '../../components/common/Toast.jsx';
import { downloadBlob } from '../../utils/downloadBlob';

function fmtQty(v) {
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 }).format(Number(v || 0));
}

function fmtDateTime(ms) {
  if (!ms) return '—';
  return new Date(Number(ms)).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// ── Tab: Kho bán thành phẩm (tổng hợp theo sản phẩm, chi tiết theo batch) ─────
function SemiFinishedTab({ items, loading, onCreateTransfer }) {
  const [expandedName, setExpandedName] = useState(null);

  if (loading) return <div className="space-y-3">{[1, 2, 3].map(i => <CardSkeleton key={i} />)}</div>;
  if (items.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-10 text-center">
        <Package size={32} className="mx-auto text-[#8E8878] mb-2" />
        <p className="text-[#8E8878] text-sm">Kho bán thành phẩm trống</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        const expanded = expandedName === item.productName;
        return (
          <div key={item.productName || i} className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
            <button onClick={() => setExpandedName(expanded ? null : item.productName)}
              className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-[#FAF7F2] transition-colors">
              <div>
                <p className="font-semibold text-[#1C1C1E]">{item.productName}</p>
                <p className="text-sm text-[#8E8878] mt-0.5">
                  Tồn: <span className="font-semibold text-[#1A2B1A]">{fmtQty(item.totalQuantity)} {item.unit}</span>
                  {' · '}{item.lotCount || 0} mẻ
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={(e) => { e.stopPropagation(); onCreateTransfer(item); }}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-[#1A2B1A] text-white hover:bg-[#243524]">
                  <ArrowRightLeft size={13} /> Chuyển kho
                </button>
                {expanded ? <ChevronUp size={16} className="text-[#8E8878]" /> : <ChevronDown size={16} className="text-[#8E8878]" />}
              </div>
            </button>

            {expanded && (
              <div className="px-5 pb-4 border-t border-black/10">
                <p className="text-xs font-medium text-[#8E8878] mt-3 mb-2">Chi tiết theo mẻ sản xuất (FIFO — mẻ cũ nhất chuyển trước)</p>
                <div className="space-y-2">
                  {(item.lots || []).map((lot, idx) => (
                    <div key={lot.id || idx} className="flex items-center justify-between text-sm px-3 py-2 rounded-xl bg-[#FAF7F2]">
                      <div>
                        <p className="font-mono text-xs text-[#1C1C1E] font-semibold">{lot.batchCode || '—'}</p>
                        <p className="text-xs text-[#8E8878] mt-0.5">SX: {fmtDateTime(lot.manufactureDate).split(' ')[0]}</p>
                      </div>
                      <p className="font-semibold text-[#1A2B1A]">{fmtQty(lot.quantity)} {lot.unit}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Tab: Kho Scrap (hàng lỗi — chỉ xem, không thao tác) ───────────────────────
function ScrapTab({ items, loading }) {
  if (loading) return <div className="space-y-3">{[1, 2, 3].map(i => <CardSkeleton key={i} />)}</div>;
  if (items.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-10 text-center">
        <AlertTriangle size={32} className="mx-auto text-[#8E8878] mb-2" />
        <p className="text-[#8E8878] text-sm">Chưa ghi nhận hàng lỗi nào</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {items.map((s, i) => (
        <div key={s.id || i} className="bg-white rounded-2xl border border-red-100 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-[#1C1C1E]">{s.productName}</p>
            <Badge className="bg-red-50 text-red-600 ring-red-200">{fmtQty(s.quantity)} {s.unit}</Badge>
          </div>
          <p className="text-xs text-[#8E8878] mt-1">Mẻ: <span className="font-mono">{s.batchCode || '—'}</span> · {fmtDateTime(s.createdAt)}</p>
          {s.reason && <p className="text-xs text-red-600 mt-1.5 bg-red-50 rounded-lg px-2 py-1.5">⚠ {s.reason}</p>}
        </div>
      ))}
    </div>
  );
}

// ── Tab: Phiếu chuyển kho đã lập (xem trạng thái PENDING/RECEIVED) ────────────
function TransfersTab({ items, loading }) {
  const toast = useToast();
  const [printingId, setPrintingId] = useState(null);

  const printTransferOut = async (note) => {
    if (printingId) return;
    setPrintingId(note.id);
    try {
      const res = await semiFinishedGoodsApi.exportTransferOut(note.id);
      downloadBlob(res.data, `phieu-xuat-btp-${note.noteCode}.xlsx`);
    } catch (e) {
      toast(e?.response?.data?.message || 'Không thể in phiếu', 'error');
    } finally { setPrintingId(null); }
  };

  if (loading) return <div className="space-y-3">{[1, 2, 3].map(i => <CardSkeleton key={i} />)}</div>;
  if (items.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-10 text-center">
        <FileText size={32} className="mx-auto text-[#8E8878] mb-2" />
        <p className="text-[#8E8878] text-sm">Chưa có phiếu chuyển kho nào</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {items.map((note) => (
        <div key={note.id} className="bg-white rounded-2xl border border-black/5 shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="font-mono font-semibold text-sm text-[#1C1C1E]">{note.noteCode}</p>
            <div className="flex items-center gap-2">
              {note.status === 'PENDING' ? (
                <Badge className="bg-amber-50 text-amber-700 ring-amber-200"><Clock size={11} className="inline mr-1" />Chờ xác nhận</Badge>
              ) : (
                <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-200"><CheckCircle2 size={11} className="inline mr-1" />Đã nhận</Badge>
              )}
              <button onClick={() => printTransferOut(note)} disabled={printingId === note.id}
                className="flex items-center gap-1 text-[11px] font-semibold text-[#1A2B1A] bg-[#E8F0E8] px-2.5 py-1 rounded-lg hover:bg-[#D8E8D8] disabled:opacity-50">
                <Printer size={11} /> {printingId === note.id ? 'Đang xuất...' : 'In phiếu xuất BTP'}
              </button>
            </div>
          </div>
          <div className="space-y-1">
            {note.lines.map(l => (
              <div key={l.id} className="flex items-center justify-between text-sm">
                <span className="text-[#1C1C1E]">{l.productName}</span>
                <span className="text-[#8E8878]">
                  {fmtQty(l.transferredQty)} {l.unit}
                  {l.packagedQty != null && <span className="text-emerald-600"> → {fmtQty(l.packagedQty)} {l.packagedUnit}</span>}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-[#8E8878] mt-2">{note.createdByName} · {fmtDateTime(note.createdAt)}</p>
        </div>
      ))}
    </div>
  );
}

// ── Modal: Lập phiếu chuyển kho (1 hoặc nhiều sản phẩm) ───────────────────────
function CreateTransferModal({ initialProduct, semiItems, onClose, onSaved }) {
  const toast = useToast();
  const [lines, setLines] = useState(
    initialProduct
      ? [{ productName: initialProduct.productName, quantity: '', maxQty: initialProduct.totalQuantity, unit: initialProduct.unit }]
      : [{ productName: '', quantity: '', maxQty: 0, unit: 'Kg' }]
  );
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const addLine = () => setLines(p => [...p, { productName: '', quantity: '', maxQty: 0, unit: 'Kg' }]);
  const removeLine = (idx) => setLines(p => p.filter((_, i) => i !== idx));
  const setLine = (idx, key, val) => setLines(p => p.map((l, i) => {
    if (i !== idx) return l;
    if (key === 'productName') {
      const found = semiItems.find(s => s.productName === val);
      return { ...l, productName: val, maxQty: found?.totalQuantity || 0, unit: found?.unit || 'Kg' };
    }
    return { ...l, [key]: val };
  }));

  const setMax = (idx) => setLines(p => p.map((l, i) => i === idx ? { ...l, quantity: String(l.maxQty) } : l));

  const usedNames = (excludeIdx) => lines.filter((_, i) => i !== excludeIdx).map(l => l.productName).filter(Boolean);

  const submit = async () => {
    if (lines.some(l => !l.productName)) { setErr('Vui lòng chọn sản phẩm cho mỗi dòng'); return; }
    if (lines.some(l => !l.quantity || Number(l.quantity) <= 0)) { setErr('Vui lòng nhập số kg hợp lệ cho mỗi dòng'); return; }
    if (lines.some(l => Number(l.quantity) > Number(l.maxQty))) { setErr('Số kg chuyển không được vượt quá tồn kho bán thành phẩm'); return; }
    setSaving(true);
    setErr('');
    try {
      await semiFinishedGoodsApi.createTransfer({
        notes,
        lines: lines.map(l => ({ productName: l.productName, quantity: Number(l.quantity) })),
      });
      toast('Đã lập phiếu chuyển kho — chờ kế toán kho xác nhận nhận', 'success');
      onSaved();
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || 'Có lỗi xảy ra');
    } finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title="Lập phiếu chuyển kho bán thành phẩm → kho thành phẩm" size="lg">
      <div className="space-y-4">
        <p className="text-sm text-[#8E8878]">Trừ FIFO theo mẻ cũ nhất trước. Có thể chuyển nhiều sản phẩm trong 1 phiếu.</p>
        {err && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{err}</p>}

        <div className="space-y-3">
          {lines.map((line, idx) => {
            const available = semiItems.filter(s => !usedNames(idx).includes(s.productName));
            return (
              <div key={idx} className="bg-[#FAF7F2] rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#8E8878]">Sản phẩm #{idx + 1}</span>
                  {lines.length > 1 && (
                    <button onClick={() => removeLine(idx)} className="text-[#8E8878] hover:text-red-500">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <select className={inputCls} value={line.productName}
                  onChange={e => setLine(idx, 'productName', e.target.value)}>
                  <option value="">Chọn sản phẩm</option>
                  {available.map(s => <option key={s.productName} value={s.productName}>{s.productName} (tồn {fmtQty(s.totalQuantity)} {s.unit})</option>)}
                </select>
                {line.productName && (
                  <div className="flex gap-2">
                    <input type="number" min="0" step="0.001" className={inputCls + ' flex-1'}
                      placeholder={`Số ${line.unit} muốn chuyển`} value={line.quantity}
                      onChange={e => setLine(idx, 'quantity', e.target.value)} />
                    <button type="button" onClick={() => setMax(idx)}
                      className="text-xs font-semibold text-[#C9A84C] hover:underline px-2 whitespace-nowrap">
                      Tối đa ({fmtQty(line.maxQty)})
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button onClick={addLine}
          className="flex items-center gap-1 text-xs font-semibold text-[#C9A84C] hover:text-[#A07830]">
          <Plus size={13} /> Thêm sản phẩm
        </button>

        <Field label="Ghi chú">
          <textarea rows={2} className={inputCls} value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Ghi chú thêm (không bắt buộc)" />
        </Field>

        <div className="flex gap-2 pt-2">
          <SecondaryButton className="flex-1" onClick={onClose}>Huỷ</SecondaryButton>
          <PrimaryButton className="flex-1" onClick={submit} disabled={saving}>{saving ? 'Đang xử lý...' : 'Lập phiếu chuyển kho'}</PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function FactorySemiFinishedGoodsPage() {
  const [tab, setTab] = useState('semi'); // semi | scrap | transfers
  const [semiItems, setSemiItems] = useState([]);
  const [scrapItems, setScrapItems] = useState([]);
  const [transferItems, setTransferItems] = useState([]);
  const [loading, setLoading] = useMinLoading();
  const [search, setSearch] = useState('');
  const [createTarget, setCreateTarget] = useState(null); // null=chưa mở, {}=mở (chọn tay), {productName,...}=mở (đã chọn sẵn)
  const [showCreatePicker, setShowCreatePicker] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      semiFinishedGoodsApi.listSummary(search || undefined),
      semiFinishedGoodsApi.listScrap(0, 50),
      semiFinishedGoodsApi.listTransfers(undefined, 0, 50),
    ]).then(([semi, scrap, transfers]) => {
      setSemiItems(semi || []);
      setScrapItems(scrap || []);
      setTransferItems(transfers || []);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []); // eslint-disable-line
  useEffect(() => {
    const t = setTimeout(load, 400);
    return () => clearTimeout(t);
  }, [search]); // eslint-disable-line

  const pendingCount = transferItems.filter(t => t.status === 'PENDING').length;

  return (
    <div className="p-4 space-y-4 bg-[#F5F0EB] min-h-full">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#1C1C1E]">Kho bán thành phẩm</h1>
        <button onClick={() => setShowCreatePicker(true)}
          className="flex items-center gap-2 bg-[#1A2B1A] text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-[#243524] transition-colors">
          <ArrowRightLeft size={16} /> Chuyển kho
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white border border-black/5 rounded-xl p-1 w-fit shadow-sm overflow-x-auto">
        {[
          { id: 'semi', label: 'Kho bán thành phẩm', icon: Package },
          { id: 'scrap', label: 'Kho Scrap', icon: AlertTriangle },
          { id: 'transfers', label: `Phiếu chuyển kho${pendingCount > 0 ? ` (${pendingCount})` : ''}`, icon: FileText },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${tab === t.id ? 'bg-[#1C1C1E] text-white' : 'text-[#8E8878] hover:text-[#1C1C1E]'}`}>
            <t.icon size={14} />{t.label}
          </button>
        ))}
      </div>

      {tab === 'semi' && (
        <>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8878]" />
            <input
              className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-[#E8DDD0]
                focus:outline-none focus:border-[#C9A84C] bg-white placeholder-[#8E8878]"
              placeholder="Tìm tên thành phẩm..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <SemiFinishedTab items={semiItems} loading={loading} onCreateTransfer={setCreateTarget} />
        </>
      )}
      {tab === 'scrap' && <ScrapTab items={scrapItems} loading={loading} />}
      {tab === 'transfers' && <TransfersTab items={transferItems} loading={loading} />}

      {(createTarget || showCreatePicker) && (
        <CreateTransferModal
          initialProduct={createTarget}
          semiItems={semiItems}
          onClose={() => { setCreateTarget(null); setShowCreatePicker(false); }}
          onSaved={() => { setCreateTarget(null); setShowCreatePicker(false); load(); }} />
      )}
    </div>
  );
}
