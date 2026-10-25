import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/safe-redirect";

// Where a "forgot password" email link lands: Supabase sends back a one-time code, which is
// swapped for a session here (the browser that asked holds the other half of the exchange).
// The session is marked as a recovery, so /account lets them set a new password without the old one.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeRedirectPath(searchParams.get("next") ?? "", "/account");
  if (code) {
    const { error } = await (await createClient()).auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }
  return NextResponse.redirect(new URL("/admin/login/forgot?expired=1", origin));
}
