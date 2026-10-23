import Link from "next/link";
import { BrandMark } from "@/components/kiosk/brand";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 p-6">
      <div className="flex items-center gap-3">
        <BrandMark className="size-10 text-primary" />
        <h1 className="text-3xl font-extrabold tracking-tight">Best Nails Rewards</h1>
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
