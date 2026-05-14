"use client";

interface Props {
  page: number;
  perPage: number;
  total: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ page, perPage, total, onPageChange }: Props) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  if (totalPages <= 1) return null;

  const canPrev = page > 1;
  const canNext = page < totalPages;
  const firstRow = (page - 1) * perPage + 1;
  const lastRow = Math.min(page * perPage, total);

  return (
    <div className="flex items-center justify-between gap-3 mt-3 text-xs text-zinc-500">
      <span>
        {firstRow.toLocaleString()}–{lastRow.toLocaleString()} of{" "}
        {total.toLocaleString()}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={!canPrev}
          className="px-2 py-1 rounded border border-zinc-800 hover:bg-zinc-800/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          ← Prev
        </button>
        <span className="px-2 text-zinc-400">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={!canNext}
          className="px-2 py-1 rounded border border-zinc-800 hover:bg-zinc-800/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
