"use client";

import Link from "next/link";
import { useState } from "react";
import ApyChart from "@/components/ApyChart";
import Pagination from "@/components/Pagination";
import { chainColor } from "@/lib/chainColors";
import { formatApy, formatChain, formatProtocol, formatTvl } from "@/lib/format";
import { BaseSnapshot, RateSnapshot } from "@/lib/types";

interface UseHistoryResult<T> {
  data: T[];
  loading: boolean;
  error: string | null;
}

interface UseSnapshotsPageResult<T> {
  items: T[];
  total: number;
  loading: boolean;
  error: string | null;
}

interface SeriesDetailProps<T extends BaseSnapshot> {
  protocol: string;
  chain: string;
  asset: string;
  backHref: string;
  backLabel: string;
  useHistory: (
    protocol: string,
    chain: string,
    asset: string,
    hours: number,
    bucketMinutes: number,
  ) => UseHistoryResult<T>;
  useSnapshotsPage: (
    protocol: string,
    chain: string,
    asset: string,
    limit: number,
    offset: number,
  ) => UseSnapshotsPageResult<T>;
  /** Render an extra column for borrow APY when present (lending only). */
  hasBorrow?: boolean;
}

const PER_PAGE = 50;

interface RangeOption {
  key: string;
  label: string;
  hours: number;
  bucketMinutes: number;
}

const RANGES: RangeOption[] = [
  { key: "24h", label: "24h", hours: 24, bucketMinutes: 60 },
  { key: "7d", label: "7d", hours: 24 * 7, bucketMinutes: 60 * 6 },
  { key: "30d", label: "30d", hours: 24 * 30, bucketMinutes: 60 * 24 },
  { key: "90d", label: "90d", hours: 24 * 90, bucketMinutes: 60 * 24 },
];

function RangeSwitcher({
  active,
  onChange,
}: {
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg border border-zinc-800 bg-[var(--surface)] p-0.5">
      {RANGES.map((r) => {
        const selected = r.key === active;
        return (
          <button
            key={r.key}
            type="button"
            onClick={() => onChange(r.key)}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              selected
                ? "bg-zinc-800 text-zinc-100"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {r.label}
          </button>
        );
      })}
    </div>
  );
}

