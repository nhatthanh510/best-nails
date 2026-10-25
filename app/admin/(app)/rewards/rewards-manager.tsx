"use client";

import { useActionState, useState } from "react";
import { Cake, Gift, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/admin/ui";
import { ConfirmButton, useActionToast } from "@/components/admin/action-button";
import { deleteReward, saveBirthdayDiscount, saveReward } from "@/app/admin/actions";
import type { Settings } from "@/lib/admin-data";
import type { Reward } from "@/lib/rewards";
import { cn } from "@/lib/utils";
import { useFormSubmit } from "@/lib/use-form-submit";
import { numberInput } from "@/lib/number-input";

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
        A reward&apos;s points are also the visits it takes.
      </p>

      {items.length === 0 && <p className="text-sm text-muted-foreground">No rewards yet.</p>}
      {items.map(({ reward: r, uses }) =>
        editing === r.id ? (
          <RewardEditor key={r.id} reward={r} onDone={() => setEditing(null)} />
        ) : (
          <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-background px-4 py-3.5">
            <div className="flex flex-col gap-0.5">
              <span className="text-base font-extrabold">{r.title}</span>
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

function RewardEditor({ reward: r, onDone }: { reward?: Reward; onDone: () => void }) {
  const [state, formAction, pending] = useActionState(saveReward, null);
  useActionToast(state, { errors: false, onSuccess: onDone });

  const formSubmit = useFormSubmit(state, formAction);
  return (
    <form {...formSubmit} className="flex flex-col gap-4 rounded-xl border-2 border-primary p-4">
      {r && <input type="hidden" name="id" value={r.id} />}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_160px]">
        <div className="flex flex-col gap-2">
          <Label htmlFor="title">Reward</Label>
          <Input id="title" name="title" required maxLength={80} defaultValue={r?.title} placeholder="10% off" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="points_cost">Points needed</Label>
          <Input id="points_cost" name="points_cost" {...numberInput("digits")} maxLength={5} required defaultValue={r?.points_cost ?? 10} />
        </div>
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
            variant="ghost"
            className="text-destructive hover:text-destructive"
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

  const formSubmit = useFormSubmit(state, formAction, { resetOnSuccess: false });
  return (
    <Card className="flex min-w-0 flex-[1_1_340px] flex-col gap-4 p-5">
      <div className="flex items-center gap-2.5">
        <Cake className="size-5 text-primary" aria-hidden="true" />
        <h2 className="text-lg font-extrabold">Birthday discount</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Free, once per birthday, for customers with a birthday on file. Used {usedThisYear} time{usedThisYear === 1 ? "" : "s"} this
        year.
      </p>
      <form {...formSubmit}>
        <fieldset disabled={!canEdit} className="flex flex-col gap-4">
          <label className="flex min-h-11 items-center gap-3 text-sm font-semibold">
            <input
              type="checkbox"
              name="birthday_discount_enabled"
              defaultChecked={s.birthday_discount_enabled}
              className="size-5 accent-primary"
            />
            Offer a birthday discount
          </label>
          <div className="flex flex-col gap-2">
            <Label htmlFor="birthday_discount_percent">Discount</Label>
            <div className="flex items-center gap-2">
              <Input
                id="birthday_discount_percent"
                name="birthday_discount_percent"
                {...numberInput("digits")}
                maxLength={3}
                required
                defaultValue={s.birthday_discount_percent}
                className="w-28"
              />
              <span className="text-sm font-bold">% off</span>
            </div>
          </div>
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
