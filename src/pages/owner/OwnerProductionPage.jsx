import { useLang } from '../../context/LangContext';
import { useState, useEffect, useCallback } from 'react';
import { Sk, TableSkeleton } from '../../components/ui/Skeleton.jsx';
import useMinLoading from '../../hooks/useMinLoading.js';
import {
  Factory, Plus, Edit2, Check, X, Package, FlaskConical,
  ClipboardList, TrendingUp, TrendingDown, CalendarDays,
  Power, Eye, Clock, ShieldCheck, Wrench, Building2, Users, MapPin,
} from 'lucide-react';
import {
  factoryMaterialApi, factoryProductApi, recipeApi, batchOwnerApi,
} from '../../api/productionApi';
import { ownerProdApi } from '../../api/productionModuleApi';
import { adminUserApi } from '../../api/adminApi';
import Modal from '../../components/ui/Modal';
import {
  PageHeader, LoadingSpinner, EmptyState, PrimaryButton, SecondaryButton,
  Field, inputCls, formatDateTime,
} from '../../components/ui';
import { Badge } from '../../components/ui/Badge';
import DateRangePicker, { presetToRange } from '../../components/ui/DateRangePicker';
import { startOfDay, endOfDay } from 'date-fns';

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtDate = (ms) => ms
  ? new Date(ms).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  : '–';

