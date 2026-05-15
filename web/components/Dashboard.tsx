"use client";

import AssetFilter from "@/components/AssetFilter";
import BestRatesCarousel from "@/components/BestRatesCarousel";
import ChainFilter from "@/components/ChainFilter";
import FilterAccordion from "@/components/FilterAccordion";
import ProtocolFilter from "@/components/ProtocolFilter";
import WatchlistCarousel from "@/components/WatchlistCarousel";
import { useDashboardFilters } from "@/hooks/useDashboardFilters";
import { DeltaMap, useDelta24h } from "@/hooks/useDelta24h";
import { BaseSnapshot } from "@/lib/types";

interface UseDataResult<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  lastUpdated?: Date | null;
}

interface DashboardProps<T extends BaseSnapshot> {
  title: string;
  subtitle: string;
  useData: (
    chains: string | null,
    protocols: string | null,
    assets: string | null,
  ) => UseDataResult<T>;
  TableComponent: React.ComponentType<{ snapshots: T[]; deltas?: DeltaMap }>;
  seriesHrefBase: string;
  deltaEndpoint: "rates" | "pools";
  assetOrder?: string[];
  assetFilterLabel?: string;
  currentSectionLabel?: string;
  bestRatesTitle?: string;
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

export default function Dashboard<T extends BaseSnapshot>({
  title,
  subtitle,
  useData,
  TableComponent,
  seriesHrefBase,
  deltaEndpoint,
  assetOrder = [],
  assetFilterLabel = "Assets",
  currentSectionLabel = "Current",
  bestRatesTitle = "Best Rates",
}: DashboardProps<T>) {
  const filters = useDashboardFilters(useData, assetOrder);
  const { deltas } = useDelta24h(deltaEndpoint);

  return (
    <main className="w-full max-w-6xl mx-auto px-4 py-10 min-w-0">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-zinc-100 tracking-tight">
          {title}
        </h1>
        <p className="text-sm text-zinc-500 mt-1.5">{subtitle}</p>
      </header>

      <WatchlistCarousel
        snapshots={filters.data}
        hrefBase={seriesHrefBase}
        title="Watchlist"
      />

      <BestRatesCarousel
        snapshots={filters.data}
        hrefBase={seriesHrefBase}
        title={bestRatesTitle}
      />

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
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
            {currentSectionLabel}
            <span className="ml-2 text-zinc-600 normal-case font-normal">
              ({filters.data.length})
            </span>
          </h2>
          <LastUpdated
            date={filters.lastUpdated}
            refreshing={filters.loading && filters.data.length > 0}
          />
        </div>

        {filters.loading && filters.data.length === 0 ? (
          <div className="text-center text-zinc-600 py-10 text-sm">
            Loading…
          </div>
        ) : (
          <div
            className={`transition-opacity duration-200 ${
              filters.loading ? "opacity-60" : "opacity-100"
            }`}
          >
            <TableComponent snapshots={filters.data} deltas={deltas} />
          </div>
        )}
      </section>
    </main>
  );
}
