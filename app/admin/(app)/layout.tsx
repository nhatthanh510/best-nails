import { Suspense } from "react";
import { LogOut } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { Sidebar } from "@/components/admin/sidebar";
import { getStaff } from "@/lib/auth";
import { signOut } from "../actions";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-background md:flex-row">
      <Sidebar
        account={
          <Suspense fallback={<div className="h-11" />}>
            <Account />
          </Suspense>
        }
        compactAccount={
          <Suspense fallback={<div className="size-11" />}>
            <Account compact />
          </Suspense>
        }
      />
      <main className="flex min-w-0 flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-10">{children}</main>
      <Toaster theme="light" position="top-center" richColors />
    </div>
  );
}

/** Who's signed in, with a sign-out button. `compact` (the phone top bar) is just the button. */
async function Account({ compact = false }: { compact?: boolean }) {
  const staff = await getStaff();
  if (!staff) return null;
  return (
    <form action={signOut} className="flex items-center justify-between gap-2 px-1 md:max-lg:justify-center md:max-lg:px-0">
      <span className={compact ? "sr-only" : "truncate text-sm md:max-lg:sr-only"}>
        <span className="font-bold">{staff.displayName}</span>
        <span className="text-muted-foreground"> · {staff.role === "owner" ? "Owner" : "Staff"}</span>
      </span>
      <button
        type="submit"
        aria-label="Sign out"
        title="Sign out"
        className="flex size-11 items-center justify-center rounded-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <LogOut className="size-4.5" aria-hidden="true" />
      </button>
    </form>
  );
}
