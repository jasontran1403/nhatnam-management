// src/pages/shared/OfficeSupplyRequestPage.jsx
// ĐĂNG KÝ VPP — nhân viên chọn vật dụng + số lượng và lưu phiếu.
//
// Sau khi refactor UX (theo spec Owner): KHÔNG còn khái niệm chọn kho.
// Toàn bộ luồng dùng đúng một kho — "Kho Trung tâm" — được BE seed sẵn và mọi
// user tạo tài khoản đều được auto-gán vào kho này (xem
// CentralSupplyWarehouseInitializer + UserAdminService.assignToCentralSupplyWarehouse).
//
// Trang này KHÔNG dành cho OWNER/ADMIN — họ có trang riêng "Danh sách yêu cầu VPP"
// để tổng hợp và đặt hàng. Route guard được đặt ở routes/index.jsx.
import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Save, Archive, RefreshCw, CheckCircle2 } from 'lucide-react';
import {
  officeSupplyApi, fmtDateOff, resolveMyWarehouseId,
} from '../../api/officeSupplyApi';
import { useToast } from '../../components/common/Toast';
import ConfirmModal from '../../components/common/ConfirmModal';
import {
  PageHeader, SectionCard, PrimaryButton, SecondaryButton,
  LoadingSpinner, EmptyState,
} from '../../components/ui';

/**
 * Ô nhập số lượng.
 *
 * <p>Ràng buộc theo đơn vị tính:
 * <ul>
 *   <li><b>Kg</b> (case-insensitive): cho phép nhập thập phân, tối đa 3 chữ
 *       số sau dấu chấm. VD 1.5, 2.125, 0.75.</li>
 *   <li><b>Các đơn vị còn lại</b> (Chai, Cây, Ram, Thùng, Hộp…): SỐ NGUYÊN,
 *       không cho gõ dấu chấm/phẩy.</li>
 * </ul>
 *
 * <p>Không dùng nút tăng/giảm mặc định của browser — dùng {@code type="text"}
 * kèm {@code inputMode="decimal"} để mobile vẫn ra bàn phím số, mà không có
 * spinner nào trên desktop.
 */
function QuantityInput({ value, onChange, unit }) {
  const isKg = (unit || '').trim().toLowerCase() === 'kg';

  const sanitize = (raw) => {
    // Cho phép rỗng để user xoá được ô
    if (raw === '') return '';
    // Bỏ mọi ký tự không phải số/dấu chấm
    let s = raw.replace(/[^0-9.]/g, '');
    if (!isKg) {
      // Không phải Kg → integer, drop toàn bộ dấu chấm
      return s.replace(/\./g, '');
    }
    // Kg: giữ đúng 1 dấu chấm, phần thập phân tối đa 3 chữ số
    const parts = s.split('.');
    const intPart = parts[0];
    if (parts.length === 1) return intPart;
    const dec = parts.slice(1).join('').slice(0, 3);
    return intPart + '.' + dec;
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      value={value}
      onChange={e => onChange(sanitize(e.target.value))}
      onFocus={e => e.target.select()}   // 👈 THÊM DÒNG NÀY
      placeholder="0"
      className="w-20 px-2 py-1.5 rounded-lg border border-hairline-2 text-sm text-right
        focus:outline-none focus:border-gold bg-surface
        [appearance:textfield]
        [&::-webkit-outer-spin-button]:appearance-none
        [&::-webkit-inner-spin-button]:appearance-none
        [&::-webkit-inner-spin-button]:m-0"
    />
  );
}