function LineToggle({
  label,
  color,
  active,
  onToggle,
}: {
  label: string;
  color: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border transition-colors ${
        active
          ? "border-zinc-700 bg-zinc-800/60 text-zinc-200"
          : "border-zinc-800 bg-transparent text-zinc-500 hover:text-zinc-300"
      }`}
    >
      <span
        className="inline-block w-2 h-2 rounded-full transition-opacity"
        style={{ backgroundColor: color, opacity: active ? 1 : 0.35 }}
      />
      {label}
    </button>
  );
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString([], {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SeriesDetail<T extends BaseSnapshot>({
  protocol,
  chain,
  asset,
  backHref,
  backLabel,
  useHistory,
  useSnapshotsPage,
  hasBorrow = false,
}: SeriesDetailProps<T>) {
  const [page, setPage] = useState(1);
  const offset = (page - 1) * PER_PAGE;

  const [rangeKey, setRangeKey] = useState<string>(RANGES[0].key);
  const range = RANGES.find((r) => r.key === rangeKey) ?? RANGES[0];

  const [showSupplyLine, setShowSupplyLine] = useState(true);
  const [showBorrowLine, setShowBorrowLine] = useState(true);
  // If user tries to hide both, snap the other one back on.
  const toggleSupply = () => {
    setShowSupplyLine((cur) => {
      const next = !cur;
      if (!next && !showBorrowLine) setShowBorrowLine(true);
      return next;
    });
  };
  const toggleBorrow = () => {
    setShowBorrowLine((cur) => {
      const next = !cur;
      if (!next && !showSupplyLine) setShowSupplyLine(true);
      return next;
    });
  };

  const history = useHistory(protocol, chain, asset, range.hours, range.bucketMinutes);
  const snapshots = useSnapshotsPage(protocol, chain, asset, PER_PAGE, offset);
  const latest = snapshots.items[0] as T | undefined;

  return (
    <main className="w-full max-w-6xl mx-auto px-4 py-10 min-w-0">
      <header className="mb-8">
        <Link
          href={backHref}
          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          ← {backLabel}
        </Link>
        <div className="flex items-baseline flex-wrap gap-3 mt-3">
          <h1 className="text-2xl font-semibold text-zinc-100 tracking-tight">
            {asset}
          </h1>
          <span className="text-sm text-zinc-400">
            on {formatProtocol(protocol)}
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs text-zinc-300">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ backgroundColor: chainColor(chain) }}
            />
            {formatChain(chain)}
          </span>
        </div>
        {latest && (
          <div className="flex gap-6 mt-4 text-sm">
            <Stat label="Supply APY" value={formatApy(latest.supply_apy)} color="text-emerald-400" />
            {hasBorrow && (
              <Stat
                label="Borrow APY"
                value={formatApy((latest as unknown as RateSnapshot).borrow_apy)}
                color="text-amber-400"
              />
            )}
            <Stat label="TVL" value={formatTvl(latest.tvl_usd)} color="text-zinc-200" />
          </div>
        )}
      </header>

      <section className="mb-10">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
            {hasBorrow ? "Supply & Borrow APY" : "Supply APY"}
            <span className="text-zinc-600 normal-case font-normal"> — {range.label}</span>
          </h2>
          <div className="flex items-center gap-2 flex-wrap">
            {hasBorrow && (
              <div className="inline-flex items-center gap-1.5">
                <LineToggle
                  label="Supply"
                  color="#34d399"
                  active={showSupplyLine}
                  onToggle={toggleSupply}
                />
                <LineToggle
                  label="Borrow"
                  color="#fbbf24"
                  active={showBorrowLine}
                  onToggle={toggleBorrow}
                />
              </div>
            )}
            <RangeSwitcher active={rangeKey} onChange={setRangeKey} />
          </div>
        </div>
        {history.loading && history.data.length === 0 ? (
          <div className="text-center text-zinc-600 py-10 text-sm">
            Loading chart…
          </div>
        ) : history.data.length > 0 ? (
          <div
            className={`rounded-xl border border-zinc-800 bg-[var(--surface)] p-4 transition-opacity duration-200 ${
              history.loading ? "opacity-60" : "opacity-100"
            }`}
          >
            <ApyChart
              snapshots={history.data}
              showBorrow={hasBorrow}
              hideSupplyLine={hasBorrow && !showSupplyLine}
              hideBorrowLine={hasBorrow && !showBorrowLine}
            />
          </div>
        ) : (
          <p className="text-center text-zinc-600 py-8 text-sm">
            No history available for this range.
          </p>
        )}
      </section>

      <section className="mb-10">
        <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4">
          Recent Snapshots
          <span className="ml-2 text-zinc-600 normal-case font-normal">
            ({snapshots.total.toLocaleString()})
          </span>
        </h2>

        {snapshots.loading && snapshots.items.length === 0 ? (
          <div className="text-center text-zinc-600 py-10 text-sm">
            Loading…
          </div>
        ) : snapshots.items.length === 0 ? (
          <p className="text-center text-zinc-600 py-8 text-sm">
            No snapshots collected yet.
          </p>
        ) : (
          <>
            <div
              className={`w-full min-w-0 overflow-x-auto rounded-xl border border-zinc-800 bg-[var(--surface)] transition-opacity duration-200 ${
                snapshots.loading ? "opacity-60" : "opacity-100"
              }`}
            >
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="text-zinc-500 uppercase text-[11px] tracking-wider">
                    <th className="px-5 py-3 font-medium text-left">Timestamp (local)</th>
                    <th className="px-5 py-3 font-medium text-left">Supply APY</th>
                    {hasBorrow && (
                      <th className="px-5 py-3 font-medium text-left">Borrow APY</th>
                    )}
                    <th className="px-5 py-3 font-medium text-right">TVL</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshots.items.map((snap, i) => (
                    <tr
                      key={`${snap.ts}-${i}`}
                      className="border-t border-zinc-800/60 hover:bg-zinc-800/30 transition-colors"
                    >
                      <td className="px-5 py-3 text-zinc-300 font-mono tabular-nums whitespace-nowrap">
                        {formatTimestamp(snap.ts)}
                      </td>
                      <td className="px-5 py-3 font-mono tabular-nums text-emerald-400">
                        {formatApy(snap.supply_apy)}
                      </td>
                      {hasBorrow && (
                        <td className="px-5 py-3 font-mono tabular-nums text-amber-400">
                          {formatApy((snap as unknown as RateSnapshot).borrow_apy)}
                        </td>
                      )}
                      <td className="px-5 py-3 font-mono tabular-nums text-right text-zinc-400">
                        {formatTvl(snap.tvl_usd)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={page}
              perPage={PER_PAGE}
              total={snapshots.total}
              onPageChange={setPage}
            />
          </>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</div>
      <div className={`font-mono tabular-nums text-lg ${color}`}>{value}</div>
    </div>
  );
}
