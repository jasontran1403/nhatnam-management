/*
 * BONUS TREND PAGE — Biến động thưởng (10/2026)
 *
 * 12 tháng gần nhất, cột trái = cũ nhất, cột phải = tháng hiện tại − 1.
 * Chỉ ĐỌC data đã lưu. Tab Kho: readonly (nhập ở Bảng chấm công → tab Kho).
 */

import { useEffect, useState, useRef } from 'react';
import { PageHeader, SectionCard, LoadingSpinner } from '../../components/ui';
import { BackButton } from '../../components/common/SubPageNav';
import { factoryPayrollApi } from '../../api/factoryPayrollApi';
import { useToast } from '../../components/common/Toast';
import { TrendingUp, Lock } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

const DEPTS = [
  { key: 'SALES',      label: 'Kinh doanh' },
  { key: 'ACCOUNTING', label: 'Kế toán' },
  { key: 'FACTORY',    label: 'Xưởng sản xuất' },
  { key: 'DRIVER',     label: 'Tài xế' },
  { key: 'WAREHOUSE',  label: 'Kho' },
];

const fmt = (v) => (v == null ? '—' : Number(v).toLocaleString('vi-VN'));
const fmtVnd = (v) => (v == null ? '—' : Number(v).toLocaleString('vi-VN') + 'đ');
const monthLabel = (m, y) => `${String(m).padStart(2, '0')}/${y}`;
const ymKey = (m, y) => `${y}-${String(m).padStart(2, '0')}`;

/** Rút gọn số tiền thành đọc nhanh: 100.000.000 → "100tr", 1.000.000.000 → "1 tỷ" */
const shortMoney = (v) => {
  if (v == null) return '—';
  const n = Number(v);
  if (n >= 1_000_000_000) {
    const t = n / 1_000_000_000;
    return (t % 1 === 0 ? t.toFixed(0) : t.toFixed(2).replace(/\.?0+$/, '')) + ' tỷ';
  }
  if (n >= 1_000_000) {
    const tr = n / 1_000_000;
    return (tr % 1 === 0 ? tr.toFixed(0) : tr.toFixed(2).replace(/\.?0+$/, '')) + 'tr';
  }
  if (n >= 1_000) {
    const k = n / 1_000;
    return (k % 1 === 0 ? k.toFixed(0) : k.toFixed(2).replace(/\.?0+$/, '')) + 'k';
  }
  return n.toLocaleString('vi-VN');
};

/** Dept-specific header stat rows. Mỗi row có render(mo) → React node */
const DEPT_STATS = {
  SALES: [
    { key: 'deptRevenue',   label: 'Doanh thu phòng', render: (mo) => fmtVnd(mo.stats?.deptRevenue) },
    { key: 'target',        label: 'Target',          render: (mo) => fmtVnd(mo.stats?.target) },
    { key: 'stepUnitPrice', label: 'Đơn giá / bước',
      render: (mo) => {
        const u = mo.stats?.stepUnitPrice, a = mo.stats?.stepAmount;
        if (u == null) return '—';
        return `${fmt(u)}đ${a != null ? ' / ' + shortMoney(a) : ''}`;
      } },
    { key: 'totalPool',     label: 'Tổng thưởng',     render: (mo) => fmtVnd(mo.stats?.totalPool), tone: 'gold' },
  ],
  ACCOUNTING: [
    { key: 'deptRevenue',       label: 'Doanh thu phòng', render: (mo) => fmtVnd(mo.stats?.deptRevenue) },
    { key: 'commissionPercent', label: 'Tỷ suất hoa hồng',
      render: (mo) => {
        const p = mo.stats?.commissionPercent;
        return p == null ? '—' : (Math.floor(p * 100) / 100).toFixed(2) + '%';
      } },
    { key: 'totalPool',         label: 'Tổng thưởng',     render: (mo) => fmtVnd(mo.stats?.totalPool), tone: 'gold' },
  ],
  FACTORY: [
    { key: 'totalOutputKg', label: 'Tổng sản lượng (kg)', render: (mo) => fmt(mo.stats?.totalOutputKg) },
    { key: 'ratePerTon',    label: 'Đơn giá/tấn',          render: (mo) => fmtVnd(mo.stats?.ratePerTon) },
    { key: 'bonusPool',     label: 'Pool thưởng',          render: (mo) => fmtVnd(mo.stats?.bonusPool), tone: 'gold' },
  ],
  DRIVER: [
    { key: 'gasPrice',       label: 'Giá xăng (đ/km)',   render: (mo) => fmtVnd(mo.stats?.gasPrice) },
    { key: 'bikeUnitPrice',  label: 'Thưởng xe máy/lượt', render: (mo) => fmtVnd(mo.stats?.bikeUnitPrice) },
    { key: 'truckUnitPrice', label: 'Thưởng xe tải/lượt', render: (mo) => fmtVnd(mo.stats?.truckUnitPrice) },
    { key: 'totalPool',      label: 'Tổng lương TX',      render: (mo) => fmtVnd(mo.stats?.totalPool), tone: 'gold' },
  ],
  WAREHOUSE: [
    { key: 'totalPool', label: 'Tổng thưởng', render: (mo) => fmtVnd(mo.stats?.totalPool), tone: 'gold' },
  ],
};

