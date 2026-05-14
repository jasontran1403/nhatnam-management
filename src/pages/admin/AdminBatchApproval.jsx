// src/pages/admin/AdminBatchApproval.jsx
import { useState, useEffect, useCallback } from 'react';
import { adminBatchApi } from '../../api/operatorApi';
import { useToast } from '../../components/common/Toast';
import {
  CheckCircle, XCircle, Clock, AlertCircle, ChevronDown, ChevronUp,
  RefreshCw, X, Check, CheckCheck, FileText
} from 'lucide-react';

const STATUS_CFG = {
  PENDING:            { label: 'Chờ duyệt',    bg: 'bg-amber-50 text-amber-700 border-amber-200',       icon: Clock },
  PARTIALLY_APPROVED: { label: 'Duyệt 1 phần', bg: 'bg-blue-50 text-blue-700 border-blue-200',          icon: AlertCircle },
  APPROVED:           { label: 'Đã duyệt',     bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle },
  REJECTED:           { label: 'Từ chối',      bg: 'bg-red-50 text-red-700 border-red-200',             icon: XCircle },
};
const ITEM_STATUS_CFG = {
  PENDING:  { label: 'Chờ',    bg: 'bg-amber-50 text-amber-700' },
  APPROVED: { label: 'Duyệt',  bg: 'bg-emerald-50 text-emerald-700' },
  REJECTED: { label: 'Từ chối',bg: 'bg-red-50 text-red-700' },
};

function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function formatPrice(n) { return new Intl.NumberFormat('vi-VN').format(n || 0) + ' đ'; }