export default function OfficeSupplyRequestPage() {
  const toast = useToast();

  // Kho VPP duy nhất — resolve 1 lần, giữ ở state để chuyển tiếp vào các call sau
  const [warehouseId, setWarehouseId] = useState(null);
  const [resolving, setResolving] = useState(true);

  // Vật dụng có sẵn
  const [items, setItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);

  // Phiếu đang edit
  const [lines, setLines] = useState([]); // [{ supplyItemId, quantity, note }]
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [search, setSearch] = useState('');
  const [confirmClear, setConfirmClear] = useState(false); // modal xoá phiếu

  // 1) Resolve id "Kho Trung tâm" một lần
  useEffect(() => {
    let cancelled = false;
    resolveMyWarehouseId()
      .then(id => { if (!cancelled) setWarehouseId(id); })
      .catch(() => { })
      .finally(() => { if (!cancelled) setResolving(false); });
    return () => { cancelled = true; };
  }, []);

  // 2) Load vật dụng + phiếu hiện tại khi có warehouseId
  const loadData = useCallback(async () => {
    if (!warehouseId) return;
    setLoadingItems(true);
    try {
      const [itemList, myReqs] = await Promise.all([
        officeSupplyApi.items(warehouseId),
        officeSupplyApi.myRequests(),
      ]);
      setItems(itemList || []);

      // Chỉ có 1 kho → phiếu của user cũng chỉ có tối đa 1
      const req = (myReqs || []).find(r => r.warehouseId === warehouseId)
        ?? (myReqs || [])[0];
      if (req) {
        setLines(req.items.map(i => ({
          supplyItemId: i.supplyItemId,
          quantity: String(i.quantity),
          note: i.note || '',
        })));
        setSavedAt(req.updatedAt);
      } else {
        setLines([]);
        setSavedAt(null);
      }
    } catch (e) {
      toast(e?.response?.data?.message || 'Không tải được dữ liệu', 'error');
    } finally {
      setLoadingItems(false);
    }
  }, [warehouseId, toast]);

  useEffect(() => { loadData(); }, [loadData]);

  const addLine = (item) => {
    if (lines.find(l => l.supplyItemId === item.id)) {
      toast('Vật dụng này đã được thêm', 'warning');
      return;
    }
    setLines(prev => [...prev, { supplyItemId: item.id, quantity: '1', note: '' }]);
    setSearch('');
  };

  const removeLine = (supplyItemId) =>
    setLines(prev => prev.filter(l => l.supplyItemId !== supplyItemId));

  const patchLine = (supplyItemId, patch) =>
    setLines(prev => prev.map(l => l.supplyItemId === supplyItemId ? { ...l, ...patch } : l));

  const save = async () => {
    if (!warehouseId) { toast('Kho VPP chưa sẵn sàng', 'error'); return; }
    const validLines = lines.filter(l => Number(l.quantity) > 0);
    setSaving(true);
    try {
      await officeSupplyApi.saveRequest({
        warehouseId,
        items: validLines.map(l => ({
          supplyItemId: l.supplyItemId,
          quantity: Number(l.quantity),
          note: l.note || null,
        })),
      });
      setSavedAt(Date.now());
      toast('Đã lưu phiếu yêu cầu', 'success');
    } catch (e) {
      toast(e?.response?.data?.message || 'Không lưu được', 'error');
    } finally { setSaving(false); }
  };

  const clearAll = async () => {
    if (!warehouseId) return;
    try {
      await officeSupplyApi.deleteRequest(warehouseId);
      setLines([]); setSavedAt(null);
      toast('Đã xoá phiếu yêu cầu', 'success');
    } catch (e) {
      toast(e?.response?.data?.message || 'Không xoá được', 'error');
      throw e;
    }
  };

  const filteredItems = search
    ? items.filter(it =>
      it.name.toLowerCase().includes(search.toLowerCase()) ||
      (it.specification || '').toLowerCase().includes(search.toLowerCase()))
    : items;

  const itemMap = Object.fromEntries(items.map(it => [it.id, it]));

  if (resolving) {
    return (
      <div className="p-4 sm:p-6">
        <SectionCard><LoadingSpinner label="Đang tải..." /></SectionCard>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <PageHeader
        icon={Archive}
        title="Yêu cầu văn phòng phẩm"
        subtitle="Chọn vật dụng cần dùng — OWNER sẽ tổng hợp và đặt hàng một lần"
      />

      {loadingItems ? (
        <SectionCard><LoadingSpinner label="Đang tải..." /></SectionCard>
      ) : (
        <>
          {/* Danh sách vật dụng có sẵn */}
          <SectionCard>
            <div className="px-5 py-4 border-b border-hairline">
              <p className="text-sm font-bold text-ink mb-3">Chọn vật dụng cần yêu cầu</p>
              <input
                type="text" placeholder="Tìm vật dụng..."
                value={search} onChange={e => setSearch(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-hairline-2 text-sm
                  focus:outline-none focus:border-gold"
              />
            </div>
            <div
              className="divide-y divide-hairline overflow-y-auto"
              style={{ minHeight: '20dvh', maxHeight: '20dvh' }}>
              {filteredItems.length === 0 ? (
                <p className="text-sm text-muted text-center py-8">Không tìm thấy vật dụng</p>
              ) : filteredItems.map(it => {
                const already = lines.some(l => l.supplyItemId === it.id);
                return (
                  <div key={it.id}
                    className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-canvas">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink">{it.name}</p>
                      <p className="text-xs text-muted">
                        {it.specification && `${it.specification} · `}{it.unit}
                        {it.orderCount > 0 && (
                          <span className="ml-2 text-muted">
                            · Đã mua {it.orderCount} lần
                            {it.lastOrderedAt && `, gần nhất ${fmtDateOff(it.lastOrderedAt)}`}
                          </span>
                        )}
                      </p>
                    </div>
                    <button
                      onClick={() => addLine(it)}
                      disabled={already}
                      className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                        text-xs font-semibold transition-colors
                        ${already
                          ? 'text-emerald-600 bg-emerald-50 border border-emerald-200 cursor-default'
                          : 'text-white bg-gold hover:bg-gold-deep'}`}>
                      {already ? <><CheckCircle2 size={12} /> Đã thêm</> : <><Plus size={12} /> Thêm</>}
                    </button>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          {/* Phiếu yêu cầu */}
          <SectionCard>
            <div className="flex items-center justify-between px-5 py-4 border-b border-hairline">
              <div>
                <p className="text-sm font-bold text-ink">Phiếu yêu cầu của tôi</p>
                {savedAt && (
                  <p className="text-xs text-muted mt-0.5">
                    Đã lưu lúc {new Date(savedAt).toLocaleString('vi-VN')}
                  </p>
                )}
              </div>
              {lines.length > 0 && (
                <button onClick={() => setConfirmClear(true)}
                  className="text-xs text-red-500 hover:underline flex items-center gap-1">
                  <Trash2 size={12} /> Xoá phiếu
                </button>
              )}
            </div>

            {lines.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <p className="text-sm text-muted">Chưa có vật dụng nào. Chọn vật dụng ở trên.</p>
              </div>
            ) : (
              <>
                <div className="divide-y divide-hairline">
                  {lines.map(line => {
                    const it = itemMap[line.supplyItemId];
                    // Layout: dùng grid để cân bằng tên (co giãn), số lượng cố định,
                    // ghi chú co giãn, nút xóa cố định. Trên mobile (< sm) chồng
                    // dọc: name+qty ở dòng 1, ghi chú+delete ở dòng 2.
                    return (
                      <div key={line.supplyItemId}
                        className="px-5 py-3 grid gap-3 items-center
                          grid-cols-[minmax(0,1fr)_auto]
                          sm:grid-cols-[minmax(200px,260px)_minmax(120px,150px)_minmax(0,1fr)_auto]">
                        {/* Cột 1: Tên + spec/ĐVT */}
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-ink truncate">
                            {it?.name || `#${line.supplyItemId}`}
                          </p>
                          <p className="text-xs text-muted truncate">
                            {it?.specification && `${it.specification} · `}{it?.unit}
                          </p>
                        </div>

                        {/* Cột 2: Số lượng + đơn vị — trên mobile nằm cạnh nút xoá ở dòng 1 */}
                        <div className="flex items-center gap-2 justify-end sm:justify-start">
                          <QuantityInput
                            value={line.quantity}
                            unit={it?.unit}
                            onChange={v => patchLine(line.supplyItemId, { quantity: v })}
                          />
                          <span className="text-xs text-muted min-w-[2rem]">{it?.unit}</span>
                        </div>

                        {/* Cột 3: Ghi chú — full width dòng 2 trên mobile */}
                        <input
                          type="text"
                          value={line.note}
                          onChange={e => patchLine(line.supplyItemId, { note: e.target.value })}
                          placeholder="Ghi chú (tuỳ chọn)"
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg border
                            border-hairline-2 focus:outline-none focus:border-gold bg-surface
                            col-span-2 sm:col-span-1"
                        />

                        {/* Cột 4: Xoá — trên mobile nằm cạnh ghi chú ở dòng 2 */}
                        <button onClick={() => removeLine(line.supplyItemId)}
                          className="p-1.5 rounded-lg text-muted hover:text-red-500
                            hover:bg-red-50 transition-colors justify-self-end
                            row-start-1 col-start-2 sm:row-start-auto sm:col-start-auto">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div className="px-5 py-4 border-t border-hairline flex justify-end gap-2">
                  <SecondaryButton onClick={loadData} disabled={loadingItems}>
                    <RefreshCw size={14} /> Làm mới
                  </SecondaryButton>
                  <PrimaryButton onClick={save} disabled={saving}>
                    <Save size={14} /> {saving ? 'Đang lưu...' : 'Gửi yêu cầu'}
                  </PrimaryButton>
                </div>
              </>
            )}
          </SectionCard>

          {items.length === 0 && (
            <SectionCard>
              <EmptyState icon={Archive} title="Chưa có vật dụng nào"
                description="Chờ Owner/Admin thêm vật dụng vào danh mục để có thể yêu cầu." />
            </SectionCard>
          )}
        </>
      )}

      {/* Modal xác nhận xoá phiếu — thay window.confirm() */}
      {confirmClear && (
        <ConfirmModal
          title="Xoá toàn bộ phiếu yêu cầu?"
          message="Hành động này không thể hoàn tác. Bạn sẽ phải tạo lại phiếu từ đầu."
          confirmLabel="Xoá phiếu"
          variant="danger"
          onConfirm={clearAll}
          onClose={() => setConfirmClear(false)}
        />
      )}
    </div>
  );
}