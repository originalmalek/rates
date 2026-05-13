"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useRates } from "@/hooks/useRates";
import { useHistory } from "@/hooks/useHistory";
import RatesTable from "@/components/RatesTable";
import ApyChart from "@/components/ApyChart";
import ChainFilter from "@/components/ChainFilter";
import ProtocolFilter from "@/components/ProtocolFilter";
import AssetFilter from "@/components/AssetFilter";
import FilterAccordion from "@/components/FilterAccordion";
import { RateSnapshot } from "@/lib/types";

const ASSET_ORDER = ["USDC", "USDT", "DAI", "USDS", "sDAI"];

function LastUpdated({ date }: { date: Date | null }) {
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

function uniqueChains(snapshots: RateSnapshot[]): string[] {
  return Array.from(new Set(snapshots.map((s) => s.meta.chain))).sort();
}

function uniqueProtocols(snapshots: RateSnapshot[]): string[] {
  return Array.from(new Set(snapshots.map((s) => s.meta.protocol))).sort();
}

function uniqueAssets(snapshots: RateSnapshot[]): string[] {
  const all = Array.from(new Set(snapshots.map((s) => s.meta.asset)));
  const known = ASSET_ORDER.filter((a) => all.includes(a));
  const rest = all.filter((a) => !ASSET_ORDER.includes(a)).sort();
  return [...known, ...rest];
}

function mergeAssets(prev: string[], next: string[]): string[] {
  const all = [...new Set([...prev, ...next])];
  const known = ASSET_ORDER.filter((a) => all.includes(a));
  const rest = all.filter((a) => !ASSET_ORDER.includes(a)).sort();
  return [...known, ...rest];
}

const CHAINS_PARAM = "chains";
const PROTOCOLS_PARAM = "protocols";
const ASSETS_PARAM = "assets";

function readSet(
  searchParams: URLSearchParams | ReturnType<typeof useSearchParams>,
  key: string,
  fallback: string[]
): Set<string> {
  const raw = "get" in searchParams ? searchParams.get(key) : null;
  if (raw === null) return new Set(fallback);
  if (raw === "") return new Set<string>();
  return new Set(raw.split(",").filter(Boolean));
}

function toParam(selected: Set<string>, available: string[]): string | null {
  if (available.length === 0) return null; // still loading — fetch all
  if (selected.size === 0) return "";      // none selected — disabled
  if (available.every((v) => selected.has(v))) return null; // all selected — no param
  return [...selected].sort().join(",");
}

export default function Dashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Available options accumulate across fetches so filter chips never shrink
  // when the user narrows down and the server returns a subset.
  const [availableChains, setAvailableChains] = useState<string[]>([]);
  const [availableProtocols, setAvailableProtocols] = useState<string[]>([]);
  const [availableAssets, setAvailableAssets] = useState<string[]>([]);

  const selectedChains = useMemo(
    () => readSet(searchParams, CHAINS_PARAM, availableChains),
    [searchParams, availableChains]
  );
  const selectedProtocols = useMemo(
    () => readSet(searchParams, PROTOCOLS_PARAM, availableProtocols),
    [searchParams, availableProtocols]
  );
  const selectedAssets = useMemo(
    () => readSet(searchParams, ASSETS_PARAM, availableAssets),
    [searchParams, availableAssets]
  );

  // Convert selected sets to CSV params for the API.
  // null → no param (fetch all), "" → disabled (return []).
  const chainsParam = useMemo(
    () => toParam(selectedChains, availableChains),
    [selectedChains, availableChains]
  );
  const protocolsParam = useMemo(
    () => toParam(selectedProtocols, availableProtocols),
    [selectedProtocols, availableProtocols]
  );
  const assetsParam = useMemo(
    () => toParam(selectedAssets, availableAssets),
    [selectedAssets, availableAssets]
  );

  const rates = useRates(chainsParam, protocolsParam, assetsParam);
  const history = useHistory(24, 60, chainsParam, protocolsParam, assetsParam);

  // Accumulate known options — never shrink when the server returns a subset.
  useEffect(() => {
    if (rates.data.length === 0) return;
    setAvailableChains((prev) => {
      const merged = [...new Set([...prev, ...uniqueChains(rates.data)])].sort();
      return merged.length === prev.length ? prev : merged;
    });
    setAvailableProtocols((prev) => {
      const merged = [...new Set([...prev, ...uniqueProtocols(rates.data)])].sort();
      return merged.length === prev.length ? prev : merged;
    });
    setAvailableAssets((prev) => {
      const merged = mergeAssets(prev, uniqueAssets(rates.data));
      return merged.length === prev.length ? prev : merged;
    });
  }, [rates.data]);

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
    [router, pathname, searchParams]
  );

  const onChainsChange = useCallback(
    (next: Set<string>) => updateParam(CHAINS_PARAM, availableChains, next),
    [updateParam, availableChains]
  );
  const onProtocolsChange = useCallback(
    (next: Set<string>) => updateParam(PROTOCOLS_PARAM, availableProtocols, next),
    [updateParam, availableProtocols]
  );
  const onAssetsChange = useCallback(
    (next: Set<string>) => updateParam(ASSETS_PARAM, availableAssets, next),
    [updateParam, availableAssets]
  );

  return (
    <main className="w-full max-w-6xl mx-auto px-4 py-10 min-w-0">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-zinc-100 tracking-tight">
          DeFi Stablecoin Rates
        </h1>
        <p className="text-sm text-zinc-500 mt-1.5">
          Live lending and borrowing rates across DeFi protocols.
          Auto-refreshes every 60 seconds.
        </p>
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
          label="Stablecoins"
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
            Current Rates
            <span className="ml-2 text-zinc-600 normal-case font-normal">
              ({rates.data.length})
            </span>
          </h2>
          <LastUpdated date={rates.lastUpdated} />
        </div>

        {rates.loading && rates.data.length === 0 ? (
          <div className="text-center text-zinc-600 py-10 text-sm">
            Loading rates…
          </div>
        ) : (
          <RatesTable snapshots={rates.data} />
        )}
      </section>

      <section className="mb-10">
        <div className="mb-4">
          <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
            Supply APY &mdash; 24h History
          </h2>
        </div>

        {history.loading && history.data.length === 0 ? (
          <div className="text-center text-zinc-600 py-10 text-sm">
            Loading history…
          </div>
        ) : history.data.length > 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-[var(--surface)] p-4">
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
