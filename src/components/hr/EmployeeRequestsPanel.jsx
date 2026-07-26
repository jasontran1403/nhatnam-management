// src/components/hr/EmployeeRequestsPanel.jsx
// PANEL DUYỆT ĐƠN NHÂN VIÊN — nằm trong tab "Phiếu nghỉ" của trang Nhân sự/Lương.
//
// Ba thao tác của OWNER, đúng theo quy trình:
//   1. Duyệt              → có phép (hưởng đủ công) hoặc không phép (công = 0)
//   2. Duyệt & trừ công   → nhập số công trừ, 0.01 – 1
//   3. Từ chối            → bắt buộc nêu lý do
//
// Mỗi thao tác đẩy một thông báo WebSocket về cho người tạo đơn; nội dung do
// backend dựng nên ở đây không cần ghép lại câu thông báo.
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Calendar, Check, X, MinusCircle, Clock, Loader2, AlertCircle,
  ChevronRight, Filter, RefreshCw,
} from 'lucide-react';

import LeaveBalanceCard from './LeaveBalance';
import { employeeRequestApi } from '../../api/employeeRequestApi';
import { useToast } from '../common/Toast';
import Modal from '../ui/Modal';
import Pagination from '../ui/Pagination';
import {
  SectionCard, LoadingSpinner, EmptyState, PrimaryButton, SecondaryButton,
  Field, inputCls, selectCls, Table, Thead, Th, Td, Tr, formatDateTime,
} from '../ui';

// ══════════════════════════════════════════════════════════════════════════════
// HẰNG SỐ
// ══════════════════════════════════════════════════════════════════════════════

const DEPARTMENTS = [
  { value: '', label: 'Tất cả bộ phận' },
  { value: 'FACTORY', label: 'Xưởng sản xuất' },
  { value: 'ACCOUNTING', label: 'Kế toán' },
  { value: 'SALES', label: 'Kinh doanh' },
  { value: 'WAREHOUSE', label: 'Kho' },
  { value: 'DRIVER', label: 'Tài xế' },
];

const STATUSES = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'PENDING', label: 'Chờ duyệt' },
  { value: 'APPROVED_PAID', label: 'Đã duyệt - có lương' },
  { value: 'APPROVED_UNPAID', label: 'Đã duyệt - không lương' },
  { value: 'APPROVED_DEDUCTED', label: 'Đã duyệt - trừ công' },
  { value: 'REJECTED', label: 'Từ chối' },
];

const STATUS_STYLE = {
  PENDING:           { cls: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock },
  APPROVED_PAID:     { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: Check },
  APPROVED_UNPAID:   { cls: 'bg-sky-50 text-sky-700 border-sky-200', icon: Check },
  APPROVED_DEDUCTED: { cls: 'bg-orange-50 text-orange-700 border-orange-200', icon: MinusCircle },
  REJECTED:          { cls: 'bg-red-50 text-red-700 border-red-200', icon: X },
};

