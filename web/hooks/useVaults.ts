"use client";

import { useEffect, useState, useMemo } from "react";
import { VaultSnapshot } from "@/lib/types";

const API_BASE = "/api";

interface UseVaultsResult {
  data: VaultSnapshot[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

export function useVaults(
  chains: string | null,
  protocols: string | null,
  assets: string | null,
): UseVaultsResult {
  const [data, setData] = useState<VaultSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const url = useMemo(() => {
    if (chains === "" || protocols === "" || assets === "") return null;
    const params = new URLSearchParams();
    if (chains) params.set("chains", chains);
    if (protocols) params.set("protocols", protocols);
    // `assets` is the underlying stablecoin, not the vault name.
    if (assets) params.set("assets", assets);
    const qs = params.toString();
    return qs ? `${API_BASE}/vaults/latest?${qs}` : `${API_BASE}/vaults/latest`;
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
      if (!cancelled) setLoading(true);
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: VaultSnapshot[] = await res.json();
        if (cancelled) return;
        setData(json);
        setLastUpdated(new Date());
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to fetch vaults");
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
