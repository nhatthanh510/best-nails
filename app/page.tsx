import Link from "next/link";
import { BrandMark } from "@/components/kiosk/brand";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 p-6">
      <div className="flex flex-col items-center gap-4">
        <BrandMark className="size-28 ring-4 ring-gold/25" sizes="112px" />
        <h1 className="text-4xl font-bold tracking-wide">Best Nails Rewards</h1>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/kiosk" className="flex min-h-12 items-center rounded-xl bg-primary px-6 font-bold text-primary-foreground">
          Open kiosk
        </Link>
        <Link href="/admin" className="flex min-h-12 items-center rounded-xl border border-input bg-card px-6 font-bold">
          Staff admin
        </Link>
      </div>
    </main>
  );
}
