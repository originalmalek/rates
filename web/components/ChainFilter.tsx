"use client";

import { formatChain } from "@/lib/format";
import { chainColor } from "@/lib/chainColors";

interface Props {
  available: string[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}

export default function ChainFilter({ available, selected, onChange }: Props) {
  if (available.length === 0) return null;

  const allSelected = available.every((c) => selected.has(c));
  const noneSelected = selected.size === 0;

  function toggle(chain: string) {
    const next = new Set(selected);
    if (next.has(chain)) next.delete(chain);
    else next.add(chain);
    onChange(next);
  }

  function selectAll() {
    onChange(new Set(available));
  }

  function selectNone() {
    onChange(new Set());
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[11px] uppercase tracking-wider text-zinc-500 mr-1">
        Chains
      </span>
      {available.map((chain) => {
        const isOn = selected.has(chain);
        const color = chainColor(chain);
        return (
          <button
            key={chain}
            type="button"
            onClick={() => toggle(chain)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-colors ${
              isOn
                ? "bg-zinc-800 border-zinc-700 text-zinc-100"
                : "bg-transparent border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700"
            }`}
          >
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ backgroundColor: isOn ? color : "#3f3f46" }}
            />
            {formatChain(chain)}
          </button>
        );
      })}
      <span className="ml-auto flex items-center gap-1.5">
        <button
          type="button"
          onClick={selectAll}
          disabled={allSelected}
          className="text-[11px] uppercase tracking-wider text-zinc-500 hover:text-zinc-300 disabled:opacity-40 disabled:hover:text-zinc-500 px-2 py-1"
        >
          All
        </button>
        <span className="text-zinc-700">·</span>
        <button
          type="button"
          onClick={selectNone}
          disabled={noneSelected}
          className="text-[11px] uppercase tracking-wider text-zinc-500 hover:text-zinc-300 disabled:opacity-40 disabled:hover:text-zinc-500 px-2 py-1"
        >
          None
        </button>
      </span>
    </div>
  );
}
