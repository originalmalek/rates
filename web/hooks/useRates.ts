"use client";

import { useEffect, useState, useMemo } from "react";
import { RateSnapshot } from "@/lib/types";

const API_BASE = "/api";

interface UseRatesResult {
  data: RateSnapshot[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

export function useRates(
  chains: string | null,
  protocols: string | null,
  assets: string | null,
): UseRatesResult {
  const [data, setData] = useState<RateSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // null = fetch all; "" = none selected (disabled); "a,b" = filter
  const url = useMemo(() => {
    if (chains === "" || protocols === "" || assets === "") return null;
    const params = new URLSearchParams();
    if (chains) params.set("chains", chains);
    if (protocols) params.set("protocols", protocols);
    if (assets) params.set("assets", assets);
    const qs = params.toString();
    return qs ? `${API_BASE}/rates/latest?${qs}` : `${API_BASE}/rates/latest`;
  }, [chains, protocols, assets]);

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
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: RateSnapshot[] = await res.json();
        if (cancelled) return;
        setData(json);
        setLastUpdated(new Date());
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to fetch rates");
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

  return { data, loading, error, lastUpdated };
}
