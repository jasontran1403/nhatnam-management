// src/pages/factory_accountant/FactoryAccountantWarehousePage.jsx
// Kế toán kho xưởng — page "Kho" chứa 4 tab:
//   1. Kho thành phẩm
//   2. Kho nguyên liệu
//   3. Phiếu chuyển kho bán thành phẩm
//   4. Biên bản hao hụt đóng gói
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Package, FlaskConical, ArrowRightLeft, FileWarning } from 'lucide-react';
import FactoryFinishedGoodsPage from '../factory_worker/FactoryFinishedGoodsPage';
import FactoryMaterialStockPage from '../factory_worker/FactoryMaterialStockPage';
import FactoryAccountantTransfersPage from './FactoryAccountantTransfersPage';
import PackagingLossReportsPage from './PackagingLossReportsPage';

const TABS = [
  { key: 'finished',  label: 'Kho thành phẩm',          icon: Package },
  { key: 'material',  label: 'Kho nguyên liệu',         icon: FlaskConical },
  { key: 'transfers', label: 'Phiếu chuyển kho bán TP',  icon: ArrowRightLeft },
  { key: 'loss',      label: 'BB hao hụt đóng gói',      icon: FileWarning },
];

export default function FactoryAccountantWarehousePage() {
  const [searchParams] = useSearchParams();
  const initialTab = TABS.find(t => t.key === searchParams.get('tab')) ? searchParams.get('tab') : 'finished';
  const [tab, setTab] = useState(initialTab);

  return (
    <div className="flex flex-col" style={{ minHeight: '80dvh' }}>
      {/* Tab bar */}
      <div className="px-4 pt-3 pb-0 shrink-0 overflow-x-auto">
        <div className="flex gap-1 bg-canvas rounded-xl p-1 border border-line-soft w-fit">
          {TABS.map(t => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition whitespace-nowrap
                  ${active ? 'bg-gold text-white shadow-sm' : 'text-muted hover:text-ink hover:bg-surface'}`}>
                <Icon size={15} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0">
        {tab === 'finished'  && <FactoryFinishedGoodsPage />}
        {tab === 'material'  && <FactoryMaterialStockPage />}
        {tab === 'transfers' && <FactoryAccountantTransfersPage />}
        {tab === 'loss'      && <PackagingLossReportsPage />}
      </div>
    </div>
  );
}