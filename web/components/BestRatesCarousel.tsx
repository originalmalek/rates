"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BaseSnapshot } from "@/lib/types";
import { chainColor } from "@/lib/chainColors";
import { formatApy, formatChain, formatProtocol, formatTvl } from "@/lib/format";

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
  // Prioritise the canonical asset order, then sort the rest by APY desc.
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

function PoolLabel({ asset }: { asset: string }) {
  // For LP pools the asset symbol is multi-token "USDC-USDT-DAI".
  // For single-asset lending it's just "USDC".
  const tokens = asset.split("-");
  if (tokens.length === 1) {
    return <span>{tokens[0]}</span>;
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {tokens.map((t, i) => (
        <span key={`${t}-${i}`} className="inline-flex items-center gap-1">
          <span>{t}</span>
          {i < tokens.length - 1 && (
            <span className="text-zinc-600 font-normal">·</span>
          )}
        </span>
      ))}
    </span>
  );
}

function Card<T extends BaseSnapshot>({
  entry,
  href,
}: {
  entry: BestEntry<T>;
  href: string;
}) {
  const { asset, best } = entry;
  const color = chainColor(best.meta.chain);
  return (
    <Link
      href={href}
      className="group snap-start shrink-0 w-[220px] sm:w-[240px] rounded-xl border border-zinc-800 bg-[var(--surface)] hover:bg-[var(--surface-2)] hover:border-zinc-700 transition-colors p-4 flex flex-col"
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="text-lg font-semibold text-zinc-100 tracking-tight leading-tight truncate">
          <PoolLabel asset={asset} />
        </div>
        <span className="text-[10px] uppercase tracking-wider text-zinc-500 mt-1 whitespace-nowrap">
          Best
        </span>
      </div>
      <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-0.5">
        Supply APY
      </div>
      <div className="text-2xl font-mono tabular-nums text-emerald-400 leading-none mb-3">
        {formatApy(best.supply_apy)}
      </div>
      <div className="mt-auto pt-3 border-t border-zinc-800/80 flex flex-col gap-1">
        <div className="text-sm text-zinc-300 font-medium truncate">
          {formatProtocol(best.meta.protocol)}
        </div>
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 text-zinc-400 min-w-0">
            <span
              className="inline-block w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: color }}
            />
            <span className="truncate">{formatChain(best.meta.chain)}</span>
          </span>
          <span className="font-mono tabular-nums text-zinc-500 shrink-0">
            {formatTvl(best.tvl_usd)}
          </span>
        </div>
      </div>
    </Link>
  );
}

function ScrollButton({
  dir,
  onClick,
  disabled,
}: {
  dir: "left" | "right";
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === "left" ? "Scroll left" : "Scroll right"}
      className={`hidden md:flex absolute top-1/2 -translate-y-1/2 ${
        dir === "left" ? "-left-3" : "-right-3"
      } z-10 w-8 h-8 items-center justify-center rounded-full border border-zinc-800 bg-[var(--surface-2)] text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition-colors disabled:opacity-0 disabled:pointer-events-none`}
    >
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        {dir === "left" ? (
          <path
            fillRule="evenodd"
            d="M12.78 4.22a.75.75 0 0 1 0 1.06L8.06 10l4.72 4.72a.75.75 0 1 1-1.06 1.06l-5.25-5.25a.75.75 0 0 1 0-1.06l5.25-5.25a.75.75 0 0 1 1.06 0Z"
            clipRule="evenodd"
          />
        ) : (
          <path
            fillRule="evenodd"
            d="M7.22 4.22a.75.75 0 0 1 1.06 0l5.25 5.25a.75.75 0 0 1 0 1.06l-5.25 5.25a.75.75 0 1 1-1.06-1.06L11.94 10 7.22 5.28a.75.75 0 0 1 0-1.06Z"
            clipRule="evenodd"
          />
        )}
      </svg>
    </button>
  );
}

export default function BestRatesCarousel<T extends BaseSnapshot>({
  snapshots,
  hrefBase,
  limit = 12,
  assetOrder = [],
  title = "Best Rates",
}: Props<T>) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const entries = pickBestPerAsset(snapshots, assetOrder, limit);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => {
      setCanLeft(el.scrollLeft > 4);
      setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [entries.length]);

  if (entries.length === 0) return null;

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const delta = el.clientWidth * 0.8 * (direction === "left" ? -1 : 1);
    el.scrollBy({ left: delta, behavior: "smooth" });
  };

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
          {title}
          <span className="ml-2 text-zinc-600 normal-case font-normal">
            ({entries.length})
          </span>
        </h2>
      </div>
      <div className="relative">
        <ScrollButton dir="left" onClick={() => scroll("left")} disabled={!canLeft} />
        <ScrollButton dir="right" onClick={() => scroll("right")} disabled={!canRight} />
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {entries.map((entry) => (
            <Card
              key={`${entry.asset}-${entry.best.meta.protocol}-${entry.best.meta.chain}`}
              entry={entry}
              href={buildHref(hrefBase, entry.best)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
