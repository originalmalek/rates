"use client";

import { ReactNode, useEffect, useRef, useState } from "react";

interface Props {
  title: string;
  count: number;
  children: ReactNode;
  /** Trailing element rendered next to the title (e.g. a "clear" button). */
  action?: ReactNode;
  /**
   * If set, the header becomes a click-to-collapse toggle and the
   * open/closed state is persisted in localStorage under this key.
   */
  storageKey?: string;
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

function loadOpen(key: string | undefined, fallback: boolean): boolean {
  if (!key || typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return raw === "1";
  } catch {
    return fallback;
  }
}

function saveOpen(key: string, open: boolean): void {
  try {
    window.localStorage.setItem(key, open ? "1" : "0");
  } catch {
    // ignore
  }
}

export default function CardCarousel({
  title,
  count,
  children,
  action,
  storageKey,
}: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);
  const [open, setOpen] = useState(true);
  const collapsible = Boolean(storageKey);

  // Hydrate the open flag from storage after mount so SSR/client match.
  useEffect(() => {
    if (!storageKey) return;
    setOpen(loadOpen(storageKey, true));
  }, [storageKey]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !open) return;
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
  }, [count, open]);

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const delta = el.clientWidth * 0.8 * (direction === "left" ? -1 : 1);
    el.scrollBy({ left: delta, behavior: "smooth" });
  };

  const toggle = () => {
    if (!storageKey) return;
    setOpen((cur) => {
      const next = !cur;
      saveOpen(storageKey, next);
      return next;
    });
  };

  const heading = (
    <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider inline-flex items-center gap-1.5">
      {collapsible && (
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`w-4 h-4 text-zinc-600 transition-transform duration-200 ${
            open ? "" : "-rotate-90"
          }`}
        >
          <path
            fillRule="evenodd"
            d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
            clipRule="evenodd"
          />
        </svg>
      )}
      <span>{title}</span>
      <span className="ml-1 text-zinc-600 normal-case font-normal">({count})</span>
    </h2>
  );

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3 gap-3">
        {collapsible ? (
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            className="cursor-pointer select-none hover:text-zinc-300 transition-colors"
          >
            {heading}
          </button>
        ) : (
          heading
        )}
        {action}
      </div>
      {open && (
        <div className="relative">
          <ScrollButton dir="left" onClick={() => scroll("left")} disabled={!canLeft} />
          <ScrollButton dir="right" onClick={() => scroll("right")} disabled={!canRight} />
          <div
            ref={scrollRef}
            className="flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {children}
          </div>
        </div>
      )}
    </section>
  );
}
