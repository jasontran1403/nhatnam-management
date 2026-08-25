// src/pages/accountant/ExpenseCreateModal.jsx
import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { expenseApi, bankApi } from '../../api/services';
import { useToast } from '../../components/common/Toast';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import {
  X, Building2, ChevronDown, Plus, Trash2,
  Upload, Send, Receipt, Search, User, Phone, Wallet, ReceiptText, Hash, MapPin,
} from 'lucide-react';
import { accountantVendorExpenseApi, superAccountantVendorExpenseApi, fmtVND } from '../../api/materialRequestApi.js';
import ExpenseDatePeriodPicker, { defaultExpenseWhen } from '../../components/ui/ExpenseDatePeriodPicker';
import { formatVND } from '../../utils/format.js';

function parseVND(s) { return Number(String(s).replace(/[^0-9]/g, '')) || 0; }

export const VENDOR_TYPE_LABELS = {
  MATERIAL: 'Nguyên liệu',
  MACHINE: 'Máy móc',
  REPAIR: 'Sửa chữa',
  ELECTRICITY: 'Điện',
  WATER: 'Nước',
  GAS: 'Gas',
  LOGISTICS: 'Vận chuyển',
  SERVICE: 'Dịch vụ',
  OFFICE_SUPPLIER: 'Văn phòng phẩm',
  TRUCKING_SERVICE: 'Dịch vụ xe tải',
  DELIVERY_SERVICE: 'Dịch vụ giao nhận',
  OFFICE_RENTAL: 'Thuê văn phòng',
  OTHER: 'Khác',
};

