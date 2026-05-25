// src/pages/operator/OperatorBatchesPage.jsx
import { useState, useEffect } from 'react';
import { CardSkeleton, Sk } from '../../components/ui/Skeleton.jsx';
import useMinLoading from '../../hooks/useMinLoading.js';
import { operatorApi } from '../../api/services';
import { useToast } from '../../components/common/Toast';
import { RefreshCw, ClipboardList, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const STATUS_MAP = {
  PENDING:              { label: 'Chờ duyệt',        bg: 'bg-amber-50 text-amber-600 border-amber-200',  icon: Clock },
  PARTIALLY_APPROVED:   { label: 'Duyệt 1 phần',     bg: 'bg-blue-50 text-blue-600 border-blue-200',    icon: AlertCircle },
  APPROVED:             { label: 'Đã duyệt',          bg: 'bg-emerald-50 text-emerald-600 border-emerald-200', icon: CheckCircle },
  REJECTED:             { label: 'Bị từ chối',        bg: 'bg-red-50 text-red-500 border-red-200',       icon: XCircle },
};

function StatusBadge({ status }) {
  const cfg = STATUS_MAP[status] || STATUS_MAP.PENDING;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.bg}`}>
      <Icon size={9} /> {cfg.label}
    </span>
  );
}

export default function OperatorBatchesPage() {
  const toast = useToast();
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useMinLoading();

  const load = async () => {
    try {
      setLoading(true);
      const res = await operatorApi.getMyBatches();
      setBatches(res.data?.data || []);
    } catch {
      toast('Lỗi tải danh sách phiếu', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#1C1C1E]">Phiếu của tôi</h1>
          <p className="text-sm text-[#8E8878] mt-1">Theo dõi trạng thái các phiếu đã gửi.</p>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-[#FAF7F2] border border-[#E8DDD0] rounded-xl text-sm text-[#1C1C1E] hover:bg-[#F0EBE3] transition-colors">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Làm mới
        </button>
      </div>

      {batches.length === 0 && !loading ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <ClipboardList size={40} className="text-[#C4B9A8]" strokeWidth={1} />
          <p className="text-[#8E8878]">Chưa có phiếu nào</p>
        </div>
      ) : (
        <div className="space-y-3">
          {batches.map(b => (
            <div key={b.id} className="bg-white rounded-2xl border border-[#F0EBE3] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-[#1C1C1E]">{b.batchCode}</span>
                    <StatusBadge status={b.status} />
                    <span className="text-[10px] bg-[#F0EBE3] text-[#8E8878] rounded-full px-2 py-0.5">
                      {b.type === 'CREATE' ? 'Thêm mới' : 'Cập nhật'}
                    </span>
                  </div>
                  <p className="text-xs text-[#8E8878] mt-1">
                    {b.itemCount} sản phẩm · Gửi lúc {formatDate(b.createdAt)}
                  </p>
                  {b.note && (
                    <p className="text-xs text-[#5E5A52] mt-1 italic">"{b.note}"</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  {b.reviewedAt && (
                    <p className="text-[10px] text-[#8E8878]">Duyệt: {formatDate(b.reviewedAt)}</p>
                  )}
                  {b.reviewedByName && (
                    <p className="text-[10px] text-[#8E8878]">Bởi: {b.reviewedByName}</p>
                  )}
                </div>
              </div>

              {/* Review note */}
              {b.reviewNote && (
                <div className="mt-3 px-3 py-2 bg-[#FAF7F2] rounded-xl border border-[#F0EBE3]">
                  <p className="text-[11px] font-medium text-[#8E8878] mb-0.5">Ghi chú từ Admin:</p>
                  <p className="text-xs text-[#1C1C1E]">{b.reviewNote}</p>
                </div>
              )}

              {/* Item counters */}
              <div className="flex gap-3 mt-3">
                <span className="text-[10px] text-[#8E8878]">
                  ✅ Đã duyệt: {b.approvedCount || 0}
                </span>
                <span className="text-[10px] text-[#8E8878]">
                  ⏳ Chờ duyệt: {b.pendingCount || 0}
                </span>
                <span className="text-[10px] text-[#8E8878]">
                  ❌ Từ chối: {b.rejectedCount || 0}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
