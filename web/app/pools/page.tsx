"use client";

import { Suspense } from "react";
import Dashboard from "@/components/Dashboard";
import PoolsTable from "@/components/PoolsTable";
import { usePools } from "@/hooks/usePools";

function PoolsPage() {
  return (
    <Dashboard
      title="Stablecoin Liquidity Pools"
      subtitle="Live APY and TVL for stablecoin LP pools across AMM/DEX protocols. Auto-refreshes every 60 seconds."
      useData={usePools}
      TableComponent={PoolsTable}
      historyHref="/pools/history"
      seriesHrefBase="/pools/series"
      assetOrder={[]}
      assetFilterLabel="Pools"
      currentSectionLabel="Current Pools"
      bestRatesTitle="Top Pools by APY"
    />
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="max-w-6xl mx-auto px-4 py-10 text-zinc-600 text-sm">
          Loading…
        </div>
      }
    >
      <PoolsPage />
    </Suspense>
  );
}
