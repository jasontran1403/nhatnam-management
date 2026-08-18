// src/pages/warehouse/WarehouseDeliveryPage.jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { useLang } from '../../context/LangContext';
import { warehouseApi, getImageUrl } from '../../api/services';
import { accountantApi } from '../../api/services';
import { useToast } from '../../components/common/Toast';
import OrderDetailModal from '../../components/seller/OrderDetailModal';
import DateRangePicker from '../../components/ui/DateRangePicker';
import { formatPrice } from '../../utils/formatPrice';
import { formatDeliveryAddress } from '../../utils/format';
import useMinLoading from '../../hooks/useMinLoading.js';
import api from '../../api/axios';
import {


    Search, RefreshCw, ChevronLeft, ChevronRight,
    Clock, CheckCircle, XCircle, Truck, Package, CreditCard,
    Camera, FileText, X, CheckSquare, Paperclip, Check,
    Plus, Download, Calendar, Lock, PackageCheck,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// YÊU CẦU THANH TOÁN TRƯỚC KHI GIAO HÀNG
// Khách được owner cấu hình "bắt buộc thanh toán trước" → không cho bấm
// "Bắt đầu giao hàng" khi đơn chưa thu đủ. BE cũng chặn ở markAsDelivering.
// ─────────────────────────────────────────────────────────────────────────────
const fmtVndShort = (n) => new Intl.NumberFormat('vi-VN').format(Math.round(Number(n) || 0));

function canDeliverOrder(o) {
    if (o?.canDeliver !== undefined) return !!o.canDeliver;      // BE mới

    // requirePrepaymentEffective do server tính, gộp cả cấu hình khách LẪN quy tắc
    // "giao ngoài địa bàn TP.HCM". Phải đọc trước requirePrepayment (cờ cấu hình thuần
    // của khách) — nếu không, đơn đi Bình Dương của một khách không bật cờ sẽ hiện nút
    // bấm được rồi mới nhận lỗi từ server.
    const mustPrepay = o?.requirePrepaymentEffective ?? o?.requirePrepayment;
    if (!mustPrepay) return true;
    return o.paymentStatus === 'PAID';
}

/** Lý do bị khoá — server gửi kèm để tooltip nói đúng nguyên nhân. */
function blockReason(o) {
    const base = o?.prepaymentReason || 'Đơn yêu cầu thanh toán trước';
    const remaining = Number(o?.remainingAmount ?? 0);
    return remaining > 0 ? `${base} — còn thiếu ${fmtVndShort(remaining)}đ` : base;
}

/** Nút "Bắt đầu giao hàng" — tự khoá khi khách yêu cầu thanh toán trước mà chưa thu đủ. */
function DeliverButton({ order, onClick, className, children }) {
    const allowed = canDeliverOrder(order);
    return (
        <button
            onClick={onClick}
            disabled={!allowed}
            title={allowed ? '' : blockReason(order)}
            className={`${className} disabled:opacity-50 disabled:cursor-not-allowed`}>
            {allowed ? children : <><Lock size={11} /> Chờ thanh toán</>}
        </button>
    );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(ts) {
    if (!ts) return '—';
    return new Date(ts).toLocaleString('vi-VN', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

function BtnSpinner({ size = 13, colorClass = 'border-current' }) {
    return (
        <div style={{ width: size, height: size }}
            className={`border-2 ${colorClass} border-t-transparent rounded-full animate-spin flex-shrink-0`} />
    );
}

// ── Status badge ──────────────────────────────────────────────────────────────
const STATUS_MAP = {
    PENDING:         { label: 'Chờ xử lý',      bg: 'bg-amber-50 dark:bg-amber-500/10   text-amber-600 dark:text-amber-300   border-amber-200 dark:border-amber-500/28',   Icon: Clock },
    CONFIRMED:       { label: 'Đã xác nhận',     bg: 'bg-sky-50 dark:bg-sky-500/10     text-sky-600 dark:text-sky-300     border-sky-200 dark:border-sky-500/28',     Icon: CheckCircle },
    PREPARING:       { label: 'Đang chuẩn bị',   bg: 'bg-blue-50 dark:bg-blue-500/10    text-blue-600 dark:text-blue-300    border-blue-200 dark:border-blue-500/28',    Icon: Package },
    READY:           { label: 'Sẵn sàng giao',   bg: 'bg-indigo-50 dark:bg-indigo-500/10  text-indigo-600 dark:text-indigo-300  border-indigo-200 dark:border-indigo-500/28',  Icon: CheckCircle },
    DELIVERING:      { label: 'Đang giao',        bg: 'bg-purple-50 dark:bg-purple-500/10  text-purple-600 dark:text-purple-300  border-purple-200 dark:border-purple-500/28',  Icon: Truck },
    PENDING_PAYMENT: { label: 'Chờ thanh toán',  bg: 'bg-orange-50 dark:bg-orange-500/10  text-orange-600 dark:text-orange-300  border-orange-200 dark:border-orange-500/28',  Icon: CreditCard },
    COMPLETED:       { label: 'Hoàn thành',       bg: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/28', Icon: CheckCircle },
    CANCELLED:       { label: 'Đã huỷ',          bg: 'bg-red-50 dark:bg-red-500/10     text-red-500     border-red-200 dark:border-red-500/28',     Icon: XCircle },
};

const DELIVERY_TYPES = [
    { value: 'TRUCK',     label: '🚛 Xe tải' },
    { value: 'MOTORBIKE', label: '🛵 Xe máy' },
];

function StatusBadge({ status }) {
    const cfg = STATUS_MAP[status] || STATUS_MAP.PENDING;
    const { Icon } = cfg;
    return (
        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${cfg.bg}`}>
            <Icon size={9} /> {cfg.label}
        </span>
    );
}

// ── DriverPicker ──────────────────────────────────────────────────────────────
function DriverPicker({ deliveryInfo = [], onChange }) {
    const toast = useToast();
    const [query, setQuery]               = useState('');
    const [results, setResults]           = useState([]);
    const [open, setOpen]                 = useState(false);
    const [creating, setCreating]         = useState(false);
    const [selectedType, setSelectedType] = useState('MOTORBIKE');
    const inputRef = useRef(null);
    const dropRef  = useRef(null);

    useEffect(() => {
        if (!open) return;
        const handler = (e) => {
            if (dropRef.current && !dropRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const t = setTimeout(() => {
            api.get(`/api/warehouse/drivers?q=${encodeURIComponent(query)}&type=${selectedType}`)
                .then(r => setResults(r.data?.data || []))
                .catch(() => setResults([]));
        }, 200);
        return () => clearTimeout(t);
    }, [query, open, selectedType]);

    const addDriver = (name) => {
        const existing = deliveryInfo.find(d => d.name === name && d.type === selectedType);
        if (existing) {
            onChange(deliveryInfo.map(d =>
                d.name === name && d.type === selectedType
                    ? { ...d, trips: d.trips + 1 }
                    : d
            ));
        } else {
            onChange([...deliveryInfo, { name, type: selectedType, trips: 1 }]);
        }
        setQuery('');
        setOpen(false);
    };

    const decreaseTrips = (idx) => {
        const updated = [...deliveryInfo];
        if (updated[idx].trips <= 1) updated.splice(idx, 1);
        else updated[idx] = { ...updated[idx], trips: updated[idx].trips - 1 };
        onChange(updated);
    };

    const increaseTrips = (idx) => {
        onChange(deliveryInfo.map((d, i) => i === idx ? { ...d, trips: d.trips + 1 } : d));
    };

    const remove = (idx) => onChange(deliveryInfo.filter((_, i) => i !== idx));

    const createAndAdd = async () => {
        const name = query.trim();
        if (!name) return;
        if (results.some(r => r.name?.trim().toLowerCase() === name.toLowerCase())) {
            toast(`Đã có tài xế tên "${name}"`, 'warning');
            return;
        }
        setCreating(true);
        try {
            const r = await api.post('/api/warehouse/drivers', { name, vehicleType: selectedType });
            if (r.data?.success === false) {
                toast(r.data.message || `Đã có tài xế tên "${name}"`, 'warning');
                return;
            }
            addDriver(name);
        } catch (e) {
            toast(e?.response?.data?.message || 'Không tạo được tài xế', 'error');
        } finally {
            setCreating(false);
        }
    };

    const showCreate = query.trim()
        && !results.some(r => r.name.toLowerCase() === query.trim().toLowerCase());

    return (
        <div className="space-y-3">
            <p className="text-[10px] font-bold text-muted uppercase tracking-wider">
                Tài xế giao hàng
            </p>

            {/* Loại phương tiện */}
            <div className="flex gap-2">
                {DELIVERY_TYPES.map(dt => (
                    <button key={dt.value}
                        onClick={() => setSelectedType(dt.value)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors
                            ${selectedType === dt.value
                                ? 'bg-gold text-white border-gold'
                                : 'bg-surface text-muted border-line hover:border-gold'}`}>
                        {dt.label}
                    </button>
                ))}
            </div>

            {/* Danh sách đã chọn */}
            {deliveryInfo.length > 0 && (
                <div className="space-y-1.5">
                    {deliveryInfo.map((d, idx) => (
                        <div key={idx}
                            className="flex items-center gap-2 bg-surface rounded-xl border border-line px-3 py-2">
                            <span className="text-[10px]">{d.type === 'TRUCK' ? '🚛' : '🛵'}</span>
                            <span className="flex-1 text-xs font-medium text-ink">{d.name}</span>
                            <div className="flex items-center gap-1">
                                <button onClick={() => decreaseTrips(idx)}
                                    className="w-5 h-5 rounded-full bg-surface-2 text-muted text-xs font-bold hover:bg-surface-3 flex items-center justify-center">
                                    −
                                </button>
                                <span className="text-xs font-bold text-gold min-w-[2.5rem] text-center">
                                    {d.trips} lượt
                                </span>
                                <button onClick={() => increaseTrips(idx)}
                                    className="w-5 h-5 rounded-full bg-surface-2 text-muted text-xs font-bold hover:bg-surface-3 flex items-center justify-center">
                                    +
                                </button>
                            </div>
                            <button onClick={() => remove(idx)} className="text-faint hover:text-red-400 ml-1">
                                <X size={12} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Search input */}
            <div ref={dropRef} className="relative">
                <div className="flex gap-1.5">
                    <div className="relative flex-1">
                        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
                        <input ref={inputRef} type="text"
                            placeholder={`Tìm tài xế (${selectedType === 'TRUCK' ? 'xe tải' : 'xe máy'})...`}
                            value={query}
                            onChange={e => { setQuery(e.target.value); setOpen(true); }}
                            onFocus={() => setOpen(true)}
                            className="w-full pl-8 pr-3 py-2 text-xs border border-line rounded-lg
                                focus:outline-none focus:border-gold bg-surface placeholder:text-faint" />
                    </div>
                    {showCreate && (
                        <button onClick={createAndAdd} disabled={creating}
                            className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold
                                bg-gold text-white hover:bg-gold-strong disabled:opacity-60">
                            <Plus size={12} /> Thêm
                        </button>
                    )}
                </div>
                {open && results.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-surface rounded-xl
                        border border-line shadow-lg py-1 max-h-40 overflow-y-auto">
                        {results.map(d => (
                            <button key={d.id}
                                onClick={() => addDriver(d.name)}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left
                                    hover:bg-canvas text-ink transition-colors">
                                <span>{selectedType === 'TRUCK' ? '🚛' : '🛵'}</span>
                                <span className="flex-1">{d.name}</span>
                                <span className="text-faint text-[10px]">+ thêm lượt</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {deliveryInfo.length === 0 && (
                <p className="text-[10px] text-faint italic">Chưa chọn tài xế</p>
            )}
        </div>
    );
}

// ── AddDriverSection ─────────────────────────────────────────────────────────
// Dùng cho modal xác nhận giao hàng thành công: CHỈ ĐƯỢC THÊM, không được xoá
// hoặc đổi tài xế đã gán cho đơn trước đó.
//   - Tài xế đã có trong đơn: hiển thị read-only (không nút xoá/giảm lượt).
//   - Có thể bấm "+1 lượt" cho tài xế đã có (cùng loại xe đã gắn).
//   - Có thể thêm tài xế MỚI (chưa có trong đơn) ở bất kỳ loại xe nào.
//   - 1 tài xế chỉ gắn 1 loại xe trong đơn: nếu tài xế đã có ở loại A, không cho
//     thêm chính tài xế đó ở loại B trong cùng đơn — phải dùng đúng loại đã gắn.
function AddDriverSection({ existingInfo = [], addedInfo = [], onAddedChange }) {
    const toast = useToast();
    const [query, setQuery]               = useState('');
    const [results, setResults]           = useState([]);
    const [open, setOpen]                 = useState(false);
    const [creating, setCreating]         = useState(false);
    const [selectedType, setSelectedType] = useState('MOTORBIKE');
    const [err, setErr] = useState('');
    const dropRef  = useRef(null);

    useEffect(() => {
        if (!open) return;
        const handler = (e) => {
            if (dropRef.current && !dropRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const t = setTimeout(() => {
            api.get(`/api/warehouse/drivers?q=${encodeURIComponent(query)}&type=${selectedType}`)
                .then(r => setResults(r.data?.data || []))
                .catch(() => setResults([]));
        }, 200);
        return () => clearTimeout(t);
    }, [query, open, selectedType]);

    // Tài xế đã gán loại xe khác trong đơn này — không cho thêm lại với loại khác
    const findLockedType = (name) => existingInfo.find(d => d.name === name)?.type
        || addedInfo.find(d => d.name === name)?.type;

    const addOrBumpDriver = (name) => {
        const locked = findLockedType(name);
        if (locked && locked !== selectedType) {
            setErr(`Tài xế "${name}" đã gán loại xe ${locked === 'TRUCK' ? 'xe tải' : 'xe máy'} trong đơn này — chỉ có thể thêm lượt cho đúng loại xe đó`);
            return;
        }
        setErr('');

        // Nếu tài xế đã có sẵn trong đơn (existingInfo) cùng loại xe → chỉ +1 lượt ở phần "added"
        const inExisting = existingInfo.some(d => d.name === name && d.type === selectedType);
        const inAdded = addedInfo.some(d => d.name === name && d.type === selectedType);

        if (inAdded) {
            onAddedChange(addedInfo.map(d =>
                d.name === name && d.type === selectedType ? { ...d, trips: d.trips + 1 } : d
            ));
        } else {
            // Dòng mới trong "added" — dù tài xế đã có sẵn trong đơn hay là tài xế hoàn toàn mới,
            // số lượt thêm luôn được cộng riêng rồi merge vào tổng khi submit.
            onAddedChange([...addedInfo, { name, type: selectedType, trips: 1, isExisting: inExisting }]);
        }
        setQuery('');
        setOpen(false);
    };

    const increaseAddedTrips = (idx) => {
        onAddedChange(addedInfo.map((d, i) => i === idx ? { ...d, trips: d.trips + 1 } : d));
    };
    const decreaseAddedTrips = (idx) => {
        const updated = [...addedInfo];
        if (updated[idx].trips <= 1) updated.splice(idx, 1);
        else updated[idx] = { ...updated[idx], trips: updated[idx].trips - 1 };
        onAddedChange(updated);
    };
    const removeAdded = (idx) => onAddedChange(addedInfo.filter((_, i) => i !== idx));

    const createAndAdd = async () => {
        const name = query.trim();
        if (!name) return;
        if (results.some(r => r.name?.trim().toLowerCase() === name.toLowerCase())) {
            toast(`Đã có tài xế tên "${name}"`, 'warning');
            return;
        }
        setCreating(true);
        try {
            const r = await api.post('/api/warehouse/drivers', { name, vehicleType: selectedType });
            if (r.data?.success === false) {
                toast(r.data.message || `Đã có tài xế tên "${name}"`, 'warning');
                return;
            }
            addOrBumpDriver(name);
        } catch (e) {
            toast(e?.response?.data?.message || 'Không tạo được tài xế', 'error');
        } finally {
            setCreating(false);
        }
    };

    const showCreate = query.trim()
        && !results.some(r => r.name.toLowerCase() === query.trim().toLowerCase());

    return (
        <div className="space-y-3">
            <p className="text-[10px] font-bold text-muted uppercase tracking-wider">
                Tài xế giao hàng
            </p>

            {/* Tài xế đã gán cho đơn — READ-ONLY, không xoá/đổi được */}
            {existingInfo.length > 0 && (
                <div className="space-y-1.5">
                    {existingInfo.map((d, idx) => (
                        <div key={`existing-${idx}`}
                            className="flex items-center gap-2 bg-canvas rounded-xl border border-line px-3 py-2">
                            <span className="text-[10px]">{d.type === 'TRUCK' ? '🚛' : '🛵'}</span>
                            <span className="flex-1 text-xs font-medium text-ink">{d.name}</span>
                            <span className="text-xs font-bold text-muted">{d.trips} lượt</span>
                            <span className="text-[9px] text-faint italic ml-1">đã gán</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Tài xế / lượt mới thêm trong lần xác nhận này */}
            {addedInfo.length > 0 && (
                <div className="space-y-1.5">
                    {addedInfo.map((d, idx) => (
                        <div key={`added-${idx}`}
                            className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl border border-emerald-200 dark:border-emerald-500/28 px-3 py-2">
                            <span className="text-[10px]">{d.type === 'TRUCK' ? '🚛' : '🛵'}</span>
                            <span className="flex-1 text-xs font-medium text-ink">
                                {d.name} <span className="text-[9px] text-emerald-600 dark:text-emerald-300 font-normal">{d.isExisting ? '(+lượt)' : '(mới)'}</span>
                            </span>
                            <div className="flex items-center gap-1">
                                <button onClick={() => decreaseAddedTrips(idx)}
                                    className="w-5 h-5 rounded-full bg-surface text-muted text-xs font-bold hover:bg-emerald-100 dark:bg-emerald-500/18 flex items-center justify-center">
                                    −
                                </button>
                                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-300 min-w-[2.5rem] text-center">
                                    +{d.trips} lượt
                                </span>
                                <button onClick={() => increaseAddedTrips(idx)}
                                    className="w-5 h-5 rounded-full bg-surface text-muted text-xs font-bold hover:bg-emerald-100 dark:bg-emerald-500/18 flex items-center justify-center">
                                    +
                                </button>
                            </div>
                            <button onClick={() => removeAdded(idx)} className="text-faint hover:text-red-400 ml-1">
                                <X size={12} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {err && <p className="text-[10px] text-red-500 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/28 rounded-lg px-2.5 py-1.5">{err}</p>}

            {/* Loại phương tiện */}
            <div className="flex gap-2">
                {DELIVERY_TYPES.map(dt => (
                    <button key={dt.value}
                        onClick={() => { setSelectedType(dt.value); setErr(''); }}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors
                            ${selectedType === dt.value
                                ? 'bg-gold text-white border-gold'
                                : 'bg-surface text-muted border-line hover:border-gold'}`}>
                        {dt.label}
                    </button>
                ))}
            </div>

            {/* Search input */}
            <div ref={dropRef} className="relative">
                <div className="flex gap-1.5">
                    <div className="relative flex-1">
                        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
                        <input type="text"
                            placeholder={`Thêm tài xế (${selectedType === 'TRUCK' ? 'xe tải' : 'xe máy'})...`}
                            value={query}
                            onChange={e => { setQuery(e.target.value); setOpen(true); }}
                            onFocus={() => setOpen(true)}
                            className="w-full pl-8 pr-3 py-2 text-xs border border-line rounded-lg
                                focus:outline-none focus:border-gold bg-surface placeholder:text-faint" />
                    </div>
                    {showCreate && (
                        <button onClick={createAndAdd} disabled={creating}
                            className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold
                                bg-gold text-white hover:bg-gold-strong disabled:opacity-60">
                            <Plus size={12} /> Thêm
                        </button>
                    )}
                </div>
                {open && results.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-surface rounded-xl
                        border border-line shadow-lg py-1 max-h-40 overflow-y-auto">
                        {results.map(d => (
                            <button key={d.id}
                                onClick={() => addOrBumpDriver(d.name)}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left
                                    hover:bg-canvas text-ink transition-colors">
                                <span>{selectedType === 'TRUCK' ? '🚛' : '🛵'}</span>
                                <span className="flex-1">{d.name}</span>
                                <span className="text-faint text-[10px]">+ thêm lượt</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {existingInfo.length === 0 && addedInfo.length === 0 && (
                <p className="text-[10px] text-faint italic">Chưa có tài xế nào</p>
            )}
        </div>
    );
}


function PrepareDeliverModal({ order, detail, detailLoading, onClose, onConfirm, onPickupAtWarehouse, loading }) {
    const [deliveryInfo, setDeliveryInfo] = useState(() => {
        try { return JSON.parse(order?.deliveryInfoJson || '[]'); }
        catch { return []; }
    });

    // Auto-save khi deliveryInfo thay đổi
    useEffect(() => {
        if (!order?.id) return;
        const t = setTimeout(async () => {
            try {
                await api.patch(`/api/warehouse/orders/${order.id}/drivers`, { deliveryInfo });
            } catch (_) { }
        }, 600);
        return () => clearTimeout(t);
    }, [deliveryInfo]); // eslint-disable-line

    const items = detail?.items || [];

    /** Đã chọn ít nhất một tài xế chưa — điều kiện bật nút "Bắt đầu giao hàng". */
    const hasDriver = Array.isArray(deliveryInfo)
        && deliveryInfo.some(d => d?.name && String(d.name).trim());

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full sm:max-w-xl bg-surface rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[90vh] sm:max-h-[85vh] flex flex-col overflow-hidden">

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-line-soft flex-shrink-0">
                    <div>
                        <p className="text-[10px] text-muted uppercase tracking-wider">Bắt đầu giao hàng</p>
                        <h2 className="font-mono text-sm font-bold text-gold">{order?.orderCode}</h2>
                        <p className="text-xs text-muted mt-0.5">{formatDate(order?.createdAt)}</p>
                    </div>
                    <button onClick={onClose}
                        className="p-2 rounded-xl bg-surface-2 text-muted hover:bg-surface-3 transition-colors">
                        <X size={16} />
                    </button>
                </div>

                {/* Customer info */}
                <div className="px-5 py-3 bg-canvas border-b border-line-soft flex-shrink-0 space-y-2">
                    <div>
                        {/* Kho quan tâm NGƯỜI NHẬN, không phải người mua. "Khách vãng lai"
                            ở đây không giúp gì cho việc giao hàng. */}
                        <p className="text-[10px] text-muted uppercase tracking-wider">Người nhận hàng</p>
                        <p className="text-sm font-semibold text-ink">
                            {order?.receiverName || order?.customerName || 'Khách lẻ'}
                        </p>
                        {order?.customerPhone && <p className="text-[11px] text-muted">{order.customerPhone}</p>}
                    </div>

                    {/*
                      THÔNG TIN GIAO HÀNG — người đặt, thời gian đặt, địa chỉ nhận.
                      Nhân viên kho cần đủ ba thứ này ngay trên màn hình xác nhận: gọi ai
                      khi thiếu hàng, đơn đặt lâu chưa, và giao tới đâu. Trước đây phải mở
                      chi tiết đơn ở tab khác mới thấy địa chỉ.
                    */}
                    <div className="grid grid-cols-1 gap-1.5 pt-2 border-t border-line-soft">
                        <InfoLine label="Địa chỉ nhận"
                            value={formatDeliveryAddress(order)} />
                    </div>

                    {order?.notes && <p className="text-[11px] text-muted italic">📝 {order.notes}</p>}
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                    <div className="bg-canvas rounded-2xl px-4 py-3.5 border border-line-soft">
                        <DriverPicker deliveryInfo={deliveryInfo} onChange={setDeliveryInfo} />
                    </div>

                    <div>
                        <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2.5">
                            Danh sách sản phẩm ({items.length})
                        </p>
                        {detailLoading ? (
                            <div className="flex justify-center py-8">
                                <BtnSpinner size={22} colorClass="border-gold/30 !border-t-gold" />
                            </div>
                        ) : items.length > 0 ? (
                            <div className="space-y-2">
                                {items.map((item, idx) => (
                                    <div key={idx}
                                        className="flex items-start gap-3 bg-canvas rounded-xl p-3 border border-line-soft">
                                        <div className="w-10 h-10 rounded-lg bg-surface overflow-hidden shrink-0 border border-line">
                                            {item.productImageUrl
                                                ? <img src={getImageUrl(item.productImageUrl)} alt={item.productName} className="w-full h-full object-cover" />
                                                : <div className="w-full h-full flex items-center justify-center text-lg">🍽️</div>}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-semibold text-ink leading-snug">{item.productName}</p>
                                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                                {item.saleType === 'BOX' ? (
                                                    <span className="text-[10px] font-semibold bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/28 rounded-md px-1.5 py-0.5">
                                                        📦 Thùng ({item.unitsPerBox} {item.unit})
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] font-medium bg-surface-2 text-muted rounded-md px-1.5 py-0.5">
                                                        {item.unit || 'cái'}
                                                    </span>
                                                )}
                                                {item.notes && <span className="text-[10px] text-muted italic">· {item.notes}</span>}
                                            </div>
                                            {item.ingredientsUsed?.length > 0 && (
                                                <div className="mt-2 space-y-1">
                                                    {item.ingredientsUsed.map((ing, i) => (
                                                        <div key={i} className="flex items-center justify-between">
                                                            <div className="flex items-center gap-1.5">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-gold shrink-0" />
                                                                <span className="text-[10px] text-muted">{ing.ingredientName}</span>
                                                            </div>
                                                            <span className="text-[10px] font-semibold text-gold">{ing.quantityUsed} {ing.unit}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <div className="shrink-0 min-w-[2rem] h-8 rounded-full bg-gold/10 flex items-center justify-center px-2">
                                            <span className="text-xs font-bold text-gold">x{item.quantity}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs text-faint italic text-center py-6">Không có thông tin sản phẩm</p>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-5 py-4 border-t border-line-soft flex-shrink-0 flex gap-2">
                    <button onClick={onClose} disabled={loading}
                        className="flex-1 py-3 rounded-2xl border border-line text-sm text-muted hover:bg-surface-2 transition-colors font-medium">
                        Huỷ
                    </button>
                    {/*
                      NHẬN TẠI KHO — khách tự tới lấy nên không có chặng giao.
                      Đóng đơn thẳng thay vì bắt bấm "bắt đầu giao" rồi "xác nhận đã giao":
                      hai bước đó mô tả một chuyến xe không tồn tại, và nhân viên kho hay
                      quên bước hai khiến đơn treo ở "Đang giao".
                      Vẫn tôn trọng điều kiện thu tiền trước — hàng ra khỏi kho là ra thật.
                    */}
                    <button onClick={() => onPickupAtWarehouse?.(order)}
                        disabled={loading || !canDeliverOrder(order)}
                        title={canDeliverOrder(order) ? 'Khách tự nhận hàng tại kho' : blockReason(order)}
                        className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border border-emerald-300 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-300 font-semibold text-sm hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-all disabled:opacity-60 disabled:cursor-not-allowed">
                        <PackageCheck size={15} /> Đã nhận tại kho
                    </button>
                    {/* BẮT BUỘC CHỌN TÀI XẾ trước khi giao — không có tài xế thì không ai
                        chịu trách nhiệm chuyến hàng, và báo cáo km/lương tài xế mất dòng.
                        Nút "Đã nhận tại kho" KHÔNG cần: khách tự tới lấy, không có chuyến. */}
                    <button onClick={() => onConfirm(order.id, deliveryInfo)}
                        disabled={loading || !canDeliverOrder(order) || !hasDriver}
                        title={!canDeliverOrder(order) ? blockReason(order)
                            : !hasDriver ? 'Vui lòng chọn tài xế giao hàng' : ''}
                        className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-gold text-white font-semibold text-sm hover:bg-gold-strong active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed">
                        {loading
                            ? <BtnSpinner size={14} colorClass="border-white/40 !border-t-white" />
                            : canDeliverOrder(order)
                                ? <><Truck size={15} /> Bắt đầu giao hàng</>
                                : <><Lock size={15} /> Chờ khách thanh toán</>}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── ConfirmDeliverModal ───────────────────────────────────────────────────────
function ConfirmDeliverModal({ order, onClose, onConfirm, loading }) {
    const [file, setFile]       = useState(null);
    const [preview, setPreview] = useState(null);
    const fileInputRef = useRef(null);

    const existingDriverInfo = (() => {
        try { return JSON.parse(order?.deliveryInfoJson || '[]'); }
        catch { return []; }
    })();
    const [addedDriverInfo, setAddedDriverInfo] = useState([]);

    const handleFile = (f) => {
        if (!f) return;
        if (!['image/png', 'image/jpg', 'image/jpeg'].includes(f.type)) {
            alert('Chỉ chấp nhận file ảnh PNG, JPG, JPEG');
            return;
        }
        setFile(f);
        const reader = new FileReader();
        reader.onload = (e) => setPreview(e.target.result);
        reader.readAsDataURL(f);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-surface rounded-2xl shadow-2xl w-full max-w-sm max-h-[90vh] flex flex-col">

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-line-soft flex-shrink-0">
                    <div>
                        <p className="text-[10px] text-muted uppercase tracking-wider">Xác nhận giao thành công</p>
                        <h2 className="font-bold text-ink font-mono text-sm">{order?.orderCode}</h2>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-muted hover:bg-surface-2">
                        <X size={16} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                    <div className="bg-canvas rounded-xl p-3 space-y-1.5">
                        <div className="flex justify-between text-xs">
                            <span className="text-muted">Khách hàng</span>
                            <span className="font-semibold text-ink text-right max-w-[180px] truncate">{order?.customerName || '—'}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="text-muted">Tổng tiền</span>
                            <span className="font-bold text-gold">{formatPrice(order?.finalAmount)}</span>
                        </div>
                    </div>

                    {/* Tài xế — chỉ được thêm, không xoá/đổi tài xế đã gán trước đó */}
                    <div className="bg-canvas rounded-2xl px-3 py-3 border border-line-soft">
                        <AddDriverSection
                            existingInfo={existingDriverInfo}
                            addedInfo={addedDriverInfo}
                            onAddedChange={setAddedDriverInfo}
                        />
                    </div>

                    {/* Chứng từ */}
                    <div className="space-y-2">
                        <p className="text-xs font-semibold text-ink">
                            Chứng từ nhận hàng <span className="text-muted font-normal">(tuỳ chọn)</span>
                        </p>
                        {preview ? (
                            <div className="relative">
                                <img src={preview} alt="preview" className="w-full h-36 object-cover rounded-xl border border-line" />
                                <button onClick={() => { setFile(null); setPreview(null); }}
                                    className="absolute top-2 right-2 p-1 bg-black/50 rounded-full text-white hover:bg-black/70">
                                    <X size={12} />
                                </button>
                            </div>
                        ) : (
                            <button onClick={() => fileInputRef.current?.click()}
                                className="flex flex-col items-center gap-2 py-5 w-full rounded-xl border-2 border-dashed border-line text-muted hover:border-gold hover:text-gold hover:bg-gold/5 transition-all">
                                <Camera size={22} />
                                <span className="text-xs font-medium">Chụp ảnh / Chọn ảnh</span>
                            </button>
                        )}
                        <input ref={fileInputRef} type="file" accept="image/png,image/jpg,image/jpeg"
                            capture="environment" className="hidden"
                            onChange={e => handleFile(e.target.files?.[0])} />
                    </div>

                    <p className="text-xs text-muted bg-canvas rounded-xl px-3 py-2 border border-line">
                        Đơn sẽ chuyển sang <span className="font-semibold text-orange-600 dark:text-orange-300">Chờ thanh toán</span>.
                        {!file && ' Có thể tải chứng từ lên sau.'}
                    </p>
                </div>

                {/* Footer */}
                <div className="flex gap-2 px-5 pb-5 pt-3 border-t border-line-soft flex-shrink-0">
                    <button onClick={onClose} disabled={loading}
                        className="flex-1 py-2.5 rounded-xl border border-line text-sm text-muted hover:bg-surface-2 transition-colors font-medium">
                        Huỷ
                    </button>
                    <button onClick={() => onConfirm(file || null, addedDriverInfo)} disabled={loading}
                        className="flex-1 py-2.5 rounded-xl bg-gold text-white text-sm font-semibold hover:bg-gold-strong transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                        {loading
                            ? <BtnSpinner size={14} colorClass="border-white/40 !border-t-white" />
                            : <><CheckSquare size={14} /> Xác nhận</>}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function WarehouseDeliveryPage() {
    const toast = useToast();

    const [orders, setOrders]               = useState([]);
    const [total, setTotal]                 = useState(0);
    const [page, setPage]                   = useState(0);
    const [pageSize]                        = useState(50);
    const [loading, setLoading]             = useMinLoading();
    const [search, setSearch]               = useState('');
    const [searchInput, setSearchInput]     = useState('');
    const [dateRange, setDateRange]         = useState({ from: null, to: null });
    const [invoiceLoadingId, setInvoiceLoadingId] = useState(null);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [detailLoading, setDetailLoading] = useState(null);

    const [showExportModal, setShowExportModal]         = useState(false);
    const [exportFrom, setExportFrom]                   = useState('');
    const [exportTo, setExportTo]                       = useState('');
    const [exporting, setExporting]                     = useState(false);
    const [exportExcludeWarehouse, setExportExcludeWarehouse] = useState(true);

    const handleExportReport = async () => {
        if (!exportFrom || !exportTo) { toast('Chọn khoảng thời gian', 'error'); return; }
        setExporting(true);
        try {
            const res = await api.get('/api/warehouse/reports/driver', {
                params: {
                    from: exportFrom,
                    to: exportTo,
                    excludeWarehouse: exportExcludeWarehouse,
                },
                responseType: 'blob',
            });
            const url = URL.createObjectURL(res.data);
            const a = document.createElement('a');
            a.href = url;
            a.download = `bao-cao-tai-xe-${exportFrom}-${exportTo}.xlsx`;
            a.click();
            URL.revokeObjectURL(url);
            setShowExportModal(false);
            toast('Đã xuất báo cáo', 'success');
        } catch { toast('Lỗi xuất báo cáo', 'error'); }
        finally { setExporting(false); }
    };

    const [prepareTarget, setPrepareTarget]             = useState(null);
    const [preparingLoading, setPreparingLoading]       = useState(false);
    const [prepareDetail, setPrepareDetail]             = useState(null);
    const [prepareDetailLoading, setPrepareDetailLoading] = useState(false);

    const [deliverTarget, setDeliverTarget] = useState(null);
    /** Đơn đang chờ xác nhận "khách đã nhận tại kho". */
    const [pickupTarget, setPickupTarget] = useState(null);
    const [pickupLoading, setPickupLoading] = useState(false);
    const [deliverLoading, setDeliverLoading] = useState(false);

    const receiptInputRef = useRef(null);
    const [uploadingId, setUploadingId] = useState(null);

    const totalPages = Math.ceil(total / pageSize);

    const openPrepareModal = async (o) => {
        setPrepareTarget(o);
        setPrepareDetail(null);
        setPrepareDetailLoading(true);
        try {
            const dr = await warehouseApi.getOrderDetail(o.id);
            setPrepareDetail(dr.data?.data || dr.data || null);
        } catch { }
        finally { setPrepareDetailLoading(false); }
    };

    const handleStartDeliver = async (orderId, deliveryInfo) => {
        setPreparingLoading(true);
        try {
            if (deliveryInfo.length > 0) {
                try {
                    await api.patch(`/api/warehouse/orders/${orderId}/drivers`, { deliveryInfo });
                } catch (_) { }
            }
            await warehouseApi.markDelivering(orderId);
            setOrders(prev => prev.map(o =>
                o.id === orderId
                    ? { ...o, status: 'DELIVERING', deliveryInfoJson: JSON.stringify(deliveryInfo) }
                    : o
            ));
            setPrepareTarget(null);
            toast('Đã bắt đầu giao hàng', 'success');
        } catch (e) {
            toast(e?.response?.data?.message || 'Lỗi khi cập nhật trạng thái', 'error');
        } finally {
            setPreparingLoading(false);
        }
    };

    /**
     * KHÁCH NHẬN HÀNG TẠI KHO — đóng đơn trong một bước.
     *
     * <p>Gọi lần lượt hai API sẵn có (chuyển Đang giao → xác nhận đã giao) thay vì thêm
     * endpoint mới: cả hai đã mang đủ kiểm tra nghiệp vụ (chặn thu tiền trước, ghi log,
     * bắn thông báo). Thêm đường tắt riêng ở backend đồng nghĩa phải nhân bản các kiểm
     * tra đó và chúng sẽ trôi lệch nhau theo thời gian.
     *
     * <p>Nếu bước hai lỗi, đơn dừng ở "Đang giao" — trạng thái hợp lệ, xử lý tiếp bằng
     * nút xác nhận giao bình thường, không để lại dữ liệu hỏng.
     */
    const handlePickupAtWarehouse = async () => {
        if (!pickupTarget) return;
        setPickupLoading(true);
        try {
            await warehouseApi.markDelivering(pickupTarget.id);
            const res = await warehouseApi.confirmDelivered(pickupTarget.id);
            const nextStatus = res?.data?.data?.status || 'PENDING_PAYMENT';

            setOrders(prev => prev.map(o =>
                o.id === pickupTarget.id ? { ...o, status: nextStatus } : o));
            toast(nextStatus === 'COMPLETED'
                ? 'Khách đã nhận tại kho — đơn hoàn thành'
                : 'Khách đã nhận tại kho — đơn chuyển sang chờ thanh toán', 'success');

            setPickupTarget(null);
            setPrepareTarget(null);
            setPrepareDetail(null);
            fetchOrders();
        } catch (e) {
            toast(e?.response?.data?.message || e?.message || 'Không xử lý được', 'error');
        } finally { setPickupLoading(false); }
    };

    const handleDeliverConfirm = async (file, addedDriverInfo = []) => {
        if (!deliverTarget) return;
        setDeliverLoading(true);
        try {
            // Merge tài xế mới thêm vào danh sách hiện có — CHỈ CỘNG LƯỢT/THÊM MỚI,
            // không xoá hoặc đổi tài xế đã gán cho đơn trước đó.
            let mergedDriverInfo = null;
            if (addedDriverInfo.length > 0) {
                let existing = [];
                try { existing = JSON.parse(deliverTarget.deliveryInfoJson || '[]'); } catch { existing = []; }
                mergedDriverInfo = [...existing];
                for (const added of addedDriverInfo) {
                    const idx = mergedDriverInfo.findIndex(d => d.name === added.name && d.type === added.type);
                    if (idx >= 0) {
                        mergedDriverInfo[idx] = { ...mergedDriverInfo[idx], trips: mergedDriverInfo[idx].trips + added.trips };
                    } else {
                        mergedDriverInfo.push({ name: added.name, type: added.type, trips: added.trips });
                    }
                }
                try {
                    await api.patch(`/api/warehouse/orders/${deliverTarget.id}/drivers`, { deliveryInfo: mergedDriverInfo });
                } catch (_) { }
            }

            // Đọc TRẠNG THÁI THẬT từ server. Đơn đã thu đủ tiền trước sẽ được backend
            // chuyển thẳng sang COMPLETED — gán cứng PENDING_PAYMENT như trước khiến
            // hàng hiển thị "Chờ thanh toán" cho tới khi người dùng F5.
            const confirmRes = await warehouseApi.confirmDelivered(deliverTarget.id);
            const confirmed = confirmRes?.data?.data || {};
            const nextStatus = confirmed.status || 'PENDING_PAYMENT';
            let receiptUrl = null;
            if (file) {
                const fd = new FormData();
                fd.append('file', file);
                try {
                    const uploadRes = await warehouseApi.uploadReceiptFile(deliverTarget.id, fd);
                    receiptUrl = uploadRes.data?.data?.receiptFileUrl || null;
                } catch {
                    toast('Đã xác nhận giao hàng nhưng không tải được chứng từ', 'warning');
                }
            }
            setOrders(prev => prev.map(o =>
                o.id === deliverTarget.id
                    ? {
                        ...o,
                        status: nextStatus,
                        ...(confirmed.paymentStatus ? { paymentStatus: confirmed.paymentStatus } : {}),
                        ...(receiptUrl ? { receiptFileUrl: receiptUrl } : {}),
                        ...(mergedDriverInfo ? { deliveryInfoJson: JSON.stringify(mergedDriverInfo) } : {}),
                    }
                    : o
            ));
            setDeliverTarget(null);
            toast('Đã xác nhận giao hàng thành công', 'success');
        } catch (e) {
            toast(e?.response?.data?.message || 'Lỗi khi xác nhận giao hàng', 'error');
        } finally {
            setDeliverLoading(false);
        }
    };

    const handleInvoice = async (orderId, e) => {
        if (e) e.stopPropagation();
        if (invoiceLoadingId) return;
        setInvoiceLoadingId(orderId);
        try {
            const res = await warehouseApi.getInvoice(orderId);
            const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
            const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
            if (isMobile) {
                const a = document.createElement('a');
                a.href = url; a.download = `hoa-don-${orderId}.pdf`;
                document.body.appendChild(a); a.click(); document.body.removeChild(a);
            } else {
                window.open(url, '_blank');
            }
            setTimeout(() => URL.revokeObjectURL(url), 60000);
        } catch {
            toast('Không thể tải hoá đơn', 'error');
        } finally {
            setInvoiceLoadingId(null);
        }
    };

    const fetchOrders = useCallback(async (p = 0) => {
        setLoading(true);
        try {
            const params = {};
            if (dateRange.from) params.from = new Date(dateRange.from).setHours(12, 0, 0, 0);
            if (dateRange.to)   params.to   = new Date(dateRange.to).setHours(12, 0, 0, 0);
            if (search.trim())  params.keyword = search.trim();
            const res = await warehouseApi.getDeliveryOrders(params);
            const content = res.data?.data || [];
            setTotal(content.length);
            const start = p * pageSize;
            setOrders(content.slice(start, start + pageSize));
            setPage(p);
        } catch {
            toast('Không thể tải danh sách đơn hàng', 'error');
        } finally {
            setLoading(false);
        }
    }, [dateRange, search, pageSize]);

    useEffect(() => { fetchOrders(0); }, [fetchOrders]);

    useEffect(() => {
        const t = setTimeout(() => setSearch(searchInput), 600);
        return () => clearTimeout(t);
    }, [searchInput]);

    const handleUploadReceipt = (orderId) => {
        setUploadingId(orderId);
        receiptInputRef.current?.click();
    };

    const handleReceiptFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file || !uploadingId) return;
        const fd = new FormData();
        fd.append('file', file);
        try {
            const res = await warehouseApi.uploadReceiptFile(uploadingId, fd);
            const url = res.data?.data?.receiptFileUrl;
            setOrders(prev => prev.map(o => o.id === uploadingId ? { ...o, receiptFileUrl: url } : o));
            toast('Đã tải lên chứng từ', 'success');
        } catch {
            toast('Lỗi khi tải chứng từ', 'error');
        } finally {
            setUploadingId(null);
            e.target.value = '';
        }
    };

    const openDetail = async (o) => {
        setDetailLoading(o.id);
        try {
            const [dr, lr] = await Promise.all([
                accountantApi.getOrderDetail(o.id),
                accountantApi.getOrderLogs(o.id),
            ]);
            setSelectedOrder({ ...(dr.data?.data || o), logs: lr.data?.data || [] });
        } catch {
            setSelectedOrder(o);
        } finally {
            setDetailLoading(null);
        }
    };

    return (
        <div className="flex flex-col h-full bg-canvas">

            {/* ── Header ── */}
            <div className="flex-shrink-0 px-4 sm:px-6 py-4 bg-surface border-b border-line-soft">
                <div className="flex items-center gap-2 mb-3">
                    <div className="flex-1 min-w-0">
                        <h1 className="text-lg sm:text-xl font-bold text-ink">Đơn hàng</h1>
                        <p className="text-[10px] sm:text-xs text-muted">{total} đơn</p>
                    </div>
                    <div className="relative flex-1 max-w-xs">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                        <input type="text" placeholder="Mã đơn, khách hàng, người tạo..."
                            value={searchInput} onChange={e => setSearchInput(e.target.value)}
                            className="border border-line rounded-xl pl-9 pr-4 py-2 text-sm bg-surface focus:outline-none focus:border-gold w-full" />
                        {searchInput && (
                            <button onClick={() => setSearchInput('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink">
                                <X size={13} />
                            </button>
                        )}
                    </div>
                    <div className="hidden sm:block">
                        <DateRangePicker from={dateRange.from} to={dateRange.to}
                            onChange={r => { setDateRange(r); setPage(0); }}
                            placeholder="Khoảng ngày" align="right" />
                    </div>
                    <button onClick={() => fetchOrders(0)}
                        className="p-2 rounded-xl bg-surface-2 text-muted hover:bg-surface-3 transition-colors shrink-0">
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <button onClick={() => setShowExportModal(true)}
                        title="Xuất báo cáo tài xế"
                        className="p-2 rounded-xl bg-gold/10 text-gold hover:bg-gold/20 transition-colors shrink-0">
                        <Download size={14} />
                    </button>
                </div>
                <div className="sm:hidden">
                    <DateRangePicker from={dateRange.from} to={dateRange.to}
                        onChange={r => { setDateRange(r); setPage(0); }}
                        placeholder="Chọn khoảng ngày" />
                </div>
            </div>

            {/* ── Content ── */}
            <div className="flex-1 overflow-auto px-4 sm:px-6 py-4">
                {loading && orders.length === 0 ? (
                    <div className="flex justify-center py-16">
                        <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : orders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-muted gap-2">
                        <Search size={32} strokeWidth={1} />
                        <p className="text-sm">Không có đơn hàng nào</p>
                    </div>
                ) : (
                    <>
                        {/* Desktop table */}
                        <div className="hidden md:block bg-surface rounded-2xl border border-line-soft overflow-hidden shadow-sm">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-canvas border-b border-line-soft">
                                        <tr>
                                            {['Mã đơn','Khách hàng','Người tạo đơn','Tổng tiền','Trạng thái','Ngày tạo','Chứng từ','Hành động'].map(h => (
                                                <th key={h} className="text-left text-[10px] font-bold text-muted uppercase tracking-wider px-4 py-3 whitespace-nowrap">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {orders.map(o => {
                                            const isDelivering     = o.status === 'DELIVERING';
                                            const isPendingPayment = o.status === 'PENDING_PAYMENT';
                                            const canUploadReceipt = isPendingPayment && !o.receiptFileUrl;
                                            return (
                                                <tr key={o.id} className="border-b border-line-soft last:border-0 hover:bg-canvas/50 transition-colors">
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <span className="font-mono text-xs font-bold text-gold">{o.orderCode}</span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <p className="text-xs font-medium text-ink truncate max-w-[140px]">{o.customerName || 'Khách lẻ'}</p>
                                                        {o.customerPhone && <p className="text-[10px] text-muted">{o.customerPhone}</p>}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex flex-col gap-1 items-start">
                                                            <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-surface-2 text-muted border-line whitespace-nowrap w-fit">
                                                                👤 {o.createdByName || '—'}
                                                            </span>
                                                            <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-500/28 whitespace-nowrap w-fit">
                                                                🏭 {o.warehouseName || '—'}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <span className="text-xs font-bold text-ink">{formatPrice(o.finalAmount)}</span>
                                                    </td>
                                                    <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <span className="text-xs text-muted">{formatDate(o.createdAt)}</span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {o.receiptFileUrl ? (
                                                            <a href={getImageUrl(o.receiptFileUrl)} target="_blank" rel="noopener noreferrer"
                                                                onClick={e => e.stopPropagation()}
                                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/28 whitespace-nowrap hover:bg-emerald-100 dark:bg-emerald-500/18">
                                                                📄 Xem
                                                            </a>
                                                        ) : canUploadReceipt ? (
                                                            <button onClick={e => { e.stopPropagation(); handleUploadReceipt(o.id); }}
                                                                disabled={uploadingId === o.id}
                                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-300 border border-amber-200 dark:border-amber-500/28 whitespace-nowrap hover:bg-amber-100 dark:bg-amber-500/18 disabled:opacity-50">
                                                                {uploadingId === o.id ? <BtnSpinner size={9} /> : <><Paperclip size={9} /> Tải lên</>}
                                                            </button>
                                                        ) : (
                                                            <span className="text-[10px] text-faint">—</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-1.5">
                                                            {o.status === 'PREPARING' && (
                                                                <DeliverButton order={o}
                                                                    onClick={e => { e.stopPropagation(); openPrepareModal(o); }}
                                                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-300 border border-purple-200 dark:border-purple-500/28 hover:bg-purple-100 dark:bg-purple-500/18 transition-colors text-[10px] font-semibold whitespace-nowrap">
                                                                    <Truck size={11} /> Bắt đầu giao hàng
                                                                </DeliverButton>
                                                            )}
                                                            <button onClick={e => { e.stopPropagation(); handleInvoice(o.id, e); }}
                                                                disabled={!!invoiceLoadingId}
                                                                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border transition-all text-[10px] font-semibold whitespace-nowrap
                                                                    ${invoiceLoadingId === o.id
                                                                        ? 'bg-gold/15 text-gold border-gold/40 cursor-wait'
                                                                        : 'bg-gold/10 text-gold border-transparent hover:bg-gold/20'}`}>
                                                                {invoiceLoadingId === o.id
                                                                    ? <BtnSpinner size={10} colorClass="border-gold !border-t-transparent" />
                                                                    : <FileText size={11} />}
                                                                Phiếu đặt hàng
                                                            </button>
                                                            {isDelivering && (
                                                                <button onClick={e => { e.stopPropagation(); setDeliverTarget(o); }}
                                                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gold text-white border border-gold hover:bg-gold-strong transition-colors text-[10px] font-semibold whitespace-nowrap">
                                                                    <CheckSquare size={11} /> Xác nhận giao
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Mobile cards */}
                        <div className="md:hidden space-y-3">
                            {orders.map(o => {
                                const isDelivering     = o.status === 'DELIVERING';
                                const isPendingPayment = o.status === 'PENDING_PAYMENT';
                                const canUploadReceipt = isPendingPayment && !o.receiptFileUrl;
                                return (
                                    <div key={o.id} className="bg-surface rounded-2xl border border-line-soft p-4 space-y-3 shadow-sm">
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <p className="font-mono text-xs font-bold text-gold">{o.orderCode}</p>
                                                <p className="text-sm font-semibold text-ink mt-0.5">{o.customerName || 'Khách lẻ'}</p>
                                                {o.customerPhone && <p className="text-[10px] text-muted">{o.customerPhone}</p>}
                                            </div>
                                            <div className="text-right shrink-0">
                                                <p className="text-sm font-bold text-ink">{formatPrice(o.finalAmount)}</p>
                                                <p className="text-[10px] text-muted mt-0.5">{formatDate(o.createdAt)}</p>
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-line-soft">
                                            <StatusBadge status={o.status} />
                                            <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-surface-2 text-muted border-line">
                                                👤 {o.orderedByName || o.createdByName || '—'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {o.receiptFileUrl ? (
                                                <a href={getImageUrl(o.receiptFileUrl)} target="_blank" rel="noopener noreferrer"
                                                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/28">
                                                    📄 Xem chứng từ
                                                </a>
                                            ) : canUploadReceipt ? (
                                                <button onClick={() => handleUploadReceipt(o.id)} disabled={uploadingId === o.id}
                                                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-300 border border-amber-200 dark:border-amber-500/28 disabled:opacity-50">
                                                    {uploadingId === o.id ? <BtnSpinner size={10} /> : <><Paperclip size={11} /> Tải chứng từ</>}
                                                </button>
                                            ) : null}
                                            {o.status === 'PREPARING' && (
                                                <DeliverButton order={o}
                                                    onClick={() => openPrepareModal(o)}
                                                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-300 border border-purple-200 dark:border-purple-500/28 hover:bg-purple-100 dark:bg-purple-500/18 transition-colors">
                                                    <Truck size={12} /> Bắt đầu giao hàng
                                                </DeliverButton>
                                            )}
                                            <button onClick={e => { e.stopPropagation(); handleInvoice(o.id, e); }}
                                                disabled={!!invoiceLoadingId}
                                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-gold/10 text-gold border border-gold/20">
                                                {invoiceLoadingId === o.id
                                                    ? <BtnSpinner size={10} colorClass="border-gold !border-t-transparent" />
                                                    : <><FileText size={12} /> Phiếu đặt hàng</>}
                                            </button>
                                            {isDelivering && (
                                                <button onClick={() => setDeliverTarget(o)}
                                                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gold text-white hover:bg-gold-strong transition-colors">
                                                    <CheckSquare size={12} /> Xác nhận giao
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}

                {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-4">
                        <button onClick={() => fetchOrders(page - 1)} disabled={page === 0 || loading}
                            className="p-2 rounded-xl bg-surface border border-line text-muted hover:border-gold disabled:opacity-40 transition-colors">
                            <ChevronLeft size={15} />
                        </button>
                        <span className="text-sm text-muted px-3">{page + 1} / {totalPages}</span>
                        <button onClick={() => fetchOrders(page + 1)} disabled={page >= totalPages - 1 || loading}
                            className="p-2 rounded-xl bg-surface border border-line text-muted hover:border-gold disabled:opacity-40 transition-colors">
                            <ChevronRight size={15} />
                        </button>
                    </div>
                )}
            </div>

            <input ref={receiptInputRef} type="file" accept="image/png,image/jpg,image/jpeg"
                className="hidden" onChange={handleReceiptFileChange} />

            {/* ── Export Driver Report Modal ── */}
            {showExportModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
                        {/* Header with gradient */}
                        <div className="bg-gradient-to-r from-gold to-gold-strong px-5 py-4 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                                    <Download size={16} className="text-white" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-white text-sm">Xuất báo cáo tài xế</h3>
                                    <p className="text-white/70 text-[10px]">Thống kê km · phiếu · đơn giao</p>
                                </div>
                            </div>
                            <button onClick={() => setShowExportModal(false)}
                                className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors">
                                <X size={14} />
                            </button>
                        </div>

                        <div className="p-5 space-y-4">
                            {/* Date range */}
                            <div>
                                <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2.5">
                                    Khoảng thời gian
                                </p>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="block text-[11px] font-semibold text-ink-2 flex items-center gap-1">
                                            <Calendar size={10} className="text-gold" /> Từ ngày
                                        </label>
                                        <input type="date" value={exportFrom}
                                            onChange={e => setExportFrom(e.target.value)}
                                            className="w-full h-9 px-3 rounded-xl border border-line text-sm focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/10 transition-all" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="block text-[11px] font-semibold text-ink-2 flex items-center gap-1">
                                            <Calendar size={10} className="text-gold" /> Đến ngày
                                        </label>
                                        <input type="date" value={exportTo}
                                            onChange={e => setExportTo(e.target.value)}
                                            min={exportFrom}
                                            className="w-full h-9 px-3 rounded-xl border border-line text-sm focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/10 transition-all" />
                                    </div>
                                </div>
                            </div>

                            {/* Filter options */}
                            <div className="space-y-1.5">
                                <p className="text-[10px] font-bold text-muted uppercase tracking-wider">
                                    Bộ lọc
                                </p>
                                <label className="flex items-center gap-3 p-3 rounded-xl border border-line bg-canvas cursor-pointer hover:border-gold/50 transition-colors group">
                                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all flex-shrink-0
                                        ${exportExcludeWarehouse
                                            ? 'bg-gold border-gold'
                                            : 'border-line bg-surface group-hover:border-gold/50'}`}
                                        onClick={() => setExportExcludeWarehouse(v => !v)}>
                                        {exportExcludeWarehouse && <Check size={11} className="text-white" strokeWidth={3} />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-semibold text-ink">Bỏ tài xế giao tại kho</p>
                                        <p className="text-[10px] text-muted mt-0.5">Chỉ tính tài xế giao đến khách</p>
                                    </div>
                                </label>
                            </div>

                            {/* Summary hint */}
                            {exportFrom && exportTo && (
                                <div className="flex items-center gap-2 bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/28 rounded-xl px-3 py-2">
                                    <FileText size={12} className="text-sky-500 shrink-0" />
                                    <p className="text-[11px] text-sky-700 dark:text-sky-300">
                                        Báo cáo từ <strong>{new Date(exportFrom).toLocaleDateString('vi-VN')}</strong> đến <strong>{new Date(exportTo).toLocaleDateString('vi-VN')}</strong>
                                        {exportExcludeWarehouse && <span className="text-sky-500"> · không gồm giao tại kho</span>}
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-2 px-5 pb-5">
                            <button onClick={() => setShowExportModal(false)}
                                className="flex-1 py-2.5 rounded-xl border border-line text-sm text-ink-2 hover:bg-surface-2 transition-colors font-medium">
                                Hủy
                            </button>
                            <button onClick={handleExportReport}
                                disabled={exporting || !exportFrom || !exportTo}
                                className="flex-1 py-2.5 rounded-xl bg-gold text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-gold-strong disabled:opacity-40 transition-colors">
                                {exporting
                                    ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Đang xuất...</>
                                    : <><Download size={14} /> Xuất Excel</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {prepareTarget && (
                <PrepareDeliverModal
                    order={prepareTarget}
                    detail={prepareDetail}
                    detailLoading={prepareDetailLoading}
                    onClose={() => { setPrepareTarget(null); setPrepareDetail(null); }}
                    onConfirm={handleStartDeliver}
                    onPickupAtWarehouse={(o) => setPickupTarget(o)}
                    loading={preparingLoading}
                />
            )}

            {pickupTarget && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        onClick={() => setPickupTarget(null)} />
                    <div className="relative bg-surface rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4">
                        <div>
                            <h3 className="font-bold text-ink text-base">Khách đã nhận hàng tại kho?</h3>
                            <p className="text-xs text-muted mt-1">
                                Đơn <span className="font-mono font-bold text-ink">{pickupTarget.orderCode}</span> sẽ
                                được đánh dấu giao xong ngay, không qua bước xác nhận giao hàng.
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => setPickupTarget(null)} disabled={pickupLoading}
                                className="flex-1 py-2.5 rounded-xl border border-line text-sm font-semibold text-ink-2 hover:bg-surface-2 transition-colors disabled:opacity-50">
                                Huỷ
                            </button>
                            <button onClick={handlePickupAtWarehouse} disabled={pickupLoading}
                                className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 transition-colors disabled:opacity-50">
                                {pickupLoading ? 'Đang xử lý...' : 'Xác nhận'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {deliverTarget && (
                <ConfirmDeliverModal
                    order={deliverTarget}
                    onClose={() => setDeliverTarget(null)}
                    onConfirm={handleDeliverConfirm}
                    loading={deliverLoading}
                />
            )}

            {selectedOrder && (
                <OrderDetailModal
                    order={selectedOrder}
                    onClose={() => setSelectedOrder(null)}
                    onRefresh={fetchOrders}
                />
            )}
        </div>
    );
}

/** Một dòng "nhãn — giá trị" trong khối thông tin giao hàng. */
function InfoLine({ label, value }) {
    return (
        <div className="flex items-start justify-between gap-3 text-[11px]">
            <span className="text-muted shrink-0">{label}</span>
            <span className="text-ink font-medium text-right break-words">{value}</span>
        </div>
    );
}
