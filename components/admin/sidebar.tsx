import { Suspense } from "react";
import Link from "next/link";
import { Tablet } from "lucide-react";
import { BrandMark } from "@/components/kiosk/brand";
import { ActiveNavLinks, NavLinks } from "./nav-links";

export function Sidebar({ account }: { account: React.ReactNode }) {
  return (
    <nav
      aria-label="Main"
      className="flex flex-col gap-4 border-b border-border bg-card px-4 py-4 md:sticky md:top-0 md:h-dvh md:w-60 md:flex-none md:gap-7 md:border-r md:border-b-0 md:py-6"
    >
      <Link href="/admin" className="flex items-center gap-2.5 px-2">
        <BrandMark className="size-8 text-primary" strokeWidth={2.5} />
        <span className="text-lg font-extrabold tracking-tight">Best Nails</span>
      </Link>

      {/* The active highlight depends on the URL, so it streams in; links work before that. */}
      <Suspense fallback={<NavLinks pathname={null} />}>
        <ActiveNavLinks />
      </Suspense>

      <div className="hidden flex-col gap-2 md:mt-auto md:flex">
        <Link
          href="/kiosk"
          className="flex min-h-11 items-center gap-2.5 rounded-[10px] border border-border px-3 text-sm font-semibold hover:bg-muted"
        >
          <Tablet className="size-4.5" aria-hidden="true" />
          Open kiosk
        </Link>
        {account}
      </div>
    </nav>
  );
}
