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

import { employeeRequestApi, msToIsoDate, isoDateToMs } from '../../api/employeeRequestApi';
import { useToast } from '../../components/common/Toast';
import DatePicker from '../../components/ui/DatePicker';
import DateRangePicker from '../../components/ui/DateRangePicker';
import TimePicker from '../../components/ui/TimePicker';
import {
  PageHeader, SectionCard, SectionHeader, LoadingSpinner, EmptyState,
  PrimaryButton, SecondaryButton, Field, inputCls, TabBar,
  Table, Thead, Th, Td, Tr, formatDateTime,
} from '../../components/ui';

// ══════════════════════════════════════════════════════════════════════════════
// HIỂN THỊ TRẠNG THÁI
// ══════════════════════════════════════════════════════════════════════════════

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
  const [partial, setPartial] = useState(false);
  const [fromTime, setFromTime] = useState(null);
  const [toTime, setToTime] = useState(null);
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
    setPartial(false);
    setFromTime(null);
    setToTime(null);
  }, [typeValue]);

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
    setFromTime(null);
    setToTime(null);
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

    if (partial && (!fromTime || !toTime))
      return toast('Chưa chọn khung giờ nghỉ', 'error');

    if (partial && fromDate !== toDate)
      return toast('Nghỉ theo giờ chỉ áp dụng cho một ngày', 'error');

    setSaving(true);
    try {
      await employeeRequestApi.create({
        type: type.value,
        fromDate,
        toDate,
        fromTime: partial ? fromTime : null,
        toTime: partial ? toTime : null,
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
                    ? 'bg-[#1C1C1E] text-white border-[#1C1C1E] shadow-sm'
                    : 'bg-white text-[#8E8878] border-black/10 hover:border-[#C9A84C] hover:text-[#C9A84C]'}`}>
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

        {/* ── Nghỉ ít hơn 1 ngày ─────────────────────────────────────────── */}
        {type?.allowPartialDay && (
          <div className="rounded-xl border border-black/10 bg-[#FAF7F2] p-4 space-y-3">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" checked={partial}
                onChange={e => setPartial(e.target.checked)}
                className="w-4 h-4 accent-[#C9A84C] cursor-pointer" />
              <span className="text-sm font-medium text-[#1C1C1E]">Nghỉ ít hơn 1 ngày</span>
            </label>

            {partial && (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <TimePicker value={fromTime} onChange={setFromTime}
                    placeholder="Từ giờ" defaultTime="13:00" />
                  <span className="text-[#C4B9A8] text-sm">→</span>
                  <TimePicker value={toTime} onChange={setToTime}
                    placeholder="Đến giờ" defaultTime="17:00" />
                </div>
                <p className="text-xs text-[#8E8878] leading-relaxed">
                  Chỉ được miễn có mặt trong đúng khung giờ này. Phần còn lại của ca vẫn
                  tính đi trễ / về sớm như thường — cần thêm phiếu riêng nếu hôm đó cũng
                  đi trễ.
                </p>
              </>
            )}
          </div>
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
    <div className="flex gap-3 py-2.5 border-b border-black/5 last:border-0">
      <span className="text-xs text-[#8E8878] uppercase tracking-wider w-32 flex-shrink-0 pt-0.5">{label}</span>
      <div className="text-sm text-[#1C1C1E] min-w-0 flex-1">{children}</div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/5 sticky top-0 bg-white">
          <div className="min-w-0">
            <h3 className="font-bold text-[#1C1C1E]">{item.typeLabel}</h3>
            <p className="text-xs text-[#8E8878] mt-0.5">Phiếu #{item.id}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-[#8E8878] hover:bg-[#FAF7F2]">
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
              <span className="font-semibold text-orange-600">{item.deductedDays} công</span>
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
          <div className="px-5 py-4 border-t border-black/5 bg-[#FAF7F2] flex justify-end">
            <button onClick={cancel} disabled={busy}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold
                text-red-600 border border-red-200 bg-white hover:bg-red-50 transition-colors disabled:opacity-50">
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
                <Tr className="bg-[#FAF7F2] text-[#8E8878]">
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
                    <Td className="font-medium text-[#1C1C1E] whitespace-nowrap">{it.typeLabel}</Td>
                    <Td className="text-[#1C1C1E] whitespace-nowrap">{it.periodText}</Td>
                    <Td className="text-[#8E8878] max-w-[240px] truncate">{it.reason}</Td>
                    <Td><StatusBadge status={it.status} label={it.statusLabel} /></Td>
                    <Td right className="text-[#8E8878] text-xs whitespace-nowrap">
                      {formatDateTime(it.createdAt)}
                    </Td>
                    <Td right><ChevronRight size={14} className="text-[#C4B9A8]" /></Td>
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