"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import Link from "next/link";
import { RotateCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * A page that couldn't load (the database didn't answer, say). It keeps the sidebar, so staff can
 * try again or go somewhere else instead of facing a blank browser error.
 */
export default function AdminError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
      <span className="mb-1 flex size-12 items-center justify-center rounded-full bg-warning-soft text-warning">
        <TriangleAlert className="size-6" aria-hidden="true" />
      </span>
      <h1 className="text-3xl">Couldn&apos;t load this page</h1>
      <p className="text-[15px] text-muted-foreground">Nothing was changed. Check the connection and try again.</p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <Button size="lg" onClick={() => retry()}>
          <RotateCw aria-hidden="true" />
          Try again
        </Button>
        <Button size="lg" variant="outline" asChild>
          <Link href="/admin">Go to the dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
