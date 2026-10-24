import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getStaff } from "@/lib/auth";
import { KioskBrand } from "@/components/kiosk/brand";
import { pairKiosk } from "./actions";

export const metadata = { title: "Set up kiosk" };

export default function KioskSetupPage() {
  return (
    <main className="flex min-h-dvh w-full flex-col items-center justify-center gap-8 p-16">
      <KioskBrand size="lg" />
      <Suspense fallback={null}>
        <SetupForm />
      </Suspense>
    </main>
  );
}

async function SetupForm() {
  const staff = await getStaff();
  if (!staff) redirect("/admin/login?next=/kiosk/setup");

  return (
    <form action={pairKiosk} className="flex w-full max-w-lg flex-col gap-6 rounded-3xl bg-kiosk-surface p-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold tracking-tight">Pair this iPad as a kiosk</h1>
        <p className="text-lg text-kiosk-muted">
          Signed in as {staff.displayName}. This browser will be allowed to check customers in.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="name" className="font-bold">
          Kiosk name
        </label>
        <input
          id="name"
          name="name"
          required
          maxLength={60}
          defaultValue="Front desk iPad"
          className="h-16 rounded-2xl border-2 border-kiosk-line bg-kiosk-bg px-5 text-xl font-semibold outline-none focus:border-kiosk-accent"
        />
      </div>
      <label className="flex min-h-12 items-center gap-3 text-kiosk-muted">
        <input type="checkbox" name="signOut" defaultChecked className="size-6 accent-kiosk-accent" />
        Sign me out of the admin on this iPad after pairing
      </label>
      <button type="submit" className="bg-gold-sheen min-h-16 rounded-2xl bg-kiosk-accent text-xl font-extrabold text-kiosk-bg">
        Pair and open kiosk
      </button>
    </form>
  );
}
