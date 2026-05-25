import { useState, useEffect, useCallback } from 'react';
import { Sk, TableSkeleton } from '../../components/ui/Skeleton.jsx';
import useMinLoading from '../../hooks/useMinLoading.js';
import {
  Factory, Plus, Edit2, Check, X, Package, FlaskConical,
  ClipboardList, TrendingUp, TrendingDown, CalendarDays,
} from 'lucide-react';
import {
  factoryMaterialApi, factoryProductApi, recipeApi, batchOwnerApi,
} from '../../api/productionApi';
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

const TABS = [
  { id: 'batches',   label: 'Mẻ sản xuất',     icon: ClipboardList },
  { id: 'recipes',   label: 'Công thức',        icon: FlaskConical },
  { id: 'products',  label: 'Thành phẩm',       icon: Package },
  { id: 'materials', label: 'Nguyên vật liệu',  icon: Factory },
];

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function OwnerProductionPage() {
  const [tab, setTab]             = useState('batches');
  const [batches, setBatches]     = useState([]);
  const [recipes, setRecipes]     = useState([]);
  const [products, setProducts]   = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useMinLoading();

  // Date filter for batches
  const [preset, setPreset]   = useState('month');
  const [range, setRange]     = useState(() => presetToRange('month'));

  // Modals
  const [batchDetail, setBatchDetail]         = useState(null);
  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [editRecipe, setEditRecipe]           = useState(null);
  const [showMatModal, setShowMatModal]       = useState(false);
  const [editMat, setEditMat]                 = useState(null);
  const [showProdModal, setShowProdModal]     = useState(false);
  const [editProd, setEditProd]               = useState(null);

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

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5">
      <PageHeader
        icon={Factory}
        title="Quản lý sản xuất"
        subtitle="Theo dõi mẻ sản xuất, công thức định lượng và hao hụt"
      />

      {/* Tabs */}
      <div className="bg-white rounded-2xl border border-black/5 p-1 shadow-sm flex gap-1 w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              tab === t.id
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
                ? <EmptyState icon={ClipboardList} title="Không có mẻ nào trong khoảng thời gian này" />
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

          {/* ── Recipes ──────────────────────────────────────────────────── */}
          {tab === 'recipes' && (
            <div className="space-y-3">
              <div className="flex justify-end">
                <PrimaryButton onClick={() => { setEditRecipe(null); setShowRecipeModal(true); }}>
                  <Plus size={15} /> Thêm công thức
                </PrimaryButton>
              </div>
              {recipes.length === 0
                ? <EmptyState icon={FlaskConical} title="Chưa có công thức nào" />
                : (
                  <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-[#FAF7F2] text-[#8E8878]">
                          <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider">Công thức</th>
                          <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider">Thành phẩm</th>
                          <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider">Định lượng chuẩn</th>
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
                            <td className="px-4 py-3 text-right">
                              <button onClick={() => { setEditRecipe(r); setShowRecipeModal(true); }}
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

      {/* ── Recipe Modal ─────────────────────────────────────────────────────── */}
      {showRecipeModal && (
        <RecipeModal
          recipe={editRecipe}
          products={products}
          materials={materials}
          onClose={() => setShowRecipeModal(false)}
          onSaved={() => { setShowRecipeModal(false); loadAll(); }}
        />
      )}

      {/* ── Material Modal ───────────────────────────────────────────────────── */}
      {showMatModal && (
        <SimpleFormModal
          title={editMat ? 'Sửa nguyên vật liệu' : 'Thêm nguyên vật liệu'}
          initial={editMat}
          fields={[
            { key: 'name',        label: 'Tên NVL',                required: true },
            { key: 'unit',        label: 'Đơn vị (kg, lít, hộp…)', required: true },
            { key: 'description', label: 'Mô tả' },
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
            { key: 'name',        label: 'Tên thành phẩm',          required: true },
            { key: 'unit',        label: 'Đơn vị (kg, cái, hộp…)',  required: true },
            { key: 'description', label: 'Mô tả' },
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
  const [form, setForm]   = useState(initial || {});
  const [saving, setSaving] = useState(false);
  const [err, setErr]     = useState('');

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
function RecipeModal({ recipe, products, materials, onClose, onSaved }) {
  const [form, setForm] = useState({
    factoryProductId: recipe?.factoryProductId || '',
    name:             recipe?.name             || '',
    standardOutputQty:recipe?.standardOutputQty|| '',
    notes:            recipe?.notes            || '',
    items: recipe?.items?.map(i => ({
      factoryMaterialId: i.factoryMaterialId,
      standardQty:       i.standardQty,
      unit:              i.unit,
      sortOrder:         i.sortOrder,
    })) || [],
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState('');

  // Lấy đơn vị của thành phẩm đang chọn (để hiển thị, không còn ô nhập)
  const selectedProduct = products.find(p => p.id === Number(form.factoryProductId));

  const addItem = () => setForm(f => ({
    ...f,
    items: [...f.items, { factoryMaterialId: '', standardQty: '', unit: '', sortOrder: f.items.length }],
  }));

  const setItem = (idx, k, v) => setForm(f => ({
    ...f,
    items: f.items.map((it, i) => i === idx ? { ...it, [k]: v } : it),
  }));

  const removeItem = (idx) => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));

  const save = async () => {
    if (!form.factoryProductId || !form.name || !form.standardOutputQty) {
      setErr('Vui lòng điền đầy đủ thông tin bắt buộc'); return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        factoryProductId:  Number(form.factoryProductId),
        standardOutputQty: Number(form.standardOutputQty),
        // outputUnit lấy từ thành phẩm, không nhập tay
        outputUnit: selectedProduct?.unit || '',
        items: form.items.map((it, i) => ({
          factoryMaterialId: Number(it.factoryMaterialId),
          standardQty:       Number(it.standardQty),
          unit:              it.unit,
          sortOrder:         i,
        })),
      };
      if (recipe) await recipeApi.update(recipe.id, payload);
      else await recipeApi.create(payload);
      onSaved();
    } catch (e) {
      setErr(e?.response?.data?.message || e.message);
    } finally { setSaving(false); }
  };

  return (
    <Modal open title={recipe ? 'Sửa công thức' : 'Tạo công thức mới'} onClose={onClose} size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose} disabled={saving}>Huỷ</SecondaryButton>
          <PrimaryButton onClick={save} loading={saving}>Lưu công thức</PrimaryButton>
        </div>
      }>
      <div className="space-y-4">
        {err && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{err}</p>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Thành phẩm" required>
            <select className={inputCls} value={form.factoryProductId}
              onChange={e => setForm(f => ({ ...f, factoryProductId: e.target.value }))}>
              <option value="">Chọn thành phẩm</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>)}
            </select>
          </Field>

          <Field label="Tên công thức" required>
            <input className={inputCls} value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </Field>

          {/* Sản lượng chuẩn + đơn vị tự động từ thành phẩm */}
          <Field label="Sản lượng chuẩn đầu ra" required>
            <div className="flex gap-2">
              <input type="number" min="0" step="0.001" className={inputCls} value={form.standardOutputQty}
                onChange={e => setForm(f => ({ ...f, standardOutputQty: e.target.value }))} />
              {selectedProduct && (
                <span className="flex items-center px-3 py-2.5 bg-[#FAF7F2] border border-black/10 rounded-xl text-sm text-[#8E8878] whitespace-nowrap font-medium">
                  {selectedProduct.unit}
                </span>
              )}
            </div>
            {selectedProduct && (
              <p className="text-xs text-[#8E8878] mt-1">Đơn vị lấy từ thành phẩm: <strong>{selectedProduct.unit}</strong></p>
            )}
          </Field>

          <Field label="Ghi chú">
            <input className={inputCls} value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </Field>
        </div>

        {/* NVL items */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[#1C1C1E] uppercase tracking-wider">Định lượng NVL</span>
            <button onClick={addItem}
              className="flex items-center gap-1 text-xs font-semibold text-[#C9A84C] hover:text-[#A07830] transition-colors">
              <Plus size={13} /> Thêm NVL
            </button>
          </div>

          <div className="space-y-2">
            {form.items.map((item, idx) => {
              const mat = materials.find(m => m.id === Number(item.factoryMaterialId));
              return (
                <div key={idx} className="flex gap-2 items-end bg-[#FAF7F2] rounded-xl p-3 border border-black/5">
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-[#8E8878] uppercase tracking-wider mb-1.5">NVL</label>
                    <select className={inputCls} value={item.factoryMaterialId}
                      onChange={e => {
                        const m = materials.find(m => m.id === Number(e.target.value));
                        setItem(idx, 'factoryMaterialId', e.target.value);
                        // Tự động điền đơn vị từ NVL
                        if (m) setItem(idx, 'unit', m.unit);
                      }}>
                      <option value="">Chọn NVL</option>
                      {materials.map(m => <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>)}
                    </select>
                  </div>
                  <div className="w-28">
                    <label className="block text-xs font-semibold text-[#8E8878] uppercase tracking-wider mb-1.5">Định lượng</label>
                    <input type="number" min="0" step="0.001" className={inputCls} value={item.standardQty}
                      onChange={e => setItem(idx, 'standardQty', e.target.value)} />
                  </div>
                  {/* Đơn vị hiển thị tự động từ NVL, không cho sửa */}
                  <div className="w-20">
                    <label className="block text-xs font-semibold text-[#8E8878] uppercase tracking-wider mb-1.5">Đơn vị</label>
                    <div className="px-3 py-2.5 bg-white border border-black/10 rounded-xl text-sm text-[#8E8878] font-medium">
                      {mat?.unit || item.unit || '—'}
                    </div>
                  </div>
                  <button onClick={() => removeItem(idx)}
                    className="p-2 text-[#8E8878] hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors mb-0.5">
                    <X size={15} />
                  </button>
                </div>
              );
            })}

            {form.items.length === 0 && (
              <p className="text-xs text-[#8E8878] italic text-center py-4">Chưa có NVL nào — nhấn "Thêm NVL" để bắt đầu</p>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}