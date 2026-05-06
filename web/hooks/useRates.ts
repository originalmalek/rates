"use client";

import { useEffect, useState, useCallback } from "react";
import { RateSnapshot } from "@/lib/types";

const API_BASE = "/api";

interface UseRatesResult {
  data: RateSnapshot[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

export function useRates(): UseRatesResult {
  const [data, setData] = useState<RateSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetch_ = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/rates/latest`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: RateSnapshot[] = await res.json();
      setData(json);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch rates");
      // keep stale data — do not reset setData
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch_();
    const id = setInterval(fetch_, 60_000);
    const onVisible = () => { if (document.visibilityState === "visible") fetch_(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVisible); };
  }, [fetch_]);

  return { data, loading, error, lastUpdated };
}
