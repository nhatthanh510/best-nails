"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, TierBadge } from "@/components/admin/ui";
import { useActionToast } from "@/components/admin/action-button";
import { saveSettings, type ActionState } from "@/app/admin/actions";
import type { Settings } from "@/lib/admin-data";

const selectClass = "h-11 rounded-[10px] border border-input bg-card px-3 text-[15px] disabled:opacity-60";
const IDLE = [30, 60, 90, 120];
const TIMEZONES = ["Australia/Hobart", "Australia/Melbourne", "Australia/Sydney", "Australia/Brisbane", "Australia/Adelaide", "Australia/Darwin", "Australia/Perth"];

function Hint({ children }: { children: React.ReactNode }) {
  return <span className="text-[13px] text-muted-foreground">{children}</span>;
}

/** The form's values in a comparable form, to tell whether anything has changed since the last save. */
const snapshot = (form: HTMLFormElement | null) => (form ? JSON.stringify([...new FormData(form)]) : "");

export function SettingsForm({ settings: s, canEdit }: { settings: Settings; canEdit: boolean }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const saved = useRef("");
  const [dirty, setDirty] = useState(false);
  const [leaveTo, setLeaveTo] = useState<string | null>(null);
  const [prefix, setPrefix] = useState(s.code_prefix);
  const [regular, setRegular] = useState(String(s.tier_regular_points));
  const [vip, setVip] = useState(String(s.tier_vip_points));

  const [state, formAction, pending] = useActionState(async (prev: ActionState, fd: FormData) => {
    const result = await saveSettings(prev, fd);
    if (result?.ok) {
      saved.current = JSON.stringify([...fd]);
      setDirty(false);
    }
    return result;
  }, null);
  useActionToast(state);

  useEffect(() => {
    saved.current = snapshot(formRef.current);
  }, []);

  // While there are unsaved changes, closing the tab asks first, and links inside the app open
  // the "Leave without saving?" dialog instead of navigating.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    const onClick = (e: MouseEvent) => {
      const link = (e.target as Element | null)?.closest?.("a[href]");
      if (!(link instanceof HTMLAnchorElement) || link.target || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const url = new URL(link.href);
      if (url.origin !== location.origin || url.pathname === location.pathname) return;
      // Capture phase on document runs before Next's <Link> handler, so this stops the navigation.
      e.preventDefault();
      e.stopPropagation();
      setLeaveTo(url.pathname + url.search + url.hash);
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);

  const preview = /^[A-Z]{2,4}$/.test(prefix) ? `${prefix}48207138` : null;
  const regularN = Number(regular);
  const vipN = Number(vip);
  const tiersValid = regularN >= 1 && vipN > regularN;

  return (
    <form
      ref={formRef}
      action={formAction}
      onChange={() => setDirty(snapshot(formRef.current) !== saved.current)}
      className="flex flex-col gap-6"
    >
      <fieldset disabled={!canEdit} className="flex flex-col gap-6">
        {!canEdit && <p className="text-sm font-semibold text-muted-foreground">Only an admin can change these settings.</p>}

        <Card className="flex flex-col gap-5 p-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-extrabold">Customer tiers</h2>
            <p className="text-sm text-muted-foreground">
              Based on lifetime points: one per check-in, plus any you add by hand. Shown in the admin so you can spot your regulars.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="tier_regular_points">Regular from</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="tier_regular_points"
                  name="tier_regular_points"
                  type="number"
                  min={1}
                  max={9999}
                  required
                  value={regular}
                  onChange={(e) => setRegular(e.target.value)}
                  className="w-24"
                />
                <span className="text-sm font-semibold">points</span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="tier_vip_points">VIP from</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="tier_vip_points"
                  name="tier_vip_points"
                  type="number"
                  min={2}
                  max={10000}
                  required
                  value={vip}
                  onChange={(e) => setVip(e.target.value)}
                  className="w-24"
                />
                <span className="text-sm font-semibold">points</span>
              </div>
            </div>
          </div>
          {/* What the two numbers mean, updated as they're typed. */}
          {tiersValid ? (
            <ul aria-label="Tiers" className="flex flex-wrap gap-2 text-sm">
              {(
                [
                  ["new", regularN === 1 ? "under 1 point" : `0–${regularN - 1} points`],
                  ["regular", vipN - 1 === regularN ? `${regularN} points` : `${regularN}–${vipN - 1} points`],
                  ["vip", `${vipN}+ points`],
                ] as const
              ).map(([tier, range]) => (
                <li key={tier} className="flex items-center gap-2 rounded-full bg-background py-1.5 pr-3.5 pl-1.5">
                  <TierBadge tier={tier} showNew />
                  <span className="text-muted-foreground">{range}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p role="alert" className="text-sm font-semibold text-destructive">
              VIP needs more points than Regular.
            </p>
          )}
        </Card>

        <Card className="flex flex-col gap-5 p-6">
          <h2 className="text-lg font-extrabold">Kiosk &amp; shop</h2>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4.5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="kiosk_idle_seconds">Return to start after</Label>
              <select id="kiosk_idle_seconds" name="kiosk_idle_seconds" defaultValue={s.kiosk_idle_seconds} className={selectClass}>
                {!IDLE.includes(s.kiosk_idle_seconds) && <option value={s.kiosk_idle_seconds}>{s.kiosk_idle_seconds} seconds idle</option>}
                {IDLE.map((n) => (
                  <option key={n} value={n}>
                    {n} seconds idle
                  </option>
                ))}
              </select>
              <Hint>Clears the phone number so the next person can&apos;t see it.</Hint>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="timezone">Shop timezone</Label>
              <select id="timezone" name="timezone" defaultValue={s.timezone} className={selectClass}>
                {!TIMEZONES.includes(s.timezone) && <option value={s.timezone}>{s.timezone}</option>}
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz.replace("Australia/", "")}
                  </option>
                ))}
              </select>
              <Hint>Used for “today”, reports and birthdays.</Hint>
            </div>
          </div>
        </Card>

        <Card className="flex flex-col gap-5 p-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-extrabold">Gift voucher codes</h2>
            <Hint>Shows which business a gift voucher belongs to, if you run more than one.</Hint>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="code_prefix">Business code prefix</Label>
            <Input
              id="code_prefix"
              name="code_prefix"
              required
              minLength={2}
              maxLength={4}
              pattern="[A-Za-z]{2,4}"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              value={prefix}
              onChange={(e) => setPrefix(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))}
              className="w-32 font-mono text-base tracking-wider uppercase"
            />
            <Hint>
              {preview ? (
                <>
                  New gift vouchers will look like <span className="font-mono font-bold text-foreground">{preview}</span>: your prefix
                  and 8 digits, easy to copy from paper. Vouchers already sold keep their code.
                </>
              ) : (
                "2 to 4 letters, e.g. BN for Best Nails."
              )}
            </Hint>
          </div>
        </Card>

        {/* Always there, as in the design. Unsaved changes still ask before leaving the page. */}
        {canEdit && (
          <div className="flex justify-end">
            <Button type="submit" size="lg" pending={pending} disabled={!tiersValid}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        )}
      </fieldset>

      <Dialog open={leaveTo !== null} onOpenChange={(open) => !open && setLeaveTo(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Leave without saving?</DialogTitle>
            <DialogDescription>Your changes to Settings haven&apos;t been saved and will be lost.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLeaveTo(null)}>
              Stay
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                const to = leaveTo;
                setDirty(false);
                setLeaveTo(null);
                if (to) router.push(to);
              }}
            >
              Leave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}
