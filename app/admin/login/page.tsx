import { Suspense } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/kiosk/brand";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-background px-4 py-12">
      <div className="flex w-full max-w-[420px] flex-col gap-7">
        <div className="flex items-center justify-center gap-3">
          <BrandMark className="size-10 text-primary" />
          <span className="text-2xl font-extrabold tracking-tight">
            Best Nails <span className="font-semibold text-muted-foreground">Admin</span>
          </span>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
        <p className="text-center text-sm text-muted-foreground">
          Setting up the shop iPad?{" "}
          <Link href="/kiosk/setup" className="font-semibold text-primary hover:underline">
            Open kiosk setup
          </Link>
        </p>
      </div>
    </main>
  );
}
