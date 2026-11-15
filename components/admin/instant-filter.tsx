"use client";

import { useEffect, useRef } from "react";
import { matchesShown } from "@/lib/highlight";

const TYPING = "admin:search-typing";

/** Tells the list panel `el` is in what's in its search box now, on every keystroke. */
export function announceTyping(el: Element, text: string) {
  el.closest("[data-list-panel]")?.dispatchEvent(new CustomEvent<string>(TYPING, { detail: text }));
}

/**
 * Filters the rows already on screen the moment you type, while the real search (debounced, on the
 * server) loads: rows marked with `data-instant-codes` / `data-instant-names` that can't match are
 * hidden. As soon as the server's result is for what's typed (`q` catches up), it steps aside and
 * that result shows as it is, since the server also matches phone numbers and customers who used a
 * card, which the screen doesn't show. Render once inside the list panel, outside the table.
 */
export function InstantFilter({ q }: { q: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  // What's in the search box now (null until someone types on this page).
  const typed = useRef<string | null>(null);

  useEffect(() => {
    const panel = ref.current?.closest("[data-list-panel]");
    if (!panel) return;
    const apply = () => {
      const text = typed.current;
      const ahead = text !== null && text.trim() !== q.trim();
      for (const row of panel.querySelectorAll<HTMLElement>("[data-instant-codes]")) {
        row.hidden = ahead && !matchesShown(row.dataset.instantCodes ?? "", row.dataset.instantNames ?? "", text);
      }
    };
    const onTyping = (e: Event) => {
      typed.current = (e as CustomEvent<string>).detail;
      apply();
    };
    // Also when a new result arrives: it may already be behind what's typed since.
    apply();
    panel.addEventListener(TYPING, onTyping);
    return () => panel.removeEventListener(TYPING, onTyping);
  }, [q]);

  return <span ref={ref} hidden />;
}
