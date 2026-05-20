"use client";

import CardCarousel from "@/components/CardCarousel";
import RateCard from "@/components/RateCard";
import { seriesKey, useWatchlist } from "@/hooks/useWatchlist";
import { BaseSnapshot } from "@/lib/types";

interface Props<T extends BaseSnapshot> {
  snapshots: T[];
  hrefBase: string;
  title?: string;
}

function buildHref(base: string, snap: BaseSnapshot): string {
  const p = new URLSearchParams({
    protocol: snap.meta.protocol,
    chain: snap.meta.chain,
    asset: snap.meta.asset,
  });
  return `${base}?${p.toString()}`;
}

export default function WatchlistCarousel<T extends BaseSnapshot>({
  snapshots,
  hrefBase,
  title = "Watchlist",
}: Props<T>) {
  const watch = useWatchlist();

  if (watch.count === 0) return null;

  // Only render rows that the user currently has both in the watchlist
  // and that exist in the current data slice.
  const entries = snapshots.filter((s) =>
    watch.has(seriesKey(s.meta.protocol, s.meta.chain, s.meta.asset)),
  );

  if (entries.length === 0) return null;

  return (
    <CardCarousel title={title} count={entries.length} storageKey="ui:watchlist-open">
      {entries.map((snap) => (
        <RateCard
          key={`${snap.meta.protocol}-${snap.meta.chain}-${snap.meta.asset}`}
          snap={snap}
          href={buildHref(hrefBase, snap)}
        />
      ))}
    </CardCarousel>
  );
}
