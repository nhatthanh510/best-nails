# Best Nails: test plan, results and UX review

Run on 26 Oct 2026 against the local stack (Next.js dev server, Supabase in Docker), as the seed admin and a temporary staff account. Every test record used the fictional range 0491 570 1xx and was deleted afterwards.

**How each case was tested**
- **DB**: `supabase/tests/business_rules.test.sql` (pgTAP, 54 checks, added in this pass), plus `loyalty.test.sql` and `gift_vouchers.test.sql`. All run with `npm run test:db`, inside a transaction that rolls back.
- **E2E**: by hand in Chrome at 1180×820 (iPad landscape), 820 wide (iPad portrait) and in a 375 px frame (phone).
- **Unit**: Vitest (`npm test`).
- **Code**: read from the code; not exercised.

**Result:** the first run found 7 bugs (3 failing cases, plus 4 smaller bugs noted against cases that otherwise passed); none lost money or points. All 7 are now fixed and were retested the same day, so all 95 cases pass. The automated suites all pass: 23 unit tests, 145 database tests, typecheck, lint and build.

## 1. Test cases

### Sign-in and accounts
| ID | Scenario | Expected | How | Result |
|---|---|---|---|---|
| A-01 | Admin signs in | Lands on the dashboard (or the `next` page) | E2E | Pass |
| A-02 | Wrong password | "That email and password don't match", stays on sign-in, email kept | E2E | Pass (BUG-03 fixed) |
| A-03 | Signed-out visitor opens `/admin/...` | Redirected to sign-in, then back to that page | E2E | Pass |
| A-04 | Staff account opens `/admin/customers` | Sent to the kiosk; no Admin button in the kiosk header | E2E | Pass |
| A-05 | Sign in on a temporary password | Forced to "Choose your password"; kiosk and admin send them back until done | E2E | Pass |
| A-06 | New passwords don't match | "The two new passwords don't match" | E2E | Pass |
| A-07 | Change password with a wrong current password | "Your current password isn't right" | E2E (earlier pass) | Pass |
| A-08 | Forgot password: email, link, new password | Link signs them in and skips the old password once; that session then becomes a normal one | E2E with Mailpit (earlier pass) | Pass |
| A-09 | Forgot password for an unknown email | Same "if that email has an account..." message (no account discovery) | Code | Pass |
| A-10 | Expired or used reset link | Back to Forgot password with "That link has expired" | Code | Pass |
| AC-01 | Admin adds a staff account | Temporary password pill; can sign in straight away (no confirmation email) | E2E | Pass |
| AC-02 | Add an account with an email already used | "An account with this email already exists" | Code | Pass |
| AC-03 | Edit name and role through the ⋯ menu | Saved; your own role can't be changed | E2E (earlier pass) | Pass |
| AC-04 | Reset another account's password | New temporary password; forced change at next sign-in | E2E (earlier pass) | Pass |
| AC-05 | Remove an account | Moves to "Removed accounts"; sign-in refused ("user banned") and signed out everywhere | E2E + DB | Pass |
| AC-06 | Restore a removed account | Can sign in again | Code | Pass |
| AC-07 | Delete a removed account for good | Gone from Auth and staff; their history shows "Staff" | E2E | Pass |
| AC-08 | Remove or demote the last admin | Refused ("the shop needs at least one admin") | DB | Pass |

### Kiosk
| ID | Scenario | Expected | How | Result |
|---|---|---|---|---|
| K-01 | Fewer than 10 digits for a 0… number | Continue stays disabled | E2E | Pass |
| K-02 | Unusual number (e.g. 0512 345 678) | Warning on one line, keypad doesn't move, can still continue | E2E | Pass (BUG-07 fixed) |
| K-03 | Unknown number, no name yet | Goes to sign-up | DB + E2E | Pass |
| K-04 | Sign up with a name | Customer created, checked in, 1 point, punch card shown | DB + E2E | Pass |
| K-05 | Sign up with an empty first name | "Please enter your first name." | E2E | Pass (message shows away from the field) |
| K-05b | Sign up with an impossible birthday (31 Feb) or only a day | Impossible days aren't offered; one part only gets "pick both"; 29 Feb is stored | E2E | Pass (BUG-01 fixed) |
| K-06 | Second check-in on the same shop day | "Already checked in", no extra point or visit | DB + E2E | Pass |
| K-07 | Sign-up with a number that already exists | Keeps the original customer | DB | Pass |
| K-08 | Four check-ins at the same instant (double tap) | Exactly one customer, one check-in, one point | DB race test | Pass |
| K-09 | Returning customer screen | Masked phone (04•• ••• 110), today's check-in, points | E2E | Pass |
| K-10 | Junk phone stored directly | Refused by the database | DB | Pass |
| K-11 | Idle for longer than the setting (60 s) | Typed digits cleared | E2E | Pass |
| K-12 | No reward and birthday off | No empty program card or "How it works" box | E2E | Pass |
| K-13 | Typing on the physical keyboard | Digits, Backspace and Enter work; ignored inside dialogs | E2E | Pass |

