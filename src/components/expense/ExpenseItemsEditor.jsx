// src/components/expense/ExpenseItemsEditor.jsx
//
// Khối "Các khoản chi" có thể SỬA TRỰC TIẾP — dùng chung cho:
//   • pages/accountant/ExpenseDetailModal.jsx   (ACCOUNTANT / SUPER_ACCOUNTANT)
//   • pages/admin/ExpenseVoucherPage.jsx        (OWNER / ADMIN)
//
// QUY TẮC QUYỀN (khớp backend ExpenseVoucherServiceImpl#updateItems):
//   ┌────────────────┬──────────────────────────────┬────────────────────────────┬────────────┐
//   │                │ Phiếu CHỜ DUYỆT              │ Phiếu ĐÃ DUYỆT             │ ĐÃ TỪ CHỐI │
//   ├────────────────┼──────────────────────────────┼────────────────────────────┼────────────┤
//   │ ACCOUNTANT     │ nhãn + tiền + thêm/xoá khoản │ ✗ (chỉ sửa lý do chi)      │ ✗          │
//   │ SUPER_ACCOUNT. │ nhãn + tiền + thêm/xoá khoản │ ✗ (chỉ sửa lý do chi)      │ ✗          │
//   │ OWNER / ADMIN  │ nhãn + tiền + thêm/xoá khoản │ nhãn + tiền + thêm/xoá     │ ✗          │
//   └────────────────┴──────────────────────────────┴────────────────────────────┴────────────┘
//
// Nhãn khoản chi chỉ được CHỌN từ danh mục đang bật — không tạo nhãn mới ở màn này.
//
// Sau khi lưu, backend tính lại cấp duyệt theo tổng tiền mới: nếu xoá bớt khoản chi
// làm tổng tiền tụt về dưới ngưỡng (và danh mục nằm trong tập Owner cho phép) thì
// SUPER_ACCOUNTANT duyệt được phiếu; ngược lại phiếu chuyển về cần OWNER/ADMIN duyệt.
//
// Phiếu trả công nợ NCC (voucherType = VENDOR_DEBT_PAYMENT) KHÔNG cho sửa vì dữ liệu
// nằm ở bảng khác (vendor_expense_voucher).

