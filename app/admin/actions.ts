"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { z } from "zod";
import type { PostgrestError } from "@supabase/supabase-js";
import { getStaff, homeFor, requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { normalizePhone } from "@/lib/phone";
import { isValidBirthday } from "@/lib/birthday";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { parseDollars } from "@/lib/gift-vouchers";
import { discountLabel } from "@/lib/rewards";
import type { Database } from "@/lib/database.types";

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

  // A password an admin set comes first; then admins go back to where they were heading, and
  // staff accounts to the kiosk (or their account page).
  const staff = await getStaff();
  if (!staff) {
    await supabase.auth.signOut();
    return fail("This account doesn't have access to Best Nails.");
  }
  if (staff.mustChangePassword) redirect("/account");
  if (staff.role === "admin") redirect(safeRedirectPath(next, "/admin"));
  redirect(next === "/account" ? "/account" : homeFor(staff.role));
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
    notes: optionalText(2000),
  })
  .refine((c) => (c.birthday_month === null) === (c.birthday_day === null), {
    message: "Enter both the birthday month and day, or neither.",
  })
  .refine((c) => c.birthday_month === null || isValidBirthday(c.birthday_month, c.birthday_day!), {
    message: "That birthday isn't a real date.",
  });

// Non-standard numbers are saved anyway. The form warns about them while the number is typed
// (phoneNeedsCheck in lib/phone-mask.ts), so the saved message doesn't repeat it.
function readCustomer(formData: FormData) {
  return customerSchema.safeParse({
    phone: formData.get("phone") ?? "",
    first_name: formData.get("first_name") ?? "",
    last_name: formData.get("last_name") ?? "",
    birthday_month: formData.get("birthday_month") ?? "",
    birthday_day: formData.get("birthday_day") ?? "",
    notes: formData.get("notes") ?? "",
  });
}

/**
 * Who already has this number, if anyone (not counting `exceptId`, the customer being edited),
 * so the form can say so as soon as the number is typed rather than after filling in the rest.
 */
export async function findCustomerByPhone(phone: string, exceptId?: string): Promise<{ id: string; name: string } | null> {
  await requireAdmin();
  const e164 = normalizePhone(phone)?.e164;
  if (!e164) return null;
  const supabase = await createClient();
  let query = supabase.from("customers").select("id, first_name, last_name").eq("phone", e164);
  if (exceptId) query = query.neq("id", exceptId);
  const { data } = await query.maybeSingle();
  return data ? { id: data.id, name: [data.first_name, data.last_name].filter(Boolean).join(" ") } : null;
}

export async function createCustomer(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = readCustomer(formData);
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const { phone, ...rest } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.from("customers").insert({ ...rest, phone: phone.e164 }).select("id").single();
  if (error) return dbError(error);
  return {
    ok: true,
    message: "Customer added.",
    href: `/admin/customers/${data.id}`,
  };
}

export async function updateCustomer(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = readCustomer(formData);
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const { phone, ...rest } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("customers").update({ ...rest, phone: phone.e164 }).eq("id", id);
  if (error) return dbError(error);
  refresh();
  return {
    ok: true,
    message: "Customer saved.",
  };
}

export async function deleteCustomer(id: string): Promise<ActionState> {
  const staff = await requireAdmin();
  if (staff.role !== "admin") return fail("Only an admin can delete customers.");
  const supabase = await createClient();
  const { error } = await supabase.from("customers").delete().eq("id", id);
  if (error) return dbError(error);
  redirect("/admin/customers");
}

// ---------------------------------------------------------------------------
// Points (check-ins only happen on the kiosk; the admin corrects with Adjust points)
// ---------------------------------------------------------------------------

const adjustSchema = z.object({
  direction: z.enum(["add", "remove"]),
  amount: z.coerce.number().int().min(1, "Enter at least 1 point.").max(100000),
  note: z.string().trim().min(1, "Add a reason so the history makes sense later.").max(200),
});

export async function adjustPoints(customerId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
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
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("redeem_reward", { p_customer_id: customerId, p_promotion_id: promotionId });
  if (error) return dbError(error);
  refresh();
  return { ok: true, message: `Reward redeemed · ${data} pts left` };
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
  await requireAdmin();
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
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("promotions").delete().eq("id", id);
  if (error) return dbError(error);
  refresh();
  return { ok: true, message: "Reward deleted." };
}

