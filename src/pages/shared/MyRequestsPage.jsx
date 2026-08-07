// src/pages/shared/MyRequestsPage.jsx
// "PHIẾU CỦA TÔI" — nhân viên tự tạo phiếu nghỉ / công tác / đi trễ / về sớm /
// quên chấm công, rồi theo dõi kết quả duyệt của OWNER.
//
// Giới hạn ngày KHÔNG hard-code ở đây. Server trả về minDate/maxDate đã tính sẵn
// theo giờ Việt Nam cho từng loại phiếu (/form-config); trang này chỉ truyền
// thẳng vào lịch. Nhờ vậy đổi luật chỉ phải sửa một chỗ ở backend, và máy người
// dùng để lệch ngày cũng không mở rộng được cửa sổ chọn.
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FileText, Plus, Clock, CalendarDays, Check, X, AlertCircle,
  Loader2, Trash2, ChevronRight, MinusCircle,
} from 'lucide-react';

import LeaveBalanceCard from '../../components/hr/LeaveBalance';
import { employeeRequestApi, msToIsoDate, isoDateToMs } from '../../api/employeeRequestApi';
import { useToast } from '../../components/common/Toast';
import Modal from '../../components/ui/Modal';
import DatePicker from '../../components/ui/DatePicker';
import DateRangePicker from '../../components/ui/DateRangePicker';
import {
  PageHeader, SectionCard, SectionHeader, LoadingSpinner, EmptyState,
  PrimaryButton, SecondaryButton, Field, inputCls, TabBar,
  Table, Thead, Th, Td, Tr, formatDateTime,
} from '../../components/ui';

