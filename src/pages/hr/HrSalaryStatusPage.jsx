// src/pages/hr/HrSalaryStatusPage.jsx
// HR xem trạng thái các phiếu lương đã gửi
import { useLang } from '../../context/LangContext';
import { useState, useEffect, useCallback } from 'react';
import { DollarSign, Clock, Check, X } from 'lucide-react';
import { hrSalaryApi } from '../../api/hrApi';
import {
  PageHeader, SectionCard, Table, Thead, Th, Td, Tr,
  EmptyState, LoadingSpinner, formatCurrency, formatDateTime,
} from '../../components/ui';
import { Badge } from '../../components/ui/Badge';
import Pagination from '../../components/ui/Pagination';
import { useToast } from '../../components/common/Toast';

export default function HrSalaryStatusPage() {
  const { t } = useLang();
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');

  const STATUS_CONFIG = {
    PENDING: { label: t('status', 'pending'), variant: 'warning', icon: Clock },
    APPROVED: { label: t('status', 'approved'), variant: 'success', icon: Check },
    REJECTED: { label: t('status', 'rejected_short'), variant: 'danger', icon: X },
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await hrSalaryApi.list({ status: statusFilter || undefined, page, size: 20 });
      setRows(data.content ?? data);
      setTotalPages(data.totalPages ?? 1);
    } catch { toast(t('common', 'error_retry'), 'error'); }
    finally { setLoading(false); }
  }, [page, statusFilter]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <PageHeader icon={DollarSign} title={t('hr', 'salary_slips_sent')}
        subtitle={t('batch', 'review_status')} />

      {/* Filter */}
      <div className="flex gap-2">
        {['', 'PENDING', 'APPROVED', 'REJECTED'].map(s => (
          <button key={s} onClick={() => { setStatusFilter(s); setPage(0); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors
              ${statusFilter === s ? 'bg-[#1C1C1E] text-white' : 'bg-white border border-black/10 text-[#8E8878] hover:bg-[#FAF7F2]'}`}>
            {s === '' ? t('batch', 'status_filter_all') : STATUS_CONFIG[s]?.label}
          </button>
        ))}
      </div>

      <SectionCard>
        {loading ? <LoadingSpinner /> : rows.length === 0 ? (
          <EmptyState icon={DollarSign} title={t('common', 'no_data')} />
        ) : (
          <Table>
            <Thead>
              <Tr>
                <Th>Nhân viên</Th>
                <Th>Bộ phận</Th>
                <Th right>Lương CB</Th>
                <Th right>Bonus</Th>
                <Th>Trạng thái</Th>
                <Th>Lý do từ chối</Th>
                <Th>Duyệt bởi</Th>
                <Th>Ngày tạo</Th>
              </Tr>
            </Thead>
            <tbody>
              {rows.map(s => {
                const cfg = STATUS_CONFIG[s.status] || {};
                return (
                  <Tr key={s.id}>
                    <Td>
                      <div className="font-medium">{s.userFullName}</div>
                      <div className="text-xs text-[#8E8878]">{s.position || '—'}</div>
                    </Td>
                    <Td>{s.department || '—'}</Td>
                    <Td right>{s.baseSalary ? formatCurrency(s.baseSalary) : '—'}</Td>
                    <Td right>{s.bonus ? formatCurrency(s.bonus) : '—'}</Td>
                    <Td>
                      <Badge variant={cfg.variant || 'default'}>{cfg.label || s.status}</Badge>
                    </Td>
                    <Td>
                      {s.rejectReason
                        ? <span className="text-xs text-red-600">{s.rejectReason}</span>
                        : '—'}
                    </Td>
                    <Td>{s.approvedByName || '—'}</Td>
                    <Td>{formatDateTime(s.createdAt)}</Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        )}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-black/5">
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </div>
        )}
      </SectionCard>
    </div>
  );
}