export default function BonusTrendPage() {
  const [params] = useSearchParams();
  const initialDept = params.get('dept') || 'SALES';
  const [dept, setDept] = useState(initialDept);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef(null);
  const currentCellRef = useRef(null);
  const toast = useToast();

  const reload = () => {
    setLoading(true);
    return factoryPayrollApi.getBonusTrend(dept)
      .then(d => setData(d))
      .catch(e => toast(e?.response?.data?.message || 'Lỗi load biến động thưởng', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [dept]);

  // Auto-scroll đến cột tháng mới nhất (= currentCellRef) sau khi load xong
  useEffect(() => {
    if (loading || !data) return;
    const cell = currentCellRef.current;
    const container = scrollRef.current;
    if (cell && container) {
      // Scroll để cột mới nhất visible ở bên phải
      const cellRight = cell.offsetLeft + cell.offsetWidth;
      container.scrollLeft = Math.max(0, cellRight - container.clientWidth);
    }
  }, [loading, data, dept]);

  const months = data?.months || [];
  const users  = data?.users  || [];
  const statRows = DEPT_STATS[dept] || [];
  const lastIdx = months.length - 1;

  return (
    <div className="p-5 space-y-4">
      <BackButton fallback="/owner/bonus-summary" />
      <PageHeader
        icon={TrendingUp}
        title="Biến động thưởng — chi tiết"
        subtitle="12 tháng gần nhất · chi tiết từng phòng · chỉ hiển thị data đã tính" />

      <SectionCard>
        <div className="flex items-center gap-1 flex-wrap p-3 border-b border-hairline">
          {DEPTS.map(d => (
            <button key={d.key}
                    onClick={() => setDept(d.key)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                      dept === d.key
                        ? 'bg-gold text-black'
                        : 'bg-canvas text-ink-2 hover:bg-canvas-2 border border-hairline-2'
                    }`}>
              {d.label}
            </button>
          ))}
        </div>

        {loading && <div className="p-10 flex justify-center"><LoadingSpinner /></div>}

        {!loading && data && (
          <div className="overflow-auto" ref={scrollRef}>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-canvas sticky top-0 z-10">
                  <th className="text-left px-3 py-2 border-b border-hairline font-bold text-ink
                                 min-w-[240px] sticky left-0 bg-canvas z-20">
                    Nhân viên / Thông số
                  </th>
                  {months.map((mo, i) => (
                    <th key={ymKey(mo.month, mo.year)}
                        ref={i === lastIdx ? currentCellRef : null}
                        className={`text-right px-3 py-2 border-b border-hairline font-bold min-w-[150px]
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

                {statRows.map(sr => (
                  <tr key={sr.key} className="bg-canvas/60">
                    <th className="text-left px-3 py-1.5 text-[11px] font-semibold text-muted
                                   border-b border-hairline sticky left-0 bg-canvas/60 z-10">
                      {sr.label}
                    </th>
                    {months.map((mo, i) => (
                      <td key={ymKey(mo.month, mo.year) + '-' + sr.key}
                          className={`text-right px-3 py-1.5 border-b border-hairline tabular-nums text-[12px]
                                      ${sr.tone === 'gold' ? 'text-gold font-bold' : 'text-ink-2'}
                                      ${i === lastIdx ? 'bg-gold/5' : ''}`}>
                        {sr.render(mo)}
                      </td>
                    ))}
                  </tr>
                ))}
              </thead>

              <tbody>
                {users.length === 0 && (
                  <tr><td colSpan={months.length + 1}
                          className="text-center py-10 text-muted italic">
                    Không có nhân viên nào có thưởng trong 12 tháng gần nhất.
                  </td></tr>
                )}
                {users.map(u => (
                  <tr key={u.userId}
                      className={`hover:bg-canvas/40 ${u.deleted ? 'opacity-60' : ''} ${
                        u.support ? 'bg-blue-50/30 dark:bg-blue-500/5' : ''
                      }`}>
                    <td className="px-3 py-2 border-b border-hairline sticky left-0 bg-surface">
                      <div className="font-semibold text-ink flex items-center gap-1.5 flex-wrap">
                        {u.fullName}
                        {u.fixedAmount && (
                          <span className="text-[9px] text-purple-700 dark:text-purple-300 font-bold px-1
                                           bg-purple-50 dark:bg-purple-500/10 border border-purple-200
                                           dark:border-purple-500/30 rounded">
                            THƯỞNG CỐ ĐỊNH
                          </span>
                        )}
                        {u.deleted && <span className="text-[9px] text-red-500 font-bold px-1 bg-red-50 dark:bg-red-500/10 rounded">ĐÃ XOÁ</span>}
                        {u.locked && !u.deleted && <span className="text-[9px] text-amber-600 font-bold px-1 bg-amber-50 dark:bg-amber-500/10 rounded">KHOÁ</span>}
                      </div>
                      <div className="text-[11px] text-muted">
                        {u.roleLabel}
                        {u.support && u.supportLabel && (
                          <span className="ml-1 text-blue-600 dark:text-blue-400 font-semibold">
                            · {u.supportLabel}
                          </span>
                        )}
                      </div>
                    </td>
                    {months.map((mo, i) => {
                      const k = ymKey(mo.month, mo.year);
                      const v = u.amountsByMonth?.[k];
                      const ratio = u.ratioByMonth?.[k];
                      const isActt = dept === 'ACCOUNTING';
                      return (
                        <td key={k} className={`text-right px-3 py-2 border-b border-hairline tabular-nums ${
                          v > 0 ? 'text-emerald-700 dark:text-emerald-300 font-semibold' : 'text-faint'
                        } ${i === lastIdx ? 'bg-gold/5' : ''}`}>
                          {v > 0 ? (
                            <>
                              {fmtVnd(v)}
                              {isActt && ratio != null && (
                                <span className="text-muted font-normal"> / {Number(ratio).toFixed(0)}%</span>
                              )}
                            </>
                          ) : '—'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}