// src/pages/warehouse/WarehouseDeliveryPage.jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { useLang } from '../../context/LangContext';
import { warehouseApi, getImageUrl } from '../../api/services';
import { accountantApi } from '../../api/services';
import { useToast } from '../../components/common/Toast';
import OrderDetailModal from '../../components/seller/OrderDetailModal';
import DateRangePicker from '../../components/ui/DateRangePicker';
import { formatPrice } from '../../utils/formatPrice';
import useMinLoading from '../../hooks/useMinLoading.js';
import api from '../../api/axios';
import {
    Search, RefreshCw, ChevronLeft, ChevronRight,
    Clock, CheckCircle, XCircle, Truck, Package, CreditCard,
    Camera, FileText, X, CheckSquare, Paperclip,
    Plus, Download, Calendar,
} from 'lucide-react';

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
    PENDING:         { label: 'Chờ xử lý',      bg: 'bg-amber-50   text-amber-600   border-amber-200',   Icon: Clock },
    CONFIRMED:       { label: 'Đã xác nhận',     bg: 'bg-sky-50     text-sky-600     border-sky-200',     Icon: CheckCircle },
    PREPARING:       { label: 'Đang chuẩn bị',   bg: 'bg-blue-50    text-blue-600    border-blue-200',    Icon: Package },
    READY:           { label: 'Sẵn sàng giao',   bg: 'bg-indigo-50  text-indigo-600  border-indigo-200',  Icon: CheckCircle },
    DELIVERING:      { label: 'Đang giao',        bg: 'bg-purple-50  text-purple-600  border-purple-200',  Icon: Truck },
    PENDING_PAYMENT: { label: 'Chờ thanh toán',  bg: 'bg-orange-50  text-orange-600  border-orange-200',  Icon: CreditCard },
    COMPLETED:       { label: 'Hoàn thành',       bg: 'bg-emerald-50 text-emerald-600 border-emerald-200', Icon: CheckCircle },
    CANCELLED:       { label: 'Đã huỷ',          bg: 'bg-red-50     text-red-500     border-red-200',     Icon: XCircle },
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
        setCreating(true);
        try {
            await api.post('/api/warehouse/drivers', { name, vehicleType: selectedType });
            addDriver(name);
        } catch (_) { }
        setCreating(false);
    };

    const showCreate = query.trim()
        && !results.some(r => r.name.toLowerCase() === query.trim().toLowerCase());

    return (
        <div className="space-y-3">
            <p className="text-[10px] font-bold text-[#8E8878] uppercase tracking-wider">
                Tài xế giao hàng
            </p>

            {/* Loại phương tiện */}
            <div className="flex gap-2">
                {DELIVERY_TYPES.map(dt => (
                    <button key={dt.value}
                        onClick={() => setSelectedType(dt.value)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors
                            ${selectedType === dt.value
                                ? 'bg-[#C9A84C] text-white border-[#C9A84C]'
                                : 'bg-white text-[#8E8878] border-[#E8DDD0] hover:border-[#C9A84C]'}`}>
                        {dt.label}
                    </button>
                ))}
            </div>

            {/* Danh sách đã chọn */}
            {deliveryInfo.length > 0 && (
                <div className="space-y-1.5">
                    {deliveryInfo.map((d, idx) => (
                        <div key={idx}
                            className="flex items-center gap-2 bg-white rounded-xl border border-[#E8DDD0] px-3 py-2">
                            <span className="text-[10px]">{d.type === 'TRUCK' ? '🚛' : '🛵'}</span>
                            <span className="flex-1 text-xs font-medium text-[#1C1C1E]">{d.name}</span>
                            <div className="flex items-center gap-1">
                                <button onClick={() => decreaseTrips(idx)}
                                    className="w-5 h-5 rounded-full bg-[#F0EBE3] text-[#8E8878] text-xs font-bold hover:bg-[#E8DDD0] flex items-center justify-center">
                                    −
                                </button>
                                <span className="text-xs font-bold text-[#C9A84C] min-w-[2.5rem] text-center">
                                    {d.trips} lượt
                                </span>
                                <button onClick={() => increaseTrips(idx)}
                                    className="w-5 h-5 rounded-full bg-[#F0EBE3] text-[#8E8878] text-xs font-bold hover:bg-[#E8DDD0] flex items-center justify-center">
                                    +
                                </button>
                            </div>
                            <button onClick={() => remove(idx)} className="text-[#C4B9A8] hover:text-red-400 ml-1">
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
                        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8E8878]" />
                        <input ref={inputRef} type="text"
                            placeholder={`Tìm tài xế (${selectedType === 'TRUCK' ? 'xe tải' : 'xe máy'})...`}
                            value={query}
                            onChange={e => { setQuery(e.target.value); setOpen(true); }}
                            onFocus={() => setOpen(true)}
                            className="w-full pl-8 pr-3 py-2 text-xs border border-[#E8DDD0] rounded-lg
                                focus:outline-none focus:border-[#C9A84C] bg-white placeholder:text-[#C4B9A8]" />
                    </div>
                    {showCreate && (
                        <button onClick={createAndAdd} disabled={creating}
                            className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold
                                bg-[#C9A84C] text-white hover:bg-[#B8943C] disabled:opacity-60">
                            <Plus size={12} /> Thêm
                        </button>
                    )}
                </div>
                {open && results.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white rounded-xl
                        border border-[#E8DDD0] shadow-lg py-1 max-h-40 overflow-y-auto">
                        {results.map(d => (
                            <button key={d.id}
                                onClick={() => addDriver(d.name)}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left
                                    hover:bg-[#FAF7F2] text-[#1C1C1E] transition-colors">
                                <span>{selectedType === 'TRUCK' ? '🚛' : '🛵'}</span>
                                <span className="flex-1">{d.name}</span>
                                <span className="text-[#C4B9A8] text-[10px]">+ thêm lượt</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {deliveryInfo.length === 0 && (
                <p className="text-[10px] text-[#C4B9A8] italic">Chưa chọn tài xế</p>
            )}
        </div>
    );
}

// ── PrepareDeliverModal ───────────────────────────────────────────────────────
function PrepareDeliverModal({ order, detail, detailLoading, onClose, onConfirm, loading }) {
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

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full sm:max-w-xl bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[90vh] sm:max-h-[85vh] flex flex-col overflow-hidden">

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-[#F0EBE3] flex-shrink-0">
                    <div>
                        <p className="text-[10px] text-[#8E8878] uppercase tracking-wider">Bắt đầu giao hàng</p>
                        <h2 className="font-mono text-sm font-bold text-[#C9A84C]">{order?.orderCode}</h2>
                        <p className="text-xs text-[#8E8878] mt-0.5">{formatDate(order?.createdAt)}</p>
                    </div>
                    <button onClick={onClose}
                        className="p-2 rounded-xl bg-[#F0EBE3] text-[#8E8878] hover:bg-[#E8DDD0] transition-colors">
                        <X size={16} />
                    </button>
                </div>

                {/* Customer info */}
                <div className="px-5 py-3 bg-[#FAF7F2] border-b border-[#F0EBE3] flex-shrink-0">
                    <p className="text-xs font-semibold text-[#1C1C1E]">{order?.customerName || 'Khách lẻ'}</p>
                    {order?.customerPhone && <p className="text-[10px] text-[#8E8878]">{order.customerPhone}</p>}
                    {order?.notes && <p className="text-[11px] text-[#8E8878] mt-1 italic">📝 {order.notes}</p>}
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                    <div className="bg-[#FAF7F2] rounded-2xl px-4 py-3.5 border border-[#F0EBE3]">
                        <DriverPicker deliveryInfo={deliveryInfo} onChange={setDeliveryInfo} />
                    </div>

                    <div>
                        <p className="text-[10px] font-bold text-[#8E8878] uppercase tracking-wider mb-2.5">
                            Danh sách sản phẩm ({items.length})
                        </p>
                        {detailLoading ? (
                            <div className="flex justify-center py-8">
                                <BtnSpinner size={22} colorClass="border-[#C9A84C]/30 !border-t-[#C9A84C]" />
                            </div>
                        ) : items.length > 0 ? (
                            <div className="space-y-2">
                                {items.map((item, idx) => (
                                    <div key={idx}
                                        className="flex items-start gap-3 bg-[#FAF7F2] rounded-xl p-3 border border-[#F0EBE3]">
                                        <div className="w-10 h-10 rounded-lg bg-white overflow-hidden shrink-0 border border-[#E8DDD0]">
                                            {item.productImageUrl
                                                ? <img src={getImageUrl(item.productImageUrl)} alt={item.productName} className="w-full h-full object-cover" />
                                                : <div className="w-full h-full flex items-center justify-center text-lg">🍽️</div>}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-semibold text-[#1C1C1E] leading-snug">{item.productName}</p>
                                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                                {item.saleType === 'BOX' ? (
                                                    <span className="text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 rounded-md px-1.5 py-0.5">
                                                        📦 Thùng ({item.unitsPerBox} {item.unit})
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] font-medium bg-[#F0EBE3] text-[#8E8878] rounded-md px-1.5 py-0.5">
                                                        {item.unit || 'cái'}
                                                    </span>
                                                )}
                                                {item.notes && <span className="text-[10px] text-[#8E8878] italic">· {item.notes}</span>}
                                            </div>
                                            {item.ingredientsUsed?.length > 0 && (
                                                <div className="mt-2 space-y-1">
                                                    {item.ingredientsUsed.map((ing, i) => (
                                                        <div key={i} className="flex items-center justify-between">
                                                            <div className="flex items-center gap-1.5">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-[#C9A84C] shrink-0" />
                                                                <span className="text-[10px] text-[#8E8878]">{ing.ingredientName}</span>
                                                            </div>
                                                            <span className="text-[10px] font-semibold text-[#C9A84C]">{ing.quantityUsed} {ing.unit}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <div className="shrink-0 min-w-[2rem] h-8 rounded-full bg-[#C9A84C]/10 flex items-center justify-center px-2">
                                            <span className="text-xs font-bold text-[#C9A84C]">x{item.quantity}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs text-[#C4B9A8] italic text-center py-6">Không có thông tin sản phẩm</p>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-5 py-4 border-t border-[#F0EBE3] flex-shrink-0 flex gap-2">
                    <button onClick={onClose} disabled={loading}
                        className="flex-1 py-3 rounded-2xl border border-[#E8DDD0] text-sm text-[#8E8878] hover:bg-[#F0EBE3] transition-colors font-medium">
                        Huỷ
                    </button>
                    <button onClick={() => onConfirm(order.id, deliveryInfo)} disabled={loading}
                        className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-[#C9A84C] text-white font-semibold text-sm hover:bg-[#B8943C] active:scale-[0.98] transition-all disabled:opacity-60">
                        {loading
                            ? <BtnSpinner size={14} colorClass="border-white/40 !border-t-white" />
                            : <><Truck size={15} /> Bắt đầu giao hàng</>}
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
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[90vh] flex flex-col">

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-[#F0EBE3] flex-shrink-0">
                    <div>
                        <p className="text-[10px] text-[#8E8878] uppercase tracking-wider">Xác nhận giao thành công</p>
                        <h2 className="font-bold text-[#1C1C1E] font-mono text-sm">{order?.orderCode}</h2>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-[#8E8878] hover:bg-[#F0EBE3]">
                        <X size={16} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                    <div className="bg-[#FAF7F2] rounded-xl p-3 space-y-1.5">
                        <div className="flex justify-between text-xs">
                            <span className="text-[#8E8878]">Khách hàng</span>
                            <span className="font-semibold text-[#1C1C1E] text-right max-w-[180px] truncate">{order?.customerName || '—'}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="text-[#8E8878]">Tổng tiền</span>
                            <span className="font-bold text-[#C9A84C]">{formatPrice(order?.finalAmount)}</span>
                        </div>
                    </div>

                    {/* Chứng từ */}
                    <div className="space-y-2">
                        <p className="text-xs font-semibold text-[#1C1C1E]">
                            Chứng từ nhận hàng <span className="text-[#8E8878] font-normal">(tuỳ chọn)</span>
                        </p>
                        {preview ? (
                            <div className="relative">
                                <img src={preview} alt="preview" className="w-full h-36 object-cover rounded-xl border border-[#E8DDD0]" />
                                <button onClick={() => { setFile(null); setPreview(null); }}
                                    className="absolute top-2 right-2 p-1 bg-black/50 rounded-full text-white hover:bg-black/70">
                                    <X size={12} />
                                </button>
                            </div>
                        ) : (
                            <button onClick={() => fileInputRef.current?.click()}
                                className="flex flex-col items-center gap-2 py-5 w-full rounded-xl border-2 border-dashed border-[#E8DDD0] text-[#8E8878] hover:border-[#C9A84C] hover:text-[#C9A84C] hover:bg-[#C9A84C]/5 transition-all">
                                <Camera size={22} />
                                <span className="text-xs font-medium">Chụp ảnh / Chọn ảnh</span>
                            </button>
                        )}
                        <input ref={fileInputRef} type="file" accept="image/png,image/jpg,image/jpeg"
                            capture="environment" className="hidden"
                            onChange={e => handleFile(e.target.files?.[0])} />
                    </div>

                    <p className="text-xs text-[#8E8878] bg-[#FAF7F2] rounded-xl px-3 py-2 border border-[#E8DDD0]">
                        Đơn sẽ chuyển sang <span className="font-semibold text-orange-600">Chờ thanh toán</span>.
                        {!file && ' Có thể tải chứng từ lên sau.'}
                    </p>
                </div>

                {/* Footer */}
                <div className="flex gap-2 px-5 pb-5 pt-3 border-t border-[#F0EBE3] flex-shrink-0">
                    <button onClick={onClose} disabled={loading}
                        className="flex-1 py-2.5 rounded-xl border border-[#E8DDD0] text-sm text-[#8E8878] hover:bg-[#F0EBE3] transition-colors font-medium">
                        Huỷ
                    </button>
                    <button onClick={() => onConfirm(file || null)} disabled={loading}
                        className="flex-1 py-2.5 rounded-xl bg-[#C9A84C] text-white text-sm font-semibold hover:bg-[#B8963E] transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
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

    const handleExportReport = async () => {
        if (!exportFrom || !exportTo) { toast('Chọn khoảng thời gian', 'error'); return; }
        setExporting(true);
        try {
            const res = await api.get('/api/warehouse/reports/driver', {
                params: { from: exportFrom, to: exportTo },
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

    const handleDeliverConfirm = async (file) => {
        if (!deliverTarget) return;
        setDeliverLoading(true);
        try {
            await warehouseApi.confirmDelivered(deliverTarget.id);
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
                        status: 'PENDING_PAYMENT',
                        ...(receiptUrl ? { receiptFileUrl: receiptUrl } : {}),
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
        <div className="flex flex-col h-full bg-[#FAF7F2]">

            {/* ── Header ── */}
            <div className="flex-shrink-0 px-4 sm:px-6 py-4 bg-white border-b border-[#F0EBE3]">
                <div className="flex items-center gap-2 mb-3">
                    <div className="flex-1 min-w-0">
                        <h1 className="text-lg sm:text-xl font-bold text-[#1C1C1E]">Đơn hàng</h1>
                        <p className="text-[10px] sm:text-xs text-[#8E8878]">{total} đơn</p>
                    </div>
                    <div className="relative flex-1 max-w-xs">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8878]" />
                        <input type="text" placeholder="Mã đơn, khách hàng, người tạo..."
                            value={searchInput} onChange={e => setSearchInput(e.target.value)}
                            className="border border-[#E8DDD0] rounded-xl pl-9 pr-4 py-2 text-sm bg-white focus:outline-none focus:border-[#C9A84C] w-full" />
                        {searchInput && (
                            <button onClick={() => setSearchInput('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8E8878] hover:text-[#1C1C1E]">
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
                        className="p-2 rounded-xl bg-[#F0EBE3] text-[#8E8878] hover:bg-[#E8DDD0] transition-colors shrink-0">
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <button onClick={() => setShowExportModal(true)}
                        title="Xuất báo cáo tài xế"
                        className="p-2 rounded-xl bg-[#C9A84C]/10 text-[#C9A84C] hover:bg-[#C9A84C]/20 transition-colors shrink-0">
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
                        <div className="w-8 h-8 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : orders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-[#8E8878] gap-2">
                        <Search size={32} strokeWidth={1} />
                        <p className="text-sm">Không có đơn hàng nào</p>
                    </div>
                ) : (
                    <>
                        {/* Desktop table */}
                        <div className="hidden md:block bg-white rounded-2xl border border-[#F0EBE3] overflow-hidden shadow-sm">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-[#FAF7F2] border-b border-[#F0EBE3]">
                                        <tr>
                                            {['Mã đơn','Khách hàng','Người tạo đơn','Tổng tiền','Trạng thái','Ngày tạo','Chứng từ','Hành động'].map(h => (
                                                <th key={h} className="text-left text-[10px] font-bold text-[#8E8878] uppercase tracking-wider px-4 py-3 whitespace-nowrap">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {orders.map(o => {
                                            const isDelivering     = o.status === 'DELIVERING';
                                            const isPendingPayment = o.status === 'PENDING_PAYMENT';
                                            const canUploadReceipt = isPendingPayment && !o.receiptFileUrl;
                                            return (
                                                <tr key={o.id} className="border-b border-[#F0EBE3] last:border-0 hover:bg-[#FAF7F2]/50 transition-colors">
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <span className="font-mono text-xs font-bold text-[#C9A84C]">{o.orderCode}</span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <p className="text-xs font-medium text-[#1C1C1E] truncate max-w-[140px]">{o.customerName || 'Khách lẻ'}</p>
                                                        {o.customerPhone && <p className="text-[10px] text-[#8E8878]">{o.customerPhone}</p>}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex flex-col gap-1 items-start">
                                                            <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-[#F0EBE3] text-[#8E8878] border-[#E8DDD0] whitespace-nowrap w-fit">
                                                                👤 {o.createdByName || '—'}
                                                            </span>
                                                            <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-sky-50 text-sky-700 border-sky-200 whitespace-nowrap w-fit">
                                                                🏭 {o.warehouseName || '—'}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <span className="text-xs font-bold text-[#1C1C1E]">{formatPrice(o.finalAmount)}</span>
                                                    </td>
                                                    <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <span className="text-xs text-[#8E8878]">{formatDate(o.createdAt)}</span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {o.receiptFileUrl ? (
                                                            <a href={getImageUrl(o.receiptFileUrl)} target="_blank" rel="noopener noreferrer"
                                                                onClick={e => e.stopPropagation()}
                                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap hover:bg-emerald-100">
                                                                📄 Xem
                                                            </a>
                                                        ) : canUploadReceipt ? (
                                                            <button onClick={e => { e.stopPropagation(); handleUploadReceipt(o.id); }}
                                                                disabled={uploadingId === o.id}
                                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-600 border border-amber-200 whitespace-nowrap hover:bg-amber-100 disabled:opacity-50">
                                                                {uploadingId === o.id ? <BtnSpinner size={9} /> : <><Paperclip size={9} /> Tải lên</>}
                                                            </button>
                                                        ) : (
                                                            <span className="text-[10px] text-[#C4B9A8]">—</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-1.5">
                                                            {o.status === 'PREPARING' && (
                                                                <button onClick={e => { e.stopPropagation(); openPrepareModal(o); }}
                                                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-purple-50 text-purple-600 border border-purple-200 hover:bg-purple-100 transition-colors text-[10px] font-semibold whitespace-nowrap">
                                                                    <Truck size={11} /> Bắt đầu giao hàng
                                                                </button>
                                                            )}
                                                            <button onClick={e => { e.stopPropagation(); handleInvoice(o.id, e); }}
                                                                disabled={!!invoiceLoadingId}
                                                                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border transition-all text-[10px] font-semibold whitespace-nowrap
                                                                    ${invoiceLoadingId === o.id
                                                                        ? 'bg-[#C9A84C]/15 text-[#C9A84C] border-[#C9A84C]/40 cursor-wait'
                                                                        : 'bg-[#C9A84C]/10 text-[#C9A84C] border-transparent hover:bg-[#C9A84C]/20'}`}>
                                                                {invoiceLoadingId === o.id
                                                                    ? <BtnSpinner size={10} colorClass="border-[#C9A84C] !border-t-transparent" />
                                                                    : <FileText size={11} />}
                                                                Phiếu đặt hàng
                                                            </button>
                                                            {isDelivering && (
                                                                <button onClick={e => { e.stopPropagation(); setDeliverTarget(o); }}
                                                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#C9A84C] text-white border border-[#C9A84C] hover:bg-[#B8963E] transition-colors text-[10px] font-semibold whitespace-nowrap">
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
                                    <div key={o.id} className="bg-white rounded-2xl border border-[#F0EBE3] p-4 space-y-3 shadow-sm">
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <p className="font-mono text-xs font-bold text-[#C9A84C]">{o.orderCode}</p>
                                                <p className="text-sm font-semibold text-[#1C1C1E] mt-0.5">{o.customerName || 'Khách lẻ'}</p>
                                                {o.customerPhone && <p className="text-[10px] text-[#8E8878]">{o.customerPhone}</p>}
                                            </div>
                                            <div className="text-right shrink-0">
                                                <p className="text-sm font-bold text-[#1C1C1E]">{formatPrice(o.finalAmount)}</p>
                                                <p className="text-[10px] text-[#8E8878] mt-0.5">{formatDate(o.createdAt)}</p>
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-[#F0EBE3]">
                                            <StatusBadge status={o.status} />
                                            <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-[#F0EBE3] text-[#8E8878] border-[#E8DDD0]">
                                                👤 {o.orderedByName || o.createdByName || '—'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {o.receiptFileUrl ? (
                                                <a href={getImageUrl(o.receiptFileUrl)} target="_blank" rel="noopener noreferrer"
                                                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                    📄 Xem chứng từ
                                                </a>
                                            ) : canUploadReceipt ? (
                                                <button onClick={() => handleUploadReceipt(o.id)} disabled={uploadingId === o.id}
                                                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-50 text-amber-600 border border-amber-200 disabled:opacity-50">
                                                    {uploadingId === o.id ? <BtnSpinner size={10} /> : <><Paperclip size={11} /> Tải chứng từ</>}
                                                </button>
                                            ) : null}
                                            {o.status === 'PREPARING' && (
                                                <button onClick={() => openPrepareModal(o)}
                                                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-50 text-purple-600 border border-purple-200 hover:bg-purple-100 transition-colors">
                                                    <Truck size={12} /> Bắt đầu giao hàng
                                                </button>
                                            )}
                                            <button onClick={e => { e.stopPropagation(); handleInvoice(o.id, e); }}
                                                disabled={!!invoiceLoadingId}
                                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#C9A84C]/10 text-[#C9A84C] border border-[#C9A84C]/20">
                                                {invoiceLoadingId === o.id
                                                    ? <BtnSpinner size={10} colorClass="border-[#C9A84C] !border-t-transparent" />
                                                    : <><FileText size={12} /> Phiếu đặt hàng</>}
                                            </button>
                                            {isDelivering && (
                                                <button onClick={() => setDeliverTarget(o)}
                                                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#C9A84C] text-white hover:bg-[#B8963E] transition-colors">
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
                            className="p-2 rounded-xl bg-white border border-[#E8DDD0] text-[#8E8878] hover:border-[#C9A84C] disabled:opacity-40 transition-colors">
                            <ChevronLeft size={15} />
                        </button>
                        <span className="text-sm text-[#8E8878] px-3">{page + 1} / {totalPages}</span>
                        <button onClick={() => fetchOrders(page + 1)} disabled={page >= totalPages - 1 || loading}
                            className="p-2 rounded-xl bg-white border border-[#E8DDD0] text-[#8E8878] hover:border-[#C9A84C] disabled:opacity-40 transition-colors">
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
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-[#F0EBE3]">
                            <div className="flex items-center gap-2">
                                <Download size={16} className="text-[#C9A84C]" />
                                <h3 className="font-bold text-[#1C1C1E] text-sm">Xuất báo cáo tài xế</h3>
                            </div>
                            <button onClick={() => setShowExportModal(false)}
                                className="p-1.5 rounded-lg hover:bg-[#F0EBE3] text-[#8E8878]">
                                <X size={16} />
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <p className="text-xs text-[#8E8878]">
                                Xuất báo cáo km, số phiếu và số đơn giao của từng tài xế trong khoảng thời gian.
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-semibold text-[#5C5C5C] mb-1">
                                        <Calendar size={10} className="inline mr-1" />Từ ngày
                                    </label>
                                    <input type="date" value={exportFrom}
                                        onChange={e => setExportFrom(e.target.value)}
                                        className="w-full h-9 px-3 rounded-xl border border-[#E8DDD0] text-sm focus:outline-none focus:border-[#C9A84C]" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-semibold text-[#5C5C5C] mb-1">
                                        <Calendar size={10} className="inline mr-1" />Đến ngày
                                    </label>
                                    <input type="date" value={exportTo}
                                        onChange={e => setExportTo(e.target.value)}
                                        className="w-full h-9 px-3 rounded-xl border border-[#E8DDD0] text-sm focus:outline-none focus:border-[#C9A84C]" />
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2 px-5 pb-5">
                            <button onClick={() => setShowExportModal(false)}
                                className="flex-1 py-2.5 rounded-xl border border-[#E8DDD0] text-sm text-[#5C5C5C] hover:bg-[#F0EBE3]">
                                Hủy
                            </button>
                            <button onClick={handleExportReport}
                                disabled={exporting || !exportFrom || !exportTo}
                                className="flex-1 py-2.5 rounded-xl bg-[#C9A84C] text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#b8963e] disabled:opacity-40">
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
                    loading={preparingLoading}
                />
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