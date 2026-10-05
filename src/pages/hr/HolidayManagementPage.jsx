// src/pages/hr/HolidayManagementPage.jsx
//
// QUẢN LÝ NGÀY LỄ CÔNG TY — Phase 3 (10/2026).
//
// Trang này do OWNER/ADMIN/HR/SUPER_ACCOUNTANT dùng để nhập danh sách ngày
// lễ cho mỗi năm. Dữ liệu được service tính lương (Phase 1 + 2) đọc để:
//   - Vẫn tính ngày lễ là CHUẨN CÔNG của tháng (lương vẫn trả).
//   - Loại trừ phụ cấp cơm trong ngày lễ.
//   - Áp hệ số ×3.0 nếu nhân viên có đi làm vào ngày lễ (OT).
//   - Pro-rate: nhân viên vào làm sau ngày lễ không được công của ngày lễ đó.
import { useEffect, useState, useCallback, useRef } from 'react';
import {
  CalendarDays, Plus, Trash2, Upload, Download, AlertCircle, CheckCircle2,
  Calendar, X, ChevronDown,
} from 'lucide-react';
import { holidayApi } from '../../api/holidayApi';
import { BackButton } from '../../components/common/SubPageNav';
import {
  PageHeader, SectionCard, LoadingSpinner, PrimaryButton, SecondaryButton,
  Table, Thead, Th, Td, Tr, EmptyState, formatDateTime,
} from '../../components/ui';
import Modal from '../../components/ui/Modal';
import { useToast } from '../../components/common/Toast';

// Vietnamese weekday labels
const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

