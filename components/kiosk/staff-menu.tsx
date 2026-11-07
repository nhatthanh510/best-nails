"use client";

import { useEffect } from "react";
import { ChevronRight, Gift, LayoutGrid, LogOut, X } from "lucide-react";

const choice =
  "flex min-h-20 w-full items-center gap-4 rounded-2xl border border-kiosk-line bg-kiosk-bg px-5 text-left hover:bg-kiosk-line/40 focus-visible:outline-3 focus-visible:outline-kiosk-accent";

/**
 * The kiosk's one staff entry point (the quiet Staff button in the header): after the shop PIN,
 * Gift card, Admin (admin accounts) and Sign out. Kept behind one button so customers holding the
 * iPad see only the check-in, as on self-service kiosks.
 */
export function StaffMenu({
  isAdmin,
  onGiftCard,
  onAdmin,
  onSignOut,
  onClose,
}: {
  isAdmin: boolean;
  onGiftCard: () => void;
  onAdmin: () => void;
  onSignOut: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const item = (icon: React.ReactNode, label: string, hint: string, onClick: () => void) => (
    <button type="button" onClick={onClick} className={choice}>
      <span className="flex size-11 flex-none items-center justify-center rounded-full bg-kiosk-surface text-kiosk-accent">{icon}</span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-lg font-bold text-kiosk-ink">{label}</span>
        <span className="text-sm text-kiosk-muted">{hint}</span>
      </span>
      <ChevronRight className="size-5 flex-none text-kiosk-faint" aria-hidden="true" />
    </button>
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="staff-menu-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
    >
      <div className="flex w-full max-w-md flex-col gap-4 rounded-3xl border border-kiosk-line bg-kiosk-surface p-6 text-kiosk-ink sm:p-8">
        <div className="flex items-center justify-between">
          <h2 id="staff-menu-title" className="font-heading text-4xl font-bold">
            Staff
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-12 items-center justify-center rounded-full text-kiosk-muted hover:text-kiosk-ink"
          >
            <X className="size-6" aria-hidden="true" />
          </button>
        </div>
        {item(<Gift className="size-5" aria-hidden="true" />, "Gift card", "Create, find, use or top up", onGiftCard)}
        {isAdmin && item(<LayoutGrid className="size-5" aria-hidden="true" />, "Admin", "Customers, check-ins and settings", onAdmin)}
        {item(<LogOut className="size-5" aria-hidden="true" />, "Sign out", "Stops check-in on this iPad", onSignOut)}
      </div>
    </div>
  );
}
