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

interface UseDelta24hResult {
  deltas: DeltaMap;
  loading: boolean;
}

/**
 * Pull the last 24h of history for all series in a single call and
 * reduce it to the change (in percentage points) between the oldest
 * and newest bucket per series. Cheap on the server (one cache key)
 * and cheap on the wire (≤24 points × N series).
 */
export function useDelta24h(endpoint: "rates" | "pools"): UseDelta24hResult {
  const [deltas, setDeltas] = useState<DeltaMap>(new Map());
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
        setDeltas(reduceDeltas(snaps));
      } catch {
        // Δ is non-critical; silently keep the previous map.
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    // Refresh every 5 minutes — APY 24h delta doesn't move every poll.
    const id = setInterval(run, 5 * 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [endpoint]);

  return { deltas, loading };
}

function reduceDeltas(snaps: BaseSnapshot[]): DeltaMap {
  // First+last point per series (snapshots are bucketed and unordered).
  interface Bounds {
    first: BaseSnapshot;
    last: BaseSnapshot;
  }
  const bounds = new Map<string, Bounds>();
  for (const s of snaps) {
    const key = seriesKey(s.meta.protocol, s.meta.chain, s.meta.asset);
    const cur = bounds.get(key);
    if (!cur) {
      bounds.set(key, { first: s, last: s });
      continue;
    }
    if (s.ts < cur.first.ts) cur.first = s;
    if (s.ts > cur.last.ts) cur.last = s;
  }

  const out: DeltaMap = new Map();
  for (const [key, { first, last }] of bounds) {
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
