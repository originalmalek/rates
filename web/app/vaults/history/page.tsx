"use client";

import { Suspense } from "react";
import HistoryDashboard from "@/components/HistoryDashboard";
import { useVaultHistory } from "@/hooks/useVaultHistory";
import { useVaults } from "@/hooks/useVaults";

const ASSET_ORDER = ["USDC", "USDT", "DAI", "USDS", "USDE", "CRVUSD", "PYUSD"];

function VaultsHistoryPage() {
  return (
    <HistoryDashboard
      title="Vaults — 24h APY History"
      subtitle="Hourly-bucketed vault yield for the top stablecoin vault series by TVL."
      useData={useVaults}
      useHistoryData={useVaultHistory}
      backHref="/vaults"
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
      <VaultsHistoryPage />
    </Suspense>
  );
}
