"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Persisted set of "starred" series keys. The key format is
 * `protocol__chain__asset` — same shape used by the chart series
 * builder, so callers don't have to invent another encoding.
 *
 * Lending and pools share the storage namespace because the
 * series keys are themselves distinct (different protocols / chain
 * combinations), so collisions aren't possible.
 */
const STORAGE_KEY = "rates:watchlist:v1";

export function seriesKey(protocol: string, chain: string, asset: string): string {
  return `${protocol}__${chain}__${asset}`;
}

function loadFromStorage(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((v) => typeof v === "string"));
  } catch {
    return new Set();
  }
}

function saveToStorage(set: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    // localStorage may be full or disabled — silently ignore.
  }
}

export interface WatchlistApi {
  keys: Set<string>;
  has: (key: string) => boolean;
  toggle: (key: string) => void;
  count: number;
}

export function useWatchlist(): WatchlistApi {
  const [keys, setKeys] = useState<Set<string>>(() => new Set<string>());

  useEffect(() => {
    setKeys(loadFromStorage());
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setKeys(loadFromStorage());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const toggle = useCallback((key: string) => {
    setKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      saveToStorage(next);
      return next;
    });
  }, []);

  const has = useCallback((key: string) => keys.has(key), [keys]);

  return { keys, has, toggle, count: keys.size };
}
