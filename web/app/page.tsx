"use client";

import { Suspense } from "react";
import Dashboard from "./Dashboard";
import RatesTable from "@/components/RatesTable";
import { useRates } from "@/hooks/useRates";
import { useHistory } from "@/hooks/useHistory";

const ASSET_ORDER = ["USDC", "USDT", "DAI", "USDS", "sDAI"];

function RatesPage() {
  return (
    <Dashboard
      title="DeFi Stablecoin Rates"
      subtitle="Live lending and borrowing rates across DeFi protocols. Auto-refreshes every 60 seconds."
      useData={useRates}
      useHistoryData={useHistory}
      TableComponent={RatesTable}
      assetOrder={ASSET_ORDER}
      assetFilterLabel="Stablecoins"
      currentSectionLabel="Current Rates"
      historySectionLabel="Supply APY — 24h History"
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
      <RatesPage />
    </Suspense>
  );
}
