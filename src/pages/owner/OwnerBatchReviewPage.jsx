// OwnerBatchReviewPage.jsx
// Trang Owner xem xét và duyệt các mẻ sản xuất do Factory Worker nộp
import { useState, useEffect, useMemo } from 'react';
import { CheckCircle, Eye, TrendingUp, TrendingDown, Package } from 'lucide-react';
import useMinLoading from '../../hooks/useMinLoading.js';
import { CardSkeleton } from '../../components/ui/Skeleton.jsx';
import { ownerProductionApi } from '../../api/productionApi';
import { useLang } from '../../context/LangContext';
import { useFmt } from '../../utils/useFmt';

function VarianceBadge({ pct }) {
  const v = parseFloat(pct || 0);
  if (Math.abs(v) < 0.1) return <span className="text-[#8E8878] text-xs">±0%</span>;
  const up = v > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full ${
      up ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-700'
    }`}>
      {up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
      {up ? '+' : ''}{v.toFixed(1)}%
    </span>
  );
}

// ── Batch detail card ─────────────────────────────────────────────────────────
function BatchCard({ batch, onReviewed }) {
  const { t } = useLang();
  const { fmtDate } = useFmt();
  const [expanded, setExpanded] = useState(false);
  const [marking, setMarking] = useState(false);
  const isReviewed = batch.status === 'REVIEWED';

  const markReviewed = async (e) => {
    e.stopPropagation();
    if (isReviewed) return;
    setMarking(true);
    try {
      await ownerProductionApi.markBatchReviewed(batch.id);
      onReviewed(batch.id);
    } finally { setMarking(false); }
  };

  // Determine overall variance severity
  const variance = parseFloat(batch.outputVariancePct || 0);
  const varSeverity = Math.abs(variance) > 15 ? 'high' : Math.abs(variance) > 5 ? 'medium' : 'low';

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${
      isReviewed ? 'border-black/5 opacity-80' :
      varSeverity === 'high' ? 'border-red-200' :
      varSeverity === 'medium' ? 'border-amber-200' : 'border-black/5'
    }`}>
      <button className="w-full text-left p-5" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm font-bold text-[#1C1C1E]">{batch.batchCode}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                isReviewed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
              }`}>
                {isReviewed
                  ? `✓ ${t('production', 'batchrv_reviewed')}`
                  : `⏳ ${t('production', 'batchrv_pending')}`}
              </span>
            </div>
            <p className="text-sm text-[#8E8878] mt-0.5 truncate">
              {batch.productName} · {batch.recipeName}
            </p>
            <div className="flex gap-4 mt-1 text-xs text-[#8E8878] flex-wrap">
              <span>📅 {fmtDate(batch.producedAt)}</span>
              <span>👤 {batch.createdByName}</span>
              <span>
                {t('production', 'batchrv_actual')}: <b className="text-[#1C1C1E]">{batch.actualOutputQty} {batch.outputUnit}</b>
                {' / '}
                {t('production', 'batchrv_standard')}: <b className="text-[#8E8878]">{batch.standardOutputQty} {batch.outputUnit}</b>
              </span>
            </div>
          </div>
          <div className="text-right flex-shrink-0 flex flex-col items-end gap-2">
            <VarianceBadge pct={batch.outputVariancePct} />
            {!isReviewed && (
              <button
                onClick={markReviewed}
                disabled={marking}
                className="flex items-center gap-1 text-xs bg-[#1A2B1A] text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-[#243824] disabled:opacity-50 transition-colors">
                {marking ? '...' : <><Eye size={12} />{t('production', 'batchrv_reviewed')}</>}
              </button>
            )}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-5 border-t border-black/5">
          {/* Output summary */}
          <div className="mt-4 grid grid-cols-3 gap-3 mb-4">
            {[
              { label: t('production', 'batchrv_standard_output'), value: `${batch.standardOutputQty} ${batch.outputUnit}`, color: 'text-[#8E8878]' },
              { label: t('production', 'batchrv_actual_output'),   value: `${batch.actualOutputQty} ${batch.outputUnit}`,   color: 'text-[#1C1C1E]' },
              { label: t('production', 'batchrv_output_loss'),     value: <VarianceBadge pct={batch.outputVariancePct} />,  color: '' },
            ].map(s => (
              <div key={s.label} className="bg-[#FAF7F2] rounded-xl p-3 text-center">
                <p className="text-xs text-[#8E8878] mb-1">{s.label}</p>
                <div className={`font-semibold text-sm ${s.color}`}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Materials table */}
          {batch.items && batch.items.length > 0 && (
            <>
              <p className="text-xs font-medium text-[#8E8878] uppercase tracking-wide mb-3">
                {t('production', 'batchrv_materials_detail')}
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-[#8E8878] border-b border-black/5">
                      <th className="text-left pb-2 font-medium">{t('production', 'batchrv_col_material')}</th>
                      <th className="text-right pb-2 font-medium">{t('production', 'batchrv_col_standard')}</th>
                      <th className="text-right pb-2 font-medium">{t('production', 'batchrv_col_actual')}</th>
                      <th className="text-right pb-2 font-medium">{t('production', 'batchrv_col_variance')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batch.items.map(item => {
                      const v = parseFloat(item.variancePct || 0);
                      return (
                        <tr key={item.id} className="border-b border-black/5 last:border-0">
                          <td className="py-2 font-medium text-[#1C1C1E]">{item.materialName}</td>
                          <td className="py-2 text-right text-[#8E8878]">{item.standardQty} {item.unit}</td>
                          <td className={`py-2 text-right font-medium ${
                            Math.abs(v) > 10 ? 'text-red-600' : 'text-[#1C1C1E]'
                          }`}>{item.actualQty} {item.unit}</td>
                          <td className="py-2 text-right"><VarianceBadge pct={item.variancePct} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {batch.notes && (
            <p className="mt-3 text-xs text-[#8E8878] italic border-t border-black/5 pt-3">
              {batch.notes}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function OwnerBatchReviewPage() {
  const { t } = useLang();
  const [batches, setBatches] = useState([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useMinLoading();
  const [filterStatus, setFilterStatus] = useState(''); // '' | 'SUBMITTED' | 'REVIEWED'

  const load = async (p = 0) => {
    setLoading(true);
    try {
      const data = await ownerProductionApi.listAllBatches(p, 20);
      let content = data?.content || [];
      if (filterStatus) content = content.filter(b => b.status === filterStatus);
      setBatches(content);
      setTotalPages(data?.totalPages || 0);
      setPage(p);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(0); }, [filterStatus]);

  const onReviewed = (id) =>
    setBatches(prev => prev.map(b => b.id === id ? { ...b, status: 'REVIEWED' } : b));

  const pending  = batches.filter(b => b.status !== 'REVIEWED');
  const reviewed = batches.filter(b => b.status === 'REVIEWED');

  // High variance batches (output variance > 15%)
  const highVariance = batches.filter(b => Math.abs(parseFloat(b.outputVariancePct || 0)) > 15);

  const stats = useMemo(() => [
    { icon: Package,     label: t('production', 'batchrv_stat_total'),         value: batches.length,      color: 'text-[#1A2B1A]' },
    { icon: Eye,         label: t('production', 'batchrv_pending'),            value: pending.length,      color: pending.length > 0 ? 'text-amber-600' : 'text-emerald-600' },
    { icon: CheckCircle, label: t('production', 'batchrv_reviewed'),           value: reviewed.length,     color: 'text-emerald-600' },
    { icon: TrendingUp,  label: t('production', 'batchrv_stat_high_variance'), value: highVariance.length, color: highVariance.length > 0 ? 'text-red-600' : 'text-[#8E8878]' },
  ], [t, batches.length, pending.length, reviewed.length, highVariance.length]);

  const filters = useMemo(() => [
    ['', t('common', 'all')],
    ['SUBMITTED', t('production', 'batchrv_pending')],
    ['REVIEWED', t('production', 'batchrv_reviewed')],
  ], [t]);

  if (loading && batches.length === 0) return <div className="p-8"><CardSkeleton lines={5} /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#1C1C1E]"
            style={{ fontFamily: 'var(--font-display)' }}>
          {t('production', 'batchrv_title')}
        </h1>
        <p className="text-sm text-[#8E8878] mt-1">
          {t('production', 'batchrv_subtitle')}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {stats.map(stat => (
          <div key={stat.label} className="bg-white rounded-2xl border border-black/5 p-4 shadow-sm">
            <stat.icon size={18} className={stat.color + ' mb-2'} />
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-[#8E8878] mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* High variance alert */}
      {highVariance.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
          <TrendingUp size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-700">
              {t('production', 'batchrv_high_variance_alert', { n: highVariance.length })}
            </p>
            <p className="text-xs text-red-500 mt-0.5">
              {highVariance.map(b => b.batchCode).join(', ')}
            </p>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2">
        {filters.map(([val, label]) => (
          <button key={val} onClick={() => setFilterStatus(val)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
              filterStatus === val ? 'bg-[#1A2B1A] text-white' : 'bg-white border border-black/10 text-[#8E8878] hover:text-[#1C1C1E]'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Batch list */}
      <div className="space-y-3">
        {batches.map(batch => (
          <BatchCard key={batch.id} batch={batch} onReviewed={onReviewed} />
        ))}
        {batches.length === 0 && (
          <div className="bg-white rounded-2xl border border-black/5 p-12 text-center">
            <Package size={32} className="mx-auto text-[#8E8878] mb-3" />
            <p className="text-sm text-[#8E8878]">{t('production', 'batchrv_empty')}</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => (
            <button key={i} onClick={() => load(i)}
              className={`w-8 h-8 rounded-lg text-sm font-medium ${
                page === i ? 'bg-[#1A2B1A] text-white' : 'bg-white border border-gray-200 text-gray-600'
              }`}>{i + 1}</button>
          ))}
        </div>
      )}
    </div>
  );
}
