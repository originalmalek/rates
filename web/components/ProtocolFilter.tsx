"use client";

import { formatProtocol } from "@/lib/format";

interface Props {
  available: string[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}

export default function ProtocolFilter({
  available,
  selected,
  onChange,
}: Props) {
  if (available.length === 0) return null;

  const allSelected = available.every((p) => selected.has(p));
  const noneSelected = selected.size === 0;

  function toggle(protocol: string) {
    const next = new Set(selected);
    if (next.has(protocol)) next.delete(protocol);
    else next.add(protocol);
    onChange(next);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[11px] uppercase tracking-wider text-zinc-500 mr-1">
        Protocols
      </span>
      {available.map((protocol) => {
        const isOn = selected.has(protocol);
        return (
          <button
            key={protocol}
            type="button"
            onClick={() => toggle(protocol)}
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs border transition-colors ${
              isOn
                ? "bg-zinc-800 border-zinc-700 text-zinc-100"
                : "bg-transparent border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700"
            }`}
          >
            {formatProtocol(protocol)}
          </button>
        );
      })}
      <span className="ml-auto flex items-center gap-1.5">
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
  );
}
