import { useCallback, useEffect, useState } from 'react';
import { Archive, Package, Users, Merge, AlertTriangle, Info } from 'lucide-react';
import { ownerSupplyApi, fmtQty } from '../../api/supplyApi';
import { StockTable, HistoryTable } from '../shared/SupplyWarehousePage';
import { useToast } from '../../components/common/Toast';
import Modal from '../../components/ui/Modal';
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
function AssignmentSection({ warehouses }) {
  const toast = useToast();
  const [rows, setRows] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(() => {
    ownerSupplyApi.assignments().then(setRows).catch(() => setRows([]));
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async (row, warehouseId) => {
    const has = row.warehouseIds.includes(warehouseId);
    const next = has
      ? row.warehouseIds.filter(id => id !== warehouseId)
      : [...row.warehouseIds, warehouseId];
    setBusyId(row.userId);
    try {
      await ownerSupplyApi.assign({ userId: row.userId, warehouseIds: next });
      toast(`Đã cập nhật kho cho ${row.fullName}`, 'success');
      load();
    } catch (e) {
      toast(e?.response?.data?.message || 'Không cập nhật được', 'error');
    } finally { setBusyId(null); }
  };

  return (
    <SectionCard>
      <div className="px-4 py-3 bg-[#FAF7F2] flex items-center gap-2">
        <Users size={15} className="text-[#C9A84C]" />
        <span className="text-xs font-semibold text-[#8E8878] uppercase tracking-wider">
          Phân quyền kho cho nhân viên
        </span>
      </div>

      <div className="px-4 py-3 border-b border-black/5">
        <p className="flex items-start gap-1.5 text-xs text-[#8E8878]">
          <Info size={13} className="mt-0.5 flex-shrink-0" />
          Kho được gán quyết định 2 việc: nhân viên chọn được kho nào khi <b className="mx-1">tạo phiếu</b>,
          và rút được hàng ở kho nào. Nhân viên chỉ có 1 kho thì hệ thống tự chọn sẵn.
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
                <tr className="text-xs uppercase text-[#8E8878] bg-[#FAF7F2]/50">
                  <th className="px-4 py-2.5 text-left">Nhân viên</th>
                  <th className="px-4 py-2.5 text-left">Vai trò</th>
                  {warehouses.map(w => (
                    <th key={w.id} className="px-4 py-2.5 text-center">{w.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.userId} className="border-t border-black/5">
                    <td className="px-4 py-2.5">
                      <div className="text-[#1C1C1E]">{r.fullName}</div>
                      <div className="text-xs text-[#8E8878]">{r.username}</div>
                    </td>
                    <td className="px-4 py-2.5 text-[#8E8878] text-xs">{r.role}</td>
                    {warehouses.map(w => (
                      <td key={w.id} className="px-4 py-2.5 text-center">
                        <input type="checkbox"
                          disabled={busyId === r.userId}
                          checked={r.warehouseIds.includes(w.id)}
                          onChange={() => toggle(r, w.id)}
                          className="rounded border-black/20 text-[#C9A84C] focus:ring-[#C9A84C] w-4 h-4 cursor-pointer" />
                      </td>
                    ))}
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
      <div className="px-4 py-3 bg-[#FAF7F2] flex items-center gap-2">
        <Package size={15} className="text-[#C9A84C]" />
        <span className="text-xs font-semibold text-[#8E8878] uppercase tracking-wider">
          Danh mục vật dụng
        </span>
      </div>

      <div className="px-4 py-3 border-b border-black/5">
        <p className="flex items-start gap-1.5 text-xs text-[#8E8878]">
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
                <tr className="text-xs uppercase text-[#8E8878] bg-[#FAF7F2]/50">
                  <th className="px-4 py-2.5 text-left">Tên</th>
                  <th className="px-4 py-2.5 text-left">Quy cách</th>
                  <th className="px-4 py-2.5 text-left">ĐVT</th>
                  <th className="px-4 py-2.5 text-right">Tổng tồn (mọi kho)</th>
                  <th className="px-4 py-2.5 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {items.map(i => (
                  <tr key={i.id} className="border-t border-black/5">
                    <td className="px-4 py-2.5 text-[#1C1C1E]">{i.name}</td>
                    <td className="px-4 py-2.5 text-[#8E8878]">{i.specification || '—'}</td>
                    <td className="px-4 py-2.5 text-[#8E8878]">{i.unit}</td>
                    <td className="px-4 py-2.5 text-right">{fmtQty(i.totalQuantity)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button onClick={() => { setMerging(i); setTargetId(''); }}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#8E8878] hover:text-[#C9A84C]">
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
            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
              <AlertTriangle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-amber-800">
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

  if (warehouses == null) return <LoadingSpinner label="Đang tải kho…" />;

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Archive}
        title="Kho văn phòng phẩm"
        subtitle="Xem tồn và lịch sử nhập / rút của từng kho (chỉ xem)"
      />

      {warehouses.length === 0 ? (
        <EmptyState icon={Archive} title="Chưa có kho nào"
          description="Hệ thống sẽ tự tạo 2 kho Phổ Quang và Quận 9 khi khởi động." />
      ) : (
        <>
          {/* Mỗi kho một bộ số liệu riêng — không có chỗ nào cộng gộp 2 kho */}
          <TabBar
            tabs={warehouses.map(w => ({ id: w.id, label: w.name }))}
            active={activeId} onChange={setActiveId}
          />

          <TabBar
            tabs={[
              { id: 'STOCK', label: 'Tồn hiện tại', icon: Package },
              { id: 'HISTORY', label: 'Lịch sử nhập / rút', icon: Archive },
            ]}
            active={tab} onChange={setTab}
          />

          {tab === 'STOCK'
            ? <StockTable warehouseId={activeId} />
            : <HistoryTable warehouseId={activeId} />}
        </>
      )}

      <AssignmentSection warehouses={warehouses} />
      <SupplyItemSection />
    </div>
  );
}
