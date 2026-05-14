"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { RateSnapshot } from "@/lib/types";
import {
  formatProtocol,
  formatTvl,
  formatApy,
  formatChain,
} from "@/lib/format";
import { chainColor } from "@/lib/chainColors";

function seriesHref(snap: RateSnapshot): string {
  const p = new URLSearchParams({
    protocol: snap.meta.protocol,
    chain: snap.meta.chain,
    asset: snap.meta.asset,
  });
  return `/lending/series?${p.toString()}`;
}

const ASSET_ORDER = ["USDC", "USDT", "DAI", "USDS", "sDAI"];

type SortKey = "supply_apy" | "borrow_apy" | "tvl_usd";
type SortDir = "desc" | "asc";
type SortState = { key: SortKey; dir: SortDir } | null;

interface Props {
  snapshots: RateSnapshot[];
}

function groupSort(rows: RateSnapshot[]): RateSnapshot[] {
  return [...rows].sort((a, b) => {
    const chainCmp = a.meta.chain.localeCompare(b.meta.chain);
    if (chainCmp !== 0) return chainCmp;
    return (b.tvl_usd ?? 0) - (a.tvl_usd ?? 0);
  });
}

function flatSort(rows: RateSnapshot[], sort: SortState): RateSnapshot[] {
  if (sort === null) return rows;
  const { key, dir } = sort;
  const sign = dir === "desc" ? -1 : 1;
  return [...rows].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    // Nulls always sink to the bottom regardless of direction.
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    return (av - bv) * sign;
  });
}

function groupByAsset(snapshots: RateSnapshot[]): Map<string, RateSnapshot[]> {
  const groups = new Map<string, RateSnapshot[]>();
  for (const snap of snapshots) {
    const asset = snap.meta.asset;
    if (!groups.has(asset)) groups.set(asset, []);
    groups.get(asset)!.push(snap);
  }
  return groups;
}

function orderedAssets(groups: Map<string, RateSnapshot[]>): string[] {
  const known = ASSET_ORDER.filter((a) => groups.has(a));
  const rest = Array.from(groups.keys())
    .filter((a) => !ASSET_ORDER.includes(a))
    .sort();
  return [...known, ...rest];
}

function ChainBadge({ chain }: { chain: string }) {
  const color = chainColor(chain);
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-zinc-300">
      <span
        className="inline-block w-2 h-2 rounded-full"
        style={{ backgroundColor: color }}
      />
      {formatChain(chain)}
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

export default function RatesTable({ snapshots }: Props) {
  const [sort, setSort] = useState<SortState>(null);

  if (snapshots.length === 0) {
    return (
      <p className="text-center text-zinc-600 py-8 text-sm">
        No data available.
      </p>
    );
  }

  function onHeaderClick(key: SortKey) {
    setSort((cur) => nextSort(cur, key));
  }

  return (
    <div className="w-full min-w-0 overflow-x-auto rounded-xl border border-zinc-800 bg-[var(--surface)]">
      <table className="min-w-[560px] text-sm">
        <thead>
          <tr className="text-zinc-500 uppercase text-[11px] tracking-wider">
            <th className="px-5 py-3 font-medium text-left">Protocol</th>
            <th className="px-5 py-3 font-medium text-left">Chain</th>
            {sort !== null && (
              <th className="px-5 py-3 font-medium text-left">Asset</th>
            )}
            <SortableHeader
              label="Supply APY"
              sortKey="supply_apy"
              state={sort}
              onClick={onHeaderClick}
              color="text-emerald-400/90"
            />
            <SortableHeader
              label="Borrow APY"
              sortKey="borrow_apy"
              state={sort}
              onClick={onHeaderClick}
              color="text-amber-400/90"
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
          {sort === null
            ? renderGrouped(snapshots)
            : renderFlat(snapshots, sort)}
        </tbody>
      </table>
    </div>
  );
}

function renderGrouped(snapshots: RateSnapshot[]) {
  const groups = groupByAsset(snapshots);
  const assets = orderedAssets(groups);
  return assets.map((asset) => {
    const rows = groupSort(groups.get(asset)!);
    return <AssetSection key={asset} asset={asset} rows={rows} />;
  });
}

function renderFlat(snapshots: RateSnapshot[], sort: SortState) {
  const sorted = flatSort(snapshots, sort);
  return sorted.map((snap, i) => (
    <Row key={`${snap.meta.protocol}-${snap.meta.chain}-${snap.meta.asset}-${i}`}
         snap={snap}
         showAsset />
  ));
}

function AssetSection({
  asset,
  rows,
}: {
  asset: string;
  rows: RateSnapshot[];
}) {
  return (
    <>
      <tr className="border-t border-zinc-800 bg-[var(--surface-2)]">
        <td
          colSpan={5}
          className="px-5 py-2 text-[11px] font-semibold text-zinc-300 uppercase tracking-wider"
        >
          {asset}
          <span className="ml-2 text-zinc-500 normal-case font-normal">
            ({rows.length})
          </span>
        </td>
      </tr>
      {rows.map((snap) => (
        <Row
          key={`${snap.meta.protocol}-${snap.meta.chain}-${snap.meta.asset}`}
          snap={snap}
        />
      ))}
    </>
  );
}

function Row({ snap, showAsset = false }: { snap: RateSnapshot; showAsset?: boolean }) {
  const router = useRouter();
  return (
    <tr
      role="link"
      tabIndex={0}
      onClick={() => router.push(seriesHref(snap))}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push(seriesHref(snap));
        }
      }}
      className="border-t border-zinc-800/60 hover:bg-zinc-800/30 transition-colors cursor-pointer"
    >
      <td className="px-5 py-3 font-medium text-zinc-200">
        {formatProtocol(snap.meta.protocol)}
      </td>
      <td className="px-5 py-3">
        <ChainBadge chain={snap.meta.chain} />
      </td>
      {showAsset && (
        <td className="px-5 py-3 text-zinc-300 font-medium">
          {snap.meta.asset}
        </td>
      )}
      <td className="px-5 py-3 font-mono tabular-nums text-emerald-400">
        {formatApy(snap.supply_apy)}
      </td>
      <td className="px-5 py-3 font-mono tabular-nums text-amber-400">
        {formatApy(snap.borrow_apy)}
      </td>
      <td className="px-5 py-3 font-mono tabular-nums text-right text-zinc-400">
        {formatTvl(snap.tvl_usd)}
      </td>
    </tr>
  );
}
