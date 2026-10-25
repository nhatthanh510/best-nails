import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

export type Staff = {
  id: string;
  displayName: string;
  role: Database["public"]["Enums"]["staff_role"];
};

/**
 * The signed-in account, or null. Verifies the JWT rather than trusting the cookie. Two roles:
 * an admin uses the admin pages and the kiosk; staff use only the kiosk.
 */
export async function getStaff(): Promise<Staff | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return null;

  const { data: staff } = await supabase
    .from("staff")
    .select("user_id, display_name, role")
    .eq("user_id", userId)
    .maybeSingle();
  if (!staff) return null;

  return { id: staff.user_id, displayName: staff.display_name, role: staff.role };
}

/**
 * Use at the top of every admin Server Action and admin data read. Signed-out visitors go to
 * the login page, and staff accounts (kiosk only) to the kiosk.
 */
export async function requireAdmin(): Promise<Staff> {
  const staff = await getStaff();
  if (!staff) redirect("/admin/login");
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
  return staff;
}

/** Where an account lands after signing in. */
export function homeFor(role: Staff["role"]) {
  return role === "admin" ? "/admin" : "/kiosk";
}
