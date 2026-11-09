"use client";

import { useRef, useState, useTransition } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, Copy, Ellipsis, ExternalLink, Eye, Link2, Plus, Printer, Trash2, Undo2, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { BlockGiftCardForm, SellGiftCardForm, TopUpForm, UseGiftCard } from "@/components/admin/gift-card-forms";
import { printGiftCardNodes, PrintedGiftCard } from "@/components/admin/printed-gift-card";
import { useGiftCardFormat } from "@/lib/gift-card-format";
import { GIFT_CARD_FORMATS } from "@/lib/gift-card-sheet";
import { deleteGiftCard, unblockGiftCard } from "@/app/admin/gift-card-actions";
import { giftCardBalanceUrl } from "@/lib/gift-card-link";
import type { GiftCardStatus } from "@/lib/gift-cards";

type Row = {
  id: string;
  code: string;
  status: GiftCardStatus;
  token: string;
  expiresOn: string | null;
  neverUsed: boolean;
  /** For Use: the list already has these, so its form opens complete rather than checking first. */
  balanceCents: number;
  loadedCents: number | null;
  customerName: string | null;
};
type Open = "use" | "top_up" | "create" | "block" | "delete" | null;

const TITLES: Record<Exclude<Open, null>, (code: string) => { title: string; description: string }> = {
  use: (code) => ({ title: `Use ${code}`, description: "Take today's service off this gift card." }),
  top_up: (code) => ({ title: `Top up ${code}`, description: "Put more money on a gift card the customer already has. Take payment at the till as usual." }),
  create: (code) => ({ title: `Activate ${code}`, description: "Take payment at the till as usual. The gift card is valid for 3 years." }),
  block: (code) => ({ title: `Block ${code}?`, description: "If it's lost or stolen, so nobody else can use it. The balance is kept, and you can unblock it later." }),
  delete: (code) => ({ title: `Delete ${code}?`, description: "For a gift card created by mistake (refund it at the till) or a blank card that's lost or spoiled. This can't be undone." }),
};

/**
 * A gift card row's ⋯ menu in the Gift cards list: the actions that fit its status (as on its
 * page: Use, Top up, Activate), then copying, printing, and the admin fixes, so common jobs don't
 * need the gift card's page. The forms open in a dialog over the list.
 */
export function GiftCardRowActions({ giftCard: v }: { giftCard: Row }) {
  const router = useRouter();
  const [open, setOpen] = useState<Open>(null);
  const [printing, setPrinting] = useState(false);
  const [pending, start] = useTransition();
  const card = useRef<HTMLDivElement>(null);
  const [format] = useGiftCardFormat();

  // Print draws the card off screen (synchronously, so it's there to copy), prints it, then drops it.
  const print = () => {
    flushSync(() => setPrinting(true));
    if (card.current) printGiftCardNodes([card.current], format);
    setPrinting(false);
  };

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${what} copied.`);
    } catch {
      toast.error(`Couldn't copy the ${what.toLowerCase()}.`);
    }
  };
  const run = (action: () => Promise<{ ok: boolean; message?: string } | null>) =>
    start(async () => {
      const result = await action();
      if (result?.ok) toast.success(result.message ?? "Done");
      else toast.error(result?.message ?? "Something went wrong.");
      if (result?.ok) {
        setOpen(null);
        router.refresh();
      }
    });

  const close = () => setOpen(null);
  const sold = v.status !== "inactive";
  return (
    <div className="flex items-center justify-end">
      {/* modal={false}: a dialog opened from an item would otherwise fight the menu for focus. */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Actions for ${v.code}`} pending={pending} className="-my-2 text-muted-foreground">
            <Ellipsis aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem asChild>
            <Link href={`/admin/gift-cards/${v.id}`}>
              <Eye aria-hidden="true" />
              Open gift card
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            {/* The page the card's QR opens: what the customer sees. */}
            <a href={giftCardBalanceUrl(v.token)} target="_blank" rel="noopener noreferrer">
              <ExternalLink aria-hidden="true" />
              Open balance page
            </a>
          </DropdownMenuItem>
          {v.status === "active" && (
            <DropdownMenuItem onSelect={() => setOpen("use")}>
              <WalletCards aria-hidden="true" />
              Use
            </DropdownMenuItem>
          )}
          {(v.status === "active" || v.status === "used_up") && (
            <DropdownMenuItem onSelect={() => setOpen("top_up")}>
              <Plus aria-hidden="true" />
              Top up
            </DropdownMenuItem>
          )}
          {v.status === "inactive" && (
            <DropdownMenuItem onSelect={() => setOpen("create")}>
              <Plus aria-hidden="true" />
              Activate gift card
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => copy(v.code, "Code")}>
            <Copy aria-hidden="true" />
            Copy code
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => copy(giftCardBalanceUrl(v.token), "Balance link")}>
            <Link2 aria-hidden="true" />
            Copy balance link
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={print}>
            <Printer aria-hidden="true" />
            Print {GIFT_CARD_FORMATS[format].name.toLowerCase()}
          </DropdownMenuItem>
          {(sold || v.neverUsed) && <DropdownMenuSeparator />}
          {sold && v.status !== "blocked" && (
            <DropdownMenuItem onSelect={() => setOpen("block")}>
              <Ban aria-hidden="true" />
              Block…
            </DropdownMenuItem>
          )}
          {v.status === "blocked" && (
            <DropdownMenuItem disabled={pending} onSelect={() => run(() => unblockGiftCard(v.id))}>
              <Undo2 aria-hidden="true" />
              Unblock
            </DropdownMenuItem>
          )}
          {v.neverUsed && (
            <DropdownMenuItem variant="destructive" onSelect={() => setOpen("delete")}>
              <Trash2 aria-hidden="true" />
              Delete…
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={open !== null} onOpenChange={(next) => !next && close()}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          {open && (
            <DialogHeader>
              <DialogTitle>{TITLES[open](v.code).title}</DialogTitle>
              <DialogDescription>{TITLES[open](v.code).description}</DialogDescription>
            </DialogHeader>
          )}
          {open === "use" && (
            <UseGiftCard
              code={v.code}
              initialCheck={
                v.expiresOn && v.loadedCents !== null
                  ? { ok: true, id: v.id, code: v.code, balanceCents: v.balanceCents, amountCents: v.loadedCents, expiresOn: v.expiresOn, customerName: v.customerName }
                  : undefined
              }
              onDone={close}
            />
          )}
          {open === "top_up" && <TopUpForm code={v.code} onDone={close} />}
          {open === "create" && <SellGiftCardForm defaultCode={v.code} activate onDone={close} />}
          {open === "block" && <BlockGiftCardForm id={v.id} onDone={close} />}
          {open === "delete" && (
            <DialogFooter>
              <Button type="button" variant="outline" size="lg" onClick={close}>
                Cancel
              </Button>
              <Button type="button" variant="destructive" size="lg" pending={pending} onClick={() => run(() => deleteGiftCard(v.id))}>
                Delete gift card
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* The card to print, drawn off screen only while printing. */}
      {printing && (
        <div aria-hidden="true" className="fixed top-0 -left-[10000px] w-[560px]">
          <PrintedGiftCard ref={card} code={v.code} expiresOn={v.expiresOn} token={v.token} format={format} />
        </div>
      )}
    </div>
  );
}
