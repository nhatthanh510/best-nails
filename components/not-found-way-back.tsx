"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LinkPending } from "@/components/link-pending";

/** The parts of the site a wrong URL can belong to, by its first segment, and their button. */
const SECTIONS: Record<string, string> = {
  kiosk: "Back to check-in",
  admin: "Back to the dashboard",
  account: "Back to your account",
};

/**
 * The 404 page's button: back to the part of the site the wrong URL was under, taken from the URL
 * itself (/kiosk/xxx → /kiosk, /admin/xxx → /admin, /xxx → the home page).
 */
export function NotFoundWayBack() {
  const section = usePathname()?.split("/")[1] ?? "";
  const label = SECTIONS[section];
  return (
    <Link
      href={label ? `/${section}` : "/"}
      className="flex min-h-12 w-full items-center justify-center rounded-xl bg-primary px-6 font-bold text-primary-foreground hover:bg-primary/90 sm:w-auto"
    >
      <LinkPending>{label ?? "Go to the home page"}</LinkPending>
    </Link>
  );
}
