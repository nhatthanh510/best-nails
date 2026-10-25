# Best Nails: automated test design

**Current totals:** 146 Vitest tests (12 files) and 72 Playwright tests (9 specs) plus setup and teardown, all passing.

This turns the manual plan in `TEST_PLAN.md` into automated suites. Each case keeps its ID from that plan where one exists, so a failing test points back to the scenario it covers.

## 1. Strategy

**Where each kind of risk is tested**

| Layer | Tool | Location | What it proves |
|---|---|---|---|
| Unit | Vitest | `lib/**/*.test.ts` | Pure rules: phone normalising and masking, birthdays (29 Feb), tiers, money parsing, Luhn typo check, safe redirects, display formatting in the shop's timezone. |
| Server Actions | Vitest with Supabase mocked | `app/**/*.test.ts` | Validation and error messages before the database is reached, and how database statuses become customer-facing text. Also that kiosk responses never carry a full phone number or id. |
| Database | pgTAP (already there) | `supabase/tests/*.test.sql` | Points ledger, one discount per visit, concurrency, RLS and function grants. Not repeated here. |
| End to end | Playwright | `e2e/*.spec.ts` | Real browser against the dev server and local Supabase: kiosk journeys, admin journeys, access control, layout at iPad and phone widths. |

**What gets tested first (by risk)**
1. **Money and points:** gift voucher balances, over-balance spends, one discount per visit, one check-in per day. A bug here costs the shop money or annoys customers.
2. **Privacy on the shared iPad:** masked phone numbers, idle reset, staff accounts kept out of the admin.
3. **Main daily journeys:** kiosk check-in, sign-up and redeem; adding customers; creating and using vouchers.
4. **Everything else:** settings, rewards editor, accounts, layout.

**Test data rules (E2E)**
- Customers only use the fictional range **0491 570 1xx** (`+614915701xx`). Gift voucher codes typed by tests start with **QA**, rewards are named **E2E …**, and accounts are `e2e-…@bestnails.test`.
- Before each test, `e2e/support/db.ts` deletes only that tagged data, puts the settings back to their defaults and pauses the shop's own rewards (otherwise a real "10% OFF" would be the kiosk's main reward). When the run ends, the teardown restores the settings and turns back on exactly the rewards that were active. No other untagged data is touched. If a run is killed before its teardown, run it again to restore them.
- Seeding uses the service-role key from `.env.local` and the same SQL functions the app uses (`kiosk_check_in`, `_post_points`, `_post_gift_voucher`), so the ledger and cached totals stay consistent.
- Settings and rewards are shared by the whole app, so E2E runs on **one worker**. The suite is small enough that this keeps it quick.
- Sign-out revokes every session of that account, so tests that sign out or remove an account use their own throwaway account and never the shared admin or staff login.

**Environment:** `npx supabase start`, then `npm run test:e2e` (it starts `npm run dev` itself if nothing is listening on :3000; `npx playwright install chromium` once). `npm run test:e2e:ui` opens Playwright's UI mode. Failures keep a trace: `npx playwright show-trace test-results/<test>/trace.zip`.

**Writing more E2E tests**
- Import `test` and `expect` from `e2e/support/fixtures.ts` (it cleans data before each test). Seed with `e2e/support/db.ts` rather than clicking through setup screens.
- Server-rendered pages are clickable before React hydrates them. `Kiosk.goto()` and `signIn()` wait for that; use `hydrated(locator)` before the first interaction on any other page that isn't reached through a dialog.
- Next keeps pages visited earlier mounted but hidden, so scope broad locators with `.filter({ visible: true })`.
- Wait for a dialog's open animation with `settled(dialog)` before clicking a button that navigates away.
- Next's route announcer also has `role="alert"`: use `alert(page, text)`.

## 2. Test cases

Legend: **U** = Vitest unit, **SA** = Vitest Server Action with mocks, **E2E** = Playwright, **DB** = existing pgTAP.

