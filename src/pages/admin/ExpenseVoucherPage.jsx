// src/pages/admin/ExpenseVoucherPage.jsx
import { useLang } from '../../context/LangContext';
import { useAuth } from '../../context/AuthContext';
import { useState, useEffect, useCallback } from 'react';
import { Sk, TableSkeleton } from '../../components/ui/Skeleton.jsx';
import useMinLoading from '../../hooks/useMinLoading.js';
import { adminExpenseApi } from '../../api/adminApi';
import { expenseApi } from '../../api/services';
import { VENDOR_TYPE_LABELS } from '../accountant/ExpenseCreateModal';
import ExpenseItemsEditor from '../../components/expense/ExpenseItemsEditor';
import ExpenseBulkActionModal, { canApproveVoucher } from '../../components/expense/ExpenseBulkActionModal';
import ExpenseVoucherLogList from '../../components/expense/ExpenseVoucherLogList';
import { useToast } from '../../components/common/Toast';
import { Receipt, CheckCircle, XCircle, Clock, ChevronDown, ChevronUp, DollarSign, FileText, X, ChevronLeft, ChevronRight, Download, Upload, Wallet, Search, Landmark, ShieldCheck, Settings2, Save, RotateCcw, ListChecks } from 'lucide-react';
import { BackButton, useSubPageNav } from '../../components/common/SubPageNav';
import {
  PageHeader, LoadingSpinner, EmptyState,
  formatCurrency, formatDateTime,
} from '../../components/ui';
import DateRangePicker from '../../components/ui/DateRangePicker';


const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

function imgSrc(url) {
  if (!url) return '';
  return url.startsWith('http') ? url : `${BASE_URL}/api/auth${url}`;
}

