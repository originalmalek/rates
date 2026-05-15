"use client";

import Link from "next/link";
import { BaseSnapshot } from "@/lib/types";
import { chainColor } from "@/lib/chainColors";
import { formatApy, formatChain, formatProtocol, formatTvl } from "@/lib/format";

interface Props {
  snap: BaseSnapshot;
  href: string;
  badge?: string;
}

function PoolLabel({ asset }: { asset: string }) {
  const tokens = asset.split("-");
  if (tokens.length === 1) return <span>{tokens[0]}</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {tokens.map((t, i) => (
        <span key={`${t}-${i}`} className="inline-flex items-center gap-1">
          <span>{t}</span>
          {i < tokens.length - 1 && <span className="text-zinc-600 font-normal">·</span>}
        </span>
      ))}
    </span>
  );
}

export default function RateCard({ snap, href, badge }: Props) {
  const color = chainColor(snap.meta.chain);
  return (
    <Link
      href={href}
      className="group snap-start shrink-0 w-[220px] sm:w-[240px] rounded-xl border border-zinc-800 bg-[var(--surface)] hover:bg-[var(--surface-2)] hover:border-zinc-700 transition-colors p-4 flex flex-col"
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="text-lg font-semibold text-zinc-100 tracking-tight leading-tight truncate">
          <PoolLabel asset={snap.meta.asset} />
        </div>
        {badge && (
          <span className="text-[10px] uppercase tracking-wider text-zinc-500 mt-1 whitespace-nowrap">
            {badge}
          </span>
        )}
      </div>
      <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-0.5">
        Supply APY
      </div>
      <div className="text-2xl font-mono tabular-nums text-emerald-400 leading-none mb-3">
        {formatApy(snap.supply_apy)}
      </div>
      <div className="mt-auto pt-3 border-t border-zinc-800/80 flex flex-col gap-1">
        <div className="text-sm text-zinc-300 font-medium truncate">
          {formatProtocol(snap.meta.protocol)}
        </div>
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 text-zinc-400 min-w-0">
            <span
              className="inline-block w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: color }}
            />
            <span className="truncate">{formatChain(snap.meta.chain)}</span>
          </span>
          <span className="font-mono tabular-nums text-zinc-500 shrink-0">
            {formatTvl(snap.tvl_usd)}
          </span>
        </div>
      </div>
    </Link>
  );
}