function VarianceBadge({ pct }) {
  const v = parseFloat(pct || 0);
  if (Math.abs(v) < 0.1) return <Badge className="bg-slate-50 text-slate-500 ring-slate-200">±0%</Badge>;
  const up = v > 0;
  return (
    <Badge className={up ? 'bg-red-50 text-red-700 ring-red-200' : 'bg-emerald-50 text-emerald-700 ring-emerald-200'}>
      {up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
      {up ? '+' : ''}{v.toFixed(1)}%
    </Badge>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function OwnerProductionPage() {
  const { t } = useLang();
  const [batches, setBatches] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [products, setProducts] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useMinLoading();

  const TABS = [
    { id: 'factories', label: 'Xưởng', icon: Building2 },
    { id: 'batches', label: t('batch', 'production_batches'), icon: ClipboardList },
    { id: 'recipes', label: 'Biến thể sản xuất', icon: FlaskConical },
    { id: 'products', label: t('batch', 'finished_goods'), icon: Package },
    { id: 'materials', label: t('batch', 'raw_materials'), icon: Factory },
  ];

  const [tab, setTab] = useState('batches');
  // Date filter for batches
  const [preset, setPreset] = useState('month');
  const [range, setRange] = useState(() => presetToRange('month'));

  // Modals
  const [batchDetail, setBatchDetail] = useState(null);
  const [recipeDetail, setRecipeDetail] = useState(null); // xem chi tiết biến thể (read-only)
  const [showMatModal, setShowMatModal] = useState(false);
  const [editMat, setEditMat] = useState(null);
  const [showProdModal, setShowProdModal] = useState(false);
  const [editProd, setEditProd] = useState(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [b, r, pr, m] = await Promise.all([
        batchOwnerApi.list(0, 100),
        recipeApi.list(),
        factoryProductApi.list(false),
        factoryMaterialApi.list(false),
      ]);
      setBatches(b?.content || []);
      setRecipes(r || []);
      setProducts(pr || []);
      setMaterials(m || []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Filter batches by date range
  const filteredBatches = batches.filter(b => {
    if (!b.producedAt) return true;
    return b.producedAt >= range.from && b.producedAt <= range.to;
  });

  const openBatch = async (id) => {
    const d = await batchOwnerApi.get(id);
    setBatchDetail(d);
  };

  const markReviewed = async (id) => {
    await batchOwnerApi.markReviewed(id);
    loadAll();
    setBatchDetail(null);
  };

  const openRecipeDetail = async (id) => {
    const d = await recipeApi.get(id);
    setRecipeDetail(d);
  };

  const toggleRecipeActive = async (r) => {
    await recipeApi.toggle(r.id, !r.isActive);
    loadAll();
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5">
      <PageHeader
        icon={Factory}
        title={t('analytics', 'manage_production')}
        subtitle={t('misc', 'manage_production_full')}
      />

      {/* Tabs */}
      <div className="bg-white rounded-2xl border border-black/5 p-1 shadow-sm flex gap-1 w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab === t.id
              ? 'bg-[#1C1C1E] text-white shadow-sm'
              : 'text-[#8E8878] hover:text-[#1C1C1E] hover:bg-[#FAF7F2]'
              }`}>
            <t.icon size={15} />
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <TableSkeleton cols={5} rows={8} />
      ) : (
        <>
          {/* ── Batches ──────────────────────────────────────────────────── */}
          {tab === 'factories' && <FactoriesTab />}

          {tab === 'batches' && (
            <div className="space-y-4">
              {/* Date filter */}
              <div className="bg-white rounded-2xl border border-black/5 p-3 sm:p-4 shadow-sm relative">
                <DateRangePicker
                  preset={preset}
                  onPreset={setPreset}
                  onRangeChange={(r) => setRange(r)}
                />
              </div>

              {filteredBatches.length === 0
                ? <EmptyState icon={ClipboardList} title={t('batch', 'no_batches')} />
              : (
              <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
                <table className="w-full text-sm hidden md:table">
                  <thead>
                    <tr className="bg-[#FAF7F2] text-[#8E8878]">
                      <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider">Mã mẻ</th>
                      <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider">Thành phẩm</th>
                      <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider">Nhân viên</th>
                      <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider">Ngày SX</th>
                      <th className="px-4 py-3 text-right font-semibold text-xs uppercase tracking-wider">Thực tế / Chuẩn</th>
                      <th className="px-4 py-3 text-center font-semibold text-xs uppercase tracking-wider">Hao hụt</th>
                      <th className="px-4 py-3 text-center font-semibold text-xs uppercase tracking-wider">Trạng thái</th>
                      <th className="px-4 py-3 text-right font-semibold text-xs uppercase tracking-wider">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBatches.map(b => (
                      <tr key={b.id} className="border-t border-black/5 hover:bg-[#FAF7F2]/50 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-[#1C1C1E]">{b.batchCode}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-[#1C1C1E]">{b.productName}</p>
                          <p className="text-xs text-[#8E8878]">{b.recipeName}</p>
                        </td>
                        <td className="px-4 py-3 text-[#8E8878] text-xs">{b.createdByName}</td>
                        <td className="px-4 py-3 text-xs text-[#8E8878] whitespace-nowrap">{fmtDate(b.producedAt)}</td>
                        <td className="px-4 py-3 text-right text-sm">
                          <span className="font-semibold text-[#1C1C1E]">{b.actualOutputQty}</span>
                          <span className="text-[#8E8878]"> / {b.standardOutputQty} {b.outputUnit}</span>
                        </td>
                        <td className="px-4 py-3 text-center"><VarianceBadge pct={b.outputVariancePct} /></td>
                        <td className="px-4 py-3 text-center">
                          {b.status === 'REVIEWED'
                            ? <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-200">Đã xem</Badge>
                            : <Badge className="bg-amber-50 text-amber-700 ring-amber-200">Chờ xem</Badge>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => openBatch(b.id)}
                            className="px-3 py-1.5 text-xs font-medium rounded-xl bg-[#FAF7F2] text-[#1C1C1E] hover:bg-[#F0EBE3] transition-colors border border-black/5">
                            Chi tiết
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Mobile */}
                <div className="md:hidden divide-y divide-black/5">
                  {filteredBatches.map(b => (
                    <div key={b.id} className="p-4" onClick={() => openBatch(b.id)}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-mono text-xs font-semibold text-[#1C1C1E]">{b.batchCode}</p>
                          <p className="font-medium text-sm text-[#1C1C1E] mt-0.5">{b.productName}</p>
                          <p className="text-xs text-[#8E8878]">{b.createdByName} · {fmtDate(b.producedAt)}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <VarianceBadge pct={b.outputVariancePct} />
                          <p className="text-xs text-[#8E8878] mt-1">
                            {b.status === 'REVIEWED' ? '✓ Đã xem' : '⏳ Chờ xem'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
                )}
            </div>
          )}

          {/* ── Recipes (= Biến thể sản xuất, Owner chỉ XEM + bật/tắt) ─────── */}
          {tab === 'recipes' && (
            <div className="space-y-3">
              <p className="text-xs text-[#8E8878] bg-[#FAF7F2] rounded-xl px-3 py-2.5 border border-black/5">
                Biến thể sản xuất do nhân viên xưởng tạo và quản lý. Tại đây bạn có thể xem chi tiết và bật/tắt từng biến thể.
              </p>
              {recipes.length === 0
                ? <EmptyState icon={FlaskConical} title="Chưa có biến thể sản xuất nào" />
                : (
                  <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-[#FAF7F2] text-[#8E8878]">
                          <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider">Biến thể</th>
                          <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider">Thành phẩm</th>
                          <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider">Định lượng chuẩn</th>
                          <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider">Người tạo</th>
                          <th className="px-4 py-3 text-center font-semibold text-xs uppercase tracking-wider">Trạng thái</th>
                          <th className="px-4 py-3 text-right font-semibold text-xs uppercase tracking-wider">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recipes.map(r => (
                          <tr key={r.id} className="border-t border-black/5 hover:bg-[#FAF7F2]/50 transition-colors">
                            <td className="px-4 py-3 font-medium text-[#1C1C1E]">{r.name}</td>
                            <td className="px-4 py-3 text-[#8E8878]">{r.factoryProductName}</td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1">
                                {(r.items || []).map(i => (
                                  <Badge key={i.id} className="bg-slate-50 text-slate-600 ring-slate-200">
                                    {i.materialName}: {i.standardQty} {i.unit}
                                  </Badge>
                                ))}
                                <Badge className="bg-[#C9A84C]/10 text-[#A07830] ring-[#C9A84C]/30">
                                  → {r.standardOutputQty} {r.outputUnit}
                                </Badge>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-[#8E8878] text-xs">{r.createdByName || '—'}</td>
                            <td className="px-4 py-3 text-center">
                              {r.isActive
                                ? <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-200">Đang dùng</Badge>
                                : <Badge className="bg-slate-100 text-slate-500 ring-slate-200">Đã tắt</Badge>}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button onClick={() => openRecipeDetail(r.id)} title="Xem chi tiết"
                                  className="p-2 rounded-lg text-[#8E8878] hover:bg-[#FAF7F2] hover:text-[#1C1C1E] transition-colors">
                                  <Eye size={15} />
                                </button>
                                <button onClick={() => toggleRecipeActive(r)} title={r.isActive ? 'Tắt biến thể' : 'Bật biến thể'}
                                  className={`p-2 rounded-lg transition-colors ${r.isActive ? 'text-emerald-600 hover:bg-emerald-50' : 'text-[#8E8878] hover:bg-[#FAF7F2]'}`}>
                                  <Power size={15} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
            </div>
          )}

          {/* ── Products ─────────────────────────────────────────────────── */}
          {tab === 'products' && (
            <div className="space-y-3">
              <div className="flex justify-end">
                <PrimaryButton onClick={() => { setEditProd(null); setShowProdModal(true); }}>
                  <Plus size={15} /> Thêm thành phẩm
                </PrimaryButton>
              </div>
              {products.length === 0
                ? <EmptyState icon={Package} title="Chưa có thành phẩm nào" />
                : (
                  <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-[#FAF7F2] text-[#8E8878]">
                          <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider">Tên thành phẩm</th>
                          <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider">Đơn vị</th>
                          <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider">Mô tả</th>
                          <th className="px-4 py-3 text-right font-semibold text-xs uppercase tracking-wider">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {products.map(p => (
                          <tr key={p.id} className="border-t border-black/5 hover:bg-[#FAF7F2]/50 transition-colors">
                            <td className="px-4 py-3 font-medium text-[#1C1C1E]">{p.name}</td>
                            <td className="px-4 py-3"><Badge className="bg-blue-50 text-blue-700 ring-blue-200">{p.unit}</Badge></td>
                            <td className="px-4 py-3 text-[#8E8878] text-xs">{p.description || '—'}</td>
                            <td className="px-4 py-3 text-right">
                              <button onClick={() => { setEditProd(p); setShowProdModal(true); }}
                                className="p-2 rounded-lg text-[#8E8878] hover:bg-[#FAF7F2] hover:text-[#1C1C1E] transition-colors">
                                <Edit2 size={15} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
            </div>
          )}

          {/* ── Materials ────────────────────────────────────────────────── */}
          {tab === 'materials' && (
            <div className="space-y-3">
              <div className="flex justify-end">
                <PrimaryButton onClick={() => { setEditMat(null); setShowMatModal(true); }}>
                  <Plus size={15} /> Thêm NVL
                </PrimaryButton>
              </div>
              {materials.length === 0
                ? <EmptyState icon={Factory} title="Chưa có nguyên vật liệu nào" />
                : (
                  <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-[#FAF7F2] text-[#8E8878]">
                          <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider">Tên NVL</th>
                          <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider">Đơn vị</th>
                          <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider">Mô tả</th>
                          <th className="px-4 py-3 text-right font-semibold text-xs uppercase tracking-wider">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {materials.map(m => (
                          <tr key={m.id} className="border-t border-black/5 hover:bg-[#FAF7F2]/50 transition-colors">
                            <td className="px-4 py-3 font-medium text-[#1C1C1E]">{m.name}</td>
                            <td className="px-4 py-3"><Badge className="bg-amber-50 text-amber-700 ring-amber-200">{m.unit}</Badge></td>
                            <td className="px-4 py-3 text-[#8E8878] text-xs">{m.description || '—'}</td>
                            <td className="px-4 py-3 text-right">
                              <button onClick={() => { setEditMat(m); setShowMatModal(true); }}
                                className="p-2 rounded-lg text-[#8E8878] hover:bg-[#FAF7F2] hover:text-[#1C1C1E] transition-colors">
                                <Edit2 size={15} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
            </div>
          )}
        </>
      )}

      {/* ── Batch Detail Modal ──────────────────────────────────────────────── */}
      {batchDetail && (
        <Modal open={!!batchDetail} onClose={() => setBatchDetail(null)}
          title={`Chi tiết mẻ: ${batchDetail.batchCode}`} size="lg"
          footer={
            <div className="flex justify-between items-center">
              <p className="text-xs text-[#8E8878]">Tạo bởi: {batchDetail.createdByName}</p>
              <div className="flex gap-2">
                <SecondaryButton onClick={() => setBatchDetail(null)}>Đóng</SecondaryButton>
                {batchDetail.status !== 'REVIEWED' && (
                  <PrimaryButton onClick={() => markReviewed(batchDetail.id)}>
                    <Check size={15} /> Đánh dấu đã xem
                  </PrimaryButton>
                )}
              </div>
            </div>
          }>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-[#FAF7F2] rounded-xl p-3">
                <p className="text-xs text-[#8E8878] mb-0.5">Thành phẩm</p>
                <p className="font-semibold text-[#1C1C1E]">{batchDetail.productName}</p>
              </div>
              <div className="bg-[#FAF7F2] rounded-xl p-3">
                <p className="text-xs text-[#8E8878] mb-0.5">Công thức</p>
                <p className="font-semibold text-[#1C1C1E]">{batchDetail.recipeName}</p>
              </div>
              <div className="bg-[#FAF7F2] rounded-xl p-3">
                <p className="text-xs text-[#8E8878] mb-0.5">Ngày sản xuất</p>
                <p className="font-semibold text-[#1C1C1E]">{fmtDate(batchDetail.producedAt)}</p>
              </div>
              <div className="bg-[#FAF7F2] rounded-xl p-3">
                <p className="text-xs text-[#8E8878] mb-0.5">Trạng thái</p>
                {batchDetail.status === 'REVIEWED'
                  ? <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-200">Đã xem</Badge>
                  : <Badge className="bg-amber-50 text-amber-700 ring-amber-200">Chờ xem</Badge>}
              </div>
            </div>

            {/* Output */}
            <div className="border border-black/5 rounded-xl overflow-hidden">
              <div className="bg-[#FAF7F2] px-4 py-2.5 border-b border-black/5">
                <p className="text-xs font-semibold text-[#8E8878] uppercase tracking-wider">Thành phẩm đầu ra</p>
              </div>
              <div className="p-4 flex items-center justify-between">
                <div className="text-sm space-y-1">
                  <p className="text-[#8E8878]">Định lượng chuẩn: <strong className="text-[#1C1C1E]">{batchDetail.standardOutputQty} {batchDetail.outputUnit}</strong></p>
                  <p className="text-[#8E8878]">Thực tế thu được: <strong className="text-[#1C1C1E]">{batchDetail.actualOutputQty} {batchDetail.outputUnit}</strong></p>
                </div>
                <div className="text-right">
                  <VarianceBadge pct={batchDetail.outputVariancePct} />
                  <p className="text-xs text-[#8E8878] mt-1">so với chuẩn</p>
                </div>
              </div>
            </div>

            {/* NVL table */}
            <div className="border border-black/5 rounded-xl overflow-hidden">
              <div className="bg-[#FAF7F2] px-4 py-2.5 border-b border-black/5">
                <p className="text-xs font-semibold text-[#8E8878] uppercase tracking-wider">Nguyên vật liệu đã dùng</p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-black/5 text-[#8E8878]">
                    <th className="px-4 py-2 text-left text-xs font-semibold">NVL</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold">Chuẩn</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold">Thực tế</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold">Hao hụt</th>
                  </tr>
                </thead>
                <tbody>
                  {(batchDetail.items || []).map(item => (
                    <tr key={item.id} className="border-t border-black/5">
                      <td className="px-4 py-2.5 font-medium text-[#1C1C1E]">{item.materialName}</td>
                      <td className="px-4 py-2.5 text-right text-[#8E8878]">{item.standardQty} {item.unit}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-[#1C1C1E]">{item.actualQty} {item.unit}</td>
                      <td className="px-4 py-2.5 text-right"><VarianceBadge pct={item.variancePct} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {batchDetail.notes && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
                <strong>Ghi chú:</strong> {batchDetail.notes}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ── Recipe Detail Modal (read-only, Owner chỉ xem) ─────────────────────── */}
      {recipeDetail && (
        <RecipeDetailModal
          recipe={recipeDetail}
          onClose={() => setRecipeDetail(null)}
        />
      )}

      {/* ── Material Modal ───────────────────────────────────────────────────── */}
      {showMatModal && (
        <SimpleFormModal
          title={editMat ? 'Sửa nguyên vật liệu' : 'Thêm nguyên vật liệu'}
          initial={editMat}
          fields={[
            { key: 'name', label: 'Tên NVL', required: true },
            { key: 'unit', label: 'Đơn vị (kg, lít, hộp…)', required: true },
            { key: 'description', label: t('common', 'description') },
          ]}
          onClose={() => setShowMatModal(false)}
          onSave={async (data) => {
            if (editMat) await factoryMaterialApi.update(editMat.id, data);
            else await factoryMaterialApi.create(data);
            setShowMatModal(false); loadAll();
          }}
        />
      )}

      {/* ── Product Modal ────────────────────────────────────────────────────── */}
      {showProdModal && (
        <SimpleFormModal
          title={editProd ? 'Sửa thành phẩm' : 'Thêm thành phẩm'}
          initial={editProd}
          fields={[
            { key: 'name', label: 'Tên thành phẩm', required: true },
            { key: 'unit', label: 'Đơn vị (kg, cái, hộp…)', required: true },
            { key: 'description', label: t('common', 'description') },
          ]}
          onClose={() => setShowProdModal(false)}
          onSave={async (data) => {
            if (editProd) await factoryProductApi.update(editProd.id, data);
            else await factoryProductApi.create(data);
            setShowProdModal(false); loadAll();
          }}
        />
      )}
    </div>
  );
}

// ── Simple Form Modal ─────────────────────────────────────────────────────────
function SimpleFormModal({ title, initial, fields, onClose, onSave }) {
  const [form, setForm] = useState(initial || {});
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    const missing = fields.filter(f => f.required && !form[f.key]);
    if (missing.length) { setErr(`Vui lòng điền: ${missing.map(f => f.label).join(', ')}`); return; }
    setSaving(true);
    try { await onSave(form); }
    catch (e) { setErr(e?.response?.data?.message || e.message); }
    finally { setSaving(false); }
  };

  return (
    <Modal open title={title} onClose={onClose} size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose} disabled={saving}>Huỷ</SecondaryButton>
          <PrimaryButton onClick={submit} loading={saving}>Lưu</PrimaryButton>
        </div>
      }>
      <div className="space-y-4">
        {err && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{err}</p>}
        {fields.map(f => (
          <Field key={f.key} label={f.label} required={f.required}>
            <input className={inputCls} value={form[f.key] || ''}
              onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))} />
          </Field>
        ))}
      </div>
    </Modal>
  );
}

// ── Recipe Form Modal ─────────────────────────────────────────────────────────
function RecipeDetailModal({ recipe: r, onClose }) {
  const fmtDuration = (mins) => {
    const m = Number(mins) || 0;
    if (m < 60) return `${m} phút`;
    const h = Math.floor(m / 60);
    const rem = m % 60;
    return rem === 0 ? `${h} giờ` : `${h} giờ ${rem} phút`;
  };

  return (
    <Modal open title={`Biến thể: ${r.name}`} onClose={onClose} size="lg">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="bg-blue-50 text-blue-700 ring-blue-200">{r.factoryProductName}</Badge>
          <Badge className="bg-[#C9A84C]/10 text-[#A07830] ring-[#C9A84C]/30">
            Sản lượng chuẩn: {r.standardOutputQty} {r.outputUnit}
          </Badge>
          {r.isActive
            ? <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-200">Đang dùng</Badge>
            : <Badge className="bg-slate-100 text-slate-500 ring-slate-200">Đã tắt</Badge>}
        </div>

        {r.notes && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
            <strong>Ghi chú:</strong> {r.notes}
          </div>
        )}

        {/* Materials */}
        <div>
          <p className="text-xs font-semibold text-[#1C1C1E] uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Package size={13} /> Nguyên liệu
          </p>
          <div className="flex flex-wrap gap-1.5">
            {(r.items || []).map(i => (
              <Badge key={i.id} className="bg-slate-50 text-slate-600 ring-slate-200">
                {i.materialName}: {i.standardQty} {i.unit}
              </Badge>
            ))}
            {(r.items || []).length === 0 && <span className="text-xs text-[#8E8878] italic">Chưa có nguyên liệu</span>}
          </div>
        </div>

        {/* Steps */}
        <div>
          <p className="text-xs font-semibold text-[#1C1C1E] uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Clock size={13} /> Các bước xử lý
          </p>
          <ol className="space-y-1.5">
            {(r.steps || []).map((s, idx) => (
              <li key={s.id} className="flex items-center gap-2 text-sm text-[#1C1C1E] bg-[#FAF7F2] rounded-xl px-3 py-2">
                <span className="w-5 h-5 rounded-full bg-[#1C1C1E] text-white flex items-center justify-center text-[11px] font-bold flex-shrink-0">
                  {idx + 1}
                </span>
                <span className="font-medium flex-1">{s.stepName}</span>
                {s.controlType === 'PHOTO_WEIGHT' || (!s.controlType && s.requiresQc) ? (
                  <span className="flex items-center gap-0.5 text-amber-600 text-xs flex-shrink-0">
                    <ShieldCheck size={12} /> KS cân ký
                  </span>
                ) : s.controlType === 'VISUAL' ? (
                  <span className="flex items-center gap-0.5 text-blue-600 text-xs flex-shrink-0">
                    <Eye size={12} /> KS trực quan
                  </span>
                ) : null}
                <span className="text-[#8E8878] text-xs flex-shrink-0">{fmtDuration(s.durationMinutes)}</span>
                {s.machineName && (
                  <span className="flex items-center gap-1 text-[#8E8878] text-xs flex-shrink-0">
                    <Wrench size={11} /> {s.machineName}
                  </span>
                )}
              </li>
            ))}
            {(r.steps || []).length === 0 && <span className="text-xs text-[#8E8878] italic">Chưa có bước nào</span>}
          </ol>
        </div>

        <p className="text-xs text-[#8E8878] italic">
          Biến thể này do nhân viên xưởng tạo/sửa tại trang "Biến thể sản xuất" của xưởng.
        </p>
      </div>
    </Modal>
  );
}
// ══════════════════════════════════════════════════════════════════════════
// Xưởng — Owner tạo xưởng (tên + địa chỉ) & gán nhân viên xưởng quản lý
// ══════════════════════════════════════════════════════════════════════════
const FACTORY_STATUS_CFG = {
  ACTIVE:   { label: 'Đang hoạt động', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  INACTIVE: { label: 'Ngừng',          cls: 'bg-slate-100 text-slate-500 ring-slate-200' },
};

function FactoriesTab() {
  const [factories, setFactories] = useState(null);
  const [workers, setWorkers] = useState([]);     // SUPER_FACTORY_WORKER + FACTORY_WORKER
  const [showCreate, setShowCreate] = useState(false);
  const [manageFactory, setManageFactory] = useState(null); // factory đang gán nhân viên

  const load = useCallback(async () => {
    try {
      const list = await ownerProdApi.listFactories();
      setFactories(list || []);
    } catch { setFactories([]); }
  }, []);

  // Nhân viên xưởng (trưởng xưởng + nv sản xuất) để gán quản lý xưởng
  const loadWorkers = useCallback(async () => {
    try {
      const [sup, wrk] = await Promise.all([
        adminUserApi.list({ role: 'SUPER_FACTORY_WORKER', size: 200 }),
        adminUserApi.list({ role: 'FACTORY_WORKER', size: 200 }),
      ]);
      const merge = (d) => (d?.content ?? d ?? []);
      const map = new Map();
      [...merge(sup), ...merge(wrk)].forEach(u => map.set(u.id, u));
      setWorkers([...map.values()]);
    } catch { setWorkers([]); }
  }, []);

  useEffect(() => { load(); loadWorkers(); }, [load, loadWorkers]);

  const toggle = async (f) => {
    await ownerProdApi.toggleFactory(f.id, f.status !== 'ACTIVE');
    load();
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center gap-3 flex-wrap">
        <p className="text-sm text-[#8E8878]">
          Mỗi xưởng có kho riêng. Nhân viên xưởng được gán vào xưởng sẽ chỉ thấy & thao tác trên dữ liệu của xưởng mình quản lý.
        </p>
        <PrimaryButton onClick={() => setShowCreate(true)}>
          <Plus size={15} /> Tạo xưởng
        </PrimaryButton>
      </div>

      {factories == null ? (
        <LoadingSpinner />
      ) : factories.length === 0 ? (
        <EmptyState icon={Building2} title="Chưa có xưởng nào"
          description="Tạo xưởng đầu tiên để bắt đầu quản lý sản xuất theo xưởng." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {factories.map(f => {
            const cfg = FACTORY_STATUS_CFG[f.status] || FACTORY_STATUS_CFG.INACTIVE;
            return (
              <div key={f.id} className="bg-white rounded-2xl border border-black/5 shadow-sm p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-[#C9A84C]/15 text-[#C9A84C] flex items-center justify-center flex-shrink-0">
                      <Building2 size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-[#1C1C1E] truncate">{f.name}</p>
                      {f.address && (
                        <p className="text-xs text-[#8E8878] mt-0.5 flex items-center gap-1">
                          <MapPin size={11} className="flex-shrink-0" /> <span className="truncate">{f.address}</span>
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge className={cfg.cls}>{cfg.label}</Badge>
                </div>

                <div className="mt-3 pt-3 border-t border-black/5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-[#8E8878] flex items-center gap-1.5">
                      <Users size={13} /> {(f.managers || []).length} nhân viên quản lý
                    </span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setManageFactory(f)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#1C1C1E] bg-[#FAF7F2] hover:bg-[#F0EBE3] transition-colors">
                        Gán nhân viên
                      </button>
                      <button onClick={() => toggle(f)} title={f.status === 'ACTIVE' ? 'Ngừng xưởng' : 'Kích hoạt'}
                        className="p-2 rounded-lg text-[#8E8878] hover:bg-[#FAF7F2] hover:text-[#1C1C1E] transition-colors">
                        <Power size={15} />
                      </button>
                    </div>
                  </div>
                  {(f.managers || []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {f.managers.map(m => (
                        <span key={m.id} className="text-[11px] bg-[#F5F0EB] text-[#8E8878] px-2 py-0.5 rounded-full">
                          {m.fullName || m.username}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <CreateFactoryModal workers={workers}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load(); }} />
      )}

      {manageFactory && (
        <AssignManagersModal factory={manageFactory} workers={workers}
          onClose={() => setManageFactory(null)}
          onSaved={() => { setManageFactory(null); load(); }} />
      )}
    </div>
  );
}

function CreateFactoryModal({ workers, onClose, onCreated }) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [managerIds, setManagerIds] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const save = async () => {
    setErr('');
    if (!name.trim()) return setErr('Vui lòng nhập tên xưởng.');
    if (!address.trim()) return setErr('Vui lòng nhập địa chỉ xưởng.');
    setBusy(true);
    try {
      await ownerProdApi.createFactory({ name: name.trim(), address: address.trim(), description: description.trim(), managerIds });
      onCreated();
    } catch (e) { setErr(e?.response?.data?.message || 'Không tạo được xưởng.'); }
    finally { setBusy(false); }
  };

  return (
    <Modal open title="Tạo xưởng" onClose={onClose} size="md"
      footer={
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose}>Huỷ</SecondaryButton>
          <PrimaryButton onClick={save} disabled={busy}>{busy ? 'Đang lưu…' : 'Tạo xưởng'}</PrimaryButton>
        </div>
      }>
      <div className="space-y-3">
        {err && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</div>}
        <div>
          <label className="text-sm font-medium text-[#1C1C1E]">Tên xưởng <span className="text-red-500">*</span></label>
          <input className={inputCls} value={name} onChange={e => setName(e.target.value)} placeholder="VD: Xưởng Quận 12" />
        </div>
        <div>
          <label className="text-sm font-medium text-[#1C1C1E]">Địa chỉ <span className="text-red-500">*</span></label>
          <input className={inputCls} value={address} onChange={e => setAddress(e.target.value)} placeholder="Số nhà, đường, phường, quận…" />
        </div>
        <div>
          <label className="text-sm font-medium text-[#1C1C1E]">Mô tả</label>
          <input className={inputCls} value={description} onChange={e => setDescription(e.target.value)} placeholder="(tuỳ chọn)" />
        </div>
        <ManagerPicker workers={workers} selected={managerIds} onChange={setManagerIds} />
      </div>
    </Modal>
  );
}

function AssignManagersModal({ factory, workers, onClose, onSaved }) {
  const [managerIds, setManagerIds] = useState((factory.managers || []).map(m => m.id));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const save = async () => {
    setErr(''); setBusy(true);
    try {
      await ownerProdApi.updateFactoryManagers(factory.id, { managerIds });
      onSaved();
    } catch (e) { setErr(e?.response?.data?.message || 'Không lưu được.'); }
    finally { setBusy(false); }
  };

  return (
    <Modal open title={`Gán nhân viên — ${factory.name}`} onClose={onClose} size="md"
      footer={
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose}>Huỷ</SecondaryButton>
          <PrimaryButton onClick={save} disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu'}</PrimaryButton>
        </div>
      }>
      <div className="space-y-3">
        {err && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</div>}
        <p className="text-xs text-[#8E8878]">
          Chọn trưởng xưởng sản xuất / nhân viên sản xuất quản lý xưởng này. 1 nhân viên có thể quản lý nhiều xưởng.
        </p>
        <ManagerPicker workers={workers} selected={managerIds} onChange={setManagerIds} />
      </div>
    </Modal>
  );
}

// Multiselect nhân viên xưởng dạng chip
function ManagerPicker({ workers, selected, onChange }) {
  const toggle = (id) =>
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);

  return (
    <div>
      <label className="text-sm font-medium text-[#1C1C1E]">Nhân viên quản lý xưởng</label>
      {workers.length === 0 ? (
        <p className="text-xs text-[#8E8878] mt-1">Chưa có tài khoản trưởng xưởng / nhân viên sản xuất.</p>
      ) : (
        <div className="flex flex-wrap gap-2 mt-2 max-h-56 overflow-y-auto">
          {workers.map(u => {
            const on = selected.includes(u.id);
            return (
              <button key={u.id} type="button" onClick={() => toggle(u.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${on
                  ? 'bg-[#C9A84C]/15 text-[#C9A84C] border-[#C9A84C]/40'
                  : 'bg-white text-[#8E8878] border-[#E8DDD0] hover:border-[#C9A84C]/40'}`}>
                {on && <Check size={12} className="inline mr-1" />}
                {u.fullName || u.username}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
