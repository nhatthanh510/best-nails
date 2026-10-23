# Best Nails Rewards

Loyalty check-in for Best Nails: an iPad **kiosk** where customers type their phone number on a numpad to check in, and a staff **admin** for customers, check-ins and rewards.

**The program:** every check-in earns 1 point · 10 points = 10% off · a birthday 10% off, once a year within 7 days of the birthday. Customers can redeem either at the kiosk after checking in, or staff can redeem them in the admin.

Design: [Claude Design canvas](https://claude.ai/artifact/XJjpwCW4RTdw4cEqwgs45Y) (kiosk screens, admin pages, design tokens).

## Stack

Next.js 16 (App Router, Cache Components, Server Actions) · React 19 · Tailwind CSS v4 + shadcn/ui · Supabase (Postgres, Auth, RLS) · Zod · Vitest + pgTAP

## Run it locally

Requires Node 20+, Docker Desktop (running) for local Supabase.

```bash
npm install
npx supabase start            # Postgres + Auth in Docker; applies migrations and seed
npx supabase status -o env    # copy API_URL / PUBLISHABLE_KEY / SECRET_KEY into .env.local (see .env.example)
npm run dev
```

- Admin: http://localhost:3000/admin — seed logins `owner@bestnails.test` / `staff@bestnails.test`, password `bestnails-dev` (local only)
- Kiosk: http://localhost:3000/kiosk — the first time, a staff member opens **/kiosk/setup** on the iPad to pair it
- Shop timezone is Australia/Hobart. Seed customers to try (see `supabase/seed.sql`): Charlotte 0412 345 678 (9 points: check in → 10% off), Ava 0434 567 890 (10% off ready), Grace 0445 678 901 (birthday in 2 days), Lily 0456 789 012 (birthday discount used), Mia 0423 456 789 (already checked in today)

## How it works

| Piece | Where |
|---|---|
| Schema, RLS, check-in / redeem / adjust / undo functions | `supabase/migrations/` |
| Points rules | `_award_check_in`: `points_per_visit` (1) per check-in, one per cooldown window |
| Redeeming | `kiosk_redeem` / `redeem_reward` spend points on a reward; `kiosk_redeem_birthday` / `redeem_birthday` use the birthday discount (`_birthday_status` decides eligibility). Kiosk redemption needs a check-in in the last 12 hours |
| Phone numbers | `lib/phone.ts`: Australian numbers are stored as +61…; non-standard numbers are accepted with a warning, never blocked |
| Kiosk Server Actions (paired device + rate limit, minimal data out) | `app/kiosk/actions.ts`, `lib/kiosk-device.ts` |
| Kiosk UI (numpad, screens, idle reset) | `components/kiosk/` |
| Admin Server Actions (staff session re-checked, RLS client) | `app/admin/actions.ts` |
| Admin reads | `lib/admin-data.ts` |

Points are an append-only ledger (`point_transactions`); `customers.points_balance` is a cached total that a trigger only lets the ledger functions change. Concurrent check-ins for the same customer serialise on a row lock, so a double tap can't count twice.

The kiosk never talks to Supabase from the browser. Its Server Actions use the service key only after checking that the request carries a paired device's httpOnly cookie (only a SHA-256 hash is stored), and they return just a first name, masked phone, points and visit count.

## Tests

```bash
npm test          # unit tests (phone rules, promotion scheduling)
npm run test:db   # pgTAP: check-in rules, cooldown, permissions, redeem/adjust/undo, ledger consistency
npm run typecheck && npm run lint && npm run build
```

## Common tasks

- Change the schema: add a file under `supabase/migrations/`, then `npx supabase migration up && npm run db:types`
- Start over with fresh seed data: `npm run db:reset` (this also unpairs kiosks)
- Add a staff member: create the user in Supabase Auth, then insert a row into `public.staff` (`role` = `owner` or `staff`)

## Deploying

Create a Supabase project and run `npx supabase link` then `npx supabase db push`. Don't run `seed.sql` in production. Deploy the app to Vercel with the three env vars. On the iPad, open `/kiosk/setup`, pair it, then "Add to Home Screen" and turn on Guided Access.

Known limits: the kiosk rate limiter lives in memory (per server instance), and staff invites are done from the Supabase dashboard.
