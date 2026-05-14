"use client";

import Link from "next/link";
import ApyChart from "@/components/ApyChart";
import AssetFilter from "@/components/AssetFilter";
import ChainFilter from "@/components/ChainFilter";
import FilterAccordion from "@/components/FilterAccordion";
import ProtocolFilter from "@/components/ProtocolFilter";
import { useDashboardFilters } from "@/hooks/useDashboardFilters";
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

interface HistoryDashboardProps<T extends BaseSnapshot> {
  title: string;
  subtitle: string;
  /** Hook returning latest snapshots — used to populate the filter chips. */
  useData: (
    chains: string | null,
    protocols: string | null,
    assets: string | null,
  ) => UseDataResult<T>;
  /** Hook returning bucketed 24h history — drives the chart. */
  useHistoryData: (
    hours: number,
    bucketMinutes: number,
    chains: string | null,
    protocols: string | null,
    assets: string | null,
  ) => UseHistoryResult<T>;
  backHref: string;
  assetOrder?: string[];
  assetFilterLabel?: string;
}

export default function HistoryDashboard<T extends BaseSnapshot>({
  title,
  subtitle,
  useData,
  useHistoryData,
  backHref,
  assetOrder = [],
  assetFilterLabel = "Assets",
}: HistoryDashboardProps<T>) {
  const filters = useDashboardFilters(useData, assetOrder);
  const history = useHistoryData(
    24,
    60,
    filters.chainsParam,
    filters.protocolsParam,
    filters.assetsParam,
  );

  const backLink = (() => {
    const params = new URLSearchParams();
    if (filters.chainsParam) params.set("chains", filters.chainsParam);
    if (filters.protocolsParam) params.set("protocols", filters.protocolsParam);
    if (filters.assetsParam) params.set("assets", filters.assetsParam);
    const qs = params.toString();
    return qs ? `${backHref}?${qs}` : backHref;
  })();

  return (
    <main className="w-full max-w-6xl mx-auto px-4 py-10 min-w-0">
      <header className="mb-8">
        <Link
          href={backLink}
          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          ← Back to table
        </Link>
        <h1 className="text-2xl font-semibold text-zinc-100 tracking-tight mt-2">
          {title}
        </h1>
        <p className="text-sm text-zinc-500 mt-1.5">{subtitle}</p>
      </header>

      <div className="space-y-3 mb-6">
        <FilterAccordion
          label="Protocols"
          activeCount={filters.selectedProtocols.size}
          totalCount={filters.availableProtocols.length}
        >
          <ProtocolFilter
            available={filters.availableProtocols}
            selected={filters.selectedProtocols}
            onChange={filters.onProtocolsChange}
          />
        </FilterAccordion>
        <FilterAccordion
          label="Chains"
          activeCount={filters.selectedChains.size}
          totalCount={filters.availableChains.length}
        >
          <ChainFilter
            available={filters.availableChains}
            selected={filters.selectedChains}
            onChange={filters.onChainsChange}
          />
        </FilterAccordion>
        <FilterAccordion
          label={assetFilterLabel}
          activeCount={filters.selectedAssets.size}
          totalCount={filters.availableAssets.length}
        >
          <AssetFilter
            available={filters.availableAssets}
            selected={filters.selectedAssets}
            onChange={filters.onAssetsChange}
          />
        </FilterAccordion>
      </div>

      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
            Supply APY &mdash; 24h History
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
