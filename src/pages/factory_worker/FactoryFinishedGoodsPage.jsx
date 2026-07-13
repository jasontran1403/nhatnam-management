// src/pages/factory_worker/FactoryFinishedGoodsPage.jsx
// Kho thành phẩm của xưởng — Issue #1 + #2
// UI tổng hợp theo Tên thành phẩm: tồn kho, cận date gần nhất/xa nhất, search/filter
// + nút Xuất kho (cần lý do) và Chuyển kho (cần kho đích — kho bán hàng)
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Package, AlertTriangle, ChevronDown, ChevronUp, Search,
  ArrowUpFromLine, ArrowRightLeft, Calendar, History,
} from 'lucide-react';
import useMinLoading from '../../hooks/useMinLoading.js';
import { CardSkeleton } from '../../components/ui/Skeleton.jsx';
import Modal from '../../components/ui/Modal.jsx';
import DatePicker from '../../components/ui/DatePicker.jsx';
import { Field, inputCls, PrimaryButton, SecondaryButton } from '../../components/ui';
import { finishedGoodsApi, factoryProdApi } from '../../api/productionModuleApi';
import { useLang } from '../../context/LangContext';
import { useFmt } from '../../utils/useFmt';
import { useToast } from '../../components/common/Toast.jsx';
import { useAuth } from '../../context/AuthContext';

function fmtQty(v) {
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 }).format(Number(v || 0));
}

