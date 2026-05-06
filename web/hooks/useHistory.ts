"use client";

import { useEffect, useState, useCallback } from "react";
import { RateSnapshot } from "@/lib/types";

const API_BASE = "/api";

interface UseHistoryResult {
  data: RateSnapshot[];
  loading: boolean;
  error: string | null;
}

export function useHistory(hours = 24, bucketMinutes = 60): UseHistoryResult {
  const [data, setData] = useState<RateSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    try {
      const url = `${API_BASE}/rates/history/all?hours=${hours}&bucket_minutes=${bucketMinutes}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: RateSnapshot[] = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch history");
      // keep stale data — do not reset setData
    } finally {
      setLoading(false);
    }
  }, [hours, bucketMinutes]);

  useEffect(() => {
    fetch_();
    const id = setInterval(fetch_, 60_000);
    const onVisible = () => { if (document.visibilityState === "visible") fetch_(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVisible); };
  }, [fetch_]);

  return { data, loading, error };
}
