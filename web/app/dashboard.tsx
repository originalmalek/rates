"use client";

import { useMemo, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useRates } from "@/hooks/useRates";
import { useHistory } from "@/hooks/useHistory";
import RatesTable from "@/components/RatesTable";
import ApyChart from "@/components/ApyChart";
import ChainFilter from "@/components/ChainFilter";
import { RateSnapshot } from "@/lib/types";

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

function uniqueChains(snapshots: RateSnapshot[]): string[] {
  const set = new Set<string>();
  for (const s of snapshots) set.add(s.meta.chain);
  return Array.from(set).sort();
}

const CHAINS_PARAM = "chains";

export default function Dashboard() {
  const rates = useRates();
  const history = useHistory(24, 60);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const availableChains = useMemo(
    () => uniqueChains(rates.data),
    [rates.data]
  );

  // Selected = URL value if present, else all available.
  // Empty string ("?chains=") = none selected (explicit).
  const selectedChains = useMemo(() => {
    const raw = searchParams.get(CHAINS_PARAM);
    if (raw === null) return new Set(availableChains);
    if (raw === "") return new Set<string>();
    return new Set(raw.split(",").filter(Boolean));
  }, [searchParams, availableChains]);

  const onChainsChange = useCallback(
    (next: Set<string>) => {
      const params = new URLSearchParams(searchParams.toString());
      const allOn =
        availableChains.length > 0 &&
        availableChains.every((c) => next.has(c));
      if (allOn) {
        params.delete(CHAINS_PARAM);
      } else {
        params.set(CHAINS_PARAM, Array.from(next).sort().join(","));
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams, availableChains]
  );

  const filteredRates = useMemo(
    () => rates.data.filter((s) => selectedChains.has(s.meta.chain)),
    [rates.data, selectedChains]
  );

  const filteredHistory = useMemo(
    () => history.data.filter((s) => selectedChains.has(s.meta.chain)),
    [history.data, selectedChains]
  );

  return (
    <main className="max-w-6xl mx-auto px-4 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-zinc-100 tracking-tight">
          DeFi Stablecoin Rates
        </h1>
        <p className="text-sm text-zinc-500 mt-1.5">
          Live lending and borrowing rates across DeFi protocols.
          Auto-refreshes every 60 seconds.
        </p>
      </header>

      <div className="mb-6">
        <ChainFilter
          available={availableChains}
          selected={selectedChains}
          onChange={onChainsChange}
        />
      </div>

      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
            Current Rates
            <span className="ml-2 text-zinc-600 normal-case font-normal">
              ({filteredRates.length})
            </span>
          </h2>
          <LastUpdated date={rates.lastUpdated} />
        </div>

        {rates.loading && rates.data.length === 0 ? (
          <div className="text-center text-zinc-600 py-10 text-sm">
            Loading rates…
          </div>
        ) : (
          <RatesTable snapshots={filteredRates} />
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
        ) : filteredHistory.length > 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-[var(--surface)] p-4">
            <ApyChart snapshots={filteredHistory} />
          </div>
        ) : (
          <p className="text-center text-zinc-600 py-8 text-sm">
            No history data for selected chains.
          </p>
        )}
      </section>
    </main>
  );
}
