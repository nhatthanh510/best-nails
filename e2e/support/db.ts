import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

// Seeding and clean-up for the E2E suite, with the service-role key. Everything here touches only
// tagged test data: customers in the fictional range 0491 570 1xx, vouchers whose code starts
// with QA (or that belong to a test customer), rewards named "E2E …" and accounts e2e-…@bestnails.test.

export const ADMIN = { email: "owner@bestnails.test", password: "bestnails-dev" };
export const STAFF = { email: "e2e-staff@bestnails.test", password: "e2e-staff-pass", name: "E2E Staff" };
export const PASSWORD = "e2e-password-1";

export const SETTINGS_DEFAULTS = {
  kiosk_idle_seconds: 60,
  timezone: "Australia/Hobart",
  birthday_discount_enabled: false,
  birthday_kind_new: "percent" as "percent" | "amount",
  birthday_value_new: 10,
  birthday_kind_regular: "percent" as "percent" | "amount",
  birthday_value_regular: 10,
  birthday_kind_vip: "percent" as "percent" | "amount",
  birthday_value_vip: 10,
  birthday_window_days: 7,
  tier_regular_points: 10,
  tier_vip_points: 20,
  code_prefix: "BN",
};
export type SettingsPatch = Partial<typeof SETTINGS_DEFAULTS>;

const TEST_PHONE_PREFIX = "+614915701";

let client: ReturnType<typeof createClient<Database>> | undefined;
export function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("E2E needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (from .env.local).");
  client ??= createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

function check<T>({ data, error }: { data: T; error: { message: string } | null }, what: string): T {
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
}

/** As check(), for reads and inserts that always return rows. */
function must<T>(result: { data: T; error: { message: string } | null }, what: string): NonNullable<T> {
  const data = check(result, what);
  if (data == null) throw new Error(`${what}: no data returned`);
  return data;
}

/** 0491 570 1nn as typed on the kiosk, for n from 0 to 99. */
export function testPhone(n: number) {
  return `04915701${String(n).padStart(2, "0")}`;
}
export function e164(local: string) {
  return `+61${local.slice(1)}`;
}

/** Today's date (YYYY-MM-DD) and month/day in the shop's timezone. */
export function shopToday(timeZone = SETTINGS_DEFAULTS.timezone) {
  const iso = new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
  const [, month, day] = iso.split("-").map(Number);
  return { iso, month, day };
}

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------

export async function resetTestData() {
  const sb = db();
  const customers = must(await sb.from("customers").select("id").like("phone", `${TEST_PHONE_PREFIX}%`), "list test customers");
  const ids = customers.map((c) => c.id);
  check(await sb.from("gift_vouchers").delete().like("code", "QA%"), "delete QA vouchers");
  if (ids.length) {
    check(await sb.from("gift_vouchers").delete().in("customer_id", ids), "delete test customers' vouchers");
    check(await sb.from("customers").delete().in("id", ids), "delete test customers");
  }
  check(await sb.from("promotions").delete().like("title", "E2E%"), "delete test rewards");
  check(await sb.from("technicians").delete().like("name", "E2E%"), "delete test technicians");
  // The shop's own rewards would change what the kiosk shows, so they're paused during the run;
  // the teardown turns back on the ones that were active (see activeShopRewards).
  check(await sb.from("promotions").update({ is_active: false }).eq("is_active", true).not("title", "like", "E2E%"), "pause shop rewards");
  await updateSettings(SETTINGS_DEFAULTS);
  await deleteAccounts(/^e2e-tmp-/);
}

/** Ids of the shop's own active rewards, saved by the setup so the teardown can turn them back on. */
export async function activeShopRewards() {
  const rows = must(await db().from("promotions").select("id").eq("is_active", true).not("title", "like", "E2E%"), "list shop rewards");
  return rows.map((r) => r.id);
}

export async function reactivateRewards(ids: string[]) {
  if (ids.length) check(await db().from("promotions").update({ is_active: true }).in("id", ids), "turn shop rewards back on");
}

export async function getSettings() {
  return must(await db().from("settings").select("*").single(), "read settings");
}

export async function updateSettings(patch: SettingsPatch) {
  check(await db().from("settings").update(patch).eq("id", true), "update settings");
}

// ---------------------------------------------------------------------------
// Customers and points
// ---------------------------------------------------------------------------

type SeedCustomer = {
  phone: string;
  firstName: string;
  lastName?: string;
  birthday?: { month: number; day: number };
  /** Check in today on the kiosk (1 point, 1 visit). */
  checkedIn?: boolean;
  /** Extra points added by hand, after any check-in. */
  points?: number;
};

export async function seedCustomer(c: SeedCustomer) {
  const sb = db();
  let id: string;
  if (c.checkedIn) {
    const result = must(
      await sb.rpc("kiosk_check_in", {
        p_phone: e164(c.phone),
        p_first_name: c.firstName,
        p_last_name: c.lastName,
        p_birthday_month: c.birthday?.month,
        p_birthday_day: c.birthday?.day,
      }),
      "check in",
    ) as { customer_id: string };
    id = result.customer_id;
  } else {
    const row = must(
      await sb
        .from("customers")
        .insert({
          phone: e164(c.phone),
          first_name: c.firstName,
          last_name: c.lastName ?? null,
          birthday_month: c.birthday?.month ?? null,
          birthday_day: c.birthday?.day ?? null,
        })
        .select("id")
        .single(),
      "insert customer",
    );
    id = row.id;
  }
  if (c.points) await addPoints(id, c.points);
  return id;
}

