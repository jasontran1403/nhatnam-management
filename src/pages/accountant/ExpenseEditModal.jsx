// src/pages/accountant/ExpenseEditModal.jsx
import { useState, useEffect, useRef } from 'react';
import { X, Receipt, Wallet, Landmark, Clock, Save, XCircle, AlertCircle, ChevronDown, Building2, Hash, Trash2, Plus, Search } from 'lucide-react';
import { useToast } from '../../components/common/Toast';
import { expenseApi } from '../../api/services';
import api from '../../api/axios';
import { accountantSupplierApi } from '../../api/accountantApi';
import ExpenseDatePeriodPicker, { defaultExpenseWhen } from '../../components/ui/ExpenseDatePeriodPicker';
import { formatVND } from '../../utils/format.js';

function parseVND(s) {
    return Number(String(s).replace(/[^0-9]/g, '')) || 0;
}

// Chuyển đổi từ dữ liệu voucher sang format của ExpenseDatePeriodPicker
function voucherToWhen(v) {
    // Ưu tiên hiển thị expensePeriod nếu có (phiếu tạo theo kỳ)
    if (v.expensePeriod) {
        return { mode: 'PERIOD', expensePeriod: v.expensePeriod };
    }
    // Nếu không có expensePeriod, hiển thị expenseDate (phiếu tạo theo ngày)
    if (v.expenseDate) {
        return { mode: 'DATE', expenseDate: v.expenseDate };
    }
    return defaultExpenseWhen();
}

