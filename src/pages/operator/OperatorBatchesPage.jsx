// src/pages/operator/OperatorBatchesPage.jsx
import { useLang } from '../../context/LangContext';
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
  PENDING:              { label: t('status', 'pending'),        bg: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-200 dark:border-amber-500/28',  icon: Clock },
  PARTIALLY_APPROVED:   { label: t('batch', 'partial_approved'),     bg: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-300 border-blue-200 dark:border-blue-500/28',    icon: AlertCircle },
  APPROVED:             { label: t('status', 'approved'),          bg: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/28', icon: CheckCircle },
  REJECTED:             { label: t('status', 'rejected'),        bg: 'bg-red-50 dark:bg-red-500/10 text-red-500 border-red-200 dark:border-red-500/28',       icon: XCircle },
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
  const { t } = useLang();
  const toast = useToast();
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useMinLoading();

  const load = async () => {
    try {
      setLoading(true);
      const res = await operatorApi.getMyBatches();
      setBatches(res.data?.data || []);
    } catch {
      toast(t('common','error_retry'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-ink">Phiếu của tôi</h1>
          <p className="text-sm text-muted mt-1">Theo dõi trạng thái các phiếu đã gửi.</p>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-canvas border border-line rounded-xl text-sm text-ink hover:bg-surface-2 transition-colors">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Làm mới
        </button>
      </div>

      {batches.length === 0 && !loading ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <ClipboardList size={40} className="text-faint" strokeWidth={1} />
          <p className="text-muted">Chưa có phiếu nào</p>
        </div>
      ) : (
        <div className="space-y-3">
          {batches.map(b => (
            <div key={b.id} className="bg-surface rounded-2xl border border-line-soft p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-ink">{b.batchCode}</span>
                    <StatusBadge status={b.status} />
                    <span className="text-[10px] bg-surface-2 text-muted rounded-full px-2 py-0.5">
                      {b.type === 'CREATE' ? 'Thêm mới': t('common','update')}
                    </span>
                  </div>
                  <p className="text-xs text-muted mt-1">
                    {b.itemCount} sản phẩm · Gửi lúc {formatDate(b.createdAt)}
                  </p>
                  {b.note && (
                    <p className="text-xs text-ink-2 mt-1 italic">"{b.note}"</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  {b.reviewedAt && (
                    <p className="text-[10px] text-muted">Duyệt: {formatDate(b.reviewedAt)}</p>
                  )}
                  {b.reviewedByName && (
                    <p className="text-[10px] text-muted">Bởi: {b.reviewedByName}</p>
                  )}
                </div>
              </div>

              {/* Review note */}
              {b.reviewNote && (
                <div className="mt-3 px-3 py-2 bg-canvas rounded-xl border border-line-soft">
                  <p className="text-[11px] font-medium text-muted mb-0.5">Ghi chú từ Admin:</p>
                  <p className="text-xs text-ink">{b.reviewNote}</p>
                </div>
              )}

              {/* Item counters */}
              <div className="flex gap-3 mt-3">
                <span className="text-[10px] text-muted">
                  ✅ Đã duyệt: {b.approvedCount || 0}
                </span>
                <span className="text-[10px] text-muted">
                  ⏳ Chờ duyệt: {b.pendingCount || 0}
                </span>
                <span className="text-[10px] text-muted">
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
