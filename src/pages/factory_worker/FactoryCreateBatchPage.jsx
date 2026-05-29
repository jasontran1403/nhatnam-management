import { useState, useEffect } from 'react';
import { CardSkeleton, Sk } from '../../components/ui/Skeleton.jsx';
import useMinLoading from '../../hooks/useMinLoading.js';
import { useNavigate } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import { factoryWorkerApi } from '../../api/productionApi';

import { Field, inputCls, LoadingSpinner, PrimaryButton } from '../../components/ui';
import { useLang } from '../../context/LangContext';

// CSS ẩn spinner mũi tên input number
const noSpinner = {
  MozAppearance: 'textfield',
};

function todayVN() {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// Đơn vị cho phép số lẻ (kg, lít, l, lit)
const DECIMAL_UNITS = ['kg', 'lít', 'lit', 'l', 'liter', 'litre'];

function isDecimalAllowed(unit = '') {
  return DECIMAL_UNITS.includes(unit.toLowerCase().trim());
}

// Xử lý nhập số theo đơn vị
function handleNumberInput(value, unit) {
  if (!value) return value;
  if (isDecimalAllowed(unit)) {
    // Cho phép số lẻ, tối đa 3 chữ số sau dấu phẩy
    const match = value.match(/^\d*\.?\d{0,3}/);
    return match ? match[0] : '';
  } else {
    // Chỉ nhập số nguyên
    return value.replace(/[^\d]/g, '');
  }
}

// ── Bước 1: Chọn công thức ────────────────────────────────────────────────────
function StepRecipe({ products, recipes, loadingRecipes, selectedProduct, selectedRecipe, onProductChange, onRecipeChange }) {
  const { t } = useLang();
  return (
    <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden flex flex-col min-h-[420px]">
      <div className="px-5 py-4 border-b border-black/5 bg-[#FAF7F2] flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-[#C9A84C] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">1</div>
        <h2 className="font-semibold text-[#1C1C1E] text-sm">{t('batch','select_formula')}</h2>
      </div>
      <div className="p-5 space-y-4 flex-1">
        <Field label={t('batch','finished_goods_label')} required>
          <select className={inputCls} value={selectedProduct} onChange={e => onProductChange(e.target.value)}>
            <option value="">-- Chọn thành phẩm --</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>)}
          </select>
        </Field>

        {selectedProduct && (
          <Field label={t('batch','formula_definition')} required>
            {loadingRecipes
              ? <p className="text-sm text-[#8E8878] py-2 animate-pulse">{t('common','loading')}</p>
              : (
                <select className={inputCls} value={selectedRecipe?.id || ''} onChange={e => onRecipeChange(e.target.value)}>
                  <option value="">{t('batch','select_formula')}</option>
                  {recipes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              )}
          </Field>
        )}

        {selectedRecipe && (
          <div className="bg-[#FAF7F2] border border-black/5 rounded-xl p-3 text-sm">
            <p className="font-semibold text-[#1C1C1E]">{selectedRecipe.name}</p>
            <p className="text-xs text-[#8E8878] mt-0.5">{selectedRecipe.factoryProductName}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Bước 2: Nhập NVL ─────────────────────────────────────────────────────────
function StepMaterials({ items, setItem }) {
  return (
    <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden flex flex-col min-h-[420px]">
      <div className="px-5 py-4 border-b border-black/5 bg-[#FAF7F2] flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-[#C9A84C] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">2</div>
        <h2 className="font-semibold text-[#1C1C1E] text-sm">Nguyên vật liệu đã dùng</h2>
      </div>
      <div className="p-5 flex-1">
        {items.length === 0 && (
          <p className="text-sm text-[#8E8878] italic text-center py-8">Chọn công thức ở bước 1 để hiển thị NVL</p>
        )}
        <div className="grid grid-cols-2 gap-2">
          {items.map((item, idx) => {
            const decimal = isDecimalAllowed(item.unit);
            return (
              <div key={idx} className="border border-black/5 rounded-xl p-3 bg-[#FAF7F2]">
                <p className="text-xs font-semibold text-[#1C1C1E] mb-2 truncate">{item.materialName}</p>
                <div className="flex gap-1.5 items-center">
                  <input
                    type="number"
                    inputMode={decimal ? 'decimal' : 'numeric'}
                    min="0"
                    step={decimal ? '0.001' : '1'}
                    className={inputCls + ' flex-1 min-w-0'}
                    style={noSpinner}
                    placeholder={decimal ? '0.000' : '0'}
                    value={item.actualQty}
                    onWheel={e => e.target.blur()}
                    onChange={e => setItem(idx, 'actualQty', handleNumberInput(e.target.value, item.unit))}
                  />
                  <span className="text-xs text-[#8E8878] font-medium whitespace-nowrap flex-shrink-0">{item.unit}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Bước 3: Thành phẩm thu được ───────────────────────────────────────────────
function StepOutput({ selectedRecipe, actualOutput, setActualOutput, notes, setNotes, producedAt, onSubmit, saving }) {
  const decimal = selectedRecipe ? isDecimalAllowed(selectedRecipe.outputUnit) : true;

  return (
    <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden flex flex-col min-h-[420px]">
      <div className="px-5 py-4 border-b border-black/5 bg-[#FAF7F2] flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-[#C9A84C] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">3</div>
        <h2 className="font-semibold text-[#1C1C1E] text-sm">Thành phẩm thu được</h2>
      </div>
      <div className="p-5 space-y-4 flex-1">
        {!selectedRecipe
          ? <p className="text-sm text-[#8E8878] italic text-center py-8">Chọn công thức ở bước 1</p>
          : (
            <>
              <Field label={`Sản lượng thực tế (${selectedRecipe.outputUnit})`} required>
                <input
                  type="number"
                  inputMode={decimal ? 'decimal' : 'numeric'}
                  min="0"
                  step={decimal ? '0.001' : '1'}
                  className={inputCls}
                  style={noSpinner}
                  placeholder={decimal ? 'VD: 29.5' : 'VD: 30'}
                  value={actualOutput}
                  onWheel={e => e.target.blur()}
                  onChange={e => setActualOutput(handleNumberInput(e.target.value, selectedRecipe.outputUnit))}
                />
              </Field>

              <div className="bg-[#FAF7F2] border border-black/5 rounded-xl px-4 py-3 flex items-center justify-between text-sm">
                <span className="text-[#8E8878]">Ngày sản xuất</span>
                <span className="font-semibold text-[#1C1C1E]">
                  {new Date(producedAt + 'T00:00:00').toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </span>
              </div>

              <Field label="Ghi chú">
                <textarea className={inputCls} rows={3}
                  placeholder="Ghi chú thêm về mẻ sản xuất..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)} />
              </Field>
            </>
          )}
      </div>

      {selectedRecipe && (
        <div className="px-5 py-4 border-t border-black/5 bg-[#FAF7F2]/50">
          <PrimaryButton
            onClick={onSubmit}
            loading={saving}
            disabled={!actualOutput}
            className="w-full justify-center">
            Lưu mẻ sản xuất
          </PrimaryButton>
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function FactoryCreateBatchPage() {
  const { t } = useLang();
  const navigate = useNavigate();
  const [products, setProducts]             = useState([]);
  const [recipes, setRecipes]               = useState([]);
  const [loadingRecipes, setLoadingRecipes] = useMinLoading();
  const [loadingInit, setLoadingInit] = useMinLoading();

  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedRecipe, setSelectedRecipe]   = useState(null);
  const [actualOutput, setActualOutput]       = useState('');
  const [producedAt]                          = useState(todayVN);
  const [notes, setNotes]                     = useState('');
  const [items, setItems]                     = useState([]);
  const [saving, setSaving]                   = useState(false);
  const [success, setSuccess]                 = useState(false);

  useEffect(() => {
    factoryWorkerApi.listProducts()
      .then(p => setProducts(p || []))
      .finally(() => setLoadingInit(false));
  }, []);

  const onProductChange = async (productId) => {
    setSelectedProduct(productId);
    setSelectedRecipe(null);
    setItems([]);
    setRecipes([]);
    if (!productId) return;
    setLoadingRecipes(true);
    try {
      setRecipes(await factoryWorkerApi.listRecipes(productId) || []);
    } finally { setLoadingRecipes(false); }
  };

  const onRecipeChange = (recipeId) => {
    if (!recipeId) { setSelectedRecipe(null); setItems([]); return; }
    const found = recipes.find(r => r.id === Number(recipeId));
    if (!found) return;
    setSelectedRecipe(found);
    setActualOutput('');
    setItems((found.items || []).map(i => ({
      factoryMaterialId: i.factoryMaterialId,
      materialName:      i.materialName,
      standardQty:       i.standardQty,
      unit:              i.unit,
      actualQty:         '',
      sortOrder:         i.sortOrder,
    })));
  };

  const setItem = (idx, k, v) =>
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [k]: v } : it));

  const submit = async () => {
    if (!selectedRecipe || !actualOutput) return;
    setSaving(true);
    try {
      const [y, m, d] = producedAt.split('-').map(Number);
      const epochMs = new Date(y, m - 1, d, 7, 0, 0).getTime();
      await factoryWorkerApi.createBatch({
        recipeId:        selectedRecipe.id,
        actualOutputQty: Number(actualOutput),
        producedAt:      epochMs,
        notes,
        items: items.map(it => ({
          factoryMaterialId: it.factoryMaterialId,
          actualQty:         Number(it.actualQty),
          unit:              it.unit,
          sortOrder:         it.sortOrder,
        })),
      });
      setSuccess(true);
      setTimeout(() => navigate('/factory/history'), 1800);
    } finally { setSaving(false); }
  };

  if (loadingInit) return <div className="p-8"><CardSkeleton lines={4} /></div>;

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-8">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
          <CheckCircle size={36} className="text-emerald-600" />
        </div>
        <h2 className="text-xl font-bold text-[#1C1C1E]">Đã ghi nhận mẻ sản xuất!</h2>
        <p className="text-sm text-[#8E8878]">Đang chuyển về lịch sử...</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#1C1C1E]" style={{ fontFamily: 'var(--font-display)' }}>
          Nhập mẻ sản xuất
        </h1>
        <p className="text-sm text-[#8E8878] mt-1">Ghi nhận nguyên liệu đã dùng và thành phẩm thu được</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
        <StepRecipe
          products={products}
          recipes={recipes}
          loadingRecipes={loadingRecipes}
          selectedProduct={selectedProduct}
          selectedRecipe={selectedRecipe}
          onProductChange={onProductChange}
          onRecipeChange={onRecipeChange}
        />
        <StepMaterials items={items} setItem={setItem} />
        <StepOutput
          selectedRecipe={selectedRecipe}
          actualOutput={actualOutput}
          setActualOutput={setActualOutput}
          notes={notes}
          setNotes={setNotes}
          producedAt={producedAt}
          onSubmit={submit}
          saving={saving}
        />
      </div>
    </div>
  );
}