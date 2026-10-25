import "server-only";
import { cache } from "react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/database.types";
import type { BirthdayStatus, Reward } from "@/lib/rewards";
import { isBirthdayOn } from "@/lib/birthday";
import { tierRange, type Tier, type TierThresholds } from "@/lib/tiers";
import { giftVoucherStatus, type GiftVoucherStatus } from "@/lib/gift-vouchers";

// Every read starts with requireAdmin(): RLS would return nothing to a non-staff user anyway,
// but this sends them to the login page instead of showing an empty admin.

type Tables = Database["public"]["Tables"];
export type Customer = Tables["customers"]["Row"];
export type Settings = Tables["settings"]["Row"];
export type CheckInRow = Tables["check_ins"]["Row"] & {
  customer: Pick<Customer, "id" | "first_name" | "last_name" | "phone" | "lifetime_points"> | null;
};
/** Something a customer used on the day of a check-in: a discount or part of a gift voucher. */
export type VisitUse = { kind: "points"; label: string } | { kind: "birthday"; percent: number } | { kind: "gift"; cents: number };
export type LedgerRow = Tables["point_transactions"]["Row"];
export type BirthdayRedemption = Tables["birthday_redemptions"]["Row"];

const DAY_MS = 24 * 60 * 60 * 1000;

