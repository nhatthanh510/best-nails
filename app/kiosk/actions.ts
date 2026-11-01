"use server";

import { z } from "zod";
import { getStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatPhone, maskPhone, normalizePhone } from "@/lib/phone";
import { discountLabel, type BirthdayStatus } from "@/lib/rewards";
import type { Database } from "@/lib/database.types";
import { isValidBirthday } from "@/lib/birthday";

// Everything returned from here reaches a public screen, so it carries only what the
// kiosk shows: first name, masked phone, points, visit count, cash visits towards the reward and
// birthday-discount state.

export type KioskBirthday = {
  /** Can use the birthday discount today. */
  eligible: boolean;
  /** Already used it for this birthday. */
  used: boolean;
  /** The customer's discount, e.g. "10% off" or "$20 off" (it depends on their tier), or null when there's none for them. */
  label: string | null;
};

export type KioskCustomer = {
  firstName: string;
  maskedPhone: string;
  points: number;
  visits: number;
  /** Visits paid in cash since their last points reward: a reward with a cash bonus pays more at its points in cash visits. */
  cashVisits: number;
  birthday: KioskBirthday;
  /** When they checked in today (shop timezone), or null: someone coming back to redeem. */
  checkedInAt: string | null;
  /** They've had today's discount; one per visit. */
  discountUsedToday: boolean;
};

export type LookupResult =
  | { status: "found"; customer: KioskCustomer }
  | { status: "not_found"; formattedPhone: string; nonStandard: boolean }
  | { status: "invalid_phone"; message: string }
  | { status: "error"; message: string };

export type CheckInResult =
  | {
      status: "checked_in";
      firstName: string;
      pointsAwarded: number;
      points: number;
      cashVisits: number;
      birthday: KioskBirthday;
      discountUsedToday: boolean;
    }
  | {
      status: "already_checked_in";
      firstName: string;
      lastCheckInAt: string;
      points: number;
      cashVisits: number;
      birthday: KioskBirthday;
      discountUsedToday: boolean;
    }
  | { status: "not_found" }
  | { status: "error"; message: string };

export type RedeemTarget = { kind: "reward"; rewardId: string } | { kind: "birthday" };

export type RedeemResult =
  | {
      status: "redeemed";
      title: string;
      /** Why it's worth what it is, e.g. "For paying cash on 7 visits". */
      note?: string;
      pointsSpent: number;
      points: number;
      redeemedAt: string;
    }
  | { status: "error"; message: string };

const SIGNED_OUT = "This screen has been signed out. Ask the front desk for help.";
const BAD_PHONE = "Please enter at least 8 digits of your phone number.";
const OFFLINE = "We couldn't reach rewards right now.";

/**
 * Kiosk actions are public endpoints, so each one first checks that an account (admin or
 * staff) is signed in on this device; only then does it use the service-role client.
 */
async function guard(): Promise<{ staffId: string } | { error: string }> {
  const staff = await getStaff();
  if (!staff) return { error: SIGNED_OUT };
  return { staffId: staff.id };
}

type TodayStatus = { checked_in_at?: string | null; discount_used_today?: boolean };

function kioskBirthday(status: BirthdayStatus | null): KioskBirthday {
  return {
    eligible: Boolean(status?.eligible),
    used: Boolean(status?.in_window && status.used),
    label: status ? discountLabel(status) : null,
  };
}

/** Whether they've checked in today and had today's discount (one per visit). */
function kioskToday(r: TodayStatus | null): { checkedInAt: string | null; discountUsedToday: boolean } {
  return { checkedInAt: r?.checked_in_at ?? null, discountUsedToday: Boolean(r?.discount_used_today) };
}

async function birthdayFor(customerId: string): Promise<KioskBirthday> {
  const { data } = await createAdminClient().rpc("_birthday_status", { p_customer_id: customerId });
  return kioskBirthday(data as BirthdayStatus | null);
}

async function todayFor(customerId: string): Promise<{ checkedInAt: string | null; discountUsedToday: boolean }> {
  const { data } = await createAdminClient().rpc("kiosk_today", { p_customer_id: customerId });
  return kioskToday(data as TodayStatus | null);
}

