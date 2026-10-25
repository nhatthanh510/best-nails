import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/phone";

/**
 * The customer a front-desk form refers to, by id (on their page) or by a typed phone number.
 * null when neither was given; "missing" when one was given but matches nobody.
 */
export async function findCustomer(
  supabase: Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createAdminClient>,
  phone: string,
  customerId: string,
) {
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
