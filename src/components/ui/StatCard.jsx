import { TrendingUp, TrendingDown } from 'lucide-react';

export default function StatCard({ label, value, icon: Icon, changePercent, loading, accent = 'gold' }) {
  const accentMap = {
    gold:   'from-[#C9A84C]/15 to-[#C9A84C]/5 text-[#C9A84C] ring-[#C9A84C]/20',
    blue:   'from-blue-500/15 to-blue-500/5 text-blue-600 ring-blue-500/20',
    green:  'from-emerald-500/15 to-emerald-500/5 text-emerald-600 ring-emerald-500/20',
    purple: 'from-violet-500/15 to-violet-500/5 text-violet-600 ring-violet-500/20',
  };

  const showChange = typeof changePercent === 'number';
  const up = (changePercent ?? 0) >= 0;

  return (
    <div className="bg-white rounded-2xl border border-black/5 p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-widest text-[#8E8878] font-semibold truncate">{label}</p>
          <div className="mt-2">
            {loading ? (
              <div className="h-7 w-24 rounded bg-[#FAF7F2] animate-pulse" />
            ) : (
              <p className="text-2xl font-bold text-[#1C1C1E] leading-tight truncate">{value}</p>
            )}
          </div>
          {showChange && !loading && (
            <div className={`mt-2 inline-flex items-center gap-1 text-xs font-medium ${up ? 'text-emerald-600' : 'text-red-600'}`}>
              {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {up ? '+' : ''}{changePercent.toFixed(1)}% so hôm qua
            </div>
          )}
        </div>
        {Icon && (
          <div className={`shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br ring-1 flex items-center justify-center ${accentMap[accent]}`}>
            <Icon size={20} />
          </div>
        )}
      </div>
    </div>
  );
}