/** The same ledger entry Adjust points writes, so balances and lifetime points stay consistent. */
export async function addPoints(customerId: string, points: number) {
  check(await db().rpc("_post_points", { p_customer_id: customerId, p_delta: points, p_reason: "adjust", p_note: "E2E seed" }), "add points");
}

export async function findCustomer(phone: string) {
  return check(
    await db().from("customers").select("id, first_name, last_name, points_balance, lifetime_points, visit_count").eq("phone", e164(phone)).maybeSingle(),
    "find customer",
  );
}

// ---------------------------------------------------------------------------
// Rewards
// ---------------------------------------------------------------------------

export async function createReward(title: string, pointsCost = 10, isActive = true) {
  if (!title.startsWith("E2E")) throw new Error("Test rewards must be named E2E … so they get cleaned up.");
  return must(await db().from("promotions").insert({ title, points_cost: pointsCost, is_active: isActive, type: "reward" }).select("id").single(), "create reward").id;
}

// ---------------------------------------------------------------------------
// Services & staff (the menu itself comes from the migration)
// ---------------------------------------------------------------------------

export async function createTechnician(name: string) {
  if (!name.startsWith("E2E")) throw new Error("Test technicians must be named E2E … so they get cleaned up.");
  return must(await db().from("technicians").insert({ name }).select("id").single(), "create technician").id;
}

/** The customer's latest check-in: who looked after them and the services, in menu order. */
export async function lastVisit(phone: string) {
  const row = must(
    await db()
      .from("check_ins")
      .select("technician_name, services:check_in_services(position, name, category_name), customer:customers!inner(phone)")
      .eq("customer.phone", e164(phone))
      .order("created_at", { ascending: false })
      .limit(1)
      .single(),
    "last visit",
  );
  return {
    technician: row.technician_name,
    services: [...row.services].sort((a, b) => a.position - b.position).map((s) => `${s.name} (${s.category_name})`),
  };
}

// ---------------------------------------------------------------------------
// Gift vouchers
// ---------------------------------------------------------------------------

export async function seedVoucher(v: { code: string; amountCents: number; customerId?: string; expired?: boolean }) {
  if (!v.code.startsWith("QA")) throw new Error("Test voucher codes must start with QA so they get cleaned up.");
  const sb = db();
  const today = shopToday().iso;
  const plus3 = `${Number(today.slice(0, 4)) + 3}${today.slice(4)}`;
  // An expired voucher has to have been sold more than 3 years ago (the legal minimum).
  const dates = v.expired ? { sold_on: "2022-01-03", expires_on: "2025-01-03" } : { sold_on: today, expires_on: plus3 };
  const id = must(
    await sb
      .from("gift_vouchers")
      .insert({ code: v.code, amount_cents: v.amountCents, balance_cents: 0, customer_id: v.customerId ?? null, ...dates })
      .select("id")
      .single(),
    "insert voucher",
  ).id;
  check(
    await sb.rpc("_post_gift_voucher", { p_gift_voucher_id: id, p_kind: "sale", p_delta_cents: v.amountCents, p_customer_id: v.customerId }),
    "post voucher sale",
  );
  return id;
}

/** A voucher printed ahead of time (Print vouchers) and not sold yet: inactive, no amount or expiry. */
export async function seedInactiveVoucher(code: string) {
  if (!code.startsWith("QA")) throw new Error("Test voucher codes must start with QA so they get cleaned up.");
  return must(await db().from("gift_vouchers").insert({ code, balance_cents: 0 }).select("id, code, public_token").single(), "insert inactive voucher");
}

export async function findVoucher(code: string) {
  return check(await db().from("gift_vouchers").select("id, code, balance_cents, customer_id, public_token").eq("code", code).maybeSingle(), "find voucher");
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

export async function createAccount(a: { email: string; password: string; name: string; role: "admin" | "staff"; tempPassword?: boolean }) {
  if (!a.email.startsWith("e2e-")) throw new Error("Test accounts must use an e2e-… email so they get cleaned up.");
  const sb = db();
  await deleteAccounts(new RegExp(`^${a.email.replace(/[.+]/g, "\\$&")}$`));
  const { data, error } = await sb.auth.admin.createUser({
    email: a.email,
    password: a.password,
    email_confirm: true,
    app_metadata: { temp_password: a.tempPassword ?? false },
  });
  if (error) throw new Error(`create account: ${error.message}`);
  check(await sb.from("staff").insert({ user_id: data.user.id, display_name: a.name, role: a.role }), "insert staff row");
  return data.user.id;
}

export async function deleteAccounts(email: RegExp) {
  const sb = db();
  const { data, error } = await sb.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw new Error(`list accounts: ${error.message}`);
  for (const user of data.users) {
    if (user.email && email.test(user.email)) {
      const { error: deleteError } = await sb.auth.admin.deleteUser(user.id);
      if (deleteError) throw new Error(`delete account ${user.email}: ${deleteError.message}`);
    }
  }
}
