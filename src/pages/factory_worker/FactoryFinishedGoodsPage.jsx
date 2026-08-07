// src/pages/factory_worker/FactoryFinishedGoodsPage.jsx
// Kho thành phẩm của xưởng.
//
// THAY ĐỔI (mục 1):
//  - Lọc theo XƯỞNG ở SERVER. Trước đây lọc client-side theo lot.factoryId, mà lô tạo
//    từ phiếu chuyển kho bán thành phẩm lại không được set factoryId → luôn hiển thị 0.
//  - Phiếu XUẤT KHO: lý do (bắt buộc) + ảnh chứng từ (optional) — giống kho warehouse.
//  - Phiếu CHUYỂN KHO: chọn kho đích trước (dropdown "Tên kho — Loại kho": Kho bán /
//    Trung chuyển), rồi chọn thành phẩm bằng INPUT SEARCH CÓ DROPDOWN — dropdown CHỈ
//    liệt kê thành phẩm mà kho đích ĐANG CÓ nguyên liệu trùng tên.
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Package, AlertTriangle, ChevronDown, ChevronUp, Search,
  ArrowUpFromLine, ArrowRightLeft, Calendar, X,
} from 'lucide-react';
import useMinLoading from '../../hooks/useMinLoading.js';
import { CardSkeleton } from '../../components/ui/Skeleton.jsx';
import Modal from '../../components/ui/Modal.jsx';
import DatePicker from '../../components/ui/DatePicker.jsx';
import ImageUploader from '../../components/warehouse/ImageUploader';
import { Field, inputCls, PrimaryButton, SecondaryButton } from '../../components/ui';
import { finishedGoodsApi, factoryProdApi } from '../../api/productionModuleApi';
import { useLang } from '../../context/LangContext';
import { useFmt } from '../../utils/useFmt';
import { useToast } from '../../components/common/Toast.jsx';
import { useAuth } from '../../context/AuthContext';

function daysLeft(ms) {
  if (!ms) return null;
  return Math.ceil((Number(ms) - Date.now()) / 86400000);
}

