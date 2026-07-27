"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import DeltaBadge from "@/components/DeltaBadge";
import Sparkline from "@/components/Sparkline";
import WatchStar from "@/components/WatchStar";
import { DeltaMap, SparklineMap } from "@/hooks/useDelta24h";
import { seriesKey, useWatchlist } from "@/hooks/useWatchlist";
import { VaultSnapshot } from "@/lib/types";
import { formatProtocol, formatTvl, formatApy, formatChain } from "@/lib/format";
import { chainColor } from "@/lib/chainColors";

function seriesHref(snap: VaultSnapshot): string {
  // pool_id selects the series; the triple rides along so the detail
  // header can render before the first response arrives.
  const p = new URLSearchParams({
    pool_id: snap.meta.pool_id,
    protocol: snap.meta.protocol,
    chain: snap.meta.chain,
    asset: snap.meta.asset,
  });
  return `/vaults/series?${p.toString()}`;
}

function llamaHref(poolId: string): string {
  return `https://defillama.com/yields/pool/${poolId}`;
}

type SortKey = "supply_apy" | "apy_mean_30d" | "tvl_usd";
type SortDir = "desc" | "asc";
type SortState = { key: SortKey; dir: SortDir } | null;

interface Props {
  snapshots: VaultSnapshot[];
  deltas?: DeltaMap;
  sparklines?: SparklineMap;
}

function tvlSort(rows: VaultSnapshot[]): VaultSnapshot[] {
  return [...rows].sort((a, b) => (b.tvl_usd ?? 0) - (a.tvl_usd ?? 0));
}

function flatSort(rows: VaultSnapshot[], sort: SortState): VaultSnapshot[] {
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

/**
 * The curator's product name plus the stablecoin it actually holds —
 * `STEAKUSDC` and `GTUSDCP` are both USDC vaults, and nothing in the
 * name is guaranteed to say so. The arrow opens DeFi Llama's page for
 * the same pool id, where the full allocation breakdown lives.
 */
function VaultName({ snap }: { snap: VaultSnapshot }) {
  // Roughly half of DeFi Llama's vault symbols are just the underlying
  // ticker (Centrifuge's USDS vault is literally "USDS"), and a "USDS
  // USDS" cell reads like a rendering bug.
  const showAsset = snap.meta.vault_name.toUpperCase() !== snap.meta.asset.toUpperCase();
  return (
    <span className="inline-flex items-center gap-2 min-w-0">
      <span
        className="font-medium text-zinc-200 truncate max-w-[200px]"
        title={snap.meta.vault_name}
      >
        {snap.meta.vault_name}
      </span>
      {showAsset && (
        <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wide bg-zinc-800 text-zinc-400">
          {snap.meta.asset}
        </span>
      )}
      <a
        href={llamaHref(snap.meta.pool_id)}
        target="_blank"
        rel="noopener noreferrer"
        // The whole row is a link; without this the click navigates
        // to the detail page instead of opening DeFi Llama.
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        title="Open on DeFi Llama"
        className="shrink-0 text-zinc-600 hover:text-zinc-300 transition-colors text-xs leading-none"
      >
        ↗
      </a>
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

export default function VaultsTable({ snapshots, deltas, sparklines }: Props) {
  const router = useRouter();
  const watch = useWatchlist();
  const [sort, setSort] = useState<SortState>(null);

  if (snapshots.length === 0) {
    return (
      <p className="text-center text-zinc-600 py-8 text-sm">
        No vaults available.
      </p>
    );
  }

  function onHeaderClick(key: SortKey) {
    setSort((cur) => nextSort(cur, key));
  }

  const rows = flatSort(snapshots, sort);

  return (
    <div className="w-full min-w-0 overflow-x-auto rounded-xl border border-zinc-800 bg-[var(--surface)]">
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="text-zinc-500 uppercase text-[11px] tracking-wider">
            <th className="pl-4 pr-1 py-3 font-medium text-left w-6" aria-label="Watchlist" />
            <th className="px-5 py-3 font-medium text-left">Protocol</th>
            <th className="px-5 py-3 font-medium text-left">Chain</th>
            <th className="px-5 py-3 font-medium text-left">Vault</th>
            <SortableHeader
              label="APY"
              sortKey="supply_apy"
              state={sort}
              onClick={onHeaderClick}
              color="text-emerald-400/90"
            />
            <SortableHeader
              label="30d avg"
              sortKey="apy_mean_30d"
              state={sort}
              onClick={onHeaderClick}
              align="right"
            />
            <SortableHeader
              label="TVL"
              sortKey="tvl_usd"
              state={sort}
              onClick={onHeaderClick}
              align="right"
            />
            <th className="px-2 sm:px-3 py-3 font-medium text-left">
              7d
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((snap) => {
            const key = seriesKey(snap.meta);
            const starred = watch.has(key);
            // Rewards are temporary by nature, so the split is only worth
            // the extra line when there actually is a reward leg.
            const hasReward = snap.apy_reward !== null && snap.apy_reward > 0;
            return (
            <tr
              key={key}
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
                <VaultName snap={snap} />
              </td>
              <td className="px-5 py-3 font-mono tabular-nums text-emerald-400">
                {formatApy(snap.supply_apy)}
                <DeltaBadge delta={deltas?.get(key)?.supply ?? null} />
                {hasReward && (
                  <div className="text-[10px] text-zinc-500 mt-0.5 whitespace-nowrap">
                    {formatApy(snap.apy_base)} + {formatApy(snap.apy_reward)} rwd
                  </div>
                )}
              </td>
              <td className="px-5 py-3 font-mono tabular-nums text-right text-zinc-400">
                {formatApy(snap.apy_mean_30d)}
              </td>
              <td className="px-5 py-3 font-mono tabular-nums text-right text-zinc-400">
                {formatTvl(snap.tvl_usd)}
              </td>
              <td className="px-2 sm:px-3 py-3">
                {(() => {
                  const data = sparklines?.get(key);
                  return data && data.length >= 2 ? (
                    <Sparkline data={data} />
                  ) : (
                    <span className="text-zinc-700 text-xs">—</span>
                  );
                })()}
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
