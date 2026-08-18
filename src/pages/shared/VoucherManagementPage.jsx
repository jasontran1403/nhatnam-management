// src/pages/shared/VoucherManagementPage.jsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Ticket, Search, Plus, Printer, Ban, Trash2, Pencil, RefreshCw,
  Cake, Store, Gift, Package, Layers, Building2, User as UserIcon, X,
} from 'lucide-react';
import { voucherApi, downloadBlob } from '../../api/voucherApi';
import { adminCustomerApi } from '../../api/adminApi';
import api from '../../api/axios';
import Modal from '../../components/ui/Modal';
import DatePicker from '../../components/ui/DatePicker';
import Pagination from '../../components/ui/Pagination';
import { TableSkeleton } from '../../components/ui/Skeleton.jsx';
import useMinLoading from '../../hooks/useMinLoading.js';
import useDebounce from '../../utils/useDebounce.js';
import { useToast } from '../../components/common/Toast';
import {
  PageHeader, EmptyState, PrimaryButton, SecondaryButton, DangerButton,
  Field, inputCls, formatNumber,
} from '../../components/ui';
import { formatDate } from '../../utils/anniversary';

/**
 * QUẢN LÝ VOUCHER TẶNG KHÁCH.
 *
 * <p>Voucher gắn với một tài khoản khách hàng nhưng ĐỔI ĐƯỢC (tặng nhầm người thì sửa,
 * không phải huỷ rồi tạo lại — mã voucher có thể đã in ra và gửi đi rồi).
 *
 * <p>Thu hồi dùng nút "Thu hồi" (giữ lại lịch sử ai tặng ai) chứ không xoá; nút Xoá chỉ
 * dành cho voucher tạo nhầm và chỉ OWNER/ADMIN thấy.
 */

const REASONS = [
  { value: 'BIRTHDAY',      label: 'Sinh nhật',   icon: Cake,    tone: 'rose' },
  { value: 'STORE_OPENING', label: 'Khai trương', icon: Store,   tone: 'emerald' },
  { value: 'PROMOTION',     label: 'Khuyến mãi',  icon: Gift,    tone: 'gold' },
  { value: 'OTHER',         label: 'Khác',        icon: Ticket,  tone: 'slate' },
];

const SCOPES = [
  { value: 'ALL',      label: 'Toàn bộ sản phẩm' },
  { value: 'CATEGORY', label: 'Theo danh mục' },
  { value: 'PRODUCT',  label: 'Sản phẩm cụ thể' },
];

