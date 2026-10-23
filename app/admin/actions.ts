"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { z } from "zod";
import type { PostgrestError } from "@supabase/supabase-js";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { normalizePhone } from "@/lib/phone";
import { isValidBirthday } from "@/lib/birthday";
import { safeRedirectPath } from "@/lib/safe-redirect";

/** `href` asks the client to navigate after showing the message (used instead of redirect() so a warning can be shown). */
export type ActionState = { ok: boolean; message?: string; href?: string } | null;

function fail(message: string): ActionState {
  return { ok: false, message };
}

/** Turns a Postgres/PostgREST error into something a front-desk user can act on. */
function dbError(error: PostgrestError): ActionState {
  if (error.code === "42501") return fail("You don't have permission to do that.");
  if (error.code === "23505") return fail("A customer with this phone number already exists.");
  if (error.code === "22023" || error.code === "P0002") return fail(capitalize(error.message) + ".");
  console.error(error);
  return fail("Something went wrong. Please try again.");
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null);

const optionalInt = (min: number, max: number) =>
  z
    .union([z.literal(""), z.coerce.number().int().min(min).max(max)])
    .transform((v) => (v === "" ? null : v));

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export async function signIn(_: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "");
  if (!email || !password) return fail("Enter your email and password.");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return fail("That email and password don't match.");

  redirect(safeRedirectPath(next, "/admin"));
}

export async function signOut() {
  await (await createClient()).auth.signOut();
  redirect("/admin/login");
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

const customerSchema = z
  .object({
    phone: z.string().transform((v, ctx) => {
      const phone = normalizePhone(v);
      if (!phone) {
        ctx.addIssue({ code: "custom", message: "Enter a phone number with 8 to 12 digits." });
        return z.NEVER;
      }
      return phone;
    }),
    first_name: z.string().trim().min(1, "First name is required.").max(50),
    last_name: optionalText(50),
    birthday_month: optionalInt(1, 12),
    birthday_day: optionalInt(1, 31),
    sms_opt_in: z.boolean(),
    notes: optionalText(2000),
  })
  .refine((c) => (c.birthday_month === null) === (c.birthday_day === null), {
    message: "Enter both the birthday month and day, or neither.",
  })
  .refine((c) => c.birthday_month === null || isValidBirthday(c.birthday_month, c.birthday_day!), {
    message: "That birthday isn't a real date.",
  });

const NON_STANDARD_WARNING = "The phone number isn't a standard Australian format, so double-check it.";

// Non-standard numbers are saved anyway; callers add NON_STANDARD_WARNING to their message.
function readCustomer(formData: FormData) {
  return customerSchema.safeParse({
    phone: formData.get("phone") ?? "",
    first_name: formData.get("first_name") ?? "",
    last_name: formData.get("last_name") ?? "",
    birthday_month: formData.get("birthday_month") ?? "",
    birthday_day: formData.get("birthday_day") ?? "",
    sms_opt_in: formData.get("sms_opt_in") === "on",
    notes: formData.get("notes") ?? "",
  });
}

export async function createCustomer(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff();
  const parsed = readCustomer(formData);
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const { phone, ...rest } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.from("customers").insert({ ...rest, phone: phone.e164 }).select("id").single();
  if (error) return dbError(error);
  return {
    ok: true,
    message: phone.standard ? "Customer added." : `Customer added. ${NON_STANDARD_WARNING}`,
    href: `/admin/customers/${data.id}`,
  };
}

export async function updateCustomer(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff();
  const parsed = readCustomer(formData);
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const { phone, ...rest } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("customers").update({ ...rest, phone: phone.e164 }).eq("id", id);
  if (error) return dbError(error);
  refresh();
  return {
    ok: true,
    message: phone.standard ? "Customer saved." : `Customer saved. ${NON_STANDARD_WARNING}`,
  };
}

export async function deleteCustomer(id: string): Promise<ActionState> {
  const staff = await requireStaff();
  if (staff.role !== "owner") return fail("Only the owner can delete customers.");
  const supabase = await createClient();
  const { error } = await supabase.from("customers").delete().eq("id", id);
  if (error) return dbError(error);
  redirect("/admin/customers");
}

// ---------------------------------------------------------------------------
// Points
// ---------------------------------------------------------------------------

export async function checkInCustomer(customerId: string): Promise<ActionState> {
  await requireStaff();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_check_in", { p_customer_id: customerId });
  if (error) return dbError(error);

  const result = data as { status: string; points_awarded?: number; signup_bonus?: number };
  refresh();
  if (result.status === "already_checked_in") return fail("Already checked in. Visits are limited by the cooldown in Settings.");
  const earned = (result.points_awarded ?? 0) + (result.signup_bonus ?? 0);
  return { ok: true, message: `Checked in · +${earned} pts` };
}

const adjustSchema = z.object({
  direction: z.enum(["add", "remove"]),
  amount: z.coerce.number().int().min(1, "Enter at least 1 point.").max(100000),
  note: z.string().trim().min(1, "Add a reason so the history makes sense later.").max(200),
});

export async function adjustPoints(customerId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff();
  const parsed = adjustSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { direction, amount, note } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("adjust_points", {
    p_customer_id: customerId,
    p_delta: direction === "add" ? amount : -amount,
    p_note: note,
  });
  if (error) return dbError(error);
  refresh();
  return { ok: true, message: `Saved · new balance ${data} pts` };
}

export async function redeemReward(customerId: string, promotionId: string): Promise<ActionState> {
  await requireStaff();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("redeem_reward", { p_customer_id: customerId, p_promotion_id: promotionId });
  if (error) return dbError(error);
  refresh();
  return { ok: true, message: `Reward redeemed · ${data} pts left` };
}

export async function voidCheckIn(checkInId: string): Promise<ActionState> {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.rpc("void_check_in", { p_check_in_id: checkInId });
  if (error) return dbError(error);
  refresh();
  return { ok: true, message: "Check-in undone and its points removed." };
}

// ---------------------------------------------------------------------------
// Rewards & birthday discount
// ---------------------------------------------------------------------------

const rewardSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1, "Give the reward a name, e.g. 10% off.").max(80),
  points_cost: z.coerce.number().int().min(1, "It needs to cost at least 1 point.").max(10000),
  is_active: z.boolean(),
});

