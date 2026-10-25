"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/admin/ui";
import { useActionToast } from "@/components/admin/action-button";
import { saveSettings } from "@/app/admin/actions";
import type { Settings } from "@/lib/admin-data";

const selectClass = "h-11 rounded-[10px] border border-input bg-card px-3 text-[15px] disabled:opacity-60";
const COOLDOWNS = [
  { hours: 0, label: "No limit" },
  { hours: 4, label: "Every 4 hours" },
  { hours: 8, label: "Every 8 hours" },
  { hours: 12, label: "Every 12 hours" },
  { hours: 24, label: "Once per 24 hours" },
];
const IDLE = [30, 60, 90, 120];
const TIMEZONES = ["Australia/Hobart", "Australia/Melbourne", "Australia/Sydney", "Australia/Brisbane", "Australia/Adelaide", "Australia/Darwin", "Australia/Perth"];

function Hint({ children }: { children: React.ReactNode }) {
  return <span className="text-[13px] text-muted-foreground">{children}</span>;
}

export function SettingsForm({ settings: s, canEdit }: { settings: Settings; canEdit: boolean }) {
  const [state, formAction, pending] = useActionState(saveSettings, null);
  useActionToast(state);
  const [prefix, setPrefix] = useState(s.code_prefix);
  const preview = /^[A-Z]{2,4}$/.test(prefix) ? `${prefix}-7K3M-9QX2` : null;

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <fieldset disabled={!canEdit} className="flex flex-col gap-6">
        {!canEdit && <p className="text-sm font-semibold text-muted-foreground">Only the owner can change these settings.</p>}

        <Card className="flex flex-col gap-5 p-6">
          <h2 className="text-lg font-extrabold">Points</h2>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4.5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="points_per_visit">Points per visit</Label>
              <Input id="points_per_visit" name="points_per_visit" type="number" min={1} max={10000} required defaultValue={s.points_per_visit} />
              <Hint>Rewards and their point costs are set on the Rewards page.</Hint>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="checkin_cooldown_hours">Time between check-ins</Label>
              <select id="checkin_cooldown_hours" name="checkin_cooldown_hours" defaultValue={s.checkin_cooldown_hours} className={selectClass}>
                {!COOLDOWNS.some((c) => c.hours === s.checkin_cooldown_hours) && (
                  <option value={s.checkin_cooldown_hours}>Every {s.checkin_cooldown_hours} hours</option>
                )}
                {COOLDOWNS.map((c) => (
                  <option key={c.hours} value={c.hours}>
                    {c.label}
                  </option>
                ))}
              </select>
              <Hint>Stops the same visit being counted twice.</Hint>
            </div>
          </div>
        </Card>

        <Card className="flex flex-col gap-5 p-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-extrabold">Customer tiers</h2>
            <p className="text-sm text-muted-foreground">Based on total visits. Shown in the admin so you can spot your regulars.</p>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4.5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="tier_regular_visits">Regular from</Label>
              <div className="flex items-center gap-2">
                <Input id="tier_regular_visits" name="tier_regular_visits" type="number" min={1} max={9999} required defaultValue={s.tier_regular_visits} className="w-28" />
                <span className="text-sm font-semibold">visits</span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="tier_vip_visits">VIP from</Label>
              <div className="flex items-center gap-2">
                <Input id="tier_vip_visits" name="tier_vip_visits" type="number" min={2} max={10000} required defaultValue={s.tier_vip_visits} className="w-28" />
                <span className="text-sm font-semibold">visits</span>
              </div>
              <Hint>Below the Regular number, customers are New.</Hint>
            </div>
          </div>
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
                  New gift vouchers will look like <span className="font-mono font-bold text-foreground">{preview}</span>. Vouchers
                  already sold keep their code.
                </>
              ) : (
                "2 to 4 letters, e.g. BN for Best Nails."
              )}
            </Hint>
          </div>
        </Card>

        {canEdit && (
          <div className="flex justify-end">
            <Button type="submit" size="lg" disabled={pending}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        )}
      </fieldset>
    </form>
  );
}
