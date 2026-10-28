import "server-only";
import { z } from "zod";
import {
  getCustomer,
  getDashboard,
  getSettings,
  getTierCounts,
  getUpcomingBirthdays,
  giftVoucherSummary,
  listCheckIns,
  listCustomers,
  listLapsedCustomers,
  listRewards,
  serviceStats,
} from "@/lib/admin-data";
import { formatDate, fullName } from "@/lib/format";
import { formatMoney } from "@/lib/gift-vouchers";
import { TIER_LABELS, tierFor } from "@/lib/tiers";

// The assistant's tools. Each one is a description the model reads, a schema for its input,
// and a function that runs here on the server. They are all read-only and go through the
// admin data loaders, so requireAdmin() and RLS apply exactly as on the admin pages: the model
// can only see what the signed-in admin could see, and it has no way to change points,
// balances or anything else. Phone numbers are never sent to the model.

/** What the model reads: a name, when to use it, and a JSON Schema for its input. Every AI provider takes this shape. */
export type ToolDefinition = { name: string; description: string; parameters: Record<string, unknown> };

type Tool = {
  definition: ToolDefinition;
  input: z.ZodType;
  run: (input: never) => Promise<unknown>;
};

/** A tool whose `run` gets the input already checked against its schema. */
function tool<S extends z.ZodType>(definition: ToolDefinition, input: S, run: (input: z.infer<S>) => Promise<unknown>): Tool {
  return { definition, input, run };
}

const NO_INPUT = { type: "object" as const, properties: {}, required: [], additionalProperties: false };
const RANGE = { type: "string", enum: ["today", "7d", "30d"], description: "today, the last 7 days, or the last 30 days (shop calendar)" };

/** Dates as the shop reads them, e.g. "3 Oct 2026". */
async function dateFormatter() {
  const { timezone } = await getSettings();
  return (iso: string | null) => (iso ? formatDate(iso, timezone, { day: "numeric", month: "short", year: "numeric" }) : null);
}

