import { Suspense } from "react";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { Sidebar } from "@/components/admin/sidebar";
import { Avatar } from "@/components/admin/ui";
import { NavProgress } from "@/components/admin/nav-progress";
import { getStaff } from "@/lib/auth";
import { signOut } from "../actions";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  // A page with a ListPanel fits the screen from tablet width up: <main> is held to the screen
  // height so the panel can take what's left, and scrolls only if the screen is too short.
  return (
    <div data-admin className="flex min-h-dvh flex-1 flex-col bg-background md:flex-row md:has-[[data-list-panel]]:max-h-dvh">
      <Sidebar
        account={
          <Suspense fallback={<div className="h-11" />}>
            <Account />
          </Suspense>
        }
        phoneProfile={
          <Suspense fallback={<div className="h-9" />}>
            <Profile />
          </Suspense>
        }
      />
      <main className="flex min-w-0 flex-1 flex-col gap-5 px-4 py-5 sm:gap-6 sm:px-6 sm:py-8 lg:px-10 md:has-[[data-list-panel]]:gap-4 md:has-[[data-list-panel]]:py-6 md:has-[[data-list-panel]]:overflow-y-auto md:has-[[data-list-panel]]:[scrollbar-gutter:stable]">{children}</main>
      <Suspense fallback={null}>
        <NavProgress />
      </Suspense>
      <Toaster theme="light" position="top-center" richColors />
    </div>
  );
}

const iconButton = "flex size-11 flex-none items-center justify-center rounded-[10px] text-muted-foreground hover:bg-muted hover:text-foreground";

/** Who's signed in (a link to Your account), with a sign-out button. */
async function Account() {
  const staff = await getStaff();
  if (!staff) return null;
  return (
    <form action={signOut} className="flex items-center justify-between gap-2 px-1 md:max-lg:justify-center md:max-lg:px-0">
      <Link href="/account" title="Your account" className="min-w-0 truncate rounded-[10px] py-2.5 text-sm hover:underline md:max-lg:sr-only">
        <span className="font-bold">{staff.displayName}</span>
        <span className="text-muted-foreground"> · {staff.role === "admin" ? "Admin" : "Staff"}</span>
      </Link>
      <button
        type="submit"
        aria-label="Sign out"
        title="Sign out"
        className={iconButton}
      >
        <LogOut className="size-4.5" aria-hidden="true" />
      </button>
    </form>
  );
}

/** The top of the phone menu: who's signed in. */
async function Profile() {
  const staff = await getStaff();
  if (!staff) return null;
  const letters = staff.displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return (
    <div className="flex items-center gap-3">
      <Avatar text={letters} />
      <div className="min-w-0 leading-tight">
        <p className="truncate text-[15px] font-bold">{staff.displayName}</p>
        <p className="truncate text-[13px] text-muted-foreground">
          {staff.role === "admin" ? "Admin" : "Staff"}
          {staff.email && ` · ${staff.email}`}
        </p>
      </div>
    </div>
  );
}
