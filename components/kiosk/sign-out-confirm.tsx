"use client";

import { useEffect } from "react";
import Link from "next/link";
import { signOut } from "@/app/admin/actions";

const button = "flex min-h-16 flex-1 items-center justify-center rounded-2xl px-8 text-xl font-extrabold";

/** Asks first, because signing out stops the kiosk until someone signs in again. */
export function SignOutConfirm({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="sign-out-title"
      aria-describedby="sign-out-text"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
    >
      <div className="flex w-full max-w-lg flex-col gap-5 rounded-3xl border border-kiosk-line bg-kiosk-surface p-8 text-center text-kiosk-ink">
        <h2 id="sign-out-title" className="font-heading text-4xl font-bold">
          Sign out of the kiosk?
        </h2>
        <p id="sign-out-text" className="text-lg text-kiosk-muted">
          Check-in stops until someone from Best Nails signs in again.
        </p>
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className={`${button} border-2 border-kiosk-line`}>
            Cancel
          </button>
          <form action={signOut} className="flex flex-1">
            <button type="submit" className={`${button} bg-gold-sheen bg-kiosk-accent text-kiosk-bg`}>
              Sign out
            </button>
          </form>
        </div>
        {/* The signed-in account's own settings live behind this staff-only dialog, not on the customer-facing screen. */}
        <Link href="/account" className="mx-auto flex min-h-11 items-center text-base font-semibold text-kiosk-muted underline-offset-4 hover:underline">
          Change password
        </Link>
      </div>
    </div>
  );
}
