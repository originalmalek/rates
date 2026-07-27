"use client";

import { useEffect, useMemo, useState } from "react";
import { BaseSnapshot, RateSnapshot, PoolSnapshot, VaultSnapshot } from "@/lib/types";

const API_BASE = "/api";

interface UseSeriesHistoryResult<T> {
  data: T[];
  loading: boolean;
  error: string | null;
}

/**
 * Both endpoints take the DeFi Llama pool id — the triple
 * (protocol, chain, asset) selects several series at once.
 */
function useSeriesHistory<T extends BaseSnapshot>(
  apiPath: "rates" | "pools" | "vaults",
  poolId: string,
  hours: number,
  bucketMinutes: number,
): UseSeriesHistoryResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const url = useMemo(() => {
    const until = new Date();
    const since = new Date(until.getTime() - hours * 3_600_000);
    const params = new URLSearchParams({
      pool_id: poolId,
      since: since.toISOString(),
      until: until.toISOString(),
      bucket_minutes: String(bucketMinutes),
    });
    return `${API_BASE}/${apiPath}/history?${params.toString()}`;
    // Note: until/since change every render but we only refetch when
    // pool/hours/bucket change because url is in useMemo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiPath, poolId, hours, bucketMinutes]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!cancelled) setLoading(true);
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: T[] = await res.json();
        if (cancelled) return;
        setData(json);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to fetch history");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [url]);

  return { data, loading, error };
}

function useRateSeriesHistory(
  poolId: string,
  hours: number,
  bucketMinutes: number,
): UseSeriesHistoryResult<RateSnapshot> {
  return useSeriesHistory<RateSnapshot>("rates", poolId, hours, bucketMinutes);
}

function usePoolSeriesHistory(
  poolId: string,
  hours: number,
  bucketMinutes: number,
): UseSeriesHistoryResult<PoolSnapshot> {
  return useSeriesHistory<PoolSnapshot>("pools", poolId, hours, bucketMinutes);
}

function useVaultSeriesHistory(
  poolId: string,
  hours: number,
  bucketMinutes: number,
): UseSeriesHistoryResult<VaultSnapshot> {
  return useSeriesHistory<VaultSnapshot>("vaults", poolId, hours, bucketMinutes);
}

export { useRateSeriesHistory, usePoolSeriesHistory, useVaultSeriesHistory };
