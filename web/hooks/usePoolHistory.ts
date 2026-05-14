"use client";

import { useEffect, useState, useMemo } from "react";
import { PoolSnapshot } from "@/lib/types";

const API_BASE = "/api";

interface UsePoolHistoryResult {
  data: PoolSnapshot[];
  loading: boolean;
  error: string | null;
}

export function usePoolHistory(
  hours = 24,
  bucketMinutes = 60,
  chains: string | null = null,
  protocols: string | null = null,
  assets: string | null = null,
): UsePoolHistoryResult {
  const [data, setData] = useState<PoolSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const url = useMemo(() => {
    if (chains === "" || protocols === "" || assets === "") return null;
    const params = new URLSearchParams({
      hours: String(hours),
      bucket_minutes: String(bucketMinutes),
    });
    if (chains) params.set("chains", chains);
    if (protocols) params.set("protocols", protocols);
    if (assets) params.set("assets", assets);
    return `${API_BASE}/pools/history/all?${params.toString()}`;
  }, [hours, bucketMinutes, chains, protocols, assets]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (url === null) {
        if (!cancelled) {
          setData([]);
          setLoading(false);
        }
        return;
      }
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
    const id = setInterval(run, 60_000);
    const onVisible = () => { if (document.visibilityState === "visible") run(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [url]);

  return { data, loading, error };
}
