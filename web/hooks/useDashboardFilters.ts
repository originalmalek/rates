"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { BaseSnapshot } from "@/lib/types";

interface SourceResult<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  lastUpdated?: Date | null;
}

interface FilterState<T> {
  selectedChains: Set<string>;
  selectedProtocols: Set<string>;
  selectedAssets: Set<string>;
  availableChains: string[];
  availableProtocols: string[];
  availableAssets: string[];
  onChainsChange: (next: Set<string>) => void;
  onProtocolsChange: (next: Set<string>) => void;
  onAssetsChange: (next: Set<string>) => void;
  chainsParam: string | null;
  protocolsParam: string | null;
  assetsParam: string | null;
  data: T[];
  loading: boolean;
  lastUpdated: Date | null;
}

const CHAINS_PARAM = "chains";
const PROTOCOLS_PARAM = "protocols";
const ASSETS_PARAM = "assets";

/**
 * One filter bucket per top-level tab. The lending dashboard and its
 * history page share a bucket (you don't want filters to reset when
 * jumping between them); same for pools.
 */
function storageKeyFor(pathname: string): string {
  if (pathname.startsWith("/pools")) return "filters:pools";
  if (pathname.startsWith("/vaults")) return "filters:vaults";
  return "filters:lending";
}

function readSet(
  searchParams: URLSearchParams | ReturnType<typeof useSearchParams>,
  key: string,
  fallback: string[],
): Set<string> {
  const raw = "get" in searchParams ? searchParams.get(key) : null;
  if (raw === null) return new Set(fallback);
  if (raw === "") return new Set<string>();
  const values = raw.split(",").filter(Boolean);
  if (fallback.length > 0) {
    // Ignore values that left the data universe (e.g. an asset the
    // staleness cutoff removed since the filter was persisted). A
    // selection of only dead values behaves like no filter at all
    // rather than pinning the table to an empty result.
    const live = values.filter((v) => fallback.includes(v));
    return new Set(live.length > 0 ? live : fallback);
  }
  return new Set(values);
}

function toParam(selected: Set<string>, available: string[]): string | null {
  if (available.length === 0) return null;
  if (selected.size === 0) return "";
  if (available.every((v) => selected.has(v))) return null;
  return [...selected].sort().join(",");
}

/**
 * Query-only URL updates go through the native History API, which
 * Next.js keeps in sync with useSearchParams. router.replace() is
 * silently dropped in production builds when the page was served
 * with search params already in the URL (statically prerendered
 * routes), which left the filter chips dead after a reload.
 */
function replaceQuery(pathname: string, params: URLSearchParams): void {
  const qs = params.toString();
  window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname);
}

function uniqueChains(snapshots: BaseSnapshot[]): string[] {
  return Array.from(new Set(snapshots.map((s) => s.meta.chain))).sort();
}

function uniqueProtocols(snapshots: BaseSnapshot[]): string[] {
  return Array.from(new Set(snapshots.map((s) => s.meta.protocol))).sort();
}

function orderedAssets(snapshots: BaseSnapshot[], order: string[]): string[] {
  const all = Array.from(new Set(snapshots.map((s) => s.meta.asset)));
  const known = order.filter((a) => all.includes(a));
  const rest = all.filter((a) => !order.includes(a)).sort();
  return [...known, ...rest];
}

function mergeAssets(prev: string[], next: string[], order: string[]): string[] {
  const all = [...new Set([...prev, ...next])];
  const known = order.filter((a) => all.includes(a));
  const rest = all.filter((a) => !order.includes(a)).sort();
  return [...known, ...rest];
}

/**
 * Drives the three filter chips (chains / protocols / assets) for both the
 * table view and the history view. URL search params are the source of
 * truth; available options are accumulated from useSource() so chips never
 * shrink when the server returns a filtered subset.
 */
