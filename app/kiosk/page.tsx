import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaff } from "@/lib/auth";
import { loadKioskContent } from "@/lib/kiosk-content";
import { KioskApp } from "@/components/kiosk/kiosk-app";
import { KioskBrand } from "@/components/kiosk/brand";
import { Spinner } from "@/components/ui/spinner";
import { Toaster } from "@/components/ui/sonner";

export default function KioskPage() {
  return (
    <Suspense fallback={<KioskSplash />}>
      <KioskGate />
    </Suspense>
  );
}

// The kiosk runs on the shop's one iPad while any account (admin or staff) is signed in on it.
async function KioskGate() {
  const staff = await getStaff();
  if (!staff) return <SignedOut />;
  if (staff.mustChangePassword) redirect("/account");
  return (
    <>
      <KioskApp content={await loadKioskContent()} isAdmin={staff.role === "admin"} />
      {/* Messages from the header's gift voucher forms ("Sold BN… take payment at the till"). */}
      <Toaster theme="dark" position="top-center" richColors />
    </>
  );
}

function KioskSplash() {
  return (
    <main className="flex min-h-dvh w-full flex-col items-center justify-center gap-8">
      <KioskBrand size="lg" />
      <Spinner className="size-8 text-kiosk-accent" />
      <span role="status" className="sr-only">
        Starting the check-in screen
      </span>
    </main>
  );
}

function SignedOut() {
  return (
    <main className="flex min-h-dvh w-full flex-col items-center justify-center gap-6 px-5 py-10 text-center sm:p-16">
      <KioskBrand size="lg" />
      <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">Ask a staff member to sign in</h1>
      <p className="max-w-xl text-lg text-kiosk-muted sm:text-xl">The check-in screen starts once someone from Best Nails has signed in on this iPad.</p>
      <Link
        href="/admin/login?next=/kiosk"
        className="bg-gold-sheen flex min-h-16 items-center rounded-2xl bg-kiosk-accent px-9 text-xl font-extrabold text-kiosk-bg"
      >
        Staff sign in
      </Link>
    </main>
  );
}
