// src/pages/owner/OwnerExpenseCategoryPage.jsx
//
// Trang "Phân tích danh mục chi" — mở từ Quản lý nhà cung cấp.
//
// Gom TOÀN BỘ chi tiêu của nhà máy thành các danh mục, từ 2 nguồn:
//  • NGUYÊN LIỆU (kind = MATERIAL) — mua qua phiếu đặt hàng, "giá" = đơn giá/đvt.
//  • KHOẢN CHI  (kind = EXPENSE)  — danh mục chi của NCC trong phiếu chi ĐÃ DUYỆT,
//    "giá" = số tiền của 1 lần chi / lần dùng dịch vụ.
//
// Mỗi dòng hiển thị: giá thấp nhất (kèm thời gian), giá cao nhất (kèm thời gian),
// giá gần nhất, và tổng tiền đã mua / đã chi.
// Click vào 1 danh mục → trang phân tích giá chi tiết (dùng chung với phân tích
// giá nguyên liệu: /owner/production/material-price-analysis?name=...&kind=...).
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, Search, BarChart3, Package, Receipt,
  ArrowUpDown, Layers,
} from 'lucide-react';
import { PageHeader, EmptyState, formatCurrency, formatDate } from '../../components/ui';
import { CardSkeleton } from '../../components/ui/Skeleton.jsx';
import { ownerExpenseCategoryApi } from '../../api/materialRequestApi.js';

const money = (v) => formatCurrency(v);
const qtyFmt = (v) =>
  v == null ? '—' : new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 }).format(Number(v));

const KIND_CFG = {
  MATERIAL: {
    label: 'Nguyên liệu',
    icon: Package,
    cls: 'bg-gold/15 text-gold',
    // Nguyên liệu: "mua"
    verbMin: 'Giá thấp nhất đã mua',
    verbMax: 'Giá cao nhất đã mua',
    verbLatest: 'Giá gần nhất',
    verbTotal: 'Tổng tiền đã mua',
    countSuffix: 'lần mua',
  },
  EXPENSE: {
    label: 'Khoản chi / dịch vụ',
    icon: Receipt,
    cls: 'bg-emerald-100 dark:bg-emerald-500/18 text-emerald-700 dark:text-emerald-300',
    // Dịch vụ / khoản chi: "sử dụng / chi"
    verbMin: 'Chi thấp nhất',
    verbMax: 'Chi cao nhất',
    verbLatest: 'Lần chi gần nhất',
    verbTotal: 'Tổng tiền đã chi',
    countSuffix: 'lần chi',
  },
};

export default function OwnerExpenseCategoryPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState('');   // '' = tất cả
  const [sortBy, setSortBy] = useState('spent');      // spent | name | latest

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await ownerExpenseCategoryApi.list({ search: search.trim() || undefined });
      setRows(data || []);
    } finally { setLoading(false); }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const filtered = useMemo(() => {
    const arr = kindFilter ? rows.filter(r => r.kind === kindFilter) : [...rows];
    arr.sort((a, b) => {
      if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '', 'vi');
      if (sortBy === 'latest') return Number(b.latestAt || 0) - Number(a.latestAt || 0);
      return Number(b.totalSpent || 0) - Number(a.totalSpent || 0);
    });
    return arr;
  }, [rows, kindFilter, sortBy]);

  const totalSpent = filtered.reduce((s, r) => s + Number(r.totalSpent || 0), 0);
  const counts = useMemo(() => ({
    MATERIAL: rows.filter(r => r.kind === 'MATERIAL').length,
    EXPENSE: rows.filter(r => r.kind === 'EXPENSE').length,
  }), [rows]);

  const openDetail = (row) => {
    const qs = new URLSearchParams({ name: row.name, kind: row.kind, from: 'categories' });
    navigate(`/owner/production/material-price-analysis?${qs.toString()}`);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5">
      <button onClick={() => navigate('/owner/production/suppliers')}
        className="flex items-center gap-1.5 text-sm text-muted hover:text-ink font-medium">
        <ChevronLeft size={16} /> Quay lại quản lý nhà cung cấp
      </button>

      <PageHeader icon={BarChart3} title="Phân tích danh mục chi"
        subtitle={`${rows.length} danh mục · ${counts.MATERIAL} nguyên liệu · ${counts.EXPENSE} khoản chi`} />

      {/* Tổng chi */}
      <div className="bg-gradient-to-r from-canvas to-white rounded-2xl border border-line p-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted font-medium">
            {kindFilter ? `Tổng chi · ${KIND_CFG[kindFilter].label}` : 'Tổng chi tất cả danh mục'}
          </p>
          <p className="text-2xl font-bold text-ink mt-0.5">{money(totalSpent)}</p>
        </div>
        <Layers size={28} className="text-gold/40" />
      </div>

      {/* Tìm kiếm + sắp xếp */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Tìm theo tên danh mục chi / tên nguyên liệu..."
            className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-line focus:outline-none focus:border-gold bg-surface"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ArrowUpDown size={13} className="text-muted" />
          {[
            { val: 'spent', label: 'Chi nhiều nhất' },
            { val: 'latest', label: 'Mới nhất' },
            { val: 'name', label: 'Tên A-Z' },
          ].map(s => (
            <button key={s.val} onClick={() => setSortBy(s.val)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${sortBy === s.val ? 'bg-forest-deep text-white border-forest-deep' : 'bg-surface text-muted border-line hover:border-forest-deep'}`}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filter theo loại danh mục */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => setKindFilter('')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${!kindFilter ? 'bg-gold text-white border-gold' : 'bg-surface text-muted border-line hover:border-gold'}`}>
          Tất cả ({rows.length})
        </button>
        {Object.entries(KIND_CFG).map(([kind, cfg]) => (
          <button key={kind} onClick={() => setKindFilter(k => k === kind ? '' : kind)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${kindFilter === kind ? 'bg-gold text-white border-gold' : 'bg-surface text-muted border-line hover:border-gold'}`}>
            <cfg.icon size={12} />{cfg.label} ({counts[kind]})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <CardSkeleton key={i} />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={BarChart3} title="Không có danh mục chi"
          description={search || kindFilter
            ? 'Không tìm thấy danh mục phù hợp bộ lọc.'
            : 'Chưa có nguyên liệu đã mua hoặc phiếu chi đã duyệt nào.'} />
      ) : (
        <div className="space-y-3">
          {filtered.map(row => (
            <CategoryCard key={`${row.kind}-${row.name}`} row={row} onOpen={() => openDetail(row)} />
          ))}
        </div>
      )}
    </div>
  );
}

function CategoryCard({ row, onOpen }) {
  const cfg = KIND_CFG[row.kind] || KIND_CFG.MATERIAL;
  const Icon = cfg.icon;
  const isMaterial = row.kind === 'MATERIAL';

  // Gợi ý thời điểm mua/chi kèm NCC
  const hint = (vendor, at) => [vendor, at ? formatDate(at) : null].filter(Boolean).join(' · ') || '—';

  return (
    <button onClick={onOpen}
      className="w-full text-left bg-surface rounded-2xl border border-hairline p-4 hover:border-gold hover:shadow-sm transition-all">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.cls}`}>
          <Icon size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-ink truncate">{row.name}</p>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.cls}`}>
              {cfg.label}
            </span>
          </div>
          <p className="text-xs text-muted mt-0.5">
            {row.purchaseCount} {cfg.countSuffix}
            {row.vendorCount > 0 && ` · ${row.vendorCount} nhà cung cấp`}
            {isMaterial && row.totalQuantity != null && ` · ${qtyFmt(row.totalQuantity)} ${row.unit}`}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-[11px] text-muted">{cfg.verbTotal}</p>
          <p className="text-lg font-bold text-ink">{money(row.totalSpent)}</p>
        </div>
        <ChevronRight size={16} className="text-muted mt-2 flex-shrink-0" />
      </div>

      {/* Giá thấp nhất / cao nhất / gần nhất */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3">
        <PriceBox label={cfg.verbMin} value={money(row.minPrice)}
          suffix={isMaterial ? `/ ${row.unit}` : ''}
          hint={hint(row.minVendorName, row.minAt)} tone="good" />
        <PriceBox label={cfg.verbMax} value={money(row.maxPrice)}
          suffix={isMaterial ? `/ ${row.unit}` : ''}
          hint={hint(row.maxVendorName, row.maxAt)} tone="bad" />
        <PriceBox label={cfg.verbLatest} value={money(row.latestPrice)}
          suffix={isMaterial ? `/ ${row.unit}` : ''}
          hint={hint(row.latestVendorName, row.latestAt)} />
      </div>
    </button>
  );
}

function PriceBox({ label, value, suffix, hint, tone }) {
  const color = tone === 'good' ? 'text-emerald-600 dark:text-emerald-300' : tone === 'bad' ? 'text-red-600 dark:text-red-300' : 'text-ink';
  return (
    <div className="bg-canvas rounded-xl px-3 py-2">
      <p className="text-[11px] text-muted">{label}</p>
      <p className={`text-sm font-bold mt-0.5 ${color}`}>
        {value}
        {suffix && <span className="text-[11px] font-medium text-muted ml-1">{suffix}</span>}
      </p>
      <p className="text-[10px] text-muted mt-0.5 truncate">{hint}</p>
    </div>
  );
}