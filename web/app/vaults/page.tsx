"use client";

import { Suspense } from "react";
import Dashboard from "@/components/Dashboard";
import VaultsTable from "@/components/VaultsTable";
import { useVaults } from "@/hooks/useVaults";
import { VaultSnapshot } from "@/lib/types";

// The chips group by underlying stablecoin, so this is the same kind of
// list the lending tab uses — the vault's own name is not a filter axis.
const ASSET_ORDER = ["USDC", "USDT", "DAI", "USDS", "USDE", "CRVUSD", "PYUSD"];

// Module scope: both are useMemo/prop dependencies downstream, so an
// inline arrow would be a new identity on every render.
const vaultName = (snap: VaultSnapshot) => snap.meta.vault_name;

function VaultsPage() {
  return (
    <Dashboard
      title="Stablecoin Yield Vaults"
      subtitle="Live APY and TVL for curated stablecoin vaults. Auto-refreshes every 60 seconds."
      useData={useVaults}
      TableComponent={VaultsTable}
      seriesHrefBase="/vaults/series"
      deltaEndpoint="vaults"
      assetOrder={ASSET_ORDER}
      assetFilterLabel="Stablecoins"
      currentSectionLabel="Current Vaults"
      bestRatesTitle="Top Vaults by APY"
      extraSearchText={vaultName}
      cardLabel={vaultName}
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
      <VaultsPage />
    </Suspense>
  );
}
