import { Suspense } from "react";
import Link from "next/link";
import { getKioskDevice } from "@/lib/kiosk-device";
import { loadKioskContent } from "@/lib/kiosk-content";
import { KioskApp } from "@/components/kiosk/kiosk-app";
import { KioskBrand } from "@/components/kiosk/brand";

export default function KioskPage() {
  return (
    <Suspense fallback={<KioskSplash />}>
      <KioskGate />
    </Suspense>
  );
}

async function KioskGate() {
  const device = await getKioskDevice();
  if (!device) return <NotPaired />;
  return <KioskApp content={await loadKioskContent()} />;
}

function KioskSplash() {
  return (
    <main className="flex min-h-dvh w-full items-center justify-center">
      <KioskBrand />
    </main>
  );
}

function NotPaired() {
  return (
    <main className="flex min-h-dvh w-full flex-col items-center justify-center gap-6 p-16 text-center">
      <KioskBrand />
      <h1 className="text-5xl font-extrabold tracking-tight">This screen isn&apos;t set up yet</h1>
      <p className="max-w-xl text-xl text-kiosk-muted">
        A staff member needs to pair this iPad once. After that it stays a check-in kiosk.
      </p>
      <Link
        href="/kiosk/setup"
        className="flex min-h-16 items-center rounded-2xl bg-kiosk-accent px-9 text-xl font-extrabold text-kiosk-bg"
      >
        Set up this kiosk
      </Link>
    </main>
  );
}
