"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CheckSquare, Gift, LayoutGrid, Settings, Sparkles, Users, WalletCards } from "lucide-react";
import { cn } from "@/lib/utils";
import { NavProgress } from "./nav-progress";

type NavItem = { href: string; label: string; icon: typeof LayoutGrid; exact?: boolean };

// Two groups: what staff use through the day, then setup the owner changes now and then.
const NAV: { label: string | null; items: NavItem[] }[] = [
  {
    label: null,
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutGrid, exact: true },
      { href: "/admin/customers", label: "Customers", icon: Users },
      { href: "/admin/check-ins", label: "Check-ins", icon: CheckSquare },
      { href: "/admin/gift-vouchers", label: "Gift vouchers", icon: WalletCards },
    ],
  },
  {
    label: "Setup",
    items: [
      { href: "/admin/rewards", label: "Rewards", icon: Gift },
      { href: "/admin/services", label: "Services & staff", icon: Sparkles },
      { href: "/admin/settings", label: "Settings", icon: Settings },
    ],
  },
];

export function ActiveNavLinks() {
  return <NavLinks pathname={usePathname()} />;
}

export function NavLinks({ pathname }: { pathname: string | null }) {
  return (
    <div className="flex flex-col gap-4">
      {NAV.map((group) => (
        <div key={group.label ?? "main"} className={cn(group.label && "border-t border-border pt-4")}>
          {group.label && (
            // The icon rail on portrait iPads has no room for it: the divider marks the group there.
            <h2 id={`nav-${group.label}`} className="mb-1.5 px-3 text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase md:max-lg:sr-only">
              {group.label}
            </h2>
          )}
          <ul aria-labelledby={group.label ? `nav-${group.label}` : undefined} className="-mx-1 flex flex-col gap-1 px-1">
            {group.items.map(({ href, label, icon: Icon, exact }) => {
              const active = pathname !== null && (exact ? pathname === href : pathname.startsWith(href));
              return (
                <li key={href} className="flex-none">
                  <Link
                    href={href}
                    title={label}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-11 items-center gap-3 rounded-[10px] px-3 text-[15px] font-semibold whitespace-nowrap",
                      // Icon rail on portrait iPads: the label stays for screen readers.
                      "md:max-lg:justify-center md:max-lg:px-0",
                      active ? "bg-accent font-bold text-accent-foreground" : "hover:bg-muted",
                    )}
                  >
                    <Icon className="size-5 flex-none" aria-hidden="true" />
                    <span className="md:max-lg:sr-only">{label}</span>
                    <NavProgress />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
