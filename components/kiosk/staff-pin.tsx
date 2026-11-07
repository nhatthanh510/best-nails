"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { LockKeyhole } from "lucide-react";
import { unlockKiosk } from "@/app/kiosk/pin-actions";
import { Spinner } from "@/components/ui/spinner";
import { fieldClass, KioskError } from "./screens";

export type PinPurpose = "gift_card" | "admin" | "sign_out";

const button = "flex min-h-16 flex-1 items-center justify-center rounded-2xl px-6 text-xl font-extrabold";

/**
 * The shop PIN, asked before the kiosk's staff controls (Gift card, Admin, Sign out), because
 * customers hold the same iPad. One masked field (the iPad's number keyboard); the server checks
 * it and `onUnlocked` then opens what was tapped. A wrong PIN clears the field; too many wrong
 * tries locks it for a minute (in the database).
 */
export function StaffPinDialog({
  purpose,
  onUnlocked,
  onClose,
}: {
  purpose: PinPurpose;
  onUnlocked: () => void;
  onClose: () => void;
}) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length < 4 || pending) return;
    startTransition(async () => {
      try {
        const result = await unlockKiosk(pin, purpose);
        if (result.ok) return onUnlocked();
        setError(result.message);
      } catch {
        setError("Couldn't check the PIN. Please try again.");
      }
      setPin("");
      inputRef.current?.focus();
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="staff-pin-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
    >
      <form
        onSubmit={submit}
        className="flex w-full max-w-md flex-col gap-4 rounded-3xl border border-kiosk-line bg-kiosk-surface p-6 text-center text-kiosk-ink sm:p-8"
      >
        <LockKeyhole className="mx-auto size-8 text-kiosk-accent" aria-hidden="true" />
        <h2 id="staff-pin-title" className="font-heading text-4xl font-bold">
          Staff PIN
        </h2>
        <p className="text-lg text-kiosk-muted">For Best Nails staff only.</p>

        <input
          ref={inputRef}
          autoFocus
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          maxLength={8}
          aria-label="Staff PIN"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "staff-pin-error" : undefined}
          value={pin}
          onChange={(e) => {
            setError(null);
            setPin(e.target.value.replace(/\D/g, "").slice(0, 8));
          }}
          className={`${fieldClass} w-full text-center tracking-[0.5em]`}
        />
        {error && (
          <KioskError id="staff-pin-error" className="justify-center text-base">
            {error}
          </KioskError>
        )}

        <div className="flex gap-3">
          <button type="button" onClick={onClose} className={`${button} border-2 border-kiosk-line`}>
            Cancel
          </button>
          <button
            type="submit"
            disabled={pin.length < 4 || pending}
            className={`${button} bg-gold-sheen bg-kiosk-accent text-kiosk-bg disabled:bg-none disabled:opacity-50`}
          >
            {pending ? <Spinner className="size-6" /> : "Unlock"}
          </button>
        </div>
      </form>
    </div>
  );
}
