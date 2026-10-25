"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { PostgrestError } from "@supabase/supabase-js";
import { requireAdmin, requireSignedIn } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { findCustomer } from "@/lib/customer-lookup";
import { formatMoney, GIFT_VOUCHER_PROBLEMS, looksMistyped, parseDollars } from "@/lib/gift-vouchers";
import type { ActionState } from "./actions";

function fail(message: string): ActionState {
  return { ok: false, message };
}

function dbError(error: PostgrestError): ActionState {
  if (error.code === "42501") return fail("You don't have permission to do that.");
  if (["22023", "P0002", "23514"].includes(error.code)) {
    if (error.code === "23514") return fail("Gift vouchers must stay valid for at least 3 years from the sale.");
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

export async function sellGiftVoucher(_: ActionState, formData: FormData): Promise<ActionState> {
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
  const r = data as { id: string; code: string };
  return {
    ok: true,
    message: `Sold ${r.code} for ${formatMoney(cents)}. Take payment at the till.`,
    href: `/admin/gift-vouchers/${r.id}`,
  };
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

export async function spendGiftVoucher(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireSignedIn();
  const code = String(formData.get("code") ?? "");
  const cents = parseDollars(String(formData.get("amount") ?? ""));
  if (cents === null || cents < 1) return fail("Enter the amount for today's service, e.g. 35.");
  const note = String(formData.get("note") ?? "").slice(0, 200);

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
    message: `Spent ${formatMoney(r.spent_cents as number)} from ${r.code as string}. ${formatMoney(r.balance_cents as number)} left.`,
  };
}

export async function voidGiftVoucherSpend(transactionId: string): Promise<ActionState> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("void_gift_voucher_spend", { p_transaction_id: transactionId });
  if (error) return dbError(error);
  refresh();
  return { ok: true, message: `Spend undone. The balance is back to ${formatMoney(data as number)}.` };
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
