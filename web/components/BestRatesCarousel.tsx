"use client";

import CardCarousel from "@/components/CardCarousel";
import RateCard from "@/components/RateCard";
import { BaseSnapshot } from "@/lib/types";

interface Props<T extends BaseSnapshot> {
  snapshots: T[];
  hrefBase: string;
  limit?: number;
  assetOrder?: string[];
  title?: string;
}

interface BestEntry<T extends BaseSnapshot> {
  asset: string;
  best: T;
}

function pickBestPerAsset<T extends BaseSnapshot>(
  snapshots: T[],
  assetOrder: string[],
  limit: number,
): BestEntry<T>[] {
  const byAsset = new Map<string, T>();
  for (const s of snapshots) {
    if (s.supply_apy === null) continue;
    const cur = byAsset.get(s.meta.asset);
    if (!cur || (cur.supply_apy ?? -Infinity) < (s.supply_apy ?? -Infinity)) {
      byAsset.set(s.meta.asset, s);
    }
  }
  const entries: BestEntry<T>[] = [...byAsset.entries()].map(([asset, best]) => ({
    asset,
    best,
  }));
  const orderIndex = new Map(assetOrder.map((a, i) => [a, i]));
  entries.sort((a, b) => {
    const ai = orderIndex.get(a.asset);
    const bi = orderIndex.get(b.asset);
    if (ai !== undefined && bi !== undefined) return ai - bi;
    if (ai !== undefined) return -1;
    if (bi !== undefined) return 1;
    return (b.best.supply_apy ?? 0) - (a.best.supply_apy ?? 0);
  });
  return entries.slice(0, limit);
}

function buildHref(base: string, snap: BaseSnapshot): string {
  const p = new URLSearchParams({
    protocol: snap.meta.protocol,
    chain: snap.meta.chain,
    asset: snap.meta.asset,
  });
  return `${base}?${p.toString()}`;
}

export default function BestRatesCarousel<T extends BaseSnapshot>({
  snapshots,
  hrefBase,
  limit = 12,
  assetOrder = [],
  title = "Best Rates",
}: Props<T>) {
  const entries = pickBestPerAsset(snapshots, assetOrder, limit);
  if (entries.length === 0) return null;

  return (
    <CardCarousel title={title} count={entries.length}>
      {entries.map((entry) => (
        <RateCard
          key={`${entry.asset}-${entry.best.meta.protocol}-${entry.best.meta.chain}`}
          snap={entry.best}
          href={buildHref(hrefBase, entry.best)}
          badge="Best"
        />
      ))}
    </CardCarousel>
  );
}
