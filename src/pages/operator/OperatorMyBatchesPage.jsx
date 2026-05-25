// src/pages/operator/OperatorMyBatchesPage.jsx
import { useState, useEffect } from 'react';
import { CardSkeleton, Sk } from '../../components/ui/Skeleton.jsx';
import useMinLoading from '../../hooks/useMinLoading.js';
import { operatorApi } from '../../api/operatorApi';
import { useToast } from '../../components/common/Toast';
import { ClipboardList, Clock, CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react';

const STATUS_CFG = {
  PENDING:             { label: 'Chờ duyệt',       bg: 'bg-amber-50 text-amber-700 border-amber-200',   icon: Clock },
  PARTIALLY_APPROVED:  { label: 'Duyệt 1 phần',    bg: 'bg-blue-50 text-blue-700 border-blue-200',      icon: AlertCircle },
  APPROVED:            { label: 'Đã duyệt',         bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle },
  REJECTED:            { label: 'Bị từ chối',       bg: 'bg-red-50 text-red-700 border-red-200',         icon: XCircle },
};

function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function OperatorMyBatchesPage() {
  const toast = useToast();
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useMinLoading();

  const fetch = () => {
    setLoading(true);
    operatorApi.getMyBatches()
      .then(r => setBatches(r.data?.data || []))
      .catch(() => toast('Lỗi tải danh sách phiếu', 'error'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { fetch(); }, []);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 px-6 py-4 bg-white border-b border-[#F0EBE3]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#1C1C1E]" style={{ fontFamily: 'var(--font-display)' }}>Phiếu của tôi</h1>
            <p className="text-xs text-[#8E8878]">{batches.length} phiếu đã gửi</p>
          </div>
          <button onClick={fetch} className="p-2 rounded-xl text-[#8E8878] hover:bg-[#FAF7F2] hover:text-[#1C1C1E] transition-all">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-6 h-6 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : batches.length === 0 ? (
          <div className="text-center py-16 text-[#8E8878]">
            <ClipboardList size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Chưa có phiếu nào</p>
          </div>
        ) : (
          <div className="space-y-3">
            {batches.map(b => {
              const cfg = STATUS_CFG[b.status] || STATUS_CFG.PENDING;
              const Icon = cfg.icon;
              return (
                <div key={b.id} className="bg-white rounded-2xl border border-[#F0EBE3] p-5 hover:border-[#C9A84C]/40 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-[#1C1C1E]">{b.batchCode}</span>
                        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.bg}`}>
                          <Icon size={9} /> {cfg.label}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${b.type === 'CREATE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                          {b.type === 'CREATE' ? 'Tạo mới' : 'Cập nhật'}
                        </span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#8E8878]">
                        <span>{b.itemCount} sản phẩm</span>
                        <span>Gửi lúc {formatDate(b.createdAt)}</span>
                        {b.reviewedAt && <span>Duyệt lúc {formatDate(b.reviewedAt)} bởi {b.reviewedByName}</span>}
                      </div>
                      {b.note && <p className="mt-1.5 text-xs text-[#5C5C5C] italic">Ghi chú: {b.note}</p>}
                      {b.reviewNote && (
                        <p className={`mt-1.5 text-xs px-3 py-1.5 rounded-lg ${b.status === 'REJECTED' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
                          Phản hồi Admin: {b.reviewNote}
                        </p>
                      )}
                    </div>
                    {/* Mini progress */}
                    {(b.approvedCount > 0 || b.pendingCount > 0 || b.rejectedCount > 0) && (
                      <div className="text-right text-[10px] text-[#8E8878] flex-shrink-0">
                        <div className="text-emerald-600">✓ {b.approvedCount || 0}</div>
                        <div className="text-amber-600">⏳ {b.pendingCount || 0}</div>
                        {b.rejectedCount > 0 && <div className="text-red-500">✗ {b.rejectedCount}</div>}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
