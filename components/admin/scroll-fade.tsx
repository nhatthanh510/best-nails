"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * A row that scrolls sideways (the status tabs on a phone), with a soft fade on whichever edge has
 * more hidden past it, so it's clear there's more to swipe to. The current item (aria-current) is
 * scrolled to the middle when it renders, clear of the fades. The fades are a mask set from data
 * attributes; a row that fits has none.
 */
export function ScrollFade({ className, children }: { className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      el.toggleAttribute("data-more-left", el.scrollLeft > 4);
      el.toggleAttribute("data-more-right", el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    };
    el.querySelector<HTMLElement>("[aria-current]")?.scrollIntoView({ block: "nearest", inline: "center" });
    update();
    el.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, []);

  return (
    <div
      ref={ref}
      className={cn(
        "overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        "data-more-right:[mask-image:linear-gradient(to_right,black_80%,transparent)]",
        "data-more-left:[mask-image:linear-gradient(to_right,transparent,black_20%)]",
        "data-more-left:data-more-right:[mask-image:linear-gradient(to_right,transparent,black_15%,black_85%,transparent)]",
        className,
      )}
    >
      {children}
    </div>
  );
}
