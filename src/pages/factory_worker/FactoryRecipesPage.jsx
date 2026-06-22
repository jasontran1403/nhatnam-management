import { useState, useEffect, useCallback } from 'react';
import { TableSkeleton } from '../../components/ui/Skeleton.jsx';
import useMinLoading from '../../hooks/useMinLoading.js';
import {
  FlaskConical, Plus, Edit2, X, Power, Clock, ShieldCheck, Wrench, Package,
  Eye, Check, ChevronLeft, ChevronRight, Info,
} from 'lucide-react';
import {
  factoryRecipeApi, factoryWorkerApi, stepTemplateApi, factoryMachineApi,
} from '../../api/productionApi';
import Modal from '../../components/ui/Modal';
import {
  PageHeader, LoadingSpinner, EmptyState, PrimaryButton, SecondaryButton,
  Field, inputCls,
} from '../../components/ui';
import { Badge } from '../../components/ui/Badge';

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtDuration = (mins) => {
  const m = Number(mins) || 0;
  if (m < 60) return `${m} phút`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `${h} giờ` : `${h} giờ ${rem} phút`;
};

// ── Loại kiểm soát cho mỗi bước xử lý ───────────────────────────────────────
// NONE: không kiểm soát · VISUAL: kiểm soát trực quan (xác nhận bằng mắt, không cần ảnh)
// PHOTO_WEIGHT: kiểm soát hình ảnh cân ký (bắt buộc chụp ảnh lúc cân ký)
const CONTROL_TYPES = [
  { value: 'NONE', label: 'Không kiểm soát', desc: 'Xác nhận tự do, không yêu cầu gì thêm', icon: null },
  { value: 'VISUAL', label: 'Kiểm soát trực quan', desc: 'Nhân viên kiểm tra bằng mắt rồi xác nhận, không cần ảnh', icon: Eye },
  { value: 'PHOTO_WEIGHT', label: 'Kiểm soát hình ảnh (cân ký)', desc: 'Bắt buộc chụp ảnh lúc cân ký khi xác nhận', icon: ShieldCheck },
];

function controlTypeOf(step) {
  if (step?.controlType) return step.controlType;
  return step?.requiresQc ? 'PHOTO_WEIGHT' : 'NONE';
}

function ControlTypeIcon({ controlType, requiresQc }) {
  const ct = controlType || (requiresQc ? 'PHOTO_WEIGHT' : 'NONE');
  if (ct === 'PHOTO_WEIGHT') return <ShieldCheck size={12} className="text-amber-500 flex-shrink-0" title="Kiểm soát hình ảnh (cân ký)" />;
  if (ct === 'VISUAL') return <Eye size={12} className="text-blue-500 flex-shrink-0" title="Kiểm soát trực quan" />;
  return null;
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function FactoryRecipesPage() {
  const [recipes, setRecipes] = useState([]);
  const [products, setProducts] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [stepTemplates, setStepTemplates] = useState([]);
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useMinLoading(true);

  const [productFilter, setProductFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editRecipe, setEditRecipe] = useState(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [r, p, m, st, mc] = await Promise.all([
        factoryRecipeApi.list(),
        factoryWorkerApi.listProducts(),
        factoryWorkerApi.listMaterials(),
        stepTemplateApi.list(),
        factoryMachineApi.list(),
      ]);
      setRecipes(r || []);
      setProducts(p || []);
      setMaterials(m || []);
      setStepTemplates(st || []);
      setMachines(mc || []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const filteredRecipes = productFilter
    ? recipes.filter(r => String(r.factoryProductId) === String(productFilter))
    : recipes;

  const openCreate = () => { setEditRecipe(null); setShowModal(true); };
  const openEdit = (r) => { setEditRecipe(r); setShowModal(true); };

  const toggleActive = async (r) => {
    await factoryRecipeApi.toggle(r.id, !r.isActive);
    loadAll();
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5">
      <PageHeader
        icon={FlaskConical}
        title="Biến thể sản xuất"
        subtitle="Khai báo các biến thể sản xuất cho từng thành phẩm — mỗi biến thể gồm nguyên liệu, các bước xử lý và máy móc sử dụng"
        action={
          <PrimaryButton onClick={openCreate}>
            <Plus size={15} /> Tạo biến thể mới
          </PrimaryButton>
        }
      />

      {/* Filter by product */}
      <div className="bg-white rounded-2xl border border-black/5 p-3 sm:p-4 shadow-sm flex flex-wrap items-center gap-3">
        <span className="text-xs font-semibold text-[#8E8878] uppercase tracking-wider">Lọc theo thành phẩm</span>
        <select className={inputCls + ' max-w-xs'} value={productFilter}
          onChange={e => setProductFilter(e.target.value)}>
          <option value="">Tất cả thành phẩm</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {loading ? (
        <TableSkeleton cols={4} rows={6} />
      ) : filteredRecipes.length === 0 ? (
        <EmptyState icon={FlaskConical} title="Chưa có biến thể sản xuất nào"
          description="Tạo biến thể đầu tiên cho một thành phẩm để bắt đầu lập phương án sản xuất" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredRecipes.map(r => (
            <RecipeCard key={r.id} recipe={r} onEdit={() => openEdit(r)} onToggle={() => toggleActive(r)} />
          ))}
        </div>
      )}

      {showModal && (
        <RecipeFormModal
          recipe={editRecipe}
          products={products}
          materials={materials}
          stepTemplates={stepTemplates}
          machines={machines}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); loadAll(); }}
          onStepTemplateCreated={(tpl) => setStepTemplates(prev => [...prev, tpl])}
        />
      )}
    </div>
  );
}

