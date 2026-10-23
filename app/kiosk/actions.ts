"use server";

import { z } from "zod";
import { getKioskDevice } from "@/lib/kiosk-device";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatPhone, maskPhone, normalizePhone } from "@/lib/phone";
import { rateLimit } from "@/lib/rate-limit";
import type { BirthdayStatus } from "@/lib/rewards";
import { isValidBirthday } from "@/lib/birthday";

// Everything returned from here reaches a public screen, so it carries only what the
// kiosk shows: first name, masked phone, points, visit count and birthday-discount state.

export type KioskBirthday = {
  /** Can use the birthday discount today. */
  eligible: boolean;
  /** Already used it for this birthday. */
  used: boolean;
};

export type KioskCustomer = {
  firstName: string;
  maskedPhone: string;
  points: number;
  visits: number;
  birthday: KioskBirthday;
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
      signupBonus: number;
      points: number;
      birthday: KioskBirthday;
    }
  | { status: "already_checked_in"; firstName: string; lastCheckInAt: string; points: number; birthday: KioskBirthday }
  | { status: "not_found" }
  | { status: "error"; message: string };

export type RedeemTarget = { kind: "reward"; rewardId: string } | { kind: "birthday" };

export type RedeemResult =
  | { status: "redeemed"; title: string; pointsSpent: number; points: number; redeemedAt: string }
  | { status: "error"; message: string };

const NOT_PAIRED = "This screen isn't set up as a kiosk. Ask the front desk for help.";
const TOO_MANY = "Too many tries. Please wait a minute or ask the front desk.";
const BAD_PHONE = "Please enter at least 8 digits of your phone number.";
const OFFLINE = "We couldn't reach rewards right now.";

async function guard(): Promise<{ deviceId: string } | { error: string }> {
  const device = await getKioskDevice();
  if (!device) return { error: NOT_PAIRED };
  if (!rateLimit(`kiosk:${device.id}`, 30, 60_000)) return { error: TOO_MANY };
  return { deviceId: device.id };
}

async function birthdayFor(customerId: string): Promise<KioskBirthday> {
  const { data } = await createAdminClient().rpc("_birthday_status", { p_customer_id: customerId });
  const status = (data ?? {}) as BirthdayStatus;
  return { eligible: Boolean(status.eligible), used: Boolean(status.in_window && status.used) };
}

export async function lookupPhone(digits: string): Promise<LookupResult> {
  const g = await guard();
  if ("error" in g) return { status: "error", message: g.error };

  const normalized = normalizePhone(digits);
  if (!normalized) return { status: "invalid_phone", message: BAD_PHONE };

  const { data, error } = await createAdminClient()
    .from("customers")
    .select("id, first_name, phone, points_balance, visit_count")
    .eq("phone", normalized.e164)
    .maybeSingle();
  if (error) return { status: "error", message: OFFLINE };
  if (!data) return { status: "not_found", formattedPhone: formatPhone(normalized.e164), nonStandard: !normalized.standard };

  return {
    status: "found",
    customer: {
      firstName: data.first_name,
      maskedPhone: maskPhone(data.phone),
      points: data.points_balance,
      visits: data.visit_count,
      birthday: await birthdayFor(data.id),
    },
  };
}

const signupSchema = z.object({
  firstName: z.string().trim().min(1, "Please enter your first name.").max(50),
  lastName: z.string().trim().max(50).optional(),
  birthdayMonth: z.coerce.number().int().min(1).max(12).optional(),
  birthdayDay: z.coerce.number().int().min(1).max(31).optional(),
  smsOptIn: z.boolean().default(false),
});

export type SignupInput = z.input<typeof signupSchema>;

export async function checkIn(digits: string, signup?: SignupInput): Promise<CheckInResult> {
  const g = await guard();
  if ("error" in g) return { status: "error", message: g.error };

  const phone = normalizePhone(digits)?.e164;
  if (!phone) return { status: "error", message: BAD_PHONE };

  let profile: z.output<typeof signupSchema> | undefined;
  if (signup) {
    const parsed = signupSchema.safeParse(signup);
    if (!parsed.success) return { status: "error", message: parsed.error.issues[0].message };
    profile = parsed.data;
    // Keep the birthday only if both parts are given and form a real date.
    if (
      profile.birthdayMonth == null ||
      profile.birthdayDay == null ||
      !isValidBirthday(profile.birthdayMonth, profile.birthdayDay)
    ) {
      profile.birthdayMonth = undefined;
      profile.birthdayDay = undefined;
    }
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("kiosk_check_in", {
    p_phone: phone,
    p_first_name: profile?.firstName,
    p_last_name: profile?.lastName || undefined,
    p_birthday_month: profile?.birthdayMonth,
    p_birthday_day: profile?.birthdayDay,
    p_sms_opt_in: profile?.smsOptIn ?? false,
  });
  if (error || !data) return { status: "error", message: OFFLINE };

  const result = data as Record<string, unknown>;
  if (result.status === "not_found") return { status: "not_found" };

  const firstName = (result.first_name as string) ?? "";
  const birthday = await birthdayFor(result.customer_id as string);

  if (result.status === "already_checked_in") {
    return {
      status: "already_checked_in",
      firstName,
      lastCheckInAt: result.last_check_in_at as string,
      points: result.points_balance as number,
      birthday,
    };
  }

  return {
    status: "checked_in",
    firstName,
    pointsAwarded: result.points_awarded as number,
    signupBonus: result.signup_bonus as number,
    points: result.points_balance as number,
    birthday,
  };
}

const REDEEM_ERRORS: Record<string, string> = {
  not_found: "We couldn't find your rewards account.",
  reward_unavailable: "That reward isn't available any more. Please ask the front desk.",
  check_in_required: "Please check in first, then you can redeem.",
  insufficient_points: "You don't have enough points for that reward yet.",
  already_used: "Your birthday discount has already been used this year.",
  not_eligible: "Your birthday discount isn't available today.",
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
      title: `Birthday ${result.percent}% off`,
      pointsSpent: 0,
      points: result.points_balance as number,
      redeemedAt: result.redeemed_at as string,
    };
  }
  return {
    status: "redeemed",
    title: result.reward_title as string,
    pointsSpent: result.points_spent as number,
    points: result.points_balance as number,
    redeemedAt: result.redeemed_at as string,
  };
}