import { useState, useEffect, useRef, useMemo } from 'react';
import { Pencil, Check, X, ChevronDown, Search, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../common/Toast';
import { expenseApi } from '../../api/services';
import { fmtVND } from '../../utils/format.js';

const parseVND = (s) => Number(String(s ?? '').replace(/[^0-9]/g, '')) || 0;

/**
 * Quyền sửa khoản chi, suy từ vai trò đang chọn + trạng thái phiếu.
 * @returns {{canEdit: boolean, hint: string}}
 */
export function useExpenseItemsPermission(voucher) {
  const { role } = useAuth();
  return useMemo(() => {
    const deny = (hint = '') => ({ canEdit: false, hint });
    if (!voucher) return deny();
    if (voucher.voucherType === 'VENDOR_DEBT_PAYMENT') return deny();

    const isOwnerAdmin = role === 'OWNER' || role === 'ADMIN' || role === 'SUPERADMIN';
    const isAccountant = role === 'ACCOUNTANT' || role === 'SUPER_ACCOUNTANT';

    switch (voucher.status) {
      case 'REJECTED':
        return deny('Phiếu đã bị từ chối — không sửa được');
      case 'PENDING':
        if (isOwnerAdmin || isAccountant) {
          return {
            canEdit: true,
            hint: 'Sửa xong hệ thống sẽ tính lại cấp duyệt theo tổng tiền mới.',
          };
        }
        return deny();
      case 'APPROVED':
        if (isOwnerAdmin) return { canEdit: true, hint: '' };
        if (isAccountant) return deny('Phiếu đã duyệt — bạn chỉ sửa được lý do chi');
        return deny();
      default:
        return deny();
    }
  }, [voucher, role]);
}

/** Dropdown chọn nhãn khoản chi (có ô tìm kiếm). Chỉ chọn, không tạo mới. */
function CategoryDropdown({ categories, value, placeholder, onChange }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const boxRef = useRef(null);

  useEffect(() => {
    const fn = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const selected = categories.find(c => String(c.id) === String(value));
  const label = selected?.name || placeholder || 'Chọn khoản chi';
  const filtered = q.trim()
    ? categories.filter(c => c.name.toLowerCase().includes(q.trim().toLowerCase()))
    : categories;

  return (
    <div className="relative flex-1 min-w-0" ref={boxRef}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-gold/50 bg-surface text-sm text-left hover:border-gold focus:outline-none focus:ring-2 focus:ring-gold/40"
      >
        <span className={`truncate ${selected ? 'text-ink' : 'text-muted'}`}>{label}</span>
        <ChevronDown size={14} className="text-muted flex-shrink-0" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-surface rounded-xl border border-line shadow-xl max-h-60 overflow-hidden flex flex-col">
          <div className="p-2 border-b border-line-soft flex items-center gap-2">
            <Search size={13} className="text-muted flex-shrink-0" />
            <input
              autoFocus
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Tìm khoản chi..."
              className="w-full text-sm focus:outline-none bg-transparent"
            />
          </div>
          <div className="overflow-y-auto">
            {filtered.length === 0 && (
              <p className="px-3 py-3 text-xs text-muted">Không tìm thấy khoản chi phù hợp</p>
            )}
            {filtered.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => { onChange(c.id); setOpen(false); setQ(''); }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-canvas transition ${
                  String(c.id) === String(value)
                    ? 'bg-gold/10 font-semibold text-gold-strong'
                    : 'text-ink'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * @param {object}   voucher    phiếu chi (cần v.id, v.status, v.items, v.totalAmount)
 * @param {function} onChanged  gọi sau khi lưu thành công để reload dữ liệu
 * @param {boolean}  compact    layout gọn (dùng trong bảng trang admin)
 */
export default function ExpenseItemsEditor({ voucher: v, onChanged, compact = false }) {
  const toast = useToast();
  const { canEdit, hint } = useExpenseItemsPermission(v);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState([]);
  const [catLoading, setCatLoading] = useState(false);
  const [draft, setDraft] = useState([]);

  // Nạp danh mục khoản chi khi bật chế độ sửa
  useEffect(() => {
    if (!editing || categories.length > 0) return;
    let alive = true;
    setCatLoading(true);
    expenseApi.expenseCategories()
      .then(res => { if (alive) setCategories(res.data?.data || res.data || []); })
      .catch(() => { if (alive) { setCategories([]); toast('Không tải được danh mục khoản chi', 'error'); } })
      .finally(() => { if (alive) setCatLoading(false); });
    return () => { alive = false; };
  }, [editing]);

  const startEdit = () => {
    setDraft((v.items || []).map(i => ({
      key: `old-${i.id}`,
      id: i.id,
      categoryId: i.categoryId ?? '',
      itemName: i.itemName,
      amount: String(i.amount ?? 0),
      note: i.note || '',
    })));
    setEditing(true);
  };
  const cancelEdit = () => { setEditing(false); setDraft([]); };

  const patchRow  = (key, field, val) =>
    setDraft(prev => prev.map(d => (d.key === key ? { ...d, [field]: val } : d)));
  const addRow    = () =>
    setDraft(prev => [...prev, {
      key: `new-${Date.now()}-${prev.length}`,
      id: null, categoryId: '', itemName: '', amount: '', note: '',
    }]);
  const removeRow = (key) => setDraft(prev => prev.filter(d => d.key !== key));

  const draftTotal = draft.reduce((s, d) => s + parseVND(d.amount), 0);

  const doSave = async () => {
    if (draft.length === 0) {
      toast('Phiếu chi phải còn ít nhất 1 khoản chi', 'error');
      return;
    }
    for (const d of draft) {
      if (!d.categoryId) { toast('Mỗi khoản chi phải chọn một khoản trong danh mục', 'error'); return; }
      if (parseVND(d.amount) <= 0) { toast('Số tiền của mỗi khoản chi phải lớn hơn 0', 'error'); return; }
    }

    // Gửi TOÀN BỘ danh sách sau khi sửa — backend tự suy ra sửa / thêm / xoá
    const payload = draft.map(d => ({
      id: d.id,                        // null = khoản chi mới
      categoryId: Number(d.categoryId),
      amount: parseVND(d.amount),
      note: d.note || '',
    }));

    setSaving(true);
    try {
      await expenseApi.updateItems(v.id, payload);
      toast('Đã cập nhật khoản chi', 'success');
      setEditing(false);
      setDraft([]);
      onChanged && onChanged();
    } catch (e) {
      toast(e?.response?.data?.message || 'Không thể cập nhật khoản chi', 'error');
    } finally {
      setSaving(false);
    }
  };

  const items = v.items || [];
  const total = editing
    ? draftTotal
    : (v.totalAmount ?? items.reduce((s, i) => s + Number(i.amount), 0));

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className={compact
          ? 'text-xs font-semibold text-muted uppercase'
          : 'text-sm font-semibold text-ink'}>
          Các khoản chi
        </p>

        

        {editing && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); addRow(); }}
              disabled={saving || catLoading}
              className="flex items-center gap-1 text-xs font-semibold text-gold hover:underline disabled:opacity-50"
            >
              <Plus size={12} /> Thêm khoản
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); cancelEdit(); }}
              disabled={saving}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border border-line text-muted hover:bg-surface-2 disabled:opacity-50"
            >
              <X size={12} /> Huỷ
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); doSave(); }}
              disabled={saving || catLoading}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-forest-deep text-white hover:bg-forest-mid disabled:opacity-50"
            >
              <Check size={12} /> {saving ? 'Đang lưu...' : 'Lưu'}
            </button>
          </div>
        )}
      </div>

      {editing && hint && (
        <p className="text-[11px] text-muted bg-canvas rounded-lg px-3 py-1.5 mb-2">{hint}</p>
      )}

      {editing ? (
        catLoading ? (
          <p className="text-xs text-muted bg-canvas rounded-xl p-3">Đang tải danh mục khoản chi...</p>
        ) : (
          <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
            {draft.length === 0 && (
              <p className="text-xs text-red-500 bg-red-50 dark:bg-red-500/10 rounded-xl p-3">
                Phiếu chi phải còn ít nhất 1 khoản chi — bấm "Thêm khoản" để thêm lại.
              </p>
            )}
            {draft.map(d => (
              <div key={d.key} className="bg-surface border border-line rounded-xl p-2.5 space-y-2">
                <div className="flex gap-2">
                  <CategoryDropdown
                    categories={categories}
                    value={d.categoryId}
                    placeholder={d.itemName}
                    onChange={(id) => patchRow(d.key, 'categoryId', id)}
                  />
                  <input
                    value={d.amount ? new Intl.NumberFormat('vi-VN').format(parseVND(d.amount)) : ''}
                    onChange={e => patchRow(d.key, 'amount', String(parseVND(e.target.value)))}
                    placeholder="Số tiền"
                    inputMode="numeric"
                    className="w-32 flex-shrink-0 px-3 py-2 rounded-lg border border-gold/50 text-sm text-right focus:outline-none focus:ring-2 focus:ring-gold/40 bg-surface"
                  />
                  <button
                    type="button"
                    onClick={() => removeRow(d.key)}
                    title="Xoá khoản chi khỏi phiếu"
                    className="p-2 rounded-lg hover:bg-red-50 dark:bg-red-500/10 text-red-400 hover:text-red-600 dark:text-red-300 transition flex-shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <input
                  value={d.note}
                  onChange={e => patchRow(d.key, 'note', e.target.value)}
                  placeholder="Ghi chú (tuỳ chọn)..."
                  className="w-full px-3 py-1.5 rounded-lg border border-hairline-2 text-xs focus:outline-none focus:ring-2 focus:ring-gold/40 bg-surface"
                />
              </div>
            ))}
          </div>
        )
      ) : items.length === 0 ? (
        <p className="text-xs text-muted">Không có khoản chi nào</p>
      ) : (
        <div className={compact ? 'space-y-1' : 'space-y-2'}>
          {items.map((item, i) => (
            <div
              key={item.id || i}
              className={compact
                ? 'flex justify-between text-sm'
                : 'flex items-start justify-between bg-canvas rounded-xl px-4 py-3'}
            >
              <div className="min-w-0">
                <p className={compact ? 'text-ink-2' : 'text-sm font-medium text-ink'}>
                  {item.itemName}
                </p>
                {!compact && item.note && (
                  <p className="text-xs text-muted mt-0.5">{item.note}</p>
                )}
              </div>
              <p className={compact
                ? 'font-semibold text-ink flex-shrink-0 ml-3'
                : 'text-sm font-bold text-ink flex-shrink-0 ml-3'}>
                {fmtVND(item.amount)}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-between items-center mt-3 pt-3 border-t border-hairline">
        <span className="text-sm font-semibold text-muted">Tổng cộng</span>
        <span className="text-base font-bold text-gold">{fmtVND(total)}</span>
      </div>
    </div>
  );
}