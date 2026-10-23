import "server-only";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";
import type { BirthdayStatus, Reward } from "@/lib/rewards";
import { isBirthdayOn } from "@/lib/birthday";
import { tierRange, type Tier, type TierThresholds } from "@/lib/tiers";

// Every read starts with requireStaff(): RLS would return nothing to a non-staff user anyway,
// but this sends them to the login page instead of showing an empty admin.

type Tables = Database["public"]["Tables"];
export type Customer = Tables["customers"]["Row"];
export type Settings = Tables["settings"]["Row"];
export type CheckInRow = Tables["check_ins"]["Row"] & {
  customer: Pick<Customer, "id" | "first_name" | "last_name" | "phone" | "visit_count"> | null;
};
export type LedgerRow = Tables["point_transactions"]["Row"];
export type BirthdayRedemption = Tables["birthday_redemptions"]["Row"];

const DAY_MS = 24 * 60 * 60 * 1000;

async function staffClient() {
  const staff = await requireStaff();
  return { staff, supabase: await createClient() };
}

/** Calendar date of `at` in the shop's timezone. */
function shopDate(timezone: string, at = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "numeric", day: "numeric" }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  const year = get("year");
  const month = get("month");
  const day = get("day");
  const dayOfYear = Math.round((Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 1)) / DAY_MS) + 1;
  return { year, month, day, dayOfYear };
}

async function shopTimezone(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase.from("settings").select("timezone").single();
  return data?.timezone ?? "UTC";
}

async function dayStart(supabase: Awaited<ReturnType<typeof createClient>>, daysAgo = 0) {
  const { data, error } = await supabase.rpc("shop_day_start", { p_days_ago: daysAgo });
  if (error) throw error;
  return data as string;
}

/** user id → display name, for "by" columns. */
export async function staffNames(): Promise<Map<string, string>> {
  const { supabase } = await staffClient();
  const { data } = await supabase.from("staff").select("user_id, display_name, role");
  return new Map((data ?? []).map((s) => [s.user_id, `${s.display_name}${s.role === "owner" ? " (owner)" : ""}`]));
}

export async function getSettings(): Promise<Settings> {
  const { supabase } = await staffClient();
  const { data, error } = await supabase.from("settings").select("*").single();
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export async function getDashboard() {
  const { supabase } = await staffClient();
  const { day: dayOfMonth } = shopDate(await shopTimezone(supabase));
  const [today, weekAgo, monthStart] = await Promise.all([dayStart(supabase), dayStart(supabase, 6), dayStart(supabase, dayOfMonth - 1)]);
  const thirtyDaysAgo = new Date(Date.now() - 30 * DAY_MS).toISOString();

  const [checkIns, newCustomers, total, active, redeemed, birthdays] = await Promise.all([
    supabase
      .from("check_ins")
      .select("*, customer:customers(id, first_name, last_name, phone, visit_count)")
      .gte("created_at", today)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("customers").select("id", { count: "exact", head: true }).gte("created_at", weekAgo),
    supabase.from("customers").select("id", { count: "exact", head: true }),
    supabase.from("customers").select("id", { count: "exact", head: true }).gte("last_visit_at", thirtyDaysAgo),
    supabase.from("point_transactions").select("id", { count: "exact", head: true }).eq("reason", "redeem").gte("created_at", monthStart),
    supabase.from("birthday_redemptions").select("id", { count: "exact", head: true }).gte("created_at", monthStart),
  ]);

  const rows = (checkIns.data ?? []) as CheckInRow[];
  return {
    checkIns: rows,
    checkInsToday: rows.filter((r) => !r.voided_at).length,
    newCustomersThisWeek: newCustomers.count ?? 0,
    totalCustomers: total.count ?? 0,
    activeLast30Days: active.count ?? 0,
    redeemedThisMonth: redeemed.count ?? 0,
    birthdayDiscountsThisMonth: birthdays.count ?? 0,
  };
}

/** How many customers are in each tier. */
export async function getTierCounts(tiers: TierThresholds): Promise<Record<Tier, number>> {
  const { supabase } = await staffClient();
  const count = async (tier: Tier) => {
    const { min, max } = tierRange(tier, tiers);
    let q = supabase.from("customers").select("id", { count: "exact", head: true }).gte("visit_count", min);
    if (max !== null) q = q.lt("visit_count", max);
    return (await q).count ?? 0;
  };
  const [vip, regular, fresh] = await Promise.all([count("vip"), count("regular"), count("new")]);
  return { vip, regular, new: fresh };
}

/** Customers whose birthday falls in the next 7 days (shop calendar). */
export async function getUpcomingBirthdays(timezone: string) {
  const { supabase } = await staffClient();
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(Date.now() + i * DAY_MS);
    return { ...shopDate(timezone, date), date };
  });
  const months = [...new Set(days.map((d) => d.month))];
  const { data } = await supabase
    .from("customers")
    .select("id, first_name, last_name, birthday_month, birthday_day")
    .in("birthday_month", months);

  return days.flatMap(({ year, month, day, date }) =>
    (data ?? [])
      .filter((c) => c.birthday_month && c.birthday_day && isBirthdayOn(c.birthday_month, c.birthday_day, year, month, day))
      .map((c) => ({ ...c, date })),
  );
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

