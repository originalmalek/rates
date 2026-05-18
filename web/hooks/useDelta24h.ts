"use client";

import { useEffect, useState } from "react";
import { seriesKey } from "@/hooks/useWatchlist";
import { BaseSnapshot, RateSnapshot } from "@/lib/types";

const API_BASE = "/api";

export interface SeriesDelta {
  supply: number | null;
  borrow: number | null;
}

export type DeltaMap = Map<string, SeriesDelta>;
export type SparklineMap = Map<string, number[]>;

interface UseDelta24hResult {
  deltas: DeltaMap;
  sparklines: SparklineMap;
  loading: boolean;
}

/**
 * Pull the last 24h of history for all series in a single call and
 * derive two things from it:
 *   - deltas: change in supply / borrow APY (newest − oldest bucket)
 *   - sparklines: ordered supply APY values for an inline mini-chart
 *
 * One request, one cache key on the server. Refreshed every 5 min —
 * 24h windows don't move on every poll.
 */
export function useDelta24h(endpoint: "rates" | "pools"): UseDelta24hResult {
  const [deltas, setDeltas] = useState<DeltaMap>(new Map());
  const [sparklines, setSparklines] = useState<SparklineMap>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const url = `${API_BASE}/${endpoint}/history/all?hours=24&bucket_minutes=60`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const snaps: BaseSnapshot[] = await res.json();
        if (cancelled) return;
        const { deltas: d, sparklines: sp } = reduceHistory(snaps);
        setDeltas(d);
        setSparklines(sp);
      } catch {
        // Δ / sparkline are non-critical; keep the previous map.
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    const id = setInterval(run, 5 * 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [endpoint]);

  return { deltas, sparklines, loading };
}

function reduceHistory(snaps: BaseSnapshot[]): {
  deltas: DeltaMap;
  sparklines: SparklineMap;
} {
  // Group all points per series.
  const byKey = new Map<string, BaseSnapshot[]>();
  for (const s of snaps) {
    const key = seriesKey(s.meta.protocol, s.meta.chain, s.meta.asset);
    const arr = byKey.get(key);
    if (arr) arr.push(s);
    else byKey.set(key, [s]);
  }

  const deltas: DeltaMap = new Map();
  const sparklines: SparklineMap = new Map();
  for (const [key, arr] of byKey) {
    arr.sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));
    const first = arr[0];
    const last = arr[arr.length - 1];

    const supplyDelta =
      first.supply_apy !== null && last.supply_apy !== null
        ? last.supply_apy - first.supply_apy
        : null;
    const firstBorrow = (first as RateSnapshot).borrow_apy;
    const lastBorrow = (last as RateSnapshot).borrow_apy;
    const borrowDelta =
      firstBorrow !== null && firstBorrow !== undefined &&
      lastBorrow !== null && lastBorrow !== undefined
        ? lastBorrow - firstBorrow
        : null;
    deltas.set(key, { supply: supplyDelta, borrow: borrowDelta });

    const supplyValues = arr
      .map((s) => s.supply_apy)
      .filter((v): v is number => v !== null);
    if (supplyValues.length >= 2) sparklines.set(key, supplyValues);
  }
  return { deltas, sparklines };
}
