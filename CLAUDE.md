# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

Best Nails loyalty app: an iPad **kiosk** (customers type a phone number on a numpad to check in and redeem) and a staff **admin**. The shop is in Hobart: Australian phone numbers, `Australia/Hobart` timezone, `en-AU` formatting.

**Program rules:** 1 point per check-in, 10 points = 10% off (a `promotions` row; the type enum only allows `reward`), and a birthday 10% off once per birthday within `birthday_window_days` (7). There are no multipliers, bonus-points promotions or sign-up bonus; those were removed on purpose, so don't reintroduce them. **Customer tiers** (New / Regular / VIP) are derived from `visit_count` against `settings.tier_regular_visits` / `tier_vip_visits` (10 / 20) in `lib/tiers.ts`. They are not stored, and are admin-only (not shown on the kiosk). **Vouchers** are printed discount vouchers (% or $ off), redeemed only at the front desk in the admin. A `vouchers` row is the offer; `voucher_codes` holds either one shared code with `max_uses` (e.g. BN12345 × 100) or a batch of single-use codes. Every use is a `voucher_redemptions` row. The system only tracks use; staff apply the discount at the till. The design source of truth is the Claude Design canvas https://claude.ai/artifact/XJjpwCW4RTdw4cEqwgs45Y; update it when the UI changes meaningfully.

## Commands

Local Supabase runs in Docker, so Docker Desktop must be running.

```bash
npx supabase start        # Postgres + Auth; applies supabase/migrations and supabase/seed.sql
npm run dev               # http://localhost:3000 (/kiosk, /admin)
npm run typecheck && npm run lint && npm run build
npm test                                     # Vitest (lib/**/*.test.ts)
npx vitest run lib/phone.test.ts -t "masks"  # single file / single test
npm run test:db           # pgTAP: supabase/tests/loyalty.test.sql (update `select plan(N)` when adding asserts)
npm run db:reset          # re-run all migrations + seed (also unpairs kiosks and logs staff out)
npx supabase migration up && npm run db:types   # after adding a migration
```

- **Seed logins (local only):** `owner@bestnails.test` / `staff@bestnails.test`, password `bestnails-dev`.
- **Kiosk pairing:** after a reset, open `/kiosk/setup` while signed in to pair the browser as a kiosk.
- **Test customers:** listed in the header comment of `supabase/seed.sql`. Birthday cases are generated relative to the current date.

## Next.js 16 specifics that bite here

- **`cacheComponents` is on.** Anything that reads cookies, the session, `searchParams`/`params` or the DB must sit inside `<Suspense>`. Pages are sync shells that render an async child component. `usePathname()` in a client component also needs a Suspense boundary (see `components/admin/sidebar.tsx` → `nav-links.tsx`).
- **Supabase server code calls `await connection()` first.** `createClient()` and `getKioskDevice()` do this because auth checks read the clock, and `Date.now()` during prerender is a build error.
- **Middleware is `proxy.ts`.** It only refreshes the Supabase session and redirects signed-out `/admin/*` visitors. It's an optimistic check; real authorization happens per action and per read.
- **Mutations refresh the page with `refresh()` from `next/cache`.** To show a message before navigating, actions return `{ ok, message, href }` and the client calls `router.push` (see `createCustomer` and `components/admin/customer-form.tsx`).

## Architecture

