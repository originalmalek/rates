"use client";

import { useEffect, useMemo, useState } from "react";
import { BaseSnapshot, RateSnapshot, PoolSnapshot } from "@/lib/types";

const API_BASE = "/api";

interface UseSeriesHistoryResult<T> {
  data: T[];
  loading: boolean;
  error: string | null;
}

function useRateSeriesHistory(
  protocol: string,
  chain: string,
  asset: string,
  hours: number,
  bucketMinutes: number,
): UseSeriesHistoryResult<RateSnapshot> {
  const [data, setData] = useState<RateSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const url = useMemo(() => {
    const until = new Date();
    const since = new Date(until.getTime() - hours * 3_600_000);
    const params = new URLSearchParams({
      protocol,
      chain,
      asset,
      since: since.toISOString(),
      until: until.toISOString(),
      bucket_minutes: String(bucketMinutes),
    });
    return `${API_BASE}/rates/history?${params.toString()}`;
    // Note: the until/since change every render but we only refetch when
    // protocol/chain/asset/hours/bucket change because url is in useMemo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [protocol, chain, asset, hours, bucketMinutes]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!cancelled) setLoading(true);
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: RateSnapshot[] = await res.json();
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

// Pools share /pools/history/all — filter to a single series via params.
function usePoolSeriesHistory(
  protocol: string,
  chain: string,
  asset: string,
  hours: number,
  bucketMinutes: number,
): UseSeriesHistoryResult<PoolSnapshot> {
  const [data, setData] = useState<PoolSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const url = useMemo(() => {
    const params = new URLSearchParams({
      hours: String(hours),
      bucket_minutes: String(bucketMinutes),
      protocols: protocol,
      chains: chain,
      assets: asset,
    });
    return `${API_BASE}/pools/history/all?${params.toString()}`;
  }, [protocol, chain, asset, hours, bucketMinutes]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!cancelled) setLoading(true);
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: PoolSnapshot[] = await res.json();
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

export { useRateSeriesHistory, usePoolSeriesHistory };
