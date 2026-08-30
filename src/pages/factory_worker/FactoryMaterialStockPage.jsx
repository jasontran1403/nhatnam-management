// src/pages/factory_worker/FactoryMaterialStockPage.jsx
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, AlertTriangle, ChevronDown, ChevronUp, Search, ArrowUpFromLine, ArrowRightLeft, History, FileText, FlaskConical, Plus, ClipboardList } from 'lucide-react';
import useMinLoading from '../../hooks/useMinLoading.js';
import { CardSkeleton } from '../../components/ui/Skeleton.jsx';
import { factoryMaterialRequestApi } from '../../api/materialRequestApi.js';
import { useLang } from '../../context/LangContext';
import { useFmt } from '../../utils/useFmt';
import { useAuth } from '../../context/AuthContext';
import { factoryProdApi, factoryStockApi } from '../../api/productionModuleApi';
import { ExportMaterialModal, TransferMaterialModal, MixModal } from '../../components/production/FactoryStockModals.jsx';
import { fmtQty } from '../../utils/format.js';


function fmtDate(ms) {
  if (!ms) return null;
  return new Date(ms).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function daysLeft(ms) {
  if (!ms) return null;
  return Math.ceil((ms - Date.now()) / 86400000);
}
// Note: fmtQty/fmtDate now from useFmt() inside each component


// ── Stock Card ────────────────────────────────────────────────────────────────
function StockCard({ item }) {
  const { t } = useLang();
  const { fmtNum, fmtDate } = useFmt();
  const fmtQty = v => fmtNum(v,3);
  const [expanded, setExpanded] = useState(false);
  const nearExpiryLots = (item.lots || []).filter(l => l.nearExpiry);
  const hasWarning = nearExpiryLots.length > 0;

  return (
    <div className={`rounded-2xl border shadow-sm overflow-hidden ${hasWarning ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/28' : 'bg-surface border-hairline'}`}>
      <button className="w-full text-left px-5 py-4" onClick={() => setExpanded(e => !e)}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-ink">{item.materialName}</span>
              {hasWarning && (
                <span className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-500/18 px-2 py-0.5 rounded-full font-medium">
                  <AlertTriangle size={10} /> {nearExpiryLots.length} lô sắp hết hạn
                </span>
              )}
            </div>
            <p className="text-2xl font-bold text-forest mt-1">
              {fmtQty(item.totalQty)}
              <span className="text-xs text-muted bg-surface-2 px-2 py-0.5 rounded-full">{item.unit}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">{item.lots?.length || 0} lô</span>
            {expanded ? <ChevronUp size={16} className="text-muted" /> : <ChevronDown size={16} className="text-muted" />}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-4 border-t border-hairline-2">
          <p className="text-xs font-medium text-muted mt-3 mb-2">{t('production','inv_lot_details')}</p>
          <div className="space-y-2">
            {(item.lots || []).map((lot, i) => {
              const days = daysLeft(lot.expiryDate);
              return (
                <div key={lot.id || i}
                  className={`flex items-center justify-between text-sm px-3 py-2 rounded-xl ${lot.nearExpiry ? 'bg-amber-100 dark:bg-amber-500/18' : 'bg-canvas'}`}>
                  <div>
                    <span className="text-ink font-medium">{fmtQty(lot.quantity)} {item.unit}</span>
                  </div>
                  <div className="text-right">
                    {lot.expiryDate ? (
                      <div>
                        <p className={`text-xs font-medium ${lot.nearExpiry ? 'text-amber-700 dark:text-amber-300' : 'text-muted'}`}>
                          HSD: {fmtDate(lot.expiryDate)}
                        </p>
                        {days != null && days <= 30 && (
                          <p className={`text-xs ${days <= 7 ? 'text-red-600 dark:text-red-300' : 'text-amber-600 dark:text-amber-300'}`}>còn {days} ngày</p>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted">{t('production','inv_no_expiry')}</span>
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

// ── Lịch sử phiếu ─────────────────────────────────────────────────────────────
function NoteHistory({ factoryId }) {
  const { fmtNum, fmtDateTime } = useFmt();
  const [notes, setNotes] = useState([]);
  const [type, setType] = useState('ALL');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!factoryId) return;
    setLoading(true);
    factoryStockApi.listNotes(factoryId, type === 'ALL' ? undefined : type)
      .then(d => setNotes(d || [])).catch(() => setNotes([])).finally(() => setLoading(false));
  }, [factoryId, type]);

  const typeColor = t => t === 'EXPORT' ? 'text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-500/10'
    : t === 'IMPORT' ? 'text-emerald-600 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10'
    : t === 'TRANSFER_OUT' ? 'text-amber-600 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10'
    : 'text-sky-600 dark:text-sky-300 bg-sky-50 dark:bg-sky-500/10';

  const filters = [
    { v: 'ALL', l: 'Tất cả' }, { v: 'EXPORT', l: 'Xuất kho' },
    { v: 'TRANSFER_OUT', l: 'Chuyển đi' }, { v: 'TRANSFER_IN', l: 'Chuyển đến' },
    { v: 'IMPORT', l: 'Nhập kho' },
  ];

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5 flex-wrap">
        {filters.map(f => (
          <button key={f.v} onClick={() => setType(f.v)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border ${type === f.v ? 'bg-forest-deep text-white border-forest-deep' : 'bg-surface text-muted border-line'}`}>
            {f.l}
          </button>
        ))}
      </div>
      {loading ? <CardSkeleton />
        : notes.length === 0 ? (
          <div className="bg-surface rounded-2xl border border-hairline shadow-sm p-8 text-center">
            <FileText size={28} className="mx-auto text-muted mb-2" />
            <p className="text-muted text-sm">Chưa có phiếu nào</p>
          </div>
        ) : notes.map(n => (
          <div key={n.id} className="bg-surface rounded-2xl border border-hairline shadow-sm p-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-ink">{n.noteCode}</span>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${typeColor(n.type)}`}>{n.typeLabel}</span>
              </div>
              <span className="text-[11px] text-muted">{fmtDateTime(n.createdAt)}</span>
            </div>
            {n.targetName && (
              <p className="text-xs text-muted mt-1">
                Đích: <span className="font-medium text-ink">{n.targetName}</span>
                {n.targetTypeLabel && ` (${n.targetTypeLabel})`}
              </p>
            )}
            {n.reason && <p className="text-xs text-muted mt-0.5">Lý do: {n.reason}</p>}
            <div className="mt-2 space-y-1">
              {(n.lines || []).map((l, i) => (
                <div key={i} className="flex justify-between text-sm bg-canvas rounded-lg px-3 py-1.5">
                  <span className="text-ink">{l.materialName}</span>
                  <span className="font-medium text-forest">{fmtNum(l.quantity, 3)} {l.unit}</span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted mt-2">{n.createdByName}</p>
          </div>
        ))
      }
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function FactoryMaterialStockPage() {
  const { t } = useLang();
  const { role } = useAuth();
  // SUPER_FACTORY_WORKER + FACTORY_ACCOUNTANT quản lý kho NL xưởng → được xuất/chuyển/đặt hàng.
  const canManage = role === 'SUPER_FACTORY_WORKER' || role === 'FACTORY_ACCOUNTANT';
  const navigate = useNavigate();

  const [tab, setTab] = useState('stock');   // stock | history
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useMinLoading();
  const [search, setSearch] = useState('');
  const [factories, setFactories] = useState([]);
  const [factoryId, setFactoryId] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [mixOpen, setMixOpen] = useState(false);

  useEffect(() => {
    factoryProdApi.listMyFactories().then(list => {
      const active = (list || []).filter(f => f.status === 'ACTIVE');
      setFactories(active);
      if (active.length >= 1) setFactoryId(active[0].id);
    }).catch(() => {});
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    factoryMaterialRequestApi.getStock(factoryId)
      .then(d => setStocks(d || []))
      .finally(() => setLoading(false));
  }, [factoryId, setLoading]);

  useEffect(() => { load(); }, [load]);

  const filtered = stocks.filter(s =>
    !search || s.materialName.toLowerCase().includes(search.toLowerCase())
  );

  const nearExpiryCount = stocks.reduce((acc, s) =>
    acc + (s.lots || []).filter(l => l.nearExpiry).length, 0);

  // Nguồn cho modal XUẤT kho: chỉ nguyên liệu CÓ tồn
  const sourceMaterials = stocks
    .filter(s => Number(s.totalQty) > 0)
    .map(s => ({ materialName: s.materialName, unit: s.unit, availableQuantity: s.totalQty }));

  // Nguồn cho modal MIX: TẤT CẢ nguyên liệu của kho đang chọn (kể cả tồn 0)
  const allMaterials = stocks
    .map(s => ({ materialName: s.materialName, unit: s.unit, availableQuantity: s.totalQty }));

  return (
    <div className="p-4 space-y-4 bg-surface-2 min-h-full">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-xl font-bold text-ink">{t('production','inv_factory_stock_title')}</h1>
        {canManage && (
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => {
              const base = role === 'FACTORY_ACCOUNTANT' ? '/factory-accountant' : '/super-factory-worker';
              navigate(`${base}/material-requests?create=1`);
            }}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-gold text-white hover:bg-gold-strong">
              <Plus size={13} /> Tạo đơn đặt hàng
            </button>
            <button onClick={() => {
              const base = role === 'FACTORY_ACCOUNTANT' ? '/factory-accountant' : '/super-factory-worker';
              navigate(`${base}/material-requests`);
            }}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-surface border border-hairline-2 text-ink hover:bg-canvas">
              <ClipboardList size={13} /> Phiếu đặt hàng
            </button>
            <button onClick={() => setMixOpen(true)}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-surface border border-hairline-2 text-ink hover:bg-canvas">
              <FlaskConical size={13} /> Mix gia vị
            </button>
            <button onClick={() => setExportOpen(true)}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-surface border border-hairline-2 text-ink hover:bg-canvas">
              <ArrowUpFromLine size={13} /> Xuất kho
            </button>
            <button onClick={() => setTransferOpen(true)}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-forest-deep text-white hover:bg-forest-mid">
              <ArrowRightLeft size={13} /> Chuyển kho
            </button>
          </div>
        )}
      </div>

      {factories.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted font-medium">{t('production','mstock_factory_label')}:</span>
          <select className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-line bg-surface text-ink focus:outline-none focus:border-gold"
            value={factoryId || ''} onChange={e => setFactoryId(e.target.value ? Number(e.target.value) : null)}>
            {factories.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
      )}

      {/* Tabs */}
      {canManage && (
        <div className="flex gap-1.5">
          <button onClick={() => setTab('stock')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold ${tab === 'stock' ? 'bg-forest-deep text-white' : 'bg-surface text-muted border border-line'}`}>
            <Package size={13} /> Tồn kho
          </button>
          <button onClick={() => setTab('history')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold ${tab === 'history' ? 'bg-forest-deep text-white' : 'bg-surface text-muted border border-line'}`}>
            <History size={13} /> Lịch sử phiếu
          </button>
        </div>
      )}

      {tab === 'history' ? <NoteHistory factoryId={factoryId} /> : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-surface rounded-2xl border border-hairline shadow-sm p-4">
              <p className="text-xs text-muted">{t('production','inv_material_types')}</p>
              <p className="text-2xl font-bold text-forest mt-1">{stocks.length}</p>
            </div>
            <div className={`rounded-2xl border shadow-sm p-4 ${nearExpiryCount > 0 ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/28' : 'bg-surface border-hairline'}`}>
              <p className="text-xs text-muted">{t('production','inv_near_expiry')}</p>
              <p className={`text-2xl font-bold mt-1 ${nearExpiryCount > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-forest'}`}>
                {nearExpiryCount}
              </p>
            </div>
          </div>

          {/* Search */}
          <div className="bg-surface rounded-2xl border border-hairline shadow-sm p-4">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-line
                  focus:outline-none focus:border-gold bg-canvas placeholder-muted"
                placeholder={t('production','inv_search_material_ph')}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* List */}
          {loading
            ? <div className="space-y-3">{[1, 2, 3].map(i => <CardSkeleton key={i} />)}</div>
            : filtered.length === 0
              ? (
                <div className="bg-surface rounded-2xl border border-hairline shadow-sm p-10 text-center">
                  <Package size={32} className="mx-auto text-muted mb-2" />
                  <p className="text-muted text-sm">{t('production','inv_empty_stock')}</p>
                </div>
              )
              : (
                <div className="space-y-3">
                  {filtered.map((item, i) => <StockCard key={i} item={item} />)}
                </div>
              )
          }
        </>
      )}

      {exportOpen && (
        <ExportMaterialModal factoryId={factoryId} sourceMaterials={sourceMaterials}
          onClose={() => setExportOpen(false)}
          onDone={() => { setExportOpen(false); load(); }} />
      )}
      {transferOpen && (
        <TransferMaterialModal factoryId={factoryId}
          onClose={() => setTransferOpen(false)}
          onDone={() => { setTransferOpen(false); load(); }} />
      )}
      {mixOpen && (
        <MixModal factoryId={factoryId} sourceMaterials={allMaterials}
          onClose={() => setMixOpen(false)}
          onDone={() => { setMixOpen(false); load(); }} />
      )}
    </div>
  );
}