// ══════════════════════════════════════════════════════════════════════════════
// HIỂN THỊ TRẠNG THÁI
// ══════════════════════════════════════════════════════════════════════════════

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
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-semibold ${s.cls}`}>
      <Icon size={11} />
      {label}
    </span>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// FORM TẠO PHIẾU
// ══════════════════════════════════════════════════════════════════════════════

function CreateForm({ config, onCreated }) {
  const toast = useToast();

  const [typeValue, setTypeValue] = useState(config?.types?.[0]?.value || 'LEAVE');
  const [range, setRange] = useState({ from: null, to: null });
  const [single, setSingle] = useState(null);
  const [minutes, setMinutes] = useState('');
  // Buổi nghỉ theo từng ngày: { 'YYYY-MM-DD': { morning, afternoon } }.
  // Mặc định tick cả 2 buổi; user bỏ tick để thành nửa ngày, bỏ cả 2 để loại
  // hẳn ngày đó ra khỏi phiếu (nghỉ ngắt quãng).
  const [sessions, setSessions] = useState({});
  // Ngày đang chờ xác nhận loại khỏi khoảng (chỉ với ngày ĐẦU / CUỐI).
  const [dropConfirm, setDropConfirm] = useState(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const type = useMemo(
    () => config?.types?.find(t => t.value === typeValue) || null,
    [config, typeValue]
  );

  // Đổi loại phiếu là đổi cả hình dạng dữ liệu (khoảng ngày ↔ một ngày, có/không
  // số phút). Giữ lại giá trị cũ sẽ gửi lên những trường không thuộc loại mới,
  // nên xoá sạch trừ lý do — lý do thường vẫn dùng lại được.
  useEffect(() => {
    setRange({ from: null, to: null });
    setSingle(null);
    setMinutes('');
    setSessions({});
    setDropConfirm(null);
  }, [typeValue]);

  // Danh sách ngày trong khoảng đã chọn — chỉ dùng cho phiếu nghỉ phép.
  const dayList = useMemo(() => {
    if (!type?.allowPartialDay) return [];
    const a = range.from, b = range.to ?? range.from;
    if (!a) return [];
    const out = [];
    for (let t = a; t <= b; t += 86400000) out.push(msToIsoDate(t));
    return out;
  }, [type, range.from, range.to]);

  // Ngày mới xuất hiện thì mặc định nghỉ CẢ NGÀY; ngày bị bỏ khỏi khoảng thì
  // xoá luôn trạng thái, tránh gửi lên buổi của ngày không còn được chọn.
  useEffect(() => {
    setSessions(prev => {
      const next = {};
      dayList.forEach(d => { next[d] = prev[d] ?? { morning: true, afternoon: true }; });
      return next;
    });
  }, [dayList.join(',')]);

  /**
   * Bỏ tick một buổi.
   *
   * <p>Bỏ nốt buổi CUỐI CÙNG của ngày ĐẦU hoặc ngày CUỐI khoảng thì hỏi trước:
   * ngày đó không còn nghỉ buổi nào nữa, mà nó lại đang định nghĩa biên của
   * khoảng — để nguyên sẽ ra khoảng "24 → 31" trong khi 24 không hề nghỉ.
   * Ngày ở GIỮA thì không hỏi, cứ để trống là thành nghỉ ngắt quãng.
   */
  const toggleSession = (date, key, checked) => {
    const cur = sessions[date] || {};
    const next = { ...cur, [key]: checked };
    const becomesEmpty = !next.morning && !next.afternoon;
    const isEdge = date === dayList[0] || date === dayList[dayList.length - 1];

    if (becomesEmpty && isEdge && dayList.length > 1) {
      setDropConfirm(date);      // chờ xác nhận, CHƯA đổi gì
      return;
    }
    setSessions(p => ({ ...p, [date]: next }));
  };

  /**
   * Xác nhận loại ngày biên → co khoảng ngày lại.
   *
   * <p>Cắt luôn cả những ngày rỗng nằm kề biên mới: bỏ ngày 24 mà ngày 25 trước
   * đó đã bị bỏ trống cả hai buổi thì biên mới phải là 26, không phải 25 —
   * nếu không khoảng ngày lại mở đầu bằng một ngày không nghỉ.
   */
  const confirmDrop = () => {
    const date = dropConfirm;
    if (!date) return;

    const kept = dayList.filter(d => d !== date)
      .filter(d => sessions[d]?.morning || sessions[d]?.afternoon);

    if (kept.length === 0) {
      // Không còn ngày nào → xoá trắng lựa chọn thay vì để khoảng rỗng.
      setRange({ from: null, to: null });
      setSessions({});
      setDropConfirm(null);
      return;
    }

    setRange({ from: isoDateToMs(kept[0]), to: isoDateToMs(kept[kept.length - 1]) });
    setSessions(prev => {
      const next = {};
      kept.forEach(d => { next[d] = prev[d]; });
      return next;
    });
    setDropConfirm(null);
  };

  const minMs = type?.minDate ? isoDateToMs(type.minDate) : undefined;
  const maxMs = type?.maxDate ? isoDateToMs(type.maxDate) : undefined;
  const minDate = minMs != null ? new Date(minMs) : undefined;
  const maxDate = maxMs != null ? new Date(maxMs) : undefined;

  const windowHint = useMemo(() => {
    if (!type) return null;
    const f = (iso) => { const [y, m, d] = iso.split('-'); return `${+d}/${+m}/${y}`; };
    if (!type.maxDate) return `Chỉ chọn được từ ${f(type.minDate)} trở đi`;
    return `Chỉ chọn được trong khoảng ${f(type.minDate)} – ${f(type.maxDate)}`;
  }, [type]);

  const reset = () => {
    setRange({ from: null, to: null });
    setSingle(null);
    setMinutes('');
    setPartial(false);
    setReason('');
  };

  const submit = async () => {
    if (!type) return;

    // Kiểm ở client chỉ để báo lỗi ngay tại chỗ; server vẫn kiểm lại đầy đủ.
    if (!reason.trim()) return toast('Bắt buộc nhập lý do', 'error');

    let fromDate, toDate;
    if (type.rangeBased) {
      if (!range.from) return toast('Chưa chọn khoảng ngày', 'error');
      fromDate = msToIsoDate(range.from);
      toDate = msToIsoDate(range.to ?? range.from);
    } else {
      if (!single) return toast('Chưa chọn ngày', 'error');
      fromDate = toDate = msToIsoDate(single);
    }

    if (type.minutesBased && (!minutes || Number(minutes) <= 0))
      return toast(`Phiếu ${type.label.toLowerCase()} phải khai số phút`, 'error');

    // Phiếu nghỉ phép: gom các buổi được tick. Ngày bỏ trắng cả 2 buổi coi như
    // không nghỉ → không gửi lên, đó chính là cách khai nghỉ ngắt quãng.
    let days = null;
    if (type.allowPartialDay) {
      days = dayList
        .map(d => ({ date: d, ...(sessions[d] || {}) }))
        .filter(d => d.morning || d.afternoon);
      if (!days.length) return toast('Chưa chọn buổi nghỉ nào', 'error');
    }

    setSaving(true);
    try {
      await employeeRequestApi.create({
        type: type.value,
        fromDate,
        toDate,
        days,
        minutes: type.minutesBased ? Number(minutes) : null,
        reason: reason.trim(),
      });
      toast('Đã gửi phiếu, chờ duyệt.', 'success');
      reset();
      onCreated?.();
    } catch (e) {
      toast(e?.response?.data?.message || 'Không gửi được phiếu', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!config) return <LoadingSpinner label="Đang tải biểu mẫu…" />;

  return (
    <SectionCard>
      <SectionHeader title="Tạo phiếu mới" />
      <div className="p-5 space-y-5">

        {/* ── Loại phiếu ─────────────────────────────────────────────────── */}
        <Field label="Loại phiếu" required>
          <div className="flex flex-wrap gap-2">
            {config.types.map(t => (
              <button key={t.value} type="button" onClick={() => setTypeValue(t.value)}
                className={`px-3.5 py-2 rounded-xl text-sm font-medium border transition-all
                  ${typeValue === t.value
                    ? 'bg-chrome text-white border-chrome shadow-sm'
                    : 'bg-surface text-muted border-hairline-2 hover:border-gold hover:text-gold'}`}>
                {t.label}
              </button>
            ))}
          </div>
        </Field>

        {/* ── Thời gian ──────────────────────────────────────────────────── */}
        <Field label={type?.rangeBased ? 'Khoảng ngày xin phép' : 'Ngày xin phép'}
          required hint={windowHint}>
          <div className="flex flex-wrap items-center gap-2">
            {type?.rangeBased ? (
              <DateRangePicker
                from={range.from} to={range.to}
                onChange={setRange}
                placeholder="Chọn khoảng ngày"
                minDate={minDate} maxDate={maxDate}
              />
            ) : (
              <DatePicker
                value={single} onChange={setSingle}
                placeholder="Chọn ngày"
                minDate={minDate} maxDate={maxDate}
              />
            )}
          </div>
        </Field>

        {/* ── Số phút — chỉ đi trễ / về sớm ──────────────────────────────── */}
        {type?.minutesBased && (
          <Field label={`Số phút xin ${type.label.toLowerCase()}`} required
            hint="Tính từ giờ vào ca 08:00 / giờ tan ca 17:00">
            <input
              type="number" min="1" max="600" value={minutes}
              onChange={e => setMinutes(e.target.value)}
              placeholder="VD: 30"
              className={inputCls + ' max-w-[200px]'}
            />
          </Field>
        )}

        {/* ── Chọn buổi nghỉ từng ngày ────────────────────────────────────
            Mặc định tick cả 2 buổi. Bỏ một buổi = nghỉ nửa ngày (0,5 ngày phép);
            bỏ cả 2 = ngày đó KHÔNG nghỉ, nhờ vậy một phiếu khai được lịch nghỉ
            ngắt quãng thay vì phải xé thành nhiều phiếu. */}
        {type?.allowPartialDay && dayList.length > 0 && (
          <Field label="Buổi nghỉ từng ngày" required
            hint="Bỏ tick để nghỉ nửa ngày. Bỏ cả hai buổi thì ngày đó không nghỉ.">
            <div className="rounded-xl border border-hairline-2 divide-y divide-hairline overflow-hidden">
              {dayList.map(d => {
                const ss = sessions[d] || {};
                const off = !ss.morning && !ss.afternoon;
                const set = (k, v) => toggleSession(d, k, v);
                const [yy, mm, dd] = d.split('-');
                return (
                  <div key={d}
                    className={`flex items-center gap-3 px-3 py-2.5 ${off ? 'bg-canvas' : 'bg-surface'}`}>
                    <span className={`text-sm font-medium w-24 flex-shrink-0
                      ${off ? 'text-faint line-through' : 'text-ink'}`}>
                      {dd}/{mm}/{yy}
                    </span>

                    {[['morning', 'Sáng'], ['afternoon', 'Chiều']].map(([k, label]) => (
                      <label key={k} className="flex items-center gap-1.5 cursor-pointer select-none">
                        <input type="checkbox" checked={!!ss[k]}
                          onChange={e => set(k, e.target.checked)}
                          className="w-4 h-4 accent-gold cursor-pointer" />
                        <span className={`text-sm ${ss[k] ? 'text-ink' : 'text-muted'}`}>
                          {label}
                        </span>
                      </label>
                    ))}

                    <span className="ml-auto text-xs text-muted">
                      {off ? 'không nghỉ'
                           : (ss.morning && ss.afternoon) ? '1 ngày' : '0,5 ngày'}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Ngày BIÊN bị bỏ hết buổi → hỏi trước khi co khoảng ngày, vì thao
                tác này đổi luôn ô "Khoảng ngày xin phép" phía trên. */}
            <Modal open={!!dropConfirm} onClose={() => setDropConfirm(null)}
              title="Bỏ ngày này khỏi lịch nghỉ?" size="sm">
              <div className="space-y-4">
                <p className="text-sm text-ink">
                  Ngày <b>{dropConfirm ? dropConfirm.split('-').reverse().join('/') : ''}</b> sẽ
                  không còn buổi nghỉ nào. Vì đây là ngày ở đầu/cuối khoảng, khoảng ngày
                  xin phép sẽ được rút lại.
                </p>
                {(() => {
                  if (!dropConfirm) return null;
                  const kept = dayList.filter(d => d !== dropConfirm)
                    .filter(d => sessions[d]?.morning || sessions[d]?.afternoon);
                  const f = (x) => x.split('-').reverse().join('/');
                  return (
                    <div className="rounded-xl bg-canvas px-3 py-2.5 text-sm">
                      <span className="text-muted">Khoảng ngày mới: </span>
                      <b className="text-ink">
                        {kept.length === 0 ? '(không còn ngày nào)'
                          : kept.length === 1 ? f(kept[0])
                          : `${f(kept[0])} → ${f(kept[kept.length - 1])}`}
                      </b>
                    </div>
                  );
                })()}
                <div className="flex items-center justify-end gap-2">
                  <SecondaryButton onClick={() => setDropConfirm(null)}>Giữ lại</SecondaryButton>
                  <PrimaryButton onClick={confirmDrop}>Bỏ ngày này</PrimaryButton>
                </div>
              </div>
            </Modal>

            <div className="flex items-center justify-between mt-2 px-1">
              <span className="text-xs text-muted">
                {dayList.filter(d => sessions[d]?.morning || sessions[d]?.afternoon).length} ngày được chọn
              </span>
              <span className="text-sm font-semibold text-gold">
                Tổng {String(
                  dayList.reduce((sum, d) => {
                    const ss = sessions[d] || {};
                    return sum + (ss.morning ? 0.5 : 0) + (ss.afternoon ? 0.5 : 0);
                  }, 0)
                ).replace('.', ',')} ngày phép
              </span>
            </div>
          </Field>
        )}

        {/* ── Lý do ──────────────────────────────────────────────────────── */}
        <Field label="Lý do" required>
          <textarea
            value={reason} onChange={e => setReason(e.target.value)}
            rows={3} maxLength={2000}
            placeholder="Nêu rõ lý do để quản lý có căn cứ duyệt…"
            className={inputCls + ' resize-y min-h-[84px]'}
          />
        </Field>

        <div className="flex justify-end gap-2 pt-1">
          <SecondaryButton onClick={reset} disabled={saving}>Xoá form</SecondaryButton>
          <PrimaryButton onClick={submit} loading={saving}>
            <Plus size={14} /> Gửi phiếu
          </PrimaryButton>
        </div>
      </div>
    </SectionCard>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// CHI TIẾT PHIẾU
// ══════════════════════════════════════════════════════════════════════════════

function DetailDrawer({ item, onClose, onCancelled }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  if (!item) return null;

  const cancel = async () => {
    setBusy(true);
    try {
      await employeeRequestApi.cancel(item.id);
      toast('Đã huỷ phiếu', 'success');
      onCancelled?.();
      onClose();
    } catch (e) {
      toast(e?.response?.data?.message || 'Không huỷ được phiếu', 'error');
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

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-surface rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-hairline sticky top-0 bg-surface">
          <div className="min-w-0">
            <h3 className="font-bold text-ink">{item.typeLabel}</h3>
            <p className="text-xs text-muted mt-0.5">Phiếu #{item.id}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-muted hover:bg-canvas">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-3">
          <Row label="Trạng thái">
            <StatusBadge status={item.status} label={item.statusLabel} />
          </Row>
          <Row label="Thời gian">{item.periodText}</Row>
          <Row label="Lý do"><span className="whitespace-pre-wrap">{item.reason}</span></Row>

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
          {item.decidedByName && <Row label="Người duyệt">{item.decidedByName}</Row>}
          {item.decidedAt && <Row label="Duyệt lúc">{formatDateTime(item.decidedAt)}</Row>}
          <Row label="Gửi lúc">{formatDateTime(item.createdAt)}</Row>
        </div>

        {item.status === 'PENDING' && (
          <div className="px-5 py-4 border-t border-hairline bg-canvas flex justify-end">
            <button onClick={cancel} disabled={busy}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold
                text-red-600 dark:text-red-300 border border-red-200 dark:border-red-500/28 bg-surface hover:bg-red-50 dark:bg-red-500/10 transition-colors disabled:opacity-50">
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              Huỷ phiếu
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TRANG
// ══════════════════════════════════════════════════════════════════════════════

export default function MyRequestsPage() {
  const toast = useToast();

  const [tab, setTab] = useState('create');
  const [config, setConfig] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  const loadConfig = useCallback(async () => {
    try {
      setConfig(await employeeRequestApi.formConfig());
    } catch (e) {
      toast(e?.response?.data?.message || 'Không tải được biểu mẫu', 'error');
    }
  }, [toast]);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const page = await employeeRequestApi.mine({ page: 0, size: 100 });
      setItems(page?.content ?? []);
    } catch (e) {
      toast(e?.response?.data?.message || 'Không tải được danh sách phiếu', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadConfig(); loadList(); }, [loadConfig, loadList]);

  const pendingCount = items.filter(i => i.status === 'PENDING').length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5 w-full">
      <PageHeader
        icon={FileText}
        title="Phiếu của tôi"
        subtitle="Xin nghỉ, công tác, đi trễ, về sớm, quên chấm công"
      />

      {/* Số dư phép đặt NGAY TRÊN form: biết còn mấy ngày trước khi điền, đỡ
          phải gửi phiếu rồi mới biết hết phép. */}
      <LeaveBalanceCard />

      <TabBar
        active={tab} onChange={setTab}
        tabs={[
          { id: 'create', label: 'Tạo phiếu', icon: Plus },
          { id: 'list', label: `Đã gửi${pendingCount ? ` (${pendingCount} chờ duyệt)` : ''}`, icon: CalendarDays },
        ]}
      />

      {tab === 'create' && (
        <CreateForm config={config} onCreated={() => { loadList(); setTab('list'); }} />
      )}

      {tab === 'list' && (
        <SectionCard>
          <SectionHeader title={`Phiếu đã gửi (${items.length})`} />
          {loading ? (
            <LoadingSpinner label="Đang tải…" />
          ) : items.length === 0 ? (
            <EmptyState
              icon={AlertCircle}
              title="Chưa có phiếu nào"
              description="Các phiếu bạn gửi sẽ hiện ở đây kèm kết quả duyệt."
              action={<PrimaryButton onClick={() => setTab('create')}><Plus size={14} /> Tạo phiếu</PrimaryButton>}
            />
          ) : (
            <Table>
              <Thead>
                <Tr className="bg-canvas text-muted">
                  <Th>Loại</Th>
                  <Th>Thời gian</Th>
                  <Th>Lý do</Th>
                  <Th>Trạng thái</Th>
                  <Th right>Gửi lúc</Th>
                  <Th />
                </Tr>
              </Thead>
              <tbody>
                {items.map(it => (
                  <Tr key={it.id} onClick={() => setSelected(it)}>
                    <Td className="font-medium text-ink whitespace-nowrap">{it.typeLabel}</Td>
                    <Td className="text-ink whitespace-nowrap">{it.periodText}</Td>
                    <Td className="text-muted max-w-[240px] truncate">{it.reason}</Td>
                    <Td><StatusBadge status={it.status} label={it.statusLabel} /></Td>
                    <Td right className="text-muted text-xs whitespace-nowrap">
                      {formatDateTime(it.createdAt)}
                    </Td>
                    <Td right><ChevronRight size={14} className="text-faint" /></Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </SectionCard>
      )}

      <DetailDrawer
        item={selected}
        onClose={() => setSelected(null)}
        onCancelled={loadList}
      />
    </div>
  );
}