import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

export type Staff = {
  id: string;
  displayName: string;
  role: Database["public"]["Enums"]["staff_role"];
};

/** The signed-in staff member, or null. Verifies the JWT rather than trusting the cookie. */
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

/** Use at the top of every admin Server Action and admin data read. */
export async function requireStaff(): Promise<Staff> {
  const staff = await getStaff();
  if (!staff) redirect("/admin/login");
  return staff;
}