export const CUSTOMER_FILTERS = ["all", "vip", "regular", "recent", "birthday", "lapsed"] as const;
export type CustomerFilter = (typeof CUSTOMER_FILTERS)[number];
export const PAGE_SIZE = 25;

export async function listCustomers({
  q,
  filter,
  page,
  tiers,
}: {
  q: string;
  filter: CustomerFilter;
  page: number;
  tiers: TierThresholds;
}) {
  const { supabase } = await staffClient();
  let query = supabase.from("customers").select("*", { count: "exact" });

  // PostgREST's or() syntax treats these as separators, so drop them from user input.
  const term = q.replace(/[,()*%\\]/g, " ").trim();
  if (term) {
    const digits = term.replace(/\D/g, "");
    if (digits.length >= 3 && digits.length === term.replace(/[\s\-+.()]/g, "").length) {
      // Stored as +61412…, so a typed local "0412…" matches on "61412…".
      query = query.like("phone", `%${digits.startsWith("0") ? `61${digits.slice(1)}` : digits}%`);
    } else {
      query = query.or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%`);
    }
  }

  const now = Date.now();
  if (filter === "recent") query = query.gte("last_visit_at", new Date(now - 30 * DAY_MS).toISOString());
  if (filter === "lapsed") query = query.or(`last_visit_at.lt.${new Date(now - 90 * DAY_MS).toISOString()},last_visit_at.is.null`);
  if (filter === "birthday") query = query.eq("birthday_month", shopDate(await shopTimezone(supabase)).month);
  if (filter === "vip" || filter === "regular") {
    const { min, max } = tierRange(filter, tiers);
    query = query.gte("visit_count", min);
    if (max !== null) query = query.lt("visit_count", max);
  }

  const from = (page - 1) * PAGE_SIZE;
  const { data, count, error } = await query
    .order("last_visit_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  if (error) throw error;
  return { customers: data, total: count ?? 0 };
}

export async function getCustomer(id: string) {
  const { supabase } = await staffClient();
  const [customer, ledger, rewards, birthday, birthdayHistory] = await Promise.all([
    supabase.from("customers").select("*").eq("id", id).maybeSingle(),
    supabase.from("point_transactions").select("*").eq("customer_id", id).order("seq", { ascending: false }).limit(100),
    supabase.from("promotions").select("*").eq("is_active", true).order("points_cost"),
    supabase.rpc("birthday_status", { p_customer_id: id }),
    supabase.from("birthday_redemptions").select("*").eq("customer_id", id).order("created_at", { ascending: false }),
  ]);
  if (!customer.data) return null;
  return {
    customer: customer.data,
    ledger: ledger.data ?? [],
    rewards: (rewards.data ?? []) as Reward[],
    birthday: (birthday.data ?? { enabled: false, has_birthday: false, eligible: false }) as BirthdayStatus,
    birthdayHistory: birthdayHistory.data ?? [],
  };
}

// ---------------------------------------------------------------------------
// Check-ins
// ---------------------------------------------------------------------------

export const CHECK_IN_RANGES = { today: 0, "7d": 6, "30d": 29 } as const;
export type CheckInRange = keyof typeof CHECK_IN_RANGES;

export async function listCheckIns({ range, source }: { range: CheckInRange; source: "all" | "kiosk" | "admin" }) {
  const { supabase } = await staffClient();
  const since = await dayStart(supabase, CHECK_IN_RANGES[range]);
  let query = supabase
    .from("check_ins")
    .select("*, customer:customers(id, first_name, last_name, phone, visit_count)")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(500);
  if (source !== "all") query = query.eq("source", source);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as CheckInRow[];
}

// ---------------------------------------------------------------------------
// Rewards, kiosks, staff
// ---------------------------------------------------------------------------

export async function listRewards(): Promise<Reward[]> {
  const { supabase } = await staffClient();
  const { data, error } = await supabase.from("promotions").select("*").order("points_cost").order("title");
  if (error) throw error;
  return data;
}

/** Times each reward has been redeemed, and birthday discounts used since 1 January (shop time). */
export async function rewardUsage(rewardIds: string[]) {
  const { supabase } = await staffClient();
  const yearStart = await dayStart(supabase, shopDate(await shopTimezone(supabase)).dayOfYear - 1);
  // Counted in the database: a shop has a handful of rewards, but each can have thousands of redemptions.
  const [birthdays, ...perReward] = await Promise.all([
    supabase.from("birthday_redemptions").select("id", { count: "exact", head: true }).gte("created_at", yearStart),
    ...rewardIds.map((id) =>
      supabase.from("point_transactions").select("id", { count: "exact", head: true }).eq("reason", "redeem").eq("promotion_id", id),
    ),
  ]);
  const counts = new Map(rewardIds.map((id, i) => [id, perReward[i].count ?? 0]));
  return { counts, birthdaysThisYear: birthdays.count ?? 0 };
}

export async function listKiosks() {
  const { supabase } = await staffClient();
  const { data } = await supabase.from("kiosk_devices").select("*").is("revoked_at", null).order("created_at");
  return data ?? [];
}

export async function listStaff() {
  const { supabase } = await staffClient();
  const { data } = await supabase.from("staff").select("*").order("role").order("display_name");
  return data ?? [];
}
