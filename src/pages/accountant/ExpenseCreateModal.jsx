// src/pages/accountant/ExpenseCreateModal.jsx
import { useState, useEffect, useRef } from 'react';
import { expenseApi } from '../../api/services';
import { useToast } from '../../components/common/Toast';
import api from '../../api/axios';
import {
  X, Building2, ChevronDown, Plus, Trash2,
  Upload, Send, Receipt, Search, User, Phone
} from 'lucide-react';

function formatVND(n) { return new Intl.NumberFormat('vi-VN').format(n || 0) + ' đ'; }
function parseVND(s)  { return Number(String(s).replace(/[^0-9]/g, '')) || 0; }

const VENDOR_TYPE_LABELS = {
  MATERIAL:    'Nguyên liệu',
  MACHINE:     'Máy móc',
  REPAIR:      'Sửa chữa',
  ELECTRICITY: 'Điện',
  WATER:       'Nước',
  GAS:         'Gas',
  LOGISTICS:   'Vận chuyển',
  SERVICE:     'Dịch vụ',
  OTHER:       'Khác',
};

// ── Modal tạo nhanh nhà cung cấp ──────────────────────────────────────────────
function QuickCreateVendorModal({ initialName = '', onClose, onCreated }) {
  const toast = useToast();
  const [name, setName]               = useState(initialName);
  const [vendorType, setVendorType]   = useState('OTHER');
  const [contactPerson, setContactPerson] = useState('');
  const [contactPhone, setContactPhone]   = useState('');
  const [saving, setSaving]           = useState(false);

  const handleSave = async () => {
    if (!name.trim()) { toast('Tên nhà cung cấp là bắt buộc', 'error'); return; }
    setSaving(true);
    try {
      const res = await api.post('/api/factory/material-vendors', {
        name: name.trim(),
        vendorType,
        contactPerson: contactPerson.trim(),
        contactPhone: contactPhone.trim(),
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-black/5">
          <div className="flex items-center gap-2">
            <Building2 size={18} className="text-[#C9A84C]" />
            <h3 className="font-bold text-[#1C1C1E]">Tạo nhà cung cấp</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-[#FAF7F2] text-[#8E8878]">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-[#1C1C1E] mb-1">Tên nhà cung cấp *</label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Nhập tên..."
              className="w-full px-3 py-2.5 rounded-xl border border-black/10 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/40"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#1C1C1E] mb-1">Loại</label>
            <select
              value={vendorType}
              onChange={e => setVendorType(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-black/10 text-sm focus:outline-none bg-white"
            >
              {Object.entries(VENDOR_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#1C1C1E] mb-1 flex items-center gap-1">
              <User size={11} className="text-[#C9A84C]" /> Người liên hệ
            </label>
            <input
              value={contactPerson}
              onChange={e => setContactPerson(e.target.value)}
              placeholder="Tên người liên hệ..."
              className="w-full px-3 py-2.5 rounded-xl border border-black/10 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/40"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#1C1C1E] mb-1 flex items-center gap-1">
              <Phone size={11} className="text-[#C9A84C]" /> Số điện thoại
            </label>
            <input
              value={contactPhone}
              onChange={e => setContactPhone(e.target.value)}
              placeholder="SĐT liên hệ..."
              className="w-full px-3 py-2.5 rounded-xl border border-black/10 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/40"
            />
          </div>
        </div>

        <div className="p-5 border-t border-black/5 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-black/10 text-sm font-semibold text-[#8E8878] hover:bg-[#FAF7F2] transition">
            Huỷ
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-[#C9A84C] text-white text-sm font-bold hover:bg-[#B8923E] transition disabled:opacity-50"
          >
            {saving ? 'Đang tạo...' : 'Tạo & Chọn'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal tạo phiếu chi chính ─────────────────────────────────────────────────
export default function ExpenseCreateModal({ onClose, onCreated }) {
  const toast = useToast();
  const fileRef = useRef();
  const dropRef = useRef();

  // Vendor state
  const [vendors, setVendors]           = useState([]);
  const [vendorLoading, setVendorLoading] = useState(false);
  const [dropOpen, setDropOpen]         = useState(false);
  const [vendorSearch, setVendorSearch] = useState('');
  const [selectedVendor, setSelectedVendor] = useState(null); // { id, name, vendorType, contactPerson, contactPhone }
  const [showQuickCreate, setShowQuickCreate] = useState(false);

  // Form state
  const [reason, setReason]             = useState('');
  const [requestedByName, setRequestedByName] = useState('');
  const [items, setItems]               = useState([{ id: 1, itemName: 'Khoản chi 1', amount: '', note: '' }]);
  const [images, setImages]             = useState([]);
  const [submitting, setSubmitting]     = useState(false);

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
  const addItem    = () => setItems(p => [...p, { id: Date.now(), itemName: `Khoản chi ${p.length + 1}`, amount: '', note: '' }]);
  const removeItem = (id) => setItems(p => p.filter(i => i.id !== id));
  const updateItem = (id, k, v) => setItems(p => p.map(i => i.id === id ? {...i, [k]: v} : i));
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
        setImages(p => p.map(img => img.id === tmp.id ? {...img, uploading: false, uploadedUrl: uploaded} : img));
      } catch {
        setImages(p => p.filter(img => img.id !== tmp.id));
        toast('Lỗi upload ảnh', 'error');
      }
    }
    e.target.value = '';
  };

  const handleSubmit = async () => {
    if (!selectedVendor) { toast('Vui lòng chọn nhà cung cấp', 'error'); return; }
    if (!reason.trim())  { toast('Lý do chi là bắt buộc', 'error'); return; }
    const validItems = items.filter(i => i.itemName.trim() && parseVND(i.amount) > 0);
    if (validItems.length === 0) { toast('Phải có ít nhất 1 khoản chi hợp lệ', 'error'); return; }
    if (images.some(img => img.uploading)) { toast('Đang tải ảnh, vui lòng chờ...', 'warning'); return; }

    setSubmitting(true);
    try {
      await expenseApi.create({
        vendorName: selectedVendor.name,
        reason: reason.trim(),
        requestedByName: requestedByName.trim() || null,
        items: validItems.map(i => ({ itemName: i.itemName.trim(), amount: parseVND(i.amount), note: i.note.trim() || null })),
        imageUrls: images.filter(img => img.uploadedUrl).map(img => img.uploadedUrl),
      });
      toast('Phiếu chi đã gửi, chờ ADMIN/OWNER duyệt', 'success');
      onCreated();
    } catch (e) {
      toast(e?.response?.data?.message || 'Lỗi khi tạo phiếu', 'error');
    } finally {
      setSubmitting(false); }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-black/5 flex-shrink-0">
            <div className="flex items-center gap-3">
              <Receipt size={20} className="text-[#C9A84C]" />
              <div>
                <h2 className="text-lg font-bold text-[#1C1C1E]">Tạo phiếu chi</h2>
                <p className="text-xs text-[#8E8878]">Phiếu sẽ gửi ADMIN/OWNER duyệt</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-[#FAF7F2] text-[#8E8878] transition">
              <X size={20} />
            </button>
          </div>

          {/* Body */}
          <div className="overflow-y-auto flex-1 p-5 space-y-4">

            {/* ── Nhà cung cấp (bắt buộc) ── */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-semibold text-[#1C1C1E] flex items-center gap-1.5">
                  <Building2 size={14} className="text-[#C9A84C]" />
                  Nhà cung cấp / Đơn vị <span className="text-red-500">*</span>
                </label>
              </div>

              <div className="relative" ref={dropRef}>
                {/* Trigger */}
                <div
                  onClick={() => { setDropOpen(o => !o); }}
                  className={`flex items-center justify-between px-4 py-2.5 rounded-xl border cursor-pointer transition ${
                    !selectedVendor ? 'border-black/10 hover:border-[#C9A84C]' : 'border-[#C9A84C] bg-[#FAF7F2]'
                  }`}
                >
                  {selectedVendor ? (
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#1C1C1E]">{selectedVendor.name}</p>
                      <p className="text-xs text-[#8E8878]">
                        {VENDOR_TYPE_LABELS[selectedVendor.vendorType] || selectedVendor.vendorType}
                        {selectedVendor.contactPerson && ` · ${selectedVendor.contactPerson}`}
                        {selectedVendor.contactPhone && ` · ${selectedVendor.contactPhone}`}
                      </p>
                    </div>
                  ) : (
                    <span className="text-sm text-[#8E8878]">
                      {vendorLoading ? 'Đang tải...' : 'Chọn nhà cung cấp...'}
                    </span>
                  )}
                  <ChevronDown size={16} className={`text-[#8E8878] transition-transform flex-shrink-0 ml-2 ${dropOpen ? 'rotate-180' : ''}`} />
                </div>

                {dropOpen && (
                  <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-black/10 rounded-xl shadow-xl overflow-hidden">
                    {/* Search trong dropdown */}
                    <div className="p-2 border-b border-black/5 relative">
                      <Search size={13} className="absolute left-5 top-1/2 -translate-y-1/2 text-[#8E8878]" />
                      <input
                        autoFocus
                        value={vendorSearch}
                        onChange={e => setVendorSearch(e.target.value)}
                        placeholder="Tìm nhà cung cấp..."
                        className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-black/10 focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/40"
                      />
                    </div>

                    <div className="max-h-48 overflow-y-auto">
                      {/* Bỏ chọn */}
                      {selectedVendor && (
                        <button
                          onClick={() => { setSelectedVendor(null); setDropOpen(false); }}
                          className="w-full text-left px-4 py-2.5 text-sm text-[#8E8878] hover:bg-[#FAF7F2] transition"
                        >
                          — Bỏ chọn —
                        </button>
                      )}

                      {filteredVendors.length === 0 && !vendorSearch && !vendorLoading && (
                        <p className="text-center py-4 text-xs text-[#8E8878]">Chưa có nhà cung cấp nào</p>
                      )}

                      {filteredVendors.map(v => (
                        <button
                          key={v.id}
                          onClick={() => { setSelectedVendor(v); setDropOpen(false); setVendorSearch(''); }}
                          className="w-full text-left px-4 py-2.5 hover:bg-[#FAF7F2] transition border-b border-black/5 last:border-0"
                        >
                          <p className="text-sm font-medium text-[#1C1C1E]">{v.name}</p>
                          <p className="text-xs text-[#8E8878]">
                            {VENDOR_TYPE_LABELS[v.vendorType] || v.vendorType}
                            {v.contactPerson && ` · ${v.contactPerson}`}
                            {v.contactPhone && ` · ${v.contactPhone}`}
                          </p>
                        </button>
                      ))}
                    </div>

                    {/* Nút tạo nhanh */}
                    <div className="p-2 border-t border-black/5">
                      <button
                        onClick={() => { setShowQuickCreate(true); setDropOpen(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#C9A84C] font-semibold hover:bg-[#FAF7F2] rounded-lg transition"
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
              <label className="block text-sm font-semibold text-[#1C1C1E] mb-1.5">
                Lý do chi <span className="text-red-500">*</span>
              </label>
              <input
                value={reason} onChange={e => setReason(e.target.value)}
                placeholder="Mô tả lý do chi tiết..."
                className="w-full px-4 py-2.5 rounded-xl border border-black/10 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/40"
              />
            </div>

            {/* ── Người yêu cầu ── */}
            <div>
              <label className="block text-sm font-semibold text-[#1C1C1E] mb-1.5">Người yêu cầu</label>
              <input
                value={requestedByName} onChange={e => setRequestedByName(e.target.value)}
                placeholder="Tên người yêu cầu (nếu khác người lập phiếu)..."
                className="w-full px-4 py-2.5 rounded-xl border border-black/10 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/40"
              />
            </div>

            {/* ── Khoản chi ── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-[#1C1C1E]">
                  Các khoản chi <span className="text-red-500">*</span>
                </label>
                <button onClick={addItem} className="flex items-center gap-1 text-xs text-[#C9A84C] hover:underline font-semibold">
                  <Plus size={13} /> Thêm khoản
                </button>
              </div>
              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div key={item.id} className="bg-[#FAF7F2] rounded-xl p-3 space-y-2">
                    <div className="flex gap-2">
                      <input
                        value={item.itemName} onChange={e => updateItem(item.id, 'itemName', e.target.value)}
                        placeholder={`Khoản chi ${idx + 1}...`}
                        className="flex-1 px-3 py-2 rounded-lg border border-black/10 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/40 bg-white"
                      />
                      <input
                        value={item.amount ? new Intl.NumberFormat('vi-VN').format(parseVND(item.amount)) : ''}
                        onChange={e => updateItem(item.id, 'amount', String(parseVND(e.target.value)))}
                        placeholder="Số tiền"
                        className="w-32 px-3 py-2 rounded-lg border border-black/10 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/40 bg-white text-right"
                      />
                      {items.length > 1 && (
                        <button onClick={() => removeItem(item.id)} className="p-2 rounded-lg hover:bg-red-50 text-red-400 transition flex-shrink-0">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                    <input
                      value={item.note} onChange={e => updateItem(item.id, 'note', e.target.value)}
                      placeholder="Ghi chú (tuỳ chọn)..."
                      className="w-full px-3 py-2 rounded-lg border border-black/10 text-xs focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/40 bg-white"
                    />
                  </div>
                ))}
              </div>
              <div className="text-right mt-2 text-sm font-bold text-[#1C1C1E]">
                Tổng: <span className="text-[#C9A84C]">{formatVND(totalAmount)}</span>
              </div>
            </div>

            {/* ── Ảnh ── */}
            <div>
              <label className="block text-sm font-semibold text-[#1C1C1E] mb-1.5">Ảnh chứng từ</label>
              <div className="flex flex-wrap gap-2">
                {images.map(img => (
                  <div key={img.id} className="relative w-16 h-16 rounded-xl overflow-hidden border border-black/10">
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
                  className="w-16 h-16 rounded-xl border-2 border-dashed border-black/20 flex flex-col items-center justify-center gap-0.5 hover:border-[#C9A84C] hover:bg-[#C9A84C]/5 transition text-[#8E8878] hover:text-[#C9A84C]">
                  <Upload size={14} />
                  <span className="text-xs">Thêm</span>
                </button>
                <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={handleImageChange} />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-5 border-t border-black/5 flex-shrink-0 flex gap-3">
            <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-black/10 text-sm font-semibold text-[#8E8878] hover:bg-[#FAF7F2] transition">
              Huỷ
            </button>
            <button
              onClick={handleSubmit} disabled={submitting}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[#C9A84C] text-white font-bold hover:bg-[#B8923E] transition disabled:opacity-50"
            >
              {submitting
                ? <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                : <Send size={16} />}
              {submitting ? 'Đang gửi...' : 'Gửi phiếu chi'}
            </button>
          </div>
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