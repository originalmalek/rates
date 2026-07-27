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
 * Two parallel /history/all calls per endpoint:
 *   - 24h @ 60min buckets → newest vs oldest delta for the badge
 *     under each APY cell.
 *   - 7d @ 6h buckets (~28 points) → ordered supply APY values for
 *     the inline sparkline column.
 *
 * Both refresh every 5 minutes; the responses are cached server-side
 * for 5 minutes so the polling stays cheap.
 */
export function useDelta24h(
  endpoint: "rates" | "pools" | "vaults",
): UseDelta24hResult {
  const [deltas, setDeltas] = useState<DeltaMap>(new Map());
  const [sparklines, setSparklines] = useState<SparklineMap>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const deltaUrl = `${API_BASE}/${endpoint}/history/all?hours=24&bucket_minutes=60`;
        const sparkUrl = `${API_BASE}/${endpoint}/history/all?hours=168&bucket_minutes=360`;
        const [deltaRes, sparkRes] = await Promise.all([
          fetch(deltaUrl),
          fetch(sparkUrl),
        ]);
        if (deltaRes.ok) {
          const snaps: BaseSnapshot[] = await deltaRes.json();
          if (!cancelled) setDeltas(reduceDeltas(snaps));
        }
        if (sparkRes.ok) {
          const snaps: BaseSnapshot[] = await sparkRes.json();
          if (!cancelled) setSparklines(reduceSparklines(snaps));
        }
      } catch {
        // Both maps are non-critical; keep the previous values on error.
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

function groupByKey(snaps: BaseSnapshot[]): Map<string, BaseSnapshot[]> {
  const byKey = new Map<string, BaseSnapshot[]>();
  for (const s of snaps) {
    const key = seriesKey(s.meta);
    const arr = byKey.get(key);
    if (arr) arr.push(s);
    else byKey.set(key, [s]);
  }
  for (const arr of byKey.values()) {
    arr.sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));
  }
  return byKey;
}

function reduceDeltas(snaps: BaseSnapshot[]): DeltaMap {
  const byKey = groupByKey(snaps);
  const out: DeltaMap = new Map();
  for (const [key, arr] of byKey) {
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
    out.set(key, { supply: supplyDelta, borrow: borrowDelta });
  }
  return out;
}

function reduceSparklines(snaps: BaseSnapshot[]): SparklineMap {
  const byKey = groupByKey(snaps);
  const out: SparklineMap = new Map();
  for (const [key, arr] of byKey) {
    const values = arr
      .map((s) => s.supply_apy)
      .filter((v): v is number => v !== null);
    if (values.length >= 2) out.set(key, values);
  }
  return out;
}
