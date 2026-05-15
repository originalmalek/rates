import { BaseSnapshot } from "@/lib/types";
import { formatProtocol, formatChain } from "@/lib/format";

export interface ChartSeries {
  key: string;
  label: string;
}

export interface ChartDataPoint {
  ts: number; // epoch ms
  [seriesKey: string]: number | null | undefined;
}

const LINE_COLORS = [
  "#60a5fa", // blue-400
  "#34d399", // emerald-400
  "#f87171", // red-400
  "#a78bfa", // violet-400
  "#fbbf24", // amber-400
  "#22d3ee", // cyan-400
  "#f472b6", // pink-400
  "#a3e635", // lime-400
  "#fb923c", // orange-400
  "#c084fc", // purple-400
  "#38bdf8", // sky-400
  "#4ade80", // green-400
  "#fcd34d", // amber-300
  "#67e8f9", // cyan-300
  "#f9a8d4", // pink-300
  "#86efac", // green-300
  "#bef264", // lime-300
  "#fdba74", // orange-300
  "#d8b4fe", // purple-300
  "#7dd3fc", // sky-300
];

const MAX_SERIES = 20;

function seriesKey(snap: BaseSnapshot): string {
  return `${snap.meta.protocol}__${snap.meta.chain}__${snap.meta.asset}`;
}

function seriesLabel(key: string): string {
  const [protocol, chain, asset] = key.split("__");
  return `${formatProtocol(protocol)} ${asset} · ${formatChain(chain)}`;
}

export function buildChartData(snapshots: BaseSnapshot[]): {
  series: (ChartSeries & { color: string })[];
  points: ChartDataPoint[];
  truncated: boolean;
} {
  // Pick top series by average TVL (fallback to count) to cap the
  // chart at a readable number of lines.
  const tvlSum = new Map<string, { tvl: number; count: number }>();
  for (const snap of snapshots) {
    const key = seriesKey(snap);
    const e = tvlSum.get(key) ?? { tvl: 0, count: 0 };
    e.tvl += snap.tvl_usd ?? 0;
    e.count += 1;
    tvlSum.set(key, e);
  }

  const ranked = Array.from(tvlSum.entries())
    .map(([key, v]) => ({ key, avgTvl: v.count > 0 ? v.tvl / v.count : 0 }))
    .sort((a, b) => b.avgTvl - a.avgTvl);

  const truncated = ranked.length > MAX_SERIES;
  const topKeys = new Set(ranked.slice(0, MAX_SERIES).map((r) => r.key));

  const seriesKeys = Array.from(topKeys).sort();
  const series = seriesKeys.map((key, i) => ({
    key,
    label: seriesLabel(key),
    color: LINE_COLORS[i % LINE_COLORS.length],
  }));

  // Build points only for top series
  const byTs = new Map<number, ChartDataPoint>();
  for (const snap of snapshots) {
    const key = seriesKey(snap);
    if (!topKeys.has(key)) continue;
    const ts = new Date(snap.ts).getTime();
    if (!byTs.has(ts)) byTs.set(ts, { ts });
    byTs.get(ts)![key] = snap.supply_apy;
  }

  const points = Array.from(byTs.values()).sort((a, b) => a.ts - b.ts);
  return { series, points, truncated };
}
