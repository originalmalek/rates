"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Lending", match: (p: string) => p === "/" || p.startsWith("/lending") },
  { href: "/pools", label: "Liquidity Pools", match: (p: string) => p.startsWith("/pools") },
];

export default function TabsNav() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-zinc-800 bg-[var(--surface)]/40 backdrop-blur-sm sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex gap-1">
          {TABS.map((tab) => {
            const active = tab.match(pathname);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  active
                    ? "text-zinc-100 border-emerald-400"
                    : "text-zinc-500 border-transparent hover:text-zinc-300"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
