"use client";

import { useActionState, useState } from "react";
import { Cake, Gift, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, TierBadge } from "@/components/admin/ui";
import { ConfirmButton, useActionToast } from "@/components/admin/action-button";
import { deleteReward, saveBirthdayDiscount, saveReward } from "@/app/admin/actions";
import type { Settings } from "@/lib/admin-data";
import { cashBonusLine, rewardAmounts, type DiscountKind, type Reward } from "@/lib/rewards";
import { cn } from "@/lib/utils";
import { useFormSubmit } from "@/lib/use-form-submit";
import { cleanNumber, numberInput } from "@/lib/number-input";
import { TIER_LABELS, type Tier } from "@/lib/tiers";

type Item = { reward: Reward; uses: number };

export function RewardsManager({ items }: { items: Item[] }) {
  // "new" opens a blank editor; an id edits that reward.
  const [editing, setEditing] = useState<string | "new" | null>(null);

  return (
    <Card className="flex min-w-0 flex-[999_1_480px] flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Gift className="size-5 text-primary" aria-hidden="true" />
          <h2 className="text-lg font-extrabold">Points rewards</h2>
        </div>
        <Button size="sm" variant="outline" onClick={() => setEditing("new")}>
          <Plus aria-hidden="true" />
          Add reward
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        A reward&apos;s points are also the visits it takes. Give it a cash discount to pay more to customers who pay cash for
        those visits; the kiosk then asks &ldquo;Cash or card?&rdquo; at check-in.
      </p>

      {items.length === 0 && <p className="text-sm text-muted-foreground">No rewards yet.</p>}
      {items.map(({ reward: r, uses }) =>
        editing === r.id ? (
          <RewardEditor key={r.id} reward={r} onDone={() => setEditing(null)} />
        ) : (
          <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-background px-4 py-3.5">
            <div className="flex flex-col gap-0.5">
              <span className="text-base font-extrabold">{r.title}</span>
              {cashBonusLine(amounts(r)) && <span className="text-sm font-semibold text-primary">{cashBonusLine(amounts(r))}</span>}
              <span className="text-sm text-muted-foreground">
                {r.points_cost} points ({r.points_cost} visits) · redeemed {uses} time
                {uses === 1 ? "" : "s"}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-bold",
                  r.is_active ? "bg-success-soft text-success" : "bg-secondary text-muted-foreground",
                )}
              >
                <span className="size-2 rounded-full bg-current" aria-hidden="true" />
                {r.is_active ? "Active" : "Paused"}
              </span>
              <Button variant="outline" size="sm" onClick={() => setEditing(r.id)} aria-label={`Edit ${r.title}`}>
                Edit
              </Button>
            </div>
          </div>
        ),
      )}
      {editing === "new" && <RewardEditor onDone={() => setEditing(null)} />}
    </Card>
  );
}

const amounts = rewardAmounts;

/** A saved value as typed in the form: dollars for an amount (stored in cents), the percent as is. */
const typed = (kind: DiscountKind, v: number | null) => (v == null ? "" : kind === "amount" ? String(v / 100) : String(v));