const STATUS_LABEL = {
  ACTIVE:    { label: 'Còn hiệu lực', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' },
  USED:      { label: 'Đã dùng hết',  cls: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300' },
  EXPIRED:   { label: 'Hết hạn',      cls: 'bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300' },
  CANCELLED: { label: 'Đã thu hồi',   cls: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300' },
};

export default function VoucherManagementPage({ canManage = true }) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const debouncedQ = useDebounce(q, 500);
  const [reason, setReason] = useState('');
  const [effectiveStatus, setEffectiveStatus] = useState('');
  const [page, setPage] = useState(0);
  const [data, setData] = useState({ content: [], totalPages: 0, totalElements: 0 });
  const [loading, setLoading] = useMinLoading();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // Trang này mount ở /owner, /admin và /seller nên đường dẫn con suy từ URL.
  const base = pathname.startsWith('/owner') ? '/owner'
    : pathname.startsWith('/admin') ? '/admin' : '/seller';
  const openDetail = (v) => navigate(`${base}/vouchers/${v.id}`);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await voucherApi.list({
        q: debouncedQ || undefined,
        reason: reason || undefined,
        effectiveStatus: effectiveStatus || undefined,
        page, size: 20,
      });
      setData(res || { content: [] });
    } catch (e) {
      toast(e?.message || 'Không tải được danh sách voucher', 'error');
    } finally {
      setLoading(false);
    }
  }, [debouncedQ, reason, effectiveStatus, page, setLoading, toast]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setSelected(new Set()); }, [page, debouncedQ, reason, effectiveStatus]);

  const handlePrint = async (v) => {
    try {
      const res = await voucherApi.pdf(v.id);
      downloadBlob(res, `voucher-${v.code}.pdf`);
    } catch (e) { toast(e?.message || 'Không tạo được phiếu in', 'error'); }
  };

  const handlePrintBatch = async () => {
    if (!selected.size) return;
    try {
      const res = await voucherApi.pdfBatch([...selected]);
      downloadBlob(res, 'vouchers.pdf');
    } catch (e) { toast(e?.message || 'Không tạo được phiếu in', 'error'); }
  };

  const handleCancel = async () => {
    setBusy(true);
    try {
      await voucherApi.cancel(cancelTarget.id);
      toast('Đã thu hồi voucher', 'success');
      setCancelTarget(null); load();
    } catch (e) { toast(e?.message || 'Thu hồi thất bại', 'error'); }
    finally { setBusy(false); }
  };

  const handleDelete = async () => {
    setBusy(true);
    try {
      await voucherApi.remove(deleteTarget.id);
      toast('Đã xoá voucher', 'success');
      setDeleteTarget(null); load();
    } catch (e) { toast(e?.message || 'Xoá thất bại', 'error'); }
    finally { setBusy(false); }
  };

  const rows = data.content || [];
  const allChecked = rows.length > 0 && rows.every(v => selected.has(v.id));
  const toggleOne = (id) => {
    const n = new Set(selected); n.has(id) ? n.delete(id) : n.add(id); setSelected(n);
  };
  const toggleAll = () =>
    allChecked ? setSelected(new Set()) : setSelected(new Set(rows.map(v => v.id)));

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5">
      <PageHeader
        icon={Ticket}
        title="Quản lý voucher"
        subtitle={`Tổng ${formatNumber(data.totalElements || 0)} voucher`}
        action={
          <div className="flex items-center gap-2">
            {canManage && (
              <PrimaryButton
                onClick={() => { setEditing(null); setFormOpen(true); }}
                className="flex items-center gap-1.5 text-xs px-3 py-2">
                <Plus size={13} /> Tạo voucher
              </PrimaryButton>
            )}
            <button onClick={load}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-line text-xs text-ink-2 hover:border-gold transition-colors">
              <RefreshCw size={13} /> Làm mới
            </button>
          </div>
        }
      />

      {/* Bộ lọc */}
      <div className="bg-surface rounded-2xl border border-hairline p-3 sm:p-4 shadow-sm
                      flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
          <input
            type="text" value={q}
            onChange={e => { setQ(e.target.value); setPage(0); }}
            placeholder="Tìm mã voucher, tiêu đề, tên khách, SĐT..."
            className={`${inputCls} pl-9`} />
        </div>
        <select value={reason}
          onChange={e => { setReason(e.target.value); setPage(0); }}
          className={`${inputCls} sm:w-44`}>
          <option value="">Tất cả dịp tặng</option>
          {REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <select value={effectiveStatus}
          onChange={e => { setEffectiveStatus(e.target.value); setPage(0); }}
          className={`${inputCls} sm:w-44`}>
          <option value="">Tất cả trạng thái</option>
          <option value="ACTIVE">Còn hiệu lực</option>
          <option value="EXPIRED">Hết hạn</option>
          <option value="USED">Đã dùng hết</option>
          <option value="CANCELLED">Đã thu hồi</option>
        </select>
      </div>

      {/* Thanh thao tác hàng loạt */}
      {selected.size > 0 && (
        <div className="bg-gold/10 border border-gold/30 rounded-2xl p-3 flex items-center gap-3 flex-wrap">
          <p className="text-sm text-ink flex-1">
            Đã chọn <span className="font-bold text-gold">{selected.size}</span> voucher
          </p>
          <SecondaryButton onClick={handlePrintBatch}>
            <Printer size={14} /> In {selected.size} phiếu
          </SecondaryButton>
        </div>
      )}

      {/* Bảng */}
      <div className="bg-surface rounded-2xl border border-hairline shadow-sm overflow-hidden">
        {loading ? (
          <TableSkeleton cols={6} rows={6} />
        ) : rows.length === 0 ? (
          <EmptyState icon={Ticket} title="Chưa có voucher nào"
            description="Tạo voucher tặng khách nhân dịp sinh nhật hoặc khai trương cửa hàng mới." />
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-canvas text-muted">
                    <th className="px-4 py-3 w-10">
                      <input type="checkbox" checked={allChecked} onChange={toggleAll}
                        className="rounded accent-gold" />
                    </th>
                    <Th>Mã / Tiêu đề</Th>
                    <Th>Khách hàng</Th>
                    <Th className="text-right">Hạn mức</Th>
                    <Th className="text-center">Hạn sử dụng</Th>
                    <Th>Điều kiện</Th>
                    <Th className="text-right">Thao tác</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {rows.map(v => (
                    <tr key={v.id}
                      onClick={() => openDetail(v)}
                      className="hover:bg-canvas transition-colors cursor-pointer">
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={selected.has(v.id)}
                          onChange={() => toggleOne(v.id)} className="rounded accent-gold" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <ReasonIcon reason={v.reason} />
                          <div className="min-w-0">
                            <p className="font-mono font-bold text-ink text-xs">{v.code}</p>
                            <p className="text-xs text-muted truncate max-w-[180px]">
                              {v.title || reasonLabel(v.reason)}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {v.customerType === 'COMPANY'
                            ? <Building2 size={12} className="text-blue-500 shrink-0" />
                            : <UserIcon size={12} className="text-gold shrink-0" />}
                          <div className="min-w-0">
                            <p className="text-ink text-xs font-medium truncate max-w-[160px]">
                              {v.customerName || '—'}
                            </p>
                            {v.customerPhone && (
                              <p className="text-[10px] text-faint">{v.customerPhone}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <p className="font-bold text-ink">{formatNumber(v.amount)} đ</p>
                        {v.usedAmount > 0 && (
                          <p className="text-[10px] text-muted">
                            còn {formatNumber(v.remaining)} đ
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <p className="text-xs text-ink-2">{formatDate(v.validFrom)}</p>
                        <p className="text-xs text-ink-2">{formatDate(v.validTo)}</p>
                        <StatusBadge v={v} />
                      </td>
                      <td className="px-4 py-3">
                        <ScopeCell v={v} />
                      </td>
                      {/* stopPropagation: không có nó thì bấm In/Sửa/Thu hồi sẽ kéo theo
                          click của cả hàng và người dùng bị đẩy sang trang chi tiết. */}
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <IconBtn title="In phiếu" onClick={() => handlePrint(v)}>
                            <Printer size={14} />
                          </IconBtn>
                          {canManage && (
                            <IconBtn title="Sửa"
                              onClick={() => { setEditing(v); setFormOpen(true); }}>
                              <Pencil size={14} />
                            </IconBtn>
                          )}
                          {canManage && v.effectiveStatus !== 'CANCELLED' && (
                            <IconBtn title="Thu hồi" danger onClick={() => setCancelTarget(v)}>
                              <Ban size={14} />
                            </IconBtn>
                          )}
                          {canManage && (
                            <IconBtn title="Xoá" danger onClick={() => setDeleteTarget(v)}>
                              <Trash2 size={14} />
                            </IconBtn>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="lg:hidden divide-y divide-hairline">
              {rows.map(v => (
                <div key={v.id} onClick={() => openDetail(v)}
                  className="p-4 space-y-2.5 hover:bg-canvas/50 transition-colors cursor-pointer">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <ReasonIcon reason={v.reason} />
                      <div className="min-w-0">
                        <p className="font-mono font-bold text-ink text-sm">{v.code}</p>
                        <p className="text-xs text-muted truncate">
                          {v.title || reasonLabel(v.reason)}
                        </p>
                      </div>
                    </div>
                    <StatusBadge v={v} />
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted truncate max-w-[55%]">{v.customerName || '—'}</span>
                    <span className="font-bold text-ink">{formatNumber(v.amount)} đ</span>
                  </div>

                  <p className="text-[11px] text-muted">
                    {formatDate(v.validFrom)} — {formatDate(v.validTo)}
                  </p>
                  <ScopeCell v={v} />

                  <div className="flex items-center gap-2 pt-1" onClick={e => e.stopPropagation()}>
                    <SecondaryButton onClick={() => handlePrint(v)} className="flex-1 text-xs">
                      <Printer size={13} /> In phiếu
                    </SecondaryButton>
                    {canManage && (
                      <SecondaryButton
                        onClick={() => { setEditing(v); setFormOpen(true); }}
                        className="flex-1 text-xs">
                        <Pencil size={13} /> Sửa
                      </SecondaryButton>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {data.totalPages > 1 && (
        <Pagination page={page} totalPages={data.totalPages} onChange={setPage} />
      )}

      {/* Modals */}
      <VoucherFormModal
        open={formOpen}
        voucher={editing}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        onSaved={() => { setFormOpen(false); setEditing(null); load(); }}
      />

      <Modal open={!!cancelTarget} onClose={() => setCancelTarget(null)} title="Thu hồi voucher" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-ink-2">
            Thu hồi voucher <span className="font-mono font-bold text-ink">{cancelTarget?.code}</span>?
            Voucher sẽ không dùng được nữa nhưng vẫn giữ trong lịch sử.
          </p>
          <div className="flex gap-2">
            <SecondaryButton onClick={() => setCancelTarget(null)} className="flex-1">Huỷ</SecondaryButton>
            <DangerButton onClick={handleCancel} disabled={busy} className="flex-1">
              {busy ? 'Đang xử lý...' : 'Thu hồi'}
            </DangerButton>
          </div>
        </div>
      </Modal>

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Xoá voucher" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-ink-2">
            Xoá hẳn voucher <span className="font-mono font-bold text-ink">{deleteTarget?.code}</span>?
            Thao tác này không hoàn tác được. Nếu phiếu đã in và gửi cho khách, nên dùng
            <strong> Thu hồi</strong> thay vì xoá.
          </p>
          <div className="flex gap-2">
            <SecondaryButton onClick={() => setDeleteTarget(null)} className="flex-1">Huỷ</SecondaryButton>
            <DangerButton onClick={handleDelete} disabled={busy} className="flex-1">
              {busy ? 'Đang xoá...' : 'Xoá'}
            </DangerButton>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ── Form tạo/sửa voucher ─────────────────────────────────────────────────────

function VoucherFormModal({ open, voucher, onClose, onSaved }) {
  const toast = useToast();
  const isEdit = !!voucher;

  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [customerQ, setCustomerQ] = useState('');
  const debouncedCustomerQ = useDebounce(customerQ, 400);
  const [customers, setCustomers] = useState([]);
  /**
   * Picker đang mở: 'CUSTOMER' | 'CATEGORY' | 'PRODUCT' | null.
   *
   * <p>Danh sách chọn được tách thành MODAL RIÊNG đè lên modal form thay vì nhúng
   * inline. Nhúng inline thì danh sách bị giới hạn trong chiều cao form, cuộn lồng nhau
   * và phần dưới bị cắt mất — chính lỗi trong ảnh chụp màn hình.
   */
  const [picker, setPicker] = useState(null);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);

  function emptyForm() {
    const now = Date.now();
    return {
      customerId: '', customerLabel: '', title: '', amount: '',
      validFrom: now,
      // Mặc định 30 ngày — đủ dài để khách thu xếp ghé mua, đủ ngắn để chiến dịch
      // tặng quà có điểm kết thúc rõ ràng.
      validTo: now + 30 * 86400000,
      reason: 'PROMOTION', applyScope: 'ALL',
      categoryIds: [], productIds: [], note: '',
    };
  }

  useEffect(() => {
    if (!open) return;
    if (voucher) {
      setForm({
        customerId: voucher.customerId || '',
        customerLabel: voucher.customerName || '',
        title: voucher.title || '',
        amount: voucher.amount ?? '',
        validFrom: voucher.validFrom,
        validTo: voucher.validTo,
        reason: voucher.reason || 'PROMOTION',
        applyScope: voucher.applyScope || 'ALL',
        categoryIds: voucher.categoryIds ? [...voucher.categoryIds] : [],
        productIds: voucher.productIds ? [...voucher.productIds] : [],
        note: voucher.note || '',
      });
    } else {
      setForm(emptyForm());
    }
    setCustomerQ('');
  }, [open, voucher]);

  // Nạp danh mục + sản phẩm một lần khi mở form, để chọn điều kiện áp dụng.
  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const [catRes, prodRes] = await Promise.all([
          api.get('/api/seller/all-categories'),
          api.get('/api/seller/products'),
        ]);
        setCategories(catRes?.data?.data || []);
        const p = prodRes?.data?.data;
        setProducts(Array.isArray(p) ? p : (p?.content || []));
      } catch {
        // Không chặn form: người dùng vẫn tạo được voucher phạm vi "toàn bộ sản phẩm".
        toast('Không tải được danh mục/sản phẩm để chọn điều kiện', 'error');
      }
    })();
  }, [open, toast]);

  // Tìm khách hàng.
  // TRƯỚC ĐÂY chặn luôn khi isEdit, khiến form sửa không nạp danh sách nào và hiện
  // "Không tìm thấy khách hàng" — người dùng tưởng modal hỏng. Voucher được phép đổi
  // khách nhận, nên chế độ sửa cũng cần danh sách này.
  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const res = await adminCustomerApi.list({
          q: debouncedCustomerQ || undefined, page: 0, size: 20, sort: 'id,desc',
        });
        setCustomers(res?.content || []);
      } catch { /* danh sách rỗng là đủ tín hiệu cho người dùng */ }
    })();
  }, [open, debouncedCustomerQ]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const toggleId = (key, id) => setForm(f => {
    const arr = f[key];
    return { ...f, [key]: arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id] };
  });

  const handleSave = async () => {
    if (!form.customerId) { toast('Vui lòng chọn khách hàng', 'error'); return; }
    if (!form.amount || Number(form.amount) <= 0) { toast('Hạn mức phải lớn hơn 0', 'error'); return; }
    if (form.validTo < form.validFrom) { toast('Ngày hết hạn phải sau ngày bắt đầu', 'error'); return; }

    const payload = {
      customerId: Number(form.customerId),
      title: form.title?.trim() || null,
      amount: Number(form.amount),
      validFrom: form.validFrom,
      validTo: form.validTo,
      reason: form.reason,
      applyScope: form.applyScope,
      categoryIds: form.applyScope === 'CATEGORY' ? form.categoryIds : [],
      productIds: form.applyScope === 'PRODUCT' ? form.productIds : [],
      note: form.note?.trim() || null,
    };

    setSaving(true);
    try {
      if (isEdit) await voucherApi.update(voucher.id, payload);
      else await voucherApi.create(payload);
      toast(isEdit ? 'Đã cập nhật voucher' : 'Đã tạo voucher', 'success');
      onSaved();
    } catch (e) {
      toast(e?.message || 'Lưu thất bại', 'error');
    } finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} size="lg"
      title={isEdit ? `Sửa voucher ${voucher?.code || ''}` : 'Tạo voucher mới'}>
      <div className="space-y-4">
        {/* Khách hàng — chọn qua modal riêng, xem PickerModal. */}
        <Field label="Khách hàng *">
          <button type="button" onClick={() => setPicker('CUSTOMER')}
            className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-sm text-left transition-colors
              ${form.customerId
                ? 'bg-gold/10 border-gold/40 text-ink'
                : 'border-line text-muted hover:border-gold'}`}>
            <span className="truncate">
              {form.customerLabel || 'Chọn khách hàng...'}
            </span>
            <Search size={15} className="text-muted shrink-0" />
          </button>
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Dịp tặng">
            <select value={form.reason} onChange={e => set('reason', e.target.value)}
              className={inputCls}>
              {REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </Field>
          <Field label="Hạn mức (đ) *">
            <input type="number" min="0" step="1000" value={form.amount}
              onChange={e => set('amount', e.target.value)}
              placeholder="VD: 500000" className={inputCls} />
          </Field>
        </div>

        <Field label="Tiêu đề trên phiếu">
          <input value={form.title} onChange={e => set('title', e.target.value)}
            placeholder="VD: Quà sinh nhật 2026 (để trống sẽ dùng tiêu đề mặc định theo dịp)"
            className={inputCls} />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Có hiệu lực từ *">
            <DatePicker value={form.validFrom} onChange={v => set('validFrom', v)} />
          </Field>
          <Field label="Hết hạn ngày *">
            <DatePicker value={form.validTo} onChange={v => set('validTo', v)}
              minDate={form.validFrom ? new Date(form.validFrom) : undefined} />
          </Field>
        </div>

        {/* Điều kiện áp dụng */}
        <Field label="Điều kiện áp dụng">
          <div className="flex gap-2 flex-wrap">
            {SCOPES.map(s => (
              <button key={s.value} type="button"
                onClick={() => set('applyScope', s.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors
                  ${form.applyScope === s.value
                    ? 'bg-gold text-white border-gold'
                    : 'border-line text-ink-2 hover:bg-canvas'}`}>
                {s.label}
              </button>
            ))}
          </div>

          {form.applyScope === 'CATEGORY' && (
            <ScopeSummaryButton
              icon={Layers}
              count={form.categoryIds.length}
              label="danh mục"
              onClick={() => setPicker('CATEGORY')}
            />
          )}
          {form.applyScope === 'PRODUCT' && (
            <ScopeSummaryButton
              icon={Package}
              count={form.productIds.length}
              label="sản phẩm"
              onClick={() => setPicker('PRODUCT')}
            />
          )}
        </Field>

        <Field label="Ghi chú nội bộ">
          <textarea value={form.note} onChange={e => set('note', e.target.value)}
            rows={2} placeholder="Không in lên phiếu"
            className={`${inputCls} resize-none`} />
        </Field>

        <div className="flex gap-2 pt-1">
          <SecondaryButton onClick={onClose} className="flex-1">Huỷ</SecondaryButton>
          <PrimaryButton onClick={handleSave} disabled={saving} className="flex-1">
            {saving ? 'Đang lưu...' : (isEdit ? 'Cập nhật' : 'Tạo voucher')}
          </PrimaryButton>
        </div>
      </div>

      {/* Các picker nằm NGOÀI luồng nội dung form, z-index cao hơn modal cha. */}
      <PickerModal
        open={picker === 'CUSTOMER'}
        title="Chọn khách hàng"
        onClose={() => setPicker(null)}
        searchValue={customerQ}
        onSearch={setCustomerQ}
        searchPlaceholder="Tìm theo tên, SĐT, mã KH..."
        items={customers.map(c => ({
          id: c.id,
          name: (c.customerType === 'COMPANY' ? (c.companyName || c.name) : c.name) || `KH#${c.id}`,
          hint: [c.phone, c.customerType === 'COMPANY' ? 'Công ty' : null].filter(Boolean).join(' · '),
        }))}
        selectedIds={form.customerId ? [form.customerId] : []}
        multi={false}
        onPick={(item) => {
          set('customerId', item.id);
          set('customerLabel', item.name);
          setPicker(null);
        }}
        emptyText="Không tìm thấy khách hàng"
      />

      <PickerModal
        open={picker === 'CATEGORY'}
        title="Chọn danh mục áp dụng"
        onClose={() => setPicker(null)}
        items={categories.map(c => ({ id: c.id, name: c.name }))}
        selectedIds={form.categoryIds}
        multi
        onPick={(item) => toggleId('categoryIds', item.id)}
        emptyText="Chưa có danh mục nào"
        icon={Layers}
      />

      <PickerModal
        open={picker === 'PRODUCT'}
        title="Chọn sản phẩm áp dụng"
        onClose={() => setPicker(null)}
        items={products.map(p => ({ id: p.id, name: p.name }))}
        selectedIds={form.productIds}
        multi
        onPick={(item) => toggleId('productIds', item.id)}
        emptyText="Chưa có sản phẩm nào"
        icon={Package}
      />
    </Modal>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function Th({ children, className = '' }) {
  return (
    <th className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-wider ${className}`}>
      {children}
    </th>
  );
}

function IconBtn({ children, title, onClick, danger }) {
  return (
    <button title={title} onClick={onClick}
      className={`p-1.5 rounded-lg transition-colors
        ${danger
          ? 'text-muted hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10'
          : 'text-muted hover:text-gold hover:bg-gold/10'}`}>
      {children}
    </button>
  );
}

function reasonLabel(value) {
  return REASONS.find(r => r.value === value)?.label || 'Voucher';
}

function ReasonIcon({ reason }) {
  const r = REASONS.find(x => x.value === reason) || REASONS[3];
  const Icon = r.icon;
  const tones = {
    rose: 'bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-300',
    emerald: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300',
    gold: 'bg-gold/15 text-gold',
    slate: 'bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300',
  };
  return (
    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${tones[r.tone]}`}>
      <Icon size={14} />
    </div>
  );
}

function StatusBadge({ v }) {
  const s = STATUS_LABEL[v.effectiveStatus] || STATUS_LABEL.ACTIVE;
  return (
    <span className={`inline-block mt-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold ${s.cls}`}>
      {s.label}
      {v.effectiveStatus === 'ACTIVE' && v.daysLeft != null && v.daysLeft <= 7 && (
        <span> · còn {v.daysLeft}n</span>
      )}
    </span>
  );
}

function ScopeCell({ v }) {
  if (v.applyScope === 'ALL' || !v.applyScope) {
    return <span className="text-xs text-muted">Toàn bộ sản phẩm</span>;
  }
  const items = v.applyScope === 'CATEGORY' ? (v.categories || []) : (v.products || []);
  const Icon = v.applyScope === 'CATEGORY' ? Layers : Package;
  return (
    <div className="flex items-start gap-1.5">
      <Icon size={12} className="text-muted mt-0.5 shrink-0" />
      <div className="flex flex-wrap gap-1 max-w-[220px]">
        {items.slice(0, 3).map(i => (
          <span key={i.id}
            className="px-1.5 py-0.5 rounded-md bg-canvas text-[10px] text-ink-2 border border-line-soft">
            {i.name}
          </span>
        ))}
        {items.length > 3 && (
          <span className="text-[10px] text-faint">+{items.length - 3}</span>
        )}
        {items.length === 0 && <span className="text-[10px] text-faint italic">—</span>}
      </div>
    </div>
  );
}

/** Nút tóm tắt phạm vi áp dụng, bấm vào mở picker. */
function ScopeSummaryButton({ icon: Icon, count, label, onClick }) {
  return (
    <button type="button" onClick={onClick}
      className={`mt-2 w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-sm transition-colors
        ${count > 0
          ? 'bg-gold/10 border-gold/40 text-ink'
          : 'border-line border-dashed text-muted hover:border-gold'}`}>
      <span className="flex items-center gap-2">
        {Icon && <Icon size={14} className="text-muted" />}
        {count > 0 ? `Đã chọn ${count} ${label}` : `Chọn ${label} áp dụng...`}
      </span>
      <span className="text-xs text-gold font-semibold">Chọn</span>
    </button>
  );
}

/**
 * Modal chọn từ danh sách, đè LÊN modal form (z-index cao hơn).
 *
 * <p>Tách thành modal riêng thay vì danh sách nhúng trong form: danh sách nhúng bị giới
 * hạn bởi chiều cao form, tạo cuộn lồng trong cuộn và phần dưới bị cắt mất. Ở đây danh
 * sách được dùng gần hết chiều cao màn hình nên chọn từ vài trăm sản phẩm vẫn thoải mái.
 *
 * @param multi true = chọn nhiều, modal không tự đóng sau mỗi lần bấm
 */
function PickerModal({
  open, title, onClose, items = [], selectedIds = [], multi, onPick,
  emptyText, icon: Icon, searchValue, onSearch, searchPlaceholder,
}) {
  const [localQ, setLocalQ] = useState('');

  // Tìm kiếm phía server (khách hàng) dùng searchValue/onSearch từ cha;
  // danh mục/sản phẩm đã nạp sẵn nên lọc ngay tại chỗ.
  const serverSearch = typeof onSearch === 'function';
  const filtered = useMemo(() => {
    if (serverSearch) return items;
    const needle = localQ.trim().toLowerCase();
    if (!needle) return items;
    return items.filter(i => (i.name || '').toLowerCase().includes(needle));
  }, [items, localQ, serverSearch]);

  useEffect(() => { if (open) setLocalQ(''); }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface w-full max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl
                      max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-hairline shrink-0">
          <h3 className="font-bold text-ink text-base">{title}</h3>
          <button onClick={onClose}
            className="text-muted hover:text-ink p-1.5 rounded-lg hover:bg-canvas transition-colors">
            <X size={17} />
          </button>
        </div>

        <div className="px-5 pt-4 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={15} />
            <input
              autoFocus
              value={serverSearch ? searchValue : localQ}
              onChange={e => (serverSearch ? onSearch(e.target.value) : setLocalQ(e.target.value))}
              placeholder={searchPlaceholder || 'Lọc nhanh...'}
              className={`${inputCls} pl-9`} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {filtered.length === 0 ? (
            <p className="text-xs text-faint italic text-center py-6">{emptyText}</p>
          ) : (
            <div className="rounded-xl border border-line-soft divide-y divide-hairline">
              {filtered.map(item => {
                const active = selectedIds.includes(item.id);
                return (
                  <button key={item.id} type="button" onClick={() => onPick(item)}
                    className={`w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors
                      ${active ? 'bg-gold/15 text-ink' : 'hover:bg-canvas text-ink-2'}`}>
                    {multi && (
                      <input type="checkbox" checked={active} readOnly className="rounded accent-gold" />
                    )}
                    {Icon && <Icon size={13} className="text-muted shrink-0" />}
                    <span className="flex-1 min-w-0">
                      <span className="block truncate">{item.name}</span>
                      {item.hint && (
                        <span className="block text-[11px] text-faint truncate">{item.hint}</span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-5 py-3.5 border-t border-hairline shrink-0 flex items-center justify-between gap-3">
          <span className="text-xs text-muted">
            {multi ? `Đã chọn ${selectedIds.length}` : ''}
          </span>
          <PrimaryButton onClick={onClose} className="px-6">Xong</PrimaryButton>
        </div>
      </div>
    </div>
  );
}
