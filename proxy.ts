import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Refreshes the Supabase session cookie and sends signed-out visitors to the login page.
// This is only an optimistic check: every admin page and action calls requireAdmin() itself.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const { pathname } = request.nextUrl;

  // /admin/login and its "forgot password" page are for signed-out visitors; /account needs a sign-in.
  const needsSignIn = (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login")) || pathname === "/account";
  if (!signedIn && needsSignIn) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = pathname === "/admin" ? "" : `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  return response;
}

// Link prefetches skip the proxy: they only fetch a page's shell (skeletons, no data), and
// checking the session for each of the sidebar's links slowed the first admin load. The
// navigation itself still comes through here. (Next reads this config at build time, so it
// has to stay a plain literal.)
export const config = {
  // The kiosk needs a signed-in account too, so its session is kept fresh here as well.
  matcher: [
    {
      source: "/admin/:path*",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
    {
      source: "/kiosk",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
    {
      source: "/account",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
