"use client";

import { Suspense } from "react";
import HistoryDashboard from "@/components/HistoryDashboard";
import { usePoolHistory } from "@/hooks/usePoolHistory";
import { usePools } from "@/hooks/usePools";

function PoolsHistoryPage() {
  return (
    <HistoryDashboard
      title="Liquidity Pools — 24h APY History"
      subtitle="Hourly-bucketed LP yield for the top stablecoin pool series by TVL."
      useData={usePools}
      useHistoryData={usePoolHistory}
      backHref="/pools"
      assetOrder={[]}
      assetFilterLabel="Pools"
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
      <PoolsHistoryPage />
    </Suspense>
  );
}
