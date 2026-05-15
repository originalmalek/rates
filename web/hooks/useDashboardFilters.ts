"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BaseSnapshot } from "@/lib/types";

interface SourceResult<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  lastUpdated?: Date | null;
  refresh?: () => void;
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
  refresh: () => void;
}

const CHAINS_PARAM = "chains";
const PROTOCOLS_PARAM = "protocols";
const ASSETS_PARAM = "assets";

function readSet(
  searchParams: URLSearchParams | ReturnType<typeof useSearchParams>,
  key: string,
  fallback: string[],
): Set<string> {
  const raw = "get" in searchParams ? searchParams.get(key) : null;
  if (raw === null) return new Set(fallback);
  if (raw === "") return new Set<string>();
  return new Set(raw.split(",").filter(Boolean));
}

function toParam(selected: Set<string>, available: string[]): string | null {
  if (available.length === 0) return null;
  if (selected.size === 0) return "";
  if (available.every((v) => selected.has(v))) return null;
  return [...selected].sort().join(",");
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [availableChains, setAvailableChains] = useState<string[]>([]);
  const [availableProtocols, setAvailableProtocols] = useState<string[]>([]);
  const [availableAssets, setAvailableAssets] = useState<string[]>([]);

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
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
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
    refresh: source.refresh ?? (() => {}),
  };
}
