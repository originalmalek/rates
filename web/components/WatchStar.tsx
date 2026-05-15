"use client";

import { MouseEvent } from "react";

interface Props {
  active: boolean;
  onToggle: () => void;
  size?: "sm" | "md";
}

export default function WatchStar({ active, onToggle, size = "sm" }: Props) {
  const px = size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";
  const handle = (e: MouseEvent<HTMLButtonElement>) => {
    // Star sits inside a clickable row — don't trigger the row's nav.
    e.stopPropagation();
    onToggle();
  };
  return (
    <button
      type="button"
      onClick={handle}
      aria-label={active ? "Remove from watchlist" : "Add to watchlist"}
      aria-pressed={active}
      title={active ? "Remove from watchlist" : "Add to watchlist"}
      className={`inline-flex items-center justify-center transition-colors ${
        active
          ? "text-amber-400 hover:text-amber-300"
          : "text-zinc-600 hover:text-zinc-300"
      }`}
    >
      <svg
        viewBox="0 0 20 20"
        fill={active ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={1.5}
        className={px}
      >
        <path
          strokeLinejoin="round"
          d="M9.594 3.94c.69-1.413 2.122-1.413 2.812 0l1.638 3.355a1.65 1.65 0 0 0 1.24.9l3.704.538c1.557.226 2.182 2.144 1.057 3.243l-2.681 2.612a1.65 1.65 0 0 0-.473 1.46l.633 3.685c.266 1.55-1.36 2.733-2.752 2.002l-3.311-1.74a1.65 1.65 0 0 0-1.534 0l-3.311 1.74c-1.393.732-3.019-.45-2.753-2.002l.633-3.685a1.65 1.65 0 0 0-.473-1.46L.341 11.976c-1.125-1.099-.5-3.017 1.057-3.243l3.704-.538a1.65 1.65 0 0 0 1.24-.9L7.98 3.94Z"
          transform="translate(0 -1.5) scale(0.85)"
        />
      </svg>
    </button>
  );
}