function RewardEditor({ reward: r, onDone }: { reward?: Reward; onDone: () => void }) {
  const [state, formAction, pending] = useActionState(saveReward, null);
  useActionToast(state, { errors: false, onSuccess: onDone });
  const saved = r ? amounts(r) : null;
  const [kind, setKind] = useState<DiscountKind>(saved?.kind ?? "amount");
  const [discount, setDiscount] = useState(saved ? typed(saved.kind, saved.discount) : "");
  const [cash, setCash] = useState(saved ? typed(saved.kind, saved.cashDiscount) : "");
  const numberKind = kind === "amount" ? "money" : "digits";
  const unit = kind === "amount" ? "$" : "%";

  const formSubmit = useFormSubmit(state, formAction);
  return (
    <form {...formSubmit} className="flex flex-col gap-4 rounded-xl border-2 border-primary p-4">
      {r && <input type="hidden" name="id" value={r.id} />}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_160px]">
        <div className="flex flex-col gap-2">
          <Label htmlFor="title">Reward</Label>
          <Input
            id="title"
            name="title"
            maxLength={80}
            defaultValue={r?.title}
            placeholder="Optional · named from the discount"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="points_cost">Points needed</Label>
          <Input id="points_cost" name="points_cost" {...numberInput("digits")} maxLength={5} required defaultValue={r?.points_cost ?? 10} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[140px_1fr_1fr]">
        <div className="flex flex-col gap-2">
          <Label htmlFor="discount_kind">Type</Label>
          <select
            id="discount_kind"
            name="discount_kind"
            value={kind}
            onChange={(e) => {
              const next = e.target.value as DiscountKind;
              setKind(next);
              // "7.50" isn't a percent: keep the whole number.
              if (next === "percent") {
                setDiscount((v) => v.split(".")[0]);
                setCash((v) => v.split(".")[0]);
              }
            }}
            className="h-11 rounded-[10px] border border-input bg-card px-3 text-[15px]"
          >
            <option value="amount">$ off</option>
            <option value="percent">% off</option>
          </select>
        </div>
        {/* At least one of the two: each is required while the other is empty. */}
        <DiscountField
          id="discount"
          label="Discount"
          unit={unit}
          numberKind={numberKind}
          required={!cash}
          value={discount}
          onChange={setDiscount}
          placeholder={cash ? "None for card" : "e.g. 10"}
        />
        <DiscountField
          id="cash_discount"
          label="Cash discount"
          unit={unit}
          numberKind={numberKind}
          required={!discount}
          value={cash}
          onChange={setCash}
          placeholder={discount ? `Same as discount (${discount})` : kind === "amount" ? "e.g. 30" : "e.g. 20"}
        />
        <p className="text-[13px] text-muted-foreground sm:col-span-3">
          A dollar amount or a percentage off. The cash discount is given when at least the reward&apos;s points in visits
          since the customer&apos;s last reward were paid in cash (e.g. 7 of 7); otherwise the discount. Fill in at least
          one: only the discount for the same for everyone, only the cash discount for a reward just for cash visits.
        </p>
      </div>
      <label className="flex min-h-11 items-center gap-3 text-sm font-semibold">
        <input type="checkbox" name="is_active" defaultChecked={r?.is_active ?? true} className="size-5 accent-primary" />
        Active (shown on the kiosk and can be redeemed)
      </label>
      {state && !state.ok && (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {state.message}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {r ? (
          <ConfirmButton
            type="button"
            variant="danger"
            title={`Delete “${r.title}”?`}
            description="Past redemptions stay in customers' history. To stop it temporarily, untick Active instead."
            confirmLabel="Delete"
            action={deleteReward.bind(null, r.id)}
          >
            Delete
          </ConfirmButton>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" pending={pending}>
            {pending ? "Saving…" : r ? "Save reward" : "Create reward"}
          </Button>
        </div>
      </div>
    </form>
  );
}

const BIRTHDAY_TIERS = ["new", "regular", "vip"] as const satisfies readonly Tier[];

/** A reward's discount input, with its unit inside: "$" before an amount, "%" after a percent. */
function DiscountField({
  id,
  label,
  unit,
  numberKind,
  required,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  unit: "$" | "%";
  numberKind: "money" | "digits";
  required: boolean;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <span
          className={cn(
            "pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted-foreground",
            unit === "$" ? "left-3.5" : "right-3.5",
          )}
        >
          {unit}
        </span>
        <Input
          id={id}
          name={id}
          {...numberInput(numberKind)}
          maxLength={numberKind === "money" ? 7 : 3}
          required={required}
          value={value}
          onChange={(e) => onChange(cleanNumber(numberKind, e.target.value))}
          placeholder={placeholder}
          className={cn("tabular-nums", unit === "$" ? "pl-7" : "pr-8")}
        />
      </div>
    </div>
  );
}

/**
 * One tier's birthday discount: the badge and who's in it, then the amount with its unit (% off or
 * $ off) joined to it. A dollar amount is typed in dollars; the action stores cents.
 */
function BirthdayTierRow({ tier, settings: s }: { tier: Tier; settings: Settings }) {
  const savedKind = s[`birthday_kind_${tier}`];
  const saved = s[`birthday_value_${tier}`];
  const [kind, setKind] = useState<DiscountKind>(savedKind);
  const [value, setValue] = useState(savedKind === "amount" ? String(saved / 100) : String(saved));
  const numberKind = kind === "amount" ? "money" : "digits";
  const id = `birthday_value_${tier}`;
  return (
    <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
      <Label htmlFor={id} className="flex flex-col items-start gap-1">
        <TierBadge tier={tier} showNew />
        <span className="text-[13px] font-normal text-muted-foreground">{tierRangeLabel(tier, s)}</span>
      </Label>
      <div className="flex flex-none">
        <Input
          id={id}
          name={id}
          {...numberInput(numberKind)}
          maxLength={kind === "amount" ? 7 : 3}
          required
          value={value}
          onChange={(e) => setValue(cleanNumber(numberKind, e.target.value))}
          className="w-16 rounded-r-none text-right tabular-nums"
        />
        <select
          name={`birthday_kind_${tier}`}
          aria-label={`${TIER_LABELS[tier]} discount type`}
          value={kind}
          onChange={(e) => {
            const next = e.target.value as DiscountKind;
            setKind(next);
            // "7.50" isn't a percent: keep the whole number.
            if (next === "percent") setValue((v) => v.split(".")[0]);
          }}
          className="h-11 rounded-r-[10px] border border-l-0 border-input bg-secondary px-2 text-sm font-semibold"
        >
          <option value="percent">% off</option>
          <option value="amount">$ off</option>
        </select>
      </div>
    </div>
  );
}

/** Who's in a tier, from the thresholds in Settings, e.g. "10–19 points". */
function tierRangeLabel(tier: Tier, s: Settings) {
  if (tier === "vip") return `${s.tier_vip_points}+ points`;
  if (tier === "regular") return `${s.tier_regular_points}–${s.tier_vip_points - 1} points`;
  return `Under ${s.tier_regular_points} points`;
}

const WINDOWS = [
  { days: 0, label: "On the birthday only" },
  { days: 3, label: "3 days either side" },
  { days: 7, label: "Birthday week (7 days either side)" },
  { days: 14, label: "14 days either side" },
  { days: 31, label: "Within a month" },
];

export function BirthdayDiscountForm({
  settings: s,
  usedThisYear,
  canEdit,
}: {
  settings: Settings;
  usedThisYear: number;
  canEdit: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveBirthdayDiscount, null);
  useActionToast(state, { errors: false });

  const [enabled, setEnabled] = useState(s.birthday_discount_enabled);

  const formSubmit = useFormSubmit(state, formAction, { resetOnSuccess: false });
  return (
    <Card className="flex min-w-0 flex-[1_1_340px] flex-col gap-4 p-5">
      <div className="flex items-center gap-2.5">
        <Cake className="size-5 text-primary" aria-hidden="true" />
        <h2 className="text-lg font-extrabold">Birthday discount</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Free, once per birthday, from a customer&apos;s second visit, for customers with a birthday on file. Used {usedThisYear} time{usedThisYear === 1 ? "" : "s"} this
        year.
      </p>
      <form {...formSubmit}>
        <fieldset disabled={!canEdit} className="flex flex-col gap-4">
          <label className="flex min-h-11 items-center gap-3 text-sm font-semibold">
            <input
              type="checkbox"
              name="birthday_discount_enabled"
              defaultChecked={s.birthday_discount_enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="size-5 accent-primary"
            />
            Offer a birthday discount
          </label>
          {/* Dimmed while the discount is off. `inert` rather than `disabled`, so the values are
              still sent and kept for when it's turned back on. */}
          <div inert={!enabled} className={cn("flex flex-col gap-4 transition-opacity", !enabled && "opacity-50")}>
            {/* One row per tier: the badge and who's in it, then its discount. */}
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm leading-none font-semibold">Discount by tier</legend>
              <div className="flex flex-col divide-y divide-border rounded-xl border border-border">
                {BIRTHDAY_TIERS.map((tier) => (
                  <BirthdayTierRow key={tier} tier={tier} settings={s} />
                ))}
              </div>
              <p className="text-[13px] text-muted-foreground">A percent or a dollar amount off. 0 means no birthday discount for that tier.</p>
            </fieldset>
            <div className="flex flex-col gap-2">
              <Label htmlFor="birthday_window_days">When it can be used</Label>
              <select
                id="birthday_window_days"
                name="birthday_window_days"
                defaultValue={s.birthday_window_days}
                className="h-11 rounded-[10px] border border-input bg-card px-3 text-[15px] disabled:opacity-60"
              >
                {!WINDOWS.some((w) => w.days === s.birthday_window_days) && (
                  <option value={s.birthday_window_days}>{s.birthday_window_days} days either side</option>
                )}
                {WINDOWS.map((w) => (
                  <option key={w.days} value={w.days}>
                    {w.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {!canEdit && <p className="text-sm font-semibold text-muted-foreground">Only an admin can change this.</p>}
          {state && !state.ok && (
            <p role="alert" className="text-sm font-semibold text-destructive">
              {state.message}
            </p>
          )}
          {canEdit && (
            <Button type="submit" pending={pending} className="self-end">
              {pending ? "Saving…" : "Save birthday discount"}
            </Button>
          )}
        </fieldset>
      </form>
    </Card>
  );
}
