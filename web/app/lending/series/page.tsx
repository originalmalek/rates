"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import SeriesDetail from "@/components/SeriesDetail";
import { useRateSeriesHistory } from "@/hooks/useSeriesHistory";
import { useRateSnapshotsPage } from "@/hooks/useSnapshotsPage";

function LendingSeriesPage() {
  const params = useSearchParams();
  const protocol = params.get("protocol") ?? "";
  const chain = params.get("chain") ?? "";
  const asset = params.get("asset") ?? "";

  if (!protocol || !chain || !asset) {
    return (
      <main className="max-w-6xl mx-auto px-4 py-10 text-zinc-500 text-sm">
        Missing series parameters.
      </main>
    );
  }

  return (
    <SeriesDetail
      protocol={protocol}
      chain={chain}
      asset={asset}
      backHref="/"
      backLabel="Back to rates"
      useHistory={useRateSeriesHistory}
      useSnapshotsPage={useRateSnapshotsPage}
      hasBorrow
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
      <LendingSeriesPage />
    </Suspense>
  );
}
