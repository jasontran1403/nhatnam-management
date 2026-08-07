import { useCallback, useEffect, useState } from 'react';
import { Archive, Package, Users, Merge, AlertTriangle, Info } from 'lucide-react';
import { ownerSupplyApi, fmtQty } from '../../api/supplyApi';
import { StockTable, HistoryTable } from '../shared/SupplyWarehousePage';
import { useToast } from '../../components/common/Toast';
import Modal from '../../components/ui/Modal';
import { BackButton } from '../../components/common/SubPageNav';
import {
  PageHeader, SectionCard, SecondaryButton, DangerButton, Field,
  selectCls, LoadingSpinner, EmptyState, TabBar,
} from '../../components/ui';

/**
 * PAGE Owner — "Kho văn phòng phẩm".
 *
 * <p>Owner thấy CẢ 2 KHO nhưng <b>read-only</b>: xem tồn hiện tại + 2 tab lịch
 * sử Nhập/Rút có lọc theo khoảng ngày. Không có nút rút hàng — rút là việc của
 * người được gán kho.
 *
 * <p>Ngoài ra Owner quản lý 2 thứ chỉ mình Owner được đụng:
 *   • Gán kho cho nhân viên ({@code user_supply_warehouse}).
 *   • Gộp (merge) danh mục vật dụng bị nhập lệch.
 */

/* ══════════════════════════════════════════════════════════════════════════
   Gán kho cho nhân viên
   ══════════════════════════════════════════════════════════════════════════ */
/**
 * Dòng phụ dưới tên nhân viên: "Phòng ban · Chức vụ".
 *
 * <p>Thay cho username — người quản lý nhận ra nhân viên qua bộ phận họ làm,
 * còn tên đăng nhập chỉ có ý nghĩa với người cấp tài khoản.
 */
function staffSubtitle(r) {
  const parts = [r.department, r.position].filter(x => x && String(x).trim());
  return parts.length ? parts.join(' · ') : null;
}

/**
 * @param readOnly  kế toán chỉ được XEM — bỏ hết radio, chỉ hiện kho đang gán.
 */
