import { Suspense } from "react";
import { BrandMark } from "@/components/kiosk/brand";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-background px-4 py-12">
      <div className="flex w-full max-w-[420px] flex-col gap-7">
        <div className="flex flex-col items-center gap-3">
          <BrandMark className="size-24 ring-4 ring-gold/25" sizes="96px" />
          <span className="font-heading text-4xl font-bold tracking-wide">Best Nails</span>
          <span className="text-xs font-bold tracking-[0.2em] text-muted-foreground uppercase">Sign in</span>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
        <p className="text-center text-sm text-muted-foreground">Admins go to the admin; staff accounts open the check-in kiosk.</p>
      </div>
    </main>
  );
}
