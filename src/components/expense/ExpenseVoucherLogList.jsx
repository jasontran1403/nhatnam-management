// src/components/expense/ExpenseVoucherLogList.jsx
//
// Nhật ký thao tác của một phiếu chi. Hiển thị AI + VAI TRÒ ĐANG ACTIVE lúc thao tác —
// đây là chỗ tra cứu "phiếu này ai chuyển về chờ duyệt, dưới vai OWNER hay ADMIN".

import { useState, useEffect } from 'react';
import { History, CheckCircle, XCircle, RotateCcw, Pencil } from 'lucide-react';
import { adminExpenseApi } from '../../api/adminApi';

const ACTION_CFG = {
  APPROVED:       { label: 'Duyệt phiếu',        icon: CheckCircle, cls: 'text-green-600 dark:text-green-300' },
  REJECTED:       { label: 'Từ chối phiếu',      icon: XCircle,     cls: 'text-red-600 dark:text-red-300' },
  REOPENED:       { label: 'Mở lại → Chờ duyệt', icon: RotateCcw,   cls: 'text-amber-600 dark:text-amber-300' },
  ITEMS_UPDATED:  { label: 'Sửa khoản chi',      icon: Pencil,      cls: 'text-gold' },
  REASON_UPDATED: { label: 'Sửa lý do chi',      icon: Pencil,      cls: 'text-gold' },
};

const ROLE_LABELS = {
  OWNER: 'Chủ doanh nghiệp',
  ADMIN: 'Quản trị',
  SUPERADMIN: 'Quản trị hệ thống',
  SUPER_ACCOUNTANT: 'Kế toán trưởng',
  ACCOUNTANT: 'Kế toán',
  SUPER_WAREHOUSE: 'Trưởng kho',
  SUPER_FACTORY_WORKER: 'Trưởng xưởng',
};

function fmt(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())} ${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/**
 * @param {number} voucherId
 * @param {*} refreshKey  đổi giá trị này để bắt tải lại (VD truyền voucher.updatedAt)
 */
export default function ExpenseVoucherLogList({ voucherId, refreshKey }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!voucherId) return;
    let alive = true;
    setLoading(true); setFailed(false);
    adminExpenseApi.logs(voucherId)
      .then(res => { if (alive) setLogs(Array.isArray(res) ? res : (res?.data || [])); })
      .catch(() => { if (alive) setFailed(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [voucherId, refreshKey]);

  return (
    <div>
      <p className="text-xs font-semibold text-muted uppercase mb-2 flex items-center gap-1.5">
        <History size={12} /> Nhật ký thao tác
      </p>

      {loading ? (
        <p className="text-xs text-muted">Đang tải nhật ký...</p>
      ) : failed ? (
        <p className="text-xs text-muted">Không tải được nhật ký</p>
      ) : logs.length === 0 ? (
        <p className="text-xs text-muted">Chưa có thao tác nào được ghi nhận</p>
      ) : (
        <div className="space-y-1.5">
          {logs.map(l => {
            const cfg = ACTION_CFG[l.action] || { label: l.action, icon: History, cls: 'text-muted' };
            const Icon = cfg.icon;
            return (
              <div key={l.id} className="flex items-start gap-2 text-xs">
                <Icon size={12} className={`${cfg.cls} mt-0.5 flex-shrink-0`} />
                <div className="min-w-0">
                  <span className={`font-semibold ${cfg.cls}`}>{cfg.label}</span>
                  <span className="text-ink-2">
                    {' — '}{l.actorName || '—'}
                    {l.actorRole && (
                      <span className="text-muted">
                        {' '}({ROLE_LABELS[l.actorRole] || l.actorRole})
                      </span>
                    )}
                    {' · '}{fmt(l.createdAt)}
                  </span>
                  {l.note && <p className="text-muted mt-0.5 break-words">{l.note}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}