function AssignmentSection({ warehouses, readOnly = false }) {
  const toast = useToast();
  const [rows, setRows] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(() => {
    ownerSupplyApi.assignments().then(setRows).catch(() => setRows([]));
  }, []);

  useEffect(() => { load(); }, [load]);

  /**
   * MỖI NHÂN VIÊN CHỈ MỘT KHO.
   *
   * <p>Dùng radio thay checkbox: chọn kho mới thì kho cũ tự bỏ, nên payload luôn
   * là mảng 0 hoặc 1 phần tử. API vẫn giữ dạng mảng để không phải đổi hợp đồng
   * (và để mở lại nhiều kho sau này nếu cần) — ràng buộc "một kho" nằm ở UI.
   */
  const pick = async (row, warehouseId) => {
    // Bấm lại đúng kho đang chọn ⇒ BỎ GÁN (radio không tự bỏ được).
    const next = row.warehouseIds.includes(warehouseId) ? [] : [warehouseId];
    setBusyId(row.userId);
    try {
      await ownerSupplyApi.assign({ userId: row.userId, warehouseIds: next });
      toast(next.length
        ? `Đã gán kho cho ${row.fullName}`
        : `Đã bỏ gán kho của ${row.fullName}`, 'success');
      load();
    } catch (e) {
      toast(e?.response?.data?.message || 'Không cập nhật được', 'error');
    } finally { setBusyId(null); }
  };

  return (
    <SectionCard>
      <div className="px-4 py-3 bg-canvas flex items-center gap-2">
        <Users size={15} className="text-gold" />
        <span className="text-xs font-semibold text-muted uppercase tracking-wider">
          {readOnly ? 'Nhân viên & kho được gán' : 'Phân quyền kho cho nhân viên'}
        </span>
      </div>

      <div className="px-4 py-3 border-b border-hairline">
        <p className="flex items-start gap-1.5 text-xs text-muted">
          <Info size={13} className="mt-0.5 flex-shrink-0" />
          {readOnly
            ? <>Danh sách nhân viên và kho đang được gán. Chỉ Owner/Admin mới thay đổi được phân quyền này.</>
            : <>Mỗi nhân viên chỉ được gán <b className="mx-1">MỘT kho</b>. Kho này quyết định 2 việc:
              nhân viên tạo phiếu cho kho nào, và rút được hàng ở kho nào — hệ thống tự chọn sẵn khi lập phiếu.</>}
        </p>
      </div>

      {rows == null ? <LoadingSpinner label="Đang tải…" />
        : rows.length === 0 ? (
          <EmptyState icon={Users} title="Chưa có nhân viên phù hợp"
            description="Chỉ các tài khoản SUPER_SELLER, SUPER_WAREHOUSE, SUPER_FACTORY_WORKER được gán kho." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase text-muted bg-canvas/50">
                  <th className="px-4 py-2.5 text-left">Nhân viên</th>
                  {/* Chỉ xem: một cột tên kho, gọn hơn hẳn lưới radio.
                      Có quyền sửa: giữ lưới radio mỗi kho một cột. */}
                  {readOnly ? (
                    <th className="px-4 py-2.5 text-left whitespace-nowrap">Kho được gán</th>
                  ) : (
                    <>
                      {warehouses.map(w => (
                        <th key={w.id} className="px-4 py-2.5 text-center whitespace-nowrap">{w.name}</th>
                      ))}
                      <th className="px-4 py-2.5 text-center whitespace-nowrap">Không gán</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.userId} className="border-t border-hairline hover:bg-canvas/40">
                    <td className="px-4 py-2.5">
                      <div className="text-ink">{r.fullName}</div>
                      {staffSubtitle(r) && (
                        <div className="text-xs text-muted">{staffSubtitle(r)}</div>
                      )}
                    </td>
                    {readOnly ? (
                      <td className="px-4 py-2.5">
                        {r.warehouseIds.length === 0
                          ? <span className="text-xs text-faint italic">Chưa gán kho</span>
                          : <span className="text-xs text-ink">
                              {warehouses
                                .filter(w => r.warehouseIds.includes(w.id))
                                .map(w => w.name).join(', ')}
                            </span>}
                      </td>
                    ) : (
                      <>
                        {warehouses.map(w => (
                          <td key={w.id} className="px-4 py-2.5 text-center">
                            <input type="radio"
                              name={`wh-${r.userId}`}
                              disabled={busyId === r.userId}
                              checked={r.warehouseIds.includes(w.id)}
                              onChange={() => pick(r, w.id)}
                              className="border-hairline-3 text-gold focus:ring-gold w-4 h-4 cursor-pointer disabled:opacity-40" />
                          </td>
                        ))}
                        <td className="px-4 py-2.5 text-center">
                          <input type="radio"
                            name={`wh-${r.userId}`}
                            disabled={busyId === r.userId}
                            checked={r.warehouseIds.length === 0}
                            onChange={() => pick(r, null)}
                            className="border-hairline-3 text-muted focus:ring-muted w-4 h-4 cursor-pointer disabled:opacity-40" />
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </SectionCard>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Danh mục vật dụng + gộp (merge)
   ══════════════════════════════════════════════════════════════════════════ */
function SupplyItemSection() {
  const toast = useToast();
  const [items, setItems] = useState(null);
  const [merging, setMerging] = useState(null);   // item nguồn
  const [targetId, setTargetId] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    ownerSupplyApi.items().then(setItems).catch(() => setItems([]));
  }, []);

  useEffect(() => { load(); }, [load]);

  const doMerge = async () => {
    if (!targetId) { toast('Chọn vật dụng đích', 'error'); return; }
    setBusy(true);
    try {
      await ownerSupplyApi.merge(merging.id, Number(targetId));
      toast('Đã gộp vật dụng', 'success');
      setMerging(null); setTargetId('');
      load();
    } catch (e) {
      toast(e?.response?.data?.message || 'Không gộp được', 'error');
    } finally { setBusy(false); }
  };

  const label = (i) =>
    `${i.name}${i.specification ? ` — ${i.specification}` : ''} (${i.unit})`;

  return (
    <SectionCard>
      <div className="px-4 py-3 bg-canvas flex items-center gap-2">
        <Package size={15} className="text-gold" />
        <span className="text-xs font-semibold text-muted uppercase tracking-wider">
          Danh mục vật dụng
        </span>
      </div>

      <div className="px-4 py-3 border-b border-hairline">
        <p className="flex items-start gap-1.5 text-xs text-muted">
          <Info size={13} className="mt-0.5 flex-shrink-0" />
          Tồn kho gộp theo bộ ba <b className="mx-1">tên · quy cách · đơn vị tính</b> và
          không phụ thuộc nhà cung cấp — mua từ 10 NCC vẫn chỉ có 1 dòng tồn. Nếu
          lỡ tạo trùng do gõ lệch, dùng <b className="mx-1">Gộp</b> để dồn về một bản ghi.
        </p>
      </div>

      {items == null ? <LoadingSpinner label="Đang tải…" />
        : items.length === 0 ? (
          <EmptyState icon={Package} title="Chưa có vật dụng nào"
            description="Vật dụng được tạo tự động khi khai báo danh mục khoản chi loại Đồ dùng tiêu hao." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase text-muted bg-canvas/50">
                  <th className="px-4 py-2.5 text-left">Tên</th>
                  <th className="px-4 py-2.5 text-left">Quy cách</th>
                  <th className="px-4 py-2.5 text-left">ĐVT</th>
                  <th className="px-4 py-2.5 text-right">Tổng tồn (mọi kho)</th>
                  <th className="px-4 py-2.5 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {items.map(i => (
                  <tr key={i.id} className="border-t border-hairline">
                    <td className="px-4 py-2.5 text-ink">{i.name}</td>
                    <td className="px-4 py-2.5 text-muted">{i.specification || '—'}</td>
                    <td className="px-4 py-2.5 text-muted">{i.unit}</td>
                    <td className="px-4 py-2.5 text-right">{fmtQty(i.totalQuantity)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button onClick={() => { setMerging(i); setTargetId(''); }}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-gold">
                        <Merge size={13} /> Gộp
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      <Modal open={!!merging} onClose={() => setMerging(null)} title="Gộp vật dụng" size="md">
        {merging && (
          <div className="space-y-4">
            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/28">
              <AlertTriangle size={16} className="text-amber-600 dark:text-amber-300 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-amber-800 dark:text-amber-300">
                Toàn bộ tồn kho của <b>{label(merging)}</b> sẽ được cộng dồn sang vật
                dụng đích <b>theo từng kho</b>, lịch sử nhập/rút được chuyển theo, và
                bản ghi nguồn bị ẩn đi. Thao tác này không hoàn tác được.
              </p>
            </div>

            <Field label="Gộp vào vật dụng" required>
              <select className={selectCls} value={targetId} onChange={e => setTargetId(e.target.value)}>
                <option value="">— Chọn vật dụng đích —</option>
                {(items || []).filter(i => i.id !== merging.id).map(i => (
                  <option key={i.id} value={i.id}>{label(i)}</option>
                ))}
              </select>
            </Field>

            <div className="flex items-center justify-end gap-2">
              <SecondaryButton onClick={() => setMerging(null)}>Huỷ</SecondaryButton>
              <DangerButton onClick={doMerge} loading={busy}>
                <Merge size={14} /> Xác nhận gộp
              </DangerButton>
            </div>
          </div>
        )}
      </Modal>
    </SectionCard>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   PAGE
   ══════════════════════════════════════════════════════════════════════════ */
export default function OwnerSupplyWarehousePage() {
  // Trang dùng chung cho OWNER/ADMIN và hai role kế toán. Kế toán CHỈ XEM:
  // không phân quyền kho, không gộp danh mục vật dụng.
  const readOnly = typeof window !== 'undefined'
    && (window.location.pathname.startsWith('/accountant')
      || window.location.pathname.startsWith('/super-accountant'));

  const [warehouses, setWarehouses] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [tab, setTab] = useState('STOCK');

  useEffect(() => {
    ownerSupplyApi.warehouses()
      .then(list => {
        setWarehouses(list || []);
        if (list?.length) setActiveId(list[0].id);
      })
      .catch(() => setWarehouses([]));
  }, []);

  if (warehouses == null) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <LoadingSpinner label="Đang tải kho…" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5">
      <BackButton fallback={
        typeof window !== 'undefined' && window.location.pathname.startsWith('/super-accountant')
          ? '/super-accountant/warehouses'
          : typeof window !== 'undefined' && window.location.pathname.startsWith('/accountant')
            ? '/accountant/warehouses'
            : '/owner/warehouses'} />

      <PageHeader
        icon={Archive}
        title="Kho văn phòng phẩm"
        subtitle="Xem tồn và lịch sử nhập / rút của từng kho (chỉ xem)"
      />

      {warehouses.length === 0 ? (
        <SectionCard>
          <EmptyState icon={Archive} title="Chưa có kho nào"
            description="Hệ thống sẽ tự tạo 2 kho Phổ Quang và Quận 9 khi khởi động." />
        </SectionCard>
      ) : (
        <>
          {/* Hai TabBar gom vào một thẻ và ĐẶT NHÃN rõ ràng. Trước đây chúng xếp
              chồng trần trên nền, trông như hai hàng nút rời rạc mà không cho
              biết cái nào chọn KHO, cái nào chọn KIỂU XEM.
              Mỗi kho một bộ số liệu riêng — không có chỗ nào cộng gộp 2 kho. */}
          <div className="bg-surface rounded-2xl border border-hairline shadow-sm p-3
                          flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-[11px] font-semibold text-muted uppercase tracking-wider flex-shrink-0">
                Kho
              </span>
              <div className="min-w-0 overflow-x-auto">
                <TabBar
                  tabs={warehouses.map(w => ({ id: w.id, label: w.name }))}
                  active={activeId} onChange={setActiveId}
                />
              </div>
            </div>

            <div className="lg:ml-auto min-w-0 overflow-x-auto">
              <TabBar
                tabs={[
                  { id: 'STOCK', label: 'Tồn hiện tại', icon: Package },
                  { id: 'HISTORY', label: 'Lịch sử nhập / rút', icon: Archive },
                ]}
                active={tab} onChange={setTab}
              />
            </div>
          </div>

          {tab === 'STOCK'
            ? <StockTable warehouseId={activeId} />
            : <HistoryTable warehouseId={activeId} />}
        </>
      )}

      <AssignmentSection warehouses={warehouses} readOnly={readOnly} />
      {/* Gộp danh mục vật dụng là thao tác ghi, không mở cho kế toán. */}
      {!readOnly && <SupplyItemSection />}
    </div>
  );
}
