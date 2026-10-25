import { Suspense } from "react";
import Link from "next/link";
import { Tablet } from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/kiosk/brand";
import { ActiveNavLinks, NavLinks } from "./nav-links";
import { PhoneMenu } from "./phone-menu";

const kioskLink = "flex min-h-11 items-center gap-2.5 rounded-[10px] border border-border px-3 text-sm font-semibold hover:bg-muted";

/**
 * Three layouts: a top bar with a Menu button on phones, an icon rail from md (portrait iPad),
 * and the full sidebar from lg. `account` is rendered at the bottom of the sidebar from md, and
 * `phoneAccount` at the bottom of the phone menu (the top bar only has room for the kiosk and
 * Menu buttons at 375 px), so it's passed twice.
 */
export function Sidebar({ account, phoneAccount }: { account: React.ReactNode; phoneAccount: React.ReactNode }) {
  return (
    <nav
      aria-label="Main"
      className="flex flex-col gap-4 border-b border-border bg-card px-4 py-4 md:sticky md:top-0 md:h-dvh md:w-19 md:flex-none md:gap-7 md:border-r md:border-b-0 md:px-3.5 md:py-6 lg:w-60 lg:px-4"
    >
      <PhoneMenu
        bar={
          <>
            <Link href="/admin" aria-label="Best Nails dashboard" className="flex min-h-11 items-center gap-2.5 px-2 md:max-lg:justify-center md:max-lg:px-0">
              <BrandMark className="size-10" sizes="40px" />
              <span className="font-heading text-[24px] font-bold tracking-wide whitespace-nowrap md:max-lg:sr-only">Best Nails</span>
            </Link>
            <div className="ml-auto flex items-center gap-1 md:hidden">
              <Link href="/kiosk" aria-label="Open kiosk" className={cn(kioskLink, "w-11 justify-center px-0")}>
                <Tablet className="size-4.5" aria-hidden="true" />
              </Link>
            </div>
          </>
        }
      >
        {/* The active highlight depends on the URL, so it streams in; links work before that. */}
        <Suspense fallback={<NavLinks pathname={null} />}>
          <ActiveNavLinks />
        </Suspense>
        <div className="mt-3 border-t border-border pt-2 md:hidden">{phoneAccount}</div>
      </PhoneMenu>

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
