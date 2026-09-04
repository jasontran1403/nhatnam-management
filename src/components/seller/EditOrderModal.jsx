// src/components/seller/EditOrderModal.jsx
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  X, Plus, Trash2, Save, AlertTriangle, Search,
  Grid, ChevronRight, Package, Loader2, Pencil, Percent,
  Check, Gift, ChevronDown, User, Clock, CreditCard, MapPin,
  UserCheck, UserPlus, Building2, Bell,
} from 'lucide-react';
import { orderApi, productApi, categoryApi } from '../../api/services';
import api from '../../api/axios';
import { useToast } from '../common/Toast';
import useWebSocket from '../../hooks/useWebSocket';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

function fmt(n) {
  return new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n || 0) + ' đ';
}
function calcNet(unitPrice, vatRate, vatMode) {
  const r = vatRate ?? 0;
  if (r === 0) return Number(unitPrice);
  if ((vatMode ?? 'INCLUSIVE') === 'INCLUSIVE') return Number(unitPrice) / (1 + r / 100);
  return Number(unitPrice);
}
function tsToDatetimeLocal(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function datetimeLocalToTs(str) {
  if (!str) return null;
  return new Date(str).getTime();
}

const EXCLUSIVE_VAT = [0, 5, 8, 10, 12];
const PAYMENT_METHODS = [
  { value: 'CASH', label: '💵 Tiền mặt' },
  { value: 'BANK_TRANSFER', label: '🏦 Chuyển khoản' },
  { value: 'DEBT', label: '📋 Công nợ' },
];

// ── CustomerSearchModal ───────────────────────────────────────────────────────
function CustomerSearchModal({ open, onClose, onSelect, selected }) {
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [customers, setCustomers] = useState([]);
  const [receiverInfos, setReceiverInfos] = useState([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [loadingReceivers, setLoadingReceivers] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const searchRef = useRef(null);

  useEffect(() => {
    if (open) {
      setQ('');
      setDebouncedQ('');
      setSelectedCustomer(null);
      setReceiverInfos([]);
      setTimeout(() => searchRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    if (!open) return;
    setLoadingCustomers(true);
    const params = { page: 0, size: 50 };
    if (debouncedQ.trim()) params.search = debouncedQ.trim();
    api.get('/api/seller/customers/b2b', { params })
      .then(res => {
        const data = res.data?.data;
        const list = data?.content ?? data ?? [];
        setCustomers(Array.isArray(list) ? list : []);
      })
      .catch(() => setCustomers([]))
      .finally(() => setLoadingCustomers(false));
  }, [open, debouncedQ]);

  const handleSelectCustomer = async (customer) => {
    setSelectedCustomer(customer);
    setLoadingReceivers(true);
    try {
      const res = await api.get(`/api/seller/customers/${customer.id}/receiver-infos`);
      const list = res.data?.data ?? [];
      setReceiverInfos(Array.isArray(list) ? list : []);
    } catch {
      setReceiverInfos([]);
    } finally {
      setLoadingReceivers(false);
    }
  };

  const handleConfirm = (receiver = null) => {
    if (!selectedCustomer) return;
    onSelect({
      ...selectedCustomer,
      selectedReceiver: receiver,
    });
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50">
      <div className="bg-surface w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-line-soft shrink-0">
          <h3 className="font-bold text-ink text-sm">
            {selectedCustomer ? 'Chọn địa chỉ nhận hàng' : 'Tìm khách hàng'}
          </h3>
          <div className="flex items-center gap-2">
            {selectedCustomer && (
              <button
                onClick={() => { setSelectedCustomer(null); setReceiverInfos([]); }}
                className="text-[11px] text-gold font-semibold hover:underline"
              >
                ← Quay lại
              </button>
            )}
            <button onClick={onClose} className="p-1.5 text-muted hover:text-red-400 rounded-xl">
              <X size={16} />
            </button>
          </div>
        </div>

        {!selectedCustomer ? (
          <>
            <div className="px-4 py-2 shrink-0 border-b border-line-soft">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  ref={searchRef}
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  placeholder="Tìm theo tên, mã, SĐT..."
                  className="w-full pl-8 pr-3 py-2 text-sm border border-line rounded-xl outline-none focus:border-gold"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {loadingCustomers ? (
                <div className="flex items-center justify-center py-10 gap-2 text-muted">
                  <Loader2 size={18} className="animate-spin" />
                  <span className="text-sm">Đang tải...</span>
                </div>
              ) : customers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-muted gap-2">
                  <Search size={28} strokeWidth={1} />
                  <p className="text-sm">Không tìm thấy khách hàng</p>
                </div>
              ) : (
                <div className="px-2 py-2 space-y-0.5">
                  {customers.map(c => {
                    const isSelected = selected?.id === c.id;
                    const isCompany = c.customerType === 'COMPANY';
                    return (
                      <button
                        key={c.id}
                        onClick={() => handleSelectCustomer(c)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors group
                          ${isSelected ? 'bg-gold/10 border border-gold/30' : 'hover:bg-gold-tint'}`}
                      >
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0
                          ${isCompany ? 'bg-blue-50 dark:bg-blue-500/10' : 'bg-surface-2'}`}>
                          {isCompany
                            ? <Building2 size={16} className="text-blue-500" />
                            : <User size={16} className="text-faint" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-ink truncate">
                            {c.contactName || c.name || c.companyName || 'Khách vãng lai'}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span className="text-[10px] text-muted">{c.customerCode}</span>
                            {c.phone && <span className="text-[10px] text-muted">· {c.phone}</span>}
                            {isCompany && (
                              <span className="text-[9px] bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-300 px-1.5 py-0.5 rounded-full font-semibold">
                                Công ty
                              </span>
                            )}
                            {isSelected && (
                              <span className="text-[9px] bg-gold/20 text-gold px-1.5 py-0.5 rounded-full font-semibold">
                                Đang chọn
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronRight size={14} className="text-faint group-hover:text-gold shrink-0" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {/* Thông tin khách đã chọn */}
            <div className="px-4 pt-3 pb-2 bg-gold-tint border-b border-line-soft">
              <div className="flex items-center gap-2">
                <UserCheck size={14} className="text-gold" />
                <div>
                  <p className="text-sm font-semibold text-ink">
                    {selectedCustomer.contactName || selectedCustomer.name || selectedCustomer.companyName}
                  </p>
                  <p className="text-[10px] text-muted">
                    {selectedCustomer.customerCode}
                    {selectedCustomer.phone && ` · ${selectedCustomer.phone}`}
                  </p>
                </div>
              </div>
            </div>

            {/* Không có địa chỉ nhận */}
            <button
              onClick={() => handleConfirm(null)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gold-tint text-left border-b border-line-soft transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-surface-2 flex items-center justify-center shrink-0">
                <UserCheck size={14} className="text-muted" />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink">Không chọn địa chỉ nhận</p>
                <p className="text-[10px] text-muted">Dùng thông tin khách hàng</p>
              </div>
            </button>

            {/* Danh sách địa chỉ nhận */}
            {loadingReceivers ? (
              <div className="flex items-center justify-center py-8 gap-2 text-muted">
                <Loader2 size={16} className="animate-spin" />
                <span className="text-sm">Đang tải địa chỉ...</span>
              </div>
            ) : receiverInfos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted gap-1">
                <MapPin size={24} strokeWidth={1} />
                <p className="text-sm">Không có địa chỉ nhận</p>
              </div>
            ) : (
              <div className="px-2 py-2 space-y-0.5">
                {receiverInfos.map((r, idx) => (
                  <button
                    key={r.id}
                    onClick={() => handleConfirm(r)}
                    className="w-full flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-gold-tint text-left transition-colors group"
                  >
                    <div className="w-7 h-7 rounded-full bg-surface-2 flex items-center justify-center shrink-0 mt-0.5">
                      <MapPin size={12} className="text-faint" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {r.receiverName && (
                          <p className="text-xs font-semibold text-ink">{r.receiverName}</p>
                        )}
                        {r.isDefault && (
                          <span className="text-[9px] bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 px-1.5 py-0.5 rounded-full font-semibold">
                            Mặc định
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-ink-2 mt-0.5 truncate">{r.receiverAddress}</p>
                      {r.receiverPhone && (
                        <p className="text-[10px] text-muted">{r.receiverPhone}</p>
                      )}
                    </div>
                    <Check size={14} className="text-faint group-hover:text-gold shrink-0 mt-1" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="px-4 py-3 border-t border-line-soft shrink-0 text-center">
          <p className="text-[11px] text-muted">
            {selectedCustomer
              ? `${receiverInfos.length} địa chỉ nhận · Nhấn để chọn`
              : `${customers.length} khách hàng`}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── SurchargePanel ────────────────────────────────────────────────────────────
function SurchargePanel({ surchargeItems, onChange }) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customAmount, setCustomAmount] = useState('');

  const PRESET_SURCHARGE_TYPES = [
    { name: 'Thùng xốp', amount: 20000 },
    { name: 'Phí vận chuyển', amount: 30000 },
    { name: 'Gửi xe', amount: 10000 },
    { name: 'Đá khô', amount: 15000 },
  ];

  const addPreset = (preset) => {
    if (surchargeItems.find(i => i.name === preset.name)) return;
    onChange([...surchargeItems, { name: preset.name, amount: preset.amount }]);
    setShowAddForm(false);
  };

  const addCustom = () => {
    const name = customName.trim();
    const amount = parseInt(customAmount.replace(/[^0-9]/g, ''), 10) || 0;
    if (!name) return;
    if (surchargeItems.find(i => i.name === name)) {
      setCustomName(''); setCustomAmount(''); return;
    }
    onChange([...surchargeItems, { name, amount }]);
    setCustomName(''); setCustomAmount(''); setShowAddForm(false);
  };

  const updateAmount = (name, rawValue) => {
    const num = rawValue === '' ? 0 : parseInt(String(rawValue).replace(/[^0-9]/g, ''), 10) || 0;
    if (num === 0) onChange(surchargeItems.filter(i => i.name !== name));
    else onChange(surchargeItems.map(i => i.name === name ? { ...i, amount: num } : i));
  };

  const removeItem = (name) => onChange(surchargeItems.filter(i => i.name !== name));
  const addedNames = new Set(surchargeItems.map(i => i.name));
  const availablePresets = PRESET_SURCHARGE_TYPES.filter(p => !addedNames.has(p.name));

  return (
    <div className="space-y-2">
      {surchargeItems.map(item => (
        <div key={item.name} className="flex items-center gap-2">
          <span className="text-[11px] text-ink-2 font-medium w-28 shrink-0 truncate">{item.name}</span>
          <div className="relative flex-1">
            <input
              type="text"
              inputMode="numeric"
              value={item.amount === 0 ? '' : new Intl.NumberFormat('vi-VN').format(item.amount)}
              onChange={e => updateAmount(item.name, e.target.value)}
              placeholder="0"
              className="w-full rounded-lg border border-line px-2 py-1 text-xs text-right pr-6 focus:outline-none focus:border-gold"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted">đ</span>
          </div>
          <button
            onClick={() => removeItem(item.name)}
            className="w-5 h-5 rounded-full flex items-center justify-center text-faint hover:text-red-400 hover:bg-red-50 dark:bg-red-500/10 transition-colors shrink-0"
          >
            <X size={12} />
          </button>
        </div>
      ))}

      {!showAddForm ? (
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-1 text-[11px] text-gold hover:text-gold-deep font-semibold py-1 transition-colors"
        >
          <Plus size={12} /> Thêm phụ phí
        </button>
      ) : (
        <div className="bg-gold-tint rounded-xl border border-gold/20 p-3 space-y-3">
          {availablePresets.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {availablePresets.map(preset => (
                <button
                  key={preset.name}
                  onClick={() => addPreset(preset)}
                  className="text-[10px] px-2.5 py-1 rounded-lg bg-surface border border-line text-ink-2 hover:border-gold hover:bg-gold-tint font-medium transition-colors"
                >
                  {preset.name}
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={customName}
                onChange={e => setCustomName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addCustom(); if (e.key === 'Escape') setShowAddForm(false); }}
                placeholder="Tên phụ phí..."
                className="flex-1 rounded-lg border border-line px-2 py-1.5 text-[11px] focus:outline-none focus:border-gold bg-surface"
                autoFocus
              />
              <div className="relative w-28">
                <input
                  type="text"
                  inputMode="numeric"
                  value={customAmount}
                  onChange={e => setCustomAmount(e.target.value.replace(/[^0-9]/g, ''))}
                  onKeyDown={e => { if (e.key === 'Enter') addCustom(); if (e.key === 'Escape') setShowAddForm(false); }}
                  placeholder="Số tiền"
                  className="w-full rounded-lg border border-line px-2 py-1.5 text-[11px] text-right pr-5 focus:outline-none focus:border-gold bg-surface"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted">đ</span>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setShowAddForm(false); setCustomName(''); setCustomAmount(''); }}
                className="px-3 py-1 rounded-lg border border-line text-muted text-[10px] font-medium hover:bg-surface-2 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={addCustom}
                disabled={!customName.trim()}
                className="px-3 py-1 rounded-lg bg-gold text-white text-[10px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gold-strong transition-colors"
              >
                Thêm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── TierSelectModal ───────────────────────────────────────────────────────────
function TierSelectModal({ product, currentTierId, currentPriceSource, onConfirm, onClose }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-surface rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden">
        <div className="bg-gradient-to-r from-gold to-gold-strong px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-white/70 text-[10px] uppercase tracking-widest font-semibold">Chọn loại giá</p>
            <h3 className="text-white font-bold text-sm truncate max-w-[200px]">{product?.name}</h3>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-white">
            <X size={14} />
          </button>
        </div>
        <div className="p-4 space-y-2">
          <button
            onClick={() => onConfirm({ priceSource: 'BASE', tierId: null, tierName: null, unitPrice: product.basePrice })}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${currentPriceSource === 'BASE' ? 'border-sky-400 bg-sky-50 dark:bg-sky-500/10' : 'border-line hover:border-sky-300 dark:border-sky-500/35'}`}
          >
            <p className="text-sm font-semibold">Giá lẻ</p>
            <p className="text-sm font-bold text-sky-600 dark:text-sky-300">{fmt(product?.basePrice)}</p>
          </button>
          {(product?.priceTiers ?? []).slice().sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)).map((tier, idx) => (
            <button
              key={tier.id}
              onClick={() => onConfirm({ priceSource: 'TIER', tierId: tier.id, tierName: tier.tierName, unitPrice: tier.price })}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${currentTierId === tier.id ? 'border-orange-400 bg-orange-50 dark:bg-orange-500/10' : 'border-line hover:border-orange-300 dark:border-orange-500/35'}`}
            >
              <p className="text-sm font-semibold">{tier.tierName || `Sỉ ${idx + 1}`}</p>
              <p className="text-sm font-bold text-orange-600 dark:text-orange-300">{fmt(tier.price)}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── EditItemRow ───────────────────────────────────────────────────────────────
function EditItemRow({ item, prodInfo, onUpdateQty, onRemove, onPriceOverride, onDiscountChange, onPromoToggle, onVatRateChange, onTierSelect }) {
  const [editingPrice, setEditingPrice] = useState(false);
  const [priceDisplay, setPriceDisplay] = useState('');
  const [showDiscount, setShowDiscount] = useState(false);
  const [discountInput, setDiscountInput] = useState('');
  const [showPromoNote, setShowPromoNote] = useState(false);
  const [promoNoteInput, setPromoNoteInput] = useState('');
  const [showVatPicker, setShowVatPicker] = useState(false);
  const [isEditingQty, setIsEditingQty] = useState(false);
  const [qtyInput, setQtyInput] = useState('');
  const priceRef = useRef(null);
  const discountRef = useRef(null);
  const promoRef = useRef(null);
  const qtyInputRef = useRef(null);

  const vatRate = item.vatRate ?? 0;
  const vatMode = item.vatMode ?? 'INCLUSIVE';
  const isExclusive = vatMode === 'EXCLUSIVE';

  // ✅ FIX: Tính giá NET đúng — item.unitPrice đã là giá theo đơn vị hiển thị (thùng/kg)
  // Chỉ cần tách thuế ra nếu INCLUSIVE
  const netPrice = vatMode === 'INCLUSIVE'
    ? Number(item.unitPrice)
    : calcNet(item.unitPrice, vatRate, vatMode);

  const lineNet = netPrice * item.quantity;

  const itemDiscount = item.itemDiscountRate ?? 0;
  const isPromo = !!item.isPromo;
  const isNew = item.originalQuantity === undefined;
  const deltaQty = isNew ? item.quantity : (item.quantity - item.originalQuantity);

  const unit = (item.unit || '').toLowerCase();
  const isDecimalUnit = unit === 'kg' || unit === 'kilogam' || unit === 'lít' || unit === 'lit' || unit === 'l';

  const startEditPrice = () => {
    // Hiển thị giá NET khi sửa (giá chưa thuế)
    setPriceDisplay(String(
      vatMode === 'INCLUSIVE' ? Math.round(item.unitPrice) : Math.round(netPrice)
    ));

    setEditingPrice(true);
    setTimeout(() => { priceRef.current?.focus(); priceRef.current?.select(); }, 30);
  };
  const commitPrice = () => {
    const val = parseFloat(priceDisplay.replace(',', '.'));
    if (!isNaN(val) && val >= 0) {
      // Người dùng nhập giá NET, cần convert về giá lưu trữ (INCLUSIVE thì nhân lại thuế)
      const storedPrice = vatMode === 'INCLUSIVE'
        ? val          // giá người dùng nhập đã gồm thuế → lưu thẳng
        : vatRate > 0
          ? val * (1 + vatRate / 100)  // EXCLUSIVE: nhân lại để lưu
          : val;
      onPriceOverride(item._editId, storedPrice);
    }
    setEditingPrice(false);
  };

  const openDiscount = () => {
    setDiscountInput(itemDiscount > 0 ? String(itemDiscount) : '');
    setShowDiscount(true);
    setTimeout(() => { discountRef.current?.focus(); discountRef.current?.select(); }, 30);
  };
  const commitDiscount = () => {
    const val = parseInt(discountInput, 10);
    if (!isNaN(val) && val >= 0) onDiscountChange(item._editId, Math.min(val, 100));
    setShowDiscount(false);
  };

  const openPromo = () => {
    setPromoNoteInput(item.promoNote || '');
    setShowPromoNote(true);
    setTimeout(() => promoRef.current?.focus(), 30);
  };
  const commitPromo = () => { onPromoToggle(item._editId, true, promoNoteInput); setShowPromoNote(false); };
  const togglePromo = () => {
    if (isPromo) { onPromoToggle(item._editId, false, ''); setShowPromoNote(false); }
    else openPromo();
  };

  const startEditQty = () => {
    setQtyInput(String(item.quantity));
    setIsEditingQty(true);
    setTimeout(() => { qtyInputRef.current?.focus(); qtyInputRef.current?.select(); }, 30);
  };

  const commitQty = () => {
    let val = parseFloat(qtyInput.replace(',', '.'));
    if (isNaN(val)) val = item.quantity;
    if (!isDecimalUnit) val = Math.round(val);
    else val = Math.round(val * 100) / 100;
    if (val <= 0) onRemove(item._editId);
    else onUpdateQty(item._editId, val);
    setIsEditingQty(false);
  };

  const handleQtyKeyDown = (e) => {
    if (e.key === 'Enter') commitQty();
    if (e.key === 'Escape') setIsEditingQty(false);
  };

  const priceBadge = item.priceSource === 'MANUAL'
    ? <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold bg-purple-100 dark:bg-purple-500/18 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/28">Thủ công</span>
    : item.priceSource === 'TIER'
      ? <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold bg-orange-100 dark:bg-orange-500/18 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-500/28">{item.tierName || 'Giá sỉ'}</span>
      : <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold bg-sky-100 dark:bg-sky-500/18 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-500/28">Giá lẻ</span>;

  return (
    <div className="py-3 border-b border-line-soft last:border-0">
      <div className="flex items-start gap-3">
        {item.productImageUrl
          ? <img src={`${BASE_URL}/api/auth${item.productImageUrl}`} alt={item.productName} className="w-10 h-10 rounded-lg object-cover shrink-0 border border-line-soft" />
          : <div className="w-10 h-10 rounded-lg shrink-0 bg-surface-2 flex items-center justify-center"><Package size={14} className="text-faint" /></div>}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="font-semibold text-sm text-ink truncate">{item.productName}</p>
            {isNew && <span className="text-[9px] bg-emerald-100 dark:bg-emerald-500/18 text-emerald-700 dark:text-emerald-300 rounded-full px-1.5 py-0.5 font-bold shrink-0">MỚI</span>}
            {!isNew && deltaQty > 0 && <span className="text-[9px] bg-amber-100 dark:bg-amber-500/18 text-amber-700 dark:text-amber-300 rounded-full px-1.5 py-0.5 font-bold shrink-0">+{deltaQty} trừ kho</span>}
            {!isNew && deltaQty < 0 && <span className="text-[9px] bg-sky-100 dark:bg-sky-500/18 text-sky-700 dark:text-sky-300 rounded-full px-1.5 py-0.5 font-bold shrink-0">{deltaQty} hoàn kho</span>}
          </div>

          <div className="flex items-center gap-1 flex-wrap mt-0.5">
            <button onClick={() => onTierSelect(item._editId)} className="hover:opacity-75 transition-opacity">{priceBadge}</button>

            {item.saleType === 'BOX' && item.unitsPerBox > 0 && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/28">
                {item.unitsPerBox} hộp/thùng
              </span>
            )}

            <button
              onClick={() => { if (isExclusive) setShowVatPicker(p => !p); }}
              className={`flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full font-semibold border transition-colors
                ${vatRate > 0
                  ? isExclusive ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/28 cursor-pointer hover:bg-emerald-100 dark:bg-emerald-500/18'
                    : 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/28 cursor-default'
                  : isExclusive ? 'bg-canvas text-muted border-line cursor-pointer hover:bg-emerald-50 dark:bg-emerald-500/10'
                    : 'bg-canvas text-faint border-line cursor-default'}`}
            >
              {vatRate > 0 ? `VAT ${vatRate}% ${isExclusive ? '(ngoài)' : '(trong)'}` : isExclusive ? 'Chọn VAT' : 'Không VAT'}
              {isExclusive && <ChevronDown size={8} />}
            </button>
          </div>

          {showVatPicker && isExclusive && (
            <div className="mt-1.5 flex items-center gap-1 flex-wrap bg-emerald-50 dark:bg-emerald-500/10 rounded-lg px-2 py-1.5 border border-emerald-200 dark:border-emerald-500/28">
              <span className="text-[9px] text-emerald-700 dark:text-emerald-300 font-semibold mr-1">Thuế %:</span>
              {EXCLUSIVE_VAT.map(r => (
                <button key={r} onClick={() => { onVatRateChange(item._editId, r); setShowVatPicker(false); }}
                  className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${vatRate === r ? 'bg-emerald-600 text-white' : 'bg-surface text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/35 hover:bg-emerald-100 dark:bg-emerald-500/18'}`}>
                  {r}%
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-1.5 mt-1">
            {isPromo ? (
              <span className="text-xs font-bold text-rose-500 flex items-center gap-1"><Gift size={10} className="text-rose-400" /> 0 đ</span>
            ) : editingPrice ? (
              <div className="flex items-center gap-1">
                <input ref={priceRef} type="text" inputMode="decimal" value={priceDisplay}
                  onChange={e => setPriceDisplay(e.target.value.replace(/[^0-9.]/g, ''))}
                  onBlur={commitPrice} onKeyDown={e => { if (e.key === 'Enter') commitPrice(); if (e.key === 'Escape') setEditingPrice(false); }}
                  className="w-24 text-xs border-2 border-gold rounded-lg px-2 py-1 focus:outline-none font-semibold" />
                <span className="text-[10px] text-muted">đ</span>
              </div>
            ) : (
              <button onClick={startEditPrice} className="flex items-center gap-1 group">
                {/* Hiển thị giá NET (chưa thuế) */}
                <span className={`text-xs font-bold ${item.priceSource === 'MANUAL' ? 'text-purple-600 dark:text-purple-300' : 'text-gold group-hover:text-gold-deep'}`}>
                  {fmt(netPrice)}
                </span>
                <Pencil size={9} className="text-faint group-hover:text-gold" />
              </button>
            )}
            <div className="ml-auto flex items-center gap-1 shrink-0">
              {!isPromo && (itemDiscount > 0
                ? <button onClick={openDiscount} className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-orange-100 dark:bg-orange-500/18 text-orange-600 dark:text-orange-300 border border-orange-200 dark:border-orange-500/28 font-semibold hover:bg-orange-200 dark:bg-orange-500/28"><Percent size={8} />-{itemDiscount}%</button>
                : <button onClick={openDiscount} className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-surface-2 text-faint border border-line hover:bg-surface-2"><Percent size={8} />CK</button>)}
              <button onClick={togglePromo}
                className={`flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full font-semibold border transition-colors
                  ${isPromo ? 'bg-rose-100 dark:bg-rose-500/18 text-rose-600 dark:text-rose-300 border-rose-300 dark:border-rose-500/35' : 'bg-surface-2 text-faint border-line hover:bg-rose-50 dark:bg-rose-500/10 hover:text-rose-400'}`}>
                <Gift size={8} />KM
              </button>
            </div>
          </div>

          {showDiscount && (
            <div className="mt-1.5 flex items-center gap-1.5 bg-canvas rounded-lg px-2 py-1.5 border border-line">
              <input ref={discountRef} type="text" inputMode="numeric" value={discountInput}
                onChange={e => setDiscountInput(e.target.value.replace(/[^0-9]/g, ''))}
                onKeyDown={e => { if (e.key === 'Enter') commitDiscount(); if (e.key === 'Escape') setShowDiscount(false); }}
                placeholder="0" className="w-10 text-xs text-center border border-line rounded-lg px-1 py-1 focus:outline-none focus:border-gold bg-surface font-semibold" />
              <span className="text-[10px] text-muted">%</span>
              <button onClick={commitDiscount} className="w-5 h-5 rounded-full bg-gold text-white flex items-center justify-center"><Check size={10} /></button>
              {itemDiscount > 0 && <button onClick={() => { onDiscountChange(item._editId, 0); setShowDiscount(false); }} className="text-[9px] text-red-400 hover:text-red-600 dark:text-red-300">xóa</button>}
            </div>
          )}

          {showPromoNote && (
            <div className="mt-1.5 flex items-center gap-1.5 bg-rose-50 dark:bg-rose-500/10 rounded-lg px-2 py-1.5 border border-rose-200 dark:border-rose-500/28">
              <input ref={promoRef} type="text" value={promoNoteInput} onChange={e => setPromoNoteInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') commitPromo(); if (e.key === 'Escape') setShowPromoNote(false); }}
                placeholder="Ghi chú KM..." className="flex-1 text-[10px] border border-rose-200 dark:border-rose-500/28 rounded-lg px-2 py-1 focus:outline-none focus:border-rose-400 bg-surface" />
              <button onClick={commitPromo} className="w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center"><Check size={10} /></button>
            </div>
          )}
          {isPromo && item.promoNote && !showPromoNote && (
            <button onClick={openPromo} className="mt-0.5 text-[9px] text-rose-500 italic truncate max-w-full text-left">📌 {item.promoNote}</button>
          )}

          {!isPromo && (
            <p className="text-[10px] text-muted mt-0.5">
              = {fmt(lineNet)}
              {itemDiscount > 0 && <span className="text-emerald-600 dark:text-emerald-300 ml-1">→ {fmt(lineNet * (1 - itemDiscount / 100))}</span>}
            </p>
          )}
        </div>

        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <button onClick={() => onRemove(item._editId)} className="w-5 h-5 rounded-full text-faint hover:text-red-400 hover:bg-red-50 dark:bg-red-500/10 flex items-center justify-center">
            <Trash2 size={11} />
          </button>
          <div className="flex items-center gap-1">
            <button onClick={() => onUpdateQty(item._editId, item.quantity - 1)} className="w-6 h-6 rounded-full bg-surface-2 text-sm font-bold flex items-center justify-center hover:bg-surface-3">−</button>
            {isEditingQty ? (
              <input
                ref={qtyInputRef}
                type="text"
                inputMode="decimal"
                value={qtyInput}
                onChange={e => setQtyInput(e.target.value.replace(/[^0-9.,]/g, ''))}
                onBlur={commitQty}
                onKeyDown={handleQtyKeyDown}
                className="w-12 text-center text-sm font-bold border-2 border-gold rounded-lg px-1 py-0.5 focus:outline-none"
              />
            ) : (
              <span
                onClick={startEditQty}
                className="text-sm font-bold w-10 text-center cursor-pointer hover:bg-surface-2 rounded-lg py-0.5 transition-colors"
              >
                {item.quantity}
              </span>
            )}
            <button onClick={() => onUpdateQty(item._editId, item.quantity + 1)} className="w-6 h-6 rounded-full bg-surface-2 text-sm font-bold flex items-center justify-center hover:bg-surface-3">+</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── ProductPickerModal ────────────────────────────────────────────────────────
function ProductPickerModal({ onAdd, onClose, existingIds }) {
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [allProducts, setAllProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCat, setSelectedCat] = useState('ALL');
  const [loading, setLoading] = useState(false);
  const searchRef = useRef(null);

  useEffect(() => { searchRef.current?.focus(); }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  // Load categories + tất cả products 1 lần khi mount
  useEffect(() => {
    setLoading(true);
    Promise.all([
      categoryApi.getAll(),
      productApi.getAll({ page: 0, size: 200 }),
    ]).then(([cRes, pRes]) => {
      const cats = cRes.data?.data || cRes.data || [];
      setCategories(Array.isArray(cats) ? cats : []);
      const d = pRes.data?.data;
      const l = d?.content ?? d ?? pRes.data ?? [];
      setAllProducts(Array.isArray(l) ? l : []);
    }).catch(() => {
      setAllProducts([]);
      setCategories([]);
    }).finally(() => setLoading(false));
  }, []); // chỉ chạy 1 lần

  // Filter client-side
  const products = useMemo(() => {
    let list = allProducts;
    if (selectedCat !== 'ALL') {
      // so sánh Number vì categoryId là integer
      list = list.filter(p => Number(p.categoryId) === Number(selectedCat));
    }
    if (debouncedQ.trim()) {
      const q = debouncedQ.toLowerCase();
      list = list.filter(p => p.name?.toLowerCase().includes(q));
    }
    return list;
  }, [allProducts, selectedCat, debouncedQ]);

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50">
      <div className="bg-surface w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-line-soft shrink-0">
          <h3 className="font-bold text-ink text-sm">Chọn sản phẩm</h3>
          <button onClick={onClose} className="p-1.5 text-muted hover:text-red-400 rounded-xl"><X size={16} /></button>
        </div>
        <div className="px-4 py-2 shrink-0 border-b border-line-soft">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input ref={searchRef} value={q} onChange={e => setQ(e.target.value)} placeholder="Tìm sản phẩm..."
              className="w-full pl-8 pr-3 py-2 text-sm border border-line rounded-xl outline-none focus:border-gold" />
          </div>
        </div>
        {categories.length > 0 && (
          <div className="flex gap-1.5 px-4 py-2 overflow-x-auto scrollbar-hide shrink-0 border-b border-line-soft">
            <button
              onClick={() => setSelectedCat('ALL')}
              className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors
                ${selectedCat === 'ALL' ? 'bg-gold text-white' : 'bg-surface-2 text-ink-2 hover:bg-surface-3'}`}
            >
              <Grid size={10} />Tất cả
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCat(cat.id)} // giữ nguyên integer
                className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap transition-colors
                  ${Number(selectedCat) === Number(cat.id) ? 'bg-gold text-white' : 'bg-surface-2 text-ink-2 hover:bg-surface-3'}`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}
        <div className="flex-1 overflow-y-auto">
          {loading
            ? <div className="flex items-center justify-center py-12 gap-2 text-muted">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">Đang tải...</span>
            </div>
            : products.length === 0
              ? <div className="flex flex-col items-center justify-center py-12 text-muted gap-2">
                <Search size={28} strokeWidth={1} />
                <p className="text-sm">Không tìm thấy</p>
              </div>
              : <div className="px-2 py-2 space-y-0.5">
                {products.map(p => (
                  <button key={p.id} onClick={() => onAdd(p)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gold-tint text-left transition-colors group">
                    {p.imageUrl
                      ? <img src={p.imageUrl.startsWith('http') ? p.imageUrl : `${BASE_URL}/api/auth${p.imageUrl}`}
                        alt={p.name} className="w-10 h-10 rounded-xl object-cover shrink-0 border border-line-soft" />
                      : <div className="w-10 h-10 rounded-xl shrink-0 bg-surface-2 flex items-center justify-center">
                        <Package size={14} className="text-faint" />
                      </div>}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-ink truncate">{p.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-gold font-medium">{fmt(p.basePrice)}</p>
                        {p.categoryName && (
                          <span className="text-[10px] bg-surface-2 text-muted rounded-full px-1.5 py-0.5">
                            {p.categoryName}
                          </span>
                        )}
                        {existingIds.has(p.id) && (
                          <span className="text-[10px] bg-sky-100 dark:bg-sky-500/18 text-sky-700 dark:text-sky-300 rounded-full px-1.5 py-0.5 font-semibold">
                            Đang có
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="w-7 h-7 rounded-full bg-gold/10 flex items-center justify-center group-hover:bg-gold transition-colors shrink-0">
                      <Plus size={13} className="text-gold group-hover:text-white" />
                    </div>
                  </button>
                ))}
              </div>}
        </div>
        <div className="px-4 py-3 border-t border-line-soft shrink-0 text-center">
          <p className="text-[11px] text-muted">{products.length} sản phẩm · Nhấn để thêm</p>
        </div>
      </div>
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────
export default function EditOrderModal({ open, orderId, onClose, onSaved, isSuperSeller = false }) {
  const toast = useToast();
  const idCounter = useRef(0);

  // ── WebSocket: cảnh báo nếu đơn bị sửa từ nơi khác trong khi modal đang mở ──
  const [wsOrderAlert, setWsOrderAlert] = useState(null);
  const wsUserRef = useRef(null);
  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem('user') || '{}');
      wsUserRef.current = u;
    } catch { wsUserRef.current = {}; }
  }, []);
  const wsRole  = wsUserRef.current?.role  || '';
  const wsToken = wsUserRef.current?.token || localStorage.getItem('token') || '';
  useWebSocket(wsRole, wsToken, (msg) => {
    if (!open || !orderId) return;
    if (
      (msg.eventType === 'ORDER_EDITED' || msg.eventType === 'ORDER_UPDATED') &&
      (msg.orderId === orderId || msg.referenceId === String(orderId))
    ) {
      const editorName = msg.editorName || msg.senderName || 'Người khác';
      setWsOrderAlert(`⚠️ ${editorName} vừa sửa đơn này. Dữ liệu có thể đã thay đổi.`);
    }
  });
  const nextId = () => { idCounter.current += 1; return idCounter.current; };

  const [priceDisplayOption, setPriceDisplayOption] = useState('show');
  const [orderDetail, setOrderDetail] = useState(null);
  const [fetchingDetail, setFetchingDetail] = useState(false);
  const [items, setItems] = useState([]);
  const [allProducts, setAllProducts] = useState([]);

  // Thông tin đơn hàng
  const [orderedByName, setOrderedByName] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryDatetime, setDeliveryDatetime] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [notes, setNotes] = useState('');

  // Khách hàng
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);

  // Giảm giá & phụ phí
  const [discount, setDiscount] = useState(0);
  const [discountFixed, setDiscountFixed] = useState(null);
  const [discountFixedDisplay, setDiscountFixedDisplay] = useState('');
  const [surchargeItems, setSurchargeItems] = useState([]);

  // Người giao hàng (chỉ SUPER_SELLER dùng)
  const [deliveryDrivers, setDeliveryDrivers] = useState([]); // [{name,type,trips}]
  const [driverSearches, setDriverSearches]   = useState({}); // {idx: keyword}
  const [driverResults, setDriverResults]     = useState({}); // {idx: [{name,vehicleType}]}
  const driverDebounceRefs                    = useRef({});

  const [showPicker, setShowPicker] = useState(false);
  const [tierEditId, setTierEditId] = useState(null);
  const [tierProduct, setTierProduct] = useState(null);
  const [saving, setSaving] = useState(false);

  const surchargeNum = surchargeItems.reduce((s, i) => s + (Number(i.amount) || 0), 0);

  // Load order detail
  useEffect(() => {
    if (!open || !orderId) return;

    idCounter.current = 0;
    setItems([]);
    setOrderDetail(null);
    setShowPicker(false);
    setDiscount(0); setDiscountFixed(null); setDiscountFixedDisplay('');
    setSurchargeItems([]);
    setSelectedCustomer(null);
    setWsOrderAlert(null);
    setFetchingDetail(true);

    let cancelled = false;

    orderApi.getById(orderId).then(res => {
      if (cancelled) return;
      const d = res.data?.data ?? res.data;

      // Hiển thị giá
      const hideAllPricesVal = d?.hideAllPrices ?? false;
      const showPricesVal = d?.showPrices ?? true;
      if (hideAllPricesVal) setPriceDisplayOption('hide_all');
      else if (!showPricesVal) setPriceDisplayOption('hide_prices');
      else setPriceDisplayOption('show');

      setOrderDetail(d);
      setOrderedByName(d?.orderedByName ?? '');
      setReceiverName(d?.receiverName ?? d?.customerName ?? '');
      setDeliveryAddress(d?.deliveryAddress ?? d?.shippingAddress ?? '');
      setDeliveryDatetime(d?.deliveryDatetime ? tsToDatetimeLocal(d.deliveryDatetime) : '');
      setPaymentMethod(d?.paymentMethod ?? 'CASH');
      setNotes(d?.notes ?? '');

      // Khôi phục khách hàng từ đơn hàng
      if (d?.customerId) {
        setSelectedCustomer({
          id: d.customerId,
          contactName: d.customerName ?? '',
          name: d.customerName ?? '',
          phone: d.customerPhone ?? '',
          customerCode: '',
          customerType: d.customerType ?? 'RETAIL',
          selectedReceiver: d.deliveryAddress ? {
            receiverAddress: d.deliveryAddress,
            receiverName: d.receiverName ?? null,
            receiverPhone: d.customerPhone ?? null,
          } : null,
        });
      }

      // Giảm giá — phân biệt giảm giá chung vs giảm giá món
      // Logic: 
      //  - discountRate > 0 → luôn là giảm giá chung (%)
      //  - discountAmount > 0 VÀ discountRate == 0:
      //    + Kiểm tra xem có item nào có discountPercent > 0 không
      //    + Nếu TẤT CẢ discountAmount đến từ item-level discount → KHÔNG hiển thị giảm giá chung
      //    + Nếu có giảm giá chung thực sự → hiển thị
      {
        const itemsRaw = d?.items ?? d?.orderItems ?? [];
        const hasItemDiscount = itemsRaw.some(i =>
          i.discountPercent > 0 && i.priceMode !== 'DISCOUNT_PERCENT'
        );
        const hasOrderDiscountRate = Number(d?.discountRate) > 0;
        const hasOrderDiscountAmount = Number(d?.discountAmount) > 0;

        if (hasOrderDiscountRate) {
          // Giảm giá chung theo %
          setDiscount(Number(d.discountRate));
          setDiscountFixed(null); setDiscountFixedDisplay('');
        } else if (hasOrderDiscountAmount && !hasItemDiscount) {
          // Giảm giá chung cố định (không phải từ item discount)
          setDiscount(0);
          setDiscountFixed(Number(d.discountAmount));
          setDiscountFixedDisplay(new Intl.NumberFormat('vi-VN').format(Number(d.discountAmount)));
        }
        // Nếu chỉ có item-level discount → không set giảm giá chung (để = 0)
      }

      // Tài xế giao hàng
      if (d?.deliveryInfo && Array.isArray(d.deliveryInfo) && d.deliveryInfo.length > 0) {
        setDeliveryDrivers(d.deliveryInfo.map(dr => ({
          name: dr.name || '',
          type: dr.type || 'BIKE',
          trips: dr.trips || 1,
        })));
      } else {
        setDeliveryDrivers([]);
      }

      // Phụ phí
      if (d?.surchargeDetail) {
        try {
          const parsed = JSON.parse(d.surchargeDetail);
          setSurchargeItems(Array.isArray(parsed) ? parsed : []);
        } catch { setSurchargeItems([]); }
      } else if (Number(d?.surcharge) > 0) {
        setSurchargeItems([{ name: 'Phụ phí', amount: Number(d.surcharge) }]);
      } else {
        setSurchargeItems([]);
      }

      // Items
      const raw = d?.items ?? d?.orderItems ?? [];

      setItems(raw.map(i => {
        const notes = i.notes || '';
        const isPromo = notes.startsWith('[KM]');
        let promoNote = '';
        if (isPromo) {
          promoNote = notes.replace('[KM]', '').trim();
        }

        // ✅ FIX: Tính giá hiển thị đúng theo đơn vị
        // Backend luôn trả về unitPrice theo đơn vị cơ bản (hộp/kg/...)
        // UI hiển thị theo đơn vị thùng nếu saleType === 'BOX'
        let displayUnit = i.unit;
        let displayQuantity = Number(i.quantity);
        // Lưu unitPrice theo đơn vị hiển thị (thùng = hộp * unitsPerBox)
        // Giữ nguyên vatMode — KHÔNG tách thuế ở đây, calcNet sẽ xử lý khi hiển thị
        let displayUnitPrice = Number(i.unitPrice);

        if (i.saleType === 'BOX' && i.unitsPerBox > 0) {
          displayUnit = 'Thùng';
          // Giá thùng = giá hộp * số hộp/thùng (vatMode giữ nguyên INCLUSIVE/EXCLUSIVE)
          displayUnitPrice = Number(i.unitPrice) * i.unitsPerBox;
          // Số lượng giữ nguyên (số thùng)
          displayQuantity = Number(i.quantity);
        }

        return {
          _editId: nextId(),
          productId: i.productId,
          productName: i.productName,
          productImageUrl: i.productImageUrl,
          unit: displayUnit,
          quantity: displayQuantity,
          originalQuantity: displayQuantity,
          unitPrice: displayUnitPrice,       // giá theo đơn vị hiển thị (thùng/kg), vẫn giữ VAT gốc
          basePrice: Number(i.basePrice ?? i.unitPrice),
          priceSource: i.priceMode === 'TIER' ? 'TIER' : i.priceMode === 'DISCOUNT_PERCENT' ? 'DISCOUNT_PERCENT' : i.priceMode === 'MANUAL' ? 'MANUAL' : 'BASE',
          priceMode: i.priceMode ?? 'BASE',
          tierId: i.tierId ?? null,
          tierName: i.tierName ?? null,
          vatRate: i.vatRate ?? 0,
          vatMode: i.vatMode ?? 'INCLUSIVE',  // giữ nguyên vatMode từ backend
          itemDiscountRate: i.priceMode === 'DISCOUNT_PERCENT' ? 0 : (i.discountPercent ?? 0),
          isPromo: isPromo,
          promoNote: promoNote,
          saleType: i.saleType ?? 'RETAIL',
          unitsPerBox: i.unitsPerBox,
          notes: isPromo ? null : notes,
        };
      }));
    })
      .catch(() => { if (!cancelled) toast('Không thể tải chi tiết đơn hàng', 'error'); })
      .finally(() => { if (!cancelled) setFetchingDetail(false); });

    return () => { cancelled = true; };
  }, [open, orderId]); // eslint-disable-line

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    productApi.getAll({ page: 0, size: 200 }).then(res => {
      if (cancelled) return;
      const d = res.data?.data;
      const l = d?.content ?? d ?? res.data ?? [];
      setAllProducts(Array.isArray(l) ? l : []);
    }).catch(() => { });
    return () => { cancelled = true; };
  }, [open]);

  // Handlers items
  const updateQty = useCallback((editId, qty) => {
    if (qty <= 0) setItems(prev => prev.filter(i => i._editId !== editId));
    else setItems(prev => prev.map(i => i._editId === editId ? { ...i, quantity: qty } : i));
  }, []);

  const removeItem = useCallback((editId) => {
    setItems(prev => prev.filter(i => i._editId !== editId));
  }, []);

  const priceOverride = useCallback((editId, price) => {
    // price đã là giá lưu trữ (INCLUSIVE = có thuế, EXCLUSIVE = chưa thuế)
    setItems(prev => prev.map(i => i._editId === editId
      ? { ...i, unitPrice: price, priceSource: 'MANUAL', tierId: null, tierName: null }
      : i));
  }, []);

  const discountChange = useCallback((editId, pct) => {
    setItems(prev => prev.map(i => i._editId === editId ? { ...i, itemDiscountRate: pct } : i));
  }, []);

  const promoToggle = useCallback((editId, enable, note) => {
    setItems(prev => prev.map(i => {
      if (i._editId !== editId) return i;
      if (enable) {
        return {
          ...i,
          isPromo: true,
          promoNote: note || '',
          _priceBeforePromo: i._priceBeforePromo ?? i.unitPrice,
          unitPrice: 0
        };
      } else {
        const restoredPrice = i._priceBeforePromo ?? i.basePrice ?? i.unitPrice;
        return {
          ...i,
          isPromo: false,
          promoNote: '',
          unitPrice: restoredPrice,
          _priceBeforePromo: undefined
        };
      }
    }));
  }, []);

  const vatRateChange = useCallback((editId, rate) => {
    setItems(prev => prev.map(i => i._editId === editId ? { ...i, vatRate: rate } : i));
  }, []);

  const handleTierSelect = useCallback((editId) => {
    const item = items.find(i => i._editId === editId);
    if (!item) return;
    const prod = allProducts.find(p => p.id === item.productId);
    if (!prod) return;
    setTierEditId(editId);
    setTierProduct(prod);
  }, [items, allProducts]);

  const handleTierConfirm = useCallback(({ priceSource, tierId, tierName, unitPrice }) => {
    setItems(prev => prev.map(i => {
      if (i._editId !== tierEditId) return i;

      // unitPrice từ TierSelectModal là giá hộp/đơn vị cơ bản
      // Nếu item đang hiển thị theo thùng, nhân lên để giữ nhất quán
      let newUnitPrice = unitPrice;
      if (i.saleType === 'BOX' && i.unitsPerBox > 0) {
        newUnitPrice = unitPrice * i.unitsPerBox;
      }

      return {
        ...i,
        priceSource,
        tierId,
        tierName,
        unitPrice: newUnitPrice,
      };
    }));
    setTierEditId(null);
    setTierProduct(null);
  }, [tierEditId]);

  const addProduct = useCallback((product) => {
    setItems(prev => {
      const existing = prev.find(i => i.productId === product.id);
      if (existing) return prev.map(i => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, {
        _editId: nextId(),
        productId: product.id, productName: product.name, productImageUrl: product.imageUrl,
        unit: product.unit ?? 'kg', quantity: 1, originalQuantity: undefined,
        unitPrice: Number(product.basePrice), basePrice: Number(product.basePrice),
        priceSource: 'BASE', tierId: null, tierName: null,
        vatRate: product.vatRate ?? 0, vatMode: product.vatMode ?? 'INCLUSIVE',
        itemDiscountRate: 0, isPromo: false, promoNote: '', saleType: 'RETAIL',
      }];
    });
    toast(`Đã thêm "${product.name}"`, 'success');
  }, [toast]);

  const handleSelectCustomer = useCallback((customer) => {
    setSelectedCustomer(customer);
    if (customer.selectedReceiver) {
      if (customer.selectedReceiver.receiverAddress)
        setDeliveryAddress(customer.selectedReceiver.receiverAddress);
      if (customer.selectedReceiver.receiverName)
        setReceiverName(customer.selectedReceiver.receiverName);
    }
  }, []);

  const handleClearCustomer = useCallback(() => {
    setSelectedCustomer(null);
  }, []);

  // ✅ FIX SUMMARY: Tính toán tổng đúng
  // item.unitPrice là giá theo đơn vị hiển thị, với vatMode gốc (INCLUSIVE/EXCLUSIVE)
  // "Tạm tính" hiển thị theo giá NET (chưa thuế) để nhất quán với giá hiển thị từng dòng
  const subtotalNet = items.reduce((s, i) => {
    if (i.isPromo) return s;
    const net = calcNet(i.unitPrice, i.vatRate, i.vatMode);
    return s + net * i.quantity;
  }, 0);

  // subtotalGross = tổng giá theo đơn vị hiển thị (có thể bao gồm thuế INCLUSIVE)
  // Dùng để tính tỷ lệ phân bổ giảm giá
  const subtotalGross = items.reduce((s, i) => {
    if (i.isPromo) return s;
    return s + Number(i.unitPrice) * i.quantity;
  }, 0);

  // CK món tính trên giá gộp
  const itemDiscountTotal = items.reduce((s, i) => {
    if (i.isPromo || !i.itemDiscountRate) return s;
    if (i.priceSource === 'DISCOUNT_PERCENT' || i.priceMode === 'DISCOUNT_PERCENT') return s;
    return s + Number(i.unitPrice) * i.quantity * (i.itemDiscountRate / 100);
  }, 0);

  const subtotalAfterItemDiscount = subtotalGross - itemDiscountTotal;
  const maxDiscountFixed = Math.round(subtotalAfterItemDiscount * 0.1);
  const discountAmt = discountFixed !== null
    ? Math.min(discountFixed, maxDiscountFixed)
    : Math.round(subtotalAfterItemDiscount * discount) / 100;

  // VAT EXCLUSIVE tính trên NET sau tất cả giảm giá
  const exclusiveVatTotal = items.reduce((s, i) => {
    if (i.isPromo || (i.vatMode ?? 'INCLUSIVE') !== 'EXCLUSIVE' || !i.vatRate) return s;
    const lineGross = Number(i.unitPrice) * i.quantity;
    const proportion = subtotalGross > 0 ? lineGross / subtotalGross : 0;
    const lineGrossAfterDiscount = lineGross - (itemDiscountTotal + discountAmt) * proportion;
    return s + lineGrossAfterDiscount * (i.vatRate / 100);
  }, 0);

  // VAT INCLUSIVE — chỉ để hiển thị thông tin
  const inclusiveVatTotal = items.reduce((s, i) => {
    if (i.isPromo || (i.vatMode ?? 'INCLUSIVE') !== 'INCLUSIVE' || !i.vatRate) return s;
    const lineGross = Number(i.unitPrice) * i.quantity;
    const proportion = subtotalGross > 0 ? lineGross / subtotalGross : 0;
    const lineGrossAfterDiscount = lineGross - (itemDiscountTotal + discountAmt) * proportion;
    return s + lineGrossAfterDiscount * i.vatRate / (100 + i.vatRate);
  }, 0);

  const total = subtotalAfterItemDiscount - discountAmt + exclusiveVatTotal + surchargeNum;

  // ── Confirm Edit Modal state (SUPER_SELLER) ─────────────────────────────────
  const [showConfirmEdit, setShowConfirmEdit] = useState(false);
  const [confirmEditData, setConfirmEditData] = useState({ requestedBy: '', editReason: '', requestedByRole: '', requestedByRoles: [] });
  const [staffSearch, setStaffSearch]         = useState('');
  const [staffResults, setStaffResults]       = useState([]);
  const [loadingStaff, setLoadingStaff]       = useState(false);
  const staffDebounceRef = useRef(null);

  const searchStaff = (kw) => {
    setStaffSearch(kw);
    if (staffDebounceRef.current) clearTimeout(staffDebounceRef.current);
    if (!kw.trim()) { setStaffResults([]); return; }
    staffDebounceRef.current = setTimeout(async () => {
      setLoadingStaff(true);
      try {
        const res = await orderApi.searchStaff(kw);
        setStaffResults(res?.data?.data || []);
      } catch { setStaffResults([]); }
      finally { setLoadingStaff(false); }
    }, 600);
  };

  const searchDriver = (idx, kw, type) => {
    setDriverSearches(prev => ({ ...prev, [idx]: kw }));
    if (driverDebounceRefs.current[idx]) clearTimeout(driverDebounceRefs.current[idx]);
    if (!kw.trim()) { setDriverResults(prev => ({ ...prev, [idx]: [] })); return; }
    driverDebounceRefs.current[idx] = setTimeout(async () => {
      try {
        // Map BIKE→MOTORBIKE vì backend dùng MOTORBIKE/TRUCK
        const apiType = type === 'BIKE' ? 'MOTORBIKE' : type;
        const res = await orderApi.searchDrivers(kw, apiType);
        setDriverResults(prev => ({ ...prev, [idx]: res?.data?.data || [] }));
      } catch { setDriverResults(prev => ({ ...prev, [idx]: [] })); }
    }, 600);
  };

  const selectDriver = (idx, driverName) => {
    setDeliveryDrivers(prev => prev.map((r, i) => i === idx ? { ...r, name: driverName } : r));
    setDriverSearches(prev => ({ ...prev, [idx]: driverName }));
    setDriverResults(prev => ({ ...prev, [idx]: [] }));
  };

  // Lưu
  const buildPayload = () => ({
    orderedByName: orderedByName || undefined,
    receiverName: receiverName || undefined,
    deliveryAddress: deliveryAddress || undefined,
    deliveryDatetime: datetimeLocalToTs(deliveryDatetime) || undefined,
    paymentMethod,
    notes: notes || undefined,
    discountAmount: discountFixed !== null ? discountAmt : undefined,
    discountRate: discountFixed === null ? discount : undefined,
    showPrices: priceDisplayOption === 'show',
    hideAllPrices: priceDisplayOption === 'hide_all',
    surchargeItems: surchargeItems.filter(i => Number(i.amount) > 0),
    customerId: selectedCustomer?.id ?? undefined,
    deliveryInfo: deliveryDrivers.length > 0
      ? deliveryDrivers.filter(d => d.name.trim())
      : undefined,
    items: items.map(i => {
      const isPromoItem = i.isPromo === true;
      let sentPrice = i.unitPrice;
      if (i.saleType === 'BOX' && i.unitsPerBox > 0) sentPrice = i.unitPrice / i.unitsPerBox;
      const finalPrice = isPromoItem ? 0 : sentPrice;
      return {
        productId: i.productId,
        quantity: i.quantity,
        originalQuantity: i.originalQuantity ?? 0,
        priceMode: isPromoItem ? 'BASE' : (i.priceSource === 'TIER' ? 'TIER' : 'BASE'),
        tierId: (isPromoItem || i.priceSource !== 'TIER') ? null : i.tierId,
        sentUnitPrice: finalPrice,
        isManualPrice: isPromoItem ? true : (i.priceSource === 'MANUAL'),
        discountPercent: (!isPromoItem && i.itemDiscountRate > 0) ? i.itemDiscountRate : undefined,
        saleType: i.saleType ?? 'RETAIL', unitsPerBox: i.unitsPerBox, unit: i.unit,
        notes: isPromoItem ? `[KM]${i.promoNote ? ' ' + i.promoNote : ''}` : (i.notes || undefined),
        vatRate: i.vatRate ?? 0,
        vatMode: i.vatMode ?? 'INCLUSIVE',
      };
    }),
  });

  const handleSave = async () => {
    if (items.length === 0) { toast('Đơn hàng cần có ít nhất 1 sản phẩm', 'warning'); return; }
    // SUPER_SELLER → mở modal xác nhận để nhập người yêu cầu & lý do
    if (isSuperSeller) {
      setConfirmEditData({ requestedBy: '', editReason: '' });
      setStaffSearch(''); setStaffResults([]);
      setShowConfirmEdit(true);
      return;
    }
    // Seller thường → submit thẳng
    await doSave({});
  };

  const doSave = async (extra = {}) => {
    setSaving(true);
    try {
      const payload = { ...buildPayload(), ...extra };
      if (isSuperSeller) {
        await orderApi.superSellerUpdateOrder(orderId, payload);
      } else {
        await orderApi.updateOrderItems(orderId, payload);
      }
      toast('Đã cập nhật đơn hàng', 'success');
      onSaved?.();
      onClose();
    } catch (err) {
      toast(err?.response?.data?.message || 'Lỗi khi cập nhật đơn hàng', 'error');
    } finally { setSaving(false); }
  };

  if (!open) return null;
  const existingProductIds = new Set(items.map(i => i.productId));
  const orderCode = orderDetail?.orderCode ?? `#${orderId}`;

  return (
    <>
      {/* ── Confirm Edit Modal (SUPER_SELLER) ─────────────────────────────── */}
      {showConfirmEdit && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4">
          <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-hairline">
              <h3 className="font-bold text-ink">Xác nhận sửa đơn</h3>
              <button onClick={() => setShowConfirmEdit(false)}
                className="p-1.5 rounded-lg hover:bg-hairline text-muted">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {/* Ô 1: Tìm nhân viên */}
              <div>
                <label className="block text-xs font-semibold text-ink-2 mb-1.5">
                  Nhân viên yêu cầu sửa <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                  <input
                    className="w-full h-10 pl-8 pr-3 rounded-xl border border-hairline-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/30"
                    placeholder="Tìm theo tên nhân viên..."
                    value={staffSearch}
                    onChange={e => searchStaff(e.target.value)} />
                  {loadingStaff && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted animate-spin" />}
                </div>
                {/* Kết quả tìm kiếm */}
                {staffResults.length > 0 && !confirmEditData.requestedBy && (
                  <div className="mt-1 border border-hairline-2 rounded-xl overflow-hidden shadow-sm">
                    {staffResults.map(s => (
                      <button key={s.id}
                        onClick={() => {
                          const roles = s.roles || (s.role ? [s.role] : []);
                          const defaultRole = roles.length === 1 ? roles[0] : '';
                          setConfirmEditData(d => ({ ...d, requestedBy: s.fullName, requestedByRoles: roles, requestedByRole: defaultRole }));
                          setStaffSearch(s.fullName);
                          setStaffResults([]);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-canvas text-left transition-colors">
                        <User size={14} className="text-muted flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm text-ink font-medium truncate">{s.fullName}</p>
                          <p className="text-xs text-muted">{s.role}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {confirmEditData.requestedBy && (
                  <div className="mt-1.5 flex items-center gap-2 bg-gold/10 text-gold rounded-xl px-3 py-2">
                    <User size={13} />
                    <span className="text-sm font-medium flex-1">{confirmEditData.requestedBy}</span>
                    <button onClick={() => {
                      setConfirmEditData(d => ({ ...d, requestedBy: '' }));
                      setStaffSearch(''); setStaffResults([]);
                    }} className="text-muted hover:text-red-500">
                      <X size={13} />
                    </button>
                  </div>
                )}
              </div>

              {/* Role selector — hiện khi nhân viên có nhiều role */}
              {confirmEditData.requestedBy && confirmEditData.requestedByRoles.length > 1 && (
                <div>
                  <label className="block text-xs font-semibold text-ink-2 mb-1.5">
                    Role yêu cầu <span className="text-red-500">*</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {confirmEditData.requestedByRoles.map(r => (
                      <button key={r}
                        onClick={() => setConfirmEditData(d => ({ ...d, requestedByRole: r }))}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                          confirmEditData.requestedByRole === r
                            ? 'bg-gold text-white border-gold'
                            : 'bg-surface text-ink-2 border-hairline-2 hover:border-gold/50'
                        }`}>
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Ô 2: Lý do sửa */}
              <div>
                <label className="block text-xs font-semibold text-ink-2 mb-1.5">
                  Lý do sửa đơn <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  className="w-full rounded-xl border border-hairline-2 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold/30 resize-none placeholder:text-muted"
                  placeholder="Nhập lý do sửa đơn..."
                  value={confirmEditData.editReason}
                  onChange={e => setConfirmEditData(d => ({ ...d, editReason: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-hairline">
              <button onClick={() => setShowConfirmEdit(false)}
                className="px-4 py-2 rounded-xl border border-hairline-2 text-sm text-ink-2 hover:bg-hairline">
                Hủy
              </button>
              <button
                disabled={!confirmEditData.requestedBy || !confirmEditData.editReason.trim() || (confirmEditData.requestedByRoles.length > 1 && !confirmEditData.requestedByRole) || saving}
                onClick={async () => {
                  setShowConfirmEdit(false);
                  await doSave({
                    requestedBy: confirmEditData.requestedBy,
                    editReason: confirmEditData.editReason.trim(),
                    requestedByRole: confirmEditData.requestedByRole || undefined,
                  });
                }}
                className="px-4 py-2 rounded-xl bg-gold text-white text-sm font-semibold hover:bg-gold-strong disabled:opacity-40 flex items-center gap-2">
                {saving && <Loader2 size={14} className="animate-spin" />}
                Xác nhận sửa
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
        <div className="bg-surface w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh]">

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-line-soft shrink-0">
            <div>
              <h3 className="font-bold text-ink text-base">Sửa đơn hàng</h3>
              <p className="text-xs text-muted mt-0.5">{orderCode}</p>
            </div>
            <button onClick={onClose} className="p-1.5 text-muted hover:text-red-400 hover:bg-red-50 dark:bg-red-500/10 rounded-xl transition-colors">
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Banner cảnh báo WS — khi có người khác sửa đơn cùng lúc */}
            {wsOrderAlert && (
              <div className="mx-5 mt-3 px-3 py-2 bg-rose-50 dark:bg-rose-500/10 rounded-xl border border-rose-200 dark:border-rose-500/28 flex gap-2 items-start">
                <Bell size={14} className="text-rose-500 mt-0.5 shrink-0" />
                <p className="text-xs text-rose-700 dark:text-rose-300 flex-1">{wsOrderAlert}</p>
                <button onClick={() => setWsOrderAlert(null)} className="text-rose-400 hover:text-rose-600 dark:text-rose-300 shrink-0"><X size={12} /></button>
              </div>
            )}
            {/* Cảnh báo kho */}
            <div className="mx-5 mt-3 px-3 py-2 bg-amber-50 dark:bg-amber-500/10 rounded-xl border border-amber-200 dark:border-amber-500/28 flex gap-2 items-start">
              <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-700 dark:text-amber-300">Chỉ trừ/hoàn kho theo <strong>phần thay đổi</strong>. Tăng SL → trừ thêm; Giảm SL → hoàn kho; Món mới → trừ toàn bộ.</p>
            </div>

            {!fetchingDetail && (
              <div className="mx-5 mt-3 bg-surface rounded-xl border border-line-soft overflow-hidden">
                <p className="text-[10px] font-bold text-muted uppercase tracking-wider px-4 pt-3 pb-2">Thông tin đơn hàng</p>
                <div className="px-4 pb-3 space-y-2">

                  {/* ── Khách hàng ── */}
                  <div>
                    <label className="text-[10px] text-muted font-semibold flex items-center gap-1 mb-1">
                      <User size={10} />Khách hàng
                    </label>
                    <button
                      onClick={() => setCustomerModalOpen(true)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm transition-all
                        ${selectedCustomer
                          ? 'border-gold bg-gold/5'
                          : 'border-dashed border-line text-muted hover:border-gold'}`}
                    >
                      {selectedCustomer ? (
                        <>
                          <UserCheck size={14} className="text-gold shrink-0" />
                          <div className="flex-1 text-left min-w-0">
                            <p className="font-semibold text-xs truncate text-ink">
                              {selectedCustomer.contactName || selectedCustomer.name || 'Khách hàng'}
                            </p>
                            <p className="text-[10px] text-muted truncate">
                              {selectedCustomer.customerCode && `${selectedCustomer.customerCode} · `}{selectedCustomer.phone}
                            </p>
                          </div>
                          <button
                            onClick={e => { e.stopPropagation(); handleClearCustomer(); }}
                            className="text-faint hover:text-red-400 shrink-0 p-0.5 rounded"
                          >
                            <X size={12} />
                          </button>
                        </>
                      ) : (
                        <>
                          <UserPlus size={14} className="shrink-0" />
                          <span className="text-xs">
                            {orderDetail?.customerName
                              ? `${orderDetail.customerName}${orderDetail.customerPhone ? ' · ' + orderDetail.customerPhone : ''} (click để đổi)`
                              : 'Chọn khách hàng'}
                          </span>
                        </>
                      )}
                    </button>

                    {selectedCustomer?.selectedReceiver?.receiverAddress && (
                      <div className="mt-1 flex items-start gap-1.5 px-2">
                        <MapPin size={10} className="text-gold mt-0.5 shrink-0" />
                        <p className="text-[10px] text-ink-2 truncate">
                          {selectedCustomer.selectedReceiver.receiverAddress}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Người đặt & Người nhận */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-muted font-semibold flex items-center gap-1 mb-1"><User size={10} />Người đặt</label>
                      <input value={orderedByName} onChange={e => setOrderedByName(e.target.value)} placeholder="Tên người đặt..."
                        className="w-full px-2 py-1.5 text-xs border border-line rounded-lg focus:outline-none focus:border-gold" />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted font-semibold flex items-center gap-1 mb-1"><User size={10} />Người nhận</label>
                      <input value={receiverName} onChange={e => setReceiverName(e.target.value)} placeholder="Tên người nhận..."
                        className="w-full px-2 py-1.5 text-xs border border-line rounded-lg focus:outline-none focus:border-gold" />
                    </div>
                  </div>

                  {/* Địa chỉ giao */}
                  <div>
                    <label className="text-[10px] text-muted font-semibold flex items-center gap-1 mb-1"><MapPin size={10} />Địa chỉ giao hàng</label>
                    <input value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} placeholder="Địa chỉ..."
                      className="w-full px-2 py-1.5 text-xs border border-line rounded-lg focus:outline-none focus:border-gold" />
                  </div>

                  {/* Giờ giao & Thanh toán */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-muted font-semibold flex items-center gap-1 mb-1"><Clock size={10} />Giờ giao hàng</label>
                      <input type="datetime-local" value={deliveryDatetime} onChange={e => setDeliveryDatetime(e.target.value)}
                        className="w-full px-2 py-1.5 text-xs border border-line rounded-lg focus:outline-none focus:border-gold" />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted font-semibold flex items-center gap-1 mb-1"><CreditCard size={10} />Thanh toán</label>
                      <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}
                        className="w-full px-2 py-1.5 text-xs border border-line rounded-lg focus:outline-none focus:border-gold bg-surface">
                        {/* Công nợ mở theo `debtAllowed` (khách cũ được miễn hợp
                            đồng, khách mới thì bắt buộc). Đơn ĐANG là công nợ vẫn
                            giữ lựa chọn để không khoá người dùng ở một giá trị
                            không chọn lại được. */}
                        {PAYMENT_METHODS
                          .filter(m => m.value !== 'DEBT'
                            || selectedCustomer?.debtAllowed
                            || paymentMethod === 'DEBT')
                          .map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Ghi chú */}
                  <div>
                    <label className="text-[10px] text-muted font-semibold mb-1 block">Ghi chú</label>
                    <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Ghi chú đơn hàng..."
                      className="w-full px-2 py-1.5 text-xs border border-line rounded-lg focus:outline-none focus:border-gold resize-none" />
                  </div>

                  {/* Người giao hàng — chỉ SUPER_SELLER */}
                  {isSuperSeller && (
                    <div className="pt-2 border-t border-line-soft">
                      <label className="block text-[10px] text-muted font-semibold mb-1.5">🚚 Người giao hàng</label>
                      <div className="space-y-2">
                        {deliveryDrivers.map((d, idx) => (
                          <div key={idx} className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              {/* Loại xe — đổi type sẽ reset search + kết quả */}
                              <select
                                className="px-2 py-1.5 text-xs border border-line rounded-lg focus:outline-none focus:border-gold bg-surface shrink-0"
                                value={d.type}
                                onChange={e => {
                                  const newType = e.target.value;
                                  setDeliveryDrivers(prev => prev.map((r,i) => i===idx ? {...r, type: newType, name: ''} : r));
                                  setDriverSearches(prev => ({ ...prev, [idx]: '' }));
                                  setDriverResults(prev => ({ ...prev, [idx]: [] }));
                                }}>
                                <option value="BIKE">🛵 Xe máy</option>
                                <option value="TRUCK">🚛 Xe tải</option>
                              </select>

                              {/* Search tài xế */}
                              <div className="relative flex-1">
                                <input
                                  className="w-full px-2 py-1.5 text-xs border border-line rounded-lg focus:outline-none focus:border-gold"
                                  placeholder="Tìm tên tài xế..."
                                  value={driverSearches[idx] ?? d.name}
                                  onChange={e => searchDriver(idx, e.target.value, d.type)}
                                />
                                {/* Kết quả dropdown */}
                                {(driverResults[idx] || []).length > 0 && (
                                  <div className="absolute top-full left-0 right-0 mt-0.5 bg-surface border border-line rounded-lg shadow-lg z-10 overflow-hidden max-h-32 overflow-y-auto">
                                    {(driverResults[idx] || []).map((dr, di) => (
                                      <button key={di}
                                        onMouseDown={e => { e.preventDefault(); selectDriver(idx, dr.name); }}
                                        className="w-full flex items-center gap-2 px-2.5 py-2 text-xs hover:bg-gold-tint text-left">
                                        <span>{dr.vehicleType === 'TRUCK' ? '🚛' : '🛵'}</span>
                                        <span className="font-medium text-ink">{dr.name}</span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Số lượt */}
                              <div className="flex items-center gap-1 shrink-0">
                                <button onClick={() => setDeliveryDrivers(prev => prev.map((r,i) => i===idx ? {...r, trips: Math.max(1, r.trips-1)} : r))}
                                  className="w-5 h-5 rounded-full bg-surface-2 text-xs font-bold flex items-center justify-center hover:bg-surface-3">−</button>
                                <span className="text-xs font-bold w-5 text-center">{d.trips}</span>
                                <button onClick={() => setDeliveryDrivers(prev => prev.map((r,i) => i===idx ? {...r, trips: r.trips+1} : r))}
                                  className="w-5 h-5 rounded-full bg-surface-2 text-xs font-bold flex items-center justify-center hover:bg-surface-3">+</button>
                              </div>

                              {/* Xóa */}
                              <button
                                onClick={() => {
                                  setDeliveryDrivers(prev => prev.filter((_,i) => i!==idx));
                                  setDriverSearches(prev => { const n={...prev}; delete n[idx]; return n; });
                                  setDriverResults(prev => { const n={...prev}; delete n[idx]; return n; });
                                }}
                                className="w-5 h-5 rounded-full text-faint hover:text-red-400 hover:bg-red-50 dark:bg-red-500/10 flex items-center justify-center flex-shrink-0">
                                <X size={11} />
                              </button>
                            </div>
                          </div>
                        ))}

                        <button
                          onClick={() => setDeliveryDrivers(prev => [...prev, { name: '', type: 'BIKE', trips: 1 }])}
                          className="flex items-center gap-1 text-[11px] text-gold hover:text-gold-deep font-semibold py-1">
                          <Plus size={12} /> Thêm tài xế
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Hiển thị giá */}
                  <div className="pt-2 border-t border-line-soft">
                    <label className="block text-[10px] text-muted font-semibold mb-1.5">💰 Hiển thị giá</label>
                    <select
                      value={priceDisplayOption}
                      onChange={e => setPriceDisplayOption(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-line rounded-xl focus:outline-none focus:border-gold bg-surface"
                    >
                      <option value="show">Hiển thị đầy đủ giá</option>
                      <option value="hide_prices">Che giá (ẩn giá từng sản phẩm, chỉ hiện tổng)</option>
                      <option value="hide_all">Che toàn bộ (ẩn tất cả số tiền)</option>
                    </select>
                    <p className="text-[9px] text-muted mt-1">
                      {priceDisplayOption === 'show' && '✓ Hiển thị tất cả giá trên phiếu'}
                      {priceDisplayOption === 'hide_prices' && '✓ Ẩn giá từng sản phẩm, vẫn hiển thị tổng tiền'}
                      {priceDisplayOption === 'hide_all' && '✓ Ẩn toàn bộ số tiền trên phiếu'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Danh sách sản phẩm */}
            <div className="px-5 py-3">
              {fetchingDetail ? (
                <div className="flex items-center justify-center py-10 gap-2 text-muted">
                  <Loader2 size={18} className="animate-spin" /><span className="text-sm">Đang tải đơn hàng...</span>
                </div>
              ) : items.length === 0 ? (
                <p className="text-sm text-muted text-center py-6">Chưa có sản phẩm nào</p>
              ) : (
                items.map(item => (
                  <EditItemRow key={item._editId} item={item}
                    prodInfo={allProducts.find(p => p.id === item.productId)}
                    onUpdateQty={updateQty} onRemove={removeItem} onPriceOverride={priceOverride}
                    onDiscountChange={discountChange} onPromoToggle={promoToggle}
                    onVatRateChange={vatRateChange} onTierSelect={handleTierSelect} />
                ))
              )}

              {!fetchingDetail && (
                <button onClick={() => setShowPicker(true)}
                  className="w-full mt-3 py-2.5 rounded-xl border-2 border-dashed border-line text-muted text-xs font-semibold flex items-center justify-center gap-1.5 hover:border-gold hover:text-gold transition-colors">
                  <Plus size={13} />Thêm sản phẩm<ChevronRight size={12} className="opacity-60" />
                </button>
              )}
            </div>

            {/* Tổng tiền */}
            {!fetchingDetail && items.length > 0 && (
              <div className="mx-5 mb-3 bg-surface rounded-xl border border-line-soft px-4 py-3 space-y-2">
                {/* Giảm giá */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted shrink-0 w-20">Giảm giá:</span>
                  <div className="flex items-center gap-1 flex-wrap flex-1">
                    {[0, 3, 5, 8, 10].map(d => (
                      <button key={d} onClick={() => { setDiscount(d); setDiscountFixed(null); setDiscountFixedDisplay(''); }}
                        className={`text-[10px] px-2 py-1 rounded-md font-semibold transition-colors ${discount === d && discountFixed === null ? 'bg-gold text-white' : 'bg-surface-2 text-muted hover:bg-surface-3'}`}>
                        {d}%
                      </button>
                    ))}
                    {discountFixed === null
                      ? <button onClick={() => { setDiscount(0); setDiscountFixed(0); setDiscountFixedDisplay(''); }} className="text-[10px] px-2 py-1 rounded-md font-semibold bg-surface-2 text-muted hover:bg-surface-3">Nhập tiền</button>
                      : <div className="flex items-center gap-1">
                        <div className="relative">
                          <input type="text" inputMode="numeric" value={discountFixedDisplay}
                            onChange={e => { const raw = e.target.value.replace(/[^0-9]/g, ''); setDiscountFixedDisplay(raw); setDiscountFixed(raw === '' ? 0 : parseInt(raw, 10)); }}
                            placeholder={`tối đa ${new Intl.NumberFormat('vi-VN').format(maxDiscountFixed)}`}
                            className="w-28 rounded-md px-2 py-1 text-[10px] text-right pr-5 border border-gold bg-gold/5 font-semibold text-gold focus:outline-none" />
                          <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted">đ</span>
                        </div>
                        <button onClick={() => { setDiscountFixed(null); setDiscountFixedDisplay(''); }} className="text-[10px] px-1.5 py-1 rounded-md bg-surface-2 text-muted hover:bg-surface-3 font-semibold">×</button>
                      </div>}
                  </div>
                </div>

                {/* Phụ phí */}
                <div className="flex items-start gap-2">
                  <span className="text-xs text-muted shrink-0 w-20 mt-1.5">Phụ phí:</span>
                  <div className="flex-1">
                    <SurchargePanel surchargeItems={surchargeItems} onChange={setSurchargeItems} />
                  </div>
                </div>

                {/* Summary */}
                <div className="space-y-0.5 pt-2 border-t border-line-soft">
                  {/* Tạm tính = tổng NET (chưa thuế) */}
                  <div className="flex justify-between text-xs text-muted">
                    <span>Tạm tính</span><span>{fmt(subtotalGross)}</span>  {/* ← đổi từ subtotalGross cũ */}
                  </div>
                  {(itemDiscountTotal > 0 || discountAmt > 0) && (
                    <div className="flex justify-between text-xs text-emerald-600 dark:text-emerald-300">
                      <span>Giảm</span><span>-{fmt(itemDiscountTotal + discountAmt)}</span>
                    </div>
                  )}
                  {surchargeNum > 0 && (
                    <div>
                      <div className="flex justify-between text-xs text-orange-500">
                        <span>Phụ phí</span><span>+{fmt(surchargeNum)}</span>
                      </div>
                      {surchargeItems.filter(i => Number(i.amount) > 0).map(i => (
                        <div key={i.name} className="flex justify-between pl-3">
                          <span className="text-[10px] text-orange-400">• {i.name}</span>
                          <span className="text-[10px] text-orange-400">+{fmt(i.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {exclusiveVatTotal > 0 && (
                    <div className="flex justify-between text-xs text-muted">
                      <span>VAT (ngoài giá)</span><span>+{fmt(exclusiveVatTotal)}</span>
                    </div>
                  )}
                  {inclusiveVatTotal > 0 && (
                    <div className="flex justify-between text-xs text-faint">
                      <span>VAT (đã bao gồm trong giá)</span><span>{fmt(inclusiveVatTotal)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-bold text-ink pt-1 border-t border-line-soft">
                    <span>Tổng ({items.length} món)</span>
                    <span className="text-gold">{fmt(total)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 pb-5 pt-3 border-t border-line-soft shrink-0 flex gap-2">
            <button onClick={onClose} disabled={saving}
              className="flex-1 py-2.5 rounded-xl border border-line text-sm text-ink-2 font-semibold hover:bg-surface-2 transition-colors disabled:opacity-50">
              Hủy
            </button>
            <button onClick={handleSave} disabled={saving || items.length === 0 || fetchingDetail}
              className="flex-1 py-2.5 rounded-xl bg-gold text-white text-sm font-bold flex items-center justify-center gap-2 hover:bg-[var(--c-gold-strong)] transition-colors disabled:opacity-50">
              {saving
                ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Đang lưu...</>
                : <><Save size={14} />Lưu thay đổi</>}
            </button>
          </div>
        </div>
      </div>

      {/* Modals con */}
      {showPicker && (
        <ProductPickerModal
          onAdd={addProduct}
          onClose={() => setShowPicker(false)}
          existingIds={existingProductIds}
        />
      )}

      {tierProduct && (
        <TierSelectModal
          product={tierProduct}
          currentTierId={items.find(i => i._editId === tierEditId)?.tierId}
          currentPriceSource={items.find(i => i._editId === tierEditId)?.priceSource ?? 'BASE'}
          onConfirm={handleTierConfirm}
          onClose={() => { setTierEditId(null); setTierProduct(null); }}
        />
      )}

      <CustomerSearchModal
        open={customerModalOpen}
        onClose={() => setCustomerModalOpen(false)}
        onSelect={handleSelectCustomer}
        selected={selectedCustomer}
      />
    </>
  );
}