export default function ExpenseEditModal({ voucher, onClose, onChanged, onSaved }) {
    const toast = useToast();
    const [loading, setLoading] = useState(false);

    // State cho nhà cung cấp
    const [vendorName, setVendorName] = useState(voucher.vendorName || '');
    const [vendorId, setVendorId] = useState(voucher.vendorId || null);
    const [suppliers, setSuppliers] = useState([]);
    const [supplierLoading, setSupplierLoading] = useState(false);
    const [supplierDropOpen, setSupplierDropOpen] = useState(false);
    const [supplierSearch, setSupplierSearch] = useState('');
    const supplierDropdownRef = useRef(null);
    const supplierButtonRef = useRef(null);

    // State cho danh mục khoản chi
    const [categories, setCategories] = useState([]);
    const [categoriesLoading, setCategoriesLoading] = useState(false);
    const [categoryDropOpen, setCategoryDropOpen] = useState(null);
    const [categorySearch, setCategorySearch] = useState('');
    const categoryDropdownRefs = useRef({});
    const categoryButtonRefs = useRef({});

    // Form state
    const [reason, setReason] = useState(voucher.reason || '');
    const [when, setWhen] = useState(voucherToWhen(voucher));
    const [requestedByName, setRequestedByName] = useState(voucher.requestedByName || '');
    const [paymentNumber, setPaymentNumber] = useState(voucher.paymentNumber || '');
    const [suggestedPaymentNumber, setSuggestedPaymentNumber] = useState('');

    // Danh sách khoản chi
    const [items, setItems] = useState(() =>
        (voucher.items || []).map((item, index) => ({
            id: item.id || Date.now() + index,
            itemName: item.itemName || '',
            amount: item.amount || 0,
            note: item.note || '',
            categoryId: item.categoryId || null,
        }))
    );

    // Load danh sách nhà cung cấp
    useEffect(() => {
        (async () => {
            setSupplierLoading(true);
            try {
                const res = await api.get('/api/factory/material-vendors');
                setSuppliers(res.data?.data || []);
            } catch {
                toast('Không thể tải danh sách nhà cung cấp', 'error');
            } finally { setSupplierLoading(false); }
        })();
    }, []);

    // Load danh mục khoản chi
    useEffect(() => {
        const loadCategories = async () => {
            setCategoriesLoading(true);
            try {
                const res = await expenseApi.expenseCategories();
                let data = [];
                if (res.data?.data) {
                    data = res.data.data;
                } else if (Array.isArray(res.data)) {
                    data = res.data;
                } else if (Array.isArray(res)) {
                    data = res;
                }
                setCategories(data || []);
            } catch (e) {
                console.error('Load categories error:', e);
                toast('Không tải được danh mục khoản chi', 'error');
                setCategories([]);
            } finally {
                setCategoriesLoading(false);
            }
        };
        loadCategories();
    }, []);

    // Gợi ý số phiếu chi
    useEffect(() => {
        expenseApi.nextPaymentNumber()
            .then(res => {
                const suggestion = res.data?.data ?? res.data ?? '';
                setSuggestedPaymentNumber(suggestion ? String(suggestion) : '');
            })
            .catch(() => { });
    }, []);

    // Đóng dropdown khi click ra ngoài
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (supplierDropdownRef.current && !supplierDropdownRef.current.contains(e.target)) {
                setSupplierDropOpen(false);
            }

            if (categoryDropOpen !== null) {
                const ref = categoryDropdownRefs.current[categoryDropOpen];
                if (ref && !ref.contains(e.target)) {
                    setCategoryDropOpen(null);
                    setCategorySearch('');
                }
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [categoryDropOpen]);

    const filteredSuppliers = suppliers.filter(s =>
        s.name?.toLowerCase().includes(supplierSearch.toLowerCase()) ||
        (s.phone && s.phone.includes(supplierSearch))
    );

    const filteredCategories = (searchTerm) => {
        if (!searchTerm || !searchTerm.trim()) return categories;
        const term = searchTerm.trim().toLowerCase();
        return categories.filter(c => c.name?.toLowerCase().includes(term));
    };

    const addItem = () => {
        setItems(prev => [...prev, { id: Date.now(), itemName: '', amount: 0, note: '', categoryId: null }]);
    };

    const removeItem = (id) => {
        if (items.length <= 1) {
            toast('Phiếu chi phải có ít nhất 1 khoản chi', 'error');
            return;
        }
        setItems(prev => prev.filter(i => i.id !== id));
    };

    const updateItem = (id, key, val) => {
        setItems(prev => prev.map(i => i.id === id ? { ...i, [key]: val } : i));
    };

    const selectCategory = (index, categoryId) => {
        const cat = categories.find(c => c.id === categoryId);
        if (cat) {
            updateItem(items[index].id, 'categoryId', categoryId);
            updateItem(items[index].id, 'itemName', cat.name);
        }
        setCategoryDropOpen(null);
        setCategorySearch('');
    };

    const totalAmount = items.reduce((s, i) => s + (Number(i.amount) || 0), 0);

    const handleSubmit = async () => {
        // Validate
        if (!reason.trim()) {
            toast('Lý do chi không được để trống', 'error');
            return;
        }

        const validItems = items.filter(i => i.categoryId && Number(i.amount) > 0);
        if (validItems.length === 0) {
            toast('Phải có ít nhất 1 khoản chi hợp lệ (chọn danh mục và nhập số tiền)', 'error');
            return;
        }

        if (when.mode === 'DATE' && !when.expenseDate) {
            toast('Vui lòng chọn ngày chi', 'error');
            return;
        }
        if (when.mode === 'PERIOD' && !when.expensePeriod) {
            toast('Vui lòng chọn kỳ chi', 'error');
            return;
        }

        // Build payload - thêm vendorId và vendorName
        const payload = {
            reason: reason.trim(),
            vendorName: vendorName.trim() || null,
            vendorId: vendorId || null,  // Thêm vendorId
            paymentNumber: (paymentNumber.trim() || suggestedPaymentNumber) || null,
            expenseDate: when.mode === 'DATE' ? (when.expenseDate ?? null) : null,
            expensePeriod: when.mode === 'PERIOD' ? (when.expensePeriod || null) : null,
            requestedByName: requestedByName.trim() || null,
            items: validItems.map(i => ({
                id: i.id || null,
                categoryId: i.categoryId,
                amount: Number(i.amount),
                note: i.note.trim() || null,
            })),
        };

        setLoading(true);
        try {
            await expenseApi.update(voucher.id, payload);
            toast('Đã cập nhật phiếu chi', 'success');

            if (onChanged) onChanged();
            onClose();

            if (onSaved) {
                setTimeout(() => {
                    onSaved();
                }, 300);
            }

        } catch (e) {
            toast(e?.response?.data?.message || 'Có lỗi xảy ra', 'error');
        } finally {
            setLoading(false);
        }
    };

    const isEditable = voucher.status !== 'REJECTED';
    const isApproved = voucher.status === 'APPROVED';

    if (!isEditable) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-lg p-6 text-center">
                    <XCircle size={48} className="text-red-500 mx-auto mb-3" />
                    <p className="text-lg font-bold text-ink">Không thể sửa phiếu này</p>
                    <p className="text-sm text-muted mt-1">Phiếu chi đã bị từ chối</p>
                    <button onClick={onClose} className="mt-4 px-6 py-2 rounded-xl bg-gold text-white font-semibold hover:bg-gold-strong transition">
                        Đóng
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-hairline flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <Receipt size={20} className="text-gold" />
                        <div>
                            <p className="font-mono text-sm font-bold text-gold">Sửa phiếu chi #{voucher.paymentNumber || voucher.voucherCode}</p>
                            {isApproved && (
                                <span className="text-xs text-amber-600 dark:text-amber-300 font-medium flex items-center gap-1">
                                    <AlertCircle size={12} /> Phiếu đã duyệt - chỉ Owner/Admin mới được sửa
                                </span>
                            )}
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-canvas text-muted transition">
                        <X size={20} />
                    </button>
                </div>

                {/* Body - overflow-y-auto để scroll */}
                <div className="overflow-y-auto flex-1 p-5 space-y-4">
                    {/* Nhà cung cấp - chỉ chọn từ dropdown */}
                    <div ref={supplierDropdownRef}>
                        <label className="text-sm font-semibold text-ink flex items-center gap-1.5 mb-1.5">
                            <Building2 size={14} className="text-gold" /> Nhà cung cấp / Đơn vị
                        </label>
                        <div className="relative" ref={supplierButtonRef}>
                            <div
                                onClick={() => setSupplierDropOpen(o => !o)}
                                className="flex items-center justify-between px-4 py-2.5 rounded-xl border border-hairline-2 bg-surface cursor-pointer hover:border-gold transition"
                            >
                                <span className={vendorName ? 'text-ink text-sm' : 'text-muted text-sm'}>
                                    {vendorName || (supplierLoading ? 'Đang tải...' : suppliers.length === 0 ? 'Chưa có nhà cung cấp' : 'Chọn nhà cung cấp...')}
                                </span>
                                <ChevronDown size={16} className={`text-muted transition-transform ${supplierDropOpen ? 'rotate-180' : ''}`} />
                            </div>

                            {/* Dropdown nhà cung cấp - render ra ngoài modal bằng portal */}
                            {supplierDropOpen && (
                                <div
                                    className="fixed z-[9999] bg-surface border border-hairline-2 rounded-xl shadow-2xl overflow-hidden"
                                    style={{
                                        width: supplierButtonRef.current?.offsetWidth || '100%',
                                        maxWidth: 'calc(100vw - 32px)',
                                        top: supplierButtonRef.current ?
                                            Math.min(
                                                supplierButtonRef.current.getBoundingClientRect().bottom + 8,
                                                window.innerHeight - 280
                                            ) : 'auto',
                                        left: supplierButtonRef.current ?
                                            Math.max(16, supplierButtonRef.current.getBoundingClientRect().left) : '16px',
                                        maxHeight: '280px',
                                    }}
                                >
                                    <div className="p-2 border-b border-hairline sticky top-0 bg-surface">
                                        <input
                                            autoFocus
                                            value={supplierSearch}
                                            onChange={e => setSupplierSearch(e.target.value)}
                                            placeholder="Tìm kiếm nhà cung cấp..."
                                            className="w-full px-3 py-2 text-sm rounded-lg border border-hairline-2 focus:outline-none focus:ring-2 focus:ring-gold/40"
                                            onClick={e => e.stopPropagation()}
                                        />
                                    </div>
                                    <div className="overflow-y-auto" style={{ maxHeight: '220px' }}>
                                        {supplierLoading ? (
                                            <p className="text-center py-3 text-xs text-muted">Đang tải...</p>
                                        ) : filteredSuppliers.length === 0 ? (
                                            <p className="text-center py-3 text-xs text-muted">
                                                {supplierSearch ? 'Không tìm thấy nhà cung cấp' : 'Chưa có nhà cung cấp nào'}
                                            </p>
                                        ) : (
                                            filteredSuppliers.map(s => (
                                                <button key={s.id}
                                                    onClick={() => {
                                                        setVendorName(s.name);
                                                        setVendorId(s.id);
                                                        setSupplierDropOpen(false);
                                                        setSupplierSearch('');
                                                    }}
                                                    className={`w-full text-left px-4 py-2.5 hover:bg-canvas transition ${vendorId === s.id ? 'bg-gold/10' : ''
                                                        }`}
                                                >
                                                    <p className="text-sm font-medium text-ink">{s.name}</p>
                                                    {s.phone && <p className="text-xs text-muted">{s.phone}</p>}
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                        {vendorName && (
                            <p className="text-xs text-muted mt-1">
                                Đã chọn: <span className="font-medium text-ink">{vendorName}</span>
                            </p>
                        )}
                    </div>

                    {/* Lý do chi */}
                    <div>
                        <label className="block text-sm font-semibold text-ink mb-1.5">Lý do chi *</label>
                        <input
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            placeholder="Mô tả lý do chi tiết..."
                            className="w-full px-4 py-2.5 rounded-xl border border-hairline-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40"
                        />
                    </div>

                    {/* Số phiếu chi */}
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


                    {/* Thời điểm chi */}
                    <div>
                        <label className="block text-sm font-semibold text-ink mb-1.5">Thời điểm chi</label>
                        <ExpenseDatePeriodPicker value={when} onChange={setWhen} />
                        <p className="text-xs text-muted mt-1">
                            Mặc định là <b>ngày hôm nay</b>. Chọn <b>Ngày</b> để ghi đúng ngày phát sinh (tiện tạo lại phiếu chi cũ);
                            hoặc chọn <b>Kỳ</b> để tính khoản chi vào cả tháng. Kỳ cho phép cả tháng hiện tại và tương lai.
                        </p>
                    </div>

                    {/* Người yêu cầu */}
                    <div>
                        <label className="block text-sm font-semibold text-ink mb-1.5">Người yêu cầu</label>
                        <input
                            value={requestedByName}
                            onChange={e => setRequestedByName(e.target.value)}
                            placeholder="Tên người yêu cầu (nếu khác người lập phiếu)..."
                            className="w-full px-4 py-2.5 rounded-xl border border-hairline-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40"
                        />
                    </div>

                    {/* Khoản chi - có dropdown chọn danh mục */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-semibold text-ink">Các khoản chi *</label>
                            <button onClick={addItem} className="flex items-center gap-1 text-xs text-gold hover:underline font-semibold">
                                <Plus size={13} /> Thêm khoản
                            </button>
                        </div>
                        <div className="space-y-2">
                            {items.map((item, idx) => {
                                const isOpen = categoryDropOpen === idx;
                                const filtered = filteredCategories(categorySearch);
                                const selectedCat = categories.find(c => c.id === item.categoryId);

                                return (
                                    <div key={item.id} className="bg-canvas rounded-xl p-3 space-y-2">
                                        <div className="flex gap-2">
                                            {/* Dropdown chọn danh mục khoản chi */}
                                            <div className="flex-1 relative">
                                                <button
                                                    ref={el => categoryButtonRefs.current[idx] = el}
                                                    type="button"
                                                    onClick={() => {
                                                        if (categories.length === 0) {
                                                            toast('Chưa có danh mục khoản chi nào', 'warning');
                                                            return;
                                                        }
                                                        setCategoryDropOpen(isOpen ? null : idx);
                                                        if (!isOpen) setCategorySearch('');
                                                    }}
                                                    className="w-full px-3 py-2 rounded-lg border border-hairline-2 bg-surface text-sm flex items-center justify-between hover:border-gold transition"
                                                >
                                                    <span className={selectedCat ? 'text-ink' : 'text-muted'}>
                                                        {selectedCat ? selectedCat.name : (categoriesLoading ? 'Đang tải...' : 'Chọn danh mục khoản chi...')}
                                                    </span>
                                                    <ChevronDown size={14} className={`text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                                                </button>

                                                {isOpen && (
                                                    <div
                                                        className="fixed z-[9999] bg-surface border border-hairline-2 rounded-xl shadow-2xl overflow-hidden"
                                                        style={{
                                                            width: categoryButtonRefs.current[idx]?.offsetWidth || '300px',
                                                            maxWidth: 'calc(100vw - 32px)',
                                                            top: categoryButtonRefs.current[idx] ?
                                                                Math.min(
                                                                    categoryButtonRefs.current[idx].getBoundingClientRect().bottom + 8,
                                                                    window.innerHeight - 280
                                                                ) : 'auto',
                                                            left: categoryButtonRefs.current[idx] ?
                                                                Math.max(16, categoryButtonRefs.current[idx].getBoundingClientRect().left) : '16px',
                                                            maxHeight: '280px',
                                                        }}
                                                    >
                                                        <div className="p-2 border-b border-hairline sticky top-0 bg-surface">
                                                            <div className="relative">
                                                                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
                                                                <input
                                                                    type="text"
                                                                    value={categorySearch}
                                                                    onChange={e => setCategorySearch(e.target.value)}
                                                                    placeholder="Tìm danh mục khoản chi..."
                                                                    className="w-full pl-7 pr-2 py-1.5 text-sm rounded-lg border border-hairline-2 focus:outline-none focus:ring-2 focus:ring-gold/40 bg-canvas"
                                                                    onClick={e => e.stopPropagation()}
                                                                    autoFocus
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="overflow-y-auto" style={{ maxHeight: '220px' }}>
                                                            {categoriesLoading ? (
                                                                <p className="text-center py-3 text-xs text-muted">Đang tải...</p>
                                                            ) : filtered.length === 0 ? (
                                                                <p className="text-center py-3 text-xs text-muted">
                                                                    {categorySearch ? 'Không tìm thấy danh mục' : 'Chưa có danh mục khoản chi nào'}
                                                                </p>
                                                            ) : (
                                                                filtered.map(cat => (
                                                                    <button
                                                                        key={cat.id}
                                                                        type="button"
                                                                        onClick={() => selectCategory(idx, cat.id)}
                                                                        className={`w-full text-left px-4 py-2.5 text-sm hover:bg-canvas transition ${item.categoryId === cat.id ? 'bg-gold/10 text-gold-strong' : 'text-ink'
                                                                            }`}
                                                                    >
                                                                        {cat.name}
                                                                    </button>
                                                                ))
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Số tiền */}
                                            <input
                                                value={item.amount ? new Intl.NumberFormat('vi-VN').format(Number(item.amount)) : ''}
                                                onChange={e => updateItem(item.id, 'amount', String(parseVND(e.target.value)))}
                                                placeholder="Số tiền"
                                                className="w-36 px-3 py-2 rounded-lg border border-hairline-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40 bg-surface text-right"
                                            />
                                            {items.length > 1 && (
                                                <button
                                                    onClick={() => removeItem(item.id)}
                                                    className="p-2 rounded-lg hover:bg-red-50 dark:bg-red-500/10 text-red-400 transition flex-shrink-0"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                        <input
                                            value={item.note}
                                            onChange={e => updateItem(item.id, 'note', e.target.value)}
                                            placeholder="Ghi chú (tuỳ chọn)..."
                                            className="w-full px-3 py-2 rounded-lg border border-hairline-2 text-xs focus:outline-none focus:ring-2 focus:ring-gold/40 bg-surface"
                                        />
                                    </div>
                                );
                            })}
                        </div>
                        <div className="text-right mt-2 text-sm font-bold text-ink">
                            Tổng: {formatVND(totalAmount)}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-hairline flex gap-3 flex-shrink-0">
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="flex-1 py-3 rounded-xl border border-hairline-2 text-sm font-semibold text-muted hover:bg-canvas transition disabled:opacity-50"
                    >
                        Huỷ
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="flex-1 py-3 rounded-xl bg-gold hover:bg-gold-strong text-white text-sm font-bold transition disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {loading ? <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Save size={16} />}
                        {loading ? 'Đang xử lý...' : 'Lưu thay đổi'}
                    </button>
                </div>
            </div>
        </div>
    );
}