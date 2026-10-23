"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { PostgrestError } from "@supabase/supabase-js";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { normalizePhone } from "@/lib/phone";
import { formatDiscount, VOUCHER_PROBLEMS } from "@/lib/vouchers";
import type { ActionState } from "./actions";

function fail(message: string): ActionState {
  return { ok: false, message };
}

function dbError(error: PostgrestError): ActionState {
  if (error.code === "42501") return fail("You don't have permission to do that.");
  if (error.code === "22023" || error.code === "P0002") return fail(error.message.charAt(0).toUpperCase() + error.message.slice(1) + ".");
  console.error(error);
  return fail("Something went wrong. Please try again.");
}

const dateOrNull = z.string().transform((v) => v || null);

const voucherFields = {
  name: z.string().trim().min(1, "Give the voucher a name, e.g. Spring flyer 15% off.").max(80),
  once_per_customer: z.boolean(),
  starts_on: dateOrNull,
  expires_on: dateOrNull,
  notes: z
    .string()
    .trim()
    .max(500)
    .transform((v) => v || null),
};

const createSchema = z
  .object({
    ...voucherFields,
    discount_type: z.enum(["percent", "amount"]),
    discount_value: z.coerce.number().positive("Enter a discount above zero."),
    mode: z.enum(["shared", "batch"]),
    code: z.string().trim(),
    max_uses: z.coerce.number().int().min(1, "Allow at least 1 use.").max(100000),
    prefix: z.string().trim().max(6, "The prefix can be at most 6 letters."),
    count: z.coerce.number().int().min(1, "Make at least 1 code.").max(5000, "Make at most 5000 codes at a time."),
  })
  .refine((v) => v.discount_type !== "percent" || v.discount_value <= 100, { message: "A percentage can't be over 100." })
  .refine((v) => !v.starts_on || !v.expires_on || v.expires_on >= v.starts_on, { message: "The expiry date is before the start date." })
  .refine((v) => v.mode !== "shared" || v.code.replace(/[^A-Za-z0-9]/g, "").length >= 3, { message: "Enter the voucher code, e.g. BN12345." });

function readCommon(formData: FormData) {
  return {
    name: formData.get("name") ?? "",
    once_per_customer: formData.get("once_per_customer") === "on",
    starts_on: formData.get("starts_on") ?? "",
    expires_on: formData.get("expires_on") ?? "",
    notes: formData.get("notes") ?? "",
  };
}

export async function createVoucher(_: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await requireStaff();
  const parsed = createSchema.safeParse({
    ...readCommon(formData),
    discount_type: formData.get("discount_type"),
    discount_value: formData.get("discount_value"),
    mode: formData.get("mode"),
    code: formData.get("code") ?? "",
    max_uses: formData.get("max_uses") || 1,
    prefix: formData.get("prefix") ?? "",
    count: formData.get("count") || 1,
  });
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { mode, code, max_uses, prefix, count, ...voucher } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vouchers")
    .insert({ ...voucher, created_by: staff.id })
    .select("id")
    .single();
  if (error) return dbError(error);

  const codes =
    mode === "shared"
      ? await supabase.rpc("add_voucher_code", { p_voucher_id: data.id, p_code: code, p_max_uses: max_uses })
      : await supabase.rpc("generate_voucher_codes", { p_voucher_id: data.id, p_prefix: prefix, p_count: count });
  if (codes.error) {
    // Don't leave a voucher with no codes behind.
    await supabase.from("vouchers").delete().eq("id", data.id);
    return dbError(codes.error);
  }

  return {
    ok: true,
    message: mode === "shared" ? `Voucher created with code ${codes.data}.` : `Voucher created with ${codes.data} codes.`,
    href: `/admin/vouchers/${data.id}`,
  };
}

const updateSchema = z
  .object({ ...voucherFields, is_active: z.boolean() })
  .refine((v) => !v.starts_on || !v.expires_on || v.expires_on >= v.starts_on, { message: "The expiry date is before the start date." });

export async function updateVoucher(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff();
  const parsed = updateSchema.safeParse({ ...readCommon(formData), is_active: formData.get("is_active") === "on" });
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { error } = await supabase.from("vouchers").update(parsed.data).eq("id", id);
  if (error) return dbError(error);
  refresh();
  return { ok: true, message: "Voucher saved." };
}

const addCodesSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("shared"), code: z.string().trim().min(3), max_uses: z.coerce.number().int().min(1).max(100000) }),
  z.object({ mode: z.literal("batch"), prefix: z.string().trim().max(6), count: z.coerce.number().int().min(1).max(5000) }),
]);