### Discounts
| ID | Scenario | Expected | How | Result |
|---|---|---|---|---|
| R-01 | Redeem without enough points | Refused (insufficient points) | DB | Pass |
| R-02 | Redeem for an unknown number | not_found | DB | Pass |
| R-03 | Redeem on the kiosk without a check-in in the last 12 hours | Refused (check-in required) | DB | Pass |
| R-04 | 10 points, checked in, redeem | Confirm step, then the "show this to the front desk" screen, −10 points | DB + E2E | Pass |
| R-05 | Redeeming keeps lifetime points (tier) | Lifetime unchanged | DB | Pass |
| R-06 | A second discount on the same day (points or birthday) | Refused: one discount per visit; kiosk shows "You've had today's discount" | DB + E2E | Pass (BUG-06 copy fixed, not re-seen on screen) |
| R-07 | Turned-off reward | Can't be redeemed | DB | Pass |
| B-01 | Birthday discount without a check-in | Refused | DB | Pass |
| B-02 | Birthday discount in the window | Redeems once | DB | Pass |
| B-03 | Birthday discount turned off | Not available | DB | Pass |
| B-04 | Birthday used twice in one year | Refused (already used) | DB (loyalty.test) | Pass |
| B-05 | 29 Feb birthdays in non-leap years | Count as 28 Feb | Unit | Pass |

