"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const START = "admin:navigation-start";

/** Shows the loading line for a navigation that isn't a link tap (`router.push` from a dropdown, the search box). */
export function startNavProgress() {
  window.dispatchEvent(new Event(START));
}

/**
 * A thin line across the top of the screen while the next page or filter result loads, as on
 * YouTube: blocking pages keep the current page up until the next one is ready, so this shows
 * it's working. It starts on any tap of an in-app link (menu, filters, pages, sorting, rows) or
 * on `startNavProgress()`, and stops when the URL changes. While it runs, <html> carries
 * `data-navigating`, which dims a list's rows (globals.css). It waits 120ms before showing, so a
 * quick change never flashes it. Render once, inside <Suspense> (it reads the search params).
 */
export function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const url = `${pathname}?${search}`;
  // The URL a navigation started from: once the URL is something else, it has finished.
  const [from, setFrom] = useState<string | null>(null);
  const pending = from === url;

  useEffect(() => {
    const start = () => setFrom(`${location.pathname}?${new URLSearchParams(location.search)}`);
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element).closest("a");
      if (!a || !a.href || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      const url = new URL(a.href);
      if (url.origin !== location.origin) return;
      // The same page (or only a #hash away) doesn't navigate, so nothing would stop the line.
      if (url.pathname === location.pathname && url.search === location.search) return;
      start();
    };
    // Next's <Link> calls preventDefault itself, so that can't tell a cancelled navigation apart;
    // the settings page's unsaved-changes guard stops the click before it gets here instead.
    window.addEventListener("click", onClick);
    window.addEventListener(START, start);
    return () => {
      window.removeEventListener("click", onClick);
      window.removeEventListener(START, start);
    };
  }, []);

  useEffect(() => {
    if (!pending) return;
    document.documentElement.dataset.navigating = "";
    // A failed or abandoned navigation never changes the URL; don't leave the line up forever.
    const t = setTimeout(() => setFrom(null), 15000);
    return () => {
      clearTimeout(t);
      delete document.documentElement.dataset.navigating;
    };
  }, [pending]);

  if (!pending) return null;
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px] origin-left animate-nav-progress bg-gold opacity-0"
    />
  );
}
