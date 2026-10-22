/*
 * BONUS SUMMARY PAGE — Tổng hợp thưởng 12 tháng (10/2026)
 *
 * Group theo phòng: KD → SX → KT → Kho → TX.
 * Trong mỗi phòng: sort theo chức vụ.
 * Click "Chi tiết" → qua page Biến động chi tiết (có filter dept).
 */

import { useEffect, useState, useRef } from 'react';
import { PageHeader, SectionCard, LoadingSpinner, PrimaryButton } from '../../components/ui';
import { BackButton } from '../../components/common/SubPageNav';
import { factoryPayrollApi } from '../../api/factoryPayrollApi';
import { useToast } from '../../components/common/Toast';
import { TrendingUp, Lock, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const fmtVnd = (v) => (v == null || v === 0 ? '—' : Number(v).toLocaleString('vi-VN') + 'đ');
const monthLabel = (m, y) => `${String(m).padStart(2, '0')}/${y}`;
const ymKey = (m, y) => `${y}-${String(m).padStart(2, '0')}`;

export default function BonusSummaryPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef(null);
  const currentCellRef = useRef(null);
  const toast = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    factoryPayrollApi.getBonusSummary()
      .then(d => setData(d))
      .catch(e => toast(e?.response?.data?.message || 'Lỗi load tổng hợp thưởng', 'error'))
      .finally(() => setLoading(false));
  }, [toast]);

  useEffect(() => {
    if (loading || !data) return;
    const cell = currentCellRef.current;
    const container = scrollRef.current;
    if (cell && container) {
      container.scrollLeft = Math.max(0, cell.offsetLeft + cell.offsetWidth - container.clientWidth);
    }
  }, [loading, data]);

  const months = data?.months || [];
  const groups = data?.groups || [];
  const grandTotals = data?.grandTotalsByMonth || {};
  const lastIdx = months.length - 1;

  return (
    <div className="p-5 space-y-4">
      <BackButton fallback="/owner/attendance" />
      <PageHeader
        icon={TrendingUp}
        title="Tổng hợp thưởng"
        subtitle="12 tháng gần nhất · tổng tiền thưởng mỗi NV, group theo phòng → chức vụ" />

      <SectionCard>
        {loading && <div className="p-10 flex justify-center"><LoadingSpinner /></div>}

        {!loading && data && (
          <div className="overflow-auto" ref={scrollRef}>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-canvas sticky top-0 z-10">
                  <th className="text-left px-3 py-2 border-b border-hairline font-bold text-ink
                                 min-w-[240px] sticky left-0 bg-canvas z-20">
                    Nhân viên
                  </th>
                  {months.map((mo, i) => (
                    <th key={ymKey(mo.month, mo.year)}
                        ref={i === lastIdx ? currentCellRef : null}
                        className={`text-right px-3 py-2 border-b border-hairline font-bold min-w-[140px]
                                    ${mo.published ? 'text-ink' : 'text-muted'}
                                    ${i === lastIdx ? 'bg-gold/10' : ''}`}>
                      <div className="text-[12px]">{monthLabel(mo.month, mo.year)}</div>
                      {!mo.published && (
                        <div className="text-[10px] font-normal text-muted mt-0.5 inline-flex items-center gap-1">
                          <Lock size={9} /> chưa tính
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {groups.map(g => (
                  <GroupSection key={g.department}
                                group={g}
                                months={months}
                                lastIdx={lastIdx}
                                onDetail={() => navigate(`/owner/bonus-trend?dept=${g.department}`)} />
                ))}

                {/* Grand total toàn công ty */}
                <tr className="bg-gold/10 font-bold border-t-2 border-gold">
                  <td className="px-3 py-3 sticky left-0 bg-gold/10 text-ink">
                    TỔNG CỘNG TOÀN CÔNG TY
                  </td>
                  {months.map((mo, i) => {
                    const v = grandTotals[ymKey(mo.month, mo.year)];
                    return (
                      <td key={ymKey(mo.month, mo.year)}
                          className={`text-right px-3 py-3 tabular-nums text-ink
                                      ${i === lastIdx ? 'bg-gold/20' : ''}`}>
                        {v > 0 ? fmtVnd(v) : '—'}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function GroupSection({ group, months, lastIdx, onDetail }) {
  const users = group.users || [];
  const totals = group.totalsByMonth || {};
  return (
    <>
      {/* Header row: tên phòng + nút chi tiết */}
      <tr className="bg-canvas-2 dark:bg-canvas-2 border-t-2 border-hairline-2">
        <td colSpan={months.length + 1}
            className="px-3 py-2 sticky left-0 bg-canvas-2">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="text-sm font-bold text-ink uppercase tracking-wider">
              📋 {group.departmentLabel}
              <span className="ml-2 text-[11px] text-muted font-normal normal-case">
                ({users.length} nhân viên)
              </span>
            </span>
            <button onClick={onDetail}
                    className="text-[11px] font-semibold text-gold hover:underline inline-flex items-center gap-1">
              Chi tiết <ChevronRight size={12} />
            </button>
          </div>
        </td>
      </tr>

      {/* Rows từng NV */}
      {users.length === 0 && (
        <tr>
          <td colSpan={months.length + 1}
              className="px-3 py-3 text-center text-muted italic text-[12px]">
            Không có NV nào có thưởng trong 12 tháng.
          </td>
        </tr>
      )}
      {users.map(u => (
        <tr key={u.userId}
            className={`hover:bg-canvas/40 ${u.deleted ? 'opacity-60' : ''}`}>
          <td className="px-3 py-2 border-b border-hairline sticky left-0 bg-surface">
            <div className="font-semibold text-ink flex items-center gap-1.5 flex-wrap">
              {u.fullName}
              {u.deleted && <span className="text-[9px] text-red-500 font-bold px-1 bg-red-50 dark:bg-red-500/10 rounded">ĐÃ XOÁ</span>}
              {u.locked && !u.deleted && <span className="text-[9px] text-amber-600 font-bold px-1 bg-amber-50 dark:bg-amber-500/10 rounded">KHOÁ</span>}
            </div>
            <div className="text-[11px] text-muted">{u.roleLabel}</div>
          </td>
          {months.map((mo, i) => {
            const v = u.amountsByMonth?.[ymKey(mo.month, mo.year)];
            return (
              <td key={ymKey(mo.month, mo.year)}
                  className={`text-right px-3 py-2 border-b border-hairline tabular-nums ${
                    v > 0 ? 'text-emerald-700 dark:text-emerald-300 font-semibold' : 'text-faint'
                  } ${i === lastIdx ? 'bg-gold/5' : ''}`}>
                {v > 0 ? fmtVnd(v) : '—'}
              </td>
            );
          })}
        </tr>
      ))}

      {/* Subtotal row cho phòng */}
      <tr className="bg-canvas font-bold">
        <td className="px-3 py-2 border-b-2 border-hairline-2 sticky left-0 bg-canvas text-ink-2 text-[12px]">
          Σ {group.departmentLabel}
        </td>
        {months.map((mo, i) => {
          const v = totals[ymKey(mo.month, mo.year)];
          return (
            <td key={ymKey(mo.month, mo.year)}
                className={`text-right px-3 py-2 border-b-2 border-hairline-2 tabular-nums text-gold
                            ${i === lastIdx ? 'bg-gold/10' : ''}`}>
              {v > 0 ? fmtVnd(v) : '—'}
            </td>
          );
        })}
      </tr>
    </>
  );
}