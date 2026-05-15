"use client";

interface Props {
  delta: number | null;
  // Threshold (percentage points) under which the change is shown as a
  // neutral "≈0.00" rather than coloured up/down — APY noise.
  epsilon?: number;
}

export default function DeltaBadge({ delta, epsilon = 0.005 }: Props) {
  if (delta === null) return null;
  const abs = Math.abs(delta);
  const flat = abs < epsilon;
  const color = flat
    ? "text-zinc-500"
    : delta > 0
      ? "text-emerald-400/90"
      : "text-rose-400/90";
  const sign = flat ? "" : delta > 0 ? "+" : "−";
  return (
    <span
      className={`block text-[10px] font-mono tabular-nums leading-none mt-0.5 ${color}`}
      title="Change vs ~24h ago"
    >
      {sign}
      {abs.toFixed(2)}
    </span>
  );
}
