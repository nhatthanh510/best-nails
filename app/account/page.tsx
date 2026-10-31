import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { BrandMark } from "@/components/kiosk/brand";
import { Skeleton } from "@/components/ui/skeleton";
import { getStaff, homeFor } from "@/lib/auth";
import { PasswordForm } from "./password-form";

export const metadata = { title: "Your account" };

// Any account, admin or staff, changes its own password here. It's also where a temporary
// password (set by an admin) and a "forgot password" link send people to choose a new one.
export default function AccountPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-background px-4 py-12">
      <div className="flex w-full max-w-[420px] flex-col gap-7">
        <div className="flex flex-col items-center gap-3">
          <BrandMark className="size-24 ring-4 ring-gold/25" sizes="96px" />
          <span className="font-heading text-4xl font-bold tracking-wide">Best Nails</span>
        </div>
        <Suspense fallback={<Skeleton className="h-[420px] rounded-[20px]" />}>
          <Account />
        </Suspense>
      </div>
    </main>
  );
}

async function Account() {
  // At request time only: the session check reads the clock, which a prerender can't.
  await connection();
  const me = await getStaff();
  if (!me) redirect("/admin/login?next=/account");
  const reason = me.mustChangePassword ? "temporary" : me.fromResetLink ? "reset" : null;
  const home = homeFor(me.role);
  return (
    <>
      <PasswordForm reason={reason} email={me.email} name={me.displayName} role={me.role} />
      {!me.mustChangePassword && (
        <Link href={home} className="mx-auto flex min-h-11 items-center gap-2 text-sm font-bold text-primary hover:underline">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to {home === "/admin" ? "the admin" : "the kiosk"}
        </Link>
      )}
    </>
  );
}
