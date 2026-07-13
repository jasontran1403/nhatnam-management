// FactoryDashboardPage.jsx
import { useState, useEffect } from 'react';
import { Sk, TableSkeleton } from '../../components/ui/Skeleton.jsx';
import useMinLoading from '../../hooks/useMinLoading.js';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ClipboardList, Plus, TrendingUp, TrendingDown, Package } from 'lucide-react';
import { factoryWorkerApi } from '../../api/productionApi';
import { useLang } from '../../context/LangContext';

const fmtDate = (ms) => ms
  ? new Date(ms).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  : '–';

function VarianceBadge({ pct }) {
  const v = parseFloat(pct || 0);
  if (Math.abs(v) < 0.1) return <span className="text-gray-400 text-xs">±0%</span>;
  const up = v > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full ${
      up ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-700'
    }`}>
      {up ? '+' : ''}{v.toFixed(1)}%
    </span>
  );
}

export function FactoryDashboardPage() {
  const { t } = useLang();
  const { user } = useAuth();
  const navigate  = useNavigate();
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useMinLoading();

  useEffect(() => {
    factoryWorkerApi.listMyBatches(0, 5)
      .then(d => setBatches(d?.content || []))
      .finally(() => setLoading(false));
  }, []);

  const stats = {
    total:    batches.length,
    reviewed: batches.filter(b => b.status === 'REVIEWED').length,
    pending:  batches.filter(b => b.status !== 'REVIEWED').length,
  };

  return (
    <div className="p-6 space-y-6 bg-[#F5F0EB] min-h-full">
      {/* Welcome */}
      <div className="bg-[#1A2B1A] rounded-2xl p-6 text-white">
        <p className="text-[#7CB87C] text-xs uppercase tracking-widest font-medium">{t('production','machine_page_factory_label')}</p>
        <h1 className="text-2xl font-bold mt-1">Xin chào, {user?.fullName?.split(' ').pop()}!</h1>
        <p className="text-white/50 text-sm mt-1">{t('production','fw_recent_batches')}</p>
      </div>

      {/* Quick actions */}
      <button onClick={() => navigate('/factory/batches')}
        className="w-full flex items-center justify-between bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:border-[#7CB87C]/40 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#1A2B1A] rounded-xl flex items-center justify-center">
            <Plus size={18} className="text-white" />
          </div>
          <div className="text-left">
            <p className="font-semibold text-gray-900">{t('factory','enter_new_batch')}</p>
            <p className="text-xs text-gray-400">{t('production','fw_record_materials')}</p>
          </div>
        </div>
        <TrendingUp size={18} className="text-gray-300" />
      </button>

      {/* Recent batches */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t('production','fw_recent')}</p>
        {loading && <div className="h-24 flex items-center justify-center"><div className="w-6 h-6 border-2 border-[#7CB87C] border-t-transparent rounded-full animate-spin" /></div>}
        {!loading && batches.length === 0 && (
          <div className="text-center text-gray-400 py-10 text-sm">{t('production','fw_no_batches')}</div>
        )}
        {batches.map(b => (
          <div key={b.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-sm font-semibold text-gray-900">{b.batchCode}</p>
                <p className="text-xs text-gray-500 mt-0.5">{b.productName} · {fmtDate(b.producedAt)}</p>
              </div>
              <div className="text-right">
                <VarianceBadge pct={b.outputVariancePct} />
                <p className="text-xs text-gray-400 mt-1">
                  {b.status === 'REVIEWED' ? '✓ Đã xem' : '⏳ Chờ xem'}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// History Page
// ─────────────────────────────────────────────────────────────────────────────
export function FactoryHistoryPage() {
  const [batches, setBatches]   = useState([]);
  const [page, setPage]         = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useMinLoading();
  const [expanded, setExpanded] = useState(null);

  const load = async (p = 0) => {
    setLoading(true);
    try {
      const d = await factoryWorkerApi.listMyBatches(p, 20);
      setBatches(d?.content || []);
      setTotalPages(d?.totalPages || 0);
      setPage(p);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(0); }, []);

  return (
    <div className="p-6 space-y-4 bg-[#F5F0EB] min-h-full">
      <div>
        <h1 className="text-2xl font-bold text-[#1A2B1A]">{t('production','fw_batch_history')}</h1>
        <p className="text-sm text-gray-500 mt-0.5">{t('production','fw_all_your_batches')}</p>
      </div>

      

      {!loading && batches.map(b => (
        <div key={b.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <button
            className="w-full text-left p-5"
            onClick={() => setExpanded(expanded === b.id ? null : b.id)}>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-gray-900">{b.batchCode}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    b.status === 'REVIEWED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}>{b.status === 'REVIEWED' ? 'Đã xem' : 'Chờ xem'}</span>
                </div>
                <p className="text-sm text-gray-500 mt-0.5">{b.productName} · {b.recipeName}</p>
                <p className="text-xs text-gray-400">{fmtDate(b.producedAt)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold">{b.actualOutputQty} {b.outputUnit}</p>
                <VarianceBadge pct={b.outputVariancePct} />
              </div>
            </div>
          </button>

          {expanded === b.id && b.items && (
            <div className="px-5 pb-5 border-t border-gray-50">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mt-4 mb-3">{t('production','fw_material_detail')}</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400">
                    <th className="text-left pb-2">NVL</th>
                    <th className="text-right pb-2">{t('production','batchrv_col_standard')}</th>
                    <th className="text-right pb-2">{t('production','batchrv_col_actual')}</th>
                    <th className="text-right pb-2">{t('production','batchrv_col_variance')}</th>
                  </tr>
                </thead>
                <tbody>
                  {b.items.map(item => (
                    <tr key={item.id} className="border-t border-gray-50">
                      <td className="py-2 text-gray-800 font-medium">{item.materialName}</td>
                      <td className="py-2 text-right text-gray-400">{item.standardQty} {item.unit}</td>
                      <td className="py-2 text-right">{item.actualQty} {item.unit}</td>
                      <td className="py-2 text-right"><VarianceBadge pct={item.variancePct} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {b.notes && <p className="mt-3 text-xs text-gray-500 italic">{b.notes}</p>}
            </div>
          )}
        </div>
      ))}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 pt-2">
          {Array.from({ length: totalPages }, (_, i) => (
            <button key={i} onClick={() => load(i)}
              className={`w-8 h-8 rounded-lg text-sm font-medium ${
                page === i ? 'bg-[#1A2B1A] text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}>{i + 1}</button>
          ))}
        </div>
      )}
    </div>
  );
}
