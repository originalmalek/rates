"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import ApyChart from "@/components/ApyChart";
import ChainFilter from "@/components/ChainFilter";
import ProtocolFilter from "@/components/ProtocolFilter";
import AssetFilter from "@/components/AssetFilter";
import FilterAccordion from "@/components/FilterAccordion";
import { BaseSnapshot } from "@/lib/types";

interface UseDataResult<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  lastUpdated?: Date | null;
}

interface UseHistoryResult<T> {
  data: T[];
  loading: boolean;
  error: string | null;
}

interface DashboardProps<T extends BaseSnapshot> {
  title: string;
  subtitle: string;
  useData: (
    chains: string | null,
    protocols: string | null,
    assets: string | null,
  ) => UseDataResult<T>;
  useHistoryData: (
    hours: number,
    bucketMinutes: number,
    chains: string | null,
    protocols: string | null,
    assets: string | null,
  ) => UseHistoryResult<T>;
  TableComponent: React.ComponentType<{ snapshots: T[] }>;
  assetOrder?: string[];
  assetFilterLabel?: string;
  currentSectionLabel?: string;
  historySectionLabel?: string;
}

function LastUpdated({ date, refreshing }: { date: Date | null; refreshing: boolean }) {
  if (refreshing) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-zinc-400">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        Refreshing…
      </span>
    );
  }
  if (!date) return null;
  return (
    <span className="text-xs text-zinc-500">
      Updated{" "}
      {date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })}
    </span>
  );
}

function uniqueChains(snapshots: BaseSnapshot[]): string[] {
  return Array.from(new Set(snapshots.map((s) => s.meta.chain))).sort();
}

function uniqueProtocols(snapshots: BaseSnapshot[]): string[] {
  return Array.from(new Set(snapshots.map((s) => s.meta.protocol))).sort();
}

function uniqueAssets(snapshots: BaseSnapshot[], order: string[]): string[] {
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

export default function Dashboard<T extends BaseSnapshot>({
  title,
  subtitle,
  useData,
  useHistoryData,
  TableComponent,
  assetOrder = [],
  assetFilterLabel = "Assets",
  currentSectionLabel = "Current",
  historySectionLabel = "Supply APY — 24h History",
}: DashboardProps<T>) {
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

  const data = useData(chainsParam, protocolsParam, assetsParam);
  const history = useHistoryData(24, 60, chainsParam, protocolsParam, assetsParam);

  useEffect(() => {
    if (data.data.length === 0) return;
    setAvailableChains((prev) => {
      const merged = [...new Set([...prev, ...uniqueChains(data.data)])].sort();
      return merged.length === prev.length ? prev : merged;
    });
    setAvailableProtocols((prev) => {
      const merged = [...new Set([...prev, ...uniqueProtocols(data.data)])].sort();
      return merged.length === prev.length ? prev : merged;
    });
    setAvailableAssets((prev) => {
      const merged = mergeAssets(prev, uniqueAssets(data.data, assetOrder), assetOrder);
      return merged.length === prev.length ? prev : merged;
    });
  }, [data.data, assetOrder]);

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

  return (
    <main className="w-full max-w-6xl mx-auto px-4 py-10 min-w-0">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-zinc-100 tracking-tight">
          {title}
        </h1>
        <p className="text-sm text-zinc-500 mt-1.5">{subtitle}</p>
      </header>

      <div className="space-y-3 mb-6">
        <FilterAccordion
          label="Protocols"
          activeCount={selectedProtocols.size}
          totalCount={availableProtocols.length}
        >
          <ProtocolFilter
            available={availableProtocols}
            selected={selectedProtocols}
            onChange={onProtocolsChange}
          />
        </FilterAccordion>
        <FilterAccordion
          label="Chains"
          activeCount={selectedChains.size}
          totalCount={availableChains.length}
        >
          <ChainFilter
            available={availableChains}
            selected={selectedChains}
            onChange={onChainsChange}
          />
        </FilterAccordion>
        <FilterAccordion
          label={assetFilterLabel}
          activeCount={selectedAssets.size}
          totalCount={availableAssets.length}
        >
          <AssetFilter
            available={availableAssets}
            selected={selectedAssets}
            onChange={onAssetsChange}
          />
        </FilterAccordion>
      </div>

      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
            {currentSectionLabel}
            <span className="ml-2 text-zinc-600 normal-case font-normal">
              ({data.data.length})
            </span>
          </h2>
          <LastUpdated
            date={data.lastUpdated ?? null}
            refreshing={data.loading && data.data.length > 0}
          />
        </div>

        {data.loading && data.data.length === 0 ? (
          <div className="text-center text-zinc-600 py-10 text-sm">
            Loading…
          </div>
        ) : (
          <div
            className={`transition-opacity duration-200 ${
              data.loading ? "opacity-60" : "opacity-100"
            }`}
          >
            <TableComponent snapshots={data.data} />
          </div>
        )}
      </section>

      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
            {historySectionLabel}
          </h2>
          {history.loading && history.data.length > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs text-zinc-400">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Refreshing…
            </span>
          )}
        </div>

        {history.loading && history.data.length === 0 ? (
          <div className="text-center text-zinc-600 py-10 text-sm">
            Loading history…
          </div>
        ) : history.data.length > 0 ? (
          <div
            className={`rounded-xl border border-zinc-800 bg-[var(--surface)] p-4 transition-opacity duration-200 ${
              history.loading ? "opacity-60" : "opacity-100"
            }`}
          >
            <ApyChart snapshots={history.data} />
          </div>
        ) : (
          <p className="text-center text-zinc-600 py-8 text-sm">
            No history data for current filter selection.
          </p>
        )}
      </section>
    </main>
  );
}
