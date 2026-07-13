// src/pages/factory_accountant/PackagingLossReportsPage.jsx
// Biên bản hao hụt đóng gói (Bước 4) — tự động sinh khi kế toán kho xác nhận
// nhận phiếu chuyển kho mà có chênh lệch (kg chuyển > kg thực cân). Trang này
// chỉ xem (read-only) — dùng chung cho FACTORY_ACCOUNTANT và OWNER.
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileWarning, Search, Printer, ChevronLeft } from 'lucide-react';
import useMinLoading from '../../hooks/useMinLoading.js';
import { CardSkeleton } from '../../components/ui/Skeleton.jsx';
import { semiFinishedGoodsApi, factoryProdApi } from '../../api/productionModuleApi';
import { useLang } from '../../context/LangContext';
import { useFmt } from '../../utils/useFmt';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/common/Toast.jsx';
import { downloadBlob } from '../../utils/downloadBlob';

function fmtQty(v) {
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 }).format(Number(v || 0));
}

function fmtDateTime(ms) {
  if (!ms) return '—';
  return new Date(Number(ms)).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function PackagingLossReportsPage() {
  const { role } = useAuth();
  const { t } = useLang();
  const { fmtNum, fmtDateTime } = useFmt();
  const fmtQty = v => fmtNum(v,3);
  const isOwner = role === 'OWNER';
  const navigate = useNavigate();
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useMinLoading();
  const [search, setSearch] = useState('');
  const [printingId, setPrintingId] = useState(null);
  const [factories, setFactories] = useState([]);
  const [factoryId, setFactoryId] = useState(null);

  useEffect(() => {
    factoryProdApi.listMyFactories().then(list => {
      const active = (list || []).filter(f => f.status === 'ACTIVE');
      setFactories(active);
      if (active.length >= 1) setFactoryId(active[0].id);
    }).catch(() => {});
  }, []);

  const load = () => {
    setLoading(true);
    const fetcher = isOwner ? semiFinishedGoodsApi.listLossReportsForOwner : semiFinishedGoodsApi.listLossReportsForAccountant;
    fetcher(search || undefined, 0, 50)
      .then(d => setItems(d || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []); // eslint-disable-line
  useEffect(() => {
    const t = setTimeout(load, 400);
    return () => clearTimeout(t);
  }, [search]); // eslint-disable-line

  const printLossReport = async (report) => {
    if (printingId) return;
    setPrintingId(report.id);
    try {
      const exportFn = isOwner ? semiFinishedGoodsApi.exportLossReportForOwner : semiFinishedGoodsApi.exportLossReportForAccountant;
      const res = await exportFn(report.id);
      downloadBlob(res.data, `bien-ban-hao-hut-${report.reportCode}.xlsx`);
    } catch (e) {
      toast(e?.response?.data?.message || 'Không thể in biên bản', 'error');
    } finally { setPrintingId(null); }
  };

  const totalLoss = items.reduce((acc, r) => acc + Number(r.lossQty || 0), 0);

  return (
    <div className="p-4 space-y-4 bg-[#F5F0EB] min-h-full">
      {isOwner && (
        <button onClick={() => navigate('/owner/production')}
          className="flex items-center gap-1.5 text-sm text-[#8E8878] hover:text-[#1C1C1E] font-medium">
          <ChevronLeft size={16} /> {t('production','loss_back_to_production')}
        </button>
      )}

      {factories.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#8E8878] font-medium">{t('production','mstock_factory_label')}:</span>
          <select className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-[#E8DDD0] bg-white text-[#1C1C1E] focus:outline-none focus:border-[#C9A84C]"
            value={factoryId || ''} onChange={e => setFactoryId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">{t('common','all')}</option>
            {factories.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
      )}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#1C1C1E]">{t('production','loss_title')}</h1>
      </div>

      <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-4">
        <p className="text-xs text-[#8E8878]">{t('production','loss_total_label')}</p>
        <p className="text-2xl font-bold text-amber-700 mt-1">{fmtQty(totalLoss)} Kg</p>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8878]" />
        <input
          className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-[#E8DDD0]
            focus:outline-none focus:border-[#C9A84C] bg-white placeholder-[#8E8878]"
          placeholder={t('production','loss_search_ph')}
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading
        ? <div className="space-y-3">{[1, 2, 3].map(i => <CardSkeleton key={i} />)}</div>
        : items.length === 0
          ? (
            <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-10 text-center">
              <FileWarning size={32} className="mx-auto text-[#8E8878] mb-2" />
              <p className="text-[#8E8878] text-sm">{t('production','loss_empty')}</p>
            </div>
          )
          : (
            <div className="space-y-3">
              {items.map(r => (
                <div key={r.id} className="bg-white rounded-2xl border border-amber-100 shadow-sm p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-mono font-semibold text-sm text-[#1C1C1E]">{r.reportCode}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[#8E8878]">Phiếu: {r.transferNoteCode}</span>
                      <button onClick={() => printLossReport(r)} disabled={printingId === r.id}
                        className="flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg hover:bg-amber-100 disabled:opacity-50">
                        <Printer size={11} /> {printingId === r.id ? 'Đang xuất...' : 'In biên bản'}
                      </button>
                    </div>
                  </div>
                  <p className="font-semibold text-[#1C1C1E] mt-1">{r.productName}</p>
                  <div className="grid grid-cols-3 gap-2 mt-2 text-sm">
                    <div>
                      <p className="text-[10px] text-[#8E8878]">{t('production','loss_transferred')}</p>
                      <p className="font-semibold text-[#1C1C1E]">{fmtQty(r.transferredQty)} Kg</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[#8E8878]">{t('production','loss_actual_received')}</p>
                      <p className="font-semibold text-[#1C1C1E]">{fmtQty(r.actualReceivedWeight)} Kg</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[#8E8878]">{t('production','loss_loss')}</p>
                      <p className="font-bold text-amber-700">{fmtQty(r.lossQty)} Kg</p>
                    </div>
                  </div>
                  {r.packagedQty != null && (
                    <p className="text-xs text-[#8E8878] mt-2">Đóng gói: {fmtQty(r.packagedQty)} {r.packagedUnit}</p>
                  )}
                  {r.sourceBatchesSnapshot && (
                    <p className="text-xs text-[#8E8878] mt-1">Mẻ nguồn: {r.sourceBatchesSnapshot}</p>
                  )}
                  <p className="text-xs text-[#8E8878] mt-2">{r.recordedByName} · {fmtDateTime(r.createdAt)}</p>
                </div>
              ))}
            </div>
          )
      }
    </div>
  );
}
