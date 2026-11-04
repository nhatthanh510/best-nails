"use client";

import { useLinkStatus } from "next/link";
import { Spinner } from "@/components/ui/spinner";

/**
 * A link button's label that turns into a spinner while its page loads, for links to pages that
 * wait for fresh data (the admin dashboard, the kiosk) from a page without the admin's loading
 * line. The label stays in place (only hidden), so the button keeps its size, and the spinner
 * appears after a short delay, so a quick navigation never flashes it. Render inside a <Link>.
 */
export function LinkPending({ children }: { children: React.ReactNode }) {
  const { pending } = useLinkStatus();
  return (
    <span className="relative inline-grid place-items-center">
      <span className={pending ? "opacity-0 transition-opacity delay-100" : undefined}>{children}</span>
      <span
        aria-hidden="true"
        className={`absolute inset-0 flex items-center justify-center transition-opacity ${pending ? "opacity-100 delay-100" : "opacity-0"}`}
      >
        <Spinner className="size-5" />
      </span>
      {pending && <span className="sr-only">Loading</span>}
    </span>
  );
}
