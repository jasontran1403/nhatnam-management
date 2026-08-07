import { useState, useEffect, useCallback, useRef } from 'react';
import { useLang } from '../../context/LangContext';
import { TableSkeleton } from '../../components/ui/Skeleton.jsx';
import useMinLoading from '../../hooks/useMinLoading.js';
import {
  FlaskConical, Plus, Edit2, X, Power, Clock, ShieldCheck, Wrench, Package,
  Eye, Check, ChevronLeft, ChevronRight, Info, Search,
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
const fmtDuration = (mins, t) => {
  const m = Number(mins) || 0;
  const minLabel = t ? t('production', 'duration_minute') : 'phút';
  const hourLabel = t ? t('production', 'duration_hour') : 'giờ';
  if (m < 60) return `${m} ${minLabel}`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `${h} ${hourLabel}` : `${h} ${hourLabel} ${rem} ${minLabel}`;
};

// ── Loại kiểm soát cho mỗi bước xử lý ───────────────────────────────────────
// NONE: không kiểm soát · VISUAL: kiểm soát trực quan (xác nhận bằng mắt, không cần ảnh)
// PHOTO_WEIGHT: kiểm soát hình ảnh cân ký (bắt buộc chụp ảnh lúc cân ký)
const getControlTypes = (t) => [
  { value: 'NONE', label: t('production', 'recipe_control_none'), desc: t('production', 'recipe_control_none_desc'), icon: null },
  { value: 'VISUAL', label: t('production', 'recipe_control_visual'), desc: t('production', 'recipe_control_visual_desc'), icon: Eye },
  { value: 'PHOTO_WEIGHT', label: t('production', 'recipe_control_photo_weight'), desc: t('production', 'recipe_control_photo_weight_desc'), icon: ShieldCheck },
];

function controlTypeOf(step) {
  if (step?.controlType) return step.controlType;
  return step?.requiresQc ? 'PHOTO_WEIGHT' : 'NONE';
}

// ── ProductSearchSelect ───────────────────────────────────────────────────────
// Input search + dropdown để chọn sản phẩm, thay cho <select> thường khi danh
// sách thành phẩm dài, khó tìm bằng cách cuộn dropdown gốc.
function ProductSearchSelect({ products, value, onChange, placeholder }) {
  const { t } = useLang();
  const effectivePlaceholder = placeholder || t('production', 'recipe_search_product_placeholder');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);
  const dropRef = useRef(null);

  const selected = products.find(p => String(p.id) === String(value));

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Khi mở dropdown, hiển thị toàn bộ danh sách trước (chưa gõ gì) hoặc lọc theo query
  const norm = (s) => (s || '').toLowerCase();
  const filtered = query.trim()
    ? products.filter(p => norm(p.name).includes(norm(query)))
    : products;

  const pick = (p) => {
    onChange(String(p.id));
    setQuery('');
    setOpen(false);
  };

  return (
    <div ref={dropRef} className="relative">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
        <input
          ref={inputRef}
          className={inputCls + ' pl-9'}
          value={open ? query : (selected ? `${selected.name} (${selected.unit})` : '')}
          placeholder={effectivePlaceholder}
          onFocus={() => { setOpen(true); setQuery(''); }}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
        />
        {selected && !open && (
          <button type="button" onClick={() => { onChange(''); setQuery(''); }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-red-500">
            <X size={14} />
          </button>
        )}
      </div>
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-surface rounded-xl border border-hairline-2 shadow-lg py-1 max-h-56 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-3 py-2.5 text-xs text-muted italic">{t('production', 'recipe_no_product_found')}</p>
          ) : (
            filtered.map(p => (
              <button key={p.id} type="button" onClick={() => pick(p)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-xs text-left transition-colors
                  ${String(p.id) === String(value) ? 'bg-gold/10 text-gold-deep font-semibold' : 'hover:bg-canvas text-ink'}`}>
                <span className="truncate">{p.name}</span>
                <span className="text-muted text-[10px] flex-shrink-0">{p.unit}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function ControlTypeIcon({ controlType, requiresQc }) {
  const { t } = useLang();
  const ct = controlType || (requiresQc ? 'PHOTO_WEIGHT' : 'NONE');
  if (ct === 'PHOTO_WEIGHT') return <ShieldCheck size={12} className="text-amber-500 flex-shrink-0" title={t('production', 'recipe_control_photo_weight')} />;
  if (ct === 'VISUAL') return <Eye size={12} className="text-blue-500 flex-shrink-0" title={t('production', 'recipe_control_visual')} />;
  return null;
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function FactoryRecipesPage() {
  const { t } = useLang();
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
        title={t('production', 'recipe_title')}
        subtitle={t('production', 'recipe_subtitle')}
        action={
          <PrimaryButton onClick={openCreate}>
            <Plus size={15} /> {t('production', 'recipe_create_new')}
          </PrimaryButton>
        }
      />

      {/* Filter by product */}
      <div className="bg-surface rounded-2xl border border-hairline p-3 sm:p-4 shadow-sm flex flex-wrap items-center gap-3">
        <span className="text-xs font-semibold text-muted uppercase tracking-wider">{t('production', 'recipe_filter_by_product')}</span>
        <select className={inputCls + ' max-w-xs'} value={productFilter}
          onChange={e => setProductFilter(e.target.value)}>
          <option value="">{t('production', 'recipe_all_products')}</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {loading ? (
        <TableSkeleton cols={4} rows={6} />
      ) : filteredRecipes.length === 0 ? (
        <EmptyState icon={FlaskConical} title={t('production', 'recipe_empty_title')}
          description={t('production', 'recipe_empty_desc')} />
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
  const { t } = useLang();
  return (
    <div className={`bg-surface rounded-2xl border border-hairline shadow-sm p-4 sm:p-5 space-y-3 ${!r.isActive ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-bold text-ink" style={{ fontFamily: 'var(--font-display)' }}>{r.name}</p>
          <p className="text-xs text-muted mt-0.5">{r.factoryProductName}</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={onToggle} title={r.isActive ? t('production', 'recipe_disable') : t('production', 'recipe_enable')}
            className={`p-2 rounded-lg transition-colors ${r.isActive ? 'text-emerald-600 dark:text-emerald-300 hover:bg-emerald-50 dark:bg-emerald-500/10' : 'text-muted hover:bg-canvas'}`}>
            <Power size={15} />
          </button>
          <button onClick={onEdit} className="p-2 rounded-lg text-muted hover:bg-canvas hover:text-ink transition-colors">
            <Edit2 size={15} />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Badge className="bg-gold/10 text-gold-deep ring-gold/30">
          {t('production', 'recipe_standard_output')}: {r.standardOutputQty} {r.outputUnit}
        </Badge>
        {r.packagingQty != null && (
          <Badge className="bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 ring-blue-200 dark:ring-blue-500/28">
            {t('production', 'recipe_standard_packaging')}: {r.packagingQty} {r.outputUnit}/{r.packagingUnit || 'túi'}
          </Badge>
        )}
      </div>

      {/* Materials */}
      <div>
        <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-1.5 flex items-center gap-1">
          <Package size={12} /> {t('production', 'recipe_materials')}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {(r.items || []).map(i => (
            <Badge key={i.id} className="bg-canvas text-ink-2 ring-line">
              {i.materialName}: {i.standardQty} {i.unit}
            </Badge>
          ))}
          {(r.items || []).length === 0 && <span className="text-xs text-muted italic">{t('production', 'recipe_no_materials')}</span>}
        </div>
      </div>

      {/* Steps */}
      <div>
        <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-1.5 flex items-center gap-1">
          <Clock size={12} /> {t('production', 'recipe_steps')}
        </p>
        <ol className="space-y-1">
          {(r.steps || []).map((s, idx) => (
            <li key={s.id} className="flex items-center gap-2 text-xs text-ink bg-canvas rounded-lg px-2.5 py-1.5">
              <span className="w-4 h-4 rounded-full bg-chrome text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                {idx + 1}
              </span>
              <span className="font-medium flex-1 truncate">{s.stepName}</span>
              <ControlTypeIcon controlType={s.controlType} requiresQc={s.requiresQc} />
              <span className="text-muted flex-shrink-0">{fmtDuration(s.durationMinutes, t)}</span>
              {s.machineName && (
                <span className="flex items-center gap-0.5 text-muted flex-shrink-0">
                  <Wrench size={11} /> {s.machineName}
                </span>
              )}
            </li>
          ))}
          {(r.steps || []).length === 0 && <span className="text-xs text-muted italic">{t('production', 'recipe_no_steps')}</span>}
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
          className={`h-1.5 rounded-full transition-all ${i + 1 === step ? 'w-6 bg-gold' : i + 1 < step ? 'w-1.5 bg-gold/50' : 'w-1.5 bg-hairline-2'}`} />
      ))}
    </div>
  );
}

function RecipeFormModal({ recipe, products, materials, stepTemplates, machines, onClose, onSaved, onStepTemplateCreated }) {
  const { t } = useLang();
  const CONTROL_TYPES = getControlTypes(t);
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
      shared: s.shared || false,
      capacityPerRun: s.capacityPerRun != null ? s.capacityPerRun : '',
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
      setErr(t('production', 'recipe_err_step1')); return false;
    }
    setErr(''); return true;
  };

  // ── Step 2: Items (nguyên liệu) ──────────────────────────────────────────
  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { factoryMaterialId: '', standardQty: '', unit: '' }] }));
  const setItem = (idx, k, v) => setForm(f => ({ ...f, items: f.items.map((it, i) => i === idx ? { ...it, [k]: v } : it) }));
  const removeItem = (idx) => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));

  const validateStep2 = () => {
    if (form.items.length === 0) { setErr(t('production', 'recipe_err_step2_empty')); return false; }
    if (form.items.some(it => !it.factoryMaterialId || !it.standardQty)) {
      setErr(t('production', 'recipe_err_step2_incomplete')); return false;
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
      shared: false,
      capacityPerRun: '',
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
      setErr(t('production', 'recipe_err_step3')); return;
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
          shared: !!s.shared,
          capacityPerRun: s.shared && s.capacityPerRun !== '' && s.capacityPerRun != null
            ? Number(s.capacityPerRun) : null,
        })),
      };
      if (recipe) await factoryRecipeApi.update(recipe.id, payload);
      else await factoryRecipeApi.create(payload);
      onSaved();
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || t('production', 'recipe_err_generic'));
    } finally { setSaving(false); }
  };

  const stepTitles = {
    1: t('production', 'recipe_step_1_title'),
    2: t('production', 'recipe_step_2_title'),
    3: t('production', 'recipe_step_3_title'),
  };

  return (
    <Modal open title={`${recipe ? t('production', 'recipe_edit') : t('production', 'recipe_create')} · ${stepTitles[wizardStep]}`} onClose={handleClose} size="xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <StepDots step={wizardStep} />
          <div className="flex gap-2">
            <SecondaryButton onClick={handleClose} disabled={saving}>{t('production', 'recipe_cancel')}</SecondaryButton>
            {wizardStep > 1 && (
              <SecondaryButton onClick={() => { setErr(''); setWizardStep(s => s - 1); }} disabled={saving}>
                <ChevronLeft size={14} /> {t('production', 'recipe_back')}
              </SecondaryButton>
            )}
            {wizardStep < 3 && (
              <PrimaryButton onClick={() => {
                if (wizardStep === 1 && !validateStep1()) return;
                if (wizardStep === 2 && !validateStep2()) return;
                setWizardStep(s => s + 1);
              }}>
                {t('production', 'recipe_continue')} <ChevronRight size={14} />
              </PrimaryButton>
            )}
            {wizardStep === 3 && (
              <PrimaryButton onClick={save} loading={saving}>
                <Check size={14} /> {t('production', 'recipe_finish_save')}
              </PrimaryButton>
            )}
          </div>
        </div>
      }>
      <div className="space-y-5">
        {err && <p className="text-xs text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/28 rounded-xl px-3 py-2">{err}</p>}

        {/* ════════════ STEP 1: Thông tin chung ════════════ */}
        {wizardStep === 1 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label={t('production', 'recipe_field_product')} required hint={t('production', 'recipe_field_product_hint')}>
              <ProductSearchSelect products={products} value={form.factoryProductId}
                onChange={val => setForm(f => ({ ...f, factoryProductId: val }))} />
            </Field>

            <Field label={t('production', 'recipe_field_name')} required hint={t('production', 'recipe_field_name_hint')}>
              <input className={inputCls} value={form.name} placeholder={t('production', 'recipe_field_name_placeholder')}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </Field>

            <Field label={t('production', 'recipe_field_standard_output')} required>
              <div className="flex gap-2">
                <input type="number" min="0" step="0.001" className={inputCls} value={form.standardOutputQty}
                  onChange={e => setForm(f => ({ ...f, standardOutputQty: e.target.value }))} />
                {selectedProduct && (
                  <span className="flex items-center px-3 py-2.5 bg-canvas border border-hairline-2 rounded-xl text-sm text-muted whitespace-nowrap font-medium">
                    {selectedProduct.unit}
                  </span>
                )}
              </div>
            </Field>

            <Field label={t('production', 'recipe_field_standard_packaging')} hint={t('production', 'recipe_field_standard_packaging_hint')}>
              <div className="flex gap-2">
                <input type="number" min="0" step="0.001" className={inputCls} value={form.packagingQty}
                  placeholder="VD: 0.5" onChange={e => setForm(f => ({ ...f, packagingQty: e.target.value }))} />
                {selectedProduct && (
                  <span className="flex items-center px-2 py-2.5 bg-canvas border border-hairline-2 rounded-xl text-sm text-muted whitespace-nowrap font-medium">
                    {selectedProduct.unit}/
                  </span>
                )}
                <input type="text" className={inputCls} style={{maxWidth: 90}} value={form.packagingUnit}
                  placeholder="túi" onChange={e => setForm(f => ({ ...f, packagingUnit: e.target.value }))} />
              </div>
            </Field>

            <Field label={t('production', 'recipe_field_notes')}>
              <input className={inputCls} value={form.notes} placeholder={t('production', 'recipe_field_notes_placeholder')}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </Field>
          </div>
        )}

        {/* ════════════ STEP 2: Nguyên liệu ════════════ */}
        {wizardStep === 2 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-ink uppercase tracking-wider flex items-center gap-1.5">
                <Package size={13} /> {t('production', 'recipe_section_materials')}
              </span>
              <button onClick={addItem}
                className="flex items-center gap-1 text-xs font-semibold text-gold hover:text-gold-deep transition-colors">
                <Plus size={13} /> {t('production', 'recipe_add_material')}
              </button>
            </div>

            <div className="space-y-2">
              {form.items.map((item, idx) => {
                const mat = materials.find(m => m.id === Number(item.factoryMaterialId));
                return (
                  <div key={idx} className="flex gap-2 items-end bg-canvas rounded-xl p-3 border border-hairline">
                    <div className="flex-1">
                      <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">{t('production', 'recipe_field_material')}</label>
                      <select className={inputCls} value={item.factoryMaterialId}
                        onChange={e => {
                          const m = materials.find(m => m.id === Number(e.target.value));
                          setItem(idx, 'factoryMaterialId', e.target.value);
                          if (m) setItem(idx, 'unit', m.unit);
                        }}>
                        <option value="">{t('production', 'recipe_select_material')}</option>
                        {materials.map(m => <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>)}
                      </select>
                    </div>
                    <div className="w-28">
                      <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">{t('production', 'recipe_field_quantity')}</label>
                      <input type="number" min="0" step="0.001" className={inputCls} value={item.standardQty}
                        onChange={e => setItem(idx, 'standardQty', e.target.value)} />
                    </div>
                    <div className="w-20">
                      <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">{t('production', 'recipe_field_unit')}</label>
                      <div className="px-3 py-2.5 bg-surface border border-hairline-2 rounded-xl text-sm text-muted font-medium">
                        {mat?.unit || item.unit || '—'}
                      </div>
                    </div>
                    <button onClick={() => removeItem(idx)}
                      className="p-2 text-muted hover:text-red-500 hover:bg-red-50 dark:bg-red-500/10 rounded-lg transition-colors mb-0.5">
                      <X size={15} />
                    </button>
                  </div>
                );
              })}
              {form.items.length === 0 && (
                <p className="text-xs text-muted italic text-center py-6">{t('production', 'recipe_no_materials_added')}</p>
              )}
            </div>
          </div>
        )}

        {/* ════════════ STEP 3: Các bước xử lý ════════════ */}
        {wizardStep === 3 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-ink uppercase tracking-wider flex items-center gap-1.5">
                <Clock size={13} /> {t('production', 'recipe_section_steps')}
              </span>
            </div>

            {/* Quick add from template */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {stepTemplates.map(tpl => (
                <button key={tpl.id} onClick={() => addStep(tpl)}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-canvas text-ink hover:bg-surface-2 border border-hairline transition-colors">
                  <Plus size={11} /> {tpl.name}
                </button>
              ))}
              <div className="flex items-center gap-1">
                <input className="px-2.5 py-1.5 text-xs rounded-lg border border-hairline-2 w-36"
                  placeholder={t('production', 'recipe_new_step_placeholder')} value={newStepName}
                  onChange={e => setNewStepName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); createStepTemplate(); } }} />
                <button onClick={createStepTemplate}
                  className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-chrome text-white hover:bg-black transition-colors">
                  {t('production', 'recipe_create_template')}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {form.steps.map((step_, idx) => (
                <div key={idx} className="bg-canvas rounded-xl p-3 border border-hairline">
                  <div className="flex gap-2 items-start">
                    <div className="flex flex-col gap-0.5 pt-1.5">
                      <span className="w-6 h-6 rounded-full bg-chrome text-white flex items-center justify-center text-xs font-bold">
                        {idx + 1}
                      </span>
                      <div className="flex flex-col">
                        <button disabled={idx === 0} onClick={() => moveStep(idx, -1)}
                          className="text-muted hover:text-ink disabled:opacity-30 text-[10px] leading-none">▲</button>
                        <button disabled={idx === form.steps.length - 1} onClick={() => moveStep(idx, 1)}
                          className="text-muted hover:text-ink disabled:opacity-30 text-[10px] leading-none">▼</button>
                      </div>
                    </div>

                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-4 gap-2">
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">{t('production', 'recipe_field_step_name')}</label>
                        <input className={inputCls} value={step_.stepName}
                          onChange={e => setStep(idx, 'stepName', e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">{t('production', 'recipe_field_duration')}</label>
                        <input type="number" min="1" className={inputCls} value={step_.durationMinutes}
                          onChange={e => setStep(idx, 'durationMinutes', e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">{t('production', 'recipe_field_machine')}</label>
                        <select className={inputCls} value={step_.machineId}
                          onChange={e => setStep(idx, 'machineId', e.target.value)}>
                          <option value="">{t('production', 'recipe_no_machine')}</option>
                          {machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                      </div>

                      {/* ── Loại kiểm soát: Không KS / Trực quan / Hình ảnh cân ký ── */}
                      <div className="sm:col-span-4">
                        <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">{t('production', 'recipe_field_control')}</label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                          {CONTROL_TYPES.map(ct => {
                            const active = (step_.controlType || 'NONE') === ct.value;
                            const Icon = ct.icon;
                            return (
                              <button key={ct.value} type="button" onClick={() => setStep(idx, 'controlType', ct.value)}
                                className={`text-left px-3 py-2 rounded-lg border transition-colors ${
                                  active ? 'border-gold bg-gold/10' : 'border-hairline-2 bg-surface hover:bg-surface-2'
                                }`}>
                                <span className={`flex items-center gap-1.5 text-xs font-semibold ${active ? 'text-gold-deep' : 'text-ink'}`}>
                                  {Icon ? <Icon size={13} className={active ? 'text-gold' : 'text-muted'} /> : <span className="w-[13px]" />}
                                  {ct.label}
                                </span>
                                <span className="block text-[10px] text-muted mt-0.5 leading-snug">{ct.desc}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* ── Bước chung / riêng + công suất mỗi lần ── */}
                      <div className="sm:col-span-4 border-t border-hairline pt-3">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input type="checkbox" className="w-4 h-4 accent-gold"
                            checked={!!step_.shared}
                            onChange={e => setStep(idx, 'shared', e.target.checked)} />
                          <span className="text-xs font-semibold text-ink">{t('production', 'recipe_field_shared')}</span>
                        </label>
                        <p className="text-[10px] text-muted mt-0.5 ml-6 leading-snug">{t('production', 'recipe_field_shared_hint')}</p>
                        {step_.shared && (
                          <div className="mt-2 ml-6">
                            <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">{t('production', 'recipe_field_capacity')}</label>
                            <input type="number" min="0" step="0.001" className={inputCls + ' max-w-[200px]'}
                              placeholder={t('production', 'recipe_field_capacity_ph')}
                              value={step_.capacityPerRun}
                              onChange={e => setStep(idx, 'capacityPerRun', e.target.value)} />
                            <p className="text-[10px] text-muted mt-0.5 leading-snug">{t('production', 'recipe_field_capacity_hint')}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <button onClick={() => removeStep(idx)}
                      className="p-2 text-muted hover:text-red-500 hover:bg-red-50 dark:bg-red-500/10 rounded-lg transition-colors">
                      <X size={15} />
                    </button>
                  </div>
                </div>
              ))}
              {form.steps.length === 0 && (
                <p className="text-xs text-muted italic text-center py-6">{t('production', 'recipe_no_steps_added')}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
