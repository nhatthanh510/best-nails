"use client";

import { useState } from "react";
import { ArrowLeft, Plus, Search } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SellGiftCardForm } from "@/components/admin/gift-card-forms";
import { FindGiftCard } from "@/components/admin/find-gift-card";
import { fillPhoneMask } from "@/lib/phone-mask";
import { lockKiosk } from "@/app/kiosk/pin-actions";

type View = "menu" | "sell" | "find";

const VIEWS: Record<View, { title: string; description: string }> = {
  menu: { title: "Gift cards", description: "Find a gift card the customer has, or create a new one." },
  sell: { title: "Create a gift card", description: "Take payment at the till as usual. The gift card is valid for 3 years." },
  find: { title: "Find a gift card", description: "Type the code on the gift card. You'll see its balance and what you can do with it." },
};

const choice =
  "flex min-h-20 w-full items-center gap-4 rounded-2xl border border-border bg-card px-5 text-left hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";

/**
 * The kiosk's gift card dialog (Staff → Gift card), for whoever is signed in on the iPad (admin or
 * staff): the same Create and Find forms as the admin. After a sale it stays on the kiosk. Once a
 * customer has typed their number, `phone` (and `name`) fill in who it's for, so the gift card is
 * linked to them. The kiosk opens and closes it; `relock` locks the gift card actions again on close.
 */
export function GiftCardMenu({
  open,
  onOpenChange,
  phone = "",
  name,
  relock = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phone?: string;
  name?: string;
  /** A staff PIN is set: closing the dialog locks the gift card actions again. */
  relock?: boolean;
}) {
  const [view, setView] = useState<View>("menu");
  // Each time it opens, it starts at the menu.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setView("menu");
  }
  const setOpen = (next: boolean) => {
    onOpenChange(next);
    if (!next && relock) lockKiosk().catch(() => {});
  };
  const close = () => setOpen(false);
  const formatted = phone ? fillPhoneMask(phone).typed.trim() : "";

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        {/* Sized to fit an iPad (or a 13" laptop) without scrolling; it still scrolls on anything smaller. */}
        <DialogContent className="kiosk-theme max-h-[94dvh] overflow-y-auto rounded-3xl ring-kiosk-line sm:max-w-xl">
          <DialogHeader>
            {view !== "menu" && (
              <button
                type="button"
                onClick={() => setView("menu")}
                className="flex w-fit items-center gap-1.5 text-sm font-bold text-primary hover:underline"
              >
                <ArrowLeft className="size-4" aria-hidden="true" />
                Gift cards
              </button>
            )}
            <DialogTitle className="text-[30px]">{VIEWS[view].title}</DialogTitle>
            <DialogDescription>{VIEWS[view].description}</DialogDescription>
            {formatted && (
              <p className="w-fit rounded-full bg-secondary px-3 py-1 text-sm font-semibold">
                For {name ? `${name} · ` : ""}
                <span className="tabular-nums">{formatted}</span>
              </p>
            )}
          </DialogHeader>
          {view === "menu" && (
            <div className="flex flex-col gap-3">
              <button type="button" onClick={() => setView("find")} className={choice}>
                <Search className="size-6 flex-none text-primary" aria-hidden="true" />
                <span className="flex flex-col">
                  <span className="text-base font-bold">Find a gift card</span>
                  <span className="text-sm text-muted-foreground">They have one: use it, top it up, or activate a blank card</span>
                </span>
              </button>
              <button type="button" onClick={() => setView("sell")} className={choice}>
                <Plus className="size-6 flex-none text-primary" aria-hidden="true" />
                <span className="flex flex-col">
                  <span className="text-base font-bold">Create a gift card</span>
                  <span className="text-sm text-muted-foreground">A customer is buying a new one</span>
                </span>
              </button>
            </div>
          )}
          {view === "sell" && <SellGiftCardForm onDone={close} openAfterSale={false} defaultPhone={formatted} phoneKnown={Boolean(formatted)} />}
          {view === "find" && <FindGiftCard onDone={close} onKiosk defaultPhone={formatted} phoneKnown={Boolean(formatted)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}
