"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";

/**
 * On phones the page links live in a drawer that slides in from the right over a dimmed page,
 * opened by the Menu button at the right of the top bar. `profile` is who's signed in, at the
 * top beside the close button; `footer` is under the links. Choosing a link, tapping outside,
 * Escape or the close button closes it.
 */
export function PhoneMenu({ profile, footer, children }: { profile: React.ReactNode; footer: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger
        aria-label="Menu"
        className="flex size-11 flex-none items-center justify-center rounded-[10px] border border-border hover:bg-muted"
      >
        <Menu className="size-5" aria-hidden="true" />
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        {/* Radix marks open/closed with data-state and unmounts when the exit animation ends;
            fill-mode-forwards holds its last frame so the drawer doesn't flash back open first. */}
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/35 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:fill-mode-forwards data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          // Any link inside closes the drawer; the new page then renders behind it.
          onClick={(e) => (e.target as Element).closest("a") && setOpen(false)}
          className="fixed inset-y-0 right-0 z-50 flex w-[85vw] max-w-sm flex-col overflow-y-auto bg-card shadow-2xl outline-none duration-300 ease-out data-[state=closed]:animate-out data-[state=closed]:fill-mode-forwards data-[state=closed]:slide-out-to-right data-[state=closed]:duration-200 data-[state=closed]:ease-in data-[state=open]:animate-in data-[state=open]:slide-in-from-right"
        >
          <DialogPrimitive.Title className="sr-only">Menu</DialogPrimitive.Title>
          <div className="flex items-center justify-between gap-2 border-b border-border py-2 pr-2 pl-4">
            <div className="min-w-0 flex-1">{profile}</div>
            <DialogPrimitive.Close aria-label="Close menu" className="flex size-11 flex-none items-center justify-center rounded-[10px] hover:bg-muted">
              <X className="size-5" aria-hidden="true" />
            </DialogPrimitive.Close>
          </div>
          <nav aria-label="Main" className="border-b border-border px-4 py-4">
            {children}
          </nav>
          <div className="px-4 py-4">{footer}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
