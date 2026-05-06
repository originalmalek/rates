"use client";

import { useRates } from "@/hooks/useRates";
import { useHistory } from "@/hooks/useHistory";
import RatesTable from "@/components/RatesTable";
import ApyChart from "@/components/ApyChart";

function LastUpdated({ date }: { date: Date | null }) {
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

export default function DashboardPage() {
  const rates = useRates();
  const history = useHistory(24, 60);

  return (
    <main className="max-w-6xl mx-auto px-4 py-10">
      <header className="mb-10">
        <h1 className="text-2xl font-semibold text-zinc-100 tracking-tight">
          DeFi Stablecoin Rates
        </h1>
        <p className="text-sm text-zinc-500 mt-1.5">
          Live lending and borrowing rates across DeFi protocols.
          Auto-refreshes every 60 seconds.
        </p>
      </header>

      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
            Current Rates
          </h2>
          <LastUpdated date={rates.lastUpdated} />
        </div>

        {rates.loading && rates.data.length === 0 ? (
          <div className="text-center text-zinc-600 py-10 text-sm">
            Loading rates…
          </div>
        ) : (
          <RatesTable snapshots={rates.data} />
        )}
      </section>

      <section className="mb-10">
        <div className="mb-4">
          <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
            Supply APY &mdash; 24h History
          </h2>
        </div>

        {history.loading && history.data.length === 0 ? (
          <div className="text-center text-zinc-600 py-10 text-sm">
            Loading history…
          </div>
        ) : history.data.length > 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-[var(--surface)] p-4">
            <ApyChart snapshots={history.data} />
          </div>
        ) : (
          <p className="text-center text-zinc-600 py-8 text-sm">
            No history data available.
          </p>
        )}
      </section>
    </main>
  );
}
