"use client";

import { RateSnapshot } from "@/lib/types";
import { formatProtocol, formatTvl, formatApy } from "@/lib/format";

const ASSET_ORDER = ["USDC", "USDT", "DAI", "USDS", "sDAI"];

interface Props {
  snapshots: RateSnapshot[];
}

function sortByTvl(rows: RateSnapshot[]): RateSnapshot[] {
  return [...rows].sort((a, b) => (b.tvl_usd ?? 0) - (a.tvl_usd ?? 0));
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

export default function RatesTable({ snapshots }: Props) {
  const groups = groupByAsset(snapshots);
  const assets = orderedAssets(groups);

  if (snapshots.length === 0) {
    return (
      <p className="text-center text-zinc-600 py-8 text-sm">
        No data available.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-[var(--surface)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-zinc-500 uppercase text-[11px] tracking-wider">
            <th className="px-5 py-3 font-medium w-[42%]">Protocol</th>
            <th className="px-5 py-3 font-medium text-emerald-400/90">
              Supply APY
            </th>
            <th className="px-5 py-3 font-medium text-amber-400/90">
              Borrow APY
            </th>
            <th className="px-5 py-3 font-medium text-right">TVL</th>
          </tr>
        </thead>
        <tbody>
          {assets.map((asset) => {
            const rows = sortByTvl(groups.get(asset)!);
            return (
              <AssetSection key={asset} asset={asset} rows={rows} />
            );
          })}
        </tbody>
      </table>
    </div>
  );
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
          colSpan={4}
          className="px-5 py-2 text-[11px] font-semibold text-zinc-300 uppercase tracking-wider"
        >
          {asset}
        </td>
      </tr>
      {rows.map((snap) => (
        <tr
          key={`${snap.meta.protocol}-${snap.meta.chain}-${snap.meta.asset}`}
          className="border-t border-zinc-800/60 hover:bg-zinc-800/30 transition-colors"
        >
          <td className="px-5 py-3 font-medium text-zinc-200">
            {formatProtocol(snap.meta.protocol)}
          </td>
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
      ))}
    </>
  );
}
