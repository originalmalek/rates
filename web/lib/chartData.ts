import { RateSnapshot } from "@/lib/types";
import { formatProtocol } from "@/lib/format";

export interface ChartSeries {
  key: string;
  label: string;
}

export interface ChartDataPoint {
  ts: number; // epoch ms
  [seriesKey: string]: number | null | undefined;
}

const LINE_COLORS = [
  "#2563eb", // blue-600
  "#16a34a", // green-600
  "#dc2626", // red-600
  "#9333ea", // purple-600
  "#d97706", // amber-600
  "#0891b2", // cyan-600
  "#db2777", // pink-600
  "#65a30d", // lime-600
  "#ea580c", // orange-600
  "#7c3aed", // violet-600
  "#0284c7", // sky-600
  "#15803d", // green-700
];

export function buildChartData(snapshots: RateSnapshot[]): {
  series: (ChartSeries & { color: string })[];
  points: ChartDataPoint[];
} {
  // Collect all unique series keys (protocol+asset)
  const seriesKeySet = new Set<string>();
  for (const snap of snapshots) {
    const key = `${snap.meta.protocol}__${snap.meta.asset}`;
    seriesKeySet.add(key);
  }

  const seriesKeys = Array.from(seriesKeySet).sort();
  const series = seriesKeys.map((key, i) => {
    const [protocol, asset] = key.split("__");
    return {
      key,
      label: `${formatProtocol(protocol)} ${asset}`,
      color: LINE_COLORS[i % LINE_COLORS.length],
    };
  });

  // Build a map: ts (rounded to minute) -> { seriesKey -> supply_apy }
  const byTs = new Map<number, ChartDataPoint>();

  for (const snap of snapshots) {
    const ts = new Date(snap.ts).getTime();
    const key = `${snap.meta.protocol}__${snap.meta.asset}`;

    if (!byTs.has(ts)) byTs.set(ts, { ts });
    const point = byTs.get(ts)!;
    point[key] = snap.supply_apy;
  }

  const points = Array.from(byTs.values()).sort((a, b) => a.ts - b.ts);

  return { series, points };
}