// ── Modal tạo nhanh nhà cung cấp ──────────────────────────────────────────────
export function QuickCreateVendorModal({ initialName = '', onClose, onCreated }) {
  const toast = useToast();
  const [name, setName] = useState(initialName);
  const [vendorType, setVendorType] = useState('OTHER');
  const [contactPerson, setContactPerson] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [address, setAddress] = useState('');
  const [taxCode, setTaxCode] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) { toast('Tên nhà cung cấp là bắt buộc', 'error'); return; }
    setSaving(true);
    try {
      const res = await api.post('/api/factory/material-vendors', {
        name: name.trim(),
        vendorType,
        contactPerson: contactPerson.trim(),
        contactPhone: contactPhone.trim(),
        address: address.trim(),
        taxCode: taxCode.trim(),
      });
      const created = res.data?.data || res.data;
      toast('Đã tạo nhà cung cấp', 'success');
      onCreated(created);
    } catch (e) {
      toast(e?.response?.data?.message || 'Lỗi tạo nhà cung cấp', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-sm flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-hairline">
          <div className="flex items-center gap-2">
            <Building2 size={18} className="text-gold" />
            <h3 className="font-bold text-ink">Tạo nhà cung cấp</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-canvas text-muted">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-ink mb-1">Tên nhà cung cấp *</label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Nhập tên..."
              className="w-full px-3 py-2.5 rounded-xl border border-hairline-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink mb-1">Loại</label>
            <select
              value={vendorType}
              onChange={e => setVendorType(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-hairline-2 text-sm focus:outline-none bg-surface"
            >
              {Object.entries(VENDOR_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink mb-1 flex items-center gap-1">
              <User size={11} className="text-gold" /> Người liên hệ
            </label>
            <input
              value={contactPerson}
              onChange={e => setContactPerson(e.target.value)}
              placeholder="Tên người liên hệ..."
              className="w-full px-3 py-2.5 rounded-xl border border-hairline-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink mb-1 flex items-center gap-1">
              <Phone size={11} className="text-gold" /> Số điện thoại
            </label>
            <input
              value={contactPhone}
              onChange={e => setContactPhone(e.target.value)}
              placeholder="SĐT liên hệ..."
              className="w-full px-3 py-2.5 rounded-xl border border-hairline-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink mb-1 flex items-center gap-1">
              <MapPin size={11} className="text-gold" /> Địa chỉ
            </label>
            <input
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="Địa chỉ nhà cung cấp..."
              className="w-full px-3 py-2.5 rounded-xl border border-hairline-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink mb-1 flex items-center gap-1">
              <Hash size={11} className="text-gold" /> Mã số thuế
            </label>
            <input
              value={taxCode}
              onChange={e => setTaxCode(e.target.value)}
              placeholder="Mã số thuế..."
              className="w-full px-3 py-2.5 rounded-xl border border-hairline-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40 font-mono"
            />
          </div>
        </div>

        <div className="p-5 border-t border-hairline flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-hairline-2 text-sm font-semibold text-muted hover:bg-canvas transition">
            Huỷ
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-gold text-white text-sm font-bold hover:bg-gold-strong transition disabled:opacity-50"
          >
            {saving ? 'Đang tạo...' : 'Tạo & Chọn'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Form trả công nợ nhà cung cấp — không cần duyệt, trừ nợ ngay ─────────────
function VendorDebtPaymentForm({ onClose, onCreated, initialVendorId = null, initialVendorName = '' }) {
  const toast = useToast();
  const { role } = useAuth();
  const vendorExpenseApi = role === 'SUPER_ACCOUNTANT' ? superAccountantVendorExpenseApi : accountantVendorExpenseApi;

  const [vendors, setVendors] = useState([]);
  const [vendorLoading, setVendorLoading] = useState(false);
  const [dropOpen, setDropOpen] = useState(false);
  const [vendorSearch, setVendorSearch] = useState('');
  const [selectedVendor, setSelectedVendor] = useState(
    initialVendorId ? { id: initialVendorId, name: initialVendorName } : null
  );
  const dropRef = useRef();
  const proofFileRef = useRef();

  const [outstanding, setOutstanding] = useState(null);
  const [loadingOutstanding, setLoadingOutstanding] = useState(false);
  const [fullSettlement, setFullSettlement] = useState(true);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [proofImages, setProofImages] = useState([]); // [{ id, url, uploading, uploadedUrl }]
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      setVendorLoading(true);
      try {
        const res = await api.get('/api/factory/material-vendors');
        setVendors(res.data?.data || []);
      } catch {
        toast('Không thể tải danh sách nhà cung cấp', 'error');
      } finally { setVendorLoading(false); }
    })();
  }, []);

  useEffect(() => {
    const fn = (e) => { if (dropRef.current && !dropRef.current.contains(e.target)) setDropOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  useEffect(() => {
    if (!selectedVendor) { setOutstanding(null); return; }
    setLoadingOutstanding(true);
    vendorExpenseApi.getOutstanding(selectedVendor.id)
      .then(v => setOutstanding(Number(v) || 0))
      .catch(() => setOutstanding(0))
      .finally(() => setLoadingOutstanding(false));
  }, [selectedVendor]);

  const filteredVendors = vendors.filter(v => v.name.toLowerCase().includes(vendorSearch.toLowerCase()));

  const handleProofImageChange = async (e) => {
    for (const file of Array.from(e.target.files)) {
      const preview = URL.createObjectURL(file);
      const tmp = { id: Date.now() + Math.random(), url: preview, uploading: true, uploadedUrl: null };
      setProofImages(p => [...p, tmp]);
      try {
        const res = await expenseApi.uploadImage(file);
        const uploaded = res.data?.data?.imageUrl || res.data?.imageUrl || '';
        if (!uploaded) throw new Error();
        setProofImages(p => p.map(img => img.id === tmp.id ? { ...img, uploading: false, uploadedUrl: uploaded } : img));
      } catch {
        setProofImages(p => p.filter(img => img.id !== tmp.id));
        toast('Lỗi upload ảnh', 'error');
      }
    }
    e.target.value = '';
  };

  const removeProofImage = (id) => setProofImages(p => p.filter(img => img.id !== id));

  const uploadedProofUrls = proofImages.filter(img => img.uploadedUrl).map(img => img.uploadedUrl);

  const handleSubmit = async () => {
    if (!selectedVendor) { toast('Vui lòng chọn nhà cung cấp', 'error'); return; }
    if (outstanding == null || outstanding <= 0) { toast('Nhà cung cấp này không có công nợ', 'error'); return; }
    const amountValue = fullSettlement ? outstanding : parseVND(amount);
    if (!fullSettlement && amountValue <= 0) { toast('Vui lòng nhập số tiền cần chi', 'error'); return; }
    if (!fullSettlement && amountValue > outstanding) { toast('Số tiền chi vượt quá công nợ hiện tại', 'error'); return; }
    if (proofImages.some(img => img.uploading)) { toast('Đang tải ảnh, vui lòng chờ...', 'warning'); return; }
    if (uploadedProofUrls.length === 0) { toast('Bắt buộc ít nhất 1 ảnh chứng từ thanh toán', 'error'); return; }

    setSubmitting(true);
    try {
      await vendorExpenseApi.create({
        vendorId: selectedVendor.id,
        fullSettlement,
        amount: fullSettlement ? null : amountValue,
        note: note.trim() || null,
        proofImages: uploadedProofUrls,
      });
      toast('Đã tạo phiếu chi và trừ công nợ', 'success');
      onCreated();
    } catch (e) {
      toast(e?.response?.data?.message || 'Lỗi khi tạo phiếu chi', 'error');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="overflow-y-auto flex-1 p-5 space-y-4">
      {/* Nhà cung cấp */}
      <div>
        <label className="text-sm font-semibold text-ink flex items-center gap-1.5 mb-1.5">
          <Building2 size={14} className="text-gold" /> Nhà cung cấp <span className="text-red-500">*</span>
        </label>
        <div className="relative" ref={dropRef}>
          <div
            onClick={() => setDropOpen(o => !o)}
            className={`flex items-center justify-between px-4 py-2.5 rounded-xl border cursor-pointer transition ${!selectedVendor ? 'border-hairline-2 hover:border-gold' : 'border-gold bg-canvas'}`}
          >
            {selectedVendor ? (
              <p className="text-sm font-semibold text-ink">{selectedVendor.name}</p>
            ) : (
              <span className="text-sm text-muted">{vendorLoading ? 'Đang tải...' : 'Chọn nhà cung cấp...'}</span>
            )}
            <ChevronDown size={16} className={`text-muted transition-transform flex-shrink-0 ml-2 ${dropOpen ? 'rotate-180' : ''}`} />
          </div>
          {dropOpen && (
            <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-surface border border-hairline-2 rounded-xl shadow-xl overflow-hidden">
              <div className="p-2 border-b border-hairline relative">
                <Search size={13} className="absolute left-5 top-1/2 -translate-y-1/2 text-muted" />
                <input autoFocus value={vendorSearch} onChange={e => setVendorSearch(e.target.value)}
                  placeholder="Tìm nhà cung cấp..."
                  className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-hairline-2 focus:outline-none focus:ring-2 focus:ring-gold/40" />
              </div>
              <div className="max-h-48 overflow-y-auto">
                {filteredVendors.length === 0 && <p className="text-center py-4 text-xs text-muted">Không tìm thấy</p>}
                {filteredVendors.map(v => (
                  <button key={v.id}
                    onClick={() => { setSelectedVendor(v); setDropOpen(false); setVendorSearch(''); }}
                    className="w-full text-left px-4 py-2.5 hover:bg-canvas transition border-b border-hairline last:border-0">
                    <p className="text-sm font-medium text-ink">{v.name}</p>
                    {v.contactPhone && <p className="text-xs text-muted">{v.contactPhone}</p>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedVendor && (
        <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/28 rounded-xl p-3 flex items-center justify-between">
          <span className="text-sm text-amber-700 dark:text-amber-300 font-medium">Công nợ hiện tại</span>
          <span className="text-lg font-bold text-amber-700 dark:text-amber-300">
            {loadingOutstanding ? '...' : fmtVND(outstanding)}
          </span>
        </div>
      )}

      {selectedVendor && outstanding > 0 && (
        <>
          <div className="flex gap-2">
            <button
              onClick={() => setFullSettlement(true)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${fullSettlement ? 'bg-forest-deep text-white border-forest-deep' : 'bg-surface text-muted border-hairline-2'}`}>
              Thanh toán hết
            </button>
            <button
              onClick={() => setFullSettlement(false)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${!fullSettlement ? 'bg-forest-deep text-white border-forest-deep' : 'bg-surface text-muted border-hairline-2'}`}>
              Thanh toán 1 phần
            </button>
          </div>

          {!fullSettlement && (
            <div>
              <label className="block text-sm font-semibold text-ink mb-1.5">Số tiền chi</label>
              <input
                value={amount ? new Intl.NumberFormat('vi-VN').format(parseVND(amount)) : ''}
                onChange={e => setAmount(String(parseVND(e.target.value)))}
                placeholder="Nhập số tiền..."
                className="w-full px-4 py-2.5 rounded-xl border border-hairline-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40 text-right"
              />
              <p className="text-xs text-muted mt-1">
                Sẽ trừ vào các phiếu đặt hàng có công nợ lâu nhất trước.
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-ink mb-1.5">Ghi chú (tuỳ chọn)</label>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="Ghi chú..."
              className="w-full px-4 py-2.5 rounded-xl border border-hairline-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40" />
          </div>

          <div>
            <label className="block text-sm font-semibold text-ink mb-1.5">
              Ảnh chứng từ thanh toán <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {proofImages.map(img => (
                <div key={img.id} className="relative w-16 h-16 rounded-xl overflow-hidden border border-hairline-2">
                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                  {img.uploading ? (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    </div>
                  ) : (
                    <button onClick={() => removeProofImage(img.id)}
                      className="absolute top-1 right-1 p-0.5 bg-red-500 text-white rounded-full">
                      <X size={8} />
                    </button>
                  )}
                </div>
              ))}
              <button onClick={() => proofFileRef.current?.click()}
                className="w-16 h-16 rounded-xl border-2 border-dashed border-hairline-3 flex flex-col items-center justify-center gap-0.5 hover:border-gold hover:bg-gold/5 transition text-muted hover:text-gold">
                <Upload size={14} />
                <span className="text-xs">Thêm</span>
              </button>
              <input ref={proofFileRef} type="file" accept="image/*" multiple hidden onChange={handleProofImageChange} />
            </div>
            {uploadedProofUrls.length === 0 && (
              <p className="text-xs text-red-500 mt-1.5">Bắt buộc ít nhất 1 ảnh chứng từ.</p>
            )}
          </div>
        </>
      )}

      {selectedVendor && outstanding === 0 && (
        <p className="text-sm text-muted text-center py-4">Nhà cung cấp này hiện không có công nợ.</p>
      )}

      <div className="flex gap-3 pt-2">
        <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-hairline-2 text-sm font-semibold text-muted hover:bg-canvas transition">
          Huỷ
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting || !selectedVendor || !outstanding || uploadedProofUrls.length === 0 || proofImages.some(img => img.uploading)}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gold text-white font-bold hover:bg-gold-strong transition disabled:opacity-50">
          {submitting
            ? <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            : <Wallet size={16} />}
          {submitting ? 'Đang xử lý...' : 'Tạo phiếu chi & trừ công nợ'}
        </button>
      </div>
    </div>
  );
}

// ── Modal tạo phiếu chi chính ─────────────────────────────────────────────────
// ── Input search dropdown chọn nhãn khoản chi + tạo nhanh ─────────────────────
// Viết hoa chữ cái đầu của từ nhập vào (VD: "tiền chành xe" → "Tiền chành xe").
function capitalizeFirst(s) {
  const t = (s || '').trim();
  if (!t) return '';
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function CategorySearchSelect({ categories, setCategories, value, onChange, index, toast }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  // Toạ độ dropdown (fixed) — tính từ ô trigger để render qua portal, không bị modal cắt
  const [menuPos, setMenuPos] = useState(null); // { left, width, top?, bottom? }
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  const selected = categories.find(c => String(c.id) === String(value)) || null;

  // Tính vị trí dropdown theo trigger. Tự lật lên trên nếu dưới không đủ chỗ.
  const updatePosition = () => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const MENU_MAX_H = 320; // ước lượng chiều cao tối đa dropdown
    const spaceBelow = window.innerHeight - r.bottom;
    const openUp = spaceBelow < MENU_MAX_H && r.top > spaceBelow;
    setMenuPos(
      openUp
        ? { left: r.left, width: r.width, bottom: window.innerHeight - r.top + 4 }
        : { left: r.left, width: r.width, top: r.bottom + 4 }
    );
  };

  // Cập nhật vị trí khi mở + khi cuộn (kể cả cuộn trong modal) / đổi kích thước
  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    const onScroll = () => updatePosition();
    const onResize = () => updatePosition();
    window.addEventListener('scroll', onScroll, true); // capture=true để bắt scroll của container trong modal
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  // Đóng khi click ra ngoài (menu nằm ở portal nên phải kiểm tra cả trigger lẫn menu)
  useEffect(() => {
    const fn = (e) => {
      if (triggerRef.current && triggerRef.current.contains(e.target)) return;
      if (menuRef.current && menuRef.current.contains(e.target)) return;
      setOpen(false);
      setSearch('');
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const kw = search.trim().toLowerCase();
  const filtered = kw
    ? categories.filter(c => c.name.toLowerCase().includes(kw))
    : categories;
  const exactExists = categories.some(c => c.name.trim().toLowerCase() === kw);
  const canCreate = kw.length > 0 && !exactExists;

  const handleCreate = async () => {
    const name = capitalizeFirst(search);
    if (!name) return;
    setCreating(true);
    try {
      const res = await expenseApi.createExpenseCategory(name);
      const created = res.data?.data || res.data;
      if (!created || !created.id) throw new Error('Tạo nhãn thất bại');
      setCategories(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name, 'vi')));
      onChange(String(created.id));
      toast(`Đã tạo nhãn "${created.name}"`, 'success');
      setOpen(false);
      setSearch('');
    } catch (e) {
      toast(e?.response?.data?.message || e.message || 'Không thể tạo nhãn', 'error');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="relative flex-1">
      <div
        ref={triggerRef}
        onClick={() => setOpen(o => !o)}
        className={`flex items-center justify-between px-3 py-2 rounded-lg border text-sm cursor-pointer bg-surface transition ${open ? 'border-gold ring-2 ring-gold/40' : 'border-hairline-2 hover:border-gold'}`}>
        <span className={selected ? 'text-ink' : 'text-muted'}>
          {selected ? selected.name : `— Chọn nhãn khoản chi ${index + 1} —`}
        </span>
        <ChevronDown size={15} className={`text-muted flex-shrink-0 ml-2 transition-transform ${open ? 'rotate-180' : ''}`} />
      </div>

      {open && menuPos && createPortal(
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            left: menuPos.left,
            width: menuPos.width,
            ...(menuPos.top != null ? { top: menuPos.top } : {}),
            ...(menuPos.bottom != null ? { bottom: menuPos.bottom } : {}),
            zIndex: 70, // cao hơn modal (z-50) để luôn nổi lên trên
          }}
          className="bg-surface border border-hairline-2 rounded-xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-hairline relative">
            <Search size={13} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
            <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Tìm hoặc nhập nhãn mới..."
              className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-hairline-2 focus:outline-none focus:ring-2 focus:ring-gold/40" />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.map(c => (
              <button key={c.id}
                onClick={() => { onChange(String(c.id)); setOpen(false); setSearch(''); }}
                className={`w-full text-left px-4 py-2.5 text-sm hover:bg-canvas transition border-b border-hairline last:border-0 ${String(c.id) === String(value) ? 'bg-canvas font-semibold text-gold' : 'text-ink'}`}>
                {c.name}
              </button>
            ))}
            {filtered.length === 0 && !canCreate && (
              <p className="text-center py-4 text-xs text-muted">Không tìm thấy nhãn</p>
            )}
          </div>
          {canCreate && (
            <button onClick={handleCreate} disabled={creating}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-gold hover:bg-gold/5 border-t border-hairline transition disabled:opacity-50">
              {creating
                ? <span className="w-3.5 h-3.5 border-2 border-gold/40 border-t-gold rounded-full animate-spin" />
                : <Plus size={14} />}
              Tạo nhãn "<span className="font-bold">{capitalizeFirst(search)}</span>"
            </button>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

export default function ExpenseCreateModal({ onClose, onCreated, initialMode = 'EXPENSE', initialVendorId = null, initialVendorName = '' }) {
  const toast = useToast();
  const fileRef = useRef();
  const dropRef = useRef();

  const [mode, setMode] = useState(initialMode); // EXPENSE | VENDOR_DEBT

  // Vendor state
  const [vendors, setVendors] = useState([]);
  const [vendorLoading, setVendorLoading] = useState(false);
  const [dropOpen, setDropOpen] = useState(false);
  const [vendorSearch, setVendorSearch] = useState('');
  const [selectedVendor, setSelectedVendor] = useState(null); // { id, name, vendorType, contactPerson, contactPhone }
  const [showQuickCreate, setShowQuickCreate] = useState(false);

  // Form state
  const [reason, setReason] = useState('');
  // Số phiếu chi — người dùng nhập, có gợi ý số kế tiếp
  const [paymentNumber, setPaymentNumber] = useState('');
  const [suggestedPaymentNumber, setSuggestedPaymentNumber] = useState('');
  // Thời điểm phiếu chi — mặc định chế độ "Ngày" = hôm nay
  const [when, setWhen] = useState(defaultExpenseWhen());
  const [requestedByName, setRequestedByName] = useState('');
  // Hình thức thanh toán (Mục 4): CASH | BANK_TRANSFER
  const [paymentType, setPaymentType] = useState('CASH');
  const [bankName, setBankName] = useState('');
  const [banks, setBanks] = useState([]);   // danh mục NH có sẵn
  const [bankRef, setBankRef] = useState('');
  const [items, setItems] = useState([{ id: 1, categoryId: '', amount: '', note: '' }]);
  const [images, setImages] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  // Danh mục khoản chi của NCC đang chọn (Owner tạo) — kế toán chỉ được chọn từ đây
  const [categories, setCategories] = useState([]);
  const [catLoading, setCatLoading] = useState(false);

  // Load vendors từ MaterialVendor API
  useEffect(() => {
    (async () => {
      setVendorLoading(true);
      try {
        const res = await api.get('/api/factory/material-vendors');
        setVendors(res.data?.data || []);
      } catch {
        toast('Không thể tải danh sách nhà cung cấp', 'error');
      } finally {
        setVendorLoading(false);
      }
    })();
  }, []);

  // Đóng dropdown khi click ngoài
  useEffect(() => {
    const fn = (e) => { if (dropRef.current && !dropRef.current.contains(e.target)) setDropOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  // DANH MỤC KHOẢN CHI — POOL DÙNG CHUNG cho mọi NCC.
  // Trước đây tải lại danh mục RIÊNG mỗi lần đổi NCC (và reset hết nhãn đã chọn).
  // Giờ chỉ tải MỘT LẦN khi mở form; đổi NCC không còn ảnh hưởng tới nhãn đã chọn.
  useEffect(() => {
    let alive = true;
    setCatLoading(true);
    expenseApi.expenseCategories()
      .then(res => { if (alive) setCategories(res.data?.data || res.data || []); })
      .catch(() => { if (alive) setCategories([]); })
      .finally(() => { if (alive) setCatLoading(false); });
    return () => { alive = false; };
  }, []);

  // Gợi ý số phiếu chi kế tiếp (placeholder) — user vẫn có thể tự nhập số khác
  useEffect(() => {
    expenseApi.nextPaymentNumber()
      .then(res => {
        const suggestion = res.data?.data ?? res.data ?? '';
        if (suggestion) setSuggestedPaymentNumber(String(suggestion));
      })
      .catch(() => { });
  }, []);

  // Danh mục ngân hàng có sẵn (do OWNER/ADMIN tạo ở trang Quản lý dòng tiền)
  useEffect(() => {
    bankApi.list()
      .then(res => setBanks(res.data?.data ?? res.data ?? []))
      .catch(() => { });
  }, []);

  const filteredVendors = vendors.filter(v =>
    v.name.toLowerCase().includes(vendorSearch.toLowerCase()) ||
    (v.contactPhone && v.contactPhone.includes(vendorSearch))
  );

  const noResults = vendorSearch.trim() && filteredVendors.length === 0;

  // Sau khi tạo nhanh vendor
  const handleVendorCreated = (created) => {
    setVendors(prev => [created, ...prev]);
    setSelectedVendor(created);
    setDropOpen(false);
    setShowQuickCreate(false);
    setVendorSearch('');
  };

  // Items
  const addItem = () => setItems(p => [...p, { id: Date.now(), categoryId: '', amount: '', note: '' }]);
  const removeItem = (id) => setItems(p => p.filter(i => i.id !== id));
  const updateItem = (id, k, v) => setItems(p => p.map(i => i.id === id ? { ...i, [k]: v } : i));
  const totalAmount = items.reduce((s, i) => s + parseVND(i.amount), 0);

  // Images
  const handleImageChange = async (e) => {
    for (const file of Array.from(e.target.files)) {
      const preview = URL.createObjectURL(file);
      const tmp = { id: Date.now() + Math.random(), file, url: preview, uploading: true, uploadedUrl: null };
      setImages(p => [...p, tmp]);
      try {
        const res = await expenseApi.uploadImage(file);
        const uploaded = res.data?.data?.imageUrl || res.data?.imageUrl || '';
        if (!uploaded) throw new Error();
        setImages(p => p.map(img => img.id === tmp.id ? { ...img, uploading: false, uploadedUrl: uploaded } : img));
      } catch {
        setImages(p => p.filter(img => img.id !== tmp.id));
        toast('Lỗi upload ảnh', 'error');
      }
    }
    e.target.value = '';
  };

  const handleSubmit = async () => {
    if (!selectedVendor) { toast('Vui lòng chọn nhà cung cấp', 'error'); return; }
    if (!reason.trim()) { toast('Lý do chi là bắt buộc', 'error'); return; }
    const validItems = items.filter(i => i.categoryId && parseVND(i.amount) > 0);
    if (validItems.length === 0) { toast('Mỗi khoản chi cần chọn nhãn và nhập số tiền > 0', 'error'); return; }
    if (paymentType === 'BANK_TRANSFER') {
      if (!bankName.trim()) { toast('Tên ngân hàng là bắt buộc khi chuyển khoản', 'error'); return; }
      if (!bankRef.trim()) { toast('Mã tham chiếu giao dịch là bắt buộc khi chuyển khoản', 'error'); return; }
    }
    if (images.some(img => img.uploading)) { toast('Đang tải ảnh, vui lòng chờ...', 'warning'); return; }

    setSubmitting(true);
    try {
      await expenseApi.create({
        vendorName: selectedVendor.name,
        vendorId: selectedVendor.id,
        vendorType: selectedVendor.vendorType || null,
        reason: reason.trim(),
        paymentNumber: (paymentNumber.trim() || suggestedPaymentNumber) || null,
        paymentType,
        bankName: paymentType === 'BANK_TRANSFER' ? bankName.trim() : null,
        bankRef: paymentType === 'BANK_TRANSFER' ? bankRef.trim() : null,
        expenseDate: when.mode === 'DATE' ? (when.expenseDate ?? null) : null,
        expensePeriod: when.mode === 'PERIOD' ? (when.expensePeriod || null) : null,
        requestedByName: requestedByName.trim() || null,
        items: validItems.map(i => ({ categoryId: Number(i.categoryId), amount: parseVND(i.amount), note: i.note.trim() || null })),
        imageUrls: images.filter(img => img.uploadedUrl).map(img => img.uploadedUrl),
      });
      toast('Đã tạo phiếu chi', 'success');
      onCreated();
    } catch (e) {
      toast(e?.response?.data?.message || 'Lỗi khi tạo phiếu', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-hairline flex-shrink-0">
            <div className="flex items-center gap-3">
              <Receipt size={20} className="text-gold" />
              <div>
                <h2 className="text-lg font-bold text-ink">Tạo phiếu chi</h2>
                <p className="text-xs text-muted">Phiếu chi sẽ được duyệt theo hạn mức &amp; danh mục cấu hình</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-canvas text-muted transition">
              <X size={20} />
            </button>
          </div>

          {/* Tabs: Chi phí tự do / Trả công nợ NCC */}
          <div className="flex gap-1 bg-canvas m-4 mb-0 rounded-xl p-1 flex-shrink-0">
            <button
              onClick={() => setMode('EXPENSE')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all ${mode === 'EXPENSE' ? 'bg-surface text-ink shadow-sm' : 'text-muted'}`}>
              <ReceiptText size={14} /> Chi phí
            </button>
            <button
              onClick={() => setMode('VENDOR_DEBT')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all ${mode === 'VENDOR_DEBT' ? 'bg-surface text-ink shadow-sm' : 'text-muted'}`}>
              <Wallet size={14} /> Trả công nợ NCC
            </button>
          </div>

          {mode === 'VENDOR_DEBT' ? (
            <VendorDebtPaymentForm onClose={onClose} onCreated={onCreated}
              initialVendorId={initialVendorId} initialVendorName={initialVendorName} />
          ) : (
            <>
              {/* Body */}
              <div className="overflow-y-auto flex-1 p-5 space-y-4">

                {/* ── Nhà cung cấp (bắt buộc) ── */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-sm font-semibold text-ink flex items-center gap-1.5">
                      <Building2 size={14} className="text-gold" />
                      Tên người nhận / Nhà cung cấp / Đơn vị <span className="text-red-500">*</span>
                    </label>
                  </div>

                  <div className="relative" ref={dropRef}>
                    {/* Trigger */}
                    <div
                      onClick={() => { setDropOpen(o => !o); }}
                      className={`flex items-center justify-between px-4 py-2.5 rounded-xl border cursor-pointer transition ${!selectedVendor ? 'border-hairline-2 hover:border-gold' : 'border-gold bg-canvas'
                        }`}
                    >
                      {selectedVendor ? (
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-ink">{selectedVendor.name}</p>
                          <p className="text-xs text-muted">
                            {VENDOR_TYPE_LABELS[selectedVendor.vendorType] || selectedVendor.vendorType}
                            {selectedVendor.contactPerson && ` · ${selectedVendor.contactPerson}`}
                            {selectedVendor.contactPhone && ` · ${selectedVendor.contactPhone}`}
                          </p>
                        </div>
                      ) : (
                        <span className="text-sm text-muted">
                          {vendorLoading ? 'Đang tải...' : 'Chọn nhà cung cấp...'}
                        </span>
                      )}
                      <ChevronDown size={16} className={`text-muted transition-transform flex-shrink-0 ml-2 ${dropOpen ? 'rotate-180' : ''}`} />
                    </div>

                    {dropOpen && (
                      <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-surface border border-hairline-2 rounded-xl shadow-xl overflow-hidden">
                        {/* Search trong dropdown */}
                        <div className="p-2 border-b border-hairline relative">
                          <Search size={13} className="absolute left-5 top-1/2 -translate-y-1/2 text-muted" />
                          <input
                            autoFocus
                            value={vendorSearch}
                            onChange={e => setVendorSearch(e.target.value)}
                            placeholder="Tìm nhà cung cấp..."
                            className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-hairline-2 focus:outline-none focus:ring-2 focus:ring-gold/40"
                          />
                        </div>

                        <div className="max-h-48 overflow-y-auto">
                          {/* Bỏ chọn */}
                          {selectedVendor && (
                            <button
                              onClick={() => { setSelectedVendor(null); setDropOpen(false); }}
                              className="w-full text-left px-4 py-2.5 text-sm text-muted hover:bg-canvas transition"
                            >
                              — Bỏ chọn —
                            </button>
                          )}

                          {filteredVendors.length === 0 && !vendorSearch && !vendorLoading && (
                            <p className="text-center py-4 text-xs text-muted">Chưa có nhà cung cấp nào</p>
                          )}

                          {filteredVendors.map(v => (
                            <button
                              key={v.id}
                              onClick={() => { setSelectedVendor(v); setDropOpen(false); setVendorSearch(''); }}
                              className="w-full text-left px-4 py-2.5 hover:bg-canvas transition border-b border-hairline last:border-0"
                            >
                              <p className="text-sm font-medium text-ink">{v.name}</p>
                              <p className="text-xs text-muted">
                                {VENDOR_TYPE_LABELS[v.vendorType] || v.vendorType}
                                {v.contactPerson && ` · ${v.contactPerson}`}
                                {v.contactPhone && ` · ${v.contactPhone}`}
                              </p>
                            </button>
                          ))}
                        </div>

                        {/* Nút tạo nhanh */}
                        <div className="p-2 border-t border-hairline">
                          <button
                            onClick={() => { setShowQuickCreate(true); setDropOpen(false); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gold font-semibold hover:bg-canvas rounded-lg transition"
                          >
                            <Plus size={14} />
                            {noResults ? `Tạo "${vendorSearch}"` : 'Tạo nhà cung cấp mới'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Lý do ── */}
                <div>
                  <label className="block text-sm font-semibold text-ink mb-1.5">
                    Lý do chi <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={reason} onChange={e => setReason(e.target.value)}
                    placeholder="Mô tả lý do chi tiết..."
                    className="w-full px-4 py-2.5 rounded-xl border border-hairline-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40"
                  />
                </div>

                {/* ── Số phiếu chi ── */}
                <div>
                  <label className="text-sm font-semibold text-ink mb-1.5 flex items-center gap-1.5">
                    <Hash size={14} className="text-gold" /> Số phiếu chi
                  </label>
                  <div className="relative">
                    <input
                      value={paymentNumber}
                      onChange={e => {
                        // Chỉ cho phép nhập số (0-9), xóa các ký tự không phải số
                        const value = e.target.value.replace(/[^0-9]/g, '');
                        setPaymentNumber(value);
                      }}
                      placeholder={suggestedPaymentNumber ? `Gợi ý: ${suggestedPaymentNumber}` : 'Nhập số phiếu chi...'}
                      className="w-full px-4 py-2.5 pr-24 rounded-xl border border-hairline-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40 font-mono"
                    />
                    {suggestedPaymentNumber && !paymentNumber && (
                      <button
                        type="button"
                        onClick={() => setPaymentNumber(suggestedPaymentNumber)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg text-xs font-semibold bg-gold/10 text-gold hover:bg-gold/20 transition"
                      >
                        Dùng số này
                      </button>
                    )}
                  </div>
                  {suggestedPaymentNumber && (
                    <p className="text-xs text-muted mt-1">
                      Số kế tiếp gợi ý: <span className="font-mono font-semibold text-gold">{suggestedPaymentNumber}</span> — để trống sẽ tự dùng số này. Số chạy tới 15000 sẽ quay vòng về 1.
                    </p>
                  )}
                  <p className="text-xs text-muted mt-0.5">Chỉ được nhập số, không nhập chữ.</p>
                </div>

                {/* ── Thời điểm chi — chọn NGÀY (mặc định hôm nay) hoặc KỲ (tháng) ── */}
                <div>
                  <label className="block text-sm font-semibold text-ink mb-1.5">Thời điểm chi</label>
                  <ExpenseDatePeriodPicker value={when} onChange={setWhen} />
                  <p className="text-xs text-muted mt-1">
                    Mặc định là <b>ngày hôm nay</b>. Chọn <b>Ngày</b> để ghi đúng ngày phát sinh (tiện tạo lại phiếu chi cũ);
                    hoặc chọn <b>Kỳ</b> để tính khoản chi vào cả tháng. Kỳ cho phép cả tháng hiện tại và tương lai.
                  </p>
                </div>

                {/* ── Người yêu cầu ── */}
                <div>
                  <label className="block text-sm font-semibold text-ink mb-1.5">Người yêu cầu</label>
                  <input
                    value={requestedByName} onChange={e => setRequestedByName(e.target.value)}
                    placeholder="Tên người yêu cầu (nếu khác người lập phiếu)..."
                    className="w-full px-4 py-2.5 rounded-xl border border-hairline-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40"
                  />
                </div>

                {/* ── Hình thức thanh toán (Mục 4) ── */}
                <div>
                  <label className="block text-sm font-semibold text-ink mb-1.5">
                    Hình thức thanh toán <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setPaymentType('CASH')}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${paymentType === 'CASH' ? 'bg-forest-deep text-white border-forest-deep' : 'bg-surface text-muted border-hairline-2'}`}>
                      Tiền mặt
                    </button>
                    <button type="button" onClick={() => setPaymentType('BANK_TRANSFER')}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${paymentType === 'BANK_TRANSFER' ? 'bg-forest-deep text-white border-forest-deep' : 'bg-surface text-muted border-hairline-2'}`}>
                      Chuyển khoản
                    </button>
                  </div>
                  {paymentType === 'BANK_TRANSFER' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                      <div>
                        <select
                          value={bankName} onChange={e => setBankName(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl border border-hairline-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40 bg-surface">
                          <option value="">-- Chọn ngân hàng * --</option>
                          {banks.map(b => <option key={b.id || b.name} value={b.name}>{b.name}</option>)}
                        </select>
                        {banks.length === 0 && (
                          <p className="text-[11px] text-amber-600 dark:text-amber-300 mt-1">Chưa có ngân hàng — Chủ/Quản trị cần tạo ở trang Quản lý dòng tiền.</p>
                        )}
                      </div>
                      <input
                        value={bankRef} onChange={e => setBankRef(e.target.value)}
                        placeholder="Mã tham chiếu giao dịch *"
                        className="w-full px-4 py-2.5 rounded-xl border border-hairline-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40 font-mono"
                      />
                    </div>
                  )}
                </div>

                {/* ── Khoản chi ── */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-semibold text-ink">
                      Các khoản chi <span className="text-red-500">*</span>
                    </label>
                    <button onClick={addItem} disabled={!selectedVendor}
                      className="flex items-center gap-1 text-xs text-gold hover:underline font-semibold disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed">
                      <Plus size={13} /> Thêm khoản
                    </button>
                  </div>

                  {!selectedVendor ? (
                    <p className="text-xs text-muted bg-canvas rounded-xl p-3">Chọn nhà cung cấp trước khi thêm khoản chi.</p>
                  ) : catLoading ? (
                    <p className="text-xs text-muted bg-canvas rounded-xl p-3">Đang tải danh mục khoản chi...</p>
                  ) : (
                    <div className="space-y-2">
                      {categories.length === 0 && (
                        <p className="text-xs text-muted bg-canvas border border-hairline rounded-xl p-3">
                          Chưa có nhãn khoản chi. Gõ tên nhãn vào ô bên dưới rồi bấm <b>Tạo nhãn</b> để thêm mới ngay.
                        </p>
                      )}
                      {items.map((item, idx) => (
                        <div key={item.id} className="bg-canvas rounded-xl p-3 space-y-2">
                          <div className="flex gap-2">
                            <CategorySearchSelect
                              categories={categories}
                              setCategories={setCategories}
                              value={item.categoryId}
                              onChange={(val) => updateItem(item.id, 'categoryId', val)}
                              index={idx}
                              toast={toast}
                            />
                            <input
                              value={item.amount ? new Intl.NumberFormat('vi-VN').format(parseVND(item.amount)) : ''}
                              onChange={e => updateItem(item.id, 'amount', String(parseVND(e.target.value)))}
                              placeholder="Số tiền"
                              className="w-32 px-3 py-2 rounded-lg border border-hairline-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40 bg-surface text-right"
                            />
                            {items.length > 1 && (
                              <button onClick={() => removeItem(item.id)} className="p-2 rounded-lg hover:bg-red-50 dark:bg-red-500/10 text-red-400 transition flex-shrink-0">
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                          <input
                            value={item.note} onChange={e => updateItem(item.id, 'note', e.target.value)}
                            placeholder="Ghi chú (tuỳ chọn)..."
                            className="w-full px-3 py-2 rounded-lg border border-hairline-2 text-xs focus:outline-none focus:ring-2 focus:ring-gold/40 bg-surface"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="text-right mt-2 text-sm font-bold text-ink">
                    Tổng: <span className="text-gold">{formatVND(totalAmount)}</span>
                  </div>
                </div>

                {/* ── Ảnh ── */}
                <div>
                  <label className="block text-sm font-semibold text-ink mb-1.5">Ảnh chứng từ</label>
                  <div className="flex flex-wrap gap-2">
                    {images.map(img => (
                      <div key={img.id} className="relative w-16 h-16 rounded-xl overflow-hidden border border-hairline-2">
                        <img src={img.url} alt="" className="w-full h-full object-cover" />
                        {img.uploading ? (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                          </div>
                        ) : (
                          <button onClick={() => setImages(p => p.filter(i => i.id !== img.id))}
                            className="absolute top-1 right-1 p-0.5 bg-red-500 text-white rounded-full">
                            <X size={8} />
                          </button>
                        )}
                      </div>
                    ))}
                    <button onClick={() => fileRef.current?.click()}
                      className="w-16 h-16 rounded-xl border-2 border-dashed border-hairline-3 flex flex-col items-center justify-center gap-0.5 hover:border-gold hover:bg-gold/5 transition text-muted hover:text-gold">
                      <Upload size={14} />
                      <span className="text-xs">Thêm</span>
                    </button>
                    <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={handleImageChange} />
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-5 border-t border-hairline flex-shrink-0 flex gap-3">
                <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-hairline-2 text-sm font-semibold text-muted hover:bg-canvas transition">
                  Huỷ
                </button>
                <button
                  onClick={handleSubmit} disabled={submitting}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gold text-white font-bold hover:bg-gold-strong transition disabled:opacity-50"
                >
                  {submitting
                    ? <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    : <Send size={16} />}
                  {submitting ? 'Đang lưu...' : 'Tạo phiếu chi'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal tạo nhanh nhà cung cấp — z-index cao hơn */}
      {showQuickCreate && (
        <QuickCreateVendorModal
          initialName={vendorSearch}
          onClose={() => setShowQuickCreate(false)}
          onCreated={handleVendorCreated}
        />
      )}
    </>
  );
}