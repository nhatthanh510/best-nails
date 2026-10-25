# Best Nails Rewards

Loyalty check-in for Best Nails: an iPad **kiosk** where customers type their phone number on a numpad to check in, and a staff **admin** for customers, check-ins and rewards.

**The program:** every check-in earns 1 point · 10 points = 10% off · a birthday 10% off, once a year within 7 days of the birthday. Customers can redeem either at the kiosk after checking in, or staff can redeem them in the admin.

**Gift vouchers:** a customer buys prepaid credit (e.g. $100) and spends it over one or more visits. Staff sell one under **Gift vouchers**: the app generates a code like `BN48207138`: the business prefix and 8 digits, the last one a check digit that catches most typos (Generate makes a new one), or staff type the number printed on a voucher card. `BN` is the business prefix, which an admin can change in Settings if they run several businesses. At each visit staff enter today's service amount. If it costs more than what's left, the app uses the rest and shows how much to take at the till. A spend can be undone. Vouchers are valid for 3 years (the legal minimum in Australia), and the dashboard shows the unspent credit.


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

- Admin: http://localhost:3000/admin — seed login `owner@bestnails.test` / `bestnails-dev` (admin, local only). Add staff accounts in Settings → Accounts
- Kiosk: http://localhost:3000/kiosk — works while any account is signed in; the start screen's header has **Gift voucher** (sell or use one) and **Sign out**, plus **Admin** for admin accounts
- Shop timezone is Australia/Hobart. The seed has no customers, vouchers or rewards: add a reward on **Rewards**, then sign customers up on the kiosk.

## How it works

| Piece | Where |
|---|---|
| Schema, RLS, check-in / redeem / adjust / undo functions | `supabase/migrations/` |
| Points rules | `_award_check_in`: 1 point per check-in, one per shop day (in `settings.timezone`) |
| Redeeming | `kiosk_redeem` / `redeem_reward` spend points on a reward; `kiosk_redeem_birthday` / `redeem_birthday` use the birthday discount (`_birthday_status` decides eligibility). Kiosk redemption needs a check-in in the last 12 hours |
| Phone numbers | `lib/phone.ts`: Australian numbers are stored as +61…; non-standard numbers are accepted with a warning, never blocked |
| Kiosk Server Actions (signed-in account, minimal data out) | `app/kiosk/actions.ts` |
| Kiosk UI (numpad, screens, idle reset) | `components/kiosk/` |
| Admin Server Actions (staff session re-checked, RLS client) | `app/admin/actions.ts` |
| Admin reads | `lib/admin-data.ts` |

Points are an append-only ledger (`point_transactions`); `customers.points_balance` is a cached total that a trigger only lets the ledger functions change. Concurrent check-ins for the same customer serialise on a row lock, so a double tap can't count twice.

The kiosk never talks to Supabase from the browser. Its Server Actions use the service key only after checking that an account is signed in on the device, and they return just a first name, masked phone, points and visit count.

## Tests

```bash
npm test          # unit tests (phone rules, promotion scheduling)
npm run test:db   # pgTAP: check-in rules, one check-in a day, permissions, redeem/adjust/undo, ledger consistency
npm run typecheck && npm run lint && npm run build
```

## Common tasks

- Change the schema: add a file under `supabase/migrations/`, then `npx supabase migration up && npm run db:types`
- Start over from an empty database (just the admin login): `npm run db:reset` (this also signs everyone out)
- Add a staff member: Settings → Accounts → Add account (Admin for the admin and kiosk, Staff for the kiosk only), with a temporary password they change on first sign-in

## Deploying

Create a Supabase project and run `npx supabase link` then `npx supabase db push`. Don't run `seed.sql` in production. Create the first admin once: add a user in the Supabase dashboard (Authentication → Users, with "Auto confirm"), then in the SQL editor run `insert into public.staff (user_id, display_name, role) select id, 'Your name', 'admin' from auth.users where email = 'you@example.com';`. Everyone after that is added in Settings → Accounts. Deploy the app to Vercel with the three env vars. On the iPad, sign in, open `/kiosk`, "Add to Home Screen" (no address bar), and turn on Guided Access while a customer has it.

Known limits: "Forgot password?" emails need your own email (SMTP) set up in Supabase; until then an admin resets passwords in Settings → Accounts.
