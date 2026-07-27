"use client";

import { useMemo, useState } from "react";
import AssetFilter from "@/components/AssetFilter";
import BestRatesCarousel from "@/components/BestRatesCarousel";
import ChainFilter from "@/components/ChainFilter";
import FilterAccordion from "@/components/FilterAccordion";
import ProtocolFilter from "@/components/ProtocolFilter";
import TableSearch from "@/components/TableSearch";
import WatchlistCarousel from "@/components/WatchlistCarousel";
import { formatChain, formatProtocol } from "@/lib/format";
import { useDashboardFilters } from "@/hooks/useDashboardFilters";
import { DeltaMap, SparklineMap, useDelta24h } from "@/hooks/useDelta24h";
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
  TableComponent: React.ComponentType<{
    snapshots: T[];
    deltas?: DeltaMap;
    sparklines?: SparklineMap;
  }>;
  seriesHrefBase: string;
  deltaEndpoint: "rates" | "pools" | "vaults";
  assetOrder?: string[];
  assetFilterLabel?: string;
  currentSectionLabel?: string;
  bestRatesTitle?: string;
  /**
   * Extra text folded into the search haystack, on top of the
   * protocol/chain/asset defaults. Vaults use it for the curator's
   * product name, which `meta.asset` doesn't carry.
   */
  extraSearchText?: (snap: T) => string;
  /** Carousel card headline override — see RateCard's `label`. */
  cardLabel?: (snap: T) => string;
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
  extraSearchText,
  cardLabel,
}: DashboardProps<T>) {
  const filters = useDashboardFilters(useData, assetOrder);
  // Carousels always show the full universe — chips only narrow the table.
  const unfiltered = useData(null, null, null);
  const { deltas, sparklines } = useDelta24h(deltaEndpoint);

  const [search, setSearch] = useState("");
  const searchedData = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return filters.data;
    return filters.data.filter((s) => {
      const protocol = formatProtocol(s.meta.protocol).toLowerCase();
      const chain = formatChain(s.meta.chain).toLowerCase();
      const asset = s.meta.asset.toLowerCase();
      const extra = extraSearchText?.(s).toLowerCase() ?? "";
      return (
        s.meta.protocol.toLowerCase().includes(q) ||
        protocol.includes(q) ||
        s.meta.chain.toLowerCase().includes(q) ||
        chain.includes(q) ||
        asset.includes(q) ||
        (extra !== "" && extra.includes(q))
      );
    });
  }, [filters.data, search, extraSearchText]);

  return (
    <main className="w-full max-w-6xl mx-auto px-4 py-10 min-w-0">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-zinc-100 tracking-tight">
          {title}
        </h1>
        <p className="text-sm text-zinc-500 mt-1.5">{subtitle}</p>
      </header>

      <WatchlistCarousel
        snapshots={unfiltered.data}
        hrefBase={seriesHrefBase}
        title="Watchlist"
        labelOf={cardLabel}
      />

      <BestRatesCarousel
        snapshots={unfiltered.data}
        hrefBase={seriesHrefBase}
        title={bestRatesTitle}
        labelOf={cardLabel}
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
          <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider shrink-0">
            {currentSectionLabel}
            <span className="ml-2 text-zinc-600 normal-case font-normal">
              ({searchedData.length}
              {search.trim() && filters.data.length !== searchedData.length
                ? ` / ${filters.data.length}`
                : ""}
              )
            </span>
          </h2>
          <div className="flex items-center gap-3 flex-wrap ml-auto">
            <TableSearch value={search} onChange={setSearch} />
            <LastUpdated
              date={filters.lastUpdated}
              refreshing={filters.loading && filters.data.length > 0}
            />
          </div>
        </div>

        {filters.loading && filters.data.length === 0 ? (
          <div className="text-center text-zinc-600 py-10 text-sm">
            Loading…
          </div>
        ) : searchedData.length === 0 && search.trim() ? (
          <p className="text-center text-zinc-600 py-8 text-sm">
            Nothing matches “{search}”.
          </p>
        ) : (
          <div
            className={`transition-opacity duration-200 ${
              filters.loading ? "opacity-60" : "opacity-100"
            }`}
          >
            <TableComponent
              snapshots={searchedData}
              deltas={deltas}
              sparklines={sparklines}
            />
          </div>
        )}
      </section>
    </main>
  );
}
