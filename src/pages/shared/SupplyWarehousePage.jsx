import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Archive, Search, Plus, Trash2, PackageMinus, Package,
  ArrowDownToLine, ArrowUpFromLine, AlertTriangle,
} from 'lucide-react';
import {
  supplyWarehouseApi, fmtQty, fmtDateTime, dateInputToMs, endOfDayMs,
} from '../../api/supplyApi';
import { useToast } from '../../components/common/Toast';
import useDebounce from '../../utils/useDebounce.js';
import Modal from '../../components/ui/Modal';
import Pagination from '../../components/ui/Pagination';
import {
  PageHeader, SectionCard, PrimaryButton, SecondaryButton, Field,
  inputCls, selectCls, LoadingSpinner, EmptyState, TabBar,
} from '../../components/ui';

/**
 * PAGE "Kho văn phòng phẩm" — cho người ĐƯỢC GÁN kho.
 *
 * <p>Tồn kho / lịch sử nhập / lịch sử rút đều TÁCH RIÊNG theo kho: đổi kho ở
 * tab là toàn bộ số liệu đổi theo, không có chỗ nào cộng gộp 2 kho.
 *
 * <p>Nhập kho KHÔNG làm ở đây — chỉ phát sinh khi người tạo phiếu xác nhận nhận
 * hàng. Trang này chỉ xem tồn và rút sử dụng.
 *
 * <p>{@link StockTable} và {@link HistoryTable} được export để page Owner dùng
 * lại nguyên vẹn, tránh việc 2 màn hình hiển thị cùng dữ liệu mà lệch logic.
 */

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const HISTORY_PAGE_SIZE = 30;

/* ══════════════════════════════════════════════════════════════════════════
   Modal Rút sử dụng
   ══════════════════════════════════════════════════════════════════════════ */