const BIRTHDAY_TIERS = [
  ["new", "New"],
  ["regular", "Regular"],
  ["vip", "VIP"],
] as const;

/**
 * One tier's birthday discount from the form: `birthday_kind_<tier>` (percent or amount) and
 * `birthday_value_<tier>`, a percent (0–100) or dollars (up to $1,000) stored as cents. 0 means
 * that tier gets none.
 */
function birthdayTier(
  formData: FormData,
  tier: (typeof BIRTHDAY_TIERS)[number],
): { error: string } | { kind: "percent" | "amount"; value: number } {
  const [key, label] = tier;
  const kind = formData.get(`birthday_kind_${key}`) === "amount" ? "amount" : "percent";
  const raw = String(formData.get(`birthday_value_${key}`) ?? "").trim();
  if (kind === "percent") {
    const value = /^\d{1,3}$/.test(raw) ? Number(raw) : NaN;
    if (!(value >= 0 && value <= 100)) return { error: `Enter a ${label} discount from 0 to 100%.` };
    return { kind, value };
  }
  const cents = parseDollars(raw);
  if (cents === null || cents > 100000) return { error: `Enter a ${label} discount from $0 to $1,000.` };
  return { kind, value: cents };
}

export async function saveBirthdayDiscount(_: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await requireAdmin();
  if (staff.role !== "admin") return fail("Only an admin can change the birthday discount.");
  const enabled = formData.get("birthday_discount_enabled") === "on";
  const windowDays = z.coerce.number().int().min(0).max(31).safeParse(formData.get("birthday_window_days"));
  if (!windowDays.success) return fail("Choose when it can be used.");

  const row: Database["public"]["Tables"]["settings"]["Update"] = {
    birthday_discount_enabled: enabled,
    birthday_window_days: windowDays.data,
  };
  let offered = false;
  for (const tier of BIRTHDAY_TIERS) {
    const t = birthdayTier(formData, tier);
    if ("error" in t) return fail(t.error);
    row[`birthday_kind_${tier[0]}`] = t.kind;
    row[`birthday_value_${tier[0]}`] = t.value;
    offered ||= t.value > 0;
  }
  if (enabled && !offered) return fail("Give at least one tier a discount, or turn the birthday discount off.");

  const supabase = await createClient();
  const { error } = await supabase.from("settings").update(row).eq("id", true);
  if (error) return dbError(error);
  refresh();
  return { ok: true, message: "Birthday discount saved." };
}

export async function redeemBirthday(customerId: string): Promise<ActionState> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("redeem_birthday", { p_customer_id: customerId });
  if (error) return dbError(error);
  const result = data as { status: string; percent?: number; amount_cents?: number };
  refresh();
  if (result.status === "already_used") return fail("The birthday discount was already used for this birthday.");
  if (result.status !== "redeemed") return fail("The birthday discount isn't available today.");
  return { ok: true, message: `Birthday ${discountLabel(result) ?? "discount"} redeemed.` };
}

// ---------------------------------------------------------------------------
// Settings & kiosks
// ---------------------------------------------------------------------------

const settingsSchema = z
  .object({
    kiosk_idle_seconds: z.coerce.number().int().min(10).max(600),
    tier_regular_points: z.coerce.number().int().min(1).max(9999),
    tier_vip_points: z.coerce.number().int().min(2).max(10000),
    code_prefix: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2,4}$/, "The code prefix must be 2 to 4 letters, e.g. BN."),
    timezone: z.string().refine((tz) => {
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, "Unknown timezone."),
  })
  .refine((s) => s.tier_vip_points > s.tier_regular_points, { message: "VIP needs more points than Regular." });

export async function saveSettings(_: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await requireAdmin();
  if (staff.role !== "admin") return fail("Only an admin can change settings.");
  const parsed = settingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { error } = await supabase.from("settings").update(parsed.data).eq("id", true);
  if (error) return dbError(error);
  refresh();
  return { ok: true, message: "Settings saved." };
}
