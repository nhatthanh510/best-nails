import { Suspense } from "react";
import type { Metadata } from "next";
import { BrandMark } from "@/components/kiosk/brand";
import { NotFoundWayBack } from "@/components/not-found-way-back";

export const metadata: Metadata = { title: "Page not found" };

/**
 * Any URL the app doesn't have, and notFound() outside the admin (which has its own, inside the
 * sidebar). Its button goes back to the part of the site the URL was under (NotFoundWayBack).
 */
export default function NotFound() {
  return (
    <main className="flex flex-1 items-center justify-center bg-background px-4 py-16">
      <div className="flex w-full max-w-sm flex-col items-center gap-6 text-center">
        <BrandMark className="size-20 ring-4 ring-gold/25" sizes="80px" />
        <div className="flex flex-col items-center gap-3">
          <span className="text-xs font-bold tracking-[0.2em] text-primary uppercase">Error 404</span>
          <h1 className="text-4xl leading-tight font-bold sm:text-5xl">Page not found</h1>
          <span aria-hidden="true" className="h-px w-16 bg-linear-to-r from-gold/0 via-gold to-gold/0" />
          <p className="text-[15px] leading-relaxed text-muted-foreground">The link may be old or mistyped.</p>
        </div>
        {/* usePathname needs a Suspense boundary with Cache Components. */}
        <Suspense fallback={<div className="h-12" />}>
          <NotFoundWayBack />
        </Suspense>
      </div>
    </main>
  );
}
