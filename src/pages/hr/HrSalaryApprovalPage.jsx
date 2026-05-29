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

const STATUS_MAP = {
  PENDING:  { label: t('status', 'pending'), cls: 'bg-amber-50 text-amber-700 border-amber-200',      icon: Clock },
  APPROVED: { label: t('status', 'approved'),  cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle },
  REJECTED: { label: t('status', 'rejected_short'),   cls: 'bg-red-50 text-red-600 border-red-200',             icon: XCircle },
};

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
      <PageHeader icon={Receipt} title=t('hr','salary_slips_processed')
        subtitle=t('hr','salary_request_list') />

      <div className="flex gap-2">
        {[['',t('batch','status_filter_all')], ['PENDING',t('status','pending')], ['APPROVED',t('status','approved')], ['REJECTED',t('status','rejected_short')]].map(([val, label]) => (
          <button key={val} onClick={() => { setStatusFilter(val); setPage(0); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all
              ${statusFilter === val
                ? 'bg-[#C9A84C] text-white border-[#C9A84C]'
                : 'bg-white text-[#5C4E3D] border-[#E8DDD0] hover:border-[#C9A84C]'}`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? <TableSkeleton cols={6} rows={10} /> : items.length === 0 ? (
        <EmptyState icon={Receipt} title=t('common','no_data') />
      ) : (
        <div className="bg-white rounded-2xl border border-[#E8DDD0] overflow-x-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead>
              <tr className="bg-[#FAF7F2] border-b border-[#E8DDD0]">
                {[t('employee','employee'),t('employee','department'),'Lương CB','Bonus','Phụ cấp',t('common','status'),'Ngày tạo',''].map(h => (
                  <th key={h} className="text-left px-3 py-3 text-xs font-semibold text-[#8E8878] uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map(s => {
                const st = STATUS_MAP[s.status] || STATUS_MAP.PENDING;
                const Icon = st.icon;
                return (
                  <tr key={s.id} className="border-b border-[#FAF7F2] hover:bg-[#FAF7F2]/50 cursor-pointer"
                    onClick={() => setDetail(s)}>
                    <td className="px-3 py-3 font-medium text-[#1C1C1E]">{s.userFullName}</td>
                    <td className="px-3 py-3 text-xs text-[#5C4E3D]">{s.department}</td>
                    <td className="px-3 py-3 text-xs">{fmtCur(s.baseSalary)}</td>
                    <td className="px-3 py-3 text-xs">{fmtCur(s.bonus)}</td>
                    <td className="px-3 py-3 text-xs">{fmtCur((s.mealAllowance||0)+(s.transportAllowance||0))}</td>
                    <td className="px-3 py-3">
                      <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg border w-fit ${st.cls}`}>
                        <Icon size={11} /> {st.label}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs text-[#8E8878]">{formatDateTime(s.createdAt)}</td>
                    <td className="px-3 py-3 text-xs text-[#C9A84C] font-medium">Chi tiết ↗</td>
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
          <SalaryDetail s={detail} />
        </Modal>
      )}
    </div>
  );
}

function SalaryDetail({ s }) {
  const st = STATUS_MAP[s.status] || STATUS_MAP.PENDING;
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
          ['Lương cơ bản', fmtCur(s.baseSalary)],
          ['Tỷ lệ BHXH', s.socialInsuranceRate + '%'],
          ['Mức lương đóng BHXH', fmtCur(s.socialInsuranceSalary)],
          ['Bonus', fmtCur(s.bonus)],
          ['Phụ cấp cơm', fmtCur(s.mealAllowance)],
          ['Phụ cấp xăng', fmtCur(s.transportAllowance)],
          ['HR lập', s.createdByName || '—'],
          ['Owner duyệt', s.approvedByName || '—'],
        ].map(([label, value]) => (
          <div key={label}>
            <p className="text-xs font-semibold text-[#8E8878] mb-0.5">{label}</p>
            <p className="text-[#1C1C1E]">{value}</p>
          </div>
        ))}
      </div>
      {s.rejectReason && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3">
          <p className="text-xs font-semibold text-red-600 mb-1">LÝ DO TỪ CHỐI</p>
          <p className="text-sm text-red-700">{s.rejectReason}</p>
        </div>
      )}
    </div>
  );
}

const fmtCur = (v) => v == null ? '—' : new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(v);
