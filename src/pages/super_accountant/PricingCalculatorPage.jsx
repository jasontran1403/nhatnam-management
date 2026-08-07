import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
    Calculator, Plus, Trash2, Search, Package, Percent, Tag, Wand2,
} from 'lucide-react';
import { pricingApi } from '../../api/accountantApi';
import { useToast } from '../../components/common/Toast';
import useDebounce from '../../utils/useDebounce.js';
import { useLang } from '../../context/LangContext';
import { formatVN, formatVNInput, parseVN, roundHalfUp } from '../../utils/vnNumber';
import {
    PageHeader, SectionCard, SectionHeader, PrimaryButton, SecondaryButton,
    Field, inputCls, selectCls, EmptyState,
} from '../../components/ui';

// BASIS_OPTIONS moved inside component

/* Input số theo chuẩn VN (ngăn cách nghìn ".", thập phân ",") */
function VNInput({ value, onChange, decimals = 0, className, ...props }) {
    return (
        <input
            inputMode="decimal"
            value={value}
            onChange={(e) => onChange(formatVNInput(e.target.value, decimals))}
            className={className || inputCls}
            {...props}
        />
    );
}

/* ── Dropdown tìm nguyên liệu ─────────────────────────────────────────────── */
function IngredientSelect({ value, onChange }) {
    const { t } = useLang();
    const BASIS_OPTIONS = useMemo(() => [
        { value: 'value', label: t('production','pcalc_basis_value') },
        { value: 'quantity', label: t('production','pcalc_basis_quantity') },
        { value: 'equal', label: t('production','pcalc_basis_equal') },
    ], [t]);
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState('');
    const debouncedQ = useDebounce(q, 350);
    const [options, setOptions] = useState([]);
    const [loading, setLoading] = useState(false);
    const boxRef = useRef(null);
    const btnRef = useRef(null);
    const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

    const updatePos = () => {
        if (!btnRef.current) return;
        const r = btnRef.current.getBoundingClientRect();
        setPos({
            top: r.bottom + 6,
            left: r.left,
            width: r.width,
        });
    };

    useEffect(() => {
        if (!open) return;
        updatePos();
        window.addEventListener('scroll', updatePos, true);
        window.addEventListener('resize', updatePos);
        return () => {
            window.removeEventListener('scroll', updatePos, true);
            window.removeEventListener('resize', updatePos);
        };
    }, [open]);

    useEffect(() => {
        if (!open) return;
        let alive = true;
        setLoading(true);
        pricingApi.searchIngredients(debouncedQ)
            .then((res) => { if (alive) setOptions(res || []); })
            .catch(() => { if (alive) setOptions([]); })
            .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, [debouncedQ, open]);

    useEffect(() => {
        const onDoc = (e) => {
            if (boxRef.current && boxRef.current.contains(e.target)) return;
            setOpen(false);
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, []);

    return (
        <div className="relative" ref={boxRef}>
            <button
                ref={btnRef}
                type="button"
                onClick={() => setOpen((o) => !o)}
                className={`${inputCls} flex items-center justify-between text-left`}
            >
                <span className={value ? 'text-ink truncate' : 'text-muted'}>
                    {value ? `${value.name}${value.unit ? ` (${value.unit})` : ''}` : t('production','mps_select_product')}
                </span>
                <Search size={15} className="text-muted shrink-0" />
            </button>

            {open && (
                <div
                    style={{
                        position: 'fixed',
                        top: pos.top,
                        left: pos.left,
                        width: pos.width,
                        zIndex: 9999,
                    }}
                    className="bg-surface rounded-xl shadow-lg border border-line overflow-hidden"
                >
                    <div className="p-2 border-b border-line-soft">
                        <input
                            autoFocus
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder={t('production','pcalc_search_ph')}
                            className={inputCls}
                        />
                    </div>

                    <div className="max-h-60 overflow-auto">
                        {loading && <p className="px-3 py-3 text-sm text-muted">{t('production','pcalc_searching')}</p>}

                        {!loading && options.length === 0 && (
                            <p className="px-3 py-3 text-sm text-muted">{t('production','pcalc_no_results')}</p>
                        )}

                        {!loading && options.map((o) => (
                            <button
                                key={o.id}
                                type="button"
                                onClick={() => {
                                    onChange(o);
                                    setOpen(false);
                                    setQ('');
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-canvas flex items-center gap-2"
                            >
                                <Package size={14} className="text-gold shrink-0" />
                                <span className="text-sm text-ink flex-1 truncate">{o.name}</span>
                                {o.unit && <span className="text-xs text-muted">{o.unit}</span>}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

/* ── Combobox tên chi phí: chọn nhãn đã lưu hoặc tạo mới ───────────────────── */
function CostLabelInput({ value, onChange, labels, onCreate }) {
    const { t } = useLang();
    const [open, setOpen] = useState(false);
    const boxRef = useRef(null);
    const inputRef = useRef(null);
    const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

    const updatePos = () => {
        if (!inputRef.current) return;
        const r = inputRef.current.getBoundingClientRect();
        setPos({
            top: r.bottom + 6,
            left: r.left,
            width: r.width,
        });
    };

    useEffect(() => {
        if (!open) return;
        updatePos();

        window.addEventListener('scroll', updatePos, true);
        window.addEventListener('resize', updatePos);

        return () => {
            window.removeEventListener('scroll', updatePos, true);
            window.removeEventListener('resize', updatePos);
        };
    }, [open]);

    useEffect(() => {
        const onDoc = (e) => {
            if (boxRef.current && boxRef.current.contains(e.target)) return;
            setOpen(false);
        };

        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, []);

    const kw = (value || '').trim().toLowerCase();
    const filtered = labels.filter((l) => !kw || l.name.toLowerCase().includes(kw));
    const exactExists = labels.some((l) => l.name.toLowerCase() === kw);

    return (
        <div className="relative flex-1 min-w-0" ref={boxRef}>
            <div className="flex items-center gap-1">
                <Tag size={14} className="text-gold shrink-0" />

                <input
                    ref={inputRef}
                    value={value}
                    onFocus={() => setOpen(true)}
                    onChange={(e) => {
                        onChange(e.target.value);
                        setOpen(true);
                    }}
                    className={inputCls}
                    placeholder={t('production','pcalc_overhead_name')}
                />
            </div>

            {open && (filtered.length > 0 || (kw && !exactExists)) && (
                <div
                    style={{
                        position: 'fixed',
                        top: pos.top,
                        left: pos.left,
                        width: pos.width,
                        zIndex: 9999,
                    }}
                    className="bg-surface rounded-xl shadow-lg border border-line overflow-hidden"
                >
                    <div className="max-h-48 overflow-auto">
                        {filtered.map((l) => (
                            <button
                                key={l.id}
                                type="button"
                                onClick={() => {
                                    onChange(l.name);
                                    setOpen(false);
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-canvas text-sm text-ink"
                            >
                                {l.name}
                            </button>
                        ))}

                        {kw && !exactExists && (
                            <button
                                type="button"
                                onClick={async () => {
                                    const c = await onCreate(value.trim());
                                    if (c) onChange(c.name);
                                    setOpen(false);
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-canvas text-sm text-gold flex items-center gap-1 border-t border-line-soft"
                            >
                                <Plus size={14} /> Tạo nhãn "{value.trim()}"
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

let _rid = 0;
const newIngredientRow = () => ({
    key: `ing_${++_rid}`, ingredient: null, quantity: '',
    priceMode: 'total', priceValue: '', taxableAmount: '', taxRate: '',
});
const newCostRow = () => ({ key: `cost_${++_rid}`, label: '', amount: '', basis: 'value' });

const formatVNTrimDecimal = (value, maxDecimals = 3) => {
    const num = Number(value || 0);

    if (!Number.isFinite(num)) return '0';

    const fixed = num.toFixed(maxDecimals);

    const trimmed = fixed
        .replace(/\.?0+$/, '');

    const [intPart, decimalPart] = trimmed.split('.');

    const formattedInt = Number(intPart).toLocaleString('vi-VN');

    return decimalPart
        ? `${formattedInt},${decimalPart}`
        : formattedInt;
};

export default function PricingCalculatorPage() {
    const { t } = useLang();
    const toast = useToast();
    const [rows, setRows] = useState([newIngredientRow()]);
    const [costs, setCosts] = useState([]);
    const [margin, setMargin] = useState('');
    const [labels, setLabels] = useState([]);
    const [result, setResult] = useState(null);

    useEffect(() => { pricingApi.getCostLabels().then((r) => setLabels(r || [])).catch(() => { }); }, []);

    const patchRow = (key, patch) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    const removeRow = (key) => setRows((rs) => rs.filter((r) => r.key !== key));

    /* Thành tiền mua của 1 dòng (full precision) */
    const buyingCostOf = useCallback((r) => {
        const qty = parseVN(r.quantity);
        if (r.priceMode === 'total') return parseVN(r.priceValue);
        return parseVN(r.priceValue) * qty; // đơn giá (tối đa 3 số lẻ) * số lượng
    }, []);

    const fillTaxable = (r) =>
        patchRow(r.key, { taxableAmount: formatVN(roundHalfUp(buyingCostOf(r))) });

    const patchCost = (key, patch) => setCosts((cs) => cs.map((c) => (c.key === key ? { ...c, ...patch } : c)));
    const removeCost = (key) => setCosts((cs) => cs.filter((c) => c.key !== key));

    const createLabel = async (name) => {
        const t = (name || '').trim();
        if (!t) return null;
        const existing = labels.find((l) => l.name.toLowerCase() === t.toLowerCase());
        if (existing) return existing;
        try {
            const created = await pricingApi.createCostLabel(t);
            if (created) setLabels((ls) => [...ls, created].sort((a, b) => a.name.localeCompare(b.name)));
            return created;
        } catch {
            toast(t('production','pcalc_err_label'), 'error');
            return null;
        }
    };

    const compute = () => {
        const valid = rows.filter((r) => r.ingredient && parseVN(r.quantity) > 0);
        if (valid.length === 0) { toast(t('production','pcalc_err_need_ingredient'), 'error'); return; }

        const items = valid.map((r) => {
            const qty = parseVN(r.quantity);
            const buying = buyingCostOf(r);
            // Đơn giá mua: giữ full precision, hiển thị 3 số lẻ (KHÔNG làm tròn).
            const unitBuy = r.priceMode === 'total' ? (qty > 0 ? buying / qty : 0) : parseVN(r.priceValue);
            const tax = roundHalfUp(parseVN(r.taxableAmount) * parseVN(r.taxRate) / 100);
            return {
                key: r.key, name: r.ingredient.name, unit: r.ingredient.unit,
                qty, buying, unitBuy, tax, allocated: 0
            };
        });

        const totalQty = items.reduce((s, it) => s + it.qty, 0);
        const totalValue = items.reduce((s, it) => s + it.buying, 0);
        const n = items.length;

        costs.forEach((c) => {
            const amount = parseVN(c.amount);
            if (amount <= 0) return;
            items.forEach((it) => {
                let share = 0;
                if (c.basis === 'quantity') share = totalQty > 0 ? amount * it.qty / totalQty : 0;
                else if (c.basis === 'equal') share = amount / n;
                else share = totalValue > 0 ? amount * it.buying / totalValue : 0;
                it.allocated += roundHalfUp(share);
            });
        });

        const m = parseVN(margin);
        const detail = items.map((it) => {
            const totalCost = roundHalfUp(it.buying) + it.tax + it.allocated;
            const unitCost = it.qty > 0 ? roundHalfUp(totalCost / it.qty) : 0;
            const sellUnit = roundHalfUp(unitCost * (1 + m / 100));
            return { ...it, totalCost, unitCost, sellUnit };
        });

        setResult({
            detail, margin: m, totalQty, totalValue,
            totalTax: detail.reduce((s, it) => s + it.tax, 0),
            totalAllocated: detail.reduce((s, it) => s + it.allocated, 0),
        });
    };

    return (
        <div className="p-4 md:p-6 space-y-5">
            <PageHeader icon={Calculator} title={t('production','pcalc_title')}
                subtitle={t('production','pcalc_subtitle')} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
                {/* ── CỘT TRÁI: nhập liệu ── */}
                <div className="space-y-5">
                    <SectionCard>
                        <SectionHeader title={t('production','pcalc_ingredients')}
                            action={<SecondaryButton onClick={() => setRows((rs) => [...rs, newIngredientRow()])}>
                                <Plus size={15} />{t('common','add')}</SecondaryButton>} />
                        <div className="space-y-4 mt-3">
                            {rows.map((r, idx) => (
                                <div key={r.key} className="rounded-xl border border-line-soft p-3 bg-canvas">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-semibold text-muted">Nguyên liệu #{idx + 1}</span>
                                        {rows.length > 1 && (
                                            <button onClick={() => removeRow(r.key)} className="text-red-400 hover:text-red-600 dark:text-red-300">
                                                <Trash2 size={15} /></button>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <Field label={t('production','pcalc_ingredients')}>
                                            <IngredientSelect value={r.ingredient} onChange={(ing) => patchRow(r.key, { ingredient: ing })} />
                                        </Field>
                                        <Field label={`{t('production','pcalc_qty')}${r.ingredient?.unit ? ` (${r.ingredient.unit})` : ''}`}>
                                            <VNInput value={r.quantity} decimals={3}
                                                onChange={(v) => patchRow(r.key, { quantity: v })} placeholder="VD: 1.000" />
                                        </Field>
                                        <Field label={t('production','pcalc_buy_price')}>
                                            <div className="flex gap-2">
                                                <div className="basis-[30%] shrink-0">
                                                    <select
                                                        value={r.priceMode}
                                                        onChange={(e) =>
                                                            patchRow(r.key, {
                                                                priceMode: e.target.value,
                                                                priceValue: '',
                                                            })
                                                        }
                                                        className={selectCls + ' w-full'}
                                                    >
                                                        <option value="total">{t('production','pcalc_total')}</option>
                                                        <option value="unit">{t('production','pcalc_unit_price')}</option>
                                                    </select>
                                                </div>

                                                <div className="basis-[70%] grow">
                                                    <VNInput
                                                        value={r.priceValue}
                                                        decimals={r.priceMode === 'unit' ? 3 : 0}
                                                        onChange={(v) =>
                                                            patchRow(r.key, {
                                                                priceValue: v,
                                                            })
                                                        }
                                                        className={inputCls + ' w-full'}
                                                        placeholder={
                                                            r.priceMode === 'total'
                                                                ? t('production','pcalc_lot_total')
                                                                : t('production','pcalc_ph_unit_price')
                                                        }
                                                    />
                                                </div>
                                            </div>

                                            {r.priceMode === 'total' &&
                                                parseVN(r.quantity) > 0 &&
                                                parseVN(r.priceValue) > 0 && (
                                                    <p className="text-[11px] text-muted mt-1">
                                                        {t('production','pcalc_unit_price')} ≈{' '}
                                                        {formatVN(
                                                            parseVN(r.priceValue) / parseVN(r.quantity),
                                                            3,
                                                            3
                                                        )}{' '}
                                                        / {r.ingredient?.unit || t('production','pcalc_unit_fallback')}
                                                    </p>
                                                )}
                                        </Field>

                                        <Field label={t('production','pcalc_ingredient_tax')}>
                                            <div className="flex gap-2 items-start">

                                                {/* Giá tính thuế */}
                                                <div className="flex-1">
                                                    <div className="flex gap-2">

                                                        <VNInput
                                                            value={r.taxableAmount}
                                                            decimals={0}
                                                            onChange={(v) =>
                                                                patchRow(r.key, {
                                                                    taxableAmount: v,
                                                                })
                                                            }
                                                            className={inputCls + ' flex-1'}
                                                            placeholder={t('production','pcalc_price_with_tax')}
                                                        />

                                                        <button
                                                            type="button"
                                                            title={t('production','pcalc_copy_buy_price')}
                                                            onClick={() => fillTaxable(r)}
                                                            className="
                        h-11
                        w-11
                        rounded-xl
                        border
                        border-line
                        bg-surface
                        hover:bg-canvas
                        flex
                        items-center
                        justify-center
                        text-gold
                        shrink-0
                    "
                                                        >
                                                            <Wand2 size={16} />
                                                        </button>

                                                    </div>
                                                </div>

                                                {/* % thuế */}
                                                <div className="w-24 shrink-0">
                                                    <div className="relative">
                                                        <VNInput
                                                            value={r.taxRate}
                                                            decimals={2}
                                                            onChange={(v) =>
                                                                patchRow(r.key, {
                                                                    taxRate: v,
                                                                })
                                                            }
                                                            className={inputCls + ' pr-7'}
                                                            placeholder="%"
                                                        />

                                                        <Percent
                                                            size={14}
                                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted"
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            <p className="text-[11px] text-muted mt-1">
                                                Nhấn <Wand2 size={12} className="inline mx-1" />
                                                để tự động lấy giá mua làm giá tính thuế.
                                            </p>
                                        </Field>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </SectionCard>

                    <SectionCard>
                        <SectionHeader title={t('production','pcalc_overhead')}
                            action={<SecondaryButton onClick={() => setCosts((cs) => [...cs, newCostRow()])}>
                                <Plus size={15} />{t('common','add')}</SecondaryButton>} />
                        <div className="px-5 pt-4 pb-5">
                            <p className="text-xs text-muted mt-1">
                                VD: phí kho bãi, lưu kho, vận chuyển, hải quan... Mỗi dòng chọn cơ sở phân bổ riêng (mặc định theo giá trị).
                            </p>
                            <div className="space-y-2 mt-3">
                                {costs.length === 0 && <p className="text-sm text-muted italic">{t('production','pcalc_no_overhead')}</p>}
                                {costs.map((c) => (
                                    <div key={c.key} className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                                        <CostLabelInput value={c.label} labels={labels}
                                            onChange={(v) => patchCost(c.key, { label: v })} onCreate={createLabel} />
                                        <VNInput value={c.amount} decimals={0}
                                            onChange={(v) => patchCost(c.key, { amount: v })}
                                            className={inputCls + ' sm:w-40 min-w-0'} placeholder={t('production','pcalc_amount')} />
                                        <select value={c.basis} onChange={(e) => patchCost(c.key, { basis: e.target.value })}
                                            className={selectCls + ' sm:w-44 shrink-0'}>
                                            {BASIS_OPTIONS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
                                        </select>
                                        <button onClick={() => removeCost(c.key)} className="text-red-400 hover:text-red-600 dark:text-red-300 self-center px-1">
                                            <Trash2 size={15} /></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </SectionCard>

                    <SectionCard>
                        <SectionHeader title={t('production','pcalc_margin_pct')} />

                        <div className="px-5 pt-4 pb-5">
                            <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                                <div className="sm:w-64">
                                    <div className="relative">
                                        <VNInput
                                            value={margin}
                                            decimals={2}
                                            onChange={setMargin}
                                            className={inputCls + ' pr-8 py-2.5'}
                                            placeholder="VD: 20"
                                        />
                                        <Percent
                                            size={14}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted"
                                        />
                                    </div>
                                </div>

                                <div className="flex-1" />

                                <PrimaryButton onClick={compute} className="px-6 py-2.5">
                                    <Calculator size={16} />{t('production','pcalc_calculate')}
                                </PrimaryButton>
                            </div>
                        </div>
                    </SectionCard>
                </div>

                {/* ── CỘT PHẢI: preview ── */}
                <div className="lg:sticky lg:top-4">
                    <SectionCard className="border-gold/40">
                        <SectionHeader title={t('production','pcalc_results')} />
                        {!result ? (
                            <div className="py-10">
                                <EmptyState icon={Calculator} title={t('production','pcalc_no_result')}
                                    description={t('production','pcalc_result_hint')} />
                            </div>
                        ) : (
                            <>
                                <div className="mt-3 space-y-3">
                                    {result.detail.map((it) => (
                                        <div key={it.key} className="rounded-xl border border-line-soft p-4 bg-canvas">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="font-semibold text-ink">{it.name}</span>
                                                <span className="text-xs text-muted">{formatVN(it.qty, 3)} {it.unit || t('production','pcalc_unit_fallback')}</span>
                                            </div>
                                            <div className="space-y-1 text-sm">
                                                <Line label={t('production','pcalc_total')} value={formatVN(roundHalfUp(it.buying))} />
                                                <Line label={t('production','pcalc_unit_price')} value={formatVNTrimDecimal(it.unitBuy, 3)} suffix={`/ ${it.unit || t('production','pcalc_unit_fallback')}`} />
                                                <Line label={t('production','pcalc_tax')} value={formatVN(it.tax)} />
                                                <Line label={t('production','pcalc_overhead_alloc')} value={formatVN(it.allocated)} />
                                                <div className="border-t border-line-soft my-1" />
                                                <Line label={t('production','pcalc_total_cost')} value={formatVN(it.totalCost)} strong />
                                                <Line label={t('production','pcalc_cogs_per_unit')} value={formatVN(it.unitCost)} suffix={`/ ${it.unit || t('production','pcalc_unit_fallback')}`} strong />
                                                <div className="mt-2 rounded-lg bg-gold/10 px-3 py-2 flex items-center justify-between">
                                                    <span className="text-gold-deep font-semibold text-sm">{t('production','pcalc_sell_price_per_unit')}</span>
                                                    <span className="text-gold-deep font-bold">{formatVN(it.sellUnit)} đ</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </SectionCard>
                </div>
            </div>
        </div>
    );
}

function Line({ label, value, suffix, strong }) {
    const { t } = useLang();
    return (
        <div className="flex items-center justify-between">
            <span className={strong ? 'text-ink font-medium' : 'text-muted'}>{label}</span>
            <span className={strong ? 'text-ink font-semibold' : 'text-ink-2'}>
                {value}{suffix ? <span className="text-muted text-xs ml-1">{suffix}</span> : null}
            </span>
        </div>
    );
}

function Summary({ label, value }) {
    const { t } = useLang();
    return (
        <div className="rounded-xl border border-line-soft p-3 bg-surface">
            <p className="text-[11px] text-muted">{label}</p>
            <p className="text-ink font-semibold mt-0.5">{value}</p>
        </div>
    );
}