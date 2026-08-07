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
  PENDING:           { cls: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/28', icon: Clock },
  APPROVED_PAID:     { cls: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/28', icon: Check },
  APPROVED_UNPAID:   { cls: 'bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-500/28', icon: Check },
  APPROVED_DEDUCTED: { cls: 'bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-500/28', icon: MinusCircle },
  REJECTED:          { cls: 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/28', icon: X },
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
    <div className="flex gap-3 py-2.5 border-b border-hairline last:border-0">
      <span className="text-xs text-muted uppercase tracking-wider w-32 flex-shrink-0 pt-0.5">{label}</span>
      <div className="text-sm text-ink min-w-0 flex-1">{children}</div>
    </div>
  );

  const ActionTab = ({ id, label, icon: Icon, tone }) => (
    <button type="button" onClick={() => setAction(id)}
      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm
        font-semibold border transition-all
        ${action === id ? tone : 'bg-surface text-muted border-hairline-2 hover:border-gold hover:text-gold'}`}>
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
            <div className="text-xs text-muted">
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
              <span className="font-semibold text-orange-600 dark:text-orange-300">{item.deductedDays} công</span>
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
              <span className="text-xs text-muted ml-2">{formatDateTime(item.decidedAt)}</span>
            </Row>
          )}
          <Row label="Gửi lúc">{formatDateTime(item.createdAt)}</Row>
        </div>

        {/* ── Thao tác ───────────────────────────────────────────────────── */}
        {editable ? (
          <div className="rounded-xl border border-hairline-2 bg-canvas p-4 space-y-4">
            <p className="text-xs font-semibold text-ink uppercase tracking-wider">Xử lý phiếu</p>

            <div className="flex gap-2">
              <ActionTab id="APPROVE" label="Duyệt" icon={Check}
                tone="bg-emerald-600 text-white border-emerald-600 dark:border-emerald-500/40 shadow-sm" />
              <ActionTab id="DEDUCT" label="Duyệt & trừ công" icon={MinusCircle}
                tone="bg-orange-500 text-white border-orange-500 shadow-sm" />
              <ActionTab id="REJECT" label="Từ chối" icon={X}
                tone="bg-red-600 text-white border-red-600 dark:border-red-500/40 shadow-sm" />
            </div>

            {action === 'APPROVE' && isLeave && (
              <div className="space-y-3">
                {/* Số dư phép của CHÍNH nhân viên này — phải thấy TRƯỚC khi bấm
                    duyệt, nếu không sẽ duyệt vượt quỹ mà không hay. */}
                <div className="rounded-xl bg-surface border border-hairline-2 px-3 py-2.5">
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
                      <span className="text-xs text-muted">ngày phép</span>
                    </div>
                    <span className="text-muted">+</span>
                    <div className="flex items-center gap-1.5">
                      <input type="number" step="0.5" min="0" max={totalDays}
                        value={unpaidDays} onChange={e => setUnpaidDays(e.target.value)}
                        placeholder="0"
                        className={inputCls + ' max-w-[90px]'} />
                      <span className="text-xs text-muted">ngày không lương</span>
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
                      ${paid ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/35'
                             : 'bg-surface text-muted border-hairline-2 hover:border-emerald-300 dark:border-emerald-500/35'}`}>
                    Có phép — hưởng đủ công
                  </button>
                  <button type="button" onClick={() => setPaid(false)}
                    className={`flex-1 px-3 py-2.5 rounded-xl text-sm font-medium border transition-all
                      ${!paid ? 'bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-300 dark:border-sky-500/35'
                              : 'bg-surface text-muted border-hairline-2 hover:border-sky-300 dark:border-sky-500/35'}`}>
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
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-hairline-2
                          bg-surface text-muted hover:border-gold hover:text-gold transition-colors">
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
          <div className="rounded-xl border border-hairline-2 bg-canvas px-4 py-3">
            <p className="text-sm text-muted">
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

/**
 * Panel duyệt phiếu nghỉ / OT.
 *
 * @param userId  chỉ xét phiếu của MỘT nhân viên (mở từ nút "Duyệt nghỉ/OT"
 *                trên trang Nhân viên). Bỏ trống = toàn công ty như trước.
 */
export default function EmployeeRequestsPanel({ userId = null }) {
  const toast = useToast();

  const [department, setDepartment] = useState('');
  // Mặc định lọc "Chờ duyệt": mở tab ra là thấy ngay việc cần làm, không phải
  // lội qua hàng trăm đơn cũ đã xử lý.
  // Khi xét riêng một người thì mở sẵn TẤT CẢ: số phiếu ít, và người duyệt
  // thường muốn thấy cả lịch sử để cân nhắc.
  const [status, setStatus] = useState(userId ? '' : 'PENDING');
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
        department: userId ? undefined : (department || undefined),
        status: status || undefined,
        userId: userId || undefined,
        page, size: 20,
      });
      setItems(data?.content ?? []);
      setTotalPages(data?.totalPages ?? 1);
    } catch (e) {
      toast(e?.response?.data?.message || 'Không tải được danh sách phiếu', 'error');
    } finally {
      setLoading(false);
    }
  }, [department, status, page, userId, toast]);

  const loadSummary = useCallback(async () => {
    // Khi lọc theo một nhân viên, số liệu tổng của cả bộ phận gây hiểu nhầm —
    // đếm thẳng trên danh sách đang hiển thị thay vì gọi API tổng hợp.
    if (userId) return;
    try {
      const s = await employeeRequestApi.summary(department || undefined);
      setPendingCount(s?.pending ?? 0);
    } catch { /* badge không quan trọng tới mức phải báo lỗi */ }
  }, [department, userId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadSummary(); }, [loadSummary]);

  // Đổi bộ lọc thì phải về trang 1, nếu không sẽ rơi vào trang trống.
  useEffect(() => { setPage(0); }, [department, status, userId]);

  // Chế độ một nhân viên: badge đếm ngay trên danh sách đang có.
  useEffect(() => {
    if (userId) setPendingCount(items.filter(i => i.status === 'PENDING').length);
  }, [userId, items]);

  const refresh = () => { load(); loadSummary(); };

  const headerNote = useMemo(() => {
    if (pendingCount === 0) return 'Không còn phiếu nào chờ duyệt.';
    return `${pendingCount} phiếu đang chờ duyệt.`;
  }, [pendingCount]);

  return (
    <div className="space-y-4">

      {/* ── Bộ lọc ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-muted text-xs font-semibold uppercase tracking-wider mr-1">
          <Filter size={13} /> Lọc
        </div>
        {!userId && (
          <select value={department} onChange={e => setDepartment(e.target.value)}
            className={selectCls + ' max-w-[190px] py-2'}>
            {DEPARTMENTS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        )}
        <select value={status} onChange={e => setStatus(e.target.value)}
          className={selectCls + ' max-w-[210px] py-2'}>
          {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>

        <button onClick={refresh}
          className="inline-flex items-center gap-1.5 px-3 h-[42px] rounded-xl text-xs font-semibold
            bg-surface text-muted border border-hairline-2 hover:border-gold hover:text-gold transition-colors">
          <RefreshCw size={13} /> Tải lại
        </button>

        <span className={`ml-auto text-xs font-semibold px-2.5 py-1.5 rounded-lg
          ${pendingCount > 0 ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300' : 'bg-canvas text-muted'}`}>
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
              <Tr className="bg-canvas text-muted">
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
                    <div className="font-medium text-ink">{it.userFullName}</div>
                    <div className="text-xs text-muted">
                      {[it.roleLabel, it.departmentLabel].filter(Boolean).join(' · ') || '—'}
                    </div>
                  </Td>
                  <Td className="whitespace-nowrap">{it.typeLabel}</Td>
                  <Td className="whitespace-nowrap font-medium text-ink">{it.periodText}</Td>
                  <Td className="text-muted max-w-[220px] truncate">{it.reason}</Td>
                  <Td><StatusBadge status={it.status} label={it.statusLabel} /></Td>
                  <Td right className="text-xs text-muted whitespace-nowrap">
                    {formatDateTime(it.createdAt)}
                  </Td>
                  <Td right><ChevronRight size={14} className="text-faint" /></Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}

        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-hairline">
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