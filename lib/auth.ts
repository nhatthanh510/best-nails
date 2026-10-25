import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

export type Staff = {
  id: string;
  displayName: string;
  role: Database["public"]["Enums"]["staff_role"];
  email: string;
  /** Signed in with a password an admin set (new account or reset): choose their own before anything else. */
  mustChangePassword: boolean;
  /** Signed in from a "forgot password" email link, so they can set a new one without the old one. */
  fromResetLink: boolean;
};

type Claims = { sub?: string; email?: string; app_metadata?: { temp_password?: boolean }; amr?: { method: string }[] };

/**
 * The signed-in account, or null. Verifies the JWT rather than trusting the cookie. Two roles:
 * an admin uses the admin pages and the kiosk; staff use only the kiosk. Cached for the request,
 * since the layout and every admin data read ask for it.
 */
export const getStaff = cache(async (): Promise<Staff | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims as Claims | undefined;
  const userId = claims?.sub;
  if (!userId) return null;

  const { data: staff } = await supabase
    .from("staff")
    .select("user_id, display_name, role, removed_at")
    .eq("user_id", userId)
    .maybeSingle();
  // A removed account counts as signed out straight away, even while its session lasts.
  if (!staff || staff.removed_at) return null;

  return {
    id: staff.user_id,
    displayName: staff.display_name,
    role: staff.role,
    email: claims.email ?? "",
    mustChangePassword: claims.app_metadata?.temp_password === true,
    fromResetLink: claims.amr?.some((a) => a.method === "recovery") ?? false,
  };
});

/**
 * Use at the top of every admin Server Action and admin data read. Signed-out visitors go to
 * the login page, and staff accounts (kiosk only) to the kiosk.
 */
export async function requireAdmin(): Promise<Staff> {
  const staff = await getStaff();
  if (!staff) redirect("/admin/login");
  if (staff.mustChangePassword) redirect("/account");
  if (staff.role !== "admin") redirect("/kiosk");
  return staff;
}

/**
 * For the few actions any account may take from the kiosk (selling and using gift vouchers):
 * signed-out visitors go to the login page; admins and staff both pass.
 */
export async function requireSignedIn(): Promise<Staff> {
  const staff = await getStaff();
  if (!staff) redirect("/admin/login");
  if (staff.mustChangePassword) redirect("/account");
  return staff;
}

/** Where an account lands after signing in. */
export function homeFor(role: Staff["role"]) {
  return role === "admin" ? "/admin" : "/kiosk";
}