### Gift vouchers
| ID | Scenario | Expected | How | Result |
|---|---|---|---|---|
| G-01 | Generated code | Prefix + 8 digits, valid Luhn check digit | DB | Pass |
| G-02 | Default expiry | 3 years from today | DB | Pass |
| G-03 | Typed code "qa-1234 5678" | Stored as QA12345678 | DB | Pass |
| G-04 | Code already used | Refused | DB | Pass |
| G-05 | Under $1 or over $5,000 | Refused | DB | Pass |
| G-06 | Expiry under 3 years | Refused (browser and database) | DB + E2E | Pass (reason not explained) |
| G-07 | Spend part of the balance (code typed in lower case) | Balance goes down | DB + E2E | Pass |
| G-08 | Spend more than the balance | Blocked inline before saving; balance unchanged | DB + E2E | Pass |
| G-09 | Spend exactly the balance, then spend again | Used up; further spends refused | DB | Pass |
| G-10 | Fix a use entered by mistake | No Undo (removed 26 Oct, owner's decision); Adjust balance puts it back with a reason; the undo function no longer exists | DB + E2E | Pass |
| G-11 | Unknown code | not_found | DB | Pass |
| G-12 | Adjust below $0, or with no reason | Refused | DB | Pass |
| G-13 | Edit the balance directly | Refused by the guard | DB | Pass |
| G-14 | Spend an expired voucher | Refused (expired) | DB | Pass |
| G-15 | Create from the kiosk header with a customer on screen | Phone pre-filled; toast with code | E2E | Pass (code vanishes too fast: UX-1) |
| G-16 | Mistyped code (two digits swapped) | "This code looks mistyped" | E2E | Pass |
| G-17 | Delete a used voucher | Not offered; only unspent vouchers can be deleted | E2E + DB policy | Pass |
| G-18 | Vouchers and Activity views, Created/Used filters | Rows, colours and summary correct | E2E | Pass |

### Customers, check-ins, rewards, settings, dashboard
| ID | Scenario | Expected | How | Result |
|---|---|---|---|---|
| C-01 | Add a customer | Created; earns from the next check-in | Code + DB policy | Pass |
| C-02 | Add with an existing number (typed as +61 491 570 110) | "Already exists" once, inline; typed values kept | E2E | Pass (BUG-03 fixed) |
| C-03 | Search by local number "0491570110" | Finds the stored +61 number | E2E | Pass |
| C-04 | Filters Today / Yesterday / Last 7 days / Birthday | Matches check-ins in shop days | E2E (earlier pass) | Pass |
| C-05 | Customer page tiles and history | Balance, tier, next reward, history rows | E2E | Pass |
| C-06 | Adjust points with no reason; then +9 | Blocked; then saved, tier moves to Regular | E2E | Pass |
| C-07 | Points below zero; points edited directly; customer created with points | All refused | DB | Pass |
| C-08 | Delete a customer | Confirm, then gone with their history | E2E | Pass (doesn't mention their gift voucher: UX-9) |
| C-09 | Subtitle with one customer | "1 member" | E2E | Pass (BUG-05 fixed) |
| CI-01 | Today / 7 days / 30 days, search | Correct rows and totals | E2E | Pass |
| CI-02 | Undone check-ins | Left out of the list and totals | Code + DB | Pass |
| CI-03 | Used column | "10% OFF · points", "Gift voucher $20.00" on the visit | E2E | Pass |
| RW-01 | Reward with 0 points | Refused (minimum 1) | E2E | Pass |
| RW-02 | Turn the birthday discount on/off | Kiosk and admin follow | Code | Pass |
| ST-01 | Save button; leave with unsaved changes | "Leave without saving?" with Stay/Leave | E2E | Pass |
| ST-02 | VIP below Regular | Inline error, Save disabled | E2E | Pass |
| ST-03 | Code prefix not 2–4 letters | Refused | Code + DB constraint | Pass |
| D-01 | Dashboard numbers after a visit, redemption and voucher | Counts and credit correct; "N with points" | E2E | Pass (BUG-02 fixed) |

### Security (database level, as each role would through the API)
| ID | Scenario | Expected | How | Result |
|---|---|---|---|---|
| S-01 | Staff account reads customers | 0 rows | DB | Pass |
| S-02 | Staff account adjusts points | Forbidden | DB | Pass |
| S-03 | Staff account creates a gift voucher | Allowed (kiosk header) | DB | Pass |
| S-04 | Signed-in account calls kiosk functions directly | Forbidden (only the server can) | DB | Pass |
| S-05 | Staff account reads the staff list | Only its own row | DB | Pass |
| S-06 | Removed account creates a gift voucher | Forbidden | DB | Pass |
| S-07 | Signed-out visitor calls kiosk functions | Forbidden | DB | Pass |
| S-08 | Signed-out visitor reads customers | 0 rows | DB | Pass |
| S-09 | Function permissions after the migration squash | Identical to the 25 original migrations | Schema diff | Pass |

### Layout and accessibility
| ID | Scenario | Expected | How | Result |
|---|---|---|---|---|
| L-01 | Every admin page at 375 px | No sideways scrolling; account and sign out in the phone menu | E2E (375 px frame) | Pass (BUG-04 fixed) |
| L-02 | Kiosk and Your account at 375 px | No sideways scrolling | E2E | Pass |
| L-03 | iPad portrait (820 wide): kiosk and admin | Kiosk stacks; admin uses the icon rail | E2E | Pass |
| L-04 | iPad landscape (1180×820) kiosk | Welcome left, keypad right, fits without scrolling | E2E | Pass |
| X-01 | Every button and link has a name; every field a label; images have alt; one h1 per page | 9 key pages | Automated scan | Pass |
| X-02 | Console errors during the E2E run | None | E2E | Pass |

**Not tested** (need things this setup doesn't have): a real iPad in Safari with Guided Access and "Add to Home Screen"; losing the network mid-check-in (the kiosk has an offline message, but I didn't cut the connection); reset emails through a real email (SMTP) provider; a shop day rolling over at midnight while the kiosk is open; speed with thousands of customers (the bulk seed was removed).

## 2. Bugs (all fixed on 26 Oct and retested)

| ID | Severity | Where | What happened | Fix |
|---|---|---|---|---|
| BUG-04 | High (phones) | Admin top bar, ≤ 400 px | Logo + kiosk + account + sign out + menu are 19 px too wide, so every admin page scrolls sideways. Regression from the account icon added today. | Fixed: "Your account" and "Sign out" moved to the bottom of the phone menu (`components/admin/sidebar.tsx`). |
| BUG-01 | Medium | Kiosk sign-up | 31 Feb, or a day without a month, is silently dropped: the customer thinks they gave a birthday and never gets the discount. | Fixed: the day list follows the month (29 Feb allowed) and one part alone gets a message; the server action rejects bad dates too (`components/kiosk/screens.tsx`, `app/kiosk/actions.ts`). The admin form already checked. |
| BUG-03 | Medium | Forms using Server Actions (sign-in, Add customer; likely the other dialogs) | After a server error the form clears everything typed. The error also shows twice (toast and inline). | Fixed for all 14 forms with `useFormSubmit` (`lib/use-form-submit.ts`): submits without React's reset, clears after success as before (except Settings, birthday and voucher details, which keep what was saved). Forms with inline errors no longer also toast them (`useActionToast(state, { errors: false })`). |
| BUG-02 | Low | Dashboard "Discounts given this month" | "1 points · 0 birthday": reads as a plural mistake, and shows birthday while it's turned off. | Fixed: "1 with points", birthday part only when it's on (or was used this month). |
| BUG-05 | Low | Customers subtitle | "1 members". | Fixed. |
| BUG-06 | Low | Kiosk, after today's discount | "0 points saved for your next visit". | Fixed: "One discount per visit. See you next time!" at 0, and singular "point". |
| BUG-07 | Low | Kiosk keypad | When the "not a standard number" warning appears, the keys shrink, so buttons move under the finger. | Fixed: one line is always reserved and the warning fits on it. |

## 3. UX review against real-world apps

Compared with Square Loyalty and Square Gift Cards (the closest match: tablet check-in plus prepaid cards at the till), Fresha and Vagaro (salon software), and Starbucks/Sephora rewards (the customer side).

**Already at or above the bar**
- **Phone-number check-in on a shared tablet** with a masked number, an idle reset and a privacy note: the same pattern Square Loyalty uses, with a nicer brand feel.
- **Two-step redeem plus a "show this to the front desk" screen with a timestamp**: Square shows a similar staff-verify screen. Good protection against accidental taps.
- **Gift voucher safety**: the check digit catches typos (most POS systems don't do this for hand-written codes), the 3-year minimum is enforced, and every change, including corrections with Adjust, stays in the voucher's history.
- **Over-balance spends blocked inline** before anything is saved.
- **Roles, removal that keeps history, forced change of temporary passwords**: in line with Square Team and Fresha staff accounts.

**Suggested improvements, in priority order**

| # | Improvement | Seen in | Why |
|---|---|---|---|
| UX-1 | **Done (26 Oct).** After creating a gift voucher, show a confirmation with the **code in large type**, a copy button and "Write this on the card", until dismissed. | Square Gift Cards | Today the code is only in a toast that fades in a few seconds, and staff need to copy it onto the physical card. |
| UX-2 | **Done (26 Oct).** "Use the full $50.00 · take $10.00 at the till" button when the service costs more than the balance. | Square, most POS systems | Staff currently retype the amount; split payment is the common case. |
| UX-3 | **Done (26 Oct), admin customer page only.** **List their vouchers to tap** instead of typing the code. Left off the kiosk on purpose: anyone could type a customer's number there and spend their credit, so the code stays required. | Fresha client profile | Fewer typos, faster at the till. |
| UX-4 | **Dropped (owner's decision):** **Undo a redemption** (from the customer page, for a short time or by an admin). | Square Loyalty ("void reward") | Today a mistaken redeem can only be fixed with Adjust points, which leaves the discount counted as used for the day. |
| UX-5 | **Done (26 Oct).** Put errors **next to the field** and highlight it (kiosk first name, admin forms). | Platform guidelines (Apple, Material) | The kiosk error sits under the birthday, far from the name. |
| UX-6 | **Done (26 Oct).** **Phone first** on Add customer, with an instant "already a customer: open their page" check. | Square Customers | The phone is the identity everywhere else; this catches duplicates before typing a name. |
| UX-7 | **Done (26 Oct).** Gift voucher dialogs on the kiosk in the kiosk's own dark theme and larger sizes; the Create button visible without scrolling. | Square POS on iPad | It currently looks like a different app and needs scrolling at iPad height. |
| UX-8 | **Done (26 Oct).** Say *why* things are blocked: "Vouchers must last at least 3 years (Australian law)"; "Used vouchers can't be deleted. Adjust the balance instead." | General | The browser's "Value must be 26/10/2029 or later" and a missing Delete leave admins guessing. |
| UX-9 | **Done (26 Oct).** Deleting a customer should mention their gift vouchers and unspent credit. | Fresha | The voucher survives unlinked, which surprises later. |
| UX-10 | **Done (26 Oct).** Dashboard tiles in a grid that doesn't leave a gap at iPad width (4 or 6 tiles, or 5 in one row). | Square Dashboard | At 1180 px the tiles wrap 3 + 2 with an empty slot. |
| UX-11 | **Done (26 Oct).** "Use this voucher" on the voucher page as a header button, not a whole card that repeats its own title. | Square, Fresha | Less scrolling on the most-used action. |
| UX-12 | **Data, not code:** give the seed and new accounts real names ("By: Admin · Admin" repeats). | General | Clearer history. |

**Bigger ideas, only if the shop wants them** (each changes what the program does, so they're your call):
- A text after check-in or redemption with the points balance, like Square Loyalty. SMS was removed on purpose, so this would need a decision and a sending service.
- A celebration moment when a customer reaches a reward (Starbucks-style animation on the punch card).
- A daily close-out view: today's discounts, voucher sales and voucher spends, for reconciling with the till. Square's end-of-day report covers this.

## 4. How to rerun

```bash
npm test && npm run test:db     # unit + 145 database tests (business_rules.test.sql covers the DB cases above)
npm run typecheck && npm run lint && npm run build
```
The E2E cases above are manual: use numbers in 0491 570 1xx and delete the customers afterwards.
