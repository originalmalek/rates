"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import DeltaBadge from "@/components/DeltaBadge";
import WatchStar from "@/components/WatchStar";
import { DeltaMap } from "@/hooks/useDelta24h";
import { seriesKey, useWatchlist } from "@/hooks/useWatchlist";
import { PoolSnapshot } from "@/lib/types";
import { formatProtocol, formatTvl, formatApy, formatChain } from "@/lib/format";
import { chainColor } from "@/lib/chainColors";

function seriesHref(snap: PoolSnapshot): string {
  const p = new URLSearchParams({
    protocol: snap.meta.protocol,
    chain: snap.meta.chain,
    asset: snap.meta.asset,
  });
  return `/pools/series?${p.toString()}`;
}

type SortKey = "supply_apy" | "tvl_usd";
type SortDir = "desc" | "asc";
type SortState = { key: SortKey; dir: SortDir } | null;

interface Props {
  snapshots: PoolSnapshot[];
  deltas?: DeltaMap;
}

function tvlSort(rows: PoolSnapshot[]): PoolSnapshot[] {
  return [...rows].sort((a, b) => (b.tvl_usd ?? 0) - (a.tvl_usd ?? 0));
}

function flatSort(rows: PoolSnapshot[], sort: SortState): PoolSnapshot[] {
  if (sort === null) return tvlSort(rows);
  const { key, dir } = sort;
  const sign = dir === "desc" ? -1 : 1;
  return [...rows].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    return (av - bv) * sign;
  });
}

function ChainBadge({ chain }: { chain: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-zinc-300">
      <span
        className="inline-block w-2 h-2 rounded-full"
        style={{ backgroundColor: chainColor(chain) }}
      />
      {formatChain(chain)}
    </span>
  );
}

function PoolSymbol({ symbol }: { symbol: string }) {
  const tokens = symbol.split("-");
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {tokens.map((token, i) => (
        <span key={`${token}-${i}`} className="flex items-center gap-1">
          <span className="font-medium text-zinc-200">{token}</span>
          {i < tokens.length - 1 && (
            <span className="text-zinc-600">·</span>
          )}
        </span>
      ))}
    </span>
  );
}

function nextSort(current: SortState, key: SortKey): SortState {
  if (current === null || current.key !== key) return { key, dir: "desc" };
  if (current.dir === "desc") return { key, dir: "asc" };
  return null;
}

function SortableHeader({
  label,
  sortKey,
  state,
  onClick,
  align = "left",
  color,
}: {
  label: string;
  sortKey: SortKey;
  state: SortState;
  onClick: (k: SortKey) => void;
  align?: "left" | "right";
  color?: string;
}) {
  const active = state?.key === sortKey;
  const indicator = !active ? "" : state.dir === "desc" ? "▾" : "▴";
  return (
    <th
      className={`px-5 py-3 font-medium ${align === "right" ? "text-right" : "text-left"}`}
    >
      <button
        type="button"
        onClick={() => onClick(sortKey)}
        className={`inline-flex items-center gap-1 cursor-pointer select-none transition-colors hover:text-zinc-200 ${
          active ? "text-zinc-200" : color ?? ""
        }`}
      >
        <span>{label}</span>
        <span className="w-2 text-[10px] leading-none">{indicator}</span>
      </button>
    </th>
  );
}

export default function PoolsTable({ snapshots, deltas }: Props) {
  const router = useRouter();
  const watch = useWatchlist();
  const [sort, setSort] = useState<SortState>(null);

  if (snapshots.length === 0) {
    return (
      <p className="text-center text-zinc-600 py-8 text-sm">
        No pools available.
      </p>
    );
  }

  function onHeaderClick(key: SortKey) {
    setSort((cur) => nextSort(cur, key));
  }

  const rows = flatSort(snapshots, sort);

  return (
    <div className="w-full min-w-0 overflow-x-auto rounded-xl border border-zinc-800 bg-[var(--surface)]">
      <table className="w-full min-w-[600px] text-sm">
        <thead>
          <tr className="text-zinc-500 uppercase text-[11px] tracking-wider">
            <th className="pl-4 pr-1 py-3 font-medium text-left w-6" aria-label="Watchlist" />
            <th className="px-5 py-3 font-medium text-left">Protocol</th>
            <th className="px-5 py-3 font-medium text-left">Chain</th>
            <th className="px-5 py-3 font-medium text-left">Pool</th>
            <SortableHeader
              label="APY"
              sortKey="supply_apy"
              state={sort}
              onClick={onHeaderClick}
              color="text-emerald-400/90"
            />
            <SortableHeader
              label="TVL"
              sortKey="tvl_usd"
              state={sort}
              onClick={onHeaderClick}
              align="right"
            />
          </tr>
        </thead>
        <tbody>
          {rows.map((snap, i) => {
            const key = seriesKey(snap.meta.protocol, snap.meta.chain, snap.meta.asset);
            const starred = watch.has(key);
            return (
            <tr
              key={`${snap.meta.protocol}-${snap.meta.chain}-${snap.meta.asset}-${i}`}
              role="link"
              tabIndex={0}
              onClick={() => router.push(seriesHref(snap))}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  router.push(seriesHref(snap));
                }
              }}
              className={`border-t border-zinc-800/60 transition-colors cursor-pointer ${
                starred
                  ? "bg-amber-500/[0.04] hover:bg-amber-500/[0.08]"
                  : "hover:bg-zinc-800/30"
              }`}
            >
              <td className="pl-4 pr-1 py-3 w-6">
                <WatchStar active={watch.has(key)} onToggle={() => watch.toggle(key)} />
              </td>
              <td className="px-5 py-3 font-medium text-zinc-200">
                {formatProtocol(snap.meta.protocol)}
              </td>
              <td className="px-5 py-3">
                <ChainBadge chain={snap.meta.chain} />
              </td>
              <td className="px-5 py-3">
                <PoolSymbol symbol={snap.meta.asset} />
              </td>
              <td className="px-5 py-3 font-mono tabular-nums text-emerald-400">
                {formatApy(snap.supply_apy)}
                <DeltaBadge delta={deltas?.get(key)?.supply ?? null} />
              </td>
              <td className="px-5 py-3 font-mono tabular-nums text-right text-zinc-400">
                {formatTvl(snap.tvl_usd)}
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