function StatusBadge({ status, label }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.PENDING;
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-semibold whitespace-nowrap ${s.cls}`}>
      <Icon size={11} />{label}
    </span>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MODAL CHI TIẾT + DUYỆT
// ══════════════════════════════════════════════════════════════════════════════

function DecideModal({ item, onClose, onDone }) {
  const toast = useToast();

  // 'view' khi đơn đã xử lý; đơn còn chờ thì mở thẳng vào bước chọn thao tác.
  const [action, setAction] = useState(null);   // 'APPROVE' | 'DEDUCT' | 'REJECT'
  const [paid, setPaid] = useState(true);
  const [deduct, setDeduct] = useState('0.5');
  // Chia ngày phép / không lương — chỉ dùng cho phiếu NGHỈ PHÉP nhiều ngày
  const [paidDays, setPaidDays] = useState('');
  const [unpaidDays, setUnpaidDays] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setAction(null); setPaid(true); setDeduct('0.5'); setNote('');
    setPaidDays(''); setUnpaidDays('');
  }, [item?.id]);

  if (!item) return null;
  const editable = item.status === 'PENDING';

  const isLeave = item.type === 'LEAVE';
  // Số ngày phép phiếu này tiêu tốn — mốc trần khi chia phép / không lương.
  // Nghỉ nửa ngày luôn là 0,5 bất kể khoảng ngày.
  const totalDays = (() => {
    // BE đã cộng sẵn theo BUỔI (leaveDays) — ra được 3,5 / 0,5 / 4 cho phiếu
    // ngắt quãng. Chỉ tự tính khi gặp phiếu cũ chưa có trường này.
    if (item.leaveDays != null) return item.leaveDays;
    if (item.halfDay) return 0.5;
    if (!item.fromDate || !item.toDate) return 1;
    const a = new Date(item.fromDate), b = new Date(item.toDate);
    return Math.max(1, Math.round((b - a) / 86400000) + 1);
  })();

  const submit = async () => {
    if (action === 'REJECT' && !note.trim())
      return toast('Bắt buộc nhập lý do từ chối', 'error');

    const d = Number(deduct);
    if (action === 'DEDUCT' && (!d || d < 0.01 || d > 1))
      return toast('Số công trừ phải nằm trong khoảng 0.01 – 1', 'error');

    setBusy(true);
    try {
      if (action === 'APPROVE') {
        if (isLeave) {
          // Bỏ trống = duyệt trọn phiếu theo nhánh có lương / không lương đã chọn.
          const pd = paidDays === '' ? (paid ? totalDays : 0) : Number(paidDays);
          const ud = unpaidDays === '' ? (paid ? 0 : totalDays) : Number(unpaidDays);
          if (pd < 0 || ud < 0) return toast('Số ngày không được âm', 'error');
          if (pd + ud > totalDays + 0.001)
            return toast(`Tổng ${pd + ud} ngày vượt quá ${totalDays} ngày của phiếu`, 'error');
          await employeeRequestApi.approveLeave(item.id, pd, ud, note.trim() || null);
        } else {
          await employeeRequestApi.approve(item.id, paid, note.trim() || null);
        }
      }
      else if (action === 'DEDUCT') await employeeRequestApi.deduct(item.id, d, note.trim() || null);
      else await employeeRequestApi.reject(item.id, note.trim());

      toast('Đã xử lý phiếu — nhân viên đã nhận thông báo.', 'success');
      onDone?.();
      onClose();
    } catch (e) {
      toast(e?.response?.data?.message || 'Không xử lý được phiếu', 'error');
    } finally {
      setBusy(false);
    }
  };

  const Row = ({ label, children }) => (
    <div className="flex gap-3 py-2.5 border-b border-black/5 last:border-0">
      <span className="text-xs text-[#8E8878] uppercase tracking-wider w-32 flex-shrink-0 pt-0.5">{label}</span>
      <div className="text-sm text-[#1C1C1E] min-w-0 flex-1">{children}</div>
    </div>
  );

  const ActionTab = ({ id, label, icon: Icon, tone }) => (
    <button type="button" onClick={() => setAction(id)}
      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm
        font-semibold border transition-all
        ${action === id ? tone : 'bg-white text-[#8E8878] border-black/10 hover:border-[#C9A84C] hover:text-[#C9A84C]'}`}>
      <Icon size={14} />{label}
    </button>
  );

  return (
    <Modal open onClose={onClose} size="lg" title={`${item.typeLabel} — ${item.userFullName}`}>
      <div className="space-y-4">

        {/* ── Nội dung đơn ────────────────────────────────────────────────── */}
        <div>
          <Row label="Nhân viên">
            <div className="font-medium">{item.userFullName}</div>
            <div className="text-xs text-[#8E8878]">
              {[item.roleLabel, item.departmentLabel].filter(Boolean).join(' · ')}
            </div>
          </Row>
          <Row label="Loại phiếu">{item.typeLabel}</Row>
          <Row label="Thời gian xin phép">
            <span className="font-medium">{item.periodText}</span>
          </Row>
          <Row label="Lý do"><span className="whitespace-pre-wrap">{item.reason}</span></Row>
          <Row label="Trạng thái"><StatusBadge status={item.status} label={item.statusLabel} /></Row>

          {item.status === 'APPROVED_DEDUCTED' && (
            <Row label="Công bị trừ">
              <span className="font-semibold text-orange-600">{item.deductedDays} công</span>
            </Row>
          )}
          {item.decisionNote && (
            <Row label={item.status === 'REJECTED' ? 'Lý do từ chối' : 'Ghi chú'}>
              <span className="whitespace-pre-wrap">{item.decisionNote}</span>
            </Row>
          )}
          {item.decidedByName && (
            <Row label="Người duyệt">
              {item.decidedByName}
              <span className="text-xs text-[#8E8878] ml-2">{formatDateTime(item.decidedAt)}</span>
            </Row>
          )}
          <Row label="Gửi lúc">{formatDateTime(item.createdAt)}</Row>
        </div>

        {/* ── Thao tác ───────────────────────────────────────────────────── */}
        {editable ? (
          <div className="rounded-xl border border-black/10 bg-[#FAF7F2] p-4 space-y-4">
            <p className="text-xs font-semibold text-[#1C1C1E] uppercase tracking-wider">Xử lý phiếu</p>

            <div className="flex gap-2">
              <ActionTab id="APPROVE" label="Duyệt" icon={Check}
                tone="bg-emerald-600 text-white border-emerald-600 shadow-sm" />
              <ActionTab id="DEDUCT" label="Duyệt & trừ công" icon={MinusCircle}
                tone="bg-orange-500 text-white border-orange-500 shadow-sm" />
              <ActionTab id="REJECT" label="Từ chối" icon={X}
                tone="bg-red-600 text-white border-red-600 shadow-sm" />
            </div>

            {action === 'APPROVE' && isLeave && (
              <div className="space-y-3">
                {/* Số dư phép của CHÍNH nhân viên này — phải thấy TRƯỚC khi bấm
                    duyệt, nếu không sẽ duyệt vượt quỹ mà không hay. */}
                <div className="rounded-xl bg-white border border-black/10 px-3 py-2.5">
                  <LeaveBalanceCard userId={item.userId} compact />
                </div>

                <Field label={`Chia ${String(totalDays).replace('.', ',')} ngày của phiếu`}
                  hint="Bỏ trống = duyệt trọn phiếu theo lựa chọn bên dưới. Không đủ quỹ thì chia bớt sang không lương.">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <input type="number" step="0.5" min="0" max={totalDays}
                        value={paidDays} onChange={e => setPaidDays(e.target.value)}
                        placeholder={String(totalDays)}
                        className={inputCls + ' max-w-[90px]'} />
                      <span className="text-xs text-[#8E8878]">ngày phép</span>
                    </div>
                    <span className="text-[#8E8878]">+</span>
                    <div className="flex items-center gap-1.5">
                      <input type="number" step="0.5" min="0" max={totalDays}
                        value={unpaidDays} onChange={e => setUnpaidDays(e.target.value)}
                        placeholder="0"
                        className={inputCls + ' max-w-[90px]'} />
                      <span className="text-xs text-[#8E8878]">ngày không lương</span>
                    </div>
                  </div>
                </Field>
              </div>
            )}

            {action === 'APPROVE' && (
              <Field label="Nghỉ có lương hay không lương" required>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setPaid(true)}
                    className={`flex-1 px-3 py-2.5 rounded-xl text-sm font-medium border transition-all
                      ${paid ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                             : 'bg-white text-[#8E8878] border-black/10 hover:border-emerald-300'}`}>
                    Có phép — hưởng đủ công
                  </button>
                  <button type="button" onClick={() => setPaid(false)}
                    className={`flex-1 px-3 py-2.5 rounded-xl text-sm font-medium border transition-all
                      ${!paid ? 'bg-sky-50 text-sky-700 border-sky-300'
                              : 'bg-white text-[#8E8878] border-black/10 hover:border-sky-300'}`}>
                    Không phép — công ngày đó = 0
                  </button>
                </div>
              </Field>
            )}

            {action === 'DEDUCT' && (
              <Field label="Số công bị trừ" required
                hint="Tối thiểu 0.01 — tối đa 1. VD trừ 0.1 công thì ngày đó còn 0.9 công.">
                <div className="flex items-center gap-2">
                  <input type="number" step="0.01" min="0.01" max="1"
                    value={deduct} onChange={e => setDeduct(e.target.value)}
                    className={inputCls + ' max-w-[140px]'} />
                  <div className="flex gap-1.5">
                    {['0.25', '0.5', '1'].map(v => (
                      <button key={v} type="button" onClick={() => setDeduct(v)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-black/10
                          bg-white text-[#8E8878] hover:border-[#C9A84C] hover:text-[#C9A84C] transition-colors">
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              </Field>
            )}

            {action && (
              <Field
                label={action === 'REJECT' ? 'Lý do từ chối' : 'Ghi chú cho nhân viên'}
                required={action === 'REJECT'}
                hint="Nội dung này được gửi kèm trong thông báo cho nhân viên.">
                <textarea rows={2} value={note} onChange={e => setNote(e.target.value)}
                  maxLength={2000}
                  placeholder={action === 'REJECT' ? 'VD: Đã có 2 người nghỉ cùng ngày…' : 'Không bắt buộc'}
                  className={inputCls + ' resize-y'} />
              </Field>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-black/10 bg-[#FAF7F2] px-4 py-3">
            <p className="text-sm text-[#8E8878]">
              Phiếu đã được xử lý nên không thao tác lại được. Cần đổi quyết định thì yêu cầu
              nhân viên gửi phiếu mới.
            </p>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <SecondaryButton onClick={onClose}>Đóng</SecondaryButton>
          {editable && action && (
            <PrimaryButton onClick={submit} loading={busy}>Xác nhận</PrimaryButton>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PANEL
// ══════════════════════════════════════════════════════════════════════════════

export default function EmployeeRequestsPanel() {
  const toast = useToast();

  const [department, setDepartment] = useState('');
  // Mặc định lọc "Chờ duyệt": mở tab ra là thấy ngay việc cần làm, không phải
  // lội qua hàng trăm đơn cũ đã xử lý.
  const [status, setStatus] = useState('PENDING');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await employeeRequestApi.search({
        department: department || undefined,
        status: status || undefined,
        page, size: 20,
      });
      setItems(data?.content ?? []);
      setTotalPages(data?.totalPages ?? 1);
    } catch (e) {
      toast(e?.response?.data?.message || 'Không tải được danh sách phiếu', 'error');
    } finally {
      setLoading(false);
    }
  }, [department, status, page, toast]);

  const loadSummary = useCallback(async () => {
    try {
      const s = await employeeRequestApi.summary(department || undefined);
      setPendingCount(s?.pending ?? 0);
    } catch { /* badge không quan trọng tới mức phải báo lỗi */ }
  }, [department]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadSummary(); }, [loadSummary]);

  // Đổi bộ lọc thì phải về trang 1, nếu không sẽ rơi vào trang trống.
  useEffect(() => { setPage(0); }, [department, status]);

  const refresh = () => { load(); loadSummary(); };

  const headerNote = useMemo(() => {
    if (pendingCount === 0) return 'Không còn phiếu nào chờ duyệt.';
    return `${pendingCount} phiếu đang chờ duyệt.`;
  }, [pendingCount]);

  return (
    <div className="space-y-4">

      {/* ── Bộ lọc ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-[#8E8878] text-xs font-semibold uppercase tracking-wider mr-1">
          <Filter size={13} /> Lọc
        </div>
        <select value={department} onChange={e => setDepartment(e.target.value)}
          className={selectCls + ' max-w-[190px] py-2'}>
          {DEPARTMENTS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)}
          className={selectCls + ' max-w-[210px] py-2'}>
          {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>

        <button onClick={refresh}
          className="inline-flex items-center gap-1.5 px-3 h-[42px] rounded-xl text-xs font-semibold
            bg-white text-[#8E8878] border border-black/10 hover:border-[#C9A84C] hover:text-[#C9A84C] transition-colors">
          <RefreshCw size={13} /> Tải lại
        </button>

        <span className={`ml-auto text-xs font-semibold px-2.5 py-1.5 rounded-lg
          ${pendingCount > 0 ? 'bg-amber-50 text-amber-700' : 'bg-[#FAF7F2] text-[#8E8878]'}`}>
          {headerNote}
        </span>
      </div>

      {/* ── Danh sách ───────────────────────────────────────────────────── */}
      <SectionCard>
        {loading ? (
          <LoadingSpinner label="Đang tải phiếu…" />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title="Không có phiếu nào"
            description={status === 'PENDING'
              ? 'Tất cả phiếu đã được xử lý.'
              : 'Thử đổi bộ lọc để xem các phiếu khác.'}
          />
        ) : (
          <Table>
            <Thead>
              <Tr className="bg-[#FAF7F2] text-[#8E8878]">
                <Th>Nhân viên</Th>
                <Th>Loại phiếu</Th>
                <Th>Thời gian xin phép</Th>
                <Th>Lý do</Th>
                <Th>Trạng thái</Th>
                <Th right>Gửi lúc</Th>
                <Th />
              </Tr>
            </Thead>
            <tbody>
              {items.map(it => (
                <Tr key={it.id} onClick={() => setSelected(it)}>
                  <Td>
                    <div className="font-medium text-[#1C1C1E]">{it.userFullName}</div>
                    <div className="text-xs text-[#8E8878]">
                      {[it.roleLabel, it.departmentLabel].filter(Boolean).join(' · ') || '—'}
                    </div>
                  </Td>
                  <Td className="whitespace-nowrap">{it.typeLabel}</Td>
                  <Td className="whitespace-nowrap font-medium text-[#1C1C1E]">{it.periodText}</Td>
                  <Td className="text-[#8E8878] max-w-[220px] truncate">{it.reason}</Td>
                  <Td><StatusBadge status={it.status} label={it.statusLabel} /></Td>
                  <Td right className="text-xs text-[#8E8878] whitespace-nowrap">
                    {formatDateTime(it.createdAt)}
                  </Td>
                  <Td right><ChevronRight size={14} className="text-[#C4B9A8]" /></Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}

        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-black/5">
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </div>
        )}
      </SectionCard>

      {selected && (
        <DecideModal item={selected} onClose={() => setSelected(null)} onDone={refresh} />
      )}
    </div>
  );
}