function formatDateVn(isoDate) {
  if (!isoDate) return '—';
  const d = new Date(isoDate);
  const wd = WEEKDAYS[d.getDay()];
  return `${wd}, ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

// ──────────────────────────────────────────────────────────────────────────────
// YEAR PICKER — mặc định hiện 5 năm quanh năm hiện tại
// ──────────────────────────────────────────────────────────────────────────────

function YearPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const now = new Date().getFullYear();
  const years = Array.from({ length: 7 }, (_, i) => now - 2 + i);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-surface border border-hairline-2
          shadow-sm hover:border-gold/50 transition-colors min-w-[140px]">
        <Calendar size={16} className="text-gold" />
        <span className="font-bold text-ink text-sm flex-1 text-left">Năm {value}</span>
        <ChevronDown size={15} className={`text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute z-30 mt-2 w-full bg-surface rounded-2xl border border-hairline-2 shadow-xl p-2">
            {years.map(y => (
              <button key={y}
                onClick={() => { onChange(y); setOpen(false); }}
                className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-colors
                  ${y === value ? 'bg-gold text-white font-bold' : 'text-ink hover:bg-canvas'}`}>
                {y}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// MODAL — Thêm 1 ngày lễ
// ──────────────────────────────────────────────────────────────────────────────

function AddHolidayModal({ open, year, onClose, onSaved }) {
  const [date, setDate] = useState(`${year}-01-01`);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (open) {
      setDate(`${year}-01-01`);
      setName('');
    }
  }, [open, year]);

  const submit = async () => {
    if (!date) { toast('Chọn ngày', 'error'); return; }
    setSaving(true);
    try {
      await holidayApi.create({ date, name: name?.trim() || null });
      toast('Đã lưu', 'success');
      onSaved();
      onClose();
    } catch (e) {
      toast(e?.response?.data?.message || 'Không lưu được', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Thêm ngày lễ" size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose} disabled={saving}>Hủy</SecondaryButton>
          <PrimaryButton onClick={submit} loading={saving}>Lưu</PrimaryButton>
        </div>
      }>
      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium text-ink block mb-1">Ngày</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-canvas border border-hairline-2 text-ink" />
        </div>
        <div>
          <label className="text-sm font-medium text-ink block mb-1">Tên ngày lễ (tuỳ chọn)</label>
          <input value={name} onChange={e => setName(e.target.value)}
            placeholder="VD: Quốc khánh"
            className="w-full px-3 py-2 rounded-xl bg-canvas border border-hairline-2 text-ink" />
        </div>
      </div>
    </Modal>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// MODAL — Import Excel
// ──────────────────────────────────────────────────────────────────────────────

function ImportHolidayModal({ open, year, onClose, onDone }) {
  const [file, setFile] = useState(null);
  const [replaceYear, setReplaceYear] = useState(false);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (open) { setFile(null); setResult(null); setReplaceYear(false); }
  }, [open]);

  const run = async () => {
    if (!file) { toast('Chọn file', 'error'); return; }
    setBusy(true);
    try {
      const r = await holidayApi.importExcel(file, replaceYear ? year : null);
      setResult(r);
      toast(`Đã import ${r.saved}/${r.totalRows} ngày lễ`, 'success');
      onDone();
    } catch (e) {
      toast(e?.response?.data?.message || 'Không import được', 'error');
    } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Import ngày lễ từ Excel" size="md"
      footer={
        <div className="flex justify-between items-center gap-2">
          <SecondaryButton onClick={() => holidayApi.downloadTemplate(year)}>
            <Download size={15} /> Tải mẫu
          </SecondaryButton>
          <div className="flex gap-2">
            <SecondaryButton onClick={onClose} disabled={busy}>Đóng</SecondaryButton>
            <PrimaryButton onClick={run} loading={busy} disabled={!file}>Import</PrimaryButton>
          </div>
        </div>
      }>
      <div className="space-y-3">
        <p className="text-sm text-muted">
          File Excel cần 2 cột: <b>Ngày (dd/MM/yyyy)</b> và <b>Tên ngày lễ</b>. Dữ liệu
          bắt đầu từ hàng 2 (hàng 1 là header). Bấm "Tải mẫu" để lấy file mẫu.
        </p>
        <div>
          <input type="file" accept=".xlsx,.xls"
            onChange={e => setFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-ink file:mr-3 file:py-2 file:px-4
              file:rounded-xl file:border-0 file:bg-gold file:text-white file:font-bold
              hover:file:bg-gold-dark cursor-pointer" />
          {file && (
            <p className="text-xs text-muted mt-1 flex items-center gap-1">
              <CheckCircle2 size={12} className="text-emerald-600" /> {file.name}
            </p>
          )}
        </div>
        <label className="flex items-start gap-2 cursor-pointer">
          <input type="checkbox" checked={replaceYear}
            onChange={e => setReplaceYear(e.target.checked)}
            className="mt-1" />
          <div>
            <span className="text-sm font-bold text-ink">Xoá toàn bộ ngày lễ năm {year} trước khi import</span>
            <p className="text-xs text-muted">
              Dùng khi bạn muốn nhập lại từ đầu. Nếu không tick, file chỉ thêm / cập nhật
              các ngày trùng khớp.
            </p>
          </div>
        </label>

        {result && (
          <div className="rounded-xl border border-hairline-2 bg-canvas p-3 text-sm">
            <p className="font-bold text-ink mb-1">Kết quả</p>
            <ul className="text-xs text-muted space-y-0.5">
              <li>Tổng dòng: {result.totalRows}</li>
              <li className="text-emerald-700 dark:text-emerald-300">Đã lưu: {result.saved}</li>
              <li className="text-amber-700 dark:text-amber-300">Bỏ qua: {result.skipped}</li>
            </ul>
            {result.errors?.length > 0 && (
              <div className="mt-2">
                <p className="text-xs font-bold text-red-700 dark:text-red-300">Lỗi:</p>
                <ul className="text-xs text-red-700 dark:text-red-300 list-disc pl-5">
                  {result.errors.slice(0, 10).map((err, i) => <li key={i}>{err}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ──────────────────────────────────────────────────────────────────────────────

export default function HolidayManagementPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await holidayApi.listByYear(year);
      setItems(Array.isArray(list) ? list : []);
    } catch (e) {
      toast(e?.response?.data?.message || 'Không tải được danh sách', 'error');
    } finally { setLoading(false); }
  }, [year, toast]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (h) => {
    if (!window.confirm(`Xoá ngày lễ ${formatDateVn(h.date)}${h.name ? ` (${h.name})` : ''}?`)) return;
    setDeletingId(h.id);
    try {
      await holidayApi.delete(h.id);
      toast('Đã xoá', 'success');
      load();
    } catch (e) {
      toast(e?.response?.data?.message || 'Không xoá được', 'error');
    } finally { setDeletingId(null); }
  };

  const handleDeleteYear = async () => {
    if (!window.confirm(
      `XOÁ TOÀN BỘ ${items.length} ngày lễ của năm ${year}? Thao tác này không khôi phục được.`
    )) return;
    try {
      await holidayApi.deleteYear(year);
      toast(`Đã xoá toàn bộ ngày lễ năm ${year}`, 'success');
      load();
    } catch (e) {
      toast(e?.response?.data?.message || 'Không xoá được', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-canvas pb-10">
      <BackButton />
      <PageHeader
        icon={CalendarDays}
        title="Quản lý ngày lễ"
        subtitle="Danh sách ngày lễ công ty — ảnh hưởng tới chuẩn công tháng, phụ cấp cơm và OT ×3.0"
        right={
          <div className="flex items-center gap-2 flex-wrap">
            <YearPicker value={year} onChange={setYear} />
            <SecondaryButton onClick={() => setImportOpen(true)}>
              <Upload size={15} /> Import Excel
            </SecondaryButton>
            <PrimaryButton onClick={() => setAddOpen(true)}>
              <Plus size={15} /> Thêm ngày lễ
            </PrimaryButton>
          </div>
        }
      />

      <div className="max-w-5xl mx-auto px-4 mt-4">
        <SectionCard>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-bold text-ink">
                Ngày lễ năm {year}
                <span className="ml-2 text-sm font-normal text-muted">({items.length} ngày)</span>
              </h2>
            </div>
            {items.length > 0 && (
              <button onClick={handleDeleteYear}
                className="text-xs text-red-600 hover:underline flex items-center gap-1">
                <Trash2 size={12} /> Xoá cả năm
              </button>
            )}
          </div>

          {loading ? (
            <div className="py-10 flex justify-center"><LoadingSpinner /></div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title={`Chưa có ngày lễ nào cho năm ${year}`}
              hint="Bấm 'Thêm ngày lễ' hoặc 'Import Excel' để bắt đầu."
            />
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th>Ngày</Th>
                  <Th>Tên ngày lễ</Th>
                  <Th>Nhập lúc</Th>
                  <Th>Nhập bởi</Th>
                  <Th className="text-right">Thao tác</Th>
                </Tr>
              </Thead>
              <tbody>
                {items.map(h => (
                  <Tr key={h.id}>
                    <Td>
                      <div className="font-bold text-ink">{formatDateVn(h.date)}</div>
                    </Td>
                    <Td>{h.name || <span className="text-muted italic">—</span>}</Td>
                    <Td className="text-xs text-muted">
                      {h.createdAt ? formatDateTime(h.createdAt) : '—'}
                    </Td>
                    <Td className="text-xs text-muted">{h.createdByName || '—'}</Td>
                    <Td className="text-right">
                      <button
                        onClick={() => handleDelete(h)}
                        disabled={deletingId === h.id}
                        className="text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10
                          p-1.5 rounded-lg disabled:opacity-50">
                        <Trash2 size={14} />
                      </button>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </SectionCard>

        <SectionCard className="mt-4 bg-blue-50/40 dark:bg-blue-500/5 border-blue-200 dark:border-blue-500/20">
          <h3 className="font-bold text-ink text-sm mb-2 flex items-center gap-2">
            <AlertCircle size={14} className="text-blue-600" />
            Ngày lễ ảnh hưởng tới tính lương như thế nào
          </h3>
          <ul className="text-xs text-muted space-y-1 list-disc pl-5">
            <li>Vẫn tính là <b>chuẩn công</b> của tháng — nhân viên nghỉ ngày lễ vẫn hưởng lương.</li>
            <li><b>Không</b> được phụ cấp cơm trong ngày lễ.</li>
            <li>Nhân viên vào làm <b>sau</b> ngày lễ không được công của ngày lễ trước đó
              (ví dụ ký HĐ 9/9/2025 thì không có công 1/9, 2/9).</li>
            <li>Nếu nhân viên vẫn đi làm trong ngày lễ: toàn bộ thời gian × <b>3.0</b> cộng vào tiền OT.</li>
          </ul>
        </SectionCard>
      </div>

      <AddHolidayModal open={addOpen} year={year}
        onClose={() => setAddOpen(false)} onSaved={load} />
      <ImportHolidayModal open={importOpen} year={year}
        onClose={() => setImportOpen(false)} onDone={load} />
    </div>
  );
}
