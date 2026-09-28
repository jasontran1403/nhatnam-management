// src/pages/owner/OwnerOfficeSupplyItemsPage.jsx
//
// PAGE "Danh sách văn phòng phẩm" (Owner/Admin).
//
// Bảng danh mục vật dụng — Owner có thể Thêm mới / Sửa.
// Không hỗ trợ Xoá ở đây: xoá vật dụng đã đặt hàng sẽ làm hỏng lịch sử — nếu
// cần dọn dẹp thì dùng chức năng "Gộp" ở trang danh mục cũ (Owner Supply Catalog).
//
// Form nhập chỉ cần Tên + Đơn vị tính (spec optional). BE chuẩn hoá + unique
// theo bộ ba (name, spec, unit) — tạo trùng sẽ trả về bản ghi có sẵn thay vì
// nhân đôi record (xem SupplyItemService.getOrCreate).
import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, ListChecks, RefreshCw, X, Save } from 'lucide-react';
import { officeSupplyApi } from '../../api/officeSupplyApi';
import { useToast } from '../../components/common/Toast';
import { BackButton } from '../../components/common/SubPageNav';
import {
  PageHeader, SectionCard, PrimaryButton, SecondaryButton,
  LoadingSpinner, EmptyState, Field, inputCls,
} from '../../components/ui';

// ── Modal Thêm / Sửa vật dụng ────────────────────────────────────────────────
function ItemModal({ initial, onClose, onSaved }) {
  const toast = useToast();
  const editing = !!initial?.id;

  const [name, setName] = useState(initial?.name || '');
  const [unit, setUnit] = useState(initial?.unit || '');
  const [specification, setSpecification] = useState(initial?.specification || '');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim()) { toast('Nhập tên vật dụng', 'error'); return; }
    if (!unit.trim()) { toast('Nhập đơn vị tính', 'error'); return; }
    setSaving(true);
    try {
      const body = {
        name: name.trim(),
        unit: unit.trim(),
        specification: specification.trim() || null,
      };
      if (editing) await officeSupplyApi.adminUpdateItem(initial.id, body);
      else         await officeSupplyApi.adminCreateItem(body);
      toast(editing ? 'Đã cập nhật' : 'Đã thêm vật dụng', 'success');
      onSaved();
      onClose();
    } catch (e) {
      toast(e?.response?.data?.message || 'Lưu thất bại', 'error');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
         onClick={onClose}>
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-md"
           onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-hairline">
          <h3 className="font-bold text-ink">
            {editing ? 'Sửa vật dụng' : 'Thêm vật dụng'}
          </h3>
          <button onClick={onClose}
            className="w-7 h-7 rounded-full bg-canvas hover:bg-hairline flex items-center justify-center">
            <X size={14} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <Field label="Tên vật dụng" required>
            <input className={inputCls} autoFocus
              value={name} onChange={e => setName(e.target.value)}
              placeholder="VD: Nước rửa chén" />
          </Field>
          <Field label="Đơn vị tính" required>
            <input className={inputCls}
              value={unit} onChange={e => setUnit(e.target.value)}
              placeholder="VD: Chai, Cây, Ram" />
          </Field>
          <Field label="Quy cách (tuỳ chọn)"
                 hint="VD: 4L/chai, 500 tờ/ram. Để trống nếu không cần.">
            <input className={inputCls}
              value={specification} onChange={e => setSpecification(e.target.value)}
              placeholder="Để trống nếu không có" />
          </Field>
        </div>

        <div className="flex gap-2 px-5 pb-5 pt-3 border-t border-hairline">
          <SecondaryButton onClick={onClose} className="flex-1">Huỷ</SecondaryButton>
          <PrimaryButton onClick={submit} disabled={saving} className="flex-1">
            <Save size={14} /> {saving ? 'Đang lưu...' : editing ? 'Cập nhật' : 'Thêm mới'}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}

// ── Trang chính ──────────────────────────────────────────────────────────────
export default function OwnerOfficeSupplyItemsPage() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | { id?, name, unit, specification }
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await officeSupplyApi.adminItems());
    } catch (e) {
      toast(e?.response?.data?.message || 'Không tải được danh sách', 'error');
    } finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const filtered = q
    ? items.filter(it =>
        it.name.toLowerCase().includes(q.toLowerCase()) ||
        (it.specification || '').toLowerCase().includes(q.toLowerCase()) ||
        it.unit.toLowerCase().includes(q.toLowerCase()))
    : items;

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <BackButton fallback="/owner/office-supply/manage" />
      <PageHeader
        icon={ListChecks}
        title="Danh sách văn phòng phẩm"
        subtitle="Danh mục vật dụng cho nhân viên yêu cầu"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <SecondaryButton onClick={load}>
              <RefreshCw size={15} /> Làm mới
            </SecondaryButton>
            <PrimaryButton onClick={() => setModal({})}>
              <Plus size={15} /> Thêm mới
            </PrimaryButton>
          </div>
        }
      />

      <SectionCard>
        <div className="px-5 py-4 border-b border-hairline">
          <input
            type="text" placeholder="Tìm theo tên, quy cách, ĐVT..."
            value={q} onChange={e => setQ(e.target.value)}
            className="w-full max-w-md px-3 py-2 rounded-xl border border-hairline-2 text-sm
              focus:outline-none focus:border-gold"
          />
        </div>

        {loading ? (
          <LoadingSpinner label="Đang tải..." />
        ) : filtered.length === 0 ? (
          <EmptyState icon={ListChecks} title="Chưa có vật dụng nào"
            description='Bấm "Thêm mới" để tạo vật dụng đầu tiên.' />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-canvas text-xs text-muted uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-2.5 text-left w-12">#</th>
                  <th className="px-4 py-2.5 text-left">Tên vật dụng</th>
                  <th className="px-4 py-2.5 text-left">Quy cách</th>
                  <th className="px-4 py-2.5 text-left">Đơn vị tính</th>
                  <th className="px-4 py-2.5 text-right w-24">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {filtered.map((it, idx) => (
                  <tr key={it.id} className="hover:bg-canvas/50">
                    <td className="px-4 py-2.5 text-muted text-center">{idx + 1}</td>
                    <td className="px-4 py-2.5 font-medium text-ink">{it.name}</td>
                    <td className="px-4 py-2.5 text-muted">{it.specification || '—'}</td>
                    <td className="px-4 py-2.5 text-ink">{it.unit}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => setModal(it)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs
                          font-semibold text-gold bg-gold/10 hover:bg-gold/20 transition-colors">
                        <Edit2 size={12} /> Sửa
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {modal && (
        <ItemModal
          initial={modal}
          onClose={() => setModal(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}