const TOOLS: Tool[] = [
  tool(
    {
      name: "shop_overview",
      description:
        "Today's numbers at a glance: check-ins today, new customers this week, total and active customers, discounts given this month, customers per tier, gift voucher credit, and the rewards on offer.",
      parameters: NO_INPUT,
    },
    z.object({}),
    async () => {
      const settings = await getSettings();
      const [stats, tiers, gifts, rewards] = await Promise.all([getDashboard(), getTierCounts(settings), giftVoucherSummary(), listRewards()]);
      return {
        checkInsToday: stats.checkInsToday,
        newCustomersLast7Days: stats.newCustomersThisWeek,
        totalCustomers: stats.totalCustomers,
        visitedLast30Days: stats.activeLast30Days,
        pointsRewardsUsedThisMonth: stats.redeemedThisMonth,
        birthdayDiscountsThisMonth: stats.birthdayDiscountsThisMonth,
        customersPerTier: { [TIER_LABELS.vip]: tiers.vip, [TIER_LABELS.regular]: tiers.regular, [TIER_LABELS.new]: tiers.new },
        tierThresholds: { regularFromLifetimePoints: settings.tier_regular_points, vipFromLifetimePoints: settings.tier_vip_points },
        giftVouchers: {
          unspentCredit: formatMoney(gifts.outstandingCents),
          vouchersWithCredit: gifts.activeCount,
          createdThisMonth: gifts.soldThisMonth,
          createdThisMonthValue: formatMoney(gifts.soldThisMonthCents),
        },
        rewards: rewards.map((r) => ({ title: r.title, pointsCost: r.points_cost, onKiosk: r.is_active })),
        birthdayDiscountOn: settings.birthday_discount_enabled,
      };
    },
  ),

  tool(
    {
      name: "find_customers",
      description:
        "Search customers by first or last name (empty query = everyone) and list up to 25, sorted. Use it to find a customer's id before customer_details, or for 'top customers' questions.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Part of a first or last name, or empty for all customers" },
          sort: {
            type: "string",
            enum: ["last_visit", "name", "points", "lifetime", "joined"],
            description: "last_visit (most recent first), name (A–Z), points (current balance), lifetime (all points ever earned; decides the tier), joined (newest first)",
          },
        },
        required: ["query", "sort"],
        additionalProperties: false,
      },
    },
    z.object({ query: z.string().max(80), sort: z.enum(["last_visit", "name", "points", "lifetime", "joined"]) }),
    async ({ query, sort }) => {
      const [settings, date] = await Promise.all([getSettings(), dateFormatter()]);
      // The phone search on Customers takes digits; names only here, so no phone reaches the model.
      const q = query.replace(/\d/g, "").trim();
      const { customers, total } = await listCustomers({ q, filter: "all", sort, dir: sort === "name" ? "asc" : "desc", page: 1 });
      return {
        totalMatching: total,
        shown: customers.length,
        customers: customers.map((c) => ({
          id: c.id,
          name: fullName(c),
          tier: TIER_LABELS[tierFor(c.lifetime_points, settings)],
          pointsBalance: c.points_balance,
          lifetimePoints: c.lifetime_points,
          visits: c.visit_count,
          lastVisit: date(c.last_visit_at),
          joined: date(c.created_at),
        })),
      };
    },
  ),

  tool(
    {
      name: "customer_details",
      description: "One customer's full picture: points, tier, visits, birthday, notes and their 15 most recent points entries (with the services and technician of each visit).",
      parameters: {
        type: "object",
        properties: { customer_id: { type: "string", description: "The id from find_customers or lapsed_customers" } },
        required: ["customer_id"],
        additionalProperties: false,
      },
    },
    z.object({ customer_id: z.uuid() }),
    async ({ customer_id }) => {
      const [settings, date, found] = await Promise.all([getSettings(), dateFormatter(), getCustomer(customer_id)]);
      if (!found) return { error: "No customer with that id." };
      const { customer: c, ledger, birthday } = found;
      return {
        name: fullName(c),
        tier: TIER_LABELS[tierFor(c.lifetime_points, settings)],
        pointsBalance: c.points_balance,
        lifetimePoints: c.lifetime_points,
        visits: c.visit_count,
        lastVisit: date(c.last_visit_at),
        joined: date(c.created_at),
        birthday: c.birthday_month && c.birthday_day ? `${c.birthday_day}/${c.birthday_month}` : null,
        birthdayDiscountAvailableNow: birthday.eligible,
        notes: c.notes,
        recentHistory: ledger.slice(0, 15).map((t) => ({
          date: date(t.created_at),
          reason: t.reason,
          points: t.delta,
          note: t.note,
          services: t.visit?.services.map((s) => s.name) ?? [],
          technician: t.visit?.technician_name ?? null,
        })),
      };
    },
  ),

  tool(
    {
      name: "lapsed_customers",
      description: "Customers who have visited before but not in the last N days, the longest away first. Good for win-back questions.",
      parameters: {
        type: "object",
        properties: {
          days: { type: "integer", description: "How many days without a visit (e.g. 60)" },
          limit: { type: "integer", description: "How many to list, 1–50" },
        },
        required: ["days", "limit"],
        additionalProperties: false,
      },
    },
    z.object({ days: z.number().int().min(1).max(3650), limit: z.number().int().min(1).max(50) }),
    async ({ days, limit }) => {
      const [settings, date, { customers, total }] = await Promise.all([getSettings(), dateFormatter(), listLapsedCustomers(days, limit)]);
      return {
        totalLapsed: total,
        shown: customers.length,
        customers: customers.map((c) => ({
          id: c.id,
          name: fullName(c),
          tier: TIER_LABELS[tierFor(c.lifetime_points, settings)],
          lastVisit: date(c.last_visit_at),
          visits: c.visit_count,
          pointsBalance: c.points_balance,
        })),
      };
    },
  ),

  tool(
    {
      name: "visit_stats",
      description:
        "Visits in a range: how many check-ins, points given, discounts used and gift voucher credit spent, plus how often each service and nail technician was picked on the kiosk.",
      parameters: { type: "object", properties: { range: RANGE }, required: ["range"], additionalProperties: false },
    },
    z.object({ range: z.enum(["today", "7d", "30d"]) }),
    async ({ range }) => {
      const [checkIns, picks] = await Promise.all([listCheckIns({ range, page: 1 }), serviceStats(range)]);
      return {
        checkIns: checkIns.totals.visits,
        pointsGiven: checkIns.totals.points,
        discountsUsed: checkIns.used.discounts,
        giftVoucherCreditSpent: formatMoney(checkIns.used.giftCents),
        // Customers can skip these kiosk steps, so they can add up to fewer than the check-ins.
        servicesPicked: picks.services,
        technicianPicked: picks.technicians,
      };
    },
  ),

  tool(
    {
      name: "upcoming_birthdays",
      description: "Customers whose birthday is in the next 7 days, and whether they've already used this year's birthday discount.",
      parameters: NO_INPUT,
    },
    z.object({}),
    async () => {
      const settings = await getSettings();
      const date = await dateFormatter();
      const birthdays = await getUpcomingBirthdays(settings.timezone);
      return {
        birthdayDiscountOn: settings.birthday_discount_enabled,
        customers: birthdays.map((b) => ({ id: b.id, name: fullName(b), birthday: date(b.date.toISOString()), discountUsed: b.used })),
      };
    },
  ),
];

export const TOOL_DEFINITIONS = TOOLS.map((t) => t.definition);

/** What the admin sees under an answer, e.g. "Visit stats (30d)". */
export function describeToolCall(name: string, input: unknown) {
  const label = name.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
  // Ids mean nothing to the owner, so a customer lookup shows as just "Customer details".
  const args = Object.values((input ?? {}) as Record<string, unknown>).filter(
    (v) => v !== "" && typeof v !== "object" && !(typeof v === "string" && z.uuid().safeParse(v).success),
  );
  return args.length ? `${label} (${args.join(", ")})` : label;
}

/**
 * Runs one tool call from the model. The input is model output, so it's checked against the
 * schema before anything runs; a bad input or a failure goes back to the model as an error,
 * which it can read and recover from, rather than ending the whole answer.
 */
export async function runTool(name: string, args: unknown): Promise<{ ok: true; output: unknown } | { ok: false; error: string }> {
  const found = TOOLS.find((t) => t.definition.name === name);
  if (!found) return { ok: false, error: `Unknown tool ${name}` };
  const input = found.input.safeParse(args ?? {});
  if (!input.success) return { ok: false, error: `Invalid input: ${input.error.issues.map((i) => i.message).join("; ")}` };
  try {
    return { ok: true, output: await found.run(input.data as never) };
  } catch (error) {
    console.error(`[ask] ${name} failed`, error);
    return { ok: false, error: "The lookup failed." };
  }
}
