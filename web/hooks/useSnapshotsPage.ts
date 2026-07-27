"use client";

import { useEffect, useMemo, useState } from "react";
import { BaseSnapshot, RateSnapshot, PoolSnapshot, VaultSnapshot } from "@/lib/types";

const API_BASE = "/api";

interface SnapshotsPage<T> {
  items: T[];
  total: number;
}

interface UseSnapshotsPageResult<T> {
  items: T[];
  total: number;
  loading: boolean;
  error: string | null;
}

function useSnapshotsPage<T extends BaseSnapshot>(
  apiPath: "rates" | "pools" | "vaults",
  poolId: string,
  limit: number,
  offset: number,
): UseSnapshotsPageResult<T> {
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const url = useMemo(() => {
    const params = new URLSearchParams({
      pool_id: poolId,
      limit: String(limit),
      offset: String(offset),
    });
    return `${API_BASE}/${apiPath}/snapshots?${params.toString()}`;
  }, [apiPath, poolId, limit, offset]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!cancelled) setLoading(true);
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: SnapshotsPage<T> = await res.json();
        if (cancelled) return;
        setItems(json.items);
        setTotal(json.total);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to fetch snapshots");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [url]);

  return { items, total, loading, error };
}

export function useRateSnapshotsPage(
  poolId: string,
  limit: number,
  offset: number,
): UseSnapshotsPageResult<RateSnapshot> {
  return useSnapshotsPage<RateSnapshot>("rates", poolId, limit, offset);
}

export function usePoolSnapshotsPage(
  poolId: string,
  limit: number,
  offset: number,
): UseSnapshotsPageResult<PoolSnapshot> {
  return useSnapshotsPage<PoolSnapshot>("pools", poolId, limit, offset);
}

export function useVaultSnapshotsPage(
  poolId: string,
  limit: number,
  offset: number,
): UseSnapshotsPageResult<VaultSnapshot> {
  return useSnapshotsPage<VaultSnapshot>("vaults", poolId, limit, offset);
}
