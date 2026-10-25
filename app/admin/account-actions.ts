"use server";

import { headers } from "next/headers";
import { refresh } from "next/cache";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getStaff, homeFor, requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionState } from "@/app/admin/actions";
import { MIN_PASSWORD } from "@/lib/accounts";

// Accounts live in Supabase Auth (email and password) plus a `staff` row (name and role).
// Creating one, resetting a password or banning a sign-in needs the service key, so every
// admin action here starts with requireAdmin(). The database keeps at least one admin
// (keep_an_admin trigger), whatever the app does.

// Supabase Auth has no "disable" switch; a ban this long is how its docs suggest one.
const BANNED = "876000h";

const fail = (message: string): ActionState => ({ ok: false, message });

const password = z.string().min(MIN_PASSWORD, `Use at least ${MIN_PASSWORD} characters.`).max(72, "Use at most 72 characters.");
const accountSchema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(60, "Use a shorter name."),
  role: z.enum(["admin", "staff"]),
});

function firstIssue(error: z.ZodError) {
  return fail(error.issues[0]?.message ?? "Check the form and try again.");
}

/** The keep_an_admin trigger's error, in words; anything else is logged. */
function accountError(error: { code?: string; message: string }): ActionState {
  if (error.code === "22023") return fail("The shop needs at least one admin. Make someone else an admin first.");
  console.error(error);
  return fail("Something went wrong. Please try again.");
}

export async function createAccount(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = accountSchema
    .extend({ email: z.string().trim().toLowerCase().email("Enter a valid email."), password })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return firstIssue(parsed.error);
  const { name, role, email } = parsed.data;

  const admin = createAdminClient();
  // temp_password sends them to choose their own password the first time they sign in.
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: parsed.data.password,
    email_confirm: true,
    app_metadata: { temp_password: true },
  });
  if (error) {
    if (error.code === "email_exists" || error.status === 422) return fail("An account with this email already exists.");
    if (error.code === "weak_password") return fail("Choose a harder password to guess.");
    return accountError(error);
  }
  const { error: rowError } = await admin.from("staff").insert({ user_id: data.user.id, display_name: name, role });
  if (rowError) {
    await admin.auth.admin.deleteUser(data.user.id);
    return accountError(rowError);
  }
  refresh();
  return { ok: true, message: `${name} can sign in now. Give them the temporary password; they'll choose their own the first time.` };
}

export async function updateAccount(userId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const me = await requireAdmin();
  const parsed = accountSchema.safeParse({ name: formData.get("name"), role: formData.get("role") ?? (userId === me.id ? me.role : "") });
  if (!parsed.success) return firstIssue(parsed.error);
  // Your own role can't change here: an admin who made themselves staff would lock themselves out.
  const role = userId === me.id ? me.role : parsed.data.role;
  const { error } = await createAdminClient().from("staff").update({ display_name: parsed.data.name, role }).eq("user_id", userId);
  if (error) return accountError(error);
  refresh();
  return { ok: true, message: "Account saved." };
}

export async function resetAccountPassword(userId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const me = await requireAdmin();
  if (userId === me.id) return fail("Change your own password from Your account.");
  const parsed = password.safeParse(formData.get("password"));
  if (!parsed.success) return firstIssue(parsed.error);
  const { error } = await createAdminClient().auth.admin.updateUserById(userId, {
    password: parsed.data,
    app_metadata: { temp_password: true },
  });
  if (error) return accountError(error);
  refresh();
  return { ok: true, message: "Password reset. Give them the new one; they'll choose their own when they next sign in." };
}

/** Stops the account signing in but keeps its name on the history it wrote. */
export async function removeAccount(userId: string): Promise<ActionState> {
  const me = await requireAdmin();
  if (userId === me.id) return fail("You can't remove your own account.");
  const admin = createAdminClient();
  const { error } = await admin.from("staff").update({ removed_at: new Date().toISOString() }).eq("user_id", userId);
  if (error) return accountError(error);
  const { error: banError } = await admin.auth.admin.updateUserById(userId, { ban_duration: BANNED });
  if (banError) return accountError(banError);
  refresh();
  return { ok: true, message: "Account removed. It can't sign in any more." };
}