// ── Lightbox ──────────────────────────────────────────────────────────────────
function Lightbox({ images, index, onClose, onPrev, onNext }) {
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onPrev();
      if (e.key === 'ArrowRight') onNext();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, onPrev, onNext]);

  if (index === null || !images?.length) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors z-10"
      >
        <X size={20} />
      </button>

      {/* Counter */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white/70 text-sm">
        {index + 1} / {images.length}
      </div>

      {/* Prev */}
      {images.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); onPrev(); }}
          className="absolute left-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
        >
          <ChevronLeft size={22} />
        </button>
      )}

      {/* Image */}
      <img
        src={imgSrc(images[index])}
        alt={`Ảnh ${index + 1}`}
        className="max-h-[85vh] max-w-[85vw] object-contain rounded-xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />

      {/* Next */}
      {images.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          className="absolute right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
        >
          <ChevronRight size={22} />
        </button>
      )}

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
          {images.map((url, i) => (
            <button
              key={i}
              onClick={(e) => { e.stopPropagation(); /* handled by parent */ }}
              className={`w-12 h-12 rounded-lg overflow-hidden border-2 transition-all ${i === index ? 'border-white scale-110' : 'border-white/30 opacity-60 hover:opacity-100'
                }`}
            >
              <img src={imgSrc(url)} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status, statusMap }) {
  const cfg = (statusMap || {})[status] || { label: status, cls: 'bg-canvas text-ink-2 border-line', icon: Clock };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${cfg.cls}`}>
      <Icon size={10} />{cfg.label}
    </span>
  );
}

function SummaryCard({ icon: Icon, label, value, accent }) {
  const colors = {
    gold: { bg: 'bg-amber-50 dark:bg-amber-500/10', icon: 'text-amber-600 dark:text-amber-300', val: 'text-amber-700 dark:text-amber-300' },
    green: { bg: 'bg-emerald-50 dark:bg-emerald-500/10', icon: 'text-emerald-600 dark:text-emerald-300', val: 'text-emerald-700 dark:text-emerald-300' },
    blue: { bg: 'bg-sky-50 dark:bg-sky-500/10', icon: 'text-sky-600 dark:text-sky-300', val: 'text-sky-700 dark:text-sky-300' },
  };
  const c = colors[accent] || colors.gold;
  return (
    <div className={`${c.bg} rounded-2xl p-4 flex items-center gap-3 border border-white/60`}>
      <div className={`p-2.5 bg-surface/70 rounded-xl ${c.icon}`}><Icon size={20} /></div>
      <div>
        <p className="text-xs text-muted font-medium">{label}</p>
        <p className={`text-xl font-bold ${c.val}`}>{value}</p>
      </div>
    </div>
  );
}

function VoucherRow({ v, onOpenLightbox, statusMap, onChanged, selected, onToggleSelect }) {
  const { t } = useLang();
  const { role } = useAuth();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const total = v.totalAmount ?? v.items?.reduce((s, i) => s + Number(i.amount), 0) ?? 0;
  const isBank = v.paymentType === 'BANK_TRANSFER';
  const isVendorDebt = v.voucherType === 'VENDOR_DEBT_PAYMENT';
  const canApprove = v.status === 'PENDING' && !isVendorDebt;
  // Chỉ tick chọn được phiếu mà vai trò hiện tại thực sự duyệt được
  const selectable = canApproveVoucher(v, role);
  // Owner/Admin chuyển phiếu đã duyệt / đã từ chối về lại chờ duyệt
  const canReopen = !isVendorDebt && (v.status === 'APPROVED' || v.status === 'REJECTED');
  const [reopening, setReopening] = useState(false);
  const [reopenNote, setReopenNote] = useState('');

  const doReopen = async () => {
    setBusy(true);
    try {
      await adminExpenseApi.reopen(v.id, reopenNote.trim() || null);
      toast('Đã chuyển phiếu về trạng thái chờ duyệt', 'success');
      setReopening(false); setReopenNote('');
      onChanged && onChanged();
    } catch (err) { toast(err?.response?.data?.message || 'Không thể mở lại phiếu', 'error'); }
    finally { setBusy(false); }
  };

  const doApprove = async (e) => {
    e.stopPropagation(); setBusy(true);
    try { await adminExpenseApi.approve(v.id, null); toast('Đã duyệt phiếu chi', 'success'); onChanged && onChanged(); }
    catch (err) { toast(err?.response?.data?.message || 'Lỗi khi duyệt', 'error'); }
    finally { setBusy(false); }
  };
  const doReject = async (e) => {
    e.stopPropagation();
    if (!rejectReason.trim()) { toast('Vui lòng nhập lý do từ chối', 'error'); return; }
    setBusy(true);
    try { await adminExpenseApi.reject(v.id, rejectReason.trim()); toast('Đã từ chối phiếu chi', 'success'); onChanged && onChanged(); }
    catch (err) { toast(err?.response?.data?.message || 'Lỗi khi từ chối', 'error'); }
    finally { setBusy(false); }
  };

  return (
    <>
      <tr className="border-b border-line-soft hover:bg-canvas cursor-pointer"
        onClick={() => setOpen(o => !o)}>
        <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={selected}
            disabled={!selectable}
            onChange={() => onToggleSelect(v)}
            title={selectable ? 'Chọn phiếu để duyệt/từ chối hàng loạt' : 'Chỉ chọn được phiếu đang chờ duyệt'}
            className="w-4 h-4 rounded border-gold/60 text-gold focus:ring-gold/40 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
          />
        </td>
        <td className="px-3 py-3 font-mono text-xs text-gold whitespace-nowrap">{v.paymentNumber || v.voucherCode}</td>
        <td className="px-3 py-3 max-w-[180px]">
          <p className="font-medium text-ink text-sm truncate">{v.reason}</p>
          {v.vendorName && <p className="text-xs text-muted truncate">{v.vendorName}</p>}
          {v.expenseDate ? (
            <p className="text-[10px] text-muted mt-0.5">
              Ngày chi: {(() => { const d = new Date(v.expenseDate); return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`; })()}
            </p>
          ) : v.expensePeriod && (
            <p className="text-[10px] text-muted mt-0.5">
              Kỳ: {(() => { const [y, m] = v.expensePeriod.split('-'); return `Tháng ${Number(m)}/${y}`; })()}
            </p>
          )}
          {v.voucherType === 'VENDOR_DEBT_PAYMENT' && (
            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 mt-1">
              <Wallet size={9} /> Trả công nợ NCC
            </span>
          )}
          <div className="flex items-center gap-1 mt-1 flex-wrap">
            <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${isBank ? 'bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300' : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'}`}>
              {isBank ? <Landmark size={9} /> : <Wallet size={9} />} {isBank ? 'Chuyển khoản' : 'Tiền mặt'}
            </span>
            {v.approvedByName && (
              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-gold/10 text-gold-strong">
                <ShieldCheck size={9} /> {v.approvedByName}
              </span>
            )}
          </div>
        </td>
        <td className="px-3 py-3 text-sm text-ink-2 whitespace-nowrap">{v.createdByName}</td>
        <td className="px-3 py-3 text-sm text-ink-2 whitespace-nowrap">{v.requestedByName || v.createdByName}</td>
        <td className="px-3 py-3 text-right font-bold text-gold whitespace-nowrap">{formatCurrency(total)}</td>
        <td className="px-3 py-3 whitespace-nowrap"><StatusBadge status={v.status} statusMap={statusMap} /></td>
        <td className="px-3 py-3 text-xs text-muted whitespace-nowrap">{formatDateTime(v.createdAt)}</td>
        <td className="px-2 py-3 text-muted">
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </td>
      </tr>

      {open && (
        <tr className="bg-canvas">
          <td colSpan={9} className="px-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Các khoản chi — Owner/Admin sửa được nhãn + số tiền
                  (phiếu chờ duyệt & đã duyệt; phiếu đã huỷ thì không) */}
              <div onClick={(e) => e.stopPropagation()}>
                <ExpenseItemsEditor voucher={v} onChanged={onChanged} compact />
              </div>

              {(v.imageUrls || []).length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted uppercase mb-2">
                    Ảnh chứng từ ({v.imageUrls.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {v.imageUrls.map((url, i) => (
                      <button
                        key={i}
                        onClick={(e) => { e.stopPropagation(); onOpenLightbox(v.imageUrls, i); }}
                        className="w-20 h-20 rounded-lg overflow-hidden border border-line hover:border-gold hover:scale-105 transition-all focus:outline-none focus:ring-2 focus:ring-gold"
                      >
                        <img src={imgSrc(url)} alt={`ảnh ${i + 1}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {isBank && (
                <div className="md:col-span-2 bg-sky-50 dark:bg-sky-500/10 border border-sky-100 dark:border-sky-500/18 rounded-lg p-3 flex flex-wrap gap-6">
                  <div><p className="text-[10px] text-muted uppercase">Ngân hàng</p><p className="text-sm font-medium text-ink">{v.bankName || '—'}</p></div>
                  <div><p className="text-[10px] text-muted uppercase">Mã tham chiếu</p><p className="text-sm font-mono text-ink">{v.bankRef || '—'}</p></div>
                  {v.vendorType && <div><p className="text-[10px] text-muted uppercase">Danh mục</p><p className="text-sm text-ink">{VENDOR_TYPE_LABELS[v.vendorType] || v.vendorType}</p></div>}
                </div>
              )}

              {v.status === 'REJECTED' && v.rejectReason && (
                <div className="md:col-span-2">
                  <p className="text-xs font-semibold text-red-500 uppercase mb-1">Lý do từ chối</p>
                  <p className="text-sm text-ink-2">{v.rejectReason}</p>
                </div>
              )}

              {/* Duyệt / Từ chối (ADMIN & OWNER duyệt được mọi phiếu PENDING) */}
              {canApprove && (
                <div className="md:col-span-2 border-t border-line pt-3" onClick={e => e.stopPropagation()}>
                  {!rejecting ? (
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setRejecting(true)} disabled={busy}
                        className="px-4 py-2 rounded-lg border border-red-200 dark:border-red-500/28 text-sm font-semibold text-red-600 dark:text-red-300 hover:bg-red-50 dark:bg-red-500/10 transition disabled:opacity-50">
                        Từ chối
                      </button>
                      <button onClick={doApprove} disabled={busy}
                        className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-bold hover:bg-green-700 transition disabled:opacity-50">
                        {busy ? 'Đang xử lý...' : 'Duyệt phiếu'}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-red-600 dark:text-red-300">Lý do từ chối *</label>
                      <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={2}
                        placeholder="Nhập lý do..." className="w-full px-3 py-2 rounded-lg border border-red-200 dark:border-red-500/28 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 dark:ring-red-500/28 bg-surface" />
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => { setRejecting(false); setRejectReason(''); }} disabled={busy}
                          className="px-4 py-2 rounded-lg border border-hairline-2 text-sm font-semibold text-muted hover:bg-surface transition disabled:opacity-50">Huỷ</button>
                        <button onClick={doReject} disabled={busy}
                          className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition disabled:opacity-50">
                          {busy ? 'Đang xử lý...' : 'Xác nhận từ chối'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Chuyển phiếu đã duyệt / đã từ chối về lại CHỜ DUYỆT (OWNER/ADMIN) */}
              {canReopen && (
                <div className="md:col-span-2 border-t border-line pt-3">
                  {!reopening ? (
                    <div className="flex justify-end">
                      <button onClick={() => setReopening(true)} disabled={busy}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-amber-300 dark:border-amber-500/35 text-sm font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:bg-amber-500/10 transition disabled:opacity-50">
                        <RotateCcw size={14} /> Chuyển về chờ duyệt
                      </button>
                    </div>
                  ) : (
                    <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/28 rounded-lg p-3 space-y-2">
                      <p className="text-xs text-amber-800 dark:text-amber-300">
                        Phiếu sẽ quay lại trạng thái <b>Chờ duyệt</b>, xoá thông tin người duyệt/lý do
                        từ chối cũ và tính lại cấp duyệt theo tổng tiền hiện tại.
                        Thao tác này được ghi vào nhật ký kèm vai trò của bạn.
                      </p>
                      <textarea value={reopenNote} onChange={e => setReopenNote(e.target.value)} rows={2}
                        placeholder="Ghi chú lý do mở lại (tuỳ chọn)..."
                        className="w-full px-3 py-2 rounded-lg border border-amber-200 dark:border-amber-500/28 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200 dark:ring-amber-500/28 bg-surface" />
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => { setReopening(false); setReopenNote(''); }} disabled={busy}
                          className="px-4 py-2 rounded-lg border border-hairline-2 text-sm font-semibold text-muted hover:bg-surface transition disabled:opacity-50">Huỷ</button>
                        <button onClick={doReopen} disabled={busy}
                          className="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-bold hover:bg-amber-700 transition disabled:opacity-50">
                          {busy ? 'Đang xử lý...' : 'Xác nhận mở lại'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Nhật ký thao tác — tải khi mở rộng dòng */}
              <div className="md:col-span-2 border-t border-line pt-3">
                <ExpenseVoucherLogList voucherId={v.id} refreshKey={v.updatedAt} />
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Panel cấu hình duyệt (OWNER/ADMIN): ngưỡng tiền + danh mục SA được duyệt ──
function ApprovalConfigPanel({ onApplied }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [threshold, setThreshold] = useState('');
  const [cats, setCats] = useState([]);
  const [updatedByName, setUpdatedByName] = useState('');

  const parseVND = (s) => Number(String(s).replace(/[^\d]/g, '')) || 0;

  const load = async () => {
    setLoading(true);
    try {
      const res = await expenseApi.getApprovalConfig();
      const d = res.data?.data || res.data || {};
      setThreshold(String(d.thresholdAmount ?? 3000000));
      setCats(d.allowedCategories || []);
      setUpdatedByName(d.updatedByName || '');
    } catch { toast('Không tải được cấu hình duyệt', 'error'); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (open) load(); }, [open]);

  const toggleCat = (k) => setCats(p => p.includes(k) ? p.filter(x => x !== k) : [...p, k]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await expenseApi.updateApprovalConfig({ thresholdAmount: parseVND(threshold), allowedCategories: cats });
      const d = res.data?.data || res.data || {};

      // Backend đã áp cấu hình mới cho các phiếu ĐANG CHỜ DUYỆT — báo lại số phiếu
      // bị đổi cấp duyệt để người dùng biết thay đổi vừa rồi tác động tới đâu.
      const toSa = d.rescopedToSuperAccountant || 0;
      const toOwner = d.rescopedToOwner || 0;
      if (toSa || toOwner) {
        const parts = [];
        if (toSa) parts.push(`${toSa} phiếu chờ duyệt chuyển sang Kế toán trưởng duyệt được`);
        if (toOwner) parts.push(`${toOwner} phiếu chuyển về cần Chủ/Quản trị duyệt`);
        toast(`Đã lưu cấu hình duyệt · ${parts.join(', ')}`, 'success');
      } else {
        toast('Đã lưu cấu hình duyệt', 'success');
      }

      load();
      onApplied && onApplied();   // reload danh sách phiếu để nhãn cấp duyệt cập nhật ngay
    } catch (e) { toast(e?.response?.data?.message || 'Lỗi khi lưu', 'error'); }
    finally { setSaving(false); }
  };

  return (
    <div className="bg-surface rounded-2xl border border-line overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-canvas transition">
        <span className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Settings2 size={16} className="text-gold" /> Cấu hình duyệt của Kế toán trưởng
        </span>
        {open ? <ChevronUp size={16} className="text-muted" /> : <ChevronDown size={16} className="text-muted" />}
      </button>
      {open && (
        <div className="p-4 border-t border-line space-y-4">
          {loading ? (
            <p className="text-sm text-muted">Đang tải...</p>
          ) : (
            <>
              <p className="text-xs text-muted">
                Kế toán trưởng (SUPER_ACCOUNTANT) được tự duyệt / duyệt phiếu khi <b>tổng tiền &lt; ngưỡng</b> VÀ
                <b> danh mục</b> nằm trong danh sách cho phép. Ngược lại phiếu sẽ chuyển Chủ/Quản trị duyệt.
              </p>
              <div>
                <label className="block text-xs font-semibold text-ink mb-1">Ngưỡng số tiền (đ)</label>
                <input
                  value={threshold ? new Intl.NumberFormat('vi-VN').format(parseVND(threshold)) : ''}
                  onChange={e => setThreshold(String(parseVND(e.target.value)))}
                  className="w-full sm:w-64 px-3 py-2 rounded-xl border border-line text-sm text-right focus:outline-none focus:border-gold" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink mb-1.5">Danh mục cho phép</label>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(VENDOR_TYPE_LABELS).map(([k, label]) => {
                    const on = cats.includes(k);
                    return (
                      <button key={k} type="button" onClick={() => toggleCat(k)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${on ? 'bg-gold text-white border-gold' : 'bg-surface text-muted border-line hover:border-gold'}`}>
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted">{updatedByName ? `Cập nhật gần nhất bởi ${updatedByName}` : ''}</span>
                <button onClick={save} disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gold text-white text-sm font-bold hover:bg-gold-strong transition disabled:opacity-50">
                  <Save size={15} /> {saving ? 'Đang lưu...' : 'Lưu cấu hình'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function ExpenseVoucherPage() {
  const { t } = useLang();
  // Mở từ nút trên trang Dòng tiền → có state.from để quay lại.
  const { from: subFrom } = useSubPageNav();
  const toast = useToast();
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useMinLoading();
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [dateRange, setDateRange] = useState({ from: null, to: null });
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const STATUS_MAP = {
    PENDING: { label: t('status', 'pending'), cls: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/28', icon: Clock },
    APPROVED: { label: t('status', 'approved'), cls: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/28', icon: CheckCircle },
    REJECTED: { label: t('status', 'rejected_short'), cls: 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-300 border-red-200 dark:border-red-500/28', icon: XCircle },
  };

  const { role } = useAuth();

  // ── LỰA CHỌN NHIỀU PHIẾU (giữ xuyên suốt các trang) ────────────────────────
  // Lưu Map(id → voucher) chứ không chỉ id: nhờ vậy modal vẫn hiển thị được thông tin
  // phiếu đã tick ở TRANG KHÁC, dù trang hiện tại không còn phiếu đó trong `vouchers`.
  const [selectedMap, setSelectedMap] = useState(new Map());
  const [bulkModalOpen, setBulkModalOpen] = useState(false);

  const selectedList = Array.from(selectedMap.values());

  const toggleSelect = (v) => setSelectedMap(prev => {
    const next = new Map(prev);
    if (next.has(v.id)) next.delete(v.id); else next.set(v.id, v);
    return next;
  });
  const removeSelected = (id) => setSelectedMap(prev => {
    const next = new Map(prev); next.delete(id); return next;
  });
  const clearSelected = () => setSelectedMap(new Map());
  /** Bỏ chọn các phiếu đã xử lý THÀNH CÔNG, giữ lại phiếu lỗi để người dùng xem/thử lại. */
  const removeManySelected = (ids) => setSelectedMap(prev => {
    const next = new Map(prev); ids.forEach(id => next.delete(id)); return next;
  });

  // Lightbox state
  const [lightboxImages, setLightboxImages] = useState([]);
  const [lightboxIndex, setLightboxIndex] = useState(null);

  const openLightbox = (images, i) => { setLightboxImages(images); setLightboxIndex(i); };
  const closeLightbox = () => setLightboxIndex(null);
  const prevImage = () => setLightboxIndex(i => (i - 1 + lightboxImages.length) % lightboxImages.length);
  const nextImage = () => setLightboxIndex(i => (i + 1) % lightboxImages.length);

  const load = useCallback(async (p = 0) => {
    setLoading(true);
    try {
      const params = { page: p, size: 20, sort: 'createdAt,desc' };
      if (statusFilter) params.status = statusFilter;
      const res = await adminExpenseApi.listAll(params);
      let items = res.content || [];

      if (dateRange.from) {
        const f = new Date(dateRange.from).setHours(0, 0, 0, 0);
        items = items.filter(v => v.createdAt >= f);
      }
      if (dateRange.to) {
        const t = new Date(dateRange.to).setHours(23, 59, 59, 999);
        items = items.filter(v => v.createdAt <= t);
      }

      const kw = search.trim().toLowerCase();
      if (kw) {
        items = items.filter(v =>
          (v.paymentNumber && String(v.paymentNumber).toLowerCase().includes(kw)) ||
          (v.voucherCode && v.voucherCode.toLowerCase().includes(kw)) ||
          (v.reason && v.reason.toLowerCase().includes(kw)) ||
          (v.vendorName && v.vendorName.toLowerCase().includes(kw))
        );
      }

      setVouchers(items);
      setTotalPages(res.totalPages || 0);
      setPage(p);
    } catch { toast('Không thể tải phiếu chi', 'error'); }
    finally { setLoading(false); }
  }, [dateRange, statusFilter, search]);

  useEffect(() => { load(0); }, [load]);

  const totalAmount = vouchers.reduce((s, v) => s + Number(v.totalAmount || 0), 0);

  // "Chọn tất cả" chỉ áp dụng cho phiếu CHỜ DUYỆT của TRANG HIỆN TẠI —
  // tick thêm vào lựa chọn sẵn có, không xoá phiếu đã chọn ở trang khác.
  const selectableOnPage = vouchers.filter(v => canApproveVoucher(v, role));
  const allPageSelected = selectableOnPage.length > 0
    && selectableOnPage.every(v => selectedMap.has(v.id));
  const togglePageAll = () => setSelectedMap(prev => {
    const next = new Map(prev);
    if (allPageSelected) selectableOnPage.forEach(v => next.delete(v.id));
    else selectableOnPage.forEach(v => next.set(v.id, v));
    return next;
  });
  const selectedTotal = selectedList.reduce((s, v) => s + Number(v.totalAmount || 0), 0);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5">
      {/* Trang dùng chung nhiều role — chỉ hiện nút Quay lại khi vào từ Dòng tiền. */}
      {subFrom && <BackButton fallback={subFrom} />}

      <PageHeader icon={Receipt} title="Phiếu chi phí"
        subtitle="Duyệt phiếu chi & cấu hình hạn mức, danh mục cho Kế toán trưởng" />

      <ApprovalConfigPanel onApplied={() => load(page)} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <SummaryCard icon={DollarSign} label="Tổng số tiền phiếu chi" value={formatCurrency(totalAmount)} accent="gold" />
        <SummaryCard icon={FileText} label="Tổng số phiếu chi" value={vouchers.length + ' phiếu'} accent="blue" />
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            placeholder="Tìm số phiếu chi, lý do, nhà cung cấp..."
            className="w-full pl-9 pr-8 py-2 rounded-xl border border-line text-xs bg-surface focus:outline-none focus:border-gold"
          />
          {search && (
            <button onClick={() => { setSearch(''); setPage(0); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink">
              <X size={13} />
            </button>
          )}
        </div>
        <DateRangePicker
          from={dateRange.from} to={dateRange.to}
          onChange={r => { setDateRange(r); setPage(0); }}
          placeholder="Lọc theo ngày" />
        <select value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(0); }}
          className="border border-line rounded-xl px-3 py-2 text-xs bg-surface focus:outline-none focus:border-gold">
          <option value="">Tất cả trạng thái</option>
          <option value="PENDING">Chờ duyệt</option>
          <option value="APPROVED">Đã duyệt</option>
          <option value="REJECTED">Từ chối</option>
        </select>
        {/* FIX #3: Import / Export Phiếu chi */}
        <div className="flex items-center gap-2 ml-auto">
          <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-line text-xs text-ink-2 hover:border-gold cursor-pointer transition-all">
            <Upload size={13} /> Import
            <input type="file" accept=".xlsx,.csv" className="hidden" onChange={e => {
              if (e.target.files[0]) alert('Chức năng Import sẽ được xử lý ở backend');
            }} />
          </label>
          <button onClick={() => alert('Chức năng Export sẽ được xử lý ở backend')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-line text-xs text-ink-2 hover:border-gold transition-all">
            <Download size={13} /> Export
          </button>
        </div>
      </div>

      {loading ? (
        <TableSkeleton cols={5} rows={8} />
      ) : vouchers.length === 0
        ? <EmptyState icon={Receipt} title="Không có phiếu chi nào" />
        : (
          <div className="bg-surface rounded-2xl border border-line overflow-x-auto">
            <table className="w-full text-sm min-w-[880px]">
              <thead>
                <tr className="bg-canvas border-b border-line">
                  <th className="px-3 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={allPageSelected}
                      disabled={selectableOnPage.length === 0}
                      onChange={togglePageAll}
                      title="Chọn tất cả phiếu chờ duyệt của trang này"
                      className="w-4 h-4 rounded border-gold/60 text-gold focus:ring-gold/40 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                    />
                  </th>
                  {['Số phiếu', 'Lý do / Đơn vị', 'Người lập', 'Người yêu cầu', t('order', 'total_amount'), t('common', 'status'), 'Ngày tạo', ''].map(h => (
                    <th key={h} className="text-left px-3 py-3 text-xs font-semibold text-muted uppercase whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vouchers.map(v => (
                  <VoucherRow key={v.id} v={v}
                    onOpenLightbox={openLightbox}
                    statusMap={STATUS_MAP}
                    selected={selectedMap.has(v.id)}
                    onToggleSelect={toggleSelect}
                    onChanged={() => load(page)} />
                ))}
              </tbody>
            </table>
          </div>
        )
      }

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 flex-wrap">
          {Array.from({ length: totalPages }, (_, i) => (
            <button key={i} onClick={() => load(i)}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${i === page
                ? 'bg-gold text-white'
                : 'bg-surface-2 text-ink-2 hover:bg-surface-3'}`}>
              {i + 1}
            </button>
          ))}
        </div>
      )}

      {/* ── Thanh hành động hàng loạt — hiện khi đã chọn ít nhất 1 phiếu ─────── */}
      {selectedList.length > 0 && (
        <div className="sticky bottom-4 z-40 mx-auto max-w-3xl">
          <div className="bg-forest-deep text-white rounded-2xl shadow-2xl px-4 py-3 flex flex-wrap items-center gap-3">
            <ListChecks size={18} className="text-gold flex-shrink-0" />
            <div className="flex-1 min-w-[140px]">
              <p className="text-sm font-bold">Đã chọn {selectedList.length} phiếu</p>
              <p className="text-xs text-white/60">Tổng {formatCurrency(selectedTotal)}</p>
            </div>
            <button onClick={() => setBulkModalOpen(true)}
              className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold transition">
              Xem danh sách
            </button>
            <button onClick={clearSelected}
              className="px-3 py-2 rounded-xl border border-white/20 hover:bg-white/10 text-xs font-semibold transition">
              Bỏ chọn hết
            </button>
            <button onClick={() => setBulkModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-gold hover:bg-gold-strong text-xs font-bold transition">
              Duyệt / Từ chối
            </button>
          </div>
        </div>
      )}

      {bulkModalOpen && (
        <ExpenseBulkActionModal
          vouchers={selectedList}
          onRemove={removeSelected}
          onClose={() => setBulkModalOpen(false)}
          onDone={(res) => {
            const okIds = (res?.results || []).filter(r => r.success).map(r => r.id);
            if (okIds.length) removeManySelected(okIds); else clearSelected();
            load(page);
          }}
        />
      )}

      {/* Lightbox */}
      <Lightbox
        images={lightboxImages}
        index={lightboxIndex}
        onClose={closeLightbox}
        onPrev={prevImage}
        onNext={nextImage}
      />
    </div>
  );
}