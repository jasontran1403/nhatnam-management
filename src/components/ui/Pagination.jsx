import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;

  const go = (p) => {
    if (p < 0 || p >= totalPages || p === page) return;
    onChange?.(p);
  };

  // Show max 5 page numbers
  const pages = [];
  const start = Math.max(0, Math.min(page - 2, totalPages - 5));
  const end = Math.min(totalPages, start + 5);
  for (let i = start; i < end; i++) pages.push(i);

  return (
    <div className="flex items-center justify-center gap-1 py-3">
      <button
        onClick={() => go(page - 1)}
        disabled={page === 0}
        className="p-2 rounded-lg border border-hairline-2 bg-surface hover:bg-canvas disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <ChevronLeft size={16} />
      </button>
      {pages.map((p) => (
        <button
          key={p}
          onClick={() => go(p)}
          className={`min-w-[34px] h-9 px-2 rounded-lg text-sm font-medium transition-colors ${
            p === page
              ? 'bg-gold text-white'
              : 'bg-surface border border-hairline-2 text-ink hover:bg-canvas'
          }`}
        >
          {p + 1}
        </button>
      ))}
      <button
        onClick={() => go(page + 1)}
        disabled={page >= totalPages - 1}
        className="p-2 rounded-lg border border-hairline-2 bg-surface hover:bg-canvas disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
