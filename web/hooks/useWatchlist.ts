"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Persisted set of "starred" series keys. The key format is
 * `protocol__chain__asset` — same shape used by the chart series
 * builder, so callers don't have to invent another encoding.
 *
 * Multiple components on the same page each call useWatchlist() and
 * keep their own copy of the set. To keep them in sync, every write
 * goes straight to localStorage and dispatches a same-window event
 * that every hook instance listens for. Cross-tab sync still works
 * through the regular `storage` event.
 */
const STORAGE_KEY = "rates:watchlist:v1";
const SAME_WINDOW_EVENT = "rates:watchlist:changed";

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
    window.dispatchEvent(new Event(SAME_WINDOW_EVENT));
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
    const sync = () => setKeys(loadFromStorage());
    // Same-window: every hook instance refreshes when any writer flips.
    window.addEventListener(SAME_WINDOW_EVENT, sync);
    // Cross-tab: native storage event.
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) sync();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(SAME_WINDOW_EVENT, sync);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const toggle = useCallback((key: string) => {
    // Always start from the freshest value in storage — never from this
    // hook instance's possibly-stale local state — so concurrent toggles
    // from sibling rows don't clobber each other.
    const next = loadFromStorage();
    if (next.has(key)) next.delete(key);
    else next.add(key);
    saveToStorage(next);
    // setKeys will fire via the SAME_WINDOW_EVENT listener above.
  }, []);

  const has = useCallback((key: string) => keys.has(key), [keys]);

  return { keys, has, toggle, count: keys.size };
}
