// src/pages/factory_accountant/FactoryAccountantTransfersPage.jsx
// Kế toán kho xưởng (FACTORY_ACCOUNTANT) xác nhận nhận Phiếu chuyển kho từ
// Kho bán thành phẩm. Mỗi dòng sản phẩm: nhập số lượng đóng gói thực tế (túi/
// hộp) + tổng trọng lượng thực cân (BẮT BUỘC) — hệ thống tự tính hao hụt
// = kg đã chuyển − kg thực cân, ghi vào Kho thành phẩm theo đơn vị đóng gói,
// và tự lập Biên bản hao hụt đóng gói nếu có chênh lệch. Xác nhận 1 LẦN DUY
// NHẤT cho cả phiếu (không chia nhỏ theo đợt).
import { useState, useEffect } from 'react';
import {
  FileText, Clock, CheckCircle2, ChevronDown, ChevronUp, Package, AlertTriangle, Printer, FileWarning,
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

// ── Modal: Xác nhận nhận (nhập số lượng đóng gói + cân thực tế từng dòng) ────
function ReceiveTransferModal({ note, onClose, onSaved }) {
  const toast = useToast();
  const [lines, setLines] = useState(
    note.lines.map(l => ({ lineId: l.id, packagedQty: l.estimatedPackagedQty != null ? String(l.estimatedPackagedQty) : '', actualReceivedWeight: '' }))
  );
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const setLine = (idx, key, val) => setLines(p => p.map((l, i) => i === idx ? { ...l, [key]: val } : l));

  const lossPreview = (line, idx) => {
    const w = Number(lines[idx].actualReceivedWeight);
    if (!w || w <= 0) return null;
    const diff = Number(line.transferredQty) - w;
    return diff > 0.0001 ? diff : 0;
  };

  const submit = async () => {
    if (lines.some(l => !l.actualReceivedWeight || Number(l.actualReceivedWeight) <= 0)) {
      setErr('Vui lòng nhập trọng lượng thực cân cho tất cả sản phẩm'); return;
    }
    setSaving(true);
    setErr('');
    try {
      await semiFinishedGoodsApi.confirmReceive(note.id, {
        notes,
        lines: lines.map(l => ({
          lineId: l.lineId,
          packagedQty: l.packagedQty ? Number(l.packagedQty) : null,
          actualReceivedWeight: Number(l.actualReceivedWeight),
        })),
      });
      toast('Đã xác nhận nhận hàng — đã ghi vào kho thành phẩm', 'success', 4000);
      onSaved();
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || 'Có lỗi xảy ra');
    } finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title={`Xác nhận nhận hàng — ${note.noteCode}`} size="lg">
      <div className="space-y-4">
        <p className="text-sm text-[#8E8878]">
          Nhập số lượng đóng gói thực tế đếm được + tổng trọng lượng thực cân của tất cả gói đã đóng cho từng sản phẩm.
          Hao hụt sẽ tự tính = kg đã chuyển − kg thực cân. Chỉ xác nhận được <b>1 lần duy nhất</b> cho cả phiếu.
        </p>
        {err && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{err}</p>}

        <div className="space-y-3">
          {note.lines.map((line, idx) => {
            const loss = lossPreview(line, idx);
            return (
              <div key={line.id} className="bg-[#FAF7F2] rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-[#1C1C1E]">{line.productName}</span>
                  <span className="text-xs text-[#8E8878]">Đã chuyển: {fmtQty(line.transferredQty)} {line.unit}</span>
                </div>
                {line.estimatedPackagedQty != null && (
                  <p className="text-[11px] text-[#8E8878] mb-2">
                    Ước tính dự kiến: ~{fmtQty(line.estimatedPackagedQty)} {line.sourceBatches?.[0]?.packagedUnit || 'túi'} (chỉ tham khảo, không dùng tính hao hụt)
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Số lượng đóng gói thực tế">
                    <input type="number" min="0" step="1" className={inputCls}
                      placeholder="VD: 59" value={lines[idx].packagedQty}
                      onChange={e => setLine(idx, 'packagedQty', e.target.value)} />
                  </Field>
                  <Field label={`Tổng trọng lượng thực cân (${line.unit})`} required>
                    <input type="number" min="0" step="0.001" className={inputCls}
                      placeholder="VD: 29.8" value={lines[idx].actualReceivedWeight}
                      onChange={e => setLine(idx, 'actualReceivedWeight', e.target.value)} />
                  </Field>
                </div>
                {loss != null && (
                  loss > 0 ? (
                    <p className="mt-2 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">
                      ⚠ Hao hụt đóng gói: {fmtQty(loss)} {line.unit} — sẽ tự lập biên bản hao hụt
                    </p>
                  ) : (
                    <p className="mt-2 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-1.5">
                      ✓ Không hao hụt (cân đủ hoặc dư so với kg chuyển)
                    </p>
                  )
                )}
              </div>
            );
          })}
        </div>

        <Field label="Ghi chú">
          <textarea rows={2} className={inputCls} value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Ghi chú thêm (không bắt buộc)" />
        </Field>

        <div className="flex gap-2 pt-2">
          <SecondaryButton className="flex-1" onClick={onClose}>Huỷ</SecondaryButton>
          <PrimaryButton className="flex-1" onClick={submit} disabled={saving}>{saving ? 'Đang xử lý...' : 'Xác nhận nhận hàng'}</PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

// ── Card phiếu chuyển kho (expand xem chi tiết dòng + batch nguồn) ────────────
function TransferNoteCard({ note, onReceive }) {
  const toast = useToast();
  const [expanded, setExpanded] = useState(false);
  const [printingOp, setPrintingOp] = useState(null); // 'in' | `loss-${lineId}` | null
  const isPending = note.status === 'PENDING';

  const printTransferIn = async () => {
    if (printingOp) return;
    setPrintingOp('in');
    try {
      const res = await semiFinishedGoodsApi.exportTransferIn(note.id);
      downloadBlob(res.data, `phieu-nhap-tp-${note.noteCode}.xlsx`);
    } catch (e) {
      toast(e?.response?.data?.message || 'Không thể in phiếu', 'error');
    } finally { setPrintingOp(null); }
  };

  const printLossReport = async (line) => {
    if (printingOp || !line.lossReportId) return;
    setPrintingOp(`loss-${line.id}`);
    try {
      const res = await semiFinishedGoodsApi.exportLossReportForAccountant(line.lossReportId);
      downloadBlob(res.data, `bien-ban-hao-hut-${note.noteCode}-${line.productName}.xlsx`);
    } catch (e) {
      toast(e?.response?.data?.message || 'Không thể in biên bản', 'error');
    } finally { setPrintingOp(null); }
  };

  return (
    <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
      <button onClick={() => setExpanded(v => !v)}
        className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-[#FAF7F2] transition-colors">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-mono font-semibold text-sm text-[#1C1C1E]">{note.noteCode}</p>
            {isPending ? (
              <Badge className="bg-amber-50 text-amber-700 ring-amber-200"><Clock size={11} className="inline mr-1" />Chờ xác nhận</Badge>
            ) : (
              <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-200"><CheckCircle2 size={11} className="inline mr-1" />Đã nhận</Badge>
            )}
          </div>
          <p className="text-xs text-[#8E8878] mt-1">{note.createdByName} · {fmtDateTime(note.createdAt)}</p>
        </div>
        <div className="flex items-center gap-2">
          {isPending && (
            <button onClick={(e) => { e.stopPropagation(); onReceive(note); }}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-[#1A2B1A] text-white hover:bg-[#243524]">
              <CheckCircle2 size={13} /> Xác nhận nhận
            </button>
          )}
          {!isPending && (
            <button onClick={(e) => { e.stopPropagation(); printTransferIn(); }} disabled={printingOp === 'in'}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-[#E8F0E8] text-[#1A2B1A] hover:bg-[#D8E8D8] disabled:opacity-50">
              <Printer size={13} /> {printingOp === 'in' ? 'Đang xuất...' : 'In phiếu nhập TP'}
            </button>
          )}
          {expanded ? <ChevronUp size={16} className="text-[#8E8878]" /> : <ChevronDown size={16} className="text-[#8E8878]" />}
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-4 border-t border-black/10 space-y-3 pt-3">
          {note.lines.map(l => (
            <div key={l.id} className="bg-[#FAF7F2] rounded-xl p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-[#1C1C1E]">{l.productName}</span>
                <span className="text-sm text-[#8E8878]">{fmtQty(l.transferredQty)} {l.unit}</span>
              </div>
              {l.packagedQty != null && (
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-emerald-600">
                    ✓ Đã nhận: {fmtQty(l.packagedQty)} {l.packagedUnit} — cân thực {fmtQty(l.actualReceivedWeight)} {l.unit}
                    {l.lossQty > 0 && <span className="text-amber-600"> · hao hụt {fmtQty(l.lossQty)} {l.unit}</span>}
                  </p>
                  {l.lossQty > 0 && l.lossReportId && (
                    <button onClick={() => printLossReport(l)} disabled={printingOp === `loss-${l.id}`}
                      className="flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg hover:bg-amber-100 disabled:opacity-50 flex-shrink-0 ml-2">
                      <FileWarning size={11} /> {printingOp === `loss-${l.id}` ? 'Đang xuất...' : 'In biên bản hao hụt'}
                    </button>
                  )}
                </div>
              )}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {(l.sourceBatches || []).map((sb, i) => (
                  <span key={i} className="text-[11px] bg-white border border-black/10 rounded-full px-2 py-1 text-[#1C1C1E] font-mono">
                    {sb.batchCode}: {fmtQty(sb.quantity)} {l.unit}
                  </span>
                ))}
              </div>
            </div>
          ))}
          {note.receivedByName && (
            <p className="text-xs text-[#8E8878]">Xác nhận bởi {note.receivedByName} · {fmtDateTime(note.receivedAt)}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function FactoryAccountantTransfersPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useMinLoading();
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [receiveTarget, setReceiveTarget] = useState(null);

  const load = () => {
    setLoading(true);
    semiFinishedGoodsApi.listTransfersForAccountant(statusFilter || undefined, 0, 50)
      .then(d => setItems(d || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [statusFilter]); // eslint-disable-line

  const pendingCount = items.filter(t => t.status === 'PENDING').length;

  return (
    <div className="p-4 space-y-4 bg-[#F5F0EB] min-h-full">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#1C1C1E]">Phiếu chuyển kho bán thành phẩm</h1>
      </div>

      <div className="flex gap-1 bg-white border border-black/5 rounded-xl p-1 w-fit shadow-sm">
        {[
          { id: 'PENDING', label: `Chờ xác nhận${pendingCount > 0 ? ` (${pendingCount})` : ''}` },
          { id: 'RECEIVED', label: 'Đã nhận' },
          { id: '', label: 'Tất cả' },
        ].map(s => (
          <button key={s.id} onClick={() => setStatusFilter(s.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${statusFilter === s.id ? 'bg-[#1C1C1E] text-white' : 'text-[#8E8878] hover:text-[#1C1C1E]'}`}>
            {s.label}
          </button>
        ))}
      </div>

      {loading
        ? <div className="space-y-3">{[1, 2, 3].map(i => <CardSkeleton key={i} />)}</div>
        : items.length === 0
          ? (
            <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-10 text-center">
              <FileText size={32} className="mx-auto text-[#8E8878] mb-2" />
              <p className="text-[#8E8878] text-sm">Không có phiếu chuyển kho nào</p>
            </div>
          )
          : (
            <div className="space-y-3">
              {items.map(note => <TransferNoteCard key={note.id} note={note} onReceive={setReceiveTarget} />)}
            </div>
          )
      }

      {receiveTarget && (
        <ReceiveTransferModal note={receiveTarget} onClose={() => setReceiveTarget(null)}
          onSaved={() => { setReceiveTarget(null); load(); }} />
      )}
    </div>
  );
}