export async function addVoucherCodes(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff();
  const parsed = addCodesSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Check the code details and try again.");

  const supabase = await createClient();
  const result =
    parsed.data.mode === "shared"
      ? await supabase.rpc("add_voucher_code", { p_voucher_id: id, p_code: parsed.data.code, p_max_uses: parsed.data.max_uses })
      : await supabase.rpc("generate_voucher_codes", { p_voucher_id: id, p_prefix: parsed.data.prefix, p_count: parsed.data.count });
  if (result.error) return dbError(result.error);
  refresh();
  return { ok: true, message: parsed.data.mode === "shared" ? `Code ${result.data} added.` : `${result.data} codes added.` };
}

export async function deleteVoucher(id: string): Promise<ActionState> {
  await requireStaff();
  const supabase = await createClient();
  const { count } = await supabase
    .from("voucher_redemptions")
    .select("id, voucher_codes!inner(voucher_id)", { count: "exact", head: true })
    .eq("voucher_codes.voucher_id", id);
  if (count) return fail("This voucher has been used, so it can't be deleted. Pause it instead.");
  const { error } = await supabase.from("vouchers").delete().eq("id", id);
  if (error) return dbError(error);
  return { ok: true, message: "Voucher deleted.", href: "/admin/vouchers" };
}

// ---------------------------------------------------------------------------
// Front desk
// ---------------------------------------------------------------------------

export type VoucherCheck =
  | {
      ok: true;
      code: string;
      name: string;
      discount: string;
      usesLeft: number;
      maxUses: number;
      expiresOn: string | null;
      customerName: string | null;
    }
  | { ok: false; message: string };

async function findCustomer(supabase: Awaited<ReturnType<typeof createClient>>, phone: string, customerId: string) {
  if (customerId) {
    const { data } = await supabase.from("customers").select("id, first_name, last_name").eq("id", customerId).maybeSingle();
    return data ?? "missing";
  }
  if (!phone.trim()) return null;
  const e164 = normalizePhone(phone)?.e164;
  if (!e164) return "missing";
  const { data } = await supabase.from("customers").select("id, first_name, last_name").eq("phone", e164).maybeSingle();
  return data ?? "missing";
}

/** Look a code up before redeeming, so staff can tell the customer what it's worth. */
export async function checkVoucherCode(code: string, phone = "", customerId = ""): Promise<VoucherCheck> {
  await requireStaff();
  const supabase = await createClient();
  const customer = await findCustomer(supabase, phone, customerId);
  if (customer === "missing") return { ok: false, message: "No customer has that phone number." };

  const { data, error } = await supabase.rpc("check_voucher", { p_code: code, p_customer_id: customer?.id });
  if (error || !data) return { ok: false, message: "Couldn't check the voucher. Please try again." };
  const r = data as Record<string, unknown>;
  if (r.status !== "valid") return { ok: false, message: VOUCHER_PROBLEMS[r.status as string] ?? "This voucher can't be used." };

  return {
    ok: true,
    code: r.code as string,
    name: r.name as string,
    discount: formatDiscount(r.discount_type as "percent" | "amount", Number(r.discount_value)),
    usesLeft: (r.max_uses as number) - (r.uses as number),
    maxUses: r.max_uses as number,
    expiresOn: (r.expires_on as string) ?? null,
    customerName: customer ? [customer.first_name, customer.last_name].filter(Boolean).join(" ") : null,
  };
}

export async function redeemVoucherCode(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff();
  const code = String(formData.get("code") ?? "");
  const phone = String(formData.get("phone") ?? "");
  const customerId = String(formData.get("customer_id") ?? "");
  const note = String(formData.get("note") ?? "").slice(0, 200);

  const supabase = await createClient();
  const customer = await findCustomer(supabase, phone, customerId);
  if (customer === "missing") return fail("No customer has that phone number.");

  const { data, error } = await supabase.rpc("redeem_voucher", { p_code: code, p_customer_id: customer?.id, p_note: note });
  if (error) return dbError(error);
  const r = data as Record<string, unknown>;
  if (r.status !== "redeemed") return fail(VOUCHER_PROBLEMS[r.status as string] ?? "This voucher can't be used.");

  refresh();
  const discount = formatDiscount(r.discount_type as "percent" | "amount", Number(r.discount_value));
  return { ok: true, message: `Redeemed ${r.code}: ${discount}. Apply it at the till.` };
}

export async function voidVoucherRedemption(id: string): Promise<ActionState> {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.rpc("void_voucher_redemption", { p_redemption_id: id });
  if (error) return dbError(error);
  refresh();
  return { ok: true, message: "Redemption undone. The code can be used again." };
}