async function staffClient() {
  const staff = await requireAdmin();
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

/** YYYY-MM-DD, for comparing with date columns. */
function isoDate({ year, month, day }: { year: number; month: number; day: number }) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

async function shopTimezone() {
  return (await getSettings()).timezone;
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
  return new Map((data ?? []).map((s) => [s.user_id, s.display_name]));
}

/** Cached for the request: pages and the loaders that need the shop's timezone all read it. */
export const getSettings = cache(async (): Promise<Settings> => {
  const { supabase } = await staffClient();
  const { data, error } = await supabase.from("settings").select("*").single();
  if (error) throw error;
  return data;
});

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

const DASHBOARD_CHECK_INS = 10;

export async function getDashboard() {
  const { supabase } = await staffClient();
  const { day: dayOfMonth } = shopDate(await shopTimezone());
  const [today, weekAgo, monthStart] = await Promise.all([dayStart(supabase), dayStart(supabase, 6), dayStart(supabase, dayOfMonth - 1)]);
  const thirtyDaysAgo = new Date(Date.now() - 30 * DAY_MS).toISOString();

  const [checkIns, todayCount, newCustomers, total, active, redeemed, birthdays] = await Promise.all([
    supabase
      .from("check_ins")
      .select("*, customer:customers(id, first_name, last_name, phone, lifetime_points)")
      .gte("created_at", today)
      .is("voided_at", null)
      .order("created_at", { ascending: false })
      .limit(DASHBOARD_CHECK_INS),
    supabase.from("check_ins").select("id", { count: "exact", head: true }).gte("created_at", today).is("voided_at", null),
    supabase.from("customers").select("id", { count: "exact", head: true }).gte("created_at", weekAgo),
    supabase.from("customers").select("id", { count: "exact", head: true }),
    supabase.from("customers").select("id", { count: "exact", head: true }).gte("last_visit_at", thirtyDaysAgo),
    supabase.from("point_transactions").select("id", { count: "exact", head: true }).eq("reason", "redeem").gte("created_at", monthStart),
    supabase.from("birthday_redemptions").select("id", { count: "exact", head: true }).gte("created_at", monthStart),
  ]);

  return {
    checkIns: (checkIns.data ?? []) as CheckInRow[],
    // Counted separately: the list above is only the latest few.
    checkInsToday: todayCount.count ?? 0,
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
    let q = supabase.from("customers").select("id", { count: "exact", head: true }).gte("lifetime_points", min);
    if (max !== null) q = q.lt("lifetime_points", max);
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
    .select("id, first_name, last_name, phone, birthday_month, birthday_day")
    .in("birthday_month", months);

  const upcoming = days.flatMap(({ year, month, day, date }) =>
    (data ?? [])
      .filter((c) => c.birthday_month && c.birthday_day && isBirthdayOn(c.birthday_month, c.birthday_day, year, month, day))
      .map((c) => ({ ...c, date, year })),
  );
  // Who has already had this birthday's discount (it can be used up to a week early).
  const { data: used } = upcoming.length
    ? await supabase
        .from("birthday_redemptions")
        .select("customer_id, birthday_year")
        .in("customer_id", upcoming.map((c) => c.id))
    : { data: [] };
  const usedKeys = new Set((used ?? []).map((u) => `${u.customer_id}:${u.birthday_year}`));
  return upcoming.map((c) => ({ ...c, used: usedKeys.has(`${c.id}:${c.year}`) }));
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

/** All, who visited when (by their check-ins, shop calendar), and this month's birthdays. */
export const CUSTOMER_FILTERS = ["all", "today", "yesterday", "week", "birthday"] as const;
export type CustomerFilter = (typeof CUSTOMER_FILTERS)[number];
export const PAGE_SIZE = 25;

export const CUSTOMER_SORTS = ["last_visit", "name", "points", "lifetime", "joined"] as const;
export type CustomerSort = (typeof CUSTOMER_SORTS)[number];
export type SortDir = "asc" | "desc";
/** The direction a column sorts in when first clicked: biggest and newest first, names A–Z. */
export const DEFAULT_SORT_DIR: Record<CustomerSort, SortDir> = {
  last_visit: "desc",
  name: "asc",
  points: "desc",
  lifetime: "desc",
  joined: "desc",
};

// PostgREST answers 416 "Requested range not satisfiable" for a page past the last row.
const PAST_END = "PGRST103";

export async function listCustomers({
  q,
  filter,
  sort,
  dir,
  page,
}: {
  q: string;
  filter: CustomerFilter;
  sort: CustomerSort;
  dir: SortDir;
  page: number;
}) {
  const { supabase } = await staffClient();
  // "Who visited when" looks at check-ins on those days, not just the last visit, so someone who
  // came yesterday and again today shows under both. The inner join keeps only matching customers.
  const byVisit = filter === "today" || filter === "yesterday" || filter === "week";
  let query = supabase
    .from("customers")
    .select(byVisit ? "*, visit:check_ins!inner(created_at, voided_at)" : "*", { count: "exact" });

  const search = customerSearch(q);
  if (search?.phone) query = query.like("phone", search.phone);
  if (search?.name) query = query.or(search.name);

  if (byVisit) {
    query = query.is("visit.voided_at", null).gte("visit.created_at", await dayStart(supabase, filter === "week" ? 6 : filter === "yesterday" ? 1 : 0));
    if (filter === "yesterday") query = query.lt("visit.created_at", await dayStart(supabase, 0));
  }
  if (filter === "birthday") query = query.eq("birthday_month", shopDate(await shopTimezone()).month);

  const ascending = dir === "asc";
  if (sort === "name") query = query.order("first_name", { ascending }).order("last_name", { ascending, nullsFirst: false });
  else if (sort === "points") query = query.order("points_balance", { ascending });
  // Lifetime points decide the tier, so that is what the list shows and sorts by (not visits).
  else if (sort === "lifetime") query = query.order("lifetime_points", { ascending });
  else if (sort === "joined") query = query.order("created_at", { ascending });
  // Customers who never visited go last whichever way the list is sorted.
  else query = query.order("last_visit_at", { ascending, nullsFirst: false });

  // Ties keep a fixed order, so a row can't appear on two pages.
  const from = (page - 1) * PAGE_SIZE;
  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .order("id")
    .range(from, from + PAGE_SIZE - 1);
  if (error?.code === PAST_END) return { customers: [] as Customer[], total: 0, pastEnd: true };
  if (error) throw error;
  // Drop the joined check-ins: the list only needs the customers.
  const customers = (data as unknown as (Customer & { visit?: unknown })[]).map((row) => {
    const c = { ...row };
    delete c.visit;
    return c as Customer;
  });
  return { customers, total: count ?? 0, pastEnd: false };
}

// A customer's history is paged in memory: it merges points and birthday rows,
// and even a weekly regular builds up only a few hundred rows in years.
const HISTORY_LIMIT = 1000;

/** Just the name, for the browser tab title. */
export async function customerTitle(id: string) {
  const { supabase } = await staffClient();
  const { data } = await supabase.from("customers").select("first_name, last_name").eq("id", id).maybeSingle();
  return data ? (data.last_name ? `${data.first_name} ${data.last_name}` : data.first_name) : null;
}

/**
 * A typed search as PostgREST filters on a customer: digits match the phone (a local "0412…"
 * matches the stored "61412…"), anything else the first or last name.
 */
function customerSearch(q: string): { phone?: string; name?: string } | null {
  // PostgREST's or() syntax treats these as separators, so drop them from user input.
  const term = q.replace(/[,()*%\\]/g, " ").trim();
  if (!term) return null;
  const digits = term.replace(/\D/g, "");
  if (digits.length >= 3 && digits.length === term.replace(/[\s\-+.()]/g, "").length) {
    return { phone: `%${digits.startsWith("0") ? `61${digits.slice(1)}` : digits}%` };
  }
  return { name: `first_name.ilike.%${term}%,last_name.ilike.%${term}%` };
}

export async function getCustomer(id: string) {
  const { supabase } = await staffClient();
  const [customer, ledger, rewards, birthday, birthdayHistory] = await Promise.all([
    supabase.from("customers").select("*").eq("id", id).maybeSingle(),
    supabase.from("point_transactions").select("*").eq("customer_id", id).order("seq", { ascending: false }).limit(HISTORY_LIMIT),
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

export const CHECK_INS_PAGE_SIZE = 50;

export async function listCheckIns({
  range,
  q = "",
  page,
}: {
  range: CheckInRange;
  /** A customer's name or phone, as on Customers. */
  q?: string;
  page: number;
}) {
  const { supabase } = await staffClient();
  const since = await dayStart(supabase, CHECK_IN_RANGES[range]);
  const from = (page - 1) * CHECK_INS_PAGE_SIZE;
  const search = customerSearch(q);
  // An inner join, so a customer search drops the other check-ins. Every check-in has a
  // customer, so without a search it returns the same rows.
  let query = supabase
    .from("check_ins")
    .select("*, customer:customers!inner(id, first_name, last_name, phone, lifetime_points)", { count: "exact" })
    .gte("created_at", since)
    .is("voided_at", null)
    .order("created_at", { ascending: false })
    .range(from, from + CHECK_INS_PAGE_SIZE - 1);
  if (search?.phone) query = query.like("customer.phone", search.phone);
  if (search?.name) query = query.or(search.name, { referencedTable: "customer" });
  // What was used in the range: points rewards, birthday discounts and gift voucher spends.
  // Fetched for the whole range (a shop's month is a few hundred rows) for the totals, then
  // matched to each check-in by customer and shop day.
  const [{ data, count, error }, totals, redeems, birthdays, spends, timezone] = await Promise.all([
    query,
    supabase.rpc("check_in_totals", { p_since: since }),
    supabase.from("point_transactions").select("customer_id, created_at, promotion:promotions(title)").eq("reason", "redeem").gte("created_at", since).limit(5000),
    supabase.from("birthday_redemptions").select("customer_id, created_at, percent").gte("created_at", since).limit(5000),
    supabase
      .from("gift_voucher_transactions")
      .select("customer_id, created_at, delta_cents, voucher:gift_vouchers(customer_id)")
      .eq("kind", "spend")
      .is("voided_at", null)
      .gte("created_at", since)
      .limit(5000),
    shopTimezone(),
  ]);
  if (error && error.code !== PAST_END) throw error;
  for (const r of [totals, redeems, birthdays, spends]) if (r.error) throw r.error;

  const dayKey = (customerId: string | null | undefined, at: string) => (customerId ? `${customerId}|${isoDate(shopDate(timezone, new Date(at)))}` : null);
  const uses = new Map<string, VisitUse[]>();
  const add = (key: string | null, use: VisitUse) => {
    if (key) uses.set(key, [...(uses.get(key) ?? []), use]);
  };
  for (const r of redeems.data ?? []) add(dayKey(r.customer_id, r.created_at), { kind: "points", label: r.promotion?.title ?? "Reward" });
  for (const b of birthdays.data ?? []) add(dayKey(b.customer_id, b.created_at), { kind: "birthday", percent: b.percent });
  // A spend names the customer only when staff gave one; otherwise it's the voucher's owner.
  for (const g of spends.data ?? []) add(dayKey(g.customer_id ?? g.voucher?.customer_id, g.created_at), { kind: "gift", cents: -g.delta_cents });

  const rows = ((data ?? []) as CheckInRow[]).map((r) => ({ ...r, used: uses.get(dayKey(r.customer_id, r.created_at) ?? "") ?? [] }));
  return {
    pastEnd: error?.code === PAST_END,
    rows,
    /** Check-ins in the range that still count (older undone ones are left out). */
    total: count ?? 0,
    /** Visits and points across the whole range. */
    totals: totals.data as { visits: number; points: number },
    /** Discounts given and gift voucher credit used across the whole range. */
    used: {
      discounts: (redeems.data?.length ?? 0) + (birthdays.data?.length ?? 0),
      giftCents: (spends.data ?? []).reduce((sum, g) => sum - g.delta_cents, 0),
    },
  };
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
  const yearStart = await dayStart(supabase, shopDate(await shopTimezone()).dayOfYear - 1);
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

export type Account = {
  id: string;
  name: string;
  role: "admin" | "staff";
  email: string;
  removedAt: string | null;
  /** Still on a password an admin set. */
  tempPassword: boolean;
  lastSignInAt: string | null;
};

/** Every account with its sign-in email (which lives in Supabase Auth, so the service client reads it). */
export async function listAccounts(): Promise<Account[]> {
  const { supabase } = await staffClient();
  const [{ data: rows }, { data: users, error }] = await Promise.all([
    supabase.from("staff").select("*").order("role").order("display_name"),
    createAdminClient().auth.admin.listUsers({ perPage: 1000 }),
  ]);
  if (error) throw error;
  const byId = new Map(users.users.map((u) => [u.id, u]));
  return (rows ?? []).map((s) => {
    const user = byId.get(s.user_id);
    return {
      id: s.user_id,
      name: s.display_name,
      role: s.role,
      email: user?.email ?? "",
      removedAt: s.removed_at,
      tempPassword: user?.app_metadata?.temp_password === true,
      lastSignInAt: user?.last_sign_in_at ?? null,
    };
  });
}

// ---------------------------------------------------------------------------
// Gift vouchers
// ---------------------------------------------------------------------------

type CustomerRef = Pick<Customer, "id" | "first_name" | "last_name" | "phone">;
export type GiftVoucherRow = Tables["gift_vouchers"]["Row"] & {
  customer: CustomerRef | null;
  status: GiftVoucherStatus;
  /** The most recent spend still standing (not undone): when, and by which customer. */
  lastUse: { created_at: string; customer: Pick<Customer, "first_name" | "last_name"> | null } | null;
};
export type GiftVoucherTransaction = Tables["gift_voucher_transactions"]["Row"] & { customer: CustomerRef | null };

export const GIFT_VOUCHER_FILTERS = ["all", "active", "used_up", "expired"] as const;
export type GiftVoucherFilter = (typeof GIFT_VOUCHER_FILTERS)[number];
export const GIFT_VOUCHERS_PAGE_SIZE = 25;

const CUSTOMER_REF = "customer:customers(id, first_name, last_name, phone)";

export async function listGiftVouchers({ q, filter, page }: { q: string; filter: GiftVoucherFilter; page: number }) {
  const { supabase } = await staffClient();
  const today = isoDate(shopDate(await shopTimezone()));
  let query = supabase
    .from("gift_vouchers")
    .select("*, customer:customers(id, first_name, last_name, phone), last_use:gift_voucher_transactions(created_at, customer:customers(first_name, last_name))", {
      count: "exact",
    })
    // Only the latest spend that wasn't undone, for the list's "Last used" column.
    .eq("last_use.kind", "spend")
    .is("last_use.voided_at", null)
    .order("seq", { referencedTable: "last_use", ascending: false })
    .limit(1, { referencedTable: "last_use" });

  // Codes are stored without dashes or spaces, so search the same way.
  const code = q.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (code) query = query.like("code", `%${code}%`);
  if (filter === "active") query = query.gt("balance_cents", 0).gte("expires_on", today);
  if (filter === "used_up") query = query.eq("balance_cents", 0).gte("expires_on", today);
  if (filter === "expired") query = query.lt("expires_on", today);

  const from = (page - 1) * GIFT_VOUCHERS_PAGE_SIZE;
  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .order("id")
    .range(from, from + GIFT_VOUCHERS_PAGE_SIZE - 1);
  if (error?.code === PAST_END) return { vouchers: [] as GiftVoucherRow[], total: 0, pastEnd: true };
  if (error) throw error;
  return {
    vouchers: (data as unknown as (Omit<GiftVoucherRow, "status" | "lastUse"> & { last_use: GiftVoucherRow["lastUse"][] })[]).map(
      ({ last_use, ...v }) => ({ ...v, status: giftVoucherStatus(v, today), lastUse: last_use[0] ?? null }),
    ),
    total: count ?? 0,
    pastEnd: false,
  };
}

// ---------------------------------------------------------------------------
// Gift voucher activity: every sale, spend, undo and adjustment, across all vouchers
// ---------------------------------------------------------------------------

export const GIFT_ACTIVITY_KINDS = ["all", "sale", "spend"] as const;
export type GiftActivityKind = (typeof GIFT_ACTIVITY_KINDS)[number];
export const GIFT_ACTIVITY_RANGES = { "7d": 6, "30d": 29, all: null } as const;
export type GiftActivityRange = keyof typeof GIFT_ACTIVITY_RANGES;
export const GIFT_ACTIVITY_PAGE_SIZE = 50;

export type GiftActivityRow = Tables["gift_voucher_transactions"]["Row"] & {
  voucher: { id: string; code: string };
  customer: CustomerRef | null;
};

/**
 * The voucher ledger newest first, so staff can see who bought, who used and when without
 * opening each voucher. `q` matches a voucher code, or a customer's name or phone (what they
 * used, plus everything on the vouchers they hold).
 */
export async function listGiftVoucherActivity({
  q,
  kind,
  range,
  page,
}: {
  q: string;
  kind: GiftActivityKind;
  range: GiftActivityRange;
  page: number;
}) {
  const { supabase } = await staffClient();
  let query = supabase
    .from("gift_voucher_transactions")
    .select("*, voucher:gift_vouchers!inner(id, code), customer:customers(id, first_name, last_name, phone)", { count: "exact" });
  if (kind !== "all") query = query.eq("kind", kind);
  const days = GIFT_ACTIVITY_RANGES[range];
  if (days !== null) query = query.gte("created_at", await dayStart(supabase, days));

  // A search can be a code or a customer: find both, then show either's entries.
  const term = q.trim();
  if (term) {
    const code = term.toUpperCase().replace(/[^A-Z0-9]/g, "");
    const search = customerSearch(term);
    const [codes, people] = await Promise.all([
      code ? supabase.from("gift_vouchers").select("id").like("code", `%${code}%`).limit(200) : { data: [] },
      search
        ? (search.phone
            ? supabase.from("customers").select("id").like("phone", search.phone)
            : supabase.from("customers").select("id").or(search.name!)
          ).limit(200)
        : { data: [] },
    ]);
    const customerIds = (people.data ?? []).map((r) => r.id);
    // A customer's activity is what they used and everything on vouchers they hold.
    const held = customerIds.length
      ? await supabase.from("gift_vouchers").select("id").in("customer_id", customerIds).limit(200)
      : { data: [] };
    const voucherIds = [...new Set([...(codes.data ?? []), ...(held.data ?? [])].map((r) => r.id))];
    if (!voucherIds.length && !customerIds.length) return { rows: [] as GiftActivityRow[], total: 0, pastEnd: false };
    const either = [
      voucherIds.length ? `gift_voucher_id.in.(${voucherIds.join(",")})` : null,
      customerIds.length ? `customer_id.in.(${customerIds.join(",")})` : null,
    ].filter(Boolean);
    query = query.or(either.join(","));
  }

  const from = (page - 1) * GIFT_ACTIVITY_PAGE_SIZE;
  // By time, then by ledger order for entries written in the same transaction.
  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .order("seq", { ascending: false })
    .range(from, from + GIFT_ACTIVITY_PAGE_SIZE - 1);
  if (error?.code === PAST_END) return { rows: [] as GiftActivityRow[], total: 0, pastEnd: true };
  if (error) throw error;
  return { rows: (data ?? []) as unknown as GiftActivityRow[], total: count ?? 0, pastEnd: false };
}

/** Just the code, for the browser tab title. */
export async function giftVoucherCode(id: string) {
  const { supabase } = await staffClient();
  const { data } = await supabase.from("gift_vouchers").select("code").eq("id", id).maybeSingle();
  return data?.code ?? null;
}

/** One gift voucher with its whole history (a voucher only ever has a handful of entries). */
export async function getGiftVoucher(id: string) {
  const { supabase } = await staffClient();
  const [voucher, transactions, tz] = await Promise.all([
    supabase.from("gift_vouchers").select(`*, ${CUSTOMER_REF}`).eq("id", id).maybeSingle(),
    supabase
      .from("gift_voucher_transactions")
      .select(`*, ${CUSTOMER_REF}`)
      .eq("gift_voucher_id", id)
      .order("seq", { ascending: false })
      .limit(1000),
    shopTimezone(),
  ]);
  if (voucher.error) throw voucher.error;
  if (!voucher.data) return null;
  const v = voucher.data as unknown as Omit<GiftVoucherRow, "status">;
  return {
    voucher: { ...v, status: giftVoucherStatus(v, isoDate(shopDate(tz))) } as GiftVoucherRow,
    transactions: (transactions.data ?? []) as unknown as GiftVoucherTransaction[],
  };
}

/** Unspent credit the shop owes, and this month's sales. */
export async function giftVoucherSummary() {
  const { supabase } = await staffClient();
  const { year, month } = shopDate(await shopTimezone());
  const [totals, sold] = await Promise.all([
    supabase.from("gift_voucher_totals").select("*").single(),
    supabase
      .from("gift_vouchers")
      .select("amount_cents")
      .gte("sold_on", isoDate({ year, month, day: 1 })),
  ]);
  return {
    outstandingCents: Number(totals.data?.outstanding_cents ?? 0),
    activeCount: totals.data?.active_count ?? 0,
    soldThisMonth: sold.data?.length ?? 0,
    soldThisMonthCents: (sold.data ?? []).reduce((sum, v) => sum + v.amount_cents, 0),
  };
}

/** A customer's gift vouchers, newest first, for their page. */
export async function customerGiftVouchers(customerId: string) {
  const { supabase } = await staffClient();
  const [{ data }, tz] = await Promise.all([
    supabase.from("gift_vouchers").select("*").eq("customer_id", customerId).order("created_at", { ascending: false }),
    shopTimezone(),
  ]);
  const today = isoDate(shopDate(tz));
  return (data ?? []).map((v) => ({ ...v, status: giftVoucherStatus(v, today) }));
}
