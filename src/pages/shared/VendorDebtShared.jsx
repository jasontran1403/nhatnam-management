// src/pages/shared/VendorDebtShared.jsx
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Wallet, Building2, ChevronLeft, ArrowUpDown, Clock, TrendingUp, FileText, Receipt,
  Plus, Search, Phone, User, History,
} from 'lucide-react';
import { PageHeader, EmptyState, formatCurrency, PrimaryButton, SecondaryButton } from '../../components/ui';
import { CardSkeleton } from '../../components/ui/Skeleton.jsx';
import { ownerVendorDebtApi, fmtTs } from '../../api/materialRequestApi.js';
import { factoryProdApi } from '../../api/productionModuleApi.js';
import ExpenseCreateModal, { QuickCreateVendorModal, VENDOR_TYPE_LABELS } from '../accountant/ExpenseCreateModal.jsx';

function daysAgo(ms) {
  if (!ms) return null;
  return Math.floor((Date.now() - ms) / 86400000);
}

// ── Quản lý danh mục nhà cung cấp (tạo mới + xem danh sách) ─────────────────
// Chỉ hiện cho role được phép quản lý NCC (vd: SUPER_ACCOUNTANT) — dùng chung
// danh mục MaterialVendor với phiếu đặt hàng nguyên liệu.
function VendorManagementSection() {
  const [open, setOpen] = useState(false);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await factoryProdApi.listVendors();
      setVendors(res || []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (open) load(); }, [open, load]);

  const filtered = vendors.filter(v => v.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3.5">
        <div className="flex items-center gap-2">
          <Building2 size={16} className="text-[#C9A84C]" />
          <span className="text-sm font-semibold text-[#1C1C1E]">Quản lý nhà cung cấp</span>
        </div>
        <span className="text-xs text-[#8E8878]">{open ? 'Thu gọn' : 'Mở rộng'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-black/5 pt-3 space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8878]" />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Tìm nhà cung cấp..."
                className="w-full pl-8 pr-3 py-2 text-sm rounded-xl border border-[#E8DDD0] focus:outline-none focus:border-[#C9A84C] bg-[#FAF7F2]"
              />
            </div>
            <PrimaryButton onClick={() => setCreateOpen(true)} className="flex-shrink-0">
              <Plus size={14} /> Thêm NCC
            </PrimaryButton>
          </div>

          {loading ? (
            <div className="space-y-2">{[1, 2].map(i => <div key={i} className="h-12 bg-[#FAF7F2] rounded-xl animate-pulse" />)}</div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-xs text-[#8E8878] py-6">
              {vendors.length === 0 ? 'Chưa có nhà cung cấp nào — hãy tạo mới.' : 'Không tìm thấy nhà cung cấp.'}
            </p>
          ) : (
            <div className="max-h-72 overflow-y-auto divide-y divide-black/5 -mx-1">
              {filtered.map(v => (
                <div key={v.id} className="flex items-center justify-between px-1 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#1C1C1E] truncate">{v.name}</p>
                    <p className="text-xs text-[#8E8878] mt-0.5 flex items-center gap-2 flex-wrap">
                      <span className="bg-[#F5F0EB] px-1.5 py-0.5 rounded-full">{VENDOR_TYPE_LABELS[v.vendorType] || v.vendorType || 'Khác'}</span>
                      {v.contactPerson && <span className="flex items-center gap-0.5"><User size={10} />{v.contactPerson}</span>}
                      {v.contactPhone && <span className="flex items-center gap-0.5"><Phone size={10} />{v.contactPhone}</span>}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {createOpen && (
        <QuickCreateVendorModal
          onClose={() => setCreateOpen(false)}
          onCreated={(created) => {
            setVendors(p => [created, ...p]);
            setCreateOpen(false);
            setOpen(true);
          }}
        />
      )}
    </div>
  );
}

// ── Danh sách công nợ theo NCC ───────────────────────────────────────────────
function VendorDebtListPage({ basePath, canCreateExpense, canManageVendors, dashboardPath, paymentHistoryPath }) {
  const navigate = useNavigate();
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('oldest'); // oldest | amount
  const [payTarget, setPayTarget] = useState(null); // { id, name } | null

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await ownerVendorDebtApi.list(sortBy);
      setVendors(data || []);
    } finally { setLoading(false); }
  }, [sortBy]);

  useEffect(() => { load(); }, [load]);

  const totalDebt = vendors.reduce((s, v) => s + Number(v.totalDebt || 0), 0);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5">
      {dashboardPath && (
        <button onClick={() => navigate(dashboardPath)}
          className="flex items-center gap-1.5 text-sm text-[#8E8878] hover:text-[#1C1C1E] font-medium">
          <ChevronLeft size={16} /> Quay lại Tổng quan sản xuất
        </button>
      )}

      <PageHeader icon={Wallet} title="Công nợ nhà cung cấp"
        subtitle={`${vendors.length} nhà cung cấp đang có công nợ`}
        action={paymentHistoryPath && (
          <SecondaryButton onClick={() => navigate(paymentHistoryPath)}>
            <History size={15} /> Lịch sử thanh toán
          </SecondaryButton>
        )} />

      {canManageVendors && <VendorManagementSection />}

      <div className="bg-gradient-to-r from-amber-50 to-amber-50/40 rounded-2xl p-4 flex items-center justify-between border border-amber-100">
        <div>
          <p className="text-xs text-[#8E8878] font-medium">Tổng công nợ hiện tại</p>
          <p className="text-2xl font-bold text-amber-700 mt-0.5">{formatCurrency(totalDebt)}</p>
        </div>
        <Wallet size={28} className="text-amber-600/40" />
      </div>

      <div className="flex items-center gap-2">
        <ArrowUpDown size={13} className="text-[#8E8878]" />
        <span className="text-xs text-[#8E8878]">Sắp xếp:</span>
        {[
          { val: 'oldest', label: 'Công nợ lâu nhất', icon: Clock },
          { val: 'amount', label: 'Công nợ nhiều nhất', icon: TrendingUp },
        ].map(s => (
          <button key={s.val} onClick={() => setSortBy(s.val)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${sortBy === s.val ? 'bg-[#1A2B1A] text-white border-[#1A2B1A]' : 'bg-white text-[#8E8878] border-[#E8DDD0] hover:border-[#1A2B1A]'}`}>
            <s.icon size={12} />{s.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <CardSkeleton key={i} />)}</div>
      ) : vendors.length === 0 ? (
        <EmptyState icon={Wallet} title="Không có công nợ nào"
          description="Tất cả nhà cung cấp đã được thanh toán đầy đủ." />
      ) : (
        <div className="space-y-3">
          {vendors.map(v => {
            const days = daysAgo(v.oldestDebtSince);
            return (
              <div key={v.vendorId}
                className="w-full bg-white rounded-2xl border border-black/5 shadow-sm p-4 hover:border-amber-300 hover:shadow-md transition-all">
                <button onClick={() => navigate(`${basePath}/${v.vendorId}`)} className="w-full text-left">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
                        <Building2 size={18} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-[#1C1C1E] truncate">{v.vendorName}</p>
                        <p className="text-xs text-[#8E8878] mt-0.5">
                          {VENDOR_TYPE_LABELS[v.vendorType] || v.vendorType || 'Khác'}
                          {v.contactPerson && <> · {v.contactPerson}</>}
                          {v.contactPhone && <> · {v.contactPhone}</>}
                        </p>
                        <p className="text-xs text-amber-700 mt-1">
                          {v.unsettledRequestCount} phiếu chưa thanh toán hết
                          {days != null && <> · Lâu nhất: {days} ngày</>}
                        </p>
                      </div>
                    </div>
                    <p className="text-lg font-bold text-amber-700 whitespace-nowrap">{formatCurrency(v.totalDebt)}</p>
                  </div>
                </button>
                {canCreateExpense && (
                  <div className="mt-3 pt-3 border-t border-black/5">
                    <button
                      onClick={(e) => { e.stopPropagation(); setPayTarget({ id: v.vendorId, name: v.vendorName }); }}
                      className="flex items-center gap-1.5 text-xs font-semibold text-[#C9A84C] hover:underline">
                      <Receipt size={13} /> Tạo phiếu chi cho NCC này
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {payTarget && (
        <ExpenseCreateModal
          initialMode="VENDOR_DEBT"
          initialVendorId={payTarget.id}
          initialVendorName={payTarget.name}
          onClose={() => setPayTarget(null)}
          onCreated={() => { setPayTarget(null); load(); }}
        />
      )}
    </div>
  );
}

// ── Chi tiết lịch sử công nợ của 1 NCC ───────────────────────────────────────
function VendorDebtDetailPage({ basePath, canCreateExpense }) {
  const { vendorId } = useParams();
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payOpen, setPayOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    ownerVendorDebtApi.getHistory(vendorId)
      .then(d => setHistory(d || []))
      .finally(() => setLoading(false));
  }, [vendorId]);

  useEffect(() => { load(); }, [load]);

  const totalRemaining = history.reduce((s, h) => s + Number(h.remaining || 0), 0);
  const vendorName = history[0]?.vendorName;

  const STATUS_CFG = {
    NONE: { label: 'Chưa trả', cls: 'bg-red-50 text-red-600 border-red-200' },
    PARTIAL: { label: 'Đã trả 1 phần', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    SETTLED: { label: 'Đã trả hết', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5">
      <button onClick={() => navigate(basePath)}
        className="flex items-center gap-1.5 text-sm text-[#8E8878] hover:text-[#1C1C1E] font-medium">
        <ChevronLeft size={16} /> Quay lại danh sách công nợ
      </button>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <PageHeader icon={FileText} title={`Lịch sử công nợ${vendorName ? ' — ' + vendorName : ''}`}
          subtitle={`${history.length} phiếu đặt hàng có công nợ`} />
        {canCreateExpense && totalRemaining > 0 && (
          <PrimaryButton onClick={() => setPayOpen(true)}>
            <Receipt size={15} /> Tạo phiếu chi
          </PrimaryButton>
        )}
      </div>

      <div className="bg-gradient-to-r from-amber-50 to-amber-50/40 rounded-2xl p-4 flex items-center justify-between border border-amber-100">
        <div>
          <p className="text-xs text-[#8E8878] font-medium">Công nợ còn lại</p>
          <p className="text-2xl font-bold text-amber-700 mt-0.5">{formatCurrency(totalRemaining)}</p>
        </div>
        <Wallet size={28} className="text-amber-600/40" />
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <CardSkeleton key={i} />)}</div>
      ) : history.length === 0 ? (
        <EmptyState icon={FileText} title="Chưa có lịch sử công nợ" />
      ) : (
        <div className="bg-white rounded-2xl border border-black/5 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#FAF7F2] border-b border-black/5">
                {['Mã phiếu', 'Tổng tiền', 'Đã trả', 'Còn lại', 'Trạng thái', 'Công nợ từ'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-[#8E8878] uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.map(h => {
                const cfg = STATUS_CFG[h.debtSettlementStatus] || STATUS_CFG.NONE;
                return (
                  <tr key={h.requestVendorId} className="border-b border-[#F0EBE3] last:border-0">
                    <td className="px-4 py-3 font-mono text-xs font-bold text-[#C9A84C]">{h.requestCode}</td>
                    <td className="px-4 py-3 font-semibold text-[#1C1C1E]">{formatCurrency(h.totalAmount)}</td>
                    <td className="px-4 py-3 text-emerald-600">{formatCurrency(h.paidAmount)}</td>
                    <td className="px-4 py-3 font-bold text-amber-700">{formatCurrency(h.remaining)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex text-xs font-semibold px-2 py-0.5 rounded-full border ${cfg.cls}`}>{cfg.label}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#8E8878]">{fmtTs(h.debtSince)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {payOpen && (
        <ExpenseCreateModal
          initialMode="VENDOR_DEBT"
          initialVendorId={Number(vendorId)}
          initialVendorName={vendorName || ''}
          onClose={() => setPayOpen(false)}
          onCreated={() => { setPayOpen(false); load(); }}
        />
      )}
    </div>
  );
}

/**
 * Trang công nợ NCC dùng chung.
 * @param basePath - đường dẫn list (ví dụ '/owner/production/vendor-debts' hoặc '/accountant/vendor-debts')
 * @param canCreateExpense - true để hiện nút "Tạo phiếu chi" (accountant/super-accountant); false cho owner (chỉ xem)
 * @param canManageVendors - true để hiện khu vực "Quản lý nhà cung cấp" (tạo NCC mới) — chỉ SUPER_ACCOUNTANT
 * @param dashboardPath - nếu có, hiện nút "Quay lại Tổng quan sản xuất" trỏ tới đường dẫn này (chỉ dùng khi trang này nằm trong luồng Production Dashboard, vd Owner)
 * @param paymentHistoryPath - nếu có, hiện nút "Lịch sử thanh toán" trỏ tới trang Phiếu chi tương ứng (vd '/owner/expenses' hoặc '/super-accountant/expenses')
 */
export default function VendorDebtShared({ basePath, canCreateExpense = false, canManageVendors = false, dashboardPath, paymentHistoryPath }) {
  const { vendorId } = useParams();
  return vendorId
    ? <VendorDebtDetailPage basePath={basePath} canCreateExpense={canCreateExpense} />
    : <VendorDebtListPage basePath={basePath} canCreateExpense={canCreateExpense} canManageVendors={canManageVendors} dashboardPath={dashboardPath} paymentHistoryPath={paymentHistoryPath} />;
}
