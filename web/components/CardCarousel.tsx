"use client";

import { ReactNode, useEffect, useRef, useState } from "react";

interface Props {
  title: string;
  count: number;
  children: ReactNode;
  /** Trailing element rendered next to the title (e.g. a "clear" button). */
  action?: ReactNode;
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

export default function CardCarousel({ title, count, children, action }: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

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
  }, [count]);

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const delta = el.clientWidth * 0.8 * (direction === "left" ? -1 : 1);
    el.scrollBy({ left: delta, behavior: "smooth" });
  };

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3 gap-3">
        <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
          {title}
          <span className="ml-2 text-zinc-600 normal-case font-normal">({count})</span>
        </h2>
        {action}
      </div>
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
    </section>
  );
}
