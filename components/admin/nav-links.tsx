"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CheckSquare, Gift, LayoutGrid, Settings, Ticket, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutGrid, exact: true },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/check-ins", label: "Check-ins", icon: CheckSquare },
  { href: "/admin/rewards", label: "Rewards", icon: Gift },
  { href: "/admin/vouchers", label: "Vouchers", icon: Ticket },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function ActiveNavLinks() {
  return <NavLinks pathname={usePathname()} />;
}

export function NavLinks({ pathname }: { pathname: string | null }) {
  return (
    <ul className="-mx-1 flex gap-1 overflow-x-auto px-1 md:flex-col md:overflow-visible">
      {NAV.map(({ href, label, icon: Icon, exact }) => {
        const active = pathname !== null && (exact ? pathname === href : pathname.startsWith(href));
        return (
          <li key={href} className="flex-none">
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-[10px] px-3 text-[15px] font-semibold whitespace-nowrap",
                active ? "bg-accent font-bold text-accent-foreground" : "hover:bg-muted",
              )}
            >
              <Icon className="size-5" aria-hidden="true" />
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
