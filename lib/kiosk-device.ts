import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const COOKIE = "bn_kiosk";
const ONE_YEAR = 60 * 60 * 24 * 365;
// "Last used" in Settings only needs to be roughly right, so don't write it on every request.
const SEEN_EVERY_MS = 5 * 60 * 1000;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** Creates a paired device and stores its token in an httpOnly cookie on this browser. */
export async function pairThisDevice(name: string, pairedBy: string) {
  const token = randomBytes(32).toString("base64url");
  const { error } = await createAdminClient()
    .from("kiosk_devices")
    .insert({ name, token_hash: hashToken(token), paired_by: pairedBy });
  if (error) throw error;

  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: ONE_YEAR,
  });
}

/** Returns the paired, non-revoked device for this request, or null. */
export async function getKioskDevice(): Promise<{ id: string; name: string } | null> {
  await connection();
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("kiosk_devices")
    .select("id, name, last_seen_at")
    .eq("token_hash", hashToken(token))
    .is("revoked_at", null)
    .maybeSingle();
  if (!data) return null;

  if (!data.last_seen_at || Date.now() - new Date(data.last_seen_at).getTime() > SEEN_EVERY_MS) {
    await supabase.from("kiosk_devices").update({ last_seen_at: new Date().toISOString() }).eq("id", data.id);
  }
  return { id: data.id, name: data.name };
}
