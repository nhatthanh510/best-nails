"use client";

import { createPortal } from "react-dom";
import { useLinkStatus } from "next/link";

/**
 * A thin line across the top of the screen while the page a link opens is loading, as on
 * YouTube: the current page stays up until the next one is ready, so this shows it's working.
 * Render it inside a <Link>. It waits 120ms before showing, so a quick page never flashes it.
 * It's portalled to <body> because the phone menu hides (display: none) as soon as a link in
 * it is tapped, which would hide the line too.
 */
export function NavProgress() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return createPortal(
    <span
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-[3px] origin-left animate-nav-progress bg-gold opacity-0"
    />,
    document.body,
  );
}
