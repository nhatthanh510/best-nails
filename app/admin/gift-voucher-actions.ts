"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { PostgrestError } from "@supabase/supabase-js";
import { requireAdmin, requireSignedIn } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { findCustomer } from "@/lib/customer-lookup";
import { formatMoney, GIFT_VOUCHER_PROBLEMS, looksMistyped, normalizeGiftCode, parseDollars, type GiftVoucherStatus } from "@/lib/gift-vouchers";
import type { ActionState } from "./actions";

function fail(message: string): ActionState {
  return { ok: false, message };
}

function dbError(error: PostgrestError): ActionState {
  if (error.code === "42501") return fail("You don't have permission to do that.");
  if (["22023", "P0002", "23514"].includes(error.code)) {
    if (error.code === "23514") return fail("Gift vouchers must stay valid for at least 3 years from when they're created.");
    return fail(error.message.charAt(0).toUpperCase() + error.message.slice(1) + ".");
  }
  console.error(error);
  return fail("Something went wrong. Please try again.");
}

/** Why a code can't be used. An unknown code with a wrong check digit is called out as a typo. */
function problem(status: string, code: string) {
  const key = status === "not_found" && looksMistyped(code) ? "mistyped" : status;
  return GIFT_VOUCHER_PROBLEMS[key] ?? "This gift voucher can't be used.";
}

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null);

// ---------------------------------------------------------------------------
// Selling
// ---------------------------------------------------------------------------

const sellSchema = z.object({
  amount: z.string(),
  code: z.string().trim().max(40),
  phone: z.string(),
  notes: text(500),
});

/** What the "Voucher created" screen shows, so staff can copy the code onto the card. */
export type CreatedVoucher = {
  id: string;
  code: string;
  amountCents: number;
  expiresOn: string;
  publicToken: string | null;
  /** Sold from a card printed ahead of time (Print blank vouchers), so it's already printed. */
  preprinted: boolean;
  customerName: string | null;
};
export type SellState = (ActionState & { voucher?: CreatedVoucher }) | null;

