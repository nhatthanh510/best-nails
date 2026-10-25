import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BrandMark } from "@/components/kiosk/brand";
import { ForgotForm } from "./forgot-form";

export const metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-background px-4 py-12">
      <div className="flex w-full max-w-[420px] flex-col gap-7">
        <div className="flex flex-col items-center gap-3">
          <BrandMark className="size-24 ring-4 ring-gold/25" sizes="96px" />
          <span className="font-heading text-4xl font-bold tracking-wide">Best Nails</span>
        </div>
        <Suspense>
          <ForgotForm />
        </Suspense>
        <Link href="/admin/login" className="mx-auto flex min-h-11 items-center gap-2 text-sm font-bold text-primary hover:underline">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to sign in
        </Link>
      </div>
    </main>
  );
}
