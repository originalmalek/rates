"use client";

import { Suspense } from "react";
import Dashboard from "../Dashboard";
import PoolsTable from "@/components/PoolsTable";
import { usePools } from "@/hooks/usePools";
import { usePoolHistory } from "@/hooks/usePoolHistory";

function PoolsPage() {
  return (
    <Dashboard
      title="Stablecoin Liquidity Pools"
      subtitle="Live APY and TVL for stablecoin LP pools across AMM/DEX protocols. Auto-refreshes every 60 seconds."
      useData={usePools}
      useHistoryData={usePoolHistory}
      TableComponent={PoolsTable}
      assetOrder={[]}
      assetFilterLabel="Pools"
      currentSectionLabel="Current Pools"
      historySectionLabel="LP APY — 24h History"
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