/**
 * Deletes a removed account for good: its sign-in goes, its staff row with it (cascade), and
 * the history it wrote keeps the entries but loses the name (shown as "Staff"). Only removed
 * accounts, so it's always two deliberate steps and never someone signed in right now.
 */
export async function deleteAccount(userId: string): Promise<ActionState> {
  const me = await requireAdmin();
  if (userId === me.id) return fail("You can't delete your own account.");
  const admin = createAdminClient();
  const { data: row, error: readError } = await admin.from("staff").select("display_name, removed_at").eq("user_id", userId).maybeSingle();
  if (readError) return accountError(readError);
  if (!row) return fail("That account is already gone.");
  if (!row.removed_at) return fail("Remove the account first, then delete it.");
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return accountError(error);
  refresh();
  return { ok: true, message: `${row.display_name}'s account is deleted.` };
}

export async function restoreAccount(userId: string): Promise<ActionState> {
  await requireAdmin();
  const admin = createAdminClient();
  const { error: banError } = await admin.auth.admin.updateUserById(userId, { ban_duration: "none" });
  if (banError) return accountError(banError);
  const { error } = await admin.from("staff").update({ removed_at: null }).eq("user_id", userId);
  if (error) return accountError(error);
  refresh();
  return { ok: true, message: "Account restored. It can sign in again with its last password." };
}

// ---------------------------------------------------------------------------
// Your own password (any account, admin or staff)
// ---------------------------------------------------------------------------

export async function changeOwnPassword(_: ActionState, formData: FormData): Promise<ActionState> {
  // Not requireSignedIn(): it would send someone on a temporary password back to this same form.
  const me = await getStaff();
  if (!me) return fail("Your session has ended. Sign in again.");
  const parsed = password.safeParse(formData.get("password"));
  if (!parsed.success) return firstIssue(parsed.error);
  if (parsed.data !== formData.get("confirm")) return fail("The two new passwords don't match.");

  // Someone who knows the current password must type it, so a signed-in iPad left on the
  // counter can't be used to take over the account. A temporary password or a reset link has
  // already proved who they are.
  if (!me.mustChangePassword && !me.fromResetLink) {
    const current = String(formData.get("current") ?? "");
    const check = createPlainClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await check.auth.signInWithPassword({ email: me.email, password: current });
    if (error) return fail("Your current password isn't right.");
    await check.auth.signOut({ scope: "local" });
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  if (error) {
    if (error.code === "same_password") return fail("Choose a password different from the one you have.");
    if (error.code === "weak_password") return fail("Choose a harder password to guess.");
    return accountError(error);
  }
  if (me.mustChangePassword) {
    await createAdminClient().auth.admin.updateUserById(me.id, { app_metadata: { temp_password: false } });
  }
  // Sign in again with the new password: a fresh session carries the cleared flag, and one that
  // started from a reset link stops counting as one (it would otherwise skip "current password"
  // for as long as it lasted).
  await supabase.auth.signInWithPassword({ email: me.email, password: parsed.data });
  return { ok: true, message: "Password changed.", href: homeFor(me.role) };
}

/** "Forgot password": emails a link that signs them in to choose a new one. */
export async function requestPasswordReset(_: ActionState, formData: FormData): Promise<ActionState> {
  const email = z.string().trim().toLowerCase().email().safeParse(formData.get("email"));
  if (!email.success) return fail("Enter the email you sign in with.");
  const origin = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { error } = await (await createClient()).auth.resetPasswordForEmail(email.data, {
    redirectTo: `${origin}/auth/callback?next=/account`,
  });
  if (error?.status === 429) return fail("Too many reset emails. Wait a while and try again.");
  if (error) console.error(error);
  // The same answer whether or not the email has an account, so the form can't be used to find out.
  return { ok: true, message: "If that email has an account, a reset link is on its way. Check your inbox." };
}