export async function lookupPhone(digits: string): Promise<LookupResult> {
  const g = await guard();
  if ("error" in g) return { status: "error", message: g.error };

  const normalized = normalizePhone(digits);
  if (!normalized) return { status: "invalid_phone", message: BAD_PHONE };

  // One round trip: the customer with their birthday status and today's check-in and discount.
  const { data, error } = await createAdminClient().rpc("kiosk_lookup", { p_phone: normalized.e164 });
  if (error) return { status: "error", message: OFFLINE };
  if (!data) return { status: "not_found", formattedPhone: formatPhone(normalized.e164), nonStandard: !normalized.standard };

  const c = data as {
    first_name: string;
    phone: string;
    points_balance: number;
    visit_count: number;
    cash_visits: number;
    birthday: BirthdayStatus | null;
    today: TodayStatus | null;
  };
  return {
    status: "found",
    customer: {
      firstName: c.first_name,
      maskedPhone: maskPhone(c.phone),
      points: c.points_balance,
      visits: c.visit_count,
      cashVisits: c.cash_visits ?? 0,
      birthday: kioskBirthday(c.birthday),
      ...kioskToday(c.today),
    },
  };
}

// The kiosk asks for one name ("What should we call you?"), as check-in kiosks do. The first
// word is stored as the first name (the only part the kiosk ever shows) and the rest as the last
// name, so the admin keeps both fields for staff to tidy up.
const signupSchema = z.object({
  name: z
    .string()
    .transform((v) => v.trim().split(/\s+/).filter(Boolean))
    .refine((words) => words.length > 0, { message: "Please enter your name.", abort: true })
    .refine((words) => words[0].length <= 50 && words.slice(1).join(" ").length <= 50, "Please use a shorter name.")
    .transform(([first, ...rest]) => ({ firstName: first, lastName: rest.join(" ") || undefined })),
  birthdayMonth: z.coerce.number().int().min(1).max(12).optional(),
  birthdayDay: z.coerce.number().int().min(1).max(31).optional(),
});

export type SignupInput = z.input<typeof signupSchema>;

export type PaymentMethod = Database["public"]["Enums"]["payment_method"];

/**
 * What the customer picked on the services (at least one, when the shop has any on), staff (can be
 * skipped) and payment (when a reward pays more for cash) steps.
 */
export type VisitPicks = { serviceIds: string[]; technicianId: string | null; paymentMethod?: PaymentMethod | null };

const picksSchema = z.object({
  serviceIds: z.array(z.string().uuid()).max(50),
  technicianId: z.string().uuid().nullable(),
  paymentMethod: z.enum(["cash", "card"]).nullish(),
});

