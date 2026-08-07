// src/pages/hr/HrSalaryApprovalPage.jsx
// Danh sách phiếu lương đã/chưa xử lý (dành cho HR xem)
import { useLang } from '../../context/LangContext';
import { useState, useEffect, useCallback } from 'react';
import { Receipt, CheckCircle, XCircle, Clock } from 'lucide-react';
import { hrSalaryApi } from '../../api/hrApi';
import { useToast } from '../../components/common/Toast';
import useMinLoading from '../../hooks/useMinLoading.js';
import { TableSkeleton } from '../../components/ui/Skeleton.jsx';
import { PageHeader, EmptyState, formatDateTime } from '../../components/ui';
import Pagination from '../../components/ui/Pagination';
import Modal from '../../components/ui/Modal';

const fmtCur = (v) => v == null ? '—' : new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(v);

export default function HrSalaryApprovalPage() {
  const { t } = useLang();
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useMinLoading();
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [detail, setDetail] = useState(null);

  const STATUS_MAP = {
    PENDING:  { label: t('status', 'pending'), cls: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/28',      icon: Clock },
    APPROVED: { label: t('status', 'approved'),  cls: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/28', icon: CheckCircle },
    REJECTED: { label: t('status', 'rejected_short'),   cls: 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-300 border-red-200 dark:border-red-500/28',             icon: XCircle },
  };

  const load = useCallback(async (p = 0) => {
    setLoading(true);
    try {
      const res = await hrSalaryApi.list({
        status: statusFilter || undefined,
        page: p, size: 20,
        sort: 'createdAt,desc'
      });
      setItems(res.content || []);
      setTotalPages(res.totalPages || 0);
      setPage(p);
    } catch { toast(t('common','error_retry'), 'error'); }
    finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { load(0); }, [load]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5">
      <PageHeader icon={Receipt} title={t('hr','salary_slips_processed')}
        subtitle={t('hr','salary_request_list')} />

      <div className="flex gap-2">
        {[['',t('batch','status_filter_all')], ['PENDING',t('status','pending')], ['APPROVED',t('status','approved')], ['REJECTED',t('status','rejected_short')]].map(([val, label]) => (
          <button key={val} onClick={() => { setStatusFilter(val); setPage(0); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all
              ${statusFilter === val
                ? 'bg-gold text-white border-gold'
                : 'bg-surface text-ink-2 border-line hover:border-gold'}`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? <TableSkeleton cols={5} rows={10} /> : items.length === 0 ? (
        <EmptyState icon={Receipt} title={t('common','no_data')} />
      ) : (
        <div className="bg-surface rounded-2xl border border-line overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="bg-canvas border-b border-line">
                {[t('employee','employee'),t('employee','department'),'Lương trước thuế',t('common','status'),'Ngày tạo',''].map(h => (
                  <th key={h} className="text-left px-3 py-3 text-xs font-semibold text-muted uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map(s => {
                const st = STATUS_MAP[s.status] || STATUS_MAP.PENDING;
                const Icon = st.icon;
                return (
                  <tr key={s.id} className="border-b border-canvas hover:bg-canvas/50 cursor-pointer"
                    onClick={() => setDetail(s)}>
                    <td className="px-3 py-3 font-medium text-ink">{s.userFullName}</td>
                    <td className="px-3 py-3 text-xs text-ink-2">{s.department}</td>
                    <td className="px-3 py-3 text-xs">{fmtCur(s.baseSalary)}</td>
                    <td className="px-3 py-3">
                      <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg border w-fit ${st.cls}`}>
                        <Icon size={11} /> {st.label}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs text-muted">{formatDateTime(s.createdAt)}</td>
                    <td className="px-3 py-3 text-xs text-gold font-medium">Chi tiết ↗</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && <Pagination current={page} total={totalPages} onChange={p => load(p)} />}

      {/* Detail modal */}
      {detail && (
        <Modal open={!!detail} onClose={() => setDetail(null)} title="Chi tiết phiếu lương" size="md">
          <SalaryDetail s={detail} statusMap={STATUS_MAP} t={t} />
        </Modal>
      )}
    </div>
  );
}

function SalaryDetail({ s, statusMap, t }) {
  const st = statusMap[s.status] || statusMap.PENDING;
  const Icon = st.icon;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border ${st.cls}`}>
          <Icon size={12} /> {st.label}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        {[
          [t('employee','employee'), s.userFullName],
          [t('employee','department'), s.department],
          ['Chức vụ', s.position || '—'],
          ['Lương trước thuế', fmtCur(s.baseSalary)],
          ['HR lập', s.createdByName || '—'],
          ['Owner duyệt', s.approvedByName || '—'],
        ].map(([label, value]) => (
          <div key={label}>
            <p className="text-xs font-semibold text-muted mb-0.5">{label}</p>
            <p className="text-ink">{value}</p>
          </div>
        ))}
      </div>
      {s.rejectReason && (
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/28 rounded-xl p-3">
          <p className="text-xs font-semibold text-red-600 dark:text-red-300 mb-1">LÝ DO TỪ CHỐI</p>
          <p className="text-sm text-red-700 dark:text-red-300">{s.rejectReason}</p>
        </div>
      )}
    </div>
  );
}