function WithdrawModal({ open, warehouse, onClose, onDone }) {
  const toast = useToast();
  const [stock, setStock] = useState([]);
  const [rows, setRows] = useState([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const emptyRow = () => ({
    key: Math.random().toString(36).slice(2),
    supplyItemId: '', quantity: '', note: '',
  });

  useEffect(() => {
    if (!open || !warehouse) return;
    setRows([emptyRow()]);
    setNote('');
    // CHỈ hiện món có tồn > 0 TRONG KHO ĐANG CHỌN
    supplyWarehouseApi.stock(warehouse.id, { onlyPositive: true })
      .then(setStock).catch(() => setStock([]));
  }, [open, warehouse]);

  const byId = useMemo(() => {
    const m = {};
    stock.forEach(s => { m[s.supplyItemId] = s; });
    return m;
  }, [stock]);

  const patch = (key, p) => setRows(rs => rs.map(r => (r.key === key ? { ...r, ...p } : r)));

  const submit = async () => {
    const lines = rows.filter(r => r.supplyItemId && num(r.quantity) > 0);
    if (!lines.length) { toast('Chưa chọn vật dụng cần rút', 'error'); return; }

    // Chặn sớm ở FE để báo lỗi dễ hiểu; BE vẫn validate lại kèm khoá tồn.
    for (const r of lines) {
      const s = byId[r.supplyItemId];
      if (s && num(r.quantity) > num(s.quantity)) {
        toast(`"${s.name}" chỉ còn ${fmtQty(s.quantity)} ${s.unit}`, 'error');
        return;
      }
    }

    setBusy(true);
    try {
      await supplyWarehouseApi.withdraw({
        warehouseId: warehouse.id,
        note: note || null,
        lines: lines.map(r => ({
          supplyItemId: Number(r.supplyItemId),
          quantity: num(r.quantity),
          note: r.note || null,
        })),
      });
      toast('Đã ghi nhận rút sử dụng', 'success');
      onDone(); onClose();
    } catch (e) {
      toast(e?.response?.data?.message || 'Không rút được', 'error');
    } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Rút sử dụng — ${warehouse?.name || ''}`} size="lg">
      <div className="space-y-4">
        {stock.length === 0 ? (
          <EmptyState icon={Package} title="Kho chưa có tồn"
            description="Chỉ những vật dụng còn tồn > 0 mới rút được." />
        ) : (
          <>
            <div className="space-y-2">
              {rows.map((r, idx) => {
                const s = r.supplyItemId ? byId[r.supplyItemId] : null;
                return (
                  <div key={r.key} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end p-3 rounded-xl bg-[#FAF7F2]/60">
                    <div className="sm:col-span-5">
                      <Field label={`Vật dụng #${idx + 1}`} required>
                        <select className={selectCls} value={r.supplyItemId}
                          onChange={e => patch(r.key, { supplyItemId: e.target.value })}>
                          <option value="">— Chọn vật dụng —</option>
                          {stock.map(s2 => (
                            <option key={s2.supplyItemId} value={s2.supplyItemId}>
                              {s2.name}{s2.specification ? ` — ${s2.specification}` : ''} ({s2.unit}) · còn {fmtQty(s2.quantity)}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                    <div className="sm:col-span-3">
                      <Field label={s ? `Số lượng (${s.unit})` : 'Số lượng'} required
                        hint={s ? `Tồn: ${fmtQty(s.quantity)}` : undefined}>
                        <input type="number" min="0" step="0.001" className={inputCls}
                          value={r.quantity} onChange={e => patch(r.key, { quantity: e.target.value })} />
                      </Field>
                    </div>
                    <div className="sm:col-span-3">
                      <Field label="Lý do rút">
                        <input className={inputCls} value={r.note}
                          onChange={e => patch(r.key, { note: e.target.value })}
                          placeholder="VD: cấp cho phòng kế toán" />
                      </Field>
                    </div>
                    <div className="sm:col-span-1 pb-2.5">
                      {rows.length > 1 && (
                        <button type="button" onClick={() => setRows(rs => rs.filter(x => x.key !== r.key))}
                          className="text-[#8E8878] hover:text-red-600 p-2"><Trash2 size={14} /></button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <button type="button" onClick={() => setRows(rs => [...rs, emptyRow()])}
              className="inline-flex items-center gap-1 text-sm font-semibold text-[#C9A84C] hover:text-[#B69842]">
              <Plus size={14} /> Thêm vật dụng
            </button>

            <Field label="Ghi chú chung" hint="Áp dụng cho các dòng không có lý do riêng">
              <input className={inputCls} value={note} onChange={e => setNote(e.target.value)} />
            </Field>

            <div className="flex items-center justify-end gap-2">
              <SecondaryButton onClick={onClose}>Huỷ</SecondaryButton>
              <PrimaryButton onClick={submit} loading={busy}>
                <PackageMinus size={14} /> Xác nhận rút
              </PrimaryButton>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Bảng lịch sử — 2 tab Nhập / Rút, lọc theo khoảng ngày
   ══════════════════════════════════════════════════════════════════════════ */
export function HistoryTable({ warehouseId }) {
  const [type, setType] = useState('IN');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [rows, setRows] = useState(null);

  const load = useCallback(async () => {
    if (!warehouseId) return;
    setRows(null);
    try {
      const res = await supplyWarehouseApi.history(warehouseId, {
        type,
        from: dateInputToMs(from),
        to: endOfDayMs(to),          // bao trọn ngày kết thúc
        page, size: HISTORY_PAGE_SIZE,
      });
      setRows(res?.content || []);
      setTotalPages(res?.totalPages ?? 0);
    } catch { setRows([]); setTotalPages(0); }
  }, [warehouseId, type, from, to, page]);

  useEffect(() => { load(); }, [load]);
  // Đổi kho / loại / khoảng ngày thì phải về trang đầu
  useEffect(() => { setPage(0); }, [warehouseId, type, from, to]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <TabBar
          tabs={[
            { id: 'IN', label: 'Nhập', icon: ArrowDownToLine },
            { id: 'OUT', label: 'Rút', icon: ArrowUpFromLine },
          ]}
          active={type} onChange={setType}
        />
        <Field label="Từ ngày">
          <input type="date" className={inputCls} value={from} onChange={e => setFrom(e.target.value)} />
        </Field>
        <Field label="Đến ngày">
          <input type="date" className={inputCls} value={to} onChange={e => setTo(e.target.value)} />
        </Field>
        {(from || to) && (
          <SecondaryButton onClick={() => { setFrom(''); setTo(''); }}>Xoá lọc</SecondaryButton>
        )}
      </div>

      <SectionCard>
        {rows == null ? <LoadingSpinner label="Đang tải…" />
          : rows.length === 0 ? (
            <EmptyState icon={Package}
              title={type === 'IN' ? 'Chưa có lượt nhập nào' : 'Chưa có lượt rút nào'} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#FAF7F2] text-xs uppercase text-[#8E8878]">
                    <th className="px-4 py-2.5 text-left">Tên</th>
                    <th className="px-4 py-2.5 text-left">Đơn vị tính</th>
                    <th className="px-4 py-2.5 text-left">Quy cách</th>
                    <th className="px-4 py-2.5 text-right">Số lượng</th>
                    <th className="px-4 py-2.5 text-right">Tồn sau</th>
                    <th className="px-4 py-2.5 text-left">Thời gian</th>
                    <th className="px-4 py-2.5 text-left">Người thực hiện</th>
                    <th className="px-4 py-2.5 text-left">Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.id} className="border-t border-black/5">
                      <td className="px-4 py-2.5 text-[#1C1C1E]">{r.name}</td>
                      <td className="px-4 py-2.5 text-[#8E8878]">{r.unit || '—'}</td>
                      <td className="px-4 py-2.5 text-[#8E8878]">{r.specification || '—'}</td>
                      <td className={`px-4 py-2.5 text-right font-medium ${type === 'IN' ? 'text-emerald-700' : 'text-red-600'}`}>
                        {type === 'IN' ? '+' : '−'}{fmtQty(r.quantity)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-[#8E8878]">{fmtQty(r.balanceAfter)}</td>
                      <td className="px-4 py-2.5 text-[#8E8878]">{fmtDateTime(r.createdAt)}</td>
                      <td className="px-4 py-2.5 text-[#8E8878]">{r.performedByName || '—'}</td>
                      <td className="px-4 py-2.5 text-[#8E8878]">{r.note || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </SectionCard>

      <Pagination page={page} totalPages={totalPages} onChange={setPage} />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Bảng tồn hiện tại
   ══════════════════════════════════════════════════════════════════════════ */
export function StockTable({ warehouseId, refreshKey }) {
  const [search, setSearch] = useState('');
  const dSearch = useDebounce(search, 300);
  const [rows, setRows] = useState(null);

  useEffect(() => {
    if (!warehouseId) return;
    setRows(null);
    supplyWarehouseApi.stock(warehouseId, { search: dSearch || undefined })
      .then(setRows).catch(() => setRows([]));
  }, [warehouseId, dSearch, refreshKey]);

  return (
    <div className="space-y-3">
      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8878]" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Tìm vật dụng…" className={`${inputCls} pl-9`} />
      </div>

      <SectionCard>
        {rows == null ? <LoadingSpinner label="Đang tải tồn kho…" />
          : rows.length === 0 ? (
            <EmptyState icon={Package} title="Kho chưa có vật dụng nào"
              description="Tồn kho phát sinh khi người tạo phiếu xác nhận nhận hàng." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#FAF7F2] text-xs uppercase text-[#8E8878]">
                    <th className="px-4 py-2.5 text-left">Tên vật dụng</th>
                    <th className="px-4 py-2.5 text-left">Quy cách</th>
                    <th className="px-4 py-2.5 text-left">Đơn vị tính</th>
                    <th className="px-4 py-2.5 text-right">Tồn hiện tại</th>
                    <th className="px-4 py-2.5 text-left">Cập nhật</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.supplyItemId} className="border-t border-black/5">
                      <td className="px-4 py-2.5 text-[#1C1C1E]">{r.name}</td>
                      <td className="px-4 py-2.5 text-[#8E8878]">{r.specification || '—'}</td>
                      <td className="px-4 py-2.5 text-[#8E8878]">{r.unit}</td>
                      <td className={`px-4 py-2.5 text-right font-semibold ${num(r.quantity) > 0 ? 'text-[#1C1C1E]' : 'text-[#8E8878]'}`}>
                        {fmtQty(r.quantity)}
                      </td>
                      <td className="px-4 py-2.5 text-[#8E8878]">{fmtDateTime(r.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </SectionCard>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   PAGE
   ══════════════════════════════════════════════════════════════════════════ */
export default function SupplyWarehousePage() {
  const [warehouses, setWarehouses] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [tab, setTab] = useState('STOCK');
  const [withdrawing, setWithdrawing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    supplyWarehouseApi.myWarehouses()
      .then(list => {
        // BE đã trả về ĐÚNG các kho được thao tác (assigned luôn true), không lọc lại.
        const mine = list || [];
        setWarehouses(mine);
        if (mine.length) setActiveId(mine[0].id);   // 1 kho → tự chọn
      })
      .catch(() => setWarehouses([]));
  }, []);

  const active = warehouses?.find(w => w.id === activeId) || null;

  if (warehouses == null) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <LoadingSpinner label="Đang tải kho…" />
      </div>
    );
  }

  if (warehouses.length === 0) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 space-y-5">
        <PageHeader icon={Archive} title="Kho văn phòng phẩm" />
        <div className="flex items-start gap-2 p-4 rounded-xl bg-amber-50 border border-amber-200">
          <AlertTriangle size={18} className="text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-amber-800">
            Bạn chưa được gán kho văn phòng phẩm nào. Vui lòng liên hệ chủ doanh
            nghiệp để được phân quyền.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5">
      <PageHeader
        icon={Archive}
        title="Kho văn phòng phẩm"
        subtitle="Xem tồn và rút vật dụng ra sử dụng"
        action={
          <PrimaryButton onClick={() => setWithdrawing(true)} disabled={!active}>
            <PackageMinus size={15} /> Rút sử dụng
          </PrimaryButton>
        }
      />

      {/* Gom bộ chọn vào MỘT thẻ cho khỏi rời rạc.
          Số liệu TÁCH RIÊNG theo kho — đổi kho là đổi toàn bộ bảng bên dưới. */}
      <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-3
                      flex flex-col lg:flex-row lg:items-center gap-3">
        {warehouses.length > 1 && (
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-[11px] font-semibold text-[#8E8878] uppercase tracking-wider flex-shrink-0">
              Kho
            </span>
            <div className="min-w-0 overflow-x-auto">
              <TabBar
                tabs={warehouses.map(w => ({ id: w.id, label: w.name }))}
                active={activeId} onChange={setActiveId}
              />
            </div>
          </div>
        )}

        <div className="lg:ml-auto min-w-0 overflow-x-auto">
          <TabBar
            tabs={[
              { id: 'STOCK', label: 'Tồn hiện tại', icon: Package },
              { id: 'HISTORY', label: 'Lịch sử', icon: Archive },
            ]}
            active={tab} onChange={setTab}
          />
        </div>
      </div>

      {tab === 'STOCK'
        ? <StockTable warehouseId={activeId} refreshKey={refreshKey} />
        : <HistoryTable warehouseId={activeId} />}

      <WithdrawModal open={withdrawing} warehouse={active}
        onClose={() => setWithdrawing(false)}
        onDone={() => setRefreshKey(k => k + 1)} />
    </div>
  );
}
