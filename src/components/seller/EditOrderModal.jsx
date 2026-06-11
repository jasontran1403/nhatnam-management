// src/components/seller/EditOrderModal.jsx
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  X, Plus, Trash2, Save, AlertTriangle, Search,
  Grid, ChevronRight, Package, Loader2, Pencil, Percent,
  Check, Gift, ChevronDown, User, Clock, CreditCard, MapPin,
  UserCheck, UserPlus, Building2,
} from 'lucide-react';
import { orderApi, productApi, categoryApi } from '../../api/services';
import api from '../../api/axios';
import { useToast } from '../common/Toast';

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
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#F0EBE3] shrink-0">
          <h3 className="font-bold text-[#1C1C1E] text-sm">
            {selectedCustomer ? 'Chọn địa chỉ nhận hàng' : 'Tìm khách hàng'}
          </h3>
          <div className="flex items-center gap-2">
            {selectedCustomer && (
              <button
                onClick={() => { setSelectedCustomer(null); setReceiverInfos([]); }}
                className="text-[11px] text-[#C9A84C] font-semibold hover:underline"
              >
                ← Quay lại
              </button>
            )}
            <button onClick={onClose} className="p-1.5 text-[#8E8878] hover:text-red-400 rounded-xl">
              <X size={16} />
            </button>
          </div>
        </div>

        {!selectedCustomer ? (
          <>
            <div className="px-4 py-2 shrink-0 border-b border-[#F0EBE3]">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8878]" />
                <input
                  ref={searchRef}
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  placeholder="Tìm theo tên, mã, SĐT..."
                  className="w-full pl-8 pr-3 py-2 text-sm border border-[#E8DDD0] rounded-xl outline-none focus:border-[#C9A84C]"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {loadingCustomers ? (
                <div className="flex items-center justify-center py-10 gap-2 text-[#8E8878]">
                  <Loader2 size={18} className="animate-spin" />
                  <span className="text-sm">Đang tải...</span>
                </div>
              ) : customers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-[#8E8878] gap-2">
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
                          ${isSelected ? 'bg-[#C9A84C]/10 border border-[#C9A84C]/30' : 'hover:bg-[#FDF8ED]'}`}
                      >
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0
                          ${isCompany ? 'bg-blue-50' : 'bg-[#F0EBE3]'}`}>
                          {isCompany
                            ? <Building2 size={16} className="text-blue-500" />
                            : <User size={16} className="text-[#C4B9A8]" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[#1C1C1E] truncate">
                            {c.contactName || c.name || c.companyName || 'Khách vãng lai'}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span className="text-[10px] text-[#8E8878]">{c.customerCode}</span>
                            {c.phone && <span className="text-[10px] text-[#8E8878]">· {c.phone}</span>}
                            {isCompany && (
                              <span className="text-[9px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full font-semibold">
                                Công ty
                              </span>
                            )}
                            {isSelected && (
                              <span className="text-[9px] bg-[#C9A84C]/20 text-[#C9A84C] px-1.5 py-0.5 rounded-full font-semibold">
                                Đang chọn
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronRight size={14} className="text-[#C4B9A8] group-hover:text-[#C9A84C] shrink-0" />
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
            <div className="px-4 pt-3 pb-2 bg-[#FDF8ED] border-b border-[#F0EBE3]">
              <div className="flex items-center gap-2">
                <UserCheck size={14} className="text-[#C9A84C]" />
                <div>
                  <p className="text-sm font-semibold text-[#1C1C1E]">
                    {selectedCustomer.contactName || selectedCustomer.name || selectedCustomer.companyName}
                  </p>
                  <p className="text-[10px] text-[#8E8878]">
                    {selectedCustomer.customerCode}
                    {selectedCustomer.phone && ` · ${selectedCustomer.phone}`}
                  </p>
                </div>
              </div>
            </div>

            {/* Không có địa chỉ nhận */}
            <button
              onClick={() => handleConfirm(null)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#FDF8ED] text-left border-b border-[#F0EBE3] transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-[#F0EBE3] flex items-center justify-center shrink-0">
                <UserCheck size={14} className="text-[#8E8878]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#1C1C1E]">Không chọn địa chỉ nhận</p>
                <p className="text-[10px] text-[#8E8878]">Dùng thông tin khách hàng</p>
              </div>
            </button>

            {/* Danh sách địa chỉ nhận */}
            {loadingReceivers ? (
              <div className="flex items-center justify-center py-8 gap-2 text-[#8E8878]">
                <Loader2 size={16} className="animate-spin" />
                <span className="text-sm">Đang tải địa chỉ...</span>
              </div>
            ) : receiverInfos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-[#8E8878] gap-1">
                <MapPin size={24} strokeWidth={1} />
                <p className="text-sm">Không có địa chỉ nhận</p>
              </div>
            ) : (
              <div className="px-2 py-2 space-y-0.5">
                {receiverInfos.map((r, idx) => (
                  <button
                    key={r.id}
                    onClick={() => handleConfirm(r)}
                    className="w-full flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-[#FDF8ED] text-left transition-colors group"
                  >
                    <div className="w-7 h-7 rounded-full bg-[#F0EBE3] flex items-center justify-center shrink-0 mt-0.5">
                      <MapPin size={12} className="text-[#C4B9A8]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {r.receiverName && (
                          <p className="text-xs font-semibold text-[#1C1C1E]">{r.receiverName}</p>
                        )}
                        {r.isDefault && (
                          <span className="text-[9px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-full font-semibold">
                            Mặc định
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#5C4E3D] mt-0.5 truncate">{r.receiverAddress}</p>
                      {r.receiverPhone && (
                        <p className="text-[10px] text-[#8E8878]">{r.receiverPhone}</p>
                      )}
                    </div>
                    <Check size={14} className="text-[#C4B9A8] group-hover:text-[#C9A84C] shrink-0 mt-1" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="px-4 py-3 border-t border-[#F0EBE3] shrink-0 text-center">
          <p className="text-[11px] text-[#8E8878]">
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
          <span className="text-[11px] text-[#5C4E3D] font-medium w-28 shrink-0 truncate">{item.name}</span>
          <div className="relative flex-1">
            <input
              type="text"
              inputMode="numeric"
              value={item.amount === 0 ? '' : new Intl.NumberFormat('vi-VN').format(item.amount)}
              onChange={e => updateAmount(item.name, e.target.value)}
              placeholder="0"
              className="w-full rounded-lg border border-[#E8DDD0] px-2 py-1 text-xs text-right pr-6 focus:outline-none focus:border-[#C9A84C]"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[#8E8878]">đ</span>
          </div>
          <button
            onClick={() => removeItem(item.name)}
            className="w-5 h-5 rounded-full flex items-center justify-center text-[#C4B9A8] hover:text-red-400 hover:bg-red-50 transition-colors shrink-0"
          >
            <X size={12} />
          </button>
        </div>
      ))}

      {!showAddForm ? (
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-1 text-[11px] text-[#C9A84C] hover:text-[#a07830] font-semibold py-1 transition-colors"
        >
          <Plus size={12} /> Thêm phụ phí
        </button>
      ) : (
        <div className="bg-[#FDF8ED] rounded-xl border border-[#C9A84C]/20 p-3 space-y-3">
          {availablePresets.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {availablePresets.map(preset => (
                <button
                  key={preset.name}
                  onClick={() => addPreset(preset)}
                  className="text-[10px] px-2.5 py-1 rounded-lg bg-white border border-[#E8DDD0] text-[#5C4E3D] hover:border-[#C9A84C] hover:bg-[#FDF8ED] font-medium transition-colors"
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
                className="flex-1 rounded-lg border border-[#E8DDD0] px-2 py-1.5 text-[11px] focus:outline-none focus:border-[#C9A84C] bg-white"
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
                  className="w-full rounded-lg border border-[#E8DDD0] px-2 py-1.5 text-[11px] text-right pr-5 focus:outline-none focus:border-[#C9A84C] bg-white"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[#8E8878]">đ</span>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setShowAddForm(false); setCustomName(''); setCustomAmount(''); }}
                className="px-3 py-1 rounded-lg border border-[#E8DDD0] text-[#8E8878] text-[10px] font-medium hover:bg-[#F0EBE3] transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={addCustom}
                disabled={!customName.trim()}
                className="px-3 py-1 rounded-lg bg-[#C9A84C] text-white text-[10px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#b8963d] transition-colors"
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
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden">
        <div className="bg-gradient-to-r from-[#C9A84C] to-[#b8963d] px-5 py-4 flex items-center justify-between">
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
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${currentPriceSource === 'BASE' ? 'border-sky-400 bg-sky-50' : 'border-[#E8DDD0] hover:border-sky-300'}`}
          >
            <p className="text-sm font-semibold">Giá lẻ</p>
            <p className="text-sm font-bold text-sky-600">{fmt(product?.basePrice)}</p>
          </button>
          {(product?.priceTiers ?? []).slice().sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)).map((tier, idx) => (
            <button
              key={tier.id}
              onClick={() => onConfirm({ priceSource: 'TIER', tierId: tier.id, tierName: tier.tierName, unitPrice: tier.price })}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${currentTierId === tier.id ? 'border-orange-400 bg-orange-50' : 'border-[#E8DDD0] hover:border-orange-300'}`}
            >
              <p className="text-sm font-semibold">{tier.tierName || `Sỉ ${idx + 1}`}</p>
              <p className="text-sm font-bold text-orange-600">{fmt(tier.price)}</p>
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
    ? <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold bg-purple-100 text-purple-700 border border-purple-200">Thủ công</span>
    : item.priceSource === 'TIER'
      ? <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold bg-orange-100 text-orange-700 border border-orange-200">{item.tierName || 'Giá sỉ'}</span>
      : <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold bg-sky-100 text-sky-700 border border-sky-200">Giá lẻ</span>;

  return (
    <div className="py-3 border-b border-[#F0EBE3] last:border-0">
      <div className="flex items-start gap-3">
        {item.productImageUrl
          ? <img src={`${BASE_URL}/api/auth${item.productImageUrl}`} alt={item.productName} className="w-10 h-10 rounded-lg object-cover shrink-0 border border-[#F0EBE3]" />
          : <div className="w-10 h-10 rounded-lg shrink-0 bg-[#F0EBE3] flex items-center justify-center"><Package size={14} className="text-[#C4B9A8]" /></div>}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="font-semibold text-sm text-[#1C1C1E] truncate">{item.productName}</p>
            {isNew && <span className="text-[9px] bg-emerald-100 text-emerald-700 rounded-full px-1.5 py-0.5 font-bold shrink-0">MỚI</span>}
            {!isNew && deltaQty > 0 && <span className="text-[9px] bg-amber-100 text-amber-700 rounded-full px-1.5 py-0.5 font-bold shrink-0">+{deltaQty} trừ kho</span>}
            {!isNew && deltaQty < 0 && <span className="text-[9px] bg-sky-100 text-sky-700 rounded-full px-1.5 py-0.5 font-bold shrink-0">{deltaQty} hoàn kho</span>}
          </div>

          <div className="flex items-center gap-1 flex-wrap mt-0.5">
            <button onClick={() => onTierSelect(item._editId)} className="hover:opacity-75 transition-opacity">{priceBadge}</button>

            {item.saleType === 'BOX' && item.unitsPerBox > 0 && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold bg-indigo-50 text-indigo-600 border border-indigo-200">
                {item.unitsPerBox} hộp/thùng
              </span>
            )}

            <button
              onClick={() => { if (isExclusive) setShowVatPicker(p => !p); }}
              className={`flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full font-semibold border transition-colors
                ${vatRate > 0
                  ? isExclusive ? 'bg-emerald-50 text-emerald-700 border-emerald-200 cursor-pointer hover:bg-emerald-100'
                    : 'bg-amber-50 text-amber-700 border-amber-200 cursor-default'
                  : isExclusive ? 'bg-gray-50 text-gray-500 border-gray-200 cursor-pointer hover:bg-emerald-50'
                    : 'bg-gray-50 text-gray-400 border-gray-200 cursor-default'}`}
            >
              {vatRate > 0 ? `VAT ${vatRate}% ${isExclusive ? '(ngoài)' : '(trong)'}` : isExclusive ? 'Chọn VAT' : 'Không VAT'}
              {isExclusive && <ChevronDown size={8} />}
            </button>
          </div>

          {showVatPicker && isExclusive && (
            <div className="mt-1.5 flex items-center gap-1 flex-wrap bg-emerald-50 rounded-lg px-2 py-1.5 border border-emerald-200">
              <span className="text-[9px] text-emerald-700 font-semibold mr-1">Thuế %:</span>
              {EXCLUSIVE_VAT.map(r => (
                <button key={r} onClick={() => { onVatRateChange(item._editId, r); setShowVatPicker(false); }}
                  className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${vatRate === r ? 'bg-emerald-600 text-white' : 'bg-white text-emerald-700 border border-emerald-300 hover:bg-emerald-100'}`}>
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
                  className="w-24 text-xs border-2 border-[#C9A84C] rounded-lg px-2 py-1 focus:outline-none font-semibold" />
                <span className="text-[10px] text-[#8E8878]">đ</span>
              </div>
            ) : (
              <button onClick={startEditPrice} className="flex items-center gap-1 group">
                {/* Hiển thị giá NET (chưa thuế) */}
                <span className={`text-xs font-bold ${item.priceSource === 'MANUAL' ? 'text-purple-600' : 'text-[#C9A84C] group-hover:text-[#A07830]'}`}>
                  {fmt(netPrice)}
                </span>
                <Pencil size={9} className="text-[#C4B9A8] group-hover:text-[#C9A84C]" />
              </button>
            )}
            <div className="ml-auto flex items-center gap-1 shrink-0">
              {!isPromo && (itemDiscount > 0
                ? <button onClick={openDiscount} className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-600 border border-orange-200 font-semibold hover:bg-orange-200"><Percent size={8} />-{itemDiscount}%</button>
                : <button onClick={openDiscount} className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-[#F5F0E8] text-[#C4B9A8] border border-[#E8DDD0] hover:bg-[#EDE8DF]"><Percent size={8} />CK</button>)}
              <button onClick={togglePromo}
                className={`flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full font-semibold border transition-colors
                  ${isPromo ? 'bg-rose-100 text-rose-600 border-rose-300' : 'bg-[#F5F0E8] text-[#C4B9A8] border-[#E8DDD0] hover:bg-rose-50 hover:text-rose-400'}`}>
                <Gift size={8} />KM
              </button>
            </div>
          </div>

          {showDiscount && (
            <div className="mt-1.5 flex items-center gap-1.5 bg-[#FAF7F2] rounded-lg px-2 py-1.5 border border-[#E8DDD0]">
              <input ref={discountRef} type="text" inputMode="numeric" value={discountInput}
                onChange={e => setDiscountInput(e.target.value.replace(/[^0-9]/g, ''))}
                onKeyDown={e => { if (e.key === 'Enter') commitDiscount(); if (e.key === 'Escape') setShowDiscount(false); }}
                placeholder="0" className="w-10 text-xs text-center border border-[#E8DDD0] rounded-lg px-1 py-1 focus:outline-none focus:border-[#C9A84C] bg-white font-semibold" />
              <span className="text-[10px] text-[#8E8878]">%</span>
              <button onClick={commitDiscount} className="w-5 h-5 rounded-full bg-[#C9A84C] text-white flex items-center justify-center"><Check size={10} /></button>
              {itemDiscount > 0 && <button onClick={() => { onDiscountChange(item._editId, 0); setShowDiscount(false); }} className="text-[9px] text-red-400 hover:text-red-600">xóa</button>}
            </div>
          )}

          {showPromoNote && (
            <div className="mt-1.5 flex items-center gap-1.5 bg-rose-50 rounded-lg px-2 py-1.5 border border-rose-200">
              <input ref={promoRef} type="text" value={promoNoteInput} onChange={e => setPromoNoteInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') commitPromo(); if (e.key === 'Escape') setShowPromoNote(false); }}
                placeholder="Ghi chú KM..." className="flex-1 text-[10px] border border-rose-200 rounded-lg px-2 py-1 focus:outline-none focus:border-rose-400 bg-white" />
              <button onClick={commitPromo} className="w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center"><Check size={10} /></button>
            </div>
          )}
          {isPromo && item.promoNote && !showPromoNote && (
            <button onClick={openPromo} className="mt-0.5 text-[9px] text-rose-500 italic truncate max-w-full text-left">📌 {item.promoNote}</button>
          )}

          {!isPromo && (
            <p className="text-[10px] text-[#8E8878] mt-0.5">
              = {fmt(lineNet)}
              {itemDiscount > 0 && <span className="text-emerald-600 ml-1">→ {fmt(lineNet * (1 - itemDiscount / 100))}</span>}
            </p>
          )}
        </div>

        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <button onClick={() => onRemove(item._editId)} className="w-5 h-5 rounded-full text-[#C4B9A8] hover:text-red-400 hover:bg-red-50 flex items-center justify-center">
            <Trash2 size={11} />
          </button>
          <div className="flex items-center gap-1">
            <button onClick={() => onUpdateQty(item._editId, item.quantity - 1)} className="w-6 h-6 rounded-full bg-[#F0EBE3] text-sm font-bold flex items-center justify-center hover:bg-[#E8DDD0]">−</button>
            {isEditingQty ? (
              <input
                ref={qtyInputRef}
                type="text"
                inputMode="decimal"
                value={qtyInput}
                onChange={e => setQtyInput(e.target.value.replace(/[^0-9.,]/g, ''))}
                onBlur={commitQty}
                onKeyDown={handleQtyKeyDown}
                className="w-12 text-center text-sm font-bold border-2 border-[#C9A84C] rounded-lg px-1 py-0.5 focus:outline-none"
              />
            ) : (
              <span
                onClick={startEditQty}
                className="text-sm font-bold w-10 text-center cursor-pointer hover:bg-[#F0EBE3] rounded-lg py-0.5 transition-colors"
              >
                {item.quantity}
              </span>
            )}
            <button onClick={() => onUpdateQty(item._editId, item.quantity + 1)} className="w-6 h-6 rounded-full bg-[#F0EBE3] text-sm font-bold flex items-center justify-center hover:bg-[#E8DDD0]">+</button>
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
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#F0EBE3] shrink-0">
          <h3 className="font-bold text-[#1C1C1E] text-sm">Chọn sản phẩm</h3>
          <button onClick={onClose} className="p-1.5 text-[#8E8878] hover:text-red-400 rounded-xl"><X size={16} /></button>
        </div>
        <div className="px-4 py-2 shrink-0 border-b border-[#F0EBE3]">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8878]" />
            <input ref={searchRef} value={q} onChange={e => setQ(e.target.value)} placeholder="Tìm sản phẩm..."
              className="w-full pl-8 pr-3 py-2 text-sm border border-[#E8DDD0] rounded-xl outline-none focus:border-[#C9A84C]" />
          </div>
        </div>
        {categories.length > 0 && (
          <div className="flex gap-1.5 px-4 py-2 overflow-x-auto scrollbar-hide shrink-0 border-b border-[#F0EBE3]">
            <button
              onClick={() => setSelectedCat('ALL')}
              className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors
                ${selectedCat === 'ALL' ? 'bg-[#C9A84C] text-white' : 'bg-[#F0EBE3] text-[#5C4E3D] hover:bg-[#E8DDD0]'}`}
            >
              <Grid size={10} />Tất cả
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCat(cat.id)} // giữ nguyên integer
                className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap transition-colors
                  ${Number(selectedCat) === Number(cat.id) ? 'bg-[#C9A84C] text-white' : 'bg-[#F0EBE3] text-[#5C4E3D] hover:bg-[#E8DDD0]'}`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}
        <div className="flex-1 overflow-y-auto">
          {loading
            ? <div className="flex items-center justify-center py-12 gap-2 text-[#8E8878]">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">Đang tải...</span>
            </div>
            : products.length === 0
              ? <div className="flex flex-col items-center justify-center py-12 text-[#8E8878] gap-2">
                <Search size={28} strokeWidth={1} />
                <p className="text-sm">Không tìm thấy</p>
              </div>
              : <div className="px-2 py-2 space-y-0.5">
                {products.map(p => (
                  <button key={p.id} onClick={() => onAdd(p)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#FDF8ED] text-left transition-colors group">
                    {p.imageUrl
                      ? <img src={p.imageUrl.startsWith('http') ? p.imageUrl : `${BASE_URL}/api/auth${p.imageUrl}`}
                        alt={p.name} className="w-10 h-10 rounded-xl object-cover shrink-0 border border-[#F0EBE3]" />
                      : <div className="w-10 h-10 rounded-xl shrink-0 bg-[#F0EBE3] flex items-center justify-center">
                        <Package size={14} className="text-[#C4B9A8]" />
                      </div>}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#1C1C1E] truncate">{p.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-[#C9A84C] font-medium">{fmt(p.basePrice)}</p>
                        {p.categoryName && (
                          <span className="text-[10px] bg-[#F0EBE3] text-[#8E8878] rounded-full px-1.5 py-0.5">
                            {p.categoryName}
                          </span>
                        )}
                        {existingIds.has(p.id) && (
                          <span className="text-[10px] bg-sky-100 text-sky-700 rounded-full px-1.5 py-0.5 font-semibold">
                            Đang có
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="w-7 h-7 rounded-full bg-[#C9A84C]/10 flex items-center justify-center group-hover:bg-[#C9A84C] transition-colors shrink-0">
                      <Plus size={13} className="text-[#C9A84C] group-hover:text-white" />
                    </div>
                  </button>
                ))}
              </div>}
        </div>
        <div className="px-4 py-3 border-t border-[#F0EBE3] shrink-0 text-center">
          <p className="text-[11px] text-[#8E8878]">{products.length} sản phẩm · Nhấn để thêm</p>
        </div>
      </div>
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────
export default function EditOrderModal({ open, orderId, onClose, onSaved }) {
  const toast = useToast();
  const idCounter = useRef(0);
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

      // Giảm giá
      if (Number(d?.discountRate) > 0) {
        setDiscount(Number(d.discountRate));
        setDiscountFixed(null); setDiscountFixedDisplay('');
      } else if (Number(d?.discountAmount) > 0) {
        setDiscount(0);
        setDiscountFixed(Number(d.discountAmount));
        setDiscountFixedDisplay(new Intl.NumberFormat('vi-VN').format(Number(d.discountAmount)));
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

  // Lưu
  const handleSave = async () => {
    if (items.length === 0) { toast('Đơn hàng cần có ít nhất 1 sản phẩm', 'warning'); return; }
    setSaving(true);
    try {
      const payload = {
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
        items: items.map(i => {
          const isPromoItem = i.isPromo === true;

          // ✅ FIX SAVE: Gửi giá theo đơn vị hộp (cơ bản) về backend
          // item.unitPrice hiện đang là giá thùng (nếu BOX), cần chia lại về hộp
          let sentPrice = i.unitPrice;
          if (i.saleType === 'BOX' && i.unitsPerBox > 0) {
            sentPrice = i.unitPrice / i.unitsPerBox;
          }

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
      };

      await orderApi.updateOrderItems(orderId, payload);
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
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
        <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh]">

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#F0EBE3] shrink-0">
            <div>
              <h3 className="font-bold text-[#1C1C1E] text-base">Sửa đơn hàng</h3>
              <p className="text-xs text-[#8E8878] mt-0.5">{orderCode}</p>
            </div>
            <button onClick={onClose} className="p-1.5 text-[#8E8878] hover:text-red-400 hover:bg-red-50 rounded-xl transition-colors">
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Cảnh báo kho */}
            <div className="mx-5 mt-3 px-3 py-2 bg-amber-50 rounded-xl border border-amber-200 flex gap-2 items-start">
              <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-700">Chỉ trừ/hoàn kho theo <strong>phần thay đổi</strong>. Tăng SL → trừ thêm; Giảm SL → hoàn kho; Món mới → trừ toàn bộ.</p>
            </div>

            {!fetchingDetail && (
              <div className="mx-5 mt-3 bg-[#FAFAF8] rounded-xl border border-[#F0EBE3] overflow-hidden">
                <p className="text-[10px] font-bold text-[#8E8878] uppercase tracking-wider px-4 pt-3 pb-2">Thông tin đơn hàng</p>
                <div className="px-4 pb-3 space-y-2">

                  {/* ── Khách hàng ── */}
                  <div>
                    <label className="text-[10px] text-[#8E8878] font-semibold flex items-center gap-1 mb-1">
                      <User size={10} />Khách hàng
                    </label>
                    <button
                      onClick={() => setCustomerModalOpen(true)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm transition-all
                        ${selectedCustomer
                          ? 'border-[#C9A84C] bg-[#C9A84C]/5'
                          : 'border-dashed border-[#E8DDD0] text-[#8E8878] hover:border-[#C9A84C]'}`}
                    >
                      {selectedCustomer ? (
                        <>
                          <UserCheck size={14} className="text-[#C9A84C] shrink-0" />
                          <div className="flex-1 text-left min-w-0">
                            <p className="font-semibold text-xs truncate text-[#1C1C1E]">
                              {selectedCustomer.contactName || selectedCustomer.name || 'Khách hàng'}
                            </p>
                            <p className="text-[10px] text-[#8E8878] truncate">
                              {selectedCustomer.customerCode && `${selectedCustomer.customerCode} · `}{selectedCustomer.phone}
                            </p>
                          </div>
                          <button
                            onClick={e => { e.stopPropagation(); handleClearCustomer(); }}
                            className="text-[#C4B9A8] hover:text-red-400 shrink-0 p-0.5 rounded"
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
                        <MapPin size={10} className="text-[#C9A84C] mt-0.5 shrink-0" />
                        <p className="text-[10px] text-[#5C4E3D] truncate">
                          {selectedCustomer.selectedReceiver.receiverAddress}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Người đặt & Người nhận */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-[#8E8878] font-semibold flex items-center gap-1 mb-1"><User size={10} />Người đặt</label>
                      <input value={orderedByName} onChange={e => setOrderedByName(e.target.value)} placeholder="Tên người đặt..."
                        className="w-full px-2 py-1.5 text-xs border border-[#E8DDD0] rounded-lg focus:outline-none focus:border-[#C9A84C]" />
                    </div>
                    <div>
                      <label className="text-[10px] text-[#8E8878] font-semibold flex items-center gap-1 mb-1"><User size={10} />Người nhận</label>
                      <input value={receiverName} onChange={e => setReceiverName(e.target.value)} placeholder="Tên người nhận..."
                        className="w-full px-2 py-1.5 text-xs border border-[#E8DDD0] rounded-lg focus:outline-none focus:border-[#C9A84C]" />
                    </div>
                  </div>

                  {/* Địa chỉ giao */}
                  <div>
                    <label className="text-[10px] text-[#8E8878] font-semibold flex items-center gap-1 mb-1"><MapPin size={10} />Địa chỉ giao hàng</label>
                    <input value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} placeholder="Địa chỉ..."
                      className="w-full px-2 py-1.5 text-xs border border-[#E8DDD0] rounded-lg focus:outline-none focus:border-[#C9A84C]" />
                  </div>

                  {/* Giờ giao & Thanh toán */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-[#8E8878] font-semibold flex items-center gap-1 mb-1"><Clock size={10} />Giờ giao hàng</label>
                      <input type="datetime-local" value={deliveryDatetime} onChange={e => setDeliveryDatetime(e.target.value)}
                        className="w-full px-2 py-1.5 text-xs border border-[#E8DDD0] rounded-lg focus:outline-none focus:border-[#C9A84C]" />
                    </div>
                    <div>
                      <label className="text-[10px] text-[#8E8878] font-semibold flex items-center gap-1 mb-1"><CreditCard size={10} />Thanh toán</label>
                      <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}
                        className="w-full px-2 py-1.5 text-xs border border-[#E8DDD0] rounded-lg focus:outline-none focus:border-[#C9A84C] bg-white">
                        {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Ghi chú */}
                  <div>
                    <label className="text-[10px] text-[#8E8878] font-semibold mb-1 block">Ghi chú</label>
                    <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Ghi chú đơn hàng..."
                      className="w-full px-2 py-1.5 text-xs border border-[#E8DDD0] rounded-lg focus:outline-none focus:border-[#C9A84C] resize-none" />
                  </div>

                  {/* Hiển thị giá */}
                  <div className="pt-2 border-t border-[#F0EBE3]">
                    <label className="block text-[10px] text-[#8E8878] font-semibold mb-1.5">💰 Hiển thị giá</label>
                    <select
                      value={priceDisplayOption}
                      onChange={e => setPriceDisplayOption(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-[#E8DDD0] rounded-xl focus:outline-none focus:border-[#C9A84C] bg-white"
                    >
                      <option value="show">Hiển thị đầy đủ giá</option>
                      <option value="hide_prices">Che giá (ẩn giá từng sản phẩm, chỉ hiện tổng)</option>
                      <option value="hide_all">Che toàn bộ (ẩn tất cả số tiền)</option>
                    </select>
                    <p className="text-[9px] text-[#8E8878] mt-1">
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
                <div className="flex items-center justify-center py-10 gap-2 text-[#8E8878]">
                  <Loader2 size={18} className="animate-spin" /><span className="text-sm">Đang tải đơn hàng...</span>
                </div>
              ) : items.length === 0 ? (
                <p className="text-sm text-[#8E8878] text-center py-6">Chưa có sản phẩm nào</p>
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
                  className="w-full mt-3 py-2.5 rounded-xl border-2 border-dashed border-[#E8DDD0] text-[#8E8878] text-xs font-semibold flex items-center justify-center gap-1.5 hover:border-[#C9A84C] hover:text-[#C9A84C] transition-colors">
                  <Plus size={13} />Thêm sản phẩm<ChevronRight size={12} className="opacity-60" />
                </button>
              )}
            </div>

            {/* Tổng tiền */}
            {!fetchingDetail && items.length > 0 && (
              <div className="mx-5 mb-3 bg-[#FAFAF8] rounded-xl border border-[#F0EBE3] px-4 py-3 space-y-2">
                {/* Giảm giá */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#8E8878] shrink-0 w-20">Giảm giá:</span>
                  <div className="flex items-center gap-1 flex-wrap flex-1">
                    {[0, 3, 5, 8, 10].map(d => (
                      <button key={d} onClick={() => { setDiscount(d); setDiscountFixed(null); setDiscountFixedDisplay(''); }}
                        className={`text-[10px] px-2 py-1 rounded-md font-semibold transition-colors ${discount === d && discountFixed === null ? 'bg-[#C9A84C] text-white' : 'bg-[#F0EBE3] text-[#8E8878] hover:bg-[#E8DDD0]'}`}>
                        {d}%
                      </button>
                    ))}
                    {discountFixed === null
                      ? <button onClick={() => { setDiscount(0); setDiscountFixed(0); setDiscountFixedDisplay(''); }} className="text-[10px] px-2 py-1 rounded-md font-semibold bg-[#F0EBE3] text-[#8E8878] hover:bg-[#E8DDD0]">Nhập tiền</button>
                      : <div className="flex items-center gap-1">
                        <div className="relative">
                          <input type="text" inputMode="numeric" value={discountFixedDisplay}
                            onChange={e => { const raw = e.target.value.replace(/[^0-9]/g, ''); setDiscountFixedDisplay(raw); setDiscountFixed(raw === '' ? 0 : parseInt(raw, 10)); }}
                            placeholder={`tối đa ${new Intl.NumberFormat('vi-VN').format(maxDiscountFixed)}`}
                            className="w-28 rounded-md px-2 py-1 text-[10px] text-right pr-5 border border-[#C9A84C] bg-[#C9A84C]/5 font-semibold text-[#C9A84C] focus:outline-none" />
                          <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-[#8E8878]">đ</span>
                        </div>
                        <button onClick={() => { setDiscountFixed(null); setDiscountFixedDisplay(''); }} className="text-[10px] px-1.5 py-1 rounded-md bg-[#F0EBE3] text-[#8E8878] hover:bg-[#E8DDD0] font-semibold">×</button>
                      </div>}
                  </div>
                </div>

                {/* Phụ phí */}
                <div className="flex items-start gap-2">
                  <span className="text-xs text-[#8E8878] shrink-0 w-20 mt-1.5">Phụ phí:</span>
                  <div className="flex-1">
                    <SurchargePanel surchargeItems={surchargeItems} onChange={setSurchargeItems} />
                  </div>
                </div>

                {/* Summary */}
                <div className="space-y-0.5 pt-2 border-t border-[#F0EBE3]">
                  {/* Tạm tính = tổng NET (chưa thuế) */}
                  <div className="flex justify-between text-xs text-[#8E8878]">
                    <span>Tạm tính</span><span>{fmt(subtotalGross)}</span>  {/* ← đổi từ subtotalGross cũ */}
                  </div>
                  {(itemDiscountTotal > 0 || discountAmt > 0) && (
                    <div className="flex justify-between text-xs text-emerald-600">
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
                    <div className="flex justify-between text-xs text-[#8E8878]">
                      <span>VAT (ngoài giá)</span><span>+{fmt(exclusiveVatTotal)}</span>
                    </div>
                  )}
                  {inclusiveVatTotal > 0 && (
                    <div className="flex justify-between text-xs text-[#C4B9A8]">
                      <span>VAT (đã bao gồm trong giá)</span><span>{fmt(inclusiveVatTotal)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-bold text-[#1C1C1E] pt-1 border-t border-[#F0EBE3]">
                    <span>Tổng ({items.length} món)</span>
                    <span className="text-[#C9A84C]">{fmt(total)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 pb-5 pt-3 border-t border-[#F0EBE3] shrink-0 flex gap-2">
            <button onClick={onClose} disabled={saving}
              className="flex-1 py-2.5 rounded-xl border border-[#E8DDD0] text-sm text-[#5C4E3D] font-semibold hover:bg-[#F0EBE3] transition-colors disabled:opacity-50">
              Hủy
            </button>
            <button onClick={handleSave} disabled={saving || items.length === 0 || fetchingDetail}
              className="flex-1 py-2.5 rounded-xl bg-[#C9A84C] text-white text-sm font-bold flex items-center justify-center gap-2 hover:bg-[#b8973d] transition-colors disabled:opacity-50">
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