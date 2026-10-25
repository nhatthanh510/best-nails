"use client";

import { useEffect, useId, useState } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * On phones the page links fold behind a Menu button in the top bar and open as a list under
 * it; from md they're always shown (icon rail, then sidebar). Choosing a page, pressing Escape
 * or tapping the button again closes it. `bar` is the top bar's other content.
 */
export function PhoneMenu({ bar, children }: { bar: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        {bar}
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          aria-label={open ? "Close menu" : "Menu"}
          onClick={() => setOpen((o) => !o)}
          className="flex size-11 flex-none items-center justify-center rounded-[10px] border border-border hover:bg-muted md:hidden"
        >
          {open ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
        </button>
      </div>
      <div
        id={id}
        // Any link inside closes the menu; the new page then renders under it.
        onClick={(e) => (e.target as Element).closest("a") && setOpen(false)}
        className={cn("max-md:border-t max-md:border-border max-md:pt-3", !open && "max-md:hidden")}
      >
        {children}
      </div>
    </>
  );
}