// ── Recipe Card ───────────────────────────────────────────────────────────────
function RecipeCard({ recipe: r, onEdit, onToggle }) {
  return (
    <div className={`bg-white rounded-2xl border border-black/5 shadow-sm p-4 sm:p-5 space-y-3 ${!r.isActive ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-bold text-[#1C1C1E]" style={{ fontFamily: 'var(--font-display)' }}>{r.name}</p>
          <p className="text-xs text-[#8E8878] mt-0.5">{r.factoryProductName}</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={onToggle} title={r.isActive ? 'Tắt biến thể' : 'Bật biến thể'}
            className={`p-2 rounded-lg transition-colors ${r.isActive ? 'text-emerald-600 hover:bg-emerald-50' : 'text-[#8E8878] hover:bg-[#FAF7F2]'}`}>
            <Power size={15} />
          </button>
          <button onClick={onEdit} className="p-2 rounded-lg text-[#8E8878] hover:bg-[#FAF7F2] hover:text-[#1C1C1E] transition-colors">
            <Edit2 size={15} />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Badge className="bg-[#C9A84C]/10 text-[#A07830] ring-[#C9A84C]/30">
          Sản lượng chuẩn: {r.standardOutputQty} {r.outputUnit}
        </Badge>
        {r.packagingQty != null && (
          <Badge className="bg-blue-50 text-blue-700 ring-blue-200">
            Đóng gói chuẩn: {r.packagingQty} {r.outputUnit}/{r.packagingUnit || 'túi'}
          </Badge>
        )}
      </div>

      {/* Materials */}
      <div>
        <p className="text-xs font-semibold text-[#8E8878] uppercase tracking-wider mb-1.5 flex items-center gap-1">
          <Package size={12} /> Nguyên liệu
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
        <p className="text-xs font-semibold text-[#8E8878] uppercase tracking-wider mb-1.5 flex items-center gap-1">
          <Clock size={12} /> Các bước
        </p>
        <ol className="space-y-1">
          {(r.steps || []).map((s, idx) => (
            <li key={s.id} className="flex items-center gap-2 text-xs text-[#1C1C1E] bg-[#FAF7F2] rounded-lg px-2.5 py-1.5">
              <span className="w-4 h-4 rounded-full bg-[#1C1C1E] text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                {idx + 1}
              </span>
              <span className="font-medium flex-1 truncate">{s.stepName}</span>
              <ControlTypeIcon controlType={s.controlType} requiresQc={s.requiresQc} />
              <span className="text-[#8E8878] flex-shrink-0">{fmtDuration(s.durationMinutes)}</span>
              {s.machineName && (
                <span className="flex items-center gap-0.5 text-[#8E8878] flex-shrink-0">
                  <Wrench size={11} /> {s.machineName}
                </span>
              )}
            </li>
          ))}
          {(r.steps || []).length === 0 && <span className="text-xs text-[#8E8878] italic">Chưa có bước nào</span>}
        </ol>
      </div>
    </div>
  );
}

// ── Recipe Form Modal (Tạo / Sửa biến thể) ──────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
// Wizard tạo/sửa biến thể — 3 modal dạng step:
//   Step 1: Thông tin chung (sản phẩm, tên, định lượng chuẩn, mô tả)
//   Step 2: Nguyên liệu (thêm/bớt)
//   Step 3: Các bước xử lý (+ loại kiểm soát)
// Đóng modal (X / click ngoài) ở bất kỳ step nào → xoá toàn bộ dữ liệu đã nhập.
// Có thể quay lại step trước để sửa mà không mất dữ liệu các step sau.
// ═══════════════════════════════════════════════════════════════════════════
function StepDots({ step, total = 3 }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i}
          className={`h-1.5 rounded-full transition-all ${i + 1 === step ? 'w-6 bg-[#C9A84C]' : i + 1 < step ? 'w-1.5 bg-[#C9A84C]/50' : 'w-1.5 bg-black/10'}`} />
      ))}
    </div>
  );
}

function RecipeFormModal({ recipe, products, materials, stepTemplates, machines, onClose, onSaved, onStepTemplateCreated }) {
  const [wizardStep, setWizardStep] = useState(1);
  const [form, setForm] = useState({
    factoryProductId: recipe?.factoryProductId || '',
    name: recipe?.name || '',
    standardOutputQty: recipe?.standardOutputQty ?? '',
    packagingQty: recipe?.packagingQty ?? '',
    packagingUnit: recipe?.packagingUnit || 'túi',
    notes: recipe?.notes || '',
    items: recipe?.items?.map(i => ({
      factoryMaterialId: i.factoryMaterialId,
      standardQty: i.standardQty,
      unit: i.unit,
    })) || [],
    steps: recipe?.steps?.map(s => ({
      stepTemplateId: s.stepTemplateId || '',
      stepName: s.stepName,
      controlType: controlTypeOf(s),
      durationMinutes: s.durationMinutes,
      machineId: s.machineId || '',
    })) || [],
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [newStepName, setNewStepName] = useState('');

  const selectedProduct = products.find(p => p.id === Number(form.factoryProductId));

  // Đóng hẳn modal (X / click ngoài / Huỷ) → xoá toàn bộ dữ liệu đã nhập ở mọi step
  const handleClose = () => onClose();

  // ── Step 1 validation ─────────────────────────────────────────────────────
  const validateStep1 = () => {
    if (!form.factoryProductId || !form.name.trim() || !form.standardOutputQty) {
      setErr('Vui lòng điền đầy đủ: thành phẩm, tên biến thể, định lượng chuẩn'); return false;
    }
    setErr(''); return true;
  };

  // ── Step 2: Items (nguyên liệu) ──────────────────────────────────────────
  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { factoryMaterialId: '', standardQty: '', unit: '' }] }));
  const setItem = (idx, k, v) => setForm(f => ({ ...f, items: f.items.map((it, i) => i === idx ? { ...it, [k]: v } : it) }));
  const removeItem = (idx) => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));

  const validateStep2 = () => {
    if (form.items.length === 0) { setErr('Vui lòng thêm ít nhất 1 nguyên liệu'); return false; }
    if (form.items.some(it => !it.factoryMaterialId || !it.standardQty)) {
      setErr('Vui lòng điền đầy đủ thông tin nguyên liệu (hoặc xoá dòng trống)'); return false;
    }
    setErr(''); return true;
  };

  // ── Step 3: Steps (bước xử lý) ────────────────────────────────────────────
  const addStep = (template) => setForm(f => ({
    ...f,
    steps: [...f.steps, {
      stepTemplateId: template?.id || '',
      stepName: template?.name || '',
      controlType: 'NONE',
      durationMinutes: '',
      machineId: '',
    }],
  }));
  const setStep = (idx, k, v) => setForm(f => ({ ...f, steps: f.steps.map((s, i) => i === idx ? { ...s, [k]: v } : s) }));
  const removeStep = (idx) => setForm(f => ({ ...f, steps: f.steps.filter((_, i) => i !== idx) }));
  const moveStep = (idx, dir) => setForm(f => {
    const next = [...f.steps];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return f;
    [next[idx], next[target]] = [next[target], next[idx]];
    return { ...f, steps: next };
  });

  const createStepTemplate = async () => {
    const name = newStepName.trim();
    if (!name) return;
    try {
      const tpl = await stepTemplateApi.create(name);
      onStepTemplateCreated?.(tpl);
      addStep(tpl);
      setNewStepName('');
    } catch (e) {
      setErr(e?.response?.data?.message || e.message);
    }
  };

  const save = async () => {
    // Chặn double-submit: nếu đang lưu rồi thì bỏ qua lần gọi tiếp theo (double-click
    // rất nhanh có thể gọi save() 2 lần trước khi React re-render disable nút).
    if (saving) return;
    if (form.steps.some(s => !s.stepName?.trim() || !s.durationMinutes)) {
      setErr('Mỗi bước cần có tên và thời gian hoàn thành (phút)'); return;
    }
    setSaving(true);
    setErr('');
    try {
      const payload = {
        factoryProductId: Number(form.factoryProductId),
        name: form.name.trim(),
        standardOutputQty: Number(form.standardOutputQty),
        outputUnit: selectedProduct?.unit || '',
        packagingQty: form.packagingQty ? Number(form.packagingQty) : null,
        packagingUnit: form.packagingQty ? (form.packagingUnit?.trim() || 'túi') : null,
        notes: form.notes,
        items: form.items.map(it => ({
          factoryMaterialId: Number(it.factoryMaterialId),
          standardQty: Number(it.standardQty),
          unit: it.unit,
        })),
        steps: form.steps.map((s, i) => ({
          stepTemplateId: s.stepTemplateId ? Number(s.stepTemplateId) : null,
          stepName: s.stepName.trim(),
          sortOrder: i,
          controlType: s.controlType || 'NONE',
          requiresQc: (s.controlType || 'NONE') !== 'NONE',
          durationMinutes: Number(s.durationMinutes),
          machineId: s.machineId ? Number(s.machineId) : null,
        })),
      };
      if (recipe) await factoryRecipeApi.update(recipe.id, payload);
      else await factoryRecipeApi.create(payload);
      onSaved();
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || 'Có lỗi xảy ra, vui lòng thử lại');
    } finally { setSaving(false); }
  };

  const stepTitles = {
    1: 'Bước 1/3 — Thông tin chung',
    2: 'Bước 2/3 — Nguyên liệu',
    3: 'Bước 3/3 — Các bước xử lý',
  };

  return (
    <Modal open title={`${recipe ? 'Sửa biến thể' : 'Tạo biến thể mới'} · ${stepTitles[wizardStep]}`} onClose={handleClose} size="xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <StepDots step={wizardStep} />
          <div className="flex gap-2">
            <SecondaryButton onClick={handleClose} disabled={saving}>Huỷ</SecondaryButton>
            {wizardStep > 1 && (
              <SecondaryButton onClick={() => { setErr(''); setWizardStep(s => s - 1); }} disabled={saving}>
                <ChevronLeft size={14} /> Quay lại
              </SecondaryButton>
            )}
            {wizardStep < 3 && (
              <PrimaryButton onClick={() => {
                if (wizardStep === 1 && !validateStep1()) return;
                if (wizardStep === 2 && !validateStep2()) return;
                setWizardStep(s => s + 1);
              }}>
                Tiếp tục <ChevronRight size={14} />
              </PrimaryButton>
            )}
            {wizardStep === 3 && (
              <PrimaryButton onClick={save} loading={saving}>
                <Check size={14} /> Hoàn tất & Lưu
              </PrimaryButton>
            )}
          </div>
        </div>
      }>
      <div className="space-y-5">
        {err && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{err}</p>}

        {/* ════════════ STEP 1: Thông tin chung ════════════ */}
        {wizardStep === 1 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Sản phẩm" required hint="Biến thể sẽ áp dụng cho thành phẩm này">
              <select className={inputCls} value={form.factoryProductId}
                onChange={e => setForm(f => ({ ...f, factoryProductId: e.target.value }))}>
                <option value="">Chọn thành phẩm</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>)}
              </select>
            </Field>

            <Field label="Tên biến thể" required hint="Tên tự đặt để dễ nhớ, không được trùng trong cùng thành phẩm">
              <input className={inputCls} value={form.name} placeholder="VD: Xúc xích biến thể 1"
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </Field>

            <Field label="Định lượng chuẩn (sản lượng thành phẩm)" required>
              <div className="flex gap-2">
                <input type="number" min="0" step="0.001" className={inputCls} value={form.standardOutputQty}
                  onChange={e => setForm(f => ({ ...f, standardOutputQty: e.target.value }))} />
                {selectedProduct && (
                  <span className="flex items-center px-3 py-2.5 bg-[#FAF7F2] border border-black/10 rounded-xl text-sm text-[#8E8878] whitespace-nowrap font-medium">
                    {selectedProduct.unit}
                  </span>
                )}
              </div>
            </Field>

            <Field label="Định lượng đóng gói chuẩn" hint="VD: 0.5 — dùng để ước tính số gói dự kiến, không bắt buộc">
              <div className="flex gap-2">
                <input type="number" min="0" step="0.001" className={inputCls} value={form.packagingQty}
                  placeholder="VD: 0.5" onChange={e => setForm(f => ({ ...f, packagingQty: e.target.value }))} />
                {selectedProduct && (
                  <span className="flex items-center px-2 py-2.5 bg-[#FAF7F2] border border-black/10 rounded-xl text-sm text-[#8E8878] whitespace-nowrap font-medium">
                    {selectedProduct.unit}/
                  </span>
                )}
                <input type="text" className={inputCls} style={{maxWidth: 90}} value={form.packagingUnit}
                  placeholder="túi" onChange={e => setForm(f => ({ ...f, packagingUnit: e.target.value }))} />
              </div>
            </Field>

            <Field label="Mô tả">
              <input className={inputCls} value={form.notes} placeholder="Mô tả ngắn về biến thể này (không bắt buộc)"
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </Field>
          </div>
        )}

        {/* ════════════ STEP 2: Nguyên liệu ════════════ */}
        {wizardStep === 2 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[#1C1C1E] uppercase tracking-wider flex items-center gap-1.5">
                <Package size={13} /> Nguyên liệu
              </span>
              <button onClick={addItem}
                className="flex items-center gap-1 text-xs font-semibold text-[#C9A84C] hover:text-[#A07830] transition-colors">
                <Plus size={13} /> Thêm nguyên liệu
              </button>
            </div>

            <div className="space-y-2">
              {form.items.map((item, idx) => {
                const mat = materials.find(m => m.id === Number(item.factoryMaterialId));
                return (
                  <div key={idx} className="flex gap-2 items-end bg-[#FAF7F2] rounded-xl p-3 border border-black/5">
                    <div className="flex-1">
                      <label className="block text-xs font-semibold text-[#8E8878] uppercase tracking-wider mb-1.5">Nguyên liệu</label>
                      <select className={inputCls} value={item.factoryMaterialId}
                        onChange={e => {
                          const m = materials.find(m => m.id === Number(e.target.value));
                          setItem(idx, 'factoryMaterialId', e.target.value);
                          if (m) setItem(idx, 'unit', m.unit);
                        }}>
                        <option value="">Chọn nguyên liệu</option>
                        {materials.map(m => <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>)}
                      </select>
                    </div>
                    <div className="w-28">
                      <label className="block text-xs font-semibold text-[#8E8878] uppercase tracking-wider mb-1.5">Số lượng</label>
                      <input type="number" min="0" step="0.001" className={inputCls} value={item.standardQty}
                        onChange={e => setItem(idx, 'standardQty', e.target.value)} />
                    </div>
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
                <p className="text-xs text-[#8E8878] italic text-center py-6">Chưa có nguyên liệu nào — nhấn "Thêm nguyên liệu" để bắt đầu</p>
              )}
            </div>
          </div>
        )}

        {/* ════════════ STEP 3: Các bước xử lý ════════════ */}
        {wizardStep === 3 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[#1C1C1E] uppercase tracking-wider flex items-center gap-1.5">
                <Clock size={13} /> Các bước xử lý
              </span>
            </div>

            {/* Quick add from template */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {stepTemplates.map(tpl => (
                <button key={tpl.id} onClick={() => addStep(tpl)}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-[#FAF7F2] text-[#1C1C1E] hover:bg-[#F0EBE3] border border-black/5 transition-colors">
                  <Plus size={11} /> {tpl.name}
                </button>
              ))}
              <div className="flex items-center gap-1">
                <input className="px-2.5 py-1.5 text-xs rounded-lg border border-black/10 w-36"
                  placeholder="Tên bước mới..." value={newStepName}
                  onChange={e => setNewStepName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); createStepTemplate(); } }} />
                <button onClick={createStepTemplate}
                  className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-[#1C1C1E] text-white hover:bg-black transition-colors">
                  Tạo mẫu
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {form.steps.map((step_, idx) => (
                <div key={idx} className="bg-[#FAF7F2] rounded-xl p-3 border border-black/5">
                  <div className="flex gap-2 items-start">
                    <div className="flex flex-col gap-0.5 pt-1.5">
                      <span className="w-6 h-6 rounded-full bg-[#1C1C1E] text-white flex items-center justify-center text-xs font-bold">
                        {idx + 1}
                      </span>
                      <div className="flex flex-col">
                        <button disabled={idx === 0} onClick={() => moveStep(idx, -1)}
                          className="text-[#8E8878] hover:text-[#1C1C1E] disabled:opacity-30 text-[10px] leading-none">▲</button>
                        <button disabled={idx === form.steps.length - 1} onClick={() => moveStep(idx, 1)}
                          className="text-[#8E8878] hover:text-[#1C1C1E] disabled:opacity-30 text-[10px] leading-none">▼</button>
                      </div>
                    </div>

                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-4 gap-2">
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-[#8E8878] uppercase tracking-wider mb-1">Tên bước</label>
                        <input className={inputCls} value={step_.stepName}
                          onChange={e => setStep(idx, 'stepName', e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#8E8878] uppercase tracking-wider mb-1">Thời gian (phút)</label>
                        <input type="number" min="1" className={inputCls} value={step_.durationMinutes}
                          onChange={e => setStep(idx, 'durationMinutes', e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#8E8878] uppercase tracking-wider mb-1">Máy sử dụng</label>
                        <select className={inputCls} value={step_.machineId}
                          onChange={e => setStep(idx, 'machineId', e.target.value)}>
                          <option value="">Không dùng máy</option>
                          {machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                      </div>

                      {/* ── Loại kiểm soát: Không KS / Trực quan / Hình ảnh cân ký ── */}
                      <div className="sm:col-span-4">
                        <label className="block text-xs font-semibold text-[#8E8878] uppercase tracking-wider mb-1.5">Kiểm soát</label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                          {CONTROL_TYPES.map(ct => {
                            const active = (step_.controlType || 'NONE') === ct.value;
                            const Icon = ct.icon;
                            return (
                              <button key={ct.value} type="button" onClick={() => setStep(idx, 'controlType', ct.value)}
                                className={`text-left px-3 py-2 rounded-lg border transition-colors ${
                                  active ? 'border-[#C9A84C] bg-[#C9A84C]/10' : 'border-black/10 bg-white hover:bg-[#F0EBE3]'
                                }`}>
                                <span className={`flex items-center gap-1.5 text-xs font-semibold ${active ? 'text-[#A07830]' : 'text-[#1C1C1E]'}`}>
                                  {Icon ? <Icon size={13} className={active ? 'text-[#C9A84C]' : 'text-[#8E8878]'} /> : <span className="w-[13px]" />}
                                  {ct.label}
                                </span>
                                <span className="block text-[10px] text-[#8E8878] mt-0.5 leading-snug">{ct.desc}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <button onClick={() => removeStep(idx)}
                      className="p-2 text-[#8E8878] hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      <X size={15} />
                    </button>
                  </div>
                </div>
              ))}
              {form.steps.length === 0 && (
                <p className="text-xs text-[#8E8878] italic text-center py-6">Chưa có bước nào — chọn mẫu bước phía trên hoặc tạo mẫu mới</p>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
