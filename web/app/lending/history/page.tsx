"use client";

import { Suspense } from "react";
import HistoryDashboard from "@/components/HistoryDashboard";
import { useHistory } from "@/hooks/useHistory";
import { useRates } from "@/hooks/useRates";

const ASSET_ORDER = ["USDC", "USDT", "DAI", "USDS", "sDAI"];

function LendingHistoryPage() {
  return (
    <HistoryDashboard
      title="Lending — 24h APY History"
      subtitle="Hourly-bucketed supply APY for the top stablecoin lending series by TVL."
      useData={useRates}
      useHistoryData={useHistory}
      backHref="/"
      assetOrder={ASSET_ORDER}
      assetFilterLabel="Stablecoins"
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
      <LendingHistoryPage />
    </Suspense>
  );
}
