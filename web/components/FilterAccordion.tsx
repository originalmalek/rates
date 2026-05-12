"use client";

import { useState } from "react";

interface Props {
  label: string;
  activeCount: number;
  totalCount: number;
  children: React.ReactNode;
}

export default function FilterAccordion({
  label,
  activeCount,
  totalCount,
  children,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      {/* Mobile toggle — hidden on md and above */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="md:hidden flex items-center gap-2 w-full text-left py-1"
      >
        <span className="text-[11px] uppercase tracking-wider text-zinc-500">
          {label}
        </span>
        <span className="text-[11px] text-zinc-400">
          {activeCount} / {totalCount}
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`ml-auto w-4 h-4 text-zinc-500 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        >
          <path
            fillRule="evenodd"
            d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {/* Children: hidden when closed on mobile, always visible on desktop */}
      <div className={`${open ? "block" : "hidden"} md:block`}>{children}</div>
    </div>
  );
}
