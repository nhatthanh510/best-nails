"use client";

import { useEffect, useSyncExternalStore } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/kiosk/brand";
import { SIDEBAR_EVENT as EVENT, SIDEBAR_KEY as KEY } from "@/lib/sidebar";

const isCollapsed = () => document.documentElement.hasAttribute("data-nav-collapsed");
const subscribe = (onChange: () => void) => {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
};

/**
 * Collapse the sidebar to an icon rail (as on a tablet) for more room, or open it again: a panel
 * icon beside the logo, as in Notion, Linear and ChatGPT, and ⌘\ / Ctrl+\ from anywhere. Laptop
 * width and up only, since smaller screens already have the rail or the phone menu. The choice is
 * remembered in this browser; the `rail:` variant (globals.css) does the rest.
 */
export function SidebarToggle({ className }: { className?: string }) {
  const collapsed = useSyncExternalStore(subscribe, isCollapsed, () => false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "\\" && window.matchMedia("(width >= 64rem)").matches) {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const label = collapsed ? "Expand sidebar" : "Collapse sidebar";
  // Both states are drawn and CSS picks one (`lg:rail:` is the collapsed sidebar), so a page that
  // loads collapsed looks right before React knows. Collapsed, it shows the logo, small enough for
  // the rail, and the expand icon on hover or keyboard focus, as in ChatGPT; a tap expands it.
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={`${label} (⌘\\ or Ctrl+\\)`}
      aria-expanded={!collapsed}
      className={cn(
        "group/toggle hidden size-9 flex-none items-center justify-center rounded-[10px] text-muted-foreground hover:bg-muted hover:text-foreground lg:flex lg:rail:size-11",
        className,
      )}
    >
      <PanelLeftClose className="size-4.5 lg:rail:hidden" aria-hidden="true" />
      <BrandMark className="hidden size-9 lg:rail:block lg:rail:group-hover/toggle:hidden lg:rail:group-focus-visible/toggle:hidden" sizes="36px" />
      <PanelLeftOpen className="hidden size-4.5 lg:rail:group-hover/toggle:block lg:rail:group-focus-visible/toggle:block" aria-hidden="true" />
    </button>
  );
}

function toggle() {
  const next = !isCollapsed();
  document.documentElement.toggleAttribute("data-nav-collapsed", next);
  try {
    localStorage.setItem(KEY, next ? "1" : "0");
  } catch {
    // Storage blocked (private browsing): it still collapses for this visit.
  }
  window.dispatchEvent(new Event(EVENT));
}
