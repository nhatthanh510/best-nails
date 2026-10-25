import { Suspense } from "react";
import Link from "next/link";
import { Tablet } from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/kiosk/brand";
import { ActiveNavLinks, NavLinks } from "./nav-links";

const kioskLink = "flex min-h-11 items-center gap-2.5 rounded-[10px] border border-border px-3 text-sm font-semibold hover:bg-muted";

/**
 * Three layouts: a top bar with scrolling tabs on phones, an icon rail from md (portrait iPad),
 * and the full sidebar from lg. `account` is rendered in the top bar on phones and at the
 * bottom of the sidebar from md, so it's passed twice.
 */
export function Sidebar({ account, compactAccount }: { account: React.ReactNode; compactAccount: React.ReactNode }) {
  return (
    <nav
      aria-label="Main"
      className="flex flex-col gap-4 border-b border-border bg-card px-4 py-4 md:sticky md:top-0 md:h-dvh md:w-19 md:flex-none md:gap-7 md:border-r md:border-b-0 md:px-3.5 md:py-6 lg:w-60 lg:px-4"
    >
      <div className="flex items-center justify-between gap-2">
        <Link href="/admin" aria-label="Best Nails dashboard" className="flex min-h-11 items-center gap-2.5 px-2 md:max-lg:justify-center md:max-lg:px-0">
          <BrandMark className="size-10" sizes="40px" />
          <span className="font-heading text-[24px] font-bold tracking-wide md:max-lg:sr-only">Best Nails</span>
        </Link>
        <div className="flex items-center gap-1 md:hidden">
          <Link href="/kiosk" aria-label="Open kiosk" className={cn(kioskLink, "w-11 justify-center px-0")}>
            <Tablet className="size-4.5" aria-hidden="true" />
          </Link>
          {compactAccount}
        </div>
      </div>

      {/* The active highlight depends on the URL, so it streams in; links work before that. */}
      <Suspense fallback={<NavLinks pathname={null} />}>
        <ActiveNavLinks />
      </Suspense>

      <div className="hidden flex-col gap-2 md:mt-auto md:flex">
        <Link href="/kiosk" title="Open kiosk" className={cn(kioskLink, "md:max-lg:justify-center md:max-lg:px-0")}>
          <Tablet className="size-4.5 flex-none" aria-hidden="true" />
          <span className="md:max-lg:sr-only">Open kiosk</span>
        </Link>
        {account}
      </div>
    </nav>
  );
}
