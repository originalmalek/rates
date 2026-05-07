"use client";

import { useMemo, useState } from "react";

interface Props {
  available: string[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}

export default function AssetFilter({
  available,
  selected,
  onChange,
}: Props) {
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    if (!query.trim()) return available;
    const q = query.trim().toLowerCase();
    return available.filter((a) => a.toLowerCase().includes(q));
  }, [available, query]);

  if (available.length === 0) return null;

  const allSelected = available.every((a) => selected.has(a));
  const noneSelected = selected.size === 0;

  function toggle(asset: string) {
    const next = new Set(selected);
    if (next.has(asset)) next.delete(asset);
    else next.add(asset);
    onChange(next);
  }

  function selectVisible() {
    const next = new Set(selected);
    for (const a of visible) next.add(a);
    onChange(next);
  }

  function deselectVisible() {
    const next = new Set(selected);
    for (const a of visible) next.delete(a);
    onChange(next);
  }

  const showVisibleControls = query.trim().length > 0 && visible.length > 0;

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <span className="text-[11px] uppercase tracking-wider text-zinc-500">
          Stablecoins
          <span className="ml-1.5 normal-case text-zinc-600">
            ({selected.size}/{available.length})
          </span>
        </span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by symbol…"
          className="flex-1 max-w-xs text-xs bg-zinc-900 border border-zinc-800 rounded-md px-2 py-1 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600"
        />
        <span className="ml-auto flex items-center gap-1.5">
          {showVisibleControls && (
            <>
              <button
                type="button"
                onClick={selectVisible}
                className="text-[11px] uppercase tracking-wider text-zinc-500 hover:text-zinc-300 px-2 py-1"
              >
                + visible
              </button>
              <button
                type="button"
                onClick={deselectVisible}
                className="text-[11px] uppercase tracking-wider text-zinc-500 hover:text-zinc-300 px-2 py-1"
              >
                − visible
              </button>
              <span className="text-zinc-700">·</span>
            </>
          )}
          <button
            type="button"
            onClick={() => onChange(new Set(available))}
            disabled={allSelected}
            className="text-[11px] uppercase tracking-wider text-zinc-500 hover:text-zinc-300 disabled:opacity-40 disabled:hover:text-zinc-500 px-2 py-1"
          >
            All
          </button>
          <span className="text-zinc-700">·</span>
          <button
            type="button"
            onClick={() => onChange(new Set())}
            disabled={noneSelected}
            className="text-[11px] uppercase tracking-wider text-zinc-500 hover:text-zinc-300 disabled:opacity-40 disabled:hover:text-zinc-500 px-2 py-1"
          >
            None
          </button>
        </span>
      </div>
      <div className="max-h-32 overflow-y-auto rounded-md border border-zinc-800 bg-zinc-900/40 p-2">
        {visible.length === 0 ? (
          <p className="text-xs text-zinc-600 px-1 py-2">No matches.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {visible.map((asset) => {
              const isOn = selected.has(asset);
              return (
                <button
                  key={asset}
                  type="button"
                  onClick={() => toggle(asset)}
                  className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono border transition-colors ${
                    isOn
                      ? "bg-zinc-800 border-zinc-700 text-zinc-100"
                      : "bg-transparent border-zinc-800/60 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700"
                  }`}
                >
                  {asset}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