export async function sellGiftVoucher(_: SellState, formData: FormData): Promise<SellState> {
  await requireSignedIn();
  const parsed = sellSchema.safeParse({
    amount: formData.get("amount") ?? "",
    code: formData.get("code") ?? "",
    phone: formData.get("phone") ?? "",
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) return fail("Check the details and try again.");
  const cents = parseDollars(parsed.data.amount);
  if (cents === null || cents < 100) return fail("Enter the voucher amount, e.g. 100.");
  // A code is always chosen on purpose: the number printed on the card, or one from Generate.
  if (!parsed.data.code?.trim()) return fail("Enter the code on the voucher card, or press Generate.");

  const supabase = await createClient();
  // Staff accounts can't read customers, so the phone lookup uses the service client (it only
  // returns the id and name, here on the server).
  const customer = await findCustomer(createAdminClient(), parsed.data.phone, "");
  if (customer === "missing") return fail("No customer has that phone number. Leave it blank or add them first.");

  const { data, error } = await supabase.rpc("sell_gift_voucher", {
    p_amount_cents: cents,
    p_code: parsed.data.code || undefined,
    p_customer_id: customer?.id,
    p_notes: parsed.data.notes ?? undefined,
  });
  if (error) return dbError(error);
  const r = data as { id: string; code: string; preprinted?: boolean };
  // The expiry and QR token for the printable voucher; staff accounts can't read gift_vouchers themselves.
  const { data: row } = await createAdminClient().from("gift_vouchers").select("expires_on, public_token").eq("id", r.id).single();
  // Lists and totals behind the dialog update while it shows the new code.
  refresh();
  return {
    ok: true,
    message: `Created ${r.code} for ${formatMoney(cents)}. Take payment at the till.`,
    href: `/admin/gift-vouchers/${r.id}`,
    voucher: {
      id: r.id,
      code: r.code,
      amountCents: cents,
      expiresOn: row?.expires_on ?? "",
      publicToken: row?.public_token ?? null,
      preprinted: r.preprinted === true,
      customerName: customer ? [customer.first_name, customer.last_name].filter(Boolean).join(" ") : null,
    },
  };
}

// ---------------------------------------------------------------------------
// Printing ahead of time (admin): preview a batch of codes, then save them as inactive vouchers
// and print them. Selling one's code later sets its amount.
// ---------------------------------------------------------------------------

export type PrintedVoucher = { code: string; token: string };

/** New codes for a batch, shown before anything is saved. */
export async function previewGiftVoucherCodes(count: number): Promise<{ ok: true; codes: string[] } | { ok: false; message: string }> {
  await requireAdmin();
  if (!Number.isInteger(count) || count < 1 || count > 100) return { ok: false, message: "Print between 1 and 100 vouchers at a time." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("preview_gift_voucher_codes", { p_count: count });
  if (error) return dbError(error) as { ok: false; message: string };
  return { ok: true, codes: data };
}

/** Saves the previewed codes as inactive vouchers; their QR tokens come back for printing. */
export async function createInactiveGiftVouchers(codes: string[]): Promise<{ ok: true; vouchers: PrintedVoucher[] } | { ok: false; message: string }> {
  await requireAdmin();
  if (!Array.isArray(codes) || codes.length < 1 || codes.length > 100) return { ok: false, message: "Print between 1 and 100 vouchers at a time." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_inactive_gift_vouchers", { p_codes: codes.map(String) });
  if (error) return dbError(error) as { ok: false; message: string };
  refresh();
  return { ok: true, vouchers: (data as { code: string; public_token: string }[]).map((v) => ({ code: v.code, token: v.public_token })) };
}

/** A fresh code with the business prefix, for the sell form's Generate button. */
export async function generateGiftVoucherCode(): Promise<{ ok: true; code: string } | { ok: false; message: string }> {
  await requireSignedIn();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("generate_gift_voucher_code");
  if (error || !data) return { ok: false, message: "Couldn't make a code. Please try again." };
  return { ok: true, code: data };
}

// ---------------------------------------------------------------------------
// Front desk: check and spend. Like selling, open to any signed-in account (the kiosk header).
// ---------------------------------------------------------------------------

export type GiftVoucherCheck =
  | {
      ok: true;
      id: string;
      code: string;
      balanceCents: number;
      amountCents: number;
      expiresOn: string;
      customerName: string | null;
    }
  | { ok: false; message: string };

/** A voucher found by its code at the front desk, with what's needed to choose what to do next. */
export type FoundVoucher = {
  id: string;
  code: string;
  status: GiftVoucherStatus;
  balanceCents: number;
  /** The sale plus top-ups; null before it's sold. */
  loadedCents: number | null;
  expiresOn: string | null;
  customerName: string | null;
  blockedReason: string | null;
};
export type FindResult = { ok: true; voucher: FoundVoucher } | { ok: false; message: string; canCreate: boolean };

/**
 * Find voucher: whatever state a code is in (not sold, active, used up, expired or blocked), so
 * the front desk can show only the actions that apply. An unknown code that isn't a typo can be
 * created (a number printed elsewhere). Open to any signed-in account, like checking a balance.
 */
export async function findGiftVoucher(code: string): Promise<FindResult> {
  await requireSignedIn();
  const typed = normalizeGiftCode(String(code ?? "").slice(0, 40));
  if (!typed) return { ok: false, message: "Type the code on the voucher.", canCreate: false };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("check_gift_voucher", { p_code: typed });
  if (error || !data) return { ok: false, message: "Couldn't look the voucher up. Please try again.", canCreate: false };
  const r = data as Record<string, unknown>;
  if (r.status === "not_found") {
    const mistyped = looksMistyped(typed);
    return { ok: false, message: problem("not_found", typed), canCreate: !mistyped && /^[A-Z0-9]{4,20}$/.test(typed) };
  }
  if (r.status === "not_sold" || r.status === "blocked") {
    // check_gift_voucher says no more for these; staff accounts can't read gift_vouchers, so the
    // few details shown come from the service client, here on the server.
    const { data: v } = await createAdminClient()
      .from("gift_vouchers")
      .select("balance_cents, expires_on, blocked_reason, customer:customers(first_name, last_name)")
      .eq("id", r.id as string)
      .single();
    const customer = v?.customer as { first_name: string; last_name: string | null } | null;
    return {
      ok: true,
      voucher: {
        id: r.id as string,
        code: r.code as string,
        status: r.status === "blocked" ? "blocked" : "inactive",
        balanceCents: v?.balance_cents ?? 0,
        loadedCents: null,
        expiresOn: v?.expires_on ?? null,
        customerName: customer ? [customer.first_name, customer.last_name].filter(Boolean).join(" ") : null,
        blockedReason: v?.blocked_reason ?? null,
      },
    };
  }
  return {
    ok: true,
    voucher: {
      id: r.id as string,
      code: r.code as string,
      status: r.status === "valid" ? "active" : (r.status as GiftVoucherStatus),
      balanceCents: r.balance_cents as number,
      loadedCents: r.amount_cents as number,
      expiresOn: r.expires_on as string,
      customerName: (r.customer_name as string) ?? null,
      blockedReason: null,
    },
  };
}

/** Look a code up first, so staff can tell the customer their balance. */
export async function checkGiftVoucherCode(code: string): Promise<GiftVoucherCheck> {
  await requireSignedIn();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("check_gift_voucher", { p_code: code });
  if (error || !data) return { ok: false, message: "Couldn't check the gift voucher. Please try again." };
  const r = data as Record<string, unknown>;
  if (r.status !== "valid") return { ok: false, message: problem(r.status as string, code) };
  return {
    ok: true,
    id: r.id as string,
    code: r.code as string,
    balanceCents: r.balance_cents as number,
    amountCents: r.amount_cents as number,
    expiresOn: r.expires_on as string,
    customerName: (r.customer_name as string) ?? null,
  };
}

/** What "Topped up" shows: the new balance and expiry, for the customer at the till. */
export type TopUpState = (ActionState & { topUp?: { code: string; addedCents: number; balanceCents: number; expiresOn: string } }) | null;

/**
 * Top up a voucher a customer already has (any signed-in account, like creating one): payment
 * is taken at the till. The expiry moves out to at least 3 years from today for the new money.
 */
export async function topUpGiftVoucher(_: TopUpState, formData: FormData): Promise<TopUpState> {
  await requireSignedIn();
  const code = String(formData.get("code") ?? "").trim().slice(0, 40);
  const cents = parseDollars(String(formData.get("amount") ?? ""));
  if (!code) return fail("Enter the voucher's code.");
  if (cents === null || cents < 100) return fail("Enter the amount to add, e.g. 50.");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("top_up_gift_voucher", { p_code: code, p_amount_cents: cents });
  if (error) return dbError(error);
  const r = data as { status: string; id?: string; code?: string; added_cents?: number; balance_cents?: number; expires_on?: string };
  if (r.status !== "topped_up") return fail(problem(r.status, code));
  refresh();
  return {
    ok: true,
    message: `Topped up ${r.code} with ${formatMoney(r.added_cents!)}. Take payment at the till.`,
    href: `/admin/gift-vouchers/${r.id}`,
    topUp: { code: r.code!, addedCents: r.added_cents!, balanceCents: r.balance_cents!, expiresOn: r.expires_on! },
  };
}

/** Block a lost or stolen voucher (admin): nothing can be spent or added until it's unblocked. */
export async function blockGiftVoucher(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 200);
  if (!reason) return fail("Give a reason, e.g. lost by the customer.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("block_gift_voucher", { p_gift_voucher_id: id, p_reason: reason });
  if (error) return dbError(error);
  refresh();
  return { ok: true, message: "Voucher blocked. Its balance is kept until it's unblocked." };
}

export async function unblockGiftVoucher(id: string): Promise<ActionState> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("unblock_gift_voucher", { p_gift_voucher_id: id });
  if (error) return dbError(error);
  refresh();
  return { ok: true, message: "Voucher unblocked. It can be used again." };
}

export async function spendGiftVoucher(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireSignedIn();
  const code = String(formData.get("code") ?? "");
  const cents = parseDollars(String(formData.get("amount") ?? ""));
  if (cents === null || cents < 1) return fail("Enter the amount for today's service, e.g. 35.");
  const note = String(formData.get("note") ?? "").slice(0, 200);
  const tillCents = Math.max(0, parseDollars(String(formData.get("till") ?? "")) ?? 0);

  const supabase = await createClient();
  const customer = await findCustomer(createAdminClient(), String(formData.get("phone") ?? ""), String(formData.get("customer_id") ?? ""));
  if (customer === "missing") return fail("No customer has that phone number.");

  const { data, error } = await supabase.rpc("spend_gift_voucher", {
    p_code: code,
    p_amount_cents: cents,
    p_customer_id: customer?.id,
    p_note: note || undefined,
  });
  if (error) return dbError(error);
  const r = data as Record<string, unknown>;
  if (r.status === "over_balance") {
    const left = formatMoney(r.balance_cents as number);
    return fail(`This voucher only has ${left} left. Enter ${left} or less and take the rest at the till.`);
  }
  if (r.status !== "spent") return fail(problem(r.status as string, code));

  refresh();
  return {
    ok: true,
    message:
      `Used ${formatMoney(r.spent_cents as number)} from ${r.code as string}. ${formatMoney(r.balance_cents as number)} left.` +
      // "Use the full balance" sends what's still owed, so the reminder comes with the confirmation.
      (tillCents > 0 ? ` Take ${formatMoney(tillCents)} at the till.` : ""),
  };
}

// ---------------------------------------------------------------------------
// Managing a voucher
// ---------------------------------------------------------------------------

export async function updateGiftVoucher(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await requireAdmin();
  const notes = text(500).safeParse(formData.get("notes") ?? "");
  if (!notes.success) return fail("Notes can be at most 500 characters.");

  const supabase = await createClient();
  // A blank phone unlinks the voucher (e.g. it was bought as a present).
  const customer = await findCustomer(supabase, String(formData.get("phone") ?? ""), "");
  if (customer === "missing") return fail("No customer has that phone number.");

  const update: { customer_id: string | null; notes: string | null; expires_on?: string } = {
    customer_id: customer?.id ?? null,
    notes: notes.data,
  };
  const expires = String(formData.get("expires_on") ?? "");
  if (staff.role === "admin" && /^\d{4}-\d{2}-\d{2}$/.test(expires)) update.expires_on = expires;

  const { error } = await supabase.from("gift_vouchers").update(update).eq("id", id);
  if (error) return dbError(error);
  refresh();
  return { ok: true, message: "Gift voucher saved." };
}

export async function adjustGiftVoucher(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await requireAdmin();
  if (staff.role !== "admin") return fail("Only an admin can adjust a gift voucher.");
  const cents = parseDollars(String(formData.get("amount") ?? ""));
  if (cents === null || cents === 0) return fail("Enter an amount, e.g. 10.");
  const note = String(formData.get("note") ?? "").trim();
  if (!note) return fail("Give a reason, e.g. Typo at the till.");
  const delta = formData.get("direction") === "remove" ? -cents : cents;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("adjust_gift_voucher", { p_gift_voucher_id: id, p_delta_cents: delta, p_note: note.slice(0, 200) });
  if (error) return dbError(error);
  refresh();
  return { ok: true, message: `Balance is now ${formatMoney(data as number)}.` };
}

/**
 * Delete several at once, e.g. a misprinted batch of blank cards. Like one at a time, only
 * vouchers nothing has been spent from (RLS); any others are kept and counted in the message.
 */
export async function deleteGiftVouchers(ids: string[]): Promise<ActionState> {
  const staff = await requireAdmin();
  if (staff.role !== "admin") return fail("Only an admin can delete gift vouchers.");
  const valid = (Array.isArray(ids) ? ids : []).filter((id) => typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id)).slice(0, 200);
  if (!valid.length) return fail("Choose the vouchers to delete.");
  const supabase = await createClient();
  const { data, error } = await supabase.from("gift_vouchers").delete().in("id", valid).select("id");
  if (error) return dbError(error);
  refresh();
  const deleted = data?.length ?? 0;
  const kept = valid.length - deleted;
  if (!deleted) return fail(kept === 1 ? "This voucher has been used, so it can't be deleted." : "These vouchers have been used, so they can't be deleted.");
  return {
    ok: true,
    message: `Deleted ${deleted} voucher${deleted === 1 ? "" : "s"}.${kept ? ` ${kept} ${kept === 1 ? "has" : "have"} been used, so ${kept === 1 ? "it was" : "they were"} kept.` : ""}`,
  };
}

export async function deleteGiftVoucher(id: string): Promise<ActionState> {
  const staff = await requireAdmin();
  if (staff.role !== "admin") return fail("Only an admin can delete a gift voucher.");
  const supabase = await createClient();
  // RLS only lets an admin delete a voucher nothing has been spent from.
  const { data, error } = await supabase.from("gift_vouchers").delete().eq("id", id).select("id");
  if (error) return dbError(error);
  if (!data?.length) return fail("Part of this voucher has been spent, so it can't be deleted.");
  return { ok: true, message: "Gift voucher deleted.", href: "/admin/gift-vouchers" };
}