export async function saveReward(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff();
  const parsed = rewardSchema.safeParse({
    id: formData.get("id") || undefined,
    title: formData.get("title") ?? "",
    points_cost: formData.get("points_cost"),
    is_active: formData.get("is_active") === "on",
  });
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { id, ...row } = parsed.data;

  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("promotions").update(row).eq("id", id)
    : await supabase.from("promotions").insert({ ...row, type: "reward" });
  if (error) return dbError(error);
  refresh();
  return { ok: true, message: id ? "Reward saved." : "Reward created." };
}

export async function deleteReward(id: string): Promise<ActionState> {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("promotions").delete().eq("id", id);
  if (error) return dbError(error);
  refresh();
  return { ok: true, message: "Reward deleted." };
}

const birthdaySchema = z.object({
  birthday_discount_enabled: z.boolean(),
  birthday_discount_percent: z.coerce.number().int().min(1, "Enter a discount of at least 1%.").max(100),
  birthday_window_days: z.coerce.number().int().min(0).max(31),
});

export async function saveBirthdayDiscount(_: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await requireStaff();
  if (staff.role !== "owner") return fail("Only the owner can change the birthday discount.");
  const parsed = birthdaySchema.safeParse({
    birthday_discount_enabled: formData.get("birthday_discount_enabled") === "on",
    birthday_discount_percent: formData.get("birthday_discount_percent"),
    birthday_window_days: formData.get("birthday_window_days"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { error } = await supabase.from("settings").update(parsed.data).eq("id", true);
  if (error) return dbError(error);
  refresh();
  return { ok: true, message: "Birthday discount saved." };
}

export async function redeemBirthday(customerId: string): Promise<ActionState> {
  await requireStaff();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("redeem_birthday", { p_customer_id: customerId });
  if (error) return dbError(error);
  const result = data as { status: string; percent?: number };
  refresh();
  if (result.status === "already_used") return fail("The birthday discount was already used for this birthday.");
  if (result.status !== "redeemed") return fail("The birthday discount isn't available today.");
  return { ok: true, message: `Birthday ${result.percent}% off redeemed.` };
}

// ---------------------------------------------------------------------------
// Settings & kiosks
// ---------------------------------------------------------------------------

const settingsSchema = z
  .object({
    points_per_visit: z.coerce.number().int().min(1).max(10000),
    checkin_cooldown_hours: z.coerce.number().int().min(0).max(168),
    kiosk_idle_seconds: z.coerce.number().int().min(10).max(600),
    tier_regular_visits: z.coerce.number().int().min(1).max(9999),
    tier_vip_visits: z.coerce.number().int().min(2).max(10000),
    timezone: z.string().refine((tz) => {
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, "Unknown timezone."),
  })
  .refine((s) => s.tier_vip_visits > s.tier_regular_visits, { message: "VIP needs more visits than Regular." });

export async function saveSettings(_: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await requireStaff();
  if (staff.role !== "owner") return fail("Only the owner can change settings.");
  const parsed = settingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { error } = await supabase.from("settings").update(parsed.data).eq("id", true);
  if (error) return dbError(error);
  refresh();
  return { ok: true, message: "Settings saved. They apply to the next check-in." };
}

export async function revokeKiosk(id: string): Promise<ActionState> {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("kiosk_devices").update({ revoked_at: new Date().toISOString() }).eq("id", id);
  if (error) return dbError(error);
  refresh();
  return { ok: true, message: "Kiosk unpaired. It will show the setup screen." };
}
