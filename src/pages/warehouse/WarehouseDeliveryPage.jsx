// src/pages/warehouse/WarehouseDeliveryPage.jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { warehouseApi, getImageUrl, downloadBlob } from '../../api/services';
import { accountantApi } from '../../api/services';
import { useToast } from '../../components/common/Toast';
import OrderDetailModal from '../../components/seller/OrderDetailModal';
import DateRangePicker from '../../components/ui/DateRangePicker';
import { formatPrice } from '../../utils/formatPrice';
import useMinLoading from '../../hooks/useMinLoading.js';
import {
    Search, RefreshCw, ChevronLeft, ChevronRight,
    Clock, CheckCircle, XCircle, Truck, Package, CreditCard,
    Camera, FileText, X, CheckSquare, Paperclip,
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
    PENDING: { label: 'Chờ xử lý', bg: 'bg-amber-50   text-amber-600   border-amber-200', Icon: Clock },
    CONFIRMED: { label: 'Đã xác nhận', bg: 'bg-sky-50     text-sky-600     border-sky-200', Icon: CheckCircle },
    PREPARING: { label: 'Đang chuẩn bị', bg: 'bg-blue-50    text-blue-600    border-blue-200', Icon: Package },
    READY: { label: 'Sẵn sàng giao', bg: 'bg-indigo-50  text-indigo-600  border-indigo-200', Icon: CheckCircle },
    DELIVERING: { label: 'Đang giao', bg: 'bg-purple-50  text-purple-600  border-purple-200', Icon: Truck },
    PENDING_PAYMENT: { label: 'Chờ thanh toán', bg: 'bg-orange-50  text-orange-600  border-orange-200', Icon: CreditCard },
    COMPLETED: { label: 'Hoàn thành', bg: 'bg-emerald-50 text-emerald-600 border-emerald-200', Icon: CheckCircle },
    CANCELLED: { label: 'Đã huỷ', bg: 'bg-red-50     text-red-500     border-red-200', Icon: XCircle },
};

