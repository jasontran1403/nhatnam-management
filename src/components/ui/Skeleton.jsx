/**
 * Skeleton — reusable loading placeholders.
 * Dùng thay LoadingSpinner khi muốn giữ layout shape trong khi fetch.
 */

// Base pulse block
export function Sk({ className = '', style }) {
  return (
    <div
      className={`bg-[#F0EBE3] animate-pulse rounded-xl ${className}`}
      style={style}
    />
  );
}

// StatCard skeleton — khớp shape của StatCard
export function StatCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-black/5 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2.5">
          <Sk className="h-2.5 w-20" />
          <Sk className="h-7 w-28" />
          <Sk className="h-2.5 w-14" />
        </div>
        <Sk className="w-11 h-11 flex-shrink-0" />
      </div>
    </div>
  );
}

// Table row skeleton
export function TableRowSkeleton({ cols = 4, rows = 5 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="border-t border-black/5">
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="px-4 py-3">
              <Sk className="h-4" style={{ width: `${60 + Math.random() * 40}%` }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// Full table skeleton (includes thead placeholder)
export function TableSkeleton({ cols = 4, rows = 6 }) {
  return (
    <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-black/5 bg-[#FAF7F2] flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Sk key={i} className="h-3" style={{ width: `${50 + i * 15}px` }} />
        ))}
      </div>
      <table className="w-full">
        <tbody><TableRowSkeleton cols={cols} rows={rows} /></tbody>
      </table>
    </div>
  );
}

// Card skeleton (generic)
export function CardSkeleton({ lines = 3, className = '' }) {
  return (
    <div className={`bg-white rounded-2xl border border-black/5 p-5 shadow-sm space-y-3 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Sk key={i} className="h-4" style={{ width: i === 0 ? '60%' : i === lines - 1 ? '40%' : '85%' }} />
      ))}
    </div>
  );
}

// Chart skeleton
export function ChartSkeleton({ height = 260, title = true }) {
  return (
    <div className="bg-white rounded-2xl border border-black/5 p-5 shadow-sm">
      {title && <Sk className="h-5 w-44 mb-5" />}
      <Sk className="w-full rounded-xl" style={{ height }} />
    </div>
  );
}

// Page header skeleton
export function PageHeaderSkeleton() {
  return (
    <div className="flex items-start gap-3">
      <Sk className="w-10 h-10 flex-shrink-0" />
      <div className="space-y-2">
        <Sk className="h-7 w-48" />
        <Sk className="h-4 w-64" />
      </div>
    </div>
  );
}
