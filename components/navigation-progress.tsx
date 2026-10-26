"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// Below this, a navigation counts as instant and the bar never shows (no flash on every click).
const SHOW_AFTER_MS = 120;
// A navigation that never finishes (an error, a cancelled click) mustn't leave the bar up.
const GIVE_UP_MS = 15_000;

/**
 * A thin bar across the top while a page is on its way, as in most web apps. It starts when an
 * internal link is clicked and finishes when the URL changes. A click before the destination's
 * prefetch finished waits for the server, and on a slow connection that's a noticeable pause.
 * Render inside <Suspense>: it reads the URL.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const url = `${pathname}?${searchParams}`;
  const [progress, setProgress] = useState<number | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  function clearTimers() {
    for (const t of timers.current) clearTimeout(t);
    timers.current = [];
  }

  // Start on a click on a link to another page of this site, opened in this tab. It listens last
  // (window, bubbling), so a click something stopped on the way never starts it, e.g. Settings
  // asking "Leave without saving?". defaultPrevented can't tell us that: <Link> always sets it.
  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest?.("a[href]");
      if (!(link instanceof HTMLAnchorElement) || (link.target && link.target !== "_self") || link.hasAttribute("download")) return;
      const next = new URL(link.href, location.href);
      if (next.origin !== location.origin || (next.pathname === location.pathname && next.search === location.search)) return;

      clearTimers();
      timers.current.push(
        setTimeout(() => {
          setProgress(15);
          // Creeps towards 90% while waiting; the last stretch is the page arriving.
          const creep = (value: number) => {
            timers.current.push(
              setTimeout(() => {
                const nextValue = value + (90 - value) * 0.15;
                setProgress(nextValue);
                creep(nextValue);
              }, 300),
            );
          };
          creep(15);
        }, SHOW_AFTER_MS),
        setTimeout(() => {
          clearTimers();
          setProgress(null);
        }, GIVE_UP_MS),
      );
    }
    window.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("click", onClick);
      clearTimers();
    };
  }, []);

  // Finish when the new page's URL is in place: fill the bar (here, during render, as React
  // recommends for state that follows a prop) ...
  const [shownUrl, setShownUrl] = useState(url);
  if (url !== shownUrl) {
    setShownUrl(url);
    if (progress !== null) setProgress(100);
  }
  // ... then stop the creeping and fade it out.
  useEffect(() => {
    clearTimers();
    timers.current.push(setTimeout(() => setProgress(null), 250));
  }, [url]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px] transition-opacity duration-200"
      style={{ opacity: progress === null || progress === 100 ? 0 : 1, transitionDelay: progress === 100 ? "150ms" : "0ms" }}
    >
      <div
        className="h-full bg-gold-sheen shadow-[0_0_8px_var(--color-gold)] transition-[width] duration-300 ease-out"
        style={{ width: `${progress ?? 0}%` }}
      />
    </div>
  );
}