// ── Input search + dropdown (combobox) ───────────────────────────────────────
// options: [{ value, label, hint }]
function SearchSelect({ options, value, onChange, placeholder, disabled, emptyText }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const boxRef = useRef(null);

  const selected = options.find(o => o.value === value) || null;

  useEffect(() => {
    const onDocClick = e => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(o => o.label.toLowerCase().includes(q));
  }, [options, query]);

  return (
    <div className="relative" ref={boxRef}>
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          className={inputCls + ' pl-9 pr-8'}
          disabled={disabled}
          placeholder={placeholder}
          value={open ? query : (selected ? selected.label : '')}
          onFocus={() => { if (!disabled) { setOpen(true); setQuery(''); } }}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
        />
        {selected && !disabled && (
          <button type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
            onClick={() => { onChange(''); setQuery(''); setOpen(false); }}>
            <X size={14} />
          </button>
        )}
      </div>

      {open && !disabled && (
        <div className="absolute z-20 mt-1 w-full max-h-56 overflow-auto rounded-xl border border-line bg-surface shadow-lg">
          {filtered.length === 0 ? (
            <p className="px-3 py-3 text-xs text-muted">{emptyText || 'Không có kết quả'}</p>
          ) : filtered.map(o => (
            <button key={o.value} type="button"
              className={`w-full text-left px-3 py-2 text-sm hover:bg-canvas ${o.value === value ? 'bg-canvas font-semibold' : ''}`}
              onClick={() => { onChange(o.value); setOpen(false); setQuery(''); }}>
              <span className="text-ink">{o.label}</span>
              {o.hint && <span className="block text-[11px] text-muted">{o.hint}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Xuất kho — lý do (bắt buộc) + ảnh chứng từ (optional) ────────────────────
function ExportGoodsModal({ item, factoryId, onClose, onDone }) {
  const { fmtNum } = useFmt();
  const fmtQty = v => fmtNum(v, 3);
  const toast = useToast();
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('');
  const [images, setImages] = useState([]);
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
        factoryId,
        documentImages: images,
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
        <p className="text-sm text-muted">
          Tồn kho hiện có: <strong>{fmtQty(item.totalQuantity)} {item.unit}</strong>
        </p>
        <Field label="Số lượng xuất *">
          <input
            type="number" step="0.001" autoFocus className={inputCls}
            placeholder={`Số lượng (${item.unit})`}
            value={qty} onChange={e => setQty(e.target.value)}
          />
        </Field>
        <Field label="Lý do xuất kho *">
          <textarea
            className={inputCls + ' min-h-[80px]'}
            placeholder="VD: Bán cho khách lẻ, tiêu hao nội bộ, hàng hỏng..."
            value={reason} onChange={e => setReason(e.target.value)}
          />
        </Field>
        <Field label="Ảnh chứng từ (không bắt buộc)">
          <ImageUploader value={images} onChange={setImages} />
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

// ── Chuyển kho — chọn kho đích → chọn thành phẩm (chỉ cái kho đích đang có) ──
function TransferGoodsModal({ factoryId, presetProduct, onClose, onDone }) {
  const { fmtNum } = useFmt();
  const fmtQty = v => fmtNum(v, 3);
  const toast = useToast();

  const [targets, setTargets] = useState([]);
  const [targetId, setTargetId] = useState('');
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productName, setProductName] = useState(presetProduct || '');
  const [qty, setQty] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    finishedGoodsApi.listTransferTargets()
      .then(d => setTargets(d || []))
      .catch(() => setTargets([]));
  }, []);

  // Đổi kho đích → nạp lại danh sách thành phẩm chuyển được (giao theo TÊN)
  useEffect(() => {
    if (!targetId || !factoryId) { setProducts([]); return; }
    setLoadingProducts(true);
    finishedGoodsApi.listTransferable(factoryId, Number(targetId))
      .then(d => {
        const list = d || [];
        setProducts(list);
        // Thành phẩm đang chọn không tồn tại ở kho đích → bỏ chọn
        setProductName(prev => (list.some(p => p.productName === prev) ? prev : ''));
      })
      .catch(() => setProducts([]))
      .finally(() => setLoadingProducts(false));
  }, [targetId, factoryId]);

  const selected = products.find(p => p.productName === productName) || null;

  const handleSubmit = async () => {
    if (!targetId) { toast('Vui lòng chọn kho đích', 'error'); return; }
    if (!productName) { toast('Vui lòng chọn thành phẩm cần chuyển', 'error'); return; }
    const n = Number(qty);
    if (!qty || isNaN(n) || n <= 0) { toast('Vui lòng nhập số lượng chuyển hợp lệ', 'error'); return; }
    if (selected && n > Number(selected.availableQuantity)) {
      toast('Số lượng chuyển vượt tồn kho hiện có', 'error'); return;
    }
    setSaving(true);
    try {
      await finishedGoodsApi.transferGoods({
        productName,
        quantity: n,
        targetWarehouseId: Number(targetId),
        factoryId,
      });
      toast('Đã chuyển kho thành công — ngày SX và HSD được giữ nguyên theo lô', 'success', 4000);
      onDone();
    } catch (e) {
      toast(e?.response?.data?.message || 'Có lỗi xảy ra', 'error');
    } finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title="Chuyển kho thành phẩm">
      <div className="space-y-4">
        <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/28 rounded-xl px-3 py-2">
          Ngày sản xuất, hạn sử dụng và giá vốn của từng lô được chuyển nguyên vẹn sang kho đích.
          Dropdown thành phẩm chỉ hiện những mặt hàng mà kho đích <strong>đã có nguyên liệu trùng tên</strong>.
        </p>

        <Field label="Kho đích *">
          <select className={inputCls} value={targetId} onChange={e => setTargetId(e.target.value)}>
            <option value="">— Chọn kho đích —</option>
            {targets.map(w => (
              <option key={w.id} value={w.id}>{w.name} — {w.typeLabel}</option>
            ))}
          </select>
        </Field>

        <Field label="Thành phẩm *" hint={targetId ? undefined : 'Chọn kho đích trước'}>
          <SearchSelect
            disabled={!targetId || loadingProducts}
            placeholder={loadingProducts ? 'Đang tải...' : 'Tìm & chọn thành phẩm...'}
            emptyText="Kho đích chưa có nguyên liệu nào trùng tên với thành phẩm của xưởng"
            value={productName}
            onChange={setProductName}
            options={products.map(p => ({
              value: p.productName,
              label: p.productName,
              hint: `Tồn: ${fmtQty(p.availableQuantity)} ${p.unit}`,
            }))}
          />
        </Field>

        {selected && (
          <p className="text-sm text-muted">
            Tồn khả dụng: <strong>{fmtQty(selected.availableQuantity)} {selected.unit}</strong>
          </p>
        )}

        <Field label="Số lượng chuyển *">
          <input
            type="number" step="0.001" className={inputCls}
            disabled={!selected}
            placeholder={selected ? `Số lượng (${selected.unit})` : 'Chọn thành phẩm trước'}
            value={qty} onChange={e => setQty(e.target.value)}
          />
        </Field>

        <div className="flex gap-2 pt-2">
          <SecondaryButton className="flex-1" onClick={onClose}>Huỷ</SecondaryButton>
          <PrimaryButton className="flex-1" onClick={handleSubmit} disabled={saving || !selected}>
            {saving ? 'Đang xử lý...' : 'Chuyển kho'}
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

// ── Product Card ──────────────────────────────────────────────────────────────
function FinishedGoodsCard({ item, onExport, onTransfer, canManage }) {
  const { fmtNum, fmtDate } = useFmt();
  const fmtQty = v => fmtNum(v, 3);
  const [expanded, setExpanded] = useState(false);
  const nearExpiryLots = (item.lots || []).filter(l => {
    const d = daysLeft(l.expiryDate);
    return d != null && d <= 30;
  });
  const hasWarning = nearExpiryLots.length > 0;

  return (
    <div className={`rounded-2xl border shadow-sm overflow-hidden ${hasWarning ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/28' : 'bg-surface border-hairline'}`}>
      <button className="w-full text-left px-5 py-4" onClick={() => setExpanded(e => !e)}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-ink">{item.productName}</span>
              {hasWarning && (
                <span className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-500/18 px-2 py-0.5 rounded-full font-medium">
                  <AlertTriangle size={10} /> {nearExpiryLots.length} lô sắp hết hạn
                </span>
              )}
            </div>
            <p className="text-2xl font-bold text-forest mt-1">
              {fmtQty(item.totalQuantity)}
              <span className="text-xs text-muted bg-surface-2 px-2 py-0.5 rounded-full ml-2">{item.unit}</span>
            </p>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-muted">
              {item.nearestExpiryDate && (
                <span className="flex items-center gap-1">
                  <Calendar size={11} /> Cận date nhất: {fmtDate(item.nearestExpiryDate)}
                </span>
              )}
              {item.farthestExpiryDate && item.farthestExpiryDate !== item.nearestExpiryDate && (
                <span className="flex items-center gap-1">Xa nhất: {fmtDate(item.farthestExpiryDate)}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">{item.lotCount || 0} lô</span>
            {expanded ? <ChevronUp size={16} className="text-muted" /> : <ChevronDown size={16} className="text-muted" />}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-4 border-t border-hairline-2">
          {canManage && (
            <div className="flex gap-2 mt-3 mb-3">
              <button onClick={() => onExport(item)}
                className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-surface border border-hairline-2 text-ink hover:bg-canvas">
                <ArrowUpFromLine size={13} /> Xuất kho
              </button>
              <button onClick={() => onTransfer(item.productName)}
                className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-forest-deep text-white hover:bg-forest-mid">
                <ArrowRightLeft size={13} /> Chuyển kho
              </button>
            </div>
          )}

          <p className="text-xs font-medium text-muted mb-2">Chi tiết từng lô</p>
          <div className="space-y-2">
            {(item.lots || []).map((lot, i) => {
              const days = daysLeft(lot.expiryDate);
              const isNear = days != null && days <= 30;
              return (
                <div key={lot.id || i}
                  className={`flex items-center justify-between text-sm px-3 py-2 rounded-xl ${isNear ? 'bg-amber-100 dark:bg-amber-500/18' : 'bg-canvas'}`}>
                  <div>
                    <span className="text-ink font-medium">{fmtQty(lot.quantity)} {item.unit}</span>
                    {lot.batchCode && <p className="text-[10px] text-muted">Mẻ sản xuất {lot.batchCode}</p>}
                    {lot.manufactureDate && <p className="text-[10px] text-muted">Ngày sản xuất: {fmtDate(lot.manufactureDate)}</p>}
                  </div>
                  <div className="text-right">
                    {lot.expiryDate ? (
                      <div>
                        <p className={`text-xs font-medium ${isNear ? 'text-amber-700 dark:text-amber-300' : 'text-muted'}`}>
                          Hạn sử dụng: {fmtDate(lot.expiryDate)}
                        </p>
                        {days != null && days <= 30 && (
                          <p className={`text-xs ${days <= 7 ? 'text-red-600 dark:text-red-300' : 'text-amber-600 dark:text-amber-300'}`}>còn {days} ngày</p>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted">Không có HSD</span>
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
  const { role } = useAuth();
  // Chỉ FACTORY_ACCOUNTANT được xuất/chuyển kho thành phẩm; các role khác chỉ xem.
  const canManage = role === 'FACTORY_ACCOUNTANT';

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useMinLoading();
  const [search, setSearch] = useState('');
  const [expiryFilter, setExpiryFilter] = useState(null);
  const [exportItem, setExportItem] = useState(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferPreset, setTransferPreset] = useState('');
  const [factories, setFactories] = useState([]);
  const [factoryId, setFactoryId] = useState(null);

  useEffect(() => {
    factoryProdApi.listMyFactories().then(list => {
      const active = (list || []).filter(f => f.status === 'ACTIVE');
      setFactories(active);
      if (active.length >= 1) setFactoryId(active[0].id);   // mặc định chọn kho đầu tiên
    }).catch(() => {});
  }, []);

  const load = useCallback(() => {
    if (!factoryId) { setItems([]); return; }
    setLoading(true);
    // Lọc theo xưởng ở SERVER — không lọc client-side nữa
    finishedGoodsApi.listSummary(search || undefined, expiryFilter || undefined, factoryId)
      .then(d => setItems(d || []))
      .finally(() => setLoading(false));
  }, [search, expiryFilter, factoryId, setLoading]);

  useEffect(() => { load(); }, [load]);

  const openTransfer = (productName = '') => { setTransferPreset(productName); setTransferOpen(true); };

  const nearExpiryCount = useMemo(() =>
    items.reduce((acc, it) => acc + (it.lots || []).filter(l => {
      const d = daysLeft(l.expiryDate);
      return d != null && d <= 30;
    }).length, 0)
  , [items]);

  return (
    <div className="p-4 space-y-4 bg-surface-2 min-h-full">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-bold text-ink">{t('production', 'fg_title')}</h1>
        {canManage && (
          <button onClick={() => openTransfer('')}
            className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl bg-forest-deep text-white hover:bg-forest-mid">
            <ArrowRightLeft size={14} /> Lập phiếu chuyển kho
          </button>
        )}
      </div>

      {factories.length >= 1 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted font-medium">{t('production', 'mstock_factory_label')}:</span>
          <select className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-line bg-surface text-ink focus:outline-none focus:border-gold"
            value={factoryId || ''} onChange={e => setFactoryId(e.target.value ? Number(e.target.value) : null)}>
            {factories.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-surface rounded-2xl border border-hairline shadow-sm p-4">
          <p className="text-xs text-muted">{t('production', 'fg_product_types')}</p>
          <p className="text-2xl font-bold text-forest mt-1">{items.length}</p>
        </div>
        <div className={`rounded-2xl border shadow-sm p-4 ${nearExpiryCount > 0 ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/28' : 'bg-surface border-hairline'}`}>
          <p className="text-xs text-muted">{t('production', 'inv_near_expiry')}</p>
          <p className={`text-2xl font-bold mt-1 ${nearExpiryCount > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-forest'}`}>
            {nearExpiryCount}
          </p>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="bg-surface rounded-2xl border border-hairline shadow-sm p-4 space-y-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-line
              focus:outline-none focus:border-gold bg-canvas placeholder-muted"
            placeholder="Tìm tên thành phẩm..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted whitespace-nowrap">Cận date trước:</span>
          <div className="flex-1">
            <DatePicker value={expiryFilter} onChange={setExpiryFilter} placeholder="Tất cả" />
          </div>
          {expiryFilter && (
            <button onClick={() => setExpiryFilter(null)} className="text-xs text-muted hover:text-ink underline">
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
            <div className="bg-surface rounded-2xl border border-hairline shadow-sm p-10 text-center">
              <Package size={32} className="mx-auto text-muted mb-2" />
              <p className="text-muted text-sm">{t('production', 'fg_empty')}</p>
            </div>
          )
          : (
            <div className="space-y-3">
              {items.map((item, i) => (
                <FinishedGoodsCard key={item.productName || i} item={item}
                  onExport={setExportItem} onTransfer={openTransfer} canManage={canManage} />
              ))}
            </div>
          )
      }

      {exportItem && (
        <ExportGoodsModal item={exportItem} factoryId={factoryId}
          onClose={() => setExportItem(null)}
          onDone={() => { setExportItem(null); load(); }} />
      )}
      {transferOpen && (
        <TransferGoodsModal factoryId={factoryId} presetProduct={transferPreset}
          onClose={() => setTransferOpen(false)}
          onDone={() => { setTransferOpen(false); load(); }} />
      )}
    </div>
  );
}
