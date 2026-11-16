import type { Metadata } from "next";
import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Page not found" };

/** A link to something that no longer exists, e.g. a deleted customer or gift card. */
export default function AdminNotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
      <span className="mb-1 flex size-14 items-center justify-center rounded-full bg-accent text-primary ring-4 ring-gold/20">
        <SearchX className="size-6" aria-hidden="true" />
      </span>
      <span className="text-xs font-bold tracking-[0.2em] text-primary uppercase">Error 404</span>
      <h1 className="text-3xl leading-tight sm:text-4xl">This page isn&apos;t here</h1>
      <p className="text-[15px] text-muted-foreground">
        The customer or gift card may have been deleted, or the link is old or mistyped. Search for it instead.
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <Button size="lg" asChild>
          <Link href="/admin/customers">All customers</Link>
        </Button>
        <Button size="lg" variant="outline" asChild>
          <Link href="/admin/gift-cards">Gift cards</Link>
        </Button>
      </div>
    </div>
  );
}
