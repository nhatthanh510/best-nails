"use client";

import { useActionState, useState, useTransition } from "react";
import { Eye, EyeOff, KeyRound, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/admin/ui";
import { FormDialog } from "@/components/admin/form-dialog";
import { ConfirmButton, useActionToast } from "@/components/admin/action-button";
import { clearKioskPin, revealKioskPin, setKioskPin } from "@/app/admin/actions";
import { toast } from "sonner";

/**
 * Settings → Kiosk PIN: one shop PIN that staff type on the iPad before the Staff menu (Gift card,
 * Admin, Sign out), so a customer holding the iPad can't open it. A summary row with its actions;
 * setting or changing it opens a dialog with one field (and Show), since it's rarely changed. Only
 * its hash is stored, so it can be changed or turned off here but never shown.
 */
export function KioskPinCard({ isSet, changedOn, version }: { isSet: boolean; changedOn: string | null; version: string | null }) {
  return (
    <Card className="flex flex-col gap-4 p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-extrabold">Kiosk PIN</h2>
        <p className="text-sm text-muted-foreground">Staff type it on the iPad to open the Staff menu: Gift card, Admin and Sign out.</p>
      </div>

      <div
        className={
          isSet
            ? "flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-4 py-3"
            : "flex flex-wrap items-center justify-between gap-3 rounded-xl bg-warning-soft px-4 py-3"
        }
      >
        {isSet ? (
          <p className="flex items-center gap-2 text-[15px] font-semibold">
            <span className="size-2 rounded-full bg-success" aria-hidden="true" />
            <span>
              On{changedOn && <span className="font-normal text-muted-foreground"> · changed {changedOn}</span>}
            </span>
            {/* A new PIN hides the one shown. */}
            <ShowPin key={version ?? ""} />
          </p>
        ) : (
          <p className="flex items-center gap-2 text-sm font-semibold text-warning">
            <TriangleAlert className="size-4.5 flex-none" aria-hidden="true" />
            Off: anyone holding the iPad can open the Staff menu.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <PinDialog isSet={isSet} />
          {isSet && (
            <ConfirmButton
              type="button"
              variant="outline"
              action={clearKioskPin}
              title="Turn off the kiosk PIN?"
              description="The Staff menu will open without a PIN, so a customer holding the iPad could create gift cards or sign the kiosk out."
              confirmLabel="Turn off"
            >
              Turn off
            </ConfirmButton>
          )}
        </div>
      </div>

      <p className="text-[13px] text-muted-foreground">Tip: sign the iPad in with a staff account, not an admin one, and change the PIN when someone leaves.</p>
    </Card>
  );
}

/**
 * Shows the current PIN in the status row (admin), fetched when asked rather than sent with the
 * page. Nothing comes back only if the PIN was turned off meanwhile.
 */
function ShowPin() {
  const [pin, setPin] = useState<string | null | undefined>(undefined);
  const [pending, start] = useTransition();
  const shown = pin !== undefined;
  const toggle = () => {
    if (shown) return setPin(undefined);
    start(async () => {
      const result = await revealKioskPin();
      if (!result.ok) toast.error(result.message);
      else setPin(result.pin);
    });
  };
  return (
    <>
      {shown && (
        <span className="ml-1 rounded-md bg-secondary px-2 py-0.5 font-mono text-[15px] tracking-[0.3em] tabular-nums">
          {pin ?? <span className="font-sans text-[13px] font-normal tracking-normal text-muted-foreground">No PIN is set</span>}
        </span>
      )}
      <Button type="button" variant="ghost" size="sm" pending={pending} onClick={toggle} aria-pressed={shown} className="text-muted-foreground">
        {shown ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        {shown ? "Hide" : "Show"}
      </Button>
    </>
  );
}

function PinDialog({ isSet }: { isSet: boolean }) {
  return (
    <FormDialog
      variant={isSet ? "outline" : "default"}
      title={isSet ? "Change kiosk PIN" : "Set a kiosk PIN"}
      description={isSet ? "Tell staff the new PIN. The old one stops working straight away." : "Staff will type it on the iPad to open the Staff menu."}
      trigger={
        <>
          <KeyRound aria-hidden="true" />
          {isSet ? "Change PIN" : "Set a PIN"}
        </>
      }
    >
      {(close) => <PinForm onDone={close} />}
    </FormDialog>
  );
}

function PinForm({ onDone }: { onDone: () => void }) {
  const [pin, setPin] = useState("");
  const [show, setShow] = useState(false);
  const [state, action, pending] = useActionState(setKioskPin, null);
  useActionToast(state, { onSuccess: onDone });
  const valid = /^[0-9]{4,8}$/.test(pin);

  return (
    <form action={action} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="kiosk_pin">New PIN</Label>
        <div className="relative w-56">
          <Input
            id="kiosk_pin"
            name="pin"
            type={show ? "text" : "password"}
            inputMode="numeric"
            autoComplete="new-password"
            autoFocus
            maxLength={8}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
            aria-describedby="kiosk_pin_hint"
            className="pr-12 text-base tracking-[0.3em] tabular-nums"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Hide PIN" : "Show PIN"}
            aria-pressed={show}
            className="absolute top-1/2 right-1 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {show ? <EyeOff className="size-4.5" aria-hidden="true" /> : <Eye className="size-4.5" aria-hidden="true" />}
          </button>
        </div>
        <p id="kiosk_pin_hint" className="text-[13px] text-muted-foreground">
          4 to 8 digits; 6 is harder to guess. After 5 wrong tries the kiosk waits a minute.
        </p>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="lg" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" size="lg" pending={pending} disabled={!valid}>
          Save PIN
        </Button>
      </div>
    </form>
  );
}