export async function checkIn(digits: string, signup?: SignupInput, picks?: VisitPicks): Promise<CheckInResult> {
  const g = await guard();
  if ("error" in g) return { status: "error", message: g.error };

  const phone = normalizePhone(digits)?.e164;
  if (!phone) return { status: "error", message: BAD_PHONE };

  let profile: z.output<typeof signupSchema> | undefined;
  if (signup) {
    const parsed = signupSchema.safeParse(signup);
    if (!parsed.success) return { status: "error", message: parsed.error.issues[0].message };
    profile = parsed.data;
    // A birthday is both parts and a real date, or none at all. Never drop it quietly: the
    // customer would think they'd get the birthday discount.
    const { birthdayMonth: m, birthdayDay: d } = profile;
    if ((m == null) !== (d == null)) {
      return { status: "error", message: "Please pick both the day and the month of your birthday, or leave both blank." };
    }
    if (m != null && d != null && !isValidBirthday(m, d)) {
      return { status: "error", message: "That birthday isn't a real date. Please check it." };
    }
  }

  const parsedPicks = picks ? picksSchema.safeParse(picks) : null;
  if (parsedPicks && !parsedPicks.success) return { status: "error", message: "Please ask the front desk." };

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("kiosk_check_in", {
    p_phone: phone,
    p_first_name: profile?.name.firstName,
    p_last_name: profile?.name.lastName,
    p_birthday_month: profile?.birthdayMonth,
    p_birthday_day: profile?.birthdayDay,
    p_service_ids: parsedPicks?.data.serviceIds.length ? parsedPicks.data.serviceIds : undefined,
    p_technician_id: parsedPicks?.data.technicianId ?? undefined,
    p_payment_method: parsedPicks?.data.paymentMethod ?? undefined,
  });
  if (error || !data) return { status: "error", message: OFFLINE };

  const result = data as Record<string, unknown>;
  if (result.status === "not_found") return { status: "not_found" };

  const firstName = (result.first_name as string) ?? "";
  const [birthday, { discountUsedToday }] = await Promise.all([
    birthdayFor(result.customer_id as string),
    todayFor(result.customer_id as string),
  ]);

  if (result.status === "already_checked_in") {
    return {
      status: "already_checked_in",
      firstName,
      lastCheckInAt: result.last_check_in_at as string,
      points: result.points_balance as number,
      cashVisits: (result.cash_visits as number) ?? 0,
      birthday,
      discountUsedToday,
    };
  }

  return {
    status: "checked_in",
    firstName,
    pointsAwarded: result.points_awarded as number,
    points: result.points_balance as number,
    cashVisits: (result.cash_visits as number) ?? 0,
    birthday,
    discountUsedToday,
  };
}

const REDEEM_ERRORS: Record<string, string> = {
  not_found: "We couldn't find your rewards account.",
  reward_unavailable: "That reward isn't available any more. Please ask the front desk.",
  check_in_required: "Please check in first, then you can redeem.",
  insufficient_points: "You don't have enough points for that reward yet.",
  already_used: "Your birthday discount has already been used this year.",
  not_eligible: "Your birthday discount isn't available today.",
  discount_used_today: "You've already had a discount today. It's one per visit, so save your points for next time.",
};

const targetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("reward"), rewardId: z.string().uuid() }),
  z.object({ kind: z.literal("birthday") }),
]);

/** Spends points on a reward, or uses the birthday discount. Only within 12 hours of a check-in. */
export async function redeemAtKiosk(digits: string, target: RedeemTarget): Promise<RedeemResult> {
  const g = await guard();
  if ("error" in g) return { status: "error", message: g.error };

  const phone = normalizePhone(digits)?.e164;
  const parsedTarget = targetSchema.safeParse(target);
  if (!phone || !parsedTarget.success) return { status: "error", message: "Please ask the front desk." };

  const supabase = createAdminClient();
  const { data, error } =
    parsedTarget.data.kind === "reward"
      ? await supabase.rpc("kiosk_redeem", { p_phone: phone, p_promotion_id: parsedTarget.data.rewardId })
      : await supabase.rpc("kiosk_redeem_birthday", { p_phone: phone });
  if (error || !data) return { status: "error", message: OFFLINE };

  const result = data as Record<string, unknown>;
  if (result.status !== "redeemed") {
    return { status: "error", message: REDEEM_ERRORS[result.status as string] ?? "Please ask the front desk." };
  }

  if (parsedTarget.data.kind === "birthday") {
    return {
      status: "redeemed",
      title: `Birthday ${discountLabel(result as { percent?: number; amount_cents?: number }) ?? "discount"}`,
      pointsSpent: 0,
      points: result.points_balance as number,
      redeemedAt: result.redeemed_at as string,
    };
  }
  // A reward with amounts is named by what it gave ("$30 off"), with why when it's the cash amount.
  const cents = result.discount_cents as number | null;
  const spent = result.points_spent as number;
  return {
    status: "redeemed",
    title: cents ? (discountLabel({ amount_cents: cents }) ?? (result.reward_title as string)) : (result.reward_title as string),
    note: result.cash_qualified ? `For paying cash on ${spent} visit${spent === 1 ? "" : "s"}` : undefined,
    pointsSpent: spent,
    points: result.points_balance as number,
    redeemedAt: result.redeemed_at as string,
  };
}
