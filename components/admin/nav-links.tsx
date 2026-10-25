"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CheckSquare, Gift, LayoutGrid, Settings, Users, WalletCards } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutGrid, exact: true },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/check-ins", label: "Check-ins", icon: CheckSquare },
  { href: "/admin/rewards", label: "Rewards", icon: Gift },
  { href: "/admin/gift-vouchers", label: "Gift vouchers", icon: WalletCards },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function ActiveNavLinks() {
  return <NavLinks pathname={usePathname()} />;
}

export function NavLinks({ pathname }: { pathname: string | null }) {
  // On phones the links are a sideways-scrolling tab bar: keep the current page's tab in view.
  // Only the bar scrolls (not scrollIntoView, which can also move the page).
  const list = useRef<HTMLUListElement>(null);
  useEffect(() => {
    const ul = list.current;
    const current = ul?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!ul || !current || ul.scrollWidth <= ul.clientWidth) return;
    const left = current.getBoundingClientRect().left - ul.getBoundingClientRect().left + ul.scrollLeft;
    ul.scrollLeft = left - (ul.clientWidth - current.offsetWidth) / 2;
  }, [pathname]);

  return (
    <ul ref={list} className="-mx-1 flex gap-1 overflow-x-auto px-1 md:flex-col md:overflow-visible">
      {NAV.map(({ href, label, icon: Icon, exact }) => {
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
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
