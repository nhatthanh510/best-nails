"use client";

import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/admin/action-button";
import { deleteGiftVouchers } from "@/app/admin/gift-voucher-actions";

/**
 * Choosing several gift vouchers in the list to delete at once. The rows stay server-rendered:
 * each one that can be deleted has a plain checkbox (BulkCheckbox), and these two read and set
 * them in the list panel they're in, so a new page, filter or search starts with none chosen.
 */

const boxes = (root: Element | null) => [...(root?.querySelectorAll<HTMLInputElement>("input[data-bulk]") ?? [])];
const panelOf = (el: Element | null) => el?.closest("[data-list-panel]") ?? null;

export function BulkCheckbox({ id, label }: { id: string; label: string }) {
  return <input type="checkbox" data-bulk value={id} aria-label={label} className="size-4.5 accent-primary" />;
}

/** The header checkbox: all, none, or a dash when some are chosen. */
export function BulkSelectAll() {
  const ref = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<"none" | "some" | "all" | "empty">("empty");

  useEffect(() => {
    const panel = panelOf(ref.current);
    if (!panel) return;
    const sync = () => {
      const all = boxes(panel);
      const n = all.filter((b) => b.checked).length;
      setState(all.length === 0 ? "empty" : n === 0 ? "none" : n === all.length ? "all" : "some");
    };
    sync();
    panel.addEventListener("change", sync);
    const observer = new MutationObserver(sync);
    observer.observe(panel, { childList: true, subtree: true });
    return () => {
      panel.removeEventListener("change", sync);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = state === "some";
  }, [state]);

  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label="Choose all on this page"
      checked={state === "all"}
      disabled={state === "empty"}
      onChange={(e) => {
        const panel = panelOf(e.currentTarget);
        const on = state !== "all";
        for (const b of boxes(panel)) b.checked = on;
        panel?.dispatchEvent(new Event("change"));
      }}
      className="size-4.5 accent-primary disabled:opacity-30"
    />
  );
}

/** Shown once any are chosen: how many, Clear, and Delete (after a confirmation). */
export function BulkActions() {
  const ref = useRef<HTMLDivElement>(null);
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    const panel = panelOf(ref.current);
    if (!panel) return;
    const sync = () => {
      const next = boxes(panel).filter((b) => b.checked).map((b) => b.value);
      // Only on a real change: this bar's own render is a DOM change the observer sees too.
      setIds((prev) => (prev.join() === next.join() ? prev : next));
    };
    sync();
    panel.addEventListener("change", sync);
    const observer = new MutationObserver(sync);
    observer.observe(panel, { childList: true, subtree: true });
    return () => {
      panel.removeEventListener("change", sync);
      observer.disconnect();
    };
  }, []);

  const clear = () => {
    const panel = panelOf(ref.current);
    for (const b of boxes(panel)) b.checked = false;
    panel?.dispatchEvent(new Event("change"));
  };

  return (
    <div ref={ref} role="region" aria-label="Chosen vouchers" aria-live="polite" className={ids.length ? "contents" : "hidden"}>
      {ids.length > 0 && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-accent/60 px-4 py-2">
          <span className="text-sm font-bold">
            {ids.length} chosen
          </span>
          <Button type="button" variant="ghost" size="sm" onClick={clear}>
            Clear
          </Button>
          <ConfirmButton
            variant="danger"
            size="sm"
            className="ml-auto"
            title={`Delete ${ids.length} voucher${ids.length === 1 ? "" : "s"}?`}
            description="For blank cards that are lost or misprinted, or vouchers created by mistake (refund those at the till). Any that have been used are kept. This can't be undone."
            confirmLabel={`Delete ${ids.length}`}
            action={() => deleteGiftVouchers(ids)}
          >
            <Trash2 aria-hidden="true" />
            Delete {ids.length}
          </ConfirmButton>
        </div>
      )}
    </div>
  );
}
