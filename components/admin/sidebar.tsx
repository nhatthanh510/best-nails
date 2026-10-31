import { Suspense } from "react";
import Link from "next/link";
import { LogOut, Tablet, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/kiosk/brand";
import { ActiveNavLinks, NavLinks } from "./nav-links";
import { PhoneMenu } from "./phone-menu";
import { signOut } from "@/app/admin/actions";

const drawerItem = "flex min-h-11 w-full items-center gap-3 rounded-[10px] px-3 text-[15px] font-semibold hover:bg-muted";
const kioskLink = "flex min-h-11 items-center gap-2.5 rounded-[10px] border border-border px-3 text-sm font-semibold hover:bg-muted";

function Brand({ className }: { className?: string }) {
  return (
    <Link href="/admin" aria-label="Best Nails dashboard" className={cn("flex min-h-11 items-center gap-2.5", className)}>
      <BrandMark className="size-10" sizes="40px" />
      <span className="font-heading text-[24px] font-bold tracking-wide whitespace-nowrap md:max-lg:sr-only">Best Nails</span>
    </Link>
  );
}

/** The active highlight depends on the URL, so it streams in; links work before that. */
function Links() {
  return (
    <Suspense fallback={<NavLinks pathname={null} />}>
      <ActiveNavLinks />
    </Suspense>
  );
}

/**
 * Three layouts: a sticky top bar on phones (the logo, then the kiosk and Menu buttons on the
 * right, Menu opening a drawer), an icon rail from md (portrait iPad), and the full sidebar from
 * lg. `account` is rendered at the bottom of the sidebar from md, and `phoneProfile` (who's signed
 * in) at the top of the drawer.
 */
export function Sidebar({ account, phoneProfile }: { account: React.ReactNode; phoneProfile: React.ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-40 flex items-center gap-2 border-b border-border bg-card px-4 py-2 md:hidden">
        <Brand />
        <Link href="/kiosk" aria-label="Open kiosk" className={cn(kioskLink, "ml-auto w-11 justify-center px-0")}>
          <Tablet className="size-4.5" aria-hidden="true" />
        </Link>
        <PhoneMenu
          profile={phoneProfile}
          footer={
            <div className="flex flex-col gap-1">
              <Link href="/account" className={drawerItem}>
                <UserRound className="size-5 flex-none" aria-hidden="true" />
                Your account
              </Link>
              <Link href="/kiosk" className={drawerItem}>
                <Tablet className="size-5 flex-none" aria-hidden="true" />
                Open kiosk
              </Link>
              <form action={signOut}>
                <button type="submit" className={drawerItem}>
                  <LogOut className="size-5 flex-none" aria-hidden="true" />
                  Sign out
                </button>
              </form>
            </div>
          }
        >
          <Links />
        </PhoneMenu>
      </header>

      <nav
        aria-label="Main"
        className="hidden border-r border-border bg-card md:sticky md:top-0 md:flex md:h-dvh md:w-19 md:flex-none md:flex-col md:gap-7 md:px-3.5 md:py-6 lg:w-60 lg:px-4"
      >
        <Brand className="px-2 md:max-lg:justify-center md:max-lg:px-0" />
        <Links />
        <div className="mt-auto flex flex-col gap-2">
          <Link href="/kiosk" title="Open kiosk" className={cn(kioskLink, "md:max-lg:justify-center md:max-lg:px-0")}>
            <Tablet className="size-4.5 flex-none" aria-hidden="true" />
            <span className="md:max-lg:sr-only">Open kiosk</span>
          </Link>
          {account}
        </div>
      </nav>
    </>
  );
}