### Phone numbers (`lib/phone.ts`, `lib/phone-mask.ts`)
| ID | Case | Layer |
|---|---|---|
| P-01 | AU numbers in every common format (spaces, dashes, brackets, +61, 61, no leading 0) become the same `+61…` key | U |
| P-02 | Non-standard numbers are kept and flagged, never rejected; the same digits always give the same key | U |
| P-03 | Fewer than 8 or more than 12 local digits are rejected | U |
| P-04 | The masked number shows only the first two and last three digits, for any length | U |
| P-05 | The kiosk mask fills mobile (4-3-3) and landline (2-4-4) groupings as digits are typed | U |
| P-06 | Continue needs 10 digits for a 0… number and 8 otherwise | U, E2E |
| P-07 | The client-side `looksStandard` guess agrees with `normalizePhone().standard` for typical numbers | U |
| P-08 | The kiosk's digit limit matches the server's (`MAX_KIOSK_DIGITS` = `MAX_PHONE_DIGITS`) | U |

### Dates, tiers, money and codes
| ID | Case | Layer |
|---|---|---|
| B-05 | 29 Feb birthdays are celebrated on 28 Feb in non-leap years (2100 isn't a leap year, 2000 is) | U |
| B-06 | Impossible dates (31 Apr, 30 Feb, month 13, day 0, fractions) are rejected | U |
| T-01 | Tier boundaries are inclusive at the thresholds; custom thresholds work | U |
| T-02 | `tierRange` agrees with `tierFor` for every point total | U |
| M-01 | Dollar strings become exact cents (no floating-point drift), and junk is rejected | U |
| M-02 | Voucher codes normalise to upper-case letters and digits | U |
| M-03 | The Luhn check catches every single-digit error and adjacent swap in a generated code | U |
| M-04 | Status: expired beats used up, which beats active | U |
| R-01 | `safeRedirectPath` keeps same-site paths and rejects anything that could leave the site | U |
| F-01 | "Today" and "Yesterday" follow the shop's timezone, not UTC or the server's | U |
| F-02 | Number fields keep only valid characters (digits, money with 2 decimals, phone) | U |
| F-03 | Temporary passwords avoid look-alike characters | U |

### Kiosk Server Actions (`app/kiosk/actions.ts`)
| ID | Case | Layer |
|---|---|---|
| KA-01 | A signed-out device gets "signed out" and the database is never queried | SA |
| KA-02 | A found customer's response has a masked phone and no id or full number (it reaches a public screen) | SA |
| KA-03 | Sign-up refuses an empty first name, half a birthday and an impossible date before calling the database | SA |
| KA-04 | 29 Feb is passed through; blank last name becomes no last name | SA |
| KA-05 | Every redeem status maps to its message; an unknown status gets the fallback | SA |
| KA-06 | A malformed reward id is refused without calling the database | SA |

### Admin Server Actions (`app/admin/actions.ts`, `gift-voucher-actions.ts`)
| ID | Case | Layer |
|---|---|---|
| AA-01 | Sign-in routing: temporary password → `/account`, admin → `next` (only if same-site), staff → kiosk | SA |
| AA-02 | Add customer: phone length, first name, both-or-neither birthday, real date, duplicate number message, non-standard warning | SA |
| AA-03 | Adjust points: at least 1, a reason required, Remove sends a negative delta | SA |
| AA-04 | Settings: VIP above Regular, prefix 2–4 letters (upper-cased), known timezone | SA |
| AA-05 | Rewards: a name and at least 1 point; new rewards are always `type = reward` | SA |
| GA-01 | Create voucher: amount at least $1, a code required, unknown customer phone refused | SA |
| GA-02 | Spend: over balance gives the "only $X left" message; a not-found code with a bad check digit says "looks mistyped" | SA |
| GA-03 | Adjust: a non-zero amount and a reason; Remove is negative | SA |
| GA-04 | A voucher that has been spent from can't be deleted | SA, E2E |

### Kiosk journeys (E2E, iPad landscape 1180×820)
| ID | Case |
|---|---|
| K-01 | Continue stays disabled until the number is complete; Clear and Delete last digit work |
| K-02 | An unusual number shows the "not a standard Australian number" warning and can still continue |
| K-03/04 | Unknown number → sign-up → "You're checked in" with +1 point |
| K-05 | Sign-up with an empty first name shows the error by the field |
| K-05b | The day list follows the month (no 31 Feb; 29 Feb offered); half a birthday is refused |
| K-06 | A second check-in the same day goes straight to "checked in today" with no extra point |
| K-09 | A returning customer sees a masked number, their points and Check in |
| K-11 | Idle: typed digits are cleared after the idle timeout |
| K-12 | With no reward and the birthday off, there's no program card |
| K-13 | A physical keyboard types digits, Backspace deletes and Enter continues |
| R-04 | 10 points and checked in → Redeem → confirm → "Show this screen" with −10 points |
| R-06 | After today's discount, the kiosk says "You've had today's discount" and offers nothing more |
| B-02 | In the birthday window with the discount on, the birthday discount can be redeemed with no points |
| G-15 | The Gift voucher header button opens Create with the customer linked; the code is shown in large type |
| KS-01 | Sign out asks first; Cancel keeps the kiosk running |

### Admin journeys (E2E)
| ID | Case |
|---|---|
| A-01 | The admin signs in and lands on the dashboard |
| A-02 | A wrong password shows the error and keeps the email |
| A-03 | A signed-out visitor to `/admin/customers` is sent to sign-in and then back |
| A-04 | A staff account opening `/admin/customers` is sent to the kiosk and has no Admin button |
| A-05 | A new account on a temporary password must choose a password first, then lands on the kiosk |
| A-06 | New passwords that don't match are refused |
| AC-01 | The admin adds a staff account with a temporary password |
| AC-05 | A removed account can't sign in |
| C-01 | Add a customer (phone first), then open their page |
| C-02 | A number that's already a customer is flagged as soon as the phone field is left |
| C-03 | Search by local number finds the stored +61 number |
| C-06 | Adjust points needs a reason; +9 moves the customer to Regular |
| C-08 | Delete a customer after confirming |
| RW-01 | A reward can be created, paused and deleted; 0 points is refused |
| RW-02 | Turning the birthday discount on shows it on the kiosk |
| ST-01 | Leaving Settings with unsaved changes asks first |
| ST-02 | VIP at or below Regular shows the error and disables Save |
| G-07 | Use part of a voucher (typed in lower case with spaces) and see the new balance |
| G-08 | An amount above the balance is blocked inline; "Use all" fills the balance and says what to take at the till |
| G-12 | Adjust balance needs a reason and changes the balance |
| G-14 | An expired voucher is refused |
| G-16 | A code with two digits swapped says it looks mistyped |
| G-17 | An unspent voucher can be deleted; a spent one has no Delete |
| S-01 | Signed out, the kiosk asks for a staff member to sign in |
| L-01/02 | No sideways scrolling at 375 px on the admin dashboard, customers page and kiosk |
| L-04 | The kiosk number screen fits the iPad landscape screen without scrolling |

## 3. Findings from writing these tests (all fixed)

| # | Finding | Fix | Test |
|---|---|---|---|
| F-1 | No confirmation after creating or saving a reward: `RewardEditor` called `onDone()` inside its action, which unmounted the editor before `useActionToast` could show "Reward created." / "Reward saved.". | `useActionToast(state, { onSuccess })` closes the form right after the toast; the five forms that closed themselves inside their action (reward, add/edit account, reset password, customer, use gift voucher) now use it. | RW-01 |
| F-2 | The "can sign in now" toast after adding an account showed only sometimes (same cause, racing the dialog's close animation). | As F-1. | AC-01 |
| F-3 | `signed(0)` returned "−0" and `birthdayWindowLabel(1)` "within 1 days" (not reachable from the UI yet). | Both corrected. | `lib/format.test.ts`, `lib/rewards.test.ts` |
| F-4 | In dev, a very fast first tap can land before React hydrates the page. Not a problem for people, but tests must wait for it. | `hydrated()` helper in the E2E fixtures. | — |

### Left out on purpose
- Database rules already covered by pgTAP (concurrency, RLS for each role, grants). The E2E suite checks the same rules only from the user's side.
- Forgot-password emails (they depend on Mailpit and Auth email rate limits). A–08 stays manual.
- Real iPad Safari behaviour (Guided Access, Add to Home Screen) and losing the network mid-check-in.
