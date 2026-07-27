"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import SeriesDetail from "@/components/SeriesDetail";
import { useVaultSeriesHistory } from "@/hooks/useSeriesHistory";
import { useVaultSnapshotsPage } from "@/hooks/useSnapshotsPage";

function VaultsSeriesPage() {
  const params = useSearchParams();
  // pool_id identifies the series; the triple is only a header hint.
  const poolId = params.get("pool_id") ?? "";
  const protocol = params.get("protocol") ?? "";
  const chain = params.get("chain") ?? "";
  const asset = params.get("asset") ?? "";

  if (!poolId) {
    return (
      <main className="max-w-6xl mx-auto px-4 py-10 text-zinc-500 text-sm">
        Missing series parameters.
      </main>
    );
  }

  return (
    <SeriesDetail
      poolId={poolId}
      protocol={protocol}
      chain={chain}
      asset={asset}
      backHref="/vaults"
      backLabel="Back to vaults"
      useHistory={useVaultSeriesHistory}
      useSnapshotsPage={useVaultSnapshotsPage}
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
      <VaultsSeriesPage />
    </Suspense>
  );
}
