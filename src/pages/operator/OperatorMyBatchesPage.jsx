// src/pages/operator/OperatorMyBatchesPage.jsx
import { useLang } from '../../context/LangContext';
import { useState, useEffect } from 'react';
import { CardSkeleton, Sk } from '../../components/ui/Skeleton.jsx';
import useMinLoading from '../../hooks/useMinLoading.js';
import { operatorApi } from '../../api/operatorApi';
import { useToast } from '../../components/common/Toast';
import { ClipboardList, Clock, CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react';



function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function OperatorMyBatchesPage() {
  const { t } = useLang();
  const toast = useToast();
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useMinLoading();

  const STATUS_CFG = {
    PENDING: { label: t('status', 'pending'), bg: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/28', icon: Clock },
    PARTIALLY_APPROVED: { label: t('batch', 'partial_approved'), bg: 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/28', icon: AlertCircle },
    APPROVED: { label: t('status', 'approved'), bg: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/28', icon: CheckCircle },
    REJECTED: { label: t('status', 'rejected'), bg: 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/28', icon: XCircle },
  };

  const fetch = () => {
    setLoading(true);
    operatorApi.getMyBatches()
      .then(r => setBatches(r.data?.data || []))
      .catch(() => toast(t('common', 'error_retry'), 'error'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { fetch(); }, []);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 px-6 py-4 bg-surface border-b border-line-soft">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-ink" style={{ fontFamily: 'var(--font-display)' }}>Phiếu của tôi</h1>
            <p className="text-xs text-muted">{t('operator','batches_sent').replace('{n}', batches.length)}</p>
          </div>
          <button onClick={fetch} className="p-2 rounded-xl text-muted hover:bg-canvas hover:text-ink transition-all">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
          </div>
        ) : batches.length === 0 ? (
          <div className="text-center py-16 text-muted">
            <ClipboardList size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Chưa có phiếu nào</p>
          </div>
        ) : (
          <div className="space-y-3">
            {batches.map(b => {
              const cfg = STATUS_CFG[b.status] || STATUS_CFG.PENDING;
              const Icon = cfg.icon;
              return (
                <div key={b.id} className="bg-surface rounded-2xl border border-line-soft p-5 hover:border-gold/40 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-ink">{b.batchCode}</span>
                        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.bg}`}>
                          <Icon size={9} /> {cfg.label}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${b.type === 'CREATE' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/28' : 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/28'}`}>
                          {b.type === 'CREATE' ? t('common', 'create_new') : t('common', 'update')}
                        </span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                        <span>{b.itemCount} sản phẩm</span>
                        <span>Gửi lúc {formatDate(b.createdAt)}</span>
                        {b.reviewedAt && <span>Duyệt lúc {formatDate(b.reviewedAt)} bởi {b.reviewedByName}</span>}
                      </div>
                      {b.note && <p className="mt-1.5 text-xs text-ink-2 italic">Ghi chú: {b.note}</p>}
                      {b.reviewNote && (
                        <p className={`mt-1.5 text-xs px-3 py-1.5 rounded-lg ${b.status === 'REJECTED' ? 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300' : 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300'}`}>
                          Phản hồi Admin: {b.reviewNote}
                        </p>
                      )}
                    </div>
                    {/* Mini progress */}
                    {(b.approvedCount > 0 || b.pendingCount > 0 || b.rejectedCount > 0) && (
                      <div className="text-right text-[10px] text-muted flex-shrink-0">
                        <div className="text-emerald-600 dark:text-emerald-300">✓ {b.approvedCount || 0}</div>
                        <div className="text-amber-600 dark:text-amber-300">⏳ {b.pendingCount || 0}</div>
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
