import { Suspense } from "react";
import Link from "next/link";
import { LogOut, Tablet, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/kiosk/brand";
import { ActiveNavLinks, NavLinks } from "./nav-links";
import { PhoneMenu } from "./phone-menu";
import { SidebarToggle } from "./sidebar-toggle";
import { signOut } from "@/app/admin/actions";

const drawerItem = "flex min-h-11 w-full items-center gap-3 rounded-[10px] px-3 text-[15px] font-semibold hover:bg-muted";
const kioskLink = "flex min-h-11 items-center gap-2.5 rounded-[10px] border border-border px-3 text-sm font-semibold hover:bg-muted";

function Brand({ className }: { className?: string }) {
  return (
    <Link href="/admin" aria-label="Best Nails dashboard" className={cn("flex min-h-11 items-center gap-2.5", className)}>
      <BrandMark className="size-10" sizes="40px" />
      <span className="font-heading text-[24px] font-bold tracking-wide whitespace-nowrap rail:sr-only">Best Nails</span>
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
 * lg, which the owner can collapse to the rail (SidebarToggle; `rail:` styles both). `account` is
 * rendered at the bottom of the sidebar from md, and `phoneProfile` (who's signed in) at the top of
 * the drawer.
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
        // Collapsing and expanding animate the width; the labels are clipped as it narrows or
        // widens, and the icons don't move (the rail centres them where they already sit).
        className="hidden border-r border-border bg-card md:sticky md:top-0 md:flex md:h-dvh md:w-19 md:flex-none md:flex-col md:gap-7 md:overflow-x-hidden md:px-3.5 md:py-6 lg:w-60 lg:px-4 lg:transition-[width,padding] lg:duration-200 lg:ease-out motion-reduce:transition-none rail:w-19 rail:px-3.5"
      >
        {/* The collapse button sits by the logo, as in Notion and Linear. Collapsed (`lg:rail:`), the
            button is the small logo itself, in the same row, so nothing below moves. */}
        <div className="flex min-h-11 items-center justify-between gap-2 rail:justify-center">
          <Brand className="px-2 rail:justify-center rail:px-0 lg:rail:hidden" />
          <SidebarToggle />
        </div>
        <Links />
        <div className="mt-auto flex flex-col gap-2">
          <Link href="/kiosk" title="Open kiosk" className={cn(kioskLink, "rail:justify-center rail:px-0")}>
            <Tablet className="size-4.5 flex-none" aria-hidden="true" />
            <span className="rail:sr-only">Open kiosk</span>
          </Link>
          {account}
        </div>
      </nav>
    </>
  );
}