function fmtDate(ms) {
  if (!ms) return null;
  return new Date(Number(ms)).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function daysLeft(ms) {
  if (!ms) return null;
  return Math.ceil((Number(ms) - Date.now()) / 86400000);
}

// ── Export Modal — cần lý do ─────────────────────────────────────────────────
function ExportGoodsModal({ item, onClose, onDone }) {
  const { t } = useLang();
  const { fmtNum, fmtDate } = useFmt();
  const fmtQty = v => fmtNum(v,3);
  const toast = useToast();
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    const n = Number(qty);
    if (!qty || isNaN(n) || n <= 0) { toast('Vui lòng nhập số lượng xuất kho hợp lệ', 'error'); return; }
    if (n > Number(item.totalQuantity)) { toast('Số lượng xuất vượt tồn kho hiện có', 'error'); return; }
    if (!reason.trim()) { toast('Vui lòng nhập lý do xuất kho', 'error'); return; }
    setSaving(true);
    try {
      await finishedGoodsApi.exportGoods({
        productName: item.productName,
        quantity: n,
        reason: reason.trim(),
      });
      toast('Đã xuất kho thành công', 'success');
      onDone();
    } catch (e) {
      toast(e?.response?.data?.message || 'Có lỗi xảy ra', 'error');
    } finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title={`Xuất kho — ${item.productName}`}>
      <div className="space-y-4">
        <p className="text-sm text-[#8E8878]">
          Tồn kho hiện có: <strong>{fmtQty(item.totalQuantity)} {item.unit}</strong>
        </p>
        <Field label="Số lượng xuất *">
          <input
            type="number" step="0.1" autoFocus className={inputCls}
            placeholder={`Số lượng (${item.unit})`}
            value={qty} onChange={e => setQty(e.target.value)}
          />
        </Field>
        <Field label="Lý do xuất kho *">
          <textarea
            className={inputCls + ' min-h-[80px]'}
            placeholder="VD: Bán cho khách lẻ, tiêu hao nội bộ..."
            value={reason} onChange={e => setReason(e.target.value)}
          />
        </Field>
        <div className="flex gap-2 pt-2">
          <SecondaryButton className="flex-1" onClick={onClose}>Huỷ</SecondaryButton>
          <PrimaryButton className="flex-1" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Đang xử lý...' : 'Xuất kho'}
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

// ── Transfer Modal — cần kho đích (kho bán hàng) ─────────────────────────────
function TransferGoodsModal({ item, onClose, onDone }) {
  const { t } = useLang();
  const { fmtNum, fmtDate } = useFmt();
  const fmtQty = v => fmtNum(v,3);
  const toast = useToast();
  const [qty, setQty] = useState('');
  const [warehouses, setWarehouses] = useState([]);
  const [targetWarehouseId, setTargetWarehouseId] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingWh, setLoadingWh] = useState(true);

  useEffect(() => {
    finishedGoodsApi.listSaleWarehouses()
      .then(d => setWarehouses(d || []))
      .finally(() => setLoadingWh(false));
  }, []);

  const handleSubmit = async () => {
    const n = Number(qty);
    if (!qty || isNaN(n) || n <= 0) { toast('Vui lòng nhập số lượng chuyển kho hợp lệ', 'error'); return; }
    if (n > Number(item.totalQuantity)) { toast('Số lượng chuyển vượt tồn kho hiện có', 'error'); return; }
    if (!targetWarehouseId) { toast('Vui lòng chọn kho đích', 'error'); return; }
    setSaving(true);
    try {
      await finishedGoodsApi.transferGoods({
        productName: item.productName,
        quantity: n,
        targetWarehouseId: Number(targetWarehouseId),
      });
      toast('Đã chuyển kho thành công — ngày SX và HSD đã được chuyển theo lô', 'success', 4000);
      onDone();
    } catch (e) {
      toast(e?.response?.data?.message || 'Có lỗi xảy ra', 'error');
    } finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title={`Chuyển kho — ${item.productName}`}>
      <div className="space-y-4">
        <p className="text-sm text-[#8E8878]">
          Tồn kho hiện có: <strong>{fmtQty(item.totalQuantity)} {item.unit}</strong>
        </p>
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          Ngày sản xuất và hạn sử dụng của các lô sẽ được chuyển nguyên vẹn sang kho đích
          (kho đích sẽ trở thành nguyên liệu, có ngày sản xuất + HSD tương ứng).
        </p>
        <Field label="Số lượng chuyển *">
          <input
            type="number" step="0.1" autoFocus className={inputCls}
            placeholder={`Số lượng (${item.unit})`}
            value={qty} onChange={e => setQty(e.target.value)}
          />
        </Field>
        <Field label="Kho đích (kho bán hàng) *">
          {loadingWh ? (
            <p className="text-xs text-[#8E8878] py-2">Đang tải danh sách kho...</p>
          ) : warehouses.length === 0 ? (
            <p className="text-xs text-red-600 py-2">Chưa có kho bán hàng nào, vui lòng tạo trước.</p>
          ) : (
            <select className={inputCls} value={targetWarehouseId} onChange={e => setTargetWarehouseId(e.target.value)}>
              <option value="">— Chọn kho đích —</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          )}
        </Field>
        <div className="flex gap-2 pt-2">
          <SecondaryButton className="flex-1" onClick={onClose}>Huỷ</SecondaryButton>
          <PrimaryButton className="flex-1" onClick={handleSubmit} disabled={saving || warehouses.length === 0}>
            {saving ? 'Đang xử lý...' : 'Chuyển kho'}
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

// ── Product Card ──────────────────────────────────────────────────────────────
function FinishedGoodsCard({ item, onExport, onTransfer, canManage }) {
  const { t } = useLang();
  const { fmtNum, fmtDate } = useFmt();
  const fmtQty = v => fmtNum(v,3);
  const [expanded, setExpanded] = useState(false);
  const nearExpiryLots = (item.lots || []).filter(l => {
    const d = daysLeft(l.expiryDate);
    return d != null && d <= 30;
  });
  const hasWarning = nearExpiryLots.length > 0;

  return (
    <div className={`rounded-2xl border shadow-sm overflow-hidden ${hasWarning ? 'bg-amber-50 border-amber-200' : 'bg-white border-black/5'}`}>
      <button className="w-full text-left px-5 py-4" onClick={() => setExpanded(e => !e)}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-[#1C1C1E]">{item.productName}</span>
              {hasWarning && (
                <span className="flex items-center gap-1 text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full font-medium">
                  <AlertTriangle size={10} /> {nearExpiryLots.length} lô sắp hết hạn
                </span>
              )}
            </div>
            <p className="text-2xl font-bold text-[#1A2B1A] mt-1">
              {fmtQty(item.totalQuantity)}
              <span className="text-xs text-[#8E8878] bg-[#F5F0EB] px-2 py-0.5 rounded-full ml-2">{item.unit}</span>
            </p>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-[#8E8878]">
              {item.nearestExpiryDate && (
                <span className="flex items-center gap-1">
                  <Calendar size={11} /> Lô mới nhất: {fmtDate(item.nearestExpiryDate)}
                </span>
              )}
              {item.farthestExpiryDate && item.farthestExpiryDate !== item.nearestExpiryDate && (
                <span className="flex items-center gap-1">
                  Xa nhất: {fmtDate(item.farthestExpiryDate)}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#8E8878]">{item.lotCount || 0} lô</span>
            {expanded ? <ChevronUp size={16} className="text-[#8E8878]" /> : <ChevronDown size={16} className="text-[#8E8878]" />}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-4 border-t border-black/10">
          {canManage && (
            <div className="flex gap-2 mt-3 mb-3">
              <button onClick={() => onExport(item)}
                className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-white border border-black/10 text-[#1C1C1E] hover:bg-[#FAF7F2]">
                <ArrowUpFromLine size={13} /> Xuất kho
              </button>
              <button onClick={() => onTransfer(item)}
                className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-[#1A2B1A] text-white hover:bg-[#243524]">
                <ArrowRightLeft size={13} /> Chuyển kho
              </button>
            </div>
          )}

          <p className="text-xs font-medium text-[#8E8878] mb-2">Chi tiết từng lô</p>
          <div className="space-y-2">
            {(item.lots || []).map((lot, i) => {
              const days = daysLeft(lot.expiryDate);
              const isNear = days != null && days <= 30;
              return (
                <div key={lot.id || i}
                  className={`flex items-center justify-between text-sm px-3 py-2 rounded-xl ${isNear ? 'bg-amber-100' : 'bg-[#FAF7F2]'}`}>
                  <div>
                    <span className="text-[#1C1C1E] font-medium">{fmtQty(lot.quantity)} {item.unit}</span>
                    {lot.batchCode && <p className="text-[10px] text-[#8E8878]">Mẻ sản xuất {lot.batchCode}</p>}
                    {lot.manufactureDate && <p className="text-[10px] text-[#8E8878]">Ngày sản xuất: {fmtDate(lot.manufactureDate)}</p>}
                  </div>
                  <div className="text-right">
                    {lot.expiryDate ? (
                      <div>
                        <p className={`text-xs font-medium ${isNear ? 'text-amber-700' : 'text-[#8E8878]'}`}>
                          Hạn sử dụng: {fmtDate(lot.expiryDate)}
                        </p>
                        {days != null && days <= 30 && (
                          <p className={`text-xs ${days <= 7 ? 'text-red-600' : 'text-amber-600'}`}>còn {days} ngày</p>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-[#8E8878]">Không có HSD</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function FactoryFinishedGoodsPage() {
  const { t } = useLang();
  const { fmtNum, fmtDate } = useFmt();
  const fmtQty = v => fmtNum(v,3);
  const { role } = useAuth();
  // Chỉ FACTORY_ACCOUNTANT mới được xuất kho/chuyển kho thành phẩm — các role
  // khác (FACTORY_WORKER, SUPER_FACTORY_WORKER, OWNER) chỉ xem được tồn kho.
  const canManage = role === 'FACTORY_ACCOUNTANT';
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useMinLoading();
  const [search, setSearch] = useState('');
  const [expiryFilter, setExpiryFilter] = useState(null); // chỉ hiện thành phẩm có lô cận date trước ngày này
  const [exportItem, setExportItem] = useState(null);
  const [transferItem, setTransferItem] = useState(null);
  const [factories, setFactories] = useState([]);
  const [factoryId, setFactoryId] = useState(null);

  useEffect(() => {
    factoryProdApi.listMyFactories().then(list => {
      const active = (list || []).filter(f => f.status === 'ACTIVE');
      setFactories(active);
      if (active.length >= 1) setFactoryId(active[0].id);
    }).catch(() => {});
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    finishedGoodsApi.listSummary(search || undefined, expiryFilter || undefined)
      .then(d => {
        // Filter by factory client-side (lots have factoryId)
        if (factoryId && d) {
          d = d.map(item => ({
            ...item,
            lots: (item.lots || []).filter(l => l.factoryId === factoryId),
          })).map(item => ({
            ...item,
            totalQuantity: (item.lots || []).reduce((s, l) => s + Number(l.quantity || 0), 0),
            lotCount: item.lots.length,
          })).filter(item => item.lots.length > 0);
        }
        setItems(d || []);
      })
      .finally(() => setLoading(false));
  }, [search, expiryFilter, factoryId]);

  useEffect(() => { load(); }, [load]);

  const nearExpiryCount = useMemo(() =>
    items.reduce((acc, it) => acc + (it.lots || []).filter(l => {
      const d = daysLeft(l.expiryDate);
      return d != null && d <= 30;
    }).length, 0)
  , [items]);

  return (
    <div className="p-4 space-y-4 bg-[#F5F0EB] min-h-full">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#1C1C1E]">{t('production','fg_title')}</h1>
      </div>

      {factories.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#8E8878] font-medium">{t('production','mstock_factory_label')}:</span>
          <select className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-[#E8DDD0] bg-white text-[#1C1C1E] focus:outline-none focus:border-[#C9A84C]"
            value={factoryId || ''} onChange={e => setFactoryId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">{t('common','all')}</option>
            {factories.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-4">
          <p className="text-xs text-[#8E8878]">{t('production','fg_product_types')}</p>
          <p className="text-2xl font-bold text-[#1A2B1A] mt-1">{items.length}</p>
        </div>
        <div className={`rounded-2xl border shadow-sm p-4 ${nearExpiryCount > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-black/5'}`}>
          <p className="text-xs text-[#8E8878]">{t('production','inv_near_expiry')}</p>
          <p className={`text-2xl font-bold mt-1 ${nearExpiryCount > 0 ? 'text-amber-700' : 'text-[#1A2B1A]'}`}>
            {nearExpiryCount}
          </p>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-4 space-y-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8878]" />
          <input
            className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-[#E8DDD0]
              focus:outline-none focus:border-[#C9A84C] bg-[#FAF7F2] placeholder-[#8E8878]"
            placeholder="Tìm tên thành phẩm..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#8E8878] whitespace-nowrap">Cận date trước:</span>
          <div className="flex-1">
            <DatePicker value={expiryFilter} onChange={setExpiryFilter} placeholder="Tất cả" />
          </div>
          {expiryFilter && (
            <button onClick={() => setExpiryFilter(null)} className="text-xs text-[#8E8878] hover:text-[#1C1C1E] underline">
              Xoá lọc
            </button>
          )}
        </div>
      </div>

      {/* List */}
      {loading
        ? <div className="space-y-3">{[1, 2, 3].map(i => <CardSkeleton key={i} />)}</div>
        : items.length === 0
          ? (
            <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-10 text-center">
              <Package size={32} className="mx-auto text-[#8E8878] mb-2" />
              <p className="text-[#8E8878] text-sm">{t('production','fg_empty')}</p>
            </div>
          )
          : (
            <div className="space-y-3">
              {items.map((item, i) => (
                <FinishedGoodsCard key={item.productName || i} item={item}
                  onExport={setExportItem} onTransfer={setTransferItem} canManage={canManage} />
              ))}
            </div>
          )
      }

      {exportItem && (
        <ExportGoodsModal item={exportItem} onClose={() => setExportItem(null)}
          onDone={() => { setExportItem(null); load(); }} />
      )}
      {transferItem && (
        <TransferGoodsModal item={transferItem} onClose={() => setTransferItem(null)}
          onDone={() => { setTransferItem(null); load(); }} />
      )}
    </div>
  );
}