**The database owns the points logic** (`supabase/migrations/`). All point changes go through security-definer SQL functions: `_award_check_in`, `kiosk_check_in`, `adjust_points`, `redeem_reward`, `kiosk_redeem`, `void_check_in`, plus the birthday functions `_birthday_status` / `_redeem_birthday` / `kiosk_redeem_birthday` / `redeem_birthday`.
- **Ledger:** `point_transactions` is append-only and ordered by the `seq` identity, not `created_at`, because rows written in one transaction share a timestamp.
- **Cached totals:** `customers.points_balance`, `lifetime_points`, `visit_count` and `last_visit_at` are protected by the `guard_customer_points` trigger. Only code that sets `best_nails.ledger_write = 'on'` (the functions, and the seed) can change them. Never update these columns directly from the app.
- **Concurrency:** check-ins and redemptions lock the customer row (`for update`), so double taps can't double-count.
- **Kiosk redemption** requires a check-in within 12 hours (`_checked_in_recently`).
- **Vouchers:** codes are normalised to upper-case alphanumerics (`normalize_voucher_code`). `voucher_codes.uses` only changes through `redeem_voucher` / `void_voucher_redemption`, which lock the code row; RLS gives staff no UPDATE on codes. `check_voucher` is the read-only preview. The admin list reads totals from the `voucher_stats` view.
- **Birthdays** are stored as month/day. 29 Feb counts as 28 Feb in other years (`lib/birthday.ts` mirrors this). `birthday_redemptions` is unique per `(customer_id, birthday_year)`.
- **Shop timezone:** "today" and month/year boundaries come from `settings.timezone` via the `shop_day_start(days_ago)` RPC and `shopDate()` in `lib/admin-data.ts`. Never use the server's local `new Date().getMonth()` or similar.
- **Function privileges** are revoked by default. Each new function needs an explicit `grant execute` (`authenticated` for staff functions, which call `assert_staff()`; `service_role` for kiosk functions).

**Two access paths, deliberately different:**
- **Admin** (`app/admin/`, `lib/admin-data.ts`) uses the user-scoped client `lib/supabase/server.ts`, so RLS applies. Staff are users with a row in `public.staff` (`owner` or `staff`; some actions are owner-only). Every read and Server Action starts with `requireStaff()` (`lib/auth.ts`).
- **Kiosk** (`app/kiosk/actions.ts`) never queries Supabase from the browser. Its Server Actions first call `guard()`, which checks the paired-device httpOnly cookie (`lib/kiosk-device.ts`, which stores only a SHA-256 hash) and rate-limits (in-memory). Only then do they use the service-role client `lib/supabase/admin.ts`. Responses carry only first name, masked phone, points, visits and birthday eligibility, because they reach a public screen. Anything exported from a `"use server"` file is a public endpoint, so server-only helpers live in `lib/` (e.g. `lib/kiosk-content.ts`).

**Phone numbers** (`lib/phone.ts`):
- **Storage:** stored as `+<digits>`. An Australian local number loses its leading 0 and becomes `+61…`.
- **Non-standard numbers are accepted, never blocked.** `normalizePhone()` returns `{ e164, standard }` and the UI warns when `standard` is false.
- **Length:** 8–12 local digits, at most 15 in total (the DB check enforces this too).
- **Client-side formatting:** `lib/phone-mask.ts` (`fillPhoneMask`, `looksStandard`) is kept free of libphonenumber so the kiosk bundle stays small.
- **Admin search:** a search for a local number like `0412` matches stored `61412…`.

**Kiosk UI:**
- **State machine:** `components/kiosk/kiosk-app.tsx` drives the screens in `screens.tsx` (enter → found / signup → success / already → redeemed / error).
- **Idle timeout:** clears the number and calls `router.refresh()` to pick up admin changes.
- **Layout:** sized for landscape iPad (1180×820) with a `short:` variant (`@custom-variant short` in `app/globals.css`) for screens ≤780px tall.

**Styling:**
- **Theme tokens** live in `app/globals.css`. The admin uses shadcn variables, retuned to the brand. The kiosk uses `--color-kiosk-*`. Status colors are `success`, `info` and `warning`.
- **Controls** follow 44px touch targets (`components/ui/button.tsx` and `input.tsx` were resized).
- **No `window.confirm`:** use `ConfirmButton` (`components/admin/action-button.tsx`) for destructive actions.

**Migrations:** never edit an applied migration; add a new timestamped file. After changing the schema, regenerate `lib/database.types.ts` (it's generated, so don't hand-edit it). Keep `supabase/seed.sql` and `supabase/tests/loyalty.test.sql` working, since both are run against every migration change.