export function useDashboardFilters<T extends BaseSnapshot>(
  useSource: (
    chains: string | null,
    protocols: string | null,
    assets: string | null,
  ) => SourceResult<T>,
  assetOrder: string[] = [],
): FilterState<T> {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const storageKey = storageKeyFor(pathname);

  // Restore filters from localStorage on first mount per storageKey.
  // URL params win if present — shared/bookmarked links should override
  // whatever was last persisted.
  const restoredKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (restoredKeyRef.current === storageKey) return;
    restoredKeyRef.current = storageKey;
    if (typeof window === "undefined") return;
    const urlHasAny =
      searchParams.has(CHAINS_PARAM) ||
      searchParams.has(PROTOCOLS_PARAM) ||
      searchParams.has(ASSETS_PARAM);
    if (urlHasAny) return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const obj = JSON.parse(raw) as Record<string, unknown>;
      const params = new URLSearchParams(searchParams.toString());
      if (typeof obj.chains === "string") params.set(CHAINS_PARAM, obj.chains);
      if (typeof obj.protocols === "string") params.set(PROTOCOLS_PARAM, obj.protocols);
      if (typeof obj.assets === "string") params.set(ASSETS_PARAM, obj.assets);
      if (params.toString()) replaceQuery(pathname, params);
    } catch {
      // Storage may be disabled or contain garbage — silently ignore.
    }
  }, [storageKey, pathname, searchParams]);

  // Persist whatever is currently in the URL. Only runs after the
  // initial restore for this key has fired.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (restoredKeyRef.current !== storageKey) return;
    const chains = searchParams.get(CHAINS_PARAM);
    const protocols = searchParams.get(PROTOCOLS_PARAM);
    const assets = searchParams.get(ASSETS_PARAM);
    const obj: Record<string, string> = {};
    if (chains !== null) obj.chains = chains;
    if (protocols !== null) obj.protocols = protocols;
    if (assets !== null) obj.assets = assets;
    try {
      if (Object.keys(obj).length === 0) {
        window.localStorage.removeItem(storageKey);
      } else {
        window.localStorage.setItem(storageKey, JSON.stringify(obj));
      }
    } catch {
      // ignore
    }
  }, [searchParams, storageKey]);

  const [availableChains, setAvailableChains] = useState<string[]>([]);
  const [availableProtocols, setAvailableProtocols] = useState<string[]>([]);
  const [availableAssets, setAvailableAssets] = useState<string[]>([]);

  // Best-effort URL/localStorage cleanup: drop selected values that no
  // longer exist in the data universe (readSet already ignores them for
  // data correctness, this just keeps the URL honest). Delayed a beat
  // because right after hydration Next.js re-syncs the URL itself and
  // clobbers a replaceState fired from an early effect; location.search
  // is read at fire time so we always prune the current URL. An
  // explicitly empty selection ("") is a deliberate state, left alone.
  useEffect(() => {
    if (
      availableChains.length === 0 &&
      availableProtocols.length === 0 &&
      availableAssets.length === 0
    ) {
      return;
    }
    const id = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      let changed = false;
      const prune = (key: string, available: string[]) => {
        // The first fetch is always unfiltered, so a non-empty available
        // list is the full universe; until then we can't judge anything.
        if (available.length === 0) return;
        const raw = params.get(key);
        if (raw === null || raw === "") return;
        const values = raw.split(",").filter(Boolean);
        const kept = values.filter((v) => available.includes(v));
        if (kept.length === values.length) return;
        changed = true;
        if (kept.length === 0 || available.every((v) => kept.includes(v))) {
          params.delete(key);
        } else {
          params.set(key, kept.sort().join(","));
        }
      };
      prune(CHAINS_PARAM, availableChains);
      prune(PROTOCOLS_PARAM, availableProtocols);
      prune(ASSETS_PARAM, availableAssets);
      if (changed) replaceQuery(pathname, params);
    }, 1200);
    return () => window.clearTimeout(id);
  }, [availableChains, availableProtocols, availableAssets, pathname]);

  const selectedChains = useMemo(
    () => readSet(searchParams, CHAINS_PARAM, availableChains),
    [searchParams, availableChains],
  );
  const selectedProtocols = useMemo(
    () => readSet(searchParams, PROTOCOLS_PARAM, availableProtocols),
    [searchParams, availableProtocols],
  );
  const selectedAssets = useMemo(
    () => readSet(searchParams, ASSETS_PARAM, availableAssets),
    [searchParams, availableAssets],
  );

  const chainsParam = useMemo(
    () => toParam(selectedChains, availableChains),
    [selectedChains, availableChains],
  );
  const protocolsParam = useMemo(
    () => toParam(selectedProtocols, availableProtocols),
    [selectedProtocols, availableProtocols],
  );
  const assetsParam = useMemo(
    () => toParam(selectedAssets, availableAssets),
    [selectedAssets, availableAssets],
  );

  const source = useSource(chainsParam, protocolsParam, assetsParam);

  useEffect(() => {
    if (source.data.length === 0) return;
    setAvailableChains((prev) => {
      const merged = [...new Set([...prev, ...uniqueChains(source.data)])].sort();
      return merged.length === prev.length ? prev : merged;
    });
    setAvailableProtocols((prev) => {
      const merged = [...new Set([...prev, ...uniqueProtocols(source.data)])].sort();
      return merged.length === prev.length ? prev : merged;
    });
    setAvailableAssets((prev) => {
      const merged = mergeAssets(prev, orderedAssets(source.data, assetOrder), assetOrder);
      return merged.length === prev.length ? prev : merged;
    });
  }, [source.data, assetOrder]);

  const updateParam = useCallback(
    (key: string, all: string[], next: Set<string>) => {
      const params = new URLSearchParams(searchParams.toString());
      const allOn = all.length > 0 && all.every((v) => next.has(v));
      if (allOn) {
        params.delete(key);
      } else {
        params.set(key, Array.from(next).sort().join(","));
      }
      replaceQuery(pathname, params);
    },
    [pathname, searchParams],
  );

  const onChainsChange = useCallback(
    (next: Set<string>) => updateParam(CHAINS_PARAM, availableChains, next),
    [updateParam, availableChains],
  );
  const onProtocolsChange = useCallback(
    (next: Set<string>) => updateParam(PROTOCOLS_PARAM, availableProtocols, next),
    [updateParam, availableProtocols],
  );
  const onAssetsChange = useCallback(
    (next: Set<string>) => updateParam(ASSETS_PARAM, availableAssets, next),
    [updateParam, availableAssets],
  );

  return {
    selectedChains,
    selectedProtocols,
    selectedAssets,
    availableChains,
    availableProtocols,
    availableAssets,
    onChainsChange,
    onProtocolsChange,
    onAssetsChange,
    chainsParam,
    protocolsParam,
    assetsParam,
    data: source.data,
    loading: source.loading,
    lastUpdated: source.lastUpdated ?? null,
  };
}