export default function AdminBatchApproval() {
  const toast = useToast();
  const [batches, setBatches] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null); // selected batch with items
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [reviewNote, setReviewNote] = useState('');
  const [acting, setActing] = useState(false);
  const SIZE = 20;

  const fetchBatches = useCallback(async () => {
    setLoading(true);
    try {
      const params = { size: SIZE, page, ...(statusFilter !== 'ALL' ? { status: statusFilter } : {}) };
      const res = await adminBatchApi.list(params);
      const d = res?.content || res?.data?.data || res;
      setBatches(Array.isArray(d) ? d : d?.content || []);
      setTotal(d?.totalItems || 0);
    } catch (e) { toast('Lỗi tải phiếu', 'error'); }
    finally { setLoading(false); }
  }, [page, statusFilter]);

  useEffect(() => { fetchBatches(); }, [fetchBatches]);

  const openDetail = async (b) => {
    setDetailLoading(true);
    setDetail({ ...b, items: [] });
    setSelectedItems(new Set());
    setReviewNote('');
    try {
      const res = await adminBatchApi.getDetail(b.id);
      const d = res?.data?.data || res?.data || res;
      setDetail(d);
    } catch { toast('Lỗi tải chi tiết', 'error'); }
    finally { setDetailLoading(false); }
  };

  const handleApproveAll = async () => {
    if (!detail) return;
    setActing(true);
    try {
      await adminBatchApi.approveBatch(detail.id, reviewNote || undefined);
      toast('Đã duyệt toàn bộ phiếu', 'success');
      setDetail(null);
      fetchBatches();
    } catch (e) { toast(e?.response?.data?.message || 'Lỗi duyệt phiếu', 'error'); }
    finally { setActing(false); }
  };

  const handleApproveSelected = async () => {
    if (!detail || selectedItems.size === 0) return;
    setActing(true);
    try {
      await adminBatchApi.approveItems(detail.id, [...selectedItems], reviewNote || undefined);
      toast(`Đã duyệt ${selectedItems.size} sản phẩm`, 'success');
      // Reload detail
      const res = await adminBatchApi.getDetail(detail.id);
      setDetail(res?.data?.data || res?.data || res);
      setSelectedItems(new Set());
      fetchBatches();
    } catch (e) { toast(e?.response?.data?.message || 'Lỗi duyệt', 'error'); }
    finally { setActing(false); }
  };

  const handleRejectBatch = async () => {
    if (!detail) return;
    if (!reviewNote.trim()) return toast('Nhập lý do từ chối', 'error');
    setActing(true);
    try {
      await adminBatchApi.rejectBatch(detail.id, reviewNote);
      toast('Đã từ chối phiếu', 'success');
      setDetail(null);
      fetchBatches();
    } catch (e) { toast(e?.response?.data?.message || 'Lỗi từ chối', 'error'); }
    finally { setActing(false); }
  };

  const toggleItemSelect = (id) => {
    setSelectedItems(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };
  const selectAllPending = () => {
    const pendingIds = (detail?.items || []).filter(i => i.status === 'PENDING').map(i => i.id);
    setSelectedItems(new Set(pendingIds));
  };

  const FILTER_TABS = ['PENDING', 'PARTIALLY_APPROVED', 'APPROVED', 'REJECTED', 'ALL'];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 bg-white border-b border-[#F0EBE3]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-[#1C1C1E]" style={{ fontFamily: 'var(--font-display)' }}>Duyệt phiếu sản phẩm</h1>
            <p className="text-xs text-[#8E8878]">{total} phiếu</p>
          </div>
          <button onClick={fetchBatches} className="p-2 rounded-xl text-[#8E8878] hover:bg-[#FAF7F2] transition-all">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
        {/* Filter tabs */}
        <div className="flex gap-1 mt-3 overflow-x-auto pb-1">
          {FILTER_TABS.map(s => {
            const cfg = STATUS_CFG[s] || { label: 'Tất cả', bg: '' };
            return (
              <button key={s} onClick={() => { setStatusFilter(s); setPage(0); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex-shrink-0
                  ${statusFilter === s ? 'bg-[#C9A84C] text-white' : 'border border-[#E8DDD0] text-[#5C5C5C] hover:bg-[#FAF7F2]'}`}>
                {s === 'ALL' ? 'Tất cả' : cfg.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-6 h-6 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : batches.length === 0 ? (
          <div className="text-center py-16 text-[#8E8878]">
            <FileText size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Không có phiếu nào</p>
          </div>
        ) : (
          <div className="space-y-3">
            {batches.map(b => {
              const cfg = STATUS_CFG[b.status] || STATUS_CFG.PENDING;
              const BIcon = cfg.icon;
              return (
                <div key={b.id}
                  onClick={() => openDetail(b)}
                  className="bg-white rounded-2xl border border-[#F0EBE3] p-5 cursor-pointer hover:border-[#C9A84C]/50 hover:shadow-md transition-all">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-[#1C1C1E]">{b.batchCode}</span>
                        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.bg}`}>
                          <BIcon size={9} />{cfg.label}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium
                          ${b.type === 'CREATE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                          {b.type === 'CREATE' ? '+ Tạo mới' : '✎ Cập nhật'}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-[#8E8878]">
                        <span>Operator: <span className="text-[#5C5C5C]">{b.createdByName}</span></span>
                        <span>{b.itemCount} sản phẩm</span>
                        <span>Gửi: {formatDate(b.createdAt)}</span>
                        {b.reviewedByName && <span>Duyệt bởi: {b.reviewedByName}</span>}
                      </div>
                      {b.note && <p className="mt-1 text-xs text-[#8E8878] italic">"{b.note}"</p>}
                    </div>
                    <div className="text-right text-[10px] flex-shrink-0 space-y-0.5">
                      {b.approvedCount > 0 && <div className="text-emerald-600 font-medium">✓ {b.approvedCount} duyệt</div>}
                      {b.pendingCount > 0 && <div className="text-amber-600">⏳ {b.pendingCount} chờ</div>}
                      {b.rejectedCount > 0 && <div className="text-red-500">✗ {b.rejectedCount} từ chối</div>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail Panel */}
      {detail && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-stretch justify-end">
          <div className="w-full max-w-2xl bg-white flex flex-col h-full shadow-2xl">
            {/* Panel header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#F0EBE3] flex-shrink-0">
              <div>
                <h2 className="text-base font-bold text-[#1C1C1E]">{detail.batchCode}</h2>
                <p className="text-xs text-[#8E8878]">
                  {detail.type === 'CREATE' ? 'Phiếu tạo mới' : 'Phiếu cập nhật'} — {detail.createdByName}
                </p>
              </div>
              <button onClick={() => setDetail(null)} className="p-2 rounded-xl text-[#8E8878] hover:bg-[#FAF7F2]">
                <X size={18} />
              </button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {detailLoading ? (
                <div className="flex items-center justify-center h-40">
                  <div className="w-6 h-6 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <>
                  {/* Select all pending */}
                  {(detail.items || []).some(i => i.status === 'PENDING') && (
                    <button onClick={selectAllPending}
                      className="text-xs text-[#C9A84C] hover:underline flex items-center gap-1">
                      <CheckCheck size={12} /> Chọn tất cả chờ duyệt
                    </button>
                  )}
                  {(detail.items || []).map(item => {
                    const iCfg = ITEM_STATUS_CFG[item.status] || ITEM_STATUS_CFG.PENDING;
                    const isPending = item.status === 'PENDING';
                    const isSelected = selectedItems.has(item.id);
                    return (
                      <div key={item.id}
                        onClick={() => isPending && toggleItemSelect(item.id)}
                        className={`rounded-xl border p-4 transition-all ${isPending ? 'cursor-pointer' : ''}
                          ${isSelected ? 'border-[#C9A84C] bg-[#C9A84C]/5' : 'border-[#F0EBE3] bg-white hover:border-[#E8DDD0]'}`}>
                        <div className="flex items-start gap-3">
                          {isPending && (
                            <div className={`mt-0.5 w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center
                              ${isSelected ? 'bg-[#C9A84C] border-[#C9A84C]' : 'border-[#D3CFC8]'}`}>
                              {isSelected && <Check size={10} className="text-white" />}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-[#1C1C1E]">{item.productName}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${iCfg.bg}`}>{iCfg.label}</span>
                            </div>
                            <div className="mt-1 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-0.5 text-xs text-[#8E8878]">
                              {item.categoryName && <span>Danh mục: {item.categoryName}</span>}
                              {item.unit && <span>Đơn vị: {item.unit}</span>}
                              {item.basePrice != null && <span>Giá gốc: {formatPrice(item.basePrice)}</span>}
                              {item.vatRate != null && <span>VAT: {item.vatRate}% ({item.vatMode === 'INCLUSIVE' ? 'trong giá' : 'ngoài giá'})</span>}
                              {item.maxDiscountRate != null && item.maxDiscountRate > 0 && (
                                <span className="text-orange-600">CK tối đa: {item.maxDiscountRate}%</span>
                              )}
                              {item.existingProductId && <span className="text-blue-600">Cập nhật SP #{item.existingProductId}</span>}
                            </div>
                            {/* Tiers preview */}
                            {item.tiersJson && (() => {
                              try {
                                const tiers = JSON.parse(item.tiersJson);
                                if (!tiers?.length) return null;
                                return (
                                  <div className="mt-2 flex flex-wrap gap-1">
                                    {tiers.map((t, ti) => (
                                      <span key={ti} className="text-[10px] px-2 py-0.5 bg-[#FAF7F2] border border-[#F0EBE3] rounded-full text-[#5C5C5C]">
                                        {t.tierName}: {formatPrice(t.price)}
                                      </span>
                                    ))}
                                  </div>
                                );
                              } catch { return null; }
                            })()}
                            {item.reviewNote && (
                              <p className="mt-1.5 text-[10px] text-red-600 italic">Lý do: {item.reviewNote}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>

            {/* Actions */}
            {detail.status !== 'APPROVED' && detail.status !== 'REJECTED' && (
              <div className="flex-shrink-0 px-5 pb-5 border-t border-[#F0EBE3] pt-4">
                <textarea
                  value={reviewNote}
                  onChange={e => setReviewNote(e.target.value)}
                  placeholder="Ghi chú duyệt / lý do từ chối (tuỳ chọn)..."
                  rows={2}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-[#E8DDD0] focus:outline-none focus:border-[#C9A84C] resize-none mb-3"
                />
                <div className="flex gap-2">
                  {selectedItems.size > 0 && (
                    <button onClick={handleApproveSelected} disabled={acting}
                      className="flex-1 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 transition-colors">
                      <Check size={14} />
                      {acting ? 'Đang xử lý...' : `Duyệt ${selectedItems.size} mục`}
                    </button>
                  )}
                  <button onClick={handleApproveAll} disabled={acting}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 transition-colors">
                    <CheckCheck size={14} />
                    {acting ? 'Đang xử lý...' : 'Duyệt tất cả'}
                  </button>
                  <button onClick={handleRejectBatch} disabled={acting}
                    className="flex-1 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 transition-colors">
                    <XCircle size={14} />
                    {acting ? '...' : 'Từ chối'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
