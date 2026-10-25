"use client";

import { useState } from "react";
import { ArrowLeft, Gift, Plus, WalletCards } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SellGiftVoucherForm, UseGiftVoucher } from "@/components/admin/gift-voucher-forms";
import { fillPhoneMask } from "@/lib/phone-mask";

type View = "menu" | "sell" | "use";

const VIEWS: Record<View, { title: string; description: string }> = {
  menu: { title: "Gift vouchers", description: "Sell a new voucher, or take today's service off one." },
  sell: { title: "Sell a gift voucher", description: "Take payment at the till as usual. The voucher is valid for 3 years." },
  use: { title: "Use a gift voucher", description: "Check the balance, then take today's service off it." },
};

const choice =
  "flex min-h-20 w-full items-center gap-4 rounded-2xl border border-border bg-card px-5 text-left hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";

/**
 * The kiosk's Gift voucher button, for whoever is signed in on the iPad (admin or staff): the
 * same Sell and Use forms as the admin, in one dialog. After a sale it stays on the kiosk.
 * Once a customer has typed their number, `phone` (and `name`) fill in who it's for, so the
 * voucher is linked to them. `onOpenChange` lets the kiosk pause its timers meanwhile.
 */
export function GiftVoucherMenu({
  phone = "",
  name,
  onOpenChange,
}: {
  phone?: string;
  name?: string;
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpenState] = useState(false);
  const [view, setView] = useState<View>("menu");
  const setOpen = (next: boolean) => {
    setOpenState(next);
    onOpenChange?.(next);
  };
  const close = () => setOpen(false);
  const formatted = phone ? fillPhoneMask(phone).typed.trim() : "";

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setView("menu");
          setOpen(true);
        }}
        className="flex min-h-12 items-center gap-2 rounded-full border border-kiosk-line px-5 text-base font-bold text-kiosk-muted hover:text-kiosk-ink"
      >
        <Gift className="size-5" aria-hidden="true" />
        <span className="max-sm:sr-only">Gift voucher</span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            {view !== "menu" && (
              <button
                type="button"
                onClick={() => setView("menu")}
                className="flex w-fit items-center gap-1.5 text-sm font-bold text-primary hover:underline"
              >
                <ArrowLeft className="size-4" aria-hidden="true" />
                Gift vouchers
              </button>
            )}
            <DialogTitle>{VIEWS[view].title}</DialogTitle>
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
              <button type="button" onClick={() => setView("sell")} className={choice}>
                <Plus className="size-6 flex-none text-primary" aria-hidden="true" />
                <span className="flex flex-col">
                  <span className="text-base font-bold">Sell a gift voucher</span>
                  <span className="text-sm text-muted-foreground">A customer is buying one</span>
                </span>
              </button>
              <button type="button" onClick={() => setView("use")} className={choice}>
                <WalletCards className="size-6 flex-none text-primary" aria-hidden="true" />
                <span className="flex flex-col">
                  <span className="text-base font-bold">Use a gift voucher</span>
                  <span className="text-sm text-muted-foreground">Check a balance or pay with one</span>
                </span>
              </button>
            </div>
          )}
          {view === "sell" && <SellGiftVoucherForm onDone={close} openAfterSale={false} defaultPhone={formatted} />}
          {view === "use" && <UseGiftVoucher onDone={close} defaultPhone={formatted} />}
        </DialogContent>
      </Dialog>
    </>
  );
}