function StatusBadge({ status }) {
    const cfg = STATUS_MAP[status] || STATUS_MAP.PENDING;
    const { Icon } = cfg;
    return (
        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${cfg.bg}`}>
            <Icon size={9} /> {cfg.label}
        </span>
    );
}

// ── Confirm deliver modal ─────────────────────────────────────────────────────
function ConfirmDeliverModal({ order, onClose, onConfirm, loading }) {
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const fileInputRef = useRef(null);
    const cameraInputRef = useRef(null);

    const handleFile = (f) => {
        if (!f) return;
        const allowed = ['image/png', 'image/jpg', 'image/jpeg'];
        if (!allowed.includes(f.type)) {
            alert('Chỉ chấp nhận file ảnh PNG, JPG, JPEG');
            return;
        }
        setFile(f);
        const reader = new FileReader();
        reader.onload = (e) => setPreview(e.target.result);
        reader.readAsDataURL(f);
    };

    const handleConfirm = () => onConfirm(file || null);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm">

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-[#F0EBE3]">
                    <div>
                        <p className="text-[10px] text-[#8E8878] uppercase tracking-wider">Xác nhận đã giao</p>
                        <h2 className="font-bold text-[#1C1C1E] font-mono text-sm">{order?.orderCode}</h2>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-[#8E8878] hover:bg-[#F0EBE3]">
                        <X size={16} />
                    </button>
                </div>

                {/* Body */}
                <div className="px-5 py-4 space-y-4">
                    {/* Order info */}
                    <div className="bg-[#FAF7F2] rounded-xl p-3 space-y-1.5">
                        <div className="flex justify-between text-xs">
                            <span className="text-[#8E8878]">Khách hàng</span>
                            <span className="font-semibold text-[#1C1C1E] text-right max-w-[180px] truncate">
                                {order?.customerName || '—'}
                            </span>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="text-[#8E8878]">Tổng tiền</span>
                            <span className="font-bold text-[#C9A84C]">{formatPrice(order?.finalAmount)}</span>
                        </div>
                    </div>

                    {/* Chứng từ — optional */}
                    <div className="space-y-2">
                        <p className="text-xs font-semibold text-[#1C1C1E]">
                            Chứng từ nhận hàng <span className="text-[#8E8878] font-normal">(tuỳ chọn)</span>
                        </p>

                        {preview ? (
                            <div className="relative">
                                <img src={preview} alt="preview"
                                    className="w-full h-36 object-cover rounded-xl border border-[#E8DDD0]" />
                                <button
                                    onClick={() => { setFile(null); setPreview(null); }}
                                    className="absolute top-2 right-2 p-1 bg-black/50 rounded-full text-white hover:bg-black/70">
                                    <X size={12} />
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-2">
                                {/* Chụp ảnh từ camera */}
                                <button
                                    onClick={() => cameraInputRef.current?.click()}
                                    className="flex flex-col items-center gap-2 py-4 rounded-xl border-2 border-dashed border-[#E8DDD0] text-[#8E8878] hover:border-[#C9A84C] hover:text-[#C9A84C] hover:bg-[#C9A84C]/5 transition-all">
                                    <Camera size={20} />
                                    <span className="text-xs font-medium">Chụp ảnh</span>
                                </button>

                                {/* Chọn file */}
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="flex flex-col items-center gap-2 py-4 rounded-xl border-2 border-dashed border-[#E8DDD0] text-[#8E8878] hover:border-[#C9A84C] hover:text-[#C9A84C] hover:bg-[#C9A84C]/5 transition-all">
                                    <Paperclip size={20} />
                                    <span className="text-xs font-medium">Chọn file</span>
                                </button>
                            </div>
                        )}

                        {/* Hidden inputs */}
                        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment"
                            className="hidden" onChange={e => handleFile(e.target.files?.[0])} />
                        <input ref={fileInputRef} type="file" accept="image/png,image/jpg,image/jpeg"
                            className="hidden" onChange={e => handleFile(e.target.files?.[0])} />
                    </div>

                    <p className="text-xs text-[#8E8878] bg-[#FAF7F2] rounded-xl px-3 py-2 border border-[#E8DDD0]">
                        Đơn sẽ chuyển sang <span className="font-semibold text-orange-600">Chờ thanh toán</span>.
                        {!file && ' Có thể tải chứng từ lên sau.'}
                    </p>
                </div>

                {/* Footer */}
                <div className="flex gap-2 px-5 pb-5">
                    <button onClick={onClose} disabled={loading}
                        className="flex-1 py-2.5 rounded-xl border border-[#E8DDD0] text-sm text-[#8E8878] hover:bg-[#F0EBE3] transition-colors font-medium">
                        Huỷ
                    </button>
                    <button onClick={handleConfirm} disabled={loading}
                        className="flex-1 py-2.5 rounded-xl bg-[#C9A84C] text-white text-sm font-semibold hover:bg-[#B8963E] transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                        {loading
                            ? <BtnSpinner size={14} colorClass="border-white/40 !border-t-white" />
                            : <><CheckSquare size={14} /> Xác nhận giao</>}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function WarehouseDeliveryPage() {
    const toast = useToast();

    const [orders, setOrders] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(0);
    const [pageSize] = useState(50);
    const [loading, setLoading] = useMinLoading();
    const [search, setSearch] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [dateRange, setDateRange] = useState({ from: null, to: null });
    const [statusFilter, setStatusFilter] = useState('ALL');

    const [selectedOrder, setSelectedOrder] = useState(null);
    const [detailLoading, setDetailLoading] = useState(null);

    const [deliverTarget, setDeliverTarget] = useState(null);
    const [deliverLoading, setDeliverLoading] = useState(false);

    // Upload receipt riêng (không qua modal deliver)
    const receiptInputRef = useRef(null);
    const [uploadingId, setUploadingId] = useState(null);

    const totalPages = Math.ceil(total / pageSize);

    // ── Fetch ─────────────────────────────────────────────────────────────────
    const fetchOrders = useCallback(async (p = 0) => {
        setLoading(true);
        try {
            const params = {};

            // Nếu có chọn ngày thì gửi lên, backend tự normalize đầu/cuối ngày
            // Không chọn → backend mặc định hôm nay
            if (dateRange.from) params.from = new Date(dateRange.from).setHours(12, 0, 0, 0); // giữa ngày để backend tự lấy đúng LocalDate
            if (dateRange.to) params.to = new Date(dateRange.to).setHours(12, 0, 0, 0);

            const res = await warehouseApi.getDeliveryOrders(params);
            let content = res.data?.data || [];

            // Filter theo status tab
            if (statusFilter !== 'ALL') {
                content = content.filter(o => o.status === statusFilter);
            }

            // Search client-side — tìm được cả đơn ở trang xa
            if (search.trim()) {
                const q = search.toLowerCase();
                content = content.filter(o =>
                    o.orderCode?.toLowerCase().includes(q) ||
                    o.customerName?.toLowerCase().includes(q) ||
                    o.orderedByName?.toLowerCase().includes(q) ||
                    o.createdByName?.toLowerCase().includes(q) ||
                    o.customerPhone?.includes(q)
                );
            }

            setTotal(content.length);

            // Paginate client-side
            const start = p * pageSize;
            setOrders(content.slice(start, start + pageSize));
            setPage(p);

        } catch {
            toast('Không thể tải danh sách đơn hàng', 'error');
        } finally {
            setLoading(false);
        }
    }, [dateRange, search, statusFilter, pageSize]);

    useEffect(() => { fetchOrders(0); }, [fetchOrders]);

    // Debounce search
    useEffect(() => {
        const t = setTimeout(() => setSearch(searchInput), 500);
        return () => clearTimeout(t);
    }, [searchInput]);

    // ── Confirm deliver ───────────────────────────────────────────────────────
    const handleDeliverConfirm = async (file) => {
        if (!deliverTarget) return;
        setDeliverLoading(true);
        try {
            // 1. Xác nhận đã giao: DELIVERING → PENDING_PAYMENT
            await warehouseApi.confirmDelivered(deliverTarget.id);

            let receiptUrl = null;

            // 2. Nếu có file chứng từ thì upload
            if (file) {
                const fd = new FormData();
                fd.append('file', file);
                try {
                    const uploadRes = await warehouseApi.uploadReceiptFile(deliverTarget.id, fd);
                    receiptUrl = uploadRes.data?.data?.receiptFileUrl || null;
                } catch (uploadErr) {
                    console.warn('Upload receipt failed:', uploadErr);
                    toast('Đã xác nhận giao hàng nhưng không tải được chứng từ', 'warning');
                }
            }

            // 3. Cập nhật UI — cả status lẫn receiptFileUrl
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

    // ── Upload receipt riêng ──────────────────────────────────────────────────
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
            setOrders(prev => prev.map(o =>
                o.id === uploadingId ? { ...o, receiptFileUrl: url } : o
            ));
            toast('Đã tải lên chứng từ', 'success');
        } catch {
            toast('Lỗi khi tải chứng từ', 'error');
        } finally {
            setUploadingId(null);
            e.target.value = '';
        }
    };

    // ── Open detail ───────────────────────────────────────────────────────────
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

    // ── Filter tabs ───────────────────────────────────────────────────────────
    const FILTER_TABS = [
        { value: 'ALL', label: 'Tất cả' },
        { value: 'PREPARING', label: 'Chuẩn bị' },
        { value: 'DELIVERING', label: 'Đang giao' },
        { value: 'PENDING_PAYMENT', label: 'Chờ thanh toán' },
        { value: 'COMPLETED', label: 'Hoàn thành' },
        { value: 'CANCELLED', label: 'Đã huỷ' },
    ];

    return (
        <div className="flex flex-col h-full bg-[#FAF7F2]">

            {/* ── Header ── */}
            <div className="flex-shrink-0 px-4 sm:px-6 py-4 bg-white border-b border-[#F0EBE3]">
                <div className="flex items-center gap-2 mb-3">
                    <div className="flex-1 min-w-0">
                        <h1 className="text-lg sm:text-xl font-bold text-[#1C1C1E]">Đơn hàng</h1>
                        <p className="text-[10px] sm:text-xs text-[#8E8878]">{total} đơn</p>
                    </div>

                    {/* Search */}
                    <div className="relative flex-1 max-w-xs">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8878]" />
                        <input
                            type="text"
                            placeholder="Tìm mã đơn, khách hàng, người tạo..."
                            value={searchInput}
                            onChange={e => setSearchInput(e.target.value)}
                            className="border border-[#E8DDD0] rounded-xl pl-9 pr-4 py-2 text-sm bg-white focus:outline-none focus:border-[#C9A84C] w-full"
                        />
                        {searchInput && (
                            <button onClick={() => setSearchInput('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8E8878] hover:text-[#1C1C1E]">
                                <X size={13} />
                            </button>
                        )}
                    </div>

                    {/* Date range */}
                    <div className="hidden sm:flex items-center gap-1.5">
                        <DateRangePicker
                            from={dateRange.from} to={dateRange.to}
                            onChange={r => { setDateRange(r); setPage(0); }}
                            placeholder="Khoảng ngày"
                        />
                    </div>

                    {/* Refresh */}
                    <button onClick={() => fetchOrders(0)}
                        className="p-2 rounded-xl bg-[#F0EBE3] text-[#8E8878] hover:bg-[#E8DDD0] transition-colors shrink-0">
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    </button>
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
                                            {['Mã đơn', 'Khách hàng', 'Người tạo đơn', 'Tổng tiền', 'Trạng thái', 'Ngày tạo', 'Chứng từ', 'Hành động'].map(h => (
                                                <th key={h} className="text-left text-[10px] font-bold text-[#8E8878] uppercase tracking-wider px-4 py-3 whitespace-nowrap">
                                                    {h}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {orders.map(o => {
                                            const isDelivering = o.status === 'DELIVERING';
                                            const isDone = o.status === 'COMPLETED' || o.status === 'CANCELLED';
                                            const isPendingPayment = o.status === 'PENDING_PAYMENT';
                                            const canUploadReceipt = isPendingPayment && !o.receiptFileUrl;

                                            return (
                                                <tr key={o.id}
                                                    className="border-b border-[#F0EBE3] last:border-0 hover:bg-[#FAF7F2]/50 transition-colors">

                                                    {/* Mã đơn */}
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <span className="font-mono text-xs font-bold text-[#C9A84C]">{o.orderCode}</span>
                                                    </td>

                                                    {/* Khách hàng */}
                                                    <td className="px-4 py-3">
                                                        <p className="text-xs font-medium text-[#1C1C1E] truncate max-w-[140px]">
                                                            {o.customerName || 'Khách lẻ'}
                                                        </p>
                                                        {o.customerPhone && (
                                                            <p className="text-[10px] text-[#8E8878]">{o.customerPhone}</p>
                                                        )}
                                                    </td>

                                                    {/* Người tạo đơn */}
                                                    <td className="px-4 py-3">
                                                        <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-[#F0EBE3] text-[#8E8878] border-[#E8DDD0] whitespace-nowrap">
                                                            👤 {o.orderedByName || o.createdByName || '—'}
                                                        </span>
                                                    </td>

                                                    {/* Tổng tiền */}
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <span className="text-xs font-bold text-[#1C1C1E]">
                                                            {formatPrice(o.finalAmount)}
                                                        </span>
                                                    </td>

                                                    {/* Trạng thái */}
                                                    <td className="px-4 py-3">
                                                        <StatusBadge status={o.status} />
                                                    </td>

                                                    {/* Ngày tạo */}
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <span className="text-xs text-[#8E8878]">{formatDate(o.createdAt)}</span>
                                                    </td>

                                                    {/* Chứng từ */}
                                                    <td className="px-4 py-3">
                                                        {o.receiptFileUrl ? (
                                                            <a href={getImageUrl(o.receiptFileUrl)} target="_blank" rel="noopener noreferrer"
                                                                onClick={e => e.stopPropagation()}
                                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap hover:bg-emerald-100">
                                                                📄 Xem
                                                            </a>
                                                        ) : canUploadReceipt ? (
                                                            <button
                                                                onClick={e => { e.stopPropagation(); handleUploadReceipt(o.id); }}
                                                                disabled={uploadingId === o.id}
                                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-600 border border-amber-200 whitespace-nowrap hover:bg-amber-100 disabled:opacity-50">
                                                                {uploadingId === o.id
                                                                    ? <BtnSpinner size={9} />
                                                                    : <><Paperclip size={9} /> Tải lên</>}
                                                            </button>
                                                        ) : (
                                                            <span className="text-[10px] text-[#C4B9A8]">—</span>
                                                        )}
                                                    </td>

                                                    {/* Hành động */}
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-1.5">
                                                            {/* Xác nhận giao — chỉ khi DELIVERING */}
                                                            {isDelivering && (
                                                                <button
                                                                    onClick={e => { e.stopPropagation(); setDeliverTarget(o); }}
                                                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#C9A84C] text-white border border-[#C9A84C] hover:bg-[#B8963E] transition-colors text-[10px] font-semibold whitespace-nowrap">
                                                                    <CheckSquare size={11} /> Xác nhận giao
                                                                </button>
                                                            )}

                                                            {/* Xem chi tiết */}
                                                            <button
                                                                onClick={e => { e.stopPropagation(); openDetail(o); }}
                                                                disabled={detailLoading === o.id}
                                                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-sky-50 text-sky-600 border border-sky-200 hover:bg-sky-100 transition-colors text-[10px] font-semibold whitespace-nowrap disabled:opacity-50">
                                                                {detailLoading === o.id
                                                                    ? <BtnSpinner size={10} colorClass="border-sky-400 !border-t-sky-600" />
                                                                    : <><FileText size={11} /> Chi tiết</>}
                                                            </button>
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
                                const isDelivering = o.status === 'DELIVERING';
                                const isPendingPayment = o.status === 'PENDING_PAYMENT';
                                const canUploadReceipt = isPendingPayment && !o.receiptFileUrl;

                                return (
                                    <div key={o.id}
                                        className="bg-white rounded-2xl border border-[#F0EBE3] p-4 space-y-3 shadow-sm">

                                        {/* Top row */}
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <p className="font-mono text-xs font-bold text-[#C9A84C]">{o.orderCode}</p>
                                                <p className="text-sm font-semibold text-[#1C1C1E] mt-0.5">
                                                    {o.customerName || 'Khách lẻ'}
                                                </p>
                                                {o.customerPhone && (
                                                    <p className="text-[10px] text-[#8E8878]">{o.customerPhone}</p>
                                                )}
                                            </div>
                                            <div className="text-right shrink-0">
                                                <p className="text-sm font-bold text-[#1C1C1E]">{formatPrice(o.finalAmount)}</p>
                                                <p className="text-[10px] text-[#8E8878] mt-0.5">{formatDate(o.createdAt)}</p>
                                            </div>
                                        </div>

                                        {/* Badges */}
                                        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-[#F0EBE3]">
                                            <StatusBadge status={o.status} />
                                            <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-[#F0EBE3] text-[#8E8878] border-[#E8DDD0]">
                                                👤 {o.orderedByName || o.createdByName || '—'}
                                            </span>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {/* Chứng từ */}
                                            {o.receiptFileUrl ? (
                                                <a href={getImageUrl(o.receiptFileUrl)} target="_blank" rel="noopener noreferrer"
                                                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                    📄 Xem chứng từ
                                                </a>
                                            ) : canUploadReceipt ? (
                                                <button
                                                    onClick={() => handleUploadReceipt(o.id)}
                                                    disabled={uploadingId === o.id}
                                                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-50 text-amber-600 border border-amber-200 disabled:opacity-50">
                                                    {uploadingId === o.id ? <BtnSpinner size={10} /> : <><Paperclip size={11} /> Tải chứng từ</>}
                                                </button>
                                            ) : null}

                                            {/* Xác nhận giao */}
                                            {isDelivering && (
                                                <button
                                                    onClick={() => setDeliverTarget(o)}
                                                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#C9A84C] text-white hover:bg-[#B8963E] transition-colors">
                                                    <CheckSquare size={12} /> Xác nhận giao
                                                </button>
                                            )}

                                            {/* Xem chi tiết */}
                                            <button
                                                onClick={() => openDetail(o)}
                                                disabled={detailLoading === o.id}
                                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-sky-50 text-sky-600 border border-sky-200 hover:bg-sky-100 disabled:opacity-50">
                                                {detailLoading === o.id
                                                    ? <BtnSpinner size={10} colorClass="border-sky-400 !border-t-sky-600" />
                                                    : <><FileText size={12} /> Chi tiết</>}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}

                {/* Pagination */}
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

            {/* Hidden receipt input (upload riêng) */}
            <input ref={receiptInputRef} type="file" accept="image/png,image/jpg,image/jpeg"
                className="hidden" onChange={handleReceiptFileChange} />

            {/* Modals */}
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